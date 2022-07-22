import { AnchorProvider } from '@project-serum/anchor';
import { SolanaProvider } from '@saberhq/solana-contrib';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import {
  Keypair,
  LAMPORTS_PER_SOL,
  ParsedAccountData,
  PublicKey,
} from '@solana/web3.js';
import { BN } from 'bn.js';
import { TokadaptSDK } from '../sdk';
import { TokadaptHelper } from '../test-helpers/tokadapt';

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

  it('Can be closed', async () => {
    const tokadapt = await TokadaptHelper.create({
      sdk,
    });
    const STORING_AMOUNT = new BN(3 * LAMPORTS_PER_SOL);
    await tokadapt.fillStorage(STORING_AMOUNT);
    const tokadaptData = await tokadapt.state.data();

    const stateRent = await sdk.provider.connection.getBalance(
      tokadapt.state.address
    );
    const storageRent = await sdk.provider.connection.getBalance(
      tokadaptData.outputStorage
    );

    const rentCollector = new Keypair().publicKey;
    const tx = await tokadapt.state.close({
      rentCollector,
    });
    await tx.confirm();

    expect(
      await sdk.provider.connection.getBalance(rentCollector)
    ).toStrictEqual(stateRent + storageRent);
    const tokenCollector = await getAssociatedTokenAddress(
      await tokadapt.state.outputMint(),
      rentCollector
    );
    const tokenCollectorBalance =
      await sdk.provider.connection.getTokenAccountBalance(tokenCollector);
    expect(tokenCollectorBalance.value.amount).toBe(STORING_AMOUNT.toString());
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
    const inputBalance = await sdk.provider.connection.getTokenAccountBalance(
      await getAssociatedTokenAddress(
        tokadapt.inputMint.address,
        sdk.provider.walletKey
      )
    );
    expect(inputBalance.value.amount).toBe('0');
    const outputBalance = await sdk.provider.connection.getTokenAccountBalance(
      await getAssociatedTokenAddress(
        tokadapt.outputMint.address,
        sdk.provider.walletKey
      )
    );
    expect(outputBalance.value.amount).toBe(SWAPPING_AMOUNT.toString());
  });
});
