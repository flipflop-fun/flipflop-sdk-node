import { createSDK, createSDKFromNetwork, FlipFlopSDK } from '@flipflop-sdk/node';
import { Keypair } from '@solana/web3.js';

// TypeScript example with full type safety
interface TokenConfig {
  name: string;
  symbol: string;
  uri?: string;
  tokenType: 'meme' | 'standard';
}

interface LaunchPlan {
  tokens: TokenConfig[];
  urcCodes: string[];
  targetMintCount: number;
}

class TokenManager {
  private sdk: FlipFlopSDK;

  constructor(sdk: FlipFlopSDK) {
    this.sdk = sdk;
  }

  async initialize(): Promise<void> {
    await this.sdk.initialize();
  }

  async launchTokenBatch(config: LaunchPlan): Promise<{
    successful: Array<{ mint: string; config: TokenConfig }>;
    failed: Array<{ config: TokenConfig; error: string }>;
  }> {
    const results = {
      successful: [],
      failed: []
    };

    for (const tokenConfig of config.tokens) {
      try {
        console.log(`Launching ${tokenConfig.name}...`);
        const result = await this.sdk.launchToken(tokenConfig);
        results.successful.push({ mint: result.mint, config: tokenConfig });
        console.log(`✅ ${tokenConfig.name} launched: ${result.mint}`);
      } catch (error) {
        results.failed.push({
          config: tokenConfig,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error(`❌ Failed to launch ${tokenConfig.name}:`, error);
      }
    }

    return results;
  }

  async setupURCCodes(successfulLaunches: Array<{ mint: string; config: TokenConfig }>): Promise<{
    successful: Array<{ mint: string; urc: string }>;
    failed: Array<{ mint: string; urc: string; error: string }>;
  }> {
    const results = {
      successful: [],
      failed: []
    };

    for (let i = 0; i < successfulLaunches.length; i++) {
      const launch = successfulLaunches[i];
      const urcCode = `TOKEN${i + 1}_${Date.now()}`;
      
      try {
        console.log(`Setting URC ${urcCode} for ${launch.config.symbol}...`);
        await this.sdk.setURC({
          mint: launch.mint,
          urc: urcCode
        });
        results.successful.push({ mint: launch.mint, urc: urcCode });
        console.log(`✅ URC ${urcCode} set for ${launch.config.symbol}`);
      } catch (error) {
        results.failed.push({
          mint: launch.mint,
          urc: urcCode,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error(`❌ Failed to set URC for ${launch.config.symbol}:`, error);
      }
    }

    return results;
  }

  async mintTokensBatch(
    urcSetup: Array<{ mint: string; urc: string }>,
    mintCount: number
  ): Promise<{
    successful: Array<{ mint: string; urc: string; tx: string }>;
    failed: Array<{ mint: string; urc: string; error: string }>;
  }> {
    const results = {
      successful: [],
      failed: []
    };

    for (const setup of urcSetup) {
      for (let i = 0; i < mintCount; i++) {
        try {
          console.log(`Minting ${setup.urc} (${i + 1}/${mintCount})...`);
          const result = await this.sdk.mintTokens({
            mint: setup.mint,
            urc: setup.urc
          });
          results.successful.push({
            mint: setup.mint,
            urc: setup.urc,
            tx: result.tx
          });
          console.log(`✅ Minted ${setup.urc}: ${result.tx}`);
        } catch (error) {
          results.failed.push({
            mint: setup.mint,
            urc: setup.urc,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          console.error(`❌ Failed to mint ${setup.urc}:`, error);
        }
      }
    }

    return results;
  }

  async generateReport(
    launches: Array<{ mint: string; config: TokenConfig }>
  ): Promise<string> {
    let report = '# Token Launch Report\n\n';
    
    for (const launch of launches) {
      try {
        const tokenInfo = await this.sdk.getTokenInfo(launch.mint);
        const urcInfo = await this.sdk.getURCInfo(launch.mint); // This would need to be updated
        
        report += `## ${tokenInfo.name} (${tokenInfo.symbol})\n`;
        report += `- **Mint Address**: ${launch.mint}\n`;
        report += `- **Supply**: ${tokenInfo.supply} / ${tokenInfo.maxSupply}\n`;
        report += `- **Current Era**: ${tokenInfo.currentEra}\n`;
        report += `- **Current Epoch**: ${tokenInfo.currentEpoch}\n`;
        report += `- **Fee Rate**: ${tokenInfo.feeRate}\n`;
        report += `- **Token Vault**: ${tokenInfo.tokenVault}\n\n`;
      } catch (error) {
        report += `## ${launch.config.name} (${launch.config.symbol})\n`;
        report += `- **Error**: ${error instanceof Error ? error.message : 'Unknown error'}\n\n`;
      }
    }

    return report;
  }
}

// Example usage
async function typescriptExample() {
  // Create SDK with TypeScript
  const sdk = createSDKFromNetwork('devnet', [
    174, 47, 154, 16, 56, 23, 45, 234, 123, 45, 67, 89, 12, 34, 56, 78,
    90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90,
    12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12,
    34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34
  ]);

  await sdk.initialize();

  const tokenManager = new TokenManager(sdk);
  await tokenManager.initialize();

  // Define launch plan
  const launchPlan: LaunchPlan = {
    tokens: [
      { name: 'DeFi Token', symbol: 'DFT', tokenType: 'standard' },
      { name: 'Meme Coin', symbol: 'MEME', tokenType: 'meme' },
      { name: 'Utility Token', symbol: 'UTL', tokenType: 'standard' }
    ],
    urcCodes: ['DEFI2024', 'MEME2024', 'UTIL2024'],
    targetMintCount: 5
  };

  console.log('🚀 Starting token launch process...');

  // Launch tokens
  const launchResults = await tokenManager.launchTokenBatch(launchPlan);
  console.log(`\n📊 Launch Results:`);
  console.log(`✅ Successful: ${launchResults.successful.length}`);
  console.log(`❌ Failed: ${launchResults.failed.length}`);

  if (launchResults.successful.length > 0) {
    // Setup URC codes
    const urcSetup = await tokenManager.setupURCCodes(launchResults.successful);
    console.log(`\n🔗 URC Setup Results:`);
    console.log(`✅ Successful: ${urcSetup.successful.length}`);
    console.log(`❌ Failed: ${urcSetup.failed.length}`);

    if (urcSetup.successful.length > 0) {
      // Mint tokens
      const mintResults = await tokenManager.mintTokensBatch(
        urcSetup.successful,
        launchPlan.targetMintCount
      );
      console.log(`\n💰 Mint Results:`);
      console.log(`✅ Successful: ${mintResults.successful.length}`);
      console.log(`❌ Failed: ${mintResults.failed.length}`);

      // Generate report
      const report = await tokenManager.generateReport(launchResults.successful);
      console.log('\n📋 Token Report:');
      console.log(report);
    }
  }
}

// Advanced configuration example
async function advancedConfigurationExample() {
  const keypair = Keypair.generate();
  const customSDK = createSDK({
    network: 'devnet',
    rpcUrl: 'https://custom-rpc.example.com',
    keypair: keypair
  });

  await customSDK.initialize();

  // Custom retry configuration
  const { retryOperation } = await import('@flipflop-sdk/node');
  
  const result = await retryOperation(
    async () => {
      return await customSDK.launchToken({
        name: 'Custom Retry Token',
        symbol: 'CRT',
        tokenType: 'standard'
      });
    },
    3, // max retries
    2000 // delay between retries
  );

  console.log('Token launched with retry:', result);
}

// Error handling example
async function errorHandlingExample() {
  try {
    const sdk = createSDKFromNetwork('devnet', [
      174, 47, 154, 16, 56, 23, 45, 234, 123, 45, 67, 89, 12, 34, 56, 78,
      90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90,
      12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12,
      34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34
    ]);

    await sdk.initialize();

    // This will fail - no keypair provided
    await sdk.launchToken({
      name: 'Test Token',
      symbol: 'TEST',
      tokenType: 'meme'
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
      
      // Specific error handling
      if (error.message.includes('Keypair required')) {
        console.log('💡 Solution: Provide a keypair for token operations');
      } else if (error.message.includes('Invalid token type')) {
        console.log('💡 Solution: Use "meme" or "standard" for tokenType');
      }
    }
  }
}

// Export for testing
export {
  TokenManager,
  LaunchPlan,
  TokenConfig,
  typescriptExample,
  advancedConfigurationExample,
  errorHandlingExample
};

// Run if called directly
if (require.main === module) {
  typescriptExample().catch(console.error);
}

// CommonJS compatibility
module.exports = {
  ...require('./basic-usage'),
  ...require('./advanced-usage'),
  TokenManager,
  typescriptExample,
  advancedConfigurationExample,
  errorHandlingExample
};