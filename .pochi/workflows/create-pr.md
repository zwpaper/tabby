Please help create a PR for the current staging changes, following these guidelines:
- If there are no staging changes but there are uncommitted changes, please stage them first.
- Do not create a PR in the main branch; always create a PR in the staging branch. Create a branch name based on the current git diff status.
- Write a meaningful commit message/PR title.
- Use the gh CLI to create a PR.
- When running the push operation, it might be aborted due to a husky pre-push hook. For formatting issues, amend the files and try again. For other issues, try to resolve them as much as possible.
