# @flipflop-sdk/node

A comprehensive Node.js SDK for FlipFlop token operations on Solana. This library provides programmatic access to token launches, Universal Referral Code (URC) management, batch minting operations, and metadata management.

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
  getSystemConfig,
  generateMetadataUri,
  validateImageFile,
  loadKeypairFromBase58
} = require('@flipflop-sdk/node');

async function example() {
  // Generate metadata URI first
  const metadataResult = await generateMetadataUri({
    rpc: 'https://api.devnet.solana.com',
    name: 'My Token',
    symbol: 'MTK',
    description: 'A sample token for demonstration',
    imagePath: './path/to/token-logo.png'
  });

  if (metadataResult.success) {
    console.log('Metadata URI:', metadataResult.metadataUrl);
    console.log('Image URI:', metadataResult.imageUrl);
  }

  // Launch a new token with metadata
  const launchResult = await launchToken({
    rpc: 'https://api.devnet.solana.com',
    name: 'My Token',
    symbol: 'MTK',
    tokenType: 'meme', // or 'standard'
    uri: metadataResult.metadataUrl, // Use generated metadata URI
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

  // Mint tokens (pass a Keypair as `minter`)
  const minter = loadKeypairFromBase58('minter-base58-private-key');
  const mintResult = await mintToken({
    rpc: 'https://api.devnet.solana.com',
    mint: launchResult.mintAddress.toString(),
    urc: 'MYCODE2024',
    minter
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

### TypeScript Usage

```typescript
import { 
  launchToken, 
  mintToken, 
  setUrc, 
  getMintData, 
  getUrcData,
  getSystemConfig,
  generateMetadataUri,
  validateImageFile,
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
  GenerateMetadataUriOptions,
  MetadataUploadResponse,
  loadKeypairFromBase58
} from '@flipflop-sdk/node';

async function example() {
  // Generate metadata with type safety
  const metadataOptions: GenerateMetadataUriOptions = {
    rpc: 'https://api.devnet.solana.com',
    name: 'TypeScript Token',
    symbol: 'TST',
    description: 'A TypeScript token example',
    imagePath: './assets/logo.png'
  };

  const metadataResult: MetadataUploadResponse = await generateMetadataUri(metadataOptions);
  
  // Launch token with type safety
  const launchOptions: LaunchTokenOptions = {
    rpc: 'https://api.devnet.solana.com',
    name: 'TypeScript Token',
    symbol: 'TST',
    tokenType: 'standard',
    uri: metadataResult.metadataUrl,
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
  
  // Mint tokens with type safety (note: `minter` is a Keypair)
  const mintOptions: MintTokenOptions = {
    rpc: 'https://api.devnet.solana.com',
    mint: launchResult.mintAddress, // PublicKey
    urc: 'TST_CODE',
    minter: loadKeypairFromBase58('minter-base58-private-key')
  };

  const mintResult = await mintToken(mintOptions);
}
```

## API Reference

### Core Functions

#### `generateMetadataUri(options: GenerateMetadataUriOptions): Promise<MetadataUploadResponse>`

**NEW** - Generate metadata URI by uploading image and metadata to Irys network.

**Parameters:**
```typescript
interface GenerateMetadataUriOptions {
  rpc: string;           // RPC endpoint URL
  name: string;          // Token name
  symbol: string;        // Token symbol
  description?: string;  // Token description (optional)
  imagePath: string;     // Path to image file
}
```

**Returns:**
```typescript
interface MetadataUploadResponse {
  success: boolean;
  metadataUrl?: string;  // Irys gateway URL for metadata JSON
  imageUrl?: string;     // Irys gateway URL for uploaded image
  error?: string;        // Error message if upload failed
}
```

**Image Requirements:**
- **Supported formats**: JPEG, PNG, GIF, WebP, AVIF
- **Maximum size**: 250KB
- **File validation**: Automatic type and size checking

**Example:**
```javascript
const result = await generateMetadataUri({
  rpc: 'https://api.devnet.solana.com',
  name: 'My Awesome Token',
  symbol: 'MAT',
  description: 'This is an awesome token for the community',
  imagePath: './assets/token-logo.png'
});

if (result.success) {
  console.log('Metadata URL:', result.metadataUrl);
  console.log('Image URL:', result.imageUrl);
} else {
  console.error('Upload failed:', result.error);
}
```

#### `validateImageFile(imagePath: string): { valid: boolean; error?: string }`

**NEW** - Validate image file before upload.

**Parameters:**
- `imagePath`: Path to the image file

**Returns:**
- `valid`: Boolean indicating if file is valid
- `error`: Error message if validation fails

**Example:**
```javascript
const validation = validateImageFile('./logo.png');
if (!validation.valid) {
  console.error('Image validation failed:', validation.error);
}
```

#### `launchToken(options: LaunchTokenOptions): Promise<LaunchTokenResponse>`

Launch a new token with specified parameters.

**Parameters:**
```typescript
interface LaunchTokenOptions {
  rpc: string;             // RPC endpoint URL
  name: string;            // Token name
  symbol: string;          // Token symbol
  tokenType: string;       // 'meme' or 'standard'
  uri?: string;            // Metadata URI (optional, use generateMetadataUri)
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
  uri: 'https://gateway.irys.xyz/your-metadata-id', // From generateMetadataUri
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

#### `mintToken(options: MintTokenOptions): Promise<ApiResponse<MintTokenResponse>>`

Mint tokens using a URC code.

**Parameters:**
```typescript
interface MintTokenOptions {
  rpc: string;                  // RPC endpoint URL
  minter: Keypair;              // The minter's Keypair (wallet that pays & receives)
  mint: PublicKey;              // Token mint address (a string is also accepted; it will be converted)
  urc: string;                  // Universal Referral Code
  lookupTableAccount?: PublicKey; // Optional; defaults to network LUT from CONFIGS
}
```

**Returns:**
```typescript
// Generic API wrapper used across the SDK
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

// Mint call payload on success
interface MintTokenResponse {
  tx: string;              // Transaction signature
  owner: PublicKey;        // Minter's public key
  tokenAccount: PublicKey; // Associated token account that received the mint
}
```

- The function resolves to `Promise<ApiResponse<MintTokenResponse>>`.
- On success, `message` is "Mint succeeded" and `data` contains `tx`, `owner`, and `tokenAccount`.

**Example:**
```javascript
const { loadKeypairFromBase58 } = require('@flipflop-sdk/node');

const minter = loadKeypairFromBase58('minter-base58-private-key');
const result = await mintToken({
  rpc: 'https://api.devnet.solana.com',
  mint: 'TokenMintAddress', // string is accepted; SDK will convert internally
  urc: 'UNIQUECODE',
  minter
});

if (result.success) {
  console.log('tx:', result.data.tx);
  console.log('owner:', result.data.owner.toBase58());
  console.log('tokenAccount:', result.data.tokenAccount.toBase58());
} else {
  console.error('Mint failed:', result.message);
}
```

**Notes:**
- `urc` must be a valid and active referral code on-chain; the SDK derives and verifies the referral PDA internally.
- If `lookupTableAccount` is not provided, the SDK uses the preconfigured LUT for the detected network (via `CONFIGS`).
- Common error messages include metadata fetch failures and on-chain validation errors; in such cases you'll receive `{ success: false, message: 'Mint operation failed: ...' }`.

#### `refundToken(options: RefundTokenOptions): Promise<ApiResponse<RefundTokenResponse>>`

Request a refund for the caller's tokens according to protocol rules.

Parameters:
```typescript
interface RefundTokenOptions {
  rpc: string;           // RPC endpoint URL
  mint: PublicKey;       // Token mint address (a string is also accepted; it will be converted)
  owner: Keypair;        // The owner's Keypair (the account that holds tokens to refund)
}
```

Returns:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

interface RefundTokenResponse {
  tx: string;  // Transaction signature
}
```

Example (JavaScript):
```javascript
const { refundToken, loadKeypairFromBase58 } = require('@flipflop-sdk/node');

const owner = loadKeypairFromBase58('owner-base58-private-key');
const result = await refundToken({
  rpc: 'https://api.devnet.solana.com',
  mint: 'TokenMintAddress', // string is accepted; SDK will convert internally
  owner
});

if (result.success) {
  console.log('Refund tx:', result.data.tx);
} else {
  console.error('Refund failed:', result.message);
}
```

Example (TypeScript):
```typescript
import { refundToken, RefundTokenOptions } from '@flipflop-sdk/node';
import { PublicKey } from '@solana/web3.js';

const options: RefundTokenOptions = {
  rpc: 'https://api.devnet.solana.com',
  mint: new PublicKey('TokenMintAddress'),
  owner: loadKeypairFromBase58('owner-base58-private-key'),
};

const res = await refundToken(options);
```

Notes:
- The owner must match the protocol's refund record for this mint; otherwise you'll receive "Only User Account Allowed".
- The SDK automatically creates WSOL associated token accounts for the owner and the protocol fee account if missing.
- Typical on-chain failures include: NotEnoughTokensToRefund, RefundTokensIsZero, UserBalanceNotEnoughForRefund, VaultBalanceNotEnoughForRefund, RefundInProgress, InvalidRefundFeeRate, RefundOnlyAllowedInTargetEras.
- On success, you'll receive `{ success: true, data: { tx } }`.
- On failure, `message` may contain strings like "Error refunding..." or "Something went wrong but you have refund successfully". In rare cases you may see "Mint operation failed: ..." from a shared error handler.

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
  validateImageFile,
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

### Irys Network Integration
- **Devnet**: `https://api-dev.flipflop.plus/api/irys/upload`
- **Mainnet**: `https://api.flipflop.plus/api/irys/upload`
- **Gateway**: `https://gateway.irys.xyz/`

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
  // Validate image first
  const validation = validateImageFile('./logo.png');
  if (!validation.valid) {
    throw new Error(`Image validation failed: ${validation.error}`);
  }

  // Generate metadata
  const metadataResult = await generateMetadataUri({
    rpc: 'https://api.devnet.solana.com',
    name: 'My Token',
    symbol: 'MTK',
    description: 'My awesome token',
    imagePath: './logo.png'
  });

  if (!metadataResult.success) {
    throw new Error(`Metadata upload failed: ${metadataResult.error}`);
  }

  // Launch token
  const result = await launchToken({
    rpc: 'https://api.devnet.solana.com',
    name: 'My Token',
    symbol: 'MTK',
    tokenType: 'meme',
    uri: metadataResult.metadataUrl,
    keypairBs58: 'invalid-key'
  });
} catch (error) {
  console.error('Operation failed:', error.message);
}
```

## Development

### Dependencies

The SDK uses the following key dependencies:

**Core Solana Libraries:**
- `@coral-xyz/anchor` (0.31.1) - Anchor framework for Solana
- `@solana/web3.js` (^1.98.0) - Solana Web3 JavaScript API
- `@solana/spl-token` (^0.4.9) - SPL Token library
- `@solana/spl-token-metadata` (^0.1.6) - Token metadata standard

**Utility Libraries:**
- `axios` (^1.11.0) - HTTP client for API requests
- `form-data` (^4.0.4) - Multipart form data for file uploads
- `bn.js` (5.2.1) - Big number arithmetic
- `bs58` (^6.0.0) - Base58 encoding/decoding
- `decimal.js` (^10.4.3) - Decimal arithmetic
- `sleep-promise` (^9.1.0) - Promise-based sleep utility

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

# Run metadata tests (requires network connection)
npm test metadata.test.ts
```

**Note**: Metadata tests make real API calls to devnet and require internet connection.

## Examples

### Complete Token Launch Flow with Metadata

```javascript
const { 
  generateMetadataUri, 
  launchToken, 
  setUrc, 
  mintToken 
} = require('@flipflop-sdk/node');

async function completeFlowWithMetadata() {
  const rpc = 'https://api.devnet.solana.com';
  const creatorKey = 'creator-base58-private-key';
  const minterKey = 'minter-base58-private-key';
  
  // 1. Generate metadata URI
  console.log('Step 1: Generating metadata...');
  const metadata = await generateMetadataUri({
    rpc,
    name: 'Demo Token',
    symbol: 'DEMO',
    description: 'A demonstration token with custom metadata',
    imagePath: './assets/demo-logo.png'
  });
  
  if (!metadata.success) {
    throw new Error(`Metadata generation failed: ${metadata.error}`);
  }
  
  console.log('Metadata URL:', metadata.metadataUrl);
  console.log('Image URL:', metadata.imageUrl);
  
  // 2. Launch token with metadata
  console.log('Step 2: Launching token...');
  const launch = await launchToken({
    rpc,
    name: 'Demo Token',
    symbol: 'DEMO',
    tokenType: 'standard',
    uri: metadata.metadataUrl,
    keypairBs58: creatorKey
  });
  
  console.log('Token launched:', launch.mintAddress.toString());
  
  // 3. Set URC
  console.log('Step 3: Setting URC...');
  const urc = await setUrc({
    rpc,
    mint: launch.mintAddress.toString(),
    urc: 'DEMO_CODE',
    keypairBs58: creatorKey
  });
  
  console.log('URC set:', urc.urc);
  
  // 4. Mint tokens
  console.log('Step 4: Minting tokens...');
  const mint = await mintToken({
    rpc,
    mint: launch.mintAddress.toString(),
    urc: 'DEMO_CODE',
    keypairBs58: minterKey
  });
  
  console.log('Mint successful:', mint.success);
  
  return {
    metadata: metadata.metadataUrl,
    mint: launch.mintAddress.toString(),
    urc: urc.urc,
    transaction: mint.data?.tx
  };
}
```

### Batch Operations with Metadata Validation

```javascript
async function batchMintWithValidation() {
  const imagePaths = [
    './assets/logo1.png',
    './assets/logo2.jpg',
    './assets/logo3.gif'
  ];
  
  // Validate all images first
  const validations = imagePaths.map(path => ({
    path,
    validation: validateImageFile(path)
  }));
  
  const validImages = validations.filter(v => v.validation.valid);
  const invalidImages = validations.filter(v => !v.validation.valid);
  
  if (invalidImages.length > 0) {
    console.warn('Invalid images found:');
    invalidImages.forEach(img => {
      console.warn(`- ${img.path}: ${img.validation.error}`);
    });
  }
  
  // Process valid images
  const metadataPromises = validImages.map((img, index) => 
    generateMetadataUri({
      rpc: 'https://api.devnet.solana.com',
      name: `Batch Token ${index + 1}`,
      symbol: `BT${index + 1}`,
      description: `Batch generated token ${index + 1}`,
      imagePath: img.path
    })
  );
  
  const metadataResults = await Promise.all(metadataPromises);
  console.log('Batch metadata generation results:', metadataResults);
  
  return metadataResults;
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
| **NEW** | `generateMetadataUri()` |
| **NEW** | `validateImageFile()` |

### Migration Example

**CLI usage:**
```bash
flipflop launch --name "MyToken" --symbol "MTK" --keypair-file ./keypair.json --rpc https://api.devnet.solana.com
```

**SDK usage:**
```javascript
const { generateMetadataUri, launchToken } = require('@flipflop-sdk/node');

// Generate metadata first (new capability)
const metadata = await generateMetadataUri({
  rpc: 'https://api.devnet.solana.com',
  name: 'MyToken',
  symbol: 'MTK',
  description: 'My awesome token',
  imagePath: './logo.png'
});

// Launch with metadata
const result = await launchToken({
  name: 'MyToken',
  symbol: 'MTK',
  tokenType: 'standard',
  uri: metadata.metadataUrl,
  rpc: 'https://api.devnet.solana.com',
  keypairFile: './keypair.json'
});
```

## Security

- Never commit private keys to version control
- Use environment variables for sensitive configuration
- Validate all inputs before SDK operations
- **Image Security**: Only upload trusted images, validate file types and sizes
- **Metadata Security**: Review generated metadata before using in production
- Consider using `Keypair.fromSeed()` for deterministic key generation
- Always verify transaction results before proceeding
- **Network Security**: Use HTTPS endpoints for all API calls

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
  GenerateMetadataUriOptions,
  MetadataUploadResponse,
  MetadataParams,
  TokenMetadata,
  ConfigAccountData,
  NetworkType
} from '@flipflop-sdk/node';
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass (including metadata tests)
5. Update documentation for new features
6. Submit a pull request

## License

MIT License - see LICENSE file for details.
