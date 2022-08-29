import { MintHelper } from '@marinade.finance/tokadapt-sdk/test-helpers/mint';
import { TokadaptStateWrapper } from '@marinade.finance/tokadapt-sdk/state';
import { createTempFileKeypair } from '@marinade.finance/solana-test-utils';
import { initSDK, shellMatchers } from '../test-helpers';

jest.setTimeout(300000);

beforeAll(() => {
  // calling this will add the matchers
  // by calling expect.extend
  shellMatchers();
});

describe('Create tokadapt', () => {
  const sdk = initSDK();

  it('is creating with default parameters', async () => {
    const {
      path: tokadaptStatePath,
      cleanup,
      keypair: tokadaptState,
    } = await createTempFileKeypair();
    const inputMint = await MintHelper.create({
      provider: sdk.provider,
    });
    const outputMint = await MintHelper.create({
      provider: sdk.provider,
    });

    await expect([
      'pnpm',
      [
        'cli',
        'create',
        '--tokadapt',
        tokadaptStatePath,
        '--input-mint',
        inputMint.address,
        '--output-mint',
        outputMint.address,
      ],
    ]).toHaveMatchingSpawnOutput({
      code: 0,
      stderr: '',
    });

    const tokadaptStateWrapper = new TokadaptStateWrapper(
      sdk,
      tokadaptState.publicKey
    );
    await expect(tokadaptStateWrapper.data()).resolves.toBeTruthy();
    const tokadapStateData = await tokadaptStateWrapper.data();
    expect(tokadapStateData.inputMint.toBase58()).toBe(
      inputMint.address.toBase58()
    );
    expect(tokadapStateData.adminAuthority.toBase58()).toBe(
      sdk.provider.walletKey.toBase58()
    );

    await cleanup();
  });

  it('is fails if input mint not passed', async () => {
    const {
      path: tokadaptStatePath,
      cleanup,
      keypair: tokadaptState,
    } = await createTempFileKeypair();

    await expect([
      'pnpm',
      ['cli', 'create', '--tokadapt', tokadaptStatePath],
    ]).toHaveMatchingSpawnOutput({
      code: 1,
      stderr: /error: required option '--input-mint <pubkey>' not specified/,
    });

    await cleanup();
  });
});
