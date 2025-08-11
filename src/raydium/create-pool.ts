import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import {
  Raydium,
  TxVersion,
  CreateCpmmPoolParam,
  ApiCpmmConfigInfo,
  ApiV3Token,
} from "@raydium-io/raydium-sdk-v2";
import { CONFIGS, getNetworkType } from "../config";
import BN from "bn.js";
import { compareMints } from "../utils";

export interface CreatePoolOptions {
  rpc: string;
  mintA: string; // Base token mint (e.g., SOL)
  mintB: string; // Quote token mint (e.g., USDC)
  amountA: number; // Amount of base token
  amountB: number; // Amount of quote token
  creator: Keypair;
  startTime?: number; // Pool start time (default: current time)
}

export interface CreatePoolResponse {
  signature: string;
  poolAddress: string;
  mintA: string;
  mintB: string;
  amountA: string;
  amountB: string;
  creator: string;
}

export const createPool = async (
  options: CreatePoolOptions,
): Promise<CreatePoolResponse> => {
  if (!options.rpc) {
    throw new Error("Missing rpc parameter");
  }

  if (!options.mintA || !options.mintB) {
    throw new Error("Missing mintA or mintB parameter");
  }

  if (options.mintA === options.mintB) {
    throw new Error("mintA and mintB cannot be the same");
  }

  if (!options.amountA || options.amountA <= 0) {
    throw new Error("Invalid amountA parameter");
  }

  if (!options.amountB || options.amountB <= 0) {
    throw new Error("Invalid amountB parameter");
  }

  if (!options.creator) {
    throw new Error("Missing creator parameter");
  }

  const connection = new Connection(options.rpc, "confirmed");
  const networkType = getNetworkType(options.rpc);
  const config = CONFIGS[networkType];

  try {
    // Initialize Raydium SDK
    const raydium = await Raydium.load({
      owner: options.creator,
      connection,
      cluster: networkType as any,
      disableFeatureCheck: true,
      disableLoadToken: false,
      blockhashCommitment: "finalized",
    });

    // Get token info for both tokens
    const tokenAInfo = await raydium.token.getTokenInfo(options.mintA);
    const tokenBInfo = await raydium.token.getTokenInfo(options.mintB);
    if (!tokenAInfo || !tokenBInfo) {
      throw new Error("Failed to get token information for one or both tokens");
    }

    // Calculate amounts in smallest units
    const amountA = new BN(options.amountA * Math.pow(10, tokenAInfo.decimals));
    const amountB = new BN(options.amountB * Math.pow(10, tokenBInfo.decimals));

    // Get or create associated token accounts for both tokens
    const ataA = await getAssociatedTokenAddress(
      new PublicKey(options.mintA),
      options.creator.publicKey
    );

    const ataB = await getAssociatedTokenAddress(
      new PublicKey(options.mintB),
      options.creator.publicKey
    );

    // Check if ATAs exist and create if needed
    const ataInstructions = [];

    const ataAInfo = await connection.getAccountInfo(ataA);
    if (!ataAInfo) {
      ataInstructions.push(
        createAssociatedTokenAccountInstruction(
          options.creator.publicKey,
          ataA,
          options.creator.publicKey,
          new PublicKey(options.mintA)
        )
      );
    }

    const ataBInfo = await connection.getAccountInfo(ataB);
    if (!ataBInfo) {
      ataInstructions.push(
        createAssociatedTokenAccountInstruction(
          options.creator.publicKey,
          ataB,
          options.creator.publicKey,
          new PublicKey(options.mintB)
        )
      );
    }

    // Execute ATA creation if needed
    if (ataInstructions.length > 0) {
      const tx = new Transaction().add(...ataInstructions);
      const txId = await sendAndConfirmTransaction(
        connection,
        tx,
        [options.creator],
        { commitment: "confirmed" }
      );
    }

    // Create CPMM pool using Raydium SDK with API v3 compatible settings
    const startTime = options.startTime || Math.floor(Date.now() / 1000);

    // Ensure proper mint ordering for API v3 compatibility
    const mintA = new PublicKey(options.mintA);
    const mintB = new PublicKey(options.mintB);
    const [mint0, mint1] = compareMints(mintA, mintB) < 0 ? [mintA, mintB] : [mintB, mintA];
    
    // Ensure amounts are correctly ordered based on mint sorting
    const isReversed = mint0.equals(mintB);
    const finalAmountA = isReversed ? amountB : amountA;
    const finalAmountB = isReversed ? amountA : amountB;

    // Create the pool with API v3 compatible parameters
    const createPoolParams = {
      programId: new PublicKey(config.cpSwapProgram),
      poolFeeAccount: new PublicKey(config.createPoolFeeReceive),
      mintA: {
        address: mint0.toString(),
        programId: TOKEN_PROGRAM_ID.toString(),
        decimals: mint0.equals(mintA) ? tokenAInfo.decimals : tokenBInfo.decimals,
      } as ApiV3Token,
      mintB: {
        address: mint1.toString(),
        programId: TOKEN_PROGRAM_ID.toString(),
        decimals: mint1.equals(mintB) ? tokenBInfo.decimals : tokenAInfo.decimals,
      } as ApiV3Token,
      mintAAmount: finalAmountA,
      mintBAmount: finalAmountB,
      startTime: new BN(startTime),
      feeConfig: {
        id: config.cpSwapConfigAddress,
        index: 0,
        tradeFeeRate: 25, // 0.25% fee (in basis points)
        protocolFeeRate: 0,
        fundFeeRate: 0,
        createPoolFee: "0",
      } as ApiCpmmConfigInfo,
      associatedOnly: false,
      ownerInfo: {
        useSOLBalance: true,
      },
      txVersion: TxVersion.LEGACY, // Use V0 for better API v3 compatibility
    } as CreateCpmmPoolParam<TxVersion>;
    const { execute, extInfo } = await raydium.cpmm.createPool(
      createPoolParams
    );

    // Execute the pool creation transaction with proper error handling
    try {
      const { txId } = await execute({
        sendAndConfirm: true,
      });

      return {
        signature: String(txId),
        poolAddress: extInfo.address.poolId.toString(),
        mintA: mint0.toString(),
        mintB: mint1.toString(),
        amountA: finalAmountA.toString(),
        amountB: finalAmountB.toString(),
        creator: options.creator.publicKey.toString(),
      };
    } catch (error) {
      console.error("Pool creation transaction error:", error);
      throw error;
    }
  } catch (error) {
    console.error("Create pool SDK error:", error);
    throw new Error(
      `Failed to create pool with SDK: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};
