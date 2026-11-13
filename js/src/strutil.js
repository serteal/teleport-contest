/* NetHack 5.0	strutil.c	$NHDT-Date: 1709571807 2024/03/04 17:03:27 $  $NHDT-Branch: keni-mdlib-followup $:$NHDT-Revision: 1.0 $ */
/* Copyright (c) Robert Patrick Rankin, 1991                      */
/* NetHack may be freely redistributed.  See license for details. */

/* strbuf_init() initializes strbuf state for use */
export function strbuf_init(strbuf) { /* void */
    strbuf.str = 0;
    strbuf.len = 0;
}

/* strbuf_append() appends given str to strbuf->str */
export function strbuf_append(strbuf, str) { /* void */
    let len = int(strlen(str)) + 1;

    strbuf_reserve(strbuf,
                   len + (strbuf.str ? int(strlen(strbuf.str)) : 0));
    strcat(strbuf.str, str);
}

/* strbuf_reserve() ensure strbuf->str has storage for len characters */
export function strbuf_reserve(strbuf, len) { /* void */
    if (strbuf.str == (0)) {
        strbuf.str = strbuf.buf;
        chars[strbuf.str + 0] = ord('\0');
        strbuf.len = sizeof_member(strbuf, "buf");
    }

    if (len > strbuf.len) {
        let oldbuf = strbuf.str;

        strbuf.len = len + sizeof_member(strbuf, "buf");
        strbuf.str = addr_of(alloc(unsigned(strbuf.len)));
        strcpy(strbuf.str, oldbuf);
        if (oldbuf != strbuf.buf)
            free(oldbuf);
    }
}

/* strbuf_empty() frees allocated memory and set strbuf to initial state */
export function strbuf_empty(strbuf) { /* void */
    if (strbuf.str != (0) && strbuf.str != strbuf.buf)
        free(strbuf.str);
    strbuf_init(strbuf);
}

/* strbuf_nl_to_crlf() converts all occurrences of \n to \r\n */
export function strbuf_nl_to_crlf(strbuf) { /* void */
    if (strbuf.str) {
        let len = int(strlen(strbuf.str));
        let count = 0;
        let cp = strbuf.str;

        while (chars[cp])
            if (chars[cp++] == ord('\n'))
                count++;
        if (count) {
            strbuf_reserve(strbuf, len + count + 1);
            for (cp = strbuf.str + len + count; count; --cp)
                if ((chars[cp] = chars[cp + (-count)]) == ord('\n')) {
                    chars[--cp] = ord('\r');
                    --count;
                }
        }
    }
}

/* strlen() but returns unsigned and panics if string is unreasonably long;
   used by dlb as well as by nethack */
export function Strlen_(
    str,
    file,
    line) { /* unsigned */
    let p;
    let len;

    /* strnlen(str, LARGEST_INT) w/o requiring posix.1 headers or libraries */
    for (p = str, len = 0; len < LARGEST_INT; ++len)
        if (chars[p++] == ord('\0'))
            break;

    if (len == LARGEST_INT)
        panic(_("%s:%d string too long"), file, line);
    return len;
}

/* guts of pmatch(), pmatchi(), and pmatchz();
   match a string against a pattern */
function pmatch_internal(patrn, strng,
                ci,

                sk) { /* boolean */ /* set of characters to skip */
    var s, p;
    /*
     *  Simple pattern matcher:  '*' matches 0 or more characters, '?' matches
     *  any single character.  Returns TRUE if 'strng' matches 'patrn'.
     */
 pmatch_top: for (;;) {
    if (!sk) {
        s = chars[strng++];
        p = chars[patrn++]; /* get next chars and pre-advance */
    } else {
        /* fuzzy match variant of pmatch; particular characters are ignored */
        do {
            s = chars[strng++];
        } while (strchr(sk, s));
        do {
            p = chars[patrn++];
        } while (strchr(sk, p));
    }
    if (!p)                           /* end of pattern */
        return (+(s == ord('\0'))); /* matches iff end of string too */
    else if (p == ord('*'))                /* wildcard reached */
        return ((!chars[patrn]
                           || pmatch_internal(patrn, strng - 1, ci, sk))
                          ? TRUE
                          : s ? pmatch_internal(patrn - 1, strng, ci, sk)
                              : FALSE);
    else if ((ci ? lowc(p) != lowc(s) : p != s) /* check single character */
             && (p != ord('?') || !s))               /* & single-char wildcard */
        return FALSE;                           /* doesn't match */
    else                 /* return pmatch_internal(patrn, strng, ci, sk); */
        continue pmatch_top;; break; } /* optimize tail recursion */
}

/* case-sensitive wildcard match */
export function pmatch(patrn, strng) { /* boolean */
    return pmatch_internal(patrn, strng, FALSE, 0);
}

/* case-insensitive wildcard match */
export function pmatchi(patrn, strng) { /* boolean */
    return pmatch_internal(patrn, strng, TRUE, 0);
}

/*strutil.c*/

import { FALSE, LARGEST_INT, TRUE } from "./global.h.js";
import { int, ord, unsigned } from "../rt/ctypes.js";
import { chars } from "../rt/heap.js";
import { free, strcat, strchr, strcpy, strlen } from "../rt/libc.js";
import { _ } from "../rt/strings.js";
import { addr_of, sizeof_member } from "../rt/struct.js";
import { alloc } from "./alloc.js";
import { panic } from "./end.js";
import { lowc } from "./hacklib.js";
