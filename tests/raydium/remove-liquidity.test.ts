import { describe, it } from '@jest/globals';
import { removeLiquidity } from '../../src/raydium/remove-liquidity';
import { loadKeypairFromBase58 } from '../../src/utils';
import { OPERATOR_KEYPAIR, TOKEN_MINT } from './config';
import { PublicKey } from '@solana/web3.js';

describe('remove liquidity', () => {
  describe('successful remove liquidity', () => {
    it('should remove liquidity from pool', async () => {
      // Arrange
      const removeLiquidityOptions = {
        rpc: 'http://127.0.0.1:8899',
        payer: loadKeypairFromBase58(OPERATOR_KEYPAIR),
        mint: new PublicKey(TOKEN_MINT), // USDC mint for testing
        removePercentage: 10, // 10% LP tokens
        slippage: 1, // 1% slippage
      };

      // Act
      const result = await removeLiquidity(removeLiquidityOptions);
      console.log('Remove liquidity result:', result);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data?.signature).toBeDefined();
    }, 30000); // 30 second timeout
  });
});