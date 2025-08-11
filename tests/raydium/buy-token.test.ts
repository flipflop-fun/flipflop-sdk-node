import { describe, it } from '@jest/globals';
import { buyToken } from '../../src/raydium/buy-token';
import { loadKeypairFromBase58 } from '../../src/utils';
import { OPERATOR_KEYPAIR, TOKEN_MINT } from './config';
import { PublicKey } from '@solana/web3.js';

describe('buy token', () => {
  describe('successful buy', () => {
    it('should buy tokens with SOL', async () => {
      // Arrange
      const buyOptions = {
        rpc: 'http://127.0.0.1:8899',
        mint: new PublicKey(TOKEN_MINT), // USDC mint for testing
        amount: 100, // 5000 tokens
        slippage: 5, // 1% slippage
        payer: loadKeypairFromBase58(OPERATOR_KEYPAIR),
      };

      // Act
      const result = await buyToken(buyOptions);
      console.log('Buy token result:', result);
      
    }, 30000); // 30 second timeout
  });

});