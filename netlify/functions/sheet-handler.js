exports.handler = async function (event) {
  const url = new URL(event.rawUrl);

  if (url.pathname === "/") {
    return {
      statusCode: 302,
      headers: {
        Location: "https://github.com/patricktobias86/google-sheets-api#readme",
      },
      body: "",
    };
  }

  let [id, sheet, ...otherParams] = url.pathname
    .slice(1)
    .split("/")
    .filter((x) => x);

  if (!id || !sheet || otherParams.length > 0) {
    return error("URL format is /spreadsheet_id/sheet_name", 404);
  }

  const cacheKey = `https://api.primeupyour.life/${id}/${encodeURIComponent(sheet)}`;
  const cache = caches.default;
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    console.log(`Serving from cache: ${cacheKey}`);
    return cachedResponse;
  } else {
    console.log(`Cache miss: ${cacheKey}`);
  }

  sheet = decodeURIComponent(sheet.replace(/\+/g, " "));

  if (!isNaN(sheet)) {
    if (parseInt(sheet) === 0) {
      return error("For this API, sheet numbers start at 1");
    }

    const sheetData = await (
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}?key=${process.env.GOOGLE_API_KEY}`
      )
    ).json();

    if (sheetData.error) {
      return error(sheetData.error.message);
    }

    const sheetIndex = parseInt(sheet) - 1;
    const sheetWithThisIndex = sheetData.sheets[sheetIndex];

    if (!sheetWithThisIndex) {
      return error(`There is no sheet number ${sheet}`);
    }

    sheet = sheetWithThisIndex.properties.title;
  }

  const result = await (
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(
        sheet
      )}?key=${process.env.GOOGLE_API_KEY}`
    )
  ).json();

  if (result.error) {
    return error(result.error.message);
  }

  const rows = [];

  const rawRows = result.values || [];
  const headers = rawRows.shift();

  rawRows.forEach((row) => {
    const rowData = {};
    row.forEach((item, index) => {
      rowData[headers[index]] = item;
    });
    rows.push(rowData);
  });

  const apiResponse = {
    statusCode: 200,
    body: JSON.stringify(rows),
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `s-maxage=30`,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "Origin, X-Requested-With, Content-Type, Accept",
    },
  };

  // Cache the response (Netlify does not support caching in the same way as Workers)
  // event.waitUntil(cache.put(cacheKey, apiResponse.clone()));

  return apiResponse;
};

const error = (message, status = 400) => {
  return {
    statusCode: status,
    body: JSON.stringify({ error: message }),
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "Origin, X-Requested-With, Content-Type, Accept",
    },
  };
};