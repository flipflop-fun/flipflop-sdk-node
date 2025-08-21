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

    // Use constant product formula and slippage limit to calculate maximum tradeable amount
    const k = baseReserve.mul(quoteReserve);
    const maxSlippageDecimal = options.maxSlippage / 100;
    
    let maxTokenAAmount: BN;
    let requiredAmount: BN;
    let actualPrice: number;
    const PRECISION_FACTOR = new BN(10).pow(new BN(18));

    if (options.action === 'buy') {
      // Buy operation: calculate maximum quote tokens that can be bought at given slippage
      // Target price = current price * (1 + slippage)
      const targetPrice = currentPrice * (1 + maxSlippageDecimal);
      
      // Use high precision calculation: newQuoteReserve = sqrt(k / targetPrice)
      // To avoid precision loss, convert targetPrice to BN and use integer arithmetic
      // Scale targetPrice to appropriate precision (using 1e18 as precision factor)
      const targetPriceBN = new BN(Math.floor(targetPrice * 1e18));
      
      // Calculate k * PRECISION_FACTOR / targetPriceBN
      const numerator = k.mul(PRECISION_FACTOR);
      const quotient = numerator.div(targetPriceBN);
      
      // Use Newton's method to calculate square root
      const newQuoteReserve = sqrt(quotient);
      
      // Ensure new quote reserve is less than current reserve
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
      // Sell operation: calculate maximum quote tokens that can be sold at given slippage
      // Target price = current price * (1 - slippage)
      const targetPrice = currentPrice * (1 - maxSlippageDecimal);
      
      // Use high precision calculation: newQuoteReserve = sqrt(k / targetPrice)
      const targetPriceBN = new BN(Math.floor(targetPrice * 1e18));
      
      // Calculate k * PRECISION_FACTOR / targetPriceBN
      const numerator = k.mul(PRECISION_FACTOR);
      const quotient = numerator.div(targetPriceBN);
      
      // Use Newton's method to calculate square root
      const newQuoteReserve = sqrt(quotient);
      
      // Ensure new quote reserve is greater than current reserve
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
    
    // Verify calculation results
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


// Calculate square root of BN using Newton's method
function sqrt(value: BN): BN {
  if (value.isZero()) {
    return new BN(0);
  }
  
  // Initial guess value
  let x = value;
  let y = value.add(new BN(1)).div(new BN(2));
  
  // Newton's method iteration
  while (y.lt(x)) {
    x = y;
    y = x.add(value.div(x)).div(new BN(2));
  }
  
  return x;
}