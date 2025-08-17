import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { getNetworkType } from "../config";
import { ApiResponse, EstimateVolumeOptions, EstimateVolumeResponse } from "./types";
import { BN } from "@coral-xyz/anchor";
import { getPoolInfoByRpc } from "./display-pool";

export async function estimateVolume(
  options: EstimateVolumeOptions
): Promise<ApiResponse<EstimateVolumeResponse> | null> {
  // Validate inputs
  if (!options.tokenAMint || !options.tokenBMint) {
    return {
      success: false,
      message: "Token mints are required",
    };
  }
  
  if (!options.action || !['buy', 'sell'].includes(options.action)) {
    return {
      success: false,
      message: "Action must be 'buy' or 'sell'",
    };
  }
  
  if (options.maxSlippage <= 0 || options.maxSlippage >= 100) {
    return {
      success: false,
      message: "Max slippage must be between 0 and 100",
    };
  }
  
  const connection = new Connection(options.rpc, "confirmed");
  const networkType = getNetworkType(connection.rpcEndpoint);

  // Initialize Raydium SDK (without wallet for read-only operations)
  const raydium = await Raydium.load({
    connection,
    cluster: networkType as any,
    disableFeatureCheck: true,
    disableLoadToken: true,
  });

  try {
    const result = await getPoolInfoByRpc(
      raydium,
      options.tokenAMint,
      options.tokenBMint,
      connection.rpcEndpoint
    );

    if (!result?.success || !result?.data) {
      return {
        success: false,
        message: result?.message || "Unknown error",
      };
    }
    
    const baseReserve = new BN(result.data.baseReserve);
    const quoteReserve = new BN(result.data.quoteReserve);
    const currentPrice = Number(baseReserve) / Number(quoteReserve);

    // 使用恒定乘积公式和滑点限制计算最大可交易数量
    const k = baseReserve.mul(quoteReserve);
    const maxSlippageDecimal = options.maxSlippage / 100;
    
    let maxTokenAAmount: BN;
    let requiredAmount: BN;
    let actualPrice: number;
    const PRECISION_FACTOR = new BN(10).pow(new BN(18));

    if (options.action === 'buy') {
      // 购买操作：计算在给定滑点下最多能购买多少 quote 代币
      // 目标价格 = 当前价格 * (1 + 滑点)
      const targetPrice = currentPrice * (1 + maxSlippageDecimal);
      
      // 使用高精度计算：newQuoteReserve = sqrt(k / targetPrice)
      // 为了避免精度丢失，我们将 targetPrice 转换为 BN 并使用整数运算
      // 将 targetPrice 放大到合适的精度（使用 1e18 作为精度因子）
      const targetPriceBN = new BN(Math.floor(targetPrice * 1e18));
      
      // 计算 k * PRECISION_FACTOR / targetPriceBN
      const numerator = k.mul(PRECISION_FACTOR);
      const quotient = numerator.div(targetPriceBN);
      
      // 使用牛顿法计算平方根
      const newQuoteReserve = sqrt(quotient);
      
      // 确保新的 quote 储备量小于当前储备量
      if (newQuoteReserve.gte(quoteReserve)) {
        return {
          success: false,
          message: "Cannot achieve the specified slippage with current liquidity",
        };
      }
      
      maxTokenAAmount = quoteReserve.sub(newQuoteReserve);
      const newBaseReserve = k.div(newQuoteReserve);
      requiredAmount = newBaseReserve.sub(baseReserve);
      actualPrice = Number(requiredAmount) / Number(maxTokenAAmount);
      
    } else { // sell
      // 卖出操作：计算在给定滑点下最多能卖出多少 quote 代币
      // 目标价格 = 当前价格 * (1 - 滑点)
      const targetPrice = currentPrice * (1 - maxSlippageDecimal);
      
      // 使用高精度计算：newQuoteReserve = sqrt(k / targetPrice)
      const targetPriceBN = new BN(Math.floor(targetPrice * 1e18));
      
      // 计算 k * PRECISION_FACTOR / targetPriceBN
      const numerator = k.mul(PRECISION_FACTOR);
      const quotient = numerator.div(targetPriceBN);
      
      // 使用牛顿法计算平方根
      const newQuoteReserve = sqrt(quotient);
      
      // 确保新的 quote 储备量大于当前储备量
      if (newQuoteReserve.lte(quoteReserve)) {
        return {
          success: false,
          message: "Cannot achieve the specified slippage with current liquidity",
        };
      }
      
      maxTokenAAmount = newQuoteReserve.sub(quoteReserve);
      const newBaseReserve = k.div(newQuoteReserve);
      requiredAmount = baseReserve.sub(newBaseReserve);
      actualPrice = Number(requiredAmount) / Number(maxTokenAAmount);
    }
    
    // 验证计算结果
    const calculatedSlippage = (Math.abs(actualPrice - currentPrice) / currentPrice) * 100;
    
    return {
        success: true,
        data: {
            currentPrice,
            baseReserve: result.data.baseReserve,
            quoteReserve: result.data.quoteReserve,
            tokenAAmount: maxTokenAAmount,
            maxSlippage: calculatedSlippage,
            k,
            requiredAmount,
            actualPrice,
            action: options.action,
        } as EstimateVolumeResponse,
    };
  } catch (error) {
    return {
      success: false,
      message: `Error estimating volume: ${(error as any).message}`,
    };
  }
}


// 使用牛顿法计算 BN 的平方根
function sqrt(value: BN): BN {
  if (value.isZero()) {
    return new BN(0);
  }
  
  // 初始猜测值
  let x = value;
  let y = value.add(new BN(1)).div(new BN(2));
  
  // 牛顿法迭代
  while (y.lt(x)) {
    x = y;
    y = x.add(value.div(x)).div(new BN(2));
  }
  
  return x;
}