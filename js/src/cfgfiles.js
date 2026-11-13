/* NetHack 5.0	cfgfiles.c	$NHDT-Date: 1740532826 2025/02/25 17:20:26 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.417 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Derek S. Ray, 2015. */
/* NetHack may be freely redistributed.  See license for details. */

export const BIGBUFSZ = (5 * BUFSZ);

 /* defined below (far below...) */

/* next one is in extern.h; why here too? */

const ignore_errors_on_unmatched = static_var("ignore_errors_on_unmatched", schar, FALSE);
const ignore_statement_errors = static_var("ignore_statement_errors", schar, FALSE);

/* ----------  BEGIN CONFIG FILE HANDLING ----------- */

/* used for messaging. Also used in options.c */
const default_configfile = static_var("default_configfile", ptr_to(char), _(".nethackrc"));

/* #else (#ifdef UNIX): not in this build */

const configfile = static_array("configfile", char, BUFSZ);

export function get_configfile() { /* char * */
    return configfile;
}

export function get_default_configfile() { /* const char * */
    return default_configfile[0];
}

/* #ifdef MSDOS: not in this build */

/* #saveoptions - save config options into file */
export function do_write_config_file() { /* int */
    const $frame = stack_frame(); try {
    let fp;
    let tmp = stack_array(char, BUFSZ);

    if (!chars[configfile + 0]) {
        pline(_("Strange, could not figure out config file name."));
        return ECMD_OK;
    }
    if (flags.suppress_alert < FEATURE_NOTICE_VER(3,7,0)) {
        pline(_("Warning: saveoptions is highly experimental!"));
        wait_synch()();
        pline(_("Some settings are not saved!"));
        wait_synch()();
        pline(_("All manual customization and comments are removed" +
              " from the file!"));
        wait_synch()();
    }

    sprintf(tmp, _(overwrite_prompt), (BUFSZ - sizeof_string(overwrite_prompt) - 2), configfile)
;

    if (!paranoid_query(TRUE, tmp))
        return ECMD_OK;

    fp = fopen(configfile, _("w"));
    if (fp) {
        let len, wrote;
        let buf = stack_struct(struct_strbuf);

        strbuf_init(buf);
        all_options_strbuf(buf);
        len = strlen(buf.str);
        wrote = fwrite(buf.str, 1, len, fp);
        fclose(fp);
        strbuf_empty(buf);
        if (wrote != len)
            pline(_("An error occurred, wrote only partial data (%zu/%zu)."),
                  wrote, len);
    }
    return ECMD_OK;
    } finally { stack_pop($frame); }
}
export const overwrite_prompt = "Overwrite config file %.*s?";

/* remember the name of the file we're accessing;
   if may be used in option reject messages */
export function set_configfile_name(fname) { /* void */
    strncpy(configfile, fname, sizeof(array_of(char, BUFSZ)) - 1);
    chars[configfile + (sizeof(array_of(char, BUFSZ)) - 1)] = ord('\0');
}

function fopen_config_file(filename, src) { /* FILE * */
    const $frame = stack_frame(); try {
    let fp;

    let tmp_config = stack_array(char, BUFSZ);
    let envp;

    if (src == set_in_sysconf) {
        /* SYSCF_FILE; if we can't open it, caller will bail */
        if (filename && chars[filename]) {
            set_configfile_name(fqname(filename, SYSCONFPREFIX, 0));
            fp = fopen(configfile, _("r"));
        } else
            fp = null;
        return  fp;
    }
    /* If src != set_in_sysconf, "filename" is an environment variable, so it
     * should hang around. If set, it is expected to be a full path name
     * (if relevant)
     */
    if (filename && chars[filename]) {
        set_configfile_name(filename);

        if (!strncmp(configfile, _("~/"), 2) && (envp = nh_getenv(_("HOME"))) != 0) {
            /* support for command line '--nethackrc=~/path' (or for
               NETHACKOPTIONS='@~/path'; we don't support ~user/path) */
            Snprintf(tmp_config, sizeof(array_of(char, BUFSZ)), _("%s/%s"), envp, configfile + 2)
; /* insert $HOME/ and remove ~/ */
            set_configfile_name(tmp_config);
        }
        if (access(configfile, 4) == -1) { /* 4 is R_OK on newer systems */
            /* nasty sneaky attempt to read file through
             * NetHack's setuid permissions -- this is the only
             * place a file name may be wholly under the player's
             * control (but SYSCF_FILE is not under the player's
             * control so it's OK).
             */
            raw_printf(_("Access to %s denied (%d)."), configfile, (__errno_location()[0]));
            wait_synch()();
            /* fall through to standard names */
        } else

        if ((fp = fopen(configfile, _("r"))) != null) {
            return  fp;
        } else {
            /* access() above probably caught most problems for UNIX */
            raw_printf(_("Couldn't open requested config file %s (%d)."),
                       configfile, (__errno_location()[0]));
            wait_synch()();
        }
    }
    /* fall through to standard names */

/* #if defined(MICRO) || defined(MACOS9) || defined(__BEOS__) || defined(WIN32): not in this build */

/* constructed full path names don't need fqname() */
    /* #ifdef VMS: not in this build */

    envp = nh_getenv(_("HOME"));
    if (!envp)
        strcpy(tmp_config, _(".nethackrc"));
    else
        sprintf(tmp_config, _("%s/%s"), envp, _(".nethackrc"));

    set_configfile_name(tmp_config);
    if ((fp = fopen(configfile, _("r"))) != null)
        return fp;
    /* #if defined(__APPLE__): not in this build */

    if ((__errno_location()[0]) != ENOENT) {
        let details;

        /* e.g., problems when setuid NetHack can't search home
           directory restricted to user */

        if ((details = strerror((__errno_location()[0]))) == 0)

            details = _("");
        raw_printf(_("Couldn't open default config file %s %s(%d)."),
                   configfile, details, (__errno_location()[0]));
        wait_synch()();
    }

    return null;
    } finally { stack_pop($frame); }
}

/*
 * Retrieve a list of integers from buf into a uchar array.
 *
 * NOTE: zeros are inserted unless modlist is TRUE, in which case the list
 *  location is unchanged.  Callers must handle zeros if modlist is FALSE.
 */
function get_uchars(bufp,
           list,
           modlist,
           size,
           name) { /* int */ /* name of option for error message */
    let $goto = null;
    var num = 0;
    var count = 0;
    var havenum = FALSE;

    while (1) {
        $goto_gi_error: for (;;) { switch ($goto || (chars[bufp])) {
        case ord(' '):
        case ord('\0'):
        case ord('\t'):
        case ord('\n'):
            if (havenum) {
                /* if modifying in place, don't insert zeros */
                if (num || !modlist)
                    uchars[list + count] = uchar(num);
                count++;
                num = 0;
                havenum = FALSE;
            }
            if (count == size || !chars[bufp])
                return count;
            bufp++;
            break;

        case ord('0'):
        case ord('1'):
        case ord('2'):
        case ord('3'):
        case ord('4'):
        case ord('5'):
        case ord('6'):
        case ord('7'):
        case ord('8'):
        case ord('9'):
            havenum = TRUE;
            num = unsigned(unsigned(Math.imul(num, 10)) + unsigned((chars[bufp] - ord('0'))));
            bufp++;
            break;

        case ord('\\'):
            { $goto = "gi_error"; continue $goto_gi_error; };
            break;

        case "gi_error": default:
 $goto = null;
            raw_printf(_("Syntax error in %s"), name);
            wait_synch()();
            return count;
        } break; }
    }
    /*NOTREACHED*/
}

/* #ifdef NOCWD_ASSUMPTIONS: not in this build */

/* Choose at random one of the sep separated parts from str. Mangles str. */
function choose_random_part(str, sep) { /* char * */
    let nsep = 1;
    let csep;
    let len = 0;
    let begin = str;

    if (!str)
        return 0;

    while (chars[str]) {
        if (chars[str] == sep)
            nsep++;
        str++;
    }

    csep = rn2(nsep);

    str = begin;
    while ((csep > 0) && chars[str]) {
        str++;
        if (chars[str] == sep)
            csep--;
    }
    if (chars[str]) {
        if (chars[str] == sep)
            str++;
        begin = str;
        while (chars[str] && chars[str] != sep) {
            str++;
            len++;
        }
        chars[str] = ord('\0');
        if (len)
            return begin;
    }
    return 0;
}

function free_config_sections() { /* void */
    if (gc.config_section_chosen) {
        free(gc.config_section_chosen);
        gc.config_section_chosen = 0;
    }
    if (gc.config_section_current) {
        free(gc.config_section_current);
        gc.config_section_current = 0;
    }
}

/* check for " [ anything-except-bracket-or-empty ] # arbitrary-comment"
   with spaces optional; returns pointer to "anything-except..." (with
   trailing " ] #..." stripped) if ok, otherwise Null */
function is_config_section(
    str) { /* char * */ /* trailing spaces are stripped, ']' too iff result is good */
    let a, c, z;

    /* remove any spaces at start and end; won't significantly interfere
       with echoing the string in a config error message, if warranted */
    a = trimspaces(str);
    /* first character should be open square bracket; set pointer past it */
    if (chars[a++] != ord('['))
        return 0;
    /* last character should be close bracket, ignoring any comment */
    z = strchr(a, ord(']'));
    if (!z)
        return 0;
    /* comment, if present, can be preceded by spaces */
    for (c = z + 1; chars[c] == ord(' '); ++c)
        continue;
    if (chars[c] && chars[c] != ord('#'))
        return 0;
    /* we now know that result is good; there won't be a config error
       message so we can modify the input string */
    chars[z] = ord('\0');
    /* 'a' points past '[' and the string ends where ']' was; remove any
       spaces between '[' and choice-start and between choice-end and ']' */
    return trimspaces(a);
}

function handle_config_section(buf) { /* boolean */
    let sect = is_config_section(buf);

    if (sect) {
        if (gc.config_section_current)
            free(gc.config_section_current), gc.config_section_current = 0;
        /* is_config_section() removed brackets from 'sect' */
        if (!gc.config_section_chosen) {
            config_error_add(_("Section \"[%s]\" without CHOOSE"), sect);
            return TRUE;
        }
        if (chars[sect]) { /* got a section name */
            gc.config_section_current = dupstr(sect);
            debugpline1(_("set config section: '%s'"),
                        gc.config_section_current, __FILE__);
        } else { /* empty section name => end of sections */
            free_config_sections();
            debugpline0(_("unset config section"), __FILE__);
        }
        return TRUE;
    }

    if (gc.config_section_current) {
        if (!gc.config_section_chosen)
            return TRUE;
        if (strcmp(gc.config_section_current, gc.config_section_chosen))
            return TRUE;
    }
    return FALSE;
}

export function match_varname(INP, NAM, LEN) { return match_optname(INP, NAM, LEN, TRUE); }

/* find the '=' or ':' */
function find_optparam(buf) { /* char * */
    let bufp, altp;

    bufp = strchr(buf, ord('='));
    altp = strchr(buf, ord(':'));
    if (!bufp || (altp && altp < bufp))
        bufp = altp;

    return bufp;
}

function cnf_line_OPTIONS(origbuf) { /* boolean */
    let bufp = find_optparam(origbuf);

    ++bufp; /* skip '='; parseoptions() handles spaces */
    return parseoptions(bufp, TRUE, TRUE);
}

function cnf_line_AUTOPICKUP_EXCEPTION(bufp) { /* boolean */
    add_autopickup_exception(bufp);
    return TRUE;
}

function cnf_line_BINDINGS(bufp) { /* boolean */
    return parsebindings(bufp);
}

function cnf_line_AUTOCOMPLETE(bufp) { /* boolean */
    parseautocomplete(bufp, TRUE);
    return TRUE;
}

function cnf_line_MSGTYPE(bufp) { /* boolean */
    return msgtype_parse_add(bufp);
}

function cnf_line_HACKDIR(bufp) { /* boolean */
    (bufp);

    return TRUE;
}

function cnf_line_LEVELDIR(bufp) { /* boolean */
    (bufp);

    return TRUE;
}

function cnf_line_SAVEDIR(bufp) { /* boolean */
    /* #ifdef MICRO: not in this build */

    (bufp);

    return TRUE;
}

function cnf_line_BONESDIR(bufp) { /* boolean */
    (bufp);

    return TRUE;
}

function cnf_line_DATADIR(bufp) { /* boolean */
    (bufp);

    return TRUE;
}

function cnf_line_SCOREDIR(bufp) { /* boolean */
    (bufp);

    return TRUE;
}

function cnf_line_LOCKDIR(bufp) { /* boolean */
    (bufp);

    return TRUE;
}

function cnf_line_CONFIGDIR(bufp) { /* boolean */
    (bufp);

    return TRUE;
}

function cnf_line_TROUBLEDIR(bufp) { /* boolean */
    (bufp);

    return TRUE;
}

function cnf_line_NAME(bufp) { /* boolean */
    strncpy(svp.plname, bufp, PL_NSIZ - 1);
    return TRUE;
}

function cnf_line_ROLE(bufp) { /* boolean */
    let len;

    if ((len = str2role(bufp)) >= 0)
        flags.initrole = len;
    return TRUE;
}

function cnf_line_dogname(bufp) { /* boolean */
    strncpy(gd.dogname, bufp, PL_PSIZ - 1);
    return TRUE;
}

function cnf_line_catname(bufp) { /* boolean */
    strncpy(gc.catname, bufp, PL_PSIZ - 1);
    return TRUE;
}

function cnf_line_WIZARDS(bufp) { /* boolean */
    if (sysopt.wizards)
        free(sysopt.wizards);
    sysopt.wizards = dupstr(bufp);
    if (strlen(sysopt.wizards) && strcmp(sysopt.wizards, _("*"))) {
        /* pre-format WIZARDS list now; it's displayed during a panic
           and since that panic might be due to running out of memory,
           we don't want to risk attempting to allocate any memory then */
        if (sysopt.fmtd_wizard_list)
            free(sysopt.fmtd_wizard_list);
        sysopt.fmtd_wizard_list = build_english_list(sysopt.wizards);
    }
    return TRUE;
}

function cnf_line_SHELLERS(bufp) { /* boolean */
    if (sysopt.shellers)
        free(sysopt.shellers);
    sysopt.shellers = dupstr(bufp);
    return TRUE;
}

function cnf_line_MSGHANDLER(bufp) { /* boolean */
    if (sysopt.msghandler)
        free(sysopt.msghandler);
    sysopt.msghandler = dupstr(bufp);
    return TRUE;
}

function cnf_line_EXPLORERS(bufp) { /* boolean */
    if (sysopt.explorers)
        free(sysopt.explorers);
    sysopt.explorers = dupstr(bufp);
    return TRUE;
}

function cnf_line_DEBUGFILES(bufp) { /* boolean */
    /* might already have a vaule from getenv("DEBUGFILES");
       if so, ignore this value from SYSCF */
    if (!sysopt.env_dbgfl) {
        if (sysopt.debugfiles)
            free(sysopt.debugfiles);
        sysopt.debugfiles = dupstr(bufp);
    }
    return TRUE;
}

function cnf_line_DUMPLOGFILE(bufp) { /* boolean */
    (bufp);

    return TRUE;
}

function cnf_line_GENERICUSERS(bufp) { /* boolean */
    if (sysopt.genericusers)
        free(sysopt.genericusers);
    sysopt.genericusers = dupstr(bufp);
    return TRUE;
}

function cnf_line_BONES_POOLS(bufp) { /* boolean */
    /* max value of 10 guarantees (N % bones.pools) will be one digit
       so we don't lose control of the length of bones file names */
    let n = atoi(bufp);

    sysopt.bones_pools = (n <= 0) ? 0 : min(n, 10);
    /* note: right now bones_pools==0 is the same as bones_pools==1,
       but we could change that and make bones_pools==0 become an
       indicator to suppress bones usage altogether */
    return TRUE;
}

function cnf_line_SUPPORT(bufp) { /* boolean */
    if (sysopt.support)
        free(sysopt.support);
    sysopt.support = dupstr(bufp);
    return TRUE;
}

function cnf_line_RECOVER(bufp) { /* boolean */
    if (sysopt.recover)
        free(sysopt.recover);
    sysopt.recover = dupstr(bufp);
    return TRUE;
}

function cnf_line_CHECK_SAVE_UID(bufp) { /* boolean */
    let n = atoi(bufp);

    sysopt.check_save_uid = n;
    return TRUE;
}

function cnf_line_CHECK_PLNAME(bufp) { /* boolean */
    let n = atoi(bufp);

    sysopt.check_plname = n;
    return TRUE;
}

function cnf_line_SEDUCE(bufp) { /* boolean */
    let n = +!!atoi(bufp); /* XXX this could be tighter */

    let src = iflags.parse_config_file_src;
    let in_sysconf = +(src == set_in_sysconf);

    /* allow anyone to disable it but can only enable it in sysconf
       or as a no-op for the user when sysconf hasn't disabled it */
    if (!in_sysconf && !sysopt.seduce && n != 0) {
        config_error_add(_("Illegal value in SEDUCE"));
        n = 0;
    }
    sysopt.seduce = n;
    sysopt_seduce_set(sysopt.seduce);
    return TRUE;
}

function cnf_line_HIDEUSAGE(bufp) { /* boolean */
    let n = +!!atoi(bufp);

    sysopt.hideusage = n;
    return TRUE;
}

function cnf_line_MAXPLAYERS(bufp) { /* boolean */
    let n = atoi(bufp);

    /* XXX to get more than 25, need to rewrite all lock code */
    if (n < 0 || n > 25) {
        config_error_add(_("Illegal value in MAXPLAYERS (maximum is 25)"));
        n = 5;
    }
    sysopt.maxplayers = n;
    return TRUE;
}

function cnf_line_PERSMAX(bufp) { /* boolean */
    let n = atoi(bufp);

    if (n < 1) {
        config_error_add(_("Illegal value in PERSMAX (minimum is 1)"));
        n = 0;
    }
    sysopt.persmax = n;
    return TRUE;
}

function cnf_line_PERS_IS_UID(bufp) { /* boolean */
    let n = atoi(bufp);

    if (n != 0 && n != 1) {
        config_error_add(_("Illegal value in PERS_IS_UID (must be 0 or 1)"));
        n = 0;
    }
    sysopt.pers_is_uid = n;
    return TRUE;
}

function cnf_line_ENTRYMAX(bufp) { /* boolean */
    let n = atoi(bufp);

    if (n < 10) {
        config_error_add(_("Illegal value in ENTRYMAX (minimum is 10)"));
        n = 10;
    }
    sysopt.entrymax = n;
    return TRUE;
}

function cnf_line_POINTSMIN(bufp) { /* boolean */
    let n = atoi(bufp);

    if (n < 1) {
        config_error_add(_("Illegal value in POINTSMIN (minimum is 1)"));
        n = 100;
    }
    sysopt.pointsmin = n;
    return TRUE;
}

function cnf_line_MAX_STATUENAME_RANK(bufp) { /* boolean */
    let n = atoi(bufp);

    if (n < 1) {
        config_error_add(_("Illegal value in MAX_STATUENAME_RANK" +
                         " (minimum is 1)"));
        n = 10;
    }
    sysopt.tt_oname_maxrank = n;
    return TRUE;
}

function cnf_line_LIVELOG(bufp) { /* boolean */
    /* using 0 for base accepts "dddd" as decimal provided that first 'd'
       isn't '0', "0xhhhh" as hexadecimal, and "0oooo" as octal; ignores
       any trailing junk, including '8' or '9' for leading '0' octal */
    let L = strtoll(bufp, null, 0);

    if (L < 0 || L > 0xffff) {
        config_error_add(_("Illegal value for LIVELOG" +
                         " (must be between 0 and 0xFFFF)."));
        return 0;
    }
    sysopt.livelog = L;
    return TRUE;
}

function cnf_line_PANICTRACE_LIBC(bufp) { /* boolean */
    let n = atoi(bufp);

    sysopt.panictrace_libc = n;
    return TRUE;
}

function cnf_line_PANICTRACE_GDB(bufp) { /* boolean */
    let n = atoi(bufp);

    sysopt.panictrace_gdb = n;
    return TRUE;
}

function cnf_line_GDBPATH(bufp) { /* boolean */
    if (sysopt.gdbpath)
        free(sysopt.gdbpath);
    sysopt.gdbpath = dupstr(bufp);
    return TRUE;
}

function cnf_line_GREPPATH(bufp) { /* boolean */
    if (sysopt.greppath)
        free(sysopt.greppath);
    sysopt.greppath = dupstr(bufp);
    return TRUE;
}

function cnf_line_CRASHREPORTURL(bufp) { /* boolean */
    if (sysopt.crashreporturl)
        free(sysopt.crashreporturl);
    sysopt.crashreporturl = dupstr(bufp);
    return TRUE;
}

function cnf_line_ACCESSIBILITY(bufp) { /* boolean */
    let n = atoi(bufp);

    if (n < 0 || n > 1) {
        config_error_add(_("Illegal value in ACCESSIBILITY (not 0,1)"));
        n = 0;
    }
    sysopt.accessibility = n;
    return TRUE;
}

function cnf_line_PORTABLE_DEVICE_PATHS(bufp) { /* boolean */
    /* #ifdef WIN32: not in this build */

    (bufp);
    config_error_add(_("PORTABLE_DEVICE_PATHS is not supported"));

    return TRUE;
}

function cnf_line_BOULDER(bufp) { /* boolean */
    get_uchars(bufp, go.ov_primary_syms + (SYM_BOULDER + SYM_OFF_X),
                      TRUE, 1, _("BOULDER"));
    return TRUE;
}

function cnf_line_MENUCOLOR(bufp) { /* boolean */
    return add_menu_coloring(bufp);
}

function cnf_line_HILITE_STATUS(bufp) { /* boolean */
    return parse_status_hl1(bufp, TRUE);
}

function cnf_line_WARNINGS(bufp) { /* boolean */
    const $frame = stack_frame(); try {
    let translate = stack_array(uchar, MAXPCHARS);

    get_uchars(bufp, translate, FALSE, WARNCOUNT, _("WARNINGS"));
    assign_warnings(translate);
    return TRUE;
    } finally { stack_pop($frame); }
}

function cnf_line_ROGUESYMBOLS(bufp) { /* boolean */
    if (parsesymbols(bufp, ROGUESET)) {
        switch_symbols(TRUE);
        return TRUE;
    }
    config_error_add(_("Error in ROGUESYMBOLS definition '%s'"), bufp);
    return FALSE;
}

function cnf_line_SYMBOLS(bufp) { /* boolean */
    if (parsesymbols(bufp, PRIMARYSET)) {
        switch_symbols(TRUE);
        return TRUE;
    }
    if (!config_unmatched_ignored())
        config_error_add(_("Error in SYMBOLS definition '%s'"), bufp);
    return FALSE;
}

function cnf_line_WIZKIT(bufp) { /* boolean */
    strncpy(gw.wizkit, bufp, WIZKIT_MAX - 1);
    return TRUE;
}

/* #ifdef USER_SOUNDS: not in this build */

function cnf_line_QT_TILEWIDTH(bufp) { /* boolean */
    (bufp);

    return TRUE;
}

function cnf_line_QT_TILEHEIGHT(bufp) { /* boolean */
    (bufp);

    return TRUE;
}

function cnf_line_QT_FONTSIZE(bufp) { /* boolean */
    (bufp);

    return TRUE;
}

function cnf_line_QT_COMPACT(bufp) { /* boolean */
    (bufp);

    return TRUE;
}

/* normal */

/* normal, alias */

/* sysconf only */

  const struct_match_config_line_stmt = struct("struct_match_config_line_stmt", {
    name: ptr_to(char),
    len: int,
    syscnf_only: boolean,
    origbuf: boolean,
    fn: fnptr_t,
}); const config_line_stmt = static_array("config_line_stmt", struct_match_config_line_stmt, null, [

    /* OPTIONS handled separately */
    { name: _("OPTIONS"), len: 4, syscnf_only: FALSE, origbuf: TRUE, fn: cnf_line_OPTIONS },
    { name: _("AUTOPICKUP_EXCEPTION"), len: 5, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_AUTOPICKUP_EXCEPTION },
    { name: _("BINDINGS"), len: 4, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_BINDINGS },
    { name: _("AUTOCOMPLETE"), len: 5, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_AUTOCOMPLETE },
    { name: _("MSGTYPE"), len: 7, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_MSGTYPE },
    { name: _("HACKDIR"), len: 4, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_HACKDIR },
    { name: _("LEVELDIR"), len: 4, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_LEVELDIR },
    { name: _("LEVELS"), len: 4, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_LEVELDIR },
    { name: _("SAVEDIR"), len: 4, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_SAVEDIR },
    { name: _("BONESDIR"), len: 5, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_BONESDIR },
    { name: _("DATADIR"), len: 4, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_DATADIR },
    { name: _("SCOREDIR"), len: 4, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_SCOREDIR },
    { name: _("LOCKDIR"), len: 4, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_LOCKDIR },
    { name: _("CONFIGDIR"), len: 4, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_CONFIGDIR },
    { name: _("TROUBLEDIR"), len: 4, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_TROUBLEDIR },
    { name: _("NAME"), len: 4, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_NAME },
    { name: _("ROLE"), len: 4, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_ROLE },
    { name: _("CHARACTER"), len: 4, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_ROLE },
    { name: _("dogname"), len: 3, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_dogname },
    { name: _("catname"), len: 3, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_catname },

    { name: _("WIZARDS"), len: 7, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_WIZARDS },
    { name: _("SHELLERS"), len: 8, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_SHELLERS },
    { name: _("MSGHANDLER"), len: 9, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_MSGHANDLER },
    { name: _("EXPLORERS"), len: 7, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_EXPLORERS },
    { name: _("DEBUGFILES"), len: 5, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_DEBUGFILES },
    { name: _("DUMPLOGFILE"), len: 7, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_DUMPLOGFILE },
    { name: _("GENERICUSERS"), len: 12, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_GENERICUSERS },
    { name: _("BONES_POOLS"), len: 10, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_BONES_POOLS },
    { name: _("SUPPORT"), len: 7, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_SUPPORT },
    { name: _("RECOVER"), len: 7, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_RECOVER },
    { name: _("CHECK_SAVE_UID"), len: 14, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_CHECK_SAVE_UID },
    { name: _("CHECK_PLNAME"), len: 12, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_CHECK_PLNAME },
    { name: _("SEDUCE"), len: 6, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_SEDUCE },
    { name: _("HIDEUSAGE"), len: 9, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_HIDEUSAGE },
    { name: _("MAXPLAYERS"), len: 10, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_MAXPLAYERS },
    { name: _("PERSMAX"), len: 7, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_PERSMAX },
    { name: _("PERS_IS_UID"), len: 11, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_PERS_IS_UID },
    { name: _("ENTRYMAX"), len: 8, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_ENTRYMAX },
    { name: _("POINTSMIN"), len: 9, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_POINTSMIN },
    { name: _("MAX_STATUENAME_RANK"), len: 10, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_MAX_STATUENAME_RANK },
    { name: _("LIVELOG"), len: 7, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_LIVELOG },
    { name: _("PANICTRACE_LIBC"), len: 15, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_PANICTRACE_LIBC },
    { name: _("PANICTRACE_GDB"), len: 14, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_PANICTRACE_GDB },
    { name: _("CRASHREPORTURL"), len: 13, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_CRASHREPORTURL },
    { name: _("GDBPATH"), len: 7, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_GDBPATH },
    { name: _("GREPPATH"), len: 7, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_GREPPATH },
    { name: _("ACCESSIBILITY"), len: 13, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_ACCESSIBILITY },
    { name: _("PORTABLE_DEVICE_PATHS"), len: 8, syscnf_only: TRUE, origbuf: FALSE, fn: cnf_line_PORTABLE_DEVICE_PATHS },

    { name: _("BOULDER"), len: 3, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_BOULDER },
    { name: _("MENUCOLOR"), len: 9, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_MENUCOLOR },
    { name: _("HILITE_STATUS"), len: 6, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_HILITE_STATUS },
    { name: _("WARNINGS"), len: 5, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_WARNINGS },
    { name: _("ROGUESYMBOLS"), len: 4, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_ROGUESYMBOLS },
    { name: _("SYMBOLS"), len: 4, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_SYMBOLS },
    { name: _("WIZKIT"), len: 6, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_WIZKIT },

    { name: _("QT_TILEWIDTH"), len: 12, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_QT_TILEWIDTH },
    { name: _("QT_TILEHEIGHT"), len: 13, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_QT_TILEHEIGHT },
    { name: _("QT_FONTSIZE"), len: 11, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_QT_FONTSIZE },
    { name: _("QT_COMPACT"), len: 10, syscnf_only: FALSE, origbuf: FALSE, fn: cnf_line_QT_COMPACT }

]);

const disregarded_config_lines = static_array("disregarded_config_lines", schar, SIZE(config_line_stmt));

export function parse_config_line(origbuf) { /* boolean */
    const $frame = stack_frame(); try {
    let src = iflags.parse_config_file_src;
    let in_sysconf = +(src == set_in_sysconf);

    let bufp, buf = stack_array(char, 4 * BUFSZ);
    let i;

    while (chars[origbuf] == ord(' ') || chars[origbuf] == ord('\t')) /* skip leading whitespace */
        ++origbuf;                   /* (caller probably already did this) */
    strncpy(buf, origbuf, sizeof(array_of(char, 4 * BUFSZ)) - 1);
    chars[buf + (sizeof(array_of(char, 4 * BUFSZ)) - 1)] = ord('\0'); /* strncpy not guaranteed to NUL terminate */
    /* convert any tab to space, condense consecutive spaces into one,
       remove leading and trailing spaces (exception: if there is nothing
       but spaces, one of them will be kept even though it leads/trails) */
    mungspaces(buf);

    /* find the '=' or ':' */
    bufp = find_optparam(buf);
    if (!bufp) {
        if (!ignore_statement_errors[0])
            config_error_add(_("Not a config statement, missing '='"));
        return FALSE;
    }
    /* skip past '=', then space between it and value, if any */
    ++bufp;
    if (chars[bufp] == ord(' '))
        ++bufp;

    for (i = 0; i < SIZE(config_line_stmt); i++) {
        if (config_line_stmt[i].syscnf_only && !in_sysconf)
            continue;

        if (match_varname(buf, config_line_stmt[i].name,
                          config_line_stmt[i].len)) {
            let parm = config_line_stmt[i].origbuf ? origbuf : bufp;

            if (!chars[disregarded_config_lines + i])
                return config_line_stmt[i].fn(parm);
        }
    }

    if (!ignore_errors_on_unmatched[0])
        config_error_add(_("Unknown config statement"));
    return FALSE;
    } finally { stack_pop($frame); }
}

const struct__config_error_errmsg = struct("struct__config_error_errmsg", {
    line_num: int,
    errormsg: ptr_to(char),
    next: ptr_to("struct__config_error_errmsg"),
});

const struct__config_error_frame = struct("struct__config_error_frame", {
    line_num: int,
    num_errors: int,
    origline_shown: boolean,
    fromfile: boolean,
    secure: boolean,
    origline: array_of(char, 4 * BUFSZ),
    source: array_of(char, BUFSZ),
    next: ptr_to("struct__config_error_frame"),
});

const config_error_data = static_var("config_error_data", ptr_to(struct__config_error_frame), null);
const config_error_msg = static_var("config_error_msg", ptr_to(struct__config_error_errmsg), null);

export function config_error_init(from_file, sourcename, secure) { /* void */
    let tmp = view_of(struct__config_error_frame, addr_of(alloc(sizeof(struct__config_error_frame))));

    tmp.line_num = 0;
    tmp.num_errors = 0;
    tmp.origline_shown = FALSE;
    tmp.fromfile = from_file;
    tmp.secure = secure;
    chars[tmp.origline + 0] = ord('\0');
    if (sourcename && chars[sourcename + 0]) {
        strncpy(tmp.source, sourcename, sizeof_member(tmp, "source") - 1);
        chars[tmp.source + (sizeof_member(tmp, "source") - 1)] = ord('\0');
    } else
        chars[tmp.source + 0] = ord('\0');

    tmp.next = config_error_data[0];
    config_error_data[0] = tmp;
    program_state.config_error_ready = TRUE;
}

function config_error_nextline(line) { /* boolean */
    let ced = config_error_data[0];

    if (!ced)
        return FALSE;

    if (ced.num_errors && ced.secure)
        return FALSE;

    ced.line_num++;
    ced.origline_shown = FALSE;
    if (line && chars[line + 0]) {
        strncpy(ced.origline, line, sizeof_member(ced, "origline") - 1);
        chars[ced.origline + (sizeof_member(ced, "origline") - 1)] = ord('\0');
    } else
        chars[ced.origline + 0] = ord('\0');

    return TRUE;
}

export function l_get_config_errors(L) { /* int */
    let dat = config_error_msg[0];
    let tmp;
    let idx = 1;

    lua_newtable(L);

    while (dat) {
        lua_pushinteger(L, idx++);
        lua_newtable(L);
        nhl_add_table_entry_int(L, _("line"), dat.line_num);
        nhl_add_table_entry_str(L, _("error"), dat.errormsg);
        lua_settable(L, -3);
        tmp = dat.next;
        free(dat.errormsg);
        dat.errormsg = 0;
        free(addr_of(dat));
        dat = tmp;
    }
    config_error_msg[0] = null;

    return 1;
}

/* varargs 'config_error_add()' moved to pline.c */
export function config_erradd(buf) { /* void */
    const $frame = stack_frame(); try {
    let lineno = stack_array(char, QBUFSZ);
    let punct;

    if (!buf || !chars[buf])
        buf = _("Unknown error");

    /* if buf[] doesn't end in a period, exclamation point, or question mark,
       we'll include a period (in the message, not appended to buf[]) */
    punct = c_eos(buf) - 1; /* eos(buf)-1 is valid */
    punct = strchr(_(".!?"), chars[punct]) ? _("") : _(".");

    if (!program_state.config_error_ready) {
        /* either very early, where pline() will use raw_print(), or
           player gave bad value when prompted by interactive 'O' command */
        pline(_("%s%s%s"), !iflags.window_inited ? _("config_error_add: ") : _(""),
              buf, punct);
        wait_synch()();
        return;
    }

    if (iflags.in_lua) {
        let dat = view_of(struct__config_error_errmsg, addr_of(alloc(sizeof(struct__config_error_errmsg))));

        dat.next = config_error_msg[0];
        dat.line_num = config_error_data[0].line_num;
        dat.errormsg = dupstr(buf);
        config_error_msg[0] = dat;
        return;
    }

    config_error_data[0].num_errors++;
    if (!config_error_data[0].origline_shown && !config_error_data[0].secure) {
        pline(_("\n%s"), config_error_data[0].origline);
        config_error_data[0].origline_shown = TRUE;
    }
    if (config_error_data[0].line_num > 0 && !config_error_data[0].secure) {
        sprintf(lineno, _("Line %d: "), config_error_data[0].line_num);
    } else
        chars[lineno + 0] = ord('\0');

    pline(_("%s %s%s%s"), config_error_data[0].secure ? _("Error:") : _(" *"),
          lineno, buf, punct);
    } finally { stack_pop($frame); }
}

export function config_error_done() { /* int */
    let n;
    let tmp = config_error_data[0];

    if (!config_error_data[0])
        return 0;
    n = config_error_data[0].num_errors;

    if (gn.no_sound_notified > 0) {
        /* no USER_SOUNDS; config_error_add() was called once for first
           SOUND or SOUNDDIR entry seen, then skipped for any others;
           include those skipped ones in the total error count */
        n += (gn.no_sound_notified - 1);
        gn.no_sound_notified = 0;
    }

    if (n) {
        let cmdline = +!strcmp(config_error_data[0].source, _("command line"));

        pline(_("\n%d error%s %s %s.\n"), n, plur(n), cmdline ? _("on") : _("in"),
              chars[config_error_data[0].source] ? config_error_data[0].source
                                         : configfile);
        wait_synch()();
    }
    config_error_data[0] = tmp.next;
    free(addr_of(tmp));
    program_state.config_error_ready = +(config_error_data[0] != null);
    return n;
}

export function read_config_file(filename, src) { /* boolean */
    let fp;
    let rv = TRUE;

    if (!(fp = fopen_config_file(filename, src)))
        return FALSE;

    /* begin detection of duplicate configfile options */
    reset_duplicate_opt_detection();

    free_config_sections();
    iflags.parse_config_file_src = src;

    rv = parse_conf_file(fp, parse_config_line);
    fclose(fp);

    free_config_sections();

    /* turn off detection of duplicate configfile options */
    reset_duplicate_opt_detection();

    return rv;
}

const struct__cnf_parser_state = struct("struct__cnf_parser_state", {
    inbuf: ptr_to(char),
    inbufsz: unsigned,
    rv: int,
    ep: ptr_to(char),
    buf: ptr_to(char),
    skip: boolean, morelines: boolean,
    cont: boolean,
    pbreak: boolean,
});

/* Initialize config parser data */
function cnf_parser_init(parser) { /* void */
    parser.rv = TRUE; /* assume successful parse */
    parser.ep = parser.buf = 0;
    parser.skip = FALSE;
    parser.morelines = FALSE;
    parser.inbufsz = 4 * BUFSZ;
    parser.inbuf = addr_of(alloc(parser.inbufsz));
    parser.cont = FALSE;
    parser.pbreak = FALSE;
    memset(parser.inbuf, 0, parser.inbufsz);
}

/* caller has finished with 'parser' (except for 'rv' so leave that intact) */
function cnf_parser_done(parser) { /* void */
    parser.ep = 0; /* points into parser->inbuf, so becoming stale */
    if (parser.inbuf)
        free(parser.inbuf), parser.inbuf = 0;
    if (parser.buf)
        free(parser.buf), parser.buf = 0;
}

/*
 * Parse config buffer, handling comments, empty lines, config sections,
 * CHOOSE, and line continuation, calling proc for every valid line.
 *
 * Continued lines are merged together with one space in between.
 */
function parse_conf_buf(p, proc) { /* void */
    p.cont = FALSE;
    p.pbreak = FALSE;
    p.ep = strchr(p.inbuf, ord('\n'));
    if (p.skip) { /* in case previous line was too long */
        if (p.ep)
            p.skip = FALSE; /* found newline; next line is normal */
    } else {
        if (!p.ep) {  /* newline missing */
            if (strlen(p.inbuf) < unsigned(p.inbufsz - 2)) {
                /* likely the last line of file is just
                   missing a newline; process it anyway  */
                p.ep = eos(p.inbuf);
            } else {
                config_error_add(_("Line too long, skipping"));
                p.skip = TRUE; /* discard next fgets */
            }
        } else {
            chars[p.ep] = ord('\0'); /* remove newline */
        }
        if (p.ep) {
            let tmpbuf = 0;
            let len;
            let ignoreline = FALSE;
            let oldline = FALSE;

            /* line continuation (trailing '\') */
            p.morelines = +(--p.ep >= p.inbuf && chars[p.ep] == ord('\\'));
            if (p.morelines)
                chars[p.ep] = ord('\0');

            /* trim off spaces at end of line */
            while (p.ep >= p.inbuf
                   && (chars[p.ep] == ord(' ') || chars[p.ep] == ord('\t') || chars[p.ep] == ord('\r')))
                chars[p.ep--] = ord('\0');

            if (!config_error_nextline(p.inbuf)) {
                p.rv = FALSE;
                if (p.buf)
                    free(p.buf), p.buf = 0;
                p.pbreak = TRUE;
                return;
            }

            p.ep = p.inbuf;
            while (chars[p.ep] == ord(' ') || chars[p.ep] == ord('\t'))
                ++p.ep;

            /* ignore empty lines and full-line comment lines */
            if (!chars[p.ep] || chars[p.ep] == ord('#'))
                ignoreline = TRUE;

            if (p.buf)
                oldline = TRUE;

            /* merge now read line with previous ones, if necessary */
            if (!ignoreline) {
                len = int(strlen(p.ep)) + 1; /* +1: final '\0' */
                if (p.buf)
                    len += int(strlen(p.buf)) + 1; /* +1: space */
                tmpbuf = addr_of(alloc(unsigned(len)));
                chars[tmpbuf] = ord('\0');
                if (p.buf) {
                    strcat(strcpy(tmpbuf, p.buf), _(" "));
                    free(p.buf), p.buf = 0;
                }
                p.buf = strcat(tmpbuf, p.ep);
                if (strlen(p.buf) >= p.inbufsz)
                    chars[p.buf + unsigned(p.inbufsz - 1)] = ord('\0');
            }

            if (p.morelines || (ignoreline && !oldline))
                return;

            if (handle_config_section(p.buf)) {
                free(p.buf), p.buf = 0;
                return;
            }

            /* from here onwards, we'll handle buf only */

            if (match_varname(p.buf, _("CHOOSE"), 6)) {
                let section;
                let bufp = find_optparam(p.buf);

                if (!bufp) {
                    config_error_add(_("Format is CHOOSE=section1" +
                                     ",section2,..."));
                    p.rv = FALSE;
                    free(p.buf), p.buf = 0;
                    return;
                }
                bufp++;
                if (gc.config_section_chosen)
                    free(gc.config_section_chosen),
                        gc.config_section_chosen = 0;
                section = choose_random_part(bufp, ord(','));
                if (section) {
                    gc.config_section_chosen = dupstr(section);
                } else {
                    config_error_add(_("No config section to choose"));
                    p.rv = FALSE;
                }
                free(p.buf), p.buf = 0;
                return;
            }

            if (!proc(p.buf))
                p.rv = FALSE;

            free(p.buf), p.buf = 0;
        }
    }
}

export function parse_conf_str(str, proc) { /* boolean */
    const $frame = stack_frame(); try {
    let len;
    let parser = stack_struct(struct__cnf_parser_state);

    cnf_parser_init(parser);
    free_config_sections();
    config_error_init(FALSE, _("parse_conf_str"), FALSE);
    while (str && chars[str]) {
        len = 0;
        while (chars[str] && len < unsigned(parser.inbufsz-1)) {
            chars[parser.inbuf + len] = chars[str];
            len++;
            str++;
            if (chars[parser.inbuf + unsigned(len-1)] == ord('\n'))
                break;
        }
        chars[parser.inbuf + len] = ord('\0');
        parse_conf_buf(parser, proc);
        if (parser.pbreak)
            break;
    }
    cnf_parser_done(parser);

    free_config_sections();
    config_error_done();
    return parser.rv;
    } finally { stack_pop($frame); }
}

/* parse_conf_file
 *
 * Read from file fp, calling parse_conf_buf for each line.
 */
export function parse_conf_file(fp, proc) { /* boolean */
    const $frame = stack_frame(); try {
    let parser = stack_struct(struct__cnf_parser_state);

    cnf_parser_init(parser);
    free_config_sections();

    while (fgets(parser.inbuf, int(parser.inbufsz), fp)) {
        parse_conf_buf(parser, proc);
        if (parser.pbreak)
            break;
    }
    cnf_parser_done(parser);

    free_config_sections();
    return parser.rv;
    } finally { stack_pop($frame); }
}

export function config_error_add(str, ...args) { /* void */
    let the_args;

    the_args = va_start(args);
    vconfig_error_add(str, the_args);
    va_end(the_args);
}

function vconfig_error_add(str, the_args) { /* void */
    const $frame = stack_frame(); try { /* start of vconf...() or of nested block in USE_OLDARG's conf...() */
    let vlen = 0;
    let buf = stack_array(char, BIGBUFSZ); /* will be chopped down to BUFSZ-1 if longer */

    vlen = vsnprintf(buf, sizeof(array_of(char, BIGBUFSZ)), str, the_args);

    (vlen);

    chars[buf + (BUFSZ - 1)] = ord('\0');
    config_erradd(buf);
    } finally { stack_pop($frame); }
}

export function rcfile() { /* void */
    let opts = 0, xtraopts = 0;
    let envname, namesrc, nameval;

    go.opt_phase = environ_opt;
    /* getenv() instead of nhgetenv(): let total length of options be long;
       parseoptions() will check each individually */
    envname = _("NETHACKOPTIONS");
    opts = getenv(envname);
    if (!opts) {
        /* fall back to original name; discouraged */
        envname = _("HACKOPTIONS");
        opts = getenv(envname);
    }

    if (gc.cmdline_rcfile) {
        namesrc = _("command line");
        nameval = gc.cmdline_rcfile;
        xtraopts = opts;
        if (opts && (chars[opts] == ord('/') || chars[opts] == ord('\\') || chars[opts] == ord('@')))
            xtraopts = 0; /* NETHACKOPTIONS is a file name; ignore it */
    } else if (opts && (chars[opts] == ord('/') || chars[opts] == ord('\\') || chars[opts] == ord('@'))) {
        /* NETHACKOPTIONS is a file name; use that instead of the default */
        if (chars[opts] == ord('@'))
            ++opts; /* @filename */
        namesrc = envname;
        nameval = opts;
        xtraopts = 0;
    } else {
        /* either no NETHACKOPTIONS or it wasn't a file name;
           read the default configuration file */
        nameval = namesrc = 0;
        xtraopts = opts;
    }

    go.opt_phase = rc_file_opt;
    /* seemingly arbitrary name length restriction is to prevent error
       messages, if any were to be delivered while accessing the file,
       from potentially overflowing buffers */
    if (nameval && int(strlen(nameval)) >= Math.trunc(BUFSZ / 2)) {
        config_error_init(TRUE, namesrc, FALSE);
        config_error_add(
            _("nethackrc file name \"%.40s\"... too long; using default"),
            nameval);
        config_error_done();
        nameval = namesrc = 0; /* revert to default nethackrc */
    }

    config_error_init(TRUE, nameval, nameval ? TRUE : FALSE);
    read_config_file(nameval, set_in_config);
    config_error_done();
    if (xtraopts) {
        /* NETHACKOPTIONS is present and not a file name */
        go.opt_phase = environ_opt;
        config_error_init(FALSE, envname, FALSE);
        parseoptions(xtraopts, TRUE, FALSE);
        config_error_done();
    }

    if (gc.cmdline_rcfile)
        free(gc.cmdline_rcfile), gc.cmdline_rcfile = 0;
    /*[end of nethackrc handling]*/
}

export function rcfile_interface_options() { /* void */
    allopt_array_init();
    disregard_all_options();
    disregard_all_config_statements();
    heed_this_option(opt_windowtype);
    heed_this_option(opt_soundlib);
    set_ignore_errors_on_unmatched();
    ignore_statement_errors[0] = TRUE;
    rcfile();
    heed_all_config_statements();
    heed_all_options();
    disregard_this_option(opt_windowtype);
    disregard_this_option(opt_soundlib);
    clear_ignore_errors_on_unmatched();
    ignore_statement_errors[0] = FALSE;
}

export function heed_all_config_statements() { /* void */
    let i;

    for (i = 0; i < (Math.trunc((sizeof(array_of(schar, SIZE(config_line_stmt))) / sizeof(schar)))); i++) {
        chars[disregarded_config_lines + i] = FALSE;
    }
}
export function disregard_all_config_statements() { /* void */
    let i;

    for (i = 0; i < (Math.trunc((sizeof(array_of(schar, SIZE(config_line_stmt))) / sizeof(schar)))); i++) {
        chars[disregarded_config_lines + i] = TRUE;
    }
}
export function heed_this_config_statement(statement_idx) { /* void */
    if (statement_idx >= 0 && statement_idx < (Math.trunc((sizeof(array_of(schar, SIZE(config_line_stmt))) / sizeof(schar)))))
        chars[disregarded_config_lines + statement_idx] = FALSE;
}
export function disregard_this_config_statement(statement_idx) { /* void */
    if (statement_idx >= 0 && statement_idx < (Math.trunc((sizeof(array_of(schar, SIZE(config_line_stmt))) / sizeof(schar)))))
        chars[disregarded_config_lines + statement_idx] = TRUE;
}

export function clear_ignore_errors_on_unmatched() { /* void */
    ignore_errors_on_unmatched[0] = FALSE;
}
export function set_ignore_errors_on_unmatched() { /* void */
    ignore_errors_on_unmatched[0] = TRUE;
}
export function config_unmatched_ignored() { /* boolean */
    if (ignore_errors_on_unmatched[0])
        return TRUE;
    return FALSE;
}

export function assure_syscf_file() { /* void */
    let fd;

    /*
     * All we really care about is the end result - can we read the file?
     * So just check that directly.
     *
     * Not tested on most of the old platforms (which don't attempt
     * to implement SYSCF).
     * Some ports don't like open()'s optional third argument;
     * VMS overrides open() usage with a macro which requires it.
     */

    fd = open(_(SYSCF_FILE), O_RDONLY);

    if (fd >= 0) {
        /* readable */
        close(fd);
        return;
    }

    if (gd.deferred_showpaths)
        do_deferred_showpaths(1); /* does not return */

    raw_printf(_("Unable to open SYSCF_FILE.\n"));
    exit(EXIT_FAILURE);
}

/* ----------  END CONFIG FILE HANDLING ----------- */

/*cfgfiles.c*/

import { SYSCF_FILE } from "./config.h.js";
import { MAXPCHARS } from "./defsym.h.js";
import {
    BUFSZ, FALSE, PL_NSIZ, PL_PSIZ, QBUFSZ, TRUE, boolean, environ_opt, rc_file_opt, set_in_config,
    set_in_sysconf,
} from "./global.h.js";
import { ECMD_OK, SYM_OFF_X, SYSCONFPREFIX, WIZKIT_MAX, struct_strbuf } from "./hack.h.js";
import { FEATURE_NOTICE_VER, min, plur } from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { debugpline0, debugpline1 } from "./lint.h.macros.js";
import { lua_newtable } from "./lua.h.macros.js";
import { opt_soundlib, opt_windowtype } from "./optlist.h.js";
import { PRIMARYSET, ROGUESET, SYM_BOULDER, WARNCOUNT } from "./sym.h.js";
import { wait_synch } from "./winprocs.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, schar, sizeof, sizeof_string, uchar, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import {
    ENOENT, EXIT_FAILURE, O_RDONLY, __errno_location, access, atoi, close, exit, fclose, fgets,
    fopen, free, fwrite, getenv, memset, open, sprintf, strcat, strchr, strcmp, strcpy, strerror,
    strlen, strncmp, strncpy, strtoll, vsnprintf,
} from "../rt/libc.js";
import { stack_array, stack_struct, static_array, static_var } from "../rt/locals.js";
import { lua_pushinteger, lua_settable } from "../rt/lua.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, fnptr_t, ptr_to, sizeof_member, struct, view_of,
} from "../rt/struct.js";
import { va_end, va_start } from "../rt/varargs.js";
import { alloc, dupstr } from "./alloc.js";
import { parse_status_hl1 } from "./botl.js";
import { paranoid_query, parseautocomplete } from "./cmd.js";
import { add_menu_coloring } from "./coloratt.js";
import { flags, gc, gd, gn, go, gw, iflags, program_state, svp } from "./decl.js";
import { build_english_list } from "./end.js";
import { do_deferred_showpaths, fqname } from "./files.js";
import { c_eos, eos, mungspaces, trimspaces } from "./hacklib.js";
import { nhl_add_table_entry_int, nhl_add_table_entry_str } from "./nhlua.js";
import {
    add_autopickup_exception, all_options_strbuf, allopt_array_init, assign_warnings,
    disregard_all_options, disregard_this_option, heed_all_options, heed_this_option, match_optname,
    msgtype_parse_add, nh_getenv, parsebindings, parseoptions, reset_duplicate_opt_detection,
} from "./options.js";
import { pline, raw_printf } from "./pline.js";
import { rn2 } from "./rnd.js";
import { str2role } from "./role.js";
import { strbuf_empty, strbuf_init } from "./strutil.js";
import { parsesymbols, switch_symbols } from "./symbols.js";
import { sysopt, sysopt_seduce_set } from "./sys.js";
const __FILE__ = "cfgfiles.c";
