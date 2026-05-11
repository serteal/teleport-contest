import {
  copyFileSync,
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
  deterministicPatches,
  patchDir,
  preparedSourceDir,
  projectRoot,
  upstreamDir,
} from "./c2js.config.mjs";
import { ensureToolchain, run } from "./common.mjs";

let configuredSource = false;

export function extractHackSources(makefileText) {
  const match = makefileText.match(
    /HACKCSRC\s*=\s*([\s\S]*?)\n\s*# all operating-system-dependent/,
  );
  if (!match) throw new Error("Could not locate HACKCSRC in Makefile.src");
  return match[1]
    .replace(/\\/g, " ")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.endsWith(".c"));
}

function makeLogicalLines(makefileText) {
  const logical = [];
  let current = "";
  for (const rawLine of makefileText.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/g, "");
    if (line.endsWith("\\")) {
      current += `${line.slice(0, -1)} `;
    } else {
      logical.push(`${current}${line}`);
      current = "";
    }
  }
  if (current) logical.push(current);
  return logical;
}

function extractMakeVariable(makefileText, name) {
  const assignment = makeLogicalLines(makefileText).find((line) =>
    new RegExp(`^${name}\\s*(?:\\?|:|\\+)?=`).test(line),
  );
  if (!assignment) throw new Error(`Could not locate ${name} in Makefile`);
  return assignment
    .replace(new RegExp(`^${name}\\s*(?:\\?|:|\\+)?=\\s*`), "")
    .trim();
}

function expandMakeVariables(value, variables) {
  let expanded = value;
  for (let i = 0; i < 8; ++i) {
    const next = expanded.replace(
      /\$\(([^)]+)\)/g,
      (_, name) => variables[name] || "",
    );
    if (next === expanded) break;
    expanded = next;
  }
  return expanded;
}

export function extractLuaSources(makefileText) {
  const variables = {};
  for (const name of ["CORE_O", "LIB_O", "BASE_O"]) {
    variables[name] = extractMakeVariable(makefileText, name);
  }
  return expandMakeVariables(variables.BASE_O, variables)
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.endsWith(".o"))
    .map((s) => s.replace(/\.o$/, ".c"));
}

export function applyC2jsPortTransforms() {
  const configPath = join(preparedSourceDir, "include/config.h");
  let config = readFileSync(configPath, "utf8");
  if (!/^\s*#define TTY_GRAPHICS\b/m.test(config)) {
    if (config.includes("/* #define TTY_GRAPHICS */")) {
      config = config.replace(
        "/* #define TTY_GRAPHICS */",
        "#define TTY_GRAPHICS /* c2js translates the tty/nomux window port */",
      );
    } else if (/\/\*\s*#undef TTY_GRAPHICS\b[^*]*\*\//.test(config)) {
      config = config.replace(
        /\/\*\s*#undef TTY_GRAPHICS\b[^*]*\*\//,
        "#define TTY_GRAPHICS /* c2js translates the tty/nomux window port */",
      );
    } else {
      config +=
        "\n#define TTY_GRAPHICS /* c2js translates the tty/nomux window port */\n";
    }
  }
  config = config.replace(
    /^\s*#define SHIM_GRAPHICS\b.*$/m,
    "/* #undef SHIM_GRAPHICS -- c2js translates the tty/nomux window port */",
  );
  if (!config.includes("c2js keeps saves uncompressed in the JS VFS")) {
    config = config.replace(
      `#if defined(UNIX) && !defined(ZLIB_COMP) && !defined(COMPRESS)
/* path and file name extension for compression program */
#define COMPRESS "/usr/bin/compress" /* Lempel-Ziv compression */
#define COMPRESS_EXTENSION ".Z"      /* compress's extension */
/* An example of one alternative you might want to use: */
/* #define COMPRESS "/usr/local/bin/gzip" */ /* FSF gzip compression */
/* #define COMPRESS_EXTENSION ".gz" */       /* normal gzip extension */
#endif

#ifndef COMPRESS`,
      `#if defined(UNIX) && !defined(ZLIB_COMP) && !defined(COMPRESS)
/* path and file name extension for compression program */
#define COMPRESS "/usr/bin/compress" /* Lempel-Ziv compression */
#define COMPRESS_EXTENSION ".Z"      /* compress's extension */
/* An example of one alternative you might want to use: */
/* #define COMPRESS "/usr/local/bin/gzip" */ /* FSF gzip compression */
/* #define COMPRESS_EXTENSION ".gz" */       /* normal gzip extension */
#endif

#ifdef NH_C2JS_TTY_CAPTURE
/* c2js keeps saves uncompressed in the JS VFS. */
#undef COMPRESS
#endif

#ifndef COMPRESS`,
    );
  }
  writeFileSync(configPath, config);

  const unixconfPath = join(preparedSourceDir, "include/unixconf.h");
  let unixconf = readFileSync(unixconfPath, "utf8");
  if (!unixconf.includes("c2js uses ANSI_DEFAULT termcap")) {
    unixconf = unixconf.replace(
      "#define TERMINFO       /* uses terminfo rather than termcap */",
      "/* #undef TERMINFO -- c2js uses ANSI_DEFAULT termcap, not curses/terminfo */",
    );
  }
  if (!unixconf.includes("c2js scripted tty input")) {
    unixconf = unixconf.replace(
      "#define tgetch getchar",
      "extern int nhjs_tgetch(void);\n#define tgetch nhjs_tgetch /* c2js scripted tty input */",
    );
  } else if (!unixconf.includes("extern int nhjs_tgetch(void);")) {
    unixconf = unixconf.replace(
      "#define tgetch nhjs_tgetch /* c2js scripted tty input */",
      "extern int nhjs_tgetch(void);\n#define tgetch nhjs_tgetch /* c2js scripted tty input */",
    );
  }
  writeFileSync(unixconfPath, unixconf);

  const endPath = join(preparedSourceDir, "src/end.c");
  let end = readFileSync(endPath, "utf8");
  if (!end.includes("c2js capture declaration without curses")) {
    end = end.replace(
      '#include "wintty.h"  /* for NOMUX_CAPTURE define + nomux_capture_write_input_boundary decl (#460) */',
      `#ifdef TTY_GRAPHICS
#include "wintty.h"  /* for NOMUX_CAPTURE define + nomux_capture_write_input_boundary decl (#460) */
#else
/* c2js capture declaration without curses/wintty.h */
#ifndef NOMUX_CAPTURE
#define NOMUX_CAPTURE
#endif
extern void nomux_capture_write_input_boundary(void);
#endif`,
    );
    writeFileSync(endPath, end);
  }

  const allmainPath = join(preparedSourceDir, "src/allmain.c");
  let allmain = readFileSync(allmainPath, "utf8");
  if (!allmain.includes("c2js exposes moveloop_preamble")) {
    allmain = allmain
      .replace(
        "staticfn void moveloop_preamble(boolean);",
        "void moveloop_preamble(boolean); /* c2js exposes moveloop_preamble */",
      )
      .replace(
        "staticfn void\nmoveloop_preamble(boolean resuming)",
        "void\nmoveloop_preamble(boolean resuming)",
      );
    writeFileSync(allmainPath, allmain);
  }

  const eatPath = join(preparedSourceDir, "src/eat.c");
  let eat = readFileSync(eatPath, "utf8");
  if (!eat.includes("NH_C2JS_MACOS_MESSAGES")) {
    eat = eat.replace(
      "#if defined(MACOS9) || defined(MACOS)",
      "#if defined(MACOS9) || defined(MACOS) || defined(NH_C2JS_MACOS_MESSAGES)",
    );
    writeFileSync(eatPath, eat);
  }

  const calendarPath = join(preparedSourceDir, "src/calendar.c");
  let calendar = readFileSync(calendarPath, "utf8");
  if (!calendar.includes("c2js recorder fixed datetime timezone")) {
    calendar = calendar.replace(
      `#include "hack.h"

/*
 * Time routines`,
      `#include "hack.h"

#ifdef NH_C2JS_RECORDER_PLATFORM
/* c2js recorder fixed datetime timezone: public traces were recorded with
   fixed datetimes interpreted as Eastern daylight time (UTC-04:00).  Avoid
   Emscripten's host/browser timezone when converting those strings. */
#define NH_C2JS_RECORDER_UTC_OFFSET_SECONDS (-4L * 60L * 60L)

staticfn int nh_c2js_leap_year(int);
staticfn long nh_c2js_days_from_civil(int, unsigned, unsigned);
staticfn time_t nh_c2js_time_from_yyyymmddhhmmss(char *);
staticfn struct tm *nh_c2js_tm_from_time(time_t);
staticfn struct tm *nh_c2js_tm_from_yyyymmddhhmmss(char *);

staticfn int
nh_c2js_leap_year(int year)
{
    return (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0));
}

staticfn long
nh_c2js_days_from_civil(int year, unsigned month, unsigned day)
{
    int era, yoe;
    unsigned doy, doe;

    year -= month <= 2;
    era = (year >= 0 ? year : year - 399) / 400;
    yoe = (unsigned) (year - era * 400);
    doy = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 + day - 1;
    doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    return (long) era * 146097L + (long) doe - 719468L;
}

staticfn time_t
nh_c2js_time_from_yyyymmddhhmmss(char *buf)
{
    int year, month, day, hour, minute, second;
    long days;

    if (!buf || strlen(buf) != 14)
        return (time_t) 0;
    year = (buf[0] - '0') * 1000 + (buf[1] - '0') * 100
           + (buf[2] - '0') * 10 + (buf[3] - '0');
    month = (buf[4] - '0') * 10 + (buf[5] - '0');
    day = (buf[6] - '0') * 10 + (buf[7] - '0');
    hour = (buf[8] - '0') * 10 + (buf[9] - '0');
    minute = (buf[10] - '0') * 10 + (buf[11] - '0');
    second = (buf[12] - '0') * 10 + (buf[13] - '0');
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23
        || minute > 59 || second > 60)
        return (time_t) 0;

    days = nh_c2js_days_from_civil(year, (unsigned) month, (unsigned) day);
    return (time_t) (days * 86400L + hour * 3600L + minute * 60L + second
                     - NH_C2JS_RECORDER_UTC_OFFSET_SECONDS);
}

staticfn struct tm *
nh_c2js_tm_from_time(time_t date)
{
    static struct tm t;
    time_t shifted = date + NH_C2JS_RECORDER_UTC_OFFSET_SECONDS;
    struct tm *gt = gmtime(&shifted);

    if (!gt)
        return gt;
    t = *gt;
    t.tm_isdst = 1;
    return &t;
}

staticfn struct tm *
nh_c2js_tm_from_yyyymmddhhmmss(char *buf)
{
    time_t parsed = nh_c2js_time_from_yyyymmddhhmmss(buf);

    return parsed ? nh_c2js_tm_from_time(parsed) : (struct tm *) 0;
}
#endif

/*
 * Time routines`,
    );
    calendar = calendar.replace(
      `    if (fixed_dt && *fixed_dt) {
        time_t parsed = time_from_yyyymmddhhmmss((char *) fixed_dt);
        if (parsed != (time_t) 0)
            return parsed;
    }`,
      `    if (fixed_dt && *fixed_dt) {
#ifdef NH_C2JS_RECORDER_PLATFORM
        time_t parsed = nh_c2js_time_from_yyyymmddhhmmss((char *) fixed_dt);
#else
        time_t parsed = time_from_yyyymmddhhmmss((char *) fixed_dt);
#endif
        if (parsed != (time_t) 0)
            return parsed;
    }`,
    );
    calendar = calendar.replace(
      `    time_t date = getnow();

    return localtime((LOCALTIME_type) &date);`,
      `    time_t date = getnow();
#ifdef NH_C2JS_RECORDER_PLATFORM
    const char *fixed_dt = nh_getenv("NETHACK_FIXED_DATETIME");

    if (fixed_dt && *fixed_dt) {
        struct tm *fixed_tm = nh_c2js_tm_from_yyyymmddhhmmss((char *) fixed_dt);

        if (fixed_tm)
            return fixed_tm;
    }
    return nh_c2js_tm_from_time(date);
#else
    return localtime((LOCALTIME_type) &date);
#endif`,
    );
    calendar = calendar.replaceAll(
      `lt = localtime((LOCALTIME_type) &date);`,
      `#ifdef NH_C2JS_RECORDER_PLATFORM
        lt = nh_c2js_tm_from_time(date);
#else
        lt = localtime((LOCALTIME_type) &date);
#endif`,
    );
    writeFileSync(calendarPath, calendar);
  }

  const mdlibPath = join(preparedSourceDir, "src/mdlib.c");
  let mdlib = readFileSync(mdlibPath, "utf8");
  if (!mdlib.includes("c2js recorder platform version text")) {
    mdlib = mdlib
      .replace(
        `#ifdef ANSI_DEFAULT
    "ANSI default terminal",
#endif`,
        `#if defined(ANSI_DEFAULT) && !defined(NH_C2JS_RECORDER_PLATFORM)
    "ANSI default terminal",
#endif`,
      )
      .replace(
        `#ifdef COMPRESS
    "data file compression",
#endif`,
        `#if defined(COMPRESS) || defined(NH_C2JS_RECORDER_PLATFORM)
    "data file compression",
#endif`,
      )
      .replace(
        `#ifdef DEV_RANDOM
    /* include which specific one */
    "strong PRNG seed from " DEV_RANDOM,
#else`,
        `#if defined(NH_C2JS_RECORDER_PLATFORM)
    "strong PRNG seed from /dev/random",
#elif defined(DEV_RANDOM)
    /* include which specific one */
    "strong PRNG seed from " DEV_RANDOM,
#else`,
      )
      .replace(
        `#ifdef PANICTRACE
    "show stack trace on error",
#endif
#ifdef CRASHREPORT
    "launch browser to report issues",
#endif`,
        `#if defined(PANICTRACE) || defined(NH_C2JS_RECORDER_PLATFORM)
    "show stack trace on error",
#endif
#if defined(CRASHREPORT) || defined(NH_C2JS_RECORDER_PLATFORM)
    "launch browser to report issues",
#endif`,
      )
      .replace(
        `#ifdef TTY_GRAPHICS
#ifdef TERMINFO
    "terminal info library",
#else
#if defined(TERMLIB) || (!defined(MICRO) && !defined(WIN32))
    "terminal capability library",
#endif
#endif
#endif /*TTY_GRAPHICS*/`,
        `#ifdef TTY_GRAPHICS
#ifdef NH_C2JS_RECORDER_PLATFORM
    "terminal info library",
#else
#ifdef TERMINFO
    "terminal info library",
#else
#if defined(TERMLIB) || (!defined(MICRO) && !defined(WIN32))
    "terminal capability library",
#endif
#endif
#endif
#endif /*TTY_GRAPHICS*/`,
      )
      .replace(
        `    Strcat(strcpy(buf, datamodel(0)), " data model,");`,
        `#ifdef NH_C2JS_RECORDER_PLATFORM
    /* c2js recorder platform version text: public traces were recorded on
       macOS LP64, while the translated engine runs as Emscripten ILP32. */
    Strcat(strcpy(buf, "I32LP64"), " data model,");
#else
    Strcat(strcpy(buf, datamodel(0)), " data model,");
#endif`,
      );
    writeFileSync(mdlibPath, mdlib);
  }
  mdlib = readFileSync(mdlibPath, "utf8");
  if (
    !mdlib.includes(
      '#ifdef NH_C2JS_RECORDER_PLATFORM\n    "terminal info library"',
    )
  ) {
    mdlib = mdlib.replace(
      `#ifdef TTY_GRAPHICS
#ifdef TERMINFO
    "terminal info library",
#else
#if defined(TERMLIB) || (!defined(MICRO) && !defined(WIN32))
    "terminal capability library",
#endif
#endif
#endif /*TTY_GRAPHICS*/`,
      `#ifdef TTY_GRAPHICS
#ifdef NH_C2JS_RECORDER_PLATFORM
    "terminal info library",
#else
#ifdef TERMINFO
    "terminal info library",
#else
#if defined(TERMLIB) || (!defined(MICRO) && !defined(WIN32))
    "terminal capability library",
#endif
#endif
#endif
#endif /*TTY_GRAPHICS*/`,
    );
    writeFileSync(mdlibPath, mdlib);
  }

  const optlistPath = join(preparedSourceDir, "include/optlist.h");
  let optlist = readFileSync(optlistPath, "utf8");
  if (!optlist.includes("c2js recorder exposes crash option menu entries")) {
    optlist = optlist.replace(
      "#ifdef CRASHREPORT\n    NHOPTC(crash_email",
      "#if defined(CRASHREPORT) || defined(NH_C2JS_RECORDER_PLATFORM) /* c2js recorder exposes crash option menu entries */\n    NHOPTC(crash_email",
    );
    writeFileSync(optlistPath, optlist);
  }

  const optionsPath = join(preparedSourceDir, "src/options.c");
  let options = readFileSync(optionsPath, "utf8");
  if (!options.includes("c2js recorder crash option handlers")) {
    options = options.replace(
      "#ifdef CRASHREPORT\nstaticfn int\noptfn_crash_email",
      "#if defined(CRASHREPORT) || defined(NH_C2JS_RECORDER_PLATFORM) /* c2js recorder crash option handlers */\nstaticfn int\noptfn_crash_email",
    );
    options = options.replace(
      "#endif /* CRASHREPORT */\n\nstaticfn int\noptfn_dark_room",
      "#endif /* CRASHREPORT || NH_C2JS_RECORDER_PLATFORM */\n\nstaticfn int\noptfn_dark_room",
    );
    writeFileSync(optionsPath, options);
  }

  const cmdPath = join(preparedSourceDir, "src/cmd.c");
  let cmdSource = readFileSync(cmdPath, "utf8");
  cmdSource = cmdSource.replace(
    "extern int doorganize(void);         /**/\n#ifdef NH_C2JS_RECORDER_PLATFORM\nextern int dobugreport(void);              /* c2js recorder bugreport command */\n#endif\n#endif /* DUMB */",
    "extern int doorganize(void);         /**/\n#endif /* DUMB */\n#ifdef NH_C2JS_RECORDER_PLATFORM\nextern int dobugreport(void);              /* c2js recorder bugreport command */\n#endif",
  );
  if (!cmdSource.includes("c2js recorder bugreport command")) {
    cmdSource = cmdSource.replace(
      "extern int doorganize(void);         /**/\n#endif /* DUMB */",
      "extern int doorganize(void);         /**/\n#endif /* DUMB */\n#ifdef NH_C2JS_RECORDER_PLATFORM\nextern int dobugreport(void);              /* c2js recorder bugreport command */\n#endif",
    );
    cmdSource = cmdSource.replace(
      '#ifdef CRASHREPORT\n    { \'\\0\',   "bugreport", "file a bug report",',
      '#if defined(CRASHREPORT) || defined(NH_C2JS_RECORDER_PLATFORM) /* c2js recorder bugreport command */\n    { \'\\0\',   "bugreport", "file a bug report",',
    );
  }
  writeFileSync(cmdPath, cmdSource);

  const termcapPath = join(preparedSourceDir, "win/tty/termcap.c");
  let termcap = readFileSync(termcapPath, "utf8");
  if (!termcap.includes("nhjs_tty_capture_boundary")) {
    termcap = termcap.replace(
      "static void\nnomux_emit_marker(const char *kind)\n{\n    if (!nomux_markers_enabled())\n        return;\n\n    {\n        char *scr = nomux_capture_screen();\n        int cx, cy;\n        size_t scr_len = scr ? strlen(scr) : 0;\n        nomux_get_cursor(&cx, &cy);",
      `static void
nomux_emit_marker(const char *kind)
{
#ifdef NH_C2JS_TTY_CAPTURE
    extern void nhjs_tty_capture_boundary(const char *, int, int, int, int,
                                          const char *);
#endif
    char *scr = nomux_capture_screen();
    int cx, cy;
    size_t scr_len = scr ? strlen(scr) : 0;
    nomux_get_cursor(&cx, &cy);
#ifdef NH_C2JS_TTY_CAPTURE
    nhjs_tty_capture_boundary(kind, nomux_seq, nomux_anim_id, cx, cy, scr);
    if (getenv("NHJS_SUPPRESS_NOMUX_MARKERS"))
        return;
#endif
    if (!nomux_markers_enabled())
        return;

    {`,
    );
    termcap = termcap.replace(
      "        if (scr_len > 0)\n            fwrite(scr, 1, scr_len, stdout);\n        fflush(stdout);\n    }\n}",
      "        if (scr_len > 0)\n            fwrite(scr, 1, scr_len, stdout);\n        fflush(stdout);\n    }\n}",
    );
    writeFileSync(termcapPath, termcap);
  }
  termcap = termcap.replace(
    `#ifdef NH_C2JS_TTY_CAPTURE
    if (!strcmp(kind, "input"))
        nhjs_tty_capture_boundary(kind, nomux_seq, nomux_anim_id, cx, cy, scr);
    if (getenv("NHJS_SUPPRESS_NOMUX_MARKERS"))
        return;
#endif`,
    `#ifdef NH_C2JS_TTY_CAPTURE
    nhjs_tty_capture_boundary(kind, nomux_seq, nomux_anim_id, cx, cy, scr);
    if (getenv("NHJS_SUPPRESS_NOMUX_MARKERS"))
        return;
#endif`,
  );
  writeFileSync(termcapPath, termcap);
  if (!termcap.includes("c2js mirrors emitted termcap state")) {
    termcap = termcap.replace(
      `void
term_start_attr(int attr)
{
    if (attr) {
#ifdef NOMUX_CAPTURE
        nomux_set_attr(attr);
#endif
        const char *astr = s_atr2str(attr);

        if (astr && *astr)
            xputs(astr);
    }
}`,
      `void
term_start_attr(int attr)
{
    if (attr) {
        const char *astr = s_atr2str(attr);

        if (astr && *astr) {
#ifdef NOMUX_CAPTURE
            /* c2js mirrors emitted termcap state. */
            nomux_set_attr(attr);
#endif
            xputs(astr);
        }
    }
}`,
    );
    termcap = termcap.replace(
      `void
term_end_attr(int attr)
{
    if (attr) {
#ifdef NOMUX_CAPTURE
        nomux_end_attr();
#endif
        const char *astr = e_atr2str(attr);

        if (astr && *astr)
            xputs(astr);
    }
}`,
      `void
term_end_attr(int attr)
{
    if (attr) {
        const char *astr = e_atr2str(attr);

        if (astr && *astr) {
#ifdef NOMUX_CAPTURE
            /* c2js mirrors emitted termcap state. */
            nomux_end_attr();
#endif
            xputs(astr);
        }
    }
}`,
    );
    termcap = termcap.replace(
      `void
term_end_color(void)
{
    xputs(nh_HE);
#ifdef NOMUX_CAPTURE
    nomux_end_fg();
    nomux_end_attr();
#endif
}

void
term_start_color(int color)
{
#ifdef NOMUX_CAPTURE
    nomux_set_fg(color);
#endif
    if (color == NO_COLOR)
        xputs(nh_HE); /* inline term_end_color() */
    else if (color < CLR_MAX && hilites[color] && *hilites[color])
        xputs(hilites[color]);
}`,
      `void
term_end_color(void)
{
    if (nh_HE && *nh_HE) {
        xputs(nh_HE);
#ifdef NOMUX_CAPTURE
        /* c2js mirrors emitted termcap state. */
        nomux_end_fg();
        nomux_end_attr();
#endif
    }
}

void
term_start_color(int color)
{
    if (color == NO_COLOR) {
        if (nh_HE && *nh_HE) {
            xputs(nh_HE); /* inline term_end_color() */
#ifdef NOMUX_CAPTURE
            /* c2js mirrors emitted termcap state. */
            nomux_end_fg();
            nomux_end_attr();
#endif
        }
    } else if (color < CLR_MAX && hilites[color] && *hilites[color]) {
#ifdef NOMUX_CAPTURE
        /* c2js mirrors emitted termcap state. */
        nomux_set_fg(color);
#endif
        xputs(hilites[color]);
    }
}`,
    );
    writeFileSync(termcapPath, termcap);
  }
  termcap = readFileSync(termcapPath, "utf8");
  if (termcap.includes("c2js mirrors emitted termcap state.")) {
    termcap = termcap.replace(
      `    else if (color == CLR_BLACK)
        color = CLR_BLUE; /* c2js mirrors emitted termcap state. */
`,
      "",
    );
  }
  if (termcap.includes("c2js compresses styled blank runs like tmux capture")) {
    termcap = termcap
      .replace("        int attr_segment_has_text = 0;\n", "")
      .replace("                attr_segment_has_text = 0;\n", "")
      .replace(
        `            if (at != 0 && ch == ' ' && !c->decgfx
                && attr_segment_has_text) {
                int run = 1;

                while (col + run <= end) {
                    nomux_cell *next = &nomux_buf[row][col + run];
                    char next_ch = next->ch ? next->ch : ' ';

                    if (next_ch != ' ' || next->attr != at || next->fg != fg
                        || next->decgfx)
                        break;
                    run++;
                }
                if (run >= 3) {
                    /* c2js compresses styled blank runs like tmux capture. */
                    p += sprintf(p, "\\033[%dC", run);
                    col += run - 1;
                    continue;
                }
            }
`,
        "",
      )
      .replace(
        `            if (at != 0 && ch != ' ')
                attr_segment_has_text = 1;
`,
        "",
      );
    writeFileSync(termcapPath, termcap);
  }
  termcap = readFileSync(termcapPath, "utf8");
  if (!termcap.includes("c2js leaves blink as blink for NOMUX parity")) {
    termcap = termcap.replace(
      `    /* blink used to be converted to bold unconditionally; now depends on MB */
    if ((msk & HL_BLINK) && (!MB || !*MB)) {
        msk |= HL_BOLD;
        msk &= ~HL_BLINK;
    }`,
      `    /* blink used to be converted to bold unconditionally; now depends on MB */
#ifndef NH_C2JS_TTY_CAPTURE
    if ((msk & HL_BLINK) && (!MB || !*MB)) {
        msk |= HL_BOLD;
        msk &= ~HL_BLINK;
    }
#else
    /* c2js leaves blink as blink for NOMUX parity with the xterm recorder;
       NOMUX captures inverse/color but does not serialize blink itself. */
#endif`,
    );
    writeFileSync(termcapPath, termcap);
  }

  const winttyPath = join(preparedSourceDir, "win/tty/wintty.c");
  let wintty = readFileSync(winttyPath, "utf8");
  if (!wintty.includes("c2js always reads scripted tty input")) {
    wintty = wintty.replace(
      `#ifdef UNIX
        i = (program_state.getting_char == 1)
              ? tgetch()
              : ((read(fileno(stdin), (genericptr_t) &nestbuf, 1) == 1)
                 ? (int) nestbuf : EOF);
#else
        i = tgetch();
#endif`,
      `#ifdef NH_C2JS_TTY_CAPTURE
        /* c2js always reads scripted tty input; stdin is not available. */
        i = tgetch();
#else
#ifdef UNIX
        i = (program_state.getting_char == 1)
              ? tgetch()
              : ((read(fileno(stdin), (genericptr_t) &nestbuf, 1) == 1)
                 ? (int) nestbuf : EOF);
#else
        i = tgetch();
#endif
#endif`,
    );
  }
  if (!wintty.includes("c2js keeps NOMUX full-screen clears explicit")) {
    wintty = wintty.replace(
      `            ttyDisplay->toplin = TOPLINE_EMPTY;
        } else {
            if (WIN_MESSAGE != WIN_ERR)
                tty_clear_nhwindow(WIN_MESSAGE);
        }

        if (cw->data || !cw->maxrow)`,
      `            ttyDisplay->toplin = TOPLINE_EMPTY;
#ifdef NH_C2JS_TTY_CAPTURE
            /* c2js keeps NOMUX full-screen clears explicit. */
            nomux_clear_screen();
#endif
        } else {
            if (WIN_MESSAGE != WIN_ERR)
                tty_clear_nhwindow(WIN_MESSAGE);
        }

        if (cw->data || !cw->maxrow)`,
    );
  }
  if (!wintty.includes("c2js mirrors full-screen text-window backing clear")) {
    wintty = wintty.replace(
      `    for (n = 0, i = 0; i < cw->maxrow; i++) {
        HUPSKIP();`,
      `#ifdef NH_C2JS_TTY_CAPTURE
    if (cw->type == NHW_TEXT && !cw->offx) {
        /* c2js mirrors full-screen text-window backing clear. */
        nomux_clear_screen();
    }
#endif

    for (n = 0, i = 0; i < cw->maxrow; i++) {
        HUPSKIP();`,
    );
    wintty = wintty.replace(
      `            } else
                term_clear_screen();
            n = 0;`,
      `            } else
                term_clear_screen();
#ifdef NH_C2JS_TTY_CAPTURE
            if (cw->type == NHW_TEXT && !cw->offx)
                nomux_clear_screen();
#endif
            n = 0;`,
    );
  }
  if (wintty.includes("c2js records glyph colors directly in NOMUX")) {
    wintty = wintty.replace(
      `#ifdef NH_C2JS_TTY_CAPTURE
    if (!glyphdone && iflags.use_color
        && color != NO_COLOR && color != CLR_GRAY) {
        /* c2js records glyph colors directly in NOMUX. */
        nomux_set_fg(color);
    }
#endif
`,
      "",
    );
  }
  if (!wintty.includes("c2js honors basic glyph customcolors")) {
    wintty = wintty.replace(
      `    ch = glyphinfo->ttychar;
    color = glyphinfo->gm.sym.color;
    special = glyphinfo->gm.glyphflags;`,
      `    ch = glyphinfo->ttychar;
    color = glyphinfo->gm.sym.color;
#ifdef NH_C2JS_TTY_CAPTURE
    if ((glyphinfo->gm.customcolor & NH_BASIC_COLOR) != 0)
        color = COLORVAL(glyphinfo->gm.customcolor); /* c2js honors basic glyph customcolors */
#endif
    special = glyphinfo->gm.glyphflags;`,
    );
  }
  if (!wintty.includes("c2js mirrors askname erase in NOMUX")) {
    wintty = wintty.replace(
      `#else
                    (void) putchar('\\b');
                    (void) putchar(' ');
                    (void) putchar('\\b');
#endif
                }
                continue;`,
      `#else
                    (void) putchar('\\b');
                    (void) putchar(' ');
                    (void) putchar('\\b');
#endif
#ifdef NOMUX_CAPTURE
#ifndef WIN32CON
                    if (ttyDisplay->curx > 0) {
                        /* c2js mirrors askname erase in NOMUX. */
                        ttyDisplay->curx--;
                        nomux_putch(' ');
                    }
#endif
#endif
                }
                continue;`,
    );
  }
  writeFileSync(winttyPath, wintty);
}

export function prepareSource() {
  configuredSource = false;
  if (!existsSync(join(upstreamDir, "include/patchlevel.h"))) {
    throw new Error(
      "nethack-c/upstream is missing; run git submodule update --init nethack-c/upstream",
    );
  }
  mkdirSync(cacheRoot, { recursive: true });
  rmSync(preparedSourceDir, { recursive: true, force: true });
  mkdirSync(preparedSourceDir, { recursive: true });

  run("rsync", [
    "-a",
    "--exclude=.git",
    `${upstreamDir}/`,
    `${preparedSourceDir}/`,
  ]);
  run("git", ["init", "-q"], { cwd: preparedSourceDir });
  run("git", ["-c", "gc.auto=0", "add", "-A"], { cwd: preparedSourceDir });
  run(
    "git",
    [
      "-c",
      "user.email=c2js@local",
      "-c",
      "user.name=c2js",
      "commit",
      "-q",
      "-m",
      "baseline",
    ],
    {
      cwd: preparedSourceDir,
    },
  );

  for (const patchName of deterministicPatches) {
    run("git", ["apply", "--recount", join(patchDir, patchName)], {
      cwd: preparedSourceDir,
    });
  }
  rmSync(join(preparedSourceDir, ".git"), { recursive: true, force: true });
  applyC2jsPortTransforms();

  const makefile = readFileSync(
    join(preparedSourceDir, "sys/unix/Makefile.src"),
    "utf8",
  );
  const hackSources = extractHackSources(makefile);
  writeFileSync(
    join(cacheRoot, "source-manifest.json"),
    JSON.stringify(
      {
        upstream: "nethack-c/upstream",
        patches: deterministicPatches,
        c2jsPortTransforms: [
          "keep TTY_GRAPHICS enabled and compile NetHack tty/nomux rendering",
          "disable external save compression so JS VFS persistence stays in-process",
          "redirect tgetch to a scripted c2js input function",
          "capture NOMUX input-boundary frames into exported in-memory arrays",
          "mirror emitted termcap color/attribute state in NOMUX capture",
          "export moveloop_preamble so the c2js driver can step moveloop_core",
          "enable macOS apple/pear message parity without enabling full MACOS platform headers",
        ],
        hackSources,
        portSources: [
          "src/date.c",
          "src/cfgfiles.c",
          "sys/share/posixregex.c",
          "sys/share/tclib.c",
          "win/tty/getline.c",
          "win/tty/termcap.c",
          "win/tty/topl.c",
          "win/tty/wintty.c",
          "tools/c2js/host/nhjs_host.c",
          "tools/c2js/host/nhjs_tty_api.c",
          ".cache/c2js/generated/nhjs_data.c",
        ],
      },
      null,
      2,
    ),
  );

  console.log(`prepared ${preparedSourceDir}`);
  console.log(`found ${hackSources.length} core C sources`);
}

export function ensurePreparedSource() {
  if (!existsSync(join(preparedSourceDir, "src/allmain.c"))) {
    prepareSource();
  }
}

export function configureSource() {
  if (configuredSource) return;
  ensureToolchain();
  ensurePreparedSource();
  applyC2jsPortTransforms();
  run("sh", ["sys/unix/setup.sh", "sys/unix/hints/linux-minimal"], {
    cwd: preparedSourceDir,
  });
  run("make", ["fetch-lua"], { cwd: preparedSourceDir });
  run(
    "make",
    [
      "-C",
      "src",
      "../src/config.h-t",
      "../src/hack.h-t",
      "../include/onames.h",
      "../include/pm.h",
      "../include/date.h",
      "CC=clang",
      "CFLAGS=-g -I../include",
      "SYSCFLAGS=-DLUA_USE_POSIX",
    ],
    { cwd: preparedSourceDir },
  );
  run(
    "make",
    [
      "-C",
      "dat",
      "rumors",
      "data",
      "engrave",
      "epitaph",
      "oracles",
      "bogusmon",
    ],
    { cwd: preparedSourceDir },
  );
  configuredSource = true;
  console.log("configured NetHack source for c2js compile smoke");
}
