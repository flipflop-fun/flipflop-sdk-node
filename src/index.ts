import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { FlipFlopSDK } from './lib/sdk';
import { SDKConfig, NetworkType } from './lib/types';

export { FlipFlopSDK } from './lib/sdk';
export * from './lib/types';
export * from './lib/config';
export * from './lib/constants';

export function createSDK(config: SDKConfig): FlipFlopSDK {
  return new FlipFlopSDK(config);
}

export function createSDKFromNetwork(
  network: NetworkType,
  keypair?: Keypair | string | number[],
  rpcUrl?: string
): FlipFlopSDK {
  let keypairInstance: Keypair | undefined;
  
  if (typeof keypair === 'string') {
    keypairInstance = Keypair.fromSecretKey(new Uint8Array(JSON.parse(keypair)));
  } else if (Array.isArray(keypair)) {
    keypairInstance = Keypair.fromSecretKey(new Uint8Array(keypair));
  } else {
    keypairInstance = keypair;
  }

  let rpcEndpoint: string;
  switch (network) {
    case 'mainnet':
      rpcEndpoint = rpcUrl || 'https://api.mainnet-beta.solana.com';
      break;
    case 'devnet':
      rpcEndpoint = rpcUrl || 'https://api.devnet.solana.com';
      break;
    case 'local':
      rpcEndpoint = rpcUrl || 'http://localhost:8899';
      break;
    default:
      throw new Error(`Unsupported network: ${network}`);
  }

  return createSDK({
    network,
    rpcUrl: rpcEndpoint,
    keypair: keypairInstance
  });
}

export default FlipFlopSDK;