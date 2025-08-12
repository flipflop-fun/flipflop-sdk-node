import { Connection, PublicKey } from "@solana/web3.js";
import { CpmmPoolInfoLayout, Raydium } from "@raydium-io/raydium-sdk-v2";
import { getNetworkType, CONFIGS } from "../config";
import { compareMints, getPoolAddress } from "../utils";
import { ApiResponse, DisplayPoolOptions, DisplayPoolResponse } from "./types";

export const getPoolInfoByRpc = async (
  connection: Connection,
  raydium: any,
  tokenAMint: PublicKey,
  tokenBMint: PublicKey,
  rpc: string
): Promise<ApiResponse<DisplayPoolResponse> | null> => {
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
      return {
        success: false,
        message: `Pool account does not exist at address ${poolAddress.toBase58()}`,
      };
    }
    const cpmmPoolInfo = CpmmPoolInfoLayout.decode(poolAccountInfo!.data);

    const rpcPoolInfos = await raydium.cpmm.getRpcPoolInfos([
      poolAddress.toBase58(),
    ]);

    if (
      !rpcPoolInfos ||
      (Array.isArray(rpcPoolInfos) && rpcPoolInfos.length === 0)
    ) {
      return {
        success: false,
        message: `Could not fetch pool info from RPC for address ${poolAddress.toBase58()}`,
      };
    }

    const rpcPoolInfo = (
      Array.isArray(rpcPoolInfos) ? rpcPoolInfos[0] : rpcPoolInfos
    )[poolAddress.toBase58()];

    return {
      success: true,
      data: {
        ...rpcPoolInfo,
        lpMint: cpmmPoolInfo.mintLp,
        poolAddress: poolAddress,
        mintA: mint0,
        mintB: mint1,
        programId,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Error getting pool info by RPC: ${(error as any).message}`,
    };
  }
};

export async function displayPool(
  options: DisplayPoolOptions
): Promise<ApiResponse<DisplayPoolResponse> | null> {
  // Validate inputs
  if (!options.tokenAMint || !options.tokenBMint) {
    return {
      success: false,
      message: "Token mints are required",
    };
  }
  const connection = options.connection;
  const networkType = getNetworkType(connection.rpcEndpoint);

  // Initialize Raydium SDK (without wallet for read-only operations)
  const raydium = await Raydium.load({
    connection,
    cluster: networkType as any,
    disableFeatureCheck: true,
    disableLoadToken: true,
  });

  try {
    const result = await getPoolInfoByRpc(
      connection,
      raydium,
      options.tokenAMint,
      options.tokenBMint,
      connection.rpcEndpoint
    );
    console.log(result?.success, result?.message);
    return result;
  } catch (error) {
    return {
      success: false,
      message: `Error displaying pool info: ${(error as any).message}`,
    };
  }
}
