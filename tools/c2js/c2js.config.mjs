import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export const projectRoot = resolve(here, "../..");
export const upstreamDir = join(projectRoot, "nethack-c/upstream");
export const patchDir = join(projectRoot, "nethack-c/patches");
export const cacheRoot = join(projectRoot, ".cache/c2js");
export const preparedSourceDir = join(cacheRoot, "nethack-port");
export const generatedDir = join(projectRoot, "js/generated");
export const hostDir = join(projectRoot, "tools/c2js/host");

export const deterministicPatches = [
  "001-deterministic-runtime.patch",
  "002-deterministic-qsort.patch",
  "003-rng-log-core.patch",
  "004-rng-log-lua-context.patch",
  "005-rng-display-logging.patch",
  "006-nomux-capture.patch",
];

export const jsOnlyProbeFlags = [
  "-O2",
  "-sWASM=0",
  "-sENVIRONMENT=web",
  "-sFILESYSTEM=0",
  "-sMODULARIZE=1",
  "-sEXPORT_ES6=1",
  "-sDYNAMIC_EXECUTION=0",
  "-sEXIT_RUNTIME=1",
];

export const jsOnlyEngineFlags = [
  "-O2",
  "-flto=thin",
  "-g2",
  "--minify=0",
  "--profiling-funcs",
  "-sWASM=0",
  "-sENVIRONMENT=web",
  "-sMODULARIZE=1",
  "-sEXPORT_ES6=1",
  "-sDYNAMIC_EXECUTION=0",
  "-sASSERTIONS=0",
  "-sDISABLE_EXCEPTION_CATCHING=1",
  "-sDISABLE_EXCEPTION_THROWING=1",
  "-sSUPPORT_LONGJMP=emscripten",
  "-sSINGLE_FILE=1",
  "-sINCOMING_MODULE_JS_API=print,printErr",
  "-sALLOW_MEMORY_GROWTH=1",
  "-sEXIT_RUNTIME=0",
  "-sINVOKE_RUN=0",
  "-sEXPORTED_FUNCTIONS=_nh_c2js_link_smoke,_nhjs_set_seed,_nhjs_session_init,_nhjs_session_run,_nhjs_get_screen_count,_nhjs_get_screen,_nhjs_get_screen_cursor_col,_nhjs_get_screen_cursor_row,_nhjs_get_animation_count,_nhjs_get_animation_screen,_nhjs_get_animation_cursor_col,_nhjs_get_animation_cursor_row,_nhjs_get_animation_seq,_nhjs_get_animation_id,_nhjs_get_cursor_col,_nhjs_get_cursor_row,_nhjs_input_exhausted,_nhjs_started,_nhjs_rng_log_path,_nhjs_debug_phase",
  "-sEXPORTED_RUNTIME_METHODS=ccall,FS,UTF8ToString",
];

export const forbiddenRuntimeImports = [
  "fs",
  "node:fs",
  "child_process",
  "node:child_process",
  "worker_threads",
  "node:worker_threads",
  "cluster",
  "node:cluster",
  "net",
  "node:net",
  "http",
  "node:http",
  "https",
  "node:https",
  "tls",
  "node:tls",
  "dgram",
  "node:dgram",
  "dns",
  "node:dns",
  "wasi",
  "node:wasi",
  "module",
  "node:module",
];
