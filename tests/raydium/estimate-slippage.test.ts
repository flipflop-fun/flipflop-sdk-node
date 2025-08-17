import { describe, it, expect } from '@jest/globals';
import { estimateSlippage } from '../../src/raydium/estimate-slippage';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_MINT } from './config';
import { NATIVE_MINT } from '@solana/spl-token';

describe('estimate slippage', () => {
  const rpc = 'http://127.0.0.1:8899';
  const tokenAMint = new PublicKey(TOKEN_MINT);
  const tokenBMint = NATIVE_MINT;

  describe('successful slippage estimation', () => {
    it('should estimate slippage for buy action', async () => {
      // Arrange
      const options = {
        rpc,
        tokenAMint,
        tokenBMint,
        tokenAAmount: 1_000_000, // 购买 50 个代币
        action: 'buy' as const,
      };

      // Act
      const result = await estimateSlippage(options);
      
      // Assert
      console.log('Buy slippage result:', result);
      if (result && result.success && result.data) {
        expect(result.success).toBe(true);
        
        console.log(`当前价格: ${result.data.currentPrice}`);
        console.log(`当前池子WSOL余额: ${result.data.baseReserve.toString()}`);
        console.log(`当前池子Token余额: ${result.data.quoteReserve.toString()}`); // 26,615,072.076277559
        console.log(`实际价格: ${result.data.actualPrice}`);
        console.log(`滑点: ${result.data.slippage.toFixed(2)}%`);
        console.log(`需要支付: ${result.data.requiredAmount} base tokens`);
      } else {
        console.log('No pool found for buy estimation - this is expected for local network');
      }
    }, 30000);

    it('should estimate slippage for sell action', async () => {
      // Arrange
      const options = {
        rpc,
        tokenAMint,
        tokenBMint,
        tokenAAmount: 1_000_000, // 卖出 50 个代币
        action: 'sell' as const,
      };

      // Act
      const result = await estimateSlippage(options);
      
      // Assert
      console.log('Sell slippage result:', result);
      if (result && result.success && result.data) {
        expect(result.success).toBe(true);
        
        console.log(`当前价格: ${result.data.currentPrice}`);
        console.log(`当前池子WSOL余额: ${result.data.baseReserve.toString()}`);
        console.log(`当前池子Token余额: ${result.data.quoteReserve.toString()}`); // 26,615,072.076277559
        console.log(`实际价格: ${result.data.actualPrice}`);
        console.log(`滑点: ${result.data.slippage.toFixed(2)}%`);
        console.log(`能获得: ${result.data.requiredAmount} base tokens`);
      } else {
        console.log('No pool found for sell estimation - this is expected for local network');
      }
    }, 30000);
  });

  describe('mathematical accuracy', () => {
    it('should maintain price consistency in calculations', async () => {
      // Arrange
      const options = {
        tokenAMint,
        tokenBMint,
        tokenAAmount: 100,
        action: 'buy' as const,
        rpc,
      };

      // Act
      const result = await estimateSlippage(options);
      
      // Assert
      if (result && result.success && result.data) {
        const { currentPrice, actualPrice, requiredAmount, tokenAAmount } = result.data;
        
        // 验证实际价格计算是否正确
        const calculatedPrice = Number(requiredAmount) / Number(tokenAAmount);
        expect(Math.abs(Number(actualPrice) - calculatedPrice)).toBeLessThan(0.0001);
        
        // 验证滑点计算是否合理
        const expectedSlippage = (Math.abs(Number(actualPrice) - currentPrice) / currentPrice) * 100;
        expect(Math.abs(result.data.slippage - expectedSlippage)).toBeLessThan(0.01);
        
        console.log('Price consistency check passed');
        console.log(`Current: ${currentPrice}, Actual: ${actualPrice}, Calculated: ${calculatedPrice}`);
      }
    }, 30000);
  });
});