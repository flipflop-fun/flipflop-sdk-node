import { describe, it, expect } from '@jest/globals';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { EstimateVolumeOptions } from '../../src/raydium/types';
import { NATIVE_MINT } from '@solana/spl-token';
import { estimateVolume } from '../../src/raydium/estimate-volume';
import { TOKEN_MINT } from './config';
import { BN } from '@coral-xyz/anchor';

describe('estimateVolume', () => {
  const rpc = 'http://127.0.0.1:8899';
  const tokenAMint = new PublicKey(TOKEN_MINT);
  const tokenBMint = NATIVE_MINT;

  const baseOptions: EstimateVolumeOptions = {
    rpc,
    tokenAMint,
    tokenBMint,
    action: 'buy',
    maxSlippage: 10, // 10% 滑点
  };

  it('should estimate maximum buy volume with 5% slippage', async () => {
    const result = await estimateVolume(baseOptions);
    
    expect(result).toBeDefined();
    expect(result?.success).toBe(true);
    
    if (result?.success && result.data) {
      expect(result.data.tokenAAmount).toBeDefined();
      expect(result.data.maxSlippage).toBeLessThanOrEqual(10.1); // 允许小误差
      expect(result.data.requiredAmount).toBeDefined();
      expect(result.data.actualPrice).toBeGreaterThan(0);
      expect(result.data.action).toBe('buy');
      
      console.log('Buy Volume Estimation:');
      console.log(`K: ${result.data.k.toString()}`);
      console.log(`Max Buy Token Amount: ${result.data.tokenAAmount.div(new BN(LAMPORTS_PER_SOL)).toString()}`);
      console.log(`Required SOL: ${(Number(result.data.requiredAmount) / LAMPORTS_PER_SOL).toString()}`);
      console.log(`Actual Slippage: ${result.data.maxSlippage.toFixed(4)}%`);
      console.log(`Current Price: ${result.data.currentPrice}`);
      console.log(`Actual Price: ${result.data.actualPrice}`);
    }
  }, 30000);

  it('should estimate maximum sell volume with 3% slippage', async () => {
    const sellOptions: EstimateVolumeOptions = {
      ...baseOptions,
      action: 'sell',
      maxSlippage: 10,
    };
    
    const result = await estimateVolume(sellOptions);
    
    expect(result).toBeDefined();
    expect(result?.success).toBe(true);
    
    if (result?.success && result.data) {
      expect(result.data.tokenAAmount).toBeDefined();
      expect(result.data.maxSlippage).toBeLessThanOrEqual(10.1); // 允许小误差
      expect(result.data.requiredAmount).toBeDefined();
      expect(result.data.actualPrice).toBeGreaterThan(0);
      expect(result.data.action).toBe('sell');
      
      console.log('Sell Volume Estimation:');
      console.log(`Max Sell Token Amount: ${result.data.tokenAAmount.div(new BN(LAMPORTS_PER_SOL)).toString()}`);
      console.log(`Received SOL: ${(Number(result.data.requiredAmount) / LAMPORTS_PER_SOL).toString()}`);
      console.log(`Actual Slippage: ${result.data.maxSlippage.toFixed(4)}%`);
      console.log(`Actual Price: ${result.data.actualPrice}`);
    }
  }, 30000);

  it('should handle extreme slippage values', async () => {
    // 测试极低滑点（可能无法实现）
    const lowSlippageOptions: EstimateVolumeOptions = {
      ...baseOptions,
      maxSlippage: 0.01, // 0.01%
    };
    
    const result = await estimateVolume(lowSlippageOptions);
    
    // 可能成功也可能失败，取决于池子的流动性
    if (result?.success) {
      expect(result.data?.maxSlippage).toBeLessThanOrEqual(0.02);
    } else {
      expect(result?.message).toBeDefined();
    }
  });
});
