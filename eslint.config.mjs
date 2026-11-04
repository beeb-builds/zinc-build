import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // These Node/VM regression harnesses deliberately execute CommonJS fixtures.
    files: ["scripts/check-*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Cargo output is generated, not frontend source; avoid walking its large dependency tree.
    "contracts/**/target/**",
    "scripts/nft-sandbox/pre-nft-contract/target/**",
  ]),
]);

export default eslintConfig;
