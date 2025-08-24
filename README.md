# google-sheets-api

An API that converts Google Sheets into JSON, served via a Netlify Edge Function.

## Usage

Requests follow the pattern `/SPREADSHEET_ID/sheet_name_or_number`. If the sheet
segment is omitted, the request will redirect to the first sheet (`/1`).

Example:

```
https://sheets-json-api.netlify.app/1vufOODlks7O9PGak54hMNP4LWBUAoP-XB9n3VW_aw5Y
```

This redirects to:

```
https://sheets-json-api.netlify.app/1vufOODlks7O9PGak54hMNP4LWBUAoP-XB9n3VW_aw5Y/1
```

## Development

The Edge Function lives in `netlify/edge-functions/opensheet.ts`.

### Running tests

```sh
npm test
```

Tests fetch a sample spreadsheet and verify rows are returned, ensure the deployed API returns `[{"headline":"It's working!"}]`, and confirm that requests missing a sheet segment redirect to the first sheet.

## Deployment

Netlify builds read `netlify.toml` and publish files from `public`.
