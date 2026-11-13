/* NetHack 5.0  posixregex.c	$NHDT-Date: 1596498286 2020/08/03 23:44:46 $  $NHDT-Branch: NetHack-5.0 $:$NHDT-Revision: 1.7 $ */
/* Copyright (c) Sean Hunt  2015.                                 */
/* NetHack may be freely redistributed.  See license for details. */

/* The nhregex interface is implemented by several source files. The
 * file to be used can be linked in by the build.
 *
 * The regex standard implemented should be POSIX extended regular
 * expressions, see:
 *   http://pubs.opengroup.org/onlinepubs/009696899/basedefs/xbd_chap09.html
 * If an implementation uses an alternate expression format, this should
 * be clearly noted; this will result in incompatibility of config files
 * when NetHack is compiled with that implementation.
 *
 * struct nhregex
 * The nhregex structure is an opaque structure type containing the
 * information about a compiled regular expression.
 *
 * struct nhregex *regex_init(void)
 * Used to create a new instance of the nhregex structure. It is
 * uninitialized and can only safely be passed to regex_compile.
 *
 * boolean regex_compile(const char *s, struct nhregex *re)
 * Used to compile s into a regex and store it in re. Returns TRUE if
 * successful and FALSE otherwise. re is invalidated regardless of
 * success.
 *
 * boolean regex_match(const char *s, struct nhregex *re)
 * Used to determine if s (or any substring) matches the regex compiled
 * into re. Only valid if the most recent call to regex_compile on re
 * succeeded.
 *
 * void regex_free(struct nhregex *re)
 * Deallocate a regex object.
 *
 * char *regex_error_desc(struct nhregex *re, char *outbuf)
 * Used to retrieve an explanation for an error encountered by
 * regex_compile() or regex_match().  The explanation is copied into
 * outbuf[] and a pointer to that is returned.  regex_error_desc()
 * should be called before regex_free() but outbuf[] may be used after
 * that.  outbuf[] must be able to hold at least BUFSZ characters.
 *
 * One possible error result is "out of memory" so freeing the failed
 * re should be done to try to recover memory before issuing any error
 * feedback.
 */

export const regex_id = init_string(static_array("regex_id", char, sizeof_string("posixregex")), _("posixregex"), true);

const struct_nhregex = struct("struct_nhregex", {
    re: struct_re_pattern_buffer,
    err: int,
});

export function regex_init() { /* struct nhregex * */
    return view_of(struct_nhregex, addr_of(alloc(sizeof(struct_nhregex))));
}

export function regex_compile(s, re) { /* boolean */
    if (!re)
        return FALSE;
    if ((re.err = regcomp(re.re, s, REG_EXTENDED | REG_NOSUB)))
        return FALSE;
    return TRUE;
}

export function regex_error_desc(re, errbuf) { /* char * */
    if (!re) {
        strcpy(errbuf, _("no regexp"));
    } else if (!re.err) {
        strcpy(errbuf, _("no explanation"));
    } else {
        chars[errbuf + 0] = ord('\0');

        nhjs_regerror(re.err, re.re, errbuf, BUFSZ);
        if (!chars[errbuf + 0])
            strcpy(errbuf, _("unspecified regexp error"));
    }
    return errbuf;
}

export function regex_match(s, re) { /* boolean */
    let result;

    if (!re || !s)
        return FALSE;

    if ((result = regexec(re.re, s, 0, null, 0))) {
        if (result != REG_NOMATCH)
            re.err = result;
        return FALSE;
    }
    return TRUE;
}

export function regex_free(re) { /* void */
    regfree(re.re);
    free(addr_of(re));
}

/*posixregex.c*/

import { BUFSZ, FALSE, TRUE } from "../../src/global.h.js";
import { struct_re_pattern_buffer } from "../../libc/records.js";
import { char, int, ord, sizeof, sizeof_string } from "../../rt/ctypes.js";
import { chars } from "../../rt/heap.js";
import {
    REG_EXTENDED, REG_NOMATCH, REG_NOSUB, free, regcomp, regexec, regfree, strcpy,
} from "../../rt/libc.js";
import { init_string, static_array } from "../../rt/locals.js";
import { _ } from "../../rt/strings.js";
import { addr_of, struct, view_of } from "../../rt/struct.js";
import { alloc } from "../../src/alloc.js";
import { nhjs_regerror } from "../c2js/nhjs_host.js";
