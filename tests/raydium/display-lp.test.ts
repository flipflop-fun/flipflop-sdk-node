import { describe, it } from '@jest/globals';
import { displayLP } from '../../src/raydium/display-lp';
import { loadKeypairFromBase58 } from '../../src/utils';
import { OPERATOR_KEYPAIR, TOKEN_MINT } from './config';
import { PublicKey } from '@solana/web3.js';

describe('display LP', () => {
  describe('successful display LP', () => {
    it('should display LP token information', async () => {
      // Arrange
      const wallet = loadKeypairFromBase58(OPERATOR_KEYPAIR);
      const displayLpOptions = {
        rpc: 'http://127.0.0.1:8899',
        owner: wallet.publicKey,
        mint: new PublicKey(TOKEN_MINT), // USDC
      };

      // Act
      const result = await displayLP(displayLpOptions);
      // console.log('Display LP result:', result);
      console.log('LP token balance:', result?.data?.lpTokenBalance.toString());
      console.log('Share of pool:', result?.data?.shareOfPool);
      console.log('Token A amount:', result?.data?.tokenAAmount.toString());
      console.log('Token B amount:', result?.data?.tokenBAmount.toString());
    }, 30000); // 30 second timeout
  });
});