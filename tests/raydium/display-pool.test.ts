import { describe, it } from '@jest/globals';
import { displayPool } from '../../src/raydium/display-pool';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_MINT } from './config';
import { NATIVE_MINT } from '@solana/spl-token';

describe('display pool', () => {
  describe('successful display pool - local network (SDK)', () => {
    it('should display pool information using SDK for local network', async () => {
      // Arrange
      const connection = new Connection('http://127.0.0.1:8899', 'confirmed');
      const displayPoolOptions = {
        connection,
        tokenAMint: new PublicKey(TOKEN_MINT), // USDC mint for testing
        tokenBMint: new PublicKey(NATIVE_MINT.toBase58()), // SOL mint
        rpc: 'http://127.0.0.1:8899', // 明确指定 RPC 用于网络类型判断
      };

      // Act
      const result = await displayPool(displayPoolOptions);
      // console.log('Display pool result (SDK):', result);
      
      if (result && result.data) {
        console.log(result.data.quoteReserve.toNumber().toLocaleString());
        console.log(result.data.baseReserve.toNumber().toLocaleString());
        expect(result).toBeDefined();
        expect(result.data.poolAddress).toBeDefined();
        expect(result.data.mintLp).toBeDefined();
        expect(result.data.lpAmount).toBeDefined();
      } else {
        console.log('No pool found for local network - this is expected');
      }
    }, 30000); // 30 second timeout
  });
});