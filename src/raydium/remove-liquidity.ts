import {
  Connection,
  PublicKey,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  Raydium,
  Percent,
  makeWithdrawCpmmInInstruction,
} from "@raydium-io/raydium-sdk-v2";
import {
  getAssociatedTokenAddress,
  NATIVE_MINT,
  AccountLayout,
  MintLayout,
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  getAccount,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import BN from "bn.js";
import { getPoolInfoByRpc } from "./display-pool";
import { CONFIGS, getNetworkType } from "../config";
import { compareMints } from "../utils";
import { AUTH_SEED } from "../constants";
import {
  ApiResponse,
  DisplayPoolResponse,
  RemoveLiquidityOptions,
  RemoveLiquidityResponse,
} from "./types";

export async function removeLiquidity(
  options: RemoveLiquidityOptions
): Promise<ApiResponse<RemoveLiquidityResponse>> {
  try {
    const { rpc, payer, mint, slippage = 1 } = options;

    // Validate inputs
    if (!mint) {
      return {
        success: false,
        message: "Token mints are required",
      };
    }

    const connection = new Connection(options.rpc, "confirmed");
    const networkType = getNetworkType(options.rpc);
    const config = CONFIGS[networkType];

    // Initialize Raydium SDK
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

    // Get LP token amount
    const lpTokenMint = new PublicKey(poolInfoData.mintLp);
    const lpTokenInfo = await connection.getAccountInfo(lpTokenMint);
    if (!lpTokenInfo) {
      return {
        success: false,
        message: "Failed to get LP token information",
      };
    }

    const lpToken = await getLpTokenAmount(
      connection,
      payer.publicKey,
      lpTokenMint
    );
    if (!lpToken.success || !lpToken.data) {
      return {
        success: false,
        message: lpToken.message || "Unknown error",
      };
    }

    const lpTokenAmount = lpToken.data.amount
      .mul(new BN(options.removePercentage))
      .div(new BN(100));
    const result = await doRemoveLiquidityInstruction(
      connection,
      poolInfoData,
      lpTokenAmount,
      payer,
      new Percent(slippage, 100)
    );

    // console.log("Liquidity removed successfully. Transaction ID:", result.signature);
    // console.log("Pool ID:", poolInfo.poolAddress);

    return {
      success: true,
      data: {
        signature: result.signature,
        tokenAAmount: result.tokenAAmount,
        tokenBAmount: result.tokenBAmount,
      },
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// 在 doRemoveLiquidityInstruction 函数中修复
async function doRemoveLiquidityInstruction(
  connection: Connection,
  poolInfo: DisplayPoolResponse,
  lpTokenAmountBN: BN,
  payer: Keypair,
  slippagePercent: Percent
) {
  const [authority] = PublicKey.findProgramAddressSync(
    [Buffer.from(AUTH_SEED)],
    new PublicKey(poolInfo.programId)
  );

  // 确保mint排序正确
  const mintA = new PublicKey(poolInfo.mintA);
  const mintB = new PublicKey(poolInfo.mintB);
  const [mint0, mint1] =
    compareMints(mintA, mintB) < 0 ? [mintA, mintB] : [mintB, mintA];
  const isAFirst = mint0.equals(mintA);

  // 获取正确的用户代币账户
  const userTokenAccountA = await getAssociatedTokenAddress(
    mint0,
    payer.publicKey
  );
  const userTokenAccountB = await getAssociatedTokenAddress(
    mint1,
    payer.publicKey
  );
  const userLpAccount = await getAssociatedTokenAddress(
    new PublicKey(poolInfo.mintLp),
    payer.publicKey
  );

  // 计算预期获得的代币数量（基于池子比例）
  const poolTokenAReserve = new BN(poolInfo.baseReserve || "0");
  const poolTokenBReserve = new BN(poolInfo.quoteReserve || "0");
  const totalLpSupply = new BN(poolInfo.lpAmount);

  let expectedTokenAAmount = new BN(0);
  let expectedTokenBAmount = new BN(0);

  if (totalLpSupply.gt(new BN(0))) {
    expectedTokenAAmount = lpTokenAmountBN
      .mul(poolTokenAReserve)
      .div(totalLpSupply);
    expectedTokenBAmount = lpTokenAmountBN
      .mul(poolTokenBReserve)
      .div(totalLpSupply);
  }

  // 根据排序调整预期数量
  const expectedAmount0 = isAFirst
    ? expectedTokenAAmount
    : expectedTokenBAmount;
  const expectedAmount1 = isAFirst
    ? expectedTokenBAmount
    : expectedTokenAAmount;

  const slippageMultiplier = new BN(
    10000 -
      (slippagePercent.numerator.toNumber() * 10000) /
        slippagePercent.denominator.toNumber()
  );
  const minAmount0 = expectedAmount0.mul(slippageMultiplier).div(new BN(10000));
  const minAmount1 = expectedAmount1.mul(slippageMultiplier).div(new BN(10000));

  // 根据排序调整vault
  const vault0 = isAFirst
    ? new PublicKey(poolInfo.vaultA)
    : new PublicKey(poolInfo.vaultB);
  const vault1 = isAFirst
    ? new PublicKey(poolInfo.vaultB)
    : new PublicKey(poolInfo.vaultA);

  // console.log("Remove liquidity parameters:", {
  //   lpTokenAmount: lpTokenAmountBN.toString(),
  //   expectedAmount0: expectedAmount0.toString(),
  //   expectedAmount1: expectedAmount1.toString(),
  //   minAmount0: minAmount0.toString(),
  //   minAmount1: minAmount1.toString(),
  //   mint0: mint0.toString(),
  //   mint1: mint1.toString(),
  // });

  // 检查并创建必要的代币账户
  const instructions = [];
  
  // 检查 tokenA 账户（可能是 WSOL）
  try {
    await getAccount(connection, userTokenAccountA);
  } catch (error: any) {
    if (error.name === "TokenAccountNotFoundError") {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          userTokenAccountA,
          payer.publicKey,
          mint0
        )
      );
    }
  }
  
  // 检查 tokenB 账户（可能是 WSOL）
  try {
    await getAccount(connection, userTokenAccountB);
  } catch (error: any) {
    if (error.name === "TokenAccountNotFoundError") {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          userTokenAccountB,
          payer.publicKey,
          mint1
        )
      );
    }
  }
  
  // 创建withdraw指令
  const withdrawIx = makeWithdrawCpmmInInstruction(
    new PublicKey(poolInfo.programId), // programId
    payer.publicKey, // owner
    authority, // authority
    new PublicKey(poolInfo.poolAddress), // poolId
    userLpAccount, // lpTokenAccount
    userTokenAccountA, // tokenAccountA (正确的账户)
    userTokenAccountB, // tokenAccountB (正确的账户)
    vault0, // vaultA (正确排序)
    vault1, // vaultB (正确排序)
    mint0, // mintA (正确排序)
    mint1, // mintB (正确排序)
    new PublicKey(poolInfo.mintLp), // lpMint
    lpTokenAmountBN, // lpAmount
    minAmount0, // minimumAmountA (正确排序)
    minAmount1 // minimumAmountB (正确排序)
  );

  instructions.push(withdrawIx);

  // 构建并发送交易
  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions, // 使用包含创建账户指令的数组
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([payer]);

  const sig = await connection.sendTransaction(tx);
  await connection.confirmTransaction(sig, "confirmed");

  // 添加 WSOL 清理逻辑
  try {
    // 检查是否有 WSOL 需要清理
    const wsolAccount = mint0.equals(NATIVE_MINT) ? userTokenAccountA : 
                     mint1.equals(NATIVE_MINT) ? userTokenAccountB : null;
    
    if (wsolAccount) {
      const wsolAccountInfo = await getAccount(connection, wsolAccount);
      const wsolBalance = new BN(wsolAccountInfo.amount.toString());
      
      if (wsolBalance.gt(new BN(0))) {
        // 创建关闭 WSOL 账户的指令，将剩余 WSOL 转换回 SOL
        const closeInstructions = [
          createCloseAccountInstruction(
            wsolAccount,
            payer.publicKey,
            payer.publicKey
          )
        ];
        
        const { blockhash: closeBlockhash } = await connection.getLatestBlockhash();
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
    }
  } catch (error) {
    console.warn(`Warning: Failed to cleanup WSOL account: ${(error as any).message}`);
    // 不抛出错误，因为主要的移除流动性操作已经成功
  }

  return {
    signature: sig,
    tokenAAmount: expectedTokenAAmount,
    tokenBAmount: expectedTokenBAmount,
    lpTokenAmount: lpTokenAmountBN,
    poolAddress: new PublicKey(poolInfo.poolAddress),
  };
}

export const getLpTokenAmount = async (
  connection: Connection,
  owner: PublicKey,
  lpTokenMint: PublicKey
) => {
  const lpTokenInfo = await connection.getAccountInfo(lpTokenMint);
  if (!lpTokenInfo) {
    return {
      success: false,
      message: "Failed to get LP token information",
    };
  }

  // 获取用户的LP代币账户地址
  const userLpTokenAccount = await getAssociatedTokenAddress(
    lpTokenMint,
    owner
  );

  // 获取用户LP代币账户信息
  const userLpAccountInfo = await connection.getAccountInfo(userLpTokenAccount);
  if (!userLpAccountInfo) {
    return {
      success: false,
      message: "User does not have LP tokens for this pool",
    };
  }

  // 解析LP代币余额
  const userLpAccountData = AccountLayout.decode(userLpAccountInfo.data);
  const userLpBalance = new BN(userLpAccountData.amount.toString());

  // 获取LP代币的小数位数
  const lpMintAccountInfo = await connection.getAccountInfo(lpTokenMint);
  if (!lpMintAccountInfo) {
    return {
      success: false,
      message: "Failed to get LP mint information",
    };
  }
  const lpMintData = MintLayout.decode(lpMintAccountInfo.data);
  const lpDecimals = lpMintData.decimals;

  if (userLpBalance.lt(new BN(0))) {
    return {
      success: false,
      message: "Insufficient LP token balance",
    };
  }
  return {
    success: true,
    data: {
      amount: userLpBalance,
      decimals: lpDecimals,
    },
  };
};
