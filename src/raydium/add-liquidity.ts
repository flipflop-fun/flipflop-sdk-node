import {
  Connection,
  PublicKey,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  Raydium,
  Percent,
  makeDepositCpmmInInstruction,
} from "@raydium-io/raydium-sdk-v2";
import {
  AccountLayout,
  getAssociatedTokenAddress,
  NATIVE_MINT,
  createAssociatedTokenAccountInstruction,
  getAccount,
  createSyncNativeInstruction,
} from "@solana/spl-token";
import { CONFIGS, getNetworkType } from "../config";
import BN from "bn.js";
import { getPoolInfoByRpc } from "./display-pool";
import { compareMints } from "../utils";
import { AUTH_SEED } from "../constants";
import {
  AddLiquidityOptions,
  AddLiquidityResponse,
  DisplayPoolResponse,
  ApiResponse,
} from "./types";

export const addLiquidity = async (
  options: AddLiquidityOptions
): Promise<ApiResponse<AddLiquidityResponse>> => {
  // Validate required parameters
  if (!options.rpc) {
    return {
      success: false,
      message: "Missing rpc parameter",
    };
  }

  if (!options.mint) {
    return {
      success: false,
      message: "Missing mint parameter",
    };
  }

  if (!options.tokenAmount || options.tokenAmount <= 0) {
    return {
      success: false,
      message: "Invalid tokenAmount parameter",
    };
  }

  if (options.slippage === undefined || options.slippage < 0) {
    return {
      success: false,
      message: "Invalid slippage parameter",
    };
  }

  if (!options.payer) {
    return {
      success: false,
      message: "Missing provider parameter",
    };
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
      disableLoadToken: true,
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
      return {
        success: false,
        message: `No token account found for mint ${options.mint}`,
      };
    }

    // Parse token account data
    const tokenAccountInfo = AccountLayout.decode(
      tokenAccounts.value[0].account.data
    );

    const availableTokenBalance = new BN(tokenAccountInfo.amount.toString())
      .div(new BN(LAMPORTS_PER_SOL))
      .toNumber();

    if (availableTokenBalance < options.tokenAmount) {
      return {
        success: false,
        message: `Insufficient token balance. Available: ${availableTokenBalance}, Required: ${options.tokenAmount}`,
      };
    }

    // Fallback to mint-based discovery using API
    const poolInfo = await getPoolInfoByRpc(
      raydium,
      NATIVE_MINT,
      options.mint,
      options.rpc
    );

    if (!poolInfo) {
      return {
        success: false,
        message: `No CPMM pool found for token ${options.mint}. You can specify poolAddress parameter to use a specific pool.`,
      };
    }

    if (!poolInfo.success) {
      return {
        success: false,
        message: poolInfo.message || "Unknown error",
      };
    }

    const poolInfoData = poolInfo.data as DisplayPoolResponse;
    // Calculate required SOL amount based on pool ratio
    const tokenAmountBN = new BN(options.tokenAmount).mul(
      new BN(LAMPORTS_PER_SOL)
    );
    // Ensure we have valid reserve values
    const mintAmountA = String(poolInfoData.baseReserve || "0");
    const mintAmountB = String(poolInfoData.quoteReserve || "0");

    const cleanMintAmountA = mintAmountA.replace(/[^0-9]/g, "") || "1000000000";
    const cleanMintAmountB = mintAmountB.replace(/[^0-9]/g, "") || "1000000000";

    // Determine token and SOL reserves based on which mint is which
    let tokenReserve: BN;
    let solReserve: BN;

    const tokenMint = new PublicKey(options.mint);

    if (poolInfoData.mintA.equals(tokenMint)) {
      tokenReserve = new BN(cleanMintAmountA);
      solReserve = new BN(cleanMintAmountB);
    } else {
      tokenReserve = new BN(cleanMintAmountB);
      solReserve = new BN(cleanMintAmountA);
    }

    // Handle zero reserves
    if (tokenReserve.isZero()) {
      return {
        success: false,
        message: "Cannot calculate SOL amount: token reserve is zero",
      };
    }

    // Calculate required SOL amount
    const requiredSolAmountBN = tokenAmountBN.mul(solReserve).div(tokenReserve);

    // Check SOL balance
    const solBalance = await connection.getBalance(options.payer.publicKey);
    // console.log("SOL balance:", solBalance / 1e9);
    // console.log("Required SOL:", requiredSolAmount);

    if (solBalance < requiredSolAmountBN.toNumber()) {
      return {
        success: false,
        message: `Insufficient SOL balance. Available: ${
          solBalance / 1e9
        }, Required: ${requiredSolAmountBN.toNumber() / 1e9}`,
      };
    }

    // Create slippage percentage
    const slippagePercent = new Percent(options.slippage, 100);
    const result = await doAddLiquidityInstruction(
      connection,
      poolInfoData,
      new PublicKey(options.mint),
      requiredSolAmountBN,
      tokenAmountBN,
      options.payer,
      slippagePercent
    );

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to add liquidity: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
};

async function doAddLiquidityInstruction(
  connection: Connection,
  poolInfo: DisplayPoolResponse,
  mint: PublicKey,
  solAmount: BN,
  tokenAmount: BN,
  payer: Keypair,
  slippagePercent: Percent
) {
  const [mint0, mint1] =
    compareMints(NATIVE_MINT, mint) < 0
      ? [NATIVE_MINT, mint]
      : [mint, NATIVE_MINT];
  const isSolFirst = mint0.equals(NATIVE_MINT);

  const userSolAccount = await getAssociatedTokenAddress(
    NATIVE_MINT,
    payer.publicKey
  );
  const userTokenAccount = await getAssociatedTokenAddress(
    mint,
    payer.publicKey
  );
  const mintA = mint0;
  const mintB = mint1;
  const tokenAccountA = isSolFirst ? userSolAccount : userTokenAccount;
  const tokenAccountB = isSolFirst ? userTokenAccount : userSolAccount;
  const vaultA = isSolFirst
    ? new PublicKey(poolInfo.vaultA)
    : new PublicKey(poolInfo.vaultB);
  const vaultB = isSolFirst
    ? new PublicKey(poolInfo.vaultB)
    : new PublicKey(poolInfo.vaultA);
  const userLpAccount = await getAssociatedTokenAddress(
    new PublicKey(poolInfo.mintLp),
    payer.publicKey
  );

  const [authority] = PublicKey.findProgramAddressSync(
    [Buffer.from(AUTH_SEED)],
    new PublicKey(poolInfo.programId)
  );

  const slippageMultiplier = new BN(
    10000 +
      (slippagePercent.numerator.toNumber() * 10000) /
        slippagePercent.denominator.toNumber()
  );
  const maxSolAmount = solAmount.mul(slippageMultiplier).div(new BN(10000));
  const maxTokenAmount = tokenAmount.mul(slippageMultiplier).div(new BN(10000));
  const amountMaxA = isSolFirst ? maxSolAmount : maxTokenAmount;
  const amountMaxB = isSolFirst ? maxTokenAmount : maxSolAmount;

  // Add instructions array
  const instructions = [];

  // Check and create WSOL account
  try {
    const wsolAccountInfo = await getAccount(connection, userSolAccount);
    // Check if WSOL account balance is sufficient
    if (new BN(wsolAccountInfo.amount.toString()).lt(maxSolAmount)) {
      // WSOL balance insufficient, need to wrap more SOL
      const additionalSolNeeded = maxSolAmount.sub(
        new BN(wsolAccountInfo.amount.toString())
      );
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
    // WSOL account does not exist, create account and wrap required SOL
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

  // Check and create target token account
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

  // Check and create LP token account
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
    const poolSolReserve = new BN(poolInfo.baseReserve || "0");
    const totalLpSupply = new BN(poolInfo.lpAmount);
    if (poolSolReserve.gt(new BN(0)) && totalLpSupply.gt(new BN(0))) {
      estimatedLpAmount = solAmount.mul(totalLpSupply).div(poolSolReserve);
    } else {
      estimatedLpAmount = BN.min(solAmount, tokenAmount);
    }
  }
  // estimatedLpAmount = estimatedLpAmount.mul(new BN(98)).div(new BN(100));

  // Add compute budget instructions
  instructions.push(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 })
  );

  const addLiquidityIx = makeDepositCpmmInInstruction(
    new PublicKey(poolInfo.programId), // programId
    payer.publicKey, // owner
    authority, // authority
    new PublicKey(poolInfo.poolAddress), // poolId
    userLpAccount, // lpTokenAccount
    tokenAccountA, // tokenAccountA (SOL)
    tokenAccountB, // tokenAccountB (Token)
    vaultA,
    vaultB,
    mintA,
    mintB,
    new PublicKey(poolInfo.mintLp),
    estimatedLpAmount,
    amountMaxA,
    amountMaxB
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
  await connection.confirmTransaction(sig, "confirmed");
  return {
    signature: sig,
    mintAddress: mint,
    tokenAmount: tokenAmount,
    solAmount: solAmount,
    lpTokenAmount: estimatedLpAmount,
    poolAddress: poolInfo.poolAddress,
  };
}
