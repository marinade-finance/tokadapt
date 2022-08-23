import { TokadaptStateWrapper } from '@marinade.finance/tokadapt-sdk/state';
import { Keypair } from '@solana/web3.js';
import { initSDK, shellMatchers, createTokadapt } from '../test-helpers';

jest.setTimeout(300000);

beforeAll(() => {
  shellMatchers();
});

describe('Admin tokadapt', () => {
  const sdk = initSDK();

  it('it sets admin with goki middleware', async () => {
    const { tokadaptStatePath, cleanup } = await createTokadapt(sdk);

    await expect([
      'pnpm',
      ['cli', 'set-admin', '--tokadapt', tokadaptStatePath],
    ]).toHaveMatchingSpawnOutput({
      code: 0,
      stderr: '',
    });

    await cleanup();
  });

  it('it sets new admin from key', async () => {
    const { tokadaptStatePath, cleanup, tokadapt, tokadaptState } =
      await createTokadapt(sdk);

    const newAdmin = new Keypair();

    await expect([
      'pnpm',
      [
        'cli',
        'set-admin',
        '--tokadapt',
        tokadaptStatePath,
        '--new-admin',
        newAdmin.publicKey.toString(),
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

    expect(tokadapStateData.adminAuthority.toBase58()).toEqual(
      newAdmin.publicKey.toBase58()
    );

    await cleanup();
  });
});