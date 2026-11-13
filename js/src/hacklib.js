/* NetHack 5.0	hacklib.c	$NHDT-Date: 1706213796 2024/01/25 20:16:36 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.116 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2007. */
/* Copyright (c) Robert Patrick Rankin, 1991                      */
/* NetHack may be freely redistributed.  See license for details. */

const struct_nh_qsort_index = struct("struct_nh_qsort_index", {
    idx: unsigned,
});

const nh_qsort_base = static_var("nh_qsort_base", ptr_to(uchar), 0);
const nh_qsort_size = static_var("nh_qsort_size", unsigned, 0);
const nh_qsort_cmp_fn = static_var("nh_qsort_cmp_fn", fnptr_t, null);

function nh_qsort_idx_cmp(va, vb) { /* int QSORTCALLBACK */
    let a = view_of(struct_nh_qsort_index, va);
    let b = view_of(struct_nh_qsort_index, vb);
    let c = (nh_qsort_cmp_fn[0])((nh_qsort_base[0] + unsigned(Math.imul(a.idx, nh_qsort_size[0]))),
                               (nh_qsort_base[0] + unsigned(Math.imul(b.idx, nh_qsort_size[0]))));
    if (c)
        return c;
    if (a.idx < b.idx)
        return -1;
    return +(a.idx > b.idx);
}

/* Deterministic replacement for libc qsort(), preserving original order
 * for equal-key elements regardless of platform libc behavior.
 */
export function nh_deterministic_qsort(base, nmemb, size,
                       compar) { /* void */
    let bytes = base;
    let order;
    let tmp;
    let i;

    if (!base || !compar || size == 0 || nmemb < 2)
        return;

    order = view_of(struct_nh_qsort_index, malloc(unsigned(Math.imul(nmemb, sizeof(struct_nh_qsort_index)))));
    tmp = malloc(unsigned(Math.imul(nmemb, size)));
    if (!order || !tmp) {
        if (tmp)
            free(tmp);
        if (order)
            free(addr_of(order));
        return;
    }
    for (i = 0; i < nmemb; ++i)
        ptr_add(order, i).idx = i;

    nh_qsort_base[0] = bytes;
    nh_qsort_size[0] = size;
    nh_qsort_cmp_fn[0] = compar;
    qsort(addr_of(order), nmemb, sizeof(struct_nh_qsort_index), nh_qsort_idx_cmp);

    for (i = 0; i < nmemb; ++i)
        memcpy((tmp + unsigned(Math.imul(i, size))),
                      (bytes + unsigned(Math.imul(ptr_add(order, i).idx, size))), size);
    memcpy(bytes, tmp, unsigned(Math.imul(nmemb, size)));

    free(tmp);
    free(addr_of(order));
}

/*=
    Assorted 'small' utility routines.  They're virtually independent of
    NetHack.

      return type     routine name    argument type(s)
        boolean         digit           (char)
        boolean         letter          (char)
        char            highc           (char)
        char            lowc            (char)
        char *          lcase           (char *)
        char *          ucase           (char *)
        char *          upstart         (char *)
        char *          upwords         (char *)
        char *          mungspaces      (char *)
        char *          trimspaces      (char *)
        char *          strip_newline   (char *)
        char *          stripchars      (char *, const char *, const char *)
        char *          stripdigits     (char *)
        char *          eos             (char *)
        const char *    c_eos           (const char *)
        boolean         str_start_is    (const char *, const char *, boolean)
        boolean         str_end_is      (const char *, const char *)
        int             str_lines_maxlen (const char *)
        char *          strkitten       (char *,char)
        void            copynchars      (char *,const char *,int)
        char            chrcasecpy      (int,int)
        char *          strcasecpy      (char *,const char *)
        char *          s_suffix        (const char *)
        char *          ing_suffix      (const char *)
        char *          xcrypt          (const char *, char *)
        boolean         onlyspace       (const char *)
        char *          tabexpand       (char *)
        char *          visctrl         (char)
        char *          strsubst        (char *, const char *, const char *)
        int             strNsubst       (char *,const char *,const char *,int)
        const char *    findword        (const char *,const char *,int,boolean)
        const char *    ordin           (int)
        char *          sitoa           (int)
        int             sgn             (int)
        int             distmin         (coordxy, coordxy, coordxy, coordxy)
        int             dist2           (coordxy, coordxy, coordxy, coordxy)
        boolean         online2         (coordxy, coordxy)
        int             strncmpi        (const char *, const char *, int)
        char *          strstri         (const char *, const char *)
        boolean         fuzzymatch      (const char *, const char *,
                                         const char *, boolean)
        int             swapbits        (int, int, int)
        void            nh_snprintf     (const char *, int, char *, size_t,
                                         const char *, ...)
=*/

/* is 'c' a digit? */
export function digit(c) { /* boolean */
    return (+(ord('0') <= c && c <= ord('9')));
}

/* is 'c' a letter?  note: '@' classed as letter */
export function letter(c) { /* boolean */
    return ((+(ord('@') <= c && c <= ord('Z'))) || (ord('a') <= c && c <= ord('z')) ? 1 : 0);
}

/* force 'c' into uppercase */
export function highc(c) { /* char */
    return char(((ord('a') <= c && c <= ord('z')) ? (c & ~0o40) : c));
}

/* force 'c' into lowercase */
export function lowc(c) { /* char */
    return char(((ord('A') <= c && c <= ord('Z')) ? (c | 0o40) : c));
}

/* convert a string into all lowercase */
export function lcase(s) { /* char * */
    let p;

    for (p = s; chars[p]; p++)
        if (ord('A') <= chars[p] && chars[p] <= ord('Z'))
            chars[p] |= 0o40;
    return s;
}

/* convert a string into all uppercase */
export function ucase(s) { /* char * */
    let p;

    for (p = s; chars[p]; p++)
        if (ord('a') <= chars[p] && chars[p] <= ord('z'))
            chars[p] &= ~0o40;
    return s;
}

/* convert first character of a string to uppercase */
export function upstart(s) { /* char * */
    if (s)
        chars[s] = highc(chars[s]);
    return s;
}

/* capitalize first letter of every word in a string (in place) */
export function upwords(s) { /* char * */
    let p;
    let space = TRUE;

    for (p = s; chars[p]; p++)
        if (chars[p] == ord(' ')) {
            space = TRUE;
        } else if (space && letter(chars[p])) {
            chars[p] = highc(chars[p]);
            space = FALSE;
        } else {
            space = FALSE;
        }
    return s;
}

/* remove excess whitespace from a string buffer (in place) */
export function mungspaces(bp) { /* char * */
    let c, p, p2;
    let was_space = TRUE;

    for (p = p2 = bp; (c = chars[p]) != ord('\0'); p++) {
        if (c == ord('\n'))
            break; /* treat newline the same as end-of-string */
        if (c == ord('\t'))
            c = ord(' ');
        if (c != ord(' ') || !was_space)
            chars[p2++] = c;
        was_space = +(c == ord(' '));
    }
    if (was_space && p2 > bp)
        p2--;
    chars[p2] = ord('\0');
    return bp;
}

/* skip leading whitespace; remove trailing whitespace, in place */
export function trimspaces(txt) { /* char * */
    let end;

    /* leading whitespace will remain in the buffer */
    while (chars[txt] == ord(' ') || chars[txt] == ord('\t'))
        txt++;
    end = eos(txt);
    while (--end >= txt && (chars[end] == ord(' ') || chars[end] == ord('\t')))
        chars[end] = ord('\0');

    return txt;
}

/* remove \n from end of line; remove \r too if one is there */
export function strip_newline(str) { /* char * */
    let p = strrchr(str, ord('\n'));

    if (p) {
        if (p > str && chars[(p - 1)] == ord('\r'))
            --p;
        chars[p] = ord('\0');
    }
    return str;
}

/* return the end of a string (pointing at '\0') */
export function eos(s) { /* char * */
    while (chars[s])
        s++; /* s += strlen(s); */
    return s;
}

/* version of eos() which takes a const* arg and returns that result */
export function c_eos(s) { /* const char * */
    while (chars[s])
        s++; /* s += strlen(s); */
    return s;
}

/* determine whether 'str' starts with 'chkstr', possibly ignoring case;
 * panics on huge strings */
export function str_start_is(
    str,
    chkstr,
    caseblind) { /* boolean */
    let t1, t2;
    let n = LARGEST_INT;

    while (--n) {
        if (!chars[str])
            return +(chars[chkstr] == 0); /* chkstr >= str */
        else if (!chars[chkstr])
            return TRUE; /* chkstr < str */
        t1 = caseblind ? lowc(chars[str]) : chars[str];
        t2 = caseblind ? lowc(chars[chkstr]) : chars[chkstr];
        str++, chkstr++;
        if (t1 != t2)
            return FALSE;
    }

    return TRUE;
}

/* determine whether 'str' ends in 'chkstr' */
export function str_end_is(str, chkstr) { /* boolean */
    let clen = int(strlen(chkstr));

    if (int(strlen(str)) >= clen)
        return (+!strncmp(eos(str) - clen, chkstr, unsigned(clen)));
    return FALSE;
}

/* return max line length from buffer comprising newline-separated strings */
export function str_lines_maxlen(str) { /* int */
    let s1, s2;
    let len, max_len = 0;

    s1 = str;
    while (s1 && chars[s1]) {
        s2 = strchr(s1, ord('\n'));
        if (s2) {
            len = (s2 - s1);
            s1 = s2 + 1;
        } else {
            len = int(strlen(s1));
            s1 = 0;
        }
        if (len > max_len)
            max_len = len;
    }

    return max_len;
}

/* append a character to a string (in place): strcat(s, {c,'\0'}); */
export function strkitten(s, c) { /* char * */
    let p = eos(s);

    chars[p++] = c;
    chars[p] = ord('\0');
    return s;
}

/* truncating string copy */
export function copynchars(dst, src, n) { /* void */
    /* copies at most n characters, stopping sooner if terminator reached;
       treats newline as input terminator; unlike strncpy, always supplies
       '\0' terminator so dst must be able to hold at least n+1 characters */
    while (n > 0 && chars[src] != ord('\0') && chars[src] != ord('\n')) {
        chars[dst++] = chars[src++];
        --n;
    }
    chars[dst] = ord('\0');
}

/* convert char nc into oc's case; mostly used by strcasecpy */
export function chrcasecpy(oc, nc) { /* char */
    if (ord('a') <= oc && oc <= ord('z')) {
        /* old char is lower case; if new char is upper case, downcase it */
        if (ord('A') <= nc && nc <= ord('Z'))
            nc += ord('a') - ord('A'); /* lowc(nc) */
    } else if (ord('A') <= oc && oc <= ord('Z')) {
        /* old char is upper case; if new char is lower case, upcase it */
        if (ord('a') <= nc && nc <= ord('z'))
            nc += ord('A') - ord('a'); /* highc(nc) */
    }
    return char(nc);
}

/* overwrite string, preserving old chars' case;
   for case-insensitive editions of makeplural() and makesingular();
   src might be shorter, same length, or longer than dst */
export function strcasecpy(dst, src) { /* char * */
    let result = dst;
    let ic, oc, dst_exhausted = 0;

    /* while dst has characters, replace each one with corresponding
       character from src, converting case in the process if they differ;
       once dst runs out, propagate the case of its last character to any
       remaining src; if dst starts empty, it must be a pointer to the
       tail of some other string because we examine the char at dst[-1] */
    while ((ic = (chars[src++])) != ord('\0')) {
        if (!dst_exhausted && !chars[dst])
            dst_exhausted = 1;
        oc = (chars[(dst - dst_exhausted)]);
        chars[dst++] = chrcasecpy(oc, ic);
    }
    chars[dst] = ord('\0');
    return result;
}

/* return a name converted to possessive */
export function s_suffix(s) { /* char * */
    let buf = static_array("s_suffix.buf", char, BUFSZ);

    strcpy(buf, s);
    if (!strncmpi((buf), _(("it")), -1)) /* it -> its */
        strcat(buf, _("s"));
    else if (!strncmpi((buf), _(("you")), -1)) /* you -> your */
        strcat(buf, _("r"));
    else if (chars[(eos(buf) - 1)] == ord('s')) /* Xs -> Xs' */
        strcat(buf, _("'"));
    else /* X -> X's */
        strcat(buf, _("'s"));
    return buf;
}

/* construct a gerund (a verb formed by appending "ing" to a noun) */
export function ing_suffix(s) { /* char * */
    const $frame = stack_frame(); try {
    let vowel = init_string(static_array("ing_suffix.vowel", char, sizeof_string("aeiouwy")), _("aeiouwy"), true);
    let buf = static_array("ing_suffix.buf", char, BUFSZ);
    let onoff = stack_array(char, 10);
    let p;

    strcpy(buf, s);
    p = eos(buf);
    chars[onoff + 0] = chars[p] = chars[(p + 1)] = ord('\0');
    if ((p >= buf + 3 && !strncmpi((p - 3), _((" on")), -1))
        || (p >= buf + 4 && !strncmpi((p - 4), _((" off")), -1))
        || (p >= buf + 5 && !strncmpi((p - 5), _((" with")), -1))) {
        p = strrchr(buf, ord(' '));
        strcpy(onoff, p);
        chars[p] = ord('\0');
    }
    if (p >= buf + 2 && !strncmpi((p - 2), _(("er")), -1)) { /* slither + ing */
        /* nothing here */
    } else if (p >= buf + 3 && !strchr(vowel, chars[(p - 1)])
        && strchr(vowel, chars[(p - 2)]) && !strchr(vowel, chars[(p - 3)])) {
        /* tip -> tipp + ing */
        chars[p] = chars[(p - 1)];
        chars[(p + 1)] = ord('\0');
    } else if (p >= buf + 2 && !strncmpi((p - 2), _(("ie")), -1)) { /* vie -> vy + ing */
        chars[(p - 2)] = ord('y');
        chars[(p - 1)] = ord('\0');
    } else if (p >= buf + 1 && chars[(p - 1)] == ord('e')) /* grease -> greas + ing */
        chars[(p - 1)] = ord('\0');
    strcat(buf, _("ing"));
    if (chars[onoff + 0])
        strcat(buf, onoff);
    return buf;
    } finally { stack_pop($frame); }
}

/* trivial text encryption routine (see makedefs) */
export function xcrypt(str, buf) { /* char * */
    let p;
    let q;
    let bitmask;

    for (bitmask = 1, p = str, q = buf; chars[p]; q++) {
        chars[q] = chars[p++];
        if (chars[q] & (32 | 64))
            chars[q] ^= bitmask;
        if ((bitmask <<= 1) >= 32)
            bitmask = 1;
    }
    chars[q] = ord('\0');
    return buf;
}

/* is a string entirely whitespace? */
export function onlyspace(s) { /* boolean */
    for (; chars[s]; s++)
        if (chars[s] != ord(' ') && chars[s] != ord('\t'))
            return FALSE;
    return TRUE;
}

/* expand tabs into proper number of spaces (in place) */
export function tabexpand(
    sbuf) { /* char * */ /* assumed to be [BUFSZ] but can be smaller provided that * expanded string fits; expansion bigger than BUFSZ-1 * will be truncated */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ + 10);
    let bp, s = sbuf;
    let idx;

    if (!chars[s])
        return sbuf;
    for (bp = buf, idx = 0; chars[s]; s++) {
        if (chars[s] == ord('\t')) {
            /*
             * clang-8's optimizer at -Os has been observed to mis-compile
             * this code.  Symptom is nethack getting stuck in an apparent
             * infinite loop (or perhaps just an extremely long one) when
             * examining data.base entries.
             * clang-9 doesn't exhibit this problem.  [Was the incorrect
             * optimization fixed or just disabled?]
             */
            do
                chars[bp++] = ord(' ');
            while (++idx % 8);
        } else {
            chars[bp++] = chars[s];
            ++idx;
        }
        if (idx >= BUFSZ) {
            bp = buf + (BUFSZ - 1);
            break;
        }
    }
    chars[bp] = 0;
    return strcpy(sbuf, buf);
    } finally { stack_pop($frame); }
}

export const VISCTRL_NBUF = 5;
/* make a displayable string from a character */
export function visctrl(c) { /* char * */
    let visctrl_bufs = static_array("visctrl.visctrl_bufs", array_of(char, 5), VISCTRL_NBUF);
    let nbuf = static_var("visctrl.nbuf", int, 0);
    let i = 0;
    let ccc = visctrl_bufs[nbuf[0]];
    nbuf[0] = (nbuf[0] + 1) % VISCTRL_NBUF;

    if (uchar(c) & 0o200) {
        chars[ccc + (i++)] = ord('M');
        chars[ccc + (i++)] = ord('-');
    }
    c &= 0o177;
    if (c < 0o40) {
        chars[ccc + (i++)] = ord('^');
        chars[ccc + (i++)] = c | 0o100; /* letter */
    } else if (c == 0o177) {
        chars[ccc + (i++)] = ord('^');
        chars[ccc + (i++)] = c & ~0o100; /* '?' */
    } else {
        chars[ccc + (i++)] = c; /* printable character */
    }
    chars[ccc + i] = ord('\0');
    return ccc;
}

/* strip all the chars in stuff_to_strip from orig */
/* caller is responsible for ensuring that bp is a
   valid pointer to a BUFSZ buffer */
export function stripchars(
    bp,
    stuff_to_strip,
    orig) { /* char * */
    let i = 0;
    let s = bp;

    while (chars[orig] && i < (BUFSZ - 1)) {
        if (!strchr(stuff_to_strip, chars[orig])) {
            chars[s++] = chars[orig];
            i++;
        }
        orig++;
    }
    chars[s] = ord('\0');

    return bp;
}

/* remove digits from string */
export function stripdigits(s) { /* char * */
    let s1, s2;

    for (s1 = s2 = s; chars[s1]; s1++)
        if (chars[s1] < ord('0') || chars[s1] > ord('9'))
            chars[s2++] = chars[s1];
    chars[s2] = ord('\0');

    return s;
}

/* substitute a word or phrase in a string (in place);
   caller is responsible for ensuring that bp points to big enough buffer */
export function strsubst(
    bp,
    orig,
    replacement) { /* char * */
    const $frame = stack_frame(); try {
    let found, buf = stack_array(char, BUFSZ);
    /* [this could be replaced by strNsubst(bp, orig, replacement, 1)] */

    found = strstr(bp, orig);
    if (found) {
        strcpy(buf, found + strlen(orig));
        strcpy(found, replacement);
        strcat(bp, buf);
    }
    return bp;
    } finally { stack_pop($frame); }
}

/* substitute the Nth occurrence of a substring within a string (in place);
   if N is 0, substitute all occurrences; returns the number of substitutions;
   maximum output length is BUFSZ (BUFSZ-1 chars + terminating '\0') */
export function strNsubst(
    inoutbuf,
    orig,
    replacement,
    n) { /* int */ /* which occurrence to replace; 0 => all */
    const $frame = stack_frame(); try {
    let bp, op, workbuf = stack_array(char, BUFSZ);
    let rp;
    let len = strlen(orig);
    let ocount = 0,
        rcount = 0; /* number of substitutions made */

    for (bp = inoutbuf, op = workbuf; chars[bp] && op < workbuf + (BUFSZ - 1); ) {
        if ((!len || !strncmp(bp, orig, len)) && (++ocount == n || n == 0)) {
            /* Nth match found */
            for (rp = replacement; chars[rp] && op < workbuf + (BUFSZ - 1); )
                chars[op++] = chars[rp++];
            ++rcount;
            if (len) {
                bp += len; /* skip 'orig' */
                continue;
            }
        }
        /* no match (or len==0) so retain current character */
        chars[op++] = chars[bp++];
    }
    if (!len && n == ocount + 1) {
        /* special case: orig=="" (!len) and n==strlen(inoutbuf)+1,
           insert in front of terminator (in other words, append);
           [when orig=="", ocount will have been incremented once for
           each input char] */
        for (rp = replacement; chars[rp] && op < workbuf + (BUFSZ - 1); )
            chars[op++] = chars[rp++];
        ++rcount;
    }
    if (rcount) {
        chars[op] = ord('\0');
        strcpy(inoutbuf, workbuf);
    }
    return rcount;
    } finally { stack_pop($frame); }
}

/* search for a word in a space-separated list; returns non-Null if found */
export function findword(
    list,
    word,
    wordlen,
    ignorecase) { /* const char * */ /* T: case-blind, F: case-sensitive */
    let p = list;

    while (p) {
        while (chars[p] == ord(' '))
            ++p;
        if (!chars[p])
            break;
        if ((ignorecase ? !strncmpi(p, word, wordlen)
                        : !strncmp(p, word, unsigned(wordlen)))
            && (chars[p + wordlen] == ord('\0') || chars[p + wordlen] == ord(' ')))
            return p;
        p = strchr(p + 1, ord(' '));
    }
    return 0;
}

/* return the ordinal suffix of a number */
export function ordin(n) { /* const char * */ /* note: should be non-negative */
    let dd = n % 10;

    return (dd == 0 || dd > 3 || Math.trunc((n % 100) / 10) == 1) ? _("th")
               : (dd == 1) ? _("st") : (dd == 2) ? _("nd") : _("rd");
}

  /* one compiler complains about
                                      result of ?: for format string */

/* make a signed digit string from a number */
export function sitoa(n) { /* char * */
    let buf = static_array("sitoa.buf", char, 13);

    sprintf(buf, (n < 0) ? _("%d") : _("+%d"), n);
    return buf;
}

/* return the sign of a number: -1, 0, or 1 */
export function sgn(n) { /* int */
    return (n < 0) ? -1 : +(n != 0);
}

/* distance between two points, in moves */
export function distmin(x0, y0, x1, y1) { /* int */
    let dx = x0 - x1, dy = y0 - y1;

    if (dx < 0)
        dx = -dx;
    if (dy < 0)
        dy = -dy;
    /*  The minimum number of moves to get from (x0,y0) to (x1,y1) is the
     *  larger of the [absolute value of the] two deltas.
     */
    return (dx < dy) ? dy : dx;
}

/* square of Euclidean distance between pair of pts */
export function dist2(x0, y0, x1, y1) { /* int */
    let dx = x0 - x1, dy = y0 - y1;

    return dx * dx + dy * dy;
}

/* integer square root function without using floating point */
export function isqrt(val) { /* int */
    let rt = 0;
    let odd = 1;
    /*
     * This could be replaced by a faster algorithm, but has not been because:
     * + the simple algorithm is easy to read;
     * + this algorithm does not require 64-bit support;
     * + in current usage, the values passed to isqrt() are not really that
     *   large, so the performance difference is negligible;
     * + isqrt() is used in only few places, which are not bottle-necks.
     */
    while (val >= odd) {
        val = val - odd;
        odd = odd + 2;
        rt = rt + 1;
    }
    return rt;
}

/* are two points lined up (on a straight line)? */
export function online2(x0, y0, x1, y1) { /* boolean */
    let dx = x0 - x1, dy = y0 - y1;
    /*  If either delta is zero then they're on an orthogonal line,
     *  else if the deltas are equal (signs ignored) they're on a diagonal.
     */
    return (+(!dy || !dx || dy == dx || dy == -dx));
}

/* case-insensitive counted string comparison */
/*{ aka strncasecmp }*/
export function strncmpi(
    s1, s2,
    n) { /* int */ /*(should probably be size_t, which is unsigned)*/
    let t1, t2;

    while (n--) {
        if (!chars[s2])
            return +(chars[s1] != 0); /* s1 >= s2 */
        else if (!chars[s1])
            return -1; /* s1  < s2 */
        t1 = lowc(chars[s1++]);
        t2 = lowc(chars[s2++]);
        if (t1 != t2)
            return (t1 > t2) ? 1 : -1;
    }
    return 0; /* s1 == s2 */
}

/* case-insensitive substring search */
export function strstri(str, sub) { /* char * */
    const $frame = stack_frame(); try {
    let s1, s2;
    let i, k;

    let tstr = stack_array(char, TABSIZ), tsub = stack_array(char, TABSIZ); /* nibble count tables */

    /* special case: empty substring */
    if (!chars[sub])
        return str;

    /* do some useful work while determining relative lengths */
    for (i = 0; i < TABSIZ; i++)
        chars[tstr + i] = chars[tsub + i] = 0; /* init */
    for (k = 0, s1 = str; chars[s1]; k++)
        chars[tstr + (chars[s1++] & (TABSIZ - 1))]++;
    for (s2 = sub; chars[s2]; --k)
        chars[tsub + (chars[s2++] & (TABSIZ - 1))]++;

    /* evaluate the info we've collected */
    if (k < 0)
        return 0;       /* sub longer than str, so can't match */
    for (i = 0; i < TABSIZ; i++) /* does sub have more 'x's than str? */
        if (chars[tsub + i] > chars[tstr + i])
            return 0; /* match not possible */

    /* now actually compare the substring repeatedly to parts of the string */
    for (i = 0; i <= k; i++) {
        s1 = str + i;
        s2 = sub;
        while (lowc(chars[s1++]) == lowc(chars[s2++]))
            if (!chars[s2])
                return (str + i); /* full match */
    }
    return 0; /* not found */
    } finally { stack_pop($frame); }
}
export const TABSIZ = 0x20;

/* compare two strings for equality, ignoring the presence of specified
   characters (typically whitespace) and possibly ignoring case */
export function fuzzymatch(
    s1, s2,
    ignore_chars,
    caseblind) { /* boolean */
    let c1, c2;

    do {
        while ((c1 = chars[s1++]) != ord('\0') && strchr(ignore_chars, c1) != 0)
            continue;
        while ((c2 = chars[s2++]) != ord('\0') && strchr(ignore_chars, c2) != 0)
            continue;
        if (!c1 || !c2)
            break; /* stop when end of either string is reached */

        if (caseblind) {
            c1 = lowc(c1);
            c2 = lowc(c2);
        }
    } while (c1 == c2);

    /* match occurs only when the end of both strings has been reached */
    return (+(!c1 && !c2));
}

/*
 * Time routines
 *
 * The time is used for:
 *  - seed for rand()
 *  - year on tombstone and yyyymmdd in record file
 *  - phase of the moon (various monsters react to NEW_MOON or FULL_MOON)
 *  - night and midnight (the undead are dangerous at midnight)
 *  - determination of what files are "very old"
 */

/* TIME_type: type of the argument to time(); we actually use &(time_t);
   you might need to define either or both of these to 'long *' in *conf.h */

/* swapbits(val, bita, bitb) swaps bit a with bit b in val */
export function swapbits(val, bita, bitb) { /* int */
    let tmp = ((val >> bita) & 1) ^ ((val >> bitb) & 1);

    return (val ^ ((tmp << bita) | (tmp << bitb)));
}

/*
 * Wrap snprintf for use in the main code.
 *
 * Wrap reasons:
 *   1. If there are any platform issues, we have one spot to fix them -
 *      snprintf is a routine with a troubling history of bad implementations.
 *   2. Add cumbersome error checking in one spot.  Problems with text
 *      wrangling do not have to be fatal.
 *   3. Gcc 9+ will issue a warning unless the return value is used.
 *      Annoyingly, explicitly casting to void does not remove the error.
 *      So, use the result - see reason #2.
 */
export function nh_snprintf(
    func, line,
    str, size,
    fmt, ...args) { /* void */
    let ap;
    let n;

    ap = va_start(args);
    n = vsnprintf(str, size, fmt, ap);
    va_end(ap);
    if (n < 0 || unsigned(n) >= size) { /* is there a problem? */
        chars[str + unsigned(size - 1)] = ord('\0'); /* make sure it is nul terminated */
    }
}

/* Unicode routines */

export function unicodeval_to_utf8str(uval, buffer, bufsz) { /* int */
    //    static uint8 buffer[7];
    let b = buffer;

    if (bufsz < 5)
        return 0;
    /*
     *   Binary   Hex        Comments
     *   0xxxxxxx 0x00..0x7F Only byte of a 1-byte character encoding
     *   10xxxxxx 0x80..0xBF Continuation byte : one of 1-3 bytes following
     * first 110xxxxx 0xC0..0xDF First byte of a 2-byte character encoding
     *   1110xxxx 0xE0..0xEF First byte of a 3-byte character encoding
     *   11110xxx 0xF0..0xF7 First byte of a 4-byte character encoding
     */
    uchars[b] = ord('\0');
    if (uval < 0x80) {
        uchars[b++] = uchar(uval);
    } else if (uval < 0x800) {
        uchars[b++] = uchar(192 + Math.trunc(uval / 64));
        uchars[b++] = 128 + uval % 64;
    } else if (unsigned(unsigned(uval) - 0xd800) < 0x800) {
        return 0;
    } else if (uval < 0x10000) {
        uchars[b++] = uchar(224 + Math.trunc(uval / 4096));
        uchars[b++] = 128 + Math.trunc(uval / 64) % 64;
        uchars[b++] = 128 + uval % 64;
    } else if (uval < 0x110000) {
        uchars[b++] = uchar(240 + Math.trunc(uval / 262144));
        uchars[b++] = 128 + Math.trunc(uval / 4096) % 64;
        uchars[b++] = 128 + Math.trunc(uval / 64) % 64;
        uchars[b++] = 128 + uval % 64;
    } else {
        return 0;
    }
    uchars[b] = ord('\0'); /* NUL terminate */
    return 1;
}

export function case_insensitive_comp(s1, s2) { /* int */
    let u1, u2;

    for (;; s1++, s2++) {
        u1 = uchar((chars[s1]));
        if ((0 ? isupper(u1) : ((unsigned(((u1) - ord("A")))) < 26)))
            u1 = uchar(tolower(u1));
        u2 = uchar((chars[s2]));
        if ((0 ? isupper(u2) : ((unsigned(((u2) - ord("A")))) < 26)))
            u2 = uchar(tolower(u2));
        if (u1 == ord('\0') || u1 != u2)
            break;
    }
    return u1 - u2;
}

export function copy_bytes(ifd, ofd) { /* boolean */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSIZ);
    let nfrom, nto;

    do {
        nto = 0;
        nfrom = read(ifd, buf, BUFSIZ);
        /* read can return -1 */
        if (nfrom >= 0 && nfrom <= BUFSIZ)
            nto = write(ofd, buf, unsigned(nfrom));
        if (nto != nfrom || nfrom < 0)
            return FALSE;
    } while (nfrom == BUFSIZ);
    return TRUE;
    } finally { stack_pop($frame); }
}

export const MAX_D = 5;
const struct_datamodel_information = struct("struct_datamodel_information", {
    sz: array_of(int, MAX_D),
    datamodel: ptr_to(char),
    dmplatform: ptr_to(char),
});

const dm = static_array("dm", struct_datamodel_information, null, [
    { sz: [ sizeof(short), sizeof(int), sizeof(long),
        sizeof(long), sizeof(ptr_to(void_t)) ],
      datamodel: _(""), dmplatform: _("") },
    { sz: [ 2, 4, 4, 8, 4 ], datamodel: _("ILP32LL64"), dmplatform: _("x86 32-bit") }, /* Windows or Unix */
    { sz: [ 2, 4, 4, 8, 8 ], datamodel: _("IL32LLP64"), dmplatform: _("Windows x64 64-bit") },
    { sz: [ 2, 4, 8, 8, 8 ], datamodel: _("I32LP64"), dmplatform: _("Unix 64-bit")},
    { sz: [ 2, 8, 8, 8, 8 ], datamodel: _("ILP64"), dmplatform: _("Unix ILP64")},      /* HAL, SPARC64 */
]);

export function datamodel(retidx) { /* const char * */
    let i, j, matchcount;
    let unknown = static_var("datamodel.unknown", ptr_to(char), _("Unknown"));

    for (i = 1; i < SIZE(dm); ++i) {
        matchcount = 0;
        for (j = 0; j < MAX_D; ++j) {
            if (dm[0].sz[j] == dm[i].sz[j])
                ++matchcount;
        }
        if (matchcount == MAX_D)
            return (retidx == 0) ? dm[i].datamodel : dm[i].dmplatform;
    }
    return unknown[0];
}

export function what_datamodel_is_this(retidx, szshort, szint, szlong, szll,
                       szptr) { /* const char * */
    let i;
    let unknown = static_var("what_datamodel_is_this.unknown", ptr_to(char), _("Unknown"));

    for (i = 1; i < SIZE(dm); ++i) {
        if (szshort == dm[i].sz[0] && szint == dm[i].sz[1]
            && szlong == dm[i].sz[2] && szll == dm[i].sz[3]
            && szptr == dm[i].sz[4])
            return (retidx == 0) ? dm[i].datamodel : dm[i].dmplatform;
    }
    return unknown[0];
}

/*hacklib.c*/

import { BUFSZ, FALSE, LARGEST_INT, TRUE } from "./global.h.js";
import { SIZE } from "../rt/cmacros.js";
import {
    char, int, long, ord, short, sizeof, sizeof_string, uchar, unsigned,
} from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import {
    BUFSIZ, free, isupper, malloc, memcpy, qsort, read, sprintf, strcat, strchr, strcpy, strlen,
    strncmp, strrchr, strstr, tolower, vsnprintf, write,
} from "../rt/libc.js";
import { init_string, stack_array, static_array, static_var } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, fnptr_t, ptr_add, ptr_to, struct, view_of, void_t,
} from "../rt/struct.js";
import { va_end, va_start } from "../rt/varargs.js";
