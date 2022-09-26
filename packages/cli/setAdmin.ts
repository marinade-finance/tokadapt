import { GokiSDK } from '@gokiprotocol/client';
import { TokadaptSDK } from '@marinade.finance/tokadapt-sdk';
import { TokadaptStateWrapper } from '@marinade.finance/tokadapt-sdk/state';
import { Keypair, PublicKey } from '@solana/web3.js';
import { Command } from 'commander';
import { useContext } from './context';
import {
  parseKeypair,
  parsePubkey,
  middleware as m,
} from '@marinade.finance/solana-cli-utils';

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
    .option('--log-only', 'Do not create multisig transaction')
    .option('--community', 'Create community proposal')
    .action(
      async ({
        tokadapt,
        admin,
        newAdmin,
        rentPayer,
        proposer,
        logOnly,
        community,
      }: {
        tokadapt: Promise<PublicKey>;
        admin?: Promise<Keypair>;
        newAdmin: Promise<PublicKey>;
        rentPayer: Promise<Keypair>;
        proposer?: Promise<Keypair>;
        logOnly?: boolean;
        community?: boolean;
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
          logOnly,
          community,
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
  logOnly,
  community = false,
  simulate,
}: {
  tokadapt: TokadaptSDK;
  goki: GokiSDK;
  state: PublicKey;
  admin?: Keypair;
  newAdmin: PublicKey;
  rentPayer?: Keypair;
  proposer?: Keypair;
  logOnly?: boolean;
  community?: boolean;
  simulate?: boolean;
}) {
  const stateWrapper = new TokadaptStateWrapper(tokadapt, state);
  const stateData = await stateWrapper.data();

  if (admin && !stateData.adminAuthority.equals(admin.publicKey)) {
    throw new Error(`Expeced admin ${stateData.adminAuthority.toBase58()}`);
  }

  const middleware: m.Middleware[] = [];
  await m.installMultisigMiddleware({
    middleware,
    goki,
    address: stateData.adminAuthority,
    proposer,
    rentPayer,
    logOnly,
    community,
  });

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

  if (tx.instructions.length === 0) {
    return;
  }

  if (simulate) {
    const result = await tx.simulate();
    console.log(JSON.stringify(result.value));
  } else {
    const result = await tx.confirm();
    console.log(`Tx: ${result.signature}`);
  }
}
