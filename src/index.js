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

  // ── API: JSON status for smooth background polling ───────────────
  if (req.url === "/api/status") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    });
    res.end(JSON.stringify(getStatus()));
    return;
  }

  // ── /qr endpoint: Web QR Code & Pairing Code viewer ─────────────
  if (req.url === "/qr") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp Device Link</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #e5ddd5; }
          .card { background: white; padding: 24px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.12); text-align: center; max-width: 440px; width: 90%; }
          h2 { color: #128c7e; margin-top: 0; margin-bottom: 8px; }
          .status-badge { display: inline-block; padding: 4px 12px; background: #e1f5fe; color: #0288d1; border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 12px; }
          .code-box { font-size: 34px; letter-spacing: 6px; font-weight: 800; color: #075e54; background: #e8f5e9; padding: 16px; border-radius: 10px; border: 2px dashed #4caf50; margin: 16px 0; font-family: monospace; }
          #qr-img { border: 6px solid #f0f2f5; border-radius: 8px; margin: 12px auto; display: block; max-width: 100%; height: auto; }
          textarea { width: 100%; height: 60px; font-family: monospace; font-size: 11px; padding: 8px; box-sizing: border-box; border-radius: 6px; border: 1px solid #ccc; word-break: break-all; resize: none; }
          .hint { color: #666; font-size: 12px; margin-top: 8px; }
          .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #128c7e; border-radius: 50%; width: 28px; height: 28px; animation: spin 1s linear infinite; margin: 20px auto; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>WhatsApp Device Link</h2>
          <div id="status-badge" class="status-badge">Connecting...</div>

          <div id="loading-box">
            <div class="spinner"></div>
            <p style="color: #555; font-size: 14px;">Connecting to WhatsApp Web...<br>Please wait a few moments.</p>
          </div>

          <div id="code-box-container" style="display: none;">
            <p style="font-size: 14px; color: #333; margin-bottom: 4px;">Open WhatsApp on phone &gt; <strong>Linked Devices</strong> &gt; <strong>Link with phone number</strong></p>
            <p style="font-size: 12px; color: #666;">Enter this 8-character code:</p>
            <div id="code-value" class="code-box">--------</div>
          </div>

          <div id="qr-box" style="display: none;">
            <p style="font-size: 14px; color: #444; margin-bottom: 8px;">Open WhatsApp &gt; Linked Devices &gt; Link a Device</p>
            <img id="qr-img" src="" alt="WhatsApp QR Code" width="280" height="280" />
            <p style="text-align: left; font-size: 12px; margin: 8px 0 4px 0;"><strong>Raw QR String:</strong></p>
            <textarea id="qr-raw" readonly onclick="this.select()"></textarea>
          </div>

          <div id="ready-box" style="display: none;">
            <h3 style="color: #25D366; margin-top: 20px;">✅ Logged in successfully!</h3>
            <p style="color: #555; font-size: 14px;">WhatsApp automation is active and listening for messages.</p>
          </div>
        </div>

        <script>
          let lastQR = null;

          async function poll() {
            try {
              const res = await fetch('/api/status');
              const data = await res.json();

              document.getElementById('status-badge').innerText = data.status;

              if (data.status === 'READY' || data.status === 'AUTHENTICATED') {
                document.getElementById('loading-box').style.display = 'none';
                document.getElementById('qr-box').style.display = 'none';
                document.getElementById('code-box-container').style.display = 'none';
                document.getElementById('ready-box').style.display = 'block';
                return;
              }

              if (data.code) {
                document.getElementById('loading-box').style.display = 'none';
                document.getElementById('qr-box').style.display = 'none';
                document.getElementById('ready-box').style.display = 'none';
                document.getElementById('code-box-container').style.display = 'block';
                document.getElementById('code-value').innerText = data.code;
                return;
              }

              if (data.qr) {
                document.getElementById('loading-box').style.display = 'none';
                document.getElementById('code-box-container').style.display = 'none';
                document.getElementById('ready-box').style.display = 'none';
                document.getElementById('qr-box').style.display = 'block';

                if (data.qr !== lastQR) {
                  lastQR = data.qr;
                  document.getElementById('qr-img').src = 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=' + encodeURIComponent(data.qr);
                  document.getElementById('qr-raw').value = data.qr;
                }
              }
            } catch (err) {}
          }

          setInterval(poll, 2500);
          poll();
        </script>
      </body>
      </html>
    `);
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
