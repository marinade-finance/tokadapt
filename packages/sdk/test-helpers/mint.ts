import { Provider, TransactionEnvelope } from '@saberhq/solana-contrib';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  getMinimumBalanceForRentExemptMint,
  MintLayout,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Keypair, PublicKey, Signer, SystemProgram } from '@solana/web3.js';
import BN from 'bn.js';

export class MintHelper {
  private constructor(
    readonly provider: Provider,
    readonly address: PublicKey,
    readonly digits: number,
    readonly mintAuthority?: PublicKey | Keypair,
    readonly freezeAuthority?: null | PublicKey | Keypair
  ) {}

  get mintAuthorityAddress(): PublicKey {
    if (this.mintAuthority === undefined) {
      return this.provider.wallet.publicKey;
    } else if (this.mintAuthority instanceof PublicKey) {
      return this.mintAuthority;
    } else {
      return this.mintAuthority.publicKey;
    }
  }

  get freezeAuthorityAddress(): PublicKey | null {
    if (this.freezeAuthority === undefined) {
      return this.provider.wallet.publicKey;
    } else if (this.freezeAuthority instanceof PublicKey) {
      return this.freezeAuthority;
    } else if (this.freezeAuthority) {
      return this.freezeAuthority.publicKey;
    } else {
      return null;
    }
  }

  static async create({
    provider,
    digits = 9,
    mintAuthority,
    freezeAuthority,
  }: {
    provider: Provider;
    digits?: number;
    mintAuthority?: PublicKey | Keypair;
    freezeAuthority?: null | PublicKey | Keypair;
  }): Promise<MintHelper> {
    const address = new Keypair();

    let mintAuthorityAddress: PublicKey;
    if (mintAuthority === undefined) {
      mintAuthorityAddress = provider.wallet.publicKey;
    } else if (mintAuthority instanceof PublicKey) {
      mintAuthorityAddress = mintAuthority;
    } else {
      mintAuthorityAddress = mintAuthority.publicKey;
    }

    let freezeAuthorityAddress: PublicKey | null = null;
    if (freezeAuthority === undefined) {
      freezeAuthorityAddress = provider.wallet.publicKey;
    } else if (freezeAuthority instanceof PublicKey) {
      freezeAuthorityAddress = freezeAuthority;
    } else if (freezeAuthority) {
      freezeAuthorityAddress = freezeAuthority.publicKey;
    }

    const tx = new TransactionEnvelope(
      provider,
      [
        SystemProgram.createAccount({
          fromPubkey: provider.wallet.publicKey,
          newAccountPubkey: address.publicKey,
          lamports: await getMinimumBalanceForRentExemptMint(
            provider.connection
          ),
          space: MintLayout.span,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          address.publicKey,
          digits,
          mintAuthorityAddress,
          freezeAuthorityAddress
        ),
      ],
      [address]
    );
    await tx.confirm();
    return new MintHelper(
      provider,
      address.publicKey,
      digits,
      mintAuthority,
      freezeAuthority
    );
  }

  async mintTo({
    amount,
    target,
    owner,
    mintAuthority,
  }: {
    amount: BN;
    target?: PublicKey;
    owner?: PublicKey;
    mintAuthority?: Signer;
  }) {
    let tx = new TransactionEnvelope(this.provider, []);
    if (!target) {
      if (!owner) {
        owner = this.provider.wallet.publicKey;
      }
      target = await getAssociatedTokenAddress(this.address, owner, true);
      if (!(await this.provider.getAccountInfo(target))) {
        tx = tx.combine(
          new TransactionEnvelope(this.provider, [
            createAssociatedTokenAccountInstruction(
              this.provider.wallet.publicKey,
              target,
              owner,
              this.address
            ),
          ])
        );
      }
    }

    tx = tx.combine(
      new TransactionEnvelope(this.provider, [
        createMintToInstruction(
          this.address,
          target,
          this.mintAuthorityAddress,
          BigInt(amount.toString())
        ),
      ])
    );
    if (mintAuthority) {
      tx.addSigners(mintAuthority);
    } else if (
      this.mintAuthority &&
      !(this.mintAuthority instanceof PublicKey)
    ) {
      tx.addSigners(this.mintAuthority);
    }

    await tx.confirm();
  }
}
