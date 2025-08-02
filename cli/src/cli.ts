#!/usr/bin/env node

import { Command } from 'commander';
// import { initCommand } from './init';
import { launchCommand } from './launch';
import { setUrcCommand } from './set-urc';
import { displayMintCommand } from './display-mint';
import { mintCommand } from './mint';
import { displayUrcCommand } from './display-urc';

// Create the main program
const program = new Command();

program
  .name('flipflop')
  .description('A CLI tool for Flipflop token operations')
  .version('1.0.5');

// Add launch subcommand
program.command('launch')
  .description('Launch a new token')
  .option('--rpc <url>', 'RPC endpoint', 'https://api.mainnet-beta.solana.com')
  .option('--name <name>', 'Token name')
  .option('--symbol <symbol>', 'Token symbol')
  .option('--uri <uri>', 'Token URI')
  .option('--token-type <type>', 'Token type (meme or standard)', 'meme')
  .option('--keypair-bs58 <bs58>', 'Keypair in BS58 format')
  .option('--keypair-file <pathfile>', 'Path to keypair file (Array format)')
  .action(launchCommand);

program.command('display-mint')
  .description('Display mint details')
  .option('--rpc <url>', 'RPC endpoint', 'https://api.mainnet-beta.solana.com')
  .option('--mint <address>', 'Mint account address')
  .action(displayMintCommand);

// Add urc subcommand
program.command('set-urc')
  .description('Create or update URC code')
  .option('--rpc <url>', 'RPC endpoint', 'https://api.mainnet-beta.solana.com')
  .option('--mint <address>', 'Mint account address')
  .option('--urc <code>', 'URC code')
  .option('--keypair-bs58 <bs58>', 'Keypair in BS58 format')
  .option('--keypair-file <pathfile>', 'Path to keypair file (Array format)')
  .action(setUrcCommand);

program.command('display-urc')
  .description('Display URC details')
  .option('--rpc <url>', 'RPC endpoint', 'https://api.mainnet-beta.solana.com')
  .option('--urc <code>', 'URC code')
  .action(displayUrcCommand);

// Add mint subcommand
program.command('mint')
  .description('Batch mint tokens')
  .option('--rpc <url>', 'RPC endpoint', 'https://api.mainnet-beta.solana.com')
  .option('--mint <address>', 'Mint account address')
  .option('--urc <code>', 'URC code')
  .option('--keypair-bs58 <bs58>', 'Keypair in BS58 format')
  .option('--keypair-file <pathfile>', 'Path to keypair file (Array format)')
  .action(mintCommand);

// Add init subcommand
// program.command('init')
//   .description('Initialize contracts including LUT and system config, only by Flipflop program deployer')
//   .option('--rpc <url>', 'RPC endpoint', 'https://api.mainnet-beta.solana.com')
//   .option('--keypair-bs58 <bs58>', 'Keypair in BS58 format')
//   .option('--keypair-file <path>', 'Path to keypair file (Array format)')
//   .action(initCommand);

program.parse();