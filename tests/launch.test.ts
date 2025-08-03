import { describe, it } from '@jest/globals';
import { launchToken } from '../src/launch';

describe('launch token', () => {
  describe('successful launch', () => {
    it('should launch a token', async () => {
      // Arrange
      const launchOptions = {
        rpc: 'http://127.0.0.1:8899',
        name: 'Trump Token9',
        symbol: 'TRP9',
        tokenType: 'meme',
        keypairBs58: '3HtSPuKFa1Df9pgdpqnMZoa4cMkLnh3tbAuXR9aeJY9WSWTUtXvPHUMyzNRjyN9sRF586T7fLdzhNLM4rdVpW4MW',
      };

      // Act
      const result = await launchToken(launchOptions);
      console.log(result);
      // Assert
      expect(result).toBeDefined();
      expect(result?.configuration.targetEras).toBe(1);
      expect(result?.metadata.name).toBe(launchOptions.name);
      expect(result?.metadata.symbol).toBe(launchOptions.symbol);
      expect(result?.configuration.liquidityTokensRatio).toBe(0.2);
    });
  });
});