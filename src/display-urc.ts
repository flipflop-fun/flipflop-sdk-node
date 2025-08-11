import { Connection } from "@solana/web3.js";
import { getURCDetails, initProviderNoSigner } from "./utils";
import { GetUrcDataOptions, GetUrcDataResponse } from "./types";

// Display URC command handler
export const getUrcData = async (
  options: GetUrcDataOptions
): Promise<GetUrcDataResponse> => {
  // Validate required parameters
  if (!options.rpc) {
    throw new Error("Missing --rpc parameter");
  }

  if (!options.urc) {
    throw new Error("Missing --urc parameter");
  }

  const rpc = new Connection(options.rpc, "confirmed");
  const urc = options.urc;

  const { program } = await initProviderNoSigner(rpc);

  try {
    const urcDetails = await getURCDetails(rpc, program, urc);

    if (!urcDetails) {
      throw new Error(`❌ Failed to get URC details: ${urc}`);
    }

    return {
      urc: urc,
      codeHash: urcDetails.codeHash,
      mint: urcDetails.mint,
      referrerMain: urcDetails.referrerMain,
      referrerAta: urcDetails.referrerAta,
      usageCount: urcDetails.usageCount,
      activeTimestamp: urcDetails.activeTimestamp.toNumber(),
      isValid: true,
    };
  } catch (error) {
    throw new Error(
      `Error getting URC details: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};
