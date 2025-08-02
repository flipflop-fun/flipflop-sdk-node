import { Connection } from '@solana/web3.js';
import { getURCDetails, initProviderNoSigner } from './utils';
import { GetUrcOptions, UrcInfo } from './types';

// Display URC command handler
export async function getUrcInfo(options: GetUrcOptions): Promise<UrcInfo | null> {
  const rpcUrl = options.rpc;
  const urc = options.urc;
  const rpc = new Connection(rpcUrl, 'confirmed');

  const { program } = await initProviderNoSigner(rpc);

  try {
    const urcDetails = await getURCDetails(rpc, program, urc);
    
    if (!urcDetails) {
      return null;
    }

    // Format activation timestamp
    const activationDate = new Date(parseInt(urcDetails.activeTimestamp.toString()) * 1000);
    
    return {
      urc: urc,
      codeHash: urcDetails.codeHash.toString(),
      mint: urcDetails.mint.toString(),
      referrerMain: urcDetails.referrerMain.toString(),
      referrerAta: urcDetails.referrerAta.toString(),
      usageCount: urcDetails.usageCount,
      activationDate: activationDate.toLocaleString(),
      activeTimestamp: urcDetails.activeTimestamp.toString(),
      isValid: true
    };
    
  } catch (error) {
    throw new Error(`Error getting URC details: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}