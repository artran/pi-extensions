import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

type GitHudState = {
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

const STATUS_KEY = "git-status-hud";
const WIDGET_KEY = "git-status-hud-widget";
const STATE_ENTRY = "git-status-hud-state";

export default function gitStatusHud(pi: ExtensionAPI) {
	let enabled = true;
	let lastState: GitHudState | null = null;

	const clearUi = (ctx: ExtensionContext) => {
		ctx.ui.setStatus(STATUS_KEY, undefined);
		ctx.ui.setWidget(WIDGET_KEY, undefined);
	};

	const render = (ctx: ExtensionContext, state: GitHudState | null) => {
		if (!ctx.hasUI) return;
		if (!enabled) {
			clearUi(ctx);
			return;
		}

		const theme = ctx.ui.theme;
		if (!state || !state.inRepo) {
			ctx.ui.setStatus(STATUS_KEY, theme.fg("dim", "git: no repo"));
			ctx.ui.setWidget(WIDGET_KEY, [theme.fg("dim", "git: no repo")], { placement: "belowEditor" });
			return;
		}

		const branchName = state.branch ?? "detached";
		const branchLabel = ` ${branchName}`;
		const branch = theme.fg("accent", branchLabel);
		const health = state.clean ? theme.fg("success", "clean") : theme.fg("warning", "dirty");
		const sync = [state.ahead > 0 ? `ahead:${state.ahead}` : null, state.behind > 0 ? `behind:${state.behind}` : null].filter(Boolean);
		const counts = [`staged:${state.staged}`, `unstaged:${state.unstaged}`, `untracked:${state.untracked}`];
		const details = [...sync, ...(!state.clean ? counts : [])];

		const footer = details.length === 0
			? `git ${branch} ${health}`
			: `git ${branch} ${health} ${theme.fg("dim", details.join(" "))}`;
		const widget = [
			[
				`branch: ${branchLabel}`,
				state.clean ? "clean" : `unstaged: ${state.unstaged}`,
				...(state.clean ? [] : [`staged: ${state.staged}`, `untracked: ${state.untracked}`]),
				...(state.ahead > 0 ? [`ahead: ${state.ahead}`] : []),
				...(state.behind > 0 ? [`behind: ${state.behind}`] : []),
			].join(" | "),
		];

		ctx.ui.setStatus(STATUS_KEY, footer);
		ctx.ui.setWidget(WIDGET_KEY, widget, { placement: "belowEditor" });
	};

	const parseStatus = (stdout: string): GitHudState => {
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
			`branch: ${branchLabel}`,
			clean ? "clean" : `unstaged: ${unstaged}`,
			...(clean ? [] : [`staged: ${staged}`, `untracked: ${untracked}`]),
			...(ahead > 0 ? [`ahead: ${ahead}`] : []),
			...(behind > 0 ? [`behind: ${behind}`] : []),
		];
		const summary = summaryParts.join(" | ");

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
		if (announce) ctx.ui.notify(`Git HUD: ${lastState.summary}`, "info");
	};

	const persistEnabled = () => {
		pi.appendEntry(STATE_ENTRY, { enabled });
	};

	pi.on("session_start", async (_event, ctx) => {
		enabled = true;
		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type === "custom" && entry.customType === STATE_ENTRY && typeof entry.data?.enabled === "boolean") {
				enabled = entry.data.enabled;
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

	pi.registerCommand("git-hud", {
		description: "Control the Git status HUD: on|off|toggle|status|refresh",
		handler: async (args, ctx) => {
			const action = (args || "status").trim().toLowerCase();

			switch (action) {
				case "":
				case "status":
					await refresh(ctx);
					ctx.ui.notify(`Git HUD: ${enabled ? "on" : "off"}${lastState ? ` — ${lastState.summary}` : ""}`, "info");
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
					ctx.ui.notify("Git HUD: off", "info");
					return;
				case "toggle":
					enabled = !enabled;
					persistEnabled();
					if (enabled) {
						await refresh(ctx, true);
					} else {
						clearUi(ctx);
						ctx.ui.notify("Git HUD: off", "info");
					}
					return;
				default:
					ctx.ui.notify("Usage: /git-hud [on|off|toggle|status|refresh]", "warning");
			}
		},
	});
}
