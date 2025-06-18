Please help create a new release for the current main, following these guidelines:
- by default, you should bump version for packages/vscode and packages/runner.
- use git command to find all commits since last release tag for each package and show them to the user (note you need to find all changes from git root, not just from packages/vscode or packages/runner).
- always use askFollowupQuestion with user to confirm whether they wanna bump major, minor, or patch version.
- after bumpping the version, generate a commit messange like `chore: release vscode@0.1.2 and runner@0.3.4 `.
- After that, tag the commit with `vscode@...` and `runner@...`.
- Lastly, push change to the remote repository (including main branch and tags).