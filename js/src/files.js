/* NetHack 5.0	files.c	$NHDT-Date: 1740532826 2025/02/25 17:20:26 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.417 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Derek S. Ray, 2015. */
/* NetHack may be freely redistributed.  See license for details. */

/* #ifdef SFCTOOL: not in this build */

export const O_BINARY = 0;

  /* #ifdef AMIGA: not in this build */

  /* #if defined(WIN32) || defined(MSDOS): not in this build */

  /* in extern.h; why here too? */

/* return a file's name without its path and optionally trailing 'type' */
export function nh_basename(fname, keep_suffix) { /* const char * */
    let basebuf = static_array("nh_basename.basebuf", char, 80);
    let p;

    if ((p = strrchr(fname, ord('/'))) != 0)
        fname = p + 1;

    if ((p = strrchr(fname, ord('.'))) != 0 && !keep_suffix) {
        let ln = unsigned((p - fname));
        /* note that without path, name should be reasonable length;
           it is expected to refer to a source file name or run-time
           configuration file name and those aren't arbitrarily long;
           if "name" part of "name.suffix" is too long for 'basebuf[]',
           just return that as-is without stripping off ".suffix" */

        if (ln < sizeof(array_of(char, 80))) {
            strncpy(basebuf, fname, ln);
            chars[basebuf + ln] = ord('\0');
            fname = basebuf;
        }
    }

    return fname;
}

/*
 * fname_encode()
 *
 *   Args:
 *      legal       zero-terminated list of acceptable file name characters
 *      quotechar   lead-in character used to quote illegal characters as
 *                  hex digits
 *      s           string to encode
 *      callerbuf   buffer to house result
 *      bufsz       size of callerbuf
 *
 *   Notes:
 *      The hex digits 0-9 and A-F are always part of the legal set due to
 *      their use in the encoding scheme, even if not explicitly included in
 *      'legal'.
 *
 *   Sample:
 *      The following call:
 * (void) fname_encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
 *                     '%', "This is a % test!", buf, 512);
 *      results in this encoding:
 *          "This%20is%20a%20%25%20test%21"
 */
export function fname_encode(
    legal,
    quotechar,
    s,
    callerbuf,
    bufsz) { /* char * */
    let sp, op;
    let cnt = 0;
    let hexdigits = init_string(static_array("fname_encode.hexdigits", char, sizeof_string("0123456789ABCDEF")), _("0123456789ABCDEF"), true);

    sp = s;
    op = callerbuf;
    chars[op] = ord('\0');

    while (chars[sp]) {
        /* Do we have room for one more character or encoding? */
        if ((bufsz - cnt) <= 4)
            return callerbuf;

        if (chars[sp] == quotechar) {
            sprintf(op, _("%c%02X"), quotechar, chars[sp]);
            op += 3;
            cnt += 3;
        } else if ((strchr(legal, chars[sp]) != 0)
                   || (strchr(hexdigits, chars[sp]) != 0)) {
            chars[op++] = chars[sp];
            chars[op] = ord('\0');
            cnt++;
        } else {
            sprintf(op, _("%c%02X"), quotechar, chars[sp]);
            op += 3;
            cnt += 3;
        }
        sp++;
    }
    return callerbuf;
}

/*
 * fname_decode()
 *
 *   Args:
 *      quotechar   lead-in character used to quote illegal characters as
 *                  hex digits
 *      s           string to decode
 *      callerbuf   buffer to house result
 *      bufsz       size of callerbuf
 */
export function fname_decode(quotechar, s, callerbuf, bufsz) { /* char * */
    let sp, op;
    let k, calc, cnt = 0;
    let hexdigits = init_string(static_array("fname_decode.hexdigits", char, sizeof_string("0123456789ABCDEF")), _("0123456789ABCDEF"), true);

    sp = s;
    op = callerbuf;
    chars[op] = ord('\0');

    while (chars[sp]) {
        /* Do we have room for one more character? */
        if ((bufsz - cnt) <= 2)
            return callerbuf;
        if (chars[sp] == quotechar) {
            sp++;
            for (k = 0; k < 16; ++k)
                if (chars[sp] == chars[hexdigits + k])
                    break;
            if (k >= 16)
                return callerbuf; /* impossible, so bail */
            calc = k << 4;
            sp++;
            for (k = 0; k < 16; ++k)
                if (chars[sp] == chars[hexdigits + k])
                    break;
            if (k >= 16)
                return callerbuf; /* impossible, so bail */
            calc += k;
            sp++;
            chars[op++] = calc;
            chars[op] = ord('\0');
        } else {
            chars[op++] = chars[sp++];
            chars[op] = ord('\0');
        }
        cnt++;
    }
    return callerbuf;
}

/*ARGSUSED*/
export function fqname(basenam,
       whichprefix,
       buffnum) { /* const char * */
    return basenam;
/* #else (#ifndef PREFIXES_IN_USE): not in this build */
}

/* reasonbuf must be at least BUFSZ, supplied by caller */
export function validate_prefix_locations(reasonbuf) { /* int */
    if (reasonbuf)
        chars[reasonbuf + 0] = ord('\0');
        /* #if defined(NOCWD_ASSUMPTIONS): not in this build */

        return 1;
}

/* fopen a file, with OS-dependent bells and whistles */
/* NOTE: a simpler version of this routine also exists in util/dlb_main.c */
export function fopen_datafile(filename, mode, prefix) { /* FILE * */
    let fp;

    filename = fqname(filename, prefix, prefix == TROUBLEPREFIX ? 3 : 0);
    fp = fopen(filename, mode);
    return fp;
}

/* ----------  EXTERNAL FILE SUPPORT ----------- */

/* determine byte order */
const bei = static_var("bei", int, 1);
export function IS_BIGENDIAN() { return ( +((chars[addr_of(bei)]) == 0) ); }

export function init_nhfile(nhfp) { /* void */
    if (nhfp.structlevel) {
        if (nhfp.fd != -1) {
            impossible(_("Warning - Unclosed structlevel file being reinitialized"));
            nhclose(nhfp.fd);
        }
    } else if (nhfp.fpdef) {
        if (nhfp.fpdef) {
            impossible(_("Warning - Unclosed fieldlevel file being reinitialized"));
            fclose(nhfp.fpdef);
        }
    }
    nhfp.fd = -1;
    nhfp.fpdef = null;

    nhfp.mode = COUNTING;
    nhfp.structlevel = TRUE;
    nhfp.fieldlevel = FALSE;
    nhfp.addinfo = FALSE;
    nhfp.bendian = IS_BIGENDIAN();
    nhfp.fplog = null;
    nhfp.fpdebug = null;
    nhfp.rcount = nhfp.wcount = 0;
    nhfp.eof = FALSE;
    nhfp.fnidx = 0;
    nhfp.style.deflt = FALSE;
    nhfp.style.binary = TRUE;
    nhfp.nhfpconvert = null;
}

function new_nhfile() { /* NHFILE * */
    let nhfp = view_of(struct_nh_file, addr_of(alloc(sizeof(struct_nh_file))));

    memset(addr_of(nhfp), 0, sizeof(struct_nh_file));
    init_nhfile(nhfp);
    return nhfp;
}

function free_nhfile(nhfp) { /* void */
    if (nhfp) {
        init_nhfile(nhfp);
        free(addr_of(nhfp));
    }
}

export function close_nhfile(nhfp) { /* void */
    if (nhfp.structlevel && nhfp.fd != -1)
        nhclose(nhfp.fd), nhfp.fd = -1;
    else if (nhfp.fpdef)
        fclose(nhfp.fpdef), nhfp.fpdef = null;
    if (nhfp.fplog)
        fprintf(nhfp.fplog, _("# closing\n"));
    if (nhfp.fplog)
        fclose(nhfp.fplog);
    if (nhfp.fpdebug)
        fclose(nhfp.fpdebug);
    free_nhfile(nhfp);
}

export function rewind_nhfile(nhfp) { /* void */
    if (nhfp.structlevel) {
        lseek(nhfp.fd, 0, 0);
    } else {
        rewind(nhfp.fpdef);
    }
}

function viable_nhfile(nhfp) { /* NHFILE * */
    /* perform some sanity checks before returning
       the pointer to the nethack file descriptor */
    if (nhfp) {
         /* check for no open file at all,
          * not a structlevel legacy file,
          * nor a fieldlevel file.
          */
         if (((nhfp.fd == -1) && !nhfp.fpdef)
                || (nhfp.structlevel && nhfp.fd < 0)
                || (nhfp.fieldlevel && !nhfp.fpdef)) {
            /* not viable, start the cleanup */
            if (nhfp.fieldlevel) {
                if (nhfp.fpdef) {
                    fclose(nhfp.fpdef);
                    nhfp.fpdef = null;
                }
                if (nhfp.fplog) {
                    fprintf(nhfp.fplog, _("# closing, not viable\n"));
                    fclose(nhfp.fplog);
                }
                if (nhfp.fpdebug)
                    fclose(nhfp.fpdebug);
            }
            free_nhfile(nhfp);
            nhfp = null;
        }
    }
    return nhfp;
}

export function nhclose(fd) { /* int */
    let retval = 0;

    if (fd >= 0) {
        if (close_check(fd))
            bclose(fd);
        else
            retval = close(fd);
    }
    return retval;
}

/* ----------  BEGIN LEVEL FILE HANDLING ----------- */

/* Construct a file name for a level-type file, which is of the form
 * something.level (with any old level stripped off).
 * This assumes there is space on the end of 'file' to append
 * a two digit number.  This is true for 'level'
 * but be careful if you use it for other things -dgk
 */
export function set_levelfile_name(file, lev) { /* void */
    let tf;

    tf = strrchr(file, ord('.'));
    if (!tf)
        tf = eos(file);
    sprintf(tf, _(".%d"), lev);

    return;
}

export function create_levelfile(lev, errbuf) { /* NHFILE * */
    let fq_lock;
    let nhfp = null;

    if (errbuf)
        chars[errbuf] = ord('\0');
    set_levelfile_name(gl.lock, lev);
    fq_lock = fqname(gl.lock, LEVELPREFIX, 0);

    nhfp = new_nhfile();
    if (nhfp) {
        nhfp.ftype = NHF_LEVELFILE;
        nhfp.mode = WRITING;
        nhfp.structlevel = TRUE; /* do set this TRUE for levelfiles */
        nhfp.fieldlevel = FALSE; /* don't set this TRUE for levelfiles */
        nhfp.addinfo = FALSE;
        nhfp.style.deflt = FALSE;
        nhfp.style.binary = TRUE;
        nhfp.fnidx = historical;
        nhfp.fd = -1;
        nhfp.fpdef = null;

        nhfp.fd = creat(fq_lock, FCMASK);

        if (nhfp.fd >= 0)
            svl.level_info[lev].flags |= LFILE_EXISTS;
        else if (errbuf) /* failure explanation */
            sprintf(errbuf, _("Cannot create file \"%s\" for level %d (errno %d)."), gl.lock, lev, (__errno_location()[0]))

;
    }
    nhfp = viable_nhfile(nhfp);
    return nhfp;
}

export function open_levelfile(lev, errbuf) { /* NHFILE * */
    let fq_lock;
    let nhfp = null;

    if (errbuf)
        chars[errbuf] = ord('\0');
    set_levelfile_name(gl.lock, lev);
    fq_lock = fqname(gl.lock, LEVELPREFIX, 0);
    nhfp = new_nhfile();
    if (nhfp) {
        nhfp.mode = READING;
        nhfp.structlevel = TRUE; /* do set this TRUE for levelfiles */
        nhfp.fieldlevel = FALSE; /* do not set this TRUE for levelfiles */
        nhfp.addinfo = FALSE;
        nhfp.style.deflt = FALSE;
        nhfp.style.binary = TRUE;
        nhfp.ftype = NHF_LEVELFILE;
        nhfp.fnidx = historical;
        nhfp.fd = -1;
        nhfp.fpdef = null;
    }
    if (nhfp && nhfp.structlevel) {
        nhfp.fd = open(fq_lock, O_RDONLY | O_BINARY, 0);

        /* for failure, return an explanation that our caller can use;
           settle for `lock' instead of `fq_lock' because the latter
           might end up being too big for nethack's BUFSZ */
        if (nhfp.fd < 0 && errbuf)
            sprintf(errbuf, _("Cannot open file \"%s\" for level %d (errno %d)."), gl.lock, lev, (__errno_location()[0]))

;
    }
    nhfp = viable_nhfile(nhfp);
    return nhfp;
}

export function delete_levelfile(lev) { /* void */
    /*
     * Level 0 might be created by port specific code that doesn't
     * call create_levfile(), so always assume that it exists.
     */
    if (lev == 0 || (svl.level_info[lev].flags & LFILE_EXISTS)) {
        set_levelfile_name(gl.lock, lev);
        unlink(fqname(gl.lock, LEVELPREFIX, 0));
        svl.level_info[lev].flags &= ~LFILE_EXISTS;
    }
}

export function clearlocks() { /* void */
    let x;

    if (program_state.preserve_locks)
        return;

    signal(SIGINT, SIG_IGN);

    sethanguphandler(SIG_IGN);

    /* can't access maxledgerno() before dungeons are created -dlc */
    for (x = (svn.n_dgns ? maxledgerno() : 0); x >= 0; x--)
        delete_levelfile(x); /* not all levels need be present */
}

/* qsort comparison routine */
function strcmp_wrap(p, q) { /* int QSORTCALLBACK */
    return strcmp(ref_to(ptr_to(char), p)[0], ref_to(ptr_to(char), q)[0]);
}

/* ----------  END LEVEL FILE HANDLING ----------- */

/* ----------  BEGIN BONES FILE HANDLING ----------- */

/* set up "file" to be file name for retrieving bones, and return a
 * bonesid to be read/written in the bones file.
 */
function set_bonesfile_name(file, lev) { /* char * */
    let sptr;
    let dptr;

    /*
     * "bonD0.nn"   = bones for level nn in the main dungeon;
     * "bonM0.T"    = bones for Minetown;
     * "bonQBar.n"  = bones for level n in the Barbarian quest;
     * "bon3D0.nn"  = \
     * "bon3M0.T"   =  > same as above, but for bones pool #3.
     * "bon3QBar.n" = /
     *
     * Return value for content validation skips "bon" and the
     * pool number (if present), making it feasible for the admin
     * to manually move a bones file from one pool to another by
     * renaming it.
     */
    strcpy(file, _("bon"));

    if (sysopt.bones_pools > 1) {
        let poolnum = min(unsigned(sysopt.bones_pools), 10);

        poolnum = unsigned(ubirthday) % poolnum; /* 0..9 */
        sprintf(eos(file), _("%u"), poolnum);
    }

    dptr = eos(file);
    /* when this naming scheme was adopted, 'filecode' was one letter;
       3.3.0 turned it into a three letter string for quest levels */
    sprintf(dptr, _("%c%s"), elt(svd.dungeons, lev.dnum).boneid, In_quest(lev) ? gu.urole.filecode : _("0"))
;
    if ((sptr = Is_special(lev)) != null)
        sprintf(eos(dptr), _(".%c"), sptr.boneid);
    else
        sprintf(eos(dptr), _(".%d"), lev.dlevel);

    return dptr;
}

/* set up temporary file name for writing bones, to avoid another game's
 * trying to read from an uncompleted bones file.  we want an uncontentious
 * name, so use one in the namespace reserved for this game's level files.
 * (we are not reading or writing level files while writing bones files, so
 * the same array may be used instead of copying.)
 */
function set_bonestemp_name() { /* char * */
    let tf;

    tf = strrchr(gl.lock, ord('.'));
    if (!tf)
        tf = eos(gl.lock);
    sprintf(tf, _(".bn"));

    return gl.lock;
}

export function create_bonesfile(lev, bonesid, errbuf) { /* NHFILE * */
    let file;
    let nhfp = null;
    let failed = 0;

    if (errbuf)
        chars[errbuf] = ord('\0');
    bonesid[0] = set_bonesfile_name(gb.bones, lev);
    file = set_bonestemp_name();
    file = fqname(file, BONESPREFIX, 0);

    nhfp = new_nhfile();
    if (nhfp) {
        nhfp.ftype = NHF_BONESFILE;
        nhfp.mode = WRITING;
        nhfp.structlevel = TRUE;
        nhfp.fieldlevel = FALSE;
        nhfp.addinfo = TRUE;
        nhfp.style.deflt = TRUE;
        nhfp.style.binary = TRUE;
        nhfp.fnidx = historical;
        nhfp.fd = -1;
        nhfp.fpdef = null;
        if (nhfp.fpdef) {
        } else {
            failed = (__errno_location()[0]);
        }
        if (nhfp.structlevel) {
/* #if defined(MICRO): not in this build */

/* implies UNIX or MACOS9 (MACOS9 is for OS9 or earlier) */

            nhfp.fd = creat(file, FCMASK);

            if (nhfp.fd < 0)
                failed = (__errno_location()[0]);
        }
        if (failed && errbuf)  /* failure explanation */
            sprintf(errbuf, _("Cannot create bones \"%s\", id %s (errno %d)."), gl.lock, bonesid[0], (__errno_location()[0]))
;
    }
    /* #if defined(VMS) && !defined(SECURE): not in this build */

    nhfp = viable_nhfile(nhfp);
    return nhfp;
}

/* move completed bones file to proper name */
export function commit_bonesfile(lev) { /* void */
    let fq_bones, tempname;
    let ret;

    set_bonesfile_name(gb.bones, lev);
    fq_bones = fqname(gb.bones, BONESPREFIX, 0);
    tempname = set_bonestemp_name();
    tempname = fqname(tempname, BONESPREFIX, 1);

    ret = rename(tempname, fq_bones);

    if (wizard() && ret != 0)
        pline(_("couldn't rename %s to %s."), tempname, fq_bones);
}

export function open_bonesfile(lev, bonesid) { /* NHFILE * */
    let fq_bones;
    let nhfp = null;

    bonesid[0] = set_bonesfile_name(gb.bones, lev);
    fq_bones = fqname(gb.bones, BONESPREFIX, 0);
    nh_uncompress(fq_bones);  /* no effect if nonexistent */

    nhfp = new_nhfile();
    if (nhfp) {
        nhfp.structlevel = TRUE;
        nhfp.fieldlevel = FALSE;
        nhfp.ftype = NHF_BONESFILE;
        nhfp.mode = READING;
        nhfp.addinfo = TRUE;
        nhfp.style.deflt = TRUE;
        nhfp.style.binary = +(sysopt.bonesformat[0] != exportascii);
        nhfp.fnidx = sysopt.bonesformat[0];
        nhfp.fd = -1;
        nhfp.fpdef = null;
        if (nhfp.fpdef) {
        }
        if (nhfp.structlevel) {
            nhfp.fd = open(fq_bones, O_RDONLY | O_BINARY, 0);
        }
    }
    nhfp = viable_nhfile(nhfp);
    return nhfp;
}

export function delete_bonesfile(lev) { /* int */
    let reslt;

    set_bonesfile_name(gb.bones, lev);
    reslt = unlink(fqname(gb.bones, BONESPREFIX, 0));
    delete_convertedfile(fqname(gb.bones, BONESPREFIX, 0));
    return +!(reslt < 0);
}

/* assume we're compressing the recently read or created bonesfile, so the
 * file name is already set properly */
export function compress_bonesfile() { /* void */
    nh_sfconvert(fqname(gb.bones, BONESPREFIX, 0));
    nh_compress(fqname(gb.bones, BONESPREFIX, 0));
}

/* ----------  END BONES FILE HANDLING ----------- */

/* ----------  BEGIN SAVE FILE HANDLING ----------- */

/* set savefile name in OS-dependent manner from pre-existing svp.plname,
 * avoiding troublesome characters */
export function set_savefile_name(regularize_it) { /* void */
    let regoffset = 0, overflow = 0,
        indicator_spot = 0; /* 0=no indicator, 1=before ext, 2=after ext */
    let postappend = 0,
               sfindicator = 0;

    /* #if defined(WIN32): not in this build */

    sprintf(gs.SAVEF, _("save/%d%s"), int(getuid()), svp.plname);
    regoffset = 5;
    indicator_spot = 2;

    /* #if defined(MICRO) && !defined(WIN32) && !defined(MSDOS): not in this build */

    if (regularize_it)
         regularize(gs.SAVEF + regoffset);
    if (indicator_spot == 1 && sfindicator && !overflow) {
        if (unsigned(strlen(gs.SAVEF) + strlen(sfindicator)) < (SAVESIZE - 1))
            strcat(gs.SAVEF, sfindicator);
        else
            overflow = 2;
    }

    /* (0) is placed in brackets below so that the [&& !overflow] is
       explicit dead code (the ">" comparison is detected as always
       FALSE at compile-time). Done to appease clang's -Wunreachable-code */
    if (strlen(_(SAVE_EXTENSION)) > (0) && !overflow) {
        if (strlen(gs.SAVEF) + strlen(_(SAVE_EXTENSION)) < (SAVESIZE - 1)) {
            strcat(gs.SAVEF, _(SAVE_EXTENSION));
        } else
            overflow = 3;
    }

    if (indicator_spot == 2 && sfindicator && !overflow) {
        if (unsigned(strlen(gs.SAVEF) + strlen(sfindicator)) < (SAVESIZE - 1))
           strcat(gs.SAVEF, sfindicator);
        else
            overflow = 4;
    }
    if (postappend && !overflow) {
        if (unsigned(strlen(gs.SAVEF) + strlen(postappend)) < (SAVESIZE - 1))
            strcat(gs.SAVEF, postappend);
        else
            overflow = 5;
    }
}

export function save_savefile_name(nhfp) { /* void */
    Sfo_char(nhfp, gs.SAVEF, _("savefile_name"), sizeof_member(gs, "SAVEF"));
}

/* change pre-existing savefile name to indicate an error savefile */
export function set_error_savefile() { /* void */
    strcat(gs.SAVEF, _(".e"));
}

/* create save file, overwriting one if it already exists */
export function create_savefile() { /* NHFILE * */
    let fq_save;
    let nhfp = null;
    let do_historical = TRUE;

    fq_save = fqname(gs.SAVEF, SAVEPREFIX, 0);
    nhfp = new_nhfile();
    if (nhfp) {
        nhfp.ftype = NHF_SAVEFILE;
        nhfp.mode = WRITING;
        if (program_state.in_self_recover || do_historical) {
            (do_historical);
            nhfp.structlevel = TRUE;
            nhfp.fieldlevel = FALSE;
            nhfp.addinfo = FALSE;
            nhfp.style.deflt = FALSE;
            nhfp.style.binary = TRUE;
            nhfp.fnidx = historical;
            nhfp.fd = -1;
            nhfp.fpdef = null;

/* UNIX || MACOS9 implied (MACOS9 is OS9 or earlier only) */

            nhfp.fd = creat(fq_save, FCMASK);
        }
    }
    /* #if defined(VMS) && !defined(SECURE): not in this build */

    nhfp = viable_nhfile(nhfp);
    return nhfp;
}

/* open savefile for reading */
export function open_savefile() { /* NHFILE * */
    let fq_save;
    let nhfp = null;
    let do_historical = TRUE;

    fq_save = fqname(gs.SAVEF, SAVEPREFIX, 0);
    nhfp = new_nhfile();
    if (nhfp) {
        nhfp.ftype = NHF_SAVEFILE;
        nhfp.mode = READING;
        if (program_state.in_self_recover || do_historical) {
            do_historical = TRUE;       /* force it */
            (do_historical);
            nhfp.structlevel = TRUE;
            nhfp.fieldlevel = FALSE;
            nhfp.addinfo = FALSE;
            nhfp.style.deflt = FALSE;
            nhfp.style.binary = TRUE;
            nhfp.fnidx = historical;
            nhfp.fd = -1;
            nhfp.fpdef = null;
        }

        nhfp.fd = open(fq_save, O_RDONLY | O_BINARY, 0);
    }
    nhfp = viable_nhfile(nhfp);
    return nhfp;
}

/* delete savefile */
export function delete_savefile() { /* int */
    let sfname = fqname(gs.SAVEF, SAVEPREFIX, 0);

    unlink(sfname);
    delete_convertedfile(sfname);
    return 0; /* for restore_saved_game() (ex-xxxmain.c) test */
}

/* try to open up a save file and prepare to restore it */
export function restore_saved_game() { /* NHFILE * */
    let fq_save;
    let nhfp = null;
    let sfstatus = 0;

    set_savefile_name(TRUE);
    fq_save = fqname(gs.SAVEF, SAVEPREFIX, 0);

    nh_uncompress(fq_save);
    if ((nhfp = open_savefile()) != null) {
        if ((sfstatus = validate(nhfp, fq_save, FALSE)) != SF_UPTODATE) {
            close_nhfile(nhfp);
            nhfp = problematic_savefile(sfstatus, fq_save);
        }
    }
    return nhfp;
}

/*
 * This doesn't open any files. It provides a valid (NHFILE *)
 * to provide to functions that take one as a parameter, with
 * only the FREEING bit set.
 *
 * close_nhfile() can, and should, be called on the returned
 * (NHFILE *), and it will handle it correctly.
 */

export function get_freeing_nhfile() { /* NHFILE * */
    let nhfp = null;

    nhfp = new_nhfile(); /* also sets fd to -1 */
    if (nhfp) {
        nhfp.mode = FREEING;
    }
    return nhfp;
}

/* called if there is no save file for current character */
export function check_panic_save() { /* int */
    let result = 0;

    let cf;
    let savef;

    set_error_savefile();
    savef = fqname(gs.SAVEF, SAVEPREFIX, 0);

    /*
     * This duplicates part of docompress_file().
     * We don't want to start by uncompressing just to check for the
     * file's existence and then have to recompress it.
     */

    let ln = unsigned(strlen(savef) + strlen(_(COMPRESS_EXTENSION)));
    let cfn = addr_of(alloc(unsigned(ln + 1)));

    strcpy(cfn, savef);
    strcat(cfn, _(COMPRESS_EXTENSION));
    if ((cf = fopen(cfn, _(RDBMODE))) != null) {
        fclose(cf);
        result = 1;
    }
    free(cfn);

    if (!result) {
        /* maybe it has already been manually uncompressed */
        if ((cf = fopen(savef, _(RDBMODE))) != null) {
            fclose(cf);
            result = 1;
        }
    }

    set_savefile_name(TRUE); /* reset to normal */

    return result;
}

export function plname_from_file(
    filename,
    without_wait_synch_per_file) { /* char * */
    let nhfp;
    let ln;
    let result = 0;
    let sfstatus = 0;

    strcpy(gs.SAVEF, filename);

    {
        /* if COMPRESS_EXTENSION is present, strip it off */
        let sln = int(strlen(gs.SAVEF)),
            xln = strlen(_(COMPRESS_EXTENSION));

        if (sln > xln && !strcmp(gs.SAVEF + (sln - xln), _(COMPRESS_EXTENSION)))
            chars[gs.SAVEF + (sln - xln)] = ord('\0');
    }

    nh_uncompress(gs.SAVEF);
    if ((nhfp = open_savefile()) != null) {
        if ((sfstatus = validate(nhfp, filename,
                                without_wait_synch_per_file)) == SF_UPTODATE) {
            /* room for "name+role+race+gend+algn X" where the space before
               X is actually NUL and X is playmode: one of '-', 'X', or 'D' */
            ln = PL_NSIZ_PLUS;
            result = memset(addr_of(alloc(ln)), ord('\0'), ln);
            get_plname_from_file(nhfp, result, FALSE);
        }
        close_nhfile(nhfp);
    }
    nh_compress(gs.SAVEF);
    return result; /* file's plname[]+playmode value */
}

export const ALLOW_WAITSYNCH_PERFILE = FALSE;

/* get list of saved games owned by current user */
export function get_saved_games() { /* char ** */
    const $frame = stack_frame(); try {
    let result = null;

    let n;

    let j = 0;

    /* #ifdef WIN32: not in this build */

    /* posixly correct version */
    let myuid = int(getuid());
    let dir;

    if ((dir = opendir(fqname(_("save"), SAVEPREFIX, 0)))) {
        for (n = 0; readdir(dir); n++)
            ;
        closedir(dir);
        if (n > 0) {
            let i;

            if (!(dir = opendir(fqname(_("save"), SAVEPREFIX, 0))))
                return null;
            result = ref_to(ptr_to(char), addr_of(alloc(unsigned(Math.imul(unsigned((n + 1)), sizeof(ptr_to(char))))))); /* at most */
            memset(addr_of(result), 0, unsigned(Math.imul(unsigned((n + 1)), sizeof(ptr_to(char)))));
            for (i = 0, j = 0; i < n; i++) {
                let uid = stack_var(int);
                let name = stack_array(char, 64); /* more than PL_NSIZ+1 */
                let entry = readdir(dir);

                if (!entry)
                    break;
                if (sscanf(entry.d_name, _("%d%63s"), uid, name) == 2) {
                    if (uid[0] == myuid) {
                        let filename = stack_array(char, BUFSZ);
                        let r;

                        sprintf(filename, _("save/%d%s"), uid[0], name);
                        r = plname_from_file(filename,
                                             ALLOW_WAITSYNCH_PERFILE);
                        if (r)
                            result[j++] = r;
                    }
                }
            }
            closedir(dir);
        }
    }

    if (j > 0) {
        if (j > 1)
            nh_deterministic_qsort(addr_of((result)), unsigned((j)), (sizeof(ptr_to(char))), (strcmp_wrap));
        result[j] = (0);
    } else if (result) { /* could happen if save files are obsolete */
        free_saved_games(result);
        result = null;
    }

    return result;
    } finally { stack_pop($frame); }
}

export function free_saved_games(saved) { /* void */
    if (saved) {
        let i;

        for (i = 0; saved[i]; ++i)
            free((saved[i]));
        free(addr_of(saved));
    }
}

/* ----------  END SAVE FILE HANDLING ----------- */

/* ----------  BEGIN FILE COMPRESSION HANDLING ----------- */

/* #ifdef COMPRESS: not in this build */

/* compress file */
export function nh_compress(filename) { /* void */
}

/* uncompress file if it exists */
export function nh_uncompress(filename) { /* void */
}

/* #ifdef ZLIB_COMP: not in this build */

/* ----------  END FILE COMPRESSION HANDLING ----------- */

/* ----------  BEGIN PROBLEMATIC SAVEFILE HANDLING ----------- */

 const struct_sfstatus_to_msg = struct("struct_sfstatus_to_msg", {
    sfstatus: int,
    msg: ptr_to(char),
}); const sf2msg = static_array("sf2msg", struct_sfstatus_to_msg, null, [
    { sfstatus: SF_UPTODATE, msg: _("everything matches") },
    { sfstatus: SF_OUTDATED, msg: _("outdated savefile") },
    { sfstatus: SF_CRITICAL_BYTE_COUNT_MISMATCH,
        msg: _("savefile critical byte-count mismatch") },
    { sfstatus: SF_DM_IL32LLP64_ON_ILP32LL64, msg: _("Windows x64 savefile on x86") },
    { sfstatus: SF_DM_I32LP64_ON_ILP32LL64, msg: _("Unix 64 savefile on x86") },
    { sfstatus: SF_DM_ILP32LL64_ON_I32LP64, msg: _("x86 savefile on Unix 64") },
    { sfstatus: SF_DM_ILP32LL64_ON_IL32LLP64, msg: _("x86 savefile on Windows x64") },
    { sfstatus: SF_DM_I32LP64_ON_IL32LLP64, msg: _("Unix 64 savefile on Windows x64") },
    { sfstatus: SF_DM_IL32LLP64_ON_I32LP64, msg: _("Windows x64 savefile on Unix 64") },
    { sfstatus: SF_DM_MISMATCH, msg: _("generic savefile mismatch") },
]);

function problematic_savefile(sfstatus, savefilenm) { /* NHFILE * */
    let i;
    let nhfp = null;

    switch (sfstatus) {
    case SF_UPTODATE:
        break;
    case SF_DM_IL32LLP64_ON_ILP32LL64:
    case SF_DM_I32LP64_ON_ILP32LL64:
    case SF_DM_ILP32LL64_ON_I32LP64:
    case SF_DM_ILP32LL64_ON_IL32LLP64:
    case SF_DM_I32LP64_ON_IL32LLP64:
    case SF_DM_IL32LLP64_ON_I32LP64:
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case SF_DM_MISMATCH:
    case SF_OUTDATED:
    case SF_CRITICAL_BYTE_COUNT_MISMATCH:
    default:
        for (i = 0; i < SIZE(sf2msg); ++i) {
            if (sf2msg[i].sfstatus == sfstatus) {
                raw_printf(_("\n%s is %s %s\n"),
                           savefilenm,
                           (sfstatus == SF_OUTDATED) ? _("an") : _("a"),
                           sf2msg[i].msg);
                break;
            }
        }
    }
    return nhfp;
}

/* ----------  END PROBLEMATIC SAVEFILE HANDLING ----------- */

/* ----------  BEGIN EXTERNAL CONVERSION HANDLING ----------- */

const cvtinit = static_var("cvtinit", schar, FALSE);

const unconverted_filename = static_var("unconverted_filename", ptr_to(char), 0); const converted_filename = static_var("converted_filename", ptr_to(char), 0);

/*
 * Returns non-zero if unconvert was successful
 */
function doconvert_file(filename, sfstatus, unconvert) { /* int */
    (filename);
    (sfstatus);
    (unconvert);
    return 1;
}

/* convert file */
export function nh_sfconvert(filename) { /* void */
    doconvert_file(filename, 0, FALSE);
}

/* unconvert file if it exists */
export function nh_sfunconvert(filename) { /* void */
    doconvert_file(filename, 0, TRUE);
}

function make_converted_name(filename) { /* boolean */
    let ln;
    let xtra, finaldirchar;
    let dir = 0;
    let needsep = FALSE;

    if (!filename)
        return FALSE;

    if (unconverted_filename[0])
        free((unconverted_filename[0])), unconverted_filename[0] = 0;
    if (converted_filename[0])
        free((converted_filename[0])), converted_filename[0] = 0;

    /* do we need to do some ms-dos processing here? */

    ln = strlen(filename);
    if (!contains_directory(filename)) {
        dir = nh_getenv(_("NETHACKDIR"));
        if (!dir)
            dir = nh_getenv(_("HACKDIR"));

        if (!dir)
            dir = _(HACKDIR);

        if (dir) {
            finaldirchar = c_eos(dir);
                finaldirchar--;
            if (!(chars[finaldirchar] == ord('/') || chars[finaldirchar] == ord('\\')
                  || chars[finaldirchar] == ord(':'))) {
                needsep = TRUE;
                ln = unsigned(ln + 1);
            }
            ln = unsigned(ln + strlen(dir));
        }
    }
    unconverted_filename[0] = addr_of(alloc(unsigned(ln + 1)));
    Snprintf(unconverted_filename[0], unsigned(ln + 1), _("%s%s%s"), dir ? dir : _(""), (dir && needsep) ? _("/") : _(""), filename)

;
    xtra = _(".exportascii");
    ln = unsigned(ln + strlen(xtra));
    converted_filename[0] = addr_of(alloc(unsigned(ln + 1)));
    strcpy(converted_filename[0], unconverted_filename[0]);
    strcat(converted_filename[0], xtra);
    return TRUE;
}

/* delete converted savefile as a normal course of action */
export function delete_convertedfile(basefilename) { /* int */
    if (!converted_filename[0])
        make_converted_name(basefilename);
    if (converted_filename[0]) {
        unlink(converted_filename[0]);
    }
    return 0;
}

export function free_convert_filenames() { /* void */
    if (converted_filename[0])
        free((converted_filename[0])), converted_filename[0] = 0;
    if (unconverted_filename[0])
        free((unconverted_filename[0])), unconverted_filename[0] = 0;
    cvtinit[0] = FALSE;
}

/* return TRUE if s contains a directory, not just a filespec */
export function contains_directory(s) { /* boolean */
    let i, slen = int(strlen(s));
    let cp = s;

    for (i = 0; i < slen; ++i) {
        if (chars[cp] == ord('\\') || chars[cp] == ord('/') || chars[cp] == ord(':'))
            return TRUE;
        cp++;
    }
    return FALSE;
}

/* =========================================================================*/

/* ----------  END EXTERNAL CONVERSION HANDLING ----------- */

/* ----------  BEGIN FILE LOCKING HANDLING ----------- */

const lockfd = static_var("lockfd", int, -1); /* for lock_file() to pass to unlock_file() */

const sflock = static_struct("sflock", struct_flock); /* for unlocking, same as above */

/* #ifndef USE_FCNTL: not in this build */

/* lock a file */
export function lock_file(filename, whichprefix,
          retryct) { /* boolean */
    gn.nesting++;
    if (gn.nesting > 1) {
        impossible(_("TRIED TO NEST LOCKS"));
        return TRUE;
    }

    filename = fqname(filename, whichprefix, 0);

    lockfd[0] = open(filename, O_RDWR);
    if (lockfd[0] == -1) {
        if (!program_state.done_hup) raw_printf(_("Cannot open file %s. " +
                       " Is NetHack installed correctly?"),
                       filename);;
        gn.nesting--;
        return FALSE;
    }
    sflock.l_type = F_WRLCK;
    sflock.l_whence = SEEK_SET;
    sflock.l_start = 0;
    sflock.l_len = 0;

    while (fcntl(lockfd[0], F_SETLK, sflock) == -1) {
        if (retryct--) {
            if (!program_state.done_hup) raw_printf(_("Waiting for release of fcntl lock on %s. " +
                           " (%d retries left.)"),
                           filename, retryct);;
            sleep(1);
        } else {
            if (!program_state.done_hup) raw_print()(_("I give up.  Sorry."));;
            if (!program_state.done_hup) raw_printf(_("Some other process has an unnatural grip on %s."),
                           filename);;
            gn.nesting--;
            return FALSE;
        }
    /* #else (#ifdef USE_FCNTL): not in this build */
    }

    /* #if (defined(AMIGA) || defined(WIN32) || defined(MSDOS)) \: not in this build */

    return TRUE;
}

/* unlock file, which must be currently locked by lock_file */
export function unlock_file(filename) { /* void */
    if (gn.nesting == 1) {
        sflock.l_type = F_UNLCK;
        if (lockfd[0] >= 0) {
            if (fcntl(lockfd[0], F_SETLK, sflock) == -1)
                if (!program_state.done_hup) raw_printf(_("Can't remove fcntl lock on %s."), filename);;
            close(lockfd[0]), lockfd[0] = -1;
        }
    /* #else (#ifdef USE_FCNTL): not in this build */
    }

    gn.nesting--;
}

/* ----------  END FILE LOCKING HANDLING ----------- */

/* ----------  BEGIN WIZKIT FILE HANDLING ----------- */

function fopen_wizkit_file() { /* FILE * */
    const $frame = stack_frame(); try {
    let fp;

    let tmp_wizkit = stack_array(char, BUFSZ);

    let envp;

    envp = nh_getenv(_("WIZKIT"));
    if (envp && chars[envp])
        strncpy(gw.wizkit, envp, WIZKIT_MAX - 1);
    if (!chars[gw.wizkit + 0])
        return null;

    if (access(gw.wizkit, 4) == -1) {
        /* 4 is R_OK on newer systems */
        /* nasty sneaky attempt to read file through
         * NetHack's setuid permissions -- this is a
         * place a file name may be wholly under the player's
         * control
         */
        raw_printf(_("Access to %s denied (%d)."), gw.wizkit, (__errno_location()[0]));
        wait_synch()();
        /* fall through to standard names */
    } else

        if ((fp = fopen(gw.wizkit, _("r"))) != null) {
        return fp;
    } else {
        /* access() above probably caught most problems for UNIX */
        raw_printf(_("Couldn't open requested wizkit file %s (%d)."), gw.wizkit,
                   (__errno_location()[0]));
        wait_synch()();
    }

    envp = nh_getenv(_("HOME"));
    if (envp)
        sprintf(tmp_wizkit, _("%s/%s"), envp, gw.wizkit);
    else
        strcpy(tmp_wizkit, gw.wizkit);
    if ((fp = fopen(tmp_wizkit, _("r"))) != null)
        return fp;
    else if ((__errno_location()[0]) != ENOENT) {
        /* e.g., problems when setuid NetHack can't search home
         * directory restricted to user */
        raw_printf(_("Couldn't open default gw.wizkit file %s (%d)."),
                   tmp_wizkit, (__errno_location()[0]));
        wait_synch()();
    }

    return null;
    } finally { stack_pop($frame); }
}

/* add to hero's inventory if there's room, otherwise put item on floor */
function wizkit_addinv(obj) { /* void */
    if (!obj || obj == hands_obj)
        return;

    /* subset of starting inventory pre-ID */
    observe_object(obj);
    if (Role_if(PM_CLERIC))
        obj.bknown = 1; /* ok to bypass set_bknown() */
    /* same criteria as lift_object()'s check for available inventory slot */
    if (obj.oclass != COIN_CLASS && inv_cnt(FALSE) >= invlet_basic
        && !merge_choice(gi.invent, obj)) {
        /* inventory overflow; can't just place & stack object since
           hero isn't in position yet, so schedule for arrival later */
        add_to_migration(obj);
        obj.ox = 0; /* index of main dungeon */
        obj.oy = 1; /* starting level number */
        obj.owornmask =
            (MIGR_WITH_HERO | MIGR_NOBREAK | MIGR_NOSCATTER);
    } else {
        addinv(obj);
    }
}

export function proc_wizkit_line(buf) { /* boolean */
    let otmp;

    if (strlen(buf) >= BUFSZ)
        chars[buf + (BUFSZ - 1)] = ord('\0');
    otmp = readobjnam(buf, null);

    if (otmp) {
        if (otmp != hands_obj) {
            wish_history_add(buf);
            wizkit_addinv(otmp);
        }
    } else {
        /* .60 limits output line width to 79 chars */
        config_error_add(_("Bad wizkit item: \"%.60s\""), buf);
        return FALSE;
    }
    return TRUE;
}

export function read_wizkit() { /* void */
    let fp;

    if (!wizard() || !(fp = fopen_wizkit_file()))
        return;

    program_state.wizkit_wishing = 1;
    config_error_init(TRUE, _("WIZKIT"), FALSE);

    parse_conf_file(fp, proc_wizkit_line);
    fclose(fp);

    config_error_done();
    program_state.wizkit_wishing = 0;

    return;
}

/* ----------  END WIZKIT FILE HANDLING ----------- */

/* ----------  BEGIN SYMSET FILE HANDLING ----------- */

     /* symbols.c */
 /* symbols.c */

function fopen_sym_file() { /* FILE * */
    let fp;

    fp = fopen_datafile(_(SYMBOLS), _("r"),

                            HACKPREFIX

                       );

    return fp;
}

/*
 * Returns 1 if the chosen symset was found and loaded.
 *         0 if it wasn't found in the sym file or other problem.
 */
export function read_sym_file(which_set) { /* int */
    let fp;

    gs.symset[which_set].explicitly = FALSE;
    if (!(fp = fopen_sym_file()))
        return 0;

    gs.symset[which_set].explicitly = TRUE;
    gc.chosen_symset_start = gc.chosen_symset_end = FALSE;
    gs.symset_which_set = which_set;
    gs.symset_count = 0;

    config_error_init(TRUE, _("symbols"), FALSE);

    parse_conf_file(fp, proc_symset_line);
    fclose(fp);

    if (!gc.chosen_symset_start && !gc.chosen_symset_end) {
        /* name caller put in symset[which_set].name was not found;
           if it looks like "Default symbols", null it out and return
           success to use the default; otherwise, return failure */
        if (gs.symset[which_set].name
            && (fuzzymatch(gs.symset[which_set].name, _("Default symbols"),
                           _(" -_"), TRUE)
                || !strncmpi((gs.symset[which_set].name), _(("default")), -1)))
            clear_symsetentry(which_set, TRUE);
        config_error_done();

        /* If name was defined, it was invalid. Then we're loading fallback */
        if (gs.symset[which_set].name) {
            gs.symset[which_set].explicitly = FALSE;
            return 0;
        }

        return 1;
    }
    if (!gc.chosen_symset_end)
        config_error_add(_("Missing finish for symset \"%s\""),
                         gs.symset[which_set].name ? gs.symset[which_set].name
                                                : _("unknown"));
    config_error_done();
    return 1;
}

/* ----------  END SYMSET FILE HANDLING ----------- */

/* ----------  BEGIN SCOREBOARD CREATION ----------- */

/* verify that we can write to scoreboard file; if not, try to create one */
/*ARGUSED*/
export function check_recordfile(dir) { /* void */
    let fq_record;
    let fd;

    fq_record = fqname(_(RECORD), SCOREPREFIX, 0);
    fd = open(fq_record, O_RDWR, 0);
    if (fd >= 0) {
        nhclose(fd); /* RECORD is accessible */
    } else if ((fd = open(fq_record, O_CREAT | O_RDWR, FCMASK)) >= 0) {
        nhclose(fd); /* RECORD newly created */
    } else {
        raw_printf(_("Warning: cannot write scoreboard file '%s'"), fq_record);
        wait_synch()();
    }

/* #if defined(MICRO) || defined(WIN32): not in this build */
}

/* ----------  END SCOREBOARD CREATION ----------- */

/* ----------  BEGIN PANIC/IMPOSSIBLE/TESTING LOG ----------- */

/*ARGSUSED*/
export function paniclog(
    type,
    reason) { /* void */ /* explanation */
    const $frame = stack_frame(); try {
    let lfile;

    if (!program_state.in_paniclog) {
        program_state.in_paniclog = 1;
        lfile = fopen_datafile(_(PANICLOG), _("a"), TROUBLEPREFIX);
        if (lfile) {
            let buf = stack_array(char, BUFSZ);
            let now = getnow();
            let uid = int(getuid());
            let playmode = wizard() ? ord('D') : discover() ? ord('X') : ord('-');

            fprintf(lfile, _("%s %08lld %06lld %d %c: %s %s\n"),
                           version_string(buf, sizeof(array_of(char, BUFSZ))),
                           yyyymmdd(now), hhmmss(now),
                           uid, playmode, type, reason);

            fclose(lfile);
        }
        program_state.in_paniclog = 0;
    }

    return;
    } finally { stack_pop($frame); }
}

export function testinglog(filenm,
           type,
           reason) { /* void */ /* explanation */
    const $frame = stack_frame(); try {
    let lfile;
    let fnbuf = stack_array(char, BUFSZ);

    if (!filenm)
        return;
    strcpy(fnbuf, filenm);
    if (strchr(fnbuf, ord('.')) == 0)
        strcat(fnbuf, _(".log"));
    lfile = fopen_datafile(fnbuf, _("a"), TROUBLEPREFIX);
    if (lfile) {
        fprintf(lfile, _("%s\n%s\n"), type, reason);
        fclose(lfile);
    }
    return;
    } finally { stack_pop($frame); }
}

/* ----------  END PANIC/IMPOSSIBLE/TESTING LOG ----------- */

/* #ifdef SELF_RECOVER: not in this build */

/* ----------  OTHER ----------- */

 export function do_deferred_showpaths(code) { /* void */
    gd.deferred_showpaths = FALSE;
    reveal_paths(code);

    /* cleanup before heading to an exit */
    freedynamicdata();
    ;
    l_nhcore_done();

    after_opt_showpaths(gd.deferred_showpaths_dir);
/* #else (#ifdef UNIX): not in this build */
}

/* used by debugpline() to decide whether to issue a message
 * from a particular source file; caller passes __FILE__ and we check
 * whether it is in the source file list supplied by SYSCF's DEBUGFILES
 *
 * pass FALSE to override wildcard matching; useful for files
 * like dungeon.c and questpgr.c, which generate a ridiculous amount of
 * output if DEBUG is defined and effectively block the use of a wildcard */
export function debugcore(filename, wildcards) { /* boolean */
    let debugfiles, p;

    /* debugpline() messages might disclose information that the player
       doesn't normally get to see, so only display them in wizard mode */
    if (!wizard())
        return FALSE;

    if (!filename || !chars[filename])
        return FALSE; /* sanity precaution */

    debugfiles = sysopt.debugfiles;
    /* usual case: sysopt.debugfiles will be empty */
    if (!debugfiles || !chars[debugfiles])
        return FALSE;

    /* strip filename's path if present */
    filename = nh_basename(filename, TRUE);

    /*
     * Wildcard match will only work if there's a single pattern (which
     * might be a single file name without any wildcarding) rather than
     * a space-separated list.
     * [to NOT do: We could step through the space-separated list and
     * attempt a wildcard match against each element, but that would be
     * overkill for the intended usage.]
     */
    if (wildcards && pmatch(debugfiles, filename))
        return TRUE;

    /* check whether filename is an element of the list */
    if ((p = strstr(debugfiles, filename)) != 0) {
        let l = int(strlen(filename));

        if ((p == debugfiles || chars[p + (-1)] == ord(' ') || chars[p + (-1)] == ord('/'))
            && (chars[p + l] == ord(' ') || chars[p + l] == ord('\0')))
            return TRUE;
    }
    return FALSE;
}

export const SYSCONFFILE = "system configuration file";

export function reveal_paths(code) { /* void */
    const $frame = stack_frame(); try {
    let skip_sysopt = FALSE;

    let fqn, nodumpreason;

    let buf = stack_array(char, BUFSZ);

    let filep;

    let gamename = (gh.hname && chars[gh.hname]) ? gh.hname : _("NetHack");

    let endp, envp, cwdbuf = stack_array(char, PATH_MAX);

    /* sysconf file */

    chars[buf + 0] = ord('\0');

    raw_printf(_("%s %s%s:"), s_suffix(gamename),
               _(SYSCONFFILE), buf);

    filep = _(SYSCF_FILE);

    fqn = fqname(filep, SYSCONFPREFIX, 0);
    if (fqn) {
        set_configfile_name(fqn);
        filep = get_configfile();
    }
    raw_printf(_("    \"%s\""), filep);
    if (code == 1) {
        raw_printf(_("NOTE: The %s above is missing or inaccessible!"),
                   _(SYSCONFFILE));
        skip_sysopt = TRUE;
    }

    /* symbols file */

    chars[buf + 0] = ord('\0');
    /* #ifndef UNIX: not in this build */

    envp = getcwd(cwdbuf, PATH_MAX);
    if (envp) {
        raw_print()(_("The loadable symbols file:"));
        raw_printf(_("    \"%s/%s\""), envp, _(SYMBOLS));
    }
    /* #else (#ifdef UNIX): not in this build */

    /* dlb vs non-dlb */

    chars[buf + 0] = ord('\0');

    /* #ifdef DLB: not in this build */

    raw_printf(_("Basic data files%s are in many separate files."), buf);

    /* dumplog */

    fqn = 0;

    nodumpreason = _("not supported");
    /* #else (#ifndef DUMPLOG): not in this build */

    /* #ifdef WIN32: not in this build */

    /* personal configuration file */

    chars[buf + 0] = ord('\0');

    raw_printf(_("Your personal configuration file%s:"), buf);

    chars[buf + 0] = ord('\0');
    if ((envp = nh_getenv(_("HOME"))) != 0) {
        copynchars(buf, envp, sizeof(array_of(char, BUFSZ)) - 1 - 1);
        strcat(buf, _("/"));
    }
    endp = eos(buf);
    copynchars(endp, get_default_configfile(),
               int(unsigned(sizeof(array_of(char, BUFSZ)) - 1 - strlen(buf))));
    /* #if defined(__APPLE__): not in this build */

    raw_printf(_("    \"%s\""), buf);

    raw_print()(_(""));

    (skip_sysopt);

    (nodumpreason);
    } finally { stack_pop($frame); }
}

/* ----------  BEGIN TRIBUTE ----------- */

/* 3.6 tribute code
 */

export const SECTIONSCOPE = 1;
export const TITLESCOPE = 2;
export const PASSAGESCOPE = 3;

export const MAXPASSAGES = (Math.trunc((sizeof_member(svc.context.novel, "pasg") / sizeof(schar))));

/* choose a random passage that hasn't been chosen yet; once all have
   been chosen, reset the tracking to make all passages available again */
function choose_passage(passagecnt,
               oid) { /* int */ /* book.o_id, used to determine whether re-reading same book */
    let idx, res;

    if (passagecnt < 1)
        return 0;

    /* if a different book or we've used up all the passages already,
       reset in order to have all 'passagecnt' passages available */
    if (oid != svc.context.novel.id || svc.context.novel.count == 0) {
        let i, range = passagecnt, limit = MAXPASSAGES;

        svc.context.novel.id = oid;
        if (range <= limit) {
            /* collect all of the N indices */
            svc.context.novel.count = passagecnt;
            for (idx = 0; idx < MAXPASSAGES; idx++)
                chars[svc.context.novel.pasg + idx] = xint16(((idx < passagecnt)
                                                   ? idx + 1 : 0));
        } else {
            /* collect MAXPASSAGES of the N indices */
            svc.context.novel.count = MAXPASSAGES;
            for (idx = i = 0; i < passagecnt; ++i, --range)
                if (range > 0 && rn2(range) < limit) {
                    chars[svc.context.novel.pasg + (idx++)] = xint16((i + 1));
                    --limit;
                }
        }
    }

    idx = rn2(svc.context.novel.count);
    res = (chars[svc.context.novel.pasg + idx]);
    /* move the last slot's passage index into the slot just used
       and reduce the number of passages available */
    chars[svc.context.novel.pasg + idx]
                          = chars[svc.context.novel.pasg + (--svc.context.novel.count)];
    return res;
}

/* Returns True if you were able to read something. */
export function read_tribute(tribsection, tribtitle,
             tribpassage, nowin_buf, bufsz,
             oid) { /* boolean */ /* book identifier */
    const $frame = stack_frame(); try {
    var fp;
    var line = stack_array(char, BUFSZ), lastline = stack_array(char, BUFSZ);

    var scope = 0;
    var linect = 0, passagecnt = 0, targetpassage = 0;
    var badtranslation = _("an incomprehensible foreign translation");
    var matchedsection = FALSE, matchedtitle = FALSE;
    var tribwin = WIN_ERR;
    var grasped = FALSE;
    var foundpassage = FALSE;

    if (nowin_buf)
        chars[nowin_buf] = ord('\0');

    /* check for mandatories */
    if (!tribsection || !tribtitle) {
        if (!nowin_buf)
            pline(_("It's %s of \"%s\"!"), badtranslation, tribtitle);
        return grasped;
    }

    debugpline3(_("read_tribute %s, %s, %d."), tribsection, tribtitle,
                tribpassage, __FILE__);

    fp = dlb_fopen(_(TRIBUTEFILE), _("r"));
    if (!fp) {
        /* this is actually an error - cannot open tribute file! */
        if (!nowin_buf)
            You_feel(_("too overwhelmed to continue!"));
        return grasped;
    }

    /*
     * Syntax (not case-sensitive):
     *  %section books
     *
     * In the books section:
     *    %title booktitle (n)
     *          where booktitle=book title without quotes
     *          (n)= total number of passages present for this title
     *    %passage k
     *          where k=sequential passage number
     *
     * %e ends the passage/book/section
     *    If in a passage, it marks the end of that passage.
     *    If in a book, it marks the end of that book.
     *    If in a section, it marks the end of that section.
     *
     *  %section death
     */

    chars[line] = chars[lastline] = ord('\0');
    cleanup: { while (dlb_fgets(line, sizeof(array_of(char, BUFSZ)), fp) != 0) {
        linect++;
        strip_newline(line);
        switch (chars[line + 0]) {
        case ord('%'):
            if (!strncmpi(line + 1, _("section "), sizeof_string("section ") - 1)) {
                var st = line + 9; /* 9 from "%section " */

                scope = SECTIONSCOPE;
                matchedsection = !strcmpi(st, tribsection) ? TRUE : FALSE;
            } else if (!strncmpi(line + 1, _("title "), sizeof_string("title ") - 1)) {
                var st = line + 7; /* 7 from "%title " */
                var p1, p2;

                if ((p1 = strchr(st, ord('('))) != 0) {
                    chars[p1++] = ord('\0');
                    mungspaces(st);
                    if ((p2 = strchr(p1, ord(')'))) != 0) {
                        chars[p2] = ord('\0');
                        passagecnt = atoi(p1);
                        scope = TITLESCOPE;
                        if (matchedsection && !strcmpi(st, tribtitle)) {
                            matchedtitle = TRUE;
                            targetpassage = !tribpassage
                                             ? choose_passage(passagecnt, oid)
                                             : (tribpassage <= passagecnt)
                                                ? tribpassage : 0;
                        } else {
                            matchedtitle = FALSE;
                        }
                    }
                }
            } else if (!strncmpi(line + 1, _("passage "),
                                 sizeof_string("passage ") - 1)) {
                var passagenum = 0;
                var st = line + 9; /* 9 from "%passage " */

                mungspaces(st);
                passagenum = atoi(st);
                if (passagenum > 0 && passagenum <= passagecnt) {
                    scope = PASSAGESCOPE;
                    if (matchedtitle && passagenum == targetpassage) {
                        foundpassage = TRUE;
                        if (!nowin_buf) {
                            tribwin = create_nhwindow()(NHW_MENU);
                            if (tribwin == WIN_ERR)
                                break cleanup;;
                        }
                    }
                }
            } else if (!strncmpi(line + 1, _("e "), sizeof_string("e ") - 1)) {
                if (foundpassage)
                    break cleanup;;
                if (scope == TITLESCOPE)
                    matchedtitle = FALSE;
                if (scope == SECTIONSCOPE)
                    matchedsection = FALSE;
                if (scope)
                    --scope;
            } else {
                debugpline1(_("tribute file error: bad %% command, line %d."),
                            linect, __FILE__);
            }
            break;
        case ord('#'):
            /* comment only, next! */
            break;
        default:
            if (foundpassage) {
                if (!nowin_buf) {
                    /* outputting multi-line passage to text window */
                    putstr()(tribwin, 0, line);
                    if (chars[line])
                        strcpy(lastline, line);
                } else {
                    /* fetching one-line passage into buffer */
                    copynchars(nowin_buf, line, bufsz - 1);
                    break cleanup; /* don't wait for "%e passage" */
                }
            }
        }
    }
 }
    dlb_fclose(fp);
    if (nowin_buf) {
        /* one-line buffer */
        grasped = chars[nowin_buf] ? TRUE : FALSE;
    } else {
        if (tribwin != WIN_ERR) { /* implies 'foundpassage' */
            /* multi-line window, normal case;
               if lastline is empty, there were no non-empty lines between
               "%passage n" and "%e passage" so we leave 'grasped' False */
            if (chars[lastline]) {
                var p;

                display_nhwindow()(tribwin, FALSE);
                /* put the final attribution line into message history,
                   analogous to the summary line from long quest messages */
                if (strchr(lastline, ord('[')))
                    mungspaces(lastline); /* to remove leading spaces */
                else /* construct one if necessary */
                    sprintf(lastline, _("[%s, by Terry Pratchett]"), tribtitle);
                if ((p = strrchr(lastline, ord(']'))) != 0)
                    sprintf(p, _("; passage #%d]"), targetpassage);
                putmsghistory()(lastline, FALSE);
                grasped = TRUE;
            }
            destroy_nhwindow()(tribwin);
        }
        if (!grasped)
            /* multi-line window, problem */
            pline(_("It seems to be %s of \"%s\"!"), badtranslation, tribtitle);
    }
    return grasped;
    } finally { stack_pop($frame); }
}

export function Death_quote(buf, bufsz) { /* boolean */
    let death_oid = 1; /* chance of oid #1 being a novel is negligible */

    return read_tribute(_("Death"), _("Death Quotes"), 0, buf, bufsz, death_oid);
}

/* ----------  END TRIBUTE ----------- */

/* Locks the live log file and writes 'buffer'
 * iff the ll_type matches sysopt.livelog mask.
 * lltype is included in LL entry for post-process filtering also.
 */
export function livelog_add(ll_type, str) { /* void */
    let livelogfile;
    let now;
    let gindx, aindx;

    if (!(ll_type & sysopt.livelog))
        return;

    if (lock_file(_(LIVELOGFILE), SCOREPREFIX, 10)) {
        if (!(livelogfile = fopen_datafile(_(LIVELOGFILE), _("a"), SCOREPREFIX))) {
            pline(_("Cannot open live log file!"));
            unlock_file(_(LIVELOGFILE));
            return;
        }

        now = getnow();
        gindx = flags.female ? 1 : 0;
        /* note on alignment designation:
               aligns[] uses [0] lawful, [1] neutral, [2] chaotic;
               u.ualign.type uses -1 chaotic, 0 neutral, 1 lawful;
           so subtracting from 1 converts from either to the other */
        aindx = 1 - u.ualign.type;
        /* format relies on STD C's implicit concatenation of
           adjacent string literals */
        fprintf(livelogfile,
                       _("lltype=%lld\tname=%s\trole=%s\trace=%s\tgender=%s\talign=%s\tturns=%lld\tstarttime=%lld\tcurtime=%lld\tmessage=%s\n"),
                       and64(ll_type, sysopt.livelog), svp.plname,
                       gu.urole.filecode, gu.urace.filecode,
                       genders[gindx].filecode, aligns[aindx].filecode,
                       svm.moves, timet_to_seconds(ubirthday),
                       timet_to_seconds(now), str)

;
        fclose(livelogfile);
        unlock_file(_(LIVELOGFILE));
    }
}

/*files.c*/

import { COMPRESS_EXTENSION, HACKDIR, LIVELOGFILE, PANICLOG, SYSCF_FILE } from "./config.h.js";
import { COIN_CLASS } from "./defsym.h.js";
import { RDBMODE } from "./dlb.h.js";
import { dlb_fclose, dlb_fgets, dlb_fopen } from "./dlb.h.macros.js";
import { LFILE_EXISTS, MIGR_NOBREAK, MIGR_NOSCATTER, MIGR_WITH_HERO } from "./dungeon.h.js";
import { discover, wizard } from "./flag.h.macros.js";
import { SAVESIZE, SAVE_EXTENSION } from "./fnamesiz.h.js";
import {
    BUFSZ, FALSE, PL_NSIZ_PLUS, RECORD, SYMBOLS, TRIBUTEFILE, TRUE, xint16,
} from "./global.h.js";
import { strcmpi } from "./global.h.macros.js";
import {
    BONESPREFIX, COUNTING, FREEING, HACKPREFIX, LEVELPREFIX, NHF_BONESFILE, NHF_LEVELFILE,
    NHF_SAVEFILE, READING, SAVEPREFIX, SCOREPREFIX, SF_CRITICAL_BYTE_COUNT_MISMATCH,
    SF_DM_I32LP64_ON_IL32LLP64, SF_DM_I32LP64_ON_ILP32LL64, SF_DM_IL32LLP64_ON_I32LP64,
    SF_DM_IL32LLP64_ON_ILP32LL64, SF_DM_ILP32LL64_ON_I32LP64, SF_DM_ILP32LL64_ON_IL32LLP64,
    SF_DM_MISMATCH, SF_OUTDATED, SF_UPTODATE, SYSCONFPREFIX, TROUBLEPREFIX, WIZKIT_MAX, WRITING,
    exportascii, historical, invlet_basic, struct_nh_file,
} from "./hack.h.js";
import { min } from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { debugpline1, debugpline3 } from "./lint.h.macros.js";
import { PM_CLERIC } from "./monsters.h.js";
import { Sfo_char } from "./savefile.h.macros.js";
import { FCMASK } from "./unixconf.h.js";
import {
    create_nhwindow, destroy_nhwindow, display_nhwindow, putmsghistory, putstr, raw_print,
    wait_synch,
} from "./winprocs.h.macros.js";
import { NHW_MENU, WIN_ERR } from "./wintype.h.js";
import { Role_if } from "./you.h.macros.js";
import { struct_flock } from "../libc/records.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, schar, sizeof, sizeof_string, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64 } from "../rt/int64.js";
import {
    ENOENT, F_SETLK, F_UNLCK, F_WRLCK, O_CREAT, O_RDONLY, O_RDWR, PATH_MAX, SEEK_SET, SIGINT,
    SIG_IGN, __errno_location, access, atoi, close, closedir, creat, fclose, fcntl, fopen, fprintf,
    free, getcwd, getuid, lseek, memset, open, opendir, readdir, rename, rewind, signal, sleep,
    sprintf, sscanf, strcat, strchr, strcmp, strcpy, strlen, strncpy, strrchr, strstr, unlink,
} from "../rt/libc.js";
import {
    init_string, stack_array, stack_var, static_array, static_struct, static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, elt, ptr_to, ref_to, sizeof_member, struct, view_of,
} from "../rt/struct.js";
import { timet_to_seconds } from "./allmain.js";
import { alloc } from "./alloc.js";
import { getnow, hhmmss, yyyymmdd } from "./calendar.js";
import {
    config_error_add, config_error_done, config_error_init, get_configfile, get_default_configfile,
    parse_conf_file, set_configfile_name,
} from "./cfgfiles.js";
import {
    flags, gb, gc, gd, gh, gi, gl, gn, gs, gu, gw, hands_obj, program_state, svc, svd, svl, svm,
    svn, svp, u,
} from "./decl.js";
import { In_quest, Is_special, maxledgerno } from "./dungeon.js";
import { after_opt_showpaths } from "./earlyarg.js";
import { inv_cnt } from "./hack.js";
import {
    c_eos, copynchars, eos, fuzzymatch, mungspaces, nh_deterministic_qsort, s_suffix, strip_newline,
    strncmpi,
} from "./hacklib.js";
import { addinv, merge_choice } from "./invent.js";
import { add_to_migration } from "./mkobj.js";
import { l_nhcore_done } from "./nhlua.js";
import { observe_object } from "./o_init.js";
import { readobjnam } from "./objnam.js";
import { nh_getenv } from "./options.js";
import { You_feel, impossible, pline, raw_printf } from "./pline.js";
import { get_plname_from_file } from "./restore.js";
import { rn2 } from "./rnd.js";
import { aligns, genders } from "./role.js";
import { freedynamicdata } from "./save.js";
import { bclose, close_check } from "./sfstruct.js";
import { pmatch } from "./strutil.js";
import { clear_symsetentry, proc_symset_line } from "./symbols.js";
import { sysopt } from "./sys.js";
import { validate, version_string } from "./version.js";
import { wish_history_add } from "./zap.js";
import { regularize } from "../sys/c2js/nhjs_host.js";
import { sethanguphandler } from "../sys/unix/unixmain.js";
const __FILE__ = "files.c";
