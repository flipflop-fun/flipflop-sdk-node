# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

FlipFlop CLI is a TypeScript-based command-line interface for Solana token operations, specifically designed for FlipFlop token management including token launches, URC (Universal Referral Code) management, and batch minting operations.

## Architecture

### Core Components
- **CLI Entry Point**: `cli/src/cli.ts` - Uses Commander.js for command parsing
- **Configuration**: `cli/src/config.ts` - Network-specific program IDs and addresses
- **Constants**: `cli/src/constants.ts` - Program seeds, token parameters, and PDA definitions
- **Utilities**: `cli/src/utils.ts` - Core business logic for Solana interactions
- **Types**: `cli/src/types.ts` - TypeScript interfaces and type definitions

### Network Support
- **Local**: Program ID: `FLipzZfErPUtDQPj9YrC6wp4nRRiVxRkFm3jdFmiPHJV`
- **Devnet**: Program ID: `8GM2N7qQjzMyhqewu8jpDgzUh2BJbtBxSY1W5zSFeFm6U`
- **Mainnet**: Program ID: `FLipzZfErPUtDQPj9YrC6wp4nRRiVxRkFm3jdFmiPHJV`

### Key Features
1. **Token Launch**: Create new tokens with configurable parameters
2. **URC Management**: Set and manage Universal Referral Codes
3. **Batch Minting**: Mint tokens using referral codes
4. **Display Info**: Show token metadata and URC details

## Development Commands

### Build & Development
```bash
# Install dependencies
yarn install

# Build the project
tsc && cp -r cli/src/idl dist/idl/

# Lint code
yarn lint
yarn lint:fix

# Install globally for testing
npm link
```

### Testing Commands
After global installation:
```bash
# Launch new token
flipflop launch --name "MyToken" --symbol "MTK" --keypair-file ./keypair.json

# Set URC code
flipflop set-urc --mint <mint_address> --urc "mycode" --keypair-file ./keypair.json

# Mint tokens
flipflop mint --mint <mint_address> --urc "mycode" --keypair-file ./keypair.json

# Display token info
flipflop display-mint --mint <mint_address>

# Display URC info
flipflop display-urc --urc "mycode"
```

### Keypair Management
- **File format**: JSON array of 64 numbers
- **Base58 format**: Direct private key in base58
- **Priority**: `--keypair-file` takes precedence over `--keypair-bs58`

## Code Structure Patterns

### Solana Program Integration
- Uses Anchor framework for program interaction
- IDL files for each network: `cli/src/idl/fair_mint_token_{network}.json`
- PDA derivation follows consistent patterns with program-specific seeds

### Transaction Processing
- Versioned transactions with Address Lookup Tables (LUTs)
- Compute budget optimization (500,000 compute units)
- Remaining accounts pattern for complex instructions

### Token Parameters
Two token types with different configurations:
- **Standard**: Conservative parameters for utility tokens
- **Meme**: Aggressive parameters for community tokens

### Account Management
- Uses PDAs extensively for deterministic addresses
- Associated Token Account (ATA) pattern for token accounts
- Automatic ATA creation when needed

## Important Addresses & Seeds

### PDA Seeds
- `MINT_SEED = "fair_mint"`
- `CONFIG_DATA_SEED = "config_data"`
- `REFERRAL_SEED = "referral"`
- `REFERRAL_CODE_SEED = "referral_code"`
- `CODE_ACCOUNT_SEED = "code_account"`

### External Program IDs
- **Token Metadata**: `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s`
- **CP Swap**: Network-specific program IDs in config.ts

## File Organization
- **Source**: `cli/src/` - All TypeScript source files
- **Built**: `dist/` - Compiled JavaScript output
- **IDL**: `cli/src/idl/` - Anchor program interface definitions
- **Accounts**: `accounts/` - Stored account JSON files

## Dependencies
- **Core**: @solana/web3.js, @coral-xyz/anchor, @solana/spl-token
- **CLI**: commander.js for command-line interface
- **Utils**: bs58 for key encoding, bn.js for big numbers