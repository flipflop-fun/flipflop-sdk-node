import { Keypair, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { FairMintToken } from "../types/fair_mint_token";

// Re-export existing types
export interface KeypairInfo {
  publicKey: string;
  bs58Secret: string;
  secretArray: number[];
}

export type NetworkType = 'local' | 'devnet' | 'mainnet';

export type RemainingAccount = {
  pubkey: PublicKey,
  isSigner: boolean,
  isWritable: boolean
}

export interface ReferralAccountData {
    referrerMain: PublicKey;
    referrerAta: PublicKey;
    usageCount: number;
    codeHash: PublicKey;
    mint: PublicKey;
    activeTimestamp: BN;
    isProcessing: boolean;
}

export interface ProviderAndProgram {
  program: Program<FairMintToken>;
  provider: AnchorProvider;
  programId: PublicKey;
}

// New SDK-specific types
export interface SDKConfig {
  network: NetworkType;
  rpcUrl: string;
  keypair?: Keypair;
}

export interface LaunchOptions {
  name: string;
  symbol: string;
  uri?: string;
  tokenType?: 'meme' | 'standard';
}

export interface SetURCOptions {
  mint: string;
  urc: string;
}

export interface MintOptions {
  mint: string;
  urc: string;
}

export interface TokenInfo {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  supply: number;
  maxSupply: number;
  feeRate: number;
  currentEra: number;
  currentEpoch: number;
  admin: string;
  tokenVault: string;
  metadata: {
    name: string;
    symbol: string;
    uri: string;
    updateAuthority: string;
  };
}

export interface URCInfo {
  code: string;
  mint: string;
  referrer: string;
  usageCount: number;
  isActive: boolean;
  activeTimestamp: number;
}

export interface LaunchResult {
  mint: string;
  tx: string;
}

export interface MintResult {
  tokenAccount: string;
  tx: string;
}

export interface URCResult {
  tx: string;
}