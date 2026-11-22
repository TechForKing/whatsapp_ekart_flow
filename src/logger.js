/**
 * Tiny structured logger so we can swap in winston / pino later
 * without touching every file.
 */
function timestamp() {
  return new Date().toISOString();
}

const logger = {
  info: (msg) => console.log(`[${timestamp()}] INFO  ${msg}`),
  warn: (msg) => console.warn(`[${timestamp()}] WARN  ${msg}`),
  error: (msg) => console.error(`[${timestamp()}] ERROR ${msg}`),
};

module.exports = logger;
