import { localGet, localSet } from "./cache.js";

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

  // Split the sheet segment into a sheet name and an optional range.
  const parsed = parseSheetSegment(decodeURIComponent(sheet.replace(/\+/g, " ")));

  // If numeric, resolve to the sheet title. Metadata is cached by spreadsheet
  // ID so it is only fetched once per spreadsheet.
  if (!isNaN(parsed.name)) {
    if (parseInt(parsed.name, 10) === 0) {
      return error("For this API, sheet numbers start at 1");
    }

    const metadataCacheKey = `spreadsheet:${id}`;
    let sheetData = localGet(metadataCacheKey);

    if (sheetData === undefined) {
      const sheetMetaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}?key=${GOOGLE_API_KEY}`
      );
      sheetData = await sheetMetaRes.json();

      if (sheetData?.error) {
        return error(sheetData.error.message, sheetMetaRes.status || 400);
      }

      localSet(metadataCacheKey, sheetData);
    }

    const sheetIndex = parseInt(parsed.name, 10) - 1;
    const sheetWithThisIndex = sheetData.sheets?.[sheetIndex];

    if (!sheetWithThisIndex) {
      return error(`There is no sheet number ${parsed.name}`);
    }

    parsed.name = sheetWithThisIndex.properties.title;
  }

  // Cache key uses the sheet *name* only (not the range), so requests like
  // "Sheet1!A:B" and "Sheet1!A:C" share one cached copy of the full sheet.
  const localCacheKey = `${id}/${encodeURIComponent(parsed.name)}`;

  const cachedValues = localGet(localCacheKey);
  if (cachedValues !== undefined) {
    console.log(`Serving from local cache: ${localCacheKey}`);
    return serialize(buildRows(slice(cachedValues, parsed)));
  }

  // Edge Cache API fallback (exact per-range responses).
  const cache = globalThis.caches?.default;
  if (cache) {
    const cacheKey = `${url.origin}/${id}/${encodeURIComponent(sheet)}`;
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      console.log(`Serving from cache: ${cacheKey}`);
      return cachedResponse;
    }
    console.log(`Cache miss: ${cacheKey}`);
  }

  const valuesRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(
      parsed.name
    )}?key=${GOOGLE_API_KEY}`
  );
  const result = await valuesRes.json();

  if (result?.error) {
    return error(result.error.message, valuesRes.status || 400);
  }

  // Cache the full sheet so other ranges reuse it within 60 seconds.
  const fullValues = result.values || [];
  localSet(localCacheKey, fullValues);

  const apiResponse = serialize(buildRows(slice(fullValues, parsed)));

  if (cache) {
    context.waitUntil(
      cache.put(`${url.origin}/${id}/${encodeURIComponent(sheet)}`, apiResponse.clone())
    );
  }

  return apiResponse;
}

/**
 * Split a segment like "Sheet1!A1:B5" into a sheet name and the range to
 * slice out (0-based). With no "!", the whole sheet is requested.
 */
function parseSheetSegment(sheet) {
  const bang = sheet.lastIndexOf("!");
  if (bang === -1) {
    return { name: sheet, startCol: 0, startRow: 0, endCol: Infinity, endRow: Infinity };
  }

  const name = sheet.slice(0, bang);
  const [startPart, endPart = ""] = sheet.slice(bang + 1).split(":");
  const startMatch = /^([A-Z]+)(\d*)$/i.exec(startPart.trim());
  const endMatch = /^([A-Z]+)(\d*)$/i.exec(endPart.trim());

  return {
    name,
    startCol: startMatch ? colToIndex(startMatch[1]) : 0,
    startRow: startMatch && startMatch[2] ? parseInt(startMatch[2], 10) - 1 : 0,
    endCol: endMatch ? colToIndex(endMatch[1]) : Infinity,
    endRow: endMatch && endMatch[2] ? parseInt(endMatch[2], 10) - 1 : Infinity,
  };
}

/** Convert a column label ("A", "C", "AB") to a 0-based index. */
function colToIndex(col) {
  let index = 0;
  for (const ch of col.toUpperCase()) {
    index = index * 26 + (ch.charCodeAt(0) - 64);
  }
  return index - 1;
}

/**
 * Slice values to the requested range. Cells Google omits are filled with ""
 * so the result stays rectangular like the API's direct answer.
 */
function slice(values, range) {
  const limited = values.slice(
    range.startRow,
    range.endRow === Infinity ? undefined : range.endRow + 1
  );

  return limited.map((row) => {
    const lastCol =
      range.endCol === Infinity ? row.length - 1 : Math.min(range.endCol, row.length - 1);
    const out = [];
    for (let col = range.startCol; col <= lastCol; col++) {
      out.push(row[col] !== undefined ? row[col] : "");
    }
    return out;
  });
}

/** Build the JSON rows (first row = headers) from the (possibly sliced) values. */
function buildRows(rawValues) {
  const rows = [];
  const working = rawValues.slice();
  const headers = working.shift() || [];

  working.forEach((row) => {
    const rowData = {};
    row.forEach((item, index) => {
      rowData[headers[index]] = item;
    });
    rows.push(rowData);
  });

  return rows;
}

function serialize(rows) {
  return new Response(JSON.stringify(rows), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "s-maxage=60",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept",
    },
  });
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