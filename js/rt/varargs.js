// rt/varargs.js: variadic functions.
//
// A variadic C function is a JS function with a rest parameter (`function pline(line, ...args)`).
// va_list is a cursor over those arguments; va_arg takes the next one. A va_list passed on to
// the C library (vsnprintf) is laid out in memory from the format string by the C library's
// call glue (clib.call, tools/residue/glue.js).

class VaList {
  constructor(args) { this.args = args; this.i = 0; }
  next() { return this.args[this.i++]; }
  rest() { return this.args.slice(this.i); }
}

export function va_start(args) { return new VaList(args); }
export function va_arg(ap) { return ap.next(); }
export function va_end(ap) { /* nothing to release */ }
