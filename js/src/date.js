/* NetHack 5.0  date.c  $NHDT-Date: 1655402414 2022/06/16 18:00:14 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.3 $ */
/* Copyright (c) Michael Allison, 2021.                           */
/* NetHack may be freely redistributed.  See license for details. */

export function Snprintf(str, size, ...args) { return nh_snprintf(_("Snprintf"), 0, str, size, ...args); }

/* these are in extern.h but we don't include hack.h */

/* nomakedefs_populated: flag for whether 'nomakedefs' should be freed */
const nomakedefs_populated = static_var("nomakedefs_populated", int, 0);

export const nomakedefs = static_struct("nomakedefs", struct_nomakedefs_s, {
    /* https://groups.google.com/forum/#!original/
       comp.sources.games/91SfKYg_xzI/dGnR3JnspFkJ */
    build_date: _("Tue, 28-Jul-87 13:18:57 EDT"),
    copyright_banner_c: _("Version 1.0, built Jul 28 13:18:57 1987."),
    git_sha: 0,   /* git_sha */
    git_branch: 0,   /* git_branch */
    git_prefix: 0,   /* git_prefix */
    version_string: _("1.0.0-0"),
    version_id: _("NetHack Version 1.0.0-0 - last build Tue Jul 28 13:18:57 1987."),
    version_number: 0x01010000,
    version_features: 0x00000000,
    ignored_features: 0x00000000,
    version_sanity1: 0x00000000,
    build_time: 554476737,
});

export function populate_nomakedefs(version) { /* void */
    const $frame = stack_frame(); try {
    let i;
    let tmpbuf1 = stack_array(char, BUFSZ), tmpbuf2 = stack_array(char, BUFSZ), strp;
    let mth = stack_array(ptr_to(char), null, [
        _("Jan"), _("Feb"), _("Mar"), _("Apr"), _("May"), _("Jun"),
        _("Jul"), _("Aug"), _("Sep"), _("Oct"), _("Nov"), _("Dec")]);
    let t = init_list(stack_struct(struct_tm), {tm_sec: 0});
    let timeresult;

    /*
     * In a cross-compiled environment, you can't execute
     * the target binaries during the build, so we can't
     * use makedefs to write the values of the build
     * date and time to a file for retrieval. Not for
     * information meaningful to the target execution
     * environment.
     *
     * How can we capture the build date/time of the target
     * binaries in such a situation?  We need to rely on the
     * cross-compiler itself to do it for us during the
     * cross-compile.
     *
     * To that end, we are going to make use of the
     * following pre-defined preprocessor macros for this:
     *    gcc, msvc, clang   __DATE__  "Feb 12 1996"
     *    gcc, msvc, clang   __TIME__  "23:59:01"
     *
     */

    /* Deterministic build banner: pin the "build date" string to a
     * fixed value so the rendered version banner matches across
     * recordings made on different machines / different days. The
     * format must be 20 chars "Mon DD YYYY HH:MM:SS" — same shape as
     * __DATE__ " " __TIME__ — because the surrounding code parses
     * fixed offsets out of it (year at 7, mday at 4, hour at 12, …).
     * Set NETHACK_REAL_BUILD_DATE in env to opt out of pinning. */
    Snprintf(tmpbuf1, sizeof(array_of(char, BUFSZ)), _("%s"), getenv(_("NETHACK_REAL_BUILD_DATE")) ? _("Jan  1 2026 00:00:00") : _("May  2 2026 12:00:00"))
;
    /* "Feb 12 1996 23:59:01"
        01234567890123456789  */
    if (int(strlen(tmpbuf1)) == 20) {
        do { for (i = 0; (i < 4); ++i) chars[tmpbuf2 + i] = chars[tmpbuf1 + (i + 7)]; chars[tmpbuf2 + i] = ord("\x00"); } while (0);   /* year */
        t.tm_year = atoi(tmpbuf2) - 1900;
        do { for (i = 0; (i < 3); ++i) chars[tmpbuf2 + i] = chars[tmpbuf1 + (i + 0)]; chars[tmpbuf2 + i] = ord("\x00"); } while (0);   /* mon */
        for (i = 0; i < SIZE(mth); ++i)
            if (!case_insensitive_comp(tmpbuf2, mth[i])) {
                t.tm_mon = i;
                break;
            }
        do { for (i = 0; (i < 2); ++i) chars[tmpbuf2 + i] = chars[tmpbuf1 + (i + 4)]; chars[tmpbuf2 + i] = ord("\x00"); } while (0);   /* mday */
        strp = tmpbuf2;
        if (chars[strp] == ord(' '))
            strp++;
        t.tm_mday = atoi(strp);
        do { for (i = 0; (i < 2); ++i) chars[tmpbuf2 + i] = chars[tmpbuf1 + (i + 12)]; chars[tmpbuf2 + i] = ord("\x00"); } while (0);  /* hour */
        t.tm_hour = atoi(tmpbuf2);
        do { for (i = 0; (i < 2); ++i) chars[tmpbuf2 + i] = chars[tmpbuf1 + (i + 15)]; chars[tmpbuf2 + i] = ord("\x00"); } while (0);  /* min  */
        t.tm_min = atoi(tmpbuf2);
        do { for (i = 0; (i < 2); ++i) chars[tmpbuf2 + i] = chars[tmpbuf1 + (i + 18)]; chars[tmpbuf2 + i] = ord("\x00"); } while (0);  /* sec  */
        t.tm_sec = atoi(tmpbuf2);
        timeresult = mktime(t);
        nomakedefs.build_time = ulong(timeresult);
        nomakedefs.build_date = dupstr(tmpbuf1);
    }

    nomakedefs.version_number = version.incarnation;
    nomakedefs.version_features = version.feature_set;
    nomakedefs.ignored_features = md_ignored_features();
    nomakedefs.version_sanity1 = version.entity_count;
    nomakedefs.version_string = dupstr(mdlib_version_string(tmpbuf2, _(".")));
    nomakedefs.version_id = dupstr(
           version_id_string(tmpbuf2, sizeof(array_of(char, BUFSZ)), nomakedefs.build_date));
    nomakedefs.copyright_banner_c = dupstr(
              bannerc_string(tmpbuf2, sizeof(array_of(char, BUFSZ)), nomakedefs.build_date));

    nomakedefs_populated[0] = 1;
    return;
    } finally { stack_pop($frame); }
}

export function free_nomakedefs() { /* void */
    /* can't just free non-Null values because they're initialized at
       compile-time with static strings and won't have dynamic values
       unless populate_nomakedefs() has been called */
    if (!nomakedefs_populated[0])
        return;

    if (nomakedefs.build_date)
        free(nomakedefs.build_date),
            nomakedefs.build_date = 0;
    if (nomakedefs.version_string)
        free(nomakedefs.version_string),
            nomakedefs.version_string = 0;
    if (nomakedefs.version_id)
        free(nomakedefs.version_id),
            nomakedefs.version_id = 0;
    if (nomakedefs.copyright_banner_c)
        free(nomakedefs.copyright_banner_c),
            nomakedefs.copyright_banner_c = 0;

    /* values are Null now; dynamic vs static doesn't really matter anymore */
    nomakedefs_populated[0] = 0;
    return;
}

/*date.c*/

import { BUFSZ, struct_nomakedefs_s } from "./global.h.js";
import { struct_tm } from "../libc/records.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, sizeof, ulong } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { atoi, free, getenv, mktime, strlen } from "../rt/libc.js";
import { init_list, stack_array, stack_struct, static_struct, static_var } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { array_of, ptr_to } from "../rt/struct.js";
import { dupstr } from "./alloc.js";
import { case_insensitive_comp, nh_snprintf } from "./hacklib.js";
import {
    bannerc_string, md_ignored_features, mdlib_version_string, version_id_string,
} from "./mdlib.js";
