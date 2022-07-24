import { Command } from 'commander';
import { parseKeypair } from './keyParser';
import { Keypair } from '@solana/web3.js';
import { setContext } from './context';
import { installShow } from './show';
import { installCreate } from './create';
import { installClose } from './close';
import { installSwap } from './swap';
import { installSetAdmin } from './setAdmin';

const program = new Command();

program
  .version('1.0.0')
  .allowExcessArguments(false)
  .option('-c, --cluster <cluster>', 'Solana cluster', 'http://localhost:8899')
  .option('--commitment <commitment>', 'Commitment', 'confirmed')
  .option('-k, --keypair <keypair>', 'Wallet keypair', parseKeypair)
  .option('-s, --simulate', 'Simulate')
  .hook('preAction', async (command: Command) => {
    const wallet = command.opts().keypair;
    const walletKP = wallet
      ? ((await wallet) as Keypair)
      : await parseKeypair('~/.config/solana/id.json');
    setContext({
      cluster: command.opts().cluster as string,
      walletKP,
      simulate: Boolean(command.opts().simulate),
    });
  });

installShow(program);
installCreate(program);
installClose(program);
installSwap(program);
installSetAdmin(program);

program.parseAsync(process.argv).then(
  () => {},
  (err: unknown) => {
    throw err;
  }
);

/*
program
  .command('listen')
  .option('--realm <address>', 'Realm', parsePubkey)
  .action(async ({ realm }: { realm?: Promise<PublicKey> }) => {
    assert(sdk);
    if (realm) {
      await listenRealm({
        sdk,
        realm: await realm,
      });
    }
    await waitForever();
  });

program
  .command('migrate-realm')
  .requiredOption('--realm <address>', 'Old realm', parseKeypair)
  .action(async ({ realm }: { realm: Promise<Keypair> }) => {
    assert(sdk);
    const realmAddress = await realm;
    const realmWrapper = new RealmWrapper(sdk, realmAddress.publicKey);
    const tmpAddress = new Keypair();
    const tmpRealmWrapper = new RealmWrapper(sdk, tmpAddress.publicKey);
    {
      const tx = await realmWrapper.migrate({
        address: tmpAddress,
      });
      const result = await tx.confirm();
      console.log(`Migrate: ${result.signature}`);
    }
    new Promise(resolve => setTimeout(resolve, 40000));
    {
      const tx = await tmpRealmWrapper.move({
        address: realmAddress,
      });
      const result = await tx.confirm();
      console.log(`Move: ${result.signature}`);
    }
  });*/
