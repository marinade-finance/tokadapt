import { AnchorProvider } from '@project-serum/anchor';
import { SolanaProvider } from '@saberhq/solana-contrib';
import { getAssociatedTokenAddress } from 'solana-spl-token-modern';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BN } from 'bn.js';
import { TokadaptSDK } from '../sdk';
import { TokadaptHelper } from '../test-helpers/tokadapt';
import { MULTISIG_FACTORIES } from '@marinade.finance/solana-test-utils';
import { KedgereeSDK } from '@marinade.finance/kedgeree-sdk';

jest.setTimeout(30000);

describe('tokadapt-sdk', () => {
  const anchorProvider = AnchorProvider.env();
  const sdk = new TokadaptSDK({
    provider: SolanaProvider.init({
      connection: anchorProvider.connection,
      wallet: anchorProvider.wallet,
      opts: anchorProvider.opts,
    }),
  });
  const kedgeree = new KedgereeSDK({
    provider: sdk.provider,
  });

  it('Initializes', async () => {
    const tokadapt = await TokadaptHelper.create({
      sdk,
    });
    const data = await tokadapt.state.data();
    expect(data.adminAuthority.toBase58()).toBe(
      sdk.provider.walletKey.toBase58()
    );
    expect(data.inputMint.toBase58()).toBe(
      tokadapt.inputMint.address.toBase58()
    );
    expect((await tokadapt.state.outputMint()).toBase58()).toBe(
      tokadapt.outputMint.address.toBase58()
    );
  });

  describe('set-admin', () => {
    it('can set admin', async () => {
      const tokadapt = await TokadaptHelper.create({
        sdk,
      });
      const newAdmin = new Keypair().publicKey;
      const tx = await tokadapt.state.setAdmin({
        newAdmin,
      });
      await expect(tx.confirm()).resolves.toBeDefined();
      const { adminAuthority } = await tokadapt.state.reload();
      expect(adminAuthority.toBase58()).toBe(newAdmin.toBase58());
    });

    for (const multisigFactory of MULTISIG_FACTORIES) {
      it(`Can setAdmin with ${multisigFactory.name}`, async () => {
        const multisig = await multisigFactory.create({
          kedgeree,
        });
        const tokadapt = await TokadaptHelper.create({
          sdk,
          admin: multisig,
        });
        const newAdmin = new Keypair().publicKey;
        const tx = await tokadapt.state.setAdmin({
          newAdmin,
        });
        await expect(
          multisig.runTx(tx).then(t => t.length)
        ).resolves.toBeGreaterThan(0);

        const { adminAuthority } = await tokadapt.state.reload();
        expect(adminAuthority.toBase58()).toBe(newAdmin.toBase58());
      });
    }
  });

  it('Can be closed', async () => {
    const tokadapt = await TokadaptHelper.create({
      sdk,
    });
    const STORING_AMOUNT = new BN(3 * LAMPORTS_PER_SOL);
    await tokadapt.fillStorage(STORING_AMOUNT);
    const { outputStorage } = await tokadapt.state.data();

    const stateRent = await sdk.provider.connection.getBalance(
      tokadapt.state.address
    );
    const storageRent = await sdk.provider.connection.getBalance(outputStorage);

    const rentCollector = new Keypair().publicKey;
    const tx = await tokadapt.state.close({
      rentCollector,
    });
    await tx.confirm();

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

  it('Is swapping all!', async () => {
    const tokadapt = await TokadaptHelper.create({
      sdk,
    });
    const STORING_AMOUNT = new BN(3 * LAMPORTS_PER_SOL);
    await tokadapt.fillStorage(STORING_AMOUNT);
    const SWAPPING_AMOUNT = new BN(2 * LAMPORTS_PER_SOL);
    await tokadapt.inputMint.mintTo({
      amount: SWAPPING_AMOUNT,
    });
    const tx = await tokadapt.state.swap({});
    await tx.confirm();

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
