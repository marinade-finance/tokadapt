import { TokadaptSDK } from '@marinade.finance/tokadapt-sdk';
import { GokiSDK } from '@gokiprotocol/client';
import { SignerWallet, SolanaProvider } from '@saberhq/solana-contrib';
import { Cluster, Connection, Keypair, clusterApiUrl } from '@solana/web3.js';

export interface Context {
  tokadapt: TokadaptSDK;
  goki: GokiSDK;
  simulate: boolean;
}

const context: {
  tokadapt: TokadaptSDK | null;
  goki: GokiSDK | null;
  simulate: boolean;
} = {
  tokadapt: null,
  goki: null,
  simulate: false,
};

export const setContext = ({
  cluster,
  walletKP,
  simulate,
}: {
  cluster: string;
  walletKP: Keypair;
  simulate: boolean;
}) => {
  try {
    cluster = clusterApiUrl(cluster as Cluster);
  } catch (e) {
    // ignore
  }
  const provider = SolanaProvider.init({
    connection: new Connection(cluster, 'confirmed'),
    wallet: new SignerWallet(walletKP),
  });
  context.tokadapt = new TokadaptSDK({
    provider,
  });
  context.goki = GokiSDK.load({ provider });
  context.simulate = simulate;
};

export const useContext = () => {
  return context as Context;
};
