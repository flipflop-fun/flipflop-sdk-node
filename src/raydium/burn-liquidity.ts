import {
  Connection,
  PublicKey,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  createBurnInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  getAccount,
  NATIVE_MINT,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { CONFIGS, getNetworkType } from "../config";
import { getPoolInfoByRpc } from "./display-pool";
import BN from "bn.js";
import { BurnLiquidityOptions, BurnLiquidityResponse } from "./types";

export const burnLiquidity = async (
  options: BurnLiquidityOptions
): Promise<BurnLiquidityResponse> => {
  // Validate required parameters
  if (!options.rpc) {
    throw new Error("Missing rpc parameter");
  }

  if (!options.mint) {
    throw new Error("Missing mint parameter");
  }

  if (!options.lpTokenAmount || options.lpTokenAmount <= 0) {
    throw new Error("Invalid lpTokenAmount parameter");
  }

  if (!options.burner) {
    throw new Error("Missing burner parameter");
  }

  const connection = new Connection(options.rpc, "confirmed");
  const networkType = getNetworkType(options.rpc);
  const config = CONFIGS[networkType];

  try {
    // Initialize Raydium SDK
    const raydium = await Raydium.load({
      connection,
      cluster: networkType as any,
      disableFeatureCheck: true,
      disableLoadToken: false,
      blockhashCommitment: "finalized",
    });

    // Get pool info using getPoolInfoByRpc function
    const poolInfo = await getPoolInfoByRpc(
      connection,
      raydium,
      options.mint,
      NATIVE_MINT,
      options.rpc
    );

    if (!poolInfo) {
      throw new Error(`No CPMM pool found for token ${options.mint}`);
    }

    // Get LP mint from pool info
    const lpMintPubkey = poolInfo.lpMint;
    // console.log(`Found LP mint: ${lpMintPubkey.toBase58()}`);

    // Get LP token info to determine decimals
    const lpTokenInfo = await raydium.token.getTokenInfo(
      lpMintPubkey.toBase58()
    );

    if (!lpTokenInfo) {
      throw new Error("Failed to get LP token information");
    }

    // Get the associated token account for LP tokens
    const lpTokenAccount = await getAssociatedTokenAddress(
      lpMintPubkey,
      options.burner.publicKey
    );

    // Check LP token account exists and get balance
    let lpTokenAccountInfo;
    try {
      lpTokenAccountInfo = await getAccount(connection, lpTokenAccount);
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        throw new Error(
          `No LP token account found for pool ${poolInfo.poolAddress.toBase58()}. Please ensure you have LP tokens to burn.`
        );
      }
      throw error;
    }

    // Check LP token balance
    const availableLpBalance = new BN(lpTokenAccountInfo.amount.toString())
      .div(new BN(10).pow(new BN(lpTokenInfo.decimals)))
      .toNumber();

    if (availableLpBalance < options.lpTokenAmount) {
      throw new Error(
        `Insufficient LP token balance. Available: ${availableLpBalance}, Required: ${options.lpTokenAmount}`
      );
    }

    // console.log(
    //   `Burning ${options.lpTokenAmount} LP tokens from available ${availableLpBalance}`
    // );

    // Calculate burn amount with decimals
    const burnAmount = new BN(options.lpTokenAmount).mul(
      new BN(10).pow(new BN(lpTokenInfo.decimals))
    );

    const instructions = [];

    // Add compute budget instructions
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 })
    );

    // Create burn instruction
    const burnInstruction = createBurnInstruction(
      lpTokenAccount,
      lpMintPubkey,
      options.burner.publicKey,
      burnAmount.toNumber(),
      [],
      TOKEN_PROGRAM_ID
    );

    instructions.push(burnInstruction);

    // Create and send transaction
    const { blockhash } = await connection.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: options.burner.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([options.burner]);

    const signature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    // Confirm transaction
    await connection.confirmTransaction(signature, "confirmed");

    return {
      signature,
      mintAddress: options.mint,
      burnedLpTokenAmount: options.lpTokenAmount,
      lpMintAddress: lpMintPubkey,
      poolAddress: poolInfo.poolAddress,
    };
  } catch (error) {
    console.error("Burn liquidity error:", error);
    throw new Error(
      `Failed to burn liquidity tokens: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};
