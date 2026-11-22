const config = require("../config");
const logger = require("../logger");

// ── Token + serviceability cache ───────────────────────────────────
let cachedToken = null;
let tokenExpiresAt = 0;

let cachedServiceability = null; // Map<string, object>
let serviceabilityCachedAt = 0;
const SERVICEABILITY_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Authenticate with eKart and return an access token.
 * Token is cached and refreshed when expired.
 */
async function authenticate() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const url = `${config.ekart.authBaseUrl}/${config.ekart.clientId}`;
  logger.info(`[EKART] Authenticating at ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: config.ekart.username,
      password: config.ekart.password,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eKart auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + 55 * 60 * 1000; // refresh 5 min before the typical 1-hr expiry
  logger.info("[EKART] Authenticated successfully. Token cached.");
  return cachedToken;
}

/**
 * Fetch the full serviceability list from eKart and cache it as a Map
 * keyed by pincode string for O(1) lookups.
 */
async function fetchServiceability() {
  if (cachedServiceability && Date.now() - serviceabilityCachedAt < SERVICEABILITY_TTL_MS) {
    return cachedServiceability;
  }

  const token = await authenticate();
  const url = config.ekart.dataBaseUrl;
  logger.info(`[EKART] Fetching serviceability data…`);

  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    // If 401, clear token cache and retry once
    if (res.status === 401) {
      logger.warn("[EKART] Token expired or invalid, re-authenticating…");
      cachedToken = null;
      tokenExpiresAt = 0;
      const newToken = await authenticate();
      const retryRes = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${newToken}` },
      });
      if (!retryRes.ok) {
        const errText = await retryRes.text();
        throw new Error(`eKart serviceability failed (${retryRes.status}): ${errText}`);
      }
      const retryData = await retryRes.json();
      return buildCache(retryData);
    }
    const errText = await res.text();
    throw new Error(`eKart serviceability failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return buildCache(data);
}

function buildCache(data) {
  const list = data.serviceability || [];
  cachedServiceability = new Map();
  for (const entry of list) {
    cachedServiceability.set(String(entry.pincode), entry);
  }
  serviceabilityCachedAt = Date.now();
  logger.info(`[EKART] Cached ${cachedServiceability.size} pincodes.`);
  return cachedServiceability;
}

/**
 * Check if COD is available for a pincode.
 * Returns: boolean (true if serviceable with COD, false if not found or no COD)
 */
async function isCodAvailable(pincode) {
  const pin = String(pincode).trim();
  const serviceMap = await fetchServiceability();
  const entry = serviceMap.get(pin);

  if (!entry) {
    logger.info(`[EKART] Pincode ${pin} — NOT FOUND in serviceability list.`);
    return false;
  }

  const cod = entry.lmCod === true;
  logger.info(`[EKART] Pincode ${pin} — found. lmCod=${entry.lmCod}, lmPrepaid=${entry.lmPrepaid}`);
  return cod;
}

module.exports = { authenticate, fetchServiceability, isCodAvailable };
