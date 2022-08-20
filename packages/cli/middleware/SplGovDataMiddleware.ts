import { TransactionEnvelope } from '@saberhq/solana-contrib';
import { PublicKey } from '@solana/web3.js';
import { MultisigMiddlewareBase } from './MultisigMiddlewareBase';
import { serializeInstructionToBase64 } from '@solana/spl-governance';

export class SplGovDataMiddleware extends MultisigMiddlewareBase {
  private constructor(public readonly goverance: PublicKey) {
    super();
  }

  static readonly PROG_ID = new PublicKey(
    'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw'
  );

  static async create({ account }: { account: PublicKey }) {
    return new SplGovDataMiddleware(account);
  }

  createTransaction(inner: TransactionEnvelope): Promise<TransactionEnvelope> {
    for (const ix of inner.instructions) {
      console.log(serializeInstructionToBase64(ix));
    }
    return Promise.resolve(new TransactionEnvelope(inner.provider, []));
  }

  get programId() {
    return SplGovDataMiddleware.PROG_ID;
  }

  get signingBy() {
    return this.goverance;
  }
}
