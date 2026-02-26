/**
 * Load Test — Search Endpoint
 * Target: https://cs.vendereincloud.it/api/search/search
 * Tenant: dfl-eventi-it
 *
 * Ramp-up profile:
 *   0–30s   →  33 concurrent users   (~16 rps)   warm-up
 *  30–60s   → 500 concurrent users   (~250 rps)  normal peak
 *  60–90s   → 1000 concurrent users  (~500 rps)  high peak
 *  90–120s  → 1500 concurrent users  (~750 rps)  stress / safety margin
 * 120–150s  →  500 concurrent users  (~250 rps)  cool-down
 *
 * Usage:
 *   node scripts/load-test-search.mjs
 *   node scripts/load-test-search.mjs --url https://cs.vendereincloud.it --duration 60
 */

import { performance } from "perf_hooks";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const BASE_URL = process.env.LOAD_TEST_URL
  || getArg("--url")
  || "https://cs.vendereincloud.it";

const SEARCH_URL = `${BASE_URL}/api/search/search`;

const API_KEY_ID  = process.env.LOAD_TEST_KEY_ID  || "ak_dfl-eventi-it_112233445566";
const API_SECRET  = process.env.LOAD_TEST_SECRET   || "sk_112233445566778899aabbccddeeff00";

const TIMEOUT_MS  = 10_000;  // per-request timeout

// Ramp stages: { durationSec, concurrency }
const STAGES = [
  { durationSec: 30,  concurrency:   33,  label: "warm-up"       },
  { durationSec: 30,  concurrency:  500,  label: "normal peak"   },
  { durationSec: 30,  concurrency: 1000,  label: "high peak"     },
  { durationSec: 30,  concurrency: 1500,  label: "stress"        },
  { durationSec: 30,  concurrency:  500,  label: "cool-down"     },
];

// Realistic search queries for an events/hardware supply company
const SEARCH_SCENARIOS = [
  { text: "",          rows: 20, label: "browse (no text)"        },
  { text: "chiodi",   rows: 20, label: "search: chiodi"          },
  { text: "viti",     rows: 20, label: "search: viti"            },
  { text: "bulloni",  rows: 20, label: "search: bulloni"         },
  { text: "legno",    rows: 20, label: "search: legno"           },
  { text: "acciaio",  rows: 20, label: "search: acciaio"         },
  { text: "mm 40",    rows: 20, label: "search: size mm 40"      },
  { text: "sidex",    rows: 10, label: "search: brand sidex"     },
  { text: "",          rows: 20, start: 20, label: "page 2"      },
  { text: "",          rows: 20, start: 40, label: "page 3"      },
];

// ─── METRICS ─────────────────────────────────────────────────────────────────

const metrics = {
  total: 0,
  success: 0,
  errors: 0,
  timeouts: 0,
  latencies: [],         // ms, kept for percentile calculation
  statusCodes: {},
  stageMetrics: {},
};

function recordResult(status, latencyMs, stageName) {
  metrics.total++;
  metrics.latencies.push(latencyMs);
  metrics.statusCodes[status] = (metrics.statusCodes[status] || 0) + 1;

  if (!metrics.stageMetrics[stageName]) {
    metrics.stageMetrics[stageName] = { total: 0, success: 0, errors: 0, latencies: [] };
  }
  const sm = metrics.stageMetrics[stageName];
  sm.total++;
  sm.latencies.push(latencyMs);

  if (status >= 200 && status < 300) {
    metrics.success++;
    sm.success++;
  } else {
    metrics.errors++;
    sm.errors++;
  }
}

function recordTimeout(stageName) {
  metrics.total++;
  metrics.timeouts++;
  metrics.errors++;
  metrics.latencies.push(TIMEOUT_MS);
  if (!metrics.stageMetrics[stageName]) {
    metrics.stageMetrics[stageName] = { total: 0, success: 0, errors: 0, latencies: [] };
  }
  const sm = metrics.stageMetrics[stageName];
  sm.total++;
  sm.errors++;
  sm.latencies.push(TIMEOUT_MS);
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── REQUEST ─────────────────────────────────────────────────────────────────

function pickScenario() {
  return SEARCH_SCENARIOS[Math.floor(Math.random() * SEARCH_SCENARIOS.length)];
}

async function doSearch(stageName) {
  const scenario = pickScenario();
  const body = {
    lang: "it",
    text: scenario.text,
    rows: scenario.rows,
    start: scenario.start || 0,
    include_faceting: false,   // skip faceting to stress pure search path
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const t0 = performance.now();

  try {
    const res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-method": "api-key",
        "x-api-key-id": API_KEY_ID,
        "x-api-secret": API_SECRET,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const latency = performance.now() - t0;
    recordResult(res.status, latency, stageName);
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      recordTimeout(stageName);
    } else {
      const latency = performance.now() - t0;
      recordResult(0, latency, stageName);
    }
  }
}

// ─── WORKER POOL ─────────────────────────────────────────────────────────────

/**
 * Run `concurrency` parallel workers for `durationSec` seconds.
 * Each worker loops: send request → immediately send another (max throughput).
 */
async function runStage({ durationSec, concurrency, label }) {
  const stageStart = Date.now();
  const stageEnd   = stageStart + durationSec * 1000;

  printStageHeader(label, concurrency, durationSec);

  const workers = Array.from({ length: concurrency }, async () => {
    while (Date.now() < stageEnd) {
      await doSearch(label);
    }
  });

  await Promise.all(workers);
}

// ─── REPORTING ────────────────────────────────────────────────────────────────

function printStageHeader(label, concurrency, duration) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  STAGE: ${label.toUpperCase()}`);
  console.log(`  Concurrency: ${concurrency} users  |  Duration: ${duration}s`);
  console.log("─".repeat(60));
}

function printStageReport(label, durationSec) {
  const sm = metrics.stageMetrics[label];
  if (!sm || sm.total === 0) return;

  const rps       = (sm.total / durationSec).toFixed(1);
  const errRate   = ((sm.errors / sm.total) * 100).toFixed(1);
  const p50       = percentile(sm.latencies, 50).toFixed(0);
  const p95       = percentile(sm.latencies, 95).toFixed(0);
  const p99       = percentile(sm.latencies, 99).toFixed(0);
  const maxLat    = Math.max(...sm.latencies).toFixed(0);

  console.log(`  Requests:  ${sm.total}  (${rps} rps)`);
  console.log(`  Success:   ${sm.success}  |  Errors: ${sm.errors} (${errRate}%)`);
  console.log(`  Latency:   p50=${p50}ms  p95=${p95}ms  p99=${p99}ms  max=${maxLat}ms`);
}

function printFinalReport(totalSec) {
  const totalRps  = (metrics.total / totalSec).toFixed(1);
  const errRate   = ((metrics.errors / metrics.total) * 100).toFixed(2);
  const p50       = percentile(metrics.latencies, 50).toFixed(0);
  const p95       = percentile(metrics.latencies, 95).toFixed(0);
  const p99       = percentile(metrics.latencies, 99).toFixed(0);
  const maxLat    = Math.max(...metrics.latencies).toFixed(0);

  console.log(`\n${"═".repeat(60)}`);
  console.log("  FINAL REPORT");
  console.log("═".repeat(60));
  console.log(`  Target:        ${SEARCH_URL}`);
  console.log(`  Total time:    ${totalSec}s`);
  console.log(`  Total reqs:    ${metrics.total}  (avg ${totalRps} rps)`);
  console.log(`  Success:       ${metrics.success}`);
  console.log(`  Errors:        ${metrics.errors}  (${errRate}%)`);
  console.log(`  Timeouts:      ${metrics.timeouts}`);
  console.log(`  Status codes:  ${JSON.stringify(metrics.statusCodes)}`);
  console.log(`\n  LATENCY (overall)`);
  console.log(`  p50:  ${p50}ms`);
  console.log(`  p95:  ${p95}ms`);
  console.log(`  p99:  ${p99}ms`);
  console.log(`  max:  ${maxLat}ms`);

  console.log(`\n  PER-STAGE SUMMARY`);
  for (const stage of STAGES) {
    const sm = metrics.stageMetrics[stage.label];
    if (!sm || sm.total === 0) continue;
    const rps     = (sm.total / stage.durationSec).toFixed(1);
    const errPct  = ((sm.errors / sm.total) * 100).toFixed(1);
    const p95s    = percentile(sm.latencies, 95).toFixed(0);
    console.log(
      `  [${stage.label.padEnd(14)}]  ${String(sm.total).padStart(6)} req  ` +
      `${String(rps).padStart(6)} rps  ` +
      `err ${String(errPct).padStart(5)}%  ` +
      `p95 ${p95s}ms`
    );
  }

  // Thresholds check
  console.log(`\n  THRESHOLDS`);
  const peakStage = metrics.stageMetrics["high peak"];
  const p95Peak   = peakStage ? percentile(peakStage.latencies, 95) : 9999;
  const errPeak   = peakStage ? (peakStage.errors / peakStage.total) * 100 : 100;

  checkThreshold("p95 latency @ 1k users < 3000ms", p95Peak < 3000, `${p95Peak.toFixed(0)}ms`);
  checkThreshold("p95 latency @ 1k users < 2000ms", p95Peak < 2000, `${p95Peak.toFixed(0)}ms`);
  checkThreshold("error rate @ 1k users < 1%",      errPeak  < 1,   `${errPeak.toFixed(2)}%`);
  checkThreshold("error rate @ 1k users < 5%",      errPeak  < 5,   `${errPeak.toFixed(2)}%`);
  console.log("═".repeat(60));
}

function checkThreshold(name, pass, actual) {
  const icon = pass ? "✅" : "❌";
  console.log(`  ${icon} ${name}  →  ${actual}`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

async function main() {
  console.log("═".repeat(60));
  console.log("  VINC COMMERCE — SEARCH LOAD TEST");
  console.log("═".repeat(60));
  console.log(`  URL:     ${SEARCH_URL}`);
  console.log(`  Tenant:  dfl-eventi-it`);
  console.log(`  Stages:  ${STAGES.length}  |  Total: ${STAGES.reduce((s, st) => s + st.durationSec, 0)}s`);
  console.log(`  Peak:    ${Math.max(...STAGES.map(s => s.concurrency))} concurrent users`);

  const globalStart = Date.now();

  for (const stage of STAGES) {
    const stageStart = Date.now();
    await runStage(stage);
    const elapsed = (Date.now() - stageStart) / 1000;
    printStageReport(stage.label, elapsed);
  }

  const totalSec = (Date.now() - globalStart) / 1000;
  printFinalReport(totalSec);
}

main().catch(err => {
  console.error("Load test crashed:", err);
  process.exit(1);
});
