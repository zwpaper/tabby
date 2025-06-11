Please help create a new release for the current main, following these guidelines:
- run `bun release </dev/null` in `packages/vscode` to get a commits diff since the last release.
- update packages/vscode/CHANGELOG.md with the commits diff summarization, and use askFollowUpQuestion to confirm with user to proceed.
- commit the changes to `packages/vscode/CHANGELOG.md` with a meaningful commit message.
- Once confirmed, run `bun release` to create a new release.