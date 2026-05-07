// DO NOT EDIT — This file is part of the contest's fixed infrastructure.
// The judge overwrites it from frozen/ on every scoring run.
// terminal.js -- Shared Terminal base class for all apps (NetHack, Hack, Rogue, Logo, BASIC).
// Provides a character-cell grid with optional DOM rendering.

// --- Color constants ---
export const CLR_BLACK = 0;
export const CLR_RED = 1;
export const CLR_GREEN = 2;
export const CLR_BROWN = 3;
export const CLR_BLUE = 4;
export const CLR_MAGENTA = 5;
export const CLR_CYAN = 6;
export const CLR_GRAY = 7;
export const NO_COLOR = 8;
export const CLR_ORANGE = 9;
export const CLR_BRIGHT_GREEN = 10;
export const CLR_YELLOW = 11;
export const CLR_BRIGHT_BLUE = 12;
export const CLR_BRIGHT_MAGENTA = 13;
export const CLR_BRIGHT_CYAN = 14;
export const CLR_WHITE = 15;

// --- Attribute constants ---
export const ATR_NONE = 0;
export const ATR_INVERSE = 1;
export const ATR_BOLD = 2;
export const ATR_UNDERLINE = 4;

// --- Highlight aliases ---
// HI_METAL, HI_WOOD, HI_GOLD, HI_ZAP moved to const.js (game-specific)

// --- DEC Special Graphics → Unicode ---
// VT100 alternate charset codes mapped to Unicode box-drawing / symbols.
// Used by display code to convert raw DEC chars to browser-renderable glyphs.
export const DEC_TO_UNICODE = {
    '`': '\u25c6', a: '\u2592', f: '\u00b0', g: '\u00b1',
    j: '\u2518', k: '\u2510', l: '\u250c', m: '\u2514', n: '\u253c',
    q: '\u2500', t: '\u251c', u: '\u2524', v: '\u2534', w: '\u252c',
    x: '\u2502', y: '\u2264', z: '\u2265', '|': '\u2260',
    o: '\u23ba', s: '\u23bd', '{': '\u03c0', '~': '\u00b7',
};

// CSS color strings for each color constant.
// See display.js DECISIONS.md #2 for color choices.
const COLOR_CSS = [
    '#555',    // 0  - CLR_BLACK (dark gray for visibility on black bg)
    '#a00',    // 1  - CLR_RED
    '#0a0',    // 2  - CLR_GREEN
    '#a50',    // 3  - CLR_BROWN
    '#00d',    // 4  - CLR_BLUE
    '#a0a',    // 5  - CLR_MAGENTA
    '#0aa',    // 6  - CLR_CYAN
    '#ccc',    // 7  - CLR_GRAY
    '#ccc',    // 8  - NO_COLOR (unused, defaults to gray)
    '#f80',    // 9  - CLR_ORANGE
    '#0f0',    // 10 - CLR_BRIGHT_GREEN
    '#ff0',    // 11 - CLR_YELLOW
    '#55f',    // 12 - CLR_BRIGHT_BLUE
    '#f5f',    // 13 - CLR_BRIGHT_MAGENTA
    '#0ff',    // 14 - CLR_BRIGHT_CYAN
    '#fff',    // 15 - CLR_WHITE
];

/**
 * Compute the optimal line-height for seamless box-drawing characters.
 *
 * Terminal box-drawing glyphs extend to the font's full cell height (usWinAscent +
 * usWinDescent), not the smaller typographic metrics. This function measures the
 * actual loaded font via the Canvas API and rounds down to a whole-pixel value.
 *
 * @param {number} fontSize - The font size in pixels (e.g. 16)
 * @param {string} fontFamily - The CSS font-family string
 * @returns {number} line-height as a unitless ratio (e.g. 1.125)
 */
function computeTerminalLineHeight(fontSize, fontFamily) {
    const DEFAULT_LINE_HEIGHT = 1.1875;
    if (typeof document === 'undefined') return DEFAULT_LINE_HEIGHT;
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = `${fontSize}px ${fontFamily}`;
        const metrics = ctx.measureText('|');
        if (metrics.fontBoundingBoxAscent != null &&
            metrics.fontBoundingBoxDescent != null) {
            const naturalHeight = metrics.fontBoundingBoxAscent
                                + metrics.fontBoundingBoxDescent;
            const naturalRatio = naturalHeight / fontSize;
            const wholePixelHeight = Math.floor(naturalRatio * fontSize);
            return Math.max(wholePixelHeight / fontSize, 1.0);
        }
    } catch (e) {
        // Canvas not available (e.g. Node.js tests)
    }
    return DEFAULT_LINE_HEIGHT;
}

/** Standard key binding presets for readKey(). */
export const KEY_BINDINGS = {
    /** NetHack/Hack/Rogue: arrows → vi keys (hjkl), shift+arrows → run (HJKL) */
    VI_KEYS: {
        ArrowUp: 'k', ArrowDown: 'j', ArrowLeft: 'h', ArrowRight: 'l',
        'Shift+ArrowUp': 'K', 'Shift+ArrowDown': 'J',
        'Shift+ArrowLeft': 'H', 'Shift+ArrowRight': 'L',
    },
    /** Line-editing: arrows → Ctrl codes for history and cursor movement */
    LINE_EDIT: {
        ArrowUp: 16,    // Ctrl-P (history prev)
        ArrowDown: 14,  // Ctrl-N (history next)
        ArrowLeft: 2,   // Ctrl-B (cursor left)
        ArrowRight: 6,  // Ctrl-F (cursor right)
    },
};

export class Terminal {
    /**
     * @param {string|null} containerId - DOM container id, or null/undefined for headless
     * @param {object} opts
     * @param {number} opts.rows - number of rows (default 24)
     * @param {number} opts.cols - number of columns (default 80)
     * @param {HTMLCanvasElement} opts.graphicsCanvas - optional canvas overlay
     */
    constructor(containerId, { rows = 24, cols = 80, graphicsCanvas } = {}) {
        this.rows = rows;
        this.cols = cols;

        // The character grid: [row][col] = {ch, color, attr}
        // attr: 0=normal, 1=inverse, 2=bold, 4=underline (can be OR'd)
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.grid[r][c] = { ch: ' ', color: CLR_GRAY, attr: 0 };
            }
        }

        // Cursor state
        this.cursorCol = 0;
        this.cursorRow = 0;
        this.cursorVisible = 1;

        // Focus point (stored for external use, e.g. scroll-into-view)
        this._focusCol = 0;
        this._focusRow = 0;

        // DOM elements (null when headless)
        this.spans = null;
        this._pre = null;
        this._canvas = graphicsCanvas || null;
        this._cursorSpan = null;
        this.container = null;

        // Optional flags object (NetHack sets this.flags = { color, use_darkgray, ... })
        // Simple apps leave it undefined.
        this.flags = undefined;

        if (containerId != null) {
            this._createDOM(containerId);
            this.installKeyboard(); // auto-install keyboard when DOM is present
        }
    }

    _createDOM(containerId) {
        this.container = typeof containerId === 'string'
            ? document.getElementById(containerId)
            : containerId;  // accept DOM element directly
        const pre = document.createElement('pre');
        pre.id = 'terminal';
        const fontFamily = '"DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Liberation Mono", monospace';
        const fontSize = parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue('--game-font-size')) || 16;
        const lineHeight = computeTerminalLineHeight(fontSize, fontFamily);
        pre.style.cssText = `
            font-family: ${fontFamily};
            font-size: ${fontSize}px;
            line-height: ${lineHeight};
            background: #000;
            color: #ccc;
            padding: 8px;
            margin: 0;
            display: inline-block;
            white-space: pre;
            cursor: default;
            user-select: none;
        `;

        // Create spans for each cell
        this.spans = [];
        for (let r = 0; r < this.rows; r++) {
            this.spans[r] = [];
            for (let c = 0; c < this.cols; c++) {
                const span = document.createElement('span');
                span.textContent = ' ';
                span.style.color = COLOR_CSS[CLR_GRAY];
                span.dataset.row = r;
                span.dataset.col = c;
                this.spans[r][c] = span;
                pre.appendChild(span);
            }
            if (r < this.rows - 1) {
                pre.appendChild(document.createTextNode('\n'));
            }
        }

        // CSS animation for blinking cursor
        const style = document.createElement('style');
        style.textContent = `
@keyframes terminal-cursor-blink {
  0%, 49% { box-shadow: inset 0 -3px 0 0 rgba(255,255,255,0.85); }
  50%, 100% { box-shadow: none; }
}
span.terminal-cursor {
  animation: terminal-cursor-blink 0.8s step-end infinite;
}
`;
        this.container.innerHTML = '';
        this.container.appendChild(style);
        this.container.appendChild(pre);
        this._pre = pre;
    }

    // --- Shell transition ---

    /** Capture the terminal <pre> HTML to localStorage for flash-free ^C transition.
     *  The shell's inline script reads this and renders it immediately before modules load. */
    captureForShell() {
        try {
            if (this._pre) {
                localStorage.setItem('shell_preload_html', this._pre.outerHTML);
            }
        } catch (e) { /* non-fatal */ }
    }

    // --- Keyboard Input ---
    // Unified async key input used by all apps (NetHack, Hack, Rogue, BASIC, Logo, Shell).
    // Keys are delivered as numeric char codes (Enter=13, Backspace=8, Ctrl-A=1, etc.)
    // The keyboard listener is optional — apps can also feed keys via pushKey().

    /**
     * Install the keyboard listener on the document (or a specific element).
     * Safe to call multiple times — only installs once.
     * @param {EventTarget} [target=document] - element to listen on
     */
    installKeyboard(target) {
        if (this._keyboardInstalled) return;
        this._keyTarget = target || (typeof document !== 'undefined' ? document : null);
        if (!this._keyTarget) return;
        this._keyHandler = (e) => this._onKeyDown(e);
        this._keyTarget.addEventListener('keydown', this._keyHandler);
        this._keyboardInstalled = true;
    }

    /** Remove the keyboard listener. */
    uninstallKeyboard() {
        if (!this._keyboardInstalled) return;
        this._keyTarget.removeEventListener('keydown', this._keyHandler);
        this._keyboardInstalled = false;
    }

    /**
     * Read one key asynchronously. Returns a numeric char code.
     * If the queue has keys, returns immediately. Otherwise waits.
     *
     * All options are per-call (no stateful properties to manage):
     *
     * @param {Object} [options] - options for this read
     * @param {Object} [options.bindings] - key bindings overriding default
     *   ANSI sequences. Keys are event.key names, values are char codes or
     *   single-char strings. Use KEY_BINDINGS.VI_KEYS or KEY_BINDINGS.LINE_EDIT.
     * @param {Function} [options.keyMapper] - if set, receives the raw
     *   KeyboardEvent and returns a char code (or null). Bypasses bindings
     *   and default translation entirely.
     * @param {Function} [options.onInterrupt] - Ctrl-C handler for this read.
     * @param {Function} [options.onEmptyQueue] - called when queue is empty.
     *   Can throw (end of replay), return a code (default key), or return
     *   null/undefined (wait as usual).
     * @returns {Promise<number>}
     */
    readKey(options) {
        this._activeOptions = options || null;
        // Increment epoch on every readKey call — the parity debugger
        // uses this to detect that the game consumed a key and is
        // ready for the next one, regardless of whether it waited.
        this._waitEpoch = (this._waitEpoch || 0) + 1;
        if (!this._inputQueue) this._inputQueue = [];
        if (this._inputQueue.length > 0) {
            return Promise.resolve(this._inputQueue.shift());
        }
        const onEmpty = options?.onEmptyQueue;
        if (onEmpty) {
            const result = onEmpty();
            if (result !== undefined && result !== null) {
                return Promise.resolve(result);
            }
        }
        return new Promise((resolve) => {
            this._inputResolver = resolve;
        });
    }

    /**
     * Push a key into the input queue (for programmatic/test input).
     * If readKey() is waiting, resolves it immediately.
     * @param {number} code - char code
     */
    pushKey(code) {
        if (!this._inputQueue) this._inputQueue = [];
        if (this._inputResolver) {
            const resolve = this._inputResolver;
            this._inputResolver = null;
            resolve(code);
        } else {
            this._inputQueue.push(code);
        }
    }

    /** Clear the input queue. */
    clearInputQueue() {
        this._inputQueue = [];
    }

    /** True when readKey() is blocked waiting for input. */
    get isWaitingForInput() {
        return !!this._inputResolver;
    }

    /** Monotonically increasing counter — increments each time readKey() enters a wait.
     *  Used by the parity debugger to detect when the game has processed a key
     *  and is ready for the next one (avoids race with isWaitingForInput). */
    get waitEpoch() {
        return this._waitEpoch || 0;
    }

    /** Number of keys queued but not yet consumed. */
    get inputQueueLength() {
        return this._inputQueue ? this._inputQueue.length : 0;
    }


    /** @private Handle a keydown event — translate to char code and deliver. */
    _onKeyDown(e) {
        let code = null;
        const opts = this._activeOptions;

        // Ctrl-C: fire interrupt handler from active readKey options
        if (e.ctrlKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            if (opts?.onInterrupt) opts.onInterrupt();
            return;
        }

        // Check keyMapper from active readKey options
        if (opts?.keyMapper) {
            const mapped = opts.keyMapper(e);
            if (mapped !== null && mapped !== undefined) {
                e.preventDefault();
                this.pushKey(mapped);
            }
            return;
        }

        // Check bindings from active readKey options
        const bindings = opts?.bindings;
        if (bindings) {
            // Build lookup key: "Shift+ArrowUp", "Ctrl+a", or just "ArrowUp"
            let bindKey = e.key;
            if (e.shiftKey && e.key.startsWith('Arrow')) bindKey = 'Shift+' + e.key;

            if (bindKey in bindings) {
                const bound = bindings[bindKey];
                code = typeof bound === 'string' ? bound.charCodeAt(0) : bound;
                e.preventDefault();
                this.pushKey(code);
                return;
            }
        }

        // Ctrl+letter → control codes (Ctrl-A=1 ... Ctrl-Z=26)
        if (e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
            const c = e.key.toLowerCase().charCodeAt(0);
            if (c >= 97 && c <= 122) {
                code = c - 96;
                e.preventDefault();
            }
        } else if (!e.ctrlKey && !e.altKey && !e.metaKey) {
            switch (e.key) {
            case 'Enter':     code = 13; break;
            case 'Backspace': code = 8; e.preventDefault(); break;
            case 'Delete':    code = 127; break;
            case 'Escape':    code = 27; e.preventDefault(); break;
            case 'Tab':       code = 9; e.preventDefault(); break;
            // Arrow keys: default ANSI escape sequences (ESC [ A/B/C/D)
            case 'ArrowUp':    this.pushKey(27); this.pushKey(91); code = 65; e.preventDefault(); break;
            case 'ArrowDown':  this.pushKey(27); this.pushKey(91); code = 66; e.preventDefault(); break;
            case 'ArrowRight': this.pushKey(27); this.pushKey(91); code = 67; e.preventDefault(); break;
            case 'ArrowLeft':  this.pushKey(27); this.pushKey(91); code = 68; e.preventDefault(); break;
            default:
                if (e.key.length === 1) code = e.key.charCodeAt(0);
                break;
            }
        }

        if (code !== null) this.pushKey(code);
    }

    // --- Color utilities ---

    /** Convert a color value (integer CLR_* constant or CSS string) to a CSS color. */
    colorToCss(color) {
        if (typeof color === 'string') return color;
        return COLOR_CSS[color] || COLOR_CSS[CLR_GRAY];
    }

    // --- Cell operations ---

    /**
     * Set a character at terminal position (col, row) with color and attributes.
     * color: integer CLR_* constant (0-15) or CSS color string.
     * attr: 0=normal, 1=inverse, 2=bold, 4=underline (can be OR'd together).
     */
    setCell(col, row, ch, color, attr = 0) {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;

        // Store raw color in grid — no normalization here.
        // Color mapping (CLR_BLACK → dark gray, color off → gray) happens
        // only at DOM rendering time (colorToCss), not in the grid data.
        const cell = this.grid[row][col];
        if (cell.ch === ch && cell.color === color && cell.attr === attr) return;
        cell.ch = ch;
        cell.color = color;
        cell.attr = attr;

        if (!this.spans) return;

        const span = this.spans[row][col];
        span.textContent = ch;
        const css = this.colorToCss(color);

        const isInverse = (attr & ATR_INVERSE) !== 0;
        const isBold = (attr & ATR_BOLD) !== 0;
        const isUnderline = (attr & ATR_UNDERLINE) !== 0;

        if (isInverse) {
            span.style.color = '#000';
            span.style.backgroundColor = css;
        } else {
            span.style.color = css;
            span.style.backgroundColor = '';
        }

        span.style.fontWeight = isBold ? 'bold' : '';
        span.style.textDecoration = isUnderline ? 'underline' : '';
    }

    /** Clear a row to spaces with CLR_GRAY. */
    clearRow(row) {
        for (let c = 0; c < this.cols; c++) {
            this.setCell(c, row, ' ', CLR_GRAY);
        }
    }

    /** Write a string at position (col, row) with optional color and attributes. */
    putstr(col, row, str, color = CLR_GRAY, attr = 0) {
        for (let i = 0; i < str.length && col + i < this.cols; i++) {
            this.setCell(col + i, row, str[i], color, attr);
        }
    }

    /** Clear the entire screen. */
    clearScreen() {
        for (let r = 0; r < this.rows; r++) {
            this.clearRow(r);
        }
        this.setCursor(0, 0);
    }

    // --- Cursor ---

    /** Move the visible cursor to (col, row). 0-based. */
    setCursor(col, row) {
        if (this._cursorSpan) {
            this._cursorSpan.classList.remove('terminal-cursor');
            this._cursorSpan = null;
        }
        this.cursorCol = col;
        this.cursorRow = row;
        if (this.cursorVisible
            && row >= 0 && row < this.rows && col >= 0 && col < this.cols
            && this.spans && this.spans[row] && this.spans[row][col]) {
            this._cursorSpan = this.spans[row][col];
            this._cursorSpan.classList.add('terminal-cursor');
        }
    }

    /** Return [col, row, visible]. */
    getCursor() {
        return [this.cursorCol, this.cursorRow, this.cursorVisible];
    }

    /** Set cursor visibility (truthy = visible). */
    cursSet(visibility) {
        this.cursorVisible = visibility ? 1 : 0;
        if (this._cursorSpan) {
            if (!this.cursorVisible) {
                this._cursorSpan.classList.remove('terminal-cursor');
            } else {
                this._cursorSpan.classList.add('terminal-cursor');
            }
        }
    }

    /** Flush pending output. (DOM writes are immediate, so this is a no-op.) */
    flush() {
        // Browser display is immediate through setCell/DOM writes.
    }

    // --- 1-based legacy wrappers (for curses-style apps) ---

    /** Move cursor to 1-based (x, y). */
    moveCursor(x, y) {
        this.setCursor(x - 1, y - 1);
    }

    /** Write character at 1-based (x, y) with attribute. */
    putChar(x, y, ch, attr = 0) {
        this.setCell(x - 1, y - 1, ch, CLR_GRAY, attr);
    }

    /** Read character at 1-based (x, y). Returns the ch string. */
    getChar(x, y) {
        const col = x - 1;
        const row = y - 1;
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return ' ';
        return this.grid[row][col].ch;
    }

    // --- Cursor-relative writing ---

    /** Write a string at the current cursor position, advancing the cursor. */
    putString(str) {
        for (let i = 0; i < str.length; i++) {
            this.putCharAtCursor(str[i]);
        }
    }

    /** Write a single character at the cursor and advance it one column. */
    putCharAtCursor(ch) {
        if (this.cursorRow >= 0 && this.cursorRow < this.rows
            && this.cursorCol >= 0 && this.cursorCol < this.cols) {
            this.setCell(this.cursorCol, this.cursorRow, ch, CLR_GRAY);
        }
        this.cursorCol++;
    }

    /** Clear from cursor to end of line. */
    clearToEol() {
        const row = this.cursorRow;
        if (row < 0 || row >= this.rows) return;
        for (let c = this.cursorCol; c < this.cols; c++) {
            this.setCell(c, row, ' ', CLR_GRAY);
        }
    }

    /** Scroll all rows up by one; clear the bottom row. */
    scrollUp() {
        // Shift grid data up
        for (let r = 0; r < this.rows - 1; r++) {
            for (let c = 0; c < this.cols; c++) {
                const src = this.grid[r + 1][c];
                this.grid[r][c].ch = src.ch;
                this.grid[r][c].color = src.color;
                this.grid[r][c].attr = src.attr;
            }
        }
        // Clear bottom row
        for (let c = 0; c < this.cols; c++) {
            const cell = this.grid[this.rows - 1][c];
            cell.ch = ' ';
            cell.color = CLR_GRAY;
            cell.attr = 0;
        }
        // Repaint spans if present
        if (this.spans) {
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const cell = this.grid[r][c];
                    const span = this.spans[r][c];
                    span.textContent = cell.ch;
                    const css = this.colorToCss(cell.color);
                    const isInverse = (cell.attr & ATR_INVERSE) !== 0;
                    if (isInverse) {
                        span.style.color = '#000';
                        span.style.backgroundColor = css;
                    } else {
                        span.style.color = css;
                        span.style.backgroundColor = '';
                    }
                    span.style.fontWeight = (cell.attr & ATR_BOLD) ? 'bold' : '';
                    span.style.textDecoration = (cell.attr & ATR_UNDERLINE) ? 'underline' : '';
                }
            }
        }
    }

    // --- Accessors ---

    /** Return the <pre> DOM element (or null if headless). */
    getPreElement() {
        return this._pre;
    }

    /** Return the graphics canvas (or null). */
    getCanvas() {
        return this._canvas;
    }

    /** Store a focus point for external scroll-into-view logic. */
    setFocusPoint(col, row) {
        this._focusCol = col;
        this._focusRow = row;
    }

    /**
     * Serialize the visible terminal grid to a single string, in a form
     * comparable to a tty's wire output: rows separated by newlines,
     * leading whitespace compressed to "\x1b[NC" (cursor-forward) when
     * runs exceed 4, trailing empty cells dropped, trailing empty rows
     * dropped. This is the contest fixture for screen scoring — judges
     * compare exactly this string against the C-recorded screen for
     * each input boundary.
     */
    serialize() {
        // Map NetHack color (0..15) to ANSI fg code. NO_COLOR (8) → 39 (default).
        const colorToFg = (color) => {
            if (color === 8 || color < 0 || color > 15) return 39;
            return color < 8 ? 30 + color : 90 + (color - 8);
        };
        // Build the SGR sequence to transition from (curFg, curAttr) to
        // (wantFg, wantAttr). Returns '' if no transition is needed.
        const sgrTransition = (curFg, curAttr, wantFg, wantAttr) => {
            if (curFg === wantFg && curAttr === wantAttr) return '';
            const wantBold = (wantAttr & 2) !== 0;
            const wantUnder = (wantAttr & 4) !== 0;
            const wantInv = (wantAttr & 1) !== 0;
            const curBold = (curAttr & 2) !== 0;
            const curUnder = (curAttr & 4) !== 0;
            const curInv = (curAttr & 1) !== 0;
            // If any attribute needs to clear, we need a full reset.
            const needReset = (curBold && !wantBold) || (curUnder && !wantUnder) || (curInv && !wantInv);
            const codes = [];
            if (needReset) {
                codes.push(0);
                if (wantBold) codes.push(1);
                if (wantUnder) codes.push(4);
                if (wantInv) codes.push(7);
                if (wantFg !== 39) codes.push(wantFg);
            } else {
                if (wantBold && !curBold) codes.push(1);
                if (wantUnder && !curUnder) codes.push(4);
                if (wantInv && !curInv) codes.push(7);
                if (wantFg !== curFg) codes.push(wantFg);
            }
            return codes.length ? `\x1b[${codes.join(';')}m` : '';
        };
        let lastRow = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].ch !== ' ') { lastRow = r; break; }
            }
        }
        let out = '';
        let curFg = 39, curAttr = 0;
        for (let r = 0; r <= lastRow; r++) {
            let lastCol = -1;
            for (let c = this.cols - 1; c >= 0; c--) {
                if (this.grid[r][c].ch !== ' ') { lastCol = c; break; }
            }
            if (lastCol < 0) { if (r < lastRow) out += '\n'; continue; }
            let firstCol = 0;
            for (let c = 0; c <= lastCol; c++) {
                if (this.grid[r][c].ch !== ' ') { firstCol = c; break; }
            }
            if (firstCol > 4) out += `\x1b[${firstCol}C`;
            else if (firstCol > 0) out += ' '.repeat(firstCol);
            for (let c = firstCol; c <= lastCol; c++) {
                const cell = this.grid[r][c];
                const wantFg = colorToFg(cell.color);
                const wantAttr = cell.attr | 0;
                out += sgrTransition(curFg, curAttr, wantFg, wantAttr);
                curFg = wantFg;
                curAttr = wantAttr;
                out += cell.ch;
            }
            // Reset to default at end of line so the cursor-forward escape
            // on the next row doesn't carry forward the previous row's color.
            out += sgrTransition(curFg, curAttr, 39, 0);
            curFg = 39;
            curAttr = 0;
            if (r < lastRow) out += '\n';
        }
        return out;
    }
}

/**
 * HeadlessTerminal -- Terminal with no DOM.
 * Screen capture methods will be added later via screen_capture.js.
 */
export class HeadlessTerminal extends Terminal {
    constructor(opts) {
        super(null, opts);
    }
}
