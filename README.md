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
const { createSDKFromNetwork } = require('@flipflop-sdk/node');

async function example() {
  // Initialize SDK for devnet
  const sdk = createSDKFromNetwork('devnet', [
    174, 47, 154, 16, 56, 23, 45, 234, 123, 45, 67, 89, 12, 34, 56, 78,
    90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90,
    12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12,
    34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34
  ]);

  await sdk.initialize();

  // Launch a new token
  const launchResult = await sdk.launchToken({
    name: 'My Token',
    symbol: 'MTK',
    uri: 'https://example.com/metadata.json',
    tokenType: 'meme'
  });

  console.log('Token launched:', launchResult.mint);

  // Set URC code
  await sdk.setURC({
    mint: launchResult.mint,
    urc: 'MYCODE2024'
  });

  // Mint tokens
  const mintResult = await sdk.mintTokens({
    mint: launchResult.mint,
    urc: 'MYCODE2024'
  });
}
```

### TypeScript Usage

```typescript
import { createSDK, FlipFlopSDK } from '@flipflop-sdk/node';
import { Keypair } from '@solana/web3.js';

const keypair = Keypair.generate();
const sdk = createSDK({
  network: 'devnet',
  rpcUrl: 'https://api.devnet.solana.com',
  keypair: keypair
});

await sdk.initialize();

const result = await sdk.launchToken({
  name: 'TypeScript Token',
  symbol: 'TST',
  tokenType: 'standard'
});
```

## API Reference

### SDK Initialization

#### `createSDK(config: SDKConfig)`
Create a custom SDK instance with full configuration.

```javascript
import { createSDK } from '@flipflop-sdk/node';
import { Keypair } from '@solana/web3.js';

const sdk = createSDK({
  network: 'mainnet',
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  keypair: Keypair.fromSecretKey(secretKey)
});
```

#### `createSDKFromNetwork(network, keypair?, rpcUrl?)`
Quick SDK creation with network presets.

```javascript
// With keypair array
const sdk = createSDKFromNetwork('devnet', [/* 64-byte array */]);

// With custom RPC
const sdk = createSDKFromNetwork('mainnet', keypair, 'https://custom-rpc.com');
```

### Core Methods

#### `launchToken(options: LaunchOptions)`
Launch a new token with specified parameters.

```javascript
const result = await sdk.launchToken({
  name: 'My Token',
  symbol: 'MTK',
  uri: 'https://example.com/metadata.json',
  tokenType: 'meme' // or 'standard'
});
// Returns: { mint: string, tx: string }
```

#### `setURC(options: SetURCOptions)`
Set Universal Referral Code for a token.

```javascript
const result = await sdk.setURC({
  mint: 'TokenMintAddress',
  urc: 'UNIQUECODE'
});
// Returns: { tx: string }
```

#### `mintTokens(options: MintOptions)`
Mint tokens using a URC code.

```javascript
const result = await sdk.mintTokens({
  mint: 'TokenMintAddress',
  urc: 'UNIQUECODE'
});
// Returns: { tokenAccount: string, tx: string }
```

#### `getTokenInfo(mint: string)`
Get detailed information about a token.

```javascript
const info = await sdk.getTokenInfo('TokenMintAddress');
// Returns: TokenInfo object with metadata, supply, etc.
```

#### `getURCInfo(urc: string)`
Get information about a URC code.

```javascript
const info = await sdk.getURCInfo('UNIQUECODE');
// Returns: URCInfo object with referrer details
```

### Utility Methods

#### Account Management
- `getBalance(publicKey)`: Get SOL balance
- `getTokenBalance(tokenAccount)`: Get token balance

#### Network Information
- `get config`: Access network-specific configuration
- `get program`: Access the Anchor program instance
- `get connection`: Access the Solana connection

## Configuration

### Network Types
- `mainnet`: Production network
- `devnet`: Development network
- `local`: Local validator

### Token Types
- `meme`: Aggressive parameters for community tokens
- `standard`: Conservative parameters for utility tokens

## Examples

See the `examples/` directory for comprehensive usage examples:

- `examples/basic-usage.js`: Simple launch and mint operations
- `examples/advanced-usage.js`: Batch operations and monitoring
- `examples/typescript-example.ts`: Full TypeScript implementation

### Running Examples

```bash
# Basic example
node examples/basic-usage.js

# Advanced example
node examples/advanced-usage.js advanced

# TypeScript example
npx ts-node examples/typescript-example.ts
```

## Error Handling

The SDK provides detailed error messages and supports retry operations:

```javascript
import { retryOperation } from '@flipflop-sdk/node';

const result = await retryOperation(
  () => sdk.launchToken({ name: 'Retry Token', symbol: 'RTY' }),
  3, // max retries
  1000 // delay between retries
);
```

## TypeScript Support

Full TypeScript support with type definitions included:

```typescript
import { 
  FlipFlopSDK, 
  LaunchOptions, 
  TokenInfo, 
  URCInfo,
  NetworkType 
} from '@flipflop-sdk/node';
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

# Run specific test
npm test -- --grep "Token launch"
```

## Migration from CLI

### CLI to SDK Mapping

| CLI Command | SDK Method |
|-------------|------------|
| `flipflop launch` | `sdk.launchToken()` |
| `flipflop set-urc` | `sdk.setURC()` |
| `flipflop mint` | `sdk.mintTokens()` |
| `flipflop display-mint` | `sdk.getTokenInfo()` |
| `flipflop display-urc` | `sdk.getURCInfo()` |

### Migration Example

**CLI usage:**
```bash
flipflop launch --name "MyToken" --symbol "MTK" --keypair-file ./keypair.json
```

**SDK usage:**
```javascript
const sdk = createSDKFromNetwork('mainnet', keypairArray);
await sdk.initialize();
const result = await sdk.launchToken({
  name: 'MyToken',
  symbol: 'MTK'
});
```

## Security

- Never commit private keys to version control
- Use environment variables for sensitive configuration
- Validate all inputs before SDK operations
- Consider using Keypair.fromSeed() for deterministic key generation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/flipflop-fun/sdk/issues)
- Documentation: Check the examples directory
- Discord: Join our community server

## Changelog

### 2.0.0
- Complete rewrite from CLI to Node.js SDK
- Full TypeScript support
- Comprehensive API with Promise-based methods
- Advanced error handling and retry mechanisms
- Batch operation support
- Detailed analytics and reporting
- Migration guides from CLI usage