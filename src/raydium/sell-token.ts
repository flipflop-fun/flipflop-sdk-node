import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  NATIVE_MINT,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  createCloseAccountInstruction,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import BN from "bn.js";
import { getPoolInfoByRpc } from "./display-pool";
import { CONFIGS, getNetworkType } from "../config";
import {
  Raydium,
  getPdaObservationId,
  makeSwapCpmmBaseInInstruction,
} from "@raydium-io/raydium-sdk-v2";
import { AUTH_SEED } from "../constants";
import { ApiResponse, SellTokenOptions, SellTokenResponse } from "./types";
import { parseSwapAmountsFromTransaction } from "./buy-token";

export async function sellToken(
  options: SellTokenOptions
): Promise<ApiResponse<SellTokenResponse>> {
  try {
    const connection = new Connection(options.rpc, "confirmed");
    const seller = options.seller;
    const networkType = getNetworkType(options.rpc);
    const config = CONFIGS[networkType];

    // Initialize Raydium SDK
    const raydium = await Raydium.load({
      connection,
      owner: seller,
      cluster: networkType as any,
      disableFeatureCheck: true,
      disableLoadToken: true,
      blockhashCommitment: "finalized",
    });

    // Get pool information
    const poolInfo = await getPoolInfoByRpc(
      raydium,
      options.mint,
      NATIVE_MINT,
      options.rpc
    );
    if (!poolInfo) {
      return {
        success: false,
        message: `No CPMM pool found for token ${options.mint}. You can specify poolAddress parameter to use a specific pool.`,
      };
    }
    if (!poolInfo.data || !poolInfo.success) {
      return {
        success: false,
        message: `No CPMM pool data found for token ${options.mint}.`,
      };
    }
    const poolInfoData = poolInfo.data;

    const isToken0Sol = poolInfoData.mintA.equals(NATIVE_MINT);
    const inputMint = new PublicKey(options.mint); // Input is the token to sell
    const outputMint = NATIVE_MINT; // Output is SOL
    const inputVault = isToken0Sol ? poolInfoData.vaultB : poolInfoData.vaultA; // Token vault
    const outputVault = isToken0Sol ? poolInfoData.vaultA : poolInfoData.vaultB; // SOL vault

    const amountIn = new BN(options.amount).mul(
      new BN(LAMPORTS_PER_SOL)
    );

    // Get pool reserves
    const tokenReserve = isToken0Sol
      ? new BN(poolInfoData.quoteReserve)
      : new BN(poolInfoData.baseReserve);
    const solReserve = isToken0Sol
      ? new BN(poolInfoData.baseReserve)
      : new BN(poolInfoData.quoteReserve);

    // Use CPMM formula to calculate expected output amount: amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
    const amountOutExpected = amountIn
      .mul(solReserve)
      .div(tokenReserve.add(amountIn));

    // Apply slippage protection (default 5% slippage)
    const slippagePercent = options.slippage || 5;
    const slippageMultiplier = new BN(10000 - slippagePercent * 100); // 5% = 500 basis points
    const minAmountOut = amountOutExpected
      .mul(slippageMultiplier)
      .div(new BN(10000));

    // Check user SOL balance (for transaction fees)
    const userSolBalance = await connection.getBalance(seller.publicKey);
    const requiredSolForFees = 0.01 * LAMPORTS_PER_SOL; // Reserve 0.01 SOL for transaction fees
    if (userSolBalance < requiredSolForFees) {
      return {
        success: false,
        message: `Insufficient SOL balance for transaction fees. Required: ${
          requiredSolForFees / LAMPORTS_PER_SOL
        } SOL, Available: ${userSolBalance / LAMPORTS_PER_SOL} SOL`,
      };
    }

    const instructions = [];

    // Add compute budget instructions
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 })
    );

    const sellerInputTokenAccount = await getAssociatedTokenAddress(
      inputMint,
      seller.publicKey
    );

    try {
      const tokenAccountInfo = await getAccount(
        connection,
        sellerInputTokenAccount
      );
      const tokenBalance = new BN(tokenAccountInfo.amount.toString());

      if (tokenBalance.lt(amountIn)) {
        return {
          success: false,
          message: `Insufficient token balance. Required: ${amountIn
            .div(new BN(LAMPORTS_PER_SOL))
            .toString()} tokens, Available: ${tokenBalance
            .div(new BN(LAMPORTS_PER_SOL))
            .toString()} tokens`,
        };
      }
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        return {
          success: false,
          message: `Token account not found for mint ${options.mint}. Please ensure you have tokens to sell.`,
        };
      }
      return {
        success: false,
        message: `Error checking token balance: ${(error as any).message}`,
      };
    }

    // Get or create WSOL account
    const sellerOutputTokenAccount = await getAssociatedTokenAddress(
      NATIVE_MINT,
      seller.publicKey
    );

    let initialTokenBalance = new BN(0);
    try {
      const tokenAccountInfo = await getAccount(connection, sellerInputTokenAccount);
      initialTokenBalance = new BN(tokenAccountInfo.amount.toString());
    } catch (error) {
      return {
        success: false,
        message: `Token account not found for mint ${options.mint}. Please ensure you have tokens to sell.`,
      };
    }

    let initialWsolBalance = new BN(0);
    try {
      const wsolAccountInfo = await getAccount(connection, sellerOutputTokenAccount);
      initialWsolBalance = new BN(wsolAccountInfo.amount.toString());
    } catch (error) {
      // WSOL account doesn't exist, balance is 0
      initialWsolBalance = new BN(0);
    }

    // Check if WSOL account exists, create if not
    try {
      await getAccount(connection, sellerOutputTokenAccount);
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        // Create WSOL associated token account
        instructions.push(
          createAssociatedTokenAccountInstruction(
            seller.publicKey,
            sellerOutputTokenAccount,
            seller.publicKey,
            NATIVE_MINT
          )
        );
      } else {
        return {
          success: false,
          message: `Error checking WSOL account: ${(error as any).message}`,
        };
      }
    }

    // Build authority address
    const [authority] = PublicKey.findProgramAddressSync(
      [Buffer.from(AUTH_SEED)],
      poolInfoData.programId
    );

    // Build swap instruction
    const swapInstruction = makeSwapCpmmBaseInInstruction(
      poolInfoData.programId, // programId
      seller.publicKey, // payer
      authority, // authority
      new PublicKey(config.cpSwapConfigAddress), // configId
      poolInfoData.poolAddress, // poolId
      sellerInputTokenAccount, // inputTokenAccount
      sellerOutputTokenAccount, // outputTokenAccount
      inputVault, // inputVault
      outputVault, // outputVault
      TOKEN_PROGRAM_ID, // inputTokenProgramId
      TOKEN_PROGRAM_ID, // outputTokenProgramId
      inputMint, // inputMint
      outputMint, // outputMint
      getPdaObservationId(poolInfoData.programId, poolInfoData.poolAddress)
        .publicKey,
      amountIn,
      minAmountOut
    );

    instructions.push(swapInstruction);

    // Build and send transaction
    const { blockhash } = await connection.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: seller.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([seller]);

    const sig = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    await connection.confirmTransaction(sig, "confirmed");

    // Parse actual transaction amounts from transaction logs
    const parsedAmounts = await parseSwapAmountsFromTransaction(
      connection,
      sig,
      inputMint // Token being sold
    );

    let actualTokenSold: number;
    let actualSolReceived: number;
    let amountFrom: "txhash" | "balance";

    if (parsedAmounts) {
      actualTokenSold = parsedAmounts.actualTokenChange;
      actualSolReceived = parsedAmounts.actualSolChange;
      amountFrom = "txhash";
    } else {
      // Record final balances after transaction
      const finalTokenBalance = await (async () => {
        try {
          const tokenAccountInfo = await getAccount(connection, sellerInputTokenAccount);
          return new BN(tokenAccountInfo.amount.toString());
        } catch (error) {
          return new BN(0); // Account might be closed if balance is 0
        }
      })();

      const finalWsolBalance = await (async () => {
        try {
          const wsolAccountInfo = await getAccount(connection, sellerOutputTokenAccount);
          return new BN(wsolAccountInfo.amount.toString());
        } catch (error) {
          return new BN(0);
        }
      })();

      // Calculate actual amounts based on balance differences
      actualTokenSold = initialTokenBalance.sub(finalTokenBalance).abs().div(new BN(LAMPORTS_PER_SOL)).toNumber();
      actualSolReceived = finalWsolBalance.sub(initialWsolBalance).abs().div(new BN(LAMPORTS_PER_SOL)).toNumber();
      amountFrom = "balance";
    }

    try {
      const wsolAccountInfo = await getAccount(
        connection,
        sellerOutputTokenAccount
      );
      const wsolBalance = new BN(wsolAccountInfo.amount.toString());

      if (wsolBalance.gt(new BN(0))) {
        // If there's WSOL balance, convert it back to SOL
        const closeInstructions = [];

        // Create instruction to close WSOL account, which converts WSOL back to SOL
        closeInstructions.push(
          createCloseAccountInstruction(
            sellerOutputTokenAccount,
            seller.publicKey,
            seller.publicKey
          )
        );

        const { blockhash: closeBlockhash } =
          await connection.getLatestBlockhash();
        const closeMessage = new TransactionMessage({
          payerKey: seller.publicKey,
          recentBlockhash: closeBlockhash,
          instructions: closeInstructions,
        }).compileToV0Message();

        const closeTx = new VersionedTransaction(closeMessage);
        closeTx.sign([seller]);

        const closeSig = await connection.sendTransaction(closeTx);
        await connection.confirmTransaction(closeSig, "confirmed");
      }
    } catch (error) {
      return {
        success: false,
        message: `Error cleaning up WSOL account: ${(error as any).message}`,
      };
    }

    return {
      success: true,
      data: {
        mintAddress: options.mint,
        tokenAmount: options.amount,
        solAmount: minAmountOut.toNumber() / LAMPORTS_PER_SOL,
        cost: minAmountOut.toNumber() / LAMPORTS_PER_SOL / options.amount,
        actualTokenAmount: actualTokenSold,
        actualSolAmount: actualSolReceived,
        actualCost: actualSolReceived / actualTokenSold,
        amountFrom,
        poolAddress: poolInfoData.poolAddress,
        txId: sig,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Error selling token: ${(error as any).message}`,
    };
  }
}
