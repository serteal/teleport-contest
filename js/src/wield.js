/* NetHack 5.0	wield.c	$NHDT-Date: 1707525193 2024/02/10 00:33:13 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.110 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2009. */
/* NetHack may be freely redistributed.  See license for details. */

/* KMH -- Differences between the three weapon slots.
 *
 * The main weapon (uwep):
 * 1.  Is filled by the (w)ield command.
 * 2.  Can be filled with any type of item.
 * 3.  May be carried in one or both hands.
 * 4.  Is used as the melee weapon and as the launcher for
 *     ammunition.
 * 5.  Only conveys intrinsics when it is a weapon, weapon-tool,
 *     or artifact.
 * 6.  Certain cursed items will weld to the hand and cannot be
 *     unwielded or dropped.  See erodeable_wep() and will_weld()
 *     below for the list of which items apply.
 *
 * The secondary weapon (uswapwep):
 * 1.  Is filled by the e(x)change command, which swaps this slot
 *     with the main weapon.  If the "pushweapon" option is set,
 *     the (w)ield command will also store the old weapon in the
 *     secondary slot.
 * 2.  Can be filled with anything that will fit in the main weapon
 *     slot; that is, any type of item.
 * 3.  Is usually NOT considered to be carried in the hands.
 *     That would force too many checks among the main weapon,
 *     second weapon, shield, gloves, and rings; and it would
 *     further be complicated by bimanual weapons.  A special
 *     exception is made for two-weapon combat.
 * 4.  Is used as the second weapon for two-weapon combat, and as
 *     a convenience to swap with the main weapon.
 * 5.  Never conveys intrinsics.
 * 6.  Cursed items never weld (see #3 for reasons), but they also
 *     prevent two-weapon combat.
 *
 * The quiver (uquiver):
 * 1.  Is filled by the (Q)uiver command.
 * 2.  Can be filled with any type of item.
 * 3.  Is considered to be carried in a special part of the pack.
 * 4.  Is used as the item to throw with the (f)ire command.
 *     This is a convenience over the normal (t)hrow command.
 * 5.  Never conveys intrinsics.
 * 6.  Cursed items never weld; their effect is handled by the normal
 *     throwing code.
 * 7.  The autoquiver option will fill it with something deemed
 *     suitable if (f)ire is used when it's empty.
 *
 * No item may be in more than one of these slots.
 */

/* used by will_weld() */
/* probably should be renamed */
export function erodeable_wep(optr) { return +(optr.oclass == WEAPON_CLASS || is_weptool(optr)
     || optr.otyp == HEAVY_IRON_BALL || optr.otyp == IRON_CHAIN); }

/* used by welded(), and also while wielding */
export function will_weld(optr) { return (optr.cursed && (erodeable_wep(optr) || optr.otyp == TIN_OPENER) ? 1 : 0); }

/* to dual-wield, 'obj' must be a weapon or a weapon-tool, and not a bow
   or arrow or missile (dart, shuriken, boomerang), so not matching the
   one-handed weapons which yield "you begin bashing" if used for melee;
   empty hands and two-handed weapons have to be handled separately */
export function TWOWEAPOK(obj) { return ((obj.oclass == WEAPON_CLASS)
     ? +!(is_launcher(obj) || is_ammo(obj) || is_missile(obj))
     : is_weptool(obj)); }

const are_no_longer_twoweap = init_string(static_array("are_no_longer_twoweap", char, sizeof_string("are no longer using two weapons at once")), _("are no longer using two weapons at once"), true);
const can_no_longer_twoweap = init_string(static_array("can_no_longer_twoweap", char, sizeof_string("can no longer wield two weapons at once")), _("can no longer wield two weapons at once"), true);

/*** Functions that place a given item in a slot ***/
/* Proper usage includes:
 * 1.  Initializing the slot during character generation or a
 *     restore.
 * 2.  Setting the slot due to a player's actions.
 * 3.  If one of the objects in the slot is split off, these
 *     functions can be used to put the remainder back in the slot.
 * 4.  Putting an item that was thrown and returned back into the slot.
 * 5.  Emptying the slot, by passing a null object.  NEVER pass
 *     cg.zeroobj!
 *
 * If the item is being moved from another slot, it is the caller's
 * responsibility to handle that.  It's also the caller's responsibility
 * to print the appropriate messages.
 */
export function setuwep(obj) { /* void */
    let olduwep = uwep;

    if (obj == uwep)
        return; /* necessary to not set gu.unweapon */
    setworn(obj, W_WEP);
    /* handle Ogresmasher before Sunsword; even though they can't be happening
       at the same time, botl flag update should come before pline message */
    if (uwep == obj
        && ((uwep && uwep.oartifact == ART_OGRESMASHER)
            || (olduwep && olduwep.oartifact == ART_OGRESMASHER)))
        disp.botl = TRUE; /* gaining or losing Con bonus */
    /* This message isn't printed in the caller because it happens
     * *whenever* Sunsword is unwielded, from whatever cause. */
    if (uwep == obj && artifact_light(olduwep) && olduwep.lamplit) {
        end_burn(olduwep, FALSE);
        if (!Blind())
            pline(_("%s shining."), Tobjnam(olduwep, _("stop")));
    }
    if (uwep == obj
        && (u_wield_art(ART_OGRESMASHER)
            || is_art(olduwep, ART_OGRESMASHER)))
        disp.botl = TRUE;
    /* Note: Explicitly wielding a pick-axe will not give a "bashing"
     * message.  Wielding one via 'a'pplying it will.
     * 3.2.2:  Wielding arbitrary objects will give bashing message too.
     */
    if (obj) {
        gu.unweapon = (obj.oclass == WEAPON_CLASS)
                       ? (is_launcher(obj) || is_ammo(obj) || is_missile(obj)
            || (is_pole(obj) && !u.usteed && !is_art(obj, ART_SNICKERSNEE)) ? 1 : 0)
                       : +(!is_weptool(obj) && !is_wet_towel(obj));
    } else
        gu.unweapon = TRUE; /* for "bare hands" message */
}

function cant_wield_corpse(obj) { /* boolean */
    const $frame = stack_frame(); try {
    let kbuf = stack_array(char, BUFSZ);

    if (uarmg || obj.otyp != CORPSE || !touch_petrifies(mons[obj.corpsenm])
        || Stone_resistance())
        return FALSE;

    /* Prevent wielding cockatrice when not wearing gloves --KAA */
    You(_("wield %s in your bare %s."),
        corpse_xname(obj, 0, CXN_PFX_THE),
        makeplural(body_part(HAND)));
    sprintf(kbuf, _("wielding %s bare-handed"), killer_xname(obj));
    instapetrify(kbuf);
    return TRUE;
    } finally { stack_pop($frame); }
}

/* description of hands when not wielding anything; also used
   by #seeweapon (')'), #attributes (^X), and #takeoffall ('A') */
export function empty_handed() { /* const char * */
    return uarmg ? _("empty handed") /* gloves imply hands */
           : humanoid(gy.youmonst.data)
             /* hands but no weapon and no gloves */
             ? _("bare handed")
               /* alternate phrasing for paws or lack of hands */
               : _("not wielding anything");
}

function ready_weapon(wep$) { /* int */
    const $frame = stack_frame(); try {
    const wep = stack_var(ptr_to(struct_obj), wep$);
    /* Separated function so swapping works easily */
    let res = ECMD_OK;
    let was_twoweap = u.twoweap, had_wep = +(uwep != null);

    if (!wep[0]) {
        /* No weapon */
        if (uwep) {
            You(_("are %s."), empty_handed());
            setuwep(null);
            res = ECMD_TIME;
        } else
            You(_("are already %s."), empty_handed());
    } else if (wep[0].otyp == CORPSE && cant_wield_corpse(wep[0])) {
        /* hero must have been life-saved to get here; use a turn */
        res = ECMD_TIME; /* corpse won't be wielded */
    } else if (uarms && bimanual(wep[0])) {
        You(_("cannot wield a two-handed %s while wearing a shield."),
            is_sword(wep[0]) ? _("sword") : wep[0].otyp == BATTLE_AXE ? _("axe")
                                                              : _("weapon"));
        res = ECMD_FAIL;
    } else if (!retouch_object(wep, FALSE)) {
        res = ECMD_TIME; /* takes a turn even though it doesn't get wielded */
    } else {
        /* Weapon WILL be wielded after this point */
        res = ECMD_TIME;
        if (will_weld(wep[0])) {
            let tmp = xname(wep[0]), thestr = _("The ");

            if (strncmp(tmp, thestr, 4) && !strncmp(The(tmp), thestr, 4))
                tmp = thestr;
            else
                tmp = _("");
            pline(_("%s%s %s to your %s%s!"), tmp, aobjnam(wep[0], _("weld")),
                  (wep[0].quan == 1) ? _("itself") : _("themselves"), /* a3 */
                  bimanual(wep[0]) ? _("") :
                      (URIGHTY() ? _("dominant right ") : _("dominant left ")),
                  bimanual(wep[0]) ? makeplural(body_part(HAND))
                                : body_part(HAND));
            set_bknown(wep[0], 1);
        } else {
            /* The message must be printed before setuwep (since
             * you might die and be revived from changing weapons),
             * and the message must be before the death message and
             * Lifesaved rewielding.  Yet we want the message to
             * say "weapon in hand", thus this kludge.
             * [That comment is obsolete.  It dates from the days (3.0)
             * when unwielding Firebrand could cause hero to be burned
             * to death in Hell due to loss of fire resistance.
             * "Lifesaved re-wielding or re-wearing" is ancient history.]
             */
            let dummy = wep[0].owornmask;

            wep[0].owornmask = or64(wep[0].owornmask, W_WEP);
            if (wep[0].otyp == AKLYS && (wep[0].owornmask & W_WEP) != 0)
                You(_("secure the tether."));
            prinv(0, wep[0], 0);
            wep[0].owornmask = dummy;
        }

        setuwep(wep[0]);
        if (was_twoweap && !u.twoweap && flags.verbose) {
            /* skip this message if we already got "empty handed" one above;
               also, Null is not safe for neither TWOWEAPOK() or bimanual() */
            if (uwep)
                You(_("%s."), ((TWOWEAPOK(uwep) && !bimanual(uwep))
                            ? are_no_longer_twoweap
                            : can_no_longer_twoweap));
        }

        /* KMH -- Talking artifacts are finally implemented */
        if (wep[0].oartifact) {
            res |= arti_speak(wep[0]); /* sets ECMD_TIME bit if artifact speaks */
        }

        if (artifact_light(wep[0]) && !wep[0].lamplit) {
            begin_burn(wep[0], FALSE);
            if (!Blind())
                pline(_("%s to shine %s!"), Tobjnam(wep[0], _("begin")),
                      arti_light_description(wep[0]));
        }

        if (wep[0].unpaid) {
            let this_shkp;

            if ((this_shkp = shop_keeper(inside_shop(u.ux, u.uy)))
                != null) {
                pline(_("%s says \"You be careful with my %s!\""),
                      shkname(this_shkp), xname(wep[0]));
            }
        }
    }
    if ((had_wep != +(uwep != null)) && condtests[bl_bareh].enabled)
        disp.botl = TRUE;
    return res;
    } finally { stack_pop($frame); }
}

export function setuqwep(obj) { /* void */
    setworn(obj, W_QUIVER);
    /* no extra handling needed; this used to include a call to
       update_inventory() but that's already performed by setworn() */
    return;
}

export function setuswapwep(obj) { /* void */
    setworn(obj, W_SWAPWEP);
    return;
}

/* getobj callback for object to ready for throwing/shooting;
   this filter lets worn items through so that caller can reject them */
function ready_ok(obj) { /* int */
    if (!obj) /* '-', will empty quiver slot if chosen */
        return uquiver ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY;

    /* downplay when wielded, unless more than one */
    if (obj == uwep || (obj == uswapwep && u.twoweap))
        return (obj.quan == 1) ? GETOBJ_DOWNPLAY : GETOBJ_SUGGEST;

    if (is_ammo(obj)) {
        return ((uwep && ammo_and_launcher(obj, uwep))
                || (uswapwep && ammo_and_launcher(obj, uswapwep)))
                ? GETOBJ_SUGGEST
                : GETOBJ_DOWNPLAY;
    } else if (is_launcher(obj)) { /* part of 'possible extension' below */
        return GETOBJ_DOWNPLAY;
    } else {
        if (obj.oclass == WEAPON_CLASS || obj.oclass == COIN_CLASS)
            return GETOBJ_SUGGEST;
        /* Possible extension: exclude weapons that make no sense to throw,
           such as whips, bows, slings, rubber hoses. */
    }

    return GETOBJ_DOWNPLAY;
}

/* getobj callback for object to wield */
function wield_ok(obj) { /* int */
    if (!obj)
        return GETOBJ_SUGGEST;

    if (obj.oclass == COIN_CLASS)
        return GETOBJ_EXCLUDE;

    if (obj.oclass == WEAPON_CLASS || is_weptool(obj))
        return GETOBJ_SUGGEST;

    return GETOBJ_DOWNPLAY;
}

function finish_splitting(obj) { /* void */
    /* obj was split off from something; give it its own invlet */
    freeinv(obj);
    addinv_nomerge(obj);
}

/* the #wield command - wield a weapon */
export function dowield() { /* int */
    const $frame = stack_frame(); try {
    let $goto = null; var qbuf = stack_array(char, QBUFSZ);

    var wep, oldwep;
    var result;

    /* May we attempt this? */
    gm.multi = 0;
    if (cantwield(gy.youmonst.data)) {
        pline(_("Don't be ridiculous!"));
        return ECMD_FAIL;
    }
    /* Keep going even if inventory is completely empty, since wielding '-'
       to wield nothing can be construed as a positive act even when done
       so redundantly. */

    /* Prompt for a new weapon */
    clear_splitobjs();
    $goto_already_wielded: for (;;) { switch ($goto) { default: case "already_wielded": if (!$goto && (!(wep = getobj(_("wield"), wield_ok, GETOBJ_PROMPT | GETOBJ_ALLOWCNT)))) {
        /* Cancelled */
        return ECMD_CANCEL;
    } else if ($goto || (wep == uwep)) {
 $goto = null;
        You(_("are already wielding that!"));
        if (is_weptool(wep) || is_wet_towel(wep))
            gu.unweapon = FALSE; /* [see setuwep()] */
        return ECMD_FAIL;
    } else if (welded(uwep)) {
        weldmsg(uwep);
        /* previously interrupted armor removal mustn't be resumed */
        reset_remarm();
        /* if player chose a partial stack but can't wield it, undo split */
        if (wep.o_id && wep.o_id == svc.context.objsplit.child_oid)
            unsplitobj(wep);
        return ECMD_FAIL;
    } else if (wep.o_id && wep.o_id == svc.context.objsplit.child_oid) {
        /* if wep is the result of supplying a count to getobj()
           we don't want to split something already wielded; for
           any other item, we need to give it its own inventory slot */
        if (uwep && uwep.o_id == svc.context.objsplit.parent_oid) {
            unsplitobj(wep);
            /* wep was merged back to uwep, already_wielded uses wep */
            wep = uwep;
            { $goto = "already_wielded"; continue $goto_already_wielded; }
        }
        finish_splitting(wep);
        { $goto = "wielding"; continue $goto_already_wielded; }
    }

    /* Handle no object, or object in other slot */
    if (wep == hands_obj) {
        wep = null;
    } else if (wep == uswapwep) {
        return doswapweapon();
    } else if (wep == uquiver) {
        /* offer to split stack if multiple are quivered */
        if (uquiver.quan > 1 && inv_cnt(FALSE) < invlet_basic
                                    && splittable(uquiver)) {
            sprintf(qbuf, _("You have %lld %s readied.  Wield one?"), uquiver.quan, simpleonames(uquiver))
;
            switch (ynq(qbuf)) {
            case ord('q'):
                return ECMD_OK;
            case ord('y'):
                /* leave N-1 quivered, split off 1 to wield */
                wep = splitobj(uquiver, 1);
                finish_splitting(wep);
                { $goto = "wielding"; continue $goto_already_wielded; }
            default:
                break;
            }
            strcpy(qbuf, _("Wield all of them instead?"));
        } else {
            var use_plural = +(is_plural(uquiver) || pair_of(uquiver));

            sprintf(qbuf, _("You have %s readied.  Wield %s instead?"), !use_plural ? _("that") : _("those"), !use_plural ? _("it") : _("them"))

;
        }
        /* require confirmation to wield the quivered weapon */
        if (ynq(qbuf) != ord('y')) {
            Shk_Your(qbuf, uquiver); /* replace qbuf[] contents */
            pline(_("%s%s %s readied."), qbuf,
                  simpleonames(uquiver), otense(uquiver, _("remain")));
            return ECMD_OK;
        }
        /* wielding whole readied stack, so no longer quivered */
        setuqwep(null);
    } else if (wep.owornmask & (W_ARMOR | W_ACCESSORY | W_SADDLE)) {
        You(_("cannot wield that!"));
        return ECMD_FAIL;
    }

 case "wielding": $goto = null;
    /* Set your new primary weapon */
    oldwep = uwep; } break; }
    result = ready_weapon(wep);
    if (flags.pushweapon && oldwep && uwep != oldwep)
        setuswapwep(oldwep);
    untwoweapon();

    return result;
    } finally { stack_pop($frame); }
}

/* the #swap command - swap wielded and secondary weapons */
export function doswapweapon() { /* int */
    let oldwep, oldswap;
    let result = 0;

    /* May we attempt this? */
    gm.multi = 0;
    if (cantwield(gy.youmonst.data)) {
        pline(_("Don't be ridiculous!"));
        return ECMD_FAIL;
    }
    if (welded(uwep)) {
        weldmsg(uwep);
        return ECMD_FAIL;
    }

    /* Unwield your current secondary weapon */
    oldwep = uwep;
    oldswap = uswapwep;
    setuswapwep(null);

    /* Set your new primary weapon */
    result = ready_weapon(oldswap);

    /* Set your new secondary weapon */
    if (uwep == oldwep) {
        /* Wield failed for some reason */
        setuswapwep(oldswap);
    } else {
        setuswapwep(oldwep);
        if (uswapwep)
            prinv(0, uswapwep, 0);
        else
            You(_("have no secondary weapon readied."));
    }

    if (u.twoweap && !can_twoweapon())
        untwoweapon();

    return result;
}

/* the #quiver command */
export function dowieldquiver() { /* int */
    return doquiver_core(_("ready"));
}

/* guts of #quiver command; also used by #fire when refilling empty quiver */
export function doquiver_core(verb) { /* int */ /* "ready" or "fire" */
    const $frame = stack_frame(); try {
    let $goto = null; var qbuf = stack_array(char, QBUFSZ);

    var newquiver;
    var res;
    var was_uwep = FALSE, was_twoweap = u.twoweap;

    /* Since the quiver isn't in your hands, don't check cantwield(),
       will_weld(), touch_petrifies(), etc. */
    gm.multi = 0;
    if (!gi.invent) {
        /* could accept '-' to empty quiver, but there's no point since
           inventory is empty so uquiver is already Null */
        You(_("have nothing to ready for firing."));
        return ECMD_OK;
    }

    /* forget last splitobj() before calling getobj() with GETOBJ_ALLOWCNT */
    clear_splitobjs();
    /* Prompt for a new quiver: "What do you want to {ready|fire}?" */
    newquiver = getobj(verb, ready_ok, GETOBJ_PROMPT | GETOBJ_ALLOWCNT);

    $goto_already_quivered: for (;;) { switch ($goto) { default: case "already_quivered": if (!$goto && (!newquiver)) {
        /* Cancelled */
        return ECMD_CANCEL;
    } else if (!$goto && (newquiver == hands_obj)) { /* no object */
        /* Explicitly nothing */
        if (uquiver) {
            You(_("now have no ammunition readied."));
            /* skip 'quivering: prinv()' */
            setuqwep(null);
        } else {
            You(_("already have no ammunition readied!"));
        }
        return ECMD_OK;
    } else if (!$goto && (newquiver.o_id == svc.context.objsplit.child_oid)) {
        /* if newquiver is the result of supplying a count to getobj()
           we don't want to split something already in the quiver;
           for any other item, we need to give it its own inventory slot */
        if (uquiver && uquiver.o_id == svc.context.objsplit.parent_oid) {
            unsplitobj(newquiver);
            { $goto = "already_quivered"; continue $goto_already_quivered; }
        } else if (newquiver.oclass == COIN_CLASS) {
            /* don't allow splitting a stack of coins into quiver */
            You(_("can't ready only part of your gold."));
            unsplitobj(newquiver);
            return ECMD_OK;
        }
        finish_splitting(newquiver);
    } else if ($goto || (newquiver == uquiver)) {
 $goto = null;
        pline(_("That ammunition is already readied!"));
        return ECMD_OK;
    } else if (newquiver.owornmask & (W_ARMOR | W_ACCESSORY | W_SADDLE)) {
        You(_("cannot %s that!"), verb);
        return ECMD_OK;
    } else if (newquiver == uwep) {
        var weld_res = +!uwep.bknown;

        if (welded(uwep)) {
            weldmsg(uwep);
            reset_remarm(); /* same as dowield() */
            return weld_res ? ECMD_TIME : ECMD_OK;
        }
        /* offer to split stack if wielding more than 1 */
        if (uwep.quan > 1 && inv_cnt(FALSE) < invlet_basic
                                    && splittable(uwep)) {
            sprintf(qbuf, _("You are wielding %lld %s.  Ready %lld of them?"), uwep.quan, simpleonames(uwep), uwep.quan - 1)
;
            switch (ynq(qbuf)) {
            case ord('q'):
                return ECMD_OK;
            case ord('y'):
                /* leave 1 wielded, split rest off and put into quiver */
                newquiver = splitobj(uwep, uwep.quan - 1);
                finish_splitting(newquiver);
                { $goto = "quivering"; continue $goto_already_quivered; }
            default:
                break;
            }
            strcpy(qbuf, _("Ready all of them instead?"));
        } else {
            var use_plural = +(is_plural(uwep) || pair_of(uwep));

            sprintf(qbuf, _("You are wielding %s.  Ready %s instead?"), !use_plural ? _("that") : _("those"), !use_plural ? _("it") : _("them"))

;
        }
        /* require confirmation to ready the main weapon */
        if (ynq(qbuf) != ord('y')) {
            Shk_Your(qbuf, uwep); /* replace qbuf[] contents */
            pline(_("%s%s %s wielded."), qbuf,
                  simpleonames(uwep), otense(uwep, _("remain")));
            return ECMD_OK;
        }
        /* quivering main weapon, so no longer wielding it */
        setuwep(null);
        untwoweapon();
        was_uwep = TRUE;
    } else if (newquiver == uswapwep) {
        if (uswapwep.quan > 1 && inv_cnt(FALSE) < invlet_basic
            && splittable(uswapwep)) {
            sprintf(qbuf, _("%s %lld %s.  Ready %lld of them?"), u.twoweap ? _("You are dual wielding")
                              : _("Your alternate weapon is"), uswapwep.quan, simpleonames(uswapwep), uswapwep.quan - 1)

;
            switch (ynq(qbuf)) {
            case ord('q'):
                return ECMD_OK;
            case ord('y'):
                /* leave 1 alt-wielded, split rest off and put into quiver */
                newquiver = splitobj(uswapwep, uswapwep.quan - 1);
                finish_splitting(newquiver);
                { $goto = "quivering"; continue $goto_already_quivered; }
            default:
                break;
            }
            strcpy(qbuf, _("Ready all of them instead?"));
        } else {
            var use_plural = +(is_plural(uswapwep) || pair_of(uswapwep));

            sprintf(qbuf, _("%s your %s weapon.  Ready %s instead?"), !use_plural ? _("That is") : _("Those are"), u.twoweap ? _("second") : _("alternate"), !use_plural ? _("it") : _("them"))

;
        }
        /* require confirmation to ready the alternate weapon */
        if (ynq(qbuf) != ord('y')) {
            Shk_Your(qbuf, uswapwep); /* replace qbuf[] contents */
            pline(_("%s%s %s %s."), qbuf,
                  simpleonames(uswapwep), otense(uswapwep, _("remain")),
                  u.twoweap ? _("wielded") : _("as secondary weapon"));
            return ECMD_OK;
        }
        /* quivering alternate weapon, so no more uswapwep */
        setuswapwep(null);
        untwoweapon();
    }

 case "quivering": $goto = null;
    if (!strcmp(verb, _("ready"))) {
        /* place item in quiver before printing so that inventory feedback
           includes "(at the ready)" */
        setuqwep(newquiver);
        prinv(0, newquiver, 0);
    } else { /* verb=="fire", manually refilling quiver during 'f'ire */
        /* prefix item with description of action, so don't want that to
           include "(at the ready)" */
        prinv(_("You ready:"), newquiver, 0);
        setuqwep(newquiver);
    } } break; }

    /* quiver is a convenience slot and manipulating it ordinarily
       consumes no time, but unwielding primary or secondary weapon
       should take time (perhaps we're adjacent to a rust monster
       or disenchanter and want to hit it immediately, but not with
       something we're wielding that's vulnerable to its damage) */
    res = 0;
    if (was_uwep) {
        You(_("are now %s."), empty_handed());
        res = 1;
    } else if (was_twoweap && !u.twoweap) {
        You(_("%s."), are_no_longer_twoweap);
        res = 1;
    }
    return res ? ECMD_TIME : ECMD_OK;
    } finally { stack_pop($frame); }
}

/* used for #rub and for applying pick-axe, whip, grappling hook or polearm */
export function wield_tool(obj,
           verb) { /* boolean */ /* "rub",&c */
    let what;
    let more_than_1;

    if (uwep && obj == uwep)
        return TRUE; /* nothing to do if already wielding it */

    if (!verb)
        verb = _("wield");
    what = xname(obj);
    more_than_1 = +(obj.quan > 1 || strstri(what, _("pair of ")) != 0
                   || strstri(what, _("s of ")) != 0);

    if (obj.owornmask & (W_ARMOR | W_ACCESSORY)) {
        You_cant(_("%s %s while wearing %s."), verb, yname(obj),
                 more_than_1 ? _("them") : _("it"));
        return FALSE;
    }
    if (uwep && welded(uwep)) {
        if (flags.verbose) {
            let hand = body_part(HAND);

            if (bimanual(uwep))
                hand = makeplural(hand);
            if (strstri(what, _("pair of ")) != 0)
                more_than_1 = FALSE;
            pline(
               _("Since your weapon is welded to your %s, you cannot %s %s %s."),
                  hand, verb, more_than_1 ? _("those") : _("that"), xname(obj));
        } else {
            You_cant(_("do that."));
        }
        return FALSE;
    }
    if (cantwield(gy.youmonst.data)) {
        You_cant(_("hold %s strongly enough."), more_than_1 ? _("them") : _("it"));
        return FALSE;
    }
    /* check shield */
    if (uarms && bimanual(obj)) {
        You(_("cannot %s a two-handed %s while wearing a shield."), verb,
            (obj.oclass == WEAPON_CLASS) ? _("weapon") : _("tool"));
        return FALSE;
    }

    if (uquiver == obj)
        setuqwep(null);
    if (uswapwep == obj) {
        doswapweapon();
        /* doswapweapon might fail */
        if (uswapwep == obj)
            return FALSE;
    } else {
        let oldwep = uwep;

        if (will_weld(obj)) {
            /* hope none of ready_weapon()'s early returns apply here... */
            ready_weapon(obj);
        } else {
            You(_("now wield %s."), doname(obj));
            setuwep(obj);
        }
        if (flags.pushweapon && oldwep && uwep != oldwep)
            setuswapwep(oldwep);
    }
    if (uwep && uwep != obj)
        return FALSE; /* rewielded old object after dying */
    /* applying weapon or tool that gets wielded ends two-weapon combat */
    if (u.twoweap)
        untwoweapon();
    if (obj.oclass != WEAPON_CLASS)
        gu.unweapon = TRUE;
    return TRUE;
}

export function can_twoweapon() { /* int */
    let otmp;

    if (!could_twoweap(gy.youmonst.data)) {
        if (Upolyd())
            You_cant(_("use two weapons in your current form."));
        else
            pline(_("%s aren't able to use two weapons at once."),
                  makeplural((flags.female && gu.urole.name.f)
                             ? gu.urole.name.f : gu.urole.name.m));
    } else if (!uwep || !uswapwep) {
        let hand_s = body_part(HAND);

        if (!uwep && !uswapwep)
            hand_s = makeplural(hand_s);
        /* "your hands are empty" or "your {left|right} hand is empty" */
        Your(_("%s%s %s empty."), uwep ? _("left ") : uswapwep ? _("right ") : _(""),
             hand_s, vtense(hand_s, _("are")));
    } else if (!TWOWEAPOK(uwep) || !TWOWEAPOK(uswapwep)) {
        otmp = !TWOWEAPOK(uwep) ? uwep : uswapwep;
        pline(_("%s %s suitable %s weapon%s."), Yname2(otmp),
              is_plural(otmp) ? _("aren't") : _("isn't a"),
              (otmp == uwep) ? _("primary") : _("secondary"),
              plur(otmp.quan));
    } else if (bimanual(uwep) || bimanual(uswapwep)) {
        otmp = bimanual(uwep) ? uwep : uswapwep;
        pline(_("%s isn't one-handed."), Yname2(otmp));
    } else if (uarms) {
        You_cant(_("use two weapons while wearing a shield."));
    } else if (uswapwep.oartifact) {
        pline(_("%s being held second to another weapon!"),
              Yobjnam2(uswapwep, _("resist")));
    } else if (uswapwep.otyp == CORPSE && cant_wield_corpse(uswapwep)) {
        /* [Note: !TWOWEAPOK() check prevents ever getting here...] */
        ; /* must be life-saved to reach here; return FALSE */
    } else if (Glib() || uswapwep.cursed) {
        if (!Glib())
            set_bknown(uswapwep, 1);
        drop_uswapwep();
    } else
        return TRUE;
    return FALSE;
}

/* uswapwep has become cursed while in two-weapon combat mode or hero is
   attempting to dual-wield when it is already cursed or hands are slippery */
export function drop_uswapwep() { /* void */
    const $frame = stack_frame(); try {
    let left_hand = stack_array(char, QBUFSZ);
    let obj = uswapwep;

    /* this used to use makeplural(body_part(HAND)) but in order to be
       dual-wielded, or to get this far attempting to achieve that,
       uswapwep must be one-handed; since it's secondary, the hand must
       be the left one */
    sprintf(left_hand, _("left %s"), body_part(HAND));
    if (!obj.cursed)
        /* attempting to two-weapon while Glib */
        pline(_("%s from your %s!"), Yobjnam2(obj, _("slip")), left_hand);
    else if (!u.twoweap)
        /* attempting to two-weapon when uswapwep is cursed */
        pline(_("%s your grasp and %s from your %s!"),
              Yobjnam2(obj, _("evade")), otense(obj, _("drop")), left_hand);
    else
        /* already two-weaponing but can't anymore because uswapwep has
           become cursed */
        Your(_("%s spasms and drops %s!"), left_hand, yobjnam(obj, 0));
    dropx(obj);
    } finally { stack_pop($frame); }
}

export function set_twoweap(on_off) { /* void */
    if (on_off != u.twoweap) {
        u.twoweap = on_off;
        if (flags.weaponstatus)
            disp.botl = TRUE;
    }
}

/* the #twoweapon command */
export function dotwoweapon() { /* int */
    /* You can always toggle it off */
    if (u.twoweap) {
        You(_("switch to your primary weapon."));
        set_twoweap(FALSE); /* u.twoweap = FALSE */
        update_inventory();
        return ECMD_OK;
    }

    /* May we use two weapons? */
    if (can_twoweapon()) {
        /* Success! */
        You(_("begin two-weapon combat."));
        set_twoweap(TRUE); /* u.twoweap = TRUE */
        update_inventory();
        return (rnd(20) > ACURR(A_DEX)) ? ECMD_TIME : ECMD_OK;
    }
    return ECMD_OK;
}

/*** Functions to empty a given slot ***/
/* These should be used only when the item can't be put back in
 * the slot by life saving.  Proper usage includes:
 * 1.  The item has been eaten, stolen, burned away, or rotted away.
 * 2.  Making an item disappear for a bones pile.
 */
export function uwepgone() { /* void */
    if (uwep) {
        if (artifact_light(uwep) && uwep.lamplit) {
            end_burn(uwep, FALSE);
            if (!Blind())
                pline(_("%s shining."), Tobjnam(uwep, _("stop")));
        }
        setworn(null, W_WEP);
        gu.unweapon = TRUE;
        update_inventory();
    }
}

export function uswapwepgone() { /* void */
    if (uswapwep) {
        setworn(null, W_SWAPWEP);
        update_inventory();
    }
}

export function uqwepgone() { /* void */
    if (uquiver) {
        setworn(null, W_QUIVER);
        update_inventory();
    }
}

export function untwoweapon() { /* void */
    if (u.twoweap) {
        You(_("%s."), can_no_longer_twoweap);
        set_twoweap(FALSE); /* u.twoweap = FALSE */
        update_inventory();
    }
    return;
}

/* enchant wielded weapon */
export function chwepon(otmp, amount) { /* int */
    const $frame = stack_frame(); try {
    let color = hcolor((amount < 0) ? NH_BLACK() : NH_BLUE());
    let xtime, wepname = _("");
    let multiple;
    let otyp = STRANGE_OBJECT;

    if (!uwep || (uwep.oclass != WEAPON_CLASS && !is_weptool(uwep))) {
        let buf = stack_array(char, BUFSZ);

        if (amount >= 0 && uwep && will_weld(uwep)) { /* cursed tin opener */
            if (!Blind()) {
                sprintf(buf, _("%s with %s aura."), Yobjnam2(uwep, _("glow")), an(hcolor(NH_AMBER())))
;
                uwep.bknown = +!Hallucination(); /* ok to bypass set_bknown() */
            } else {
                /* cursed tin opener is wielded in right hand */
                sprintf(buf, _("Your right %s tingles."), body_part(HAND));
            }
            uncurse(uwep);
            update_inventory();
        } else {
            sprintf(buf, _("Your %s %s."), makeplural(body_part(HAND)), (amount >= 0) ? _("twitch") : _("itch"))
;
        }
        strange_feeling(otmp, buf); /* pline()+docall()+useup() */
        exercise(A_DEX, (+(amount >= 0)));
        return 0;
    }

    if (otmp && otmp.oclass == SCROLL_CLASS)
        otyp = otmp.otyp;

    if (uwep.otyp == WORM_TOOTH && amount >= 0) {
        multiple = +(uwep.quan > 1);
        /* order: message, transformation, shop handling */
        Your(_("%s %s much sharper now."), simpleonames(uwep),
             multiple ? _("fuse, and become") : _("is"));
        uwep.otyp = CRYSKNIFE;
        uwep.oerodeproof = 0;
        if (multiple) {
            uwep.quan = 1;
            uwep.owt = unsigned(weight(uwep));
        }
        if (uwep.cursed)
            uncurse(uwep);
        /* update shop bill to reflect new higher value */
        if (uwep.unpaid)
            alter_cost(uwep, 0);
        if (otyp != STRANGE_OBJECT)
            makeknown(otyp);
        if (multiple)
            encumber_msg();
        return 1;
    } else if (uwep.otyp == CRYSKNIFE && amount < 0) {
        multiple = +(uwep.quan > 1);
        /* order matters: message, shop handling, transformation */
        Your(_("%s %s much duller now."), simpleonames(uwep),
             multiple ? _("fuse, and become") : _("is"));
        costly_alteration(uwep, COST_DEGRD); /* DECHNT? other? */
        uwep.otyp = WORM_TOOTH;
        uwep.oerodeproof = 0;
        if (multiple) {
            uwep.quan = 1;
            uwep.owt = unsigned(weight(uwep));
        }
        if (otyp != STRANGE_OBJECT && otmp.bknown)
            makeknown(otyp);
        if (multiple)
            encumber_msg();
        return 1;
    }

    if (has_oname(uwep))
        wepname = ONAME(uwep);
    if (amount < 0 && uwep.oartifact && restrict_name(uwep, wepname)) {
        if (!Blind())
            pline(_("%s %s."), Yobjnam2(uwep, _("faintly glow")), color);
        return 1;
    }
    /* there is a (soft) upper and lower limit to uwep->spe */
    if (((uwep.spe > 5 && amount >= 0) || (uwep.spe < -5 && amount < 0))
        && rn2(3)) {
        if (!Blind())
            pline(_("%s %s for a while and then %s."),
                  Yobjnam2(uwep, _("violently glow")), color,
                  otense(uwep, _("evaporate")));
        else
            pline(_("%s."), Yobjnam2(uwep, _("evaporate")));

        useupall(uwep); /* let all of them disappear */
        return 1;
    }
    if (!Blind()) {
        xtime = (amount * amount == 1) ? _("moment") : _("while");
        pline(_("%s %s for a %s."),
              Yobjnam2(uwep, amount == 0 ? _("violently glow") : _("glow")), color,
              xtime);
        if (otyp != STRANGE_OBJECT && uwep.known
            && (amount > 0 || (amount < 0 && otmp.bknown)))
            makeknown(otyp);
    }
    if (amount < 0)
        costly_alteration(uwep, COST_DECHNT);
    uwep.spe += amount;
    if (amount > 0) {
        if (uwep.cursed)
            uncurse(uwep);
        /* update shop bill to reflect new higher price */
        if (uwep.unpaid)
            alter_cost(uwep, 0);
    }

    /*
     * Enchantment, which normally improves a weapon, has an
     * additional adverse reaction on Magicbane whose effects are
     * spe dependent.  Give an obscure clue here.
     */
    if (u_wield_art(ART_MAGICBANE) && uwep.spe >= 0) {
        Your(_("right %s %sches!"), body_part(HAND),
             (((amount > 1) && (uwep.spe > 1)) ? _("flin") : _("it")));
    }

    /* an elven magic clue, cookie@keebler */
    /* elven weapons vibrate warningly when enchanted beyond a limit */
    if ((uwep.spe > 5)
        && (is_elven_weapon(uwep) || uwep.oartifact || !rn2(7)))
        pline(_("%s unexpectedly."), Yobjnam2(uwep, _("suddenly vibrate")));

    return 1;
    } finally { stack_pop($frame); }
}

export function welded(obj) { /* int */
    if (obj && obj == uwep && will_weld(obj)) {
        set_bknown(obj, 1);
        return 1;
    }
    return 0;
}

export function weldmsg(obj) { /* void */
    let savewornmask;
    let hand = body_part(HAND);

    if (bimanual(obj))
        hand = makeplural(hand);
    savewornmask = obj.owornmask;
    obj.owornmask = 0; /* suppress doname()'s "(weapon in hand)";
                          * Yobjnam2() doesn't actually need this because
                          * it is based on xname() rather than doname() */
    pline(_("%s welded to your %s!"), Yobjnam2(obj, _("are")), hand);
    obj.owornmask = savewornmask;
}

/* test whether monster's wielded weapon is stuck to hand/paw/whatever */
export function mwelded(obj) { /* boolean */
    /* caller is responsible for making sure this is a monster's item */
    if (obj && (obj.owornmask & W_WEP) && will_weld(obj))
        return TRUE;
    return FALSE;
}

/*wield.c*/

import { ART_MAGICBANE, ART_OGRESMASHER, ART_SNICKERSNEE } from "./artilist.h.js";
import { A_DEX } from "./attrib.h.js";
import { ACURR } from "./attrib.h.macros.js";
import { bl_bareh } from "./botl.h.js";
import { NH_AMBER, NH_BLACK, NH_BLUE } from "./decl.h.macros.js";
import { COIN_CLASS, SCROLL_CLASS, WEAPON_CLASS } from "./defsym.h.js";
import { BUFSZ, FALSE, QBUFSZ, TRUE } from "./global.h.js";
import {
    COST_DECHNT, COST_DEGRD, CXN_PFX_THE, ECMD_CANCEL, ECMD_FAIL, ECMD_OK, ECMD_TIME,
    GETOBJ_ALLOWCNT, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_PROMPT, GETOBJ_SUGGEST, HAND,
    invlet_basic,
} from "./hack.h.js";
import { makeknown, plur, ynq } from "./hack.h.macros.js";
import { cantwield, could_twoweap, humanoid, touch_petrifies } from "./mondata.h.macros.js";
import { struct_obj } from "./obj.h.js";
import {
    ONAME, ammo_and_launcher, bimanual, has_oname, is_ammo, is_elven_weapon, is_launcher,
    is_missile, is_plural, is_pole, is_sword, is_weptool, is_wet_towel, pair_of, u_wield_art,
} from "./obj.h.macros.js";
import {
    AKLYS, BATTLE_AXE, CORPSE, CRYSKNIFE, HEAVY_IRON_BALL, IRON_CHAIN, STRANGE_OBJECT, TIN_OPENER,
    WORM_TOOTH,
} from "./objects.h.js";
import { W_ACCESSORY, W_ARMOR, W_QUIVER, W_SADDLE, W_SWAPWEP, W_WEP } from "./prop.h.js";
import { URIGHTY, Upolyd } from "./you.h.macros.js";
import { Blind, Glib, Hallucination, Stone_resistance } from "./youprop.h.macros.js";
import { char, ord, sizeof_string, unsigned } from "../rt/ctypes.js";
import { stack_frame, stack_pop } from "../rt/heap.js";
import { or64 } from "../rt/int64.js";
import { sprintf, strcmp, strcpy, strncmp } from "../rt/libc.js";
import { init_string, stack_array, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { ptr_to } from "../rt/struct.js";
import { arti_speak, artifact_light, is_art, restrict_name, retouch_object } from "./artifact.js";
import { exercise } from "./attrib.js";
import { condtests } from "./botl.js";
import { disp, flags, gi, gm, gu, gy, hands_obj, svc, u } from "./decl.js";
import { dropx } from "./do.js";
import { hcolor } from "./do_name.js";
import { reset_remarm } from "./do_wear.js";
import { inv_cnt } from "./hack.js";
import { strstri } from "./hacklib.js";
import {
    addinv_nomerge, freeinv, getobj, prinv, splittable, update_inventory, useupall,
} from "./invent.js";
import { arti_light_description } from "./light.js";
import {
    clear_splitobjs, costly_alteration, set_bknown, splitobj, uncurse, unsplitobj, weight,
} from "./mkobj.js";
import { mons } from "./monst.js";
import {
    The, Tobjnam, Yname2, Yobjnam2, an, aobjnam, corpse_xname, doname, killer_xname, makeplural,
    otense, simpleonames, vtense, xname, yname, yobjnam,
} from "./objnam.js";
import { encumber_msg } from "./pickup.js";
import { You, You_cant, Your, pline } from "./pline.js";
import { body_part } from "./polyself.js";
import { strange_feeling } from "./potion.js";
import { rn2, rnd } from "./rnd.js";
import { Shk_Your, alter_cost, inside_shop, shop_keeper } from "./shk.js";
import { shkname } from "./shknam.js";
import { begin_burn, end_burn } from "./timeout.js";
import { instapetrify } from "./trap.js";
import { setworn } from "./worn.js";
