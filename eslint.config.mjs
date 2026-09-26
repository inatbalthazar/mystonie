import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// src/core must stay pure TypeScript so it can be extracted for a future Expo app (AGENTS.md, ADR 0006).
const CORE_MESSAGE =
  "src/core is pure TypeScript: no React, Next, DOM, Supabase or app-layer imports.";

const coreBoundary = {
  files: ["src/core/**/*.{ts,tsx,mts,cts,js,mjs}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [
              "react",
              "react/*",
              "react-dom",
              "react-dom/*",
              "next",
              "next/*",
              "next-intl",
              "next-intl/*",
              "@supabase/*",
              "@/app/*",
              "@/components/*",
              "@/cards/*",
              "@/data/*",
              "@/lib/*",
            ],
            message: CORE_MESSAGE,
          },
        ],
      },
    ],
    "no-restricted-globals": [
      "error",
      ...[
        "window",
        "document",
        "navigator",
        "location",
        "localStorage",
        "sessionStorage",
        "HTMLElement",
        "Element",
      ].map((name) => ({ name, message: CORE_MESSAGE })),
    ],
  },
};

// Every UI string goes through next-intl (AGENTS.md, ADR 0007). Props such as className are allowed;
// visible text in JSX children must come from t(...). shadcn primitives in components/ui are exempt.
const noHardCodedCopy = {
  files: ["src/**/*.tsx"],
  ignores: ["src/components/ui/**"],
  rules: {
    "react/jsx-no-literals": [
      "error",
      { noStrings: true, ignoreProps: true, allowedStrings: ["·", "•", "/", "-", "–", "—", "|", ":", "(", ")"] },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  coreBoundary,
  noHardCodedCopy,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
