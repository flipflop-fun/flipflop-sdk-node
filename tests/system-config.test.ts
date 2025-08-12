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
      expect(result?.data?.systemConfigAccount.toBase58()).toBe("J2xJh4WsfXrxERa9uGVbxon3x6gRHWTj33JcZASmt9Q3");
      expect(result?.data?.systemManagerAccount.toBase58()).toBe('CXzddeiDgbTTxNnd1apeUGE7E1UAdvBoysf7c271AA79');
      expect(result?.data?.admin.toBase58()).toBe('GmZ8FxsXA1UtEJFidZPMkjY6LpYf1ivNR4AupxmiAfwx');
      expect(result?.data?.referrerResetIntervalSeconds).toBe(86400);
      expect(result?.data?.updateMetadataFee).toBe(0.1);
      expect(result?.data?.customizedDeployFee).toBe(10);
      expect(result?.data?.initPoolWsolAmount).toBe(0.25);
      expect(result?.data?.graduateFeeRate).toBe(5);
      expect(result?.data?.minGraduateFee).toBe(5);
      expect(result?.data?.raydiumCpmmCreateFee).toBe(0.15);
    });
  });
});