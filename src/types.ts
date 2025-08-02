import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { FairMintToken } from "./types/fair_mint_token";

// Basic types
export interface KeypairInfo {
  publicKey: string;
  bs58Secret: string;
  secretArray: number[];
}

// Add more types from IDL as needed
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

export interface DisplayMintOptions {
  rpc: string;
  mint: string;
}

export interface MintInfo {
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  isMutable: boolean;
  configAccount: string;
  admin: string;
  tokenVault: string;
  feeRate: number;
  targetEras: number;
  initialMintSize: number;
  epochesPerEra: number;
  targetSecondsPerEpoch: number;
  reduceRatio: number;
  maxSupply: number;
  liquidityTokensRatio: number;
  currentSupply: number;
  liquidityTokensSupply: number;
  minterTokensSupply: number;
}

export interface UrcInfo {
  urc: string;
  codeHash: string;
  mint: string;
  referrerMain: string;
  referrerAta: string;
  usageCount: number;
  activationDate: string;
  activeTimestamp: string;
  isValid: boolean;
}

export interface GetUrcOptions {
  rpc: string;
  urc: string;
}