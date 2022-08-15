import { TransactionEnvelope } from '@saberhq/solana-contrib';
import { PublicKey } from '@solana/web3.js';
import { Middleware } from '.';

export abstract class MultisigMiddlewareBase implements Middleware {
  abstract signingBy: PublicKey;
  abstract programId: PublicKey;

  // TODO: detect independent instructions from packing tail and put it back to normal flow
  async apply(tx: TransactionEnvelope): Promise<TransactionEnvelope> {
    const start = tx.instructions.findIndex(ix =>
      ix.keys.find(acc => acc.pubkey.equals(this.signingBy) && acc.isSigner)
    );
    if (start < 0) {
      return tx;
    }
    const inner = tx.instructions.splice(start);
    return tx.combine(
      await this.createTransaction(
        new TransactionEnvelope(tx.provider, inner, tx.signers)
      )
    );
  }

  abstract createTransaction(
    inner: TransactionEnvelope
  ): Promise<TransactionEnvelope>;
}
