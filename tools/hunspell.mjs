/**
 * A Hunspell affix expander: .aff + .dic -> every word form the dictionary
 * accepts ON ITS OWN. Compounds are deliberately not generated (Dutch and
 * Danish could produce them without limit); a compound the dictionary lists
 * as an entry is still a word.
 *
 * Implements what the shipped dictionaries use - checked per language by
 * tools/build-dict.mjs, which refuses an .aff with a directive this file does
 * not understand rather than silently generating the wrong list:
 *
 *   FLAG char | UTF-8 | long | num, PFX/SFX with cross products and
 *   conditions, two-level suffixes (continuation classes), NEEDAFFIX,
 *   FORBIDDENWORD, ONLYINCOMPOUND, CIRCUMFIX, FULLSTRIP, OCONV.
 *
 * Reference: hunspell(5), https://man.archlinux.org/man/hunspell.5
 */

/** Directives that change which forms are valid and are NOT implemented. */
const UNSUPPORTED = ['AF', 'AM', 'COMPLEXPREFIXES', 'IGNORE', 'CHECKSHARPS', 'PSEUDOROOT', 'SUBSTANDARD'];

export function parseAff(text) {
  const aff = {
    flagType: 'char',
    needAffix: null, forbidden: null, onlyInCompound: null, circumfix: null,
    fullStrip: false,
    oconv: [],
    pfx: new Map(),
    sfx: new Map(),
  };
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  let block = null; // { kind, flag, left }
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === '' || line.startsWith('#')) continue;
    const f = line.split(/\s+/);
    const op = f[0];

    if (block && block.left > 0 && op === block.kind && f[1] === block.flag) {
      block.cls.rules.push(parseRule(aff, block.kind, f));
      block.left--;
      continue;
    }
    if (UNSUPPORTED.includes(op)) throw new Error(`hunspell: ${op} is not supported`);
    switch (op) {
      case 'FLAG': aff.flagType = f[1] === 'UTF-8' ? 'char' : f[1]; break;
      case 'NEEDAFFIX': aff.needAffix = f[1]; break;
      case 'FORBIDDENWORD': aff.forbidden = f[1]; break;
      case 'ONLYINCOMPOUND': aff.onlyInCompound = f[1]; break;
      case 'CIRCUMFIX': aff.circumfix = f[1]; break;
      case 'FULLSTRIP': aff.fullStrip = true; break;
      case 'OCONV':
        if (f.length >= 3) aff.oconv.push([f[1], f[2]]);
        break;
      case 'PFX':
      case 'SFX': {
        if (f.length >= 4 && (f[2] === 'Y' || f[2] === 'N') && /^\d+$/.test(f[3])) {
          const table = op === 'PFX' ? aff.pfx : aff.sfx;
          // A flag declared twice keeps both blocks, as Hunspell does.
          const cls = table.get(f[1]) ?? { cross: f[2] === 'Y', rules: [] };
          table.set(f[1], cls);
          block = { kind: op, flag: f[1], left: Number(f[3]), cls };
        } else {
          throw new Error(`hunspell: stray ${op} line: ${line}`);
        }
        break;
      }
      default:
        break; // spelling-suggestion and compounding directives: not about validity
    }
  }
  if (!['char', 'long', 'num'].includes(aff.flagType)) throw new Error(`hunspell: FLAG ${aff.flagType}`);
  return aff;
}

function parseRule(aff, kind, f) {
  const strip = f[2] === '0' ? '' : f[2];
  const slash = indexOfUnescaped(f[3], '/');
  const addRaw = slash < 0 ? f[3] : f[3].slice(0, slash);
  const add = addRaw === '0' ? '' : addRaw;
  const cont = slash < 0 ? [] : decodeFlags(aff.flagType, f[3].slice(slash + 1));
  const cond = f[4] ?? '.';
  return {
    strip, add, cont: new Set(cont),
    test: compileCondition(cond, kind === 'SFX'),
  };
}

function indexOfUnescaped(s, ch) {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue; }
    if (s[i] === ch) return i;
  }
  return -1;
}

export function decodeFlags(type, s) {
  if (s === '') return [];
  if (type === 'num') return s.split(',').filter(Boolean);
  const cps = [...s];
  if (type === 'char') return cps;
  const out = [];
  for (let i = 0; i < cps.length; i += 2) out.push(cps[i] + (cps[i + 1] ?? ''));
  return out;
}

/**
 * Hunspell conditions are a tiny regex dialect: literal characters, '.', and
 * bracket classes [abc] / [^abc] with no ranges. A suffix condition is tested
 * against the END of the stem before stripping, a prefix condition against
 * its start. Returns null for '.', which every stem satisfies.
 */
export function compileCondition(cond, isSuffix) {
  if (cond === '.') return null;
  let src = '';
  const cps = [...cond];
  for (let i = 0; i < cps.length; i++) {
    const c = cps[i];
    if (c === '[') {
      let j = i + 1;
      let neg = false;
      if (cps[j] === '^') { neg = true; j++; }
      let body = '';
      for (; j < cps.length && cps[j] !== ']'; j++) body += escapeInClass(cps[j]);
      if (j >= cps.length) throw new Error(`hunspell: unterminated class in condition ${cond}`);
      src += `[${neg ? '^' : ''}${body}]`;
      i = j;
    } else if (c === '.') {
      src += '.';
    } else {
      // '-' is NOT escaped here: under the u flag "\-" outside a class is a
      // syntax error (Danish has the condition "-")
      src += c.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&');
    }
  }
  const re = new RegExp(isSuffix ? `(?:${src})$` : `^(?:${src})`, 'u');
  return (s) => re.test(s);
}

function escapeInClass(c) {
  return /[\\\]^-]/.test(c) ? `\\${c}` : c;
}

/** One .dic entry per line after the count: word[/flags][ morphology...] */
export function parseDic(text, aff) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const entries = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith('#') || line.startsWith('\t')) continue;
    const token = line.split(/[ \t]/)[0];
    if (!token) continue;
    const slash = indexOfUnescaped(token, '/');
    const word = (slash < 0 ? token : token.slice(0, slash)).replace(/\\\//g, '/');
    const flags = slash < 0 ? [] : decodeFlags(aff.flagType, token.slice(slash + 1));
    if (word) entries.push({ word, flags: new Set(flags) });
  }
  return entries;
}

function applySfx(rule, stem, fullStrip) {
  if (rule.strip && !stem.endsWith(rule.strip)) return null;
  if (!fullStrip && rule.strip.length >= stem.length) return null;
  if (rule.test && !rule.test(stem)) return null;
  return stem.slice(0, stem.length - rule.strip.length) + rule.add;
}

function applyPfx(rule, stem, fullStrip) {
  if (rule.strip && !stem.startsWith(rule.strip)) return null;
  if (!fullStrip && rule.strip.length >= stem.length) return null;
  if (rule.test && !rule.test(stem)) return null;
  return rule.add + stem.slice(rule.strip.length);
}

/** The FORBIDDENWORD entries: exact spellings Hunspell rejects. */
export function collectForbidden(aff, entries) {
  const out = new Set();
  if (aff.forbidden === null) return out;
  for (const { word, flags } of entries) if (flags.has(aff.forbidden)) out.add(word);
  return out;
}

/**
 * Calls emit(form) for every standalone form of every entry, OCONV applied.
 *
 * A forbidden spelling is never emitted, even when another stem's affixes
 * generate it - but only that exact spelling. Checked against real Hunspell
 * 1.7 (WebAssembly) on nl_NL: "aankappen/Fw" makes aankappen false while
 * aankappende (aan + kappen + de) stays true. Pass `forbidden` when
 * expanding entry by entry, so every call sees the whole dictionary's list.
 */
export function expand(aff, entries, emit, forbidden = collectForbidden(aff, entries)) {
  const { needAffix: NEED, forbidden: FORBID, onlyInCompound: ONLY, circumfix: CIRC, fullStrip } = aff;
  const out = (w) => {
    if (forbidden.has(w)) return;
    let s = w;
    for (const [a, b] of aff.oconv) s = s.split(a).join(b);
    emit(s);
  };
  const blocked = (cont) => (ONLY !== null && cont.has(ONLY));

  for (const { word, flags } of entries) {
    if (FORBID !== null && flags.has(FORBID)) continue;
    if (ONLY !== null && flags.has(ONLY)) continue;
    if (NEED === null || !flags.has(NEED)) out(word);

    // suffixes, and what may follow or precede them
    for (const flag of flags) {
      const sfx = aff.sfx.get(flag);
      if (!sfx) continue;
      for (const r1 of sfx.rules) {
        const f1 = applySfx(r1, word, fullStrip);
        if (f1 === null || blocked(r1.cont)) continue;
        const c1 = CIRC !== null && r1.cont.has(CIRC);
        if (!c1 && (NEED === null || !r1.cont.has(NEED))) out(f1);

        // two-level suffixes: classes named in the first suffix's continuation
        for (const flag2 of r1.cont) {
          const sfx2 = aff.sfx.get(flag2);
          if (!sfx2) continue;
          for (const r2 of sfx2.rules) {
            const f2 = applySfx(r2, f1, fullStrip);
            if (f2 === null || blocked(r2.cont)) continue;
            const c2 = c1 || (CIRC !== null && r2.cont.has(CIRC));
            if (!c2 && (NEED === null || !r2.cont.has(NEED))) out(f2);
            if (sfx.cross && sfx2.cross) withPrefixes(f2, flags, r1.cont, c2);
          }
        }
        if (sfx.cross) withPrefixes(f1, flags, r1.cont, c1);
      }
    }

    // prefixes alone, and suffixes a prefix's continuation allows
    for (const flag of flags) {
      const pfx = aff.pfx.get(flag);
      if (!pfx) continue;
      for (const rp of pfx.rules) {
        const fp = applyPfx(rp, word, fullStrip);
        if (fp === null || blocked(rp.cont)) continue;
        const cp = CIRC !== null && rp.cont.has(CIRC);
        if (!cp && (NEED === null || !rp.cont.has(NEED))) out(fp);
        if (!pfx.cross) continue;
        for (const flag2 of rp.cont) {
          const sfx = aff.sfx.get(flag2);
          if (!sfx || !sfx.cross || flags.has(flag2)) continue; // root's own suffixes: done above
          for (const r1 of sfx.rules) {
            const f1 = applySfx(r1, word, fullStrip);
            if (f1 === null || blocked(r1.cont)) continue;
            const c1 = CIRC !== null && r1.cont.has(CIRC);
            if (cp !== c1) continue;
            const both = applyPfx(rp, f1, fullStrip);
            if (both !== null) out(both);
          }
        }
      }
    }
  }
  return forbidden;

  // prefix + (suffixed form): the prefix may come from the root's flags or
  // from the suffix's continuation; circumfixes must pair up
  function withPrefixes(form, rootFlags, cont, circ) {
    for (const src of [rootFlags, cont]) {
      for (const flag of src) {
        if (src === cont && rootFlags.has(flag)) continue;
        const pfx = aff.pfx.get(flag);
        if (!pfx || !pfx.cross) continue;
        for (const rp of pfx.rules) {
          if (blocked(rp.cont)) continue;
          const cp = CIRC !== null && rp.cont.has(CIRC);
          if (cp !== circ) continue;
          const both = applyPfx(rp, form, fullStrip);
          if (both !== null) out(both);
        }
      }
    }
  }
}
