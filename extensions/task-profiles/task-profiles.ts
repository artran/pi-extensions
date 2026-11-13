import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface TaskProfile {
  name: string;
  description: string;
  provider: string;
  model: string;
  thinking: "medium" | "high";
}

// Model selection only: workflows remain the responsibility of skills and
// repository instructions. These choices persist until another explicit change.
const PROFILES: TaskProfile[] = [
  {
    name: "rust",
    description: "Writing Rust code",
    provider: "openai-codex",
    model: "gpt-6.1-sol",
    thinking: "high",
  },
  {
    name: "research",
    description: "Researching technical questions with web and documentation",
    provider: "opencode-go",
    model: "qwen3.7-plus",
    thinking: "medium",
  },
  {
    name: "docs",
    description: "Writing technical documentation",
    provider: "openai-codex",
    model: "gpt-6.1-terra",
    thinking: "medium",
  },
];

const USAGE = "Usage: /task <rust|research|docs> [request]";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("task", {
    description: "Select a task's model and thinking level, optionally starting a request",
    getArgumentCompletions(prefix) {
      // Complete the profile name only, not the optional request text.
      if (/\s/.test(prefix)) return null;
      const matches = PROFILES.filter((profile) =>
        profile.name.startsWith(prefix.toLowerCase())
      ).map((profile) => ({
        value: profile.name,
        label: profile.name,
        description: profile.description,
      }));
      return matches.length > 0 ? matches : null;
    },
    handler: async (args, ctx) => {
      // Do not change the model underneath an in-flight request.
      if (!ctx.isIdle()) {
        ctx.ui.notify("Wait for the current task to finish before using /task.", "warning");
        return;
      }

      const input = args.trim();
      const name = input.match(/^\S+/)?.[0].toLowerCase();
      const request = input.slice(name?.length ?? 0).trim();
      let profile = PROFILES.find((candidate) => candidate.name === name);

      if (!input) {
        if (!ctx.hasUI) {
          ctx.ui.notify(USAGE, "warning");
          return;
        }
        const choices = PROFILES.map((candidate) =>
          `${candidate.name} — ${candidate.description} (${candidate.provider}/${candidate.model} · ${candidate.thinking})`
        );
        const selected = await ctx.ui.select("Select task profile", choices);
        if (selected === undefined) return;
        profile = PROFILES.find((_candidate, index) => choices[index] === selected);
      }

      if (!profile) {
        ctx.ui.notify(USAGE, "error");
        return;
      }
      // A dialog can remain open while other work starts (for example via RPC).
      if (!ctx.isIdle()) {
        ctx.ui.notify("Wait for the current task to finish before using /task.", "warning");
        return;
      }

      const key = `${profile.provider}/${profile.model}`;
      const model = ctx.modelRegistry.find(profile.provider, profile.model);
      if (!model) {
        ctx.ui.notify(`Task ${profile.name}: unknown model ${key}. Check the Pi model catalog.`, "error");
        return;
      }

      const current = ctx.model;
      if (!current || `${current.provider}/${current.id}` !== key) {
        try {
          if (!(await pi.setModel(model))) {
            ctx.ui.notify(`Task ${profile.name}: sign in to ${profile.provider} with /login first.`, "error");
            return;
          }
        } catch (error) {
          ctx.ui.notify(`Task ${profile.name}: could not select ${key}: ${String(error)}`, "error");
          return;
        }
      }

      // Model changes clamp thinking, so pin it after the switch, even when
      // selecting the same model again. Report the effective clamped level.
      pi.setThinkingLevel(profile.thinking);
      ctx.ui.notify(`Task ${profile.name} → ${key} · thinking ${pi.getThinkingLevel()}`, "info");

      if (request) {
        // No slash expansion: the request is literal user text, not another
        // command. The skill router also ignores extension-injected input.
        pi.sendUserMessage(request);
      }
    },
  });
}
