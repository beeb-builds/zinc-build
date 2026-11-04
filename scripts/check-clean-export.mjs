// Verify a clean working-tree export. Does not claim to test a Git checkout.
import { cpSync, copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = mkdtempSync(join(tmpdir(), "zinc-clean-export-"));
const files = ["package.json", "package-lock.json", "tsconfig.json", "next.config.ts", "eslint.config.mjs"];
for (const file of [".node-version", "railway.json"]) if (existsSync(join(source, file))) files.push(file);
const hashes = {};
for (const file of files) {
  copyFileSync(join(source, file), join(destination, file));
  hashes[file] = createHash("sha256").update(readFileSync(join(source, file))).digest("hex");
}
for (const folder of ["src", "public"]) cpSync(join(source, folder), join(destination, folder), { recursive: true });
mkdirSync(join(destination, "scripts"));
const checks = readdirSync(join(source, "scripts")).filter(file => /^check-.*\.cjs$/.test(file)).sort();
for (const file of checks) copyFileSync(join(source, "scripts", file), join(destination, "scripts", file));
// Imported by check-wallet-baseline.cjs; it is a read-only fixture dependency.
copyFileSync(join(source, "scripts/read-wallet-baseline.mjs"), join(destination, "scripts/read-wallet-baseline.mjs"));
const evidence = { kind: "clean-working-tree-export", destination, node: process.version, startedAt: new Date().toISOString(), hashes, stages: [] };
mkdirSync(join(source, "data"), { recursive: true });
const report = join(source, "data", `clean-export-${Date.now()}.json`);
writeFileSync(report, JSON.stringify(evidence, null, 2));
console.log(`Clean export: ${destination}\nEvidence: ${report}\nNo .env, wallets, databases, Git metadata or prior build output copied.`);
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
delete env.ZINC_WORKSPACE_DB;
delete env.ZINC_ACTIVITY_DB;
function run(label, executable, args) {
  console.log(`Starting ${label}`);
  const result = spawnSync(executable, args, { cwd: destination, env, encoding: "utf8", timeout: label === "install" ? 1_800_000 : 600_000, maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(join(destination, `${label}.log`), `${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  evidence.stages.push({ label, exitCode: result.status, error: result.error?.message ?? null });
  writeFileSync(report, JSON.stringify(evidence, null, 2));
  if (result.error || result.status !== 0) {
    console.error((result.stderr || result.stdout || result.error?.message || "Command failed").slice(-6000));
    throw new Error(`${label} failed; inspect ${join(destination, `${label}.log`)}`);
  }
  console.log(`PASS: ${label}`);
}
function npm(label, command) {
  const cli = join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
  // Invoke npm directly when bundled with Node, so timeout targets npm itself.
  if (existsSync(cli)) run(label, process.execPath, [cli, ...command.split(" ")]);
  else if (process.platform === "win32") run(label, process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `npm.cmd ${command}`]);
  else run(label, "npm", command.split(" "));
}
npm("install", "ci --no-audit --no-fund");
npm("build", "run build");
npm("lint", "run lint");
for (const file of checks) run(file.replace(/\.cjs$/, ""), process.execPath, [join("scripts", file)]);
evidence.completedAt = new Date().toISOString();
writeFileSync(report, JSON.stringify(evidence, null, 2));
console.log(`PASS: clean install/build/lint and ${checks.length} regression scripts. This is a local export, not a published checkout or hosted deployment.`);
