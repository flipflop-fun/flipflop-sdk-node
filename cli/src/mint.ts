import { Connection, PublicKey } from '@solana/web3.js';
import { CONFIG_DATA_SEED, REFERRAL_SEED, SYSTEM_CONFIG_SEEDS, REFERRAL_CODE_SEED } from './constants';
import { cleanTokenName, getMetadataByMint, getURCDetails, initProvider, loadKeypairFromBase58, loadKeypairFromFile, mintBy } from './utils';
import { CONFIGS, getNetworkType } from './config';

interface MintOptions {
  rpc: string;
  keypairBs58?: string;
  keypairFile?: string;
  mint: string;
  urc: string;
}

export async function mintCommand(options: MintOptions) {
  try {
    const rpc = new Connection(options.rpc || 'https://api.mainnet-beta.solana.com');
    const urc = options.urc;
    const mintAccount = new PublicKey(options.mint);
    const config = CONFIGS[getNetworkType(options.rpc)];

    // Validate required parameters
    if (!options.keypairBs58 && !options.keypairFile) {
      console.error('Error: Missing --keypair-bs58 or --keypair-file parameter');
      return;
    }
    
    if (!mintAccount) {
      console.error('Error: Missing --mint parameter');
      return;
    }

    if (!urc) {
      console.error('Error: Missing --urc parameter');
      return;
    }
    
    // Load keypair and create wallet (keypair-file takes priority)
    const minter = options.keypairFile 
      ? loadKeypairFromFile(options.keypairFile)
      : loadKeypairFromBase58(options.keypairBs58!);

    const { program, provider, programId } = await initProvider(rpc, minter);

    console.log('Processing mint request...');

    const referrerAccount = await getURCDetails(rpc, program, urc);
    const [referralAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(REFERRAL_SEED), mintAccount.toBuffer(), referrerAccount.referrerMain.toBuffer()],
      programId,
    );

    const [systemConfigAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(SYSTEM_CONFIG_SEEDS), new PublicKey(config.systemManagerAccount).toBuffer()],
      programId
    );

    const systemConfigData = await program.account.systemConfigData.fetch(systemConfigAccount);
    const protocolFeeAccount = systemConfigData.protocolFeeAccount;

    const [configAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(CONFIG_DATA_SEED), mintAccount.toBuffer()],
      programId,
    );

    const [codeHash] = PublicKey.findProgramAddressSync(
      [Buffer.from(REFERRAL_CODE_SEED), Buffer.from(urc)],
      programId,
    );

    const metadataData = await getMetadataByMint(rpc, mintAccount);
    if (!metadataData.success) {
      console.error('Error: Failed to get token metadata -', metadataData.message);
      return;
    }
    
    const _name = cleanTokenName(metadataData.data.name);
    const _symbol = cleanTokenName(metadataData.data.symbol);

    const result = await mintBy(
      provider,
      program,
      mintAccount,
      configAccount,
      referralAccount,
      referrerAccount.referrerMain, // referrer
      {name: _name, symbol: _symbol},
      codeHash,
      minter, // minter
      systemConfigAccount,
      provider.connection,
      new PublicKey(config.lookupTableAccount),
      protocolFeeAccount
    );
    
    if(!result?.success) {
      console.error('Error: Mint operation failed');
      return;
    }
    
    console.log('Tokens minted successfully!');
    
    if (result.tx) {
      console.log('Mint operation details:');
      console.log("=".repeat(40));
      console.log(`Mint: ${mintAccount}`);
      console.log(`URC: ${urc}`);
      console.log(`Owner: ${minter.publicKey.toBase58()}`)
      console.log(`Token Account: ${result.tokenAccount}`)
      console.log(`Transaction Hash: ${result.tx}`);
      console.log('')
      console.log(`Check your token balance by:\n> spl-token balance ${mintAccount} --owner ${minter.publicKey.toBase58()}`)
      console.log("=".repeat(40));
    }
  } catch (error) {
    console.error('Error: Mint operation failed -', error);
    process.exit(1);
  }
}
