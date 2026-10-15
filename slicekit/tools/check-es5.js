#!/usr/bin/env node
'use strict';
// ES5 gate for everything that runs inside Max (core/, max/, dist/).
//
// 1. Syntax: acorn parses each file with ecmaVersion 5, so let/const, arrows,
//    classes, template literals, etc. are rejected.
// 2. API: a regex scan of the code (comments removed) catches ES2015+ library
//    calls that parse fine but do not exist in Max's ES5 runtime.
//
// Usage: node tools/check-es5.js [file.js ...]
//        (no arguments: checks *.js directly inside core/, max/ and dist/)
// Suppress an API finding on one line with a trailing `// es5-ok` comment.

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const ROOT = path.join(__dirname, '..');
const DEFAULT_DIRS = ['core', 'max', 'dist'];
const SUPPRESS_RE = /\/\/\s*es5-ok\b/;

// [pattern, name shown in the report]
const BANNED_API = [
  [/\.includes\s*\(/, '.includes()'],
  [/\.find\s*\(/, '.find()'],
  [/\.findIndex\s*\(/, '.findIndex()'],
  [/\.fill\s*\((?!\s*\))/, '.fill(value)'],  // mgraphics.fill() takes no args and is fine
  [/\bObject\s*\.\s*assign\b/, 'Object.assign'],
  [/\.startsWith\s*\(/, '.startsWith()'],
  [/\.endsWith\s*\(/, '.endsWith()'],
  [/\.padStart\s*\(/, '.padStart()'],
  [/\.repeat\s*\(/, '.repeat()'],
  [/\bArray\s*\.\s*from\b/, 'Array.from'],
  [/\bnew\s+Map\b/, 'new Map'],
  [/\bnew\s+Set\b/, 'new Set'],
  [/\bPromise\b/, 'Promise'],
  [/\bSymbol\b/, 'Symbol'],
];

// Blank out the given [start, end) ranges with spaces, keeping newlines so
// line numbers hold. Ranges come from acorn, so they are exact.
function blankRanges(src, ranges) {
  const chars = src.split('');
  for (const r of ranges) {
    for (let i = r.start; i < r.end; i++) {
      if (chars[i] !== '\n' && chars[i] !== '\r') chars[i] = ' ';
    }
  }
  return chars.join('');
}

// Code only: comments, string literals and regex literals are blanked, so a
// banned name in text or a pattern (e.g. "use .repeat()") is not a call.
function codeOnly(src, comments, tokens) {
  const literal = tokens.filter((t) => t.type.label === 'string' || t.type.label === 'regexp');
  return blankRanges(src, comments.concat(literal));
}

function displayName(file) {
  const rel = path.relative(process.cwd(), file);
  return rel && !rel.startsWith('..') ? rel : file;
}

function checkFile(file, problems) {
  const shown = displayName(file);

  let src;
  try {
    src = fs.readFileSync(file, 'utf8');
  } catch (err) {
    problems.push(`${shown}:1:1 cannot read file (${err.code})`);
    return;
  }

  const comments = [];
  const tokens = [];
  try {
    acorn.parse(src, {
      ecmaVersion: 5,
      sourceType: 'script',
      onComment: comments,
      onToken: tokens,
    });
  } catch (err) {
    if (!err.loc) throw err;
    const msg = err.message.replace(/\s*\(\d+:\d+\)$/, '');
    problems.push(`${shown}:${err.loc.line}:${err.loc.column + 1} ${msg}`);
  }

  // Comments and tokens are collected up to the point where parsing stopped,
  // if it did, so the API scan on a broken file may miss text after that point.
  const code = codeOnly(src, comments, tokens).split('\n');
  const raw = src.split('\n');
  code.forEach((text, i) => {
    if (SUPPRESS_RE.test(raw[i] || '')) return;
    for (const [re, name] of BANNED_API) {
      const m = re.exec(text);
      if (m) {
        problems.push(
          `${shown}:${i + 1}:${m.index + 1} ${name} is not ES5 ` +
          `(use a loop or a helper; // es5-ok to allow, e.g. typed arrays)`
        );
      }
    }
  });
}

function defaultFiles() {
  const files = [];
  for (const dir of DEFAULT_DIRS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs).sort()) {
      const full = path.join(abs, name);
      if (name.endsWith('.js') && fs.statSync(full).isFile()) files.push(full);
    }
  }
  return files;
}

function main() {
  const args = process.argv.slice(2);
  const files = args.length ? args.map((a) => path.resolve(a)) : defaultFiles();

  const problems = [];
  for (const file of files) {
    if (!fs.existsSync(file)) {
      problems.push(`${displayName(file)}:1:1 file not found`);
      continue;
    }
    checkFile(file, problems);
  }

  if (problems.length) {
    for (const p of problems) console.log(p);
    console.log(`ES5 check failed: ${problems.length} problem(s) in ${files.length} files`);
    process.exit(1);
  }
  console.log(`ES5 OK: ${files.length} files`);
}

main();
