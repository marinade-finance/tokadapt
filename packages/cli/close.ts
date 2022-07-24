import { GokiSDK, SmartWalletWrapper } from '@gokiprotocol/client';
import { TokadaptSDK } from '@marinade.finance/tokadapt-sdk';
import { TokadaptStateWrapper } from '@marinade.finance/tokadapt-sdk/state';
import { TransactionEnvelope } from '@saberhq/solana-contrib';
import { Keypair, PublicKey } from '@solana/web3.js';
import { Command } from 'commander';
import { useContext } from './context';
import { parseKeypair, parsePubkey } from './keyParser';

export function installClose(program: Command) {
  program
    .command('close')
    .requiredOption(
      '--tokadapt <keypair>',
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
  const closeTx = await stateWrapper.close({
    admin,
    rentCollector,
    tokenCollector,
    rentPayer,
  });
  if (smartWalletWrapper) {
    const {
      tx: newTransactionTx,
      transactionKey,
      index,
    } = await smartWalletWrapper.newTransaction({
      // Only the last instruction
      instructions: [closeTx.instructions[closeTx.instructions.length - 1]],
      proposer: proposer?.publicKey,
      payer: rentPayer?.publicKey,
    });
    console.log(`Creating GOKI tx #${index}) ${transactionKey.toBase58()}`);
    closeTx.instructions.pop(); // Rest instructions will run now
    tx = closeTx.combine(newTransactionTx);
    if (proposer) {
      tx.addSigners(proposer);
    }
  } else {
    tx = closeTx;
    if (admin) {
      tx.addSigners(admin);
    }
  }

  if (rentPayer) {
    tx.addSigners(rentPayer);
  }

  if (simulate) {
    const result = await tx.simulate();
    console.log(JSON.stringify(result.value));
  } else {
    const result = await tx.confirm();
    console.log(`Tx: ${result.signature}`);
  }
}
