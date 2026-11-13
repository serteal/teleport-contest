/* NetHack 5.0	version.c	$NHDT-Date: 1737622664 2025/01/23 00:57:44 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.105 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2018. */
/* NetHack may be freely redistributed.  See license for details. */

/* fill buffer with short version (so caller can avoid including date.h)
 * buf cannot be NULL */
export function version_string(buf, bufsz) { /* char * */
    Snprintf(buf, bufsz, _("%s"), ((nomakedefs.version_string && chars[nomakedefs.version_string + 0])
              ? nomakedefs.version_string
              /* in case we try to write a paniclog entry after releasing
                 the 'nomakedefs' data */
              : mdlib_version_string(buf, _("."))))
;
    return buf;
}

/* fill and return the given buffer with the long nethack version string */
export function getversionstring(buf, bufsz) { /* char * */
    strcpy(buf, nomakedefs.version_id);

    {
        let c = 0;

        let p = eos(buf);
        let dotoff = +(p > buf && chars[p + (-1)] == ord('.'));

        if (dotoff)
            --p;
        strcpy(p, _(" ("));

        if (nomakedefs.git_sha)
            Snprintf(eos(buf), unsigned(unsigned(bufsz - strlen(buf)) - 1), _("%s%s"), c++ ? _(",") : _(""), nomakedefs.git_sha)
;

        if (nomakedefs.git_prefix)
            Snprintf(eos(buf), unsigned(unsigned(bufsz - strlen(buf)) - 1), _("%sprefix:%s"), c++ ? _(",") : _(""), nomakedefs.git_prefix)

;
        if (c)
            Snprintf(eos(buf), unsigned(unsigned(bufsz - strlen(buf)) - 1), _("%s"), _(")"));
        else /* if nothing has been added, strip " (" back off */
            chars[p] = ord('\0')
;
        if (dotoff)
            Snprintf(eos(buf), unsigned(unsigned(bufsz - strlen(buf)) - 1), _("%s"), _("."))
;
    }
    return buf;
}

/* version info that could be displayed on status lines;
     "<game name> <git branch name> <x.y.z version number>";
   if game name is a prefix of--or same as--branch name, it is omitted
     "<git branch name> <x.y.z version number>";
   after release--or if branch info is unavailable--it will be
     "<game name> <x.y.z version number>";
   game name or branch name or both can be requested via flags */
export function status_version(buf, bufsz, indent) { /* char * */
    let name = 0, altname = 0, indentation;
    let vflags = flags.versinfo;
    let shownum = +((vflags & VI_NUMBER) != 0),
            showname = +((vflags & VI_NAME) != 0),
            showbranch = +((vflags & VI_BRANCH) != 0);

    /* game's name {variants should use own name, not "NetHack"} */
    if (showname) {
        name = nh_basename(gh.hname, FALSE); /* hname is from xxxmain.c */

        if (!name || !chars[name]) /* shouldn't happen */
            showname = FALSE;
    }
    /* git branch name, if available */
    if (showbranch) {
        altname = nomakedefs.git_branch;

        if (!altname || !chars[altname])
            showbranch = FALSE;
    }
    if (showname && showbranch) {
        if (!strncmpi(name, altname, int(strlen(name))))
            showname = FALSE;
    /* #if 0: not in this build */
    } else if (!showname && !showbranch) {
        /* flags.versinfo could be set to only 'branch' but it might not
           be available */
        shownum = TRUE;
    }

    chars[buf] = ord('\0');
    indentation = indent ? _(" ") : _("");
    if (showname) {
        Snprintf(eos(buf), unsigned(bufsz - strlen(buf)), _("%s%s"), indentation, name);
        indentation = _(" "); /* forced separator rather than optional indent */
    }
    if (showbranch) {
        Snprintf(eos(buf), unsigned(bufsz - strlen(buf)), _("%s%s"), indentation, altname);
        indentation = _(" ");
    }
    if (shownum) {
        /* x.y.z version number */
        Snprintf(eos(buf), unsigned(bufsz - strlen(buf)), _("%s%s"), indentation, (nomakedefs.version_string && chars[nomakedefs.version_string + 0])
                     ? nomakedefs.version_string
                     : mdlib_version_string(buf, _(".")))
;
    }
    return buf;
}

/* the #versionshort command */
export function doversion() { /* int */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);

    if (iflags.menu_requested)
        return doextversion();

    pline(_("%s"), getversionstring(buf, sizeof(array_of(char, BUFSZ))));
    return ECMD_OK;
    } finally { stack_pop($frame); }
}

/* the '#version' command; also a choice for '?' */
export function doextversion() { /* int */
    const $frame = stack_frame(); try {
    let rtcontext = stack_var(int, 0);
    let rtbuf;
    let f = null;
    let buf = stack_array(char, BUFSZ), p = 0;
    let win = create_nhwindow()(NHW_TEXT);
    let use_dlb = TRUE,
            done_rt = FALSE,
            done_dlb = FALSE,
            prolog;
    /* lua_info[] moved to util/mdlib.c and rendered via do_runtime_info() */

    use_dlb = FALSE;

    /* instead of using ``display_file(OPTIONS_USED,TRUE)'' we handle
       the file manually so we can include dynamic version info */

    getversionstring(buf, sizeof(array_of(char, BUFSZ)));
    /* if extra text (git info) is present, put it on separate line
       but don't wrap on (x86) */
    if (strlen(buf) >= COLNO)
        p = strrchr(buf, ord('('));
    if (p && p > buf && chars[p + (-1)] == ord(' ') && chars[p + 1] != ord('x'))
        chars[p + (-1)] = ord('\0');
    else
        p = 0;
    putstr()(win, 0, buf);
    if (p) {
        chars[--p] = ord(' ');
        putstr()(win, 0, p);
    }

    if (use_dlb) {
        f = dlb_fopen(_(OPTIONS_USED), _("r"));
        if (!f) {
            putstr()(win, 0, _(""));
            sprintf(buf, _("[Configuration '%s' not available?]"), _(OPTIONS_USED));
            putstr()(win, 0, buf);
            done_dlb = TRUE;
        }
    }
    /*
     * already inserted above:
     * + outdented program name and version plus build date and time
     * dat/options; display contents with lines prefixed by '-' deleted:
     * - blank-line
     * -     indented program name and version
     *   blank-line
     *   outdented feature header
     * - blank-line
     *       indented feature list
     *       spread over multiple lines
     *   blank-line
     *   outdented windowing header
     * - blank-line
     *       indented windowing choices with
     *       optional second line for default
     * - blank-line
     * - EOF
     */

    prolog = TRUE; /* to skip indented program name */
    for (;;) {
        if (use_dlb && !done_dlb) {
            if (!dlb_fgets(buf, BUFSZ, f)) {
                done_dlb = TRUE;
                continue;
            }
        } else if (!done_rt) {
            if (!(rtbuf = do_runtime_info(rtcontext))) {
                done_rt = TRUE;
                continue;
            }
            strncpy(buf, rtbuf, BUFSZ - 1);
            chars[buf + (BUFSZ - 1)] = ord('\0');
        } else {
            break;
        }
        strip_newline(buf);
        if (strchr(buf, ord('\t')) != 0)
            tabexpand(buf);

        if (chars[buf] && chars[buf] != ord(' ')) {
            /* found outdented header; insert a separator since we'll
               have skipped corresponding blank line inside the file */
            putstr()(win, 0, _(""));
            prolog = FALSE;
        }
        /* skip blank lines and prolog (progame name plus version) */
        if (prolog || !chars[buf])
            continue;

        if (strchr(buf, ord(':')))
            insert_rtoption(buf);

        if (chars[buf])
            putstr()(win, 0, buf);
    }
    if (use_dlb)
        dlb_fclose(f);
    display_nhwindow()(win, FALSE);
    destroy_nhwindow()(win);
    return ECMD_OK;
    } finally { stack_pop($frame); }
}

export function early_version_info(pastebuf) { /* void */
    const $frame = stack_frame(); try {
    let buf1 = stack_array(char, BUFSZ), buf2 = stack_array(char, BUFSZ);
    let buf, tmp;

    Snprintf(buf1, sizeof(array_of(char, BUFSZ)), _("test"));
    /* this is early enough that we have to do our own line-splitting */
    getversionstring(buf1, sizeof(array_of(char, BUFSZ)));
    tmp = strstri(buf1, _(" (")); /* split at start of version info */
    if (tmp) {
        /* retain one buffer so that it all goes into the paste buffer */
        chars[tmp++] = ord('\0');
        Snprintf(buf2, sizeof(array_of(char, BUFSZ)), _("%s\n%s"), buf1, tmp);
        buf = buf2;
    } else {
        buf = buf1;
    }

    raw_printf(_("%s"), buf);

    if (pastebuf) {
        raw_printf(_("%s"), _("Paste buffer copy is not available.\n"));
    }
    } finally { stack_pop($frame); }
}

/*
 * makedefs should put the first token into dat/options; we'll substitute
 * the second value for it.  The token must contain at least one colon
 * so that we can spot it, and should not contain spaces so that makedefs
 * won't split it across lines.  Ideally the length should be close to
 * that of the substituted value since we don't do phrase-splitting/line-
 * wrapping when displaying it.
 */
 const struct_rt_opt = struct("struct_rt_opt", {
    token: ptr_to(char), value: ptr_to(char),
}); const rt_opts = static_array("rt_opts", struct_rt_opt, null, [
    { token: _(":PATMATCH:"), value: regex_id },
    { token: _(":LUAVERSION:"), value: gl.lua_ver },
    { token: _(":LUACOPYRIGHT:"), value: gl.lua_copyright },
]);

/*
 * 3.6.0
 * Some optional stuff is no longer available to makedefs because
 * it depends which of several object files got linked into the
 * game image, so we insert those options here.
 */
function insert_rtoption(buf) { /* void */
    let i;

    if (!chars[gl.lua_ver + 0])
        get_lua_version();

    for (i = 0; i < SIZE(rt_opts); ++i) {
        if (strstri(buf, rt_opts[i].token) && chars[rt_opts[i].value]) {
            strsubst(buf, rt_opts[i].token, rt_opts[i].value);
        }
        /* we don't break out of the loop after a match; there might be
           other matches on the same line */
    }
}

export function check_version(
    version_data,
    filename,
    complain,
    utdflags) { /* boolean */
    if (!filename) {
        complain = FALSE; /* 'complain' requires 'filename' for pline("%s") */
    }
    if ((version_data.feature_set & SFCTOOL_BIT) != 0) {
        gc.converted_savefile_loaded = TRUE;
        version_data.feature_set = and64u(version_data.feature_set, ~SFCTOOL_BIT);
    }
    if (

        version_data.incarnation != nomakedefs.version_number

        ) {
        if (complain) {
            pline(_("Version mismatch for file \"%s\"."), filename);
            if (WIN_MESSAGE != WIN_ERR)
                 display_nhwindow()(WIN_MESSAGE, TRUE);
        }

        return FALSE;
    } else if (
        and64u(version_data.feature_set, not64u(nomakedefs.ignored_features))
            != and64u(nomakedefs.version_features, not64u(nomakedefs.ignored_features))
        || ((utdflags & UTD_SKIP_SANITY1) == 0
             && version_data.entity_count != nomakedefs.version_sanity1)
        ) {
        if (complain) {
            pline(_("Configuration incompatibility for file \"%s\"."), filename);
            display_nhwindow()(WIN_MESSAGE, TRUE);
        }

        return FALSE;
    }
    return TRUE;
}

export function get_feature_notice_ver(str) { /* unsigned long long */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);
    let ver_maj, ver_min, patch;
    let istr = stack_array(ptr_to(char), 3);
    let j = 0;

    if (!str)
        return 0;
    str = strcpy(buf, str);
    istr[j] = str;
    while (chars[str]) {
        if (chars[str] == ord('.')) {
            chars[str++] = ord('\0');
            j++;
            istr[j] = str;
            if (j == 2)
                break;
        } else if (strchr(_("0123456789"), chars[str]) != 0) {
            str++;
        } else
            return 0;
    }
    if (j != 2)
        return 0;
    ver_maj = atoi(istr[0]);
    ver_min = atoi(istr[1]);
    patch = atoi(istr[2]);
    return or64u(or64u(or64u((shl64(ulong(ver_maj), 24)), (shl64(ulong(ver_min), 16))), (shl64(ulong(patch), 8))), (0));
    /* macro from hack.h */
    } finally { stack_pop($frame); }
}

export function get_current_feature_ver() { /* unsigned long long */
    return FEATURE_NOTICE_VER(VERSION_MAJOR, VERSION_MINOR, PATCHLEVEL);
}

/*ARGUSED*/
export function copyright_banner_line(indx) { /* const char * */
    if (indx == 1)
        return _(COPYRIGHT_BANNER_A);

    if (indx == 2)
        return _(COPYRIGHT_BANNER_B);

    if (indx == 3)
        return nomakedefs.copyright_banner_c;

    if (indx == 4)
        return _(COPYRIGHT_BANNER_D);

    return _("");
}

/* called by argcheck(allmain.c) from early_options(sys/xxx/xxxmain.c) */
export function dump_version_info() { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);
    let hname = gh.hname ? gh.hname : _("nethack");

    if (strlen(hname) > 33)
        hname = eos(nhStr(hname)) - 33; /* discard const for eos() */
    runtime_info_init();
    Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%-12.33s %08llx %08llx %08llx"), hname, nomakedefs.version_number, and64u(nomakedefs.version_features, not64u(nomakedefs.ignored_features)), nomakedefs.version_sanity1)

;
    raw_print()(buf);
    release_runtime_info();
    return;
    } finally { stack_pop($frame); }
}
export function store_version(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let version_data = init_list(stack_struct(struct_version_info), {
        incarnation: 0,
        feature_set: 0,
        entity_count: 0,
    });
    /* actual version number */
    version_data.incarnation = nomakedefs.version_number;
    /* bitmask of config settings */
    version_data.feature_set = nomakedefs.version_features;
    /* # of monsters and objects */
    version_data.entity_count = nomakedefs.version_sanity1;

    /* bwrite() before bufon() uses plain write() */
    if (nhfp.structlevel)
        bufoff(nhfp.fd);

    store_critical_bytes(nhfp);
    Sfo_version_info(nhfp, version_data,
                     _("version_info"));

    if (nhfp.structlevel)
        bufon(nhfp.fd);
    return;
    } finally { stack_pop($frame); }
}

const struct_critical_sizes_with_names = struct("struct_critical_sizes_with_names", {
    ucsize: uchar,
    nm: ptr_to(char),
});

export const critical_sizes = static_array("critical_sizes", struct_critical_sizes_with_names, null, [
    { ucsize: 0, nm: _("unused") },
    /* simple types, that don't have subfields */
    { ucsize: sizeof(short), nm: _("short") },
    { ucsize: sizeof(int), nm: _("int") },
    { ucsize: sizeof(long), nm: _("long") },
    { ucsize: sizeof(long), nm: _("long long") },
    { ucsize: sizeof(ptr_to(void_t)), nm: _("genericptr_t") },
    { ucsize: sizeof(schar), nm: _("aligntyp") },
    { ucsize: sizeof(schar), nm: _("boolean") },
    { ucsize: sizeof(short), nm: _("coordxy") },
    { ucsize: sizeof(short), nm: _("int16") },
    { ucsize: sizeof(int), nm: _("int32") },
    { ucsize: sizeof(int64_t), nm: _("int64") },
    { ucsize: sizeof(schar), nm: _("schar") },
    { ucsize: sizeof(unsigned), nm: _("size_t") },
    { ucsize: sizeof(uchar), nm: _("uchar") },
    { ucsize: sizeof(ushort), nm: _("uint16") },
    { ucsize: sizeof(unsigned), nm: _("uint32") },
    { ucsize: sizeof(uint64_t), nm: _("uint64") },
    { ucsize: sizeof(ulong), nm: _("ulong") },
    { ucsize: sizeof(unsigned), nm: _("unsigned") },
    { ucsize: sizeof(ushort), nm: _("ushort") },
    { ucsize: sizeof(short), nm: _("xint16") },
    { ucsize: sizeof(schar), nm: _("xint8") },
    /* complex - they break down into one or more simple types */
    { ucsize: sizeof(struct_arti_info), nm: _("struct arti_info") },
    { ucsize: sizeof(struct_nhrect), nm: _("struct nhrect") },
    { ucsize: sizeof(struct_branch), nm: _("struct branch") },
    { ucsize: sizeof(struct_bubble), nm: _("struct bubble") },
    { ucsize: sizeof(struct_cemetery), nm: _("struct cemetery") },
    { ucsize: uchar(sizeof(struct_context_info)), nm: _("struct context_info") },
    { ucsize: sizeof(struct_nhcoord), nm: _("struct nhcoord") },
    { ucsize: sizeof(struct_damage), nm: _("struct damage") },
    { ucsize: sizeof(struct_dest_area), nm: _("struct dest_area") },
    { ucsize: sizeof(struct_dgn_topology), nm: _("struct dgn_topology") },
    { ucsize: sizeof(struct_dungeon), nm: _("struct dungeon") },
    { ucsize: sizeof(struct_d_level), nm: _("struct d_level") },
    { ucsize: sizeof(struct_ebones), nm: _("struct ebones") },
    { ucsize: sizeof(struct_edog), nm: _("struct edog") },
    { ucsize: uchar(sizeof(struct_egd)), nm: _("struct egd") },
    { ucsize: sizeof(struct_emin), nm: _("struct emin") },
    { ucsize: sizeof(struct_engr), nm: _("struct engr") },
    { ucsize: sizeof(struct_epri), nm: _("struct epri") },
    { ucsize: uchar(sizeof(struct_eshk)), nm: _("struct eshk") },
    { ucsize: sizeof(struct_fe), nm: _("struct fe") },
    { ucsize: sizeof(struct_flag), nm: _("struct flag") },
    { ucsize: sizeof(struct_fruit), nm: _("struct fruit") },
    { ucsize: sizeof(struct_gamelog_line), nm: _("struct gamelog_line") },
    { ucsize: uchar(sizeof(struct_kinfo)), nm: _("struct kinfo") },
    { ucsize: sizeof(struct_levelflags), nm: _("struct levelflags") },
    { ucsize: sizeof(struct_ls_t), nm: _("struct ls_t") },
    { ucsize: sizeof(struct_linfo), nm: _("struct linfo") },
    { ucsize: sizeof(struct_mapseen_feat), nm: _("struct mapseen_feat") },
    { ucsize: sizeof(struct_mapseen_flags), nm: _("struct mapseen_flags") },
    { ucsize: sizeof(struct_mapseen_rooms), nm: _("struct mapseen_rooms") },
    { ucsize: sizeof(struct_mextra), nm: _("struct mextra") },
    { ucsize: sizeof(struct_mkroom), nm: _("struct mkroom") },
    { ucsize: sizeof(struct_monst), nm: _("struct monst") },
    { ucsize: sizeof(struct_mvitals), nm: _("struct mvitals") },
    { ucsize: sizeof(struct_obj), nm: _("struct obj") },
    { ucsize: sizeof(struct_objclass), nm: _("struct objclass") },
    { ucsize: sizeof(struct_oextra), nm: _("struct oextra") },
    { ucsize: sizeof(struct_q_score), nm: _("struct q_score") },
    { ucsize: sizeof(struct_rm), nm: _("struct rm") },
    { ucsize: sizeof(struct_spell), nm: _("struct spell") },
    { ucsize: sizeof(struct_stairway), nm: _("struct stairway") },
    { ucsize: sizeof(struct_s_level), nm: _("struct s_level") },
    { ucsize: sizeof(struct_trap), nm: _("struct trap") },
    { ucsize: sizeof(struct_version_info), nm: _("struct version_info") },
    { ucsize: sizeof(struct_any), nm: _("anything") },
    /* struct you requires 2 bytes */
    { ucsize: (sizeof(struct_you) & 0x00FF), nm: _("you_LO") },
    { ucsize: ((sizeof(struct_you) & 0xFF00) >>> 8), nm: _("you_HI") },
    /* #ifdef SF_INCLUDE_SUBSTRUCTS: not in this build */

    /* 10 for future expansion without changing array size */
    { ucsize: 0, nm: _("") },
    { ucsize: 0, nm: _("") },
    { ucsize: 0, nm: _("") },
    { ucsize: 0, nm: _("") },
    { ucsize: 0, nm: _("") },
    { ucsize: 0, nm: _("") },
    { ucsize: 0, nm: _("") },
    { ucsize: 0, nm: _("") },
    { ucsize: 0, nm: _("") },
    { ucsize: 0, nm: _("") },
]);

export const cscbuf = static_array("cscbuf", uchar, SIZE(critical_sizes));

export function get_critical_size_count() { /* int */
    return SIZE(critical_sizes);
}

export function store_critical_bytes(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let i, cnt;
    let indicate = stack_var(char, ord('u')), csc_count = stack_var(char, SIZE(critical_sizes));
    /* int cmc = 0; */

    if (nhfp.mode & WRITING) {
        indicate[0] = nhfp.structlevel ? ord('h')
                                       : (nhfp.fnidx == exportascii)
                                         ? ord('a')
                                         : ord('?');
        Sfo_char(nhfp, addr_of(indicate), _("indicate-format"), 1);
        Sfo_char(nhfp, addr_of(csc_count), _("count-critical_sizes"), 1);
        cnt = (csc_count[0]);
        for (i = 0; i < cnt; ++i) {
            Sfo_uchar(nhfp, addr_of(ref_of(critical_sizes[i], "ucsize")), _("critical_sizes"));
        }
    }
    } finally { stack_pop($frame); }
}

/* this used to be based on file date and somewhat OS-dependent,
 *  but now examines the initial part of the file's contents.
 *
 * returns:
 *
 *   SF_UPTODATE                     (0) everything matched and looks good
 *   SF_OUTDATED                     (1) savefile is outdated
 *   SF_CRITICAL_BYTE_COUNT_MISMATCH (2) critical size count mismatch
 *   SF_DM_IL32LLP64_ON_ILP32LL64    (3) Windows x64 savefile on x86
 *   SF_DM_I32LP64_ON_ILP32LL64      (4) Unix 64 savefile on x86
 *   SF_DM_ILP32LL64_ON_I32LP64      (5) x86 savefile on Unix 64
 *   SF_DM_ILP32LL64_ON_IL32LLP64    (6) x86 savefile on Windows x64
 *   SF_DM_I32LP64_ON_IL32LLP64      (7) Unix 64 savefile on Windows x64
 *   SF_DM_IL32LLP64_ON_I32LP64      (8) Windows x64 savefile on Unix 64
 *   SF_DM_MISMATCH                  (9) some other mismatch
 */
export function uptodate(nhfp, name, utdflags) { /* int */
    const $frame = stack_frame(); try {
    let vers_info = stack_struct(struct_version_info);

    let indicator = stack_var(char);
    let sfstatus = 0, idx_1st_mismatch = stack_var(int, 0);
    let quietly = +((utdflags & UTD_QUIETLY) != 0);
    let verbose = name ? TRUE : FALSE;

    Sfi_char(nhfp, addr_of(indicator), _("indicate-format"), 1);
    if ((sfstatus = compare_critical_bytes(nhfp, idx_1st_mismatch, utdflags))
                                                             != SF_UPTODATE) {
        if (sfstatus > 0 && idx_1st_mismatch[0]) {
            if (!quietly)
                raw_printf(_("comparison of critical bytes mismatched at %d (%s)."),
                           critical_sizes[idx_1st_mismatch[0]].ucsize,
                           critical_sizes[idx_1st_mismatch[0]].nm);
        }
    }

    Sfi_version_info(nhfp, vers_info, _("version_info"));
    if (!check_version(vers_info, name, verbose, utdflags)) {
        if (verbose) {
            if ((utdflags & UTD_WITHOUT_WAITSYNCH_PERFILE) == 0) {
                wait_synch()();
            }
        }
        return SF_OUTDATED;
    }
    return sfstatus;
    } finally { stack_pop($frame); }
}

/*
 * returns:
 *
 *   SF_UPTODATE                     (0) everything matched and looks good
 *   SF_OUTDATED                     (1) savefile is outdated
 *   SF_CRITICAL_BYTE_COUNT_MISMATCH (2) critical size count mismatch
 *   SF_DM_IL32LLP64_ON_ILP32LL64    (3) Windows x64 savefile on x86
 *   SF_DM_I32LP64_ON_ILP32LL64      (4) Unix 64 savefile on x86
 *   SF_DM_ILP32LL64_ON_I32LP64      (5) x86 savefile on Unix 64
 *   SF_DM_ILP32LL64_ON_IL32LLP64    (6) x86 savefile on Windows x64
 *   SF_DM_I32LP64_ON_IL32LLP64      (7) Unix 64 savefile on Windows x64
 *   SF_DM_IL32LLP64_ON_I32LP64      (8) Windows x64 savefile on Unix 64
 *   SF_DM_MISMATCH                  (9) some other mismatch
 */
export function compare_critical_bytes(nhfp, idx_1st_mismatch, utdflags) { /* int */
    const $frame = stack_frame(); try {
    let active_csc_count = SIZE(critical_sizes),
         file_csc_count = stack_var(char);
    let i, cnt = active_csc_count,
        dmmismatch = SF_DM_MISMATCH;
    let quietly = +((utdflags & UTD_QUIETLY) != 0);

    Sfi_char(nhfp, addr_of(file_csc_count), _("count-critical_sizes"), 1);
    if (file_csc_count[0] > cnt) {
        if (!quietly)
            raw_printf(_("critical byte counts do not match" +
                       ", file:%d, critical_sizes:%d."),
                       file_csc_count[0], SIZE(critical_sizes));
        return SF_CRITICAL_BYTE_COUNT_MISMATCH;
    }
    for (i = 0; i < (file_csc_count[0]); ++i) {
        Sfi_uchar(nhfp, cscbuf + i, _("critical_sizes"));
    }
    for (i = 1; i < cnt; ++i) {
        if (uchars[cscbuf + i] != critical_sizes[i].ucsize) {
            let dm = datamodel(0), dmfile;

            dmfile = what_datamodel_is_this(0,
                                            uchars[cscbuf + 1],  /* short */
                                            uchars[cscbuf + 2],  /* int */
                                            uchars[cscbuf + 3],  /* long */
                                            uchars[cscbuf + 4],  /* long long */
                                            uchars[cscbuf + 5]); /* ptr */

            if (!strcmp(dmfile, _("IL32LLP64")) && !strcmp(dm, _("ILP32LL64"))) {
                /*  Windows x64 savefile on x86 */
                dmmismatch = SF_DM_IL32LLP64_ON_ILP32LL64;
            } else if (!strcmp(dmfile, _("I32LP64"))
                       && !strcmp(dm, _("ILP32LL64"))) {
                /* Unix 64 savefile on x86*/
                dmmismatch = SF_DM_I32LP64_ON_ILP32LL64;
            } else if (!strcmp(dmfile, _("ILP32LL64"))
                       && !strcmp(dm, _("I32LP64"))) {
                /*  x86 savefile on Unix 64 */
                dmmismatch = SF_DM_ILP32LL64_ON_I32LP64;
            } else if (!strcmp(dmfile, _("ILP32LL64"))
                       && !strcmp(dm, _("IL32LLP64"))) {
                /* x86 savefile on Windows x64 */
                dmmismatch = SF_DM_ILP32LL64_ON_IL32LLP64;
            } else if (!strcmp(dmfile, _("I32LP64"))
                       && !strcmp(dm, _("IL32LLP64"))) {
                /* Unix 64 savefile on Windows x64 */
                dmmismatch = SF_DM_I32LP64_ON_IL32LLP64;
            } else if (!strcmp(dmfile, _("IL32LLP64"))
                       && !strcmp(dm, _("I32LP64"))) {
                /* Windows x64 savefile on Unix 64 */
                dmmismatch = SF_DM_IL32LLP64_ON_I32LP64;
            }
            if (idx_1st_mismatch)
                idx_1st_mismatch[0] = i;
            return dmmismatch;
        }
    }
    return SF_UPTODATE; /* everything matched */
    } finally { stack_pop($frame); }
}

/*
 * returns:
 *
 *   SF_UPTODATE                     (0) everything matched and looks good
 *   SF_OUTDATED                     (1) savefile is outdated
 *   SF_CRITICAL_BYTE_COUNT_MISMATCH (2) critical size count mismatch
 *   SF_DM_IL32LLP64_ON_ILP32LL64    (3) Windows x64 savefile on x86
 *   SF_DM_I32LP64_ON_ILP32LL64      (4) Unix 64 savefile on x86
 *   SF_DM_ILP32LL64_ON_I32LP64      (5) x86 savefile on Unix 64
 *   SF_DM_ILP32LL64_ON_IL32LLP64    (6) x86 savefile on Windows x64
 *   SF_DM_I32LP64_ON_IL32LLP64      (7) Unix 64 savefile on Windows x64
 *   SF_DM_IL32LLP64_ON_I32LP64      (8) Windows x64 savefile on Unix 64
 *   SF_DM_MISMATCH                  (9) some other mismatch
 */
export function validate(nhfp, name, without_waitsynch_perfile) { /* int */
    let utdflags = 0;
    let validsf = 0;

    if (nhfp.structlevel)
        utdflags = or64u(utdflags, UTD_CHECKSIZES);
    if (without_waitsynch_perfile)
        utdflags = or64u(utdflags, UTD_WITHOUT_WAITSYNCH_PERFILE);
    if (nhfp.fieldlevel)
        utdflags = or64u(utdflags, UTD_CHECKFIELDCOUNTS | UTD_SKIP_SANITY1);
    validsf = uptodate(nhfp, name, utdflags);
    return validsf;
}

/*version.c*/

import { struct_arti_info } from "./artifact.h.js";
import { struct_context_info } from "./context.h.js";
import { struct_nhcoord } from "./coord.h.js";
import { dlb_fclose, dlb_fgets, dlb_fopen } from "./dlb.h.macros.js";
import {
    struct_branch, struct_d_level, struct_dest_area, struct_dungeon, struct_linfo,
    struct_mapseen_feat, struct_mapseen_flags, struct_mapseen_rooms, struct_s_level,
} from "./dungeon.h.js";
import { struct_engr } from "./engrave.h.js";
import { VI_BRANCH, VI_NAME, VI_NUMBER, struct_flag } from "./flag.h.js";
import {
    BUFSZ, COLNO, FALSE, OPTIONS_USED, SFCTOOL_BIT, TRUE, struct_version_info,
} from "./global.h.js";
import {
    ECMD_OK, SF_CRITICAL_BYTE_COUNT_MISMATCH, SF_DM_I32LP64_ON_IL32LLP64,
    SF_DM_I32LP64_ON_ILP32LL64, SF_DM_IL32LLP64_ON_I32LP64, SF_DM_IL32LLP64_ON_ILP32LL64,
    SF_DM_ILP32LL64_ON_I32LP64, SF_DM_ILP32LL64_ON_IL32LLP64, SF_DM_MISMATCH, SF_OUTDATED,
    SF_UPTODATE, UTD_CHECKFIELDCOUNTS, UTD_CHECKSIZES, UTD_QUIETLY, UTD_SKIP_SANITY1,
    UTD_WITHOUT_WAITSYNCH_PERFILE, WRITING, exportascii, struct_bubble, struct_dgn_topology,
    struct_gamelog_line, struct_kinfo, struct_ls_t, struct_mvitals,
} from "./hack.h.js";
import { FEATURE_NOTICE_VER } from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { nhStr } from "./lint.h.macros.js";
import {
    struct_ebones, struct_edog, struct_egd, struct_emin, struct_epri, struct_eshk, struct_mextra,
} from "./mextra.h.js";
import { struct_mkroom } from "./mkroom.h.js";
import { struct_monst } from "./monst.h.js";
import { struct_obj, struct_oextra } from "./obj.h.js";
import { struct_fruit, struct_objclass } from "./objclass.h.js";
import {
    COPYRIGHT_BANNER_A, COPYRIGHT_BANNER_B, COPYRIGHT_BANNER_D, PATCHLEVEL, VERSION_MAJOR,
    VERSION_MINOR,
} from "./patchlevel.h.js";
import { struct_q_score } from "./quest.h.js";
import { struct_nhrect } from "./rect.h.js";
import { struct_cemetery, struct_damage, struct_levelflags, struct_rm } from "./rm.h.js";
import {
    Sfi_char, Sfi_uchar, Sfi_version_info, Sfo_char, Sfo_uchar, Sfo_version_info,
} from "./savefile.h.macros.js";
import { struct_spell } from "./spell.h.js";
import { struct_stairway } from "./stairs.h.js";
import { struct_fe } from "./timeout.h.js";
import { struct_trap } from "./trap.h.js";
import {
    create_nhwindow, destroy_nhwindow, display_nhwindow, putstr, raw_print, wait_synch,
} from "./winprocs.h.macros.js";
import { NHW_TEXT, WIN_ERR, struct_any } from "./wintype.h.js";
import { struct_you } from "./you.h.js";
import { SIZE } from "../rt/cmacros.js";
import {
    char, int, int64_t, long, ord, schar, short, sizeof, uchar, uint64_t, ulong, unsigned, ushort,
} from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { and64u, not64u, or64u, shl64 } from "../rt/int64.js";
import { atoi, sprintf, strchr, strcmp, strcpy, strlen, strncpy, strrchr } from "../rt/libc.js";
import { init_list, stack_array, stack_struct, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, array_of, ptr_to, ref_of, struct, void_t } from "../rt/struct.js";
import { nomakedefs } from "./date.js";
import { flags, gc, gh, gl, iflags } from "./decl.js";
import { nh_basename } from "./files.js";
import {
    datamodel, eos, strip_newline, strncmpi, strstri, strsubst, tabexpand, what_datamodel_is_this,
} from "./hacklib.js";
import {
    do_runtime_info, mdlib_version_string, release_runtime_info, runtime_info_init,
} from "./mdlib.js";
import { get_lua_version } from "./nhlua.js";
import { pline, raw_printf } from "./pline.js";
import { bufoff, bufon } from "./sfstruct.js";
import { regex_id } from "../sys/share/posixregex.js";
