import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { cacheRoot, jsOnlyProbeFlags, projectRoot } from "./c2js.config.mjs";
import { ensureToolchain, forbiddenRuntimeHooks, run } from "./common.mjs";

export function validateLinkedEngine(modulePath) {
  const linkDir = join(cacheRoot, "link");
  const wasmSidecars = readdirSync(linkDir).filter((entry) =>
    entry.endsWith(".wasm"),
  );
  if (wasmSidecars.length) {
    throw new Error(
      `link emitted forbidden wasm side file(s): ${wasmSidecars.join(", ")}`,
    );
  }

  const generated = readFileSync(modulePath, "utf8");
  const forbidden = forbiddenRuntimeHooks(generated);
  if (forbidden.length) {
    throw new Error(
      `engine output contains forbidden host hooks: ${forbidden.join(", ")}`,
    );
  }

  const smoke = run(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
globalThis.fetch = () => { throw new Error('fetch called'); };
globalThis.WebAssembly = new Proxy({}, { get() { throw new Error('real WebAssembly touched'); } });
const { default: createModule } = await import(${JSON.stringify(`file://${modulePath}`)});
const mod = await createModule({ print() {}, printErr() {} });
console.log(mod.ccall('nh_c2js_link_smoke', 'number', [], []));
`,
    ],
    { capture: true },
  ).trim();
  if (smoke !== "5000") {
    throw new Error(
      `engine smoke returned ${JSON.stringify(smoke)}, expected "5000"`,
    );
  }
}

export function runProbe() {
  ensureToolchain();
  const probeDir = join(cacheRoot, "probe");
  rmSync(probeDir, { recursive: true, force: true });
  mkdirSync(probeDir, { recursive: true });

  const source = join(probeDir, "probe.c");
  const native = join(probeDir, "probe-native");
  const module = join(probeDir, "probe-engine.mjs");
  writeFileSync(
    source,
    String.raw`
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

struct probe_bits {
    unsigned cursed : 1;
    unsigned blessed : 1;
    unsigned recharge : 3;
    uint32_t id;
};

static int cmp_probe(const void *a, const void *b) {
    const struct probe_bits *pa = (const struct probe_bits *) a;
    const struct probe_bits *pb = (const struct probe_bits *) b;
    return (int) pa->recharge - (int) pb->recharge;
}

static uint64_t step(uint64_t x) {
    return x * 6364136223846793005ULL + 1442695040888963407ULL;
}

int main(void) {
    struct probe_bits rows[3] = {
        { 1, 0, 3, 1 },
        { 0, 1, 2, 2 },
        { 1, 1, 1, 3 },
    };
    uint64_t x = 0x123456789abcdef0ULL;
    for (int i = 0; i < 17; ++i) x = step(x + rows[i % 3].id);
    qsort(rows, 3, sizeof rows[0], cmp_probe);
    char out[128];
    snprintf(out, sizeof out, "%u:%u:%u:%llu:%zu",
             rows[0].id, rows[1].id, rows[2].id,
             (unsigned long long) x, sizeof rows[0]);
    puts(out);
    return 0;
}
`,
  );

  run("clang", [source, "-O2", "-o", native]);
  const nativeOut = run(native, [], { capture: true }).trim();

  run("emcc", [source, ...jsOnlyProbeFlags, "-o", module]);
  const jsOut = run(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
globalThis.fetch = () => { throw new Error('fetch called'); };
globalThis.WebAssembly = new Proxy({}, { get() { throw new Error('real WebAssembly touched'); } });
const { default: createModule } = await import(${JSON.stringify(`file://${module}`)});
let lines = [];
await createModule({ print: s => lines.push(s), printErr: s => lines.push(s) });
console.log(lines.join('\\n'));
`,
    ],
    { capture: true },
  ).trim();

  const generated = readFileSync(module, "utf8");
  const forbidden = forbiddenRuntimeHooks(generated);
  if (forbidden.length) {
    throw new Error(
      `probe output contains forbidden host hooks: ${forbidden.join(", ")}`,
    );
  }
  if (existsSync(join(probeDir, `${basename(module)}.wasm`))) {
    throw new Error("probe emitted a wasm side file");
  }
  if (nativeOut !== jsOut) {
    throw new Error(`probe mismatch\nnative: ${nativeOut}\njs:     ${jsOut}`);
  }
  console.log(`probe ok: ${jsOut}`);
  console.log(`wrote ${module}`);
}
