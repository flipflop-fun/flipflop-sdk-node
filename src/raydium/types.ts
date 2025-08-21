import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";

export interface AddLiquidityOptions {
  rpc: string;
  mint: PublicKey;
  tokenAmount: number; // Token amount to add
  slippage: number; // slippage in percentage (e.g., 1 for 1%)
  payer: Keypair;
}

export interface AddLiquidityResponse {
  signature: string;
  mintAddress: PublicKey;
  tokenAmount: BN;
  solAmount: BN; // SOL amount calculated based on pool ratio
  lpTokenAmount: BN;
  poolAddress: PublicKey;
}

export interface BurnLiquidityOptions {
  rpc: string;
  mint: PublicKey;
  lpTokenAmount: number; // LP token amount to burn
  burner: Keypair;
}

export interface BurnLiquidityResponse {
  signature: string;
  mintAddress: PublicKey;
  burnedLpTokenAmount: number;
  lpMintAddress: PublicKey;
  poolAddress: PublicKey;
}

export interface BuyTokenOptions {
  rpc: string;
  mint: PublicKey;
  amount: number;
  slippage?: number;
  payer: Keypair;
}

export interface BuyTokenResponse {
  mintAddress: PublicKey;
  solAmount: number;
  tokenAmount: number;
  cost: number;
  poolAddress: PublicKey;
  actualSolAmount: number;
  actualTokenAmount: number;
  actualCost: number;
  amountFrom: "txhash" | "balance";
  txId: string;
}

export interface CreatePoolOptions {
  rpc: string;
  mintA: PublicKey; // Base token mint (e.g., SOL)
  mintB: PublicKey; // Quote token mint (e.g., USDC)
  amountA: number; // Amount of base token
  amountB: number; // Amount of quote token
  creator: Keypair;
  startTime?: number; // Pool start time (default: current time)
}

export interface CreatePoolResponse {
  signature: string;
  poolAddress: PublicKey;
  mintA: PublicKey;
  mintB: PublicKey;
  amountA: BN;
  amountB: BN;
  creator: PublicKey;
}

export interface DisplayLPOptions {
  rpc: string;
  owner: PublicKey;
  mint: PublicKey;
}

export interface LPDisplayResponse {
  poolId: PublicKey;
  lpTokenMint: PublicKey;
  lpTokenBalance: BN;
  shareOfPool: number;
  tokenAAmount: BN;
  tokenBAmount: BN;
  poolInfo: DisplayPoolResponse;
}

export interface DisplayPoolOptions {
  rpc: string;
  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
}

export interface DisplayPoolResponse {
  poolAddress: PublicKey;
  configId: PublicKey;
  poolCreator: PublicKey;
  vaultA: PublicKey;
  vaultB: PublicKey;
  mintLp: PublicKey;
  mintA: PublicKey;
  mintB: PublicKey;
  mintProgramA: PublicKey;
  mintProgramB: PublicKey;
  observationId: PublicKey;
  bump: number;
  status: number;
  lpDecimals: number;
  mintDecimalA: number;
  mintDecimalB: number;
  lpAmount: BN;
  protocolFeesMintA: BN;
  protocolFeesMintB: BN;
  fundFeesMintA: BN;
  fundFeesMintB: BN;
  openTime: BN;
  programId: PublicKey;
  baseReserve: BN;
  quoteReserve: BN;
  vaultAAmount: BN;
  vaultBAmount: BN;
  configInfo: any;
  poolPrice: number;
  lpMint: PublicKey;
}

export interface RemoveLiquidityOptions {
  rpc: string;
  payer: Keypair;
  mint: PublicKey;
  removePercentage: number;
  slippage?: number;
}

export interface RemoveLiquidityResponse {
  signature?: string;
  tokenAAmount?: BN;
  tokenBAmount?: BN;
}

export interface SellTokenOptions {
  rpc: string;
  mint: PublicKey;
  amount: number; // Token amount to sell
  slippage?: number; // slippage in percentage (e.g., 1 for 1%)
  seller: Keypair;
}

export interface SellTokenResponse {
  mintAddress: PublicKey;
  tokenAmount: number;
  solAmount: number;
  cost: number;
  actualTokenAmount: number;
  actualSolAmount: number;
  actualCost: number;
  poolAddress: PublicKey;
  amountFrom: "txhash" | "balance";
  txId: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface EstimateSlippageOptions {
  action: "buy" | "sell";
  rpc: string;
  tokenAMint: PublicKey; // token mint
  tokenBMint: PublicKey; // wsol mint
  tokenAAmount: number;
}

export interface EstimateSlippageResponse {
    currentPrice: number;
    baseReserve: BN;
    quoteReserve: BN;
    tokenAAmount: BN;
    slippage: number;
    k: BN;
    requiredAmount?: BN; // 买入时是需要支付的数量，卖出时是能获得的数量
    actualPrice?: number; // 实际交易价格
    action?: 'buy' | 'sell'; // 操作类型
}

export interface EstimateVolumeOptions {
  action: "buy" | "sell";
  rpc: string;
  tokenAMint: PublicKey; // token mint
  tokenBMint: PublicKey; // wsol mint
  maxSlippage: number;
}

export interface EstimateVolumeResponse {
    currentPrice: number;
    baseReserve: BN;
    quoteReserve: BN;
    tokenAAmount: BN;
    maxSlippage: number;
    k: BN;
    requiredAmount?: BN; // 买入时是需要支付的数量，卖出时是能获得的数量
    actualPrice?: number; // 实际交易价格
    action?: 'buy' | 'sell'; // 操作类型
}
