# Google Sheets > JSON API

<img width="2048" height="1612" alt="sheets-json-api netlify app_(Nest Hub)" src="https://github.com/user-attachments/assets/c85faebb-1f51-4442-96ba-8c70113dacf0" />

An API that converts Google Sheets into JSON, served via a Netlify Edge Function.

Visiting the root URL shows a form where you can paste a Google Sheets link. The
form rewrites the link to a valid API URL and redirects you there.

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

The Edge Function lives in `netlify/edge-functions/opensheet.js`.

### Environment variables

The function requires a `GOOGLE_API_KEY` value using `process.env` in Node or
`Deno.env.get` in Netlify's Edge runtime. If the variable is missing, the
function responds with an error.

### Caching

Responses are cached for 30 seconds using the Edge Cache API when available. If
the runtime does not support the cache API, the function skips caching but still
returns live data.

### Running tests

```sh
npm test
```

Tests mock Google Sheets responses to verify rows are returned, ensure the
deployed API returns `[{"headline":"It's working!"}]`, and confirm that
requests missing a sheet segment redirect to the first sheet.

### Continuous integration

Pull requests to `main` run `npm test` via GitHub Actions.

## Deployment

Netlify builds read `netlify.toml` and publish files from `public`.
