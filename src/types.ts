import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { FairMintToken } from "./types/fair_mint_token";

// Add more types from IDL as needed
export type NetworkType = "local" | "devnet" | "mainnet";
export type TokenType = "meme" | "standard" | "test";

export interface RemainingAccount {
  pubkey: PublicKey;
  isSigner: boolean;
  isWritable: boolean;
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

export interface GetMintDataOptions {
  rpc: string;
  mint: PublicKey;
}

export interface GetMintDataResponse {
  mint: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  isMutable: boolean;
  configAccount: PublicKey;
  admin: PublicKey;
  tokenVault: PublicKey;
  wsolVault: PublicKey;
  tokenVaultBalance: number;
  wsolVaultBalance: number;
  feeRate: number;
  targetEras: number;
  supply: number;
  currentEra: number;
  currentEpoch: number;
  startTimestampEpoch: number;
  elapsedSecondsEpoch: number;
  lastDifficultyCoefficient: number;
  difficultyCoefficient: number;
  mintSizeEpoch: number;
  quantityMintedEpoch: number;
  targetMintSizeEpoch: number;
  initialMintSize: number;
  initialTargetMintSizePerEpoch: number;
  epochesPerEra: number;
  targetSecondsPerEpoch: number;
  reduceRatio: number;
  maxSupply: number;
  liquidityTokensRatio: number;
  currentSupply: number;
  liquidityTokensSupply: number;
  minterTokensSupply: number;
}

export interface GetUrcDataResponse {
  urc: string;
  codeHash: PublicKey;
  mint: PublicKey;
  referrerMain: PublicKey;
  referrerAta: PublicKey;
  usageCount: number;
  activeTimestamp: number;
  isValid: boolean;
}

export interface GetUrcDataOptions {
  rpc: string;
  urc: string;
}

// Token metadata interface
export interface TokenMetadata {
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
}

export interface LaunchTokenOptions {
  tokenType: TokenType;
  name: string;
  symbol: string;
  uri?: string;
  rpc: string;
  creator: Keypair;
}

export interface LaunchTokenResponse {
  transactionHash: string;
  mintAddress: PublicKey;
  configAddress: PublicKey;
  metadata: TokenMetadata;
  configuration: ConfigAccountData;
}

export interface ConfigAccountData {
  admin: PublicKey;
  feeRate: number;
  maxSupply: number;
  targetEras: number;
  initialMintSize: number;
  initialTargetMintSizePerEpoch: number;
  epochesPerEra: number;
  targetSecondsPerEpoch: number;
  reduceRatio: number;
  tokenVault: PublicKey;
  wsolVault: PublicKey;
  liquidityTokensRatio: number;
  supply: number;
  currentEra: number;
  currentEpoch: number;
  elapsedSecondsEpoch: number;
  startTimestampEpoch: number;
  difficultyCoefficient: number;
  lastDifficultyCoefficient: number;
  mintSizeEpoch: number;
  quantityMintedEpoch: number;
  targetMintSizeEpoch: number;
  graduateEpoch: number;
}

export interface SystemConfigAccountOptions {
  rpc: string;
}

export interface SystemConfigAccountData {
  systemConfigAccount: PublicKey;
  systemManagerAccount: PublicKey;
  admin: PublicKey;
  count: number;
  referralUsageMaxCount: number;
  protocolFeeAccount: PublicKey;
  refundFeeRate: number;
  referrerResetIntervalSeconds: number;
  updateMetadataFee: number;
  customizedDeployFee: number;
  initPoolWsolAmount: number;
  graduateFeeRate: number;
  minGraduateFee: number;
  raydiumCpmmCreateFee: number;
  isPause: boolean;
  launchRuleAccount: PublicKey;
}

export interface SetUrcOptions {
  rpc: string;
  urc: string;
  mint: PublicKey;
  refAccount: Keypair;
}

export interface SetUrcResponse {
  transactionHash: string;
  urc: string;
  mint: PublicKey;
  referrer: PublicKey;
  referrerTokenAccount: PublicKey;
  codeHash: PublicKey;
  usageCount: number;
  activatedAt: number;
}

export interface MintTokenOptions {
  rpc: string;
  minter: Keypair;
  mint: PublicKey;
  urc: string;
  lookupTableAccount?: PublicKey;
  skipPreflight?: boolean;
}
export interface MintTokenResponse {
  tx: string;
  owner: PublicKey;
  tokenAccount: PublicKey;
}

export interface RefundTokenOptions {
  rpc: string;
  mint: PublicKey;
  owner: Keypair;
}

export interface RefundTokenResponse {
  tx: string;
}

export interface InitSystemConfigOptions {
  rpc: string;
  systemManager: Keypair;
}

export interface InitSystemConfigResponse {
  lookupTableAddress: PublicKey;
  systemConfigAddress: PublicKey;
  systemManager: PublicKey;
  createdNewLUT: boolean;
}

export interface NetworkConfig {
  programId: string;
  lookupTableAccount: string;
  systemManagerAccount: string;
  cpSwapProgram: string;
  cpSwapConfigAddress: string;
  createPoolFeeReceive: string;
  allowOwnerOffCurveForProtocolFeeAccount: boolean;
  irysGatewayUrl: string;
  apiBaseUrl: string;
}

export interface GenerateMetadataUriOptions {
  rpc: string;
  name: string;
  symbol: string;
  description?: string;
  imagePath: string;
}

export interface MetadataUploadResponse {
  metadataUrl?: string;
  imageUrl?: string;
}

export interface MetadataParams {
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  extensions?: {
    website?: string;
    twitter?: string;
    discord?: string;
    telegram?: string;
    github?: string;
    medium?: string;
  };
}

export interface TokenParams {
  targetEras: BN;
  epochesPerEra: BN;
  targetSecondsPerEpoch: BN;
  reduceRatio: BN;
  initialMintSize: BN;
  initialTargetMintSizePerEpoch: BN;
  feeRate: BN;
  liquidityTokensRatio: BN;
}
