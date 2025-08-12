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
      connection,
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

    // 添加清理 WSOL 账户的逻辑
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
