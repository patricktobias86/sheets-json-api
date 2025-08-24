# google-sheets-api

An API that converts Google Sheets into JSON, served via a Netlify Edge Function.

## Development

The Edge Function lives in `netlify/edge-functions/opensheet.ts`.

### Running tests

```sh
npm test
```

The test fetches sample spreadsheet `1vufOODlks7O9PGak54hMNP4LWBUAoP-XB9n3VW_aw5Y/1` and verifies rows are returned.

## Deployment

Netlify builds read `netlify.toml` and publish files from `public`.
