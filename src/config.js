require("dotenv").config();

function requireEnv(key) {
  const val = process.env[key];
  if (!val) {
    console.error(`ERROR: ${key} is not set in .env — exiting.`);
    process.exit(1);
  }
  return val;
}

const ALLOWED_IDS = requireEnv("ALLOWED_IDS");
const GROQ_API_KEY = requireEnv("GROQ_API_KEY");
const BRANCH_NAME = requireEnv("BRANCH_NAME");
const EKART_CLIENT_ID = requireEnv("EKART_CLIENT_ID");
const EKART_USERNAME = requireEnv("EKART_USERNAME");
const EKART_PASSWORD = requireEnv("EKART_PASSWORD");

// Parse comma-separated string into a Set for O(1) lookups
const allowedIds = new Set(
  ALLOWED_IDS.split(",")
    .map((id) => id.trim())
    .filter(Boolean)
);

console.log(`Loaded ${allowedIds.size} allowed sender(s):`, [...allowedIds]);
console.log(`Branch: ${BRANCH_NAME}`);
console.log(`Groq model: ${process.env.GROQ_MODEL || "openai/gpt-oss-120b"}`);

module.exports = {
  allowedIds,
  groqApiKey: GROQ_API_KEY,
  groqModel: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  branchName: BRANCH_NAME,
  ekart: {
    clientId: EKART_CLIENT_ID,
    username: EKART_USERNAME,
    password: EKART_PASSWORD,
    authBaseUrl: "https://app.elite.ekartlogistics.in/integrations/v2/auth/token",
    dataBaseUrl: "https://app.elite.ekartlogistics.in/data/serviceability/bulk/NON_LARGE",
  },
};
