#!/usr/bin/env node
/**
 * ux_lint.mjs — deterministic UX-quality lint for landing-page code.
 * Zero dependencies, Node >= 18. Three modes:
 *
 *   node ux_lint.mjs <paths...>     CLI/CI: lint files/dirs. Exit 1 if criticals.
 *   node ux_lint.mjs --self-test    Run embedded fixtures. Exit 1 on failure.
 *   node ux_lint.mjs                Hook mode: reads Claude Code hook JSON on stdin.
 *       PostToolUse: lint the written file. Criticals -> exit 2 (stderr steers the
 *       agent); advisories -> additionalContext JSON, exit 0.
 *       Stop: lint git-changed UI files. Criticals -> exit 2 (blocks stopping,
 *       once — honors stop_hook_active); else exit 0.
 *
 * Severity: critical = objectively wrong (a11y, failed token contrast).
 *           advisory = drift/slop tells; the brief wins — suppress intentional
 *           exceptions with a `ux-guardrails-ignore <rule-id>` comment on or
 *           above the line, or via .ux-guardrails.json `ignoreRules`.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const UI_EXT = [".tsx", ".jsx", ".css", ".html"];
const DEFAULTS = {
  spacingStep: 4, // px grid for spacing values
  contrastMin: 4.5, // WCAG AA body text, applied to token pairs
  maxFontFamilies: 3, // display + body + one utility face
  transitionMaxMs: 500,
  ignoreRules: [],
  ignoreFiles: [],
};

// ---------------------------------------------------------------------------
// Color math: parse hex/rgb/hsl/oklch -> linear sRGB -> WCAG contrast ratio.
// Unresolvable values (var chains, color-mix, alpha) return null -> skipped.
// ---------------------------------------------------------------------------
function srgbToLinear(v) {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function parseColor(raw) {
  const s = raw.trim().toLowerCase();
  if (s.includes("var(") || s.includes("color-mix") || s.includes("gradient")) return null;
  let m;
  if ((m = s.match(/^#([0-9a-f]{3,8})$/))) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length === 8 && h.slice(6) !== "ff") return null; // alpha -> skip
    if (h.length !== 6 && h.length !== 8) return null;
    return [0, 2, 4].map((i) => srgbToLinear(parseInt(h.slice(i, i + 2), 16) / 255));
  }
  if ((m = s.match(/^rgba?\(([^)]+)\)$/))) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    if (p.length > 3 && p[3] < 1) return null;
    return p.slice(0, 3).map((v) => srgbToLinear(v / 255));
  }
  if ((m = s.match(/^hsla?\(([^)]+)\)$/))) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    if (p.length > 3 && parseFloat(p[3]) < 1) return null;
    const h = parseFloat(p[0]) / 360, sl = parseFloat(p[1]) / 100, l = parseFloat(p[2]) / 100;
    const q = l < 0.5 ? l * (1 + sl) : l + sl - l * sl, pp = 2 * l - q;
    const hue = (t) => {
      t = ((t % 1) + 1) % 1;
      if (t < 1 / 6) return pp + (q - pp) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return pp + (q - pp) * (2 / 3 - t) * 6;
      return pp;
    };
    return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)].map(srgbToLinear);
  }
  if ((m = s.match(/^oklch\(([^)]+)\)$/))) {
    const body = m[1];
    if (body.includes("/")) return null; // alpha -> skip
    const p = body.split(/\s+/).filter(Boolean);
    if (p.length < 3) return null;
    let L = parseFloat(p[0]);
    if (p[0].includes("%")) L /= 100;
    const C = parseFloat(p[1]);
    const H = ((parseFloat(p[2]) || 0) * Math.PI) / 180;
    const a = C * Math.cos(H), b = C * Math.sin(H);
    const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const lin = [
      4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
      -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
      -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
    ];
    return lin.map((v) => Math.min(1, Math.max(0, v)));
  }
  return null;
}
function contrast(c1, c2) {
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const [a, b] = [lum(c1), lum(c2)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

// ---------------------------------------------------------------------------
// Rule engine: each rule scans text, returns {line, message}. Severity + id in
// metadata. Rules never throw; a rule that can't resolve its inputs is silent.
// ---------------------------------------------------------------------------
const lineOf = (text, idx) => text.slice(0, idx).length - text.slice(0, idx).replace(/\n/g, "").length + 1;
const SPACING_UTILS = "(?:p|px|py|ps|pe|pt|pr|pb|pl|m|mx|my|ms|me|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|right|bottom|left)";
const TW_HUES = "(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)";

const RULES = [
  {
    id: "a11y.viewport-zoom", severity: "critical", ext: [".tsx", ".jsx", ".html"],
    scan(text, out) {
      for (const m of text.matchAll(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\.0)?\b/g))
        out(m.index, "viewport disables zoom — remove user-scalable=no / maximum-scale=1 (WCAG 1.4.4)");
    },
  },
  {
    id: "a11y.img-alt", severity: "critical", ext: [".tsx", ".jsx", ".html"],
    scan(text, out) {
      for (const m of text.matchAll(/<img\b[^>]*?>/g))
        if (!/\balt\s*=/.test(m[0]) && !m[0].includes("{...")) out(m.index, "<img> missing alt attribute (use alt=\"\" if decorative)");
    },
  },
  {
    id: "a11y.focus-visible", severity: "critical", ext: UI_EXT,
    scan(text, out) {
      if (!/\boutline-none\b|outline\s*:\s*none/.test(text)) return;
      if (/focus-visible|focus:ring|focus:outline|focus-within/.test(text)) return;
      const m = text.match(/\boutline-none\b|outline\s*:\s*none/);
      out(m.index, "outline removed with no focus-visible replacement anywhere in file — keyboard users lose focus");
    },
  },
  {
    id: "a11y.positive-tabindex", severity: "critical", ext: [".tsx", ".jsx", ".html"],
    scan(text, out) {
      for (const m of text.matchAll(/tab[iI]ndex\s*=\s*[{"']?\s*[1-9]/g))
        out(m.index, "positive tabindex breaks natural focus order — use 0 or restructure the DOM");
    },
  },
  {
    id: "a11y.div-onclick", severity: "advisory", ext: [".tsx", ".jsx"],
    scan(text, out) {
      for (const m of text.matchAll(/<(?:div|span)\b[^>]*?onClick[^>]*?>/gs))
        if (!/role\s*=|onKeyDown|tabIndex/.test(m[0])) out(m.index, "clickable div/span without role/keyboard handler — prefer <button> or <a>");
    },
  },
  {
    id: "spacing.arbitrary", severity: "advisory", ext: [".tsx", ".jsx", ".html"],
    scan(text, out, cfg) {
      const re = new RegExp(`\\b-?${SPACING_UTILS}-\\[(\\d+(?:\\.\\d+)?)px\\]`, "g");
      for (const m of text.matchAll(re)) {
        const v = parseFloat(m[1]);
        if (v > 2 && v % cfg.spacingStep !== 0) out(m.index, `${m[0]} is off the ${cfg.spacingStep}px spacing grid — snap to the scale or a token`);
      }
    },
  },
  {
    id: "spacing.css-offscale", severity: "advisory", ext: [".css"],
    scan(text, out, cfg) {
      for (const m of text.matchAll(/(?:^|[;{])\s*(?:padding|margin|gap|row-gap|column-gap)(?:-[a-z]+)?\s*:([^;}]+)/g)) {
        for (const px of m[1].matchAll(/(\d+(?:\.\d+)?)px/g)) {
          const v = parseFloat(px[1]);
          if (v > 2 && v % cfg.spacingStep !== 0) out(m.index, `spacing ${v}px is off the ${cfg.spacingStep}px grid — arbitrary values like 17px are an AI tell`);
        }
      }
    },
  },
  {
    id: "type.arbitrary-size", severity: "advisory", ext: [".tsx", ".jsx", ".html"],
    scan(text, out) {
      for (const m of text.matchAll(/\btext-\[(\d+(?:\.\d+)?)px\]/g))
        out(m.index, `${m[0]} bypasses the type scale — use a text-* step or extend the theme`);
    },
  },
  {
    id: "type.tiny-text", severity: "advisory", ext: [".css"],
    scan(text, out) {
      for (const m of text.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/g))
        if (parseFloat(m[1]) < 12) out(m.index, `font-size ${m[1]}px is below the 12px floor`);
    },
  },
  {
    id: "type.italic-heading", severity: "advisory", ext: UI_EXT,
    scan(text, out) {
      for (const m of text.matchAll(/<h[1-6][^>]*class[Nn]ame\s*=\s*[{"'`][^"'`}]*\bitalic\b/g))
        out(m.index, "italic heading — a top AI tell; reserve italics for body emphasis");
      for (const m of text.matchAll(/\bh[1-6][^{]*\{[^}]*font-style\s*:\s*italic/g))
        out(m.index, "italic heading — a top AI tell; reserve italics for body emphasis");
    },
  },
  {
    id: "color.raw-scale", severity: "advisory", ext: [".tsx", ".jsx", ".html"],
    scan(text, out) {
      const re = new RegExp(`\\b(?:bg|text|border|ring|fill|stroke|from|via|to)-${TW_HUES}-\\d{2,3}\\b`, "g");
      for (const m of text.matchAll(re)) out(m.index, `${m[0]} is a raw palette class — use semantic tokens (bg-primary, text-muted-foreground)`);
    },
  },
  {
    id: "color.raw-hex-class", severity: "advisory", ext: [".tsx", ".jsx", ".html"],
    scan(text, out) {
      for (const m of text.matchAll(/\b(?:bg|text|border|ring|from|via|to)-\[#[0-9a-fA-F]{3,8}\]/g))
        out(m.index, `${m[0]} hardcodes a color — define a token instead`);
    },
  },
  {
    id: "color.contrast-pair", severity: "critical", ext: [".css"],
    scan(text, out, cfg) {
      for (const block of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const vars = {};
        for (const v of block[2].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) vars[v[1]] = { raw: v[2].trim(), idx: block.index + block[1].length + v.index };
        const pairs = Object.keys(vars)
          .filter((k) => vars[`${k}-foreground`])
          .map((k) => [k, `${k}-foreground`]);
        if (vars.background && vars.foreground) pairs.push(["background", "foreground"]);
        for (const [bg, fg] of pairs) {
          const c1 = parseColor(vars[bg].raw), c2 = parseColor(vars[fg].raw);
          if (!c1 || !c2) continue; // unresolvable -> silent by design
          const ratio = contrast(c1, c2);
          if (ratio < cfg.contrastMin)
            out(vars[fg].idx, `--${fg} on --${bg} is ${ratio.toFixed(2)}:1 — below ${cfg.contrastMin}:1 (WCAG AA)`);
        }
      }
    },
  },
  {
    id: "slop.gradient-text", severity: "advisory", ext: UI_EXT,
    scan(text, out) {
      for (const m of text.matchAll(/\bbg-clip-text\b|background-clip\s*:\s*text/g))
        out(m.index, "gradient text — the most recognizable AI tell; use a solid ink color");
    },
  },
  {
    id: "slop.purple-gradient", severity: "advisory", ext: UI_EXT,
    scan(text, out) {
      for (const m of text.matchAll(/\b(?:from|via|to)-(?:purple|violet|indigo|fuchsia)-\d{2,3}\b/g))
        out(m.index, `${m[0]} — the AI purple-gradient fingerprint; pick a deliberate brand accent`);
      for (const m of text.matchAll(/gradient[^;}]*#(?:7c3aed|8b5cf6|a855f7|9333ea|6d28d9|667eea|764ba2|6366f1)/gi))
        out(m.index, "purple/indigo gradient hex — the AI fingerprint palette; pick a deliberate brand accent");
    },
  },
  {
    id: "slop.glassmorphism", severity: "advisory", ext: [".tsx", ".jsx", ".html"],
    scan(text, out) {
      if (!/backdrop-blur/.test(text)) return;
      for (const m of text.matchAll(/\bbg-(?:white|black)\/\d{1,2}\b|\bbg-opacity-\d/g))
        out(m.index, "glassmorphism combo (backdrop-blur + translucent fill) — default AI decoration; separate with whitespace instead");
    },
  },
  {
    id: "motion.transition-all", severity: "advisory", ext: UI_EXT,
    scan(text, out) {
      for (const m of text.matchAll(/\btransition-all\b|transition(?:-property)?\s*:\s*all\b/g))
        out(m.index, "transition: all animates everything incl. layout — list transform/opacity/color explicitly");
    },
  },
  {
    id: "motion.slow-transition", severity: "advisory", ext: UI_EXT,
    scan(text, out, cfg) {
      for (const m of text.matchAll(/\bduration-(\d{3,})\b|\bduration-\[(\d+)ms\]/g)) {
        const v = parseInt(m[1] || m[2], 10);
        if (v > cfg.transitionMaxMs) out(m.index, `${v}ms transition — UI feedback should stay under ${cfg.transitionMaxMs}ms (~200ms feels responsive)`);
      }
      for (const m of text.matchAll(/transition[^;{}]*?\b(\d+(?:\.\d+)?)(m?s)\b/g)) {
        const ms = m[2] === "s" ? parseFloat(m[1]) * 1000 : parseFloat(m[1]);
        if (ms > cfg.transitionMaxMs) out(m.index, `${ms}ms transition — UI feedback should stay under ${cfg.transitionMaxMs}ms`);
      }
    },
  },
  {
    id: "motion.ease-in-ui", severity: "advisory", ext: UI_EXT,
    scan(text, out) {
      for (const m of text.matchAll(/(?<![-\w])ease-in\b(?!-out)/g))
        out(m.index, "ease-in on UI delays the visible start — use ease-out for enters, ease-in-out for moves");
    },
  },
  {
    id: "motion.reduced-motion", severity: "advisory", ext: [".css"],
    scan(text, out) {
      if (/@keyframes/.test(text) && !/prefers-reduced-motion/.test(text))
        out(text.match(/@keyframes/).index, "@keyframes without a prefers-reduced-motion guard in this file — verify a global guard exists");
    },
  },
];

// Cross-file budget checks (CLI and Stop mode only).
function budgetFindings(files, cfg) {
  const families = new Set();
  for (const f of files.filter((f) => f.path.endsWith(".css"))) {
    for (const m of f.text.matchAll(/font-family\s*:\s*([^;}]+)/g)) {
      const first = m[1].split(",")[0].trim().replace(/["']/g, "").toLowerCase();
      if (first && !first.startsWith("var(") && first !== "inherit") families.add(first);
    }
  }
  if (families.size > cfg.maxFontFamilies)
    return [{ file: "(project)", line: 0, ruleId: "type.family-budget", severity: "advisory",
      message: `${families.size} font families declared (${[...families].join(", ")}) — budget is ${cfg.maxFontFamilies} (display + body + one utility face)` }];
  return [];
}

function lintText(filePath, text, cfg) {
  const ext = path.extname(filePath).toLowerCase();
  const lines = text.split("\n");
  const findings = [];
  const ignoredAt = (line, ruleId) => {
    for (const l of [lines[line - 1], lines[line - 2]]) {
      if (!l || !l.includes("ux-guardrails-ignore")) continue;
      const ids = l.split("ux-guardrails-ignore")[1].trim().split(/[\s,]+/).filter(Boolean);
      if (ids.length === 0 || ids.includes(ruleId)) return true;
    }
    return false;
  };
  for (const rule of RULES) {
    if (!rule.ext.includes(ext) || cfg.ignoreRules.includes(rule.id)) continue;
    rule.scan(text, (idx, message) => {
      const line = lineOf(text, idx);
      if (!ignoredAt(line, rule.id)) findings.push({ file: filePath, line, ruleId: rule.id, severity: rule.severity, message });
    }, cfg);
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------
function loadConfig(root) {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(path.join(root, ".ux-guardrails.json"), "utf8")) };
  } catch {
    return { ...DEFAULTS };
  }
}
const isUiFile = (p) => UI_EXT.includes(path.extname(p).toLowerCase());
function collectFiles(paths) {
  const out = [];
  const walk = (p) => {
    const st = fs.statSync(p, { throwIfNoEntry: false });
    if (!st) return;
    if (st.isDirectory()) {
      if (["node_modules", ".next", "dist", ".git"].includes(path.basename(p))) return;
      for (const e of fs.readdirSync(p)) walk(path.join(p, e));
    } else if (isUiFile(p)) out.push(p);
  };
  paths.forEach(walk);
  return out;
}
function lintFiles(filePaths, cfg) {
  const loaded = filePaths
    .filter((p) => !cfg.ignoreFiles.some((ig) => p.includes(ig)))
    .map((p) => ({ path: p, text: fs.readFileSync(p, "utf8") }));
  const findings = loaded.flatMap((f) => lintText(f.path, f.text, cfg));
  findings.push(...budgetFindings(loaded, cfg));
  return findings;
}
function format(findings) {
  const byFile = {};
  for (const f of findings) (byFile[f.file] ||= []).push(f);
  let out = "";
  for (const [file, fs_] of Object.entries(byFile)) {
    out += `${file}\n`;
    for (const f of fs_.sort((a, b) => a.line - b.line))
      out += `  ${file}:${f.line} ${f.severity === "critical" ? "[CRITICAL]" : "[advisory]"} [${f.ruleId}] ${f.message}\n`;
  }
  const crit = findings.filter((f) => f.severity === "critical").length;
  out += `${crit} critical, ${findings.length - crit} advisory. Suppress intentional exceptions with a "ux-guardrails-ignore <rule-id>" comment.\n`;
  return out;
}

function gitChangedUiFiles(root) {
  const run = (args) => {
    const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    return r.status === 0 ? r.stdout.split("\n").filter(Boolean) : [];
  };
  const files = [...new Set([...run(["diff", "--name-only", "HEAD"]), ...run(["ls-files", "--others", "--exclude-standard"])])];
  return files.filter(isUiFile).map((f) => path.join(root, f)).filter((f) => fs.existsSync(f)).slice(0, 20);
}

function hookMode(input) {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const cfg = loadConfig(root);
  const event = input.hook_event_name;
  if (event === "PostToolUse") {
    const file = input.tool_input?.file_path;
    if (!file || !isUiFile(file) || !fs.existsSync(file)) return 0;
    const findings = lintText(file, fs.readFileSync(file, "utf8"), cfg);
    const crit = findings.filter((f) => f.severity === "critical");
    if (crit.length) {
      process.stderr.write(`[ux-guardrails] critical UX violations in ${file} — fix before proceeding:\n${format(crit)}`);
      return 2;
    }
    const adv = findings.slice(0, 8);
    if (adv.length)
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse",
        additionalContext: `[ux-guardrails] advisory findings in ${file} (the brief wins — ignore deliberately, not silently):\n${format(adv)}` } }));
    return 0;
  }
  if (event === "Stop") {
    if (input.stop_hook_active) return 0; // one repair round max — never loop
    const findings = lintFiles(gitChangedUiFiles(root), cfg);
    const crit = findings.filter((f) => f.severity === "critical");
    if (crit.length) {
      process.stderr.write(`[ux-guardrails] ${crit.length} critical UX violation(s) in changed files — fix these before finishing:\n${format(findings)}`);
      return 2;
    }
    return 0;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Self-test: every rule must fire on its bad fixture and stay silent on clean.
// ---------------------------------------------------------------------------
function selfTest() {
  const badTsx = `
<meta name="viewport" content="width=device-width, user-scalable=no" />
<img src="/hero.png" />
<div onClick={go} className="p-[13px] bg-blue-500 transition-all duration-700 ease-in outline-none">
  <h1 className="italic bg-clip-text from-purple-500">Hi</h1>
  <span className="text-[15px] bg-[#ff0000] backdrop-blur bg-white/10" tabIndex={2} />
</div>`;
  const badCss = `:root { --primary: #777777; --primary-foreground: #999999; }
.section { padding: 17px; font-size: 10px; transition: opacity 900ms; }
@keyframes spin { to { transform: rotate(1turn); } }`;
  const cleanTsx = `
<img src="/x.png" alt="" />
<button onClick={go} className="p-4 bg-primary text-primary-foreground transition-colors duration-200 focus-visible:ring-2">Go</button>`;
  const cleanCss = `:root { --primary: oklch(0.205 0 0); --primary-foreground: oklch(0.985 0 0); }
.hero { padding: 24px; font-size: 16px; }
@media (prefers-reduced-motion: reduce) { * { animation: none; } }
@keyframes fade { from { opacity: 0; } }`;
  const ignoredTsx = `{/* ux-guardrails-ignore spacing.arbitrary */}
<div className="p-[13px]" />`;

  const cfg = { ...DEFAULTS };
  const ids = (f, t) => new Set(lintText(f, t, cfg).map((x) => x.ruleId));
  const badTsxIds = ids("a.tsx", badTsx);
  const badCssIds = ids("a.css", badCss);
  const expectTsx = ["a11y.viewport-zoom", "a11y.img-alt", "a11y.div-onclick", "a11y.focus-visible", "a11y.positive-tabindex",
    "spacing.arbitrary", "type.arbitrary-size", "type.italic-heading", "color.raw-scale", "color.raw-hex-class",
    "slop.gradient-text", "slop.purple-gradient", "slop.glassmorphism", "motion.transition-all", "motion.slow-transition", "motion.ease-in-ui"];
  const expectCss = ["color.contrast-pair", "spacing.css-offscale", "type.tiny-text", "motion.slow-transition", "motion.reduced-motion"];
  const errors = [];
  for (const id of expectTsx) if (!badTsxIds.has(id)) errors.push(`tsx fixture should trigger ${id}`);
  for (const id of expectCss) if (!badCssIds.has(id)) errors.push(`css fixture should trigger ${id}`);
  for (const [f, t] of [["c.tsx", cleanTsx], ["c.css", cleanCss]]) {
    const got = lintText(f, t, cfg);
    if (got.length) errors.push(`clean fixture ${f} should pass, got: ${got.map((x) => x.ruleId).join(", ")}`);
  }
  if (lintText("i.tsx", ignoredTsx, cfg).length) errors.push("ignore comment should suppress the finding");
  const okPair = parseColor("oklch(0.985 0 0)") && contrast(parseColor("oklch(0.205 0 0)"), parseColor("oklch(0.985 0 0)"));
  if (!okPair || okPair < 4.5) errors.push(`oklch contrast math broken (got ${okPair})`);
  if (errors.length) {
    console.error("SELF-TEST FAILED:\n" + errors.map((e) => `  - ${e}`).join("\n"));
    return 1;
  }
  console.log(`SELF-TEST PASSED (${RULES.length} rules, ${expectTsx.length + expectCss.length} bad-fixture assertions, clean fixtures silent)`);
  return 0;
}

// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) return selfTest();
  if (args.length) {
    const cfg = loadConfig(process.cwd());
    const findings = lintFiles(collectFiles(args.map((a) => path.resolve(a))), cfg);
    if (findings.length) process.stdout.write(format(findings));
    else console.log("ux-guardrails: no findings");
    return findings.some((f) => f.severity === "critical") ? 1 : 0;
  }
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return hookMode(JSON.parse(raw));
  } catch {
    return 0; // never break a turn on our own bug
  }
}
process.exit(await main());
