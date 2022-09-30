import { Keypair } from '@solana/web3.js';
import { initSDK, shellMatchers, createFileTokadapt } from '../test-helpers';
import { createTempFileKeypair } from '@marinade.finance/solana-test-utils';
import { TokadaptHelper } from '@marinade.finance/tokadapt-sdk/test-helpers/tokadapt';

import {
  MULTISIG_FACTORIES,
  KeypairSignerHelper,
} from '@marinade.finance/solana-test-utils';
import BN from 'bn.js';
import { KedgereeSDK } from '@marinade.finance/kedgeree-sdk';

jest.setTimeout(300000);

beforeAll(() => {
  shellMatchers();
});

describe('Set tokadapt admin', () => {
  const sdk = initSDK();
  const kedgeree = new KedgereeSDK({
    provider: sdk.provider,
  });

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

  it('it sets new admin using filesystem wallet admin', async () => {
    const { path, keypair: admin, cleanup } = await createTempFileKeypair();

    const tokadapt = await TokadaptHelper.create({
      sdk,
      admin: new KeypairSignerHelper(admin),
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

  for (const multisigFactory of MULTISIG_FACTORIES) {
    describe(`Multisig ${multisigFactory.name}`, () => {
      it(`Sets admin using ${multisigFactory.name}`, async () => {
        const multisig = await multisigFactory.create({
          kedgeree,
        });

        const tokadapt = await TokadaptHelper.create({ sdk, admin: multisig });
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
          ].concat(multisigFactory.side === 'community' ? ['--community'] : []),
        ]).toHaveMatchingSpawnOutput({
          code: 0,
          stderr: '',
        });

        await expect(
          multisig.executeAllPending().then(t => t.length)
        ).resolves.toBeGreaterThan(0);

        const { adminAuthority } = await tokadapt.state.reload();

        expect(adminAuthority.toBase58()).toEqual(
          newAdmin.publicKey.toBase58()
        );
      });

      it(`Sets admin using ${multisigFactory.name} with filesystem proposer`, async () => {
        const {
          path,
          keypair: proposer,
          cleanup,
        } = await createTempFileKeypair();

        const multisig = await multisigFactory.create({
          kedgeree,
          members: [
            new KeypairSignerHelper(proposer),
            new KeypairSignerHelper(new Keypair()),
            new KeypairSignerHelper(new Keypair()),
          ],
          threshold: 2,
        });

        const tokadapt = await TokadaptHelper.create({
          sdk,
          admin: multisig,
        });

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
            '--proposer',
            path,
          ].concat(multisigFactory.side === 'community' ? ['--community'] : []),
        ]).toHaveMatchingSpawnOutput({
          code: 0,
          stderr: '',
        });

        await expect(
          multisig.executeAllPending().then(t => t.length)
        ).resolves.toBeGreaterThan(0);

        const { adminAuthority } = await tokadapt.state.reload();

        expect(adminAuthority.toBase58()).toEqual(
          newAdmin.publicKey.toBase58()
        );

        cleanup();
      });
    });
  }
});
