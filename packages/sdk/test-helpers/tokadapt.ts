import { Keypair, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { TokadaptSDK } from '../sdk';
import { TokadaptStateWrapper } from '../state';
import {
  MintHelper,
  MultisigHelper,
} from '@marinade.finance/solana-test-utils';

export class TokadaptHelper {
  private constructor(
    readonly inputMint: MintHelper,
    readonly outputMint: MintHelper,
    readonly state: TokadaptStateWrapper,
    public readonly admin?: PublicKey | Keypair | MultisigHelper
  ) {}

  get sdk() {
    return this.state.sdk;
  }

  static async create({
    sdk,
    inputMint,
    outputMint,
    admin = sdk.provider.walletKey,
    address,
  }: {
    sdk: TokadaptSDK;
    inputMint?: MintHelper;
    outputMint?: MintHelper;
    admin?: PublicKey | Keypair | MultisigHelper;
    address?: Keypair;
  }): Promise<TokadaptHelper> {
    let adminAuthority: PublicKey;
    if (admin instanceof MultisigHelper) {
      adminAuthority = admin.authority;
    } else if (admin instanceof PublicKey) {
      adminAuthority = admin;
    } else {
      adminAuthority = admin?.publicKey || sdk.provider.walletKey;
    }

    if (!inputMint) {
      inputMint = await MintHelper.create({
        provider: sdk.provider,
      });
    }

    if (!outputMint) {
      outputMint = await MintHelper.create({
        provider: sdk.provider,
      });
    }

    const { tx, wrapper } = await TokadaptStateWrapper.create({
      sdk,
      address: address ?? new Keypair(),
      admin: adminAuthority,
      inputMint: inputMint.address,
      outputMint: outputMint.address,
    });

    await tx.confirm();
    await wrapper.reload();

    return new TokadaptHelper(inputMint, outputMint, wrapper, adminAuthority);
  }

  async fillStorage(amount: BN) {
    this.outputMint.mintTo({
      amount,
      target: (await this.state.data()).outputStorage,
    });
  }
}
