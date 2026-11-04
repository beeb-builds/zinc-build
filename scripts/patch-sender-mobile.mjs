// Targeted compatibility patch for extension-capable mobile browsers.
// Upstream: @near-wallet-selector/sender 10.1.4 (MIT OR Apache-2.0).
// Preserve the official signing implementation; relax only the mobile exclusion
// when the browser already exposes the expected NEAR Sender provider.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export function patchSenderSource(source) {
  const original = "if (mobile) {\n      return null;\n    }";
  const patched = "if (mobile && !window.near?.isSender) {\n      return null;\n    }";
  if (source.includes(patched)) return source;
  if (source.split(original).length !== 2) throw new Error("Sender mobile guard changed upstream; review the compatibility patch before building.");
  return source.replace(original, patched);
}

export function patchInstalledSender() {
  const require = createRequire(import.meta.url);
  const root = dirname(require.resolve("@near-wallet-selector/sender/package.json"));
  if (JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version !== "10.1.4") {
    throw new Error("Review the mobile Sender patch before upgrading @near-wallet-selector/sender beyond 10.1.4.");
  }
  for (const name of ["index.js", "index.cjs"]) {
    const path = resolve(root, name), source = readFileSync(path, "utf8");
    const patched = patchSenderSource(source);
    if (patched !== source) writeFileSync(path, patched);
  }
  console.log("Sender mobile compatibility: enabled only when its NEAR extension provider is present.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) patchInstalledSender();
