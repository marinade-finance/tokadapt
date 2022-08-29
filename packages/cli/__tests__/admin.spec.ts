import { TokadaptStateWrapper } from '@marinade.finance/tokadapt-sdk/state';
import { Keypair } from '@solana/web3.js';
import { initSDK, shellMatchers, createTokadapt } from '../test-helpers';
import { createTempFileKeypair } from '@marinade.finance/solana-test-utils';
// import { MultisigHelper, MULTISIG_FACTORIES } from '../test-helpers/multisig';
// import { TransactionEnvelope } from '@saberhq/solana-contrib';

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
    const { tokadaptStatePath, cleanup, tokadaptState } = await createTokadapt(
      sdk
    );

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

  it('it sets new admin from filesystem  wallet admin', async () => {
    const { tokadaptStatePath, cleanup, tokadaptState } = await createTokadapt(
      sdk
    );

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
        tokadaptStatePath,
        '--new-admin',
        path,
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
    await cleanupAdmin();
  });

  // const transferAuthority: (
  //   multisig: MultisigHelper
  // ) => Promise<void> = async multisig => {
  //   const txAddress = await multisig.createTransaction(
  //     new TransactionEnvelope(sdk.provider, [
  //       await sdk.program.methods
  //         .acceptAuthority()
  //         .accounts({
  //           authority: multisig.authority,
  //         })
  //         .instruction(),
  //     ])
  //   );
  //   await multisig.executeTransaction(txAddress);
  // };

  // for (const multisigFactory of MULTISIG_FACTORIES) {
  //   describe(`Multisig ${multisigFactory.name}`, () => {
  //     it(`Uses ${multisigFactory.name}`, async () => {
  //       const { tokadaptStatePath, cleanup, tokadaptState, tokadapt } =
  //         await createTokadapt(sdk);

  //       const multisig = await multisigFactory.create({
  //         provider: sdk.provider,
  //       });

  //       const txAddress = await multisig.createTransaction(
  //         new TransactionEnvelope(sdk.provider, [
  //           await tokadapt.state.program.methods
  //             .acceptAuthority()
  //             .accounts({
  //               authority: multisig.authority,
  //             })
  //             .instruction(),
  //         ])
  //       );
  //       await multisig.executeTransaction(txAddress);

  //       await expect([
  //         'pnpm',
  //         ['cli', 'set-admin', '--tokadapt', tokadaptStatePath],
  //       ]).toHaveMatchingSpawnOutput({
  //         code: 0,
  //         stderr: '',
  //       });

  //       cleanup();
  //     });
  //   });
  // }
});
