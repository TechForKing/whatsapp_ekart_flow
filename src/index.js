/**
 * Entry point — boots the WhatsApp client and starts listening.
 */
const http = require("http");
const { createClient, registerEvents, getStatus } = require("./client");
const logger = require("./logger");

let activeClient = null;

// ── Lightweight HTTP health check & Device Link Server ────────────
const PORT = process.env.PORT || 10000;
const server = http.createServer(async (req, res) => {
  const { status, qr, code } = getStatus();

  // ── API: Request 8-character Pairing Code ────────────────────────
  if (req.url.startsWith("/api/request-code")) {
    const urlObj = new URL(req.url, "http://localhost");
    const phone = urlObj.searchParams.get("phone");

    if (!phone) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing phone parameter" }));
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    logger.info(`[PAIRING] Manual pairing code requested for: ${cleanPhone}`);

    try {
      if (!activeClient) {
        throw new Error("WhatsApp client not initialized yet");
      }
      const pairCode = await activeClient.requestPairingCode(cleanPhone);
      logger.info(`[PAIRING] Code received: ${pairCode}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: pairCode }));
    } catch (err) {
      logger.error(`[PAIRING] Error: ${err.message}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message || "Failed to request code" }));
    }
    return;
  }

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
          .code-box { font-size: 32px; letter-spacing: 6px; font-weight: 800; color: #075e54; background: #e8f5e9; padding: 14px; border-radius: 10px; border: 2px dashed #4caf50; margin: 12px 0; font-family: monospace; }
          .pair-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 16px 0; text-align: left; }
          .pair-card h4 { margin: 0 0 6px 0; color: #0f766e; font-size: 14px; }
          .pair-card p { margin: 0 0 10px 0; font-size: 12px; color: #64748b; line-height: 1.4; }
          .input-row { display: flex; gap: 8px; }
          .input-row input { flex: 1; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; }
          .input-row button { padding: 10px 16px; background: #0f766e; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; white-space: nowrap; }
          .input-row button:disabled { background: #94a3b8; cursor: not-allowed; }
          #qr-img { border: 6px solid #f0f2f5; border-radius: 8px; margin: 12px auto; display: block; max-width: 100%; height: auto; }
          textarea { width: 100%; height: 50px; font-family: monospace; font-size: 11px; padding: 6px; box-sizing: border-box; border-radius: 6px; border: 1px solid #ccc; word-break: break-all; resize: none; }
          .divider { display: flex; align-items: center; text-align: center; color: #94a3b8; font-size: 12px; margin: 16px 0; }
          .divider::before, .divider::after { content: ''; flex: 1; border-bottom: 1px solid #e2e8f0; }
          .divider:not(:empty)::before { margin-right: .5em; }
          .divider:not(:empty)::after { margin-left: .5em; }
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

          <div id="auth-box" style="display: none;">
            <!-- Option 1: Pairing Code -->
            <div class="pair-card">
              <h4>Method 1: Link via Phone Number (Instant & Reliable)</h4>
              <p>No camera scanning needed. Enter your WhatsApp phone number with country code (e.g. 919876543210):</p>
              <div class="input-row">
                <input id="phone-input" type="tel" placeholder="e.g. 919876543210" />
                <button id="get-code-btn" onclick="requestCode()">Get Code</button>
              </div>
              <div id="code-result" style="display: none; text-align: center; margin-top: 12px;">
                <p style="font-size: 12px; color: #333; margin: 0;">Open WhatsApp on phone &gt; Linked Devices &gt; Link with phone number:</p>
                <div id="code-value" class="code-box">--------</div>
              </div>
            </div>

            <div class="divider">OR</div>

            <!-- Option 2: QR Code -->
            <div id="qr-box">
              <p style="font-size: 13px; color: #444; margin: 0 0 8px 0;">Method 2: Scan with camera (Linked Devices &gt; Link a Device)</p>
              <img id="qr-img" src="" alt="WhatsApp QR Code" width="260" height="260" />
              <textarea id="qr-raw" readonly onclick="this.select()"></textarea>
            </div>
          </div>

          <div id="ready-box" style="display: none;">
            <h3 style="color: #25D366; margin-top: 20px;">✅ Logged in successfully!</h3>
            <p style="color: #555; font-size: 14px;">WhatsApp automation is active and listening for messages.</p>
          </div>
        </div>

        <script>
          let lastQR = null;

          async function requestCode() {
            const input = document.getElementById('phone-input');
            const btn = document.getElementById('get-code-btn');
            const phone = input.value.trim().replace(/\\D/g, '');

            if (!phone || phone.length < 10) {
              alert('Please enter a valid phone number with country code, e.g. 919876543210');
              return;
            }

            btn.disabled = true;
            btn.innerText = 'Requesting...';

            try {
              const res = await fetch('/api/request-code?phone=' + encodeURIComponent(phone));
              const data = await res.json();
              if (data.code) {
                document.getElementById('code-result').style.display = 'block';
                document.getElementById('code-value').innerText = data.code;
              } else {
                alert('Error: ' + (data.error || 'Failed to get pairing code'));
              }
            } catch (err) {
              alert('Network error: ' + err.message);
            } finally {
              btn.disabled = false;
              btn.innerText = 'Get Code';
            }
          }

          async function poll() {
            try {
              const res = await fetch('/api/status');
              const data = await res.json();

              document.getElementById('status-badge').innerText = data.status;

              if (data.status === 'READY' || data.status === 'AUTHENTICATED') {
                document.getElementById('loading-box').style.display = 'none';
                document.getElementById('auth-box').style.display = 'none';
                document.getElementById('ready-box').style.display = 'block';
                return;
              }

              if (data.qr || data.code) {
                document.getElementById('loading-box').style.display = 'none';
                document.getElementById('ready-box').style.display = 'none';
                document.getElementById('auth-box').style.display = 'block';

                if (data.code) {
                  document.getElementById('code-result').style.display = 'block';
                  document.getElementById('code-value').innerText = data.code;
                }

                if (data.qr && data.qr !== lastQR) {
                  lastQR = data.qr;
                  document.getElementById('qr-img').src = 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=' + encodeURIComponent(data.qr);
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
      <p><a href="/qr" style="display: inline-block; padding: 8px 16px; background: #25D366; color: white; text-decoration: none; border-radius: 6px;">👉 Open Device Link Page</a></p>
    </div>
  `);
});

server.listen(PORT, "0.0.0.0", () => {
  logger.info(`Health check HTTP server listening on port ${PORT}`);
});

logger.info("Starting WhatsApp automation client…");

activeClient = createClient();
registerEvents(activeClient);
activeClient.initialize();

// ── Graceful shutdown ──────────────────────────────────────────────
async function shutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully…`);
  try {
    server.close();
    if (activeClient) {
      await activeClient.destroy();
    }
  } catch (_) {
    // Client may already be gone.
  }
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
