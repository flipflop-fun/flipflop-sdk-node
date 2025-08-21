import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  NATIVE_MINT,
  getAccount,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  TokenAccountNotFoundError,
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
import { ApiResponse, CreatePoolOptions, CreatePoolResponse } from "./types";

export const createPool = async (
  options: CreatePoolOptions
): Promise<ApiResponse<CreatePoolResponse>> => {
  if (!options.rpc) {
    return {
      success: false,
      message: "RPC url not provided",
    };
  }

  if (!options.mintA || !options.mintB) {
    return {
      success: false,
      message: "Mint A or Mint B not provided",
    };
  }

  if (options.mintA === options.mintB) {
    return {
      success: false,
      message: "Mint A and Mint B cannot be the same",
    };
  }

  if (!options.amountA || options.amountA <= 0) {
    return {
      success: false,
      message: "Amount A must be greater than 0",
    };
  }

  if (!options.amountB || options.amountB <= 0) {
    return {
      success: false,
      message: "Amount B must be greater than 0",
    };
  }

  const connection = new Connection(options.rpc, "confirmed");
  const config = CONFIGS[getNetworkType(options.rpc)];

  try {
    // Initialize Raydium SDK
    const raydium = await Raydium.load({
      connection,
      cluster: getNetworkType(options.rpc) as any,
      owner: options.creator,
      disableFeatureCheck: true,
      disableLoadToken: true,
      blockhashCommitment: "finalized",
    });

    // Calculate amounts in smallest units
    const amountA = new BN(options.amountA).mul(
      new BN(LAMPORTS_PER_SOL)
    );
    const amountB = new BN(options.amountB).mul(
      new BN(LAMPORTS_PER_SOL)
    );

    // Check which token is WSOL (NATIVE_MINT)
    const isTokenAWSOL = options.mintA.equals(NATIVE_MINT);
    const isTokenBWSOL = options.mintB.equals(NATIVE_MINT);

    if (!isTokenAWSOL && !isTokenBWSOL) {
      return {
        success: false,
        message: "One of the tokens must be SOL (WSOL) to create a pool",
      };
    }

    // Determine WSOL-related parameters
    const wsolMint = isTokenAWSOL ? options.mintA : options.mintB;
    const wsolAmount = isTokenAWSOL ? amountA : amountB;
    const tokenMint = isTokenAWSOL ? options.mintB : options.mintA;
    const tokenAmount = isTokenAWSOL ? amountB : amountA;

    // Get or create associated token accounts for both tokens
    const ataA = await getAssociatedTokenAddress(
      options.mintA,
      options.creator.publicKey
    );

    const ataB = await getAssociatedTokenAddress(
      options.mintB,
      options.creator.publicKey
    );

    const wsolATA = isTokenAWSOL ? ataA : ataB;
    const tokenATA = isTokenAWSOL ? ataB : ataA;
    const instructions = [];

    // Add compute budget instructions
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 })
    );

    // Check and create token account (non-WSOL)
    try {
      await getAccount(connection, tokenATA);
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            options.creator.publicKey,
            tokenATA,
            options.creator.publicKey,
            tokenMint
          )
        );
      } else {
        throw error;
      }
    }

    // Check if token balance is sufficient
    try {
      const tokenAccountInfo = await getAccount(connection, tokenATA);
      const currentTokenBalance = new BN(tokenAccountInfo.amount.toString());
      if (currentTokenBalance.lt(tokenAmount)) {
        return {
          success: false,
          message: `Insufficient token balance. Required: ${tokenAmount
            .div(new BN(LAMPORTS_PER_SOL))
            .toString()}, Available: ${currentTokenBalance
            .div(new BN(LAMPORTS_PER_SOL))
            .toString()}`,
        };
      }
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        return {
          success: false,
          message: `Token account not found. Please ensure you have sufficient tokens to create the pool.`,
        };
      }
      throw error;
    }

    // ###### WSOL account check and creation logic ######

    // Check user's SOL balance
    const userSolBalance = await connection.getBalance(
      options.creator.publicKey
    );
    const requiredSolForFees = 0.02 * LAMPORTS_PER_SOL; // Reserve 0.02 SOL for transaction fees
    const totalRequiredSol = wsolAmount.add(new BN(requiredSolForFees));

    if (userSolBalance < totalRequiredSol.toNumber()) {
      return {
        success: false,
        message: `Insufficient SOL balance. Required: ${
          totalRequiredSol.toNumber() / LAMPORTS_PER_SOL
        } SOL (including fees), Available: ${
          userSolBalance / LAMPORTS_PER_SOL
        } SOL`,
      };
    }

    // Check if WSOL account exists
    try {
      const wsolAccountInfo = await getAccount(connection, wsolATA);
      // WSOL account exists, check if balance is sufficient
      const currentWsolBalance = new BN(wsolAccountInfo.amount.toString());

      if (currentWsolBalance.lt(wsolAmount)) {
        // WSOL balance insufficient, need to wrap more SOL
        const additionalSolNeeded = wsolAmount.sub(currentWsolBalance);

        console.log(
          `WSOL balance insufficient. Need additional ${
            additionalSolNeeded.toNumber() / LAMPORTS_PER_SOL
          } SOL`
        );

        // Add SOL wrapping instructions
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: options.creator.publicKey,
            toPubkey: wsolATA,
            lamports: additionalSolNeeded.toNumber(),
          }),
          createSyncNativeInstruction(wsolATA)
        );
      }
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        // WSOL account does not exist, need to create and wrap SOL
        console.log(
          `Creating WSOL account and wrapping ${
            wsolAmount.toNumber() / LAMPORTS_PER_SOL
          } SOL`
        );

        // Create WSOL associated token account
        instructions.push(
          createAssociatedTokenAccountInstruction(
            options.creator.publicKey,
            wsolATA,
            options.creator.publicKey,
            NATIVE_MINT
          )
        );

        // Transfer SOL to WSOL account and sync
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: options.creator.publicKey,
            toPubkey: wsolATA,
            lamports: wsolAmount.toNumber(),
          }),
          createSyncNativeInstruction(wsolATA)
        );
      } else {
        throw error;
      }
    }

    // Create CPMM pool using Raydium SDK with API v3 compatible settings
    const startTime = options.startTime || Math.floor(Date.now() / 1000);

    // Ensure proper mint ordering for API v3 compatibility
    const mintA = options.mintA;
    const mintB = options.mintB;
    const [mint0, mint1] =
      compareMints(mintA, mintB) < 0 ? [mintA, mintB] : [mintB, mintA];

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
        decimals: 9,
      } as ApiV3Token,
      mintB: {
        address: mint1.toString(),
        programId: TOKEN_PROGRAM_ID.toString(),
        decimals: 9,
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
      txVersion: TxVersion.LEGACY,
    } as CreateCpmmPoolParam<TxVersion>;

    // If there are preprocessing instructions, execute them first
    if (instructions.length > 0) {
      const { blockhash: prepareBlockhash } =
        await connection.getLatestBlockhash();
      const prepareMessage = new TransactionMessage({
        payerKey: options.creator.publicKey,
        recentBlockhash: prepareBlockhash,
        instructions,
      }).compileToV0Message();

      const prepareTx = new VersionedTransaction(prepareMessage);
      prepareTx.sign([options.creator]);

      const prepareSig = await connection.sendTransaction(prepareTx, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      await connection.confirmTransaction(prepareSig, "confirmed");
      console.log(
        `Preparation transaction successful! Signature: ${prepareSig}`
      );
    }

    const { execute, extInfo } = await raydium.cpmm.createPool(
      createPoolParams as CreateCpmmPoolParam<TxVersion>
    );

    // Execute the pool creation transaction with proper error handling
    let poolCreationResult;
    try {
      const { txId } = await execute({
        sendAndConfirm: true,
      });

      poolCreationResult = {
        success: true,
        data: {
          signature: String(txId),
          poolAddress: extInfo.address.poolId,
          mintA: mint0,
          mintB: mint1,
          amountA: finalAmountA,
          amountB: finalAmountB,
          creator: options.creator.publicKey,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create pool with transaction: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }

    // ###### Clean up excess WSOL after successful pool creation ######
    try {
      const wsolAccountInfo = await getAccount(connection, wsolATA);
      const remainingWsolBalance = new BN(wsolAccountInfo.amount.toString());

      if (remainingWsolBalance.gt(new BN(0))) {
        // If there is remaining WSOL, convert it back to SOL
        const closeInstructions = [];

        // Create instruction to close WSOL account, which converts remaining WSOL back to SOL
        closeInstructions.push(
          createCloseAccountInstruction(
            wsolATA,
            options.creator.publicKey,
            options.creator.publicKey
          )
        );

        const { blockhash: closeBlockhash } =
          await connection.getLatestBlockhash();
        const closeMessage = new TransactionMessage({
          payerKey: options.creator.publicKey,
          recentBlockhash: closeBlockhash,
          instructions: closeInstructions,
        }).compileToV0Message();

        const closeTx = new VersionedTransaction(closeMessage);
        closeTx.sign([options.creator]);

        const closeSig = await connection.sendTransaction(closeTx);
        await connection.confirmTransaction(closeSig, "confirmed");
        console.log(
          `WSOL account cleaned up, ${
            remainingWsolBalance.toNumber() / LAMPORTS_PER_SOL
          } SOL converted back`
        );
      }
    } catch (error) {
      console.log("Error cleaning up WSOL account:", error);
      // Don't throw error since the main transaction has already succeeded
    }

    return poolCreationResult;
  } catch (error) {
    return {
      success: false,
      message: `Failed to create pool with SDK: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
};
