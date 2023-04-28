import { initSDK, shellMatchers } from '../test-helpers';
import { TokadaptHelper } from '@marinade.finance/tokadapt-sdk/test-helpers/tokadapt';
import BN from 'bn.js';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress } from 'solana-spl-token-modern';
import {
  createTempFileKeypair,
  KeypairSignerHelper,
  MULTISIG_FACTORIES,
} from '@marinade.finance/solana-test-utils';
import { KedgereeSDK } from '@marinade.finance/kedgeree-sdk';

jest.setTimeout(300000);

beforeAll(() => {
  shellMatchers();
});

describe('Close tokadapt', () => {
  const sdk = initSDK();
  const kedgeree = new KedgereeSDK({
    provider: sdk.provider,
  });

  it('it closes', async () => {
    const tokadapt = await TokadaptHelper.create({ sdk });
    const STORING_AMOUNT = new BN(3 * LAMPORTS_PER_SOL);
    await tokadapt.fillStorage(STORING_AMOUNT);
    const { outputStorage } = await tokadapt.state.data();

    const stateRent = await sdk.provider.connection.getBalance(
      tokadapt.state.address
    );
    const storageRent = await sdk.provider.connection.getBalance(outputStorage);

    const rentCollector = new Keypair().publicKey;

    await expect([
      'pnpm',
      [
        'cli',
        'close',
        '--tokadapt',
        tokadapt.state.address.toString(),
        '--rent-collector',
        rentCollector.toBase58(),
      ],
    ]).toHaveMatchingSpawnOutput({
      code: 0,
      stderr: '',
    });

    expect(
      sdk.provider.getAccountInfo(tokadapt.state.address)
    ).resolves.toBeNull();
    expect(
      sdk.provider.connection.getBalance(rentCollector)
    ).resolves.toStrictEqual(stateRent + storageRent);
    const tokenCollector = await getAssociatedTokenAddress(
      tokadapt.outputMint.address,
      rentCollector
    );
    expect(
      sdk.provider.connection
        .getTokenAccountBalance(tokenCollector)
        .then(b => b.value.amount)
    ).resolves.toBe(STORING_AMOUNT.toString());
  });

  it('it closes using filesystem wallet admin', async () => {
    const { path, keypair: admin } = await createTempFileKeypair();

    const tokadapt = await TokadaptHelper.create({
      sdk,
      admin: new KeypairSignerHelper(admin),
    });

    await expect([
      'pnpm',
      [
        'cli',
        'close',
        '--tokadapt',
        tokadapt.state.address.toString(),
        '--admin',
        path,
      ],
    ]).toHaveMatchingSpawnOutput({
      code: 0,
      stderr: '',
    });

    expect(
      sdk.provider.getAccountInfo(tokadapt.state.address)
    ).resolves.toBeNull();
  });

  for (const multisigFactory of MULTISIG_FACTORIES) {
    describe(`Multisig ${multisigFactory.name}`, () => {
      it(`Closes using ${multisigFactory.name}`, async () => {
        const multisig = await multisigFactory.create({
          kedgeree,
        });

        const tokadapt = await TokadaptHelper.create({ sdk, admin: multisig });

        await expect([
          'pnpm',
          [
            'cli',
            'close',
            '--tokadapt',
            tokadapt.state.address.toString(),
          ].concat(multisigFactory.side === 'community' ? ['--community'] : []),
        ]).toHaveMatchingSpawnOutput({
          code: 0,
          stderr: '',
        });

        await expect(
          multisig.executeAllPending().then(t => t.length)
        ).resolves.toBeGreaterThan(0);

        expect(
          sdk.provider.getAccountInfo(tokadapt.state.address)
        ).resolves.toBeNull();
      });
      it(`Closes using ${multisigFactory.name} with filesystem proposer`, async () => {
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

        await expect([
          'pnpm',
          [
            'cli',
            'close',
            '--tokadapt',
            tokadapt.state.address.toString(),
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

        expect(
          sdk.provider.getAccountInfo(tokadapt.state.address)
        ).resolves.toBeNull();

        cleanup();
      });
    });
  }
});
