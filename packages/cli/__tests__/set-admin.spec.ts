import { Keypair } from '@solana/web3.js';
import { initSDK, shellMatchers, createFileTokadapt } from '../test-helpers';
import { createTempFileKeypair } from '@marinade.finance/solana-test-utils';
import { TokadaptHelper } from '@marinade.finance/tokadapt-sdk/test-helpers/tokadapt';

import {
  MULTISIG_FACTORIES,
  KeypairSignerHelper,
} from '@marinade.finance/solana-test-utils';
import BN from 'bn.js';

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
          provider: sdk.provider,
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
          ],
        ]).toHaveMatchingSpawnOutput({
          code: 0,
          stderr: '',
        });

        await multisig.reload();

        for (
          let index = 0;
          index < multisig.numTransactions.toNumber();
          index++
        ) {
          const txKey = await multisig.transactionByIndex(new BN(index));
          await multisig.executeTransaction(txKey);
        }

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
          provider: sdk.provider,
          members: [proposer, new Keypair(), new Keypair()],
          threshold: new BN(2),
          includeWallet: false,
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
          ],
        ]).toHaveMatchingSpawnOutput({
          code: 0,
          stderr: '',
        });

        await multisig.reload();

        for (
          let index = 0;
          index < multisig.numTransactions.toNumber();
          index++
        ) {
          const txKey = await multisig.transactionByIndex(new BN(index));
          await multisig.executeTransaction(txKey);
        }

        const { adminAuthority } = await tokadapt.state.reload();

        expect(adminAuthority.toBase58()).toEqual(
          newAdmin.publicKey.toBase58()
        );

        cleanup();
      });
    });
  }
});
