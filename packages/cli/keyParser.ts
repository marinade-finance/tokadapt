import { Keypair, PublicKey } from '@solana/web3.js';
import expandTilde from 'expand-tilde';
import fs from 'mz/fs';

export async function parseKeypair(path: string) {
  return Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(await fs.readFile(expandTilde(path), 'utf-8')))
  );
}

export async function parsePubkey(pubkeyOrPath: string): Promise<PublicKey> {
  try {
    return new PublicKey(pubkeyOrPath);
  } catch (err) {
    const keypair = await parseKeypair(pubkeyOrPath);
    return keypair.publicKey;
  }
}

export async function parsePubkeyOrKeypair(
  pubkeyOrPath: string
): Promise<PublicKey | Keypair> {
  try {
    return new PublicKey(pubkeyOrPath);
  } catch (err) {
    return await parseKeypair(pubkeyOrPath);
  }
}
