import { describe, it } from '@jest/globals';
import { sellToken } from '../../src/raydium/sell-token';
import { loadKeypairFromBase58 } from '../../src/utils';
import { OPERATOR_KEYPAIR, TOKEN_MINT } from './config';
import { PublicKey } from '@solana/web3.js';

describe('sell token', () => {
  describe('successful sell', () => {
    it('should sell tokens to get SOL', async () => {
      // Arrange
      const sellOptions = {
        rpc: 'http://127.0.0.1:8899',
        mint: new PublicKey(TOKEN_MINT), // Token mint for testing
        amount: 500, // 50 tokens to sell
        slippage: 1, // 5% slippage
        seller: loadKeypairFromBase58(OPERATOR_KEYPAIR),
      };

      // Act
      const result = await sellToken(sellOptions);
      console.log('Sell token result:', result);
      
    }, 30000); // 30 second timeout
  });
});