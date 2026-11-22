/**
 * Entry point — boots the WhatsApp client and starts listening.
 */
const http = require("http");
const { createClient, registerEvents, getStatus } = require("./client");
const logger = require("./logger");

// ── Lightweight HTTP health check & QR Viewer server for Render ────
const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
  const { status, qr } = getStatus();

  // ── /qr endpoint: Web QR Code viewer ─────────────────────────────
  if (req.url === "/qr") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    if (qr) {
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(qr)}`;
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>WhatsApp QR Code</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta http-equiv="refresh" content="12">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #e5ddd5; }
            .card { background: white; padding: 24px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.12); text-align: center; max-width: 420px; width: 90%; }
            h2 { color: #128c7e; margin-top: 0; }
            img { border: 6px solid #f0f2f5; border-radius: 8px; margin: 12px 0; display: block; margin-left: auto; margin-right: auto; }
            textarea { width: 100%; height: 70px; font-family: monospace; font-size: 11px; padding: 8px; box-sizing: border-box; border-radius: 6px; border: 1px solid #ccc; word-break: break-all; resize: none; }
            .hint { color: #666; font-size: 12px; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>WhatsApp Web Link</h2>
            <p style="font-size: 14px; color: #444;">Open WhatsApp &gt; Linked Devices &gt; Link a Device</p>
            <img src="${qrImageUrl}" alt="WhatsApp QR Code" width="300" height="300" />
            <p style="text-align: left; font-size: 12px; margin-bottom: 4px;"><strong>Raw QR String:</strong></p>
            <textarea readonly onclick="this.select()">${qr}</textarea>
            <p class="hint">⚡ Auto-refreshes every 12s when refreshed.</p>
          </div>
        </body>
        </html>
      `);
    } else {
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>WhatsApp Web Status</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta http-equiv="refresh" content="5">
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f0f2f5; }
            .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 90%; }
            .status { font-weight: bold; color: #128c7e; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Status: <span class="status">${status}</span></h2>
            <p>${status === 'READY' || status === 'AUTHENTICATED' ? '✅ Client is logged in and ready!' : '⏳ Connecting to WhatsApp Web... please wait, this page auto-refreshes.'}</p>
          </div>
        </body>
        </html>
      `);
    }
    return;
  }

  // ── Default Healthcheck Route ────────────────────────────────────
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`
    <div style="font-family: sans-serif; padding: 20px;">
      <h2>WhatsApp Automation Server</h2>
      <p>Status: <strong>${status}</strong></p>
      <p><a href="/qr" style="display: inline-block; padding: 8px 16px; background: #25D366; color: white; text-decoration: none; border-radius: 6px;">👉 Open QR Code Page</a></p>
    </div>
  `);
});

server.listen(PORT, "0.0.0.0", () => {
  logger.info(`Health check HTTP server listening on port ${PORT}`);
});

logger.info("Starting WhatsApp automation client…");

const client = createClient();
registerEvents(client);
client.initialize();

// ── Graceful shutdown ──────────────────────────────────────────────
async function shutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully…`);
  try {
    server.close();
    await client.destroy();
  } catch (_) {
    // Client may already be gone.
  }
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
