import { Connection } from "@solana/web3.js";
import { getURCDetails, initProviderNoSigner } from "./utils";
import { GetUrcDataOptions, GetUrcDataResponse } from "./types";
import { ApiResponse } from "./raydium/types";

// Display URC command handler
export const getUrcData = async (
  options: GetUrcDataOptions
): Promise<ApiResponse<GetUrcDataResponse>> => {
  // Validate required parameters
  if (!options.rpc) {
    return {
      success: false,
      message: "Missing --rpc parameter",
    };
  }

  if (!options.urc) {
    return {
      success: false,
      message: "Missing --urc parameter",
    };
  }

  const rpc = new Connection(options.rpc, "confirmed");
  const urc = options.urc;

  const { program } = await initProviderNoSigner(rpc);

  try {
    const urcDetails = await getURCDetails(rpc, program, urc);

    if (!urcDetails) {
      return {
        success: false,
        message: `❌ Failed to get URC details: ${urc}`,
      };
    }

    return {
      success: true,
      data: {
        urc: urc,
        codeHash: urcDetails.codeHash,
        mint: urcDetails.mint,
        referrerMain: urcDetails.referrerMain,
        referrerAta: urcDetails.referrerAta,
        usageCount: urcDetails.usageCount,
        activeTimestamp: urcDetails.activeTimestamp.toNumber(),
        isValid: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Error getting URC details: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
};
