import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  VersionedTransaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  API_URLS,
  Raydium,
  TxVersion,
  ApiV3PoolInfoStandardItemCpmm,
  Percent,
} from "@raydium-io/raydium-sdk-v2";
import { CONFIGS, getNetworkType } from "../config";
import axios from "axios";
import BN from "bn.js";

export interface SellTokenOptions {
  rpc: string;
  mint: string;
  amount: number; // Token amount to sell
  slippage: number; // slippage in percentage (e.g., 1 for 1%)
  seller: Keypair;
}

export interface SellTokenResponse {
  signature: string;
  mintAddress: string;
  tokenAmount: number;
  solAmount: string;
  poolAddress: string;
}

interface SwapCompute {
  id: string;
  success: true;
  version: "V0" | "V1";
  openTime?: undefined;
  msg: undefined;
  data: {
    swapType: "BaseIn" | "BaseOut";
    inputMint: string;
    inputAmount: string;
    outputMint: string;
    outputAmount: string;
    otherAmountThreshold: string;
    slippageBps: number;
    swapInstructions: any[];
    addressLookupTableAddresses: string[];
    priorityFeeInstructions: any[];
  };
}

interface PriorityFeeResponse {
  id: string;
  success: boolean;
  data: { default: { vh: number; h: number; m: number } };
}

interface SwapTransactionResponse {
  id: string;
  version: string;
  success: boolean;
  data: { transaction: string }[];
}

// API 方式卖出代币（用于 mainnet）
const sellTokenWithApi = async (
  options: SellTokenOptions,
  connection: Connection
): Promise<SellTokenResponse> => {
  try {
    // Get token account to determine decimals and actual amount
    const tokenAccounts = await connection.getTokenAccountsByOwner(
      options.seller.publicKey,
      { mint: new PublicKey(options.mint) }
    );

    if (tokenAccounts.value.length === 0) {
      throw new Error("No token account found for the specified mint");
    }

    // Get token info to determine decimals
    const mintInfo = await connection.getParsedAccountInfo(
      new PublicKey(options.mint)
    );
    const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 9;

    const inputMint = options.mint;
    const outputMint = NATIVE_MINT.toBase58(); // SOL
    const amount = Math.floor(options.amount * Math.pow(10, decimals)); // Convert to token units
    const slippage = options.slippage;
    const txVersion = "V0";

    // 1. Get swap quote
    const { data: swapResponse } = await axios.get<SwapCompute>(
      `${
        API_URLS.SWAP_HOST
      }/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${
        slippage * 100
      }&txVersion=${txVersion}`
    );

    if (!swapResponse.success) {
      throw new Error("Failed to get swap quote");
    }

    // 2. Get priority fee
    const { data: feeData } = await axios.get<PriorityFeeResponse>(
      `${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`
    );

    if (!feeData.success) {
      throw new Error("Failed to get priority fee");
    }

    // Get input token account
    const inputTokenAcc = tokenAccounts.value[0].pubkey;

    // 3. Create swap transaction
    const { data: swapTransactions } =
      await axios.post<SwapTransactionResponse>(
        `${API_URLS.SWAP_HOST}/transaction/swap-base-in`,
        {
          computeUnitPriceMicroLamports: String(feeData.data.default.h),
          swapResponse,
          txVersion,
          wallet: options.seller.publicKey.toBase58(),
          wrapSol: false,
          unwrapSol: true, // Unwrap SOL to receive native SOL
          inputAccount: inputTokenAcc.toBase58(),
        }
      );

    if (!swapTransactions.success || !swapTransactions.data.length) {
      throw new Error("Failed to create swap transaction");
    }

    // 4. Deserialize and execute transactions
    const allTxBuf = swapTransactions.data.map((tx) =>
      Buffer.from(tx.transaction, "base64")
    );
    const allTransactions = allTxBuf.map((txBuf) =>
      VersionedTransaction.deserialize(txBuf)
    );

    let finalTxId = "";
    for (const tx of allTransactions) {
      tx.sign([options.seller]);
      const txId = await connection.sendTransaction(tx, {
        skipPreflight: true,
      });

      const { lastValidBlockHeight, blockhash } =
        await connection.getLatestBlockhash({
          commitment: "finalized",
        });

      await connection.confirmTransaction(
        {
          blockhash,
          lastValidBlockHeight,
          signature: txId,
        },
        "confirmed"
      );
      finalTxId = txId;
    }

    // Calculate received SOL amount from swap response
    const solAmount = parseFloat(swapResponse.data.outputAmount) / 1e9; // Convert lamports to SOL

    return {
      signature: finalTxId,
      mintAddress: options.mint,
      tokenAmount: options.amount,
      solAmount: solAmount.toString(),
      poolAddress: "N/A", // API 方式无法获取具体池地址
    };
  } catch (error) {
    console.error("Sell token API error:", error);
    throw new Error(
      `Failed to sell token with API: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

// SDK 方式卖出代币（用于 local/devnet）
const sellTokenWithSdk = async (
  options: SellTokenOptions,
  connection: Connection
): Promise<SellTokenResponse> => {
  const networkType = getNetworkType(options.rpc);

  try {
    // Initialize Raydium SDK
    const raydium = await Raydium.load({
      owner: options.seller,
      connection,
      cluster: networkType as any,
      disableFeatureCheck: true,
      disableLoadToken: false,
      blockhashCommitment: "finalized",
    });

    // Find CPMM pool for the token pair (Token/SOL)
    const cpmmPools = await raydium.api.fetchPoolByMints({
      mint1: options.mint,
      mint2: NATIVE_MINT,
    });

    if (!cpmmPools || !cpmmPools.data || cpmmPools.data.length === 0) {
      throw new Error(`No CPMM pool found for token ${options.mint}`);
    }

    const poolInfo = cpmmPools.data[0] as ApiV3PoolInfoStandardItemCpmm;

    // Get token info to determine decimals
    const tokenInfo = await raydium.token.getTokenInfo(options.mint);
    const solInfo = await raydium.token.getTokenInfo(NATIVE_MINT);

    if (!tokenInfo || !solInfo) {
      throw new Error("Failed to get token information");
    }

    // Calculate input amount (Token in smallest units)
    const inputAmount = new BN(
      options.amount * Math.pow(10, tokenInfo.decimals)
    );

    // Build swap instruction
    const { execute } = await raydium.cpmm.swap({
      poolInfo,
      inputAmount,
      baseIn: false, // Token is not base token (SOL is base)
      slippage: options.slippage / 100, // Convert percentage to decimal
      swapResult: {
        sourceAmountSwapped: inputAmount,
        destinationAmountSwapped: new BN(0), // Will be calculated by the SDK
      },
      config: {
        associatedOnly: false,
        checkCreateATAOwner: true,
      },
      computeBudgetConfig: {
        microLamports: 600000,
      },
    });

    // Execute the swap transaction
    const { txId } = await execute({
      sendAndConfirm: true,
    });

    // For SDK mode, we'll return a placeholder for SOL amount
    // In a real implementation, you'd need to check the transaction logs
    // or account balances before/after to get the exact amount
    const solAmountReceived = "0"; // Placeholder - would need to be calculated from transaction

    return {
      signature: txId,
      mintAddress: options.mint,
      tokenAmount: options.amount,
      solAmount: solAmountReceived,
      poolAddress: poolInfo.id,
    };
  } catch (error) {
    console.error("Sell token SDK error:", error);
    throw new Error(
      `Failed to sell token with SDK: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

// 主函数：根据网络类型选择不同的实现方式
export const sellToken = async (
  options: SellTokenOptions
): Promise<SellTokenResponse> => {
  // Validate required parameters
  if (!options.rpc) {
    throw new Error("Missing rpc parameter");
  }

  if (!options.mint) {
    throw new Error("Missing mint parameter");
  }

  if (!options.amount || options.amount <= 0) {
    throw new Error("Invalid amount parameter");
  }

  if (options.slippage === undefined || options.slippage < 0) {
    throw new Error("Invalid slippage parameter");
  }

  if (!options.seller) {
    throw new Error("Missing seller parameter");
  }

  const connection = new Connection(options.rpc, "confirmed");
  const networkType = getNetworkType(options.rpc);

  try {
    // 根据网络类型选择不同的实现方式
    if (networkType === "mainnet") {
      // mainnet 使用 API 方式
      return await sellTokenWithApi(options, connection);
    } else {
      // local/devnet 使用 SDK 方式
      return await sellTokenWithSdk(options, connection);
    }
  } catch (error) {
    console.error("Sell token error:", error);
    throw new Error(
      `Failed to sell token: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};
