import { describe, it } from '@jest/globals';
import { burnLiquidity } from '../../src/raydium/burn-liquidity';
import { loadKeypairFromBase58 } from '../../src/utils';
import { OPERATOR_KEYPAIR, TOKEN_MINT } from './config';

describe('burn liquidity', () => {
  describe('successful burn liquidity', () => {
    it('should burn LP tokens', async () => {
      // Arrange
      const burnLiquidityOptions = {
        rpc: 'http://127.0.0.1:8899',
        mint: TOKEN_MINT, // USDC mint for testing
        lpTokenAmount: 0.01, // 0.01 LP tokens
        burner: loadKeypairFromBase58(OPERATOR_KEYPAIR),
      };

      // Act
      const result = await burnLiquidity(burnLiquidityOptions);
      console.log('Burn liquidity result:', result);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.signature).toBeDefined();
      expect(result.mintAddress).toBe(burnLiquidityOptions.mint);
      expect(result.lpTokenAmount).toBe(burnLiquidityOptions.lpTokenAmount);
      expect(result.lpMintAddress).toBeDefined();
      expect(result.poolAddress).toBeDefined();
    }, 30000); // 30 second timeout
  });

  describe('validation', () => {
    it('should throw error for missing rpc', async () => {
      const burnLiquidityOptions = {
        rpc: '',
        mint: TOKEN_MINT,
        lpTokenAmount: 0.01,
        burner: loadKeypairFromBase58(OPERATOR_KEYPAIR),
      };

      await expect(burnLiquidity(burnLiquidityOptions)).rejects.toThrow('Missing rpc parameter');
    });

    it('should throw error for missing mint', async () => {
      const burnLiquidityOptions = {
        rpc: 'http://127.0.0.1:8899',
        mint: '',
        lpTokenAmount: 0.01,
        burner: loadKeypairFromBase58(OPERATOR_KEYPAIR),
      };

      await expect(burnLiquidity(burnLiquidityOptions)).rejects.toThrow('Missing mint parameter');
    });

    it('should throw error for invalid lpTokenAmount', async () => {
      const burnLiquidityOptions = {
        rpc: 'http://127.0.0.1:8899',
        mint: TOKEN_MINT,
        lpTokenAmount: 0,
        burner: loadKeypairFromBase58(OPERATOR_KEYPAIR),
      };

      await expect(burnLiquidity(burnLiquidityOptions)).rejects.toThrow('Invalid lpTokenAmount parameter');
    });

    it('should throw error for missing burner', async () => {
      const burnLiquidityOptions = {
        rpc: 'http://127.0.0.1:8899',
        mint: TOKEN_MINT,
        lpTokenAmount: 0.01,
        burner: null as any,
      };

      await expect(burnLiquidity(burnLiquidityOptions)).rejects.toThrow('Missing burner parameter');
    });
  });
});