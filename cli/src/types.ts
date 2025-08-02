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