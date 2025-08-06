import { NetworkConfig } from "./types";

export const getNetworkType = (rpcUrl: string): 'local' | 'devnet' | 'mainnet' => {
  if (rpcUrl.includes('localhost') || rpcUrl.includes('127.0.0.1')) return 'local';
  if (rpcUrl.includes('devnet')) return 'devnet';
  if (rpcUrl.includes('mainnet')) return 'mainnet';
  throw new Error('Invalid RPC URL');
}

export const CONFIGS = {
  local: {
    programId: 'FLipzZfErPUtDQPj9YrC6wp4nRRiVxRkFm3jdFmiPHJV',
    lookupTableAccount: '6MzoPgNhKXsEx91X6aPyNXdsMMjrZBPLJ9s74Lxezs7A',
    systemManagerAccount: 'DJ3jvpv6k7uhq8h9oVHZck6oY4dQqY1GHaLvCLjSqxaD',
    cpSwapProgram: 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',
    cpSwapConfigAddress: 'D4FPEruKEHrG5TenZ2mpDGEfu1iUvTiqBxvpU8HLBvC2',
    createPoolFeeReceive: 'DNXgeM9EiiaAbaWvwjHj9fQQLAX5ZsfHyvmYUNRAdNC8',
    irysGatewayUrl: "https://gateway.irys.xyz",
    apiBaseUrl: 'https://api-dev.flipflop.plus',
  } as NetworkConfig,
  devnet: {
    programId: '8GM2N7qQjzMyhqewu8jpDgzUh2BJbtBxSY1WzSFeFm6U',
    lookupTableAccount: 'EebRqpLtUgjX17pJJNNbd6ngtYa34VGa51oYsibwJRXy',
    systemManagerAccount: 'CXzddeiDgbTTxNnd1apeUGE7E1UAdvBoysf7c271AA79',
    cpSwapProgram: 'CPMDWBwJDtYax9qW7AyRuVC19Cc4L4Vcy4n2BHAbHkCW',
    cpSwapConfigAddress: '9zSzfkYy6awexsHvmggeH36pfVUdDGyCcwmjT3AQPBj6',
    createPoolFeeReceive: 'G11FKBRaAkHAKuLCgLM6K6NUc9rTjPAznRCjZifrTQe2',
    irysGatewayUrl: "https://gateway.irys.xyz",
    apiBaseUrl: 'https://api-dev.flipflop.plus',
  } as NetworkConfig,
  mainnet: {
    programId: 'FLipzZfErPUtDQPj9YrC6wp4nRRiVxRkFm3jdFmiPHJV',
    lookupTableAccount: '7DK7pmNkUeeFB3yxt6bJcPCWcG4L3AdCe2WZaBguy9sq',
    systemManagerAccount: 'DJ3jvpv6k7uhq8h9oVHZck6oY4dQqY1GHaLvCLjSqxaD',
    cpSwapProgram: 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',
    cpSwapConfigAddress: 'D4FPEruKEHrG5TenZ2mpDGEfu1iUvTiqBxvpU8HLBvC2',
    createPoolFeeReceive: 'DNXgeM9EiiaAbaWvwjHj9fQQLAX5ZsfHyvmYUNRAdNC8',
    irysGatewayUrl: "https://gateway.irys.xyz",
    apiBaseUrl: 'https://api.flipflop.plus',
  } as NetworkConfig
};
