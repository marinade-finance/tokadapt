import { TransactionEnvelope } from '@saberhq/solana-contrib';
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';

export { GokiMiddleware } from './GokiMiddleware';

export interface Middleware {
  programId: PublicKey;

  apply(tx: TransactionEnvelope): Promise<TransactionEnvelope>;
}

/*
export async function applyMiddleware({
  middleware,
  connection,
  tx,
}: {
  middleware: Middleware[];
  connection: Connection;
  tx: TransactionEnvelope;
}): Promise<TransactionEnvelope> {
  const accountInfo = await connection.getAccountInfo(account);
  if (!accountInfo || accountInfo.owner.equals(SystemProgram.programId)) {
    return tx;
  }

  for (const m of middleware) {
    if (m.programId.equals(accountInfo.owner)) {
      return await m.apply({
        tx,
        account,
      });
    }
  }

  return tx;
}
*/
