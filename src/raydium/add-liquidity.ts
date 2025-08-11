import { Connection, PublicKey, Keypair, TransactionMessage, VersionedTransaction, SystemProgram, ComputeBudgetProgram } from "@solana/web3.js";
import {
  Raydium,
  Percent,
  makeDepositCpmmInInstruction,
} from "@raydium-io/raydium-sdk-v2";
import { AccountLayout, getAssociatedTokenAddress, NATIVE_MINT, createAssociatedTokenAccountInstruction, getAccount, createSyncNativeInstruction } from "@solana/spl-token";
import { CONFIGS, getNetworkType } from "../config";
import BN from "bn.js";
import { DisplayPoolResponse, getPoolInfoByRpc } from "./display-pool";
import { compareMints } from "../utils";
import { AUTH_SEED } from "../constants";

export interface AddLiquidityOptions {
  rpc: string;
  mint: string;
  tokenAmount: number; // Token amount to add
  slippage: number; // slippage in percentage (e.g., 1 for 1%)
  payer: Keypair;
}

export interface AddLiquidityResponse {
  signature: string;
  mintAddress: PublicKey;
  tokenAmount: BN;
  solAmount: BN; // SOL amount calculated based on pool ratio
  lpTokenAmount: BN;
  poolAddress: PublicKey;
}

export const addLiquidity = async (
  options: AddLiquidityOptions
): Promise<AddLiquidityResponse> => {
  // Validate required parameters
  if (!options.rpc) {
    throw new Error("Missing rpc parameter");
  }

  if (!options.mint) {
    throw new Error("Missing mint parameter");
  }

  if (!options.tokenAmount || options.tokenAmount <= 0) {
    throw new Error("Invalid tokenAmount parameter");
  }

  if (options.slippage === undefined || options.slippage < 0) {
    throw new Error("Invalid slippage parameter");
  }

  if (!options.payer) {
    throw new Error("Missing provider parameter");
  }

  const connection = new Connection(options.rpc, "confirmed");
  const networkType = getNetworkType(options.rpc);
  const config = CONFIGS[networkType];

  try {
    // Initialize Raydium SDK with proper cluster
    const raydium = await Raydium.load({
      owner: options.payer,
      connection,
      cluster: networkType as any,
      disableFeatureCheck: true,
      disableLoadToken: false,
      blockhashCommitment: "finalized",
    });

    // Get token mint
    const mintPubkey = new PublicKey(options.mint);

    // Check token balance
    const tokenAccounts = await connection.getTokenAccountsByOwner(
      options.payer.publicKey,
      { mint: mintPubkey }
    );

    if (tokenAccounts.value.length === 0) {
      throw new Error(`No token account found for mint ${options.mint}`);
    }

    // Get token info using Raydium API
    const tokenInfo = await raydium.token.getTokenInfo(options.mint);
    const solInfo = await raydium.token.getTokenInfo(NATIVE_MINT);

    if (!tokenInfo || !solInfo) {
      throw new Error("Failed to get token information");
    }

    // Parse token account data
    const tokenAccountInfo = AccountLayout.decode(
      tokenAccounts.value[0].account.data
    );

    const availableTokenBalance = new BN(tokenAccountInfo.amount.toString())
      .div(new BN(10).pow(new BN(tokenInfo.decimals)))
      .toNumber();

    if (availableTokenBalance < options.tokenAmount) {
      throw new Error(
        `Insufficient token balance. Available: ${availableTokenBalance}, Required: ${options.tokenAmount}`
      );
    }

    // Fallback to mint-based discovery using API
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

    // Calculate required SOL amount based on pool ratio
    const tokenAmountBN = new BN(options.tokenAmount).mul(new BN(10).pow(new BN(tokenInfo.decimals)));
    // Ensure we have valid reserve values
    const mintAmountA = String(poolInfo.baseReserve || "0");
    const mintAmountB = String(poolInfo.quoteReserve || "0");

    const cleanMintAmountA = mintAmountA.replace(/[^0-9]/g, '') || "1000000000";
    const cleanMintAmountB = mintAmountB.replace(/[^0-9]/g, '') || "1000000000";

    // Determine token and SOL reserves based on which mint is which
    let tokenReserve: BN;
    let solReserve: BN;
    
    const tokenMint = new PublicKey(options.mint);
    
    if (poolInfo.mintA.equals(tokenMint)) {
      tokenReserve = new BN(cleanMintAmountA);
      solReserve = new BN(cleanMintAmountB);
    } else {
      tokenReserve = new BN(cleanMintAmountB);
      solReserve = new BN(cleanMintAmountA);
    }

    // Handle zero reserves
    if (tokenReserve.isZero()) {
      throw new Error("Cannot calculate SOL amount: token reserve is zero");
    }

    // Calculate required SOL amount
    const requiredSolAmountBN = tokenAmountBN.mul(solReserve).div(tokenReserve);

    // Check SOL balance
    const solBalance = await connection.getBalance(options.payer.publicKey);
    // console.log("SOL balance:", solBalance / 1e9);
    // console.log("Required SOL:", requiredSolAmount);

    if (solBalance < requiredSolAmountBN.toNumber()) {
      throw new Error(
        `Insufficient SOL balance. Available: ${
          solBalance / 1e9
        }, Required: ${requiredSolAmountBN.toNumber() / 1e9}`
      );
    }

    // Create slippage percentage
    const slippagePercent = new Percent(options.slippage, 100);
    const result = await doAddLiquidityInstruction(
      connection,
      poolInfo,
      new PublicKey(options.mint),
      requiredSolAmountBN,
      tokenAmountBN,
      options.payer,
      slippagePercent,
    );

    return result;
  } catch (error) {
    console.error("Add liquidity error:", error);
    throw new Error(
      `Failed to add liquidity: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

async function doAddLiquidityInstruction(
  connection: Connection,
  poolInfo: DisplayPoolResponse,
  mint: PublicKey,
  solAmount: BN,
  tokenAmount: BN,
  payer: Keypair,
  slippagePercent: Percent,
) {
  const [mint0, mint1] = compareMints(NATIVE_MINT, mint) < 0 ? [NATIVE_MINT, mint] : [mint, NATIVE_MINT];
  const isSolFirst = mint0.equals(NATIVE_MINT);

  const userSolAccount = await getAssociatedTokenAddress(NATIVE_MINT, payer.publicKey);
  const userTokenAccount = await getAssociatedTokenAddress(mint, payer.publicKey);
  const mintA = mint0;
  const mintB = mint1;
  const tokenAccountA = isSolFirst ? userSolAccount : userTokenAccount;
  const tokenAccountB = isSolFirst ? userTokenAccount : userSolAccount;
  const vaultA = isSolFirst ? new PublicKey(poolInfo.vaultA) : new PublicKey(poolInfo.vaultB);
  const vaultB = isSolFirst ? new PublicKey(poolInfo.vaultB) : new PublicKey(poolInfo.vaultA);
  const userLpAccount = await getAssociatedTokenAddress(new PublicKey(poolInfo.mintLp), payer.publicKey);

  const [authority] = PublicKey.findProgramAddressSync(
    [Buffer.from(AUTH_SEED)],
    new PublicKey(poolInfo.programId)
  );
  
  const slippageMultiplier = new BN(10000 + slippagePercent.numerator.toNumber() * 10000 / slippagePercent.denominator.toNumber());
  const maxSolAmount = solAmount.mul(slippageMultiplier).div(new BN(10000));
  const maxTokenAmount = tokenAmount.mul(slippageMultiplier).div(new BN(10000));
  const amountMaxA = isSolFirst ? maxSolAmount : maxTokenAmount;
  const amountMaxB = isSolFirst ? maxTokenAmount : maxSolAmount;

  // 添加指令数组
  const instructions = [];

  // 检查并创建 WSOL 账户
  try {
    const wsolAccountInfo = await getAccount(connection, userSolAccount);
    // 检查 WSOL 账户余额是否足够
    if (new BN(wsolAccountInfo.amount.toString()).lt(maxSolAmount)) {
      // WSOL 余额不足，需要包装更多 SOL
      const additionalSolNeeded = maxSolAmount.sub(new BN(wsolAccountInfo.amount.toString()));
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: userSolAccount,
          lamports: additionalSolNeeded.toNumber(),
        }),
        createSyncNativeInstruction(userSolAccount)
      );
    }
  } catch (error) {
    // WSOL 账户不存在，创建账户并包装所需的 SOL
    instructions.push(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        userSolAccount,
        payer.publicKey,
        NATIVE_MINT
      ),
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: userSolAccount,
        lamports: maxSolAmount.toNumber(),
      }),
      createSyncNativeInstruction(userSolAccount)
    );
  }

  // 检查并创建目标代币账户
  try {
    await getAccount(connection, userTokenAccount);
  } catch (error) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        userTokenAccount,
        payer.publicKey,
        mint
      )
    );
  }

  // 检查并创建 LP 代币账户
  try {
    await getAccount(connection, userLpAccount);
  } catch (error) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        userLpAccount,
        payer.publicKey,
        new PublicKey(poolInfo.mintLp)
      )
    );
  }

  let estimatedLpAmount: BN;  
  if (new BN(poolInfo.lpAmount).isZero()) {
    estimatedLpAmount = BN.min(solAmount, tokenAmount);
  } else {
    const poolSolReserve = new BN(poolInfo.baseReserve || '0');
    const totalLpSupply = new BN(poolInfo.lpAmount);
    if (poolSolReserve.gt(new BN(0)) && totalLpSupply.gt(new BN(0))) {
      estimatedLpAmount = solAmount.mul(totalLpSupply).div(poolSolReserve);
    } else {
      estimatedLpAmount = BN.min(solAmount, tokenAmount);
    }
  }
  estimatedLpAmount = estimatedLpAmount.mul(new BN(98)).div(new BN(100));
  
  // 添加计算预算指令
  instructions.push(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 })
  );

  const addLiquidityIx = makeDepositCpmmInInstruction(
    new PublicKey(poolInfo.programId), // programId
    payer.publicKey,                   // owner
    authority,                         // authority
    new PublicKey(poolInfo.poolAddress), // poolId
    userLpAccount,                     // lpTokenAccount
    tokenAccountA,                    // tokenAccountA (SOL)
    tokenAccountB,                  // tokenAccountB (Token)
    vaultA,
    vaultB,
    mintA,
    mintB,
    new PublicKey(poolInfo.mintLp),
    estimatedLpAmount,
    amountMaxA,
    amountMaxB,
  );

  instructions.push(addLiquidityIx);

  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([payer]);

  const sig = await connection.sendTransaction(tx);
  await connection.confirmTransaction(sig, 'confirmed');
  return {
    signature: sig,
    mintAddress: mint,
    tokenAmount: tokenAmount,
    solAmount: solAmount,
    lpTokenAmount: estimatedLpAmount,
    poolAddress: poolInfo.poolAddress,
  };
}
