import { TokadaptSDK } from '@marinade.finance/tokadapt-sdk';
import { TokadaptStateWrapper } from '@marinade.finance/tokadapt-sdk/state';
import { ParsedAccountData, PublicKey } from '@solana/web3.js';
import { Command } from 'commander';
import { useContext } from './context';
import { parsePubkey } from './keyParser';

export function installShow(program: Command) {
  program
    .command('show')
    .option(
      '--tokadapt <address>',
      'Tokapapt state address',
      parsePubkey,
      Promise.resolve(
        new PublicKey('taspunvVUXLG82PrsCCtQeknWrGHNHWcZmVQYNcQBDg')
      )
    )
    .action(async ({ tokadapt }: { tokadapt: Promise<PublicKey> }) => {
      const context = useContext();
      await show({
        tokadapt: context.tokadapt,
        state: await tokadapt,
      });
    });
}

export async function show({
  tokadapt,
  state,
}: {
  tokadapt: TokadaptSDK;
  state: PublicKey;
}) {
  const stateWrapper = new TokadaptStateWrapper(tokadapt, state);
  const stateData = await stateWrapper.data();
  console.log(`Tokadapt ${stateWrapper.address.toBase58()}`);
  console.log(`  admin: ${stateData.adminAuthority.toBase58()}`);
  console.log(`  input mint: ${stateData.inputMint.toBase58()}`);
  const storage = (
    (
      await tokadapt.provider.connection.getParsedAccountInfo(
        stateData.outputStorage
      )
    ).value?.data as ParsedAccountData
  ).parsed.info;
  console.log(`  output mint: ${storage.mint}`);
  console.log(`  output storage: ${stateData.outputStorage.toBase58()}`);
  console.log(`  output storage balance: ${storage.tokenAmount.uiAmount}`);
}
