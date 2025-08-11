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
        lpTokenAmount: 1, // 10 LP tokens, not lamports
        burner: loadKeypairFromBase58(OPERATOR_KEYPAIR),
      };

      // Act
      const result = await burnLiquidity(burnLiquidityOptions);
      console.log('Burn liquidity result:', result);
      
    }, 30000); // 30 second timeout
  });
});