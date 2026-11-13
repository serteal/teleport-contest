// rt/cmacros.js: C macros that cannot be ordinary emitted functions (they look at types).

/** SIZE(arr): number of elements of an array (JS Array or typed array). */
export function SIZE(a) { return a.length; }
