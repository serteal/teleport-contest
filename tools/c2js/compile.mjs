import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  cacheRoot,
  hostDir,
  jsOnlyEngineFlags,
  preparedSourceDir,
  projectRoot,
} from "./c2js.config.mjs";
import { nethackPortDefines } from "./common.mjs";
import {
  applyC2jsPortTransforms,
  configureSource,
  ensurePreparedSource,
  extractLuaSources,
} from "./prepare.mjs";

function objectNameFor(source) {
  return source
    .replace(/^\.\.\//, "")
    .replace(/\.c$/, "")
    .replace(/[/.]/g, "_");
}

function compileSourceFile({ source, cwd, objectDir, flags = [], label }) {
  const objectBase = objectNameFor(source);
  console.log(`[emcc:${label}] ${source}`);
  const result = spawnSync(
    "emcc",
    [
      "-O2",
      "-flto=thin",
      "-ffunction-sections",
      "-fdata-sections",
      "-fno-exceptions",
      "-fno-rtti",
      "-Wno-unused-command-line-argument",
      ...flags,
      "-c",
      source,
      "-o",
      join(objectDir, `${objectBase}.o`),
    ],
    {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
    },
  );
  writeFileSync(
    join(objectDir, `${objectBase}.log`),
    `${result.stdout || ""}${result.stderr || ""}`,
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || "");
    return false;
  }
  return true;
}

function compileSourceSet(label, entries) {
  configureSource();
  const objectDir = join(cacheRoot, `${label}-objects`);
  rmSync(objectDir, { recursive: true, force: true });
  mkdirSync(objectDir, { recursive: true });

  const failures = [];
  for (const entry of entries) {
    const ok = compileSourceFile({ ...entry, objectDir, label });
    if (!ok) failures.push(entry.source);
  }

  writeFileSync(
    join(cacheRoot, `compile-${label}.json`),
    JSON.stringify(
      {
        sources: entries.map((entry) => entry.source),
        failures,
        flags: jsOnlyEngineFlags,
        compileFlags: [
          "-O2",
          "-flto=thin",
          "-ffunction-sections",
          "-fdata-sections",
          "-fno-exceptions",
          "-fno-rtti",
        ],
        objectDir,
      },
      null,
      2,
    ),
  );
  if (failures.length) {
    throw new Error(
      `${label} compile failed for ${failures.length} source(s): ${failures.join(", ")}`,
    );
  }
  console.log(`compiled ${entries.length} ${label} source files`);
}

function compileSources(label, sources) {
  const srcDir = join(preparedSourceDir, "src");
  compileSourceSet(
    label,
    sources.map((source) => ({
      source,
      cwd: srcDir,
      flags: [
        "-I../include",
        "-I../lib/lua-5.4.8/src",
        "-DLUA_USE_POSIX",
        ...nethackPortDefines,
      ],
    })),
  );
}

export function compileSmoke() {
  compileSources("smoke", [
    "decl.c",
    "rnd.c",
    "objects.c",
    "monst.c",
    "allmain.c",
    "windows.c",
    "nhlua.c",
  ]);
}

export function compileCore() {
  ensurePreparedSource();
  applyC2jsPortTransforms();
  const manifest = JSON.parse(
    readFileSync(join(cacheRoot, "source-manifest.json"), "utf8"),
  );
  compileSources("core", manifest.hackSources);
}

export function compileLua() {
  configureSource();
  const luaDir = join(preparedSourceDir, "lib/lua-5.4.8/src");
  const luaMakefile = readFileSync(join(luaDir, "Makefile"), "utf8");
  const luaSources = extractLuaSources(luaMakefile);
  compileSourceSet(
    "lua",
    luaSources.map((source) => ({
      source,
      cwd: luaDir,
      flags: ["-DLUA_COMPAT_5_3", "-DLUA_USE_POSIX"],
    })),
  );
}

export function compilePortObjects() {
  configureSource();
  const srcDir = join(preparedSourceDir, "src");
  const hostSource = join(hostDir, "nhjs_host.c");
  const apiSource = join(hostDir, "nhjs_tty_api.c");
  const dataSource = generateDataSource();
  compileSourceSet("port", [
    {
      source: "date.c",
      cwd: srcDir,
      flags: [
        "-I../include",
        "-I../lib/lua-5.4.8/src",
        "-DLUA_USE_POSIX",
        ...nethackPortDefines,
      ],
    },
    {
      source: "cfgfiles.c",
      cwd: srcDir,
      flags: [
        "-I../include",
        "-I../lib/lua-5.4.8/src",
        "-DLUA_USE_POSIX",
        ...nethackPortDefines,
      ],
    },
    {
      source: "../sys/share/posixregex.c",
      cwd: srcDir,
      flags: [
        "-I../include",
        "-I../lib/lua-5.4.8/src",
        "-DLUA_USE_POSIX",
        ...nethackPortDefines,
      ],
    },
    {
      source: "../sys/share/tclib.c",
      cwd: srcDir,
      flags: ["-I../include", ...nethackPortDefines],
    },
    {
      source: "../win/tty/getline.c",
      cwd: srcDir,
      flags: [
        "-I../include",
        "-I../lib/lua-5.4.8/src",
        "-DLUA_USE_POSIX",
        ...nethackPortDefines,
      ],
    },
    {
      source: "../win/tty/termcap.c",
      cwd: srcDir,
      flags: [
        "-I../include",
        "-I../lib/lua-5.4.8/src",
        "-DLUA_USE_POSIX",
        ...nethackPortDefines,
      ],
    },
    {
      source: "../win/tty/topl.c",
      cwd: srcDir,
      flags: [
        "-I../include",
        "-I../lib/lua-5.4.8/src",
        "-DLUA_USE_POSIX",
        ...nethackPortDefines,
      ],
    },
    {
      source: "../win/tty/wintty.c",
      cwd: srcDir,
      flags: [
        "-I../include",
        "-I../lib/lua-5.4.8/src",
        "-DLUA_USE_POSIX",
        ...nethackPortDefines,
      ],
    },
    {
      source: hostSource,
      cwd: projectRoot,
      flags: [
        `-I${join(preparedSourceDir, "include")}`,
        `-I${join(preparedSourceDir, "lib/lua-5.4.8/src")}`,
        "-DLUA_USE_POSIX",
        ...nethackPortDefines,
      ],
    },
    {
      source: apiSource,
      cwd: projectRoot,
      flags: [
        `-I${join(preparedSourceDir, "include")}`,
        `-I${join(preparedSourceDir, "lib/lua-5.4.8/src")}`,
        "-DLUA_USE_POSIX",
        ...nethackPortDefines,
      ],
    },
    {
      source: dataSource,
      cwd: projectRoot,
      flags: [],
    },
  ]);
}

function shouldPackDataFile(name) {
  return (
    !name.startsWith(".") &&
    !["Makefile", "GENFILES"].includes(name) &&
    !name.endsWith("~")
  );
}

function cArrayLiteral(buffer) {
  const lines = [];
  for (let i = 0; i < buffer.length; i += 16) {
    const chunk = [...buffer.subarray(i, i + 16)]
      .map((byte) => `0x${byte.toString(16).padStart(2, "0")}`)
      .join(", ");
    lines.push(`  ${chunk},`);
  }
  if (!lines.length) lines.push("  0x00,");
  return lines.join("\n");
}

function cStringLiteral(value) {
  return JSON.stringify(value).replace(/\u2028|\u2029/g, (c) =>
    c === "\u2028" ? "\\u2028" : "\\u2029",
  );
}

function generateDataSource() {
  const dataDir = join(preparedSourceDir, "dat");
  const generatedC2jsDir = join(cacheRoot, "generated");
  mkdirSync(generatedC2jsDir, { recursive: true });
  const files = readdirSync(dataDir)
    .filter(shouldPackDataFile)
    .filter((name) => statSync(join(dataDir, name)).isFile())
    .sort();

  const arrays = [];
  const table = [];
  for (const [index, name] of files.entries()) {
    const bytes = readFileSync(join(dataDir, name));
    arrays.push(
      `static const unsigned char nhjs_data_${index}[] = {\n${cArrayLiteral(bytes)}\n};`,
    );
    table.push(
      `  { ${cStringLiteral(`/${name}`)}, nhjs_data_${index}, ${bytes.length} },`,
    );
  }

  const output =
    `/* generated by tools/c2js/build-engine.mjs; do not edit */\n` +
    `#include <stdio.h>\n` +
    `#include <string.h>\n\n` +
    arrays.join("\n\n") +
    `\n\nstruct nhjs_data_file {\n` +
    `  const char *path;\n` +
    `  const unsigned char *data;\n` +
    `  unsigned int size;\n` +
    `};\n\n` +
    `static const struct nhjs_data_file nhjs_data_files[] = {\n` +
    table.join("\n") +
    `\n};\n\n` +
    `void\n` +
    `nhjs_install_data_files(void)\n` +
    `{\n` +
    `  unsigned int i;\n` +
    `  for (i = 0; i < sizeof nhjs_data_files / sizeof nhjs_data_files[0]; ++i) {\n` +
    `    FILE *fp = fopen(nhjs_data_files[i].path, "wb");\n` +
    `    if (!fp)\n` +
    `      continue;\n` +
    `    if (nhjs_data_files[i].size)\n` +
    `      (void) fwrite(nhjs_data_files[i].data, 1, nhjs_data_files[i].size, fp);\n` +
    `    fclose(fp);\n` +
    `  }\n` +
    `}\n`;
  const dataSource = join(generatedC2jsDir, "nhjs_data.c");
  writeFileSync(dataSource, output);
  console.log(
    `packed ${files.length} generated NetHack data files into ${dataSource}`,
  );
  return dataSource;
}

export function collectObjects(dirs) {
  const objects = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) throw new Error(`Missing object directory: ${dir}`);
    for (const entry of readdirSync(dir)) {
      if (entry.endsWith(".o")) objects.push(join(dir, entry));
    }
  }
  return objects.sort();
}
