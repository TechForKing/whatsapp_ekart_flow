/**
 * Entry point — boots the WhatsApp client and starts listening.
 */
const { createClient, registerEvents } = require("./client");
const logger = require("./logger");

logger.info("Starting WhatsApp automation server…");

const client = createClient();
registerEvents(client);
client.initialize();

// ── Graceful shutdown ──────────────────────────────────────────────
async function shutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully…`);
  try {
    await client.destroy();
  } catch (_) {
    // Client may already be gone.
  }
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
