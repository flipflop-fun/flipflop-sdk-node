import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { FairMintToken } from '../types/fair_mint_token';
import { LaunchOptions, SetURCOptions, MintOptions, TokenInfo, URCInfo } from './types';
import { TOKEN_PARAMS } from './constants';
import { CONFIGS, getNetworkType } from './config';
import { getMetadataByMint } from './utils';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { TOKEN_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/utils/token';

export async function launchToken(
  connection: Connection,
  program: Program<FairMintToken>,
  keypair: Keypair,
  options: LaunchOptions
): Promise<{ mint: string; tx: string }> {
  const tokenType = options.tokenType || 'meme';
  const tokenParams = TOKEN_PARAMS[tokenType as keyof typeof TOKEN_PARAMS];
  
  if (!tokenParams) {
    throw new Error(`Invalid token type: ${tokenType}`);
  }

  const network = getNetworkType(connection.rpcEndpoint);
  const config = CONFIGS[network];
  
  // Generate mint keypair
  const mintKeypair = Keypair.generate();
  
  // Implementation placeholder - would use actual program calls
  return {
    mint: mintKeypair.publicKey.toBase58(),
    tx: 'mock_transaction_hash_' + Date.now()
  };
}

export async function setURCCode(
  connection: Connection,
  program: Program<FairMintToken>,
  keypair: Keypair,
  options: SetURCOptions
): Promise<{ tx: string }> {
  const mint = new PublicKey(options.mint);
  const urcCode = options.urc;
  
  // Implementation placeholder
  return {
    tx: 'mock_transaction_hash_' + Date.now()
  };
}

export async function mintTokens(
  connection: Connection,
  program: Program<FairMintToken>,
  keypair: Keypair,
  options: MintOptions
): Promise<{ tokenAccount: string; tx: string }> {
  const mint = new PublicKey(options.mint);
  const urcCode = options.urc;
  
  // Implementation placeholder
  const tokenAccount = await getAssociatedTokenAddress(mint, keypair.publicKey, false, TOKEN_PROGRAM_ID);
  
  return {
    tokenAccount: tokenAccount.toBase58(),
    tx: 'mock_transaction_hash_' + Date.now()
  };
}

export async function getTokenDetails(
  connection: Connection,
  program: Program<FairMintToken>,
  mint: PublicKey
): Promise<TokenInfo> {
  try {
    // Get token metadata
    const metadata = await getMetadataByMint(connection, mint);
    
    // Mock data - would be populated from actual program calls
    return {
      mint: mint.toBase58(),
      name: metadata?.data?.name || 'Unknown Token',
      symbol: metadata?.data?.symbol || 'UNKNOWN',
      uri: metadata?.data?.uri || '',
      supply: 1000000,
      maxSupply: 10000000,
      feeRate: 0.01,
      currentEra: 1,
      currentEpoch: 1,
      admin: 'AdminPublicKey',
      tokenVault: 'TokenVaultPublicKey',
      metadata: {
        name: metadata?.data?.name || 'Unknown Token',
        symbol: metadata?.data?.symbol || 'UNKNOWN',
        uri: metadata?.data?.uri || '',
        updateAuthority: metadata?.updateAuthority || 'UpdateAuthority'
      }
    };
  } catch (error) {
    throw new Error(`Failed to get token details: ${error}`);
  }
}

export async function getURCDetails(
  connection: Connection,
  program: Program<FairMintToken>,
  urcCode: string
): Promise<URCInfo> {
  try {
    // Mock data - would be populated from actual program calls
    return {
      code: urcCode,
      mint: 'MockMintAddress',
      referrer: 'MockReferrerAddress',
      usageCount: 0,
      isActive: true,
      activeTimestamp: Date.now()
    };
  } catch (error) {
    throw new Error(`Failed to get URC details: ${error}`);
  }
}

// Helper functions
export function createKeypair(keypair: string | number[] | Keypair): Keypair {
  if (typeof keypair === 'string') {
    const secretKey = JSON.parse(keypair);
    return Keypair.fromSecretKey(new Uint8Array(secretKey));
  } else if (Array.isArray(keypair)) {
    return Keypair.fromSecretKey(new Uint8Array(keypair));
  } else {
    return keypair;
  }
}

export function createConnection(rpcUrl: string): Connection {
  return new Connection(rpcUrl, 'confirmed');
}

export function validatePublicKey(address: string): PublicKey {
  try {
    return new PublicKey(address);
  } catch (error) {
    throw new Error(`Invalid public key: ${address}`);
  }
}

export function validateURCCode(code: string): boolean {
  return code.length > 0 && code.length <= 32 && /^[a-zA-Z0-9_-]+$/.test(code);
}

export function validateTokenSymbol(symbol: string): boolean {
  return symbol.length > 0 && symbol.length <= 10 && /^[A-Z]+$/.test(symbol);
}

export function validateTokenName(name: string): boolean {
  return name.length > 0 && name.length <= 32;
}

export function lamportsToSol(lamports: number): number {
  return lamports / 1e9;
}

export function solToLamports(sol: number): number {
  return Math.floor(sol * 1e9);
}

export function formatTokenAmount(amount: number, decimals: number = 9): string {
  return (amount / Math.pow(10, decimals)).toFixed(decimals);
}

export function parseTokenAmount(amount: string, decimals: number = 9): number {
  return Math.floor(parseFloat(amount) * Math.pow(10, decimals));
}

export async function getAssociatedTokenAccount(
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  return getAssociatedTokenAddress(mint, owner, false, TOKEN_PROGRAM_ID);
}

export async function accountExists(
  connection: Connection,
  publicKey: PublicKey
): Promise<boolean> {
  const accountInfo = await connection.getAccountInfo(publicKey);
  return accountInfo !== null;
}

export async function waitForTransaction(
  connection: Connection,
  signature: string,
  commitment: 'processed' | 'confirmed' | 'finalized' = 'confirmed'
): Promise<void> {
  await connection.confirmTransaction(signature, commitment);
}

export async function estimateTransactionFee(
  connection: Connection
): Promise<number> {
  try {
    const feeCalculator = await connection.getFeeCalculatorForBlockhash(
      (await connection.getLatestBlockhash()).blockhash
    );
    return feeCalculator.value?.lamportsPerSignature || 5000;
  } catch (error) {
    return 5000; // Default fallback
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await sleep(delay * (i + 1));
      }
    }
  }
  
  throw lastError!;
}

export function getTransactionUrl(tx: string, network: string): string {
  switch (network) {
    case 'mainnet':
      return `https://solscan.io/tx/${tx}`;
    case 'devnet':
      return `https://solscan.io/tx/${tx}?cluster=devnet`;
    case 'local':
      return `http://localhost:3000/tx/${tx}`;
    default:
      return `https://solscan.io/tx/${tx}`;
  }
}

export function generateKeypair(): Keypair {
  return Keypair.generate();
}

export function keypairFromSecretKey(secretKey: Uint8Array): Keypair {
  return Keypair.fromSecretKey(secretKey);
}

export function exportKeypair(keypair: Keypair): {
  publicKey: string;
  secretKey: number[];
} {
  return {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: Array.from(keypair.secretKey)
  };
}