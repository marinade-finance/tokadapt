import { initSDK, shellMatchers, createTokadapt } from '../test-helpers';

jest.setTimeout(300000);

beforeAll(() => {
  shellMatchers();
});

describe('Close tokadapt', () => {
  const sdk = initSDK();

  it('it closes', async () => {
    const { tokadaptStatePath, cleanup } = await createTokadapt(sdk);

    await expect([
      'pnpm',
      ['cli', 'close', '--tokadapt', tokadaptStatePath],
    ]).toHaveMatchingSpawnOutput({
      code: 0,
      stderr: '',
    });

    await cleanup();
  });
});
