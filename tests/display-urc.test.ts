import { describe, it, expect } from '@jest/globals';
import { getUrcData } from '../src/display-urc';

describe('getUrc', () => {
  describe('successful retrieval', () => {
    it('should return complete urc information', async () => {
      // Arrange
      const mockOptions = {
        rpc: 'https://api.devnet.solana.com',
        urc: 'GY1'
      };

      // Act
      const result = await getUrcData(mockOptions);
      // Assert
      expect(result).toBeDefined();
      expect(result?.mint.toBase58()).toBe("5Parkp1rVK6VDM952mZUhsdXotLUMzn2j3gdQzxdgjvK");
      expect(result?.urc).toBe('GY1');
      expect(result?.codeHash.toBase58()).toBe('8ApGEGQELN1K7q1fDX8xtFP6ME3oYFzntKeUF7RNkB8C');
      expect(result?.referrerMain.toBase58()).toBe('urq59pTdKGN9XMzfKUpj7oichcurNAAeMJJTapBKDWY');
      expect(result?.referrerAta.toBase58()).toBe('J3YEbhxV4cWPSr4UXe7QmrRgYtxFVh3kznStE9Rv3U2k');
      expect(result?.isValid).toBe(true);
    });
  });
});