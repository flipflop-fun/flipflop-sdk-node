import { Connection, PublicKey } from "@solana/web3.js";
import {
  Raydium,
  ZERO,
} from "@raydium-io/raydium-sdk-v2";
import {
  NATIVE_MINT,
} from "@solana/spl-token";
import BN from "bn.js";
import { getPoolInfoByRpc } from "./display-pool";
import { CONFIGS, getNetworkType } from "../config";
import { getLpTokenAmount } from "./remove-liquidity";
import { DisplayLPOptions, LPDisplayResponse } from "./types";

export async function displayLP(
  options: DisplayLPOptions
): Promise<LPDisplayResponse | null> {
  try {
    const { rpc, owner, mint } = options;

    // Validate inputs
    if (!mint) {
      throw new Error("Token mint is required");
    }

    if (!owner) {
      throw new Error("Owner is required");
    }

    if (!rpc) {
      throw new Error("RPC is required");
    }

    const connection = new Connection(rpc, "confirmed");
    const networkType = getNetworkType(rpc);
    const config = CONFIGS[networkType];

    // Initialize Raydium SDK
    const raydium = await Raydium.load({
      connection,
      cluster: networkType as any,
      disableFeatureCheck: true,
      disableLoadToken: false,
    });

    // 使用与remove-liquidity.ts相同的方式获取池子信息
    const poolInfo = await getPoolInfoByRpc(
      connection,
      raydium,
      NATIVE_MINT,
      mint,
      rpc,
    );

    if (!poolInfo) {
      console.error("No CPMM pool found for the given token");
      return null;
    }

    // 获取代币信息
    const tokenAInfo = await raydium.token.getTokenInfo(poolInfo.mintA);
    const tokenBInfo = await raydium.token.getTokenInfo(poolInfo.mintB);
    const lpTokenInfo = await raydium.token.getTokenInfo(poolInfo.mintLp);

    if (!tokenAInfo || !tokenBInfo || !lpTokenInfo) {
      throw new Error("Failed to get token information");
    }

    // 使用与remove-liquidity.ts相同的方式获取LP代币余额
    const lpTokenMint = poolInfo.mintLp;
    let lpTokenBalance = new BN(0);
    let shareOfPool = 0;
    let tokenAAmount = new BN(0);
    let tokenBAmount = new BN(0);

    try {
      const lpToken = await getLpTokenAmount(connection, owner, lpTokenMint);
      
      // 转换为可读格式
      lpTokenBalance = lpToken.amount;

      // 计算池子份额
      const totalLpSupply = poolInfo.lpAmount;
      if (totalLpSupply > ZERO) {
        const sharePercent = lpToken.amount.mul(new BN(10000)).div(totalLpSupply).toNumber() / 100;
        shareOfPool = sharePercent;

        const poolTokenAReserve = new BN(poolInfo.baseReserve || '0');
        const poolTokenBReserve = new BN(poolInfo.quoteReserve || '0');

        tokenAAmount = lpToken.amount.mul(poolTokenAReserve).div(totalLpSupply);
        tokenBAmount = lpToken.amount.mul(poolTokenBReserve).div(totalLpSupply);
      }
    } catch (error) {
      console.warn("Could not fetch LP token balance:", error);
      throw new Error("Failed to fetch LP token balance");
    }

    return {
      poolId: poolInfo.poolAddress,
      lpTokenMint: poolInfo.mintLp,
      lpTokenBalance,
      shareOfPool,
      tokenAAmount,
      tokenBAmount,
      poolInfo,
    };
  } catch (error) {
    console.error("Error displaying LP info:", error);
    return null;
  }
}
