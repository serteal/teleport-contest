/* NetHack 5.0	global.h	$NHDT-Date: 1704225560 2024/01/02 19:59:20 $  $NHDT-Branch: keni-luabits2 $:$NHDT-Revision: 1.159 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2006. */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * Files expected to exist in the playground directory (possibly inside
 * a dlb container file).
 */

export const RECORD = "record";
export const HELP = "help";
export const SHELP = "hh";
export const KEYHELP = "keyhelp";
export const DEBUGHELP = "wizhelp";
export const RUMORFILE = "rumors";
export const ORACLEFILE = "oracles";
export const DATAFILE = "data";

export const HISTORY = "history";
export const LICENSE = "license";
export const OPTIONFILE = "opthelp";
export const OPTMENUHELP = "optmenu";
export const USAGEHELP = "usagehlp";
export const OPTIONS_USED = "options";
export const SYMBOLS = "symbols";
export const EPITAPHFILE = "epitaph";
export const ENGRAVEFILE = "engrave";
export const BOGUSMONFILE = "bogusmon";
export const TRIBUTEFILE = "tribute";
export const LEV_EXT = ".lua";

/* padding amounts for files that have lines chosen by fseek to random spot,
   advancing to the next line, and using that line; makedefs forces shorter
   lines to be padded to these lengths; value of 0 will inhibit any padding,
   avoiding an increase in files' sizes, but resulting in biased selection;
   used by makedefs while building and by core's callers of get_rnd_text() */
export const MD_PAD_RUMORS = 60;
export const MD_PAD_BOGONS = 20;

/* Assorted definitions that may depend on selections in config.h. */

/*
 * for DUMB preprocessor and compiler, e.g., cpp and pcc supplied
 * with Microport SysV/AT, which have small symbol tables;
 * DUMB if needed is defined in CFLAGS
 */

/*
 * type xint8: small integers (typedef'd as signed,
 * in the range -127 - 127).
 */
export const xint8 = schar;
/*
 * type coordxy: integers (typedef'd as signed,
 * in the range -32768 to 32767), mostly coordinates.
 * Note that in 2022, screen coordinates easily
 * surpass an upper limit of 127.
 */
export const coordxy = short;
/*
 * type xint16: integers (typedef'd as signed,
 * in the range -32768 to 32767), non-coordinates.
 */
export const xint16 = short;

/* Resolve conflict with Qt 5 and MinGW-w32 */
/* 0 or 1 */

export const boolean = schar; /* 0 or 1 */

/* vision seen vectors: viz_array[][] and levl[][].seenv, which use different
   values from each other but are close enough in size to share a type;
   viz_array contains 8-bit bitmasks, lev->seenv is a 5-bit bitfield */
/* no need for uint8_t */

/* Type for third parameter of read(2) */

export const TRUE = (1);
export const FALSE = (0);

export const BOOL_RANDOM = (-1);

/*
 * type nhsym: loadable symbols go into this type
 */
export const nhsym = uchar;

/* #define SPECIALIZATION *//* do "specialized" version of new topology */

/* A limit for some NetHack int variables.  It need not, and for comparable
 * scoring should not, depend on the actual limit on integers for a
 * particular machine, although it is set to the minimum required maximum
 * signed integer for C (2^15 -1).
 */
export const LARGEST_INT = 32767;

/*
 *  Memory allocation.  Functions are declared here rather than in
 *  extern.h so that source files which use config.h instead of hack.h
 *  will see the declarations.
 *
 *  NetHack does not use malloc() [except to implement alloc() in alloc.c]
 *  or realloc() or calloc().  They return Null if memory runs out and
 *  nethack's code relies on alloc() to intercept that so that a zillion
 *  callers don't need to test for Null result.  alloc() never returns
 *  Null; if memory runs out, it calls panic() and does not return at all.
 */

/* dupstr() is unconditional in alloc.c but not used when MONITOR_HEAP
   is enabled; some utility programs link with alloc.{o,obj} and need it
   if nethack is built with MONITOR_HEAP enabled and they aren't; this
   declaration has been moved out of the '#else' below to avoid getting
   a complaint from -Wmissing-prototypes when building with MONITOR_HEAP */

/* same, but return strlen(string) in extra argument */

/*
 * MONITOR_HEAP is conditionally used for primitive memory leak debugging.
 * When enabled, NH_HEAPLOG (if defined in the environment) is used as the
 * name of a log file to create for capturing allocations and releases.
 * [The 'heaputil' program to analyze that file isn't included in releases.]
 *
 * See alloc.c.
 */

/* plain alloc() is not declared except in alloc.c */

/* this predates C99's __func__; that is trickier to use conditionally
   because it is not implemented as a preprocessor macro; MONITOR_HEAP
   wouldn't gain much benefit from it anyway so continue to live without it;
   if func's caller were accessible, that would be a very different issue */

/* declare alloc.c's alloc(); allocations made with it use ordinary free() */
/* alloc.c */

/* Used for consistency checks of various data files; declare it here so
   that utility programs which include config.h but not hack.h can see it. */
export const struct_version_info = struct("struct_version_info", {
    incarnation: ulong, /* actual version number */
    feature_set: ulong, /* bitmask of config settings */
    entity_count: ulong, /* # of monsters and objects */
});

/* This is used to store some build-info data that used
   to be present in makedefs-generated header file date.h */

export const struct_nomakedefs_s = struct("struct_nomakedefs_s", {
    build_date: ptr_to(char),
    copyright_banner_c: ptr_to(char),
    git_sha: ptr_to(char),
    git_branch: ptr_to(char),
    git_prefix: ptr_to(char),
    version_string: ptr_to(char),
    version_id: ptr_to(char),
    version_number: ulong,
    version_features: ulong,
    ignored_features: ulong,
    version_sanity1: ulong,
    build_time: ulong,
});

/*
 * Configurable internal parameters.
 *
 * Please be very careful if you are going to change one of these.  Any
 * changes in these parameters, unless properly done, can render the
 * executable inoperative.
 */

/* size of terminal screen is (at least) (ROWNO+3) by COLNO */
export const COLNO = 80;
export const ROWNO = 21;

export const MAXNROFROOMS = 40;
export const MAX_SUBROOMS = 24;
export const DOORINC = 20;

export const BUFSZ = 256;
export const QBUFSZ = 128;
export const TBUFSZ = 300;

/* COLBUFSZ is the larger of BUFSZ and COLNO */

export const COLBUFSZ = BUFSZ;

export const PL_NSIZ = 32;
export const PL_CSIZ = 32;
export const PL_FSIZ = 32;
export const PL_PSIZ = 63;
/* room for "name-role-race-gend-algn" plus 1 character playmode code */
export const PL_NSIZ_PLUS = (PL_NSIZ + 4 * (1 + 3) + 1);

export const MAXDUNGEON = 16;
export const MAXLEVEL = 32;

export const ALIGNWEIGHT = 4;

export const MAXULEV = 30;

export const MAXMONNO = 120;
export const MHPMAX = 500;

export const MAX_MSG_HISTORY = 128;

/* Game log message type flags */
export const LL_NONE = 0x0000;
export const LL_WISH = 0x0001;
export const LL_ACHIEVE = 0x0002;
export const LL_UMONST = 0x0004;
export const LL_DIVINEGIFT = 0x0008;
export const LL_LIFESAVE = 0x0010;
export const LL_CONDUCT = 0x0020;
export const LL_ARTIFACT = 0x0040;
export const LL_GENOCIDE = 0x0080;
export const LL_KILLEDPET = 0x0100;
export const LL_ALIGNMENT = 0x0200;

export const LL_MINORAC = 0x1000;
export const LL_SPOILER = 0x2000;

export const LL_DUMP = 0x4000;
export const LL_DEBUG = 0x8000;

/*
 * Lua sandbox
 */
/* Control block for setting up a Lua state with nhl_init(). */
export const struct_nhl_sandbox_info = struct("struct_nhl_sandbox_info", {
    flags: unsigned, /* see below */
    memlimit: unsigned, /* approximate memory limit */
    steps: unsigned, /* instruction limit for state OR ... */
    perpcall: unsigned, /* ... instruction limit per nhl_pcall */
});

/* For efficiency, we only check every NHL_SB_STEPSIZE instructions. */

export const NHL_SB_STEPSIZE = 1000;

/* High level groups.  Use these flags. */
    /* Safe functions. */
export const NHL_SB_SAFE = 0x80000000;
    /* Access to Lua version information. */
export const NHL_SB_VERSION = 0x40000000;
    /* Debugging library - mostly unsafe. */
export const NHL_SB_DEBUGGING = 0x08000000;

/* Low level groups.  If you need these, you probably need to define
 * a new high level group instead. */
export const NHL_SB_STRING = 0x00000001;
export const NHL_SB_TABLE = 0x00000002;
export const NHL_SB_COROUTINE = 0x00000004;
export const NHL_SB_MATH = 0x00000008;
export const NHL_SB_UTF8 = 0x00000010;

export const NHL_SB_BASEMASK = 0x00000f80;
export const NHL_SB_BASE_BASE = 0x00000080;
export const NHL_SB_BASE_ERROR = 0x00000100;
export const NHL_SB_BASE_META = 0x00000200;
export const NHL_SB_BASE_GC = 0x00000400;
export const NHL_SB_BASE_UNSAFE = 0x00000800;

export const NHL_SB_DBMASK = 0x00003000;
export const NHL_SB_DB_DB = 0x00001000;
export const NHL_SB_DB_SAFE = 0x00002000;

export const NHL_SB_OSMASK = 0x0000c000;
export const NHL_SB_OS_TIME = 0x00004000;
export const NHL_SB_OS_FILES = 0x00008000;

export const NHL_SB_ALL = 0x0000ffff;

/* return codes */

/* NHL_pcall_handle action values */

    export const NHLpa_panic = 0;
    export const NHLpa_impossible = NHLpa_panic + 1;

export const opt_in = 0; export const opt_out = opt_in + 1;
/*
 * option setting restrictions
 */

    export const set_in_sysconf = 0; /* system config file option only */
    export const set_in_config = 1; /* config file option only */
    export const set_viaprog = 2; /* may be set via extern program, not seen in game */
    export const set_gameview = 3; /* may be set via extern program, displayed in game */
    export const set_in_game = 4; /* may be set via extern program or set in the game */
    export const set_wizonly = 5; /* may be set in the game if wizmode */
    export const set_wiznofuz = 6; /* wizard-mode only, but not by fuzzer */
    export const set_hidden = 7; /* placeholder for prefixed entries, never show it  */

/* these aren't the same as set_xxx */

    export const phase_not_set = 0;
    export const builtin_opt = 1; /* compiled-in default value of an option */
    export const syscf_opt = builtin_opt + 1; /* sysconf setting of an option, overrides builtin */
    export const rc_file_opt = syscf_opt + 1; /* player's run-time config file setting, overrides syscf */
    export const environ_opt = rc_file_opt + 1; /* player's environment NETHACKOPTIONS, overrides rc_file */
    export const cmdline_opt = environ_opt + 1; /* program invocation command-line, overrides environ */
    export const play_opt = cmdline_opt + 1; /* 'O' command, interactively set so overrides all */
    export const num_opt_phases = play_opt + 1;

export const SFCTOOL_BIT = shl64(1, 30);

import { char, schar, short, uchar, ulong, unsigned } from "../rt/ctypes.js";
import { shl64 } from "../rt/int64.js";
import { ptr_to, struct } from "../rt/struct.js";
