/* NetHack 5.0	rumors.c	$NHDT-Date: 1594370241 2020/07/10 08:37:21 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.56 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2012. */
/* NetHack may be freely redistributed.  See license for details. */

/*      [Note:  this comment is fairly old, but still accurate for 3.1;
 *       it's no longer accurate for 5.0 but may still be of interest.]
 * Rumors have been entirely rewritten to speed up the access.  This is
 * essential when working from floppies.  Using fseek() the way that's done
 * here means rumors following longer rumors are output more often than those
 * following shorter rumors.  Also, you may see the same rumor more than once
 * in a particular game (although the odds are highly against it), but
 * this also happens with real fortune cookies.  -dgk
 */

/*      3.6
 * The rumors file consists of a "do not edit" line, then a line containing
 * three sets of three counts (first two in decimal, third in hexadecimal).
 * The first set has the number of true rumors, the count in bytes for all
 * true rumors, and the file offset to the first one.  The second set has
 * the same group of numbers for the false rumors.  The third set has 0 for
 * count, 0 for size, and the file offset for end-of-file.  The offset of
 * the first true rumor plus the size of the true rumors matches the offset
 * of the first false rumor.  Likewise, the offset of the first false rumor
 * plus the size of the false rumors matches the offset for end-of-file.
 */

/*      3.1     [now obsolete for rumors but still accurate for oracles]
 * The rumors file consists of a "do not edit" line, a hexadecimal number
 * giving the number of bytes of useful/true rumors, followed by those
 * true rumors (one per line), followed by the useless/false/misleading/cute
 * rumors (also one per line).  Number of bytes of untrue rumors is derived
 * via fseek(EOF)+ftell().
 *
 * The oracles file consists of a "do not edit" comment, a decimal count N
 * and set of N+1 hexadecimal fseek offsets, followed by N multiple-line
 * records, separated by "---" lines.  The first oracle is a special case,
 * and placed there by 'makedefs'.
 */

/* used by CapitalMon(); set up by init_CapMons(), released by free_CapMons();
   there's no need for these to be put into 'struct instance_globals g' */
const CapMonstCnt = static_var("CapMonstCnt", unsigned, 0); const CapBogonCnt = static_var("CapBogonCnt", unsigned, 0);
const CapMonSiz = static_var("CapMonSiz", unsigned, 0); /* CapMonstCnt+CapBogonCnt+1 when non-zero */
const CapMons = static_var("CapMons", ptr_to(ptr_to(char)), null);

/* list of bogusmons prefixes used to indicate special monster type such as
   unique or always a particular gender; see dat/bogusmon.txt */
 /* from do_name.c */

/* makedefs pads short rumors, epitaphs, engravings, and hallucinatory
   monster names with trailing underscores; strip those off */
function unpadline(line) { /* void */
    let p = eos(line);

    /* remove newline if still present; caller should have stripped it */
    if (p > line && chars[p + (-1)] == ord('\n'))
        --p;

    /* remove padding */
    while (p > line && chars[p + (-1)] == ord('_'))
        --p;

    chars[p] = ord('\0');
}

function init_rumors(fp) { /* void */
    const $frame = stack_frame(); try {
    let rumors_header = init_string(static_array("init_rumors.rumors_header", char, sizeof_string("%d,%lld,%llx;%d,%lld,%llx;0,0,%llx\n")), _("%d,%lld,%llx;%d,%lld,%llx;0,0,%llx\n"), true);
    let true_count = stack_var(int), false_count = stack_var(int); /* in file but not used here */
    let eof_offset = stack_var(ulong);
    let line = stack_array(char, BUFSZ);

    dlb_fgets(line, sizeof(array_of(char, BUFSZ)), fp); /* skip "don't edit" comment */
    dlb_fgets(line, sizeof(array_of(char, BUFSZ)), fp);
    if (sscanf(line, rumors_header, true_count, ref_of(gt, "true_rumor_size"),
               ref_of(gt, "true_rumor_start"), false_count, ref_of(gf, "false_rumor_size"),
               ref_of(gf, "false_rumor_start"), eof_offset) == 7
        && gt.true_rumor_size > 0
        && gf.false_rumor_size > 0) {
        gt.true_rumor_end = gt.true_rumor_start + gt.true_rumor_size;
        /* assert( gt.true_rumor_end == false_rumor_start ); */
        gf.false_rumor_end = gf.false_rumor_start + gf.false_rumor_size;
        /* assert( gf.false_rumor_end == eof_offset ); */
    } else {
        gt.true_rumor_size = -1; /* init failed */
        dlb_fclose(fp);
    }
    } finally { stack_pop($frame); }
}

/* exclude_cookie is a hack used because we sometimes want to get rumors in a
 * context where messages such as "You swallowed the fortune!" that refer to
 * cookies should not appear.  This has no effect for true rumors since none
 * of them contain such references anyway.
 */
export function getrumor(
    truth,
    rumor_buf,
    exclude_cookie) { /* char * */
    const $frame = stack_frame(); try {
    let rumors;
    let beginning, ending;
    let line = stack_array(char, BUFSZ);
    let cookie_marker = static_var("getrumor.cookie_marker", ptr_to(char), _("[cookie] "));
    let marklen = int(strlen(cookie_marker[0]));

    chars[rumor_buf + 0] = ord('\0');
    if (gt.true_rumor_size < 0) /* a previous try failed to open RUMORFILE */
        return rumor_buf;

    rumors = dlb_fopen(_(RUMORFILE), _("r"));
    if (rumors) {
        let count = 0;
        let adjtruth;

        do {
            chars[rumor_buf + 0] = ord('\0');
            if (gt.true_rumor_size == 0) { /* if this is 1st outrumor() */
                init_rumors(rumors);
                if (gt.true_rumor_size < 0) { /* init failed */
                    sprintf(rumor_buf, _("Error reading \"%.80s\"."), _(RUMORFILE));
                    return rumor_buf;
                }
            }
            /*
             *  input:      1    0   -1
             *   rn2 \ +1  2=T  1=T  0=F
             *   adj./ +0  1=T  0=F -1=F
             */
            switch (int(adjtruth = truth + rn2(2))) {
            case 2: /*(might let a bogus input arg sneak thru)*/
            case 1:
                beginning = gt.true_rumor_start;
                ending = gt.true_rumor_end;
                break;
            case 0: /* once here, 0 => false rather than "either"*/
            case -1:
                beginning = gf.false_rumor_start;
                ending = gf.false_rumor_end;
                break;
            default:
                impossible(_("strange truth value for rumor"));
                return strcpy(rumor_buf, _("Oops..."));
            }
            strcpy(rumor_buf, get_rnd_line(rumors, line, sizeof(array_of(char, BUFSZ)), rn2,
                                beginning, ending, MD_PAD_RUMORS))
;
        } while (count++ < 50 && exclude_cookie
                 && !strncmp(rumor_buf, cookie_marker[0], unsigned(marklen)));
        dlb_fclose(rumors);
        if (count >= 50)
            impossible(_("Can't find non-cookie rumor?"));
        else if (!gi.in_mklev) /* avoid exercising wisdom for graffiti */
            exercise(A_WIS, +(adjtruth > 0));
    } else {
        couldnt_open_file(_(RUMORFILE));
        gt.true_rumor_size = -1; /* don't try to open it again */
    }
    if (!exclude_cookie
        && !strncmp(rumor_buf, cookie_marker[0], unsigned(marklen))) {
        /* remove cookie_marker from the string */
        let src = rumor_buf + marklen;
        let dst = rumor_buf;
        for (; chars[src] != ord('\0'); ++src, ++dst) {
            chars[dst] = chars[src];
        }
        chars[dst] = ord('\0'); /* terminator wasn't copied */
    }
    return rumor_buf;
    } finally { stack_pop($frame); }
}

/* test that the true/false rumor boundaries are valid and show the first
   two and very last epitaphs, engravings, and bogus monsters */
export function rumor_check() { /* void */
    const $frame = stack_frame(); try {
    let $goto = null; var tmpwin = stack_var(winid), line = stack_array(char, BUFSZ), xbuf = stack_array(char, BUFSZ), rumor_buf = stack_array(char, BUFSZ);
    var rumors;
    tmpwin[0] = WIN_ERR;
    var endp;

    rumors = (gt.true_rumor_size >= 0) ? dlb_fopen(_(RUMORFILE), _("r")) : null;
    $goto_no_rumors: for (;;) { switch ($goto) { default: case "no_rumors": if (!$goto && (rumors)) {
        var ftell_rumor_start = 0;

        chars[rumor_buf + 0] = ord('\0');
        if (gt.true_rumor_size == 0) { /* if this is 1st outrumor() */
            init_rumors(rumors);
            if (gt.true_rumor_size < 0) {
                rumors = null; /* init_rumors() closes it upon failure */
                { $goto = "no_rumors"; continue $goto_no_rumors; } /* init failed */
            }
        }
        tmpwin[0] = create_nhwindow()(NHW_TEXT);

        /*
         * reveal the values.
         */
        sprintf(rumor_buf, _("T start=%06lld (%06llx), end=%06lld (%06llx), size=%06lld (%06llx)"), gt.true_rumor_start, gt.true_rumor_start, gt.true_rumor_end, ulong(gt.true_rumor_end), gt.true_rumor_size, ulong(gt.true_rumor_size))

;
        putstr()(tmpwin[0], 0, rumor_buf);
        sprintf(rumor_buf, _("F start=%06lld (%06llx), end=%06lld (%06llx), size=%06lld (%06llx)"), gf.false_rumor_start, gf.false_rumor_start, gf.false_rumor_end, ulong(gf.false_rumor_end), gf.false_rumor_size, ulong(gf.false_rumor_size))

;
        putstr()(tmpwin[0], 0, rumor_buf);

        /*
         * check the first rumor (start of true rumors) by
         * skipping the first two lines.
         *
         * Then seek to the start of the false rumors (based on
         * the value read in rumors, and display it.
         */
        chars[rumor_buf + 0] = ord('\0');
        dlb_fseek(rumors, gt.true_rumor_start, SEEK_SET);
        ftell_rumor_start = dlb_ftell(rumors);
        dlb_fgets(line, sizeof(array_of(char, BUFSZ)), rumors);
        if ((endp = strchr(line, ord('\n'))) != 0)
            chars[endp] = 0;
        sprintf(rumor_buf, _("T %06lld %s"), ftell_rumor_start, xcrypt(line, xbuf))
;
        putstr()(tmpwin[0], 0, rumor_buf);
        /* find last true rumor */
        while (dlb_fgets(line, sizeof(array_of(char, BUFSZ)), rumors)
               && dlb_ftell(rumors) < gt.true_rumor_end)
            continue;
        if ((endp = strchr(line, ord('\n'))) != 0)
            chars[endp] = 0;
        sprintf(rumor_buf, _("  %6s %s"), _(""), xcrypt(line, xbuf));
        putstr()(tmpwin[0], 0, rumor_buf);

        chars[rumor_buf + 0] = ord('\0');
        dlb_fseek(rumors, gf.false_rumor_start, SEEK_SET);
        ftell_rumor_start = dlb_ftell(rumors);
        dlb_fgets(line, sizeof(array_of(char, BUFSZ)), rumors);
        if ((endp = strchr(line, ord('\n'))) != 0)
            chars[endp] = 0;
        sprintf(rumor_buf, _("F %06lld %s"), ftell_rumor_start, xcrypt(line, xbuf))
;
        putstr()(tmpwin[0], 0, rumor_buf);
        /* find last false rumor */
        while (dlb_fgets(line, sizeof(array_of(char, BUFSZ)), rumors)
               && dlb_ftell(rumors) < gf.false_rumor_end)
            continue;
        if ((endp = strchr(line, ord('\n'))) != 0)
            chars[endp] = 0;
        sprintf(rumor_buf, _("  %6s %s"), _(""), xcrypt(line, xbuf));
        putstr()(tmpwin[0], 0, rumor_buf);

        dlb_fclose(rumors);

    /* if a previous attempt couldn't open file or rejected its contents,
       we didn't bother trying again this time */
    } else if ($goto || (gt.true_rumor_size < 0)) {
 $goto = null; /* file could be opened but init_rumors() didn't like it */
        pline(_("rumors not accessible."));
        /* engravings, epitaphs, and bogus monsters will still be shown,
           and in tmpwin rather than via additional pline() calls */
        display_nhwindow()(WIN_MESSAGE, TRUE); /* --more-- */

    /* first attempt to open file has just failed */
    } else {
        couldnt_open_file(_(RUMORFILE));
        gt.true_rumor_size = -1; /* don't try to open it again */
    } } break; }

    /* initial implementation of default epitaph/engraving/bogusmon
       contained an error; check those along with rumors */
    others_check(_("Engravings:"), _(ENGRAVEFILE), tmpwin);
    others_check(_("Epitaphs:"), _(EPITAPHFILE), tmpwin);
    others_check(_("Bogus monsters:"), _(BOGUSMONFILE), tmpwin);

    if (tmpwin[0] != WIN_ERR) {
        display_nhwindow()(tmpwin[0], TRUE);
        destroy_nhwindow()(tmpwin[0]);
    }
    } finally { stack_pop($frame); }
}

/* 5.0: augments rumors_check(); test 'engrave' or 'epitaph' or 'bogusmon' */
function others_check(
    ftype,
    fname,
    winptr) { /* void */ /* text window for output; created here if necessary */
    const $frame = stack_frame(); try {
    var errfmt = init_string(static_array("others_check.errfmt", char, sizeof_string("others_check(\"%s\"): %s")), _("others_check(\"%s\"): %s"), true);
    var fh;
    var line = stack_array(char, BUFSZ), xbuf = stack_array(char, BUFSZ), endp;
    var tmpwin = winptr[0];
    var entrycount = 0;

    fh = dlb_fopen(fname, _("r"));
    if (fh) {
        closeit: { if (tmpwin == WIN_ERR) {
            winptr[0] = tmpwin = create_nhwindow()(NHW_TEXT);
            if (tmpwin == WIN_ERR) {
                /* should panic, but won't for wizard mode check operation */
                impossible(errfmt, fname, _("can't create temporary window"));
                break closeit;
            }
        }
        putstr()(tmpwin, 0, _(""));
        putstr()(tmpwin, 0, ftype);
        /* "don't edit" comment */
        chars[line] = ord('\0');
        if (!dlb_fgets(line, sizeof(array_of(char, BUFSZ)), fh)) {
            sprintf(xbuf, errfmt, fname, _("error; can't read comment line"));
            putstr()(tmpwin, 0, xbuf);
            break closeit;
        }
        if (chars[line] != ord('#')) {
            sprintf(xbuf, errfmt, fname, _("malformed; first line is not a comment line:"))
;
            putstr()(tmpwin, 0, xbuf);
            /* show the bad line; we don't know whether it has been
               encrypted via xcrypt() so show it both ways */
            if ((endp = strchr(line, ord('\n'))) != 0)
                chars[endp] = 0;
            putstr()(tmpwin, 0, _("- first line, as is"));
            putstr()(tmpwin, 0, line);
            putstr()(tmpwin, 0, _("- xcrypt of first line"));
            putstr()(tmpwin, 0, xcrypt(line, xbuf));
            break closeit;
        }
        /* first line; should be default one inserted by makedefs when
           building the file but we don't have the expected value so
           can only require a line to exist */
        chars[line] = ord('\0');
        if (!dlb_fgets(line, sizeof(array_of(char, BUFSZ)), fh) || chars[line] == ord('\n')) {
            sprintf(xbuf, errfmt, fname, !chars[line] ? _("can't read first non-comment line")
                           : _("first non-comment line is empty"))
;
            putstr()(tmpwin, 0, xbuf);
            break closeit;
        }
        ++entrycount;
        if ((endp = strchr(line, ord('\n'))) != 0)
            chars[endp] = 0;
        putstr()(tmpwin, 0, xcrypt(line, xbuf));
        if (!dlb_fgets(line, sizeof(array_of(char, BUFSZ)), fh)) {
            putstr()(tmpwin, 0, _("(no second entry)"));
        } else {
            ++entrycount;
            if ((endp = strchr(line, ord('\n'))) != 0)
                chars[endp] = 0;
            putstr()(tmpwin, 0, xcrypt(line, xbuf));
            while (dlb_fgets(line, sizeof(array_of(char, BUFSZ)), fh)) {
                ++entrycount;
                if ((endp = strchr(line, ord('\n'))) != 0)
                    chars[endp] = 0;
                xcrypt(line, xbuf);
            }
            /* count will be 2 if the default entry and the first ordinary
               entry are the only ones present (if either of those were
               missing, we wouldn't have gotten here...) */
            if (entrycount == 2) {
                putstr()(tmpwin, 0, _("(only two entries)"));
            } else {
                /* showing an ellipsis avoids ambiguity about whether
                   there are other lines; doing so three times (once for
                   each file) results in total output being 24 lines,
                   forcing a --More-- prompt if using a 24 line screen;
                   displaying 23 lines and --More-- followed by second
                   page with 1 line doesn't look very good but isn't
                   incorrect, and taller screens where that won't be an
                   issue are more common than 24 line terminals nowadays */
                if (entrycount > 3)
                    putstr()(tmpwin, 0, _(" ..."));
                putstr()(tmpwin, 0, xbuf); /* already decrypted */
            }
        }
 }
        dlb_fclose(fh);
    } else {
        /* since this comes out via impossible(), it won't be integrated
           with the text window of values, but it shouldn't ever happen
           so we won't waste effort integrating it */
        couldnt_open_file(fname);
    }
    } finally { stack_pop($frame); }
}

/* load one randomly chosen line from a section of a file; undoes
   decryption and strips trailing underscore padding and final newline;
   if padlength is non-zero, every line is expected to be at least that
   long and every line in the file will have an equal chance of being
   chosen; however, if padlength is 0, lines following long lines are
   more likely than average to be picked, and lines after short lines
   are less likely */
function get_rnd_line(
    fh,
    buf,
    bufsiz,
    rng,
    startpos,
    endpos,

    padlength) { /* char * */ /* expected line length; 0 if no expectations */
    const $frame = stack_frame(); try {
    let newl, xbufp, xbuf = stack_array(char, BUFSZ);
    let filechunksize, chunkoffset;
    let trylimit;

    chars[buf] = ord('\0');
    if (!endpos) {
        dlb_fseek(fh, 0, SEEK_END);
        endpos = dlb_ftell(fh);
    }
    filechunksize = endpos - startpos;

    /* might be zero (only if file is empty); should complain in that
       case but it could happen over and over, also the suggestion
       that save and restore might fix the problem wouldn't be useful */
    if (filechunksize < 1)
        return buf;
    /* 'rumors' is about 3/4 of the way to the limit on a 16-bit config
       for the whole, roughly 3/8 of the way for either half; all active
       configurations these days are at least 32-bits anyway */
    ((!!(filechunksize <= INT_MAX)) || (nhassert_failed(_("filechunksize <= INT_MAX"), _(__FILE__), 0), 0)); /* essential for rn2() */

    /*
     * Position randomly which will probably be in the middle of a line.
     * (Occasionally by chance it will happen to be at the very start of
     * a line, but we'll have no way of knowing that so have to behave
     * as if it were positioned in the middle.)
     * Read the rest of that line, then use the next one.  If there's no
     * next line (ie, end of file), go back to beginning and use first.
     *
     * When short lines have been padded to length N, only accept long
     * lines if we land within last N+1 characters (+1 is for newline
     * which hasn't been stripped away yet), effectively shortening
     * them to normal length.  That yields even selection distribution.
     */
    for (trylimit = 10; trylimit > 0; --trylimit) {
        chunkoffset = rng(int(filechunksize));
        dlb_fseek(fh, startpos + chunkoffset, SEEK_SET);
        dlb_fgets(buf, int(bufsiz), fh);
        /* if padlength is 0, accept any position; when non-zero,
           padlength does not count the newline but strlen(buf) does */
        if (!padlength || strlen(buf) <= unsigned(padlength + 1))
            break;
    }
    /* use next line; for rumors, caller takes care of whether startpos
       and endpos cover just true rumors or just false rumors; reaching
       endpos is equivalent to end-of-file in order to avoid using the
       first false rumor if fseek for a true one lands within the last one */
    if (dlb_ftell(fh) >= endpos || !dlb_fgets(buf, int(bufsiz), fh)) {
        /* assume failure is due to end-of-file; go back to start */
        dlb_fseek(fh, startpos, SEEK_SET);
        dlb_fgets(buf, int(bufsiz), fh);
    }
    if ((newl = strchr(buf, ord('\n'))) != 0)
        chars[newl] = ord('\0');
    /* decrypt line; make sure that our intermediate buffer is big enough */
    xbufp = (strlen(buf) <= sizeof(array_of(char, BUFSZ)) - 1) ? xbuf + 0
            : addr_of(alloc(unsigned(strlen(buf) + 1)));
    strcpy(buf, xcrypt(buf, xbufp));
    if (xbufp != xbuf + 0)
        free(xbufp);
    /* strip padding that makedefs adds to short lines */
    if (padlength)
        unpadline(buf);
    return buf;
    } finally { stack_pop($frame); }
}

/* Gets a random line of text from file 'fname', and returns it.
   rng is the random number generator to use, and should act like rn2 does. */
export function get_rnd_text(
    fname,
    buf,
    rng,
    padlength) { /* char * */
    const $frame = stack_frame(); try {
    let fh = dlb_fopen(fname, _("r"));

    chars[buf + 0] = ord('\0');
    if (fh) {
        let starttxt = 0;
        let line = stack_array(char, BUFSZ);

        /* skip "don't edit" comment */
        dlb_fgets(line, sizeof(array_of(char, BUFSZ)), fh);
        /* obtain current file position */
        dlb_fseek(fh, 0, SEEK_CUR);
        starttxt = dlb_ftell(fh);

        /* get a randomly chosen line; it comes back decrypted and unpadded */
        strcpy(buf, get_rnd_line(fh, line, sizeof(array_of(char, BUFSZ)), rng,
                                 starttxt, 0, padlength));
        dlb_fclose(fh);
    } else {
        couldnt_open_file(fname);
    }
    return buf;
    } finally { stack_pop($frame); }
}

export function outrumor(
    truth,
    mechanism) { /* void */
    const $frame = stack_frame(); try {
    let fortune_msg = init_string(static_array("outrumor.fortune_msg", char, sizeof_string("This cookie has a scrap of paper inside.")), _("This cookie has a scrap of paper inside."), true);

    let line;
    let buf = stack_array(char, BUFSZ);
    let reading = +(mechanism == BY_COOKIE || mechanism == BY_PAPER);

    if (reading) {
        /* deal with various things that prevent reading */
        if (is_fainted() && mechanism == BY_COOKIE) {
            return;
        } else if (Blind()) {
            if (mechanism == BY_COOKIE)
                pline(fortune_msg);
            pline(_("What a pity that you cannot read it!"));
            return;
        }
    }

    line = getrumor(truth, buf, reading ? FALSE : TRUE);
    if (!chars[line])
        line = _("NetHack rumors file closed for renovation.");
    switch (mechanism) {
    case BY_ORACLE:
        /* Oracle delivers the rumor */
        pline(_("True to her word, the Oracle %ssays: "),
              (!rn2(4) ? _("offhandedly ")
                       : (!rn2(3) ? _("casually ")
                                  : (rn2(2) ? _("nonchalantly ") : _("")))));
              ;
        verbalize1(line);
        /* [WIS exercised by getrumor()] */
        return;
    case BY_COOKIE:
        pline(fortune_msg);
        /* FALLTHROUGH */;
    /* FALLTHRU */
    case BY_PAPER:
        pline(_("It reads:"));
        break;
    }
    pline1(line);
    } finally { stack_pop($frame); }
}

function init_oracles(fp) { /* void */
    const $frame = stack_frame(); try {
    let i;
    let line = stack_array(char, BUFSZ);
    let cnt = stack_var(int, 0);

    /* this assumes we're only called once */
    dlb_fgets(line, sizeof(array_of(char, BUFSZ)), fp); /* skip "don't edit" comment*/
    dlb_fgets(line, sizeof(array_of(char, BUFSZ)), fp);
    if (sscanf(line, _("%5d\n"), cnt) == 1 && cnt[0] > 0) {
        svo.oracle_cnt = unsigned((cnt[0]));
        svo.oracle_loc = ref_to(ulong, addr_of(alloc(unsigned(Math.imul(unsigned((cnt[0])), sizeof(long))))));
        for (i = 0; i < cnt[0]; i++) {
            dlb_fgets(line, sizeof(array_of(char, BUFSZ)), fp);
            sscanf(line, _("%5llx\n"), svo.oracle_loc.subarray(i));
        }
    }
    return;
    } finally { stack_pop($frame); }
}

export function save_oracles(nhfp) { /* void */
    let i;

    if (update_file(nhfp)) {
        Sfo_unsigned(nhfp, ref_of(svo, "oracle_cnt"), _("oracle-oracle_cnt"));
        if (svo.oracle_cnt) {
            for (i = 0; unsigned(i) < svo.oracle_cnt; ++i) {
                sfo_ulong(nhfp, svo.oracle_loc.subarray(i), _("oracle-oracle_loc"));
            }
        }
    }
    if (release_data(nhfp)) {
        if (svo.oracle_cnt) {
            svo.oracle_cnt = 0, go.oracle_flg = 0;
        }
        if (svo.oracle_loc) {
            free(addr_of(svo.oracle_loc));
            svo.oracle_loc = null;
        }
    }
}

export function restore_oracles(nhfp) { /* void */
    let i;

    sfi_unsigned(nhfp, ref_of(svo, "oracle_cnt"), _("oracle-oracle_cnt"));
    if (svo.oracle_cnt) {
        svo.oracle_loc =
            ref_to(ulong, addr_of(alloc(unsigned(Math.imul(svo.oracle_cnt, sizeof(ulong))))));
        for (i = 0; unsigned(i) < svo.oracle_cnt; ++i) {
            sfi_ulong(nhfp, svo.oracle_loc.subarray(i), _("oracle-oracle_loc"));
        }
        go.oracle_flg = 1; /* no need to call init_oracles() */
    }
}

export function outoracle(special, delphi) { /* void */
    const $frame = stack_frame(); try {
    var tmpwin;
    var oracles;
    var oracle_idx;
    var endp, line = stack_array(char, COLNO), xbuf = stack_array(char, BUFSZ);

    /* early return if we couldn't open ORACLEFILE on previous attempt,
       or if all the oracularities are already exhausted */
    if (go.oracle_flg < 0 || (go.oracle_flg > 0 && svo.oracle_cnt == 0))
        return;

    oracles = dlb_fopen(_(ORACLEFILE), _("r"));

    if (oracles) {
        close_oracles: { if (go.oracle_flg == 0) { /* if this is the first outoracle() */
            init_oracles(oracles);
            go.oracle_flg = 1;
            if (svo.oracle_cnt == 0)
                break close_oracles;;
        }
        /* oracle_loc[0] is the special oracle;
           oracle_loc[1..oracle_cnt-1] are normal ones */
        if (svo.oracle_cnt <= 1 && !special)
            break close_oracles;; /*(shouldn't happen)*/
        oracle_idx = special ? 0 : rnd(int(svo.oracle_cnt) - 1);
        dlb_fseek(oracles, (svo.oracle_loc[oracle_idx]), SEEK_SET);
        if (!special) /* move offset of very last one into this slot */
            svo.oracle_loc[oracle_idx] = svo.oracle_loc[--svo.oracle_cnt];

        tmpwin = create_nhwindow()(NHW_TEXT);
        if (delphi)
            putstr()(tmpwin, 0,
                   special
                     ? _("The Oracle scornfully takes all your gold and says:")
                     : _("The Oracle meditates for a moment and then intones:"));
        else
            putstr()(tmpwin, 0, _("The message reads:"));
        putstr()(tmpwin, 0, _(""));

        while (dlb_fgets(line, COLNO, oracles) && strcmp(line, _("---\n"))) {
            if ((endp = strchr(line, ord('\n'))) != 0)
                chars[endp] = 0;
            putstr()(tmpwin, 0, xcrypt(line, xbuf));
        }
        display_nhwindow()(tmpwin, TRUE);
        destroy_nhwindow()(tmpwin);
 }
        dlb_fclose(oracles);
    } else {
        couldnt_open_file(_(ORACLEFILE));
        go.oracle_flg = -1; /* don't try to open it again */
    }
    } finally { stack_pop($frame); }
}

export function doconsult(oracl) { /* int */
    const $frame = stack_frame(); try {
    let umoney;
    let u_pay, minor_cost = 50, major_cost = 500 + 50 * u.ulevel;
    let add_xpts;
    let qbuf = stack_array(char, QBUFSZ);

    gm.multi = 0;
    umoney = money_cnt(gi.invent);

    if (!oracl) {
        There(_("is no one here to consult."));
        return ECMD_OK;
    } else if (!oracl.mpeaceful) {
        pline(_("%s is in no mood for consultations."), Monnam(oracl));
        return ECMD_OK;
    } else if (!umoney) {
        You(_("have no gold."));
        return ECMD_OK;
    }

    sprintf(qbuf, _("\"Wilt thou settle for a minor consultation?\" (%d %s)"), minor_cost, currency(minor_cost))
;
    switch (ynq(qbuf)) {
    default:
    case ord('q'):
        return ECMD_OK;
    case ord('y'):
        if (umoney < minor_cost) {
            You(_("don't even have enough gold for that!"));
            return ECMD_OK;
        }
        u_pay = minor_cost;
        break;
    case ord('n'):
        if (umoney <= minor_cost /* don't even ask */
            || (svo.oracle_cnt == 1 || go.oracle_flg < 0))
            return ECMD_OK;
        sprintf(qbuf, _("\"Then dost thou desire a major one?\" (%d %s)"), major_cost, currency(major_cost))
;
        if (y_n(qbuf) != ord('y'))
            return ECMD_OK;
        u_pay = (umoney < major_cost) ? int(umoney) : major_cost;
        break;
    }
    money2mon(oracl, u_pay);
    disp.botl = TRUE;
    if (!u.uevent.major_oracle && !u.uevent.minor_oracle)
        record_achievement(ACH_ORCL);
    add_xpts = 0; /* first oracle of each type gives experience points */
    if (u_pay == minor_cost) {
        outrumor(1, BY_ORACLE);
        if (!u.uevent.minor_oracle)
            add_xpts = Math.trunc(u_pay / (u.uevent.major_oracle ? 25 : 10));
        /* 5 pts if very 1st, or 2 pts if major already done */
        u.uevent.minor_oracle = TRUE;
    } else {
        let cheapskate = +(u_pay < major_cost);

        outoracle(cheapskate, TRUE);
        if (!cheapskate && !u.uevent.major_oracle)
            add_xpts = Math.trunc(u_pay / (u.uevent.minor_oracle ? 25 : 10));
        /* ~100 pts if very 1st, ~40 pts if minor already done */
        u.uevent.major_oracle = TRUE;
        exercise(A_WIS, +!cheapskate);
    }
    if (add_xpts) {
        more_experienced(add_xpts, Math.trunc(u_pay / 50));
        newexplevel();
    }
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

function couldnt_open_file(filename) { /* void */
    let save_something = program_state.something_worth_saving;

    /* most likely the file is missing, so suppress impossible()'s
       "saving and restoring might fix this" (unless the fuzzer,
       which escalates impossible to panic, is running) */
    if (!iflags.debug_fuzzer)
        program_state.something_worth_saving = 0;

    impossible(_("Can't open '%s' file."), filename);
    program_state.something_worth_saving = save_something;
}

/* is 'word' a capitalized monster name that should be preceded by "the"?
   (non-unique monster like Mordor Orc, or capitalized title like Norn
   rather than a name); used by the() on a string without any context;
   this sets up a list of names rather than scan all of mons[] every time
   the decision is needed (resulting list currently contains 27 monster
   entries and 20 hallucination entries) */
export function CapitalMon(
    word) { /* boolean */ /* potential monster name; a name might be followed by * something like " corpse" */
    let nam;
    let i, wln, nln;

    if (!word || !chars[word] || chars[word] == lowc(chars[word]))
        return FALSE; /* 'word' is not a capitalized monster name */

    if (!CapMons[0])
        init_CapMons();
    assert(CapMons[0] != null);

    wln = strlen(word);
    for (i = 0; i < unsigned(CapMonSiz[0] - 1); ++i) {
        nam = CapMons[0][i];
        nln = strlen(nam);
        if (wln < nln)
            continue;
        /*
         * Unlike name_to_mon(), we don't need to find the longest match
         * or return the gender or a pointer to trailing stuff.  We do
         * check full words though: "Foo" matches "Foo" and "Foo bar" and
         * "Foo's bar" but not "Foobar".  We use case-sensitive matching.
         */
        if (!strncmp(nam, word, nln)
            && (!chars[word + nln] || chars[word + nln] == ord(' ') || chars[word + nln] == ord('\'')))
            return TRUE; /* 'word' is a capitalized monster name */
    }
    return FALSE;
}

/* one-time initialization of CapMons[], a list of non-unique monsters
   having a capitalized type name like Green-elf or Archon, plus unique
   monsters whose "name" is a title rather than a personal name, plus
   hallucinatory monster names that fall into either of those categories */
function init_CapMons() { /* void */
    const $frame = stack_frame(); try {
    let pass;
    let bogonfile = dlb_fopen(_(BOGUSMONFILE), _("r"));

    if (CapMons[0]) /* sanity precaution */
        free_CapMons();

    /* first pass: count the number of relevant monster names, then
       allocate memory for CapMons[]; second pass: populate CapMons[] */
    for (pass = 1; pass <= 2; ++pass) {
        let mptr;
        let nam;
        let mndx, mgend;

        /* the first CapMonstCnt entries come from mons[].pmnames[] and
           the next CapBogonCnt entries from the 'bogusmons' file;
           there is an extra entry for Null at the end, but that is only
           useful to force non-zero array size in case both mons[] and
           bogusmons get modified to have no applicable monster names */
        CapMonstCnt[0] = CapBogonCnt[0] = 0;

        /* gather applicable actual monsters */
        for (mndx = LOW_PM; mndx < NUMMONS; ++mndx) {
            mptr = mons[mndx];
            if ((mptr.geno & G_UNIQ) != 0 && !the_unique_pm(mptr))
                continue;
            for (mgend = MALE; mgend < NUM_MGENDERS; ++mgend) {
                nam = mptr.pmnames[mgend];
                if (nam && chars[nam] != lowc(chars[nam])) {
                    if (pass == 2)
                        CapMons[0][CapMonstCnt[0]] = nam;
                    ++CapMonstCnt[0];
                }
            }
        }

        /* now gather applicable hallucinatory monsters */
        if (bogonfile) {
            let hline = stack_array(char, BUFSZ), xbuf = stack_array(char, BUFSZ), endp, startp, code;

            /* rewind; effectively a no-op for pass 1; essential for pass 2 */
            dlb_fseek(bogonfile, 0, SEEK_SET);
            /* skip "don't edit" comment (first line of file) */
            dlb_fgets(hline, sizeof(array_of(char, BUFSZ)), bogonfile);

            /* one monster name per line in rudimentary encrypted format;
               some are prefixed by a classification code to indicate
               gender and/or to distinguish an individual from a type
               (code is a single punctuation character when present) */
            while (dlb_fgets(hline, sizeof(array_of(char, BUFSZ)), bogonfile)) {
                if ((endp = strchr(hline, ord('\n'))) != 0)
                    chars[endp] = ord('\0'); /* strip newline */
                xcrypt(hline, xbuf);
                unpadline(xbuf);

                if (!chars[xbuf + 0] || !strchr(bogon_codes, chars[xbuf + 0]))
                    code = ord('\0'), startp = xbuf + 0; /* ordinary */
                else
                    code = chars[xbuf + 0], startp = xbuf + 1; /* special */

                if (chars[startp] != lowc(chars[startp]) && !bogon_is_pname(code)) {
                    if (pass == 2)
                        CapMons[0][unsigned(CapMonstCnt[0] + CapBogonCnt[0])] = dupstr(startp);
                    ++CapBogonCnt[0];
                }
            }
        }

        /* finish the current pass */
        if (pass == 1) {
            CapMonSiz[0] = unsigned(unsigned(CapMonstCnt[0] + CapBogonCnt[0]) + 1); /* +1: terminator */
            CapMons[0] = ref_to(ptr_to(char), addr_of(alloc(unsigned(Math.imul(CapMonSiz[0], sizeof(ptr_to(char)))))));
        } else { /* pass == 2 */
            /* terminator; not strictly needed */
            CapMons[0][unsigned(CapMonSiz[0] - 1)] = 0;

            if (bogonfile)
                dlb_fclose(bogonfile), bogonfile = null;
        }
    }

    /*
     * CapMons[] init doesn't kick in until needed.  To force this name
     * dump, set DEBUGFILES to "CapMons" in your environment (or in
     * sysconf) prior to starting nethack, wish for a statue of an Archon
     * and drop it if held, then step away and apply a stethoscope towards
     * it to trigger a message that passes "Archon" to the() which will
     * then call CapitalMon() which in turn will call init_CapMons().
     */
    if (wizard() && explicitdebug(_("CapMons"))) {
        let buf = stack_array(char, BUFSZ);
        let i;
        let tmpwin = create_nhwindow()(NHW_TEXT);

        putstr()(tmpwin, 0,
              _("Capitalized monster type names normally preceded by \"the\":"));
        for (i = 0; i < unsigned(CapMonSiz[0] - 1); ++i) {
            sprintf(buf, _("  %.77s"), CapMons[0][i]);
            putstr()(tmpwin, 0, buf);
        }
        display_nhwindow()(tmpwin, TRUE);
        destroy_nhwindow()(tmpwin);
    }

    return;
    } finally { stack_pop($frame); }
}

/* release memory allocated for the list of capitalized monster type names */
export function free_CapMons() { /* void */
    /* note: some elements of CapMons[] are string literals from
       mons[].pmnames[] and should not be freed, others are dynamically
       allocated copies of hallucinatory monster names and should be freed */
    if (CapMons[0]) {
        let idx;

        /* skip 0..MonstCnt-1, free MonstCnt..(MonstCnt+BogonCnt-1) */
        for (idx = CapMonstCnt[0]; idx < unsigned(CapMonSiz[0] - 1); ++idx)
            free((CapMons[0][idx])); /* cast: discard 'const' */
        free(addr_of(CapMons[0])), CapMons[0] = null;
    }
    CapMonSiz[0] = 0;
}

/*rumors.c*/

import { A_WIS } from "./attrib.h.js";
import { dlb_fclose, dlb_fgets, dlb_fopen, dlb_fseek, dlb_ftell } from "./dlb.h.macros.js";
import { wizard } from "./flag.h.macros.js";
import {
    BOGUSMONFILE, BUFSZ, COLNO, ENGRAVEFILE, EPITAPHFILE, FALSE, MD_PAD_RUMORS, ORACLEFILE, QBUFSZ,
    RUMORFILE, TRUE,
} from "./global.h.js";
import { BY_COOKIE, BY_ORACLE, BY_PAPER, ECMD_OK, ECMD_TIME } from "./hack.h.js";
import { pline1, release_data, update_file, verbalize1, y_n, ynq } from "./hack.h.macros.js";
import { explicitdebug } from "./lint.h.macros.js";
import { G_UNIQ, MALE, NUM_MGENDERS } from "./monflag.h.js";
import { LOW_PM, NUMMONS } from "./monsters.h.js";
import { Sfo_unsigned } from "./savefile.h.macros.js";
import {
    create_nhwindow, destroy_nhwindow, display_nhwindow, putstr,
} from "./winprocs.h.macros.js";
import { NHW_TEXT, WIN_ERR, winid } from "./wintype.h.js";
import { ACH_ORCL } from "./you.h.js";
import { Blind } from "./youprop.h.macros.js";
import { char, int, long, ord, sizeof, sizeof_string, ulong, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import {
    INT_MAX, SEEK_CUR, SEEK_END, SEEK_SET, assert, free, sprintf, sscanf, strchr, strcmp, strcpy,
    strlen, strncmp,
} from "../rt/libc.js";
import { init_string, stack_array, stack_var, static_array, static_var } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, array_of, ptr_to, ref_of, ref_to } from "../rt/struct.js";
import { alloc, dupstr } from "./alloc.js";
import { exercise } from "./attrib.js";
import { disp, gf, gi, gm, go, gt, iflags, program_state, svo, u } from "./decl.js";
import { Monnam, bogon_codes, bogon_is_pname } from "./do_name.js";
import { is_fainted } from "./eat.js";
import { more_experienced, newexplevel } from "./exper.js";
import { money_cnt } from "./hack.js";
import { eos, lowc, xcrypt } from "./hacklib.js";
import { record_achievement } from "./insight.js";
import { currency } from "./invent.js";
import { mons } from "./monst.js";
import { the_unique_pm } from "./objnam.js";
import { There, You, impossible, nhassert_failed, pline } from "./pline.js";
import { rn2, rnd } from "./rnd.js";
import { sfi_ulong, sfi_unsigned, sfo_ulong } from "./sfbase.js";
import { money2mon } from "./shk.js";
const __FILE__ = "rumors.c";
