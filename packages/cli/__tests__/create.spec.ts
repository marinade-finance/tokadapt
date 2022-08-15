import { MintHelper } from '@marinade.finance/tokadapt-sdk/test-helpers/mint';
import { SolanaProvider } from '@saberhq/solana-contrib';
import { AnchorProvider } from '@project-serum/anchor';
import { TokadaptSDK } from '@marinade.finance/tokadapt-sdk';
import shellMatchers from 'jest-shell-matchers';
import { file } from 'tmp-promise';
import { Keypair } from '@solana/web3.js';
import { fs } from 'mz';
import { TokadaptStateWrapper } from '@marinade.finance/tokadapt-sdk/state';

jest.setTimeout(300000);

beforeAll(() => {
  // calling this will add the matchers
  // by calling expect.extend
  shellMatchers();
});

describe('Create tokadapt', () => {
  const anchorProvider = AnchorProvider.env();
  const sdk = new TokadaptSDK({
    provider: SolanaProvider.init({
      connection: anchorProvider.connection,
      wallet: anchorProvider.wallet,
      opts: anchorProvider.opts,
    }),
  });

  it('is creating with default parameters', async () => {
    const tokadaptState = new Keypair();
    const { path: tokadaptStatePath, cleanup } = await file();
    await fs.writeFile(
      tokadaptStatePath,
      JSON.stringify(Array.from(tokadaptState.secretKey))
    );
    const inputMint = await MintHelper.create({
      provider: sdk.provider,
    });
    const outputMint = await MintHelper.create({
      provider: sdk.provider,
    });
    await expect([
      'pnpm',
      [
        'cli',
        'create',
        '--tokadapt',
        tokadaptStatePath,
        '--input-mint',
        inputMint.address,
        '--output-mint',
        outputMint.address,
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
    expect(tokadapStateData.inputMint.toBase58()).toBe(
      inputMint.address.toBase58()
    );
    expect(tokadapStateData.adminAuthority.toBase58()).toBe(
      sdk.provider.walletKey.toBase58()
    );

    await cleanup();
  });
});
