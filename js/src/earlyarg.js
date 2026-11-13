/* NetHack 5.0	earlyarg.c	$NHDT-Date: 1771213100 2026/02/15 19:38:20 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.286 $ */
/* Copyright (c) Robert Patrick Rankin, 2012. */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * Argument processing helpers - for xxmain() to share
 * and call.
 *
 * These should return TRUE if the argument matched,
 * whether the processing of the argument was
 * successful or not.
 *
 * Most of these do their thing, then after returning
 * to xxmain(), the code exits without starting a game.
 *
 */

const earlyopts = static_array("earlyopts", struct_early_opt, null, [
    { e: ARG_DEBUG, name: _("debug"), minlength: 5, valallowed: TRUE },
    { e: ARG_VERSION, name: _("version"), minlength: 4, valallowed: TRUE },
    { e: ARG_SHOWPATHS, name: _("showpaths"), minlength: 8, valallowed: FALSE },

    { e: ARG_DUMPENUMS, name: _("dumpenums"), minlength: 9, valallowed: FALSE },

    { e: ARG_DUMPGLYPHIDS, name: _("dumpglyphids"), minlength: 12, valallowed: FALSE },
    { e: ARG_DUMPMONGEN, name: _("dumpmongen"), minlength: 10, valallowed: FALSE },
    { e: ARG_DUMPWEIGHTS, name: _("dumpweights"), minlength: 11, valallowed: FALSE },

]);

const ArgVal_novalue = init_string(static_array("ArgVal_novalue", char, sizeof_string("[nothing]")), _("[nothing]"), true); /* note: not 'const' */

    const ArgValRequired = 0;
    const ArgValOptional = 1;
    const ArgValDisallowed = 2;
    const ArgVal_mask = (1 | 2);
    const ArgNamOneLetter = 4;
    const ArgNam_mask = 4;
    const ArgErrSilent = 0;
    const ArgErrComplain = 8;
    const ArgErr_mask = 8;

/* approximate 'getopt_long()' for one option; all the comments refer to
   "-windowtype" but the code isn't specific to that  */
function lopt(arg,
     lflags,
     optname,
     origarg,
     argc_p,
     argv_p) { /* char * */ /* argv[] ditto */
    let $goto = null;
    var argc = argc_p[0];
    var argv = argv_p[0];
    var p, nextarg = (argc > 1 && chars[argv[1] + 0] != ord('-')) ? argv[1] : 0;
    var l, opttype = (lflags & ArgVal_mask);
    var oneletterok = +((lflags & ArgNam_mask) == ArgNamOneLetter),
            complain = +((lflags & ArgErr_mask) == ArgErrComplain);

    /* first letter must match */
    $goto_loptbail: for (;;) { switch ($goto) { default: case "loptbail": case "loptnotallowed": case "loptrequired": if ($goto || (chars[arg + 1] != chars[optname + 1])) {
    switch ($goto) { default: case "loptbail": $goto = null;
        if (complain)
            config_error_add(_("Unknown option: %.60s"), origarg);
        return 0;
    case "loptnotallowed": $goto = null;
        if (complain)
            config_error_add(_("Value not allowed: %.60s"), origarg);
        return 0;
    case "loptrequired": $goto = null;
        if (complain)
            config_error_add(_("Missing required value: %.60s"), origarg); }
        return 0;
    }

    if ((p = strchr(arg, ord('='))) == 0)
        p = strchr(arg, ord(':'));
    if (p && opttype == ArgValDisallowed)
        { $goto = "loptnotallowed"; continue $goto_loptbail; };

    l = int((p ? (p - arg) : strlen(arg)));
    if ((l > 2 || oneletterok) && !strncmp(arg, optname, unsigned(l))) {
        /* "-windowtype[=foo]" */
        if (p)
            ++p; /* past '=' or ':' */
        else if (opttype == ArgValRequired)
            p = eos(arg); /* we have "-w[indowtype]" w/o "=foo"
                           * so we'll take foo from next element */
        else
            return ArgVal_novalue;
    } else if (oneletterok) {
        /* "-w..." but not "-w[indowtype[=foo]]" */
        if (!p) {
            p = arg + 2; /* past 'w' of "-wfoo" */
        } else {
            /* "-w...=foo" but not "-w[indowtype]=foo" */
            { $goto = "loptbail"; continue $goto_loptbail; }
        }
    } else {
        { $goto = "loptbail"; continue $goto_loptbail; }
    }
    if (!p || !chars[p]) {
        /* "-w[indowtype]" w/o '='/':' if there is a next element, use
           it for "foo"; if not, supply a non-Null bogus value */
        if (nextarg
            && (opttype == ArgValRequired || opttype == ArgValOptional))
            p = nextarg, --(argc_p[0]), (argv_p[0]) = (argv_p[0]).subarray(1);
        else if (opttype == ArgValRequired)
            { $goto = "loptrequired"; continue $goto_loptbail; }
        else
            p = ArgVal_novalue; /* there is no next element */
    } } break; }
    return p;
}
/* move argv[ndx] to end of argv[] array, then reduce argc to hide it;
   prevents process_options() from encountering it after early_options()
   has processed it; elements get reordered but all remain intact */
function consume_arg(ndx, ac_p, av_p) { /* void */
    let gone, av = av_p[0];
    let i, ac = ac_p[0];

    /* "-one -two -three -four" -> "-two -three -four -one" */
    if (ac > 2) {
        gone = av[ndx];
        for (i = ndx + 1; i < ac; ++i)
            av[i - 1] = av[i];
        av[ac - 1] = gone;
    }
    --(ac_p[0]);
}

/* consume two tokens for '-argname value' w/o '=' or ':' */
function consume_two_args(ndx, ac_p, av_p) { /* void */
    /* when consuming "-two arg" from "-two arg -three -four",
       the *ac_p manipulation results in "-three -four -two arg"
       rather than the "-three -four arg -two" that would happen
       with just two ordinary consume_arg() calls */
    consume_arg(ndx, ac_p, av_p);
    ++(ac_p[0]); /* bring the final slot back into view */
    consume_arg(ndx, ac_p, av_p);
    --(ac_p[0]); /* take away restored slot */
}

/* process some command line arguments before loading options */
export function early_options(argc_p, argv_p, hackdir_p) { /* void */
    const $frame = stack_frame(); try {
    let argv = stack_var(ptr_to(ptr_to(char))), arg, origarg;
    let argc = stack_var(int), oldargc, ndx = 0, consumed = 0;

    if (argcheck(argc_p[0], argv_p[0], ARG_DUMPGLYPHIDS) == 2)
        opt_terminate();

    config_error_init(FALSE, _("command line"), FALSE);

    /* treat "nethack ?" as a request for usage info; due to shell
       processing, player likely has to use "nethack \?" or "nethack '?'"
       [won't work if used as "nethack -dpath ?" or "nethack -d path ?"] */
    if (argc_p[0] > 1 && !strcmp((argv_p[0])[1], _("?")))
        opt_usage(hackdir_p[0]); /* doesn't return */

    /*
     * Both *argc_p and *argv_p account for the program name as (*argv_p)[0];
     * local argc and argv implicitly discard that (by starting 'ndx' at 1).
     * argcheck() doesn't mind, prscore() (via scores_only()) does (for the
     * number of args it gets passed, not for the value of argv[0]).
     */
    for (ndx = 1; ndx < argc_p[0]; ndx += (consumed ? 0 : 1)) {
        consumed = 0;
        argc[0] = argc_p[0] - ndx;
        argv[0] = argv_p[0].subarray(ndx);

        arg = origarg = argv[0][0];
        /* skip any args intended for deferred options */
        if (chars[arg] != ord('-'))
            continue;
        /* allow second dash if arg name is longer than one character */
        if (chars[arg + 0] == ord('-') && chars[arg + 1] == ord('-') && chars[arg + 2] != ord('\0')
            && (chars[arg + 3] != ord('\0') && chars[arg + 3] != ord('=') && chars[arg + 3] != ord(':')))
            ++arg;

        switch (chars[arg + 1]) { /* char after leading dash */
        case ord('b'):

            break;
        case ord('d'):
            if (argcheck(argc[0], argv[0], ARG_DEBUG) == 1) {
                consume_arg(ndx, argc_p, argv_p), consumed = 1;
            } else if (argcheck(argc[0], argv[0], ARG_DUMPENUMS) == 2) {
                opt_terminate();
                /*NOTREACHED*/
            } else if (argcheck(argc[0], argv[0], ARG_DUMPMONGEN) == 2) {
                opt_terminate();
                /*NOTREACHED*/
            } else if (argcheck(argc[0], argv[0], ARG_DUMPWEIGHTS) == 2) {
                opt_terminate();
                /*NOTREACHED*/
            } else {
                oldargc = argc[0];
                arg = lopt(arg,
                           (ArgValRequired | ArgNamOneLetter | ArgErrSilent),
                           _("-directory"), origarg, argc, argv);
                if (!arg)
                    error(_("Flag -d must be followed by a directory name."));
                if (chars[arg] != ord('e')) { /* avoid matching -decgraphics or -debug */
                    hackdir_p[0] = arg;
                    if (oldargc == argc[0])
                        consume_arg(ndx, argc_p, argv_p), consumed = 1;
                    else
                        consume_two_args(ndx, argc_p, argv_p), consumed = 2;
                }
            }
            break;
        case ord('h'):
        case ord('?'):
            if (lopt(arg, ArgValDisallowed, _("-help"), origarg, argc, argv)
                || lopt(arg, ArgValDisallowed | ArgNamOneLetter, _("-?"),
                        origarg, argc, argv))
                opt_usage(hackdir_p[0]); /* doesn't return */
            break;
        case ord('n'):
            oldargc = argc[0];
            if (!strcmp(arg, _("-no-nethackrc"))) /* no abbreviation allowed */
                arg = nhStr(_("/dev/null"));
            else
                arg = lopt(arg, (ArgValRequired | ArgErrComplain),
                           _("-nethackrc"), origarg, argc, argv);
            if (arg) {
                gc.cmdline_rcfile = dupstr(arg);
                if (oldargc == argc[0])
                    consume_arg(ndx, argc_p, argv_p), consumed = 1;
                else
                    consume_two_args(ndx, argc_p, argv_p), consumed = 2;
            }
            break;
        case ord('s'):
            if (argcheck(argc[0], argv[0], ARG_SHOWPATHS) == 2) {
                gd.deferred_showpaths = TRUE;
                gd.deferred_showpaths_dir = hackdir_p[0];
                config_error_done();
                return;
            }
            /* check for "-s" request to show scores */
            if (lopt(arg,
                     ((ArgValDisallowed | ArgErrComplain)
                      /* only accept one-letter if there is just one
                         dash; reject "--s" because prscore() via
                         scores_only() doesn't understand it */
                      | ((chars[origarg + 1] != ord('-')) ? ArgNamOneLetter : 0)),
                     /* [ought to omit val-disallowed and accept
                        --scores=foo since -s foo and -sfoo are
                        allowed, but -s form can take more than one
                        space-separated argument and --scores=foo
                        isn't suited for that] */
                     _("-scores"), origarg, argc, argv)) {
                /* at this point, argv[0] contains "-scores" or a leading
                   substring of it; prscore() (via scores_only()) expects
                   that to be in argv[1] so we adjust the pointer to make
                   that be the case; if there are any non-early args waiting
                   to be passed along to process_options(), the resulting
                   argv[0] will be one of those rather than the program
                   name but prscore() doesn't care */
                scores_only(argc[0] + 1, ref_add(argv[0], -1), hackdir_p[0]);
                /*NOTREACHED*/
            }
            break;
        case ord('u'):

            if (lopt(arg, ArgValDisallowed, _("-usage"), origarg, argc, argv))
                opt_usage(hackdir_p[0]);
            /* #elif defined(WIN32) || defined(MSDOS) || defined(AMIGA) (#if defined(UNIX)): not in this build */

            break;
        case ord('v'):
            if (argcheck(argc[0], argv[0], ARG_VERSION) == 2) {
                opt_terminate();
                /*NOTREACHED*/
            }
            break;
        case ord('w'): /* windowtype: "-wfoo" or "-w[indowtype]=foo"
                   * or "-w[indowtype]:foo" or "-w[indowtype] foo" */
            arg =
                lopt(arg, (ArgValRequired | ArgNamOneLetter | ArgErrComplain),
                     _("-windowtype"), origarg, argc, argv);
            if (gc.cmdline_windowsys)
                free(gc.cmdline_windowsys);
            gc.cmdline_windowsys = arg ? dupstr(arg) : 0;
            break;

        default:
            break;
        }
    }
    /* empty or "N errors on command line" */
    config_error_done();
    return;
    } finally { stack_pop($frame); }
}
/* for command-line options that perform some immediate action and then
   terminate the program without starting play, like 'nethack --version'
   or 'nethack -s Zelda'; do some cleanup before that termination */
 function opt_terminate() { /* void */
    program_state.early_options = 0;
    config_error_done(); /* free memory allocated by config_error_init() */

    nh_terminate(EXIT_SUCCESS);
    /*NOTREACHED*/
}

 function opt_usage(hackdir) { /* void */
    chdirx(hackdir, TRUE);

    ;

    genl_display_file(_(USAGEHELP), TRUE);
    opt_terminate();
}
/* show the sysconf file name, playground directory, run-time configuration
   file name, dumplog file name if applicable, and some other things */
 export function after_opt_showpaths(dir) { /* void */
    chdirx(dir, FALSE);

    opt_terminate();
    /*NOTREACHED*/
}

/* handle "-s <score options> [character-names]" to show all the entries
   in the high scores file ('record') belonging to particular characters;
   nethack will end after doing so without starting play */
 function scores_only(argc, argv, dir) { /* void */
    /* do this now rather than waiting for final termination, in case there
       is an error summary coming */
    config_error_done();

    chdirx(dir, FALSE);

    iflags.initoptions_noterminate = TRUE;
    initoptions(); /* sysconf options affect whether panictrace is enabled */
    iflags.initoptions_noterminate = FALSE;

    whoami(); /* set up default plname[] */

    prscore(argc, argv);

    nh_terminate(EXIT_SUCCESS); /* bypass opt_terminate() */
    /*NOTREACHED*/
}

/*
 * Returns:
 *    0 = no match
 *    1 = found and skip past this argument
 *    2 = found and trigger immediate exit
 */
export function argcheck(argc, argv, e_arg) { /* int */
    let i, idx;
    let match = FALSE;
    let userea = 0;
    let dashdash = _("");

    for (idx = 0; idx < SIZE(earlyopts); idx++) {
        if (earlyopts[idx].e == e_arg){
            break;
        }
    }
    if (idx >= SIZE(earlyopts) || argc < 1)
        return 0;

    for (i = 0; i < argc; ++i) {
        if (chars[argv[i] + 0] != ord('-'))
            continue;
        if (chars[argv[i] + 1] == ord('-')) {
            userea = argv[i] + 2;
            dashdash = _("-");
        } else {
            userea = argv[i] + 1;
        }
        match = match_optname(userea, earlyopts[idx].name,
                              earlyopts[idx].minlength,
                              earlyopts[idx].valallowed);
        if (match)
            break;
    }

    if (match) {
        let extended_opt = strchr(userea, ord(':'));

        if (!extended_opt)
            extended_opt = strchr(userea, ord('='));
        switch(e_arg) {
        case ARG_DEBUG:
            if (extended_opt) {
                let cpy_extended_opt;

                cpy_extended_opt = dupstr(extended_opt);
                debug_fields(cpy_extended_opt + 1);
                free(cpy_extended_opt);
            }
            return 1;
        case ARG_VERSION: {
            let insert_into_pastebuf = FALSE;

            if (extended_opt) {
                extended_opt++;
                    /* Deprecated in favor of "copy" - remove no later
                       than  next major version */
                if (match_optname(extended_opt, _("paste"), 5, FALSE)) {
                    insert_into_pastebuf = TRUE;
                } else if (match_optname(extended_opt, _("copy"), 4, FALSE)) {
                    insert_into_pastebuf = TRUE;
                } else if (match_optname(extended_opt, _("dump"), 4, FALSE)) {
                    /* version number plus enabled features and sanity
                       values that the program compares against the same
                       thing recorded in save and bones files to check
                       whether they're being used compatibly */
                    dump_version_info();
                    return 2; /* done */
                } else if (!match_optname(extended_opt, _("show"), 4, FALSE)) {
                    raw_printf(_("-%sversion can only be extended with" +
                               " -%sversion:copy or :dump or :show.\n"),
                               dashdash, dashdash);
                    /* exit after we've reported bad command line argument */
                    return 2;
                }
            }
            early_version_info(insert_into_pastebuf);
            return 2;
        }
        case ARG_SHOWPATHS:
            return 2;

        case ARG_DUMPENUMS:
            dump_enums();
            return 2;

        case ARG_DUMPGLYPHIDS:
            dump_glyphids();
            return 2;
        case ARG_DUMPMONGEN:
            dump_mongen();
            return 2;
        case ARG_DUMPWEIGHTS:
            dump_weights();
            return 2;

        default:
            break;
        }
    };
    return 0;
}

/*
 * These are internal controls to aid developers with
 * testing and debugging particular aspects of the code.
 * They are not player options and the only place they
 * are documented is right here. No gameplay is altered.
 *
 * test             - test whether this parser is working
 * ttystatus        - TTY:
 * immediateflips   - WIN32: turn off display performance
 *                    optimization so that display output
 *                    can be debugged without buffering.
 * fuzzer           - enable fuzzer without debugger intervention.
 */
function debug_fields(opts) { /* void */
    let op;
    let negated = FALSE;

    while ((op = strchr(opts, ord(','))) != 0) {
        chars[op++] = 0;
        /* recurse */
        debug_fields(op);
    }
    if (strlen(opts) > Math.trunc(BUFSZ / 2))
        return;

    /* strip leading and trailing white space */
    while (__isspace(uchar((chars[opts]))))
        opts++;
    op = eos(opts);
    while (--op >= opts && __isspace(uchar((chars[op]))))
        chars[op] = ord('\0');

    if (!chars[opts]) {
        /* empty */
        return;
    }
    while ((chars[opts] == ord('!')) || !strncmpi(opts, _("no"), 2)) {
        if (chars[opts] == ord('!'))
            opts++;
        else
            opts += 2;
        negated = +!negated;
    }
    if (match_optname(opts, _("test"), 4, FALSE))
        iflags.debug.test = negated ? FALSE : TRUE;

    if (match_optname(opts, _("ttystatus"), 9, FALSE))
        iflags.debug.ttystatus = negated ? FALSE : TRUE;

    if (match_optname(opts, _("fuzzer"), 4, FALSE))
        iflags.fuzzerpending = TRUE;
    return;
}

/* monsdump[] and objdump[] are also used in utf8map.c */

export const UNPREFIXED_COUNT = (5);
export const monsdump = static_array("monsdump", struct_enum_dump, null, [
...monsdump_records(),
    { val: NUMMONS, nm: _("NUMMONS") },
    { val: NON_PM, nm: _("NON_PM") },
    { val: LOW_PM, nm: _("LOW_PM") },
    { val: HIGH_PM, nm: _("HIGH_PM") },
    { val: SPECIAL_PM, nm: _("SPECIAL_PM") }
]);
export const objdump = static_array("objdump", struct_enum_dump, null, [
...objdump_records(),
    { val: NUM_OBJECTS, nm: _("NUM_OBJECTS") },
]);

const defsym_cmap_dump = static_array("defsym_cmap_dump", struct_enum_dump, null, [
...defsym_cmap_dump_records(),
    { val: MAXPCHARS, nm: _("MAXPCHARS") },
]);

const defsym_mon_syms_dump = static_array("defsym_mon_syms_dump", struct_enum_dump, null, [
...defsym_mon_syms_dump_records(),
    { val: MAXMCLASSES, nm: _("MAXMCLASSES") },
]);

const defsym_mon_defchars_dump = static_array("defsym_mon_defchars_dump", struct_enum_dump, null, [
...defsym_mon_defchars_dump_records(),
]);

const objclass_defchars_dump = static_array("objclass_defchars_dump", struct_enum_dump, null, [
...objclass_defchars_dump_records(),
]);

const objclass_classes_dump = static_array("objclass_classes_dump", struct_enum_dump, null, [
...objclass_classes_dump_records(),
    { val: MAXOCLASSES, nm: _("MAXOCLASSES") },
]);

const objclass_syms_dump = static_array("objclass_syms_dump", struct_enum_dump, null, [
...objclass_syms_dump_records(),
]);

const arti_enum_dump = static_array("arti_enum_dump", struct_enum_dump, null, [
...arti_enum_dump_records(),
    { val: AFTER_LAST_ARTIFACT, nm: _("AFTER_LAST_ARTIFACT") }
]);

/* the enums are not part of hack.h for this one */

const mcastu_enum_dump = static_array("mcastu_enum_dump", struct_enum_dump, null, [
...mcastu_enum_dump_records(),
]);

function dump_enums() { /* void */
    const $frame = stack_frame(); try {
    const monsters_enum = 0;
        const objects_enum = monsters_enum + 1;
        const objects_misc_enum = objects_enum + 1;
        const defsym_cmap_enum = objects_misc_enum + 1;
        const defsym_mon_syms_enum = defsym_cmap_enum + 1;
        const defsym_mon_defchars_enum = defsym_mon_syms_enum + 1;
        const objclass_defchars_enum = defsym_mon_defchars_enum + 1;
        const objclass_classes_enum = objclass_defchars_enum + 1;
        const objclass_syms_enum = objclass_classes_enum + 1;
        const arti_enum = objclass_syms_enum + 1;
        const mcastu_enum = arti_enum + 1;
        const NUM_ENUM_DUMPS = mcastu_enum + 1;

    let omdump = static_array("dump_enums.omdump", struct_enum_dump, null, [
        { val: LAST_GENERIC, nm: _("LAST_GENERIC") },
        { val: OBJCLASS_HACK, nm: _("OBJCLASS_HACK") },
        { val: FIRST_OBJECT, nm: _("FIRST_OBJECT") },
        { val: FIRST_AMULET, nm: _("FIRST_AMULET") },
        { val: LAST_AMULET, nm: _("LAST_AMULET") },
        { val: FIRST_SPELL, nm: _("FIRST_SPELL") },
        { val: LAST_SPELL, nm: _("LAST_SPELL") },
        { val: MAXSPELL, nm: _("MAXSPELL") },
        { val: FIRST_REAL_GEM, nm: _("FIRST_REAL_GEM") },
        { val: LAST_REAL_GEM, nm: _("LAST_REAL_GEM") },
        { val: FIRST_GLASS_GEM, nm: _("FIRST_GLASS_GEM") },
        { val: LAST_GLASS_GEM, nm: _("LAST_GLASS_GEM") },
        { val: NUM_REAL_GEMS, nm: _("NUM_REAL_GEMS") },
        { val: NUM_GLASS_GEMS, nm: _("NUM_GLASS_GEMS") },
        { val: MAX_GLYPH, nm: _("MAX_GLYPH") },
    ]);

    let ed = static_array("dump_enums.ed", ptr_to(struct_enum_dump), NUM_ENUM_DUMPS, [
        monsdump[0], objdump[0], omdump[0],
        defsym_cmap_dump[0], defsym_mon_syms_dump[0],
        defsym_mon_defchars_dump[0],
        objclass_defchars_dump[0],
        objclass_classes_dump[0],
        objclass_syms_dump[0],
        arti_enum_dump[0],
        mcastu_enum_dump[0],
    ]);

    const struct_de_params = struct("dump_enums.struct_de_params", {
        title: ptr_to(char),
        pfx: ptr_to(char),
        unprefixed_count: int,
        dumpflgs: int,
        szd: int,
    }); let edmp = static_array("dump_enums.edmp", struct_de_params, NUM_ENUM_DUMPS, [
        { title: _("monnums"), pfx: _("PM_"), unprefixed_count: UNPREFIXED_COUNT, dumpflgs: 0, szd: SIZE(monsdump) },
        { title: _("objects_nums"), pfx: _(""), unprefixed_count: 1, dumpflgs: 0, szd: SIZE(objdump) },
        { title: _("misc_object_nums"), pfx: _(""), unprefixed_count: 1, dumpflgs: 0, szd: SIZE(omdump) },
        { title: _("cmap_symbols"), pfx: _(""), unprefixed_count: 1, dumpflgs: 0, szd: SIZE(defsym_cmap_dump) },
        { title: _("mon_syms"), pfx: _(""), unprefixed_count: 1, dumpflgs: 0, szd: SIZE(defsym_mon_syms_dump) },
        { title: _("mon_defchars"), pfx: _(""), unprefixed_count: 1, dumpflgs: 1, szd: SIZE(defsym_mon_defchars_dump) },
        { title: _("objclass_defchars"), pfx: _(""), unprefixed_count: 1, dumpflgs: 1, szd: SIZE(objclass_defchars_dump) },
        { title: _("objclass_classes"), pfx: _(""), unprefixed_count: 1, dumpflgs: 0, szd: SIZE(objclass_classes_dump) },
        { title: _("objclass_syms"), pfx: _(""), unprefixed_count: 1, dumpflgs: 0, szd: SIZE(objclass_syms_dump) },
        { title: _("artifacts_nums"), pfx: _(""), unprefixed_count: 1, dumpflgs: 0, szd: SIZE(arti_enum_dump) },
        { title: _("mcast_spells"), pfx: _("MCAST_"), unprefixed_count: 0, dumpflgs: 0, szd: SIZE(mcastu_enum_dump) },
    ]);

    let nmprefix;
    let i, j, nmwidth;
    let comment = stack_array(char, BUFSZ);

    for (i = 0; i < NUM_ENUM_DUMPS; ++ i) {
        raw_printf(_("enum %s = {"), edmp[i].title);
        for (j = 0; j < edmp[i].szd; ++j) {
            nmprefix = (j >= edmp[i].szd - edmp[i].unprefixed_count)
                           ? _("") : edmp[i].pfx; /* "" or "PM_" */
            nmwidth = 27 - int(strlen(nmprefix)); /* 27 or 24 */
            if (edmp[i].dumpflgs > 0) {
                Snprintf(comment, sizeof(array_of(char, BUFSZ)), _("    /* '%c' */"), (ptr_add(ed[i], j).val >= 32 && ptr_add(ed[i], j).val <= 126)
                         ? ptr_add(ed[i], j).val : ord(' '))

;
            } else {
                chars[comment + 0] = ord('\0');
            }
            raw_printf(_("    %s%*s = %3d,%s"),
                       nmprefix, -nmwidth,
                       ptr_add(ed[i], j).nm, ptr_add(ed[i], j).val,
                       comment);
       }
        raw_print()(_("};"));
        raw_print()(_(""));
    }
    raw_print()(_(""));
    } finally { stack_pop($frame); }
}

export function dump_glyphids() { /* void */
    dump_all_glyphids(stdout);
}

/*allmain.c*/

import {
    AFTER_LAST_ARTIFACT, ART_CLEAVER, ART_DEMONBANE, ART_DRAGONBANE, ART_EXCALIBUR,
    ART_EYES_OF_THE_OVERWORLD, ART_EYE_OF_THE_AETHIOPICA, ART_FIRE_BRAND, ART_FROST_BRAND,
    ART_GIANTSLAYER, ART_GRAYSWANDIR, ART_GRIMTOOTH, ART_HEART_OF_AHRIMAN, ART_LONGBOW_OF_DIANA,
    ART_MAGICBANE, ART_MAGIC_MIRROR_OF_MERLIN, ART_MASTER_KEY_OF_THIEVERY, ART_MITRE_OF_HOLINESS,
    ART_MJOLLNIR, ART_NONARTIFACT, ART_OGRESMASHER, ART_ORB_OF_DETECTION, ART_ORB_OF_FATE,
    ART_ORCRIST, ART_SCEPTRE_OF_MIGHT, ART_SNICKERSNEE, ART_STAFF_OF_AESCULAPIUS, ART_STING,
    ART_STORMBRINGER, ART_SUNSWORD, ART_TROLLSBANE, ART_TSURUGI_OF_MURAMASA, ART_VORPAL_BLADE,
    ART_WEREBANE, ART_YENDORIAN_EXPRESS_CARD,
} from "./artilist.h.js";
import {
    AMULET_CLASS, AMULET_SYM, ARMOR_CLASS, ARMOR_SYM, BALL_CLASS, BALL_SYM, CHAIN_CLASS, CHAIN_SYM,
    COIN_CLASS, DEF_ANGEL, DEF_ANT, DEF_BAT, DEF_BLOB, DEF_CENTAUR, DEF_COCKATRICE, DEF_DEMON,
    DEF_DOG, DEF_DRAGON, DEF_EEL, DEF_ELEMENTAL, DEF_EYE, DEF_FELINE, DEF_FUNGUS, DEF_GHOST,
    DEF_GIANT, DEF_GNOME, DEF_GOLEM, DEF_GREMLIN, DEF_HUMAN, DEF_HUMANOID, DEF_IMP, DEF_INVISIBLE,
    DEF_JABBERWOCK, DEF_JELLY, DEF_KOBOLD, DEF_KOP, DEF_LEPRECHAUN, DEF_LICH, DEF_LIGHT, DEF_LIZARD,
    DEF_MIMIC, DEF_MIMIC_DEF, DEF_MUMMY, DEF_NAGA, DEF_NYMPH, DEF_OGRE, DEF_ORC, DEF_PIERCER,
    DEF_PUDDING, DEF_QUADRUPED, DEF_QUANTMECH, DEF_RODENT, DEF_RUSTMONST, DEF_SNAKE, DEF_SPIDER,
    DEF_TRAPPER, DEF_TROLL, DEF_UMBER, DEF_UNICORN, DEF_VAMPIRE, DEF_VORTEX, DEF_WORM,
    DEF_WORM_TAIL, DEF_WRAITH, DEF_XAN, DEF_XORN, DEF_YETI, DEF_ZOMBIE, DEF_ZRUTY, FOOD_CLASS,
    FOOD_SYM, GEM_CLASS, GEM_SYM, GOLD_SYM, ILLOBJ_CLASS, ILLOBJ_SYM, MAXMCLASSES, MAXOCLASSES,
    MAXPCHARS, POTION_CLASS, POTION_SYM, RING_CLASS, RING_SYM, ROCK_CLASS, ROCK_SYM, SCROLL_CLASS,
    SCROLL_SYM, SPBOOK_CLASS, SPBOOK_SYM, S_ANGEL, S_ANT, S_BAT, S_BLOB, S_CENTAUR, S_COCKATRICE,
    S_DEMON, S_DOG, S_DRAGON, S_EEL, S_ELEMENTAL, S_EYE, S_FELINE, S_FUNGUS, S_GHOST, S_GIANT,
    S_GNOME, S_GOLEM, S_GREMLIN, S_HUMAN, S_HUMANOID, S_IMP, S_JABBERWOCK, S_JELLY, S_KOBOLD, S_KOP,
    S_LEPRECHAUN, S_LICH, S_LIGHT, S_LIZARD, S_MIMIC, S_MIMIC_DEF, S_MUMMY, S_NAGA, S_NYMPH, S_OGRE,
    S_ORC, S_PIERCER, S_PUDDING, S_QUADRUPED, S_QUANTMECH, S_RODENT, S_RUSTMONST, S_SNAKE, S_SPIDER,
    S_TRAPPER, S_TROLL, S_UMBER, S_UNICORN, S_VAMPIRE, S_VORTEX, S_WORM, S_WORM_TAIL, S_WRAITH,
    S_XAN, S_XORN, S_YETI, S_ZOMBIE, S_ZRUTY, S_air, S_altar, S_amulet, S_anti_magic_trap, S_armor,
    S_arrow_trap, S_ball, S_bars, S_bear_trap, S_blcorn, S_book, S_boomleft, S_boomright, S_brcorn,
    S_brdnladder, S_brdnstair, S_brupladder, S_brupstair, S_chain, S_cloud, S_coin, S_corr,
    S_crwall, S_darkroom, S_dart_trap, S_digbeam, S_dnladder, S_dnstair, S_engrcorr, S_engroom,
    S_expl_bc, S_expl_bl, S_expl_br, S_expl_mc, S_expl_ml, S_expl_mr, S_expl_tc, S_expl_tl,
    S_expl_tr, S_falling_rock_trap, S_fire_trap, S_flashbeam, S_food, S_fountain, S_gem, S_goodpos,
    S_grave, S_hbeam, S_hcdbridge, S_hcdoor, S_hodbridge, S_hodoor, S_hole, S_hwall, S_ice,
    S_invisible, S_land_mine, S_lava, S_lavawall, S_level_teleporter, S_litcorr, S_lslant,
    S_magic_portal, S_magic_trap, S_ndoor, S_pit, S_poisoncloud, S_polymorph_trap, S_pool, S_potion,
    S_ring, S_rock, S_rolling_boulder_trap, S_room, S_rslant, S_rust_trap, S_scroll, S_sink,
    S_sleeping_gas_trap, S_spiked_pit, S_squeaky_board, S_ss1, S_ss2, S_ss3, S_ss4, S_statue_trap,
    S_stone, S_strange_obj, S_sw_bc, S_sw_bl, S_sw_br, S_sw_ml, S_sw_mr, S_sw_tc, S_sw_tl, S_sw_tr,
    S_tdwall, S_teleportation_trap, S_throne, S_tlcorn, S_tlwall, S_tool, S_trap_door,
    S_trapped_chest, S_trapped_door, S_trcorn, S_tree, S_trwall, S_tuwall, S_upladder, S_upstair,
    S_vbeam, S_vcdbridge, S_vcdoor, S_venom, S_vibrating_square, S_vodbridge, S_vodoor, S_vwall,
    S_wand, S_water, S_weapon, S_web, TOOL_CLASS, TOOL_SYM, VENOM_CLASS, VENOM_SYM, WAND_CLASS,
    WAND_SYM, WEAPON_CLASS, WEAPON_SYM,
} from "./defsym.h.js";
import { MAX_GLYPH } from "./display.h.js";
import { BUFSZ, FALSE, TRUE, USAGEHELP } from "./global.h.js";
import {
    ARG_DEBUG, ARG_DUMPENUMS, ARG_DUMPGLYPHIDS, ARG_DUMPMONGEN, ARG_DUMPWEIGHTS, ARG_SHOWPATHS,
    ARG_VERSION, struct_early_opt, struct_enum_dump,
} from "./hack.h.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { nhStr } from "./lint.h.macros.js";
import {
    MCAST_DUMPENUM_AGGRAVATION, MCAST_DUMPENUM_BLIND_YOU, MCAST_DUMPENUM_CLONE_WIZ,
    MCAST_DUMPENUM_CONFUSE_YOU, MCAST_DUMPENUM_CURE_SELF, MCAST_DUMPENUM_CURSE_ITEMS,
    MCAST_DUMPENUM_DEATH_TOUCH, MCAST_DUMPENUM_DESTRY_ARMR, MCAST_DUMPENUM_DISAPPEAR,
    MCAST_DUMPENUM_FIRE_PILLAR, MCAST_DUMPENUM_GEYSER, MCAST_DUMPENUM_HASTE_SELF,
    MCAST_DUMPENUM_INSECTS, MCAST_DUMPENUM_LIGHTNING, MCAST_DUMPENUM_OPEN_WOUNDS,
    MCAST_DUMPENUM_PARALYZE, MCAST_DUMPENUM_PSI_BOLT, MCAST_DUMPENUM_STUN_YOU,
    MCAST_DUMPENUM_SUMMON_MONS, MCAST_DUMPENUM_WEAKEN_YOU,
} from "./mcastu.h.js";
import {
    HIGH_PM, LOW_PM, NON_PM, NUMMONS, PM_ABBOT, PM_ACID_BLOB, PM_ACOLYTE, PM_AIR_ELEMENTAL,
    PM_ALEAX, PM_ALIGNED_CLERIC, PM_AMOROUS_DEMON, PM_ANGEL, PM_APE, PM_APPRENTICE, PM_ARCHEOLOGIST,
    PM_ARCHON, PM_ARCH_LICH, PM_ARCH_PRIEST, PM_ASHIKAGA_TAKAUJI, PM_ASMODEUS, PM_ATTENDANT,
    PM_BAALZEBUB, PM_BABY_BLACK_DRAGON, PM_BABY_BLUE_DRAGON, PM_BABY_CROCODILE, PM_BABY_GOLD_DRAGON,
    PM_BABY_GRAY_DRAGON, PM_BABY_GREEN_DRAGON, PM_BABY_LONG_WORM, PM_BABY_ORANGE_DRAGON,
    PM_BABY_PURPLE_WORM, PM_BABY_RED_DRAGON, PM_BABY_SILVER_DRAGON, PM_BABY_WHITE_DRAGON,
    PM_BABY_YELLOW_DRAGON, PM_BALROG, PM_BALUCHITHERIUM, PM_BARBARIAN, PM_BARBED_DEVIL,
    PM_BARROW_WIGHT, PM_BAT, PM_BLACK_DRAGON, PM_BLACK_LIGHT, PM_BLACK_NAGA,
    PM_BLACK_NAGA_HATCHLING, PM_BLACK_PUDDING, PM_BLACK_UNICORN, PM_BLUE_DRAGON, PM_BLUE_JELLY,
    PM_BONE_DEVIL, PM_BROWN_MOLD, PM_BROWN_PUDDING, PM_BUGBEAR, PM_CAPTAIN, PM_CARNIVOROUS_APE,
    PM_CAVE_DWELLER, PM_CAVE_SPIDER, PM_CENTIPEDE, PM_CHAMELEON, PM_CHICKATRICE, PM_CHIEFTAIN,
    PM_CHROMATIC_DRAGON, PM_CLAY_GOLEM, PM_CLERIC, PM_COBRA, PM_COCKATRICE, PM_COUATL, PM_COYOTE,
    PM_CROCODILE, PM_CROESUS, PM_CYCLOPS, PM_DARK_ONE, PM_DEATH, PM_DEMILICH, PM_DEMOGORGON,
    PM_DINGO, PM_DISENCHANTER, PM_DISPATER, PM_DISPLACER_BEAST, PM_DJINNI, PM_DOG, PM_DOPPELGANGER,
    PM_DUST_VORTEX, PM_DWARF, PM_DWARF_LEADER, PM_DWARF_MUMMY, PM_DWARF_RULER, PM_DWARF_ZOMBIE,
    PM_EARTH_ELEMENTAL, PM_ELECTRIC_EEL, PM_ELF, PM_ELF_MUMMY, PM_ELF_NOBLE, PM_ELF_ZOMBIE,
    PM_ELVEN_MONARCH, PM_ENERGY_VORTEX, PM_ERINYS, PM_ETTIN, PM_ETTIN_MUMMY, PM_ETTIN_ZOMBIE,
    PM_FAMINE, PM_FIRE_ANT, PM_FIRE_ELEMENTAL, PM_FIRE_GIANT, PM_FIRE_VORTEX, PM_FLAMING_SPHERE,
    PM_FLESH_GOLEM, PM_FLOATING_EYE, PM_FOG_CLOUD, PM_FOREST_CENTAUR, PM_FOX, PM_FREEZING_SPHERE,
    PM_FROST_GIANT, PM_GARGOYLE, PM_GARTER_SNAKE, PM_GAS_SPORE, PM_GECKO, PM_GELATINOUS_CUBE,
    PM_GENETIC_ENGINEER, PM_GERYON, PM_GHOST, PM_GHOUL, PM_GIANT, PM_GIANT_ANT, PM_GIANT_BAT,
    PM_GIANT_BEETLE, PM_GIANT_EEL, PM_GIANT_MIMIC, PM_GIANT_MUMMY, PM_GIANT_RAT, PM_GIANT_SPIDER,
    PM_GIANT_ZOMBIE, PM_GLASS_GOLEM, PM_GLASS_PIERCER, PM_GNOME, PM_GNOME_LEADER, PM_GNOME_MUMMY,
    PM_GNOME_RULER, PM_GNOME_ZOMBIE, PM_GNOMISH_WIZARD, PM_GOBLIN, PM_GOLDEN_NAGA,
    PM_GOLDEN_NAGA_HATCHLING, PM_GOLD_DRAGON, PM_GOLD_GOLEM, PM_GRAND_MASTER, PM_GRAY_DRAGON,
    PM_GRAY_OOZE, PM_GRAY_UNICORN, PM_GREEN_DRAGON, PM_GREEN_ELF, PM_GREEN_MOLD, PM_GREEN_SLIME,
    PM_GREMLIN, PM_GREY_ELF, PM_GRID_BUG, PM_GUARD, PM_GUARDIAN_NAGA, PM_GUARDIAN_NAGA_HATCHLING,
    PM_GUIDE, PM_HEALER, PM_HELL_HOUND, PM_HELL_HOUND_PUP, PM_HEZROU, PM_HIGH_CLERIC, PM_HILL_GIANT,
    PM_HILL_ORC, PM_HIPPOCRATES, PM_HOBBIT, PM_HOBGOBLIN, PM_HOMUNCULUS, PM_HORNED_DEVIL, PM_HORSE,
    PM_HOUSECAT, PM_HUMAN, PM_HUMAN_MUMMY, PM_HUMAN_WEREJACKAL, PM_HUMAN_WERERAT, PM_HUMAN_WEREWOLF,
    PM_HUMAN_ZOMBIE, PM_HUNTER, PM_ICE_DEVIL, PM_ICE_TROLL, PM_ICE_VORTEX, PM_IGUANA, PM_IMP,
    PM_IRON_GOLEM, PM_IRON_PIERCER, PM_IXOTH, PM_JABBERWOCK, PM_JACKAL, PM_JAGUAR, PM_JELLYFISH,
    PM_JUIBLEX, PM_KEYSTONE_KOP, PM_KILLER_BEE, PM_KING_ARTHUR, PM_KITTEN, PM_KI_RIN, PM_KNIGHT,
    PM_KOBOLD, PM_KOBOLD_LEADER, PM_KOBOLD_MUMMY, PM_KOBOLD_SHAMAN, PM_KOBOLD_ZOMBIE,
    PM_KOP_KAPTAIN, PM_KOP_LIEUTENANT, PM_KOP_SERGEANT, PM_KRAKEN, PM_LARGE_CAT, PM_LARGE_DOG,
    PM_LARGE_KOBOLD, PM_LARGE_MIMIC, PM_LEATHER_GOLEM, PM_LEMURE, PM_LEOCROTTA, PM_LEPRECHAUN,
    PM_LICH, PM_LICHEN, PM_LIEUTENANT, PM_LITTLE_DOG, PM_LIZARD, PM_LONG_WORM, PM_LONG_WORM_TAIL,
    PM_LORD_CARNARVON, PM_LORD_SATO, PM_LORD_SURTUR, PM_LURKER_ABOVE, PM_LYNX, PM_MAIL_DAEMON,
    PM_MANES, PM_MARILITH, PM_MASTER_ASSASSIN, PM_MASTER_KAEN, PM_MASTER_LICH,
    PM_MASTER_MIND_FLAYER, PM_MASTER_OF_THIEVES, PM_MASTODON, PM_MEDUSA, PM_MIND_FLAYER,
    PM_MINION_OF_HUHETOTL, PM_MINOTAUR, PM_MONK, PM_MONKEY, PM_MORDOR_ORC, PM_MOUNTAIN_CENTAUR,
    PM_MOUNTAIN_NYMPH, PM_MUMAK, PM_NALFESHNEE, PM_NALZOK, PM_NAZGUL, PM_NEANDERTHAL,
    PM_NEFERET_THE_GREEN, PM_NEWT, PM_NINJA, PM_NORN, PM_NURSE, PM_OCHRE_JELLY, PM_OGRE,
    PM_OGRE_LEADER, PM_OGRE_TYRANT, PM_OLOG_HAI, PM_ORACLE, PM_ORANGE_DRAGON, PM_ORC, PM_ORCUS,
    PM_ORC_CAPTAIN, PM_ORC_MUMMY, PM_ORC_SHAMAN, PM_ORC_ZOMBIE, PM_ORION, PM_OWLBEAR, PM_PAGE,
    PM_PANTHER, PM_PAPER_GOLEM, PM_PELIAS, PM_PESTILENCE, PM_PIRANHA, PM_PIT_FIEND, PM_PIT_VIPER,
    PM_PLAINS_CENTAUR, PM_PONY, PM_PRISONER, PM_PURPLE_WORM, PM_PYROLISK, PM_PYTHON,
    PM_QUANTUM_MECHANIC, PM_QUASIT, PM_QUEEN_BEE, PM_QUIVERING_BLOB, PM_RABID_RAT, PM_RANGER,
    PM_RAVEN, PM_RED_DRAGON, PM_RED_MOLD, PM_RED_NAGA, PM_RED_NAGA_HATCHLING, PM_ROCK_MOLE,
    PM_ROCK_PIERCER, PM_ROCK_TROLL, PM_ROGUE, PM_ROPE_GOLEM, PM_ROSHI, PM_ROTHE, PM_RUST_MONSTER,
    PM_SALAMANDER, PM_SAMURAI, PM_SANDESTIN, PM_SASQUATCH, PM_SCORPION, PM_SCORPIUS, PM_SERGEANT,
    PM_SEWER_RAT, PM_SHADE, PM_SHAMAN_KARNOV, PM_SHARK, PM_SHOCKING_SPHERE, PM_SHOPKEEPER,
    PM_SHRIEKER, PM_SILVER_DRAGON, PM_SKELETON, PM_SMALL_MIMIC, PM_SNAKE, PM_SOLDIER,
    PM_SOLDIER_ANT, PM_SPOTTED_JELLY, PM_STALKER, PM_STEAM_VORTEX, PM_STONE_GIANT, PM_STONE_GOLEM,
    PM_STORM_GIANT, PM_STRAW_GOLEM, PM_STUDENT, PM_TENGU, PM_THOTH_AMON, PM_THUG, PM_TIGER,
    PM_TITAN, PM_TITANOTHERE, PM_TOURIST, PM_TRAPPER, PM_TROLL, PM_TWOFLOWER, PM_UMBER_HULK,
    PM_URUK_HAI, PM_VALKYRIE, PM_VAMPIRE, PM_VAMPIRE_BAT, PM_VAMPIRE_LEADER, PM_VIOLET_FUNGUS,
    PM_VLAD_THE_IMPALER, PM_VROCK, PM_WARG, PM_WARHORSE, PM_WARRIOR, PM_WATCHMAN, PM_WATCH_CAPTAIN,
    PM_WATER_DEMON, PM_WATER_ELEMENTAL, PM_WATER_MOCCASIN, PM_WATER_NYMPH, PM_WATER_TROLL,
    PM_WEREJACKAL, PM_WERERAT, PM_WEREWOLF, PM_WHITE_DRAGON, PM_WHITE_UNICORN, PM_WINGED_GARGOYLE,
    PM_WINTER_WOLF, PM_WINTER_WOLF_CUB, PM_WIZARD, PM_WIZARD_OF_YENDOR, PM_WOLF, PM_WOODCHUCK,
    PM_WOODLAND_ELF, PM_WOOD_GOLEM, PM_WOOD_NYMPH, PM_WRAITH, PM_WUMPUS, PM_XAN, PM_XORN,
    PM_YEENOGHU, PM_YELLOW_DRAGON, PM_YELLOW_LIGHT, PM_YELLOW_MOLD, PM_YETI, PM_ZRUTY, SPECIAL_PM,
} from "./monsters.h.js";
import { MAXSPELL, NUM_GLASS_GEMS, NUM_REAL_GEMS } from "./objclass.h.js";
import {
    ACID_VENOM, AGATE, AKLYS, ALCHEMY_SMOCK, AMBER, AMETHYST, AMULET_OF_CHANGE, AMULET_OF_ESP,
    AMULET_OF_FLYING, AMULET_OF_GUARDING, AMULET_OF_LIFE_SAVING, AMULET_OF_MAGICAL_BREATHING,
    AMULET_OF_REFLECTION, AMULET_OF_RESTFUL_SLEEP, AMULET_OF_STRANGULATION, AMULET_OF_UNCHANGING,
    AMULET_OF_YENDOR, AMULET_VERSUS_POISON, APPLE, AQUAMARINE, ARROW, ATHAME, AXE, BAG_OF_HOLDING,
    BAG_OF_TRICKS, BANANA, BANDED_MAIL, BARDICHE, BATTLE_AXE, BEARTRAP, BEC_DE_CORBIN, BELL,
    BELL_OF_OPENING, BILL_GUISARME, BLACK_DRAGON_SCALES, BLACK_DRAGON_SCALE_MAIL, BLACK_OPAL,
    BLINDFOLD, BLINDING_VENOM, BLUE_DRAGON_SCALES, BLUE_DRAGON_SCALE_MAIL, BOOMERANG, BOULDER, BOW,
    BRASS_LANTERN, BROADSWORD, BRONZE_PLATE_MAIL, BUGLE, BULLWHIP, CANDELABRUM_OF_INVOCATION,
    CANDY_BAR, CAN_OF_GREASE, CARROT, CHAIN_MAIL, CHEST, CHRYSOBERYL, CITRINE,
    CLOAK_OF_DISPLACEMENT, CLOAK_OF_INVISIBILITY, CLOAK_OF_MAGIC_RESISTANCE, CLOAK_OF_PROTECTION,
    CLOVE_OF_GARLIC, CLUB, CORNUTHAUM, CORPSE, CRAM_RATION, CREAM_PIE, CREDIT_CARD, CROSSBOW,
    CROSSBOW_BOLT, CRYSKNIFE, CRYSTAL_BALL, CRYSTAL_PLATE_MAIL, C_RATION, DAGGER, DART, DENTED_POT,
    DIAMOND, DILITHIUM_CRYSTAL, DRUM_OF_EARTHQUAKE, DUNCE_CAP, DWARVISH_CLOAK, DWARVISH_IRON_HELM,
    DWARVISH_MATTOCK, DWARVISH_MITHRIL_COAT, DWARVISH_ROUNDSHIELD, DWARVISH_SHORT_SWORD,
    DWARVISH_SPEAR, EGG, ELVEN_ARROW, ELVEN_BOOTS, ELVEN_BOW, ELVEN_BROADSWORD, ELVEN_CLOAK,
    ELVEN_DAGGER, ELVEN_LEATHER_HELM, ELVEN_MITHRIL_COAT, ELVEN_SHIELD, ELVEN_SHORT_SWORD,
    ELVEN_SPEAR, EMERALD, ENORMOUS_MEATBALL, EUCALYPTUS_LEAF, EXPENSIVE_CAMERA,
    FAKE_AMULET_OF_YENDOR, FAUCHARD, FEDORA, FIGURINE, FIRE_HORN, FIRST_AMULET, FIRST_GLASS_GEM,
    FIRST_OBJECT, FIRST_REAL_GEM, FIRST_SPELL, FLAIL, FLINT, FLUORITE, FOOD_RATION, FORTUNE_COOKIE,
    FROST_HORN, FUMBLE_BOOTS, GARNET, GAUNTLETS_OF_DEXTERITY, GAUNTLETS_OF_FUMBLING,
    GAUNTLETS_OF_POWER, GENERIC_AMULET, GENERIC_ARMOR, GENERIC_BALL, GENERIC_CHAIN, GENERIC_COIN,
    GENERIC_FOOD, GENERIC_GEM, GENERIC_ILLOBJ, GENERIC_POTION, GENERIC_RING, GENERIC_ROCK,
    GENERIC_SCROLL, GENERIC_SPBOOK, GENERIC_TOOL, GENERIC_VENOM, GENERIC_WAND, GENERIC_WEAPON,
    GLAIVE, GLOB_OF_BLACK_PUDDING, GLOB_OF_BROWN_PUDDING, GLOB_OF_GRAY_OOZE, GLOB_OF_GREEN_SLIME,
    GOLD_DRAGON_SCALES, GOLD_DRAGON_SCALE_MAIL, GOLD_PIECE, GRAPPLING_HOOK, GRAY_DRAGON_SCALES,
    GRAY_DRAGON_SCALE_MAIL, GREEN_DRAGON_SCALES, GREEN_DRAGON_SCALE_MAIL, GUISARME, HALBERD,
    HAWAIIAN_SHIRT, HEAVY_IRON_BALL, HELMET, HELM_OF_BRILLIANCE, HELM_OF_CAUTION,
    HELM_OF_OPPOSITE_ALIGNMENT, HELM_OF_TELEPATHY, HIGH_BOOTS, HORN_OF_PLENTY, ICE_BOX, IRON_CHAIN,
    IRON_SHOES, JACINTH, JADE, JASPER, JAVELIN, JET, JUMPING_BOOTS, KATANA, KELP_FROND,
    KICKING_BOOTS, KNIFE, K_RATION, LANCE, LAND_MINE, LARGE_BOX, LARGE_SHIELD, LAST_AMULET,
    LAST_GENERIC, LAST_GLASS_GEM, LAST_REAL_GEM, LAST_SPELL, LEASH, LEATHER_ARMOR, LEATHER_CLOAK,
    LEATHER_DRUM, LEATHER_GLOVES, LEATHER_JACKET, LEMBAS_WAFER, LENSES, LEVITATION_BOOTS, LOADSTONE,
    LOCK_PICK, LONG_SWORD, LOW_BOOTS, LUCERN_HAMMER, LUCKSTONE, LUMP_OF_ROYAL_JELLY, MACE,
    MAGIC_FLUTE, MAGIC_HARP, MAGIC_LAMP, MAGIC_MARKER, MAGIC_WHISTLE, MEATBALL, MEAT_RING,
    MEAT_STICK, MELON, MIRROR, MORNING_STAR, MUMMY_WRAPPING, NUM_OBJECTS, OBJCLASS_HACK, OBSIDIAN,
    OILSKIN_CLOAK, OILSKIN_SACK, OIL_LAMP, OPAL, ORANGE, ORANGE_DRAGON_SCALES,
    ORANGE_DRAGON_SCALE_MAIL, ORCISH_ARROW, ORCISH_BOW, ORCISH_CHAIN_MAIL, ORCISH_CLOAK,
    ORCISH_DAGGER, ORCISH_HELM, ORCISH_RING_MAIL, ORCISH_SHIELD, ORCISH_SHORT_SWORD, ORCISH_SPEAR,
    PANCAKE, PARTISAN, PEAR, PICK_AXE, PLATE_MAIL, POT_ACID, POT_BLINDNESS, POT_BOOZE,
    POT_CONFUSION, POT_ENLIGHTENMENT, POT_EXTRA_HEALING, POT_FRUIT_JUICE, POT_FULL_HEALING,
    POT_GAIN_ABILITY, POT_GAIN_ENERGY, POT_GAIN_LEVEL, POT_HALLUCINATION, POT_HEALING,
    POT_INVISIBILITY, POT_LEVITATION, POT_MONSTER_DETECTION, POT_OBJECT_DETECTION, POT_OIL,
    POT_PARALYSIS, POT_POLYMORPH, POT_RESTORE_ABILITY, POT_SEE_INVISIBLE, POT_SICKNESS,
    POT_SLEEPING, POT_SPEED, POT_WATER, QUARTERSTAFF, RANSEUR, RED_DRAGON_SCALES,
    RED_DRAGON_SCALE_MAIL, RING_MAIL, RIN_ADORNMENT, RIN_AGGRAVATE_MONSTER, RIN_COLD_RESISTANCE,
    RIN_CONFLICT, RIN_FIRE_RESISTANCE, RIN_FREE_ACTION, RIN_GAIN_CONSTITUTION, RIN_GAIN_STRENGTH,
    RIN_HUNGER, RIN_INCREASE_ACCURACY, RIN_INCREASE_DAMAGE, RIN_INVISIBILITY, RIN_LEVITATION,
    RIN_POISON_RESISTANCE, RIN_POLYMORPH, RIN_POLYMORPH_CONTROL, RIN_PROTECTION,
    RIN_PROTECTION_FROM_SHAPE_CHAN, RIN_REGENERATION, RIN_SEARCHING, RIN_SEE_INVISIBLE,
    RIN_SHOCK_RESISTANCE, RIN_SLOW_DIGESTION, RIN_STEALTH, RIN_SUSTAIN_ABILITY, RIN_TELEPORTATION,
    RIN_TELEPORT_CONTROL, RIN_WARNING, ROBE, ROCK, RUBBER_HOSE, RUBY, RUNESWORD, SACK, SADDLE,
    SAPPHIRE, SC01, SC02, SC03, SC04, SC05, SC06, SC07, SC08, SC09, SC10, SC11, SC12, SC13, SC14,
    SC15, SC16, SC17, SC18, SC19, SC20, SCALE_MAIL, SCALPEL, SCIMITAR, SCR_AMNESIA, SCR_BLANK_PAPER,
    SCR_CHARGING, SCR_CONFUSE_MONSTER, SCR_CREATE_MONSTER, SCR_DESTROY_ARMOR, SCR_EARTH,
    SCR_ENCHANT_ARMOR, SCR_ENCHANT_WEAPON, SCR_FIRE, SCR_FOOD_DETECTION, SCR_GENOCIDE,
    SCR_GOLD_DETECTION, SCR_IDENTIFY, SCR_LIGHT, SCR_MAGIC_MAPPING, SCR_MAIL, SCR_PUNISHMENT,
    SCR_REMOVE_CURSE, SCR_SCARE_MONSTER, SCR_STINKING_CLOUD, SCR_TAMING, SCR_TELEPORTATION,
    SHIELD_OF_DRAIN_RESISTANCE, SHIELD_OF_REFLECTION, SHIELD_OF_SHOCK_RESISTANCE, SHORT_SWORD,
    SHURIKEN, SILVER_ARROW, SILVER_DAGGER, SILVER_DRAGON_SCALES, SILVER_DRAGON_SCALE_MAIL,
    SILVER_MACE, SILVER_SABER, SILVER_SPEAR, SKELETON_KEY, SLIME_MOLD, SLING, SMALL_SHIELD, SPEAR,
    SPEED_BOOTS, SPETUM, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_CANCELLATION, SPE_CAUSE_FEAR,
    SPE_CHAIN_LIGHTNING, SPE_CHARM_MONSTER, SPE_CLAIRVOYANCE, SPE_CONE_OF_COLD, SPE_CONFUSE_MONSTER,
    SPE_CREATE_FAMILIAR, SPE_CREATE_MONSTER, SPE_CURE_BLINDNESS, SPE_CURE_SICKNESS, SPE_DETECT_FOOD,
    SPE_DETECT_MONSTERS, SPE_DETECT_TREASURE, SPE_DETECT_UNSEEN, SPE_DIG, SPE_DRAIN_LIFE,
    SPE_EXTRA_HEALING, SPE_FINGER_OF_DEATH, SPE_FIREBALL, SPE_FORCE_BOLT, SPE_HASTE_SELF,
    SPE_HEALING, SPE_IDENTIFY, SPE_INVISIBILITY, SPE_JUMPING, SPE_KNOCK, SPE_LEVITATION, SPE_LIGHT,
    SPE_MAGIC_MAPPING, SPE_MAGIC_MISSILE, SPE_NOVEL, SPE_POLYMORPH, SPE_PROTECTION,
    SPE_REMOVE_CURSE, SPE_RESTORE_ABILITY, SPE_SLEEP, SPE_SLOW_MONSTER, SPE_STONE_TO_FLESH,
    SPE_TELEPORT_AWAY, SPE_TURN_UNDEAD, SPE_WIZARD_LOCK, SPLINT_MAIL, SPRIG_OF_WOLFSBANE, STATUE,
    STETHOSCOPE, STILETTO, STRANGE_OBJECT, STUDDED_LEATHER_ARMOR, TALLOW_CANDLE, TIN, TINNING_KIT,
    TIN_OPENER, TIN_WHISTLE, TOOLED_HORN, TOPAZ, TOUCHSTONE, TOWEL, TRIDENT, TRIPE_RATION, TSURUGI,
    TURQUOISE, TWO_HANDED_SWORD, T_SHIRT, UNICORN_HORN, URUK_HAI_SHIELD, VOULGE, WAN1, WAN2, WAN3,
    WAN_CANCELLATION, WAN_COLD, WAN_CREATE_MONSTER, WAN_DEATH, WAN_DIGGING, WAN_ENLIGHTENMENT,
    WAN_FIRE, WAN_LIGHT, WAN_LIGHTNING, WAN_LOCKING, WAN_MAGIC_MISSILE, WAN_MAKE_INVISIBLE,
    WAN_NOTHING, WAN_OPENING, WAN_POLYMORPH, WAN_PROBING, WAN_SECRET_DOOR_DETECTION, WAN_SLEEP,
    WAN_SLOW_MONSTER, WAN_SPEED_MONSTER, WAN_STASIS, WAN_STRIKING, WAN_TELEPORTATION,
    WAN_UNDEAD_TURNING, WAN_WISHING, WAR_HAMMER, WATER_WALKING_BOOTS, WAX_CANDLE,
    WHITE_DRAGON_SCALES, WHITE_DRAGON_SCALE_MAIL, WOODEN_FLUTE, WOODEN_HARP, WORM_TOOTH,
    WORTHLESS_BLACK_GLASS, WORTHLESS_BLUE_GLASS, WORTHLESS_GREEN_GLASS, WORTHLESS_ORANGE_GLASS,
    WORTHLESS_RED_GLASS, WORTHLESS_VIOLET_GLASS, WORTHLESS_WHITE_GLASS, WORTHLESS_YELLOWBROWN_GLASS,
    WORTHLESS_YELLOW_GLASS, YA, YELLOW_DRAGON_SCALES, YELLOW_DRAGON_SCALE_MAIL, YUMI,
} from "./objects.h.js";
import { raw_print } from "./winprocs.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, sizeof, sizeof_string, uchar, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import {
    EXIT_SUCCESS, __isspace, free, stdout, strchr, strcmp, strlen, strncmp,
} from "../rt/libc.js";
import { init_string, stack_array, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { array_of, ptr_add, ptr_to, ref_add, struct } from "../rt/struct.js";
import { dupstr } from "./alloc.js";
import { config_error_add, config_error_done, config_error_init } from "./cfgfiles.js";
import { gc, gd, iflags, program_state } from "./decl.js";
import { nh_terminate } from "./end.js";
import { dump_all_glyphids } from "./glyphs.js";
import { dump_weights } from "./hack.js";
import { eos, strncmpi } from "./hacklib.js";
import { dump_mongen } from "./makemon.js";
import { initoptions, match_optname } from "./options.js";
import { raw_printf } from "./pline.js";
import { prscore } from "./topten.js";
import { dump_version_info, early_version_info } from "./version.js";
import { genl_display_file } from "./windows.js";
import { error } from "../sys/c2js/nhjs_host.js";
import { chdirx, whoami } from "../sys/unix/unixmain.js";

// the records of monsdump[] from monsters.h, laid out like it
function monsdump_records() {
    return [
    { val: PM_GIANT_ANT, nm: _("GIANT_ANT") },
    { val: PM_KILLER_BEE, nm: _("KILLER_BEE") },
    { val: PM_SOLDIER_ANT, nm: _("SOLDIER_ANT") },
    { val: PM_FIRE_ANT, nm: _("FIRE_ANT") },
    { val: PM_GIANT_BEETLE, nm: _("GIANT_BEETLE") },
    { val: PM_QUEEN_BEE, nm: _("QUEEN_BEE") },
    /*
     * blobs
     */
    { val: PM_ACID_BLOB, nm: _("ACID_BLOB") },
    { val: PM_QUIVERING_BLOB, nm: _("QUIVERING_BLOB") },
    { val: PM_GELATINOUS_CUBE, nm: _("GELATINOUS_CUBE") },
    /*
     * cockatrice
     */
    { val: PM_CHICKATRICE, nm: _("CHICKATRICE") },
    { val: PM_COCKATRICE, nm: _("COCKATRICE") },
    { val: PM_PYROLISK, nm: _("PYROLISK") },
    /*
     * dogs & other canines
     */
    { val: PM_JACKAL, nm: _("JACKAL") },
    { val: PM_FOX, nm: _("FOX") },
    { val: PM_COYOTE, nm: _("COYOTE") },
    { val: PM_WEREJACKAL, nm: _("WEREJACKAL") },
    { val: PM_LITTLE_DOG, nm: _("LITTLE_DOG") },
    { val: PM_DINGO, nm: _("DINGO") },
    { val: PM_DOG, nm: _("DOG") },
    { val: PM_LARGE_DOG, nm: _("LARGE_DOG") },
    { val: PM_WOLF, nm: _("WOLF") },
    /* werewolf in wolf form; one in human form uses a different monster
       type (in the S_HUMAN section below); switching back and forth is
       a shape-change that sets monst->data to the appropriate monster */
    { val: PM_WEREWOLF, nm: _("WEREWOLF") },
    { val: PM_WINTER_WOLF_CUB, nm: _("WINTER_WOLF_CUB") },
    { val: PM_WARG, nm: _("WARG") },
    { val: PM_WINTER_WOLF, nm: _("WINTER_WOLF") },
    { val: PM_HELL_HOUND_PUP, nm: _("HELL_HOUND_PUP") },
    { val: PM_HELL_HOUND, nm: _("HELL_HOUND") },

    /*
     * eyes
     */
    { val: PM_GAS_SPORE, nm: _("GAS_SPORE") },
    { val: PM_FLOATING_EYE, nm: _("FLOATING_EYE") },
    { val: PM_FREEZING_SPHERE, nm: _("FREEZING_SPHERE") },
    { val: PM_FLAMING_SPHERE, nm: _("FLAMING_SPHERE") },
    { val: PM_SHOCKING_SPHERE, nm: _("SHOCKING_SPHERE") },

    /*
     * felines
     */
    { val: PM_KITTEN, nm: _("KITTEN") },
    { val: PM_HOUSECAT, nm: _("HOUSECAT") },
    { val: PM_JAGUAR, nm: _("JAGUAR") },
    { val: PM_LYNX, nm: _("LYNX") },
    { val: PM_PANTHER, nm: _("PANTHER") },
    { val: PM_LARGE_CAT, nm: _("LARGE_CAT") },
    { val: PM_TIGER, nm: _("TIGER") },
    { val: PM_DISPLACER_BEAST, nm: _("DISPLACER_BEAST") },
    /*
     * gremlins and gargoyles
     */
    { val: PM_GREMLIN, nm: _("GREMLIN") },
    /* gargoyle and winged gargoyle are inspired by a cheesy made-for-TV
       horror movie (starring Cornel Wilde and Jennifer Salt 1972) */
    { val: PM_GARGOYLE, nm: _("GARGOYLE") },
    { val: PM_WINGED_GARGOYLE, nm: _("WINGED_GARGOYLE") },
    /*
     * humanoids
     */
    { val: PM_HOBBIT, nm: _("HOBBIT") },
    /* unlike plain human|elf|orc plain "dwarf" is an ordinary monster */
    { val: PM_DWARF, nm: _("DWARF") },
    { val: PM_BUGBEAR, nm: _("BUGBEAR") },
    { val: PM_DWARF_LEADER, nm: _("DWARF_LEADER") },
    { val: PM_DWARF_RULER, nm: _("DWARF_RULER") },
    { val: PM_MIND_FLAYER, nm: _("MIND_FLAYER") },
    { val: PM_MASTER_MIND_FLAYER, nm: _("MASTER_MIND_FLAYER") },
    /*
     * imps & other minor demons/devils
     */
    { val: PM_MANES, nm: _("MANES") },
    { val: PM_HOMUNCULUS, nm: _("HOMUNCULUS") },
    { val: PM_IMP, nm: _("IMP") },
    { val: PM_LEMURE, nm: _("LEMURE") },
    { val: PM_QUASIT, nm: _("QUASIT") },
    { val: PM_TENGU, nm: _("TENGU") },
    /*
     * jellies
     */
    { val: PM_BLUE_JELLY, nm: _("BLUE_JELLY") },
    { val: PM_SPOTTED_JELLY, nm: _("SPOTTED_JELLY") },
    { val: PM_OCHRE_JELLY, nm: _("OCHRE_JELLY") },
    /*
     * kobolds
     */
    { val: PM_KOBOLD, nm: _("KOBOLD") },
    { val: PM_LARGE_KOBOLD, nm: _("LARGE_KOBOLD") },
    { val: PM_KOBOLD_LEADER, nm: _("KOBOLD_LEADER") },
    { val: PM_KOBOLD_SHAMAN, nm: _("KOBOLD_SHAMAN") },
    /*
     * leprechauns
     */
    { val: PM_LEPRECHAUN, nm: _("LEPRECHAUN") },
    /*
     * mimics
     */
    { val: PM_SMALL_MIMIC, nm: _("SMALL_MIMIC") },
    { val: PM_LARGE_MIMIC, nm: _("LARGE_MIMIC") },
    { val: PM_GIANT_MIMIC, nm: _("GIANT_MIMIC") },
    /*
     * nymphs
     */
    { val: PM_WOOD_NYMPH, nm: _("WOOD_NYMPH") },
    { val: PM_WATER_NYMPH, nm: _("WATER_NYMPH") },
    { val: PM_MOUNTAIN_NYMPH, nm: _("MOUNTAIN_NYMPH") },
    /*
     * orcs
     */
    { val: PM_GOBLIN, nm: _("GOBLIN") },
    { val: PM_HOBGOBLIN, nm: _("HOBGOBLIN") },
    /* Plain "orc" for zombie and mummy corpses only; not created at random.
     * Orcs (but not goblins and hobgoblins) are granted poison resistance;
     * however their corpses don't confer it. */
    { val: PM_ORC, nm: _("ORC") },
    { val: PM_HILL_ORC, nm: _("HILL_ORC") },
    { val: PM_MORDOR_ORC, nm: _("MORDOR_ORC") },
    { val: PM_URUK_HAI, nm: _("URUK_HAI") },
    { val: PM_ORC_SHAMAN, nm: _("ORC_SHAMAN") },
    { val: PM_ORC_CAPTAIN, nm: _("ORC_CAPTAIN") },
    /*
     * piercers
     */
    { val: PM_ROCK_PIERCER, nm: _("ROCK_PIERCER") },
    { val: PM_IRON_PIERCER, nm: _("IRON_PIERCER") },
    { val: PM_GLASS_PIERCER, nm: _("GLASS_PIERCER") },
    /*
     * quadrupeds
     *  (note: horses are grouped with unicorns in another section below)
     */
    { val: PM_ROTHE, nm: _("ROTHE") },
    { val: PM_MUMAK, nm: _("MUMAK") },
    { val: PM_LEOCROTTA, nm: _("LEOCROTTA") },
    { val: PM_WUMPUS, nm: _("WUMPUS") },
    { val: PM_TITANOTHERE, nm: _("TITANOTHERE") },
    { val: PM_BALUCHITHERIUM, nm: _("BALUCHITHERIUM") },
    { val: PM_MASTODON, nm: _("MASTODON") },
    /*
     * rodents
     */
    { val: PM_SEWER_RAT, nm: _("SEWER_RAT") },
    { val: PM_GIANT_RAT, nm: _("GIANT_RAT") },
    { val: PM_RABID_RAT, nm: _("RABID_RAT") },
    { val: PM_WERERAT, nm: _("WERERAT") },
    { val: PM_ROCK_MOLE, nm: _("ROCK_MOLE") },
    { val: PM_WOODCHUCK, nm: _("WOODCHUCK") },
    /*
     * spiders & scorpions (keep webmaker() in sync if new critters are added)
     */
    { val: PM_CAVE_SPIDER, nm: _("CAVE_SPIDER") },
    { val: PM_CENTIPEDE, nm: _("CENTIPEDE") },
    { val: PM_GIANT_SPIDER, nm: _("GIANT_SPIDER") },
    { val: PM_SCORPION, nm: _("SCORPION") },
    /*
     * trappers lurkers &c
     * Note:  prior to 5.0 these were defined to do AD_DGST damage
     * but they don't swallow their victims into their stomachs and
     * digest they enfold and crush or suffocate.
     * The Monster Manual states that someone engulfed by a trapper
     * can't use weapons but we do not enforce that.
     */
    { val: PM_LURKER_ABOVE, nm: _("LURKER_ABOVE") },
    { val: PM_TRAPPER, nm: _("TRAPPER") },
    /*
     * unicorns and horses
     */
    { val: PM_PONY, nm: _("PONY") },
    { val: PM_WHITE_UNICORN, nm: _("WHITE_UNICORN") },
    { val: PM_GRAY_UNICORN, nm: _("GRAY_UNICORN") },
    { val: PM_BLACK_UNICORN, nm: _("BLACK_UNICORN") },
    { val: PM_HORSE, nm: _("HORSE") },
    { val: PM_WARHORSE, nm: _("WARHORSE") },
    /*
     * vortices
     */
    { val: PM_FOG_CLOUD, nm: _("FOG_CLOUD") },
    { val: PM_DUST_VORTEX, nm: _("DUST_VORTEX") },
    { val: PM_ICE_VORTEX, nm: _("ICE_VORTEX") },
    { val: PM_ENERGY_VORTEX, nm: _("ENERGY_VORTEX") },
    { val: PM_STEAM_VORTEX, nm: _("STEAM_VORTEX") },
    { val: PM_FIRE_VORTEX, nm: _("FIRE_VORTEX") },
    /*
     * worms
     */
    { val: PM_BABY_LONG_WORM, nm: _("BABY_LONG_WORM") },
    { val: PM_BABY_PURPLE_WORM, nm: _("BABY_PURPLE_WORM") },
    { val: PM_LONG_WORM, nm: _("LONG_WORM") },
    { val: PM_PURPLE_WORM, nm: _("PURPLE_WORM") },
    /*
     * xan &c
     */
    { val: PM_GRID_BUG, nm: _("GRID_BUG") },
    { val: PM_XAN, nm: _("XAN") },
    /*
     * lights
     */
    /* yellow light is visible and its suicidal explosion causes blindness */
    { val: PM_YELLOW_LIGHT, nm: _("YELLOW_LIGHT") },
    /* black light is invisible and causes hallucination */
    { val: PM_BLACK_LIGHT, nm: _("BLACK_LIGHT") },
    /*
     * zruty
     */
    { val: PM_ZRUTY, nm: _("ZRUTY") },
    /*
     * Angels and other lawful minions
     */
    { val: PM_COUATL, nm: _("COUATL") },
    { val: PM_ALEAX, nm: _("ALEAX") },
    /* Angels start with the emin extension attached and usually have
       the isminion flag set; however non-minion Angels can be tamed
       and will switch to edog (guardian Angel is handled specially and
       always sticks with emin) */
    { val: PM_ANGEL, nm: _("ANGEL") },
    /* the AD&D Monster Manual depicts ki-rin as very similar to unicorns
       except that they fly (without wings) and can cast spells; nethack's
       ki-rin doesn't leave its horn when killed but it can use the horn
       while alive to cure itself of various maladies */
    { val: PM_KI_RIN, nm: _("KI_RIN") },
    { val: PM_ARCHON, nm: _("ARCHON") },
    /*
     * Bats and birds
     */
    { val: PM_BAT, nm: _("BAT") },
    { val: PM_GIANT_BAT, nm: _("GIANT_BAT") },
    { val: PM_RAVEN, nm: _("RAVEN") },
    { val: PM_VAMPIRE_BAT, nm: _("VAMPIRE_BAT") },
    /*
     * Centaurs
     */
    { val: PM_PLAINS_CENTAUR, nm: _("PLAINS_CENTAUR") },
    { val: PM_FOREST_CENTAUR, nm: _("FOREST_CENTAUR") },
    { val: PM_MOUNTAIN_CENTAUR, nm: _("MOUNTAIN_CENTAUR") },
    /*
     * Dragons
     */
    /* The order of the dragons is VERY IMPORTANT.  Quite a few
     * pieces of code depend on gray being first and yellow being last.
     * The code also depends on the *order* being the same as that for
     * dragon scale mail and dragon scales in objects.c.  [Also
     * 'tilemap' assumes that shimmering dragon follows silver dragon.]
     *
     * Adult dragons are all lawful or chaotic; baby dragons are all
     * neutral.  This affects monster generation on some special levels.
     * Baby dragons cannot confer intrinsics to avoid polyself/egg abuse.
     *
     * As reptiles dragons are cold-blooded and thus aren't seen with
     * infravision.  Red and gold dragons (also Chromatic Dragon) are
     * the exceptions because they breathe fire.
     */
    { val: PM_BABY_GRAY_DRAGON, nm: _("BABY_GRAY_DRAGON") },
    { val: PM_BABY_GOLD_DRAGON, nm: _("BABY_GOLD_DRAGON") },
    { val: PM_BABY_SILVER_DRAGON, nm: _("BABY_SILVER_DRAGON") },

    { val: PM_BABY_RED_DRAGON, nm: _("BABY_RED_DRAGON") },
    { val: PM_BABY_WHITE_DRAGON, nm: _("BABY_WHITE_DRAGON") },
    { val: PM_BABY_ORANGE_DRAGON, nm: _("BABY_ORANGE_DRAGON") },
    { val: PM_BABY_BLACK_DRAGON, nm: _("BABY_BLACK_DRAGON") },
    { val: PM_BABY_BLUE_DRAGON, nm: _("BABY_BLUE_DRAGON") },
    { val: PM_BABY_GREEN_DRAGON, nm: _("BABY_GREEN_DRAGON") },
    { val: PM_BABY_YELLOW_DRAGON, nm: _("BABY_YELLOW_DRAGON") },
    { val: PM_GRAY_DRAGON, nm: _("GRAY_DRAGON") },
    /* gold dragon can be seen via infravision but doesn't have infravision */
    { val: PM_GOLD_DRAGON, nm: _("GOLD_DRAGON") },
    { val: PM_SILVER_DRAGON, nm: _("SILVER_DRAGON") },

    /* red dragon has infravision and can be seen via infravision */
    { val: PM_RED_DRAGON, nm: _("RED_DRAGON") },
    { val: PM_WHITE_DRAGON, nm: _("WHITE_DRAGON") },
    { val: PM_ORANGE_DRAGON, nm: _("ORANGE_DRAGON") },
    /* disintegration breath is actually all or nothing not 1d255 */
    { val: PM_BLACK_DRAGON, nm: _("BLACK_DRAGON") },
    { val: PM_BLUE_DRAGON, nm: _("BLUE_DRAGON") },
    { val: PM_GREEN_DRAGON, nm: _("GREEN_DRAGON") },
    { val: PM_YELLOW_DRAGON, nm: _("YELLOW_DRAGON") },
    /*
     * Elementals
     */
    { val: PM_STALKER, nm: _("STALKER") },
    { val: PM_AIR_ELEMENTAL, nm: _("AIR_ELEMENTAL") },
    { val: PM_FIRE_ELEMENTAL, nm: _("FIRE_ELEMENTAL") },
    { val: PM_EARTH_ELEMENTAL, nm: _("EARTH_ELEMENTAL") },
    { val: PM_WATER_ELEMENTAL, nm: _("WATER_ELEMENTAL") },
    /*
     * Fungi
     */
    { val: PM_LICHEN, nm: _("LICHEN") },
    { val: PM_BROWN_MOLD, nm: _("BROWN_MOLD") },
    { val: PM_YELLOW_MOLD, nm: _("YELLOW_MOLD") },
    { val: PM_GREEN_MOLD, nm: _("GREEN_MOLD") },
    { val: PM_RED_MOLD, nm: _("RED_MOLD") },
    { val: PM_SHRIEKER, nm: _("SHRIEKER") },
    { val: PM_VIOLET_FUNGUS, nm: _("VIOLET_FUNGUS") },
    /*
     * Gnomes
     *  Unlike plain human|elf|orc plain "gnome" is an ordinary monster.
     */
    { val: PM_GNOME, nm: _("GNOME") },
    { val: PM_GNOME_LEADER, nm: _("GNOME_LEADER") },
    { val: PM_GNOMISH_WIZARD, nm: _("GNOMISH_WIZARD") },
    { val: PM_GNOME_RULER, nm: _("GNOME_RULER") },
    /*
     * giant Humanoids
     */
    /* plain giant is a placeholder for zombie and mummy corpses */
    { val: PM_GIANT, nm: _("GIANT") },
    { val: PM_STONE_GIANT, nm: _("STONE_GIANT") },
    { val: PM_HILL_GIANT, nm: _("HILL_GIANT") },
    { val: PM_FIRE_GIANT, nm: _("FIRE_GIANT") },
    { val: PM_FROST_GIANT, nm: _("FROST_GIANT") },
    /* ettin is a two-headed giant but its corpse doesn't confer strength */
    { val: PM_ETTIN, nm: _("ETTIN") },
    { val: PM_STORM_GIANT, nm: _("STORM_GIANT") },
    { val: PM_TITAN, nm: _("TITAN") },
    { val: PM_MINOTAUR, nm: _("MINOTAUR") },
    /*
     * Invisible
     * S_invisible=='I' is a visual marker for all invisible monsters
     * and must be not be used for any specific monster types.  Long
     * time 'invisible stalker' was changed to 'stalker' an Elemental.
     */

    /*
     * Jabberwock
     */
    /* the illustration from _Through_the_Looking_Glass_
       depicts hands as well as wings */
    { val: PM_JABBERWOCK, nm: _("JABBERWOCK") },

    /*
     * Kops
     */
    { val: PM_KEYSTONE_KOP, nm: _("KEYSTONE_KOP") },
    { val: PM_KOP_SERGEANT, nm: _("KOP_SERGEANT") },
    { val: PM_KOP_LIEUTENANT, nm: _("KOP_LIEUTENANT") },
    { val: PM_KOP_KAPTAIN, nm: _("KOP_KAPTAIN") },
    /*
     * Liches
     */
    { val: PM_LICH, nm: _("LICH") },
    { val: PM_DEMILICH, nm: _("DEMILICH") },
    { val: PM_MASTER_LICH, nm: _("MASTER_LICH") },
    { val: PM_ARCH_LICH, nm: _("ARCH_LICH") },
    /*
     * Mummies
     */
    { val: PM_KOBOLD_MUMMY, nm: _("KOBOLD_MUMMY") },
    { val: PM_GNOME_MUMMY, nm: _("GNOME_MUMMY") },
    { val: PM_ORC_MUMMY, nm: _("ORC_MUMMY") },
    { val: PM_DWARF_MUMMY, nm: _("DWARF_MUMMY") },
    { val: PM_ELF_MUMMY, nm: _("ELF_MUMMY") },
    { val: PM_HUMAN_MUMMY, nm: _("HUMAN_MUMMY") },
    { val: PM_ETTIN_MUMMY, nm: _("ETTIN_MUMMY") },
    { val: PM_GIANT_MUMMY, nm: _("GIANT_MUMMY") },
    /*
     * Nagas
     */
    { val: PM_RED_NAGA_HATCHLING, nm: _("RED_NAGA_HATCHLING") },
    { val: PM_BLACK_NAGA_HATCHLING, nm: _("BLACK_NAGA_HATCHLING") },
    { val: PM_GOLDEN_NAGA_HATCHLING, nm: _("GOLDEN_NAGA_HATCHLING") },
    { val: PM_GUARDIAN_NAGA_HATCHLING, nm: _("GUARDIAN_NAGA_HATCHLING") },
    { val: PM_RED_NAGA, nm: _("RED_NAGA") },
    { val: PM_BLACK_NAGA, nm: _("BLACK_NAGA") },
    { val: PM_GOLDEN_NAGA, nm: _("GOLDEN_NAGA") },
    /* 5.0: guardian naga used to have three attacks: bite spit hug
       but in order for the hug to succeed the two preceding attacks had
       to have hit and it's not possible to both bite and spit hence
       the hug never hit; change to spit bite touch hug; if the bite
       and touch hit the hug will too */
    { val: PM_GUARDIAN_NAGA, nm: _("GUARDIAN_NAGA") },
    /*
     * Ogres
     */
    { val: PM_OGRE, nm: _("OGRE") },
    { val: PM_OGRE_LEADER, nm: _("OGRE_LEADER") },
    { val: PM_OGRE_TYRANT, nm: _("OGRE_TYRANT") },
    /*
     * Puddings
     *
     * must be in the same order as the pudding globs in objects.c
     */
    { val: PM_GRAY_OOZE, nm: _("GRAY_OOZE") },
    { val: PM_BROWN_PUDDING, nm: _("BROWN_PUDDING") },
    { val: PM_GREEN_SLIME, nm: _("GREEN_SLIME") },
    { val: PM_BLACK_PUDDING, nm: _("BLACK_PUDDING") },
    /*
     * Quantum mechanics
     */
    { val: PM_QUANTUM_MECHANIC, nm: _("QUANTUM_MECHANIC") },
    /* 5.0: from slash'em to expand Q class; hit polymorphs target */
    { val: PM_GENETIC_ENGINEER, nm: _("GENETIC_ENGINEER") },
    /*
     * Rust monster or disenchanter
     */
    { val: PM_RUST_MONSTER, nm: _("RUST_MONSTER") },
    { val: PM_DISENCHANTER, nm: _("DISENCHANTER") },
    /*
     * Snakes
     *  Note: in the real world most snakes are oviparous but some aren't;
     *  we treat all of these as if they are.
     */
    { val: PM_GARTER_SNAKE, nm: _("GARTER_SNAKE") },
    { val: PM_SNAKE, nm: _("SNAKE") },
    { val: PM_WATER_MOCCASIN, nm: _("WATER_MOCCASIN") },
    { val: PM_PYTHON, nm: _("PYTHON") },
    { val: PM_PIT_VIPER, nm: _("PIT_VIPER") },
    { val: PM_COBRA, nm: _("COBRA") },
    /*
     * Trolls
     */
    { val: PM_TROLL, nm: _("TROLL") },
    { val: PM_ICE_TROLL, nm: _("ICE_TROLL") },
    { val: PM_ROCK_TROLL, nm: _("ROCK_TROLL") },
    { val: PM_WATER_TROLL, nm: _("WATER_TROLL") },
    { val: PM_OLOG_HAI, nm: _("OLOG_HAI") },
    /*
     * Umber hulk
     */
    { val: PM_UMBER_HULK, nm: _("UMBER_HULK") },
    /*
     * Vampires
     */
    { val: PM_VAMPIRE, nm: _("VAMPIRE") },
    { val: PM_VAMPIRE_LEADER, nm: _("VAMPIRE_LEADER") },

    { val: PM_VLAD_THE_IMPALER, nm: _("VLAD_THE_IMPALER") },
    /*
     * Wraiths
     */
    { val: PM_BARROW_WIGHT, nm: _("BARROW_WIGHT") },
    /* wraiths weigh 0 but can leave corpses */
    { val: PM_WRAITH, nm: _("WRAITH") },
    { val: PM_NAZGUL, nm: _("NAZGUL") },
    /*
     * Xorn
     */
    { val: PM_XORN, nm: _("XORN") },
    /*
     * Apelike beasts
     */
    /* tameable via banana; does not grow up into ape...
       not flagged as domestic so no guilt penalty for eating non-pet one */
    { val: PM_MONKEY, nm: _("MONKEY") },
    { val: PM_APE, nm: _("APE") },
    { val: PM_OWLBEAR, nm: _("OWLBEAR") },
    { val: PM_YETI, nm: _("YETI") },
    { val: PM_CARNIVOROUS_APE, nm: _("CARNIVOROUS_APE") },
    { val: PM_SASQUATCH, nm: _("SASQUATCH") },
    /*
     * Zombies
     */
    { val: PM_KOBOLD_ZOMBIE, nm: _("KOBOLD_ZOMBIE") },
    { val: PM_GNOME_ZOMBIE, nm: _("GNOME_ZOMBIE") },
    { val: PM_ORC_ZOMBIE, nm: _("ORC_ZOMBIE") },
    { val: PM_DWARF_ZOMBIE, nm: _("DWARF_ZOMBIE") },
    { val: PM_ELF_ZOMBIE, nm: _("ELF_ZOMBIE") },
    { val: PM_HUMAN_ZOMBIE, nm: _("HUMAN_ZOMBIE") },
    { val: PM_ETTIN_ZOMBIE, nm: _("ETTIN_ZOMBIE") },
    { val: PM_GHOUL, nm: _("GHOUL") },
    { val: PM_GIANT_ZOMBIE, nm: _("GIANT_ZOMBIE") },
    { val: PM_SKELETON, nm: _("SKELETON") },
    /*
     * golems
     */
    { val: PM_STRAW_GOLEM, nm: _("STRAW_GOLEM") },
    { val: PM_PAPER_GOLEM, nm: _("PAPER_GOLEM") },
    { val: PM_ROPE_GOLEM, nm: _("ROPE_GOLEM") },
    { val: PM_GOLD_GOLEM, nm: _("GOLD_GOLEM") },
    { val: PM_LEATHER_GOLEM, nm: _("LEATHER_GOLEM") },
    { val: PM_WOOD_GOLEM, nm: _("WOOD_GOLEM") },
    { val: PM_FLESH_GOLEM, nm: _("FLESH_GOLEM") },
    { val: PM_CLAY_GOLEM, nm: _("CLAY_GOLEM") },
    { val: PM_STONE_GOLEM, nm: _("STONE_GOLEM") },
    { val: PM_GLASS_GOLEM, nm: _("GLASS_GOLEM") },
    { val: PM_IRON_GOLEM, nm: _("IRON_GOLEM") },
    /*
     * humans including elves and were-critters;
     *  the '@' class does not obey rule #2.
     *  Plain "human" is a placeholder not a normal monster.
     */
    { val: PM_HUMAN, nm: _("HUMAN") },
    { val: PM_HUMAN_WERERAT, nm: _("HUMAN_WERERAT") },
    { val: PM_HUMAN_WEREJACKAL, nm: _("HUMAN_WEREJACKAL") },
    { val: PM_HUMAN_WEREWOLF, nm: _("HUMAN_WEREWOLF") },
    /* plain "elf" is a placeholder not a normal monster */
    { val: PM_ELF, nm: _("ELF") },
    { val: PM_WOODLAND_ELF, nm: _("WOODLAND_ELF") },
    { val: PM_GREEN_ELF, nm: _("GREEN_ELF") },
    { val: PM_GREY_ELF, nm: _("GREY_ELF") },
    { val: PM_ELF_NOBLE, nm: _("ELF_NOBLE") },
    { val: PM_ELVEN_MONARCH, nm: _("ELVEN_MONARCH") },
    { val: PM_DOPPELGANGER, nm: _("DOPPELGANGER") },
    /* 5.0: shopkeepers used to have speed 18 but if/when they were
       hasted they always got 2 moves per turn and had a tendency to move
       away from blocking the door and then move right back; since they
       might start with a potion of speed and drink that as soon as the
       hero gets close once inside the shop the hero could have trouble
       getting out again; also being slowed still guaranteed one move
       per turn; reduce their innate speed from 18 to 16 for a hasted
       speed of 22 rather than 24 and slowed speed of 11 rather than 12;
       they will still block the shop door but not as tenaciously */
    { val: PM_SHOPKEEPER, nm: _("SHOPKEEPER") },
    /* vault guard */
    { val: PM_GUARD, nm: _("GUARD") },
    /* prisoner is used on some special levels */
    { val: PM_PRISONER, nm: _("PRISONER") },
    /* the Oracle of Delphi doesn't move */
    { val: PM_ORACLE, nm: _("ORACLE") },
    /* aligned priests always have the epri extension attached;
       individual instantiations should always have either ispriest
       or isminion set; role monster priests are separate (below) */
    { val: PM_ALIGNED_CLERIC, nm: _("ALIGNED_CLERIC") },
    /* high priests always have epri and always have ispriest set;
       they are flagged as unique even through they aren't */
    { val: PM_HIGH_CLERIC, nm: _("HIGH_CLERIC") },
    { val: PM_SOLDIER, nm: _("SOLDIER") },
    { val: PM_SERGEANT, nm: _("SERGEANT") },
    { val: PM_NURSE, nm: _("NURSE") },
    { val: PM_LIEUTENANT, nm: _("LIEUTENANT") },
    { val: PM_CAPTAIN, nm: _("CAPTAIN") },
    { val: PM_WATCHMAN, nm: _("WATCHMAN") },
    { val: PM_WATCH_CAPTAIN, nm: _("WATCH_CAPTAIN") },
    /* Unique humans not tied to quests.
     */
    { val: PM_MEDUSA, nm: _("MEDUSA") },
    { val: PM_WIZARD_OF_YENDOR, nm: _("WIZARD_OF_YENDOR") },
    { val: PM_CROESUS, nm: _("CROESUS") },

    /*
     * ghosts
     *  ghosts and shades don't leave corpses; assigning human weight
     *  to them matters for statues
     */
    { val: PM_GHOST, nm: _("GHOST") },
    { val: PM_SHADE, nm: _("SHADE") },
    /*
     * (major) demons
     */
    { val: PM_WATER_DEMON, nm: _("WATER_DEMON") },
    /* standard demons & devils
     */

    /* incubus and succubus; prior to 5.0 succubus and incubus were
       distinct monsters; "amorous demon" is considered to be a temporary
       placeholder but may be here to stay... */
    { val: PM_AMOROUS_DEMON, nm: _("AMOROUS_DEMON") },
    { val: PM_HORNED_DEVIL, nm: _("HORNED_DEVIL") },
    /* Used by AD&D for a type of demon originally one of the Furies
       and spelled this way; plural is erinyes */
    { val: PM_ERINYS, nm: _("ERINYS") },
    { val: PM_BARBED_DEVIL, nm: _("BARBED_DEVIL") },
    { val: PM_MARILITH, nm: _("MARILITH") },
    { val: PM_VROCK, nm: _("VROCK") },
    { val: PM_HEZROU, nm: _("HEZROU") },
    { val: PM_BONE_DEVIL, nm: _("BONE_DEVIL") },
    { val: PM_ICE_DEVIL, nm: _("ICE_DEVIL") },
    { val: PM_NALFESHNEE, nm: _("NALFESHNEE") },
    { val: PM_PIT_FIEND, nm: _("PIT_FIEND") },
    /* from Jack Vance's _Rhialto_the_Marvellous_ one of the sequels
       to _The_Dying_Earth_ */
    { val: PM_SANDESTIN, nm: _("SANDESTIN") },
    { val: PM_BALROG, nm: _("BALROG") },
    /* Named demon lords & princes plus Arch-Devils.
     * (their order matters; see minion.c)
     */
    { val: PM_JUIBLEX, nm: _("JUIBLEX") },
    { val: PM_YEENOGHU, nm: _("YEENOGHU") },
    { val: PM_ORCUS, nm: _("ORCUS") },
    { val: PM_GERYON, nm: _("GERYON") },
    { val: PM_DISPATER, nm: _("DISPATER") },
    { val: PM_BAALZEBUB, nm: _("BAALZEBUB") },
    { val: PM_ASMODEUS, nm: _("ASMODEUS") },
    { val: PM_DEMOGORGON, nm: _("DEMOGORGON") },
    /* Riders -- the Four Horsemen of the Apocalypse ("War" == player);
     * depicted with '&' but do not have M2_DEMON set.
     */
    { val: PM_DEATH, nm: _("DEATH") },
    { val: PM_PESTILENCE, nm: _("PESTILENCE") },
    { val: PM_FAMINE, nm: _("FAMINE") },
    /* other demons
     */

    { val: PM_MAIL_DAEMON, nm: _("MAIL_DAEMON") },

    /* djinni is singular; plural is djinn */
    { val: PM_DJINNI, nm: _("DJINNI") },
    /*
     * sea monsters
     *
     * 5.0: all the fish except kraken used to specify M1_SLITHY presumably
     * cloned from giant eel.  Using "slither" to describe their movement
     * wasn't appropriate.  Unfortunately locomotion() isn't able to choose
     * "swim" as their movement description because it is only passed a
     * monster type not a specific monster (for <mxmy>) or the relevant
     * location and therefore doesn't know whether water is involved.
     */
    { val: PM_JELLYFISH, nm: _("JELLYFISH") },
    { val: PM_PIRANHA, nm: _("PIRANHA") },
    { val: PM_SHARK, nm: _("SHARK") },
    { val: PM_GIANT_EEL, nm: _("GIANT_EEL") },
    { val: PM_ELECTRIC_EEL, nm: _("ELECTRIC_EEL") },
    { val: PM_KRAKEN, nm: _("KRAKEN") },
    /*
     * lizards &c
     */
    { val: PM_NEWT, nm: _("NEWT") },
    { val: PM_GECKO, nm: _("GECKO") },
    { val: PM_IGUANA, nm: _("IGUANA") },
    { val: PM_BABY_CROCODILE, nm: _("BABY_CROCODILE") },
    /* trivia:  before monster corpses were implemented "lizard corpse"
       was a specific type of item */
    { val: PM_LIZARD, nm: _("LIZARD") },
    { val: PM_CHAMELEON, nm: _("CHAMELEON") },
    { val: PM_CROCODILE, nm: _("CROCODILE") },
    { val: PM_SALAMANDER, nm: _("SALAMANDER") },

    /*
     * dummy monster needed for visual interface
     * (marking it unique prevents figurines)
     */
    { val: PM_LONG_WORM_TAIL, nm: _("LONG_WORM_TAIL") },
    /* Note:
     * Worm tail must be between the normal monsters and the special
     * quest & pseudo-character ones because an optimization in the
     * random monster selection code assumes everything beyond here
     * has the G_NOGEN and M2_NOPOLY attributes.
     */

    /*
     * character classes
     */
    { val: PM_ARCHEOLOGIST, nm: _("ARCHEOLOGIST") },
    { val: PM_BARBARIAN, nm: _("BARBARIAN") },
    { val: PM_CAVE_DWELLER, nm: _("CAVE_DWELLER") },
    { val: PM_HEALER, nm: _("HEALER") },
    { val: PM_KNIGHT, nm: _("KNIGHT") },
    { val: PM_MONK, nm: _("MONK") },
    /* monster priests are separate monsters (above; "aligned cleric") */
    { val: PM_CLERIC, nm: _("CLERIC") },
    { val: PM_RANGER, nm: _("RANGER") },
    { val: PM_ROGUE, nm: _("ROGUE") },
    { val: PM_SAMURAI, nm: _("SAMURAI") },
    { val: PM_TOURIST, nm: _("TOURIST") },
    /* valk is lawful by default; player valk can be neutral in which case
       role_init() will change this monster and 'warrior' to be neutral too;
       if a neutral valk leaves a bones file containing neutral warriors
       the latter will magically turn lawful if encountered by a lawful valk
       or any non-valk (for bones on the dungeon side of the portal) */
    { val: PM_VALKYRIE, nm: _("VALKYRIE") },
    { val: PM_WIZARD, nm: _("WIZARD") },
    /*
     * quest leaders
     */
    { val: PM_LORD_CARNARVON, nm: _("LORD_CARNARVON") },
    { val: PM_PELIAS, nm: _("PELIAS") },
    { val: PM_SHAMAN_KARNOV, nm: _("SHAMAN_KARNOV") },

    { val: PM_HIPPOCRATES, nm: _("HIPPOCRATES") },
    { val: PM_KING_ARTHUR, nm: _("KING_ARTHUR") },
    { val: PM_GRAND_MASTER, nm: _("GRAND_MASTER") },
    { val: PM_ARCH_PRIEST, nm: _("ARCH_PRIEST") },
    { val: PM_ORION, nm: _("ORION") },
    /* Note: Master of Thieves is also the Tourist's nemesis.
     */
    { val: PM_MASTER_OF_THIEVES, nm: _("MASTER_OF_THIEVES") },
    { val: PM_LORD_SATO, nm: _("LORD_SATO") },
    { val: PM_TWOFLOWER, nm: _("TWOFLOWER") },
    /* for a valkyrie hero Norn's alignment will be changed to match hero's
       starting alignment */
    { val: PM_NORN, nm: _("NORN") },
    { val: PM_NEFERET_THE_GREEN, nm: _("NEFERET_THE_GREEN") },
    /*
     * quest nemeses
     */
    { val: PM_MINION_OF_HUHETOTL, nm: _("MINION_OF_HUHETOTL") },
    { val: PM_THOTH_AMON, nm: _("THOTH_AMON") },
    /* Multi-headed possessing the breath attacks of all the other dragons
     * (selected at random when attacking).  Despite being a superset of
     * gold dragon does not emit light.  Also does not fly.
     */
    { val: PM_CHROMATIC_DRAGON, nm: _("CHROMATIC_DRAGON") },

    { val: PM_CYCLOPS, nm: _("CYCLOPS") },
    { val: PM_IXOTH, nm: _("IXOTH") },
    { val: PM_MASTER_KAEN, nm: _("MASTER_KAEN") },
    { val: PM_NALZOK, nm: _("NALZOK") },
    { val: PM_SCORPIUS, nm: _("SCORPIUS") },
    { val: PM_MASTER_ASSASSIN, nm: _("MASTER_ASSASSIN") },
    /* A renegade daimyo who led a 13 year civil war against the shogun
     * of his time.
     */
    { val: PM_ASHIKAGA_TAKAUJI, nm: _("ASHIKAGA_TAKAUJI") },
    /*
     * Note: the Master of Thieves was defined above.
     */
    { val: PM_LORD_SURTUR, nm: _("LORD_SURTUR") },
    { val: PM_DARK_ONE, nm: _("DARK_ONE") },
    /*
     * quest "guardians"
     */
    { val: PM_STUDENT, nm: _("STUDENT") },
    { val: PM_CHIEFTAIN, nm: _("CHIEFTAIN") },
    { val: PM_NEANDERTHAL, nm: _("NEANDERTHAL") },

    /* attendants used to be lawful but have been changed to neutral because
       grow_up() promotes them to healer and the latter is always neutral */
    { val: PM_ATTENDANT, nm: _("ATTENDANT") },
    { val: PM_PAGE, nm: _("PAGE") },
    { val: PM_ABBOT, nm: _("ABBOT") },
    { val: PM_ACOLYTE, nm: _("ACOLYTE") },
    { val: PM_HUNTER, nm: _("HUNTER") },
    { val: PM_THUG, nm: _("THUG") },
    { val: PM_NINJA, nm: _("NINJA") },
    { val: PM_ROSHI, nm: _("ROSHI") },
    { val: PM_GUIDE, nm: _("GUIDE") },
    /* warriors used to be chaotic but have been changed to lawful because
       grow_up() promotes them to valkyrie; for a valkyrie hero they might
       be changed to neutral at game start; see the valkyrie comment above */
    { val: PM_WARRIOR, nm: _("WARRIOR") },
    { val: PM_APPRENTICE, nm: _("APPRENTICE") },
    ];
}

// the records of objdump[] from objects.h, laid out like it
function objdump_records() {
    return [
{ val: STRANGE_OBJECT, nm: _("STRANGE_OBJECT") },
/* slots [1] through [MAXOCLASSES-1] are indexed by class; some are
   used for display purposes most aren't used; none are actual objects;
   note that 'real' strange object is in slot [0] but ILLOBJ_CLASS is 1
   so we add a dummy for it in slot [1] to simplify accessing the rest;
   there isn't any entry for RANDOM_CLASS (0) */
{ val: GENERIC_ILLOBJ, nm: _("GENERIC_ILLOBJ") },  /* [1] */
{ val: GENERIC_WEAPON, nm: _("GENERIC_WEAPON") },  /* [2] */
{ val: GENERIC_ARMOR, nm: _("GENERIC_ARMOR") },   /* [3] */
{ val: GENERIC_RING, nm: _("GENERIC_RING") },    /* [4] */
{ val: GENERIC_AMULET, nm: _("GENERIC_AMULET") },  /* [5] */
{ val: GENERIC_TOOL, nm: _("GENERIC_TOOL") },    /* [6] */
{ val: GENERIC_FOOD, nm: _("GENERIC_FOOD") },    /* [7] */
{ val: GENERIC_POTION, nm: _("GENERIC_POTION") },  /* [8] */
{ val: GENERIC_SCROLL, nm: _("GENERIC_SCROLL") },  /* [9] */
{ val: GENERIC_SPBOOK, nm: _("GENERIC_SPBOOK") },  /* [10] */
{ val: GENERIC_WAND, nm: _("GENERIC_WAND") },    /* [11] */
{ val: GENERIC_COIN, nm: _("GENERIC_COIN") },    /* [12] */
{ val: GENERIC_GEM, nm: _("GENERIC_GEM") },     /* [13] */
{ val: GENERIC_ROCK, nm: _("GENERIC_ROCK") },    /* [14] bldr+statue */
{ val: GENERIC_BALL, nm: _("GENERIC_BALL") },    /* [15] */
{ val: GENERIC_CHAIN, nm: _("GENERIC_CHAIN") },   /* [16] */
{ val: GENERIC_VENOM, nm: _("GENERIC_VENOM") },   /* [17] */

/* FIRST_OBJECT: it would be simpler just to use MARKER(FIRST_OBJECTARROW)
   below but that is vulnerable to neglecting to update the marker enum
   after inserting something in front of arrow */

/* this definition of FIRST_OBJECT advances the default value for next enum;
   backtrack to fix that otherwise ARROW and the rest would be off by 1 */

/* weapons ... */

/* Note: for weapons that don't do an even die of damage (ex. 2-7 or 3-18)
   the extra damage is added on in weapon.c not here! */

/* weapon strike mode overloads the oc_dir field */

/* missiles; materiel reflects the arrowhead not the shaft */
{ val: ARROW, nm: _("ARROW") },
{ val: ELVEN_ARROW, nm: _("ELVEN_ARROW") },
{ val: ORCISH_ARROW, nm: _("ORCISH_ARROW") },
{ val: SILVER_ARROW, nm: _("SILVER_ARROW") },
{ val: YA, nm: _("YA") },
{ val: CROSSBOW_BOLT, nm: _("CROSSBOW_BOLT") },

/* missiles that don't use a launcher */
{ val: DART, nm: _("DART") },
{ val: SHURIKEN, nm: _("SHURIKEN") },
{ val: BOOMERANG, nm: _("BOOMERANG") },

/* spears [note: javelin used to have a separate skill from spears
   because the latter are primarily stabbing weapons rather than
   throwing ones; but for playability they've been merged together
   under spear skill and spears can now be thrown like javelins] */
{ val: SPEAR, nm: _("SPEAR") },
{ val: ELVEN_SPEAR, nm: _("ELVEN_SPEAR") },
{ val: ORCISH_SPEAR, nm: _("ORCISH_SPEAR") },
{ val: DWARVISH_SPEAR, nm: _("DWARVISH_SPEAR") },
{ val: SILVER_SPEAR, nm: _("SILVER_SPEAR") },
{ val: JAVELIN, nm: _("JAVELIN") },

/* spearish; doesn't stack not intended to be thrown */
{ val: TRIDENT, nm: _("TRIDENT") },
        /* +1 small +2d4 large */

/* blades; all stack */
{ val: DAGGER, nm: _("DAGGER") },
{ val: ELVEN_DAGGER, nm: _("ELVEN_DAGGER") },
{ val: ORCISH_DAGGER, nm: _("ORCISH_DAGGER") },
{ val: SILVER_DAGGER, nm: _("SILVER_DAGGER") },
{ val: ATHAME, nm: _("ATHAME") },
{ val: SCALPEL, nm: _("SCALPEL") },
{ val: KNIFE, nm: _("KNIFE") },
{ val: STILETTO, nm: _("STILETTO") },
/* 3.6: worm teeth and crysknives now stack;
   when a stack of teeth is enchanted at once they fuse into one crysknife;
   when a stack of crysknives drops the whole stack reverts to teeth */
/* 5.0: change crysknife from MINERAL to BONE and worm tooth from 0 to BONE */
{ val: WORM_TOOTH, nm: _("WORM_TOOTH") },
{ val: CRYSKNIFE, nm: _("CRYSKNIFE") },

/* axes */
{ val: AXE, nm: _("AXE") },
{ val: BATTLE_AXE, nm: _("BATTLE_AXE") },

/* swords */
{ val: SHORT_SWORD, nm: _("SHORT_SWORD") },
{ val: ELVEN_SHORT_SWORD, nm: _("ELVEN_SHORT_SWORD") },
{ val: ORCISH_SHORT_SWORD, nm: _("ORCISH_SHORT_SWORD") },
{ val: DWARVISH_SHORT_SWORD, nm: _("DWARVISH_SHORT_SWORD") },
{ val: SCIMITAR, nm: _("SCIMITAR") },
{ val: SILVER_SABER, nm: _("SILVER_SABER") },
{ val: BROADSWORD, nm: _("BROADSWORD") },
        /* +d4 small +1 large */
{ val: ELVEN_BROADSWORD, nm: _("ELVEN_BROADSWORD") },
        /* +d4 small +1 large */
{ val: LONG_SWORD, nm: _("LONG_SWORD") },
{ val: TWO_HANDED_SWORD, nm: _("TWO_HANDED_SWORD") },
        /* +2d6 large */
{ val: KATANA, nm: _("KATANA") },
/* special swords set up for artifacts */
{ val: TSURUGI, nm: _("TSURUGI") },
        /* +2d6 large */
{ val: RUNESWORD, nm: _("RUNESWORD") },
        /* +d4 small +1 large; Stormbringer: +5d2 +d8 from level drain */

/* polearms */
/* spear-type */
{ val: PARTISAN, nm: _("PARTISAN") },
        /* +1 large */
{ val: RANSEUR, nm: _("RANSEUR") },
        /* +d4 both */
{ val: SPETUM, nm: _("SPETUM") },
        /* +1 small +d6 large */
{ val: GLAIVE, nm: _("GLAIVE") },
/* axe-type */
{ val: HALBERD, nm: _("HALBERD") },
        /* +1d6 large */
{ val: BARDICHE, nm: _("BARDICHE") },
        /* +1d4 small +2d4 large */
{ val: VOULGE, nm: _("VOULGE") },
        /* +d4 both */
/* curved/hooked */
{ val: FAUCHARD, nm: _("FAUCHARD") },
{ val: GUISARME, nm: _("GUISARME") },
        /* +1d4 small */
{ val: BILL_GUISARME, nm: _("BILL_GUISARME") },
        /* +1d4 small */
/* other */
{ val: LUCERN_HAMMER, nm: _("LUCERN_HAMMER") },
        /* +1d4 small */
{ val: BEC_DE_CORBIN, nm: _("BEC_DE_CORBIN") },

/* formerly grouped with the polearms but don't use polearms skill;
   lance isn't even two-handed */
{ val: DWARVISH_MATTOCK, nm: _("DWARVISH_MATTOCK") },
{ val: LANCE, nm: _("LANCE") },
        /* +2d10 when jousting with lance as primary weapon
           +2d2 when jousting with it as secondary when dual wielding */

/* bludgeons */
{ val: MACE, nm: _("MACE") },
        /* +1 small */
{ val: SILVER_MACE, nm: _("SILVER_MACE") },
        /* +1 small */
{ val: MORNING_STAR, nm: _("MORNING_STAR") },
        /* +d4 small +1 large */
{ val: WAR_HAMMER, nm: _("WAR_HAMMER") },
        /* +1 small */
{ val: CLUB, nm: _("CLUB") },
{ val: RUBBER_HOSE, nm: _("RUBBER_HOSE") },
{ val: QUARTERSTAFF, nm: _("QUARTERSTAFF") },
/* two-piece */
{ val: AKLYS, nm: _("AKLYS") },
{ val: FLAIL, nm: _("FLAIL") },
        /* +1 small +1d4 large */

/* misc */
{ val: BULLWHIP, nm: _("BULLWHIP") },

/* bows */
{ val: BOW, nm: _("BOW") },
{ val: ELVEN_BOW, nm: _("ELVEN_BOW") },
{ val: ORCISH_BOW, nm: _("ORCISH_BOW") },
{ val: YUMI, nm: _("YUMI") },
{ val: SLING, nm: _("SLING") },
{ val: CROSSBOW, nm: _("CROSSBOW") },

/* armor ... */
        /* IRON denotes ferrous metals including steel.
         * Only IRON weapons and armor can rust.
         * Only COPPER (including brass) corrodes.
         * Some creatures are vulnerable to SILVER.
         */

/* helmets */
{ val: ELVEN_LEATHER_HELM, nm: _("ELVEN_LEATHER_HELM") },
{ val: ORCISH_HELM, nm: _("ORCISH_HELM") },
{ val: DWARVISH_IRON_HELM, nm: _("DWARVISH_IRON_HELM") },
{ val: FEDORA, nm: _("FEDORA") },
{ val: CORNUTHAUM, nm: _("CORNUTHAUM") },
{ val: DUNCE_CAP, nm: _("DUNCE_CAP") },
{ val: DENTED_POT, nm: _("DENTED_POT") },
{ val: HELM_OF_BRILLIANCE, nm: _("HELM_OF_BRILLIANCE") },
/* with shuffled appearances... */
{ val: HELMET, nm: _("HELMET") },
{ val: HELM_OF_CAUTION, nm: _("HELM_OF_CAUTION") },
{ val: HELM_OF_OPPOSITE_ALIGNMENT, nm: _("HELM_OF_OPPOSITE_ALIGNMENT") },
{ val: HELM_OF_TELEPATHY, nm: _("HELM_OF_TELEPATHY") },

/* suits of armor */
/*
 * There is code in polyself.c that assumes (1) and (2).
 * There is code in obj.h objnam.c mon.c read.c that assumes (2).
 *      (1) The dragon scale mails and the dragon scales are together.
 *      (2) That the order of the dragon scale mail and dragon scales
 *          is the same as order of dragons defined in monst.c.
 */

/* 3.4.1: dragon scale mail reclassified as "magic" since magic is
   needed to create them */
{ val: GRAY_DRAGON_SCALE_MAIL, nm: _("GRAY_DRAGON_SCALE_MAIL") },
    /* gold DSM is a light source; there's no property for that */
{ val: GOLD_DRAGON_SCALE_MAIL, nm: _("GOLD_DRAGON_SCALE_MAIL") },
{ val: SILVER_DRAGON_SCALE_MAIL, nm: _("SILVER_DRAGON_SCALE_MAIL") },

{ val: RED_DRAGON_SCALE_MAIL, nm: _("RED_DRAGON_SCALE_MAIL") },
{ val: WHITE_DRAGON_SCALE_MAIL, nm: _("WHITE_DRAGON_SCALE_MAIL") },
{ val: ORANGE_DRAGON_SCALE_MAIL, nm: _("ORANGE_DRAGON_SCALE_MAIL") },
{ val: BLACK_DRAGON_SCALE_MAIL, nm: _("BLACK_DRAGON_SCALE_MAIL") },
{ val: BLUE_DRAGON_SCALE_MAIL, nm: _("BLUE_DRAGON_SCALE_MAIL") },
{ val: GREEN_DRAGON_SCALE_MAIL, nm: _("GREEN_DRAGON_SCALE_MAIL") },
{ val: YELLOW_DRAGON_SCALE_MAIL, nm: _("YELLOW_DRAGON_SCALE_MAIL") },
/* For now only dragons leave these. */
/* 3.4.1: dragon scales left classified as "non-magic"; they confer magical
   properties but are produced "naturally"; affects use as polypile fodder */
{ val: GRAY_DRAGON_SCALES, nm: _("GRAY_DRAGON_SCALES") },
{ val: GOLD_DRAGON_SCALES, nm: _("GOLD_DRAGON_SCALES") },
{ val: SILVER_DRAGON_SCALES, nm: _("SILVER_DRAGON_SCALES") },

{ val: RED_DRAGON_SCALES, nm: _("RED_DRAGON_SCALES") },
{ val: WHITE_DRAGON_SCALES, nm: _("WHITE_DRAGON_SCALES") },
{ val: ORANGE_DRAGON_SCALES, nm: _("ORANGE_DRAGON_SCALES") },
{ val: BLACK_DRAGON_SCALES, nm: _("BLACK_DRAGON_SCALES") },
{ val: BLUE_DRAGON_SCALES, nm: _("BLUE_DRAGON_SCALES") },
{ val: GREEN_DRAGON_SCALES, nm: _("GREEN_DRAGON_SCALES") },
{ val: YELLOW_DRAGON_SCALES, nm: _("YELLOW_DRAGON_SCALES") },

/* other suits */
{ val: PLATE_MAIL, nm: _("PLATE_MAIL") },
{ val: CRYSTAL_PLATE_MAIL, nm: _("CRYSTAL_PLATE_MAIL") },
{ val: BRONZE_PLATE_MAIL, nm: _("BRONZE_PLATE_MAIL") },
{ val: SPLINT_MAIL, nm: _("SPLINT_MAIL") },
{ val: BANDED_MAIL, nm: _("BANDED_MAIL") },
{ val: DWARVISH_MITHRIL_COAT, nm: _("DWARVISH_MITHRIL_COAT") },
{ val: ELVEN_MITHRIL_COAT, nm: _("ELVEN_MITHRIL_COAT") },
{ val: CHAIN_MAIL, nm: _("CHAIN_MAIL") },
{ val: ORCISH_CHAIN_MAIL, nm: _("ORCISH_CHAIN_MAIL") },
{ val: SCALE_MAIL, nm: _("SCALE_MAIL") },
{ val: STUDDED_LEATHER_ARMOR, nm: _("STUDDED_LEATHER_ARMOR") },
{ val: RING_MAIL, nm: _("RING_MAIL") },
{ val: ORCISH_RING_MAIL, nm: _("ORCISH_RING_MAIL") },
{ val: LEATHER_ARMOR, nm: _("LEATHER_ARMOR") },
{ val: LEATHER_JACKET, nm: _("LEATHER_JACKET") },

/* shirts */
{ val: HAWAIIAN_SHIRT, nm: _("HAWAIIAN_SHIRT") },
{ val: T_SHIRT, nm: _("T_SHIRT") },

/* cloaks */
{ val: MUMMY_WRAPPING, nm: _("MUMMY_WRAPPING") },
        /* worn mummy wrapping blocks invisibility */
{ val: ELVEN_CLOAK, nm: _("ELVEN_CLOAK") },
{ val: ORCISH_CLOAK, nm: _("ORCISH_CLOAK") },
{ val: DWARVISH_CLOAK, nm: _("DWARVISH_CLOAK") },
{ val: OILSKIN_CLOAK, nm: _("OILSKIN_CLOAK") },
{ val: ROBE, nm: _("ROBE") },
        /* robe was adopted from slash'em where it's worn as a suit
           rather than as a cloak and there are several variations */
{ val: ALCHEMY_SMOCK, nm: _("ALCHEMY_SMOCK") },
{ val: LEATHER_CLOAK, nm: _("LEATHER_CLOAK") },
/* with shuffled appearances... */
{ val: CLOAK_OF_PROTECTION, nm: _("CLOAK_OF_PROTECTION") },
        /* cloak of protection is now the only item conferring MC 3 */
{ val: CLOAK_OF_INVISIBILITY, nm: _("CLOAK_OF_INVISIBILITY") },
{ val: CLOAK_OF_MAGIC_RESISTANCE, nm: _("CLOAK_OF_MAGIC_RESISTANCE") },
        /*  'cope' is not a spelling mistake... leave it be */
{ val: CLOAK_OF_DISPLACEMENT, nm: _("CLOAK_OF_DISPLACEMENT") },

/* shields */
{ val: SMALL_SHIELD, nm: _("SMALL_SHIELD") },
{ val: SHIELD_OF_DRAIN_RESISTANCE, nm: _("SHIELD_OF_DRAIN_RESISTANCE") },
{ val: SHIELD_OF_SHOCK_RESISTANCE, nm: _("SHIELD_OF_SHOCK_RESISTANCE") },
{ val: ELVEN_SHIELD, nm: _("ELVEN_SHIELD") },
{ val: URUK_HAI_SHIELD, nm: _("URUK_HAI_SHIELD") },
{ val: ORCISH_SHIELD, nm: _("ORCISH_SHIELD") },
{ val: LARGE_SHIELD, nm: _("LARGE_SHIELD") },
{ val: DWARVISH_ROUNDSHIELD, nm: _("DWARVISH_ROUNDSHIELD") },
{ val: SHIELD_OF_REFLECTION, nm: _("SHIELD_OF_REFLECTION") },

/* gloves */
/* These have their color but not material shuffled so the IRON must
 * stay CLR_BROWN (== HI_LEATHER) even though it's normally either
 * HI_METAL or CLR_BLACK.  All have shuffled descriptions.
 */
{ val: LEATHER_GLOVES, nm: _("LEATHER_GLOVES") },
{ val: GAUNTLETS_OF_FUMBLING, nm: _("GAUNTLETS_OF_FUMBLING") },
{ val: GAUNTLETS_OF_POWER, nm: _("GAUNTLETS_OF_POWER") },
{ val: GAUNTLETS_OF_DEXTERITY, nm: _("GAUNTLETS_OF_DEXTERITY") },

/* boots */
{ val: LOW_BOOTS, nm: _("LOW_BOOTS") },
{ val: IRON_SHOES, nm: _("IRON_SHOES") },
{ val: HIGH_BOOTS, nm: _("HIGH_BOOTS") },
/* with shuffled appearances... */
{ val: SPEED_BOOTS, nm: _("SPEED_BOOTS") },
{ val: WATER_WALKING_BOOTS, nm: _("WATER_WALKING_BOOTS") },
{ val: JUMPING_BOOTS, nm: _("JUMPING_BOOTS") },
{ val: ELVEN_BOOTS, nm: _("ELVEN_BOOTS") },
{ val: KICKING_BOOTS, nm: _("KICKING_BOOTS") },
        /* CLR_BROWN for same reason as gauntlets of power */
{ val: FUMBLE_BOOTS, nm: _("FUMBLE_BOOTS") },
{ val: LEVITATION_BOOTS, nm: _("LEVITATION_BOOTS") },

/* rings ... */

{ val: RIN_ADORNMENT, nm: _("RIN_ADORNMENT") },
{ val: RIN_GAIN_STRENGTH, nm: _("RIN_GAIN_STRENGTH") },
{ val: RIN_GAIN_CONSTITUTION, nm: _("RIN_GAIN_CONSTITUTION") },
{ val: RIN_INCREASE_ACCURACY, nm: _("RIN_INCREASE_ACCURACY") },
{ val: RIN_INCREASE_DAMAGE, nm: _("RIN_INCREASE_DAMAGE") },
{ val: RIN_PROTECTION, nm: _("RIN_PROTECTION") },
        /* 'PROTECTION' intrinsic enhances MC from worn armor by +1
           regardless of ring's enchantment; wearing a second ring of
           protection (or even one ring of protection combined with
           cloak of protection) doesn't give a second MC boost */
{ val: RIN_REGENERATION, nm: _("RIN_REGENERATION") },
{ val: RIN_SEARCHING, nm: _("RIN_SEARCHING") },
{ val: RIN_STEALTH, nm: _("RIN_STEALTH") },
{ val: RIN_SUSTAIN_ABILITY, nm: _("RIN_SUSTAIN_ABILITY") },
{ val: RIN_LEVITATION, nm: _("RIN_LEVITATION") },
{ val: RIN_HUNGER, nm: _("RIN_HUNGER") },
{ val: RIN_AGGRAVATE_MONSTER, nm: _("RIN_AGGRAVATE_MONSTER") },
{ val: RIN_CONFLICT, nm: _("RIN_CONFLICT") },
{ val: RIN_WARNING, nm: _("RIN_WARNING") },
{ val: RIN_POISON_RESISTANCE, nm: _("RIN_POISON_RESISTANCE") },
{ val: RIN_FIRE_RESISTANCE, nm: _("RIN_FIRE_RESISTANCE") },
{ val: RIN_COLD_RESISTANCE, nm: _("RIN_COLD_RESISTANCE") },
{ val: RIN_SHOCK_RESISTANCE, nm: _("RIN_SHOCK_RESISTANCE") },
{ val: RIN_FREE_ACTION, nm: _("RIN_FREE_ACTION") },
{ val: RIN_SLOW_DIGESTION, nm: _("RIN_SLOW_DIGESTION") },
{ val: RIN_TELEPORTATION, nm: _("RIN_TELEPORTATION") },
{ val: RIN_TELEPORT_CONTROL, nm: _("RIN_TELEPORT_CONTROL") },
{ val: RIN_POLYMORPH, nm: _("RIN_POLYMORPH") },
{ val: RIN_POLYMORPH_CONTROL, nm: _("RIN_POLYMORPH_CONTROL") },
{ val: RIN_INVISIBILITY, nm: _("RIN_INVISIBILITY") },
{ val: RIN_SEE_INVISIBLE, nm: _("RIN_SEE_INVISIBLE") },
{ val: RIN_PROTECTION_FROM_SHAPE_CHAN, nm: _("RIN_PROTECTION_FROM_SHAPE_CHAN") },

/* amulets ... - THE Amulet comes last because it is special */

{ val: AMULET_OF_ESP, nm: _("AMULET_OF_ESP") },

{ val: AMULET_OF_LIFE_SAVING, nm: _("AMULET_OF_LIFE_SAVING") },
{ val: AMULET_OF_STRANGULATION, nm: _("AMULET_OF_STRANGULATION") },
{ val: AMULET_OF_RESTFUL_SLEEP, nm: _("AMULET_OF_RESTFUL_SLEEP") },
{ val: AMULET_VERSUS_POISON, nm: _("AMULET_VERSUS_POISON") },
{ val: AMULET_OF_CHANGE, nm: _("AMULET_OF_CHANGE") },
{ val: AMULET_OF_UNCHANGING, nm: _("AMULET_OF_UNCHANGING") },
{ val: AMULET_OF_REFLECTION, nm: _("AMULET_OF_REFLECTION") },
{ val: AMULET_OF_MAGICAL_BREATHING, nm: _("AMULET_OF_MAGICAL_BREATHING") },
        /* +2 AC and +2 MC; +2 takes naked hero past 'warded' to 'guarded' */
{ val: AMULET_OF_GUARDING, nm: _("AMULET_OF_GUARDING") },
        /* cubical: some descriptions are already three dimensional and
           parallelogrammatical (real word!) would be way over the top */
{ val: AMULET_OF_FLYING, nm: _("AMULET_OF_FLYING") },
/* fixed descriptions; description duplication is deliberate;
 * fake one must come before real one because selection for
 * description shuffling stops when a non-magic amulet is encountered
 */
{ val: FAKE_AMULET_OF_YENDOR, nm: _("FAKE_AMULET_OF_YENDOR") },
{ val: AMULET_OF_YENDOR, nm: _("AMULET_OF_YENDOR") },

/* tools ... */
/* tools with weapon characteristics come last */

/* containers */
{ val: LARGE_BOX, nm: _("LARGE_BOX") },
{ val: CHEST, nm: _("CHEST") },
{ val: ICE_BOX, nm: _("ICE_BOX") },
{ val: SACK, nm: _("SACK") },
{ val: OILSKIN_SACK, nm: _("OILSKIN_SACK") },
{ val: BAG_OF_HOLDING, nm: _("BAG_OF_HOLDING") },
{ val: BAG_OF_TRICKS, nm: _("BAG_OF_TRICKS") },

/* lock opening tools */
{ val: SKELETON_KEY, nm: _("SKELETON_KEY") },
{ val: LOCK_PICK, nm: _("LOCK_PICK") },
{ val: CREDIT_CARD, nm: _("CREDIT_CARD") },
/* light sources */
{ val: TALLOW_CANDLE, nm: _("TALLOW_CANDLE") },
{ val: WAX_CANDLE, nm: _("WAX_CANDLE") },
{ val: BRASS_LANTERN, nm: _("BRASS_LANTERN") },
{ val: OIL_LAMP, nm: _("OIL_LAMP") },
{ val: MAGIC_LAMP, nm: _("MAGIC_LAMP") },
/* other tools */
{ val: EXPENSIVE_CAMERA, nm: _("EXPENSIVE_CAMERA") },
{ val: MIRROR, nm: _("MIRROR") },
{ val: CRYSTAL_BALL, nm: _("CRYSTAL_BALL") },
/* eyewear - tools which can be worn on the face; (!mrg !chg !mgc)
   worn lenses don't confer the Blinded property blindfolds and towels do;
   wet towel can be used as a weapon but is not a weptool and uses obj->spe
   differently from weapons and weptools */
{ val: LENSES, nm: _("LENSES") },
{ val: BLINDFOLD, nm: _("BLINDFOLD") },
{ val: TOWEL, nm: _("TOWEL") },

/* still other tools */
{ val: SADDLE, nm: _("SADDLE") },
{ val: LEASH, nm: _("LEASH") },
{ val: STETHOSCOPE, nm: _("STETHOSCOPE") },
{ val: TINNING_KIT, nm: _("TINNING_KIT") },
{ val: TIN_OPENER, nm: _("TIN_OPENER") },
{ val: CAN_OF_GREASE, nm: _("CAN_OF_GREASE") },
{ val: FIGURINE, nm: _("FIGURINE") },
        /* monster type specified by obj->corpsenm */
{ val: MAGIC_MARKER, nm: _("MAGIC_MARKER") },
/* traps */
{ val: LAND_MINE, nm: _("LAND_MINE") },
{ val: BEARTRAP, nm: _("BEARTRAP") },
/* instruments;
   "If tin whistles are made out of tin what do they make foghorns out of?" */
{ val: TIN_WHISTLE, nm: _("TIN_WHISTLE") },
{ val: MAGIC_WHISTLE, nm: _("MAGIC_WHISTLE") },
{ val: WOODEN_FLUTE, nm: _("WOODEN_FLUTE") },
{ val: MAGIC_FLUTE, nm: _("MAGIC_FLUTE") },
{ val: TOOLED_HORN, nm: _("TOOLED_HORN") },
{ val: FROST_HORN, nm: _("FROST_HORN") },
{ val: FIRE_HORN, nm: _("FIRE_HORN") },
{ val: HORN_OF_PLENTY, nm: _("HORN_OF_PLENTY") },
        /* horn but not an instrument */
{ val: WOODEN_HARP, nm: _("WOODEN_HARP") },
{ val: MAGIC_HARP, nm: _("MAGIC_HARP") },
{ val: BELL, nm: _("BELL") },
{ val: BUGLE, nm: _("BUGLE") },
{ val: LEATHER_DRUM, nm: _("LEATHER_DRUM") },
{ val: DRUM_OF_EARTHQUAKE, nm: _("DRUM_OF_EARTHQUAKE") },
/* tools useful as weapons */
{ val: PICK_AXE, nm: _("PICK_AXE") },
{ val: GRAPPLING_HOOK, nm: _("GRAPPLING_HOOK") },
{ val: UNICORN_HORN, nm: _("UNICORN_HORN") },
        /* 3.4.1: unicorn horn left classified as "magic" */
/* two unique tools;
 * not artifacts despite the comment which used to be here
 */
{ val: CANDELABRUM_OF_INVOCATION, nm: _("CANDELABRUM_OF_INVOCATION") },
{ val: BELL_OF_OPENING, nm: _("BELL_OF_OPENING") },

/* Comestibles ... */

/* All types of food (except tins & corpses) must have a delay of at least 1.
 * Delay on corpses is computed and is weight dependent.
 * Domestic pets prefer tripe rations above all others.
 * Fortune cookies can be read using them up without ingesting them.
 * Carrots improve your vision.
 * +0 tins contain monster meat.
 * +1 tins (of spinach) make you stronger (like Popeye).
 * Meatballs/sticks/rings are only created from objects via stone to flesh.
 */
/* meat */
{ val: TRIPE_RATION, nm: _("TRIPE_RATION") },
{ val: CORPSE, nm: _("CORPSE") },
{ val: EGG, nm: _("EGG") },
{ val: MEATBALL, nm: _("MEATBALL") },
{ val: MEAT_STICK, nm: _("MEAT_STICK") },
/* formerly "huge chunk of meat" */
{ val: ENORMOUS_MEATBALL, nm: _("ENORMOUS_MEATBALL") },
/* special case because it's not mergeable */
{ val: MEAT_RING, nm: _("MEAT_RING") },
/* pudding 'corpses' will turn into these and combine;
   must be in same order as the pudding monsters */
{ val: GLOB_OF_GRAY_OOZE, nm: _("GLOB_OF_GRAY_OOZE") },
{ val: GLOB_OF_BROWN_PUDDING, nm: _("GLOB_OF_BROWN_PUDDING") },
{ val: GLOB_OF_GREEN_SLIME, nm: _("GLOB_OF_GREEN_SLIME") },
{ val: GLOB_OF_BLACK_PUDDING, nm: _("GLOB_OF_BLACK_PUDDING") },

/* fruits & veggies */
{ val: KELP_FROND, nm: _("KELP_FROND") },
{ val: EUCALYPTUS_LEAF, nm: _("EUCALYPTUS_LEAF") },
{ val: APPLE, nm: _("APPLE") },
{ val: ORANGE, nm: _("ORANGE") },
{ val: PEAR, nm: _("PEAR") },
{ val: MELON, nm: _("MELON") },
{ val: BANANA, nm: _("BANANA") },
{ val: CARROT, nm: _("CARROT") },
{ val: SPRIG_OF_WOLFSBANE, nm: _("SPRIG_OF_WOLFSBANE") },
{ val: CLOVE_OF_GARLIC, nm: _("CLOVE_OF_GARLIC") },
/* name of slime mold is changed based on player's OPTION=fruit:something
   and bones data might have differently named ones from prior games */
{ val: SLIME_MOLD, nm: _("SLIME_MOLD") },

/* people food */
{ val: LUMP_OF_ROYAL_JELLY, nm: _("LUMP_OF_ROYAL_JELLY") },
{ val: CREAM_PIE, nm: _("CREAM_PIE") },
{ val: CANDY_BAR, nm: _("CANDY_BAR") },
{ val: FORTUNE_COOKIE, nm: _("FORTUNE_COOKIE") },
{ val: PANCAKE, nm: _("PANCAKE") },
{ val: LEMBAS_WAFER, nm: _("LEMBAS_WAFER") },
{ val: CRAM_RATION, nm: _("CRAM_RATION") },
{ val: FOOD_RATION, nm: _("FOOD_RATION") },
{ val: K_RATION, nm: _("K_RATION") },
{ val: C_RATION, nm: _("C_RATION") },
/* tins have type specified by obj->spe (+1 for spinach other implies
   flesh; negative specifies preparation method {homemadeboiled&c})
   and by obj->corpsenm (type of monster flesh) */
{ val: TIN, nm: _("TIN") },

/* potions ... */

{ val: POT_GAIN_ABILITY, nm: _("POT_GAIN_ABILITY") },
{ val: POT_RESTORE_ABILITY, nm: _("POT_RESTORE_ABILITY") },
{ val: POT_CONFUSION, nm: _("POT_CONFUSION") },
{ val: POT_BLINDNESS, nm: _("POT_BLINDNESS") },
{ val: POT_PARALYSIS, nm: _("POT_PARALYSIS") },
{ val: POT_SPEED, nm: _("POT_SPEED") },
{ val: POT_LEVITATION, nm: _("POT_LEVITATION") },
{ val: POT_HALLUCINATION, nm: _("POT_HALLUCINATION") },
{ val: POT_INVISIBILITY, nm: _("POT_INVISIBILITY") },
{ val: POT_SEE_INVISIBLE, nm: _("POT_SEE_INVISIBLE") },
{ val: POT_HEALING, nm: _("POT_HEALING") },
{ val: POT_EXTRA_HEALING, nm: _("POT_EXTRA_HEALING") },
{ val: POT_GAIN_LEVEL, nm: _("POT_GAIN_LEVEL") },
{ val: POT_ENLIGHTENMENT, nm: _("POT_ENLIGHTENMENT") },
{ val: POT_MONSTER_DETECTION, nm: _("POT_MONSTER_DETECTION") },
{ val: POT_OBJECT_DETECTION, nm: _("POT_OBJECT_DETECTION") },
{ val: POT_GAIN_ENERGY, nm: _("POT_GAIN_ENERGY") },
{ val: POT_SLEEPING, nm: _("POT_SLEEPING") },
{ val: POT_FULL_HEALING, nm: _("POT_FULL_HEALING") },
{ val: POT_POLYMORPH, nm: _("POT_POLYMORPH") },
{ val: POT_BOOZE, nm: _("POT_BOOZE") },
{ val: POT_SICKNESS, nm: _("POT_SICKNESS") },
{ val: POT_FRUIT_JUICE, nm: _("POT_FRUIT_JUICE") },
{ val: POT_ACID, nm: _("POT_ACID") },
{ val: POT_OIL, nm: _("POT_OIL") },
/* fixed description
 */
{ val: POT_WATER, nm: _("POT_WATER") },

/* scrolls ... */

{ val: SCR_ENCHANT_ARMOR, nm: _("SCR_ENCHANT_ARMOR") },
{ val: SCR_DESTROY_ARMOR, nm: _("SCR_DESTROY_ARMOR") },
{ val: SCR_CONFUSE_MONSTER, nm: _("SCR_CONFUSE_MONSTER") },
{ val: SCR_SCARE_MONSTER, nm: _("SCR_SCARE_MONSTER") },
{ val: SCR_REMOVE_CURSE, nm: _("SCR_REMOVE_CURSE") },
{ val: SCR_ENCHANT_WEAPON, nm: _("SCR_ENCHANT_WEAPON") },
{ val: SCR_CREATE_MONSTER, nm: _("SCR_CREATE_MONSTER") },
{ val: SCR_TAMING, nm: _("SCR_TAMING") },
{ val: SCR_GENOCIDE, nm: _("SCR_GENOCIDE") },
{ val: SCR_LIGHT, nm: _("SCR_LIGHT") },
{ val: SCR_TELEPORTATION, nm: _("SCR_TELEPORTATION") },
{ val: SCR_GOLD_DETECTION, nm: _("SCR_GOLD_DETECTION") },
{ val: SCR_FOOD_DETECTION, nm: _("SCR_FOOD_DETECTION") },
{ val: SCR_IDENTIFY, nm: _("SCR_IDENTIFY") },
{ val: SCR_MAGIC_MAPPING, nm: _("SCR_MAGIC_MAPPING") },
{ val: SCR_AMNESIA, nm: _("SCR_AMNESIA") },
{ val: SCR_FIRE, nm: _("SCR_FIRE") },
{ val: SCR_EARTH, nm: _("SCR_EARTH") },
{ val: SCR_PUNISHMENT, nm: _("SCR_PUNISHMENT") },
{ val: SCR_CHARGING, nm: _("SCR_CHARGING") },
{ val: SCR_STINKING_CLOUD, nm: _("SCR_STINKING_CLOUD") },
    /* Extra descriptions shuffled into use at start of new game.
     * Code in win/share/tilemap.c depends on SCR_STINKING_CLOUD preceding
     * these and on how many of them there are.  If a real scroll gets added
     * after stinking cloud or the number of extra descriptions changes
     * tilemap.c must be modified to match.  MgcProbCost are superfluous.
     * SC values must be distinct but are only used by 'nethack --dumpenums'.
     */

{ val: SC01, nm: _("SC01") },
{ val: SC02, nm: _("SC02") },
{ val: SC03, nm: _("SC03") },
{ val: SC04, nm: _("SC04") },
{ val: SC05, nm: _("SC05") },
{ val: SC06, nm: _("SC06") },
{ val: SC07, nm: _("SC07") }, /* Illuminati */
{ val: SC08, nm: _("SC08") }, /* Kurd Lasswitz */
{ val: SC09, nm: _("SC09") }, /* traditional incantation */
{ val: SC10, nm: _("SC10") }, /* Portal */
{ val: SC11, nm: _("SC11") }, /* Zak McKracken */
{ val: SC12, nm: _("SC12") }, /* Zak McKracken */
{ val: SC13, nm: _("SC13") },
{ val: SC14, nm: _("SC14") }, /* Merseburg Incantations */
{ val: SC15, nm: _("SC15") }, /* Merseburg Incantations */
{ val: SC16, nm: _("SC16") }, /* pronounced as 'fish'
                                                * George Bernard Shaw */
{ val: SC17, nm: _("SC17") }, /* Wizardry */
{ val: SC18, nm: _("SC18") }, /* Ultima */
{ val: SC19, nm: _("SC19") }, /* Aarne Haapakoski */
{ val: SC20, nm: _("SC20") }, /* Czech and Slovak
                                                * tongue-twister */

    /* These must come last because they have special fixed descriptions.
     */

{ val: SCR_MAIL, nm: _("SCR_MAIL") },

{ val: SCR_BLANK_PAPER, nm: _("SCR_BLANK_PAPER") },

/* spellbooks ... */
    /* Expanding beyond 52 spells would require changes in spellcasting
     * or imposition of a limit on number of spells hero can know because
     * they are currently assigned successive letters a-zA-Z when learned.
     * [The existing spell sorting capability could conceivably be extended
     * to enable moving spells from beyond Z to within it bumping others
     * out in the process allowing more than 52 spells be known but keeping
     * only 52 be castable at any given time.]
     */

/* Spellbook description normally refers to book covers (primarily color).
   Parchment and vellum would never be used for such but rather than
   eliminate those finagle their definitions to refer to the pages
   rather than the cover.  They are made from animal skin (typically of
   a goat or sheep) and books using them for pages generally need heavy
   covers with straps or clamps to tightly close the book in order to
   keep the pages flat.  (However a wooden cover might itself be covered
   by a sheet of parchment making this become less of an exception.  Also
   changing the internal composition from paper to leather makes eating a
   parchment or vellum spellbook break vegetarian conduct as it should.) */

{ val: SPE_DIG, nm: _("SPE_DIG") },

/* magic missile ... finger of death must be in this order; see buzz() */
{ val: SPE_MAGIC_MISSILE, nm: _("SPE_MAGIC_MISSILE") },

{ val: SPE_FIREBALL, nm: _("SPE_FIREBALL") },
{ val: SPE_CONE_OF_COLD, nm: _("SPE_CONE_OF_COLD") },
{ val: SPE_SLEEP, nm: _("SPE_SLEEP") },
{ val: SPE_FINGER_OF_DEATH, nm: _("SPE_FINGER_OF_DEATH") },
{ val: SPE_LIGHT, nm: _("SPE_LIGHT") },
{ val: SPE_DETECT_MONSTERS, nm: _("SPE_DETECT_MONSTERS") },
{ val: SPE_HEALING, nm: _("SPE_HEALING") },
{ val: SPE_KNOCK, nm: _("SPE_KNOCK") },
{ val: SPE_FORCE_BOLT, nm: _("SPE_FORCE_BOLT") },
{ val: SPE_CONFUSE_MONSTER, nm: _("SPE_CONFUSE_MONSTER") },
{ val: SPE_CURE_BLINDNESS, nm: _("SPE_CURE_BLINDNESS") },
{ val: SPE_DRAIN_LIFE, nm: _("SPE_DRAIN_LIFE") },
{ val: SPE_SLOW_MONSTER, nm: _("SPE_SLOW_MONSTER") },
{ val: SPE_WIZARD_LOCK, nm: _("SPE_WIZARD_LOCK") },
{ val: SPE_CREATE_MONSTER, nm: _("SPE_CREATE_MONSTER") },
{ val: SPE_DETECT_FOOD, nm: _("SPE_DETECT_FOOD") },
{ val: SPE_CAUSE_FEAR, nm: _("SPE_CAUSE_FEAR") },
{ val: SPE_CLAIRVOYANCE, nm: _("SPE_CLAIRVOYANCE") },
{ val: SPE_CURE_SICKNESS, nm: _("SPE_CURE_SICKNESS") },
{ val: SPE_CHARM_MONSTER, nm: _("SPE_CHARM_MONSTER") },
{ val: SPE_HASTE_SELF, nm: _("SPE_HASTE_SELF") },
{ val: SPE_DETECT_UNSEEN, nm: _("SPE_DETECT_UNSEEN") },
{ val: SPE_LEVITATION, nm: _("SPE_LEVITATION") },
{ val: SPE_EXTRA_HEALING, nm: _("SPE_EXTRA_HEALING") },
{ val: SPE_RESTORE_ABILITY, nm: _("SPE_RESTORE_ABILITY") },
{ val: SPE_INVISIBILITY, nm: _("SPE_INVISIBILITY") },
{ val: SPE_DETECT_TREASURE, nm: _("SPE_DETECT_TREASURE") },
{ val: SPE_REMOVE_CURSE, nm: _("SPE_REMOVE_CURSE") },
{ val: SPE_MAGIC_MAPPING, nm: _("SPE_MAGIC_MAPPING") },
{ val: SPE_IDENTIFY, nm: _("SPE_IDENTIFY") },
{ val: SPE_TURN_UNDEAD, nm: _("SPE_TURN_UNDEAD") },
{ val: SPE_POLYMORPH, nm: _("SPE_POLYMORPH") },
{ val: SPE_TELEPORT_AWAY, nm: _("SPE_TELEPORT_AWAY") },
{ val: SPE_CREATE_FAMILIAR, nm: _("SPE_CREATE_FAMILIAR") },
{ val: SPE_CANCELLATION, nm: _("SPE_CANCELLATION") },
{ val: SPE_PROTECTION, nm: _("SPE_PROTECTION") },
{ val: SPE_JUMPING, nm: _("SPE_JUMPING") },
{ val: SPE_STONE_TO_FLESH, nm: _("SPE_STONE_TO_FLESH") },
{ val: SPE_CHAIN_LIGHTNING, nm: _("SPE_CHAIN_LIGHTNING") },

/* books with fixed descriptions
 */
{ val: SPE_BLANK_PAPER, nm: _("SPE_BLANK_PAPER") },
/* LAST_SPELL is used to calculate MAXSPELL allocation size of spl_book[];
   by including blank paper which has no actual spell we ensure that
   even if hero learns every spell spl_book[] will have at least one
   unused slot at end; an unused slot is needed for use as terminator */

/* tribute book added in 3.6 */
{ val: SPE_NOVEL, nm: _("SPE_NOVEL") },
/* a special one of a kind spellbook */
{ val: SPE_BOOK_OF_THE_DEAD, nm: _("SPE_BOOK_OF_THE_DEAD") },

/* wands ... */

{ val: WAN_LIGHT, nm: _("WAN_LIGHT") },
{ val: WAN_SECRET_DOOR_DETECTION, nm: _("WAN_SECRET_DOOR_DETECTION") },
{ val: WAN_ENLIGHTENMENT, nm: _("WAN_ENLIGHTENMENT") },
{ val: WAN_CREATE_MONSTER, nm: _("WAN_CREATE_MONSTER") },
{ val: WAN_WISHING, nm: _("WAN_WISHING") },
{ val: WAN_STASIS, nm: _("WAN_STASIS") },
{ val: WAN_NOTHING, nm: _("WAN_NOTHING") },
{ val: WAN_STRIKING, nm: _("WAN_STRIKING") },
{ val: WAN_MAKE_INVISIBLE, nm: _("WAN_MAKE_INVISIBLE") },
{ val: WAN_SLOW_MONSTER, nm: _("WAN_SLOW_MONSTER") },
{ val: WAN_SPEED_MONSTER, nm: _("WAN_SPEED_MONSTER") },
{ val: WAN_UNDEAD_TURNING, nm: _("WAN_UNDEAD_TURNING") },
{ val: WAN_POLYMORPH, nm: _("WAN_POLYMORPH") },
{ val: WAN_CANCELLATION, nm: _("WAN_CANCELLATION") },
{ val: WAN_TELEPORTATION, nm: _("WAN_TELEPORTATION") },
{ val: WAN_OPENING, nm: _("WAN_OPENING") },
{ val: WAN_LOCKING, nm: _("WAN_LOCKING") },
{ val: WAN_PROBING, nm: _("WAN_PROBING") },
{ val: WAN_DIGGING, nm: _("WAN_DIGGING") },
/* magic missile ... lightning must be in this order; see buzz() */
{ val: WAN_MAGIC_MISSILE, nm: _("WAN_MAGIC_MISSILE") },
{ val: WAN_FIRE, nm: _("WAN_FIRE") },
{ val: WAN_COLD, nm: _("WAN_COLD") },
{ val: WAN_SLEEP, nm: _("WAN_SLEEP") },
{ val: WAN_DEATH, nm: _("WAN_DEATH") },
{ val: WAN_LIGHTNING, nm: _("WAN_LIGHTNING") },
/* extra descriptions shuffled into use at start of new game */
{ val: WAN1, nm: _("WAN1") },
{ val: WAN2, nm: _("WAN2") },
{ val: WAN3, nm: _("WAN3") },

/* coins ... - so far gold is all there is */

{ val: GOLD_PIECE, nm: _("GOLD_PIECE") },

/* gems ... - includes stones and rocks but not boulders */

{ val: DILITHIUM_CRYSTAL, nm: _("DILITHIUM_CRYSTAL") },

{ val: DIAMOND, nm: _("DIAMOND") },
{ val: RUBY, nm: _("RUBY") },
{ val: JACINTH, nm: _("JACINTH") },
{ val: SAPPHIRE, nm: _("SAPPHIRE") },
{ val: BLACK_OPAL, nm: _("BLACK_OPAL") },
{ val: EMERALD, nm: _("EMERALD") },
{ val: TURQUOISE, nm: _("TURQUOISE") },
{ val: CITRINE, nm: _("CITRINE") },
{ val: AQUAMARINE, nm: _("AQUAMARINE") },
{ val: AMBER, nm: _("AMBER") },
{ val: TOPAZ, nm: _("TOPAZ") },
{ val: JET, nm: _("JET") },
{ val: OPAL, nm: _("OPAL") },
{ val: CHRYSOBERYL, nm: _("CHRYSOBERYL") },
{ val: GARNET, nm: _("GARNET") },
{ val: AMETHYST, nm: _("AMETHYST") },
{ val: JASPER, nm: _("JASPER") },
{ val: FLUORITE, nm: _("FLUORITE") },
{ val: OBSIDIAN, nm: _("OBSIDIAN") },
{ val: AGATE, nm: _("AGATE") },
{ val: JADE, nm: _("JADE") },

{ val: WORTHLESS_WHITE_GLASS, nm: _("WORTHLESS_WHITE_GLASS") },

{ val: WORTHLESS_BLUE_GLASS, nm: _("WORTHLESS_BLUE_GLASS") },
{ val: WORTHLESS_RED_GLASS, nm: _("WORTHLESS_RED_GLASS") },
{ val: WORTHLESS_YELLOWBROWN_GLASS, nm: _("WORTHLESS_YELLOWBROWN_GLASS") },
{ val: WORTHLESS_ORANGE_GLASS, nm: _("WORTHLESS_ORANGE_GLASS") },
{ val: WORTHLESS_YELLOW_GLASS, nm: _("WORTHLESS_YELLOW_GLASS") },
{ val: WORTHLESS_BLACK_GLASS, nm: _("WORTHLESS_BLACK_GLASS") },
{ val: WORTHLESS_GREEN_GLASS, nm: _("WORTHLESS_GREEN_GLASS") },
{ val: WORTHLESS_VIOLET_GLASS, nm: _("WORTHLESS_VIOLET_GLASS") },

/* Placement note: there is a wishable subrange for
 * "gray stones" in the o_ranges[] array in objnam.c
 * that is currently everything between luckstones and flint
 * (inclusive).
 */
{ val: LUCKSTONE, nm: _("LUCKSTONE") },
{ val: LOADSTONE, nm: _("LOADSTONE") },
{ val: TOUCHSTONE, nm: _("TOUCHSTONE") },
{ val: FLINT, nm: _("FLINT") },
{ val: ROCK, nm: _("ROCK") },

/* miscellaneous ... */
/* Note: boulders and rocks are not normally created at random; the
 * probabilities only come into effect when you try to polymorph them.
 * Boulders weigh more than MAX_CARR_CAP; statues use corpsenm to take
 * on a specific type and may act as containers (both affect weight).
 */
{ val: BOULDER, nm: _("BOULDER") },
{ val: STATUE, nm: _("STATUE") },

{ val: HEAVY_IRON_BALL, nm: _("HEAVY_IRON_BALL") },
        /* +d4 when "very heavy" */
{ val: IRON_CHAIN, nm: _("IRON_CHAIN") },
        /* +1 both l & s */

/* Venom is normally a transitory missile (spit by various creatures)
 * but can be wished for in wizard mode so could occur in bones data.
 */
{ val: BLINDING_VENOM, nm: _("BLINDING_VENOM") },
{ val: ACID_VENOM, nm: _("ACID_VENOM") },
    ];
}

// the records of defsym_cmap_dump[] from defsym.h, laid out like it
function defsym_cmap_dump_records() {
    return [
    { val: S_stone, nm: _("S_stone") },
    { val: S_vwall, nm: _("S_vwall") },
    { val: S_hwall, nm: _("S_hwall") },
    { val: S_tlcorn, nm: _("S_tlcorn") },
    { val: S_trcorn, nm: _("S_trcorn") },
    { val: S_blcorn, nm: _("S_blcorn") },
    { val: S_brcorn, nm: _("S_brcorn") },
    { val: S_crwall, nm: _("S_crwall") },
    { val: S_tuwall, nm: _("S_tuwall") },
    { val: S_tdwall, nm: _("S_tdwall") },
    { val: S_tlwall, nm: _("S_tlwall") },
    { val: S_trwall, nm: _("S_trwall") },

    { val: S_ndoor, nm: _("S_ndoor") },
    { val: S_vodoor, nm: _("S_vodoor") },
    { val: S_hodoor, nm: _("S_hodoor") },
    { val: S_vcdoor, nm: _("S_vcdoor") },
    { val: S_hcdoor, nm: _("S_hcdoor") },
    { val: S_bars, nm: _("S_bars") },
    { val: S_tree, nm: _("S_tree") },
    { val: S_room, nm: _("S_room") },
    { val: S_darkroom, nm: _("S_darkroom") },
    { val: S_engroom, nm: _("S_engroom") },
    { val: S_corr, nm: _("S_corr") },
    { val: S_litcorr, nm: _("S_litcorr") },
    { val: S_engrcorr, nm: _("S_engrcorr") },
    { val: S_upstair, nm: _("S_upstair") },
    { val: S_dnstair, nm: _("S_dnstair") },
    { val: S_upladder, nm: _("S_upladder") },
    { val: S_dnladder, nm: _("S_dnladder") },
    { val: S_brupstair, nm: _("S_brupstair") },
    { val: S_brdnstair, nm: _("S_brdnstair") },
    { val: S_brupladder, nm: _("S_brupladder") },
    { val: S_brdnladder, nm: _("S_brdnladder") },

    { val: S_altar, nm: _("S_altar") },

    { val: S_grave, nm: _("S_grave") },
    { val: S_throne, nm: _("S_throne") },
    { val: S_sink, nm: _("S_sink") },
    { val: S_fountain, nm: _("S_fountain") },

    { val: S_pool, nm: _("S_pool") },
    { val: S_ice, nm: _("S_ice") },
    { val: S_lava, nm: _("S_lava") },
    { val: S_lavawall, nm: _("S_lavawall") },
    { val: S_vodbridge, nm: _("S_vodbridge") },
    { val: S_hodbridge, nm: _("S_hodbridge") },
    { val: S_vcdbridge, nm: _("S_vcdbridge") },
    { val: S_hcdbridge, nm: _("S_hcdbridge") },
    { val: S_air, nm: _("S_air") },
    { val: S_cloud, nm: _("S_cloud") },

    { val: S_water, nm: _("S_water") },

    { val: S_arrow_trap, nm: _("S_arrow_trap") },
    { val: S_dart_trap, nm: _("S_dart_trap") },
    { val: S_falling_rock_trap, nm: _("S_falling_rock_trap") },
    { val: S_squeaky_board, nm: _("S_squeaky_board") },
    { val: S_bear_trap, nm: _("S_bear_trap") },
    { val: S_land_mine, nm: _("S_land_mine") },
    { val: S_rolling_boulder_trap, nm: _("S_rolling_boulder_trap") },
    { val: S_sleeping_gas_trap, nm: _("S_sleeping_gas_trap") },
    { val: S_rust_trap, nm: _("S_rust_trap") },
    { val: S_fire_trap, nm: _("S_fire_trap") },
    { val: S_pit, nm: _("S_pit") },
    { val: S_spiked_pit, nm: _("S_spiked_pit") },
    { val: S_hole, nm: _("S_hole") },
    { val: S_trap_door, nm: _("S_trap_door") },
    { val: S_teleportation_trap, nm: _("S_teleportation_trap") },
    { val: S_level_teleporter, nm: _("S_level_teleporter") },
    { val: S_magic_portal, nm: _("S_magic_portal") },
    { val: S_web, nm: _("S_web") },
    { val: S_statue_trap, nm: _("S_statue_trap") },
    { val: S_magic_trap, nm: _("S_magic_trap") },
    { val: S_anti_magic_trap, nm: _("S_anti_magic_trap") },
    { val: S_polymorph_trap, nm: _("S_polymorph_trap") },
    { val: S_vibrating_square, nm: _("S_vibrating_square") },
    { val: S_trapped_door, nm: _("S_trapped_door") },
    { val: S_trapped_chest, nm: _("S_trapped_chest") },

    { val: S_vbeam, nm: _("S_vbeam") },
    { val: S_hbeam, nm: _("S_hbeam") },
    { val: S_lslant, nm: _("S_lslant") },
    { val: S_rslant, nm: _("S_rslant") },

    { val: S_digbeam, nm: _("S_digbeam") },
    { val: S_flashbeam, nm: _("S_flashbeam") },
    { val: S_boomleft, nm: _("S_boomleft") },
    { val: S_boomright, nm: _("S_boomright") },

    { val: S_ss1, nm: _("S_ss1") },
    { val: S_ss2, nm: _("S_ss2") },
    { val: S_ss3, nm: _("S_ss3") },
    { val: S_ss4, nm: _("S_ss4") },
    { val: S_poisoncloud, nm: _("S_poisoncloud") },

    { val: S_goodpos, nm: _("S_goodpos") },

    { val: S_sw_tl, nm: _("S_sw_tl") },
    { val: S_sw_tc, nm: _("S_sw_tc") },
    { val: S_sw_tr, nm: _("S_sw_tr") },
    { val: S_sw_ml, nm: _("S_sw_ml") },
    { val: S_sw_mr, nm: _("S_sw_mr") },
    { val: S_sw_bl, nm: _("S_sw_bl") },
    { val: S_sw_bc, nm: _("S_sw_bc") },
    { val: S_sw_br, nm: _("S_sw_br") },

    { val: S_expl_tl, nm: _("S_expl_tl") },
    { val: S_expl_tc, nm: _("S_expl_tc") },
    { val: S_expl_tr, nm: _("S_expl_tr") },
    { val: S_expl_ml, nm: _("S_expl_ml") },
    { val: S_expl_mc, nm: _("S_expl_mc") },
    { val: S_expl_mr, nm: _("S_expl_mr") },
    { val: S_expl_bl, nm: _("S_expl_bl") },
    { val: S_expl_bc, nm: _("S_expl_bc") },
    { val: S_expl_br, nm: _("S_expl_br") },
    ];
}

// the records of defsym_mon_syms_dump[]: column 0 of defsym_h_records()
function defsym_mon_syms_dump_records() { return defsym_h_records().map((row) => row[0]); }

// the records of defsym_mon_defchars_dump[]: column 1 of defsym_h_records()
function defsym_mon_defchars_dump_records() { return defsym_h_records().map((row) => row[1]); }

// one row per entry of defsym.h: [defsym_mon_syms_dump[i], defsym_mon_defchars_dump[i]], laid out like it
function defsym_h_records() {
    return [
    [{ val: S_ANT, nm: _("S_ANT") }, { val: DEF_ANT, nm: _("DEF_ANT") }],
    [{ val: S_BLOB, nm: _("S_BLOB") }, { val: DEF_BLOB, nm: _("DEF_BLOB") }],
    [{ val: S_COCKATRICE, nm: _("S_COCKATRICE") }, { val: DEF_COCKATRICE, nm: _("DEF_COCKATRICE") }],
    [{ val: S_DOG, nm: _("S_DOG") }, { val: DEF_DOG, nm: _("DEF_DOG") }],
    [{ val: S_EYE, nm: _("S_EYE") }, { val: DEF_EYE, nm: _("DEF_EYE") }],
    [{ val: S_FELINE, nm: _("S_FELINE") }, { val: DEF_FELINE, nm: _("DEF_FELINE") }],
    [{ val: S_GREMLIN, nm: _("S_GREMLIN") }, { val: DEF_GREMLIN, nm: _("DEF_GREMLIN") }],

    [{ val: S_HUMANOID, nm: _("S_HUMANOID") }, { val: DEF_HUMANOID, nm: _("DEF_HUMANOID") }],

    [{ val: S_IMP, nm: _("S_IMP") }, { val: DEF_IMP, nm: _("DEF_IMP") }],
    [{ val: S_JELLY, nm: _("S_JELLY") }, { val: DEF_JELLY, nm: _("DEF_JELLY") }],
    [{ val: S_KOBOLD, nm: _("S_KOBOLD") }, { val: DEF_KOBOLD, nm: _("DEF_KOBOLD") }],
    [{ val: S_LEPRECHAUN, nm: _("S_LEPRECHAUN") }, { val: DEF_LEPRECHAUN, nm: _("DEF_LEPRECHAUN") }],
    [{ val: S_MIMIC, nm: _("S_MIMIC") }, { val: DEF_MIMIC, nm: _("DEF_MIMIC") }],
    [{ val: S_NYMPH, nm: _("S_NYMPH") }, { val: DEF_NYMPH, nm: _("DEF_NYMPH") }],
    [{ val: S_ORC, nm: _("S_ORC") }, { val: DEF_ORC, nm: _("DEF_ORC") }],
    [{ val: S_PIERCER, nm: _("S_PIERCER") }, { val: DEF_PIERCER, nm: _("DEF_PIERCER") }],

    [{ val: S_QUADRUPED, nm: _("S_QUADRUPED") }, { val: DEF_QUADRUPED, nm: _("DEF_QUADRUPED") }],
    [{ val: S_RODENT, nm: _("S_RODENT") }, { val: DEF_RODENT, nm: _("DEF_RODENT") }],
    [{ val: S_SPIDER, nm: _("S_SPIDER") }, { val: DEF_SPIDER, nm: _("DEF_SPIDER") }],
    [{ val: S_TRAPPER, nm: _("S_TRAPPER") }, { val: DEF_TRAPPER, nm: _("DEF_TRAPPER") }],

    [{ val: S_UNICORN, nm: _("S_UNICORN") }, { val: DEF_UNICORN, nm: _("DEF_UNICORN") }],
    [{ val: S_VORTEX, nm: _("S_VORTEX") }, { val: DEF_VORTEX, nm: _("DEF_VORTEX") }],
    [{ val: S_WORM, nm: _("S_WORM") }, { val: DEF_WORM, nm: _("DEF_WORM") }],
    [{ val: S_XAN, nm: _("S_XAN") }, { val: DEF_XAN, nm: _("DEF_XAN") }],

    [{ val: S_LIGHT, nm: _("S_LIGHT") }, { val: DEF_LIGHT, nm: _("DEF_LIGHT") }],
    [{ val: S_ZRUTY, nm: _("S_ZRUTY") }, { val: DEF_ZRUTY, nm: _("DEF_ZRUTY") }],
    [{ val: S_ANGEL, nm: _("S_ANGEL") }, { val: DEF_ANGEL, nm: _("DEF_ANGEL") }],
    [{ val: S_BAT, nm: _("S_BAT") }, { val: DEF_BAT, nm: _("DEF_BAT") }],
    [{ val: S_CENTAUR, nm: _("S_CENTAUR") }, { val: DEF_CENTAUR, nm: _("DEF_CENTAUR") }],
    [{ val: S_DRAGON, nm: _("S_DRAGON") }, { val: DEF_DRAGON, nm: _("DEF_DRAGON") }],

    [{ val: S_ELEMENTAL, nm: _("S_ELEMENTAL") }, { val: DEF_ELEMENTAL, nm: _("DEF_ELEMENTAL") }],
    [{ val: S_FUNGUS, nm: _("S_FUNGUS") }, { val: DEF_FUNGUS, nm: _("DEF_FUNGUS") }],
    [{ val: S_GNOME, nm: _("S_GNOME") }, { val: DEF_GNOME, nm: _("DEF_GNOME") }],

    [{ val: S_GIANT, nm: _("S_GIANT") }, { val: DEF_GIANT, nm: _("DEF_GIANT") }],
    [{ val: S_invisible, nm: _("S_invisible") }, { val: DEF_INVISIBLE, nm: _("DEF_INVISIBLE") }],
    [{ val: S_JABBERWOCK, nm: _("S_JABBERWOCK") }, { val: DEF_JABBERWOCK, nm: _("DEF_JABBERWOCK") }],
    [{ val: S_KOP, nm: _("S_KOP") }, { val: DEF_KOP, nm: _("DEF_KOP") }],
    [{ val: S_LICH, nm: _("S_LICH") }, { val: DEF_LICH, nm: _("DEF_LICH") }],
    [{ val: S_MUMMY, nm: _("S_MUMMY") }, { val: DEF_MUMMY, nm: _("DEF_MUMMY") }],
    [{ val: S_NAGA, nm: _("S_NAGA") }, { val: DEF_NAGA, nm: _("DEF_NAGA") }],
    [{ val: S_OGRE, nm: _("S_OGRE") }, { val: DEF_OGRE, nm: _("DEF_OGRE") }],
    [{ val: S_PUDDING, nm: _("S_PUDDING") }, { val: DEF_PUDDING, nm: _("DEF_PUDDING") }],
    [{ val: S_QUANTMECH, nm: _("S_QUANTMECH") }, { val: DEF_QUANTMECH, nm: _("DEF_QUANTMECH") }],
    [{ val: S_RUSTMONST, nm: _("S_RUSTMONST") }, { val: DEF_RUSTMONST, nm: _("DEF_RUSTMONST") }],
    [{ val: S_SNAKE, nm: _("S_SNAKE") }, { val: DEF_SNAKE, nm: _("DEF_SNAKE") }],
    [{ val: S_TROLL, nm: _("S_TROLL") }, { val: DEF_TROLL, nm: _("DEF_TROLL") }],

    [{ val: S_UMBER, nm: _("S_UMBER") }, { val: DEF_UMBER, nm: _("DEF_UMBER") }],
    [{ val: S_VAMPIRE, nm: _("S_VAMPIRE") }, { val: DEF_VAMPIRE, nm: _("DEF_VAMPIRE") }],
    [{ val: S_WRAITH, nm: _("S_WRAITH") }, { val: DEF_WRAITH, nm: _("DEF_WRAITH") }],
    [{ val: S_XORN, nm: _("S_XORN") }, { val: DEF_XORN, nm: _("DEF_XORN") }],

    [{ val: S_YETI, nm: _("S_YETI") }, { val: DEF_YETI, nm: _("DEF_YETI") }],
    [{ val: S_ZOMBIE, nm: _("S_ZOMBIE") }, { val: DEF_ZOMBIE, nm: _("DEF_ZOMBIE") }],
    [{ val: S_HUMAN, nm: _("S_HUMAN") }, { val: DEF_HUMAN, nm: _("DEF_HUMAN") }],

    [{ val: S_GHOST, nm: _("S_GHOST") }, { val: DEF_GHOST, nm: _("DEF_GHOST") }],
    [{ val: S_GOLEM, nm: _("S_GOLEM") }, { val: DEF_GOLEM, nm: _("DEF_GOLEM") }],
    [{ val: S_DEMON, nm: _("S_DEMON") }, { val: DEF_DEMON, nm: _("DEF_DEMON") }],

    [{ val: S_EEL, nm: _("S_EEL") }, { val: DEF_EEL, nm: _("DEF_EEL") }],

    [{ val: S_LIZARD, nm: _("S_LIZARD") }, { val: DEF_LIZARD, nm: _("DEF_LIZARD") }],
    [{ val: S_WORM_TAIL, nm: _("S_WORM_TAIL") }, { val: DEF_WORM_TAIL, nm: _("DEF_WORM_TAIL") }],
    [{ val: S_MIMIC_DEF, nm: _("S_MIMIC_DEF") }, { val: DEF_MIMIC_DEF, nm: _("DEF_MIMIC_DEF") }],
    ];
}

// the records of objclass_defchars_dump[]: column 0 of defsym_h_records2()
function objclass_defchars_dump_records() { return defsym_h_records2().map((row) => row[0]); }

// the records of objclass_classes_dump[]: column 1 of defsym_h_records2()
function objclass_classes_dump_records() { return defsym_h_records2().map((row) => row[1]); }

// the records of objclass_syms_dump[]: column 2 of defsym_h_records2()
function objclass_syms_dump_records() { return defsym_h_records2().map((row) => row[2]); }

// one row per entry of defsym.h: [objclass_defchars_dump[i], objclass_classes_dump[i], objclass_syms_dump[i]], laid out like it
function defsym_h_records2() {
    return [
    [{ val: ILLOBJ_SYM, nm: _("ILLOBJ_SYM") }, { val: ILLOBJ_CLASS, nm: _("ILLOBJ_CLASS") }, { val: S_strange_obj, nm: _("S_strange_obj") }],
    [{ val: WEAPON_SYM, nm: _("WEAPON_SYM") }, { val: WEAPON_CLASS, nm: _("WEAPON_CLASS") }, { val: S_weapon, nm: _("S_weapon") }],
    [{ val: ARMOR_SYM, nm: _("ARMOR_SYM") }, { val: ARMOR_CLASS, nm: _("ARMOR_CLASS") }, { val: S_armor, nm: _("S_armor") }],
    [{ val: RING_SYM, nm: _("RING_SYM") }, { val: RING_CLASS, nm: _("RING_CLASS") }, { val: S_ring, nm: _("S_ring") }],
    [{ val: AMULET_SYM, nm: _("AMULET_SYM") }, { val: AMULET_CLASS, nm: _("AMULET_CLASS") }, { val: S_amulet, nm: _("S_amulet") }],
    [{ val: TOOL_SYM, nm: _("TOOL_SYM") }, { val: TOOL_CLASS, nm: _("TOOL_CLASS") }, { val: S_tool, nm: _("S_tool") }],
    [{ val: FOOD_SYM, nm: _("FOOD_SYM") }, { val: FOOD_CLASS, nm: _("FOOD_CLASS") }, { val: S_food, nm: _("S_food") }],
    [{ val: POTION_SYM, nm: _("POTION_SYM") }, { val: POTION_CLASS, nm: _("POTION_CLASS") }, { val: S_potion, nm: _("S_potion") }],
    [{ val: SCROLL_SYM, nm: _("SCROLL_SYM") }, { val: SCROLL_CLASS, nm: _("SCROLL_CLASS") }, { val: S_scroll, nm: _("S_scroll") }],
    [{ val: SPBOOK_SYM, nm: _("SPBOOK_SYM") }, { val: SPBOOK_CLASS, nm: _("SPBOOK_CLASS") }, { val: S_book, nm: _("S_book") }],
    [{ val: WAND_SYM, nm: _("WAND_SYM") }, { val: WAND_CLASS, nm: _("WAND_CLASS") }, { val: S_wand, nm: _("S_wand") }],
    [{ val: GOLD_SYM, nm: _("GOLD_SYM") }, { val: COIN_CLASS, nm: _("COIN_CLASS") }, { val: S_coin, nm: _("S_coin") }],
    [{ val: GEM_SYM, nm: _("GEM_SYM") }, { val: GEM_CLASS, nm: _("GEM_CLASS") }, { val: S_gem, nm: _("S_gem") }],
    [{ val: ROCK_SYM, nm: _("ROCK_SYM") }, { val: ROCK_CLASS, nm: _("ROCK_CLASS") }, { val: S_rock, nm: _("S_rock") }],
    [{ val: BALL_SYM, nm: _("BALL_SYM") }, { val: BALL_CLASS, nm: _("BALL_CLASS") }, { val: S_ball, nm: _("S_ball") }],
    [{ val: CHAIN_SYM, nm: _("CHAIN_SYM") }, { val: CHAIN_CLASS, nm: _("CHAIN_CLASS") }, { val: S_chain, nm: _("S_chain") }],
    [{ val: VENOM_SYM, nm: _("VENOM_SYM") }, { val: VENOM_CLASS, nm: _("VENOM_CLASS") }, { val: S_venom, nm: _("S_venom") }],
    ];
}

// the records of arti_enum_dump[] from artilist.h, laid out like it
function arti_enum_dump_records() {
    return [
    { val: ART_NONARTIFACT, nm: _("ART_NONARTIFACT") },

    { val: ART_EXCALIBUR, nm: _("ART_EXCALIBUR") },
    /*
     *      Stormbringer only has a 2 because it can drain a level
     *      providing 8 more.
     */
    { val: ART_STORMBRINGER, nm: _("ART_STORMBRINGER") },
    /*
     *      Mjollnir can be thrown when wielded if hero has 25 Strength
     *      (usually via gauntlets of power but possible with rings of
     *      gain strength).  If the thrower is a Valkyrie Mjollnir will
     *      usually (99%) return and then usually (separate 99%) be caught
     *      and automatically be re-wielded.  When returning Mjollnir is
     *      not caught there is a 50:50 chance of hitting hero for damage
     *      and its lightning shock might destroy some wands and/or rings.
     *
     *      Monsters don't throw Mjollnir regardless of strength (not even
     *      fake-player valkyries).
     */
    { val: ART_MJOLLNIR, nm: _("ART_MJOLLNIR") },

    { val: ART_CLEAVER, nm: _("ART_CLEAVER") },

    /*
     *      Grimtooth glows in warning when elves are present but its
     *      damage bonus applies to all targets rather than just elves
     *      (handled as special case in spec_dbon()).
     */
    { val: ART_GRIMTOOTH, nm: _("ART_GRIMTOOTH") },
    /*
     *      Orcrist and Sting have same alignment as elves.
     *
     *      The combination of SPFX_WARN+SPFX_DFLAG2+M2_value will trigger
     *      EWarn_of_mon for all monsters that have the M2_value flag.
     *      Sting and Orcrist will warn of M2_ORC monsters.
     */
    { val: ART_ORCRIST, nm: _("ART_ORCRIST") }, /* actually light blue */

    { val: ART_STING, nm: _("ART_STING") },
    /*
     *      Magicbane is a bit different!  Its magic fanfare
     *      unbalances victims in addition to doing some damage.
     */
    { val: ART_MAGICBANE, nm: _("ART_MAGICBANE") },

    { val: ART_FROST_BRAND, nm: _("ART_FROST_BRAND") },

    { val: ART_FIRE_BRAND, nm: _("ART_FIRE_BRAND") },

    { val: ART_DRAGONBANE, nm: _("ART_DRAGONBANE") },

    { val: ART_DEMONBANE, nm: _("ART_DEMONBANE") },

    { val: ART_WEREBANE, nm: _("ART_WEREBANE") },

    { val: ART_GRAYSWANDIR, nm: _("ART_GRAYSWANDIR") },

    { val: ART_GIANTSLAYER, nm: _("ART_GIANTSLAYER") },

    { val: ART_OGRESMASHER, nm: _("ART_OGRESMASHER") },

    { val: ART_TROLLSBANE, nm: _("ART_TROLLSBANE") },

    /*
     *      Two problems:  1) doesn't let trolls regenerate heads
     *      2) doesn't give unusual message for 2-headed monsters (but
     *      allowing those at all causes more problems than worth the effort).
     */
    { val: ART_VORPAL_BLADE, nm: _("ART_VORPAL_BLADE") },

    /*
     *      Ah never shall I forget the cry
     *              or the shriek that shrieked he
     *      As I gnashed my teeth and from my sheath
     *              I drew my Snickersnee!
     *                      --Ko-Ko Lord high executioner of Titipu
     *                        (From Sir W.S. Gilbert's "The Mikado")
     */
    { val: ART_SNICKERSNEE, nm: _("ART_SNICKERSNEE") },

    /* Sunsword emits light when wielded (handled in the core rather than
       via artifact fields) but that light has no particular color */
    { val: ART_SUNSWORD, nm: _("ART_SUNSWORD") },

    /*
     *      The artifacts for the quest dungeon all self-willed.
     *      gen_spe should be 0; gift_value irrelevant and set to 12.
     */

    { val: ART_ORB_OF_DETECTION, nm: _("ART_ORB_OF_DETECTION") },

    { val: ART_HEART_OF_AHRIMAN, nm: _("ART_HEART_OF_AHRIMAN") },

    { val: ART_SCEPTRE_OF_MIGHT, nm: _("ART_SCEPTRE_OF_MIGHT") },

    { val: ART_STAFF_OF_AESCULAPIUS, nm: _("ART_STAFF_OF_AESCULAPIUS") },

    { val: ART_MAGIC_MIRROR_OF_MERLIN, nm: _("ART_MAGIC_MIRROR_OF_MERLIN") },

    { val: ART_EYES_OF_THE_OVERWORLD, nm: _("ART_EYES_OF_THE_OVERWORLD") },

    { val: ART_MITRE_OF_HOLINESS, nm: _("ART_MITRE_OF_HOLINESS") },

    { val: ART_LONGBOW_OF_DIANA, nm: _("ART_LONGBOW_OF_DIANA") },

    /* MKoT has an additional carry property if the Key is not cursed (for
       rogues) or blessed (for non-rogues):  #untrap of doors and chests
       will always find any traps and disarming those will always succeed */
    { val: ART_MASTER_KEY_OF_THIEVERY, nm: _("ART_MASTER_KEY_OF_THIEVERY") },

    { val: ART_TSURUGI_OF_MURAMASA, nm: _("ART_TSURUGI_OF_MURAMASA") },

    { val: ART_YENDORIAN_EXPRESS_CARD, nm: _("ART_YENDORIAN_EXPRESS_CARD") },

    { val: ART_ORB_OF_FATE, nm: _("ART_ORB_OF_FATE") },

    { val: ART_EYE_OF_THE_AETHIOPICA, nm: _("ART_EYE_OF_THE_AETHIOPICA") },
    ];
}

// the records of mcastu_enum_dump[] from mcastu.h, laid out like it
function mcastu_enum_dump_records() {
    return [
{ val: MCAST_DUMPENUM_PSI_BOLT, nm: _("PSI_BOLT") },
{ val: MCAST_DUMPENUM_OPEN_WOUNDS, nm: _("OPEN_WOUNDS") },
{ val: MCAST_DUMPENUM_CURE_SELF, nm: _("CURE_SELF") },
{ val: MCAST_DUMPENUM_HASTE_SELF, nm: _("HASTE_SELF") },
{ val: MCAST_DUMPENUM_CONFUSE_YOU, nm: _("CONFUSE_YOU") },
{ val: MCAST_DUMPENUM_STUN_YOU, nm: _("STUN_YOU") },
{ val: MCAST_DUMPENUM_DISAPPEAR, nm: _("DISAPPEAR") },
{ val: MCAST_DUMPENUM_PARALYZE, nm: _("PARALYZE") },
{ val: MCAST_DUMPENUM_BLIND_YOU, nm: _("BLIND_YOU") },
{ val: MCAST_DUMPENUM_WEAKEN_YOU, nm: _("WEAKEN_YOU") },
{ val: MCAST_DUMPENUM_DESTRY_ARMR, nm: _("DESTRY_ARMR") },
{ val: MCAST_DUMPENUM_INSECTS, nm: _("INSECTS") },
{ val: MCAST_DUMPENUM_CURSE_ITEMS, nm: _("CURSE_ITEMS") },
{ val: MCAST_DUMPENUM_LIGHTNING, nm: _("LIGHTNING") },
{ val: MCAST_DUMPENUM_FIRE_PILLAR, nm: _("FIRE_PILLAR") },
{ val: MCAST_DUMPENUM_GEYSER, nm: _("GEYSER") },
{ val: MCAST_DUMPENUM_AGGRAVATION, nm: _("AGGRAVATION") },
{ val: MCAST_DUMPENUM_SUMMON_MONS, nm: _("SUMMON_MONS") },
{ val: MCAST_DUMPENUM_CLONE_WIZ, nm: _("CLONE_WIZ") },
{ val: MCAST_DUMPENUM_DEATH_TOUCH, nm: _("DEATH_TOUCH") },
    ];
}
