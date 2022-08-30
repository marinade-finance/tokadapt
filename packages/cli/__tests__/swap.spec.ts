import { BN } from '@project-serum/anchor';

import { LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import { TokadaptHelper } from '@marinade.finance/tokadapt-sdk/test-helpers/tokadapt';

import { initSDK, shellMatchers } from '../test-helpers';

jest.setTimeout(300000);

beforeAll(() => {
  shellMatchers();
});

describe('Swap tokadapt', () => {
  const sdk = initSDK();

  it('it swaps all', async () => {
    const tokadapt = await TokadaptHelper.create({ sdk });

    const STORING_AMOUNT = new BN(3 * LAMPORTS_PER_SOL);
    await tokadapt.fillStorage(STORING_AMOUNT);
    const SWAPPING_AMOUNT = new BN(2 * LAMPORTS_PER_SOL);
    await tokadapt.inputMint.mintTo({
      amount: SWAPPING_AMOUNT,
    });

    await expect([
      'pnpm',
      ['cli', 'swap', '--tokadapt', tokadapt.state.address.toString()],
    ]).toHaveMatchingSpawnOutput({
      code: 0,
      stderr: '',
    });
  });
});
