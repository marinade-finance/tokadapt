import { BN } from '@project-serum/anchor';

import { LAMPORTS_PER_SOL } from '@solana/web3.js';

import { initSDK, shellMatchers, createFileTokadapt } from '../test-helpers';

jest.setTimeout(300000);

beforeAll(() => {
  shellMatchers();
});

describe('Swap tokadapt', () => {
  const sdk = initSDK();

  it('it swaps all', async () => {
    const { tokadaptStatePath, cleanup, tokadapt } = await createFileTokadapt(
      sdk
    );

    const STORING_AMOUNT = new BN(3 * LAMPORTS_PER_SOL);
    await tokadapt.fillStorage(STORING_AMOUNT);
    const SWAPPING_AMOUNT = new BN(2 * LAMPORTS_PER_SOL);
    await tokadapt.inputMint.mintTo({
      amount: SWAPPING_AMOUNT,
    });

    await expect([
      'pnpm',
      ['cli', 'swap', '--tokadapt', tokadaptStatePath],
    ]).toHaveMatchingSpawnOutput({
      code: 0,
      stderr: '',
    });

    await cleanup();
  });
});
