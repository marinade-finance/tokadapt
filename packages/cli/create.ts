import { TokadaptSDK } from '@marinade.finance/tokadapt-sdk';
import { TokadaptStateWrapper } from '@marinade.finance/tokadapt-sdk/state';
import { Keypair, PublicKey } from '@solana/web3.js';
import { Command } from 'commander';
import { useContext } from './context';
import { parseKeypair, parsePubkey, parsePubkeyOrKeypair } from '@marinade.finance/solana-cli-utils';

export function installCreate(program: Command) {
  program
    .command('create')
    .option('--tokadapt <keypair>', 'Tokapapt state address', parseKeypair)
    .option('--admin <pubkey>', 'Admin', parsePubkey)
    .requiredOption('--input-mint <pubkey>', 'Input mint', parsePubkey)
    .option(
      '--output-storage <pubkey|keypair>',
      'Output storage',
      parsePubkeyOrKeypair
    )
    .option('--output-mint <pubkey>', 'Output mint', parsePubkey)
    .option('--rent-payer <keypair>', 'Rent payer', parseKeypair)
    .action(
      async ({
        tokadapt,
        admin,
        inputMint,
        outputStorage,
        outputMint,
        rentPayer,
      }: {
        tokadapt: Promise<Keypair>;
        admin?: Promise<PublicKey>;
        inputMint: Promise<PublicKey>;
        outputStorage?: Promise<PublicKey | Keypair>;
        outputMint?: Promise<PublicKey>;
        rentPayer?: Promise<Keypair>;
      }) => {
        const context = useContext();
        await create({
          tokadapt: context.tokadapt,
          state: await tokadapt,
          admin: await admin,
          inputMint: await inputMint,
          outputStorage: await outputStorage,
          outputMint: await outputMint,
          rentPayer: await rentPayer,
          simulate: context.simulate,
        });
      }
    );
}

export async function create({
  tokadapt,
  state = new Keypair(),
  admin,
  inputMint,
  outputStorage,
  outputMint,
  rentPayer,
  simulate,
}: {
  tokadapt: TokadaptSDK;
  state?: Keypair;
  admin?: PublicKey;
  inputMint: PublicKey;
  outputStorage?: PublicKey | Keypair;
  outputMint?: PublicKey;
  rentPayer?: Keypair;
  simulate?: boolean;
}) {
  console.log(`Create tokadapt ${state.publicKey.toBase58()}`);
  const { tx } = await TokadaptStateWrapper.create({
    sdk: tokadapt,
    address: state,
    admin,
    inputMint,
    outputStorage,
    outputMint,
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
