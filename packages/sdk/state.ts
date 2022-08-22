import { TransactionEnvelope } from '@saberhq/solana-contrib';
import {
  Keypair,
  ParsedAccountData,
  PublicKey,
  Signer,
  SystemProgram,
} from '@solana/web3.js';
import { TokadaptSDK, TokadaptStateData } from './sdk';
import { encode } from '@project-serum/anchor/dist/cjs/utils/bytes/utf8';
import {
  ACCOUNT_SIZE,
  createAssociatedTokenAccountInstruction,
  createInitializeAccountInstruction,
  getAssociatedTokenAddress,
  getMinimumBalanceForRentExemptAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import BN from 'bn.js';

export class TokadaptStateWrapper {
  private _data: TokadaptStateData | null = null;
  private _outputMint: PublicKey | null = null;
  static readonly SPACE = 150;

  constructor(readonly sdk: TokadaptSDK, readonly address: PublicKey) {}

  get provider() {
    return this.sdk.provider;
  }

  get program() {
    return this.sdk.program;
  }

  async reload(): Promise<TokadaptStateData> {
    this._data = await this.program.account.state.fetch(this.address);
    return this._data;
  }

  async tryReload(): Promise<TokadaptStateData | null> {
    this._data = await this.program.account.state.fetchNullable(this.address);
    return this._data;
  }

  async data(): Promise<TokadaptStateData> {
    if (!this._data) {
      return await this.reload();
    }
    return this._data;
  }

  async tryData(): Promise<TokadaptStateData | null> {
    if (!this._data) {
      return await this.tryReload();
    }
    return this._data;
  }

  setData(data: TokadaptStateData) {
    this._data = data;
  }

  async outputMint(): Promise<PublicKey> {
    if (!this._outputMint) {
      const data = await this.data();
      const storage = (
        (
          await this.provider.connection.getParsedAccountInfo(
            data.outputStorage
          )
        ).value!.data as ParsedAccountData
      ).parsed;
      this._outputMint = new PublicKey(storage.info.mint);
    }
    return this._outputMint!;
  }

  setOutputMint(outputMint: PublicKey) {
    this._outputMint = outputMint;
  }

  async outputStorageAuthorityWithBump() {
    return PublicKey.findProgramAddress(
      [encode('storage'), this.address.toBytes()],
      this.program.programId
    );
  }

  async outputStorageAuthority() {
    const [outputStorageAuthority] =
      await this.outputStorageAuthorityWithBump();
    return outputStorageAuthority;
  }

  static async create({
    sdk,
    address,
    admin = sdk.provider.walletKey,
    inputMint,
    outputStorage,
    outputMint,
    rentPayer,
  }: {
    sdk: TokadaptSDK;
    address: Signer;
    admin?: PublicKey;
    inputMint: PublicKey;
    outputStorage?: PublicKey | Keypair;
    outputMint?: PublicKey;
    rentPayer?: Signer;
  }): Promise<{
    wrapper: TokadaptStateWrapper;
    tx: TransactionEnvelope;
  }> {
    const wrapper = new TokadaptStateWrapper(sdk, address.publicKey);
    const signers = [address];
    if (rentPayer) {
      signers.push(rentPayer);
    }
    const tx = new TransactionEnvelope(
      sdk.provider,
      [
        SystemProgram.createAccount({
          fromPubkey: rentPayer?.publicKey || sdk.provider.wallet.publicKey,
          newAccountPubkey: address.publicKey,
          lamports:
            await sdk.provider.connection.getMinimumBalanceForRentExemption(
              TokadaptStateWrapper.SPACE
            ),
          space: TokadaptStateWrapper.SPACE,
          programId: sdk.program.programId,
        }),
      ],
      signers
    );
    return {
      wrapper,
      tx: tx.combine(
        await wrapper.init({
          admin,
          inputMint,
          outputStorage,
          outputMint,
          rentPayer,
        })
      ),
    };
  }

  async init({
    admin = this.provider.walletKey,
    inputMint,
    outputStorage,
    outputMint,
    rentPayer,
  }: {
    admin?: PublicKey;
    inputMint: PublicKey;
    outputStorage?: PublicKey | Keypair;
    outputMint?: PublicKey;
    rentPayer?: Signer;
  }): Promise<TransactionEnvelope> {
    const tx = new TransactionEnvelope(this.provider, []);
    const outputStorageAuthority = await this.outputStorageAuthority();
    if (!outputStorage) {
      if (!outputMint) {
        throw new Error('One of outputStorage or outputMint must be set');
      }
      // Save value to variable for future use
      outputStorage = await getAssociatedTokenAddress(
        outputMint,
        outputStorageAuthority,
        true
      );
      tx.append(
        createAssociatedTokenAccountInstruction(
          rentPayer?.publicKey || this.provider.walletKey,
          outputStorage,
          outputStorageAuthority,
          outputMint
        )
      );
      if (rentPayer) {
        tx.addSigners(rentPayer);
      }
    } else if (outputStorage instanceof Keypair) {
      if (!outputMint) {
        throw new Error('For creating outputStorage outputMint must be set');
      }
      tx.append(
        SystemProgram.createAccount({
          fromPubkey: rentPayer?.publicKey || this.provider.walletKey,
          newAccountPubkey: outputStorage.publicKey,
          lamports: await getMinimumBalanceForRentExemptAccount(
            this.provider.connection
          ),
          space: ACCOUNT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        })
      );
      tx.addSigners(outputStorage);
      if (rentPayer) {
        tx.addSigners(rentPayer);
      }
      tx.append(
        createInitializeAccountInstruction(
          outputStorage.publicKey,
          outputMint,
          outputStorageAuthority
        )
      );
      outputStorage = outputStorage.publicKey; // convert to pubkey for future use
    }
    tx.append(
      await this.program.methods
        .initialize(admin, inputMint)
        .accounts({
          state: this.address,
          outputStorage,
        })
        .instruction()
    );
    return tx;
  }

  async swap({
    amount = new BN('18446744073709551615'),
    inputSigner,
    input,
    outputAuthority = this.provider.walletKey,
    output,
    inputMint,
    outputStorage,
    outputMint,
    rentPayer,
  }: {
    amount?: BN;
    inputSigner?: Signer;
    input?: PublicKey;
    outputAuthority?: PublicKey;
    output?: PublicKey;
    inputMint?: PublicKey;
    outputStorage?: PublicKey;
    outputMint?: PublicKey;
    rentPayer?: Signer;
  }) {
    const tx = new TransactionEnvelope(this.provider, []);
    const inputAuthority = inputSigner?.publicKey || this.provider.walletKey;
    if (!outputMint) {
      outputMint = await this.outputMint();
    }
    if (!inputMint) {
      inputMint = (await this.data()).inputMint;
    }
    if (!input) {
      input = await getAssociatedTokenAddress(inputMint, inputAuthority, true);
    }
    if (!outputStorage) {
      outputStorage = (await this.data()).outputStorage;
    }

    if (!output) {
      if (!outputAuthority) {
        outputAuthority = this.provider.walletKey;
      }
      output = await getAssociatedTokenAddress(
        outputMint,
        outputAuthority,
        true
      );

      if (!(await this.provider.getAccountInfo(output))) {
        tx.append(
          createAssociatedTokenAccountInstruction(
            rentPayer?.publicKey || this.provider.walletKey,
            output,
            outputAuthority,
            outputMint
          )
        );
        if (rentPayer) {
          tx.addSigners(rentPayer);
        }
      }
    }
    tx.append(
      await this.program.methods
        .swap(amount)
        .accounts({
          state: this.address,
          input,
          inputAuthority,
          inputMint,
          outputStorage,
          outputStorageAuthority: await this.outputStorageAuthority(),
          target: output,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()
    );
    if (inputSigner) {
      tx.addSigners(inputSigner);
    }
    return tx;
  }

  async setAdmin({
    admin,
    newAdmin,
  }: {
    admin?: Signer | PublicKey;
    newAdmin: PublicKey;
  }) {
    if (!admin) {
      admin = (await this.data()).adminAuthority;
    }

    const signers = [];
    if (!(admin instanceof PublicKey)) {
      signers.push(admin);
      admin = admin.publicKey;
    }

    return new TransactionEnvelope(
      this.provider,
      [
        await this.program.methods
          .setAdmin(newAdmin)
          .accounts({
            state: this.address,
            adminAuthority: admin,
          })
          .instruction(),
      ],
      signers
    );
  }

  async close({
    admin,
    rentCollector,
    tokenCollector,
    createTokenCollector,
    outputStorage,
    outputMint,
    rentPayer,
  }: {
    admin?: Signer | PublicKey;
    rentCollector?: PublicKey;
    tokenCollector?: PublicKey;
    createTokenCollector?: boolean;
    outputStorage?: PublicKey;
    outputMint?: PublicKey;
    rentPayer?: Signer;
  }) {
    if (!admin) {
      admin = (await this.data()).adminAuthority;
    }

    const signers = [];
    if (!(admin instanceof PublicKey)) {
      signers.push(admin);
      admin = admin.publicKey;
    }

    if (!outputStorage) {
      outputStorage = (await this.data()).outputStorage;
    }

    const tx = new TransactionEnvelope(this.provider, [], signers);
    if (!tokenCollector) {
      if (!outputMint) {
        outputMint = await this.outputMint();
      }

      tokenCollector = await getAssociatedTokenAddress(
        outputMint,
        rentCollector || this.provider.walletKey,
        true
      );
    }

    if (createTokenCollector === undefined) {
      createTokenCollector = !(await this.provider.getAccountInfo(
        tokenCollector
      ));
    }

    if (createTokenCollector) {
      if (!outputMint) {
        outputMint = await this.outputMint();
      }

      tx.append(
        createAssociatedTokenAccountInstruction(
          rentPayer?.publicKey || this.provider.walletKey,
          tokenCollector,
          rentCollector || this.provider.walletKey,
          outputMint
        )
      );
      if (rentPayer) {
        tx.addSigners(rentPayer);
      }
    }

    tx.append(
      await this.program.methods
        .close()
        .accounts({
          state: this.address,
          adminAuthority: admin,
          outputStorage,
          outputStorageAuthority: await this.outputStorageAuthority(),
          tokenTarget: tokenCollector,
          rentCollector: rentCollector || this.provider.walletKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()
    );

    return tx;
  }
}
