/* NetHack 5.0	zap.c	$NHDT-Date: 1770949988 2026/02/12 18:33:08 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.584 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2013. */
/* NetHack may be freely redistributed.  See license for details. */

/* Disintegration rays have special treatment; corpses are never left.
 * But the routine which calculates the damage is separate from the routine
 * which kills the monster.  The damage routine returns this cookie to
 * indicate that the monster should be disintegrated.
 */
export const MAGIC_COOKIE = 1000;

/* all callers of boxlock_invent() pass a NONNULL obj, and boxlock
 * boxlock_invent() calls boxlock() which has nonnull arg. */

export const ZT_MAGIC_MISSILE = (AD_MAGM - 1);
export const ZT_FIRE = (AD_FIRE - 1);
export const ZT_COLD = (AD_COLD - 1);
export const ZT_SLEEP = (AD_SLEE - 1);
export const ZT_DEATH = (AD_DISN - 1);
export const ZT_LIGHTNING = (AD_ELEC - 1);
export const ZT_POISON_GAS = (AD_DRST - 1);
export const ZT_ACID = (AD_ACID - 1);
/* 8 and 9 are currently unassigned */

export function ZT_WAND(x) { return x; }
export function ZT_SPELL(x) { return (10 + x); }
export function ZT_BREATH(x) { return (20 + x); }

export function is_hero_spell(type) { return +(type >= 10 && type < 20); }

export function M_IN_WATER(ptr) { return +(ptr.mlet == S_EEL || cant_drown(ptr)); }

const are_blinded_by_the_flash = init_string(static_array("are_blinded_by_the_flash", char, sizeof_string("are blinded by the flash!")), _("are blinded by the flash!"), true);

/*
 * A positive index means zapped/cast/breathed by hero.
 * A negative index means zapped/cast/breathed by a monster, with value
 * index fixup beyond abs() needed for wand zaps.  Wand zaps for monster
 * use -39..-30 rather than -9..-0 because -0 is ambiguous (same as 0).
 */
const flash_types = static_array("flash_types", ptr_to(char), null, [
    _("magic missile"), /* Wands must be 0-9 */
    _("bolt of fire"), _("bolt of cold"), _("sleep ray"), _("death ray"),
    _("bolt of lightning"), _(""), _(""), _(""), _(""),

    _("magic missile"), /* Spell equivalents must be 10-19 */
    _("fireball"), _("cone of cold"), _("sleep ray"), _("finger of death"),
    _("bolt of lightning"), /* there is no spell, used for retribution */
    _(""), _(""), _(""), _(""),

    _("blast of missiles"), /* Dragon breath equivalents 20-29*/
    _("blast of fire"), _("blast of frost"), _("blast of sleep gas"),
    _("blast of disintegration"), _("blast of lightning"),
    _("blast of poison gas"), _("blast of acid"), _(""), _("")
]);

/* convert monster zap/spell/breath value to hero zap/spell/breath value */
function zaptype(type) { /* int */
    if (type <= -30 && -39 <= type) /* monster wand zap */
        type += 30; /* first convert -39..-30 to -9..0 so that abs()
                     * will yield 0..9 (hero wand zap) for it */
    type = abs(type);
    return type;
}

/*
 * Recognizing unseen wands by zapping:  in 3.4.3 and earlier, zapping
 * most wand types while blind would add that type to the discoveries
 * list even if it had never been seen (ie, picked up while blinded
 * and shown in inventory as simply "a wand").  This behavior has been
 * changed; now such wands won't be discovered.  But if the type is
 * already discovered, then the individual wand whose effect was just
 * observed will be flagged as if seen.  [You already know wands of
 * striking; you zap "a wand" and observe striking effect (presumably
 * by sound or touch); it'll become shown in inventory as "a wand of
 * striking".]
 *
 * Unfortunately, the new behavior isn't really correct either.  There
 * should be an `eknown' bit for "effect known" added for wands (and
 * for potions since quaffing one of a stack is similar) so that the
 * particular wand which has been zapped would have its type become
 * known (it would change from "a wand" to "a wand of striking", for
 * example) without the type becoming discovered or other unknown wands
 * of that type showing additional information.  When blindness ends,
 * all objects in inventory with the eknown bit set would be discovered
 * and other items of the same type would become known as such.
 */

/* wand discovery gets special handling when hero is blinded */
export function learnwand(obj) { /* void */
    /* For a wand (or wand-like tool) zapped by the player, if the
       effect was observable (determined by caller; usually seen, but
       possibly heard or felt if the hero is blinded) then discover the
       object type provided that the object itself is known (as more
       than just "a wand").  If object type is already discovered and
       we observed the effect, mark the individual wand as having been
       seen.  Suppress spells (which use fake spellbook object for `obj')
       so that casting a spell won't re-discover its forgotten book. */
    if (obj.oclass != SPBOOK_CLASS) {
        /* if type already discovered, treat this item has having been seen
           even if hero is currently blinded (skips redundant makeknown) */
        if (objects[obj.otyp].oc_name_known) {
            observe_object(obj); /* will usually be dknown already */

        /* otherwise discover it if item itself has been or can be seen */
        } else {
            /* in case it was picked up while blind and then zapped without
               examining inventory after regaining sight (bypassing xname) */
            if (!Blind())
                observe_object(obj);
            /* make the discovery iff we know what we're manipulating */
            if (obj.dknown)
                makeknown(obj.otyp);
        }
        update_inventory();
    }
}

/*
 * Routines for IMMEDIATE wands and spells.
 * Also RAY or NODIR for wands that are being broken rather than zapped.
 */

/* bhitm: monster mtmp was hit by the effect of wand or spell otmp */
export function bhitm(mtmp, otmp) { /* int */
    const $frame = stack_frame(); try {
    let ret = 0;
    let wake = TRUE; /* Most 'zaps' should wake monster */
    let reveal_invis = FALSE, learn_it = stack_var(boolean, FALSE);
    let dbldam = (Role_if(PM_KNIGHT) && u.uhave.questart ? 1 : 0);
    let skilled_spell, helpful_gesture = FALSE;
    let dmg, otyp = otmp.otyp; /* otmp is not NULL */
    let zap_type_text = _("spell");
    let obj;
    let disguised_mimic = +(mtmp.data.mlet == S_MIMIC
                               && M_AP_TYPE(mtmp) != M_AP_NOTHING);
    /* box_or_door(): mimic appearances that have locks */

    if (engulfing_u(mtmp))
        reveal_invis = FALSE;

    gn.notonhead = +(mtmp.mx != gb.bhitpos.x || mtmp.my != gb.bhitpos.y);
    skilled_spell = (otmp.oclass == SPBOOK_CLASS && otmp.blessed ? 1 : 0);

    switch (otyp) {
    case WAN_STRIKING:
        zap_type_text = _("wand");
        /* FALLTHROUGH */;
    /*FALLTHRU*/
    case SPE_FORCE_BOLT:
        reveal_invis = TRUE;
        learn_it[0] = cansee(gb.bhitpos.x, gb.bhitpos.y);
        if (resists_magm(mtmp)) { /* match effect on player */
            if (disguised_mimic && !disguised_as_mon(mtmp))
                seemimic(mtmp);
            shieldeff(mtmp.mx, mtmp.my);
            pline(_("Boing!"));
            /* 5.0: used to 'break' to avoid setting learn_it here */
        } else if (u.uswallow || rnd(20) < 10 + find_mac(mtmp)) {
            if (disguised_mimic)
                seemimic(mtmp);
            dmg = d(2, 12);
            if (dbldam)
                dmg *= 2;
            if (otyp == SPE_FORCE_BOLT)
                dmg = spell_damage_bonus(dmg);
            hit(zap_type_text, mtmp, exclam(dmg));
            resist(mtmp, otmp.oclass, dmg, TELL);
        } else {
            if (!disguised_mimic)
                miss(zap_type_text, mtmp);
            learn_it[0] = FALSE;
        }
        break;
    case WAN_SLOW_MONSTER:
    case SPE_SLOW_MONSTER:
        if (!resist(mtmp, otmp.oclass, 0, NOTELL)) {
            if (disguised_mimic)
                seemimic(mtmp);
            mon_adjust_speed(mtmp, -1, otmp);
            check_gear_next_turn(mtmp); /* might want speed boots */

            if (engulfing_u(mtmp) && is_whirly(mtmp.data)) {
                You(_("disrupt %s!"), mon_nam(mtmp));
                pline(_("A huge hole opens up..."));
                expels(mtmp, mtmp.data, TRUE);
            }
        }
        break;
    case WAN_SPEED_MONSTER:
        if (!resist(mtmp, otmp.oclass, 0, NOTELL)) {
            if (disguised_mimic)
                seemimic(mtmp);
            mon_adjust_speed(mtmp, 1, otmp);
            check_gear_next_turn(mtmp); /* might want speed boots */
        }
        /* wake but don't anger a peaceful target */
        helpful_gesture = TRUE;
        break;
    case WAN_UNDEAD_TURNING:
    case SPE_TURN_UNDEAD:
        wake = FALSE;
        if (unturn_dead(mtmp))
            wake = TRUE;
        if (is_undead(mtmp.data) || is_vampshifter(mtmp)) {
            reveal_invis = TRUE;
            wake = TRUE;
            dmg = rnd(8);
            if (dbldam)
                dmg *= 2;
            if (otyp == SPE_TURN_UNDEAD)
                dmg = spell_damage_bonus(dmg);
            svc.context.bypasses = TRUE; /* for make_corpse() */
            if (!resist(mtmp, otmp.oclass, dmg, NOTELL)) {
                if (!DEADMONSTER(mtmp))
                    monflee(mtmp, 0, FALSE, TRUE);
            }
        }
        break;
    case WAN_POLYMORPH:
    case SPE_POLYMORPH:
    case POT_POLYMORPH:
        if (mtmp.data == mons[PM_LONG_WORM] && has_mcorpsenm(mtmp)) {
            /* if a long worm has mcorpsenm set, it was polymorphed by
               the current zap and shouldn't be affected if hit again */
            ;
        } else if (resists_magm(mtmp)) {
            /* magic resistance protects from polymorph traps, so make
               it guard against involuntary polymorph attacks too... */
            shieldeff_mon(mtmp);
        } else if (!resist(mtmp, otmp.oclass, 0, NOTELL)) {
            let polyspot = +(otyp != POT_POLYMORPH),
                    give_msg = (!Hallucination()
                                && (canseemon(mtmp)
                                    || engulfing_u(mtmp)) ? 1 : 0);

            /* dropped inventory (due to death by system shock,
               or loss of wielded weapon and/or worn armor due to
               limitations of new shape) won't be hit by this zap */
            if (polyspot)
                for (obj = mtmp.minvent; obj; obj = obj.nobj)
                    bypass_obj(obj);

            /* natural shapechangers aren't affected by system shock
               (unless protection from shapechangers is interfering
               with their metabolism...) */
            if (mtmp.cham == NON_PM && !rn2(25)) {
                if (canseemon(mtmp)) {
                    pline(_("%s shudders!"), Monnam(mtmp));
                    learn_it[0] = TRUE;
                }
                /* svc.context.bypasses = TRUE; ## for make_corpse() */
                /* no corpse after system shock */
                xkilled(mtmp, XKILL_GIVEMSG | XKILL_NOCORPSE);
            } else {
                let ncflags = NO_NC_FLAGS;

                if (polyspot)
                    ncflags = unsigned(ncflags | NC_VIA_WAND_OR_SPELL);
                if (give_msg)
                    ncflags = unsigned(ncflags | NC_SHOW_MSG);
                if (newcham(mtmp, null, ncflags) != 0
                           /* if shapechange failed because there aren't
                              enough eligible candidates (most likely for
                              vampshifter), try reverting to original form */
                           || (ismnum(mtmp.cham)
                               && newcham(mtmp, mons[mtmp.cham],
                                          ncflags) != 0)) {
                    if (give_msg && (canspotmon(mtmp)
                                     || engulfing_u(mtmp)))
                        learn_it[0] = TRUE;
                }
            }

            /* do this even if polymorphed failed (otherwise using
               flags.mon_polycontrol prompting to force mtmp to remain
               'long worm' would prompt again if zap hit another segment) */
            if (!DEADMONSTER(mtmp) && mtmp.data == mons[PM_LONG_WORM]) {
                if (!has_mcorpsenm(mtmp))
                    newmcorpsenm(mtmp);
                /* flag to indicate that mtmp became a long worm
                   on current zap, so further hits (on mtmp's new
                   tail) don't do further transforms */
                ((mtmp).mextra.mcorpsenm) = PM_LONG_WORM;
                /* flag to indicate that cleanup is needed; object
                   bypass cleanup also clears mon->mextra->mcorpsenm
                   for all long worms on the level */
                svc.context.bypasses = TRUE;
            }
        }
        break;
    case WAN_CANCELLATION:
    case SPE_CANCELLATION:
        if (disguised_mimic)
            seemimic(mtmp);
        cancel_monst(mtmp, otmp, TRUE, TRUE, FALSE);
        break;
    case WAN_TELEPORTATION:
    case SPE_TELEPORT_AWAY:
        if (disguised_mimic)
            seemimic(mtmp);
        reveal_invis = +!u_teleport_mon(mtmp, TRUE);
        learn_it[0] = canspotmon(mtmp);
        break;
    case WAN_MAKE_INVISIBLE: {
        let oldinvis = mtmp.minvis;
        let couldsee = canseemon(mtmp);
        let nambuf = stack_array(char, BUFSZ);

        if (disguised_mimic)
            seemimic(mtmp);
        /* format monster's name before altering its visibility */
        strcpy(nambuf, Monnam(mtmp));
        mon_set_minvis(mtmp, FALSE);
        if (!oldinvis && knowninvisible(mtmp)) {
            pline(_("%s turns transparent!"), nambuf);
            reveal_invis = TRUE;
            learn_it[0] = TRUE;
        } else if (couldsee && !canseemon(mtmp)) {
            /* keep the immediate effects of make invisible and teleportation
               ambiguous by using the same message that's used if we
               teleported mtmp (and it ended up somewhere you can't see) */
            pline(_("%s vanishes!"), nambuf);
        }
        break;
    }
    case WAN_LOCKING:
    case SPE_WIZARD_LOCK:
        if (disguised_mimic && box_or_door(mtmp))
            that_is_a_mimic(mtmp, MIM_REVEAL); /*seemimic()*/
        wake = closeholdingtrap(mtmp, addr_of(learn_it));
        break;
    case WAN_PROBING:
        wake = FALSE;
        reveal_invis = TRUE;
        probe_monster(mtmp);
        learn_it[0] = TRUE;
        break;
    case WAN_OPENING:
    case SPE_KNOCK:
        if (disguised_mimic && box_or_door(mtmp))
            that_is_a_mimic(mtmp, MIM_REVEAL); /*seemimic()*/
        wake = FALSE; /* don't want immediate counterattack */
        if (mtmp == u.ustuck) {
            /* zapping either holder/holdee or self [zapyourself()] will
               release hero from holder's grasp or holdee from hero's grasp */
            release_hold();
            learn_it[0] = TRUE;

        /* zap which hits steed will only release saddle if it
           doesn't hit a holding or falling trap; playability
           here overrides the more logical target ordering */
        } else if (openholdingtrap(mtmp, addr_of(learn_it))) {
            break;
        } else if (openfallingtrap(mtmp, TRUE, addr_of(learn_it))) {
            /* mtmp might now be on the migrating monsters list */
            break;
        } else if (otyp == SPE_KNOCK) {
            wake = TRUE;
            ret = 1;
            if (mtmp.data.msize < MZ_HUMAN && !m_is_steadfast(mtmp)) {
                if (canseemon(mtmp))
                    pline(_("%s is knocked back!"),
                          Monnam(mtmp));
                mhurtle(mtmp, mtmp.mx - u.ux, mtmp.my - u.uy, rnd(2));
            } else {
                if (canseemon(mtmp))
                    pline(_("%s doesn't budge."), Monnam(mtmp));
            }
            if (!DEADMONSTER(mtmp)) {
                wakeup(mtmp, +!mindless(mtmp.data));
                abuse_dog(mtmp);
            }
        } else if ((obj = which_armor(mtmp, W_SADDLE)) != null) {
            let buf = stack_array(char, BUFSZ);

            sprintf(buf, _("%s %s"), s_suffix(Monnam(mtmp)), distant_name(obj, xname))
;
            if (cansee(mtmp.mx, mtmp.my)) {
                if (!canspotmon(mtmp))
                    strcpy(buf, An(distant_name(obj, xname)));
                pline(_("%s falls to the %s."), buf,
                      surface(mtmp.mx, mtmp.my));
            } else if (canspotmon(mtmp)) {
                pline(_("%s falls off."), buf);
            }
            mdrop_obj(mtmp, obj, FALSE);
        }
        break;
    case SPE_HEALING:
    case SPE_EXTRA_HEALING: {
        let healamt = d(6, otyp == SPE_EXTRA_HEALING ? 8 : 4);

        reveal_invis = TRUE;
        if (mtmp.data != mons[PM_PESTILENCE]) {
            let delta = mtmp.mhpmax - mtmp.mhp;

            wake = FALSE; /* wakeup() makes the target angry */
            healmon(mtmp, healamt, 0);
            /* plain healing must be blessed to cure blindness; extra
               healing only needs to not be cursed, so spell always cures
               [potions quaffed by monsters behave slightly differently;
               we use the rules for the hero here...] */
            if (skilled_spell || otyp == SPE_EXTRA_HEALING)
                mcureblindness(mtmp, canseemon(mtmp));
            if (canseemon(mtmp)) {
                if (disguised_mimic) {
                    if (is_obj_mappear(mtmp, STRANGE_OBJECT)) {
                        /* it can do better now */
                        set_mimic_sym(mtmp);
                        newsym(mtmp.mx, mtmp.my);
                    } else
                        mimic_hit_msg(mtmp, otyp);
                } else
                    pline(_("%s looks%s better."), Monnam(mtmp),
                          otyp == SPE_EXTRA_HEALING ? _(" much") : _(""));
            }
            if (mtmp.mtame && Role_if(PM_HEALER) && (delta > 0)) {
                more_experienced(min(delta, healamt), 0);
                newexplevel();
            }
            if (mtmp.mtame || mtmp.mpeaceful) {
                adjalign(Role_if(PM_HEALER) ? 1 : sgn(u.ualign.type));
            }
        } else { /* Pestilence */
            /* Pestilence will always resist; damage is half of (healamt/2) */
            resist(mtmp, otmp.oclass, Math.trunc(healamt / 2), TELL);
        }
        break;
    }
    case WAN_LIGHT: /* (broken wand) */
        if (flash_hits_mon(mtmp, otmp)) {
            learn_it[0] = TRUE;
            reveal_invis = TRUE;
        }
        break;
    case WAN_SLEEP: /* (broken wand) */
        /* [wakeup() doesn't rouse victims of temporary sleep,
           so it's okay to leave `wake' set to TRUE here;
           revealing concealed mimic is handled by sleep_monst()] */
        reveal_invis = TRUE;
        if (sleep_monst(mtmp, d(1 + otmp.spe, 12), WAND_CLASS))
            slept_monst(mtmp);
        if (!Blind())
            learn_it[0] = TRUE;
        break;
    case SPE_STONE_TO_FLESH:
        if (mtmp.data.mlet == S_GOLEM) {
            let mesg;
            let name = Monnam(mtmp); /* before possible polymorph */

            /* turn stone golem into flesh golem */
            if (monsndx(mtmp.data) == PM_STONE_GOLEM
                && newcham(mtmp, mons[PM_FLESH_GOLEM], NO_NC_FLAGS))
                mesg = _("turns to flesh!");
            else if (monsndx(mtmp.data) == PM_FLESH_GOLEM)
                mesg = _("seems fleshier...");
            else
                mesg = _("looks rather fleshy for a moment.");

            if (canseemon(mtmp))
                pline(_("%s %s"), name, mesg);
        } else if (mtmp.data.mlet == S_MIMIC
                   && ((M_AP_TYPE(mtmp) == M_AP_FURNITURE
                        && stone_furniture_type(mtmp.mappearance))
                       || (M_AP_TYPE(mtmp) == M_AP_OBJECT
                           && stone_object_type(mtmp.mappearance)))) {
            /* note: if that_is_a_mimic() doesn't get called to reveal the
               mimic, wakeup() below will call seemimic() */
            if (cansee(mtmp.mx, mtmp.my)) {
                set_msg_xy(mtmp.mx, mtmp.my);
                that_is_a_mimic(mtmp, MIM_REVEAL | MIM_OMIT_WAIT);
            }
        } else {
            wake = FALSE;
        }
        break;
    case SPE_DRAIN_LIFE:
        if (disguised_mimic)
            seemimic(mtmp);
        dmg = monhp_per_lvl(mtmp);
        if (dbldam)
            dmg *= 2;
        if (otyp == SPE_DRAIN_LIFE)
            dmg = spell_damage_bonus(dmg);
        if (resists_drli(mtmp)) {
            shieldeff_mon(mtmp);
        } else if (!resist(mtmp, otmp.oclass, dmg, NOTELL)
                   && !DEADMONSTER(mtmp)) {
            mtmp.mhp -= dmg;
            mtmp.mhpmax -= dmg;
            /* die if already level 0, regardless of hit points */
            if (DEADMONSTER(mtmp) || mtmp.mhpmax <= 0 || mtmp.m_lev < 1) {
                killed(mtmp);
            } else {
                mtmp.m_lev--;
                if (canseemon(mtmp))
                    pline(_("%s suddenly seems weaker!"), Monnam(mtmp));
            }
        }
        break;
    case WAN_NOTHING:
        wake = FALSE;
        break;
    default:
        impossible(_("What an interesting effect (%d)"), otyp);
        break;
    }
    if (wake && !DEADMONSTER(mtmp)) {
        /* seemimic() is done by wakeup() and might unblock vision */
        wakeup(mtmp, helpful_gesture ? FALSE : TRUE);
        m_respond(mtmp);
        if (mtmp.isshk && !chars[u.ushops])
            hot_pursuit(mtmp);
    }
    /* note: gb.bhitpos won't be set if swallowed, but that's okay since
     * reveal_invis will be false.  We can't use mtmp->mx, my since it
     * might be an invisible worm hit on the tail.
     */
    if (reveal_invis && !DEADMONSTER(mtmp)) {
        if (cansee(gb.bhitpos.x, gb.bhitpos.y) && !canspotmon(mtmp))
            map_invisible(gb.bhitpos.x, gb.bhitpos.y);
    }
    /* if effect was observable then discover the wand type provided
       that the wand itself has been seen */
    if (learn_it[0])
        learnwand(otmp);
    return ret;
    } finally { stack_pop($frame); }
}
export function box_or_door(monst) { return +((M_AP_TYPE(monst) == M_AP_OBJECT && (monst.mappearance == CHEST || monst.mappearance == LARGE_BOX)) || (M_AP_TYPE(monst) == M_AP_FURNITURE /* is_cmap_door() tests S_symbol values, and            */ /* mon->mappearance for furniture contains one of those */ && is_cmap_door(monst.mappearance))); }

/* hero is held by a monster or engulfed or holding a monster and has zapped
   opening/unlocking magic at holder/engulfer/holdee or at self */
export function release_hold() { /* void */
    const $frame = stack_frame(); try {
    let mtmp = u.ustuck;

    if (!mtmp) {
        impossible(_("release_hold when not held?"));
    } else if (u.uswallow) { /* possible for sticky hero to be swallowed */
        if (digests(mtmp.data)) {
            if (!Blind())
                pline(_("%s opens its mouth!"), Monnam(mtmp));
            else
                You_feel(_("a sudden rush of air!"));
        }
        /* gives "you get regurgitated" or "you get expelled from <mon>" */
        expels(mtmp, mtmp.data, TRUE);
    } else if (sticks(gy.youmonst.data)) {
        /* order matters if 'holding' status condition is enabled;
           set_ustuck() will set flag for botl update, You() pline will
           trigger a status update with "UHold" removed */
        set_ustuck(null);
        You(_("release %s."), mon_nam(mtmp));
    } else { /* held but not swallowed */
        let relbuf = stack_array(char, BUFSZ);

        unstuck(u.ustuck);
        if (!nohands(mtmp.data))
            sprintf(relbuf, _("from %s grasp"), s_suffix(mon_nam(mtmp)));
        else
            sprintf(relbuf, _("by %s"), mon_nam(mtmp));
        You(_("are released %s."), relbuf);
    }
    } finally { stack_pop($frame); }
}

function probe_objchain(otmp) { /* void */
    for (; otmp; otmp = otmp.nobj) {
        observe_object(otmp); /* treat as "seen" */
        if (Is_container(otmp) || otmp.otyp == STATUE) {
            otmp.lknown = 1;
            if (!SchroedingersBox(otmp))
                otmp.cknown = 1;
        } else if (otmp.otyp == TIN)
            otmp.known = 1;
    }
}

export function probe_monster(mtmp) { /* void */
    mstatusline(mtmp);
    if (gn.notonhead)
        return; /* don't show minvent for long worm tail */

    if (mtmp.minvent) {
        probe_objchain(mtmp.minvent);
        display_minventory(mtmp, MINV_ALL | MINV_NOLET | PICK_NONE,
                                  0);
    } else {
        pline(_("%s is not carrying anything%s."), noit_Monnam(mtmp),
              engulfing_u(mtmp) ? _(" besides you") : _(""));
    }
}

/*
 * Return the object's physical location.  This only makes sense for
 * objects that are currently on the level (i.e. migrating objects
 * are nowhere).  By default, only things that can be seen (in hero's
 * inventory, monster's inventory, or on the ground) are reported.
 * By adding BURIED_TOO and/or CONTAINED_TOO flags, you can also get
 * the location of buried and contained objects.  Note that if an
 * object is carried by a monster, its reported position may change
 * from turn to turn.  This function returns FALSE if the position
 * is not available or subject to the constraints above.
 */
export function get_obj_location(
    obj,
    xp, yp,
    locflags) { /* boolean */
    switch (obj.where) {
    case OBJ_INVENT:
        xp[0] = u.ux;
        yp[0] = u.uy;
        return TRUE;
    case OBJ_FLOOR:
        xp[0] = obj.ox;
        yp[0] = obj.oy;
        return TRUE;
    case OBJ_MINVENT:
        if (obj.v.v_ocarry.mx) {
            xp[0] = obj.v.v_ocarry.mx;
            yp[0] = obj.v.v_ocarry.my;
            return TRUE;
        }
        break; /* !mx => migrating monster */
    case OBJ_BURIED:
        if (locflags & BURIED_TOO) {
            xp[0] = obj.ox;
            yp[0] = obj.oy;
            return TRUE;
        }
        break;
    case OBJ_CONTAINED:
        if (locflags & CONTAINED_TOO)
            return get_obj_location(obj.v.v_ocontainer, xp, yp, locflags);
        break;
    }
    xp[0] = yp[0] = 0;
    return FALSE;
}

export function get_mon_location(
    mon,
    xp, yp,
    locflags) { /* boolean */ /* non-zero means get location even if monster is buried */
    if (mon == gy.youmonst || (u.usteed && mon == u.usteed)) {
        xp[0] = u.ux;
        yp[0] = u.uy;
        return TRUE;
    } else if (mon.mx > 0 && (!mon.mburied || locflags)) {
        xp[0] = mon.mx;
        yp[0] = mon.my;
        return TRUE;
    } else { /* migrating or buried */
        xp[0] = yp[0] = 0;
        return FALSE;
    }
}

/* used by revive() and animate_statue() */
export function montraits(
    obj,
    cc,
    adjacentok) { /* struct monst * */ /* False: at obj's spot only, * True: nearby is allowed */
    let mtmp = null,
                 mtmp2 = has_omonst(obj) ? get_mtraits(obj, TRUE) : null;

    if (mtmp2) {
        /* save_mtraits() validated mtmp2->mnum */
        mtmp2.data = mons[mtmp2.mnum];

        if (mtmp2.mhpmax > 0 || is_rider(mtmp2.data)) {
            mtmp = makemon(mtmp2.data, cc.x, cc.y,
                           (NO_MINVENT | MM_NOWAIT | MM_NOCOUNTBIRTH
                            /* in case mtmp2 is a long worm; saved traits for
                               long worm don't include tail segments so don't
                               give mtmp any; it will be given a new 'wormno'
                               though (unless those are exhausted) so be able
                               to grow new tail segments */
                            | MM_NOTAIL | MM_NOMSG
                            | (adjacentok ? MM_ADJACENTOK : 0)));
        }
        if (!mtmp) {
            /* mtmp2 is a copy of obj's object->oextra->omonst extension
               and is not on the map or on any monst lists */
            dealloc_monst(mtmp2);
            return null;
        }

        /* heal the monster; lower than normal level might come from
           adj_lev() but we assume it has come from 'mtmp' being level
           drained before finally killed; give a chance to restore
           some levels so that trolls and Riders can't be drained to
           level 0 and then trivially killed repeatedly */
        if (mtmp.m_lev < mtmp.data.mlevel) {
            let ltmp = rnd(mtmp.data.mlevel + 1);

            if (ltmp > mtmp.m_lev) {
                while (mtmp.m_lev < ltmp) {
                    mtmp.m_lev++;
                    mtmp.mhpmax += monhp_per_lvl(mtmp);
                }
                mtmp2.m_lev = mtmp.m_lev;
            }
        }
        if (mtmp.mhpmax > mtmp2.mhpmax) /* &&is_rider(mtmp2->data)*/
            mtmp2.mhpmax = mtmp.mhpmax;
        mtmp2.mhp = mtmp2.mhpmax;
        /* Get these ones from mtmp */
        mtmp2.minvent = mtmp.minvent; /*redundant*/
        /* monster ID is available if the monster died in the current
           game, but will be zero if the corpse was in a bones level
           (we cleared it when loading bones) */
        if (mtmp.m_id) {
            mtmp2.m_id = mtmp.m_id;
            /* might be bringing quest leader back to life */
            if (svq.quest_status.leader_is_dead
                /* leader_is_dead implies leader_m_id is valid */
                && mtmp2.m_id == svq.quest_status.leader_m_id)
                svq.quest_status.leader_is_dead = FALSE;
        }
        mtmp2.mx = mtmp.mx;
        mtmp2.my = mtmp.my;
        mtmp2.mux = mtmp.mux;
        mtmp2.muy = mtmp.muy;
        mtmp2.mw = mtmp.mw;
        mtmp2.wormno = mtmp.wormno;
        mtmp2.misc_worn_check = mtmp.misc_worn_check;
        mtmp2.weapon_check = mtmp.weapon_check;
        mtmp2.mtrapseen = mtmp.mtrapseen;
        mtmp2.mflee = mtmp.mflee;
        mtmp2.mburied = mtmp.mburied;
        mtmp2.mundetected = mtmp.mundetected;
        mtmp2.mfleetim = mtmp.mfleetim;
        mtmp2.mlstmv = mtmp.mlstmv;
        mtmp2.m_ap_type = mtmp.m_ap_type;
        /* set these ones explicitly */
        mtmp2.mrevived = 1;
        mtmp2.mavenge = 0;
        mtmp2.meating = 0;
        mtmp2.mleashed = 0;
        mtmp2.mtrapped = 0;
        mtmp2.msleeping = 0;
        mtmp2.mfrozen = 0;
        mtmp2.mcanmove = 1;
        /* most cancelled monsters return to normal,
           but some need to stay cancelled */
        if (!dmgtype(mtmp2.data, AD_SEDU)
            && (!SYSOPT_SEDUCE() || !dmgtype(mtmp2.data, AD_SSEX)))
            mtmp2.mcan = 0;
        mtmp2.mcansee = 1; /* set like in makemon */
        mtmp2.mblinded = 0;
        mtmp2.mstun = 0;
        mtmp2.mconf = 0;
        /* when traits are for a shopkeeper, dummy monster 'mtmp' won't
           have necessary eshk data for replmon() -> replshk() */
        if (mtmp2.isshk) {
            neweshk(mtmp);
            struct_assign(ESHK(mtmp), ESHK(mtmp2));
            if (ESHK(mtmp2).bill_p != null
                && ESHK(mtmp2).bill_p != view_of(struct_bill_x, unsigned(-1000)))
                ESHK(mtmp).bill_p = (ESHK(mtmp).bill[0]);
            mtmp.isshk = 1;
        }
        replmon(mtmp, mtmp2);
        newsym(mtmp2.mx, mtmp2.my); /* Might now be invisible */

        /* in case Protection_from_shape_changers is different
           now than it was when the traits were stored */
        restore_cham(mtmp2);
    }
    return mtmp2;
}

/*
 * get_container_location() returns the following information
 * about the outermost container:
 * loc argument gets set to:
 *      OBJ_INVENT      if in hero's inventory; return 0.
 *      OBJ_FLOOR       if on the floor; return 0.
 *      OBJ_BURIED      if buried; return 0.
 *      OBJ_MINVENT     if in monster's inventory; return monster.
 * container_nesting is updated with the nesting depth of the containers
 * if applicable.
 */
export function get_container_location(
    obj,
    loc,
    container_nesting) { /* struct monst * */
    if (container_nesting)
        container_nesting[0] = 0;
    while (obj && obj.where == OBJ_CONTAINED) {
        if (container_nesting)
            container_nesting[0] += 1;
        obj = obj.v.v_ocontainer;
    }
    if (obj) {
        loc[0] = obj.where; /* outermost container's location */
        if (obj.where == OBJ_MINVENT)
            return obj.v.v_ocarry;
    }
    return null;
}

/* can zombie dig the location at x,y */
function zombie_can_dig(x, y) { /* boolean */
    if (isok(x, y)) {
        let typ = levl()[x][y].typ;
        let ttmp;

        if ((ttmp = t_at(x, y)) != null)
            return FALSE;
        if (typ == ROOM || typ == CORR || typ == GRAVE)
            return TRUE;
    }
    return FALSE;
}

/*
 * Attempt to revive the given corpse, return the revived monster if
 * successful.  Note: this does NOT use up the corpse if it fails.
 * If corpse->quan is more than 1, only one corpse will be affected
 * and only one monster will be resurrected.
 */
export function revive(corpse, by_hero) { /* struct monst * */
    const $frame = stack_frame(); try {
    let mtmp = null;
    let mptr;
    let container;
    let xy = stack_struct(struct_nhcoord);
    let x = stack_var(coordxy), y = stack_var(coordxy);
    let one_of;
    let mmflags = NO_MINVENT | MM_NOWAIT | MM_NOMSG;
    let montype = stack_var(int), cgend, container_nesting = stack_var(int, 0);
    let is_zomb;

    if (corpse.otyp != CORPSE) {
        impossible(_("Attempting to revive %s?"), xname(corpse));
        return null;
    }
    montype[0] = corpse.corpsenm;
    /* treat buried auto-reviver (troll, Rider?) like a zombie
       so that it can dig itself out of the ground if it revives */
    is_zomb = +(mons[montype[0]].mlet == S_ZOMBIE
              || (corpse.where == OBJ_BURIED && is_reviver(mons[montype[0]])));

    /* if this corpse is being eaten, stop doing that; this should be done
       after makemon() succeeds and skipped if it fails, but waiting until
       we know the result for that would be too late */
    cant_finish_meal(corpse);

    x[0] = y[0] = 0;
    if (corpse.where != OBJ_CONTAINED) {
        let locflags = is_zomb ? BURIED_TOO : 0;

        /* only for invent, minvent, or floor, or if zombie, buried */
        container = null;
        get_obj_location(corpse, x, y, locflags);
    } else {
        /* deal with corpses in [possibly nested] containers */
        let carrier;
        let holder = stack_var(int, OBJ_FREE);

        container = corpse.v.v_ocontainer;
        carrier =
            get_container_location(container, holder, container_nesting);
        switch (holder[0]) {
        case OBJ_MINVENT:
            x[0] = carrier.mx, y[0] = carrier.my;
            break;
        case OBJ_INVENT:
            x[0] = u.ux, y[0] = u.uy;
            break;
        case OBJ_FLOOR:
            get_obj_location(corpse, x, y, CONTAINED_TOO);
            break;
        default:
            break; /* x,y are 0 */
        }
    }
    if (x[0]) /* update corpse's location now that we're sure where it is */
        corpse.ox = x[0], corpse.oy = y[0];

    if (!x[0]
        /* Rules for revival from containers:
         *  - the container cannot be locked
         *  - the container cannot be heavily nested (>2 is arbitrary)
         *  - the container cannot be a statue or bag of holding
         *    (except in very rare cases for the latter)
         */
        || (container && (container.olocked || container_nesting[0] > 2
                          || container.otyp == STATUE
                          || (container.otyp == BAG_OF_HOLDING && rn2(40))))
        /* if buried zombie cannot dig itself out, do not revive */
        || (is_zomb && corpse.where == OBJ_BURIED && !zombie_can_dig(x[0], y[0])))
        return null;

    /* prepare for the monster */
    mptr = mons[montype[0]];
    /* [should probably handle recorporealization first; if corpse and
       ghost are at same location, revived creature shouldn't be bumped
       to an adjacent spot by ghost which joins with it] */
    if (MON_AT(x[0], y[0])) {
        if (enexto(xy, x[0], y[0], mptr))
            x[0] = xy.x, y[0] = xy.y;
    }

    if (corpse.oeroded2
        || (mons[montype[0]].mlet == S_EEL && !IS_POOL(levl()[x[0]][y[0]].typ))) {
        if (cansee(x[0], y[0]))
            pline(_("%s twitches feebly."),
                upstart(corpse_xname(corpse, 0, CXN_PFX_THE)));
        return null;
    }

    /* applicable when montraits/corpse->oextra->omonst aren't used */
    cgend = (corpse.spe & CORPSTAT_GENDER);
    if (cgend == CORPSTAT_MALE)
        mmflags = or64(mmflags, MM_MALE);
    else if (cgend == CORPSTAT_FEMALE)
        mmflags = or64(mmflags, MM_FEMALE);

    if (cant_revive(montype, TRUE, corpse)) {
        /* make a zombie or doppelganger instead */
        /* note: montype has changed; mptr keeps old value for newcham() */
        mtmp = makemon(mons[montype[0]], x[0], y[0], mmflags);
        if (mtmp) {
            /* skip ghost handling */
            if (has_omid(corpse))
                free_omid(corpse);
            if (has_omonst(corpse))
                free_omonst(corpse);
            if (mtmp.cham == PM_DOPPELGANGER) {
                /* change shape to match the corpse */
                newcham(mtmp, mptr, NO_NC_FLAGS);
            } else if (mtmp.data.mlet == S_ZOMBIE) {
                mtmp.mhp = mtmp.mhpmax = 100;
                mon_adjust_speed(mtmp, 2, null); /* MFAST */
            }
        }
    } else if (has_omonst(corpse)) {
        /* use saved traits */
        xy.x = x[0], xy.y = y[0];
        mtmp = montraits(corpse, xy, FALSE);
        if (mtmp && mtmp.mtame && !mtmp.isminion)
            wary_dog(mtmp, TRUE);
    } else {
        /* make a new monster */
        mtmp = makemon(mptr, x[0], y[0], or64(mmflags, MM_NOCOUNTBIRTH));
    }
    if (!mtmp)
        return null;

    /* hiders shouldn't already be re-hidden when they revive */
    if (mtmp.mundetected) {
        mtmp.mundetected = 0;
        newsym(mtmp.mx, mtmp.my);
    }
    if (M_AP_TYPE(mtmp))
        seemimic(mtmp);

    one_of = +(corpse.quan > 1);
    if (one_of)
        corpse = splitobj(corpse, 1);

    /* if this is caused by the hero there might be a shop charge */
    if (by_hero) {
        let shkp = null;

        x[0] = corpse.ox, y[0] = corpse.oy;
        if (costly_spot(x[0], y[0])
            && (carried(corpse) ? corpse.unpaid : !corpse.no_charge))
            shkp = shop_keeper(chars[in_rooms(x[0], y[0], SHOPBASE)]);

        if (cansee(x[0], y[0])) {
            let buf = stack_array(char, BUFSZ);

            strcpy(buf, one_of ? _("one of ") : _(""));
            /* shk_your: "the " or "your " or "<mon>'s " or "<Shk>'s ".
               If the result is "Shk's " then it will be ambiguous:
               is Shk the mon carrying it, or does Shk's shop own it?
               Let's not worry about that... */
            shk_your(eos(buf), corpse);
            if (one_of)
                corpse.quan++; /* force plural */
            strcat(buf, corpse_xname(corpse, 0, CXN_NO_PFX));
            if (one_of) /* could be simplified to ''corpse->quan = 1L;'' */
                corpse.quan--;
            pline(_("%s glows iridescently."), upstart(buf));
            iflags.last_msg = PLNMSG_OBJ_GLOWS; /* usually for BUC change */
        } else if (shkp) {
            /* need some prior description of the corpse since
               stolen_value() will refer to the object as "it" */
            pline(_("A corpse is resuscitated."));
        }
        /* don't charge for shopkeeper's own corpse if we just revived him */
        if (shkp && mtmp != shkp)
            stolen_value(corpse, x[0], y[0], shkp.mpeaceful,
                                FALSE);

        /* [we don't give any comparable message about the corpse for
           the !by_hero case because caller might have already done so] */
    }

    /* handle recorporealization of an active ghost */
    if (has_omid(corpse)) {
        let m_id;
        let ghost;
        let otmp;

        m_id = OMID(corpse);
        ghost = find_mid(m_id, FM_FMON);
        if (ghost && ghost.data == mons[PM_GHOST]) {
            if (canseemon(ghost))
                pline(_("%s is suddenly drawn into its former body!"),
                      Monnam(ghost));
            /* transfer the ghost's inventory along with it */
            while ((otmp = ghost.minvent) != null) {
                obj_extract_self(otmp);
                add_to_minv(mtmp, otmp);
            }
            /* tame the revived monster if its ghost was tame */
            if (ghost.mtame && !mtmp.mtame) {
                if (tamedog(mtmp, null, FALSE)) {
                    /* ghost's edog data is ignored */
                    mtmp.mtame = ghost.mtame;
                }
            }
            /* was ghost, now alive, it's all very confusing */
            mtmp.mconf = 1;
            /* separate ghost monster no longer exists */
            mongone(ghost);
        }
        free_omid(corpse);
    }

    /* monster retains its name */
    if (has_oname(corpse) && !unique_corpstat(mtmp.data))
        mtmp = christen_monst(mtmp, ONAME(corpse));
    /* partially eaten corpse yields wounded monster */
    if (corpse.oeaten)
        mtmp.mhp = eaten_stat(mtmp.mhp, corpse);
    /* track that this monster was revived at least once */
    mtmp.mrevived = 1;

    /* finally, get rid of the corpse--it's gone now */
    switch (corpse.where) {
    case OBJ_INVENT:
        useup(corpse);
        break;
    case OBJ_FLOOR:
        /* not useupf(), which charges;
           delobj() won't use up a Rider's corpse, delobj_core(,TRUE) will */
        delobj_core(corpse, TRUE); /* for floor, also calls newsym() */
        break;
    case OBJ_MINVENT:
        m_useup(corpse.v.v_ocarry, corpse);
        break;
    case OBJ_CONTAINED:
        /* obj_extract_self() will update corpse->ocontainer->owt */
        obj_extract_self(corpse);
        obfree(corpse, null);
        break;
    case OBJ_BURIED:
        if (is_zomb) {
            obj_extract_self(corpse);
            obfree(corpse, null);
            break;
        }
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case OBJ_FREE:
    case OBJ_MIGRATING:
    case OBJ_ONBILL:
    case OBJ_LUAFREE:
    default:
        panic(_("revive default case %d"), corpse.where);
    }

    return mtmp;
    } finally { stack_pop($frame); }
}

function revive_egg(obj) { /* void */ /* nonnull */
    /*
     * Note: generic eggs with corpsenm set to NON_PM will never hatch.
     */
    if (obj.otyp != EGG)
        return;
    if (obj.corpsenm != NON_PM && !dead_species(obj.corpsenm, TRUE))
        attach_egg_hatch_timeout(obj, 0);
}

/* try to revive all corpses and eggs carried by `mon' */
export function unturn_dead(mon) { /* int */
    const $frame = stack_frame(); try {
    let otmp, otmp2;
    let mtmp2;
    let owner = stack_array(char, BUFSZ), corpse = stack_array(char, BUFSZ);
    let save_norevive;
    let youseeit, different_type, is_u = +(mon == gy.youmonst);
    let corpsenm, res = 0;

    youseeit = is_u ? TRUE : canseemon(mon);
    otmp2 = is_u ? gi.invent : mon.minvent;
    chars[owner + 0] = chars[corpse + 0] = ord('\0'); /* lint suppression */

    while ((otmp = otmp2) != null) {
        otmp2 = otmp.nobj;
        if (otmp.otyp == EGG)
            revive_egg(otmp);
        if (otmp.otyp != CORPSE)
            continue;
        /* save the name; the object is liable to go away */
        if (youseeit) {
            strcpy(corpse, corpse_xname(otmp, 0, CXN_NORMAL));
            /* shk_your/Shk_Your produces a value with a trailing space */
            if (otmp.quan > 1) {
                strcpy(owner, _("One of "));
                shk_your(eos(owner), otmp);
            } else
                Shk_Your(owner, otmp);
        }
        /* for a stack, only one is revived; if is_u, revive() calls
           useup() which calls update_inventory() but not encumber_msg() */
        corpsenm = otmp.corpsenm;
        /* norevive applies to revive timer, not to explicit unturn_dead() */
        save_norevive = otmp.oeroded2;
        otmp.oeroded2 = 0;

        if ((mtmp2 = revive(otmp, +!svc.context.mon_moving)) != null) {
            ++res;
            /* might get revived as a zombie rather than corpse's monster */
            different_type = +(mtmp2.data != mons[corpsenm]);
            if (iflags.last_msg == PLNMSG_OBJ_GLOWS) {
                /* when hero zaps undead turning at self (or breaks
                   non-empty wand), revive() reports "[one of] your <mon>
                   corpse[s] glows iridescently"; override saved corpse
                   and owner names to say "It comes alive" [note: we did
                   earlier setup because corpse gets used up but need to
                   do the override here after revive() sets 'last_msg'] */
                strcpy(corpse, _("It"));
                chars[owner + 0] = ord('\0');
            }
            if (youseeit)
                pline(_("%s%s suddenly %s%s%s!"), owner, corpse,
                      nonliving(mtmp2.data) ? _("reanimates") : _("comes alive"),
                      different_type ? _(" as ") : _(""),
                      different_type ? an(mon_pmname(mtmp2)) : _(""));
            else if (canseemon(mtmp2))
                pline(_("%s suddenly appears!"), Amonnam(mtmp2));
        } else {
            /* revival failed; corpse 'otmp' is intact */
            otmp.oeroded2 = save_norevive ? 1 : 0;
        }
    }
    if (is_u && res)
        encumber_msg();

    return res;
    } finally { stack_pop($frame); }
}

export function unturn_you() { /* void */
    unturn_dead(gy.youmonst); /* hit carried corpses and eggs */

    if (is_undead(gy.youmonst.data)) {
        You_feel(_("frightened and %sstunned."), Stunned() ? _("even more ") : _(""));
        make_stunned((HStun() & TIMEOUT) + rnd(30), FALSE);
    } else {
        You(_("shudder in dread."));
    }
}

/* cancel obj, possibly carried by you or a monster */
export function cancel_item(obj) { /* void */
    const $frame = stack_frame(); try {
    let otyp = obj.otyp;

    if (carried(obj)) {
        /* handle items being worn by hero */
        switch (otyp) {
        case RIN_GAIN_STRENGTH:
            if ((obj.owornmask & W_RING) != 0) {
                (chars[u.abon.a + A_STR]) -= obj.spe;
                disp.botl = TRUE;
            }
            break;
        case RIN_GAIN_CONSTITUTION:
            if ((obj.owornmask & W_RING) != 0) {
                (chars[u.abon.a + A_CON]) -= obj.spe;
                disp.botl = TRUE;
            }
            break;
        case RIN_ADORNMENT:
            if ((obj.owornmask & W_RING) != 0) {
                (chars[u.abon.a + A_CHA]) -= obj.spe;
                disp.botl = TRUE;
            }
            break;
        case RIN_INCREASE_ACCURACY:
            if ((obj.owornmask & W_RING) != 0)
                u.uhitinc -= obj.spe;
            break;
        case RIN_INCREASE_DAMAGE:
            if ((obj.owornmask & W_RING) != 0)
                u.udaminc -= obj.spe;
            break;
        case RIN_PROTECTION:
            if ((obj.owornmask & W_RING) != 0)
                disp.botl = TRUE;
            break;
        case GAUNTLETS_OF_DEXTERITY:
            if ((obj.owornmask & W_ARMG) != 0) {
                (chars[u.abon.a + A_DEX]) -= obj.spe;
                disp.botl = TRUE;
            }
            break;
        case HELM_OF_BRILLIANCE:
            if ((obj.owornmask & W_ARMH) != 0) {
                (chars[u.abon.a + A_INT]) -= obj.spe;
                (chars[u.abon.a + A_WIS]) -= obj.spe;
                disp.botl = TRUE;
            }
            break;
        default:
            if ((obj.owornmask & W_ARMOR) != 0) /* AC */
                disp.botl = TRUE;
            break;
        }
    }
    /* cancelled item might not be in hero's possession but
       cancellation is presumed to be instigated by hero */
    if (objects[otyp].oc_magic
        || (obj.spe && (obj.oclass == ARMOR_CLASS
                         || obj.oclass == WEAPON_CLASS || is_weptool(obj)))
        || otyp == POT_ACID
        || otyp == POT_SICKNESS
        || (otyp == POT_WATER && (obj.blessed || obj.cursed))
        /* not magic; cancels to blank spellbook */
        || otyp == SPE_NOVEL) {
        let cancelled_spe = (obj.oclass == WAND_CLASS
                             || otyp == CRYSTAL_BALL) ? -1 : 0;

        if (obj.spe != cancelled_spe
            && otyp != WAN_CANCELLATION /* can't cancel cancellation */
            && otyp != MAGIC_LAMP /* cancelling doesn't remove djinni */
            && otyp != CANDELABRUM_OF_INVOCATION) {
            costly_alteration(obj, COST_CANCEL);
            obj.spe = cancelled_spe;
        }
        switch (obj.oclass) {
        case SCROLL_CLASS:
            costly_alteration(obj, COST_CANCEL);
            obj.otyp = SCR_BLANK_PAPER;
            obj.spe = 0;
            break;
        case SPBOOK_CLASS:
            if (otyp != SPE_CANCELLATION && otyp != SPE_BOOK_OF_THE_DEAD) {
                costly_alteration(obj, COST_CANCEL);
                obj.otyp = SPE_BLANK_PAPER;
                /* cancelling a novel is more involved than a spellbook */
                if (otyp == SPE_NOVEL) /* old type */
                    blank_novel(obj);
            }
            break;
        case POTION_CLASS:
            costly_alteration(obj, (otyp != POT_WATER) ? COST_CANCEL
                                   : obj.cursed ? COST_UNCURS : COST_UNBLSS);
            if (otyp == POT_SICKNESS || otyp == POT_SEE_INVISIBLE) {
                /* sickness is "biologically contaminated" fruit juice;
                   cancel it and it just becomes fruit juice...
                   whereas see invisible tastes like "enchanted" fruit
                   juice, it similarly cancels */
                obj.otyp = POT_FRUIT_JUICE;
            } else {
                obj.otyp = POT_WATER;
                obj.oeroded = 0; /* same as any other water */
            }
            break;
        }
    }
    /* cancelling a troll's corpse prevents it from reviving (on its own;
       does not affect undead turning induced revival) */
    if (obj.otyp == CORPSE && obj.timed
        && !is_rider(mons[obj.corpsenm])) {
        let a = struct_assign(stack_struct(struct_any), obj_to_any(obj));
        let timout = peek_timer(REVIVE_MON, a);

        if (timout) {
            stop_timer(REVIVE_MON, a);
            start_timer(timout, TIMER_OBJECT, ROT_CORPSE, a);
        }
    }

    unbless(obj);
    uncurse(obj);
    return;
    } finally { stack_pop($frame); }
}

/* soaking or cancelling a novel converts it into a blank spellbook but
   needs more than just changing its otyp (caller is responsible for that) */
export function blank_novel(obj) { /* void */
    assert(obj.otyp == SPE_BLANK_PAPER);
    /* novelidx overloads corpsenm, not used for spellbooks */
    obj.corpsenm = 0;
    free_oname(obj); /* get rid of [former] novel's title */
    /* a blank spellbook weighs more than a novel; update obj's weight and
       recursively the weight of any container holding it */
    container_weight(obj);
}

/* Remove a positive enchantment or charge from obj,
 * possibly carried by you or a monster
 */
export function drain_item(obj, by_you) { /* boolean */
    let u_ring;

    /* Is this a charged/enchanted object? */
    if (!obj
        || (!objects[obj.otyp].oc_charged && obj.oclass != WEAPON_CLASS
            && obj.oclass != ARMOR_CLASS && !is_weptool(obj))
        || obj.spe <= 0)
        return FALSE;
    if (defends(AD_DRLI, obj) || defends_when_carried(AD_DRLI, obj)
        || obj_resists(obj, 10, 90))
        return FALSE;

    /* Charge for the cost of the object */
    if (by_you)
        costly_alteration(obj, COST_DRAIN);

    /* Drain the object and any implied effects */
    obj.spe--;
    u_ring = +((obj == uleft) || (obj == uright));
    switch (obj.otyp) {
    case RIN_GAIN_STRENGTH:
        if ((obj.owornmask & W_RING) && u_ring) {
            (chars[u.abon.a + A_STR])--;
            disp.botl = TRUE;
        }
        break;
    case RIN_GAIN_CONSTITUTION:
        if ((obj.owornmask & W_RING) && u_ring) {
            (chars[u.abon.a + A_CON])--;
            disp.botl = TRUE;
        }
        break;
    case RIN_ADORNMENT:
        if ((obj.owornmask & W_RING) && u_ring) {
            (chars[u.abon.a + A_CHA])--;
            disp.botl = TRUE;
        }
        break;
    case RIN_INCREASE_ACCURACY:
        if ((obj.owornmask & W_RING) && u_ring)
            u.uhitinc--;
        break;
    case RIN_INCREASE_DAMAGE:
        if ((obj.owornmask & W_RING) && u_ring)
            u.udaminc--;
        break;
    case RIN_PROTECTION:
        if (u_ring)
            disp.botl = TRUE; /* bot() will recalc u.uac */
        break;
    case HELM_OF_BRILLIANCE:
        if ((obj.owornmask & W_ARMH) && (obj == uarmh)) {
            (chars[u.abon.a + A_INT])--;
            (chars[u.abon.a + A_WIS])--;
            disp.botl = TRUE;
        }
        break;
    case GAUNTLETS_OF_DEXTERITY:
        if ((obj.owornmask & W_ARMG) && (obj == uarmg)) {
            (chars[u.abon.a + A_DEX])--;
            disp.botl = TRUE;
        }
        break;
    default:
        break;
    }
    if (disp.botl)
        bot();
    if (carried(obj))
        update_inventory();
    return TRUE;
}

export function obj_resists(obj,
            ochance,
            achance) { /* boolean */ /* percent chance for artifacts */
    if (obj.otyp == AMULET_OF_YENDOR
        || obj.otyp == SPE_BOOK_OF_THE_DEAD
        || obj.otyp == CANDELABRUM_OF_INVOCATION
        || obj.otyp == BELL_OF_OPENING
        || (obj.otyp == CORPSE && is_rider(mons[obj.corpsenm]))) {
        return TRUE;
    } else {
        let chance = rn2(100);

        return (+(chance < (obj.oartifact ? achance : ochance)));
    }
}

export function obj_shudders(obj) { /* boolean */
    let zap_odds;

    if (svc.context.bypasses && obj.bypass)
        return FALSE;

    if (obj.oclass == WAND_CLASS)
        zap_odds = 3; /* half-life = 2 zaps */
    else if (obj.cursed)
        zap_odds = 3; /* half-life = 2 zaps */
    else if (obj.blessed)
        zap_odds = 12; /* half-life = 8 zaps */
    else
        zap_odds = 8; /* half-life = 6 zaps */

    /* adjust for "large" quantities of identical things */
    if (obj.quan > 4)
        zap_odds = Math.trunc(zap_odds / 2);

    return (+!rn2(zap_odds));
}

/* Use up at least minwt number of things made of material mat.
 * There's also a chance that other stuff will be used up.  Finally,
 * there's a random factor here to keep from always using the stuff
 * at the top of the pile.
 */
function polyuse(objhdr, mat, minwt) { /* void */
    let otmp, otmp2;

    for (otmp = objhdr; minwt > 0 && otmp; otmp = otmp2) {
        otmp2 = otmp.v.v_nexthere;
        if (svc.context.bypasses && otmp.bypass)
            continue;
        if (otmp == uball || otmp == uchain)
            continue;
        if (obj_resists(otmp, 0, 0))
            continue; /* preserve unique objects */

        if (otmp.otyp == SCR_MAIL)
            continue;

        if (+((objects[otmp.otyp].oc_material) == mat)
            == +(rn2(minwt + 1) != 0)) {
            /* appropriately add damage to bill */
            if (costly_spot(otmp.ox, otmp.oy)) {
                if (chars[u.ushops])
                    addtobill(otmp, FALSE, FALSE, FALSE);
                else
                    stolen_value(otmp, otmp.ox, otmp.oy, FALSE,
                                        FALSE);
            }
            if (otmp.quan < LARGEST_INT)
                minwt -= int(otmp.quan);
            else
                minwt = 0;
            delobj(otmp);
        }
    }
}

/*
 * Polymorph some of the stuff in this pile into a monster, preferably
 * a golem of the kind okind.
 */
function create_polymon(obj, okind) { /* void */
    let mdat = null;
    let mtmp;
    let material;
    let pm_index;

    if (svc.context.bypasses) {
        /* this is approximate because the "no golems" !obj->nexthere
           check below doesn't understand bypassed objects; but it
           should suffice since bypassed objects always end up as a
           consecutive group at the top of their pile */
        while (obj && obj.bypass)
            obj = obj.v.v_nexthere;
    }

    /* no golems if you zap only one object -- not enough stuff */
    if (!obj || (!obj.v.v_nexthere && obj.quan == 1))
        return;

    /* some of these choices are arbitrary */
    switch (okind) {
    case IRON:
    case METAL:
    case MITHRIL:
        pm_index = PM_IRON_GOLEM;
        material = _("metal ");
        break;
    case COPPER:
    case SILVER:
    case PLATINUM:
    case GEMSTONE:
    case MINERAL:
        pm_index = rn2(2) ? PM_STONE_GOLEM : PM_CLAY_GOLEM;
        material = _("lithic ");
        break;
    case 0:
    case FLESH:
        /* there is no flesh type, but all food is type 0, so we use it */
        pm_index = PM_FLESH_GOLEM;
        material = _("organic ");
        break;
    case WOOD:
        pm_index = PM_WOOD_GOLEM;
        material = _("wood ");
        break;
    case LEATHER:
        pm_index = PM_LEATHER_GOLEM;
        material = _("leather ");
        break;
    case CLOTH:
        pm_index = PM_ROPE_GOLEM;
        material = _("cloth ");
        break;
    case BONE:
        pm_index = PM_SKELETON; /* nearest thing to "bone golem" */
        material = _("bony ");
        break;
    case GOLD:
        pm_index = PM_GOLD_GOLEM;
        material = _("gold ");
        break;
    case GLASS:
        pm_index = PM_GLASS_GOLEM;
        material = _("glassy ");
        break;
    case PAPER:
        pm_index = PM_PAPER_GOLEM;
        material = _("paper ");
        break;
    default:
        /* if all else fails... */
        pm_index = PM_STRAW_GOLEM;
        material = _("");
        break;
    }

    if (!(svm.mvitals[pm_index].mvflags & G_GENOD))
        mdat = mons[pm_index];

    mtmp = makemon(mdat, obj.ox, obj.oy, MM_NOMSG);
    polyuse(obj, okind, int((mons[pm_index].cwt)));

    if (mtmp && cansee(mtmp.mx, mtmp.my)) {
        pline(_("Some %sobjects meld, and %s arises from the pile!"), material,
              a_monnam(mtmp));
    }
}

/* Assumes obj is on the floor. */
export function do_osshock(obj) { /* void */
    let i;

    if (obj.otyp == SCR_MAIL)
        return;

    go.obj_zapped = TRUE;

    if (gp.poly_zapped < 0) {
        /* some may metamorphose */
        for (i = obj.quan; i; i--)
            if (!rn2(Luck() + 45)) {
                gp.poly_zapped = objects[obj.otyp].oc_material;
                break;
            }
    }

    /* if quan > 1 then some will survive intact */
    if (obj.quan > 1) {
        if (obj.quan > LARGEST_INT)
            obj = splitobj(obj, rnd(30000));
        else
            obj = splitobj(obj, rnd(int(obj.quan) - 1));
    }

    /* appropriately add damage to bill */
    if (costly_spot(obj.ox, obj.oy)) {
        if (chars[u.ushops])
            addtobill(obj, FALSE, FALSE, FALSE);
        else
            stolen_value(obj, obj.ox, obj.oy, FALSE, FALSE);
    }

    /* zap the object */
    delobj(obj);
}

/* Returns TRUE if obj resists polymorphing */
export function obj_unpolyable(obj) { /* boolean */
    return (unpolyable(obj)
            || obj == uball || obj == uskin
            || obj_resists(obj, 5, 95) ? 1 : 0);
}

/* classes of items whose current charge count carries over across polymorph
 */
const charged_objs = static_array("charged_objs", char, null, [ WAND_CLASS, WEAPON_CLASS, ARMOR_CLASS,
                                     ord('\0') ]);

/*
 * Polymorph the object to the given object ID.  If the ID is STRANGE_OBJECT
 * then pick random object from the source's class (this is the standard
 * "polymorph" case).  If ID is set to a specific object, inhibit fusing
 * n objects into 1.  This could have been added as a flag, but currently
 * it is tied to not being the standard polymorph case. The new polymorphed
 * object replaces obj in its link chains.  Return value is a pointer to
 * the new object.
 *
 * This should be safe to call for an object anywhere.
 */
export function poly_obj(obj, id) { /* struct obj * */
    const $frame = stack_frame(); try {
    let otmp;
    let ox = stack_var(coordxy, 0), oy = stack_var(coordxy, 0);
    let old_wornmask, new_wornmask = 0;
    let can_merge = +(id == STRANGE_OBJECT);
    let obj_location = obj.where;

    if (obj.otyp == BOULDER)
        sokoban_guilt();
    if (id == STRANGE_OBJECT) { /* preserve symbol */
        let try_limit = 3;
        let magic_obj = objects[obj.otyp].oc_magic;

        if (obj.otyp == UNICORN_HORN && obj.obroken)
            magic_obj = 0;
        /* Try up to 3 times to make the magic-or-not status of
           the new item the same as the old item. */
        otmp = null;
        do {
            if (otmp)
                delobj(otmp);
            otmp = mkobj(obj.oclass, FALSE);
        } while (--try_limit > 0
                 && objects[otmp.otyp].oc_magic != magic_obj);
    } else {
        /* literally replace obj with this new thing */
        otmp = mksobj(id, FALSE, FALSE);
/* Actually more things use corpsenm but they polymorph differently */

        if (USES_CORPSENM(obj.otyp) && USES_CORPSENM(id))
            set_corpsenm(otmp, obj.corpsenm);
    }

    /* preserve quantity */
    otmp.quan = obj.quan;
    /* preserve the shopkeeper's (lack of) interest */
    otmp.no_charge = obj.no_charge;
    /* preserve inventory letter if in inventory */
    if (obj_location == OBJ_INVENT)
        otmp.invlet = obj.invlet;

    /* You can't send yourself 100 mail messages and then
     * polymorph them into useful scrolls
     */
    if (obj.otyp == SCR_MAIL) {
        otmp.otyp = SCR_MAIL;
        otmp.spe = 1;
    }

    /* avoid abusing eggs laid by you */
    if (obj.otyp == EGG && obj.spe) {
        let mnum, tryct = 100;

        /* first, turn into a generic egg */
        if (otmp.otyp == EGG)
            kill_egg(otmp);
        else {
            otmp.otyp = EGG;
            otmp.owt = unsigned(weight(otmp));
        }
        otmp.corpsenm = NON_PM;
        otmp.spe = 0;

        /* now change it into something laid by the hero */
        while (tryct--) {
            mnum = can_be_hatched(random_monster(rn2));
            if (mnum != NON_PM && !dead_species(mnum, TRUE)) {
                otmp.spe = 1;            /* laid by hero */
                set_corpsenm(otmp, mnum); /* also sets hatch timer */
                break;
            }
        }
    }

    /* keep special fields (including charges on wands) */
    if (strchr(charged_objs, otmp.oclass))
        otmp.spe = obj.spe;
    otmp.recharged = obj.recharged;

    otmp.cursed = obj.cursed;
    otmp.blessed = obj.blessed;

    if (erosion_matters(otmp)) {
        if (is_flammable(otmp) || is_rustprone(otmp) || is_crackable(otmp))
            otmp.oeroded = obj.oeroded;
        if (is_corrodeable(otmp) || is_rottable(otmp))
            otmp.oeroded2 = obj.oeroded2;
        if (is_damageable(otmp))
            otmp.oerodeproof = obj.oerodeproof;
    }

    /* Keep chest/box traps and poisoned ammo if we may */
    if (obj.otrapped && Is_box(otmp))
        otmp.otrapped = 1;
    if (obj.otrapped && is_poisonable(otmp))
        otmp.otrapped = 1;

    if (id == STRANGE_OBJECT && obj.otyp == CORPSE) {
        /* turn crocodile corpses into shoes */
        if (obj.corpsenm == PM_CROCODILE) {
            otmp.otyp = LOW_BOOTS;
            otmp.oclass = ARMOR_CLASS;
            otmp.spe = 0;
            otmp.oeroded = 0;
            otmp.oerodeproof = TRUE;
            otmp.quan = 1;
            otmp.cursed = FALSE;
        }
    }
    if (obj.otyp == LEASH && obj.corpsenm != 0) {
        if (otmp.otyp == LEASH) {
            otmp.corpsenm = obj.corpsenm;
            /* clear m_id before delobj(), to avoid o_unleash() by obfree() */
            obj.corpsenm = 0;
        } else {
            /* obfree() would do this if we didn't do it here */
            o_unleash(obj);
        }
    }

    /* no box contents --KAA */
    if (Has_contents(otmp))
        delete_contents(otmp);

    /* 'n' merged objects may be fused into 1 object */
    if (otmp.quan > 1 && (!objects[otmp.otyp].oc_merge
                            || (can_merge && otmp.quan > rn2(1000))))
        otmp.quan = 1;

    switch (otmp.oclass) {
    case TOOL_CLASS:
        if (otmp.otyp == MAGIC_LAMP) {
            otmp.otyp = OIL_LAMP;
            otmp.age = 1500; /* "best" oil lamp possible */
        } else if (otmp.otyp == MAGIC_MARKER) {
            otmp.recharged = 1; /* degraded quality */
        }
        /* don't care about the recharge count of other tools */
        break;

    case WAND_CLASS:
        while (otmp.otyp == WAN_WISHING || otmp.otyp == WAN_POLYMORPH)
            otmp.otyp = rnd_class(WAN_LIGHT, WAN_LIGHTNING);
        /* altering the object tends to degrade its quality
           (analogous to spellbook `read count' handling) */
        if (otmp.recharged < rn2(7)) /* recharge_limit */
            otmp.recharged++;
        break;

    case POTION_CLASS:
        while (otmp.otyp == POT_POLYMORPH)
            otmp.otyp = rnd_class(POT_GAIN_ABILITY, POT_WATER);
        /* potions of oil use obj->age field differently from other potions */
        if (otmp.otyp == POT_OIL || obj.otyp == POT_OIL)
            fixup_oil(otmp, obj);
        break;

    case SPBOOK_CLASS:
        while (otmp.otyp == SPE_POLYMORPH)
            otmp.otyp = rnd_class(svb.bases[SPBOOK_CLASS], SPE_BLANK_PAPER);
        /* reduce spellbook abuse; non-blank books degrade;
           5.0: novels don't use spestudied so shouldn't degrade to blank
           (but don't force spestudied to zero for them since a non-zero
           value could get passed along to a future polymorph) */
        if (otmp.otyp != SPE_BLANK_PAPER && otmp.otyp != SPE_NOVEL) {
            otmp.usecount = obj.usecount + 1;
            if (otmp.usecount > MAX_SPELL_STUDY) {
                otmp.otyp = SPE_BLANK_PAPER;
                /* writing a new book over it will yield an unstudied
                   one; re-polymorphing this one as-is may or may not
                   get something non-blank */
                otmp.usecount = rn2(otmp.usecount);
            }
        }
        break;

    case GEM_CLASS:
        if (otmp.quan > rnd(4)
            && objects[obj.otyp].oc_material == MINERAL
            && objects[otmp.otyp].oc_material != MINERAL) {
            otmp.otyp = ROCK; /* transmutation backfired */
            otmp.quan = Math.trunc(otmp.quan / 2);  /* some material has been lost */
        }
        break;
    }

    /* update the weight */
    otmp.owt = unsigned(weight(otmp));

    /*
     * ** we are now done adjusting the object (except possibly wearing it) **
     */

    get_obj_location(obj, ox, oy, BURIED_TOO | CONTAINED_TOO);
    old_wornmask = and64(obj.owornmask, ~(W_ART | W_ARTI));
    /* swap otmp for obj */
    replace_object(obj, otmp);
    if (obj_location == OBJ_INVENT) {
        /*
         * We may need to do extra adjustments for the hero if we're
         * messing with the hero's inventory.  The following calls are
         * equivalent to calling freeinv() on obj and addinv_nomerge()
         * on otmp, while doing an in-place swap of the actual objects.
         */
        freeinv_core(obj);
        addinv_core1(otmp);
        addinv_core2(otmp);
        /*
         * Handle polymorph of worn item.  Stone-to-flesh cast on self can
         * affect multiple objects at once, but their new forms won't
         * produce any side-effects.  A single worn item dipped into potion
         * of polymorph can produce side-effects but those won't yield out
         * of sequence messages because current polymorph is finished.
         */
        if (old_wornmask) {
            let was_twohanded = bimanual(obj), was_twoweap = u.twoweap;

            /* wearslot() expects us to deal with wielded/alt-wep/quivered
               items in case they're not weapons; for other slots it might
               return multiple bits (ring left|right); narrow that down to
               the bit(s) currently in use */
            new_wornmask = ((old_wornmask & W_WEAPONS) != 0) ? old_wornmask
                           : and64(wearslot(otmp), old_wornmask);
            remove_worn_item(obj, TRUE);
            /* if the new form can be worn in the same slot, make it so */
            if ((new_wornmask & W_WEP) != 0) {
                if (was_twohanded || !bimanual(otmp) || !uarms)
                    setuwep(otmp);
                if (was_twoweap && uwep && !bimanual(uwep))
                    set_twoweap(TRUE); /* u.twoweap = TRUE */
            } else if ((new_wornmask & W_SWAPWEP) != 0) {
                if (was_twohanded || !bimanual(otmp))
                    setuswapwep(otmp);
                if (was_twoweap && uswapwep)
                    set_twoweap(TRUE); /* u.twoweap = TRUE */
            } else if ((new_wornmask & W_QUIVER) != 0) {
                setuqwep(otmp);
            } else if (new_wornmask) {
                setworn(otmp, new_wornmask);
                /* set_wear() might result in otmp being destroyed if
                   worn amulet has been turned into an amulet of change */
                set_wear(otmp);
                otmp = wearmask_to_obj(new_wornmask); /* might be Null */
            }
        } /* old_wornmask */
    } else if (obj_location == OBJ_FLOOR) {
        if (obj.otyp == BOULDER && otmp.otyp != BOULDER) {
            if (!does_block(ox[0], oy[0], levl()[ox[0]][oy[0]]))
                unblock_point(ox[0], oy[0]);
        } else if (obj.otyp != BOULDER && otmp.otyp == BOULDER) {
            /* leaving boulder in liquid would trigger sanity_check warning */
            if (is_pool_or_lava(ox[0], oy[0]))
                fracture_rock(otmp);
            if (does_block(ox[0], oy[0], levl()[ox[0]][oy[0]]))
                block_point(ox[0], oy[0]);
        }
    }

    /* note: if otmp is gone, billing for it was handled by useup() */
    if (((otmp && !carried(otmp)) || obj.unpaid) && costly_spot(ox[0], oy[0])) {
        let shkp = shop_keeper(chars[in_rooms(ox[0], oy[0], SHOPBASE)]);

        if ((!obj.no_charge
             || (Has_contents(obj)
                 && (contained_cost(obj, shkp, 0, FALSE, FALSE) != 0)))
            && inhishop(shkp)) {
            if (shkp.mpeaceful) {
                if (chars[u.ushops]
                    && (chars[in_rooms(u.ux, u.uy, 0)]
                        == chars[in_rooms(shkp.mx, shkp.my, 0)])
                    && !costly_spot(u.ux, u.uy)) {
                    make_angry_shk(shkp, ox[0], oy[0]);
                } else {
                    pline(_("%s gets angry!"), Shknam(shkp));
                    hot_pursuit(shkp);
                }
            } else
                Norep(_("%s is furious!"), Shknam(shkp));
        }
    }
    delobj(obj);
    return otmp;
    } finally { stack_pop($frame); }
}
export function USES_CORPSENM(typ) { return +(typ == CORPSE || typ == STATUE || typ == FIGURINE); }

/* stone-to-flesh spell hits and maybe transforms or animates obj */
function stone_to_flesh_obj(obj) { /* int */ /* nonnull */
    const $frame = stack_frame(); try {
    let ptr;
    let mon, shkp;
    let item;
    let oox = stack_var(coordxy), ooy = stack_var(coordxy);
    let smell = FALSE, golem_xform = FALSE;
    let res = 1; /* affected object by default */

    if (objects[obj.otyp].oc_material != MINERAL
        && objects[obj.otyp].oc_material != GEMSTONE)
        return 0;
    /* Heart of Ahriman usually resists; ordinary items rarely do */
    if (obj_resists(obj, 2, 98))
        return 0;

    get_obj_location(obj, oox, ooy, 0);
    /* add more if stone objects are added... */
    switch (objects[obj.otyp].oc_class) {
    case ROCK_CLASS: /* boulders and statues */
    case TOOL_CLASS: /* figurines */
        if (obj.otyp == BOULDER) {
            obj = poly_obj(obj, ENORMOUS_MEATBALL);
            smell = TRUE;
        } else if (obj.otyp == STATUE || obj.otyp == FIGURINE) {
            ptr = mons[obj.corpsenm];
            if (is_golem(ptr)) {
                golem_xform = +(ptr != mons[PM_FLESH_GOLEM]);
            } else if (vegetarian(ptr)) {
                /* Don't animate monsters that aren't flesh */
                obj = poly_obj(obj, MEATBALL);
                smell = TRUE;
                break;
            }
            if (obj.otyp == STATUE) {
                /* animate_statue() forces all golems to become flesh golems */
                mon = animate_statue(obj, oox[0], ooy[0], ANIMATE_SPELL, null);
            } else { /* (obj->otyp == FIGURINE) */
                if (golem_xform)
                    ptr = mons[PM_FLESH_GOLEM];
                mon = makemon(ptr, oox[0], ooy[0], NO_MINVENT|MM_NOMSG);
                if (mon) {
                    if (costly_spot(oox[0], ooy[0])
                        && (carried(obj) ? obj.unpaid : !obj.no_charge)) {
                        shkp = shop_keeper(chars[in_rooms(oox[0], ooy[0], SHOPBASE)]);
                        stolen_value(obj, oox[0], ooy[0],
                                     (shkp && shkp.mpeaceful ? 1 : 0), FALSE);
                    }
                    if (obj.timed)
                        obj_stop_timers(obj);
                    if (carried(obj))
                        useup(obj);
                    else
                        delobj(obj);
                    if (cansee(mon.mx, mon.my))
                        pline_The(_("figurine %sanimates!"),
                                  golem_xform ? _("turns to flesh and ") : _(""));
                }
            }
            if (mon) {
                ptr = mon.data;
                /* this golem handling is redundant... */
                if (is_golem(ptr) && ptr != mons[PM_FLESH_GOLEM])
                    newcham(mon, mons[PM_FLESH_GOLEM],
                                   NC_VIA_WAND_OR_SPELL);
            } else if ((ptr.geno & (G_NOCORPSE | G_UNIQ)) != 0) {
                /* didn't revive but can't leave corpse either */
                res = 0;
            } else {
                /* unlikely to get here since genociding monsters also
                   sets the G_NOCORPSE flag; drop statue's contents */
                while ((item = obj.cobj) != null) {
                    bypass_obj(item); /* make stone-to-flesh miss it */
                    obj_extract_self(item);
                    place_object(item, oox[0], ooy[0]);
                }
                obj = poly_obj(obj, CORPSE);
            }
        } else { /* miscellaneous tool or unexpected rock... */
            res = 0;
        }
        break;
    /* maybe add weird things to become? */
    case RING_CLASS: /* some of the rings are stone */
        obj = poly_obj(obj, MEAT_RING);
        smell = TRUE;
        break;
    case WAND_CLASS: /* marble wand */
        obj = poly_obj(obj, MEAT_STICK);
        smell = TRUE;
        break;
    case GEM_CLASS: /* stones & gems */
        obj = poly_obj(obj, MEATBALL);
        smell = TRUE;
        break;
    case WEAPON_CLASS: /* crysknife */
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    default:
        res = 0;
        break;
    }
    (obj); /* avoid 'assigned value not used' for poly_obj() calls */

    if (smell) {
        /* non-meat eaters smell meat, meat eaters smell its flavor;
           monks are considered non-meat eaters regardless of behavior;
           other roles are non-meat eaters if they haven't broken
           vegetarian conduct yet (or if poly'd into non-carnivorous/
           non-omnivorous form, regardless of whether it's herbivorous,
           non-eating, or something stranger) */
        if (Role_if(PM_MONK) || !u.uconduct.unvegetarian
            || !carnivorous(gy.youmonst.data))
            Norep(_("You smell the odor of meat."));
        else
            Norep(_("You smell a delicious smell."));
    }
    newsym(oox[0], ooy[0]);
    return res;
    } finally { stack_pop($frame); }
}

/*
 * Object obj was hit by the effect of the wand/spell otmp.  Return
 * non-zero if the wand/spell had any effect.
 */
export function bhito(obj, otmp) { /* int */
    const $frame = stack_frame(); try {
    let res = 1; /* affected object by default */
    let learn_it = FALSE, maybelearnit;

    /* fundamental: a wand effect hitting itself doesn't do anything;
       otherwise we need to guard against accessing otmp after something
       strange has happened to it (along the lines of polymorph or
       stone-to-flesh [which aren't good examples since polymorph wands
       aren't affected by polymorph zaps and stone-to-flesh isn't
       available in wand form, but the concept still applies...]) */
    if (obj == otmp)
        return 0;

    if (obj.bypass) {
        /* The bypass bit is currently only used as follows:
         *
         * POLYMORPH - When a monster being polymorphed drops something
         *             from its inventory as a result of the change.
         *             If the items fall to the floor, they are not
         *             subject to direct subsequent polymorphing
         *             themselves on that same zap.  This makes it
         *             consistent with items that remain in the monster's
         *             inventory.  They are not polymorphed either.
         * UNDEAD_TURNING - When an undead creature gets killed via
         *             undead turning, prevent its corpse from being
         *             immediately revived by the same effect.
         * STONE_TO_FLESH - If a statue can't be revived, its
         *             contents get dropped before turning it into
         *             meat; prevent those contents from being hit.
         * retouch_equipment() - bypass flag is used to track which
         *             items have been handled (bhito isn't involved).
         * menu_drop(), askchain() - inventory traversal where multiple
         *             Drop can alter the invent chain while traversal
         *             is in progress (bhito isn't involved).
         * destroy_items() - inventory traversal where item destruction can
         *             trigger drop or destruction of other item(s) and alter
         *             the invent or mon->minvent chain, possibly recursively.
         *
         * The bypass bit on all objects is reset each turn, whenever
         * svc.context.bypasses is set.
         *
         * We check the obj->bypass bit above AND svc.context.bypasses
         * as a safeguard against any stray occurrence left in an obj
         * struct someplace, although that should never happen.
         */
        if (svc.context.bypasses) {
            return 0;
        } else {
            do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(_("%s for a moment."), Tobjnam(obj, _("pulsate"))); iflags.last_msg = save_plnmsg; } } while (0);
            obj.bypass = 0;
        }
    }

    /*
     * Some parts of this function expect the object to be on the floor
     * obj->{ox,oy} to be valid.  The exception to this (so far) is
     * for the STONE_TO_FLESH spell.
     */
    if (!(obj.where == OBJ_FLOOR || otmp.otyp == SPE_STONE_TO_FLESH))
        impossible(_("bhito: obj is not floor or Stone To Flesh spell"));

    if (obj == uball) {
        res = 0;
    } else if (obj == uchain) {
        if (otmp.otyp == WAN_OPENING || otmp.otyp == SPE_KNOCK) {
            learn_it = TRUE;
            unpunish();
        } else
            res = 0;
    } else
        switch (otmp.otyp) {
        case WAN_POLYMORPH:
        case SPE_POLYMORPH:
            if (obj_unpolyable(obj)) {
                res = 0;
                break;
            }
            /* KMH, conduct */
            if (!u.uconduct.polypiles++)
                livelog_printf(LL_CONDUCT, _("polymorphed %s first object"),
                               uhis());

            /* any saved lock context will be dangerously obsolete */
            if (Is_box(obj))
                boxlock(obj, otmp);

            if (obj_shudders(obj)) {
                let cover = ((obj == svl.level.objects[u.ux][u.uy])
                                 && u.uundetected
                                 && hides_under(gy.youmonst.data) ? 1 : 0);

                if (cansee(obj.ox, obj.oy))
                    learn_it = TRUE;
                do_osshock(obj);
                /* eek - your cover might have been blown */
                if (cover)
                    hideunder(gy.youmonst);
                break;
            }
            obj = poly_obj(obj, STRANGE_OBJECT);
            newsym(obj.ox, obj.oy);
            break;
        case WAN_PROBING:
            res = +!obj.dknown;
            /* target object has now been "seen (up close)" */
            observe_object(obj);
            if (Is_container(obj) || obj.otyp == STATUE) {
                obj.cknown = obj.lknown = 1;
                if (Is_box(obj) && !obj.tknown) {
                    /* obj->tknown applies to boxes and chests, not bags or
                       statues; plural handling here and the "empty" case
                       below are superfluous because containers don't stack */
                    if (obj.otrapped)
                        pline(_("%s trapped!"), Tobjnam(obj, _("are")));
                    obj.tknown = 1;
                }

                if (!obj.cobj) {
                    pline(_("%s empty."), Tobjnam(obj, _("are")));
                } else if (SchroedingersBox(obj)) {
                    /* we don't want to force alive vs dead
                       determination for Schroedinger's Cat here,
                       so just make probing be inconclusive for it */
                    You(_("aren't sure whether %s has %s or its corpse inside."),
                        the(xname(obj)),
                        /* unfortunately, we can't tell whether rndmonnam()
                           picks a form which can't leave a corpse */
                        an(Hallucination() ? rndmonnam(0) : _("cat")));
                    obj.cknown = 0;
                } else {
                    let o;

                    /* view contents (not recursively) */
                    for (o = obj.cobj; o; o = o.nobj)
                        observe_object(o); /* "seen", even if blind */
                    display_cinventory(obj);
                }
                res = 1;
            } else if (obj.otyp == TIN) {
                /* don't learn wand if tin is already known */
                if (!obj.known || !obj.cknown)
                    res = 1;
                obj.known = 1;
                set_cknown_lknown(obj); /* if TIN obj->cknown = 1 */
            } else if (obj.otyp == EGG) {
                /* if egg is unhatchable, probing it won't learn wand
                   because even when flagged as known, it's just "an egg" */
                if (!obj.known && obj.corpsenm != NON_PM)
                    res = 1;
                obj.known = 1;
                /* [should this call learn_egg_type()?] */
            }
            if (res)
                learn_it = TRUE;
            break;
        case WAN_STRIKING:
        case SPE_FORCE_BOLT:
            /* learn the type if you see or hear something break
               (the sound could be implicit) */
            maybelearnit = +(cansee(obj.ox, obj.oy) || !Deaf());
            if (obj.otyp == BOULDER) {
                 ;
                if (cansee(obj.ox, obj.oy))
                    pline_The(_("boulder falls apart."));
                else
                    You_hear(_("a crumbling sound."));
                fracture_rock(obj);
            } else if (obj.otyp == STATUE) {
                if (break_statue(obj)) {
                    if (cansee(obj.ox, obj.oy)) {
                        if (Hallucination())
                            pline_The(_("%s shatters."), rndmonnam(0));
                        else
                            pline_The(_("statue shatters."));
                    } else
                        You_hear(_("a crumbling sound."));
                }
            } else {
                let oox = obj.ox, ooy = obj.oy;

                if (svc.context.mon_moving ? !breaks(obj, oox, ooy)
                                          : !hero_breaks(obj, oox, ooy, 0))
                    maybelearnit = FALSE; /* nothing broke */
                else
                    /* obj broke; force redisplay in case it was the only--
                       or last--item under non-breaking pile-top; top item
                       here might now be a lone object rather than a pile */
                    newsym_force(oox, ooy);
                res = 0;
            }
            if (maybelearnit)
                learn_it = TRUE;
            break;
        case WAN_CANCELLATION:
        case SPE_CANCELLATION:
            cancel_item(obj);
            newsym(obj.ox, obj.oy); /* might change color */
            break;
        case SPE_DRAIN_LIFE:
            drain_item(obj, TRUE);
            break;
        case WAN_TELEPORTATION:
        case SPE_TELEPORT_AWAY:
            {
                let ox = obj.ox, oy = obj.oy;

                rloco(obj);
                maybe_unhide_at(ox, oy);
            }
            break;
        case WAN_MAKE_INVISIBLE:
            break;
        case WAN_UNDEAD_TURNING:
        case SPE_TURN_UNDEAD:
            if (obj.otyp == EGG) {
                revive_egg(obj);
            } else if (obj.otyp == CORPSE) {
                let mtmp;
                let ox = stack_var(coordxy), oy = stack_var(coordxy);
                let save_norevive;
                let by_u = +!svc.context.mon_moving;
                let corpsenm = corpse_revive_type(obj);
                let corpsname = cxname_singular(obj);

                /* get corpse's location before revive() uses it up */
                if (!get_obj_location(obj, ox, oy, 0))
                    ox[0] = obj.ox, oy[0] = obj.oy; /* won't happen */

                /* explicit revival magic overrides timer-based no-revive */
                save_norevive = obj.oeroded2;
                obj.oeroded2 = 0;

                mtmp = revive(obj, TRUE);
                if (!mtmp) {
                    obj.oeroded2 = save_norevive;
                    res = 0; /* no monster implies corpse was left intact */
                } else {
                    if (cansee(ox[0], oy[0])) {
                        if (canspotmon(mtmp)) {
                            pline(_("%s is resurrected!"),
                                  upstart(noname_monnam(mtmp, ARTICLE_THE)));
                            learn_it = by_u ? TRUE : gz.zap_oseen;
                        } else {
                            /* saw corpse but don't see monster: maybe
                               mtmp is invisible, or has been placed at
                               a different spot than <ox,oy> */
                            if (!type_is_pname(mons[corpsenm]))
                                corpsname = The(corpsname);
                            pline(_("%s disappears."), corpsname);
                        }
                    } else {
                        /* couldn't see corpse's location */
                        if (Role_if(PM_HEALER) && !Deaf()
                            && !nonliving(mons[corpsenm])) {
                            if (!type_is_pname(mons[corpsenm]))
                                corpsname = an(corpsname);
                            if (!Hallucination())
                                You_hear(_("%s reviving."), corpsname);
                            else
                                You_hear(_("a defibrillator."));
                            learn_it = by_u ? TRUE : gz.zap_oseen;
                        }
                        if (canspotmon(mtmp))
                            /* didn't see corpse but do see monster: it
                               has been placed somewhere other than <ox,oy>
                               or blind hero spots it with ESP */
                            pline(_("%s appears."), Monnam(mtmp));
                    }
                    if (learn_it)
                        exercise(A_WIS, TRUE);
                }
            }
            break;
        case WAN_OPENING:
        case SPE_KNOCK:
        case WAN_LOCKING:
        case SPE_WIZARD_LOCK:
            if (Is_box(obj))
                res = boxlock(obj, otmp);
            else
                res = 0;
            if (res)
                learn_it = TRUE;
            break;
        case WAN_SLOW_MONSTER: /* no effect on objects */
        case SPE_SLOW_MONSTER:
        case WAN_SPEED_MONSTER:
        case WAN_NOTHING:
        case SPE_HEALING:
        case SPE_EXTRA_HEALING:
            res = 0;
            break;
        case SPE_STONE_TO_FLESH:
            res = stone_to_flesh_obj(obj);
            break;
        default:
            impossible(_("What an interesting effect (%d)"), otmp.otyp);
            break;
        }
    /* if effect was observable then discover the wand type provided
       that the wand itself has been seen */
    if (learn_it)
        learnwand(otmp);
    return res;
    } finally { stack_pop($frame); }
}

/* returns nonzero if something was hit */
export function bhitpile(
    obj,
    fhito,
    tx, ty,
    zz) { /* int */ /* direction for up/down zaps */
    let otmp, next_obj;
    let hidingunder, first;
    let prevotyp, hitanything = 0;

    if (!svl.level.objects[tx][ty])
        return 0;

    /* if hiding underneath an object and zapping up or down, the top item
       is either the only thing hit (up) or is skipped (down) */
    hidingunder = (zz != 0 && u.uundetected && hides_under(gy.youmonst.data) ? 1 : 0);
    first = TRUE;

    if (obj.otyp == SPE_FORCE_BOLT || obj.otyp == WAN_STRIKING) {
        let t = t_at(tx, ty);
        let topofpile = svl.level.objects[tx][ty];

        /* We can't settle for the default calling sequence of
           bhito(otmp) -> break_statue(otmp) -> activate_statue_trap(ox,oy)
           because that last call might end up operating on our `next_obj'
           (below), rather than on the current object, if it happens to
           encounter a statue which mustn't become animated. */
        if (t && t.ttyp == STATUE_TRAP
            && activate_statue_trap(t, tx, ty, TRUE))
            learnwand(obj);
        /* assume zapping up or down while hiding under the top item can
           still activate the trap even if it's below (when zapping up)
           or above (when zapping down) */
        if (svl.level.objects[tx][ty] != topofpile)
            first = FALSE; /* top item was statue which activated */
    }

    gp.poly_zapped = -1;
    for (otmp = svl.level.objects[tx][ty]; otmp; otmp = next_obj) {
        next_obj = otmp.v.v_nexthere;
        if (hidingunder) {
            if (first) {
                first = FALSE; /* reset for next item */
                if (zz > 0) /* down when hiding-under skips first item */
                    continue;
            } else {
                /* !first */
                if (zz < 0) /* up when hiding-under skips rest of pile */
                    continue;
            }
        }
        if (otmp.where != OBJ_FLOOR || otmp.ox != tx || otmp.oy != ty)
            continue;
        hitanything += fhito(otmp, obj);
    }

    if (gp.poly_zapped >= 0)
        create_polymon(svl.level.objects[tx][ty], gp.poly_zapped);

    /* when boulders are present they're expected to be on top; with
       multiple boulders it's possible for some to have been changed into
       non-boulders (polymorph, stone-to-flesh) while ones beneath resist,
       so re-stack pile if there are any non-boulders above boulders */
    prevotyp = BOULDER;
    for (otmp = svl.level.objects[tx][ty]; otmp; otmp = otmp.v.v_nexthere) {
        if (otmp.otyp == BOULDER && prevotyp != BOULDER) {
            recreate_pile_at(tx, ty);
            break;
        }
        prevotyp = otmp.otyp;
    }

    if (hidingunder) /* pile might have been destroyed or dispersed */
        maybe_unhide_at(tx, ty);

    fill_pit(tx, ty);

    return hitanything;
}

/*
 * zappable - returns 1 if zap is available, 0 otherwise.
 *            it removes a charge from the wand if zappable.
 * added by GAN 11/03/86
 */
export function zappable(wand) { /* int */
    if (wand.spe < 0 || (wand.spe == 0 && rn2(WAND_WREST_CHANCE)))
        return 0;
    if (wand.spe == 0)
        You(_("wrest one last charge from the worn-out wand."));
    wand.spe--;
    return 1;
}

export function do_enlightenment_effect() { /* void */
    You_feel(_("self-knowledgeable..."));
    display_nhwindow()(WIN_MESSAGE, FALSE);
    enlightenment(MAGICENLIGHTENMENT, ENL_GAMEINPROGRESS);
    pline_The(_("feeling subsides."));
    exercise(A_WIS, TRUE);
}

/*
 * zapnodir - zaps a NODIR wand/spell.
 * Won't get here if wand has no charges (unless wresting 1 last charge).
 */
export function zapnodir(obj) { /* void */
    let known = FALSE;

    switch (obj.otyp) {
    case WAN_LIGHT:
    case SPE_LIGHT:
        /* FIXME? wand of light becoming discovered should be contingent upon
           seeing at least one previously unlit spot become lit */
        known = (obj.dknown && !Blind() ? 1 : 0);
        litroom(TRUE, obj);
        lightdamage(obj, TRUE, 5);
        break;
    case WAN_SECRET_DOOR_DETECTION:
    case SPE_DETECT_UNSEEN:
        /* findit() gives sufficient feedback to discover the wand even when
           blinded or when it fails to find anything */
        known = +!!obj.dknown;
        findit();
        break;
    case WAN_STASIS: {
        let tmp_until = svm.moves + rn1(21, 10);

        /* no immediately obvious effect, and no message so that it isn't
           distinguishable from other NODIR wands that produce no message;
           for multiple zaps, keep the longest duration rather than latest */
        if (tmp_until > svl.level.flags.stasis_until)
            svl.level.flags.stasis_until = tmp_until;
        break;
    }
    case WAN_CREATE_MONSTER:
        /* create_critters() returns True iff hero sees a new monster appear */
        if (create_critters(rn2(23) ? 1 : rn1(7, 2),
                            null, FALSE))
            known = +!!obj.dknown;
        break;
    case WAN_WISHING:
        if (Luck() + rn2(5) < 0) {
            pline(_("Unfortunately, nothing happens."));
            known = FALSE;
        } else {
            known = +!!obj.dknown;
            /* wand of wishing asks player what to wish for so always becomes
               discovered (unless it hasn't been seen) */
            makewish();
        }
        break;
    case WAN_ENLIGHTENMENT:
        known = +!!obj.dknown;
        /* do_enlightenmnt_effect() always describes enlightenment */
        do_enlightenment_effect();
        break;
    default:
        break;
    }

    if (known) {
        if (!objects[obj.otyp].oc_name_known)
            more_experienced(0, 10);
        /* effect was observable; discover the wand type provided
           that the wand itself has been seen */
        learnwand(obj);
    }
}

function backfire(otmp) { /* void */
    let dmg;

    otmp.in_use = TRUE; /* in case losehp() is fatal */
    pline(_("%s suddenly explodes!"), The(xname(otmp)));
    dmg = d(otmp.spe + 2, 6);
    losehp(Maybe_Half_Phys(dmg), _("exploding wand"), KILLED_BY_AN);
    useupall(otmp);
}

/* getobj callback for object to zap */
function zap_ok(obj) { /* int */
    if (obj && obj.oclass == WAND_CLASS)
        return GETOBJ_SUGGEST;
    return GETOBJ_EXCLUDE;
}

/* #zap command, 'z' (or 'y' if numbed_pad==-1) */
export function dozap() { /* int */
    const $frame = stack_frame(); try {
    let obj;
    let damage, need_dir;

    if (nohands(gy.youmonst.data)) {
        You(_("aren't able to zap anything in your current form."));
        return ECMD_OK;
    }
    if (check_capacity(0))
        return ECMD_OK;
    obj = getobj(_("zap"), zap_ok, GETOBJ_NOFLAGS);
    if (!obj)
        return ECMD_CANCEL;

    check_unpaid(obj);

    need_dir = +(objects[obj.otyp].oc_dir != NODIR);
    if (!zappable(obj)) {
        pline1(nothing_happens());
    } else if (obj.cursed && !rn2(WAND_BACKFIRE_CHANCE)) {
        backfire(obj); /* the wand blows up in your face! */
        exercise(A_STR, FALSE);
        /* 'obj' is gone; skip update_inventory() because
           backfire() -> useupall() -> freeinv() did it */
        return ECMD_TIME;
    } else if (need_dir && !getdir(0)) {
        if (!Blind())
            pline(_("%s glows and fades."), The(xname(obj)));
        /* make him pay for knowing !NODIR */
    } else if (need_dir && !u.dx && !u.dy && !u.dz) {
        if ((damage = zapyourself(obj, TRUE)) != 0) {
            let buf = stack_array(char, BUFSZ);

            sprintf(buf, _("zapped %sself with %s"), uhim(), killer_xname(obj))
;
            losehp(Maybe_Half_Phys(damage), buf, NO_KILLER_PREFIX);
        }
    } else {
        /*      Are we having fun yet?
         * weffects -> buzz(obj->otyp) -> zhitm (temple priest) ->
         * attack -> hitum -> known_hitum -> ghod_hitsu ->
         * buzz(AD_ELEC) -> destroy_items(AD_ELEC) ->
         * useup -> obfree -> dealloc_obj -> free(obj)
         */
        gc.current_wand = obj;
        weffects(obj);
        obj = gc.current_wand;
        gc.current_wand = null;
    }
    if (obj && obj.spe < 0) {
        pline(_("%s to dust."), Tobjnam(obj, _("turn")));
        useupall(obj); /* calls freeinv() -> update_inventory() */
    } else
        update_inventory(); /* maybe used a charge */
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

/* Lock or unlock all boxes in inventory */
function boxlock_invent(obj) { /* void */
    let otmp, nextobj;
    let boxing = FALSE;

    /* (un)lock carried boxes */
    for (otmp = gi.invent; otmp; otmp = nextobj) {
        nextobj = otmp.nobj;
        if (Is_box(otmp)) {
            boxlock(otmp, obj);
            boxing = TRUE;
        }
    }
    if (boxing)
        update_inventory(); /* in case any box->lknown has changed */
}

export function zapyourself(obj, ordinary) { /* int */
    const $frame = stack_frame(); try {
    let learn_it = stack_var(boolean, FALSE);
    let damage = 0;
    let orig_dmg = 0; /* for passing to destroy_items() */

    switch (obj.otyp) {
    case WAN_STRIKING:
    case SPE_FORCE_BOLT:
        learn_it[0] = TRUE;
        if (Antimagic()) {
            shieldeff(u.ux, u.uy);
            pline(_("Boing!"));
            monstseesu(M_SEEN_MAGR);
        } else {
            if (ordinary) {
                You(_("bash yourself!"));
                damage = d(2, 12);
            } else
                damage = d(1 + obj.spe, 6);
            exercise(A_STR, FALSE);
            monstunseesu(M_SEEN_MAGR);
        }
        break;

    case WAN_LIGHTNING:
        learn_it[0] = TRUE;
        orig_dmg = d(12, 6);
        if (!Shock_resistance()) {
            You(_("shock yourself!"));
            damage = orig_dmg;
            exercise(A_CON, FALSE);
            monstunseesu(M_SEEN_ELEC);
        } else {
            shieldeff(u.ux, u.uy);
            You(_("zap yourself, but seem unharmed."));
            monstseesu(M_SEEN_ELEC);
            ugolemeffects(AD_ELEC, orig_dmg);
        }
        destroy_items(gy.youmonst, AD_ELEC, orig_dmg);
        flashburn(rnd(100), TRUE);
        break;

    case SPE_FIREBALL:
        You(_("explode a fireball on top of yourself!"));
        explode(u.ux, u.uy, 11, d(6, 6), WAND_CLASS, EXPL_FIERY);
        break;
    case WAN_FIRE:
    case FIRE_HORN:
        learn_it[0] = TRUE;
        orig_dmg = d(12, 6);
        if (Fire_resistance()) {
            shieldeff(u.ux, u.uy);
            You_feel(_("rather warm."));
            monstseesu(M_SEEN_FIRE);
            ugolemeffects(AD_FIRE, orig_dmg);
        } else {
            pline(_("You've set yourself afire!"));
            damage = orig_dmg;
            monstunseesu(M_SEEN_FIRE);
        }
        burn_away_slime();
        burnarmor(gy.youmonst);
        destroy_items(gy.youmonst, AD_FIRE, orig_dmg);
        ignite_items(gi.invent);
        break;

    case WAN_COLD:
    case SPE_CONE_OF_COLD:
    case FROST_HORN:
        learn_it[0] = TRUE;
        orig_dmg = d(12, 6);
        if (Cold_resistance()) {
            shieldeff(u.ux, u.uy);
            You_feel(_("a little chill."));
            monstseesu(M_SEEN_COLD);
            ugolemeffects(AD_COLD, orig_dmg);
        } else {
            You(_("imitate a popsicle!"));
            damage = orig_dmg;
            monstunseesu(M_SEEN_COLD);
        }
        destroy_items(gy.youmonst, AD_COLD, orig_dmg);
        break;

    case WAN_MAGIC_MISSILE:
    case SPE_MAGIC_MISSILE:
        learn_it[0] = TRUE;
        if (Antimagic()) {
            shieldeff(u.ux, u.uy);
            pline_The(_("missiles bounce!"));
            monstseesu(M_SEEN_MAGR);
        } else {
            damage = d(4, 6);
            pline(_("Idiot!  You've shot yourself!"));
            monstunseesu(M_SEEN_MAGR);
        }
        break;

    case WAN_POLYMORPH:
    case SPE_POLYMORPH:
        if (!Unchanging()) {
            learn_it[0] = TRUE;
            polyself(POLY_NOFLAGS);
        }
        break;

    case WAN_CANCELLATION:
    case SPE_CANCELLATION:
        cancel_monst(gy.youmonst, obj, TRUE, TRUE, TRUE);
        break;

    case SPE_DRAIN_LIFE:
        if (!Drain_resistance()) {
            learn_it[0] = TRUE; /* (no effect for spells...) */
            losexp(_("life drainage"));
        }
        damage = 0; /* No additional damage */
        break;

    case WAN_MAKE_INVISIBLE: {
        /* have to test before changing HInvis but must change
         * HInvis before doing newsym().
         */
        let msg = +(!Invis() && !Blind() && !BInvis());

        if (BInvis() && uarmc.otyp == MUMMY_WRAPPING) {
            /* A mummy wrapping absorbs it and protects you */
            You_feel(_("rather itchy under %s."), yname(uarmc));
            break;
        }
        incr_itimeout(ref_of(u.uprops[INVIS], "intrinsic"), rn1(15, 31));
        if (msg) {
            learn_it[0] = TRUE;
            newsym(u.ux, u.uy);
            self_invis_message();
        }
        break;
    }

    case WAN_SPEED_MONSTER:
        /* no longer gives intrinsic, but gives very fast speed instead */
        speed_up(rn1(25, 50));
        learn_it[0] = TRUE;
        break;

    case WAN_SLEEP:
    case SPE_SLEEP:
        learn_it[0] = TRUE;
        if (Sleep_resistance()) {
            shieldeff(u.ux, u.uy);
            You(_("don't feel sleepy!"));
            monstseesu(M_SEEN_SLEEP);
        } else {
            if (ordinary)
                pline_The(_("sleep ray hits you!"));
            else
                You(_("fall asleep!"));
            monstunseesu(M_SEEN_SLEEP);
            fall_asleep(-rnd(50), TRUE);
        }
        break;

    case WAN_SLOW_MONSTER:
    case SPE_SLOW_MONSTER:
        if (HFast() & (TIMEOUT | INTRINSIC)) {
            learn_it[0] = TRUE;
            u_slow_down();
        }
        break;

    case WAN_TELEPORTATION:
    case SPE_TELEPORT_AWAY:
        tele();
        /* same criteria as when mounted (zap_steed) */
        if ((Teleport_control() && !Stunned()) || !couldsee(u.ux0, u.uy0)
            || distu(u.ux0, u.uy0) >= 16)
            learn_it[0] = TRUE;
        break;

    case WAN_DEATH:
    case SPE_FINGER_OF_DEATH:
        if (nonliving(gy.youmonst.data) || is_demon(gy.youmonst.data)) {
            pline((obj.otyp == WAN_DEATH)
                      ? _("The wand shoots an apparently harmless beam at you.")
                      : _("You seem no deader than before."));
            break;
        }
        learn_it[0] = TRUE;
        sprintf(svk.killer.name, _("shot %sself with a death ray"), uhim());
        svk.killer.format = NO_KILLER_PREFIX;
        /* probably don't need these to be urgent; player just gave input
           without subsequent opportunity to dismiss --More-- with ESC */
        urgent_pline(_("You irradiate yourself with pure energy!"));
        urgent_pline(_("You die."));
        /* They might survive with an amulet of life saving */
        done(DIED);
        break;
    case WAN_UNDEAD_TURNING:
    case SPE_TURN_UNDEAD:
        learn_it[0] = TRUE;
        unturn_you();
        break;
    case SPE_HEALING:
    case SPE_EXTRA_HEALING:
        learn_it[0] = TRUE; /* (no effect for spells...) */
        healup(d(6, obj.otyp == SPE_EXTRA_HEALING ? 8 : 4), 0, FALSE,
               (obj.blessed || obj.otyp == SPE_EXTRA_HEALING ? 1 : 0));
        You_feel(_("%sbetter."), obj.otyp == SPE_EXTRA_HEALING ? _("much ") : _(""));
        break;
    case WAN_LIGHT: /* (broken wand) */
        /* assert( !ordinary ); */
        damage = d(obj.spe, 25);
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case EXPENSIVE_CAMERA:
        if (!damage)
            damage = 5;
        damage = lightdamage(obj, ordinary, damage);
        damage += rnd(25);
        if (flashburn(damage, FALSE))
            learn_it[0] = TRUE;
        damage = 0; /* reset */
        break;
    case WAN_OPENING:
    case SPE_KNOCK:
        if (u.ustuck) {
            /* zapping either self or holder/holdee [bhitm()] will release
               holder's grasp from the hero or hero's grasp from holdee */
            release_hold();
            learn_it[0] = TRUE;
        }
        if (Punished()) {
            learn_it[0] = TRUE;
            unpunish();
        }
        /* invent is hit iff hero doesn't escape from a trap */
        if (!u.utrap || !openholdingtrap(gy.youmonst, addr_of(learn_it))) {
            boxlock_invent(obj);
            /* trigger previously escaped trapdoor */
            openfallingtrap(gy.youmonst, TRUE, addr_of(learn_it));
        }
        break;
    case WAN_LOCKING:
    case SPE_WIZARD_LOCK:
        /* similar logic to opening; invent is hit iff no trap triggered */
        if (u.utrap || !closeholdingtrap(gy.youmonst, addr_of(learn_it))) {
            boxlock_invent(obj);
        }
        break;
    case WAN_DIGGING:
    case SPE_DIG:
    case SPE_DETECT_UNSEEN:
    case WAN_NOTHING:
        break;
    case WAN_PROBING:
        probe_objchain(gi.invent);
        update_inventory();
        learn_it[0] = TRUE;
        ustatusline();
        break;
    case SPE_STONE_TO_FLESH: {
        let otmp = stack_var(ptr_to(struct_obj)), onxt = stack_var(ptr_to(struct_obj));
        let didmerge;

        if (u.umonnum == PM_STONE_GOLEM) {
            learn_it[0] = TRUE;
            polymon(PM_FLESH_GOLEM);
        }
        if (Stoned()) {
            learn_it[0] = TRUE;
            fix_petrification(); /* saved! */
        }
        /* but at a cost.. */
        for (otmp[0] = gi.invent; otmp[0]; otmp[0] = onxt[0]) {
            onxt[0] = otmp[0].nobj;
            if (bhito(otmp[0], obj))
                learn_it[0] = TRUE;
        }
        /*
         * It is possible that we can now merge some inventory.
         * Do a highly paranoid merge.  Restart from the beginning until
         * no merges.  Don't merge worn items (in case of stone-to-flesh
         * of rocks wielded in differing weapon/alt-wep/quiver slot).
         */
        do {
            didmerge = FALSE;
            for (otmp[0] = gi.invent; !didmerge && otmp[0]; otmp[0] = otmp[0].nobj) {
                if (otmp[0].owornmask)
                    continue;
                for (onxt[0] = otmp[0].nobj; onxt[0]; onxt[0] = onxt[0].nobj)
                    if (merged(otmp, onxt)) {
                        didmerge = TRUE;
                        break;
                    }
            }
        } while (didmerge);
        break;
    }
    default:
        impossible(_("zapyourself: object %d used?"), obj.otyp);
        break;
    }
    /* if effect was observable then discover the wand type provided
       that the wand itself has been seen */
    if (learn_it[0])
        learnwand(obj);
    return damage;
    } finally { stack_pop($frame); }
}

/* called when poly'd hero uses breath attack against self */
export function ubreatheu(mattk) { /* void */
    let dtyp = 20 + mattk.adtyp - 1;      /* breath by hero */

    zhitu(dtyp, mattk.damn, flash_str(dtyp, TRUE), u.ux, u.uy);
}

/* light damages hero in gremlin form */
export function lightdamage(
    obj,
    ordinary,
    amt) { /* int */ /* pseudo-damage used to determine blindness duration */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);
    let how;
    let dmg = amt;

    if (dmg && gy.youmonst.data == mons[PM_GREMLIN]) {
        /* reduce high values (from destruction of wand with many charges) */
        dmg = rnd(dmg);
        if (dmg > 10)
            dmg = 10 + rnd(dmg - 10);
        if (dmg > 20)
            dmg = 20;
        pline(_("Ow, that light hurts%c"), (dmg > 2 || u.mh <= 5) ? ord('!') : ord('.'));
        /* [composing killer/reason is superfluous here; if fatal, cause
           of death will always be "killed while stuck in creature form"] */
        if (obj.oclass == SCROLL_CLASS || obj.oclass == SPBOOK_CLASS)
            ordinary = FALSE; /* say blasted rather than zapped */
        how = (obj.oclass == SPBOOK_CLASS) ? _("spell of light")
              : (!obj.oartifact) ? ansimpleoname(obj)
                : bare_artifactname(obj);
        sprintf(buf, _("%s %sself with %s"), ordinary ? _("zapped") : _("blasted"), uhim(), how)
;
        /* might rehumanize(); could be fatal, but only for Unchanging */
        losehp(Maybe_Half_Phys(dmg), buf, NO_KILLER_PREFIX);
    }
    return dmg;
    } finally { stack_pop($frame); }
}

/* light[ning] causes blindness */
export function flashburn(duration, via_lightning) { /* boolean */
    if (!resists_blnd(gy.youmonst)) {
        You(are_blinded_by_the_flash);
        make_blinded(duration, FALSE);
        if (!Blind())
            Your1(vision_clears());
        return TRUE;
    }
    /* if blinding is resisted due to magical equipment (Sunsword), give
       a sparkle animation (even if also resisted due to being blind)
       _unless_ this is lightning-induced; we don't want a double sparkle
       if hero is both lightning resistant and blindness resistant, or
       worse, have a single sparkle where the player confuses blindness
       resistance for lightning resistance */
    if (!via_lightning && resists_blnd_by_arti(gy.youmonst)) {
        shieldeff(u.ux, u.uy);
        return TRUE;
    }
    return FALSE;
}

/* you've zapped a wand downwards while riding
 * Return TRUE if the steed was hit by the wand.
 * Return FALSE if the steed was not hit by the wand.
 */
function zap_steed(obj) { /* boolean */ /* wand or spell */
    let steedhit = FALSE;

    gb.bhitpos.x = u.usteed.mx, gb.bhitpos.y = u.usteed.my;
    gn.notonhead = FALSE;
    switch (obj.otyp) {
    /*
     * Wands that are allowed to hit the steed
     * Carefully test the results of any that are
     * moved here from the bottom section.
     */
    case WAN_PROBING:
        probe_monster(u.usteed);
        learnwand(obj);
        steedhit = TRUE;
        break;
    case WAN_TELEPORTATION:
    case SPE_TELEPORT_AWAY:
        /* you go together */
        tele();
        /* same criteria as when unmounted (zapyourself) */
        if ((Teleport_control() && !Stunned()) || !couldsee(u.ux0, u.uy0)
            || distu(u.ux0, u.uy0) >= 16)
            learnwand(obj);
        steedhit = TRUE;
        break;

    /* Default processing via bhitm() for these */
    case SPE_CURE_SICKNESS:
    case WAN_MAKE_INVISIBLE:
    case WAN_CANCELLATION:
    case SPE_CANCELLATION:
    case WAN_POLYMORPH:
    case SPE_POLYMORPH:
    case WAN_STRIKING:
    case SPE_FORCE_BOLT:
    case WAN_SLOW_MONSTER:
    case SPE_SLOW_MONSTER:
    case WAN_SPEED_MONSTER:
    case SPE_HEALING:
    case SPE_EXTRA_HEALING:
    case SPE_DRAIN_LIFE:
    case WAN_OPENING:
    case SPE_KNOCK:
        bhitm(u.usteed, obj);
        steedhit = TRUE;
        break;

    default:
        steedhit = FALSE;
        break;
    }
    return steedhit;
}

/*
 * cancel a monster (possibly the hero).  inventory is cancelled only
 * if the monster is zapping itself directly, since otherwise the
 * effect is too strong.  currently non-hero monsters do not zap
 * themselves with cancellation.
 */
export function cancel_monst(mdef, obj, youattack,
             allow_cancel_kill, self_cancel) { /* boolean */
    let writing_vanishes = init_string(static_array("cancel_monst.writing_vanishes", char, sizeof_string("Some writing vanishes from %s head!")), _("Some writing vanishes from %s head!"), true),
        your = init_string(static_array("cancel_monst.your", char, sizeof_string("your")), _("your"), true);
 /* should be extern */
    let youdefend = +(mdef == gy.youmonst);

    if (youdefend ? (!youattack && Antimagic())
                  : resist(mdef, obj.oclass, 0, NOTELL))
        return FALSE; /* resisted cancellation */

    if (self_cancel) { /* 1st cancel inventory */
        let otmp;

        for (otmp = (youdefend ? gi.invent : mdef.minvent); otmp;
             otmp = otmp.nobj)
            cancel_item(otmp);

        if (youdefend) {
            disp.botl = TRUE; /* potential AC change */
            find_ac();
            /* update_inventory(); -- handled by caller */
        }
    }

    /* now handle special cases */
    if (youdefend) {
        if (Upolyd()) { /* includes lycanthrope in creature form */
            /*
             * Return to normal form unless Unchanging.
             * Hero in clay golem form dies if Unchanging.
             * Does not cure lycanthropy or stop timed random polymorph.
             */
            if (u.umonnum == PM_CLAY_GOLEM) {
                if (!Blind())
                    pline(writing_vanishes, your);
                else /* note: "dark" rather than "heavy" is intentional... */
                    You_feel(_("%s headed."), Hallucination() ? _("dark") : _("light"));
                u.mh = 0; /* fatal; death handled by rehumanize() */
            }
            if (Unchanging() && u.mh > 0)
                Your(_("amulet grows hot for a moment, then cools."));
            else
                rehumanize();
        }
    } else {
        mdef.mcan = 1;
        /* force shapeshifter into its base form or mimic to unhide */
        normal_shape(mdef);

        if (mdef.data == mons[PM_CLAY_GOLEM]) {
            if (canseemon(mdef))
                pline(writing_vanishes, s_suffix(mon_nam(mdef)));
            /* !allow_cancel_kill is for Magicbane, where clay golem
               will be killed somewhere back up the call/return chain... */
            if (allow_cancel_kill) {
                if (youattack)
                    killed(mdef);
                else
                    monkilled(mdef, _(""), AD_SPEL);
            }
        }
    }
    return TRUE;
}

/* you've zapped an immediate type wand up or down */
function zap_updown(obj) { /* boolean */ /* wand or spell, nonnull */
    const $frame = stack_frame(); try {
    let striking = FALSE, disclose = stack_var(boolean, FALSE), map_zapped = FALSE;
    let x, y, xx = stack_var(coordxy), yy = stack_var(coordxy);
    let ptmp;
    let otmp;
    let e;
    let ttmp;
    let stway = gs.stairs;

    /* some wands have special effects other than normal bhitpile */
    /* drawbridge might change <u.ux,u.uy> */
    x = xx[0] = u.ux;     /* <x,y> is zap location */
    y = yy[0] = u.uy;     /* <xx,yy> is drawbridge (portcullis) position */
    ttmp = t_at(x, y); /* trap if there is one */

    switch (obj.otyp) {
    case WAN_PROBING:
        ptmp = 0;
        if (u.dz < 0) {
            You(_("probe towards the %s."), ceiling(x, y));
        } else { /* down */
            let surf;
            let ltyp, rememberedltyp = update_mapseen_for(x, y);

            ptmp += bhitpile(obj, bhito, x, y, u.dz);
            /* sequencing: zap_map() calls force_decor() for ice or furniture;
               we need to call it before probing for buried objects */
            ltyp = SURFACE_AT(x, y);
            zap_map(x, y, obj);
            /*map_zapped = TRUE; // not needed due to early return*/
            if (ltyp == ICE || IS_FURNITURE(ltyp)) {
                surf = _("it");
                if (chars[svl.lastseentyp[x] + y] != rememberedltyp)
                    ptmp += 1;
            } else {
                surf = the(surface(x, y));
            }
            You(_("probe beneath %s."), surf);
            ptmp += display_binventory(x, y, TRUE);
        }
        if (!ptmp)
            Your(_("probe reveals nothing."));
        return TRUE; /* we've done our own bhitpile */
    case WAN_OPENING:
    case SPE_KNOCK:
        while (stway) {
            if (!stway.isladder && !stway.up
                && stway.tolev.dnum == u.uz.dnum)
                break;
            stway = stway.next;
        }
        /* up or down, but at closed portcullis only */
        if (is_db_wall(x, y) && find_drawbridge(xx, yy)) {
            open_drawbridge(xx[0], yy[0]);
            disclose[0] = TRUE;
        } else if (u.dz > 0 && stway && stway.sx == x && stway.sy == y
                   /* can't use the stairs down to quest level 2 until
                      leader "unlocks" them; give feedback if you try */
                   && on_level(u.uz, svd.dungeon_topology.d_qstart_level) && !ok_to_quest()) {
            pline_The(_("stairs seem to ripple momentarily."));
            disclose[0] = TRUE;
        }
        /* down will release you from bear trap or web */
        if (u.dz > 0 && u.utrap) {
            openholdingtrap(gy.youmonst, addr_of(disclose));
            /* down will trigger trapdoor, hole, or [spiked-] pit */
        } else if (u.dz > 0 && !u.utrap) {
            openfallingtrap(gy.youmonst, FALSE, addr_of(disclose));
        }
        break;
    case WAN_STRIKING:
    case SPE_FORCE_BOLT:
        striking = TRUE;
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case WAN_LOCKING:
    case SPE_WIZARD_LOCK:
        /* down at open bridge or up or down at open portcullis */
        if (((levl()[x][y].typ == DRAWBRIDGE_DOWN)
                 ? (u.dz > 0)
                 : (is_drawbridge_wall(x, y) >= 0 && !is_db_wall(x, y)))
            && find_drawbridge(xx, yy)) {
            if (!striking)
                close_drawbridge(xx[0], yy[0]);
            else
                destroy_drawbridge(xx[0], yy[0]);
            disclose[0] = TRUE;
        } else if (striking && u.dz < 0 && rn2(3) && !Is_airlevel(u.uz)
                   && !Is_waterlevel(u.uz) && !Underwater()
                   && !Is_qstart(u.uz)) {
            let dmg;
            /* similar to zap_dig() */
            pline(_("A rock is dislodged from the %s and falls on your %s."),
                  ceiling(x, y), body_part(HEAD));
            dmg = rnd(hard_helmet(uarmh) ? 2 : 6);
            losehp(Maybe_Half_Phys(dmg), _("falling rock"), KILLED_BY_AN);
            if ((otmp = mksobj_at(ROCK, x, y, FALSE, FALSE)) != null) {
                xname(otmp); /* set dknown, maybe bknown */
                stackobj(otmp);
            }
            newsym(x, y);
        } else if (u.dz > 0 && ttmp) {
            if (!striking && closeholdingtrap(gy.youmonst, addr_of(disclose))) {
                ; /* now stuck in web or bear trap */
            } else if (striking && ttmp.ttyp == TRAPDOOR) {
                /* striking transforms trapdoor into hole */
                if (Blind() && !ttmp.tseen) {
                    pline(_("%s beneath you shatters."), Something());
                } else if (!ttmp.tseen) { /* => !Blind */
                    pline(_("There's a trapdoor beneath you; it shatters."));
                } else {
                    pline(_("The trapdoor beneath you shatters."));
                    disclose[0] = TRUE;
                }
                ttmp.ttyp = HOLE;
                ttmp.tseen = 1;
                newsym(x, y);
                /* might fall down hole */
                dotrap(ttmp, NO_TRAP_FLAGS);
            } else if (!striking && ttmp.ttyp == HOLE) {
                /* locking transforms hole into trapdoor */
                ttmp.ttyp = TRAPDOOR;
                if (Blind() || !ttmp.tseen) {
                    pline(_("Some %s swirls beneath you."),
                          is_ice(x, y) ? _("frost") : _("dust"));
                } else {
                    ttmp.tseen = 1;
                    newsym(x, y);
                    pline(_("A trapdoor appears beneath you."));
                    disclose[0] = TRUE;
                }
                /* hadn't fallen down hole; won't fall now */
            }
        }
        break;
    case SPE_STONE_TO_FLESH:
        if (Is_airlevel(u.uz) || Is_waterlevel(u.uz) || Underwater()
            || (Is_qstart(u.uz) && u.dz < 0)) {
            pline1(nothing_happens());
        } else if (u.dz < 0) { /* we should do more... */
            pline(_("Blood drips on your %s."), body_part(FACE));
        } else if (u.dz > 0 && !OBJ_AT(u.ux, u.uy)) {
            /*
            Print this message only if there wasn't an engraving
            affected here.  If water or ice, act like waterlevel case.
            */
            e = engr_at(u.ux, u.uy);
            if (!(e && e.engr_type == ENGRAVE)) {
                if (is_pool(u.ux, u.uy) || is_ice(u.ux, u.uy))
                    pline1(nothing_happens());
                else
                    pline(_("Blood %ss %s your %s."),
                          is_lava(u.ux, u.uy) ? _("boil") : _("pool"),
                          Levitation() ? _("beneath") : _("at"),
                          makeplural(body_part(FOOT)));
            }
        }
        break;
    default:
        break;
    }

    if (u.dz > 0) {
        /* zapping downward */
        bhitpile(obj, bhito, x, y, u.dz);

        /* note: engraving handling that used to be here has been moved
           to zap_map() */
        if (!map_zapped)
            zap_map(x, y, obj);
    } else if (u.dz < 0) {
        /* zapping upward */

        /* game flavor: if you're hiding under "something"
         * a zap upward should hit that "something".
         */
        if (u.uundetected && hides_under(gy.youmonst.data)) {
            let hitit = 0;
            otmp = svl.level.objects[u.ux][u.uy];

            if (otmp)
                hitit = bhito(otmp, obj);
            if (hitit) {
                hideunder(gy.youmonst);
                disclose[0] = TRUE;
            }
        }
    }

    return disclose[0];
    } finally { stack_pop($frame); }
}

/* used by do_break_wand() was well as by weffects() */
export function zapsetup() { /* void */
    go.obj_zapped = FALSE;
}

export function zapwrapup() { /* void */
    /* if do_osshock() set obj_zapped while polying, give a message now */
    if (go.obj_zapped)
        You_feel(_("shuddering vibrations."));
    go.obj_zapped = FALSE;
}

/* called for various wand and spell effects - M. Stephenson */
export function weffects(obj$) { /* void */
    const $frame = stack_frame(); try {
    const obj = stack_var(ptr_to(struct_obj), obj$);
    let otyp = obj[0].otyp;
    let disclose = FALSE, was_unkn = +!objects[otyp].oc_name_known;

    exercise(A_WIS, TRUE);
    if (u.usteed && (objects[otyp].oc_dir != NODIR) && !u.dx && !u.dy
        && (u.dz > 0) && zap_steed(obj[0])) {
        disclose = TRUE;
    } else if (objects[otyp].oc_dir == IMMEDIATE) {
        zapsetup(); /* reset obj_zapped */
        if (u.uswallow) {
            bhitm(u.ustuck, obj[0]);
            /* [how about `bhitpile(u.ustuck->minvent)' effect?] */
        } else if (u.dz) {
            disclose = zap_updown(obj[0]);
        } else {
            bhit(u.dx, u.dy, rn1(8, 6), ZAPPED_WAND, bhitm, bhito,
                        obj);
        }
        zapwrapup(); /* give feedback for obj_zapped */
    } else if (objects[otyp].oc_dir == NODIR) {
        zapnodir(obj[0]);
    } else {
        /* neither immediate nor directionless */

        if (otyp == WAN_DIGGING || otyp == SPE_DIG)
            zap_dig();
        else if (otyp >= SPE_MAGIC_MISSILE && otyp <= SPE_FINGER_OF_DEATH)
            ubuzz(BZ_U_SPELL(BZ_OFS_SPE(otyp)), Math.trunc(u.ulevel / 2) + 1);
        else if (otyp >= WAN_MAGIC_MISSILE && otyp <= WAN_LIGHTNING)
            ubuzz(BZ_U_WAND(BZ_OFS_WAN(otyp)),
                  (otyp == WAN_MAGIC_MISSILE) ? 2 : 6);
        else
            impossible(_("weffects: unexpected spell or wand"));
        disclose = TRUE;
    }
    if (disclose) {
        learnwand(obj[0]);
        if (was_unkn)
            more_experienced(0, 10);
    }
    return;
    } finally { stack_pop($frame); }
}

/* augment damage for a spell based on the hero's intelligence (and level) */
export function spell_damage_bonus(
    dmg) { /* int */ /* base amount to be adjusted by bonus or penalty */
    let intell = ACURR(A_INT);

    /* Punish low intelligence before low level else low intelligence
       gets punished only when high level */
    if (intell <= 9) {
        /* -3 penalty, but never reduce combined amount below 1
           (if dmg is 0 for some reason, we're careful to leave it there) */
        if (dmg > 1)
            dmg = (dmg <= 3) ? 1 : dmg - 3;
    } else if (intell <= 13 || u.ulevel < 5)
        ; /* no bonus or penalty; dmg remains same */
    else if (intell <= 18)
        dmg += 1;
    else if (intell <= 24 || u.ulevel < 14)
        dmg += 2;
    else
        dmg += 3; /* Int 25 */

    return dmg;
}

/*
 * Generate the to-hit bonus for a spell.  Based on the hero's skill in
 * spell class and dexterity.
 */
function spell_hit_bonus(skill) { /* int */
    let hit_bon = 0;
    let dex = ACURR(A_DEX);

    switch (P_SKILL(spell_skilltype(skill))) {
    case P_ISRESTRICTED:
    case P_UNSKILLED:
        hit_bon = -4;
        break;
    case P_BASIC:
        hit_bon = 0;
        break;
    case P_SKILLED:
        hit_bon = 2;
        break;
    case P_EXPERT:
        hit_bon = 3;
        break;
    }

    if (dex < 4)
        hit_bon -= 3;
    else if (dex < 6)
        hit_bon -= 2;
    else if (dex < 8)
        hit_bon -= 1;
    else if (dex < 14)
        /* Will change when print stuff below removed */
        hit_bon -= 0;
    else
        /* Even increment for dexterous heroes (see weapon.c abon) */
        hit_bon += dex - 14;

    return hit_bon;
}

export function exclam(force) { /* const char * */
    /* force == 0 occurs e.g. with sleep ray */
    /* note that large force is usual with wands so that !! would
            require information about hand/weapon/wand */
    return ((force < 0) ? _("?") : (force <= 4) ? _(".") : _("!"));
}

export function hit(
    str,
    mtmp,
    force) { /* void */ /* usually either "." or "!" via exclam() */
    let verbosely = (mtmp == gy.youmonst
                         || (flags.verbose
                             && (cansee(gb.bhitpos.x, gb.bhitpos.y)
                                 || canspotmon(mtmp) || engulfing_u(mtmp))) ? 1 : 0);

    pline(_("%s %s %s%s"), The(str), vtense(str, _("hit")),
          verbosely ? mon_nam(mtmp) : _("it"), force);
}

export function miss(str, mtmp) { /* void */
    pline(_("%s %s %s."), The(str), vtense(str, _("miss")),
          ((cansee(gb.bhitpos.x, gb.bhitpos.y) || canspotmon(mtmp))
           && flags.verbose) ? mon_nam(mtmp) : _("it"));
}

function skiprange(range, skipstart, skipend) { /* void */
    let tr = Math.trunc(range / 4);
    let tmp = range - ((tr > 0) ? rnd(tr) : 0);

    skipstart[0] = tmp;
    skipend[0] = tmp - (Math.trunc(tmp / 4) * rnd(3));
    if (skipend[0] >= tmp)
        skipend[0] = tmp - 1;
}

/* Maybe explode a trap hit by object otmp's effect;
   cancellation beam hitting a magical trap causes an explosion.
   Might delete the trap; won't destroy otmp. */
function maybe_explode_trap(
    ttmp,
    otmp,
    learn_it) { /* void */
    if (!ttmp || !otmp)
        return;
    if (otmp.otyp == WAN_CANCELLATION || otmp.otyp == SPE_CANCELLATION) {
        let x = ttmp.tx, y = ttmp.ty;

        if (undestroyable_trap(ttmp.ttyp)) {
            shieldeff(x, y);
            if (cansee(x, y)) {
                ttmp.tseen = 1;
                newsym(x, y);
                chars[learn_it] = TRUE;
            }
        } else if (is_magical_trap(ttmp.ttyp)) {
            let seeit = cansee(x, y);

            /* note: this explosion mustn't destroy otmp */
            explode(x, y, -WAN_CANCELLATION,
                    20 + d(3, 6), TRAP_EXPLODE, EXPL_MAGICAL);
            deltrap(ttmp);
            newsym(x, y);
            if (seeit)
                chars[learn_it] = TRUE;
        }
    }
}

/* zap_map() occurs before hitting monsters or objects and handles wands or
   spells that don't dish out 'elemental' damage */
function zap_map(
    x, y,
    obj) { /* void */ /* zapped wand, or book for cast spell */
    const $frame = stack_frame(); try {
    let ttmp = t_at(x, y);
    let dbx = stack_var(coordxy, x), dby = stack_var(coordxy, y); /* might be changed by drawbridge handling */
    let learn_it = stack_var(boolean, FALSE);

    /*
     * We handle drawbridge for lateral zaps; zap_updown() handles up/down.
     * Engravings only get hit by down zaps and we handle that here.
     */

    /* cancellation */
    maybe_explode_trap(ttmp, obj, addr_of(learn_it));
    ttmp = t_at(x, y); /* refresh in case trap was altered or is gone */

    if (u.dz > 0) { /* zapping down */
        let ebuf = stack_array(char, BUFSZ), pristinebuf = stack_array(char, BUFSZ), etxt;
        let e = engr_at(x, y);

        /* subset of engraving effects; none sets `disclose' */
        if (e && e.engr_type != HEADSTONE) {
            switch (obj.otyp) {
            case WAN_POLYMORPH:
            case SPE_POLYMORPH:
                del_engr(e);
                etxt = random_engraving(ebuf, pristinebuf);
                make_engr_at(x, y, etxt, pristinebuf, svm.moves, 0);
                break;
            case WAN_CANCELLATION:
            case SPE_CANCELLATION:
            case WAN_MAKE_INVISIBLE:
                del_engr(e);
                break;
            case WAN_TELEPORTATION:
            case SPE_TELEPORT_AWAY:
                rloc_engr(e);
                break;
            case SPE_STONE_TO_FLESH:
                if (e.engr_type == ENGRAVE) {
                    /* only affects things in stone */
                    pline_The(Hallucination()
                                  ? _("floor runs like butter!")
                                  : _("edges on the floor get smoother."));
                    wipe_engr_at(x, y, d(2, 4), TRUE);
                }
                break;
            case WAN_STRIKING:
            case SPE_FORCE_BOLT:
                wipe_engr_at(x, y, d(2, 4), TRUE);
                break;
            default:
                break;
            }
        }
    } else if (!u.dz) {
        let ltyp = levl()[x][y].typ;

        if (find_drawbridge(dbx, dby)) {
            switch (obj.otyp) {
            case WAN_OPENING:
            case SPE_KNOCK:
                /* dbwall: 'closed door' of raised drawbridge */
                if (is_db_wall(x, y)) {
                    if (cansee(dbx[0], dby[0]) || cansee(x, y))
                        learn_it[0] = TRUE;
                    open_drawbridge(dbx[0], dby[0]);
                }
                break;
            case WAN_LOCKING:
            case SPE_WIZARD_LOCK:
                /* drawbridge_down: span of lowered drawbridge */
                if ((cansee(dbx[0], dby[0]) || cansee(x, y))
                    && levl()[dbx[0]][dby[0]].typ == DRAWBRIDGE_DOWN)
                    learn_it[0] = TRUE;
                close_drawbridge(dbx[0], dby[0]);
                break;
            case WAN_STRIKING:
            case SPE_FORCE_BOLT:
                /* !drawbridge_up: not spot in front of raised bridge,
                   so either span of lowered bridge or portcullis */
                if (ltyp != DRAWBRIDGE_UP) {
                    learn_it[0] = TRUE;
                    destroy_drawbridge(dbx[0], dby[0]);
                }
                break;
            }
        } /* find_drawbridge */
    } /* !u.uz */

    if (obj.otyp == WAN_PROBING) {
        /*
         * Probing, either up/down or lateral.
         */
        let ltyp;
        let oldtyp, oldglyph;

        /* map terrain; might reveal a special room which is already within
           view that hasn't been entered yet */
        oldtyp = chars[svl.lastseentyp[x] + y];
        oldglyph = glyph_at(x, y);
        show_map_spot(x, y, FALSE);
        if (oldtyp != chars[svl.lastseentyp[x] + y] || oldglyph != glyph_at(x, y)) {
            /* TODO: ought to give some message */
            learn_it[0] = TRUE;
        }
        ltyp = SURFACE_AT(x, y);
        /* secret door gets revealed, converted into regular door */
        if (ltyp == SDOOR) {
            cvt_sdoor_to_door(levl()[x][y]); /* .typ = DOOR */
            recalc_block_point(x, y);
            newsym(x, y);
            if (cansee(x, y)) {
                pline(_("Probing reveals a secret door."));
                learn_it[0] = TRUE;
            } else if (Is_rogue_level(u.uz)) { /* from zap_over_floor() */
                draft_message(FALSE); /* "You feel a draft." (open doorway) */
            }

        /* secret corridor likewise, although only ones within view will
           still be secret; for the !cansee(x,y) case, show_map_spot()
           above has already converted the spot to regular corridor */
        } else if (ltyp == SCORR) {
            levl()[x][y].typ = CORR;
            unblock_point(x, y);
            newsym(x, y);
            pline(_("Probing exposes a secret corridor."));
            learn_it[0] = TRUE;

        /* if on or over ice, describe it ("solid ice", "thin ice", &c);
           likewise for furniture in case hero is levitating while blind */
        } else if (ltyp == ICE || IS_FURNITURE(ltyp)) {
            if (u.dz > 0) { /* down, which also means x,y == u.ux,u.uy */
                force_decor(TRUE);
                learn_it[0] = TRUE;
            }
        }
        /*
         * Probing reveals undiscovered traps.
         *
         * FIXME?  This finds floor traps even when zapping up and
         * ceiling traps even when zapping down.
         */
        if (ttmp) {
            let ttmpname;
            let t_already_seen = ttmp.tseen;
            let use_the, hallu = +(Hallucination() != 0);

            /* should probably be changed to use sense_trap(detect.c)
               so that trap can temporarily be forced to be shown and
               map browsing can take place before it reverts to being
               covered by monster or object(s) */
            ttmp.tseen = 1;
            newsym(x, y);

            if (!t_already_seen || hallu) {
                ttmpname = trapname(ttmp.ttyp, FALSE);
                use_the = !hallu ? (ttmp.ttyp == VIBRATING_SQUARE
                                    && Invocation_lev(u.uz) ? 1 : 0)
                                 : +!rn2(4);
                You(_("find %s%c"),
                    use_the ? the(ttmpname) : an(ttmpname),
                    use_the ? ord('!') : ord('.'));
                learn_it[0] = +!hallu;
            }
        } /* t_at() */
    } /* probing */

    if (learn_it[0])
        learnwand(obj);
    return;
    } finally { stack_pop($frame); }
}

/*
 *  Called for the following distance effects:
 *      when a weapon is thrown (weapon == THROWN_WEAPON)
 *      when an object is kicked (KICKED_WEAPON)
 *      when an IMMEDIATE wand is zapped (ZAPPED_WAND)
 *      when a light beam is flashed (FLASHED_LIGHT)
 *      when a mirror is applied (INVIS_BEAM)
 *  A thrown/kicked object falls down at end of its range or when a monster
 *  is hit.  The variable 'gb.bhitpos' is set to the final position of the
 *  weapon thrown/zapped.  The ray of a wand may affect (by calling a provided
 *  function) several objects and monsters on its path.  The return value
 *  is the monster hit (weapon != ZAPPED_WAND), or a null monster pointer.
 *
 *  Thrown and kicked objects (THROWN_WEAPON or KICKED_WEAPON) may be
 *  destroyed and *pobj set to NULL to indicate this.
 *
 *  Check !u.uswallow before calling bhit().
 *  This function reveals the absence of a remembered invisible monster in
 *  necessary cases (throwing or kicking weapons).  The presence of a real
 *  one is revealed for a weapon, but if not a weapon is left up to fhitm().
 *
 *  If fhitm returns non-zero value, stops the beam and returns the monster
 */
export function bhit(
    ddx, ddy, range,
    weapon,
    fhitm,
    fhito,
    pobj) { /* struct monst * */ /* object tossed/used, set to NULL * if object is destroyed */
    const $frame = stack_frame(); try {
    var mtmp, result = null;
    var obj = pobj[0];
    var ttmp;
    var typ;
    var shopdoor = FALSE, point_blank = TRUE;
    var in_skip = FALSE, allow_skip = FALSE;
    var tethered_weapon = FALSE;
    var skiprange_start = stack_var(int, 0), skiprange_end = stack_var(int, 0), skipcount = 0;
    var was_returning = (iflags.returning_missile == addr_of(obj)) ? obj
                                : null;

    if (weapon == KICKED_WEAPON) {
        /* object starts one square in front of player */
        gb.bhitpos.x = u.ux + ddx;
        gb.bhitpos.y = u.uy + ddy;
        range--;
    } else {
        gb.bhitpos.x = u.ux;
        gb.bhitpos.y = u.uy;
    }

    if (weapon == THROWN_WEAPON && obj && obj.otyp == ROCK) {
        skiprange(range, skiprange_start, skiprange_end);
        allow_skip = +!rn2(3);
    }

    if (weapon == FLASHED_LIGHT) {
        tmp_at(DISP_BEAM, cmap_to_glyph(S_flashbeam));
    } else if (weapon == THROWN_TETHERED_WEAPON && obj) {
        tethered_weapon = TRUE;
        weapon = THROWN_WEAPON; /* simplify 'if's that follow below */
        tmp_at(DISP_TETHER, obj_to_glyph(obj, rn2_on_display_rng));
    } else if (weapon != ZAPPED_WAND && weapon != INVIS_BEAM)
        tmp_at(DISP_FLASH, obj_to_glyph(obj, rn2_on_display_rng));

    bhit_done: { while (range-- > 0) {
        var x, y;
        var xyglyph;

        gb.bhitpos.x += ddx;
        gb.bhitpos.y += ddy;
        x = gb.bhitpos.x;
        y = gb.bhitpos.y;

        if (!isok(x, y)) {
            gb.bhitpos.x -= ddx;
            gb.bhitpos.y -= ddy;
            break;
        }

        if (is_pick(obj) && inside_shop(x, y)
            && (mtmp = shkcatch(obj, x, y)) != null) {
            tmp_at(DISP_END, 0);
            result = mtmp;
            break bhit_done;
        }

        typ = uchar(levl()[x][y].typ);

        /* WATER aka "wall of water" stops items */
        if (IS_WATERWALL(typ) || typ == LAVAWALL) {
            if (weapon == THROWN_WEAPON || weapon == KICKED_WEAPON)
                break;
        }

        /* iron bars will block anything big enough and break some things */
        if (weapon == THROWN_WEAPON || weapon == KICKED_WEAPON) {
            if (obj.lamplit && !Blind())
                show_transient_light(obj, x, y);
            if (typ == IRONBARS
                && hits_bars(pobj, x - ddx, y - ddy, x, y,
                             point_blank ? 0 : +!rn2(5), 1)) {
                /* caveat: obj might now be null... */
                obj = pobj[0];  /* not currently needed due to 'break'; keep */
                (obj);   /* in case usage gets added after the loop   */
                gb.bhitpos.x -= ddx;
                gb.bhitpos.y -= ddy;
                break;
            }
        } else if (weapon == FLASHED_LIGHT) {
            if (!Blind())
                show_transient_light(null, x, y);
        }

        if (weapon == ZAPPED_WAND) {
            /* cancellation/opening/locking/striking/probing */
            zap_map(x, y, obj);
            /* terrain might have changed (exposed secret door|corridor) */
            typ = uchar(levl()[x][y].typ);
        }

        mtmp = m_at(x, y);
        ttmp = t_at(x, y);
        if (!mtmp && ttmp && (ttmp.ttyp == WEB)
            && (weapon == THROWN_WEAPON || weapon == KICKED_WEAPON)
            && !rn2(3)) {
            if (cansee(x, y)) {
                pline(_("%s gets stuck in a web!"), Yname2(obj));
                ttmp.tseen = TRUE;
                newsym(x, y);
            }
            if (was_returning)
                iflags.returning_missile = 0;
            break;
        }

        /*
         * skipping rocks
         *
         * skiprange_start is only set if this is a thrown rock
         */
        if (skiprange_start[0] && (range == skiprange_start[0]) && allow_skip) {
            if (is_pool(x, y) && !mtmp) {
                in_skip = TRUE;
                if (!Blind())
                    pline(_("%s %s%s."), Yname2(obj), otense(obj, _("skip")),
                          skipcount ? _(" again") : _(""));
                else
                    You_hear(_("%s skip."), yname(obj));
                skipcount++;
            } else if (skiprange_start[0] > skiprange_end[0] + 1) {
                --skiprange_start[0];
            }
        }
        if (in_skip) {
            if (range <= skiprange_end[0]) {
                in_skip = FALSE;
                if (range > 3) /* another bounce? */
                    skiprange(range, skiprange_start, skiprange_end);
            } else if (mtmp && M_IN_WATER(mtmp.data)) {
                if (!Blind() && canspotmon(mtmp))
                    pline(_("%s %s over %s."), Yname2(obj), otense(obj, _("pass")),
                          mon_nam(mtmp));
                mtmp = null;
            }
        }

        /* if mtmp is a shade and missile passes harmlessly through it,
           give message and skip it in order to keep going;
           if attack is light and mtmp is a mimic pretending to be an
           object, behave as if there is no monster here (if pretending
           to be furniture, it will be revealed by flash_hits_mon());
           thrown objects don't hit mimics pretending to be objects (both
           because the hero is likely aiming to throw over what seems to
           be an object rather than at it, and for balance because
           otherwise mimics are too easy to identify by throwing gold at
           them); exception: if the hero knows there is a monster there,
           they will be aiming at the monster */
        xyglyph = glyph_at(x, y);
        if (mtmp && (((weapon == THROWN_WEAPON || weapon == KICKED_WEAPON)
                      && (shade_miss(gy.youmonst, mtmp, obj, TRUE, TRUE)
                          || (M_AP_TYPE(mtmp) == M_AP_OBJECT
                              && !glyph_is_monster(xyglyph)
                              && !glyph_is_warning(xyglyph)
                              && !glyph_is_invisible(xyglyph))))
                     || (weapon == FLASHED_LIGHT
                         && M_AP_TYPE(mtmp) == M_AP_OBJECT)))
            mtmp = null;

        if (mtmp) {
            gn.notonhead = +(x != mtmp.mx || y != mtmp.my);
            if (weapon == FLASHED_LIGHT) {
                /* FLASHED_LIGHT hitting invisible monster should pass
                   through instead of stop so we call flash_hits_mon()
                   directly rather than returning mtmp back to caller.
                   That allows the flash to keep on going.  Note that we
                   use mtmp->minvis, not canspotmon(), because it makes no
                   difference whether hero can see the monster or not. */
                if (mtmp.minvis) {
                    obj.ox = u.ux, obj.oy = u.uy;
                    flash_hits_mon(mtmp, obj);
                } else {
                    tmp_at(DISP_END, 0);
                    result = mtmp; /* caller will call flash_hits_mon() */
                    break bhit_done;
                }
            } else if (weapon == INVIS_BEAM) {
                /* Like FLASHED_LIGHT, INVIS_BEAM should continue
                   through invisible targets; unlike it, we aren't
                   prepared for multiple hits so just get first one
                   that's either visible or could see its invisible
                   self.  [No tmp_at() cleanup is needed here.] */
                if (!mtmp.minvis || perceives(mtmp.data)) {
                    result = mtmp;
                    break bhit_done;
                }
            } else if (weapon != ZAPPED_WAND) {
                /* THROWN_WEAPON, KICKED_WEAPON */
                if (!tethered_weapon)
                    tmp_at(DISP_END, 0);

                if (cansee(x, y) && !canspotmon(mtmp))
                    map_invisible(x, y);
                result = mtmp;
                break bhit_done;
            } else {
                /* ZAPPED_WAND */
                if (fhitm(mtmp, obj)) {
                    result = mtmp;
                    break bhit_done;
                }
                range -= 3;
            }
        } else {
            if (weapon == ZAPPED_WAND && obj.otyp == WAN_PROBING
                && glyph_is_invisible(levl()[x][y].glyph)) {
                unmap_object(x, y);
                newsym(x, y);
            }
        }
        if (fhito) {
            if (bhitpile(obj, fhito, x, y, 0))
                range--;
        } else {
            if (weapon == KICKED_WEAPON
                && ((obj.oclass == COIN_CLASS && OBJ_AT(x, y))
                    || ship_object(obj, x, y, costly_spot(x, y)))) {
                tmp_at(DISP_END, 0);
                break bhit_done; /* result == (struct monst *) 0 */
            }
        }
        if (weapon == ZAPPED_WAND && (IS_DOOR(typ) || typ == SDOOR)) {
            switch (obj.otyp) {
            case WAN_OPENING:
            case WAN_LOCKING:
            case WAN_STRIKING:
            case SPE_KNOCK:
            case SPE_WIZARD_LOCK:
            case SPE_FORCE_BOLT:
                if (doorlock(obj, x, y)) {
                    if (cansee(x, y) || (obj.otyp == WAN_STRIKING && !Deaf()))
                        learnwand(obj);
                    if (levl()[x][y].flags == D_BROKEN
                        && chars[in_rooms(x, y, SHOPBASE)]) {
                        shopdoor = TRUE;
                        add_damage(x, y, SHOP_DOOR_COST);
                    }
                }
                break;
            }
        }
        if (!ZAP_POS(typ) || closed_door(x, y)) {
            gb.bhitpos.x -= ddx;
            gb.bhitpos.y -= ddy;
            break;
        }
        if (weapon != ZAPPED_WAND && weapon != INVIS_BEAM) {
            /* 'I' present but no monster: erase; do this before tmp_at() */
            if (glyph_is_invisible(levl()[x][y].glyph) && cansee(x, y)) {
                unmap_object(x, y);
                newsym(x, y);
            }
            tmp_at(x, y);
            nh_delay_output()();
            /* kicked objects fall in pools */
            if ((weapon == KICKED_WEAPON) && is_pool_or_lava(x, y))
                break;
            if (IS_SINK(typ) && weapon != FLASHED_LIGHT)
                break; /* physical objects fall onto sink */
        }
        /* limit range of ball so hero won't make an invalid move */
        if (weapon == THROWN_WEAPON && range > 0
            && obj.otyp == HEAVY_IRON_BALL) {
            var bobj;
            var t;

            if ((bobj = sobj_at(BOULDER, x, y)) != null) {
                if (cansee(x, y))
                    pline(_("%s hits %s."), The(distant_name(obj, xname)),
                          an(xname(bobj)));
                range = 0;
            } else if (obj == uball) {
                if (!test_move(x - ddx, y - ddy, ddx, ddy, TEST_MOVE)) {
                    /* nb: it didn't hit anything directly */
                    if (cansee(x, y))
                        pline(_("%s jerks to an abrupt halt."),
                              The(distant_name(obj, xname))); /* lame */
                    range = 0;
                } else if (Sokoban() && (t = t_at(x, y)) != null
                           && (is_pit(t.ttyp) || is_hole(t.ttyp))) {
                    /* hero falls into the trap, so ball stops */
                    range = 0;
                }
            }
        }

        /* thrown/kicked missile has moved away from its starting spot */
        point_blank = FALSE; /* affects passing through iron bars */
    }

    if ((weapon != ZAPPED_WAND && weapon != INVIS_BEAM && !tethered_weapon)
        || (was_returning && was_returning != view_of(struct_obj, iflags.returning_missile)))
        tmp_at(DISP_END, 0);

    if (shopdoor)
        pay_for_damage(_("destroy"), FALSE);
 }
    /* note: for FLASHED_LIGHT, _caller_ must call transient_light_cleanup()
       after possibly calling flash_hits_mon() */
    if (weapon == THROWN_WEAPON || weapon == KICKED_WEAPON)
        transient_light_cleanup();

    return result;
    } finally { stack_pop($frame); }
}

/* process thrown boomerang, which travels a curving path...
 * A multi-shot volley ought to have all missiles in flight at once,
 * but we're called separately for each one.  We terminate the volley
 * early on a failed catch since continuing to throw after being hit
 * is too obviously silly.
 */
export function boomhit(obj$, dx, dy) { /* struct monst * */
    const $frame = stack_frame(); try {
    const obj = stack_var(ptr_to(struct_obj), obj$);
    let i, ct;
    let boom; /* showsym[] index  */
    let mtmp;
    let counterclockwise = URIGHTY(); /* ULEFTY => clockwise */
    let nhits = max(1, obj[0].spe + 1);

    /* counterclockwise traversal patterns, from @ to 1 then on through to 9
     *  ..........................54.................................
     *  ..................43.....6..3....765.........................
     *  ..........32.....5..2...7...2...8...4....87..................
     *  .........4..1....6..1...8..1....9...3...9..6.....98..........
     *  ..21@....5...@...7..@....9@......@12....@...5...@..7.....@9..
     *  .3...9....6..9....89.....................1..4...1..6....1..8.
     *  .4...8.....78.............................23....2..5...2...7.
     *  ..567............................................34....3..6..
     *  ........................................................45...
     * (invert rows for corresponding clockwise patterns)
     */

    gb.bhitpos.x = u.ux;
    gb.bhitpos.y = u.uy;
    boom = counterclockwise ? S_boomleft : S_boomright;
    i = xytodir(dx, dy);
    tmp_at(DISP_FLASH, cmap_to_glyph(boom));
    for (ct = 0; ct < 10; ct++) {
        i = DIR_CLAMP(i);
        boom = (S_boomleft + S_boomright - boom); /* toggle */
        tmp_at(DISP_CHANGE, cmap_to_glyph(boom)); /* change glyph */
        dx = chars[xdir + i];
        dy = chars[ydir + i];
        gb.bhitpos.x += dx;
        gb.bhitpos.y += dy;
        if (!isok(gb.bhitpos.x, gb.bhitpos.y)) {
            gb.bhitpos.x -= dx;
            gb.bhitpos.y -= dy;
            break;
        }
        if ((mtmp = m_at(gb.bhitpos.x, gb.bhitpos.y)) != null) {
            m_respond(mtmp);
            if (nhits-- < 0) {
                tmp_at(DISP_END, 0);
                return mtmp;
            } else if (throwit_mon_hit(obj[0], mtmp) || !gt.thrownobj) {
                break;
            }
        }
        if (!ZAP_POS(levl()[gb.bhitpos.x][gb.bhitpos.y].typ)
            || closed_door(gb.bhitpos.x, gb.bhitpos.y)) {
            gb.bhitpos.x -= dx;
            gb.bhitpos.y -= dy;
            break;
        }
        if (u_at(gb.bhitpos.x, gb.bhitpos.y)) { /* ct == 9 */
            if (Fumbling() || rn2(20) >= ACURR(A_DEX)) {
                let dam = dmgval(obj[0], gy.youmonst);

                /* we hit ourselves */
                thitu(10 + obj[0].spe, Maybe_Half_Phys(dam), obj,
                             _("boomerang"));
                endmultishot(TRUE);
                break;
            } else { /* we catch it */
                tmp_at(DISP_END, 0);
                You(_("skillfully catch the boomerang."));
                return gy.youmonst;
            }
        }
        tmp_at(gb.bhitpos.x, gb.bhitpos.y);
        nh_delay_output()();
        if (IS_SINK(levl()[gb.bhitpos.x][gb.bhitpos.y].typ)) {
             ;
            if (!Deaf())
                pline(_("Klonk!"));
            wake_nearto(gb.bhitpos.x, gb.bhitpos.y, 20);
            break; /* boomerang falls on sink */
        }
        /* ct==0, initial position, we want next delta to be same;
           ct==5, opposite position, repeat delta undoes first one */
        if (ct % 5 != 0)
            i = counterclockwise ? DIR_LEFT(i) : DIR_RIGHT(i);
    }
    tmp_at(DISP_END, 0); /* do not leave last symbol */
    return null;
    } finally { stack_pop($frame); }
}

/* used by buzz(); also used by munslime(muse.c); returns damage applied
   to mon; note: caller is responsible for killing mon if damage is fatal */
export function zhitm(
    mon,
    type,
    nd,
    ootmp) { /* int */ /* to return worn armor for caller to disintegrate */
    let tmp = 0, orig_dmg = 0; /* damage amount */
    let damgtype = zaptype(type) % 10;
    let sho_shieldeff = FALSE;
    let spellcaster = is_hero_spell(type); /* maybe get a bonus! */

    ootmp[0] = null;
    switch (damgtype) {
    case ZT_MAGIC_MISSILE:
        if (resists_magm(mon) || defended(mon, AD_MAGM)) {
            sho_shieldeff = TRUE;
            break;
        }
        tmp = d(nd, 6);
        if (spellcaster)
            tmp = spell_damage_bonus(tmp);
        break;
    case ZT_FIRE:
        if (resists_fire(mon) || defended(mon, AD_FIRE)) {
            sho_shieldeff = TRUE;
            break;
        }
        tmp = d(nd, 6);
        if (spellcaster)
            tmp = spell_damage_bonus(tmp);
        orig_dmg = tmp; /* includes spell bonus but not monster vuln to fire */
        if (resists_cold(mon))
            tmp += 7;
        if (burnarmor(mon)) {
            if (!rn2(3)) {
                tmp += destroy_items(mon, AD_FIRE, orig_dmg);
                ignite_items(mon.minvent);
            }
        }
        break;
    case ZT_COLD:
        if (resists_cold(mon) || defended(mon, AD_COLD)) {
            sho_shieldeff = TRUE;
            break;
        }
        tmp = d(nd, 6);
        if (spellcaster)
            tmp = spell_damage_bonus(tmp);
        orig_dmg = tmp; /* includes spell bonus but not monster vuln to cold */
        if (resists_fire(mon))
            tmp += d(nd, 3);
        if (!rn2(3))
            tmp += destroy_items(mon, AD_COLD, orig_dmg);
        break;
    case ZT_SLEEP:
        /* resistance and shield effect and revealing concealed mimic are
           handled by sleep_monst() */
        tmp = 0;
        sleep_monst(mon, d(nd, 25),
                           type == ZT_WAND(ZT_SLEEP) ? WAND_CLASS : ord('\0'));
        break;
    case ZT_DEATH:                              /* death/disintegration */
        if (abs(type) != ZT_BREATH(ZT_DEATH)) { /* death */
            if (mon.data == mons[PM_DEATH]) {
                healmon(mon, Math.trunc(mon.mhpmax * 3 / 2), Math.trunc(mon.mhpmax / 2));
                if (mon.mhpmax >= MAGIC_COOKIE)
                    mon.mhpmax = MAGIC_COOKIE - 1;
                tmp = 0;
                break;
            }
            if (nonliving(mon.data) || is_demon(mon.data)
                || is_vampshifter(mon) || resists_magm(mon)) {
                /* similar to player */
                sho_shieldeff = TRUE;
                break;
            }
            type = -1; /* so they don't get saving throws */
        } else {
            let otmp2;

            if (resists_disint(mon) || defended(mon, AD_DISN)) {
                sho_shieldeff = TRUE;
            } else if (mon.misc_worn_check & W_ARMS) {
                /* destroy shield; victim survives */
                ootmp[0] = which_armor(mon, W_ARMS);
            } else if (mon.misc_worn_check & W_ARM) {
                /* destroy suit, also cloak if present */
                ootmp[0] = which_armor(mon, W_ARM);
                if ((otmp2 = which_armor(mon, W_ARMC)) != null)
                    m_useup(mon, otmp2);
            } else {
                /* no suit, victim dies; destroy cloak
                   and shirt now in case target gets life-saved */
                tmp = MAGIC_COOKIE;
                if ((otmp2 = which_armor(mon, W_ARMC)) != null)
                    m_useup(mon, otmp2);
                if ((otmp2 = which_armor(mon, W_ARMU)) != null)
                    m_useup(mon, otmp2);
            }
            type = -1; /* no saving throw wanted */
            break;     /* not ordinary damage */
        }
        tmp = mon.mhp + 1;
        break;
    case ZT_LIGHTNING:
        tmp = d(nd, 6);
        if (spellcaster)
            tmp = spell_damage_bonus(tmp);
        orig_dmg = tmp;
        if (resists_elec(mon) || defended(mon, AD_ELEC)) {
            sho_shieldeff = TRUE;
            tmp = 0;
            /* can still blind the monster */
        }
        if (!resists_blnd(mon)
            && !(type > 0 && engulfing_u(mon))
            && nd > 2) {
            /* sufficiently powerful lightning blinds monsters */
            let rnd_tmp = unsigned(rnd(50));
            mon.mcansee = 0;
            if (unsigned(mon.mblinded + rnd_tmp) > 127)
                mon.mblinded = 127;
            else
                mon.mblinded += rnd_tmp;
        }
        if (!rn2(3))
            tmp += destroy_items(mon, AD_ELEC, orig_dmg);
        break;
    case ZT_POISON_GAS:
        if (resists_poison(mon) || defended(mon, AD_DRST)) {
            sho_shieldeff = TRUE;
            break;
        }
        tmp = d(nd, 6);
        break;
    case ZT_ACID:
        if (resists_acid(mon) || defended(mon, AD_ACID)) {
            sho_shieldeff = TRUE;
            break;
        }
        tmp = d(nd, 6);
        if (!rn2(6))
            acid_damage(MON_WEP(mon));
        if (!rn2(6))
            erode_armor(mon, ERODE_CORRODE);
        break;
    }
    if (sho_shieldeff)
        shieldeff(mon.mx, mon.my);
    if (is_hero_spell(type) && (Role_if(PM_KNIGHT) && u.uhave.questart))
        tmp *= 2;
    if (tmp > 0 && type >= 0
        && resist(mon, type < ZT_SPELL(0) ? WAND_CLASS : ord('\0'), 0, NOTELL))
        tmp = Math.trunc(tmp / 2);
    if (tmp < 0)
        tmp = 0; /* don't allow negative damage */
    do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(_("zapped monster hp = %d (= %d - %d)"), mon.mhp - tmp, mon.mhp, tmp); iflags.last_msg = save_plnmsg; } } while (0)
;
    mon.mhp -= tmp;
    return tmp;
}

function zhitu(
    type, nd,
    fltxt,
    sx, sy) { /* void */
    const $frame = stack_frame(); try {
    let dam = 0, abstyp = zaptype(type);
    let orig_dam = 0;

    switch (abstyp % 10) {
    case ZT_MAGIC_MISSILE:
        if (Antimagic()) {
            shieldeff(sx, sy);
            pline_The(_("missiles bounce off!"));
            monstseesu(M_SEEN_MAGR);
        } else {
            dam = d(nd, 6);
            exercise(A_STR, FALSE);
            monstunseesu(M_SEEN_MAGR);
        }
        break;
    case ZT_FIRE:
        orig_dam = d(nd, 6);
        if (Fire_resistance()) {
            shieldeff(sx, sy);
            You(_("don't feel hot!"));
            monstseesu(M_SEEN_FIRE);
            ugolemeffects(AD_FIRE, orig_dam);
        } else {
            dam = orig_dam;
            monstunseesu(M_SEEN_FIRE);
        }
        burn_away_slime();
        if (burnarmor(gy.youmonst)) { /* "body hit" */
            if (!rn2(3))
                destroy_items(gy.youmonst, AD_FIRE, orig_dam);
            if (!rn2(3))
                ignite_items(gi.invent);
        }
        break;
    case ZT_COLD:
        orig_dam = d(nd, 6);
        if (Cold_resistance()) {
            shieldeff(sx, sy);
            You(_("don't feel cold."));
            monstseesu(M_SEEN_COLD);
            ugolemeffects(AD_COLD, orig_dam);
        } else {
            dam = orig_dam;
            monstunseesu(M_SEEN_COLD);
        }
        if (!rn2(3))
            destroy_items(gy.youmonst, AD_COLD, orig_dam);
        break;
    case ZT_SLEEP:
        if (Sleep_resistance()) {
            shieldeff(u.ux, u.uy);
            You(_("don't feel sleepy."));
            monstseesu(M_SEEN_SLEEP);
        } else {
            monstunseesu(M_SEEN_SLEEP);
            fall_asleep(-d(nd, 25), TRUE); /* sleep ray */
        }
        break;
    case ZT_DEATH:
        if (abstyp == ZT_BREATH(ZT_DEATH)) {
            let disn_prot = inventory_resistance_check(AD_DISN);

            if (Disint_resistance()) {
                You(_("are not disintegrated."));
                monstseesu(M_SEEN_DISINT);
                break;
            } else if (disn_prot) {
                break;
            }
            monstunseesu(M_SEEN_DISINT);
            if (uarms) {
                /* destroy shield; other possessions are safe */
                disintegrate_arm(uarms);
                break;
            } else if (uarm) {
                /* destroy suit; if present, cloak goes too */
                if (uarmc)
                    disintegrate_arm(uarmc);
                disintegrate_arm(uarm);
                break;
            }
            /* no shield or suit, you're dead; wipe out cloak
               and/or shirt in case of life-saving or bones */
            if (uarmc)
                disintegrate_arm(uarmc);
            if (uarmu)
                disintegrate_arm(uarmu);
        } else if (nonliving(gy.youmonst.data) || is_demon(gy.youmonst.data)) {
            shieldeff(sx, sy);
            You(_("seem unaffected."));
            break;
        } else if (Antimagic()) {
            shieldeff(sx, sy);
            monstseesu(M_SEEN_MAGR);
            You(_("aren't affected."));
            break;
        }
        monstunseesu(M_SEEN_MAGR);
        svk.killer.format = KILLED_BY_AN;
        strcpy(svk.killer.name, fltxt ? fltxt : _(""));
        /* when killed by disintegration breath, don't leave corpse */
        u.ugrave_arise = (type == -ZT_BREATH(ZT_DEATH)) ? -3 : NON_PM;
        done(DIED);
        return; /* lifesaved */
    case ZT_LIGHTNING:
        orig_dam = d(nd, 6);
        if (Shock_resistance()) {
            shieldeff(sx, sy);
            You(_("aren't affected."));
            monstseesu(M_SEEN_ELEC);
            ugolemeffects(AD_ELEC, orig_dam);
        } else {
            dam = orig_dam;
            exercise(A_CON, FALSE);
            monstunseesu(M_SEEN_ELEC);
        }
        if (!rn2(3))
            destroy_items(gy.youmonst, AD_ELEC, orig_dam);
        break;
    case ZT_POISON_GAS:
        poisoned(_("blast"), A_DEX, _("poisoned blast"), 15, FALSE);
        break;
    case ZT_ACID:
        if (Acid_resistance()) {
            pline_The(_("%s doesn't hurt."), hliquid(_("acid")));
            monstseesu(M_SEEN_ACID);
            dam = 0;
        } else {
            pline_The(_("%s burns!"), hliquid(_("acid")));
            dam = d(nd, 6);
            exercise(A_STR, FALSE);
            monstunseesu(M_SEEN_ACID);
        }
        /* using two weapons at once makes both of them more vulnerable */
        if (!rn2(u.twoweap ? 3 : 6))
            acid_damage(uwep);
        if (u.twoweap && !rn2(3))
            acid_damage(uswapwep);
        if (!rn2(6))
            erode_armor(gy.youmonst, ERODE_CORRODE);
        break;
    }

    /*
     * 5.0: when fatal, this used to yield "Killed by <fltxt>." without any
     * information about who was responsible.  Now 'buzzer' is used to try
     * to supply "zapped/cast/breathed by <mon> [imitating <other_mon>]."
     *
     * Room for improvement:  there is no monster available when player is
     * hit by divine lighting or by Plane of Air thunderstorm so cause of
     * death remains "killed by a bolt of lightning" w/o extra explanation.
     *
     * Wand of death, spell of finger of death, and disintegration breath
     * don't use this routine so don't include 'inflicted by'.
     */
    {
        let kbuf = stack_array(char, BUFSZ);
        let otmp = gc.current_wand;
        /* fire horn and frost horn get handled as wands by caller */
        let verb = (abstyp < 10) /* wand */
                           ? ((otmp && otmp.oclass == TOOL_CLASS) ? _("played")
                              : _("zapped"))
                           : (abstyp < 20) ? _("cast")
                             : (abstyp < 30) ? _("exhaled")
                               : _("imagined"); /* should never happen */

        if (type < 0 || (type == 0 && gb.buzzer != null)) {
            /* if gb.buzzer is Null, kbuf[] will end up with just <fltxt> */
            death_inflicted_by(kbuf, fltxt, gb.buzzer);
            /* change "death inflicted by mon" to "death <verb> by mon" */
            if (gb.buzzer)
                strsubst(kbuf, _("inflicted"), verb);
        } else {
            /* FIXME: "zapped by herself" is suitable for a rebound;
               "zapped at herself" would be better if player explicitly
               targeted hero */
            sprintf(kbuf, _("%s %s by %sself"), fltxt, verb, uhim());
        }
        /* Half_spell_damage protection yields half-damage for wands & spells,
           including hero's own ricochets; breath attacks do full damage */
        if (dam && Half_spell_damage() && abstyp < 20)
            dam = Math.trunc((dam + 1) / 2);
        losehp(dam, kbuf, KILLED_BY_AN);
    }
    return;
    } finally { stack_pop($frame); }
}

/*
 * burn objects (such as scrolls and spellbooks) on floor
 * at position x,y; return the number of objects burned
 */
export function burn_floor_objects(
    x, y,
    give_feedback,
    u_caused) { /* int */
    const $frame = stack_frame(); try {
    let obj, obj2;
    let i, scrquan, delquan;
    let buf1 = stack_array(char, BUFSZ), buf2 = stack_array(char, BUFSZ);
    let cnt = 0;

    for (obj = svl.level.objects[x][y]; obj; obj = obj2) {
        obj2 = obj.v.v_nexthere;
        if (obj.oclass == SCROLL_CLASS || obj.oclass == SPBOOK_CLASS
            || (obj.oclass == FOOD_CLASS
                && obj.otyp == GLOB_OF_GREEN_SLIME)) {
            if (obj.otyp == SCR_FIRE || obj.otyp == SPE_FIREBALL
                || obj_resists(obj, 2, 100))
                continue;
            scrquan = obj.quan; /* number present */
            delquan = 0;        /* number to destroy */
            for (i = scrquan; i > 0; i--)
                if (!rn2(3))
                    delquan++;
            if (delquan) {
                /* save name before potential delobj() */
                if (give_feedback) {
                    obj.quan = 1;
                    strcpy(buf1, u_at(x, y)
                                     ? xname(obj)
                                     : distant_name(obj, xname));
                    obj.quan = 2;
                    strcpy(buf2, u_at(x, y)
                                     ? xname(obj)
                                     : distant_name(obj, xname));
                    obj.quan = scrquan;
                }
                /* useupf(), which charges, only if hero caused damage */
                if (u_caused)
                    useupf(obj, delquan);
                else if (delquan < scrquan) {
                    obj.quan -= delquan;
                    obj.owt = unsigned(weight(obj));
                } else
                    delobj(obj);
                cnt += delquan;
                if (give_feedback) {
                    if (delquan > 1)
                        pline(_("%lld %s burn."), delquan, buf2);
                    else
                        pline(_("%s burns."), An(buf1));
                }
            }
        }
    }
    /* This also ignites floor items, but does not change cnt
       because they weren't consumed. */
    ignite_items(svl.level.objects[x][y]);
    return cnt;
    } finally { stack_pop($frame); }
}

/* which direction a ray bounces.
   current location is sx,sy, direction is ddx, ddy.
   bounceback is 1/n chance of bouncing back.
   caller must ensure sx,sy is a bouncing location: !ZAP_POS or closed_door
 */
function bounce_dir(sx, sy,
           ddx, ddy,
           bounceback) { /* void */
    if (!ddx[0] || !ddy[0] || (bounceback > 0 && !rn2(bounceback))) {
        ddx[0] = -(ddx[0]);
        ddy[0] = -(ddy[0]);
    } else {
        let rmn;
        let bounce = 0;
        let lsy = sy - ddy[0];
        let lsx = sx - ddx[0];

        if (isok(sx, lsy) && ZAP_POS(rmn = uchar(levl()[sx][lsy].typ))
            && !closed_door(sx, lsy)
            && (IS_ROOM(rmn) || (isok(sx + ddx[0], lsy)
                                 && ZAP_POS(levl()[sx + ddx[0]][lsy].typ))))
            bounce = 1;
        if (isok(lsx, sy) && ZAP_POS(rmn = uchar(levl()[lsx][sy].typ))
            && !closed_door(lsx, sy)
            && (IS_ROOM(rmn) || (isok(lsx, sy + ddy[0])
                                 && ZAP_POS(levl()[lsx][sy + ddy[0]].typ))))
            if (!bounce || rn2(2))
                bounce = 2;
        switch (bounce) {
        case 0:
            ddx[0] = -(ddx[0]);
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case 1:
            ddy[0] = -(ddy[0]);
            break;
        case 2:
            ddx[0] = -(ddx[0]);
            break;
        }
    }
}

/* will zap/spell/breath attack score a hit against armor class `ac'? */
function zap_hit(
    ac,
    type) { /* int */ /* either hero cast spell type or 0 */
    let chance = rn2(20);
    let spell_bonus = type ? spell_hit_bonus(type) : 0;

    /* small chance for naked target to avoid being hit */
    if (!chance)
        return +(rnd(10) < ac + spell_bonus);

    /* very high armor protection does not achieve invulnerability */
    ac = AC_VALUE(ac);

    return +(3 - chance < ac + spell_bonus);
}

function disintegrate_mon(
    mon,
    type,
    fltxt) { /* void */
    let otmp, otmp2, m_amulet = mlifesaver(mon);

    if (canseemon(mon)) {
        if (!m_amulet)
            pline(_("%s is disintegrated!"), Monnam(mon));
        else
            hit(fltxt, mon, _("!"));
    }

/* note: worn amulet of life saving must be preserved in order to operate */

    for (otmp = mon.minvent; otmp; otmp = otmp2) {
        otmp2 = otmp.nobj;
        if (!((((objects[otmp.otyp].oc_oprop == DISINT_RES) || obj_resists(otmp, 5, 50)) || is_quest_artifact(otmp)) || (otmp == m_amulet))) {
            extract_from_minvent(mon, otmp, TRUE, TRUE);
            obfree(otmp, null);
        }
    }

    if (type < 0)
        monkilled(mon, 0, -AD_RBRE);
    else
        xkilled(mon, XKILL_NOMSG | XKILL_NOCORPSE);
}

export function ubuzz(type, nd) { /* void */
    dobuzz(type, nd, u.ux, u.uy, u.dx, u.dy, TRUE, FALSE, FALSE);
}

export function buzz(type, nd, sx, sy, dx, dy) { /* void */
    dobuzz(type, nd, sx, sy, dx, dy, TRUE, FALSE, FALSE);
}

/*
 * type ==   0 to   9 : you zapping a wand
 * type ==  10 to  19 : you casting a spell
 * type ==  20 to  29 : you breathing as a monster
 * type == -10 to -19 : monster casting spell
 * type == -20 to -29 : monster breathing at you
 * type == -30 to -39 : monster zapping a wand
 * called with dx = dy = 0 for vertical bolts
 */
export function dobuzz(
    type,
    nd,
    sx, sy,
    dx$, dy$,
    sayhit, saymiss,
    forcemiss) { /* void */
    const $frame = stack_frame(); try {
    const dx = stack_var(int, dx$);
    const dy = stack_var(int, dy$);
    let $goto = null; var save_bhitpos = stack_struct(struct_nhcoord), shopdamage = stack_var(boolean), otmp = stack_var(ptr_to(struct_obj));
    var range, fltyp = zaptype(type), damgtype = fltyp % 10;
    var lsx, lsy;
    var mon;

    shopdamage[0] = FALSE;
            var fireball = +(type == ZT_SPELL(ZT_FIRE)),
            gas_hit = FALSE; /* will be set during each iteration */

    var spell_type;
    var hdmgtype = Hallucination() ? rn2(6) : damgtype;

    /* if it's a hero spell then get its SPE_TYPE */
    spell_type = is_hero_spell(type) ? SPE_MAGIC_MISSILE + damgtype : 0;

    if (u.uswallow) {
        var tmp;

        if (type < 0)
            return;
        tmp = zhitm(u.ustuck, type, nd, otmp);
        if (!u.ustuck) {
            u.uswallow = 0;
        } else {
            pline(_("%s rips into %s%s"), The(flash_str(fltyp, FALSE)),
                  mon_nam(u.ustuck), exclam(tmp));
            /* Using disintegration from the inside only makes a hole... */
            if (tmp == MAGIC_COOKIE)
                u.ustuck.mhp = 0;
            if (DEADMONSTER(u.ustuck))
                killed(u.ustuck);
        }
        return;
    }
    if (type < 0)
        newsym(u.ux, u.uy);
    range = rn1(7, 7);
    if (dx[0] == 0 && dy[0] == 0)
        range = 1;
    struct_assign(save_bhitpos, gb.bhitpos);

    tmp_at(DISP_BEAM, zapdir_to_glyph(dx[0], dy[0], hdmgtype));
    $out_buzzmonst: while (range-- > 0) {
        lsx = sx;
        sx += dx[0];
        lsy = sy;
        sy += dy[0];
        $goto_buzzmonst: for (;;) { switch ($goto) { default: if (!isok(sx, sy) || levl()[sx][sy].typ == STONE)
            { $goto = "make_bounce"; continue $goto_buzzmonst; };

        mon = m_at(sx, sy);
        if (cansee(sx, sy)) {
            /* reveal/unreveal invisible monsters before tmp_at() */
            if (mon && !canspotmon(mon))
                map_invisible(sx, sy);
            else if (!mon)
                unmap_invisible(sx, sy);
            if (ZAP_POS(levl()[sx][sy].typ)
                || (isok(lsx, lsy) && cansee(lsx, lsy)))
                tmp_at(sx, sy);
            nh_delay_output()(); /* wait a little */
        }

        /* hit() and miss() need gb.bhitpos to match the target */
        gb.bhitpos.x = sx, gb.bhitpos.y = sy;
        gas_hit = +(damgtype == ZT_POISON_GAS);
        /* fireballs only damage when they explode; poison gas leaves
           a trail of 1x1 clouds via zap_over_floor(), but that gets
           skipped for a hit that is reflected so is deferred until we
           know whether reflection is happening */
        if (!fireball && !gas_hit) {
            range += zap_over_floor(sx, sy, type, addr_of(shopdamage), TRUE, 0);
            /* zap with fire -> melt ice -> drown monster, so monster
               found and cached above might not be here any more */
            mon = m_at(sx, sy);
        }

        case "buzzmonst": if ($goto || (mon)) {
            switch ($goto) { default: if (fireball)
                break $out_buzzmonst;
            if (type >= 0)
                mon.mstrategy = and64u(mon.mstrategy, ~STRAT_WAITMASK);
 case "buzzmonst": $goto = null;
            gn.notonhead = +(mon.mx != gb.bhitpos.x
                            || mon.my != gb.bhitpos.y); }
            if (!forcemiss && zap_hit(find_mac(mon), spell_type)) {
                if (mon_reflects(mon, 0)) {
                    if (cansee(mon.mx, mon.my)) {
                        hit(flash_str(fltyp, FALSE), mon, exclam(0));
                        shieldeff(mon.mx, mon.my);
                        mon_reflects(mon,
                                            _("But it reflects from %s %s!"));
                        gas_hit = FALSE;
                    }
                    dx[0] = -dx[0];
                    dy[0] = -dy[0];
                } else {
                    var mon_could_move = mon.mcanmove;
                    var tmp = zhitm(mon, type, nd, otmp);

                    if (is_rider(mon.data)
                        && abs(type) == ZT_BREATH(ZT_DEATH)) {
                        if (canseemon(mon)) {
                            hit(flash_str(fltyp, FALSE), mon, _("."));
                            pline(_("%s disintegrates."), Monnam(mon));
                            pline(_("%s body reintegrates before your %s!"),
                                  s_suffix(Monnam(mon)),
                                  (eyecount(gy.youmonst.data) == 1)
                                      ? body_part(EYE)
                                      : makeplural(body_part(EYE)));
                            pline(_("%s resurrects!"), Monnam(mon));
                        }
                        mon.mhp = mon.mhpmax;
                        break $out_buzzmonst; /* Out of while loop */
                    }
                    if (mon.data == mons[PM_DEATH] && damgtype == ZT_DEATH) {
                        if (canseemon(mon)) {
                            hit(flash_str(fltyp, FALSE), mon, _("."));
                            pline(_("%s absorbs the deadly %s!"), Monnam(mon),
                                  type == ZT_BREATH(ZT_DEATH) ? _("blast")
                                                              : _("ray"));
                            pline(_("It seems even stronger than before."));
                        }
                        break $out_buzzmonst; /* Out of while loop */
                    }

                    if (tmp == MAGIC_COOKIE) { /* disintegration */
                        disintegrate_mon(mon, type, flash_str(fltyp, FALSE));
                    } else if (DEADMONSTER(mon)) {
                        if (type < 0) {
                            /* mon has just been killed by another monster */
                            monkilled(mon, flash_str(fltyp, FALSE), AD_RBRE);
                        } else {
                            var xkflags = XKILL_GIVEMSG; /* killed(mon); */

                            /* killed by hero; we know 'type' isn't negative;
                               if it's fire, highly flammable monsters leave
                               no corpse; don't bother reporting that they
                               "burn completely" -- unnecessary verbosity */
                            if (damgtype == ZT_FIRE
                                /* paper golem or straw golem */
                                && completelyburns(mon.data))
                                xkflags |= XKILL_NOCORPSE;
                            xkilled(mon, xkflags);
                        }
                    } else {
                        if (!otmp[0]) {
                            /* normal non-fatal hit */
                            if (sayhit || canseemon(mon))
                                hit(flash_str(fltyp, FALSE), mon, exclam(tmp));
                        } else {
                            /* some armor was destroyed; no damage done */
                            if (canseemon(mon))
                                pline(_("%s %s is disintegrated!"),
                                      s_suffix(Monnam(mon)),
                                      distant_name(otmp[0], xname));
                            m_useup(mon, otmp[0]);
                        }
                        if (mon_could_move && !mon.mcanmove) /* ZT_SLEEP */
                            slept_monst(mon);
                        if (damgtype != ZT_SLEEP)
                            wakeup(mon, (type >= 0) ? TRUE : FALSE);
                    }
                }
                range -= 2;
            } else {
                if (saymiss
                    || (canseemon(mon) && !disguised_as_non_mon(mon)))
                    miss(flash_str(fltyp, FALSE), mon);
            }
        } else if (u_at(sx, sy) && range >= 0) {
            nomul(0);
            if (u.usteed && !rn2(3) && !mon_reflects(u.usteed, 0)) {
                mon = u.usteed;
                { $goto = "buzzmonst"; continue $goto_buzzmonst; }
            } else if (!forcemiss && zap_hit(u.uac, 0)) {
                range -= 2;
                pline_dir(xytodir(-dx[0], -dy[0]), _("%s hits you!"),
                          The(flash_str(fltyp, FALSE)));
                if (Reflecting()) {
                    if (!Blind()) {
                        ureflects(_("But %s reflects from your %s!"),
                                         _("it"));
                    } else
                        pline(_("For some reason you are not affected."));
                    monstseesu(M_SEEN_REFL);
                    dx[0] = -dx[0];
                    dy[0] = -dy[0];
                    shieldeff(sx, sy);
                    gas_hit = FALSE;
                } else {
                    /* flash_str here only used for killer; suppress
                     * hallucination */
                    zhitu(type, nd, flash_str(fltyp, TRUE), sx, sy);
                    monstunseesu(M_SEEN_REFL);
                }
            } else if (!Blind()) {
                pline(_("%s whizzes by you!"), The(flash_str(fltyp, FALSE)));
            } else if (damgtype == ZT_LIGHTNING) {
                Your(_("%s tingles."), body_part(ARM));
            }
            if (damgtype == ZT_LIGHTNING)
                flashburn(d(nd, 50), TRUE);
            stop_occupation();
            nomul(0);
        }
        /* gas that missed or that hit without being reflected will leave
           a 1x1 cloud here; the earlier zap_over_floor() was deferred */
        if (gas_hit)
            zap_over_floor(sx, sy, type, addr_of(shopdamage), TRUE, 0);

        case "make_bounce": if ($goto || (!ZAP_POS(levl()[sx][sy].typ)
            || (closed_door(sx, sy) && range >= 0))) {
            switch ($goto) { default: var bchance;

 case "make_bounce": $goto = null;
            bchance = (!isok(sx, sy) || levl()[sx][sy].typ == STONE) ? 10
                      : (In_mines(u.uz) && IS_WALL(levl()[sx][sy].typ)) ? 20
                        : 75; }
            if ((--range > 0 && isok(lsx, lsy) && cansee(lsx, lsy))
                || fireball) {
                if (Is_airlevel(u.uz)) { /* nothing to bounce off of */
                    pline_The(_("%s vanishes into the aether!"),
                              flash_str(fltyp, FALSE));
                    if (fireball)
                        type = ZT_WAND(ZT_FIRE); /* skip pending fireball */
                    break $out_buzzmonst;
                } else if (fireball) {
                    sx = lsx;
                    sy = lsy;
                    break $out_buzzmonst; /* fireballs explode before the obstacle */
                } else
                    pline_The(_("%s bounces!"), flash_str(fltyp, FALSE));
            }
            bounce_dir(sx, sy, dx, dy, bchance);
            tmp_at(DISP_CHANGE, zapdir_to_glyph(dx[0], dy[0], hdmgtype));
        } } break; }
    }
    tmp_at(DISP_END, 0);
    if (fireball)
        explode(sx, sy, type, d(12, 6), 0, EXPL_FIERY);
    if (shopdamage[0])
        pay_for_damage(damgtype == ZT_FIRE ? _("burn away")
                       : damgtype == ZT_COLD ? _("shatter")
                         /* "damage" indicates wall rather than door */
                         : damgtype == ZT_ACID ? _("damage")
                           : damgtype == ZT_DEATH ? _("disintegrate")
                             : _("destroy"),
                       FALSE);
    struct_assign(gb.bhitpos, save_bhitpos);
    } finally { stack_pop($frame); }
}

export function melt_ice(x, y, msg) { /* void */
    let lev = levl()[x][y];
    let otmp;
    let mtmp;

    if (!msg)
        msg = _("The ice crackles and melts.");
    if (lev.typ == DRAWBRIDGE_UP || lev.typ == DRAWBRIDGE_DOWN) {
        lev.flags &= ~DB_ICE; /* revert to DB_MOAT */
    } else { /* lev->typ == ICE */
        lev.typ = (lev.flags == ICED_POOL ? POOL : MOAT);
        lev.flags = 0;
    }
    spot_stop_timers(x, y, MELT_ICE_AWAY); /* no more ice to melt away */
    if (t_at(x, y))
        trap_ice_effects(x, y, TRUE); /* TRUE because ice_is_melting */
    obj_ice_effects(x, y, FALSE);
    unearth_objs(x, y);
    if (Underwater())
        vision_recalc(1);
    newsym(x, y);
    if (cansee(x, y) || u_at(x, y))
        Norep(_("%s"), msg);
    if ((otmp = sobj_at(BOULDER, x, y)) != null) {
        if (cansee(x, y))
            pline(_("%s settles..."), An(xname(otmp)));
        do {
            obj_extract_self(otmp); /* boulder isn't being pushed */
            if (!boulder_hits_pool(otmp, x, y, FALSE))
                impossible(_("melt_ice: no pool?"));
            /* try again if there's another boulder and pool didn't fill */
        } while (is_pool(x, y) && (otmp = sobj_at(BOULDER, x, y)) != null);
        newsym(x, y);
    }
    if (u_at(x, y))
        spoteffects(TRUE); /* possibly drown, notice objects */
    else if (is_pool(x, y) && (mtmp = m_at(x, y)) != null)
        minliquid(mtmp);
}

export const MIN_ICE_TIME = 50;
export const MAX_ICE_TIME = 2000;
/*
 * Usually start a melt_ice timer; sometimes the ice will become
 * permanent instead.
 */
export function start_melt_ice_timeout(
    x, y,
    min_time) { /* void */ /* <x,y>'s old melt timeout (deleted by time we get here) */
    let when;
    let where;

    when = int(min_time);
    if (when < MIN_ICE_TIME - 1)
        when = MIN_ICE_TIME - 1;

    /* random timeout; surrounding ice locations ought to be a factor... */
    while (++when <= MAX_ICE_TIME)
        if (!rn2((MAX_ICE_TIME - when) + MIN_ICE_TIME))
            break;

    /* if we're within MAX_ICE_TIME, install a melt timer;
       otherwise, omit it to leave this ice permanent */
    if (when <= MAX_ICE_TIME) {
        where = or64(shl64(x, 16), y);
        start_timer(when, TIMER_LEVEL, MELT_ICE_AWAY,
                           long_to_any(where));
    }
}

/*
 * Called when ice has melted completely away.
 */
export function melt_ice_away(arg, timeout) { /* void */
    let x, y;
    let where = arg.a_long;
    let save_mon_moving = svc.context.mon_moving; /* will be False */

    /* melt_ice -> minliquid -> mondead|xkilled shouldn't credit/blame hero */
    svc.context.mon_moving = TRUE; /* hero isn't causing this ice to melt */
    y = coordxy((where & 0xFFFF));
    x = coordxy((shr64(where, 16) & 0xFFFF));
    /* melt_ice does newsym when appropriate */
    melt_ice(x, y, _("Some ice melts away."));
    svc.context.mon_moving = save_mon_moving;
}

/* Burn floor scrolls, evaporate pools, etc... in a single square.
 * Used both for normal bolts of fire, cold, etc... and for fireballs.
 * Sets shopdamage to TRUE if a shop door is destroyed, and returns the
 * amount by which range is reduced (value is negative and will be added
 * to remaining range by caller; ignored by fireballs and poison gas).
 */
export function zap_over_floor(
    x, y,
    type,
    shopdamage,
    ignoremon,
    exploding_wand_typ) { /* int */ /* supplied when breaking a wand; or POT_OIL * when a lit potion of oil explodes */
    const $frame = stack_frame(); try {
    let $goto = null; var buf = stack_array(char, BUFSZ);
    var zapverb;
    var mon;
    var t;
    var lev = levl()[x][y];
    var see_it = cansee(x, y), yourzap;
    var rangemod = 0, damgtype = zaptype(type) % 10;
    var lavawall = +(lev.typ == LAVAWALL);

    if (type == PHYS_EXPL_TYPE) {
        /* this won't have any effect on the floor */
        return -1000; /* not a zap anyway, shouldn't matter */
    }

    switch (damgtype) {
    case ZT_FIRE:
        t = t_at(x, y);
        if (t && t.ttyp == WEB) {
            /* a burning web is too flimsy to notice if you can't see it */
            if (see_it)
                Norep(_("A web bursts into flames!"));
            delfloortrap(t), t = null;
            if (see_it)
                newsym(x, y);
        }
        if (is_ice(x, y)) {
            melt_ice(x, y, 0);
        } else if (is_pool(x, y)) {
            var on_water_level = Is_waterlevel(u.uz), msggiven = FALSE;
            var msgtxt = (!Deaf())
                                 ? _("You hear hissing gas.") /* Deaf-aware */
                                 : (type >= 0)
                                   ? _("That seemed remarkably uneventful.")
                                   : 0;

            /* don't create steam clouds on Plane of Water; air bubble
               movement and gas regions don't understand each other */
            if (!on_water_level) {
                create_gas_cloud(x, y, rnd(5), 0); /* 1..5, no damg */
                if (iflags.last_msg == PLNMSG_ENVELOPED_IN_GAS)
                    msggiven = TRUE;
            }

            if (lev.typ != POOL) { /* MOAT or DRAWBRIDGE_UP or WATER */
                t = null;
                if (on_water_level)
                    msgtxt = (see_it || !Deaf()) ? _("Some water boils.") : 0;
                else if (see_it)
                    msgtxt = _("Some water evaporates.");
            } else {
                rangemod -= 3;
                lev.typ = ROOM, lev.flags = 0;
                t = maketrap(x, y, PIT);
                /*if (t) -- this was before the vapor cloud was added --
                      t->tseen = 1;*/
                if (see_it)
                    msgtxt = _("The water evaporates.");
            }
            if (msgtxt && !msggiven)
                Norep(_("%s"), msgtxt);

            if (lev.typ == ROOM) { /* POOL changed to ROOM above */
                if ((mon = m_at(x, y)) != null) {
                    /* probably ought to do some hefty damage to any
                       creature caught in boiling water;
                       at a minimum, eels are forced out of hiding */
                    if (is_swimmer(mon.data) && mon.mundetected) {
                        mon.mundetected = 0;
                    }
                }
                newsym(x, y);
                if (t) {
                    /* if water walking/swimming/magical breathing, maybe fall
                       into the new pit (after the water evaporation message);
                       if flying or levitating, nothing will happen */
                    if (u_at(x, y))
                        dotrap(t, NO_TRAP_FLAGS);
                    else if (mon)
                        mintrap(mon, NO_TRAP_FLAGS);
                }
            }
        } else if (IS_FOUNTAIN(lev.typ)) {
            create_gas_cloud(x, y, rnd(3), 0); /* 1..3, no damage */
            if (see_it)
                pline(_("Steam billows from the fountain."));
            rangemod -= 1;
            dryup(x, y, +(type > 0));
        }
        break; /* ZT_FIRE */

    case ZT_COLD:
        if (is_pool(x, y) || is_lava(x, y) || lavawall) {
            var lava = (is_lava(x, y) || lavawall ? 1 : 0),
                    moat = is_moat(x, y);
            var chance = max(2, 5 + svl.level.flags.temperature * 10);

            if (IS_WATERWALL(lev.typ) || (lavawall && rn2(chance))) {
                /* For now, don't let WATER freeze. */
                 ;
                if (see_it)
                    pline_The(_("%s freezes for a moment."),
                              hliquid(lavawall ? _("lava") : _("water")));
                else
                    You_hear(_("a soft crackling."));
                rangemod -= 1000; /* stop */
            } else {
                strcpy(buf, waterbody_name(x, y)); /* for MOAT */
                rangemod -= 3;
                if (lev.typ == DRAWBRIDGE_UP) {
                    lev.flags &= ~DB_UNDER; /* clear lava */
                    lev.flags |= (lava ? DB_FLOOR : DB_ICE);
                } else {
                    lev.flags = lava ? 0
                                         : (lev.typ == POOL) ? ICED_POOL
                                                              : ICED_MOAT;
                    if (lavawall) {
                        if ((isok(x, y-1) && IS_WALL(elt(levl()[x], y-1).typ))
                            || (isok(x, y+1) && IS_WALL(levl()[x][y+1].typ)))
                            lev.typ = VWALL;
                        else
                            lev.typ = HWALL;
                        fix_wall_spines(max(0,x-1), max(0,y-1),
                                        min(COLNO-1,x+1), min(ROWNO-1,y+1));
                    } else {
                        lev.typ = lava ? ROOM : ICE;
                    }
                }
                bury_objs(x, y);
                if (!lava) {
                     ;
                }
                if (see_it) {
                    if (lava)
                        Norep(_("The %s cools and solidifies."),
                              hliquid(_("lava")));
                    else if (moat)
                        Norep(_("The %s is bridged with ice!"), buf);
                    else
                        Norep(_("The %s freezes."), hliquid(_("water")));
                    newsym(x, y);
                } else if (!lava) {
                    You_hear(_("a crackling sound."));
                }
                if (u_at(x, y)) {
                    if (u.uinwater) { /* not just `if (Underwater)' */
                        /* leave the no longer existent water */
                        set_uinwater(0); /* u.uinwater = 0 */
                        u.uundetected = 0;
                        docrt();
                        gv.vision_full_recalc = 1;
                    } else if (u.utrap && u.utraptype == TT_LAVA) {
                        if (Passes_walls()) {
                            You(_("pass through the now-solid rock."));
                            reset_utrap(TRUE);
                        } else {
                            set_utrap(unsigned(rn1(50, 20)), TT_INFLOOR);
                            You(_("are firmly stuck in the cooling rock."));
                        }
                    }
                } else if ((mon = m_at(x, y)) != null) {
                    /* probably ought to do some hefty damage to any
                       non-ice creature caught in freezing water;
                       at a minimum, eels are forced out of hiding */
                    if (is_swimmer(mon.data) && mon.mundetected) {
                        mon.mundetected = 0;
                        newsym(x, y);
                    }
                }
                if (!lava) {
                    start_melt_ice_timeout(x, y, 0);
                    obj_ice_effects(x, y, TRUE);
                }
            } /* ?WATER */
        } else if (is_ice(x, y)) {
            var melt_time;

            /* Already ice here, so just firm it up. */
            /* Now ensure that only ice that is already timed is affected */
            if ((melt_time = spot_time_left(x, y, MELT_ICE_AWAY)) != 0) {
                spot_stop_timers(x, y, MELT_ICE_AWAY);
                start_melt_ice_timeout(x, y, melt_time);
            }
        }
        break; /* ZT_COLD */

    case ZT_POISON_GAS:
        /* poison gas with range 1: green dragon/iron golem breath (AD_DRST);
           caller is placing a series of 1x1 clouds along the zap's path;
           <x,y> for wall locations might be included--reject those */
        if (ZAP_POS(lev.typ))
            create_gas_cloud(x, y, 1, 8);
        break;

    case ZT_LIGHTNING:
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case ZT_ACID:
        if (lev.typ == IRONBARS) {
            if (damgtype == ZT_LIGHTNING && rn2(10))
                break;
            if ((lev.flags & W_NONDIGGABLE) != 0) {
                if (see_it)
                    Norep(_("The %s %s somewhat but remain intact."),
                          defsyms[S_bars].explanation,
                          (damgtype == ZT_ACID) ? _("corrode") : _("melt"));
                /* but nothing actually happens... */
            } else {
                rangemod -= 3;
                if (see_it)
                    Norep(_("The %s %s."), defsyms[S_bars].explanation,
                          (damgtype == ZT_ACID) ? _("corrode away") : _("melt"));
                dissolve_bars(x, y);
                if (chars[in_rooms(x, y, SHOPBASE)]) {
                    add_damage(x, y, (type >= 0) ? SHOP_BARS_COST : 0);
                    if (type >= 0)
                        chars[shopdamage] = TRUE;
                }
            }
        }
        break; /* ZT_ACID */

    default:
        break;
    }

    /* set up zap text for possible door feedback; for exploding wand, we
       want "the blast" rather than "your blast" even if hero caused it */
    yourzap = +(type >= 0 && !exploding_wand_typ);
    zapverb = _("blast"); /* breath attack or wand explosion */
    if (!exploding_wand_typ) {
        var ztype = zaptype(type); /* 0..29 for both hero and monsters */

        if (ztype < ZT_SPELL(0))
            zapverb = _("bolt"); /* wand zap */
        else if (ztype < ZT_BREATH(0))
            zapverb = _("spell");
    } else if (exploding_wand_typ == POT_OIL
               || exploding_wand_typ == SCR_FIRE) {
        /* breakobj() -> explode_oil() -> splatter_burning_oil()
           -> explode(ZT_SPELL(ZT_FIRE), BURNING_OIL)
           -> zap_over_floor(ZT_SPELL(ZT_FIRE), POT_OIL) */
        /* leave zapverb as "blast"; exploding_wand_typ was nonzero, so
           'yourzap' is FALSE and the result will be "the blast" */
        exploding_wand_typ = 0; /* not actually an exploding wand */
    }

    /* secret door gets revealed, converted into regular door */
    if (levl()[x][y].typ == SDOOR) {
        cvt_sdoor_to_door(levl()[x][y]); /* .typ = DOOR */
        recalc_block_point(x, y);
        /* target spot will now pass closed_door() test below
           (except on rogue level) */
        newsym(x, y);
        if (see_it)
            pline(_("%s %s reveals a secret door."),
                  yourzap ? _("Your") : _("The"), zapverb);
        else if (Is_rogue_level(u.uz))
            draft_message(FALSE); /* "You feel a draft." (open doorway) */
    }

    /* regular door absorbs remaining zap range, possibly gets destroyed */
    if (closed_door(x, y)) {
        var new_doormask = -1;
        var see_txt = 0, sense_txt = 0, hear_txt = 0;

        rangemod = -1000;
        $goto_def_case: for (;;) { switch ($goto || (damgtype)) {
        case ZT_FIRE:
            new_doormask = D_NODOOR;
            see_txt = _("The door is consumed in flames!");
            sense_txt = _("smell smoke.");
            break;
        case ZT_COLD:
            new_doormask = D_NODOOR;
            see_txt = _("The door freezes and shatters!");
            hear_txt = _("a deep cracking sound.");
            break;
        case ZT_DEATH:
            /* death spells/wands don't disintegrate */
            if (abs(type) != ZT_BREATH(ZT_DEATH))
                { $goto = "def_case"; continue $goto_def_case; };
            new_doormask = D_NODOOR;
            see_txt = _("The door disintegrates!");
            hear_txt = _("crashing wood.");
            break;
        case ZT_LIGHTNING:
            new_doormask = D_BROKEN;
            see_txt = _("The door splinters!");
            hear_txt = _("crackling.");
            break;
        case "def_case": default:
 $goto = null;
            if (exploding_wand_typ > 0) {
                /* Magical explosion from misc exploding wand */
                if (exploding_wand_typ == WAN_STRIKING) {
                    new_doormask = D_BROKEN;
                    see_txt = _("The door crashes open!");
                    sense_txt = _("feel a burst of cool air.");
                    break;
                }
            }
            if (see_it) {
                /* "the door absorbs the blast" would be
                   inaccurate for an exploding wand since
                   other adjacent locations still get hit */
                if (exploding_wand_typ)
                    pline_The(_("door remains intact."));
                else
                    pline_The(_("door absorbs %s %s!"), yourzap ? _("your") : _("the"),
                              zapverb);
            } else
                You_feel(_("vibrations."));
            break;
        } break; }
        if (new_doormask >= 0) { /* door gets broken */
            if (chars[in_rooms(x, y, SHOPBASE)]) {
                if (type >= 0) {
                    add_damage(x, y, SHOP_DOOR_COST);
                    chars[shopdamage] = TRUE;
                } else /* caused by monster */
                    add_damage(x, y, 0);
            }
            lev.flags = unsigned(new_doormask);
            recalc_block_point(x, y); /* vision */
            if (see_it) {
                pline1(see_txt);
                newsym(x, y);
            } else if (sense_txt) {
                You1(sense_txt);
            } else if (hear_txt)
                You_hear1(hear_txt);
            if (picking_at(x, y)) {
                stop_occupation();
                reset_pick();
            }
        }
    }

    if (OBJ_AT(x, y) && damgtype == ZT_FIRE)
        if (burn_floor_objects(x, y, FALSE, +(type > 0)) && couldsee(x, y)) {
            newsym(x, y);
            You(_("%s of smoke."), !Blind() ? _("see a puff") : _("smell a whiff"));
        }
    if (!ignoremon && (mon = m_at(x, y)) != null)
        wakeup(mon, (type >= 0) ? TRUE : FALSE);
    return rangemod;
    } finally { stack_pop($frame); }
}

/* monster has cast flames or frost at target on <x,y>; called by mcastu() */
export function mon_spell_hits_spot(
    caster,
    adtyp,
    x, y) { /* void */ /* so far, only used for targeting <u.ux,u.uy> */
    const $frame = stack_frame(); try {
    /* "shower of missiles" or [hypothetical] "acid rain" attack:
       thoroughly clobber an engraving (unless its type makes it be
       scuff-protected); zap_over_floor() doesn't handle this */
    if (adtyp == AD_MAGM || adtyp == AD_ACID) {
        let ep = engr_at(x, y);
        let etext = ep ? ep.engr_txt[actual_text] : 0;

        if (etext)
            wipe_engr_at(x, y, int(strlen(etext)) + d(6, 6), TRUE);
        /* hero and player will still remember prior text until the spot
           is re-examined (lookhere or move off and back on) */
    }

    /* hit items and/or terrain; only matters for AD_FIRE and AD_COLD but
       accept any basic damage type that zap_over_floor() might handle */
    if (adtyp >= AD_MAGM && adtyp <= AD_ACID) {
        let shopdummy = stack_var(boolean, FALSE); /* zap_over_floor() requires this even
                                    * though it's only used when zapdmgtyp
                                    * is non-negative (hero's fault) */
        let zt_typ = adtyp - 1,
            zapdmgtyp = -ZT_SPELL(zt_typ); /* damage is from monster spell */

        zap_over_floor(x, y, zapdmgtyp, addr_of(shopdummy), TRUE, 0);
    } else {
        impossible(_("Unsupported damage type (%d) for mon_spell_hits_spot."),
                   adtyp);
    }
    } finally { stack_pop($frame); }
}

/* fractured by pick-axe or wand of striking or by vault guard or shopkeeper */
export function fracture_rock(obj) { /* void */ /* no texts here! */
    const $frame = stack_frame(); try {
    let x = stack_var(coordxy), y = stack_var(coordxy);
    let by_you = +!svc.context.mon_moving;

    if (by_you && get_obj_location(obj, x, y, 0) && costly_spot(x[0], y[0])) {
        let shkp = stack_var(ptr_to(struct_monst), null);
        let objroom = chars[in_rooms(x[0], y[0], SHOPBASE)];

        if (billable(shkp, obj, objroom, FALSE)) {
            /* shop message says "you owe <shk> <$> for it!" so we need
               to precede that with a message explaining what "it" is */
            You(_("fracture %s %s."), s_suffix(shkname(shkp[0])), xname(obj));
            /* breakobj won't destroy fracturing statue or boulder but
               will charge for shop goods */
            breakobj(obj, x[0], y[0], TRUE, FALSE);
        }
    }
    if (by_you && obj.otyp == BOULDER)
        sokoban_guilt();

    obj.otyp = ROCK;
    obj.oclass = GEM_CLASS;
    obj.quan = rn1(60, 7);
    obj.owt = unsigned(weight(obj));
    obj.dknown = obj.bknown = obj.rknown = 0;
    obj.known = objects[obj.otyp].oc_uses_known ? 0 : 1;
    dealloc_oextra(obj);

    if (obj.where == OBJ_FLOOR) {
        obj_extract_self(obj); /* move rocks back on top */
        place_object(obj, obj.ox, obj.oy);
        if (!does_block(obj.ox, obj.oy, levl()[obj.ox][obj.oy])) {
            unblock_point(obj.ox, obj.oy);
            /* need immediate update in case this is a striking/force bolt
               zap that is about hit more things */
            vision_recalc(0);
        }
        if (cansee(obj.ox, obj.oy))
            newsym(obj.ox, obj.oy);
    }
    } finally { stack_pop($frame); }
}

/* handle statue hit by striking/force bolt/pick-axe */
export function break_statue(obj) { /* boolean */
    /* [obj is assumed to be on floor, so no get_obj_location() needed] */
    let trap = t_at(obj.ox, obj.oy);
    let item;
    let by_you = +!svc.context.mon_moving;

    if (trap && trap.ttyp == STATUE_TRAP
        && activate_statue_trap(trap, obj.ox, obj.oy, TRUE))
        return FALSE;
    /* drop any objects contained inside the statue */
    while ((item = obj.cobj) != null) {
        obj_extract_self(item);
        place_object(item, obj.ox, obj.oy);
    }
    if (by_you && Role_if(PM_ARCHEOLOGIST)
        && (obj.spe & CORPSTAT_HISTORIC)) {
        You_feel(_("guilty about damaging such a historic statue."));
        adjalign(-1);
    }
    obj.spe = 0;
    fracture_rock(obj);
    return TRUE;
}

/* Return TRUE if obj is eligible to pass to maybe_destroy_item given
 * the type of elemental damage it's being subjected to.
 * Note that things like the Book of the Dead are eligible even though they
 * won't get destroyed, because it will attempt to be destroyed but print a
 * special message instead. */
function destroyable(obj, adtyp) { /* boolean */
    if (obj.oartifact) {
        /* don't destroy artifacts */
        return FALSE;
    }
    if (obj.in_use && obj.quan == 1) {
        /* not available for destroying */
        return FALSE;
    }
    if (adtyp == AD_FIRE) {
        /* fire-magic items are immune */
        if (obj.otyp == SCR_FIRE || obj.otyp == SPE_FIREBALL) {
            return FALSE;
        }
        if (obj.otyp == GLOB_OF_GREEN_SLIME || obj.oclass == POTION_CLASS
            || obj.oclass == SCROLL_CLASS || obj.oclass == SPBOOK_CLASS) {
            return TRUE;
        }
    } else if (adtyp == AD_COLD) {
        /* non-water potions don't freeze and shatter */
        if (obj.oclass == POTION_CLASS && obj.otyp != POT_OIL) {
            return TRUE;
        }
    } else if (adtyp == AD_ELEC) {
        if (obj.oclass != RING_CLASS && obj.oclass != WAND_CLASS) {
            return FALSE;
        }
        /* electric-magic items are immune */
        if (obj.otyp != RIN_SHOCK_RESISTANCE && obj.otyp != WAN_LIGHTNING) {
            return TRUE;
        }
        /* There used to be a commented out bit of code that would exclude
         * gc.current_wand, but it wasn't used, so it wasn't moved into this
         * function. */
    }
    return FALSE;
}

/* convert attack damage AD_foo to property resistance */
function adtyp_to_prop(dmgtyp) { /* int */
    switch (dmgtyp) {
    case AD_COLD:
        return COLD_RES;
    case AD_FIRE:
        return FIRE_RES;
    case AD_ELEC:
        return SHOCK_RES;
    case AD_ACID:
        return ACID_RES;
    case AD_DISN:
        return DISINT_RES;
    default:
        break;
    }
    return 0; /* prop_types start at 1 */
}

/* Is hero wearing or wielding an object with resistance to attack
   damage type? Returns the percentage protection that the object gives. */
export function u_adtyp_resistance_obj(dmgtyp) { /* int */
    let prop = adtyp_to_prop(dmgtyp);

    if (!prop)
        return 0;

    /* FIXME? these percentages (99 and 90) seem too high... */

    /* items that give an extrinsic resistance when worn or wielded or
       carried give 99% protection to your items */
    if ((u.uprops[prop].extrinsic & (W_ARMOR | W_ACCESSORY | W_WEP | W_ART))
        != 0)
        return 99;

    /* worn dwarvish cloaks give 90% protection against heat and cold to
       carried items */
    if (uarmc && uarmc.otyp == DWARVISH_CLOAK
        && (dmgtyp == AD_COLD || dmgtyp == AD_FIRE))
        return 90;

    return 0;
}

/* Rolls to see whether an object in inventory resists damage from the
   given damage type, due to an equipped item protecting it. Use
   u_adtyp_resistance_obj to discover whether objects are protected in
   general (e.g. for enlightenment) and this function to actually do
   the roll to see whether a specific object is protected.

   This function doesn't check for other reasons why an object might
   be protected; you will usually need to do an obj_resists() call
   too. */
export function inventory_resistance_check(dmgtyp) { /* boolean */
    let prob = u_adtyp_resistance_obj(dmgtyp);

    if (!prob)
        return FALSE;

    return +(rn2(100) < prob);
}

/* for enlightenment; currently only useful in wizard mode; cf from_what() */
export function item_what(dmgtyp) { /* char * */
    let whatbuf = static_array("item_what.whatbuf", char, 50);
    let what = 0;
    let prop = adtyp_to_prop(dmgtyp);
    let xtrinsic = u.uprops[prop].extrinsic;

    chars[whatbuf + 0] = ord('\0');
    if (wizard()) {
        if (!prop || !xtrinsic) {
            ; /* 'what' stays Null */
        } else if (xtrinsic & W_ARMC) {
            what = cloak_simple_name(uarmc);
        } else if (xtrinsic & W_ARM) {
            what = suit_simple_name(uarm); /* "dragon {scales,mail}" */
        } else if (xtrinsic & W_ARMU) {
            what = shirt_simple_name(uarmu);
        } else if (xtrinsic & W_ARMH) {
            what = helm_simple_name(uarmh);
        } else if (xtrinsic & W_ARMG) {
            what = gloves_simple_name(uarmg);
        } else if (xtrinsic & W_ARMF) {
            what = boots_simple_name(uarmf);
        } else if (xtrinsic & W_ARMS) {
            what = shield_simple_name(uarms);
        } else if (xtrinsic & (W_AMUL | W_TOOL)) {
            what = simpleonames((xtrinsic & W_AMUL) ? uamul : ublindf);
        } else if (xtrinsic & W_RING) {
            if ((xtrinsic & W_RING) == W_RING) /* both */
                what = _("rings");
            else
                what = simpleonames((xtrinsic & W_RINGL) ? uleft : uright);
        } else if (xtrinsic & W_WEP) {
            what = simpleonames(uwep);
        }
        /* format the output to be ready for enl_msg() to append it to
           "Your items {are,were} protected against <damage-type>" */
        if (what) /* strlen(what) will be less than 30 */
            sprintf(whatbuf, _(" by your %.40s"), what);
    }
    return whatbuf;
}

/*
 * destroy_strings[dindx][0:singular,1:plural,2:killer_reason]
 *      [0] freezing potion
 *      [1] boiling potion other than oil
 *      [2] boiling potion of oil
 *      [3] burning scroll
 *      [4] burning spellbook
 *      [5] shocked ring
 *      [6] shocked wand
 * (books, rings, and wands don't stack so don't need plural form;
 *  crumbling ring doesn't do damage so doesn't need killer reason)
 * externally referenced from trap.c.
 */
export const destroy_strings = static_array("destroy_strings", array_of(ptr_to(char), 3), null, [
    /* also used in trap.c */
    [ _("freezes and shatters"), _("freeze and shatter"), _("shattered potion") ],
    [ _("boils and explodes"), _("boil and explode"), _("boiling potion") ],
    [ _("ignites and explodes"), _("ignite and explode"), _("exploding potion") ],
    [ _("catches fire and burns"), _("catch fire and burn"), _("burning scroll") ],
    [ _("catches fire and burns"), _(""), _("burning book") ],
    [ _("turns to dust and vanishes"), _(""), _("") ],
    [ _("breaks apart and explodes"), _(""), _("exploding wand") ],
]);

/* guts of destroy_items();
   caller must decide whether obj is eligible, though there's one case (Book
   of the Dead) in which an eligible item shouldn't be destroyed (it prints a
   special message instead).
   Returns the amount of damage done, but it's used differently depending on
   whether it's the player or a monster having an item destroyed: players lose
   the HP and possibly die in this function, and the return value is unused,
   whereas monsters return the damage to their caller to be taken off later */
function maybe_destroy_item(
    carrier,
    obj,
    dmgtyp) { /* int */
    let i, cnt, quan;
    let dmg, xresist, skip, dindx;
    let mult;
    let u_carry = +(carrier == gy.youmonst);
    let vis = (!u_carry && canseemon(carrier) ? 1 : 0);
    let chargeit = FALSE;

    xresist = skip = 0;
    /* lint suppression */
    dmg = dindx = 0;
    quan = 0;

    /* external worn item protects inventory? */
    if (u_carry && inventory_resistance_check(dmgtyp))
        return 0;

    switch (dmgtyp) {
    case AD_COLD:
        quan = obj.quan;
        dindx = 0;
        dmg = rnd(4);
        break;
    case AD_FIRE:
        xresist = (obj.oclass != POTION_CLASS
                   && obj.otyp != GLOB_OF_GREEN_SLIME
                   && (u_carry ? Fire_resistance() : resists_fire(carrier)) ? 1 : 0);
        if (obj.otyp == SPE_BOOK_OF_THE_DEAD) {
            skip = 1;
            if (u_carry ? !Blind() : vis) {
                pline(_("%s glows a strange %s, but remains intact."),
                      The(u_carry ? xname(obj) : distant_name(obj, xname)),
                      hcolor(_("dark red")));
            }
            break;
        }
        quan = obj.quan;
        switch (obj.oclass) {
        case POTION_CLASS:
            dindx = (obj.otyp != POT_OIL) ? 1 : 2;
            dmg = rnd(6);
            break;
        case SCROLL_CLASS:
            dindx = 3;
            dmg = 1;
            break;
        case SPBOOK_CLASS:
            dindx = 4;
            dmg = 1;
            break;
        case FOOD_CLASS: /* only GLOB_OF_GREEN_SLIME */
            dindx = 1; /* boil and explode */
            dmg = int(Math.trunc(unsigned(obj.owt + 19) / 20));
            break;
        }
        break;
    case AD_ELEC:
        xresist = (obj.oclass != RING_CLASS
                   && (u_carry ? Shock_resistance() : resists_elec(carrier)) ? 1 : 0);
        quan = obj.quan;
        switch (obj.oclass) {
        case RING_CLASS:
            if (((obj.owornmask & W_RING) && uarmg && !is_metallic(uarmg))
                || obj.otyp == RIN_SHOCK_RESISTANCE) {
                skip++;
                break;
            } else if (objects[obj.otyp].oc_charged && rn2(3)) {
                chargeit = TRUE;
                break;
            }
            dindx = 5;
            dmg = 0;
            break;
        case WAND_CLASS:
            dindx = 6;
            dmg = rnd(10);
            break;
        }
        break;
    default:
        skip = 1; /* just in case ineligible damage type gets through... */
        impossible(_("maybe_destroy_item with unexpected dmgtyp %d"), dmgtyp);
        break;
    }

    if (chargeit) {
        /* FIXME: recharge only handles items in hero's inventory */
        if (u_carry)
            recharge(obj, 0);
    } else if (!skip) {
        let osym = obj.oclass; /* for checking glob of slime after it's
                                       destroyed */
        if (obj.in_use)
            --quan; /* one will be used up elsewhere */
        for (i = cnt = 0; i < quan; i++)
            if (!rn2(3))
                cnt++;

        if (!cnt)
            return 0;

        if (u_carry || vis) {
            mult = (cnt == 1) ? ((quan == 1) ? _("") /* 1 of 1 */
                                  : _("One of "))      /* 1 of N */
                   : ((cnt < quan) ? _("Some of ")     /* n of N */
                      : (quan == 2) ? _("Both of ")   /* 2 of 2 */
                        : _("All of "));               /* N of N */
            pline(_("%s%s %s!"), mult,
                  (cnt == 1 && quan == 1) ? Yname2(obj) : yname(obj),
                  destroy_strings[dindx][+(cnt > 1)]);
        }
        if (u_carry) { /* effects that happen only to the player */
            if (osym == POTION_CLASS && dmgtyp != AD_COLD
                && (!breathless(gy.youmonst.data)
                    || haseyes(gy.youmonst.data))) {
                potionbreathe(obj);
            }
            if (obj.owornmask) { /* m_useup handles these for monster */
                if (obj.owornmask & W_RING) /* ring being worn */
                    Ring_gone(obj);
                else
                    setnotworn(obj);
            }
            if (obj == gc.current_wand) {
                gc.current_wand = null; /* destroyed */
            }
        }
        for (i = 0; i < cnt; i++) {
            if (u_carry)
                useup(obj);
            else
                m_useup(carrier, obj);
        }
        if (dmg) {
            if (!u_carry) {
                return xresist ? 0 : dmg;
            }
            if (xresist) {
                You(_("aren't hurt!"));
            } else {
                let how = destroy_strings[dindx][2];
                let one = +(cnt == 1);

                if (dmgtyp == AD_FIRE && osym == FOOD_CLASS)
                    how = _("exploding glob of slime");
                losehp(dmg, one ? how : makeplural(how),
                       one ? KILLED_BY_AN : KILLED_BY);
                exercise(A_STR, FALSE);
            }
        }
    }
    return dmg;
}

/* scaling factor; dmg/5 stacks will be subjected to destroy_items() */
export const DMG_DESTROY_SCALE = 5;
/* largest amount of stacks that will be destroyed in a single call */
export const MAX_ITEMS_DESTROYED = 20;

/* target items of specified class in mon's inventory for possible destruction
   return total amount of damage inflicted, though this is unused if mon is
   the player */
export function destroy_items(
    mon,

    dmgtyp,
    dmg_in) { /* int */ /* the amount of HP damage the attack dealt */
    const $frame = stack_frame(); try {
    let obj;
    let i, defer;
    let limit; /* max amount of item stacks destroyed, based on damage */
    const struct___anon1 = struct("destroy_items.struct___anon1", {
        oid: unsigned,
        otmp: ptr_to("struct_obj"),
        deferred: boolean,
    }); let items_to_destroy = stack_array(struct___anon1, MAX_ITEMS_DESTROYED);
    let elig_stacks = 0; /* number of destroyable objects found so far */
    let u_carry = +(mon == gy.youmonst);
    /* this is a struct obj** because we might destroy the first item in it */
    let objchn = u_carry ? ref_of(gi, "invent") : ref_of(mon, "minvent");
    let dmg_out = 0; /* damage caused by items getting destroyed */
    let where = NOBJ_STATES;

    /* initialize items_to_destroy */
    for (i = 0; i < MAX_ITEMS_DESTROYED; ++i) {
        /* 0 should not be a valid o_id for anything */
        items_to_destroy[i].oid = 0;
        items_to_destroy[i].otmp = null;
        items_to_destroy[i].deferred = FALSE;
    }

    /* don't straight up destroy all items with an equal chance; limit it
       based on the amount of damage being dealt by the source of the item
       destruction */
    limit = Math.trunc(dmg_in / DMG_DESTROY_SCALE);
    if (dmg_in % DMG_DESTROY_SCALE > rn2(DMG_DESTROY_SCALE)) {
        limit++; /* dmg = 9: 20% chance of limit=1, 80% of limit=2, etc */
    }
    if (limit > MAX_ITEMS_DESTROYED) {
        /* in case of incredibly high damage, prevent from overflowing
         * items_to_destroy */
        limit = MAX_ITEMS_DESTROYED;
    }
    if (limit < 1) {
        return 0; /* nothing destroyed */
    }

    /* Sometimes destroying an item can change inventory aside from
     * the item itself (cited case was a potion of unholy water; when
     * boiled, potionbreathe() caused hero to transform into were-beast
     * form and that resulted in dropping or destroying some worn armor).
     *
     * Unlike other uses of the object bypass mechanism, destroy_items()
     * can be called multiple times for the same event.  So we have to
     * explicitly clear it before each use and hope no other section of
     * code expects it to retain previous value.
     *
     * Destruction of a ring of levitation or form change which pushes
     * off levitation boots could drop hero onto a fire trap that
     * could destroy other items and we'll get called recursively.  Or
     * onto a trap which transports hero elsewhere, which won't disrupt
     * traversal but could yield message sequencing issues.  So we
     * defer handling such things until after rest of inventory has
     * been processed.  If some other combination of items and events
     * triggers a recursive call, rest of inventory after the triggering
     * item will be skipped by the outer call since the inner one will
     * have set the bypass bits of the whole list.
     *
     * [Unfortunately, death while poly'd into flyer and subsequent
     * rehumanization could also drop hero onto a trap, and there's no
     * straightforward way to defer that.  Things could be improved by
     * redoing this to use two passes, first to collect a list or array
     * of o_id and quantity of what is targeted for destruction,
     * second pass to handle the destruction.]
     */
    bypass_objlist(objchn[0], FALSE); /* clear bypass bit for invent */

    while ((obj = nxt_unbypassed_obj(objchn[0])) != null) {
        if (!destroyable(obj, dmgtyp))
            continue; /* this dmg type can't destroy this obj */

        /* obj is eligible; maybe add it to items_to_destroy */
        i = (elig_stacks < limit) ? elig_stacks : rn2(elig_stacks);
        /* do this afterwards to avoid not filling items_to_destroy[0] */
        elig_stacks++;
        if (i < 0 || i >= limit) {
            /* random index was too high; mollify analyzer by including < 0 */
            continue;
        }
        items_to_destroy[i].oid = obj.o_id;
        items_to_destroy[i].otmp = obj;
        if (where == NOBJ_STATES)
            where = obj.where;
        else if (where != obj.where)
            impossible(_("destroy_item: items in multiple chains"));

        /* if loss of this item might dump us onto a trap, hold off
           until later because potential recursive destroy_items() will
           result in setting bypass bits on whole chain--we would skip
           the rest as already processed once control returns here */
        if (u_carry
            && ((obj.owornmask != 0
                 && (objects[obj.otyp].oc_oprop == LEVITATION
                     || objects[obj.otyp].oc_oprop == FLYING))
                /* destroyed wands and potions of polymorph don't trigger
                   polymorph so don't need to be deferred */
                || (obj.otyp == POT_WATER && ismnum(u.ulycn)
                    && (Upolyd() ? obj.blessed : obj.cursed)))) {
            items_to_destroy[i].deferred = TRUE;
        } else {
            items_to_destroy[i].deferred = FALSE;
        }
    }
    if (elig_stacks > limit) {
        elig_stacks = limit; /* so we can loop up to elig_stacks */
    }
    for (defer = 0; defer <= 1; ++defer) {
        /* if we saved some items for later (most likely just a worn ring
           of levitation) and they're still in inventory, handle them on the
           second iteration of the loop */
        for (i = 0; i < elig_stacks; ++i) {
            obj = items_to_destroy[i].otmp;
            if (obj && obj.o_id == items_to_destroy[i].oid
                && obj.where == where
                && (items_to_destroy[i].deferred == +(defer == 1))) {
                dmg_out += maybe_destroy_item(mon, obj, dmgtyp);
                items_to_destroy[i].otmp = null;
            }
        }
    }
    /* almost certainly not everything was destroyed; clear bypass bit after
       it was set earlier */
    bypass_objlist(objchn[0], FALSE);
    return dmg_out;
    } finally { stack_pop($frame); }
}

export function resist(mtmp, oclass, damage, tell) { /* int */
    let resisted;
    let alev, dlev;

    /* fake players always pass resistance test against Conflict
       (this doesn't guarantee that they're never affected by it) */
    if (oclass == RING_CLASS && !damage && !tell && is_mplayer(mtmp.data))
        return 1;

    /* attack level */
    switch (oclass) {
    case WAND_CLASS:
        alev = 12;
        break;
    case TOOL_CLASS:
        alev = 10;
        break; /* instrument */
    case WEAPON_CLASS:
        alev = 10;
        break; /* artifact */
    case SCROLL_CLASS:
        alev = 9;
        break;
    case POTION_CLASS:
        alev = 6;
        break;
    case RING_CLASS:
        alev = 5;
        break;
    default:
        alev = u.ulevel;
        break; /* spell */
    }
    /* defense level */
    dlev = mtmp.m_lev;
    if (dlev > 50)
        dlev = 50;
    else if (dlev < 1)
        dlev = is_mplayer(mtmp.data) ? u.ulevel : 1;

    resisted = +(rn2(100 + alev - dlev) < mtmp.data.mr);
    if (resisted) {
        if (tell)
            shieldeff_mon(mtmp);
        damage = Math.trunc((damage + 1) / 2);
    }

    if (damage) {
        mtmp.mhp -= damage;
        if (DEADMONSTER(mtmp)) {
            if (gm.m_using)
                monkilled(mtmp, _(""), AD_RBRE);
            else
                killed(mtmp);
        }
    }
    return resisted;
}

export const MAXWISHTRY = 5;

function wishcmdassist(triesleft) { /* void */
    const $frame = stack_frame(); try {
    let wishinfo = static_array("wishcmdassist.wishinfo", ptr_to(char), null, [
  _("Wish details:"),
  _(""),
  _("Enter the name of an object, such as \"potion of monster detection\","),
  _("\"scroll labeled README\", \"elven mithril-coat\", or \"Grimtooth\""),
  _("(without the quotes)."),
  _(""),
  _("For object types which come in stacks, you may specify a plural name"),
  _("such as \"potions of healing\", or specify a count, such as \"1000 gold"),
  _("pieces\", although that aspect of your wish might not be granted."),
  _(""),
  _("You may also specify various prefix values which might be used to"),
  _("modify the item, such as \"uncursed\" or \"rustproof\" or \"+1\"."),
  _("Most modifiers shown when viewing your inventory can be specified."),
  _(""),
  _("You may specify 'nothing' to explicitly decline this wish."),
  0,
    ]),
        preserve_wishless = init_string(static_array("wishcmdassist.preserve_wishless", char, sizeof_string("Doing so will preserve 'wishless' conduct.")), _("Doing so will preserve 'wishless' conduct."), true),
        retry_info = init_string(static_array("wishcmdassist.retry_info", char, sizeof_string("If you specify an unrecognized object name %s%s time%s,")), _("If you specify an unrecognized object name %s%s time%s,"), true),
        retry_too = init_string(static_array("wishcmdassist.retry_too", char, sizeof_string("a randomly chosen item will be granted.")), _("a randomly chosen item will be granted."), true),
        suppress_cmdassist = init_string(static_array("wishcmdassist.suppress_cmdassist", char, sizeof_string("(Suppress this assistance with !cmdassist in your config file.)")), _("(Suppress this assistance with !cmdassist in your config file.)"), true),
        cardinals = static_array("wishcmdassist.cardinals", ptr_to(char), null, [ _("zero"),  _("one"),  _("two"), _("three"), _("four"), _("five") ]),
        too_many = init_string(static_array("wishcmdassist.too_many", char, sizeof_string("too many")), _("too many"), true);

    let i;
    let win;
    let buf = stack_array(char, BUFSZ);

    win = create_nhwindow()(NHW_TEXT);
    if (!win)
        return;
    for (i = 0; i < SIZE(wishinfo) - 1; ++i)
        putstr()(win, 0, wishinfo[i]);
    if (!u.uconduct.wishes)
        putstr()(win, 0, preserve_wishless);
    putstr()(win, 0, _(""));
    sprintf(buf, retry_info, (triesleft >= 0 && triesleft < SIZE(cardinals))
               ? cardinals[triesleft]
               : too_many, (triesleft < MAXWISHTRY) ? _(" more") : _(""), plur(triesleft))

;
    putstr()(win, 0, buf);
    putstr()(win, 0, retry_too);
    putstr()(win, 0, _(""));
    if (iflags.cmdassist)
        putstr()(win, 0, suppress_cmdassist);
    display_nhwindow()(win, TRUE);
    destroy_nhwindow()(win);
    } finally { stack_pop($frame); }
}

export const MAX_WISH_HISTORY = 20;
const wish_history = static_array("wish_history", ptr_to(char), MAX_WISH_HISTORY, [ 0 ]);
const wish_history_idx = static_var("wish_history_idx", int, 0);

/* add string to wish history list */
export function wish_history_add(buf) { /* void */
    let i;

    if (!wizard())
        return;

    for (i = 0; i < MAX_WISH_HISTORY; i++) {
        let idx = (wish_history_idx[0] + i) % MAX_WISH_HISTORY;

        if (!wish_history[idx])
            continue;
        if (!strncmpi(wish_history[idx], buf, int(strlen(wish_history[idx]))))
            break;
    }

    if (i == MAX_WISH_HISTORY) {
        let idx = (wish_history_idx[0] + i) % MAX_WISH_HISTORY;

        if (wish_history[idx])
            free(wish_history[idx]);
        wish_history[idx] = addr_of(alloc(unsigned(strlen(buf) + 1)));
        strcpy(wish_history[idx], buf);
        wish_history_idx[0] = (wish_history_idx[0] + 1) % MAX_WISH_HISTORY;
    }
}

/* release any old wish text; called from freedynamicdata(save.c) */
export function wish_history_flush() { /* void */
    let idx;

    for (idx = 0; idx < MAX_WISH_HISTORY; ++idx) {
        if (wish_history[idx])
            free((wish_history[idx])), wish_history[idx] = 0;
    }
    wish_history_idx[0] = 0;
}

/* shows menu of previous wishes, copies selected into buf, max BUFSZ len.
   buf is not modified, if nothing was selected. */
function wish_history_menu(buf) { /* void */
    const $frame = stack_frame(); try {
    let win;
    let any = stack_struct(struct_any);
    let i = 0, npick;
    let picks = stack_var(ptr_to(struct_mi), null);
    let idx;

    win = create_nhwindow()(NHW_MENU);
    start_menu()(win, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);

    for (i = MAX_WISH_HISTORY-1; i >= 0; i--) {
        idx = (wish_history_idx[0] + i) % MAX_WISH_HISTORY;
        if (wish_history[idx]) {
            any.a_int = (i + 1);
            add_menu(win, nul_glyphinfo, any, ord('\0'), 0, ATR_NONE, NO_COLOR,
                     wish_history[idx], MENU_ITEMFLAGS_NONE);
        }
    }

    end_menu()(win, _("Wish what?"));
    npick = select_menu(win, PICK_ONE, picks);
    destroy_nhwindow()(win);
    if (npick > 0) {
        i = picks[0].item.a_int;
        i--;
        idx = (wish_history_idx[0] + i) % MAX_WISH_HISTORY;

        if (wish_history[idx])
            strcpy(buf, wish_history[idx]);
    }
    } finally { stack_pop($frame); }
}

export function makewish() { /* void */
    const $frame = stack_frame(); try {
    var buf = init_list(stack_array(char, BUFSZ), []);
    var bufcpy = stack_array(char, BUFSZ), wish = stack_array(char, BUFSZ), promptbuf = stack_array(char, QBUFSZ);
    var otmp, nothing = stack_struct(struct_obj);
    var maybe_LL_arti;
    var tries = 0;
    var oldwisharti = u.uconduct.wisharti;

    svc.context.resume_wish = 0;
    chars[promptbuf + 0] = ord('\0');
    struct_assign(nothing, cg.zeroobj); /* lint suppression; only its address matters */
    if (flags.verbose)
        You(_("may wish for an object."));
 retry: for (;;) {
    strcpy(promptbuf, _("For what do you wish"));
    if (iflags.cmdassist && tries > 0)
        strcat(promptbuf, _(" (enter 'help' for assistance)"));
    strcat(promptbuf, _("?"));

    if (iflags.menu_requested && wish_history[0] && (tries == 0))
        wish_history_menu(buf);
    else
        getlin(promptbuf, buf);

    if (iflags.term_gone) {
        if (!iflags.debug_fuzzer)
            svc.context.resume_wish = 1;
        return;
    }

    mungspaces(buf);
    if (chars[buf + 0] == ord('\x1b')) {
        chars[buf + 0] = ord('\0');
    } else if (!strncmpi((buf), _(("help")), -1)) {
        wishcmdassist(MAXWISHTRY - tries);
        chars[buf + 0] = ord('\0'); /* for EDIT_GETLIN */
        continue retry;
    }
    /*
     *  Note: if they wished for and got a non-object successfully,
     *  otmp == &hands_obj.  That includes an artifact which has been
     *  denied. Wishing for "nothing" requires a separate value to remain
     *  distinct.
     */
    strcpy(bufcpy, buf);
    otmp = readobjnam(buf, nothing);
    if (!otmp) {
        pline(_("Nothing fitting that description exists in the game."));
        if (++tries < MAXWISHTRY)
            continue retry;;
        pline1(thats_enough_tries());
        otmp = readobjnam(0, null);
        if (!otmp)
            return; /* for safety; should never happen */
    } else if (otmp == nothing) {
        /* explicitly wished for "nothing", presumably attempting
           to retain wishless conduct */
        livelog_printf(LL_WISH, _("declined to make a wish"));
        return;
    } else if (otmp == hands_obj) {
        wish_history_add(bufcpy);
        /* wizard mode terrain wish: skip livelogging, etc */
        return;
    } break; }
    wish_history_add(bufcpy);

    if (otmp.oartifact) {
        /* update artifact bookkeeping; doesn't produce a livelog event */
        artifact_origin(otmp, ONAME_WISH | ONAME_KNOW_ARTI);
    }

    /* wisharti conduct handled in readobjnam() */
    maybe_LL_arti = ((oldwisharti < u.uconduct.wisharti) ? LL_ARTIFACT : 0);
    Snprintf(wish, sizeof(array_of(char, BUFSZ)), _("\"%s\", got \"%s\""), bufcpy, doname(otmp));
    /* KMH, conduct */
    if (!u.uconduct.wishes++)
        livelog_printf(or64(LL_CONDUCT | LL_WISH, maybe_LL_arti),
                       _("made %s first wish - %s"), uhis(), wish);
    else if (!oldwisharti && u.uconduct.wisharti)
        livelog_printf((LL_CONDUCT | LL_WISH | LL_ARTIFACT),
                       _("made %s first artifact wish - %s"), uhis(), wish);
    else
        livelog_printf(or64(LL_WISH, maybe_LL_arti), _("wished for %s"), wish);
    /* TODO? maybe generate a second event describing what was received since
       these just echo player's request rather than show actual result */

    if (otmp.otyp == CORPSE && !u_safe_from_fatal_corpse(otmp, st_all))
        otmp.usecount = 1;

    var verb = ((Is_airlevel(u.uz) || u.uinwater)
                        ? _("slip")
                        : (otmp.otyp == CORPSE && otmp.usecount)
                          ? _("materialize") : _("drop")),
               oops_msg = (u.uswallow
                            ? _("Oops!  %s out of your reach!")
                            : (Is_airlevel(u.uz) || Is_waterlevel(u.uz)
                               || levl()[u.ux][u.uy].typ < IRONBARS
                               || levl()[u.ux][u.uy].typ >= ICE)
                               ? _("Oops!  %s away from you!")
                               : !(otmp.otyp == CORPSE && otmp.usecount)
                                 ? _("Oops!  %s to the floor!")
                                 : _("Careful! %s on the floor!"));

    /* The(aobjnam()) is safe since otmp is unidentified -dlc */
    hold_another_object(otmp, oops_msg, The(aobjnam(otmp, verb)),
                               0);
    u.ublesscnt += rn1(100, 50); /* the gods take notice */
    } finally { stack_pop($frame); }
}

/* Fills buf with the appropriate string for this ray.
 * In the hallucination case, insert "blast of <silly thing>".
 * Assumes that the caller will specify typ in the appropriate range for
 * wand/spell/breath weapon. */
export function flash_str(
    typ,
    nohallu) { /* const char* */ /* suppress hallucination (for death reasons) */
    let fltxt = static_array("flash_str.fltxt", char, BUFSZ);

    typ = zaptype(typ);
    if (Hallucination() && !nohallu) {
        /* always return "blast of foo" for simplicity;
           this could be extended with hallucinatory rays, but probably
           not worth it at this time */
        sprintf(fltxt, _("blast of %s"), rnd_hallublast());
    } else {
        strcpy(fltxt, flash_types[typ]);
    }
    return fltxt;
}

/*zap.c*/

import { A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS } from "./attrib.h.js";
import { ACURR } from "./attrib.h.macros.js";
import { NO_COLOR } from "./color.h.js";
import { struct_nhcoord } from "./coord.h.js";
import { Something, nothing_happens, thats_enough_tries, vision_clears } from "./decl.h.macros.js";
import {
    ARMOR_CLASS, COIN_CLASS, FOOD_CLASS, GEM_CLASS, POTION_CLASS, RING_CLASS, ROCK_CLASS,
    SCROLL_CLASS, SPBOOK_CLASS, S_EEL, S_GOLEM, S_MIMIC, S_ZOMBIE, S_bars, S_boomleft, S_boomright,
    S_flashbeam, TOOL_CLASS, WAND_CLASS, WEAPON_CLASS,
} from "./defsym.h.js";
import {
    DISP_BEAM, DISP_CHANGE, DISP_END, DISP_FLASH, DISP_TETHER, EXPL_FIERY, EXPL_MAGICAL,
} from "./display.h.js";
import {
    canspotmon, cmap_to_glyph, glyph_is_invisible, glyph_is_monster, glyph_is_warning, obj_to_glyph,
    random_monster,
} from "./display.h.macros.js";
import { Is_airlevel, Is_qstart, Is_rogue_level, Is_waterlevel } from "./dungeon.h.macros.js";
import { ENGRAVE, HEADSTONE, actual_text } from "./engrave.h.js";
import { PLNMSG_ENVELOPED_IN_GAS, PLNMSG_OBJ_GLOWS } from "./flag.h.js";
import { wizard } from "./flag.h.macros.js";
import {
    BUFSZ, COLNO, FALSE, LARGEST_INT, LL_ARTIFACT, LL_CONDUCT, LL_WISH, QBUFSZ, ROWNO, TRUE,
    boolean, coordxy,
} from "./global.h.js";
import {
    ARM, ARTICLE_THE, CORPSTAT_FEMALE, CORPSTAT_GENDER, CORPSTAT_HISTORIC, CORPSTAT_MALE,
    COST_CANCEL, COST_DRAIN, COST_UNBLSS, COST_UNCURS, CXN_NORMAL, CXN_NO_PFX, CXN_PFX_THE, DIED,
    ECMD_CANCEL, ECMD_OK, ECMD_TIME, ENL_GAMEINPROGRESS, EYE, FACE, FLASHED_LIGHT, FM_FMON, FOOT,
    GETOBJ_EXCLUDE, GETOBJ_NOFLAGS, GETOBJ_SUGGEST, HEAD, INVIS_BEAM, KICKED_WEAPON, KILLED_BY,
    KILLED_BY_AN, MAGICENLIGHTENMENT, MIM_OMIT_WAIT, MIM_REVEAL, MM_ADJACENTOK, MM_FEMALE, MM_MALE,
    MM_NOCOUNTBIRTH, MM_NOMSG, MM_NOTAIL, MM_NOWAIT, NC_SHOW_MSG, NC_VIA_WAND_OR_SPELL, NOTELL,
    NO_KILLER_PREFIX, NO_MINVENT, NO_NC_FLAGS, NO_TRAP_FLAGS, ONAME_KNOW_ARTI, ONAME_WISH,
    PHYS_EXPL_TYPE, POLY_NOFLAGS, SHOP_BARS_COST, SHOP_DOOR_COST, TELL, TEST_MOVE,
    THROWN_TETHERED_WEAPON, THROWN_WEAPON, WAND_BACKFIRE_CHANCE, WAND_WREST_CHANCE, XKILL_GIVEMSG,
    XKILL_NOCORPSE, XKILL_NOMSG, ZAPPED_WAND, st_all,
} from "./hack.h.js";
import {
    AC_VALUE, BZ_OFS_SPE, BZ_OFS_WAN, BZ_U_SPELL, BZ_U_WAND, DIR_CLAMP, DIR_LEFT, DIR_RIGHT,
    Maybe_Half_Phys, You1, You_hear1, Your1, distu, makeknown, max, min, pline1, plur, rn1,
} from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { showdebug } from "./lint.h.macros.js";
import { struct_bill_x } from "./mextra.h.js";
import { ESHK, has_mcorpsenm } from "./mextra.h.macros.js";
import { SHOPBASE } from "./mkroom.h.js";
import {
    AD_ACID, AD_COLD, AD_DISN, AD_DRLI, AD_DRST, AD_ELEC, AD_FIRE, AD_MAGM, AD_RBRE, AD_SEDU,
    AD_SLEE, AD_SPEL, AD_SSEX,
} from "./monattk.h.js";
import {
    breathless, cant_drown, carnivorous, completelyburns, digests, eyecount, haseyes, hides_under,
    is_demon, is_golem, is_mplayer, is_reviver, is_rider, is_swimmer, is_undead, is_whirly,
    mindless, monsndx, nohands, nonliving, perceives, type_is_pname, unique_corpstat, vegetarian,
} from "./mondata.h.macros.js";
import { G_GENOD, G_NOCORPSE, G_UNIQ, MZ_HUMAN } from "./monflag.h.js";
import {
    MINV_ALL, MINV_NOLET, M_AP_FURNITURE, M_AP_NOTHING, M_AP_OBJECT, M_SEEN_ACID, M_SEEN_COLD,
    M_SEEN_DISINT, M_SEEN_ELEC, M_SEEN_FIRE, M_SEEN_MAGR, M_SEEN_REFL, M_SEEN_SLEEP, STRAT_WAITMASK,
    struct_monst,
} from "./monst.h.js";
import {
    DEADMONSTER, MON_WEP, M_AP_TYPE, engulfing_u, is_obj_mappear, is_vampshifter, ismnum,
    resists_acid, resists_cold, resists_disint, resists_elec, resists_fire, resists_poison,
} from "./monst.h.macros.js";
import {
    NON_PM, PM_ARCHEOLOGIST, PM_CLAY_GOLEM, PM_CROCODILE, PM_DEATH, PM_DOPPELGANGER, PM_FLESH_GOLEM,
    PM_GHOST, PM_GLASS_GOLEM, PM_GOLD_GOLEM, PM_GREMLIN, PM_HEALER, PM_IRON_GOLEM, PM_KNIGHT,
    PM_LEATHER_GOLEM, PM_LONG_WORM, PM_MONK, PM_PAPER_GOLEM, PM_PESTILENCE, PM_ROPE_GOLEM,
    PM_SKELETON, PM_STONE_GOLEM, PM_STRAW_GOLEM, PM_WOOD_GOLEM,
} from "./monsters.h.js";
import {
    BURIED_TOO, CONTAINED_TOO, ERODE_CORRODE, NOBJ_STATES, OBJ_BURIED, OBJ_CONTAINED, OBJ_FLOOR,
    OBJ_FREE, OBJ_INVENT, OBJ_LUAFREE, OBJ_MIGRATING, OBJ_MINVENT, OBJ_ONBILL, struct_obj,
} from "./obj.h.js";
import {
    Has_contents, Is_box, Is_container, OMID, ONAME, SchroedingersBox, bimanual, carried, has_omid,
    has_omonst, has_oname, is_pick, is_poisonable, is_weptool, unpolyable,
} from "./obj.h.macros.js";
import {
    BONE, CLOTH, COPPER, FLESH, GEMSTONE, GLASS, GOLD, IMMEDIATE, IRON, LEATHER, METAL, MINERAL,
    MITHRIL, NODIR, PAPER, PLATINUM, SILVER, TRAP_EXPLODE, WOOD,
} from "./objclass.h.js";
import {
    is_corrodeable, is_crackable, is_damageable, is_metallic, is_rustprone,
} from "./objclass.h.macros.js";
import {
    AMULET_OF_YENDOR, BAG_OF_HOLDING, BELL_OF_OPENING, BOULDER, CANDELABRUM_OF_INVOCATION, CHEST,
    CORPSE, CRYSTAL_BALL, DWARVISH_CLOAK, EGG, ENORMOUS_MEATBALL, EXPENSIVE_CAMERA, FIGURINE,
    FIRE_HORN, FROST_HORN, GAUNTLETS_OF_DEXTERITY, GLOB_OF_GREEN_SLIME, HEAVY_IRON_BALL,
    HELM_OF_BRILLIANCE, LARGE_BOX, LEASH, LOW_BOOTS, MAGIC_LAMP, MAGIC_MARKER, MEATBALL, MEAT_RING,
    MEAT_STICK, MUMMY_WRAPPING, OIL_LAMP, POT_ACID, POT_FRUIT_JUICE, POT_GAIN_ABILITY, POT_OIL,
    POT_POLYMORPH, POT_SEE_INVISIBLE, POT_SICKNESS, POT_WATER, RIN_ADORNMENT, RIN_GAIN_CONSTITUTION,
    RIN_GAIN_STRENGTH, RIN_INCREASE_ACCURACY, RIN_INCREASE_DAMAGE, RIN_PROTECTION,
    RIN_SHOCK_RESISTANCE, ROCK, SCR_BLANK_PAPER, SCR_FIRE, SCR_MAIL, SPE_BLANK_PAPER,
    SPE_BOOK_OF_THE_DEAD, SPE_CANCELLATION, SPE_CONE_OF_COLD, SPE_CURE_SICKNESS, SPE_DETECT_UNSEEN,
    SPE_DIG, SPE_DRAIN_LIFE, SPE_EXTRA_HEALING, SPE_FINGER_OF_DEATH, SPE_FIREBALL, SPE_FORCE_BOLT,
    SPE_HEALING, SPE_KNOCK, SPE_LIGHT, SPE_MAGIC_MISSILE, SPE_NOVEL, SPE_POLYMORPH, SPE_SLEEP,
    SPE_SLOW_MONSTER, SPE_STONE_TO_FLESH, SPE_TELEPORT_AWAY, SPE_TURN_UNDEAD, SPE_WIZARD_LOCK,
    STATUE, STRANGE_OBJECT, TIN, UNICORN_HORN, WAN_CANCELLATION, WAN_COLD, WAN_CREATE_MONSTER,
    WAN_DEATH, WAN_DIGGING, WAN_ENLIGHTENMENT, WAN_FIRE, WAN_LIGHT, WAN_LIGHTNING, WAN_LOCKING,
    WAN_MAGIC_MISSILE, WAN_MAKE_INVISIBLE, WAN_NOTHING, WAN_OPENING, WAN_POLYMORPH, WAN_PROBING,
    WAN_SECRET_DOOR_DETECTION, WAN_SLEEP, WAN_SLOW_MONSTER, WAN_SPEED_MONSTER, WAN_STASIS,
    WAN_STRIKING, WAN_TELEPORTATION, WAN_UNDEAD_TURNING, WAN_WISHING,
} from "./objects.h.js";
import {
    ACID_RES, COLD_RES, DISINT_RES, FIRE_RES, FLYING, INTRINSIC, INVIS, LEVITATION, SHOCK_RES,
    TIMEOUT, W_ACCESSORY, W_AMUL, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMOR, W_ARMS, W_ARMU,
    W_ART, W_ARTI, W_QUIVER, W_RING, W_RINGL, W_SADDLE, W_SWAPWEP, W_TOOL, W_WEAPONS, W_WEP,
} from "./prop.h.js";
import {
    CORR, DB_FLOOR, DB_ICE, DB_UNDER, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, D_BROKEN, D_NODOOR, GRAVE,
    HWALL, ICE, ICED_MOAT, ICED_POOL, IRONBARS, LAVAWALL, MOAT, POOL, ROOM, SCORR, SDOOR, STONE,
    VWALL, W_NONDIGGABLE,
} from "./rm.h.js";
import {
    IS_DOOR, IS_FOUNTAIN, IS_FURNITURE, IS_POOL, IS_ROOM, IS_SINK, IS_WALL, IS_WATERWALL, MON_AT,
    OBJ_AT, SURFACE_AT, Sokoban, ZAP_POS, levl, m_at,
} from "./rm.h.macros.js";
import { P_BASIC, P_EXPERT, P_ISRESTRICTED, P_SKILLED, P_UNSKILLED } from "./skills.h.js";
import { P_SKILL } from "./skills.h.macros.js";
import { MAX_SPELL_STUDY } from "./spell.h.js";
import { is_cmap_door } from "./sym.h.macros.js";
import { SYSOPT_SEDUCE } from "./sys.h.macros.js";
import { MELT_ICE_AWAY, REVIVE_MON, ROT_CORPSE, TIMER_LEVEL, TIMER_OBJECT } from "./timeout.h.js";
import {
    ANIMATE_SPELL, HOLE, PIT, STATUE_TRAP, TRAPDOOR, VIBRATING_SQUARE, WEB,
} from "./trap.h.js";
import { is_hole, is_magical_trap, is_pit, undestroyable_trap } from "./trap.h.macros.js";
import { cansee, couldsee } from "./vision.h.macros.js";
import {
    create_nhwindow, destroy_nhwindow, display_nhwindow, end_menu, nh_delay_output, putstr,
    start_menu,
} from "./winprocs.h.macros.js";
import {
    ATR_NONE, MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, NHW_MENU, NHW_TEXT, PICK_NONE, PICK_ONE,
    struct_any, struct_mi,
} from "./wintype.h.js";
import { TT_INFLOOR, TT_LAVA } from "./you.h.js";
import { Luck, Role_if, URIGHTY, Upolyd, u_at, uhim, uhis } from "./you.h.macros.js";
import {
    Acid_resistance, Antimagic, BInvis, Blind, Cold_resistance, Deaf, Disint_resistance,
    Drain_resistance, Fire_resistance, Fumbling, HFast, HStun, Half_spell_damage, Hallucination,
    Invis, Levitation, Passes_walls, Punished, Reflecting, Shock_resistance, Sleep_resistance,
    Stoned, Stunned, Teleport_control, Unchanging, Underwater,
} from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, sizeof, sizeof_string, uchar, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64, and64u, or64, shl64, shr64 } from "../rt/int64.js";
import { abs, assert, free, sprintf, strcat, strchr, strcpy, strlen } from "../rt/libc.js";
import {
    init_list, init_string, stack_array, stack_struct, stack_var, static_array, static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, elt, ptr_to, ref_of, struct, struct_assign, view_of,
} from "../rt/struct.js";
import { stop_occupation } from "./allmain.js";
import { alloc } from "./alloc.js";
import { o_unleash } from "./apply.js";
import { artifact_origin, defends, defends_when_carried } from "./artifact.js";
import { adjalign, exercise, poisoned } from "./attrib.js";
import { bot } from "./botl.js";
import { getdir, isok, xytodir } from "./cmd.js";
import {
    close_drawbridge, destroy_drawbridge, find_drawbridge, is_db_wall, is_drawbridge_wall, is_ice,
    is_lava, is_moat, is_pool, is_pool_or_lava, open_drawbridge,
} from "./dbridge.js";
import {
    cg, disp, flags, gb, gc, gi, gm, gn, go, gp, gs, gt, gv, gy, gz, hands_obj, iflags, svb, svc,
    svd, svk, svl, svm, svq, u, xdir, ydir,
} from "./decl.js";
import { cvt_sdoor_to_door, findit, show_map_spot } from "./detect.js";
import { bury_objs, draft_message, unearth_objs, zap_dig } from "./dig.js";
import {
    canseemon, docrt, glyph_at, knowninvisible, map_invisible, newsym, newsym_force, nul_glyphinfo,
    shieldeff, tmp_at, unmap_invisible, unmap_object, zapdir_to_glyph,
} from "./display.js";
import { boulder_hits_pool } from "./do.js";
import {
    Amonnam, Monnam, a_monnam, christen_monst, free_oname, hcolor, hliquid, mon_nam, mon_pmname,
    noit_Monnam, noname_monnam, rndmonnam,
} from "./do_name.js";
import { Ring_gone, disintegrate_arm, find_ac, hard_helmet, set_wear } from "./do_wear.js";
import { abuse_dog, tamedog, wary_dog } from "./dog.js";
import { ship_object } from "./dokick.js";
import {
    breakobj, breaks, endmultishot, hero_breaks, mhurtle, throwit_mon_hit,
} from "./dothrow.js";
import { defsyms } from "./drawing.js";
import {
    In_mines, Invocation_lev, ceiling, on_level, surface, update_mapseen_for,
} from "./dungeon.js";
import { cant_finish_meal, eaten_stat, fix_petrification } from "./eat.js";
import { done, panic } from "./end.js";
import {
    del_engr, engr_at, make_engr_at, random_engraving, rloc_engr, wipe_engr_at,
} from "./engrave.js";
import { losexp, more_experienced, newexplevel } from "./exper.js";
import { explode } from "./explode.js";
import { dryup } from "./fountain.js";
import {
    check_capacity, in_rooms, long_to_any, losehp, nomul, obj_to_any, set_uinwater, spoteffects,
    test_move,
} from "./hack.js";
import { eos, mungspaces, s_suffix, sgn, strncmpi, strsubst, upstart } from "./hacklib.js";
import { enlightenment, mstatusline, ustatusline } from "./insight.js";
import {
    addinv_core1, addinv_core2, delobj, delobj_core, display_binventory, display_cinventory,
    display_minventory, freeinv_core, getobj, hold_another_object, merged, set_cknown_lknown,
    sobj_at, stackobj, update_inventory, useup, useupall, useupf,
} from "./invent.js";
import { find_mid, show_transient_light, transient_light_cleanup } from "./light.js";
import { boxlock, doorlock, picking_at, reset_pick } from "./lock.js";
import { create_critters, makemon, monhp_per_lvl, newmcorpsenm, set_mimic_sym } from "./makemon.js";
import { death_inflicted_by } from "./mcastu.js";
import { sleep_monst, slept_monst } from "./mhitm.js";
import { expels, u_slow_down } from "./mhitu.js";
import { fix_wall_spines } from "./mkmaze.js";
import {
    add_to_minv, container_weight, corpse_revive_type, costly_alteration, dealloc_oextra, fixup_oil,
    free_omid, free_omonst, get_mtraits, is_flammable, is_rottable, mkobj, mksobj, mksobj_at,
    obj_extract_self, obj_ice_effects, place_object, recreate_pile_at, replace_object, set_corpsenm,
    splitobj, stone_furniture_type, stone_object_type, unbless, uncurse, weight,
} from "./mkobj.js";
import {
    can_be_hatched, check_gear_next_turn, dead_species, dealloc_monst, healmon, hideunder, killed,
    m_respond, maybe_unhide_at, mimic_hit_msg, minliquid, mlifesaver, mongone, monkilled, newcham,
    normal_shape, replmon, restore_cham, seemimic, set_ustuck, shieldeff_mon, unstuck, wake_nearto,
    wakeup, xkilled,
} from "./mon.js";
import {
    defended, dmgtype, monstseesu, monstunseesu, resists_blnd, resists_blnd_by_arti, resists_drli,
    resists_magm, sticks,
} from "./mondata.js";
import { closed_door, dissolve_bars, monflee } from "./monmove.js";
import { mons } from "./monst.js";
import { hits_bars, m_useup, rnd_hallublast, thitu } from "./mthrowu.js";
import { mcureblindness, mon_reflects, ureflects } from "./muse.js";
import { observe_object } from "./o_init.js";
import { objects } from "./objects.js";
import {
    An, The, Tobjnam, Yname2, an, ansimpleoname, aobjnam, bare_artifactname, boots_simple_name,
    cloak_simple_name, corpse_xname, cxname_singular, distant_name, doname, erosion_matters,
    gloves_simple_name, helm_simple_name, killer_xname, makeplural, otense, readobjnam, rnd_class,
    shield_simple_name, shirt_simple_name, simpleonames, suit_simple_name, the, vtense, xname,
    yname,
} from "./objnam.js";
import { waterbody_name } from "./pager.js";
import { encumber_msg, force_decor, u_safe_from_fatal_corpse } from "./pickup.js";
import {
    Norep, You, You_feel, You_hear, Your, impossible, livelog_printf, pline, pline_The, pline_dir,
    set_msg_xy, urgent_pline,
} from "./pline.js";
import { body_part, polymon, polyself, rehumanize, ugolemeffects } from "./polyself.js";
import {
    healup, incr_itimeout, make_blinded, make_stunned, potionbreathe, self_invis_message, speed_up,
} from "./potion.js";
import { ok_to_quest } from "./quest.js";
import { is_quest_artifact } from "./questpgr.js";
import { cant_revive, litroom, recharge, unpunish } from "./read.js";
import { create_gas_cloud } from "./region.js";
import { d, rn2, rn2_on_display_rng, rnd } from "./rnd.js";
import {
    Shk_Your, add_damage, addtobill, billable, check_unpaid, contained_cost, costly_spot,
    delete_contents, hot_pursuit, inhishop, inside_shop, make_angry_shk, obfree, pay_for_damage,
    shk_your, shkcatch, shop_keeper, stolen_value,
} from "./shk.js";
import { Shknam, neweshk, shkname } from "./shknam.js";
import { spell_skilltype } from "./spell.js";
import { mdrop_obj, remove_worn_item } from "./steal.js";
import { enexto, rloco, tele, u_teleport_mon } from "./teleport.js";
import {
    attach_egg_hatch_timeout, burn_away_slime, fall_asleep, kill_egg, obj_stop_timers, peek_timer,
    spot_stop_timers, spot_time_left, start_timer, stop_timer,
} from "./timeout.js";
import {
    acid_damage, activate_statue_trap, animate_statue, burnarmor, closeholdingtrap, delfloortrap,
    deltrap, dotrap, fill_pit, ignite_items, maketrap, mintrap, openfallingtrap, openholdingtrap,
    reset_utrap, set_utrap, sokoban_guilt, t_at, trap_ice_effects, trapname,
} from "./trap.js";
import {
    disguised_as_mon, disguised_as_non_mon, erode_armor, flash_hits_mon, m_is_steadfast, shade_miss,
    that_is_a_mimic,
} from "./uhitm.js";
import {
    block_point, does_block, recalc_block_point, unblock_point, vision_recalc,
} from "./vision.js";
import { dmgval } from "./weapon.js";
import { set_twoweap, setuqwep, setuswapwep, setuwep } from "./wield.js";
import { add_menu, getlin, select_menu } from "./windows.js";
import {
    bypass_obj, bypass_objlist, extract_from_minvent, find_mac, mon_adjust_speed, mon_set_minvis,
    nxt_unbypassed_obj, setnotworn, setworn, wearmask_to_obj, wearslot, which_armor,
} from "./worn.js";
const __FILE__ = "zap.c";
