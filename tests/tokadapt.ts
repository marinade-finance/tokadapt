import * as anchor from '@project-serum/anchor';
import * as token from '@solana/spl-token';
import * as chai from 'chai';
import { TextEncoder } from 'util';

describe('tokadapt', () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const adminAuthority = new anchor.web3.Keypair();
  const inputMint = new anchor.web3.Keypair();
  const outputMint = new anchor.web3.Keypair();
  const outputStorage = new anchor.web3.Keypair();
  const program = anchor.workspace.Tokadapt;
  const state = new anchor.web3.Keypair();

  before(async () => {

    const inputAccount = await token.Token.getAssociatedTokenAddress(
      token.ASSOCIATED_TOKEN_PROGRAM_ID, token.TOKEN_PROGRAM_ID, inputMint.publicKey, anchor.getProvider().wallet.publicKey);
    const outputAccount = await token.Token.getAssociatedTokenAddress(
      token.ASSOCIATED_TOKEN_PROGRAM_ID, token.TOKEN_PROGRAM_ID, outputMint.publicKey, anchor.getProvider().wallet.publicKey);

    const [outputStorageAuthority, outputStorageAuthorityBump] =
      await anchor.web3.PublicKey.findProgramAddress([
        new TextEncoder().encode('storage'), state.publicKey.toBytes()],
        program.programId);

    const rentForMint = await token.Token.getMinBalanceRentForExemptMint(anchor.getProvider().connection);
    // input
    let transaction = new anchor.web3.Transaction({ feePayer: anchor.getProvider().wallet.publicKey });
    transaction.add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: anchor.getProvider().wallet.publicKey,
        newAccountPubkey: inputMint.publicKey,
        lamports: rentForMint,
        space: token.MintLayout.span,
        programId: token.TOKEN_PROGRAM_ID,
      }),
    );
    transaction.add(token.Token.createInitMintInstruction(
      token.TOKEN_PROGRAM_ID,
      inputMint.publicKey,
      9,
      anchor.getProvider().wallet.publicKey, null));
    transaction.add(token.Token.createAssociatedTokenAccountInstruction(
      token.ASSOCIATED_TOKEN_PROGRAM_ID,
      token.TOKEN_PROGRAM_ID,
      inputMint.publicKey,
      inputAccount,
      anchor.getProvider().wallet.publicKey,
      anchor.getProvider().wallet.publicKey
    ));

    console.log("Inputs", await anchor.getProvider().send(transaction, [inputMint]));

    transaction = new anchor.web3.Transaction({ feePayer: anchor.getProvider().wallet.publicKey });

    transaction.add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: anchor.getProvider().wallet.publicKey,
        newAccountPubkey: outputMint.publicKey,
        lamports: rentForMint,
        space: token.MintLayout.span,
        programId: token.TOKEN_PROGRAM_ID,
      }),
    );
    transaction.add(token.Token.createInitMintInstruction(
      token.TOKEN_PROGRAM_ID,
      outputMint.publicKey,
      9,
      anchor.getProvider().wallet.publicKey, null));

    transaction.add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: anchor.getProvider().wallet.publicKey,
        newAccountPubkey: outputStorage.publicKey,
        lamports: await token.Token.getMinBalanceRentForExemptAccount(anchor.getProvider().connection),
        space: token.AccountLayout.span,
        programId: token.TOKEN_PROGRAM_ID,
      }),
    );

    transaction.add(token.Token.createInitAccountInstruction(
      token.TOKEN_PROGRAM_ID,
      outputMint.publicKey,
      outputStorage.publicKey,
      outputStorageAuthority));

    transaction.add(token.Token.createAssociatedTokenAccountInstruction(
      token.ASSOCIATED_TOKEN_PROGRAM_ID,
      token.TOKEN_PROGRAM_ID,
      outputMint.publicKey,
      outputAccount,
      anchor.getProvider().wallet.publicKey,
      anchor.getProvider().wallet.publicKey
    ));

    console.log("Outputs", await anchor.getProvider().send(transaction, [outputMint, outputStorage]));

    transaction = new anchor.web3.Transaction({ feePayer: anchor.getProvider().wallet.publicKey });
    transaction.add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: anchor.getProvider().wallet.publicKey,
        newAccountPubkey: state.publicKey,
        lamports: await anchor.getProvider().connection.getMinimumBalanceForRentExemption(1000),
        space: 1000,
        programId: program.programId,
      })
    )
    console.log("State", await anchor.getProvider().send(transaction, [state]));
    console.log("Initialize", await program.rpc.initialize(adminAuthority.publicKey, inputMint.publicKey, {
      accounts: {
        state: state.publicKey,
        outputStorage: outputStorage.publicKey,
      }
    }));
  });

  it('Is swapping!', async () => {
    const inputAccount = await token.Token.getAssociatedTokenAddress(
      token.ASSOCIATED_TOKEN_PROGRAM_ID, token.TOKEN_PROGRAM_ID, inputMint.publicKey, anchor.getProvider().wallet.publicKey);
    const outputAccount = await token.Token.getAssociatedTokenAddress(
      token.ASSOCIATED_TOKEN_PROGRAM_ID, token.TOKEN_PROGRAM_ID, outputMint.publicKey, anchor.getProvider().wallet.publicKey);

    const [outputStorageAuthority, outputStorageAuthorityBump] =
      await anchor.web3.PublicKey.findProgramAddress([
        new TextEncoder().encode('storage'), state.publicKey.toBytes()],
        program.programId);

    const transaction = new anchor.web3.Transaction({ feePayer: anchor.getProvider().wallet.publicKey });
    transaction.add(
      token.Token.createMintToInstruction(token.TOKEN_PROGRAM_ID, inputMint.publicKey, inputAccount, anchor.getProvider().wallet.publicKey, [], 10 * anchor.web3.LAMPORTS_PER_SOL)
    );
    transaction.add(
      token.Token.createMintToInstruction(
        token.TOKEN_PROGRAM_ID,
        outputMint.publicKey,
        outputStorage.publicKey,
        anchor.getProvider().wallet.publicKey,
        [], 100 * anchor.web3.LAMPORTS_PER_SOL
      )
    )

    console.log("Prepare tokens", await anchor.getProvider().send(transaction, []));

    const oldBalance = await anchor.getProvider().connection.getTokenAccountBalance(outputAccount);

    console.log("Swap", await program.rpc.swap(new anchor.BN(2 * anchor.web3.LAMPORTS_PER_SOL), {
      accounts: {
        state: state.publicKey,
        input: inputAccount,
        inputAuthority: anchor.getProvider().wallet.publicKey,
        inputMint: inputMint.publicKey,
        outputStorage: outputStorage.publicKey,
        outputStorageAuthority,
        target: outputAccount,
        tokenProgram: token.TOKEN_PROGRAM_ID,
      }
    }));

    const balance = await anchor.getProvider().connection.getTokenAccountBalance(outputAccount)
    chai.assert.isTrue(
      new anchor.BN(balance.value.amount).eq(
        new anchor.BN(oldBalance.value.amount)
          .add(new anchor.BN(2 * anchor.web3.LAMPORTS_PER_SOL))));
  });

  it('Is closing!', async () => {
    const outputAccount = await token.Token.getAssociatedTokenAddress(
      token.ASSOCIATED_TOKEN_PROGRAM_ID, token.TOKEN_PROGRAM_ID, outputMint.publicKey, anchor.getProvider().wallet.publicKey);

    const rentCollector = new anchor.web3.Keypair();
    const [outputStorageAuthority, outputStorageAuthorityBump] =
      await anchor.web3.PublicKey.findProgramAddress([
        new TextEncoder().encode('storage'), state.publicKey.toBytes()],
        program.programId);

    const oldRent =
      await anchor.getProvider().connection.getBalance(state.publicKey)
      + await anchor.getProvider().connection.getBalance(outputStorage.publicKey);
    const oldBalance = await anchor.getProvider().connection.getTokenAccountBalance(outputAccount);
    const storageBalance = await anchor.getProvider().connection.getTokenAccountBalance(outputStorage.publicKey);
    console.log("Close", await program.rpc.close({
      accounts: {
        state: state.publicKey,
        adminAuthority: adminAuthority.publicKey,
        outputStorage: outputStorage.publicKey,
        outputStorageAuthority,
        tokenTarget: outputAccount,
        rentCollector: rentCollector.publicKey,
        tokenProgram: token.TOKEN_PROGRAM_ID,
      },
      signers: [adminAuthority]
    }));
    const balance = await anchor.getProvider().connection.getTokenAccountBalance(outputAccount)
    chai.assert.isTrue(
      new anchor.BN(balance.value.amount).eq(
        new anchor.BN(oldBalance.value.amount)
          .add(new anchor.BN(storageBalance.value.amount))));

    chai.assert.equal(await anchor.getProvider().connection.getBalance(rentCollector.publicKey), oldRent);

  })
});