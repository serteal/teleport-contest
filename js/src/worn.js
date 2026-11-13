/* NetHack 5.0	worn.c	$NHDT-Date: 1770949988 2026/02/12 18:33:08 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.119 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2013. */
/* NetHack may be freely redistributed.  See license for details. */

  const struct_worn = struct("struct_worn", {
    w_mask: long,
    w_obj: ptr_to(ptr_to("struct_obj")),
    w_what: ptr_to(char),
}); const worn = static_array("worn", struct_worn, null, [ { w_mask: W_ARM, w_obj: global_ref("uarm", ptr_to(struct_obj)), w_what: _("suit") },
             { w_mask: W_ARMC, w_obj: global_ref("uarmc", ptr_to(struct_obj)), w_what: _("cloak") },
             { w_mask: W_ARMH, w_obj: global_ref("uarmh", ptr_to(struct_obj)), w_what: _("helmet") },
             { w_mask: W_ARMS, w_obj: global_ref("uarms", ptr_to(struct_obj)), w_what: _("shield") },
             { w_mask: W_ARMG, w_obj: global_ref("uarmg", ptr_to(struct_obj)), w_what: _("gloves") },
             { w_mask: W_ARMF, w_obj: global_ref("uarmf", ptr_to(struct_obj)), w_what: _("boots") },
             { w_mask: W_ARMU, w_obj: global_ref("uarmu", ptr_to(struct_obj)), w_what: _("shirt") },
             { w_mask: W_RINGL, w_obj: global_ref("uleft", ptr_to(struct_obj)), w_what: _("left ring") },
             { w_mask: W_RINGR, w_obj: global_ref("uright", ptr_to(struct_obj)), w_what: _("right ring") },
             { w_mask: W_WEP, w_obj: global_ref("uwep", ptr_to(struct_obj)), w_what: _("weapon") },
             { w_mask: W_SWAPWEP, w_obj: global_ref("uswapwep", ptr_to(struct_obj)), w_what: _("alternate weapon") },
             { w_mask: W_QUIVER, w_obj: global_ref("uquiver", ptr_to(struct_obj)), w_what: _("quiver") },
             { w_mask: W_AMUL, w_obj: global_ref("uamul", ptr_to(struct_obj)), w_what: _("amulet") },
             { w_mask: W_TOOL, w_obj: global_ref("ublindf", ptr_to(struct_obj)), w_what: _("facewear") }, /* blindfold|towel|lenses */
             { w_mask: W_BALL, w_obj: global_ref("uball", ptr_to(struct_obj)), w_what: _("chained ball") },
             { w_mask: W_CHAIN, w_obj: global_ref("uchain", ptr_to(struct_obj)), w_what: _("attached chain") },
             { w_mask: 0, w_obj: null, w_what: 0 }
]);

/* This only allows for one blocking item per property */
export function w_blocks(o, m) { return ((o.otyp == MUMMY_WRAPPING && (m & W_ARMC) != 0) ? INVIS
     : (o.otyp == CORNUTHAUM && (m & W_ARMH) != 0
        && !Role_if(PM_WIZARD)) ? CLAIRVOYANT
       : (is_art(o, ART_EYES_OF_THE_OVERWORLD)
          && (m & W_TOOL) != 0) ? BLINDED
         : 0); }

/* note: monsters don't have clairvoyance, so dependency on hero's role here
   has no significant effect on their use of w_blocks() */

/* calc the range of hero's unblind telepathy */
export function recalc_telepat_range() { /* void */
    let wp;
    let nobjs = 0;

    for (wp = worn[0]; wp.w_mask; wp = ptr_add(wp, 1)) {
        let oobj = wp.w_obj[0];

        if (oobj && objects[oobj.otyp].oc_oprop == TELEPAT)
            nobjs++;
    }
    /* count all artifacts with SPFX_ESP as one */
    if (ETelepat() & W_ART)
        nobjs++;

    if (nobjs)
        u.unblind_telepat_range = (BOLT_LIM * BOLT_LIM) * nobjs;
    else
        u.unblind_telepat_range = -1;
}

/* Updated to use the extrinsic and blocked fields. */
export function setworn(obj, mask) { /* void */
    let wp;
    let oobj;
    let p;

    if ((mask & (W_ARM | I_SPECIAL)) == (W_ARM | I_SPECIAL)) {
        /* restoring saved game; no properties are conferred via skin */
        uskin = obj;
        /* assert( !uarm ); */
    } else {
        for (wp = worn[0]; wp.w_mask; wp = ptr_add(wp, 1)) {
            if (wp.w_mask & mask) {
                oobj = wp.w_obj[0];
                if (oobj && !(oobj.owornmask & wp.w_mask))
                    impossible(_("Setworn: mask=0x%08llx."), wp.w_mask);
                if (oobj) {
                    if (u.twoweap && (oobj.owornmask & (W_WEP | W_SWAPWEP)))
                        set_twoweap(FALSE); /* u.twoweap = FALSE */
                    oobj.owornmask = and64(oobj.owornmask, not64(wp.w_mask));
                    if (wp.w_mask & ~(W_SWAPWEP | W_QUIVER)) {
                        /* leave as "x = x <op> y", here and below, for broken
                         * compilers */
                        p = objects[oobj.otyp].oc_oprop;
                        u.uprops[p].extrinsic =
                            and64(u.uprops[p].extrinsic, not64(wp.w_mask));
                        /* if the hero removed an extrinsic-granting item,
                           nearby monsters will notice and attempt attacks of
                           that type again */
                        monstunseesu_prop(uchar(p));
                        if ((p = w_blocks(oobj, mask)) != 0)
                            u.uprops[p].blocked = and64(u.uprops[p].blocked, not64(wp.w_mask));
                        if (oobj.oartifact)
                            set_artifact_intrinsic(oobj, 0, mask);
                    }
                    /* in case wearing or removal is in progress or removal
                       is pending (via 'A' command for multiple items) */
                    cancel_doff(oobj, wp.w_mask);
                }
                wp.w_obj[0] = obj;
                if (obj) {
                    obj.owornmask = or64(obj.owornmask, wp.w_mask);
                    /* Prevent getting/blocking intrinsics from wielding
                     * potions, through the quiver, etc.
                     * Allow weapon-tools, too.
                     * wp_mask should be same as mask at this point.
                     */
                    if (wp.w_mask & ~(W_SWAPWEP | W_QUIVER)) {
                        if (obj.oclass == WEAPON_CLASS || is_weptool(obj)
                            || mask != W_WEP) {
                            p = objects[obj.otyp].oc_oprop;
                            u.uprops[p].extrinsic =
                                or64(u.uprops[p].extrinsic, wp.w_mask);
                            if ((p = w_blocks(obj, mask)) != 0)
                                u.uprops[p].blocked = or64(u.uprops[p].blocked, wp.w_mask);
                        }
                        if (obj.oartifact)
                            set_artifact_intrinsic(obj, 1, mask);
                    }
                }
            }
        }
        if (obj && (obj.owornmask & W_ARMOR) != 0)
            u.uroleplay.nudist = FALSE;
        /* tux -> tuxedo -> "monkey suit" -> monk's suit */
        iflags.tux_penalty = (uarm && Role_if(PM_MONK) && gu.urole.spelarmr ? 1 : 0);
    }
    if ((flags.weaponstatus && (mask & W_WEP) != 0)
        || (flags.armorstatus && (mask & W_ARMOR) != 0))
        disp.botl = TRUE;
    update_inventory();
    recalc_telepat_range();
}

/* called e.g. when obj is destroyed */
/* Updated to use the extrinsic and blocked fields. */
export function setnotworn(obj) { /* void */
    let wp;
    let p;
    let unworn = 0;

    if (!obj)
        return;
    if (u.twoweap && (obj == uwep || obj == uswapwep))
        set_twoweap(FALSE); /* u.twoweap = FALSE */
    for (wp = worn[0]; wp.w_mask; wp = ptr_add(wp, 1))
        if (obj == wp.w_obj[0]) {
            /* in case wearing or removal is in progress or removal
               is pending (via 'A' command for multiple items) */
            cancel_doff(obj, wp.w_mask);

            wp.w_obj[0] = null;
            unworn = or64(unworn, wp.w_mask);
            p = objects[obj.otyp].oc_oprop;
            u.uprops[p].extrinsic = and64(u.uprops[p].extrinsic, not64(wp.w_mask));
            monstunseesu_prop(uchar(p)); /* remove this extrinsic from seenres */
            obj.owornmask = and64(obj.owornmask, not64(wp.w_mask));
            if (obj.oartifact)
                set_artifact_intrinsic(obj, 0, wp.w_mask);
            if ((p = (((obj.otyp == MUMMY_WRAPPING) && (((wp.w_mask) & W_ARMC) != 0)) ? INVIS : ((((obj.otyp == CORNUTHAUM) && (((wp.w_mask) & W_ARMH) != 0)) && !Role_if(PM_WIZARD)) ? CLAIRVOYANT : ((is_art(obj, ART_EYES_OF_THE_OVERWORLD) && (((wp.w_mask) & W_TOOL) != 0)) ? BLINDED : 0)))) != 0)
                u.uprops[p].blocked = and64(u.uprops[p].blocked, not64(wp.w_mask));
        }
    if (!uarm)
        iflags.tux_penalty = FALSE;
    if ((flags.weaponstatus && (unworn & W_WEP) != 0)
        || (flags.armorstatus && (unworn & W_ARMOR) != 0))
        disp.botl = TRUE;
    update_inventory();
    recalc_telepat_range();
}

/* called when saving with FREEING flag set has just discarded inventory */
export function allunworn() { /* void */
    let wp;

    u.twoweap = 0; /* uwep and uswapwep are going away */
    /* remove stale pointers; called after the objects have been freed
       (without first being unworn) while saving invent during game save;
       note: uball and uchain might not be freed yet but we clear them
       here anyway (savegamestate() and its callers deal with them) */
    for (wp = worn[0]; wp.w_mask; wp = ptr_add(wp, 1)) {
        /* object is already gone so we don't/can't update is owornmask */
        wp.w_obj[0] = null;
    }
}

/* return item worn in slot indicated by wornmask; needed by poly_obj() */
export function wearmask_to_obj(wornmask) { /* struct obj * */
    let wp;

    for (wp = worn[0]; wp.w_mask; wp = ptr_add(wp, 1))
        if (wp.w_mask & wornmask)
            return wp.w_obj[0];
    return null;
}

/* convert an armor wornmask to corresponding category */
export function wornmask_to_armcat(mask) { /* int */
    let cat = 0;

    switch (mask & W_ARMOR) {
    case W_ARM:
        cat = ARM_SUIT;
        break;
    case W_ARMC:
        cat = ARM_CLOAK;
        break;
    case W_ARMH:
        cat = ARM_HELM;
        break;
    case W_ARMS:
        cat = ARM_SHIELD;
        break;
    case W_ARMG:
        cat = ARM_GLOVES;
        break;
    case W_ARMF:
        cat = ARM_BOOTS;
        break;
    case W_ARMU:
        cat = ARM_SHIRT;
        break;
    }
    return cat;
}

/* convert an armor category to corresponding wornmask */
export function armcat_to_wornmask(cat) { /* long long */
    let mask = 0;

    switch (cat) {
    case ARM_SUIT:
        mask = W_ARM;
        break;
    case ARM_CLOAK:
        mask = W_ARMC;
        break;
    case ARM_HELM:
        mask = W_ARMH;
        break;
    case ARM_SHIELD:
        mask = W_ARMS;
        break;
    case ARM_GLOVES:
        mask = W_ARMG;
        break;
    case ARM_BOOTS:
        mask = W_ARMF;
        break;
    case ARM_SHIRT:
        mask = W_ARMU;
        break;
    }
    return mask;
}

/* return a bitmask of the equipment slot(s) a given item might be worn in */
export function wearslot(obj) { /* long long */
    let otyp = obj.otyp;
    /* practically any item can be wielded or quivered; it's up to
       our caller to handle such things--we assume "normal" usage */
    let res = 0; /* default: can't be worn anywhere */

    switch (obj.oclass) {
    case AMULET_CLASS:
        res = W_AMUL; /* WORN_AMUL */
        break;
    case RING_CLASS:
        res = W_RINGL | W_RINGR; /* W_RING, BOTH_SIDES */
        break;
    case ARMOR_CLASS:
        switch (objects[otyp].oc_subtyp) {
        case ARM_SUIT:
            res = W_ARM;
            break; /* WORN_ARMOR */
        case ARM_SHIELD:
            res = W_ARMS;
            break; /* WORN_SHIELD */
        case ARM_HELM:
            res = W_ARMH;
            break; /* WORN_HELMET */
        case ARM_GLOVES:
            res = W_ARMG;
            break; /* WORN_GLOVES */
        case ARM_BOOTS:
            res = W_ARMF;
            break; /* WORN_BOOTS */
        case ARM_CLOAK:
            res = W_ARMC;
            break; /* WORN_CLOAK */
        case ARM_SHIRT:
            res = W_ARMU;
            break; /* WORN_SHIRT */
        }
        break;
    case WEAPON_CLASS:
        res = W_WEP | W_SWAPWEP;
        if (objects[otyp].oc_merge)
            res = or64(res, W_QUIVER);
        break;
    case TOOL_CLASS:
        if (otyp == BLINDFOLD || otyp == TOWEL || otyp == LENSES)
            res = W_TOOL; /* WORN_BLINDF */
        else if (is_weptool(obj) || otyp == TIN_OPENER)
            res = W_WEP | W_SWAPWEP;
        else if (otyp == SADDLE)
            res = W_SADDLE;
        break;
    case FOOD_CLASS:
        if (obj.otyp == MEAT_RING)
            res = W_RINGL | W_RINGR;
        break;
    case GEM_CLASS:
        res = W_QUIVER;
        break;
    case BALL_CLASS:
        res = W_BALL;
        break;
    case CHAIN_CLASS:
        res = W_CHAIN;
        break;
    default:
        break;
    }
    return res;
}

/* for 'sanity_check' option, called by you_sanity_check() */
export function check_wornmask_slots() { /* void */
    const $frame = stack_frame(); try {
    /* we'll skip ball and chain here--they warrant separate sanity check */

    let whybuf = stack_array(char, BUFSZ);
    let wp;
    let o, otmp;
    let m;

    for (wp = worn[0]; wp.w_mask; wp = ptr_add(wp, 1)) {
        m = wp.w_mask;
        if ((m & IGNORE_SLOTS) != 0 && (m & ~IGNORE_SLOTS) == 0)
            continue;
        if ((o = wp.w_obj[0]) != null) {
            chars[whybuf + 0] = ord('\0');
            /* slot pointer (uarm, uwep, &c) is populated; check that object
               is in inventory and has the relevant owornmask bit set */
            for (otmp = gi.invent; otmp; otmp = otmp.nobj)
                if (otmp == o)
                    break;
            if (!otmp)
                sprintf(whybuf, _("%s (%s) not found in invent"), wp.w_what, fmt_ptr(addr_of(o)));
            else if ((o.owornmask & m) == 0)
                sprintf(whybuf, _("%s bit not set in owornmask [0x%08llx]"), wp.w_what, o.owornmask);
            else if ((o.owornmask & not64(or64(m, IGNORE_SLOTS))) != 0)
                sprintf(whybuf, _("%s wrong bit set in owornmask [0x%08llx]"), wp.w_what, o.owornmask)

;
            if (chars[whybuf + 0])
                impossible(_("Worn-slot insanity: %s."), whybuf);
        } /* o != NULL */

        /* check whether any item other than the one in the slot pointer
           claims to be worn/wielded in this slot; make this test whether
           'o' is Null or not; [sanity_check_worn(mkobj.c) for object by
           object checking will most likely have already caught this] */
        for (otmp = gi.invent; otmp; otmp = otmp.nobj) {
            if (otmp != o && (otmp.owornmask & m) != 0
                /* embedded scales owornmask is W_ARM|I_SPECIAL so would
                   give a false complaint about item other than uarm having
                   W_ARM bit set if we didn't screen it out here */
                && (m != W_ARM || otmp != uskin
                    || (otmp.owornmask & I_SPECIAL) == 0)) {
                sprintf(whybuf, _("%s [0x%08llx] has %s mask 0x%08llx bit set"), simpleonames(otmp), otmp.owornmask, wp.w_what, m)
;
                impossible(_("Worn-slot insanity: %s."), whybuf);
            }
        }
    } /* for wp in worn[] */

    /* #ifdef EXTRA_SANITY_CHECKS: not in this build */

    /* #ifdef EXTRA_SANITY_CHECKS: not in this build */

    return;
    } finally { stack_pop($frame); }
} /* check_wornmask_slots() */
export const IGNORE_SLOTS = (W_ART | W_ARTI | W_SADDLE | W_BALL| W_CHAIN);

export function mon_set_minvis(
    mon,
    cursed_potion) { /* void */
    mon.perminvis = !cursed_potion ? 1 : 0;
    if (!mon.invis_blkd) {
        mon.minvis = mon.perminvis;
        newsym(mon.mx, mon.my); /* make it disappear */
        if (mon.wormno)
            see_wsegs(mon); /* and any tail too */
    }
}

export function mon_adjust_speed(
    mon,
    adjust,
    obj) { /* void */ /* item to make known if effect can be seen */
    let otmp;
    let give_msg = +!gi.in_mklev, petrify = FALSE;
    let oldspeed = mon.mspeed;

    switch (adjust) {
    case 2:
        mon.permspeed = MFAST;
        give_msg = FALSE; /* special-case monster creation */
        break;
    case 1:
        if (mon.permspeed == MSLOW)
            mon.permspeed = 0;
        else
            mon.permspeed = MFAST;
        break;
    case 0: /* just check for worn speed boots */
        break;
    case -1:
        if (mon.permspeed == MFAST)
            mon.permspeed = 0;
        else
            mon.permspeed = MSLOW;
        break;
    case -2:
        mon.permspeed = MSLOW;
        give_msg = FALSE; /* (not currently used) */
        break;
    case -3: /* petrification */
        /* take away intrinsic speed but don't reduce normal speed */
        if (mon.permspeed == MFAST)
            mon.permspeed = 0;
        petrify = TRUE;
        break;
    case -4: /* green slime */
        if (mon.permspeed == MFAST)
            mon.permspeed = 0;
        give_msg = FALSE;
        break;
    }

    for (otmp = mon.minvent; otmp; otmp = otmp.nobj)
        if (otmp.owornmask && objects[otmp.otyp].oc_oprop == FAST)
            break;
    if (otmp) /* speed boots */
        mon.mspeed = MFAST;
    else
        mon.mspeed = mon.permspeed;

    /* no message if monster is immobile (temp or perm) or unseen */
    if (give_msg && (mon.mspeed != oldspeed || petrify) && mon.data.mmove
        && !(mon.mfrozen || mon.msleeping) && canseemon(mon)) {
        /* fast to slow (skipping intermediate state) or vice versa */
        let howmuch = (unsigned(mon.mspeed + oldspeed) == MFAST + MSLOW) ? _("much ") : _("");

        if (petrify) {
            /* mimic the player's petrification countdown; "slowing down"
               even if fast movement rate retained via worn speed boots */
            if (flags.verbose)
                pline_mon(mon, _("%s is slowing down."), Monnam(mon));
        } else if (adjust > 0 || mon.mspeed == MFAST)
            pline_mon(mon, _("%s is suddenly moving %sfaster."),
                      Monnam(mon), howmuch);
        else
            pline_mon(mon, _("%s seems to be moving %sslower."),
                      Monnam(mon), howmuch);

        /* might discover an object if we see the speed change happen */
        if (obj != null)
            learnwand(obj);
    }
}

/* alchemy smock confers two properties, poison and acid resistance
   but objects[ALCHEMY_SMOCK].oc_oprop can only describe one of them;
   if it is poison resistance, alternate property is acid resistance;
   if someone changes it to acid resistance, alt becomes poison resist;
   if someone changes it to hallucination resistance, all bets are off
   [TODO: handle alternate properties conferred by dragon scales/mail] */
export function altprop(o) { return ((o.otyp == ALCHEMY_SMOCK)
     ? (POISON_RES + ACID_RES - objects[o.otyp].oc_oprop)
     : 0); }

/* armor put on or taken off; might be magical variety */
export function update_mon_extrinsics(
    mon,
    obj,
    on,
    silently) { /* void */
    var unseen;
    var mask;
    var otmp;
    var which = (objects[obj.otyp].oc_oprop),
        altwhich = altprop(obj);

    unseen = +!canseemon(mon);
    maybe_blocks: { if (!which && !altwhich)
        break maybe_blocks;;

 again: for (;;) {
    if (on) {
        switch (which) {
        case INVIS:
            mon.minvis = +!mon.invis_blkd;
            break;
        case FAST: {
            var save_in_mklev = gi.in_mklev;
            if (silently)
                gi.in_mklev = TRUE;
            mon_adjust_speed(mon, 0, obj);
            gi.in_mklev = save_in_mklev;
            break;
        }
        /* properties handled elsewhere */
        case ANTIMAGIC:
        case REFLECTING:
        case PROTECTION:
            break;
        /* properties which have no effect for monsters */
        case CLAIRVOYANT:
        case STEALTH:
        case TELEPAT:
            break;
        /* properties which should have an effect but aren't implemented */
        case LEVITATION:
        case FLYING:
        case WWALKING:
            break;
        /* properties which maybe should have an effect but don't */
        case DISPLACED:
        case FUMBLING:
        case JUMPING:
            break;
        default:
            mon.mextrinsics |= res_to_mr(which);
            break;
        }
    } else { /* off */
        switch (which) {
        case INVIS:
            mon.minvis = mon.perminvis;
            break;
        case FAST: {
            var save_in_mklev = gi.in_mklev;
            if (silently)
                gi.in_mklev = TRUE;
            mon_adjust_speed(mon, 0, obj);
            gi.in_mklev = save_in_mklev;
            break;
        }
        case FIRE_RES:
        case COLD_RES:
        case SLEEP_RES:
        case DISINT_RES:
        case SHOCK_RES:
        case POISON_RES:
        case ACID_RES:
        case STONE_RES:
            /*
             * Update monster's extrinsics (for worn objects only;
             * 'obj' itself might still be worn or already unworn).
             *
             * If an alchemy smock is being taken off, this code will
             * be run twice (via 'goto again') and other worn gear
             * gets tested for conferring poison resistance on the
             * first pass and acid resistance on the second.
             *
             * If some other item is being taken off, there will be
             * only one pass but a worn alchemy smock will be an
             * alternate source for either of those two resistances.
             */
            mask = res_to_mr(which);
            for (otmp = mon.minvent; otmp; otmp = otmp.nobj) {
                if (otmp == obj || !otmp.owornmask)
                    continue;
                if ((objects[otmp.otyp].oc_oprop) == which)
                    break;
                /* check whether 'otmp' confers target property as an extra
                   one rather than as the one specified for it in objects[] */
                if (altprop(otmp) == which)
                    break;
            }
            if (!otmp)
                mon.mextrinsics &= ~mask;
            break;
        default:
            break;
        }
    }

    /* worn alchemy smock/apron confers both poison resistance and acid
       resistance to the hero so do likewise for monster who wears one */
    if (altwhich && which != altwhich) {
        which = altwhich;
        continue again;
    } break; }
 }
    /* obj->owornmask has been cleared by this point, so we can't use it.
       However, since monsters don't wield armor, we don't have to guard
       against that and can get away with a blanket worn-mask value. */
    switch (w_blocks(obj, ~0)) {
    case INVIS:
        mon.invis_blkd = on ? 1 : 0;
        mon.minvis = on ? 0 : mon.perminvis;
        break;
    default:
        break;
    }

    if (!on && mon == u.usteed && obj.otyp == SADDLE)
        dismount_steed(DISMOUNT_FELL);

    /* if couldn't see it but now can, or vice versa, update display */
    if (!silently && (unseen ^ +!canseemon(mon)))
        newsym(mon.mx, mon.my);
}

export function find_mac(mon) { /* int */
    let obj;
    let base = mon.data.ac;
    let mwflags = mon.misc_worn_check;

    for (obj = mon.minvent; obj; obj = obj.nobj) {
        if (obj.owornmask & mwflags) {
            if (obj.otyp == AMULET_OF_GUARDING)
                base -= 2; /* fixed amount, not impacted by erosion */
            else
                base -= ARM_BONUS(obj);
            /* since ARM_BONUS is positive, subtracting it increases AC */
        }
    }
    /* same cap as for hero [find_ac(do_wear.c)] */
    if (abs(base) > AC_MAX)
        base = sgn(base) * AC_MAX;
    return base;
}

/*
 * weapons are handled separately;
 * rings and eyewear aren't used by monsters
 */

/* Wear the best object of each type that the monster has.  During creation,
 * the monster can put everything on at once; otherwise, wearing takes time.
 * This doesn't affect monster searching for objects--a monster may very well
 * search for objects it would not want to wear, because we don't want to
 * check which_armor() each round.
 *
 * We'll let monsters put on shirts and/or suits under worn cloaks, but
 * not shirts under worn suits.  This is somewhat arbitrary, but it's
 * too tedious to have them remove and later replace outer garments,
 * and preventing suits under cloaks makes it a little bit too easy for
 * players to influence what gets worn.  Putting on a shirt underneath
 * already worn body armor is too obviously buggy...
 */
export function m_dowear(mon, creation) { /* void */
    let can_wear_armor;

    /* Note the restrictions here are the same as in dowear in do_wear.c
     * except for the additional restriction on intelligence.  (Players
     * are always intelligent, even if polymorphed).
     */
    if (verysmall(mon.data) || nohands(mon.data) || is_animal(mon.data))
        return;
    /* give mummies a chance to wear their wrappings
     * and let skeletons wear their initial armor */
    if (mindless(mon.data)
        && (!creation || (mon.data.mlet != S_MUMMY
                          && mon.data != mons[PM_SKELETON])))
        return;

    m_dowear_type(mon, W_AMUL, creation, FALSE);
    can_wear_armor = +!cantweararm(mon.data); /* for suit, cloak, shirt */
    /* can't put on shirt if already wearing suit */
    if (can_wear_armor && !(mon.misc_worn_check & W_ARM))
        m_dowear_type(mon, W_ARMU, creation, FALSE);
    /* WrappingAllowed() makes any size between small and huge eligible;
       treating small as a special case allows hobbits, gnomes, and
       kobolds to wear all cloaks; large and huge allows giants and such
       to wear mummy wrappings but not other cloaks */
    if (can_wear_armor || WrappingAllowed(mon.data))
        m_dowear_type(mon, W_ARMC, creation, FALSE);
    m_dowear_type(mon, W_ARMH, creation, FALSE);
    if (!MON_WEP(mon) || !bimanual(MON_WEP(mon)))
        m_dowear_type(mon, W_ARMS, creation, FALSE);
    m_dowear_type(mon, W_ARMG, creation, FALSE);
    if (!slithy(mon.data) && mon.data.mlet != S_CENTAUR)
        m_dowear_type(mon, W_ARMF, creation, FALSE);
    if (can_wear_armor)
        m_dowear_type(mon, W_ARM, creation, FALSE);
    else
        m_dowear_type(mon, W_ARM, creation, RACE_EXCEPTION);
}
export const RACE_EXCEPTION = TRUE;

function m_dowear_type(
    mon,
    flag,
    creation,
    racialexception) { /* void */ /* small monsters that are allowed for player * races (gnomes) can wear suits */
    const $frame = stack_frame(); try {
    var old, best, obj;
    var oldmask = 0;
    var m_delay = 0;
    var sawmon = canseemon(mon), sawloc = cansee(mon.mx, mon.my);
    var autocurse;
    var nambuf = stack_array(char, BUFSZ);

    if (mon.mfrozen)
        return; /* probably putting previous item on */

    /* Get a copy of monster's name before altering its visibility */
    strcpy(nambuf, See_invisible() ? Monnam(mon) : mon_nam(mon));

    old = which_armor(mon, flag);
    if (old && old.cursed)
        return;
    if (old && flag == W_AMUL && old.otyp != AMULET_OF_GUARDING)
        return; /* no amulet better than life-saving or reflection */
    best = old;

    outer_break: { for (obj = mon.minvent; obj; obj = obj.nobj) {
        switch (flag) {
        case W_AMUL:
            if (obj.oclass != AMULET_CLASS
                || (obj.otyp != AMULET_OF_LIFE_SAVING
                    && obj.otyp != AMULET_OF_REFLECTION
                    && obj.otyp != AMULET_OF_GUARDING))
                continue;
            /* for 'best' to be non-Null, it must be an amulet of guarding;
               life-saving and reflection don't get here due to early return
               and other amulets of guarding can't be any better */
            if (!best || obj.otyp != AMULET_OF_GUARDING) {
                best = obj;
                if (best.otyp != AMULET_OF_GUARDING)
                    break outer_break;; /* life-saving or reflection; use it */
            }
            continue; /* skip post-switch armor handling */
        case W_ARMU:
            if (!is_shirt(obj))
                continue;
            break;
        case W_ARMC:
            if (!is_cloak(obj))
                continue;
            /* mummy wrapping is only cloak allowed when bigger than human */
            if (mon.data.msize > MZ_HUMAN && obj.otyp != MUMMY_WRAPPING)
                continue;
            /* avoid mummy wrapping if it will allow hero to see mon (unless
               this is a new mummy; an invisible one is feasible via ^G) */
            if (mon.minvis && w_blocks(obj, W_ARMC) == INVIS
                && !See_invisible() && !creation)
                continue;
            break;
        case W_ARMH:
            if (!is_helmet(obj))
                continue;
            /* changing alignment is not implemented for monsters;
               priests and minions could change alignment but wouldn't
               want to, so they reject helms of opposite alignment */
            if (obj.otyp == HELM_OF_OPPOSITE_ALIGNMENT
                && (mon.ispriest || mon.isminion))
                continue;
            /* (flimsy exception matches polyself handling) */
            if (has_horns(mon.data) && !is_flimsy(obj))
                continue;
            break;
        case W_ARMS:
            if (!is_shield(obj))
                continue;
            break;
        case W_ARMG:
            if (!is_gloves(obj))
                continue;
            break;
        case W_ARMF:
            if (!is_boots(obj))
                continue;
            break;
        case W_ARM:
            if (!is_suit(obj))
                continue;
            if (racialexception && (racial_exception(mon, obj) < 1))
                continue;
            break;
        }
        if (obj.owornmask)
            continue;
        /* I'd like to define a VISIBLE_ARM_BONUS which doesn't assume the
         * monster knows obj->spe, but if I did that, a monster would keep
         * switching forever between two -2 caps since when it took off one
         * it would forget spe and once again think the object is better
         * than what it already has.
         */
        if (best && (ARM_BONUS(best) + extra_pref(mon, best)
                     >= ARM_BONUS(obj) + extra_pref(mon, obj)))
            continue;
        best = obj;
    }
 }
    if (!best || best == old)
        return;

    /* same auto-cursing behavior as for hero */
    autocurse = +((best.otyp == HELM_OF_OPPOSITE_ALIGNMENT
                  || best.otyp == DUNCE_CAP) && !best.cursed);
    /* if wearing a cloak, account for the time spent removing
       and re-wearing it when putting on a suit or shirt */
    if ((flag == W_ARM || flag == W_ARMU) && (mon.misc_worn_check & W_ARMC))
        m_delay += 2;
    /* when upgrading a piece of armor, account for time spent
       taking off current one */
    if (old) {
        m_delay += objects[old.otyp].oc_delay;

        oldmask = old.owornmask; /* needed later by artifact_light() */
        old.owornmask = 0; /* avoid doname() showing "(being worn)" */
    }

    if (!creation) {
        if (sawmon) {
            var buf = stack_array(char, BUFSZ), oldarm = stack_array(char, BUFSZ), newarm = stack_array(char, BUFSZ + sizeof_string("another "));

            /* "<Mon> [removes <oldarm> and ]puts on <newarm>."
               uses accessory verbs for armor but we can live with that */
            if (old) {
                strcpy(oldarm, distant_name(old, doname));
                Snprintf(buf, sizeof(array_of(char, BUFSZ)), _(" removes %s and"), oldarm);
            } else {
                chars[buf + 0] = chars[oldarm + 0] = ord('\0');
            }
            strcpy(newarm, distant_name(best, doname));
            /* a monster will swap an item of the same type as the one it
               is replacing when the enchantment is better;
               if newarm and oldarm have identical descriptions, substitute
               "another <newarm>" for "a|an <newarm>" */
            if (!strcmpi(newarm, oldarm)) {
                /* size of newarm[] has been overallocated to guarantee
                   enough room to insert "another " */
                if (!strncmpi(newarm, _("a "), 2))
                    strsubst(newarm, _("a "), _("another "));
                else if (!strncmpi(newarm, _("an "), 3))
                    strsubst(newarm, _("an "), _("another "));
                chars[newarm + (BUFSZ - 1)] = ord('\0');
            }
            pline_mon(mon, _("%s%s puts on %s."), Monnam(mon), buf, newarm);
            if (autocurse)
                pline(_("%s %s %s %s for a moment."), s_suffix(Monnam(mon)),
                      simpleonames(best), otense(best, _("glow")),
                      hcolor(NH_BLACK()));
        } /* can see it */
        m_delay += objects[best.otyp].oc_delay;
        mon.mfrozen = unsigned(m_delay);
        if (mon.mfrozen)
            mon.mcanmove = 0;
    }
    if (old) {
        update_mon_extrinsics(mon, old, FALSE, creation);

        /* owornmask was cleared above but artifact_light() expects it */
        old.owornmask = oldmask;
        if (old.lamplit && artifact_light(old))
            end_burn(old, FALSE);
        old.owornmask = 0;
    }
    mon.misc_worn_check = or64(mon.misc_worn_check, flag);
    best.owornmask = or64(best.owornmask, flag);
    if (autocurse)
        curse(best);
    if (artifact_light(best) && !best.lamplit) {
        begin_burn(best, FALSE);
        vision_recalc(1);
        if (!creation && best.lamplit && cansee(mon.mx, mon.my)) {
            var adesc = arti_light_description(best);

            if (sawmon) /* could already see monster */
                pline(_("%s %s to shine %s."), Yname2(best),
                      otense(best, _("begin")), adesc);
            else if (canseemon(mon)) /* didn't see it until new light */
                pline(_("%s %s shining %s."), Yname2(best),
                      otense(best, _("are")), adesc);
            else if (sawloc) /* saw location but not invisible monster */
                pline(_("%s begins to shine %s."), Something(), adesc);
            else /* didn't see location until new light */
                pline(_("%s is shining %s."), Something(), adesc);
        }
    }
    update_mon_extrinsics(mon, best, TRUE, creation);
    /* if couldn't see it but now can, or vice versa */
    if (!creation && (sawmon ^ canseemon(mon))) {
        if (mon.minvis && !See_invisible()) {
            pline(_("Suddenly you cannot see %s."), nambuf);
            makeknown(best.otyp);
        /* } else if (!mon->minvis) {
         *     pline("%s suddenly appears!", Amonnam(mon)); */
        }
    }
    } finally { stack_pop($frame); }
}

export function which_armor(mon, flag) { /* struct obj * */
    if (mon == gy.youmonst) {
        switch (flag) {
        case W_ARM:
            return uarm;
        case W_ARMC:
            return uarmc;
        case W_ARMH:
            return uarmh;
        case W_ARMS:
            return uarms;
        case W_ARMG:
            return uarmg;
        case W_ARMF:
            return uarmf;
        case W_ARMU:
            return uarmu;
        default:
            impossible(_("bad flag in which_armor"));
            return null;
        }
    } else {
        let obj;

        for (obj = mon.minvent; obj; obj = obj.nobj)
            if (obj.owornmask & flag)
                return obj;
        return null;
    }
}

/* remove an item of armor and then drop it */
function m_lose_armor(
    mon,
    obj,
    polyspot) { /* void */
    extract_from_minvent(mon, obj, TRUE, FALSE);
    place_object(obj, mon.mx, mon.my);
    if (polyspot)
        bypass_obj(obj);
    /* call stackobj() if we ever drop anything that can merge */
    newsym(mon.mx, mon.my);
}

/* clear bypass bits for an object chain, plus contents if applicable */
function clear_bypass(objchn) { /* void */
    let o;

    for (o = objchn; o; o = o.nobj) {
        o.bypass = 0;
        if (Has_contents(o))
            clear_bypass(o.cobj);
    }
}

/* all objects with their bypass bit set should now be reset to normal;
   this can be a relatively expensive operation so is only called if
   svc.context.bypasses is set */
export function clear_bypasses() { /* void */
    let mtmp;

    /*
     * 'Object' bypass is also used for one monster function:
     * polymorph control of long worms.  Activated via setting
     * svc.context.bypasses even if no specific object has been
     * bypassed.
     */

    clear_bypass(fobj());
    clear_bypass(gi.invent);
    clear_bypass(gm.migrating_objs);
    clear_bypass(svl.level.buriedobjlist);
    clear_bypass(gb.billobjs);
    clear_bypass(go.objs_deleted);
    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (DEADMONSTER(mtmp))
            continue;
        clear_bypass(mtmp.minvent);
        /* long worm created by polymorph has mon->mextra->mcorpsenm set
           to PM_LONG_WORM to flag it as not being subject to further
           polymorph (so polymorph zap won't hit monster to transform it
           into a long worm, then hit that worm's tail and transform it
           again on same zap); clearing mcorpsenm reverts worm to normal */
        if (mtmp.data == mons[PM_LONG_WORM] && has_mcorpsenm(mtmp))
            ((mtmp).mextra.mcorpsenm) = NON_PM;
    }
    for (mtmp = gm.migrating_mons; mtmp; mtmp = mtmp.nmon) {
        clear_bypass(mtmp.minvent);
        /* no MCORPSENM(mtmp)==PM_LONG_WORM check here; long worms can't
           be just created by polymorph and migrating at the same time */
    }
    /* this is a no-op since mydogs is only non-Null during level change or
       final ascension and we aren't called at those times, but be thorough */
    for (mtmp = gm.mydogs; mtmp; mtmp = mtmp.nmon)
        clear_bypass(mtmp.minvent);
    /* ball and chain can be "floating", not on any object chain (when
       hero is swallowed by an engulfing monster, for instance) */
    if (uball)
        uball.bypass = 0;
    if (uchain)
        uchain.bypass = 0;

    svc.context.bypasses = FALSE;
}

export function bypass_obj(obj) { /* void */
    obj.bypass = 1;
    svc.context.bypasses = TRUE;
}

/* set or clear the bypass bit in a list of objects */
export function bypass_objlist(
    objchain,
    on) { /* void */ /* TRUE => set, FALSE => clear */
    if (on && objchain)
        svc.context.bypasses = TRUE;
    while (objchain) {
        objchain.bypass = on ? 1 : 0;
        objchain = objchain.nobj;
    }
}

/* return the first object without its bypass bit set; set that bit
   before returning so that successive calls will find further objects */
export function nxt_unbypassed_obj(objchain) { /* struct obj * */
    while (objchain) {
        if (!objchain.bypass) {
            bypass_obj(objchain);
            break;
        }
        objchain = objchain.nobj;
    }
    return objchain;
}

/* like nxt_unbypassed_obj() but operates on sortloot_item array rather
   than an object linked list; the array contains obj==Null terminator;
   there's an added complication that the array may have stale pointers
   for deleted objects (see Multiple-Drop case in askchain(invent.c)) */
export function nxt_unbypassed_loot(lootarray, listhead) { /* struct obj * */
    let o, obj;

    while ((obj = lootarray.obj) != null) {
        for (o = listhead; o; o = o.nobj)
            if (o == obj)
                break;
        if (o && !obj.bypass) {
            bypass_obj(obj);
            break;
        }
        lootarray = ptr_add(lootarray, 1);
    }
    return obj;
}

export function mon_break_armor(mon, polyspot) { /* void */
    const $frame = stack_frame(); try {
    let otmp;
    let mdat = mon.data;
    let vis = cansee(mon.mx, mon.my),
            handless_or_tiny = +(nohands(mdat) || verysmall(mdat)),
            noride = FALSE;
    let pronoun = mhim(mon), ppronoun = mhis(mon);

    if (breakarm(mdat)) {
        if ((otmp = which_armor(mon, W_ARM)) != null) {
            if ((Is_dragon_scales(otmp) && mdat == Dragon_scales_to_pm(otmp))
                || (Is_dragon_mail(otmp) && mdat == Dragon_mail_to_pm(otmp))) {
                ; /* no message here;
                     "the dragon merges with his scaly armor" is odd
                     and the monster's previous form is already gone */
            } else {
                 ;
                if (vis)
                    pline_mon(mon, _("%s breaks out of %s armor!"),
                              Monnam(mon), ppronoun);
                else
                    You_hear(_("a cracking sound."));
            }
            m_useup(mon, otmp);
        }
        if ((otmp = which_armor(mon, W_ARMC)) != null
            /* mummy wrapping adapts to small and very big sizes */
            && (otmp.otyp != MUMMY_WRAPPING || !WrappingAllowed(mdat))) {
            if (otmp.oartifact) {
                if (vis)
                    pline_mon(mon, _("%s %s falls off!"), s_suffix(Monnam(mon)),
                          cloak_simple_name(otmp));
                m_lose_armor(mon, otmp, polyspot);
            } else {
                 ;
                if (vis)
                    pline_mon(mon, _("%s %s tears apart!"), s_suffix(Monnam(mon)),
                          cloak_simple_name(otmp));
                else
                    You_hear(_("a ripping sound."));
                m_useup(mon, otmp);
            }
        }
        if ((otmp = which_armor(mon, W_ARMU)) != null) {
            if (vis)
                pline_mon(mon, _("%s shirt rips to shreds!"),
                          s_suffix(Monnam(mon)));
            else
                You_hear(_("a ripping sound."));
            m_useup(mon, otmp);
        }
    } else if (sliparm(mdat)) {
        /* sliparm checks whirly, noncorporeal, and small or under */
        let passes_thru_clothes = +!(mdat.msize <= MZ_SMALL);

        if ((otmp = which_armor(mon, W_ARM)) != null) {
             ;
            if (vis)
                pline_mon(mon, _("%s armor falls around %s!"),
                          s_suffix(Monnam(mon)), pronoun);
            else
                You_hear(_("a thud."));
            m_lose_armor(mon, otmp, polyspot);
        }
        if ((otmp = which_armor(mon, W_ARMC)) != null
            /* mummy wrapping adapts to small and very big sizes */
            && (otmp.otyp != MUMMY_WRAPPING || !WrappingAllowed(mdat))) {
            if (vis) {
                if (is_whirly(mon.data))
                    pline_mon(mon, _("%s %s falls, unsupported!"),
                              s_suffix(Monnam(mon)), cloak_simple_name(otmp));
                else
                    pline_mon(mon, _("%s shrinks out of %s %s!"),
                              Monnam(mon), ppronoun,
                              cloak_simple_name(otmp));
            }
            m_lose_armor(mon, otmp, polyspot);
        }
        if ((otmp = which_armor(mon, W_ARMU)) != null) {
            if (vis) {
                if (passes_thru_clothes)
                    pline_mon(mon, _("%s seeps right through %s shirt!"),
                              Monnam(mon), ppronoun);
                else
                    pline_mon(mon, _("%s becomes much too small for %s shirt!"),
                          Monnam(mon), ppronoun);
            }
            m_lose_armor(mon, otmp, polyspot);
        }
    }
    if (handless_or_tiny) {
        /* [caller needs to handle weapon checks] */
        if ((otmp = which_armor(mon, W_ARMG)) != null) {
            if (vis)
                pline_mon(mon, _("%s drops %s gloves%s!"),
                          Monnam(mon), ppronoun,
                          MON_WEP(mon) ? _(" and weapon") : _(""));
            m_lose_armor(mon, otmp, polyspot);
        }
        if ((otmp = which_armor(mon, W_ARMS)) != null) {
             ;
            if (vis)
                pline_mon(mon, _("%s can no longer hold %s shield!"),
                          Monnam(mon), ppronoun);
            else
                You_hear(_("a clank."));
            m_lose_armor(mon, otmp, polyspot);
        }
    }
    if (handless_or_tiny || has_horns(mdat)) {
        if ((otmp = which_armor(mon, W_ARMH)) != null
            /* flimsy test for horns matches polyself handling */
            && (handless_or_tiny || !is_flimsy(otmp))) {
            if (vis)
                pline_mon(mon, _("%s helmet falls to the %s!"),
                          s_suffix(Monnam(mon)), surface(mon.mx, mon.my));
            else
                You_hear(_("a clank."));
            m_lose_armor(mon, otmp, polyspot);
        }
    }
    if (handless_or_tiny || slithy(mdat) || mdat.mlet == S_CENTAUR) {
        if ((otmp = which_armor(mon, W_ARMF)) != null) {
            if (vis) {
                if (is_whirly(mon.data))
                    pline_mon(mon, _("%s boots fall away!"),
                              s_suffix(Monnam(mon)));
                else
                    pline_mon(mon, _("%s boots %s off %s feet!"),
                              s_suffix(Monnam(mon)),
                          verysmall(mdat) ? _("slide") : _("are pushed"), ppronoun);
            }
            m_lose_armor(mon, otmp, polyspot);
        }
    }
    if (!can_saddle(mon)) {
        if ((otmp = which_armor(mon, W_SADDLE)) != null) {
            m_lose_armor(mon, otmp, polyspot);
            if (vis)
                pline_mon(mon, _("%s saddle falls off."), s_suffix(Monnam(mon)));
        }
        if (mon == u.usteed)
            noride = TRUE;
    }
    if (noride || (mon == u.usteed && !can_ride(mon))) {
        You(_("can no longer ride %s."), mon_nam(mon));
        if (touch_petrifies(u.usteed.data) && !Stone_resistance() && rnl(3)) {
            let buf = stack_array(char, BUFSZ);

            You(_("touch %s."), mon_nam(u.usteed));
            sprintf(buf, _("falling off %s"), an(pmname(u.usteed.data, Mgender(u.usteed))))
;
            instapetrify(buf);
        }
        dismount_steed(DISMOUNT_FELL);
    }
    return;
    } finally { stack_pop($frame); }
}

/* bias a monster's preferences towards armor that has special benefits. */
function extra_pref(mon, obj) { /* int */
    /* currently only does speed boots, but might be expanded if monsters
     * get to use more armor abilities
     */
    if (obj) {
        if (obj.otyp == SPEED_BOOTS && mon.permspeed != MFAST)
            return 20;
    }
    return 0;
}

/*
 * Exceptions to things based on race.
 * Correctly checks polymorphed player race.
 * Returns:
 *       0 No exception, normal rules apply.
 *       1 If the race/object combination is acceptable.
 *      -1 If the race/object combination is unacceptable.
 */
export function racial_exception(mon, obj) { /* int */
    let ptr = raceptr(mon);

    /* Acceptable Exceptions: */
    /* Allow hobbits to wear elven armor - LoTR */
    if (ptr == mons[PM_HOBBIT] && is_elven_armor(obj))
        return 1;
    /* Unacceptable Exceptions: */
    /* Checks for object that certain races should never use go here */
    /*  return -1; */

    return 0;
}

/* Remove an object from a monster's inventory. */
export function extract_from_minvent(
    mon,
    obj,
    do_extrinsics,
    silently) { /* void */ /* doesn't affect all possible messages, * just update_mon_extrinsics's */
    let unwornmask = obj.owornmask;

    /*
     * At its core this is just obj_extract_self(), but it also handles
     * any updates that need to happen if the gear is equipped or in
     * some other sort of state that needs handling.
     * Note that like obj_extract_self(), this leaves obj free.
     */

    if (obj.where != OBJ_MINVENT) {
        impossible(_("extract_from_minvent called on object not in minvent"));
        return;
    }
    /* handle gold dragon scales/scale-mail (lit when worn) before clearing
       obj->owornmask because artifact_light() expects that to be W_ARM */
    if ((unwornmask & W_ARM) != 0 && obj.lamplit && artifact_light(obj))
        end_burn(obj, FALSE);

    obj_extract_self(obj);
    obj.owornmask = 0;
    if (unwornmask) {
        if (!DEADMONSTER(mon) && do_extrinsics) {
            update_mon_extrinsics(mon, obj, FALSE, silently);
        }
        mon.misc_worn_check = and64(mon.misc_worn_check, not64(unwornmask));
        /* give monster a chance to wear other equipment on its next
           move instead of waiting until it picks something up */
        check_gear_next_turn(mon);
    }
    obj_no_longer_held(obj);
    if (unwornmask & W_WEP) {
        mwepgone(mon); /* unwields and sets weapon_check to NEED_WEAPON */
    }
}

/*worn.c*/

import { ART_EYES_OF_THE_OVERWORLD } from "./artilist.h.js";
import { NH_BLACK, Something } from "./decl.h.macros.js";
import {
    AMULET_CLASS, ARMOR_CLASS, BALL_CLASS, CHAIN_CLASS, FOOD_CLASS, GEM_CLASS, RING_CLASS,
    S_CENTAUR, S_MUMMY, TOOL_CLASS, WEAPON_CLASS,
} from "./defsym.h.js";
import { BUFSZ, FALSE, TRUE } from "./global.h.js";
import { strcmpi } from "./global.h.macros.js";
import { BOLT_LIM, DISMOUNT_FELL } from "./hack.h.js";
import { ARM_BONUS, makeknown } from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { has_mcorpsenm } from "./mextra.h.macros.js";
import {
    cantweararm, has_horns, is_animal, is_whirly, mindless, nohands, slithy, touch_petrifies,
    verysmall,
} from "./mondata.h.macros.js";
import { MZ_HUMAN, MZ_SMALL } from "./monflag.h.js";
import { MFAST, MSLOW } from "./monst.h.js";
import { DEADMONSTER, MON_WEP, monstunseesu_prop } from "./monst.h.macros.js";
import { NON_PM, PM_HOBBIT, PM_LONG_WORM, PM_MONK, PM_SKELETON, PM_WIZARD } from "./monsters.h.js";
import { OBJ_MINVENT, struct_obj } from "./obj.h.js";
import {
    Dragon_mail_to_pm, Dragon_scales_to_pm, Has_contents, Is_dragon_mail, Is_dragon_scales,
    WrappingAllowed, bimanual, is_boots, is_cloak, is_elven_armor, is_flimsy, is_gloves, is_helmet,
    is_shield, is_shirt, is_suit, is_weptool,
} from "./obj.h.macros.js";
import {
    ARM_BOOTS, ARM_CLOAK, ARM_GLOVES, ARM_HELM, ARM_SHIELD, ARM_SHIRT, ARM_SUIT,
} from "./objclass.h.js";
import {
    ALCHEMY_SMOCK, AMULET_OF_GUARDING, AMULET_OF_LIFE_SAVING, AMULET_OF_REFLECTION, BLINDFOLD,
    CORNUTHAUM, DUNCE_CAP, HELM_OF_OPPOSITE_ALIGNMENT, LENSES, MEAT_RING, MUMMY_WRAPPING, SADDLE,
    SPEED_BOOTS, TIN_OPENER, TOWEL,
} from "./objects.h.js";
import {
    ACID_RES, ANTIMAGIC, BLINDED, CLAIRVOYANT, COLD_RES, DISINT_RES, DISPLACED, FAST, FIRE_RES,
    FLYING, FUMBLING, INVIS, I_SPECIAL, JUMPING, LEVITATION, POISON_RES, PROTECTION, REFLECTING,
    SHOCK_RES, SLEEP_RES, STEALTH, STONE_RES, TELEPAT, WWALKING, W_AMUL, W_ARM, W_ARMC, W_ARMF,
    W_ARMG, W_ARMH, W_ARMOR, W_ARMS, W_ARMU, W_ART, W_ARTI, W_BALL, W_CHAIN, W_QUIVER, W_RINGL,
    W_RINGR, W_SADDLE, W_SWAPWEP, W_TOOL, W_WEP,
} from "./prop.h.js";
import { res_to_mr } from "./prop.h.macros.js";
import { fmon, fobj } from "./rm.h.macros.js";
import { cansee } from "./vision.h.macros.js";
import { AC_MAX } from "./you.h.js";
import { Role_if, mhim, mhis } from "./you.h.macros.js";
import { ETelepat, See_invisible, Stone_resistance } from "./youprop.h.macros.js";
import { char, long, ord, sizeof, sizeof_string, uchar, unsigned } from "../rt/ctypes.js";
import { global_ref } from "../rt/globals.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64, not64, or64 } from "../rt/int64.js";
import { abs, sprintf, strcpy } from "../rt/libc.js";
import { stack_array, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, array_of, ptr_add, ptr_to, struct } from "../rt/struct.js";
import { fmt_ptr } from "./alloc.js";
import { artifact_light, is_art, set_artifact_intrinsic } from "./artifact.js";
import { disp, flags, gb, gi, gm, go, gu, gy, iflags, svc, svl, u } from "./decl.js";
import { canseemon, newsym } from "./display.js";
import { obj_no_longer_held } from "./do.js";
import { Mgender, Monnam, hcolor, mon_nam, pmname } from "./do_name.js";
import { cancel_doff } from "./do_wear.js";
import { surface } from "./dungeon.js";
import { s_suffix, sgn, strncmpi, strsubst } from "./hacklib.js";
import { update_inventory } from "./invent.js";
import { arti_light_description } from "./light.js";
import { curse, obj_extract_self, place_object } from "./mkobj.js";
import { check_gear_next_turn } from "./mon.js";
import { breakarm, raceptr, sliparm } from "./mondata.js";
import { mons } from "./monst.js";
import { m_useup } from "./mthrowu.js";
import { objects } from "./objects.js";
import {
    Yname2, an, cloak_simple_name, distant_name, doname, otense, simpleonames,
} from "./objnam.js";
import { You, You_hear, impossible, pline, pline_mon } from "./pline.js";
import { rnl } from "./rnd.js";
import { can_ride, can_saddle, dismount_steed } from "./steed.js";
import { begin_burn, end_burn } from "./timeout.js";
import { instapetrify } from "./trap.js";
import { vision_recalc } from "./vision.js";
import { mwepgone } from "./weapon.js";
import { set_twoweap } from "./wield.js";
import { see_wsegs } from "./worm.js";
import { learnwand } from "./zap.js";
