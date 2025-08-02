import { Connection, PublicKey } from '@solana/web3.js';
import { getMetadataByMint, initProviderNoSigner, parseConfigData } from './utils';
import { CONFIG_DATA_SEED } from './constants';

// Display mint command handler
export async function displayMintCommand(options: any) {
  const rpcUrl = options.rpc;
  const mintAccount = new PublicKey(options.mint);
  const rpc = new Connection(rpcUrl, 'confirmed');

  const { program, programId } = await initProviderNoSigner(rpc);

  try {
    // Get token metadata
    const metadataData = await getMetadataByMint(rpc, mintAccount);
    if (!metadataData.success) {
      console.error(`❌ Failed to get token metadata: ${metadataData.message}`);
      return;
    }

    // Get config account details
    const [configAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(CONFIG_DATA_SEED), new PublicKey(mintAccount).toBuffer()],
      new PublicKey(programId),
    );

    const configAccountInfo = await parseConfigData(program, configAccount);
    if (!configAccountInfo) {
      console.error('❌ Failed to get config account data');
      return;
    }

    // Display formatted token information
    console.log('\n📊 Token Information');
    console.log('━'.repeat(50));
    
    // Clean and display metadata
    const cleanName = metadataData.data.name.replace(/\x00/g, '').trim();
    const cleanSymbol = metadataData.data.symbol.replace(/\x00/g, '').trim();
    const cleanUri = metadataData.data.uri.replace(/\x00/g, '').trim();
    
    console.log(`Mint Address: ${metadataData.mint}`);
    console.log(`Name: ${cleanName}`);
    console.log(`Symbol: ${cleanSymbol}`);
    console.log(`Metadata URI: ${cleanUri}`);
    console.log(`Metadata Mutable: ${metadataData.isMutable ? 'Yes' : 'No'}`);

    console.log('\n⚙️  Configuration Details');
    console.log('━'.repeat(50));
    console.log(`Config Account: ${configAccount.toBase58()}`);
    console.log(`Admin: ${configAccountInfo.admin}`);
    console.log(`Token Vault: ${configAccountInfo.tokenVault}`);
    console.log('');
    console.log(`Fee Rate: ${(configAccountInfo.feeRate * 1).toFixed(2)} SOL`);
    console.log(`Target Eras: ${configAccountInfo.targetEras}`);
    console.log(`Initial Mint Size: ${configAccountInfo.initialMintSize}`);
    console.log(`Checkpoints per Milestone: ${configAccountInfo.epochesPerEra}`);
    console.log(`Target Seconds per Checkpoint: ${configAccountInfo.targetSecondsPerEpoch}`);
    console.log(`Reduce Ratio per Milestone: ${100 - parseFloat(configAccountInfo.reduceRatio) * 100}%`);
    console.log(`Max Supply: ${configAccountInfo.maxSupply.toLocaleString()}`);
    console.log(`liquidity Tokens Ratio: ${configAccountInfo.liquidityTokensRatio * 100}%`);
    
    console.log('\n📈 Mining Status');
    console.log('━'.repeat(50));
    console.log(`Current Supply: ${configAccountInfo.supply.toLocaleString()}`);
    const liquidityTokensRatio = parseFloat(configAccountInfo.liquidityTokensRatio);
    console.log(`Liquidity Tokens Supply: `, (configAccountInfo.supply * liquidityTokensRatio).toLocaleString());
    console.log(`Minter's Tokens Supply: `, (configAccountInfo.supply * (1 - liquidityTokensRatio)).toLocaleString());

    console.log(`Current Era: ${configAccountInfo.currentEra}`);
    console.log(`Current Epoch: ${configAccountInfo.currentEpoch}`);
    console.log(`Start Time of Current Checkpoint: ${new Date(configAccountInfo.startTimestampEpoch * 1000).toLocaleString()}`);
    console.log(`Last Difficulty Coefficient: ${configAccountInfo.lastDifficultyCoefficient}`);
    console.log(`Current Difficulty Coefficient: ${configAccountInfo.difficultyCoefficient}`);
    console.log(`Mint Size (Current Epoch): ${configAccountInfo.mintSizeEpoch.toLocaleString()}`);
    console.log(`Minted (Current Epoch): ${configAccountInfo.quantityMintedEpoch.toLocaleString()}`);
    console.log(`Target Mint Size (Epoch): ${configAccountInfo.targetMintSizeEpoch.toLocaleString()}`);
    
    const progress = (configAccountInfo.supply / configAccountInfo.maxSupply * 100).toFixed(2);
    console.log(`\n📊 Overall Progress: ${progress}% (${configAccountInfo.supply.toLocaleString()}/${configAccountInfo.maxSupply.toLocaleString()})`);
    
  } catch (error) {
    console.error('❌ Error displaying mint information:', error instanceof Error ? error.message : 'Unknown error');
  }
}