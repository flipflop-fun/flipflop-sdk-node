import { AddressLookupTableAccount, AddressLookupTableProgram, Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { loadKeypairFromBase58, checkAccountExists, initProvider } from './utils'; // Updated import
import { RENT_PROGRAM_ID, SYSTEM_CONFIG_SEEDS } from './constants';
import { NATIVE_MINT, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { ASSOCIATED_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/utils/token';
import sleep from 'sleep-promise';
import { SYSTEM_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/native/system';
import { CONFIGS, getNetworkType } from './config';

const createAddressLookupTable = async (
  connection: Connection,
  payer: Keypair,
  addresses: PublicKey[]
) => {
  const slot = await connection.getSlot("finalized"); // not "confirmed"
  
  // Create instruction for Address Lookup Table
  const [createIx, lutAddress] = AddressLookupTableProgram.createLookupTable({
    authority: payer.publicKey,
    payer: payer.publicKey,
    recentSlot: slot,
  });

  // Create instruction to extend Address Lookup Table
  const extendIx = AddressLookupTableProgram.extendLookupTable({
    payer: payer.publicKey,
    authority: payer.publicKey,
    lookupTable: lutAddress,
    addresses,
  });
  
  // Create and send transaction
  const tx = new Transaction()
    .add(createIx)
    .add(extendIx);

  tx.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
  tx.feePayer = payer.publicKey;
  
  await sendAndConfirmTransaction(connection, tx, [payer]);

  // Wait for confirmation and fetch the table
  await sleep(1000);
  const accountInfo = await connection.getAccountInfo(lutAddress);
  return new AddressLookupTableAccount({
    key: lutAddress,
    state: AddressLookupTableAccount.deserialize(accountInfo!.data),
  });
}

const createLookupTable = async (
  connection: Connection,
  payer: Keypair,
) => {
  const rpc = connection.rpcEndpoint;
  const network = getNetworkType(rpc);
  const addresses: PublicKey[] = [
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
    SYSTEM_PROGRAM_ID,
    RENT_PROGRAM_ID,
    ASSOCIATED_PROGRAM_ID,
    NATIVE_MINT,
    new PublicKey(CONFIGS[network].cpSwapProgram),
    new PublicKey(CONFIGS[network].cpSwapConfigAddress),
    new PublicKey(CONFIGS[network].createPoolFeeReceive),
  ];

  // 2. Create LUT
  const lookupTable = await createAddressLookupTable(connection, payer, addresses);
  
  // 3. Wait for LUT activation (must wait at least 1 slot)
  await sleep(1000);
  
  return lookupTable;
}

// Init function
export async function init(options: any) {
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
    lookupTableAddress: lookupTableAddress.toBase58(),
    systemConfigAddress: systemConfigAccount.toBase58(),
    systemManager: systemManager.publicKey.toBase58(),
    createdNewLUT,
    systemConfigExists,
    initializationTx,
    configuration: existingConfig
  };
}