import { Connection, PublicKey } from "@solana/web3.js";
import {
  CONFIG_DATA_SEED,
  SYSTEM_CONFIG_SEEDS,
} from "./constants";
import {
  cleanTokenName,
  getMetadataByMint,
  initProvider,
  refund,
} from "./utils";
import { CONFIGS, getNetworkType } from "./config";
import { RefundTokenOptions, RefundTokenResponse } from "./types";
import { ApiResponse } from "./raydium/types";

export const refundToken = async (
  options: RefundTokenOptions
): Promise<ApiResponse<RefundTokenResponse>> => {
  try {
    if (!options.rpc) {
      return {
        success: false,
        message: "Missing rpc parameter",
      };
    }

    if (!options.owner) {
      return {
        success: false,
        message: "Missing minter parameter",
      };
    }

    if (!options.mint) {
      return {
        success: false,
        message: "Missing mint parameter",
      };
    }

    const rpc = new Connection(options.rpc);
    const mintAccount = new PublicKey(options.mint);
    const config = CONFIGS[getNetworkType(options.rpc)];
    const owner = options.owner;
    const { program, provider, programId } = await initProvider(rpc, owner);
    const [systemConfigAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(SYSTEM_CONFIG_SEEDS),
        new PublicKey(config.systemManagerAccount).toBuffer(),
      ],
      programId
    );

    const systemConfigData = await program.account.systemConfigData.fetch(
      systemConfigAccount
    );
    const protocolFeeAccount = systemConfigData.protocolFeeAccount;

    const [configAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(CONFIG_DATA_SEED), mintAccount.toBuffer()],
      programId
    );

    const metadataData = await getMetadataByMint(rpc, mintAccount);
    if (!metadataData.success) {
      return {
        success: false,
        message: `Failed to get token metadata: ${metadataData.message}`,
      };
    }

    const _name = cleanTokenName(metadataData.data.name);
    const _symbol = cleanTokenName(metadataData.data.symbol);

    return await refund(
      provider,
      program,
      owner,
      mintAccount,
      { name: _name, symbol: _symbol },
      configAccount,
      systemConfigAccount,
      protocolFeeAccount,
      config.allowOwnerOffCurveForProtocolFeeAccount,
    );
  } catch (error) {
    return {
      success: false,
      message: `Mint operation failed: ${error}`,
    };
  }
};
