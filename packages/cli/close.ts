import { GokiSDK } from '@gokiprotocol/client';
import { TokadaptSDK } from '@marinade.finance/tokadapt-sdk';
import { TokadaptStateWrapper } from '@marinade.finance/tokadapt-sdk/state';
import { Keypair, PublicKey } from '@solana/web3.js';
import { Command } from 'commander';
import { useContext } from './context';
import { parseKeypair, parsePubkey } from './keyParser';
import { GokiMiddleware, installMiddleware, Middleware } from './middleware';

export function installClose(program: Command) {
  program
    .command('close')
    .requiredOption(
      '--tokadapt <address>',
      'Tokapapt state address',
      parsePubkey,
      Promise.resolve(
        new PublicKey('taspunvVUXLG82PrsCCtQeknWrGHNHWcZmVQYNcQBDg')
      )
    )
    .option('--admin <keypair>', 'Admin', parseKeypair)
    .option('--rent-collector <pubkey>', 'Rent collector', parsePubkey)
    .option('--token-collector <pubkey>', 'Token collector', parsePubkey)
    .option('--rent-payer <keypair>', 'Rent payer', parseKeypair)
    .option('--proposer <keypair>', 'Proposer', parseKeypair)
    .action(
      async ({
        tokadapt,
        admin,
        rentCollector,
        tokenCollector,
        rentPayer,
        proposer,
      }: {
        tokadapt: Promise<PublicKey>;
        admin?: Promise<Keypair>;
        rentCollector?: Promise<PublicKey>;
        tokenCollector?: Promise<PublicKey>;
        rentPayer?: Promise<Keypair>;
        proposer?: Promise<Keypair>;
      }) => {
        const context = useContext();
        await close({
          tokadapt: context.tokadapt,
          goki: context.goki,
          state: await tokadapt,
          admin: await admin,
          rentCollector: await rentCollector,
          tokenCollector: await tokenCollector,
          rentPayer: await rentPayer,
          proposer: await proposer,
          simulate: context.simulate,
        });
      }
    );
}

export async function close({
  tokadapt,
  goki,
  state,
  admin,
  rentCollector,
  tokenCollector,
  rentPayer,
  proposer,
  simulate,
}: {
  tokadapt: TokadaptSDK;
  goki: GokiSDK;
  state: PublicKey;
  admin?: Keypair;
  rentCollector?: PublicKey;
  tokenCollector?: PublicKey;
  rentPayer?: Keypair;
  proposer?: Keypair;
  simulate?: boolean;
}) {
  const stateWrapper = new TokadaptStateWrapper(tokadapt, state);
  const stateData = await stateWrapper.data();
  const middleware: Middleware[] = [];
  await installMiddleware({
    middleware,
    tokadapt,
    goki,
    address: stateData.adminAuthority,
    proposer,
    rentPayer,
  });
  let tx = await stateWrapper.close({
    admin,
    rentCollector,
    tokenCollector,
    rentPayer,
  });

  for (const m of middleware) {
    tx = await m.apply(tx);
  }
  if (admin) {
    tx.addSigners(admin);
  }

  if (simulate) {
    const result = await tx.simulate();
    console.log(JSON.stringify(result.value));
  } else {
    const result = await tx.confirm();
    console.log(`Tx: ${result.signature}`);
  }
}
