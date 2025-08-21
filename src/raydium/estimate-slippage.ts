import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { getNetworkType } from "../config";
import { ApiResponse, EstimateSlippageOptions, EstimateSlippageResponse } from "./types";
import { BN } from "@coral-xyz/anchor";
import { getPoolInfoByRpc } from "./display-pool";

export async function estimateSlippage(
  options: EstimateSlippageOptions
): Promise<ApiResponse<EstimateSlippageResponse> | null> {
  // Validate inputs
  if (!options.rpc) {
    return {
      success: false,
      message: "Rpc is required",
    };
  }

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
  
  const connection = new Connection(options.rpc as string, "confirmed");
  const networkType = getNetworkType(options.rpc as string);

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
    const tokenAAmount = new BN(options.tokenAAmount).mul(new BN(LAMPORTS_PER_SOL));
    
    // Use constant product formula to calculate slippage
    const k = baseReserve.mul(quoteReserve);
    
    let newBaseReserve: BN;
    let newQuoteReserve: BN;
    let requiredAmount: BN;
    let actualPrice: number;
    
    if (options.action === 'buy') {
      // Buy operation: use base tokens to buy quote tokens
      // tokenAAmount is the amount of quote tokens to buy
      newQuoteReserve = quoteReserve.sub(tokenAAmount);
      if (newQuoteReserve.lte(new BN(0))) {
        return {
          success: false,
          message: "Purchase amount exceeds available liquidity",
        };
      }
      
      newBaseReserve = k.div(newQuoteReserve);
      requiredAmount = newBaseReserve.sub(baseReserve); // Base tokens to pay
      actualPrice = Number(requiredAmount) / Number(tokenAAmount); // base/quote      
    } else { // sell
      // Sell operation: sell quote tokens for base tokens
      // tokenAAmount is the amount of quote tokens to sell
      newQuoteReserve = quoteReserve.add(tokenAAmount);
      newBaseReserve = k.div(newQuoteReserve);
      
      if (newBaseReserve.gte(baseReserve)) {
        return {
          success: false,
          message: "Invalid sell calculation",
        };
      }
      
      requiredAmount = baseReserve.sub(newBaseReserve); // Base tokens to receive
      actualPrice = Number(requiredAmount) / Number(tokenAAmount); // base/quote
    }
    
    // Calculate slippage
    const slippage = (Math.abs(actualPrice - currentPrice) / currentPrice) * 100;
    
    return {
        success: true,
        data: {
            currentPrice,
            baseReserve: result.data.baseReserve,
            quoteReserve: result.data.quoteReserve,
            slippage,
            tokenAAmount,
            k,
            requiredAmount, // Amount to pay when buying, amount to receive when selling
            actualPrice, // Actual trading price
            action: options.action, // Add operation type to return result
        } as EstimateSlippageResponse,
    }
  } catch (error) {
    return {
      success: false,
      message: `Error displaying pool info: ${(error as any).message}`,
    };
  }
}
