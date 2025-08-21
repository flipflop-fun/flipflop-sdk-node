import { Connection } from "@solana/web3.js";
import { PoolInfoLayout, Raydium, ZERO } from "@raydium-io/raydium-sdk-v2";
import { NATIVE_MINT } from "@solana/spl-token";
import BN from "bn.js";
import { getPoolInfoByRpc } from "./display-pool";
import { CONFIGS, getNetworkType } from "../config";
import { getLpTokenAmount } from "./remove-liquidity";
import {
  ApiResponse,
  DisplayLPOptions,
  DisplayPoolResponse,
  LPDisplayResponse,
} from "./types";

export async function displayLP(
  options: DisplayLPOptions
): Promise<ApiResponse<LPDisplayResponse> | null> {
  try {
    const { rpc, owner, mint } = options;

    // Validate inputs
    if (!mint) {
      return {
        success: false,
        message: "Token mint is required",
      };
    }

    if (!owner) {
      return {
        success: false,
        message: "Owner is required",
      };
    }

    if (!rpc) {
      return {
        success: false,
        message: "RPC is required",
      };
    }

    const connection = new Connection(rpc, "confirmed");
    const networkType = getNetworkType(rpc);
    const config = CONFIGS[networkType];

    // Initialize Raydium SDK
    const raydium = await Raydium.load({
      connection,
      cluster: networkType as any,
      disableFeatureCheck: true,
      disableLoadToken: true,
    });

    // Use the same method as remove-liquidity.ts to get pool information
    const poolInfo = await getPoolInfoByRpc(
      raydium,
      NATIVE_MINT,
      mint,
      rpc
    );

    if (!poolInfo) {
      return {
        success: false,
        message: "No CPMM pool found for the given token",
      };
    }

    if (!poolInfo.success) {
      return {
        success: false,
        message: poolInfo.message || "Unknown error",
      };
    }

    const poolInfoData = poolInfo.data as DisplayPoolResponse;

    const lpTokenMint = poolInfoData.mintLp;
    let lpTokenBalance = new BN(0);
    let shareOfPool = 0;
    let tokenAAmount = new BN(0);
    let tokenBAmount = new BN(0);

    try {
      const lpToken = await getLpTokenAmount(connection, owner, lpTokenMint);

      if (!lpToken.success || !lpToken.data) {
        return {
          success: false,
          message: lpToken.message || "Unknown error",
        };
      }

      // Convert to readable format
      lpTokenBalance = lpToken.data.amount;

      // Calculate pool share
      const totalLpSupply = poolInfoData.lpAmount;
      if (totalLpSupply > ZERO) {
        const sharePercent =
          lpToken.data.amount.mul(new BN(10000)).div(totalLpSupply).toNumber() /
          100;
        shareOfPool = sharePercent;

        const poolTokenAReserve = new BN(poolInfoData.baseReserve || "0");
        const poolTokenBReserve = new BN(poolInfoData.quoteReserve || "0");

        tokenAAmount = lpToken.data.amount
          .mul(poolTokenAReserve)
          .div(totalLpSupply);
        tokenBAmount = lpToken.data.amount
          .mul(poolTokenBReserve)
          .div(totalLpSupply);
      }
    } catch (error) {
      return {
        success: false,
        message: "Failed to fetch LP token balance",
      };
    }

    return {
      success: true,
      data: {
        poolId: poolInfoData.poolAddress,
        lpTokenMint: poolInfoData.mintLp,
        lpTokenBalance,
        shareOfPool,
        tokenAAmount,
        tokenBAmount,
        poolInfo: poolInfoData,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Error displaying LP info",
    };
  }
}
