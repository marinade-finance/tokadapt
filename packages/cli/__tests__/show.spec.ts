import { SolanaProvider } from '@saberhq/solana-contrib';
import { AnchorProvider } from '@project-serum/anchor';
import { TokadaptSDK } from '@marinade.finance/tokadapt-sdk';
import shellMatchers from 'jest-shell-matchers';
import { file } from 'tmp-promise';
import { Keypair } from '@solana/web3.js';
import { fs } from 'mz';
import { TokadaptHelper } from '@marinade.finance/tokadapt-sdk/test-helpers/tokadapt';

jest.setTimeout(300000);

beforeAll(() => {
  // calling this will add the matchers
  // by calling expect.extend
  shellMatchers();
});

describe('Show tokadapt',  () => {
  const anchorProvider = AnchorProvider.env();
  const sdk = new TokadaptSDK({
    provider: SolanaProvider.init({
      connection: anchorProvider.connection,
      wallet: anchorProvider.wallet,
      opts: anchorProvider.opts,
    }),
  });

  it('it shows', async () => {
    const tokadaptState = new Keypair();
    
    const { path: tokadaptStatePath, cleanup } = await file();
    await fs.writeFile(
      tokadaptStatePath,
      JSON.stringify(Array.from(tokadaptState.secretKey))
    );

    await TokadaptHelper.create({
      sdk, address:tokadaptState
    });
   
    await expect([
      'pnpm',
      [
        'cli',
        'show',
        '--tokadapt',
        tokadaptStatePath,
      ],
    ]).toHaveMatchingSpawnOutput({
      code: 0,
      stderr: '',
    });

    await cleanup();
  });

  
});
