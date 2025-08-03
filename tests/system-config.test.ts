import { describe, it, expect } from '@jest/globals';
import { getSystemConfig } from '../src/system-config';

describe('getSystemConfig', () => {
  describe('successful retrieval', () => {
    it('should return complete system config information', async () => {
      // Arrange
      const systemConfigOptions = {
        rpc: 'https://api.devnet.solana.com',
      };

      // Act
      const result = await getSystemConfig(systemConfigOptions);

      expect(result).toBeDefined();
      expect(result?.systemConfigAccount.toBase58()).toBe("J2xJh4WsfXrxERa9uGVbxon3x6gRHWTj33JcZASmt9Q3");
      expect(result?.systemManagerAccount.toBase58()).toBe('CXzddeiDgbTTxNnd1apeUGE7E1UAdvBoysf7c271AA79');
      expect(result?.admin.toBase58()).toBe('GmZ8FxsXA1UtEJFidZPMkjY6LpYf1ivNR4AupxmiAfwx');
      expect(result?.referrerResetIntervalSeconds).toBe(86400);
      expect(result?.updateMetadataFee).toBe(0.1);
      expect(result?.customizedDeployFee).toBe(10);
      expect(result?.initPoolWsolAmount).toBe(0.25);
      expect(result?.graduateFeeRate).toBe(5);
      expect(result?.minGraduateFee).toBe(5);
      expect(result?.raydiumCpmmCreateFee).toBe(0.15);
    });
  });
});