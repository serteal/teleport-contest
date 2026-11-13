/* nhjs_host.c - the Unix port routines that the port does not take from
 * sys/unix/unixunix.c and sys/share/unixtty.c, which assume a real
 * terminal, fork() and signals.  sys/unix/unixmain.c itself is compiled
 * unchanged (with main renamed to nhjs_unix_main). */

#include "hack.h"

#include <regex.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>

/* sysconf SHELLERS gate shared by '!' and ^Z, as in dosh() and dosuspend() */
static boolean
nhjs_shell_allowed(void)
{
    return sysopt.shellers && sysopt.shellers[0]
           && check_user_string(sysopt.shellers);
}

/* '!': instead of running a shell, the tty is suspended and then redrawn,
   as when the shell exits (child(0)). */
int
dosh(void)
{
    if (!nhjs_shell_allowed()) {
        Norep("Unavailable command '!'.");
        return 0;
    }
    suspend_nhwindows((char *) 0);
    resume_nhwindows();
    return 0;
}

/* ^Z: suspend, then resume and redraw (ioctl.c dosuspend()) */
int
dosuspend(void)
{
    if (!nhjs_shell_allowed()) {
        Norep("Suspend command not available.");
        return 0;
    }
    suspend_nhwindows((char *) 0);
    resume_nhwindows();
    return 0;
}

#ifndef CRASHREPORT
/* #bugreport (see src/cmd.c): no browser can be launched for the report */
int
dobugreport(void)
{
    pline("Unable to send bug report.  Please visit %s instead.",
          (sysopt.crashreporturl && *sysopt.crashreporturl)
              ? sysopt.crashreporturl
              : DEVTEAM_URL);
    return ECMD_OK;
}
#endif

/* The parent side of unixunix.c child(): the windows are suspended (blank
   screen), the child process (the mail reader of readmail()) prints
   outside the capture and exits, and with `wt' the parent waits for a key
   before redrawing.  wait_synch() -> getret() -> xwaitforspace(), in
   cbreak mode (see settty()), accepts CR, LF, space and ESC and beeps at
   (and consumes) any other key.  The child's own return of 1 never
   happens here: the fork always "succeeds" and only the parent goes on. */
int
child(int wt)
{
    suspend_nhwindows((char *) 0);
    if (wt) {
        raw_print("");
        wait_synch();
    }
    resume_nhwindows();
    return 0;
}

/* unixtty.c: these only change the (absent) terminal's interrupt key */
void
intron(void)
{
}

void
introff(void)
{
}

/* normalize file name - we don't like .'s, /'s, spaces (unixunix.c) */
void
regularize(char *s)
{
    char *lp;

    while ((lp = strchr(s, '.')) != 0 || (lp = strchr(s, '/')) != 0
           || (lp = strchr(s, ' ')) != 0)
        *lp = '_';
}

/* caller couldn't find a regular save file but did find a panic one
   (unixunix.c) */
void
ask_about_panic_save(void)
{
    static const char Instead_prompt[] = "Start a new game instead?";
    int c = '\0';

    pline("There is no regular save file but there is a panic one.");
    pline("It might be recoverable with demi-divine intervention.");
    if (iflags.window_inited)
        c = yn_function(Instead_prompt, "yn\033q", 'n', FALSE);
    if (c != 'y') {
        delete_levelfile(0);
        unlock_file(HLOCK);
        if (iflags.window_inited)
            exit_nhwindows((char *) 0);
        nh_terminate(EXIT_SUCCESS);
    }
}

/* regerror() with the messages of Henry Spencer's regex package (BSD
   licence), lib/libc/regex/regerror.c.  Codes 1-13 are those of the
   port's <regex.h>; 14-18 are the package's own. */
size_t
nhjs_regerror(int errcode, const regex_t *preg, char *errbuf,
              size_t errbuf_size)
{
    static const struct {
        int code;
        const char *explain;
    } rerrs[] = {
        { REG_NOMATCH, "regexec() failed to match" },
        { REG_BADPAT, "invalid regular expression" },
        { REG_ECOLLATE, "invalid collating element" },
        { REG_ECTYPE, "invalid character class" },
        { REG_EESCAPE, "trailing backslash (\\)" },
        { REG_ESUBREG, "invalid backreference number" },
        { REG_EBRACK, "brackets ([ ]) not balanced" },
        { REG_EPAREN, "parentheses not balanced" },
        { REG_EBRACE, "braces not balanced" },
        { REG_BADBR, "invalid repetition count(s)" },
        { REG_ERANGE, "invalid character range" },
        { REG_ESPACE, "out of memory" },
        { REG_BADRPT, "repetition-operator operand invalid" },
        /* codes beyond <regex.h>; the port's regcomp (js/host/regex.js)
           returns 14 and 18 */
        { 14, "empty (sub)expression" },             /* REG_EMPTY */
        { 15, "\"can't happen\" -- you found a bug" }, /* REG_ASSERT */
        { 16, "invalid argument to regex routine" }, /* REG_INVARG */
        { 17, "illegal byte sequence" },             /* REG_ILLSEQ */
        { 18, "maximum repetition exceeds 255" },    /* REG_BADMAX */
    };
    const char *s = "*** unknown regexp error code ***";
    size_t i, len;

    (void) preg;
    for (i = 0; i < SIZE(rerrs); ++i)
        if (rerrs[i].code == errcode) {
            s = rerrs[i].explain;
            break;
        }
    len = strlen(s) + 1;
    if (errbuf_size > 0) {
        if (errbuf_size > len) {
            (void) strcpy(errbuf, s);
        } else {
            (void) strncpy(errbuf, s, errbuf_size - 1);
            errbuf[errbuf_size - 1] = '\0';
        }
    }
    return len;
}

/* fatal error (unixtty.c) */
ATTRNORETURN void
error(const char *s, ...)
{
    va_list ap;

    va_start(ap, s);
    if (iflags.window_inited)
        exit_nhwindows((char *) 0);
    vprintf(s, ap);
    (void) putchar('\n');
    va_end(ap);
    exit(EXIT_FAILURE);
}
