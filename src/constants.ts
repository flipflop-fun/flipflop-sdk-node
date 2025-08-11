import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);
export const RENT_PROGRAM_ID = new PublicKey(
  "SysvarRent111111111111111111111111111111111"
);

export const METADATA_SEED = "metadata";
export const MINT_SEED = "fair_mint";
export const CONFIG_DATA_SEED = "config_data";
export const FREEZE_SEED = "freeze";
export const REFERRAL_SEED = "referral";
export const REFUND_SEEDS = "refund";
export const SYSTEM_CONFIG_SEEDS = "system_config_v1.1";
export const REFERRAL_CODE_SEED = "referral_code";
export const CODE_ACCOUNT_SEED = "code_account";
export const EXTRA_ACCOUNT_META_LIST = "extra-account-metas";
export const MINT_VAULT_OWNER_SEEDS = "mint-vault-owner";
export const POOL_SEEDS = "pool";
export const LAUNCH_RULE_SEEDS = "launch_rule";
export const AUTH_SEED = "vault_and_lp_mint_auth_seed";

export const AMM_CONFIG_SEED = Buffer.from(
  anchor.utils.bytes.utf8.encode("amm_config")
);
export const POOL_SEED = Buffer.from(anchor.utils.bytes.utf8.encode("pool"));
export const POOL_VAULT_SEED = Buffer.from(
  anchor.utils.bytes.utf8.encode("pool_vault")
);
export const POOL_AUTH_SEED = Buffer.from(
  anchor.utils.bytes.utf8.encode("vault_and_lp_mint_auth_seed")
);
export const POOL_LPMINT_SEED = Buffer.from(
  anchor.utils.bytes.utf8.encode("pool_lp_mint")
);
export const TICK_ARRAY_SEED = Buffer.from(
  anchor.utils.bytes.utf8.encode("tick_array")
);

export const OPERATION_SEED = Buffer.from(
  anchor.utils.bytes.utf8.encode("operation")
);

export const ORACLE_SEED = Buffer.from(
  anchor.utils.bytes.utf8.encode("observation")
);

export const TOKEN_PARAMS = {
  // ######
  standard: {
    // must be same as program default params
    targetEras: new BN(1),
    epochesPerEra: new BN("250"),
    targetSecondsPerEpoch: new BN("2000"),
    reduceRatio: new BN("50"),
    initialMintSize: new BN("20000000000000"),
    initialTargetMintSizePerEpoch: new BN("200000000000000"),
    feeRate: new BN("200000000"),
    liquidityTokensRatio: new BN("20"),
  },
  // "meme": { // config for mainnet, 125 - 557 SOL
  //     targetEras: new BN(1),
  //     epochesPerEra: new BN('250'),
  //     targetSecondsPerEpoch: new BN('2000'),
  //     reduceRatio: new BN('75'),
  //     initialMintSize: new BN('100000000000000'),
  //     initialTargetMintSizePerEpoch: new BN('1000000000000000'),
  //     feeRate: new BN('50000000'),
  //     liquidityTokensRatio: new BN('20'),
  // },
  meme: {
    // config for mainnet, 100 - 557 SOL
    targetEras: new BN(1),
    epochesPerEra: new BN("250"),
    targetSecondsPerEpoch: new BN("2000"),
    reduceRatio: new BN("75"),
    initialMintSize: new BN("100000000000000"),
    initialTargetMintSizePerEpoch: new BN("1000000000000000"),
    feeRate: new BN("40000000"),
    liquidityTokensRatio: new BN("20"),
  },
};
