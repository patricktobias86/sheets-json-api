// netlify/edge-functions/opensheet.js

export default async function handler(request, context) {
  const GOOGLE_API_KEY =
    (globalThis.process?.env?.GOOGLE_API_KEY ??
      globalThis.Deno?.env?.get("GOOGLE_API_KEY"))?.trim();
  if (!GOOGLE_API_KEY) {
    return error("Missing GOOGLE_API_KEY environment variable", 500);
  }

  const url = new URL(request.url);

  if (url.pathname === "/") {
    return context.next();
  }

  let [id, sheet, ...otherParams] = url.pathname
    .slice(1)
    .split("/")
    .filter((x) => x);

  if (!id) {
    return error("URL format is /spreadsheet_id/sheet_name", 404);
  }

  if (!sheet) {
    return Response.redirect(`${url.origin}/${id}/1`, 302);
  }

  if (otherParams.length > 0) {
    return error("URL format is /spreadsheet_id/sheet_name", 404);
  }

  // Try cache first (if cache API is available)
  const cacheKey = `${url.origin}/${id}/${encodeURIComponent(sheet)}`;
  const cache = globalThis.caches?.default;
  if (cache) {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      console.log(`Serving from cache: ${cacheKey}`);
      return cachedResponse;
    } else {
      console.log(`Cache miss: ${cacheKey}`);
    }
  }

  // Normalize sheet (handle '+' and decode)
  sheet = decodeURIComponent(sheet.replace(/\+/g, " "));

  // If numeric, treat as 1-based sheet index and look up sheet title
  if (!isNaN(sheet)) {
    if (parseInt(sheet, 10) === 0) {
      return error("For this API, sheet numbers start at 1");
    }

    const sheetMetaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${id}?key=${GOOGLE_API_KEY}`
    );
    const sheetData = await sheetMetaRes.json();

    if (sheetData?.error) {
      return error(sheetData.error.message, sheetMetaRes.status || 400);
    }

    const sheetIndex = parseInt(sheet, 10) - 1;
    const sheetWithThisIndex = sheetData.sheets?.[sheetIndex];

    if (!sheetWithThisIndex) {
      return error(`There is no sheet number ${sheet}`);
    }

    sheet = sheetWithThisIndex.properties.title;
  }

  const valuesRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(
      sheet
    )}?key=${GOOGLE_API_KEY}`
  );
  const result = await valuesRes.json();

  if (result?.error) {
    return error(result.error.message, valuesRes.status || 400);
  }

  const rows = [];
  const rawRows = result.values || [];
  const headers = rawRows.shift() || [];

  rawRows.forEach((row) => {
    const rowData = {};
    row.forEach((item, index) => {
      rowData[headers[index]] = item;
    });
    rows.push(rowData);
  });

  const apiResponse = new Response(JSON.stringify(rows), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "s-maxage=30",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept",
    },
  });

  // Write to cache in the background
  if (cache) {
    context.waitUntil(cache.put(cacheKey, apiResponse.clone()));
  }

  return apiResponse;
}

function error(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept",
    },
  });
}
