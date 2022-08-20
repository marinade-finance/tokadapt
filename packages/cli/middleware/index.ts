import { GokiSDK } from '@gokiprotocol/client';
import { TokadaptSDK } from '@marinade.finance/tokadapt-sdk';
import { TransactionEnvelope } from '@saberhq/solana-contrib';
import { Keypair, PublicKey } from '@solana/web3.js';
import { GokiMiddleware } from './GokiMiddleware';
import { SplGovDataMiddleware } from './SplGovDataMiddleware';

export { GokiMiddleware } from './GokiMiddleware';

export interface Middleware {
  programId: PublicKey;

  apply(tx: TransactionEnvelope): Promise<TransactionEnvelope>;
}

export async function installMiddleware({
  middleware,
  tokadapt,
  goki,
  address,
  proposer,
  rentPayer,
}: {
  middleware: Middleware[];
  tokadapt: TokadaptSDK;
  goki: GokiSDK;
  address: PublicKey;
  proposer?: Keypair;
  rentPayer?: Keypair;
}) {
  const account = await tokadapt.provider.getAccountInfo(address);
  if (account) {
    if (account.accountInfo.owner.equals(goki.programs.SmartWallet.programId)) {
      middleware.push(
        await GokiMiddleware.create({
          sdk: goki,
          account: address,
          proposer,
          rentPayer,
        })
      );
    } else if (account.accountInfo.owner.equals(SplGovDataMiddleware.PROG_ID)) {
      middleware.push(
        await SplGovDataMiddleware.create({
          account: address,
        })
      );
    }
  }
}
