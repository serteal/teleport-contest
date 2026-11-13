/* NetHack 5.0	unixmain.c	$NHDT-Date: 1711213891 2024/03/23 17:11:31 $  $NHDT-Branch: NetHack-5.0 $:$NHDT-Revision: 1.127 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2011. */
/* NetHack may be freely redistributed.  See license for details. */

/* main.c - Unix NetHack */

export function nhjs_unix_main(argc$, argv$) { /* int */
    const $frame = stack_frame(); try {
    const argc = stack_var(int, argc$);
    const argv = stack_var(ptr_to(ptr_to(char)), argv$);
    var dir = stack_var(ptr_to(char), 0);
    var nhfp;
    var exact_username;
    var resuming = FALSE; /* assume new game */
    var plsel_once = FALSE;

    early_init(argc[0], argv[0]);
    rng_log_init();  /* 004-prng-logging: open log if NETHACK_RNGLOG is set */

    /* #if defined(__APPLE__): not in this build */

    gh.hname = argv[0][0];
    svh.hackpid = getpid();
    umask(0o777 & ~FCMASK);

    choose_windows(_(DEFAULT_WINDOW_SYS));

    /* #ifdef SND_LIB_INTEGRATED: not in this build */

    /*
     * See if we must change directory to the playground.
     * (Perhaps hack runs suid and playground is inaccessible
     *  for the player.)
     * The environment variable HACKDIR is overridden by a
     *  -d command line option (must be the first option given).
     */
    dir[0] = nh_getenv(_("NETHACKDIR"));
    if (!dir[0])
        dir[0] = nh_getenv(_("HACKDIR"));

    program_state.early_options = 1;
    /* handle -dalthackdir, -s <score stuff>, --version, --showpaths */
    early_options(argc, argv, dir);
    program_state.early_options = 0;

    /*
     * Change directories before we initialize the window system so
     * we can find the tile file.
     */
    chdirx(dir[0], TRUE);

    initoptions();

    exact_username = whoami();

    /*
     * It seems you really want to play.
     */
    u.uhp = 1; /* prevent RIP on early quits */

    program_state.preserve_locks = 1;

    sethanguphandler(hangup);

    process_options(argc[0], argv[0]); /* command line options */

    init_nhwindows()(argc, argv[0]); /* now we can set up window system */

    getmailstatus();

    /* wizard mode access is deferred until here */
    set_playmode(); /* sets plname to "wizard" for wizard mode */
    /* hide any hyphens from plnamesuffix() */
    gp.plnamelen = exact_username ? int(strlen(svp.plname)) : 0;
    /* strip role,race,&c suffix; calls askname() if plname[] is empty
       or holds a generic user name like "player" or "games" */
    plnamesuffix();

    if (wizard()) {
        /* use character name rather than lock letter for file names */
        gl.locknum = 0;
    } else {
        /* suppress interrupts while processing lock file */
        signal(SIGQUIT, SIG_IGN);
        signal(SIGINT, SIG_IGN);
    }

    ; /* must be before newgame() */

    /*
     * Initialize the vision system.  This must be before mklev() on a
     * new game or before a level restore on a saved game.
     */
    vision_init();

    init_sound_disp_gamewindows();

    /*
     * First, try to find and restore a save file for specified character.
     * We'll return here if new game player_selection() renames the hero.
     */
 attempt_restore: for (;;) {
    /*
     * getlock() complains and quits if there is already a game
     * in progress for current character name (when gl.locknum == 0)
     * or if there are too many active games (when gl.locknum > 0).
     * When proceeding, it creates an empty <lockname>.0 file to
     * designate the current game.
     * getlock() constructs <lockname> based on the character
     * name (for !gl.locknum) or on first available of alock, block,
     * clock, &c not currently in use in the playground directory
     * (for gl.locknum > 0).
     */
    if (chars[svp.plname]) {
        getlock();

        program_state.preserve_locks = 0; /* after getlock() */
    }

    if (chars[svp.plname] && (nhfp = restore_saved_game()) != null) {
        var fq_save = fqname(gs.SAVEF, SAVEPREFIX, 1);

        chmod(fq_save, 0); /* disallow parallel restores */

        signal(SIGINT, done1);

        if (iflags.news) {
            display_file()(_(NEWS), FALSE);
            iflags.news = FALSE; /* in case dorecover() fails */
        }

        /* if there are early trouble-messages issued, let's
         * not go overtop of them with a pline just yet */
        if (ge.early_raw_messages)
            raw_print()(_("Restoring save file..."));
        else
            pline(_("Restoring save file..."));
        mark_synch()(); /* flush output */
        if (dorecover(nhfp)) {
            resuming = TRUE; /* not starting new game */
            wd_message();
            if (discover() || wizard()) {
                /* this seems like a candidate for paranoid_confirmation... */
                if (y_n(_("Do you want to keep the save file?")) == ord('n')) {
                    delete_savefile();
                } else {
                    chmod(fq_save, FCMASK); /* back to readable */
                    nh_compress(fq_save);
                }
            }
        }
        if (program_state.in_self_recover) {
            program_state.in_self_recover = FALSE;
        }
    }

    if (!resuming) {
        var neednewlock = (+!chars[svp.plname]);
        /* new game:  start by choosing role, race, etc;
           player might change the hero's name while doing that,
           in which case we try to restore under the new name
           and skip selection this time if that didn't succeed */
        if (!iflags.renameinprogress || iflags.defer_plname || neednewlock) {
            if (!plsel_once)
                player_selection()();
            plsel_once = TRUE;
            if (neednewlock && chars[svp.plname])
                continue attempt_restore;;
            if (iflags.renameinprogress) {
                /* player has renamed the hero while selecting role;
                   if locking alphabetically, the existing lock file
                   can still be used; otherwise, discard current one
                   and create another for the new character name */
                if (!gl.locknum) {
                    delete_levelfile(0); /* remove empty lock file */
                    getlock();
                }
                continue attempt_restore;
            }
        }

        /* no save file; check for a panic save; if the check finds one,
           ask the player whether to proceed with a new game; it will
           quit instead of returning if the answer isn't yes */
        if (check_panic_save())
            ask_about_panic_save();

        /* no save file; start a new game */
        newgame();
        wd_message();
    } break; }

    /* moveloop() never returns but isn't flagged NORETURN */
    moveloop(resuming);

    exit(EXIT_SUCCESS);
    /*NOTREACHED*/
    return 0;
    } finally { stack_pop($frame); }
}

/* caveat: argv elements might be arbitrarily long */
function process_options(argc, argv) { /* void */
    let arg, origarg;
    let i, l;

    config_error_init(FALSE, _("command line"), FALSE);
    /*
     * Process options.
     *
     *  We don't support "-xyz" as shortcut for "-x -y -z" and we only
     *  simulate longopts by allowing "--foo" for "-foo" when the user
     *  specifies at least 2 characters of leading substring for "foo".
     *  If "foo" takes a value, both "--foo=value" and "--foo value" work.
     */
    while (argc > 1 && chars[argv[1] + 0] == ord('-')) {
        argv = argv.subarray(1);
        argc--;
        arg = origarg = argv[0];
        /* allow second dash if arg is longer than one character */
        if (chars[arg + 0] == ord('-') && chars[arg + 1] == ord('-') && chars[arg + 2] != ord('\0')
            /* "--a=b" violates the "--" ok when at least 2 chars long rule */
            && (chars[arg + 3] != ord('\0') && chars[arg + 3] != ord('=') && chars[arg + 3] != ord(':')))
            ++arg;
        l = int(strlen(arg));
        if (l < 6 && !strncmp(arg, _("-no-"), 4))
            l = 6;
        else if (l < 4)
            l = 4; /* must supply at least 4 chars to match "-XXXgraphics" */

        switch (chars[arg + 1]) {
        case ord('D'):
        case ord('d'):
            if ((chars[arg + 1] == ord('D') && !chars[arg + 2]) || !strncmpi((arg), _(("-debug")), -1)) {
                flags.debug = TRUE, flags.explore = FALSE;
            } else if (!strncmpi(arg, _("-DECgraphics"), l)) {
                load_symset(_("DECGraphics"), PRIMARYSET);
                switch_symbols(TRUE);
            } else {
                config_error_add(_("Unknown option: %.60s"), origarg);
            }
            break;
        case ord('X'):
            flags.explore = TRUE, flags.debug = FALSE;
            break;
        case ord('n'):

            if (!chars[arg + 2] || !strcmp(arg, _("-no-news"))) {
                iflags.news = FALSE;
                break;
            } else if (!strcmp(arg, _("-news"))) {
                /* in case RC has !news, allow 'nethack -news' to override */
                iflags.news = TRUE;
                break;
            }

            break;
        case ord('u'):
            if (chars[arg + 2]) {
                strncpy(svp.plname, arg + 2, sizeof_member(svp, "plname") - 1);
                gp.plnamelen = 0; /* plname[] might have -role-race attached */
            } else if (argc > 1) {
                argc--;
                argv = argv.subarray(1);
                strncpy(svp.plname, argv[0], sizeof_member(svp, "plname") - 1);
                gp.plnamelen = 0;
            } else {
                config_error_add(_("Character name expected after -u"));
            }
            break;
        case ord('I'):
        case ord('i'):
            if (!strncmpi(arg, _("-IBMgraphics"), l)) {
                load_symset(_("IBMGraphics"), PRIMARYSET);
                load_symset(_("RogueIBM"), ROGUESET);
                switch_symbols(TRUE);
            } else {
                config_error_add(_("Unknown option: %.60s"), origarg);
            }
            break;
        case ord('l'):

            if(!strncmp(arg, _("-loglua"), 7)){
                gl.loglua = 1;
            } else

                config_error_add(_("Unknown option: %.60s"), origarg);
            break;
        case ord('p'): /* profession (role) */
            if (chars[arg + 2]) {
                if ((i = str2role(arg + 2)) >= 0)
                    flags.initrole = i;
            } else if (argc > 1) {
                argc--;
                argv = argv.subarray(1);
                if ((i = str2role(argv[0])) >= 0)
                    flags.initrole = i;
            }
            break;
        case ord('r'): /* race */
            if (chars[arg + 2]) {
                if ((i = str2race(arg + 2)) >= 0)
                    flags.initrace = i;
            } else if (argc > 1) {
                argc--;
                argv = argv.subarray(1);
                if ((i = str2race(argv[0])) >= 0)
                    flags.initrace = i;
            }
            break;
        case ord('@'):
            flags.randomall = 1;
            break;
        case ord('-'):
            /* "--" or "--x" or "--x=y"; need at least 2 chars after the
               dashes in order to accept "--x" as an alternative to "-x";
               don't just silently ignore it */
            config_error_add(_("Unknown option: %.60s"), origarg);
            break;
        default:
            /* default for "-x" is to play as the role that starts with "x" */
            if ((i = str2role(argv[0] + 1)) >= 0) {
                flags.initrole = i;
                break;
            }
            /* else config_error_add("Unknown option: %.60s", origarg); */
        }
    }

    if (argc > 1) {
        let mxplyrs = atoi(argv[1]);
        let mx_ok = +(mxplyrs > 0);

        config_error_add(_("%s%s%s"),
                         mx_ok ? _("MAXPLAYERS are set in sysconf file")
                               : _("Expected MAXPLAYERS, found \""),
                         mx_ok ? _("") : argv[1], mx_ok ? _("") : _("\""));
    }

    /* let syscf override compile-time limit */
    if (!gl.locknum || (sysopt.maxplayers && gl.locknum > sysopt.maxplayers))
        gl.locknum = sysopt.maxplayers;

    /* empty or "N errors on command line" */
    config_error_done();
    return;
}

export function chdirx(dir, wr) { /* void */
    if (dir /* User specified directory? */

        && strcmp(dir, _(HACKDIR)) /* and not the default? */

        ) {
    } else {
        /* non-default data files is a sign that scores may not be
         * compatible, or perhaps that a binary not fitting this
         * system's layout is being used.
         */
    /* #ifdef VAR_PLAYGROUND: not in this build */
    }

    if (!dir)
        dir = _(HACKDIR);

    if (dir && chdir(dir) < 0) {
        perror(dir);
        error(_("Cannot chdir to %s."), dir);
        /*NOTREACHED*/
    }

    /* warn the player if we can't write the record file
     * perhaps we should also test whether . is writable
     * unfortunately the access system-call is worthless.
     */
    if (wr) {
        /* #ifdef VAR_PLAYGROUND: not in this build */

        check_recordfile(dir);
    }
    return;
}

/* returns True iff we set plname[] to username which contains a hyphen */
export function whoami() { /* boolean */
    /*
     * Who am i? Algorithm: 1. Use name as specified in NETHACKOPTIONS
     *                      2. Use $USER or $LOGNAME    (if 1. fails)
     *                      3. Use getlogin()           (if 2. fails)
     * The resulting name is overridden by command line options.
     * If everything fails, or if the resulting name is some generic
     * account like "games", "play", "player", "hack" then eventually
     * we'll ask him.
     * Note that we trust the user here; it is possible to play under
     * somebody else's name.
     */
    if (!chars[svp.plname]) {
        let s;

        s = nh_getenv(_("USER"));
        if (!s || !chars[s])
            s = nh_getenv(_("LOGNAME"));
        if (!s || !chars[s])
            s = getlogin();

        if (s && chars[s]) {
            strncpy(svp.plname, s, sizeof_member(svp, "plname") - 1);
            if (strchr(svp.plname, ord('-')))
                return TRUE;
        }
    }
    return FALSE;
}

export function sethanguphandler(handler) { /* void */
    const $frame = stack_frame(); try {
    /* don't want reads to restart.  If SA_RESTART is defined, we know
     * sigaction exists and can be used to ensure reads won't restart.
     * If it's not defined, assume reads do not restart.  If reads restart
     * and a signal occurs, the game won't do anything until the read
     * succeeds (or the stream returns EOF, which might not happen if
     * reading from, say, a window manager). */
    let sact = stack_struct(struct_sigaction);

    memset(addr_of(sact), 0, sizeof(struct_sigaction));
    sact.__sa_handler.sa_handler = handler;
    sigaction(SIGHUP, sact, null);

    sigaction(SIGXCPU, sact, null);
    } finally { stack_pop($frame); }
}

/* #ifdef PORT_HELP: not in this build */

/* validate wizard mode if player has requested access to it */
export function authorize_wizard_mode() { /* boolean */
    if (sysopt.wizards && chars[sysopt.wizards + 0]) {
        if (check_user_string(sysopt.wizards))
            return TRUE;
    }
    iflags.wiz_error_flag = TRUE; /* not being allowed into wizard mode */
    return FALSE;
}

/* similar to above, validate explore mode access */
export function authorize_explore_mode() { /* boolean */
    if (sysopt.explorers && chars[sysopt.explorers + 0]) {
        if (check_user_string(sysopt.explorers))
            return TRUE;
    }
    iflags.explore_error_flag = TRUE; /* not allowed into explore mode */
    return FALSE;
}

function wd_message() { /* void */
    if (iflags.wiz_error_flag) {
        if (sysopt.wizards && chars[sysopt.wizards + 0]) {
            let tmp = build_english_list(sysopt.wizards);
            pline(_("Only user%s %s may access debug (wizard) mode."),
                  strchr(sysopt.wizards, ord(' ')) ? _("s") : _(""), tmp);
            free(tmp);
        } else {
            You(_("cannot access debug (wizard) mode."));
        }
        flags.debug = FALSE; /* (paranoia) */
        if (!iflags.explore_error_flag)
            pline(_("Entering explore/discovery mode instead."));
    } else if (iflags.explore_error_flag) {
        You(_("cannot access explore mode.")); /* same as enter_explore_mode */
        flags.explore = iflags.deferred_X = FALSE; /* (more paranoia) */
    } else if (discover())
        You(_("are in non-scoring explore/discovery mode."));
}

/*
 * Add a slash to any name not ending in /. There must
 * be room for the /
 */
export function append_slash(name) { /* void */
    let ptr;

    if (!chars[name])
        return;
    ptr = name + unsigned(strlen(name) - 1);
    if (chars[ptr] != ord('/')) {
        chars[++ptr] = ord('/');
        chars[++ptr] = ord('\0');
    }
    return;
}

export function check_user_string(optstr) { /* boolean */
    let pw;
    let pwlen;
    let eop, w;
    let pwname = 0;

    if (chars[optstr + 0] == ord('*'))
        return TRUE; /* allow any user */
    if (sysopt.check_plname)
        pwname = svp.plname;
    else if ((pw = get_unix_pw()) != null)
        pwname = pw.pw_name;
    if (!pwname || !chars[pwname])
        return FALSE;
    pwlen = int(strlen(pwname));
    eop = eos(optstr); /* temporarily cast away 'const' */
    w = optstr;
    while (w + pwlen <= eop) {
        if (!chars[w])
            break;
        if (__isspace(chars[w])) {
            w++;
            continue;
        }
        if (!strncmp(w, pwname, unsigned(pwlen))) {
            if (!chars[w + pwlen] || __isspace(chars[w + pwlen]))
                return TRUE;
        }
        while (chars[w] && !__isspace(chars[w]))
            w++;
    }
    return FALSE;
}

function get_unix_pw() { /* struct passwd * */
    let user;
    let uid;
    let pw = static_var("get_unix_pw.pw", ptr_to(struct_passwd), null);

    if (pw[0])
        return pw[0]; /* cache answer */

    uid = getuid();
    user = getlogin();
    if (user) {
        pw[0] = getpwnam(user);
        if (pw[0] && ((pw[0].pw_uid) != uid))
            pw[0] = null;
    }
    if (pw[0] == null) {
        user = nh_getenv(_("USER"));
        if (user) {
            pw[0] = getpwnam(user);
            if (pw[0] && ((pw[0].pw_uid) != uid))
                pw[0] = null;
        }
        if (pw[0] == null) {
            pw[0] = getpwuid(uid);
        }
    }
    return pw[0];
}

export function get_login_name() { /* char * */
    let buf = static_array("get_login_name.buf", char, BUFSZ);
    let pw = get_unix_pw();

    chars[buf + 0] = ord('\0');
    if (pw)
        strcpy(buf, pw.pw_name);

    return buf;
}

/* #ifdef __APPLE__: not in this build */

export function sys_random_seed() { /* unsigned long long */
    /* Harness comparison testing: if NETHACK_SEED is set, use it directly.
     * Leave has_strong_rngseed false so reseed_random() remains a no-op. */
    {
        let env_seed = getenv(_("NETHACK_SEED"));
        if (env_seed) {
            let seed = strtoull(env_seed, null, 10);
            return seed;
        }
    }

    let seed = 0n;
    let pid = u64(ulong(getpid()));
    let no_seed = TRUE;
    /* #ifdef DEV_RANDOM: not in this build */

    if (no_seed) {
        seed = u64(ulong(getnow())); /* time((TIME_type) 0) */
        /* Quick dirty band-aid to prevent PRNG prediction */
        if (pid) {
            if (!(pid & 3n))
                pid = u64(pid - 1n);
            seed = u64(seed * pid);
        }
    }
    return seed;
}

export function get_nhuuid() { /* void */
/* #if defined(NHUUID): not in this build */
}

export function free_nhuuid() { /* void */
    let i;

    for (i = 0; i < (Math.trunc((sizeof_member(svn, "nhuuid") / sizeof(char)))); i++) {
        chars[svn.nhuuid + i] = 0;
    }
}
/*unixmain.c*/

import { DEFAULT_WINDOW_SYS, HACKDIR, NEWS } from "../../src/config.h.js";
import { discover, wizard } from "../../src/flag.h.macros.js";
import { BUFSZ, FALSE, TRUE } from "../../src/global.h.js";
import { SAVEPREFIX } from "../../src/hack.h.js";
import { y_n } from "../../src/hack.h.macros.js";
import { PRIMARYSET, ROGUESET } from "../../src/sym.h.js";
import { FCMASK } from "../../src/unixconf.h.js";
import {
    display_file, init_nhwindows, mark_synch, player_selection, raw_print,
} from "../../src/winprocs.h.macros.js";
import { struct_passwd, struct_sigaction } from "../../libc/records.js";
import { char, int, ord, sizeof, ulong, unsigned } from "../../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../../rt/heap.js";
import { u64 } from "../../rt/int64.js";
import {
    EXIT_SUCCESS, SIGHUP, SIGINT, SIGQUIT, SIGXCPU, SIG_IGN, __isspace, atoi, chdir, chmod, exit,
    free, getenv, getlogin, getpid, getpwnam, getpwuid, getuid, memset, perror, sigaction, signal,
    strchr, strcmp, strcpy, strlen, strncmp, strncpy, strtoull, umask,
} from "../../rt/libc.js";
import { stack_struct, stack_var, static_array, static_var } from "../../rt/locals.js";
import { _ } from "../../rt/strings.js";
import { addr_of, ptr_to, sizeof_member } from "../../rt/struct.js";
import { early_init, init_sound_disp_gamewindows, moveloop, newgame } from "../../src/allmain.js";
import { getnow } from "../../src/calendar.js";
import { config_error_add, config_error_done, config_error_init } from "../../src/cfgfiles.js";
import { hangup } from "../../src/cmd.js";
import {
    flags, ge, gh, gl, gp, gs, iflags, program_state, svh, svn, svp, u,
} from "../../src/decl.js";
import { early_options } from "../../src/earlyarg.js";
import { build_english_list, done1 } from "../../src/end.js";
import {
    check_panic_save, check_recordfile, delete_levelfile, delete_savefile, fqname, nh_compress,
    restore_saved_game,
} from "../../src/files.js";
import { eos, strncmpi } from "../../src/hacklib.js";
import { getmailstatus } from "../../src/mail.js";
import { initoptions, nh_getenv, set_playmode } from "../../src/options.js";
import { You, pline } from "../../src/pline.js";
import { dorecover } from "../../src/restore.js";
import { rng_log_init } from "../../src/rnd.js";
import { plnamesuffix, str2race, str2role } from "../../src/role.js";
import { load_symset, switch_symbols } from "../../src/symbols.js";
import { sysopt } from "../../src/sys.js";
import { vision_init } from "../../src/vision.js";
import { choose_windows } from "../../src/windows.js";
import { ask_about_panic_save, error } from "../c2js/nhjs_host.js";
import { getlock } from "../c2js/nhjs_tty_api.js";
