import { file } from 'tmp-promise';
import { Keypair, PublicKey } from '@solana/web3.js';
import { fs } from 'mz';

import { SolanaProvider } from '@saberhq/solana-contrib';
import { AnchorProvider, BN } from '@project-serum/anchor';
import { TokadaptSDK } from '@marinade.finance/tokadapt-sdk';
import { TokadaptHelper } from '@marinade.finance/tokadapt-sdk/test-helpers/tokadapt';

import shellMatchers from 'jest-shell-matchers';

// TODO MOVE TO TEST UTIL LIB
export const createFileKeypair = async (seed?: Keypair) => {
  const keypair = seed ?? new Keypair();

  const { path, cleanup } = await file();
  await fs.writeFile(path, JSON.stringify(Array.from(keypair.secretKey)));
  return { path, cleanup, keypair };
};

export { shellMatchers };

// tokadapt specifc helpers

export const initSDK = () => {
  const anchorProvider = AnchorProvider.env();
  const sdk = new TokadaptSDK({
    provider: SolanaProvider.init(anchorProvider),
  });
  return sdk;
};

export const createTokadapt = async (sdk: TokadaptSDK, admin?: PublicKey) => {
  const {
    path: tokadaptStatePath,
    cleanup,
    keypair: tokadaptState,
  } = await createFileKeypair();

  const tokadapt = await TokadaptHelper.create({
    sdk,
    address: tokadaptState,
    admin,
  });

  return { tokadapt, tokadaptState, tokadaptStatePath, cleanup };
};
