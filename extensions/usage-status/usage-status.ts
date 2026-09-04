/**
 * Usage Status Extension
 *
 * Adds live usage/limit info to the pi footer, read directly from each
 * logged-in provider's API:
 *
 *   - opencode-go  → GET https://opencode.ai/zen/go/v1/usage
 *                    (rolling / weekly / monthly percent + reset times)
 *   - openai-codex → GET https://chatgpt.com/backend-api/wham/usage
 *                    (5h rolling window + weekly window + spend control)
 *
 * Replaces the built-in footer with a single line containing cwd + git
 * branch, token/cost/context stats, the session timer, and each provider's
 * per-window usage as "% left" with reset countdowns. It only wraps onto a
 * second line when the terminal is too narrow.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ZEN_USAGE_URL = "https://opencode.ai/zen/go/v1/usage";
const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const CODEX_TOKEN_URL = "https://auth.openai.com/oauth/token";
const FETCH_TIMEOUT_MS = 10_000;
const REFETCH_MS = 60_000;
const TICK_MS = 15_000;

interface Window {
  key: string;
  label: string;
  percent: number;
  rateLimited: boolean;
  resetsAt: number;
}

interface ProviderInfo {
  windows: Window[];
  error?: string;
}

// Module-level state shared between the fetch loop and the footer renderer.
let cache = new Map<string, ProviderInfo>();
let providers: string[] = [];

function formatDuration(ms: number): string {
  if (!isFinite(ms) || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatTokens(n: number): string {
  if (!isFinite(n) || n <= 0) return "0";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

function percentLeft(w: Window): number {
  return Math.max(0, Math.min(100, 100 - w.percent));
}

function leftColor(left: number): "success" | "warning" | "error" {
  if (left <= 10) return "error";
  if (left <= 30) return "warning";
  return "success";
}

function windowLabel(w: Window): string {
  if (w.key === "rolling") return "5h";
  if (w.key === "weekly") return "week";
  if (w.key === "monthly") return "month";
  return w.label;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchZen(key: string): Promise<Window[]> {
  const res = await fetchWithTimeout(
    ZEN_USAGE_URL,
    { headers: { Authorization: `Bearer ${key}` } },
    FETCH_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`zen usage ${res.status}`);
  const json = (await res.json()) as any;
  const u = json?.usage ?? {};
  const out: Window[] = [];
  for (const [key, label] of [
    ["rolling", "rolling"],
    ["weekly", "wk"],
    ["monthly", "mo"],
  ] as const) {
    const v = u[key];
    if (!v || typeof v !== "object") continue;
    out.push({
      key,
      label,
      percent: typeof v.percent === "number" ? v.percent : 0,
      rateLimited: v.status === "rate-limited",
      resetsAt: Date.parse(v.resetsAt ?? "") || 0,
    });
  }
  return out;
}

async function refreshCodexToken(refresh: string): Promise<{ access: string; refresh: string; expires: number }> {
  const res = await fetchWithTimeout(
    CODEX_TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refresh,
        client_id: CODEX_CLIENT_ID,
      }),
    },
    FETCH_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`codex token refresh ${res.status}`);
  const j = (await res.json()) as any;
  if (!j?.access_token || !j?.refresh_token || typeof j?.expires_in !== "number") {
    throw new Error("codex token refresh: missing fields");
  }
  return { access: j.access_token, refresh: j.refresh_token, expires: Date.now() + j.expires_in * 1000 };
}

async function persistCodexToken(
  authPath: string,
  oldRefresh: string,
  fresh: { access: string; refresh: string; expires: number },
): Promise<void> {
  try {
    const auth = JSON.parse(await readFile(authPath, "utf8"));
    const entry = auth?.["openai-codex"];
    // Only write back if the on-disk refresh token still matches the one we
    // refreshed from (avoids clobbering a concurrent refresh by pi itself).
    if (!entry || entry.refresh !== oldRefresh) return;
    entry.access = fresh.access;
    entry.refresh = fresh.refresh;
    entry.expires = fresh.expires;
    await writeFile(authPath, JSON.stringify(auth, null, 2));
  } catch {
    /* best-effort persistence */
  }
}

function parseCodex(json: any): Window[] {
  const out: Window[] = [];
  const rl = json?.rate_limit;
  const primary = rl?.primary_window;
  if (primary) {
    const hours = Math.max(1, Math.round((primary.limit_window_seconds ?? 0) / 3600));
    const resetsAt = primary.reset_at
      ? primary.reset_at * 1000
      : primary.reset_after_seconds
        ? Date.now() + primary.reset_after_seconds * 1000
        : 0;
    out.push({
      key: "rolling",
      label: `${hours}h`,
      percent: primary.used_percent ?? 0,
      rateLimited: !!rl.limit_reached,
      resetsAt,
    });
  }
  const secondary = rl?.secondary_window;
  if (secondary) {
    const resetsAt = secondary.reset_at
      ? secondary.reset_at * 1000
      : secondary.reset_after_seconds
        ? Date.now() + secondary.reset_after_seconds * 1000
        : 0;
    out.push({
      key: "weekly",
      label: "wk",
      percent: secondary.used_percent ?? 0,
      rateLimited: false,
      resetsAt,
    });
  }
  // Monthly spend control is separate (no percent/reset exposed); surface it
  // only as a reached/not-reached marker when a limit is configured.
  const sc = json?.spend_control;
  if (sc?.individual_limit != null) {
    out.push({
      key: "monthly",
      label: "mo",
      percent: sc.reached ? 100 : 0,
      rateLimited: !!sc.reached,
      resetsAt: 0,
    });
  }
  return out;
}

async function fetchCodex(agentDir: string): Promise<Window[]> {
  const authPath = join(agentDir, "auth.json");
  const auth = JSON.parse(await readFile(authPath, "utf8"));
  const cred = auth?.["openai-codex"];
  if (!cred || cred.type !== "oauth") throw new Error("openai-codex not logged in");

  let token = cred.access;
  let refreshed: { access: string; refresh: string; expires: number } | null = null;

  if (!cred.expires || Date.now() > cred.expires - 60_000) {
    refreshed = await refreshCodexToken(cred.refresh);
    token = refreshed.access;
  }

  const makeHeaders = (tk: string) => {
    const h: Record<string, string> = { Authorization: `Bearer ${tk}` };
    if (cred.accountId) h["chatgpt-account-id"] = cred.accountId;
    return h;
  };

  let res = await fetchWithTimeout(CODEX_USAGE_URL, { headers: makeHeaders(token) }, FETCH_TIMEOUT_MS);

  if (res.status === 401 && !refreshed) {
    refreshed = await refreshCodexToken(cred.refresh);
    token = refreshed.access;
    res = await fetchWithTimeout(CODEX_USAGE_URL, { headers: makeHeaders(token) }, FETCH_TIMEOUT_MS);
  }

  if (!res.ok) throw new Error(`codex usage ${res.status}`);

  if (refreshed) await persistCodexToken(authPath, cred.refresh, refreshed);
  return parseCodex(await res.json());
}

function sessionElapsedMs(ctx: any): number {
  try {
    const header = ctx.sessionManager?.getHeader?.();
    const start = header?.timestamp ? Date.parse(header.timestamp) : 0;
    return start ? Math.max(0, Date.now() - start) : 0;
  } catch {
    return 0;
  }
}

function usageTotals(ctx: any): { input: number; output: number; cost: number } {
  let input = 0;
  let output = 0;
  let cost = 0;
  try {
    const entries = ctx.sessionManager?.getEntries?.() ?? [];
    for (const e of entries) {
      let u: any;
      if (e?.type === "message") {
        const m = e.message;
        if (m?.role !== "assistant" && m?.role !== "toolResult") continue;
        u = m.usage;
      } else if (e?.type === "branch_summary" || e?.type === "compaction") {
        u = e.usage;
      }
      if (!u) continue;
      input += u.input ?? 0;
      output += u.output ?? 0;
      cost += u.cost?.total ?? 0;
    }
  } catch {
    /* ignore */
  }
  return { input, output, cost };
}

/** Build the main footer segments (cwd, stats, model, timer). */
function buildMainSegments(ctx: any, theme: any, footerData: any): string[] {
  const segs: string[] = [];

  // cwd + git branch + session name
  let pwd = ctx.sessionManager?.getCwd?.() ?? "";
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home && pwd.startsWith(home)) {
    pwd = "~" + pwd.slice(home.length);
  }
  const branch = footerData?.getGitBranch?.();
  if (branch) pwd += ` (${branch})`;
  const name = ctx.sessionManager?.getSessionName?.();
  if (name) pwd += ` • ${name}`;
  if (pwd) segs.push(theme.fg("accent", pwd));

  // token / cost totals
  const t = usageTotals(ctx);
  const statsParts: string[] = [];
  if (t.input) statsParts.push(`↑${formatTokens(t.input)}`);
  if (t.output) statsParts.push(`↓${formatTokens(t.output)}`);
  if (t.cost) statsParts.push(`$${t.cost.toFixed(3)}`);
  if (statsParts.length) segs.push(theme.fg("dim", statsParts.join(" ")));

  // context usage
  const cu = ctx.getContextUsage?.();
  const model = ctx.model;
  const window = cu?.contextWindow ?? model?.contextWindow ?? 0;
  const tokens = cu?.tokens ?? 0;
  const tokenStr = cu?.tokens != null ? formatTokens(tokens) : "?";
  if (window || tokenStr !== "?") {
    const ctxStr = window ? `${tokenStr}/${formatTokens(window)}` : tokenStr;
    const color = tokens > 130_000 ? "error" : tokens >= 120_000 ? "warning" : "success";
    segs.push(theme.fg(color, ctxStr));
  }

  // model
  if (model) {
    let m = model.id;
    if (model.reasoning) {
      const tl = ctx.thinkingLevel || "off";
      m = tl === "off" ? `${m} • thinking off` : `${m} • ${tl}`;
    }
    segs.push(theme.fg("dim", m));
  }

  // session timer
  segs.push(theme.fg("dim", `⏱ ${formatDuration(sessionElapsedMs(ctx))}`));

  return segs;
}

/** Build the per-provider usage segments. */
function buildUsageSegments(ctx: any, theme: any): string[] {
  const segs: string[] = [];

  for (const id of providers) {
    const info = cache.get(id);
    if (!info) continue;
    if (info.error) {
      segs.push(theme.fg("accent", id));
      segs.push(theme.fg("dim", "n/a"));
      continue;
    }
    if (info.windows.length === 0) {
      segs.push(theme.fg("accent", id));
      segs.push(theme.fg("dim", "no usage data"));
      continue;
    }
    const windows = info.windows.map((w) => {
      const label = windowLabel(w);
      const left = percentLeft(w);
      const value = `${left}%`;
      let s = theme.fg(leftColor(left), `${label} ${value}`);
      if (w.resetsAt) s += theme.fg("dim", ` (${formatDuration(w.resetsAt - Date.now())})`);
      return s;
    });
    segs.push(theme.fg("accent", id) + theme.fg("dim", ": ") + windows[0]);
    for (let i = 1; i < windows.length; i++) segs.push(windows[i]);
  }

  return segs;
}

/** Pack segments into lines, wrapping only when the terminal is too narrow. */
function packSegments(segs: string[], width: number): string[] {
  const lines: string[] = [];
  const sep = " · ";
  let cur = "";
  for (const seg of segs) {
    const candidate = cur ? cur + sep + seg : seg;
    if (!cur || visibleWidth(candidate) <= width) {
      cur = candidate;
    } else {
      lines.push(truncateToWidth(cur, width));
      cur = seg;
    }
  }
  if (cur) lines.push(truncateToWidth(cur, width));
  return lines.length ? lines : [];
}

export default function (pi: ExtensionAPI) {
  const agentDir = getAgentDir();
  let lastFetch = 0;
  let fetching = false;
  let footerCtx: any = null;
  let requestRender: (() => void) | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function fetchAll(): Promise<void> {
    if (fetching) return;
    fetching = true;
    try {
      const authPath = join(agentDir, "auth.json");
      const auth = JSON.parse(await readFile(authPath, "utf8"));
      providers = Object.keys(auth ?? {});
      const next = new Map<string, ProviderInfo>();

      await Promise.all(
        providers.map(async (id) => {
          try {
            if (id === "opencode-go") {
              const key = auth[id]?.key;
              if (!key) throw new Error("no api key");
              next.set(id, { windows: await fetchZen(key) });
            } else if (id === "openai-codex") {
              next.set(id, { windows: await fetchCodex(agentDir) });
            }
            // Other providers are ignored (no known usage endpoint).
          } catch (error) {
            next.set(id, { windows: [], error: error instanceof Error ? error.message : String(error) });
          }
        }),
      );

      cache = next;
      lastFetch = Date.now();
    } catch {
      /* auth.json unreadable; keep previous cache */
    } finally {
      fetching = false;
    }
  }

  function setupFooter(ctx: any): void {
    ctx.ui.setFooter((tui: any, theme: any, footerData: any) => {
      requestRender = () => {
        try {
          tui.requestRender();
        } catch {
          /* ignore */
        }
      };
      return {
        invalidate() {},
        dispose() {},
        render(width: number): string[] {
          try {
            const main = packSegments(buildMainSegments(footerCtx ?? ctx, theme, footerData), width);
            const usage = packSegments(buildUsageSegments(footerCtx ?? ctx, theme), width);
            return usage.length ? [...main, ...usage] : main;
          } catch {
            return [];
          }
        },
      };
    });
  }

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx?.hasUI) return;
    footerCtx = ctx;
    await fetchAll();
    setupFooter(ctx);
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      if (Date.now() - lastFetch > REFETCH_MS) {
        fetchAll()
          .then(() => requestRender?.())
          .catch(() => {});
      }
      requestRender?.();
    }, TICK_MS);
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!ctx?.hasUI) return;
    await fetchAll();
    requestRender?.();
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    requestRender = null;
    if (ctx?.hasUI) {
      ctx.ui.setFooter(undefined);
    }
  });

  pi.registerCommand("usage", {
    description: "Refresh and show usage status",
    handler: async (_args, ctx) => {
      if (!ctx?.hasUI) return;
      await fetchAll();
      requestRender?.();
      ctx.ui.notify("Usage status refreshed", "info");
    },
  });
}
