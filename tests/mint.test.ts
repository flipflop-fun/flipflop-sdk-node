import { describe, it } from '@jest/globals';
import { mintToken } from '../src/mint';
import { loadKeypairFromBase58 } from '../src/utils';

describe('Mint token', () => {
  describe('successful mint token', () => {
    it('should mint token', async () => {
      // Arrange
      const mintTokenOptions = {
        rpc: 'http://127.0.0.1:8899',
        mint: 'FrN8g4QNaJoVBazsqpt9sCQTTVgLjMrqXYPdg1V7oZNv',
        urc: 'TRP10_URC',
        minter: loadKeypairFromBase58('jtqvhi1REtpMkysr3Z8L8RbvodDDXGpaTu7PVLWtamNMvP8zVidSUiPPgusYKgceRya6tzhd2CeFMeuNwZqcKVx'),
      };

      // Act
      const result = await mintToken(mintTokenOptions);
      console.log("tx", result?.data?.tx);
      // Assert
      expect(result?.success).toBe(true);
      expect(result?.message).toBe('Mint succeeded');
    });
  });
});