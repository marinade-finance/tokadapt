import { Keypair, PublicKey, Signer } from '@solana/web3.js';
import BN from 'bn.js';
import { TokadaptSDK } from '../sdk';
import { TokadaptStateWrapper } from '../state';
import { MintHelper } from './mint';

export class TokadaptHelper {
  private constructor(
    readonly inputMint: MintHelper,
    readonly outputMint: MintHelper,
    readonly state: TokadaptStateWrapper
  ) {}

  get sdk() {
    return this.state.sdk;
  }

  static async create({
    sdk,
    inputMint,
    outputMint,
    admin = sdk.provider.walletKey,
  }: {
    sdk: TokadaptSDK;
    inputMint?: MintHelper;
    outputMint?: MintHelper;
    admin?: PublicKey;
  }): Promise<TokadaptHelper> {
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
      address: new Keypair(),
      admin,
      inputMint: inputMint.address,
      outputMint: outputMint.address,
    });
    console.log('Creating tokadapt');
    await tx.confirm();
    await wrapper.reload();

    return new TokadaptHelper(inputMint, outputMint, wrapper);
  }

  async fillStorage(amount: BN) {
    this.outputMint.mintTo({
      amount,
      target: (await this.state.data()).outputStorage,
    });
  }
}
