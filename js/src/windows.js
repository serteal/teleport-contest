/* NetHack 5.0	windows.c	$NHDT-Date: 1737345149 2025/01/19 19:52:29 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.138 $ */
/* Copyright (c) D. Cohrs, 1993. */
/* NetHack may be freely redistributed.  See license for details. */

/* #ifdef WINCHAIN: not in this build */

export const windowprocs = static_struct("windowprocs", struct_window_procs);

 const struct_win_choices = struct("struct_win_choices", {
    procs: ptr_to("struct_window_procs"),
    ini_routine: fnptr_t,
}); const winchoices = static_array("winchoices", struct_win_choices, null, [

    { procs: tty_procs, ini_routine: win_tty_init },

    {} /* must be last */
]);

/* #ifdef WINCHAIN: not in this build */

export function genl_can_suspend_no() { /* boolean */
    return FALSE;
}

export function genl_can_suspend_yes() { /* boolean */
    return TRUE;
}

function def_raw_print(s) { /* void */
    puts(s);
    if (chars[s])
        iflags.raw_printed++;
}

function def_wait_synch() { /* void */
    /* Config file error handling routines
     * call wait_sync() without checking to
     * see if it actually has a value,
     * leading to spectacular violations
     * when you try to execute address zero.
     * The existence of this allows early
     * processing to have something to execute
     * even though it essentially does nothing
     */
     return;
}

export function check_tty_wincap(wincap) { /* boolean */
    let wc = win_choices_find(_("tty"));

    if (wc)
        return +(and64u(wc.procs.wincap, wincap) == wincap);
    return FALSE;
}

export function check_tty_wincap2(wincap2) { /* boolean */
    let wc = win_choices_find(_("tty"));

    if (wc)
        return +(and64u(wc.procs.wincap2, wincap2) == wincap2);
    return FALSE;
}

function win_choices_find(s) { /* struct win_choices * */
    let i;

    for (i = 0; winchoices[i].procs; i++) {
        if (!strcmpi(s, winchoices[i].procs.name)) {
            return winchoices[i];
        }
    }
    return null;
}

export function choose_windows(s) { /* void */
    const $frame = stack_frame(); try {
    let i;
    let tmps = 0;

    for (i = 0; winchoices[i].procs; i++) {
        if (ord('+') == chars[winchoices[i].procs.name + 0])
            continue;
        if (ord('-') == chars[winchoices[i].procs.name + 0])
            continue;
        if (!strcmpi(s, winchoices[i].procs.name)) {
            struct_assign(windowprocs, winchoices[i].procs);

            if (gl.last_winchoice && gl.last_winchoice.ini_routine)
                gl.last_winchoice.ini_routine(WININIT_UNDO);
            if (winchoices[i].ini_routine)
                (winchoices[i].ini_routine)(WININIT);
            gl.last_winchoice = winchoices[i];
            return;
        }
    }

    if (!windowprocs.win_raw_print)
        windowprocs.win_raw_print = def_raw_print;
    if (!windowprocs.win_wait_synch)
        /* early config file error processing routines call this */
        windowprocs.win_wait_synch = def_wait_synch;

    if (!winchoices[0].procs) {
        raw_printf(_("No window types supported?"));
        nh_terminate(EXIT_FAILURE);
    }
    /* 50: arbitrary, no real window_type names are anywhere near that long;
       used to prevent potential raw_printf() overflow if user supplies a
       very long string (on the order of 1200 chars) on the command line
       (config file options can't get that big; they're truncated at 1023) */

    if (strlen(s) >= WINDOW_TYPE_MAXLEN) {
        tmps = addr_of(alloc(WINDOW_TYPE_MAXLEN));
        strncpy(tmps, s, WINDOW_TYPE_MAXLEN - 1);
        chars[tmps + (WINDOW_TYPE_MAXLEN - 1)] = ord('\0');
        s = tmps;
    }

    if (!winchoices[1].procs) {
        config_error_add(
                     _("Window type %s not recognized.  The only choice is: %s"),
                         s, winchoices[0].procs.name);
    } else {
        let buf = stack_array(char, BUFSZ);
        let first = TRUE;

        chars[buf + 0] = ord('\0');
        for (i = 0; winchoices[i].procs; i++) {
            if (ord('+') == chars[winchoices[i].procs.name + 0])
                continue;
            if (ord('-') == chars[winchoices[i].procs.name + 0])
                continue;
            sprintf(eos(buf), _("%s%s"), first ? _("") : _(", "), winchoices[i].procs.name)
;
            first = FALSE;
        }
        config_error_add(_("Window type %s not recognized.  Choices are:  %s"),
                         s, buf);
    }
    if (tmps)
        free(tmps) /*, tmps = 0*/ ;

    if (windowprocs.win_raw_print == def_raw_print)
        nh_terminate(EXIT_SUCCESS);
    } finally { stack_pop($frame); }
}
export const WINDOW_TYPE_MAXLEN = 50;

/* #ifdef WINCHAIN: not in this build */

/*
 * tty_message_menu() provides a means to get feedback from the
 * --More-- prompt; other interfaces generally don't need that.
 */
/*ARGSUSED*/
export function genl_message_menu(let_,
                  how,
                  mesg) { /* char */
    pline(_("%s"), mesg);
    return 0;
}

/*ARGSUSED*/
export function genl_preference_update(pref) { /* void */
    /* window ports are expected to provide
       their own preference update routine
       for the preference capabilities that
       they support.
       Just return in this genl one. */
    return;
}

export function genl_getmsghistory(init) { /* char * */
    /* window ports can provide
       their own getmsghistory() routine to
       preserve message history between games.
       The routine is called repeatedly from
       the core save routine, and the window
       port is expected to successively return
       each message that it wants saved, starting
       with the oldest message first, finishing
       with the most recent.
       Return null pointer when finished.
     */
    return 0;
}

export function genl_putmsghistory(msg, is_restoring) { /* void */
    /* window ports can provide
       their own putmsghistory() routine to
       load message history from a saved game.
       The routine is called repeatedly from
       the core restore routine, starting with
       the oldest saved message first, and
       finishing with the latest.
       The window port routine is expected to
       load the message recall buffers in such
       a way that the ordering is preserved.
       The window port routine should make no
       assumptions about how many messages are
       forthcoming, nor should it assume that
       another message will follow this one,
       so it should keep all pointers/indexes
       intact at the end of each call.
    */

    /* this doesn't provide for reloading the message window with the
       previous session's messages upon restore, but it does put the quest
       message summary lines there by treating them as ordinary messages */
    if (!is_restoring)
        pline(_("%s"), msg);
    return;
}

/*
 * Dummy windowing scheme used to replace current one with no-ops
 * in order to avoid all terminal I/O after hangup/disconnect.
 */

const hup_procs = static_struct("hup_procs", struct_window_procs, { name: _("hup"), wp_id: wp_hup,
    has_color: [ FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
      FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE ],
    win_init_nhwindows: hup_init_nhwindows,
    win_player_selection: hup_void_ndecl,
    win_askname: hup_void_ndecl,
    win_get_nh_event: hup_void_ndecl,
    win_exit_nhwindows: hup_exit_nhwindows, win_suspend_nhwindows: hup_void_fdecl_constchar_p,
    win_resume_nhwindows: hup_void_ndecl,
    win_create_nhwindow: hup_create_nhwindow, win_clear_nhwindow: hup_void_fdecl_winid,
    win_display_nhwindow: hup_display_nhwindow, win_destroy_nhwindow: hup_void_fdecl_winid,
    win_curs: hup_curs, win_putstr: hup_putstr, win_putmixed: hup_putstr,
    win_display_file: hup_display_file, win_start_menu: hup_void_fdecl_winid_ulong,
    win_add_menu: hup_add_menu, win_end_menu: hup_end_menu, win_select_menu: hup_select_menu, win_message_menu: genl_message_menu,
    win_mark_synch: hup_void_ndecl,
    win_wait_synch: hup_void_ndecl,
    win_cliparound: hup_cliparound,
    win_print_glyph: hup_print_glyph,
    win_raw_print: hup_void_fdecl_constchar_p,
    win_raw_print_bold: hup_void_fdecl_constchar_p,
    win_nhgetch: hup_nhgetch, win_nh_poskey: hup_nh_poskey, win_nhbell: hup_void_ndecl,
    win_doprev_message: hup_int_ndecl,
    win_yn_function: hup_yn_function, win_getlin: hup_getlin, win_get_ext_cmd: hup_int_ndecl,
    win_number_pad: hup_void_fdecl_int,
    win_delay_output: hup_void_ndecl,
    win_outrip: hup_outrip, win_preference_update: genl_preference_update, win_getmsghistory: genl_getmsghistory,
    win_putmsghistory: genl_putmsghistory,
    win_status_init: hup_void_ndecl,
    win_status_finish: hup_void_ndecl,
    win_status_enablefield: genl_status_enablefield, win_status_update: hup_status_update,
    win_can_suspend: genl_can_suspend_no,
    win_update_inventory: hup_void_fdecl_int,
    win_ctrl_nhwindow: hup_ctrl_nhwindow });

const previnterface_exit_nhwindows = static_var("previnterface_exit_nhwindows", fnptr_t, null);

/* hangup has occurred; switch to no-op user interface */
export function nhwindows_hangup() { /* void */
    let previnterface_getmsghistory = null;

    /* command processor shouldn't look for 2nd char after seeing ESC */
    iflags.altmeta = FALSE;

    /* don't call exit_nhwindows() directly here; if a hangup occurs
       while interface code is executing, exit_nhwindows could knock
       the interface's active data structures out from under itself */
    if (iflags.window_inited
        && windowprocs.win_exit_nhwindows != hup_exit_nhwindows)
        previnterface_exit_nhwindows[0] = windowprocs.win_exit_nhwindows;

    /* also, we have to leave the old interface's getmsghistory()
       in place because it will be called while saving the game */
    if (windowprocs.win_getmsghistory != hup_procs.win_getmsghistory)
        previnterface_getmsghistory = windowprocs.win_getmsghistory;

    struct_assign(windowprocs, hup_procs);

    if (previnterface_getmsghistory)
        windowprocs.win_getmsghistory = previnterface_getmsghistory;
}

function hup_exit_nhwindows(lastgasp) { /* void */
    /* core has called exit_nhwindows(); call the previous interface's
       shutdown routine now; xxx_exit_nhwindows() needs to call other
       xxx_ routines directly rather than through windowprocs pointers */
    if (previnterface_exit_nhwindows[0]) {
        lastgasp = 0; /* don't want exit routine to attempt extra output */
        (previnterface_exit_nhwindows[0])(lastgasp);
        previnterface_exit_nhwindows[0] = null;
    }
    iflags.window_inited = FALSE;
}

function hup_nhgetch() { /* int */
    return ord('\x1b'); /* ESC */
}

/*ARGSUSED*/
function hup_yn_function(
    prompt,
    resp,
    deflt) { /* char */
    if (!deflt)
        deflt = ord('\x1b');
    return deflt;
}

/*ARGSUSED*/
function hup_nh_poskey(x, y, mod) { /* int */
    return ord('\x1b');
}

/*ARGSUSED*/
function hup_getlin(prompt, outbuf) { /* void */
    strcpy(outbuf, _("\x1b"));
}

/*ARGSUSED*/
function hup_init_nhwindows(argc_p, argv) { /* void */
    iflags.window_inited = TRUE;
}

/*ARGUSED*/
function hup_create_nhwindow(type) { /* winid */
    return WIN_ERR;
}

/*ARGSUSED*/
function hup_select_menu(
    window,
    how,
    menu_list) { /* int */
    return -1;
}

/*ARGSUSED*/
function hup_add_menu(
    window,
    glyphinfo,
    identifier,
    sel,
    grpsel,
    attr,
    clr,
    txt,
    itemflags) { /* void */
    return;
}

/*ARGSUSED*/
function hup_end_menu(window, prompt) { /* void */
    return;
}

/*ARGSUSED*/
function hup_putstr(window, attr, text) { /* void */
    return;
}

/*ARGSUSED*/
function hup_print_glyph(
    window,
    x, y,
    glyphinfo,
    bkglyphinfo) { /* void */
    return;
}

/*ARGSUSED*/
function hup_outrip(tmpwin, how, when) { /* void */
    return;
}

/*ARGSUSED*/
function hup_curs(window, x, y) { /* void */
    return;
}

/*ARGSUSED*/
function hup_display_nhwindow(window, blocking) { /* void */
    return;
}

/*ARGSUSED*/
function hup_display_file(fname, complain) { /* void */
    return;
}

/*ARGSUSED*/
function hup_cliparound(x, y) { /* void */
    return;
}

/* #ifdef CHANGE_COLOR: not in this build */

/*ARGSUSED*/
function hup_status_update(
    idx, ptr,
    chg, pc,
    color, colormasks) { /* void */
    return;
}

/*
 * Non-specific stubs.
 */

function hup_int_ndecl() { /* int */
    return -1;
}

function hup_void_ndecl() { /* void */
    return;
}

/*ARGUSED*/
function hup_void_fdecl_int(arg) { /* void */
    return;
}

/*ARGUSED*/
function hup_void_fdecl_winid(window) { /* void */
    return;
}

/*ARGUSED*/
function hup_void_fdecl_winid_ulong(
    window,
    mbehavior) { /* void */
    return;
}

/*ARGUSED*/
function hup_void_fdecl_constchar_p(string) { /* void */
    return;
}

/*ARGUSED*/
export function hup_ctrl_nhwindow(
    window,
    request,
    wri) { /* win_request_info * */
    return null;
}

/****************************************************************************/
/* genl backward compat stuff                                               */
/****************************************************************************/

export const status_fieldnm = static_array("status_fieldnm", ptr_to(char), MAXBLSTATS);
export const status_fieldfmt = static_array("status_fieldfmt", ptr_to(char), MAXBLSTATS);
export const status_vals = static_array("status_vals", ptr_to(char), MAXBLSTATS);
export const status_activefields = static_array("status_activefields", schar, MAXBLSTATS);

export function genl_status_init() { /* void */
    let i;

    for (i = 0; i < MAXBLSTATS; ++i) {
        status_vals[i] = addr_of(alloc(MAXCO));
        chars[status_vals[i]] = ord('\0');
        chars[status_activefields + i] = FALSE;
        status_fieldfmt[i] = 0;
    }
    /* Use a window for the genl version; backward port compatibility */
    WIN_STATUS = create_nhwindow()(NHW_STATUS);
    display_nhwindow()(WIN_STATUS, FALSE);
}

export function genl_status_finish() { /* void */
    /* tear down routine */
    let i;

    /* free alloc'd memory here */
    for (i = 0; i < MAXBLSTATS; ++i) {
        if (status_vals[i])
            free((status_vals[i])), status_vals[i] = 0;
    }
}

export function genl_status_enablefield(
    fieldidx,
    nm,
    fmt,
    enable) { /* void */
    status_fieldfmt[fieldidx] = fmt;
    status_fieldnm[fieldidx] = nm;
    chars[status_activefields + fieldidx] = enable;
}

/* call once for each field, then call with BL_FLUSH to output the result */
export function genl_status_update(
    idx,
    ptr,
    chg, percent,
    color, colormasks) { /* void */
    const $frame = stack_frame(); try {
    let newbot1 = stack_array(char, MAXCO), newbot2 = stack_array(char, MAXCO);
    let cond, condptr = ref_to(long, ptr);
    let i;
    let pass, lndelta;
    let idx1, idx2, fieldlist;
    let nb, text = ptr;

    let fieldorder = static_array("genl_status_update.fieldorder", array_of(int, 15), null, [
        /* line one */
        [ BL_TITLE, BL_STR, BL_DX, BL_CO, BL_IN, BL_WI, BL_CH, BL_ALIGN,
          BL_SCORE, BL_FLUSH, BL_FLUSH, BL_FLUSH, BL_FLUSH, BL_FLUSH,
          BL_FLUSH ],
        /* line two, default order */
        [ BL_LEVELDESC, BL_GOLD,
          BL_HP, BL_HPMAX, BL_ENE, BL_ENEMAX, BL_AC,
          BL_XP, BL_EXP, BL_HD,
          BL_TIME,
          BL_HUNGER, BL_CAP, BL_CONDITION,
          BL_FLUSH ],
        /* move time to the end */
        [ BL_LEVELDESC, BL_GOLD,
          BL_HP, BL_HPMAX, BL_ENE, BL_ENEMAX, BL_AC,
          BL_XP, BL_EXP, BL_HD,
          BL_HUNGER, BL_CAP, BL_CONDITION,
          BL_TIME, BL_FLUSH ],
        /* move experience and time to the end */
        [ BL_LEVELDESC, BL_GOLD,
          BL_HP, BL_HPMAX, BL_ENE, BL_ENEMAX, BL_AC,
          BL_HUNGER, BL_CAP, BL_CONDITION,
          BL_XP, BL_EXP, BL_HD, BL_TIME, BL_FLUSH ],
        /* move level description plus gold and experience and time to end */
        [ BL_HP, BL_HPMAX, BL_ENE, BL_ENEMAX, BL_AC,
          BL_HUNGER, BL_CAP, BL_CONDITION,
          BL_LEVELDESC, BL_GOLD, BL_XP, BL_EXP, BL_HD, BL_TIME, BL_FLUSH ],
    ]);

    /* in case interface is using genl_status_update() but has not
       specified WC2_FLUSH_STATUS (status_update() for field values
       is buffered so final BL_FLUSH is needed to produce output) */
    windowprocs.wincap2 = or64u(windowprocs.wincap2, WC2_FLUSH_STATUS);

    if (idx >= 0) {
        if (!chars[status_activefields + idx])
            return;
        switch (idx) {
        case BL_CONDITION:
            cond = condptr ? condptr[0] : 0;
            nb = status_vals[idx];
            chars[nb] = ord('\0');
            if (cond & BL_MASK_STONE)
                strcpy(nb = eos(nb), _(" Stone"));
            if (cond & BL_MASK_SLIME)
                strcpy(nb = eos(nb), _(" Slime"));
            if (cond & BL_MASK_STRNGL)
                strcpy(nb = eos(nb), _(" Strngl"));
            if (cond & BL_MASK_FOODPOIS)
                strcpy(nb = eos(nb), _(" FoodPois"));
            if (cond & BL_MASK_TERMILL)
                strcpy(nb = eos(nb), _(" TermIll"));
            if (cond & BL_MASK_BLIND)
                strcpy(nb = eos(nb), _(" Blind"));
            if (cond & BL_MASK_DEAF)
                strcpy(nb = eos(nb), _(" Deaf"));
            if (cond & BL_MASK_STUN)
                strcpy(nb = eos(nb), _(" Stun"));
            if (cond & BL_MASK_CONF)
                strcpy(nb = eos(nb), _(" Conf"));
            if (cond & BL_MASK_HALLU)
                strcpy(nb = eos(nb), _(" Hallu"));
            if (cond & BL_MASK_LEV)
                strcpy(nb = eos(nb), _(" Lev"));
            if (cond & BL_MASK_FLY)
                strcpy(nb = eos(nb), _(" Fly"));
            if (cond & BL_MASK_RIDE)
                strcpy(nb = eos(nb), _(" Ride"));
            break;
        default:
            sprintf(status_vals[idx], status_fieldfmt[idx] ? status_fieldfmt[idx] : _("%s"), text ? text : _(""))

;
            break;
        }
        return; /* processed one field other than BL_FLUSH */
    } /* (idx >= 0, thus not BL_FLUSH, BL_RESET, BL_CHARACTERISTICS) */

    /* does BL_RESET require any specific code to ensure all fields ? */

    if (!(idx == BL_FLUSH || idx == BL_RESET))
        return;

    /* We've received BL_FLUSH; time to output the gathered data */
    nb = newbot1;
    chars[nb] = ord('\0');
    /* BL_FLUSH is the only pseudo-index value we need to check for
       in the loop below because it is the only entry used to pad the
       end of the fieldorder array. We could stop on any
       negative (illegal) index, but this should be fine */
    for (i = 0; (idx1 = fieldorder[0][i]) != BL_FLUSH; ++i) {
        if (chars[status_activefields + idx1])
            strcpy(nb = eos(nb), status_vals[idx1]);
    }
    /* if '$' is encoded, buffer length of \GXXXXNNNN is 9 greater than
       single char; we want to subtract that 9 when checking display length */
    lndelta = (chars[status_activefields + BL_GOLD]
               && strstr(status_vals[BL_GOLD], _("\\G"))) ? 9 : 0;
    /* basic bot2 formats groups of second line fields into five buffers,
       then decides how to order those buffers based on comparing lengths
       of [sub]sets of them to the width of the map; we have more control
       here but currently emulate that behavior */
    for (pass = 1; pass <= 4; pass++) {
        fieldlist = fieldorder[pass];
        nb = newbot2;
        chars[nb] = ord('\0');
        for (i = 0; (idx2 = fieldlist[i]) != BL_FLUSH; ++i) {
            if (chars[status_activefields + idx2]) {
                let val = status_vals[idx2];

                switch (idx2) {
                case BL_HP: /* for pass 4, Hp comes first; mungspaces()
                               will strip the unwanted leading spaces */
                case BL_XP: case BL_HD:
                case BL_TIME:
                    strcpy(nb = eos(nb), _(" "));
                    break;
                case BL_LEVELDESC:
                    /* leveldesc has no leading space, so if we've moved
                       it past the first position, provide one */
                    if (i != 0)
                        strcpy(nb = eos(nb), _(" "));
                    break;
                /*
                 * We want "  hunger encumbrance conditions"
                 *   or    "  encumbrance conditions"
                 *   or    "  hunger conditions"
                 *   or    "  conditions"
                 * 'hunger'      is either " " or " hunger_text";
                 * 'encumbrance' is either " " or " encumbrance_text";
                 * 'conditions'  is either ""  or " cond1 cond2...".
                 */
                case BL_HUNGER:
                    /* hunger==" " - keep it, end up with " ";
                       hunger!=" " - insert space and get "  hunger" */
                    if (strcmp(val, _(" ")))
                        strcpy(nb = eos(nb), _(" "));
                    break;
                case BL_CAP:
                    /* cap==" " - suppress it, retain "  hunger" or " ";
                       cap!=" " - use it, get "  hunger cap" or "  cap" */
                    if (!strcmp(val, _(" ")))
                        ++val;
                    break;
                default:
                    break;
                }
                strcpy(nb = eos(nb), val); /* status_vals[idx2] */
            } /* status_activefields[idx2] */

            if (idx2 == BL_CONDITION && pass < 4
                && unsigned(strlen(newbot2) - lndelta) > COLNO)
                break; /* switch to next order */
        } /* i */

        if (idx2 == BL_FLUSH) { /* made it past BL_CONDITION */
            if (pass > 1)
                mungspaces(newbot2);
            break;
        }
    } /* pass */
    curs()(WIN_STATUS, 1, 0);
    putstr()(WIN_STATUS, 0, newbot1);
    curs()(WIN_STATUS, 1, 1);
    putmixed()(WIN_STATUS, 0, newbot2); /* putmixed() due to GOLD glyph */
    } finally { stack_pop($frame); }
}

const dumplog_windowprocs_backup = static_struct("dumplog_windowprocs_backup", struct_window_procs);
const dumplog_file = static_var("dumplog_file", ptr_to("struct__IO_FILE"));

/* #ifdef DUMPLOG: not in this build */

export function dump_open_log(now) { /* void */
    /* #ifdef DUMPLOG: not in this build */

    (now);
}

export function dump_close_log() { /* void */
    if (dumplog_file[0]) {
        fclose(dumplog_file[0]);
        dumplog_file[0] = null;
    }
}

export function dump_forward_putstr(win, attr, str, no_forward) { /* void */
    if (dumplog_file[0])
        fprintf(dumplog_file[0], _("%s\n"), str);
    if (!no_forward)
        putstr()(win, attr, str);
}

/*ARGSUSED*/
function dump_putstr(win, attr, str) { /* void */
    if (dumplog_file[0])
        fprintf(dumplog_file[0], _("%s\n"), str);
}

function dump_create_nhwindow(type) { /* winid */
    return WIN_ERR;
}

/*ARGUSED*/
function dump_clear_nhwindow(win) { /* void */
    return;
}

/*ARGSUSED*/
function dump_display_nhwindow(win, p) { /* void */
    return;
}

/*ARGUSED*/
function dump_destroy_nhwindow(win) { /* void */
    return;
}

/*ARGUSED*/
function dump_start_menu(win, mbehavior) { /* void */
    return;
}

/*ARGSUSED*/
function dump_add_menu(win,
              glyphinfo,
              identifier,
              ch,
              gch,
              attr,
              clr,
              str,
              itemflags) { /* void */
    if (dumplog_file[0]) {
        if (glyphinfo.glyph == NO_GLYPH)
            fprintf(dumplog_file[0], _(" %s\n"), str);
        else
            fprintf(dumplog_file[0], _("  %c - %s\n"), ch, str);
    }
}

/*ARGSUSED*/
function dump_end_menu(win, str) { /* void */
    if (dumplog_file[0]) {
        if (str)
            fprintf(dumplog_file[0], _("%s\n"), str);
        else
            fputs(_("\n"), dumplog_file[0]);
    }
}

function dump_select_menu(win, how, item) { /* int */
    item[0] = null;
    return 0;
}

export function dump_redirect(onoff_flag) { /* void */
    if (dumplog_file[0]) {
        if (onoff_flag) {
            windowprocs.win_create_nhwindow = dump_create_nhwindow;
            windowprocs.win_clear_nhwindow = dump_clear_nhwindow;
            windowprocs.win_display_nhwindow = dump_display_nhwindow;
            windowprocs.win_destroy_nhwindow = dump_destroy_nhwindow;
            windowprocs.win_start_menu = dump_start_menu;
            windowprocs.win_add_menu = dump_add_menu;
            windowprocs.win_end_menu = dump_end_menu;
            windowprocs.win_select_menu = dump_select_menu;
            windowprocs.win_putstr = dump_putstr;
        } else {
            struct_assign(windowprocs, dumplog_windowprocs_backup);
        }
        iflags.in_dumplog = onoff_flag;
    } else {
        iflags.in_dumplog = FALSE;
    }
}

export function has_color(color) { /* int */
    return ((iflags.wc_color && windowprocs.name
            && (windowprocs.wincap & WC_COLOR) && chars[windowprocs.has_color + color] ? 1 : 0)

    );
}

export function glyph2ttychar(glyph) { /* int */
    const $frame = stack_frame(); try {
    let glyphinfo = stack_struct(struct_glyphinfo);

    map_glyphinfo(0, 0, glyph, 0, glyphinfo);
    return glyphinfo.ttychar;
    } finally { stack_pop($frame); }
}

export function glyph2symidx(glyph) { /* int */
    const $frame = stack_frame(); try {
    let glyphinfo = stack_struct(struct_glyphinfo);

    map_glyphinfo(0, 0, glyph, 0, glyphinfo);
    return glyphinfo.gm.sym.symidx;
    } finally { stack_pop($frame); }
}

export function encglyph(glyph) { /* char * */
    let encbuf = static_array("encglyph.encbuf", char, 20); /* 10+1 would suffice */

    sprintf(encbuf, _("\\G%04X%04X"), svc.context.rndencode, glyph);
    return encbuf;
}

/* hexdd[] is defined in decl.c */

export function decode_glyph(str, glyph_ptr) { /* int */
    let rndchk = 0, dcount = 0, retval = 0;
    let dp;

    for (; chars[str] && ++dcount <= 4; ++str) {
        if ((dp = strchr(hexdd, chars[str])) != 0) {
            retval++;
            rndchk = (rndchk * 16) + Math.trunc((dp - hexdd) / 2);
        } else
            break;
    }
    if (rndchk == svc.context.rndencode) {
        glyph_ptr[0] = dcount = 0;
        for (; chars[str] && ++dcount <= 4; ++str) {
            if ((dp = strchr(hexdd, chars[str])) != 0) {
                retval++;
                glyph_ptr[0] = (glyph_ptr[0] * 16) + Math.trunc((dp - hexdd) / 2);
            } else
                break;
        }
        return retval;
    }
    return 0;
}

export function decode_mixed(buf, str) { /* char * */
    const $frame = stack_frame(); try {
    let put = buf;
    let glyphinfo = struct_assign(stack_struct(struct_glyphinfo), nul_glyphinfo);

    if (!str)
        return strcpy(buf, _(""));

    while (chars[str]) {
        if (chars[str] == ord('\\')) {
            let dcount, so, ggv = stack_var(int);
            let save_str;

            save_str = str++;
            switch (chars[str]) {
            case ord('G'): /* glyph value \GXXXXNNNN*/
                if ((dcount = decode_glyph(str + 1, ggv))) {
                    str += (dcount + 1);
                    map_glyphinfo(0, 0, ggv[0], 0, glyphinfo);
                    so = glyphinfo.gm.sym.symidx;
                    chars[put++] = char(uchars[gs.showsyms + so]);
                    /* 'str' is ready for the next loop iteration and '*str'
                       should not be copied at the end of this iteration */
                    continue;
                } else {
                    /* possible forgery - leave it the way it is */
                    str = save_str;
                }
                break;
            case ord('\\'):
                break;
            case ord('\0'):
                /* String ended with '\\'.  This can happen when someone
                   names an object with a name ending with '\\', drops the
                   named object on the floor nearby and does a look at all
                   nearby objects. */
                /* brh - should we perhaps not allow things to have names
                   that contain '\\' */
                str = save_str;
                break;
            }
        }
        chars[put++] = chars[str++];
    }
    chars[put] = ord('\0');
    return buf;
    } finally { stack_pop($frame); }
}

/*
 * This differs from putstr() because the str parameter can
 * contain a sequence of characters representing:
 *        \GXXXXNNNN    a glyph value, encoded by encglyph().
 *
 * For window ports that haven't yet written their own
 * XXX_putmixed() routine, this general one can be used.
 * It replaces the encoded glyph sequence with a single
 * showsyms[] char, then just passes that string onto
 * putstr().
 */

export function genl_putmixed(window, attr, str) { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);

    /* now send it to the normal putstr */
    putstr()(window, attr, decode_mixed(buf, str));
    } finally { stack_pop($frame); }
}

/* possibly called to show usage info during command line processing when
   an interface hasn't yet been chosen and set up */
export function genl_display_file(fname, complain) { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);
    let f = dlb_fopen(fname, _("r"));

    if (!f) {
        if (complain) /* send complaint to stdout rather than to stderr */
            fprintf(stdout, _("\nCannot open \"%s\".\n"), fname);
    } else {
        /* straight copy to stdout, no pagination or other interaction */
        while (dlb_fgets(buf, BUFSZ, f)) {
            if (fputs(buf, stdout) < 0)
                break;
        }
        dlb_fclose(f);
    }
    } finally { stack_pop($frame); }
}

/*
 * Window port helper function for menu invert routines to move the decision
 * logic into one place instead of 7 different window-port routines.
 */
export function menuitem_invert_test(
    mode,
    itemflags,
    is_selected) { /* boolean */ /* current selection status of the item */
    let skipinvert = +((itemflags & MENU_ITEMFLAGS_SKIPINVERT) != 0);

    if (!skipinvert) /* if not flagged SKIPINVERT, always pass test */
        return TRUE;
    /*
     * mode 0: inverting current on/off state;
     *      1: unconditionally setting on;
     *      2: unconditionally setting off.
     * menuinvertmode 0: treat entries flagged with skipinvert as ordinary
     *                   (same as if not flagged);
     * menuinvertmode 1: don't toggle bulk invert or bulk select entries On;
     *                   allow toggling to Off (for invert and deselect;
     *                   select doesn't do Off);
     * menuinvertmode 2: don't toggle skipinvert entries either On or Off
     *                   when any bulk change is performed.
     */
    if (iflags.menuinvertmode == 2) {
        return FALSE;
    } else if (iflags.menuinvertmode == 1) {
        return is_selected ? TRUE : FALSE;
    }
    return TRUE;
}

/*
 * helper routine if a window port wants to extract the glyph
 * information from a glyph number representation in the string;
 * the returned string is the remainder of the string after
 * extracting the \GNNNNNNNN information. The glyph details,
 * including the utf8 representation under ENHANCED_SYMBOLS,
 * will be stored in the glyph_info struct pointed to by gip.
 */
export function mixed_to_glyphinfo(str, gip) { /* const char * */
    const $frame = stack_frame(); try {
    let dcount, ggv = stack_var(int);

    if (!str || !gip)
        return _(" ");

    struct_assign(gip, nul_glyphinfo);
    if (chars[str] == ord('\\') && chars[(str + 1)] == ord('G')) {
        if ((dcount = decode_glyph(str + 2, ggv))) {
            map_glyphinfo(0, 0, ggv[0], 0, gip);
            /* 'str' is ready for the next loop iteration and
                '*str' should not be copied at the end of this
                iteration */
            str += (dcount + 2);
        }
    }
    return str;
    } finally { stack_pop($frame); }
}

/*
 * This is a somewhat generic menu for taking a list of NetHack style
 * class choices and presenting them via a description
 * rather than the traditional NetHack characters.
 * (Benefits users whose first exposure to NetHack is via tiles).
 *
 * prompt
 *           The title at the top of the menu.
 *
 * category: 0 = monster class
 *           1 = object  class
 *
 * way
 *           FALSE = PICK_ONE, TRUE = PICK_ANY
 *
 * class_list
 *           a null terminated string containing the list of choices.
 *
 * class_selection
 *           a null terminated string containing the selected characters.
 *
 * Returns number selected.
 */
export function choose_classes_menu(prompt,
                    category,
                    way,
                    class_list,
                    class_select) { /* int */
    const $frame = stack_frame(); try {
    let pick_list = stack_var(ptr_to(struct_mi), null);
    let win;
    let any = stack_struct(struct_any);
    let buf = stack_array(char, BUFSZ);
    let text = 0;
    let selected;
    let ret, i, n, next_accelerator, accelerator = 0;
    let clr = NO_COLOR;

    if (!class_list || !class_select)
        return 0;
    next_accelerator = ord('a');
    struct_assign(any, cg.zeroany);
    win = create_nhwindow()(NHW_MENU);
    start_menu()(win, MENU_BEHAVE_STANDARD);
    while (chars[class_list]) {
        let idx;

        selected = FALSE;
        switch (category) {
        case 0:
            idx = def_char_to_monclass(chars[class_list]);
            if (!IndexOk(idx, def_monsyms)) {
                panic(_("choose_classes_menu: invalid monclass '%c'"),
                      chars[class_list]);
                /*NOTREACHED*/
            }
            text = def_monsyms[idx].explain;
            accelerator = chars[class_list];
            sprintf(buf, _("%s"), text);
            break;
        case 1:
            idx = def_char_to_objclass(chars[class_list]);
            if (!IndexOk(idx, def_oc_syms)) {
                panic(_("choose_classes_menu: invalid objclass '%c'"),
                      chars[class_list]);
                /*NOTREACHED*/
            }
            text = def_oc_syms[idx].explain;
            accelerator = next_accelerator;
            sprintf(buf, _("%c  %s"), chars[class_list], text);
            break;
        default:
            panic(_("choose_classes_menu: invalid category %d"), category);
            /*NOTREACHED*/
        }
        if (way && chars[class_select]) { /* Selections there already */
            if (strchr(class_select, chars[class_list])) {
                selected = TRUE;
            }
        }
        any.a_int = chars[class_list];
        add_menu(win, nul_glyphinfo, any, accelerator,
                 category ? chars[class_list] : 0, ATR_NONE, clr, buf,
                 selected ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);
        if (category > 0) {
            if (next_accelerator == ord('Z'))
                break;
            else if (next_accelerator == ord('z'))
                next_accelerator = ord('A');
            else
                ++next_accelerator;
        }
        ++class_list;
    }
    if (category == 1 && next_accelerator <= ord('z')) {
        /* for objects, add "A - ' '  all classes", after a separator */
        add_menu_str(win, _(""));
        struct_assign(any, cg.zeroany);
        any.a_int = ord(' ');
        sprintf(buf, _("%c  %s"), char(any.a_int), _("All classes of objects"));
        /* we won't preselect this even if the incoming list is empty;
           having it selected means that it would have to be explicitly
           de-selected in order to select anything else */
        add_menu(win, nul_glyphinfo, any, ord('A'), 0,
                 ATR_NONE, clr, buf, MENU_ITEMFLAGS_SKIPINVERT);
        if (!strcmp(prompt, _("Autopickup what?"))) {
            add_menu_str(win,
                   _("Note: when no choices are selected, \"all\" is implied."));
            /* for 'O', "toggle" should be intuitive; for 'm O', it would
               probably be better to say "Set 'autopickup' to true|false" */
            add_menu_str(win, flags.pickup
                        ? _("Toggle off 'autopickup' to not pick up anything.")
           : _("Toggle on 'autopickup' to automatically pick these things up."));
        }
    }
    end_menu()(win, prompt);
    n = select_menu(win, way ? PICK_ANY : PICK_ONE, pick_list);
    destroy_nhwindow()(win);
    if (n > 0) {
        if (category == 1) {
            /* for object classes, first check for 'all'; it means 'use
               a blank list' rather than 'collect every possible choice' */
            for (i = 0; i < n; ++i)
                if (ptr_add(pick_list[0], i).item.a_int == ord(' ')) {
                    ptr_add(pick_list[0], 0).item.a_int = ord(' ');
                    n = 1; /* return 1; also an implicit 'break;' */
                }
        }
        for (i = 0; i < n; ++i)
            chars[class_select++] = char((ptr_add(pick_list[0], i).item.a_int));
        free(addr_of(pick_list[0]));
        ret = n;
    } else if (n == -1) {
        class_select = eos(class_select);
        ret = -1;
    } else {
        ret = 0;
    }
    chars[class_select] = ord('\0');
    return ret;
    } finally { stack_pop($frame); }
}

/* enum and structs are defined in wintype.h */

export const zerowri = static_struct("zerowri", struct_win_request_info_t, { tocore: { tocore_flags: 0, active: 0, use_update_inventory: 0, maxslot: 0, needrows: 0, needcols: 0, haverows: 0, havecols: 0 },
                             fromcore: { core_request: 0, invmode: 0, menu_promptstyle: { color: NO_COLOR, attr: ATR_NONE }}});

export function adjust_menu_promptstyle(window, style) { /* void */
    const $frame = stack_frame(); try {
    let wri = struct_assign(stack_struct(struct_win_request_info_t), zerowri);
    wri.fromcore.menu_promptstyle.color = style.color;
    wri.fromcore.menu_promptstyle.attr = style.attr;
    /*  relay the style change to the window port */
    ctrl_nhwindow()(window, set_menu_promptstyle, wri);
    go.opt_need_promptstyle = FALSE;
    } finally { stack_pop($frame); }
}

/*
 *   Common code point leading into the interface-specific
 *   add_menu() to allow single-spot adjustments to the parameters,
 *   such as those done by menu_colors.
 */
export function add_menu(
    window,
    glyphinfo,

    identifier,
    ch,
    gch,
    attr$,
    color$,
    str,
    itemflags) { /* void */ /* itemflags such as MENU_ITEMFLAGS_SELECTED */
    const $frame = stack_frame(); try {
    const attr = stack_var(int, attr$);
    const color = stack_var(int, color$);
    if (!str) {
        /* if 'str' is Null, just return without adding any menu entry */
        debugpline0(_("add_menu(Null)"), __FILE__);
        return;
    }

    if (iflags.use_menu_color) {
        if ((itemflags & MENU_ITEMFLAGS_SKIPMENUCOLORS) == 0)
            get_menu_coloring(str, color, attr);
    }
    /* this is the only function that cared about this flag; remove it now */
    itemflags = unsigned(itemflags & unsigned(~MENU_ITEMFLAGS_SKIPMENUCOLORS));

    windowprocs.win_add_menu(window, glyphinfo, identifier,
                                ch, gch, attr[0], color[0], str, itemflags);
    } finally { stack_pop($frame); }
}

/* insert a non-selectable, possibly highlighted line of text into a menu */
export function add_menu_heading(tmpwin, buf) { /* void */
    const $frame = stack_frame(); try {
    let any = struct_assign(stack_struct(struct_any), cg.zeroany);
    let attr = iflags.menu_headings.attr,
        color = iflags.menu_headings.color;

    /* suppress highlighting during end-of-game disclosure */
    if (program_state.gameover)
        attr = ATR_NONE, color = NO_COLOR;

    add_menu(tmpwin, nul_glyphinfo, any, ord('\0'), ord('\0'), attr, color,
             buf, MENU_ITEMFLAGS_SKIPMENUCOLORS);
    } finally { stack_pop($frame); }
}

/* insert a non-selectable, unhighlighted line of text into a menu */
export function add_menu_str(tmpwin, buf) { /* void */
    const $frame = stack_frame(); try {
    let any = struct_assign(stack_struct(struct_any), cg.zeroany);

    add_menu(tmpwin, nul_glyphinfo, any, ord('\0'), ord('\0'), ATR_NONE, NO_COLOR,
             buf, MENU_ITEMFLAGS_NONE);
    } finally { stack_pop($frame); }
}

function get_menu_coloring(str, color, attr) { /* boolean */
    let tmpmc;

    if (iflags.use_menu_color)
        for (tmpmc = gm.menu_colorings; tmpmc; tmpmc = tmpmc.next)
            if (regex_match(str, tmpmc.match)) {
                color[0] = tmpmc.color;
                attr[0] = tmpmc.attr;
                return TRUE;
            }
    return FALSE;
}

export function select_menu(window, how, menu_list) { /* int */
    let reslt;
    let old_bot_disabled = gb.bot_disabled;

    gb.bot_disabled = TRUE;
    reslt = windowprocs.win_select_menu(window, how, menu_list);
    gb.bot_disabled = old_bot_disabled;
    return reslt;
}

export function getlin(query, bufp) { /* void */
    let old_bot_disabled = gb.bot_disabled;
    let obufp = bufp;
    let got_cmdq = FALSE;
    let cmdq = null;

    while ((cmdq = cmdq_pop()) != null) {
        if (cmdq.typ == CMDQ_KEY) {
            got_cmdq = TRUE;
            chars[bufp] = (cmdq.key != ord('\n')) ? cmdq.key : ord('\0');
            bufp++;
            if (cmdq.key == ord('\n'))
                break;
        } else {
            break;
        }
        free(addr_of(cmdq));
        cmdq = null;
    }
    if (cmdq)
        free(addr_of(cmdq));

    if (got_cmdq) {
        chars[bufp] = ord('\0');
        pline(_("%s %s"), query, obufp);
        return;
    }

    program_state.in_getlin = 1;
    gb.bot_disabled = TRUE;
    windowprocs.win_getlin(query, bufp);
    gb.bot_disabled = old_bot_disabled;
    program_state.in_getlin = 0;
}
/*windows.c*/

import {
    BL_AC, BL_ALIGN, BL_CAP, BL_CH, BL_CO, BL_CONDITION, BL_DX, BL_ENE, BL_ENEMAX, BL_EXP, BL_FLUSH,
    BL_GOLD, BL_HD, BL_HP, BL_HPMAX, BL_HUNGER, BL_IN, BL_LEVELDESC, BL_MASK_BLIND, BL_MASK_CONF,
    BL_MASK_DEAF, BL_MASK_FLY, BL_MASK_FOODPOIS, BL_MASK_HALLU, BL_MASK_LEV, BL_MASK_RIDE,
    BL_MASK_SLIME, BL_MASK_STONE, BL_MASK_STRNGL, BL_MASK_STUN, BL_MASK_TERMILL, BL_RESET, BL_SCORE,
    BL_STR, BL_TIME, BL_TITLE, BL_WI, BL_XP, MAXBLSTATS, MAXCO,
} from "./botl.h.js";
import { NO_COLOR } from "./color.h.js";
import { NO_GLYPH } from "./display.h.js";
import { dlb_fclose, dlb_fgets, dlb_fopen } from "./dlb.h.macros.js";
import { BUFSZ, COLNO, FALSE, TRUE } from "./global.h.js";
import { strcmpi } from "./global.h.macros.js";
import { CMDQ_KEY } from "./hack.h.js";
import { IndexOk } from "./hack.h.macros.js";
import { debugpline0 } from "./lint.h.macros.js";
import {
    WC2_FLUSH_STATUS, WC_COLOR, WININIT, WININIT_UNDO, struct_window_procs, wp_hup,
} from "./winprocs.h.js";
import {
    create_nhwindow, ctrl_nhwindow, curs, destroy_nhwindow, display_nhwindow, end_menu, putmixed,
    putstr, start_menu,
} from "./winprocs.h.macros.js";
import {
    ATR_NONE, MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, MENU_ITEMFLAGS_SELECTED,
    MENU_ITEMFLAGS_SKIPINVERT, MENU_ITEMFLAGS_SKIPMENUCOLORS, NHW_MENU, NHW_STATUS, PICK_ANY,
    PICK_ONE, WIN_ERR, set_menu_promptstyle, struct_any, struct_glyphinfo, struct_mi,
    struct_win_request_info_t,
} from "./wintype.h.js";
import { char, int, long, ord, schar, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { and64u, or64u } from "../rt/int64.js";
import {
    EXIT_FAILURE, EXIT_SUCCESS, fclose, fprintf, fputs, free, puts, sprintf, stdout, strchr, strcmp,
    strcpy, strlen, strncpy, strstr,
} from "../rt/libc.js";
import {
    stack_array, stack_struct, stack_var, static_array, static_struct, static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, fnptr_t, ptr_add, ptr_to, ref_to, struct, struct_assign,
} from "../rt/struct.js";
import { alloc } from "./alloc.js";
import { config_error_add } from "./cfgfiles.js";
import { cmdq_pop } from "./cmd.js";
import { cg, flags, gb, gl, gm, go, gs, hexdd, iflags, program_state, svc } from "./decl.js";
import { map_glyphinfo, nul_glyphinfo } from "./display.js";
import { def_char_to_monclass, def_char_to_objclass, def_monsyms, def_oc_syms } from "./drawing.js";
import { nh_terminate, panic } from "./end.js";
import { eos, mungspaces } from "./hacklib.js";
import { pline, raw_printf } from "./pline.js";
import { regex_match } from "../sys/share/posixregex.js";
import { tty_procs, win_tty_init } from "../win/tty/wintty.js";
const __FILE__ = "windows.c";
