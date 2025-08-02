import { describe, it, expect, jest } from '@jest/globals';
import { getMintInfo } from '../../src/display-mint';

describe('getMintInfo', () => {
  describe('successful retrieval', () => {
    it('should return complete mint information', async () => {
      // Arrange
      const mockOptions = {
        rpc: 'https://api.devnet.solana.com',
        mint: '5Parkp1rVK6VDM952mZUhsdXotLUMzn2j3gdQzxdgjvK'
      };

      // Act
      const result = await getMintInfo(mockOptions);

      // Assert
      expect(result).toBeDefined();
      expect(result?.mint).toBe("5Parkp1rVK6VDM952mZUhsdXotLUMzn2j3gdQzxdgjvK");
      expect(result?.name).toBe('gy');
      expect(result?.symbol).toBe('gy');
      expect(result?.uri).toBe('https://gateway.irys.xyz/G5kFtHn7M3Kfmk5UzmKPqp86sFmbuHo5mjtQxHeSmYGG');
      expect(result?.isMutable).toBe(true);
      expect(result?.configAccount).toBe('5MssfF6ouZMhffFKb8CGYLMZdG2SbrNsS4iyCip4Hf6G');
      expect(result?.admin).toBe('AMDgsZHmYCghSwnyZ3F1JQJtZhCL38rB9paTtFqZke95');
      expect(result?.tokenVault).toBe('CThKATDFzbaHnCkPBa41LVjvURTbLARqEE9MPcXugkhz');
      expect(result?.feeRate).toBe(0.2);
      expect(result?.targetEras).toBe(1);
      expect(result?.initialMintSize).toBe(10000);
      expect(result?.maxSupply).toBe(100000000);
    });
  });
});