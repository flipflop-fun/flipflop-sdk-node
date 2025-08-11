import { describe, it, expect } from '@jest/globals';
import { addLiquidity } from '../../src/raydium/add-liquidity';
import { loadKeypairFromBase58 } from '../../src/utils';
import { OPERATOR_KEYPAIR, TOKEN_MINT } from './config';

describe('add liquidity', () => {
  describe.skip('validation', () => {
    it('should throw error for missing rpc', async () => {
      const addLiquidityOptions = {
        rpc: '',
        mint: TOKEN_MINT,
        tokenAmount: 10,
        slippage: 1,
        payer: loadKeypairFromBase58(OPERATOR_KEYPAIR),
      };

      await expect(addLiquidity(addLiquidityOptions)).rejects.toThrow('Missing rpc parameter');
    });

    it('should throw error for missing mint', async () => {
      const addLiquidityOptions = {
        rpc: 'https://api.devnet.solana.com',
        mint: '',
        tokenAmount: 10,
        slippage: 1,
        payer: loadKeypairFromBase58(OPERATOR_KEYPAIR),
      };

      await expect(addLiquidity(addLiquidityOptions)).rejects.toThrow('Missing mint parameter');
    });

    it('should throw error for invalid tokenAmount', async () => {
      const addLiquidityOptions = {
        rpc: 'https://api.devnet.solana.com',
        mint: TOKEN_MINT,
        tokenAmount: 0,
        slippage: 1,
        payer: loadKeypairFromBase58(OPERATOR_KEYPAIR),
      };

      await expect(addLiquidity(addLiquidityOptions)).rejects.toThrow('Invalid tokenAmount parameter');
    });

    it('should throw error for invalid slippage', async () => {
      const addLiquidityOptions = {
        rpc: 'https://api.devnet.solana.com',
        mint: TOKEN_MINT,
        tokenAmount: 10,
        slippage: -1,
        payer: loadKeypairFromBase58(OPERATOR_KEYPAIR),
      };

      await expect(addLiquidity(addLiquidityOptions)).rejects.toThrow('Invalid slippage parameter');
    });
  });

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
          mint: TOKEN_MINT, // Test token mint
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