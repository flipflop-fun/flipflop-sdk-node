import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { initProvider, loadKeypairFromBase58, loadKeypairFromFile, parseConfigData } from './utils';
import { MINT_SEED, CONFIG_DATA_SEED, SYSTEM_CONFIG_SEEDS, METADATA_SEED, TOKEN_METADATA_PROGRAM_ID, TOKEN_PARAMS } from './constants';
import { getAssociatedTokenAddress, NATIVE_MINT, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { CONFIGS, getNetworkType } from './config';

// Token metadata interface
interface TokenMetadata {
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
}

interface LaunchOptions {
  tokenType?: string;
  name: string;
  symbol: string;
  uri?: string;
  rpc?: string;
  keypairBs58?: string;
  keypairFile?: string;
}

// Launch token command handler
export async function launchCommand(options: LaunchOptions) {
  const rpcUrl = options.rpc || 'https://api.mainnet-beta.solana.com';
  const type = options.tokenType;
  const rpc = new Connection(rpcUrl, 'confirmed');
  const config = CONFIGS[getNetworkType(rpcUrl)];

  // Validate required parameters
  if (!options.keypairBs58 && !options.keypairFile) {
    console.error('❌ Error: Missing --keypair-bs58 or --keypair-file parameter');
    return;
  }

  if (!options.name || !options.symbol) {
    console.error('❌ Error: Missing --name or --symbol parameter');
    return;
  }

  try {
    // Load keypair and create wallet (keypair-file takes priority)
    const creator = options.keypairFile 
      ? loadKeypairFromFile(options.keypairFile)
      : loadKeypairFromBase58(options.keypairBs58!);

    const { program, provider, programId } = await initProvider(rpc, creator);

    // Token parameters
    const tokenName = options.name;
    const tokenSymbol = options.symbol;
    const tokenUri = options.uri || `https://example.com/metadata/${tokenSymbol.toLowerCase()}.json`;

    const initConfigData: any = TOKEN_PARAMS[type as keyof typeof TOKEN_PARAMS];

    // Token metadata
    const metadata: TokenMetadata = {
      name: tokenName,
      symbol: tokenSymbol,
      uri: tokenUri,
      decimals: 9,
    };

    const [systemConfigAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(SYSTEM_CONFIG_SEEDS), new PublicKey(config.systemManagerAccount).toBuffer()],
      programId
    );

    const systemConfigData = await program.account.systemConfigData.fetch(systemConfigAccount);
    const protocolFeeAccount = systemConfigData.protocolFeeAccount;
    const [mintAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(MINT_SEED), Buffer.from(metadata.name), Buffer.from(metadata.symbol.toLowerCase())],
      programId
    );
    
    const [configAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(CONFIG_DATA_SEED), mintAccount.toBuffer()],
      programId,
    );

    // Create medatata PDA
    const [metadataAccountPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(METADATA_SEED),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintAccount.toBuffer()
      ],
      TOKEN_METADATA_PROGRAM_ID,
    );

    const info = await provider.connection.getAccountInfo(mintAccount);
    if (info) {
      console.log('\n⚠️  Token Already Exists');
      console.log('━'.repeat(50));
      console.log(`Mint Address: ${mintAccount.toBase58()}`);
      return;
    }

    console.log('\n🚀 Creating New Token');
    console.log('━'.repeat(50));
    console.log(`Name: ${metadata.name}`);
    console.log(`Symbol: ${metadata.symbol}`);
    console.log(`URI: ${metadata.uri}`);
    console.log(`Decimals: ${metadata.decimals}`);

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
    };

    const instructionInitializeToken = await program.methods
      .initializeToken(metadata, initConfigData)
      .accounts(contextInitializeToken)
      .instruction();

    const transaction = new Transaction()
      .add(instructionInitializeToken);

    const tx = await provider.sendAndConfirm(transaction, [creator]);
    
    console.log('\n✅ Token Created Successfully!');
    console.log('━'.repeat(50));
    console.log(`Transaction Hash: ${tx}`);
    console.log(`Mint Address: ${mintAccount.toBase58()}`);
    console.log(`Config Address: ${configAccount.toBase58()}`);
    
    const configData = await parseConfigData(program, configAccount);
    if (configData) {
      console.log('\n⚙️  Token Configuration');
      console.log('━'.repeat(50));
      console.log(`Admin: ${configData.admin}`);
      console.log(`Fee Rate: ${(configData.feeRate * 1).toFixed(2)} SOL`);
      console.log(`Max Supply: ${configData.maxSupply.toLocaleString()}`);
      console.log(`Initial Mint Size: ${configData.initialMintSize.toLocaleString()}`);
      console.log(`Target Eras: ${configData.targetEras}`);
      console.log(`Epochs Per Era: ${configData.epochesPerEra}`);
      console.log(`Token Vault: ${configData.tokenVault}`);
    }
    
  } catch (error) {
    console.error('❌ Error creating token:', error instanceof Error ? error.message : 'Unknown error');
  }
}
