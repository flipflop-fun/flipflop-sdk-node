import { Connection, Keypair, PublicKey, VersionedTransaction, TransactionMessage, AddressLookupTableAccount, ComputeBudgetProgram, Transaction, AddressLookupTableProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';
import bs58 from 'bs58';
import { AnchorProvider, BN, Program, Provider, Wallet } from '@coral-xyz/anchor';
import { FairMintToken } from './types/fair_mint_token';
import { ASSOCIATED_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/utils/token';
import { ConfigAccountData, MintTokenResponse, ProviderAndProgram, ReferralAccountData, RemainingAccount } from './types';
import { getAssociatedTokenAddress, getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount, NATIVE_MINT, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { CODE_ACCOUNT_SEED, METADATA_SEED, ORACLE_SEED, POOL_AUTH_SEED, POOL_LPMINT_SEED, POOL_SEED, POOL_VAULT_SEED, REFERRAL_CODE_SEED, REFUND_SEEDS, RENT_PROGRAM_ID, TOKEN_METADATA_PROGRAM_ID } from './constants';
import { SYSTEM_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/native/system';
import { CONFIGS, getNetworkType } from './config';
import sleep from 'sleep-promise';

export const initProvider = async (rpc: Connection, account: Keypair): Promise<ProviderAndProgram> => {
    const wallet = {
    publicKey: account.publicKey,
    signTransaction: async (tx: Transaction) => {
      tx.sign(account);
      return tx;
    },
    signAllTransactions: async (txs: Transaction[]) => {
      txs.forEach(tx => tx.sign(account));
      return txs;
    }
  };
  
  const provider = new AnchorProvider(rpc, wallet as Wallet, {
    commitment: 'confirmed',
  });
  
  try {
    const networkType = getNetworkType(rpc.rpcEndpoint);
    const idlModule = await import(`./idl/fair_mint_token_${networkType}.json`);
    const idl = idlModule.default || idlModule;
    const program = new Program(idl, provider) as Program<FairMintToken>;

    const config = CONFIGS[getNetworkType(rpc.rpcEndpoint)];
    const programId = new PublicKey(config.programId);
    
    return {
      program,
      provider,
      programId,
    }
  } catch (error) {
    throw new Error(`Failed to load IDL for network ${getNetworkType(rpc.rpcEndpoint)}: ${error}`);
  }
}

export const initProviderNoSigner = async (rpc: Connection): Promise<ProviderAndProgram> => {
    const wallet = {
    publicKey: PublicKey.default,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs,
  };
  
  const provider = new AnchorProvider(rpc, wallet as Wallet, {
    commitment: 'confirmed',
  });
  
  try {
    const networkType = getNetworkType(rpc.rpcEndpoint);
    const idlModule = await import(`./idl/fair_mint_token_${networkType}.json`);
    const idl = idlModule.default || idlModule;
    const program = new Program(idl, provider) as Program<FairMintToken>;
      
    const config = CONFIGS[getNetworkType(rpc.rpcEndpoint)];
    const programId = new PublicKey(config.programId);

    return {
      program,
      provider,
      programId,
    }
  } catch (error) {
    throw new Error(`Failed to load IDL for network ${getNetworkType(rpc.rpcEndpoint)}: ${error}`);
  }
}

export const getTokenBalance = async (publicKey: PublicKey, connection: Connection): Promise<number> => {
  const balance = await connection.getTokenAccountBalance(publicKey);
  return balance.value.uiAmount as number;
}

// Load keypair from file (supports .pri or JSON format)
export const loadKeypairFromFile = (filePath: string): Keypair => {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const secretKeyArray = JSON.parse(fileContent);
    
    if (!Array.isArray(secretKeyArray)) {
      throw new Error('Private key file must contain an array of numbers');
    }
    
    if (secretKeyArray.length !== 64) {
      throw new Error('Private key array must contain exactly 64 numbers');
    }
    
    const secretKey = new Uint8Array(secretKeyArray);
    return Keypair.fromSecretKey(secretKey);
  } catch (error: any) {
    throw new Error(`Failed to load keypair from file ${filePath}: ${error.message}`);
  }
};

// Check if an account exists on-chain
export const checkAccountExists = async (rpc: Connection, account: PublicKey): Promise<boolean> => {
  const info = await rpc.getAccountInfo(account);
  return info !== null;
}

// Get SOL balance
export const getSolanaBalance = async (rpc: Connection, account: PublicKey): Promise<number> => {
  return await rpc.getBalance(account);
}

// Utility to load single keypair from base58 string
export const loadKeypairFromBase58 = (base58Key: string): Keypair => {
  const secretKey = bs58.decode(base58Key.trim());
  return Keypair.fromSecretKey(secretKey);
}

export const cleanTokenName = (str: string): string => {
  return str.replace(/\x00/g, '').trim();
}

export const parseConfigData = async (program: Program<FairMintToken> , configAccount: PublicKey): Promise<ConfigAccountData> => {
  return new Promise((resolve, reject) => {
    program.account.tokenConfigData.fetch(configAccount).then((configData) => {
      try {
        resolve({
          admin: configData.admin,
          // feeVault: configData.feeVault.toBase58(),
          feeRate: new BN(configData.feeRate).div(new BN("1000000000")).toNumber(),
          maxSupply: new BN(configData.maxSupply).div(new BN("1000000000")).toNumber(),
          targetEras: configData.targetEras,
          initialMintSize: new BN(configData.initialMintSize).div(new BN("1000000000")).toNumber(),
          epochesPerEra: new BN(configData.epochesPerEra).toNumber(),
          targetSecondsPerEpoch: new BN(configData.targetSecondsPerEpoch).toNumber(),
          reduceRatio: configData.reduceRatio,
          tokenVault: configData.tokenVault,
          liquidityTokensRatio: configData.liquidityTokensRatio,
          supply: new BN(configData.mintStateData.supply).div(new BN("1000000000")).toNumber(),
          currentEra: configData.mintStateData.currentEra,
          currentEpoch: configData.mintStateData.currentEpoch.toNumber(),
          elapsedSecondsEpoch: configData.mintStateData.elapsedSecondsEpoch.toNumber(),
          startTimestampEpoch: configData.mintStateData.startTimestampEpoch.toNumber(),
          difficultyCoefficient: configData.mintStateData.difficultyCoefficientEpoch,
          lastDifficultyCoefficient: configData.mintStateData.lastDifficultyCoefficientEpoch,
          mintSizeEpoch: new BN(configData.mintStateData.mintSizeEpoch).div(new BN("1000000000")).toNumber(),
          quantityMintedEpoch: new BN(configData.mintStateData.quantityMintedEpoch).div(new BN("1000000000")).toNumber(),
          targetMintSizeEpoch: new BN(configData.mintStateData.targetMintSizeEpoch).div(new BN("1000000000")).toNumber(),
          graduateEpoch: configData.mintStateData.graduateEpoch,
        });
      } catch (error) {
        console.log(error);
        reject(error);
      }
    })
  })
}

export const getLegacyTokenMetadata = async (connection: Connection, metadataAccountPda: PublicKey, debug: boolean = false): Promise<any> => {
  try {
    const metadataAccountInfo = await connection.getAccountInfo(metadataAccountPda);
    if (!metadataAccountInfo) {
      throw new Error('Metadata account not found');
    }

    const data = metadataAccountInfo.data;
    
    // Parse key (1 byte)
    const key = data[0];
    
    // Parse update authority (32 bytes)
    const updateAuthority = new PublicKey(data.slice(1, 33));
    
    // Parse mint (32 bytes)
    const mint = new PublicKey(data.slice(33, 65));
    
    // Parse name
    const nameLength = data.readUInt32LE(65);
    let currentPos = 69;
    const name = data.slice(currentPos, currentPos + nameLength).toString('utf8');
    currentPos += nameLength;
    
    // Parse symbol
    const symbolLength = data.readUInt32LE(currentPos);
    currentPos += 4;
    const symbol = data.slice(currentPos, currentPos + symbolLength).toString('utf8');
    currentPos += symbolLength;
    
    // Parse uri
    const uriLength = data.readUInt32LE(currentPos);
    currentPos += 4;
    const uri = data.slice(currentPos, currentPos + uriLength).toString('utf8');
    currentPos += uriLength;
    
    // Parse seller fee basis points (2 bytes)
    const sellerFeeBasisPoints = data.readUInt16LE(currentPos);
    currentPos += 2;
    
    // Parse creators
    const hasCreators = data[currentPos];
    currentPos += 1;
    
    let creators = [];
    if (hasCreators) {
      const creatorsLength = data.readUInt32LE(currentPos);
      currentPos += 4;
      for (let i = 0; i < creatorsLength; i++) {
        const creatorAddress = new PublicKey(data.slice(currentPos, currentPos + 32));
        currentPos += 32;
        const verified = data[currentPos] === 1;
        currentPos += 1;
        const share = data[currentPos];
        currentPos += 1;
        creators.push({ address: creatorAddress, verified, share });
      }
    }
    
    // Parse collection
    const hasCollection = data[currentPos];
    currentPos += 1;
    let collection = null;
    if (hasCollection) {
      const collectionKey = new PublicKey(data.slice(currentPos, currentPos + 32));
      currentPos += 32;
      const verified = data[currentPos] === 1;
      currentPos += 1;
      collection = { key: collectionKey, verified };
    }
        
    // Finally, parse isMutable
    const isMutable = data[currentPos] === 1;
    
    // Log the parsed metadata
    const result = {
      success: true,
      key,
      updateAuthority: updateAuthority.toBase58(),
      mint: mint.toBase58(),
      data: {
        name,
        symbol,
        uri,
        sellerFeeBasisPoints,
        creators: creators.map(c => ({
          address: c.address.toBase58(),
          verified: c.verified,
          share: c.share
        })),
      },
      isMutable,
      collection: collection ? {
        key: collection.key.toBase58(),
        verified: collection.verified
      } : null,
    };
    if (debug) console.log('Parsed Metadata:', result);
    return result;
  } catch (error: any) {
    console.error('Error fetching metadata:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

export const mintBy = async (
  provider: Provider,
  program: Program<FairMintToken>,
  mintAccount: PublicKey,
  configAccount: PublicKey,
  referralAccount: PublicKey,
  referrerMain: PublicKey,
  tokenMetadata: { name: string, symbol: string },
  codeHash: PublicKey,
  account: Keypair,
  systemConfigAccount: PublicKey,
  connection: Connection,
  lookupTableAddress: PublicKey,
  protocolFeeAccount: PublicKey,
): Promise<MintTokenResponse> => {
  // check balance SOL
  let balance = await getSolanaBalance(connection, account.publicKey);
  if (balance == 0) {
    return {
      success: false,
      message: "Balance not enough",
    }
  }

  const destination = await getOrCreateAssociatedTokenAccount(
    connection,
    account,
    mintAccount,
    account.publicKey,
    false,
    undefined,
    undefined,
    TOKEN_PROGRAM_ID
  );

  const mintTokenVaultAta = await getAssociatedTokenAddress(
    mintAccount,
    mintAccount,
    true,
    TOKEN_PROGRAM_ID
  );

  const tokenVaultAta = await getAssociatedTokenAddress(
    mintAccount,
    configAccount,
    true,
    TOKEN_PROGRAM_ID
  );

  const referrerAta = await getAssociatedTokenAddress(
    mintAccount,
    referrerMain,
    false,
    TOKEN_PROGRAM_ID
  );

  const programId = new PublicKey(CONFIGS[getNetworkType(connection.rpcEndpoint)].programId);
  const [refundAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from(REFUND_SEEDS), mintAccount.toBuffer(), account.publicKey.toBuffer()],
    programId,
  );

  const accountInfo = await connection.getAccountInfo(referrerAta);
  if (accountInfo === null) {
    return {
      success: false,
      message: "Referrer ata not exist",
    }
  }

  const beforeBalance = (await connection.getTokenAccountBalance(destination.address)).value.uiAmount;

  const codeHashInReferralAccount = await program.account.tokenReferralData.fetch(referralAccount);
  if (codeHashInReferralAccount.codeHash.toBase58() !== codeHash.toBase58()) {
    return {
      success: false,
      message: "Code hash not match",
    }
  }

  const protocolWsolVault = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    account,
    NATIVE_MINT,
    protocolFeeAccount,
    false,
    undefined,
    undefined,
    TOKEN_PROGRAM_ID
  )

  const wsolVaultAta = await getAssociatedTokenAddress(NATIVE_MINT, configAccount, true, TOKEN_PROGRAM_ID);
  const destinationWsolAta = await getAssociatedTokenAddress(NATIVE_MINT, account.publicKey, false, TOKEN_PROGRAM_ID);

  let token0Mint = mintAccount;
  let token1Mint = NATIVE_MINT;
  let token0Program = TOKEN_PROGRAM_ID;
  let token1Program = TOKEN_PROGRAM_ID;
  if(compareMints(token0Mint, token1Mint) > 0) {
    [token0Mint, token1Mint] = [token1Mint, token0Mint];
    [token0Program, token1Program] = [token1Program, token0Program];
  }
  const rpcUrl = connection.rpcEndpoint;
  const network = getNetworkType(rpcUrl);
  const cpSwapProgram = new PublicKey(CONFIGS[network].cpSwapProgram);
  const cpSwapConfigAddress = new PublicKey(CONFIGS[network].cpSwapConfigAddress);
  const createPoolFeeReceive = new PublicKey(CONFIGS[network].createPoolFeeReceive);

  const [authority] = getAuthAddress(cpSwapProgram);
  const [poolAddress] = getPoolAddress(cpSwapConfigAddress, token0Mint, token1Mint, cpSwapProgram);
  const [lpMintAddress] = getPoolLpMintAddress(poolAddress, cpSwapProgram);
  const [vault0] = getPoolVaultAddress(poolAddress, token0Mint, cpSwapProgram);
  const [vault1] = getPoolVaultAddress(poolAddress, token1Mint, cpSwapProgram);
  const [observationAddress] = getOrcleAccountAddress(poolAddress, cpSwapProgram);

  const creatorLpTokenAddress = getAssociatedTokenAddressSync(lpMintAddress, account.publicKey, false, TOKEN_PROGRAM_ID);
  const creatorToken0 = getAssociatedTokenAddressSync(token0Mint, account.publicKey, false, token0Program);
  const creatorToken1 = getAssociatedTokenAddressSync(token1Mint, account.publicKey, false, token1Program);

  const context = {
    mint: mintAccount,
    destination: destination.address,
    destinationWsolAta: destinationWsolAta,
    refundAccount: refundAccount,
    user: account.publicKey,
    configAccount: configAccount,
    systemConfigAccount: systemConfigAccount,
    mintTokenVault: mintTokenVaultAta,
    tokenVault: tokenVaultAta,
    wsolVault: wsolVaultAta,
    wsolMint: NATIVE_MINT,
    referrerAta: referrerAta,
    referrerMain: referrerMain,
    referralAccount: referralAccount,
    protocolFeeAccount,
    protocolWsolVault: protocolWsolVault.address,
    poolState: poolAddress,
    ammConfig: cpSwapConfigAddress,
    cpSwapProgram: cpSwapProgram,
    token0Mint: token0Mint,
    token1Mint: token1Mint,
  };

  // console.log("mint token data", Object.fromEntries(
  //   Object.entries(context).map(([key, value]) => [key, value.toString()])
  // ));

  // =============== Use RemainingAccounts for initializing pool accounts, total 21 accounts ===============
  const remainingAccounts: RemainingAccount[] = [{
    pubkey: cpSwapProgram, // <- 1
    isWritable: false,
    isSigner: false,
  }, {
    pubkey: account.publicKey, // <- 2
    isWritable: true,
    isSigner: true,
  }, {
    pubkey: cpSwapConfigAddress, // <- 3
    isWritable: true,
    isSigner: false,
  }, {
    pubkey: authority, // <- 4
    isWritable: true,
    isSigner: false,
  }, {
    pubkey: poolAddress, // <- 5
    isWritable: true,
    isSigner: false,
  }, {
    pubkey: token0Mint, // <- 6
    isWritable: true,
    isSigner: false,
  }, {
    pubkey: token1Mint, // <- 7
    isWritable: true,
    isSigner: false,
  }, {
    pubkey: lpMintAddress, // <- 8
    isWritable: true,
    isSigner: false,
  }, {
    pubkey: creatorToken0, // <- 9
    isWritable: true,
    isSigner: false,
  }, {
    pubkey: creatorToken1, // <- 10
    isWritable: true,
    isSigner: false,
  }, {
    pubkey: creatorLpTokenAddress, // <- 11
    isWritable: true,
    isSigner: false,
  }, {
    pubkey: vault0, // <- 12
    isWritable: true,
    isSigner: false,
  }, {
    pubkey: vault1, // <- 13
    isWritable: true,
    isSigner: false,
  }, {
    pubkey: createPoolFeeReceive, // <- 14
    isWritable: true,
    isSigner: false,
  }, {
    pubkey: observationAddress, // <- 15
    isWritable: true,
    isSigner: false,
  }, {
    pubkey: TOKEN_PROGRAM_ID, // <- 16
    isWritable: true,
    isSigner: false,
  }, {
    pubkey: token0Program, // <- 17
    isWritable: true,
    isSigner: false,
  }, {
    pubkey: token1Program, // <- 18
    isWritable: true,
    isSigner: false,
  }, {
    pubkey: ASSOCIATED_PROGRAM_ID, // <- 19
    isWritable: true,
    isSigner: false,
  }, {
    pubkey: SYSTEM_PROGRAM_ID, // <- 20
    isWritable: true,
    isSigner: false,
  }, {
    pubkey: RENT_PROGRAM_ID, // <- 21
    isWritable: true,
    isSigner: false,
  }];
  // ===================================================================================
  try {
    const ix0 = ComputeBudgetProgram.setComputeUnitLimit({ units: 500000 }); // or use --compute-unit-limit 400000 to run solana-test-validator

    const ix = await program.methods
      .mintTokens(tokenMetadata.name, tokenMetadata.symbol, codeHash.toBuffer())
      .accounts(context)
      .remainingAccounts(remainingAccounts)
      .instruction();

    // Create versioned transaction with LUT
    const accountInfo = await connection.getAccountInfo(lookupTableAddress);
    const lookupTable = new AddressLookupTableAccount({
      key: lookupTableAddress,
      state: AddressLookupTableAccount.deserialize(accountInfo!.data),
    });

    const messageV0 = new VersionedTransaction(
      new TransactionMessage({
        payerKey: account.publicKey,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [ix0, ix],
      }).compileToV0Message([lookupTable])
    );
    const result = await processVersionedTransaction(messageV0, connection, account, 'confirmed');

    return {
      success: true,
      message: "Mint succeeded",
      data: {
        owner: account.publicKey,
        tokenAccount: destination.address,
        tx: result.data?.tx || '',
      },
    };
  } catch (e) {
    console.log(e);
    return {
      success: false,
      message: `Mint failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }
}

export const processVersionedTransaction = async (
  messageV0: VersionedTransaction,
  connection: Connection,
  wallet: Keypair,
  confirmLevel: 'processed' | 'confirmed' | 'finalized' = 'confirmed'
) => {
  messageV0.sign([wallet]);
  const signature = await connection.sendTransaction(messageV0, {
      skipPreflight: false,
      }
  );
  const latestBlockhash = await connection.getLatestBlockhash();

  const status = await connection.confirmTransaction({
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  }, confirmLevel);

  if(status.value.err) {
      return {
          success: false,
          message: `Mint failed: ${JSON.stringify(status.value.err)}`,
      }
  }

  return {
      success: true,
      message: `Mint succeeded`,
      data: {
          tx: signature,
      }
  }
}

export const compareMints = (mintA: PublicKey, mintB: PublicKey): number => {
  const bufferA = mintA.toBuffer();
  const bufferB = mintB.toBuffer();
  
  for (let i = 0; i < bufferA.length; i++) {
    if (bufferA[i] !== bufferB[i]) {
      return bufferA[i] - bufferB[i];
    }
  }
  return 0;
}

export const getAuthAddress = (
  programId: PublicKey
): [PublicKey, number] => {
  const [address, bump] = PublicKey.findProgramAddressSync(
    [POOL_AUTH_SEED],
    programId
  );
  return [address, bump];
}

export const getPoolAddress = (
  ammConfig: PublicKey,
  tokenMint0: PublicKey,
  tokenMint1: PublicKey,
  programId: PublicKey
): [PublicKey, number] => {
  const [address, bump] = PublicKey.findProgramAddressSync(
    [
      POOL_SEED,
      ammConfig.toBuffer(),
      tokenMint0.toBuffer(),
      tokenMint1.toBuffer(),
    ],
    programId
  );
  return [address, bump];
}

export const getPoolVaultAddress = (pool: PublicKey, vaultTokenMint: PublicKey, programId: PublicKey): [PublicKey, number] => {
  const [address, bump] = PublicKey.findProgramAddressSync(
    [POOL_VAULT_SEED, pool.toBuffer(), vaultTokenMint.toBuffer()],
    programId
  );
  return [address, bump];
}

export const getPoolLpMintAddress = (pool: PublicKey, programId: PublicKey): [PublicKey, number] => {
  const [address, bump] = PublicKey.findProgramAddressSync(
    [POOL_LPMINT_SEED, pool.toBuffer()],
    programId
  );
  return [address, bump];
}

export const getOrcleAccountAddress = (pool: PublicKey, programId: PublicKey): [PublicKey, number] => {
  const [address, bump] = PublicKey.findProgramAddressSync(
    [ORACLE_SEED, pool.toBuffer()],
    programId
  );
  return [address, bump];
}

export const getMetadataByMint = async (rpc: Connection, mintAccount: PublicKey) => {
  const [metadataAccountPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(METADATA_SEED),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mintAccount.toBuffer()
    ],
    TOKEN_METADATA_PROGRAM_ID,
  );
  return await getLegacyTokenMetadata(rpc, metadataAccountPda);
}

export const getReferralDataByCodeHash = async (
  connection: Connection,
  program: Program<FairMintToken>,
  codeHash: PublicKey
): Promise<any> => {
  const programId = new PublicKey(CONFIGS[getNetworkType(connection.rpcEndpoint)].programId);
  const [codeAccountPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(CODE_ACCOUNT_SEED), codeHash.toBuffer()],
    programId,
  );
  const codeAccountInfo = await connection.getAccountInfo(codeAccountPda);
  if (!codeAccountInfo) {
    return {
      success: false,
      message: 'Code account does not exist'
    }
  }
  const codeAccountData = await program.account.codeAccountData.fetch(codeAccountPda);
  const referralAccountPda = codeAccountData.referralAccount;

  const referralAccountInfo = await connection.getAccountInfo(referralAccountPda);
  if (!referralAccountInfo) {
    return {
      success: false,
      message: 'Referral account does not exist'
    }
  }
  const referralAccountData = await program.account.tokenReferralData.fetch(referralAccountPda);
  return {
    success: true,
    data: {
      ...referralAccountData,
      referralAccount: referralAccountPda,
    }
  }
}

export const getURCDetails = async (connection: Connection, program: Program<FairMintToken>, urcCode: string): Promise<ReferralAccountData> => {
  const programId = new PublicKey(CONFIGS[getNetworkType(connection.rpcEndpoint)].programId);
  const [codeHash] = PublicKey.findProgramAddressSync(
    [Buffer.from(REFERRAL_CODE_SEED), Buffer.from(urcCode)],
    programId,
  );
  const _referralData = await getReferralDataByCodeHash(connection, program, codeHash);
  if (!_referralData.success) {
    throw new Error('Fail to get URC data, please use another one.');
  }
  return _referralData.data;
}

export const createAddressLookupTable = async (
  connection: Connection,
  payer: Keypair,
  addresses: PublicKey[]
) => {
  const slot = await connection.getSlot("finalized"); // not "confirmed"
  
  // Create instruction for Address Lookup Table
  const [createIx, lutAddress] = AddressLookupTableProgram.createLookupTable({
    authority: payer.publicKey,
    payer: payer.publicKey,
    recentSlot: slot,
  });

  // Create instruction to extend Address Lookup Table
  const extendIx = AddressLookupTableProgram.extendLookupTable({
    payer: payer.publicKey,
    authority: payer.publicKey,
    lookupTable: lutAddress,
    addresses,
  });
  
  // Create and send transaction
  const tx = new Transaction()
    .add(createIx)
    .add(extendIx);

  tx.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
  tx.feePayer = payer.publicKey;
  
  await sendAndConfirmTransaction(connection, tx, [payer]);

  // Wait for confirmation and fetch the table
  await sleep(1000);
  const accountInfo = await connection.getAccountInfo(lutAddress);
  return new AddressLookupTableAccount({
    key: lutAddress,
    state: AddressLookupTableAccount.deserialize(accountInfo!.data),
  });
}

export const createLookupTable = async (
  connection: Connection,
  payer: Keypair,
) => {
  const rpc = connection.rpcEndpoint;
  const network = getNetworkType(rpc);
  const addresses: PublicKey[] = [
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
    SYSTEM_PROGRAM_ID,
    RENT_PROGRAM_ID,
    ASSOCIATED_PROGRAM_ID,
    NATIVE_MINT,
    new PublicKey(CONFIGS[network].cpSwapProgram),
    new PublicKey(CONFIGS[network].cpSwapConfigAddress),
    new PublicKey(CONFIGS[network].createPoolFeeReceive),
  ];

  // 2. Create LUT
  const lookupTable = await createAddressLookupTable(connection, payer, addresses);
  
  // 3. Wait for LUT activation (must wait at least 1 slot)
  await sleep(1000);
  
  return lookupTable;
}
