import { ComputeBudgetProgram, Connection, PublicKey, Transaction } from "@solana/web3.js";
import { initProvider, parseConfigData } from "./utils";
import {
  MINT_SEED,
  CONFIG_DATA_SEED,
  SYSTEM_CONFIG_SEEDS,
  METADATA_SEED,
  TOKEN_METADATA_PROGRAM_ID,
  TOKEN_PARAMS,
  LAUNCH_RULE_SEEDS,
  URC_THROTTLE_SEEDS,
} from "./constants";
import {
  getAssociatedTokenAddress,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { CONFIGS, getNetworkType } from "./config";
import {
  ConfigAccountData,
  LaunchTokenOptions,
  LaunchTokenResponse,
  TokenMetadata,
} from "./types";
import { ApiResponse } from "./raydium/types";

// Launch token function
export const launchToken = async (
  options: LaunchTokenOptions
): Promise<ApiResponse<LaunchTokenResponse>> => {
  // Validate required parameters
  if (!options.rpc) {
    return {
      success: false,
      message: "Missing rpc parameter",
    };
  }

  if (!options.tokenType) {
    return {
      success: false,
      message: "Missing token-type parameter",
    };
  }

  if (!options.creator) {
    return {
      success: false,
      message: "Missing creator parameter",
    };
  }

  if (!options.name || !options.symbol) {
    return {
      success: false,
      message: "Missing name or symbol parameter",
    };
  }

  const type = options.tokenType;
  const rpc = new Connection(options.rpc, "confirmed");
  const config = CONFIGS[getNetworkType(options.rpc)];

  try {
    // Load keypair and create wallet (keypair-file takes priority)
    const creator = options.creator;

    const { program, provider, programId } = await initProvider(rpc, creator);

    // Token parameters
    const tokenName = options.name;
    const tokenSymbol = options.symbol;
    const tokenUri =
      options.uri ||
      `https://example.com/metadata/${tokenSymbol.toLowerCase()}.json`;

    const initConfigData: any = TOKEN_PARAMS[type as keyof typeof TOKEN_PARAMS];

    // Token metadata
    const metadata: TokenMetadata = {
      name: tokenName,
      symbol: tokenSymbol,
      uri: tokenUri,
      decimals: 9,
    };

    const [launchRuleAccountPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(LAUNCH_RULE_SEEDS),
        new PublicKey(config.systemManagerAccount).toBuffer(),
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
    const [mintAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(MINT_SEED),
        Buffer.from(metadata.name),
        Buffer.from(metadata.symbol.toLowerCase()),
      ],
      programId
    );

    const [configAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(CONFIG_DATA_SEED), mintAccount.toBuffer()],
      programId
    );

    // Create medatata PDA
    const [metadataAccountPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(METADATA_SEED),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintAccount.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const [referrerThrottle] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(URC_THROTTLE_SEEDS),
        mintAccount.toBuffer(),
      ],
      programId
    );

    const info = await provider.connection.getAccountInfo(mintAccount);
    if (info) {
      return {
        success: false,
        message: `Token already exists: ${mintAccount.toBase58()}`,
      };
    }

    const mintTokenVaultAta = await getAssociatedTokenAddress(
      mintAccount,
      mintAccount,
      true,
      TOKEN_PROGRAM_ID
    );

    const tokenVaultAta = await getAssociatedTokenAddress(
      mintAccount,
      configAccount,
      true,
      TOKEN_PROGRAM_ID
    );

    const wsolVaultAta = await getAssociatedTokenAddress(
      NATIVE_MINT,
      configAccount,
      true,
      TOKEN_PROGRAM_ID
    );

    const contextInitializeToken = {
      metadata: metadataAccountPda,
      payer: creator.publicKey,
      mint: mintAccount,
      configAccount,
      mintTokenVault: mintTokenVaultAta,
      tokenVault: tokenVaultAta,
      wsolMint: NATIVE_MINT,
      wsolVault: wsolVaultAta,
      systemConfigAccount: systemConfigAccount,
      protocolFeeAccount: protocolFeeAccount,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      launchRuleAccount: launchRuleAccountPda,
      referrerThrottle,
    };

    const ix0 = ComputeBudgetProgram.setComputeUnitLimit({ units: 500000 });
    const instructionInitializeToken = await program.methods
      .initializeToken(metadata, initConfigData)
      .accounts(contextInitializeToken)
      .instruction();

    const transaction = new Transaction().add(ix0).add(instructionInitializeToken);

    const tx = await provider.sendAndConfirm(transaction, [creator]);

    const configData: ConfigAccountData = await parseConfigData(
      program,
      configAccount
    );

    // Return structured data instead of console output
    return {
      success: true,
      data: {
        transactionHash: tx,
        mintAddress: mintAccount,
        configAddress: configAccount,
        metadata: metadata,
        configuration: configData,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to launch token: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
};
