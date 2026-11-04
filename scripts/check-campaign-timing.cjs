// Deterministic browser-clock and timer fixtures. No polling, RPC or wallet calls.
const fs = require("node:fs"), ts = require("typescript"), vm = require("node:vm"), React = require("react"), assert = require("node:assert/strict");
const { renderToStaticMarkup } = require("react-dom/server");
function load(file, overrides = {}, globals = {}) {
  const api = {}, code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: api, ...globals, require: (id) => id in overrides ? overrides[id] : require(id) });
  return api;
}
const timing = load("src/lib/campaign-discovery.ts");
const windowTimes = { start_timestamp_ms: 1000, end_timestamp_ms: 2000 };
for (const [now, expected] of [[999, "Scheduled"], [1000, "Active"], [2000, "Active"], [2001, "Ended"]]) assert.equal(timing.campaignStatus(windowTimes, now), expected);
function fixture(start, end, initial, initialNow) {
  let now = initialNow, slots = {}, cursor = 0, effect, nextId = 0, scheduled = 0;
  const timers = new Map(), listeners = new Map();
  class Clock extends Date { static now() { return now; } }
  const browser = {
    setTimeout(callback, delay) { assert.ok(delay > 0 && delay <= 2147483647); const id = ++nextId; timers.set(id, { callback, delay }); scheduled++; return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
  };
  const hooks = { useEffect(callback) { effect = callback; },
    useState(value) { const key = cursor++; if (!(key in slots)) slots[key] = value; return [slots[key], (value) => { slots[key] = value; }]; },
    useRef(value) { const key = cursor++; if (!(key in slots)) slots[key] = { current: value }; return slots[key]; },
  };
  const hook = load("src/components/campaigns/useCampaignStatus.ts", { react: hooks, "../../lib/campaign-discovery": timing }, { Date: Clock, window: browser });
  function render() { cursor = 0; return hook.useCampaignStatus(start, end, initial); }
  return { render, mount: () => effect(), at(value) { now = value; },
    fire() { const [id, timer] = [...timers][0] ?? []; assert.ok(timer); timers.delete(id); timer.callback(); },
    event(name) { listeners.get(name)?.forEach((callback) => callback()); },
    get delay() { return [...timers.values()][0]?.delay; }, get count() { return timers.size; }, get scheduled() { return scheduled; },
    get listeners() { return [...listeners.values()].reduce((sum, callbacks) => sum + callbacks.size, 0); } };
}
const f = fixture(1000, 2000, "Scheduled", 500);
assert.equal(f.render().status, "Scheduled"); const cleanup = f.mount();
assert.equal(f.delay, 500); assert.equal(f.count, 1);
f.at(1000); f.fire(); assert.equal(f.render().status, "Active"); assert.equal(f.delay, 1001);
f.at(2000); f.event("focus"); assert.equal(f.render().status, "Active"); assert.equal(f.delay, 1); assert.equal(f.count, 1);
f.at(2001); f.fire(); assert.equal(f.render().status, "Ended"); assert.equal(f.count, 0);
f.at(1500); f.event("pageshow"); assert.equal(f.render().status, "Active"); assert.equal(f.delay, 501);
f.at(2001); f.render().recheck(); assert.equal(f.render().status, "Ended"); assert.equal(f.count, 0);
cleanup(); assert.equal(f.count, 0); assert.equal(f.listeners, 0);
f.at(500); f.render().recheck(); assert.equal(f.render().status, "Ended", "Unmounted rechecks must not publish state");

const long = fixture(3_000_000_000, 3_000_001_000, "Scheduled", 0); long.render(); const stopLong = long.mount();
assert.equal(long.delay, 2147483647); long.at(2147483647); long.fire(); assert.equal(long.delay, 852516353); assert.equal(long.count, 1); stopLong();
const asleep = fixture(1000, 2000, "Scheduled", 500); asleep.render(); const stopSleep = asleep.mount();
asleep.at(5000); asleep.event("focus"); assert.equal(asleep.render().status, "Ended"); assert.equal(asleep.count, 0); stopSleep();
const hydration = fixture(1000, 2000, "Active", 3000);
assert.equal(hydration.render().status, "Active", "First render must preserve the supplied server snapshot");
const stopHydration = hydration.mount(); assert.equal(hydration.render().status, "Ended"); assert.equal(hydration.scheduled, 0); stopHydration();

let current = "Scheduled";
const badge = load("src/components/campaigns/CampaignStatusBadge.tsx", { "./useCampaignStatus": { useCampaignStatus: () => ({ status: current, recheck() {} }) } });
for (const status of ["Scheduled", "Active", "Ended"]) {
  current = status;
  const html = renderToStaticMarkup(React.createElement(badge.default, { startTimestampMs: 1000, endTimestampMs: 2000, initialStatus: "Scheduled" }));
  assert.ok(html.includes(`aria-label="Campaign status: ${status}"`)); assert.ok(html.includes('role="status"'));
}
console.log("PASS: inclusive start/end boundaries, one boundary timer, no per-second polling, long-delay clamping, focus/pageshow recovery, signing-time recheck, cleanup, server snapshot hydration and accessible badge states. No network transactions.");
