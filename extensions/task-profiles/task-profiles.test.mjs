import assert from "node:assert/strict";
import test from "node:test";
import register from "./task-profiles.ts";

const profiles = [
  ["rust", "openai-codex", "gpt-6.1-sol", "high"],
  ["research", "opencode-go", "qwen3.7-plus", "medium"],
  ["docs", "openai-codex", "gpt-6.1-terra", "medium"],
];

function harness(options = {}) {
  const calls = [];
  const notifications = [];
  const selections = [];
  let command;
  let thinking;
  let idle = options.idle ?? true;
  register({
    registerCommand(name, definition) {
      assert.equal(name, "task");
      command = definition;
    },
    async setModel(model) {
      calls.push(["model", model.provider, model.id]);
      // Catch thinking or prompt forwarding before the switch resolves.
      await Promise.resolve();
      assert.equal(thinking, undefined);
      assert.ok(!calls.some(([kind]) => kind === "request"));
      if (options.switchError) throw new Error("provider unavailable");
      return options.authenticated ?? true;
    },
    setThinkingLevel(level) {
      thinking = options.effectiveThinking ?? level;
      calls.push(["thinking", level]);
    },
    getThinkingLevel() { return thinking; },
    sendUserMessage(...args) { calls.push(["request", ...args]); },
  });
  const ctx = {
    hasUI: options.hasUI ?? true,
    isIdle: () => idle,
    model: options.current,
    modelRegistry: {
      find(provider, id) {
        if (options.missingModel) return undefined;
        assert.ok(profiles.some(([, p, m]) => p === provider && m === id));
        return { provider, id };
      },
    },
    ui: {
      notify(...args) { notifications.push(args); },
      async select(title, choices) {
        selections.push({ title, choices });
        if (options.busyAfterPicker) idle = false;
        return choices[options.pick];
      },
    },
  };
  return { calls, notifications, selections, command, run: (args = "") => command.handler(args, ctx) };
}

for (const [name, provider, model, thinking] of profiles) {
  test(`${name} selects the agreed model and thinking without starting a request`, async () => {
    const h = harness();
    await h.run(name);
    assert.deepEqual(h.calls, [["model", provider, model], ["thinking", thinking]]);
    assert.deepEqual(h.notifications, [[`Task ${name} → ${provider}/${model} · thinking ${thinking}`, "info"]]);
  });

  test(`${name} switches before forwarding the optional request unchanged`, async () => {
    const h = harness();
    await h.run(`  ${name.toUpperCase()} \n  Explain this:\n\n  /skill:tdd <example>  `);
    assert.deepEqual(h.calls, [
      ["model", provider, model],
      ["thinking", thinking],
      ["request", "Explain this:\n\n  /skill:tdd <example>"],
    ]);
  });

  test(`${name} reapplies thinking without redundantly switching the same model`, async () => {
    const h = harness({ current: { provider, id: model } });
    await h.run(name);
    assert.deepEqual(h.calls, [["thinking", thinking]]);
  });

  test(`${name} can be selected from the picker`, async () => {
    const h = harness({ pick: profiles.findIndex(([candidate]) => candidate === name) });
    await h.run();
    assert.equal(h.selections.length, 1);
    assert.equal(h.selections[0].choices.length, 3);
    assert.deepEqual(h.calls, [["model", provider, model], ["thinking", thinking]]);
  });
}

test("a different provider with the same model ID still switches", async () => {
  const h = harness({ current: { provider: "opencode-go", id: "gpt-6.1-sol" } });
  await h.run("rust");
  assert.equal(h.calls[0][0], "model");
});

test("picker cancellation leaves the session alone", async () => {
  const h = harness();
  await h.run();
  assert.deepEqual(h.calls, []);
  assert.deepEqual(h.notifications, []);
});

for (const args of ["unknown do something", "constructor", "__proto__"]) {
  test(`unknown profile ${args} reports usage without forwarding`, async () => {
    const h = harness();
    await h.run(args);
    assert.deepEqual(h.calls, []);
    assert.equal(h.notifications[0][1], "error");
    assert.match(h.notifications[0][0], /Usage:/);
  });
}

for (const options of [{ missingModel: true }, { authenticated: false }, { switchError: true }]) {
  test(`selection failure stops thinking changes and forwarding: ${JSON.stringify(options)}`, async () => {
    const h = harness(options);
    await h.run("rust implement retries");
    assert.ok(!h.calls.some(([kind]) => kind === "thinking" || kind === "request"));
    assert.equal(h.notifications[0][1], "error");
  });
}

test("busy sessions reject the command before showing a picker or changing models", async () => {
  const h = harness({ idle: false });
  await h.run();
  assert.deepEqual(h.calls, []);
  assert.deepEqual(h.selections, []);
  assert.equal(h.notifications[0][1], "warning");
});

test("work starting while the picker is open prevents switching", async () => {
  const h = harness({ pick: 0, busyAfterPicker: true });
  await h.run();
  assert.deepEqual(h.calls, []);
  assert.equal(h.notifications[0][1], "warning");
});

test("headless callers must supply a name but can still select a profile", async () => {
  const h = harness({ hasUI: false });
  await h.run();
  assert.deepEqual(h.selections, []);
  assert.deepEqual(h.calls, []);
  assert.match(h.notifications[0][0], /Usage:/);
  await h.run("research");
  assert.equal(h.calls[0][0], "model");
});

test("confirmation reports the effective thinking level", async () => {
  const h = harness({ effectiveThinking: "low" });
  await h.run("docs");
  assert.match(h.notifications[0][0], /thinking low$/);
});

test("autocomplete offers profile names only", () => {
  const { command } = harness();
  const complete = command.getArgumentCompletions;
  assert.deepEqual(complete("").map(({ value }) => value), ["rust", "research", "docs"]);
  assert.deepEqual(complete("R").map(({ value }) => value), ["rust", "research"]);
  assert.equal(complete("rust request"), null);
  assert.equal(complete("unknown"), null);
});
