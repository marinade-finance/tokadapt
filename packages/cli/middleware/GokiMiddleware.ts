import { GokiSDK, SmartWalletWrapper } from '@gokiprotocol/client';
import { TransactionEnvelope } from '@saberhq/solana-contrib';
import { PublicKey, Signer } from '@solana/web3.js';
import { MultisigMiddlewareBase } from './MultisigMiddlewareBase';

export class GokiMiddleware extends MultisigMiddlewareBase {
  private constructor(
    public smartWalletWrapper: SmartWalletWrapper,
    public proposer: Signer | PublicKey,
    public rentPayer: Signer | PublicKey,
    public approvers: (Signer | PublicKey)[]
  ) {
    super();
    if (
      !smartWalletWrapper.data!.owners.find(owner =>
        owner.equals(this.proposerKey)
      )
    ) {
      throw new Error(`Unknown proposer ${this.proposerKey}`);
    }
    console.log(`Using GOKI smart wallet ${this.signingBy}`);
  }

  static async create({
    sdk,
    account,
    proposer = sdk.provider.walletKey,
    rentPayer = sdk.provider.walletKey,
    approvers = [],
  }: {
    sdk: GokiSDK;
    account: PublicKey;
    proposer?: Signer | PublicKey;
    rentPayer?: Signer | PublicKey;
    approvers?: (Signer | PublicKey)[];
  }): Promise<GokiMiddleware> {
    const smartWalletWrapper = await sdk.loadSmartWallet(account);
    return new GokiMiddleware(
      smartWalletWrapper,
      proposer,
      rentPayer,
      approvers
    );
  }

  get programId() {
    return this.sdk.programs.SmartWallet.programId;
  }

  get sdk() {
    return this.smartWalletWrapper.sdk;
  }

  get signingBy() {
    return this.smartWalletWrapper.key;
  }

  get proposerKey(): PublicKey {
    return this.proposer instanceof PublicKey
      ? this.proposer
      : this.proposer.publicKey;
  }

  get rentPayerKey(): PublicKey {
    return this.rentPayer instanceof PublicKey
      ? this.rentPayer
      : this.rentPayer.publicKey;
  }

  async createTransaction(
    inner: TransactionEnvelope
  ): Promise<TransactionEnvelope> {
    const { tx, transactionKey, index } =
      await this.smartWalletWrapper.newTransactionFromEnvelope({
        tx: inner,
        proposer: this.proposerKey,
        payer: this.rentPayerKey,
      });
    if (!(this.proposer instanceof PublicKey)) {
      tx.addSigners(this.proposer);
    }
    if (!(this.rentPayer instanceof PublicKey)) {
      tx.addSigners(this.rentPayer);
    }
    console.log(`Creating GOKI tx #${index}) ${transactionKey.toBase58()}`);
    // TODO: approve and execute if approvers are enough
    return tx;
  }
}
