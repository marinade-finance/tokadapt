import { TokadaptStateWrapper } from '@marinade.finance/tokadapt-sdk/state';
import { Keypair } from '@solana/web3.js';
import { initSDK, shellMatchers, createFileTokadapt } from '../test-helpers';
import { createTempFileKeypair } from '@marinade.finance/solana-test-utils';
import { TokadaptHelper } from '@marinade.finance/tokadapt-sdk/test-helpers/tokadapt';

jest.setTimeout(300000);

beforeAll(() => {
  shellMatchers();
});

describe('Set tokadapt admin', () => {
  const sdk = initSDK();

  it('it sets admin with goki middleware', async () => {
    const { tokadaptStatePath, cleanup } = await createFileTokadapt(sdk);

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
    const tokadapt = await TokadaptHelper.create({ sdk });

    const newAdmin = new Keypair();

    await expect([
      'pnpm',
      [
        'cli',
        'set-admin',
        '--tokadapt',
        tokadapt.state.address.toString(),
        '--new-admin',
        newAdmin.publicKey.toString(),
      ],
    ]).toHaveMatchingSpawnOutput({
      code: 0,
      stderr: '',
    });

    const tokadaptStateWrapper = new TokadaptStateWrapper(
      sdk,
      tokadapt.state.address
    );

    await expect(tokadaptStateWrapper.data()).resolves.toBeTruthy();
    const tokadapStateData = await tokadaptStateWrapper.data();

    expect(tokadapStateData.adminAuthority.toBase58()).toEqual(
      newAdmin.publicKey.toBase58()
    );
  });

  it('it sets new admin from filesystem  wallet admin', async () => {
    const tokadapt = await TokadaptHelper.create({ sdk });

    const {
      path,
      keypair: newAdmin,
      cleanup: cleanupAdmin,
    } = await createTempFileKeypair();

    await expect([
      'pnpm',
      [
        'cli',
        'set-admin',
        '--tokadapt',
        tokadapt.state.address.toString(),
        '--new-admin',
        path,
      ],
    ]).toHaveMatchingSpawnOutput({
      code: 0,
      stderr: '',
    });

    const tokadaptStateWrapper = new TokadaptStateWrapper(
      sdk,
      tokadapt.state.address
    );

    await expect(tokadaptStateWrapper.data()).resolves.toBeTruthy();
    const tokadapStateData = await tokadaptStateWrapper.data();

    expect(tokadapStateData.adminAuthority.toBase58()).toEqual(
      newAdmin.publicKey.toBase58()
    );

    await cleanupAdmin();
  });
});
