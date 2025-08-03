import { describe, it } from '@jest/globals';
import { setUrc } from '../src/set-urc';
import { loadKeypairFromBase58 } from '../src/utils';
import { PublicKey } from '@solana/web3.js';

describe('set urc', () => {
  describe('successful set urc', () => {
    it('should set urc', async () => {
      // Arrange
      const setUrcOptions = {
        rpc: 'http://127.0.0.1:8899',
        mint: new PublicKey('FrN8g4QNaJoVBazsqpt9sCQTTVgLjMrqXYPdg1V7oZNv'),
        urc: 'TRP10_URC',
        refAccount: loadKeypairFromBase58('3HtSPuKFa1Df9pgdpqnMZoa4cMkLnh3tbAuXR9aeJY9WSWTUtXvPHUMyzNRjyN9sRF586T7fLdzhNLM4rdVpW4MW'),
      };

      // Act
      const result = await setUrc(setUrcOptions);
      console.log(result);
      // Assert
      expect(result).toBeDefined();
      expect(result?.urc).toBe(setUrcOptions.urc);
      expect(result?.usageCount).toBe(0);
    });
  });
});