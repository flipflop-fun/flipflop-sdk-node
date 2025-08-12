import { describe, it } from '@jest/globals';
import { launchToken } from '../src/launch';
import { loadKeypairFromBase58 } from '../src/utils';
import { TokenType } from '../src/types';
import { OPERATOR_KEYPAIR } from './raydium/config';

describe('launch token', () => {
  describe('successful launch', () => {
    it('should launch a token', async () => {
      // Arrange
      const launchOptions = {
        rpc: 'http://127.0.0.1:8899',
        name: 'Trump Token12',
        symbol: 'TRP12',
        tokenType: 'meme' as TokenType,
        creator: loadKeypairFromBase58(OPERATOR_KEYPAIR),
      };

      // Act
      const result = await launchToken(launchOptions);
      console.log(result);
      if (!result.success || !result.data) {
        console.log(result.message);
        return;
      }
      // Assert
      expect(result).toBeDefined();
      expect(result?.data?.configuration.targetEras).toBe(1);
      expect(result?.data?.metadata.name).toBe(launchOptions.name);
      expect(result?.data?.metadata.symbol).toBe(launchOptions.symbol);
      expect(result?.data?.configuration.liquidityTokensRatio).toBe(0.2);
    });
  });
});