const config = require("./config");
const logger = require("./logger");
const { askGroq } = require("./services/groq");
const workflowEngine = require("./engine/workflow");

/**
 * Core gate-keeper: only messages from allowed IDs are processed.
 * Every incoming message logs its `from` field first for easy debugging.
 */
async function handleAutomation(client, message) {
  const from = message.from;

  // ── Always log the sender first ──────────────────────────────────
  logger.info(`[INCOMING] from: "${from}"`);

  // ── Security gate ────────────────────────────────────────────────
  if (!config.allowedIds.has(from)) {
    return; // silently ignore
  }

  // ── Mark as seen (blue ticks) ──────────────────────────────────
  const chat = await message.getChat();
  await chat.sendSeen();

  // ── Log the accepted message ─────────────────────────────────────
  const body = message.body;
  logger.info(`[ALLOWED] Message from ${from}: ${body}`);

  // ── Route to the right handler ─────────────────────────────────
  await processCommand(client, message, body);
}

/**
 * Command router.
 */
async function processCommand(client, message, body) {
  const text = body.trim();
  const textLower = text.toLowerCase();

  // ── /bot {query} → Groq AI chat response ────────────────────────
  if (textLower.startsWith("/bot ")) {
    const query = text.slice(5).trim();
    if (!query) {
      await message.reply("Please provide a query after /bot.\nExample: /bot What are today's delivery targets?");
      return;
    }

    logger.info(`[GROQ] Query: "${query}"`);
    const chat = await message.getChat();
    await chat.sendStateTyping();

    try {
      const reply = await askGroq(query);
      logger.info(`[GROQ] Response: "${reply.substring(0, 100)}…"`);
      await message.reply(reply);
    } catch (err) {
      logger.error(`[GROQ] Error: ${err.message}`);
      await message.reply("⚠️ Sorry, I couldn't process your request right now. Please try again shortly.");
    } finally {
      await chat.clearState();
    }
    return;
  }

  // ── ping → pong ──────────────────────────────────────────────────
  if (textLower === "ping") {
    await message.reply("🏓 pong — server is alive!");
    logger.info("Replied with pong.");
    return;
  }

  // ── Default: run address-cod-check workflow ──────────────────────
  try {
    await workflowEngine.run("address-cod-check", message);
  } catch (err) {
    logger.error(`[WORKFLOW] Error: ${err.message}`);
  }
}

module.exports = { handleAutomation };
