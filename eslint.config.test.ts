import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();

async function boundaryErrors(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages
    .filter((m) => m.ruleId === "no-restricted-imports" || m.ruleId === "no-restricted-globals")
    .map((m) => m.ruleId);
}

describe("src/core boundary rule", () => {
  it.each([
    'import { useState } from "react";',
    'import { NextResponse } from "next/server";',
    'import { useTranslations } from "next-intl";',
    'import { createClient } from "@supabase/supabase-js";',
    'import { cn } from "@/lib/utils";',
  ])("rejects %s", async (code) => {
    expect(await boundaryErrors(`${code}\nexport {};\n`, "src/core/catalog/x.ts")).toEqual([
      "no-restricted-imports",
    ]);
  });

  it("rejects DOM globals", async () => {
    const code = "export const title = () => document.title;\n";
    expect(await boundaryErrors(code, "src/core/format/x.ts")).toEqual(["no-restricted-globals"]);
  });

  it("allows pure TypeScript in src/core", async () => {
    const code = 'import { z } from "zod";\nexport const Id = z.string();\n';
    expect(await boundaryErrors(code, "src/core/schemas/x.ts")).toEqual([]);
  });

  it("does not apply outside src/core", async () => {
    const code = 'import { useState } from "react";\nexport const s = useState;\n';
    expect(await boundaryErrors(code, "src/components/x.ts")).toEqual([]);
  });
});
