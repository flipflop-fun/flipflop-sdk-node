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

export async function sellToken(
  options: SellTokenOptions
): Promise<ApiResponse<SellTokenResponse>> {
  try {
    const connection = new Connection(options.rpc, "confirmed");
    const seller = options.seller;
    const networkType = getNetworkType(options.rpc);
    const config = CONFIGS[networkType];

    // 初始化 Raydium SDK
    const raydium = await Raydium.load({
      connection,
      owner: seller,
      cluster: networkType as any,
      disableFeatureCheck: true,
      disableLoadToken: true,
      blockhashCommitment: "finalized",
    });

    // 获取池子信息
    const poolInfo = await getPoolInfoByRpc(
      connection,
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
    const inputMint = new PublicKey(options.mint); // 输入是要卖出的代币
    const outputMint = NATIVE_MINT; // 输出是SOL
    const inputVault = isToken0Sol ? poolInfoData.vaultB : poolInfoData.vaultA; // 代币的vault
    const outputVault = isToken0Sol ? poolInfoData.vaultA : poolInfoData.vaultB; // SOL的vault

    const amountIn = new BN(options.amount).mul(
      new BN(LAMPORTS_PER_SOL)
    );

    // 获取池子储备量
    const tokenReserve = isToken0Sol
      ? new BN(poolInfoData.quoteReserve)
      : new BN(poolInfoData.baseReserve);
    const solReserve = isToken0Sol
      ? new BN(poolInfoData.baseReserve)
      : new BN(poolInfoData.quoteReserve);

    // 使用 CPMM 公式计算预期输出数量：amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
    const amountOutExpected = amountIn
      .mul(solReserve)
      .div(tokenReserve.add(amountIn));

    // 应用滑点保护（默认 5% 滑点）
    const slippagePercent = options.slippage || 5;
    const slippageMultiplier = new BN(10000 - slippagePercent * 100); // 5% = 500 basis points
    const minAmountOut = amountOutExpected
      .mul(slippageMultiplier)
      .div(new BN(10000));

    // 检查用户 SOL 余额（用于交易费用）
    const userSolBalance = await connection.getBalance(seller.publicKey);
    const requiredSolForFees = 0.01 * LAMPORTS_PER_SOL; // 预留 0.01 SOL 作为交易费用
    if (userSolBalance < requiredSolForFees) {
      return {
        success: false,
        message: `Insufficient SOL balance for transaction fees. Required: ${
          requiredSolForFees / LAMPORTS_PER_SOL
        } SOL, Available: ${userSolBalance / LAMPORTS_PER_SOL} SOL`,
      };
    }

    const instructions = [];

    // 添加计算预算指令
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 })
    );

    // 获取用户的代币账户地址
    const sellerInputTokenAccount = await getAssociatedTokenAddress(
      inputMint,
      seller.publicKey
    );

    // 检查代币账户是否存在并检查余额
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

    // 获取或创建 WSOL 账户
    const sellerOutputTokenAccount = await getAssociatedTokenAddress(
      NATIVE_MINT,
      seller.publicKey
    );

    // 检查 WSOL 账户是否存在，如果不存在则创建
    try {
      await getAccount(connection, sellerOutputTokenAccount);
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        // 创建 WSOL 关联代币账户
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

    // 构建权限地址
    const [authority] = PublicKey.findProgramAddressSync(
      [Buffer.from(AUTH_SEED)],
      poolInfoData.programId
    );

    // 构建交换指令
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

    // 构建并发送交易
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

    try {
      const wsolAccountInfo = await getAccount(
        connection,
        sellerOutputTokenAccount
      );
      const wsolBalance = new BN(wsolAccountInfo.amount.toString());

      if (wsolBalance.gt(new BN(0))) {
        // 如果有 WSOL 余额，将其转换回 SOL
        const closeInstructions = [];

        // 创建关闭 WSOL 账户的指令，这会将 WSOL 转换回 SOL
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
        // console.log(`WSOL account cleaned up, ${wsolBalance.toNumber() / LAMPORTS_PER_SOL} SOL converted back`);
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
        solAmount: minAmountOut.div(new BN(LAMPORTS_PER_SOL)).toNumber(),
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
