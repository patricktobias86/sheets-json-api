import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import handler from "./functions/opensheet.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");

const port = process.env.PORT || 3000;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || "application/octet-stream";
}

function serveStatic(pathname, res) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(publicDir, safePath.replace(/^\//, ""));

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Not found");
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", guessContentType(filePath));
    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Error reading file");
    });
    stream.pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Always serve the landing page for "/"
  if (url.pathname === "/") {
    serveStatic("/", res);
    return;
  }

  // Try to serve a static asset first
  const staticCandidatePath = path.join(
    publicDir,
    url.pathname.replace(/^\//, "")
  );
  if (fs.existsSync(staticCandidatePath) && fs.statSync(staticCandidatePath).isFile()) {
    serveStatic(url.pathname, res);
    return;
  }

  // Fall back to the API handler for anything else
  try {
    const request = new Request(url.toString(), {
      method: req.method,
      headers: req.headers,
    });

    const context = {
      next: () => {
        // If the handler calls next(), show the landing page
        return new Response(fs.readFileSync(path.join(publicDir, "index.html")), {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        });
      },
      waitUntil: (promise) => {
        promise?.catch?.((error) => {
          console.error("Background task error:", error);
        });
      },
    };

    const response = await handler(request, context);

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const body = await response.arrayBuffer();
    res.end(Buffer.from(body));
  } catch (error) {
    console.error("Error handling request:", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
    }
    res.end("Internal server error");
  }
});

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

