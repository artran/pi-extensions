import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Model Tier Mappings for OpenCode Go
 * Adjust model IDs here if using OpenRouter, Anthropic, etc.
 */
const TIERS = {
  // Heavy Reasoning — GLM 5.2 (Zhipu). ~2x cheaper than Kimi K3 at similar
  // capability: $1.40 in / $4.40 out / $0.26 cache-read per 1M tokens.
  HEAVY: "opencode-go/glm-5.2",

  // Mid-Tier Workhorse (Qwen 3.7 Plus — best cache economics in the catalog:
  // $0.40 in / $0.04 cache-read per 1M tokens, ideal for long interactive loops)
  WORKHORSE: "opencode-go/qwen3.7-plus",

  // Fast / Budget (Thousands of calls per 5h window)
  FAST: "opencode-go/deepseek-v4-flash",
};

/**
 * Matt Pocock Skill -> Model Mapping Matrix
 *
 * Mapped against every skill in skills-list.md, grouped by the same
 * sections. Tiers reflect the kind of work each skill does:
 *   HEAVY      — deep planning, architectural grilling, diagnosis
 *   WORKHORSE  — interactive build/review cycles that reuse a long context
 *   FAST        — routing, triage, one-shot setup, compact handoffs
 */
// Pi thinking levels; clamped per-model by setThinkingLevel.
//   off | minimal | low | medium | high | xhigh | max
type ThinkingLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

/**
 * Per-skill thinking-level overrides.
 *
 * Deliberately scoped to the tiers where the knob actually moves:
 *
 *   - HEAVY (glm-5.2): thinkingLevelMap exposes `high` and `max` only
 *     (off..medium and xhigh are null). Split by depth of reasoning:
 *       `max`  — multi-step planning, diagnosis, grilling-with-docs,
 *                and the reusable grilling primitive
 *       `high` — lighter grilling and the two design disciplines, where
 *                the extra reasoning depth of `max` buys less than for
 *                open-ended exploration/diagnosis
 *
 *   - FAST (deepseek-v4-flash): exposes off / high / max only. Trivial
 *     dispatches go `off` (skip reasoning tokens entirely); the one
 *     compaction skill goes `high` so the handoff summary keeps quality.
 *
 *   - WORKHORSE (qwen3.7-plus): full off..high granularity, and $1.60/M
 *     output makes reasoning tokens non-trivial — the only tier where a
 *     real 2-bucket split pays. Synthesis/authoring at `medium`, precision /
 *     interaction loops at `high`.
 */
const SKILL_THINKING: Record<string, ThinkingLevel> = {
  // === HEAVY — deepest reasoning at `max` ===
  "grill-with-docs": "max",
  "implement": "max",
  "wayfinder": "max",
  "diagnosing-bugs": "max",
  "improve-codebase-architecture": "max",
  "grilling": "max",
  // === HEAVY — lighter grilling / design disciplines at `high` ===
  "grill-me": "high",
  "domain-modeling": "high",
  "codebase-design": "high",

  // === FAST — trivial dispatch turns reasoning off ===
  "ask-matt": "off",
  "triage": "off",
  "setup-matt-pocock-skills": "off",
  "wait-what": "off",
  // === FAST — compaction needs real reasoning ===
  "handoff": "high",

  // === WORKHORSE — precision / interaction at high ===
  "tdd": "high",
  "code-review": "high",
  "resolving-merge-conflicts": "high",
  // === WORKHORSE — synthesis / authoring at medium ===
  "to-spec": "medium",
  "to-tickets": "medium",
  "research": "medium",
  "writing-for-agents": "medium",
  "teach": "medium",
  "to-questionnaire": "medium",
  "prototype": "medium",
  "wizard": "medium",
};
const SKILL_ROUTER: Record<string, string> = {
  // === Engineering — user-invoked ===
  // Router/triage over user-invoked skills — cheap dispatch
  "ask-matt": TIERS.FAST,
  // Grilling + domain modeling inline — heavy reasoning
  "grill-with-docs": TIERS.HEAVY,
  // Move issues through a triage state machine — cheap transitions
  "triage": TIERS.FAST,
  // Scan codebase for deepening opportunities, then grill — heavy
  "improve-codebase-architecture": TIERS.HEAVY,
  // One-shot repo config — run once, cheap
  "setup-matt-pocock-skills": TIERS.FAST,
  // Synthesize a conversation into a spec — workhorse synthesis
  "to-spec": TIERS.WORKHORSE,
  // Break a plan into tracer-bullet tickets with blocking edges — workhorse
  "to-tickets": TIERS.WORKHORSE,
  // Orchestrate tdd + code-review against a spec — heavy coordination
  "implement": TIERS.HEAVY,
  // Plan a huge chunk of work as decision tickets — heavy planning
  "wayfinder": TIERS.HEAVY,

  // === Engineering — model-invoked ===
  // Throwaway prototype to answer a design question — workhorse build
  "prototype": TIERS.WORKHORSE,
  // Disciplined diagnosis loop for hard bugs — heavy reasoning
  "diagnosing-bugs": TIERS.HEAVY,
  // Investigate against high-trust primary sources — workhorse synthesis
  "research": TIERS.WORKHORSE,
  // Red-green-refactor interactive loop — workhorse
  "tdd": TIERS.WORKHORSE,
  // Sharpen the project's domain model — heavy reasoning
  "domain-modeling": TIERS.HEAVY,
  // Deep-module design vocabulary — heavy reasoning
  "codebase-design": TIERS.HEAVY,
  // Two-axis diff review as parallel sub-agents — workhorse
  "code-review": TIERS.WORKHORSE,
  // Trace intent through each side of a merge conflict — workhorse
  "resolving-merge-conflicts": TIERS.WORKHORSE,
  // Generate an interactive bash wizard — workhorse authoring
  "wizard": TIERS.WORKHORSE,

  // === Productivity — user-invoked ===
  // Relentless interview about a plan/design — heavy reasoning
  "grill-me": TIERS.HEAVY,
  // Compact conversation into a handoff doc — cheap summary
  "handoff": TIERS.FAST,
  // Multi-session teaching using the cwd as workspace — workhorse
  "teach": TIERS.WORKHORSE,
  // Turn a decision into a Markdown questionnaire — workhorse authoring
  "to-questionnaire": TIERS.WORKHORSE,
  // Re-pitch a misfired message with missing context — fast retrieval
  "wait-what": TIERS.FAST,

  // === Productivity — model-invoked ===
  // Reusable interview primitive behind grill-me/triage/wayfinder — heavy
  "grilling": TIERS.HEAVY,
  // Authoring skills, AGENTS.md/CLAUDE.md, pointer docs — workhorse
  "writing-for-agents": TIERS.WORKHORSE,
};

export default function (pi: ExtensionAPI) {
  let previousModel: string | null = null;

  // 1. Intercept prompt commands (Slash commands like /grill-me, /tdd, etc.)
  pi.on("message_start", async (event, ctx) => {
    if (event.message.role !== "user") return;

    // content may be a string (typed text) or an array of content blocks
    // (e.g. an image). Slash commands are always plain string input, so any
    // non-string content is never a slash command — bail before touching it.
    const rawContent = event.message.content;
    const text = typeof rawContent === "string" ? rawContent.trim() : "";
    if (!text || !text.startsWith("/")) return;

    // Extract command name (e.g. "/grill-me component.tsx" -> "grill-me")
    const match = text.match(/^\/([a-zA-Z0-9_-]+)/);
    if (!match) return;

    const skillName = match[1].toLowerCase();
    const targetModel = SKILL_ROUTER[skillName];
    const targetThinking = SKILL_THINKING[skillName];

    if (targetModel) {
      const currentModel = ctx.model.id;

      if (currentModel !== targetModel) {
        // Track current model so we could restore it later if desired
        previousModel = currentModel;

        // Switch active model dynamically. Per the pi docs, a model change
        // itself emits thinking_level_select (thinking is clamped to the new
        // model's capabilities), so any setThinkingLevel call MUST come
        // after this await to be the final word.
        await ctx.setModel(targetModel);
      }

      // Apply the per-skill thinking level. Clamped to the model's
      // thinkingLevelMap by pi, so unsupported levels are safe. Run even
      // when the model didn't change so invoking a skill pins its thinking
      // level regardless of what the user set manually.
      if (targetThinking) {
        // setThinkingLevel lives on `pi` (ExtensionAPI), not `ctx`
        // (ExtensionContext only exposes thinkingLevel as a readonly
        // getter). Confirmed by the preset.ts bundled example.
        pi.setThinkingLevel(targetThinking);
      }

      const modelLabel = targetModel.split("/").pop();
      const thinkingLabel = targetThinking ? ` · thinking ${targetThinking}` : "";
      ctx.ui.notify(`Routed /${skillName} → ${modelLabel}${thinkingLabel}`, "info");
    }
  });

  // 2. Register custom command to quickly check or toggle current skill mapping
  // NOTE: registerCommand's signature is (name: string, options) and the
  // callback field is `handler` (not `execute`). Passing a single object as
  // the first argument makes `command.name` a non-string, which crashes the
  // slash-command autocomplete (value.startsWith is not a function) because
  // the autocomplete item's `value` ends up being the whole command object.
  pi.registerCommand("skill-routes", {
    description: "Display the current Matt Pocock skill-to-model routes",
    async handler(_args, ctx) {
      let output = "### Active Skill Model Routes\n\n";
      output += "| Skill | Assigned Model | Thinking |\n|---|---|---|\n";

      for (const [skill, model] of Object.entries(SKILL_ROUTER)) {
        const thinking = SKILL_THINKING[skill] ?? "—";
        output += `| \`/${skill}\` | \`${model}\` | \`${thinking}\` |\n`;
      }

      ctx.ui.notify("Skill routes rendered in chat window", "info");
    },
  });
}
