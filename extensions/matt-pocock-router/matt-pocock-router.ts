import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";

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

/**
 * Extract a skill name from slash input, supporting both invocation forms:
 *   - bare:         "/grill-me component.tsx"    -> "grill-me"
 *   - pi skill:     "/skill:grill-me args"       -> "grill-me"
 * Returns null when the input is not a slash command.
 */
function parseSkillCommand(text: string): string | null {
  const trimmed = text.trim();
  const skillMatch = trimmed.match(/^\/skill:([a-zA-Z0-9_-]+)/);
  if (skillMatch) return skillMatch[1].toLowerCase();
  const bareMatch = trimmed.match(/^\/([a-zA-Z0-9_-]+)/);
  if (bareMatch) return bareMatch[1].toLowerCase();
  return null;
}

/**
 * Resolve a "provider/modelId" string (as stored in TIERS/SKILL_ROUTER)
 * to the registry's Model object. pi.setModel() takes a Model, not a
 * string, so this lookup is required.
 */
function resolveModel(ctx: ExtensionContext, id: string) {
  const slash = id.indexOf("/");
  if (slash === -1) return undefined;
  return ctx.modelRegistry.find(id.slice(0, slash), id.slice(slash + 1));
}

export default function (pi: ExtensionAPI) {
  // 1. Route skills to their tier model + thinking level.
  //    Hooks the `input` event, which fires AFTER extension commands are
  //    checked but BEFORE pi expands `/skill:...` into skill content. That
  //    means we see the raw command whether the user typed the bare form
  //    ("/grill-me") or the pi skill form ("/skill:grill-me"). Returning
  //    { action: "continue" } lets the message flow to the LLM unchanged.
  pi.on("input", async (event, ctx) => {
    // Extension-injected messages (pi.sendUserMessage) are not user skill
    // selections — leave them alone.
    if (event.source === "extension") return { action: "continue" };

    const skillName = parseSkillCommand(event.text);
    if (!skillName) return { action: "continue" };

    const targetModel = SKILL_ROUTER[skillName];
    const targetThinking = SKILL_THINKING[skillName];
    if (!targetModel) return { action: "continue" };

    const model = resolveModel(ctx, targetModel);
    if (!model) {
      ctx.ui.notify(
        `Routed /${skillName} → ${targetModel}: unknown model (check TIERS)`,
        "error"
      );
      return { action: "continue" };
    }

    // Compare by "provider/modelId": ctx.model.id is only the bare model id
    // (e.g. "deepseek-v4-flash"), so the naive string compare never matched.
    const current = ctx.model;
    const currentKey = current ? `${current.provider}/${current.id}` : null;

    if (currentKey !== targetModel) {
      // Per the pi docs, a model change itself emits thinking_level_select
      // (thinking is clamped to the new model's capabilities), so any
      // setThinkingLevel call MUST come after this await to be the final
      // word. Returns false when no API key is configured for the model.
      const switched = await pi.setModel(model);
      if (!switched) {
        ctx.ui.notify(
          `Routed /${skillName} → ${targetModel}: no API key available`,
          "error"
        );
        return { action: "continue" };
      }
    }

    // Apply the per-skill thinking level. Clamped to the model's
    // thinkingLevelMap by pi, so unsupported levels are safe. Run even
    // when the model didn't change so invoking a skill pins its thinking
    // level regardless of what the user set manually.
    if (targetThinking) {
      pi.setThinkingLevel(targetThinking);
    }

    const modelLabel = model.id;
    const thinkingLabel = targetThinking ? ` · thinking ${targetThinking}` : "";
    ctx.ui.notify(`Routed /${skillName} → ${modelLabel}${thinkingLabel}`, "info");

    return { action: "continue" };
  });

  // 2. Render the /skill-routes table as a custom message in the transcript.
  pi.registerMessageRenderer("skill-routes", (message, { outputPad }, theme) => {
    const text = String(message.content);
    const box = new Box(outputPad, 1, (t) => theme.bg("customMessageBg", t));
    box.addChild(new Text(text, 0, 0));
    return box;
  });

  // 3. Command to display the current skill-to-model mapping.
  //    registerCommand's signature is (name: string, options) and the
  //    callback field is `handler` (not `execute`). Passing a single object
  //    as the first argument makes `command.name` a non-string, which
  //    crashes the slash-command autocomplete (value.startsWith is not a
  //    function) — see the git history for the original bug.
  pi.registerCommand("skill-routes", {
    description: "Display the current Matt Pocock skill-to-model routes",
    handler: async (_args, _ctx) => {
      let output = "### Active Skill Model Routes\n\n";
      output += "| Skill | Assigned Model | Thinking |\n|---|---|---|\n";

      for (const [skill, model] of Object.entries(SKILL_ROUTER)) {
        const thinking = SKILL_THINKING[skill] ?? "—";
        output += `| \`/${skill}\` | \`${model}\` | \`${thinking}\` |\n`;
      }

      pi.sendMessage({
        customType: "skill-routes",
        content: output,
        display: true,
      });
    },
  });
}
