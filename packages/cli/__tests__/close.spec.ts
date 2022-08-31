import { initSDK, shellMatchers } from '../test-helpers';
import { TokadaptHelper } from '@marinade.finance/tokadapt-sdk/test-helpers/tokadapt';
import BN from 'bn.js';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress } from 'solana-spl-token-modern';

jest.setTimeout(300000);

beforeAll(() => {
  shellMatchers();
});

describe('Close tokadapt', () => {
  const sdk = initSDK();

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
});
