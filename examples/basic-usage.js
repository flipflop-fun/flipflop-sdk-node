const { createSDKFromNetwork } = require('@flipflop-sdk/node');

async function basicExample() {
  // Initialize SDK for devnet
  const sdk = createSDKFromNetwork('devnet', [
    174, 47, 154, 16, 56, 23, 45, 234, 123, 45, 67, 89, 12, 34, 56, 78,
    90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90,
    12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12,
    34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34
  ]);

  // Initialize the SDK
  await sdk.initialize();

  // Launch a new token
  console.log('Launching new token...');
  const launchResult = await sdk.launchToken({
    name: 'My Awesome Token',
    symbol: 'MAT',
    uri: 'https://example.com/token-metadata.json',
    tokenType: 'meme'
  });
  console.log('Token launched:', launchResult);

  // Set URC code
  console.log('Setting URC code...');
  const urcResult = await sdk.setURC({
    mint: launchResult.mint,
    urc: 'AWESOME2024'
  });
  console.log('URC set:', urcResult);

  // Get token info
  console.log('Getting token info...');
  const tokenInfo = await sdk.getTokenInfo(launchResult.mint);
  console.log('Token info:', tokenInfo);

  // Get URC info
  console.log('Getting URC info...');
  const urcInfo = await sdk.getURCInfo('AWESOME2024');
  console.log('URC info:', urcInfo);

  // Mint tokens
  console.log('Minting tokens...');
  const mintResult = await sdk.mintTokens({
    mint: launchResult.mint,
    urc: 'AWESOME2024'
  });
  console.log('Tokens minted:', mintResult);
}

basicExample().catch(console.error);