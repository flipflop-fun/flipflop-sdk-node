import { TOKEN_PARAMS } from './constants';
import { TokenParams } from './types';

// Define the options interface
interface DisplayTokenParamOptions {
  rpc: string;
  tokenType: 'standard' | 'meme';
}

// Main function to display token parameters
export const displayTokenParams = (options: DisplayTokenParamOptions): TokenParams => {
  if (!options.rpc) {
    throw new Error('Missing --rpc parameter');
  }

  if (!options.tokenType) {
    throw new Error('Missing --token-type parameter');
  }

  const params = TOKEN_PARAMS[options.tokenType];

  if (!params) {
    throw new Error(`Invalid token type: ${options.tokenType}. Must be one of ${Object.keys(TOKEN_PARAMS).join(', ')}`);
  }

  return params;
};
