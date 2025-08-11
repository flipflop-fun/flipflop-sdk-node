import {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  SystemProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  NATIVE_MINT,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  TokenAccountNotFoundError,
} from '@solana/spl-token';
import BN from 'bn.js';
import { getPoolInfoByRpc } from './display-pool';
import { CONFIGS, getNetworkType } from '../config';
import { Raydium, getPdaObservationId, makeSwapCpmmBaseInInstruction } from '@raydium-io/raydium-sdk-v2';
import { AUTH_SEED } from '../constants';

export interface SellTokenOptions {
  rpc: string;
  mint: string;
  amount: number; // Token amount to sell
  slippage?: number; // slippage in percentage (e.g., 1 for 1%)
  seller: Keypair;
}

export interface SellTokenResponse {
  mintAddress: PublicKey;
  tokenAmount: number;
  solAmount: number;
  poolAddress: PublicKey;
  txId: string;
}

export async function sellToken(
  options: SellTokenOptions,
): Promise<SellTokenResponse> {
  try {
    const connection = new Connection(options.rpc, 'confirmed');
    const seller = options.seller;
    const networkType = getNetworkType(options.rpc);
    const config = CONFIGS[networkType];

    // 初始化 Raydium SDK
    const raydium = await Raydium.load({
      connection,
      cluster: networkType as any,
      disableFeatureCheck: true,
      disableLoadToken: false,
      blockhashCommitment: "finalized",
    });

    // 获取池子信息
    const poolInfo = await getPoolInfoByRpc(
      connection,
      raydium,
      options.mint,
      NATIVE_MINT.toBase58(),
      options.rpc,
    );
    if (!poolInfo) {
      throw new Error(`No CPMM pool found for token ${options.mint}. You can specify poolAddress parameter to use a specific pool.`);
    }

    const isToken0Sol = poolInfo.mintA.equals(NATIVE_MINT);
    const inputMint = new PublicKey(options.mint);  // 输入是要卖出的代币
    const outputMint = NATIVE_MINT;  // 输出是SOL
    const inputVault = isToken0Sol ? poolInfo.vaultB : poolInfo.vaultA;  // 代币的vault
    const outputVault = isToken0Sol ? poolInfo.vaultA : poolInfo.vaultB;  // SOL的vault
    
    // 获取代币信息以确定小数位数
    const inputTokenInfo = await raydium.token.getTokenInfo(options.mint);
    const inputDecimals = inputTokenInfo?.decimals || 6;
    
    // 计算要卖出的代币数量（考虑小数位数）
    const amountIn = new BN(options.amount).mul(new BN(10).pow(new BN(inputDecimals)));
    
    // 获取池子储备量
    const tokenReserve = isToken0Sol ? new BN(poolInfo.quoteReserve) : new BN(poolInfo.baseReserve);
    const solReserve = isToken0Sol ? new BN(poolInfo.baseReserve) : new BN(poolInfo.quoteReserve);

    // 使用 CPMM 公式计算预期输出数量：amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
    const amountOutExpected = amountIn.mul(solReserve).div(tokenReserve.add(amountIn));

    // 应用滑点保护（默认 5% 滑点）
    const slippagePercent = options.slippage || 5;
    const slippageMultiplier = new BN(10000 - slippagePercent * 100); // 5% = 500 basis points
    const minAmountOut = amountOutExpected.mul(slippageMultiplier).div(new BN(10000));

    // 检查用户 SOL 余额（用于交易费用）
    const userSolBalance = await connection.getBalance(seller.publicKey);
    const requiredSolForFees = 0.01 * LAMPORTS_PER_SOL; // 预留 0.01 SOL 作为交易费用
    if (userSolBalance < requiredSolForFees) {
      throw new Error(`Insufficient SOL balance for transaction fees. Required: ${requiredSolForFees / LAMPORTS_PER_SOL} SOL, Available: ${userSolBalance / LAMPORTS_PER_SOL} SOL`);
    }

    const instructions = [];
    
    // 添加计算预算指令
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 })
    );

    // 获取用户的代币账户地址
    const sellerInputTokenAccount = await getAssociatedTokenAddress(
      inputMint,
      seller.publicKey
    );

    // 检查代币账户是否存在并检查余额
    try {
      const tokenAccountInfo = await getAccount(connection, sellerInputTokenAccount);
      const tokenBalance = new BN(tokenAccountInfo.amount.toString());
      
      if (tokenBalance.lt(amountIn)) {
        throw new Error(`Insufficient token balance. Required: ${amountIn.div(new BN(10).pow(new BN(inputDecimals))).toString()} tokens, Available: ${tokenBalance.div(new BN(10).pow(new BN(inputDecimals))).toString()} tokens`);
      }
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        throw new Error(`Token account not found for mint ${options.mint}. Please ensure you have tokens to sell.`);
      }
      throw error;
    }

    // 获取或创建 WSOL 账户
    const sellerOutputTokenAccount = await getAssociatedTokenAddress(
      NATIVE_MINT,
      seller.publicKey
    );

    // 检查 WSOL 账户是否存在，如果不存在则创建
    try {
      await getAccount(connection, sellerOutputTokenAccount);
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        // 创建 WSOL 关联代币账户
        instructions.push(
          createAssociatedTokenAccountInstruction(
            seller.publicKey,
            sellerOutputTokenAccount,
            seller.publicKey,
            NATIVE_MINT
          )
        );
      } else {
        throw error;
      }
    }

    // 构建权限地址
    const [authority] = PublicKey.findProgramAddressSync(
      [Buffer.from(AUTH_SEED)],
      new PublicKey(poolInfo.programId)
    );

    // 构建交换指令
    const swapInstruction = makeSwapCpmmBaseInInstruction(
      new PublicKey(poolInfo.programId),  // programId
      seller.publicKey,                   // payer
      authority,                          // authority
      new PublicKey(config.cpSwapConfigAddress),  // configId
      poolInfo.poolAddress,               // poolId
      sellerInputTokenAccount,            // inputTokenAccount
      sellerOutputTokenAccount,           // outputTokenAccount
      inputVault,                         // inputVault
      outputVault,                        // outputVault
      TOKEN_PROGRAM_ID,                   // inputTokenProgramId
      TOKEN_PROGRAM_ID,                   // outputTokenProgramId
      inputMint,                          // inputMint
      outputMint,                         // outputMint
      getPdaObservationId(new PublicKey(poolInfo.programId), new PublicKey(poolInfo.poolAddress)).publicKey,
      amountIn,
      minAmountOut,
    );

    instructions.push(swapInstruction);

    // 构建并发送交易
    const { blockhash } = await connection.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: seller.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([seller]);

    const sig = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    
    await connection.confirmTransaction(sig, 'confirmed');
            
    try {
      const wsolAccountInfo = await getAccount(connection, sellerOutputTokenAccount);
      const wsolBalance = new BN(wsolAccountInfo.amount.toString());
      
      if (wsolBalance.gt(new BN(0))) {
        // 如果有 WSOL 余额，将其转换回 SOL
        const closeInstructions = [];
        
        // 创建关闭 WSOL 账户的指令，这会将 WSOL 转换回 SOL
        closeInstructions.push(
          createCloseAccountInstruction(
            sellerOutputTokenAccount,
            seller.publicKey,
            seller.publicKey
          )
        );
        
        const { blockhash: closeBlockhash } = await connection.getLatestBlockhash();
        const closeMessage = new TransactionMessage({
          payerKey: seller.publicKey,
          recentBlockhash: closeBlockhash,
          instructions: closeInstructions,
        }).compileToV0Message();
        
        const closeTx = new VersionedTransaction(closeMessage);
        closeTx.sign([seller]);
        
        const closeSig = await connection.sendTransaction(closeTx);
        await connection.confirmTransaction(closeSig, 'confirmed');
        // console.log(`WSOL account cleaned up, ${wsolBalance.toNumber() / LAMPORTS_PER_SOL} SOL converted back`);
      }
    } catch (error) {
      console.error('Error cleaning up WSOL account:', error);
    }

    return {
      mintAddress: new PublicKey(options.mint),
      tokenAmount: options.amount,
      solAmount: minAmountOut.div(new BN(LAMPORTS_PER_SOL)).toNumber(),
      poolAddress: poolInfo.poolAddress,
      txId: sig,
    };
  } catch (error: any) {
    throw new Error(error.message);
  }
}
