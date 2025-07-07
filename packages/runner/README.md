# Setup Global Binary Link

```bash
cd packages/runner
bun link
```

Note: Ensure `~/.bun/bin` is in your PATH.

```bash
export PATH="${HOME}/.bun/bin:$PATH"
```

Then you can use the `pochi-runner` command globally.

# Dependencies

- ripgrep
  - Installed globally (`brew install ripgrep`)
  - Or pass the path to the ripgrep binary using the `--rg` option

# Usage

<!-- FIXME(zhiming): update the usage section after pochi-runner takes stdin prompt -->

## Create New Task

```bash
pochi-runner --token <session_token> "your prompt here"
```

## Run a Existing Task

```bash
pochi-runner --task <task_id> --token <session_token>
```

Or use environment variables to run the command:

```bash
POCHI_TASK_ID=<task_id> POCHI_SESSION_TOKEN=<session_token> pochi-runner
```
