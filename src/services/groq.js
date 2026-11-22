const Groq = require("groq-sdk");
const config = require("../config");
const logger = require("../logger");

const groq = new Groq({ apiKey: config.groqApiKey });

/**
 * Chat-style query — used by /bot command.
 * Responds as a business executive for the configured branch.
 */
async function askGroq(query) {
  const systemPrompt = `You are a professional and courteous business executive representing "${config.branchName}". 
You respond to customer and team queries in a polished, helpful, and concise manner.
Keep your tone warm yet professional — like a senior manager who genuinely cares about the business and the people involved.
Use short paragraphs suitable for WhatsApp messages. Avoid markdown formatting — use plain text only.
If you don't know something, say so honestly and offer to help find the answer.`;

  const response = await groq.chat.completions.create({
    model: config.groqModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ],
    temperature: 0.7,
    max_tokens: 1024,
  });

  return response.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";
}

/**
 * Structured JSON query — used by the workflow engine.
 * Sends a prompt and parses the response as JSON.
 */
async function queryJSON(prompt) {
  logger.info(`[GROQ-JSON] Sending structured query…`);

  const response = await groq.chat.completions.create({
    model: config.groqModel,
    messages: [
      {
        role: "system",
        content:
          "You are a precise data extraction assistant. Always respond with ONLY valid JSON — no markdown fences, no explanation, no extra text. Just the raw JSON object.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0,
    max_tokens: 256,
  });

  const raw = response.choices[0]?.message?.content || "{}";
  logger.info(`[GROQ-JSON] Raw response: ${raw}`);

  // Strip markdown fences if the model wraps them anyway
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    logger.error(`[GROQ-JSON] Failed to parse: ${cleaned}`);
    throw new Error("Groq returned invalid JSON");
  }
}

/**
 * Default execute function when called as an engine in a workflow.
 */
async function execute(input, step, context) {
  const template = step.prompt || input || "";
  const prompt = template.replace(/\{\{(\w+)\}\}/g, (_, k) => context[k] ?? "");
  return await queryJSON(prompt);
}

module.exports = { askGroq, queryJSON, execute };
