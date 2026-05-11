const ROWS = 24;
const COLS = 80;
const DEFAULT_FG = null;
const ATR_INVERSE = 1;
const ATR_BOLD = 2;
const ATR_UNDERLINE = 4;
const SPACE_VISIBLE_ATTRS = ATR_INVERSE | ATR_UNDERLINE;

const STARTUP_VARIANT_LINES = [/Version\s+\d+\.\d+\.\d+[^\n]*/g];

const DEC_TO_UNICODE = {
  "`": "\u25c6",
  a: "\u2592",
  f: "\u00b0",
  g: "\u00b1",
  j: "\u2518",
  k: "\u2510",
  l: "\u250c",
  m: "\u2514",
  n: "\u253c",
  q: "\u2500",
  t: "\u251c",
  u: "\u2524",
  v: "\u2534",
  w: "\u252c",
  x: "\u2502",
  y: "\u2264",
  z: "\u2265",
  "|": "\u2260",
  o: "\u23ba",
  s: "\u23bd",
  "{": "\u03c0",
  "~": "\u00b7",
};

function blankCell() {
  return { ch: " ", fg: DEFAULT_FG, attr: 0, decgfx: 0 };
}

function blankGrid() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, blankCell),
  );
}

function applySgr(params, state) {
  const parts = params === "" ? ["0"] : String(params).split(";");
  for (const part of parts) {
    const code = Number(part || 0);
    if (code === 0) {
      state.fg = DEFAULT_FG;
      state.attr = 0;
    } else if (code === 1) {
      state.attr |= ATR_BOLD;
    } else if (code === 4) {
      state.attr |= ATR_UNDERLINE;
    } else if (code === 7) {
      state.attr |= ATR_INVERSE;
    } else if (code === 22) {
      state.attr &= ~ATR_BOLD;
    } else if (code === 24) {
      state.attr &= ~ATR_UNDERLINE;
    } else if (code === 27) {
      state.attr &= ~ATR_INVERSE;
    } else if (code === 39) {
      state.fg = DEFAULT_FG;
    } else if (code >= 30 && code <= 37) {
      state.fg = code - 30;
    } else if (code >= 90 && code <= 97) {
      state.fg = code - 90 + 8;
    }
  }
}

function sgrForColor(color) {
  if (color >= 0 && color <= 7) return 30 + color;
  if (color >= 8 && color <= 15) return 90 + (color - 8);
  return 39;
}

function emitAttrChange(from, to) {
  let out = "";
  if (to & ATR_INVERSE && !(from & ATR_INVERSE)) out += "\x1b[7m";
  if (!(to & ATR_INVERSE) && from & ATR_INVERSE) out += "\x1b[27m";
  if (to & ATR_BOLD && !(from & ATR_BOLD)) out += "\x1b[1m";
  if (!(to & ATR_BOLD) && from & ATR_BOLD) out += "\x1b[22m";
  if (to & ATR_UNDERLINE && !(from & ATR_UNDERLINE)) out += "\x1b[4m";
  if (!(to & ATR_UNDERLINE) && from & ATR_UNDERLINE) out += "\x1b[24m";
  return out;
}

function renderedChar(cell) {
  return cell.decgfx ? DEC_TO_UNICODE[cell.ch] || cell.ch : cell.ch;
}

function normalizeCell(cell) {
  const ch = cell.ch || " ";
  const rendered = renderedChar({ ...cell, ch });
  if (rendered === " ") {
    const visibleAttr = cell.attr & SPACE_VISIBLE_ATTRS;
    return {
      ch: " ",
      fg: visibleAttr ? cell.fg : DEFAULT_FG,
      attr: visibleAttr,
      decgfx: 0,
    };
  }
  return {
    ch,
    fg: cell.fg,
    attr: cell.attr || 0,
    decgfx: cell.decgfx ? 1 : 0,
  };
}

function isNeutralBlank(cell) {
  return (
    cell.ch === " " && cell.fg === DEFAULT_FG && !cell.attr && !cell.decgfx
  );
}

function isCursorSkippableBlank(cell) {
  return cell.ch === " " && !(cell.attr & ATR_UNDERLINE);
}

export function normalizeTerminalVariants(screen) {
  let cur = String(screen || "");
  for (const re of STARTUP_VARIANT_LINES) {
    cur = cur.replace(re, "<<VERSION_BANNER>>");
  }
  return cur.replace(/^\d{2}:\d{2}:\d{2}\.$/gm, "<time>.");
}

export function decodeTerminalScreen(screen) {
  const grid = blankGrid();
  const state = { fg: DEFAULT_FG, attr: 0, decgfx: 0 };
  const text = String(screen || "");
  let row = 0;
  let col = 0;

  for (let i = 0; i < text.length; ) {
    const ch = text[i];
    if (ch === "\n") {
      row++;
      col = 0;
      i++;
      continue;
    }
    if (ch === "\r") {
      col = 0;
      i++;
      continue;
    }
    if (ch === "\x0e") {
      state.decgfx = 1;
      i++;
      continue;
    }
    if (ch === "\x0f") {
      state.decgfx = 0;
      i++;
      continue;
    }
    if (ch === "\x1b" && text[i + 1] === "[") {
      let j = i + 2;
      while (j < text.length && /[0-9;?]/.test(text[j])) j++;
      const params = text.slice(i + 2, j);
      const final = text[j];
      i = j + 1;
      if (final === "C") {
        col += Number(params) || 1;
      } else if (final === "m") {
        applySgr(params, state);
      }
      continue;
    }

    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
      grid[row][col] = {
        ch,
        fg: state.fg,
        attr: state.attr,
        decgfx: state.decgfx,
      };
    }
    col++;
    i++;
  }
  return grid;
}

export function serializeTerminalGrid(grid) {
  const rows = [];
  for (let row = 0; row < ROWS; row++) {
    const cells = Array.from({ length: COLS }, (_, col) =>
      normalizeCell(grid?.[row]?.[col] || blankCell()),
    );
    let end = COLS - 1;
    while (end >= 0 && isCursorSkippableBlank(cells[end])) end--;
    if (end < 0) {
      rows.push("");
      continue;
    }

    let out = "";
    let fg = DEFAULT_FG;
    let attr = 0;
    let decgfx = 0;

    for (let col = 0; col <= end; col++) {
      const cell = cells[col];
      if (isCursorSkippableBlank(cell)) {
        let run = 1;
        while (col + run <= end && isCursorSkippableBlank(cells[col + run])) {
          run++;
        }
        if (run >= 5) {
          out += `\x1b[${run}C`;
        } else {
          for (let offset = 0; offset < run; offset++) {
            const space = cells[col + offset];
            out += emitAttrChange(attr, space.attr);
            attr = space.attr;
            if (space.fg !== fg) {
              out +=
                space.fg === DEFAULT_FG
                  ? "\x1b[39m"
                  : `\x1b[${sgrForColor(space.fg)}m`;
              fg = space.fg;
            }
            if (decgfx) {
              out += "\x0f";
              decgfx = 0;
            }
            out += " ";
          }
        }
        col += run - 1;
        continue;
      }

      out += emitAttrChange(attr, cell.attr);
      attr = cell.attr;
      if (cell.fg !== fg) {
        out +=
          cell.fg === DEFAULT_FG ? "\x1b[39m" : `\x1b[${sgrForColor(cell.fg)}m`;
        fg = cell.fg;
      }
      if (cell.decgfx && !decgfx) {
        out += "\x0e";
        decgfx = 1;
      } else if (!cell.decgfx && decgfx) {
        out += "\x0f";
        decgfx = 0;
      }
      out += cell.ch;
    }

    if (decgfx) out += "\x0f";
    if (attr || fg !== DEFAULT_FG) out += attr ? "\x1b[0m" : "\x1b[39m";
    rows.push(out);
  }

  while (rows.length && rows[rows.length - 1] === "") rows.pop();
  return rows.join("\n");
}

export function canonicalizeTerminalScreen(screen, options = {}) {
  const text = options.stable
    ? normalizeTerminalVariants(screen)
    : String(screen || "");
  return serializeTerminalGrid(decodeTerminalScreen(text));
}
