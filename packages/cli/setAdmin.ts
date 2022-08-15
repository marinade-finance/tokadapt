import { GokiSDK, SmartWalletWrapper } from '@gokiprotocol/client';
import { TokadaptSDK } from '@marinade.finance/tokadapt-sdk';
import { TokadaptStateWrapper } from '@marinade.finance/tokadapt-sdk/state';
import { TransactionEnvelope } from '@saberhq/solana-contrib';
import { Keypair, PublicKey } from '@solana/web3.js';
import { Command } from 'commander';
import { useContext } from './context';
import { parseKeypair, parsePubkey } from './keyParser';
import { GokiMiddleware, Middleware } from './middleware';

export function installSetAdmin(program: Command) {
  program
    .command('set-admin')
    .requiredOption(
      '--tokadapt <keypair>',
      'Tokapapt state address',
      parsePubkey,
      Promise.resolve(
        new PublicKey('taspunvVUXLG82PrsCCtQeknWrGHNHWcZmVQYNcQBDg')
      )
    )
    .option('--admin <keypair>', 'Admin', parseKeypair)
    .option('--new-admin <pubkey>', 'New admin', parsePubkey)
    .option('--rent-payer <keypair>', 'Rent payer', parseKeypair)
    .option('--proposer <keypair>', 'Proposer', parseKeypair)
    .action(
      async ({
        tokadapt,
        admin,
        newAdmin,
        rentPayer,
        proposer,
      }: {
        tokadapt: Promise<PublicKey>;
        admin?: Promise<Keypair>;
        newAdmin: Promise<PublicKey>;
        rentPayer: Promise<Keypair>;
        proposer?: Promise<Keypair>;
      }) => {
        const context = useContext();
        await setAdmin({
          tokadapt: context.tokadapt,
          goki: context.goki,
          state: await tokadapt,
          admin: await admin,
          newAdmin: await newAdmin,
          rentPayer: await rentPayer,
          proposer: await proposer,
          simulate: context.simulate,
        });
      }
    );
}

export async function setAdmin({
  tokadapt,
  goki,
  state,
  admin,
  newAdmin,
  rentPayer,
  proposer,
  simulate,
}: {
  tokadapt: TokadaptSDK;
  goki: GokiSDK;
  state: PublicKey;
  admin?: Keypair;
  newAdmin: PublicKey;
  rentPayer?: Keypair;
  proposer?: Keypair;
  simulate?: boolean;
}) {
  const stateWrapper = new TokadaptStateWrapper(tokadapt, state);
  const stateData = await stateWrapper.data();
  const middleware: Middleware[] = [];
  if (!admin) {
    try {
      middleware.push(
        await GokiMiddleware.create({
          sdk: goki,
          account: stateData.adminAuthority,
          proposer: proposer,
          rentPayer: rentPayer,
        })
      );
    } catch {
      /**/
    }
  }
  let tx = await stateWrapper.setAdmin({
    admin,
    newAdmin,
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
