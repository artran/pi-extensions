import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Model Tier Mappings for OpenCode Go
 * Adjust model IDs here if using OpenRouter, Anthropic, etc.
 */
const TIERS = {
  // Heavy Reasoning ($12 limit burns faster)
  HEAVY: "opencode-go/kimi-k3",

  // Mid-Tier Workhorse (High quality, great context caching)
  WORKHORSE: "opencode-go/kimi-k2.7-code",

  // Fast / Budget (Thousands of calls per 5h window)
  FAST: "opencode-go/deepseek-v4-flash",
};

/**
 * Matt Pocock Skill -> Model Mapping Matrix
 *
 * Mapped against every skill in skills-list.md, grouped by the same
 * sections. Tiers reflect the kind of work each skill does:
 *   HEAVY      — deep planning, architectural grilling, diagnosis
 *   WORKHORSE  — interactive build/review cycles, synthesis, authoring
 *   FAST        — routing, triage, one-shot setup, compact handoffs
 */
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

    const text = event.message.content?.trim();
    if (!text || !text.startsWith("/")) return;

    // Extract command name (e.g. "/grill-me component.tsx" -> "grill-me")
    const match = text.match(/^\/([a-zA-Z0-9_-]+)/);
    if (!match) return;

    const skillName = match[1].toLowerCase();
    const targetModel = SKILL_ROUTER[skillName];

    if (targetModel) {
      const currentModel = ctx.model.id;

      if (currentModel !== targetModel) {
        // Track current model so we could restore it later if desired
        previousModel = currentModel;

        // Switch active model dynamically
        await ctx.setModel(targetModel);

        ctx.ui.notify(
          `Routed /${skillName} → ${targetModel.split("/").pop()}`,
          "info"
        );
      }
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
      output += "| Skill | Assigned Model |\n|---|---|\n";

      for (const [skill, model] of Object.entries(SKILL_ROUTER)) {
        output += `| \`/${skill}\` | \`${model}\` |\n`;
      }

      ctx.ui.notify("Skill routes rendered in chat window", "info");
    },
  });
}
