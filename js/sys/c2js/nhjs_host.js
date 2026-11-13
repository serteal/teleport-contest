/* nhjs_host.c - the Unix port routines that the port does not take from
 * sys/unix/unixunix.c and sys/share/unixtty.c, which assume a real
 * terminal, fork() and signals.  sys/unix/unixmain.c itself is compiled
 * unchanged (with main renamed to nhjs_unix_main). */

/* sysconf SHELLERS gate shared by '!' and ^Z, as in dosh() and dosuspend() */
function nhjs_shell_allowed() { /* boolean */
    return (sysopt.shellers && chars[sysopt.shellers + 0]
           && check_user_string(sysopt.shellers) ? 1 : 0);
}

/* '!': instead of running a shell, the tty is suspended and then redrawn,
   as when the shell exits (child(0)). */
export function dosh() { /* int */
    if (!nhjs_shell_allowed()) {
        Norep(_("Unavailable command '!'."));
        return 0;
    }
    suspend_nhwindows()(0);
    resume_nhwindows()();
    return 0;
}

/* ^Z: suspend, then resume and redraw (ioctl.c dosuspend()) */
export function dosuspend() { /* int */
    if (!nhjs_shell_allowed()) {
        Norep(_("Suspend command not available."));
        return 0;
    }
    suspend_nhwindows()(0);
    resume_nhwindows()();
    return 0;
}

/* #bugreport (see src/cmd.c): no browser can be launched for the report */
export function dobugreport() { /* int */
    pline(_("Unable to send bug report.  Please visit %s instead."),
          (sysopt.crashreporturl && chars[sysopt.crashreporturl])
              ? sysopt.crashreporturl
              : _(DEVTEAM_URL));
    return ECMD_OK;
}

/* The parent side of unixunix.c child(): the windows are suspended (blank
   screen), the child process (the mail reader of readmail()) prints
   outside the capture and exits, and with `wt' the parent waits for a key
   before redrawing.  wait_synch() -> getret() -> xwaitforspace(), in
   cbreak mode (see settty()), accepts CR, LF, space and ESC and beeps at
   (and consumes) any other key.  The child's own return of 1 never
   happens here: the fork always "succeeds" and only the parent goes on. */
export function child(wt) { /* int */
    suspend_nhwindows()(0);
    if (wt) {
        raw_print()(_(""));
        wait_synch()();
    }
    resume_nhwindows()();
    return 0;
}

/* unixtty.c: these only change the (absent) terminal's interrupt key */
export function intron() { /* void */
}

export function introff() { /* void */
}

/* normalize file name - we don't like .'s, /'s, spaces (unixunix.c) */
export function regularize(s) { /* void */
    let lp;

    while ((lp = strchr(s, ord('.'))) != 0 || (lp = strchr(s, ord('/'))) != 0
           || (lp = strchr(s, ord(' '))) != 0)
        chars[lp] = ord('_');
}

/* caller couldn't find a regular save file but did find a panic one
   (unixunix.c) */
export function ask_about_panic_save() { /* void */
    let Instead_prompt = init_string(static_array("ask_about_panic_save.Instead_prompt", char, sizeof_string("Start a new game instead?")), _("Start a new game instead?"), true);
    let c = ord('\0');

    pline(_("There is no regular save file but there is a panic one."));
    pline(_("It might be recoverable with demi-divine intervention."));
    if (iflags.window_inited)
        c = yn_function(Instead_prompt, _("yn\x1bq"), ord('n'), FALSE);
    if (c != ord('y')) {
        delete_levelfile(0);
        unlock_file(_(HLOCK));
        if (iflags.window_inited)
            exit_nhwindows()(0);
        nh_terminate(EXIT_SUCCESS);
    }
}

/* regerror() with the messages of Henry Spencer's regex package (BSD
   licence), lib/libc/regex/regerror.c.  Codes 1-13 are those of the
   port's <regex.h>; 14-18 are the package's own. */
export function nhjs_regerror(errcode, preg, errbuf,
              errbuf_size) { /* size_t */
    const struct___anon1 = struct("nhjs_regerror.struct___anon1", {
        code: int,
        explain: ptr_to(char),
    }); let rerrs = static_array("nhjs_regerror.rerrs", struct___anon1, null, [
        { code: REG_NOMATCH, explain: _("regexec() failed to match") },
        { code: REG_BADPAT, explain: _("invalid regular expression") },
        { code: REG_ECOLLATE, explain: _("invalid collating element") },
        { code: REG_ECTYPE, explain: _("invalid character class") },
        { code: REG_EESCAPE, explain: _("trailing backslash (\\)") },
        { code: REG_ESUBREG, explain: _("invalid backreference number") },
        { code: REG_EBRACK, explain: _("brackets ([ ]) not balanced") },
        { code: REG_EPAREN, explain: _("parentheses not balanced") },
        { code: REG_EBRACE, explain: _("braces not balanced") },
        { code: REG_BADBR, explain: _("invalid repetition count(s)") },
        { code: REG_ERANGE, explain: _("invalid character range") },
        { code: REG_ESPACE, explain: _("out of memory") },
        { code: REG_BADRPT, explain: _("repetition-operator operand invalid") },
        /* codes beyond <regex.h>; the port's regcomp (js/host/regex.js)
           returns 14 and 18 */
        { code: 14, explain: _("empty (sub)expression") },             /* REG_EMPTY */
        { code: 15, explain: _("\"can't happen\" -- you found a bug") }, /* REG_ASSERT */
        { code: 16, explain: _("invalid argument to regex routine") }, /* REG_INVARG */
        { code: 17, explain: _("illegal byte sequence") },             /* REG_ILLSEQ */
        { code: 18, explain: _("maximum repetition exceeds 255") },    /* REG_BADMAX */
    ]);
    let s = _("*** unknown regexp error code ***");
    let i, len;

    preg;
    for (i = 0; i < SIZE(rerrs); ++i)
        if (rerrs[i].code == errcode) {
            s = rerrs[i].explain;
            break;
        }
    len = unsigned(strlen(s) + 1);
    if (errbuf_size > 0) {
        if (errbuf_size > len) {
            strcpy(errbuf, s);
        } else {
            strncpy(errbuf, s, unsigned(errbuf_size - 1));
            chars[errbuf + unsigned(errbuf_size - 1)] = ord('\0');
        }
    }
    return len;
}

/* fatal error (unixtty.c) */
 export function error(s, ...args) { /* void */
    let ap;

    ap = va_start(args);
    if (iflags.window_inited)
        exit_nhwindows()(0);
    vprintf(s, ap);
    putchar(ord('\n'));
    va_end(ap);
    exit(EXIT_FAILURE);
}

import { FALSE } from "../../src/global.h.js";
import { DEVTEAM_URL, ECMD_OK } from "../../src/hack.h.js";
import { HLOCK } from "../../src/unixconf.h.js";
import {
    exit_nhwindows, raw_print, resume_nhwindows, suspend_nhwindows, wait_synch,
} from "../../src/winprocs.h.macros.js";
import { SIZE } from "../../rt/cmacros.js";
import { char, int, ord, sizeof_string, unsigned } from "../../rt/ctypes.js";
import { chars } from "../../rt/heap.js";
import {
    EXIT_FAILURE, EXIT_SUCCESS, REG_BADBR, REG_BADPAT, REG_BADRPT, REG_EBRACE, REG_EBRACK,
    REG_ECOLLATE, REG_ECTYPE, REG_EESCAPE, REG_EPAREN, REG_ERANGE, REG_ESPACE, REG_ESUBREG,
    REG_NOMATCH, exit, putchar, strchr, strcpy, strlen, strncpy, vprintf,
} from "../../rt/libc.js";
import { init_string, static_array } from "../../rt/locals.js";
import { _ } from "../../rt/strings.js";
import { ptr_to, struct } from "../../rt/struct.js";
import { va_end, va_start } from "../../rt/varargs.js";
import { yn_function } from "../../src/cmd.js";
import { iflags } from "../../src/decl.js";
import { nh_terminate } from "../../src/end.js";
import { delete_levelfile, unlock_file } from "../../src/files.js";
import { Norep, pline } from "../../src/pline.js";
import { sysopt } from "../../src/sys.js";
import { check_user_string } from "../unix/unixmain.js";
