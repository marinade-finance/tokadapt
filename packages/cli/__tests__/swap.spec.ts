import { BN } from '@project-serum/anchor';

import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TokadaptHelper } from '@marinade.finance/tokadapt-sdk/test-helpers/tokadapt';

import { initSDK, shellMatchers } from '../test-helpers';
import { getAssociatedTokenAddress } from 'solana-spl-token-modern';

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

    const inputAccount = await getAssociatedTokenAddress(
      tokadapt.inputMint.address,
      sdk.provider.walletKey
    );
    expect(
      sdk.provider.connection
        .getTokenAccountBalance(inputAccount)
        .then(b => b.value.amount)
    ).resolves.toBe('0');

    const outputAccount = await getAssociatedTokenAddress(
      tokadapt.outputMint.address,
      sdk.provider.walletKey
    );
    expect(
      sdk.provider.connection
        .getTokenAccountBalance(outputAccount)
        .then(b => b.value.amount)
    ).resolves.toBe(SWAPPING_AMOUNT.toString());
  });
});
