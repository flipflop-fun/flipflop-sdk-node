import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { FairMintToken } from '../types/fair_mint_token';
import { SDKConfig, LaunchOptions, MintOptions, SetURCOptions, TokenInfo, URCInfo } from './types';
import { initProvider, initProviderNoSigner } from './utils';
import { launchToken, setURCCode, mintTokens, getTokenDetails, getURCDetails } from './methods';
import { CONFIGS } from './config';

export class FlipFlopSDK {
  private connection: Connection;
  private keypair?: Keypair;
  private network: string;
  private _program?: Program<FairMintToken>;
  private _provider?: any;

  constructor(config: SDKConfig) {
    this.connection = new Connection(config.rpcUrl);
    this.keypair = config.keypair;
    this.network = config.network;
  }

  async initialize(): Promise<void> {
    if (this.keypair) {
      const { program, provider } = await initProvider(this.connection, this.keypair);
      this._program = program;
      this._provider = provider;
    } else {
      const { program, provider } = await initProviderNoSigner(this.connection);
      this._program = program;
      this._provider = provider;
    }
  }

  get program(): Program<FairMintToken> {
    if (!this._program) {
      throw new Error('SDK not initialized. Call initialize() first.');
    }
    return this._program;
  }

  get provider(): any {
    if (!this._provider) {
      throw new Error('SDK not initialized. Call initialize() first.');
    }
    return this._provider;
  }

  get sdkConnection(): Connection {
    return this.connection;
  }

  get config() {
    return CONFIGS[this.network as keyof typeof CONFIGS];
  }

  async launchToken(options: LaunchOptions): Promise<{ mint: string; tx: string }> {
    if (!this.keypair) {
      throw new Error('Keypair required for launching tokens');
    }
    return launchToken(this.connection, this.program, this.keypair, options);
  }

  async setURC(options: SetURCOptions): Promise<{ tx: string }> {
    if (!this.keypair) {
      throw new Error('Keypair required for setting URC');
    }
    return setURCCode(this.connection, this.program, this.keypair, options);
  }

  async mintTokens(options: MintOptions): Promise<{ tokenAccount: string; tx: string }> {
    if (!this.keypair) {
      throw new Error('Keypair required for minting tokens');
    }
    return mintTokens(this.connection, this.program, this.keypair, options);
  }

  async getTokenInfo(mint: string): Promise<TokenInfo> {
    return getTokenDetails(this.connection, this.program, new PublicKey(mint));
  }

  async getURCInfo(urcCode: string): Promise<URCInfo> {
    return getURCDetails(this.connection, this.program, urcCode);
  }

  async getBalance(publicKey: PublicKey): Promise<number> {
    const balance = await this.connection.getBalance(publicKey);
    return balance / 1e9; // Convert lamports to SOL
  }

  async getTokenBalance(tokenAccount: PublicKey): Promise<number> {
    const balance = await this.connection.getTokenAccountBalance(tokenAccount);
    return balance.value.uiAmount || 0;
  }
}