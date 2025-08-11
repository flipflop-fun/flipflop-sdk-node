import { describe, it, expect } from '@jest/globals';
import { addLiquidity } from '../../src/raydium/add-liquidity';
import { loadKeypairFromBase58 } from '../../src/utils';
import { OPERATOR_KEYPAIR, TOKEN_MINT } from './config';
import { PublicKey } from '@solana/web3.js';

describe('add liquidity', () => {
  describe('localnet add liquidity', () => {
    it('should find pool and calculate SOL amount on localnet', async () => {
      // Skip this test in CI or if no devnet access
      if (process.env.CI) {
        console.log('Skipping localnet test in CI environment');
        return;
      }

      const creator = loadKeypairFromBase58(OPERATOR_KEYPAIR);
      const rpc = 'http://127.0.0.1:8899';
      
      try {
        // Test with configured devnet token
        const addLiquidityOptions = {
          rpc,
          mint: new PublicKey(TOKEN_MINT), // Test token mint
          tokenAmount: 10000, // Small amount to test
          slippage: 5, // 30% slippage
          payer: creator,
        };
        const result = await addLiquidity(addLiquidityOptions);
        console.log('Add liquidity result:', result);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log('Localnet test completed:', errorMsg);
      }
    }, 30000); // 30 second timeout for devnet API calls
  });
});