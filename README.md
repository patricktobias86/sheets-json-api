# google-sheets-api

An API that converts Google Sheets into JSON, served via a Netlify Edge Function.

## Development

The Edge Function lives in `netlify/edge-functions/opensheet.ts`.

### Running tests

```sh
npm test
```

Tests fetch sample spreadsheet `1vufOODlks7O9PGak54hMNP4LWBUAoP-XB9n3VW_aw5Y/1` and verify rows are returned. Another test hits `https://sheets-json-api.netlify.app/1vufOODlks7O9PGak54hMNP4LWBUAoP-XB9n3VW_aw5Y/1` and expects `[{"headline":"It's working!"}]`.

### Continuous integration

Pull requests to `main` run `npm test` via GitHub Actions.

## Deployment

Netlify builds read `netlify.toml` and publish files from `public`.
