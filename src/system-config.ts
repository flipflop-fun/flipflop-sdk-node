import { Connection, PublicKey } from '@solana/web3.js';
import { initProviderNoSigner } from './utils';
import { SYSTEM_CONFIG_SEEDS } from './constants';
import { CONFIGS, getNetworkType } from './config';
import { SystemConfigAccountData, SystemConfigAccountOptions } from './types';

export const getSystemConfig = async (options: SystemConfigAccountOptions): Promise<SystemConfigAccountData> => {
  // Validate required parameters
  if (!options.rpc) {
    throw new Error('Missing --rpc parameter');
  }

  const rpc = new Connection(options.rpc, 'confirmed');
  const config = CONFIGS[getNetworkType(options.rpc)];
  const { program, programId } = await initProviderNoSigner(rpc);

  try {
    const [systemConfigAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from(SYSTEM_CONFIG_SEEDS), new PublicKey(config.systemManagerAccount).toBuffer()],
      programId
    );
    const systemConfigAccountInfo = await program.account.systemConfigData.fetch(systemConfigAccount);
    if (!systemConfigAccountInfo) {
      throw new Error('❌ Failed to get system config account data');
    }
    return {
      systemConfigAccount,
      systemManagerAccount: new PublicKey(config.systemManagerAccount),
      ...systemConfigAccountInfo,
      count: systemConfigAccountInfo.count.toNumber(),
      refundFeeRate: systemConfigAccountInfo.refundFeeRate,
      referrerResetIntervalSeconds: systemConfigAccountInfo.referrerResetIntervalSeconds.toNumber(),
      updateMetadataFee: systemConfigAccountInfo.updateMetadataFee.toNumber() / 1e9,
      customizedDeployFee: systemConfigAccountInfo.customizedDeployFee.toNumber() / 1e9,
      initPoolWsolAmount: systemConfigAccountInfo.initPoolWsolAmount.toNumber() / 100000,
      graduateFeeRate: systemConfigAccountInfo.graduateFeeRate.toNumber(),
      minGraduateFee: systemConfigAccountInfo.minGraduateFee.toNumber() / 1e9,
      raydiumCpmmCreateFee: systemConfigAccountInfo.raydiumCpmmCreateFee.toNumber() / 1e9,
    };
  } catch (error) {
    throw new Error('❌ Error displaying system config information:' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}