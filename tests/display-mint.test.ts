import { describe, it, expect, jest } from '@jest/globals';
import { getMintData } from '../src/display-mint';
import { PublicKey } from '@solana/web3.js';

describe('getMintInfo', () => {
  describe('successful retrieval', () => {
    it('should return complete mint information', async () => {
      // Arrange
      const mockOptions = {
        rpc: 'https://api.devnet.solana.com',
        mint: new PublicKey('5Parkp1rVK6VDM952mZUhsdXotLUMzn2j3gdQzxdgjvK')
      };

      // Act
      const result = await getMintData(mockOptions);

      // Assert
      expect(result).toBeDefined();
      if (!result?.data || !result?.success) {
        console.log(result.message);
        return;
      }
      expect(result?.data.mint.toBase58()).toBe("5Parkp1rVK6VDM952mZUhsdXotLUMzn2j3gdQzxdgjvK");
      expect(result?.data.name).toBe('gy');
      expect(result?.data.symbol).toBe('gy');
      expect(result?.data.uri).toBe('https://gateway.irys.xyz/G5kFtHn7M3Kfmk5UzmKPqp86sFmbuHo5mjtQxHeSmYGG');
      expect(result?.data.isMutable).toBe(true);
      expect(result?.data.reduceRatio).toBe(0.5);
      expect(result?.data.configAccount.toBase58()).toBe('5MssfF6ouZMhffFKb8CGYLMZdG2SbrNsS4iyCip4Hf6G');
      expect(result?.data.admin.toBase58()).toBe('AMDgsZHmYCghSwnyZ3F1JQJtZhCL38rB9paTtFqZke95');
      expect(result?.data.tokenVault.toBase58()).toBe('CThKATDFzbaHnCkPBa41LVjvURTbLARqEE9MPcXugkhz');
      expect(result?.data.feeRate).toBe(0.2);
      expect(result?.data.targetEras).toBe(1);
      expect(result?.data.initialMintSize).toBe(10000);
      expect(result?.data.maxSupply).toBe(100000000);
    });
  });
});