/* NetHack 5.0	pickup.c	$NHDT-Date: 1773373633 2026/03/12 19:47:13 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.386 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2012. */
/* NetHack may be freely redistributed.  See license for details. */

/*
 *      Contains code for picking objects up, and container use.
 */

export const CONTAINED_SYM = ord('>');

/* define for query_objlist() and autopickup() */
export function FOLLOW(curr, flags) { return ((flags & BY_NEXTHERE) ? curr.v.v_nexthere : curr.nobj); }

export function GOLD_WT(n) { return Math.trunc((n + 50) / 100); }
/* if you can figure this out, give yourself a hearty pat on the back... */
export function GOLD_CAPACITY(w, n) { return ((w * -100) - (n + 50) - 1); }

export function Icebox() { return +(gc.current_container.otyp == ICE_BOX); }

const slightloadpfx = init_string(static_array("slightloadpfx", char, sizeof_string("You have a little trouble")), _("You have a little trouble"), true);
const moderateloadpfx = init_string(static_array("moderateloadpfx", char, sizeof_string("You have trouble")), _("You have trouble"), true);
const nearloadpfx = init_string(static_array("nearloadpfx", char, sizeof_string("You have much trouble")), _("You have much trouble"), true);
const overloadpfx = init_string(static_array("overloadpfx", char, sizeof_string("You have extreme difficulty")), _("You have extreme difficulty"), true);

/* BUG: this lets you look at cockatrice corpses while blind without
   touching them */
/* much simpler version of the look-here code; used by query_classes() */
function simple_look(otmp,
            here) { /* void */ /* flag for type of obj list linkage */
    /* Neither of the first two cases is expected to happen, since
     * we're only called after multiple classes of objects have been
     * detected, hence multiple objects must be present.
     */
    if (!otmp) {
        impossible(_("simple_look(null)"));
    } else if (!(here ? otmp.v.v_nexthere : otmp.nobj)) {
        pline(_("%s"), doname(otmp));
    } else {
        let tmpwin = create_nhwindow()(NHW_MENU);

        putstr()(tmpwin, 0, _(""));
        do {
            putstr()(tmpwin, 0, doname(otmp));
            otmp = here ? otmp.v.v_nexthere : otmp.nobj;
        } while (otmp);
        display_nhwindow()(tmpwin, TRUE);
        destroy_nhwindow()(tmpwin);
    }
}

export function collect_obj_classes(ilets, otmp, here,
                    filter, itemcount) { /* int */
    let iletct = 0;
    let c;

    itemcount[0] = 0;
    chars[ilets + iletct] = ord('\0'); /* terminate ilets so that strchr() will work */
    while (otmp) {
        c = def_oc_syms[otmp.oclass].sym;
        if (!strchr(ilets, c) && (!filter || filter(otmp)))
            chars[ilets + (iletct++)] = c, chars[ilets + iletct] = ord('\0');
        itemcount[0] += 1;
        otmp = here ? otmp.v.v_nexthere : otmp.nobj;
    }

    return iletct;
}

/*
 * For menustyle:Traditional and menustyle:Combination.
 *
 * Suppose some '?' and '!' objects are present, but '/' objects aren't:
 *      "a" picks all items without further prompting;
 *      "A" steps through all items, asking one by one;
 *      "?" steps through '?' items, asking, and ignores '!' ones;
 *      "/" becomes 'A', since no '/' present;
 *      "?a" or "a?" picks all '?' without further prompting;
 *      "/a" or "a/" becomes 'A' since there aren't any '/'
 *          (bug fix:  3.1.0 thru 3.1.3 treated it as "a");
 *      "?/a" or "a?/" or "/a?",&c picks all '?' even though no '/'
 *          (ie, treated as if it had just been "?a").
 *
 * Note: the behavior and meaning of 'a' vs 'A' is effectively reversed
 * when using menustyle:Full.  For Traditional, the choice is based on
 * ease of typing (using 'a' is much more common than 'A'); for Full,
 * it was changed to enhance menu entry ordering ('A' stands out, but
 * some players complain that it is too easy to choose accidentally).
 */
function query_classes(
    oclasses,
    one_at_a_time,
    everything,
    action,
    objs,
    here,
    menu_on_demand) { /* boolean */ /* to tell caller that user picked 'm' */
    const $frame = stack_frame(); try {
    var ilets = stack_array(char, 36), inbuf = init_list(stack_array(char, BUFSZ), []); /* FIXME: hardcoded ilets[] length */
    var iletct, oclassct;
    var not_everything, filtered;
    var qbuf = stack_array(char, QBUFSZ);
    var m_seen;
    var itemcount = stack_var(int), bcnt = stack_var(int), ucnt = stack_var(int), ccnt = stack_var(int), xcnt = stack_var(int), ocnt = stack_var(int), jcnt = stack_var(int);

    chars[oclasses + (oclassct = 0)] = ord('\0');
    chars[one_at_a_time] = chars[everything] = m_seen = FALSE;
    if (menu_on_demand)
        menu_on_demand[0] = 0;
    iletct = collect_obj_classes(ilets, objs, here,
                                 null, itemcount);
    if (iletct == 0)
        return FALSE;

    if (iletct == 1) {
        chars[oclasses + 0] = def_char_to_objclass(chars[ilets + 0]);
        chars[oclasses + 1] = ord('\0');
    } else { /* more than one choice available */
        /* additional choices */
        chars[ilets + (iletct++)] = ord(' ');
        chars[ilets + (iletct++)] = ord('a');
        chars[ilets + (iletct++)] = ord('A');
        chars[ilets + (iletct++)] = (objs == gi.invent ? ord('i') : ord(':'));
    }
    if (itemcount[0] && menu_on_demand)
        chars[ilets + (iletct++)] = ord('m');
    if (count_unpaid(objs))
        chars[ilets + (iletct++)] = ord('u');

    tally_BUCX(objs, here, bcnt, ucnt, ccnt, xcnt, ocnt, jcnt);
    if (bcnt[0])
        chars[ilets + (iletct++)] = ord('B');
    if (ucnt[0])
        chars[ilets + (iletct++)] = ord('U');
    if (ccnt[0])
        chars[ilets + (iletct++)] = ord('C');
    if (xcnt[0])
        chars[ilets + (iletct++)] = ord('X');
    if (jcnt[0])
        chars[ilets + (iletct++)] = ord('P');
    chars[ilets + iletct] = ord('\0');

    if (iletct > 1) {
        var where = 0;
        var sym, oc_of_sym, p;

 ask_again: for (;;) {
        chars[oclasses + (oclassct = 0)] = ord('\0');
        chars[one_at_a_time] = chars[everything] = FALSE;
        not_everything = filtered = FALSE;
        sprintf(qbuf, _("What kinds of thing do you want to %s? [%s]"), action, ilets)
;
        getlin(qbuf, inbuf);
        if (chars[inbuf] == ord('\x1b'))
            return FALSE;

        for (p = inbuf; (sym = chars[p++]) != 0; ) {
            if (sym == ord(' '))
                continue;
            else if (sym == ord('A'))
                chars[one_at_a_time] = TRUE;
            else if (sym == ord('a'))
                chars[everything] = TRUE;
            else if (sym == ord(':')) {
                simple_look(objs, here); /* dumb if objs==invent */
                /* if we just scanned the contents of a container
                   then mark it as having known contents */
                if (objs.where == OBJ_CONTAINED)
                    objs.v.v_ocontainer.cknown = 1;
                continue ask_again;
            } else if (sym == ord('i')) {
                display_inventory(0, TRUE);
                continue ask_again;
            } else if (sym == ord('m')) {
                m_seen = TRUE;
            } else if (strchr(_("uBUCXP"), sym)) {
                add_valid_menu_class(sym); /* 'u' or 'B','U','C','X','P' */
                filtered = TRUE;
            } else {
                oc_of_sym = def_char_to_objclass(sym);
                if (strchr(ilets, sym)) {
                    add_valid_menu_class(oc_of_sym);
                    chars[oclasses + (oclassct++)] = oc_of_sym;
                    chars[oclasses + oclassct] = ord('\0');
                } else {
                    if (!where)
                        where = !strcmp(action, _("pick up")) ? _("here")
                                : !strcmp(action, _("take out")) ? _("inside") : _("");
                    if (chars[where])
                        There(_("are no %c's %s."), sym, where);
                    else
                        You(_("have no %c's."), sym);
                    not_everything = TRUE;
                }
            }
        } break; } /* for p:sym in inbuf */

        if (m_seen && menu_on_demand) {
            menu_on_demand[0] = (((chars[everything] || !oclassct) && !filtered)
                               ? -2 : -3);
            return FALSE;
        }
        if (!oclassct && (!chars[everything] || not_everything)) {
            /* didn't pick anything,
               or tried to pick something that's not present */
            chars[one_at_a_time] = TRUE; /* force 'A' */
            chars[everything] = FALSE;   /* inhibit 'a' */
        }
    }
    return TRUE;
    } finally { stack_pop($frame); }
}

/*
 * tests:
 *  st_gloves      wearing gloves?
 *  st_corpse      is it a corpse obj?
 *  st_petrifies   does the corpse petrify on touch?
 *  st_resists     does hero have stoning resistance?
 *  st_all         st_gloves | st_corpse | st_petrifies | st_resists
 */
export function u_safe_from_fatal_corpse(obj, tests) { /* boolean */
    if (((tests & st_gloves) && uarmg)
        || ((tests & st_corpse) && obj.otyp != CORPSE)
        || ((tests & st_petrifies) && !touch_petrifies(mons[obj.corpsenm]))
        || ((tests & st_resists) && Stone_resistance()))
        return TRUE;
    return FALSE;
}

/* check whether hero is bare-handedly touching a cockatrice corpse */
function fatal_corpse_mistake(obj, remotely) { /* boolean */
    if (u_safe_from_fatal_corpse(obj, st_all) || remotely)
        return FALSE;

    if (poly_when_stoned(gy.youmonst.data) && polymon(PM_STONE_GOLEM)) {
        display_nhwindow()(WIN_MESSAGE, FALSE); /* --More-- */
        return FALSE;
    }

    pline(_("Touching %s is a fatal mistake."),
          corpse_xname(obj, 0, CXN_SINGULAR | CXN_ARTICLE));
    instapetrify(killer_xname(obj));
    return TRUE;
}

/* attempting to manipulate a Rider's corpse triggers its revival */
export function rider_corpse_revival(obj, remotely) { /* boolean */
    if (!obj || obj.otyp != CORPSE || !is_rider(mons[obj.corpsenm]))
        return FALSE;

    pline(_("At your %s, the corpse suddenly moves..."),
          remotely ? _("attempted acquisition") : _("touch"));
    revive_corpse(obj);
    exercise(A_WIS, FALSE);
    return TRUE;
}

/* wand of probing zapped down; perhaps hero is levitating while blind */
export function force_decor(via_probing) { /* void */
    /* we don't want describe_decor() to defer feedback if hero is fumbling
       with 1 turn left until next slip_or_trip(), or for ice_descr() to
       omit thawing details if hero is probing when levitating while blind
       (those will be skipped for look_here() and farlook() or autodescribe);
       we can't control that by temporarily tweaking properties because that
       could become noticeable if status gets updated while decor feedback
       is being delivered */
    gd.decor_fumble_override = TRUE;
    gd.decor_levitate_override = via_probing;
    /* force current terrain to be different from previous location, or
       uninteresting if previous location was actually inside solid stone */
    iflags.prev_decor = STONE;
    describe_decor();
    gd.decor_fumble_override = gd.decor_levitate_override = FALSE;
    chars[svl.lastseentyp[u.ux] + u.uy] = levl()[u.ux][u.uy].typ;
}

export function deferred_decor(
    setup) { /* void */ /* True: deferring, False: catching up */
    if (!flags.mention_decor) {
        iflags.defer_decor = FALSE;
    } else if (setup) {
        iflags.defer_decor = TRUE;
    } else {
        describe_decor();
        iflags.defer_decor = FALSE;
    }
}

/* handle 'mention_decor' (when walking onto a dungeon feature such as
   stairs or altar, describe it even if it isn't covered up by an object) */
function describe_decor() { /* boolean */
    const $frame = stack_frame(); try {
    let outbuf = stack_array(char, BUFSZ), fbuf = stack_array(char, QBUFSZ);
    let doorhere, waterhere, res = TRUE;
    let dfeature;
    let ltyp;

    if ((HFumbling() & TIMEOUT) == 1 /* about to slip_or_trip */
        && !iflags.defer_decor
        && !gd.decor_fumble_override) { /* probe_decor() */
        /*
         * Work around a message sequencing issue if Fumbling's periodic
         * timeout is about to kick in:  avoid the combination
         *  |You are back on floor.
         *  |You trip over <object>.  or  You flounder.
         * when the trip is being caused by moving on ice as hero
         * steps off ice onto non-ice.  Defer the back-on-floor part if
         * that is about to happen.
         */
        deferred_decor(TRUE);
        return FALSE;
    }

    ltyp = SURFACE_AT(u.ux, u.uy);
    dfeature = dfeature_at(u.ux, u.uy, fbuf);

    /* we don't mention "ordinary" doors but do mention broken ones (and
       closed ones, which will only happen for Passes_walls) */
    doorhere = (dfeature && (!strcmp(dfeature, _("open door"))
                            || !strcmp(dfeature, _("doorway"))) ? 1 : 0);
    waterhere = (dfeature && !strcmp(dfeature, _("pool of water")) ? 1 : 0);
    if (doorhere || Underwater()
        || (ltyp == ICE && IS_POOL(iflags.prev_decor))) /* pooleffects() */
        dfeature = 0;
    /*
     * TODO: if on ice, report moving between thicker and thinner ice (based
     * on ice_descr()'s classification) as if moving onto different terrain.
     */

    if (ltyp == iflags.prev_decor && !IS_FURNITURE(ltyp)) {
        res = FALSE;
    } else if (dfeature) {
        if (waterhere)
            dfeature = strcpy(fbuf, waterbody_name(u.ux, u.uy));
        if (strcmp(dfeature, _("swamp")) && ltyp != ICE)
            dfeature = an(dfeature);

        if (flags.verbose) {
            sprintf(outbuf, _("There is %s here."), dfeature);
        } else {
            if (dfeature != fbuf)
                strcpy(fbuf, dfeature);
            sprintf(outbuf, _("%s."), upstart(fbuf));
        }
        if (ltyp == ICE && flags.mention_decor)
            Norep(_("%s"), outbuf);
        else
            pline(_("%s"), outbuf);
    } else if (!Underwater()) {
        if (IS_POOL(iflags.prev_decor)
            || IS_LAVA(iflags.prev_decor)
            || iflags.prev_decor == ICE) {
            if (iflags.last_msg != PLNMSG_BACK_ON_GROUND) {
                back_on_ground(FALSE);
            }
        }
    }
    /* describe_decor() is normally called when moving onto a different
       type of terrain, but it is also called by pickup() even when
       mention_decor is Off if hero can't reach floor; only adapt the next
       describe_decor() by what has just occurred in this one when it's On */
    iflags.prev_decor = flags.mention_decor ? ltyp : STONE;
    return res;
    } finally { stack_pop($frame); }
}

/* look at the objects at our location, unless there are too many of them */
function check_here(picked_some) { /* void */
    let obj;
    let ct = 0;
    let lhflags = picked_some ? LOOKHERE_PICKED_SOME : LOOKHERE_NOFLAGS;

    if (flags.mention_decor) {
        if (describe_decor())
            lhflags = unsigned(lhflags | LOOKHERE_SKIP_DFEATURE);
    }

    /* count the objects here */
    for (obj = svl.level.objects[u.ux][u.uy]; obj; obj = obj.v.v_nexthere) {
        if (obj != uchain)
            ct++;
    }

    /* If there are objects here, take a look. */
    if (ct) {
        if (svc.context.run)
            nomul(0);
        flush_screen(1);
        look_here(ct, lhflags);
    } else {
        read_engr_at(u.ux, u.uy);
    }
}

/* query_objlist callback: return TRUE if obj's count is >= reference value */
function n_or_more(obj) { /* boolean */
    if (obj == uchain)
        return FALSE;
    return (+(obj.quan >= gv.val_for_n_or_more));
}

/* check valid_menu_classes[] for an entry; also used by askchain() */
export function menu_class_present(c) { /* boolean */
    return (c && strchr(gv.valid_menu_classes, c)) ? TRUE : FALSE;
}

export function add_valid_menu_class(c) { /* void */
    let vmc_count = static_var("add_valid_menu_class.vmc_count", int, 0);

    if (c == 0) { /* reset */
        vmc_count[0] = 0;
        gc.class_filter = gb.bucx_filter = gs.shop_filter = FALSE;
        gp.picked_filter = FALSE;
    } else if (!menu_class_present(c)) {
        chars[gv.valid_menu_classes + (vmc_count[0]++)] = char(c);
        /* categorize the new class */
        switch (c) {
        case ord('B'):
        case ord('U'):
        case ord('C'): /*FALLTHRU*/
        case ord('X'):
            gb.bucx_filter = TRUE;
            break;
        case ord('P'):
            gp.picked_filter = TRUE;
            break;
        case ord('u'):
            gs.shop_filter = TRUE;
            break;
        default:
            gc.class_filter = TRUE;
            break;
        }
    }
    chars[gv.valid_menu_classes + (vmc_count[0])] = ord('\0');
}

/* query_objlist callback: return TRUE if not uchain */
function all_but_uchain(obj) { /* boolean */
    return (+(obj != uchain));
}

/* query_objlist callback: return TRUE */
/*ARGUSED*/
export function allow_all(obj) { /* boolean */
    return TRUE;
}

export function allow_category(obj) { /* boolean */
    /* If no filters are active, nothing will match unless
       paranoid_confirm:A is set. */
    if (!gc.class_filter && !gs.shop_filter && !gb.bucx_filter
        && !gp.picked_filter && !ParanoidAutoAll())
        return FALSE;

    /* For coins, if any class filter is specified, accept if coins
     * are included regardless of whether either unpaid or BUC-status
     * is also specified since player has explicitly requested coins.
     */
    if (obj.oclass == COIN_CLASS && gc.class_filter)
        return strchr(gv.valid_menu_classes, COIN_CLASS) ? TRUE : FALSE;

    if (Role_if(PM_CLERIC) && !obj.bknown)
        set_bknown(obj, 1);

    /*
     * Version 3.6 had three types of filters possible and the first
     * and third can have more than one entry:
     *  1) object class (armor, potion, &c);
     *  2) unpaid shop item;
     *  3) bless/curse state (blessed, uncursed, cursed, BUC-unknown).
     * Version 5.0 added a fourth:
     *  4) 'novelty' ('P' for just picked up items).
     * When only one type is present, the situation is simple:
     * to be accepted, obj's status must match one of the entries.
     * When more than one type is present, the obj will now only
     * be accepted when it matches one entry of each type.
     * So ?!B will accept blessed scrolls or potions, and [u will
     * accept unpaid armor.  (In 3.4.3, an object was accepted by
     * this filter if it met any entry of any type, so ?!B resulted
     * in accepting all scrolls and potions regardless of bless/curse
     * state plus all blessed non-scroll, non-potion objects.)
     */

    /* if class is expected but obj's class is not in the list, reject */
    if (gc.class_filter && !strchr(gv.valid_menu_classes, obj.oclass))
        return FALSE;
    /* if unpaid is expected and obj isn't unpaid, reject (treat a container
       holding any unpaid object as unpaid even if isn't unpaid itself) */
    if (gs.shop_filter && !obj.unpaid
        && !(Has_contents(obj) && count_unpaid(obj.cobj) > 0))
        return FALSE;
    /* check for particular bless/curse state */
    if (gb.bucx_filter) {
        /* first categorize this object's bless/curse state */
        let bucx;
        if (obj.oclass == COIN_CLASS) {
            /* If no class filtering is specified but bless/curse state is,
               coins are treated as either unknown or uncursed based on an
               option setting. */
            bucx = flags.goldX ? ord('X') : ord('U');
        } else {
            bucx = !obj.bknown ? ord('X')
                     : obj.blessed ? ord('B')
                        : obj.cursed ? ord('C')
                           : ord('U');
        }

        /* if its category is not in the list, reject */
        if (!strchr(gv.valid_menu_classes, bucx))
            return FALSE;
    }
    if (gp.picked_filter && !obj.pickup_prev)
        return FALSE;
    /* obj didn't fail any of the filter checks, so accept */
    return TRUE;
}

/* #if 0: not in this build */

/* query_objlist callback: return TRUE if valid class and worn */
export function is_worn_by_type(otmp) { /* boolean */
    return (is_worn(otmp) && allow_category(otmp)) ? TRUE : FALSE;
}

/* reset last-picked-up flags */
export function reset_justpicked(olist) { /* void */
    let otmp;
    /*
     * TODO?  Possible enhancement: don't reset if hero is still at same
     *  spot where most recent pickup took place.  Not resetting will be
     *  the correct behavior for autopickup immediately followed by manual
     *  pickup.  It would probably be correct for either or both pickups
     *  followed by manual pickup of a newly arrived missile after some
     *  time has elapsed.  Things becomes murkier for other activity.
     *  Taking anything out of a container ought to be treated as if
     *  having moved to another spot.
     */

    for (otmp = olist; otmp; otmp = otmp.nobj)
        otmp.pickup_prev = 0;
}

export function count_justpicked(olist) { /* int */
    let otmp;
    let cnt = 0;

    for (otmp = olist; otmp; otmp = otmp.nobj)
        if (otmp.pickup_prev)
            cnt++;

    return cnt;
}

export function find_justpicked(olist) { /* struct obj * */
    let otmp;

    for (otmp = olist; otmp; otmp = otmp.nobj)
        if (otmp.pickup_prev)
            return otmp;

    return null;
}

/*
 * Have the hero pick things from the ground
 * or a monster's inventory if swallowed.
 *
 * Arg what:
 *      >0  autopickup
 *      =0  interactive
 *      <0  pickup count of something
 *
 * Returns 1 if tried to pick something up, whether
 * or not it succeeded.
 */
export function pickup(what) { /* int */ /* should be a long */
    const $frame = stack_frame(); try {
    let $goto = null; var pick_list = stack_var(ptr_to(struct_mi)), qbuf = stack_array(char, QBUFSZ), all_of_a_type = stack_var(boolean), selective = stack_var(boolean), oclasses = stack_array(char, MAXOCLASSES + 10), via_menu = stack_var(int), qbuf = stack_array(char, BUFSZ);
    var i, n, res, count, n_tried = 0, n_picked = 0;
    pick_list[0] = null;
    var autopickup = +(what > 0);
    var objchain_p;
    var traverse_how;

    /* we might have arrived here while fainted or sleeping, via
       random teleport or levitation timeout; if so, skip check_here
       and read_engr_at in addition to bypassing autopickup itself
       [probably ought to check whether hero is using a cockatrice
       corpse for a pillow here... (also at initial faint/sleep)] */
    if (autopickup && gm.multi < 0 && unconscious()) {
        iflags.prev_decor = STONE;
        return 0;
    }

    /* used by pickup_object() for encumbrance feedback */
    gp.pickup_encumbrance = 0;

    if (what < 0) /* pick N of something */
        count = -what;
    else /* pick anything */
        count = 0;

    if (!u.uswallow) {
        var t;

        /* no auto-pick if no-pick move, nothing there, or in a pool */
        if (autopickup && (svc.context.nopick || !OBJ_AT(u.ux, u.uy)
                           || (is_pool(u.ux, u.uy) && !Underwater())
                           || is_lava(u.ux, u.uy))) {
            if (flags.mention_decor)
                describe_decor();
            read_engr_at(u.ux, u.uy);
            return 0;
        }
        /* no pickup if levitating & not on air or water level */
        t = t_at(u.ux, u.uy);
        if (!can_reach_floor((t && is_pit(t.ttyp) ? 1 : 0))) {
            describe_decor(); /* even when !flags.mention_decor */
            if ((gm.multi && !svc.context.run)
                || (autopickup && !flags.pickup)
                || (t && (uteetering_at_seen_pit(t) || uescaped_shaft(t))))
                read_engr_at(u.ux, u.uy);
            return 0;
        }
        /* multi && !svc.context.run means they are in the middle of some
         * other action, or possibly paralyzed, sleeping, etc.... and they
         * just teleported onto the object.  They shouldn't pick it up.
         */
        if ((gm.multi && !svc.context.run)
            || (autopickup && !flags.pickup)
            || notake(gy.youmonst.data)) {
            check_here(FALSE);
            if (notake(gy.youmonst.data) && OBJ_AT(u.ux, u.uy)
                && (autopickup || flags.pickup))
                You(_("are physically incapable of picking anything up."));
            return 0;
        }

        /* if there's anything here, stop running */
        if (OBJ_AT(u.ux, u.uy) && svc.context.run && svc.context.run != 8
            && !svc.context.nopick)
            nomul(0);
    }

    add_valid_menu_class(0); /* reset */
    if (!u.uswallow) {
        objchain_p = svl.level.objects[u.ux].subarray(u.uy);
        traverse_how = BY_NEXTHERE;
    } else {
        objchain_p = ref_of(u.ustuck, "minvent");
        traverse_how = 0; /* nobj */
    }
    /*
     * Start the actual pickup process.  This is split into two main
     * sections, the newer menu and the older "traditional" methods.
     * Automatic pickup has been split into its own menu-style routine
     * to make things less confusing.
     */
    $goto_menu_pickup: for (;;) { switch ($goto) { default: if (autopickup) {
        n = autopick(objchain_p[0], traverse_how, pick_list);
        { $goto = "menu_pickup"; continue $goto_menu_pickup; }
    }

    case "menu_pickup": if ($goto || (flags.menu_style != MENU_TRADITIONAL || iflags.menu_requested)) {
        /* use menus exclusively */
        switch ($goto) { default: traverse_how |= AUTOSELECT_SINGLE
                        | (flags.sortpack ? INVORDER_SORT : 0);
        if (count) { /* looking for N of something */
            sprintf(qbuf, _("Pick %d of what?"), count);
            gv.val_for_n_or_more = count; /* set up callback selector */
            n = query_objlist(qbuf, objchain_p, traverse_how,
                              pick_list, PICK_ONE, n_or_more);
            /* correct counts, if any given */
            for (i = 0; i < n; i++)
                ptr_add(pick_list[0], i).count = count;
        } else {
            n = query_objlist(_("Pick up what?"), objchain_p,
                              (traverse_how | FEEL_COCKATRICE),
                              pick_list, PICK_ANY, all_but_uchain);
        }

 case "menu_pickup": $goto = null;
        if (n > 0)
            reset_justpicked(gi.invent); }
        n_tried = n;
        for (n_picked = i = 0; i < n; i++) {
            res = pickup_object(ptr_add(pick_list[0], i).item.a_obj, ptr_add(pick_list[0], i).count,
                                FALSE);
            if (res < 0)
                break; /* can't continue */
            n_picked += res;
        }
        if (pick_list[0])
            free(addr_of(pick_list[0]));
    } else {
        /* old style interface */
        var ct = 0;
        var lcount;
        var bycat;
         /* +10: room for B,U,C,X plus slop */
        var obj, obj2;

        chars[oclasses + 0] = ord('\0');   /* types to consider (empty for all) */
        all_of_a_type[0] = TRUE; /* take all of considered types */
        selective[0] = FALSE;    /* ask for each item */

        /* check for more than one object */
        for (obj = objchain_p[0]; obj; obj = FOLLOW(obj, traverse_how))
            ct++;

        end_query: { if (ct == 1 && count) {
            /* if only one thing, then pick it */
            obj = objchain_p[0];
            lcount = min(obj.quan, count);
            n_tried++;
            reset_justpicked(gi.invent);
            if (pickup_object(obj, lcount, FALSE) > 0)
                n_picked++; /* picked something */
            break end_query;
        } else if (ct >= 2) {
            via_menu[0] = 0;

            There(_("are %s objects here."), (ct <= 10) ? _("several") : _("many"));
            if (!query_classes(oclasses, addr_of(selective), addr_of(all_of_a_type),
                               _("pick up"), objchain_p[0],
                               (traverse_how & BY_NEXTHERE) ? TRUE : FALSE,
                               via_menu)) {
                if (!via_menu[0])
                    { $goto = "pickupdone"; continue $goto_menu_pickup; };
                if (selective[0])
                    traverse_how |= INVORDER_SORT;
                n = query_objlist(_("Pick up what?"), objchain_p, traverse_how,
                                  pick_list, PICK_ANY,
                                  (via_menu[0] == -2) ? allow_all
                                                   : allow_category);
                { $goto = "menu_pickup"; continue $goto_menu_pickup; }
            }
        }
        bycat = (menu_class_present(ord('B')) || menu_class_present(ord('U'))
                 || menu_class_present(ord('C')) || menu_class_present(ord('X')) ? 1 : 0);

        for (obj = objchain_p[0]; obj; obj = obj2) {
            obj2 = FOLLOW(obj, traverse_how);
            if (bycat ? !allow_category(obj)
                      : (!selective[0] && chars[oclasses + 0]
                         && !strchr(oclasses, obj.oclass)))
                continue;

            lcount = -1;
            if (!all_of_a_type[0]) {
                safe_qbuf(qbuf, _("Pick up "), _("?"), obj, doname,
                                 ansimpleoname, something());
                switch ((obj.quan < 2) ? ynaq(qbuf) : ynNaq(qbuf)) {
                case ord('q'):
                    break end_query;; /* out 2 levels */
                case ord('n'):
                    continue;
                case ord('a'):
                    all_of_a_type[0] = TRUE;
                    if (selective[0]) {
                        selective[0] = FALSE;
                        chars[oclasses + 0] = obj.oclass;
                        chars[oclasses + 1] = ord('\0');
                    }
                    break;
                case ord('#'): /* count was entered */
                    if (!yn_number)
                        continue; /* 0 count => No */
                    lcount = yn_number;
                    if (lcount > obj.quan)
                        lcount = obj.quan;
                    /* FALLTHROUGH */;
                    /*FALLTHRU*/
                default: /* 'y' */
                    break;
                }
            }
            if (lcount == -1)
                lcount = obj.quan;

            if (!n_tried) /* reset just before the first item picked */
                reset_justpicked(gi.invent);

            n_tried++;
            if ((res = pickup_object(obj, lcount, FALSE)) < 0)
                break;
            n_picked += res;
        }
 }
        ; /* statement required after label */
    }

    if (!u.uswallow) {
        if (hides_under(gy.youmonst.data))
            hideunder(gy.youmonst);

        /* position may need updating (invisible hero) */
        if (n_picked)
            newsym_force(u.ux, u.uy);

        /* check if there's anything else here after auto-pickup is done */
        if (autopickup)
            check_here(+(n_picked > 0));
    }
 case "pickupdone": $goto = null;
    gp.pickup_encumbrance = 0; } break; }
    add_valid_menu_class(0); /* reset */
    return +(n_tried > 0);
    } finally { stack_pop($frame); }
}

export function check_autopickup_exceptions(obj) { /* struct autopickup_exception * */
    /*
     *  Does the text description of this match an exception?
     */
    let ape = ga.apelist;

    if (ape) {
        let objdesc = makesingular(doname(obj));

        while (ape && !regex_match(objdesc, ape.regex))
            ape = ape.next;
    }
    return ape;
}

export function autopick_testobj(otmp, calc_costly) { /* boolean */
    let ape;
    let costly = static_var("autopick_testobj.costly", schar, FALSE);
    let otypes = flags.pickup_types;
    let pickit;

    /* calculate 'costly' just once for a given autopickup operation */
    if (calc_costly)
        costly[0] = (otmp.where == OBJ_FLOOR
                  && costly_spot(otmp.ox, otmp.oy) ? 1 : 0);

    /* first check: reject if an unpaid item in a shop */
    if (costly[0] && !otmp.no_charge)
        return FALSE;

    /* pickup_thrown/pickup_stolen/nopick_dropped override pickup_types and
       exceptions */
    if ((flags.pickup_thrown && otmp.how_lost == LOST_THROWN)
        || (flags.pickup_stolen && otmp.how_lost == LOST_STOLEN))
        return TRUE;
    if (flags.nopick_dropped && otmp.how_lost == LOST_DROPPED)
        return FALSE;
    if (otmp.how_lost == LOST_EXPLODING)
        return FALSE;

    /* check for pickup_types */
    pickit = (!chars[otypes] || strchr(otypes, otmp.oclass) ? 1 : 0);

    /* check for autopickup exceptions */
    ape = check_autopickup_exceptions(otmp);
    if (ape)
        pickit = ape.grab;

    return pickit;
}

/*
 * Pick from the given list using flags.pickup_types.  Return the number
 * of items picked (not counts).  Create an array that returns pointers
 * and counts of the items to be picked up.  If the number of items
 * picked is zero, the pickup list is left alone.  The caller of this
 * function must free the pickup list.
 */
function autopick(
    olist,
    follow,
    pick_list) { /* int */ /* list of objects and counts to pick up */
    let pi; /* pick item */
    let curr;
    let n;
    let check_costly = TRUE;

    /* first count the number of eligible items */
    for (n = 0, curr = olist; curr; curr = FOLLOW(curr, follow)) {
        if (autopick_testobj(curr, check_costly))
            ++n;
        check_costly = FALSE; /* only need to check once per autopickup */
    }

    if (n) {
        pick_list[0] = pi = view_of(struct_mi, addr_of(alloc(unsigned(Math.imul(sizeof(struct_mi), unsigned(n))))));
        for (n = 0, curr = olist; curr; curr = FOLLOW(curr, follow)) {
            if (autopick_testobj(curr, FALSE)) {
                ptr_add(pi, n).item.a_obj = curr;
                ptr_add(pi, n).count = curr.quan;
                n++;
            }
        }
    }
    return n;
}

/*
 * Put up a menu using the given object list.  Only those objects on the
 * list that meet the approval of the allow function are displayed.  Return
 * a count of the number of items selected, as well as an allocated array of
 * menu_items, containing pointers to the objects selected and counts.  The
 * returned counts are guaranteed to be in bounds and non-zero.
 *
 * Query flags:
 *      BY_NEXTHERE       - Follow object list via nexthere instead of nobj.
 *      AUTOSELECT_SINGLE - Don't ask if only 1 object qualifies - just
 *                          use it.
 *      USE_INVLET        - Use object's invlet.
 *      INVORDER_SORT     - Use hero's pack order.
 *      INCLUDE_HERO      - Showing engulfer's invent; show hero too.
 *      SIGNAL_NOMENU     - Return -1 rather than 0 if nothing passes "allow".
 *      SIGNAL_ESCAPE     - Return -1 rather than 0 if player uses ESC to
 *                          pick nothing.
 *      FEEL_COCKATRICE   - touch corpse.
 */
export function query_objlist(qstr,
              olist_p,
              qflags,
              pick_list,
              how,
              allow) { /* int */ /* allow function */
    const $frame = stack_frame(); try {
    let i, n, tmpglyph;
    let win;
    let curr, last, fake_hero_object = stack_struct(struct_obj), olist = stack_var(ptr_to(struct_obj), olist_p[0]);
    let pack, packbuf = stack_array(char, MAXOCLASSES + 1);
    let any = stack_struct(struct_any);
    let printed_type_name, first,
            sorted = +((qflags & INVORDER_SORT) != 0),
            engulfer = +((qflags & INCLUDE_HERO) != 0),
            engulfer_minvent;
    let sortflags;
    let tmpglyphinfo = struct_assign(stack_struct(struct_glyphinfo), nul_glyphinfo);
    let sortedolist = stack_var(ptr_to(struct_sortloot_item)), srtoli;
    let clr = NO_COLOR;

    pick_list[0] = null;
    if (!olist[0] && !engulfer)
        return 0;

    /* count the number of items allowed */
    for (n = 0, last = null, curr = olist[0]; curr; curr = FOLLOW(curr, qflags))
        if (allow(curr)) {
            last = curr;
            n++;
        }
    /* can't depend upon 'engulfer' because that's used to indicate whether
       hero should be shown as an extra, fake item */
    engulfer_minvent = (olist[0] && olist[0].where == OBJ_MINVENT
                        && (u.uswallow && (u.ustuck == (olist[0].v.v_ocarry))) ? 1 : 0);
    if (engulfer_minvent && n == 1 && olist[0].owornmask != 0) {
        qflags &= ~AUTOSELECT_SINGLE;
    }
    if (engulfer) {
        ++n;
        /* don't autoselect swallowed hero if it's the only choice */
        qflags &= ~AUTOSELECT_SINGLE;
    }

    if (n == 0) /* nothing to pick here */
        return (qflags & SIGNAL_NOMENU) ? -1 : 0;

    if (n == 1 && (qflags & AUTOSELECT_SINGLE)) {
        pick_list[0] = view_of(struct_mi, addr_of(alloc(sizeof(struct_mi))));
        (pick_list[0]).item.a_obj = last;
        (pick_list[0]).count = last.quan;
        return 1;
    }

    sortflags = (((flags.sortloot == ord('f')
                   || (flags.sortloot == ord('l') && !(qflags & USE_INVLET)))
                  ? SORTLOOT_LOOT
                  : ((qflags & USE_INVLET) ? SORTLOOT_INVLET : 0))
                 | (flags.sortpack ? SORTLOOT_PACK : 0)
                 | ((qflags & FEEL_COCKATRICE) ? SORTLOOT_PETRIFY : 0));
    sortedolist[0] = sortloot(olist, sortflags,
                           (qflags & BY_NEXTHERE) ? TRUE : FALSE, allow);

    win = create_nhwindow()(NHW_MENU);
    start_menu()(win, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    if (gt.this_title) {
        /* dotypeinv() supplies gt.this_title to display as initial header;
           intentionally avoid the menu_headings highlight attribute here */
        add_menu_str(win, gt.this_title);
    }
    /*
     * Run through the list and add the objects to the menu.  If
     * INVORDER_SORT is set, we'll run through the list once for
     * each type so we can group them.  The allow function was
     * called by sortloot() and will be called once per item here.
     */
    pack = strcpy(packbuf, flags.inv_order);
    if (qflags & INCLUDE_VENOM)
        strkitten(pack, VENOM_CLASS); /* venom is not in inv_order */
    first = TRUE;
    do {
        printed_type_name = FALSE;
        for (srtoli = sortedolist[0]; ((curr = srtoli.obj) != null); srtoli = ptr_add(srtoli, 1)) {
            if (sorted && curr.oclass != chars[pack])
                continue;
            if ((qflags & FEEL_COCKATRICE) && curr.otyp == CORPSE
                && will_feel_cockatrice(curr, FALSE)) {
                destroy_nhwindow()(win); /* stop the menu and revert */
                look_here(0, LOOKHERE_NOFLAGS);
                unsortloot(sortedolist);
                return 0;
            }
            if (allow(curr)) {
                /* if sorting, print type name (once only) */
                if (sorted && !printed_type_name) {
                    let with_oc_sym = (how != PICK_NONE
                                           && iflags.menu_head_objsym ? 1 : 0);

                    struct_assign(any, cg.zeroany);
                    add_menu_heading(win,
                                     let_to_name(chars[pack], FALSE, with_oc_sym));
                    printed_type_name = TRUE;
                }

                any.a_obj = curr;
                tmpglyph = obj_to_glyph(curr, rn2_on_display_rng);
                map_glyphinfo(0, 0, tmpglyph, 0, tmpglyphinfo);
                add_menu(win, tmpglyphinfo, any,
                         (qflags & USE_INVLET) ? curr.invlet
                           : (first && curr.oclass == COIN_CLASS) ? ord('$') : 0,
                         def_oc_syms[(objects[curr.otyp].oc_class)].sym,
                         ATR_NONE, clr, doname_with_price(curr),
                         MENU_ITEMFLAGS_NONE);
                first = FALSE;
            }
        }
        pack++;
    } while (sorted && chars[pack]);
    unsortloot(sortedolist);

    if (engulfer) {
        let buf = stack_array(char, BUFSZ);

        struct_assign(any, cg.zeroany);
        if (sorted && n > 1) {
            sprintf(buf, _("%s Creatures"), digests(u.ustuck.data) ? _("Swallowed") : _("Engulfed"))
;
            add_menu_heading(win, buf);
        }
        struct_assign(fake_hero_object, cg.zeroobj);
        fake_hero_object.quan = 1; /* not strictly necessary... */
        any.a_obj = fake_hero_object;
        tmpglyph = mon_to_glyph(gy.youmonst, rn2_on_display_rng);
        map_glyphinfo(0, 0, tmpglyph, 0, tmpglyphinfo);
        add_menu(win, tmpglyphinfo, any,
                 /* fake inventory letter, no group accelerator */
                 CONTAINED_SYM, 0, ATR_NONE, clr, an(self_lookat(buf)),
                 MENU_ITEMFLAGS_NONE);
    }

    end_menu()(win, qstr);
    n = select_menu(win, how, pick_list);
    destroy_nhwindow()(win);

    if (n > 0) {
        let mi;
        let k;

        /* fix up counts:  -1 means no count used => pick all;
           if fake_hero_object was picked, discard that choice */
        for (i = k = 0, mi = pick_list[0]; i < n; i++, mi = ptr_add(mi, 1)) {
            curr = mi.item.a_obj;
            if (curr == fake_hero_object) {
                /* this isn't actually possible; fake item representing
                   hero is only included for look here (':'), not pickup,
                   and that's PICK_NONE so we can't get here from there */
                You_cant(_("pick yourself up!"));
                continue;
            }
            if (engulfer_minvent && curr.owornmask != 0) {
                You_cant(_("pick %s up."), ysimple_name(curr));
                continue;
            }
            if (mi.count == -1 || mi.count > curr.quan)
                mi.count = curr.quan;
            if (k < i)
                struct_assign(ptr_add((pick_list[0]), k), mi);
            ++k;
        }
        if (!k) {
            /* fake_hero was only choice so discard whole list */
            free(addr_of(pick_list[0]));
            pick_list[0] = null;
            n = 0;
        } else if (k < n) {
            /* other stuff plus fake_hero; last slot is now unused
               (could be more than one if player tried to pick items
               worn by engulfer) */
            while (n > k) {
                --n;
                struct_assign(ptr_add((pick_list[0]), n).item, cg.zeroany);
                ptr_add((pick_list[0]), n).count = 0;
            }
        }
    } else if (n < 0) {
        /* -1 is used for SIGNAL_NOMENU, so callers don't expect it
           to indicate that the player declined to make a choice */
        n = (qflags & SIGNAL_ESCAPE) ? -2 : 0;
    }
    return n;
    } finally { stack_pop($frame); }
}

/*
 * For menustyle:Full.
 *
 * allow menu-based category (class) selection (for Drop,take off etc.)
 *
 * If ParanoidAutoAll, requires confirmation when 'A' has been picked.
 */
export function query_category(
    qstr,
    olist,
    qflags,
    pick_list,
    how) { /* int */ /* type of query */
    const $frame = stack_frame(); try {
    var n;
    var win;
    var curr;
    var pack, packbuf = stack_array(char, MAXOCLASSES + 1);
    var any = stack_struct(struct_any);
    var collected_type_name;
    var invlet;
    var ccount;
    var ofilter = null;
    var show_a,
            do_unpaid = FALSE, do_usedup = FALSE,
            do_blessed = FALSE, do_cursed = FALSE,
            do_uncursed = FALSE, do_buc_unknown = FALSE,
            do_worn = FALSE, verify_All = FALSE;
    var num_buc_types = 0, num_justpicked = 0, clr = NO_COLOR;

    pick_list[0] = null;
    if (!olist)
        return 0;
    if ((qflags & UNPAID_TYPES) != 0 && count_unpaid(olist))
        do_unpaid = TRUE;
    /* caller only passes BILLED_TYPES when there are some used up items
       on shop's bill */
    if ((qflags & BILLED_TYPES) != 0)
        do_usedup = TRUE;
    /* for the 'A' command to remove worn/wielded */
    if ((qflags & WORN_TYPES) != 0) {
        do_worn = TRUE;
        ofilter = is_worn;
    }
    if ((qflags & BUC_BLESSED) != 0
        && count_buc(olist, BUC_BLESSED, ofilter)) {
        do_blessed = TRUE;
        num_buc_types++;
    }
    if ((qflags & BUC_CURSED) != 0
        && count_buc(olist, BUC_CURSED, ofilter)) {
        do_cursed = TRUE;
        num_buc_types++;
    }
    if ((qflags & BUC_UNCURSED) != 0
        && count_buc(olist, BUC_UNCURSED, ofilter)) {
        do_uncursed = TRUE;
        num_buc_types++;
    }
    if ((qflags & BUC_UNKNOWN) != 0
        && count_buc(olist, BUC_UNKNOWN, ofilter)) {
        do_buc_unknown = TRUE;
        num_buc_types++;
    }
    if ((qflags & JUSTPICKED) != 0) {
        num_justpicked = count_justpicked(olist);
    }

    ccount = count_categories(olist, qflags);
    /* no point in actually showing a menu for a single category */
    if (ccount == 1 && !do_unpaid && !do_usedup && num_buc_types <= 1) {
        for (curr = olist; curr; curr = FOLLOW(curr, qflags)) {
            if (ofilter && !ofilter(curr))
                continue;
            break;
        }
        if (curr) {
            pick_list[0] = view_of(struct_mi, addr_of(alloc(sizeof(struct_mi))));
            (pick_list[0]).item.a_int = curr.oclass;
            n = 1;
        } else {
            debugpline0(_("query_category: no single object match"), __FILE__);
            n = 0;
        }
        /* early return is ok; there's no temp window yet */
        return n;
    }

    win = create_nhwindow()(NHW_MENU);
    start_menu()(win, MENU_BEHAVE_STANDARD);

    pack = strcpy(packbuf, flags.inv_order);
    if ((qflags & INCLUDE_VENOM) != 0)
        strkitten(pack, VENOM_CLASS); /* venom is not in inv_order */

    show_a = +((qflags & ALL_TYPES) != 0 && ccount > 1);

    if ((qflags & CHOOSE_ALL) != 0) {
        invlet = ord('A');
        struct_assign(any, cg.zeroany);
        any.a_int = ord('A');
        add_menu(win, nul_glyphinfo, any, invlet, 0, ATR_NONE, clr,
                 /* note: menu_remarm() doesn't pass the CHOOSE_ALL flag,
                    so do_worn handling here is moot */
                 do_worn ? _("Auto-select every item being worn or wielded")
                         : _("Auto-select every relevant item"),
                 MENU_ITEMFLAGS_SKIPINVERT);
        verify_All = +((how == PICK_ANY) && ParanoidAutoAll());
        if (!verify_All) {
            if (!ga.A_first_hint++ || iflags.cmdassist)
                add_menu_str(win,
                   _("    (ignored unless some other choices are also picked)"));
        } else if (show_a) {
            if (!ga.A_second_hint++ || iflags.cmdassist)
                add_menu_str(win,
                      _("    (if no other choices are picked, 'a' is implied)"));
        }
        /* blank separator */
        add_menu_str(win, _(""));
    }

    invlet = ord('a');
    if (show_a) {
        struct_assign(any, cg.zeroany);
        any.a_int = ALL_TYPES_SELECTED;
        add_menu(win, nul_glyphinfo, any, invlet, 0, ATR_NONE, clr,
                 do_worn ? _("All worn and wielded types") : _("All types"),
                 MENU_ITEMFLAGS_SKIPINVERT);
        ++invlet; /* invlet = 'b'; */
    }

    query_done: { do {
        collected_type_name = FALSE;
        for (curr = olist; curr; curr = FOLLOW(curr, qflags)) {
            if (curr.oclass == chars[pack]) {
                if (ofilter && !ofilter(curr))
                    continue;
                if (!collected_type_name) {
                    var oclass = curr.oclass;

                    struct_assign(any, cg.zeroany);
                    any.a_int = oclass;
                    add_menu(win, nul_glyphinfo, any, invlet++,
                             (def_oc_syms[oclass].sym), ATR_NONE, clr,
                             let_to_name(chars[pack], FALSE,
                                         (how != PICK_NONE
                                          && iflags.menu_head_objsym ? 1 : 0)),
                             MENU_ITEMFLAGS_NONE);
                    collected_type_name = TRUE;
                }
            }
        }
        pack++;
        if (invlet >= ord('u')) {
            impossible(_("query_category: too many categories"));
            n = 0;
            break query_done;
        }
    } while (chars[pack]);

    if (do_unpaid || do_usedup
        || do_blessed || do_cursed || do_uncursed || do_buc_unknown
        || num_justpicked) {
        add_menu_str(win, _(""));
    }

    /* unpaid items if there are any */
    if (do_unpaid) {
        invlet = ord('u');
        struct_assign(any, cg.zeroany);
        any.a_int = ord('u');
        add_menu(win, nul_glyphinfo, any, invlet, 0,
                 ATR_NONE, clr, _("Unpaid items"), MENU_ITEMFLAGS_SKIPINVERT);
    }
    /* billed items: checked by caller, so always include if BILLED_TYPES */
    if (do_usedup) {
        invlet = ord('x');
        struct_assign(any, cg.zeroany);
        any.a_int = ord('x');
        add_menu(win, nul_glyphinfo, any, invlet, 0, ATR_NONE, clr,
                 _("Unpaid items already used up"), MENU_ITEMFLAGS_SKIPINVERT);
    }

    /* items with b/u/c/unknown if there are any;
       this cluster of menu entries is in alphabetical order,
       reversing the usual sequence of 'U' and 'C' in BUCX */
    if (do_blessed) {
        invlet = ord('B');
        struct_assign(any, cg.zeroany);
        any.a_int = ord('B');
        add_menu(win, nul_glyphinfo, any, invlet, 0, ATR_NONE, clr,
                 _("Items known to be Blessed"), MENU_ITEMFLAGS_SKIPINVERT);
    }
    if (do_cursed) {
        invlet = ord('C');
        struct_assign(any, cg.zeroany);
        any.a_int = ord('C');
        add_menu(win, nul_glyphinfo, any, invlet, 0, ATR_NONE, clr,
                 _("Items known to be Cursed"), MENU_ITEMFLAGS_SKIPINVERT);
    }
    if (do_uncursed) {
        invlet = ord('U');
        struct_assign(any, cg.zeroany);
        any.a_int = ord('U');
        add_menu(win, nul_glyphinfo, any, invlet, 0, ATR_NONE, clr,
                 _("Items known to be Uncursed"), MENU_ITEMFLAGS_SKIPINVERT);
    }
    if (do_buc_unknown) {
        invlet = ord('X');
        struct_assign(any, cg.zeroany);
        any.a_int = ord('X');
        add_menu(win, nul_glyphinfo, any, invlet, 0, ATR_NONE, clr,
                 _("Items of unknown Bless/Curse status"),
                 MENU_ITEMFLAGS_SKIPINVERT);
    }
    if (num_justpicked) {
        var tmpbuf = stack_array(char, BUFSZ);

        if (num_justpicked == 1)
            sprintf(tmpbuf, _("Just picked up: %s"), doname(find_justpicked(olist)));
        else
            strcpy(tmpbuf, _("Items you just picked up"))
;
        invlet = ord('P');
        struct_assign(any, cg.zeroany);
        any.a_int = ord('P');
        add_menu(win, nul_glyphinfo, any, invlet, 0, ATR_NONE, clr,
                 tmpbuf, MENU_ITEMFLAGS_SKIPINVERT);
    }
    end_menu()(win, qstr);
    n = select_menu(win, how, pick_list);
    if (n > 0) {
        assert(pick_list[0] != null);
    }

    /* handle ParanoidAutoAll by confirming 'A' choice if present */
    if (n > 0 && verify_All) {
        var i, j;

        for (i = 0; i < n; ++i)
            if (ptr_add((pick_list[0]), i).item.a_int == ord('A')) {
                /* ParanoidAutoAll is set (otherwise verify_All is false);
                   if ParanoidConfirm is also set, require "yes" rather than
                   just "y" to accept (and "no" rather than "n" to decline;
                   accepts "quit" and ESC without converting them to 'n') */
                switch (paranoid_ynq(ParanoidConfirm(),
                                     _("Really autoselect All?"), TRUE)) {
                case ord('y'):
                    /* yes => honor Auto-select All */
                    break;
                case ord('n'):
                    /* no => remove 'A' from the list; if that would make
                       it empty then replace with 'a' */
                    if (n > 1) {
                        for (j = i + 1; j < n; ++j)
                            struct_assign(ptr_add((pick_list[0]), j - 1), ptr_add((pick_list[0]), j));
                        --n;
                        break; /* from switch */
                    } else if ((qflags & ALL_TYPES) != 0) {
                        /* 'A' was the only choice; convert it to 'a' and
                           then let the next menu offer a choice of all */
                        ptr_add((pick_list[0]), 0).item.a_int = ALL_TYPES_SELECTED;
                        /* assert( n == 1 ); */
                        break; /* from switch */
                    }
                    /* FALLTHROUGH */;
                    /*FALLTHRU*/
                case ord('q'):
                default:
                    /* quit | ESC => cancel, no Auto-select and no 2nd menu */
                    n = 0;
                    free(addr_of(pick_list[0])), pick_list[0] = null;
                    break;
                }
                break; /* from for => goto query_done; */
            }
    } else if (n == 1 && !verify_All && ptr_add((pick_list[0]), 0).item.a_int == ord('A')) {
        /* without paranoid_confirm:A, choosing 'A' by itself is rejected */
        n = 0;
        free(addr_of(pick_list[0])), pick_list[0] = null;
        /* the menu entry description is "Auto-select every relevant item"
           [not sure whether issuing a message here is a good idea...] */
        pline(_("No relevant items selected."));
    }
 }
    destroy_nhwindow()(win);
    if (n < 0) /* closed menu with ESC */
        n = 0; /* callers don't expect -1 */
    return n;
    } finally { stack_pop($frame); }
}

function count_categories(olist, qflags) { /* int */
    let pack;
    let counted_category;
    let ccount = 0;
    let curr;
    let do_worn = +((qflags & WORN_TYPES) != 0);

    pack = flags.inv_order;
    do {
        counted_category = FALSE;
        for (curr = olist; curr; curr = FOLLOW(curr, qflags)) {
            if (curr.oclass == chars[pack]) {
                if (do_worn && !(curr.owornmask
                                 & (W_ARMOR | W_ACCESSORY | W_WEAPONS)))
                    continue;
                if (!counted_category) {
                    ccount++;
                    counted_category = TRUE;
                }
            }
        }
        pack++;
    } while (chars[pack]);
    return ccount;
}

/*
 *  How much the weight of the given container will change when the given
 *  object is removed from it.  Use before and after weight amounts rather
 *  than trying to match the calculation used by weight() in mkobj.c.
 */
function delta_cwt(container, obj) { /* int */
    let prev;
    let owt, nwt;

    if (container.otyp != BAG_OF_HOLDING)
        return int(obj.owt);

    owt = nwt = int(container.owt);
    /* find the object so that we can remove it */
    for (prev = ref_of(container, "cobj"); prev[0]; prev = ref_of((prev[0]), "nobj"))
        if (prev[0] == obj)
            break;
    if (!prev[0]) {
        panic(_("delta_cwt: obj not inside container?"));
    } else {
        /* temporarily remove the object and calculate resulting weight */
        prev[0] = obj.nobj;
        nwt = weight(container);
        prev[0] = obj; /* put the object back; obj->nobj is still valid */
    }
    return owt - nwt;
}

/* could we carry `obj'? if not, could we carry some of it/them? */
function carry_count(obj,
            container,
            count,
            telekinesis,
            wt_before, wt_after) { /* long long */
    const $frame = stack_frame(); try {
    let adjust_wt = (container && carried(container) ? 1 : 0),
            is_gold = +(obj.oclass == COIN_CLASS);
    let wt, iw, ow, oow;
    let qq, savequan, umoney;
    let saveowt;
    let verb, prefx1, prefx2, suffx;
    let obj_nambuf = stack_array(char, BUFSZ), where = stack_array(char, BUFSZ);

    savequan = obj.quan;
    saveowt = obj.owt;
    umoney = money_cnt(gi.invent);
    iw = max_capacity();

    if (count != savequan) {
        obj.quan = count;
        obj.owt = unsigned(weight(obj));
    }
    wt = iw + int(obj.owt);
    if (adjust_wt)
        wt -= delta_cwt(container, obj);
    /* This will go with silver+copper & new gold weight */
    if (is_gold) /* merged gold might affect cumulative weight */
        wt -= (GOLD_WT(umoney) + GOLD_WT(count) - GOLD_WT(umoney + count));
    if (count != savequan) {
        obj.quan = savequan;
        obj.owt = saveowt;
    }
    wt_before[0] = iw;
    wt_after[0] = wt;

    if (wt < 0)
        return count;

    /* see how many we can lift */
    if (is_gold) {
        iw -= int(GOLD_WT(umoney));
        if (!adjust_wt) {
            qq = GOLD_CAPACITY(iw, umoney);
        } else {
            oow = 0;
            qq = 50 - (umoney % 100) - 1;
            if (qq < 0)
                qq += 100;
            for (; qq <= count; qq += 100) {
                obj.quan = qq;
                obj.owt = unsigned(GOLD_WT(qq));
                ow = int(GOLD_WT(umoney + qq));
                ow -= delta_cwt(container, obj);
                if (iw + ow >= 0)
                    break;
                oow = ow;
            }
            iw -= oow;
            qq -= 100;
        }
        if (qq < 0)
            qq = 0;
        else if (qq > count)
            qq = count;
        wt = iw + int(GOLD_WT(umoney + qq));
    } else if (count > 1 || count < obj.quan) {
        /*
         * Ugh. Calc num to lift by changing the quan of the
         * object and calling weight.
         *
         * This works for containers only because containers
         * don't merge.  -dean
         */
        for (qq = 1; qq <= count; qq++) {
            obj.quan = qq;
            obj.owt = unsigned((ow = weight(obj)));
            if (adjust_wt)
                ow -= delta_cwt(container, obj);
            if (iw + ow >= 0)
                break;
            wt = iw + ow;
        }
        --qq;
    } else {
        /* there's only one, and we can't lift it */
        qq = 0;
    }
    obj.quan = savequan;
    obj.owt = saveowt;

    if (qq < count) {
        /* some message will be given */
        strcpy(obj_nambuf, doname(obj));
        if (container) {
            sprintf(where, _("in %s"), the(xname(container)));
            verb = _("carry");
        } else {
            strcpy(where, _("lying here"));
            verb = telekinesis ? _("acquire") : _("lift");
        }
    } else {
        /* lint suppression */
        chars[obj_nambuf] = chars[where] = ord('\0');
        verb = _("");
    }
    /* we can carry qq of them */
    if (qq > 0) {
        if (qq < count)
            You(_("can only %s %s of the %s %s."), verb,
                (qq == 1) ? _("one") : _("some"), obj_nambuf, where);
        wt_after[0] = wt;
        return qq;
    }

    if (!container)
        strcpy(where, _("here")); /* slightly shorter form */
    if (gi.invent || umoney) {
        prefx1 = _("you cannot ");
        prefx2 = _("");
        suffx = _(" any more");
    } else {
        prefx1 = (obj.quan == 1) ? _("it ") : _("even one ");
        prefx2 = _("is too heavy for you to ");
        suffx = _("");
    }
    There(_("%s %s %s, but %s%s%s%s."), otense(obj, _("are")), obj_nambuf, where,
          prefx1, prefx2, verb, suffx);

    /* *wt_after = iw; */
    return 0;
    } finally { stack_pop($frame); }
}

/* determine whether character is able and player is willing to carry `obj' */
function lift_object(
    obj,
    container,
    cnt_p,
    telekinesis) { /* int */
    const $frame = stack_frame(); try {
    let result, old_wt = stack_var(int), new_wt = stack_var(int), prev_encumbr, next_encumbr;

    if (obj.otyp == BOULDER && Sokoban()) {
        You(_("cannot get your %s around this %s."), body_part(HAND),
            xname(obj));
        return -1;
    }
    /* override weight consideration for loadstone picked up by anybody
       and for boulder picked up by hero poly'd into a giant; override
       availability of open inventory slot iff not already carrying one */
    if (obj.otyp == LOADSTONE
        || (obj.otyp == BOULDER && throws_rocks(gy.youmonst.data))) {
        if (inv_cnt(FALSE) < invlet_basic || !carrying(obj.otyp)
            || merge_choice(gi.invent, obj))
            return 1; /* lift regardless of current situation */
        /* if we reach here, we're out of slots and already have at least
           one of these, so treat this one more like a normal item
           [this was using simpleonames(obj) for shortest description, but
           that's suboptimal for loadstones because it omits user-assigned
           type name which is something of interest for gray stones] */
        You(_("are carrying too much stuff to pick up %s %s."),
            (obj.quan == 1) ? _("another") : _("more"), xname(obj));
        return -1;
    }

    cnt_p[0] = carry_count(obj, container, cnt_p[0], telekinesis,
                         old_wt, new_wt);
    if (cnt_p[0] < 1) {
        result = -1; /* nothing lifted */
    } else if (obj.oclass != COIN_CLASS
               /* [exception for gold coins will have to change
                   if silver/copper ones ever get implemented] */
               && inv_cnt(FALSE) >= invlet_basic
               && !merge_choice(gi.invent, obj)) {
        /* if there is some gold here (and we haven't already skipped it),
           we aren't limited by the 52 item limit for it, but caller and
           "grandcaller" aren't prepared to skip stuff and then pickup
           just gold, so the best we can do here is vary the message */
        Your(_("knapsack cannot accommodate any more items%s."),
             /* floor follows by nexthere, otherwise container so by nobj */
             nxtobj(obj, GOLD_PIECE, (+(obj.where == OBJ_FLOOR)))
                 ? _(" (except gold)") : _(""));
        result = -1; /* nothing lifted */
    } else {
        result = 1;
        prev_encumbr = near_capacity();
        if (prev_encumbr < flags.pickup_burden)
            prev_encumbr = flags.pickup_burden;
        next_encumbr = calc_capacity(new_wt[0] - old_wt[0]);
        if (next_encumbr > prev_encumbr) {
            if (telekinesis) {
                result = 0; /* don't lift */
            } else {
                let qbuf = stack_array(char, BUFSZ);
                let savequan = obj.quan;

                obj.quan = cnt_p[0];
                sprintf(qbuf, _("%s %s "), (next_encumbr >= EXT_ENCUMBER) ? overloadpfx
                        : (next_encumbr >= HVY_ENCUMBER) ? nearloadpfx
                          : (next_encumbr >= MOD_ENCUMBER) ? moderateloadpfx
                            : slightloadpfx, !container ? _("lifting") : _("removing"))

;
                safe_qbuf(qbuf, qbuf, _(".  Continue?"), obj, doname,
                                 ansimpleoname, something());
                obj.quan = savequan;
                switch (ynq(qbuf)) {
                case ord('q'):
                    result = -1;
                    break;
                case ord('n'):
                    result = 0;
                    break;
                default:
                    break; /* 'y' => result == 1 */
                }
                clear_nhwindow()(WIN_MESSAGE);
            }
        }
    }

    if (obj.otyp == SCR_SCARE_MONSTER && result <= 0 && !container)
        obj.spe = 0;
    return result;
    } finally { stack_pop($frame); }
}

/*
 * Pick up <count> of obj from the ground and add it to the hero's inventory.
 * Returns -1 if caller should break out of its loop, 0 if nothing picked
 * up, 1 if otherwise.
 */
export function pickup_object(
    obj,
    count$,
    telekinesis) { /* int */ /* not picking it up directly by hand */
    const $frame = stack_frame(); try {
    const count = stack_var(long, count$);
    let res;

    if (obj.quan < count[0]) {
        impossible(_("pickup_object: count %lld > quan %lld?"), count[0], obj.quan);
        return 0;
    }

    /* In case of auto-pickup, where we haven't had a chance
       to look at it yet; affects docall(SCR_SCARE_MONSTER). */
    if (!Blind())
        observe_object(obj);

    if (obj == uchain) { /* do not pick up attached chain */
        return 0;
    } else if (obj.where == OBJ_MINVENT && obj.owornmask != 0
               && (u.uswallow && (u.ustuck == (obj.v.v_ocarry)))) {
        You_cant(_("pick %s up."), ysimple_name(obj));
        return 0;
    } else if (obj.oartifact && !touch_artifact(obj, gy.youmonst)) {
        return 0;
    } else if (obj.otyp == CORPSE) {
        if (fatal_corpse_mistake(obj, telekinesis)
            || rider_corpse_revival(obj, telekinesis))
            return -1;
    } else if (obj.otyp == SCR_SCARE_MONSTER) {
        let old_wt = stack_var(int), new_wt = stack_var(int);

        /* process a count before altering/deleting scrolls;
           tricky because being unable to lift full stack imposes an
           implicit count; unliftable ones should be treated as if
           the count excluded them so that they don't change state */
        if ((count[0] = carry_count(obj, null,
                                 count[0] ? count[0] : obj.quan,
                                 FALSE, old_wt, new_wt)) < 1)
            return -1; /* couldn't even pick up 1, so effectively untouched */
        /* all current callers handle a new object sanely when traversing
           a list; other half of a split will be left as-is and whatever
           already follows 'obj' will still be processed next */
        if (count[0] > 0 && count[0] < obj.quan)
            obj = splitobj(obj, count[0]);

        if (obj.blessed) {
            unbless(obj);
        } else if (!obj.spe && !obj.cursed) {
            obj.spe = 1;
        } else {
            pline_The(_("scroll%s %s to dust as you %s %s up."), plur(obj.quan),
                      otense(obj, _("turn")), telekinesis ? _("raise") : _("pick"),
                      (obj.quan == 1) ? _("it") : _("them"));
            trycall(obj);
            useupf(obj, obj.quan);
            return 1; /* tried to pick something up and failed, but
                         don't want to terminate pickup loop yet   */
        }
    }

    /* obj has either already passed autopick_testobj or we are explicitly
       picking it off the floor, so addinv() will override obj->how_lost;
       otherwise we couldn't pick up a thrown, stolen, or dropped item that
       was split off from a carried stack even while still carrying the
       rest of the stack unless we have at least one free slot available */
    res = lift_object(obj, null, count, telekinesis);
    if (res <= 0)
        return res;

    /* What's left of the special case for gold :-) */
    if (obj.oclass == COIN_CLASS)
        disp.botl = TRUE;
    if (obj.quan != count[0] && obj.otyp != LOADSTONE)
        obj = splitobj(obj, count[0]);

    obj = pick_obj(obj);

    if (uwep && uwep == obj)
        gm.mrg_to_wielded = TRUE;
    pickup_prinv(obj, count[0], _("lifting"));
    if (obj.ghostly)
        fix_ghostly_obj(obj);
    gm.mrg_to_wielded = FALSE;
    return 1;
    } finally { stack_pop($frame); }
}

/*
 * Do the actual work of picking otmp from the floor or monster's interior
 * and putting it in the hero's inventory.  Take care of billing.  Return a
 * pointer to the object where otmp ends up.  This may be different
 * from otmp because of merging.
 */
export function pick_obj(otmp) { /* struct obj * */
    const $frame = stack_frame(); try {
    let result;
    let ox = stack_var(coordxy), oy = stack_var(coordxy);
    let robshop, fromfloor = +(otmp.where == OBJ_FLOOR);

    /* otmp is either on the floor or in an engulfer's inventory; for the
       latter, its <ox,oy> probably won't be set */
    get_obj_location(otmp, ox, oy, 0);

    robshop = (!u.uswallow && otmp != uball && costly_spot(ox[0], oy[0]) ? 1 : 0);
    obj_extract_self(otmp);
    if (fromfloor)
        newsym(ox[0], oy[0]);

    /* for shop items, addinv() needs to be after addtobill() (so that
       object merger can take otmp->unpaid into account) but before
       remote_robbery() (which calls rob_shop() which calls setpaid()
       after moving costs of unpaid items to shop debt; setpaid()
       calls clear_unpaid() for lots of object chains, but 'otmp' isn't
       on any of those between obj_extract_self() and addinv(); for
       3.6.0, 'otmp' remained flagged as an unpaid item in inventory
       and triggered impossible() every time inventory was examined) */
    if (robshop) {
        let saveushops = stack_array(char, 5), fakeshop = stack_array(char, 2);

        /* addtobill cares about your location rather than the object's;
           usually they'll be the same, but not when using telekinesis
           (if ever implemented) or a grappling hook */
        strcpy(saveushops, u.ushops);
        chars[fakeshop + 0] = chars[in_rooms(ox[0], oy[0], SHOPBASE)];
        chars[fakeshop + 1] = ord('\0');
        strcpy(u.ushops, fakeshop);
        /* sets obj->unpaid if necessary */
        addtobill(otmp, TRUE, FALSE, FALSE);
        strcpy(u.ushops, saveushops);
        robshop = (otmp.unpaid && !strchr(u.ushops, chars[fakeshop]) ? 1 : 0);
    }

    result = addinv(otmp);
    /* if you're taking a shop item from outside the shop, make shk notice */
    if (robshop)
        remote_burglary(ox[0], oy[0]);

    return result;
    } finally { stack_pop($frame); }
}

/* pickup_object()/out_container() helper;
   print an added-to-invent message for current object, limiting feedback
   about encumbrance to the first item which causes that to change */
function pickup_prinv(
    obj,
    count,
    verb) { /* void */
    const $frame = stack_frame(); try {
    let pbuf = stack_array(char, QBUFSZ);
    let prefix;
    let nearload = near_capacity();

    chars[pbuf + 0] = ord('\0');
    if (nearload == gp.pickup_encumbrance) {
        prefix = 0;
    } else {
        prefix = (nearload >= EXT_ENCUMBER) ? overloadpfx
                 : (nearload >= HVY_ENCUMBER) ? nearloadpfx
                   : (nearload >= MOD_ENCUMBER) ? moderateloadpfx
                     : (nearload >= SLT_ENCUMBER) ? slightloadpfx
                       : 0;
        gp.pickup_encumbrance = nearload;
    }
    if (prefix)
        sprintf(pbuf, _("%s %s"), prefix, verb);

    prinv(pbuf, obj, count);
    } finally { stack_pop($frame); }
}

/*
 * prints a message if encumbrance changed since the last check
 */
export function encumber_msg() { /* void */
    let newcap = near_capacity();

    if (go.oldcap < newcap) {
        switch (newcap) {
        case 1:
            Your(_("movements are slowed slightly because of your load."));
            break;
        case 2:
            You(_("rebalance your load.  Movement is difficult."));
            break;
        case 3:
            You(_("%s under your heavy load.  Movement is very hard."),
                stagger(gy.youmonst.data, _("stagger")));
            break;
        default:
            You(_("%s move a handspan with this load!"),
                newcap == 4 ? _("can barely") : _("can't even"));
            break;
        }
        disp.botl = TRUE;
    } else if (go.oldcap > newcap) {
        switch (newcap) {
        case 0:
            Your(_("movements are now unencumbered."));
            break;
        case 1:
            Your(_("movements are only slowed slightly by your load."));
            break;
        case 2:
            You(_("rebalance your load.  Movement is still difficult."));
            break;
        case 3:
            You(_("%s under your load.  Movement is still very hard."),
                stagger(gy.youmonst.data, _("stagger")));
            break;
        }
        disp.botl = TRUE;
    }

    go.oldcap = newcap;
}

/* Is there a container at x,y. Optional: return count of containers at x,y */
export function container_at(x, y, countem) { /* int */
    let cobj, nobj;
    let container_count = 0;

    for (cobj = svl.level.objects[x][y]; cobj; cobj = nobj) {
        nobj = cobj.v.v_nexthere;
        if (Is_container(cobj)) {
            container_count++;
            if (!countem)
                break;
        }
    }
    return container_count;
}

function able_to_loot(
    x, y,
    looting) { /* boolean */ /* loot vs tip */
    let verb = looting ? _("loot") : _("tip");
    let t = t_at(x, y);

    if (!can_reach_floor((t && is_pit(t.ttyp) ? 1 : 0))) {
        if (u.usteed && P_SKILL(P_RIDING) < P_BASIC)
            rider_cant_reach(); /* not skilled enough to reach */
        else
            cant_reach_floor(x, y, FALSE, TRUE, FALSE);
        return FALSE;
    } else if ((is_pool(x, y) && (looting || !Underwater())) || is_lava(x, y)) {
        /* at present, can't loot in water even when Underwater;
           can tip underwater, but not when over--or stuck in--lava */
        You(_("cannot %s things that are deep in the %s."), verb,
            hliquid(is_lava(x, y) ? _("lava") : _("water")));
        return FALSE;
    } else if (nolimbs(gy.youmonst.data)) {
        pline(_("Without limbs, you cannot %s anything."), verb);
        return FALSE;
    } else if (looting && !freehand()) {
        pline(_("Without a free %s, you cannot loot anything."),
              body_part(HAND));
        return FALSE;
    }
    return TRUE;
}

function mon_beside(x, y) { /* boolean */
    let i, j;
    let nx, ny;

    for (i = -1; i <= 1; i++)
        for (j = -1; j <= 1; j++) {
            nx = x + i;
            ny = y + j;
            if (isok(nx, ny) && MON_AT(nx, ny))
                return TRUE;
        }
    return FALSE;
}

function do_loot_cont(
    cobjp,
    cindex,
    ccount) { /* int */ /* ...number of them (N) */
    let cobj = cobjp[0];

    if (!cobj)
        return ECMD_OK;
    if (cobj.olocked) {
        let res = ECMD_OK;

        if (cobj.lknown)
            pline(_("%s is locked."), The(xname(cobj)));
        else
            pline(_("Hmmm, %s turns out to be locked."), the(xname(cobj)));
        cobj.lknown = 1;

        if (flags.autounlock) {
            let otmp, unlocktool = null;
            let ox = cobj.ox, oy = cobj.oy;

            u.dz = 0; /* might be non-zero from previous command since
                       * #loot isn't a move command; pick_lock() cares */
            /* if both the untrap and apply_key bits are set, untrap
               attempt will be performed first but we need to set up
               unlocktool in case "check for trap?" is declined */
            if (((flags.autounlock & AUTOUNLOCK_APPLY_KEY) != 0
                 && (unlocktool = autokey(TRUE)) != null)
                || (flags.autounlock & AUTOUNLOCK_UNTRAP) != 0) {
                /* pass ox and oy to avoid direction prompt */
                if (pick_lock(unlocktool, ox, oy, cobj))
                    res = ECMD_TIME;
                /* attempting to untrap or unlock might trigger a trap
                   which destroys 'cobj'; inform caller if that happens */
                for (otmp = svl.level.objects[ox][oy]; otmp;
                     otmp = otmp.v.v_nexthere)
                    if (otmp == cobj)
                        break;
                if (!otmp)
                    cobjp[0] = null;
                return res;
            }
            if ((flags.autounlock & AUTOUNLOCK_FORCE) != 0
                && res != ECMD_TIME
                && ccount == 1 && u_have_forceable_weapon()) {
                /* single container, and we could #force it open... */
                /* note: doforce asks for confirmation */
                cmdq_add_ec(CQ_CANNED, doforce);
                ga.abort_looting = TRUE;
            }
        }
        return res;
    }
    cobj.lknown = 1; /* floor container, so no need for update_inventory() */

    if (cobj.otyp == BAG_OF_TRICKS) {
        let tmp;

        You(_("carefully open %s..."), the(xname(cobj)));
        pline(_("It develops a huge set of teeth and bites you!"));
        tmp = rnd(10);
        losehp(Maybe_Half_Phys(tmp), _("carnivorous bag"), KILLED_BY_AN);
        makeknown(BAG_OF_TRICKS);
        ga.abort_looting = TRUE;
        return ECMD_TIME;
    }
    return use_container(cobjp, FALSE, (+(cindex < ccount)));
}

/* #loot extended command */
export function doloot() { /* int */
    let res;

    gl.loot_reset_justpicked = TRUE;
    res = doloot_core();
    gl.loot_reset_justpicked = FALSE;
    return res;
}

/* loot a container on the floor or loot saddle from mon. */
function doloot_core() { /* int */
    const $frame = stack_frame(); try {
    let $goto = null; var cobj = stack_var(ptr_to(struct_obj)), cc = stack_struct(struct_nhcoord), prev_inquiry = stack_var(int), prev_loot = stack_var(boolean), any = stack_struct(struct_any), pick_list = stack_var(ptr_to(struct_mi));
    var nobj;
    var c = -1;
    var timepassed = 0;

    var underfoot = TRUE;
    var dont_find_anything = _("don't find anything");
    var mtmp;
    prev_inquiry[0] = 0;
    prev_loot[0] = FALSE;
    var num_conts = 0;
    var clr = NO_COLOR;

    ga.abort_looting = FALSE;

    if (check_capacity(0)) {
        /* "Can't do that while carrying so much stuff." */
        return ECMD_OK;
    }
    if (nohands(gy.youmonst.data)) {
        You(_("have no hands!")); /* not `body_part(HAND)' */
        return ECMD_OK;
    }
    if (Confusion()) {
        if (rn2(6) && reverse_loot())
            return ECMD_TIME;
        if (rn2(2)) {
            pline(_("Being confused, you find nothing to loot."));
            return ECMD_TIME; /* costs a turn */
        }             /* else fallthrough to normal looting */
    }
    cc.x = u.ux;
    cc.y = u.uy;

    $goto_lootcont: for (;;) { switch ($goto) { default: if (iflags.menu_requested)
        { $goto = "lootmon"; continue $goto_lootcont; };

 case "lootcont": $goto = null;
    if ((num_conts = container_at(cc.x, cc.y, TRUE)) > 0) {
        var anyfound = FALSE;

        if (!able_to_loot(cc.x, cc.y, TRUE))
            return ECMD_OK;

        if (Blind() && !uarmg) {
            /* if blind and without gloves, attempting to #loot at the
               location of a cockatrice corpse is fatal before asking
               whether to manipulate any containers */
            for (nobj = sobj_at(CORPSE, cc.x, cc.y); nobj;
                 nobj = nxtobj(nobj, CORPSE, TRUE))
                if (will_feel_cockatrice(nobj, FALSE)) {
                    feel_cockatrice(nobj, FALSE);
                    /* if life-saved (or poly'd into stone golem),
                       terminate attempt to loot */
                    return ECMD_TIME;
                }
        }

        if (num_conts > 1) {
            /* use a menu to loot many containers */
            var n, i;
            var win;

            pick_list[0] = null;

            any.a_void = 0;
            win = create_nhwindow()(NHW_MENU);
            start_menu()(win, MENU_BEHAVE_STANDARD);

            for (cobj[0] = svl.level.objects[cc.x][cc.y]; cobj[0];
                 cobj[0] = cobj[0].v.v_nexthere)
                if (Is_container(cobj[0])) {
                    any.a_obj = cobj[0];
                    add_menu(win, nul_glyphinfo, any, 0, 0, ATR_NONE, clr,
                             doname(cobj[0]), MENU_ITEMFLAGS_NONE);
                }
            end_menu()(win, _("Loot which containers?"));
            n = select_menu(win, PICK_ANY, pick_list);
            destroy_nhwindow()(win);

            if (n > 0) {
                for (i = 1; i <= n; i++) {
                    cobj[0] = ptr_add(pick_list[0], i - 1).item.a_obj;
                    timepassed |= do_loot_cont(cobj, i, n);
                    if (ga.abort_looting) {
                        /* chest trap or magic bag explosion or <esc> */
                        free(addr_of(pick_list[0]));
                        return (timepassed ? ECMD_TIME : ECMD_OK);
                    }
                }
                free(addr_of(pick_list[0]));
            }
            if (n != 0)
                c = ord('y');
        } else {
            for (cobj[0] = svl.level.objects[cc.x][cc.y]; cobj[0]; cobj[0] = nobj) {
                nobj = cobj[0].v.v_nexthere;

                if (Is_container(cobj[0])) {
                    anyfound = TRUE;
                    timepassed |= do_loot_cont(cobj, 1, 1);
                    if (ga.abort_looting)
                        /* chest trap or magic bag explosion or <esc> */
                        return (timepassed ? ECMD_TIME : ECMD_OK);
                }
            }
            if (anyfound)
                c = ord('y');
        }
    } else if (IS_GRAVE(levl()[cc.x][cc.y].typ)) {
        You(_("need to dig up the grave to effectively loot it..."));
    }

    /*
     * 3.3.1 introduced directional looting for some things.
     */
 case "lootmon": $goto = null;
    if (c != ord('y') && (mon_beside(u.ux, u.uy) || iflags.menu_requested)) {
        var looted_mon = FALSE;
        if (!get_adjacent_loc(_("Loot in what direction?"),
                              _("Invalid loot location"), u.ux, u.uy, cc))
            return ECMD_OK;
        underfoot = u_at(cc.x, cc.y);
        if (underfoot && container_at(cc.x, cc.y, FALSE))
            { $goto = "lootcont"; continue $goto_lootcont; };
        if (u.dz < 0) {
            You(_("%s to loot on the %s."), dont_find_anything,
                ceiling(cc.x, cc.y));
            return ECMD_TIME;
        }
        mtmp = m_at(cc.x, cc.y);
        if (mtmp) {
            timepassed = loot_mon(mtmp, prev_inquiry, addr_of(prev_loot));
            if (timepassed)
                looted_mon = TRUE;
        }
        /* always use a turn when choosing a direction is impaired,
           even if you've successfully targeted a saddled creature
           and then answered "no" to the "remove its saddle?" prompt */
        if (Confusion() || Stunned())
            timepassed = 1;

        /* Preserve pre-3.3.1 behavior for containers.
         * Adjust this if-block to allow container looting
         * from one square away to change that in the future.
         */
        if (!looted_mon) {
            if (!underfoot && container_at(cc.x, cc.y, FALSE)) {
                if (mtmp) {
                    You_cant(_("loot anything %sthere with %s in the way."),
                             prev_inquiry[0] ? _("else ") : _(""), mon_nam(mtmp));
                    return (timepassed ? ECMD_TIME : ECMD_OK);
                } else {
                    You(_("have to be at a container to loot it."));
                }
            } else {
                You(_("%s %s%shere to loot."), dont_find_anything,
                    (prev_inquiry[0] || prev_loot[0]) ? _("else ") : _(""),
                    !underfoot ? _("t") : _(""));
                return (timepassed ? ECMD_TIME : ECMD_OK);
            }
        }
    } else if (c != ord('y') && c != ord('n')) {
        You(_("%s %s to loot."), dont_find_anything,
            underfoot ? _("here") : _("there"));
    } } break; }
    return (timepassed ? ECMD_TIME : ECMD_OK);
    } finally { stack_pop($frame); }
}

/* called when attempting to #loot while confused */
function reverse_loot() { /* boolean */
    const $frame = stack_frame(); try {
    let goldob = null, coffers, otmp, boxdummy = stack_struct(struct_obj);
    let mon;
    let contribution;
    let n, x = u.ux, y = u.uy;

    if (!rn2(3)) {
        /* n objects: 1/(n+1) chance per object, 1/(n+1) to fall off end */
        for (n = inv_cnt(TRUE), otmp = gi.invent; otmp;
             --n, otmp = otmp.nobj)
            if (!rn2(n + 1)) {
                prinv(_("You find old loot:"), otmp, 0);
                return TRUE;
            }
        return FALSE;
    }

    /* find a money object to mess with */
    for (goldob = gi.invent; goldob; goldob = goldob.nobj)
        if (goldob.oclass == COIN_CLASS) {
            contribution = Math.trunc((rnd(5) * goldob.quan + 4) / 5);
            if (contribution < goldob.quan)
                goldob = splitobj(goldob, contribution);
            break;
        }
    if (!goldob)
        return FALSE;

    /* gold might be quivered; dropping would un-wear it, but freeinv()
       expects caller to do that; do so now */
    remove_worn_item(goldob, FALSE);

    if (!IS_THRONE(levl()[x][y].typ)) {
        dropx(goldob);
        /* the dropped gold might have fallen to lower level */
        if (g_at(x, y))
            pline(_("Ok, now there is loot here."));
    } else {
        /* find original coffers chest if present, otherwise use nearest */
        otmp = null;
        for (coffers = fobj(); coffers; coffers = coffers.nobj)
            if (coffers.otyp == CHEST) {
                if (coffers.spe == 2)
                    break; /* a throne room chest */
                if (!otmp || (distu(coffers.ox, coffers.oy)
                              < distu(otmp.ox, otmp.oy)))
                    otmp = coffers; /* remember closest ordinary chest */
            }
        if (!coffers)
            coffers = otmp;

        if (coffers) {
                  ;
            verbalize(_("Thank you for your contribution to reduce the debt."));
            freeinv(goldob);
            add_to_container(coffers, goldob);
            coffers.owt = unsigned(weight(coffers));
            coffers.cknown = 0;
            if (!coffers.olocked) {
                struct_assign(boxdummy, cg.zeroobj), boxdummy.otyp = SPE_WIZARD_LOCK;
                boxlock(coffers, boxdummy);
            }
        } else if (levl()[x][y].flags != T_LOOTED
                   && (mon = makemon(courtmon(), x, y, NO_MM_FLAGS)) != null) {
            freeinv(goldob);
            add_to_minv(mon, goldob);
            pline(_("The exchequer accepts your contribution."));
            if (!rn2(10))
                levl()[x][y].flags = T_LOOTED;
        } else {
            You(_("drop %s."), doname(goldob));
            dropx(goldob);
        }
    }
    return TRUE;
    } finally { stack_pop($frame); }
}

/* loot_mon() returns amount of time passed.
 */
export function loot_mon(mtmp, passed_info, prev_loot) { /* int */
    const $frame = stack_frame(); try {
    let c = -1;
    let timepassed = 0;
    let otmp;
    let qbuf = stack_array(char, QBUFSZ);

    /* 3.3.1 introduced the ability to remove saddle from a steed.
     *  *passed_info is set to TRUE if a loot query was given.
     *  *prev_loot is set to TRUE if something was actually acquired in here.
     */
    if (mtmp && mtmp != u.usteed && (otmp = which_armor(mtmp, W_SADDLE))) {
        if (passed_info)
            passed_info[0] = 1;
        sprintf(qbuf, _("Do you want to remove the saddle from %s?"), x_monnam(mtmp, ARTICLE_THE, 0,
                         SUPPRESS_SADDLE, FALSE))
;
        if ((c = yn_function(qbuf, ynqchars, ord('n'), TRUE)) == ord('y')) {
            if (nolimbs(gy.youmonst.data)) {
                You_cant(_("do that without limbs.")); /* not body_part(HAND) */
                return 0;
            }
            if (otmp.cursed) {
                You(_("can't.  The saddle seems to be stuck to %s."),
                    x_monnam(mtmp, ARTICLE_THE, 0,
                             SUPPRESS_SADDLE, FALSE));
                /* the attempt costs you time */
                return 1;
            }
            extract_from_minvent(mtmp, otmp, TRUE, FALSE);
            if (flags.verbose)
                You(_("take %s off of %s."),
                    thesimpleoname(otmp), mon_nam(mtmp));
            otmp = hold_another_object(otmp, _("You drop %s!"), doname(otmp),
                                       0);
            (otmp);
            timepassed = rnd(3);
            if (prev_loot)
                chars[prev_loot] = TRUE;
        } else if (c == ord('q')) {
            return 0;
        }
    }
    /* 3.4.0 introduced ability to pick things up from swallower's stomach */
    if (u.uswallow) {
        let count = passed_info ? passed_info[0] : 0;

        timepassed = pickup(count);
    }
    return timepassed;
    } finally { stack_pop($frame); }
}

/*
 * Decide whether an object being placed into a magic bag will cause
 * it to explode.  If the object is a bag itself, check recursively.
 */
function mbag_explodes(obj, depthin) { /* boolean */
    /* these won't cause an explosion when they're empty */
    if ((obj.otyp == WAN_CANCELLATION || obj.otyp == BAG_OF_TRICKS)
        && obj.spe <= 0)
        return FALSE;

    /* odds: 1/1, 2/2, 3/4, 4/8, 5/16, 6/32, 7/64, 8/128, 9/128, 10/128,... */
    if ((Is_mbag(obj) || obj.otyp == WAN_CANCELLATION)
        && (rn2(1 << (depthin > 7 ? 7 : depthin)) <= depthin))
        return TRUE;
    else if (Has_contents(obj)) {
        let otmp;

        for (otmp = obj.cobj; otmp; otmp = otmp.nobj)
            if (mbag_explodes(otmp, depthin + 1))
                return TRUE;
    }
    return FALSE;
}

function is_boh_item_gone() { /* boolean */
    return (+!rn2(13));
}

/* Scatter most of Bag of holding contents around.  Some items will be
   destroyed with the same chance as looting a cursed bag. */
function do_boh_explosion(boh, on_floor) { /* void */
    let otmp, nobj;

    boh.in_use = 1; /* in case scatter() leads to bones creation */
    for (otmp = boh.cobj; otmp; otmp = nobj) {
        nobj = otmp.nobj;
        if (is_boh_item_gone()) {
            obj_extract_self(otmp);
            mbag_item_gone(+!on_floor, otmp, TRUE);
        } else {
            otmp.ox = u.ux, otmp.oy = u.uy;
            scatter(u.ux, u.uy, 4, MAY_HIT | MAY_DESTROY, otmp);
        }
    }
    /* boh is about to be deleted so no need to reset its in_use flag here */
}

function boh_loss(container, held) { /* long long */
    /* sometimes toss objects if a cursed magic bag */
    if (Is_mbag(container) && container.cursed && Has_contents(container)) {
        let loss = 0;
        let curr, otmp;

        for (curr = container.cobj; curr; curr = otmp) {
            otmp = curr.nobj;
            if (is_boh_item_gone()) {
                obj_extract_self(curr);
                loss += mbag_item_gone(held, curr, FALSE);
            }
        }
        return loss;
    }
    return 0;
}

/* Returns: -1 to stop, 1 item was inserted, 0 item was not inserted. */
function in_container(obj) { /* int */
    const $frame = stack_frame(); try {
    let floor_container = +!carried(gc.current_container);
    let was_unpaid = FALSE;
    let buf = stack_array(char, BUFSZ);

    if (!gc.current_container) {
        impossible(_("<in> no gc.current_container?"));
        return 0;
    } else if (obj == uball || obj == uchain) {
        You(_("must be kidding."));
        return 0;
    } else if (obj == gc.current_container) {
        pline(_("That would be an interesting topological exercise."));
        return 0;
    } else if (obj.owornmask & (W_ARMOR | W_ACCESSORY)) {
        Norep(_("You cannot %s %s you are wearing."),
              Icebox() ? _("refrigerate") : _("stash"), something());
        return 0;
    } else if ((obj.otyp == LOADSTONE) && obj.cursed) {
        set_bknown(obj, 1);
        pline_The(_("stone%s won't leave your person."), plur(obj.quan));
        return 0;
    } else if (obj.otyp == AMULET_OF_YENDOR
               || obj.otyp == CANDELABRUM_OF_INVOCATION
               || obj.otyp == BELL_OF_OPENING
               || obj.otyp == SPE_BOOK_OF_THE_DEAD) {
        /* Prohibit Amulets in containers; if you allow it, monsters can't
         * steal them.  It also becomes a pain to check to see if someone
         * has the Amulet.  Ditto for the Candelabrum, the Bell and the Book.
         */
        pline(_("%s cannot be confined in such trappings."), The(xname(obj)));
        return 0;
    } else if (obj.otyp == LEASH && obj.corpsenm != 0) {
        pline(_("%s attached to your pet."), Tobjnam(obj, _("are")));
        return 0;
    } else if (obj == uwep) {
        if (welded(obj)) {
            weldmsg(obj);
            return 0;
        }
        setuwep(null);
        /* This uwep check is obsolete.  It dates to 3.0 and earlier when
         * unwielding Firebrand would be fatal in hell if hero had no other
         * fire resistance.  Life-saving would force it to be re-wielded.
         */
        if (uwep)
            return 0; /* unwielded, died, rewielded */
    } else if (obj == uswapwep) {
        setuswapwep(null);
    } else if (obj == uquiver) {
        setuqwep(null);
    }

    if (fatal_corpse_mistake(obj, FALSE))
        return -1;

    /* boxes, boulders, and big statues can't fit into any container */
    if (obj.otyp == ICE_BOX || Is_box(obj) || obj.otyp == BOULDER
        || (obj.otyp == STATUE && bigmonst(mons[obj.corpsenm]))) {
        /* consumes multiple obufs but not enough to overwrite the result */
        strcpy(buf, the(xname(obj)));
        You(_("cannot fit %s into %s."), buf, the(xname(gc.current_container)));
        return 0;
    }

    freeinv(obj);

    if (obj_is_burning(obj)) /* this used to be part of freeinv() */
        snuff_lit(obj);

    if (floor_container && costly_spot(u.ux, u.uy)) {
        /* defer gold until after put-in message */
        if (obj.oclass != COIN_CLASS) {
            /* sellobj() will take an unpaid item off the shop bill */
            was_unpaid = obj.unpaid ? TRUE : FALSE;
            if (gs.sellobj_first) {
                /* don't sell when putting the item into your own container,
                   but handle billing correctly */
                sellobj_state(gc.current_container.no_charge
                              ? SELL_DONTSELL : SELL_DELIBERATE);
                gs.sellobj_first = FALSE;
            }
            sellobj(obj, u.ux, u.uy);
        }
    }
    if (Icebox() && !age_is_relative(obj)) {
        obj.age = svm.moves - obj.age; /* actual age */
        /* stop any corpse timeouts when frozen */
        if (obj.otyp == CORPSE) {
            if (obj.timed) {
                stop_timer(ROT_CORPSE, obj_to_any(obj));
                stop_timer(REVIVE_MON, obj_to_any(obj));
            }
            /* if this is the corpse of a cancelled ice troll, uncancel it */
            if (obj.corpsenm == PM_ICE_TROLL && has_omonst(obj))
                OMONST(obj).mcan = 0;
        } else if (obj.globby && obj.timed) {
            stop_timer(SHRINK_GLOB, obj_to_any(obj));
        }
    } else if (Is_mbag(gc.current_container) && mbag_explodes(obj, 0)) {
        livelog_printf(LL_ACHIEVE, _("just blew up %s bag of holding"), uhis());
        /* explicitly mention what item is triggering the explosion */
        urgent_pline(
              _("As you put %s inside, you are blasted by a magical explosion!"),
                     doname(obj));
        /* did not actually insert obj yet */
        if (was_unpaid)
            addtobill(obj, FALSE, FALSE, TRUE);
        if (obj.otyp == BAG_OF_HOLDING) /* one bag of holding into another */
            do_boh_explosion(obj, (+(obj.where == OBJ_FLOOR)));
        obfree(obj, null);
        /* if carried, shop goods will be flagged 'unpaid' and obfree() will
           handle bill issues, but if on floor, we need to put them on bill
           before deleting them (non-shop items will be flagged 'no_charge')*/
        if (floor_container && costly_spot(gc.current_container.ox,
                                           gc.current_container.oy)) {
            let save_no_charge = stack_struct(struct_obj);

            save_no_charge.no_charge = gc.current_container.no_charge;
            addtobill(gc.current_container, FALSE, FALSE, FALSE);
            /* addtobill() clears no charge; we need to set it back
               so that useupf() doesn't double bill */
            gc.current_container.no_charge = save_no_charge.no_charge;
        }
        do_boh_explosion(gc.current_container, floor_container);

        if (!floor_container)
            useup(gc.current_container);
        else if (obj_here(gc.current_container, u.ux, u.uy))
            useupf(gc.current_container, gc.current_container.quan);
        else
            panic(_("in_container:  bag not found."));

        losehp(d(6, 6), _("magical explosion"), KILLED_BY_AN);
        gc.current_container = null; /* baggone = TRUE; */
    }

    if (gc.current_container) {
        strcpy(buf, the(xname(gc.current_container)));
        You(_("put %s into %s."), doname(obj), buf);

        /* gold in container always needs to be added to credit */
        if (floor_container && obj.oclass == COIN_CLASS)
            sellobj(obj, gc.current_container.ox, gc.current_container.oy);
        add_to_container(gc.current_container, obj);
        gc.current_container.owt = unsigned(weight(gc.current_container));
    }
    /* gold needs this, and freeinv() many lines above may cause
     * the encumbrance to disappear from the status, so just always
     * update status immediately.
     */
    bot();
    return (gc.current_container ? 1 : -1);
    } finally { stack_pop($frame); }
}

/* askchain() filter used by in_container();
 * returns True if the container is intact and 'obj' isn't it, False if
 * container is gone (magic bag explosion) or 'obj' is the container itself;
 * also used by getobj() when picking a single item to stash
 */
export function ck_bag(obj) { /* int */
    return (gc.current_container && obj != gc.current_container ? 1 : 0);
}

/* Returns: -1 to stop, 1 item was removed, 0 item was not removed. */
function out_container(obj) { /* int */
    const $frame = stack_frame(); try {
    let otmp;
    let res;
    let count = stack_var(long);
    let is_gold = +(obj.oclass == COIN_CLASS);

    if (!gc.current_container) {
        impossible(_("<out> no gc.current_container?"));
        return -1;
    } else if (is_gold) {
        obj.owt = unsigned(weight(obj));
    }

    if (obj.oartifact && !touch_artifact(obj, gy.youmonst))
        return 0;

    if (fatal_corpse_mistake(obj, FALSE))
        return -1;

    count[0] = obj.quan;
    if ((res = lift_object(obj, gc.current_container, count, FALSE)) <= 0)
        return res;

    if (obj.quan != count[0] && obj.otyp != LOADSTONE)
        obj = splitobj(obj, count[0]);

    /* Remove the object from the list. */
    obj_extract_self(obj);
    gc.current_container.owt = unsigned(weight(gc.current_container));

    if (Icebox())
        removed_from_icebox(obj);

    if (!obj.unpaid && !carried(gc.current_container)
        && costly_spot(gc.current_container.ox, gc.current_container.oy)) {
        obj.ox = gc.current_container.ox;
        obj.oy = gc.current_container.oy;
        addtobill(obj, FALSE, FALSE, FALSE);
    }
    if (is_pick(obj))
        pick_pick(obj); /* shopkeeper feedback */

    otmp = addinv(obj);
    pickup_prinv(otmp, count[0], _("removing"));

    if (is_gold) {
        bot(); /* update character's gold piece count immediately */
    }
    return 1;
    } finally { stack_pop($frame); }
}

/* taking a corpse out of an ice box needs a couple of adjustments */
export function removed_from_icebox(obj) { /* void */
    if (!age_is_relative(obj)) {
        obj.age = svm.moves - obj.age; /* actual age */
        if (obj.otyp == CORPSE) {
            let m = get_mtraits(obj, FALSE);
            let iceT = m ? +(m.data == mons[PM_ICE_TROLL])
                             : +(obj.corpsenm == PM_ICE_TROLL);

            /* start a revive timer if this corpse is for an ice troll,
               otherwise start a rot-away timer (even for other trolls) */
            obj.oeroded2 = iceT ? 0 : 1;
            start_corpse_timeout(obj);
        } else if (obj.globby) {
            /* non-frozen globs gradually shrink away to nothing */
            start_glob_timeout(obj, 0);
        }
    }
}

/* an object inside a cursed bag of holding is being destroyed */
function mbag_item_gone(held, item, silent) { /* long long */
    let shkp;
    let loss = 0;

    if (!silent) {
        if (item.dknown)
            pline(_("%s %s vanished!"), Doname2(item), otense(item, _("have")));
        else
            You(_("%s %s disappear!"), Blind() ? _("notice") : _("see"), doname(item));
    }

    if (chars[u.ushops] && (shkp = shop_keeper(chars[u.ushops])) != null) {
        if (held ? item.unpaid : costly_spot(u.ux, u.uy))
            loss = stolen_value(item, u.ux, u.uy, shkp.mpeaceful,
                                TRUE);
    }
    obfree(item, null);
    return loss;
}

/* used for #loot/apply, #tip, and final disclosure */
export function observe_quantum_cat(box, makecat, givemsg) { /* void */
    const $frame = stack_frame(); try {
    let sc = init_string(static_array("observe_quantum_cat.sc", char, sizeof_string("Schroedinger's Cat")), _("Schroedinger's Cat"), true);
    let deadcat;
    let livecat = null;
    let ox = stack_var(coordxy), oy = stack_var(coordxy);
    let itsalive = +!rn2(2);

    if (get_obj_location(box, ox, oy, 0))
        box.ox = ox[0], box.oy = oy[0]; /* in case it's being carried */

    /* this isn't really right, since any form of observation
       (telepathic or monster/object/food detection) ought to
       force the determination of alive vs dead state; but basing it
       just on opening or disclosing the box is much simpler to cope with */

    /* SchroedingersBox already has a cat corpse in it */
    deadcat = box.cobj;
    if (itsalive) {
        if (makecat)
            livecat = makemon(mons[PM_HOUSECAT], box.ox, box.oy,
                              NO_MINVENT | MM_ADJACENTOK | MM_NOMSG);
        if (livecat) {
            livecat.mpeaceful = 1;
            set_malign(livecat);
            if (givemsg) {
                if (!canspotmon(livecat))
                    You(_("think %s brushed your %s."), something(),
                        body_part(FOOT));
                else
                    pline(_("%s inside the box is still alive!"),
                          Monnam(livecat));
            }
            christen_monst(livecat, sc);
            if (deadcat) {
                obj_extract_self(deadcat);
                obfree(deadcat, null), deadcat = null;
            }
            box.owt = unsigned(weight(box));
            box.spe = 0;

            if (!svc.context.mon_moving) {
                /* give experience points for releasing live cat; slightly
                   different amount from what is given for "killing" it */
                more_experienced(10, 20); /* 10:current exp; 20:score bonus */
                newexplevel();
            }
        }
    } else {
        box.spe = 0; /* now an ordinary box (with a cat corpse inside) */
        if (givemsg)
            pline_The(_("%s inside the box is dead!"),
                      Hallucination() ? rndmonnam(0) : _("housecat"));
        if (deadcat) {
            /* set_corpsenm() will start the rot timer that was removed
               when makemon() created SchroedingersBox; start it from
               now rather than from when this special corpse got created */
            deadcat.age = svm.moves;
            set_corpsenm(deadcat, PM_HOUSECAT);
            deadcat = oname(deadcat, sc, ONAME_NO_FLAGS);

            if (!svc.context.mon_moving) {
                /* give experience points for the death of the cat since
                   that has been finalized by the hero opening the box */
                more_experienced(20, 10); /* 20:current exp; 10:score bonus */
                newexplevel();
            }
        }
    }
    (deadcat);
    return;
    } finally { stack_pop($frame); }
}

/* used by askchain() to check for magic bag explosion */
export function container_gone(fn) { /* boolean */
    /* result is only meaningful while use_container() is executing */
    return +((fn == in_container || fn == out_container)
            && !gc.current_container);
}

function explain_container_prompt(more_containers) { /* void */
    let explaintext = static_array("explain_container_prompt.explaintext", ptr_to(char), null, [
        _("Container actions:"),
        _(""),
        _(" : -- Look: examine contents"),
        _(" o -- Out: take things out"),
        _(" i -- In: put things in"),
        _(" b -- Both: first take things out, then put things in"),
        _(" r -- Reversed: put things in, then take things out"),
        _(" s -- Stash: put one item in"), _(""),
        _(" n -- Next: loot next selected container"),
        _(" q -- Quit: finished"),
        _(" ? -- Help: display this text."),
        _(""), 0
    ]);
    let txtpp;
    let win;

    /* "Do what with <container>? [:oibrsq or ?] (q)" */
    if ((win = create_nhwindow()(NHW_TEXT)) != WIN_ERR) {
        for (txtpp = explaintext; txtpp[0]; txtpp = txtpp.subarray(1)) {
            if (!more_containers && !strncmp(txtpp[0], _(" n "), 3))
                continue;
            putstr()(win, 0, txtpp[0]);
        }
        display_nhwindow()(win, FALSE);
        destroy_nhwindow()(win);
    }
}

export function u_handsy() { /* boolean */
    if (nohands(gy.youmonst.data)) {
        You(_("have no hands!")); /* not `body_part(HAND)' */
        return FALSE;
    } else if (!freehand()) {
        You(_("have no free %s."), body_part(HAND));
        return FALSE;
    }
    return TRUE;
}

/* getobj callback for object to be stashed into a container */
function stash_ok(obj) { /* int */
    if (!obj)
        return GETOBJ_EXCLUDE;

    /* downplay the container being stashed into */
    if (!ck_bag(obj))
        return GETOBJ_EXCLUDE_SELECTABLE;
    /* Possible extension: downplay things too big to fit into containers (in
     * which case extract in_container()'s logic.) */

    return GETOBJ_SUGGEST;
}

export function use_container(
    objp,
    held,
    more_containers) { /* int */ /* True iff #loot multiple and this isn't last */
    const $frame = stack_frame(); try {
    var otmp, obj = objp[0];
    var quantum_cat, cursed_mbag, loot_out, loot_in, loot_in_first,
        stash_one, inokay, outokay, outmaybe;
    var c, emptymsg = stack_array(char, BUFSZ), qbuf = stack_array(char, QBUFSZ), pbuf = stack_array(char, QBUFSZ), xbuf = stack_array(char, QBUFSZ);
    var used = ECMD_OK;
    var loss;

    ga.abort_looting = FALSE;
    gs.sellobj_first = TRUE; /* in_container() should call sellobj_state() */
    chars[emptymsg + 0] = ord('\0');

    if (!u_handsy())
        return ECMD_OK;

    if (!obj.lknown) { /* do this in advance */
        obj.lknown = 1;
        if (held)
            update_inventory();
    }
    if (obj.olocked) {
        pline(_("%s locked."), Tobjnam(obj, _("are")));
        if (held)
            You(_("must put it down to unlock."));
        return ECMD_OK;
    } else if (obj.otrapped) {
        if (held)
            You(_("open %s..."), the(xname(obj)));
        chest_trap(obj, HAND, FALSE);
        /* even if the trap fails, you've used up this turn */
        if (gm.multi >= 0) { /* in case we didn't become paralyzed */
            nomul(-1);
            gm.multi_reason = _("opening a container");
            gn.nomovemsg = _("");
        }
        ga.abort_looting = TRUE;
        return ECMD_TIME;
    }

    gc.current_container = obj; /* for use by in/out_container */
    /*
     * From here on out, all early returns go through 'containerdone:'.
     */

    /* check for Schroedinger's Cat */
    quantum_cat = SchroedingersBox(gc.current_container);
    if (quantum_cat) {
        observe_quantum_cat(gc.current_container, TRUE, TRUE);
        used = ECMD_TIME;
    }

    cursed_mbag = (Is_mbag(gc.current_container)
        && gc.current_container.cursed
        && Has_contents(gc.current_container) ? 1 : 0);
    if (cursed_mbag
        && (loss = boh_loss(gc.current_container, held)) != 0) {
        used = ECMD_TIME;
        You(_("owe %lld %s for lost merchandise."), loss, currency(loss));
        gc.current_container.owt = unsigned(weight(gc.current_container));
    }
    /* might put something in if carrying anything other than just the
       container itself (invent is not the container or has a next object) */
    inokay = (gi.invent != null && (gi.invent != gc.current_container
                                || gi.invent.nobj) ? 1 : 0);
    /* might take something out if container isn't empty */
    outokay = Has_contents(gc.current_container);
    if (!outokay) /* preformat the empty-container message */
        sprintf(emptymsg, _("%s is %sempty."), Ysimple_name2(gc.current_container), (quantum_cat || cursed_mbag) ? _("now ") : _(""))

;

    /*
     * What-to-do prompt's list of possible actions:
     * always include the look-inside choice (':');
     * include the take-out choice ('o') if container
     * has anything in it or if player doesn't yet know
     * that it's empty (latter can change on subsequent
     * iterations if player picks ':' response);
     * include the put-in choices ('i','s') if hero
     * carries any inventory (including gold) aside from
     * the container itself;
     * include do-both when 'o' is available, even if
     * inventory is empty--taking out could alter that;
     * include do-both-reversed when 'i' is available,
     * even if container is empty--for similar reason;
     * include the next container choice ('n') when
     * relevant, and make it the default;
     * always include the quit choice ('q'), and make
     * it the default if there's no next container;
     * include the help choice (" or ?") if `cmdassist'
     * run-time option is set;
     * (Player can pick any of (o,i,b,r,n,s,?) even when
     * they're not listed among the available actions.)
     *
     * Do what with <the/your/Shk's container>? [:oibrs nq or ?] (q)
     * or
     * <The/Your/Shk's container> is empty.  Do what with it? [:irs nq or ?]
     */
    for (;;) { /* repeats iff '?' or ':' gets chosen */
        outmaybe = (outokay || !gc.current_container.cknown ? 1 : 0);
        if (!outmaybe)
            safe_qbuf(qbuf, 0, _(" is empty.  Do what with it?"),
                             gc.current_container, Yname2, Ysimple_name2,
                             _("This"));
        else
            safe_qbuf(qbuf, _("Do what with "), _("?"), gc.current_container,
                             yname, ysimple_name, _("it"));
        /* ask player about what to do with this container */
        if (flags.menu_style == MENU_PARTIAL
            || flags.menu_style == MENU_FULL) {
            if (!inokay && !outmaybe) {
                /* nothing to take out, nothing to put in;
                   trying to do both will yield proper feedback */
                c = ord('b');
            } else {
                c = in_or_out_menu(qbuf, gc.current_container,
                                   outmaybe, inokay,
                                   (+(used != ECMD_OK)),
                                   more_containers);
            }
        } else { /* TRADITIONAL or COMBINATION */
            chars[xbuf + 0] = ord('\0'); /* list of extra acceptable responses */
            strcpy(pbuf, _(":"));                   /* look inside */
            strcat(outmaybe ? pbuf : xbuf, _("o")); /* take out */
            strcat(inokay ? pbuf : xbuf, _("i"));   /* put in */
            strcat(outmaybe ? pbuf : xbuf, _("b")); /* both */
            strcat(inokay ? pbuf : xbuf, _("rs"));  /* reversed, stash */
            strcat(pbuf, _(" "));                   /* separator */
            strcat(more_containers ? pbuf : xbuf, _("n")); /* next container */
            strcat(pbuf, _("q"));                   /* quit */
            if (iflags.cmdassist)
                /* this unintentionally allows user to answer with 'o' or
                   'r'; fortunately, those are already valid choices here */
                strcat(pbuf, _(" or ?")); /* help */
            else
                strcat(xbuf, _("?"));
            if (chars[xbuf])
                strcat(strcat(pbuf, _("\x1b")), xbuf);
            c = yn_function(qbuf, pbuf, more_containers ? ord('n') : ord('q'), TRUE);
        } /* PARTIAL|FULL vs other modes */

        if (c == ord('?')) {
            explain_container_prompt(more_containers);
        } else if (c == ord(':')) { /* note: will set obj->cknown */
            if (!gc.current_container.cknown)
                used = ECMD_TIME; /* gaining info */
            container_contents(gc.current_container, FALSE, FALSE, TRUE);
        } else
            break;
    } /* loop until something other than '?' or ':' is picked */

    if (c == ord('q'))
        ga.abort_looting = TRUE;
    containerdone: { if (c == ord('n') || c == ord('q')) /* [not strictly needed; falling thru works] */
        break containerdone;;
    loot_out = +(c == ord('o') || c == ord('b') || c == ord('r'));
    loot_in = +(c == ord('i') || c == ord('b') || c == ord('r'));
    loot_in_first = +(c == ord('r')); /* both, reversed */
    stash_one = +(c == ord('s'));

    /* out-only or out before in */
    if (loot_out && !loot_in_first) {
        if (!Has_contents(gc.current_container)) {
            pline1(emptymsg); /* <whatever> is empty. */
            if (!gc.current_container.cknown)
                used = ECMD_TIME;
            gc.current_container.cknown = 1;
        } else {
            add_valid_menu_class(0); /* reset */
            if (flags.menu_style == MENU_TRADITIONAL)
                used |= traditional_loot(FALSE);
            else
                used |= +(menu_loot(0, FALSE) > 0);
            add_valid_menu_class(0);
        }
        /* recalculate 'inokay' in case something was just taken out and
           inventory is no longer empty or no longer just the container */
        inokay = (gi.invent && (gi.invent != gc.current_container
                               || gi.invent.nobj) ? 1 : 0);
    }

    if ((loot_in || stash_one) && !inokay) {
        You(_("don't have anything%s to %s."), gi.invent ? _(" else") : _(""),
            stash_one ? _("stash") : _("put in"));
        loot_in = stash_one = FALSE;
    }

    /*
     * Gone: being nice about only selecting food if we know we are
     * putting things in an ice chest.
     */
    if (loot_in) {
        add_valid_menu_class(0); /* reset */
        if (flags.menu_style == MENU_TRADITIONAL)
            used |= traditional_loot(TRUE);
        else
            used |= +(menu_loot(0, TRUE) > 0);
        add_valid_menu_class(0);
    } else if (stash_one) {
        /* put one item into container */
        if ((otmp = getobj(_("stash"), stash_ok,
                           GETOBJ_PROMPT | GETOBJ_ALLOWCNT)) != null) {
            if (in_container(otmp)) {
                used = 1;
            } else {
                /* couldn't put selected item into container for some
                   reason; might need to undo splitobj() */
                unsplitobj(otmp);
            }
        }
    }
    /* putting something in might have triggered magic bag explosion */
    if (!gc.current_container)
        loot_out = FALSE;

    /* out after in */
    if (loot_out && loot_in_first) {
        if (!Has_contents(gc.current_container)) {
            pline1(emptymsg); /* <whatever> is empty. */
            if (!gc.current_container.cknown)
                used = 1;
            gc.current_container.cknown = 1;
        } else {
            add_valid_menu_class(0); /* reset */
            if (flags.menu_style == MENU_TRADITIONAL)
                used |= traditional_loot(FALSE);
            else
                used |= +(menu_loot(0, FALSE) > 0);
            add_valid_menu_class(0);
        }
    }
 }
    if (used) {
        /* Not completely correct; if we put something in without knowing
           whatever was already inside, now we suddenly do.  That can't
           be helped unless we want to track things item by item and then
           deal with containers whose contents are "partly known". */
        if (gc.current_container)
            gc.current_container.cknown = 1;
        update_inventory();
    }

    sellobj_state(SELL_NORMAL); /* in case in_container() set it */
    objp[0] = gc.current_container; /* might have become null */
    if (gc.current_container)
        gc.current_container = null; /* avoid hanging on to stale pointer */
    else
        ga.abort_looting = TRUE;
    return used;
    } finally { stack_pop($frame); }
}

/* loot current_container (take things out or put things in), by prompting */
function traditional_loot(put_in) { /* int */
    const $frame = stack_frame(); try {
    let actionfunc, checkfunc;
    let objlist;
    let selection = stack_array(char, MAXOCLASSES + 10); /* +10: room for B,U,C,X plus slop */
    let action;
    let one_by_one = stack_var(boolean), allflag = stack_var(boolean);
    let used = ECMD_OK, menu_on_request = stack_var(int, 0);

    if (put_in) {
        action = _("put in");
        objlist = ref_of(gi, "invent");
        actionfunc = in_container;
        checkfunc = ck_bag;
    } else {
        action = _("take out");
        objlist = ref_of(gc.current_container, "cobj");
        actionfunc = out_container;
        checkfunc = null;
        gp.pickup_encumbrance = 0; /* used to limit verbosity */
    }

    if (query_classes(selection, addr_of(one_by_one), addr_of(allflag), action, objlist[0],
                      FALSE, menu_on_request)) {
        if (askchain(objlist, (one_by_one[0] ? 0 : selection), allflag[0],
                     actionfunc, checkfunc, 0, action))
            used = ECMD_TIME;
    } else if (menu_on_request[0] < 0) {
        used = +(menu_loot(menu_on_request[0], put_in) > 0);
    }
    return used;
    } finally { stack_pop($frame); }
}

/* loot current_container (take things out or put things in), using a menu */
function menu_loot(retry, put_in) { /* int */
    const $frame = stack_frame(); try {
    let n, i, n_looted = 0;
    let all_categories = TRUE, loot_everything = FALSE, autopick = FALSE;
    let buf = stack_array(char, BUFSZ);
    let loot_justpicked = FALSE;
    let action = put_in ? _("Put in") : _("Take out");
    let otmp, otmp2;
    let pick_list = stack_var(ptr_to(struct_mi));
    let mflags, res;
    let count = 0;

    gp.pickup_encumbrance = 0; /* used by out_container(); no harm in
                                * zeroing it if about to use in_container() */
    if (retry) {
        all_categories = +(retry == -2);
    } else if (flags.menu_style == MENU_FULL) {
        all_categories = FALSE;
        sprintf(buf, _("%s what type of objects?"), action);
        mflags = (ALL_TYPES | UNPAID_TYPES | BUCX_TYPES | CHOOSE_ALL
                  | JUSTPICKED );
        n = query_category(buf,
                           put_in ? gi.invent : gc.current_container.cobj,
                           mflags, pick_list, PICK_ANY);
            /* when paranoid_confirm:A is set, 'A' by itself implies
               'A'+'a' which will be followed by a confirmation prompt;
               when that option isn't set, 'A' by itself is rejected
               by query_categorry() and result here will be n==0 */
        if (!n)
            return ECMD_OK; /* no non-autopick category filters specified */

        for (i = 0; i < n; i++) {
            if (ptr_add(pick_list[0], i).item.a_int == ord('A')) {
                loot_everything = autopick = TRUE;
            } else if (put_in && ptr_add(pick_list[0], i).item.a_int == ord('P')) {
                loot_justpicked = TRUE;
                count = max(0, ptr_add(pick_list[0], i).count);
                add_valid_menu_class(ptr_add(pick_list[0], i).item.a_int);
                loot_everything = FALSE;
            } else if (ptr_add(pick_list[0], i).item.a_int == ALL_TYPES_SELECTED) {
                all_categories = TRUE;
            } else {
                add_valid_menu_class(ptr_add(pick_list[0], i).item.a_int);
                loot_everything = FALSE;
            }
        }
        free(addr_of(pick_list[0]));
    }

    if (autopick) {
        let inout_func; /* in_container or out_container */
        let firstobj;

        if (!put_in) {
            gc.current_container.cknown = 1;
            inout_func = out_container;
            firstobj = gc.current_container.cobj;
        } else {
            inout_func = in_container;
            firstobj = gi.invent;
        }
        /*
         * Note:  for put_in, current_container might be destroyed during
         * mid-traversal by a magic bag explosion.
         * Note too:  items are processed in internal list order rather
         * than menu display order ('sortpack') or 'sortloot' order;
         * for put_in that should be item->invlet order so reasonable.
         */
        for (otmp = firstobj; otmp && gc.current_container; otmp = otmp2) {
            otmp2 = otmp.nobj;
            if (loot_everything || all_categories || allow_category(otmp)) {
                res = inout_func(otmp);
                if (res < 0)
                    break;
                n_looted += res;
            }
        }
    } else if (put_in && loot_justpicked
               && count_justpicked(gi.invent) == 1) {
        otmp = find_justpicked(gi.invent);
        if (otmp) {
            n_looted = 1;
            if (count > 0 && count < otmp.quan) {
                otmp = splitobj(otmp, count);
            }
            in_container(otmp);
            /* return value doesn't matter, even if container blew up */
        }
    } else {
        mflags = INVORDER_SORT | INCLUDE_VENOM;
        if (put_in && flags.invlet_constant)
            mflags |= USE_INVLET;
        if (put_in && loot_justpicked)
            mflags |= JUSTPICKED;
        if (!put_in)
            gc.current_container.cknown = 1;
        sprintf(buf, _("%s what?"), action);
        n = query_objlist(buf,
                          put_in ? ref_of(gi, "invent") : ref_of(gc.current_container, "cobj"),
                          mflags, pick_list, PICK_ANY,
                          all_categories ? allow_all : allow_category);
        if (n) {
            n_looted = n;
            for (i = 0; i < n; i++) {
                otmp = ptr_add(pick_list[0], i).item.a_obj;
                assert(otmp != null);
                count = ptr_add(pick_list[0], i).count;
                if (count > 0 && count < otmp.quan) {
                    otmp = splitobj(otmp, count);
                    /* special split case also handled by askchain() */
                }
                res = put_in ? in_container(otmp) : out_container(otmp);
                if (res <= 0) {
                    if (!gc.current_container) {
                        /* otmp caused current_container to explode;
                           both are now gone */
                        otmp = null; /* and break loop */
                    } else if (otmp && otmp != ptr_add(pick_list[0], i).item.a_obj) {
                        /* split occurred, merge again */
                        unsplitobj(otmp);
                    }
                    if (res < 0)
                        break;
                }
            }
            free(addr_of(pick_list[0]));
        }
    }
    return n_looted ? ECMD_TIME : ECMD_OK;
    } finally { stack_pop($frame); }
}

function in_or_out_menu(
    prompt,
    obj,
    outokay,
    inokay,
    alreadyused,
    more_containers) { /* char */
    const $frame = stack_frame(); try {
    /* underscore is not a choice; it's used to skip element [0] */
    let lootchars = init_string(static_array("in_or_out_menu.lootchars", char, sizeof_string("_:oibrsnq")), _("_:oibrsnq"), true), abc_chars = init_string(static_array("in_or_out_menu.abc_chars", char, sizeof_string("_:abcdenq")), _("_:abcdenq"), true);
    let win;
    let any = stack_struct(struct_any);
    let pick_list = stack_var(ptr_to(struct_mi));
    let buf = stack_array(char, BUFSZ);
    let n;
    let menuselector = flags.lootabc ? abc_chars : lootchars;
    let clr = NO_COLOR;

    struct_assign(any, cg.zeroany);
    win = create_nhwindow()(NHW_MENU);
    start_menu()(win, MENU_BEHAVE_STANDARD);

    any.a_int = 1; /* ':' */
    sprintf(buf, _("Look inside %s"), thesimpleoname(obj));
    add_menu(win, nul_glyphinfo, any, chars[menuselector + any.a_int], 0,
             ATR_NONE, clr, buf, MENU_ITEMFLAGS_NONE);
    if (outokay) {
        any.a_int = 2; /* 'o' */
        sprintf(buf, _("take %s out"), something());
        add_menu(win, nul_glyphinfo, any, chars[menuselector + any.a_int], 0,
                 ATR_NONE, clr, buf, MENU_ITEMFLAGS_NONE);
    }
    if (inokay) {
        any.a_int = 3; /* 'i' */
        sprintf(buf, _("put %s in"), something());
        add_menu(win, nul_glyphinfo, any, chars[menuselector + any.a_int], 0,
                 ATR_NONE, clr, buf, MENU_ITEMFLAGS_NONE);
    }
    if (outokay) {
        any.a_int = 4; /* 'b' */
        sprintf(buf, _("%stake out, then put in"), inokay ? _("both; ") : _(""));
        add_menu(win, nul_glyphinfo, any, chars[menuselector + any.a_int], 0,
                 ATR_NONE, clr, buf, MENU_ITEMFLAGS_NONE);
    }
    if (inokay) {
        any.a_int = 5; /* 'r' */
        sprintf(buf, _("%sput in, then take out"), outokay ? _("both reversed; ") : _(""))
;
        add_menu(win, nul_glyphinfo, any, chars[menuselector + any.a_int], 0,
                 ATR_NONE, clr, buf, MENU_ITEMFLAGS_NONE);
        any.a_int = 6; /* 's' */
        sprintf(buf, _("stash one item into %s"), thesimpleoname(obj));
        add_menu(win, nul_glyphinfo, any, chars[menuselector + any.a_int], 0,
                 ATR_NONE, clr, buf, MENU_ITEMFLAGS_NONE);
    }
    add_menu_str(win, _(""));
    if (more_containers) {
        any.a_int = 7; /* 'n' */
        add_menu(win, nul_glyphinfo, any, chars[menuselector + any.a_int], 0,
                 ATR_NONE, clr, _("loot next container"),
                 MENU_ITEMFLAGS_SELECTED);
    }
    any.a_int = 8; /* 'q' */
    strcpy(buf, alreadyused ? _("done") : _("do nothing"));
    add_menu(win, nul_glyphinfo, any, chars[menuselector + any.a_int], 0,
             ATR_NONE, clr, buf,
             more_containers ? MENU_ITEMFLAGS_NONE : MENU_ITEMFLAGS_SELECTED);

    end_menu()(win, prompt);
    n = select_menu(win, PICK_ONE, pick_list);
    destroy_nhwindow()(win);
    if (n > 0) {
        let k = ptr_add(pick_list[0], 0).item.a_int;

        if (n > 1 && k == (more_containers ? 7 : 8))
            k = ptr_add(pick_list[0], 1).item.a_int;
        free(addr_of(pick_list[0]));
        return chars[lootchars + k]; /* :,o,i,b,r,s,n,q */
    }
    return (n == 0 && more_containers) ? ord('n') : ord('q'); /* next or quit */
    } finally { stack_pop($frame); }
}

/* getobj callback for object to tip */
function tip_ok(obj) { /* int */
    if (!obj || obj.oclass == COIN_CLASS)
        return GETOBJ_EXCLUDE;

    if (Is_container(obj)) {
        return GETOBJ_SUGGEST;
    }

    /* include horn of plenty if sufficiently discovered */
    if (obj.otyp == HORN_OF_PLENTY && obj.dknown
        && objects[obj.otyp].oc_name_known)
        return GETOBJ_SUGGEST;

    /* allow trying anything else in inventory */
    return GETOBJ_DOWNPLAY;
}

/* show a menu of containers under hero,
   and one extra entry for choosing an inventory.
   returns ECMD_CANCEL if menu was canceled,
   ECMD_TIME if a container was picked,
   otherwise returns ECMD_OK. */
function choose_tip_container_menu() { /* int */
    const $frame = stack_frame(); try {
    let n, i;
    let win;
    let any = stack_struct(struct_any);
    let pick_list = stack_var(ptr_to(struct_mi), null);
    let dummyobj = stack_struct(struct_obj), otmp;
    let clr = NO_COLOR;

    struct_assign(any, cg.zeroany);
    win = create_nhwindow()(NHW_MENU);
    start_menu()(win, MENU_BEHAVE_STANDARD);

    for (otmp = svl.level.objects[u.ux][u.uy], i = 0; otmp;
         otmp = otmp.v.v_nexthere)
        if (Is_container(otmp)) {
            ++i;
            any.a_obj = otmp;
            add_menu(win, nul_glyphinfo, any, 0, 0, ATR_NONE,
                     clr, doname(otmp), MENU_ITEMFLAGS_NONE);
        }
    if (gi.invent) {
        add_menu_str(win, _(""));
        any.a_obj = dummyobj;
        /* use 'i' for inventory unless there are so many
           containers that it's already being used */
        i = (i <= ord('i') - ord('a') && !flags.lootabc) ? ord('i') : 0;
        add_menu(win, nul_glyphinfo, any, i, 0, ATR_NONE,
                 clr, _("tip something being carried"),
                 MENU_ITEMFLAGS_SELECTED);
    }
    end_menu()(win, _("Tip which container?"));
    n = select_menu(win, PICK_ONE, pick_list);
    destroy_nhwindow()(win);
    /*
     * Deal with quirk of preselected item in pick-one menu:
     * n ==  0 => picked preselected entry, toggling it off;
     * n ==  1 => accepted preselected choice via SPACE or RETURN;
     * n ==  2 => picked something other than preselected entry;
     * n == -1 => cancelled via ESC;
     */
    otmp = (n <= 0) ? null : ptr_add(pick_list[0], 0).item.a_obj;
    if (n > 1 && otmp == dummyobj)
        otmp = ptr_add(pick_list[0], 1).item.a_obj;
    if (pick_list[0])
        free(addr_of(pick_list[0]));
    if (otmp && otmp != dummyobj) {
        tipcontainer(otmp);
        return ECMD_TIME;
    }
    if (n == -1)
        return ECMD_CANCEL;
    return ECMD_OK;
    } finally { stack_pop($frame); }
}

/* #tip command -- empty container contents onto floor */
export function dotip() { /* int */
    const $frame = stack_frame(); try {
    let cobj, nobj;
    let cc = stack_struct(struct_nhcoord);
    let boxes;
    let c, buf = stack_array(char, BUFSZ), qbuf = stack_array(char, BUFSZ);
    let spillage = 0;

    /*
     * Doesn't require free hands;
     * limbs are needed to tip floor containers.
     *
     * Note: for menustyle:Traditional, using m prefix forces a menu
     * of floor containers when more than one is present.  For other
     * menustyle settings or when fewer than two floor containers are
     * present, using 'm' skips floor and goes straight to invent.
     * This somewhat unintuitive behavior is driven by the way that
     * context-sensitive inventory item actions use m prefix.
     */

    /* at present, can only tip things at current spot, not adjacent ones */
    cc.x = u.ux, cc.y = u.uy;

    /* check floor container(s) first; at most one will be accessed */
    boxes = container_at(cc.x, cc.y, TRUE);
    /* this is iffy for menustyle:traditional; 'm' prefix is ambiguous
       for it: skip floor vs handle multiple containers via menu */
    if (boxes > 0
        && (!iflags.menu_requested
            || (flags.menu_style == MENU_TRADITIONAL && boxes > 1))) {
        sprintf(buf, _("You can't tip %s while carrying so much."), !flags.verbose ? _("a container") : (boxes > 1) ? _("one") : _("it"))
;
        if (!check_capacity(buf) && able_to_loot(cc.x, cc.y, FALSE)) {
            if (boxes > 1) {
                let res;
                /* pick one container via menu or ... */
                if ((res = choose_tip_container_menu()) != ECMD_OK)
                    return res;
                /* else pick-from-gi.invent below */
            } else {
                for (cobj = svl.level.objects[cc.x][cc.y]; cobj;
                     cobj = nobj) {
                    nobj = cobj.v.v_nexthere;
                    if (!Is_container(cobj))
                        continue;
                    c = yn_function(safe_qbuf(qbuf, _("There is "), _(" here, tip it?"),
                                      cobj,
                                      doname, ansimpleoname, _("container")), ynqchars, ord("q"), TRUE);
                    if (c == ord('q'))
                        return ECMD_OK;
                    if (c == ord('n'))
                        continue;
                    tipcontainer(cobj);
                    /* can only tip one container at a time */
                    return ECMD_TIME;
                }
            }
        }
    }

    /* either no floor container(s) or 'm' prefix was used to ignore such
       or couldn't tip one or didn't tip any */
    cobj = getobj(_("tip"), tip_ok, GETOBJ_PROMPT);
    if (!cobj)
        return ECMD_CANCEL;

    /* normal case */
    if (Is_container(cobj) || cobj.otyp == HORN_OF_PLENTY) {
        tipcontainer(cobj);
        return ECMD_TIME;
    }
    /* assorted other cases */
    if (Is_candle(cobj) && cobj.lamplit) {
        /* note "wax" even for tallow candles to avoid giving away info */
        spillage = _("wax");
    } else if ((cobj.otyp == POT_OIL && cobj.lamplit)
               || (cobj.otyp == OIL_LAMP && cobj.age != 0)
               || (cobj.otyp == MAGIC_LAMP && cobj.spe != 0)) {
        spillage = _("oil");
        /* todo: reduce potion's remaining burn timer or oil lamp's fuel */
    } else if (cobj.otyp == CAN_OF_GREASE && cobj.spe > 0) {
        /* charged consumed below */
        spillage = _("grease");
    } else if (cobj.otyp == FOOD_RATION || cobj.otyp == CRAM_RATION
               || cobj.otyp == LEMBAS_WAFER) {
        spillage = _("crumbs");
    } else if (cobj.oclass == VENOM_CLASS) {
        spillage = _("venom");
    }
    if (spillage) {
        chars[buf + 0] = ord('\0');
        if (is_pool(u.ux, u.uy))
            sprintf(buf, _(" and gradually %s"), vtense(spillage, _("dissipate")));
        else if (is_lava(u.ux, u.uy))
            sprintf(buf, _(" and immediately %s away"), vtense(spillage, _("burn")))
;
        pline(_("Some %s %s onto the %s%s."), spillage,
              vtense(spillage, _("spill")), surface(u.ux, u.uy), buf);
        /* shop usage message comes after the spill message */
        if (cobj.otyp == CAN_OF_GREASE && cobj.spe > 0) {
            consume_obj_charge(cobj, TRUE);
        }
        /* something [useless] happened */
        return ECMD_TIME;
    }
    /* anything not covered yet */
    if (cobj.oclass == POTION_CLASS) /* can't pour potions... */
        pline_The(_("%s %s securely sealed."), xname(cobj), otense(cobj, _("are")));
    else if (uarmh && cobj == uarmh)
        return tiphat() ? ECMD_TIME : ECMD_OK;
    else if (cobj.otyp == STATUE)
        pline(_("Nothing interesting happens."));
    else
        pline1(nothing_happens());
    return ECMD_OK;
    } finally { stack_pop($frame); }
}

    const TIPCHECK_OK = 0;
    const TIPCHECK_LOCKED = TIPCHECK_OK + 1;
    const TIPCHECK_TRAPPED = TIPCHECK_LOCKED + 1;
    const TIPCHECK_CANNOT = TIPCHECK_TRAPPED + 1;
    const TIPCHECK_EMPTY = TIPCHECK_CANNOT + 1;

function tipcontainer(box) { /* void */ /* or bag */
    const $frame = stack_frame(); try {
    let ox = stack_var(coordxy, u.ux), oy = stack_var(coordxy, u.uy); /* #tip only works at hero's location */
    let srcheld = FALSE, dstheld = FALSE, maybeshopgoods;
    let targetbox = null;
    let cancelled = stack_var(boolean, FALSE);

    /* box is either held or on floor at hero's spot; no need to check for
       nesting; when held, we need to update its location to match hero's;
       for floor, the coordinate updating is redundant */
    if (get_obj_location(box, ox, oy, 0))
        box.ox = ox[0], box.oy = oy[0];

    /*
     * TODO?
     *  if 'box' is known to be empty or known to be locked, give up
     *  before choosing 'targetbox'.
     */
    targetbox = tipcontainer_gettarget(box, addr_of(cancelled));
    if (cancelled[0])
        return;

    /* Shop handling:  can't rely on the container's own unpaid
       or no_charge status because contents might differ with it.
       A carried container's contents will be flagged as unpaid
       or not, as appropriate, and need no special handling here.
       Items owned by the hero get sold to the shop without
       confirmation as with other uncontrolled drops.  A floor
       container's contents will be marked no_charge if owned by
       hero, otherwise they're owned by the shop.  By passing
       the contents through shop billing, they end up getting
       treated the same as in the carried case.   We do so one
       item at a time instead of doing whole container at once
       to reduce the chance of exhausting shk's billing capacity. */
    maybeshopgoods = (!carried(box) && costly_spot(box.ox, box.oy) ? 1 : 0);

    if (tipcontainer_checks(box, targetbox, FALSE) != TIPCHECK_OK)
        return;
    if (targetbox
        && tipcontainer_checks(targetbox, null, TRUE) != TIPCHECK_OK)
        return;

    {
        let otmp, nobj;
        let terse, highdrop = +!can_reach_floor(TRUE),
                altarizing = IS_ALTAR(levl()[ox[0]][oy[0]].typ),
                cursed_mbag = (Is_mbag(box) && box.cursed ? 1 : 0);
        let loss = 0;

        srcheld = carried(box);
        dstheld = (targetbox && carried(targetbox) ? 1 : 0);
        if (u.uswallow)
            highdrop = altarizing = FALSE;
        terse = +!(highdrop || altarizing || costly_spot(box.ox, box.oy));
        box.cknown = 1;
        /* Terse formatting is
         * "Objects spill out: obj1, obj2, obj3, ..., objN."
         * If any other messages intervene between objects, we revert to
         * "ObjK drops to the floor.", "ObjL drops to the floor.", &c.
         */
        if (targetbox)
            pline(_("%s into %s."),
                  box.cobj.nobj ? _("Objects tumble") : _("An object tumbles"),
                  the(xname(targetbox)));
        else
            pline(_("%s out%c"),
              box.cobj.nobj ? _("Objects spill") : _("An object spills"),
              terse ? ord(':') : ord('.'));

        for (otmp = box.cobj; otmp; otmp = nobj) {
            nobj = otmp.nobj;
            obj_extract_self(otmp);
            otmp.ox = box.ox, otmp.oy = box.oy;

            if (box.otyp == ICE_BOX) {
                removed_from_icebox(otmp); /* resume rotting for corpse */
            } else if (cursed_mbag && is_boh_item_gone()) {
                loss += mbag_item_gone(srcheld, otmp, FALSE);
                /* abbreviated drop format is no longer appropriate */
                terse = FALSE;
                continue;
            }
            if (maybeshopgoods) {
                addtobill(otmp, FALSE, FALSE, TRUE);
                iflags.suppress_price++; /* doname formatting */
            }

            if (targetbox) {
                if (Is_mbag(targetbox) && mbag_explodes(otmp, 0)) {
                    livelog_printf(LL_ACHIEVE,
                                 _("just blew up %s bag of holding via tipping"),
                                   uhis());
                    /* explicitly mention what item is triggering explosion */
                    urgent_pline(
                   _("As %s %s inside, you are blasted by a magical explosion!"),
                                 doname(otmp), otense(otmp, _("tumble")));

                    /* if putting one bag of holding into another, first
                       blow up the one going in, then (below) blow up the
                       one it's going into */
                    if (otmp.otyp == BAG_OF_HOLDING) /* BoH into another */
                        do_boh_explosion(otmp, +!srcheld);
                    /* always delete the item which triggered the explosion */
                    obfree(otmp, null); /* where==OBJ_FREE */

                    /* [assumes targetbox is carried, otherwise shop bill
                       handling becomes necessary here] */
                    do_boh_explosion(targetbox, +!dstheld);
                    if (dstheld)
                        useup(targetbox);
                    else
                        useupf(targetbox, targetbox.quan);
                    targetbox = null; /* it's gone */
                    nobj = null; /* stop tipping; want loop to exit 'normally' */

                    losehp(d(6, 6), _("magical explosion"), KILLED_BY_AN);
                } else {
                    add_to_container(targetbox, otmp);
                }
            } else if (highdrop) {
                otmp.how_lost = LOST_DROPPED;
                /* might break or fall down stairs; handles altars itself */
                hitfloor(otmp, TRUE);
            } else {
                if (altarizing) {
                    doaltarobj(otmp);
                } else if (!terse) {
                    pline(_("%s %s to the %s."), Doname2(otmp),
                          otense(otmp, _("drop")), surface(ox[0], oy[0]));
                } else {
                    pline(_("%s%c"), doname(otmp), nobj ? ord(',') : ord('.'));
                    iflags.last_msg = PLNMSG_OBJNAM_ONLY;
                }
                otmp.how_lost = LOST_DROPPED;
                dropy(otmp);
                if (iflags.last_msg != PLNMSG_OBJNAM_ONLY)
                    terse = FALSE; /* terse formatting has been interrupted */
            }

            if (maybeshopgoods)
                iflags.suppress_price--; /* reset */
        }
        if (loss) /* magic bag lost some shop goods */
            You(_("owe %lld %s for lost merchandise."), loss, currency(loss));
        box.owt = unsigned(weight(box)); /* mbag_item_gone() doesn't update this */
        if (targetbox)
            targetbox.owt = unsigned(weight(targetbox));
        if (srcheld || dstheld)
            encumber_msg();
    }

    if (srcheld || dstheld)
        update_inventory();
    } finally { stack_pop($frame); }
}

/* #if 0: not in this build */

/* ask user for a carried container into which they want box to be emptied;
   cancelled is TRUE if user cancelled the menu pick; hands aren't required
   when tipping to the floor but are when tipping into another container */
function tipcontainer_gettarget(
    box,
    cancelled) { /* struct obj * */
    const $frame = stack_frame(); try {
    let n, n_conts;
    let win;
    let any = stack_struct(struct_any);
    let buf = stack_array(char, BUFSZ);
    let pick_list = stack_var(ptr_to(struct_mi), null);
    let dummyobj = stack_struct(struct_obj), otmp;
    let hands_available = TRUE, exclude_it;
    let clr = NO_COLOR;

    /* #if 0: not in this build */

    win = create_nhwindow()(NHW_MENU);
    start_menu()(win, MENU_BEHAVE_STANDARD);

    struct_assign(dummyobj, cg.zeroobj); /* lint suppression; only its address matters */
    struct_assign(any, cg.zeroany);
    any.a_obj = dummyobj;
    /* tip to floor does not require free hands */
    add_menu(win, nul_glyphinfo, any, ord('-'), 0, ATR_NONE, clr,
             /* [TODO? vary destination string depending on surface()] */
             _("on the floor"), MENU_ITEMFLAGS_SELECTED);
    add_menu_str(win, _(""));

    n_conts = 0;
    for (otmp = gi.invent; otmp; otmp = otmp.nobj) {
        if (otmp == box)
            continue;
        /* skip non-containers; bag of tricks passes Is_container() test,
           only include it if it isn't known to be a bag of tricks */
        if (!Is_container(otmp)
            || (otmp.otyp == BAG_OF_TRICKS && otmp.dknown
                && objects[otmp.otyp].oc_name_known))
            continue;
        if (!n_conts++)
            hands_available = u_handsy(); /* might issue message */
        /* container-to-container tip requires free hands;
           exclude container as possible target when known to be locked */
        exclude_it = (!hands_available || (otmp.olocked && otmp.lknown) ? 1 : 0);
        struct_assign(any, cg.zeroany);
        any.a_obj = !exclude_it ? otmp : null;
        sprintf(buf, _("%s%s"), !exclude_it ? _("") : _("    "), doname(otmp));
        add_menu(win, nul_glyphinfo, any, !exclude_it ? otmp.invlet : 0, 0,
                 ATR_NONE, clr, buf, MENU_ITEMFLAGS_NONE);
    }

    sprintf(buf, _("Where to tip the contents of %s"), doname(box));
    end_menu()(win, buf);
    n = select_menu(win, PICK_ONE, pick_list);
    destroy_nhwindow()(win);

    otmp = null;
    if (pick_list[0]) {
        otmp = ptr_add(pick_list[0], 0).item.a_obj;
        /* PICK_ONE with a preselected item might return 2;
           if so, choose the one that wasn't preselected */
        if (n > 1 && otmp == dummyobj)
            otmp = ptr_add(pick_list[0], 1).item.a_obj;
        if (otmp == dummyobj)
            otmp = null;
        free(addr_of(pick_list[0]));
    }
    chars[cancelled] = (+(n == -1));
    return otmp;
    } finally { stack_pop($frame); }
}

/* Perform check on box if we can tip it.
   Returns one of TIPCHECK_foo values.
   If allowempty if TRUE, return TIPCHECK_OK instead of TIPCHECK_EMPTY. */
function tipcontainer_checks(
    box,
    targetbox,
    allowempty) { /* int */ /* affects result when box is empty */
    const $frame = stack_frame(); try {
    /* undiscovered bag of tricks is acceptable as a container-to-container
       destination but it can't receive items; it has to be opened in
       preparation so apply it once before even trying to tip source box */
    if (targetbox && targetbox.otyp == BAG_OF_TRICKS) {
        let seencount = stack_var(int, 0);

        bagotricks(targetbox, FALSE, seencount);
        return TIPCHECK_CANNOT;
    }

    /* caveat: this assumes that cknown, lknown, olocked, and otrapped
       fields haven't been overloaded to mean something special for the
       non-standard "container" horn of plenty */
    if (!box.lknown) {
        box.lknown = 1;
        if (carried(box))
            update_inventory(); /* jumping the gun slightly; hope that's ok */
    }

    if (box.olocked) {
        pline(_("%s is locked."), upstart(thesimpleoname(box)));
        return TIPCHECK_LOCKED;
    } else if (box.otrapped) {
        /* we're not reaching inside but we're still handling it... */
        chest_trap(box, HAND, FALSE);
        /* even if the trap fails, you've used up this turn */
        if (gm.multi >= 0) { /* in case we didn't become paralyzed */
            nomul(-1);
            gm.multi_reason = _("tipping a container");
            gn.nomovemsg = _("");
        }
        return TIPCHECK_TRAPPED;
    } else if (box.otyp == BAG_OF_TRICKS || box.otyp == HORN_OF_PLENTY) {
        let res = TIPCHECK_OK;
        let bag = +(box.otyp == BAG_OF_TRICKS);
        let old_spe = box.spe, seen = stack_var(int), totseen;
        let maybeshopgoods = (!carried(box)
                                  && costly_spot(box.ox, box.oy) ? 1 : 0);
        let ox = stack_var(coordxy, u.ux), oy = stack_var(coordxy, u.uy);

        if (targetbox
            && ((res = tipcontainer_checks(targetbox, null, TRUE))
                != TIPCHECK_OK))
            return res;

        if (get_obj_location(box, ox, oy, 0))
            box.ox = ox[0], box.oy = oy[0];

        if (maybeshopgoods && !box.no_charge)
            addtobill(box, FALSE, FALSE, TRUE);
        /* apply this bag/horn until empty or monster/object creation fails
           (if the latter occurs, force the former...) */
        seen[0] = totseen = 0;
        do {
            if (!(bag ? bagotricks(box, TRUE, seen)
                      : hornoplenty(box, TRUE, targetbox)))
                break;
            totseen += seen[0];
        } while (box.spe > 0);

        if (box.spe < old_spe) {
            if (bag && !totseen)
                pline1(nothing_seems_to_happen());
            /* check_unpaid wants to see a non-zero charge count */
            box.spe = old_spe;
            check_unpaid_usage(box, TRUE);
            box.spe = 0; /* empty */
            box.cknown = 1;
        }
        if (maybeshopgoods && !box.no_charge)
            subfrombill(box, shop_keeper(chars[in_rooms(ox[0], oy[0], SHOPBASE)]));
        return TIPCHECK_CANNOT; /* actually means 'already done' */
    } else if (SchroedingersBox(box)) {
        let yourbuf = stack_array(char, BUFSZ);
        let empty_it = FALSE;

        observe_quantum_cat(box, TRUE, TRUE);
        if (!Has_contents(box)) /* evidently a live cat came out */
            /* container type of "large box" is inferred */
            pline(_("%sbox is now empty."), Shk_Your(yourbuf, box));
        else /* holds cat corpse */
            empty_it = TRUE;
        box.cknown = 1;
        return (empty_it || allowempty) ? TIPCHECK_OK : TIPCHECK_EMPTY;
    } else if (!allowempty && !Has_contents(box)) {
        box.cknown = 1;
        pline(_("%s is empty."), upstart(thesimpleoname(box)));
        return TIPCHECK_EMPTY;
    }

    return TIPCHECK_OK;
    } finally { stack_pop($frame); }
}

/*pickup.c*/

import { A_WIS } from "./attrib.h.js";
import { NO_COLOR } from "./color.h.js";
import { struct_nhcoord } from "./coord.h.js";
import { nothing_happens, nothing_seems_to_happen, something } from "./decl.h.macros.js";
import { COIN_CLASS, MAXOCLASSES, POTION_CLASS, VENOM_CLASS } from "./defsym.h.js";
import { canspotmon, mon_to_glyph, obj_to_glyph } from "./display.h.macros.js";
import {
    AUTOUNLOCK_APPLY_KEY, AUTOUNLOCK_FORCE, AUTOUNLOCK_UNTRAP, PLNMSG_BACK_ON_GROUND,
    PLNMSG_OBJNAM_ONLY,
} from "./flag.h.js";
import { ParanoidAutoAll, ParanoidConfirm } from "./flag.h.macros.js";
import { BUFSZ, FALSE, LL_ACHIEVE, QBUFSZ, TRUE, boolean, coordxy } from "./global.h.js";
import {
    ALL_TYPES, ALL_TYPES_SELECTED, ARTICLE_THE, AUTOSELECT_SINGLE, BILLED_TYPES, BUCX_TYPES,
    BUC_BLESSED, BUC_CURSED, BUC_UNCURSED, BUC_UNKNOWN, BY_NEXTHERE, CHOOSE_ALL, CQ_CANNED,
    CXN_ARTICLE, CXN_SINGULAR, ECMD_CANCEL, ECMD_OK, ECMD_TIME, EXT_ENCUMBER, FEEL_COCKATRICE, FOOT,
    GETOBJ_ALLOWCNT, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_SELECTABLE, GETOBJ_PROMPT,
    GETOBJ_SUGGEST, HAND, HVY_ENCUMBER, INCLUDE_HERO, INCLUDE_VENOM, INVORDER_SORT, JUSTPICKED,
    KILLED_BY_AN, LOOKHERE_NOFLAGS, LOOKHERE_PICKED_SOME, LOOKHERE_SKIP_DFEATURE, MAY_DESTROY,
    MAY_HIT, MENU_FULL, MENU_PARTIAL, MENU_TRADITIONAL, MM_ADJACENTOK, MM_NOMSG, MOD_ENCUMBER,
    NO_MINVENT, NO_MM_FLAGS, ONAME_NO_FLAGS, SELL_DELIBERATE, SELL_DONTSELL, SELL_NORMAL,
    SIGNAL_ESCAPE, SIGNAL_NOMENU, SLT_ENCUMBER, SORTLOOT_INVLET, SORTLOOT_LOOT, SORTLOOT_PACK,
    SORTLOOT_PETRIFY, SUPPRESS_SADDLE, UNPAID_TYPES, USE_INVLET, WORN_TYPES, invlet_basic, st_all,
    st_corpse, st_gloves, st_petrifies, st_resists, struct_sortloot_item,
} from "./hack.h.js";
import {
    Maybe_Half_Phys, distu, makeknown, max, min, pline1, plur, ynNaq, ynaq, ynq,
} from "./hack.h.macros.js";
import { debugpline0 } from "./lint.h.macros.js";
import { SHOPBASE } from "./mkroom.h.js";
import {
    bigmonst, digests, hides_under, is_rider, nohands, nolimbs, notake, throws_rocks,
    touch_petrifies,
} from "./mondata.h.macros.js";
import { PM_CLERIC, PM_HOUSECAT, PM_ICE_TROLL, PM_STONE_GOLEM } from "./monsters.h.js";
import {
    LOST_DROPPED, LOST_EXPLODING, LOST_STOLEN, LOST_THROWN, OBJ_CONTAINED, OBJ_FLOOR, OBJ_MINVENT,
    struct_obj,
} from "./obj.h.js";
import {
    Has_contents, Is_box, Is_candle, Is_container, Is_mbag, OMONST, SchroedingersBox,
    age_is_relative, carried, has_omonst, is_pick,
} from "./obj.h.macros.js";
import {
    AMULET_OF_YENDOR, BAG_OF_HOLDING, BAG_OF_TRICKS, BELL_OF_OPENING, BOULDER,
    CANDELABRUM_OF_INVOCATION, CAN_OF_GREASE, CHEST, CORPSE, CRAM_RATION, FOOD_RATION, GOLD_PIECE,
    HORN_OF_PLENTY, ICE_BOX, LEASH, LEMBAS_WAFER, LOADSTONE, MAGIC_LAMP, OIL_LAMP, POT_OIL,
    SCR_SCARE_MONSTER, SPE_BOOK_OF_THE_DEAD, SPE_WIZARD_LOCK, STATUE, WAN_CANCELLATION,
} from "./objects.h.js";
import { TIMEOUT, W_ACCESSORY, W_ARMOR, W_SADDLE, W_WEAPONS } from "./prop.h.js";
import { ICE, STONE, T_LOOTED } from "./rm.h.js";
import {
    IS_ALTAR, IS_FURNITURE, IS_GRAVE, IS_LAVA, IS_POOL, IS_THRONE, MON_AT, OBJ_AT, SURFACE_AT,
    Sokoban, fobj, levl, m_at,
} from "./rm.h.macros.js";
import { P_BASIC, P_RIDING } from "./skills.h.js";
import { P_SKILL } from "./skills.h.macros.js";
import { REVIVE_MON, ROT_CORPSE, SHRINK_GLOB } from "./timeout.h.js";
import { is_pit } from "./trap.h.macros.js";
import {
    clear_nhwindow, create_nhwindow, destroy_nhwindow, display_nhwindow, end_menu, putstr,
    start_menu,
} from "./winprocs.h.macros.js";
import {
    ATR_NONE, MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, MENU_ITEMFLAGS_SELECTED,
    MENU_ITEMFLAGS_SKIPINVERT, NHW_MENU, NHW_TEXT, PICK_ANY, PICK_NONE, PICK_ONE, WIN_ERR,
    struct_any, struct_glyphinfo, struct_mi,
} from "./wintype.h.js";
import { Role_if, u_at, uhis } from "./you.h.macros.js";
import {
    Blind, Confusion, HFumbling, Hallucination, Stone_resistance, Stunned, Underwater,
} from "./youprop.h.macros.js";
import { char, int, long, ord, schar, sizeof, sizeof_string, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { assert, free, sprintf, strcat, strchr, strcmp, strcpy, strncmp } from "../rt/libc.js";
import {
    init_list, init_string, stack_array, stack_struct, stack_var, static_array, static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, ptr_add, ptr_to, ref_of, struct_assign, view_of } from "../rt/struct.js";
import { alloc } from "./alloc.js";
import { snuff_lit } from "./apply.js";
import { touch_artifact } from "./artifact.js";
import { exercise } from "./attrib.js";
import { fix_ghostly_obj } from "./bones.js";
import { bot } from "./botl.js";
import { cmdq_add_ec, get_adjacent_loc, isok, paranoid_ynq, yn_function } from "./cmd.js";
import { is_lava, is_pool } from "./dbridge.js";
import {
    cg, disp, flags, ga, gb, gc, gd, gi, gl, gm, gn, go, gp, gs, gt, gv, gy, iflags, svc, svl, svm,
    u, ynqchars,
} from "./decl.js";
import { flush_screen, map_glyphinfo, newsym, newsym_force, nul_glyphinfo } from "./display.js";
import { doaltarobj, dropx, dropy, revive_corpse, trycall } from "./do.js";
import { Monnam, christen_monst, hliquid, mon_nam, oname, rndmonnam, x_monnam } from "./do_name.js";
import { hitfloor } from "./dothrow.js";
import { def_char_to_objclass, def_oc_syms } from "./drawing.js";
import { ceiling, surface } from "./dungeon.js";
import { container_contents, panic } from "./end.js";
import { can_reach_floor, cant_reach_floor, freehand, read_engr_at } from "./engrave.js";
import { more_experienced, newexplevel } from "./exper.js";
import { scatter } from "./explode.js";
import {
    calc_capacity, check_capacity, in_rooms, inv_cnt, losehp, max_capacity, money_cnt,
    near_capacity, nomul, obj_to_any,
} from "./hack.js";
import { strkitten, upstart } from "./hacklib.js";
import {
    addinv, askchain, carrying, consume_obj_charge, count_buc, count_unpaid, currency, dfeature_at,
    display_inventory, feel_cockatrice, freeinv, g_at, getobj, hold_another_object, is_worn,
    let_to_name, look_here, merge_choice, nxtobj, obj_here, prinv, sobj_at, sortloot, tally_BUCX,
    unsortloot, update_inventory, useup, useupf, will_feel_cockatrice,
} from "./invent.js";
import { obj_is_burning } from "./light.js";
import { autokey, boxlock, doforce, pick_lock, u_have_forceable_weapon } from "./lock.js";
import { bagotricks, makemon, set_malign } from "./makemon.js";
import {
    add_to_container, add_to_minv, get_mtraits, hornoplenty, obj_extract_self, set_bknown,
    set_corpsenm, splitobj, start_corpse_timeout, start_glob_timeout, unbless, unsplitobj, weight,
} from "./mkobj.js";
import { courtmon } from "./mkroom.js";
import { hideunder } from "./mon.js";
import { poly_when_stoned, stagger } from "./mondata.js";
import { mons } from "./monst.js";
import { observe_object } from "./o_init.js";
import { objects } from "./objects.js";
import {
    Doname2, The, Tobjnam, Yname2, Ysimple_name2, an, ansimpleoname, corpse_xname, doname,
    doname_with_price, killer_xname, makesingular, otense, safe_qbuf, the, thesimpleoname, vtense,
    xname, yname, ysimple_name,
} from "./objnam.js";
import { self_lookat, waterbody_name } from "./pager.js";
import {
    Norep, There, You, You_cant, Your, impossible, livelog_printf, pline, pline_The, urgent_pline,
    verbalize,
} from "./pline.js";
import { body_part, polymon } from "./polyself.js";
import { d, rn2, rn2_on_display_rng, rnd } from "./rnd.js";
import {
    Shk_Your, addtobill, check_unpaid_usage, costly_spot, obfree, pick_pick, remote_burglary,
    sellobj, sellobj_state, shop_keeper, stolen_value, subfrombill,
} from "./shk.js";
import { tiphat } from "./sounds.js";
import { remove_worn_item } from "./steal.js";
import { rider_cant_reach } from "./steed.js";
import { stop_timer } from "./timeout.js";
import {
    back_on_ground, chest_trap, instapetrify, t_at, uescaped_shaft, unconscious,
    uteetering_at_seen_pit,
} from "./trap.js";
import { setuqwep, setuswapwep, setuwep, welded, weldmsg } from "./wield.js";
import { add_menu, add_menu_heading, add_menu_str, getlin, select_menu } from "./windows.js";
import { extract_from_minvent, which_armor } from "./worn.js";
import { get_obj_location } from "./zap.js";
import { regex_match } from "../sys/share/posixregex.js";
const __FILE__ = "pickup.c";
