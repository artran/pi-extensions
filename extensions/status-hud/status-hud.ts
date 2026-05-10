import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

type StatusHudState = {
	branch: string | null;
	ahead: number;
	behind: number;
	staged: number;
	unstaged: number;
	untracked: number;
	clean: boolean;
	inRepo: boolean;
	summary: string;
};

const STATUS_KEY = "status-hud";
const WIDGET_KEY = "status-hud-widget";
const STATE_ENTRY = "status-hud-state";
const LEGACY_STATE_ENTRY = "git-status-hud-state";

export default function statusHud(pi: ExtensionAPI) {
	let enabled = true;
	let lastState: StatusHudState | null = null;

	const clearUi = (ctx: ExtensionContext) => {
		ctx.ui.setStatus(STATUS_KEY, undefined);
		ctx.ui.setWidget(WIDGET_KEY, undefined);
	};

	const isString = (value: string | null): value is string => value !== null;

	const formatContextTokens = (tokens: number | null) => {
		if (tokens === null) return "ctx ?k";
		return `ctx ${(tokens / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	};

	const colourContextStat = (ctx: ExtensionContext) => {
		const usage = ctx.getContextUsage();
		const tokens = usage?.tokens ?? null;
		const label = formatContextTokens(tokens);
		if (tokens === null) return ctx.ui.theme.fg("dim", label);
		if (tokens <= 50_000) return ctx.ui.theme.fg("success", label);
		if (tokens <= 75_000) return ctx.ui.theme.fg("warning", label);
		return ctx.ui.theme.fg("error", label);
	};

	const render = (ctx: ExtensionContext, state: StatusHudState | null) => {
		if (!ctx.hasUI) return;
		if (!enabled) {
			clearUi(ctx);
			return;
		}

		const theme = ctx.ui.theme;
		const contextStat = colourContextStat(ctx);
		if (!state || !state.inRepo) {
			const noRepo = theme.fg("dim", "git: no repo") + ` ${contextStat}`;
			ctx.ui.setStatus(STATUS_KEY, noRepo);
			ctx.ui.setWidget(WIDGET_KEY, [noRepo], { placement: "belowEditor" });
			return;
		}

		const branchName = state.branch ?? "detached";
		const branchLabel = ` ${branchName}`;
		const branch = theme.fg("accent", branchLabel);
		const health = state.clean ? theme.fg("success", "✓") : theme.fg("warning", "*");
		const sync = [state.ahead > 0 ? `⇡${state.ahead}` : null, state.behind > 0 ? `⇣${state.behind}` : null].filter(isString);
		const changes = [state.staged > 0 ? `+${state.staged}` : null, state.unstaged > 0 ? `!${state.unstaged}` : null, state.untracked > 0 ? `?${state.untracked}` : null].filter(isString);
		const gitStats = [...sync, ...changes].map((stat) => theme.fg("dim", stat));
		const stats = [...gitStats, contextStat];

		const footer = `git ${branch} ${health}${stats.length > 0 ? ` ${stats.join(" ")}` : ""}`;
		const widget = [[branchLabel, ...(state.clean ? ["✓"] : changes), ...sync, contextStat].join(" ")];

		ctx.ui.setStatus(STATUS_KEY, footer);
		ctx.ui.setWidget(WIDGET_KEY, widget, { placement: "belowEditor" });
	};

	const parseStatus = (stdout: string): StatusHudState => {
		const lines = stdout
			.split(/\r?\n/)
			.map((line) => line.trimEnd())
			.filter(Boolean);

		let branch: string | null = null;
		let ahead = 0;
		let behind = 0;
		let staged = 0;
		let unstaged = 0;
		let untracked = 0;

		for (const line of lines) {
			if (line.startsWith("## ")) {
				const header = line.slice(3);
				const head = header.split("...")[0]?.trim() ?? "";
				branch = head === "HEAD (no branch)" ? "detached" : head || null;

				const tracking = header.match(/\[(.*)\]$/)?.[1] ?? "";
				const aheadMatch = tracking.match(/ahead (\d+)/);
				const behindMatch = tracking.match(/behind (\d+)/);
				ahead = aheadMatch ? Number(aheadMatch[1]) : 0;
				behind = behindMatch ? Number(behindMatch[1]) : 0;
				continue;
			}

			if (line.startsWith("??")) {
				untracked++;
				continue;
			}

			const x = line[0] ?? " ";
			const y = line[1] ?? " ";
			if (x !== " ") staged++;
			if (y !== " ") unstaged++;
		}

		const branchLabel = ` ${branch ?? "detached"}`;
		const clean = staged === 0 && unstaged === 0 && untracked === 0;
		const summaryParts = [
			branchLabel,
			...(clean ? ["✓"] : []),
			...(staged > 0 ? [`+${staged}`] : []),
			...(unstaged > 0 ? [`!${unstaged}`] : []),
			...(untracked > 0 ? [`?${untracked}`] : []),
			...(ahead > 0 ? [`⇡${ahead}`] : []),
			...(behind > 0 ? [`⇣${behind}`] : []),
		];
		const summary = summaryParts.join(" ");

		return {
			branch,
			ahead,
			behind,
			staged,
			unstaged,
			untracked,
			clean,
			inRepo: true,
			summary,
		};
	};

	const refresh = async (ctx: ExtensionContext, announce = false) => {
		if (!enabled) {
			clearUi(ctx);
			return;
		}

		const result = await pi.exec("git", ["status", "--porcelain=1", "--branch"], {
			signal: ctx.signal,
			timeout: 5000,
		});

		lastState =
			result.code === 0
				? parseStatus(result.stdout)
				: {
					branch: null,
					ahead: 0,
					behind: 0,
					staged: 0,
					unstaged: 0,
					untracked: 0,
					clean: true,
					inRepo: false,
					summary: "git: no repo",
				};

		render(ctx, lastState);
		if (announce) ctx.ui.notify(`Status HUD: ${lastState.summary}`, "info");
	};

	const persistEnabled = () => {
		pi.appendEntry(STATE_ENTRY, { enabled });
	};

	pi.on("session_start", async (_event, ctx) => {
		enabled = true;
		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type === "custom" && (entry.customType === STATE_ENTRY || entry.customType === LEGACY_STATE_ENTRY)) {
				const data = entry.data as { enabled?: unknown } | undefined;
				if (typeof data?.enabled === "boolean") enabled = data.enabled;
			}
		}
		await refresh(ctx);
	});

	pi.on("tool_execution_end", async (_event, ctx) => {
		await refresh(ctx);
	});

	pi.on("turn_end", async (_event, ctx) => {
		await refresh(ctx);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		clearUi(ctx);
	});

	pi.registerCommand("status-hud", {
		description: "Control the status HUD: on|off|toggle|status|refresh",
		handler: async (args, ctx) => {
			const action = (args || "status").trim().toLowerCase();

			switch (action) {
				case "":
				case "status":
					await refresh(ctx);
					ctx.ui.notify(`Status HUD: ${enabled ? "on" : "off"}${lastState ? ` — ${lastState.summary}` : ""}`, "info");
					return;
				case "refresh":
					await refresh(ctx, true);
					return;
				case "on":
					enabled = true;
					persistEnabled();
					await refresh(ctx, true);
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
						await refresh(ctx, true);
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
