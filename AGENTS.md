# Repository Guidelines

- Hosted on Coolify (self-hosted).
- Docker Compose support lives in `compose.yml`; the container image is built from `Dockerfile`.
- `compose.yml` is production-friendly for Coolify and should not bind host ports; use `compose.local.yml` for local port publishing.
- Install new packages when needed.
- JSON files use two-space indentation.
- `public` should contain all public assets.
- Functions are in `functions`.
- Keep README and AGENTS.md updated when changes are made
- Sensitive values like API keys must come from environment variables; do not commit secrets.
- Pull requests to `main` run `npm test` via GitHub Actions.
- Dependabot checks npm packages and GitHub Actions weekly.
- Tests are located in `test` and run with `npm test`.
