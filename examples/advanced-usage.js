const { createSDK, createSDKFromNetwork } = require('@flipflop-sdk/node');
const { Connection, Keypair } = require('@solana/web3.js');

async function advancedExample() {
  // Create SDK with custom configuration
  const customKeypair = Keypair.generate();
  const customSDK = createSDK({
    network: 'devnet',
    rpcUrl: 'https://api.devnet.solana.com',
    keypair: customKeypair
  });

  await customSDK.initialize();

  // Batch operations example
  const tokensToLaunch = [
    { name: 'Token 1', symbol: 'TK1', tokenType: 'standard' },
    { name: 'Token 2', symbol: 'TK2', tokenType: 'meme' },
    { name: 'Token 3', symbol: 'TK3', tokenType: 'standard' }
  ];

  console.log('Launching multiple tokens...');
  const launchResults = await Promise.allSettled(
    tokensToLaunch.map(token => customSDK.launchToken(token))
  );

  const successfulLaunches = launchResults
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value);

  console.log(`Successfully launched ${successfulLaunches.length} tokens`);

  // Set URC codes for all tokens
  console.log('Setting URC codes...');
  const urcResults = await Promise.allSettled(
    successfulLaunches.map((launch, index) =>
      customSDK.setURC({
        mint: launch.mint,
        urc: `URC${index + 1}2024`
      })
    )
  );

  // Advanced token analytics
  for (const launch of successfulLaunches) {
    const tokenInfo = await customSDK.getTokenInfo(launch.mint);
    console.log(`\nToken ${tokenInfo.symbol} Analytics:`);
    console.log('Name:', tokenInfo.name);
    console.log('Symbol:', tokenInfo.symbol);
    console.log('Supply:', tokenInfo.supply);
    console.log('Max Supply:', tokenInfo.maxSupply);
    console.log('Current Era:', tokenInfo.currentEra);
    console.log('Current Epoch:', tokenInfo.currentEpoch);
    console.log('Fee Rate:', tokenInfo.feeRate);
    console.log('Admin:', tokenInfo.admin);
    console.log('Token Vault:', tokenInfo.tokenVault);
  }

  // Batch minting with retry logic
  console.log('Batch minting tokens...');
  const mintResults = [];
  for (let i = 0; i < successfulLaunches.length; i++) {
    try {
      const mintResult = await customSDK.mintTokens({
        mint: successfulLaunches[i].mint,
        urc: `URC${i + 1}2024`
      });
      mintResults.push(mintResult);
      console.log(`Minted ${successfulLaunches[i].symbol}: ${mintResult.tx}`);
    } catch (error) {
      console.error(`Failed to mint ${successfulLaunches[i].symbol}:`, error.message);
    }
  }

  console.log('Advanced operations completed!');
}

async function monitoringExample() {
  const monitoringSDK = createSDKFromNetwork('devnet', [
    174, 47, 154, 16, 56, 23, 45, 234, 123, 45, 67, 89, 12, 34, 56, 78,
    90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90,
    12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12,
    34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34
  ]);

  await monitoringSDK.initialize();

  // Monitor token activity
  const targetMint = 'YourTokenMintAddressHere';
  
  async function monitorToken(mintAddress) {
    try {
      const tokenInfo = await monitoringSDK.getTokenInfo(mintAddress);
      const balance = await monitoringSDK.getBalance(
        monitoringSDK.provider.wallet.publicKey
      );
      
      console.log(`\n=== ${new Date().toISOString()} ===`);
      console.log(`Token: ${tokenInfo.name} (${tokenInfo.symbol})`);
      console.log(`Supply: ${tokenInfo.supply} / ${tokenInfo.maxSupply}`);
      console.log(`Current Era: ${tokenInfo.currentEra}`);
      console.log(`Current Epoch: ${tokenInfo.currentEpoch}`);
      console.log(`Wallet Balance: ${balance} SOL`);
      
      return { tokenInfo, balance };
    } catch (error) {
      console.error('Monitoring error:', error.message);
      return null;
    }
  }

  // Monitor every 30 seconds
  console.log('Starting token monitoring...');
  const monitorInterval = setInterval(async () => {
    await monitorToken(targetMint);
  }, 30000);

  // Stop monitoring after 5 minutes
  setTimeout(() => {
    clearInterval(monitorInterval);
    console.log('Monitoring stopped');
  }, 5 * 60 * 1000);
}

// Run examples
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'basic':
      basicExample();
      break;
    case 'advanced':
      advancedExample();
      break;
    case 'monitor':
      monitoringExample();
      break;
    default:
      console.log('Usage: node examples/advanced-usage.js [basic|advanced|monitor]');
  }
}

module.exports = {
  advancedExample,
  monitoringExample
};