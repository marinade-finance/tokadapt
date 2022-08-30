import { initSDK, shellMatchers, createFileTokadapt } from '../test-helpers';

jest.setTimeout(300000);

beforeAll(() => {
  shellMatchers();
});

describe('Show tokadapt', () => {
  const sdk = initSDK();

  it('it shows', async () => {
    const { tokadaptStatePath, cleanup, tokadaptState } =
      await createFileTokadapt(sdk);

    await expect([
      'pnpm',
      ['cli', 'show', '--tokadapt', tokadaptStatePath],
    ]).toHaveMatchingSpawnOutput({
      code: 0,
      stdout: new RegExp(`Tokadapt ${tokadaptState.publicKey.toString()}`),
    });

    await cleanup();
  });
});
