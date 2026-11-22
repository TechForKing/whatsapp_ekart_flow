/**
 * Entry point — boots the WhatsApp client and starts listening.
 */
const http = require("http");
const { createClient, registerEvents } = require("./client");
const logger = require("./logger");

// ── Lightweight HTTP health check server for Render ────────────────
const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("WhatsApp automation server is running.\n");
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
