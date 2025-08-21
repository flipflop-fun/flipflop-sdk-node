import {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  SystemProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  NATIVE_MINT,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
} from "@solana/spl-token";
import BN from "bn.js";
import { getPoolInfoByRpc } from "./display-pool";
import { CONFIGS, getNetworkType } from "../config";
import {
  Raydium,
  getPdaObservationId,
  makeSwapCpmmBaseOutInstruction,
} from "@raydium-io/raydium-sdk-v2";
import { AUTH_SEED } from "../constants";
import {
  ApiResponse,
  BuyTokenOptions,
  BuyTokenResponse,
  DisplayPoolResponse,
} from "./types";

// 添加解析交易日志的辅助函数
export async function parseSwapAmountsFromTransaction(
  connection: Connection,
  signature: string,
  mint: PublicKey
): Promise<{ actualTokenChange: number; actualSolChange: number } | null> {
  try {
    // 获取交易详情
    const transaction = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });

    if (!transaction || !transaction.meta) {
      console.warn("Transaction not found or no meta data");
      return null;
    }

    let actualTokenChange = 0;
    let actualSolChange = 0;

    // 解析预余额和后余额变化
    if (transaction.meta.preTokenBalances && transaction.meta.postTokenBalances) {
      const preBalances = transaction.meta.preTokenBalances;
      const postBalances = transaction.meta.postTokenBalances;
      // 查找代币余额变化
      for (const postBalance of postBalances) {
        if (postBalance.mint === mint.toString()) {
          const preBalance = preBalances.find(
            (pre) => pre.accountIndex === postBalance.accountIndex
          );
          const preAmount = preBalance && preBalance.uiTokenAmount.uiAmount ? preBalance.uiTokenAmount.uiAmount : 0;
          const postAmount = postBalance.uiTokenAmount.uiAmount || 0;
          actualTokenChange = Math.abs(postAmount - preAmount);
        }
      }

      // 查找 WSOL 余额变化
      for (const preBalance of preBalances) {
        if (preBalance.mint === NATIVE_MINT.toString()) {
          const postBalance = postBalances.find(
            (post) => post.accountIndex === preBalance.accountIndex
          );
          if (postBalance) {
            const preAmount = preBalance.uiTokenAmount.uiAmount || 0;
            const postAmount = postBalance.uiTokenAmount.uiAmount || 0;
            actualSolChange = Math.abs(preAmount - postAmount);
          }
        }
      }
    }

    // 如果通过代币余额解析失败，尝试解析交易日志
    if (actualTokenChange === 0 || actualSolChange === 0) {
      const logs = transaction.meta.logMessages || [];
      
      // 查找包含交换信息的日志
      for (const log of logs) {
        // 查找 Raydium 交换日志模式
        if (log.includes("Program log: swap") || log.includes("Program log: Swap")) {
          // 尝试从日志中提取数量信息
          const amountMatch = log.match(/amount_in:\s*(\d+)|amount_out:\s*(\d+)/g);
          if (amountMatch) {
            console.log("Found swap log:", log);
            // 这里可以根据具体的日志格式进一步解析
          }
        }
      }
    }

    return { actualTokenChange, actualSolChange };
  } catch (error) {
    console.error("Error parsing transaction:", error);
    return null;
  }
}

export async function buyToken(
  options: BuyTokenOptions
): Promise<ApiResponse<BuyTokenResponse>> {
  if (!options.rpc) {
    return {
      success: false,
      message: "RPC url not provided",
    };
  }
  if (!options.mint) {
    return {
      success: false,
      message: "Token mint not provided",
    };
  }
  if (!options.amount) {
    return {
      success: false,
      message: "Token amount not provided",
    };
  }

  if (!options.payer) {
    return {
      success: false,
      message: "Payer not provided",
    };
  }

  try {
    const connection = new Connection(options.rpc, "confirmed");
    const payer = options.payer;
    const networkType = getNetworkType(options.rpc);
    const config = CONFIGS[networkType];

    const raydium = await Raydium.load({
      owner: options.payer,
      connection,
      cluster: networkType as any,
      disableFeatureCheck: true,
      disableLoadToken: true,
      blockhashCommitment: "finalized",
    });

    const poolInfo = await getPoolInfoByRpc(
      raydium,
      NATIVE_MINT,
      options.mint,
      options.rpc
    );
    if (!poolInfo) {
      return {
        success: false,
        message: `No CPMM pool found for token ${options.mint}. You can specify poolAddress parameter to use a specific pool.`,
      };
    }
    if (!poolInfo.success) {
      return {
        success: false,
        message: poolInfo.message || "Unknown error",
      };
    }

    const poolInfoData = poolInfo.data as DisplayPoolResponse;

    const isToken0Sol = poolInfoData.mintA.equals(NATIVE_MINT);
    const inputMint = NATIVE_MINT; // 输入是SOL
    const outputMint = new PublicKey(options.mint); // 输出是目标代币
    const inputVault = isToken0Sol ? poolInfoData.vaultA : poolInfoData.vaultB; // SOL的vault
    const outputVault = isToken0Sol ? poolInfoData.vaultB : poolInfoData.vaultA; // 代币的vault

    // 使用BN直接计算，避免精度丢失
    const amountOut = new BN(options.amount).mul(new BN(LAMPORTS_PER_SOL));
    // const maxAmountIn = new BN(options.maxSolAmount).mul(new BN(LAMPORTS_PER_SOL)); // SOL 有 9 位小数
    const solReserve = isToken0Sol
      ? new BN(poolInfoData.baseReserve)
      : new BN(poolInfoData.quoteReserve);
    const tokenReserve = isToken0Sol
      ? new BN(poolInfoData.quoteReserve)
      : new BN(poolInfoData.baseReserve);

    const amountInRequired = amountOut
      .mul(solReserve)
      .div(tokenReserve.sub(amountOut));

    const slippagePercent = options.slippage || 5;
    const slippageMultiplier = new BN(10000 + slippagePercent * 100); // 1% = 100 basis points
    const maxAmountIn = amountInRequired
      .mul(slippageMultiplier)
      .div(new BN(10000));

    const payerInputTokenAccount = await getAssociatedTokenAddress(
      inputMint,
      payer.publicKey
    );
    const payerOutputTokenAccount = await getAssociatedTokenAddress(
      outputMint,
      payer.publicKey
    );

    // Record initial balances before transaction
    const initialSolBalance = await connection.getBalance(payer.publicKey);
    
    let initialTokenBalance = new BN(0);
    try {
      const tokenAccountInfo = await getAccount(connection, payerOutputTokenAccount);
      initialTokenBalance = new BN(tokenAccountInfo.amount.toString());
    } catch (error) {
      // Token account doesn't exist, balance is 0
      initialTokenBalance = new BN(0);
    }

    let initialWsolBalance = new BN(0);
    try {
      const wsolAccountInfo = await getAccount(connection, payerInputTokenAccount);
      initialWsolBalance = new BN(wsolAccountInfo.amount.toString());
    } catch (error) {
      // WSOL account doesn't exist, balance is 0
      initialWsolBalance = new BN(0);
    }

    // console.log('token account', payerInputTokenAccount.toBase58());
    // console.log('wsol account', payerOutputTokenAccount.toBase58());
    const [authority] = PublicKey.findProgramAddressSync(
      [Buffer.from(AUTH_SEED)],
      new PublicKey(poolInfoData.programId)
    );

    const instructions = [];
    try {
      await getAccount(connection, payerOutputTokenAccount);
    } catch (error) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          payerOutputTokenAccount,
          payer.publicKey,
          outputMint
        )
      );
    }

    try {
      const wsolAccountInfo = await getAccount(
        connection,
        payerInputTokenAccount
      );
      // 检查 WSOL 账户余额是否足够
      const currentWsolBalance = new BN(wsolAccountInfo.amount.toString());
      if (currentWsolBalance.lt(maxAmountIn)) {
        // WSOL 余额不足，需要包装更多 SOL
        const additionalSolNeeded = maxAmountIn.sub(currentWsolBalance);

        // 检查用户的 SOL 余额是否足够
        const solBalance = await connection.getBalance(payer.publicKey);
        const requiredSolForTx = additionalSolNeeded.add(new BN(5000)); // 预留交易费用

        if (solBalance < requiredSolForTx.toNumber()) {
          return {
            success: false,
            message: `Insufficient SOL balance. Available: ${
              solBalance / LAMPORTS_PER_SOL
            } SOL, Required: ${
              requiredSolForTx.toNumber() / LAMPORTS_PER_SOL
            } SOL`,
          };
        }

        // 添加包装 SOL 的指令
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: payerInputTokenAccount,
            lamports: additionalSolNeeded.toNumber(),
          }),
          createSyncNativeInstruction(payerInputTokenAccount)
        );
      }
    } catch (error: any) {
      // WSOL 账户不存在的情况
      if (error.name === "TokenAccountNotFoundError") {
        // 检查用户的 SOL 余额是否足够创建账户并包装
        const solBalance = await connection.getBalance(payer.publicKey);
        const requiredSolForTx = maxAmountIn.add(new BN(5000)); // 预留交易费用

        if (solBalance < requiredSolForTx.toNumber()) {
          return {
            success: false,
            message: `Insufficient SOL balance. Available: ${
              solBalance / LAMPORTS_PER_SOL
            } SOL, Required: ${
              requiredSolForTx.toNumber() / LAMPORTS_PER_SOL
            } SOL`,
          };
        }

        instructions.push(
          createAssociatedTokenAccountInstruction(
            payer.publicKey,
            payerInputTokenAccount,
            payer.publicKey,
            inputMint
          )
        );
        // 创建WSOL账户并wrap所需的SOL
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: payerInputTokenAccount,
            lamports: maxAmountIn.toNumber(),
          }),
          createSyncNativeInstruction(payerInputTokenAccount)
        );
      } else {
        return {
          success: false,
          message: `Error checking WSOL account: ${(error as any).message}`,
        };
      }
    }
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 })
    );

    const swapInstruction = makeSwapCpmmBaseOutInstruction(
      new PublicKey(poolInfoData.programId), // programId
      payer.publicKey, // payer
      authority, // authority
      new PublicKey(config.cpSwapConfigAddress), // configId
      poolInfoData.poolAddress, // poolId
      payerInputTokenAccount, // inputTokenAccount
      payerOutputTokenAccount, // outputTokenAccount
      inputVault, // inputVault
      outputVault, // outputVault
      TOKEN_PROGRAM_ID, // inputTokenProgramId
      TOKEN_PROGRAM_ID, // outputTokenProgramId
      inputMint, // inputMint
      outputMint, // outputMint
      getPdaObservationId(
        new PublicKey(poolInfoData.programId),
        new PublicKey(poolInfoData.poolAddress)
      ).publicKey,
      maxAmountIn,
      amountOut
    );

    instructions.push(swapInstruction);

    const { blockhash } = await connection.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([payer]);

    const sig = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    await connection.confirmTransaction(sig, "confirmed");

    const parsedAmounts = await parseSwapAmountsFromTransaction(
      connection,
      sig,
      outputMint
    );

    let actualTokenAmount: number;
    let actualSolSpent: number;
    let amountFrom: "txhash" | "balance";

    if (parsedAmounts) {
      actualTokenAmount = parsedAmounts.actualTokenChange;
      actualSolSpent = parsedAmounts.actualSolChange;
      amountFrom = "txhash";
    } else {
      // Record token balance after swap but before WSOL cleanup
      let finalTokenBalance = new BN(0);
      try {
        const tokenAccountInfo = await getAccount(connection, payerOutputTokenAccount);
        finalTokenBalance = new BN(tokenAccountInfo.amount.toString());
      } catch (error) {
        finalTokenBalance = new BN(0);
      }

      // Record final balances after WSOL cleanup for fallback calculation
      const finalSolBalance = await connection.getBalance(payer.publicKey);
      
      actualTokenAmount = finalTokenBalance.sub(initialTokenBalance).abs().div(new BN(LAMPORTS_PER_SOL)).toNumber();
      actualSolSpent = new BN(initialSolBalance).sub(new BN(finalSolBalance)).abs().div(new BN(LAMPORTS_PER_SOL)).toNumber();
      amountFrom = "balance";
    }

    // Clean up WSOL account logic (existing code)
    try {
      const wsolAccountInfo = await getAccount(
        connection,
        payerInputTokenAccount
      );
      const remainingWsolBalance = new BN(wsolAccountInfo.amount.toString());

      if (remainingWsolBalance.gt(new BN(0))) {
        // 如果还有剩余的 WSOL，将其转换回 SOL
        const closeInstructions = [];

        // 创建关闭 WSOL 账户的指令，这会将剩余的 WSOL 转换回 SOL
        closeInstructions.push(
          createCloseAccountInstruction(
            payerInputTokenAccount,
            payer.publicKey,
            payer.publicKey
          )
        );

        const { blockhash: closeBlockhash } =
          await connection.getLatestBlockhash();
        const closeMessage = new TransactionMessage({
          payerKey: payer.publicKey,
          recentBlockhash: closeBlockhash,
          instructions: closeInstructions,
        }).compileToV0Message();

        const closeTx = new VersionedTransaction(closeMessage);
        closeTx.sign([payer]);

        const closeSig = await connection.sendTransaction(closeTx);
        await connection.confirmTransaction(closeSig, "confirmed");
      }
    } catch (error) {
      return {
        success: false,
        message: `Error while unwrap WSOL: ${(error as any).message}`,
      };
    }
    
    return {
      success: true,
      data: {
        mintAddress: new PublicKey(options.mint),
        solAmount: maxAmountIn.toNumber() / LAMPORTS_PER_SOL,
        tokenAmount: options.amount,
        cost: maxAmountIn.toNumber() / LAMPORTS_PER_SOL / options.amount,
        actualSolAmount: actualSolSpent,
        actualTokenAmount: actualTokenAmount,
        actualCost: actualSolSpent / actualTokenAmount,
        amountFrom,
        poolAddress: poolInfoData.poolAddress,
        txId: sig,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
}
