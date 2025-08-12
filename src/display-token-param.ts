import { TOKEN_PARAMS } from "./constants";
import { ApiResponse } from "./raydium/types";
import { TokenParams } from "./types";

// Define the options interface
interface DisplayTokenParamOptions {
  rpc: string;
  tokenType: "standard" | "meme";
}

// Main function to display token parameters
export const displayTokenParams = (
  options: DisplayTokenParamOptions
): ApiResponse<TokenParams> => {
  if (!options.rpc) {
    return {
      success: false,
      message: "Missing --rpc parameter",
    };
  }

  if (!options.tokenType) {
    return {
      success: false,
      message: "Missing --token-type parameter",
    };
  }

  const params = TOKEN_PARAMS[options.tokenType];

  if (!params) {
    throw new Error(
      `Invalid token type: ${options.tokenType}. Must be one of ${Object.keys(
        TOKEN_PARAMS
      ).join(", ")}`
    );
  }

  return {
    success: true,
    data: params,
  };
};
