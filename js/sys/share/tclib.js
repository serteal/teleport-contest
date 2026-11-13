/* NetHack 5.0	tclib.c	$NHDT-Date: 1596498287 2020/08/03 23:44:47 $  $NHDT-Branch: NetHack-5.0 $:$NHDT-Revision: 1.10 $ */
/* Copyright (c) Robert Patrick Rankin, 1995                      */
/* NetHack may be freely redistributed.  See license for details. */

/* termcap library implementation */

export const TERMCAP = "/etc/termcap";

export const TCBUFSIZ = 1024;

export const ESC = ord('\x1b');
export const BEL = ord('\x07');

/* exported variables, as per man page */
global_scalar("PC", char);
global_scalar("BC", ptr_to(char)); global_scalar("UP", ptr_to(char));
global_scalar("ospeed", short);

/* exported routines */

/* local support data */
const tc_entry = static_var("tc_entry", ptr_to(char));
const bc_up_buf = static_array("bc_up_buf", char, 24);

/* `ospeed' to baud rate conversion table, adapted from GNU termcap-1.2 */
const baud_rates = static_array("baud_rates", short, null, [
    0,    50,   75,    110,  135,  150,

    200,  300,  600,  1200, 1800, 2400, 4800,

    9600, -192, -384, /* negative is used as `100 * abs(entry)' */

]);

/* local support code */

export function min(a, b) { return (a < b ? a : b); }

/* retrieve the specified terminal entry and return it in `entbuf' */
export function tgetent(entbuf,
        term) { /* int */
    const $frame = stack_frame(); try {
    let result;
    let fp;
    let tc = getenv(_("TERMCAP"));

    tc_entry[0] = entbuf;
    if (!entbuf || !term)
        return -1;
    /* if ${TERMCAP} is found as a file, it's not an inline termcap entry */
    if ((fp = fopen(tc ? tc : _(TERMCAP), _("r"))) != null)
        tc = 0;
    /* if ${TERMCAP} isn't a file and `term' matches ${TERM}, use ${TERMCAP}
     */
    if (tc) {
        let tm = getenv(_("TERM"));
        if (tm && strcmp(tm, term) == 0)
            return tc_store(term, tc);
        fp = fopen(_(TERMCAP), _("r"));
    }
    /* otherwise, look `term' up in the file */
    if (fp) {
        let wrkbuf = stack_array(char, TCBUFSIZ);
        tc = tc_find(fp, term, wrkbuf, int(unsigned(sizeof(array_of(char, TCBUFSIZ)) - strlen(term))));
        result = tc_store(term, tc);
        fclose(fp);
    } else {
        result = -1;
    }
    return result;
    } finally { stack_pop($frame); }
}

/* copy the entry into the output buffer */
function tc_store(trm, ent) { /* int */
    const $frame = stack_frame(); try {
    let bar, col;
    let s = stack_var(ptr_to(char));
    let n;
    let k;

    if (!ent || !chars[ent] || !trm || !chars[trm] || (col = strchr(ent, ord(':'))) == 0)
        return 0;
    strcpy(tc_entry[0], trm);
    if (((bar = strchr(ent, ord('|'))) != 0 && bar < col)
        || ((n = strlen(trm)) == (col - ent)
            && strncmp(ent, trm, n) == 0))
        strcat(tc_entry[0], col);
    else if (chars[ent] == ord(':'))
        strcat(tc_entry[0], ent);
    else
        strcat(strcat(tc_entry[0], _(":")), ent);

    /* initialize global variables */
    k = tgetnum(_("pc"));
    PC = (k == -1) ? ord('\0') : char(k);
    BC = s[0] = bc_up_buf;
    if (!tgetstr(_("bc"), s))
        strcpy(s[0], _("\b")), s[0] += 2;
    UP = s[0];
    tgetstr(_("up"), s);

    /* caller must set `ospeed' */
    if (ospeed >= SIZE(baud_rates))
        ospeed = (SIZE(baud_rates) - 1);
    else if (ospeed < 0)
        ospeed = 0;

    return 1;
    } finally { stack_pop($frame); }
}

/* search for an entry in the termcap file */
function tc_find(fp, term, buffer, bufsiz) { /* char * */
    const $frame = stack_frame(); try {
    let in_, len, first, skip;
    let ip, op, tc_fetch, tcbuf = stack_array(char, TCBUFSIZ);

    chars[buffer + 0] = ord('\0');
    do {
        ip = tcbuf, in_ = min(bufsiz, TCBUFSIZ);
        first = 1, skip = 0;
        /* load entire next entry, including any continuations */
        do {
            if (!fgets(ip, min(in_, BUFSIZ), fp))
                break;
            if (first)
                skip = +(chars[ip] == ord('#')), first = 0;
            len = int(strlen(ip));
            if (!skip && len > 1 && chars[(ip + len - 1)] == ord('\n')
                && chars[(ip + len - 2)] == ord('\\'))
                len -= 2;
            ip += len, in_ -= len;
        } while (chars[(ip - 1)] != ord('\n') && in_ > 0);
        if (ferror(fp) || ip == buffer || chars[(ip - 1)] != ord('\n'))
            return 0;
        chars[--ip] = ord('\0'); /* strip newline */
        if (!skip)
            ip = tc_name(term, tcbuf);
    } while (skip || !ip);

    /* we have the desired entry; strip cruft and look for :tc=other: */
    tc_fetch = 0;
    for (op = buffer; chars[ip]; ip++) {
        if (op == buffer || chars[(op - 1)] != ord(':')
            || (chars[ip] != ord(' ') && chars[ip] != ord('\t') && chars[ip] != ord(':')))
            chars[op++] = chars[ip], bufsiz -= 1;
        if (chars[ip + 0] == ord(':') && chars[ip + 1] == ord('t') && chars[ip + 2] == ord('c') && chars[ip + 3] == ord('=')) {
            tc_fetch = ip + 4;
            if ((ip = strchr(tc_fetch, ord(':'))) != 0)
                chars[ip] = ord('\0');
            break;
        }
    }
    chars[op] = ord('\0');

    if (tc_fetch) {
        rewind(fp);
        tc_fetch = tc_find(fp, tc_fetch, tcbuf, min(bufsiz, TCBUFSIZ));
        if (!tc_fetch)
            return 0;
        if (op > buffer && chars[(op - 1)] == ord(':') && chars[tc_fetch] == ord(':'))
            ++tc_fetch;
        strcpy(op, tc_fetch);
    }
    return buffer;
    } finally { stack_pop($frame); }
}

/* check whether `ent' contains `nam'; return start of field entries */
function tc_name(nam, ent) { /* char * */
    let nxt, lst, p = ent;
    let n = strlen(nam);

    if ((lst = strchr(p, ord(':'))) == 0)
        lst = p + strlen(p);

    while (p < lst) {
        if ((nxt = strchr(p, ord('|'))) == 0 || nxt > lst)
            nxt = lst;
        if ((nxt - p) == n && strncmp(p, nam, n) == 0)
            return lst;
        p = nxt + 1;
    }
    return 0;
}

/* look up a numeric entry */
export function tgetnum(which) { /* int */
    const $frame = stack_frame(); try {
    let q = stack_var(ptr_to(char)), p = tc_field(which, q);
    let numbuf = stack_array(char, 32);
    let n;

    if (!p || chars[p + 2] != ord('#'))
        return -1;
    p += 3;
    if ((n = unsigned((q[0] - p))) >= sizeof(array_of(char, 32)))
        return -1;
    strncpy(numbuf, p, n);
    chars[numbuf + n] = ord('\0');
    return atoi(numbuf);
    } finally { stack_pop($frame); }
}

/* look up a boolean entry */
export function tgetflag(which) { /* int */
    let p = tc_field(which, null);

    return (!p || chars[p + 2] != ord(':')) ? 0 : 1;
}

/* look up a string entry; update `*outptr' */
export function tgetstr(which, outptr) { /* char * */
    const $frame = stack_frame(); try {
    let n;
    let c, r, result;
    let q = stack_var(ptr_to(char)), p = tc_field(which, q);

    if (!p || chars[p + 2] != ord('='))
        return 0;
    p += 3;
    if ((q[0] = strchr(p, ord(':'))) == 0)
        q[0] = p + strlen(p);
    r = result = outptr[0];
    while (p < q[0]) {
        switch ((chars[r] = chars[p++])) {
        case ord('\\'):
            switch ((c = chars[p++])) {
            case ord('E'):
                chars[r] = ESC;
                break;
            case ord('a'):
                chars[r] = BEL;
                break;
            case ord('b'):
                chars[r] = ord('\b');
                break;
            case ord('f'):
                chars[r] = ord('\f');
                break;
            case ord('n'):
                chars[r] = ord('\n');
                break;
            case ord('r'):
                chars[r] = ord('\r');
                break;
            case ord('t'):
                chars[r] = ord('\t');
                break;
            case ord('0'):
            case ord('1'):
            case ord('2'):
            case ord('3'):
            case ord('4'):
            case ord('5'):
            case ord('6'):
            case ord('7'):
                n = c - ord('0');
                if (chars[p] >= ord('0') && chars[p] <= ord('7'))
                    n = 8 * n + (chars[p++] - ord('0'));
                if (chars[p] >= ord('0') && chars[p] <= ord('7'))
                    n = 8 * n + (chars[p++] - ord('0'));
                chars[r] = char(n);
                break;
            /* case '^': case '\\': */
            default:
                chars[r] = c;
                break;
            }
            break;
        case ord('^'):
            chars[r] = (chars[p++] & 0o37);
            if (!chars[r])
                chars[r] = ord('\x80');
            break;
        default:
            break;
        }
        ++r;
    }
    chars[r++] = ord('\0');
    outptr[0] = r;
    return result;
    } finally { stack_pop($frame); }
}

/* look for a particular field name */
function tc_field(field, tc_end) { /* const char * */
    let end, q, p = tc_entry[0];

    end = p + strlen(p);
    while (p < end) {
        if ((p = strchr(p, ord(':'))) == 0)
            break;
        ++p;
        if (chars[p + 0] == chars[field + 0] && chars[p + 1] == chars[field + 1]
            && (chars[p + 2] == ord(':') || chars[p + 2] == ord('=') || chars[p + 2] == ord('#') || chars[p + 2] == ord('@')))
            break;
    }
    if (tc_end) {
        if (p) {
            if ((q = strchr(p + 2, ord(':'))) == 0)
                q = end;
        } else
            q = 0;
        tc_end[0] = q;
    }
    return p;
}

const cmbuf = static_array("cmbuf", char, 64);

/* produce a string which will position the cursor at <row,col> if output */
export function tgoto(cm, col, row) { /* char * */
    return tparam(cm, cmbuf, sizeof(array_of(char, 64)), row, col, 0, 0);
}

/* format a parameterized string, ala sprintf */
export function tparam(ctl,
       buf,
       buflen,
       row, col, row2, col2) { /* char * */
    const $frame = stack_frame(); try {
    let atmp, ac, av = stack_array(int, 5);
    let c, r, z, bufend, numbuf = stack_array(char, 32);
    let fmt;

    let bc = 0, up = 0;

    av[0] = row, av[1] = col, av[2] = row2, av[3] = col2, av[4] = 0;
    ac = 0;
    r = buf, bufend = r + buflen - 1;
    while (chars[ctl]) {
        if ((chars[r] = chars[ctl++]) == ord('%')) {
            if (ac > 4)
                ac = 4;
            fmt = 0;
            switch ((c = chars[ctl++])) {
            case ord('%'):
                break; /* '%' already copied */
            case ord('d'):
                fmt = _("%d");
                break;
            case ord('2'):
                fmt = _("%02d");
                break;
            case ord('3'):
                fmt = _("%03d");
                break;
            case ord('+'): /*FALLTHRU*/
            case ord('.'):
                chars[r] = char((av[ac++]));
                if (c == ord('+'))
                    chars[r] += chars[ctl++];
                if (!chars[r]) {
                    chars[r] = ord('\x80');
                } else {
                    /* avoid terminal driver intervention for
                       various control characters, to prevent
                       LF from becoming CR+LF, for instance; only
                       makes sense if this is a cursor positioning
                       sequence, but we have no way to check that */
                    while (strchr(_("\x04\t\n\x0b\f\r"), chars[r])) {
                        if (ac & 1) { /* row */
                            if (!UP || !chars[UP])
                                break; /* can't fix */
                            ++up;      /* incr row now, later move up */
                        } else {       /* column */
                            if (!BC || !chars[BC])
                                break; /* can't fix */
                            ++bc;      /* incr column, later backspace */
                        }
                        (chars[r])++;
                    }
                }
                break;
            case ord('>'):
                if (av[ac] > (chars[ctl++] & 0o377))
                    av[ac] += chars[ctl];
                ++ctl;
                break;
            case ord('r'):
                atmp = av[0];
                av[0] = av[1];
                av[1] = atmp;
                atmp = av[2];
                av[2] = av[3];
                av[3] = atmp;
                --r;
                break;
            case ord('i'):
                ++av[0];
                ++av[1];
                ++av[2];
                ++av[3];
                --r;
                break;
            case ord('n'):
                av[0] ^= 0o140;
                av[1] ^= 0o140;
                av[2] ^= 0o140;
                av[3] ^= 0o140;
                --r;
                break;
            case ord('B'):
                av[0] = (Math.trunc(av[0] / 10) << 4) + (av[0] % 10);
                av[1] = (Math.trunc(av[1] / 10) << 4) + (av[1] % 10);
                av[2] = (Math.trunc(av[2] / 10) << 4) + (av[2] % 10);
                av[3] = (Math.trunc(av[3] / 10) << 4) + (av[3] % 10);
                --r;
                break;
            case ord('D'):
                av[0] -= (av[0] & 15) << 1;
                av[1] -= (av[1] & 15) << 1;
                av[2] -= (av[2] & 15) << 1;
                av[3] -= (av[3] & 15) << 1;
                --r;
                break;
            default:
                chars[++r] = c;
                break; /* erroneous entry... */
            }
            if (fmt) {
                sprintf(numbuf, fmt, av[ac++]);
                for (z = numbuf; chars[z] && r <= bufend; z++)
                    chars[r++] = chars[z];
                --r; /* will be re-incremented below */
            }
        }
        if (++r > bufend)
            return 0;
    }

    if (bc || up) {
        while (--bc >= 0)
            for (z = BC; chars[z] && r <= bufend; z++)
                chars[r++] = chars[z];
        while (--up >= 0)
            for (z = UP; chars[z] && r <= bufend; z++)
                chars[r++] = chars[z];
        if (r > bufend)
            return 0;
    }

    chars[r] = ord('\0');
    return buf;
    } finally { stack_pop($frame); }
}

/* send a string to the terminal, possibly padded with trailing NULs */
export function tputs(string,
      range,
      output_func) { /* void */ /* actual output routine; * return value ignored */
    let c, num = 0;
    let p = string;

    if (!p || !chars[p])
        return;

    /* pick out padding prefix, if any */
    if (chars[p] >= ord('0') && chars[p] <= ord('9')) {
        do { /* note: scale `num' by 10 to accommodate fraction */
            num += (chars[p++] - ord('0')), num *= 10;
        } while (chars[p] >= ord('0') && chars[p] <= ord('9'));
        if (chars[p] == ord('.'))
            ++p, num += (chars[p] >= ord('0') && chars[p] <= ord('9')) ? (chars[p++] - ord('0')) : 0;
        if (chars[p] == ord('*'))
            ++p, num *= range;
    }

    /* output the string */
    while ((c = chars[p++]) != ord('\0')) {
        if (c == ord('\x80'))
            c = ord('\0'); /* undo tgetstr's encoding */
        output_func(c);
    }

    /* perform padding */
    if (num) {
        let pad;

        /* figure out how many chars needed to produce desired elapsed time */
        pad = (baud_rates[ospeed]);
        if (pad < 0)
            pad *= -100;
        pad *= num;
        /* 100000 == 10 bits/char * (1000 millisec/sec scaled by 10) */
        num = int(Math.trunc(pad / 100000)); /* number of characters */

        c = PC; /* assume output_func isn't allowed to change PC */
        while (--num >= 0)
            output_func(c);
    }

    return;
}

/*tclib.c*/

import { SIZE } from "../../rt/cmacros.js";
import { char, int, ord, short, sizeof, unsigned } from "../../rt/ctypes.js";
import { global_scalar } from "../../rt/globals.js";
import { chars, stack_frame, stack_pop } from "../../rt/heap.js";
import {
    BUFSIZ, atoi, fclose, ferror, fgets, fopen, getenv, rewind, sprintf, strcat, strchr, strcmp,
    strcpy, strlen, strncmp, strncpy,
} from "../../rt/libc.js";
import { stack_array, stack_var, static_array, static_var } from "../../rt/locals.js";
import { _ } from "../../rt/strings.js";
import { array_of, ptr_to } from "../../rt/struct.js";
