# Repository Guidelines

- Hosted on Coolift.
- Install new packages when needed.
- JSON files use two-space indentation.
- `public` should contain all public assets.
- Functions are in `functions`.
- Keep README and AGENTS.md updated when changes are made
- Sensitive values like API keys must come from environment variables; do not commit secrets.
- Pull requests to `main` run `npm test` via GitHub Actions.
- Tests are located in `test` and run with `npm test`.
