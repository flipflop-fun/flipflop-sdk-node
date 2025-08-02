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

export async function mint(options: MintOptions) {
  try {
    const rpc = new Connection(options.rpc || 'https://api.mainnet-beta.solana.com');
    const urc = options.urc;
    const mintAccount = new PublicKey(options.mint);
    const config = CONFIGS[getNetworkType(options.rpc)];

    // Validate required parameters
    if (!options.keypairBs58 && !options.keypairFile) {
      throw new Error('Missing --keypair-bs58 or --keypair-file parameter');
    }
    
    if (!mintAccount) {
      throw new Error('Missing --mint parameter');
    }

    if (!urc) {
      throw new Error('Missing --urc parameter');
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
      throw new Error(`Failed to get token metadata: ${metadataData.message}`);
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
      throw new Error('Mint operation failed');
    }
    
    // Return structured data instead of console output
    return {
      success: true,
      transactionHash: result.tx,
      mint: mintAccount.toBase58(),
      urc: urc,
      owner: minter.publicKey.toBase58(),
      tokenAccount: result.tokenAccount
    };
  } catch (error) {
    throw new Error(`Mint operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
