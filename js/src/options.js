/* NetHack 5.0	options.c	$NHDT-Date: 1737556914 2025/01/22 06:41:54 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.753 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2008. */
/* NetHack may be freely redistributed.  See license for details. */

/* whether the 'msg_window' option is used to control ^P behavior */

/*
 *  NOTE:  If you add (or delete) an option, please review the following:
 *             doc/options.txt
 *
 *         It contains how-to info and outlines some required/suggested
 *         updates that should accompany your change.
 */

/*
 * include/optlist.h is utilized 3 successive times, for 3 different
 * objectives.
 *
 * The first time is with NHOPT_PROTO defined, to produce and include
 * the prototypes for the individual option processing functions.
 *
 * The second time is with NHOPT_ENUM defined, to produce the enum values
 * for the individual options that are used throughout options processing.
 * They are generally opt_optname, where optname is the name of the option.
 *
 * The third time is with NHOPT_PARSE defined, to produce the initializers
 * to fill out the allopt[] array of options (both boolean and compound).
 *
 */

const allopt_init = static_array("allopt_init", struct_allopt_t, null, [
...allopt_init_records(),
    {name: 0, section: OptS_Advanced, minmatch: 0, expectedbuf: 0, idx: 0, setwhere: set_in_sysconf, opttyp: BoolOpt,
     negateok: No, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: 0, addr: 0,
     optfn: null,
     alias: 0, descr: 0, prefixgw: 0, initval: 0, has_handler: 0, dupdetected: 0, disregarded: TRUE }
]);

export const PILE_LIMIT_DFLT = 5;

    const MESSAGE_OPTION = 1;
    const STATUS_OPTION = MESSAGE_OPTION + 1;
    const MAP_OPTION = STATUS_OPTION + 1;
    const MENU_OPTION = MAP_OPTION + 1;
    const TEXT_OPTION = MENU_OPTION + 1;

    const optn_silenterr = -1; const optn_err = 0; const optn_ok = optn_err + 1;

    const do_nothing = 0; const do_init = do_nothing + 1; const do_set = do_init + 1; const do_handler = do_set + 1; const get_val = do_handler + 1; const get_cnf_val = get_val + 1;

const allopt = static_array("allopt", struct_allopt_t, SIZE(allopt_init));

/* use rest of file */

/* extern char configfile[]; */ /* for messages; files.c */

const empty_optstr = static_array("empty_optstr", char, null, [ ord('\0') ]);
const duplicate = static_var("duplicate", schar); const using_alias = static_var("using_alias", schar);
const give_opt_msg = static_var("give_opt_msg", schar, TRUE);

const MAX_ROLEOPT = 4;  /* 4: role,race,gend,algn */
const opt_set_in_config = static_array("opt_set_in_config", schar, OPTCOUNT);
const roleoptvals = static_array("roleoptvals", array_of(ptr_to(char), num_opt_phases), MAX_ROLEOPT);

const OptS_type = static_array("OptS_type", ptr_to(char), OptS_Advanced+1, [
    _("General"), _("Behavior"), _("Map"), _("Status"), _("Advanced")
]);

const def_inv_order = static_array("def_inv_order", char, MAXOCLASSES, [
    COIN_CLASS, AMULET_CLASS, WEAPON_CLASS, ARMOR_CLASS, FOOD_CLASS,
    SCROLL_CLASS, SPBOOK_CLASS, POTION_CLASS, RING_CLASS, WAND_CLASS,
    TOOL_CLASS, GEM_CLASS, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS, 0,
]);

const none = init_string(static_array("none", char, sizeof_string("(none)")), _("(none)"), true); const randomrole = init_string(static_array("randomrole", char, sizeof_string("random")), _("random"), true);
const to_be_done = init_string(static_array("to_be_done", char, sizeof_string("(to be done)")), _("(to be done)"), true);
const defopt = init_string(static_array("defopt", char, sizeof_string("default")), _("default"), true); const defbrief = init_string(static_array("defbrief", char, sizeof_string("def")), _("def"), true);

/* paranoia[] - used by parseoptions() and handler_paranoid_confirmation() */
  const struct_paranoia_opts = struct("struct_paranoia_opts", {
    flagmask: int,
    argname: ptr_to(char),
    argMinLen: int,
    synonym: ptr_to(char),
    synMinLen: int,
    explain: ptr_to(char),
}); const paranoia = static_array("paranoia", struct_paranoia_opts, null, [
    /* there are some initial-letter conflicts: "a"ttack vs "A"utoall vs
       "a"ll, "attack" takes precedence and "all" isn't present in the
       interactive menu with "Autoall" capitalized there,
       and "d"ie vs "d"eath, synonyms for each other so doesn't matter;
       (also "p"ray vs "P"aranoia, "pray" takes precedence since "Paranoia"
       is just a synonym for "Confirm"); "b"ones vs "br"eak-wand, the
       latter requires at least two letters; "e"at vs "ex"plore,
       "cont"inue eating vs "C"onfirm; "wand"-break vs "Were"-change,
       both require at least two letters during config processing but use
       one letter with case-sensitivity for 'm O's interactive menu;
       if any entry or alias beginning with 'n' gets added, aside from "none",
       the parsing to accept "nofoo" to mean "!foo" will need fixing */
    { flagmask: PARANOID_CONFIRM, argname: _("Confirm"), argMinLen: 1, synonym: _("Paranoia"), synMinLen: 2,
      explain: _("for \"yes\" confirmations, require \"no\" to reject") },
    { flagmask: PARANOID_QUIT, argname: _("quit"), argMinLen: 1, synonym: _("explore"), synMinLen: 2,
      explain: _("yes vs y to quit or to enter explore mode") },
    { flagmask: PARANOID_DIE, argname: _("die"), argMinLen: 1, synonym: _("death"), synMinLen: 2,
      explain: _("yes vs y to die (explore mode or debug mode)") },
    { flagmask: PARANOID_BONES, argname: _("bones"), argMinLen: 1, synonym: 0, synMinLen: 0,
      explain: _("yes vs y to save bones data when dying in debug mode") },
    { flagmask: PARANOID_HIT, argname: _("attack"), argMinLen: 1, synonym: _("hit"), synMinLen: 1,
      explain: _("yes vs y to attack a peaceful monster") },
    { flagmask: PARANOID_BREAKWAND, argname: _("wand-break"), argMinLen: 2, synonym: _("break-wand"), synMinLen: 2,
      explain: _("yes vs y to break a wand via (a)pply") },
    { flagmask: PARANOID_EATING, argname: _("eat"), argMinLen: 1, synonym: _("continue"), synMinLen: 4,
      explain: _("yes vs y to continue eating after first bite when satiated") },
    { flagmask: PARANOID_WERECHANGE, argname: _("Were-change"), argMinLen: 2, synonym: 0, synMinLen: 0,
      explain: _("yes vs y to change form when lycanthropy is controllable") },
    /* extra y/n questions rather than changing y/n to yes/n[o];
       they switch to yes/no if paranoid:confirm is also set */
    { flagmask: PARANOID_PRAY, argname: _("pray"), argMinLen: 1, synonym: 0, synMinLen: 0,
      explain: _("y required to pray (supersedes old \"prayconfirm\" option)") },
    { flagmask: PARANOID_TRAP, argname: _("trap"), argMinLen: 1, synonym: _("move-trap"), synMinLen: 1,
      explain: _("y required to enter known trap unless considered harmless") },
    { flagmask: PARANOID_AUTOALL, argname: _("Autoall"), argMinLen: 2, synonym: _("autoselect-all"), synMinLen: 2,
      explain: _("y required to pick filter choice 'A' for menustyle:Full") },
    /* not a yes/n[o] vs y/n change nor a y/n addition */
    { flagmask: PARANOID_SWIM, argname: _("swim"), argMinLen: 1, synonym: 0, synMinLen: 0,
      explain: _("'m' prefix necessary to deliberately walk into lava or water") },
    { flagmask: PARANOID_REMOVE, argname: _("Remove"), argMinLen: 1, synonym: _("Takeoff"), synMinLen: 1,
      /* normally when there is only 1 candidate it's chosen automatically */
      explain: _("always pick from inventory for Remove and Takeoff") },
    /* for config file parsing; interactive menu skips these */
    { flagmask: 0, argname: _("none"), argMinLen: 4, synonym: 0, synMinLen: 0, explain: 0 }, /* require full word match */
    { flagmask: ~0, argname: _("all"), argMinLen: 3, synonym: 0, synMinLen: 0, explain: 0 }, /* ditto */
]);

const menutype = static_array("menutype", array_of(ptr_to(char), 3), null, [ /* 'menustyle' settings */
    [ _("traditional"),  _("[prompt for object class(es), then"),
                      _(" ask y/n for each item in those classes]") ],
    [ _("combination"),  _("[prompt for object class(es), then"),
                      _(" use menu for items in those classes]") ],
    [ _("full"),         _("[use menu to choose class(es), then"),
                      _(" use another menu for items in those]") ],
    [ _("partial"),      _("[skip class filtering; always"),
                      _(" use menu of all available items]") ]
]);

const msgwind = static_array("msgwind", array_of(ptr_to(char), 3), null, [ /* 'msg_window' settings */
    [ _("single"),       _("[show one old message at a time,"),
                      _(" most recent first]") ],
    [ _("combination"),  _("[for consecutive ^P requests, use"),
                      _(" 'single' for first two, then 'full']") ],
    [ _("full"),         _("[show all available messages,"),
                      _(" oldest first and most recent last]") ],
    [ _("reversed"),     _("[show all available messages,"),
                      _(" most recent first]") ]
]);

/* autounlock settings */
const unlocktypes = static_array("unlocktypes", array_of(ptr_to(char), 2), null, [
    [ _("untrap"),    _("(might fail)") ],
    [ _("apply-key"), _("") ],
    [ _("kick"),      _("(doors only)") ],
    [ _("force"),     _("(chests/boxes only)") ],
]);
const burdentype = static_array("burdentype", ptr_to(char), null, [
    _("unencumbered"), _("burdened"),     _("stressed"),
    _("strained"),     _("overtaxed"),    _("overloaded")
]);
const runmodes = static_array("runmodes", ptr_to(char), null, [
    _("teleport"),     _("run"),          _("walk"),     _("crawl")
]);
const sortltype = static_array("sortltype", ptr_to(char), null, [
    _("none"),         _("loot"),         _("full")
]);
/* second column is an alias for the first; third is brief explanation;
   entries 5 and 6 are 1|4 and 2|4 (tty only) */
const perminv_modes = static_array("perminv_modes", array_of(ptr_to(char), 3), null, [
  /*0*/ [ _("none"),      _("off"),        _("no permanent inventory window") ],
  /*1*/ [ _("all") ,      _("on"),         _("all inventory except for gold") ],
  /*2*/ [ _("full"),      _("gold"),       _("full inventory including gold") ],
  /*3*/ [ 0,        0,         0 ],
  /*4*/ [ 0,        0,         0 ],

  /*5*/ [ 0,        0,         0 ],
  /*6*/ [ 0,        0,         0 ],

  /*7*/ [ 0,        0,         0 ],
  /*8*/ [ _("in-use"),    _("inuse-only"), _("subset: items currently in use") ],
]);

const struct_objsymopt = struct("struct_objsymopt", {
    num: int,
    nam: ptr_to(char),
    descr: ptr_to(char),
});

/*
 * menuobjsyms:
 *   Inventory display for the various values of menuobjsyms.
 *   4' and 5' represent !sortpack which lacks headers; they
 *   produce the same result.
 *
 *   0:                         1:
 *        Weapons                    Weapons  (')')
 *        a - 15 darts               a - 15 darts
 *        Armor                      Armor    ('[')
 *        b - Hawaiian shirt         b - Hawaiian shirt
 *   2:                         3:
 *        Weapons                    Weapons  (')')
 *        a ) 15 darts               a ) 15 darts
 *        Armor                      Armor    ('[')
 *        b [ Hawaiian shirt         b [ Hawaiian shirt
 *   4:                         5:
 *        Weapons                    Weapons  (')')
 *        a - 15 darts               a - 15 darts
 *        Armor                      Armor    ('[')
 *        b - Hawaiian shirt         b - Hawaiian shirt
 *   4':                        5':
 *        a ) 15 darts               a ) 15 darts
 *        b [ Hawaiian shirt         b [ Hawaiian shirt
 */
const objsymvals = static_array("objsymvals", struct_objsymopt, null, [
    { num: 0, nam: _("none"),         descr: _("don't show object symbols in menus") },
    { num: 1, nam: _("headers"),      descr: _("show object symbols in menu header lines") },
    { num: 2, nam: _("entries"),      descr: _("show object symbols in individual menu entries") },
    { num: 3, nam: _("both"),         descr: _("show object symbols in headers and menu entries") },
    { num: 4, nam: _("conditional"),  descr: _("show objsyms in entries if no headers are shown") },
    { num: 5, nam: _("one-or-other"), descr: _("show objsyms in header, in entries if no header") },
]);

/*
 * Default menu manipulation command accelerators.  These may _not_ be:
 *
 *      + a number or '#' - reserved for counts
 *      + an upper or lower case US ASCII letter - used for accelerators
 *      + ESC - reserved for escaping the menu
 *      + NULL, CR or LF - reserved for committing the selection(s).  NULL
 *        is kind of odd, but the tty's xwaitforspace() will return it if
 *        someone hits a <ret>.
 *      + a default object class symbol - used for object class accelerators
 *
 * Standard letters (for now) are:
 *
 *              <  back 1 page
 *              >  forward 1 page
 *              ^  first page
 *              |  last page
 *              :  search
 *
 *              page            all
 *               ,    select     .
 *               \    deselect   -
 *               ~    invert     @
 *
 * The command name list is duplicated in the compopt array.
 */
 const menu_cmd_t = struct("menu_cmd_t", {
    name: ptr_to(char),
    cmd: char,
    desc: ptr_to(char),
});

const default_menu_cmd_info = static_array("default_menu_cmd_info", menu_cmd_t, null, [
    { name: _("menu_next_page"),     cmd: MENU_NEXT_PAGE,     desc: _("Go to next page") },
    { name: _("menu_previous_page"), cmd: MENU_PREVIOUS_PAGE, desc: _("Go to previous page") },
    { name: _("menu_first_page"),    cmd: MENU_FIRST_PAGE,    desc: _("Go to first page") },
    { name: _("menu_last_page"),     cmd: MENU_LAST_PAGE,     desc: _("Go to last page") },
    { name: _("menu_select_all"),    cmd: MENU_SELECT_ALL,
                            desc: _("Select all items in entire menu") },
    { name: _("menu_invert_all"),    cmd: MENU_INVERT_ALL,
                            desc: _("Invert selection for all items") },
    { name: _("menu_deselect_all"),  cmd: MENU_UNSELECT_ALL,
                            desc: _("Unselect all items in entire menu") },
    { name: _("menu_select_page"),   cmd: MENU_SELECT_PAGE,
                            desc: _("Select all items on current page") },
    { name: _("menu_invert_page"),   cmd: MENU_INVERT_PAGE,
                            desc: _("Invert current page's selections") },
    { name: _("menu_deselect_page"), cmd: MENU_UNSELECT_PAGE,
                            desc: _("Unselect all items on current page") },
    { name: _("menu_search"),        cmd: MENU_SEARCH,
                            desc: _("Search and invert matching items") },
    { name: _("menu_shift_right"),   cmd: MENU_SHIFT_RIGHT,
                            desc: _("Pan current page to right (perm_invent only)") },
    { name: _("menu_shift_left"),    cmd: MENU_SHIFT_LEFT,
                            desc: _("Pan current page to left (perm_invent only)") },
    { name: 0, cmd: ord('\0'), desc: 0 }
]);

const n_currently_set = init_string(static_array("n_currently_set", char, sizeof_string("(%d currently set)")), _("(%d currently set)"), true);

/* next few are not allopt[] entries, so will only be called
   directly from doset, not from individual optfn's */

/* ask user if they want a tutorial, except if tutorial boolean option has
   been set in config - either on or off - in which case just obey that
   setting without asking */
export function ask_do_tutorial() { /* boolean */
    const $frame = stack_frame(); try {
    let dotut = flags.tutorial;

    if (!chars[opt_set_in_config + opt_tutorial]) {
        let win;
        let sel = stack_var(ptr_to(struct_mi));
        let any = stack_struct(struct_any);
        let buf = stack_array(char, BUFSZ);
        let rc;
        let norc;
        let n, pass = 0;

        rc = nh_basename(get_configfile(), TRUE);
        norc = +!strcmp(get_configfile(), _("/dev/null"));
        Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("Put \"OPTIONS=!tutorial\" in %s to skip this query."), (rc && chars[rc] && !norc) ? rc : _("your configuration file"))

;
        do {
            win = create_nhwindow()(NHW_MENU);
            start_menu()(win, MENU_BEHAVE_STANDARD);
            struct_assign(any, cg.zeroany);
            any.a_char = ord('y');
            add_menu(win, nul_glyphinfo, any, any.a_char, 0,
                     ATR_NONE, NO_COLOR,
                     _("Yes, do a tutorial"), MENU_ITEMFLAGS_NONE);
            any.a_char = ord('n');
            add_menu(win, nul_glyphinfo, any, any.a_char, 0,
                     ATR_NONE, NO_COLOR,
                     _("No, just start play"), MENU_ITEMFLAGS_NONE);

            add_menu_str(win, _(""));
            add_menu_str(win, buf);
            if (pass++) /* we'll get here after <space> or <return> */
                add_menu_str(win, _("(Please choose 'y' or 'n'.)"));

            end_menu()(win, _("Do you want a tutorial?"));

            n = select_menu(win, PICK_ONE, sel);
            destroy_nhwindow()(win);
        } while (!n);
        if (n > 0) {
            dotut = +(ptr_add(sel[0], 0).item.a_char == ord('y'));
            free(addr_of(sel[0]));
        } else { /* ESC */
            dotut = FALSE;
        }
    }
    return dotut;
    } finally { stack_pop($frame); }
}

/*
 **********************************
 *
 *   parseoptions
 *
 **********************************
 */
export function parseoptions(
    opts,
    tinitial,
    tfrom_file) { /* boolean */
    const $frame = stack_frame(); try {
    let op;
    let negated, got_match = FALSE, pfx_match = FALSE;

    let i, matchidx = -1, optresult = optn_err, optlen, optlen_wo_val;
    let retval = TRUE;

    duplicate[0] = FALSE;
    using_alias[0] = FALSE;
    go.opt_initial = tinitial;
    go.opt_from_file = tfrom_file;
    /*
     * Process elements of comma-separated list in right to left order.
     * When some options are set interactively--notably various compound
     * options that issue a prompt for a value--they use parseoptions()
     * to handle setting the new value.  For those, 'tinitial' is False
     * and if user tries to supply a comma-separated list, it will be
     * treated as part of the current option, probably failing to parse.
     */
    if (tinitial && (op = strchr(opts, ord(','))) != 0) {
        chars[op++] = 0;
        /* current element remains pending while the rest of the line gets
           handled recursively; if the rest of line contains any commas,
           then the process will recurse deeper as it is processed */
        if (!parseoptions(op, go.opt_initial, go.opt_from_file))
            retval = FALSE;
    }
    if (strlen(opts) > Math.trunc(BUFSZ / 2)) {
        config_error_add(_("Option too long, max length is %i characters"),
                         Math.trunc(BUFSZ / 2));
        return FALSE;
    }

    /* strip leading and trailing white space */
    while (__isspace(uchar((chars[opts]))))
        opts++;
    op = eos(opts);
    while (--op >= opts && __isspace(uchar((chars[op]))))
        chars[op] = ord('\0');

    if (!chars[opts]) {
        config_error_add(_("Empty statement"));
        return FALSE;
    }
    negated = FALSE;
    while ((chars[opts] == ord('!')) || !strncmpi(opts, _("no"), 2)) {
        opts += (chars[opts] == ord('!')) ? 1 : (chars[opts + 2] != ord('-')) ? 2 : 3;
        negated = +!negated;
    }
    optlen = int(strlen(opts));
    optlen_wo_val = length_without_val(opts, optlen);
    if (optlen_wo_val < optlen) {
        optlen = optlen_wo_val;
    }

    for (i = 0; i < OPTCOUNT; ++i) {
        got_match = FALSE;

        if (allopt[i].pfx) {
            if (str_start_is(opts, allopt[i].name, TRUE)) {
                matchidx = i;
                got_match = pfx_match = TRUE;
            }
        }

        /*
         * During option initialization, the function
         *     determine_ambiguities()
         * figured out exactly how many characters are required to
         * unambiguously differentiate one option from all others, and it
         * placed that number into each option's allopt[n].minmatch.
         *
         */
        if (!got_match && allopt[i].name)
            got_match = match_optname(opts, allopt[i].name,
                                      allopt[i].minmatch, TRUE);
        if (got_match) {
            if (!allopt[i].pfx && optlen < allopt[i].minmatch) {
                config_error_add(
             _("Ambiguous option %s, %d characters are needed to differentiate"),
                                 opts, allopt[i].minmatch);
                break;
            }
            matchidx = i;
            break;
        }
    }

    if (!got_match) {
        /* spin through the aliases to see if there's a match in those.
           Note that if multiple delimited aliases for the same option
           becomes desirable in the future, this is where you'll need
           to split a delimited allopt[i].alias field into each
           individual alias */

        for (i = 0; i < OPTCOUNT; ++i) {
            if (!allopt[i].alias)
                continue;
            got_match = match_optname(opts, allopt[i].alias,
                                      int(strlen(allopt[i].alias)),
                                      TRUE);
            if (got_match) {
                matchidx = i;
                using_alias[0] = TRUE;
                break;
            }
        }
    }

    /* allow optfn's to test whether they were called from parseoptions() */
    program_state.in_parseoptions++;

    if (got_match && (matchidx >= 0 && matchidx < OPTCOUNT)
                      && !allopt[matchidx].disregarded) {
        duplicate[0] = duplicate_opt_detection(matchidx);
        if (duplicate[0] && !allopt[matchidx].dupeok)
            complain_about_duplicate(matchidx);

        /* check for bad negation, so option functions don't have to */
        if (negated && !allopt[matchidx].negateok) {
            bad_negation(allopt[matchidx].name, TRUE);
            return optn_err;
        }

        /*
         * Now call the option's associated function via the function
         * pointer for it in the allopt[] array, specifying a 'do_set' req.
         */
        if (allopt[matchidx].optfn) {
            op = string_for_opt(opts, TRUE);
            optresult = (allopt[matchidx].optfn)(allopt[matchidx].idx,
                                                  do_set, negated, opts, op);
            if (optresult == optn_ok)
                chars[opt_set_in_config + matchidx] = TRUE;
        }
    }

    if (program_state.in_parseoptions > 0)
        program_state.in_parseoptions--;

    /* #if 0: not in this build */

    if (!got_match) {
        /* Is it a symbol? */
        if (strstr(opts, _("S_")) == opts && parsesymbols(opts, PRIMARYSET)) {
            switch_symbols(TRUE);
            check_gold_symbol();
            optresult = optn_ok;
        }
    }

    if (optresult == optn_silenterr
        || (got_match && allopt[matchidx].disregarded)
            || (!got_match && config_unmatched_ignored()))
        return FALSE;
    if (pfx_match && optresult == optn_err) {
        let pfxbuf = stack_array(char, BUFSZ), pfxp;

        Snprintf(pfxbuf, sizeof(array_of(char, BUFSZ)), _("%s"), opts);
        if ((pfxp = strchr(pfxbuf, ord(':'))) != 0)
            chars[pfxp] = ord('\0');
        config_error_add(_("bad option suffix variation '%s'"), pfxbuf);
        return FALSE;
    }
    if (got_match && optresult == optn_err)
        return FALSE;
    if (optresult == optn_ok)
        return retval;

    /* out of valid options */
    config_error_add(_("Unknown option '%s'"), opts);
    return FALSE;
    } finally { stack_pop($frame); }
}

function check_misc_menu_command(opts, op) { /* int */
    let i;
    let name_to_check;

    /* check for menu command mapping */
    for (i = 0; default_menu_cmd_info[i].name; i++) {
        name_to_check = default_menu_cmd_info[i].name;
        if (match_optname(opts, name_to_check,
                          int(strlen(name_to_check)), TRUE))
            return i;
    }
    return -1;
}

const roleopt2opt = static_array("roleopt2opt", int, 4, [
    opt_role, opt_race, opt_gender, opt_alignment
]);

/* role => 0, race => 1, gender => 2, alignment =>3 */
function opt2roleopt(roleopt) { /* int */
    switch (roleopt) {
    case opt_role:
        return 0;
    case opt_race:
        return 1;
    case opt_gender:
        return 2;
    case opt_alignment:
        return 3;
    default:
        break;
    }
    return 0;
}

/* fetch saved option string for a particular option phase */
function getoptstr(optidx, ophase) { /* char * */
    let roleoptindx = opt2roleopt(optidx);

    if (ophase == num_opt_phases) { /* any source */
        let phase;

        /* find non-Null, in order optvals[][play_opt], [cmdline_opt],
           [environ_opt], [rc_file_opt], [syscf_opt], [builtin_opt] */
        for (phase = num_opt_phases - 1; phase >= 0; --phase)
            if (roleoptvals[roleoptindx][phase]) {
                ophase = phase;
                break;
            }
    }
    if ((roleoptindx >= 0 && roleoptindx < MAX_ROLEOPT
          && ophase >= 0 && ophase < num_opt_phases))
        return roleoptvals[roleoptindx][ophase];
    panic(_("bad index roleoptvals[%d][%d]"), roleoptindx, ophase);
    /*NOTREACHED*/
}

/* to track some unparsed option settings in case #saveoptions needs them */
function saveoptstr(optidx, optstr) { /* void */
    let phase = int(go.opt_phase), roleoptindx = opt2roleopt(optidx);
    let p = strchr(optstr, ord(':')), q = strchr(optstr, ord('='));

    /* strip away "optname:" from optname:optstr */
    if (!p || (q && q < p))
        p = q;
    if (p)
        optstr = p + 1;

    if (roleoptvals[roleoptindx][phase])
        free((roleoptvals[roleoptindx][phase]));
    roleoptvals[roleoptindx][phase] = dupstr(optstr);
}

/* discard specific saved option string */
function unsaveoptstr(optidx, ophase) { /* void */
    let roleoptindx = opt2roleopt(optidx);

    if (roleoptvals[roleoptindx][ophase])
        free((roleoptvals[roleoptindx][ophase])),
        roleoptvals[roleoptindx][ophase] = 0;
}

/* discard all saved option strings */
export function freeroleoptvals() { /* void */
    let i, j;

    for (i = 0; i < 4; ++i)
        for (j = 0; j < num_opt_phases; ++j)
            unsaveoptstr(roleopt2opt[i], j);
}

/* #if 0: not in this build */

/* common to optfn_catname(), optfn_dogname(), optfn_horsename() */
function petname_optfn(
    optidx, req,
    negated,
    opts, op) { /* int */
    const $frame = stack_frame(); try {
    let failsafe = stack_array(char, PL_PSIZ + 1);
    let petname = (optidx == opt_catname) ? gc.catname
                    : (optidx == opt_dogname) ? gd.dogname
                      : (optidx == opt_horsename) ? gh.horsename
                        : failsafe;

    if (req == do_init) {
        ;
    } else if (req == do_set) {
        if (op == empty_optstr && !negated)
            return optn_err;
        if (negated || !strcmp(op, _("none")) || !strcmp(op, none))
            op = empty_optstr;
        nmcpy(petname, op, PL_PSIZ);
        sanitize_name(petname);
    } else if (req == get_val || req == get_cnf_val) {
        chars[failsafe + 0] = ord('\0');
        sprintf(opts, _("%s"), chars[petname] ? petname
                            : (req == get_cnf_val) ? _("none") : none);
    }
    return optn_ok;
    } finally { stack_pop($frame); }
}

/*
 **********************************
 *
 *   Per-option Functions
 *
 **********************************
 */

function optfn_alignment(
    optidx,
    req,
    negated,
    opts,
    op$) { /* int */
    const $frame = stack_frame(); try {
    const op = stack_var(ptr_to(char), op$);
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* alignment:string */
        if (!parse_role_opt(optidx, negated, allopt[optidx].name, opts, op))
            return optn_silenterr;

        if (chars[op[0]] != ord('!')) {
            if ((flags.initalign = str2align(op[0])) == ROLE_NONE) {
                config_error_add(_("Unknown %s '%s'"), allopt[optidx].name, op[0]);
                return optn_err;
            }
            saveoptstr(optidx, ((flags.initalign >= 0) ? aligns[flags.initalign].adj : ((flags.initalign == ROLE_RANDOM) ? randomrole : none)));
        }
        return optn_ok;
    }
    if (req == get_val) {
        sprintf(opts, _("%s"), ((flags.initalign >= 0) ? aligns[flags.initalign].adj : ((flags.initalign == ROLE_RANDOM) ? randomrole : none)));
        return optn_ok;
    }
    if (req == get_cnf_val) {
        op[0] = get_cnf_role_opt(optidx);
        strcpy(opts, op[0] ? op[0] : _("none"));
        return optn_ok;
    }
    return optn_ok;
    } finally { stack_pop($frame); }
}

function optfn_align_message(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* WINCAP align_message:[left|top|right|bottom] */

        op = string_for_opt(opts, negated);
        if ((op != empty_optstr) && !negated) {
            if (!strncmpi(op, _("left"), sizeof_string("left") - 1))
                iflags.wc_align_message = ALIGN_LEFT;
            else if (!strncmpi(op, _("top"), sizeof_string("top") - 1))
                iflags.wc_align_message = ALIGN_TOP;
            else if (!strncmpi(op, _("right"), sizeof_string("right") - 1))
                iflags.wc_align_message = ALIGN_RIGHT;
            else if (!strncmpi(op, _("bottom"), sizeof_string("bottom") - 1))
                iflags.wc_align_message = ALIGN_BOTTOM;
            else {
                config_error_add(_("Unknown %s parameter '%s'"),
                                 allopt[optidx].name, op);
                return optn_err;
            }
        } else if (negated) {
            bad_negation(allopt[optidx].name, TRUE);
            return optn_err;
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        let which;

        which = iflags.wc_align_message;
        sprintf(opts, _("%s"), (which == ALIGN_TOP) ? _("top")
                : (which == ALIGN_LEFT) ? _("left")
                  : (which == ALIGN_BOTTOM) ? _("bottom")
                    : (which == ALIGN_RIGHT) ? _("right")
                      : defopt)
;
        return optn_ok;
    }
    if (req == do_handler) {
        return handler_align_misc(optidx);
    }
    return optn_ok;
}

function optfn_align_status(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* WINCAP align_status:[left|top|right|bottom] */
        op = string_for_opt(opts, negated);
        if ((op != empty_optstr) && !negated) {
            if (!strncmpi(op, _("left"), sizeof_string("left") - 1))
                iflags.wc_align_status = ALIGN_LEFT;
            else if (!strncmpi(op, _("top"), sizeof_string("top") - 1))
                iflags.wc_align_status = ALIGN_TOP;
            else if (!strncmpi(op, _("right"), sizeof_string("right") - 1))
                iflags.wc_align_status = ALIGN_RIGHT;
            else if (!strncmpi(op, _("bottom"), sizeof_string("bottom") - 1))
                iflags.wc_align_status = ALIGN_BOTTOM;
            else {
                config_error_add(_("Unknown %s parameter '%s'"),
                                 allopt[optidx].name, op);
                return optn_err;
            }
        } else if (negated) {
            bad_negation(allopt[optidx].name, TRUE);
            return optn_err;
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        let which;

        which = iflags.wc_align_status;
        sprintf(opts, _("%s"), (which == ALIGN_TOP) ? _("top")
                : (which == ALIGN_LEFT) ? _("left")
                  : (which == ALIGN_BOTTOM) ? _("bottom")
                    : (which == ALIGN_RIGHT) ? _("right")
                      : defopt)
;
        return optn_ok;
    }
    if (req == do_handler) {
        return handler_align_misc(optidx);
    }
    return optn_ok;
}

function optfn_altkeyhandling(
    optidx,
    req,
    negated,
    opts,
    op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* altkeyhandling:string */

        (negated);
        (op);

        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        chars[opts + 0] = ord('\0');

        return optn_ok;
    }

    return optn_ok;
}

function optfn_autounlock(
    optidx,
    req,
    negated,
    opts,
    op) { /* int */
    if (req == do_init) {
        flags.autounlock = AUTOUNLOCK_APPLY_KEY;
        return optn_ok;
    }
    if (req == do_set) {
        /* autounlock:none or autounlock:untrap+apply-key+kick+force;
           autounlock without a value is same as autounlock:apply-key and
           !autounlock is same as autounlock:none; multiple values can be
           space separated or plus-sign separated but the same separation
           must be used for each element, not mix&match */
        let sep, nxt;
        let newflags;
        let i;

        if ((op = string_for_opt(opts, TRUE)) == empty_optstr) {
            flags.autounlock = negated ? 0 : AUTOUNLOCK_APPLY_KEY;
            return optn_ok;
        }
        newflags = 0;
        sep = strchr(op, ord('+')) ? ord('+') : ord(' ');
        while (op) {
            let matched = FALSE;
            op = trimspaces(op); /* might have leading space */
            if ((nxt = strchr(op, sep)) != 0) {
                chars[nxt++] = ord('\0');
                op = trimspaces(op); /* might have trailing space after
                                      * plus sign removal */
            }
            if (str_start_is(_("none"), op, TRUE))
                negated = TRUE, matched = TRUE;
            for (i = 0; i < SIZE(unlocktypes) && !matched; ++i) {
                if (str_start_is(unlocktypes[i][0], op, TRUE)
                    /* fuzzymatch() doesn't match leading substrings but
                       this allows "apply_key" and "applykey" to match
                       "apply-key"; "apply key" too if part of foo+bar */
                    || fuzzymatch(op, unlocktypes[i][0], _(" -_"), TRUE)) {
                    matched = TRUE;
                    switch (chars[op]) {
                    case ord('u'):
                        newflags = unsigned(newflags | AUTOUNLOCK_UNTRAP);
                        break;
                    case ord('a'):
                        newflags = unsigned(newflags | AUTOUNLOCK_APPLY_KEY);
                        break;
                    case ord('k'):
                        newflags = unsigned(newflags | AUTOUNLOCK_KICK);
                        break;
                    case ord('f'):
                        newflags = unsigned(newflags | AUTOUNLOCK_FORCE);
                        break;
                    default:
                        matched = FALSE;
                        break;
                    }
                }
            }
            if (!matched) {
                config_error_add(_("Invalid value for \"%s\": \"%s\""),
                                 allopt[optidx].name, op);
                return optn_silenterr;
            }
            op = nxt;
        }
        if (negated && newflags != 0) {
            config_error_add(
                     _("Invalid value combination for \"%s\": 'none' with some"),
                             allopt[optidx].name);
            return optn_silenterr;
        }
        flags.autounlock = newflags;
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        if (!flags.autounlock) {
            strcpy(opts, _("none"));
        } else {
            let plus = init_string(static_array("optfn_autounlock.plus", char, sizeof_string(" + ")), _(" + "), true);
            let p = _("");

            chars[opts] = ord('\0');
            if (flags.autounlock & AUTOUNLOCK_UNTRAP)
                sprintf(eos(opts), _("%s%s"), p, unlocktypes[0][0]), p = plus;
            if (flags.autounlock & AUTOUNLOCK_APPLY_KEY)
                sprintf(eos(opts), _("%s%s"), p, unlocktypes[1][0]), p = plus;
            if (flags.autounlock & AUTOUNLOCK_KICK)
                sprintf(eos(opts), _("%s%s"), p, unlocktypes[2][0]), p = plus;
            if (flags.autounlock & AUTOUNLOCK_FORCE)
                sprintf(eos(opts), _("%s%s"), p, unlocktypes[3][0]); /*no more p*/
        }
        return optn_ok;
    }
    if (req == do_handler) {
        return handler_autounlock(optidx);
    }
    return optn_ok;
}

function optfn_boulder(
    optidx, req, negated,
    opts, op) { /* int */
    let clash = 0;

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* boulder:symbol */

        /* if ((opts = string_for_env_opt(allopt[optidx].name, opts, FALSE))
               == empty_optstr)
         */
        if ((opts = string_for_opt(opts, FALSE)) == empty_optstr)
            return FALSE;
        escapes(opts, opts);
        /* note: dummy monclass #0 has symbol value '\0'; we allow that--
           attempting to set bouldersym to '^@'/'\0' will reset to default */
        if (def_char_to_monclass(chars[opts + 0]) != MAXMCLASSES)
            clash = chars[opts + 0] ? 1 : 0;
        else if (chars[opts + 0] >= ord('1') && chars[opts + 0] < WARNCOUNT + ord('0'))
            clash = 2;
        if (chars[opts + 0] < ord(' ')) {
            config_error_add(_("boulder symbol cannot be a control character"));
            return optn_ok;
        } else if (clash) {
            /* symbol chosen matches a used monster or warning
               symbol which is not good - reject it */
            config_error_add(_("Badoption - boulder symbol '%s' would conflict " +
                             "with a %s symbol"),
                             visctrl(chars[opts + 0]),
                             (clash == 1) ? _("monster") : _("warning"));
        } else {
            /*
             * Override the default boulder symbol.
             */
            uchars[go.ov_primary_syms + (SYM_BOULDER + SYM_OFF_X)] = nhsym((chars[opts + 0]));
            uchars[go.ov_rogue_syms + (SYM_BOULDER + SYM_OFF_X)] = nhsym((chars[opts + 0]));
            /* for 'initial', update of BOULDER symbol is done in
               initoptions_finish(), after all symset options
               have been processed */
            if (!go.opt_initial) {
                let sym = get_othersym(SYM_BOULDER,
                                         Is_rogue_level(u.uz) ? ROGUESET
                                                               : PRIMARYSET);

                if (sym)
                    uchars[gs.showsyms + (SYM_BOULDER + SYM_OFF_X)] = sym;
                go.opt_need_redraw = TRUE;
            }
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        chars[opts + 0] = ord('\0');

        sprintf(opts, _("%c"), uchars[go.ov_primary_syms + (SYM_BOULDER + SYM_OFF_X)]
                  ? uchars[go.ov_primary_syms + (SYM_BOULDER + SYM_OFF_X)]
                  : uchars[gs.showsyms + ((objects[BOULDER].oc_class) + SYM_OFF_O)])
;

        return optn_ok;
    }
    return optn_ok;
}

function optfn_catname(
    optidx, req,
    negated,
    opts, op) { /* int */
    return petname_optfn(optidx, req, negated, opts, op);
}

function optfn_crash_email(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        if ((op = string_for_opt(opts, FALSE)) == empty_optstr)
            return optn_err;
        if (gc.crash_email)
            free(gc.crash_email);
        gc.crash_email = dupstr(op);
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        if (!opts)
            return optn_err;
        if (gc.crash_email)
            sprintf(opts, _("%s"), gc.crash_email);
        return optn_ok;
    }
    return optn_ok;
}

function optfn_crash_name(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        if ((op = string_for_opt(opts, FALSE)) == empty_optstr)
            return optn_err;
        if (gc.crash_name)
            free(gc.crash_name);
        gc.crash_name = dupstr(op);
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        if (!opts)
            return optn_err;
        if (gc.crash_name)
            sprintf(opts, _("%s"), gc.crash_name);
        return optn_ok;
    }
    return optn_ok;
}

function optfn_crash_urlmax(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        if ((op = string_for_opt(opts, FALSE)) != empty_optstr) {
            let temp = atoi(op);

            if (temp < 75){
                config_error_add(_("Invalid value %d for crash_urlmax. " +
                                 " Minimum value is 75."), temp);
                return optn_err;
            }
            gc.crash_urlmax = temp;
        } else
            return optn_err;
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        if (!opts)
            return optn_err;
        sprintf(opts, _("%d"), gc.crash_urlmax);
        return optn_ok;
    }
    return optn_ok;
}

/* #ifdef CURSES_GRAPHICS: not in this build */

function optfn_DECgraphics(
    optidx, req, negated,
    opts, op) { /* int */
    let badflag = FALSE;

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* "DECgraphics" */

        if (!negated) {
            /* There is no rogue level DECgraphics-specific set */
            if (gs.symset[PRIMARYSET].name) {
                badflag = TRUE;
            } else {
                gs.symset[PRIMARYSET].name = dupstr(allopt[optidx].name);
                if (!read_sym_file(PRIMARYSET)) {
                    badflag = TRUE;
                    clear_symsetentry(PRIMARYSET, TRUE);
                } else
                    switch_symbols(TRUE);
            }
            if (badflag) {
                config_error_add(_("Failure to load symbol set %s."),
                                 allopt[optidx].name);
                return optn_err;
            }
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        chars[opts + 0] = ord('\0');
        return optn_ok;
    }
    return optn_ok;
}

function optfn_disclose(
    optidx, req, negated,
    opts, op) { /* int */
    let i, idx, prefix_val;
    let num;

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* things to disclose at end of game */

        /*
         * The order that the end_disclose options are stored:
         *      inventory, attribs, vanquished, genocided,
         *      conduct, overview.
         * There is an array in flags:
         *      end_disclose[NUM_DISCLOSURE_OPT];
         * with option settings for the each of the following:
         * iagvc [see disclosure_options in decl.c]:
         * Allowed setting values in that array are:
         *      DISCLOSE_PROMPT_DEFAULT_YES  ask with default answer yes
         *      DISCLOSE_PROMPT_DEFAULT_NO   ask with default answer no
         *      DISCLOSE_YES_WITHOUT_PROMPT  always disclose and don't ask
         *      DISCLOSE_NO_WITHOUT_PROMPT   never disclose and don't ask
         *      DISCLOSE_PROMPT_DEFAULT_SPECIAL  for 'vanq'/'genod' only...
         *      DISCLOSE_SPECIAL_WITHOUT_PROMPT  ...to set up sort order.
         *
         * Those setting values can be used in the option
         * string as a prefix to get the desired behavior.
         *
         * For backward compatibility, no prefix is required,
         * and the presence of a i,a,g,v, or c without a prefix
         * sets the corresponding value to DISCLOSE_YES_WITHOUT_PROMPT.
         */

        op = string_for_opt(opts, TRUE);
        if (op != empty_optstr && negated) {
            bad_negation(allopt[optidx].name, TRUE);
            return optn_err;
        }
        /* "disclose" without a value means "all with prompting"
           and negated means "none without prompting" */
        if (op == empty_optstr || !strncmpi((op), _(("all")), -1)
            || !strncmpi((op), _(("none")), -1)) {
            if (op != empty_optstr && !strncmpi((op), _(("none")), -1))
                negated = TRUE;
            for (num = 0; num < NUM_DISCLOSURE_OPTIONS; num++)
                chars[flags.end_disclose + num] = negated
                                              ? DISCLOSE_NO_WITHOUT_PROMPT
                                              : DISCLOSE_PROMPT_DEFAULT_YES;
            return optn_ok;
        }

        num = 0;
        prefix_val = -1;
        while (chars[op] && num < sizeof_member(flags, "end_disclose") - 1) {
            let valid_settings = static_array("optfn_disclose.valid_settings", char, null, [ DISCLOSE_PROMPT_DEFAULT_YES,
                                             DISCLOSE_PROMPT_DEFAULT_NO,
                                             DISCLOSE_PROMPT_DEFAULT_SPECIAL,
                                             DISCLOSE_YES_WITHOUT_PROMPT,
                                             DISCLOSE_NO_WITHOUT_PROMPT,
                                             DISCLOSE_SPECIAL_WITHOUT_PROMPT,
                                             ord('\0') ]);
            let c;
            let dop;

            c = lowc(chars[op]);
            if (c == ord('k'))
                c = ord('v'); /* killed -> vanquished */
            if (c == ord('d'))
                c = ord('o'); /* dungeon -> overview */
            dop = strchr(disclosure_options, c);
            if (dop) {
                idx = (dop - disclosure_options);
                if (idx < 0 || idx > NUM_DISCLOSURE_OPTIONS - 1) {
                    impossible(_("bad disclosure index %d %c"), idx, c);
                    continue;
                }
                if (prefix_val != -1) {
                    if (chars[dop] != ord('v') && chars[dop] != ord('g')) {
                        if (prefix_val == DISCLOSE_PROMPT_DEFAULT_SPECIAL)
                            prefix_val = DISCLOSE_PROMPT_DEFAULT_YES;
                        if (prefix_val == DISCLOSE_SPECIAL_WITHOUT_PROMPT)
                            prefix_val = DISCLOSE_YES_WITHOUT_PROMPT;
                    }
                    chars[flags.end_disclose + idx] = prefix_val;
                    prefix_val = -1;
                } else
                    chars[flags.end_disclose + idx] = DISCLOSE_YES_WITHOUT_PROMPT;
            } else if (strchr(valid_settings, c)) {
                prefix_val = c;
            } else if (c == ord(' ')) {
                ; /* do nothing */
            } else {
                config_error_add(_("Unknown %s parameter '%c'"),
                                 allopt[optidx].name, chars[op]);
                return optn_err;
            }
            op++;
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        chars[opts + 0] = ord('\0');
        for (i = 0; i < NUM_DISCLOSURE_OPTIONS; i++) {
            if (i)
                strkitten(opts, ord(' '));
            strkitten(opts, chars[flags.end_disclose + i]);
            strkitten(opts, chars[disclosure_options + i]);
        }
        return optn_ok;
    }
    if (req == do_handler) {
        return handler_disclose();
    }
    return optn_ok;
}

function optfn_dogname(
    optidx, req,
    negated,
    opts, op) { /* int */
    return petname_optfn(optidx, req, negated, opts, op);
}

function optfn_dungeon(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        return optn_ok;
    }
    if (req == get_val) {
        sprintf(opts, _("%s"), to_be_done);
        return optn_ok;
    }
    if (req == get_cnf_val) {
        chars[opts + 0] = ord('\0');
        return optn_ok;
    }
    return optn_ok;
}

function optfn_effects(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        return optn_ok;
    }
    if (req == get_val) {
        sprintf(opts, _("%s"), to_be_done);
        return optn_ok;
    }
    if (req == get_cnf_val) {
        chars[opts + 0] = ord('\0');
        return optn_ok;
    }
    return optn_ok;
}

function optfn_font_map(
    optidx, req, negated,
    opts, op) { /* int */
    /* send them over to the prefix handling for font_ */
    return pfxfn_font(optidx, req, negated, opts, op);
}

function optfn_font_menu(
    optidx, req, negated,
    opts, op) { /* int */
    /* send them over to the prefix handling for font_ */
    return pfxfn_font(optidx, req, negated, opts, op);
}

function optfn_font_message(
    optidx, req, negated,
    opts, op) { /* int */
    /* send them over to the prefix handling for font_ */
    return pfxfn_font(optidx, req, negated, opts, op);
}

function optfn_font_size_map(
    optidx, req, negated,
    opts, op) { /* int */
    /* send them over to the prefix handling for font_ */
    return pfxfn_font(optidx, req, negated, opts, op);
}

function optfn_font_size_menu(
    optidx, req, negated,
    opts, op) { /* int */
    /* send them over to the prefix handling for font_ */
    return pfxfn_font(optidx, req, negated, opts, op);
}

function optfn_font_size_message(
    optidx, req, negated,
    opts, op) { /* int */
    /* send them over to the prefix handling for font_ */
    return pfxfn_font(optidx, req, negated, opts, op);
}

function optfn_font_size_status(
    optidx, req, negated,
    opts, op) { /* int */
    /* send them over to the prefix handling for font_ */
    return pfxfn_font(optidx, req, negated, opts, op);
}

function optfn_font_size_text(
    optidx, req, negated,
    opts, op) { /* int */
    /* send them over to the prefix handling for font_ */
    return pfxfn_font(optidx, req, negated, opts, op);
}

function optfn_font_status(
    optidx, req, negated,
    opts, op) { /* int */
    /* send them over to the prefix handling for font_ */
    return pfxfn_font(optidx, req, negated, opts, op);
}

function optfn_font_text(
    optidx, req, negated,
    opts, op) { /* int */
    /* send them over to the prefix handling for font_ */
    return pfxfn_font(optidx, req, negated, opts, op);
}

function optfn_fruit(
    optidx, req, negated,
    opts, op) { /* int */
    const $frame = stack_frame(); try {
    var forig = null;

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        op = string_for_opt(opts, (negated || !go.opt_initial ? 1 : 0));
        goodfruit: { if (negated) {
            if (op != empty_optstr) {
                bad_negation(_("fruit"), TRUE);
                return optn_err;
            }
            op = empty_optstr;
            break goodfruit;
        }
        if (op == empty_optstr)
            return optn_err;
        /* strip leading/trailing spaces, condense internal ones (3.6.2) */
        mungspaces(op);
        if (!go.opt_initial) {
            var f;
            var fnum = stack_var(int, 0);

            /* count number of named fruits; if 'op' is found among them,
               then the count doesn't matter because we won't be adding it */
            f = fruit_from_name(op, FALSE, fnum);
            if (!f) {
                if (!flags.made_fruit)
                    forig = fruit_from_name(svp.pl_fruit, FALSE, null);

                if (!forig && fnum[0] >= 100) {
                    config_error_add(
                        _("Doing that so many times isn't very fruitful."));
                    return optn_ok;
                }
            }
        }
 }
        nmcpy(svp.pl_fruit, op, PL_FSIZ);
        sanitize_name(svp.pl_fruit);
        /* OBJ_NAME(objects[SLIME_MOLD]) won't work for this after
           initialization; it gets changed to generic "fruit" */
        if (!chars[svp.pl_fruit])
            nmcpy(svp.pl_fruit, _("slime mold"), PL_FSIZ);
        if (!go.opt_initial) {
            /* if 'forig' is nonNull, we replace it rather than add
               a new fruit; it can only be nonNull if no fruits have
               been created since the previous name was put in place */
            fruitadd(svp.pl_fruit, forig);
            if (give_opt_msg[0])
                pline(_("Fruit is now \"%s\"."), svp.pl_fruit);
        }
        /* If initial, then initoptions is allowed to do it instead
         * of here (initoptions always has to do it even if there's
         * no fruit option at all.  Also, we don't want people
         * setting multiple fruits in their options.)
         */
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        sprintf(opts, _("%s"), svp.pl_fruit);
        return optn_ok;
    }
    return optn_ok;
    } finally { stack_pop($frame); }
}

function optfn_gender(
    optidx,
    req,
    negated,
    opts,
    op$) { /* int */
    const $frame = stack_frame(); try {
    const op = stack_var(ptr_to(char), op$);
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* gender:string */
        if (!parse_role_opt(optidx, negated, allopt[optidx].name, opts, op))
            return optn_silenterr;

        if (chars[op[0]] != ord('!')) {
            if ((flags.initgend = str2gend(op[0])) == ROLE_NONE) {
                config_error_add(_("Unknown %s '%s'"), allopt[optidx].name, op[0]);
                return optn_err;
            }
            flags.female = flags.initgend;
            saveoptstr(optidx, ((flags.initgend >= 0) ? genders[flags.initgend].adj : ((flags.initgend == ROLE_RANDOM) ? randomrole : none)));
        }
        return optn_ok;
    }
    if (req == get_val) {
        sprintf(opts, _("%s"), ((flags.initgend >= 0) ? genders[flags.initgend].adj : ((flags.initgend == ROLE_RANDOM) ? randomrole : none)));
        return optn_ok;
    }
    if (req == get_cnf_val) {
        op[0] = get_cnf_role_opt(optidx);
        strcpy(opts, op[0] ? op[0] : _("none"));
        return optn_ok;
    }
    return optn_ok;
    } finally { stack_pop($frame); }
}

function optfn_glyph(
    optidx, req, negated,
    opts, op) { /* int */
    const $frame = stack_frame(); try {
    let glyph = stack_var(int);

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* OPTION=glyph:G_glyph/U+NNNN/r-g-b */
        if (negated) {
            if (op != empty_optstr) {
                bad_negation(_("glyph"), TRUE);
                return optn_err;
            }
        }
        if (op == empty_optstr)
            return optn_err;
        /* strip leading/trailing spaces, condense internal ones (3.6.2) */
        mungspaces(op);
        if (!glyphrep_to_custom_map_entries(op, glyph))
            return optn_err;
        return optn_ok;
    }
    if (req == get_val) {
        sprintf(opts, _("%s"), to_be_done);
        return optn_ok;
    }
    if (req == get_cnf_val) {
        chars[opts + 0] = ord('\0');
        return optn_ok;
    }
    return optn_ok;
    } finally { stack_pop($frame); }
}

function optfn_hilite_status(
    optidx,
    req,
    negated,
    opts,
    op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* hilite fields in status prompt */

        op = string_for_opt(opts, TRUE);
        if (op != empty_optstr && negated) {
            clear_status_hilites();
            return optn_ok;
        } else if (op == empty_optstr) {
            config_error_add(_("Value is mandatory for hilite_status"));
            return optn_err;
        }
        if (!parse_status_hl1(op, go.opt_from_file))
            return optn_err;
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        chars[opts + 0] = ord('\0');

        if (req == get_val)
            strcpy(opts, count_status_hilites()
                     ? _("(see \"status highlight rules\" below)")
                     : _("(none)"));

        return optn_ok;
    }
    return optn_ok;
}

function optfn_horsename(
    optidx,
    req, negated,
    opts, op) { /* int */
    return petname_optfn(optidx, req, negated, opts, op);
}

function optfn_IBMgraphics(
    optidx, req, negated,
    opts, op) { /* int */
    let sym_name = allopt[optidx].name;
    let badflag = FALSE;
    let i;

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* "IBMgraphics" */

        if (!negated) {
            for (i = 0; i < NUM_GRAPHICS; ++i) {
                if (gs.symset[i].name) {
                    badflag = TRUE;
                } else {
                    if (i == ROGUESET)
                        sym_name = _("RogueIBM");
                    gs.symset[i].name = dupstr(sym_name);
                    if (!read_sym_file(i)) {
                        badflag = TRUE;
                        clear_symsetentry(i, TRUE);
                        break;
                    }
                }
            }
            if (badflag) {
                config_error_add(_("Failure to load symbol set %s."), sym_name);
                return optn_err;
            } else {
                switch_symbols(TRUE);
                if (!go.opt_initial && Is_rogue_level(u.uz))
                    assign_graphics(ROGUESET);
            }
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        chars[opts + 0] = ord('\0');
        return optn_ok;
    }
    return optn_ok;
}

function optfn_map_mode(
    optidx, req, negated,
    opts, op) { /* int */
    let i;

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* WINCAP
         *
         *  map_mode:[tiles|ascii4x6|ascii6x8|ascii8x8|ascii16x8|ascii7x12
         *            |ascii8x12|ascii16x12|ascii12x16|ascii10x18|fit_to_screen
         *            |ascii_fit_to_screen|tiles_fit_to_screen]
         */
        op = string_for_opt(opts, negated);
        if (op != empty_optstr && !negated) {
            let save_map_mode = iflags.wc_map_mode;

            if (!strncmpi((op), _(("tiles")), -1))
                iflags.wc_map_mode = MAP_MODE_TILES;
            else if (!strncmpi(op, _("ascii4x6"), sizeof_string("ascii4x6") - 1))
                iflags.wc_map_mode = MAP_MODE_ASCII4x6;
            else if (!strncmpi(op, _("ascii6x8"), sizeof_string("ascii6x8") - 1))
                iflags.wc_map_mode = MAP_MODE_ASCII6x8;
            else if (!strncmpi(op, _("ascii8x8"), sizeof_string("ascii8x8") - 1))
                iflags.wc_map_mode = MAP_MODE_ASCII8x8;
            else if (!strncmpi(op, _("ascii16x8"), sizeof_string("ascii16x8") - 1))
                iflags.wc_map_mode = MAP_MODE_ASCII16x8;
            else if (!strncmpi(op, _("ascii7x12"), sizeof_string("ascii7x12") - 1))
                iflags.wc_map_mode = MAP_MODE_ASCII7x12;
            else if (!strncmpi(op, _("ascii8x12"), sizeof_string("ascii8x12") - 1))
                iflags.wc_map_mode = MAP_MODE_ASCII8x12;
            else if (!strncmpi(op, _("ascii16x12"), sizeof_string("ascii16x12") - 1))
                iflags.wc_map_mode = MAP_MODE_ASCII16x12;
            else if (!strncmpi(op, _("ascii12x16"), sizeof_string("ascii12x16") - 1))
                iflags.wc_map_mode = MAP_MODE_ASCII12x16;
            else if (!strncmpi(op, _("ascii10x18"), sizeof_string("ascii10x18") - 1))
                iflags.wc_map_mode = MAP_MODE_ASCII10x18;
            else if (!strncmpi(op, _("fit_to_screen"),
                               sizeof_string("fit_to_screen") - 1))
                iflags.wc_map_mode = MAP_MODE_ASCII_FIT_TO_SCREEN;
            else if (!strncmpi(op, _("ascii_fit_to_screen"),
                               sizeof_string("ascii_fit_to_screen") - 1))
                iflags.wc_map_mode = MAP_MODE_ASCII_FIT_TO_SCREEN;
            else if (!strncmpi(op, _("tiles_fit_to_screen"),
                               sizeof_string("tiles_fit_to_screen") - 1))
                iflags.wc_map_mode = MAP_MODE_TILES_FIT_TO_SCREEN;
            else {
                config_error_add(_("Unknown %s parameter '%s'"),
                                 allopt[optidx].name, op);
                return optn_err;
            }
            if (wc_supported(_("map_mode"))) {
                if (!iflags.wc_map_mode
                    || save_map_mode != iflags.wc_map_mode)
                    preference_update()(_("map_mode"));
            }
        } else if (negated) {
            bad_negation(allopt[optidx].name, TRUE);
            return optn_err;
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        i = iflags.wc_map_mode;
        sprintf(opts, _("%s"), (i == MAP_MODE_TILES) ? _("tiles")
                : (i == MAP_MODE_ASCII4x6) ? _("ascii4x6")
                  : (i == MAP_MODE_ASCII6x8) ? _("ascii6x8")
                    : (i == MAP_MODE_ASCII8x8) ? _("ascii8x8")
                      : (i == MAP_MODE_ASCII16x8) ? _("ascii16x8")
                        : (i == MAP_MODE_ASCII7x12) ? _("ascii7x12")
                          : (i == MAP_MODE_ASCII8x12) ? _("ascii8x12")
                            : (i == MAP_MODE_ASCII16x12) ? _("ascii16x12")
                              : (i == MAP_MODE_ASCII12x16) ? _("ascii12x16")
                                : (i == MAP_MODE_ASCII10x18) ? _("ascii10x18")
                                  : (i == MAP_MODE_ASCII_FIT_TO_SCREEN)
                                    ? _("fit_to_screen")
                                    : defopt)
;
        return optn_ok;
    }
    return optn_ok;
}

/* all the key assignment options for menu_* commands are identical
   but optlist.h treats them as distinct rather than sharing one */
function shared_menu_optfn(optidx, req, negated,
                   opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        let res = check_misc_menu_command(opts, op);

        if (res < 0)
            return optn_err;
        return spcfn_misc_menu_cmd(res, req, negated, opts, op);
    }
    if (req == get_val) {
        sprintf(opts, _("%s"), to_be_done);
        return optn_ok;
    }
    if (req == get_cnf_val) {
        chars[opts + 0] = ord('\0');
        return optn_ok;
    }
    return optn_ok;
}

function optfn_menu_deselect_all(
    optidx, req, negated,
    opts, op) { /* int */
    return shared_menu_optfn(optidx, req, negated, opts, op);
}

function optfn_menu_deselect_page(
    optidx, req, negated,
    opts, op) { /* int */
    return shared_menu_optfn(optidx, req, negated, opts, op);
}

function optfn_menu_first_page(
    optidx, req, negated,
    opts, op) { /* int */
    return shared_menu_optfn(optidx, req, negated, opts, op);
}

function optfn_menu_invert_all(
    optidx, req, negated,
    opts, op) { /* int */
    return shared_menu_optfn(optidx, req, negated, opts, op);
}

function optfn_menu_invert_page(
    optidx, req, negated,
    opts, op) { /* int */
    return shared_menu_optfn(optidx, req, negated, opts, op);
}

function optfn_menu_last_page(
    optidx, req, negated,
    opts, op) { /* int */
    return shared_menu_optfn(optidx, req, negated, opts, op);
}

function optfn_menu_next_page(
    optidx, req, negated,
    opts, op) { /* int */
    return shared_menu_optfn(optidx, req, negated, opts, op);
}

function optfn_menu_previous_page(
    optidx, req, negated,
    opts, op) { /* int */
    return shared_menu_optfn(optidx, req, negated, opts, op);
}

function optfn_menu_search(
    optidx, req, negated,
    opts, op) { /* int */
    return shared_menu_optfn(optidx, req, negated, opts, op);
}

function optfn_menu_select_all(
    optidx, req, negated,
    opts, op) { /* int */
    return shared_menu_optfn(optidx, req, negated, opts, op);
}

function optfn_menu_select_page(
    optidx, req, negated,
    opts, op) { /* int */
    return shared_menu_optfn(optidx, req, negated, opts, op);
}

function optfn_menu_shift_left(
    optidx, req, negated,
    opts, op) { /* int */
    return shared_menu_optfn(optidx, req, negated, opts, op);
}

function optfn_menu_shift_right(
    optidx, req, negated,
    opts, op) { /* int */
    return shared_menu_optfn(optidx, req, negated, opts, op);
}

/* end of shared key assignments for menu commands */

function optfn_menu_headings(
    optidx,
    req, negated,
    opts, op) { /* int */
    const $frame = stack_frame(); try {
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        let ca = stack_struct(struct_color_and_attr);

        if (op == empty_optstr) {
            /* OPTIONS=menu_headings w/o value => no-color&inverse;
               OPTIONS=!menu_headings => no-color&none */
            iflags.menu_headings.attr = negated ? ATR_NONE : ATR_INVERSE;
            iflags.menu_headings.color = NO_COLOR;
            return optn_ok;
        } else if (negated) { /* 'op != empty_optstr' to get here */
            bad_negation(allopt[optidx].name, TRUE);
            return optn_silenterr;
        }
        if (!color_attr_parse_str(ca, op))
            return optn_err;
        struct_assign(iflags.menu_headings, ca);
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        let ca_buf = stack_array(char, BUFSZ);

        strcpy(ca_buf, color_attr_to_str(iflags.menu_headings));
        /* change "no color" to "no-color" or "light blue" to "light-blue" */
        strNsubst(ca_buf, _(" "), _("-"), 0);
        strcpy(opts, ca_buf);
        return optn_ok;
    }
    if (req == do_handler) {
        return handler_menu_headings();
    }
    return optn_ok;
    } finally { stack_pop($frame); }
}

function optfn_menu_objsyms(
    optidx, req,
    negated,
    opts, op) { /* int */
    if (req == do_init) {
        /* set iflags.menu_objsyms to 4, "conditional"; also sets
           iflags.menu_head_objsym to False and
           iflags.use_menu_glyphs True */
        set_menuobjsyms_flags(4);
        return optn_ok;
    }
    if (req == do_set) {
        let k, l;
        let i, osyms;

        if (negated) {
            /* allow '!menu_objsyms' (and '!use_menu_glyphs') as
               'menu_objsyms:none' (0) */
            osyms = 0;
        } else if (op == empty_optstr) {
            /* treat boolean 'menu_objsyms' as 'menu_objsyms:headers' (1)
               accept obsolete boolean 'use_menu_glyphs' as a synonym
               for 'menu_objsyms:entries' (2) */
            osyms = !strncmp(opts, _("use_menu_glyphs"), 15) ? 2 : 1;
        } else if (digit(chars[op])) {
            i = atoi(op);
            if (i >= SIZE(objsymvals)) {
                config_error_add(_("Illegal %s parameter '%s'"),
                                 allopt[optidx].name, op);
                return optn_err;
            }
            osyms = i;
        } else {
            /* stilted "one-or-other" is used to compress the menu width */
            let alt5 = init_string(static_array("optfn_menu_objsyms.alt5", char, sizeof_string("one-or-the-other")), _("one-or-the-other"), true);
            let l5 = (sizeof_string("one-or-the-other") - sizeof_string(""));

            osyms = 0;
            k = strlen(op);
            for (i = 0; i < SIZE(objsymvals); ++i) {
                l = strlen(objsymvals[i].nam);
                if (k >= 4)
                    l = k;
                if (!strncmpi(objsymvals[i].nam, op, int(l))
                    || (i == 5 && !strncmpi(alt5, op, int(l5)))) {
                    osyms = i;
                    break;
                }
            }
        }
        set_menuobjsyms_flags(osyms);
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        sprintf(opts, _("%s"), objsymvals[iflags.menuobjsyms].nam);
        return optn_ok;
    }
    if (req == do_handler) {
        return handler_menu_objsyms();
    }
    return optn_ok;
}

function optfn_menuinvertmode(
    optidx, req,
    negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* menuinvertmode=0 or 1 or 2 (2 is experimental) */
        if (op != empty_optstr) {
            let mode = atoi(op);

            if (mode < 0 || mode > 2) {
                config_error_add(_("Illegal %s parameter '%s'"),
                                 allopt[optidx].name, op);
                return optn_err;
            }
            iflags.menuinvertmode = mode;
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        sprintf(opts, _("%d"), iflags.menuinvertmode);
        return optn_ok;
    }
    return optn_ok;
}

function optfn_menustyle(
    optidx, req, negated,
    opts, op) { /* int */
    let tmp;
    let val_required; /* no initializer based on opts because this can be
                             called with init and invalid opts and op */

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* menustyle:traditional or combination or full or partial */

        val_required = +(strlen(opts) > 5 && !negated);
        if ((op = string_for_opt(opts, +!val_required)) == empty_optstr) {
            if (val_required)
                return optn_err; /* string_for_opt gave feedback */
            tmp = negated ? ord('n') : ord('f');
        } else {
            tmp = lowc(chars[op]);
        }
        switch (tmp) {
        case ord('n'): /* none */
        case ord('t'): /* traditional: prompt for class(es) by symbol,
                     prompt for each item within class(es) one at a time */
            flags.menu_style = MENU_TRADITIONAL;
            break;
        case ord('c'): /* combination: prompt for class(es) by symbol,
                     choose items within selected class(es) by menu */
            flags.menu_style = MENU_COMBINATION;
            break;
        case ord('f'): /* full: choose class(es) by first menu,
                     choose items within selected class(es) by second menu */
            flags.menu_style = MENU_FULL;
            break;
        case ord('p'): /* partial: skip class filtering, choose items among all
                     classes by menu */
            flags.menu_style = MENU_PARTIAL;
            break;
        default:
            config_error_add(_("Unknown %s parameter '%s'"), allopt[optidx].name,
                             op);
            return optn_err;
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        sprintf(opts, _("%s"), menutype[flags.menu_style][0]);
        return optn_ok;
    }
    if (req == do_handler) {
        return handler_menustyle();
    }
    return optn_ok;
}

function optfn_monsters(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        chars[opts + 0] = ord('\0');
        return optn_ok;
    }
    return optn_ok;
}

function optfn_mouse_support(
    optidx, req, negated,
    opts, op) { /* int */
    let compat;

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        compat = +(strlen(opts) <= 13);
        op = string_for_opt(opts, (compat || !go.opt_initial ? 1 : 0));
        if (op == empty_optstr) {
            if (compat || negated || go.opt_initial) {
                /* for backwards compatibility, "mouse_support" without a
                   value is a synonym for mouse_support:1 */
                iflags.wc_mouse_support = +!negated;
            }
        } else {
            let mode = atoi(op);

            if (mode < 0 || mode > 2 || (mode == 0 && chars[op] != ord('0'))) {
                config_error_add(_("Illegal %s parameter '%s'"),
                                 allopt[optidx].name, op);
                return optn_err;
            } else { /* mode >= 0 */
                iflags.wc_mouse_support = mode;
            }
        }
        return optn_ok;
    }
    if (req == get_val) {
        let mousemodes = static_array("optfn_mouse_support.mousemodes", array_of(ptr_to(char), 2), null, [
            [ _("0=off"), _("") ],
            [ _("1=on"),  _(MOUSEFIX1) ],
            [ _("2=on"),  _(MOUSEFIX2) ],
        ]);

        let ms = iflags.wc_mouse_support;

        if (ms >= 0 && ms <= 2)
            sprintf(opts, _("%s%s"), mousemodes[ms][0], mousemodes[ms][1]);
        return optn_ok;
    }
    if (req == get_cnf_val) {
        sprintf(opts, _("%i"), iflags.wc_mouse_support);
        return optn_ok;
    }
    return optn_ok;
}
export const MOUSEFIX1 = ", O/S adjusted";
export const MOUSEFIX2 = ", O/S unchanged";

function optfn_msg_window(
    optidx, req, negated,
    opts, op) { /* int */
    let retval = optn_ok;

    let tmp;

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* msg_window:single, combo, full or reversed */

        /* allow option to be silently ignored by non-tty ports */

        if (op == empty_optstr) {
            tmp = negated ? ord('s') : ord('f');
        } else {
            if (negated) {
                bad_negation(allopt[optidx].name, TRUE);
                return optn_err;
            }
            tmp = lowc(chars[op]);
        }
        switch (tmp) {
        case ord('s'): /* single message history cycle (default if negated) */
        case ord('c'): /* combination: first two as singles, then full page */
        case ord('f'): /* full page (default if specified without argument) */
        case ord('r'): /* full page in reverse order (LIFO; default for curses) */
            iflags.prevmsg_window = char(tmp);
            break;
        default:
            config_error_add(_("Unknown %s parameter '%s'"), allopt[optidx].name,
                             op);
            retval = optn_err;
        }

        return retval;
    }
    if (req == get_val || req == get_cnf_val) {
        chars[opts + 0] = ord('\0');

        tmp = iflags.prevmsg_window;
        if ((windowprocs.wp_id == wp_curses)) {
            if (tmp == ord('s') || tmp == ord('c'))
                tmp = iflags.prevmsg_window = ord('r');
        }
        sprintf(opts, _("%s"), (tmp == ord('s')) ? _("single")
                            : (tmp == ord('c')) ? _("combination")
                              : (tmp == ord('f')) ? _("full")
                                : _("reversed"));

        return optn_ok;
    }
    if (req == do_handler) {
        return handler_msg_window();
    }
    return optn_ok;
}

function optfn_msghistory(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        op = string_for_env_opt(allopt[optidx].name, opts, negated);
        if ((negated && op == empty_optstr)
            || (!negated && op != empty_optstr)) {
            iflags.msg_history = unsigned(negated ? 0 : atoi(op));
        } else if (negated) {
            bad_negation(allopt[optidx].name, TRUE);
            return optn_err;
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        sprintf(opts, _("%u"), iflags.msg_history);
        return optn_ok;
    }
    return optn_ok;
}

function optfn_name(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* name:string */

        if ((op = string_for_env_opt(allopt[optidx].name, opts, FALSE))
            != empty_optstr) {
            nmcpy(svp.plname, op, PL_NSIZ);
        } else
            return optn_err;
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        sprintf(opts, _("%s"), svp.plname);
        return optn_ok;
    }
    return optn_ok;
}

function optfn_number_pad(
    optidx, req, negated,
    opts, op) { /* int */
    let compat;

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        compat = +(strlen(opts) <= 10);
        op = string_for_opt(opts, (compat || !go.opt_initial ? 1 : 0));
        if (op == empty_optstr) {
            if (compat || negated || go.opt_initial) {
                /* for backwards compatibility, "number_pad" without a
                   value is a synonym for number_pad:1 */
                iflags.num_pad = +!negated;
                iflags.num_pad_mode = 0;
            }
        } else if (negated) {
            bad_negation(allopt[optidx].name, TRUE);
            return optn_err;
        } else {
            let mode = atoi(op);

            if (mode < -1 || mode > 4 || (mode == 0 && chars[op] != ord('0'))) {
                config_error_add(_("Illegal %s parameter '%s'"),
                                 allopt[optidx].name, op);
                return optn_err;
            } else if (mode <= 0) {
                iflags.num_pad = FALSE;
                /* German keyboard; y and z keys swapped */
                iflags.num_pad_mode = +(mode < 0); /* 0 or 1 */
            } else {                              /* mode > 0 */
                iflags.num_pad = TRUE;
                iflags.num_pad_mode = 0;
                /* PC Hack / MSDOS compatibility */
                if (mode == 2 || mode == 4)
                    iflags.num_pad_mode |= 1;
                /* phone keypad layout */
                if (mode == 3 || mode == 4)
                    iflags.num_pad_mode |= 2;
            }
        }
        reset_commands(FALSE);
        number_pad()(iflags.num_pad ? 1 : 0);
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        let numpadmodes = static_array("optfn_number_pad.numpadmodes", ptr_to(char), null, [
            _("0=off"), _("1=on"), _("2=on, MSDOS compatible"),
            _("3=on, phone-style layout"),
            _("4=on, phone layout, MSDOS compatible"),
            _("-1=off, y & z swapped"), /*[5]*/
        ]);
        let indx = gc.Cmd.num_pad
                       ? (gc.Cmd.phone_layout ? (gc.Cmd.pcHack_compat ? 4 : 3)
                                           : (gc.Cmd.pcHack_compat ? 2 : 1))
                       : gc.Cmd.swap_yz ? 5 : 0;

        if (req == get_val)
            strcpy(opts, numpadmodes[indx]);
        else {
            sprintf(opts, _("%i"), (indx == 5) ? -1 : indx);
        }
        return optn_ok;
    }
    if (req == do_handler) {
        return handler_number_pad();
    }
    return optn_ok;
}

function optfn_objects(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        return optn_ok;
    }
    if (req == get_val) {
        sprintf(opts, _("%s"), to_be_done);
        return optn_ok;
    }
    if (req == get_cnf_val) {
        chars[opts + 0] = ord('\0');
        return optn_ok;
    }
    return optn_ok;
}

function optfn_packorder(
    optidx, req, negated,
    opts, op) { /* int */
    const $frame = stack_frame(); try {
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        if (op == empty_optstr)
            return optn_err;
        if (!change_inv_order(op))
            return optn_err;
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        let ocl = stack_array(char, MAXOCLASSES + 1);

        oc_to_str(flags.inv_order, ocl);
        sprintf(opts, _("%s"), ocl);
        return optn_ok;
    }
    return optn_ok;
    } finally { stack_pop($frame); }
}

/* #ifdef CHANGE_COLOR: not in this build */

/* for "paranoid_confirmation:foo" and alias "[!]prayconfirm" */
function optfn_paranoid_confirmation(
    optidx, req, opt_negated,
    opts, op) { /* int */
    const $frame = stack_frame(); try {
    let fld_negated;
    let i;
    /*
     * Player can change required response for some prompts (quit, die,
     * attack, save-bones, continue-eating, break-wand, Were-change to
     * need to be "yes<return>" instead of just 'y' keystroke to accept.
     *
     * For paranoid_confirm:Confirm, these prompts also need "no<return>"
     * instead of 'n' or <space> or <return> to reject.  (<escape> always
     * works as a way to reject.)
     *
     * Player can add an extra prompt (pray, AutoAll) that isn't
     * ordinarily there.  (They ask for 'y' keystroke unless Confirm is
     * also set, then they'll switch to "yes<return>", "no<return>".)
     *
     * Player can also change game's behavior.  paranoid_confirm:swim
     * can be used to prevent accidentally stepping into water or lava;
     * player must use the 'm' movement prefix to do that intentionally.
     * paranoid_confirm:Remove [with synonym parnoid_confirm:Takeoff]
     * changes the 'R' and 'T' commands [which have differing criteria
     * for "only one candidate item"] to prompt for inventory item to
     * remove/takeoff when there is only one candidate, so allows player
     * a chance to cancel at the pick-an-item prompt or menu.
     */

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        let prayconfirm = stack_array(char, 1 + sizeof_string("pray"));
        let pp;
        let plus_or_minus = FALSE;

        /*
         * "prayconfirm" used to be a separate boolean option,
         * now it is a synonym for paranoid_confirm:+pray and
         * "!prayconfirm" has become one for paranoid_confirm:-pray.
         */
        if (!strncmpi(opts, _("prayconfirm"), 4)) {
            if (chars[op]) {
                /* presence of any value is treated as an error whether
                   complaining about the 'prayconfirm' deprecation or not;
                   this will erroneously reject "prayconfirm:true"; too
                   bad; back when prayconfirm was in active use, tacking on
                   an explicit value to a boolean option wasn't supported */
                config_error_add(
           _("deprecated %sprayconfirm option takes no parameters (found '%s')"),
                                 opt_negated ? _("!") : _(""), op);
                return optn_silenterr;
            }

            /* config file summary of complaints includes this in the count
               of errors; we'd prefer that it be described as a warning but
               that isn't supported [not important since this is considered
               temporary until 'prayconfirm' gets removed altogether] */
            config_error_add(
                 _("%sprayconfirm option is deprecated; switching to %s:%cpray"),
                             opt_negated ? _("!") : _(""),
                             allopt[optidx].name,
                             opt_negated ? ord('-') : ord('+'));
            /* keep going */

            /* convert prayconfirm to paranoid_confirm:+pray and
               !prayconfirm to paranoid_confirm:-pray */
            sprintf(prayconfirm, _("%cpray"), opt_negated ? ord('-') : ord('+'));
            op = prayconfirm;
            /* possibly changing !prayconfirm to paranoid_confirm:-pray
               which clears a paranoia bit but isn't a negated option */
            opt_negated = FALSE;
        /*
         * end of 'prayconfirm' processing
         */
        } else if (opt_negated) {
            /* "!paranoid_confirm" w/o args is same as paranoid_confirm:none;
               "!paranoid_confirm:anything" is disallowed */
            if (!chars[op]) {
                flags.paranoia_bits = 0;
                return optn_ok;
            } else {
                config_error_add(_("!%s does not accept a value"),
                                 allopt[optidx].name);
                return optn_silenterr;
            }
        } else if (!chars[op]) {
            /* "paranoid_confirm" without any arguments is disallowed */
            config_error_add(_("%s requires a value; use 'none' to cancel all"),
                             allopt[optidx].name);
            return optn_silenterr;
        }

        /*
         * Multiple settings for paranoid_confirmation are allowed.
         * When a new instance is processed, the behavior depends on the
         * first character of its value:
         *
         * paranoid_confirm:foo bar
         *   clears all confirmation bits (from previous settings, including
         *   default), then sets the bits for foo and bar;
         *
         * paranoid_confirm:+foo bar
         *   existing bits are kept, plus those for foo and bar are set;
         *
         * paranoid_confirm:-foo bar
         *   existing bits are kept except those for foo and bar get cleared;
         *
         * paranoid_confirm:+foo !bar
         *   combination of paranoid_confirm:+foo,paranoid_confirm:-bar;
         *
         * paranoid_confirm:-foo !bar
         *   the negation in '!bar' is ignored, treated as if '-foo bar';
         *
         * !paranoid_confirm
         *   without a value is treated as paranoid_confirm:none and clears
         *   all bits;
         * !paranoid_confirm:anything
         *   (including +anything_else or -anything_else) is disallowed;
         *
         * paranoid_confirm:+all is the same as paranoid_confirm:all;
         * paranoid_confirm:-all is the same as paranoid_confirm:none;
         * paranoid_confirm:+none and paranoid_confirm:-none are no-ops.
         */
        mungspaces(op);
        if (chars[op] != ord('+') && chars[op] != ord('-')) {
            /* new value; first clear all old bits */
            flags.paranoia_bits = 0;
        } else {
            /* augmenting existing value; keep old bits */
            plus_or_minus = TRUE; /* only used for "+none" and "-none" */
            opt_negated = +(chars[op] == ord('-')); /* context is changed */
            if (chars[++op] == ord(' ')) /* skip '+' or '-', maybe whitespace */
                ++op;
        }

        for (;;) {
            fld_negated = +(chars[op] == ord('!'));
            if (fld_negated) {
                /* there shouldn't be a space after '!' because then
                   "! foo bar" looks like it might be intended to mean
                   "!foo !bar" but if there is one, skip it to prevent
                   a lookup attempt for "" which will fail and result in
                   an unhelpful error message; accepting the space is
                   simpler than another special case error message */
                if (chars[++op] == ord(' ')) /* skip '!', maybe whitespace */
                    ++op;
            } else {
                /* accept "nofoo" to be same as "!foo", unless "no" is
                   followed by a space or 'foo' begins with "n" (to avoid
                   confusion for "none" */
                if (lowc(chars[op + 0]) == ord('n') && lowc(chars[op + 1]) == ord('o')
                       && lowc(+(chars[op + 2] != ord('n') && lowc(chars[op + 2]) != ord('\0')))) {
                    fld_negated = TRUE;
                    op += 2; /* skip "no"; we know next char isn't space  */
                }
            }
            /* We're looking to parse
               "paranoid_confirm:whichone wheretwo whothree"
               and "paranoid_confirm:" prefix has already
               been stripped off by the time we get here */
            pp = strchr(op, ord(' '));
            if (pp)
                chars[pp] = ord('\0');
            /* we aren't matching option names but match_optname()
               does what we want once we've broken the space
               delimited aggregate into separate tokens */
            for (i = 0; i < SIZE(paranoia); ++i) {
                if (match_optname(op, paranoia[i].argname,
                                  paranoia[i].argMinLen, FALSE)
                    || (paranoia[i].synonym
                        && match_optname(op, paranoia[i].synonym,
                                         paranoia[i].synMinLen, FALSE))) {
                    if (!paranoia[i].flagmask) {
                        /* flagmask==0 is "none", clear all bits
                           but "+none" and "-none" are no-ops */
                        if (!plus_or_minus)
                            flags.paranoia_bits = 0; /* clear all */
                    } else if (opt_negated || fld_negated) {
                        flags.paranoia_bits &= unsigned(~paranoia[i].flagmask);
                    } else {
                        flags.paranoia_bits |= unsigned(paranoia[i].flagmask);
                    }
                    break;
                }
            }
            if (i == SIZE(paranoia)) {
                /* didn't match anything, so arg is bad;
                   any flags already modified will stay modified */
                config_error_add(_("Unknown %s parameter '%s'"),
                                 allopt[optidx].name, op);
                return optn_silenterr;
            }
            /* move on to next token */
            if (pp)
                op = pp + 1;
            else
                break; /* no next token */
        } /* for(;;) */
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        let tmpbuf = stack_array(char, BUFSZ);

        chars[tmpbuf + 0] = ord('\0');
        for (i = 0; paranoia[i].flagmask != 0; ++i) {
            if ((flags.paranoia_bits & unsigned(paranoia[i].flagmask)) != 0
                /* hide paranoid_confirm:bones during play except for wizard
                   mode; keep it for any mode if rewriting the config file */
                && (paranoia[i].flagmask != PARANOID_BONES
                    || wizard() || req == get_cnf_val))
                Snprintf(eos(tmpbuf), unsigned(sizeof(array_of(char, BUFSZ)) - strlen(tmpbuf)), _(" %s"), paranoia[i].argname)
;
        }
        /* note: always leaves enough room for caller to tack on '\n' */
        chars[opts + 0] = ord('\0');
        strncat(opts, chars[tmpbuf + 0] ? tmpbuf + 1 : _("none"), BUFSZ - 1);
        return optn_ok;
    }
    if (req == do_handler) {
        return handler_paranoid_confirmation();
    }
    return optn_ok;
    } finally { stack_pop($frame); }
}

function optfn_perminv_mode(
    optidx, req, negated,
    opts, op) { /* int */
    let old_perm_invent = iflags.perm_invent;
    let old_perminv_mode = iflags.perminv_mode;
    let retval = optn_ok;

    if (req == do_init) {
        return optn_ok;
    } else if (req == do_set) {
        op = string_for_opt(opts, negated);
        if (op != empty_optstr && negated) { /* reject "!perminv_mode=foo" */
            bad_negation(allopt[optidx].name, TRUE);
            retval = optn_silenterr;
        } else if (op != empty_optstr) { /* "perminv_mode=foo" */
            let pi0, pi1;
            let i;
            let ln = strlen(op); /* guaranteed > 0 */

            for (i = 0; i < SIZE(perminv_modes); ++i) {
                if (!(pi0 = perminv_modes[i][0]))
                    continue;
                pi1 = perminv_modes[i][1];
                if (!strncmpi(op, pi0, int(ln)) || !strncmpi(op, pi1, int(ln))
                    || chars[op + 0] == i + ord('0')) { /* also accept '0'..'8' */
                    if (strstri(pi0, _("+grid")) && !(windowprocs.wp_id == wp_tty)) {
                        i &= ~InvSparse;
                        config_error_add(
                          _("%s: unavailable perm_invent mode '%s', using '%s'"),
                                         allopt[optidx].name, pi0,
                                         perminv_modes[i][0]);
                    }

                    iflags.perminv_mode = uchar(i);
                    iflags.perm_invent = TRUE;
                    break;
                }
            }
            if (i == SIZE(perminv_modes)) {
                config_error_add(_("Unknown %s parameter '%s'"),
                                 allopt[optidx].name, op);
                iflags.perminv_mode = InvOptNone;
                iflags.perm_invent = FALSE;
                retval = optn_silenterr;
            }
        } else if (negated) { /* "!perminv_mode" */
            iflags.perminv_mode = InvOptNone;
            iflags.perm_invent = FALSE;
        }
        if (!go.opt_initial) {
            if (iflags.perminv_mode != old_perminv_mode
                || iflags.perm_invent != old_perm_invent)
                go.opt_need_redraw = TRUE;
        }
    } else if (req == do_handler) {
        /* use a menu to choose new value for perminv_mode */
        retval = handler_perminv_mode();
    } else if (req == get_val) {
        /* value shown when examining current option settings; enclosed
           within square brackets for 'O', shown as-is when setting value */
        sprintf(opts, _("%s"), perminv_modes[iflags.perminv_mode][2]);
        if (iflags.perminv_mode != InvOptNone && !iflags.perm_invent
            /* 'op' is Null when called by handler_perminv_mode() while
               setting, non-Null when 'm O' shows current option values */
            && op) {
            /* perminv_mode is set but isn't useful because perm_invent is
               Off; say so after squeezing out enough for it to barely fit */
            if (iflags.perminv_mode == InvOptInUse)
                strsubst(opts, _(" currently"), _(""));
            else
                strsubst(opts, _(" inventory"), _(" invent"));
            strcat(opts, (((iflags.perminv_mode & InvSparse) != 0) ? _(" (Off)")
                          : _(" ('perm_invent' is Off)")));
        }
    } else if (req == get_cnf_val) {
        sprintf(opts, _("%s"), perminv_modes[iflags.perminv_mode][0]);
    }
    return retval;
}

function optfn_petattr(
    optidx, req, negated,
    opts, op) { /* int */
    let retval = optn_ok;

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* WINCAP2 petattr:string */

        op = string_for_opt(opts, negated);
        if (op != empty_optstr && negated) {
            bad_negation(allopt[optidx].name, TRUE);
            retval = optn_err;
        } else if (op != empty_optstr) {
            let itmp = match_str2attr(op, FALSE);

            if (itmp == -1) {
                config_error_add(_("Unknown %s parameter '%s'"),
                                 allopt[optidx].name, opts);
                retval = optn_err;
            } else
                iflags.wc2_petattr = itmp;
        } else if (negated) {
            iflags.wc2_petattr = ATR_NONE;
        }
        if (retval != optn_err) {
            iflags.wc_hilite_pet = +(iflags.wc2_petattr != ATR_NONE);
            if (!go.opt_initial)
                go.opt_need_redraw = TRUE;
        }
        return retval;
    }
    if (req == get_val || req == get_cnf_val) {
        if ((windowprocs.wp_id == wp_tty) || (windowprocs.wp_id == wp_curses)) {
            strcpy(opts, attr2attrname(iflags.wc2_petattr));
        } else

        if (iflags.wc2_petattr != 0)
            sprintf(opts, _("0x%08x"), iflags.wc2_petattr);
        else if (req == get_cnf_val)
            chars[opts + 0] = ord('\0');
        else
            strcpy(opts, defopt);
    }
    if (req == do_handler) {
        return handler_petattr();
    }
    return optn_ok;
}

function optfn_pettype(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        if ((op = string_for_env_opt(allopt[optidx].name, opts, negated))
            != empty_optstr) {
            switch (lowc(chars[op])) {
            case ord('d'): /* dog */
                gp.preferred_pet = ord('d');
                break;
            case ord('c'): /* cat */
            case ord('f'): /* feline */
                gp.preferred_pet = ord('c');
                break;
            case ord('h'): /* horse */
            case ord('q'): /* quadruped */
                /* avoids giving "unrecognized type of pet" but
                   pet_type(dog.c) won't actually honor this */
                gp.preferred_pet = ord('h');
                break;
            case ord('n'): /* no pet */
                gp.preferred_pet = ord('n');
                break;
            case ord('r'): /* random */
            case ord('*'): /* random */
                gp.preferred_pet = ord('\0');
                break;
            default:
                config_error_add(_("Unrecognized pet type '%s'."), op);
                return optn_err;
                break;
            }
        } else if (negated)
            gp.preferred_pet = ord('n');
        return optn_ok;
    }
    if (req == get_val) {
        sprintf(opts, _("%s"), (gp.preferred_pet == ord('c')) ? _("cat")
                           : (gp.preferred_pet == ord('d')) ? _("dog")
                             : (gp.preferred_pet == ord('h')) ? _("horse")
                               : (gp.preferred_pet == ord('n')) ? _("none")
                                 : _("random"));
        return optn_ok;
    }
    if (req == get_cnf_val) {
        if (gp.preferred_pet)
            sprintf(opts, _("%c"), gp.preferred_pet);
        else
            chars[opts + 0] = ord('\0');
        return optn_ok;
    }
    return optn_ok;
}

function optfn_pickup_burden(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* maximum burden picked up before prompt (Warren Cheung) */

        if ((op = string_for_env_opt(allopt[optidx].name, opts, FALSE))
            != empty_optstr) {
            switch (lowc(chars[op])) {
            case ord('u'): /* Unencumbered */
                flags.pickup_burden = UNENCUMBERED;
                break;
            case ord('b'): /* Burdened (slight encumbrance) */
                flags.pickup_burden = SLT_ENCUMBER;
                break;
            case ord('s'): /* streSsed (moderate encumbrance) */
                flags.pickup_burden = MOD_ENCUMBER;
                break;
            case ord('n'): /* straiNed (heavy encumbrance) */
                flags.pickup_burden = HVY_ENCUMBER;
                break;
            case ord('o'): /* OverTaxed (extreme encumbrance) */
            case ord('t'):
                flags.pickup_burden = EXT_ENCUMBER;
                break;
            case ord('l'): /* overLoaded */
                flags.pickup_burden = OVERLOADED;
                break;
            default:
                config_error_add(_("Unknown %s parameter '%s'"),
                                 allopt[optidx].name, op);
                return optn_err;
            }
        } else
            return optn_err;
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        sprintf(opts, _("%s"), burdentype[flags.pickup_burden]);
        return optn_ok;
    }
    if (req == do_handler) {
        return handler_pickup_burden();
    }
    return optn_ok;
}

function optfn_pickup_types(
    optidx, req, negated,
    opts, op) { /* int */
    const $frame = stack_frame(); try {
    let ocl = stack_array(char, MAXOCLASSES + 1), tbuf = stack_array(char, MAXOCLASSES + 1), qbuf = stack_array(char, QBUFSZ),
        abuf = stack_array(char, BUFSZ);
    let oc_sym;
    let num;
    let badopt = FALSE, compat = +(strlen(opts) <= 6), use_menu;

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* types of objects to pick up automatically */

        oc_to_str(flags.pickup_types, tbuf);
        chars[flags.pickup_types + 0] = ord('\0'); /* all */
        op = string_for_opt(opts, (compat || !go.opt_initial ? 1 : 0));
        if (op == empty_optstr) {
            if (compat || negated || go.opt_initial) {
                /* for backwards compatibility, "pickup" without a
                   value is a synonym for autopickup of all types
                   (and during initialization, we can't prompt yet) */
                flags.pickup = +!negated;
                return optn_ok;
            }
            oc_to_str(flags.inv_order, ocl);
            use_menu = TRUE;
            if (flags.menu_style == MENU_TRADITIONAL
                || flags.menu_style == MENU_COMBINATION) {
                let wasspace;

                use_menu = FALSE;
                sprintf(qbuf, _("New %s: [%s am] (%s)"), allopt[optidx].name, ocl, chars[tbuf] ? tbuf : _("all"))
;
                chars[abuf + 0] = ord('\0');
                getlin(qbuf, abuf);
                wasspace = +(chars[abuf + 0] == ord(' ')); /* before mungspaces */
                op = mungspaces(abuf);
                if (wasspace && !chars[abuf + 0])
                    ; /* one or more spaces will remove old value */
                else if (!chars[abuf + 0] || chars[abuf + 0] == ord('\x1b'))
                    op = tbuf; /* restore */
                else if (chars[abuf + 0] == ord('m'))
                    use_menu = TRUE;
                /* note: abuf[0]=='a' is already handled via clearing
                   the old value (above) as a default action */
            }
            if (use_menu) {
                if (wizard() && !strchr(ocl, VENOM_SYM))
                    strkitten(ocl, VENOM_SYM);
                choose_classes_menu(_("Autopickup what?"),
                                           1, TRUE, ocl, tbuf);
                op = tbuf;
            }
        }
        if (negated) {
            bad_negation(allopt[optidx].name, TRUE);
            return optn_err;
        }
        while (chars[op] == ord(' '))
            op++;
        if (chars[op] != ord('a') && chars[op] != ord('A')) {
            num = 0;
            while (chars[op]) {
                oc_sym = def_char_to_objclass(chars[op]);
                /* make sure all are valid obj symbols occurring once */
                if (oc_sym != MAXOCLASSES
                    && !strchr(flags.pickup_types, oc_sym)) {
                    chars[flags.pickup_types + num] = char(oc_sym);
                    chars[flags.pickup_types + (++num)] = ord('\0');
                } else
                    badopt = TRUE;
                op++;
            }
            if (badopt) {
                config_error_add(_("Unknown %s parameter '%s'"),
                                 allopt[optidx].name, op);
                return optn_err;
            }
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        oc_to_str(flags.pickup_types, ocl);
        sprintf(opts, _("%s"), chars[ocl + 0] ? ocl : _("all"));
        return optn_ok;
    }
    if (req == do_handler) {
        return handler_pickup_types();
    }
    return optn_ok;
    } finally { stack_pop($frame); }
}

function optfn_pile_limit(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* pile limit: when walking over objects, number which triggers
           "there are several/many objects here" instead of listing them
         */

        op = string_for_opt(opts, negated);
        if ((negated && op == empty_optstr)
            || (!negated && op != empty_optstr))
            flags.pile_limit = negated ? 0 : atoi(op);
        else if (negated) {
            bad_negation(allopt[optidx].name, TRUE);
            return optn_err;
        } else /* op == empty_optstr */
            flags.pile_limit = PILE_LIMIT_DFLT;
        /* sanity check */
        if (flags.pile_limit < 0)
            flags.pile_limit = PILE_LIMIT_DFLT;
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        sprintf(opts, _("%d"), flags.pile_limit);
        return optn_ok;
    }
    return optn_ok;
}

function optfn_player_selection(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* WINCAP player_selection: dialog | prompt/prompts/prompting */

        op = string_for_opt(opts, negated);
        if (op != empty_optstr && !negated) {
            if (!strncmpi(op, _("dialog"), sizeof_string("dialog") - 1)) {
                iflags.wc_player_selection = VIA_DIALOG;
            } else if (!strncmpi(op, _("prompt"), sizeof_string("prompt") - 1)) {
                iflags.wc_player_selection = VIA_PROMPTS;
            } else {
                config_error_add(_("Unknown %s parameter '%s'"),
                                 allopt[optidx].name, op);
                return optn_err;
            }
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        sprintf(opts, _("%s"), iflags.wc_player_selection ? _("prompts") : _("dialog"))
;
        return optn_ok;
    }
    return optn_ok;
}

function optfn_playmode(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* play mode: normal, explore/discovery, or debug/wizard */

        if (duplicate[0] || negated)
            return optn_err;
        if (op == empty_optstr)
            return optn_err;
        if (!strncmpi(op, _("normal"), 6) || !strncmpi((op), _(("play")), -1)) {
            flags.debug = flags.explore = FALSE;
        } else if (!strncmpi(op, _("explore"), 6)
                   || !strncmpi(op, _("discovery"), 6)) {
            flags.debug = FALSE, flags.explore = TRUE;
        } else if (!strncmpi(op, _("debug"), 5) || !strncmpi(op, _("wizard"), 6)) {
            flags.debug = TRUE, flags.explore = FALSE;
        } else {
            config_error_add(_("Invalid value for \"%s\":%s"),
                             allopt[optidx].name, op);
            return optn_err;
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        strcpy(opts, wizard() ? _("debug") : discover() ? _("explore") : _("normal"));
        return optn_ok;
    }
    return optn_ok;
}

function optfn_race(
    optidx,
    req,
    negated,
    opts,
    op$) { /* int */
    const $frame = stack_frame(); try {
    const op = stack_var(ptr_to(char), op$);
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* race:string */
        if (!parse_role_opt(optidx, negated, allopt[optidx].name, opts, op))
            return optn_silenterr;

        if (chars[op[0]] != ord('!')) {
            if ((flags.initrace = str2race(op[0])) == ROLE_NONE) {
                config_error_add(_("Unknown %s '%s'"), allopt[optidx].name, op[0]);
                return optn_err;
            }
            gp.pl_race = chars[op[0]]; /* Backwards compatibility */
            saveoptstr(optidx, ((flags.initrace >= 0) ? races[flags.initrace].noun : ((flags.initrace == ROLE_RANDOM) ? randomrole : none)));
        }
        return optn_ok;
    }
    if (req == get_val) {
        sprintf(opts, _("%s"), ((flags.initrace >= 0) ? races[flags.initrace].noun : ((flags.initrace == ROLE_RANDOM) ? randomrole : none)));
        return optn_ok;
    }
    if (req == get_cnf_val) {
        op[0] = get_cnf_role_opt(optidx);
        strcpy(opts, op[0] ? op[0] : _("none"));
        return optn_ok;
    }
    return optn_ok;
    } finally { stack_pop($frame); }
}

function optfn_roguesymset(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        if (op != empty_optstr) {
            if (gs.symset[ROGUESET].name)
                free((gs.symset[ROGUESET].name)),
                    gs.symset[ROGUESET].name = 0;
            gs.symset[ROGUESET].name = dupstr(op);
            if (!read_sym_file(ROGUESET)) {
                clear_symsetentry(ROGUESET, TRUE);
                config_error_add(
                    _("Unable to load symbol set \"%s\" from \"%s\""), op,
                    _(SYMBOLS));
                return optn_err;
            } else {
                if (!go.opt_initial && Is_rogue_level(u.uz))
                    assign_graphics(ROGUESET);
                go.opt_need_redraw = go.opt_need_glyph_reset = TRUE;
                go.opt_symset_changed = TRUE;
            }
        } else
            return optn_err;
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        sprintf(opts, _("%s"), gs.symset[ROGUESET].name ? gs.symset[ROGUESET].name
                                         : _("default"))
;
        if (gc.currentgraphics == ROGUESET && gs.symset[ROGUESET].name)
            strcat(opts, _(", active"));
        return optn_ok;
    }
    if (req == do_handler) {
        return handler_symset(optidx);
    }
    return optn_ok;
}

function optfn_role(
    optidx,
    req,
    negated,
    opts,
    op$) { /* int */
    const $frame = stack_frame(); try {
    const op = stack_var(ptr_to(char), op$);
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* role:string */
        if (!parse_role_opt(optidx, negated, allopt[optidx].name, opts, op))
            return optn_silenterr;

        if (chars[op[0]] != ord('!')) {
            if ((flags.initrole = str2role(op[0])) == ROLE_NONE) {
                config_error_add(_("Unknown %s '%s'"), allopt[optidx].name, op[0]);
                return optn_err;
            }
            nmcpy(svp.pl_character, op[0], PL_NSIZ); /* Backwards compat */
            saveoptstr(optidx, ((flags.initrole >= 0) ? roles[flags.initrole].name.m : ((flags.initrole == ROLE_RANDOM) ? randomrole : none)));
        }
        return optn_ok;
    }
    if (req == get_val) {
        sprintf(opts, _("%s"), ((flags.initrole >= 0) ? roles[flags.initrole].name.m : ((flags.initrole == ROLE_RANDOM) ? randomrole : none)));
        return optn_ok;
    }
    if (req == get_cnf_val) {
        op[0] = get_cnf_role_opt(optidx);
        strcpy(opts, op[0] ? op[0] : _("none"));
        return optn_ok;
    }
    return optn_ok;
    } finally { stack_pop($frame); }
}

function optfn_runmode(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        if (negated) {
            flags.runmode = RUN_TPORT;
        } else if (op != empty_optstr) {
            if (str_start_is(_("teleport"), op, TRUE))
                flags.runmode = RUN_TPORT;
            else if (str_start_is(_("run"), op, TRUE))
                flags.runmode = RUN_LEAP;
            else if (str_start_is(_("walk"), op, TRUE))
                flags.runmode = RUN_STEP;
            else if (str_start_is(_("crawl"), op, TRUE))
                flags.runmode = RUN_CRAWL;
            else {
                config_error_add(_("Unknown %s parameter '%s'"),
                                 allopt[optidx].name, op);
                return optn_err;
            }
        } else {
            config_error_add(_("Value is mandatory for %s"),
                             allopt[optidx].name);
            return optn_err;
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        sprintf(opts, _("%s"), runmodes[flags.runmode]);
        return optn_ok;
    }
    if (req == do_handler) {
        return handler_runmode();
    }
    return optn_ok;
}

function optfn_scores(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* scores:5t[op] 5a[round] o[wn] */

        if ((op = string_for_opt(opts, FALSE)) == empty_optstr)
            return optn_err;

        /* 5.0: earlier versions left old values for unspecified arguments
           if player's scores:foo option only specified some of the three;
           in particular, attempting to use 'scores:own' rather than
           'scores:0 top/0 around/own' didn't work as intended */
        flags.end_top = flags.end_around = 0, flags.end_own = FALSE;

        if (negated)
            op = eos(op);

        while (chars[op]) {
            let inum = 1;

            negated = +((chars[op] == ord('!')) || !strncmpi(op, _("no"), 2));
            if (negated)
                op += (chars[op] == ord('!')) ? 1 : (chars[op + 2] != ord('-')) ? 2 : 3;

            if (digit(chars[op])) {
                inum = atoi(op);
                while (digit(chars[op]))
                    op++;
            }
            while (chars[op] == ord(' '))
                op++;

            switch (lowc(chars[op])) {
            case ord('t'):
                flags.end_top = negated ? 0 : inum;
                break;
            case ord('a'):
                flags.end_around = negated ? 0 : inum;
                break;
            case ord('o'):
                flags.end_own = (negated || !inum) ? FALSE : TRUE;
                break;
            case ord('n'): /* none */
                flags.end_top = flags.end_around = 0, flags.end_own = FALSE;
                break;
            case ord('-'):
                if (digit(chars[(op + 1)])) {
                    config_error_add(
                       _("Values for %s:top and %s:around must not be negative"),
                                     allopt[optidx].name,
                                     allopt[optidx].name);
                    return optn_silenterr;
                }
                /* FALLTHROUGH */;
                /*FALLTHRU*/
            default:
                config_error_add(_("Unknown %s parameter '%s'"),
                                 allopt[optidx].name, op);
                return optn_silenterr;
            }
            /* "3a" is sufficient but accept "3around" (or "3abracadabra") */
            while (letter(chars[op]))
                op++;
            /* t, a, and o can be separated by space(s) or slash or both */
            while (chars[op] == ord(' '))
                op++;
            if (chars[op] == ord('/'))
                op++;
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        chars[opts] = ord('\0');
        if (flags.end_top > 0)
            sprintf(opts, _("%d top"), flags.end_top);
        if (flags.end_around > 0)
            sprintf(eos(opts), _("%s%d around"), (flags.end_top > 0) ? _("/") : _(""), flags.end_around)
;
        if (flags.end_own)
            sprintf(eos(opts), _("%sown"), (flags.end_top > 0 || flags.end_around > 0) ? _("/") : _(""))
;
        if (!chars[opts])
            strcpy(opts, _("none"));
        return optn_ok;
    }
    return optn_ok;
}

function optfn_scroll_amount(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* WINCAP scroll_amount:nn */

        op = string_for_opt(opts, negated);
        if ((negated && op == empty_optstr)
            || (!negated && op != empty_optstr)) {
            iflags.wc_scroll_amount = negated ? 1 : atoi(op);
        } else if (negated) {
            bad_negation(allopt[optidx].name, TRUE);
            return optn_err;
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        if (iflags.wc_scroll_amount)
            sprintf(opts, _("%d"), iflags.wc_scroll_amount);
        else
            strcpy(opts, defopt);
        return optn_ok;
    }
    return optn_ok;
}

function optfn_scroll_margin(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* WINCAP scroll_margin:nn */
        op = string_for_opt(opts, negated);
        if ((negated && op == empty_optstr)
            || (!negated && op != empty_optstr)) {
            iflags.wc_scroll_margin = negated ? 5 : atoi(op);
        } else if (negated) {
            bad_negation(allopt[optidx].name, TRUE);
            return optn_err;
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        if (iflags.wc_scroll_margin)
            sprintf(opts, _("%d"), iflags.wc_scroll_margin);
        else
            strcpy(opts, defopt);
        return optn_ok;
    }
    return optn_ok;
}

function optfn_soundlib(
    optidx, req, negated,
    opts, op) { /* int */
    const $frame = stack_frame(); try {
    let soundlibbuf = stack_array(char, WINTYPELEN);

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /*
         * soundlib:  option to choose the interface for binaries built
         * with support for more than the default interface (nosound).
         *
         * Option processing sets gc.chosen_soundlib. A later call
         * to activate_chosen_soundlib() actually activates it, and
         * sets gc.active_soundlib.
         */
        if ((op = string_for_env_opt(allopt[optidx].name, opts, FALSE))
            != empty_optstr) {
            let option_id;

            get_soundlib_name(soundlibbuf, WINTYPELEN);
            option_id = soundlib_id_from_opt(op);
            gc.chosen_soundlib = option_id;
            assign_soundlib(int(gc.chosen_soundlib));
        } else
            return optn_err;
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        get_soundlib_name(soundlibbuf, WINTYPELEN);
        sprintf(opts, _("%s"), soundlibbuf);
        return optn_ok;
    }
    return optn_ok;
    } finally { stack_pop($frame); }
}

function optfn_sortdiscoveries(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        flags.discosort = ord('o');
        return optn_ok;
    }
    if (req == do_set) {
        op = string_for_env_opt(allopt[optidx].name, opts, FALSE);
        if (negated) {
            flags.discosort = ord('o');
        } else if (op != empty_optstr) {
            switch (lowc(chars[op])) {
            case ord('0'):
            case ord('o'): /* order of discovery */
                flags.discosort = ord('o');
                break;
            case ord('1'):
            case ord('s'): /* sortloot order (subclasses for some classes) */
                flags.discosort = ord('s');
                break;
            case ord('2'):
            case ord('c'): /* alphabetical within each class */
                flags.discosort = ord('c');
                break;
            case ord('3'):
            case ord('a'): /* alphabetical across all classes */
                flags.discosort = ord('a');
                break;
            default:
                config_error_add(_("Unknown %s parameter '%s'"),
                                 allopt[optidx].name, op);
                return optn_silenterr;
            }
        } else
            return optn_err;
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        get_sortdisco(opts, (req == get_cnf_val) ? TRUE : FALSE);
        return optn_ok;
    }
    if (req == do_handler) {
        /* return handler_sortdiscoveries(); */
        choose_disco_sort(0); /* o_init.c */
    }
    return optn_ok;
}

function optfn_sortloot(
    optidx, req, negated,
    opts, op) { /* int */
    let i;

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        op = string_for_env_opt(allopt[optidx].name, opts, FALSE);
        if (op != empty_optstr) {
            let c = lowc(chars[op]);

            switch (c) {
            case ord('n'): /* none */
            case ord('l'): /* loot (pickup) */
            case ord('f'): /* full (pickup + invent) */
                flags.sortloot = c;
                break;
            default:
                config_error_add(_("Unknown %s parameter '%s'"),
                                 allopt[optidx].name, op);
                return optn_err;
            }
        } else
            return optn_err;
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        for (i = 0; i < SIZE(sortltype); i++)
            if (flags.sortloot == chars[sortltype[i] + 0]) {
                strcpy(opts, sortltype[i]);
                break;
            }
        return optn_ok;
    }
    if (req == do_handler) {
        return handler_sortloot();
    }
    return optn_ok;
}

function optfn_sortvanquished(
    optidx, req, negated,
    opts, op) { /* int */
    const $frame = stack_frame(); try {
     /* insight.c */
    let vanqmodes = init_string(static_array("optfn_sortvanquished.vanqmodes", char, sizeof_string("tdaACcnz")), _("tdaACcnz"), true);
    let optname = allopt[optidx].name;

    if (req == do_init) {
        flags.vanq_sortmode = VANQ_MLVL_MNDX; /* 0 => 't' */
        return optn_ok;
    }
    if (req == do_set) {
        op = string_for_env_opt(allopt[optidx].name, opts, FALSE);
        if (negated) {
            flags.vanq_sortmode = VANQ_MLVL_MNDX; /* 0 => 't' */
        } else if (op != empty_optstr) {
            let p;
            let vndx = 0;

            if ((p = strchr(vanqmodes, chars[op])) != 0) {
                vndx = (p - vanqmodes);
            } else if (strchr(_("01234567"), chars[op])) {
                vndx = chars[op] - ord('0');
            } else {
                config_error_add(_("Unknown %s parameter '%s'"), optname, op);
                return optn_silenterr;
            }
            flags.vanq_sortmode = uchar(vndx);
        } else
            return optn_err;
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        strcpy(opts, vanqorders[flags.vanq_sortmode][0]);
        if (req == get_val)
            sprintf(eos(opts), _(": %s"), vanqorders[flags.vanq_sortmode][1]);
        return optn_ok;
    }
    if (req == do_handler) {
        let prev_sortmode = flags.vanq_sortmode;

        /* return handler_sortvanquished(); */
        set_vanq_order(TRUE); /* insight.c */
        pline(_("'%s' %s \"%s: %s\"."), optname,
              (flags.vanq_sortmode == prev_sortmode)
                 ? _("not changed, still")
                 : _("changed to"),
              vanqorders[flags.vanq_sortmode][0],
              vanqorders[flags.vanq_sortmode][1]);
    }
    return optn_ok;
    } finally { stack_pop($frame); }
}

function optfn_statushilites(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* control over whether highlights should be displayed (non-zero), and
           also for how long to show temporary ones (N turns; default 3) */

        if (negated) {
            iflags.hilite_delta = 0;
        } else {
            op = string_for_opt(opts, TRUE);
            iflags.hilite_delta = (op == empty_optstr || !chars[op]) ? 3
                                                               : atoll(op);
            if (iflags.hilite_delta < 0)
                iflags.hilite_delta = 1;
        }
        if (!go.opt_from_file)
            reset_status_hilites();
        return optn_ok;
    }
    if (req == get_val) {
        if (!iflags.hilite_delta)
            strcpy(opts, _("0 (off: don't highlight status fields)"));
        else
            sprintf(opts, _("%lld (on: highlight status for %lld turns)"), iflags.hilite_delta, iflags.hilite_delta)
;

        return optn_ok;
    }
    if (req == get_cnf_val) {
        sprintf(opts, _("%lld"), iflags.hilite_delta);
    }
    return optn_ok;
}

function optfn_statuslines(
    optidx, req, negated,
    opts, op) { /* int */
    let retval = optn_ok, itmp = 0;

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* WINCAP2
         * statuslines:n */

        op = string_for_opt(opts, negated);
        if (negated) {
            bad_negation(allopt[optidx].name, TRUE);
            itmp = 2;
            retval = optn_err;
        } else if (op != empty_optstr) {
            itmp = atoi(op);
        }
        if (itmp < 2 || itmp > 3) {
            config_error_add(_("'%s:%s' is invalid; must be 2 or 3"),
                             allopt[optidx].name, op);
            retval = optn_silenterr;
        } else {
            iflags.wc2_statuslines = itmp;
            if (!go.opt_initial)
                go.opt_need_redraw = TRUE;
        }
        return retval;
    }
    if (req == get_val || req == get_cnf_val) {
        if (wc2_supported(allopt[optidx].name))
            strcpy(opts, (iflags.wc2_statuslines < 3) ? _("2") : _("3"));
        else
            strcpy(opts, _("unknown"));
        return optn_ok;
    }
    return optn_ok;
}

/* #ifdef WIN32CON: not in this build */

function optfn_suppress_alert(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        if (negated) {
            bad_negation(allopt[optidx].name, FALSE);
            return optn_err;
        } else if (op != empty_optstr)
            feature_alert_opts(op, allopt[optidx].name);
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        if (req == get_cnf_val && flags.suppress_alert == 0)
            chars[opts + 0] = ord('\0');
        else if (flags.suppress_alert == 0)
            strcpy(opts, none);
        else
            sprintf(opts, _("%llu.%llu.%llu"), FEATURE_NOTICE_VER_MAJ(), FEATURE_NOTICE_VER_MIN(), FEATURE_NOTICE_VER_PATCH())
;
        return optn_ok;
    }
    return optn_ok;
}

     /* symbols.c */
 /* symbols.c */

function optfn_symset(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        if (op != empty_optstr) {
            if (gs.symset[PRIMARYSET].name)
                free((gs.symset[PRIMARYSET].name)),
                     gs.symset[PRIMARYSET].name = 0;
            gs.symset[PRIMARYSET].name = dupstr(op);
            if (!read_sym_file(PRIMARYSET)) {
                clear_symsetentry(PRIMARYSET, TRUE);
                config_error_add(
                    _("Unable to load symbol set \"%s\" from \"%s\""), op,
                    _(SYMBOLS));
                return optn_err;
            } else {
                if (gs.symset[PRIMARYSET].handling) {
                }
                switch_symbols(+(gs.symset[PRIMARYSET].name != 0));
                go.opt_need_redraw = go.opt_need_glyph_reset = TRUE;
                go.opt_symset_changed = TRUE;
            }
        } else
            return optn_err;
        return optn_ok;
    }
    if (req == get_val) {
        sprintf(opts, _("%s"), gs.symset[PRIMARYSET].name ? gs.symset[PRIMARYSET].name
                                          : _("default"))
;
        if (gc.currentgraphics == PRIMARYSET && gs.symset[PRIMARYSET].name)
            strcat(opts, _(", active"));
        if (gs.symset[PRIMARYSET].handling) {
            sprintf(eos(opts), _(", handler=%s"), known_handling[gs.symset[PRIMARYSET].handling])
;
        }
        return optn_ok;
    }
    if (req == get_cnf_val) {
        sprintf(opts, _("%s"), gs.symset[PRIMARYSET].name ? gs.symset[PRIMARYSET].name
                                          : _("default"))
;
        return optn_ok;
    }
    if (req == do_handler) {
        let reslt;

        if (!glyphid_cache_status())
            fill_glyphid_cache();
        reslt = handler_symset(optidx);
        if (glyphid_cache_status())
            free_glyphid_cache();
        /* apply_customizations(gc.currentgraphics,
                        (do_custom_colors | do_custom_symbols)); */
        return reslt;
    }
    return optn_ok;
}

function optfn_term_cols(
    optidx, req, negated,
    opts, op) { /* int */
    let retval = optn_ok;
    let ltmp;

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* WINCAP2
         * term_cols:amount */

        if ((op = string_for_opt(opts, negated)) != empty_optstr) {
            ltmp = atoll(op);
            /* just checks atol() sanity, not logical window size sanity
             */
            if (ltmp <= 0 || ltmp >= LARGEST_INT) {
                config_error_add(_("Invalid %s: %lld"), allopt[optidx].name,
                                 ltmp);
                retval = optn_err;
            } else {
                iflags.wc2_term_cols = int(ltmp);
            }
        }
        return retval;
    }
    if (req == get_val || req == get_cnf_val) {
        if (iflags.wc2_term_cols)
            sprintf(opts, _("%d"), iflags.wc2_term_cols);
        else if (req == get_cnf_val)
            chars[opts + 0] = ord('\0');
        else
            strcpy(opts, defopt);
        return optn_ok;
    }
    return optn_ok;
}

function optfn_term_rows(
    optidx, req, negated,
    opts, op) { /* int */
    let retval = optn_ok;
    let ltmp;

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* WINCAP2
         * term_rows:amount */

        if ((op = string_for_opt(opts, negated)) != empty_optstr) {
            ltmp = atoll(op);
            /* just checks atol() sanity, not logical window size sanity
             */
            if (ltmp <= 0 || ltmp >= LARGEST_INT) {
                config_error_add(_("Invalid %s: %lld"), allopt[optidx].name,
                                 ltmp);
                retval = optn_err;
            } else {
                iflags.wc2_term_rows = int(ltmp);
            }
        }
        return retval;
    }
    if (req == get_val || req == get_cnf_val) {
        if (iflags.wc2_term_rows)
            sprintf(opts, _("%d"), iflags.wc2_term_rows);
        else if (req == get_cnf_val)
            chars[opts + 0] = ord('\0');
        else
            strcpy(opts, defopt);
        return optn_ok;
    }
    return optn_ok;
}

function optfn_tile_file(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* WINCAP tile_file:name */
        if (op != empty_optstr) {
            if (iflags.wc_tile_file)
                free(iflags.wc_tile_file);
            iflags.wc_tile_file = dupstr(op);
        } else
            return optn_err;
        return optn_ok;
    }
    if (req == get_val) {
        sprintf(opts, _("%s"), iflags.wc_tile_file ? iflags.wc_tile_file : defopt)
;
        return optn_ok;
    }
    if (req == get_cnf_val) {
        if (iflags.wc_tile_file)
            sprintf(opts, _("%s"), iflags.wc_tile_file);
        else
            chars[opts + 0] = ord('\0');
        return optn_ok;
    }
    return optn_ok;
}

function optfn_tile_height(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* WINCAP tile_height:nn */
        op = string_for_opt(opts, negated);
        if ((negated && op == empty_optstr)
            || (!negated && op != empty_optstr)) {
            iflags.wc_tile_height = negated ? 0 : atoi(op);
        } else if (negated) {
            bad_negation(allopt[optidx].name, TRUE);
            return optn_err;
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        if (iflags.wc_tile_height)
            sprintf(opts, _("%d"), iflags.wc_tile_height);
        else if (req == get_cnf_val)
            chars[opts + 0] = ord('\0');
        else
            strcpy(opts, defopt);
        return optn_ok;
    }
    return optn_ok;
}

function optfn_tile_width(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* WINCAP tile_width:nn */
        op = string_for_opt(opts, negated);
        if ((negated && op == empty_optstr)
            || (!negated && op != empty_optstr)) {
            iflags.wc_tile_width = negated ? 0 : atoi(op);
        } else if (negated) {
            bad_negation(allopt[optidx].name, TRUE);
            return optn_err;
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        if (iflags.wc_tile_width)
            sprintf(opts, _("%d"), iflags.wc_tile_width);
        else if (req == get_cnf_val)
            chars[opts + 0] = ord('\0');
        else
            strcpy(opts, defopt);
        return optn_ok;
    }
    return optn_ok;
}

function optfn_traps(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        return optn_ok;
    }
    if (req == get_val) {
        sprintf(opts, _("%s"), to_be_done);
        return optn_ok;
    }
    if (req == get_cnf_val) {
        chars[opts + 0] = ord('\0');
        return optn_ok;
    }
    return optn_ok;
}

function optfn_vary_msgcount(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* WINCAP vary_msgcount:nn */
        op = string_for_opt(opts, negated);
        if ((negated && op == empty_optstr)
            || (!negated && op != empty_optstr)) {
            iflags.wc_vary_msgcount = negated ? 0 : atoi(op);
        } else if (negated) {
            bad_negation(allopt[optidx].name, TRUE);
            return optn_err;
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        if (iflags.wc_vary_msgcount)
            sprintf(opts, _("%d"), iflags.wc_vary_msgcount);
        else if (req == get_cnf_val)
            chars[opts + 0] = ord('\0');
        else
            strcpy(opts, defopt);
        return optn_ok;
    }
    return optn_ok;
}

function optfn_versinfo(
    optidx, req, negated,
    opts, op) { /* int */
    const $frame = stack_frame(); try {
    let optname = allopt[optidx].name;
    let vi = flags.versinfo;

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /* versinfo: what to include when 'showvers' displays version
           on status lines; bitmask with up to three bits:
           (1) x.y.z number, (2) program name, (4) git branch if available.
           If branch is requested but unavailable, status_version will
           treat 4 as 1.
         */
        let have_branch = (nomakedefs.git_branch
                               && chars[nomakedefs.git_branch] ? 1 : 0);
        let val, dflt = have_branch ? VI_BRANCH : VI_NUMBER;

        if (negated) {
            bad_negation(allopt[optidx].name, TRUE);
            return optn_silenterr;
        }
        op = string_for_opt(opts, FALSE);
        if (op == empty_optstr) {
            config_error_add(_("'%s' requires a value; defaulting to %d"),
                             optname, dflt);
            return optn_silenterr;
        }
        val = atoi(op);
        if (!val || (val & ~7) != 0) {
            config_error_add(_("'%s' must be one of 1, 2, 4, or" +
                             " the sum of two or all three of those"),
                             optname);
            return optn_silenterr;
        }
        flags.versinfo = unsigned(val);
    } else if (req == do_handler) {
        /* return handler_versinfo(); */
        handler_versinfo();
        pline(_("'%s' %s %u."), optname,
              (flags.versinfo == vi) ? _("not changed, still") : _("changed to"),
              flags.versinfo);
    } else if (req == get_val) {
        let vbuf = stack_array(char, QBUFSZ);
        let g = +((vi & VI_NAME) != 0),
                b = +((vi & VI_BRANCH) != 0),
                n = +((vi & VI_NUMBER) != 0);

        sprintf(opts, _("%u: %s%s%s%s%s (%.99s)"), flags.versinfo, g ? _("name") : _(""), (b && g) ? _("+") : _(""), b ? _("branch") : _(""), (n && (b || g)) ? _("+") : _(""), n ? _("number") : _(""), status_version(vbuf, sizeof(array_of(char, QBUFSZ)), FALSE))

;
    } else if (req == get_cnf_val) {
        sprintf(opts, _("%u"), flags.versinfo);
    }
    if (flags.versinfo != vi && !go.opt_initial)
        go.opt_need_redraw = TRUE; /* context.botlx = TRUE ought to suffice
                                    * but doesn't for X11 fancy status */
    return optn_ok;
    } finally { stack_pop($frame); }
}

/* #ifdef VIDEOSHADES: not in this build */

/* #ifdef MSDOS: not in this build */

function optfn_warnings(
    optidx, req, negated,
    opts, op) { /* int */
    let reslt;

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        reslt = warning_opts(opts, allopt[optidx].name);
        return reslt ? optn_ok : optn_err;
    }
    if (req == get_val || req == get_cnf_val) {
        chars[opts + 0] = ord('\0');
        return optn_ok;
    }
    return optn_ok;
}

function optfn_whatis_coord(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        if (negated) {
            iflags.getpos_coords = GPCOORDS_NONE;
            return optn_ok;
        } else if ((op = string_for_env_opt(allopt[optidx].name, opts, FALSE))
                   != empty_optstr) {
            let gpcoords = static_array("optfn_whatis_coord.gpcoords", char, null, [ GPCOORDS_NONE,    GPCOORDS_COMPASS,
                                       GPCOORDS_COMFULL, GPCOORDS_MAP,
                                       GPCOORDS_SCREEN,  ord('\0') ]);
            let c = lowc(chars[op]);

            if (c && strchr(gpcoords, c))
                iflags.getpos_coords = c;
            else {
                config_error_add(_("Unknown %s parameter '%s'"),
                                 allopt[optidx].name, op);
                return optn_err;
            }
        } else
            return optn_err;
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        sprintf(opts, _("%s"), (iflags.getpos_coords == GPCOORDS_MAP) ? _("map")
                : (iflags.getpos_coords == GPCOORDS_COMPASS) ? _("compass")
                : (iflags.getpos_coords == GPCOORDS_COMFULL) ? _("full compass")
                : (iflags.getpos_coords == GPCOORDS_SCREEN) ? _("screen")
                : _("none"))
;
        return optn_ok;
    }
    if (req == do_handler) {
        return handler_whatis_coord();
    }
    return optn_ok;
}

function optfn_whatis_filter(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        if (negated) {
            iflags.getloc_filter = GFILTER_NONE;
            return optn_ok;
        } else if ((op = string_for_env_opt(allopt[optidx].name, opts, FALSE))
                   != empty_optstr) {
            let c = lowc(chars[op]);

            switch (c) {
            case ord('n'):
                iflags.getloc_filter = GFILTER_NONE;
                break;
            case ord('v'):
                iflags.getloc_filter = GFILTER_VIEW;
                break;
            case ord('a'):
                iflags.getloc_filter = GFILTER_AREA;
                break;
            default: {
                config_error_add(_("Unknown %s parameter '%s'"),
                                 allopt[optidx].name, op);
                return optn_err;
            }
            }
        } else
            return optn_err;
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        sprintf(opts, _("%s"), (iflags.getloc_filter == GFILTER_VIEW) ? _("view")
                : (iflags.getloc_filter == GFILTER_AREA) ? _("area")
                : _("none"))
;
        return optn_ok;
    }
    if (req == do_handler) {
        return handler_whatis_filter();
    }
    return optn_ok;
}

function optfn_windowborders(
    optidx, req, negated,
    opts, op) { /* int */
    let retval = optn_ok;

    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        op = string_for_opt(opts, negated);
        if (negated && op != empty_optstr) {
            bad_negation(allopt[optidx].name, TRUE);
            retval = optn_err;
        } else {
            let itmp;

            if (negated)
                itmp = 0; /* Off */
            else if (op == empty_optstr)
                itmp = 1; /* On */
            else /* Value supplied; expect 0 (off), 1 (on), 2 (auto)
                  * or 3 (on for most windows, off for perm_invent)
                  * or 4 (auto for most windows, off for perm_invent) */
                itmp = atoi(op);

            if (itmp < 0 || itmp > 4) {
                config_error_add(_("Invalid %s (should be within 0 to 4): %s"),
                                 allopt[optidx].name, opts);
                retval = optn_silenterr;
            } else {
                iflags.wc2_windowborders = itmp;
            }
        }
        return retval;
    }
    if (req == get_val) {
        sprintf(opts, _("%s"), (iflags.wc2_windowborders == 0) ? _("0=off")
                : (iflags.wc2_windowborders == 1) ? _("1=on")
                  : (iflags.wc2_windowborders == 2) ? _("2=auto")
                    : (iflags.wc2_windowborders == 3)
                      ? _("3=on, except off for perm_invent")
                      : (iflags.wc2_windowborders == 4)
                        ? _("4=auto, except off for perm_invent")
                        : defopt)
;
        return optn_ok;
    }
    if (req == get_cnf_val) {
        sprintf(opts, _("%i"), iflags.wc2_windowborders);
        return optn_ok;
    }
    if (req == do_handler) {
        return handler_windowborders();
    }
    return optn_ok;
}

/* #ifdef WINCHAIN: not in this build */

/* Win GUI and curses */
const wcnames = static_array("wcnames", ptr_to(char), WC_COUNT, [
    _("menu"), _("message"), _("status"), _("text")
]);
const wcshortnames = static_array("wcshortnames", ptr_to(char), WC_COUNT, [
    _("mnu"), _("msg"), _("sts"), _("txt")
]);
export const wcolors_opt = static_array("wcolors_opt", int, WC_COUNT);

function optfn_windowcolors(
    optidx, req,
    negated,
    opts, op) { /* int */
    let wccount;

    if (req == do_init) {
        for (wccount = 0; wccount < WC_COUNT; ++wccount) {
            wcolors_opt[wccount] = 0;
        }
        return optn_ok;
    }
    if (req == do_set) {
        /* WINCAP
         * setting window colors
         * syntax: windowcolors=menu foregrnd/backgrnd text foregrnd/backgrnd
         */
        if ((op = string_for_opt(opts, FALSE)) != empty_optstr) {
            if (!wc_set_window_colors(op)) {
                config_error_add(_("Could not set %s '%s'"), allopt[optidx].name,
                                 op);
                return optn_err;
            }
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        let fg, bg;

        /* TODO: wide 'get_val' may need to be wrapped in the menu display */
        chars[opts + 0] = ord('\0');
        for (wccount = 0; wccount < WC_COUNT; ++wccount) {
            fg = iflags.wcolors[wccount].fg;
            bg = iflags.wcolors[wccount].bg;
            if (fg && (!chars[fg] || !strcmp(fg, defbrief)))
                fg = 0;
            if (bg && (!chars[bg] || !strcmp(bg, defbrief)))
                bg = 0;
            sprintf(eos(opts), _("%s%s %s/%s"), !wccount ? _("") : _(" "), (fg || bg) ? wcnames[wccount] : wcshortnames[wccount], fg ? fg : defbrief, bg ? bg : defbrief)

;
        }
        return optn_ok;
    }
    return optn_ok;
}

function optfn_windowtype(
    optidx, req,
    negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        /*
         * windowtype:  option to choose the interface for binaries built
         * with support for more than one interface (tty + X11, for
         * instance).
         *
         * Ideally, 'windowtype' should be processed first, because it
         * causes the wc_ and wc2_ flags to be set up.
         * For user, making it be first in a config file is trivial, use
         * OPTIONS=windowtype:Foo
         * as the first non-comment line of the file.
         * Making it first in NETHACKOPTIONS requires it to be at the
         * _end_ because comma-separated option strings are processed from
         * right to left.
         */
        if (!iflags.window_inited) {
            if (iflags.windowtype_locked)
                return optn_ok;

            if ((op = string_for_env_opt(allopt[optidx].name, opts, FALSE))
                != empty_optstr) {
                nmcpy(gc.chosen_windowtype, op, WINTYPELEN);
                if (!iflags.windowtype_deferred) {
                    choose_windows(gc.chosen_windowtype);
                }
            } else {
                return optn_err;
            }
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        sprintf(opts, _("%s"), windowprocs.name);
        return optn_ok;
    }
    return optn_ok;
}

/*
 *    Prefix-handling functions
 */

function pfxfn_cond_(
    optidx,
    req,
    negated,
    opts,
    op) { /* int */
    if (req == do_init) {
        condopt(0, 0, 0); /* make the choices match defaults */
        return optn_ok;
    }
    if (req == do_set) {
        let reslt = parse_cond_option(negated, opts);

        switch (reslt) {
        case 0:
            chars[opt_set_in_config + pfx_cond_] = TRUE;
            break;
        case 3:
            config_error_add(_("Ambiguous condition option %s"), opts);
            break;
        case 1:
        case 2:
        default:
            config_error_add(_("Unknown condition option %s (%d)"), opts, reslt);
            break;
        }
        if (reslt != 0)
            return optn_err;
        /* [FIXME?  redraw seems like overkill; botl update should suffice] */
        go.opt_need_redraw = TRUE;
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        chars[opts + 0] = ord('\0');
        return optn_ok;
    }
    if (req == do_handler) { /* not used */
        cond_menu();    /* in botl.c */
        return optn_ok;
    }
    return optn_ok;
}

function pfxfn_font(optidx, req, negated, opts, op) { /* int */
    let opttype = -1;

    if (req == do_init) {
        return optn_ok;
    }

    if (req == do_set) {
        /* WINCAP setting font options  */
        if (optidx == opt_font_map)
            opttype = MAP_OPTION;
        else if (optidx == opt_font_message)
            opttype = MESSAGE_OPTION;
        else if (optidx == opt_font_text)
            opttype = TEXT_OPTION;
        else if (optidx == opt_font_menu)
            opttype = MENU_OPTION;
        else if (optidx == opt_font_status)
            opttype = STATUS_OPTION;
        else if (optidx == opt_font_size_map
                || optidx == opt_font_size_message
                || optidx == opt_font_size_text
                || optidx == opt_font_size_menu
                || optidx == opt_font_size_status) {
            if (optidx == opt_font_size_map)
                opttype = MAP_OPTION;
            else if (optidx == opt_font_size_message)
                opttype = MESSAGE_OPTION;
            else if (optidx == opt_font_size_text)
                opttype = TEXT_OPTION;
            else if (optidx == opt_font_size_menu)
                opttype = MENU_OPTION;
            else if (optidx == opt_font_size_status)
                opttype = STATUS_OPTION;
            else {
                config_error_add(_("Unknown %s parameter '%s'"),
                             allopt[optidx].name, opts);
                return optn_err;
            }
            if (duplicate[0])
                complain_about_duplicate(optidx);
            if (opttype > 0 && !negated
                && (op = string_for_opt(opts, FALSE)) != empty_optstr) {
                switch (opttype) {
                case MAP_OPTION:
                    iflags.wc_fontsiz_map = atoi(op);
                    break;
                case MESSAGE_OPTION:
                    iflags.wc_fontsiz_message = atoi(op);
                    break;
                case TEXT_OPTION:
                    iflags.wc_fontsiz_text = atoi(op);
                    break;
                case MENU_OPTION:
                    iflags.wc_fontsiz_menu = atoi(op);
                    break;
                case STATUS_OPTION:
                    iflags.wc_fontsiz_status = atoi(op);
                    break;
                }
            }
            return optn_ok;
        } else {
            config_error_add(_("Unknown %s parameter '%s'"),
                             _("font"), opts);
            return FALSE;
        }
        if (opttype > 0
            && (op = string_for_opt(opts, FALSE)) != empty_optstr) {
            wc_set_font_name(opttype, op);

            return optn_ok;
        } else if (negated) {
            bad_negation(allopt[optidx].name, TRUE);
            return optn_err;
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        if (optidx == opt_font_map) {
            sprintf(opts, _("%s"), iflags.wc_font_map ? iflags.wc_font_map : defopt)
;
        } else if (optidx == opt_font_message) {
            sprintf(opts, _("%s"), iflags.wc_font_message ? iflags.wc_font_message : defopt)
;
        } else if (optidx == opt_font_status) {
            sprintf(opts, _("%s"), iflags.wc_font_status ? iflags.wc_font_status : defopt)
;
        } else if (optidx == opt_font_menu) {
            sprintf(opts, _("%s"), iflags.wc_font_menu ? iflags.wc_font_menu : defopt)
;
        } else if (optidx == opt_font_text) {
            sprintf(opts, _("%s"), iflags.wc_font_text ? iflags.wc_font_text : defopt)
;
        } else if (optidx == opt_font_size_map) {
            if (iflags.wc_fontsiz_map)
                sprintf(opts, _("%d"), iflags.wc_fontsiz_map);
            else
                strcpy(opts, defopt);
        } else if (optidx == opt_font_size_message) {
            if (iflags.wc_fontsiz_message)
                sprintf(opts, _("%d"), iflags.wc_fontsiz_message);
            else
                strcpy(opts, defopt);
        } else if (optidx == opt_font_size_status) {
            if (iflags.wc_fontsiz_status)
                sprintf(opts, _("%d"), iflags.wc_fontsiz_status);
            else
                strcpy(opts, defopt);
        } else if (optidx == opt_font_size_menu) {
            if (iflags.wc_fontsiz_menu)
                sprintf(opts, _("%d"), iflags.wc_fontsiz_menu);
            else
                strcpy(opts, defopt);
        } else if (optidx == opt_font_size_text) {
            if (iflags.wc_fontsiz_text)
                sprintf(opts, _("%d"), iflags.wc_fontsiz_text);
            else
                strcpy(opts, defopt);
        }
        return optn_ok;
    }
    return optn_ok;
}

/* #if defined(MICRO) && !defined(AMIGA): not in this build */

/*
 *    General boolean option handler
 *    (Use optidx to reference the specific option)
 */

export function optfn_boolean(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        let nosexchange = FALSE;
        let ln = 0;

        if (!allopt[optidx].addr)
            return optn_ok; /* silent retreat */

        /* option that must come from config file? */
        if (!go.opt_initial && (allopt[optidx].setwhere == set_in_config))
            return optn_err;

        /* options that must NOT come from config file */
        if (go.opt_initial && allopt[optidx].setwhere == set_wiznofuz)
            return optn_err;

        op = string_for_opt(opts, TRUE);
        if (op != empty_optstr) {
            if (negated) {
                config_error_add(
                           _("Negated boolean '%s' should not have a parameter"),
                                 allopt[optidx].name);
                return optn_silenterr;
            }
            /* length is greater than 0 or we wouldn't have gotten here */
            ln = int(strlen(op));
            if (!strncmpi(op, _("true"), ln)
                || !strncmpi(op, _("yes"), ln)
                || !strncmpi((op), _(("on")), -1)
                || (digit(chars[op]) && atoi(op) == 1)) {
                negated = FALSE;
            } else if (!strncmpi(op, _("false"), ln)
                       || !strncmpi(op, _("no"), ln)
                       || !strncmpi((op), _(("off")), -1)
                       || (digit(chars[op]) && atoi(op) == 0)) {
                negated = TRUE;
            } else if (!allopt[optidx].valok) {
                config_error_add(_("'%s' is not valid for a boolean"), opts);
                return optn_silenterr;
            }
        }
        if (iflags.debug_fuzzer && !go.opt_initial) {
            /* don't randomly toggle this/these */
            if ((optidx == opt_silent)
                || (optidx == opt_perm_invent))
                return optn_ok;
        }
        /* Before the change */
        switch (optidx) {
        case opt_female:
            if (!strncmpi(opts, _("female"), max(ln, 3))) {
                if (!go.opt_initial && flags.female == negated) {
                    nosexchange = TRUE;
                } else {
                    flags.initgend = flags.female = +!negated;
                    return optn_ok;
                }
            }
            if (!strncmpi(opts, _("male"), max(ln, 3))) {
                if (!go.opt_initial && flags.female != negated) {
                    nosexchange = TRUE;
                } else {
                    flags.initgend = flags.female = negated;
                    return optn_ok;
                }
            }
            break;
        case opt_perm_invent:
            if (!negated && !go.opt_initial && !can_set_perm_invent())
                return optn_silenterr;
            break;
        default:
            break;
        }
        /* this dates from when 'O' prompted for a line of options text
           rather than use a menu to control access to which options can
           be modified during play; it was possible to attempt to use
           'O' to specify female or negate male when playing as male or
           to specify male or negate female when playing as female;
           options processing rejects that for !opt_initial; not possible
           now but kept in case someone brings the old 'O' behavior back */
        if (nosexchange) {
            /* can't arbitrarily change sex after game has started;
               magic (amulet or polymorph) is required for that */
            config_error_add(_("'%s' is not anatomically possible."), opts);
            return optn_silenterr;
        }

        chars[(allopt[optidx].addr)] = +!negated;    /* <==== SET IT HERE */

        /* After the change */
        switch (optidx) {
        case opt_pauper:
            /* pauper implies nudist */
            u.uroleplay.nudist = u.uroleplay.pauper;
            break;
        case opt_ascii_map:
            iflags.wc_tiled_map = negated;
            break;
        case opt_tiled_map:
            iflags.wc_ascii_map = negated;
            break;
        case opt_hilite_pet:

            if ((windowprocs.wp_id == wp_tty) || (windowprocs.wp_id == wp_curses)) {
                /* if we're enabling hilite_pet and petattr isn't set,
                   set it to Inverse; if we're disabling, leave petattr
                   alone so that re-enabling will get current value back
                 */
                if (iflags.wc_hilite_pet && !iflags.wc2_petattr)
                    iflags.wc2_petattr = ATR_INVERSE;
            }

            go.opt_need_redraw = TRUE;
            break;

        case opt_idlecheckpoint:
            pline(_("There is no underlying support for 'idlecheckpoint'" +
                  " compiled in."));
            iflags.idlecheckpoint = FALSE;
            give_opt_msg[0] = FALSE;
            break;

        default:
            break;
        }

        /* only do processing below if setting with doset() */

        if (go.opt_initial)
            return optn_ok;

        switch (optidx) {
        case opt_terrainstatus:
            classify_terrain(); /* bring iflags.terrain_typ up to date */
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case opt_weaponstatus:
        case opt_armorstatus:
            if (!wc2_supported(allopt[optidx].name)) {
                /* not actually an error */
                config_error_add(_("'%s' is not supported."),
                                 allopt[optidx].name);
                return optn_ok;
            }
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case opt_showscore:
        case opt_showvers:
        case opt_showexp:
        case opt_time:
            if (VIA_WINDOWPORT())
                status_initialize(TRUE);
            disp.botl = TRUE;
            break;
        case opt_fixinv:
        case opt_price_quotes:
        case opt_sortpack:
        case opt_implicit_uncursed:
        case opt_wizweight:
            if (!flags.invlet_constant)
                reassign();
            update_inventory();
            break;
        case opt_lit_corridor:
        case opt_dark_room:
            /*
             * All corridor squares seen via night vision or
             * candles & lamps change.  Update them by calling
             * newsym() on them.  Don't do this if we are
             * initializing the options --- the vision system
             * isn't set up yet.
             */
            vision_recalc(2);         /* shut down vision */
            gv.vision_full_recalc = 1; /* delayed recalc */
            if (iflags.wc_color)
                go.opt_need_redraw = TRUE; /* darkroom refresh */
            break;
        case opt_wizmgender:
        case opt_showrace:
        case opt_use_inverse:
        case opt_hilite_pile:
        case opt_perm_invent:
        case opt_ascii_map:
        case opt_tiled_map:
            go.opt_need_redraw = TRUE;
            go.opt_need_glyph_reset = TRUE;
            break;
        case opt_hitpointbar:
            if (VIA_WINDOWPORT()) {
                /* [is reassessment really needed here?] */
                status_initialize(TRUE);
                go.opt_need_redraw = TRUE;
            }
            break;
        case opt_color:

            go.opt_need_redraw = TRUE;
            go.opt_need_glyph_reset = TRUE;
            break;
        case opt_customcolors:
            go.opt_reset_customcolors = TRUE;
            break;
        case opt_customsymbols:
            go.opt_reset_customsymbols = TRUE;
            break;
        case opt_menucolors:
        case opt_guicolor:
            update_inventory();
            go.opt_need_promptstyle = TRUE;
            break;
        case opt_mention_decor:
            iflags.prev_decor = STONE;
            break;
        case opt_rest_on_space:
            update_rest_on_space();
            break;
        case opt_accessiblemsg:
            a11y.msg_loc.x = a11y.msg_loc.y = 0;
            break;
        default:
            break;
        }

        /* boolean value has been toggled but some option changes can
           still be pending at this point (mainly for opt_need_redraw);
           give the toggled message now regardless */
        if (give_opt_msg[0])
            pline(_("'%s' option toggled %s."), allopt[optidx].name,
                  !negated ? _("on") : _("off"));

        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        chars[opts + 0] = ord('\0');
        return optn_ok;
    }
    return optn_ok;
}

function spcfn_misc_menu_cmd(midx, req, negated, opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        if (negated) {
            bad_negation(default_menu_cmd_info[midx].name, FALSE);
            return optn_err;
        } else if ((op = string_for_opt(opts, FALSE)) != empty_optstr) {
            let c = char(txt2key(op));

            if (illegal_menu_cmd_key(uchar(c)))
                return optn_err;
            add_menu_cmd_alias(c, default_menu_cmd_info[midx].cmd);
        }
        return optn_ok;
    }
    if (req == get_val || req == get_cnf_val) {
        chars[opts + 0] = ord('\0');
        return optn_ok;
    }
    return optn_ok;
}

/*
 **********************************
 *
 *   Special per-option handlers
 *
 **********************************
 */

/* test whether 'perm_invent' can be toggled On */
function can_set_perm_invent() { /* boolean */
    /*
     * Assumption: only called when iflags.perm_invent is False
     * and is about to be changed to True.
     */
    let old_perminv_mode = iflags.perminv_mode;

    if (!(windowprocs.wincap & WC_PERM_INVENT)) {
            return FALSE;
    }

    if (iflags.perminv_mode == InvOptNone)
        iflags.perminv_mode = InvOptOn;

    /* #ifdef TTY_PERM_INVENT: not in this build */

    (old_perminv_mode);

    return TRUE;
}

/* #ifdef TTY_PERM_INVENT: not in this build */

function handler_menustyle() { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let chngd;
    let i, n, old_menu_style = flags.menu_style;
    let buf = stack_array(char, BUFSZ), sep = iflags.menu_tab_sep ? ord('\t') : ord(' ');
    let style_pick = stack_var(ptr_to(struct_mi), null);
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    for (i = 0; i < SIZE(menutype); i++) {
        sprintf(buf, _("%-12.12s%c%.60s"), menutype[i][0], sep, menutype[i][1]);
        any.a_int = i + 1;
        add_menu(tmpwin, nul_glyphinfo, any, chars[buf], 0, ATR_NONE, clr, buf,
                 (i == flags.menu_style) ? MENU_ITEMFLAGS_SELECTED
                                         : MENU_ITEMFLAGS_NONE);
        /* second line is prefixed by spaces that "c - " would use */
        sprintf(buf, _("%4s%-12.12s%c%.60s"), _(""), _(""), sep, menutype[i][2]);
        add_menu_str(tmpwin, buf);
    }
    end_menu()(tmpwin, _("Select menustyle:"));
    n = select_menu(tmpwin, PICK_ONE, style_pick);
    if (n > 0) {
        i = ptr_add(style_pick[0], 0).item.a_int - 1;
        /* if there are two picks, use the one that wasn't pre-selected */
        if (n > 1 && i == old_menu_style)
            i = ptr_add(style_pick[0], 1).item.a_int - 1;
        flags.menu_style = i;
        free(addr_of(style_pick[0]));
    }
    destroy_nhwindow()(tmpwin);
    chngd = +(flags.menu_style != old_menu_style);
    if (chngd || flags.verbose)
        pline(_("'menustyle' %s \"%s\"."), chngd ? _("changed to") : _("is still"),
              menutype[flags.menu_style][0]);
    return optn_ok;
    } finally { stack_pop($frame); }
}

function handler_align_misc(optidx) { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let window_pick = stack_var(ptr_to(struct_mi), null);
    let abuf = stack_array(char, BUFSZ);
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    any.a_int = ALIGN_TOP;
    add_menu(tmpwin, nul_glyphinfo, any, ord('t'), 0, ATR_NONE, clr, _("top"),
             MENU_ITEMFLAGS_NONE);
    any.a_int = ALIGN_BOTTOM;
    add_menu(tmpwin, nul_glyphinfo, any, ord('b'), 0, ATR_NONE, clr, _("bottom"),
             MENU_ITEMFLAGS_NONE);
    any.a_int = ALIGN_LEFT;
    add_menu(tmpwin, nul_glyphinfo, any, ord('l'), 0, ATR_NONE, clr, _("left"),
             MENU_ITEMFLAGS_NONE);
    any.a_int = ALIGN_RIGHT;
    add_menu(tmpwin, nul_glyphinfo, any, ord('r'), 0, ATR_NONE, clr, _("right"),
             MENU_ITEMFLAGS_NONE);
    sprintf(abuf, _("Select %s window placement relative to the map:"), (optidx == opt_align_message) ? _("message") : _("status"))
;
    end_menu()(tmpwin, abuf);
    if (select_menu(tmpwin, PICK_ONE, window_pick) > 0) {
        if (optidx == opt_align_message)
            iflags.wc_align_message = window_pick[0].item.a_int;
        else
            iflags.wc_align_status = window_pick[0].item.a_int;
        free(addr_of(window_pick[0]));
    }
    destroy_nhwindow()(tmpwin);
    return optn_ok;
    } finally { stack_pop($frame); }
}

function handler_autounlock(optidx) { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let chngd;
    let oldflags = flags.autounlock;
    let optname = allopt[optidx].name;
    let buf = stack_array(char, BUFSZ), sep = iflags.menu_tab_sep ? ord('\t') : ord(' ');
    let window_pick = stack_var(ptr_to(struct_mi), null);
    let i, n, presel, res = optn_ok;
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    for (i = 0; i < SIZE(unlocktypes); ++i) {
        sprintf(buf, _("%-10.10s%c%.40s"), unlocktypes[i][0], sep, unlocktypes[i][1])
;
        presel = int(unsigned(flags.autounlock & unsigned((1 << i))));
        any.a_int = i + 1;
        add_menu(tmpwin, nul_glyphinfo, any, chars[unlocktypes[i][0]], 0,
                 ATR_NONE, clr, buf,
                 (presel ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE));
    }
    sprintf(buf, _("Select '%.20s' actions:"), optname);
    end_menu()(tmpwin, buf);
    n = select_menu(tmpwin, PICK_ANY, window_pick);
    if (n > 0) {
        let newflags = 0;

        for (i = 0; i < n; ++i)
            newflags = unsigned(newflags | unsigned((1 << (ptr_add(window_pick[0], i).item.a_int - 1))));
        flags.autounlock = newflags;
        free(addr_of(window_pick[0]));
    } else if (n == 0) { /* nothing was picked but menu wasn't cancelled */
        /* something that was preselected got unselected, leaving nothing;
           treat that as picking 'none' (even though 'none' is no longer
           among the choices) */
        flags.autounlock = 0;
    }
    destroy_nhwindow()(tmpwin);
    chngd = +(flags.autounlock != oldflags);
    if ((chngd || flags.verbose) && give_opt_msg[0]) {
        optfn_autounlock(optidx, get_val, FALSE, buf, (0));
        pline(_("'%s' %s '%s'."), optname,
              chngd ? _("changed to") : _("is still"), buf);
    }
    return res;
    } finally { stack_pop($frame); }
}

function handler_disclose() { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let i, n;
    let buf = stack_array(char, BUFSZ);
    /* order of disclose_names[] must correspond to
       disclosure_options in decl.c */
    let disclosure_names = static_array("handler_disclose.disclosure_names", ptr_to(char), null, [
        _("inventory"), _("attributes"), _("vanquished"),
        _("genocides"), _("conduct"),    _("overview"),
    ]);
    let disc_cat = stack_array(int, NUM_DISCLOSURE_OPTIONS);
    let pick_cnt, pick_idx, opt_idx;
    let c;
    let disclosure_pick = stack_var(ptr_to(struct_mi), null);
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    for (i = 0; i < NUM_DISCLOSURE_OPTIONS; i++) {
        sprintf(buf, _("%-12s[%c%c]"), disclosure_names[i], chars[flags.end_disclose + i], chars[disclosure_options + i])
;
        any.a_int = i + 1;
        add_menu(tmpwin, nul_glyphinfo, any, chars[disclosure_options + i],
                 0, ATR_NONE, clr, buf, MENU_ITEMFLAGS_NONE);
        disc_cat[i] = 0;
    }
    end_menu()(tmpwin, _("Change which disclosure options categories:"));
    pick_cnt = select_menu(tmpwin, PICK_ANY, disclosure_pick);
    if (pick_cnt > 0) {
        for (pick_idx = 0; pick_idx < pick_cnt; ++pick_idx) {
            opt_idx = ptr_add(disclosure_pick[0], pick_idx).item.a_int - 1;
            disc_cat[opt_idx] = 1;
        }
        free(addr_of(disclosure_pick[0]));
        disclosure_pick[0] = null;
    }
    destroy_nhwindow()(tmpwin);

    for (i = 0; i < NUM_DISCLOSURE_OPTIONS; i++) {
        if (disc_cat[i]) {
            c = chars[flags.end_disclose + i];
            sprintf(buf, _("Disclosure options for %s:"), disclosure_names[i])
;
            tmpwin = create_nhwindow()(NHW_MENU);
            start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
            struct_assign(any, cg.zeroany);
            /* 'y','n',and '+' work as alternate selectors; '-' doesn't */
            any.a_char = DISCLOSE_NO_WITHOUT_PROMPT;
            add_menu(tmpwin, nul_glyphinfo, any, 0,
                     any.a_char, ATR_NONE, clr,
                     _("Never disclose, without prompting"),
                     (c == any.a_char) ? MENU_ITEMFLAGS_SELECTED
                                       : MENU_ITEMFLAGS_NONE);
            any.a_char = DISCLOSE_YES_WITHOUT_PROMPT;
            add_menu(tmpwin, nul_glyphinfo, any, 0,
                     any.a_char, ATR_NONE, clr,
                     _("Always disclose, without prompting"),
                     (c == any.a_char) ? MENU_ITEMFLAGS_SELECTED
                                       : MENU_ITEMFLAGS_NONE);
            if (chars[disclosure_names[i]] == ord('v') || chars[disclosure_names[i]] == ord('g')) {
                any.a_char = DISCLOSE_SPECIAL_WITHOUT_PROMPT; /* '#' */
                add_menu(tmpwin, nul_glyphinfo, any, 0,
                         any.a_char, ATR_NONE, clr,
                         _("Always disclose, pick sort order from menu"),
                         (c == any.a_char) ? MENU_ITEMFLAGS_SELECTED
                                           : MENU_ITEMFLAGS_NONE);
            }
            any.a_char = DISCLOSE_PROMPT_DEFAULT_NO;
            add_menu(tmpwin, nul_glyphinfo, any, 0,
                     any.a_char, ATR_NONE, clr,
                     _("Prompt, with default answer of \"No\""),
                     (c == any.a_char) ? MENU_ITEMFLAGS_SELECTED
                                       : MENU_ITEMFLAGS_NONE);
            any.a_char = DISCLOSE_PROMPT_DEFAULT_YES;
            add_menu(tmpwin, nul_glyphinfo, any, 0,
                     any.a_char, ATR_NONE, clr,
                     _("Prompt, with default answer of \"Yes\""),
                     (c == any.a_char) ? MENU_ITEMFLAGS_SELECTED
                                       : MENU_ITEMFLAGS_NONE);
            if (chars[disclosure_names[i]] == ord('v') || chars[disclosure_names[i]] == ord('g')) {
                any.a_char = DISCLOSE_PROMPT_DEFAULT_SPECIAL; /* '?' */
                add_menu(tmpwin, nul_glyphinfo, any, 0,
                         any.a_char, ATR_NONE, clr,
                _("Prompt, with default answer of \"Ask\" to request sort menu"),
                         (c == any.a_char) ? MENU_ITEMFLAGS_SELECTED
                                           : MENU_ITEMFLAGS_NONE);
            }
            end_menu()(tmpwin, buf);
            n = select_menu(tmpwin, PICK_ONE, disclosure_pick);
            if (n > 0) {
                chars[flags.end_disclose + i] = ptr_add(disclosure_pick[0], 0).item.a_char;
                if (n > 1 && chars[flags.end_disclose + i] == c)
                    chars[flags.end_disclose + i] = ptr_add(disclosure_pick[0], 1).item.a_char;
                free(addr_of(disclosure_pick[0]));
            }
            destroy_nhwindow()(tmpwin);
        }
    }
    return optn_ok;
    } finally { stack_pop($frame); }
}

function handler_menu_headings() { /* int */
    let gotca = query_color_attr(iflags.menu_headings,
                                     _("How to highlight menu headings:"));

    if (gotca) {
        /* header highlighting affects persistent inventory display */
        if (iflags.perm_invent)
            update_inventory();
    }
    adjust_menu_promptstyle(WIN_INVEN, iflags.menu_headings);
    return optn_ok;
}

function handler_menu_objsyms() { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let buf = stack_array(char, BUFSZ);
    let picklist = stack_var(ptr_to(struct_mi), null);
    let sep = iflags.menu_tab_sep ? ord('\t') : ord(' ');
    let i, j, n, clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    for (i = 0; i < SIZE(objsymvals); ++i) {
        Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%-12.12s%c%.60s"), objsymvals[i].nam, sep, objsymvals[i].descr)
;
        any.a_int = i + 1;
        j = objsymvals[i].num;
        add_menu(tmpwin, nul_glyphinfo, any, ord('0') + i, chars[buf],
                 ATR_NONE, clr, buf,
                 (j == iflags.menuobjsyms) ? MENU_ITEMFLAGS_SELECTED
                                           : MENU_ITEMFLAGS_NONE);
    }
    end_menu()(tmpwin, _("Set object symbols in menus to what?"));
    n = select_menu(tmpwin, PICK_ONE, picklist);
    if (n > 0) {
        i = ptr_add(picklist[0], 0).item.a_int - 1;
        /* if there are two picks, use the one that wasn't pre-selected */
        if (n > 1 && i == iflags.menuobjsyms)
            i = ptr_add(picklist[0], 1).item.a_int - 1;
        set_menuobjsyms_flags(i);
        free(addr_of(picklist[0]));
    }
    destroy_nhwindow()(tmpwin);
    return optn_ok;
    } finally { stack_pop($frame); }
}

function handler_msg_window() { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let is_tty = +(windowprocs.wp_id == wp_tty), is_curses = +(windowprocs.wp_id == wp_curses);
    let clr = NO_COLOR;

    if (is_tty || is_curses) {
        /* by Christian W. Cooper */
        let chngd;
        let i, n;
        let buf = stack_array(char, BUFSZ), c,
             sep = iflags.menu_tab_sep ? ord('\t') : ord(' '),
             old_prevmsg_window = iflags.prevmsg_window;
        let window_pick = stack_var(ptr_to(struct_mi), null);

        tmpwin = create_nhwindow()(NHW_MENU);
        start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
        struct_assign(any, cg.zeroany);

        for (i = 0; i < SIZE(menutype); i++) {
            if (i < 2 && is_curses)
                continue;
            sprintf(buf, _("%-12.12s%c%.60s"), msgwind[i][0], sep, msgwind[i][1])
;
            any.a_char = c = chars[msgwind[i][0]];
            add_menu(tmpwin, nul_glyphinfo, any, chars[buf], 0,
                     ATR_NONE, clr, buf,
                     (c == iflags.prevmsg_window) ? MENU_ITEMFLAGS_SELECTED
                                                  : MENU_ITEMFLAGS_NONE);
            /* second line is prefixed by spaces that "c - " would use */
            sprintf(buf, _("%4s%-12.12s%c%.60s"), _(""), _(""), sep, msgwind[i][2]);
            add_menu_str(tmpwin, buf);
        }
        end_menu()(tmpwin, _("Select message history display type:"));
        n = select_menu(tmpwin, PICK_ONE, window_pick);
        if (n > 0) {
            c = ptr_add(window_pick[0], 0).item.a_char;
            /* if there are two picks, use the one that wasn't pre-selected */
            if (n > 1 && c == old_prevmsg_window)
                c = ptr_add(window_pick[0], 1).item.a_char;
            iflags.prevmsg_window = c;
            free(addr_of(window_pick[0]));
        }
        destroy_nhwindow()(tmpwin);
        chngd = +(iflags.prevmsg_window != old_prevmsg_window);
        if (chngd || flags.verbose) {
            optfn_msg_window(opt_msg_window, get_val,
                                    FALSE, buf, empty_optstr);
            pline(_("'msg_window' %.20s \"%.20s\"."),
                  chngd ? _("changed to") : _("is still"), buf);
        }
    } else

        pline(_("'%s' option is not supported for '%s'."),
              allopt[opt_msg_window].name, windowprocs.name);
    return optn_ok;
    } finally { stack_pop($frame); }
}

function handler_number_pad() { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let i;
    let npchoices = static_array("handler_number_pad.npchoices", ptr_to(char), null, [
        _(" 0 (off)"), _(" 1 (on)"), _(" 2 (on, MSDOS compatible)"),
        _(" 3 (on, phone-style digit layout)"),
        _(" 4 (on, phone-style layout, MSDOS compatible)"),
        _("-1 (off, 'z' to move upper-left, 'y' to zap wands)")
    ]);
    let mode_pick = stack_var(ptr_to(struct_mi), null);
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    for (i = 0; i < SIZE(npchoices); i++) {
        any.a_int = i + 1;
        add_menu(tmpwin, nul_glyphinfo, any, ord('a') + i, ord('0') + i,
                 ATR_NONE, clr, npchoices[i], MENU_ITEMFLAGS_NONE);
    }
    end_menu()(tmpwin, _("Select number_pad mode:"));
    if (select_menu(tmpwin, PICK_ONE, mode_pick) > 0) {
        switch (mode_pick[0].item.a_int - 1) {
        case 0:
            iflags.num_pad = FALSE;
            iflags.num_pad_mode = 0;
            break;
        case 1:
            iflags.num_pad = TRUE;
            iflags.num_pad_mode = 0;
            break;
        case 2:
            iflags.num_pad = TRUE;
            iflags.num_pad_mode = 1;
            break;
        case 3:
            iflags.num_pad = TRUE;
            iflags.num_pad_mode = 2;
            break;
        case 4:
            iflags.num_pad = TRUE;
            iflags.num_pad_mode = 3;
            break;
        /* last menu choice: number_pad == -1 */
        case 5:
            iflags.num_pad = FALSE;
            iflags.num_pad_mode = 1;
            break;
        }
        reset_commands(FALSE);
        number_pad()(iflags.num_pad ? 1 : 0);
        free(addr_of(mode_pick[0]));
    }
    destroy_nhwindow()(tmpwin);
    return optn_ok;
    } finally { stack_pop($frame); }
}

function handler_paranoid_confirmation() { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let i;
    let mkey, mbuf = stack_array(char, QBUFSZ), ebuf = stack_array(char, BUFSZ), cbuf = stack_array(char, QBUFSZ);
    let explain, cmdnm;
    let paranoia_picks = stack_var(ptr_to(struct_mi), null);
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    for (i = 0; paranoia[i].flagmask != 0; ++i) {
        if (paranoia[i].flagmask == PARANOID_BONES && !wizard())
            continue;
        /* the 'swim' choice mentions the 'm' movement prefix in its
           explanation; if that's been bound to something else or been
           unbound altogether, substitute the replacement in the text */
        explain = paranoia[i].explain;
        if (strstri(explain, _("'m'"))
            && (mkey = cmd_from_func(do_reqmenu)) != ord('m')) {
            if (mkey) { /* key for 'm' prefix */
                sprintf(mbuf, _("'%.9s'"), visctrl(mkey)); /* .5 is enough */
            } else { /* extended command name for 'm' prefix */
                cmdnm = cmdname_from_func(do_reqmenu, cbuf, TRUE);
                if (!cmdnm)
                    cmdnm = _("reqmenu");
                sprintf(mbuf, _("'%s%.31s'"), (chars[cmdnm] != ord('#')) ? _("#") : _(""), cmdnm);
            }
            explain = strsubst(strcpy(ebuf, explain), _("'m'"), mbuf);
        }
        any.a_int = paranoia[i].flagmask;
        add_menu(tmpwin, nul_glyphinfo, any, chars[paranoia[i].argname],
                 0, ATR_NONE, clr, explain,
                 (flags.paranoia_bits & unsigned(paranoia[i].flagmask))
                     ? MENU_ITEMFLAGS_SELECTED
                     : MENU_ITEMFLAGS_NONE);
    }
    end_menu()(tmpwin, _("Actions requiring extra confirmation:"));
    i = select_menu(tmpwin, PICK_ANY, paranoia_picks);
    if (i >= 0) {
        /* player didn't cancel; we reset all the paranoia options
           here even if there were no items picked, since user
           could have toggled off preselected ones to end up with 0 */
        flags.paranoia_bits = 0;
        if (i > 0) {
            /* at least 1 item set, either preselected or newly picked */
            while (--i >= 0)
                flags.paranoia_bits |= unsigned(ptr_add(paranoia_picks[0], i).item.a_int);
            free(addr_of(paranoia_picks[0]));
        }
    }
    destroy_nhwindow()(tmpwin);
    return optn_ok;
    } finally { stack_pop($frame); }
}

function handler_perminv_mode() { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let let_, buf = stack_array(char, BUFSZ), sepbuf = stack_array(char, 10);
    let pi0, pi1;
    let pi_pick = stack_var(ptr_to(struct_mi), null);
    let old_perm_invent = iflags.perm_invent;
    let i, n, old_pi = iflags.perminv_mode, new_pi = old_pi,
        widest = !(windowprocs.wp_id == wp_tty) ? 8 : 11; /* "in-use__" or "full+grid__" */

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    for (i = 0; i < SIZE(perminv_modes); ++i) {
        if (!(pi0 = perminv_modes[i][0]))
            continue;

        pi1 = perminv_modes[i][1];
        if (!iflags.menu_tab_sep) {
            let numspaces = widest - int(strlen(pi0));

            sprintf(sepbuf, _("%*s"), max(numspaces, 1), _(" "));
        } else {
            strcpy(sepbuf, _("\t"));
        }
        sprintf(buf, _("%s%s%s"), pi0, sepbuf, perminv_modes[i][2]);
        let_ = ((i & InvSparse) != 0) ? highc(chars[pi1 + 0]) : chars[pi0 + 0];
        any.a_int = i + 1;
        add_menu(tmpwin, nul_glyphinfo, any, let_, ord('0') + i,
                 ATR_NONE, NO_COLOR,
                 buf, (i == old_pi) ? MENU_ITEMFLAGS_SELECTED
                                    : MENU_ITEMFLAGS_NONE);
    }
    end_menu()(tmpwin, _("Choose permanent inventory mode:"));
    n = select_menu(tmpwin, PICK_ONE, pi_pick);
    destroy_nhwindow()(tmpwin);
    if (n > 0) {
        new_pi = ptr_add(pi_pick[0], 0).item.a_int - 1;
        if (n > 1 && new_pi == old_pi)
            new_pi = ptr_add(pi_pick[0], 1).item.a_int - 1;
        free(addr_of(pi_pick[0]));
        iflags.perminv_mode = uchar(new_pi);
    }
    if (n >= 0) { /* not ESC */
        chars[buf + 0] = ord('\0');
        optfn_perminv_mode(opt_perm_invent, get_val, FALSE, buf, 0);
        pline(_("'perminv_mode' %s '%s' (%s)."),
              (new_pi != old_pi) ? _("changed to") : _("is still"),
              perminv_modes[new_pi][0], buf);
        if (new_pi != InvOptNone && !old_perm_invent)
            iflags.perm_invent = can_set_perm_invent();
        else if (new_pi == InvOptNone && old_perm_invent)
            iflags.perm_invent = FALSE;

        if (new_pi != old_pi || iflags.perm_invent != old_perm_invent) {
            go.opt_need_redraw = TRUE;
        }
    }
    return optn_ok;
    } finally { stack_pop($frame); }
}

function handler_pickup_burden() { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let i;
    let burden_name, burden_letters = _("ubsntl");
    let burden_pick = stack_var(ptr_to(struct_mi), null);
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    for (i = 0; i < SIZE(burdentype); i++) {
        burden_name = burdentype[i];
        any.a_int = i + 1;
        add_menu(tmpwin, nul_glyphinfo, any, chars[burden_letters + i],
                 0, ATR_NONE, clr, burden_name, MENU_ITEMFLAGS_NONE);
    }
    end_menu()(tmpwin, _("Select encumbrance level:"));
    if (select_menu(tmpwin, PICK_ONE, burden_pick) > 0) {
        flags.pickup_burden = burden_pick[0].item.a_int - 1;
        free(addr_of(burden_pick[0]));
    }
    destroy_nhwindow()(tmpwin);
    return optn_ok;
    } finally { stack_pop($frame); }
}

function handler_pickup_types() { /* int */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);

    /* parseoptions will prompt for the list of types */
    parseoptions(strcpy(buf, _("pickup_types")), FALSE, FALSE);
    return optn_ok;
    } finally { stack_pop($frame); }
}

function handler_runmode() { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let i;
    let mode_name;
    let mode_pick = stack_var(ptr_to(struct_mi), null);
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    for (i = 0; i < SIZE(runmodes); i++) {
        mode_name = runmodes[i];
        any.a_int = i + 1;
        add_menu(tmpwin, nul_glyphinfo, any, chars[mode_name],
                 0, ATR_NONE, clr, mode_name, MENU_ITEMFLAGS_NONE);
    }
    end_menu()(tmpwin, _("Select run/travel display mode:"));
    if (select_menu(tmpwin, PICK_ONE, mode_pick) > 0) {
        flags.runmode = mode_pick[0].item.a_int - 1;
        free(addr_of(mode_pick[0]));
    }
    destroy_nhwindow()(tmpwin);
    return optn_ok;
    } finally { stack_pop($frame); }
}

function handler_petattr() { /* int */
    let tmp = query_attr(_("Select pet highlight attribute"), iflags.wc2_petattr);

    if (tmp != -1) {
        iflags.wc2_petattr = tmp;
        iflags.wc_hilite_pet = +(iflags.wc2_petattr != ATR_NONE);
        if (!go.opt_initial)
            go.opt_need_redraw = TRUE;
    }
    return optn_ok;
}

function handler_sortloot() { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let i, n;
    let sortl_name;
    let sortl_pick = stack_var(ptr_to(struct_mi), null);
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    for (i = 0; i < SIZE(sortltype); i++) {
        sortl_name = sortltype[i];
        any.a_char = chars[sortl_name];
        add_menu(tmpwin, nul_glyphinfo, any, chars[sortl_name],
                 0, ATR_NONE, clr,
                 sortl_name, (flags.sortloot == chars[sortl_name])
                                ? MENU_ITEMFLAGS_SELECTED
                                : MENU_ITEMFLAGS_NONE);
    }
    end_menu()(tmpwin, _("Select loot sorting type:"));
    n = select_menu(tmpwin, PICK_ONE, sortl_pick);
    if (n > 0) {
        let c = ptr_add(sortl_pick[0], 0).item.a_char;

        if (n > 1 && c == flags.sortloot)
            c = ptr_add(sortl_pick[0], 1).item.a_char;
        flags.sortloot = c;
        /* changing to or from 'f' affects persistent inventory display */
        if (iflags.perm_invent)
            update_inventory();
        free(addr_of(sortl_pick[0]));
    }
    destroy_nhwindow()(tmpwin);
    return optn_ok;
    } finally { stack_pop($frame); }
}

function handler_whatis_coord() { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let buf = stack_array(char, BUFSZ);
    let window_pick = stack_var(ptr_to(struct_mi), null);
    let pick_cnt;
    let gpc = iflags.getpos_coords;
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    any.a_char = GPCOORDS_COMPASS;
    add_menu(tmpwin, nul_glyphinfo, any, GPCOORDS_COMPASS,
             0, ATR_NONE, clr,
             _("compass ('east' or '3s' or '2n,4w')"),
             (gpc == GPCOORDS_COMPASS)
                ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);
    any.a_char = GPCOORDS_COMFULL;
    add_menu(tmpwin, nul_glyphinfo, any, GPCOORDS_COMFULL,
             0, ATR_NONE, clr,
             _("full compass ('east' or '3south' or '2north,4west')"),
             (gpc == GPCOORDS_COMFULL)
                ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);
    any.a_char = GPCOORDS_MAP;
    add_menu(tmpwin, nul_glyphinfo, any, GPCOORDS_MAP,
             0, ATR_NONE, clr, _("map <x,y>"),
             (gpc == GPCOORDS_MAP)
                ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);
    any.a_char = GPCOORDS_SCREEN;
    add_menu(tmpwin, nul_glyphinfo, any, GPCOORDS_SCREEN,
             0, ATR_NONE, clr, _("screen [row,column]"),
             (gpc == GPCOORDS_SCREEN)
                ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);
    any.a_char = GPCOORDS_NONE;
    add_menu(tmpwin, nul_glyphinfo, any, GPCOORDS_NONE,
             0, ATR_NONE, clr, _("none (no coordinates displayed)"),
             (gpc == GPCOORDS_NONE)
                ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);
    add_menu_str(tmpwin, _(""));
    sprintf(buf, _("map: upper-left: <%d,%d>, lower-right: <%d,%d>%s"), 1, 0, COLNO - 1, ROWNO - 1, flags.verbose ? _("; column 0 unused, off left edge") : _(""))

;
    add_menu_str(tmpwin, buf);
    if (strcmp(windowprocs.name, _("tty"))) /* only show for non-tty */
        add_menu_str(tmpwin,
      _("screen: row is offset to accommodate tty interface's use of top line"));

    sprintf(buf, _("screen: upper-left: [%02d,%02d], lower-right: [%d,%d]%s"), 0 + 2, 1, ROWNO - 1 + 2, COLNO - 1, COL80ARG())
;

    add_menu_str(tmpwin, buf);
    add_menu_str(tmpwin, _(""));
    end_menu()(tmpwin,
        _("Select coordinate display when auto-describing a map position:"));
    if ((pick_cnt = select_menu(tmpwin, PICK_ONE, window_pick)) > 0) {
        iflags.getpos_coords = ptr_add(window_pick[0], 0).item.a_char;
        /* PICK_ONE doesn't unselect preselected entry when
           selecting another one */
        if (pick_cnt > 1 && iflags.getpos_coords == gpc)
            iflags.getpos_coords = ptr_add(window_pick[0], 1).item.a_char;
        free(addr_of(window_pick[0]));
    }
    destroy_nhwindow()(tmpwin);
    return optn_ok;
    } finally { stack_pop($frame); }
}
export function COL80ARG() { return flags.verbose ? _("; column 80 is not used") : _(""); }

function handler_whatis_filter() { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let window_pick = stack_var(ptr_to(struct_mi), null);
    let pick_cnt;
    let gfilt = iflags.getloc_filter;
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    any.a_char = (GFILTER_NONE + 1);
    add_menu(tmpwin, nul_glyphinfo, any, ord('n'),
             0, ATR_NONE, clr, _("no filtering"),
             (gfilt == GFILTER_NONE)
                ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);
    any.a_char = (GFILTER_VIEW + 1);
    add_menu(tmpwin, nul_glyphinfo, any, ord('v'),
             0, ATR_NONE, clr, _("in view only"),
             (gfilt == GFILTER_VIEW)
                ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);
    any.a_char = (GFILTER_AREA + 1);
    add_menu(tmpwin, nul_glyphinfo, any, ord('a'),
             0, ATR_NONE, clr, _("in same area"),
             (gfilt == GFILTER_AREA)
                ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);
    end_menu()(tmpwin,
      _("Select location filtering when going for next/previous map position:"));
    if ((pick_cnt = select_menu(tmpwin, PICK_ONE, window_pick)) > 0) {
        iflags.getloc_filter = (ptr_add(window_pick[0], 0).item.a_char - 1);
        /* PICK_ONE doesn't unselect preselected entry when
           selecting another one */
        if (pick_cnt > 1 && iflags.getloc_filter == gfilt)
            iflags.getloc_filter = (ptr_add(window_pick[0], 1).item.a_char - 1);
        free(addr_of(window_pick[0]));
    }
    destroy_nhwindow()(tmpwin);
    return optn_ok;
    } finally { stack_pop($frame); }
}

function handler_symset(optidx) { /* int */
    let reslt;

    reslt = do_symset(+(optidx == opt_roguesymset));   /* symbols.c */
    go.opt_need_redraw = TRUE;
    return reslt;
}

function handler_autopickup_exception() { /* int */
    const $frame = stack_frame(); try {
    var tmpwin;
    var any = stack_struct(struct_any);
    var i;
    var opt_idx, numapes = 0;
    var apebuf = stack_array(char, 2 + BUFSZ); /* so &apebuf[1] is BUFSZ long for getlin() */
    var ape;
    var clr = NO_COLOR;

 ape_again: for (;;) {
    numapes = count_apes();
    opt_idx = handle_add_list_remove(_("autopickup exception"), numapes);
    if (opt_idx == 3) { /* done */
        return TRUE;
    } else if (opt_idx == 0) { /* add new */
        /* EDIT_GETLIN:  assume user doesn't user want previous
           exception used as default input string for this one... */
        chars[apebuf + 0] = chars[apebuf + 1] = ord('\0');
        getlin(_("What new autopickup exception pattern?"), apebuf + 1);
        mungspaces(apebuf + 1); /* regularize whitespace */
        if (chars[apebuf + 1] == ord('\x1b'))
            return TRUE;
        if (chars[apebuf + 1]) {
            chars[apebuf + 0] = ord('\"');
            /* guarantee room for \" prefix and \"\0 suffix;
               -2 is good enough for apebuf[] but -3 makes
               sure the whole thing fits within normal BUFSZ */
            chars[apebuf + (sizeof(array_of(char, 2 + BUFSZ)) - 2)] = ord('\0');
            strcat(apebuf, _("\""));
            add_autopickup_exception(apebuf);
        }
        continue ape_again;
    } else { /* list (1) or remove (2) */
        var pick_idx, pick_cnt;
        var pick_list = stack_var(ptr_to(struct_mi), null);

        tmpwin = create_nhwindow()(NHW_MENU);
        start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
        if (numapes) {
            ape = ga.apelist;
            struct_assign(any, cg.zeroany);
            add_menu_heading(tmpwin,
                             _("Always pickup '<'; never pickup '>'"));
            for (i = 0; i < numapes && ape; i++) {
                any.a_void = addr_of((opt_idx == 1) ? null : ape);
                /* length of pattern plus quotes (plus '<'/'>') is
                   less than BUFSZ */
                sprintf(apebuf, _("\"%c%s\""), ape.grab ? ord('<') : ord('>'), ape.pattern)
;
                add_menu(tmpwin, nul_glyphinfo, any, 0, 0,
                         ATR_NONE, clr, apebuf, MENU_ITEMFLAGS_NONE);
                ape = ape.next;
            }
        }
        sprintf(apebuf, _("%s autopickup exceptions"), (opt_idx == 1) ? _("List of") : _("Remove which"))
;
        end_menu()(tmpwin, apebuf);
        pick_cnt = select_menu(tmpwin,
                               (opt_idx == 1) ? PICK_NONE : PICK_ANY,
                               pick_list);
        if (pick_cnt > 0) {
            for (pick_idx = 0; pick_idx < pick_cnt; ++pick_idx)
                remove_autopickup_exception(
                                     view_of(struct_autopickup_exception, ptr_add(pick_list[0], pick_idx).item.a_void))
;
            free(addr_of(pick_list[0])), pick_list[0] = null;
        }
        destroy_nhwindow()(tmpwin);
        if (pick_cnt >= 0)
            continue ape_again;;
    } break; }
    return optn_ok;
    } finally { stack_pop($frame); }
}

function handler_menu_colors() { /* int */
    const $frame = stack_frame(); try {
    let $goto = null; var any = stack_struct(struct_any), buf = stack_array(char, BUFSZ), mcbuf = stack_array(char, BUFSZ), pick_list = stack_var(ptr_to(struct_mi)), clrbuf = stack_array(char, QBUFSZ);
    var tmpwin;

    var opt_idx, nmc, mcclr, mcattr;

    var clr = NO_COLOR;

 $goto_menucolors_again: for (;;) { switch ($goto) { default: case "menucolors_again": $goto = null;
    nmc = count_menucolors();
    opt_idx = handle_add_list_remove(_("menucolor"), nmc);
    case "menucolors_done": if ($goto || (opt_idx == 3)) { /* done */
 $goto = null;
        /* in case we've made a change which impacts current persistent
           inventory window; we don't track whether an actual changed
           occurred, so just assume there was one and that it matters;
           if we're wrong, a redundant update is cheap... */
        if (iflags.use_menu_color) {
            if (iflags.perm_invent)
                update_inventory();
        }
        return optn_ok;
    } else if (opt_idx == 0) { /* add new */
        chars[mcbuf + 0] = ord('\0');
        getlin(_("What new menucolor pattern?"), mcbuf);
        if (chars[mcbuf] == ord('\x1b'))
            { $goto = "menucolors_done"; continue $goto_menucolors_again; };
        if (chars[mcbuf]
            && test_regex_pattern(mcbuf, _("MENUCOLORS regex"))
            && (mcclr = query_color(0, NO_COLOR)) != -1
                && (mcattr = query_attr(0, ATR_NONE)) != -1
            && !add_menu_coloring_parsed(mcbuf, mcclr, mcattr)) {
            pline(_("Error adding the menu color."));
            wait_synch()();
        }
        { $goto = "menucolors_again"; continue $goto_menucolors_again; }
    } else { /* list (1) or remove (2) */
        var pick_idx, pick_cnt;
        var mc_idx;
        var ln;
        var sattr, sclr;
        pick_list[0] = null;
        var tmp = gm.menu_colorings;

        tmpwin = create_nhwindow()(NHW_MENU);
        start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
        struct_assign(any, cg.zeroany);
        mc_idx = 0;
        while (tmp) {
            sattr = attr2attrname(tmp.attr);
            sclr = strcpy(clrbuf, clr2colorname(tmp.color));
            strNsubst(clrbuf, _(" "), _("-"), 0);
            any.a_int = ++mc_idx;
            /* construct suffix */
            sprintf(buf, _("\"\"=%s%s%s"), sclr, (tmp.attr != ATR_NONE) ? _("&") : _(""), (tmp.attr != ATR_NONE) ? sattr : _(""))

;
            /* now main string */
            ln = unsigned(unsigned(sizeof(array_of(char, BUFSZ)) - Strlen(buf)) - 1); /* length available */
            strcpy(mcbuf, _("\""));
            if (strlen(tmp.origstr) > ln)
                strcat(strncat(mcbuf, tmp.origstr, unsigned(ln - 3)), _("..."));
            else
                strcat(mcbuf, tmp.origstr);
            /* combine main string and suffix */
            strcat(mcbuf, buf + 1); /* skip buf[]'s initial quote */
            add_menu(tmpwin, nul_glyphinfo, any, 0, 0,
                     ATR_NONE, clr, mcbuf, MENU_ITEMFLAGS_NONE);
            tmp = tmp.next;
        }
        sprintf(mcbuf, _("%s menu colors"), (opt_idx == 1) ? _("List of") : _("Remove which"))
;
        end_menu()(tmpwin, mcbuf);
        pick_cnt = select_menu(tmpwin,
                               (opt_idx == 1) ? PICK_NONE : PICK_ANY,
                               pick_list);
        if (pick_cnt > 0) {
            for (pick_idx = 0; pick_idx < pick_cnt; ++pick_idx)
                free_one_menu_coloring(ptr_add(pick_list[0], pick_idx).item.a_int - 1
                                       - pick_idx);
            free(addr_of(pick_list[0])), pick_list[0] = null;
        }
        destroy_nhwindow()(tmpwin);
        if (pick_cnt >= 0)
            { $goto = "menucolors_again"; continue $goto_menucolors_again; };
    } } break; }
    return optn_ok;
    } finally { stack_pop($frame); }
}

function handler_msgtype() { /* int */
    const $frame = stack_frame(); try {
    var tmpwin;
    var any = stack_struct(struct_any);
    var opt_idx, nmt, mttyp;
    var mtbuf = stack_array(char, BUFSZ);

 msgtypes_again: for (;;) {
    nmt = msgtype_count();
    opt_idx = handle_add_list_remove(_("message type"), nmt);
    if (opt_idx == 3) { /* done */
        return TRUE;
    } else if (opt_idx == 0) { /* add new */
        chars[mtbuf + 0] = ord('\0');
        getlin(_("What new message pattern?"), mtbuf);
        if (chars[mtbuf] == ord('\x1b'))
            return TRUE;
        if (chars[mtbuf]
            && test_regex_pattern(mtbuf, _("MSGTYPE regex"))
            && (mttyp = query_msgtype()) != -1
            && !msgtype_add(mttyp, mtbuf)) {
            pline(_("Error adding the message type."));
            wait_synch()();
        }
        continue msgtypes_again;
    } else { /* list (1) or remove (2) */
        var pick_idx, pick_cnt;
        var mt_idx;
        var ln;
        var mtype;
        var pick_list = stack_var(ptr_to(struct_mi), null);
        var tmp = gp.plinemsg_types;
        var clr = NO_COLOR;

        tmpwin = create_nhwindow()(NHW_MENU);
        start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
        struct_assign(any, cg.zeroany);
        mt_idx = 0;
        while (tmp) {
            mtype = msgtype2name(tmp.msgtype);
            any.a_int = ++mt_idx;
            sprintf(mtbuf, _("%-5s \""), mtype);
            ln = unsigned(unsigned(sizeof(array_of(char, BUFSZ)) - Strlen(mtbuf)) - sizeof_string("\""));
            if (strlen(tmp.pattern) > ln)
                strcat(strncat(mtbuf, tmp.pattern, unsigned(ln - 3)), _("...\""));
            else
                strcat(strcat(mtbuf, tmp.pattern), _("\""));
            add_menu(tmpwin, nul_glyphinfo, any, 0, 0,
                     ATR_NONE, clr, mtbuf, MENU_ITEMFLAGS_NONE);
            tmp = tmp.next;
        }
        sprintf(mtbuf, _("%s message types"), (opt_idx == 1) ? _("List of") : _("Remove which"))
;
        end_menu()(tmpwin, mtbuf);
        pick_cnt = select_menu(tmpwin,
                               (opt_idx == 1) ? PICK_NONE : PICK_ANY,
                               pick_list);
        if (pick_cnt > 0) {
            for (pick_idx = 0; pick_idx < pick_cnt; ++pick_idx)
                free_one_msgtype(ptr_add(pick_list[0], pick_idx).item.a_int - 1
                                       - pick_idx);
            free(addr_of(pick_list[0])), pick_list[0] = null;
        }
        destroy_nhwindow()(tmpwin);
        if (pick_cnt >= 0)
            continue msgtypes_again;;
    } break; }
    return optn_ok;
    } finally { stack_pop($frame); }
}

function handler_versinfo() { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let vi_pick = stack_var(ptr_to(struct_mi), null);
    let have_branch = (nomakedefs.git_branch && chars[nomakedefs.git_branch] ? 1 : 0);
    let n, vi = int(flags.versinfo);

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);

    any.a_int = n = VI_NUMBER; /* 1 */
    add_menu(tmpwin, nul_glyphinfo, any, ord('n'), n + ord('0'), ATR_NONE, NO_COLOR,
             _("version number"),
             (vi & n) ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);
    any.a_int = n = VI_NAME; /* 2 */
    add_menu(tmpwin, nul_glyphinfo, any, ord('g'), n + ord('0'), ATR_NONE, NO_COLOR,
             _("game name"),
             (vi & n) ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);
    any.a_int = n = VI_BRANCH; /* 4 */
    add_menu(tmpwin, nul_glyphinfo, any, ord('b'), n + ord('0'), ATR_NONE, NO_COLOR,
             (have_branch ? _("development branch")

                          : _("(not applicable)")

              ), (vi & n) ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);

    end_menu()(tmpwin, _("Select version information flags:"));
    n = select_menu(tmpwin, PICK_ANY, vi_pick);
    if (n > 0) {
        let i, newval = 0;

        for (i = 0; i < n; ++i)
            newval |= ptr_add(vi_pick[0], i).item.a_int;
        newval &= 7;
        if (newval)
            flags.versinfo = unsigned(newval);
        free(addr_of(vi_pick[0]));
    }
    destroy_nhwindow()(tmpwin);
    return optn_ok;
    } finally { stack_pop($frame); }
}

function handler_windowborders() { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let i;
    let mode_name;
    let mode_pick = stack_var(ptr_to(struct_mi), null);
    let clr = NO_COLOR;
    let windowborders_text = static_array("handler_windowborders.windowborders_text", ptr_to(char), null, [
        _("Off, never show borders"),
        _("On, always show borders"),
        _("Auto, on if display is at least (24+2)x(80+2)"),
        _("On, except forced off for perm_invent"),
        _("Auto, except forced off for perm_invent")
    ]);

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    for (i = 0; i < SIZE(windowborders_text); i++) {
        mode_name = windowborders_text[i];
        any.a_int = i + 1;
        /* index 'i' matches the numeric setting for windowborders,
           so allow corresponding digit as group accelerator */
        add_menu(tmpwin, nul_glyphinfo, any, ord('a') + i, ord('0') + i,
                 ATR_NONE, clr, mode_name, MENU_ITEMFLAGS_NONE);
    }
    end_menu()(tmpwin, _("Select window borders mode:"));
    if (select_menu(tmpwin, PICK_ONE, mode_pick) > 0) {
        iflags.wc2_windowborders = mode_pick[0].item.a_int - 1;
        free(addr_of(mode_pick[0]));
    }
    destroy_nhwindow()(tmpwin);
    return optn_ok;
    } finally { stack_pop($frame); }
}

/*
 **********************************
 *
 *   Parsing Support Functions
 *
 **********************************
 */

function string_for_opt(opts, val_optional) { /* char * */
    let colon, equals;

    colon = strchr(opts, ord(':'));
    equals = strchr(opts, ord('='));
    if (!colon || (equals && equals < colon))
        colon = equals;

    if (!colon || !chars[++colon]) {
        if (!val_optional)
            config_error_add(_("Missing parameter for '%s'"), opts);
        return empty_optstr;
    }
    return colon;
}

function string_for_env_opt(optname, opts, val_optional) { /* char * */
    if (!go.opt_initial) {
        rejectoption(optname);
        return empty_optstr;
    }
    return string_for_opt(opts, val_optional);
}

function bad_negation(optname, with_parameter) { /* void */
    config_error_add(_("The %s option may not %sbe negated."), optname,
                     with_parameter ? _("both have a value and ") : _(""));
}

/* go through all of the options and set the minmatch value
   based on what is needed for uniqueness of each individual
   option. Set a minimum of 3 characters. */
function determine_ambiguities() { /* void */
    const $frame = stack_frame(); try {
    let i, j, len, tmpneeded, needed = stack_array(int, SIZE(allopt));
    let p1, p2;

    for (i = 0; i < SIZE(allopt) - 1; ++i) {
        needed[i] = 0;
    }

    for (i = 0; i < SIZE(allopt) - 1; ++i) {
        for (j = 0; j < SIZE(allopt) - 1; ++j) {
            if (j == i)
                continue;

            p1 = allopt[i].name; /* back to the start */
            p2 = allopt[j].name;
            tmpneeded = 1;
            while (chars[p1] && chars[p2] && lowc(chars[p1]) == lowc(chars[p2])) {
                ++tmpneeded;
                ++p1;
                ++p2;
            }
            if (tmpneeded > needed[i])
                needed[i] = tmpneeded;
            if (tmpneeded > needed[j])
                needed[j] = tmpneeded;
        }
    }
    for (i = 0; i < SIZE(allopt) - 1; ++i) {
        len = int(Strlen(allopt[i].name));
        allopt[i].minmatch = (needed[i] < 3) ? 3
                                : (needed[i] <= len) ? needed[i] : len;
    }
    } finally { stack_pop($frame); }
}

function length_without_val(user_string, len) { /* int */
    let p = strchr(user_string, ord(':')),
               q = strchr(user_string, ord('='));

    if (!p || (q && q < p))
        p = q;
    if (p) {
        /* 'user_string' hasn't necessarily been through mungspaces()
           so might have tabs or consecutive spaces */
        while (p > user_string && __isspace(uchar((chars[(p - 1)]))))
            p--;
        len = (p - user_string);
    }
    return len;
}

/* check whether a user-supplied option string is a proper leading
   substring of a particular option name; option string might have
   a colon or equals sign and arbitrary value appended to it */
export function match_optname(user_string, optn_name,
              min_length, val_allowed) { /* boolean */
    let len = int(strlen(user_string));

    if (val_allowed)
        len = length_without_val(user_string, len);

    return (+(len >= min_length
                      && !strncmpi(optn_name, user_string, len)));
}

export function reset_duplicate_opt_detection() { /* void */
    let k;

    for (k = 0; k < OPTCOUNT; ++k)
        allopt[k].dupdetected = 0;
}

function duplicate_opt_detection(optidx) { /* boolean */
    if (go.opt_initial && go.opt_from_file)
        return allopt[optidx].dupdetected++;
    return FALSE;
}

function complain_about_duplicate(optidx) { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);

    chars[buf + 0] = ord('\0');
    if (using_alias[0])
        sprintf(buf, _(" (via alias: %s)"), allopt[optidx].alias);
    config_error_add(_("%s option specified multiple times: %s%s"),
                     (allopt[optidx].opttyp == CompOpt) ? _("compound")
                                                        : _("boolean"),
                     allopt[optidx].name, buf);

    return;
    } finally { stack_pop($frame); }
}

function rejectoption(optname) { /* void */
    pline(_("%s can be set only from NETHACKOPTIONS or %s."), optname,
          get_configfile());
}

/*

# errors:
OPTIONS=aaaaaaaaaa[ more than 247 (255 - 8 for 'OPTIONS=') total ]aaaaaaaaaa
OPTIONS
OPTIONS=
MSGTYPE=stop"You swap places with "
MSGTYPE=st.op "You swap places with "
MSGTYPE=stop "You swap places with \"
MENUCOLOR=" blessed "green&none
MENUCOLOR=" holy " = green&reverse
MENUCOLOR=" cursed " = red&uline
MENUCOLOR=" unholy " = reed
OPTIONS=!legacy:true,fooo
OPTIONS=align:!pin
OPTIONS=gender

*/
/* most environment variables will eventually be printed in an error
 * message if they don't work, and most error message paths go through
 * BUFSZ buffers, which could be overflowed by a maliciously long
 * environment variable.  If a variable can legitimately be long, or
 * if it's put in a smaller buffer, the responsible code will have to
 * bounds-check itself.
 */
export function nh_getenv(ev) { /* char * */
    let getev = getenv(ev);

    if (getev && strlen(getev) <= Math.trunc(BUFSZ / 2))
        return getev;
    else
        return 0;
}

/* copy up to maxlen-1 characters; 'dest' must be able to hold maxlen;
   treat comma as alternate end of 'src' */
function nmcpy(dest, src, maxlen) { /* void */
    let count;

    for (count = 1; count < maxlen; count++) {
        if (chars[src] == ord(',') || chars[src] == ord('\0'))
            break; /*exit on \0 terminator*/
        chars[dest++] = chars[src++];
    }
    chars[dest] = ord('\0');
}

/*
 * escapes(): escape expansion for showsyms.  C-style escapes understood
 * include \n, \b, \t, \r, \xnnn (hex), \onnn (octal), \nnn (decimal).
 * (Note: unlike in C, leading digit 0 is not used to indicate octal;
 * the letter o (either upper or lower case) is used for that.
 * The ^-prefix for control characters is also understood, and \[mM]
 * has the effect of 'meta'-ing the value which follows (so that the
 * alternate character set will be enabled).
 *
 * X     normal key X
 * ^X    control-X
 * \mX   meta-X
 *
 * For 3.4.3 and earlier, input ending with "\M", backslash, or caret
 * prior to terminating '\0' would pull that '\0' into the output and then
 * keep processing past it, potentially overflowing the output buffer.
 * Now, trailing \ or ^ will act like \\ or \^ and add '\\' or '^' to the
 * output and stop there; trailing \M will fall through to \<other> and
 * yield 'M', then stop.  Any \X or \O followed by something other than
 * an appropriate digit will also fall through to \<other> and yield 'X'
 * or 'O', plus stop if the non-digit is end-of-string.
 */
function escapes(cp,
        tp) { /* void */ /* result is never longer than 'cp' */
    let oct = init_string(static_array("escapes.oct", char, sizeof_string("01234567")), _("01234567"), true), dec = init_string(static_array("escapes.dec", char, sizeof_string("0123456789")), _("0123456789"), true);
    /* hexdd[] is defined in decl.c */

    let dp;
    let cval, meta, dcount;

    while (chars[cp]) {
        /* \M has to be followed by something to do meta conversion,
           otherwise it will just be \M which ultimately yields 'M' */
        meta = (chars[cp] == ord('\\') && (chars[cp + 1] == ord('m') || chars[cp + 1] == ord('M')) && chars[cp + 2] ? 1 : 0);
        if (meta)
            cp += 2;

        cval = dcount = 0; /* for decimal, octal, hexadecimal cases */
        if ((chars[cp] != ord('\\') && chars[cp] != ord('^')) || !chars[cp + 1]) {
            /* simple character, or nothing left for \ or ^ to escape */
            cval = chars[cp++];
        } else if (chars[cp] == ord('^')) { /* expand control-character syntax */
            cval = (chars[++cp] & 0x1f);
            ++cp;

        /* remaining cases are all for backslash; we know cp[1] is not \0 */
        } else if (strchr(dec, chars[cp + 1])) {
            ++cp; /* move past backslash to first digit */
            do {
                cval = (cval * 10) + (chars[cp] - ord('0'));
            } while (chars[++cp] && strchr(dec, chars[cp]) && ++dcount < 3);
        } else if ((chars[cp + 1] == ord('o') || chars[cp + 1] == ord('O')) && chars[cp + 2]
                   && strchr(oct, chars[cp + 2])) {
            cp += 2; /* move past backslash and 'O' */
            do {
                cval = (cval * 8) + (chars[cp] - ord('0'));
            } while (chars[++cp] && strchr(oct, chars[cp]) && ++dcount < 3);
        } else if ((chars[cp + 1] == ord('x') || chars[cp + 1] == ord('X')) && chars[cp + 2]
                   && (dp = strchr(hexdd, chars[cp + 2])) != 0) {
            cp += 2; /* move past backslash and 'X' */
            do {
                cval = (cval * 16) + Math.trunc((dp - hexdd) / 2);
            } while (chars[++cp] && (dp = strchr(hexdd, chars[cp])) != 0 && ++dcount < 2);
        } else { /* C-style character escapes */
            switch (chars[++cp]) {
            case ord('\\'):
                cval = ord('\\');
                break;
            case ord('n'):
                cval = ord('\n');
                break;
            case ord('t'):
                cval = ord('\t');
                break;
            case ord('b'):
                cval = ord('\b');
                break;
            case ord('r'):
                cval = ord('\r');
                break;
            default:
                cval = chars[cp];
            }
            ++cp;
        }

        if (meta)
            cval |= 0x80;
        chars[tp++] = char(cval);
    }
    chars[tp] = ord('\0');
}

/* returns a one-byte character from the text; may change txt[];
   moved from cmd.c in order to get access to escapes() */
export function txt2key(txt) { /* uchar */
    const $frame = stack_frame(); try {
    let uc;
    let makemeta = FALSE;

    txt = trimspaces(txt);
    if (!chars[txt])
        return ord('\0');

    /* simple character */
    if (!chars[txt + 1])
        return uchar((chars[txt + 0]));

    /* a few special entries */
    if (!strcmp(txt, _("<enter>")))
        return ord('\n');
    if (!strcmp(txt, _("<space>")))
        return ord(' ');
    if (!strcmp(txt, _("<esc>")))
        return ord('\x1b');

    /* handle things like \b and \7 and \mX */
    if (chars[txt] == ord('\\')) {
        let tbuf = stack_array(char, QBUFSZ);

        if (strlen(txt) >= sizeof(array_of(char, QBUFSZ)))
            chars[txt + (sizeof(array_of(char, QBUFSZ)) - 1)] = ord('\0');
        escapes(txt, tbuf);
        return uchar(chars[tbuf]);
    }

    /* control and meta keys */
    if (highc(chars[txt]) == ord('M')) {
        /*
         * M <nothing>             return 'M'
         * M - <nothing>           return M-'-'
         * M <other><nothing>      return M-<other>
         * otherwise M is pending until after ^/C- processing.
         * Since trailing spaces are discarded, the only way to
         * specify M-' ' is via "160".
         */
        if (!chars[txt + 1])
            return uchar((chars[txt]));
        /* skip past 'M' or 'm' and maybe '-' */
        ++txt;
        if (chars[txt] == ord('-') && chars[txt + 1])
            ++txt;
        if (!chars[txt + 1])
            return uchar(M(uchar((chars[txt]))));
        makemeta = TRUE;
    }
    if (chars[txt] == ord('^') || highc(chars[txt]) == ord('C')) {
        /*
         * C <nothing>             return 'C' or M-'C'
         * C - <nothing>           return '-' or M-'-'
         * C [-] <other><nothing>  return C-<other> or M-C-<other>
         * C [-] ?                 return <rubout>
         * otherwise return C-<other> or M-C-<other>
         */
        uc = uchar((chars[txt]));
        if (!chars[txt + 1])
            return uchar(makemeta ? M(uc) : uc);
        ++txt;
        /* unlike M-x, lots of values of x are invalid for C-x;
           checking and rejecting them is not worthwhile; GIGO;
           we do accept "^-x" as synonym for "^x" or "C-x" */
        if (chars[txt] == ord('-') && chars[txt + 1])
            ++txt;
        /* and accept ^?, which gets used despite not being a control char */
        if (chars[txt] == ord('?'))
            return uchar((makemeta ? ord('\xff') : ord('\x7f'))); /* rubout/delete */
        uc = C(uchar((chars[txt])));
        return uchar(makemeta ? M(uc) : uc);
    }
    if (makemeta && chars[txt])
        return uchar(M(uchar((chars[txt]))));

    /* FIXME: should accept single-quote single-character single-quote
       and probably single-quote backslash octal-digits single-quote;
       if we do that, the M- and C- results should be pending until
       after, so that C-'X' becomes valid for ^X */

    /* ascii codes: must be three-digit decimal */
    if (chars[txt] >= ord('0') && chars[txt] <= ord('9')) {
        let key = 0;
        let i;

        for (i = 0; i < 3; i++) {
            if (chars[txt + i] < ord('0') || chars[txt + i] > ord('9'))
                return ord('\0');
            key = uchar(10 * key + chars[txt + i] - ord('0'));
        }
        return key;
    }

    return ord('\0');
    } finally { stack_pop($frame); }
}

/*
 **********************************
 *
 *   Options Initialization
 *
 **********************************
 */

/* process options, possibly including SYSCF */
export function initoptions() { /* void */
    /*
     * Most places that call initoptions_init()/initoptions() would
     * have the calls next to each other, so instead of adding
     * initoptions_init() everywhere, just add it where it's needed in
     * a non-adjacent place and call it here for all the other cases.
     */
    if (go.opt_phase != builtin_opt)
         initoptions_init();

/* someday there may be other SYSCF alternatives besides text file */

    /* If SYSCF_FILE is specified, it _must_ exist... */
    assure_syscf_file();
    config_error_init(TRUE, _(SYSCF_FILE), FALSE);

    /* ... and _must_ parse correctly. */
    go.opt_phase = syscf_opt;
    if (!read_config_file(_(SYSCF_FILE), set_in_sysconf)) {
        if (config_error_done() && !iflags.initoptions_noterminate)
            nh_terminate(EXIT_FAILURE);
    }
    config_error_done();
    /*
     * TODO [maybe]: parse the sysopt entries which are space-separated
     * lists of usernames into arrays with one name per element.
     */

    /* Carry out options that got deferred from early_options */
    if (gd.deferred_showpaths)
        do_deferred_showpaths(0);  /* does not return */

    initoptions_finish();
}

/* set up default values for options where 0 or False isn't sufficient */
export function initoptions_init() { /* void */
    let opts;

    let i;
    let have_branch = (nomakedefs.git_branch && chars[nomakedefs.git_branch] ? 1 : 0);

    go.opt_phase = builtin_opt;    /* Did I need to move this here? */
    /* initialize the function pointers for saving the game */
    sf_init();
    allopt_array_init();
    /* if windowtype has been specified on the command line, set it up
       early so windowtype-specific options use it as their base */
    if (gc.cmdline_windowsys) {
        nmcpy(gc.chosen_windowtype, gc.cmdline_windowsys, WINTYPELEN);
        config_error_init(FALSE, _("command line"), FALSE);
        choose_windows(gc.cmdline_windowsys);
        config_error_done();
        /*
         * FIXME?  This continues even if setting windowtype to player's
         * specified value fails.  It doesn't lock the windowtype in
         * that situation though, so the game will use whatever is in
         * RC/NETHACKOPTIONS or resort to DEFAULT_WINDOW_SYS.
         */
        if (windowprocs.name
            && !strcmpi(windowprocs.name, gc.cmdline_windowsys))
            /* ignore any windowtype:foo in RC file or NETHACKOPTIONS */
            iflags.windowtype_locked = TRUE;
        /* shouldn't need cmdline_windowsys beyond here */
        free(gc.cmdline_windowsys),
            gc.cmdline_windowsys = 0;
    }

    /* make any symbol parsing quicker */
    if (!glyphid_cache_status())
        fill_glyphid_cache();

    /* set up the command parsing */
    reset_commands(TRUE); /* init */

    /* initialize the random number generator(s) */
    init_random(rn2);
    init_random(rn2_on_display_rng);

    go.opt_phase = builtin_opt;
    for (i = 0; allopt[i].name; i++) {
        if (allopt[i].addr)
            chars[(allopt[i].addr)] = allopt[i].initval;
    }

    flags.end_own = FALSE;
    flags.end_top = 3;
    flags.end_around = 2;
    flags.paranoia_bits = PARANOID_PRAY | PARANOID_SWIM | PARANOID_TRAP;
    flags.versinfo = have_branch ? 4 : 1;
    flags.pile_limit = PILE_LIMIT_DFLT;  /* 5 */
    flags.runmode = RUN_LEAP;
    iflags.msg_history = 20;

    /* msg_window has conflicting defaults for multi-interface binary */

    iflags.prevmsg_window = ord('s');

    iflags.menu_headings.attr = ATR_INVERSE;
    iflags.menu_headings.color = NO_COLOR;
    iflags.getpos_coords = GPCOORDS_NONE;

    /* hero's role, race, &c haven't been chosen yet */
    flags.initrole = flags.initrace = flags.initgend = flags.initalign
        = ROLE_NONE;

    init_ov_primary_symbols();
    init_ov_rogue_symbols();
    /* Set the default monster and object class symbols. */
    init_symbols();
    for (i = 0; i < WARNCOUNT; i++)
        uchars[gw.warnsyms + i] = def_warnsyms[i].sym;

    /* assert( sizeof flags.inv_order == sizeof def_inv_order ); */
    memcpy(flags.inv_order,
                  def_inv_order, sizeof_member(flags, "inv_order"));
    chars[flags.pickup_types + 0] = ord('\0');
    flags.pickup_burden = MOD_ENCUMBER;
    flags.sortloot = ord('l'); /* sort only loot by default */

    for (i = 0; i < NUM_DISCLOSURE_OPTIONS; i++)
        chars[flags.end_disclose + i] = DISCLOSE_PROMPT_DEFAULT_NO;
    switch_symbols(FALSE); /* set default characters */
    init_rogue_symbols();

    /*
     * Set defaults for some options depending on what we can
     * detect about the environment's capabilities.
     * This has to be done after the global initialization above
     * and before reading user-specific initialization via
     * config file/environment variable below.
     */
    /* this detects the IBM-compatible console on most 386 boxes */
    if ((opts = nh_getenv(_("TERM"))) && !strncmp(opts, _("AT"), 2)) {
        if (!gs.symset[PRIMARYSET].explicitly)
            load_symset(_("IBMGraphics"), PRIMARYSET);
        if (!gs.symset[ROGUESET].explicitly)
            load_symset(_("RogueIBM"), ROGUESET);
        switch_symbols(TRUE);
        iflags.wc_color = TRUE;
    }

    /* detect whether a "vt" terminal can handle alternate charsets */
    if ((opts = nh_getenv(_("TERM")))
        /* [could also check "xterm" which emulates vtXXX by default] */
        && !strncmpi(opts, _("vt"), 2)
        && AS() && AE() && strchr(AS(), ord('\x0e')) && strchr(AE(), ord('\x0f'))) {
        if (!gs.symset[PRIMARYSET].explicitly)
            load_symset(_("DECGraphics"), PRIMARYSET);
        switch_symbols(TRUE);
    }

    flags.menu_style = MENU_FULL;

    iflags.wc_align_message = ALIGN_TOP;
    iflags.wc_align_status = ALIGN_BOTTOM;
    /* used by tty and curses */
    iflags.wc2_statuslines = 2;
    iflags.wc2_petattr = ATR_INVERSE;
    /* only used by curses */
    iflags.wc2_windowborders = 2; /* 'Auto' */

    /*
     * A few menus have certain items (typically operate-on-everything or
     * change-subset or sort or help entries) flagged as 'skip-invert' to
     * control how whole-page and whole-menu operations affect them.
     * 'menuinvertmode' controls how that functions:
     * 0: ignore 'skip-invert' flag on menu items (used to be the default);
     * 1: don't toggle 'skip-invert' items On for set-all/set-page/invert-
     *    all/invert-page but do toggle Off if already set (default);
     * 2: don't toggle 'skip-invert' items either On of Off for set-all/
     *    set-page/unset-all/unset-page/invert-all/invert-page.
     */
    iflags.menuinvertmode = 1;

    /* since this is done before init_objects(), do partial init here */
    objects[SLIME_MOLD].oc_name_idx = SLIME_MOLD;
    nmcpy(svp.pl_fruit, OBJ_NAME(objects[SLIME_MOLD]), PL_FSIZ);

/* someday there may be other SYSCF alternatives besides text file */

    /* If SYSCF_FILE is specified, it _must_ exist... */
    assure_syscf_file();
    config_error_init(TRUE, _(SYSCF_FILE), FALSE);

    /* ... and _must_ parse correctly. */
    go.opt_phase = syscf_opt;
    if (!read_config_file(_(SYSCF_FILE), set_in_sysconf)) {
        if (config_error_done() && !iflags.initoptions_noterminate)
            nh_terminate(EXIT_FAILURE);
    }
    config_error_done();
    /*
     * TODO [maybe]: parse the sysopt entries which are space-separated
     * lists of usernames into arrays with one name per element.
     */
}

/*
 *  Process user's run-time configuration file:
 *    get value of NETHACKOPTIONS;
 *    if command line specified -nethackrc=filename, use that;
 *      if NETHACKOPTIONS is present,
 *        honor it if it has a list of options to set
 *        or ignore it if it specifies a file name;
 *    else if not specified on command line and NETHACKOPTIONS names a file,
 *      use that as the config file;
 *      no extra options (normal use of NETHACKOPTIONS) will be set;
 *    otherwise (not on command line and either no NETHACKOPTIONS or that
 *        isn't a file name),
 *      pass Null to read_config_file() so that it will read ~/.nethackrc
 *        by default,
 *      then process the value of NETHACKOPTIONS as extra options.
 */
export function initoptions_finish() { /* void */
   let sym = 0;

    rcfile();

    fruitadd(svp.pl_fruit, null);
    /*
     * Remove "slime mold" from list of object names.  This will
     * prevent it from being wished unless it's actually present
     * as a named (or default) fruit.  Wishing for "fruit" will
     * result in the player's preferred fruit.  [Once upon a time
     * the override value used was "\033" which prevented wishing
     * for the slime mold object at all except by asking for a
     * specific named fruit.]  Note that there are multiple fruit
     * object types (apple, melon, &c) but the "fruit" object is
     * slime mold or whatever custom name player assigns to that.
     */
    obj_descr[SLIME_MOLD].oc_name = _("fruit");

    sym = get_othersym(SYM_BOULDER,
                Is_rogue_level(u.uz) ? ROGUESET : PRIMARYSET);
    if (sym)
        uchars[gs.showsyms + (SYM_BOULDER + SYM_OFF_X)] = sym;
    reglyph_darkroom();
    reset_glyphmap(gm_optionchange);

    /*
     * A multi-interface binary might only support status highlighting
     * for some of the interfaces; check whether we asked for it but are
     * using one which doesn't.
     *
     * Option processing can take place before a user-decided WindowPort
     * is even initialized, so check for that too.
     */
    if (iflags.hilite_delta && !wc2_supported(_("statushilites"))) {
        raw_printf(_("Status highlighting not supported for %s interface."),
                    windowprocs.name);
        iflags.hilite_delta = 0;
    }

    update_rest_on_space();

    /* these can't rely on compile-time initialization for their defaults
       because a multi-interface binary might need different values for
       different interfaces; if neither tiled_map nor ascii_map pass the
       wc_supported() test, assume ascii_map */
    if (iflags.wc_tiled_map && !wc_supported(_("tiled_map")))
        iflags.wc_tiled_map = FALSE, iflags.wc_ascii_map = TRUE;
    else if (iflags.wc_ascii_map && !wc_supported(_("ascii_map"))
             && wc_supported(_("tiled_map")))
        iflags.wc_ascii_map = FALSE, iflags.wc_tiled_map = TRUE;

    if (glyphid_cache_status())
        free_glyphid_cache();
    apply_customizations(unsigned(gc.currentgraphics),
                         do_custom_symbols | do_custom_colors);

    go.opt_initial = FALSE;
    return;
}

/* #if 0: not in this build */

export function allopt_array_init() { /* void */
    let i;
    let options_array_inited_already = static_var("allopt_array_init.options_array_inited_already", schar, FALSE);

    if (!options_array_inited_already[0]) {
        memcpy(addr_of(allopt[0]), addr_of(allopt_init[0]), sizeof(array_of(struct_allopt_t, SIZE(allopt_init))));
        determine_ambiguities();
        for (i = 0; allopt[i].name; i++) {
            if (allopt[i].addr)
                chars[(allopt[i].addr)] = allopt[i].initval;
        }
        heed_all_options();
        /*
         * Call each option function with an init flag and give it a chance
         * to make any preparations that it might require.  We do this
         * whether or not the option itself is ever specified; that's
         * irrelevant for the init call.  Doing this allows the prep code for
         * option settings to remain adjacent to, and in the same function as,
         * the code that processes those options.
         */
        for (i = 0; i < OPTCOUNT; ++i) {
            if (allopt[i].optfn)
                (allopt[i].optfn)(i, do_init, FALSE, empty_optstr,
                                   empty_optstr);
        }
        options_array_inited_already[0] = TRUE;
    }
}

/*
 *******************************************
 *
 * Support Functions for Individual Options
 *
 *******************************************
 */

/* iflags.menuobjsyms also controls iflags.menu_head_objsym, and
   iflags.use_menu_glyphs; they affect execution but are no longer options */
function set_menuobjsyms_flags(newobjsyms) { /* void */
    iflags.menuobjsyms = newobjsyms;
    iflags.menu_head_objsym = ((newobjsyms & 1) != 0) ? TRUE : FALSE;
    iflags.use_menu_glyphs = ((newobjsyms & (2 | 4)) != 0) ? TRUE : FALSE;
}

/*
 * Change the inventory order, using the given string as the new order.
 * Missing characters in the new order are filled in at the end from
 * the current inv_order, except for gold, which is forced to be first
 * if not explicitly present.
 *
 * This routine returns 1 unless there is a duplicate or bad char in
 * the string.
 *
 * Used by: optfn_packorder()
 *
 */
function change_inv_order(op) { /* int */
    const $frame = stack_frame(); try {
    let oc_sym, num;
    let sp, buf = stack_array(char, QBUFSZ);
    let retval = 1;

    num = 0;
    if (!strchr(op, GOLD_SYM))
        chars[buf + (num++)] = COIN_CLASS;

    for (sp = op; chars[sp]; sp++) {
        let fail = FALSE;
        oc_sym = def_char_to_objclass(chars[sp]);
        /* reject bad or duplicate entries */
        if (oc_sym == MAXOCLASSES) { /* not an object class char */
            config_error_add(_("Not an object class '%c'"), chars[sp]);
            retval = 0;
            fail = TRUE;
        } else if (!strchr(flags.inv_order, oc_sym)) {
            /* VENOM_CLASS, RANDOM_CLASS, and ILLOBJ_CLASS are excluded
               because they aren't in def_inv_order[] so don't make it
               into flags.inv_order, hence always fail this strchr() test */
            config_error_add(_("Object class '%c' not allowed"), chars[sp]);
            retval = 0;
            fail = TRUE;
        } else if (strchr(sp + 1, chars[sp])) {
            config_error_add(_("Duplicate object class '%c'"), chars[sp]);
            retval = 0;
            fail = TRUE;
        }
        /* retain good ones */
        if (!fail)
            chars[buf + (num++)] = char(oc_sym);
    }
    chars[buf + num] = ord('\0');

    /* fill in any omitted classes, using previous ordering */
    for (sp = flags.inv_order; chars[sp]; sp++)
        if (!strchr(buf, chars[sp]))
            strkitten(buf + (num++), chars[sp]);
    chars[buf + (MAXOCLASSES - 1)] = ord('\0');

    strcpy(flags.inv_order, buf);
    return retval;
    } finally { stack_pop($frame); }
}

/*
 * Support functions for "warning"
 *
 * Used by: optfn_warnings()
 *
 */

function warning_opts(opts, optype) { /* boolean */
    const $frame = stack_frame(); try {
    let translate = stack_array(uchar, WARNCOUNT);
    let length, i;

    if ((opts = string_for_env_opt(optype, opts, FALSE)) == empty_optstr)
        return FALSE;
    escapes(opts, opts);

    length = int(strlen(opts));
    /* match the form obtained from PC configuration files */
    for (i = 0; i < WARNCOUNT; i++)
        uchars[translate + i] = (i >= length) ? 0
                                     : chars[opts + i] ? uchar((chars[opts + i]))
                                               : def_warnsyms[i].sym;
    assign_warnings(translate);
    return TRUE;
    } finally { stack_pop($frame); }
}

export function assign_warnings(graph_chars) { /* void */
    let i;

    for (i = 0; i < WARNCOUNT; i++)
        if (uchars[graph_chars + i])
            uchars[gw.warnsyms + i] = uchars[graph_chars + i];
}

/*
 * Support functions for "suppress_alert"
 *
 * Used by: optfn_suppress_alert()
 *
 */

function feature_alert_opts(op, optn) { /* int */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);
    let fnv = get_feature_notice_ver(op); /* version.c */

    if (fnv == 0)
        return 0;
    if (fnv > get_current_feature_ver()) {
        if (!go.opt_initial) {
            You_cant(_("disable new feature alerts for future versions."));
        } else {
            config_error_add(
                        _("%s=%s Invalid reference to a future version ignored"),
                             optn, op);
        }
        return 0;
    }

    flags.suppress_alert = fnv;
    if (!go.opt_initial) {
        sprintf(buf, _("%llu.%llu.%llu"), FEATURE_NOTICE_VER_MAJ(), FEATURE_NOTICE_VER_MIN(), FEATURE_NOTICE_VER_PATCH())
;
        pline(
          _("Feature change alerts disabled for NetHack %s features and prior."),
              buf);
    }
    return 1;
    } finally { stack_pop($frame); }
}

/*
 * This is used by parse_config_line() in files.c
 *
 */

/* parse key:command[,key2:command2,...] after BINDINGS= prefix has been
   stripped; returns False if any problem seen, True if every binding in
   the comma-separated list is successful */
export function parsebindings(bindings) { /* boolean */
    let bind;
    let key;
    let i;
    let ret = TRUE; /* assume success */
    let mousebtn_names = static_array("parsebindings.mousebtn_names", ptr_to(char), NUM_MOUSE_BUTTONS, [
        _("mouse1"), _("mouse2")
    ]);

    /* look for first comma, then decide whether it is the key being bound
       or a list element separator; if it's a key, find separator beyond it */
    if ((bind = strchr(bindings, ord(','))) != 0) {
        /* at start so it represents a key */
        if (bind == bindings)
            bind = strchr(bind + 1, ord(','));

        /* to get here, bind is non-Null and not equal to bindings,
           so it is greater than bindings and bind[-1] is valid; check
           whether current comma happens to be for "\,:cmd" or "',':cmd"
           (":cmd" part is assumed if the comma has expected quoting) */
        else if (chars[bind + (-1)] == ord('\\') || (chars[bind + (-1)] == ord('\'') && chars[bind + 1] == ord('\'')))
            bind = strchr(bind + 2, ord(','));
    }
    /* if a comma separator has been found, break off first binding from rest;
       parse the rest and then handle this first one when recursion returns */
    if (bind) {
        chars[bind++] = ord('\0');
        if (!parsebindings(bind))
            ret = FALSE;
    }

    /* parse a single binding: first split around : */
    if (! (bind = strchr(bindings, ord(':'))))
        return FALSE; /* it's not a binding */
    chars[bind++] = 0;

    bind = trimspaces(bind);

    for (i = 0; i < SIZE(mousebtn_names); i++)
        if (!strcmp(bindings, mousebtn_names[i])) {
            if (!bind_mousebtn(i + 1, bind)) {
                config_error_add(_("Error binding mouse button %i"), i + 1);
            } else {
                return ret;
            }
        }

    /* read the key to be bound */
    key = txt2key(bindings);
    if (!key) {
        config_error_add(_("Unknown key binding key '%s'"), bindings);
        return FALSE;
    }

    /* is it a special key? */
    if (bind_specialkey(key, bind))
        return ret;

    /* is it a menu command? */
    for (i = 0; default_menu_cmd_info[i].name; i++) {
        if (!strcmp(default_menu_cmd_info[i].name, bind)) {
            if (illegal_menu_cmd_key(key)) {
                config_error_add(_("Bad menu key %s:%s"), visctrl(char(key)), bind);
                return FALSE;
            } else {
                add_menu_cmd_alias(char(key), default_menu_cmd_info[i].cmd);
            }
            return ret;
        }
    }

    /* extended command? */
    if (!bind_key(key, bind, TRUE)) {
        config_error_add(_("Unknown key binding command '%s'"), bind);
        return FALSE;
    }
    return ret;
}

  const struct___anon1 = struct("options.struct___anon1", {
    name: ptr_to(char),
    msgtyp: xint8,
    descr: ptr_to(char),
}); const msgtype_names = static_array("msgtype_names", struct___anon1, null, [
    { name: _("show"), msgtyp: MSGTYP_NORMAL, descr: _("Show message normally") },
    { name: _("hide"), msgtyp: MSGTYP_NOSHOW, descr: _("Hide message") },
    { name: _("noshow"), msgtyp: MSGTYP_NOSHOW, descr: 0 },
    { name: _("stop"), msgtyp: MSGTYP_STOP, descr: _("Prompt for more after the message") },
    { name: _("more"), msgtyp: MSGTYP_STOP, descr: 0 },
    { name: _("norep"), msgtyp: MSGTYP_NOREP, descr: _("Do not repeat the message") }
]);

function msgtype2name(typ) { /* const char * */
    let i;

    for (i = 0; i < SIZE(msgtype_names); i++)
        if (msgtype_names[i].descr && msgtype_names[i].msgtyp == typ)
            return msgtype_names[i].name;
    return 0;
}

function query_msgtype() { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let i, pick_cnt;
    let picks = stack_var(ptr_to(struct_mi), null);
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    for (i = 0; i < SIZE(msgtype_names); i++)
        if (msgtype_names[i].descr) {
            any.a_int = msgtype_names[i].msgtyp + 1;
            add_menu(tmpwin, nul_glyphinfo, any, 0, 0,
                     ATR_NONE, clr,
                     msgtype_names[i].descr, MENU_ITEMFLAGS_NONE);
        }
    end_menu()(tmpwin, _("How to show the message"));
    pick_cnt = select_menu(tmpwin, PICK_ONE, picks);
    destroy_nhwindow()(tmpwin);
    if (pick_cnt > 0) {
        i = picks[0].item.a_int - 1;
        free(addr_of(picks[0]));
        return i;
    }
    return -1;
    } finally { stack_pop($frame); }
}

function msgtype_add(typ, pattern) { /* boolean */
    const $frame = stack_frame(); try {
    let re_error = static_var("msgtype_add.re_error", ptr_to(char), _("MSGTYPE regex error"));
    let tmp = view_of(struct_plinemsg_type, addr_of(alloc(sizeof(struct_plinemsg_type))));

    tmp.msgtype = typ;
    tmp.regex = regex_init();
    /* test_regex_pattern() has already validated this regexp but parsing
       it again could conceivably run out of memory */
    if (!regex_compile(pattern, tmp.regex)) {
        let errbuf = stack_array(char, BUFSZ);
        let re_error_desc = regex_error_desc(tmp.regex, errbuf);

        /* free first in case reason for failure was insufficient memory */
        regex_free(tmp.regex);
        free(addr_of(tmp));
        config_error_add(_("%s: %s"), re_error[0], re_error_desc);
        return FALSE;
    }
    tmp.pattern = dupstr(pattern);
    tmp.next = gp.plinemsg_types;
    gp.plinemsg_types = tmp;
    return TRUE;
    } finally { stack_pop($frame); }
}

export function msgtype_free() { /* void */
    let tmp, tmp2 = null;

    for (tmp = gp.plinemsg_types; tmp; tmp = tmp2) {
        tmp2 = tmp.next;
        free(tmp.pattern);
        regex_free(tmp.regex);
        tmp.regex = null;
        free(addr_of(tmp));
    }
    gp.plinemsg_types = null;
}

function free_one_msgtype(idx) { /* void */ /* 0 .. */
    let tmp = gp.plinemsg_types;
    let prev = null;

    while (tmp) {
        if (idx == 0) {
            let next = tmp.next;

            regex_free(tmp.regex);
            free(tmp.pattern);
            free(addr_of(tmp));
            if (prev)
                prev.next = next;
            else
                gp.plinemsg_types = next;
            return;
        }
        idx--;
        prev = tmp;
        tmp = tmp.next;
    }
}

export function msgtype_type(msg,
             norepeat) { /* int */ /* called from Norep(via pline) */
    let tmp = gp.plinemsg_types;

    while (tmp) {
        /* we don't exclude entries with negative msgtype values
           because then the msg might end up matching a later pattern */
        if (regex_match(msg, tmp.regex))
            return tmp.msgtype;
        tmp = tmp.next;
    }
    return norepeat ? MSGTYP_NOREP : MSGTYP_NORMAL;
}

/* negate one or more types of messages so that their type handling will
   be disabled or re-enabled; MSGTYPE_NORMAL (value 0) is not affected */
export function hide_unhide_msgtypes(hide, hide_mask) { /* void */
    let tmp;
    let mt;

    /* negative msgtype value won't be recognized by pline, so does nothing */
    for (tmp = gp.plinemsg_types; tmp; tmp = tmp.next) {
        mt = tmp.msgtype;
        if (!hide)
            mt = -mt; /* unhide: negate negative, yielding positive */
        if (mt > 0 && ((1 << mt) & hide_mask))
            tmp.msgtype = -tmp.msgtype;
    }
}

function msgtype_count() { /* int */
    let c = 0;
    let tmp = gp.plinemsg_types;

    while (tmp) {
        c++;
        tmp = tmp.next;
    }
    return c;
}

export function msgtype_parse_add(str) { /* boolean */
    const $frame = stack_frame(); try {
    let pattern = stack_array(char, 256);
    let msgtype = stack_array(char, 11);

    if (sscanf(str, _("%10s \"%255[^\"]\""), msgtype, pattern) == 2) {
        let typ = -1;
        let i;

        for (i = 0; i < SIZE(msgtype_names); i++)
            if (str_start_is(msgtype_names[i].name, msgtype, TRUE)) {
                typ = msgtype_names[i].msgtyp;
                break;
            }
        if (typ != -1)
            return msgtype_add(typ, pattern);
        else
            config_error_add(_("Unknown message type '%s'"), msgtype);
    } else {
        config_error_add(_("Malformed MSGTYPE"));
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

/* parse 'str' as a regular expression to check whether it's valid;
   compiled regexp gets thrown away regardless of the outcome */
function test_regex_pattern(str, errmsg) { /* boolean */
    const $frame = stack_frame(); try {
    let def_errmsg = init_string(static_array("test_regex_pattern.def_errmsg", char, sizeof_string("NHregex error")), _("NHregex error"), true);
    let match;
    let re_error_desc, errbuf = stack_array(char, BUFSZ);
    let retval;

    if (!str)
        return FALSE;
    if (!errmsg)
        errmsg = def_errmsg;

    match = regex_init();
    if (!match) {
        config_error_add(_("%s"), errmsg);
        return FALSE;
    }

    retval = regex_compile(str, match);
    /* get potential error message before freeing regexp and free regexp
       before issuing message in case the error is "ran out of memory"
       since message delivery might need to allocate some memory */
    re_error_desc = !retval ? regex_error_desc(match, errbuf) : 0;
    /* discard regexp; caller will re-parse it after validating other stuff */
    regex_free(match);
    /* if returning failure, tell player */
    if (!retval)
        config_error_add(_("%s: %s"), errmsg, re_error_desc);

    return retval;
    } finally { stack_pop($frame); }
}

/* parse 'role' or 'race' or 'gender' or 'alignment' */
function parse_role_opt(
    optidx,
    negated,
    fullname,
    opts,
    opp) { /* boolean */
    const $frame = stack_frame(); try {
    let neg_opt = init_string(static_array("parse_role_opt.neg_opt", char, sizeof_string("!")), _("!"), true); /* not 'const' but never modified */
    let preval, op;
    let which = (optidx == opt_role) ? RS_ROLE
                : (optidx == opt_race) ? RS_RACE
                  : (optidx == opt_gender) ? RS_GENDER
                    : (optidx == opt_alignment) ? RS_ALGNMNT
                      : RS_filter; /* none of the above */
    let ok = FALSE;

    /*
     * Accepts multiple forms
     *  role:priest       -- play as priest
     *  race:!orc         -- any race other than orc
     *  role:!cav !mon    -- any role other than caveman/cavewoman or monk
     *  !role:tour        -- any role other than tourist
     *  !role:tou rog wiz -- any role other than tourist or rogue or wizard
     * TODO: add support for
     *  role:arc bar kni  -- only role archeologist or barbarian or knight
     * Rejected:
     *  role:sam !val     -+ invalid; need either positive or negative subset
     *  !role:!sam        +- not a mixture of the two and not dual negation.
     */
    if ((op = string_for_env_opt(fullname, opts, FALSE)) != empty_optstr) {
        let sp;
        let val_negated, prev_negated = FALSE, first = TRUE;

        mungspaces(op);
        while (chars[op]) {
            if (chars[op] == ord(' '))
                ++op;
            val_negated = FALSE;
            while (chars[op] == ord('!') || !strncmpi(op, _("no"), 2)) {
                val_negated = +!val_negated;
                op += (chars[op] == ord('!')) ? 1 : (chars[op + 2] != ord('-')) ? 2 : 3;
            }
            if (!chars[op] || chars[op] == ord(' ')) {
                config_error_add(_("Negated nothing for '%s'"), fullname);
                return FALSE;
            }
            if (!first) {
                if ((val_negated ^ prev_negated)
                    || (negated && val_negated)) {
                    config_error_add(_("Invalid mixed negation for '%s%s'"),
                                     negated ? _("!") : _(""), fullname);
                    return FALSE;
                } else if (!negated && !val_negated) {
                    config_error_add(
                    _("Multiple role values only allowed when list is negated"));
                    return FALSE;
                }
            }
            first = FALSE;
            prev_negated = val_negated;

            /* hide rest of list, if any */
            sp = strchr(op, ord(' '));
            if (sp)
                chars[sp] = ord('\0');

            preval = getoptstr(optidx, int(go.opt_phase));
            if (val_negated || negated) {
                let negbuf = stack_array(char, BUFSZ);

                /* for negative value, clear filter if there is a prior
                   value from a different phase; for same phase, duplicates
                   are allowed and setrolefilter() merges them */
                if (!preval || chars[preval] != ord('!'))
                    clearrolefilter(which);
                if (!setrolefilter(op)) {
                    config_error_add(_("Invalid %s '%s'"), fullname, op);
                    return FALSE;
                }
                saveoptstr(optidx, rolefilterstring(negbuf, which));
                opp[0] = neg_opt;
            } else {
                /* for positive value, allow duplicate if prior value
                   was a negative one or came from a different phase;
                   reject if prior value was positive and from same phase */
                if (duplicate[0]) {
                    if (preval && chars[preval] == ord('!')) {
                        complain_about_duplicate(optidx);
                        return FALSE;
                    }
                }
                /* save raw string value; caller will validate it and
                   if it's ok, replace it with canonical form */
                saveoptstr(optidx, op);
                opp[0] = op;
                /*ok = TRUE; // redundant*/
                /* don't return yet; value might be a list that follows
                   this with something else which might make it invalid */
            }

            if (sp) {
                chars[sp] = ord(' ');
                op = sp + 1;
            } else {
                op += strlen(op); /* break; */
            }
        }
        /* '!ok' without config_error_add() implies a valid negation */
        ok = TRUE;
    }
    return ok;
    } finally { stack_pop($frame); }
}

/* fetch a saved role|race|gender|alignment value suitable for writing into
   a new run-time config file */
function get_cnf_role_opt(optidx) { /* char * */
    let phase;
    let op = 0;

    for (phase = num_opt_phases - 1; phase >= 0 && !op; --phase) {
        if (phase == cmdline_opt || phase == environ_opt
            || phase == builtin_opt)
            continue;
        op = getoptstr(optidx, phase);
    }
    return op;
}

/* Check if character c is illegal as a menu command key */
function illegal_menu_cmd_key(c) { /* boolean */
    if (c == 0 || c == ord('\r') || c == ord('\n') || c == ord('\x1b') || c == ord(' ')
        || digit(char(c)) || (letter(char(c)) && c != ord('@'))) {
        config_error_add(_("Reserved menu command key '%s'"), visctrl(char(c)));
        return TRUE;
    } else { /* reject default object class symbols */
        let j;

        for (j = 1; j < MAXOCLASSES; j++)
            if (c == uchar((def_oc_syms[j].sym))) {
                config_error_add(_("Menu command key '%s' is an object class"),
                                 visctrl(char(c)));
                return TRUE;
            }
    }
    return FALSE;
}

/*
 * Convert the given string of object classes to a string of default object
 * symbols.
 */
export function oc_to_str(src, dest) { /* void */
    let i;

    while ((i = (chars[src++])) != 0) {
        if (i < 0 || i >= MAXOCLASSES)
            impossible(_("oc_to_str:  illegal object class %d"), i);
        else
            chars[dest++] = def_oc_syms[i].sym;
    }
    chars[dest] = ord('\0');
}

/*
 * Add the given mapping to the menu command map list.  Always keep the
 * maps valid C strings.
 */
export function add_menu_cmd_alias(from_ch, to_ch) { /* void */
    if (gn.n_menu_mapped >= MAX_MENU_MAPPED_CMDS) {
        pline(_("out of menu map space."));
    } else {
        chars[gm.mapped_menu_cmds + gn.n_menu_mapped] = from_ch;
        chars[gm.mapped_menu_op + gn.n_menu_mapped] = to_ch;
        gn.n_menu_mapped++;
        chars[gm.mapped_menu_cmds + gn.n_menu_mapped] = ord('\0');
        chars[gm.mapped_menu_op + gn.n_menu_mapped] = ord('\0');
    }
}

export function get_menu_cmd_key(ch) { /* char */
    let found = strchr(gm.mapped_menu_op, ch);

    if (found) {
        let idx = (found - gm.mapped_menu_op);

        ch = chars[gm.mapped_menu_cmds + idx];
    }
    return ch;
}

/*
 * Map the given character to its corresponding menu command.  If it
 * doesn't match anything, just return the original.
 */
export function map_menu_cmd(ch) { /* char */
    let found = strchr(gm.mapped_menu_cmds, ch);

    if (found) {
        let idx = (found - gm.mapped_menu_cmds);

        ch = chars[gm.mapped_menu_op + idx];
    }
    return ch;
}

/* get keystrokes that are used for menu scrolling operations which apply;
   printable: for use in a prompt, non-printable: for yn_function() choices */
export function collect_menu_keys(
    outbuf,
    scrollmask,

    printable) { /* char * */ /* False: output is string of raw characters, * True: output is a string of visctrl() sequences; * matters iff user has mapped any menu scrolling * commands to control or meta characters */
    const struct_menuscrollinfo = struct("collect_menu_keys.struct_menuscrollinfo", {
        cmdkey: char,
        maskindx: uchar,
    });
    let scroll_keys = static_array("collect_menu_keys.scroll_keys", struct_menuscrollinfo, null, [
        { cmdkey: MENU_FIRST_PAGE,    maskindx: 1 },
        { cmdkey: MENU_PREVIOUS_PAGE, maskindx: 1 },
        { cmdkey: MENU_NEXT_PAGE,     maskindx: 2 },
        { cmdkey: MENU_LAST_PAGE,     maskindx: 2 },
        { cmdkey: MENU_SHIFT_LEFT,    maskindx: 4 },
        { cmdkey: MENU_SHIFT_RIGHT,   maskindx: 8 },
    ]);
    let i;

    chars[outbuf + 0] = ord('\0');
    for (i = 0; i < SIZE(scroll_keys); ++i) {
        if (scrollmask & scroll_keys[i].maskindx) {
            let c = get_menu_cmd_key(scroll_keys[i].cmdkey);

            if (printable)
                strcat(outbuf, visctrl(c));
            else
                strkitten(outbuf, c);
        }
    }
    return outbuf;
}

/* Returns the fid of the fruit type; if that type already exists, it
 * returns the fid of that one; if it does not exist, it adds a new fruit
 * type to the chain and returns the new one.
 * If replace_fruit is sent in, replace the fruit in the chain rather than
 * adding a new entry--for user specified fruits only.
 */
export function fruitadd(str, replace_fruit) { /* int */
    const $frame = stack_frame(); try {
    var i;
    var f;
    var highest_fruit_id = stack_var(int, 0), globpfx;
    var buf = stack_array(char, PL_FSIZ), altname = stack_array(char, PL_FSIZ);
    var user_specified = +(str == svp.pl_fruit);
    /* if not user-specified, then it's a fruit name for a fruit on
     * a bones level or from orctown raider's loot...
     */

    /* Note: every fruit has an id (kept in obj->spe) of at least 1;
     * 0 is an error.
     */
    nonew: { if (user_specified) {
        var found = FALSE, numeric = FALSE;

        /* force fruit to be singular; this handling is not
           needed--or wanted--for fruits from bones because
           they already received it in their original game;
           str==pl_fruit but makesingular() creates a copy
           so we need to copy that back into pl_fruit */
        nmcpy(svp.pl_fruit, makesingular(str), PL_FSIZ);

        /* disallow naming after other foods (since it'd be impossible
         * to tell the difference); globs might have a size prefix which
         * needs to be skipped in order to match the object type name
         */
        globpfx = (!strncmp(svp.pl_fruit, _("small "), 6)
                   || !strncmp(svp.pl_fruit, _("large "), 6)) ? 6
                  : (!strncmp(svp.pl_fruit, _("medium "), 7)) ? 7
                    : (!strncmp(svp.pl_fruit, _("very large "), 11)) ? 11
                      : 0;
        for (i = svb.bases[FOOD_CLASS]; objects[i].oc_class == FOOD_CLASS;
             i++) {
            if (!strcmp(OBJ_NAME(objects[i]), svp.pl_fruit)
                || (globpfx > 0 && !strcmp(OBJ_NAME(objects[i]),
                                           svp.pl_fruit + globpfx))) {
                found = TRUE;
                break;
            }
        }
        if (!found) {
            var c;

            for (c = svp.pl_fruit; chars[c] >= ord('0') && chars[c] <= ord('9'); c++)
                continue;
            if (!chars[c] || __isspace(uchar((chars[c]))))
                numeric = TRUE;
        }
        if (found || numeric
            /* these checks for applying food attributes to actual items
               are case sensitive; "glob of foo" is caught by 'found'
               if 'foo' is a valid glob; when not valid, allow it as-is */
            || !strncmp(svp.pl_fruit, _("cursed "), 7)
            || !strncmp(svp.pl_fruit, _("uncursed "), 9)
            || !strncmp(svp.pl_fruit, _("blessed "), 8)
            || !strncmp(svp.pl_fruit, _("partly eaten "), 13)
            || (!strncmp(svp.pl_fruit, _("tin of "), 7)
                && (!strcmp(svp.pl_fruit + 7, _("spinach"))
                    || (((name_to_mon(svp.pl_fruit + 7, null)) >= LOW_PM) && ((name_to_mon(svp.pl_fruit + 7, null)) < NUMMONS))))
            || !strcmp(svp.pl_fruit, _("empty tin"))
            || (!strcmp(svp.pl_fruit, _("glob"))
                || (globpfx > 0 && !strcmp(_("glob"), svp.pl_fruit + globpfx)))
            || ((str_end_is(svp.pl_fruit, _(" corpse"))
                 || str_end_is(svp.pl_fruit, _(" egg")))
                && (((name_to_mon(svp.pl_fruit, null)) >= LOW_PM) && ((name_to_mon(svp.pl_fruit, null)) < NUMMONS)))) {
            strcpy(buf, svp.pl_fruit);
            strcpy(svp.pl_fruit, _("candied "));
            nmcpy(svp.pl_fruit + 8, buf, PL_FSIZ - 8);
        }
        chars[altname] = ord('\0');
        /* This flag indicates that a fruit has been made since the
         * last time the user set the fruit.  If it hasn't, we can
         * safely overwrite the current fruit, preventing the user from
         * setting many fruits in a row and overflowing.
         * Possible expansion: check for specific fruit IDs, not for
         * any fruit.
         */
        flags.made_fruit = FALSE;
        if (replace_fruit) {
            /* replace_fruit is already part of the fruit chain;
               update it in place rather than looking it up again */
            f = replace_fruit;
            copynchars(f.fname, svp.pl_fruit, PL_FSIZ - 1);
            break nonew;
        }
    } else {
        /* not user_supplied, so assumed to be from bones (or orc gang) */
        copynchars(altname, str, PL_FSIZ - 1);
        sanitize_name(altname);
        flags.made_fruit = TRUE; /* for safety.  Any fruit name added from a
                                  * bones level should exist anyway. */
    }
    f = fruit_from_name(chars[altname] ? altname : str, FALSE, highest_fruit_id);
    if (f)
        break nonew;;

    /* Maximum number of named fruits is 127, even if obj->spe can
       handle bigger values.  If adding another fruit would overflow,
       use a random fruit instead... we've got a lot to choose from.
       current_fruit remains as is. */
    if (highest_fruit_id[0] >= 127)
        return rnd(127);

    f = newfruit();
    memset(addr_of(f), 0, sizeof(struct_fruit));
    copynchars(f.fname, chars[altname] ? altname : str, PL_FSIZ - 1);
    f.fid = ++highest_fruit_id[0];
    /* we used to go out of our way to add it at the end of the list,
       but the order is arbitrary so use simpler insertion at start */
    f.nextf = gf.ffruit;
    gf.ffruit = f;
 }
    if (user_specified)
        svc.context.current_fruit = f.fid;
    return f.fid;
    } finally { stack_pop($frame); }
}

/*
 **********************************
 *
 * Option-setting, menus,
 *  displaying option values
 *
 **********************************
 */

   /* RESTORE is after show_menucontrols() */

function optfn_o_autopickup_exceptions(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
    }
    if (req == get_val || req == get_cnf_val) {
        if (!opts)
            return optn_err;
        sprintf(opts, n_currently_set, count_apes());
        return optn_ok;
    }
    if (req == do_handler) {
        return handler_autopickup_exception();
    }
    return optn_ok;
}

function optfn_o_bind_keys(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
    }
    if (req == get_val || req == get_cnf_val) {
        if (!opts)
            return optn_err;
        sprintf(opts, n_currently_set, count_bind_keys());
        return optn_ok;
    }
    if (req == do_handler) {
        handler_rebind_keys();
    }
    return optn_ok;
}

function optfn_o_autocomplete(
    optidx, req, negated,
    opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
    }
    if (req == get_val || req == get_cnf_val) {
        if (!opts)
            return optn_err;
        sprintf(opts, n_currently_set, count_autocompletions());
        return optn_ok;
    }
    if (req == do_handler) {
        handler_change_autocompletions();
    }
    return optn_ok;
}

function optfn_o_menu_colors(optidx, req, negated,
              opts, op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
    }
    if (req == get_val || req == get_cnf_val) {
        if (!opts)
            return optn_err;
        sprintf(opts, n_currently_set, count_menucolors());
        return optn_ok;
    }
    if (req == do_handler) {
        return handler_menu_colors();
    }
    return optn_ok;
}

function optfn_o_message_types(
    optidx,
    req,
    negated,
    opts,
    op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
    }
    if (req == get_val || req == get_cnf_val) {
        if (!opts)
            return optn_err;
        sprintf(opts, n_currently_set, msgtype_count());
        return optn_ok;
    }
    if (req == do_handler) {
        return handler_msgtype();
    }
    return optn_ok;
}

function optfn_o_status_cond(
    optidx,
    req,
    negated,
    opts,
    op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
        ; /* setting status condition options goes through pfxfn_cond_() */
    }
    if (req == get_val) {
        if (!opts) /* opts[] is used as an output argument */
            return optn_err;
        sprintf(opts, n_currently_set, count_cond());
        return optn_ok;
    }
    if (req == get_cnf_val) {
        ; /* handled inline by all_options_strbuf() via all_options_conds() */
    }
    if (req == do_handler) {
        if (cond_menu())
            chars[opt_set_in_config + pfx_cond_] = TRUE;
        return optn_ok;
    }
    return optn_ok;
}

function optfn_o_status_hilites(
    optidx,
    req,
    negated,
    opts,
    op) { /* int */
    if (req == do_init) {
        return optn_ok;
    }
    if (req == do_set) {
    }
    if (req == get_val || req == get_cnf_val) {
        if (!opts)
            return optn_err;
        sprintf(opts, n_currently_set, count_status_hilites());
        return optn_ok;
    }
    if (req == do_handler) {
        if (!status_hilite_menu()) {
            return optn_err; /*pline("Bad status hilite(s) specified.");*/
        } else {
            if (wc2_supported(_("hilite_status")))
                preference_update()(_("hilite_status"));
        }
        return optn_ok;
    }
    return optn_ok;
}

/* Get string value of configuration option.
 * Currently handles only boolean and compound options.
 */
export function get_option_value(optname, cnfvalid) { /* char * */
    let retbuf = static_array("get_option_value.retbuf", char, BUFSZ);
    let bool_p;
    let i;

    for (i = 0; allopt[i].name != 0; i++)
        if (!strcmp(optname, allopt[i].name)) {
            if (allopt[i].opttyp == BoolOpt
                && (bool_p = allopt[i].addr) != 0) {
                sprintf(retbuf, _("%s"), chars[bool_p] ? _("true") : _("false"));
                return retbuf;
            } else if (allopt[i].opttyp == CompOpt && allopt[i].optfn) {
                let reslt = optn_err;

                reslt = (allopt[i].optfn)(allopt[i].idx,
                                           cnfvalid ? get_cnf_val : get_val,
                                           FALSE, retbuf, empty_optstr);
                if (reslt == optn_ok && chars[retbuf + 0])
                    return retbuf;
                return 0;
            }
        }
    return 0;
}

function longest_option_name(startpass, endpass) { /* unsigned int */
    /* spin through the options to find the longest name */
    let longest_name_len = 0;
    let i, pass, optflags;
    let name;

    for (pass = 0; pass < 2; pass++)
        for (i = 0; (name = allopt[i].name) != 0; i++) {
            if (pass == 0
                && (allopt[i].opttyp != BoolOpt || !allopt[i].addr))
                continue;
            optflags = int(allopt[i].setwhere);
            if (optflags < startpass || optflags > endpass)
                continue;
            if ((is_wc_option(name) && !wc_supported(name))
                || (is_wc2_option(name) && !wc2_supported(name)))
                continue;

            let len = Strlen(name);
            if (len > longest_name_len)
                longest_name_len = len;
        }
    return longest_name_len;
}

/* guts of doset_simple(); called repeatedly until no choice is made */
function doset_simple_menu() { /* int */
    const $frame = stack_frame(); try {
    /* unlike doset()'s fmtstr, there is no leading %s for indentation */
    var fmtstr_tab_doset_simple = init_string(static_array("doset_simple_menu.fmtstr_tab_doset_simple", char, sizeof_string("%s\t[%s]")), _("%s\t[%s]"), true);
    var fmtstr_doset_simple = stack_array(char, sizeof_string("%-15s [%s]   "));
    var pick_list = stack_var(ptr_to(struct_mi));
    var bool_p;
    var name, fmtstr;
    var buf = stack_array(char, BUFSZ), buf2 = stack_array(char, BUFSZ), abuf = stack_array(char, BUFSZ);
    var tmpwin;
    var any = stack_struct(struct_any);
    var section;
    var i, k, pick_cnt, reslt;
    var toggled_help = FALSE;

    /* we do this each time we're called instead of once in doset_simple()
       in case 'menu_tab_sep' ever gets included in the simple menu so
       becomes subject to being changed while doset_simple() is running */
    if (!iflags.menu_tab_sep)
        sprintf(fmtstr_doset_simple, _("%%-%us [%%s]"), longest_option_name(set_gameview, set_in_game));
    else
        strcpy(fmtstr_doset_simple, fmtstr_tab_doset_simple)
;
    fmtstr = fmtstr_doset_simple;

 redo_opt_help: for (;;) {
    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);

    /* when showing 'help', also describe how to run full doset() */
    if (gs.simple_options_help) {
        /* we could look up whether #optionsfull has been bound to a key
           and show that, or whether #reqmenu and #options are both still
           bound to keys and show those, but if meta keys are involved
           the player might not know how to type them; keep this simple */
        strcpy(buf, _("Use command '#optionsfull'" +
                    " to get the complete options list."));
        add_menu_str(tmpwin, buf);
    }
    struct_assign(any, cg.zeroany);
    any.a_int = -2 + 1;
    add_menu(tmpwin, nul_glyphinfo, any, ord('?'), 0, ATR_NONE, NO_COLOR,
             gs.simple_options_help ? _("hide help") : _("show help"),
             MENU_ITEMFLAGS_NONE);

    for (section = OptS_General; section < OptS_Advanced; section++) {
        struct_assign(any, cg.zeroany);
        add_menu_str(tmpwin, _(""));
        sprintf(buf, _(" %-30s "), OptS_type[section]);
        add_menu_heading(tmpwin, buf);
        for (i = 0; (name = allopt[i].name) != 0; i++) {
            if (allopt[i].section != section)
                continue;
            if ((is_wc_option(name) && !wc_supported(name))
                || (is_wc2_option(name) && !wc2_supported(name)))
                continue;

            any.a_int = i + 1;
            switch (allopt[i].opttyp) {
            case BoolOpt:
                bool_p = allopt[i].addr;
                if (!bool_p)
                    continue;
                if (iflags.wc_tiled_map && allopt[i].idx == opt_color)
                    continue;
                sprintf(buf, fmtstr, name, chars[bool_p] ? _("X") : _(" "));
                break;
            case CompOpt:
            case OthrOpt:
                    k = i;
                    if (allopt[i].optfn == optfn_symset
                        && Is_rogue_level(u.uz)) {
                        k = opt_roguesymset;
                        name = allopt[k].name;
                        any.a_int = k + 1;
                    }

                    chars[buf2 + 0] = ord('\0');
                    reslt = optn_err;
                    if (allopt[k].optfn)
                        reslt = (allopt[k].optfn)(allopt[k].idx, get_val,
                                                   FALSE, buf2, empty_optstr);
                    sprintf(buf, fmtstr, name, ((reslt == optn_ok && chars[buf2 + 0])
                             ? buf2 : _("unknown")))
;
                break;
            default:
                sprintf(buf, _("ERROR"));
                break;
            }
            /* pickup_types is separated from autopickup due to the
               spelling of their names; emphasize what it means */
            if (allopt[i].idx == opt_pickup_types
                || allopt[i].idx == opt_pickup_thrown
                || allopt[i].idx == opt_pickup_stolen
                || allopt[i].idx == opt_dropped_nopick)
                strcat(buf, _("  (for autopickup)"));
            add_menu(tmpwin, nul_glyphinfo, any, 0, 0,
                     ATR_NONE, NO_COLOR, buf, MENU_ITEMFLAGS_NONE);
            if (gs.simple_options_help && allopt[i].descr) {
                sprintf(buf, _("    %s"), allopt[i].descr);
                add_menu_str(tmpwin, buf);
                add_menu_str(tmpwin, _(""));
            }
        }
    }
    end_menu()(tmpwin, _("Options"));

    go.opt_need_redraw = FALSE;
    go.opt_need_glyph_reset = FALSE;
    go.opt_reset_customcolors = FALSE;
    go.opt_reset_customsymbols = FALSE;
    go.opt_update_basic_palette = FALSE;
    pick_cnt = select_menu(tmpwin, PICK_ONE, pick_list);
    /* note:  without the complication of a preselected entry, a PICK_ONE
       menu returning pick_cnt > 0 implies exactly 1 */
    if (pick_cnt > 0) {
        k = ptr_add(pick_list[0], 0).item.a_int - 1;

        chars[abuf + 0] = ord('\0');
        if (k == -2) {
            gs.simple_options_help = +!gs.simple_options_help;
            toggled_help = TRUE;
        } else if (allopt[k].opttyp == BoolOpt) {
            /* boolean option */
            sprintf(buf, _("%s%s"), chars[allopt[k].addr] ? _("!") : _(""), allopt[k].name);
            parseoptions(buf, FALSE, FALSE);
        } else {
            /* compound option */
            if (allopt[k].has_handler && allopt[k].optfn) {
                reslt = (allopt[k].optfn)(allopt[k].idx, do_handler, FALSE,
                                           empty_optstr, empty_optstr);
                /* if player eventually saves options, include this one */
                if (reslt == optn_ok && allopt[k].idx != pfx_cond_)
                    chars[opt_set_in_config + k] = TRUE;
            } else {
                sprintf(buf, _("Set %s to what?"), allopt[k].name);
                getlin(buf, abuf);
                if (chars[abuf + 0] != ord('\x1b')) { /* ESC */
                    sprintf(buf, _("%s:"), allopt[k].name);
                    copynchars(eos(buf), abuf,
                               int(unsigned(sizeof(array_of(char, BUFSZ)) - 1 - strlen(buf))));
                    /* pass the buck */
                    parseoptions(buf, FALSE, FALSE);
                }
                /* Note: using ESC to not set a new value will still return
                   'picked 1' to caller which will loop for another choice */
            }
        }
        if (k >= 0 && chars[abuf + 0] != ord('\x1b')
            && (wc_supported(allopt[k].name)
                || wc2_supported(allopt[k].name)))
            preference_update()(allopt[k].name);

        free(addr_of(pick_list[0])), pick_list[0] = null;
    }
    /* tear down this instance of the menu; if pick_cnt is 1, caller
       will immediately call us back to put up another instance */
    destroy_nhwindow()(tmpwin);

    if (toggled_help) {
        toggled_help = FALSE;
        continue redo_opt_help;
    } break; }

    return pick_cnt;
    } finally { stack_pop($frame); }
}

/* #options - the user friendly version:  get one option from a subset of
   the zillion choices, act upon it, and prompt for another */
export function doset_simple() { /* int */
    let pickedone = 0;
    let flush = FALSE;

    if (iflags.menu_requested) {
        /* doset() checks for 'm' and calls doset_simple(); clear the
           menu-requested flag to avoid doing that recursively */
        iflags.menu_requested = FALSE;
        return doset();
    }

    go.opt_phase = play_opt;
    /* select and change one option at a time, then reprocess the menu
       with updated settings to offer chance for further change */
    give_opt_msg[0] = FALSE;
    do {
        pickedone = doset_simple_menu();
        flush = go.opt_need_redraw;

        reset_needed_visuals();
        if (flush) {
            flush_screen(1);
            flush = FALSE;
        }
    } while (pickedone > 0);
    give_opt_msg[0] = TRUE;
    return ECMD_OK;
}

function term_for_boolean(idx, b) { /* const char * */
    let i, f_t = (chars[b]) ? 1: 0;
    let boolean_term;
    let booleanterms = static_array("term_for_boolean.booleanterms", array_of(ptr_to(char), num_terms), 2, [
        [ _("false"), _("off"), _("disabled"), _("excluded from build") ],
        [ _("true"), _("on"), _("enabled"), _("included")],
    ]);

    boolean_term = booleanterms[f_t][0];
    i = int((allopt[idx].termpref));
    if (i > Term_False && i < num_terms && i < SIZE(booleanterms[0]))
        boolean_term = booleanterms[f_t][i];
    return boolean_term;
}

export const HELP_IDX = SIZE(allopt);

/* the #optionsfull command */
export function doset() { /* int */ /* changing options via menu by Per Liboriussen */
    const $frame = stack_frame(); try {
    var fmtstr_tab_doset = init_string(static_array("doset.fmtstr_tab_doset", char, sizeof_string("%s%s\t[%s]")), _("%s%s\t[%s]"), true);
    var fmtstr_doset = stack_array(char, sizeof_string("%s%-15s [%s]   "));
    var buf = stack_array(char, BUFSZ);
    var name, indent;
    var i = 0, pass, pick_cnt, pick_idx, opt_indx;
    var bool_p;
    var tmpwin;
    var any = stack_struct(struct_any);
    var pick_list = stack_var(ptr_to(struct_mi));
    var indexoffset, startpass, endpass;
    var gavehelp = FALSE, skiphelp = +!iflags.cmdassist;
    var clr = NO_COLOR;

    if (iflags.menu_requested) {
        /* doset_simple() checks for 'm' and calls doset(); clear the
           menu-requested flag to avoid doing that recursively */
        iflags.menu_requested = FALSE;
        return doset_simple();
    }

    go.opt_phase = play_opt;
    /* if we offer '?' as a choice and it is the only thing chosen,
       we'll end up coming back here after showing the explanatory text */
 rerun: for (;;) {
    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);

    /* offer novices a chance to request helpful [sic] advice */
    if (!skiphelp) {
        /* help text surrounding '?' choice should have exactly one NULL */
        var helptext = static_array("doset.helptext", ptr_to(char), null, [
            _("For a brief explanation of how this works, type '?' to select"),
            _("the next menu choice, then press <enter> or <return>."),
            0, /* actual '?' menu entry gets inserted here */
            _(("[To suppress this menu help," +
             " toggle off the 'cmdassist' option.]")),
            _(""),
        ]);
        struct_assign(any, cg.zeroany);
        for (i = 0; i < SIZE(helptext); ++i) {
            if (helptext[i]) {
                sprintf(buf, _("%4s%.75s"), _(""), helptext[i]);
                add_menu_str(tmpwin, buf);
            } else {
                any.a_int = HELP_IDX + 1; /* handling pick_list subtracts 1 */
                add_menu(tmpwin, nul_glyphinfo, any, ord('?'), ord('?'), ATR_NONE,
                         clr, _("view help for options menu"),
                         MENU_ITEMFLAGS_SKIPINVERT);
            }
        }
    }

        startpass = set_gameview;
    endpass = wizard() ? set_wiznofuz : set_in_game;

    if (!iflags.menu_tab_sep)
        /* initial "%s" is for indentation of non-selectable items */
        sprintf(fmtstr_doset, _("%%s%%-%us [%%s]"), longest_option_name(startpass, endpass));
    else
        strcpy(fmtstr_doset, fmtstr_tab_doset)
;

    indexoffset = 1;
    struct_assign(any, cg.zeroany);
    add_menu_heading(tmpwin, _("Booleans (selecting will toggle value):"));
    any.a_int = 0;
    /* first list any other non-modifiable booleans, then modifiable ones */
    for (pass = 0; pass <= 1; pass++)
        for (i = 0; (name = allopt[i].name) != 0; i++)
            if (allopt[i].opttyp == BoolOpt
                && (bool_p = allopt[i].addr) != 0
                && ((allopt[i].setwhere <= set_gameview && pass == 0)
                    || (allopt[i].setwhere >= set_in_game && pass == 1))) {
                if (bool_p == addr_of(ref_of(flags, "female")))
                    continue; /* obsolete */
                if (allopt[i].setwhere == set_wizonly && !wizard())
                    continue;
                if (allopt[i].setwhere == set_wiznofuz
                    && (!wizard() || iflags.debug_fuzzer))
                    continue;
                if ((is_wc_option(name) && !wc_supported(name))
                    || (is_wc2_option(name) && !wc2_supported(name)))
                    continue;

                any.a_int = (pass == 0) ? 0 : i + 1 + indexoffset;
                indent = (pass == 0 && !iflags.menu_tab_sep) ? _("    ") : _("");
                sprintf(buf, fmtstr_doset, indent, name, term_for_boolean(i, bool_p))
;
                if (pass == 0)
                    enhance_menu_text(buf, sizeof(array_of(char, BUFSZ)), pass, bool_p,
                                      allopt[i]);
                add_menu(tmpwin, nul_glyphinfo, any, 0, 0,
                         ATR_NONE, clr, buf, MENU_ITEMFLAGS_SKIPINVERT);
            }

    add_menu_str(tmpwin, _(""));
    add_menu_heading(tmpwin,
                     _("Compounds (selecting will prompt for new value):"));

    for (pass = startpass; pass <= endpass; pass++)
        for (i = 0; (name = allopt[i].name) != 0; i++) {
            if (allopt[i].opttyp != CompOpt)
                continue;
            if (int((allopt[i].setwhere)) == pass) {
                if ((is_wc_option(name) && !wc_supported(name))
                    || (is_wc2_option(name) && !wc2_supported(name)))
                    continue;

                doset_add_menu(tmpwin, name, fmtstr_doset, i,
                               (pass == set_gameview) ? 0 : indexoffset);
            }
        }

    add_menu_str(tmpwin, _(""));
    add_menu_heading(tmpwin, _("Other settings:"));

    for (pass = startpass; pass <= endpass; pass++)
        for (i = 0; (name = allopt[i].name) != 0; i++) {
            if (allopt[i].opttyp != OthrOpt)
                continue;
            if (int((allopt[i].setwhere)) == pass) {
                if ((is_wc_option(name) && !wc_supported(name))
                    || (is_wc2_option(name) && !wc2_supported(name)))
                    continue;

                doset_add_menu(tmpwin, name, fmtstr_doset, i,
                               (pass == set_gameview) ? 0 : indexoffset);
            }
        }

    end_menu()(tmpwin, _("Set what options?"));
    go.opt_need_redraw = FALSE;
    go.opt_need_glyph_reset = FALSE;

    if ((pick_cnt = select_menu(tmpwin, PICK_ANY, pick_list)) > 0) {
        /*
         * Walk down the selection list and either invert the booleans
         * or prompt for new values. In most cases, call parseoptions()
         * to take care of options that require special attention, like
         * redraws.
         */
        for (pick_idx = 0; pick_idx < pick_cnt; ++pick_idx) {
            opt_indx = ptr_add(pick_list[0], pick_idx).item.a_int - 1;
            if (opt_indx == HELP_IDX) {
                display_file()(_(OPTMENUHELP), FALSE);
                gavehelp = TRUE;
                continue; /* just handled '?'; there might be more picks */
            }
            if (opt_indx < -1)
                opt_indx++; /* -1 offset for select_menu() */
            opt_indx -= indexoffset;
            assert(IndexOk(opt_indx, allopt));
            if (allopt[opt_indx].opttyp == BoolOpt) {
                /* boolean option */
                sprintf(buf, _("%s%s"), chars[allopt[opt_indx].addr] ? _("!") : _(""), allopt[opt_indx].name)
;
                parseoptions(buf, FALSE, FALSE);
            } else {
                /* compound option */
                var k = opt_indx, reslt;

                if (allopt[k].has_handler && allopt[k].optfn) {
                    reslt = (allopt[k].optfn)(allopt[k].idx, do_handler,
                                               FALSE, empty_optstr,
                                               empty_optstr);
                    /* if player eventually saves options, include this one */
                    if (reslt == optn_ok)
                        chars[opt_set_in_config + k] = TRUE;
                } else {
                    var abuf = stack_array(char, BUFSZ);

                    sprintf(buf, _("Set %s to what?"), allopt[opt_indx].name);
                    chars[abuf + 0] = ord('\0');
                    getlin(buf, abuf);
                    if (chars[abuf + 0] == ord('\x1b'))
                        continue;
                    sprintf(buf, _("%s:"), allopt[opt_indx].name);
                    strncat(eos(buf), abuf,
                                   unsigned(sizeof(array_of(char, BUFSZ)) - 1 - strlen(buf)));
                    /* pass the buck */
                    parseoptions(buf, FALSE, FALSE);
                }
            }
            if (wc_supported(allopt[opt_indx].name)
                || wc2_supported(allopt[opt_indx].name))
                preference_update()(allopt[opt_indx].name);
        }
        free(addr_of(pick_list[0])), pick_list[0] = null;
    }

    destroy_nhwindow()(tmpwin);

    if (pick_cnt == 1 && gavehelp) {
        /* when '?' is only the thing selected, go back and pick all
           over again without it as an available choice second time */
        skiphelp = TRUE;
        gavehelp = FALSE; /* currently True; reset for second pass */
        continue rerun;
    } break; }

    reset_needed_visuals();
    return ECMD_OK;
    } finally { stack_pop($frame); }
}

function reset_needed_visuals() { /* void */
    if (go.opt_need_glyph_reset) {
        reset_glyphmap(gm_optionchange);
    }
    if (go.opt_reset_customcolors || go.opt_update_basic_palette
        || go.opt_reset_customsymbols || go.opt_need_redraw) {
        if (go.opt_update_basic_palette) {
            go.opt_update_basic_palette = FALSE;
        }
        if (go.opt_reset_customcolors)
            reset_customcolors();
        if (go.opt_reset_customsymbols)
            reset_customsymbols();
        if (go.opt_need_redraw) {
            check_gold_symbol();
            reglyph_darkroom();
        }
        docrt();
    }
    if (go.opt_need_promptstyle) {
        adjust_menu_promptstyle(WIN_INVEN, iflags.menu_headings);
    }
    if (disp.botl || disp.botlx) {
        bot();
    }
    go.opt_need_redraw = FALSE;
    go.opt_need_glyph_reset = FALSE;
    go.opt_reset_customcolors = FALSE;
    go.opt_reset_customsymbols = FALSE;
    go.opt_update_basic_palette = FALSE;
}

/* doset(#optionsfull command) menu entries for compound options */
function doset_add_menu(
    win,
    option,
    fmtstr,
    idx,
    indexoffset) { /* void */ /* value to add to index in allopt[], * or zero if option cannot be changed */
    const $frame = stack_frame(); try {
    let value = _("unknown"); /* current value */
    let indent;
    let buf = stack_array(char, BUFSZ), buf2 = stack_array(char, BUFSZ);
    let any = stack_struct(struct_any);
    let i = idx, reslt = optn_err;

    let clr = NO_COLOR;

    chars[buf2 + 0] = ord('\0');  /* per opt functs may not guarantee this, so do it */
    struct_assign(any, cg.zeroany);
    if (i >= 0 && i < OPTCOUNT && allopt[i].name && allopt[i].optfn) {
        any.a_int = (indexoffset == 0) ? 0 : i + 1 + indexoffset;
        if (allopt[i].optfn)
            reslt = (allopt[i].optfn)(allopt[i].idx, get_val,
                                       FALSE, buf2, empty_optstr);
        if (reslt == optn_ok && chars[buf2 + 0])
            value = buf2;
    } else {
        /* We are trying to add an option not found in allopt[].
           This is almost certainly bad, but we'll let it through anyway
           (with a zero value, so it can't be selected). */
        any.a_int = 0;

        if (!chars[buf2 + 0])
            strcpy(buf2, _("unknown"));
        value = buf2;
    }

    /* "    " replaces "a - " -- assumes menus follow that style */
    indent = !any.a_int ? _("    ") : _("");
    sprintf(buf, fmtstr, indent, option, value);
    add_menu(win, nul_glyphinfo, any, 0, 0,
             ATR_NONE, clr, buf, MENU_ITEMFLAGS_SKIPINVERT);
    } finally { stack_pop($frame); }
}

/* display keys for menu actions; used by cmd.c '?i' and pager.c '?k' */
export function show_menu_controls(win, dolist) { /* void */
    const $frame = stack_frame(); try {
    const struct_xtra_cntrls = struct("show_menu_controls.struct_xtra_cntrls", {
        key: ptr_to(char), desc: ptr_to(char),
    });
    let hardcoded = static_array("show_menu_controls.hardcoded", struct_xtra_cntrls, null, [
        { key: _("Return"), desc: _("Accept current choice(s) and dismiss menu") },
        { key: _("Enter"),  desc: _("Same as Return") },
        { key: _("Space"),  desc: _("If not on last page, advance one page;") },
        { key: _("     "),  desc: _("when on last page, treat like Return") },
        { key: _("Escape"), desc: _("Cancel menu without making any choice(s)") },
        { key: 0, desc: 0}
    ]);
    let mc_fmt = init_string(static_array("show_menu_controls.mc_fmt", char, sizeof_string("%8s     %-6s %s")), _("%8s     %-6s %s"), true),
                      mc_altfmt = init_string(static_array("show_menu_controls.mc_altfmt", char, sizeof_string("%9s  %-6s %s")), _("%9s  %-6s %s"), true);
    let buf = stack_array(char, BUFSZ);
    let fmt, arg;
    let xcp;
    let has_menu_shift = wc2_supported(_("menu_shift"));

    /*
     * Relies on spaces to line things up in columns, so must be rendered
     * with a fixed-width font or will look dreadful.
     */

    putstr()(win, 0, _("Menu control keys:"));
    if (dolist) { /* key bindings help: '?i' */
        let i;
        let ch;

        fmt = _("%-7s %s");
        for (i = 0; default_menu_cmd_info[i].desc; i++) {
            ch = default_menu_cmd_info[i].cmd;
            if ((ch == MENU_SHIFT_RIGHT
                 || ch == MENU_SHIFT_LEFT) && !has_menu_shift)
                continue;
            sprintf(buf, fmt, visctrl(get_menu_cmd_key(ch)), default_menu_cmd_info[i].desc)

;
            putstr()(win, 0, buf);
        }
        /* no separator before hardcoded */
        fmt = _("%s%-7s %s"); /* extra specifier to absorb 'arg' */
        arg = _(""); /* no extra prefix for 'dolist' */
    } else { /* menu controls help: '?k' */
        putstr()(win, 0, _(""));
        sprintf(buf, mc_altfmt, _(""), _("Whole"), _("Current"));
        putstr()(win, 0, buf);
        sprintf(buf, mc_altfmt, _(""), _(" Menu"), _(" Page"));
        putstr()(win, 0, buf);
        sprintf(buf, mc_fmt, _("Select"), visctrl(get_menu_cmd_key(MENU_SELECT_ALL)), visctrl(get_menu_cmd_key(MENU_SELECT_PAGE)))

;
        putstr()(win, 0, buf);
        sprintf(buf, mc_fmt, _("Invert"), visctrl(get_menu_cmd_key(MENU_INVERT_ALL)), visctrl(get_menu_cmd_key(MENU_INVERT_PAGE)))

;
        putstr()(win, 0, buf);
        sprintf(buf, mc_fmt, _("Deselect"), visctrl(get_menu_cmd_key(MENU_UNSELECT_ALL)), visctrl(get_menu_cmd_key(MENU_UNSELECT_PAGE)))

;
        putstr()(win, 0, buf);
        putstr()(win, 0, _(""));
        sprintf(buf, mc_fmt, _("Go to"), visctrl(get_menu_cmd_key(MENU_NEXT_PAGE)), _("Next page"))

;
        putstr()(win, 0, buf);
        sprintf(buf, mc_fmt, _(""), visctrl(get_menu_cmd_key(MENU_PREVIOUS_PAGE)), _("Previous page"))

;
        putstr()(win, 0, buf);
        sprintf(buf, mc_fmt, _(""), visctrl(get_menu_cmd_key(MENU_FIRST_PAGE)), _("First page"))

;
        putstr()(win, 0, buf);
        sprintf(buf, mc_fmt, _(""), visctrl(get_menu_cmd_key(MENU_LAST_PAGE)), _("Last page"))

;
        putstr()(win, 0, buf);
        if (has_menu_shift) {
            sprintf(buf, mc_fmt, _("Pan view"), visctrl(get_menu_cmd_key(MENU_SHIFT_RIGHT)), _("Right (perm_invent only)"))

;
            putstr()(win, 0, buf);
            sprintf(buf, mc_fmt, _(""), visctrl(get_menu_cmd_key(MENU_SHIFT_LEFT)), _("Left"))

;
            putstr()(win, 0, buf);
        }
        putstr()(win, 0, _(""));
        sprintf(buf, mc_fmt, _("Search"), visctrl(get_menu_cmd_key(MENU_SEARCH)), _("Exter a target string and invert all matching entries"))

;
        putstr()(win, 0, buf);
        /* separator before hardcoded */
        putstr()(win, 0, _(""));
        fmt = _("%9s  %-8s %s");
        arg = _("Other "); /* prefix for first hardcoded[] entry, then reset */
    }
    for (xcp = hardcoded[0]; xcp.key; xcp = ptr_add(xcp, 1)) {
        sprintf(buf, fmt, arg, xcp.key, xcp.desc);
        putstr()(win, 0, buf);
        arg = _("");
    }
    } finally { stack_pop($frame); }
}

function count_cond() { /* int */
    let i, cnt = 0;

    for (i = 0; i < CONDITION_COUNT; ++i) {
        if (condtests[i].enabled)
            cnt++;
    }
    return cnt;
}

function count_apes() { /* int */
    let numapes = 0;
    let ape = ga.apelist;

    while (ape) {
      numapes++;
      ape = ape.next;
    }

    return numapes;
}

/* common to msg-types, menu-colors, autopickup-exceptions */
function handle_add_list_remove(optname, numtotal) { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let i, pick_cnt, opt_idx;
    let pick_list = stack_var(ptr_to(struct_mi), null);
    const struct_action = struct("handle_add_list_remove.struct_action", {
        letr: char,
        desc: ptr_to(char),
    }); let action_titles = static_array("handle_add_list_remove.action_titles", struct_action, null, [
        { letr: ord('a'), desc: _("add new %s") },         /* [0] */
        { letr: ord('l'), desc: _("list %s") },            /* [1] */
        { letr: ord('r'), desc: _("remove existing %s") }, /* [2] */
        { letr: ord('x'), desc: _("exit this menu") },     /* [3] */
    ]);
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    for (i = 0; i < SIZE(action_titles); i++) {
        let tmpbuf = stack_array(char, BUFSZ);

        any.a_int++;
        /* omit list and remove if there aren't any yet */
        if (!numtotal && (i == 1 || i == 2))
            continue;
        sprintf(tmpbuf, action_titles[i].desc, (i == 1) ? makeplural(optname) : optname)
;
        add_menu(tmpwin, nul_glyphinfo,any, action_titles[i].letr,
                 0, ATR_NONE, clr, tmpbuf,
                 (i == 3) ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);
    }
    end_menu()(tmpwin, _("Do what?"));
    if ((pick_cnt = select_menu(tmpwin, PICK_ONE, pick_list)) > 0) {
        opt_idx = ptr_add(pick_list[0], 0).item.a_int - 1;
        if (pick_cnt > 1 && opt_idx == 3)
            opt_idx = ptr_add(pick_list[0], 1).item.a_int - 1;
        free(addr_of(pick_list[0]));
    } else
        opt_idx = 3; /* none selected, exit menu */
    destroy_nhwindow()(tmpwin);
    return opt_idx;
    } finally { stack_pop($frame); }
}

export function dotogglepickup() { /* int */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ), ocl = stack_array(char, MAXOCLASSES + 1);

    flags.pickup = +!flags.pickup;
    if (flags.pickup) {
        oc_to_str(flags.pickup_types, ocl);
        sprintf(buf, _("ON, for %s objects%s"), chars[ocl + 0] ? ocl : _("all"), ga.apelist
                    ? ((count_apes() == 1)
                           ? _(", with one exception")
                           : _(", with some exceptions"))
                    : _(""))
;
    } else {
        strcpy(buf, _("OFF"));
    }
    pline(_("Autopickup: %s."), buf);
    return ECMD_OK;
    } finally { stack_pop($frame); }
}

/* toggle any (settable in-game) boolean option by name */
export function toggle_bool_option(p) { /* int */
    const $frame = stack_frame(); try {
    let i;
    let ret = ECMD_FAIL;

    for (i = 0; i < OPTCOUNT; i++)
        if (!strncmpi(allopt[i].name, p, int(strlen(p)))
            && allopt[i].opttyp == BoolOpt
            && allopt[i].setwhere == set_in_game
            && allopt[i].addr != 0) {
            let buf = stack_array(char, BUFSZ);

            sprintf(buf, _("%s%s"), chars[allopt[i].addr] ? _("!") : _(""), allopt[i].name);
            if (parseoptions(buf, FALSE, FALSE))
                ret = ECMD_OK;

            reset_needed_visuals();
        }
    return ret;
    } finally { stack_pop($frame); }
}

export function add_autopickup_exception(mapping) { /* int */
    const $frame = stack_frame(); try {
    let APE_regex_error = init_string(static_array("add_autopickup_exception.APE_regex_error", char, sizeof_string("regex error in AUTOPICKUP_EXCEPTION")), _("regex error in AUTOPICKUP_EXCEPTION"), true),
        APE_syntax_error = init_string(static_array("add_autopickup_exception.APE_syntax_error", char, sizeof_string("syntax error in AUTOPICKUP_EXCEPTION")), _("syntax error in AUTOPICKUP_EXCEPTION"), true);

    let ape;
    let text = stack_array(char, 256), end = stack_var(char);
    let n;
    let grab = FALSE;

    /* scan length limit used to be 255, but smaller size allows the
       quoted value to fit within BUFSZ, simplifying formatting elsewhere;
       this used to ignore the possibility of trailing junk but now checks
       for it, accepting whitespace but rejecting anything else unless it
       starts with '#" for a comment */
    end[0] = ord('\0');
    if ((n = sscanf(mapping, _("\"<%253[^\"]\" %c"), text, addr_of(end))) == 1
        || (n == 2 && end[0] == ord('#'))) {
        grab = TRUE;
    } else if ((n = sscanf(mapping, _("\">%253[^\"]\" %c"), text, addr_of(end))) == 1
               || (n = sscanf(mapping, _("\"%253[^\"]\" %c"), text, addr_of(end))) == 1
               || (n == 2 && end[0] == ord('#'))) {
        grab = FALSE;
    } else {
        config_error_add(_("%s"), APE_syntax_error);
        return 0;
    }

    ape = view_of(struct_autopickup_exception, addr_of(alloc(sizeof(struct_autopickup_exception))));
    ape.regex = regex_init();
    if (!regex_compile(text, ape.regex)) {
        let errbuf = stack_array(char, BUFSZ);
        let re_error_desc = regex_error_desc(ape.regex, errbuf);

        /* free first in case reason for failure was insufficient memory */
        regex_free(ape.regex);
        free(addr_of(ape));
        config_error_add(_("%s: %s"), APE_regex_error, re_error_desc);
        return 0;
    }
    ape.pattern = dupstr(text);
    ape.grab = grab;
    ape.next = ga.apelist;
    ga.apelist = ape;
    return 1;
    } finally { stack_pop($frame); }
}

function remove_autopickup_exception(whichape) { /* void */
    let ape, freeape, prev = null;

    for (ape = ga.apelist; ape;) {
        if (ape == whichape) {
            freeape = ape;
            ape = ape.next;
            if (prev)
                prev.next = ape;
            else
                ga.apelist = ape;
            regex_free(freeape.regex);
            free(freeape.pattern);
            free(addr_of(freeape));
        } else {
            prev = ape;
            ape = ape.next;
        }
    }
}

export function free_autopickup_exceptions() { /* void */
    let ape;

    while ((ape = ga.apelist) != null) {
        free(ape.pattern);
        regex_free(ape.regex);
        ga.apelist = ape.next;
        free(addr_of(ape));
    }
}

export function sym_val(strval) { /* int */ /* up to 4*BUFSZ-1 long; only first few chars matter */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, QBUFSZ), tmp = stack_array(char, QBUFSZ); /* to hold truncated copy of 'strval' */

    chars[buf + 0] = ord('\0');
    if (!chars[strval + 0] || !chars[strval + 1]) { /* empty, or single character */
        /* if single char is space or tab, leave buf[0]=='\0' */
        if (!__isspace(uchar((chars[strval + 0]))))
            chars[buf + 0] = chars[strval + 0];
    } else if (chars[strval + 0] == ord('\'')) { /* single quote */
        /* simple matching single quote; we know strval[1] isn't '\0' */
        if (chars[strval + 2] == ord('\'') && !chars[strval + 3]) {
            /* accepts '\' as backslash and ''' as single quote */
            chars[buf + 0] = chars[strval + 1];

        /* if backslash, handle single or double quote or second backslash */
        } else if (chars[strval + 1] == ord('\\') && chars[strval + 2] && chars[strval + 3] == ord('\'')
            && strchr(_("'\"\\"), chars[strval + 2]) && !chars[strval + 4]) {
            chars[buf + 0] = chars[strval + 2];

        /* not simple quote or basic backslash;
           strip closing quote and let escapes() deal with it */
        } else {
            let p;

            /* +1: skip opening single quote */
            strncpy(tmp, strval + 1, sizeof(array_of(char, QBUFSZ)) - 1);
            chars[tmp + (sizeof(array_of(char, QBUFSZ)) - 1)] = ord('\0');
            if ((p = strrchr(tmp, ord('\''))) != 0) {
                chars[p] = ord('\0');
                escapes(tmp, buf);
            } /* else buf[0] stays '\0' */
        }
    } else { /* not lone char nor single quote */
        strncpy(tmp, strval, sizeof(array_of(char, QBUFSZ)) - 1);
        chars[tmp + (sizeof(array_of(char, QBUFSZ)) - 1)] = ord('\0');
        escapes(tmp, buf);
    }

    return (chars[buf]);
    } finally { stack_pop($frame); }
}

/* data for option_help() */
export const CONFIG_SLOT = 3; const opt_intro = static_array("opt_intro", ptr_to(char), null, [
    _(""),
    _("                 NetHack Options Help:"), _(""),

    0,

    _("or use `NETHACKOPTIONS=\"<options>\"' in your environment"),

    _("(<options> is a list of options separated by commas)"),

    _("or press \"O\" while playing and use the menu."),
    _(""),
    _(("Boolean options (which can be negated by prefixing them" +
     " with '!' or \"no\"):")),
    0
]);

const opt_epilog = static_array("opt_epilog", ptr_to(char), null, [
    _(""),
    _("Some of the options can only be set before the game is started;"),
    _("those items will not be selectable in the 'O' command's menu."),
    _("Some options are stored in a game's save file, and will keep saved"),
    _("values when restoring that game even if you have updated your config-"),
    _("uration file to change them.  Such changes will matter for new games."),
    _("The \"other settings\" can be set with 'O', but when set within the"),
    _("configuration file they use their own directives rather than OPTIONS."),
    _("See NetHack's \"Guidebook\" for details."),
    0
]);

export function option_help() { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ), buf2 = stack_array(char, BUFSZ);
    let optname;
    let i;
    let datawin;

    datawin = create_nhwindow()(NHW_TEXT);
    Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("Set options as OPTIONS=<options> in %s"), get_configfile())
;
    opt_intro[CONFIG_SLOT] = buf;
    for (i = 0; opt_intro[i]; i++)
        putstr()(datawin, 0, opt_intro[i]);

    /* Boolean options */
    for (i = 0; allopt[i].name; i++) {
        if ((allopt[i].opttyp != BoolOpt || !allopt[i].addr)
            || (allopt[i].setwhere == set_wizonly && !wizard()))
            continue;
        if (allopt[i].setwhere == set_wiznofuz
            && (!wizard() || iflags.debug_fuzzer))
            continue;
        optname = allopt[i].name;
        if ((is_wc_option(optname) && !wc_supported(optname))
            || (is_wc2_option(optname) && !wc2_supported(optname)))
            continue;
        next_opt(datawin, optname);
    }
    next_opt(datawin, _(""));

    /* Compound options */
    putstr()(datawin, 0, _("Compound options:"));
    for (i = 0; allopt[i].name; i++) {
        if (allopt[i].opttyp != CompOpt
            || (allopt[i].setwhere == set_wizonly && !wizard()))
            continue;
        if (allopt[i].setwhere == set_wiznofuz
            && (!wizard() || iflags.debug_fuzzer))
            continue;
        optname = allopt[i].name;
        if ((is_wc_option(optname) && !wc_supported(optname))
            || (is_wc2_option(optname) && !wc2_supported(optname)))
            continue;
        sprintf(buf2, _("`%s'"), optname);
        Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%-20s - %s%c"), buf2, allopt[i].descr, allopt[i + 1].name ? ord(',') : ord('.'))
;
        putstr()(datawin, 0, buf);
    }
    putstr()(datawin, 0, _(""));

    /* Compound options */
    putstr()(datawin, 0, _("Other settings:"));
    for (i = 0; allopt[i].name; i++) {
        if (allopt[i].opttyp != OthrOpt)
            continue;
        sprintf(buf, _(" %s"), allopt[i].name);
        putstr()(datawin, 0, buf);
    }

    putstr()(datawin, 0, _(""));

    for (i = 0; opt_epilog[i]; i++)
        putstr()(datawin, 0, opt_epilog[i]);

    /*
     * TODO:
     *  briefly describe interface-specific option-like settings for
     *  the currently active interface:
     *    X11 uses X-specific "application defaults" from NetHack.ad;
     *    Qt has menu accessible "game -> Qt settings" (non-OSX) or
     *      "nethack -> Preferences" (OSX) to maintain a few options
     *      (font size, map tile size, paperdoll show/hide flag and
     *      tile size) which persist across games;
     *    Windows GUI also has some port-specific menus;
     *    tty and curses: anything?
     *  Best done via a new windowprocs function rather than plugging
     *  in details here.
     *
     * Maybe:
     *  switch from text window to pick-none menu so that user can
     *  scroll back up.  (Not necessary for Qt where text windows are
     *  already scrollable.)
     */

    display_nhwindow()(datawin, FALSE);
    destroy_nhwindow()(datawin);
    return;
    } finally { stack_pop($frame); }
}

/* gather all non-default cond_xyz options into one OPTIONS=cond_foo,!cond_bar
   entry spread across multiple lines with backslash+newline if needed;
   conditions with their default settings (cond_blind, !cond_glowhands, &c)
   are excluded */
function all_options_conds(sbuf) { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ), nextcond = stack_array(char, BUFSZ);
    let idx = 0;
    let gotone = FALSE;

    chars[buf + 0] = ord('\0');
    while (opt_next_cond(idx, nextcond)) {
        /* 75: room for about 5 conditions, with enough space for player
           to edit resulting file manually and insert '!' in front of them */
        if (idx == 0) {
            strcpy(buf, _("OPTIONS="));
        } else if (unsigned(unsigned(Strlen(buf) + 1) + Strlen(nextcond)) >= 75) {
            /* finish off previous line */
            strcat(buf, _(",\\\n")); /* comma and backslash+newline */
            strbuf_append(sbuf, buf);
            /* indent continuation line */
            sprintf(buf, _("%8s"), _(" ")); /* 8: strlen("OPTIONS=") */
        } else if (chars[nextcond + 0] && gotone) {
            strcat(buf, _(","));
        }
        if (chars[nextcond + 0]) {
            gotone = TRUE;
            strcat(buf, nextcond);
        }
        ++idx;
    }
    /* finish off final line; value might be empty if one or more cond_xyz
       options were changed in such a manner that they're all back to their
       default values--which will produce "OPTIONS=" with nothing after the
       equals sign; only add to the output when there is more present */
    if (strcmp(buf, _("OPTIONS="))) {
        strcat(buf, _("\n"));
        strbuf_append(sbuf, buf);
    }
    } finally { stack_pop($frame); }
}

/* append menucolor lines to strbuf */
function all_options_menucolors(sbuf) { /* void */
    const $frame = stack_frame(); try {
    let i = 0, ncolors = count_menucolors();
    let tmp = gm.menu_colorings;
    let buf = stack_array(char, BUFSZ*2); /* see also: add_menu_coloring() */
    let arr;

    if (!ncolors)
        return;

    /* reverse the order */
    arr = ref_to(ptr_to(struct_menucoloring), addr_of(alloc(unsigned(Math.imul(unsigned(ncolors), sizeof(ptr_to(struct_menucoloring)))))));
    while (tmp) {
        arr[i++] = tmp;
        tmp = tmp.next;
    }

    for (i = ncolors; i > 0; i--) {
        tmp = arr[i-1];
        let sattr = attr2attrname(tmp.attr);
        let sclr = clr2colorname(tmp.color);
        sprintf(buf, _("MENUCOLOR=\"%s\"=%s%s%s\n"), tmp.origstr, sclr, (tmp.attr != ATR_NONE) ? _("&") : _(""), (tmp.attr != ATR_NONE) ? sattr : _(""))

;
        strbuf_append(sbuf, buf);
    }

    free(addr_of(arr));
    } finally { stack_pop($frame); }
}

function all_options_msgtypes(sbuf) { /* void */
    const $frame = stack_frame(); try {
    let tmp = gp.plinemsg_types;
    let buf = stack_array(char, BUFSZ);

    while (tmp) {
        let mtype = msgtype2name(tmp.msgtype);
        sprintf(buf, _("MSGTYPE=%s \"%s\"\n"), mtype, tmp.pattern)
;
        strbuf_append(sbuf, buf);
        tmp = tmp.next;
    }
    } finally { stack_pop($frame); }
}

function all_options_apes(sbuf) { /* void */
    const $frame = stack_frame(); try {
    let tmp = ga.apelist;
    let buf = stack_array(char, BUFSZ);

    while (tmp) {
        sprintf(buf, _("autopickup_exception=\"%c%s\"\n"), tmp.grab ? ord('<') : ord('>'), tmp.pattern)
;
        strbuf_append(sbuf, buf);
        tmp = tmp.next;
    }
    } finally { stack_pop($frame); }
}

/* #ifdef CHANGE_COLOR: not in this build */

/* return strbuf of all options, to write to file */
export function all_options_strbuf(sbuf) { /* void */
    const $frame = stack_frame(); try {
    let name;
    let tmp = stack_array(char, BUFSZ);
    let buf2;
    let bool_p;
    let i;

    strbuf_init(sbuf);
    sprintf(tmp, _("# NetHack config, saved %s\n#\n"), yyyymmddhhmmss(0))
;
    strbuf_append(sbuf, tmp);

    for (i = 0; (name = allopt[i].name) != 0; i++) {
        if (!chars[opt_set_in_config + i])
            continue;
        switch (allopt[i].opttyp) {
        case BoolOpt:
            bool_p = allopt[i].addr;
            if (!bool_p || bool_p == addr_of(ref_of(flags, "female")))
                break; /* obsolete */
            if (chars[bool_p] != allopt[i].initval) {
                sprintf(tmp, _("OPTIONS=%s%s\n"), chars[bool_p] ? _("") : _("!"), name);
                strbuf_append(sbuf, tmp);
            }
            break;
        case CompOpt:
            if (!(allopt[i].setwhere == set_in_config
                  || allopt[i].setwhere == set_gameview
                  || allopt[i].setwhere == set_in_game))
                break;
            /* FIXME: get_option_value for:
               - menu_deselect_all &c menu control keys,
               - term_cols, term_rows */
            buf2 = get_option_value(name, TRUE);
            if (buf2) {
                Snprintf(tmp, sizeof(array_of(char, BUFSZ)) - 1, _("OPTIONS=%s:%s"), name, buf2);
                strcat(tmp, _("\n")); /* guaranteed to fit */
                strbuf_append(sbuf, tmp);
            }
            break;
        case OthrOpt:
            break;
        }
    }

    /* cond_xyz are closer to regular options than the other 'other opts'
       so put them next; [pfx_cond_] will be set if any cond_Foo were
       present when RC file was read in or if player made any changes via
       status conditions menu; ignore opt_set_in_config[opt_o_status_cond] */
    if (chars[opt_set_in_config + pfx_cond_])
        all_options_conds(sbuf);

    get_changed_key_binds(sbuf);
    savedsym_strbuf(sbuf);
    all_options_menucolors(sbuf);
    all_options_msgtypes(sbuf);
    all_options_apes(sbuf);
    all_options_autocomplete(sbuf);

    all_options_statushilites(sbuf);

    if (chars[gw.wizkit + 0]) {
        sprintf(tmp, _("WIZKIT=%s\n"), gw.wizkit);
        strbuf_append(sbuf, tmp);
    }
    } finally { stack_pop($frame); }
}

/*
 * prints the next boolean option, on the same line if possible, on a new
 * line if not. End with next_opt("").
 */
export function next_opt(datawin, str) { /* void */
    let buf = static_var("next_opt.buf", ptr_to(char), 0);
    let i;
    let s;

    if (!buf[0])
        chars[(buf[0] = addr_of(alloc(COLBUFSZ)))] = ord('\0');

    if (!chars[str]) {
        s = eos(buf[0]);
        if (s > buf[0] + 1 && chars[s + (-2)] == ord(','))
            chars[s + (-2)] = ord('.'), chars[s + (-1)] = ord('\0'); /* replace ending ", " with "." */
        i = COLNO;              /* (greater than COLNO - 2) */
    } else {
        i = int(unsigned(unsigned(Strlen(buf[0]) + Strlen(str)) + 2));
    }

    if (i > COLNO - 2) { /* rule of thumb */
        putstr()(datawin, 0, buf[0]);
        chars[buf[0] + 0] = 0;
    }
    if (chars[str]) {
        strcat(buf[0], str);
        strcat(buf[0], _(", "));
    } else {
        putstr()(datawin, 0, str);
        free((buf[0])), buf[0] = 0;
    }
    return;
}

const wc_options = static_array("wc_options", struct_wc_Opt, null, [
    { wc_name: _("ascii_map"), wc_bit: WC_ASCII_MAP },
    { wc_name: _("color"), wc_bit: WC_COLOR },
    { wc_name: _("eight_bit_tty"), wc_bit: WC_EIGHT_BIT_IN },
    { wc_name: _("hilite_pet"), wc_bit: WC_HILITE_PET },
    { wc_name: _("perm_invent"), wc_bit: WC_PERM_INVENT },
    { wc_name: _("perminv_mode"), wc_bit: WC_PERM_INVENT }, /* shares WC_PERM_INVENT */
    { wc_name: _("popup_dialog"), wc_bit: WC_POPUP_DIALOG },
    { wc_name: _("player_selection"), wc_bit: WC_PLAYER_SELECTION },
    { wc_name: _("preload_tiles"), wc_bit: WC_PRELOAD_TILES },
    { wc_name: _("tiled_map"), wc_bit: WC_TILED_MAP },
    { wc_name: _("tile_file"), wc_bit: WC_TILE_FILE },
    { wc_name: _("tile_width"), wc_bit: WC_TILE_WIDTH },
    { wc_name: _("tile_height"), wc_bit: WC_TILE_HEIGHT },
    { wc_name: _("align_message"), wc_bit: WC_ALIGN_MESSAGE },
    { wc_name: _("align_status"), wc_bit: WC_ALIGN_STATUS },
    { wc_name: _("font_map"), wc_bit: WC_FONT_MAP },
    { wc_name: _("font_menu"), wc_bit: WC_FONT_MENU },
    { wc_name: _("font_message"), wc_bit: WC_FONT_MESSAGE },
    { wc_name: _("font_size_map"), wc_bit: WC_FONTSIZ_MAP },
    { wc_name: _("font_size_menu"), wc_bit: WC_FONTSIZ_MENU },
    { wc_name: _("font_size_message"), wc_bit: WC_FONTSIZ_MESSAGE },
    { wc_name: _("font_size_status"), wc_bit: WC_FONTSIZ_STATUS },
    { wc_name: _("font_size_text"), wc_bit: WC_FONTSIZ_TEXT },
    { wc_name: _("font_status"), wc_bit: WC_FONT_STATUS },
    { wc_name: _("font_text"), wc_bit: WC_FONT_TEXT },
    { wc_name: _("map_mode"), wc_bit: WC_MAP_MODE },
    { wc_name: _("scroll_amount"), wc_bit: WC_SCROLL_AMOUNT },
    { wc_name: _("scroll_margin"), wc_bit: WC_SCROLL_MARGIN },
    { wc_name: _("splash_screen"), wc_bit: WC_SPLASH_SCREEN },
    { wc_name: _("use_inverse"), wc_bit: WC_INVERSE },
    { wc_name: _("vary_msgcount"), wc_bit: WC_VARY_MSGCOUNT },
    { wc_name: _("windowcolors"), wc_bit: WC_WINDOWCOLORS },
    { wc_name: _("mouse_support"), wc_bit: WC_MOUSE_SUPPORT },
    { wc_name: 0, wc_bit: 0 }
]);
const wc2_options = static_array("wc2_options", struct_wc_Opt, null, [
    { wc_name: _("armorstatus"), wc_bit: WC2_EXTRASTATUS },
    { wc_name: _("fullscreen"), wc_bit: WC2_FULLSCREEN },
    { wc_name: _("guicolor"), wc_bit: WC2_GUICOLOR },
    { wc_name: _("hilite_status"), wc_bit: WC2_HILITE_STATUS },
    { wc_name: _("hitpointbar"), wc_bit: WC2_HITPOINTBAR },
    { wc_name: _("menu_shift"), wc_bit: WC2_MENU_SHIFT },
    { wc_name: _("petattr"), wc_bit: WC2_PETATTR },
    { wc_name: _("softkeyboard"), wc_bit: WC2_SOFTKEYBOARD },
    /* name shown in 'O' menu is different */
    { wc_name: _("status hilite rules"), wc_bit: WC2_HILITE_STATUS },
    /* statushilites doesn't have its own bit */
    { wc_name: _("statushilites"), wc_bit: WC2_HILITE_STATUS },
    { wc_name: _("statuslines"), wc_bit: WC2_STATUSLINES },
    { wc_name: _("term_cols"), wc_bit: WC2_TERM_SIZE },
    { wc_name: _("term_rows"), wc_bit: WC2_TERM_SIZE },
    { wc_name: _("terrainstatus"), wc_bit: WC2_EXTRASTATUS },
    { wc_name: _("use_darkgray"), wc_bit: WC2_DARKGRAY },
    { wc_name: _("weaponstatus"), wc_bit: WC2_EXTRASTATUS },
    { wc_name: _("windowborders"), wc_bit: WC2_WINDOWBORDERS },
    { wc_name: _("wraptext"), wc_bit: WC2_WRAPTEXT },
    { wc_name: 0, wc_bit: 0 }
]);

/*
 * If a port wants to change or ensure that the set_in_sysconf,
 * set_in_config, set_gameview, or set_in_game status of an option is
 * correct (for controlling its display in the option menu) call
 * set_option_mod_status()
 * with the appropriate second argument.
 */
export function set_option_mod_status(optnam, status) { /* void */
    let k;

    if (SET__IS_VALUE_VALID(status)) {
        impossible(_("set_option_mod_status: status out of range %d."), status);
        return;
    }
    for (k = 0; allopt[k].name; k++) {
        if (str_start_is(allopt[k].name, optnam, TRUE)) {
            allopt[k].setwhere = unsigned(status);
            return;
        }
    }
}

/*
 * You can set several wc_options in one call to
 * set_wc_option_mod_status() by setting
 * the appropriate bits for each option that you
 * are setting in the optmask argument
 * prior to calling.
 *    example: set_wc_option_mod_status(WC_COLOR|WC_SCROLL_MARGIN,
 * set_in_game);
 */
export function set_wc_option_mod_status(optmask, status) { /* void */
    let k = 0;

    if (SET__IS_VALUE_VALID(status)) {
        impossible(_("set_wc_option_mod_status: status out of range %d."),
                   status);
        return;
    }
    while (wc_options[k].wc_name) {
        if (optmask & wc_options[k].wc_bit) {
            set_option_mod_status(wc_options[k].wc_name, status);
        }
        k++;
    }
}

function is_wc_option(optnam) { /* boolean */
    let k = 0;

    while (wc_options[k].wc_name) {
        if (strcmp(wc_options[k].wc_name, optnam) == 0)
            return TRUE;
        k++;
    }
    return FALSE;
}

function wc_supported(optnam) { /* boolean */
    let k;

    for (k = 0; wc_options[k].wc_name; ++k) {
        if (!strcmp(wc_options[k].wc_name, optnam))
            return (windowprocs.wincap & wc_options[k].wc_bit) ? TRUE : FALSE;
    }
    return FALSE;
}

/*
 * You can set several wc2_options in one call to
 * set_wc2_option_mod_status() by setting
 * the appropriate bits for each option that you
 * are setting in the optmask argument
 * prior to calling.
 *    example:
 * set_wc2_option_mod_status(WC2_FULLSCREEN|WC2_SOFTKEYBOARD|WC2_WRAPTEXT,
 * set_in_config);
 */

export function set_wc2_option_mod_status(optmask, status) { /* void */
    let k = 0;

    if (SET__IS_VALUE_VALID(status)) {
        impossible(_("set_wc2_option_mod_status: status out of range %d."),
                   status);
        return;
    }
    while (wc2_options[k].wc_name) {
        if (optmask & wc2_options[k].wc_bit) {
            set_option_mod_status(wc2_options[k].wc_name, status);
        }
        k++;
    }
}

function is_wc2_option(optnam) { /* boolean */
    let k = 0;

    while (wc2_options[k].wc_name) {
        if (strcmp(wc2_options[k].wc_name, optnam) == 0)
            return TRUE;
        k++;
    }
    return FALSE;
}

function wc2_supported(optnam) { /* boolean */
    let k;

    for (k = 0; wc2_options[k].wc_name; ++k) {
        if (!strcmp(wc2_options[k].wc_name, optnam))
            return (windowprocs.wincap2 & wc2_options[k].wc_bit) ? TRUE
                                                                 : FALSE;
    }
    return FALSE;
}

function wc_set_font_name(opttype, fontname) { /* void */
    let fn = null;

    if (!fontname)
        return;
    switch (opttype) {
    case MAP_OPTION:
        fn = ref_of(iflags, "wc_font_map");
        break;
    case MESSAGE_OPTION:
        fn = ref_of(iflags, "wc_font_message");
        break;
    case TEXT_OPTION:
        fn = ref_of(iflags, "wc_font_text");
        break;
    case MENU_OPTION:
        fn = ref_of(iflags, "wc_font_menu");
        break;
    case STATUS_OPTION:
        fn = ref_of(iflags, "wc_font_status");
        break;
    default:
        return;
    }
    if (fn) {
        if (fn[0])
            free((fn[0]));
        fn[0] = dupstr(fontname);
    }
    return;
}

const fgp = static_array("fgp", ptr_to(ptr_to(char)), null, [ ref_of(iflags.wcolors[wcolor_menu], "fg"),
                        ref_of(iflags.wcolors[wcolor_message], "fg"),
                        ref_of(iflags.wcolors[wcolor_status], "fg"),
                        ref_of(iflags.wcolors[wcolor_text], "fg") ]);
const bgp = static_array("bgp", ptr_to(ptr_to(char)), null, [ ref_of(iflags.wcolors[wcolor_menu], "bg"),
                        ref_of(iflags.wcolors[wcolor_message], "bg"),
                        ref_of(iflags.wcolors[wcolor_status], "bg"),
                        ref_of(iflags.wcolors[wcolor_text], "bg") ]);
global_scalar("options_set_window_colors_flag", int, 0);

function wc_set_window_colors(op) { /* int */
    const $frame = stack_frame(); try {
    /* syntax:
     *  menu white/black message green/yellow status white/blue text
     * white/black
     */

    let j;
    let clr;
    let buf = stack_array(char, BUFSZ);
    let wn, tfg, tbg, newop;

    strcpy(buf, op);
    newop = mungspaces(buf);
    while (chars[newop]) {
        wn = tfg = tbg = 0;

        /* until first non-space in case there's leading spaces - before
           colorname*/
        if (chars[newop] == ord(' '))
            newop++;
        if (!chars[newop])
            return 0;
        wn = newop;

        /* until first space - colorname*/
        while (chars[newop] && chars[newop] != ord(' '))
            newop++;
        if (!chars[newop])
            return 0;
        chars[newop++] = ord('\0');

        /* until first non-space - before foreground*/
        if (chars[newop] == ord(' '))
            newop++;
        if (!chars[newop])
            return 0;
        tfg = newop;

        /* until slash - foreground */
        while (chars[newop] && chars[newop] != ord('/'))
            newop++;
        if (!chars[newop])
            return 0;
        chars[newop++] = ord('\0');

        /* until first non-space (in case there's leading space after slash) -
         * before background */
        if (chars[newop] == ord(' '))
            newop++;
        if (!chars[newop])
            return 0;
        tbg = newop;

        /* until first space - background */
        while (chars[newop] && chars[newop] != ord(' '))
            newop++;
        if (chars[newop])
            chars[newop++] = ord('\0');

        for (j = 0; j < WC_COUNT; ++j) {
            if (!strcmpi(wn, wcnames[j]) || !strcmpi(wn, wcshortnames[j])) {
                if (!strstri(tfg, _(" "))) {
                    if ((fgp[j])[0])
                        free(((fgp[j])[0]));
                    clr = check_enhanced_colors(tfg);
                    (fgp[j])[0] = dupstr((clr >= 0) ? wc_color_name(clr) : tfg);
                }
                if (!strstri(tbg, _(" "))) {
                    if ((bgp[j])[0])
                        free(((bgp[j])[0]));
                    clr = check_enhanced_colors(tbg);
                    (bgp[j])[0] = dupstr((clr >= 0) ? wc_color_name(clr) : tbg);
                }
                if (wcolors_opt[j] != 0) {
                    config_error_add(
                       _("windowcolors for %s windows specified multiple times"),
                                     wcnames[j]);
                }
                wcolors_opt[j]++;
                break;
            }
        }
        if (j == WC_COUNT) {
            config_error_add(_("windowcolors for unrecognized window type: %s"),
                             wn);
        }
    }
    options_set_window_colors_flag = 1;
    return 1;
    } finally { stack_pop($frame); }
}

export function options_free_window_colors() { /* void */
    let j;

    for (j = 0; j < WC_COUNT; ++j) {
        if ((fgp[j])[0])
            free(((fgp[j])[0])), (fgp[j])[0] = 0;
        if ((bgp[j])[0])
            free(((bgp[j])[0])), (bgp[j])[0] = 0;
    }
    options_set_window_colors_flag = 0;
}

/* set up for wizard mode if player or save file has requested it;
   called from port-specific startup code to handle `nethack -D' or
   OPTIONS=playmode:debug, or from dorecover()'s restgamestate() if
   restoring a game which was saved in wizard mode */
export function set_playmode() { /* void */
    if (wizard()) {
        if (authorize_wizard_mode())
            gp.plnamelen = int(strlen(strcpy(svp.plname, _("wizard"))));
        else
            flags.debug = FALSE; /* not allowed or not available */
        /* try explore mode if we didn't make it into wizard mode */
        /* if requesting wizard mode when restoring a normal game, this will
           set iflags.deferred_X and prompt to activate explore mode after the
           save file has already been deleted */
        flags.explore = +!wizard();
        iflags.deferred_X = FALSE;
    }
    if (discover() && !authorize_explore_mode()) {
        flags.explore = iflags.deferred_X = FALSE;
    }
    /* don't need to do anything special for normal play */
}

function enhance_menu_text(
    buf,
    sz,
    whichpass,
    bool_p,
    thisopt) { /* void */
    let nowsz, availsz;

    if (!buf)
        return;
    nowsz = unsigned(strlen(buf) + 1);
    availsz = unsigned(sz - nowsz);

    (availsz);
    (bool_p);
    (thisopt);

    return;
}

export function heed_all_options() { /* void */
    let i;

    for (i = 0; i < OPTCOUNT; i++)
        allopt[i].disregarded = FALSE;
}

export function disregard_all_options() { /* void */
    let i;

    for (i = 0; i < OPTCOUNT ; i++)
        allopt[i].disregarded = TRUE;
}

export function heed_this_option(optidx) { /* void */
    if (optidx >= 0 && optidx < OPTCOUNT)
         allopt[optidx].disregarded = FALSE;
}
export function disregard_this_option(optidx) { /* void */
    if (optidx >= 0 && optidx < OPTCOUNT)
        allopt[optidx].disregarded = TRUE;
}

/*options.c*/

import { CONDITION_COUNT } from "./botl.h.js";
import { VIA_WINDOWPORT } from "./botl.h.macros.js";
import { NO_COLOR, struct_color_and_attr } from "./color.h.js";
import { SYSCF_FILE } from "./config.h.js";
import { AE, AS } from "./decl.h.macros.js";
import {
    AMULET_CLASS, ARMOR_CLASS, BALL_CLASS, CHAIN_CLASS, COIN_CLASS, FOOD_CLASS, GEM_CLASS, GOLD_SYM,
    MAXMCLASSES, MAXOCLASSES, POTION_CLASS, RING_CLASS, ROCK_CLASS, SCROLL_CLASS, SPBOOK_CLASS,
    TOOL_CLASS, VENOM_SYM, WAND_CLASS, WEAPON_CLASS,
} from "./defsym.h.js";
import { gm_optionchange } from "./display.h.js";
import { Is_rogue_level } from "./dungeon.h.macros.js";
import {
    AUTOUNLOCK_APPLY_KEY, AUTOUNLOCK_FORCE, AUTOUNLOCK_KICK, AUTOUNLOCK_UNTRAP,
    DISCLOSE_NO_WITHOUT_PROMPT, DISCLOSE_PROMPT_DEFAULT_NO, DISCLOSE_PROMPT_DEFAULT_SPECIAL,
    DISCLOSE_PROMPT_DEFAULT_YES, DISCLOSE_SPECIAL_WITHOUT_PROMPT, DISCLOSE_YES_WITHOUT_PROMPT,
    GFILTER_AREA, GFILTER_NONE, GFILTER_VIEW, GPCOORDS_COMFULL, GPCOORDS_COMPASS, GPCOORDS_MAP,
    GPCOORDS_NONE, GPCOORDS_SCREEN, NUM_DISCLOSURE_OPTIONS, PARANOID_AUTOALL, PARANOID_BONES,
    PARANOID_BREAKWAND, PARANOID_CONFIRM, PARANOID_DIE, PARANOID_EATING, PARANOID_HIT,
    PARANOID_PRAY, PARANOID_QUIT, PARANOID_REMOVE, PARANOID_SWIM, PARANOID_TRAP,
    PARANOID_WERECHANGE, RUN_CRAWL, RUN_LEAP, RUN_STEP, RUN_TPORT, VI_BRANCH, VI_NAME, VI_NUMBER,
    WC_COUNT, wcolor_menu, wcolor_message, wcolor_status, wcolor_text,
} from "./flag.h.js";
import { discover, wizard } from "./flag.h.macros.js";
import {
    BUFSZ, COLBUFSZ, COLNO, FALSE, LARGEST_INT, OPTMENUHELP, PL_CSIZ, PL_FSIZ, PL_NSIZ, PL_PSIZ,
    QBUFSZ, ROWNO, SYMBOLS, TRUE, builtin_opt, cmdline_opt, environ_opt, nhsym, num_opt_phases,
    opt_in, opt_out, play_opt, set_gameview, set_hidden, set_in_config, set_in_game, set_in_sysconf,
    set_wiznofuz, set_wizonly, syscf_opt, xint8,
} from "./global.h.js";
import { C, M, SET__IS_VALUE_VALID, Strlen, strcmpi } from "./global.h.macros.js";
import {
    ECMD_FAIL, ECMD_OK, EXT_ENCUMBER, HVY_ENCUMBER, MAX_MENU_MAPPED_CMDS, MENUTYPELEN,
    MENU_COMBINATION, MENU_FULL, MENU_PARTIAL, MENU_TRADITIONAL, MOD_ENCUMBER, MSGTYP_NOREP,
    MSGTYP_NORMAL, MSGTYP_NOSHOW, MSGTYP_STOP, OVERLOADED, SLT_ENCUMBER, SYM_OFF_O, SYM_OFF_X,
    UNENCUMBERED, VANQ_MLVL_MNDX, WINTYPELEN, struct_autopickup_exception, struct_menucoloring,
    struct_plinemsg_type,
} from "./hack.h.js";
import {
    FEATURE_NOTICE_VER_MAJ, FEATURE_NOTICE_VER_MIN, FEATURE_NOTICE_VER_PATCH, IndexOk, max,
} from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { LOW_PM, NUMMONS } from "./monsters.h.js";
import { struct_fruit } from "./objclass.h.js";
import { OBJ_NAME, newfruit } from "./objclass.h.macros.js";
import { BOULDER, SLIME_MOLD } from "./objects.h.js";
import {
    BoolOpt, CompOpt, No, OPTCOUNT, Off, On, OptS_Advanced, OptS_Behavior, OptS_General, OptS_Map,
    OptS_Status, OthrOpt, Term_Excluded, Term_False, Term_Off, Yes, ascii_map_Def, num_terms,
    opt_BIOS, opt_DECgraphics, opt_IBMgraphics, opt_accessiblemsg, opt_acoustics, opt_align_message,
    opt_align_status, opt_alignment, opt_altkeyhandling, opt_altmeta, opt_armorstatus,
    opt_ascii_map, opt_autodescribe, opt_autodig, opt_autoopen, opt_autopickup, opt_autoquiver,
    opt_autounlock, opt_bgcolors, opt_blind, opt_bones, opt_boulder, opt_catname, opt_checkpoint,
    opt_cmdassist, opt_color, opt_confirm, opt_crash_email, opt_crash_name, opt_crash_urlmax,
    opt_customcolors, opt_customsymbols, opt_dark_room, opt_deaf, opt_debug_hunger,
    opt_debug_mongen, opt_debug_overwrite_stairs, opt_disclose, opt_dogname, opt_dropped_nopick,
    opt_dungeon, opt_effects, opt_eight_bit_tty, opt_extmenu, opt_female, opt_fireassist,
    opt_fixinv, opt_font_map, opt_font_menu, opt_font_message, opt_font_size_map,
    opt_font_size_menu, opt_font_size_message, opt_font_size_status, opt_font_size_text,
    opt_font_status, opt_font_text, opt_force_invmenu, opt_fruit, opt_fullscreen, opt_gender,
    opt_glyph, opt_goldX, opt_guicolor, opt_help, opt_herecmd_menu, opt_hilite_pet, opt_hilite_pile,
    opt_hilite_status, opt_hitpointbar, opt_horsename, opt_idlecheckpoint, opt_ignintr,
    opt_implicit_uncursed, opt_legacy, opt_lit_corridor, opt_lootabc, opt_mail, opt_map_mode,
    opt_mention_decor, opt_mention_map, opt_mention_walls, opt_menu_deselect_all,
    opt_menu_deselect_page, opt_menu_first_page, opt_menu_headings, opt_menu_invert_all,
    opt_menu_invert_page, opt_menu_last_page, opt_menu_next_page, opt_menu_objsyms,
    opt_menu_overlay, opt_menu_previous_page, opt_menu_search, opt_menu_select_all,
    opt_menu_select_page, opt_menu_shift_left, opt_menu_shift_right, opt_menu_tab_sep,
    opt_menucolors, opt_menuinvertmode, opt_menustyle, opt_mon_movement, opt_monpolycontrol,
    opt_monsters, opt_montelecontrol, opt_mouse_support, opt_msg_window, opt_msghistory, opt_name,
    opt_news, opt_nudist, opt_null, opt_number_pad, opt_o_autocomplete, opt_o_autopickup_exceptions,
    opt_o_bind_keys, opt_o_menu_colors, opt_o_message_types, opt_o_status_cond,
    opt_o_status_hilites, opt_objects, opt_packorder, opt_paranoid_confirmation, opt_pauper,
    opt_perm_invent, opt_perminv_mode, opt_petattr, opt_pettype, opt_pickup_burden,
    opt_pickup_stolen, opt_pickup_thrown, opt_pickup_types, opt_pile_limit, opt_player_selection,
    opt_playmode, opt_popup_dialog, opt_preload_tiles, opt_price_quotes, opt_pushweapon,
    opt_query_menu, opt_quick_farsight, opt_race, opt_rawio, opt_reroll, opt_rest_on_space,
    opt_roguesymset, opt_role, opt_runmode, opt_safe_pet, opt_safe_wait, opt_sanity_check,
    opt_scores, opt_scroll_amount, opt_scroll_margin, opt_selectsaved, opt_showdamage, opt_showexp,
    opt_showrace, opt_showscore, opt_showvers, opt_silent, opt_softkeyboard, opt_sortdiscoveries,
    opt_sortloot, opt_sortpack, opt_sortvanquished, opt_soundlib, opt_sounds, opt_sparkle,
    opt_splash_screen, opt_spot_monsters, opt_standout, opt_status_updates, opt_statushilites,
    opt_statuslines, opt_suppress_alert, opt_symset, opt_term_cols, opt_term_rows,
    opt_terrainstatus, opt_tile_file, opt_tile_height, opt_tile_width, opt_tiled_map, opt_time,
    opt_timed_delay, opt_tips, opt_tombstone, opt_toptenwin, opt_traps, opt_travel,
    opt_travel_debug, opt_tutorial, opt_use_darkgray, opt_use_inverse, opt_use_truecolor,
    opt_vary_msgcount, opt_verbose, opt_versinfo, opt_voices, opt_vt_sounddata, opt_vt_tiledata,
    opt_warnings, opt_weaponstatus, opt_whatis_coord, opt_whatis_filter, opt_whatis_menu,
    opt_whatis_moveskip, opt_windowborders, opt_windowcolors, opt_windowtype, opt_wizmgender,
    opt_wizweight, opt_wraptext, pfx_cond_, pfx_font, struct_allopt_t, tiled_map_Def,
} from "./optlist.h.js";
import { NoAlias } from "./optlist.h.macros.js";
import { STONE } from "./rm.h.js";
import {
    MAXDCHARS, MAXECHARS, MAXTCHARS, NUM_GRAPHICS, PRIMARYSET, ROGUESET, SYM_BOULDER, WARNCOUNT,
    do_custom_colors, do_custom_symbols,
} from "./sym.h.js";
import {
    ALIGN_BOTTOM, ALIGN_LEFT, ALIGN_RIGHT, ALIGN_TOP, MAP_MODE_ASCII10x18, MAP_MODE_ASCII12x16,
    MAP_MODE_ASCII16x12, MAP_MODE_ASCII16x8, MAP_MODE_ASCII4x6, MAP_MODE_ASCII6x8,
    MAP_MODE_ASCII7x12, MAP_MODE_ASCII8x12, MAP_MODE_ASCII8x8, MAP_MODE_ASCII_FIT_TO_SCREEN,
    MAP_MODE_TILES, MAP_MODE_TILES_FIT_TO_SCREEN, RS_ALGNMNT, RS_GENDER, RS_RACE, RS_ROLE,
    RS_filter, VIA_DIALOG, VIA_PROMPTS, WC2_DARKGRAY, WC2_EXTRASTATUS, WC2_FULLSCREEN, WC2_GUICOLOR,
    WC2_HILITE_STATUS, WC2_HITPOINTBAR, WC2_MENU_SHIFT, WC2_PETATTR, WC2_SOFTKEYBOARD,
    WC2_STATUSLINES, WC2_TERM_SIZE, WC2_WINDOWBORDERS, WC2_WRAPTEXT, WC_ALIGN_MESSAGE,
    WC_ALIGN_STATUS, WC_ASCII_MAP, WC_COLOR, WC_EIGHT_BIT_IN, WC_FONTSIZ_MAP, WC_FONTSIZ_MENU,
    WC_FONTSIZ_MESSAGE, WC_FONTSIZ_STATUS, WC_FONTSIZ_TEXT, WC_FONT_MAP, WC_FONT_MENU,
    WC_FONT_MESSAGE, WC_FONT_STATUS, WC_FONT_TEXT, WC_HILITE_PET, WC_INVERSE, WC_MAP_MODE,
    WC_MOUSE_SUPPORT, WC_PERM_INVENT, WC_PLAYER_SELECTION, WC_POPUP_DIALOG, WC_PRELOAD_TILES,
    WC_SCROLL_AMOUNT, WC_SCROLL_MARGIN, WC_SPLASH_SCREEN, WC_TILED_MAP, WC_TILE_FILE,
    WC_TILE_HEIGHT, WC_TILE_WIDTH, WC_VARY_MSGCOUNT, WC_WINDOWCOLORS, struct_wc_Opt, wp_curses,
    wp_tty,
} from "./winprocs.h.js";
import {
    create_nhwindow, destroy_nhwindow, display_file, display_nhwindow, end_menu, number_pad,
    preference_update, putstr, start_menu, wait_synch,
} from "./winprocs.h.macros.js";
import {
    ATR_INVERSE, ATR_NONE, InvOptInUse, InvOptNone, InvOptOn, InvSparse, MENU_BEHAVE_STANDARD,
    MENU_FIRST_PAGE, MENU_INVERT_ALL, MENU_INVERT_PAGE, MENU_ITEMFLAGS_NONE,
    MENU_ITEMFLAGS_SELECTED, MENU_ITEMFLAGS_SKIPINVERT, MENU_LAST_PAGE, MENU_NEXT_PAGE,
    MENU_PREVIOUS_PAGE, MENU_SEARCH, MENU_SELECT_ALL, MENU_SELECT_PAGE, MENU_SHIFT_LEFT,
    MENU_SHIFT_RIGHT, MENU_UNSELECT_ALL, MENU_UNSELECT_PAGE, NHW_MENU, NHW_TEXT, NUM_MOUSE_BUTTONS,
    PICK_ANY, PICK_NONE, PICK_ONE, struct_any, struct_mi,
} from "./wintype.h.js";
import { ROLE_NONE, ROLE_RANDOM } from "./you.h.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, schar, sizeof, sizeof_string, uchar, unsigned } from "../rt/ctypes.js";
import { global_scalar } from "../rt/globals.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import {
    EXIT_FAILURE, __isspace, assert, atoi, atoll, free, getenv, memcpy, memset, sprintf, sscanf,
    strcat, strchr, strcmp, strcpy, strlen, strncat, strncmp, strncpy, strrchr, strstr,
} from "../rt/libc.js";
import {
    init_string, stack_array, stack_struct, stack_var, static_array, static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, ptr_add, ptr_to, ref_of, ref_to, sizeof_member, struct, struct_assign,
    view_of,
} from "../rt/struct.js";
import { alloc, dupstr } from "./alloc.js";
import { sanitize_name } from "./bones.js";
import {
    all_options_statushilites, bot, check_gold_symbol, clear_status_hilites, cond_menu, condopt,
    condtests, count_status_hilites, opt_next_cond, parse_cond_option, parse_status_hl1,
    reset_status_hilites, status_hilite_menu, status_initialize,
} from "./botl.js";
import { yyyymmddhhmmss } from "./calendar.js";
import {
    assure_syscf_file, config_error_add, config_error_done, config_error_init,
    config_unmatched_ignored, get_configfile, rcfile, read_config_file,
} from "./cfgfiles.js";
import {
    all_options_autocomplete, bind_key, bind_mousebtn, bind_specialkey, cmd_from_func,
    cmdname_from_func, count_autocompletions, count_bind_keys, do_reqmenu, get_changed_key_binds,
    handler_change_autocompletions, handler_rebind_keys, reset_commands, update_rest_on_space,
} from "./cmd.js";
import {
    add_menu_coloring_parsed, attr2attrname, check_enhanced_colors, clr2colorname,
    color_attr_parse_str, color_attr_to_str, count_menucolors, free_one_menu_coloring,
    match_str2attr, query_attr, query_color, query_color_attr, wc_color_name,
} from "./coloratt.js";
import { nomakedefs } from "./date.js";
import {
    a11y, cg, disclosure_options, disp, flags, ga, gc, gd, gf, gh, gm, gn, go, gp, gs, gv, gw,
    hexdd, iflags, program_state, svb, svc, svp, u,
} from "./decl.js";
import { docrt, flush_screen, nul_glyphinfo, reglyph_darkroom, reset_glyphmap } from "./display.js";
import {
    def_char_to_monclass, def_char_to_objclass, def_oc_syms, def_warnsyms,
} from "./drawing.js";
import { nh_terminate, panic } from "./end.js";
import { do_deferred_showpaths, nh_basename, read_sym_file } from "./files.js";
import {
    apply_customizations, fill_glyphid_cache, free_glyphid_cache, glyphid_cache_status,
    glyphrep_to_custom_map_entries, reset_customcolors,
} from "./glyphs.js";
import { classify_terrain } from "./hack.js";
import {
    copynchars, digit, eos, fuzzymatch, highc, letter, lowc, mungspaces, strNsubst, str_end_is,
    str_start_is, strkitten, strncmpi, strstri, strsubst, trimspaces, visctrl,
} from "./hacklib.js";
import { set_vanq_order, vanqorders } from "./insight.js";
import { reassign, update_inventory } from "./invent.js";
import { name_to_mon } from "./mondata.js";
import { choose_disco_sort, get_sortdisco } from "./o_init.js";
import { obj_descr, objects } from "./objects.js";
import { fruit_from_name, makeplural, makesingular } from "./objnam.js";
import { You_cant, impossible, pline, raw_printf } from "./pline.js";
import { init_random, rn2, rn2_on_display_rng, rnd } from "./rnd.js";
import {
    aligns, clearrolefilter, genders, races, rolefilterstring, roles, setrolefilter, str2align,
    str2gend, str2race, str2role,
} from "./role.js";
import { sf_init } from "./sfbase.js";
import { assign_soundlib, get_soundlib_name, soundlib_id_from_opt } from "./sounds.js";
import { strbuf_append, strbuf_init } from "./strutil.js";
import {
    assign_graphics, clear_symsetentry, do_symset, get_othersym, init_ov_primary_symbols,
    init_ov_rogue_symbols, init_rogue_symbols, init_symbols, known_handling, load_symset,
    parsesymbols, savedsym_strbuf, switch_symbols,
} from "./symbols.js";
import { reset_customsymbols } from "./utf8map.js";
import { get_current_feature_ver, get_feature_notice_ver, status_version } from "./version.js";
import { vision_recalc } from "./vision.js";
import {
    add_menu, add_menu_heading, add_menu_str, adjust_menu_promptstyle, choose_classes_menu,
    choose_windows, getlin, select_menu, windowprocs,
} from "./windows.js";
import {
    regex_compile, regex_error_desc, regex_free, regex_init, regex_match,
} from "../sys/share/posixregex.js";
import { authorize_explore_mode, authorize_wizard_mode } from "../sys/unix/unixmain.js";

// the records of allopt_init[] from optlist.h, laid out like it
function allopt_init_records() {
    return [
    { name: _("windowtype"), section: OptS_Advanced, expectedbuf: WINTYPELEN, idx: opt_windowtype,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_windowtype, alias: NoAlias(),
                descr: _("windowing system to use (should be specified first)"), initval: Off,
        has_handler: No },
    { name: _("playmode"), section: OptS_Advanced, expectedbuf: 8, idx: opt_playmode,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_playmode, alias: NoAlias(),
                descr: _("normal play, non-scoring explore mode, or debug mode"), initval: Off,
        has_handler: No },
    { name: _("name"), section: OptS_Advanced, expectedbuf: PL_NSIZ, idx: opt_name,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_name, alias: NoAlias(),
                descr: _("your character's name (e.g., name:Merlin-W)"), initval: Off,
        has_handler: No },
    { name: _("role"), section: OptS_Advanced, expectedbuf: PL_CSIZ, idx: opt_role,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: Yes, pfx: No, opt_in_out: opt_in,
        optfn: optfn_role, alias: _("character"),
                descr: _("your starting role (e.g., Barbarian, Valkyrie)"), initval: Off,
        has_handler: No },
    { name: _("race"), section: OptS_Advanced, expectedbuf: PL_CSIZ, idx: opt_race,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: Yes, pfx: No, opt_in_out: opt_in,
        optfn: optfn_race, alias: NoAlias(),
                descr: _("your starting race (e.g., Human, Elf)"), initval: Off, has_handler: No },
    { name: _("gender"), section: OptS_Advanced, expectedbuf: 8, idx: opt_gender, setwhere: set_gameview,
        opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: Yes, pfx: No, opt_in_out: opt_in,
        optfn: optfn_gender, alias: NoAlias(),
                descr: _("your starting gender (male or female)"), initval: Off, has_handler: No },
    { name: _("alignment"), section: OptS_Advanced, expectedbuf: 8, idx: opt_alignment,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: Yes, pfx: No, opt_in_out: opt_in,
        optfn: optfn_alignment, alias: _("align"),
                descr: _("your starting alignment (lawful, neutral, or chaotic)"), initval: Off,
        has_handler: No },

    { name: _("accessiblemsg"), section: OptS_Advanced, idx: opt_accessiblemsg, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(a11y, "accessiblemsg")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("add location information to messages"), initval: Off },
    { name: _("acoustics"), section: OptS_Advanced, idx: opt_acoustics, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "acoustics")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("can your character hear anything"), initval: On },

    { name: _("align_message"), section: OptS_Advanced, expectedbuf: 20, idx: opt_align_message,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_align_message, alias: NoAlias(), descr: _("message window alignment"),
        initval: Off, has_handler: Yes },
    { name: _("align_status"), section: OptS_Advanced, expectedbuf: 20, idx: opt_align_status,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_align_status, alias: NoAlias(), descr: _("status window alignment"),
        initval: Off, has_handler: Yes },

    { name: _("altkeyhandling"), section: OptS_Advanced, expectedbuf: 20, idx: opt_altkeyhandling,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_altkeyhandling, alias: _("altkeyhandler"), descr: _("(not applicable)"),
        initval: Off, has_handler: Yes },

    { name: _("altmeta"), section: OptS_Advanced, idx: opt_altmeta, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(iflags, "altmeta")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("treat \"ESC c\" as M-c (Meta+c, 8th bit set)"), initval: Off },

    { name: _("armorstatus"), section: OptS_Advanced, idx: opt_armorstatus, setwhere: set_in_game,
        opttyp: BoolOpt,
                negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_in, addr: addr_of(ref_of(flags, "armorstatus")), optfn: optfn_boolean,
        alias: NoAlias(),
                descr: _("summarize currently worn armor in a status field"), initval: Off },
    { name: _("ascii_map"), section: OptS_Advanced, idx: opt_ascii_map, setwhere: set_in_game,
        opttyp: BoolOpt,
                negateok: Yes, valok: No, dupeok: No, pfx: No,
                termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "wc_ascii_map")), optfn: optfn_boolean, alias: NoAlias(),
        descr: _("show map as text"), initval: ascii_map_Def },
    { name: _("autocompletions"), section: OptS_Advanced, expectedbuf: BUFSZ, idx: opt_o_autocomplete,
                setwhere: set_in_game, opttyp: OthrOpt, negateok: No, valok: Yes, dupeok: No,
        pfx: No, opt_in_out: opt_in, optfn: optfn_o_autocomplete, alias: NoAlias(),
        descr: _("edit autocompletions"), initval: On, has_handler: On },
    { name: _("autodescribe"), section: OptS_Advanced, idx: opt_autodescribe, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(iflags, "autodescribe")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("describe terrain under cursor"), initval: On },
    { name: _("autodig"), section: OptS_Behavior, idx: opt_autodig, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(flags, "autodig")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("dig if moving and wielding a digging tool"), initval: Off },
    { name: _("autoopen"), section: OptS_Behavior, idx: opt_autoopen, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "autoopen")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("walking into a door attempts to open it"), initval: On },
    { name: _("autopickup"), section: OptS_Behavior, idx: opt_autopickup, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "pickup")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("automatically pick up objects"), initval: Off },
    { name: _("autopickup exceptions"), section: OptS_Behavior, expectedbuf: BUFSZ,
        idx: opt_o_autopickup_exceptions,
                setwhere: set_in_game, opttyp: OthrOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_o_autopickup_exceptions, alias: NoAlias(),
        descr: _("edit autopickup exceptions"), initval: On, has_handler: On },
    { name: _("autoquiver"), section: OptS_Behavior, idx: opt_autoquiver, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(flags, "autoquiver")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("fill empty quiver automatically when firing"), initval: Off },
    { name: _("autounlock"), section: OptS_Behavior, expectedbuf: 80, idx: opt_autounlock,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_out,
        optfn: optfn_autounlock, alias: NoAlias(),
                descr: _("action to take when encountering locked door or chest"), initval: Off,
        has_handler: Yes },
    { name: _("bgcolors"), section: OptS_Map, idx: opt_bgcolors, setwhere: set_in_game, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_Off, opt_in_out: opt_out,
        addr: addr_of(ref_of(iflags, "bgcolors")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("use background color for some map hilighting"), initval: On },
    { name: _("bind keys"), section: OptS_Advanced, expectedbuf: BUFSZ, idx: opt_o_bind_keys,
        setwhere: set_in_game, opttyp: OthrOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_o_bind_keys, alias: NoAlias(), descr: _("edit key binds"), initval: On,
        has_handler: On },

    { name: _("BIOS"), section: OptS_Advanced, idx: opt_BIOS, setwhere: set_in_config, opttyp: BoolOpt,
           negateok: No, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        optfn: optfn_boolean, alias: NoAlias(), initval: Off },

    { name: _("blind"), section: OptS_Advanced, idx: opt_blind, setwhere: set_in_config, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(u.uroleplay, "blind")), optfn: optfn_boolean, alias: _("permablind"),
           descr: _("your character is permanently blind"), initval: Off },
    { name: _("bones"), section: OptS_Advanced, idx: opt_bones, setwhere: set_in_config, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "bones")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("allow loading bones files"), initval: On },

    { name: _("boulder"), section: OptS_Advanced, expectedbuf: 1, idx: opt_boulder,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_boulder, alias: NoAlias(),
                descr: _("deprecated (use S_boulder in sym file instead)"), initval: Off,
        has_handler: No },

    { name: _("catname"), section: OptS_Advanced, expectedbuf: PL_PSIZ, idx: opt_catname,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_catname, alias: NoAlias(),
                descr: _("name of your starting pet if it is a kitten"), initval: Off,
        has_handler: No },

    { name: _("checkpoint"), section: OptS_Advanced, idx: opt_checkpoint, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "ins_chkpt")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("save game state after each level change"), initval: On },

    { name: _("cmdassist"), section: OptS_Behavior, idx: opt_cmdassist, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(iflags, "cmdassist")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("give help for errors on direction input"), initval: On },
    { name: _("color"), section: OptS_Map, idx: opt_color, setwhere: set_in_game, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "wc_color")), optfn: optfn_boolean, alias: _("colour"),
           descr: _("use color in map"), initval: On },
    { name: _("confirm"), section: OptS_Advanced, idx: opt_confirm, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "confirm")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("ask before hitting tame or peaceful monsters"), initval: On },

    { name: _("crash_email"), section: OptS_Advanced, expectedbuf: PL_NSIZ, idx: opt_crash_email,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_crash_email, alias: NoAlias(),
                descr: _("email address for reporting"), initval: Off, has_handler: No },
    { name: _("crash_name"), section: OptS_Advanced, expectedbuf: PL_NSIZ, idx: opt_crash_name,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_crash_name, alias: NoAlias(),
                descr: _("your name for reporting"), initval: Off, has_handler: No },
    { name: _("crash_urlmax"), section: OptS_Advanced, expectedbuf: PL_NSIZ, idx: opt_crash_urlmax,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_crash_urlmax, alias: NoAlias(),
                descr: _("length of longest url we can generate"), initval: Off, has_handler: No },

    { name: _("customcolors"), section: OptS_Map, idx: opt_customcolors, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No,
           termpref: Term_False, opt_in_out: opt_out,
        addr: addr_of(ref_of(iflags, "customcolors")), optfn: optfn_boolean,
        alias: _("customcolours"), descr: _("use custom colors in map"), initval: On },
    { name: _("customsymbols"), section: OptS_Map, idx: opt_customsymbols, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No,
           termpref: Term_False, opt_in_out: opt_out,
        addr: addr_of(ref_of(iflags, "customsymbols")), optfn: optfn_boolean,
        alias: _("customsymbols"), descr: _("use custom utf8 symbols in map"), initval: On },
    { name: _("dark_room"), section: OptS_Advanced, idx: opt_dark_room, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "dark_room")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("show floor outside line of sight differently"), initval: On },
    { name: _("deaf"), section: OptS_Advanced, idx: opt_deaf, setwhere: set_in_config, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(u.uroleplay, "deaf")), optfn: optfn_boolean, alias: _("permadeaf"),
           descr: _("your character is permanently deaf"), initval: Off },

    { name: _("DECgraphics"), section: OptS_Advanced, expectedbuf: 70, idx: opt_DECgraphics,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_DECgraphics, alias: NoAlias(),
                descr: _("load DECGraphics display symbols into symset"), initval: Off,
        has_handler: No },

    { name: _("debug_hunger"), section: OptS_Advanced, idx: opt_debug_hunger, setwhere: set_wiznofuz,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "debug_hunger")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("no hunger"), initval: Off },
    { name: _("debug_mongen"), section: OptS_Advanced, idx: opt_debug_mongen, setwhere: set_wiznofuz,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "debug_mongen")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("no random monster generation"), initval: Off },
    { name: _("debug_overwrite_stairs"), section: OptS_Advanced, idx: opt_debug_overwrite_stairs,
        setwhere: set_wiznofuz, opttyp: BoolOpt,
                negateok: Yes, valok: No, dupeok: No, pfx: No,
           termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "debug_overwrite_stairs")), optfn: optfn_boolean,
        alias: NoAlias(), descr: _("level generation can overwrite stairs"), initval: Off },
    { name: _("disclose"), section: OptS_Advanced,
        expectedbuf: (sizeof_member(flags, "end_disclose") * 2), idx: opt_disclose,
                setwhere: set_in_game, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_disclose, alias: NoAlias(),
                descr: _("the kinds of information to disclose at end of game"), initval: Off,
        has_handler: Yes },
    { name: _("dogname"), section: OptS_Advanced, expectedbuf: PL_PSIZ, idx: opt_dogname,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_dogname, alias: NoAlias(),
                descr: _("name of your starting pet if it is a little dog"), initval: Off,
        has_handler: No },
    { name: _("dropped_nopick"), section: OptS_Behavior, idx: opt_dropped_nopick, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "nopick_dropped")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("don't autopickup dropped items"), initval: On },
    { name: _("dungeon"), section: OptS_Advanced, expectedbuf: (MAXDCHARS + 1), idx: opt_dungeon,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_dungeon, alias: NoAlias(),
                descr: _("list of symbols to use in drawing the dungeon map"), initval: Off,
        has_handler: No },
    { name: _("effects"), section: OptS_Advanced, expectedbuf: (MAXECHARS + 1), idx: opt_effects,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_effects, alias: NoAlias(),
                descr: _("list of symbols to use in drawing special effects"), initval: Off,
        has_handler: No },
    { name: _("eight_bit_tty"), section: OptS_Advanced, idx: opt_eight_bit_tty, setwhere: set_in_game,
        opttyp: BoolOpt,
                negateok: Yes, valok: No, dupeok: No, pfx: No,
           termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "wc_eight_bit_input")), optfn: optfn_boolean,
        alias: NoAlias(), descr: _("send 8-bit characters directly to terminal"), initval: Off },
    { name: _("extmenu"), section: OptS_Advanced, idx: opt_extmenu, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "extmenu")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("use menu for getting extended commands"), initval: Off },
    { name: _("female"), section: OptS_Advanced, idx: opt_female, setwhere: set_in_config,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(flags, "female")), optfn: optfn_boolean, alias: _("male"),
           descr: _("deprecated; use gender:female"), initval: Off },
    { name: _("fireassist"), section: OptS_Behavior, idx: opt_fireassist, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(iflags, "fireassist")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("fire-command tries to be helpful"), initval: On },
    { name: _("fixinv"), section: OptS_Advanced, idx: opt_fixinv, setwhere: set_in_game, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "invlet_constant")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("inventory items keep their letters"), initval: On },
    { name: _("font_map"), section: OptS_Advanced, expectedbuf: 40, idx: opt_font_map,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: Yes, pfx: No, opt_in_out: opt_in,
        optfn: optfn_font_map, alias: NoAlias(), descr: _("font to use in the map window"),
        initval: Off, has_handler: No },
    { name: _("font_menu"), section: OptS_Advanced, expectedbuf: 40, idx: opt_font_menu,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: Yes, pfx: No, opt_in_out: opt_in,
        optfn: optfn_font_menu, alias: NoAlias(), descr: _("font to use in menus"), initval: Off,
        has_handler: No },
    { name: _("font_message"), section: OptS_Advanced, expectedbuf: 40, idx: opt_font_message,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: Yes, pfx: No, opt_in_out: opt_in,
        optfn: optfn_font_message, alias: NoAlias(),
                descr: _("font to use in the message window"), initval: Off, has_handler: No },
    { name: _("font_size_map"), section: OptS_Advanced, expectedbuf: 20, idx: opt_font_size_map,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: Yes, pfx: No, opt_in_out: opt_in,
        optfn: optfn_font_size_map, alias: NoAlias(), descr: _("size of the map font"),
        initval: Off, has_handler: No },
    { name: _("font_size_menu"), section: OptS_Advanced, expectedbuf: 20, idx: opt_font_size_menu,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: Yes, pfx: No, opt_in_out: opt_in,
        optfn: optfn_font_size_menu, alias: NoAlias(), descr: _("size of the menu font"),
        initval: Off, has_handler: No },
    { name: _("font_size_message"), section: OptS_Advanced, expectedbuf: 20, idx: opt_font_size_message,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: Yes, pfx: No, opt_in_out: opt_in,
        optfn: optfn_font_size_message, alias: NoAlias(), descr: _("size of the message font"),
        initval: Off, has_handler: No },
    { name: _("font_size_status"), section: OptS_Advanced, expectedbuf: 20, idx: opt_font_size_status,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: Yes, pfx: No, opt_in_out: opt_in,
        optfn: optfn_font_size_status, alias: NoAlias(), descr: _("size of the status font"),
        initval: Off, has_handler: No },
    { name: _("font_size_text"), section: OptS_Advanced, expectedbuf: 20, idx: opt_font_size_text,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: Yes, pfx: No, opt_in_out: opt_in,
        optfn: optfn_font_size_text, alias: NoAlias(), descr: _("size of the text font"),
        initval: Off, has_handler: No },
    { name: _("font_status"), section: OptS_Advanced, expectedbuf: 40, idx: opt_font_status,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: Yes, pfx: No, opt_in_out: opt_in,
        optfn: optfn_font_status, alias: NoAlias(), descr: _("font to use in status window"),
        initval: Off, has_handler: No },
    { name: _("font_text"), section: OptS_Advanced, expectedbuf: 40, idx: opt_font_text,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: Yes, pfx: No, opt_in_out: opt_in,
        optfn: optfn_font_text, alias: NoAlias(), descr: _("font to use in text windows"),
        initval: Off, has_handler: No },
    { name: _("force_invmenu"), section: OptS_Advanced, idx: opt_force_invmenu, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "force_invmenu")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("commands asking for inventory item show a menu"), initval: Off },
    { name: _("fruit"), section: OptS_General, expectedbuf: PL_FSIZ, idx: opt_fruit,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_fruit, alias: NoAlias(), descr: _("name of a fruit you enjoy eating"),
        initval: Off, has_handler: No },
    { name: _("fullscreen"), section: OptS_Advanced, idx: opt_fullscreen, setwhere: set_in_config,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "wc2_fullscreen")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("toggle fullscreen"), initval: Off },

    { name: _("glyph"), section: OptS_Advanced, expectedbuf: 40, idx: opt_glyph, setwhere: set_in_game,
        opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: Yes, pfx: No, opt_in_out: opt_in,
        optfn: optfn_glyph, alias: NoAlias(),
                descr: _("set representation of a glyph to a unicode value and color"),
        initval: Off, has_handler: No },
    { name: _("goldX"), section: OptS_Advanced, idx: opt_goldX, setwhere: set_in_game, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(flags, "goldX")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("classify gold as unknown or uncursed"), initval: Off },
    { name: _("guicolor"), section: OptS_Advanced, idx: opt_guicolor, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(iflags, "wc2_guicolor")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("use color for UI"), initval: On },
    { name: _("help"), section: OptS_Advanced, idx: opt_help, setwhere: set_in_game, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "help")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("show all available info when using whatis-command"), initval: On },
    { name: _("herecmd_menu"), section: OptS_Advanced, idx: opt_herecmd_menu, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "herecmd_menu")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("show commands available in this location"), initval: Off },

    { name: _("hilite_pet"), section: OptS_Map, idx: opt_hilite_pet, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "wc_hilite_pet")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("use highlight for pets"), initval: Off },
    { name: _("hilite_pile"), section: OptS_Map, idx: opt_hilite_pile, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "hilite_pile")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("highlight piles of items"), initval: Off },

    { name: _("hilite_status"), section: OptS_Advanced, expectedbuf: 13, idx: opt_hilite_status,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: Yes, pfx: No, opt_in_out: opt_out,
        optfn: optfn_hilite_status, alias: NoAlias(),
                descr: _("a status highlighting rule (can occur multiple times)"), initval: Off,
        has_handler: No },

    { name: _("hitpointbar"), section: OptS_Status, idx: opt_hitpointbar, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "wc2_hitpointbar")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("show colored bar for hit points"), initval: Off },
    { name: _("horsename"), section: OptS_Advanced, expectedbuf: PL_PSIZ, idx: opt_horsename,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_horsename, alias: NoAlias(),
                descr: _("name of your starting pet if it is a pony"), initval: Off,
        has_handler: No },

    { name: _("IBMgraphics"), section: OptS_Advanced, expectedbuf: 70, idx: opt_IBMgraphics,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_IBMgraphics, alias: NoAlias(),
                descr: _("load IBMGraphics display symbols into symset"), initval: Off,
        has_handler: No },

    { name: _("idlecheckpoint"), section: OptS_Advanced, idx: opt_idlecheckpoint, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_Off, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "idlecheckpoint")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("update checkpoint file if input is idle for 10 seconds"), initval: Off },

    { name: _("ignintr"), section: OptS_Advanced, idx: opt_ignintr, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(flags, "ignintr")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("ignore interrupt signals"), initval: Off },

    { name: _("implicit_uncursed"), section: OptS_Advanced, idx: opt_implicit_uncursed,
        setwhere: set_in_game, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "implicit_uncursed")),
        optfn: optfn_boolean, alias: NoAlias(),
           descr: _("omit \"uncursed\" from inventory"), initval: On },

    { name: _("legacy"), section: OptS_Advanced, idx: opt_legacy, setwhere: set_in_config,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "legacy")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("show introductory message"), initval: On },
    { name: _("lit_corridor"), section: OptS_Advanced, idx: opt_lit_corridor, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(flags, "lit_corridor")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("show dark corridors as lit if in sight"), initval: Off },
    { name: _("lootabc"), section: OptS_Advanced, idx: opt_lootabc, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(flags, "lootabc")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("use a/b/c rather than o/i/c when looting"), initval: Off },
    { name: _("mail"), section: OptS_Advanced, idx: opt_mail, setwhere: set_in_game, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "biff")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("enable the mail daemon"), initval: On },
    { name: _("map_mode"), section: OptS_Advanced, expectedbuf: 20, idx: opt_map_mode,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_map_mode, alias: NoAlias(), descr: _("map display mode under Windows"),
        initval: Off, has_handler: No },
    { name: _("mention_decor"), section: OptS_Advanced, idx: opt_mention_decor, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(flags, "mention_decor")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("give feedback when walking over interesting features"), initval: Off },
    { name: _("mention_map"), section: OptS_Advanced, idx: opt_mention_map, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(a11y, "glyph_updates")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("give feedback when interesting map locations change"), initval: Off },
    { name: _("mention_walls"), section: OptS_Advanced, idx: opt_mention_walls, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(flags, "mention_walls")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("give feedback when walking into walls"), initval: Off },
    { name: _("menu_deselect_all"), section: OptS_Advanced, expectedbuf: 4, idx: opt_menu_deselect_all,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_menu_deselect_all, alias: NoAlias(), descr: _("deselect all items in a menu"),
        initval: Off, has_handler: No },
    { name: _("menu_deselect_page"), section: OptS_Advanced, expectedbuf: 4, idx: opt_menu_deselect_page,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_menu_deselect_page, alias: NoAlias(),
                descr: _("deselect all items on this page of a menu"), initval: Off,
        has_handler: No },
    { name: _("menu_first_page"), section: OptS_Advanced, expectedbuf: 4, idx: opt_menu_first_page,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_menu_first_page, alias: NoAlias(),
        descr: _("jump to the first page in a menu"), initval: Off, has_handler: No },
    { name: _("menu_headings"), section: OptS_Advanced, expectedbuf: 4, idx: opt_menu_headings,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_menu_headings, alias: NoAlias(), descr: _("display style for menu headings"),
        initval: Off, has_handler: Yes },
    { name: _("menu_invert_all"), section: OptS_Advanced, expectedbuf: 4, idx: opt_menu_invert_all,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_menu_invert_all, alias: NoAlias(), descr: _("invert all items in a menu"),
        initval: Off, has_handler: No },
    { name: _("menu_invert_page"), section: OptS_Advanced, expectedbuf: 4, idx: opt_menu_invert_page,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_menu_invert_page, alias: NoAlias(),
                descr: _("invert all items on this page of a menu"), initval: Off, has_handler: No },
    { name: _("menu_last_page"), section: OptS_Advanced, expectedbuf: 4, idx: opt_menu_last_page,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_menu_last_page, alias: NoAlias(), descr: _("jump to the last page in a menu"),
        initval: Off, has_handler: No },
    { name: _("menu_next_page"), section: OptS_Advanced, expectedbuf: 4, idx: opt_menu_next_page,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_menu_next_page, alias: NoAlias(), descr: _("go to the next menu page"),
        initval: Off, has_handler: No },
    { name: _("menu_objsyms"), section: OptS_Advanced, expectedbuf: 12, idx: opt_menu_objsyms,
        setwhere: set_in_game, opttyp: CompOpt,
           negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_menu_objsyms, alias: _("use_menu_glyphs"),
           descr: _("show object symbols in menus"), initval: Off, has_handler: Yes },

    { name: _("menu_overlay"), section: OptS_Advanced, idx: opt_menu_overlay, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "menu_overlay")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("menus overlay and align to right"), initval: On },

    { name: _("menu_previous_page"), section: OptS_Advanced, expectedbuf: 4, idx: opt_menu_previous_page,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_menu_previous_page, alias: NoAlias(),
        descr: _("go to the previous menu page"), initval: Off, has_handler: No },
    { name: _("menu_search"), section: OptS_Advanced, expectedbuf: 4, idx: opt_menu_search,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_menu_search, alias: NoAlias(), descr: _("search for a menu item"),
        initval: Off, has_handler: No },
    { name: _("menu_select_all"), section: OptS_Advanced, expectedbuf: 4, idx: opt_menu_select_all,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_menu_select_all, alias: NoAlias(), descr: _("select all items in a menu"),
        initval: Off, has_handler: No },
    { name: _("menu_select_page"), section: OptS_Advanced, expectedbuf: 4, idx: opt_menu_select_page,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_menu_select_page, alias: NoAlias(),
                descr: _("select all items on this page of a menu"), initval: Off, has_handler: No },
    { name: _("menu_shift_left"), section: OptS_Advanced, expectedbuf: 4, idx: opt_menu_shift_left,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_menu_shift_left, alias: NoAlias(), descr: _("pan current menu page left"),
        initval: Off, has_handler: No },
    { name: _("menu_shift_right"), section: OptS_Advanced, expectedbuf: 4, idx: opt_menu_shift_right,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_menu_shift_right, alias: NoAlias(), descr: _("pan current menu page right"),
        initval: Off, has_handler: No },
    { name: _("menu_tab_sep"), section: OptS_Advanced, idx: opt_menu_tab_sep, setwhere: set_wizonly,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "menu_tab_sep")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("menu formatting"), initval: Off },
    { name: _("menucolors"), section: OptS_Advanced, idx: opt_menucolors, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: Yes, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_in, addr: addr_of(ref_of(iflags, "use_menu_color")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("use colors in menus"), initval: Off },
    { name: _("menu colors"), section: OptS_Status, expectedbuf: BUFSZ, idx: opt_o_menu_colors,
        setwhere: set_in_game, opttyp: OthrOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_o_menu_colors, alias: NoAlias(), descr: _("change colors used in menus"),
        initval: On, has_handler: On },
    { name: _("menuinvertmode"), section: OptS_Advanced, expectedbuf: 5, idx: opt_menuinvertmode,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_menuinvertmode, alias: NoAlias(),
                descr: _("experimental behavior of menu inverts"), initval: Off, has_handler: No },
    { name: _("menustyle"), section: OptS_Advanced, expectedbuf: MENUTYPELEN, idx: opt_menustyle,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_menustyle, alias: NoAlias(),
                descr: _("user interface for object selection"), initval: Off, has_handler: Yes },
    { name: _("message types"), section: OptS_Advanced, expectedbuf: BUFSZ, idx: opt_o_message_types,
                setwhere: set_in_game, opttyp: OthrOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_o_message_types, alias: NoAlias(), descr: _("edit message types"),
        initval: On, has_handler: On },
    { name: _("mon_movement"), section: OptS_Advanced, idx: opt_mon_movement, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(a11y, "mon_movement")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("message when hero sees monster movement"), initval: Off },
    { name: _("monpolycontrol"), section: OptS_Advanced, idx: opt_monpolycontrol, setwhere: set_wizonly,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "mon_polycontrol")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("control monster polymorphs"), initval: Off },
    { name: _("montelecontrol"), section: OptS_Advanced, idx: opt_montelecontrol, setwhere: set_wizonly,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "mon_telecontrol")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("control monster teleport destinations"), initval: Off },
    { name: _("monsters"), section: OptS_Advanced, expectedbuf: MAXMCLASSES, idx: opt_monsters,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_monsters, alias: NoAlias(),
                descr: _("list of symbols to use for monsters"), initval: Off, has_handler: No },
    { name: _("mouse_support"), section: OptS_Advanced, idx: opt_mouse_support, setwhere: set_in_game,
        opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_mouse_support, alias: NoAlias(),
                descr: _("game receives click info from mouse"), initval: Off, has_handler: No },

    { name: _("msg_window"), section: OptS_Advanced, expectedbuf: 1, idx: opt_msg_window,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_msg_window, alias: NoAlias(),
                descr: _("control of \"view previous message(s)\" (^P) behavior"), initval: Off,
        has_handler: Yes },

    { name: _("msghistory"), section: OptS_Advanced, expectedbuf: 5, idx: opt_msghistory,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_msghistory, alias: NoAlias(),
                descr: _("number of top line messages to save"), initval: Off, has_handler: No },

    { name: _("news"), section: OptS_Advanced, idx: opt_news, setwhere: set_in_config, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "news")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("show any news at game start"), initval: Off },

    { name: _("nudist"), section: OptS_Advanced, idx: opt_nudist, setwhere: set_in_config,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(u.uroleplay, "nudist")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("start your character without armor"), initval: Off },
    { name: _("null"), section: OptS_Advanced, idx: opt_null, setwhere: set_in_game, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "null")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("allow nulls to be sent to terminal"), initval: On },
    { name: _("number_pad"), section: OptS_General, expectedbuf: 1, idx: opt_number_pad,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_number_pad, alias: NoAlias(),
                descr: _("use the number pad for movement"), initval: Off, has_handler: Yes },
    { name: _("objects"), section: OptS_Advanced, expectedbuf: MAXOCLASSES, idx: opt_objects,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_objects, alias: NoAlias(),
                descr: _("list of symbols to use for objects"), initval: Off, has_handler: No },
    { name: _("packorder"), section: OptS_Advanced, expectedbuf: MAXOCLASSES, idx: opt_packorder,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_packorder, alias: NoAlias(),
                descr: _("the inventory order of the items in your pack"), initval: Off,
        has_handler: No },

    { name: _("paranoid_confirmation"), section: OptS_Advanced, expectedbuf: 28,
        idx: opt_paranoid_confirmation, setwhere: set_in_game, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: Yes, pfx: No, opt_in_out: opt_in,
        optfn: optfn_paranoid_confirmation, alias: _("prayconfirm"),
                descr: _("extra prompting in certain situations"), initval: Off, has_handler: Yes },
    { name: _("pauper"), section: OptS_Advanced, idx: opt_pauper, setwhere: set_in_config,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(u.uroleplay, "pauper")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("start your character without any items"), initval: Off },
    { name: _("perm_invent"), section: OptS_Advanced, idx: opt_perm_invent, setwhere: set_in_game,
        opttyp: BoolOpt,
                negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_Off,
        opt_in_out: opt_in, addr: addr_of(ref_of(iflags, "perm_invent")), optfn: optfn_boolean,
        alias: NoAlias(),
                descr: _("show persistent inventory window"), initval: Off },
    { name: _("perminv_mode"), section: OptS_Advanced, expectedbuf: 20, idx: opt_perminv_mode,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_perminv_mode, alias: NoAlias(),
                descr: _("what to show in persistent inventory window"), initval: Off,
        has_handler: Yes },
    { name: _("petattr"), section: OptS_Advanced, expectedbuf: 88, idx: opt_petattr,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_petattr, alias: NoAlias(), descr: _("attributes for highlighting pets"),
        initval: Off, has_handler: Yes },

    { name: _("pettype"), section: OptS_Advanced, expectedbuf: 4, idx: opt_pettype,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_pettype, alias: _("pet"), descr: _("your preferred initial pet type"),
        initval: Off, has_handler: No },
    { name: _("pickup_burden"), section: OptS_Advanced, expectedbuf: 20, idx: opt_pickup_burden,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_pickup_burden, alias: NoAlias(),
                descr: _("maximum burden picked up before prompt"), initval: Off, has_handler: Yes },
    { name: _("pickup_stolen"), section: OptS_Behavior, idx: opt_pickup_stolen, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "pickup_stolen")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("autopickup stolen items"), initval: On },
    { name: _("pickup_thrown"), section: OptS_Behavior, idx: opt_pickup_thrown, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "pickup_thrown")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("autopickup thrown items"), initval: On },
    { name: _("pickup_types"), section: OptS_Behavior, expectedbuf: MAXOCLASSES, idx: opt_pickup_types,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_pickup_types, alias: NoAlias(),
                descr: _("types of objects to pick up automatically"), initval: Off,
        has_handler: Yes },
    { name: _("pile_limit"), section: OptS_Advanced, expectedbuf: 24, idx: opt_pile_limit,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_pile_limit, alias: NoAlias(),
                descr: _("threshold for \"there are many objects here\""), initval: Off,
        has_handler: No },
    { name: _("player_selection"), section: OptS_Advanced, expectedbuf: 12, idx: opt_player_selection,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_player_selection, alias: NoAlias(),
                descr: _("choose character via dialog or prompts"), initval: Off, has_handler: No },

    { name: _("popup_dialog"), section: OptS_Advanced, idx: opt_popup_dialog, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "wc_popup_dialog")), optfn: optfn_boolean, alias: NoAlias(),
        initval: Off },
    { name: _("preload_tiles"), section: OptS_Advanced, idx: opt_preload_tiles, setwhere: set_in_config,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(iflags, "wc_preload_tiles")),
        optfn: optfn_boolean, alias: NoAlias(), initval: On },
    { name: _("price_quotes"), section: OptS_General, idx: opt_price_quotes, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "pricequotes")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("display prices you have seen for unidentified objects"), initval: Off },
    { name: _("pushweapon"), section: OptS_Behavior, idx: opt_pushweapon, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(flags, "pushweapon")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("previous weapon goes to secondary slot"), initval: Off },
    { name: _("query_menu"), section: OptS_Advanced, idx: opt_query_menu, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "query_menu")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("use a menu for yes/no queries"), initval: Off },
    { name: _("quick_farsight"), section: OptS_Advanced, idx: opt_quick_farsight, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(flags, "quick_farsight")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("skip map browse when forced to looked at map"), initval: Off },

    { name: _("rawio"), section: OptS_Advanced, idx: opt_rawio, setwhere: set_in_config, opttyp: BoolOpt,
           negateok: No, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        optfn: optfn_boolean, alias: NoAlias(), initval: Off },

    { name: _("reroll"), section: OptS_Advanced, idx: opt_reroll, setwhere: set_in_config,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(u.uroleplay, "reroll")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("allow rerolling of starting inventory and items"), initval: Off },
    { name: _("rest_on_space"), section: OptS_Advanced, idx: opt_rest_on_space, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(flags, "rest_on_space")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("space bar is bound to the rest-command"), initval: Off },
    { name: _("roguesymset"), section: OptS_Advanced, expectedbuf: 70, idx: opt_roguesymset,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_roguesymset, alias: NoAlias(),
                descr: _("load a set of rogue display symbols from symbols file"), initval: Off,
        has_handler: Yes },

    { name: _("runmode"), section: OptS_Advanced, expectedbuf: sizeof_string("teleport"),
        idx: opt_runmode, setwhere: set_in_game, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_runmode, alias: NoAlias(),
                descr: _("display frequency when `running' or `travelling'"), initval: Off,
        has_handler: Yes },
    { name: _("safe_pet"), section: OptS_Advanced, idx: opt_safe_pet, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "safe_dog")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("prevent you from hitting pets"), initval: On },
    { name: _("safe_wait"), section: OptS_Advanced, idx: opt_safe_wait, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "safe_wait")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("prevent waiting next to hostiles"), initval: On },
    { name: _("sanity_check"), section: OptS_Advanced, idx: opt_sanity_check, setwhere: set_wizonly,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "sanity_check")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("perform data sanity checks"), initval: Off },
    { name: _("scores"), section: OptS_Advanced, expectedbuf: 32, idx: opt_scores, setwhere: set_in_game,
        opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_scores, alias: NoAlias(),
                descr: _("the parts of the score list you wish to see"), initval: Off,
        has_handler: No },
    { name: _("scroll_amount"), section: OptS_Advanced, expectedbuf: 20, idx: opt_scroll_amount,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_scroll_amount, alias: NoAlias(),
                descr: _("amount to scroll map when scroll_margin is reached"), initval: Off,
        has_handler: No },
    { name: _("scroll_margin"), section: OptS_Advanced, expectedbuf: 20, idx: opt_scroll_margin,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_scroll_margin, alias: NoAlias(),
                descr: _("scroll map when this far from the edge"), initval: Off, has_handler: No },
    { name: _("selectsaved"), section: OptS_Advanced, idx: opt_selectsaved, setwhere: set_in_config,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(iflags, "wc2_selectsaved")),
        optfn: optfn_boolean, alias: NoAlias(), initval: On },
    { name: _("showdamage"), section: OptS_Advanced, idx: opt_showdamage, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "showdamage")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("show damage hero takes in message line"), initval: Off },
    { name: _("showexp"), section: OptS_Status, idx: opt_showexp, setwhere: set_in_game, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(flags, "showexp")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("show experience points in status line"), initval: Off },
    { name: _("showrace"), section: OptS_Map, idx: opt_showrace, setwhere: set_in_game, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(flags, "showrace")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("show your character by race rather than role"), initval: Off },

    { name: _("showscore"), section: OptS_Status, idx: opt_showscore, setwhere: set_in_config,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        optfn: optfn_boolean, alias: NoAlias(), initval: Off },

    { name: _("showvers"), section: OptS_Advanced, idx: opt_showvers, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(flags, "showvers")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("show version info on status line"), initval: Off },
    { name: _("silent"), section: OptS_Advanced, idx: opt_silent, setwhere: set_in_game, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "silent")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("don't use terminal bell"), initval: On },
    { name: _("softkeyboard"), section: OptS_Advanced, idx: opt_softkeyboard, setwhere: set_in_config,
        opttyp: BoolOpt,
                negateok: Yes, valok: No, dupeok: No, pfx: No,
           termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "wc2_softkeyboard")), optfn: optfn_boolean, alias: NoAlias(),
        initval: Off },
    { name: _("sortdiscoveries"), section: OptS_Advanced, idx: opt_sortdiscoveries,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_sortdiscoveries, alias: NoAlias(),
                descr: _("preferred order when displaying discovered objects"), initval: Off,
        has_handler: Yes },
    { name: _("sortloot"), section: OptS_Advanced, expectedbuf: 4, idx: opt_sortloot,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_sortloot, alias: NoAlias(),
                descr: _("sort object selection lists by description"), initval: Off,
        has_handler: Yes },
    { name: _("sortpack"), section: OptS_Advanced, idx: opt_sortpack, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "sortpack")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("group inventory items by type"), initval: On },
    { name: _("sortvanquished"), section: OptS_Advanced, idx: opt_sortvanquished, setwhere: set_in_game,
        opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_sortvanquished, alias: NoAlias(),
                descr: _("preferred order when displaying vanquished monsters"), initval: Off,
        has_handler: Yes },
    { name: _("soundlib"), section: OptS_Advanced, expectedbuf: WINTYPELEN, idx: opt_soundlib,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_soundlib, alias: NoAlias(),
                descr: _("soundlib interface to use (if any)"), initval: Off, has_handler: No },

    { name: _("sounds"), section: OptS_Advanced, idx: opt_sounds, setwhere: set_in_game, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_Off, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "sounds")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("use sounds"), initval: Off },

    { name: _("sparkle"), section: OptS_Map, idx: opt_sparkle, setwhere: set_in_game, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "sparkle")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("display sparkly effect when resisting magic"), initval: On },
    { name: _("spot_monsters"), section: OptS_Advanced, idx: opt_spot_monsters, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(a11y, "mon_notices")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("message when hero spots a monster"), initval: Off },
    { name: _("splash_screen"), section: OptS_Advanced, idx: opt_splash_screen, setwhere: set_in_config,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(iflags, "wc_splash_screen")),
        optfn: optfn_boolean, alias: NoAlias(), initval: On },
    { name: _("standout"), section: OptS_Advanced, idx: opt_standout, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(flags, "standout")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("use standout for --more--"), initval: Off },
    { name: _("status_updates"), section: OptS_Advanced, idx: opt_status_updates,
        setwhere: set_in_config, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(iflags, "status_updates")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("allow the status lines to update"), initval: On },
    { name: _("status condition fields"), section: OptS_Status, expectedbuf: BUFSZ,
        idx: opt_o_status_cond,
                setwhere: set_in_game, opttyp: OthrOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_o_status_cond, alias: NoAlias(),
        descr: _("change status condition highlighting"), initval: On, has_handler: On },

    { name: _("statushilites"), section: OptS_Advanced, expectedbuf: 20, idx: opt_statushilites,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: Yes, pfx: No, opt_in_out: opt_in,
        optfn: optfn_statushilites, alias: NoAlias(),
                descr: _("0=no status highlighting, N=show highlights for N turns"), initval: Off,
        has_handler: No },
    { name: _("status highlight rules"), section: OptS_Status, expectedbuf: BUFSZ,
        idx: opt_o_status_hilites,
                setwhere: set_in_game, opttyp: OthrOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_o_status_hilites, alias: NoAlias(),
        descr: _("change status line highlighting"), initval: On, has_handler: On },

    { name: _("statuslines"), section: OptS_Status, expectedbuf: 20, idx: opt_statuslines,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_statuslines, alias: NoAlias(), descr: _("2 or 3 lines for status display"),
        initval: Off, has_handler: No },

    { name: _("suppress_alert"), section: OptS_Advanced, expectedbuf: 8, idx: opt_suppress_alert,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: Yes, pfx: No, opt_in_out: opt_in,
        optfn: optfn_suppress_alert, alias: NoAlias(),
                descr: _("suppress alerts about version-specific features"), initval: Off,
        has_handler: No },
    { name: _("symset"), section: OptS_Map, expectedbuf: 70, idx: opt_symset, setwhere: set_in_game,
        opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_symset, alias: NoAlias(),
                descr: _("load a set of display symbols from symbols file"), initval: Off,
        has_handler: Yes },
    { name: _("term_cols"), section: OptS_Advanced, expectedbuf: 6, idx: opt_term_cols,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_term_cols, alias: _("termcolumns"), descr: _("number of columns"),
        initval: Off, has_handler: No },
    { name: _("term_rows"), section: OptS_Advanced, expectedbuf: 6, idx: opt_term_rows,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_term_rows, alias: NoAlias(), descr: _("number of rows"), initval: Off,
        has_handler: No },
    { name: _("terrainstatus"), section: OptS_Advanced, idx: opt_terrainstatus, setwhere: set_in_game,
        opttyp: BoolOpt,
                negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_in, addr: addr_of(ref_of(flags, "terrainstatus")), optfn: optfn_boolean,
        alias: NoAlias(),
                descr: _("show hero's location as a status field"), initval: Off },
    { name: _("tile_file"), section: OptS_Advanced, expectedbuf: 70, idx: opt_tile_file,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_tile_file, alias: NoAlias(), descr: _("name of tile file"), initval: Off,
        has_handler: No },
    { name: _("tile_height"), section: OptS_Advanced, expectedbuf: 20, idx: opt_tile_height,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_tile_height, alias: NoAlias(), descr: _("height of tiles"), initval: Off,
        has_handler: No },
    { name: _("tile_width"), section: OptS_Advanced, expectedbuf: 20, idx: opt_tile_width,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_tile_width, alias: NoAlias(), descr: _("width of tiles"), initval: Off,
        has_handler: No },
    { name: _("tiled_map"), section: OptS_Advanced, idx: opt_tiled_map, setwhere: set_in_game,
        opttyp: BoolOpt,
                negateok: Yes, valok: No, dupeok: No, pfx: No,
           termpref: Term_False, opt_in_out: opt_in, addr: addr_of(ref_of(iflags, "wc_tiled_map")),
        optfn: optfn_boolean, alias: NoAlias(), initval: tiled_map_Def },
    { name: _("time"), section: OptS_Status, idx: opt_time, setwhere: set_in_game, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(flags, "time")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("display game turns in status line"), initval: Off },

    { name: _("timed_delay"), section: OptS_Map, idx: opt_timed_delay, setwhere: set_in_config,
        opttyp: BoolOpt,
           negateok: No, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        optfn: optfn_boolean, alias: NoAlias(), initval: Off },

    { name: _("tips"), section: OptS_Advanced, idx: opt_tips, setwhere: set_in_game, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "tips")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("show some helpful tips during gameplay"), initval: On },
    { name: _("tombstone"), section: OptS_Advanced, idx: opt_tombstone, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "tombstone")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("show tombstone when your character dies"), initval: On },
    { name: _("toptenwin"), section: OptS_Advanced, idx: opt_toptenwin, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "toptenwin")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("show top scores in window"), initval: Off },
    { name: _("traps"), section: OptS_Advanced, expectedbuf: (MAXTCHARS + 1), idx: opt_traps,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_traps, alias: NoAlias(),
                descr: _("list of symbols to use in drawing traps"), initval: Off, has_handler: No },
    { name: _("travel"), section: OptS_Advanced, idx: opt_travel, setwhere: set_in_game, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "travelcmd")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("enable traveling via mouse click"), initval: On },

    { name: _("travel_debug"), section: OptS_Advanced, idx: opt_travel_debug, setwhere: set_wizonly,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(iflags, "trav_debug")), optfn: optfn_boolean,
        alias: NoAlias(), initval: Off },

    { name: _("tutorial"), section: OptS_Advanced, idx: opt_tutorial, setwhere: set_in_config,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "tutorial")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("ask if you want the tutorial"), initval: On },
    { name: _("use_darkgray"), section: OptS_Advanced, idx: opt_use_darkgray, setwhere: set_in_config,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(iflags, "wc2_darkgray")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("use bold black color instead of blue"), initval: On },
    { name: _("use_inverse"), section: OptS_Advanced, idx: opt_use_inverse, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(iflags, "wc_inverse")), optfn: optfn_boolean,
        alias: NoAlias(),
           descr: _("display detected monsters in inverse"), initval: On },
    { name: _("use_truecolor"), section: OptS_Advanced, idx: opt_use_truecolor, setwhere: set_in_config,
        opttyp: BoolOpt,
                negateok: Yes, valok: No, dupeok: No, pfx: No,
           termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "use_truecolor")), optfn: optfn_boolean,
        alias: _("use_truecolour"), initval: Off },
    { name: _("vary_msgcount"), section: OptS_Advanced, expectedbuf: 20, idx: opt_vary_msgcount,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_vary_msgcount, alias: NoAlias(), descr: _("show more old messages at a time"),
        initval: Off, has_handler: No },
    { name: _("verbose"), section: OptS_Advanced, idx: opt_verbose, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_out, addr: addr_of(ref_of(flags, "verbose")), optfn: optfn_boolean,
        alias: NoAlias(), initval: On },
    { name: _("versinfo"), section: OptS_Advanced, expectedbuf: 80, idx: opt_versinfo,
        setwhere: set_in_game, opttyp: CompOpt,
           negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_out,
        optfn: optfn_versinfo, alias: NoAlias(), descr: _("extra information for 'showvers'"),
        initval: Off, has_handler: Yes },

    { name: _("voices"), section: OptS_Advanced, idx: opt_voices, setwhere: set_gameview,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_Excluded,
        opt_in_out: opt_in, addr: addr_of(ref_of(iflags, "voices")), optfn: optfn_boolean,
        alias: NoAlias(), initval: Off },

    { name: _("vt_tiledata"), section: OptS_Advanced, idx: opt_vt_tiledata, setwhere: set_in_config,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        optfn: optfn_boolean, alias: NoAlias(), initval: Off },

    { name: _("vt_sounddata"), section: OptS_Advanced, idx: opt_vt_sounddata, setwhere: set_in_config,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        optfn: optfn_boolean, alias: NoAlias(), initval: Off },

    { name: _("warnings"), section: OptS_Advanced, expectedbuf: 10, idx: opt_warnings,
        setwhere: set_in_config, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_warnings, alias: NoAlias(), descr: _("display characters for warnings"),
        initval: Off, has_handler: No },
    { name: _("weaponstatus"), section: OptS_Advanced, idx: opt_weaponstatus, setwhere: set_in_game,
        opttyp: BoolOpt,
                negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False,
        opt_in_out: opt_in, addr: addr_of(ref_of(flags, "weaponstatus")), optfn: optfn_boolean,
        alias: NoAlias(),
                descr: _("show currently wielded weapon in a status field"), initval: Off },
    { name: _("whatis_coord"), section: OptS_Advanced, expectedbuf: 1, idx: opt_whatis_coord,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_whatis_coord, alias: NoAlias(),
                descr: _("show coordinates when auto-describing cursor position"), initval: Off,
        has_handler: Yes },
    { name: _("whatis_filter"), section: OptS_Advanced, expectedbuf: 1, idx: opt_whatis_filter,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_whatis_filter, alias: NoAlias(),
                descr: _("filter coordinate locations when targeting next or previous"),
        initval: Off, has_handler: Yes },
    { name: _("whatis_menu"), section: OptS_Advanced, idx: opt_whatis_menu, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "getloc_usemenu")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("show menu when getting a map location"), initval: Off },
    { name: _("whatis_moveskip"), section: OptS_Advanced, idx: opt_whatis_moveskip,
        setwhere: set_in_game, opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "getloc_moveskip")), optfn: optfn_boolean, alias: NoAlias(),
           descr: _("skip same glyph when getting map location"), initval: Off },
    { name: _("windowborders"), section: OptS_Advanced, expectedbuf: 9, idx: opt_windowborders,
        setwhere: set_in_game, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: No, pfx: No, opt_in_out: opt_in,
        optfn: optfn_windowborders, alias: NoAlias(), descr: _("0 (off), 1 (on), 2 (auto)"),
        initval: Off, has_handler: Yes },

    { name: _("windowcolors"), section: OptS_Advanced, expectedbuf: 80, idx: opt_windowcolors,
        setwhere: set_gameview, opttyp: CompOpt,
                negateok: No, valok: Yes, dupeok: Yes, pfx: No, opt_in_out: opt_in,
        optfn: optfn_windowcolors, alias: NoAlias(),
                descr: _("the foreground/background colors of windows"), initval: Off,
        has_handler: No },

    { name: _("wizmgender"), section: OptS_Advanced, idx: opt_wizmgender, setwhere: set_wizonly,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "wizmgender")), optfn: optfn_boolean, alias: NoAlias(),
        initval: Off },
    { name: _("wizweight"), section: OptS_Advanced, idx: opt_wizweight, setwhere: set_wizonly,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "wizweight")), optfn: optfn_boolean, alias: NoAlias(),
        initval: Off },
    { name: _("wraptext"), section: OptS_Advanced, idx: opt_wraptext, setwhere: set_in_game,
        opttyp: BoolOpt,
           negateok: Yes, valok: No, dupeok: No, pfx: No, termpref: Term_False, opt_in_out: opt_in,
        addr: addr_of(ref_of(iflags, "wc2_wraptext")), optfn: optfn_boolean, alias: NoAlias(),
        initval: Off },

    { name: _("cond_"), section: OptS_Advanced, idx: pfx_cond_, setwhere: set_hidden, opttyp: CompOpt,
                negateok: Yes, valok: No, dupeok: Yes, pfx: Yes, opt_in_out: opt_in,
        optfn: pfxfn_cond_, alias: NoAlias(), descr: _("prefix for cond_ options"),
        prefixgw: _("cond_"), initval: Off, has_handler: Yes },
    { name: _("font"), section: OptS_Advanced, idx: pfx_font, setwhere: set_hidden, opttyp: CompOpt,
                negateok: Yes, valok: Yes, dupeok: Yes, pfx: Yes, opt_in_out: opt_in,
        optfn: pfxfn_font, alias: NoAlias(), descr: _("prefix for font options"),
        prefixgw: _("font"), initval: Off, has_handler: No },
    ];
}
