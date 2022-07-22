import * as generated from './generated/target/types/tokadapt';
import { AnchorTypes, makeAnchorProvider } from '@saberhq/anchor-contrib';
import {
  AugmentedProvider,
  Provider,
  PublicKey,
  SolanaAugmentedProvider,
} from '@saberhq/solana-contrib';
import * as anchor from '@project-serum/anchor';

export type TokadaptTypes = AnchorTypes<
  generated.Tokadapt,
  {
    state: TokadaptStateData;
  }
>;

type TokadaptAccounts = TokadaptTypes['Accounts'];
export type TokadaptStateData = TokadaptAccounts['state'];
export type TokadaptProgram = TokadaptTypes['Program'];

export class TokadaptSDK {
  readonly provider: AugmentedProvider;
  readonly program: TokadaptProgram;

  constructor({
    provider,
    tokadaptId = new PublicKey('tokdh9ZbWPxkFzqsKqeAwLDk6J6a8NBZtQanVuuENxa'),
  }: {
    provider: Provider;
    tokadaptId?: PublicKey;
  }) {
    this.provider = new SolanaAugmentedProvider(provider);
    const anchorProvider = makeAnchorProvider(provider);
    this.program = new anchor.Program(
      generated.IDL,
      tokadaptId,
      anchorProvider
    ) as unknown as TokadaptProgram;
  }
}
