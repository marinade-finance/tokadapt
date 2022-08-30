import { TokadaptHelper } from '@marinade.finance/tokadapt-sdk/test-helpers/tokadapt';
import { initSDK, shellMatchers } from '../test-helpers';

jest.setTimeout(300000);

beforeAll(() => {
  shellMatchers();
});

describe('Show tokadapt', () => {
  const sdk = initSDK();

  it('it shows', async () => {
    const tokadapt = await TokadaptHelper.create({ sdk });

    await expect([
      'pnpm',
      ['cli', 'show', '--tokadapt', tokadapt.state.address.toString()],
    ]).toHaveMatchingSpawnOutput({
      code: 0,
      stdout: new RegExp(`Tokadapt ${tokadapt.state.address.toString()}`),
    });
  });
});
