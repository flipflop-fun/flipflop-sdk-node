import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { checkAccountExists, initProvider, createLookupTable } from "./utils";
import { LAUNCH_RULE_SEEDS, SYSTEM_CONFIG_SEEDS } from "./constants";
import { CONFIGS, getNetworkType } from "./config";
import { InitSystemConfigOptions, InitSystemConfigResponse } from "./types";
import { BN } from "@coral-xyz/anchor";

// Init function
export const initializeSystemConfigAccount = async (
  options: InitSystemConfigOptions
): Promise<InitSystemConfigResponse> => {
  if (!options.rpc) {
    throw new Error("Missing rpc parameter");
  }

  if (!options.systemManager) {
    throw new Error("Missing system-manager parameter");
  }

  const rpcUrl = options.rpc;
  const rpc = new Connection(rpcUrl, "confirmed");
  const systemManager = options.systemManager;

  const { program, provider, programId } = await initProvider(
    rpc,
    systemManager
  );

  let lookupTableAddress: PublicKey;
  let createdNewLUT = false;

  try {
    lookupTableAddress = new PublicKey(
      CONFIGS[getNetworkType(rpcUrl)].lookupTableAccount || ""
    );
    const accountInfo = await provider.connection.getParsedAccountInfo(
      lookupTableAddress
    );
    if (!accountInfo.value) {
      console.log("⚠️  LUT account does not exist, creating new LUT...");
      const lut = await createLookupTable(provider.connection, systemManager);
      lookupTableAddress = lut.key;
      console.log("\n🎉 New LUT created successfully!");
      console.log(`📋 LUT Address: ${lookupTableAddress.toBase58()}`);
      console.log("\n📝 Next Steps:");
      console.log(
        "   1. Update LOOKUP_TABLE_ACCOUNT in config.ts with this address"
      );
      console.log("   2. Run the init command again to complete system setup");
      process.exit(0);
    }
  } catch (error) {
    console.log("⚠️  Invalid LUT address in config, creating new LUT...");
    const lut = await createLookupTable(provider.connection, systemManager);
    lookupTableAddress = lut.key;
    console.log("\n🎉 New LUT created successfully!");
    console.log(`📋 LUT Address: ${lookupTableAddress.toBase58()}`);
    console.log("\n📝 Next Steps:");
    console.log(
      "   1. Update LOOKUP_TABLE_ACCOUNT in config.ts with this address"
    );
    console.log("   2. Run the init command again to complete system setup");
    process.exit(0);
  }

  const [systemConfigAccount] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(SYSTEM_CONFIG_SEEDS),
      new PublicKey(
        CONFIGS[getNetworkType(rpcUrl)].systemManagerAccount
      ).toBuffer(),
    ],
    programId
  );

  // Check if system config exists
  let systemConfigExists = false;
  let existingConfig = null;

  if (await checkAccountExists(rpc, systemConfigAccount)) {
    systemConfigExists = true;
    existingConfig = await program.account.systemConfigData.fetch(
      systemConfigAccount
    );
  }

  let initializationTx = null;
  if (!systemConfigExists) {
    const context = {
      admin: systemManager.publicKey,
      systemConfigAccount: systemConfigAccount,
      systemProgram: SystemProgram.programId,
    };

    initializationTx = await program.methods
      .initializeSystem()
      .accounts(context)
      .signers([systemManager])
      .rpc();

    await provider.connection.confirmTransaction(initializationTx, "confirmed");
  }

  // Initialize Launch Rule Account
  const launchRuleAccount = PublicKey.findProgramAddressSync(
    [Buffer.from(LAUNCH_RULE_SEEDS), systemManager.publicKey.toBuffer()],
    program.programId
  )[0];
  console.log("Launch rule account: ", launchRuleAccount.toBase58());
  const info = await provider.connection.getAccountInfo(launchRuleAccount);
  if (info) {
    console.log(
      "Launch rule account was created, launch rule address: " +
        launchRuleAccount.toBase58()
    );
    const launchRuleData = await program.account.launchRuleData.fetch(
      launchRuleAccount
    );
    console.log(
      "Launch rule data",
      Object.fromEntries(
        Object.entries(launchRuleData).map(([key, value]) => [
          key,
          value.toString(),
        ])
      )
    );
  }
  const context2 = {
    admin: systemManager.publicKey,
    launchRuleData: launchRuleAccount,
    systemProgram: SystemProgram.programId,
  };

  const tx = await program.methods
    .initializeLaunchRule(
      // ###### Update the start_slot and slots_per_period for different network
      new BN("0"), // start_slot
      new BN("10"), // slots_per_period
      new BN("3"), // base_launch_limit
      new BN("4"), // increasement_launch_limit
      new BN("12") // max_period
    )
    .accounts(context2)
    .signers([systemManager])
    .rpc();

  await provider.connection.confirmTransaction(tx, "confirmed");
  console.log("Initialize LaunchRule tx: ", tx);

  // Return structured data
  return {
    success: true,
    lookupTableAddress: lookupTableAddress,
    systemConfigAddress: systemConfigAccount,
    systemManager: systemManager.publicKey,
    createdNewLUT,
    // systemConfigExists,
    // initializationTx,
    // configuration: existingConfig
  };
};
