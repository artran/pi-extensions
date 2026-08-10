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
 */
const SKILL_ROUTER: Record<string, string> = {
  // --- HEAVY REASONING (Kimi K3) ---
  // Planning, architectural grilling, domain design
  "grill-me": TIERS.HEAVY,
  "grill-with-docs": TIERS.HEAVY,
  "domain-modeling": TIERS.HEAVY,
  "codebase-design": TIERS.HEAVY,
  "system-architecture": TIERS.HEAVY,
  "debug-deep": TIERS.HEAVY,

  // --- WORKHORSE (Kimi K2.7 Code / Qwen 3.7 Plus) ---
  // Interactive TDD cycles, refactoring, feature implementation
  "tdd": TIERS.WORKHORSE,
  "red-green-refactor": TIERS.WORKHORSE,
  "implement-feature": TIERS.WORKHORSE,
  "write-tests": TIERS.WORKHORSE,
  "refactor": TIERS.WORKHORSE,
  "code-review": TIERS.WORKHORSE,

  // --- FAST / LOW COST (DeepSeek V4 Flash) ---
  // Triage, git management, handoffs, micro-edits
  "triage": TIERS.FAST,
  "handoff": TIERS.FAST,
  "git-commit": TIERS.FAST,
  "generate-docs": TIERS.FAST,
  "explain-code": TIERS.FAST,
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
  pi.registerCommand({
    name: "skill-routes",
    description: "Display the current Matt Pocock skill-to-model routes",
    async execute(_args, ctx) {
      let output = "### Active Skill Model Routes\n\n";
      output += "| Skill | Assigned Model |\n|---|---|\n";

      for (const [skill, model] of Object.entries(SKILL_ROUTER)) {
        output += `| \`/${skill}\` | \`${model}\` |\n`;
      }

      ctx.ui.notify("Skill routes rendered in chat window", "info");
      return output;
    },
  });
}
