import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const rootDir = path.resolve(import.meta.dirname, "..");
const reportDir = path.join(rootDir, "reports", "performance");
const port = Number(process.env.PERF_PORT ?? 3300);
const baseUrl = `http://127.0.0.1:${port}`;
const concurrency = Number(process.env.PERF_CONCURRENCY ?? 6);
const iterations = Number(process.env.PERF_ITERATIONS ?? 36);
const warmupIterations = Number(process.env.PERF_WARMUP ?? 6);

const targets = [
  { name: "dashboard_page", path: "/" },
  { name: "mentions_page", path: "/mentions" },
  { name: "bandeja_page", path: "/bandeja" },
  { name: "dashboard_api", path: "/api/dashboard/summary" },
  {
    name: "mentions_api",
    path: "/api/mentions?agencyId=pr-central&source=social"
  },
  {
    name: "mentions_enriched_api",
    path: "/api/mentions/enriched?agencyId=pr-central&source=social&limit=50"
  },
  {
    name: "enrichment_rollups_api",
    path: "/api/enrichments/rollups?window=24h&groupBy=platform_family&agencyId=pr-central"
  }
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const percentile = (values, ratio) => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio));
  return sorted[index];
};

const formatMs = (value) => `${value.toFixed(1)} ms`;

const waitForServer = async (server) => {
  const deadline = Date.now() + 60_000;
  let bufferedStdout = "";
  let bufferedStderr = "";

  server.stdout?.on("data", (chunk) => {
    bufferedStdout += chunk.toString();
  });

  server.stderr?.on("data", (chunk) => {
    bufferedStderr += chunk.toString();
  });

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(
        `Web server exited early.\nSTDOUT:\n${bufferedStdout}\nSTDERR:\n${bufferedStderr}`
      );
    }

    try {
      const response = await fetch(`${baseUrl}/api/dashboard/summary`);
      if (response.ok) {
        return;
      }
    } catch {}

    await sleep(500);
  }

  throw new Error(
    `Timed out waiting for local web server.\nSTDOUT:\n${bufferedStdout}\nSTDERR:\n${bufferedStderr}`
  );
};

const timedFetch = async (url) => {
  const started = performance.now();
  const response = await fetch(url, {
    headers: {
      "x-demo-role": "admin",
      "x-demo-agencies": "pr-central,pr-emergency",
      "x-demo-agency": "pr-central"
    }
  });
  await response.arrayBuffer();

  return {
    ok: response.ok,
    status: response.status,
    durationMs: performance.now() - started
  };
};

const runTarget = async ({ name, path: targetPath }) => {
  const url = `${baseUrl}${targetPath}`;

  for (let index = 0; index < warmupIterations; index += 1) {
    await timedFetch(url);
  }

  const totalStarted = performance.now();
  const latencies = [];
  const statuses = [];

  let nextRequestIndex = 0;

  const worker = async () => {
    while (nextRequestIndex < iterations) {
      nextRequestIndex += 1;
      const sample = await timedFetch(url);
      latencies.push(sample.durationMs);
      statuses.push(sample.status);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const totalDurationMs = performance.now() - totalStarted;
  const successfulRequests = statuses.filter(
    (status) => status >= 200 && status < 400
  ).length;

  return {
    name,
    path: targetPath,
    iterations,
    concurrency,
    totalDurationMs,
    requestsPerSecond: Number(
      (iterations / (totalDurationMs / 1000)).toFixed(2)
    ),
    successRate: Number(((successfulRequests / iterations) * 100).toFixed(2)),
    minMs: Number(Math.min(...latencies).toFixed(2)),
    maxMs: Number(Math.max(...latencies).toFixed(2)),
    avgMs: Number(
      (
        latencies.reduce((sum, value) => sum + value, 0) / latencies.length
      ).toFixed(2)
    ),
    p50Ms: Number(percentile(latencies, 0.5).toFixed(2)),
    p95Ms: Number(percentile(latencies, 0.95).toFixed(2))
  };
};

const renderMarkdown = (results) => {
  const lines = [
    "# Performance Baseline",
    "",
    `- Base URL: \`${baseUrl}\``,
    `- Iterations per target: \`${iterations}\``,
    `- Concurrency: \`${concurrency}\``,
    `- Warmup requests per target: \`${warmupIterations}\``,
    "",
    "| Target | Avg | p50 | p95 | Max | Req/s | Success |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |"
  ];

  for (const result of results) {
    lines.push(
      `| ${result.name} | ${formatMs(result.avgMs)} | ${formatMs(result.p50Ms)} | ${formatMs(result.p95Ms)} | ${formatMs(result.maxMs)} | ${result.requestsPerSecond} | ${result.successRate}% |`
    );
  }

  return lines.join("\n");
};

fs.mkdirSync(reportDir, { recursive: true });

const server = spawn(
  "pnpm",
  [
    "--filter",
    "@sac/web",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port)
  ],
  {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(port)
    },
    stdio: ["ignore", "pipe", "pipe"]
  }
);

try {
  await waitForServer(server);

  const results = [];

  for (const target of targets) {
    results.push(await runTarget(target));
  }

  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const jsonPath = path.join(reportDir, `${timestamp}.json`);
  const latestJsonPath = path.join(reportDir, "latest.json");
  const latestMdPath = path.join(reportDir, "latest.md");
  const markdown = renderMarkdown(results);

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), baseUrl, results },
      null,
      2
    )
  );
  fs.writeFileSync(
    latestJsonPath,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), baseUrl, results },
      null,
      2
    )
  );
  fs.writeFileSync(latestMdPath, `${markdown}\n`);

  console.log(markdown);
  console.log(`\nSaved JSON report to ${latestJsonPath}`);
  console.log(`Saved Markdown report to ${latestMdPath}`);
} finally {
  server.kill("SIGTERM");
}
