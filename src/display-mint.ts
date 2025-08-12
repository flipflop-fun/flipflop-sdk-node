import { Connection, PublicKey } from "@solana/web3.js";
import {
  getMetadataByMint,
  getTokenBalance,
  initProviderNoSigner,
  parseConfigData,
} from "./utils";
import { CONFIG_DATA_SEED } from "./constants";
import { GetMintDataOptions, GetMintDataResponse } from "./types";
import { ApiResponse } from "./raydium/types";

// Get mint information function
export const getMintData = async (
  options: GetMintDataOptions
): Promise<ApiResponse<GetMintDataResponse>> => {
  // Validate required parameters
  if (!options.rpc) {
    return {
      success: false,
      message: "Missing --rpc parameter",
    };
  }

  if (!options.mint) {
    return {
      success: false,
      message: "Missing --mint parameter",
    };
  }

  const rpc = new Connection(options.rpc, "confirmed");
  const mintAccount = new PublicKey(options.mint);

  const { program, programId } = await initProviderNoSigner(rpc);

  try {
    // Get token metadata
    const metadataData = await getMetadataByMint(rpc, mintAccount);
    if (!metadataData.success) {
      return {
        success: false,
        message: `❌ Failed to get token metadata: ${metadataData.message}`,
      };
    }

    // Get config account details
    const [configAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(CONFIG_DATA_SEED), new PublicKey(mintAccount).toBuffer()],
      new PublicKey(programId)
    );

    const configAccountInfo = await parseConfigData(program, configAccount);
    if (!configAccountInfo) {
      return {
        success: false,
        message: "❌ Failed to get config account data",
      };
    }

    // Return structured data instead of console output
    const cleanName = metadataData.data.name.replace(/\x00/g, "").trim();
    const cleanSymbol = metadataData.data.symbol.replace(/\x00/g, "").trim();
    const cleanUri = metadataData.data.uri.replace(/\x00/g, "").trim();
    const liquidityTokensRatio = configAccountInfo.liquidityTokensRatio;

    return {
      success: true,
      data: {
        mint: new PublicKey(metadataData.mint),
        name: cleanName,
        symbol: cleanSymbol,
        uri: cleanUri,
        isMutable: metadataData.isMutable,
        configAccount: configAccount,
        admin: configAccountInfo.admin,
        tokenVault: configAccountInfo.tokenVault,
        wsolVault: configAccountInfo.wsolVault,
        tokenVaultBalance: await getTokenBalance(
          configAccountInfo.tokenVault,
          program.provider.connection
        ),
        wsolVaultBalance: await getTokenBalance(
          configAccountInfo.wsolVault,
          program.provider.connection
        ),
        feeRate: configAccountInfo.feeRate * 1,
        targetEras: configAccountInfo.targetEras,
        supply: configAccountInfo.supply,
        initialMintSize: configAccountInfo.initialMintSize,
        epochesPerEra: configAccountInfo.epochesPerEra,
        targetSecondsPerEpoch: configAccountInfo.targetSecondsPerEpoch,
        reduceRatio: (100 - configAccountInfo.reduceRatio * 100) / 100,
        maxSupply: configAccountInfo.maxSupply,
        liquidityTokensRatio: configAccountInfo.liquidityTokensRatio * 100,
        currentSupply: configAccountInfo.supply,
        liquidityTokensSupply: configAccountInfo.supply * liquidityTokensRatio,
        minterTokensSupply:
          configAccountInfo.supply * (1 - liquidityTokensRatio),
        currentEra: configAccountInfo.currentEra,
        currentEpoch: configAccountInfo.currentEpoch,
        startTimestampEpoch: configAccountInfo.startTimestampEpoch,
        elapsedSecondsEpoch: configAccountInfo.elapsedSecondsEpoch,
        lastDifficultyCoefficient: configAccountInfo.lastDifficultyCoefficient,
        difficultyCoefficient: configAccountInfo.difficultyCoefficient,
        mintSizeEpoch: configAccountInfo.mintSizeEpoch,
        quantityMintedEpoch: configAccountInfo.quantityMintedEpoch,
        targetMintSizeEpoch: configAccountInfo.targetMintSizeEpoch,
        progress: (
          (configAccountInfo.supply / configAccountInfo.maxSupply) *
          100
        ).toFixed(2),
      } as GetMintDataResponse,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get mint info: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
};
