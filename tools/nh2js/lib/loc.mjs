// lib/loc.mjs: source-location algebra over the front end's macro-aware locations.
//
// A *context* is a piece of source text the printer splices from:
//   {kind: "file", f}            a file (the C file being emitted, or a header)
//   {kind: "body", x, f}         the #define body of macro invocation x (def text in file f)
// posIn(loc, ctx) maps a node location to an offset in that context's text (or null when the
// token is not written there, e.g. it comes from inside a macro definition).

export const fileCtx = (f) => ({ kind: "file", f });
export const bodyCtx = (x, f) => ({ kind: "body", x, f });

/** Offset of loc in ctx, or null. Begin and end locs are handled alike (end locs already point past the token). */
export function posIn(L, ctx) {
  for (let guard = 0; L && guard < 64; guard++) {
    if (L.f !== undefined) return ctx.kind === "file" && L.f === ctx.f ? L.o : null;
    if (L.a === 0) {
      if (ctx.kind === "body" && L.x === ctx.x) return L.do;
      if (!L.s) return null;
      L = L.up;
      continue;
    }
    // macro argument token: prefer where it is spelled, else the parameter-use site
    const viaSpelling = posIn(L.sp, ctx);
    if (viaSpelling !== null) return viaSpelling;
    if (!L.s) return null;
    L = L.up;
  }
  return null;
}

/** Offset of loc in ctx climbing out of macro expansions regardless of position (the site). */
export function siteIn(L, ctx, isEnd, inv) {
  for (let guard = 0; L && guard < 64; guard++) {
    if (L.f !== undefined) return ctx.kind === "file" && L.f === ctx.f ? L.o : null;
    if (L.a === 0) {
      if (ctx.kind === "body" && L.x === ctx.x) return L.do;
      // climb to the invocation (begin or end of the whole invocation)
      const iv = inv.get(L.x);
      L = iv ? (isEnd ? iv.e : iv.b) : L.up;
      continue;
    }
    const viaSpelling = posIn(L.sp, ctx);
    if (viaSpelling !== null) return viaSpelling;
    L = L.up;
  }
  return null;
}

/**
 * All ways a loc reaches ctx text: [{pos, path}], path = the argument instances (pu) entered
 * through their spelling. Body levels are climbed only at their start/end.
 */
function routes(L, ctx, path, out, depth = 0) {
  if (!L || depth > 64) return out;
  if (L.f !== undefined) { if (ctx.kind === "file" && L.f === ctx.f) out.push({ pos: L.o, path }); return out; }
  if (L.a === 0) {
    if (ctx.kind === "body" && L.x === ctx.x) { out.push({ pos: L.do, path }); return out; }
    if (L.s) routes(L.up, ctx, path, out, depth + 1);
    return out;
  }
  routes(L.sp, ctx, path + "/" + L.pu, out, depth + 1);
  if (L.s) routes(L.up, ctx, path, out, depth + 1);
  return out;
}

/** [begin, end) of node n in ctx, or null. Both ends must reach ctx through the same arguments. */
export function rangeIn(n, ctx) {
  if (!n || !n.b || !n.e) return null;
  if (n._ranges && n._ranges.has(ctx)) return n._ranges.get(ctx);
  const B = routes(n.b, ctx, "", []), E = routes(n.e, ctx, "", []);
  let best = null;
  for (const b of B) for (const e of E) {
    if (b.path !== e.path || e.pos < b.pos) continue;
    if (!best || b.path.length > best.len) best = { r: [b.pos, e.pos], len: b.path.length };
  }
  const r = best ? best.r : null;
  (n._ranges ||= new Map()).set(ctx, r);
  return r;
}

/** Site range of node n in ctx: the smallest span of ctx text whose expansion contains n. */
export function siteRangeIn(n, ctx, inv) {
  if (!n || !n.b || !n.e) return null;
  const b = siteIn(n.b, ctx, false, inv), e = siteIn(n.e, ctx, true, inv);
  if (b === null || e === null || e < b) return null;
  return [b, e];
}

/**
 * Macro invocations x for which n's tokens are exactly x's whole expansion: the begin loc is at
 * the start and the end loc at the end of every level up to x. Returned innermost first.
 */
export function exactInvocations(n) {
  const starts = climbAt(n.b), ends = climbAt(n.e);
  const endSet = new Set(ends);
  return starts.filter((x) => endSet.has(x));
}

function climbAt(L, depth = 0) {
  const out = [];
  for (let guard = 0; L && L.f === undefined && guard < 64; guard++) {
    // a token of a macro argument: the macros that spelled it (NO_COLOR passed to A(...)) are
    // inner, whether or not the token starts/ends the argument
    if (L.a === 1 && L.sp && depth < 16) out.push(...climbAt(L.sp, depth + 1));
    if (!L.s) break;
    if (L.a === 0) out.push(L.x);
    L = L.up;
  }
  return out;
}

/**
 * If n is exactly one argument instance of macro invocation x (its tokens are the whole
 * argument as substituted at one parameter use), return that param-use id; else null.
 * The argument may have reached n through inner macros (an argument of x passed on as an
 * argument of an inner macro): follow the spelling side through those levels.
 */
export function argInstanceOf(n, x) {
  const b = argLevel(n.b, x), e = argLevel(n.e, x);
  if (!b || !e || b.pu !== e.pu) return null;
  return b.pu;
}

function argLevel(L, x) {
  for (let guard = 0; L && guard < 32; guard++) {
    if (L.f !== undefined || L.a !== 1) return null;
    if (L.up && L.up.a === 0 && L.up.x === x) return L.s ? L : null;
    L = L.sp;
  }
  return null;
}

/** The arg-level loc of x inside L, if L comes from (part of) one of x's arguments. */
export function argLevelAny(L, x) {
  for (let guard = 0; L && guard < 32; guard++) {
    if (L.f !== undefined || L.a !== 1) return null;
    if (L.up && L.up.a === 0 && L.up.x === x) return L;
    L = L.sp;
  }
  return null;
}

/** Offset (in the #define text) of the parameter use for an argument-instance begin loc. */
export function paramUseOffset(n, x) { return argLevelAny(n.b, x).up.do; }

/** All expansion entry ids a loc lives in (any position), innermost first. */
export function enclosingInvocations(L) {
  const out = [];
  for (let guard = 0; L && L.f === undefined && guard < 64; guard++) {
    if (L.a === 0) out.push(L.x);
    L = L.up;
  }
  return out;
}

/** True when the loc is a plain file location (no macro involved). */
export const isFileLoc = (L) => L && L.f !== undefined;
