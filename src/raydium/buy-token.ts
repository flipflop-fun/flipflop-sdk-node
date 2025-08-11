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
} from '@solana/spl-token';
import BN from 'bn.js';
import { getPoolInfoByRpc } from './display-pool';
import { CONFIGS, getNetworkType } from '../config';
import { Raydium, getPdaObservationId, makeSwapCpmmBaseOutInstruction } from '@raydium-io/raydium-sdk-v2';
import { AUTH_SEED } from '../constants';

export interface BuyTokenOptions {
  rpc: string;
  mint: string;
  amount: number;
  slippage?: number;
  payer: Keypair;
}

export interface BuyTokenResponse {
  mintAddress: PublicKey;
  solAmount: number;
  tokenAmount: number;
  poolAddress: PublicKey;
  txId: string;
}

export async function buyToken(
  options: BuyTokenOptions,
): Promise<BuyTokenResponse> {
  if (!options.rpc) {
    throw new Error('RPC url not provided');
  }
  if (!options.mint) {
    throw new Error('Token mint not provided');
  }
  if (!options.amount) {
    throw new Error('Token amount not provided');
  }
  // if (!options.maxSolAmount) {
  //   throw new Error('Max SOL amount not provided');
  // }
  if (!options.payer) {
    throw new Error('Payer not provided');
  }
  
  try {
    const connection = new Connection(options.rpc, 'confirmed');
    const payer = options.payer;
    const networkType = getNetworkType(options.rpc);
    const config = CONFIGS[networkType];

    const raydium = await Raydium.load({
      owner: options.payer,
      connection,
      cluster: networkType as any,
      disableFeatureCheck: true,
      disableLoadToken: false,
      blockhashCommitment: "finalized",
    });

    const poolInfo = await getPoolInfoByRpc(
      connection,
      raydium,
      NATIVE_MINT.toBase58(),
      options.mint,
      options.rpc,
    );
    if (!poolInfo) {
      throw new Error(`No CPMM pool found for token ${options.mint}. You can specify poolAddress parameter to use a specific pool.`);
    }

    const isToken0Sol = poolInfo.mintA.equals(NATIVE_MINT);
    const inputMint = NATIVE_MINT;  // 输入是SOL
    const outputMint = new PublicKey(options.mint);  // 输出是目标代币
    const inputVault = isToken0Sol ? poolInfo.vaultA : poolInfo.vaultB;  // SOL的vault
    const outputVault = isToken0Sol ? poolInfo.vaultB : poolInfo.vaultA;  // 代币的vault
    
    // 获取代币信息以确定小数位数
    const outputTokenInfo = await raydium.token.getTokenInfo(options.mint);
    const outputDecimals = outputTokenInfo?.decimals || 6;
    
    // 使用BN直接计算，避免精度丢失
    const amountOut = new BN(options.amount).mul(new BN(LAMPORTS_PER_SOL));
    // const maxAmountIn = new BN(options.maxSolAmount).mul(new BN(LAMPORTS_PER_SOL)); // SOL 有 9 位小数
    const solReserve = isToken0Sol ? new BN(poolInfo.baseReserve) : new BN(poolInfo.quoteReserve);
    const tokenReserve = isToken0Sol ? new BN(poolInfo.quoteReserve) : new BN(poolInfo.baseReserve);

    const amountInRequired = amountOut.mul(solReserve).div(tokenReserve.sub(amountOut));

    const slippagePercent = options.slippage || 5;
    const slippageMultiplier = new BN(10000 + slippagePercent * 100); // 1% = 100 basis points
    const maxAmountIn = amountInRequired.mul(slippageMultiplier).div(new BN(10000));

    const payerInputTokenAccount = await getAssociatedTokenAddress(inputMint, payer.publicKey);
    const payerOutputTokenAccount = await getAssociatedTokenAddress(outputMint, payer.publicKey);
    // console.log('token account', payerInputTokenAccount.toBase58());
    // console.log('wsol account', payerOutputTokenAccount.toBase58());
    const [authority] = PublicKey.findProgramAddressSync(
      [Buffer.from(AUTH_SEED)],
      new PublicKey(poolInfo.programId)
    );

    const instructions = [];
    try {
      await getAccount(connection, payerOutputTokenAccount);
    } catch (error) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          payerOutputTokenAccount,
          payer.publicKey,
          outputMint
        )
      );
    }

    try {
      const wsolAccountInfo = await getAccount(connection, payerInputTokenAccount);
      // 检查 WSOL 账户余额是否足够
      const currentWsolBalance = new BN(wsolAccountInfo.amount.toString());
      if (currentWsolBalance.lt(maxAmountIn)) {
        // WSOL 余额不足，需要包装更多 SOL
        const additionalSolNeeded = maxAmountIn.sub(currentWsolBalance);
        
        // 检查用户的 SOL 余额是否足够
        const solBalance = await connection.getBalance(payer.publicKey);
        const requiredSolForTx = additionalSolNeeded.add(new BN(5000)); // 预留交易费用
        
        if (solBalance < requiredSolForTx.toNumber()) {
          throw new Error(
            `Insufficient SOL balance. Available: ${solBalance / LAMPORTS_PER_SOL} SOL, Required: ${requiredSolForTx.toNumber() / LAMPORTS_PER_SOL} SOL`
          );
        }
        
        // 添加包装 SOL 的指令
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: payerInputTokenAccount,
            lamports: additionalSolNeeded.toNumber(),
          }),
          createSyncNativeInstruction(payerInputTokenAccount)
        );
      }
    } catch (error: any) {
      // WSOL 账户不存在的情况
      if (error.name === 'TokenAccountNotFoundError') {
        // 检查用户的 SOL 余额是否足够创建账户并包装
        const solBalance = await connection.getBalance(payer.publicKey);
        const requiredSolForTx = maxAmountIn.add(new BN(5000)); // 预留交易费用
        
        if (solBalance < requiredSolForTx.toNumber()) {
          throw new Error(
            `Insufficient SOL balance. Available: ${solBalance / LAMPORTS_PER_SOL} SOL, Required: ${requiredSolForTx.toNumber() / LAMPORTS_PER_SOL} SOL`
          );
        }
        
        instructions.push(
          createAssociatedTokenAccountInstruction(
            payer.publicKey,
            payerInputTokenAccount,
            payer.publicKey,
            inputMint
          )
        );
        // 创建WSOL账户并wrap所需的SOL
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: payerInputTokenAccount,
            lamports: maxAmountIn.toNumber(),
          }),
          createSyncNativeInstruction(payerInputTokenAccount)
        );
      } else {
        throw error;
      }
    }
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 })
    );

    const swapInstruction = makeSwapCpmmBaseOutInstruction(
      new PublicKey(poolInfo.programId),  // programId
      payer.publicKey,                    // payer
      authority,                          // authority
      new PublicKey(config.cpSwapConfigAddress),  // configId
      poolInfo.poolAddress,               // poolId
      payerInputTokenAccount,             // inputTokenAccount
      payerOutputTokenAccount,            // outputTokenAccount
      inputVault,                         // inputVault
      outputVault,                        // outputVault
      TOKEN_PROGRAM_ID,                   // inputTokenProgramId
      TOKEN_PROGRAM_ID,                   // outputTokenProgramId
      inputMint,                          // inputMint
      outputMint,                         // outputMint
      getPdaObservationId(new PublicKey(poolInfo.programId), new PublicKey(poolInfo.poolAddress)).publicKey,
      maxAmountIn,
      amountOut,
    );

    instructions.push(swapInstruction);

    const { blockhash } = await connection.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([payer]);

    const sig = await connection.sendTransaction(tx, {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    
    await connection.confirmTransaction(sig, 'confirmed');
            
    // 添加清理 WSOL 账户的逻辑
    try {
      const wsolAccountInfo = await getAccount(connection, payerInputTokenAccount);
      const remainingWsolBalance = new BN(wsolAccountInfo.amount.toString());
      
      if (remainingWsolBalance.gt(new BN(0))) {
        // 如果还有剩余的 WSOL，将其转换回 SOL
        const closeInstructions = [];
        
        // 创建关闭 WSOL 账户的指令，这会将剩余的 WSOL 转换回 SOL
        closeInstructions.push(
          createCloseAccountInstruction(
            payerInputTokenAccount,
            payer.publicKey,
            payer.publicKey
          )
        );
        
        const { blockhash: closeBlockhash } = await connection.getLatestBlockhash();
        const closeMessage = new TransactionMessage({
          payerKey: payer.publicKey,
          recentBlockhash: closeBlockhash,
          instructions: closeInstructions,
        }).compileToV0Message();
        
        const closeTx = new VersionedTransaction(closeMessage);
        closeTx.sign([payer]);
        
        const closeSig = await connection.sendTransaction(closeTx);
        await connection.confirmTransaction(closeSig, 'confirmed');
      }
    } catch (error) {
      console.error('Error while unwrap WSOL:', error);
    }

    return {
      mintAddress: new PublicKey(options.mint),
      solAmount: maxAmountIn.div(new BN(LAMPORTS_PER_SOL)).toNumber(),
      tokenAmount: options.amount,
      poolAddress: poolInfo.poolAddress,
      txId: sig,
    }
  } catch (error: any) {
    throw new Error(error.message);
  }
}
