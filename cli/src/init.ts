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

// Init command handler
export async function initCommand(options: any) {
  const rpcUrl = options.rpc;
  const rpc = new Connection(rpcUrl, 'confirmed');

  // Use keypair from command line argument
  if (!options.keypairBs58) {
    console.error('❌ Error: Missing --keypair-bs58 parameter');
    console.log('💡 Usage: flipflop init --keypair-bs58 <your_bs58_keypair>');
    return;
  }
  
  const systemManager = loadKeypairFromBase58(options.keypairBs58);

  const { program, provider, programId } = await initProvider(rpc, systemManager);

  console.log('\n🔍 Checking Address Lookup Table...');
  let lookupTableAddress: PublicKey;
  try {
    lookupTableAddress = new PublicKey(CONFIGS[getNetworkType(rpcUrl)].lookupTableAccount || '');
    const accountInfo = await provider.connection.getParsedAccountInfo(lookupTableAddress);
    if (!accountInfo.value) {
      console.log('⚠️  LUT account does not exist, creating new LUT...');
      const lut = await createLookupTable(provider.connection, systemManager);
      lookupTableAddress = lut.key;
      console.log('\n🎉 New LUT created successfully!');
      console.log(`📋 LUT Address: ${lookupTableAddress.toBase58()}`);
      console.log('\n📝 Next Steps:');
      console.log('   1. Update LOOKUP_TABLE_ACCOUNT in config.ts with this address');
      console.log('   2. Run the init command again to complete system setup');
      process.exit(0);
    } else {
      console.log(`✅ LUT already exists: ${lookupTableAddress.toBase58()}`);
    }
  } catch (error) {
    console.log('⚠️  Invalid LUT address in config, creating new LUT...');
    const lut = await createLookupTable(provider.connection, systemManager);
    lookupTableAddress = lut.key;
    console.log('\n🎉 New LUT created successfully!');
    console.log(`📋 LUT Address: ${lookupTableAddress.toBase58()}`);
    console.log('\n📝 Next Steps:');
    console.log('   1. Update LOOKUP_TABLE_ACCOUNT in config.ts with this address');
    console.log('   2. Run the init command again to complete system setup');
    process.exit(0);
  }

  const [systemConfigAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from(SYSTEM_CONFIG_SEEDS), (new PublicKey(CONFIGS[getNetworkType(rpcUrl)].systemManagerAccount)).toBuffer()],
    programId
  );
  console.log(`📍 System Config PDA: ${systemConfigAccount.toBase58()}`);
  
  // 检查 system config 是否存在
  if (await checkAccountExists(rpc, systemConfigAccount)) {
    console.log('✅ System configuration already exists');
    const infoData = await program.account.systemConfigData.fetch(systemConfigAccount);
    console.log('\n📋 Current System Configuration:');
    console.log('-'.repeat(40));
    Object.entries(infoData).forEach(([key, value]) => {
      console.log(`   ${key}: ${value.toString()}`);
    });
    console.log('\n🎉 System initialization completed - already configured!');
    return;
  }

  console.log('⚙️  Initializing system configuration...');
  const context = {
    admin: systemManager.publicKey,
    systemConfigAccount: systemConfigAccount,
    systemProgram: SystemProgram.programId,
  };

  const tx = await program.methods
    .initializeSystem()
    .accounts(context)
    .signers([systemManager])
    .rpc();

  await provider.connection.confirmTransaction(tx, "confirmed");
  
  console.log('\n🎉 System Initialization Completed Successfully!');
  console.log('=' .repeat(50));
  console.log(`📋 Transaction Hash: ${tx}`);
  console.log(`📍 System Config Account: ${systemConfigAccount.toBase58()}`);
  console.log(`👤 System Manager: ${systemManager.publicKey.toBase58()}`);
  console.log('\n✨ Your FlipFlop system is now ready for token operations!');
}