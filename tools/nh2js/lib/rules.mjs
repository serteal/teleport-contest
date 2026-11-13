// lib/rules.mjs: the rule registry and per-rule instance log.
//
// Every AST node the printer emits must be claimed by a rule (strict whitelist): the printer
// calls claim(ruleId, node) for each node it handles, and a node nobody claims makes the
// function fall back (or, in fallback mode, makes it unemittable). Each claim is logged with
// its site, so rarely exercised rules can be audited (report: rule id -> count and sites).

export const RULES = {
  // ---- identity rules (the C text is valid JS with the same meaning) ----
  "id.paren": "parenthesised expression",
  "id.binop": "binary operator whose JS semantics equal C's for these operand types",
  "id.unop": "unary operator with C semantics in JS (!, -, +, ~ on int)",
  "id.incdec": "++/-- on a number lvalue",
  "id.assign": "scalar assignment (heap stores truncate like C conversion)",
  "id.compound-assign": "compound assignment with C semantics in JS",
  "id.cond": "conditional operator",
  "id.comma": "comma operator",
  "id.call": "function call",
  "id.subscript": "subscript of a JS Array / typed array",
  "id.member": "member of a struct value (.)",
  "id.int-literal": "decimal/hex integer literal",
  "id.float-literal": "floating literal",
  "id.var": "local variable or parameter",
  "id.enum": "enumeration constant",
  "id.function": "function name",
  "id.global": "global struct/array (heap object bound by name)",
  "id.stmt":
    "statement whose syntax is the same in JS (if/while/do/for/switch/case/default/break/continue/return/null)",
  "id.init-list": "brace initializer becomes a positional array ({ } -> [ ]), spliced when its braces are written",
  "id.init-record":
    "brace initializer of a struct/union becomes a named-field record { field: value } (fields in order, no index)",
  "id.compound": "compound statement",
  "id.expr-stmt": "expression statement",
  "cast.transparent": "conversion that does not change the JS value (lvalue-to-rvalue, widening, no-op)",
  // ---- token edits ----
  "edit.arrow": "p->f becomes p.f (struct pointers are views)",
  "edit.int-literal-inexact":
    "integer literal beyond 2^53 outside a BigInt context (LLONG_MAX sentinels): the nearest Number",
  "edit.int-suffix": "integer literal suffix dropped / octal rewritten",
  "edit.char-literal": "'c' becomes ord('c')",
  "edit.string-literal": 'string literal used as char * becomes _("...")',
  "edit.string-concat": "adjacent string literals joined with +",
  "edit.null": "null pointer constant becomes null (views, refs, functions)",
  "edit.null-addr": "null pointer constant stays 0 (addresses)",
  "edit.cast-drop": "explicit cast with no effect on the JS value is dropped",
  "edit.cast-void": "(void) e becomes void e; as a statement (value discarded) just e",
  "edit.cast-int": "explicit integer conversion becomes T(e)",
  "edit.cast-float-to-int": "float to integer conversion becomes T(e)",
  "edit.cast-view": "pointer cast to a struct pointer becomes view(S, e)",
  "edit.cast-addr": "pointer cast to an address becomes addr(e)",
  "edit.cast-int-to-ptr": "integer cast to a pointer: the address (unsigned), as a view/ref/function of that address",
  "edit.cast-ptr-to-int": "pointer cast to an integer: its address (addr_of / fn_index)",
  "edit.cast-ref": "pointer cast to a scalar pointer becomes ref(T, e)",
  "edit.decay-struct-array": "struct array decaying to a pointer becomes a[0]",
  "edit.deref-view": "*p of a struct pointer is the view p",
  "edit.deref-byte": "*p of a char pointer becomes chars[p] / uchars[p]",
  "edit.deref-ref": "*p of a scalar pointer becomes p[0]",
  "edit.deref-fn": "(*fp) of a function pointer is fp",
  "edit.addr-view": "&s of a struct lvalue is its view",
  "edit.addr-stack": "&x of a memory-resident local is its ref",
  "edit.addr-byte-elem": "&buf[i] of a char array becomes buf + i",
  "edit.addr-ref-elem": "&a[i] of a scalar array becomes a.subarray(i)",
  "edit.addr-field": '&p->f of a scalar field becomes ref_of(p, "f")',
  "edit.addr-function": "&f of a function is f",
  "edit.byte-subscript": "s[i] of a char pointer/array becomes chars[s + i]",
  "edit.view-subscript": "p[i] of a struct pointer becomes ptr_add(p, i)",
  "edit.ptr-add-view": "struct pointer arithmetic becomes ptr_add(p, n)",
  "edit.ptr-diff-view": "struct pointer difference becomes ptr_diff(p, q)",
  "edit.ptr-add-ref": "scalar pointer arithmetic becomes p.subarray(n)",
  "edit.ptr-diff-ref": "scalar pointer difference becomes the address difference over the element size",
  "edit.ptr-cmp-ref": "scalar pointer comparison compares addresses",
  "edit.int-div": "integer division becomes Math.trunc(a / b)",
  "edit.int-div-assign": "x /= y on an integer becomes x = Math.trunc(x / y)",
  "edit.unsigned-wrap": "unsigned 32-bit arithmetic result wrapped with unsigned()",
  "edit.ushr": "unsigned >> becomes >>>",
  "edit.narrow": "implicit narrowing conversion that may change the value becomes T(e)",
  "edit.assign-value-narrow": "value of an assignment to a narrower lvalue is wrapped",
  "edit.op64": "bit operation on 64-bit operands becomes and64/or64/...",
  "edit.exact64": "a full-range 64-bit seed variable (lib/exact64.mjs list) is a BigInt like uint64_t",
  "edit.op64-assign": "compound bit assignment on 64-bit operands",
  "edit.bool-context-64": "64-bit bit operation used only for its truth value stays a JS operator",
  "edit.struct-elt":
    "an element of an array of structs at an index not provably in range becomes elt(a, i) (the view at that address)",
  "edit.bool-value":
    "a C truth value (comparison, !, && / ||, conversion to bool) used as a number becomes 0/1: +(a < b), (x ? 1 : 0)",
  "edit.struct-assign": "struct assignment becomes assign(a, b)",
  "edit.struct-arg": "struct passed by value is copied: struct_copy(s)",
  "edit.sizeof": "sizeof becomes sizeof(T) / the declared extent",
  "edit.offsetof": "offsetof(S, f)",
  "edit.file-name":
    "__FILE__ becomes the module constant __FILE__ (the C file name as compiled); " +
    "a kept macro using it takes it as a last argument",
  "edit.line-number":
    "__LINE__ (a position, never written into js/) becomes 0: " +
    "its users only print it in messages of impossible conditions",
  "edit.func-name": "__func__ becomes the function name literal",
  "edit.member-macro": "member name spelled through a macro is printed expanded",
  "edit.return-paren": "return whose expression starts on a later line gets a ( on the return line (no ASI)",
  "edit.fallthrough": "FALLTHROUGH attribute becomes a comment",
  "edit.stack-var": "use of a memory-resident local or static scalar becomes x[0]",
  "edit.reserved-name": "C identifier that is reserved or taken in JS gets a trailing _",
  // ---- declarations ----
  "decl.let": "local declaration becomes let",
  "decl.stack-var": "address-taken local becomes stack_var(T, init)",
  "decl.stack-array": "local array becomes stack_array(T, n)",
  "decl.stack-struct": "local struct becomes stack_struct(S)",
  "decl.static-local": "static local becomes static_var/static_array/static_struct (heap-resident)",
  "decl.init-list": "brace initializer of a memory-resident local",
  "decl.string-init": "char array initialised from a string literal",
  "decl.local-type": "struct/union/enum declared in a block: a function-local record class / constants on its lines",
  "decl.drop": "declaration with no JS counterpart (prototype, extern) dropped",
  "decl.hoisted-static":
    "static local of a goto-dispatched function: declared at function start (a goto may enter its block past it)",
  "decl.hoisted-alloc":
    "memory-resident local of a goto-dispatched function: " +
    "allocated at function start (a goto may enter its block), initialised at its line",
  "decl.shadow-rename":
    "in a function with var locals (gotos), a block local shadowing an enclosing one gets its own name (x$2)",
  "decl.switch-var": "declaration directly in a switch body becomes var",
  "decl.param-boxed": "address-taken parameter copied to the stack",
  "fn.header": "function header (export, name, parameters; return type kept as a comment)",
  "fn.frame": "function with memory-resident locals opens/closes a stack frame",
  "fn.setjmp":
    "if (setjmp(env)) ...: the rest of the block becomes a loop " +
    "re-entered with the value a longjmp to env passed (try/catch)",
  "fn.variadic": "variadic function takes ...args",
  // ---- control flow ----
  "goto.forward": "forward goto to a label in an enclosing block becomes break out of a labeled block",
  "goto.backward": "backward goto becomes continue of a labeled loop",
  "goto.reentry":
    "statement on the way to a nested label: entered through its condition ($goto short-circuits it), " +
    "or a break/continue retargeted past the dispatcher",
  "goto.dispatch":
    "label reached as a case of a dispatch switch over $goto; goto sets $goto and continues the dispatch loop",
  "goto.unused-label": "label no goto refers to is dropped",
  // ---- macros ----
  "macro.call": "function-like macro invocation kept as a call to the same-named JS function",
  "macro.const": "object-like constant macro kept as the same-named JS constant",
  "macro.value": "object-like expression macro kept as NAME()",
  "macro.alias": "object-like macro naming a function kept as the same-named alias",
  "macro.expand": "macro expanded in place (not callable: lvalue, side effects, control flow, types)",
  "macro.expand-stmts": "statement-list macro expanded in place",
  // ---- fallback printer ----
  "fallback.function": "function emitted by the plain AST printer",
};

export class RuleLog {
  constructor() { this.counts = new Map(); this.sites = new Map(); this.all = new Map(); }
  add(id, site, fn) {
    if (!(id in RULES)) throw new Error(`rule ${id} is not registered`);
    // every site (uncapped, for the rule audit: --sites)
    if (site) {
      let a = this.all.get(id);
      if (!a) this.all.set(id, (a = []));
      const i = site.lastIndexOf(":");
      a.push([site.slice(0, i), +site.slice(i + 1), fn || null]);
    }
    this.counts.set(id, (this.counts.get(id) || 0) + 1);
    let s = this.sites.get(id);
    if (!s) this.sites.set(id, (s = []));
    if (s.length < 25 && site && s[s.length - 1] !== site) s.push(site);
  }
  merge(o) {
    for (const [k, v] of o.all) {
      let a = this.all.get(k);
      if (!a) this.all.set(k, (a = []));
      for (const x of v) a.push(x);
    }
    for (const [k, v] of o.counts) this.counts.set(k, (this.counts.get(k) || 0) + v);
    for (const [k, v] of o.sites) {
      let s = this.sites.get(k);
      if (!s) this.sites.set(k, (s = []));
      for (const x of v) if (s.length < 25) s.push(x);
    }
  }
  /** {rule: [[file, line, function], ...]} with every site. */
  allSites() { return Object.fromEntries([...this.all].sort((a, b) => (a[0] < b[0] ? -1 : 1))); }
  toJSON() {
    const out = {};
    for (const id of Object.keys(RULES)) {
      const c = this.counts.get(id) || 0;
      out[id] = { count: c, about: RULES[id], sites: this.sites.get(id) || [] };
    }
    return out;
  }
}

export class Unclaimed extends Error {}
export class NoSplice extends Error {}
export class Unsupported extends Error {}
