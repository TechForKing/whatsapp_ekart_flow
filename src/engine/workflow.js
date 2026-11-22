const services = require("../services");
const logger = require("../logger");
const path = require("path");

/**
 * Generic Workflow Engine
 *
 * Driven 100% by JSON configuration. Contains zero business-logic hardcoding.
 * Supports:
 *   - "engine" + "worker": dynamic dispatch to registered services
 *   - "condition": nested tree branching matching on stringified results
 *   - "reply": sends a WhatsApp message with typing indicator
 *   - "react": reacts to the WhatsApp message with an emoji
 *   - "skip": stops processing without action
 */
class WorkflowEngine {
  constructor() {
    this.workflows = new Map();
  }

  /**
   * Load workflow configuration from JSON file.
   */
  load(name) {
    if (this.workflows.has(name)) return this.workflows.get(name);

    const filePath = path.join(__dirname, "..", "workflows", `${name}.json`);
    const workflow = require(filePath);
    this.workflows.set(name, workflow);
    logger.info(`[ENGINE] Loaded workflow: "${workflow.name || name}"`);
    return workflow;
  }

  /**
   * Resolve variables in templates, e.g. "{{is_address}}" or "Prefix {{var}} suffix"
   */
  resolveValue(val, context) {
    if (typeof val !== "string") return val;

    // Direct variable reference (preserves booleans/objects)
    const exact = val.match(/^\{\{(\w+)\}\}$/);
    if (exact) {
      return context[exact[1]];
    }

    // String template replacement
    return val.replace(/\{\{(\w+)\}\}/g, (_, k) => context[k] ?? "");
  }

  /**
   * Run a workflow against an incoming WhatsApp message.
   */
  async run(workflowName, message) {
    const workflow = this.load(workflowName);
    const context = {
      message_text: message.body,
    };

    const steps = Array.isArray(workflow) ? workflow : (workflow.steps || workflow.pipeline || []);

    for (const step of steps) {
      const finished = await this.executeNode(step, context, message);
      if (finished) break;
    }

    logger.info(`[ENGINE] ✅ Workflow finished.`);
  }

  /**
   * Recursively executes any node in the JSON workflow tree.
   * Returns true if a terminal action occurred (reply, react, skip).
   */
  async executeNode(node, context, message) {
    if (!node || typeof node !== "object") return false;

    // ── Terminal Action: Skip ───────────────────────────────────────
    if (node.skip) {
      logger.info(`[ENGINE] ⏭ Skip.`);
      return true;
    }

    // ── Terminal Action: Reply ──────────────────────────────────────
    if (node.reply) {
      const text = this.resolveValue(node.reply, context);
      logger.info(`[ENGINE] 💬 Replying: "${text}"`);
      const chat = await message.getChat();
      await chat.sendStateTyping();
      await message.reply(text);
      await chat.clearState();
      return true;
    }

    // ── Terminal Action: React with Emoji ───────────────────────────
    if (node.react) {
      const emoji = this.resolveValue(node.react, context);
      logger.info(`[ENGINE] 👍 Reacting: ${emoji}`);
      await message.react(emoji);
      return true;
    }

    // ── Service Engine Execution ────────────────────────────────────
    let output = undefined;
    if (node.engine) {
      const engineService = services[node.engine];
      if (!engineService) {
        throw new Error(`[ENGINE] Unknown engine: "${node.engine}"`);
      }

      const workerFn = node.worker
        ? engineService[node.worker]
        : (engineService.execute || engineService.default);

      if (typeof workerFn !== "function") {
        throw new Error(`[ENGINE] Worker "${node.worker}" not found on engine "${node.engine}"`);
      }

      const inputVal = node.input !== undefined ? this.resolveValue(node.input, context) : undefined;
      logger.info(`[ENGINE] Calling ${node.engine}.${node.worker || 'execute'} with:`, inputVal);
      output = await workerFn(inputVal, node, context);

      // If output is an object, merge its keys into context
      if (output && typeof output === "object" && !Array.isArray(output)) {
        Object.assign(context, output);
        logger.info(`[ENGINE] Context:`, JSON.stringify(context));
      }
    }

    // ── Regex Pattern Matching ──────────────────────────────────────
    if (node.match) {
      const inputVal = String(node.input !== undefined ? this.resolveValue(node.input, context) : "");
      const regex = new RegExp(node.match);
      output = regex.test(inputVal);
      logger.info(`[ENGINE] Regex /${node.match}/ tested -> ${output}`);
    }

    // ── Condition Branching ─────────────────────────────────────────
    if (node.condition) {
      // Evaluate input from context, or the output of the engine/match in this step
      let evalValue;
      if (node.input !== undefined && !node.engine && !node.match) {
        evalValue = this.resolveValue(node.input, context);
      } else {
        evalValue = output;
      }

      const key = String(evalValue);
      logger.info(`[ENGINE] Branching on condition key: "${key}"`);
      const nextNode = node.condition[key];

      if (nextNode) {
        return await this.executeNode(nextNode, context, message);
      } else {
        logger.info(`[ENGINE] No branch found for "${key}".`);
      }
    }

    return false;
  }
}

module.exports = new WorkflowEngine();
