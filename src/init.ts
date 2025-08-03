import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { loadKeypairFromBase58, checkAccountExists, initProvider, createLookupTable } from './utils'; // Updated import
import { SYSTEM_CONFIG_SEEDS } from './constants';
import { CONFIGS, getNetworkType } from './config';
import { InitSystemConfigOptions, InitSystemConfigResponse } from './types';

// Init function
export const init = async (options: InitSystemConfigOptions): Promise<InitSystemConfigResponse> => {
  if (!options.rpc) {
    throw new Error('Missing --rpc parameter');
  }

  if (!options.keypairBs58) {
    throw new Error('Missing --keypair-bs58 parameter');
  }

  const rpcUrl = options.rpc;
  const rpc = new Connection(rpcUrl, 'confirmed');

  // Use keypair from command line argument
  if (!options.keypairBs58) {
    throw new Error('Missing --keypair-bs58 parameter');
  }
  
  const systemManager = loadKeypairFromBase58(options.keypairBs58);

  const { program, provider, programId } = await initProvider(rpc, systemManager);

  let lookupTableAddress: PublicKey;
  let createdNewLUT = false;
  
  try {
    lookupTableAddress = new PublicKey(CONFIGS[getNetworkType(rpcUrl)].lookupTableAccount || '');
    const accountInfo = await provider.connection.getParsedAccountInfo(lookupTableAddress);
    if (!accountInfo.value) {
      const lut = await createLookupTable(provider.connection, systemManager);
      lookupTableAddress = lut.key;
      createdNewLUT = true;
    }
  } catch (error) {
    const lut = await createLookupTable(provider.connection, systemManager);
    lookupTableAddress = lut.key;
    createdNewLUT = true;
  }

  const [systemConfigAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from(SYSTEM_CONFIG_SEEDS), (new PublicKey(CONFIGS[getNetworkType(rpcUrl)].systemManagerAccount)).toBuffer()],
    programId
  );
  
  // Check if system config exists
  let systemConfigExists = false;
  let existingConfig = null;
  
  if (await checkAccountExists(rpc, systemConfigAccount)) {
    systemConfigExists = true;
    existingConfig = await program.account.systemConfigData.fetch(systemConfigAccount);
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
}