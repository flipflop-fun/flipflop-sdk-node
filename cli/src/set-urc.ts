import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { cleanTokenName, getMetadataByMint, initProvider, loadKeypairFromBase58, loadKeypairFromFile } from './utils';
import { CODE_ACCOUNT_SEED, CONFIG_DATA_SEED, REFERRAL_CODE_SEED, REFERRAL_SEED, SYSTEM_CONFIG_SEEDS } from './constants';
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { CONFIGS, getNetworkType } from './config';

export async function setUrcCommand(options: any) {
  const rpcUrl = options.rpc;
  const rpc = new Connection(rpcUrl, 'confirmed');
  const urc = options.urc;
  const mintAccount = new PublicKey(options.mint);

  // Validate required parameters
  if (!options.keypairBs58 && !options.keypairFile) {
    console.error('❌ Error: Missing --keypair-bs58 or --keypair-file parameter');
    return;
  }

  try {
    // Load keypair and create wallet (keypair-file takes priority)
    const refAccount = options.keypairFile 
      ? loadKeypairFromFile(options.keypairFile)
      : loadKeypairFromBase58(options.keypairBs58!);

    const { program, provider, programId } = await initProvider(rpc, refAccount);

    const [referralAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(REFERRAL_SEED), mintAccount.toBuffer(), refAccount.publicKey.toBuffer()],
      programId,
    );

    const [systemConfigAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(SYSTEM_CONFIG_SEEDS), (new PublicKey(CONFIGS[getNetworkType(rpcUrl)].systemManagerAccount)).toBuffer()],
      programId
    );

    const [codeHash] = PublicKey.findProgramAddressSync(
      [Buffer.from(REFERRAL_CODE_SEED), Buffer.from(urc)],
      programId,
    );

    const [codeAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(CODE_ACCOUNT_SEED), codeHash.toBuffer()],
      programId,
    );

    const [configAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(CONFIG_DATA_SEED), mintAccount.toBuffer()],
      programId,
    );

    const codeAccountInfo = await provider.connection.getAccountInfo(codeAccount);
    if(codeAccountInfo) {
      const codeAccountData = await program.account.codeAccountData.fetch(codeAccount);
      if (codeAccountData.referralAccount.toBase58() !== referralAccount.toBase58()) {
        console.error('❌ Error: Referral code is already assigned to another account');
        return;
      }
    }

    const referrerAta = await getAssociatedTokenAddress(mintAccount, refAccount.publicKey, false, TOKEN_PROGRAM_ID);
    const referrerAtaInfo = await provider.connection.getAccountInfo(referrerAta);

    const context = {
      mint: mintAccount,
      referralAccount: referralAccount,
      configAccount,
      systemConfigAccount: systemConfigAccount,
      payer: refAccount.publicKey,
      referrerAta: referrerAta,
      codeAccount: codeAccount,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    };
    const tokenMetadata = await getMetadataByMint(rpc, mintAccount);
    if (!tokenMetadata.success) {
      console.error(`❌ Failed to get token metadata: ${tokenMetadata.message}`);
      return;
    }

    console.log('\n🔗 Setting Referral Code');
    console.log('━'.repeat(50));
    console.log(`URC: ${urc}`);
    console.log(`Mint: ${mintAccount.toBase58()}`);
    console.log(`Referrer: ${refAccount.publicKey.toBase58()}`);
    
    const _name = cleanTokenName(tokenMetadata.data.name);
    const _symbol = cleanTokenName(tokenMetadata.data.symbol);
    console.log(`Token Name: ${_name}`);
    console.log(`Token Symbol: ${_symbol}`);
    console.log(`Code hash: ${codeHash.toBase58()}`);
    const instructionSetReferrerCode = await program.methods
      .setReferrerCode(_name, _symbol, codeHash.toBuffer())
      .accounts(context)
      .instruction();
    
    const transaction = new Transaction();
    if(!referrerAtaInfo) {
        transaction.add(createAssociatedTokenAccountInstruction(
          refAccount.publicKey,
          referrerAta,
          refAccount.publicKey,
          mintAccount,
          TOKEN_PROGRAM_ID
        ));
      }

      transaction.add(instructionSetReferrerCode);
      const tx = await provider.sendAndConfirm(transaction, [refAccount]);
      
      console.log('\n✅ Referral Code Set Successfully!');
      console.log('━'.repeat(50));
      console.log(`Transaction Hash: ${tx}`);

    const data = await program.account.tokenReferralData.fetch(referralAccount);
    
    console.log('\n📊 Referral Account Details');
    console.log('━'.repeat(50));
    console.log(`Referrer Address: ${refAccount.publicKey.toBase58()}`);
    console.log(`Referrer Token Account: ${data.referrerAta.toBase58()}`);
    console.log(`Code Hash: ${data.codeHash.toBase58()}`);
    console.log(`Usage Count: ${data.usageCount}`);
    
    // Format and display activation timestamp
    const activationDate = new Date(parseInt(data.activeTimestamp.toString()) * 1000);
    console.log(`Activated: ${activationDate.toLocaleString()}`);

    // Validation checks
    if (data.codeHash.toBase58() !== codeHash.toBase58()) {
      console.error('\n⚠️  Warning: Code hash mismatch detected');
    }

    const codeAccountData = await program.account.codeAccountData.fetch(codeAccount);
    if (codeAccountData.referralAccount.toBase58() !== referralAccount.toBase58()) {
      console.error('⚠️  Warning: Referral account mismatch detected');
    }
    
    if (data.codeHash.toBase58() === codeHash.toBase58() && 
        codeAccountData.referralAccount.toBase58() === referralAccount.toBase58()) {
      console.log('\n✅ All validations passed - URC is properly configured');
    }
    
  } catch (error) {
    console.error('❌ Error setting referral code:', error instanceof Error ? error.message : 'Unknown error');
  }
}

