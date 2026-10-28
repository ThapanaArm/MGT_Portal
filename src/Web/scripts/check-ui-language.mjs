import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

// Check authored UI copy, not comments or database responses. The legacy JSON
// migration map only recognizes old sample data and is never rendered as UI.
const root = fileURLToPath(new URL("../src/", import.meta.url));
let failures = 0;
function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { inspect(file); continue; }
    if (!/\.tsx?$/.test(file)) continue;
    const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if ((ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) && /[\u0e00-\u0e7f]/u.test(node.text)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        console.error(`${file}:${line + 1}: ${node.text.trim()}`);
        failures++;
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
inspect(root);
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/<!--[\s\S]*?-->|\/\/[^\n]*/g, "");
if (/[\u0e00-\u0e7f]/u.test(html)) { console.error("index.html contains Thai UI copy"); failures++; }
if (!/<html\s+lang="en"/.test(html)) { console.error("index.html must declare English"); failures++; }
if (failures) process.exitCode = 1;
else console.log("English UI copy check passed.");
