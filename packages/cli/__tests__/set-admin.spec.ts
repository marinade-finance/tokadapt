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

  it('it sets admin from file wallet', async () => {
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

    const { adminAuthority } = await tokadapt.state.reload();

    expect(adminAuthority.toBase58()).toEqual(newAdmin.publicKey.toBase58());
  });

  it('it sets new admin using original admin signature', async () => {
    const { path, keypair: admin, cleanup } = await createTempFileKeypair();

    const tokadapt = await TokadaptHelper.create({
      sdk,
      admin: admin.publicKey,
    });

    const newAdmin = new Keypair();

    await expect([
      'pnpm',
      [
        'cli',
        'set-admin',
        '--tokadapt',
        tokadapt.state.address.toString(),
        '--admin',
        path,
        '--new-admin',
        newAdmin.publicKey.toString(),
      ],
    ]).toHaveMatchingSpawnOutput({
      code: 0,
      stderr: '',
    });

    const { adminAuthority } = await tokadapt.state.reload();

    expect(adminAuthority.toBase58()).toEqual(newAdmin.publicKey.toBase58());

    await cleanup();
  });
});
