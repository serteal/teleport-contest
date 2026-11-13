/* NetHack 5.0	do_wear.c	$NHDT-Date: 1737343372 2025/01/19 19:22:52 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.201 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2012. */
/* NetHack may be freely redistributed.  See license for details. */

const see_yourself = init_string(static_array("see_yourself", char, sizeof_string("see yourself")), _("see yourself"), true);
const unknown_type = init_string(static_array("unknown_type", char, sizeof_string("Unknown type of %s (%d)")), _("Unknown type of %s (%d)"), true);
const c_armor = init_string(static_array("c_armor", char, sizeof_string("armor")), _("armor"), true); const c_suit = init_string(static_array("c_suit", char, sizeof_string("suit")), _("suit"), true);
const c_shirt = init_string(static_array("c_shirt", char, sizeof_string("shirt")), _("shirt"), true); const c_cloak = init_string(static_array("c_cloak", char, sizeof_string("cloak")), _("cloak"), true);
const c_gloves = init_string(static_array("c_gloves", char, sizeof_string("gloves")), _("gloves"), true); const c_boots = init_string(static_array("c_boots", char, sizeof_string("boots")), _("boots"), true);
const c_helmet = init_string(static_array("c_helmet", char, sizeof_string("helmet")), _("helmet"), true); const c_shield = init_string(static_array("c_shield", char, sizeof_string("shield")), _("shield"), true);
const c_weapon = init_string(static_array("c_weapon", char, sizeof_string("weapon")), _("weapon"), true); const c_sword = init_string(static_array("c_sword", char, sizeof_string("sword")), _("sword"), true);
const c_axe = init_string(static_array("c_axe", char, sizeof_string("axe")), _("axe"), true); const c_that_ = init_string(static_array("c_that_", char, sizeof_string("that")), _("that"), true);

const takeoff_order = static_array("takeoff_order", long, null, [
    WORN_BLINDF, W_WEP,      WORN_SHIELD, WORN_GLOVES, LEFT_RING,
    RIGHT_RING,  WORN_CLOAK, WORN_HELMET, WORN_AMUL,   WORN_ARMOR,
    WORN_SHIRT,  WORN_BOOTS, W_SWAPWEP,   W_QUIVER,    0
]);

/* int Boots_on(void); -- moved to extern.h */

/* maybe_destroy_armor() may return NULL */

/* plural "fingers" or optionally "gloves" */
export function fingers_or_gloves(check_gloves) { /* const char * */
    return ((check_gloves && uarmg)
            ? gloves_simple_name(uarmg) /* "gloves" or "gauntlets" */
            : makeplural(body_part(FINGER))); /* "fingers" */
}

export function off_msg(otmp) { /* void */
    if (flags.verbose)
        You(_("were wearing %s."), doname(otmp));
}

/* for items that involve no delay */
function on_msg(otmp) { /* void */
    const $frame = stack_frame(); try {
    /* on_msg() for rings and amulets just shows add-to-invent feedback
       [after caller calls setworn(), for suffix: "(on {left|right} hand)"
       or "(being worn)"]; eyewear too unless giving verbose message below */
    if ((otmp.owornmask & (W_RING | W_AMUL)) != 0
        || ((otmp.owornmask & W_TOOL) != 0 && !flags.verbose)) {
        prinv((0), otmp, 0);
        return;
    }

    if (flags.verbose) {
        let how = stack_array(char, BUFSZ);
        /* call xname() before obj_is_pname(); formatting obj's name
           might set obj->dknown and that affects the pname test */
        let otmp_name = xname(otmp);

        chars[how + 0] = ord('\0');
        if (otmp.otyp == TOWEL)
            sprintf(how, _(" around your %s"), body_part(HEAD));
        You(_("are now wearing %s%s."),
            obj_is_pname(otmp) ? the(otmp_name) : an(otmp_name), how);
    }
    } finally { stack_pop($frame); }
}

/* putting on or taking off an item which confers stealth;
   give feedback and discover it iff stealth state is changing;
   stealth is blocked by riding unless hero+steed fly (handled with
   BStealth by mount and dismount routines) */
function toggle_stealth(
    obj,
    oldprop,
    on) { /* void */
    if (on ? gi.initial_don : svc.context.takeoff.cancelled_don)
        return;

    if (!oldprop /* extrinsic stealth from something else */
        && !HStealth() /* intrinsic stealth */
        && !BStealth()) { /* stealth blocked by something */
        if (obj.otyp == RIN_STEALTH)
            learnring(obj, TRUE);
        else /* discover elven cloak or elven boots */
            makeknown(obj.otyp);

        if (on) {
            if (!is_boots(obj))
                You(_("move very quietly."));
            else if (Levitation() || Flying())
                You(_("float imperceptibly."));
            else
                You(_("walk very quietly."));
        } else {
            let riding = +(u.usteed != null);

            You(_("%s%s are noisy."), riding ? _("and ") : _("sure"),
                riding ? x_monnam(u.usteed, ARTICLE_YOUR, (0),
                                  (SUPPRESS_SADDLE | SUPPRESS_HALLUCINATION),
                                  FALSE)
                       : _(""));
        }
    }
}

/* putting on or taking off an item which confers displacement, or gaining
   or losing timed displacement after eating a displacer beast corpse or tin;
   give feedback and discover it iff displacement state is changing *and*
   hero is able to see self (or sense monsters); for timed, 'obj' is Null
   and this is only called for the message */
export function toggle_displacement(
    obj,
    oldprop,

    on) { /* void */
    if (on ? gi.initial_don : svc.context.takeoff.cancelled_don)
        return;

    if (!oldprop /* extrinsic displacement from something else */
        && !(u.uprops[DISPLACED].intrinsic) /* timed, from eating */
        && !(u.uprops[DISPLACED].blocked) /* (theoretical) */
        /* we don't use canseeself() here because it augments vision
           with touch, which isn't appropriate for deciding whether
           we'll notice that monsters have trouble spotting the hero */
        && ((!Blind()         /* see anything */
             && !u.uswallow /* see surroundings */
             && !Invisible()) /* see self */
            /* actively sensing nearby monsters via telepathy or extended
               monster detection overrides vision considerations because
               hero also senses self in this situation */
            || (Unblind_telepat()
                || (Blind_telepat() && Blind())
                || Detect_monsters()))) {
        if (obj)
            makeknown(obj.otyp);

        You_feel(_("that monsters%s have difficulty pinpointing your location."),
                 on ? _("") : _(" no longer"));
    }
}

/*
 * The Type_on() functions should be called *after* setworn().
 * The Type_off() functions call setworn() themselves.
 * [Blindf_on() is an exception and calls setworn() itself.]
 */

export function Boots_on() { /* int */
    let oldprop = and64(u.uprops[objects[uarmf.otyp].oc_oprop].extrinsic, ~WORN_BOOTS);

    switch (uarmf.otyp) {
    case LOW_BOOTS:
    case IRON_SHOES:
    case HIGH_BOOTS:
    case JUMPING_BOOTS:
    case KICKING_BOOTS:
        break;
    case WATER_WALKING_BOOTS:
        /*
         * Sequencing issue?  If underwater (perhaps via magical breathing),
         * putting on water walking boots produces "you slowly rise above
         * the surface" then "you finish your dressing maneuver".
         */

        /* spoteffects() doesn't get called here; pooleffects() is called
           during movement and u.uinwater is already False after setworn() */
        if (u.uinwater)
            spoteffects(TRUE);
        /* init'd in accessory_or_armor_on() and only used here */
        if (gw.wasinwater) {
            if (!u.uinwater)
                makeknown(WATER_WALKING_BOOTS);
            gw.wasinwater = 0;
        }
        /* (we don't need a lava check here since boots can't be
           put on while feet are stuck) */
        break;
    case SPEED_BOOTS:
        /* Speed boots are still better than intrinsic speed, */
        /* though not better than potion speed */
        if (!oldprop && !(HFast() & TIMEOUT)) {
            makeknown(uarmf.otyp);
            You_feel(_("yourself speed up%s."),
                     (oldprop || HFast()) ? _(" a bit more") : _(""));
        }
        break;
    case ELVEN_BOOTS:
        toggle_stealth(uarmf, oldprop, TRUE);
        break;
    case FUMBLE_BOOTS:
        if (!oldprop && !(HFumbling() & ~TIMEOUT))
            incr_itimeout(ref_of(u.uprops[FUMBLING], "intrinsic"), rnd(20));
        break;
    case LEVITATION_BOOTS:
        if (!oldprop && !HLevitation() && !(BLevitation() & FROMOUTSIDE)) {
            uarmf.known = 1; /* might come off if putting on over a sink,
                               * so uarmf could be Null below; status line
                               * gets updated during brief interval they're
                               * worn so hero and player learn enchantment */
            disp.botl = TRUE; /* status hilites might mark AC changed */
            makeknown(uarmf.otyp);
            float_up();
            if (Levitation())
                spoteffects(FALSE); /* for sink effect */
        } else {
            float_vs_flight(); /* maybe toggle BFlying's I_SPECIAL */
        }
        break;
    default:
        impossible(unknown_type, c_boots, uarmf.otyp);
    }
    /* uarmf could be Null here (levitation boots put on over a sink) */
    if (uarmf && !uarmf.known) {
        uarmf.known = 1; /* boots' +/- evident because of status line AC */
        update_inventory();
    }
    return 0;
}

export function Boots_off() { /* int */
    let otmp = uarmf;
    let otyp = otmp.otyp;
    let oldprop = and64(u.uprops[objects[otyp].oc_oprop].extrinsic, ~WORN_BOOTS);

    svc.context.takeoff.mask = and64(svc.context.takeoff.mask, ~W_ARMF);
    /* For levitation, float_down() returns if Levitation, so we
     * must do a setworn() _before_ the levitation case.
     */
    setworn(null, W_ARMF);
    switch (otyp) {
    case SPEED_BOOTS:
        if (!Very_fast() && !svc.context.takeoff.cancelled_don) {
            makeknown(otyp);
            You_feel(_("yourself slow down%s."), Fast() ? _(" a bit") : _(""));
        }
        break;
    case WATER_WALKING_BOOTS:
        /* check for lava since fireproofed boots make it viable */
        if ((is_pool(u.ux, u.uy) || is_lava(u.ux, u.uy))
            && !Levitation() && !Flying()
            && !(is_clinger(gy.youmonst.data) && has_ceiling(u.uz))
            && !svc.context.takeoff.cancelled_don
            /* avoid recursive call to lava_effects() */
            && !iflags.in_lava_effects) {
            /* make boots known in case you survive the drowning */
            makeknown(otyp);
            spoteffects(TRUE);
        }
        break;
    case ELVEN_BOOTS:
        toggle_stealth(otmp, oldprop, FALSE);
        break;
    case FUMBLE_BOOTS:
        if (!oldprop && !(HFumbling() & ~TIMEOUT))
            u.uprops[FUMBLING].intrinsic = u.uprops[FUMBLING].extrinsic = 0;
        break;
    case LEVITATION_BOOTS:
        if (!oldprop && !HLevitation() && !(BLevitation() & FROMOUTSIDE)
            && !svc.context.takeoff.cancelled_don) {
            /* lava_effects() sets in_lava_effects and calls Boots_off()
               so hero is already in midst of floating down */
            if (!iflags.in_lava_effects)
                float_down(0, 0);
            makeknown(otyp);
        } else {
            float_vs_flight(); /* maybe toggle (BFlying & I_SPECIAL) */
        }
        break;
    case LOW_BOOTS:
    case IRON_SHOES:
    case HIGH_BOOTS:
    case JUMPING_BOOTS:
    case KICKING_BOOTS:
        break;
    default:
        impossible(unknown_type, c_boots, otyp);
    }
    svc.context.takeoff.cancelled_don = FALSE;
    return 0;
}

function Cloak_on() { /* int */
    let oldprop = and64(u.uprops[objects[uarmc.otyp].oc_oprop].extrinsic, ~WORN_CLOAK);

    switch (uarmc.otyp) {
    case ORCISH_CLOAK:
    case DWARVISH_CLOAK:
    case CLOAK_OF_MAGIC_RESISTANCE:
    case ROBE:
    case LEATHER_CLOAK:
        break;
    case CLOAK_OF_PROTECTION:
        makeknown(uarmc.otyp);
        break;
    case ELVEN_CLOAK:
        toggle_stealth(uarmc, oldprop, TRUE);
        break;
    case CLOAK_OF_DISPLACEMENT:
        toggle_displacement(uarmc, oldprop, TRUE);
        break;
    case MUMMY_WRAPPING:
        /* Note: it's already being worn, so we have to cheat here. */
        if ((HInvis() || EInvis()) && !Blind()) {
            newsym(u.ux, u.uy);
            You(_("can %s!"), See_invisible() ? _("no longer see through yourself")
                                         : see_yourself);
        }
        break;
    case CLOAK_OF_INVISIBILITY:
        /* since cloak of invisibility was worn, we know mummy wrapping
           wasn't, so no need to check `oldprop' against blocked */
        if (!oldprop && !HInvis() && !Blind()) {
            makeknown(uarmc.otyp);
            newsym(u.ux, u.uy);
            pline(_("Suddenly you can%s yourself."),
                  See_invisible() ? _(" see through") : _("not see"));
        }
        break;
    case OILSKIN_CLOAK:
        pline(_("%s very tightly."), Tobjnam(uarmc, _("fit")));
        break;
    /* Alchemy smock gives poison _and_ acid resistance */
    case ALCHEMY_SMOCK:
        u.uprops[ACID_RES].extrinsic = or64(u.uprops[ACID_RES].extrinsic, WORN_CLOAK);
        break;
    default:
        impossible(unknown_type, c_cloak, uarmc.otyp);
    }
    if (uarmc && !uarmc.known) { /* no known instance of !uarmc here */
        uarmc.known = 1; /* cloak's +/- evident because of status line AC */
        update_inventory();
    }
    return 0;
}

export function Cloak_off() { /* int */
    let otmp = uarmc;
    let otyp = otmp.otyp;
    let oldprop = and64(u.uprops[objects[otyp].oc_oprop].extrinsic, ~WORN_CLOAK);

    svc.context.takeoff.mask = and64(svc.context.takeoff.mask, ~W_ARMC);
    /* For mummy wrapping, taking it off first resets `Invisible'. */
    setworn(null, W_ARMC);
    switch (otyp) {
    case ORCISH_CLOAK:
    case DWARVISH_CLOAK:
    case CLOAK_OF_PROTECTION:
    case CLOAK_OF_MAGIC_RESISTANCE:
    case OILSKIN_CLOAK:
    case ROBE:
    case LEATHER_CLOAK:
        break;
    case ELVEN_CLOAK:
        toggle_stealth(otmp, oldprop, FALSE);
        break;
    case CLOAK_OF_DISPLACEMENT:
        toggle_displacement(otmp, oldprop, FALSE);
        break;
    case MUMMY_WRAPPING:
        if (Invis() && !Blind()) {
            newsym(u.ux, u.uy);
            You(_("can %s."), See_invisible() ? _("see through yourself")
                                         : _("no longer see yourself"));
        }
        break;
    case CLOAK_OF_INVISIBILITY:
        if (!oldprop && !HInvis() && !Blind()) {
            makeknown(CLOAK_OF_INVISIBILITY);
            newsym(u.ux, u.uy);
            pline(_("Suddenly you can %s."),
                  See_invisible() ? _("no longer see through yourself")
                                : see_yourself);
        }
        break;
    /* Alchemy smock gives poison _and_ acid resistance */
    case ALCHEMY_SMOCK:
        u.uprops[ACID_RES].extrinsic = and64(u.uprops[ACID_RES].extrinsic, ~WORN_CLOAK);
        break;
    default:
        impossible(unknown_type, c_cloak, otyp);
    }
    return 0;
}

function Helmet_on() { /* int */
    switch (uarmh.otyp) {
    case FEDORA:
        if (Role_if(PM_ARCHEOLOGIST))
            change_luck(1);
        break;
    case HELMET:
    case DENTED_POT:
    case ELVEN_LEATHER_HELM:
    case DWARVISH_IRON_HELM:
    case ORCISH_HELM:
    case HELM_OF_TELEPATHY:
        break;
    case HELM_OF_CAUTION:
        see_monsters();
        break;
    case HELM_OF_BRILLIANCE:
        adj_abon(uarmh, uarmh.spe);
        break;
    case CORNUTHAUM:
        /* people think marked wizards know what they're talking about,
           but it takes trained arrogance to pull it off, and the actual
           enchantment of the hat is irrelevant */
        (chars[u.abon.a + A_CHA]) += (Role_if(PM_WIZARD) ? 1 : -1);
        disp.botl = TRUE;
        makeknown(uarmh.otyp);
        break;
    case HELM_OF_OPPOSITE_ALIGNMENT:
        uarmh.known = 1; /* do this here because uarmh could get cleared */
        /* changing alignment can toggle off active artifact properties,
           including levitation; uarmh could get dropped or destroyed here
           by hero falling onto a polymorph trap or into water (emergency
           disrobe) or maybe lava (probably not, helm isn't 'organic') */
        uchangealign((u.ualign.type != A_NEUTRAL)
                         ? -u.ualign.type
                         : (uarmh.o_id % 2) ? A_CHAOTIC : A_LAWFUL,
                     A_CG_HELM_ON);
        /* makeknown(HELM_OF_OPPOSITE_ALIGNMENT); -- below, after Tobjnam() */
        /* FALLTHROUGH */;
    /*FALLTHRU*/
    case DUNCE_CAP:
        if (uarmh && !uarmh.cursed) {
            if (Blind())
                pline(_("%s for a moment."), Tobjnam(uarmh, _("vibrate")));
            else
                pline(_("%s %s for a moment."), Tobjnam(uarmh, _("glow")),
                      hcolor(NH_BLACK()));
            curse(uarmh);
            /* curse() doesn't touch bknown so doesn't update persistent
               inventory; do so now [set_bknown() calls update_inventory()] */
            if (Blind())
                set_bknown(uarmh, 0); /* lose bknown if previously set */
            else if (Role_if(PM_CLERIC))
                set_bknown(uarmh, 1); /* (bknown should already be set) */
            else if (uarmh.bknown)
                update_inventory(); /* keep bknown as-is; display the curse */
        }
        disp.botl = TRUE; /* reveal new alignment or INT & WIS */
        if (Hallucination()) {
            pline(_("My brain hurts!")); /* Monty Python's Flying Circus */
        } else if (uarmh && uarmh.otyp == DUNCE_CAP) {
            You_feel(_("%s."), /* track INT change; ignore WIS */
                     ACURR(A_INT)
                             <= (ABASE(A_INT) + ABON(A_INT) + ATEMP(A_INT))
                         ? _("like sitting in a corner")
                         : _("giddy"));
        } else {
            /* [message formerly given here moved to uchangealign()] */
            makeknown(HELM_OF_OPPOSITE_ALIGNMENT);
        }
        break;
    default:
        impossible(unknown_type, c_helmet, uarmh.otyp);
    }
    /* uarmh could be Null due to uchangealign() */
    if (uarmh && !uarmh.known) {
        uarmh.known = 1; /* helmet's +/- evident because of status line AC */
        update_inventory();
    }
    return 0;
}

export function Helmet_off() { /* int */
    svc.context.takeoff.mask = and64(svc.context.takeoff.mask, ~W_ARMH);

    switch (uarmh.otyp) {
    case FEDORA:
        if (Role_if(PM_ARCHEOLOGIST))
            change_luck(-1);
        break;
    case HELMET:
    case DENTED_POT:
    case ELVEN_LEATHER_HELM:
    case DWARVISH_IRON_HELM:
    case ORCISH_HELM:
        break;
    case DUNCE_CAP:
        disp.botl = TRUE;
        break;
    case CORNUTHAUM:
        if (!svc.context.takeoff.cancelled_don) {
            (chars[u.abon.a + A_CHA]) += (Role_if(PM_WIZARD) ? -1 : 1);
            disp.botl = TRUE;
        }
        break;
    case HELM_OF_TELEPATHY:
    case HELM_OF_CAUTION:
        /* need to update ability before calling see_monsters() */
        setworn(null, W_ARMH);
        see_monsters();
        return 0;
    case HELM_OF_BRILLIANCE:
        if (!svc.context.takeoff.cancelled_don)
            adj_abon(uarmh, -uarmh.spe);
        break;
    case HELM_OF_OPPOSITE_ALIGNMENT:
        /* changing alignment can toggle off active artifact
           properties, including levitation; uarmh could get
           dropped or destroyed here */
        uchangealign(chars[u.ualignbase + A_CURRENT], A_CG_HELM_OFF);
        break;
    default:
        impossible(unknown_type, c_helmet, uarmh.otyp);
    }
    setworn(null, W_ARMH);
    svc.context.takeoff.cancelled_don = FALSE;
    return 0;
}

/* hard helms provide better protection against falling rocks */
export function hard_helmet(obj) { /* boolean */
    if (!obj || !is_helmet(obj))
        return FALSE;
    return (is_metallic(obj) || is_crackable(obj)) ? TRUE : FALSE;
}

function Gloves_on() { /* int */
    let oldprop = and64(u.uprops[objects[uarmg.otyp].oc_oprop].extrinsic, ~WORN_GLOVES);

    switch (uarmg.otyp) {
    case LEATHER_GLOVES:
        break;
    case GAUNTLETS_OF_FUMBLING:
        if (!oldprop && !(HFumbling() & ~TIMEOUT))
            incr_itimeout(ref_of(u.uprops[FUMBLING], "intrinsic"), rnd(20));
        break;
    case GAUNTLETS_OF_POWER:
        makeknown(uarmg.otyp);
        disp.botl = TRUE; /* taken care of in attrib.c */
        break;
    case GAUNTLETS_OF_DEXTERITY:
        adj_abon(uarmg, uarmg.spe);
        break;
    default:
        impossible(unknown_type, c_gloves, uarmg.otyp);
    }
    if (!uarmg.known) {
        uarmg.known = 1; /* gloves' +/- evident because of status line AC */
        update_inventory();
    }
    return 0;
}

/* check for wielding cockatrice corpse after taking off gloves or yellow
   dragon scales/mail or having temporary stoning resistance time out */
export function wielding_corpse(
    obj,
    how,
    voluntary) { /* void */ /* True: taking protective armor off on purpose */
    const $frame = stack_frame(); try {
    if (!obj || obj.otyp != CORPSE || uarmg)
        return;
    /* note: can't dual-wield with non-weapons/weapon-tools so u.twoweap
       will always be false if uswapwep happens to be a corpse */
    if (obj != uwep && (obj != uswapwep || !u.twoweap))
        return;

    if (touch_petrifies(mons[obj.corpsenm]) && !Stone_resistance()) {
        let kbuf = stack_array(char, BUFSZ), hbuf = stack_array(char, BUFSZ);

        You(_("%s %s in your bare %s."),
            (how && is_gloves(how)) ? _("now wield") : _("are wielding"),
            corpse_xname(obj, 0, CXN_ARTICLE),
            makeplural(body_part(HAND)));
        /* "removing" ought to be "taking off" but that makes the
           tombstone text more likely to be truncated */
        if (how)
            sprintf(hbuf, _("%s %s"), voluntary ? _("removing") : _("losing"), is_gloves(how) ? gloves_simple_name(how)
                    : strsubst(simpleonames(how), _("set of "), _("")));
        else
            strcpy(hbuf, _("resistance timing out"))
;
        Snprintf(kbuf, sizeof(array_of(char, BUFSZ)), _("%s while wielding %s"), hbuf, killer_xname(obj))
;
        instapetrify(kbuf);
        /* life-saved or got poly'd into a stone golem; can't continue
           wielding cockatrice corpse unless have now become resistant */
        if (!Stone_resistance())
            remove_worn_item(obj, FALSE);
    }
    } finally { stack_pop($frame); }
}

export function Gloves_off() { /* int */
    let gloves = uarmg; /* needed after uarmg has been set to Null */
    let oldprop = and64(u.uprops[objects[uarmg.otyp].oc_oprop].extrinsic, ~WORN_GLOVES);

    let on_purpose = +(!svc.context.mon_moving && !uarmg.in_use);

    svc.context.takeoff.mask = and64(svc.context.takeoff.mask, ~W_ARMG);

    switch (uarmg.otyp) {
    case LEATHER_GLOVES:
        break;
    case GAUNTLETS_OF_FUMBLING:
        if (!oldprop && !(HFumbling() & ~TIMEOUT))
            u.uprops[FUMBLING].intrinsic = u.uprops[FUMBLING].extrinsic = 0;
        break;
    case GAUNTLETS_OF_POWER:
        makeknown(uarmg.otyp);
        disp.botl = TRUE; /* taken care of in attrib.c */
        break;
    case GAUNTLETS_OF_DEXTERITY:
        if (!svc.context.takeoff.cancelled_don)
            adj_abon(uarmg, -uarmg.spe);
        break;
    default:
        impossible(unknown_type, c_gloves, uarmg.otyp);
    }
    setworn(null, W_ARMG);
    svc.context.takeoff.cancelled_don = FALSE;
    encumber_msg(); /* immediate feedback for GoP */

    /* usually can't remove gloves when they're slippery but it can
       be done by having them fall off (polymorph), stolen, or
       destroyed (scroll, overenchantment, monster spell); if that
       happens, 'cure' slippery fingers so that it doesn't transfer
       from gloves to bare hands */
    if (Glib())
        make_glib(0); /* for update_inventory() */

    /* prevent wielding cockatrice when not wearing gloves */
    if (uwep && uwep.otyp == CORPSE)
        wielding_corpse(uwep, gloves, on_purpose);
    /* KMH -- ...or your secondary weapon when you're wielding it
       [This case can't actually happen; twoweapon mode won't engage
       if a corpse has been set up as either the primary or alternate
       weapon.  If it could happen and /both/ uwep and uswapwep could
       be cockatrice corpses, life-saving for the first would need to
       prevent the second from being fatal since conceptually they'd
       be being touched simultaneously.] */
    if (u.twoweap && uswapwep && uswapwep.otyp == CORPSE)
        wielding_corpse(uswapwep, gloves, on_purpose);

    if (condtests[bl_bareh].enabled)
        disp.botl = TRUE;

    return 0;
}

function Shield_on() { /* int */
    /* no shield currently requires special handling when put on, but we
       keep this uncommented in case somebody adds a new one which does
       [the magical shields are handled by setting u.uprops[*].extrinsic
       in setworn() called by armor_or_accessory_on() before Shield_on()] */
    switch (uarms.otyp) {
    case SMALL_SHIELD:
    case SHIELD_OF_DRAIN_RESISTANCE:
    case SHIELD_OF_SHOCK_RESISTANCE:
    case ELVEN_SHIELD:
    case URUK_HAI_SHIELD:
    case ORCISH_SHIELD:
    case DWARVISH_ROUNDSHIELD:
    case LARGE_SHIELD:
    case SHIELD_OF_REFLECTION:
        break;
    default:
        impossible(unknown_type, c_shield, uarms.otyp);
    }
    if (!uarms.known) {
        uarms.known = 1; /* shield's +/- evident because of status line AC */
        update_inventory();
    }
    return 0;
}

export function Shield_off() { /* int */
    svc.context.takeoff.mask = and64(svc.context.takeoff.mask, ~W_ARMS);

    /* no shield currently requires special handling when taken off, but we
       keep this uncommented in case somebody adds a new one which does */
    switch (uarms.otyp) {
    case SMALL_SHIELD:
    case SHIELD_OF_DRAIN_RESISTANCE:
    case SHIELD_OF_SHOCK_RESISTANCE:
    case ELVEN_SHIELD:
    case URUK_HAI_SHIELD:
    case ORCISH_SHIELD:
    case DWARVISH_ROUNDSHIELD:
    case LARGE_SHIELD:
    case SHIELD_OF_REFLECTION:
        break;
    default:
        impossible(unknown_type, c_shield, uarms.otyp);
    }

    setworn(null, W_ARMS);
    return 0;
}

function Shirt_on() { /* int */
    /* no shirt currently requires special handling when put on, but we
       keep this uncommented in case somebody adds a new one which does */
    switch (uarmu.otyp) {
    case HAWAIIAN_SHIRT:
    case T_SHIRT:
        break;
    default:
        impossible(unknown_type, c_shirt, uarmu.otyp);
    }
    if (!uarmu.known) {
        uarmu.known = 1; /* shirt's +/- evident because of status line AC */
        update_inventory();
    }
    return 0;
}

export function Shirt_off() { /* int */
    svc.context.takeoff.mask = and64(svc.context.takeoff.mask, ~W_ARMU);

    /* no shirt currently requires special handling when taken off, but we
       keep this uncommented in case somebody adds a new one which does */
    switch (uarmu.otyp) {
    case HAWAIIAN_SHIRT:
    case T_SHIRT:
        break;
    default:
        impossible(unknown_type, c_shirt, uarmu.otyp);
    }

    setworn(null, W_ARMU);
    return 0;
}

/* handle extra abilities for hero wearing dragon scale armor */
function dragon_armor_handling(
    otmp,
    puton,
    on_purpose) { /* void */ /* voluntary removal; not applicable for putting on */
    if (!otmp)
        return;

    switch (otmp.otyp) {
        /* grey: no extra effect */
        /* silver: no extra effect */
    case BLACK_DRAGON_SCALES:
    case BLACK_DRAGON_SCALE_MAIL:
        if (puton) {
            u.uprops[DRAIN_RES].extrinsic = or64(u.uprops[DRAIN_RES].extrinsic, W_ARM);
        } else {
            u.uprops[DRAIN_RES].extrinsic = and64(u.uprops[DRAIN_RES].extrinsic, ~W_ARM);
        }
        break;
    case BLUE_DRAGON_SCALES:
    case BLUE_DRAGON_SCALE_MAIL:
        if (puton) {
            if (!Very_fast())
                You(_("speed up%s."), Fast() ? _(" a bit more") : _(""));
            u.uprops[FAST].extrinsic = or64(u.uprops[FAST].extrinsic, W_ARM);
        } else {
            u.uprops[FAST].extrinsic = and64(u.uprops[FAST].extrinsic, ~W_ARM);
            if (!Very_fast() && !svc.context.takeoff.cancelled_don)
                You(_("slow down."));
        }
        break;
    case GREEN_DRAGON_SCALES:
    case GREEN_DRAGON_SCALE_MAIL:
        if (puton) {
            u.uprops[SICK_RES].extrinsic = or64(u.uprops[SICK_RES].extrinsic, W_ARM);
        } else {
            u.uprops[SICK_RES].extrinsic = and64(u.uprops[SICK_RES].extrinsic, ~W_ARM);
        }
        break;
    case RED_DRAGON_SCALES:
    case RED_DRAGON_SCALE_MAIL:
        if (puton) {
            u.uprops[INFRAVISION].extrinsic = or64(u.uprops[INFRAVISION].extrinsic, W_ARM);
        } else {
            u.uprops[INFRAVISION].extrinsic = and64(u.uprops[INFRAVISION].extrinsic, ~W_ARM);
        }
        see_monsters();
        break;
    case GOLD_DRAGON_SCALES:
    case GOLD_DRAGON_SCALE_MAIL:
        make_hallucinated((+!puton),
                                 program_state.restoring ? FALSE : TRUE,
                                 W_ARM);
        break;
    case ORANGE_DRAGON_SCALES:
    case ORANGE_DRAGON_SCALE_MAIL:
        if (puton) {
            u.uprops[FREE_ACTION].extrinsic = or64(u.uprops[FREE_ACTION].extrinsic, W_ARM);
        } else {
            u.uprops[FREE_ACTION].extrinsic = and64(u.uprops[FREE_ACTION].extrinsic, ~W_ARM);
        }
        break;
    case YELLOW_DRAGON_SCALES:
    case YELLOW_DRAGON_SCALE_MAIL:
        if (puton) {
            u.uprops[STONE_RES].extrinsic = or64(u.uprops[STONE_RES].extrinsic, W_ARM);
        } else {
            u.uprops[STONE_RES].extrinsic = and64(u.uprops[STONE_RES].extrinsic, ~W_ARM);

            /* prevent wielding cockatrice after losing stoning resistance
               when not wearing gloves; the uswapwep case is always a no-op */
            wielding_corpse(uwep, otmp, on_purpose);
            wielding_corpse(uswapwep, otmp, on_purpose);
        }
        break;
    case WHITE_DRAGON_SCALES:
    case WHITE_DRAGON_SCALE_MAIL:
        if (puton) {
            u.uprops[SLOW_DIGESTION].extrinsic = or64(u.uprops[SLOW_DIGESTION].extrinsic, W_ARM);
        } else {
            u.uprops[SLOW_DIGESTION].extrinsic = and64(u.uprops[SLOW_DIGESTION].extrinsic, ~W_ARM);
        }
        break;
    default:
        break;
    }
}

function Armor_on() { /* int */
    if (!uarm) /* no known instances of !uarm here but play it safe */
        return 0;
    if (!uarm.known) {
        uarm.known = 1; /* suit's +/- evident because of status line AC */
        update_inventory();
    }
    dragon_armor_handling(uarm, TRUE, TRUE);
    /* gold DSM requires extra handling since it emits light when worn;
       do that after the special armor handling */
    if (artifact_light(uarm) && !uarm.lamplit) {
        begin_burn(uarm, FALSE);
        if (!Blind())
            pline(_("%s %s to shine %s!"),
                  Yname2(uarm), otense(uarm, _("begin")),
                  arti_light_description(uarm));
    }
    return 0;
}

export function Armor_off() { /* int */
    let otmp = uarm;
    let was_arti_light = (otmp && otmp.lamplit && artifact_light(otmp) ? 1 : 0);

    svc.context.takeoff.mask = and64(svc.context.takeoff.mask, ~W_ARM);
    setworn(null, W_ARM);
    svc.context.takeoff.cancelled_don = FALSE;

    /* taking off yellow dragon scales/mail might be fatal; arti_light
       comes from gold dragon scales/mail so they don't overlap, but
       conceptually the non-fatal change should be done before the
       potentially fatal change in case the latter results in bones */
    if (was_arti_light && !artifact_light(otmp)) {
        end_burn(otmp, FALSE);
        if (!Blind())
            pline(_("%s shining."), Tobjnam(otmp, _("stop")));
    }
    dragon_armor_handling(otmp, FALSE, TRUE);

    return 0;
}

/* The gone functions differ from the off functions in that if you die from
 * taking it off and have life saving, you still die.  [Obsolete reference
 * to lack of fire resistance being fatal in hell (nethack 3.0) and life
 * saving putting a removed item back on to prevent that from immediately
 * repeating.]
 */
export function Armor_gone() { /* int */
    let otmp = uarm;
    let was_arti_light = (otmp && otmp.lamplit && artifact_light(otmp) ? 1 : 0);

    svc.context.takeoff.mask = and64(svc.context.takeoff.mask, ~W_ARM);
    setnotworn(uarm);
    svc.context.takeoff.cancelled_don = FALSE;

    /* losing yellow dragon scales/mail might be fatal; arti_light
       comes from gold dragon scales/mail so they don't overlap, but
       conceptually the non-fatal change should be done before the
       potentially fatal change in case the latter results in bones */
    if (was_arti_light && !artifact_light(otmp)) {
        end_burn(otmp, FALSE);
        if (!Blind())
            pline(_("%s shining."), Tobjnam(otmp, _("stop")));
    }
    dragon_armor_handling(otmp, FALSE, FALSE);

    return 0;
}

function Amulet_on(amul) { /* void */
    let on_msg_done = FALSE;

    /* make sure amulet isn't wielded/alt-wielded/quivered, before wearing */
    remove_worn_item(amul, FALSE);
    setworn(amul, W_AMUL);

    switch (uamul.otyp) {
    case AMULET_OF_ESP:
    case AMULET_OF_LIFE_SAVING:
    case AMULET_VERSUS_POISON:
    case AMULET_OF_REFLECTION:
    case FAKE_AMULET_OF_YENDOR:
        break;
    case AMULET_OF_MAGICAL_BREATHING: {
        let was_in_poison_gas;

        /* amulet is already on; we need to check hero's gas-cloud status
           when it was off */
        u.uprops[MAGICAL_BREATHING].extrinsic = and64(u.uprops[MAGICAL_BREATHING].extrinsic, ~W_AMUL);
        was_in_poison_gas = region_danger();
        u.uprops[MAGICAL_BREATHING].extrinsic = or64(u.uprops[MAGICAL_BREATHING].extrinsic, W_AMUL);
        if (was_in_poison_gas) {
            makeknown(AMULET_OF_MAGICAL_BREATHING);
            on_msg(uamul);
            on_msg_done = TRUE;
            You(_("are no longer bothered by the poison gas."));
        }
        /* no need to check for becoming able to breathe underwater;
           if we are underwater, we already can or we would have drowned */
        break;
    }
    case AMULET_OF_UNCHANGING:
        if (Slimed())
            make_slimed(0, 0);
        break;
    case AMULET_OF_CHANGE: {
        let call_it = FALSE;
        let new_sex, orig_sex = poly_gender();

        /* in normal play it's not possible to put on an amulet of change
           while already wearing an amulet of unchanging, but in wizard
           mode the Unchanging attribute can be set via #wizintrinsic */
        if (!Unchanging())
            change_sex();

        new_sex = poly_gender();
        if (new_sex != orig_sex)
            makeknown(AMULET_OF_CHANGE);
        on_msg(uamul); /* show 'z - amulet of change (being worn)' */
        on_msg_done = TRUE;

        /* Don't use same message as polymorph */
        if (new_sex != orig_sex) {
            newsym(u.ux, u.uy); /* glyphmon flag and tile have changed */
            disp.botl = TRUE; /* role name or rank title might have changed */
            You(_("are suddenly very %s!"),
                flags.female ? _("feminine") : _("masculine"));
        } else {
            /* already polymorphed into single-gender monster; only
               changed the character's base sex */
            You(_("don't feel like yourself."));
            /* checking dknown is redundant--amulets always have dknown set */
            call_it = +(uamul.dknown != 0);
        }
        livelog_newform(FALSE, orig_sex, new_sex);
        pline_The(_("amulet disintegrates!"));
        if (call_it)
            trycall(uamul);
        useup(uamul);
        break;
    }
    case AMULET_OF_STRANGULATION:
        /* note: might already be Strangled (via #wizintrinsic) */
        if (can_be_strangled(gy.youmonst) && !Strangled()) {
            makeknown(AMULET_OF_STRANGULATION);
            u.uprops[STRANGLED].intrinsic = 6;
            disp.botl = TRUE;
            on_msg(uamul);
            on_msg_done = TRUE;
            pline(_("It constricts your throat!"));
        }
        break;
    case AMULET_OF_RESTFUL_SLEEP: {
        let newnap = rnd(98) + 2, oldnap = (HSleepy() & TIMEOUT);

        if (newnap < oldnap || oldnap == 0)
            /* avoid clobbering FROMOUTSIDE bit, which might have
               gotten set by previously eating one of these amulets */
            u.uprops[SLEEPY].intrinsic = or64(and64(HSleepy(), ~TIMEOUT), newnap);
        break;
    }
    case AMULET_OF_FLYING:
        /* setworn() has already set extrinsic flying */
        float_vs_flight(); /* block flying if levitating */
        if (Flying()) {
            let already_flying;

            /* to determine whether this flight is new we have to muck
               about in the Flying intrinsic (actually extrinsic) */
            u.uprops[FLYING].extrinsic = and64(u.uprops[FLYING].extrinsic, ~W_AMUL);
            already_flying = +!!Flying();
            u.uprops[FLYING].extrinsic = or64(u.uprops[FLYING].extrinsic, W_AMUL);

            if (!already_flying) {
                makeknown(AMULET_OF_FLYING);
                on_msg(uamul);
                on_msg_done = TRUE;
                disp.botl = TRUE; /* status: 'Fly' On */
                You(_("are now in flight."));
            }
        }
        break;
    case AMULET_OF_GUARDING:
        makeknown(AMULET_OF_GUARDING);
        find_ac();
        break;
    case AMULET_OF_YENDOR:
        break;
    }

    if (!on_msg_done)
        on_msg(uamul);
}

export function Amulet_off() { /* void */
    let amul = uamul; /* for off_msg() after setworn(NULL,W_AMUL) */
    let mkn = FALSE, early_off_msg = FALSE;

    svc.context.takeoff.mask = and64(svc.context.takeoff.mask, ~W_AMUL);

    switch (uamul.otyp) {
    case AMULET_OF_ESP:
        /* need to update ability before calling see_monsters() */
        setworn(null, W_AMUL);
        off_msg(amul);
        early_off_msg = TRUE;

        see_monsters();
        break;
    case AMULET_OF_LIFE_SAVING:
    case AMULET_VERSUS_POISON:
    case AMULET_OF_REFLECTION:
    case AMULET_OF_CHANGE:
    case AMULET_OF_UNCHANGING:
    case FAKE_AMULET_OF_YENDOR:
        break;
    case AMULET_OF_MAGICAL_BREATHING:
        /* amulet is currently still on; take it off before calling drown()
           and region_danger(); call off_msg() before specific messages */
        setworn(null, W_AMUL);
        off_msg(amul); /* 'uamul' has been set to Null */
        early_off_msg = TRUE;

        if (Underwater()) {
            if (!cant_drown(gy.youmonst.data) && !Swimming()) {
                You(_("suddenly inhale an unhealthy amount of %s!"),
                    hliquid(_("water")));
                mkn = TRUE; /* in case of life-saving */
                drown();
            }
        }
        if (region_danger()) {
            /* "breathing": wouldn't get here otherwise */
            You(_("are breathing poison gas!"));
            mkn = TRUE;
        }
        break;
    case AMULET_OF_STRANGULATION:
        setworn(null, W_AMUL);
        off_msg(amul);
        early_off_msg = TRUE;

        if (Strangled()) {
            u.uprops[STRANGLED].intrinsic = 0;
            disp.botl = TRUE;
            if (Breathless())
                Your(_("%s is no longer constricted!"), body_part(NECK));
            else
                You(_("can breathe more easily!"));
            mkn = TRUE;
        }
        break;
    case AMULET_OF_RESTFUL_SLEEP:
        setworn(null, W_AMUL);
        /* HSleepy = 0L; -- avoid clobbering FROMOUTSIDE bit */
        if (!ESleepy() && !(HSleepy() & ~TIMEOUT))
            u.uprops[SLEEPY].intrinsic = and64(u.uprops[SLEEPY].intrinsic, ~TIMEOUT); /* clear timeout bits */
        break;
    case AMULET_OF_FLYING: {
        let was_flying = +!!Flying();

        /* remove amulet 'early' to determine whether Flying changes;
           also in case spoteffects() does something with the amulet */
        setworn(null, W_AMUL);
        off_msg(amul);
        early_off_msg = TRUE;

        float_vs_flight(); /* probably not needed here */
        if (was_flying && !Flying()) {
            disp.botl = TRUE; /* status: 'Fly' Off */
            You(_("%s."), (is_pool_or_lava(u.ux, u.uy)
                        || Is_waterlevel(u.uz) || Is_airlevel(u.uz))
                          ? _("stop flying")
                          : _("land"));
            mkn = TRUE; /* makeknown(AMULET_OF_FLYING) */
            spoteffects(TRUE);
        }
        break;
    }
    case AMULET_OF_GUARDING:
        find_ac();
        break;
    case AMULET_OF_YENDOR:
        break;
    }

    setworn(null, W_AMUL);
    if (!early_off_msg)
        off_msg(amul); /* (not 'uamul'; it's Null now) */
    if (mkn)
        makeknown(amul.otyp);
    return;
}

/* handle ring discovery; comparable to learnwand() */
function learnring(ring, observed) { /* void */
    let ringtype = ring.otyp;

    /* if effect was observable then we usually discover the type */
    if (observed) {
        /* if we already know the ring type which accomplishes this
           effect (assumes there is at most one type for each effect),
           mark this ring as having been seen (no need for makeknown);
           otherwise if we have seen this ring, discover its type */
        if (objects[ringtype].oc_name_known)
            observe_object(ring);
        else if (ring.dknown)
            makeknown(ringtype);
    }

    /* make enchantment of charged ring known (might be +0) and update
       perm invent window if we've seen this ring and know its type */
    if (ring.dknown && objects[ringtype].oc_name_known) {
        if (objects[ringtype].oc_charged)
            ring.known = 1;
        update_inventory();
    }
}

function adjust_attrib(obj, which, val) { /* void */
    let old_attrib;
    let observable;

    old_attrib = ACURR(which);
    (chars[u.abon.a + which]) += val;
    observable = +(old_attrib != ACURR(which));
    /* if didn't change, usually means ring is +0 but might
        be because nonzero couldn't go below min or above max;
        learn +0 enchantment if attribute value is not stuck
        at a limit [and ring has been seen and its type is
        already discovered, both handled by learnring()] */
    if (observable || !extremeattr(which))
        learnring(obj, observable);
    disp.botl = TRUE;
}

export function Ring_on(obj) { /* void */
    let oldprop = u.uprops[objects[obj.otyp].oc_oprop].extrinsic;
    let observable;

    /* make sure ring isn't wielded; can't use remove_worn_item()
       here because it has already been set worn in a ring slot */
    if (obj == uwep)
        setuwep(null);
    else if (obj == uswapwep)
        setuswapwep(null);
    else if (obj == uquiver)
        setuqwep(null);

    /* only mask out W_RING when we don't have both
       left and right rings of the same type */
    if ((oldprop & W_RING) != W_RING)
        oldprop = and64(oldprop, ~W_RING);

    switch (obj.otyp) {
    case RIN_TELEPORTATION:
    case RIN_REGENERATION:
    case RIN_SEARCHING:
    case RIN_HUNGER:
    case RIN_AGGRAVATE_MONSTER:
    case RIN_POISON_RESISTANCE:
    case RIN_FIRE_RESISTANCE:
    case RIN_COLD_RESISTANCE:
    case RIN_SHOCK_RESISTANCE:
    case RIN_CONFLICT:
    case RIN_TELEPORT_CONTROL:
    case RIN_POLYMORPH:
    case RIN_POLYMORPH_CONTROL:
    case RIN_FREE_ACTION:
    case RIN_SLOW_DIGESTION:
    case RIN_SUSTAIN_ABILITY:
        break;
    case MEAT_RING:
        /* wearing a meat ring does not affect vegan conduct */
        break;
    case RIN_STEALTH:
        toggle_stealth(obj, oldprop, TRUE);
        break;
    case RIN_WARNING:
        see_monsters();
        break;
    case RIN_SEE_INVISIBLE:
        /* can now see invisible monsters */
        set_mimic_blocking(); /* do special mimic handling */
        see_monsters();

        if (Invis() && !oldprop && !HSee_invisible() && !Blind()) {
            newsym(u.ux, u.uy);
            pline(_("Suddenly you are transparent, but there!"));
            learnring(obj, TRUE);
        }
        break;
    case RIN_INVISIBILITY:
        if (!oldprop && !HInvis() && !BInvis() && !Blind()) {
            learnring(obj, TRUE);
            newsym(u.ux, u.uy);
            self_invis_message();
        }
        break;
    case RIN_LEVITATION:
        if (!oldprop && !HLevitation() && !(BLevitation() & FROMOUTSIDE)) {
            float_up();
            learnring(obj, TRUE);
            if (Levitation())
                spoteffects(FALSE); /* for sinks */
        } else {
            float_vs_flight(); /* maybe toggle (BFlying & I_SPECIAL) */
        }
        break;
    case RIN_GAIN_STRENGTH:
        adjust_attrib(obj, A_STR, obj.spe);
        break;
    case RIN_GAIN_CONSTITUTION:
        adjust_attrib(obj, A_CON, obj.spe);
        break;
    case RIN_ADORNMENT:
        adjust_attrib(obj, A_CHA, obj.spe);
        break;
    case RIN_INCREASE_ACCURACY: /* KMH */
        u.uhitinc += obj.spe;
        break;
    case RIN_INCREASE_DAMAGE:
        u.udaminc += obj.spe;
        break;
    case RIN_PROTECTION_FROM_SHAPE_CHAN:
        rescham();
        break;
    case RIN_PROTECTION:
        /* usually learn enchantment and discover type;
           won't happen if ring is unseen or if it's +0
           and the type hasn't been discovered yet */
        observable = +(obj.spe != 0);
        learnring(obj, observable);
        if (obj.spe)
            find_ac(); /* updates botl */
        break;
    }
}

function Ring_off_or_gone(obj, gone) { /* void */
    let mask = (obj.owornmask & W_RING);
    let observable;

    svc.context.takeoff.mask = and64(svc.context.takeoff.mask, not64(mask));
    if (!(u.uprops[objects[obj.otyp].oc_oprop].extrinsic & mask))
        impossible(_("Strange... I didn't know you had that ring."));
    if (gone)
        setnotworn(obj);
    else
        setworn(null, obj.owornmask);

    switch (obj.otyp) {
    case RIN_TELEPORTATION:
    case RIN_REGENERATION:
    case RIN_SEARCHING:
    case RIN_HUNGER:
    case RIN_AGGRAVATE_MONSTER:
    case RIN_POISON_RESISTANCE:
    case RIN_FIRE_RESISTANCE:
    case RIN_COLD_RESISTANCE:
    case RIN_SHOCK_RESISTANCE:
    case RIN_CONFLICT:
    case RIN_TELEPORT_CONTROL:
    case RIN_POLYMORPH:
    case RIN_POLYMORPH_CONTROL:
    case RIN_FREE_ACTION:
    case RIN_SLOW_DIGESTION:
    case RIN_SUSTAIN_ABILITY:
    case MEAT_RING:
        break;
    case RIN_STEALTH:
        toggle_stealth(obj, and64(EStealth(), not64(mask)), FALSE);
        break;
    case RIN_WARNING:
        see_monsters();
        break;
    case RIN_SEE_INVISIBLE:
        /* Make invisible monsters go away */
        if (!See_invisible()) {
            set_mimic_blocking(); /* do special mimic handling */
            see_monsters();
        }

        if (Invisible() && !Blind()) {
            newsym(u.ux, u.uy);
            pline(_("Suddenly you cannot see yourself."));
            learnring(obj, TRUE);
        }
        break;
    case RIN_INVISIBILITY:
        if (!Invis() && !BInvis() && !Blind()) {
            newsym(u.ux, u.uy);
            Your(_("body seems to unfade%s."),
                 See_invisible() ? _(" completely") : _(".."));
            learnring(obj, TRUE);
        }
        break;
    case RIN_LEVITATION:
        if (!(BLevitation() & FROMOUTSIDE)) {
            float_down(0, 0);
            if (!Levitation())
                learnring(obj, TRUE);
        } else {
            float_vs_flight(); /* maybe toggle (BFlying & I_SPECIAL) */
        }
        break;
    case RIN_GAIN_STRENGTH:
        adjust_attrib(obj, A_STR, -obj.spe);
        break;
    case RIN_GAIN_CONSTITUTION:
        adjust_attrib(obj, A_CON, -obj.spe);
        break;
    case RIN_ADORNMENT:
        adjust_attrib(obj, A_CHA, -obj.spe);
        break;
    case RIN_INCREASE_ACCURACY: /* KMH */
        u.uhitinc -= obj.spe;
        break;
    case RIN_INCREASE_DAMAGE:
        u.udaminc -= obj.spe;
        break;
    case RIN_PROTECTION:
        /* might have been put on while blind and we can now see
           or perhaps been forgotten due to amnesia */
        observable = +(obj.spe != 0);
        learnring(obj, observable);
        if (obj.spe)
            find_ac(); /* updates botl */
        break;
    case RIN_PROTECTION_FROM_SHAPE_CHAN:
        /* if you're no longer protected, let the chameleons change
           shape again; however, might still be protected if wearing
           2nd ring of this type (or via #wizintrinsic) */
        if (!Protection_from_shape_changers())
            restartcham();
        break;
    }
}

export function Ring_off(obj) { /* void */
    Ring_off_or_gone(obj, FALSE);
}

export function Ring_gone(obj) { /* void */
    Ring_off_or_gone(obj, TRUE);
}

export function Blindf_on(otmp) { /* void */
    let already_blind = Blind(), changed = FALSE;

    /* blindfold might be wielded; release it for wearing */
    remove_worn_item(otmp, FALSE);
    setworn(otmp, W_TOOL);
    on_msg(otmp);

    if (Blind() && !already_blind) {
        changed = TRUE;
        if (flags.verbose)
            You_cant(_("see any more."));
        /* set ball&chain variables before the hero goes blind */
        if (Punished())
            set_bc(0);
    } else if (already_blind && !Blind()) {
        changed = TRUE;
        /* "You are now wearing the Eyes of the Overworld." */
        if (u.uroleplay.blind) {
            /* this can only happen by putting on the Eyes of the Overworld;
               that shouldn't actually produce a permanent cure, but we
               can't let the "blind from birth" conduct remain intact */
            pline(_("For the first time in your life, you can see!"));
            u.uroleplay.blind = FALSE;
        } else
            You(_("can see!"));
    }
    if (changed) {
        toggle_blindness(); /* potion.c */
    }
}

export function Blindf_off(otmp) { /* void */
    let was_blind = Blind(), changed = FALSE,
            nooffmsg = +!otmp;

    if (!otmp)
        otmp = ublindf;
    if (!otmp) {
        impossible(_("Blindf_off without eyewear?"));
        return;
    }
    svc.context.takeoff.mask = and64(svc.context.takeoff.mask, ~W_TOOL);
    setworn(null, otmp.owornmask);
    if (!nooffmsg)
        off_msg(otmp);

    if (Blind()) {
        if (was_blind) {
            /* "still cannot see" makes no sense when removing lenses
               since they can't have been the cause of your blindness */
            if (otmp.otyp != LENSES)
                You(_("still cannot see."));
        } else {
            changed = TRUE; /* !was_blind */
            /* "You were wearing the Eyes of the Overworld." */
            You_cant(_("see anything now!"));
            /* set ball&chain variables before the hero goes blind */
            if (Punished())
                set_bc(0);
        }
    } else if (was_blind) {
        if (!gulp_blnd_check()) {
            changed = TRUE; /* !Blind */
            You(_("can see again."));
        }
    }
    if (changed) {
        toggle_blindness(); /* potion.c */
    }
}

/* called in moveloop()'s prologue to set side-effects of worn start-up items;
   also used by poly_obj() when a worn item gets transformed */
export function set_wear(
    obj) { /* void */ /* if Null, do all worn items; otherwise just obj */
    gi.initial_don = +!obj;

    if (!obj ? ublindf != null : (obj == ublindf))
        Blindf_on(ublindf);
    if (!obj ? uright != null : (obj == uright))
        Ring_on(uright);
    if (!obj ? uleft != null : (obj == uleft))
        Ring_on(uleft);
    if (!obj ? uamul != null : (obj == uamul))
        Amulet_on(uamul);

    if (!obj ? uarmu != null : (obj == uarmu))
        Shirt_on();
    if (!obj ? uarm != null : (obj == uarm))
        Armor_on();
    if (!obj ? uarmc != null : (obj == uarmc))
        Cloak_on();
    if (!obj ? uarmf != null : (obj == uarmf))
        Boots_on();
    if (!obj ? uarmg != null : (obj == uarmg))
        Gloves_on();
    if (!obj ? uarmh != null : (obj == uarmh))
        Helmet_on();
    if (!obj ? uarms != null : (obj == uarms))
        Shield_on();

    gi.initial_don = FALSE;
}

/* check whether the target object is currently being put on (or taken off--
   also checks for doffing--[why?]) */
export function donning(otmp) { /* boolean */
    let result = FALSE;

    /* 'W' (or 'P' used for armor) sets ga.afternmv */
    if (doffing(otmp))
        result = TRUE;
    else if (otmp == uarm)
        result = +(ga.afternmv == Armor_on);
    else if (otmp == uarmu)
        result = +(ga.afternmv == Shirt_on);
    else if (otmp == uarmc)
        result = +(ga.afternmv == Cloak_on);
    else if (otmp == uarmf)
        result = +(ga.afternmv == Boots_on);
    else if (otmp == uarmh)
        result = +(ga.afternmv == Helmet_on);
    else if (otmp == uarmg)
        result = +(ga.afternmv == Gloves_on);
    else if (otmp == uarms)
        result = +(ga.afternmv == Shield_on);

    return result;
}

/* check whether the target object is currently being taken off,
   so that stop_donning() and steal() can vary messages and doname()
   can vary "(being worn)" suffix */
export function doffing(otmp) { /* boolean */
    let what = svc.context.takeoff.what;
    let result = FALSE;

    /* 'T' (or 'R' used for armor) sets ga.afternmv, 'A' sets takeoff.what */
    if (otmp == uarm)
        result = +(ga.afternmv == Armor_off || what == WORN_ARMOR);
    else if (otmp == uarmu)
        result = +(ga.afternmv == Shirt_off || what == WORN_SHIRT);
    else if (otmp == uarmc)
        result = +(ga.afternmv == Cloak_off || what == WORN_CLOAK);
    else if (otmp == uarmf)
        result = +(ga.afternmv == Boots_off || what == WORN_BOOTS);
    else if (otmp == uarmh)
        result = +(ga.afternmv == Helmet_off || what == WORN_HELMET);
    else if (otmp == uarmg)
        result = +(ga.afternmv == Gloves_off || what == WORN_GLOVES);
    else if (otmp == uarms)
        result = +(ga.afternmv == Shield_off || what == WORN_SHIELD);
    /* these 1-turn items don't need 'ga.afternmv' checks */
    else if (otmp == uamul)
        result = +(what == WORN_AMUL);
    else if (otmp == uleft)
        result = +(what == LEFT_RING);
    else if (otmp == uright)
        result = +(what == RIGHT_RING);
    else if (otmp == ublindf)
        result = +(what == WORN_BLINDF);
    else if (otmp == uwep)
        result = +(what == W_WEP);
    else if (otmp == uswapwep)
        result = +(what == W_SWAPWEP);
    else if (otmp == uquiver)
        result = +(what == W_QUIVER);

    return result;
}

/* despite their names, cancel_don() and cancel_doff() both apply to both
   donning and doffing... */
export function cancel_doff(obj, slotmask) { /* void */
    /* Called by setworn() for old item in specified slot or by setnotworn()
     * for specified item.  We don't want to call cancel_don() if we got
     * here via <X>_off() -> setworn((struct obj *) 0) -> cancel_doff()
     * because that would stop the 'A' command from continuing with next
     * selected item.  So do_takeoff() sets a flag in takeoff.mask for us.
     * [For taking off an individual item with 'T'/'R'/'w-', it doesn't
     * matter whether cancel_don() gets called here--the item has already
     * been removed by now.]
     */
    if (!(svc.context.takeoff.mask & I_SPECIAL) && donning(obj))
        cancel_don(); /* applies to doffing too */
    svc.context.takeoff.mask = and64(svc.context.takeoff.mask, not64(slotmask));
}

/* despite their names, cancel_don() and cancel_doff() both apply to both
   donning and doffing... */
export function cancel_don() { /* void */
    /* the piece of armor we were donning/doffing has vanished, so stop
     * wasting time on it (and don't dereference it when donning would
     * otherwise finish); afternmv never has some of these values because
     * every item of the corresponding armor category takes 1 turn to wear,
     * but check all of them anyway
     */
    svc.context.takeoff.cancelled_don = +(ga.afternmv == Cloak_on
                                        || ga.afternmv == Armor_on
                                        || ga.afternmv == Shirt_on
                                        || ga.afternmv == Helmet_on
                                        || ga.afternmv == Gloves_on
                                        || ga.afternmv == Boots_on
                                        || ga.afternmv == Shield_on);
    ga.afternmv = null;
    gn.nomovemsg = 0;
    gm.multi = 0;
    svc.context.takeoff.delay = 0;
    svc.context.takeoff.what = 0;
}

/* called by steal() during theft from hero; interrupt donning/doffing */
export function stop_donning(
    stolenobj) { /* int */ /* no mesg if stolenobj is already being doffed */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);
    let otmp;
    let putting_on;
    let result = 0;

    for (otmp = gi.invent; otmp; otmp = otmp.nobj)
        if ((otmp.owornmask & W_ARMOR) && donning(otmp))
            break;
    /* at most one item will pass donning() test at any given time */
    if (!otmp)
        return 0;

    /* donning() returns True when doffing too; doffing() is more specific */
    putting_on = +!doffing(otmp);
    /* cancel_don() looks at afternmv; it can also cancel doffing */
    cancel_don();
    /* don't want <armor>_on() or <armor>_off() being called
       by unmul() since the on or off action isn't completing */
    ga.afternmv = null;
    if (putting_on || otmp != stolenobj) {
        sprintf(buf, _("You stop %s %s."), putting_on ? _("putting on") : _("taking off"), thesimpleoname(otmp))

;
    } else {
        chars[buf + 0] = ord('\0');   /* silently stop doffing stolenobj */
        result = int((-gm.multi)); /* remember this before calling unmul() */
    }
    unmul(buf);
    /* while putting on, item becomes worn immediately but side-effects are
       deferred until the delay expires; when interrupted, make it unworn
       (while taking off, item stays worn until the delay expires; when
       interrupted, leave it worn) */
    if (putting_on)
        remove_worn_item(otmp, FALSE);

    return result;
    } finally { stack_pop($frame); }
}

const Narmorpieces = static_var("Narmorpieces", int); const Naccessories = static_var("Naccessories", int);

/* assign values to Narmorpieces and Naccessories */
function count_worn_stuff(
    which,
    accessorizing) { /* void */
    let otmp;

    Narmorpieces[0] = Naccessories[0] = 0;

    otmp = null;
    do { if (uarmh) { Narmorpieces[0]++; otmp = uarmh; } } while (0);
    do { if (uarms) { Narmorpieces[0]++; otmp = uarms; } } while (0);
    do { if (uarmg) { Narmorpieces[0]++; otmp = uarmg; } } while (0);
    do { if (uarmf) { Narmorpieces[0]++; otmp = uarmf; } } while (0);
    /* for cloak/suit/shirt, we only count the outermost item so that it
       can be taken off without confirmation if final count ends up as 1 */
    if (uarmc)
        do { if (uarmc) { Narmorpieces[0]++; otmp = uarmc; } } while (0);
    else if (uarm)
        do { if (uarm) { Narmorpieces[0]++; otmp = uarm; } } while (0);
    else if (uarmu)
        do { if (uarmu) { Narmorpieces[0]++; otmp = uarmu; } } while (0);
    if (!accessorizing)
        which[0] = otmp; /* default item iff Narmorpieces is 1 */

    otmp = null;
    do { if (uleft) { Naccessories[0]++; otmp = uleft; } } while (0);
    do { if (uright) { Naccessories[0]++; otmp = uright; } } while (0);
    do { if (uamul) { Naccessories[0]++; otmp = uamul; } } while (0);
    do { if (ublindf) { Naccessories[0]++; otmp = ublindf; } } while (0);
    if (accessorizing)
        which[0] = otmp; /* default item iff Naccessories is 1 */
}

/* take off one piece or armor or one accessory;
   shared by dotakeoff('T') and doremring('R') */
function armor_or_accessory_off(obj) { /* int */
    const $frame = stack_frame(); try {
    if (!(obj.owornmask & (W_ARMOR | W_ACCESSORY))) {
        You(_("are not wearing that."));
        return ECMD_OK;
    }
    if (obj == uskin
        || ((obj == uarm) && uarmc)
        || ((obj == uarmu) && (uarmc || uarm))) {
        let why = stack_array(char, QBUFSZ), what = stack_array(char, QBUFSZ);

        chars[why + 0] = chars[what + 0] = ord('\0');
        if (obj != uskin) {
            if (uarmc)
                strcat(what, cloak_simple_name(uarmc));
            if ((obj == uarmu) && uarm) {
                if (uarmc)
                    strcat(what, _(" and "));
                strcat(what, suit_simple_name(uarm));
            }
            Snprintf(why, sizeof(array_of(char, QBUFSZ)), _(" without taking off your %s first"), what)
;
        } else {
            strcpy(why, _("; it's embedded"));
        }
        You_cant(_("take that off%s."), why);
        return ECMD_OK;
    }

    reset_remarm(); /* clear context.takeoff.mask and context.takeoff.what */
    select_off(obj);
    if (!svc.context.takeoff.mask)
        return ECMD_OK;
    /* none of armoroff()/Ring_/Amulet/Blindf_off() use context.takeoff.mask */
    reset_remarm();

    if (obj.owornmask & W_ARMOR) {
        armoroff(obj);
    } else if (obj == uright || obj == uleft) {
        /* Sometimes we want to give the off_msg before removing and
         * sometimes after; for instance, "you were wearing a moonstone
         * ring (on right hand)" is desired but "you were wearing a
         * square amulet (being worn)" is not because of the redundant
         * "being worn".
         */
        off_msg(obj);
        Ring_off(obj);
    } else if (obj == uamul) {
        Amulet_off(); /* does its own off_msg */
    } else if (obj == ublindf) {
        Blindf_off(obj); /* does its own off_msg */
    } else {
        impossible(_("removing strange accessory: %s"),
                   safe_typename(obj.otyp));
        if (obj.owornmask)
            remove_worn_item(obj, FALSE);
    }
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

/* the #takeoff command - remove worn armor */
export function dotakeoff() { /* int */
    const $frame = stack_frame(); try {
    let otmp = stack_var(ptr_to(struct_obj), null);

    count_worn_stuff(otmp, FALSE);
    if (!Narmorpieces[0] && !Naccessories[0]) {
        /* assert( GRAY_DRAGON_SCALES > YELLOW_DRAGON_SCALE_MAIL ); */
        if (uskin)
            pline_The(_("%s merged with your skin!"),
                      uskin.otyp >= GRAY_DRAGON_SCALES
                          ? _("dragon scales are")
                          : _("dragon scale mail is"));
        else
            pline(_("Not wearing any armor or accessories."));
        return ECMD_OK;
    }
    if (Narmorpieces[0] != 1 || ParanoidRemove() || gi.item_action_in_progress)
        otmp[0] = getobj(_("take off"), takeoff_ok, GETOBJ_NOFLAGS);
    if (!otmp[0])
        return ECMD_CANCEL;

    return armor_or_accessory_off(otmp[0]);
    } finally { stack_pop($frame); }
}

/* 'i' or 'I[' followed by <invlet> and then 'T';
   plain dotakeoff() would not give any feedback when picking suit
   covered by cloak, or shirt covered by suit and/or cloak, due to the
   default behavior of equip_ok() (skipping inaccessible items) */
export function ia_dotakeoff() { /* int */
    let res;

    gi.item_action_in_progress = TRUE;
    res = dotakeoff();
    gi.item_action_in_progress = FALSE;
    return res;
}

/* the #remove command - take off ring or other accessory */
export function doremring() { /* int */
    const $frame = stack_frame(); try {
    let otmp = stack_var(ptr_to(struct_obj), null);

    count_worn_stuff(otmp, TRUE);
    if (!Naccessories[0] && !Narmorpieces[0]) {
        pline(_("Not wearing any accessories or armor."));
        return ECMD_OK;
    }
    if (Naccessories[0] != 1 || ParanoidRemove() || cmdq_peek(CQ_CANNED))
        otmp[0] = getobj(_("remove"), remove_ok, GETOBJ_NOFLAGS);
    if (!otmp[0])
        return ECMD_CANCEL;

    return armor_or_accessory_off(otmp[0]);
    } finally { stack_pop($frame); }
}

/* Check if something worn is cursed _and_ unremovable. */
export function cursed(otmp) { /* int */
    if (!otmp) {
        impossible(_("cursed without otmp"));
        return 0;
    }
    /* Curses, like chickens, come home to roost. */
    if ((otmp == uwep) ? welded(otmp) : otmp.cursed) {
        let use_plural = +(is_boots(otmp) || is_gloves(otmp)
                              || otmp.otyp == LENSES || otmp.quan > 1);

        /* might be trying again after applying grease to hands */
        if (Glib() && otmp.bknown
            /* for weapon, we'll only get here via 'A )' */
            && (uarmg ? (otmp == uwep)
                      : ((otmp.owornmask & (W_WEP | W_RING)) != 0)))
            pline(_("Despite your slippery %s, you can't."),
                  fingers_or_gloves(TRUE));
        else
            You(_("can't.  %s cursed."), use_plural ? _("They are") : _("It is"));
        set_bknown(otmp, 1);
        return 1;
    }
    return 0;
}

export function armoroff(otmp) { /* int */
    let offdelaybuf = static_array("armoroff.offdelaybuf", char, 60);
    let delay = -objects[otmp.otyp].oc_delay;
    let what = 0;

    if (cursed(otmp))
        return 0;
    /* this used to make assumptions about which types of armor had
       delays and which didn't; now both are handled for all types */
    if (delay) {
        nomul(delay);
        gm.multi_reason = _("disrobing");
        switch (objects[otmp.otyp].oc_subtyp) {
        case ARM_SUIT:
            what = suit_simple_name(otmp);
            ga.afternmv = Armor_off;
            break;
        case ARM_SHIELD:
            what = shield_simple_name(otmp);
            ga.afternmv = Shield_off;
            break;
        case ARM_HELM:
            what = helm_simple_name(otmp);
            ga.afternmv = Helmet_off;
            break;
        case ARM_GLOVES:
            what = gloves_simple_name(otmp);
            ga.afternmv = Gloves_off;
            break;
        case ARM_BOOTS:
            what = boots_simple_name(otmp);
            ga.afternmv = Boots_off;
            break;
        case ARM_CLOAK:
            what = cloak_simple_name(otmp);
            ga.afternmv = Cloak_off;
            break;
        case ARM_SHIRT:
            what = shirt_simple_name(otmp);
            ga.afternmv = Shirt_off;
            break;
        default:
            impossible(_("Taking off unknown armor (%d: %d), delay %d"),
                       otmp.otyp, objects[otmp.otyp].oc_subtyp, delay);
            break;
        }
        if (what) {
            /* sizeof offdelaybuf == 60; increase it if this becomes longer */
            Snprintf(offdelaybuf, sizeof(array_of(char, 60)), _("You finish taking off your %s."), what)
;
            gn.nomovemsg = offdelaybuf;
        }
    } else {
        /* no delay so no '(*afternmv)()' or 'nomovemsg' */
        switch (objects[otmp.otyp].oc_subtyp) {
        case ARM_SUIT:
            Armor_off();
            break;
        case ARM_SHIELD:
            Shield_off();
            break;
        case ARM_HELM:
            Helmet_off();
            break;
        case ARM_GLOVES:
            Gloves_off();
            break;
        case ARM_BOOTS:
            Boots_off();
            break;
        case ARM_CLOAK:
            Cloak_off();
            break;
        case ARM_SHIRT:
            Shirt_off();
            break;
        default:
            impossible(_("Taking off unknown armor (%d: %d), no delay"),
                       otmp.otyp, objects[otmp.otyp].oc_subtyp);
            break;
        }
        /* We want off_msg() after removing the item to
           avoid "You were wearing ____ (being worn)." */
        off_msg(otmp);
    }
    svc.context.takeoff.mask = svc.context.takeoff.what = 0;
    return 1;
}

function already_wearing(cc) { /* void */
    You(_("are already wearing %s%c"), cc, (cc == c_that_) ? ord('!') : ord('.'));
}

function already_wearing2(cc1, cc2) { /* void */
    You_cant(_("wear %s because you're wearing %s there already."), cc1, cc2);
}

/*
 * canwearobj checks to see whether the player can wear a piece of armor
 *
 * inputs: otmp (the piece of armor)
 *         noisy (if TRUE give error messages, otherwise be quiet about it)
 * output: mask (otmp's armor type)
 */
export function canwearobj(otmp, mask, noisy) { /* int */
    let err = 0;
    let which;

    /* this is the same check as for 'W' (dowear), but different message,
       in case we get here via 'P' (doputon) */
    if (verysmall(gy.youmonst.data) || nohands(gy.youmonst.data)) {
        if (noisy)
            You(_("can't wear any armor in your current form."));
        return 0;
    }

    which = is_cloak(otmp) ? c_cloak
            : is_shirt(otmp) ? c_shirt
              : is_suit(otmp) ? c_suit
                : 0;
    if (which && cantweararm(gy.youmonst.data)
        /* same exception for cloaks as used in m_dowear() */
        && (which != c_cloak
            || ((otmp.otyp != MUMMY_WRAPPING)
                ? gy.youmonst.data.msize != MZ_SMALL
                : !WrappingAllowed(gy.youmonst.data)))
        && (racial_exception(gy.youmonst, otmp) < 1)) {
        if (noisy)
            pline_The(_("%s will not fit on your body."), which);
        return 0;
    } else if (otmp.owornmask & W_ARMOR) {
        if (noisy)
            already_wearing(c_that_);
        return 0;
    }

    if (welded(uwep) && bimanual(uwep) && (is_suit(otmp) || is_shirt(otmp))) {
        if (noisy)
            You(_("cannot do that while holding your %s."),
                is_sword(uwep) ? c_sword : c_weapon);
        return 0;
    }

    if (is_helmet(otmp)) {
        if (uarmh) {
            if (noisy)
                already_wearing(an(helm_simple_name(uarmh)));
            err++;
        } else if (Upolyd() && has_horns(gy.youmonst.data) && !is_flimsy(otmp)) {
            /* (flimsy exception matches polyself handling) */
            if (noisy)
                pline_The(_("%s won't fit over your horn%s."),
                          helm_simple_name(otmp),
                          plur(num_horns(gy.youmonst.data)));
            err++;
        } else
            mask[0] = W_ARMH;
    } else if (is_shield(otmp)) {
        if (uarms) {
            if (noisy)
                already_wearing(an(c_shield));
            err++;
        } else if (uwep && bimanual(uwep)) {
            if (noisy)
                You(_("cannot wear a shield while wielding a two-handed %s."),
                    is_sword(uwep) ? c_sword : (uwep.otyp == BATTLE_AXE)
                                                   ? c_axe
                                                   : c_weapon);
            err++;
        } else if (u.twoweap) {
            if (noisy)
                You(_("cannot wear a shield while wielding two weapons."));
            err++;
        } else
            mask[0] = W_ARMS;
    } else if (is_boots(otmp)) {
        if (uarmf) {
            if (noisy)
                already_wearing(c_boots);
            err++;
        } else if (Upolyd() && slithy(gy.youmonst.data)) {
            if (noisy)
                You(_("have no feet...")); /* not body_part(FOOT) */
            err++;
        } else if (Upolyd() && gy.youmonst.data.mlet == S_CENTAUR) {
            /* break_armor() pushes boots off for centaurs, so don't let
               dowear() put them back on;
               makeplural(body_part(FOOT)) would yield "rear hooves" here,
               which sounds odd, so use hard-coded "hooves" */
            if (noisy)
                You(_("have too many hooves to wear %s."), c_boots);
            err++;
        } else if (u.utrap
                   && (u.utraptype == TT_BEARTRAP || u.utraptype == TT_INFLOOR
                       || u.utraptype == TT_LAVA
                       || u.utraptype == TT_BURIEDBALL)) {
            if (u.utraptype == TT_BEARTRAP) {
                if (noisy)
                    Your(_("%s is trapped!"), body_part(FOOT));
            } else if (u.utraptype == TT_INFLOOR || u.utraptype == TT_LAVA) {
                if (noisy)
                    Your(_("%s are stuck in the %s!"),
                         makeplural(body_part(FOOT)), surface(u.ux, u.uy));
            } else { /*TT_BURIEDBALL*/
                if (noisy)
                    Your(_("%s is attached to the buried ball!"),
                         body_part(LEG));
            }
            err++;
        } else
            mask[0] = W_ARMF;
    } else if (is_gloves(otmp)) {
        if (uarmg) {
            if (noisy)
                already_wearing(c_gloves);
            err++;
        } else if (welded(uwep)) {
            if (noisy)
                You(_("cannot wear gloves over your %s."),
                    is_sword(uwep) ? c_sword : c_weapon);
            err++;
        } else if (Glib()) {
            /* prevent slippery bare fingers from transferring to
               gloved fingers */
            if (noisy)
                Your(_("%s are too slippery to pull on %s."),
                     fingers_or_gloves(FALSE), gloves_simple_name(otmp));
            err++;
        } else
            mask[0] = W_ARMG;
    } else if (is_shirt(otmp)) {
        if (uarm || uarmc || uarmu) {
            if (uarmu) {
                if (noisy)
                    already_wearing(an(c_shirt));
            } else {
                if (noisy)
                    You_cant(_("wear that over your %s."),
                             (uarm && !uarmc) ? c_armor
                                              : cloak_simple_name(uarmc));
            }
            err++;
        } else
            mask[0] = W_ARMU;
    } else if (is_cloak(otmp)) {
        if (uarmc) {
            if (noisy)
                already_wearing(an(cloak_simple_name(uarmc)));
            err++;
        } else
            mask[0] = W_ARMC;
    } else if (is_suit(otmp)) {
        if (uarmc) {
            if (noisy)
                You(_("cannot wear armor over a %s."), cloak_simple_name(uarmc));
            err++;
        } else if (uarm) {
            if (noisy)
                already_wearing(_("some armor"));
            err++;
        } else
            mask[0] = W_ARM;
    } else {
        /* getobj can't do this after setting its allow_all flag; that
           happens if you have armor for slots that are covered up or
           extra armor for slots that are filled */
        if (noisy)
            silly_thing(_("wear"), otmp);
        err++;
    }
    /* Unnecessary since now only weapons and special items like pick-axes get
     * welded to your hand, not armor
        if (welded(otmp)) {
            if (!err++) {
                if (noisy) weldmsg(otmp);
            }
        }
     */
    return +!err;
}

function accessory_or_armor_on(obj$) { /* int */
    const $frame = stack_frame(); try {
    const obj = stack_var(ptr_to(struct_obj), obj$);
    let mask = stack_var(long, 0);
    let armor, ring, amulet, eyewear;

    if (obj[0].owornmask & (W_ACCESSORY | W_ARMOR)) {
        already_wearing(c_that_);
        return ECMD_OK;
    }
    armor = +(obj[0].oclass == ARMOR_CLASS);
    ring = +(obj[0].oclass == RING_CLASS || obj[0].otyp == MEAT_RING);
    amulet = +(obj[0].oclass == AMULET_CLASS);
    eyewear = +(obj[0].otyp == BLINDFOLD || obj[0].otyp == TOWEL
               || obj[0].otyp == LENSES);
    /* checks which are performed prior to actually touching the item */
    if (armor) {
        if (!canwearobj(obj[0], mask, TRUE))
            return ECMD_OK;

        if (obj[0].otyp == HELM_OF_OPPOSITE_ALIGNMENT
            && qstart_level().dnum == u.uz.dnum) { /* in quest */
            if (chars[u.ualignbase + A_CURRENT] == chars[u.ualignbase + A_ORIGINAL])
                You(_("narrowly avoid losing all chance at your goal."));
            else /* converted */
                You(_("are suddenly overcome with shame and change your mind."));
            u.ublessed = 0; /* lose your god's protection */
            makeknown(obj[0].otyp);
            disp.botl = TRUE; /* for AC after zeroing u.ublessed */
            return ECMD_TIME;
        }
    } else {
        /*
         * FIXME:
         *  except for the rings/nolimbs case, this allows you to put on
         *  accessories without having any hands to manipulate them, and
         *  to put them on when poly'd into a tiny or huge form where
         *  they shouldn't fit.  [If the latter situation changes, make
         *  comparable change to break_armor(polyself.c).]
         */

        /* accessory */
        if (ring) {
            let answer, qbuf = stack_array(char, QBUFSZ);
            let res = 0;

            if (nolimbs(gy.youmonst.data)) {
                You(_("cannot make the ring stick to your body."));
                return ECMD_OK;
            }
            if (uleft && uright) {
                There(_("are no more %s%s to fill."),
                      humanoid(gy.youmonst.data) ? _("ring-") : _(""),
                      fingers_or_gloves(FALSE));
                return ECMD_OK;
            }
            if (uleft) {
                mask[0] = RIGHT_RING;
            } else if (uright) {
                mask[0] = LEFT_RING;
            } else {
                do {
                    sprintf(qbuf, _("Which %s%s, Right or Left?"), humanoid(gy.youmonst.data) ? _("ring-") : _(""), body_part(FINGER))

;
                    answer = yn_function(qbuf, rightleftchars, ord('\0'), TRUE);
                    switch (answer) {
                    case ord('\0'):
                    case ord('\x1b'):
                        return ECMD_OK;
                    case ord('l'):
                    case ord('L'):
                        mask[0] = LEFT_RING;
                        break;
                    case ord('r'):
                    case ord('R'):
                        mask[0] = RIGHT_RING;
                        break;
                    }
                } while (!mask[0]);
            }
            if (uarmg && Glib()) {
                Your(
              _("%s are too slippery to remove, so you cannot put on the ring."),
                     gloves_simple_name(uarmg));
                return ECMD_TIME; /* always uses move */
            }
            if (uarmg && uarmg.cursed) {
                res = +!uarmg.bknown;
                set_bknown(uarmg, 1);
                You(_("cannot remove your %s to put on the ring."), c_gloves);
                /* uses move iff we learned gloves are cursed */
                return res ? ECMD_TIME : ECMD_OK;
            }
            if (uwep) {
                res = +!uwep.bknown; /* check this before calling welded() */
                if (((mask[0] == RIGHT_RING && URIGHTY())
                     || (mask[0] == LEFT_RING  && ULEFTY())
                     || bimanual(uwep)) && welded(uwep)) {
                    let hand = body_part(HAND);

                    /* welded will set bknown */
                    if (bimanual(uwep))
                        hand = makeplural(hand);
                    You(_("cannot free your weapon %s to put on the ring."),
                        hand);
                    /* uses move iff we learned weapon is cursed */
                    return res ? ECMD_TIME : ECMD_OK;
                }
            }
        } else if (amulet) {
            if (uamul) {
                already_wearing(_("an amulet"));
                return ECMD_OK;
            }
        } else if (eyewear) {
            if (!has_head(gy.youmonst.data)) {
                You(_("have no head to wear %s on."), ansimpleoname(obj[0]));
                return ECMD_OK;
            }

            if (ublindf) {
                if (ublindf.otyp == TOWEL)
                    Your(_("%s is already covered by a towel."),
                         body_part(FACE));
                else if (ublindf.otyp == BLINDFOLD) {
                    if (obj[0].otyp == LENSES)
                        already_wearing2(_("lenses"), _("a blindfold"));
                    else
                        already_wearing(_("a blindfold"));
                } else if (ublindf.otyp == LENSES) {
                    if (obj[0].otyp == BLINDFOLD)
                        already_wearing2(_("a blindfold"), _("some lenses"));
                    else
                        already_wearing(_("some lenses"));
                } else {
                    already_wearing(something()); /* ??? */
                }
                return ECMD_OK;
            }
        } else {
            /* neither armor nor accessory */
            You_cant(_("wear that!"));
            return ECMD_OK;
        }
    }

    if (!retouch_object(obj, FALSE))
        return ECMD_TIME; /* costs a turn even though it didn't get worn */

    if (armor) {
        let delay;

        /* if the armor is wielded, release it for wearing (won't be
           welded even if cursed; that only happens for weapons/weptools) */
        if (obj[0].owornmask & W_WEAPONS)
            remove_worn_item(obj[0], FALSE);
        /*
         * Setting obj->known=1 is done because setworn() causes hero's AC
         * to change so armor's +/- value is evident via the status line.
         * We used to set it here because of that, but then it would stick
         * if a nymph stole the armor before it was fully worn.  Delay it
         * until the afternmv action.  The player may still know this armor's
         * +/- amount if donning gets interrupted, but the hero won't.
         *
        obj->known = 1;
         */
        gw.wasinwater = u.uinwater; /* for WWALKING; Boots_on() is too late */
        setworn(obj[0], mask[0]);
        /* if there's no delay, we'll execute 'afternmv' immediately */
        if (obj[0] == uarm)
            ga.afternmv = Armor_on;
        else if (obj[0] == uarmh)
            ga.afternmv = Helmet_on;
        else if (obj[0] == uarmg)
            ga.afternmv = Gloves_on;
        else if (obj[0] == uarmf)
            ga.afternmv = Boots_on;
        else if (obj[0] == uarms)
            ga.afternmv = Shield_on;
        else if (obj[0] == uarmc)
            ga.afternmv = Cloak_on;
        else if (obj[0] == uarmu)
            ga.afternmv = Shirt_on;
        else
            panic(_("wearing armor not worn as armor? [%08llx]"), obj[0].owornmask);

        delay = -objects[obj[0].otyp].oc_delay;
        if (delay) {
            nomul(delay);
            gm.multi_reason = _("dressing up");
            gn.nomovemsg = _("You finish your dressing maneuver.");
        } else {
            unmul(_("")); /* call afternmv, clear it+nomovemsg+multi_reason */
            on_msg(obj[0]);
        }
        svc.context.takeoff.mask = svc.context.takeoff.what = 0;
        /* gw.wasinwater = 0U; // can't clear this yet; Boots_on() needs it
         * and gets called via afternmv() after this routine has returned */
    } else { /* not armor */
        if (ring) {
            /* Ring_on() expects ring to already be worn as uleft or uright */
            setworn(obj[0], mask[0]);
            Ring_on(obj[0]);
            /* is_worn(): 'obj' will always be worn here except when putting
               on a ring of levitation while at a sink location */
            if (is_worn(obj[0]))
                on_msg(obj[0]);
        } else if (amulet) {
            /* setworn() and on_msg() handled by Amulet_on() */
            Amulet_on(obj[0]);
        } else if (eyewear) {
            /* setworn() and on_msg() handled by Blindf_on() */
            Blindf_on(obj[0]);
        } else {
            impossible(_("putting on unexpected type of accessory: %s"),
                       safe_typename(obj[0].otyp));
        }
    }
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

/* the #wear command */
export function dowear() { /* int */
    let otmp;

    /* cantweararm() checks for suits of armor, not what we want here;
       verysmall() or nohands() checks for shields, gloves, etc... */
    if (verysmall(gy.youmonst.data) || nohands(gy.youmonst.data)) {
        pline(_("Don't even bother."));
        return ECMD_OK;
    }
    if (uarm && uarmu && uarmc && uarmh && uarms && uarmg && uarmf
        && uleft && uright && uamul && ublindf) {
        /* 'W' message doesn't mention accessories */
        You(_("are already wearing a full complement of armor."));
        return ECMD_OK;
    }
    otmp = getobj(_("wear"), wear_ok, GETOBJ_NOFLAGS);
    return otmp ? accessory_or_armor_on(otmp) : ECMD_CANCEL;
}

/* the #puton command */
export function doputon() { /* int */
    let otmp;

    if (uleft && uright && uamul && ublindf
        && uarm && uarmu && uarmc && uarmh && uarms && uarmg && uarmf) {
        /* 'P' message doesn't mention armor */
        Your(_("%s%s are full, and you're already wearing an amulet and %s."),
             humanoid(gy.youmonst.data) ? _("ring-") : _(""),
             fingers_or_gloves(FALSE),
             (ublindf.otyp == LENSES) ? _("some lenses") : _("a blindfold"));
        return ECMD_OK;
    }
    otmp = getobj(_("put on"), puton_ok, GETOBJ_NOFLAGS);
    return otmp ? accessory_or_armor_on(otmp) : ECMD_CANCEL;
}

/* calculate current armor class */
export function find_ac() { /* void */
    let uac = mons[u.umonnum].ac; /* base armor class for current form */

    /* armor class from worn gear */
    if (uarm)
        uac -= ARM_BONUS(uarm);
    if (uarmc)
        uac -= ARM_BONUS(uarmc);
    if (uarmh)
        uac -= ARM_BONUS(uarmh);
    if (uarmf)
        uac -= ARM_BONUS(uarmf);
    if (uarms)
        uac -= ARM_BONUS(uarms);
    if (uarmg)
        uac -= ARM_BONUS(uarmg);
    if (uarmu)
        uac -= ARM_BONUS(uarmu);
    if (uleft && uleft.otyp == RIN_PROTECTION)
        uac -= uleft.spe;
    if (uright && uright.otyp == RIN_PROTECTION)
        uac -= uright.spe;
    if (uamul && uamul.otyp == AMULET_OF_GUARDING)
        uac -= 2; /* fixed amount; main benefit is to MC */

    /* armor class from other sources */
    if (HProtection() & INTRINSIC)
        uac -= u.ublessed;
    uac -= u.uspellprot;

    /* put a cap on armor class [5.0: was +127,-128, now reduced to +/- 99 */
    if (abs(uac) > AC_MAX)
        uac = sgn(uac) * AC_MAX;

    if (uac != u.uac) {
        u.uac = uac;
        disp.botl = TRUE;
    /* #if 0: not in this build */
    }
}

export function glibr() { /* void */
    let otmp;
    let xfl = 0;
    let leftfall, rightfall, wastwoweap = FALSE;
    let otherwep = 0, thiswep, which, hand;

    leftfall = (uleft && !uleft.cursed
                && (!uwep || !(welded(uwep) && ULEFTY())
                    || !bimanual(uwep)) ? 1 : 0);
    rightfall = (uright && !uright.cursed
                && (!uwep || !(welded(uwep) && URIGHTY())
                    || !bimanual(uwep)) ? 1 : 0);
/*
    leftfall = (uleft && !uleft->cursed
                && (!uwep || !welded(uwep) || !bimanual(uwep)));
    rightfall = (uright && !uright->cursed && (!welded(uwep)));
*/

    if (!uarmg && (leftfall || rightfall) && !nolimbs(gy.youmonst.data)) {
        /* changed so cursed rings don't fall off, GAN 10/30/86 */
        Your(_("%s off your %s."),
             (leftfall && rightfall) ? _("rings slip") : _("ring slips"),
             (leftfall && rightfall) ? fingers_or_gloves(FALSE)
                                     : body_part(FINGER));
        xfl++;
        if (leftfall) {
            otmp = uleft;
            Ring_off(uleft);
            dropx(otmp);
            cmdq_clear(CQ_CANNED);
        }
        if (rightfall) {
            otmp = uright;
            Ring_off(uright);
            dropx(otmp);
            cmdq_clear(CQ_CANNED);
        }
    }

    otmp = uswapwep;
    if (u.twoweap && otmp) {
        /* secondary weapon doesn't need nearly as much handling as
           primary; when in two-weapon mode, we know it's one-handed
           with something else in the other hand and also that it's
           a weapon or weptool rather than something unusual, plus
           we don't need to compare its type with the primary */
        otherwep = is_sword(otmp) ? c_sword : weapon_descr(otmp);
        if (otmp.quan > 1)
            otherwep = makeplural(otherwep);
        hand = body_part(HAND);
        which = URIGHTY() ? _("left ") : _("right ");  /* text for the off hand */
        Your(_("%s %s%s from your %s%s."), otherwep, xfl ? _("also ") : _(""),
             otense(otmp, _("slip")), which, hand);
        xfl++;
        wastwoweap = TRUE;
        setuswapwep(null); /* clears u.twoweap */
        cmdq_clear(CQ_CANNED);
        if (canletgo(otmp, _("")))
            dropx(otmp);
    }
    otmp = uwep;
    if (otmp && otmp.otyp != AKLYS && !welded(otmp)) {
        let savequan = otmp.quan;

        /* nice wording if both weapons are the same type */
        thiswep = is_sword(otmp) ? c_sword : weapon_descr(otmp);
        if (otherwep && strcmp(thiswep, makesingular(otherwep)))
            otherwep = 0;
        if (otmp.quan > 1) {
            /* most class names for unconventional wielded items
               are ok, but if wielding multiple apples or rations
               we don't want "your foods slip", so force non-corpse
               food to be singular; skipping makeplural() isn't
               enough--we need to fool otense() too */
            if (!strcmp(thiswep, _("food")))
                otmp.quan = 1;
            else
                thiswep = makeplural(thiswep);
        }
        hand = body_part(HAND);
        which = _("");
        if (bimanual(otmp)) {
            hand = makeplural(hand);
        } else if (wastwoweap) {
            /* preceding msg was about non-dominant hand */
            which = URIGHTY() ? _("right ") : _("left ");
        }
        pline(_("%s %s%s %s%s from your %s%s."),
              !strncmp(thiswep, _("corpse"), 6) ? _("The") : _("Your"),
              otherwep ? _("other ") : _(""), thiswep, xfl ? _("also ") : _(""),
              otense(otmp, _("slip")), which, hand);
        /* xfl++; */
        otmp.quan = savequan;
        setuwep(null);
        cmdq_clear(CQ_CANNED);
        if (canletgo(otmp, _("")))
            dropx(otmp);
    }
}

export function some_armor(victim) { /* struct obj * */
    let otmph, otmp;

    otmph = (victim == gy.youmonst) ? uarmc : which_armor(victim, W_ARMC);
    if (!otmph)
        otmph = (victim == gy.youmonst) ? uarm : which_armor(victim, W_ARM);
    if (!otmph)
        otmph = (victim == gy.youmonst) ? uarmu : which_armor(victim, W_ARMU);

    otmp = (victim == gy.youmonst) ? uarmh : which_armor(victim, W_ARMH);
    if (otmp && (!otmph || !rn2(4)))
        otmph = otmp;
    otmp = (victim == gy.youmonst) ? uarmg : which_armor(victim, W_ARMG);
    if (otmp && (!otmph || !rn2(4)))
        otmph = otmp;
    otmp = (victim == gy.youmonst) ? uarmf : which_armor(victim, W_ARMF);
    if (otmp && (!otmph || !rn2(4)))
        otmph = otmp;
    otmp = (victim == gy.youmonst) ? uarms : which_armor(victim, W_ARMS);
    if (otmp && (!otmph || !rn2(4)))
        otmph = otmp;
    return otmph;
}

/* used for praying to check and fix levitation trouble */
export function stuck_ring(ring, otyp) { /* struct obj * */
    if (ring != uleft && ring != uright) {
        impossible(_("stuck_ring: neither left nor right?"));
        return null;
    }

    if (ring && ring.otyp == otyp) {
        /* reasons ring can't be removed match those checked by select_off();
           limbless case has extra checks because ordinarily it's temporary */
        if (nolimbs(gy.youmonst.data) && uamul
            && uamul.otyp == AMULET_OF_UNCHANGING && uamul.cursed)
            return uamul;
        if (welded(uwep) && ((ring == RING_ON_PRIMARY()) || bimanual(uwep)))
            return uwep;
        if (uarmg && uarmg.cursed)
            return uarmg;
        if (ring.cursed)
            return ring;
        /* normally outermost layer is processed first, but slippery gloves
           wears off quickly so uncurse ring itself before handling those */
        if (uarmg && Glib())
            return uarmg;
    }
    /* either no ring or not right type or nothing prevents its removal */
    return null;
}

/* also for praying; find worn item that confers "Unchanging" attribute */
export function unchanger() { /* struct obj * */
    if (uamul && uamul.otyp == AMULET_OF_UNCHANGING)
        return uamul;
    return null;
}

function select_off(otmp) { /* int */
    const $frame = stack_frame(); try {
    let why;
    let buf = stack_array(char, BUFSZ);

    if (!otmp)
        return 0;
    chars[buf] = ord('\0'); /* lint suppression */

    /* special ring checks */
    if (otmp == uright || otmp == uleft) {
        let glibdummy = stack_struct(struct_obj);

        if (nolimbs(gy.youmonst.data)) {
            pline_The(_("ring is stuck."));
            return 0;
        }
        struct_assign(glibdummy, cg.zeroobj);
        why = null; /* the item which prevents ring removal */
        if (welded(uwep) && ((otmp == RING_ON_PRIMARY()) || bimanual(uwep))) {
            sprintf(buf, _("free a weapon %s"), body_part(HAND));
            why = uwep;
        } else if (uarmg && (uarmg.cursed || Glib())) {
            sprintf(buf, _("take off your %s%s"), Glib() ? _("slippery ") : _(""), gloves_simple_name(uarmg))
;
            why = !Glib() ? uarmg : glibdummy;
        }
        if (why) {
            You(_("cannot %s to remove the ring."), buf);
            set_bknown(why, 1);
            return 0;
        }
    }
    /* special glove checks */
    if (otmp == uarmg) {
        if (welded(uwep)) {
            You(_("are unable to take off your %s while wielding that %s."),
                c_gloves, is_sword(uwep) ? c_sword : c_weapon);
            set_bknown(uwep, 1);
            return 0;
        } else if (Glib()) {
            pline(_("%s %s are too slippery to take off."),
                  uarmg.unpaid ? _("The") : _("Your"), /* simplified Shk_Your() */
                  gloves_simple_name(uarmg));
            return 0;
        }
        if (better_not_take_that_off(otmp))
            return 0;
    }
    /* special boot checks */
    if (otmp == uarmf) {
        if (u.utrap && u.utraptype == TT_BEARTRAP) {
            pline_The(_("bear trap prevents you from pulling your %s out."),
                      body_part(FOOT));
            return 0;
        } else if (u.utrap && u.utraptype == TT_INFLOOR) {
            You(_("are stuck in the %s, and cannot pull your %s out."),
                surface(u.ux, u.uy), makeplural(body_part(FOOT)));
            return 0;
        }
    }
    /* special suit and shirt checks */
    if (otmp == uarm || otmp == uarmu) {
        why = null; /* the item which prevents disrobing */
        if (uarmc && uarmc.cursed) {
            sprintf(buf, _("remove your %s"), cloak_simple_name(uarmc));
            why = uarmc;
        } else if (otmp == uarmu && uarm && uarm.cursed) {
            sprintf(buf, _("remove your %s"), c_suit);
            why = uarm;
        } else if (welded(uwep) && bimanual(uwep)) {
            sprintf(buf, _("release your %s"), is_sword(uwep) ? c_sword : (uwep.otyp == BATTLE_AXE)
                                                   ? c_axe
                                                   : c_weapon)
;
            why = uwep;
        }
        if (why) {
            You(_("cannot %s to take off %s."), buf, the(xname(otmp)));
            set_bknown(why, 1);
            return 0;
        }
    }
    /* basic curse check */
    if (otmp == uquiver || (otmp == uswapwep && !u.twoweap)) {
        ; /* some items can be removed even when cursed */
    } else {
        /* otherwise, this is fundamental */
        if (cursed(otmp))
            return 0;
    }

    if (otmp == uarm)
        svc.context.takeoff.mask = or64(svc.context.takeoff.mask, WORN_ARMOR);
    else if (otmp == uarmc)
        svc.context.takeoff.mask = or64(svc.context.takeoff.mask, WORN_CLOAK);
    else if (otmp == uarmf)
        svc.context.takeoff.mask = or64(svc.context.takeoff.mask, WORN_BOOTS);
    else if (otmp == uarmg)
        svc.context.takeoff.mask = or64(svc.context.takeoff.mask, WORN_GLOVES);
    else if (otmp == uarmh)
        svc.context.takeoff.mask = or64(svc.context.takeoff.mask, WORN_HELMET);
    else if (otmp == uarms)
        svc.context.takeoff.mask = or64(svc.context.takeoff.mask, WORN_SHIELD);
    else if (otmp == uarmu)
        svc.context.takeoff.mask = or64(svc.context.takeoff.mask, WORN_SHIRT);
    else if (otmp == uleft)
        svc.context.takeoff.mask = or64(svc.context.takeoff.mask, LEFT_RING);
    else if (otmp == uright)
        svc.context.takeoff.mask = or64(svc.context.takeoff.mask, RIGHT_RING);
    else if (otmp == uamul)
        svc.context.takeoff.mask = or64(svc.context.takeoff.mask, WORN_AMUL);
    else if (otmp == ublindf)
        svc.context.takeoff.mask = or64(svc.context.takeoff.mask, WORN_BLINDF);
    else if (otmp == uwep)
        svc.context.takeoff.mask = or64(svc.context.takeoff.mask, W_WEP);
    else if (otmp == uswapwep)
        svc.context.takeoff.mask = or64(svc.context.takeoff.mask, W_SWAPWEP);
    else if (otmp == uquiver)
        svc.context.takeoff.mask = or64(svc.context.takeoff.mask, W_QUIVER);

    else
        impossible(_("select_off: %s???"), doname(otmp));

    return 0;
    } finally { stack_pop($frame); }
}

function do_takeoff() { /* struct obj * */
    let otmp = null;
    let was_twoweap = u.twoweap;
    let doff = svc.context.takeoff;

    svc.context.takeoff.mask = or64(svc.context.takeoff.mask, I_SPECIAL); /* set flag for cancel_doff() */
    if (doff.what == W_WEP) {
        if (!cursed(uwep)) {
            setuwep(null);
            if (was_twoweap)
                You(_("are no longer wielding either weapon."));
            else
                You(_("are %s."), empty_handed());
        }
    } else if (doff.what == W_SWAPWEP) {
        setuswapwep(null);
        You(_("%sno longer %s."), was_twoweap ? _("are ") : _(""),
            was_twoweap ? _("wielding two weapons at once")
                        : _("have a second weapon readied"));
    } else if (doff.what == W_QUIVER) {
        setuqwep(null);
        You(_("no longer have ammunition readied."));
    } else if (doff.what == WORN_ARMOR) {
        otmp = uarm;
        if (!cursed(otmp))
            Armor_off();
    } else if (doff.what == WORN_CLOAK) {
        otmp = uarmc;
        if (!cursed(otmp))
            Cloak_off();
    } else if (doff.what == WORN_BOOTS) {
        otmp = uarmf;
        if (!cursed(otmp))
            Boots_off();
    } else if (doff.what == WORN_GLOVES) {
        otmp = uarmg;
        if (!cursed(otmp))
            Gloves_off();
    } else if (doff.what == WORN_HELMET) {
        otmp = uarmh;
        if (!cursed(otmp))
            Helmet_off();
    } else if (doff.what == WORN_SHIELD) {
        otmp = uarms;
        if (!cursed(otmp))
            Shield_off();
    } else if (doff.what == WORN_SHIRT) {
        otmp = uarmu;
        if (!cursed(otmp))
            Shirt_off();
    } else if (doff.what == WORN_AMUL) {
        otmp = uamul;
        if (!cursed(otmp))
            Amulet_off();
    } else if (doff.what == LEFT_RING) {
        otmp = uleft;
        if (!cursed(otmp))
            Ring_off(uleft);
    } else if (doff.what == RIGHT_RING) {
        otmp = uright;
        if (!cursed(otmp))
            Ring_off(uright);
    } else if (doff.what == WORN_BLINDF) {
        if (!cursed(ublindf))
            Blindf_off(ublindf);
    } else {
        impossible(_("do_takeoff: taking off %llx"), doff.what);
    }
    svc.context.takeoff.mask = and64(svc.context.takeoff.mask, ~I_SPECIAL); /* clear cancel_doff() flag */

    return otmp;
}

/* occupation callback for 'A' */
function take_off() { /* int */
    let i;
    let otmp;
    let doff = svc.context.takeoff;

    if (doff.what) {
        if (doff.delay > 0) {
            doff.delay--;
            return 1; /* still busy */
        }
        if ((otmp = do_takeoff()) != null)
            off_msg(otmp);
        doff.mask = and64(doff.mask, not64(doff.what));
        doff.what = 0;
    }

    for (i = 0; takeoff_order[i]; i++)
        if (doff.mask & takeoff_order[i]) {
            doff.what = takeoff_order[i];
            break;
        }

    otmp = null;
    doff.delay = 0;

    if (doff.what == 0) {
        You(_("finish %s."), doff.disrobing);
        return 0;
    } else if (doff.what == W_WEP) {
        doff.delay = 1;
    } else if (doff.what == W_SWAPWEP) {
        doff.delay = 1;
    } else if (doff.what == W_QUIVER) {
        doff.delay = 1;
    } else if (doff.what == WORN_ARMOR) {
        otmp = uarm;
        /* If a cloak is being worn, add the time to take it off and put
         * it back on again.  Kludge alert! since that time is 0 for all
         * known cloaks, add 1 so that it actually matters...
         */
        if (uarmc)
            doff.delay += 2 * objects[uarmc.otyp].oc_delay + 1;
    } else if (doff.what == WORN_CLOAK) {
        otmp = uarmc;
    } else if (doff.what == WORN_BOOTS) {
        otmp = uarmf;
    } else if (doff.what == WORN_GLOVES) {
        otmp = uarmg;
    } else if (doff.what == WORN_HELMET) {
        otmp = uarmh;
    } else if (doff.what == WORN_SHIELD) {
        otmp = uarms;
    } else if (doff.what == WORN_SHIRT) {
        otmp = uarmu;
        /* add the time to take off and put back on armor and/or cloak */
        if (uarm)
            doff.delay += 2 * objects[uarm.otyp].oc_delay;
        if (uarmc)
            doff.delay += 2 * objects[uarmc.otyp].oc_delay + 1;
    } else if (doff.what == WORN_AMUL) {
        doff.delay = 1;
    } else if (doff.what == LEFT_RING) {
        doff.delay = 1;
    } else if (doff.what == RIGHT_RING) {
        doff.delay = 1;
    } else if (doff.what == WORN_BLINDF) {
        /* [this used to be 2, but 'R' (and 'T') only require 1 turn to
           remove a blindfold, so 'A' shouldn't have been requiring 2] */
        doff.delay = 1;
    } else {
        impossible(_("take_off: taking off %llx"), doff.what);
        return 0; /* force done */
    }

    if (otmp)
        doff.delay += objects[otmp.otyp].oc_delay;

    /* Since setting the occupation now starts the counter next move, that
     * would always produce a delay 1 too big per item unless we subtract
     * 1 here to account for it.
     */
    if (doff.delay > 0)
        doff.delay--;

    set_occupation(take_off, doff.disrobing, 0);
    return 1; /* get busy */
}

function better_not_take_that_off(otmp) { /* boolean */
    const $frame = stack_frame(); try {
    let corpse = carrying_stoning_corpse();
    let buf = stack_array(char, BUFSZ);

    /* u_safe_from_fatal_corpse() with
       (st_corpse | st_petrifies | st_resists) instead of
       (st_corpse | st_petrifies)
       would also check for no stoning resistance before
       bothering to prompt, but losing stoning resistance
       later, without the gloves on could prove dangerous,
       so we won't factor that in */
    if (corpse
        && !u_safe_from_fatal_corpse(corpse, st_corpse | st_petrifies)) {
        Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("Take off your %s despite carrying a dead %s?"), gloves_simple_name(otmp), obj_pmname(corpse))

;
        return +(paranoid_ynq(TRUE, buf, FALSE) != ord('y'));
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

/* clear saved context to avoid inappropriate resumption of interrupted 'A' */
export function reset_remarm() { /* void */
    svc.context.takeoff.what = svc.context.takeoff.mask = 0;
    chars[svc.context.takeoff.disrobing + 0] = ord('\0');
}

/* the #takeoffall command -- remove multiple worn items */
export function doddoremarm() { /* int */
    let result = 0;

    if (svc.context.takeoff.what || svc.context.takeoff.mask) {
        You(_("continue %s."), svc.context.takeoff.disrobing);
        set_occupation(take_off, svc.context.takeoff.disrobing, 0);
        return ECMD_OK;
    } else if (!uwep && !uswapwep && !uquiver && !uamul && !ublindf
               && !uleft && !uright && !wearing_armor()) {
        You(_("are not wearing anything."));
        return ECMD_OK;
    }

    add_valid_menu_class(0); /* reset */
    if (flags.menu_style != MENU_TRADITIONAL
        || (result = ggetobj(_("take off"), select_off, 0, FALSE,
                             null)) < -1)
        menu_remarm(result);

    if (svc.context.takeoff.mask) {
        strncpy(svc.context.takeoff.disrobing,
                       (((svc.context.takeoff.mask & ~W_WEAPONS) != 0)
                        /* default activity for armor and/or accessories,
                           possibly combined with weapons */
                        ? _("disrobing")
                        /* specific activity when handling weapons only */
                        : _("disarming")), CONTEXTVERBSZ);
        take_off();
    }
    /* The time to perform the command is already completely accounted for
     * in take_off(); if we return 1, that would add an extra turn to each
     * disrobe.
     */
    return ECMD_OK;
}

/* #altunwield - just unwield alternate weapon, item-action '-' when picking
   uswapwep from context-sensitive inventory */
export function remarm_swapwep() { /* int */
    const $frame = stack_frame(); try {
    let cq = stack_struct(struct__cmd_queue), cmdq;
    let oldbknown;

    if ((cmdq = cmdq_pop()) != null) {
        /* '-' uswapwep item-action picked from context-sensitive invent */
        struct_assign(cq, cmdq);
        free(addr_of(cmdq));
    } else {
        cq.typ = CMDQ_KEY;
        cq.key = ord('\0'); /* something other than '-' */
    }
    if (cq.typ != CMDQ_KEY || cq.key != ord('-') || !uswapwep)
        return ECMD_FAIL;

    oldbknown = uswapwep.bknown; /* when deciding whether this command
                                   * has done something that takes time,
                                   * behave as if a cursed secondary weapon
                                   * can't be unwielded even though things
                                   * don't work that way... */
    reset_remarm();
    svc.context.takeoff.what = svc.context.takeoff.mask = W_SWAPWEP;
    do_takeoff();
    return (!uswapwep || uswapwep.bknown != oldbknown) ? ECMD_TIME : ECMD_OK;
    } finally { stack_pop($frame); }
}

function menu_remarm(retry) { /* int */
    const $frame = stack_frame(); try {
    let n, i = 0;
    let pick_list = stack_var(ptr_to(struct_mi));
    let all_worn_categories = TRUE;

    if (retry) {
        all_worn_categories = +(retry == -2);
    } else if (flags.menu_style == MENU_FULL) {
        all_worn_categories = FALSE;
        n = query_category(_("What type of things do you want to take off?"),
                           gi.invent, (WORN_TYPES | ALL_TYPES
                                    | UNPAID_TYPES | BUCX_TYPES),
                           pick_list, PICK_ANY);
        if (!n)
            return 0;
        for (i = 0; i < n; i++) {
            if (ptr_add(pick_list[0], i).item.a_int == ALL_TYPES_SELECTED)
                all_worn_categories = TRUE;
            else
                add_valid_menu_class(ptr_add(pick_list[0], i).item.a_int);
        }
        free(addr_of(pick_list[0]));
    } else if (flags.menu_style == MENU_COMBINATION) {
        let ggofeedback = stack_var(unsigned, 0);

        i = ggetobj(_("take off"), select_off, 0, TRUE, ggofeedback);
        if (ggofeedback[0] & ALL_FINISHED)
            return 0;
        all_worn_categories = +(i == -2);
    }
    if (menu_class_present(ord('u'))
        || menu_class_present(ord('B')) || menu_class_present(ord('U'))
        || menu_class_present(ord('C')) || menu_class_present(ord('X')))
        all_worn_categories = FALSE;

    n = query_objlist(_("What do you want to take off?"), ref_of(gi, "invent"),
                      (SIGNAL_NOMENU | USE_INVLET | INVORDER_SORT),
                      pick_list, PICK_ANY,
                      all_worn_categories ? is_worn : is_worn_by_type);
    if (n > 0) {
        for (i = 0; i < n; i++)
            select_off(ptr_add(pick_list[0], i).item.a_obj);
        free(addr_of(pick_list[0]));
    } else if (n < 0 && flags.menu_style != MENU_COMBINATION) {
        There(_("is nothing else you can remove or unwield."));
    }
    return 0;
    } finally { stack_pop($frame); }
}

/* take off the specific worn object and if it still exists after that,
   destroy it (taking off the item might already destroy it by dunking
   hero into lava) */
function wornarm_destroyed(wornarm) { /* void */
    let invobj, nextobj;
    let wornoid = wornarm.o_id;

    /* cancel_don() resets 'afternmv' when appropriate but doesn't reset
       uarmc/uarm/&c so doing this now won't interfere with the tests in
       'if (wornarm==uarmc) ... else if (wornarm==uarm) ... else ...' */
    if (donning(wornarm))
        cancel_don();

    if (wornarm == uarmc)
        Cloak_off();
    else if (wornarm == uarm)
        Armor_off();
    else if (wornarm == uarmu)
        Shirt_off();
    else if (wornarm == uarmh)
        Helmet_off();
    else if (wornarm == uarmg)
        Gloves_off();
    else if (wornarm == uarmf)
        Boots_off();
    else if (wornarm == uarms)
        Shield_off();

    /* 'wornarm' might be destroyed as a side-effect of xxx_off() so
       using carried() to check wornarm->where==OBJ_INVENT is not viable;
       scan invent instead; if already freed it shouldn't be possible to
       have re-used the stale memory for a new item yet but verify o_id
       just in case */
    for (invobj = gi.invent; invobj; invobj = nextobj) {
        nextobj = invobj.nobj;
        if (invobj == wornarm && invobj.o_id == wornoid) {
            useup(wornarm);
            break;
        }
    }
}

/*
 * returns impacted armor with its in_use bit set,
 * or Null. *resisted is updated to reflect whether
 * it resisted or not */
function maybe_destroy_armor(armor, atmp, resisted) { /* struct obj * */
    if ((armor != null) && (!atmp || atmp == armor)
        && ((chars[resisted] = obj_resists(armor, 0, 90)) == FALSE)) {
        armor.in_use = 1;
        return armor;
    }
    return null;
}

/* hit by destroy armor scroll/black dragon breath */
export function disintegrate_arm(atmp) { /* int */
    const $frame = stack_frame(); try {
    let otmp = null;
    let losing_gloves = FALSE, resisted = stack_var(boolean, FALSE),
            resistedc = stack_var(boolean, FALSE), resistedsuit = stack_var(boolean, FALSE);
    /*
     * Note: if the cloak resisted, then the suit or shirt underneath
     * wouldn't be impacted either. Likewise, if the suit resisted, the
     * shirt underneath wouldn't be impacted. Since there are no artifact
     * cloaks or suits right now, this is unlikely to come into effect,
     * but it should behave appropriately if/when the situation changes.
     */

    if ((otmp = maybe_destroy_armor(uarmc, atmp, addr_of(resistedc))) != null) {
        urgent_pline(_("Your %s crumbles and turns to dust!"),
                     /* cloak/robe/apron/smock (ID'd apron)/wrapping */
                     cloak_simple_name(otmp));
    } else if (!resistedc[0]
             && (otmp = maybe_destroy_armor(uarm, atmp, addr_of(resistedsuit))) != null) {
        let suit = suit_simple_name(otmp);

        /* for gold DSM, we don't want Armor_gone() to report that it
           stops shining _after_ we've been told that it is destroyed */
        if (otmp.lamplit)
            end_burn(otmp, FALSE);
        urgent_pline(_("Your %s %s to dust and %s to the %s!"),
                     /* suit might be "dragon scales" so vtense() is needed */
                     suit, vtense(suit, _("turn")), vtense(suit, _("fall")),
                     surface(u.ux, u.uy));
    } else if (!resistedc[0] && !resistedsuit[0]
             && (otmp = maybe_destroy_armor(uarmu, atmp, addr_of(resisted))) != null) {
        urgent_pline(_("Your %s crumbles into tiny threads and falls apart!"),
                     shirt_simple_name(otmp)); /* always "shirt" */
    } else if ((otmp = maybe_destroy_armor(uarmh, atmp, addr_of(resisted))) != null) {
        urgent_pline(_("Your %s turns to dust and is blown away!"),
                     helm_simple_name(otmp)); /* "helm" or "hat" */
    } else if ((otmp = maybe_destroy_armor(uarmg, atmp, addr_of(resisted))) != null) {
        urgent_pline(_("Your %s vanish!"), gloves_simple_name(otmp));
        losing_gloves = TRUE;
    } else if ((otmp = maybe_destroy_armor(uarmf, atmp, addr_of(resisted))) != null) {
        urgent_pline(_("Your %s disintegrate!"), boots_simple_name(otmp));
    } else if ((otmp = maybe_destroy_armor(uarms, atmp, addr_of(resisted))) != null) {
        urgent_pline(_("Your %s crumbles away!"), shield_simple_name(otmp));
    } else {
        return 0; /* could not destroy anything */
    }

    /* cancel_don() if applicable, Cloak_off()/Armor_off()/&c, and useup() */
    wornarm_destroyed(otmp);
    /* glove loss means wielded weapon will be touched */
    if (losing_gloves)
        selftouch(_("You"));

    stop_occupation();
    return 1;
    } finally { stack_pop($frame); }
}

/* return ERODE_foo erosion type which can apply to object */
function obj_erode_type(otmp) { /* int */
    if (is_flammable(otmp))
        return ERODE_BURN;
    else if (is_rustprone(otmp))
        return ERODE_RUST;
    else if (is_crackable(otmp))
        return ERODE_CRACK;
    else if (is_rottable(otmp))
        return ERODE_ROT;
    else if (is_corrodeable(otmp))
        return ERODE_CORRODE;
    return ERODE_NONE;
}

/* erode a number of worn armor(s).
   if the armor is hit when max eroded, destroys it. */
export function destroy_arm() { /* int */
    const $frame = stack_frame(); try {
    let armors = init_list(stack_array(ptr_to(struct_obj), 7), [ null ]);
    let otmp;
    let i, idx = 0, hits = rn2(4) + 1;
    let ret = 0;

    /* gather worn armor; include non-erodeable ones */
    if (uarm) armors[idx++] = uarm;
    if (uarmc) armors[idx++] = uarmc;
    if (uarmh) armors[idx++] = uarmh;
    if (uarms) armors[idx++] = uarms;
    if (uarmg) armors[idx++] = uarmg;
    if (uarmf) armors[idx++] = uarmf;
    if (uarmu) armors[idx++] = uarmu;
    if (!idx)
        return 0;

    for (i = 0; i < hits; i++) {
        otmp = armors[rn2(idx)];

        if (erosion_matters(otmp) && is_damageable(otmp) && !otmp.oerodeproof) {
            let erosion = obj_erode_type(otmp);

            if (erosion != ERODE_NONE) {
                let r = erode_obj(otmp, xname(otmp), erosion, EF_PAY|EF_DESTROY);

                if (r != ER_NOTHING)
                    ret = 1;
                if (r == ER_DESTROYED)
                    break;
            }
        }
    }

    if (ret)
        stop_occupation();
    return ret;
    } finally { stack_pop($frame); }
}

export function adj_abon(otmp, delta) { /* void */
    if (uarmg && uarmg == otmp && otmp.otyp == GAUNTLETS_OF_DEXTERITY) {
        if (delta) {
            makeknown(uarmg.otyp);
            (chars[u.abon.a + A_DEX]) += delta;
        }
        disp.botl = TRUE;
    }
    if (uarmh && uarmh == otmp && otmp.otyp == HELM_OF_BRILLIANCE) {
        if (delta) {
            makeknown(uarmh.otyp);
            (chars[u.abon.a + A_INT]) += delta;
            (chars[u.abon.a + A_WIS]) += delta;
        }
        disp.botl = TRUE;
    }
}

/* decide whether a worn item is covered up by some other worn item,
   used for dipping into liquid and applying grease and takeoff_ok();
   some criteria are different than select_off()'s */
export function inaccessible_equipment(
    obj,
    verb,
    only_if_known_cursed) { /* boolean */ /* ignore covering unless it is known to * be cursed */
    const $frame = stack_frame(); try {
    let need_to_take_off_outer_armor = init_string(static_array("inaccessible_equipment.need_to_take_off_outer_armor", char, sizeof_string("need to take off %s to %s %s.")), _("need to take off %s to %s %s."), true);

    let buf = stack_array(char, BUFSZ);
    let anycovering = +!only_if_known_cursed; /* more comprehensible... */

    if (!obj || !obj.owornmask)
        return FALSE; /* not inaccessible */

    /* check for suit covered by cloak */
    if (obj == uarm && uarmc && (anycovering || ((uarmc).cursed && (uarmc).bknown))) {
        if (verb) {
            strcpy(buf, yname(uarmc));
            You(need_to_take_off_outer_armor, buf, verb, yname(obj));
        }
        return TRUE;
    }
    /* check for shirt covered by suit and/or cloak */
    if (obj == uarmu
        && ((uarm && (anycovering || ((uarm).cursed && (uarm).bknown))) || (uarmc && (anycovering || ((uarmc).cursed && (uarmc).bknown))))) {
        if (verb) {
            let cloaktmp = stack_array(char, QBUFSZ), suittmp = stack_array(char, QBUFSZ);
            /* if sameprefix, use yname and xname to get "your cloak and suit"
               or "Manlobbi's cloak and suit"; otherwise, use yname and yname
               to get "your cloak and Manlobbi's suit" or vice versa */
            let sameprefix = (uarm && uarmc
                                  && !strcmp(shk_your(cloaktmp, uarmc),
                                             shk_your(suittmp, uarm)) ? 1 : 0);

            chars[buf] = ord('\0');
            if (uarmc)
                strcat(buf, yname(uarmc));
            if (uarm && uarmc)
                strcat(buf, _(" and "));
            if (uarm)
                strcat(buf, sameprefix ? xname(uarm) : yname(uarm));
            You(need_to_take_off_outer_armor, buf, verb, yname(obj));
        }
        return TRUE;
    }
    /* check for ring covered by gloves */
    if ((obj == uleft || obj == uright) && uarmg && (anycovering || ((uarmg).cursed && (uarmg).bknown))) {
        if (verb) {
            strcpy(buf, yname(uarmg));
            You(need_to_take_off_outer_armor, buf, verb, yname(obj));
        }
        return TRUE;
    }
    /* item is not inaccessible */
    return FALSE;
    } finally { stack_pop($frame); }
}

/* not a getobj callback - unifies code among the other 4 getobj callbacks */
function equip_ok(obj, removing, accessory) { /* int */
    const $frame = stack_frame(); try {
    let is_worn;
    let dummymask = stack_var(long, 0);

    if (!obj)
        return GETOBJ_EXCLUDE;

    /* ignore for putting on if already worn, or removing if not worn */
    is_worn = +((obj.owornmask & (W_ARMOR | W_ACCESSORY)) != 0);
    if (removing ^ is_worn)
        return GETOBJ_EXCLUDE_INACCESS;

    /* exclude most object classes outright */
    if (obj.oclass != ARMOR_CLASS && obj.oclass != RING_CLASS
        && obj.oclass != AMULET_CLASS) {
        /* ... except for a few wearable exceptions outside these classes */
        if (obj.otyp != MEAT_RING && obj.otyp != BLINDFOLD
            && obj.otyp != TOWEL && obj.otyp != LENSES)
            return GETOBJ_EXCLUDE;
    }

    /* armor with 'P' or 'R' or accessory with 'W' or 'T' */
    if (accessory ^ +(obj.oclass != ARMOR_CLASS))
        return GETOBJ_DOWNPLAY;

    /* armor we can't wear, e.g. from polyform */
    if (obj.oclass == ARMOR_CLASS && !removing
        && !canwearobj(obj, dummymask, FALSE))
        return GETOBJ_DOWNPLAY;

    /* Possible extension: downplay items (both accessories and armor) which
     * can't be worn because the slot is filled with something else. */

    /* removing inaccessible equipment */
    if (removing && !gi.item_action_in_progress) {
        if (inaccessible_equipment(obj, 0,
                                   +(obj.oclass == RING_CLASS)))
            return GETOBJ_EXCLUDE_INACCESS;
    }

    /* all good to go */
    return GETOBJ_SUGGEST;
    } finally { stack_pop($frame); }
}

/* getobj callback for P command */
function puton_ok(obj) { /* int */
    return equip_ok(obj, FALSE, TRUE);
}

/* getobj callback for R command */
function remove_ok(obj) { /* int */
    return equip_ok(obj, TRUE, TRUE);
}

/* getobj callback for W command */
function wear_ok(obj) { /* int */
    return equip_ok(obj, FALSE, FALSE);
}

/* getobj callback for T command */
function takeoff_ok(obj) { /* int */
    return equip_ok(obj, TRUE, FALSE);
}

/* getobj callback for blessed destroy armor.
   suggest any worn armor, even if covered by other armor */
export function any_worn_armor_ok(obj) { /* int */
    if (obj && (obj.owornmask & W_ARMOR))
        return GETOBJ_SUGGEST;
    return GETOBJ_EXCLUDE;
}

/* number of armor pieces worn by hero */
export function count_worn_armor() { /* int */
    let ret = 0;

    if (uarm) ret++;
    if (uarmc) ret++;
    if (uarmh) ret++;
    if (uarms) ret++;
    if (uarmg) ret++;
    if (uarmf) ret++;
    if (uarmu) ret++;

    return ret;
}

/*do_wear.c*/

import { A_CG_HELM_OFF, A_CG_HELM_ON, A_CHAOTIC, A_LAWFUL, A_NEUTRAL } from "./align.h.js";
import { A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS } from "./attrib.h.js";
import { ABASE, ABON, ACURR, ATEMP } from "./attrib.h.macros.js";
import { bl_bareh } from "./botl.h.js";
import { CONTEXTVERBSZ } from "./context.h.js";
import { NH_BLACK, something } from "./decl.h.macros.js";
import { AMULET_CLASS, ARMOR_CLASS, RING_CLASS, S_CENTAUR } from "./defsym.h.js";
import { Is_airlevel, Is_waterlevel } from "./dungeon.h.macros.js";
import { ParanoidRemove } from "./flag.h.macros.js";
import { BUFSZ, FALSE, QBUFSZ, TRUE, boolean } from "./global.h.js";
import {
    ALL_FINISHED, ALL_TYPES, ALL_TYPES_SELECTED, ARTICLE_YOUR, BUCX_TYPES, CMDQ_KEY, CQ_CANNED,
    CXN_ARTICLE, ECMD_CANCEL, ECMD_FAIL, ECMD_OK, ECMD_TIME, FACE, FINGER, FOOT, GETOBJ_DOWNPLAY,
    GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_INACCESS, GETOBJ_NOFLAGS, GETOBJ_SUGGEST, HAND, HEAD,
    INVORDER_SORT, LEG, MENU_COMBINATION, MENU_FULL, MENU_TRADITIONAL, NECK, SIGNAL_NOMENU,
    SUPPRESS_HALLUCINATION, SUPPRESS_SADDLE, UNPAID_TYPES, USE_INVLET, WORN_TYPES, st_corpse,
    st_petrifies, struct__cmd_queue,
} from "./hack.h.js";
import { ARM_BONUS, makeknown, plur, qstart_level } from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import {
    cant_drown, cantweararm, has_head, has_horns, humanoid, is_clinger, nohands, nolimbs, slithy,
    touch_petrifies, verysmall,
} from "./mondata.h.macros.js";
import { MZ_SMALL } from "./monflag.h.js";
import { PM_ARCHEOLOGIST, PM_CLERIC, PM_WIZARD } from "./monsters.h.js";
import {
    EF_DESTROY, EF_PAY, ERODE_BURN, ERODE_CORRODE, ERODE_CRACK, ERODE_NONE, ERODE_ROT, ERODE_RUST,
    ER_DESTROYED, ER_NOTHING, struct_obj,
} from "./obj.h.js";
import {
    WrappingAllowed, bimanual, is_boots, is_cloak, is_flimsy, is_gloves, is_helmet, is_shield,
    is_shirt, is_suit, is_sword,
} from "./obj.h.macros.js";
import {
    ARM_BOOTS, ARM_CLOAK, ARM_GLOVES, ARM_HELM, ARM_SHIELD, ARM_SHIRT, ARM_SUIT,
} from "./objclass.h.js";
import {
    is_corrodeable, is_crackable, is_damageable, is_metallic, is_rustprone,
} from "./objclass.h.macros.js";
import {
    AKLYS, ALCHEMY_SMOCK, AMULET_OF_CHANGE, AMULET_OF_ESP, AMULET_OF_FLYING, AMULET_OF_GUARDING,
    AMULET_OF_LIFE_SAVING, AMULET_OF_MAGICAL_BREATHING, AMULET_OF_REFLECTION,
    AMULET_OF_RESTFUL_SLEEP, AMULET_OF_STRANGULATION, AMULET_OF_UNCHANGING, AMULET_OF_YENDOR,
    AMULET_VERSUS_POISON, BATTLE_AXE, BLACK_DRAGON_SCALES, BLACK_DRAGON_SCALE_MAIL, BLINDFOLD,
    BLUE_DRAGON_SCALES, BLUE_DRAGON_SCALE_MAIL, CLOAK_OF_DISPLACEMENT, CLOAK_OF_INVISIBILITY,
    CLOAK_OF_MAGIC_RESISTANCE, CLOAK_OF_PROTECTION, CORNUTHAUM, CORPSE, DENTED_POT, DUNCE_CAP,
    DWARVISH_CLOAK, DWARVISH_IRON_HELM, DWARVISH_ROUNDSHIELD, ELVEN_BOOTS, ELVEN_CLOAK,
    ELVEN_LEATHER_HELM, ELVEN_SHIELD, FAKE_AMULET_OF_YENDOR, FEDORA, FUMBLE_BOOTS,
    GAUNTLETS_OF_DEXTERITY, GAUNTLETS_OF_FUMBLING, GAUNTLETS_OF_POWER, GOLD_DRAGON_SCALES,
    GOLD_DRAGON_SCALE_MAIL, GRAY_DRAGON_SCALES, GREEN_DRAGON_SCALES, GREEN_DRAGON_SCALE_MAIL,
    HAWAIIAN_SHIRT, HELMET, HELM_OF_BRILLIANCE, HELM_OF_CAUTION, HELM_OF_OPPOSITE_ALIGNMENT,
    HELM_OF_TELEPATHY, HIGH_BOOTS, IRON_SHOES, JUMPING_BOOTS, KICKING_BOOTS, LARGE_SHIELD,
    LEATHER_CLOAK, LEATHER_GLOVES, LENSES, LEVITATION_BOOTS, LOW_BOOTS, MEAT_RING, MUMMY_WRAPPING,
    OILSKIN_CLOAK, ORANGE_DRAGON_SCALES, ORANGE_DRAGON_SCALE_MAIL, ORCISH_CLOAK, ORCISH_HELM,
    ORCISH_SHIELD, RED_DRAGON_SCALES, RED_DRAGON_SCALE_MAIL, RIN_ADORNMENT, RIN_AGGRAVATE_MONSTER,
    RIN_COLD_RESISTANCE, RIN_CONFLICT, RIN_FIRE_RESISTANCE, RIN_FREE_ACTION, RIN_GAIN_CONSTITUTION,
    RIN_GAIN_STRENGTH, RIN_HUNGER, RIN_INCREASE_ACCURACY, RIN_INCREASE_DAMAGE, RIN_INVISIBILITY,
    RIN_LEVITATION, RIN_POISON_RESISTANCE, RIN_POLYMORPH, RIN_POLYMORPH_CONTROL, RIN_PROTECTION,
    RIN_PROTECTION_FROM_SHAPE_CHAN, RIN_REGENERATION, RIN_SEARCHING, RIN_SEE_INVISIBLE,
    RIN_SHOCK_RESISTANCE, RIN_SLOW_DIGESTION, RIN_STEALTH, RIN_SUSTAIN_ABILITY, RIN_TELEPORTATION,
    RIN_TELEPORT_CONTROL, RIN_WARNING, ROBE, SHIELD_OF_DRAIN_RESISTANCE, SHIELD_OF_REFLECTION,
    SHIELD_OF_SHOCK_RESISTANCE, SMALL_SHIELD, SPEED_BOOTS, TOWEL, T_SHIRT, URUK_HAI_SHIELD,
    WATER_WALKING_BOOTS, WHITE_DRAGON_SCALES, WHITE_DRAGON_SCALE_MAIL, YELLOW_DRAGON_SCALES,
    YELLOW_DRAGON_SCALE_MAIL,
} from "./objects.h.js";
import {
    ACID_RES, DISPLACED, DRAIN_RES, FAST, FLYING, FREE_ACTION, FROMOUTSIDE, FUMBLING, INFRAVISION,
    INTRINSIC, I_SPECIAL, LEFT_RING, MAGICAL_BREATHING, RIGHT_RING, SICK_RES, SLEEPY,
    SLOW_DIGESTION, STONE_RES, STRANGLED, TIMEOUT, WORN_AMUL, WORN_ARMOR, WORN_BLINDF, WORN_BOOTS,
    WORN_CLOAK, WORN_GLOVES, WORN_HELMET, WORN_SHIELD, WORN_SHIRT, W_ACCESSORY, W_AMUL, W_ARM,
    W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMOR, W_ARMS, W_ARMU, W_QUIVER, W_RING, W_SWAPWEP, W_TOOL,
    W_WEAPONS, W_WEP,
} from "./prop.h.js";
import { PICK_ANY, struct_mi } from "./wintype.h.js";
import {
    AC_MAX, A_CURRENT, A_ORIGINAL, TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA,
} from "./you.h.js";
import { RING_ON_PRIMARY, Role_if, ULEFTY, URIGHTY, Upolyd } from "./you.h.macros.js";
import {
    BInvis, BLevitation, BStealth, Blind, Blind_telepat, Breathless, Detect_monsters, EInvis,
    ESleepy, EStealth, Fast, Flying, Glib, HFast, HFumbling, HInvis, HLevitation, HProtection,
    HSee_invisible, HSleepy, HStealth, Hallucination, Invis, Invisible, Levitation,
    Protection_from_shape_changers, Punished, See_invisible, Slimed, Stone_resistance, Strangled,
    Swimming, Unblind_telepat, Unchanging, Underwater, Very_fast,
} from "./youprop.h.macros.js";
import { char, int, long, ord, sizeof, sizeof_string, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64, not64, or64 } from "../rt/int64.js";
import { abs, free, sprintf, strcat, strcmp, strcpy, strncmp, strncpy } from "../rt/libc.js";
import {
    init_list, init_string, stack_array, stack_struct, stack_var, static_array, static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, array_of, ptr_add, ptr_to, ref_of, struct_assign } from "../rt/struct.js";
import { stop_occupation } from "./allmain.js";
import { artifact_light, retouch_object } from "./artifact.js";
import { change_luck, extremeattr, uchangealign } from "./attrib.js";
import { set_bc } from "./ball.js";
import { condtests } from "./botl.js";
import {
    cmdq_clear, cmdq_peek, cmdq_pop, paranoid_ynq, set_occupation, yn_function,
} from "./cmd.js";
import { is_lava, is_pool, is_pool_or_lava } from "./dbridge.js";
import {
    cg, disp, flags, ga, gi, gm, gn, gw, gy, iflags, program_state, rightleftchars, svc, u,
} from "./decl.js";
import { newsym, see_monsters, set_mimic_blocking } from "./display.js";
import { canletgo, dropx, trycall } from "./do.js";
import { hcolor, hliquid, obj_pmname, x_monnam } from "./do_name.js";
import { has_ceiling, surface } from "./dungeon.js";
import { panic } from "./end.js";
import { nomul, spoteffects, unmul } from "./hack.js";
import { sgn, strsubst } from "./hacklib.js";
import {
    carrying_stoning_corpse, getobj, ggetobj, is_worn, prinv, silly_thing, update_inventory, useup,
    wearing_armor,
} from "./invent.js";
import { arti_light_description } from "./light.js";
import { gulp_blnd_check } from "./mhitu.js";
import { curse, is_flammable, is_rottable, set_bknown } from "./mkobj.js";
import { rescham, restartcham } from "./mon.js";
import { can_be_strangled, num_horns } from "./mondata.js";
import { mons } from "./monst.js";
import { observe_object } from "./o_init.js";
import { objects } from "./objects.js";
import {
    Tobjnam, Yname2, an, ansimpleoname, boots_simple_name, cloak_simple_name, corpse_xname, doname,
    erosion_matters, gloves_simple_name, helm_simple_name, killer_xname, makeplural, makesingular,
    obj_is_pname, otense, safe_typename, shield_simple_name, shirt_simple_name, simpleonames,
    suit_simple_name, the, thesimpleoname, vtense, xname, yname,
} from "./objnam.js";
import {
    add_valid_menu_class, encumber_msg, is_worn_by_type, menu_class_present, query_category,
    query_objlist, u_safe_from_fatal_corpse,
} from "./pickup.js";
import {
    There, You, You_cant, You_feel, Your, impossible, pline, pline_The, urgent_pline,
} from "./pline.js";
import {
    body_part, change_sex, float_vs_flight, livelog_newform, poly_gender,
} from "./polyself.js";
import {
    incr_itimeout, make_glib, make_hallucinated, make_slimed, self_invis_message, toggle_blindness,
} from "./potion.js";
import { region_danger } from "./region.js";
import { rn2, rnd } from "./rnd.js";
import { shk_your } from "./shk.js";
import { remove_worn_item } from "./steal.js";
import { begin_burn, end_burn } from "./timeout.js";
import { drown, erode_obj, float_down, float_up, instapetrify, selftouch } from "./trap.js";
import { weapon_descr } from "./weapon.js";
import { empty_handed, setuqwep, setuswapwep, setuwep, welded } from "./wield.js";
import { racial_exception, setnotworn, setworn, which_armor } from "./worn.js";
import { obj_resists } from "./zap.js";
