import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { cleanTokenName, getMetadataByMint, initProvider } from "./utils";
import {
  CODE_ACCOUNT_SEED,
  CONFIG_DATA_SEED,
  REFERRAL_CODE_SEED,
  REFERRAL_SEED,
  SYSTEM_CONFIG_SEEDS,
} from "./constants";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { CONFIGS, getNetworkType } from "./config";
import { SetUrcOptions, SetUrcResponse } from "./types";

export const setUrc = async (
  options: SetUrcOptions
): Promise<SetUrcResponse> => {
  // Validate required parameters
  if (!options.rpc) {
    throw new Error("Missing rpc parameter");
  }

  if (!options.urc) {
    throw new Error("Missing urc parameter");
  }

  if (!options.mint) {
    throw new Error("Missing mint parameter");
  }

  if (!options.refAccount) {
    throw new Error("Missing ref-account parameter");
  }

  const rpc = new Connection(options.rpc, "confirmed");
  const urc = options.urc;
  const mintAccount = new PublicKey(options.mint);

  try {
    // Load keypair and create wallet (keypair-file takes priority)
    const refAccount = options.refAccount;

    const { program, provider, programId } = await initProvider(
      rpc,
      refAccount
    );

    const [referralAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(REFERRAL_SEED),
        mintAccount.toBuffer(),
        refAccount.publicKey.toBuffer(),
      ],
      programId
    );

    const [systemConfigAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(SYSTEM_CONFIG_SEEDS),
        new PublicKey(
          CONFIGS[getNetworkType(options.rpc)].systemManagerAccount
        ).toBuffer(),
      ],
      programId
    );

    const [codeHash] = PublicKey.findProgramAddressSync(
      [Buffer.from(REFERRAL_CODE_SEED), Buffer.from(urc)],
      programId
    );

    const [codeAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(CODE_ACCOUNT_SEED), codeHash.toBuffer()],
      programId
    );

    const [configAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(CONFIG_DATA_SEED), mintAccount.toBuffer()],
      programId
    );

    const codeAccountInfo = await provider.connection.getAccountInfo(
      codeAccount
    );
    if (codeAccountInfo) {
      const codeAccountData = await program.account.codeAccountData.fetch(
        codeAccount
      );
      if (
        codeAccountData.referralAccount.toBase58() !==
        referralAccount.toBase58()
      ) {
        throw new Error(
          "❌ Error: Referral code is already assigned to another account"
        );
      }
    }

    const referrerAta = await getAssociatedTokenAddress(
      mintAccount,
      refAccount.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );
    const referrerAtaInfo = await provider.connection.getAccountInfo(
      referrerAta
    );

    const context = {
      mint: mintAccount,
      referralAccount: referralAccount,
      configAccount,
      systemConfigAccount: systemConfigAccount,
      payer: refAccount.publicKey,
      referrerAta: referrerAta,
      codeAccount: codeAccount,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    };
    const tokenMetadata = await getMetadataByMint(rpc, mintAccount);
    if (!tokenMetadata.success) {
      throw new Error(`Failed to get token metadata: ${tokenMetadata.message}`);
    }

    const _name = cleanTokenName(tokenMetadata.data.name);
    const _symbol = cleanTokenName(tokenMetadata.data.symbol);
    const instructionSetReferrerCode = await program.methods
      .setReferrerCode(_name, _symbol, codeHash.toBuffer())
      .accounts(context)
      .instruction();

    const transaction = new Transaction();
    if (!referrerAtaInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          refAccount.publicKey,
          referrerAta,
          refAccount.publicKey,
          mintAccount,
          TOKEN_PROGRAM_ID
        )
      );
    }

    transaction.add(instructionSetReferrerCode);
    const tx = await provider.sendAndConfirm(transaction, [refAccount]);

    const data = await program.account.tokenReferralData.fetch(referralAccount);

    // Return structured data instead of console output
    return {
      transactionHash: tx,
      urc: urc,
      mint: mintAccount,
      referrer: refAccount.publicKey,
      referrerTokenAccount: data.referrerAta,
      codeHash: data.codeHash,
      usageCount: data.usageCount,
      activatedAt: data.activeTimestamp.toNumber(),
    };
  } catch (error) {
    throw new Error(
      `Failed to set URC: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};
