const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { handleAutomation } = require("./automation");
const logger = require("./logger");

/**
 * Create and configure the WhatsApp client.
 * Uses LocalAuth strategy so the session is stored in .wwebjs_auth/
 * and survives server restarts without re-scanning the QR code.
 */
function createClient() {
  const puppeteerOpts = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-extensions",
      "--disable-default-apps",
      "--disable-sync",
      "--disable-translate",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-breakpad",
      "--disable-component-extensions-with-background-pages",
      "--disable-features=TranslateUI,BlinkGenPropertyTrees",
      "--disable-ipc-flooding-protection",
      "--disable-renderer-backgrounding",
      "--enable-features=NetworkService,NetworkServiceInProcess",
      "--force-color-profile=srgb",
      "--metrics-recording-only",
      "--mute-audio",
      "--js-flags=--max-old-space-size=128",
    ],
  };

  // If a custom Chrome binary path is specified in environment
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    puppeteerOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: process.env.WWEBJS_DATA_PATH || undefined,
    }),
    puppeteer: puppeteerOpts,
  });

  return client;
}

/**
 * Register all event handlers on the client.
 */
function registerEvents(client) {
  // ── QR Code ──────────────────────────────────────────────────────
  client.on("qr", (qr) => {
    logger.info("Scan the QR code below to log in:");
    qrcode.generate(qr, { small: true });
  });

  // ── Authentication ───────────────────────────────────────────────
  client.on("authenticated", () => {
    logger.info("Authentication successful! Session saved locally.");
  });

  client.on("auth_failure", (msg) => {
    logger.error(`Authentication failed: ${msg}`);
  });

  // ── Loading progress ─────────────────────────────────────────────
  client.on("loading_screen", (percent, message) => {
    logger.info(`Loading: ${percent}% — ${message}`);
  });

  // ── Ready ────────────────────────────────────────────────────────
  client.on("ready", () => {
    logger.info("✅ WhatsApp client is ready and listening for messages.");
  });

  // ── Incoming messages ────────────────────────────────────────────
  client.on("message", async (message) => {
    try {
      await handleAutomation(client, message);
    } catch (err) {
      logger.error(`Error handling message: ${err.message}`);
    }
  });

  // ── Disconnected ─────────────────────────────────────────────────
  client.on("disconnected", (reason) => {
    logger.warn(`Client disconnected: ${reason}. Attempting to reconnect…`);
    client.initialize();
  });
}

module.exports = { createClient, registerEvents };
