import { Connection, PublicKey, Keypair, Transaction } from "@solana/web3.js";
import {
  createBurnInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  AccountLayout,
  NATIVE_MINT,
} from "@solana/spl-token";
import {
  Raydium,
  TxVersion,
  ApiV3PoolInfoStandardItemCpmm,
} from "@raydium-io/raydium-sdk-v2";
import { CONFIGS, getNetworkType } from "../config";
import BN from "bn.js";

export interface BurnLiquidityOptions {
  rpc: string;
  mint: string;
  lpTokenAmount: number; // LP token amount to burn
  burner: Keypair;
}

export interface BurnLiquidityResponse {
  signature: string;
  mintAddress: string;
  lpTokenAmount: number;
  lpMintAddress: string;
  poolAddress: string;
}

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
  const config = CONFIGS[getNetworkType(options.rpc)];

  try {
    // Initialize Raydium SDK
    const raydium = await Raydium.load({
      owner: options.burner,
      connection,
      cluster: getNetworkType(options.rpc) as any,
      disableFeatureCheck: true,
      disableLoadToken: false,
      blockhashCommitment: "finalized",
    });

    // Get token mint
    const mintPubkey = new PublicKey(options.mint);

    // Find CPMM pool for the token pair (Token/SOL)
    const cpmmPools = await raydium.api.fetchPoolByMints({
      mint1: options.mint,
      mint2: NATIVE_MINT
    });

    if (!cpmmPools || !cpmmPools.data || cpmmPools.data.length === 0) {
      throw new Error(`No CPMM pool found for token ${options.mint}`);
    }

    const poolInfo = cpmmPools.data[0] as ApiV3PoolInfoStandardItemCpmm;

    // Get LP token info
    const lpTokenInfo = await raydium.token.getTokenInfo(
      poolInfo.lpMint.address
    );

    if (!lpTokenInfo) {
      throw new Error("Failed to get LP token information");
    }

    const lpMintPubkey = new PublicKey(poolInfo.lpMint.address);

    // Check LP token balance
    const lpTokenAccounts = await connection.getTokenAccountsByOwner(
      options.burner.publicKey,
      { mint: lpMintPubkey }
    );

    if (lpTokenAccounts.value.length === 0) {
      throw new Error(`No LP token account found for pool ${poolInfo.id}`);
    }

    const lpTokenAccountInfo = AccountLayout.decode(
      lpTokenAccounts.value[0].account.data
    );
    const availableLpBalance = new BN(lpTokenAccountInfo.amount.toString())
      .div(new BN(10).pow(new BN(lpTokenInfo.decimals)))
      .toNumber();

    if (availableLpBalance < options.lpTokenAmount) {
      throw new Error(
        `Insufficient LP token balance. Available: ${availableLpBalance}, Required: ${options.lpTokenAmount}`
      );
    }

    // Get the associated token account for LP tokens
    const lpTokenAccount = await getAssociatedTokenAddress(
      lpMintPubkey,
      options.burner.publicKey
    );

    // Calculate burn amount with decimals
    const burnAmount = new BN(
      options.lpTokenAmount * Math.pow(10, lpTokenInfo.decimals)
    );

    // Create burn instruction
    const burnInstruction = createBurnInstruction(
      lpTokenAccount,
      lpMintPubkey,
      options.burner.publicKey,
      burnAmount.toNumber()
    );

    // Create and send transaction
    const transaction = new Transaction().add(burnInstruction);

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = options.burner.publicKey;

    // Sign and send transaction
    transaction.sign(options.burner);
    const signature = await connection.sendRawTransaction(
      transaction.serialize()
    );

    // Confirm transaction
    await connection.confirmTransaction(signature, "confirmed");

    return {
      signature,
      mintAddress: options.mint,
      lpTokenAmount: options.lpTokenAmount,
      lpMintAddress: poolInfo.lpMint.address,
      poolAddress: poolInfo.id,
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
