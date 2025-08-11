import { Connection, PublicKey } from "@solana/web3.js";
import {
  CpmmPoolInfoLayout,
  Raydium,
} from "@raydium-io/raydium-sdk-v2";
import { getNetworkType, CONFIGS } from "../config";
import { compareMints, getPoolAddress } from "../utils";
import BN from "bn.js";

export interface DisplayPoolOptions {
  connection: Connection;
  tokenAMint: string;
  tokenBMint: string;
  rpc?: string;
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

export const getPoolInfoByRpc = async (
  connection: Connection,
  raydium: any,
  tokenAMint: string,
  tokenBMint: string,
  rpc: string
): Promise<DisplayPoolResponse | null> => {
  try {
    const networkType = getNetworkType(rpc);
    const config = CONFIGS[networkType];

    const mintA = new PublicKey(tokenAMint);
    const mintB = new PublicKey(tokenBMint);
    const ammConfig = new PublicKey(config.cpSwapConfigAddress);
    const programId = new PublicKey(config.cpSwapProgram);

    const [mint0, mint1] =
      compareMints(mintA, mintB) < 0 ? [mintA, mintB] : [mintB, mintA];
    const [poolAddress] = getPoolAddress(ammConfig, mint0, mint1, programId);

    const poolAccountInfo = await connection.getAccountInfo(poolAddress);
    if (!poolAccountInfo) {
      throw new Error(
        `Pool account does not exist at address ${poolAddress.toBase58()}`
      );
    }
    const cpmmPoolInfo = CpmmPoolInfoLayout.decode(poolAccountInfo!.data);

    const rpcPoolInfos = await raydium.cpmm.getRpcPoolInfos([
      poolAddress.toBase58(),
    ]);

    if (
      !rpcPoolInfos ||
      (Array.isArray(rpcPoolInfos) && rpcPoolInfos.length === 0)
    ) {
      throw new Error(
        `Could not fetch pool info from RPC for address ${poolAddress.toBase58()}`
      );
    }

    const rpcPoolInfo = (
      Array.isArray(rpcPoolInfos) ? rpcPoolInfos[0] : rpcPoolInfos
    )[poolAddress.toBase58()];

    return {
      ...rpcPoolInfo,
      lpMint: cpmmPoolInfo.mintLp,
      poolAddress: poolAddress,
      mintA: mint0,
      mintB: mint1,
      programId,
    };
  } catch (error) {
    console.error("Error getting pool info by RPC:", error);
    return null;
  }
};

export async function displayPool(
  options: DisplayPoolOptions
): Promise<DisplayPoolResponse | null> {
  // Validate inputs
  if (!options.tokenAMint || !options.tokenBMint) {
    throw new Error("Token mints are required");
  }
  const connection = options.connection;
  const networkType = getNetworkType(connection.rpcEndpoint);

  // Initialize Raydium SDK (without wallet for read-only operations)
  const raydium = await Raydium.load({
    connection,
    cluster: networkType as any,
    disableFeatureCheck: true,
  });

  try {
    return await getPoolInfoByRpc(
      connection,
      raydium,
      options.tokenAMint,
      options.tokenBMint,
      connection.rpcEndpoint
    );
  } catch (error) {
    console.error("Error displaying pool info:", error);
    return null;
  }
}
