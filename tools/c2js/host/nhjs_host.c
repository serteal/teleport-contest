#include "hack.h"

#include <emscripten/emscripten.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>

static unsigned long nhjs_seed;
static unsigned char nhjs_seed_bytes[8];

static void
nhjs_store_seed64(unsigned long long seed)
{
    int i;

    nhjs_seed = (unsigned long) seed;
    for (i = 0; i < 8; ++i) {
        nhjs_seed_bytes[i] = (unsigned char) (seed & 0xFFu);
        seed >>= 8;
    }
}

EMSCRIPTEN_KEEPALIVE
void
nhjs_set_seed(unsigned long seed)
{
    nhjs_store_seed64((unsigned long long) seed);
}

void
nhjs_set_seed_text(const char *seed_text)
{
    char *end = (char *) 0;
    unsigned long long seed = 0ULL;

    if (seed_text && *seed_text)
        seed = strtoull(seed_text, &end, 10);
    nhjs_store_seed64(seed);
}

int
nhjs_get_seed_bytes(unsigned char *out, int max)
{
    int i, n = max < 8 ? max : 8;

    if (!out || max <= 0)
        return 0;
    for (i = 0; i < n; ++i)
        out[i] = nhjs_seed_bytes[i];
    return 8;
}

EMSCRIPTEN_KEEPALIVE
int
nh_c2js_link_smoke(void)
{
    return 5000;
}

boolean
whoami(void)
{
    if (!*svp.plname)
        Strcpy(svp.plname, "Hero");
    gp.plnamelen = 0;
    return FALSE;
}

void
sethanguphandler(void (*handler)(int))
{
    (void) handler;
}

boolean
check_user_string(const char *optstr)
{
    int pwlen;
    const char *eop, *w;
    const char *pwname = svp.plname;

    if (optstr[0] == '*')
        return TRUE;
    if (!pwname || !*pwname)
        return FALSE;
    pwlen = (int) strlen(pwname);
    eop = eos((char *) optstr);
    w = optstr;
    while (w + pwlen <= eop) {
        if (!*w)
            break;
        if (isspace(*w)) {
            w++;
            continue;
        }
        if (!strncmp(w, pwname, pwlen)) {
            if (!w[pwlen] || isspace(w[pwlen]))
                return TRUE;
        }
        while (*w && !isspace(*w))
            w++;
    }
    return FALSE;
}

boolean
authorize_wizard_mode(void)
{
    if (sysopt.wizards && sysopt.wizards[0]) {
        if (check_user_string(sysopt.wizards))
            return TRUE;
    }
    iflags.wiz_error_flag = TRUE;
    return FALSE;
}

boolean
authorize_explore_mode(void)
{
#ifdef SYSCF
    if (sysopt.explorers && sysopt.explorers[0]) {
        if (check_user_string(sysopt.explorers))
            return TRUE;
    }
    iflags.explore_error_flag = TRUE;
    return FALSE;
#else
    return TRUE;
#endif
}

unsigned long
sys_random_seed(void)
{
    return nhjs_seed;
}

void
get_nhuuid(void)
{
}

void
free_nhuuid(void)
{
    int i;

    for (i = 0; i < SIZE(svn.nhuuid); ++i)
        svn.nhuuid[i] = 0;
}

int
dosh(void)
{
    return 0;
}

int
dosuspend(void)
{
    return 0;
}

#ifndef CRASHREPORT
int
dobugreport(void)
{
    return ECMD_OK;
}
#endif

int
child(int wt)
{
    (void) wt;
    return 0;
}

void
intron(void)
{
}

void
introff(void)
{
}

void
regularize(char *s)
{
    char *lp;

    while ((lp = strchr(s, '.')) != 0 || (lp = strchr(s, '/')) != 0
           || (lp = strchr(s, ' ')) != 0)
        *lp = '_';
}

#ifndef TTY_GRAPHICS
void
nomux_capture_write_input_boundary(void)
{
}
#endif

ATTRNORETURN void
error(const char *s, ...)
{
    va_list ap;

    va_start(ap, s);
    vfprintf(stderr, s, ap);
    va_end(ap);
    fputc('\n', stderr);
    abort();
}
