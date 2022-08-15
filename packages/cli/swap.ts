import { TokadaptSDK } from '@marinade.finance/tokadapt-sdk';
import { TokadaptStateWrapper } from '@marinade.finance/tokadapt-sdk/state';
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { Command } from 'commander';
import { parseKeypair, parsePubkey } from './keyParser';
import BN from 'bn.js';
import { useContext } from './context';

export function installSwap(program: Command) {
  program
    .command('swap')
    .requiredOption(
      '--tokadapt <keypair>',
      'Tokapapt state address',
      parsePubkey,
      Promise.resolve(
        new PublicKey('taspunvVUXLG82PrsCCtQeknWrGHNHWcZmVQYNcQBDg')
      )
    )
    .option(
      '--amount <number>',
      'Amount',
      value => new BN(parseFloat(value) * LAMPORTS_PER_SOL)
    )
    .option('--input-signer <keypair>', 'Input signer', parseKeypair)
    .option('--input <address>', 'Input token account', parsePubkey)
    .option('--output-authority <pubkey>', 'Output authority', parsePubkey)
    .option('--output <address>', 'Output token account', parsePubkey)
    .option('--rent-payer <keypair>', 'Rent payer', parseKeypair)
    .action(
      async ({
        tokadapt,
        amount,
        inputSigner,
        input,
        outputAuthority,
        output,
        rentPayer,
      }: {
        tokadapt: Promise<PublicKey>;
        amount?: BN;
        inputSigner?: Promise<Keypair>;
        input?: Promise<PublicKey>;
        outputAuthority?: Promise<PublicKey>;
        output?: Promise<PublicKey>;
        rentPayer?: Promise<Keypair>;
      }) => {
        const context = useContext();
        await swap({
          tokadapt: context.tokadapt,
          state: await tokadapt,
          amount,
          inputSigner: await inputSigner,
          input: await input,
          outputAuthority: await outputAuthority,
          output: await output,
          rentPayer: await rentPayer,
          simulate: context.simulate,
        });
      }
    );
}

export async function swap({
  tokadapt,
  state,
  amount,
  inputSigner,
  input,
  outputAuthority,
  output,
  rentPayer,
  simulate,
}: {
  tokadapt: TokadaptSDK;
  state: PublicKey;
  amount?: BN;
  inputSigner?: Keypair;
  input?: PublicKey;
  outputAuthority?: PublicKey;
  output?: PublicKey;
  rentPayer?: Keypair;
  simulate?: boolean;
}) {
  const stateWrapper = new TokadaptStateWrapper(tokadapt, state);
  const tx = await stateWrapper.swap({
    amount,
    inputSigner,
    input,
    outputAuthority,
    output,
    rentPayer,
  });

  if (simulate) {
    const result = await tx.simulate();
    console.log(JSON.stringify(result.value));
  } else {
    const result = await tx.confirm();
    console.log(`Tx: ${result.signature}`);
  }
}
