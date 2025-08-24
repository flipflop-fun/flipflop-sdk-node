import { describe, it } from '@jest/globals';
import { refundToken } from '../src/refund';
import { loadKeypairFromBase58 } from '../src/utils';
import { PublicKey } from '@solana/web3.js';

describe('Refund token', () => {
  describe('successful refund token', () => {
    it('should refund token', async () => {
      // Arrange
      const refundTokenOptions = {
        rpc: 'http://127.0.0.1:8899',
        mint: new PublicKey('8BAY22Ni8EUfQL3MfwVTbZg962jbDtwyZhHNXBCt6jkC'),
        owner: loadKeypairFromBase58('jtqvhi1REtpMkysr3Z8L8RbvodDDXGpaTu7PVLWtamNMvP8zVidSUiPPgusYKgceRya6tzhd2CeFMeuNwZqcKVx'),
      };

      // Act
      const result = await refundToken(refundTokenOptions);
      console.log("tx", result?.data?.tx);
      // Assert
      expect(result?.success).toBe(true);
    });
  });
});