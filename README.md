# @flipflop-sdk/node

A comprehensive Node.js SDK for FlipFlop token operations on Solana. This library provides programmatic access to token launches, Universal Referral Code (URC) management, and batch minting operations.

## Installation

```bash
npm install @flipflop-sdk/node
# or
yarn add @flipflop-sdk/node
```

## Quick Start

### Basic Usage

```javascript
const { 
  launchToken, 
  mintToken, 
  setUrc, 
  getMintData, 
  getUrcData,
  getSystemConfig 
} = require('@flipflop-sdk/node');

async function example() {
  // Launch a new token
  const launchResult = await launchToken({
    rpc: 'https://api.devnet.solana.com',
    name: 'My Token',
    symbol: 'MTK',
    tokenType: 'meme', // or 'standard'
    keypairBs58: 'your-base58-private-key'
  });

  console.log('Token launched:', launchResult.mintAddress.toString());
  console.log('Transaction:', launchResult.transactionHash);

  // Set URC code
  const urcResult = await setUrc({
    rpc: 'https://api.devnet.solana.com',
    mint: launchResult.mintAddress.toString(),
    urc: 'MYCODE2024',
    keypairBs58: 'your-base58-private-key'
  });

  console.log('URC set:', urcResult.urc);
  console.log('Usage count:', urcResult.usageCount);

  // Mint tokens
  const mintResult = await mintToken({
    rpc: 'https://api.devnet.solana.com',
    mint: launchResult.mintAddress.toString(),
    urc: 'MYCODE2024',
    keypairBs58: 'minter-base58-private-key'
  });

  if (mintResult.success) {
    console.log('Mint successful:', mintResult.data?.tx);
    console.log('Token account:', mintResult.data?.tokenAccount.toString());
  }

  // Get token information
  const tokenInfo = await getMintData({
    rpc: 'https://api.devnet.solana.com',
    mint: launchResult.mintAddress.toString()
  });

  console.log('Token name:', tokenInfo.name);
  console.log('Token symbol:', tokenInfo.symbol);
  console.log('Current supply:', tokenInfo.currentSupply);
  console.log('Max supply:', tokenInfo.maxSupply);

  // Get URC information
  const urcInfo = await getUrcData({
    rpc: 'https://api.devnet.solana.com',
    urc: 'MYCODE2024'
  });

  console.log('URC valid:', urcInfo.isValid);
  console.log('Referrer:', urcInfo.referrerMain.toString());
  console.log('Usage count:', urcInfo.usageCount);

  // Get system configuration
  const systemConfig = await getSystemConfig({
    rpc: 'https://api.devnet.solana.com'
  });

  console.log('System manager:', systemConfig.systemManagerAccount.toString());
  console.log('Protocol fee rate:', systemConfig.graduateFeeRate);
}
```

### TypeScript Usage

```typescript
import { 
  launchToken, 
  mintToken, 
  setUrc, 
  getMintData, 
  getUrcData,
  getSystemConfig,
  LaunchTokenOptions,
  LaunchTokenResponse,
  MintTokenOptions,
  MintTokenResponse,
  SetUrcOptions,
  SetUrcResponse,
  GetMintDataOptions,
  GetMintDataResponse,
  GetUrcDataOptions,
  GetUrcDataResponse,
  SystemConfigAccountOptions,
  SystemConfigAccountData
} from '@flipflop-sdk/node';

async function example() {
  // Launch token with type safety
  const launchOptions: LaunchTokenOptions = {
    rpc: 'https://api.devnet.solana.com',
    name: 'TypeScript Token',
    symbol: 'TST',
    tokenType: 'standard',
    keypairBs58: 'your-base58-private-key'
  };

  const launchResult: LaunchTokenResponse = await launchToken(launchOptions);
  
  // Set URC with type safety
  const setUrcOptions: SetUrcOptions = {
    rpc: 'https://api.devnet.solana.com',
    mint: launchResult.mintAddress.toString(),
    urc: 'TST_CODE',
    keypairBs58: 'your-base58-private-key'
  };

  const urcResult: SetUrcResponse = await setUrc(setUrcOptions);
  
  // Mint tokens with type safety
  const mintOptions: MintTokenOptions = {
    rpc: 'https://api.devnet.solana.com',
    mint: launchResult.mintAddress.toString(),
    urc: 'TST_CODE',
    keypairBs58: 'minter-base58-private-key'
  };

  const mintResult: MintTokenResponse = await mintToken(mintOptions);
}
```

## API Reference

### Core Functions

#### `launchToken(options: LaunchTokenOptions): Promise<LaunchTokenResponse>`

Launch a new token with specified parameters.

**Parameters:**
```typescript
interface LaunchTokenOptions {
  rpc: string;             // RPC endpoint URL
  name: string;            // Token name
  symbol: string;          // Token symbol
  tokenType: string;       // 'meme' or 'standard'
  uri?: string;            // Metadata URI (optional)
  keypairBs58?: string;    // Base58 encoded private key
  keypairFile?: string;    // Path to keypair file
}
```

**Returns:**
```typescript
interface LaunchTokenResponse {
  success: boolean;
  transactionHash: string;
  mintAddress: PublicKey;
  configAddress: PublicKey;
  metadata: TokenMetadata;
  configuration: ConfigAccountData;
}
```

**Example:**
```javascript
const result = await launchToken({
  rpc: 'https://api.devnet.solana.com',
  name: 'My Token',
  symbol: 'MTK',
  tokenType: 'meme',
  keypairBs58: 'your-base58-private-key'
});
```

#### `setUrc(options: SetUrcOptions): Promise<SetUrcResponse>`

Set Universal Referral Code for a token.

**Parameters:**
```typescript
interface SetUrcOptions {
  rpc: string;             // RPC endpoint URL
  urc: string;             // Universal Referral Code
  mint: string;            // Token mint address
  keypairBs58?: string;    // Base58 encoded private key
  keypairFile?: string;    // Path to keypair file
}
```

**Returns:**
```typescript
interface SetUrcResponse {
  transactionHash: string;
  urc: string;
  mint: PublicKey;
  referrer: PublicKey;
  referrerTokenAccount: PublicKey;
  codeHash: PublicKey;
  usageCount: number;
  activatedAt: number;
}
```

**Example:**
```javascript
const result = await setUrc({
  rpc: 'https://api.devnet.solana.com',
  mint: 'TokenMintAddress',
  urc: 'UNIQUECODE',
  keypairBs58: 'your-base58-private-key'
});
```

#### `mintToken(options: MintTokenOptions): Promise<MintTokenResponse>`

Mint tokens using a URC code.

**Parameters:**
```typescript
interface MintTokenOptions {
  rpc: string;             // RPC endpoint URL
  mint: string;            // Token mint address
  urc: string;             // Universal Referral Code
  keypairBs58?: string;    // Base58 encoded private key
  keypairFile?: string;    // Path to keypair file
}
```

**Returns:**
```typescript
interface MintTokenResponse {
  success: boolean;
  message?: string;
  data?: {
    tx: string;
    owner: PublicKey;
    tokenAccount: PublicKey;
  }
}
```

**Example:**
```javascript
const result = await mintToken({
  rpc: 'https://api.devnet.solana.com',
  mint: 'TokenMintAddress',
  urc: 'UNIQUECODE',
  keypairBs58: 'minter-base58-private-key'
});
```

#### `getMintData(options: GetMintDataOptions): Promise<GetMintDataResponse>`

Get detailed information about a token.

**Parameters:**
```typescript
interface GetMintDataOptions {
  rpc: string;    // RPC endpoint URL
  mint: string;   // Token mint address
}
```

**Returns:**
```typescript
interface GetMintDataResponse {
  mint: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  isMutable: boolean;
  configAccount: PublicKey;
  admin: PublicKey;
  tokenVault: PublicKey;
  feeRate: number;
  targetEras: number;
  initialMintSize: number;
  epochesPerEra: number;
  targetSecondsPerEpoch: number;
  reduceRatio: number;
  maxSupply: number;
  liquidityTokensRatio: number;
  currentSupply: number;
  liquidityTokensSupply: number;
  minterTokensSupply: number;
}
```

**Example:**
```javascript
const info = await getMintData({
  rpc: 'https://api.devnet.solana.com',
  mint: 'TokenMintAddress'
});
```

#### `getUrcData(options: GetUrcDataOptions): Promise<GetUrcDataResponse>`

Get information about a URC code.

**Parameters:**
```typescript
interface GetUrcDataOptions {
  rpc: string;    // RPC endpoint URL
  urc: string;    // Universal Referral Code
}
```

**Returns:**
```typescript
interface GetUrcDataResponse {
  urc: string;
  codeHash: PublicKey;
  mint: PublicKey;
  referrerMain: PublicKey;
  referrerAta: PublicKey;
  usageCount: number;
  activeTimestamp: number;
  isValid: boolean;
}
```

**Example:**
```javascript
const info = await getUrcData({
  rpc: 'https://api.devnet.solana.com',
  urc: 'UNIQUECODE'
});
```

#### `getSystemConfig(options: SystemConfigAccountOptions): Promise<SystemConfigAccountData>`

Get system configuration information.

**Parameters:**
```typescript
interface SystemConfigAccountOptions {
  rpc: string;    // RPC endpoint URL
}
```

**Returns:**
```typescript
interface SystemConfigAccountData {
  systemConfigAccount: PublicKey;
  systemManagerAccount: PublicKey;
  admin: PublicKey;
  count: number;
  referralUsageMaxCount: number;
  protocolFeeAccount: PublicKey;
  refundFeeRate: number;
  referrerResetIntervalSeconds: number;
  updateMetadataFee: number;
  customizedDeployFee: number;
  initPoolWsolAmount: number;
  graduateFeeRate: number;
  minGraduateFee: number;
  raydiumCpmmCreateFee: number;
}
```

**Example:**
```javascript
const config = await getSystemConfig({
  rpc: 'https://api.devnet.solana.com'
});
```

### Utility Functions

All utility functions and constants can also be imported from the library:

```typescript
import { 
  initProvider, 
  initProviderNoSigner, 
  loadKeypairFromBase58, 
  loadKeypairFromFile,
  CONFIGS,
  NetworkType 
} from '@flipflop-sdk/node';
```

## Configuration

### Network Types
- `mainnet`: Production network
- `devnet`: Development network  
- `local`: Local validator

### Token Types
- `meme`: Aggressive parameters for community tokens
- `standard`: Conservative parameters for utility tokens

### RPC Endpoints
- **Mainnet**: `https://api.mainnet-beta.solana.com`
- **Devnet**: `https://api.devnet.solana.com`
- **Local**: `http://127.0.0.1:8899`

## Authentication

The SDK supports two methods for providing keypairs:

### 1. Base58 Encoded Private Key
```javascript
const result = await launchToken({
  // ... other options
  keypairBs58: 'your-base58-encoded-private-key'
});
```

### 2. Keypair File Path
```javascript
const result = await launchToken({
  // ... other options
  keypairFile: './path/to/keypair.json'
});
```

## Error Handling

All functions throw descriptive errors for validation and runtime issues:

```javascript
try {
  const result = await launchToken({
    rpc: 'https://api.devnet.solana.com',
    name: 'My Token',
    symbol: 'MTK',
    tokenType: 'meme',
    keypairBs58: 'invalid-key'
  });
} catch (error) {
  console.error('Launch failed:', error.message);
}
```

## Development

### Building

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm test

# Watch mode for development
npm run dev
```

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test launch.test.ts

# Run tests with coverage
npm run test:coverage
```

## Examples

### Complete Token Launch Flow

```javascript
const { launchToken, setUrc, mintToken } = require('@flipflop-sdk/node');

async function completeFlow() {
  const rpc = 'https://api.devnet.solana.com';
  const creatorKey = 'creator-base58-private-key';
  const minterKey = 'minter-base58-private-key';
  
  // 1. Launch token
  const launch = await launchToken({
    rpc,
    name: 'Demo Token',
    symbol: 'DEMO',
    tokenType: 'standard',
    keypairBs58: creatorKey
  });
  
  console.log('Token launched:', launch.mintAddress.toString());
  
  // 2. Set URC
  const urc = await setUrc({
    rpc,
    mint: launch.mintAddress.toString(),
    urc: 'DEMO_CODE',
    keypairBs58: creatorKey
  });
  
  console.log('URC set:', urc.urc);
  
  // 3. Mint tokens
  const mint = await mintToken({
    rpc,
    mint: launch.mintAddress.toString(),
    urc: 'DEMO_CODE',
    keypairBs58: minterKey
  });
  
  console.log('Mint successful:', mint.success);
}
```

### Batch Operations

```javascript
async function batchMint() {
  const mintPromises = [];
  
  for (let i = 0; i < 5; i++) {
    mintPromises.push(
      mintToken({
        rpc: 'https://api.devnet.solana.com',
        mint: 'TokenMintAddress',
        urc: 'BATCH_CODE',
        keypairBs58: `minter-${i}-private-key`
      })
    );
  }
  
  const results = await Promise.all(mintPromises);
  console.log('Batch mint results:', results);
}
```

## Migration from CLI

### CLI to SDK Mapping

| CLI Command | SDK Function |
|-------------|-------------|
| `flipflop launch` | `launchToken()` |
| `flipflop set-urc` | `setUrc()` |
| `flipflop mint` | `mintToken()` |
| `flipflop display-mint` | `getMintData()` |
| `flipflop display-urc` | `getUrcData()` |

### Migration Example

**CLI usage:**
```bash
flipflop launch --name "MyToken" --symbol "MTK" --keypair-file ./keypair.json --rpc https://api.devnet.solana.com
```

**SDK usage:**
```javascript
const { launchToken } = require('@flipflop-sdk/node');

const result = await launchToken({
  name: 'MyToken',
  symbol: 'MTK',
  tokenType: 'standard',
  rpc: 'https://api.devnet.solana.com',
  keypairFile: './keypair.json'
});
```

## Security

- Never commit private keys to version control
- Use environment variables for sensitive configuration
- Validate all inputs before SDK operations
- Consider using `Keypair.fromSeed()` for deterministic key generation
- Always verify transaction results before proceeding

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import { 
  LaunchTokenOptions, 
  LaunchTokenResponse,
  MintTokenOptions,
  MintTokenResponse,
  SetUrcOptions,
  SetUrcResponse,
  GetMintDataOptions,
  GetMintDataResponse,
  GetUrcDataOptions,
  GetUrcDataResponse,
  SystemConfigAccountOptions,
  SystemConfigAccountData,
  TokenMetadata,
  ConfigAccountData,
  NetworkType
} from '@flipflop-sdk/node';
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
