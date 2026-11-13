/* NetHack 5.0	cmd.c	$NHDT-Date: 1762680996 2025/11/09 01:36:36 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.755 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2013. */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * Some systems may have getchar() return EOF for various reasons, and
 * we should not quit before seeing at least NR_OF_EOFS consecutive EOFs.
 */

export const NR_OF_EOFS = 20;

/* #ifdef DUMB: not in this build */

const timed_occ_fn = static_var("timed_occ_fn", fnptr_t);

const readchar_queue = static_var("readchar_queue", ptr_to(char), _(""));

/* for rejecting attempts to use wizard mode commands
 * Also used in wizcmds.c  */
export const unavailcmd = init_string(static_array("unavailcmd", char, sizeof_string("Unavailable command '%s'.")), _("Unavailable command '%s'."), true);

/* for rejecting #if !SHELL, !SUSPEND */
const cmdnotavail = init_string(static_array("cmdnotavail", char, sizeof_string("'%s' command not available.")), _("'%s' command not available."), true);

/* the #prevmsg command */
function doprev_message() { /* int */
    nh_doprev_message()();
    return ECMD_OK;
}

/* Count down by decrementing multi */
function timed_occupation() { /* int */
    (timed_occ_fn[0])();
    if (gm.multi > 0)
        gm.multi--;
    return +(gm.multi > 0);
}

/* If you have moved since initially setting some occupations, they
 * now shouldn't be able to restart.
 *
 * The basic rule is that if you are carrying it, you can continue
 * since it is with you.  If you are acting on something at a distance,
 * your orientation to it must have changed when you moved.
 *
 * The exception to this is taking off items, since they can be taken
 * off in a number of ways in the intervening time, screwing up ordering.
 *
 *      Currently:      Take off all armor.
 *                      Picking Locks / Forcing Chests.
 *                      Setting traps.
 */
export function reset_occupations() { /* void */
    reset_remarm();
    reset_pick();
    reset_trapset();
}

/* If a time is given, use it to timeout this function, otherwise the
 * function times out by its own means.
 */
export function set_occupation(fn, txt, xtime) { /* void */
    if (xtime) {
        go.occupation = timed_occupation;
        timed_occ_fn[0] = fn;
    } else
        go.occupation = fn;
    go.occtxt = txt;
    go.occtime = 0;
    return;
}

/*
void
cmdq_print(int q)
{
    char buf[QBUFSZ];
    struct _cmd_queue *cq = gc.command_queue[q];

    pline("CQ:%i", q);
    while (cq) {
        switch (cq->typ) {
        case CMDQ_KEY:
            pline("(key:%s)", key2txt(cq->key, buf));
            break;
        case CMDQ_EXTCMD:
            pline("(extcmd:#%s)", cq->ec_entry->ef_txt);
            break;
        case CMDQ_DIR:
            pline("(dir:%i,%i,%i)", cq->dirx, cq->diry, cq->dirz);
            break;
        case CMDQ_USER_INPUT:
            pline("(userinput)");
            break;
        case CMDQ_INT:
            pline("(int:%i)", cq->intval);
            break;
        default:
            pline("(ERROR:%i)",cq->typ);
            break;
        }
        cq = cq->next;
    }
}
*/

/* add extended command function to the command queue */
export function cmdq_add_ec(q, fn) { /* void */
    let tmp = view_of(struct__cmd_queue, addr_of(alloc(sizeof(struct__cmd_queue))));
    let cq = gc.command_queue[q];

    tmp.typ = CMDQ_EXTCMD;
    tmp.ec_entry = ext_func_tab_from_func(fn);
    tmp.next = null;

    while (cq && cq.next)
        cq = cq.next;

    if (cq)
        cq.next = tmp;
    else
        gc.command_queue[q] = tmp;
}

/* add a key to the command queue */
export function cmdq_add_key(q, key) { /* void */
    let tmp = view_of(struct__cmd_queue, addr_of(alloc(sizeof(struct__cmd_queue))));
    let cq = gc.command_queue[q];

    tmp.typ = CMDQ_KEY;
    tmp.key = key;
    tmp.next = null;

    while (cq && cq.next)
        cq = cq.next;

    if (cq)
        cq.next = tmp;
    else
        gc.command_queue[q] = tmp;
}

/* add a direction to the command queue */
export function cmdq_add_dir(q, dx, dy, dz) { /* void */
    let tmp = view_of(struct__cmd_queue, addr_of(alloc(sizeof(struct__cmd_queue))));
    let cq = gc.command_queue[q];

    tmp.typ = CMDQ_DIR;
    tmp.dirx = dx;
    tmp.diry = dy;
    tmp.dirz = dz;
    tmp.next = null;

    while (cq && cq.next)
        cq = cq.next;

    if (cq)
        cq.next = tmp;
    else
        gc.command_queue[q] = tmp;
}

/* add placeholder to the command queue, allows user input there */
export function cmdq_add_userinput(q) { /* void */
    let tmp = view_of(struct__cmd_queue, addr_of(alloc(sizeof(struct__cmd_queue))));
    let cq = gc.command_queue[q];

    tmp.typ = CMDQ_USER_INPUT;
    tmp.next = null;

    while (cq && cq.next)
        cq = cq.next;

    if (cq)
        cq.next = tmp;
    else
        gc.command_queue[q] = tmp;
}

/* add integer to the command queue */
export function cmdq_add_int(q, val) { /* void */
    let tmp = view_of(struct__cmd_queue, addr_of(alloc(sizeof(struct__cmd_queue))));
    let cq = gc.command_queue[q];

    tmp.typ = CMDQ_INT;
    tmp.intval = val;
    tmp.next = null;

    while (cq && cq.next)
        cq = cq.next;

    if (cq)
        cq.next = tmp;
    else
        gc.command_queue[q] = tmp;
}

/* shift the last entry in command queue to first */
export function cmdq_shift(q) { /* void */
    let tmp = null;
    let cq = gc.command_queue[q];

    while (cq && cq.next && cq.next.next)
        cq = cq.next;

    if (cq)
        tmp = cq.next;
    if (tmp) {
        tmp.next = gc.command_queue[q];
        gc.command_queue[q] = tmp;
        cq.next = null;
    }
}

export function cmdq_reverse(head) { /* struct _cmd_queue * */
    let prev = null, curr = head, next;

    while (curr) {
        next = curr.next;
        curr.next = prev;
        prev = curr;
        curr = next;
    }
    return prev;
}

export function cmdq_copy(q) { /* struct _cmd_queue * */
    let tmp = null;
    let cq = gc.command_queue[q];

    while (cq) {
        let tmp2 = view_of(struct__cmd_queue, addr_of(alloc(sizeof(struct__cmd_queue))));

        struct_assign(tmp2, cq);
        tmp2.next = tmp;
        tmp = tmp2;
        cq = cq.next;
    }

    tmp = cmdq_reverse(tmp);

    return tmp;
}

/* pop off the topmost command from the command queue.
 * caller is responsible for freeing the returned _cmd_queue.
 */
export function cmdq_pop() { /* struct _cmd_queue * */
    let q = gi.in_doagain ? CQ_REPEAT : CQ_CANNED;
    let tmp = gc.command_queue[q];

    if (tmp) {
        gc.command_queue[q] = tmp.next;
        tmp.next = null;
    }
    return tmp;
}

/* get the top entry without popping it */
export function cmdq_peek(q) { /* struct _cmd_queue * */
    return gc.command_queue[q];
}

/* clear all commands from the command queue */
export function cmdq_clear(q) { /* void */
    let tmp = gc.command_queue[q];
    let tmp2;

    while (tmp) {
        tmp2 = tmp.next;
        free(addr_of(tmp));
        tmp = tmp2;
    }
    gc.command_queue[q] = null;
}

export function pgetchar() { /* char */ /* courtesy of aeb@cwi.nl */
    let ch = ord('\0');

    if (iflags.debug_fuzzer)
        return randomkey();
    ch = nhgetch()();
    return char(ch);
}

/* '#' or whatever has been bound to doextcmd() in its place */
export function extcmd_initiator() { /* char */
    return gc.Cmd.extcmd_char;
}

function can_do_extcmd(extcmd) { /* boolean */
    let ecflags = int(extcmd.flags);

    if (gl.luacore && nhcb_counts[NHCB_CMD_BEFORE]) {
        lua_getglobal(view_of(struct_lua_State, gl.luacore), _("nh_callback_run"));
        lua_pushstring(view_of(struct_lua_State, gl.luacore), nhcb_name[NHCB_CMD_BEFORE]);
        lua_pushstring(view_of(struct_lua_State, gl.luacore), extcmd.ef_txt);
        nhl_pcall_handle(view_of(struct_lua_State, gl.luacore), 2, 1, _("can_do_extcmd"), NHLpa_panic);
        if (!lua_toboolean(view_of(struct_lua_State, gl.luacore), -1)) {
            lua_settop(view_of(struct_lua_State, gl.luacore), 0);
            return FALSE;
        }
        lua_settop(view_of(struct_lua_State, gl.luacore), 0);
    }

    if (!wizard() && (ecflags & WIZMODECMD)) {
        pline(unavailcmd, extcmd.ef_txt);
        return FALSE;
    } else if (u.uburied && !(ecflags & IFBURIED)) {
        You_cant(_("do that while you are buried!"));
        return FALSE;
    } else if (iflags.debug_fuzzer && (ecflags & NOFUZZERCMD)) {
        return FALSE;
    }
    return TRUE;
}

/* here after # - now read a full-word command */
export function doextcmd() { /* int */
    let idx, retval;
    let func;

    /* keep repeating until we don't run help or quit */
    do {
        idx = get_ext_cmd()();
        if (idx < 0)
            return ECMD_OK; /* quit */

        func = extcmdlist[idx].ef_funct;
        if (!can_do_extcmd(extcmdlist[idx]))
            return ECMD_OK;
        if (iflags.menu_requested && !accept_menu_prefix(extcmdlist[idx])) {
            pline(_("'%s' prefix has no effect for the %s command."),
                  visctrl(cmd_from_func(do_reqmenu)),
                  extcmdlist[idx].ef_txt);
            iflags.menu_requested = FALSE;
        }
        /* tell rhack() what command is actually executing */
        ge.ext_tlist = extcmdlist[idx];

        retval = func();
    } while (func == doextlist);

    return retval;
}

/* format extended command flags for display */
function doc_extcmd_flagstr(
    menuwin,
    efp) { /* char * */ /* if Null, add a footnote to the menu */
    const $frame = stack_frame(); try {
    let Abuf = static_array("doc_extcmd_flagstr.Abuf", char, 10); /* 5 would suffice: {'[','m','A',']','\0'} */

    /* note: tag shown for menu prefix is 'm' even if m-prefix action
       has been bound to some other key */
    if (!efp) {
        let qbuf = stack_array(char, QBUFSZ);

        add_menu_str(menuwin, _("[A] Command autocompletes"));
        sprintf(qbuf, _("[m] Command accepts '%s' prefix"), visctrl(cmd_from_func(do_reqmenu)))
;
        add_menu_str(menuwin, qbuf);
        return 0;
    } else {
        let mprefix = accept_menu_prefix(efp),
                autocomplete = +((efp.flags & AUTOCOMPLETE) != 0);
        let p = Abuf;

        /* "" or "[m]" or "[A]" or "[mA]" */
        if (mprefix || autocomplete) {
            chars[p++] = ord('[');
            if (mprefix)
                chars[p++] = ord('m');
            if (autocomplete)
                chars[p++] = ord('A');
            chars[p++] = ord(']');
        }
        chars[p] = ord('\0');
        return Abuf;
    }
    } finally { stack_pop($frame); }
}

/* here after #? - now list all full-word commands and provide
   some navigation capability through the long list */
export function doextlist() { /* int */
    const $frame = stack_frame(); try {
    let efp = null;
    let buf = stack_array(char, BUFSZ), searchbuf = stack_array(char, BUFSZ), descbuf = stack_array(char, BUFSZ), promptbuf = stack_array(char, QBUFSZ);
    let cmd_desc;
    let menuwin;
    let any = stack_struct(struct_any);
    let selected = stack_var(ptr_to(struct_mi));
    let n, pass;
    let menumode = 0, menushown = stack_array(int, 2), onelist = 0;
    let redisplay = TRUE, search = FALSE;
    let headings = static_array("doextlist.headings", ptr_to(char), null, [ _("Extended commands"),
                                      _("Debugging Extended Commands") ]);
    let clr = NO_COLOR;

    chars[searchbuf + 0] = ord('\0');
    menuwin = create_nhwindow()(NHW_MENU);

    while (redisplay) {
        redisplay = FALSE;
        struct_assign(any, cg.zeroany);
        start_menu()(menuwin, MENU_BEHAVE_STANDARD);
        add_menu_str(menuwin, _("Extended Commands List"));
        add_menu_str(menuwin, _(""));

        sprintf(buf, _("Switch to %s commands that don't autocomplete"), menumode ? _("including") : _("excluding"))
;
        any.a_int = 1;
        add_menu(menuwin, nul_glyphinfo, any, ord('a'), 0, ATR_NONE, clr, buf,
                 MENU_ITEMFLAGS_NONE);

        if (!chars[searchbuf]) {
            any.a_int = 2;
            /* was 's', but then using ':' handling within the interface
               would only examine the two or three meta entries, not the
               actual list of extended commands shown via separator lines;
               having ':' as an explicit selector overrides the default
               menu behavior for it; we retain 's' as a group accelerator */
            add_menu(menuwin, nul_glyphinfo, any, ord(':'), ord('s'), ATR_NONE,
                     clr, _("Search extended commands"),
                     MENU_ITEMFLAGS_NONE);
        } else {
            strcpy(buf, _("Switch back from search"));
            if (unsigned(unsigned(strlen(buf) + strlen(searchbuf)) + strlen(_(" (\"\")"))) < QBUFSZ)
                sprintf(eos(buf), _(" (\"%s\")"), searchbuf);
            any.a_int = 3;
            /* specifying ':' as a group accelerator here is mostly a
               statement of intent (we'd like to accept it as a synonym but
               also want to hide it from general menu use) because it won't
               work for interfaces which support ':' to search; use as a
               general menu command takes precedence over group accelerator */
            add_menu(menuwin, nul_glyphinfo, any, ord('s'), ord(':'), ATR_NONE,
                     clr, buf, MENU_ITEMFLAGS_NONE);
        }
        if (wizard()) {
            any.a_int = 4;
            add_menu(menuwin, nul_glyphinfo, any, ord('z'), 0, ATR_NONE, clr,
          onelist ? _("Switch to showing debugging commands in separate section")
       : _("Switch to showing all alphabetically, including debugging commands"),
                     MENU_ITEMFLAGS_NONE);
        }
        add_menu_str(menuwin, _(""));
        menushown[0] = menushown[1] = 0;
        n = 0;
        for (pass = 0; pass <= 1; ++pass) {
            /* skip second pass if not in wizard mode or wizard mode
               commands are being integrated into a single list */
            if (pass == 1 && (onelist || !wizard()))
                break;
            for (efp = extcmdlist[0]; efp.ef_txt; efp = ptr_add(efp, 1)) {
                let wizc;

                if ((efp.flags & (CMD_NOT_AVAILABLE | INTERNALCMD)) != 0)
                    continue;
                /* if hiding non-autocomplete commands, skip such */
                if (menumode == 1 && (efp.flags & AUTOCOMPLETE) == 0)
                    continue;
                /* skip wizard mode commands if not in wizard mode;
                   when showing two sections, skip wizard mode commands
                   in pass==0 and skip other commands in pass==1 */
                wizc = +((efp.flags & WIZMODECMD) != 0);
                if (wizc && !wizard())
                    continue;
                if (!onelist && pass != wizc)
                    continue;
                /* command description might get modified on the fly */
                cmd_desc = efp.ef_desc;
                /* suppress part of the description for #genocided if it
                   doesn't apply during the current game */
                if (!wizard() && !discover()
                    && (efp.flags & GENERALCMD) != 0 /* minor optimization */
                    && strstri(cmd_desc, _("extinct")))
                    cmd_desc = strsubst(strcpy(descbuf, cmd_desc),
                                        _(" been genocided or become extinct"),
                                        _(" been genocided"));
                /* if searching, skip this command if it doesn't match */
                if (chars[searchbuf]
                    /* first try case-insensitive substring match */
                    && !strstri(efp.ef_txt, searchbuf)
                    && !strstri(cmd_desc, searchbuf)
                    /* wildcard support; most interfaces use case-insensitive
                       pmatch rather than regexp for menu searching */
                    && !pmatchi(searchbuf, efp.ef_txt)
                    && !pmatchi(searchbuf, cmd_desc))
                    continue;

                /* We're about to show an item, have we shown the menu yet?
                   Doing menu in inner loop like this on demand avoids a
                   heading with no subordinate entries on the search
                   results menu. */
                if (!menushown[pass]) {
                    strcpy(buf, headings[pass]);
                    add_menu_heading(menuwin, buf);
                    menushown[pass] = 1;
                }
                /* longest ef_txt at present is "wizrumorcheck" (13 chars);
                   2nd field will be "    " or " [A]" or " [m]" or "[mA]" */
                sprintf(buf, _(" %-14s %4s %s"), efp.ef_txt, doc_extcmd_flagstr(menuwin, efp), cmd_desc)
;
                add_menu_str(menuwin, buf);
                ++n;
            }
            if (n)
                add_menu_str(menuwin, _(""));
        }
        if (chars[searchbuf] && !n)
            add_menu_str(menuwin, _("no matches"));
        else
            doc_extcmd_flagstr(menuwin, null);

        end_menu()(menuwin, 0);
        n = select_menu(menuwin, PICK_ONE, selected);
        if (n > 0) {
            switch (ptr_add(selected[0], 0).item.a_int) {
            case 1: /* 'a': toggle show/hide non-autocomplete */
                menumode = 1 - menumode;  /* toggle 0 -> 1, 1 -> 0 */
                redisplay = TRUE;
                break;
            case 2: /* ':' when not searching yet: enable search */
                search = TRUE;
                break;
            case 3: /* 's' when already searching: disable search */
                search = FALSE;
                chars[searchbuf + 0] = ord('\0');
                redisplay = TRUE;
                break;
            case 4: /* 'z': toggle showing wizard mode commands separately */
                search = FALSE;
                chars[searchbuf + 0] = ord('\0');
                onelist = 1 - onelist;  /* toggle 0 -> 1, 1 -> 0 */
                redisplay = TRUE;
                break;
            }
            free(addr_of(selected[0]));
        } else {
            search = FALSE;
            chars[searchbuf + 0] = ord('\0');
        }
        if (search) {
            strcpy(promptbuf, _("Extended command list search phrase"));
            strcat(promptbuf, _("?"));
            getlin(promptbuf, searchbuf);
            mungspaces(searchbuf);
            if (chars[searchbuf + 0] == ord('\x1b'))
                chars[searchbuf + 0] = ord('\0');
            if (chars[searchbuf])
                redisplay = TRUE;
            search = FALSE;
        }
    }
    destroy_nhwindow()(menuwin);
    return ECMD_OK;
    } finally { stack_pop($frame); }
}

export const MAX_EXT_CMD = 200;

/*
 * This is currently used only by the tty interface and is
 * controlled via runtime option 'extmenu'.  (Most other interfaces
 * already use a menu all the time for extended commands.)
 *
 * ``# ?'' is counted towards the limit of the number of commands,
 * so we actually support MAX_EXT_CMD-1 "real" extended commands.
 *
 * Here after # - now show pick-list of possible commands.
 */
export function extcmd_via_menu() { /* int */
    const $frame = stack_frame(); try {
    let efp;
    let pick_list = stack_var(ptr_to(struct_mi), null);
    let win;
    let any = stack_struct(struct_any);
    let choices = stack_array(ptr_to(struct_ext_func_tab), MAX_EXT_CMD + 1);
    let buf = stack_array(char, BUFSZ);
    let cbuf = stack_array(char, QBUFSZ), prompt = stack_array(char, QBUFSZ), fmtstr = stack_array(char, 20);
    let i, n, nchoices, acount;
    let ret, len, biggest;
    let accelerator, prevaccelerator;
    let matchlevel = 0;
    let wastoolong, one_per_line;
    let clr = NO_COLOR;

    ret = 0;
    chars[cbuf + 0] = ord('\0');
    biggest = 0;
    while (!ret) {
        i = n = 0;
        struct_assign(any, cg.zeroany);
        /* populate choices */
        for (efp = extcmdlist[0]; efp.ef_txt; efp = ptr_add(efp, 1)) {
            if ((efp.flags & (CMD_NOT_AVAILABLE|INTERNALCMD))
                || !(efp.flags & AUTOCOMPLETE)
                || (!wizard() && (efp.flags & WIZMODECMD)))
                continue;
            if (!matchlevel || !strncmp(efp.ef_txt, cbuf, unsigned(matchlevel))) {
                choices[i] = efp;
                if ((len = int(strlen(efp.ef_desc))) > biggest)
                    biggest = len;
                if (++i > MAX_EXT_CMD) {
                    iflags.extmenu = FALSE;
                    return -1;
                }
            }
        }
        choices[i] = null;
        nchoices = i;
        /* if we're down to one, we have our selection so get out of here */
        if (nchoices  <= 1) {
            ret = (nchoices == 1) ? ptr_diff(choices[0], extcmdlist[0]) : -1;
            break;
        }

        /* otherwise... */
        win = create_nhwindow()(NHW_MENU);
        start_menu()(win, MENU_BEHAVE_STANDARD);
        sprintf(fmtstr, _("%%-%ds"), biggest + 15);
        chars[prompt + 0] = ord('\0');
        wastoolong = FALSE; /* True => had to wrap due to line width
                             * ('w' in wizard mode) */
        /* -3: two line menu header, 1 line menu footer (for prompt) */
        one_per_line = +(nchoices < ROWNO - 3);
        prevaccelerator = 0;
        acount = 0;
        for (i = 0; choices[i]; ++i) {
            accelerator = chars[choices[i].ef_txt + matchlevel];
            if (accelerator != prevaccelerator || one_per_line)
                wastoolong = FALSE;
            if (accelerator != prevaccelerator || one_per_line
                || (acount >= 2
                    /* +4: + sizeof " or " - sizeof "" */
                    && (unsigned(unsigned(strlen(prompt) + 4) + strlen(choices[i].ef_txt))
                        /* -6: enough room for 1 space left margin
                         *   + "%c - " menu selector + 1 space right margin */
                        >= min(sizeof(array_of(char, QBUFSZ)), COLNO - 6)))) {
                if (acount) {
                    /* flush extended cmds for that letter already in buf */
                    sprintf(buf, fmtstr, prompt);
                    any.a_char = prevaccelerator;
                    add_menu(win, nul_glyphinfo, any, any.a_char,
                             0, ATR_NONE, clr, buf, MENU_ITEMFLAGS_NONE);
                    acount = 0;
                    if (!(accelerator != prevaccelerator || one_per_line))
                        wastoolong = TRUE;
                }
            }
            prevaccelerator = accelerator;
            if (!acount || one_per_line) {
                sprintf(prompt, _("%s%s [%s]"), wastoolong ? _("or ") : _(""), choices[i].ef_txt, choices[i].ef_desc)
;
            } else if (acount == 1) {
                sprintf(prompt, _("%s%s or %s"), wastoolong ? _("or ") : _(""), choices[i - 1].ef_txt, choices[i].ef_txt)
;
            } else {
                strcat(prompt, _(" or "));
                strcat(prompt, choices[i].ef_txt);
            }
            ++acount;
        }
        if (acount) {
            /* flush buf */
            sprintf(buf, fmtstr, prompt);
            any.a_char = prevaccelerator;
            add_menu(win, nul_glyphinfo, any, any.a_char, 0,
                     ATR_NONE, clr, buf, MENU_ITEMFLAGS_NONE);
        }
        Snprintf(prompt, sizeof(array_of(char, QBUFSZ)), _("Extended Command: %s"), cbuf);
        end_menu()(win, prompt);
        n = select_menu(win, PICK_ONE, pick_list);
        destroy_nhwindow()(win);
        if (n == 1) {
            if (matchlevel > (QBUFSZ - 2)) {
                free(addr_of(pick_list[0]));

                ret = -1;
            } else {
                chars[cbuf + (matchlevel++)] = ptr_add(pick_list[0], 0).item.a_char;
                chars[cbuf + matchlevel] = ord('\0');
                free(addr_of(pick_list[0]));
            }
        } else {
            if (matchlevel) {
                ret = 0;
                matchlevel = 0;
            } else
                ret = -1;
        }
    }
    return ret;
    } finally { stack_pop($frame); }
}

/* #monster command - use special monster ability while polymorphed */
export function domonability() { /* int */
    let uptr = gy.youmonst.data;
    let might_hide = +(is_hider(uptr) || hides_under(uptr));
    let c = ord('\0');

    if (might_hide && webmaker(uptr)) {
        c = yn_function(_("Hide [h] or spin a web [s]?"),
                        hidespinchars, ord('q'), TRUE);
        if (c == ord('q') || c == ord('\x1b'))
            return ECMD_OK;
    }
    if (can_breathe(uptr))
        return dobreathe();
    else if (attacktype(uptr, AT_SPIT))
        return dospit();
    else if (uptr.mlet == S_NYMPH)
        return doremove();
    else if (attacktype(uptr, AT_GAZE))
        return dogaze();
    else if (is_were(uptr))
        return dosummon();
    else if (c ? c == ord('h') : might_hide)
        return dohide();
    else if (c ? c == ord('s') : webmaker(uptr))
        return dospinweb();
    else if (is_mind_flayer(uptr))
        return domindblast();
    else if (u.umonnum == PM_GREMLIN) {
        if (IS_FOUNTAIN(levl()[u.ux][u.uy].typ)) {
            if (split_mon(gy.youmonst, null))
                dryup(u.ux, u.uy, TRUE);
        } else if (is_pool(u.ux, u.uy)) {
            /* is_pool: might be wearing water walking boots or amulet of
               magical breathing */
            split_mon(gy.youmonst, null);
        } else {
            There(_("is no fountain here."));
        }
    } else if (is_unicorn(uptr)) {
        use_unicorn_horn(null);
        return ECMD_TIME;
    } else if (uptr.msound == MS_SHRIEK) {
        You(_("shriek."));
        if (u.uburied)
            pline(_("Unfortunately sound does not carry well through rock."));
        else
            aggravate();
    } else if (is_vampire(uptr) || is_vampshifter(gy.youmonst)) {
        return dopoly();
    } else if (u.usteed && can_breathe(u.usteed.data)) {
        pet_ranged_attk(u.usteed, TRUE);
        return ECMD_TIME;
    } else if (Upolyd()) {
        pline(_("Any special ability you may have is purely reflexive."));
    } else {
        You(_("don't have a special ability in your normal form!"));
    }
    return ECMD_OK;
}

export function enter_explore_mode() { /* int */
    if (discover()) {
        You(_("are already in explore mode."));
    } else {
        let oldmode = !wizard() ? _("normal game") : _("debug mode");

        if (!authorize_explore_mode()) {
            if (!wizard()) {
                You(_("cannot access explore mode."));
                return ECMD_OK;
            } else {
                pline(
                 _("Note: normally you wouldn't be allowed into explore mode."));
                /* keep going */
            }
        }
        pline(_("Beware!  From explore mode there will be no return to %s,"),
              oldmode);
        if (paranoid_query(ParanoidQuit(),
                           _("Do you want to enter explore mode?"))) {
            flags.explore = TRUE;
            flags.debug = FALSE;
            clear_nhwindow()(WIN_MESSAGE);
            You(_("are now in non-scoring explore mode."));
        } else {
            clear_nhwindow()(WIN_MESSAGE);
            pline(_("Continuing with %s."), oldmode);
        }
    }
    return ECMD_OK;
}

export function makemap_prepost(pre, wiztower) { /* void */
    let tmpnhfp;
    let mtmp;

    if (pre) {
        makemap_remove_mons();
        rm_mapseen(ledger_no(u.uz)); /* discard overview info for level */
        {
            let Unachieve = init_string(static_array("makemap_prepost.Unachieve", char, sizeof_string("%s achievement revoked.")), _("%s achievement revoked."), true);

            /* achievement tracking; if replacing a level that has a
               special prize, lose credit for previously finding it and
               reset for the new instance of that prize */
            if (Is_mineend_level(u.uz)) {
                if (remove_achievement(ACH_MINE_PRIZE))
                    pline(Unachieve, _("Mine's-end"));
                svc.context.achieveo.mines_prize_oid = 0;
            } else if (Is_sokoend_level(u.uz)) {
                if (remove_achievement(ACH_SOKO_PRIZE))
                    pline(Unachieve, _("Soko-prize"));
                svc.context.achieveo.soko_prize_oid = 0;
            }
        }
        if (Punished()) {
            ballrelease(FALSE);
            unplacebc();
        }
        /* reset lock picking unless it's for a carried container */
        maybe_reset_pick(null);
        /* reset interrupted digging if it was taking place on this level */
        if (on_level(svc.context.digging.level, u.uz))
            memset(addr_of(svc.context.digging), 0,
                          sizeof(struct_dig_info));
        /* reset cached targets */
        iflags.travelcc.x = iflags.travelcc.y = 0; /* travel destination */
        svc.context.polearm.hitmon = null; /* polearm target */
        /* escape from trap */
        reset_utrap(FALSE);
        check_special_room(TRUE); /* room exit */
        memset(addr_of(svd.dndest), 0, sizeof(struct_dest_area));
        memset(addr_of(svu.updest), 0, sizeof(struct_dest_area));
        u.ustuck = null;
        u.uswallow = u.uswldtim = 0;
        set_uinwater(0); /* u.uinwater = 0 */
        u.uundetected = 0; /* not hidden, even if means are available */
        dmonsfree(); /* purge dead monsters from 'fmon' */
        dobjsfree();

        /* discard current level; "saving" is used to release dynamic data */
        tmpnhfp = get_freeing_nhfile();
        savelev(tmpnhfp, ledger_no(u.uz));
        close_nhfile(tmpnhfp);
    } else {
        vision_reset();
        gv.vision_full_recalc = 1;
        cls();
        /* was using safe_teleds() but that doesn't honor arrival region
           on levels which have such; we don't force stairs, just area */
        u_on_rndspot((u.uhave.amulet ? 1 : 0) /* 'going up' flag */
                     | (wiztower ? 2 : 0));
        losedogs();
        kill_genocided_monsters();
        /* u_on_rndspot() might pick a spot that has a monster, or losedogs()
           might pick the hero's spot (only if there isn't already a monster
           there), so we might have to move hero or the co-located monster */
        if ((mtmp = m_at(u.ux, u.uy)) != null)
            u_collide_m(mtmp);
        initrack();
        if (Punished()) {
            unplacebc();
            placebc();
        }
        docrt();
        flush_screen(1);
        deliver_splev_message(); /* level entry */
        check_special_room(FALSE); /* room entry */

        save_currentstate();
    }
}

/* temporary? hack, since level type codes aren't the same as screen
   symbols and only the latter have easily accessible descriptions.
   Also used by wizcmds.c */
export const levltyp = static_array("levltyp", ptr_to(char), MAX_TYPE + 2, [
    _("stone"), _("vertical wall"), _("horizontal wall"), _("top-left corner wall"),
    _("top-right corner wall"), _("bottom-left corner wall"),
    _("bottom-right corner wall"), _("cross wall"), _("tee-up wall"), _("tee-down wall"),
    _("tee-left wall"), _("tee-right wall"), _("drawbridge wall"), _("tree"),
    _("secret door"), _("secret corridor"), _("pool"), _("moat"), _("water"),
    _("drawbridge up"), _("lava pool"), _("lava wall"), _("iron bars"), _("door"),
    _("corridor"), _("room"), _("stairs"), _("ladder"), _("fountain"), _("throne"), _("sink"),
    _("grave"), _("altar"), _("ice"), _("drawbridge down"), _("air"), _("cloud"),
    /* not a real terrain type, but used for undiggable stone
       by wiz_map_levltyp() */
    _("unreachable/undiggable"),
    /* padding in case the number of entries above is odd */
    _("")
]);

export function levltyp_to_name(typ) { /* const char * */
    if (typ >= 0 && typ < MAX_TYPE)
        return levltyp[typ];
    return 0;
}

/* #terrain command -- show known map, inspired by crawl's '|' command */
function doterrain() { /* int */
    const $frame = stack_frame(); try {
    let men;
    let sel = stack_var(ptr_to(struct_mi));
    let any = stack_struct(struct_any);
    let n;
    let which;
    let clr = NO_COLOR;

    /* this used to be done each time vision was recalculated, so would
       always be up to date (hopefully); now we do it on demand instead */
    recalc_mapseen();

    /*
     * normal play: choose between known map without mons, obj, and traps
     *  (to see underlying terrain only), or
     *  known map without mons and objs (to see traps under mons and objs), or
     *  known map without mons (to see objects under monsters);
     * explore mode: normal choices plus full map (w/o mons, objs, traps);
     * wizard mode: normal and explore choices plus
     *  a dump of the internal levl[][].typ codes w/ level flags, or
     *  a legend for the levl[][].typ codes dump
     */
    men = create_nhwindow()(NHW_MENU);
    start_menu()(men, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    any.a_int = 1;
    add_menu(men, nul_glyphinfo, any, 0, 0, ATR_NONE, clr,
             _("known map without monsters, objects, and traps"),
             MENU_ITEMFLAGS_SELECTED);
    any.a_int = 2;
    add_menu(men, nul_glyphinfo, any, 0, 0, ATR_NONE,
             clr, _("known map without monsters and objects"),
             MENU_ITEMFLAGS_NONE);
    any.a_int = 3;
    add_menu(men, nul_glyphinfo, any, 0, 0, ATR_NONE,
             clr, _("known map without monsters"),
             MENU_ITEMFLAGS_NONE);
    if (discover() || wizard()) {
        any.a_int = 4;
        add_menu(men, nul_glyphinfo, any, 0, 0, ATR_NONE,
                 clr, _("full map without monsters, objects, and traps"),
                 MENU_ITEMFLAGS_NONE);
        if (wizard()) {
            any.a_int = 5;
            add_menu(men, nul_glyphinfo, any, 0, 0, ATR_NONE,
                     clr, _("internal levl[][].typ codes in base-36"),
                     MENU_ITEMFLAGS_NONE);
            any.a_int = 6;
            add_menu(men, nul_glyphinfo, any, 0, 0, ATR_NONE,
                     clr, _("legend of base-36 levl[][].typ codes"),
                     MENU_ITEMFLAGS_NONE);
        }
    }
    end_menu()(men, _("View which?"));

    n = select_menu(men, PICK_ONE, sel);
    destroy_nhwindow()(men);
    /*
     * n <  0: player used ESC to cancel;
     * n == 0: preselected entry was explicitly chosen and got toggled off;
     * n == 1: preselected entry was implicitly chosen via <space>|<enter>;
     * n == 2: another entry was explicitly chosen, so skip preselected one.
     */
    which = (n < 0) ? -1 : (n == 0) ? 1 : ptr_add(sel[0], 0).item.a_int;
    if (n > 1 && which == 1)
        which = ptr_add(sel[0], 1).item.a_int;
    if (n > 0)
        free(addr_of(sel[0]));

    switch (which) {
    case 1: /* known map */
        reveal_terrain(TER_MAP);
        break;
    case 2: /* known map with known traps */
        reveal_terrain(TER_MAP | TER_TRP);
        break;
    case 3: /* known map with known traps and objects */
        reveal_terrain(TER_MAP | TER_TRP | TER_OBJ);
        break;
    case 4: /* full map */
        reveal_terrain(TER_MAP | TER_FULL);
        break;
    case 5: /* map internals */
        wiz_map_levltyp();
        break;
    case 6: /* internal details */
        wiz_levltyp_legend();
        break;
    default:
        break;
    }
    return ECMD_OK; /* no time elapses */
    } finally { stack_pop($frame); }
}

/* has hero seen all locations in selection? */
function u_have_seen_whole_selection(sel) { /* boolean */
    const $frame = stack_frame(); try {
    let x, y;
    let rect = struct_assign(stack_struct(struct_nhrect), cg.zeroNhRect);

    selection_getbounds(sel, rect);

    for (x = rect.lx; x <= rect.hx; x++)
        for (y = rect.ly; y <= rect.hy; y++)
            if (isok(x,y) && selection_getpoint(x, y, sel)
                && glyph_at(x, y) == GLYPH_UNEXPLORED)
                return FALSE;

    return TRUE;
    } finally { stack_pop($frame); }
}

/* has hero seen all location of the rectangular outline in the selection */
function u_have_seen_bounds_selection(sel) { /* boolean */
    const $frame = stack_frame(); try {
    let x, y;
    let rect = struct_assign(stack_struct(struct_nhrect), cg.zeroNhRect);

    selection_getbounds(sel, rect);

    for (x = rect.lx; x <= rect.hx; x++) {
        y = rect.ly;
        if (isok(x,y) && selection_getpoint(x, y, sel)
            && glyph_at(x, y) == GLYPH_UNEXPLORED)
            return FALSE;
        y = rect.hy;
        if (isok(x,y) && selection_getpoint(x, y, sel)
            && glyph_at(x, y) == GLYPH_UNEXPLORED)
            return FALSE;
    }
    for (y = rect.ly; y <= rect.hy; y++) {
        x = rect.lx;
        if (isok(x,y) && selection_getpoint(x, y, sel)
            && glyph_at(x, y) == GLYPH_UNEXPLORED)
            return FALSE;
        x = rect.hx;
        if (isok(x,y) && selection_getpoint(x, y, sel)
            && glyph_at(x, y) == GLYPH_UNEXPLORED)
            return FALSE;
    }

    return TRUE;
    } finally { stack_pop($frame); }
}

/* can hero currently see all locations in the selection */
function u_can_see_whole_selection(sel) { /* boolean */
    const $frame = stack_frame(); try {
    let x, y;
    let rect = struct_assign(stack_struct(struct_nhrect), cg.zeroNhRect);

    selection_getbounds(sel, rect);

    for (x = rect.lx; x <= rect.hx; x++)
        for (y = rect.ly; y <= rect.hy; y++)
            if (isok(x,y) && selection_getpoint(x, y, sel) && !cansee(x, y))
                return FALSE;

    return TRUE;
    } finally { stack_pop($frame); }
}

/* selection_floofill callback to get all locations in a room */
function dolookaround_floodfill_findroom(x, y) { /* int */
    let typ = levl()[x][y].typ;

    if (IS_STWALL(typ) || IS_DOOR(typ) || IS_TREE(typ)
        || IS_WATERWALL(typ) || typ == LAVAWALL || typ == IRONBARS
        || typ == SCORR || typ == SDOOR || typ == DRAWBRIDGE_UP)
        return FALSE;
    return TRUE;
}

/* describe the room at x,y */
function lookaround_known_room(x, y) { /* void */
    const $frame = stack_frame(); try {
    let sel = selection_new();
    let rmno = chars[u.urooms + 0] - ROOMOFFSET;
    let qbuf = stack_array(char, QBUFSZ);

    set_selection_floodfillchk(dolookaround_floodfill_findroom);
    selection_floodfill(sel, x, y, TRUE);

    if (!u_at(x, y))
        set_msg_xy(x, y);

    if (u_have_seen_whole_selection(sel)) {
        let u_in = boolean(selection_getpoint(x, y, sel));

        You(_("%s %s %s."),
            u_at(x, y) && u_in && u_can_see_whole_selection(sel) ? _("are in")
            : u_at(x, y) ? _("remember this as") : _("remember that as"),
            an(selection_size_description(sel, qbuf)),
            rmno >= 0 ? _("room") : _("area"));
    } else if (u_have_seen_bounds_selection(sel)) {
        You(_("guess %s to be %s %s."),
            u_at(x, y) ? _("this") : _("that"),
            an(selection_size_description(sel, qbuf)),
            rmno >= 0 ? _("room") : _("area"));
    } else {
        You(_("can't guess the size of %s area."),
            u_at(x, y) ? _("this") : _("that"));
    }
    selection_free(sel, TRUE);
    } finally { stack_pop($frame); }
}

/* #lookaround - describe what the hero can see, in text */
export function dolookaround() { /* int */
    const $frame = stack_frame(); try {
    let x, y;
    let tmp_getloc_filter = iflags.getloc_filter;
    let tmp_accessiblemsg = a11y.accessiblemsg;
    let corr_next2u = FALSE;

    a11y.accessiblemsg = TRUE;
    if (levl()[u.ux][u.uy].typ == CORR) {
        /* In a corridor, mention corridors next to you. */
        corr_next2u = TRUE;
        /* TODO: if we know, describe where the corridor goes,
           perhaps by describing the rooms? */
    } else if (IS_DOOR(levl()[u.ux][u.uy].typ)) {
        /* In a doorway, describe the rooms next to you */
        let i;

        for (i = DIR_W; i < N_DIRS; i += 2) {
            x = u.ux + chars[xdir + i];
            y = u.uy + chars[ydir + i];
            if (isok(x, y) && IS_ROOM(levl()[x][y].typ))
                lookaround_known_room(x, y);
        }
        corr_next2u = TRUE;
    } else {
        lookaround_known_room(u.ux, u.uy);
    }

    /* TODO: maybe describe stuff outside the current room differently? */

    iflags.getloc_filter = GFILTER_VIEW;
    for (y = 0; y < ROWNO; y++)
        for (x = 1; x < COLNO; x++) {
            let glyph, mapsym;
            let iscorr = (corr_next2u
                              && (glyph = glyph_at(x, y)) >= 0
                              && glyph_is_cmap(glyph)
                              && ((mapsym = glyph_to_cmap(glyph)) == S_corr
                                   || mapsym == S_litcorr) ? 1 : 0);

            if (!u_at(x, y)
                && (gather_locs_interesting(x, y, GLOC_INTERESTING)
                    /* note: GLOC_INTERESTING catches S_engrcorr */
                    || iscorr)) {
                let buf = stack_array(char, BUFSZ);
                let cc = stack_struct(struct_nhcoord);
                let sym = 0;
                let firstmatch = stack_var(ptr_to(char), 0);

                cc.x = x, cc.y = y;
                do_screen_description(struct_copy(cc), TRUE, sym, buf, firstmatch, null);
                pline_xy(x, y, _("%s."), firstmatch[0]);
            }
        }

    iflags.getloc_filter = tmp_getloc_filter;
    a11y.accessiblemsg = tmp_accessiblemsg;

    return ECMD_OK;
    } finally { stack_pop($frame); }
}

/* #toggle extended command

   BIND=':toggle(price_quotes)
   BIND=@:toggle(autopickup) */
export function dotoggleoption() { /* int */
    if (gc.cmd_bind && gc.cmd_bind.param) {
        return toggle_bool_option(gc.cmd_bind.param);
    } else {
        pline(_("Use #optionsfull to set any option instead."));
        return ECMD_OK;
    }
}

export function set_move_cmd(dir, run) { /* void */
    u.dz = chars[zdir + dir];
    u.dx = chars[xdir + dir];
    u.dy = chars[ydir + dir];
    /* #reqmenu -prefix disables autopickup during movement */
    if (iflags.menu_requested)
        svc.context.nopick = 1;
    svc.context.travel = svc.context.travel1 = 0;
    if (!gd.domove_attempting && !u.dz) {
        svc.context.run = unsigned(run);
        gd.domove_attempting = or64(gd.domove_attempting, (!run ? DOMOVE_WALK : DOMOVE_RUSH));
    }
}

/* move or attack */
export function do_move_west() { /* int */
    set_move_cmd(DIR_W, 0);
    return ECMD_TIME;
}

export function do_move_northwest() { /* int */
    set_move_cmd(DIR_NW, 0);
    return ECMD_TIME;
}

export function do_move_north() { /* int */
    set_move_cmd(DIR_N, 0);
    return ECMD_TIME;
}

export function do_move_northeast() { /* int */
    set_move_cmd(DIR_NE, 0);
    return ECMD_TIME;
}

export function do_move_east() { /* int */
    set_move_cmd(DIR_E, 0);
    return ECMD_TIME;
}

export function do_move_southeast() { /* int */
    set_move_cmd(DIR_SE, 0);
    return ECMD_TIME;
}

export function do_move_south() { /* int */
    set_move_cmd(DIR_S, 0);
    return ECMD_TIME;
}

export function do_move_southwest() { /* int */
    set_move_cmd(DIR_SW, 0);
    return ECMD_TIME;
}

/* rush */
export function do_rush_west() { /* int */
    set_move_cmd(DIR_W, 3);
    return ECMD_TIME;
}

export function do_rush_northwest() { /* int */
    set_move_cmd(DIR_NW, 3);
    return ECMD_TIME;
}

export function do_rush_north() { /* int */
    set_move_cmd(DIR_N, 3);
    return ECMD_TIME;
}

export function do_rush_northeast() { /* int */
    set_move_cmd(DIR_NE, 3);
    return ECMD_TIME;
}

export function do_rush_east() { /* int */
    set_move_cmd(DIR_E, 3);
    return ECMD_TIME;
}

export function do_rush_southeast() { /* int */
    set_move_cmd(DIR_SE, 3);
    return ECMD_TIME;
}

export function do_rush_south() { /* int */
    set_move_cmd(DIR_S, 3);
    return ECMD_TIME;
}

export function do_rush_southwest() { /* int */
    set_move_cmd(DIR_SW, 3);
    return ECMD_TIME;
}

/* run */
export function do_run_west() { /* int */
    set_move_cmd(DIR_W, 1);
    return ECMD_TIME;
}

export function do_run_northwest() { /* int */
    set_move_cmd(DIR_NW, 1);
    return ECMD_TIME;
}

export function do_run_north() { /* int */
    set_move_cmd(DIR_N, 1);
    return ECMD_TIME;
}

export function do_run_northeast() { /* int */
    set_move_cmd(DIR_NE, 1);
    return ECMD_TIME;
}

export function do_run_east() { /* int */
    set_move_cmd(DIR_E, 1);
    return ECMD_TIME;
}

export function do_run_southeast() { /* int */
    set_move_cmd(DIR_SE, 1);
    return ECMD_TIME;
}

export function do_run_south() { /* int */
    set_move_cmd(DIR_S, 1);
    return ECMD_TIME;
}

export function do_run_southwest() { /* int */
    set_move_cmd(DIR_SW, 1);
    return ECMD_TIME;
}

/* #reqmenu, prefix command to modify some others */
export function do_reqmenu() { /* int */
    if (iflags.menu_requested) {
        Norep(_("Double %s prefix, canceled."),
              visctrl(cmd_from_func(do_reqmenu)));
        iflags.menu_requested = FALSE;
        return ECMD_CANCEL;
    }

    iflags.menu_requested = TRUE;
    return ECMD_OK;
}

/* #rush */
export function do_rush() { /* int */
    if ((gd.domove_attempting & DOMOVE_RUSH)) {
        Norep(_("Double rush prefix, canceled."));
        svc.context.run = 0;
        gd.domove_attempting = 0;
        return ECMD_CANCEL;
    }

    svc.context.run = 2;
    gd.domove_attempting = or64(gd.domove_attempting, DOMOVE_RUSH);
    return ECMD_OK;
}

/* #run */
export function do_run() { /* int */
    if ((gd.domove_attempting & DOMOVE_RUSH)) {
        Norep(_("Double run prefix, canceled."));
        svc.context.run = 0;
        gd.domove_attempting = 0;
        return ECMD_CANCEL;
    }

    svc.context.run = 3;
    gd.domove_attempting = or64(gd.domove_attempting, DOMOVE_RUSH);
    return ECMD_OK;
}

/* #fight */
export function do_fight() { /* int */
    if (svc.context.forcefight) {
        Norep(_("Double fight prefix, canceled."));
        svc.context.forcefight = 0;
        gd.domove_attempting = 0;
        return ECMD_CANCEL;
    }

    svc.context.forcefight = 1;
    gd.domove_attempting = or64(gd.domove_attempting, DOMOVE_WALK);
    return ECMD_OK;
}

/* #repeat */
export function do_repeat() { /* int */
    let res = ECMD_OK;

    if (!gi.in_doagain) {
        let repeat_copy;

        if (!cmdq_peek(CQ_REPEAT)) {
            Norep(_("There is no command available to repeat."));
            return ECMD_FAIL;
        }
        repeat_copy = cmdq_copy(CQ_REPEAT);
        gi.in_doagain = TRUE;
        rhack(0); /* read and execute command */
        gi.in_doagain = FALSE;
        cmdq_clear(CQ_REPEAT);
        gc.command_queue[CQ_REPEAT] = repeat_copy;
        iflags.menu_requested = FALSE;
        if (svc.context.move)
            res = ECMD_TIME;
    }
    return res;
}

/* extcmdlist: full command list, ordered by command name;
   commands with no keystroke or with only a meta keystroke generally
   need to be flagged as autocomplete and ones with a regular keystroke
   or control keystroke generally should not be; there are a few exceptions
   such as ^O/#overview and C/N/#name */
export const extcmdlist = static_array("extcmdlist", struct_ext_func_tab, null, [
    { key: ord('#'),    ef_txt: _("#"), ef_desc: _("enter and perform an extended command"),
              ef_funct: doextcmd, flags: IFBURIED | GENERALCMD | CMD_M_PREFIX, f_text: 0 },
    { key: uchar(M(ord('?'))), ef_txt: _("?"), ef_desc: _("list all extended commands"),
              ef_funct: doextlist, flags: IFBURIED | AUTOCOMPLETE | GENERALCMD | CMD_M_PREFIX,
              f_text: 0 },
    { key: uchar(M(ord('a'))), ef_txt: _("adjust"), ef_desc: _("adjust inventory letters"),
              ef_funct: doorganize, flags: IFBURIED | AUTOCOMPLETE | GENERALCMD, f_text: 0 },
    { key: uchar(M(ord('A'))), ef_txt: _("annotate"), ef_desc: _("name current level"),
              ef_funct: donamelevel, flags: IFBURIED | AUTOCOMPLETE | GENERALCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord('a'),    ef_txt: _("apply"), ef_desc: _("apply (use) a tool (pick-axe, key, lamp...)"),
              ef_funct: doapply, flags: CMD_M_PREFIX, f_text: 0 },
    { key: C(ord('x')), ef_txt: _("attributes"), ef_desc: _("show your attributes"),
              ef_funct: doattributes, flags: IFBURIED | GENERALCMD, f_text: 0 },
    { key: ord('@'),    ef_txt: _("autopickup"), ef_desc: _("toggle the 'autopickup' option on/off"),
              ef_funct: dotogglepickup, flags: IFBURIED | GENERALCMD, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("bugreport"), ef_desc: _("file a bug report"),
              ef_funct: dobugreport, flags: GENERALCMD | NOFUZZERCMD, f_text: 0 },
    { key: ord('C'),    ef_txt: _("call"), ef_desc: _("name a monster, specific object, or type of object"),
              ef_funct: docallcmd, flags: IFBURIED | GENERALCMD, f_text: 0 },
    { key: ord('Z'),    ef_txt: _("cast"), ef_desc: _("zap (cast) a spell"),
              ef_funct: docast, flags: IFBURIED, f_text: 0 },
    { key: uchar(M(ord('c'))), ef_txt: _("chat"), ef_desc: _("talk to someone"),
              ef_funct: dotalk, flags: IFBURIED | AUTOCOMPLETE, f_text: 0 },
    { key: ord('v'),    ef_txt: _("chronicle"), ef_desc: _("show journal of major events"),
              ef_funct: do_gamelog, flags: IFBURIED | AUTOCOMPLETE | GENERALCMD, f_text: 0 },
    { key: ord('c'),    ef_txt: _("close"), ef_desc: _("close a door"),
              ef_funct: doclose, flags: 0, f_text: 0 },
    { key: uchar(M(ord('C'))), ef_txt: _("conduct"), ef_desc: _("list voluntary challenges you have maintained"),
              ef_funct: doconduct, flags: IFBURIED | AUTOCOMPLETE | GENERALCMD, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("debugfuzzer"), ef_desc: _("start the fuzz tester"),
              ef_funct: wiz_fuzzer, flags: IFBURIED | WIZMODECMD | NOFUZZERCMD, f_text: 0 },
    { key: uchar(M(ord('d'))), ef_txt: _("dip"), ef_desc: _("dip an object into something"),
              ef_funct: dodip, flags: AUTOCOMPLETE | CMD_M_PREFIX, f_text: 0 },
    { key: ord('>'),    ef_txt: _("down"), ef_desc: _("go down a staircase"),
              /* allows 'm' prefix (for move without autopickup) but not the
                 g/G/F movement modifiers; not flagged as MOVEMENTCMD because
                 that would suppress it from dokeylist output */
              ef_funct: dodown, flags: CMD_M_PREFIX, f_text: 0 },
    { key: ord('d'),    ef_txt: _("drop"), ef_desc: _("drop an item"),
              ef_funct: dodrop, flags: 0, f_text: 0 },
    { key: ord('D'),    ef_txt: _("droptype"), ef_desc: _("drop specific item types"),
              ef_funct: doddrop, flags: 0, f_text: 0 },
    { key: ord('e'),    ef_txt: _("eat"), ef_desc: _("eat something"),
              ef_funct: doeat, flags: CMD_M_PREFIX, f_text: 0 },
    { key: ord('E'),    ef_txt: _("engrave"), ef_desc: _("engrave writing on the floor"),
              ef_funct: doengrave, flags: 0, f_text: 0 },
    { key: uchar(M(ord('e'))), ef_txt: _("enhance"), ef_desc: _("advance or check weapon and spell skills"),
              ef_funct: enhance_weapon_skill, flags: IFBURIED | AUTOCOMPLETE | GENERALCMD, f_text: 0 },
    /* #exploremode should be flagged AUTOCOMPETE but that would negatively
       impact frequently used #enhance by making #e become ambiguous */
    { key: uchar(M(ord('X'))), ef_txt: _("exploremode"), ef_desc: _("enter explore (discovery) mode"),
              ef_funct: enter_explore_mode, flags: IFBURIED | GENERALCMD | NOFUZZERCMD, f_text: 0 },
    { key: ord('F'),    ef_txt: _("fight"), ef_desc: _("prefix: force fight even if you don't see a monster"),
              ef_funct: do_fight, flags: PREFIXCMD, f_text: 0 },
    { key: ord('f'),    ef_txt: _("fire"), ef_desc: _("fire ammunition from quiver"),
              ef_funct: dofire, flags: 0, f_text: 0 },
    { key: uchar(M(ord('f'))), ef_txt: _("force"), ef_desc: _("force a lock"),
              ef_funct: doforce, flags: AUTOCOMPLETE, f_text: 0 },
    { key: uchar(M(ord('g'))), ef_txt: _("genocided"),
              ef_desc: _("list monsters that have been genocided or become extinct"),
              ef_funct: dogenocided,
              flags: IFBURIED | AUTOCOMPLETE | GENERALCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord(';'),    ef_txt: _("glance"), ef_desc: _("show what type of thing a map symbol corresponds to"),
              ef_funct: doquickwhatis, flags: IFBURIED | GENERALCMD, f_text: 0 },
    { key: ord('?'),    ef_txt: _("help"), ef_desc: _("give a help message"),
              ef_funct: dohelp, flags: IFBURIED | GENERALCMD, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("herecmdmenu"), ef_desc: _("show menu of commands you can do here"),
              ef_funct: doherecmdmenu, flags: IFBURIED | AUTOCOMPLETE | GENERALCMD, f_text: 0 },
    { key: ord('\0'),    ef_txt: _("history"), ef_desc: _("show a summary of the game's development"),
              ef_funct: dohistory, flags: IFBURIED | AUTOCOMPLETE | GENERALCMD, f_text: 0 },
    { key: ord('i'),    ef_txt: _("inventory"), ef_desc: _("show your inventory"),
              ef_funct: ddoinv, flags: IFBURIED | GENERALCMD, f_text: 0 },
    { key: ord('I'),    ef_txt: _("inventtype"), ef_desc: _("show inventory of one specific item class"),
              ef_funct: dotypeinv, flags: IFBURIED | GENERALCMD, f_text: 0 },
    { key: uchar(M(ord('i'))), ef_txt: _("invoke"), ef_desc: _("invoke an object's special powers"),
              ef_funct: doinvoke, flags: IFBURIED | AUTOCOMPLETE, f_text: 0 },
    { key: uchar(M(ord('j'))), ef_txt: _("jump"), ef_desc: _("jump to another location"),
              ef_funct: dojump, flags: AUTOCOMPLETE, f_text: 0 },
    { key: C(ord('d')), ef_txt: _("kick"), ef_desc: _("kick something"),
              ef_funct: dokick, flags: 0, f_text: 0 },
    { key: ord('\\'),   ef_txt: _("known"), ef_desc: _("show what object types have been discovered"),
              ef_funct: dodiscovered, flags: IFBURIED | GENERALCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord('`'),    ef_txt: _("knownclass"), ef_desc: _("show discovered types for one class of objects"),
              ef_funct: doclassdisco, flags: IFBURIED | GENERALCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("levelchange"), ef_desc: _("change experience level"),
              ef_funct: wiz_level_change, flags: IFBURIED | AUTOCOMPLETE | WIZMODECMD, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("lightsources"), ef_desc: _("show mobile light sources"),
              ef_funct: wiz_light_sources, flags: IFBURIED | AUTOCOMPLETE | WIZMODECMD, f_text: 0 },
    { key: ord(':'),    ef_txt: _("look"), ef_desc: _("look at what is here"),
              ef_funct: dolook, flags: IFBURIED, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("lookaround"), ef_desc: _("describe what you can see"),
              ef_funct: dolookaround, flags: IFBURIED | GENERALCMD, f_text: 0 },
    { key: uchar(M(ord('l'))), ef_txt: _("loot"), ef_desc: _("loot a box on the floor"),
              ef_funct: doloot, flags: AUTOCOMPLETE | CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("migratemons"),

              ef_desc: _("show migrating monsters and migrate N random ones"),

              ef_funct: wiz_migrate_mons, flags: IFBURIED | AUTOCOMPLETE | WIZMODECMD, f_text: 0 },
    { key: uchar(M(ord('m'))), ef_txt: _("monster"), ef_desc: _("use monster's special ability"),
              ef_funct: domonability, flags: IFBURIED | AUTOCOMPLETE, f_text: 0 },
    { key: uchar(M(ord('n'))), ef_txt: _("name"), ef_desc: _("same as call; name a monster or object or object type"),
              ef_funct: docallcmd, flags: IFBURIED | AUTOCOMPLETE | GENERALCMD, f_text: 0 },
    { key: uchar(M(ord('o'))), ef_txt: _("offer"), ef_desc: _("offer a sacrifice to the gods"),
              ef_funct: dosacrifice, flags: AUTOCOMPLETE | CMD_M_PREFIX, f_text: 0 },
    { key: ord('o'),    ef_txt: _("open"), ef_desc: _("open a door"),
              ef_funct: doopen, flags: 0, f_text: 0 },
    /* 'm #options' runs doset() */
    { key: ord('O'),    ef_txt: _("options"), ef_desc: _("show option settings"),
              ef_funct: doset_simple, flags: IFBURIED | GENERALCMD | CMD_M_PREFIX, f_text: 0 },
    /* 'm #optionsfull' runs doset_simple() */
    { key: ord('\0'),   ef_txt: _("optionsfull"), ef_desc: _("show all option settings, possibly change them"),
              ef_funct: doset, flags: IFBURIED | GENERALCMD | CMD_M_PREFIX, f_text: 0 },
    /* #overview used to need autocomplete and has retained that even
       after being assigned to ^O [old wizard mode ^O is now #wizwhere];
       'm' prefix displays overview as a menu where player can choose a
       level to supply with an annotation */
    { key: C(ord('o')), ef_txt: _("overview"), ef_desc: _("show a summary of the explored dungeon"),
              ef_funct: dooverview,
              flags: IFBURIED | AUTOCOMPLETE | GENERALCMD | CMD_M_PREFIX, f_text: 0 },
    /* [should #panic actually autocomplete?] */
    { key: ord('\0'),   ef_txt: _("panic"), ef_desc: _("test panic routine (fatal to game)"),
              ef_funct: wiz_panic, flags: IFBURIED | AUTOCOMPLETE | WIZMODECMD, f_text: 0 },
    { key: ord('p'),    ef_txt: _("pay"), ef_desc: _("pay your shopping bill"),
              ef_funct: dopay, flags: CMD_M_PREFIX, f_text: 0 },
    { key: ord('|'),    ef_txt: _("perminv"), ef_desc: _("scroll persistent inventory display"),
              ef_funct: doperminv, flags: IFBURIED | GENERALCMD | NOFUZZERCMD, f_text: 0 },
    { key: ord(','),    ef_txt: _("pickup"), ef_desc: _("pick up things at the current location"),
              ef_funct: dopickup, flags: CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("polyself"), ef_desc: _("polymorph self"),
              ef_funct: wiz_polyself, flags: IFBURIED | AUTOCOMPLETE | WIZMODECMD, f_text: 0 },
    { key: uchar(M(ord('p'))), ef_txt: _("pray"), ef_desc: _("pray to the gods for help"),
              ef_funct: dopray, flags: IFBURIED | AUTOCOMPLETE, f_text: 0 },
    { key: C(ord('p')), ef_txt: _("prevmsg"), ef_desc: _("view recent game messages"),
              ef_funct: doprev_message, flags: IFBURIED | GENERALCMD | CMD_INSANE, f_text: 0 },
    { key: ord('P'),    ef_txt: _("puton"), ef_desc: _("put on an accessory (ring, amulet, etc)"),
              ef_funct: doputon, flags: 0, f_text: 0 },
    { key: ord('q'),    ef_txt: _("quaff"), ef_desc: _("quaff (drink) something"),
              ef_funct: dodrink, flags: CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("quit"), ef_desc: _("exit without saving current game"),
              ef_funct: done2, flags: IFBURIED | AUTOCOMPLETE | GENERALCMD | NOFUZZERCMD,
              f_text: 0 },
    { key: ord('Q'),    ef_txt: _("quiver"), ef_desc: _("select ammunition for quiver"),
              ef_funct: dowieldquiver, flags: 0, f_text: 0 },
    { key: ord('r'),    ef_txt: _("read"), ef_desc: _("read a scroll or spellbook"),
              ef_funct: doread, flags: 0, f_text: 0 },
    { key: C(ord('r')), ef_txt: _("redraw"), ef_desc: _("redraw screen"),
              ef_funct: doredraw, flags: IFBURIED | GENERALCMD | CMD_INSANE, f_text: 0 },
    { key: ord('R'),    ef_txt: _("remove"), ef_desc: _("remove an accessory (ring, amulet, etc)"),
              ef_funct: doremring, flags: 0, f_text: 0 },
    { key: C(ord('a')), ef_txt: _("repeat"), ef_desc: _("repeat a previous command"),
              ef_funct: do_repeat, flags: IFBURIED | GENERALCMD, f_text: 0 },
    /* "modify command" is a vague description for use as no-autopickup,
       no-attack movement as well as miscellaneous non-movement things;
       key2extcmddesc() constructs a more explicit two line description
       for display by the '&' command and expects to find "prefix:" as
       the start of the text here */
    { key: ord('m'),    ef_txt: _("reqmenu"), ef_desc: _("prefix: request menu or modify command"),
              ef_funct: do_reqmenu, flags: PREFIXCMD, f_text: 0 },
    { key: C(ord('_')), ef_txt: _("retravel"), ef_desc: _("travel to previously selected travel location"),
              ef_funct: dotravel_target, flags: 0, f_text: 0 },
    { key: uchar(M(ord('R'))), ef_txt: _("ride"), ef_desc: _("mount or dismount a saddled steed"),
              ef_funct: doride, flags: AUTOCOMPLETE, f_text: 0 },
    { key: uchar(M(ord('r'))), ef_txt: _("rub"), ef_desc: _("rub a lamp or a stone"),
              ef_funct: dorub, flags: AUTOCOMPLETE, f_text: 0 },
    { key: ord('G'),    ef_txt: _("run"), ef_desc: _("prefix: run until something interesting is seen"),
              ef_funct: do_run, flags: PREFIXCMD, f_text: 0 },
    { key: ord('g'),    ef_txt: _("rush"), ef_desc: _("prefix: rush until something interesting is seen"),
              ef_funct: do_rush, flags: PREFIXCMD, f_text: 0 },
    { key: ord('S'),    ef_txt: _("save"), ef_desc: _("save the game and exit"),
              ef_funct: dosave, flags: IFBURIED | GENERALCMD | NOFUZZERCMD, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("saveoptions"), ef_desc: _("save the game configuration"),
              ef_funct: do_write_config_file,
              flags: IFBURIED | GENERALCMD | NOFUZZERCMD, f_text: 0 },
    { key: ord('s'),    ef_txt: _("search"), ef_desc: _("search for traps and secret doors"),
              ef_funct: dosearch, flags: IFBURIED | CMD_M_PREFIX, f_text: _("searching") },
    { key: ord('*'),    ef_txt: _("seeall"), ef_desc: _("show all equipment in use"),
              ef_funct: doprinuse, flags: IFBURIED | GENERALCMD | CMD_M_PREFIX, f_text: 0 },
    { key: AMULET_SYM, ef_txt: _("seeamulet"), ef_desc: _("show the amulet currently worn"),
              ef_funct: dopramulet, flags: IFBURIED | GENERALCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ARMOR_SYM, ef_txt: _("seearmor"), ef_desc: _("show the armor currently worn"),
              ef_funct: doprarm, flags: IFBURIED | GENERALCMD | CMD_M_PREFIX, f_text: 0 },
    { key: RING_SYM, ef_txt: _("seerings"), ef_desc: _("show the ring(s) currently worn"),
              ef_funct: doprring, flags: IFBURIED | GENERALCMD | CMD_M_PREFIX, f_text: 0 },
    { key: TOOL_SYM, ef_txt: _("seetools"), ef_desc: _("show the tools currently in use"),
              ef_funct: doprtool, flags: IFBURIED | GENERALCMD | CMD_M_PREFIX, f_text: 0 },
    { key: WEAPON_SYM, ef_txt: _("seeweapon"), ef_desc: _("show the weapon currently wielded"),
              ef_funct: doprwep, flags: IFBURIED | GENERALCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord('!'),    ef_txt: _("shell"),
              ef_desc: _("leave game to enter a sub-shell ('exit' to come back)"),
              ef_funct: dosh_core, flags: (IFBURIED | GENERALCMD | NOFUZZERCMD

                        ), f_text: 0 },
    /* $ is like ),=,&c but is not included with *, so not called "seegold" */
    { key: GOLD_SYM, ef_txt: _("showgold"), ef_desc: _("show gold, possibly shop credit or debt"),
              ef_funct: doprgold, flags: IFBURIED | GENERALCMD | CMD_M_PREFIX, f_text: 0 },
    { key: SPBOOK_SYM, ef_txt: _("showspells"), ef_desc: _("list and reorder known spells"),
              ef_funct: dovspell, flags: IFBURIED | GENERALCMD, f_text: 0 },
    { key: ord('^'),    ef_txt: _("showtrap"), ef_desc: _("describe an adjacent, discovered trap"),
              ef_funct: doidtrap, flags: IFBURIED | GENERALCMD, f_text: 0 },
    { key: uchar(M(ord('s'))), ef_txt: _("sit"), ef_desc: _("sit down"),
              ef_funct: dosit, flags: AUTOCOMPLETE, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("stats"), ef_desc: _("show memory statistics"),
              ef_funct: wiz_show_stats, flags: IFBURIED | AUTOCOMPLETE | WIZMODECMD, f_text: 0 },
    { key: C(ord('z')), ef_txt: _("suspend"), ef_desc: _("push game to background ('fg' to come back)"),
              ef_funct: dosuspend_core, flags: (IFBURIED | GENERALCMD | NOFUZZERCMD

                               ), f_text: 0 },
    { key: ord('x'),    ef_txt: _("swap"), ef_desc: _("swap wielded and secondary weapons"),
              ef_funct: doswapweapon, flags: 0, f_text: 0 },
    { key: ord('T'),    ef_txt: _("takeoff"), ef_desc: _("take off one piece of armor"),
              ef_funct: dotakeoff, flags: 0, f_text: 0 },
    { key: ord('A'),    ef_txt: _("takeoffall"), ef_desc: _("remove all armor"),
              ef_funct: doddoremarm, flags: 0, f_text: 0 },
    { key: C(ord('t')), ef_txt: _("teleport"), ef_desc: _("teleport around the level"),
              ef_funct: dotelecmd, flags: IFBURIED | CMD_M_PREFIX, f_text: 0 },
    /* \177 == <del> aka <delete> aka <rubout>; some terminals have an
       option to swap it with <backspace> so if there's a key labeled
       <delete> it may or may not actually invoke the #terrain command */
    { key: ord('\x7f'), ef_txt: _("terrain"),
              ef_desc: _("view map without monsters or objects obstructing it"),
              ef_funct: doterrain, flags: IFBURIED | GENERALCMD | AUTOCOMPLETE, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("therecmdmenu"),
              ef_desc: _("menu of commands you can do from here to adjacent spot"),
              ef_funct: dotherecmdmenu, flags: AUTOCOMPLETE | GENERALCMD | MOUSECMD, f_text: 0 },
    { key: ord('t'),    ef_txt: _("throw"), ef_desc: _("throw something"),
              ef_funct: dothrow, flags: 0, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("timeout"), ef_desc: _("look at timeout queue and hero's timed intrinsics"),
              ef_funct: wiz_timeout_queue, flags: IFBURIED | AUTOCOMPLETE | WIZMODECMD, f_text: 0 },
    { key: uchar(M(ord('T'))), ef_txt: _("tip"), ef_desc: _("empty a container"),
              ef_funct: dotip, flags: AUTOCOMPLETE | CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("toggle"), ef_desc: _("toggle boolean option"),
              ef_funct: dotoggleoption, flags: IFBURIED | GENERALCMD | CMD_PARAM, f_text: 0 },
    { key: ord('_'),    ef_txt: _("travel"), ef_desc: _("travel to a specific location on the map"),
              ef_funct: dotravel, flags: CMD_M_PREFIX, f_text: 0 },
    { key: uchar(M(ord('t'))), ef_txt: _("turn"), ef_desc: _("turn undead away"),
              ef_funct: doturn, flags: IFBURIED | AUTOCOMPLETE, f_text: 0 },
    { key: ord('X'),    ef_txt: _("twoweapon"), ef_desc: _("toggle two-weapon combat"),
              ef_funct: dotwoweapon, flags: 0, f_text: 0 },
    { key: uchar(M(ord('u'))), ef_txt: _("untrap"), ef_desc: _("untrap something"),
              ef_funct: dountrap, flags: AUTOCOMPLETE, f_text: 0 },
    { key: ord('<'),    ef_txt: _("up"), ef_desc: _("go up a staircase"),
              /* (see comment for dodown() above */
              ef_funct: doup, flags: CMD_M_PREFIX, f_text: 0 },
    { key: uchar(M(ord('V'))), ef_txt: _("vanquished"), ef_desc: _("list vanquished monsters"),
              ef_funct: dovanquished,
              flags: IFBURIED | AUTOCOMPLETE | GENERALCMD | CMD_M_PREFIX, f_text: 0 },
    { key: uchar(M(ord('v'))), ef_txt: _("version"),
              ef_desc: _("list compile time options for this version of NetHack"),
              ef_funct: doextversion, flags: IFBURIED | AUTOCOMPLETE | GENERALCMD, f_text: 0 },
    { key: ord('V'),    ef_txt: _("versionshort"), ef_desc: _("show version and date+time program was built"),
              ef_funct: doversion, flags: IFBURIED | GENERALCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("vision"), ef_desc: _("show vision array"),
              ef_funct: wiz_show_vision, flags: IFBURIED | AUTOCOMPLETE | WIZMODECMD, f_text: 0 },
    { key: ord('.'),    ef_txt: _("wait"), ef_desc: _("rest one move while doing nothing"),
              ef_funct: donull, flags: IFBURIED | CMD_M_PREFIX, f_text: _("waiting") },
    { key: ord('W'),    ef_txt: _("wear"), ef_desc: _("wear a piece of armor"),
              ef_funct: dowear, flags: 0, f_text: 0 },
    { key: ord('&'),    ef_txt: _("whatdoes"), ef_desc: _("tell what a command does"),
              ef_funct: dowhatdoes, flags: IFBURIED | GENERALCMD, f_text: 0 },
    { key: ord('/'),    ef_txt: _("whatis"), ef_desc: _("show what type of thing a symbol corresponds to"),
              ef_funct: dowhatis, flags: IFBURIED | GENERALCMD, f_text: 0 },
    { key: ord('w'),    ef_txt: _("wield"), ef_desc: _("wield (put in use) a weapon"),
              ef_funct: dowield, flags: 0, f_text: 0 },
    { key: uchar(M(ord('w'))), ef_txt: _("wipe"), ef_desc: _("wipe off your face"),
              ef_funct: dowipe, flags: AUTOCOMPLETE, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("wizborn"), ef_desc: _("show stats of monsters created"),
              ef_funct: doborn, flags: IFBURIED | WIZMODECMD, f_text: 0 },

    { key: ord('\0'),   ef_txt: _("wizbury"), ef_desc: _("bury objs under and around you"),
              ef_funct: wiz_debug_cmd_bury, flags: IFBURIED | AUTOCOMPLETE | WIZMODECMD,
              f_text: 0 },

    { key: ord('\0'),   ef_txt: _("wizcast"), ef_desc: _("cast any spell"),
              ef_funct: dowizcast, flags: IFBURIED | WIZMODECMD, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("wizcustom"), ef_desc: _("show customized glyphs"),
              ef_funct: wiz_custom, flags: IFBURIED | WIZMODECMD | NOFUZZERCMD, f_text: 0 },
    { key: C(ord('e')), ef_txt: _("wizdetect"), ef_desc: _("reveal hidden things within a small radius"),
              ef_funct: wiz_detect, flags: IFBURIED | WIZMODECMD, f_text: 0 },

    { key: ord('\0'),   ef_txt: _("wizdispmacros"), ef_desc: _("validate the display macro ranges"),
              ef_funct: wiz_display_macros, flags: IFBURIED | AUTOCOMPLETE | WIZMODECMD, f_text: 0 },

    { key: ord('\0'),   ef_txt: _("wizfliplevel"), ef_desc: _("flip the level"),
              ef_funct: wiz_flip_level, flags: IFBURIED | WIZMODECMD, f_text: 0 },
    { key: C(ord('g')), ef_txt: _("wizgenesis"), ef_desc: _("create a monster"),
              ef_funct: wiz_genesis, flags: IFBURIED | WIZMODECMD, f_text: 0 },
    { key: C(ord('i')), ef_txt: _("wizidentify"), ef_desc: _("identify all items in inventory"),
              ef_funct: wiz_identify, flags: IFBURIED | WIZMODECMD, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("wizintrinsic"), ef_desc: _("set an intrinsic"),
              ef_funct: wiz_intrinsic, flags: IFBURIED | AUTOCOMPLETE | WIZMODECMD, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("wizkill"), ef_desc: _("slay a monster"),
              ef_funct: wiz_kill, flags: (IFBURIED | AUTOCOMPLETE | WIZMODECMD
                         | CMD_M_PREFIX | NOFUZZERCMD), f_text: 0 },
    { key: C(ord('v')), ef_txt: _("wizlevelport"), ef_desc: _("teleport to another level"),
              ef_funct: wiz_level_tele, flags: IFBURIED | WIZMODECMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("wizloaddes"), ef_desc: _("load and execute a des-file lua script"),
              ef_funct: wiz_load_splua, flags: IFBURIED | WIZMODECMD | NOFUZZERCMD, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("wizloadlua"), ef_desc: _("load and execute a lua script"),
              ef_funct: wiz_load_lua, flags: IFBURIED | WIZMODECMD | NOFUZZERCMD, f_text: 0 },

    { key: ord('\0'),   ef_txt: _("wizobjprobs"), ef_desc: _("list object generation probabilities"),
              ef_funct: wiz_objprobs, flags: IFBURIED | WIZMODECMD, f_text: 0 },

    { key: ord('\0'),   ef_txt: _("wizmakemap"), ef_desc: _("recreate the current level"),
              ef_funct: wiz_makemap, flags: IFBURIED | WIZMODECMD, f_text: 0 },
    { key: C(ord('f')), ef_txt: _("wizmap"), ef_desc: _("map the level"),
              ef_funct: wiz_map, flags: IFBURIED | WIZMODECMD, f_text: 0 },

    { key: ord('\0'),   ef_txt: _("wizmondiff"), ef_desc: _("validate the difficulty ratings of monsters"),
              ef_funct: wiz_mon_diff, flags: IFBURIED | AUTOCOMPLETE | WIZMODECMD, f_text: 0 },

    { key: ord('\0'),   ef_txt: _("wizrumorcheck"), ef_desc: _("verify rumor boundaries"),
              ef_funct: wiz_rumor_check, flags: IFBURIED | AUTOCOMPLETE | WIZMODECMD, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("wizseenv"), ef_desc: _("show map locations' seen vectors"),
              ef_funct: wiz_show_seenv, flags: IFBURIED | AUTOCOMPLETE | WIZMODECMD, f_text: 0 },
    { key: ord('\0'), ef_txt: _("wizshownhuuid"), ef_desc: _("show NHUUID for this game"),
              ef_funct: wiz_show_nhuuid, flags: AUTOCOMPLETE | WIZMODECMD, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("wizsmell"), ef_desc: _("smell monster"),
              ef_funct: wiz_smell, flags: IFBURIED | AUTOCOMPLETE | WIZMODECMD, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("wiztelekinesis"), ef_desc: _("telekinesis"),
              ef_funct: wiz_telekinesis, flags: IFBURIED | AUTOCOMPLETE | WIZMODECMD, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("wizwhere"), ef_desc: _("show locations of special levels"),
              ef_funct: wiz_where, flags: IFBURIED | AUTOCOMPLETE | WIZMODECMD, f_text: 0 },
    { key: C(ord('w')), ef_txt: _("wizwish"), ef_desc: _("wish for something"),
              ef_funct: wiz_wish, flags: IFBURIED | CMD_M_PREFIX | WIZMODECMD, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("wmode"), ef_desc: _("show wall modes"),
              ef_funct: wiz_show_wmodes, flags: IFBURIED | AUTOCOMPLETE | WIZMODECMD, f_text: 0 },
    { key: ord('z'),    ef_txt: _("zap"), ef_desc: _("zap a wand"),
              ef_funct: dozap, flags: 0, f_text: 0 },
    /* movement commands will be bound by reset_commands() */
    /* move or attack; accept m/g/G/F prefixes */
    { key: ord('\0'),   ef_txt: _("movewest"), ef_desc: _("move west (screen left)"),
              ef_funct: do_move_west, flags: MOVEMENTCMD | CMD_MOVE_PREFIXES, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("movenorthwest"), ef_desc: _("move northwest (screen upper left)"),
              ef_funct: do_move_northwest, flags: MOVEMENTCMD | CMD_MOVE_PREFIXES, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("movenorth"), ef_desc: _("move north (screen up)"),
              ef_funct: do_move_north, flags: MOVEMENTCMD | CMD_MOVE_PREFIXES, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("movenortheast"), ef_desc: _("move northeast (screen upper right)"),
              ef_funct: do_move_northeast, flags: MOVEMENTCMD | CMD_MOVE_PREFIXES, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("moveeast"), ef_desc: _("move east (screen right)"),
              ef_funct: do_move_east, flags: MOVEMENTCMD | CMD_MOVE_PREFIXES, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("movesoutheast"), ef_desc: _("move southeast (screen lower right)"),
              ef_funct: do_move_southeast, flags: MOVEMENTCMD | CMD_MOVE_PREFIXES, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("movesouth"), ef_desc: _("move south (screen down)"),
              ef_funct: do_move_south, flags: MOVEMENTCMD | CMD_MOVE_PREFIXES, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("movesouthwest"), ef_desc: _("move southwest (screen lower left)"),
              ef_funct: do_move_southwest, flags: MOVEMENTCMD | CMD_MOVE_PREFIXES, f_text: 0 },
    /* rush; accept m prefix but not g/G/F */
    { key: ord('\0'),   ef_txt: _("rushwest"), ef_desc: _("rush west (screen left)"),
              ef_funct: do_rush_west, flags: MOVEMENTCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("rushnorthwest"), ef_desc: _("rush northwest (screen upper left)"),
              ef_funct: do_rush_northwest, flags: MOVEMENTCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("rushnorth"), ef_desc: _("rush north (screen up)"),
              ef_funct: do_rush_north, flags: MOVEMENTCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("rushnortheast"), ef_desc: _("rush northeast (screen upper right)"),
              ef_funct: do_rush_northeast, flags: MOVEMENTCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("rusheast"), ef_desc: _("rush east (screen right)"),
              ef_funct: do_rush_east, flags: MOVEMENTCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("rushsoutheast"), ef_desc: _("rush southeast (screen lower right)"),
              ef_funct: do_rush_southeast, flags: MOVEMENTCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("rushsouth"), ef_desc: _("rush south (screen down)"),
              ef_funct: do_rush_south, flags: MOVEMENTCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("rushsouthwest"), ef_desc: _("rush southwest (screen lower left)"),
              ef_funct: do_rush_southwest, flags: MOVEMENTCMD | CMD_M_PREFIX, f_text: 0 },
    /* run; accept m prefix but not g/G/F */
    { key: ord('\0'),   ef_txt: _("runwest"), ef_desc: _("run west (screen left)"),
              ef_funct: do_run_west, flags: MOVEMENTCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("runnorthwest"), ef_desc: _("run northwest (screen upper left)"),
              ef_funct: do_run_northwest, flags: MOVEMENTCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("runnorth"), ef_desc: _("run north (screen up)"),
              ef_funct: do_run_north, flags: MOVEMENTCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("runnortheast"), ef_desc: _("run northeast (screen upper right)"),
              ef_funct: do_run_northeast, flags: MOVEMENTCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("runeast"), ef_desc: _("run east (screen right)"),
              ef_funct: do_run_east, flags: MOVEMENTCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("runsoutheast"), ef_desc: _("run southeast (screen lower right)"),
              ef_funct: do_run_southeast, flags: MOVEMENTCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("runsouth"), ef_desc: _("run south (screen down)"),
              ef_funct: do_run_south, flags: MOVEMENTCMD | CMD_M_PREFIX, f_text: 0 },
    { key: ord('\0'),   ef_txt: _("runsouthwest"), ef_desc: _("run southwest (screen lower left)"),
              ef_funct: do_run_southwest, flags: MOVEMENTCMD | CMD_M_PREFIX, f_text: 0 },

    /* internal commands: only used by game core, not available for user */
    { key: ord('\0'), ef_txt: _("clicklook"), ef_desc: 0, ef_funct: doclicklook, flags: INTERNALCMD | MOUSECMD, f_text: 0 },
    { key: ord('\0'), ef_txt: _("mouseaction"), ef_desc: 0, ef_funct: domouseaction, flags: INTERNALCMD | MOUSECMD, f_text: 0 },
    { key: ord('\0'), ef_txt: _("altadjust"), ef_desc: 0, ef_funct: adjust_split, flags: INTERNALCMD, f_text: 0 },
    { key: ord('\0'), ef_txt: _("altdip"), ef_desc: 0, ef_funct: dip_into, flags: INTERNALCMD, f_text: 0 },
    { key: ord('\0'), ef_txt: _("alttakeoff"), ef_desc: 0, ef_funct: ia_dotakeoff, flags: INTERNALCMD, f_text: 0 },
    { key: ord('\0'), ef_txt: _("altunwield"), ef_desc: 0, ef_funct: remarm_swapwep, flags: INTERNALCMD, f_text: 0 },
    { key: ord('\0'), ef_txt: 0, ef_desc: 0, ef_funct: donull, flags: 0, f_text: 0 } /* sentinel */
]);

/* mapping direction and move mode to extended command function */
const move_funcs = static_array("move_funcs", array_of(fnptr_t, N_MOVEMODES), N_DIRS_Z, [
    [ do_move_west,      do_run_west,      do_rush_west ],
    [ do_move_northwest, do_run_northwest, do_rush_northwest ],
    [ do_move_north,     do_run_north,     do_rush_north ],
    [ do_move_northeast, do_run_northeast, do_rush_northeast ],
    [ do_move_east,      do_run_east,      do_rush_east ],
    [ do_move_southeast, do_run_southeast, do_rush_southeast ],
    [ do_move_south,     do_run_south,     do_rush_south ],
    [ do_move_southwest, do_run_southwest, do_rush_southwest ],
    /* misleading; rush and run for down or up are rejected by rhack()
       because dodown() and doup() lack the CMD_gGF_PREFIX flag */
    [ dodown,            dodown,           dodown ],
    [ doup,              doup,             doup ],
]);

/* used by dokeylist() and by key2extcmddesc() for dowhatdoes() */
  const struct___anon1 = struct("cmd.struct___anon1", {
    nhkf: int,
    desc: ptr_to(char),
    numpad: boolean,
}); const misc_keys = static_array("misc_keys", struct___anon1, null, [
    { nhkf: NHKF_ESC, desc: _("cancel current prompt or pending prefix"), numpad: FALSE },
    { nhkf: NHKF_COUNT,
      desc: _("Prefix: for digits when preceding a command with a count"), numpad: TRUE },
    { nhkf: 0, desc: 0, numpad: FALSE }
]);

const extcmdlist_length = static_var("extcmdlist_length", int, SIZE(extcmdlist) - 1);

/* get entry i in the extended commands list. for windowport use. */
export function extcmds_getentry(i) { /* struct ext_func_tab * */
    if (i < 0 || i > extcmdlist_length[0])
        return null;
    return extcmdlist[i];
}

/* get the command bound to a key */
function cmdbind_get(key) { /* struct Cmd_bind * */
    let bind = gc.Cmd.cmdbinds;

    if (!key)
        return null;

    while (bind) {
        if (bind.key == key)
            return bind;
        bind = bind.next;
    }
    return bind;
}

function cmdbind_add(key, extcmd, user) { /* void */
    let bind = cmdbind_get(key);

    if (!key)
        return;
    if (!extcmd && bind) {
        cmdbind_remove(key);
        return;
    }

    /* binding exists, set it to this command */
    if (bind) {
        bind.cmd = extcmd;
        bind.userbind = user;
        if (bind.param) {
            free(bind.param);
            bind.param = 0;
        }
        return;
    } else {
        bind = view_of(struct_Cmd_bind, addr_of(alloc(sizeof(struct_Cmd_bind))));
        bind.key = key;
        bind.userbind = user;
        bind.param = 0;
        bind.cmd = extcmd;
        bind.next = gc.Cmd.cmdbinds;
        gc.Cmd.cmdbinds = bind;
    }
}

function cmdbind_remove(key) { /* void */
    let bind = gc.Cmd.cmdbinds;
    let prev = null;

    while (bind) {
        if (bind.key == key) {
            if (prev)
                prev.next = bind.next;
            else
                gc.Cmd.cmdbinds = bind.next;
            if (bind.param)
                free(bind.param);
            free(addr_of(bind));
            return;
        }
        prev = bind;
        bind = bind.next;
    }
}

export function cmdbind_freeall() { /* void */
    let next;

    while (gc.Cmd.cmdbinds) {
        next = gc.Cmd.cmdbinds.next;
        if (gc.Cmd.cmdbinds.param)
            free(gc.Cmd.cmdbinds.param);
        free(addr_of(gc.Cmd.cmdbinds));
        gc.Cmd.cmdbinds = next;
    }
}

/* swap key bindings for key1 and key2. both bindings must exist. */
function cmdbind_swapkeys(key1, key2) { /* void */
    let bind1 = cmdbind_get(key1);
    let bind2 = cmdbind_get(key2);

    if (bind1 && bind2) {
        bind1.key = key2;
        bind2.key = key1;
    }
}

/* return number of extended commands bound to a non-default key */
export function count_bind_keys() { /* int */
    const $frame = stack_frame(); try {
    let bind = gc.Cmd.cmdbinds;
    let i, nbinds = 0;
    let keys = stack_array(uchar, 256);

    memset(keys, 0, sizeof(uchar) * 256);

    /* commands bound to different key */
    while (bind) {
        uchars[keys + bind.key] = 1;
        if (bind.userbind && bind.cmd && bind.cmd.key != bind.key) {
            nbinds++;
        }
        bind = bind.next;
    }

    /* commands which should be bound to a key, but aren't */
    for (i = 0; i < extcmdlist_length[0]; i++)
        if (extcmdlist[i].key && !uchars[keys + (extcmdlist[i].key)])
            nbinds++;

    return nbinds;
    } finally { stack_pop($frame); }
}

/* show changed key bindings in text, or if sbuf is non-null, append to it */
export function get_changed_key_binds(sbuf) { /* void */
    const $frame = stack_frame(); try {
    let win = WIN_ERR;
    let i;
    let buf = stack_array(char, BUFSZ);
    let buf2 = stack_array(char, QBUFSZ);
    let bind = gc.Cmd.cmdbinds;
    let keys = stack_array(uchar, 256);

    memset(keys, 0, sizeof(uchar) * 256);

    if (!sbuf)
        win = create_nhwindow()(NHW_TEXT);

    /* commands bound to different key */
    while (bind) {
        uchars[keys + bind.key] = 1;
        if (bind.userbind && bind.cmd && bind.cmd.key != bind.key) {
            if ((bind.cmd.flags & CMD_PARAM) != 0)
                sprintf(buf, _("BIND=%s:%s(%s)%s"), key2txt(bind.key, buf2), bind.cmd.ef_txt, bind.param, sbuf ? _("\n") : _(""));
            else
                sprintf(buf, _("BIND=%s:%s%s"), key2txt(bind.key, buf2), bind.cmd.ef_txt, sbuf ? _("\n") : _(""))

;
            if (sbuf)
                strbuf_append(sbuf, buf);
            else
                putstr()(win, 0, buf);
        }
        bind = bind.next;
    }

    /* commands which should be bound to a key, but aren't */
    for (i = 0; i < extcmdlist_length[0]; i++) {
        let ec = extcmdlist[i];

        if (ec.key && !uchars[keys + ec.key]) {
            sprintf(buf, _("BIND=%s:nothing%s"), key2txt(ec.key, buf2), sbuf ? _("\n") : _(""))
;
            if (sbuf)
                strbuf_append(sbuf, buf);
            else
                putstr()(win, 0, buf);
        }
    }
    if (!sbuf) {
        display_nhwindow()(win, TRUE);
        destroy_nhwindow()(win);
    }
    } finally { stack_pop($frame); }
}

/* interactive key binding */
function handler_rebind_keys_add(keyfirst) { /* void */
    const $frame = stack_frame(); try {
    var ec;
    var win;
    var any = stack_struct(struct_any);
    var i, npick;
    var picks = stack_var(ptr_to(struct_mi), null);
    var buf = stack_array(char, BUFSZ);
    var buf2 = stack_array(char, QBUFSZ);
    var key = ord('\0');
    var clr = NO_COLOR;

    if (keyfirst) {
        pline(_("Bind which key? "));
        key = uchar(pgetchar());

        if (!key || key == ord('\x1b'))
            return;
    }

    win = create_nhwindow()(NHW_MENU);
    start_menu()(win, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);

    if (key) {
        var bind = cmdbind_get(key);

        if (bind && bind.cmd) {
            sprintf(buf, _("Key '%s' is currently bound to \"%s\"."), key2txt(key, buf2), bind.cmd.ef_txt)
;
        } else {
            sprintf(buf, _("Key '%s' is not bound to anything."), key2txt(key, buf2))
;
        }
        add_menu_str(win, buf);
        add_menu_str(win, _(""));
    }

    any.a_int = -1;
    add_menu(win, nul_glyphinfo, any, ord('\0'), 0, ATR_NONE, clr,
             _("nothing: unbind the key"),
             MENU_ITEMFLAGS_NONE);

    add_menu_str(win, _(""));

    for (i = 0; i < extcmdlist_length[0]; i++) {
        ec = extcmdlist[i];

        if ((ec.flags & (MOVEMENTCMD|INTERNALCMD|CMD_NOT_AVAILABLE)) != 0)
            continue;

        any.a_int = (i + 1);
        sprintf(buf, _("%s: %s"), ec.ef_txt, ec.ef_desc);
        add_menu(win, nul_glyphinfo, any, ord('\0'), 0, ATR_NONE, clr, buf,
             MENU_ITEMFLAGS_NONE);
    }
    if (key)
        sprintf(buf, _("Bind '%s' to what command?"), key2txt(key, buf2));
    else
        sprintf(buf, _("Bind what command?"));
    end_menu()(win, buf);
    npick = select_menu(win, PICK_ONE, picks);
    destroy_nhwindow()(win);
    if (npick > 0) {
        var prevcmd;
        var cmdstr = stack_array(char, BUFSZ);
        /* cmdstr starts out holding a non-empty string, so the Strcat()
           below builds a name that is no command and the binding is
           rejected ("Key binding failed?!"). */
        chars[cmdstr + 0] = ord('\xff');
        chars[cmdstr + 1] = ord('\0');

        i = picks[0].item.a_int;
        free(addr_of(picks[0]));

        bindit: { if (i == -1) {
            ec = null;
            strcat(cmdstr, _("nothing"));
            break bindit;
        } else {
            ec = extcmdlist[i-1];

            if ((ec.flags & CMD_PARAM) != 0) {
                var parambuf = stack_array(char, BUFSZ);
                var querybuf = stack_array(char, BUFSZ);

                chars[parambuf + 0] = ord('\0');
                sprintf(querybuf, _("Command %s requires a parameter:"), ec.ef_txt);
                getlin(querybuf, parambuf);
                mungspaces(parambuf);
                Snprintf(cmdstr, BUFSZ-1, _("%s(%s)"), ec.ef_txt, parambuf);
                chars[cmdstr + (BUFSZ-1)] = ord('\0');
            } else {
                strcat(cmdstr, ec.ef_txt);
            }
        }
 }
        if (!key) {
            pline(_("Bind which key? "));
            key = uchar(pgetchar());

            if (!key || key == ord('\x1b'))
                return;
        }

        prevcmd = cmdbind_get(key);

        if (bind_key(key, cmdstr, TRUE)) {
            if (prevcmd && prevcmd.cmd != ec) {
                pline(_("Changed key '%s' from \"%s\" to \"%s\"."),
                      key2txt(key, buf2), prevcmd.cmd.ef_txt, cmdstr);
            } else if (!prevcmd) {
                pline(_("Bound key '%s' to \"%s\"."),
                      key2txt(key, buf2), cmdstr);
            }
        } else {
            pline(_("Key binding failed?!"));
        }
    }
    } finally { stack_pop($frame); }
}

export function handler_rebind_keys() { /* void */
    const $frame = stack_frame(); try {
    var win;
    var any = stack_struct(struct_any);
    var i, npick;
    var picks = stack_var(ptr_to(struct_mi), null);
    var clr = NO_COLOR;

 redo_rebind: for (;;) {
    win = create_nhwindow()(NHW_MENU);
    start_menu()(win, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);

    any.a_int = 1;
    add_menu(win, nul_glyphinfo, any, ord('\0'), 0, ATR_NONE, clr,
             _("bind key to a command"), MENU_ITEMFLAGS_NONE);
    any.a_int = 2;
    add_menu(win, nul_glyphinfo, any, ord('\0'), 0, ATR_NONE, clr,
             _("bind command to a key"), MENU_ITEMFLAGS_NONE);
    if (count_bind_keys()) {
        any.a_int = 3;
        add_menu(win, nul_glyphinfo, any, ord('\0'), 0, ATR_NONE, clr,
                 _("view changed key binds"), MENU_ITEMFLAGS_NONE);
    }
    end_menu()(win, _("Do what?"));
    npick = select_menu(win, PICK_ONE, picks);
    destroy_nhwindow()(win);
    if (npick > 0) {
        i = picks[0].item.a_int;
        free(addr_of(picks[0]));

        if (i == 1 || i == 2) {
            handler_rebind_keys_add(+(i == 1));
        } else if (i == 3) {
            get_changed_key_binds(null);
        }
        continue redo_rebind;
    } break; }
    } finally { stack_pop($frame); }
}

export function handler_change_autocompletions() { /* void */
    const $frame = stack_frame(); try {
    let win;
    let any = stack_struct(struct_any);
    let i, n;
    let picks = stack_var(ptr_to(struct_mi), null);
    let clr = NO_COLOR;
    let ec;
    let buf = stack_array(char, BUFSZ);

    win = create_nhwindow()(NHW_MENU);
    start_menu()(win, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);

    for (i = 0; i < extcmdlist_length[0]; i++) {
        ec = extcmdlist[i];

        if ((ec.flags & (INTERNALCMD|CMD_NOT_AVAILABLE)) != 0)
            continue;
        if (strlen(ec.ef_txt) < 2)
            continue;

        any.a_int = (i + 1);
        sprintf(buf, _("%c %s: %s"), (ec.flags & AUTOCOMP_ADJ) ? ord('*') : ord(' '), ec.ef_txt, ec.ef_desc)

;
        add_menu(win, nul_glyphinfo, any, ord('\0'), 0, ATR_NONE, clr, buf,
                 (ec.flags & AUTOCOMPLETE)
                 ? MENU_ITEMFLAGS_SELECTED :
                 MENU_ITEMFLAGS_NONE);
    }

    end_menu()(win, _("Which commands autocomplete?"));
    n = select_menu(win, PICK_ANY, picks);
    if (n >= 0) {
        let j;

        for (i = 0; i < extcmdlist_length[0]; i++) {
            let setit = FALSE;

            ec = extcmdlist[i];

            if ((ec.flags & (INTERNALCMD|CMD_NOT_AVAILABLE)) != 0)
                continue;
            if (strlen(ec.ef_txt) < 2)
                continue;

            sprintf(buf, _("%s"), ec.ef_txt);

            for (j = 0; j < n; ++j) {
                if (ec == elt(extcmdlist, (ptr_add(picks[0], j).item.a_int - 1))) {
                    parseautocomplete(buf, TRUE);
                    setit = TRUE;
                    break;
                }
            }

            if (!setit) {
                parseautocomplete(buf, FALSE);
            }
        }
        if (n > 0)
            free(addr_of(picks[0]));
    }

    destroy_nhwindow()(win);
    } finally { stack_pop($frame); }
}

/* find extended command entries matching findstr.
   if findstr is NULL, returns all available entries.
   returns: number of matching extended commands,
            and the entry indexes in matchlist.
   for windowport use. */
export function extcmds_match(findstr, ecmflags, matchlist) { /* int */
    let retmatchlist = static_array("extcmds_match.retmatchlist", int, SIZE(extcmdlist), []);
    let i, mi = 0;
    let fslen = int(findstr ? Strlen(findstr) : 0);
    let ignoreac = +((ecmflags & ECM_IGNOREAC) != 0);
    let exactmatch = +((ecmflags & ECM_EXACTMATCH) != 0);
    let no1charcmd = +((ecmflags & ECM_NO1CHARCMD) != 0);

    for (i = 0; extcmdlist[i].ef_txt; i++) {
        if (extcmdlist[i].flags & (CMD_NOT_AVAILABLE|INTERNALCMD))
            continue;
        if (!wizard() && (extcmdlist[i].flags & WIZMODECMD))
            continue;
        if (!ignoreac && !(extcmdlist[i].flags & AUTOCOMPLETE))
            continue;
        if (no1charcmd && (strlen(extcmdlist[i].ef_txt) == 1))
            continue;
        if (!findstr) {
            retmatchlist[mi++] = i;
        } else if (exactmatch) {
            if (!strcmpi(findstr, extcmdlist[i].ef_txt)) {
                retmatchlist[mi++] = i;
            }
        } else {
            if (!strncmpi(findstr, extcmdlist[i].ef_txt, fslen)) {
                retmatchlist[mi++] = i;
            }
        }
    }

    if (matchlist)
        matchlist[0] = retmatchlist;

    return mi;
}

export function key2extcmddesc(key) { /* const char * */
    let key2cmdbuf = static_array("key2extcmddesc.key2cmdbuf", char, QBUFSZ);
    let txt;
    let k, i, j;
    let M_5 = uchar(M(ord('5'))), M_0 = uchar(M(ord('0')));
    let cmdbind;

    /* need to check for movement commands before checking the extended
       commands table because it contains entries for number_pad commands
       that match !number_pad movement (like 'j' for "jump") */
    chars[key2cmdbuf + 0] = ord('\0');
    if (movecmd(k = key, MV_WALK))
        strcpy(key2cmdbuf, _("move")); /* "move or attack"? */
    else if (movecmd(k = key, MV_RUSH))
        strcpy(key2cmdbuf, _("rush"));
    else if (movecmd(k = key, MV_RUN))
        strcpy(key2cmdbuf, _("run"));
    if (digit(char(key)) || (gc.Cmd.num_pad && digit(unmeta(key)))) {
        chars[key2cmdbuf + 0] = ord('\0');
        if (!gc.Cmd.num_pad)
            strcpy(key2cmdbuf, _("start of, or continuation of, a count"));
        else if (key == ord('5') || key == M_5)
            sprintf(key2cmdbuf, _("%s prefix"), (+!!gc.Cmd.pcHack_compat ^ +(key == M_5)) ? _("run") : _("rush"));
        else if (key == ord('0') || (gc.Cmd.pcHack_compat && key == M_0))
            strcpy(key2cmdbuf, _("synonym for 'i'"))
;
        if (chars[key2cmdbuf])
            return key2cmdbuf;
    }
    /* check prefixes before regular commands; includes ^A pseudo-command */
    for (i = 0; misc_keys[i].desc; ++i) {
        if (misc_keys[i].numpad && !iflags.num_pad)
            continue;
        j = misc_keys[i].nhkf;
        if (key == uchar((chars[gc.Cmd.spkeys + j])))
            return misc_keys[i].desc;
    }
    /* finally, check whether 'key' is a command */
    if ((cmdbind = cmdbind_get(key)) != null
        && cmdbind.cmd
        && (txt = cmdbind.cmd.ef_txt) != 0) {
        sprintf(key2cmdbuf, _("%s (#%s)"), cmdbind.cmd.ef_desc, txt);

        /* special case: for reqmenu prefix (normally 'm'), replace
           "prefix: request menu or modify command (#reqmenu)"
           with two-line "movement prefix:...\nnon-movement prefix:..." */
        if (!strncmpi(key2cmdbuf, _("prefix:"), 7) && !strncmpi((txt), _(("reqmenu")), -1))
            strsubst(key2cmdbuf, _("prefix:"),
                     /* relies on implicit concatenation of literal strings */
                            _("movement prefix:" +
                            " move without autopickup and without attacking" +
                            "\n" +
                            "non-movement prefix:")); /* and rest of buf */

        /* another special case: 'txt' for '#' is "#" and showing that as
           "perform an extended command (##)" looks silly; strip "(##)" off */
        return strsubst(key2cmdbuf, _(" (##)"), _(""));
    }
    return 0;
}

export function bind_mousebtn(btn, command) { /* boolean */
    let extcmd;

    if (btn < 1 || btn > NUM_MOUSE_BUTTONS) {
        config_error_add(_("Wrong mouse button, valid are 1-%i"),
                         NUM_MOUSE_BUTTONS);
        return FALSE;
    }
    btn--;

    /* special case: "nothing" is reserved for unbinding */
    if (!strncmpi((command), _(("nothing")), -1)) {
        gc.Cmd.mousebtn[btn] = null;
        return TRUE;
    }

    for (extcmd = extcmdlist[0]; extcmd.ef_txt; extcmd = ptr_add(extcmd, 1)) {
        if (strcmpi(command, extcmd.ef_txt))
            continue;
        if (!(extcmd.flags & MOUSECMD))
            continue;
        gc.Cmd.mousebtn[btn] = extcmd;

        return TRUE;
    }

    return FALSE;
}

export function bind_key(key, command, user) { /* boolean */
    let extcmd;
    let len;
    let buf, p = 0, lastp = 0;

    /* special case: "nothing" is reserved for unbinding */
    if (!strncmpi((command), _(("nothing")), -1)) {
        cmdbind_remove(key);
        return TRUE;
    }

    /* copy command to buf for modification */
    len = unsigned(strlen(command) + 1);
    buf = addr_of(alloc(unsigned(len)));
    strncpy(buf, command, unsigned(len));

    /* does buf have a parameter in parenthesis? */
    if ((p = strchr(buf, ord('('))) != 0
        && (lastp = strrchr(buf, ord(')'))) != 0
        && (lastp > p)) {
        chars[p] = ord('\0');
        chars[lastp] = ord('\0');
        /* p points to the parameter */
        p++;
    }

    for (extcmd = extcmdlist[0]; extcmd.ef_txt; extcmd = ptr_add(extcmd, 1)) {
        if (strcmpi(buf, extcmd.ef_txt))
            continue;
        if ((extcmd.flags & INTERNALCMD) != 0)
            continue;
        cmdbind_add(key, extcmd, user);

        if ((extcmd.flags & CMD_PARAM) != 0) {
            if (!p) {
                config_error_add(_("'%s' requires a parameter"), buf);
            } else {
                let bind = cmdbind_get(key);
                let maxlen = int(unsigned((((30) < (strlen(p))) ? (30) : (strlen(p))) + 1));

                if (maxlen <= 1) {
                    config_error_add(_("Required parameter cannot be empty"));
                } else {
                    bind.param = addr_of(alloc(unsigned(maxlen)));
                    strncpy(bind.param, p, unsigned(maxlen));
                    chars[bind.param + (maxlen-1)] = ord('\0');
                }
            }
        } else if (p && strlen(p) > 0)
            config_error_add(_("'%s' does not take a parameter"), buf);

        free(buf);
        return TRUE;
    }

    free(buf);
    return FALSE;
}

/* bind key by ext cmd function */
function bind_key_fn(key, fn) { /* boolean */
    let extcmd;

    for (extcmd = extcmdlist[0]; extcmd.ef_txt; extcmd = ptr_add(extcmd, 1)) {
        if (extcmd.ef_funct != fn)
            continue;
        if ((extcmd.flags & INTERNALCMD) != 0)
            continue;
        cmdbind_add(key, extcmd, FALSE);
        return TRUE;
    }

    return FALSE;
}

/* initialize all keyboard commands */
function commands_init() { /* void */
    let extcmd;

    for (extcmd = extcmdlist[0]; extcmd.ef_txt; extcmd = ptr_add(extcmd, 1))
        if (extcmd.key)
            cmdbind_add(extcmd.key, extcmd, FALSE);

    bind_mousebtn(1, _("therecmdmenu"));
    bind_mousebtn(2, _("clicklook"));

    /* number_pad */
    bind_key(C(ord('l')), _("redraw"), FALSE);
    bind_key(ord('h'),    _("help"), FALSE);
    bind_key(ord('j'),    _("jump"), FALSE);
    bind_key(ord('k'),    _("kick"), FALSE);
    bind_key(ord('l'),    _("loot"), FALSE);
    bind_key(C(ord('n')), _("annotate"), FALSE);
    bind_key(ord('N'),    _("name"), FALSE);
    bind_key(ord('u'),    _("untrap"), FALSE);
    bind_key(ord('5'),    _("run"), FALSE);
    bind_key(uchar(M(ord('5'))), _("rush"), FALSE);
    bind_key(ord('-'),    _("fight"), FALSE);

    /* alt keys: */
    bind_key(uchar(M(ord('O'))), _("overview"), FALSE);
    bind_key(uchar(M(ord('2'))), _("twoweapon"), FALSE);
    bind_key(uchar(M(ord('N'))), _("name"), FALSE);
}

function keylist_func_has_key(extcmd,
                     skip_keys_used) { /* boolean */ /* boolean keys_used[256] */
    let i;
    let bind;

    for (i = 0; i < 256; ++i) {
        if (chars[skip_keys_used + i])
            continue;

        if (((bind = cmdbind_get(uchar(i))) != null) && (bind.cmd == extcmd))
            return TRUE;
    }
    return FALSE;
}

function keylist_putcmds(datawin, docount,
                incl_flags, excl_flags,
                keys_used) { /* int */ /* boolean keys_used[256] */
    const $frame = stack_frame(); try {
    let extcmd;
    let i;
    let buf = stack_array(char, BUFSZ), buf2 = stack_array(char, QBUFSZ);
    let keys_already_used = stack_array(schar, 256); /* copy of keys_used[] before updates */
    let count = 0;
    let bind;

    for (i = 0; i < 256; i++) {
        let key = uchar(i);

        chars[keys_already_used + i] = chars[keys_used + i];
        if (chars[keys_used + i])
            continue;
        if (key == ord(' ') && !flags.rest_on_space)
            continue;
        bind = cmdbind_get(key);
        if (bind && bind.cmd != null) {
            if ((incl_flags && !(bind.cmd.flags & unsigned(incl_flags)))
                || (excl_flags && (bind.cmd.flags & unsigned(excl_flags))))
                continue;
            if (docount) {
                count++;
                continue;
            }
            if ((bind.cmd.flags & CMD_PARAM) != 0)
                sprintf(buf, _("%-7s %-13s %s \"%s\""), key2txt(key, buf2), bind.cmd.ef_txt, bind.cmd.ef_desc, bind.param);
            else
                sprintf(buf, _("%-7s %-13s %s"), key2txt(key, buf2), bind.cmd.ef_txt, bind.cmd.ef_desc)

;
            putstr()(datawin, 0, buf);
            chars[keys_used + i] = TRUE;
        }
    }
    /* also list commands that lack key assignments; most are wizard mode */
    for (extcmd = extcmdlist[0]; extcmd.ef_txt; extcmd = ptr_add(extcmd, 1)) {
        if ((incl_flags && !(extcmd.flags & unsigned(incl_flags)))
            || (excl_flags && (extcmd.flags & unsigned(excl_flags))))
            continue;
        /* can't just check for non-Null extcmd->key; it holds the
           default assignment and a user-specified binding might hijack
           this command's default key for some other command; or this
           command might have been assigned a key being used for
           movement or as a prefix, intercepting that keystroke */
        if (keylist_func_has_key(extcmd, keys_already_used))
            continue;
        /* found a command for current category without any key assignment */
        if (docount) {
            count++;
            continue;
        }
        /* '#'+20 for one column here == 7+' '+13 for two columns above */
        sprintf(buf, _("#%-20s %s"), extcmd.ef_txt, extcmd.ef_desc);
        putstr()(datawin, 0, buf);
    }
    return count;
    } finally { stack_pop($frame); }
}

/* list all keys and their bindings, like dat/hh but dynamic */
export function dokeylist() { /* void */
    const $frame = stack_frame(); try {
    let extcmd;
    let datawin;
    let buf = stack_array(char, BUFSZ), buf2 = stack_array(char, BUFSZ);
    let key;
    let spkey_gap, keys_used = stack_array(schar, 256), mov_seen = stack_array(schar, 256);
    let i, j, pfx_seen = stack_array(int, 256);

    memset(keys_used, 0, sizeof(array_of(schar, 256)));
    memset(addr_of(pfx_seen), 0, sizeof(array_of(int, 256)));

    /* this is actually ambiguous; tty raw mode will override SIGINT;
       when enabled, treat it like a movement command since assigning
       other commands to this keystroke would be unwise... */
    key = C(ord('c'));
    chars[keys_used + key] = TRUE;

    /* movement keys have been flagged in keys_used[]; clone them */
    memcpy(mov_seen, keys_used,
                  sizeof(array_of(schar, 256)));

    spkey_gap = FALSE;
    for (i = 0; misc_keys[i].desc; ++i) {
        if (misc_keys[i].numpad && !iflags.num_pad)
            continue;
        j = misc_keys[i].nhkf;
        key = uchar((chars[gc.Cmd.spkeys + j]));
        if (key && !chars[mov_seen + key] && !pfx_seen[key]) {
            chars[keys_used + key] = TRUE;
            pfx_seen[key] = j;
        } else
            spkey_gap = TRUE;
    }

    datawin = create_nhwindow()(NHW_TEXT);
    putstr()(datawin, 0, _(""));
    sprintf(buf, _("%7s %s"), _(""), _("    Full Current Key Bindings List"));
    putstr()(datawin, 0, buf);
    for (extcmd = extcmdlist[0]; extcmd.ef_txt; extcmd = ptr_add(extcmd, 1))
        if (spkey_gap || !keylist_func_has_key(extcmd, keys_used)) {
            sprintf(buf, _("%7s %s"), _(""), _("(also commands with no key assignment)"))
;
            putstr()(datawin, 0, buf);
            break;
        }

    /* directional keys */
    putstr()(datawin, 0, _(""));
    putstr()(datawin, 0, _("Directional keys:"));
    show_direction_keys(datawin, ord('.'), FALSE); /* '.'==self in direct'n grid */

    if (!iflags.num_pad) {
        putstr()(datawin, 0, _(""));
        putstr()(datawin, 0,
     _("Ctrl+<direction> will run in specified direction until something very"));
        sprintf(buf, _("%7s %s"), _(""), _("interesting is seen."));
        putstr()(datawin, 0, buf);
        strcpy(buf, _("Shift")); /* append the rest below */
    } else {
        /* num_pad */
        putstr()(datawin, 0, _(""));
        strcpy(buf, _("Meta")); /* append the rest next */
    }
    strcat(buf, _("+<direction> will run in specified direction until you encounter"))
;
    putstr()(datawin, 0, buf);
    sprintf(buf, _("%7s %s"), _(""), _("an obstacle."));
    putstr()(datawin, 0, buf);

    putstr()(datawin, 0, _(""));
    putstr()(datawin, 0, _("Miscellaneous keys:"));
    for (i = 0; misc_keys[i].desc; ++i) {
        if (misc_keys[i].numpad && !iflags.num_pad)
            continue;
        j = misc_keys[i].nhkf;
        key = uchar((chars[gc.Cmd.spkeys + j]));
        if (key && !chars[mov_seen + key]
            && (pfx_seen[key] == j)) {
            sprintf(buf, _("%-7s %s"), key2txt(key, buf2), misc_keys[i].desc);
            putstr()(datawin, 0, buf);
        }
    }
    /* (see above) */
    key = C(ord('c'));

    /* last of the special keys */
    sprintf(buf, _("%-7s"), key2txt(key, buf2));

    strcat(buf, _(" interrupt: break out of NetHack (SIGINT)"));
    putstr()(datawin, 0, buf);
    /* keyless special key commands, if any */
    if (spkey_gap) {
        for (i = 0; misc_keys[i].desc; ++i) {
            if (misc_keys[i].numpad && !iflags.num_pad)
                continue;
            j = misc_keys[i].nhkf;
            key = uchar((chars[gc.Cmd.spkeys + j]));
            if (!key || (pfx_seen[key] != j)) {
                sprintf(buf2, _("[%s]"), spkey_name(j));
                /* lines up with the other unassigned commands which use
                   "#%-20s ", but not with the other special keys */
                Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%-21s %s"), buf2, misc_keys[i].desc)
;
                putstr()(datawin, 0, buf);
            }
        }
    }

    putstr()(datawin, 0, _(""));
    show_menu_controls(datawin, TRUE);

    if (keylist_putcmds(datawin, TRUE, GENERALCMD, IGNORECMD, keys_used)) {
        putstr()(datawin, 0, _(""));
        putstr()(datawin, 0, _("General commands:"));
        keylist_putcmds(datawin, FALSE, GENERALCMD,
                               IGNORECMD, keys_used);
    }

    if (keylist_putcmds(datawin, TRUE, 0, GENERALCMD | IGNORECMD, keys_used)) {
        putstr()(datawin, 0, _(""));
        putstr()(datawin, 0, _("Game commands:"));
        keylist_putcmds(datawin, FALSE, 0,
                               GENERALCMD | IGNORECMD,
                               keys_used);
    }

    if (wizard() && keylist_putcmds(datawin, TRUE,
                                  WIZMODECMD, INTERNALCMD, keys_used)) {
        putstr()(datawin, 0, _(""));
        putstr()(datawin, 0, _("Debug mode commands:"));
        keylist_putcmds(datawin, FALSE,
                               WIZMODECMD, INTERNALCMD, keys_used);
    }

    display_nhwindow()(datawin, FALSE);
    destroy_nhwindow()(datawin);
    } finally { stack_pop($frame); }
}
export const IGNORECMD = (WIZMODECMD | INTERNALCMD | MOVEMENTCMD);

export function ext_func_tab_from_func(fn) { /* const struct ext_func_tab * */
    let extcmd;

    for (extcmd = extcmdlist[0]; extcmd.ef_txt; extcmd = ptr_add(extcmd, 1))
        if (extcmd.ef_funct == fn)
            return extcmd;

    return null;
}

/* returns the key bound to a movement command for given DIR_ and MV_ mode */
export function cmd_from_dir(dir, mode) { /* char */
    return cmd_from_func(move_funcs[dir][mode]);
}

/* return the key bound to extended command */
export function cmd_from_func(fn) { /* char */
    let i;
    let ret = ord('\0');
    let bind;

    for (bind = gc.Cmd.cmdbinds; bind; bind = bind.next) {
        i = bind.key;
        /* skip space; we'll use it below as last resort if no other
           keystroke invokes space's command */
        if (i == ord(' '))
            continue;
        /* skip digits if number_pad is Off; also skip '-' unless it has
           been bound to something other than what number_pad assigns */
        if (((i >= ord('0') && i <= ord('9')) || (i == ord('-') && fn == do_fight))
            && !gc.Cmd.num_pad)
            continue;

        if (bind.cmd && bind.cmd.ef_funct == fn) {
            if (i >= ord(' ') && i <= ord('~'))
                return char(i);
            else {
                ret = char(i);
            }
        }
    }
    if ((bind = cmdbind_get(ord(' '))) != null && bind.cmd
        && bind.cmd.ef_funct == fn)
        return ord(' ');
    return ret;
}

/* return visual interpretation of the key bound to extended command,
   or the ext cmd name if not bound to any key. */
export function cmd_from_ecname(ecname) { /* char * */
    let cmdnamebuf = static_array("cmd_from_ecname.cmdnamebuf", char, QBUFSZ);
    let extcmd;

    for (extcmd = extcmdlist[0]; extcmd.ef_txt; extcmd = ptr_add(extcmd, 1))
        if (!strcmp(extcmd.ef_txt, ecname)) {
            let key = cmd_from_func(extcmd.ef_funct);

            if (key)
                sprintf(cmdnamebuf, _("%s"), visctrl(key));
            else
                sprintf(cmdnamebuf, _("#%s"), ecname);
            return cmdnamebuf;
        }

    chars[cmdnamebuf + 0] = ord('\0');
    return cmdnamebuf;
}

export function ecname_from_fn(fn) { /* const char * */
    let extcmd, cmdptr = null;

    for (extcmd = extcmdlist[0]; extcmd.ef_txt; extcmd = ptr_add(extcmd, 1))
        if (extcmd.ef_funct == fn) {
            cmdptr = extcmd;
            return cmdptr.ef_txt;
        }
    return 0;
}

/* return extended command name (without leading '#') for command (*fn)() */
export function cmdname_from_func(
    fn,
    outbuf,
    fullname) { /* const char * */ /* False: just enough to disambiguate */
    let extcmd, cmdptr = null;
    let res = 0;

    for (extcmd = extcmdlist[0]; extcmd.ef_txt; extcmd = ptr_add(extcmd, 1))
        if (extcmd.ef_funct == fn) {
            cmdptr = extcmd;
            res = cmdptr.ef_txt;
            break;
        }

    if (!res) {
        /* make sure output buffer doesn't contain junk or stale data;
           return Null below */
        chars[outbuf + 0] = ord('\0');
    } else if (fullname) {
        /* easy; the entire command name */
        res = strcpy(outbuf, res);
    } else {
        let matchcmd = extcmdlist[0];
        let len = 0, maxlen = Strlen(res);

        /* find the shortest leading substring which is unambiguous */
        do {
            if (++len >= maxlen)
                break;
            for (extcmd = matchcmd; extcmd.ef_txt; extcmd = ptr_add(extcmd, 1)) {
                if (extcmd == cmdptr)
                    continue;
                if ((extcmd.flags & CMD_NOT_AVAILABLE) != 0
                    || ((extcmd.flags & WIZMODECMD) != 0 && !wizard()))
                    continue;
                if (!strncmp(res, extcmd.ef_txt, len)) {
                    matchcmd = extcmd;
                    break;
                }
            }
        } while (extcmd.ef_txt);
        copynchars(outbuf, res, int(len));
        /* [note: for Qt, this debugpline writes a couple dozen lines to
            stdout during menu setup when message window isn't ready yet] */
        debugpline2(_("shortened %s: \"%s\""), res, outbuf, __FILE__);
        res = outbuf;
    }
    return res;
}

 const struct___anon2 = struct("cmd.struct___anon2", {
    nhkf: int,
    key: uchar,
    name: ptr_to(char),
}); const spkeys_binds = static_array("spkeys_binds", struct___anon2, null, [
    { nhkf: NHKF_ESC,              key: ord('\x1b'), name: 0 }, /* no binding */
    { nhkf: NHKF_GETDIR_SELF,      key: ord('.'), name: _("getdir.self") },
    { nhkf: NHKF_GETDIR_SELF2,     key: ord('s'), name: _("getdir.self2") },
    { nhkf: NHKF_GETDIR_HELP,      key: ord('?'), name: _("getdir.help") },
    { nhkf: NHKF_GETDIR_MOUSE,     key: ord('_'), name: _("getdir.mouse") },
    { nhkf: NHKF_COUNT,            key: ord('n'), name: _("count") },
    { nhkf: NHKF_GETPOS_SELF,      key: ord('@'), name: _("getpos.self") },
    { nhkf: NHKF_GETPOS_PICK,      key: ord('.'), name: _("getpos.pick") },
    { nhkf: NHKF_GETPOS_PICK_Q,    key: ord(','), name: _("getpos.pick.quick") },
    { nhkf: NHKF_GETPOS_PICK_O,    key: ord(';'), name: _("getpos.pick.once") },
    { nhkf: NHKF_GETPOS_PICK_V,    key: ord(':'), name: _("getpos.pick.verbose") },
    { nhkf: NHKF_GETPOS_SHOWVALID, key: ord('$'), name: _("getpos.valid") },
    { nhkf: NHKF_GETPOS_AUTODESC,  key: ord('#'), name: _("getpos.autodescribe") },
    { nhkf: NHKF_GETPOS_MON_NEXT,  key: ord('m'), name: _("getpos.mon.next") },
    { nhkf: NHKF_GETPOS_MON_PREV,  key: ord('M'), name: _("getpos.mon.prev") },
    { nhkf: NHKF_GETPOS_OBJ_NEXT,  key: ord('o'), name: _("getpos.obj.next") },
    { nhkf: NHKF_GETPOS_OBJ_PREV,  key: ord('O'), name: _("getpos.obj.prev") },
    { nhkf: NHKF_GETPOS_DOOR_NEXT, key: ord('d'), name: _("getpos.door.next") },
    { nhkf: NHKF_GETPOS_DOOR_PREV, key: ord('D'), name: _("getpos.door.prev") },
    { nhkf: NHKF_GETPOS_UNEX_NEXT, key: ord('x'), name: _("getpos.unexplored.next") },
    { nhkf: NHKF_GETPOS_UNEX_PREV, key: ord('X'), name: _("getpos.unexplored.prev") },
    { nhkf: NHKF_GETPOS_VALID_NEXT, key: ord('z'), name: _("getpos.valid.next") },
    { nhkf: NHKF_GETPOS_VALID_PREV, key: ord('Z'), name: _("getpos.valid.prev") },
    { nhkf: NHKF_GETPOS_INTERESTING_NEXT, key: ord('a'), name: _("getpos.all.next") },
    { nhkf: NHKF_GETPOS_INTERESTING_PREV, key: ord('A'), name: _("getpos.all.prev") },
    { nhkf: NHKF_GETPOS_HELP,      key: ord('?'), name: _("getpos.help") },
    { nhkf: NHKF_GETPOS_LIMITVIEW, key: ord('"'), name: _("getpos.filter") },
    { nhkf: NHKF_GETPOS_MOVESKIP,  key: ord('*'), name: _("getpos.moveskip") },
    { nhkf: NHKF_GETPOS_MENU,      key: ord('!'), name: _("getpos.menu") }
]);

export function bind_specialkey(key, command) { /* boolean */
    let i;

    for (i = 0; i < SIZE(spkeys_binds); i++) {
        if (!spkeys_binds[i].name || strcmp(command, spkeys_binds[i].name))
            continue;
        chars[gc.Cmd.spkeys + (spkeys_binds[i].nhkf)] = char(key);
        return TRUE;
    }
    return FALSE;
}

function spkey_name(nhkf) { /* const char * */
    let name = 0;
    let i;

    for (i = 0; i < SIZE(spkeys_binds); i++) {
        if (spkeys_binds[i].nhkf == nhkf) {
            name = (nhkf == NHKF_ESC) ? _("escape") : spkeys_binds[i].name;
            break;
        }
    }
    return name;
}

/* returns the text for a one-byte encoding;
 * must be shorter than a tab for proper formatting */
export function key2txt(c, txt) { /* char * */ /* sufficiently long buffer */
    /* should probably switch to "SPC", "ESC", "RET"
       since nethack's documentation uses ESC for <escape> */
    if (c == ord(' '))
        sprintf(txt, _("<space>"));
    else if (c == ord('\x1b'))
        sprintf(txt, _("<esc>")); /* "<escape>" won't fit */
    else if (c == ord('\n'))
        sprintf(txt, _("<enter>")); /* "<return>" won't fit */
    else if (c == ord('\x7f'))
        sprintf(txt, _("<del>")); /* "<delete>" won't fit */
    else
        strcpy(txt, visctrl(char(c)));
    return txt;
}

export function parseautocomplete(autocomplete, condition) { /* void */
    let efp;
    let autoc;

    /* break off first autocomplete from the rest; parse the rest */
    if ((autoc = strchr(autocomplete, ord(','))) != 0
        || (autoc = strchr(autocomplete, ord(':'))) != 0) {
        chars[autoc++] = ord('\0');
        parseautocomplete(autoc, condition);
    }

    /* strip leading and trailing white space */
    autocomplete = trimspaces(autocomplete);

    if (!chars[autocomplete])
        return;

    /* take off negation */
    if (chars[autocomplete] == ord('!')) {
        /* unlike most options, a leading "no" might actually be a part of
         * the extended command.  Thus you have to use ! */
        autocomplete++;
        autocomplete = trimspaces(autocomplete);
        condition = +!condition;
    }

    /* find and modify the extended command */
    for (efp = extcmdlist[0]; efp.ef_txt; efp = ptr_add(efp, 1)) {
        if (!strcmp(autocomplete, efp.ef_txt)) {
            if (condition == ((efp.flags & AUTOCOMPLETE) ? FALSE : TRUE)) {
                if ((efp.flags & AUTOCOMP_ADJ))
                    efp.flags &= unsigned(~AUTOCOMP_ADJ);
                else
                    efp.flags |= AUTOCOMP_ADJ;
            }
            if (condition)
                efp.flags |= AUTOCOMPLETE;
            else
                efp.flags &= unsigned(~AUTOCOMPLETE);
            return;
        }
    }

    /* not a real extended command */
    raw_printf(_("Bad autocomplete: invalid extended command '%s'."),
               autocomplete);
    wait_synch()();
}

/* add changed autocompletions to the string buffer in config file format */
export function all_options_autocomplete(sbuf) { /* void */
    const $frame = stack_frame(); try {
    let efp;
    let buf = stack_array(char, BUFSZ);

    for (efp = extcmdlist[0]; efp.ef_txt; efp = ptr_add(efp, 1))
        if ((efp.flags & AUTOCOMP_ADJ) != 0) {
            sprintf(buf, _("AUTOCOMPLETE=%s%s\n"), (efp.flags & AUTOCOMPLETE) ? _("") : _("!"), efp.ef_txt)

;
            strbuf_append(sbuf, buf);
        }
    } finally { stack_pop($frame); }
}

/* return the number of changed autocompletions */
export function count_autocompletions() { /* int */
    let efp;
    let n = 0;

    for (efp = extcmdlist[0]; efp.ef_txt; efp = ptr_add(efp, 1))
        if ((efp.flags & AUTOCOMP_ADJ) != 0)
            n++;

    return n;
}

/* save&clear the mouse button actions, or restore the saved ones */
export function lock_mouse_buttons(savebtns) { /* void */
    let mousebtn = static_array("lock_mouse_buttons.mousebtn", ptr_to(struct_ext_func_tab), NUM_MOUSE_BUTTONS, [ null ]);
    let i;

    if (savebtns) {
        for (i = 0; i < NUM_MOUSE_BUTTONS; i++) {
            mousebtn[i] = gc.Cmd.mousebtn[i];
            gc.Cmd.mousebtn[i] = null;
        }
    } else {
        for (i = 0; i < NUM_MOUSE_BUTTONS; i++)
            gc.Cmd.mousebtn[i] = mousebtn[i];
    }
}

/* called at startup and after number_pad is twiddled */
export function reset_commands(initial) { /* void */
    let sdir = init_string(static_array("reset_commands.sdir", char, sizeof_string("hykulnjb><")), _("hykulnjb><"), true),
                      sdir_swap_yz = init_string(static_array("reset_commands.sdir_swap_yz", char, sizeof_string("hzkulnjb><")), _("hzkulnjb><"), true),
                      ndir = init_string(static_array("reset_commands.ndir", char, sizeof_string("47896321><")), _("47896321><"), true),
                      ndir_phone_layout = init_string(static_array("reset_commands.ndir_phone_layout", char, sizeof_string("41236987><")), _("41236987><"), true);
    let ylist = static_array("reset_commands.ylist", int, null, [
        ord('y'), ord('Y'), C(ord('y')), M(ord('y')), M(ord('Y')), M(C(ord('y')))
    ]);
    let back_dir_cmd = static_array("reset_commands.back_dir_cmd", array_of(ptr_to(struct_ext_func_tab), N_MOVEMODES), N_DIRS);
    let back_dir_key = static_array("reset_commands.back_dir_key", array_of(uchar, N_MOVEMODES), N_DIRS);
    let backed_dir_cmd = static_var("reset_commands.backed_dir_cmd", schar, FALSE);
    let flagtemp;
    let c, i, updated = 0;
    let dir, mode;

    if (initial) {
        updated = 1;
        gc.Cmd.num_pad = FALSE;
        gc.Cmd.pcHack_compat = gc.Cmd.phone_layout = gc.Cmd.swap_yz = FALSE;
        for (i = 0; i < SIZE(spkeys_binds); i++)
            chars[gc.Cmd.spkeys + (spkeys_binds[i].nhkf)] = char(spkeys_binds[i].key);
        commands_init();
    } else {
        if (backed_dir_cmd[0]) {
            for (dir = 0; dir < N_DIRS; dir++) {
                for (mode = 0; mode < N_MOVEMODES; mode++) {
                    cmdbind_add(uchars[back_dir_key[dir] + mode], back_dir_cmd[dir][mode], FALSE);
                }
            }
        }

        /* basic num_pad */
        flagtemp = iflags.num_pad;
        if (flagtemp != gc.Cmd.num_pad) {
            gc.Cmd.num_pad = flagtemp;
            ++updated;
        }
        /* swap_yz mode (only applicable for !num_pad); intended for
           QWERTZ keyboard used in Central Europe, particularly Germany */
        flagtemp = (iflags.num_pad_mode & 1) ? +!gc.Cmd.num_pad : FALSE;
        if (flagtemp != gc.Cmd.swap_yz) {
            gc.Cmd.swap_yz = flagtemp;
            ++updated;
            /* FIXME? should Cmd.spkeys[] be scanned for y and/or z to swap?
               Cmd.swap_yz has been toggled;
               perform the swap (or reverse previous one) */
            for (i = 0; i < SIZE(ylist); i++) {
                c = ylist[i] & 0xff;
                cmdbind_swapkeys(uchar(c), uchar(c + 1));
            }
        }
        /* MSDOS compatibility mode (only applicable for num_pad) */
        flagtemp = (iflags.num_pad_mode & 1) ? gc.Cmd.num_pad : FALSE;
        if (flagtemp != gc.Cmd.pcHack_compat) {
            gc.Cmd.pcHack_compat = flagtemp;
            ++updated;
            /* pcHack_compat has been toggled */

            /* FIXME: NHKF_DOINV2 ought to be implemented instead of this */
            c = M(ord('0')) & 0xff;
            if (gc.Cmd.pcHack_compat)
                cmdbind_add(uchar(c), ext_func_tab_from_func(dotypeinv), FALSE);
            else
                cmdbind_remove(uchar(c));
        }
        /* phone keypad layout (only applicable for num_pad) */
        flagtemp = (iflags.num_pad_mode & 2) ? gc.Cmd.num_pad : FALSE;
        if (flagtemp != gc.Cmd.phone_layout) {
            gc.Cmd.phone_layout = flagtemp;
            ++updated;
            /* phone_layout has been toggled */
            for (i = 0; i < 3; i++) {
                c = ord('1') + i;             /* 1,2,3 <-> 7,8,9 */
                cmdbind_swapkeys(uchar(c), uchar(c + 6));
                c = (M(ord('1')) & 0xff) + i; /* M-1,M-2,M-3 <-> M-7,M-8,M-9 */
                cmdbind_swapkeys(uchar(c), uchar(c + 6));
            }
        }
    } /*?initial*/

    /* choose updated movement keys */
    if (updated)
        gc.Cmd.serialno++;
    gc.Cmd.dirchars = !gc.Cmd.num_pad
                       ? (!gc.Cmd.swap_yz ? sdir : sdir_swap_yz)
                       : (!gc.Cmd.phone_layout ? ndir : ndir_phone_layout);
    gc.Cmd.alphadirchars = !gc.Cmd.num_pad ? gc.Cmd.dirchars : sdir;

    /* back up the commands & keys overwritten by new movement keys */
    for (dir = 0; dir < N_DIRS; dir++) {
        for (mode = MV_WALK; mode < N_MOVEMODES; mode++) {
            let di = uchar((chars[gc.Cmd.dirchars + dir]));
            let bind;

            if (!gc.Cmd.num_pad) {
                if (mode == MV_RUN) di = uchar(highc(char(di)));
                else if (mode == MV_RUSH) di = C(di);
            } else {
                if (mode == MV_RUN) di = uchar(M(di));
                else if (mode == MV_RUSH) di = uchar(M(di));
            }
            uchars[back_dir_key[dir] + mode] = di;
            if ((bind = cmdbind_get(di)) != null)
                back_dir_cmd[dir][mode] = bind.cmd;
            else
                back_dir_cmd[dir][mode] = null;
            cmdbind_remove(di);
        }
    }
    backed_dir_cmd[0] = TRUE;

    /* bind the new keys to movement commands */
    for (i = 0; i < N_DIRS; i++) {
        bind_key_fn(uchar(chars[gc.Cmd.dirchars + i]), move_funcs[i][MV_WALK]);
        if (!gc.Cmd.num_pad) {
            bind_key_fn(uchar(highc(chars[gc.Cmd.dirchars + i])),
                               move_funcs[i][MV_RUN]);
            bind_key_fn(C(chars[gc.Cmd.dirchars + i]), move_funcs[i][MV_RUSH]);
        } else {
            /* M(number) works when altmeta is on */
            bind_key_fn(uchar(M(chars[gc.Cmd.dirchars + i])), move_funcs[i][MV_RUN]);
            /* can't bind highc() or C() of digits. just use the 5 prefix. */
        }
    }
    update_rest_on_space();
    gc.Cmd.extcmd_char = cmd_from_func(doextcmd);
}

/* called when 'rest_on_space' is toggled, also called by reset_commands()
   from initoptions_init() which takes place before key bindings have been
   processed, and by initoptions_finish() after key bindings so that we
   can remember anything bound to <space> in 'unrestonspace' */
export function update_rest_on_space() { /* void */
    /* cloned from extcmdlist['.'], then slightly modified to be distinct;
       donull is all that's needed for it to operate; command name and
       description get shown by help menu's "Info on what a given key does"
       (which runs the '&' command) and "Full list of keyboard commands" */
    let restonspace = static_struct("update_rest_on_space.restonspace", struct_ext_func_tab, {
        key: ord(' '), ef_txt: _("wait"), ef_desc: _("rest one move via 'rest_on_space' option"),
        ef_funct: donull, flags: (IFBURIED | CMD_M_PREFIX), f_text: _("waiting")
    });
    let unrestonspace = static_var("update_rest_on_space.unrestonspace", ptr_to(struct_ext_func_tab), null);
    let bind = cmdbind_get(ord(' '));

    /* when 'rest_on_space' is On, <space> will run the #wait command;
       when it is Off, <space> will use 'unrestonspace' which will either
       be Null and elicit "Unknown command ' '." or have some non-Null
       command bound in player's RC file */
    if (bind && bind.cmd != restonspace)
        unrestonspace[0] = bind.cmd;
    cmdbind_add(ord(' '), flags.rest_on_space ? restonspace : unrestonspace[0], FALSE);
}

/* commands which accept 'm' prefix to request menu operation or other
   alternate behavior; it's also overloaded for move-without-autopickup;
   there is no overlap between the two groups of commands */
function accept_menu_prefix(ec) { /* boolean */
    return (ec && ((ec.flags & CMD_M_PREFIX) != 0) ? 1 : 0);
}

/* choose a random character, biased towards movement commands, primarily
   for debug-fuzzer testing */
export function randomkey() { /* char */
    let i = static_var("randomkey.i", unsigned, 0);
    let last_c = static_var("randomkey.last_c", char, ord('\0'));
    let c;

    /* give ^A and ^P a high probability of being repeated */
    if ((last_c[0] == C(ord('a')) || last_c[0] == C(ord('p')))
        && program_state.input_state == commandInp && rn2(5))
        return last_c[0];

    switch (rn2(16)) {
    default:
        c = ord('\x1b');
        break;
    case 0:
        c = ord('\n');
        break;
    case 1:
    case 2:
    case 3:
    case 4:
        c = char(rn1(ord('~') - ord(' ') + 1, ord(' ')));
        break;
    case 5:
        c = (rn2(2) ? ord('\t') : ord(' '));
        break;
    case 6:
        c = char(rn1(ord('z') - ord('a') + 1, ord('a')));
        break;
    case 7:
        c = char(rn1(ord('Z') - ord('A') + 1, ord('A')));
        break;
    case 8:
        c = char(extcmdlist[i[0]++ % SIZE(extcmdlist)].key);
        break;
    case 9:
        c = ord('#');
        break;
    case 10:
    case 11:
    case 12:
        {
            let d = rn2(N_DIRS);
            let m = rn2(7) ? MV_WALK : (!rn2(3) ? MV_RUSH : MV_RUN);

            c = cmd_from_dir(d, m);
        }
        break;
    case 13:
        c = char(rn1(ord('9') - ord('0') + 1, ord('0')));
        break;
    case 14:
        /* any char, but avoid '\0' because it's used for mouse click */
        c = char(rnd(iflags.wc_eight_bit_input ? 255 : 127));
        break;
    }

    if (program_state.input_state == commandInp)
        last_c[0] = c;
    return c;
}

export function random_response(buf, sz) { /* void */
    let c;
    let count = 0;

    for (;;) {
        c = randomkey();
        if (c == ord('\n'))
            break;
        if (c == ord('\x1b')) {
            count = 0;
            break;
        }
        if (count < sz - 1)
            chars[buf + (count++)] = c;
    }
    chars[buf + count] = ord('\0');
}

export function rnd_extcmd_idx() { /* int */
    return rn2(extcmdlist_length[0] + 1) - 1;
}

function reset_cmd_vars(reset_cmdq) { /* void */
    svc.context.run = 0;
    svc.context.nopick = svc.context.forcefight = FALSE;
    svc.context.move = svc.context.mv = FALSE;
    gd.domove_attempting = 0;
    gm.multi = 0;
    iflags.menu_requested = FALSE;
    svc.context.travel = svc.context.travel1 = 0;
    if (gt.travelmap) {
        selection_free(gt.travelmap, TRUE);
        gt.travelmap = null;
    }
    if (reset_cmdq) {
        cmdq_clear(CQ_CANNED);
        cmdq_clear(CQ_REPEAT);
    }
}

export function rhack(key) { /* void */
    const $frame = stack_frame(); try {
    let $goto = null; var cq = stack_struct(struct__cmd_queue);
    var bad_command, firsttime = +(key == 0);
    var cmdq = null;
    var cmdq_ec = null, prefix_seen = null;
    var was_m_prefix = FALSE;
    var func = dummyfunction;

    iflags.menu_requested = FALSE;
    svc.context.nopick = 0;
 $goto_got_prefix_input: for (;;) { switch ($goto) { default: case "got_prefix_input": $goto = null;

    if (program_state.done_hup)
        end_of_input();

    if ((cmdq = cmdq_pop()) != null) {
        /* doing queued commands */
        struct_assign(cq, cmdq);
        free(addr_of(cmdq));
        if (cq.typ == CMDQ_EXTCMD && (cmdq_ec = cq.ec_entry) != null)
            { $goto = "do_cmdq_extcmd"; continue $goto_got_prefix_input; };
        /* already handled a queued command (goto do_cmdq_extcmd);
           if something other than a key is queued, we'll drop down
           to the !*cmd handling which clears out the command-queue */
        key = (cq.typ == CMDQ_KEY) ? cq.key : 0;
    } else if (firsttime) {
        key = parse();
        /* parse() pushed a cmd but didn't return any key */
        if (!key && cmdq_peek(CQ_CANNED))
            { $goto = "got_prefix_input"; continue $goto_got_prefix_input; };
    }

    /* if there's no command, there's nothing to do except reset */
    if (!key || key == char(0o377)
        || key == chars[gc.Cmd.spkeys + NHKF_ESC]) {
        if (key == chars[gc.Cmd.spkeys + NHKF_ESC])
            /* don't perform next sanity check if player typed ESC for
               the current command, similar to handling for CMD_INSANE
               flag below (^P and ^R) */
            iflags.sanity_no_check = iflags.sanity_check;
        else
            nhbell()();
        reset_cmd_vars(TRUE);
        return;
    }

    /* handle most movement commands */
    svc.context.travel = svc.context.travel1 = 0;
    case "do_cmdq_extcmd": {
        switch ($goto) { default: var tlist;
        var res;

        gc.cmd_bind = cmdbind_get(key & 0xFF);

 case "do_cmdq_extcmd": $goto = null;
        if (cmdq_ec)
            tlist = cmdq_ec;
        else
            tlist = gc.cmd_bind ? gc.cmd_bind.cmd : null; }

        /* current - use key to directly index cmdlist array */
        if (tlist != null) {
            if (!can_do_extcmd(tlist)) {
                /* can_do_extcmd() already gave a message */
                reset_cmd_vars(TRUE);
                res = ECMD_OK;
            } else if (prefix_seen && !(tlist.flags & PREFIXCMD)
                       && !(tlist.flags & (was_m_prefix ? CMD_M_PREFIX
                                                         : CMD_gGF_PREFIX))) {
                var pfxidx = cmd_from_func(prefix_seen.ef_funct);
                var which = (pfxidx != 0) ? visctrl(pfxidx)
                                    : (prefix_seen.ef_funct == do_reqmenu)
                                      ? _("move-no-pickup or request-menu")
                                      : prefix_seen.ef_txt;

                /*
                 * We got a prefix previously and looped for another
                 * command instead of returning, but the command we got
                 * doesn't accept a prefix.  The feedback here supersedes
                 * the former call to help_dir() (for 'bad_command' below).
                 */
                if (was_m_prefix) {
                    custompline(SUPPRESS_HISTORY,
                          _("The %s command does not accept '%s' prefix."),
                          tlist.ef_txt, which);
                } else {
                    var ch = tlist.key;
                    var up = +(ch == ord('<') || tlist.ef_funct == doup),
                            down = +(ch == ord('>') || tlist.ef_funct == dodown);

                    pline(
                _("The '%s' prefix should be followed by a movement command%s."),
                          which,
                          (up || down) ? _(" other than up or down") : _(""));
                }
                res = ECMD_FAIL;
                prefix_seen = null;
            } else {
                /* we discard 'const' because some compilers seem to have
                   trouble with the pointer passed to set_occupation() */
                func = tlist.ef_funct;
                if (tlist.f_text && !go.occupation && gm.multi)
                    set_occupation(func, tlist.f_text, gm.multi);
                ge.ext_tlist = null;

                if (!gi.in_doagain && func != do_repeat && func != doextcmd) {
                    if (!prefix_seen)
                        cmdq_clear(CQ_REPEAT);
                    cmdq_add_ec(CQ_REPEAT,
                                tlist.ef_funct);
                } else {
                    if (func == doextcmd) {
                        cmdq_clear(CQ_REPEAT);
                    }
                }
                /* some commands shouldn't trigger sanity_check() because
                   if it produces output that might interfere with them;
                   note: if sanity_check is False, this has no effect */
                if ((tlist.flags & CMD_INSANE) != 0)
                    iflags.sanity_no_check = iflags.sanity_check;

                res = func(); /* perform the command */
                /* if 'func' is doextcmd(), 'tlist' is for Cmd.commands['#']
                   rather than for the command that doextcmd() just ran;
                   doextcmd() notifies us what that was via ext_tlist;
                   other commands leave it Null */
                if (ge.ext_tlist) {
                    tlist = ge.ext_tlist, ge.ext_tlist = null;
                    /* Add the command post-execution */
                    cmdq_add_ec(CQ_REPEAT,
                                tlist.ef_funct);
                    /* shift the command to first */
                    cmdq_shift(CQ_REPEAT);
                }

                if ((tlist.flags & PREFIXCMD) != 0) {
                    /* it was a prefix command, mark and get another cmd */
                    if ((res & ECMD_CANCEL) != 0) {
                        /* prefix commands cancel if pressed twice */
                        reset_cmd_vars(TRUE);
                        return;
                    }
                    prefix_seen = tlist;
                    cmdq_ec = null;
                    if (func == do_reqmenu)
                        was_m_prefix = TRUE;
                    { $goto = "got_prefix_input"; continue $goto_got_prefix_input; }
                } else if (!(tlist.flags & MOVEMENTCMD)
                           && gd.domove_attempting) {
                    /* not a movement command, but a move prefix earlier? */
                    ; /* just do nothing */
                } else if (((gd.domove_attempting
                             & (DOMOVE_RUSH | DOMOVE_WALK)) != 0)
                           && !svc.context.travel && !dxdy_moveok()) {
                    /* trying to move diagonally as a grid bug */
                    You_cant(_("get there from here..."));
                    reset_cmd_vars(TRUE);
                    return;
                } else if ((gd.domove_attempting & DOMOVE_WALK) != 0) {
                    if (gm.multi)
                        svc.context.mv = TRUE;
                    domove();
                    svc.context.forcefight = 0;
                    iflags.menu_requested = FALSE;
                    return;
                } else if ((gd.domove_attempting & DOMOVE_RUSH) != 0) {
                    if (firsttime) {
                        if (!gm.multi)
                            gm.multi = max(COLNO, ROWNO);
                        u.last_str_turn = 0;
                    }
                    svc.context.mv = TRUE;
                    domove();
                    iflags.menu_requested = FALSE;
                    return;
                }
                prefix_seen = null;
            }
            /* it is possible to have a result of (ECMD_TIME|ECMD_CANCEL)
               [for example, using 'f'ire, manually filling quiver with
               wielded weapon or dual-wielded swap-weapon, then cancelling
               at the direction prompt; using time to unwield should take
               precedence over general cancellation] */
            if ((res & (ECMD_CANCEL | ECMD_FAIL)) != 0) {
                /* command was canceled by user, maybe they declined to
                   pick an object to act on, or command failed to finish */
                reset_cmd_vars(TRUE);
            } else if ((res & (ECMD_OK | ECMD_TIME)) == ECMD_OK) {
                reset_cmd_vars(+(gm.multi < 0));
            }
            /* reset_cmd_vars() sets context.move to False so we might
               need to change it [back] to True */
            if ((res & ECMD_TIME) != 0) {
                svc.context.move = TRUE;
                if (func != dokick) {
                    /* hero did something else than kicking a location;
                       reset the location, so pets don't avoid it */
                    gk.kickedloc.x = 0, gk.kickedloc.y = 0;
                }
            }
            return;
        }
        /* if we reach here, cmd wasn't found in cmdlist[] */
        bad_command = TRUE;
    } } break; }

    if (bad_command) {
        custompline(SUPPRESS_HISTORY, _("Unknown command '%s'."), visctrl(key));
        cmdq_clear(CQ_CANNED);
        cmdq_clear(CQ_REPEAT);
        iflags.sanity_no_check = iflags.sanity_check; /* skip sanity check */
    }
    /* didn't move */
    svc.context.move = FALSE;
    gm.multi = 0;
    return;
    } finally { stack_pop($frame); }
}

/* convert an x,y pair into a direction code */
export function xytodir(x, y) { /* int */
    let dd;

    for (dd = 0; dd < N_DIRS; dd++)
        if (x == chars[xdir + dd] && y == chars[ydir + dd])
            return dd;
    return DIR_ERR;
}

/* convert a direction code into an x,y pair */
export function dirtocoord(cc, dd) { /* void */
    if (dd > DIR_ERR && dd < N_DIRS_Z) {
        cc.x = chars[xdir + dd];
        cc.y = chars[ydir + dd];
    }
}

/* also sets u.dz, but returns false for <> */
export function movecmd(sym, mode) { /* int */
    let d = DIR_ERR;
    let bind = cmdbind_get(uchar(sym));

    if (bind && bind.cmd) {
        let fnc = bind.cmd.ef_funct;

        if (mode == MV_ANY) {
            for (d = N_DIRS_Z - 1; d > DIR_ERR; d--)
                if (fnc == move_funcs[d][MV_WALK]
                    || fnc == move_funcs[d][MV_RUN]
                    || fnc == move_funcs[d][MV_RUSH])
                    break;
        } else {
            for (d = N_DIRS_Z - 1; d > DIR_ERR; d--)
                if (fnc == move_funcs[d][mode])
                    break;
        }
    }

    if (d != DIR_ERR) {
        u.dx = chars[xdir + d];
        u.dy = chars[ydir + d];
        u.dz = chars[zdir + d];
        return +!u.dz;
    }
    u.dz = 0;
    return 0;
}

/* grid bug handling */
export function dxdy_moveok() { /* int */
    if (u.dx && u.dy && NODIAG(u.umonnum))
        u.dx = u.dy = 0;
    return (u.dx || u.dy ? 1 : 0);
}

/* decide whether character (user input keystroke) requests screen repaint */
export function redraw_cmd(c) { /* boolean */
    let uc = uchar(c);
    let bind = cmdbind_get(uc);

    return (bind && bind.cmd
                      && bind.cmd.ef_funct == doredraw ? 1 : 0);
}

/*
 * uses getdir() but unlike getdir() it specifically
 * produces coordinates using the direction from getdir()
 * and verifies that those coordinates are ok.
 *
 * If the call to getdir() returns 0, Never_mind is displayed.
 * If the resulting coordinates are not okay, emsg is displayed.
 *
 * Returns non-zero if coordinates in cc are valid.
 */
export function get_adjacent_loc(
    prompt,
    emsg,
    x, y,
    cc) { /* int */
    let new_x, new_y;
    if (!getdir(prompt)) {
        pline1(Never_mind());
        return 0;
    }
    new_x = x + u.dx;
    new_y = y + u.dy;
    if (cc && isok(new_x, new_y)) {
        cc.x = new_x;
        cc.y = new_y;
    } else {
        if (emsg)
            pline1(emsg);
        return 0;
    }
    return 1;
}

/* prompt for a direction (specified via movement keystroke) and return it
   in u.dx, u.dy, and u.dz; function return value is 1 for ok, 0 otherwise */
export function getdir(s) { /* int */
    const $frame = stack_frame(); try {
    let $goto = null; var qbuf = stack_array(char, QBUFSZ), cc = stack_struct(struct_nhcoord);
    var dirsym;
    var is_mov;
    var cmdq = cmdq_pop();

    $goto_retry: for (;;) { switch ($goto) { default: if (cmdq) {
        if (cmdq.typ == CMDQ_DIR) {
            if (!cmdq.dirz) {
                dirsym = chars[gc.Cmd.dirchars + xytodir(cmdq.dirx, cmdq.diry)];
            } else {
                dirsym = chars[gc.Cmd.dirchars + ((cmdq.dirz > 0) ? DIR_DOWN
                                                          : DIR_UP)];
            }
        } else if (cmdq.typ == CMDQ_KEY) {
            dirsym = cmdq.key;
        } else {
            cmdq_clear(CQ_CANNED);
            dirsym = ord('\0');
            impossible(_("getdir: command queue had no dir?"));
        }
        free(addr_of(cmdq));
        { $goto = "got_dirsym"; continue $goto_retry; }
    }

 case "retry": $goto = null;
    program_state.input_state = getdirInp;
    if (gi.in_doagain || chars[readchar_queue[0]]) {
        dirsym = readchar();
    } else {
        dirsym = yn_function((s && chars[s] != ord('^')) ? s : _("In what direction?"),
                             0, ord('\0'), FALSE);

        /* for the fuzzer, usually force the result to be a valid direction,
           but sometimes let it exercise the invalid direction code; we
           don't try to enforce no-diagonal for hero in grid bug form since
           things like '^' to look at adjacent trap shouldn't be bound by
           that (caller is expected to handle situations where it matters) */
        if (iflags.debug_fuzzer && rn2(20)) {
            switch (rn2(20)) {
            case 0:
                dirsym = chars[gc.Cmd.spkeys + (rn2(2) ? NHKF_GETDIR_SELF : NHKF_ESC)];
                break;
            case 1:
                dirsym = chars[gc.Cmd.dirchars + (rn2(2) ? DIR_DOWN : DIR_UP)];
                break;
            default:
                dirsym = chars[gc.Cmd.dirchars + rn2(N_DIRS)];
                break;
            }
        }
    }
    /* remove the prompt string so caller won't have to */
    clear_nhwindow()(WIN_MESSAGE);

    if (redraw_cmd(dirsym)) { /* ^R */
        docrt_flags(docrtRefresh); /* redraw */
        { $goto = "retry"; continue $goto_retry; }
    }
    if (!gi.in_doagain)
        cmdq_add_key(CQ_REPEAT, dirsym);

 case "got_dirsym": $goto = null;
    if (dirsym == chars[gc.Cmd.spkeys + NHKF_GETDIR_SELF]
        || dirsym == chars[gc.Cmd.spkeys + NHKF_GETDIR_SELF2]) {
        u.dx = u.dy = u.dz = 0;
    } else if (dirsym == chars[gc.Cmd.spkeys + NHKF_GETDIR_MOUSE]) {
        var pos, mod;

        /*
         * For #therecmdmenu:
         * Player has entered the 'simulated mouse' key ('_' by default)
         * at the "which direction?" prompt so we use getpos() to get a
         * simulated click after moving cursor to the desired location.
         *
         * getpos() returns 0..3 for period, comma, semi-colon, colon.
         * We treat "," as left click and "." as right click due to
         * their positions relative to each other on the keyboard.
         * Using ";" as synonym for "," and ":" for "." is due to their
         * shapes rather than to their keyboard location.
         *
         * Those keys aren't separately bindable for being treated as
         * clicks but we do honor their getpos bindings if player has
         * changed them.  (Bound values might have scrambled keyboard
         * locations relative to each other so ruin the memory aid of
         * "," being left of ".".)
         */
        sprintf(qbuf, _("desired location, then type '%s' for left click, '%s' for right"), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_PICK_Q]), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_PICK]))

; /* '.' */
        cc.x = u.ux, cc.y = u.uy; /* starting cursor location for getpos() */
        pos = getpos(cc, TRUE, qbuf);

        if (pos < 0) {
            /* ESC or other rejection */
            u.dx = u.dy = u.dz = 0;
            mod = 0; /* neither CLICK_1 nor CLICK_2 */
        } else {
            /* caller expects simulated click to be relative to hero's spot */
            u.dx = cc.x - u.ux;
            u.dy = cc.y - u.uy;
            /* non-zero getdir_click actually means ok to click farther than
               one spot away from hero; adjacent click is always allowed */
            if (!iflags.getdir_click) {
                u.dx = sgn(u.dx);
                u.dy = sgn(u.dy);
            }
            u.dz = 0;

            switch (pos + NHKF_GETPOS_PICK) {
            case NHKF_GETPOS_PICK_Q: /* 1: quick:   ',' */
            case NHKF_GETPOS_PICK_O: /* 2: once:    ';' */
                mod = CLICK_1;
                break;
            case NHKF_GETPOS_PICK:   /* 0: normal:  '.' */
            case NHKF_GETPOS_PICK_V: /* 3: verbose: ':' */
                mod = CLICK_2;
                break;
            default:
                /* could plug in bound values for spkeys[NHKF_GETPOS_PICK],&c
                   but that feels like overkill for something which should
                   never happen; just show their default values */
                impossible(_("getpos successful but not one of [.,;:] (%d)"),
                           pos);
                mod = 0; /* neither CLICK_1 nor CLICK_2 */
                pos = -1; /* return failure */
                break;
            }
        }
        if (iflags.getdir_click)
            iflags.getdir_click = mod;
        return +(pos >= 0);
    } else if (!(is_mov = movecmd(dirsym, MV_ANY)) && !u.dz) {
        var did_help = FALSE, help_requested;

        if (!strchr(quitchars, dirsym)) {
            help_requested = +(dirsym == chars[gc.Cmd.spkeys + NHKF_GETDIR_HELP]);
            if (help_requested || iflags.cmdassist) {
                did_help = help_dir((s && chars[s] == ord('^')) ? dirsym : ord('\0'),
                                    uchar(chars[gc.Cmd.spkeys + NHKF_ESC]),
                                    help_requested ? 0
                                    : _("Invalid direction key!"));
                if (help_requested)
                    { $goto = "retry"; continue $goto_retry; };
            }
            if (!did_help)
                pline(_("What a strange direction!"));
        }
        return 0;
    } else if (is_mov && !dxdy_moveok()) {
        You_cant(_("orient yourself that direction."));
        return 0;
    } } break; }
    if (!u.dz)
        confdir(FALSE);
    return 1;
    } finally { stack_pop($frame); }
}

function show_direction_keys(
    win,
    centerchar,
    nodiag) { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);

    if (!centerchar)
        centerchar = ord(' ');

    if (nodiag) {
        sprintf(buf, _("             %s   "), visctrl(cmd_from_func(do_move_north)))
;
        putstr()(win, 0, buf);
        putstr()(win, 0, _("             |   "));
        sprintf(buf, _("          %s- %c -%s"), visctrl(cmd_from_func(do_move_west)), centerchar, visctrl(cmd_from_func(do_move_east)))

;
        putstr()(win, 0, buf);
        putstr()(win, 0, _("             |   "));
        sprintf(buf, _("             %s   "), visctrl(cmd_from_func(do_move_south)))
;
        putstr()(win, 0, buf);
    } else {
        sprintf(buf, _("          %s  %s  %s"), visctrl(cmd_from_func(do_move_northwest)), visctrl(cmd_from_func(do_move_north)), visctrl(cmd_from_func(do_move_northeast)))

;
        putstr()(win, 0, buf);
        putstr()(win, 0, _("           \\ | / "));
        sprintf(buf, _("          %s- %c -%s"), visctrl(cmd_from_func(do_move_west)), centerchar, visctrl(cmd_from_func(do_move_east)))

;
        putstr()(win, 0, buf);
        putstr()(win, 0, _("           / | \\ "));
        sprintf(buf, _("          %s  %s  %s"), visctrl(cmd_from_func(do_move_southwest)), visctrl(cmd_from_func(do_move_south)), visctrl(cmd_from_func(do_move_southeast)))

;
        putstr()(win, 0, buf);
    };
    } finally { stack_pop($frame); }
}

/* explain choices if player has asked for getdir() help or has given
   an invalid direction after a prefix key ('F', 'g', 'm', &c), which
   might be bogus but could be up, down, or self when not applicable */
function help_dir(
    sym,
    spkey,
    msg) { /* boolean */
    const $frame = stack_frame(); try {
    let wiz_only_list = init_string(static_array("help_dir.wiz_only_list", char, sizeof_string("EFGIVW")), _("EFGIVW"), true);
    let ctrl;
    let win;
    let buf = stack_array(char, BUFSZ), buf2 = stack_array(char, BUFSZ), explain;
    let dothat;
    let prefixhandling;

    /* NHKF_ESC indicates that player asked for help at getdir prompt */
    /* viawindow = (spkey == gc.Cmd.spkeys[NHKF_ESC] || iflags.cmdassist); */
    prefixhandling = +(spkey != chars[gc.Cmd.spkeys + NHKF_ESC]);
    /*
     * Handling for prefix keys that don't want special directions.
     * Delivered via pline if 'cmdassist' is off, or instead of the
     * general message if it's on.
     */
    dothat = _("do that");
    /* how = " at"; */ /* for "<action> at yourself"; not used for up/down */

    chars[buf + 0] = ord('\0');
    /* #if 0: not in this build */

    (prefixhandling);

    win = create_nhwindow()(NHW_TEXT);
    if (!win)
        return FALSE;

    if (chars[buf]) {
        /* show bad-prefix message instead of general invalid-direction one */
        putstr()(win, 0, buf);
        putstr()(win, 0, _(""));
    } else if (msg) {
        sprintf(buf, _("cmdassist: %s"), msg);
        putstr()(win, 0, buf);
        putstr()(win, 0, _(""));
    }

    if (!prefixhandling && (letter(sym) || sym == ord('['))) {
        /* '[': old 'cmdhelp' showed ESC as ^[ */
        sym = highc(sym); /* @A-Z[ (note: letter() accepts '@') */
        ctrl = (sym - ord('A')) + 1; /* 0-27 (note: 28-31 aren't applicable) */
        if ((explain = dowhatdoes_core(ctrl, buf2)) != 0
            && (!strchr(wiz_only_list, sym) || wizard())) {
            sprintf(buf, _("Are you trying to use ^%c%s?"), sym, strchr(wiz_only_list, sym) ? _("")
                        : _(" as specified in the Guidebook"))
;
            putstr()(win, 0, buf);
            putstr()(win, 0, _(""));
            putstr()(win, 0, explain);
            putstr()(win, 0, _(""));
            putstr()(win, 0,
                  _("To use that command, hold down the <Ctrl> key as a shift"));
            sprintf(buf, _("and press the <%c> key."), sym);
            putstr()(win, 0, buf);
            putstr()(win, 0, _(""));
        }
    }

    sprintf(buf, _("Valid direction keys%s%s%s are:"), prefixhandling ? _(" to ") : _(""), prefixhandling ? dothat : _(""), NODIAG(u.umonnum) ? _(" in your current form") : _(""))

;
    putstr()(win, 0, buf);
    show_direction_keys(win, !prefixhandling ? ord('.') : ord(' '), NODIAG(u.umonnum));

    if (!prefixhandling) {
        /* NOPICKUP: unlike the other prefix keys, 'm' allows up/down for
           stair traversal; we won't get here when "m<" or "m>" has been
           given but we include up and down for 'm'+invalid_direction;
           self is excluded as a viable direction for every prefix */
        putstr()(win, 0, _(""));
        putstr()(win, 0, _("          <  up"));
        putstr()(win, 0, _("          >  down"));
        if (!prefixhandling) {
            let selfi = gc.Cmd.num_pad ? NHKF_GETDIR_SELF2 : NHKF_GETDIR_SELF;

            sprintf(buf, _("       %4s  direct at yourself"), visctrl(chars[gc.Cmd.spkeys + selfi]))
;
            putstr()(win, 0, buf);
        }
    }

    if (msg) {
        /* non-null msg means that this wasn't an explicit user request */
        putstr()(win, 0, _(""));
        putstr()(win, 0,
               _("(Suppress this message with !cmdassist in config file.)"));
    }
    display_nhwindow()(win, FALSE);
    destroy_nhwindow()(win);
    return TRUE;
    } finally { stack_pop($frame); }
}

/* if hero is impaired, pick random movement direction */
export function confdir(force_impairment) { /* void */
    if (force_impairment || u_maybe_impaired()) {
        let kmax = NODIAG(u.umonnum) ? Math.trunc(N_DIRS / 2) : N_DIRS,
            k = (chars[dirs_ord + rn2(kmax)]);

        u.dx = chars[xdir + k];
        u.dy = chars[ydir + k];
    }
    return;
}

export function directionname(dir) { /* const char * */
    let dirnames = static_array("directionname.dirnames", ptr_to(char), N_DIRS_Z, [
        _("west"),      _("northwest"), _("north"),     _("northeast"), _("east"),
        _("southeast"), _("south"),     _("southwest"), _("down"),      _("up"),
    ]);

    if (dir < 0 || dir >= N_DIRS_Z)
        return _("invalid");
    return dirnames[dir];
}

export function isok(x, y) { /* int */
    /* x corresponds to curx, so x==1 is the first column. Ach. %% */
    return +(x >= 1 && x <= COLNO - 1 && y >= 0 && y <= ROWNO - 1);
}

/* #herecmdmenu command */
function doherecmdmenu() { /* int */
    let ch = here_cmd_menu();

    return (ch && ch != ord('\x1b')) ? ECMD_TIME : ECMD_OK;
}

/* #therecmdmenu command, a way to test there_cmd_menu without mouse */
function dotherecmdmenu() { /* int */
    let ch;
    let dir, click;
    let x = gc.clicklook_cc.x;
    let y = gc.clicklook_cc.y;

    iflags.getdir_click = CLICK_1 | CLICK_2; /* allow 'far' click */

    if (isok(x, y)) {
        if (x == u.ux && y == u.uy)
            ch = here_cmd_menu();
        else
            ch = there_cmd_menu(x, y, iflags.getdir_click);
        gc.clicklook_cc.x = gc.clicklook_cc.y = -1;
        iflags.getdir_click = 0;
        return (ch && ch != ord('\x1b')) ? ECMD_TIME : ECMD_OK;
    }

    dir = getdir(0);
    click = iflags.getdir_click;
    iflags.getdir_click = 0;

    if (!dir || !isok(u.ux + u.dx, u.uy + u.dy))
        return ECMD_CANCEL;

    if (u.dx || u.dy)
        ch = there_cmd_menu(u.ux + u.dx, u.uy + u.dy, click);
    else
        ch = here_cmd_menu();

    return (ch && ch != ord('\x1b')) ? ECMD_TIME : ECMD_OK;
}

/* commands for [t]herecmdmenu */

    const MCMD_NOTHING = 0;
    const MCMD_OPEN_DOOR = MCMD_NOTHING + 1;
    const MCMD_LOCK_DOOR = MCMD_OPEN_DOOR + 1;
    const MCMD_UNTRAP_DOOR = MCMD_LOCK_DOOR + 1;
    const MCMD_KICK_DOOR = MCMD_UNTRAP_DOOR + 1;
    const MCMD_CLOSE_DOOR = MCMD_KICK_DOOR + 1;
    const MCMD_SEARCH = MCMD_CLOSE_DOOR + 1;
    const MCMD_LOOK_TRAP = MCMD_SEARCH + 1;
    const MCMD_UNTRAP_TRAP = MCMD_LOOK_TRAP + 1;
    const MCMD_MOVE_DIR = MCMD_UNTRAP_TRAP + 1;
    const MCMD_RIDE = MCMD_MOVE_DIR + 1;
    const MCMD_REMOVE_SADDLE = MCMD_RIDE + 1;
    const MCMD_APPLY_SADDLE = MCMD_REMOVE_SADDLE + 1;
    const MCMD_TALK = MCMD_APPLY_SADDLE + 1;
    const MCMD_NAME = MCMD_TALK + 1;

    const MCMD_QUAFF = MCMD_NAME + 1;
    const MCMD_DIP = MCMD_QUAFF + 1;
    const MCMD_SIT = MCMD_DIP + 1;
    const MCMD_UP = MCMD_SIT + 1;
    const MCMD_DOWN = MCMD_UP + 1;
    const MCMD_DISMOUNT = MCMD_DOWN + 1;
    const MCMD_MONABILITY = MCMD_DISMOUNT + 1;
    const MCMD_PICKUP = MCMD_MONABILITY + 1;
    const MCMD_LOOT = MCMD_PICKUP + 1;
    const MCMD_TIP = MCMD_LOOT + 1;
    const MCMD_EAT = MCMD_TIP + 1;
    const MCMD_DROP = MCMD_EAT + 1;
    const MCMD_REST = MCMD_DROP + 1;
    const MCMD_LOOK_HERE = MCMD_REST + 1;
    const MCMD_LOOK_AT = MCMD_LOOK_HERE + 1;
    const MCMD_ATTACK_NEXT2U = MCMD_LOOK_AT + 1;
    const MCMD_UNTRAP_HERE = MCMD_ATTACK_NEXT2U + 1;
    const MCMD_OFFER = MCMD_UNTRAP_HERE + 1;
    const MCMD_INVENTORY = MCMD_OFFER + 1;
    const MCMD_CAST_SPELL = MCMD_INVENTORY + 1;

    const MCMD_THROW_OBJ = MCMD_CAST_SPELL + 1;
    const MCMD_TRAVEL = MCMD_THROW_OBJ + 1;

function mcmd_addmenu(win, act, txt) { /* void */
    const $frame = stack_frame(); try {
    let any = stack_struct(struct_any);
    let clr = NO_COLOR;

    /* TODO: fixed letters for the menu entries? */
    struct_assign(any, cg.zeroany);
    any.a_int = act;
    add_menu(win, nul_glyphinfo, any, ord('\0'), 0, ATR_NONE, clr, txt,
             MENU_ITEMFLAGS_NONE);
    } finally { stack_pop($frame); }
}

/* command menu entries when targeting self */
function there_cmd_menu_self(win, x, y, act) { /* int */
    const $frame = stack_frame(); try {
    let K = 0;
    let buf = stack_array(char, BUFSZ);
    let typ = levl()[x][y].typ;
    let stway = stairway_at(x, y);
    let ttmp;

    if (!u_at(x, y))
        return K;

    if ((IS_FOUNTAIN(typ) || IS_SINK(typ)) && can_reach_floor(FALSE)) {
        sprintf(buf, _("Drink from the %s"), defsyms[IS_FOUNTAIN(typ) ? S_fountain : S_sink].explanation)
;
        mcmd_addmenu(win, MCMD_QUAFF, buf), ++K;
    }
    if (IS_FOUNTAIN(typ) && can_reach_floor(FALSE))
        mcmd_addmenu(win, MCMD_DIP, _("Dip something into the fountain")), ++K;
    if (IS_THRONE(typ))
        mcmd_addmenu(win, MCMD_SIT, _("Sit on the throne")), ++K;
    if (IS_ALTAR(typ))
        mcmd_addmenu(win, MCMD_OFFER, _("Sacrifice something on the altar")), ++K;

    if (stway && stway.up) {
        sprintf(buf, _("Go up the %s"), stway.isladder ? _("ladder") : _("stairs"))
;
        mcmd_addmenu(win, MCMD_UP, buf), ++K;
    }
    if (stway && !stway.up) {
        sprintf(buf, _("Go down the %s"), stway.isladder ? _("ladder") : _("stairs"))
;
        mcmd_addmenu(win, MCMD_DOWN, buf), ++K;
    }
    if (u.usteed) { /* another movement choice */
        sprintf(buf, _("Dismount %s"), x_monnam(u.usteed, ARTICLE_THE, 0,
                         SUPPRESS_SADDLE, FALSE))
;
        mcmd_addmenu(win, MCMD_DISMOUNT, buf), ++K;
    }

    if (OBJ_AT(x, y)) {
        let otmp = svl.level.objects[x][y];

        sprintf(buf, _("Pick up %s"), otmp.v.v_nexthere ? _("items") : doname(otmp));
        mcmd_addmenu(win, MCMD_PICKUP, buf), ++K;

        if (Is_container(otmp)) {
            sprintf(buf, _("Loot %s"), doname(otmp));
            mcmd_addmenu(win, MCMD_LOOT, buf), ++K;

            sprintf(buf, _("Tip %s"), doname(otmp));
            mcmd_addmenu(win, MCMD_TIP, buf), ++K;
        }
        if (otmp.oclass == FOOD_CLASS) {
            sprintf(buf, _("Eat %s"), doname(otmp));
            mcmd_addmenu(win, MCMD_EAT, buf), ++K;
        }
    }

    if (gi.invent) {
        mcmd_addmenu(win, MCMD_INVENTORY, _("Inventory")), ++K;
        mcmd_addmenu(win, MCMD_DROP, _("Drop items")), ++K;
    }
    mcmd_addmenu(win, MCMD_REST, _("Rest one turn")), ++K;
    mcmd_addmenu(win, MCMD_SEARCH, _("Search around you")), ++K;
    mcmd_addmenu(win, MCMD_LOOK_HERE, _("Look at what is here")), ++K;

    if (num_spells() > 0)
        mcmd_addmenu(win, MCMD_CAST_SPELL, _("Cast a spell")), ++K;

    if ((ttmp = t_at(x, y)) != null && ttmp.tseen) {
        if (ttmp.ttyp != VIBRATING_SQUARE)
            mcmd_addmenu(win, MCMD_UNTRAP_HERE,
                         _("Attempt to disarm trap")), ++K;
    }
    return K;
    } finally { stack_pop($frame); }
}

/* add entries to there_cmd_menu, when x,y is next to hero */
function there_cmd_menu_next2u(
    win,
    x, y,
    mod,
    act) { /* int */
    const $frame = stack_frame(); try {
    let K = 0;
    let buf = stack_array(char, BUFSZ);
    let typ = levl()[x][y].typ;
    let ttmp;
    let mtmp;

    if (!next2u(x, y))
        return K;

    if (IS_DOOR(typ)) {
        let key_or_pick, card;
        let dm = levl()[x][y].flags;

        if ((dm & (D_CLOSED | D_LOCKED))) {
            mcmd_addmenu(win, MCMD_OPEN_DOOR, _("Open the door")), ++K;
            /* unfortunately there's no lknown flag for doors to
               remember the locked/unlocked state */
            key_or_pick = (carrying(SKELETON_KEY) || carrying(LOCK_PICK) ? 1 : 0);
            card = +(carrying(CREDIT_CARD) != null);
            if (key_or_pick || card) {
                sprintf(buf, _("%sunlock the door"), key_or_pick ? _("lock or ") : _(""))
;
                mcmd_addmenu(win, MCMD_LOCK_DOOR, upstart(buf)), ++K;
            }
            /* unfortunately there's no tknown flag for doors (or chests)
               to remember whether a trap had been found */
            mcmd_addmenu(win, MCMD_UNTRAP_DOOR,
                         _("Search the door for a trap")), ++K;
            /* [what about #force?] */
            mcmd_addmenu(win, MCMD_KICK_DOOR, _("Kick the door")), ++K;
        } else if ((dm & D_ISOPEN) && (mod == CLICK_2)) {
            mcmd_addmenu(win, MCMD_CLOSE_DOOR, _("Close the door")), ++K;
        }
    }

    if (typ <= SCORR)
        mcmd_addmenu(win, MCMD_SEARCH, _("Search for secret doors")), ++K;

    if ((ttmp = t_at(x, y)) != null && ttmp.tseen) {
        mcmd_addmenu(win, MCMD_LOOK_TRAP, _("Examine trap")), ++K;
        if (ttmp.ttyp != VIBRATING_SQUARE)
            mcmd_addmenu(win, MCMD_UNTRAP_TRAP,
                                 _("Attempt to disarm trap")), ++K;
        mcmd_addmenu(win, MCMD_MOVE_DIR, _("Move on the trap")), ++K;
    }

    if (levl()[x][y].glyph == objnum_to_glyph(BOULDER))
        mcmd_addmenu(win, MCMD_MOVE_DIR, _("Push the boulder")), ++K;

    mtmp = m_at(x, y);
    if (mtmp && !canspotmon(mtmp))
        mtmp = null;
    if (mtmp && which_armor(mtmp, W_SADDLE)) {
        let mnam = x_monnam(mtmp, ARTICLE_THE, 0,
                              SUPPRESS_SADDLE, FALSE);

        if (!u.usteed) {
            sprintf(buf, _("Ride %s"), mnam);
            mcmd_addmenu(win, MCMD_RIDE, buf), ++K;
        }
        sprintf(buf, _("Remove saddle from %s"), mnam);
        mcmd_addmenu(win, MCMD_REMOVE_SADDLE, buf), ++K;
    }
    if (mtmp && can_saddle(mtmp) && !which_armor(mtmp, W_SADDLE)
        && carrying(SADDLE)) {
        sprintf(buf, _("Put saddle on %s"), mon_nam(mtmp));
        mcmd_addmenu(win, MCMD_APPLY_SADDLE, buf), ++K;
    }
    if (mtmp && (mtmp.mpeaceful || mtmp.mtame)) {
        sprintf(buf, _("Talk to %s"), mon_nam(mtmp));
        mcmd_addmenu(win, MCMD_TALK, buf), ++K;

        sprintf(buf, _("Swap places with %s"), mon_nam(mtmp));
        mcmd_addmenu(win, MCMD_MOVE_DIR, buf), ++K;

        sprintf(buf, _("%s %s"), !has_mgivenname(mtmp) ? _("Name") : _("Rename"), mon_nam(mtmp))

;
        mcmd_addmenu(win, MCMD_NAME, buf), ++K;
    }

    if ((mtmp && !(mtmp.mpeaceful || mtmp.mtame))
        || glyph_is_invisible(glyph_at(x, y))) {
        sprintf(buf, _("Attack %s"), mtmp ? mon_nam(mtmp) : _("unseen creature"));
        mcmd_addmenu(win, MCMD_ATTACK_NEXT2U, buf), ++K;
        /* attacking overrides any other automatic action */
        act[0] = MCMD_ATTACK_NEXT2U;
    } else {
        /* "Move %s", direction - handled below */
    }
    return K;
    } finally { stack_pop($frame); }
}

function there_cmd_menu_far(win, x, y, mod) { /* int */
    let K = 0;

    if (mod == CLICK_1) {
        if (linedup(u.ux, u.uy, x, y, 1)
            && dist2(u.ux, u.uy, x, y) < 18*18)
            mcmd_addmenu(win, MCMD_THROW_OBJ, _("Throw something")), ++K;

        mcmd_addmenu(win, MCMD_TRAVEL, _("Travel here")), ++K;
    }
    return K;
}

function there_cmd_menu_common(
    win,
    x, y,
    mod,
    act) { /* int */
    let K = 0;

    if (mod == CLICK_1 || mod == CLICK_2) { /* ignore iflags.clicklook here */
        /* for self, only include "look at map symbol" if it isn't the
           ordinary hero symbol (steed, invisible w/o see invisible, ?) */
        if (!u_at(x, y) || Upolyd() || glyph_at(x, y) != hero_glyph())
            mcmd_addmenu(win, MCMD_LOOK_AT, _("Look at map symbol")), ++K;
    }
    return K;
}

/* queue up command(s) to perform #therecmdmenu action */
function act_on_act(
    act,
    dx, dy) { /* void */ /* delta to adjacent spot (farther sometimes) */
    let otmp;
    let dir;

    /* a few there_cmd_menu_far() actions use dx,dy differently */
    switch (act) {
    case MCMD_THROW_OBJ:
    case MCMD_TRAVEL:
    case MCMD_LOOK_AT:
        /* keep dx,dy as-is */
        break;
    default:
        /* force dx and dy to be +1, 0, or -1 */
        dx = sgn(dx);
        dy = sgn(dy);
        break;
    }

    switch (act) {
    case MCMD_TRAVEL:
        /* FIXME: player has explicitly picked "travel to this location"
           from the menu but it will only work if flags.travelcmd is True.
           That option is intended as way to guard against stray mouse
           clicks and shouldn't inhibit explicit travel. */
        iflags.travelcc.x = u.tx = u.ux + dx;
        iflags.travelcc.y = u.ty = u.uy + dy;
        cmdq_add_ec(CQ_CANNED, dotravel_target);
        break;
    case MCMD_THROW_OBJ:
        cmdq_add_ec(CQ_CANNED, dothrow);
        cmdq_add_userinput(CQ_CANNED);
        cmdq_add_dir(CQ_CANNED, dx, dy, 0);
        break;
    case MCMD_OPEN_DOOR:
        cmdq_add_ec(CQ_CANNED, doopen);
        cmdq_add_dir(CQ_CANNED, dx, dy, 0);
        break;
    case MCMD_LOCK_DOOR:
        otmp = carrying(SKELETON_KEY);
        if (!otmp)
            otmp = carrying(LOCK_PICK);
        if (!otmp)
            otmp = carrying(CREDIT_CARD);
        if (otmp) {
            cmdq_add_ec(CQ_CANNED, doapply);
            cmdq_add_key(CQ_CANNED, otmp.invlet);
            cmdq_add_dir(CQ_CANNED, dx, dy, 0);
            cmdq_add_key(CQ_CANNED, ord('y')); /* "Lock it?" */
        }
        break;
    case MCMD_UNTRAP_DOOR:
        cmdq_add_ec(CQ_CANNED, dountrap);
        cmdq_add_dir(CQ_CANNED, dx, dy, 0);
        break;
    case MCMD_KICK_DOOR:
        cmdq_add_ec(CQ_CANNED, dokick);
        cmdq_add_dir(CQ_CANNED, dx, dy, 0);
        break;
    case MCMD_CLOSE_DOOR:
        cmdq_add_ec(CQ_CANNED, doclose);
        cmdq_add_dir(CQ_CANNED, dx, dy, 0);
        break;
    case MCMD_SEARCH:
        cmdq_add_ec(CQ_CANNED, dosearch);
        break;
    case MCMD_LOOK_TRAP:
        cmdq_add_ec(CQ_CANNED, doidtrap);
        cmdq_add_dir(CQ_CANNED, dx, dy, 0);
        break;
    case MCMD_UNTRAP_TRAP:
        cmdq_add_ec(CQ_CANNED, dountrap);
        cmdq_add_dir(CQ_CANNED, dx, dy, 0);
        break;
    case MCMD_MOVE_DIR:
        dir = xytodir(dx, dy);
        cmdq_add_ec(CQ_CANNED, move_funcs[dir][MV_WALK]);
        break;
    case MCMD_RIDE:
        cmdq_add_ec(CQ_CANNED, doride);
        cmdq_add_dir(CQ_CANNED, dx, dy, 0);
        break;
    case MCMD_REMOVE_SADDLE:
        /* m-prefix for #loot: skip any floor containers */
        cmdq_add_ec(CQ_CANNED, do_reqmenu);
        cmdq_add_ec(CQ_CANNED, doloot);
        cmdq_add_dir(CQ_CANNED, dx, dy, 0);
        cmdq_add_key(CQ_CANNED, ord('y')); /* "Do you want to remove saddle? */
        break;
    case MCMD_APPLY_SADDLE:
        if ((otmp = carrying(SADDLE)) != null) {
            cmdq_add_ec(CQ_CANNED, doapply);
            cmdq_add_key(CQ_CANNED, otmp.invlet);
            cmdq_add_dir(CQ_CANNED, dx, dy, 0);
        }
        break;
    case MCMD_ATTACK_NEXT2U:
        dir = xytodir(dx, dy);
        cmdq_add_ec(CQ_CANNED, move_funcs[dir][MV_WALK]);
        break;
    case MCMD_TALK:
        cmdq_add_ec(CQ_CANNED, dotalk);
        cmdq_add_dir(CQ_CANNED, dx, dy, 0);
        break;
    case MCMD_NAME:
        cmdq_add_ec(CQ_CANNED, docallcmd);
        cmdq_add_key(CQ_CANNED, ord('m')); /* name a monster */
        cmdq_add_dir(CQ_CANNED, dx, dy, 0); /* getpos() uses u.ux+dx,u.uy+dy */
        break;
    case MCMD_QUAFF:
        cmdq_add_ec(CQ_CANNED, dodrink);
        cmdq_add_key(CQ_CANNED, ord('y')); /* "Drink from the fountain?" */
        break;
    case MCMD_DIP:
        cmdq_add_ec(CQ_CANNED, dodip);
        cmdq_add_userinput(CQ_CANNED);
        cmdq_add_key(CQ_CANNED, ord('y')); /* "Dip foo into the fountain?" */
        break;
    case MCMD_SIT:
        cmdq_add_ec(CQ_CANNED, dosit);
        break;
    case MCMD_UP:
        cmdq_add_ec(CQ_CANNED, doup);
        break;
    case MCMD_DOWN:
        cmdq_add_ec(CQ_CANNED, dodown);
        break;
    case MCMD_DISMOUNT:
        cmdq_add_ec(CQ_CANNED, doride);
        break;
    case MCMD_MONABILITY:
        cmdq_add_ec(CQ_CANNED, domonability);
        break;
    case MCMD_PICKUP:
        cmdq_add_ec(CQ_CANNED, dopickup);
        break;
    case MCMD_LOOT:
        cmdq_add_ec(CQ_CANNED, doloot);
        break;
    case MCMD_TIP:
        cmdq_add_ec(CQ_CANNED, dotip);
        cmdq_add_key(CQ_CANNED, ord('y')); /* "There is foo here; tip it?" */
        break;
    case MCMD_EAT:
        cmdq_add_ec(CQ_CANNED, doeat);
        cmdq_add_key(CQ_CANNED, ord('y')); /* "There is foo here; eat it?" */
        break;
    case MCMD_DROP:
        cmdq_add_ec(CQ_CANNED, dodrop);
        break;
    case MCMD_INVENTORY:
        cmdq_add_ec(CQ_CANNED, ddoinv);
        break;
    case MCMD_REST:
        cmdq_add_ec(CQ_CANNED, donull);
        break;
    case MCMD_LOOK_HERE:
        cmdq_add_ec(CQ_CANNED, dolook);
        break;
    case MCMD_LOOK_AT:
        gc.clicklook_cc.x = u.ux + dx;
        gc.clicklook_cc.y = u.uy + dy;
        cmdq_add_ec(CQ_CANNED, doclicklook);
        break;
    case MCMD_UNTRAP_HERE:
        cmdq_add_ec(CQ_CANNED, dountrap);
        cmdq_add_dir(CQ_CANNED, 0, 0, 1);
        break;
    case MCMD_OFFER:
        cmdq_add_ec(CQ_CANNED, dosacrifice);
        cmdq_add_userinput(CQ_CANNED);
        break;
    case MCMD_CAST_SPELL:
        cmdq_add_ec(CQ_CANNED, docast);
        break;
    default:
        break;
    }
}

/* offer choice of actions to perform at adjacent location <x,y>;
   a few choices can be farther away */
function there_cmd_menu(x, y, mod) { /* char */
    const $frame = stack_frame(); try {
    let win;
    let ch = ord('\0');
    let npick = 0, K = 0;
    let picks = stack_var(ptr_to(struct_mi), null);
    /*int dx = sgn(x - u.ux), dy = sgn(y - u.uy);*/
    let dx = x - u.ux, dy = y - u.uy;
    let act = stack_var(int, MCMD_NOTHING);

    win = create_nhwindow()(NHW_MENU);
    start_menu()(win, MENU_BEHAVE_STANDARD);

    if (u_at(x, y))
        K += there_cmd_menu_self(win, x, y, act);
    else if (next2u(x, y))
        K += there_cmd_menu_next2u(win, x, y, mod, act);
    else
        K += there_cmd_menu_far(win, x, y, mod);
    K += there_cmd_menu_common(win, x, y, mod, act);

    if (!K) {
        /* no menu options, try to move */
        if (next2u(x, y) && test_move(u.ux, u.uy, dx, dy, TEST_MOVE)) {
            let dir = xytodir(dx, dy);

            cmdq_add_ec(CQ_CANNED, move_funcs[dir][MV_WALK]);
        } else if (flags.travelcmd) {
            iflags.travelcc.x = u.tx = x;
            iflags.travelcc.y = u.ty = y;
            cmdq_add_ec(CQ_CANNED, dotravel_target);
        }
        npick = 0;
        ch = ord('\0');
    } else if (K == 1 && act[0] != MCMD_NOTHING && act[0] != MCMD_TRAVEL) {
        destroy_nhwindow()(win);

        act_on_act(act[0], dx, dy);
        return ord('\0');
    } else {
        end_menu()(win, _("What do you want to do?"));
        npick = select_menu(win, PICK_ONE, picks);
        ch = ord('\x1b');
    }
    destroy_nhwindow()(win);
    if (npick > 0) {
        act[0] = picks[0].item.a_int;
        free(addr_of(picks[0]));

        act_on_act(act[0], dx, dy);
        return ord('\0');
    }
    return ch;
    } finally { stack_pop($frame); }
}

function here_cmd_menu() { /* char */
    there_cmd_menu(u.ux, u.uy, CLICK_1);
    return ord('\0');
}

export function click_to_cmd(x, y, mod) { /* void */
    gc.clicklook_cc.x = x;
    gc.clicklook_cc.y = y;

    if (gc.Cmd.mousebtn[mod-1])
        cmdq_add_ec(CQ_CANNED, gc.Cmd.mousebtn[mod-1].ef_funct);
}

function domouseaction() { /* int */
    let x, y;
    let o;
    let dir;

    x = gc.clicklook_cc.x - u.ux;
    y = gc.clicklook_cc.y - u.uy;

    if (flags.travelcmd) {
        if (abs(x) <= 1 && abs(y) <= 1) {
            x = sgn(x), y = sgn(y);
        } else {
            iflags.travelcc.x = u.tx = u.ux + x;
            iflags.travelcc.y = u.ty = u.uy + y;
            cmdq_add_ec(CQ_CANNED, dotravel_target);
            return ECMD_OK;
        }

        if (x == 0 && y == 0) {
            /* here */
            if (IS_FOUNTAIN(levl()[u.ux][u.uy].typ)
                || IS_SINK(levl()[u.ux][u.uy].typ)) {
                cmdq_add_ec(CQ_CANNED, dodrink);
                return ECMD_OK;
            } else if (IS_THRONE(levl()[u.ux][u.uy].typ)) {
                cmdq_add_ec(CQ_CANNED, dosit);
                return ECMD_OK;
            } else if (On_stairs_up(u.ux, u.uy)) {
                cmdq_add_ec(CQ_CANNED, doup);
                return ECMD_OK;
            } else if (On_stairs_dn(u.ux, u.uy)) {
                cmdq_add_ec(CQ_CANNED, dodown);
                return ECMD_OK;
            } else if ((o = vobj_at(u.ux, u.uy)) != null) {
                cmdq_add_ec(CQ_CANNED, Is_container(o) ? doloot : dopickup);
                return ECMD_OK;
            } else {
                cmdq_add_ec(CQ_CANNED, donull); /* just rest */
                return ECMD_OK;
            }
        }

        /* directional commands */

        dir = xytodir(x, y);
        if (!m_at(u.ux + x, u.uy + y)
            && !test_move(u.ux, u.uy, x, y, TEST_MOVE)) {
            if (IS_DOOR(levl()[u.ux + x][u.uy + y].typ)) {
                /* slight assistance to player: choose kick/open for them */
                if (levl()[u.ux + x][u.uy + y].flags & D_LOCKED) {
                    cmdq_add_ec(CQ_CANNED, dokick);
                    return ECMD_OK;
                }
                if (levl()[u.ux + x][u.uy + y].flags & D_CLOSED) {
                    cmdq_add_ec(CQ_CANNED, doopen);
                    return ECMD_OK;
                }
            }
            if (levl()[u.ux + x][u.uy + y].typ <= SCORR) {
                cmdq_add_ec(CQ_CANNED, dosearch);
                return ECMD_OK;
            }
            cmdq_add_ec(CQ_CANNED, move_funcs[dir][MV_WALK]);
            return ECMD_OK;
        }
    } else {
        /* convert without using floating point, allowing sloppy clicking */
        if (x > 2 * abs(y))
            x = 1, y = 0;
        else if (y > 2 * abs(x))
            x = 0, y = 1;
        else if (x < -2 * abs(y))
            x = -1, y = 0;
        else if (y < -2 * abs(x))
            x = 0, y = -1;
        else
            x = sgn(x), y = sgn(y);

        if (x == 0 && y == 0) {
            /* map click on player to "rest" command */
            cmdq_add_ec(CQ_CANNED, donull);
            return ECMD_OK;
        }
        dir = xytodir(x, y);
    }

    /* move, attack, etc. */
    cmdq_add_ec(CQ_CANNED, move_funcs[dir][MV_WALK]);
    return ECMD_OK;
}

/* gather typed digits into a number in *count; return the next non-digit */
export function get_count(
    allowchars,
    inkey,
    maxcount,
    count,
    gc_flags) { /* char */ /* control flags: GC_SAVEHIST, GC_ECHOFIRST */
    const $frame = stack_frame(); try {
    let qbuf = stack_array(char, QBUFSZ);
    let key, save_input_state = program_state.input_state;
    let cnt = 0, first = inkey ? (inkey - ord('0')) : 0;
    let backspaced = FALSE, showzero = TRUE,

            historicmsg = +((gc_flags & GC_SAVEHIST) != 0),

            conditionalmsg = +((gc_flags & GC_CONDHIST) != 0),

            echoalways = +((gc_flags & GC_ECHOFIRST) != 0);
    /* this should be done in port code so that we have erase_char
       and kill_char available; we can at least fake erase_char */

    count[0] = 0;
    for (;;) {
        if (inkey) {
            key = inkey;
            inkey = ord('\0');
        } else {
            /* if readchar() has already been called in this loop, it will
               have reset input_state; put that back to its previous value */
            program_state.input_state = save_input_state;
            key = readchar();
        }

        if (digit(key)) {
            let dgt = (key - ord('0'));

            /* cnt = (10 * cnt) + (key - '0'); */
            cnt = AppendLongDigit(cnt, dgt);
            if (cnt < 0)
                cnt = 0;
            else if (maxcount > 0 && cnt > maxcount)
                cnt = maxcount;
            /* if we've backed up to nothing, then typed 0, show that 0 */
            showzero = +(key == ord('0'));
        } else if (key == ord('\b') || key == STANDBY_erase_char) {
            if (!cnt && !echoalways)
                break;
            showzero = FALSE;
            cnt = Math.trunc(cnt / 10);
            backspaced = TRUE;
        } else if (key == chars[gc.Cmd.spkeys + NHKF_ESC]) {
            break;
        } else if (!allowchars || strchr(allowchars, key)) {
            count[0] = cnt;
            if ((count[0]) != cnt)
                impossible(_("get_count: cmdcount_nht"));
            break;
        }

        if (cnt > 9 || backspaced || echoalways) {
            clear_nhwindow()(WIN_MESSAGE);
            if (backspaced && !cnt && !showzero) {
                sprintf(qbuf, _("Count: "));
            } else {
                sprintf(qbuf, _("Count: %lld"), cnt);
                backspaced = FALSE;
            }
            custompline(SUPPRESS_HISTORY, _("%s"), qbuf);
            mark_synch()();
        }
    }

    if (historicmsg || (conditionalmsg && count[0] != first)) {
        sprintf(qbuf, _("Count: %lld "), count[0]);
        key2txt(uchar(key), eos(qbuf));
        putmsghistory()(qbuf, FALSE);
    }

    return key;
    } finally { stack_pop($frame); }
}
export const STANDBY_erase_char = ord('\x7f');

/* main command input routine when not repeating and not executing canned
   commands; input comes via get_count() which collects repeat count if one
   is present and returns next non-digit to us */
function parse() { /* int */
    let foo;
    let bind;

    iflags.in_parse = TRUE;
    gc.command_count = 0;
    svc.context.move = TRUE; /* assume next command will take game time */
    flush_screen(1); /* Flush screen buffer. Put the cursor on the hero. */

    /* affects readchar() behavior for ESC iff 'altmeta' option is On;
       is always reset to otherInp by readchar() */
    program_state.input_state = commandInp;

    if (!gc.Cmd.num_pad || (foo = readchar()) == chars[gc.Cmd.spkeys + NHKF_COUNT]) {
        /* if 'num_pad' is On then readchar() has just reset input_state;
           set it back to commandInp, so that get_count() supports 'altmeta';
           otherwise "n<count>ESC<character>" becomes "n<count>ESC" (with
           <character> not read from keyboard yet) rather than intended count
           and meta keystroke "n<count>M-<character>" */
        program_state.input_state = commandInp;

        foo = get_count(0, ord('\0'), LARGEST_INT,
                        ref_of(gc, "command_count"), GC_NOFLAGS);
    }
    gl.last_command_count = gc.command_count;

    if (foo == chars[gc.Cmd.spkeys + NHKF_ESC]) { /* esc cancels count (TH) */
        clear_nhwindow()(WIN_MESSAGE);
        gc.command_count = 0;
        gl.last_command_count = 0;
    } else if (gi.in_doagain) {
        gc.command_count = gl.last_command_count;
    } else if (foo && (bind = cmdbind_get(foo & 0xFF)) != null
               /* these shouldn't go into the do-again buffer */
               && bind && bind.cmd
               && (bind.cmd.ef_funct == do_repeat
                   || bind.cmd.ef_funct == doprev_message
                   /* this one might get put into the do-again buffer but
                      only if the interface code tells the core to do it */
                   || bind.cmd.ef_funct == doextcmd)) {
        /* gc.command_count will be set again when we
           re-enter with gi.in_doagain set true */
        gc.command_count = gl.last_command_count;
    }

    gm.multi = gc.command_count;
    if (gm.multi)
        gm.multi--;

    gc.cmd_key = foo;
    clear_nhwindow()(WIN_MESSAGE);

    iflags.in_parse = FALSE;
    return gc.cmd_key;
}

/* some very old systems, or descendents of such systems, expect signal
   handlers to have return type `int', but they don't actually inspect
   the return value so we should be safe using `void' unconditionally */
/*ARGUSED*/
export function hangup(
    sig_unused) { /* void */ /* called as signal() handler, so sent * at least one arg */
    if (program_state.exiting)
        program_state.in_moveloop = 0;
    nhwindows_hangup();

    /* When using SAFERHANGUP, the done_hup flag is tested in rhack
       and a couple of other places; actual hangup handling occurs then.
       This is 'safer' because it disallows certain cheats and also
       protects against losing objects in the process of being thrown,
       but also potentially riskier because the disconnected program
       must continue running longer before attempting a hangup save. */
    program_state.done_hup++;
    /* defer hangup iff game appears to be in progress */
    if (program_state.in_moveloop
        && program_state.something_worth_saving)
        return;

    end_of_input();
}

export function end_of_input() { /* void */
    if (In_tutorial(u.uz))
        program_state.something_worth_saving = 0; /* don't save in tutorial */

        if (program_state.something_worth_saving)
            dosave0();
    if (soundprocs.sound_exit_nhsound)
        soundprocs.sound_exit_nhsound(_("end_of_input"));
    if (iflags.window_inited)
        exit_nhwindows()(0);
    clearlocks();
    nh_terminate(EXIT_SUCCESS);
    /*NOTREACHED*/ /* not necessarily true for vms... */
    return;
}

function readchar_core(x, y, mod) { /* char */
    var sym;

    readchar_done: { if (iflags.debug_fuzzer) {
        sym = randomkey();
        break readchar_done;
    }
    if (chars[readchar_queue[0]])
        sym = chars[readchar_queue[0]++];
    else if (gi.in_doagain)
        sym = pgetchar();
    else
        sym = nh_poskey()(x, y, mod);

    if (sym == EOF) {
        var cnt = NR_OF_EOFS;
        /*
         * Some SYSV systems seem to return EOFs for various reasons
         * (?like when one hits break or for interrupted systemcalls?),
         * and we must see several before we quit.
         */
        do {
            clearerr(stdin); /* omit if clearerr is undefined */
            sym = pgetchar();
        } while (--cnt && sym == EOF);
    }

    if (sym == EOF) {
        hangup(0); /* call end_of_input() or set program_state.done_hup */

        sym = ord('\x1b');
    } else if (sym == ord('\x1b') && iflags.altmeta
               && program_state.input_state != otherInp) {
        /* iflags.altmeta: treat two character ``ESC c'' as single `M-c' but
           only when we're called by parse() [possibly via get_count()]
           or getpos() [to support Alt+digit] or getdir() [for arrow keys
           under curses] */
        sym = chars[readchar_queue[0]] ? chars[readchar_queue[0]++] : pgetchar();
        if (sym == EOF || sym == 0)
            sym = ord('\x1b');
        else if (sym != ord('\x1b'))
            sym |= 0o200; /* force 8th bit on */
    } else if (sym == 0) {
        /* click event */
        gc.clicklook_cc.x = gc.clicklook_cc.y = -1;
        click_to_cmd(x[0], y[0], mod[0]);
    }
 }
    /* next readchar() will be for an ordinary char unless parse()
       sets this back to non-zero */
    program_state.input_state = otherInp;
    return char(sym);
}

/* get a character */
export function readchar() { /* char */
    const $frame = stack_frame(); try {
    let ch;
    let x = stack_var(coordxy, u.ux), y = stack_var(coordxy, u.uy);
    let mod = stack_var(int, 0);

    ch = readchar_core(x, y, mod);
    return ch;
    } finally { stack_pop($frame); }
}

/* used by getpos() to accept mouse input as well as keyboard input */
export function readchar_poskey(x, y, mod) { /* char */
    let ch;

    program_state.input_state = getposInp;
    ch = readchar_core(x, y, mod);
    return ch;
}

/* '_' command, #travel, via keyboard rather than mouse click */
function dotravel() { /* int */
    const $frame = stack_frame(); try {
    let cc = stack_struct(struct_nhcoord);

    /*
     * Traveling used to be a no-op if user toggled 'travel' option
     * Off.  However, travel was initially implemented as a mouse-only
     * command and the original purpose of the option was to be able
     * to prevent clicks on the map from initiating travel.
     *
     * Travel via '_' came later.  Since it requires a destination--
     * which offers the user a chance to cancel if it was accidental--
     * there's no reason for the option to disable travel-by-keys.
     */

    cc.x = iflags.travelcc.x;
    cc.y = iflags.travelcc.y;
    if (cc.x == 0 && cc.y == 0) {
        /* No cached destination, start attempt from current position */
        cc.x = u.ux;
        cc.y = u.uy;
    }
    iflags.getloc_travelmode = TRUE;
    if (iflags.menu_requested) {
        let gfilt = iflags.getloc_filter;

        iflags.getloc_filter = GFILTER_VIEW;
        if (!getpos_menu(cc, GLOC_INTERESTING)) {
            iflags.getloc_filter = gfilt;
            iflags.getloc_travelmode = FALSE;
            return ECMD_OK;
        }
        iflags.getloc_filter = gfilt;
    } else {
        pline(_("Where do you want to travel to?"));
        if (getpos(cc, TRUE, _("the desired destination")) < 0) {
            /* user pressed ESC */
            iflags.getloc_travelmode = FALSE;
            return ECMD_CANCEL;
        }
    }
    iflags.travelcc.x = u.tx = cc.x;
    iflags.travelcc.y = u.ty = cc.y;

    return dotravel_target();
    } finally { stack_pop($frame); }
}

/* #retravel, travel to iflags.travelcc, which must be set */
function dotravel_target() { /* int */
    if (!isok(iflags.travelcc.x, iflags.travelcc.y)) {
        /* assume <0,0>, the value assigned when travel reaches destination */
        pline(_("No travel destination set."));
        return ECMD_OK;
    } else if (u_at(iflags.travelcc.x, iflags.travelcc.y)) {
        /* maybe interrupted while traveling then just walked rest of way
           so destination hasn't been reset yet */
        You(_("are already here."));
        iflags.travelcc.x = iflags.travelcc.y = 0;
        return ECMD_OK;
    }

    iflags.getloc_travelmode = FALSE;

    svc.context.travel = 1;
    svc.context.travel1 = 1;
    svc.context.run = 8;
    svc.context.nopick = 1;
    gd.domove_attempting = or64(gd.domove_attempting, DOMOVE_RUSH);

    if (!gm.multi)
        gm.multi = max(COLNO, ROWNO);
    u.last_str_turn = 0;
    svc.context.mv = TRUE;

    domove();
    return ECMD_TIME;
}

/* mouse click look command */
function doclicklook() { /* int */
    if (!isok(gc.clicklook_cc.x, gc.clicklook_cc.y))
        return ECMD_OK;

    svc.context.move = FALSE;
    auto_describe(gc.clicklook_cc.x, gc.clicklook_cc.y);

    return ECMD_OK;
}

/* can we use menu entries to respond to a query? */
function yn_menuable_resp(resp) { /* boolean */
    return (iflags.query_menu && iflags.window_inited
        && (resp == ynchars || resp == ynqchars || resp == ynaqchars
            || resp == rightleftchars || resp == hidespinchars) ? 1 : 0);
}

function yn_func_menu_opt(win, key, text, def) { /* void */
    const $frame = stack_frame(); try {
    let any = stack_struct(struct_any);

    struct_assign(any, cg.zeroany);
    any.a_char = key;
    add_menu(win, nul_glyphinfo, any, key, 0,
             ATR_NONE, NO_COLOR, text,
             (def == key) ? MENU_ITEMFLAGS_SELECTED
                          : MENU_ITEMFLAGS_NONE);
    } finally { stack_pop($frame); }
}

/* use a menu to ask a specific response to a query.
   returns TRUE if the menu was shown to the user.
   puts the response char into res. */
function yn_function_menu(
    query,
    resp,
    def,
    res) { /* boolean */
    const $frame = stack_frame(); try {
    if (yn_menuable_resp(resp)) {
        let win = create_nhwindow()(NHW_MENU);
        let sel = stack_var(ptr_to(struct_mi));
        let n;
        let keybuf = stack_array(char, QBUFSZ);

        start_menu()(win, MENU_BEHAVE_STANDARD);
        if (resp == rightleftchars) {
            yn_func_menu_opt(win, ord('r'), _("Right"), def);
            yn_func_menu_opt(win, ord('l'), _("Left"), def);
        } else if (resp == hidespinchars) {
            yn_func_menu_opt(win, ord('h'), _("Hide"), def);
            yn_func_menu_opt(win, ord('s'), _("Spin a web"), def);
        } else {
            yn_func_menu_opt(win, ord('y'), _("Yes"), def);
            yn_func_menu_opt(win, ord('n'), _("No"), def);
        }
        if (resp == ynaqchars)
            yn_func_menu_opt(win, ord('a'), _("All"), def);
        if (resp == ynqchars || resp == ynaqchars || resp == hidespinchars)
            yn_func_menu_opt(win, ord('q'), _("Quit"), def);
        end_menu()(win, query);
        n = select_menu(win, PICK_ONE, sel);
        destroy_nhwindow()(win);
        if (n > 0) {
            chars[res] = ptr_add(sel[0], 0).item.a_char;
            /* two were selected? use the one that wasn't the default */
            if (n > 1 && chars[res] == def)
                chars[res] = ptr_add(sel[0], 1).item.a_char;
            free(addr_of(sel[0]));
        } else {
            chars[res] = def;
        }
        pline(_("%s %s"), query, key2txt(uchar(chars[res]), keybuf));
        clear_nhwindow()(WIN_MESSAGE);
        return TRUE;
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

/*
 *   Parameter validator for generic yes/no function to prevent
 *   the core from sending too long a prompt string to the
 *   window port causing a buffer overflow there.
 */
export function yn_function(
    query,
    resp,
    def,
    addcmdq) { /* char */
    const $frame = stack_frame(); try {
    let res = stack_var(char, ord('\x1b')), qbuf = stack_array(char, QBUFSZ);
    let cq = stack_struct(struct__cmd_queue), cmdq;

    iflags.last_msg = PLNMSG_UNKNOWN; /* most recent pline is clobbered */

    /* maximum acceptable length is QBUFSZ-1 */
    if (strlen(query) >= QBUFSZ) {
        /* caller shouldn't have passed anything this long */
        paniclog(_("Query truncated: "), query);
        strncpy(qbuf, query, QBUFSZ - 1 - 3);
        strcpy(qbuf + (QBUFSZ - 1 - 3), _("..."));
        query = qbuf;
    }

    if (addcmdq && (cmdq = cmdq_pop()) != null) {
        struct_assign(cq, cmdq);
        free(addr_of(cmdq));
    } else {
        cq.typ = CMDQ_USER_INPUT;
        cq.key = ord('\0'); /* lint suppression */
    }

    if (cq.typ != CMDQ_USER_INPUT) {
        if (cq.typ == CMDQ_KEY)
            res[0] = cq.key;
        else
            cmdq_clear(CQ_CANNED); /* 'res' is ESC */
        addcmdq = FALSE;

    /* for the fuzzer, usually force a valid response, but sometimes let
       it exercise windowport yn_function and invalid response handling */
    } else if (iflags.debug_fuzzer && resp && chars[resp] && rn2(20)) {
        let ln = int(strlen(resp)), ridx = rn2(ln);

        res[0] = chars[resp + ridx];
        /* if valid-responses includes ESC followed by unshown candidates
           and we randomly picked the ESC, try again with only whatever is
           before it; be careful to avoid rn2(0) */
        if (res[0] == ord('\x1b')) {
            if (ln > 1) {
                /* if ESC is at start (ridx==0), pick something after it */
                ridx = (ridx == 0) ? (1 + rn2(ln - 1)) : rn2(ridx);
                res[0] = chars[resp + ridx];
            } else {
                /* ESC is the only thing (ln==1); something is strange... */
                res[0] = def; /* might be '\0' */
            }
        }
    } else {
        if (!yn_function_menu(query, resp, def, addr_of(res))) {
            res[0] = windowprocs.win_yn_function(query, resp, def);
        }
    }
    if (addcmdq)
        cmdq_add_key(CQ_REPEAT, res[0]);

    /* #ifdef DUMPLOG_CORE: not in this build */

    /* should not happen but cq.key has been observed to not obey 'resp';
       it is most likely caused by saving a keystroke that was just used
       to answer a context-sensitive prompt, then using the do-again
       command with context that has changed */
    if (resp && chars[resp] && res[0] && !strchr(resp, res[0])) {
        /* this probably needs refinement since caller is expecting something
           within 'resp' and ESC won't be (it could be present, but as a flag
           for unshown possibilities rather than as acceptable input) */
        let altres = def ? def : ord('\x1b');

        if (!gi.in_doagain || wizard()) {
/*TEMP*/    let fuzzing = iflags.debug_fuzzer;
            let dbg_buf = stack_array(char, BUFSZ);

            Snprintf(dbg_buf, sizeof(array_of(char, BUFSZ)), _("%s [%s] (%s)"), query, resp ? resp : _(""), def ? visctrl(def) : _(""))
;
            paniclog(_("yn debug"), dbg_buf);
/*TEMP*/    /* don't let this known problem kill the fuzzer */
/*TEMP*/    iflags.debug_fuzzer = fuzzer_impossible_continue;
            impossible(_("yn_function() returned '%s'; using '%s' instead"),
                       visctrl(res[0]), visctrl(altres));
/*TEMP*/    iflags.debug_fuzzer = fuzzing;
        }
        res[0] = altres;
    }
    /* in case we're called via getdir() which sets input_state */
    program_state.input_state = otherInp;
    return res[0];
    } finally { stack_pop($frame); }
}

/* for paranoid_confirm:quit,die,attack,&c prompting; allows yes, n|no,
   or q|quit; result is one of 'y' or 'n' or 'q'; ESC yields 'q' */
export function paranoid_ynq(
    be_paranoid,
    prompt,
    accept_q) { /* char */
    const $frame = stack_frame(); try {
    let c = ord('n'); /* default result */

    /* when paranoid, player must respond with "yes" rather than just 'y'
       to give the go-ahead for this query; default is "no" unless the
       ParanoidConfirm flag is set in which case there's no default */
    if (be_paranoid) {
        let pbuf = stack_array(char, BUFSZ), qbuf = stack_array(char, QBUFSZ), ans = stack_array(char, BUFSZ);
        let promptprefix = _(""),
            responsetype = ParanoidConfirm() ? (accept_q ? _("[yes|no|quit]")
                                               : _("[yes|no]"))
                                            /* default of 'n' is shown for
                                             * the !ParanoidConfirm cases */
                                            : (accept_q ? _("[yes|n|q] (n)")
                                               : _("[yes|n] (n)"));
        let k, trylimit = 6; /* 1 normal, 5 more with "Yes or No:" prefix */

        copynchars(pbuf, prompt, BUFSZ - 1);
        /* in addition to being paranoid about this particular
           query, we might be even more paranoid about all paranoia
           responses (ie, ParanoidConfirm is set) in which case we
           require "no" to reject in addition to "yes" to confirm
           (except we won't loop if response is ESC; it means no) */
        do {
            /* make sure we won't overflow a QBUFSZ sized buffer */
            k = int(unsigned(unsigned(strlen(promptprefix) + 1) + strlen(responsetype)));
            if (int(strlen(pbuf)) + k > QBUFSZ - 1) {
                /* chop off some at the end */
                strcpy(pbuf + (QBUFSZ - 1) - k - 4, _("...?")); /* -4: "...?" */
            }

            Snprintf(qbuf, sizeof(array_of(char, QBUFSZ)), _("%s%s %s"), promptprefix, pbuf, responsetype)
;
            chars[ans] = ord('\0');
            getlin(qbuf, ans);
            mungspaces(ans);
            if (!strncmpi((ans), _(("yes")), -1)) {
                c = ord('y');
                break;
            }
            if (!strncmpi((ans), _(("quit")), -1) || chars[ans] == ord('\x1b')) {
                c = ord('q');
                break;
            }
            /* we don't bother adding "or \"Quit\"" for the accept_q case */
            promptprefix = _("\"Yes\" or \"No\": ");
            /* for empty input, return value c will already be 'n' */
        } while (ParanoidConfirm() && strncmpi((ans), _(("no")), -1) && --trylimit);
    } else if (accept_q) {
        /* 'y', 'n', or 'q' */
        c = yn_function(prompt, ynqchars, ord('n'), FALSE);
    } else {
        /* 'y' or 'n' */
        c = yn_function(prompt, ynchars, ord('n'), FALSE);
    }
    if (c != ord('y') && (c != ord('q') || !accept_q))
        c = ord('n');
    return c;
    } finally { stack_pop($frame); }
}

/* for paranoid_confirm:quit,die,attack,&c prompting; allows yes or n|no;
   result is True for yes; n|no and ESC yield False */
export function paranoid_query(be_paranoid, prompt) { /* boolean */
    return +(paranoid_ynq(be_paranoid, prompt, FALSE) == ord('y'));
}

/* ^Z command, #suspend */
function dosuspend_core() { /* int */
    /* Does current window system support suspend? */
    if (windowprocs.win_can_suspend()) {
        let now = getnow();

        urealtime.realtime += timet_delta(now, urealtime.start_timing);
        urealtime.start_timing = now; /* as a safeguard against panic save */
        /* NB: SYSCF SHELLERS handled in port code. */
        dosuspend();
        urealtime.start_timing = getnow(); /* resume keeping track of time */
    } else

        Norep(cmdnotavail, _("#suspend"));
    return ECMD_OK;
}

/* '!' command, #shell */
function dosh_core() { /* int */
    let now = getnow();

    urealtime.realtime += timet_delta(now, urealtime.start_timing);
    urealtime.start_timing = now; /* (see dosuspend_core) */
    /* access restrictions, if any, are handled in port code */
    dosh();
    urealtime.start_timing = getnow();

    return ECMD_OK;
}

function dummyfunction() { /* int */
    return ECMD_CANCEL;
}

/*cmd.c*/

import { NO_COLOR } from "./color.h.js";
import { struct_dig_info } from "./context.h.js";
import { struct_nhcoord } from "./coord.h.js";
import { DOMOVE_RUSH, DOMOVE_WALK } from "./decl.h.js";
import { Never_mind } from "./decl.h.macros.js";
import {
    AMULET_SYM, ARMOR_SYM, FOOD_CLASS, GOLD_SYM, RING_SYM, SPBOOK_SYM, S_NYMPH, S_corr, S_fountain,
    S_litcorr, S_sink, TOOL_SYM, WEAPON_SYM,
} from "./defsym.h.js";
import { GLYPH_UNEXPLORED, docrtRefresh } from "./display.h.js";
import {
    canspotmon, glyph_is_cmap, glyph_is_invisible, hero_glyph, objnum_to_glyph, vobj_at,
} from "./display.h.macros.js";
import { struct_dest_area } from "./dungeon.h.js";
import { In_tutorial, Is_mineend_level, Is_sokoend_level } from "./dungeon.h.macros.js";
import {
    GFILTER_VIEW, GLOC_INTERESTING, PLNMSG_UNKNOWN, TER_FULL, TER_MAP, TER_OBJ, TER_TRP,
    fuzzer_impossible_continue,
} from "./flag.h.js";
import { ParanoidConfirm, ParanoidQuit, discover, wizard } from "./flag.h.macros.js";
import {
    AUTOCOMPLETE, AUTOCOMP_ADJ, CMD_INSANE, CMD_MOVE_PREFIXES, CMD_M_PREFIX, CMD_NOT_AVAILABLE,
    CMD_PARAM, CMD_gGF_PREFIX, ECM_EXACTMATCH, ECM_IGNOREAC, ECM_NO1CHARCMD, GENERALCMD, IFBURIED,
    INTERNALCMD, MOUSECMD, MOVEMENTCMD, NOFUZZERCMD, PREFIXCMD, WIZMODECMD, struct_Cmd_bind,
    struct_ext_func_tab,
} from "./func_tab.h.js";
import {
    BUFSZ, COLNO, FALSE, LARGEST_INT, NHLpa_panic, QBUFSZ, ROWNO, TRUE, boolean, coordxy,
} from "./global.h.js";
import { C, M, Strlen, strcmpi, unmeta } from "./global.h.macros.js";
import {
    ARTICLE_THE, CMDQ_DIR, CMDQ_EXTCMD, CMDQ_INT, CMDQ_KEY, CMDQ_USER_INPUT, CQ_CANNED, CQ_REPEAT,
    DIR_DOWN, DIR_E, DIR_ERR, DIR_N, DIR_NE, DIR_NW, DIR_S, DIR_SE, DIR_SW, DIR_UP, DIR_W,
    ECMD_CANCEL, ECMD_FAIL, ECMD_OK, ECMD_TIME, GC_CONDHIST, GC_ECHOFIRST, GC_NOFLAGS, GC_SAVEHIST,
    MV_ANY, MV_RUN, MV_RUSH, MV_WALK, NHCB_CMD_BEFORE, NHKF_COUNT, NHKF_ESC, NHKF_GETDIR_HELP,
    NHKF_GETDIR_MOUSE, NHKF_GETDIR_SELF, NHKF_GETDIR_SELF2, NHKF_GETPOS_AUTODESC,
    NHKF_GETPOS_DOOR_NEXT, NHKF_GETPOS_DOOR_PREV, NHKF_GETPOS_HELP, NHKF_GETPOS_INTERESTING_NEXT,
    NHKF_GETPOS_INTERESTING_PREV, NHKF_GETPOS_LIMITVIEW, NHKF_GETPOS_MENU, NHKF_GETPOS_MON_NEXT,
    NHKF_GETPOS_MON_PREV, NHKF_GETPOS_MOVESKIP, NHKF_GETPOS_OBJ_NEXT, NHKF_GETPOS_OBJ_PREV,
    NHKF_GETPOS_PICK, NHKF_GETPOS_PICK_O, NHKF_GETPOS_PICK_Q, NHKF_GETPOS_PICK_V, NHKF_GETPOS_SELF,
    NHKF_GETPOS_SHOWVALID, NHKF_GETPOS_UNEX_NEXT, NHKF_GETPOS_UNEX_PREV, NHKF_GETPOS_VALID_NEXT,
    NHKF_GETPOS_VALID_PREV, N_DIRS, N_DIRS_Z, N_MOVEMODES, SUPPRESS_HISTORY, SUPPRESS_SADDLE,
    TEST_MOVE, commandInp, getdirInp, getposInp, otherInp, struct__cmd_queue,
} from "./hack.h.js";
import { NODIAG, max, min, pline1, rn1 } from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { AppendLongDigit } from "./integer.h.macros.js";
import { debugpline2 } from "./lint.h.macros.js";
import { has_mgivenname } from "./mextra.h.macros.js";
import { ROOMOFFSET } from "./mkroom.h.js";
import { AT_GAZE, AT_SPIT } from "./monattk.h.js";
import {
    can_breathe, hides_under, is_hider, is_mind_flayer, is_unicorn, is_vampire, is_were, webmaker,
} from "./mondata.h.macros.js";
import { MS_SHRIEK } from "./monflag.h.js";
import { is_vampshifter } from "./monst.h.macros.js";
import { PM_GREMLIN } from "./monsters.h.js";
import { Is_container } from "./obj.h.macros.js";
import { BOULDER, CREDIT_CARD, LOCK_PICK, SADDLE, SKELETON_KEY } from "./objects.h.js";
import { W_SADDLE } from "./prop.h.js";
import { struct_nhrect } from "./rect.h.js";
import {
    CORR, DRAWBRIDGE_UP, D_CLOSED, D_ISOPEN, D_LOCKED, IRONBARS, LAVAWALL, MAX_TYPE, SCORR, SDOOR,
} from "./rm.h.js";
import {
    IS_ALTAR, IS_DOOR, IS_FOUNTAIN, IS_ROOM, IS_SINK, IS_STWALL, IS_THRONE, IS_TREE, IS_WATERWALL,
    OBJ_AT, levl, m_at,
} from "./rm.h.macros.js";
import { VIBRATING_SQUARE } from "./trap.h.js";
import { cansee } from "./vision.h.macros.js";
import {
    clear_nhwindow, create_nhwindow, destroy_nhwindow, display_nhwindow, end_menu, exit_nhwindows,
    get_ext_cmd, mark_synch, nh_doprev_message, nh_poskey, nhbell, nhgetch, putmsghistory, putstr,
    start_menu, wait_synch,
} from "./winprocs.h.macros.js";
import {
    ATR_NONE, CLICK_1, CLICK_2, MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, MENU_ITEMFLAGS_SELECTED,
    NHW_MENU, NHW_TEXT, NUM_MOUSE_BUTTONS, PICK_ANY, PICK_ONE, WIN_ERR, struct_any, struct_mi,
} from "./wintype.h.js";
import { ACH_MINE_PRIZE, ACH_SOKO_PRIZE } from "./you.h.js";
import { Upolyd, next2u, u_at } from "./you.h.macros.js";
import { Punished } from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, schar, sizeof, sizeof_string, uchar, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { or64 } from "../rt/int64.js";
import {
    EOF, EXIT_SUCCESS, abs, clearerr, free, memcpy, memset, sprintf, stdin, strcat, strchr, strcmp,
    strcpy, strlen, strncmp, strncpy, strrchr,
} from "../rt/libc.js";
import {
    init_string, stack_array, stack_struct, stack_var, static_array, static_struct, static_var,
} from "../rt/locals.js";
import { lua_getglobal, lua_pushstring, lua_settop, lua_toboolean } from "../rt/lua.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, elt, fnptr_t, ptr_add, ptr_diff, ptr_to, record_or_opaque, ref_of, struct,
    struct_assign, struct_copy, view_of,
} from "../rt/struct.js";
import { timet_delta } from "./allmain.js";
import { alloc } from "./alloc.js";
import { doapply, dojump, dorub, reset_trapset, use_unicorn_horn } from "./apply.js";
import { doinvoke } from "./artifact.js";
import { ballrelease, placebc, unplacebc } from "./ball.js";
import { getnow } from "./calendar.js";
import { config_error_add, do_write_config_file } from "./cfgfiles.js";
import { is_pool } from "./dbridge.js";
import {
    a11y, cg, dirs_ord, flags, gc, gd, ge, gi, gk, gl, gm, go, gt, gv, gy, hidespinchars, iflags,
    nhcb_counts, nhcb_name, program_state, quitchars, rightleftchars, svc, svd, svl, svu, u,
    urealtime, xdir, ydir, ynaqchars, ynchars, ynqchars, zdir,
} from "./decl.js";
import { dosearch, reveal_terrain } from "./detect.js";
import { wiz_debug_cmd_bury } from "./dig.js";
import {
    cls, docrt, docrt_flags, doredraw, flush_screen, glyph_at, nul_glyphinfo,
} from "./display.js";
import {
    doddrop, dodown, dodrop, donull, doup, dowipe, save_currentstate, u_collide_m,
} from "./do.js";
import { docallcmd, mon_nam, x_monnam } from "./do_name.js";
import {
    doddoremarm, doputon, doremring, dotakeoff, dowear, ia_dotakeoff, remarm_swapwep, reset_remarm,
} from "./do_wear.js";
import { losedogs } from "./dog.js";
import { pet_ranged_attk } from "./dogmove.js";
import { dokick } from "./dokick.js";
import { dofire, dothrow } from "./dothrow.js";
import { defsyms } from "./drawing.js";
import {
    donamelevel, dooverview, ledger_no, on_level, recalc_mapseen, rm_mapseen, u_on_rndspot,
} from "./dungeon.js";
import { doeat } from "./eat.js";
import { done2, nh_terminate } from "./end.js";
import { can_reach_floor, doengrave } from "./engrave.js";
import { clearlocks, close_nhfile, get_freeing_nhfile, paniclog } from "./files.js";
import { dryup } from "./fountain.js";
import { auto_describe, gather_locs_interesting, getpos, getpos_menu } from "./getpos.js";
import { glyph_to_cmap } from "./glyphs.js";
import {
    check_special_room, domove, dopickup, set_uinwater, test_move, u_maybe_impaired,
} from "./hack.js";
import {
    copynchars, digit, dist2, eos, highc, letter, mungspaces, sgn, strncmpi, strstri, strsubst,
    trimspaces, upstart, visctrl,
} from "./hacklib.js";
import {
    do_gamelog, doattributes, doborn, doconduct, dogenocided, dovanquished, remove_achievement,
} from "./insight.js";
import {
    adjust_split, carrying, ddoinv, dolook, doorganize, doperminv, dopramulet, doprarm, doprgold,
    doprinuse, doprring, doprtool, doprwep, dotypeinv,
} from "./invent.js";
import { wiz_light_sources } from "./light.js";
import { doclose, doforce, doopen, maybe_reset_pick, reset_pick } from "./lock.js";
import { dobjsfree } from "./mkobj.js";
import { dmonsfree, kill_genocided_monsters } from "./mon.js";
import { attacktype } from "./mondata.js";
import { linedup } from "./mthrowu.js";
import { nhl_pcall_handle } from "./nhlua.js";
import { doclassdisco, dodiscovered } from "./o_init.js";
import { an, doname } from "./objnam.js";
import {
    doset, doset_simple, dotogglepickup, show_menu_controls, toggle_bool_option,
} from "./options.js";
import {
    do_screen_description, dohelp, dohistory, doidtrap, doquickwhatis, dowhatdoes, dowhatdoes_core,
    dowhatis,
} from "./pager.js";
import { doloot, dotip } from "./pickup.js";
import {
    Norep, There, You, You_cant, custompline, impossible, pline, pline_xy, raw_printf, set_msg_xy,
} from "./pline.js";
import {
    dobreathe, dogaze, dohide, domindblast, dopoly, doremove, dospinweb, dospit, dosummon,
} from "./polyself.js";
import { dip_into, dodip, dodrink, split_mon } from "./potion.js";
import { dopray, dosacrifice, doturn } from "./pray.js";
import { deliver_splev_message } from "./questpgr.js";
import { doread } from "./read.js";
import { rn2, rnd } from "./rnd.js";
import { dosave, dosave0, savelev } from "./save.js";
import {
    selection_floodfill, selection_free, selection_getbounds, selection_getpoint, selection_new,
    selection_size_description, set_selection_floodfillchk,
} from "./selvar.js";
import { dopay } from "./shk.js";
import { dosit } from "./sit.js";
import { dotalk, soundprocs } from "./sounds.js";
import { docast, dovspell, dowizcast, num_spells } from "./spell.js";
import { On_stairs_dn, On_stairs_up, stairway_at } from "./stairs.js";
import { can_saddle, doride } from "./steed.js";
import { pmatchi, strbuf_append } from "./strutil.js";
import { dotelecmd } from "./teleport.js";
import { wiz_timeout_queue } from "./timeout.js";
import { initrack } from "./track.js";
import { dountrap, reset_utrap, t_at } from "./trap.js";
import { doextversion, doversion } from "./version.js";
import { vision_reset } from "./vision.js";
import { enhance_weapon_skill } from "./weapon.js";
import { doswapweapon, dotwoweapon, dowield, dowieldquiver } from "./wield.js";
import {
    add_menu, add_menu_heading, add_menu_str, getlin, nhwindows_hangup, select_menu, windowprocs,
} from "./windows.js";
import { aggravate } from "./wizard.js";
import {
    makemap_remove_mons, wiz_custom, wiz_detect, wiz_display_macros, wiz_flip_level, wiz_fuzzer,
    wiz_genesis, wiz_identify, wiz_intrinsic, wiz_kill, wiz_level_change, wiz_level_tele,
    wiz_levltyp_legend, wiz_load_lua, wiz_load_splua, wiz_makemap, wiz_map, wiz_map_levltyp,
    wiz_migrate_mons, wiz_mon_diff, wiz_objprobs, wiz_panic, wiz_polyself, wiz_rumor_check,
    wiz_show_nhuuid, wiz_show_seenv, wiz_show_stats, wiz_show_vision, wiz_show_wmodes, wiz_smell,
    wiz_telekinesis, wiz_where, wiz_wish,
} from "./wizcmds.js";
import { which_armor } from "./worn.js";
import { dozap } from "./zap.js";
import { dobugreport, dosh, dosuspend } from "../sys/c2js/nhjs_host.js";
import { authorize_explore_mode } from "../sys/unix/unixmain.js";
const struct_lua_State = record_or_opaque("struct_lua_State");
const __FILE__ = "cmd.c";
