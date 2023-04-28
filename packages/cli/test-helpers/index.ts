import { SolanaProvider } from '@saberhq/solana-contrib';
import { AnchorProvider } from '@project-serum/anchor';
import { TokadaptSDK } from '@marinade.finance/tokadapt-sdk';
import { TokadaptHelper } from '@marinade.finance/tokadapt-sdk/test-helpers/tokadapt';

import {
  shellMatchers as untyped,
  createTempFileKeypair,
} from '@marinade.finance/solana-test-utils';

const shellMatchers = untyped as () => void;
export { shellMatchers };

export const initSDK = () => {
  const anchorProvider = AnchorProvider.env();
  const sdk = new TokadaptSDK({
    provider: SolanaProvider.init(anchorProvider),
  });
  return sdk;
};

export const createFileTokadapt = async (sdk: TokadaptSDK) => {
  const {
    path: tokadaptStatePath,
    cleanup,
    keypair: tokadaptState,
  } = await createTempFileKeypair();

  const tokadapt = await TokadaptHelper.create({
    sdk,
    address: tokadaptState,
  });

  return { tokadapt, tokadaptState, tokadaptStatePath, cleanup };
};
