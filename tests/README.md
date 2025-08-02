# FlipFlop SDK Tests

This directory contains comprehensive test suites for the FlipFlop SDK.

## Test Structure

```
tests/
├── unit/                    # Unit tests for individual methods
│   ├── sdk.test.ts         # SDK initialization and configuration
│   ├── launch-token.test.ts # Token launch functionality
│   ├── set-urc.test.ts     # URC code setting
│   ├── mint-tokens.test.ts # Token minting
│   └── get-info.test.ts    # Token and URC information retrieval
├── integration/            # Integration tests
│   └── sdk-integration.test.ts # Complete workflow tests
├── e2e/                    # End-to-end tests
│   └── sdk-e2e.test.ts    # Real Solana network tests
├── setup.ts               # Test environment configuration
└── README.md              # This file
```

## Running Tests

### Unit Tests
```bash
# Run all unit tests
npm test

# Run specific test file
npm test -- tests/unit/sdk.test.ts

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Integration Tests
```bash
# Run integration tests
npm run test:integration

# Run with verbose output
npm test -- tests/integration/sdk-integration.test.ts --verbose
```

### End-to-End Tests

⚠️ **Important**: E2E tests require a real Solana devnet connection and SOL tokens.

```bash
# Set up your private key for E2E tests
export SOLANA_PRIVATE_KEY="[64,64,64,...]"  # Array format from solana-keygen

# Run E2E tests (skipped by default)
npm run test:e2e

# Run specific E2E test
npm test -- tests/e2e/sdk-e2e.test.ts --testNamePattern="token lifecycle"
```

## Test Coverage

The test suite covers:

- **Unit Tests**: 95%+ code coverage
  - SDK initialization and configuration
  - All core method functionality
  - Input validation and error handling
  - Edge cases and boundary conditions

- **Integration Tests**: Complete workflow testing
  - End-to-end token lifecycle
  - Multiple operations sequencing
  - Error handling across methods
  - State consistency

- **E2E Tests**: Real network testing
  - Actual Solana devnet transactions
  - Real token launches and operations
  - Performance benchmarks
  - Network error handling

## Test Categories

### 1. SDK Initialization Tests
- Network configuration validation
- Keypair handling
- RPC endpoint configuration
- Error handling for invalid inputs

### 2. Token Launch Tests
- Different token types (meme, standard, custom)
- Input validation (name, symbol, URI)
- Transaction signing and error handling
- Mint address generation consistency

### 3. URC Management Tests
- URC code validation and constraints
- Code hash generation
- Duplicate prevention
- Transaction handling

### 4. Token Minting Tests
- URC-based minting
- Direct minting without URC
- Fee calculation and validation
- Token account management
- Supply limit enforcement

### 5. Information Retrieval Tests
- Token metadata and state
- URC code information
- Error handling for non-existent data
- Network error scenarios

## Mocking Strategy

The tests use comprehensive mocking:

- **@solana/web3.js**: Connection, PublicKey, Keypair, Transaction
- **@coral-xyz/anchor**: Program, Provider, BN
- **Network interactions**: All network calls are mocked
- **Wallet operations**: Keypair and signing operations

## Adding New Tests

1. **Unit Tests**: Add to appropriate file in `tests/unit/`
2. **Integration Tests**: Add to `tests/integration/sdk-integration.test.ts`
3. **E2E Tests**: Add to `tests/e2e/sdk-e2e.test.ts`

### Test Naming Convention

```typescript
describe('methodName', () => {
  describe('specific scenario', () => {
    it('should expected behavior', async () => {
      // Test implementation
    });
  });
});
```

## Troubleshooting

### Common Issues

1. **"Module not found" errors**: Ensure all dependencies are installed
   ```bash
   npm install
   ```

2. **TypeScript compilation errors**: Check tsconfig.json
   ```bash
   npm run build
   ```

3. **Test timeout errors**: Increase timeout in jest.config.js

4. **Network connection issues**: Ensure devnet RPC is accessible
   ```bash
   curl https://api.devnet.solana.com -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
   ```

### Debug Mode

```bash
# Run tests with debug output
DEBUG=flipflop-sdk npm test

# Run specific test with verbose output
npm test -- --verbose tests/unit/launch-token.test.ts
```

## CI/CD Integration

The tests are configured for CI/CD:

- **GitHub Actions**: Automatic test running on PR
- **Coverage reporting**: HTML and LCOV formats
- **Performance testing**: E2E tests with timeouts
- **Network mocking**: All external dependencies mocked

## Performance Benchmarks

- **Unit Tests**: < 30 seconds for full suite
- **Integration Tests**: < 60 seconds
- **E2E Tests**: < 2 minutes (with real network)

## Security Testing

- Private key handling validation
- Input sanitization tests
- Network security validation
- Transaction signing verification