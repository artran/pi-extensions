import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const STATUS_KEY = "status-hud";
const WIDGET_KEY = "status-hud-widget";
const STATE_ENTRY = "status-hud-state";
const CONTEXT_TOKEN_WARNING_BREAKPOINT = 50_000;
const CONTEXT_TOKEN_ERROR_BREAKPOINT = 75_000;

export default function statusHud(pi: ExtensionAPI) {
	let enabled = true;

	const clearUi = (ctx: ExtensionContext) => {
		ctx.ui.setStatus(STATUS_KEY, undefined);
		ctx.ui.setWidget(WIDGET_KEY, undefined);
	};

	const formatContextTokens = (tokens: number | null) => {
		if (tokens === null) return "ctx ?k";
		return `ctx ${(tokens / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	};

	const getContextStat = (ctx: ExtensionContext) => {
		const tokens = ctx.getContextUsage()?.tokens ?? null;
		const label = formatContextTokens(tokens);

		if (tokens === null) return { label, coloured: ctx.ui.theme.fg("dim", label) };
		if (tokens <= CONTEXT_TOKEN_WARNING_BREAKPOINT) return { label, coloured: ctx.ui.theme.fg("success", label) };
		if (tokens <= CONTEXT_TOKEN_ERROR_BREAKPOINT) return { label, coloured: ctx.ui.theme.fg("warning", label) };
		return { label, coloured: ctx.ui.theme.fg("error", label) };
	};

	const refresh = (ctx: ExtensionContext, announce = false) => {
		if (!enabled) {
			clearUi(ctx);
			return;
		}

		if (!ctx.hasUI) return;

		const contextStat = getContextStat(ctx);
		ctx.ui.setStatus(STATUS_KEY, contextStat.coloured);
		ctx.ui.setWidget(WIDGET_KEY, [contextStat.coloured], { placement: "belowEditor" });

		if (announce) ctx.ui.notify(`Status HUD: ${contextStat.label}`, "info");
	};

	const persistEnabled = () => {
		pi.appendEntry(STATE_ENTRY, { enabled });
	};

	pi.on("session_start", (_event, ctx) => {
		enabled = true;
		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type === "custom" && entry.customType === STATE_ENTRY) {
				const data = entry.data as { enabled?: unknown } | undefined;
				if (typeof data?.enabled === "boolean") enabled = data.enabled;
			}
		}
		refresh(ctx);
	});

	pi.on("tool_execution_end", (_event, ctx) => {
		refresh(ctx);
	});

	pi.on("turn_end", (_event, ctx) => {
		refresh(ctx);
	});

	pi.on("session_shutdown", (_event, ctx) => {
		clearUi(ctx);
	});

	pi.registerCommand("status-hud", {
		description: "Control the status HUD: on|off|toggle|status|refresh",
		handler: async (args, ctx) => {
			const action = (args || "status").trim().toLowerCase();

			switch (action) {
				case "":
				case "status":
					refresh(ctx);
					ctx.ui.notify(`Status HUD: ${enabled ? "on" : "off"}`, "info");
					return;
				case "refresh":
					refresh(ctx, true);
					return;
				case "on":
					enabled = true;
					persistEnabled();
					refresh(ctx, true);
					return;
				case "off":
					enabled = false;
					persistEnabled();
					clearUi(ctx);
					ctx.ui.notify("Status HUD: off", "info");
					return;
				case "toggle":
					enabled = !enabled;
					persistEnabled();
					if (enabled) {
						refresh(ctx, true);
					} else {
						clearUi(ctx);
						ctx.ui.notify("Status HUD: off", "info");
					}
					return;
				default:
					ctx.ui.notify("Usage: /status-hud [on|off|toggle|status|refresh]", "warning");
			}
		},
	});
}
