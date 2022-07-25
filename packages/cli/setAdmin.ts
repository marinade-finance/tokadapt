import { GokiSDK, SmartWalletWrapper } from '@gokiprotocol/client';
import { TokadaptSDK } from '@marinade.finance/tokadapt-sdk';
import { TokadaptStateWrapper } from '@marinade.finance/tokadapt-sdk/state';
import { TransactionEnvelope } from '@saberhq/solana-contrib';
import { Keypair, PublicKey } from '@solana/web3.js';
import { Command } from 'commander';
import { useContext } from './context';
import { parseKeypair, parsePubkey } from './keyParser';

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
  let tx: TransactionEnvelope;
  const stateWrapper = new TokadaptStateWrapper(tokadapt, state);
  const stateData = await stateWrapper.data();
  let smartWalletWrapper: SmartWalletWrapper | undefined;
  if (!admin) {
    try {
      smartWalletWrapper = await goki.loadSmartWallet(stateData.adminAuthority);
      console.log('Using GOKI smart wallet');
    } catch {
      /**/
    }
  }
  const setAdminTx = await stateWrapper.setAdmin({
    admin,
    newAdmin,
  });
  if (smartWalletWrapper) {
    const {
      tx: newTransactionTx,
      transactionKey,
      index,
    } = await smartWalletWrapper.newTransactionFromEnvelope({
      tx: setAdminTx,
      proposer: proposer?.publicKey,
      payer: rentPayer?.publicKey,
    });
    console.log(`Creating GOKI tx #${index}) ${transactionKey.toBase58()}`);
    tx = newTransactionTx;
    if (proposer) {
      tx.addSigners(proposer);
    }
    if (rentPayer) {
      tx.addSigners(rentPayer);
    }
  } else {
    tx = setAdminTx;
    if (admin) {
      tx.addSigners(admin);
    }
  }

  if (simulate) {
    const result = await tx.simulate();
    console.log(JSON.stringify(result.value));
  } else {
    const result = await tx.confirm();
    console.log(`Tx: ${result.signature}`);
  }
}
