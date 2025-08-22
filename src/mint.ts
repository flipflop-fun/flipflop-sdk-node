import { Connection, PublicKey } from "@solana/web3.js";
import {
  CONFIG_DATA_SEED,
  REFERRAL_SEED,
  SYSTEM_CONFIG_SEEDS,
  REFERRAL_CODE_SEED,
} from "./constants";
import {
  cleanTokenName,
  getMetadataByMint,
  getURCDetails,
  initProvider,
  mintBy,
} from "./utils";
import { CONFIGS, getNetworkType } from "./config";
import { MintTokenOptions, MintTokenResponse } from "./types";
import { ApiResponse } from "./raydium/types";

export const mintToken = async (
  options: MintTokenOptions
): Promise<ApiResponse<MintTokenResponse>> => {
  try {
    if (!options.rpc) {
      return {
        success: false,
        message: "Missing rpc parameter",
      };
    }

    if (!options.minter) {
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

    if (!options.urc) {
      return {
        success: false,
        message: "Missing urc parameter",
      };
    }

    const rpc = new Connection(options.rpc);
    const urc = options.urc;
    const mintAccount = new PublicKey(options.mint);
    const config = CONFIGS[getNetworkType(options.rpc)];

    // Load keypair and create wallet (keypair-file takes priority)
    const minter = options.minter;

    const { program, provider, programId } = await initProvider(rpc, minter);

    const referrerAccount = await getURCDetails(rpc, program, urc);
    const [referralAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(REFERRAL_SEED),
        mintAccount.toBuffer(),
        referrerAccount.referrerMain.toBuffer(),
      ],
      programId
    );

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

    const [codeHash] = PublicKey.findProgramAddressSync(
      [Buffer.from(REFERRAL_CODE_SEED), Buffer.from(urc)],
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

    return await mintBy(
      provider,
      program,
      mintAccount,
      configAccount,
      referralAccount,
      referrerAccount.referrerMain, // referrer
      { name: _name, symbol: _symbol },
      codeHash,
      minter, // minter
      systemConfigAccount,
      provider.connection,
      options.lookupTableAccount
        ? options.lookupTableAccount
        : new PublicKey(config.lookupTableAccount),
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
