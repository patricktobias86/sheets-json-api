# Google Sheets > JSON API

<img width="2048" height="1612" alt="sheets-json-api netlify app_(Nest Hub)" src="https://github.com/user-attachments/assets/c85faebb-1f51-4442-96ba-8c70113dacf0" />

An API that converts Google Sheets into JSON, served by a regular JavaScript function (currently hosted on Coolift).

Visiting the root URL shows a form where you can paste a Google Sheets link. The
form rewrites the link to a valid API URL and redirects you there.

## Usage

Requests follow the pattern `/SPREADSHEET_ID/sheet_name_or_number`. If the sheet
segment is omitted, the request will redirect to the first sheet (`/1`).

Example:

```
https://sheet.primehostingdev.xyz/1vufOODlks7O9PGak54hMNP4LWBUAoP-XB9n3VW_aw5Y
```

This redirects to:

```
https://sheet.primehostingdev.xyz/1vufOODlks7O9PGak54hMNP4LWBUAoP-XB9n3VW_aw5Y/1
```

## Development

The main request handler lives in `functions/opensheet.js`. It is a regular
JavaScript function that can run in any compatible runtime.

For local development, run:

```sh
npm start
```

This starts a small Node server from `server.js` that serves `public/index.html`
at the root URL and forwards API requests to the handler in
`functions/opensheet.js`.

### Environment variables

The function requires a `GOOGLE_API_KEY` value using `process.env` in Node or
`Deno.env.get`. If the variable is missing, the function responds with an error.

### Caching

Responses are cached for 30 seconds when a cache API is available (for example,
in edge runtimes that expose `caches.default`). If the runtime does not support
the cache API, the function skips caching but still returns live data.

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

This project is currently hosted on Coolift. Static assets are served from
`public`, and incoming requests are handled by the function in
`functions/opensheet.js`.
