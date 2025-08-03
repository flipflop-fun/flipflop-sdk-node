import { describe, it } from '@jest/globals';
import { mintToken } from '../src/mint';

describe('Mint token', () => {
  describe('successful mint token', () => {
    it('should mint token', async () => {
      // Arrange
      const mintTokenOptions = {
        rpc: 'http://127.0.0.1:8899',
        mint: '4MoNnFU7M2sRt1Lmx4dhDTUr7j8FTf8qBGJXX7aZAGC6',
        urc: 'TRP9_URC',
        keypairBs58: 'jtqvhi1REtpMkysr3Z8L8RbvodDDXGpaTu7PVLWtamNMvP8zVidSUiPPgusYKgceRya6tzhd2CeFMeuNwZqcKVx',
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