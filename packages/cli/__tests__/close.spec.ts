import { initSDK, shellMatchers } from '../test-helpers';
import { TokadaptHelper } from '@marinade.finance/tokadapt-sdk/test-helpers/tokadapt';

jest.setTimeout(300000);

beforeAll(() => {
  shellMatchers();
});

describe('Close tokadapt', () => {
  const sdk = initSDK();

  it('it closes', async () => {
    const tokadapt = await TokadaptHelper.create({ sdk });

    await expect([
      'pnpm',
      ['cli', 'close', '--tokadapt', tokadapt.state.address.toString()],
    ]).toHaveMatchingSpawnOutput({
      code: 0,
      stderr: '',
    });
  });
});
