import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";

/**
 * OpenAI Codex subscription models for correctness-sensitive work;
 * OpenCode Go models for routine, high-volume tasks.
 * Authenticate both providers through /login before using these routes.
 */
const TIERS = {
  HEAVY: "openai-codex/gpt-6.1-sol",
  VISUAL: "openai-codex/gpt-6.1-terra",
  WORKHORSE: "opencode-go/qwen3.7-plus",
  FAST: "opencode-go/deepseek-v4.1-flash",
  SMART: "opencode-go/glm-5.3-flash",
};

/**
 * Matt Pocock Skill -> Model Mapping Matrix
 *
 * Mapped against every skill in skills-list.md, grouped by the same
 * sections. Tiers reflect the kind of work each skill does:
 *   HEAVY      — correctness-sensitive planning, coding, diagnosis, review
 *   VISUAL     — visual exploration and UI prototypes
 *   SMART      — routine issue judgment and conversational grilling
 *   WORKHORSE  — research, drafting, teaching, and handoffs
 *   FAST       — routing, one-shot setup, and clarification
 *
 * Routes apply to explicit slash input only. Reading a nested skill does
 * not switch models, and subagent model selection is configured separately.
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
 * Use high for correctness and judgment, medium for routine drafting and
 * visual exploration, and low for dispatch. DeepSeek V4.1 Flash does not
 * support off. Reserve higher reasoning efforts for manual escalation.
 */
const SKILL_THINKING: Record<string, ThinkingLevel> = {
  // === HEAVY — correctness-sensitive work ===
  "grill-with-docs": "high",
  "wayfinder": "high",
  "diagnosing-bugs": "high",
  "improve-codebase-architecture": "high",
  "implement": "high",
  "domain-modeling": "high",
  "codebase-design": "high",
  "to-spec": "high",
  "to-tickets": "high",
  "tdd": "high",
  "code-review": "high",
  "resolving-merge-conflicts": "high",

  // === SMART — routine judgment and interviews ===
  "triage": "high",
  "grill-me": "high",
  "grilling": "high",

  // === FAST — dispatch and clarification ===
  "ask-matt": "low",
  "setup-matt-pocock-skills": "low",
  "wait-what": "low",

  // === WORKHORSE — precision at high, routine drafting at medium ===
  "handoff": "high",
  "writing-for-agents": "high",
  "research": "medium",
  "teach": "medium",
  "to-questionnaire": "medium",
  "wizard": "medium",

  // === VISUAL — prototype exploration ===
  "prototype": "medium",
};
const SKILL_ROUTER: Record<string, string> = {
  // === Engineering — user-invoked ===
  // Router/triage over user-invoked skills — cheap dispatch
  "ask-matt": TIERS.FAST,
  // Grilling + domain modeling inline — correctness-sensitive reasoning
  "grill-with-docs": TIERS.HEAVY,
  // Move issues through a triage state machine — issue judgment
  "triage": TIERS.SMART,
  // Scan codebase for deepening opportunities, then grill
  "improve-codebase-architecture": TIERS.HEAVY,
  // One-shot repo config — run once, cheap
  "setup-matt-pocock-skills": TIERS.FAST,
  // Preserve constraints when synthesizing a spec
  "to-spec": TIERS.HEAVY,
  // Plan tracer-bullet tickets and their blocking dependencies
  "to-tickets": TIERS.HEAVY,
  // Orchestrate tdd + code-review; nested skill reads do not reroute
  "implement": TIERS.HEAVY,
  // Plan a huge chunk of work as decision tickets
  "wayfinder": TIERS.HEAVY,

  // === Engineering — model-invoked ===
  // Throwaway prototype to answer a design question — visual exploration
  "prototype": TIERS.VISUAL,
  // Disciplined diagnosis loop for hard bugs
  "diagnosing-bugs": TIERS.HEAVY,
  // Investigate against high-trust primary sources — workhorse synthesis
  "research": TIERS.WORKHORSE,
  // Red-green-refactor interactive loop — behavioral correctness
  "tdd": TIERS.HEAVY,
  // Sharpen the project's domain model
  "domain-modeling": TIERS.HEAVY,
  // Deep-module design vocabulary and boundary decisions
  "codebase-design": TIERS.HEAVY,
  // Two-axis review; subagent models must be configured separately
  "code-review": TIERS.HEAVY,
  // Trace intent through each side of a merge conflict
  "resolving-merge-conflicts": TIERS.HEAVY,
  // Generate an interactive bash wizard — workhorse authoring
  "wizard": TIERS.WORKHORSE,

  // === Productivity — user-invoked ===
  // Relentless interview about a plan/design — smart reasoning
  "grill-me": TIERS.SMART,
  // Preserve constraints and unresolved details in a handoff doc
  "handoff": TIERS.WORKHORSE,
  // Multi-session teaching using the cwd as workspace — workhorse
  "teach": TIERS.WORKHORSE,
  // Turn a decision into a Markdown questionnaire — workhorse authoring
  "to-questionnaire": TIERS.WORKHORSE,
  // Re-pitch a misfired message with missing context — fast retrieval
  "wait-what": TIERS.FAST,

  // === Productivity — model-invoked ===
  // Reusable interview primitive — match grill-me's conversational default
  "grilling": TIERS.SMART,
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
    // (e.g. "deepseek-v4.1-flash"), not the provider-qualified route.
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
