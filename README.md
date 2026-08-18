# Google Sheets > JSON API

<img width="2048" height="1612" alt="sheets-json-api netlify app_(Nest Hub)" src="https://github.com/user-attachments/assets/c85faebb-1f51-4442-96ba-8c70113dacf0" />

An API that converts Google Sheets into JSON, served by a regular JavaScript function (currently hosted on Coolify (self-hosted)).

Visiting the root URL shows a form where you can paste a Google Sheets link. The
form rewrites the link to a valid API URL, lets you copy it from the page, and
fetches a live JSON preview from the same API endpoint.

The root page serves `public/index.html` (with `/favicon.ico`), and the server
also exposes a simple `robots.txt` that allows all crawlers.

The landing page keeps its small design system in the embedded stylesheet in
`public/index.html`: shared color, spacing, type, radius, and shadow tokens live
in `:root`, with reusable classes for section spacing, headings, focus states,
and generated output.

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
Copy `.env.example` to `.env` for local Docker Compose usage, or export the
variables in your shell before starting the app.

### Docker Compose

Build and run the app locally with Docker Compose:

```sh
cp .env.example .env
docker compose -f compose.yml -f compose.local.yml up --build
```

The local override publishes the app at `http://localhost:3000` by default.
Set `PORT` to change the local host port, and set `GOOGLE_API_KEY` in the
environment or `.env` file for API requests.

### Caching

The function keeps a short-lived local, in-memory cache of spreadsheets so that
requests for the same spreadsheet within 30 seconds of the previous request are
served without hitting the Google Sheets API again. It stores both the
spreadsheet document metadata (keyed by spreadsheet ID, used to resolve sheet
numbers) and the full contents of each requested sheet. This cache lives in the
process's memory (`functions/cache.js`) and works in any runtime, including the
Node.js server used on Coolify.

Because the cache is keyed by the spreadsheet ID and sheet *name* (not the full
range), different ranges of the same sheet are treated as the same type of
request: once one range (e.g. `Sheet1!A:B`) has been fetched, any other range
of that sheet (e.g. `Sheet1!A:C`) is served from the same cached copy until the
30-second window expires. `Cache-Control: s-maxage=30` is set on responses.

When an edge Cache API is available (for example, runtimes that expose
`caches.default`), exact per-range responses are also cached for the same
30-second window. If neither the local memory cache nor the cache API has a
fresh entry, the function fetches live data and stores it before responding.

### Running tests

```sh
npm test
```

Tests mock Google Sheets responses to verify rows are returned, ensure the
deployed API returns `[{"headline":"It's working!"}]`, and confirm that
requests missing a sheet segment redirect to the first sheet.

### Continuous integration

Pull requests to `main` run `npm test` via GitHub Actions.
Dependabot checks npm packages and GitHub Actions weekly and opens pull
requests for available updates.

## Deployment

This project is currently hosted on Coolify (self-hosted). Static assets are served from
`public`, and incoming requests are handled by the function in
`functions/opensheet.js`. The included `Dockerfile` and `compose.yml` can be
used by container-based deployments; configure `GOOGLE_API_KEY` as an
environment variable in the hosting platform. The production Compose file uses
`expose` instead of a host `ports` binding so Coolify can route traffic through
its proxy without requiring host port `3000` to be free.
