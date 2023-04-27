# Tokadapt

## CLI usage

To start using CLI from the repository you need to build the contract project first.
For the build would work you need to use Anchor in version `0.18.2`.

```bash
# Building the contract and generating IDL
avm use 0.18.2
pnpm build

# Install dependencies
pnpm install

# Run the CLI
pnpm cli --help

# to show the state of an instance
pnpm cli -c https://api.mainnet-beta.solana.com \
  show --tokadapt taspunvVUXLG82PrsCCtQeknWrGHNHWcZmVQYNcQBDg
```