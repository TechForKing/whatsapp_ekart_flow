const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { handleAutomation } = require("./automation");
const logger = require("./logger");

/**
 * Create and configure the WhatsApp client.
 */
function createClient() {
  let puppeteerOpts;

  // ── Remote Browser (Browserless / Remote Chrome via WebSocket) ────
  if (process.env.BROWSERLESS_WS_URL) {
    logger.info(`[PUPPETEER] Connecting to remote browser: ${process.env.BROWSERLESS_WS_URL}`);
    puppeteerOpts = {
      browserWSEndpoint: process.env.BROWSERLESS_WS_URL,
    };
  } else {
    // ── Local Chromium with standard stable flags ───────────────────
    logger.info("[PUPPETEER] Launching local Chromium with clean flags");
    puppeteerOpts = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      puppeteerOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: process.env.WWEBJS_DATA_PATH || undefined,
    }),
    authTimeoutMs: 120000, // 2 minutes
    puppeteer: puppeteerOpts,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  });

  return client;
}

let currentQR = null;
let currentStatus = "CONNECTING";

function getStatus() {
  return { status: currentStatus, qr: currentQR };
}

/**
 * Register all event handlers on the client.
 */
function registerEvents(client) {
  // ── QR Code ──────────────────────────────────────────────────────
  client.on("qr", (qr) => {
    currentQR = qr;
    currentStatus = "QR_READY";
    logger.info("==================== RAW QR CODE STRING ====================");
    logger.info(qr);
    logger.info("============================================================");
    logger.info("Scan the QR code below or open /qr in your browser:");
    qrcode.generate(qr, { small: true });
  });

  // ── Authentication ───────────────────────────────────────────────
  client.on("authenticated", () => {
    currentQR = null;
    currentStatus = "AUTHENTICATED";
    logger.info("Authentication successful! Session saved locally.");
  });

  client.on("change_state", (state) => {
    logger.info(`[STATE] Connection state changed to: ${state}`);
  });

  client.on("auth_failure", (msg) => {
    currentStatus = `AUTH_FAILURE: ${msg}`;
    logger.error(`Authentication failed: ${msg}`);
  });

  // ── Loading progress ─────────────────────────────────────────────
  client.on("loading_screen", (percent, message) => {
    currentStatus = `LOADING (${percent}%): ${message}`;
    logger.info(`Loading: ${percent}% — ${message}`);
  });

  // ── Ready ────────────────────────────────────────────────────────
  client.on("ready", () => {
    currentQR = null;
    currentStatus = "READY";
    logger.info("✅ WhatsApp client is ready and listening for messages.");
  });

  // ── Incoming messages ────────────────────────────────────
  client.on("message", async (message) => {
    try {
      await handleAutomation(client, message);
    } catch (err) {
      logger.error(`Error handling message: ${err.message}`);
    }
  });

  // ── Disconnected ─────────────────────────────────────────────────
  client.on("disconnected", (reason) => {
    currentStatus = `DISCONNECTED: ${reason}`;
    logger.warn(`Client disconnected: ${reason}. Attempting to reconnect…`);
    client.initialize();
  });
}

module.exports = { createClient, registerEvents, getStatus };
