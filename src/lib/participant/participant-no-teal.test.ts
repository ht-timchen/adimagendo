import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));

/** The old participant teal palette, and the shared brand utilities (participant files use participant-* tokens). */
const TEAL =
  /#(2f8f7a|277866|216657|17483f|0f3d35|1f5c50|2a6f60|1e5d50|215e52|e8f3f0|d4ebe5|f1faf7|d9ece7)\b|rgb\(\s*47 143 122|rgb\(\s*31 92 80|\bteal-\d|\b(?:bg|text|border|ring|fill|stroke|outline)-brand(?:-[a-z-]+)?\b/i;

/** Admin, login/enrolment and shared UI keep the shared brand palette. */
const EXCLUDED_COMPONENT_DIRS = new Set(["admin", "auth", "ui", "brand"]);

function walk(dir: string, skipDir: (name: string) => boolean): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDir(entry.name)) files.push(...walk(path, skipDir));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
      files.push(path);
    }
  }
  return files;
}

function participantSourceFiles(): string[] {
  const pages = walk(join(root, "src/app/(dashboard)/dashboard"), (name) => name === "admin");
  const components = walk(join(root, "src/components"), (name) =>
    EXCLUDED_COMPONENT_DIRS.has(name)
  ).filter((file) => !/admin/i.test(relative(join(root, "src/components"), file)));
  return [...pages, ...components, join(root, "src/lib/participant-dashboard-ui.ts")];
}

/** Grey/slate fills, or the shared `secondary` variant (bg-slate-100), on a participant button. */
const GREY_BUTTON = /(?:^|[\s"'`{:])bg-(?:gray|slate|zinc|neutral|stone)-\d|variant=["']secondary["']/;

/** Opening `<Button ...>` / `<button ...>` tags; `>` inside `{...}` (arrow functions) does not end the tag. */
function buttonOpeningTags(source: string): string[] {
  const tags: string[] = [];
  const start = /<(?:Button|button)(?=[\s>/])/g;
  for (let match = start.exec(source); match; match = start.exec(source)) {
    let depth = 0;
    let quote: string | null = null;
    let end = match.index + match[0].length;
    for (; end < source.length; end++) {
      const ch = source[end];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
      } else if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
      } else if (ch === ">" && depth === 0) {
        break;
      }
    }
    tags.push(source.slice(match.index, end + 1));
  }
  return tags;
}

describe("participant buttons have no grey-blue fill", () => {
  it("finds button tags, including multi-line ones with arrow functions", () => {
    const tags = buttonOpeningTags(
      '<Button\n  onClick={() => go(1 > 0)}\n  className="bg-slate-100"\n>x</Button><button type="button">y</button>'
    );
    assert.equal(tags.length, 2);
    assert.match(tags[0], /bg-slate-100/);
    assert.ok(GREY_BUTTON.test(tags[0]));
    assert.ok(GREY_BUTTON.test('<Button variant="secondary">'));
    assert.ok(GREY_BUTTON.test('<button className="hover:bg-gray-50">'));
    assert.ok(!GREY_BUTTON.test('<Button className="bg-participant-button text-slate-700">'));
  });

  it("has no gray/slate background or secondary variant on participant buttons", () => {
    const offenders: string[] = [];
    let scanned = 0;
    for (const file of participantSourceFiles()) {
      for (const tag of buttonOpeningTags(readFileSync(file, "utf8"))) {
        scanned++;
        if (GREY_BUTTON.test(tag)) {
          offenders.push(`${relative(root, file)}: ${tag.replace(/\s+/g, " ").slice(0, 160)}`);
        }
      }
    }
    assert.ok(scanned > 20, `expected participant buttons, found ${scanned}`);
    assert.deepEqual(offenders, []);
  });
});

describe("participant pages use the pink participant palette", () => {
  it("scans the participant pages and components", () => {
    const files = participantSourceFiles().map((file) => relative(root, file));
    assert.ok(files.length > 30, `expected the participant files, found ${files.length}`);
    assert.ok(files.includes("src/app/(dashboard)/dashboard/page.tsx"));
    assert.ok(files.includes("src/components/dashboard-nav.tsx"));
    assert.ok(!files.some((file) => file.includes("/admin/")));
  });

  it("has no teal colour or shared brand utility left in participant files", () => {
    const offenders: string[] = [];
    for (const file of participantSourceFiles()) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (TEAL.test(line)) offenders.push(`${relative(root, file)}:${index + 1}: ${line.trim()}`);
        });
    }
    assert.deepEqual(offenders, []);
  });

  it("has no teal in participant CSS rules, and keeps teal as the shared default", () => {
    const css = readFileSync(join(root, "src/app/globals.css"), "utf8");
    const offenders: string[] = [];
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (/participant/.test(selector) && TEAL.test(body)) offenders.push(selector.trim());
    }
    assert.deepEqual(offenders, []);

    assert.match(css, /:root\s*\{[^}]*--brand:\s*#2f8f7a;/);
    assert.match(
      css,
      /\.dashboard-participant-light,\s*\.participant-portal-light\s*\{[^}]*--brand:\s*var\(--participant-primary\);/
    );
  });
});
