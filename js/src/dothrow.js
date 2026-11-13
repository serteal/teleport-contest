/* NetHack 5.0	dothrow.c	$NHDT-Date: 1737343372 2025/01/19 19:22:52 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.300 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2013. */
/* NetHack may be freely redistributed.  See license for details. */

/* Contains code for 't' (throw) */

/* uwep might already be removed from inventory so test for W_WEP instead;
   for Valk+Mjollnir, caller needs to validate the strength requirement */
export function AutoReturn(o, wmsk) { return +(((wmsk & W_WEP) != 0
      && (o.otyp == AKLYS
          || (o.oartifact == ART_MJOLLNIR && Role_if(PM_VALKYRIE))))
     || o.otyp == BOOMERANG); }

/* gt.thrownobj (decl.c) tracks an object until it lands */

export function multishot_class_bonus(
    pm,
    ammo,
    launcher) { /* int */ /* can be NULL */
    let multishot = 0;
    let skill = objects[ammo.otyp].oc_subtyp;

    switch (pm) {
    case PM_CAVE_DWELLER:
        /* give bonus for low-tech gear */
        if (skill == -P_SLING || skill == P_SPEAR)
            multishot++;
        break;
    case PM_MONK:
        /* allow higher volley count despite skill limitation */
        if (skill == -P_SHURIKEN)
            multishot++;
        break;
    case PM_RANGER:
        /* arbitrary; encourage use of other missiles beside daggers */
        if (skill != P_DAGGER)
            multishot++;
        break;
    case PM_ROGUE:
        /* possibly should add knives... */
        if (skill == P_DAGGER)
            multishot++;
        break;
    case PM_NINJA:
        if (skill == -P_SHURIKEN || skill == -P_DART)
            multishot++;
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case PM_SAMURAI:
        /* role-specific launcher and its ammo */
        if (ammo.otyp == YA && launcher && launcher.otyp == YUMI)
            multishot++;
        break;
    default:
        break; /* No bonus */
    }

    return multishot;
}

/* Throw the selected object, asking for direction */
function throw_obj(obj, shotlimit) { /* int */
    const $frame = stack_frame(); try {
    var otmp, oldslot;
    var multishot;
    var skill;
    var wep_mask;
    var twoweap, weakmultishot;
    var res = ECMD_TIME;
    var save_osplit = struct_assign(stack_struct(struct_obj_split), svc.context.objsplit);

    /* ask "in what direction?" */
    unsplit_stack: { if (!getdir(0)) {
        /* No direction specified, so cancel the throw */
        res = ECMD_CANCEL; /* no time passes */
        break unsplit_stack;
    }

    /*
     * Throwing gold is usually for getting rid of it when
     * a leprechaun approaches, or for bribing an oncoming
     * angry monster.  So throw the whole object.
     *
     * If the gold is in quiver, throw one coin at a time,
     * possibly using a sling.
     */
    if (obj.oclass == COIN_CLASS && obj != uquiver) {
        /* throw_gold will unsplit the stack itself if necessary and may have
           freed the object, so don't route through unsplit_stack here */
        return throw_gold(obj); /* check */
    }

    if (!canletgo(obj, _("throw"))) {
        res = ECMD_OK;
        break unsplit_stack;
    }
    if (is_art(obj, ART_MJOLLNIR) && obj != uwep) {
        pline(_("%s must be wielded before it can be thrown."), The(xname(obj)));
        res = ECMD_OK;
        break unsplit_stack;
    }
    if ((is_art(obj, ART_MJOLLNIR) && ACURR(A_STR) < STR19(25))
        || (obj.otyp == BOULDER && !throws_rocks(gy.youmonst.data))) {
        pline(_("It's too heavy."));
        res = ECMD_TIME;
        break unsplit_stack;
    }
    if (!u.dx && !u.dy && !u.dz) {
        You(_("cannot throw an object at yourself."));
        res = ECMD_OK;
        break unsplit_stack;
    }
    u_wipe_engr(2);
    if (!uarmg && obj.otyp == CORPSE && touch_petrifies(mons[obj.corpsenm])
        && !Stone_resistance()) {
        You(_("throw %s with your bare %s."),
            corpse_xname(obj, 0, CXN_PFX_THE),
            /* throwing with one hand, but pluralize since the
               expression "with your bare hands" sounds better */
            makeplural(body_part(HAND)));
        sprintf(svk.killer.name, _("throwing %s bare-handed"), killer_xname(obj))
;
        instapetrify(svk.killer.name);
    }
    if (welded(obj)) {
        weldmsg(obj);
        res = ECMD_TIME;
        break unsplit_stack;
    }
    if (is_wet_towel(obj))
        dry_a_towel(obj, -1, FALSE);

    /* Multishot calculations
     * (potential volley of up to N missiles; default for N is 1)
     */
    multishot = 1;
    skill = objects[obj.otyp].oc_subtyp;
    if (obj.quan > 1 /* no point checking if there's only 1 */
        /* ammo requires corresponding launcher be wielded */
        && (is_ammo(obj) ? matching_launcher(obj, uwep)
                         /* otherwise any stackable (non-ammo) weapon */
                         : obj.oclass == WEAPON_CLASS)
        && !(Confusion() || Stunned())) {
        /* some roles don't get a volley bonus until becoming expert */
        weakmultishot = (Role_if(PM_WIZARD) || Role_if(PM_CLERIC)
                         || (Role_if(PM_HEALER) && skill != P_KNIFE)
                         || (Role_if(PM_TOURIST) && skill != -P_DART)
                         /* poor dexterity also inhibits multishot */
                         || Fumbling() || ACURR(A_DEX) <= 6 ? 1 : 0);

        /* Bonus if the player is proficient in this weapon... */
        switch (P_SKILL(weapon_type(obj))) {
        case P_EXPERT:
            multishot++;
            /* FALLTHROUGH */;
        /*FALLTHRU*/
        case P_SKILLED:
            if (!weakmultishot)
                multishot++;
            break;
        default: /* basic or unskilled: no bonus */
            break;
        }
        /* ...or is using a special weapon for their role... */
        multishot += multishot_class_bonus(Role_switch(), obj, uwep);

        /* ...or using their race's special bow; no bonus for spears */
        if (!weakmultishot) {
            switch (Race_switch()) {
            case PM_ELF:
                if (obj.otyp == ELVEN_ARROW && uwep
                    && uwep.otyp == ELVEN_BOW)
                    multishot++;
                break;
            case PM_ORC:
                if (obj.otyp == ORCISH_ARROW && uwep
                    && uwep.otyp == ORCISH_BOW)
                    multishot++;
                break;
            case PM_GNOME:
                /* arbitrary; there isn't any gnome-specific gear */
                if (skill == -P_CROSSBOW)
                    multishot++;
                break;
            case PM_HUMAN:
            case PM_DWARF:
            default:
                break; /* No bonus */
            }

            /* when launcher is own quest artifact, give extra +1 with any
               type of ammo appropriate for that launcher (compensates for
               elven and orcish rangers loss of bonus for use of racial bow
               plus racial arrows if they switch to the Longbow of Diana) */
            if (uwep && is_quest_artifact(uwep)
                && ammo_and_launcher(obj, uwep))
                ++multishot;
        }

        /* crossbows are slow to load and probably shouldn't allow multiple
           shots at all, but that would result in players never using them;
           instead, high strength is necessary to load and shoot quickly */
        if (multishot > 1 && skill == -P_CROSSBOW
            && ammo_and_launcher(obj, uwep)
            && ACURRSTR() < (Race_if(PM_GNOME) ? 16 : 18))
            multishot = rnd(multishot);

        multishot = rnd(multishot);
        if (multishot > obj.quan)
            multishot = int(obj.quan);
        if (shotlimit > 0 && multishot > shotlimit)
            multishot = shotlimit;
    }

    gm.m_shot.s = ammo_and_launcher(obj, uwep) ? TRUE : FALSE;
    /* give a message if shooting more than one, or if player
       attempted to specify a count */
    if (multishot > 1 || shotlimit > 0) {
        /* "You shoot N arrows." or "You throw N daggers." */
        You(_("%s %d %s."), gm.m_shot.s ? _("shoot") : _("throw"),
            multishot, /* (might be 1 if player gave shotlimit) */
            (multishot == 1) ? singular(obj, xname) : xname(obj));
    }

    wep_mask = obj.owornmask;
    oldslot = null;
    gm.m_shot.o = obj.otyp;
    gm.m_shot.n = multishot;
    for (gm.m_shot.i = 1; gm.m_shot.i <= gm.m_shot.n; gm.m_shot.i++) {
        twoweap = u.twoweap;
        assert(obj != null); /* m_shot.i <= m_shot.n guarantees this */
        /* split this object off from its slot if necessary */
        if (obj.quan > 1) {
            otmp = splitobj(obj, 1);
        } else {
            otmp = obj;
            if (otmp.owornmask)
                remove_worn_item(otmp, FALSE);
            oldslot = obj.nobj;
            /* obj will leave inventory and may be freed by throwit, don't
               try to unsplit it from potential parent stack below */
            obj = null;
        }
        freeinv(otmp);
        throwit(otmp, wep_mask, twoweap, oldslot);
        encumber_msg();
    }
    gm.m_shot.n = gm.m_shot.i = 0;
    gm.m_shot.o = STRANGE_OBJECT;
    gm.m_shot.s = FALSE;
 }
    /* might need to undo an object split.
     * We used to use freeinv(obj),addinv(obj) here, but that can
     * merge obj into another stack--usually quiver--even if it hadn't
     * been split from there (possibly triggering a panic in addinv),
     * and freeinv+addinv potentially has other side-effects.
     */
    if (obj && obj != uquiver
        && (obj.o_id == save_osplit.parent_oid
            || obj.o_id == save_osplit.child_oid)) {
        /* futureproofing: objsplit will have been affected if partial stack
           was thrown; objects will have been split off stack to throw. */
        struct_assign(svc.context.objsplit, save_osplit);
        unsplitobj(obj);
    }
    return res;
    } finally { stack_pop($frame); }
}

/* common to dothrow() and dofire() */
function ok_to_throw(shotlimit_p) { /* boolean */ /* (see dothrow()) */
    shotlimit_p[0] = LIMIT_TO_RANGE_INT(0, LARGEST_INT, gc.command_count);
    gm.multi = 0; /* reset; it's been used up */

    if (notake(gy.youmonst.data)) {
        You(_("are physically incapable of throwing or shooting anything."));
        return FALSE;
    } else if (nohands(gy.youmonst.data)) {
        You_cant(_("throw or shoot without hands.")); /* not body_part(HAND) */
        return FALSE;
        /*[what about !freehand(), aside from cursed missile launcher?]*/
    }
    if (check_capacity(0))
        return FALSE;
    return TRUE;
}

/* getobj callback for object to be thrown */
function throw_ok(obj) { /* int */
    if (!obj)
        return GETOBJ_EXCLUDE;

    if (obj.bknown && welded(obj)) /* not a candidate if known to be stuck */
        return GETOBJ_DOWNPLAY;

    if (AutoReturn(obj, obj.owornmask)
        /* to get here, obj is boomerang or is uwep and (alkys or Mjollnir) */
        && (obj.oartifact != ART_MJOLLNIR || ACURR(A_STR) >= STR19(25)))
        return GETOBJ_SUGGEST;

    if (obj.quan == 1 && (obj == uwep || (obj == uswapwep && u.twoweap)))
        return GETOBJ_DOWNPLAY;

    if (obj.oclass == COIN_CLASS)
        return GETOBJ_SUGGEST;

    if (!uslinging() && obj.oclass == WEAPON_CLASS)
        return GETOBJ_SUGGEST;
    /* Possible extension: exclude weapons that make no sense to throw,
       such as whips, bows, slings, rubber hoses. */

    if (uslinging() && obj.oclass == GEM_CLASS)
        return GETOBJ_SUGGEST;

    if (throws_rocks(gy.youmonst.data) && obj.otyp == BOULDER)
        return GETOBJ_SUGGEST;

    return GETOBJ_DOWNPLAY;
}

/* the #throw command */
export function dothrow() { /* int */
    const $frame = stack_frame(); try {
    let obj;
    let shotlimit = stack_var(int);

    /*
     * Since some characters shoot multiple missiles at one time,
     * allow user to specify a count prefix for 'f' or 't' to limit
     * number of items thrown (to avoid possibly hitting something
     * behind target after killing it, or perhaps to conserve ammo).
     *
     * Prior to 3.3.0, command ``3t'' meant ``t(shoot) t(shoot) t(shoot)''
     * and took 3 turns.  Now it means ``t(shoot at most 3 missiles)''.
     *
     * [3.6.0:  shot count setup has been moved into ok_to_throw().]
     */
    if (!ok_to_throw(shotlimit))
        return ECMD_OK;

    obj = getobj(_("throw"), throw_ok, GETOBJ_PROMPT | GETOBJ_ALLOWCNT);
    /* it is also possible to throw food */
    /* (or jewels, or iron balls... ) */

    return obj ? throw_obj(obj, shotlimit[0]) : ECMD_CANCEL;
    } finally { stack_pop($frame); }
}

/* KMH -- Automatically fill quiver */
/* Suggested by Jeffrey Bay <jbay@convex.hp.com> */
function autoquiver() { /* void */
    let otmp, oammo = null, omissile = null, omisc = null, altammo = null;

    if (uquiver)
        return;

    /* Scan through the inventory */
    for (otmp = gi.invent; otmp; otmp = otmp.nobj) {
        if (otmp.owornmask || otmp.oartifact || !otmp.dknown) {
            ; /* Skip it */
        } else if (otmp.otyp == ROCK
                   /* seen rocks or known flint or known glass */
                   || (otmp.otyp == FLINT
                       && objects[otmp.otyp].oc_name_known)
                   || (otmp.oclass == GEM_CLASS
                       && objects[otmp.otyp].oc_material == GLASS
                       && objects[otmp.otyp].oc_name_known)) {
            if (uslinging())
                oammo = otmp;
            else if (ammo_and_launcher(otmp, uswapwep))
                altammo = otmp;
            else if (!omisc)
                omisc = otmp;
        } else if (otmp.oclass == GEM_CLASS) {
            ; /* skip non-rock gems--they're ammo but
                 player has to select them explicitly */
        } else if (is_ammo(otmp)) {
            if (ammo_and_launcher(otmp, uwep))
                /* Ammo matched with launcher (bow+arrow, crossbow+bolt) */
                oammo = otmp;
            else if (ammo_and_launcher(otmp, uswapwep))
                altammo = otmp;
            else
                /* Mismatched ammo (no better than an ordinary weapon) */
                omisc = otmp;
        } else if (is_missile(otmp)) {
            /* Missile (dart, shuriken, etc.) */
            omissile = otmp;
        } else if (otmp.oclass == WEAPON_CLASS && throwing_weapon(otmp)) {
            /* Ordinary weapon */
            if (objects[otmp.otyp].oc_subtyp == P_DAGGER && !omissile)
                omissile = otmp;
            else if (otmp.otyp == AKLYS)
                continue;
            else
                omisc = otmp;
        }
    }

    /* Pick the best choice */
    if (oammo)
        setuqwep(oammo);
    else if (omissile)
        setuqwep(omissile);
    else if (altammo)
        setuqwep(altammo);
    else if (omisc)
        setuqwep(omisc);

    return;
}

/* look through hero inventory for launcher matching ammo,
   avoiding known cursed items. Returns NULL if no match. */
function find_launcher(ammo) { /* struct obj * */
    let otmp, oX;

    if (!ammo)
        return null;

    for (oX = null, otmp = gi.invent; otmp; otmp = otmp.nobj) {
        if (otmp.cursed && otmp.bknown)
            continue; /* known to be cursed, so skip */
        if (ammo_and_launcher(ammo, otmp)) {
            if (otmp.bknown)
                return otmp; /* known-B or known-U (known-C won't get here) */
            if (!oX)
                oX = otmp; /* unknown-BUC; used if no known-BU item found */
        }
    }
    return oX;
}

/* the #fire command -- throw from the quiver or use wielded polearm */
export function dofire() { /* int */
    const $frame = stack_frame(); try {
    let shotlimit = stack_var(int);
    let obj;
    /* AutoReturn() verifies Valkyrie if weapon is Mjollnir, but it relies
       on its caller to make sure hero is strong enough to throw that */
    let uwep_Throw_and_Return = (uwep && AutoReturn(uwep, uwep.owornmask)
                                     && (uwep.oartifact != ART_MJOLLNIR
                                         || ACURR(A_STR) >= STR19(25)) ? 1 : 0),
            skip_fireassist = FALSE;
    let altres, res = ECMD_OK;

    /*
     * Same as dothrow(), except we use quivered missile instead
     * of asking what to throw/shoot.  [Note: with the advent of
     * fireassist that is no longer accurate...]
     *
     * If hero is wielding a thrown-and-return weapon and quiver
     * is empty or contains ammo, use the wielded weapon (won't
     * have any ammo's launcher wielded due to the weapon).
     * If quiver is empty, use autoquiver to fill it when the
     * corresponding option is on.
     * If option is off or autoquiver doesn't select anything,
     * we ask what to throw.
     * Then we put the chosen item into the quiver slot unless
     * it is already in another slot.  [Matters most if it is a
     * stack but also matters for single item if this throw gets
     * aborted (ESC at the direction prompt).]
     */
    if (!ok_to_throw(shotlimit))
        return ECMD_OK;

    obj = uquiver;
    /* if wielding a throw-and-return weapon, throw it if quiver is empty
       or has ammo rather than missiles [since the throw/return weapon is
       wielded, the ammo's launcher isn't; the ammo-only policy avoids
       throwing Mjollnir if quiver contains daggers] */
    if (uwep_Throw_and_Return && (!obj || is_ammo(obj))) {
        obj = uwep;
        skip_fireassist = TRUE;
    } else if (!obj) {
        if (!flags.autoquiver) {
            /* if we're wielding a polearm, apply it */
            if (uwep && is_pole(uwep)) {
                return use_pole(uwep, TRUE);
            /* if we're wielding a bullwhip, apply it */
            } else if (uwep && uwep.otyp == BULLWHIP) {
                return use_whip(uwep);
            } else if (iflags.fireassist
                       && uswapwep && is_pole(uswapwep)
                       && !(uswapwep.cursed && uswapwep.bknown)) {
                /* we have a known not-cursed polearm as swap weapon.
                   swap to it and retry */
                cmdq_add_ec(CQ_CANNED, doswapweapon);
                cmdq_add_ec(CQ_CANNED, dofire);
                return ECMD_OK; /* haven't taken any time yet */
            } else {
                You(_("have no ammunition readied."));
            }
        } else {
            autoquiver();
            obj = uquiver;
            if (obj) {
                /* give feedback if quiver has now been filled */
                uquiver.owornmask = and64(uquiver.owornmask, ~W_QUIVER); /* less verbose */
                prinv(_("You ready:"), obj, 0);
                uquiver.owornmask = or64(uquiver.owornmask, W_QUIVER);
            } else {
                You(_("have nothing appropriate for your quiver."));
            }
        }
    }

    /* if autoquiver is disabled or has failed, prompt for missile */
    if (!obj) {
        /* in case we're using ^A to repeat prior 'f' command, don't
           use direction of previous throw as getobj()'s choice here */
        gi.in_doagain = 0;

        /* this gives its own feedback about populating the quiver slot */
        res = doquiver_core(_("fire"));
        if (res != ECMD_OK && res != ECMD_TIME)
            return res;

        obj = uquiver;
    }

    if (uquiver && is_ammo(uquiver) && iflags.fireassist
        && !skip_fireassist) {
        let olauncher;

        if (uwep && is_pole(uwep) && could_pole_mon())
            return use_pole(uwep, TRUE);
        /* Try to find a launcher */
        if (ammo_and_launcher(uquiver, uwep)) {
            obj = uquiver;
        } else if (ammo_and_launcher(uquiver, uswapwep)) {
            /* swap weapons and retry fire */
            cmdq_add_ec(CQ_CANNED, doswapweapon);
            cmdq_add_ec(CQ_CANNED, dofire);
            return res;
        } else if ((olauncher = find_launcher(uquiver)) != null) {
            /* wield launcher, retry fire */
            if (uwep && !flags.pushweapon)
                cmdq_add_ec(CQ_CANNED, doswapweapon);
            cmdq_add_ec(CQ_CANNED, dowield);
            cmdq_add_key(CQ_CANNED, olauncher.invlet);
            cmdq_add_ec(CQ_CANNED, dofire);
            return res;
        }
    }

    altres = obj ? throw_obj(obj, shotlimit[0]) : ECMD_CANCEL;
    /* fire can take time by filling quiver (if that causes something which
       was wielded to be unwielded) even if the throw itself gets cancelled */
    return (res == ECMD_TIME) ? res : altres;
    } finally { stack_pop($frame); }
}

/* if in midst of multishot shooting/throwing, stop early */
export function endmultishot(verbose) { /* void */
    if (gm.m_shot.i < gm.m_shot.n) {
        if (verbose && !svc.context.mon_moving) {
            You(_("stop %s after the %d%s %s."),
                gm.m_shot.s ? _("firing") : _("throwing"),
                gm.m_shot.i, ordin(gm.m_shot.i),
                gm.m_shot.s ? _("shot") : _("toss"));
        }
        gm.m_shot.n = gm.m_shot.i; /* make current shot be the last */
    }
}

/* Object hits floor at hero's feet.
   Called from drop(), throwit(), hold_another_object(), litter(). */
export function hitfloor(
    obj,
    verbosely) { /* void */ /* usually True; False if caller has given drop mesg */
    if (IS_SOFT(levl()[u.ux][u.uy].typ) || u.uinwater || u.uswallow) {
        dropy(obj);
        return;
    }
    if (IS_ALTAR(levl()[u.ux][u.uy].typ)) {
        doaltarobj(obj);
    } else if (verbosely) {
        let verb = (obj.otyp == WAN_STRIKING) ? _("strike") : _("hit");
        let surf = surface(u.ux, u.uy);
        let t = t_at(u.ux, u.uy);

        /* describe something that might keep the object where it is
           or precede next message stating that it falls */
        if (t && t.tseen) {
            switch (t.ttyp) {
            case TRAPDOOR:
                surf = _("trap door");
                break;
            case HOLE:
                surf = _("edge of the hole");
                break;
            case PIT:
            case SPIKED_PIT:
                surf = _("edge of the pit");
                break;
            default:
                break;
            }
        }
        pline(_("%s %s the %s."), Doname2(obj), otense(obj, verb), surf);
    }

    if (hero_breaks(obj, u.ux, u.uy, BRK_FROM_INV))
        return;
    if (ship_object(obj, u.ux, u.uy, FALSE))
        return;
    dropz(obj, TRUE);
}

/*
 * Walk a path from src_cc to dest_cc, calling a proc for each location
 * except the starting one.  If the proc returns FALSE, stop walking
 * and return FALSE.  If stopped early, dest_cc will be the location
 * before the failed callback.
 */
export function walk_path(
    src_cc, dest_cc,
    check_proc,
    arg) { /* boolean */
    let err;
    let x, y, dx, dy, x_change, y_change, i, prev_x, prev_y;
    let keep_going = TRUE;

    /* Use Bresenham's Line Algorithm to walk from src to dest.
     *
     * This should be replaced with a more versatile algorithm
     * since it handles slanted moves in a suboptimal way.
     * Going from 'x' to 'y' needs to pass through 'z', and will
     * fail if there's an obstacle there, but it could choose to
     * pass through 'Z' instead if that way imposes no obstacle.
     *     ..y          .Zy
     *     xz.    vs    x..
     * Perhaps we should check both paths and accept whichever
     * one isn't blocked.  But then multiple zigs and zags could
     * potentially produce a meandering path rather than the best
     * attempt at a straight line.  And (*check_proc)() would
     * need to work more like 'travel', distinguishing between
     * testing a possible move and actually attempting that move.
     */
    dx = dest_cc.x - src_cc.x;
    dy = dest_cc.y - src_cc.y;
    prev_x = x = src_cc.x;
    prev_y = y = src_cc.y;

    if (dx < 0) {
        x_change = -1;
        dx = -dx;
    } else {
        x_change = 1;
    }
    if (dy < 0) {
        y_change = -1;
        dy = -dy;
    } else {
        y_change = 1;
    }
    i = err = 0;
    if (dx < dy) {
        while (i++ < dy) {
            prev_x = x;
            prev_y = y;
            y += y_change;
            err += dx << 1;
            if (err > dy) {
                x += x_change;
                err -= dy << 1;
            }
            /* check for early exit condition */
            if (!(keep_going = check_proc(arg, x, y)))
                break;
        }
    } else {
        while (i++ < dx) {
            prev_x = x;
            prev_y = y;
            x += x_change;
            err += dy << 1;
            if (err > dx) {
                y += y_change;
                err -= dx << 1;
            }
            /* check for early exit condition */
            if (!(keep_going = check_proc(arg, x, y)))
                break;
        }
    }

    if (keep_going)
        return TRUE; /* successful */

    dest_cc.x = prev_x;
    dest_cc.y = prev_y;
    return FALSE;
}

/* hack for hurtle_step() -- it ought to be changed to take an argument
   indicating lev/fly-to-dest vs lev/fly-to-dest-minus-one-land-on-dest
   vs drag-to-dest; original callers use first mode, jumping wants second,
   grappling hook backfire and thrown chained ball need third */
export function hurtle_jump(arg, x, y) { /* boolean */
    let res;
    let save_EWwalking = EWwalking();

    /* prevent jumping over water from being placed in that water */
    u.uprops[WWALKING].extrinsic = or64(u.uprops[WWALKING].extrinsic, I_SPECIAL);
    res = hurtle_step(arg, x, y);
    u.uprops[WWALKING].extrinsic = save_EWwalking;
    return res;
}

/*
 * Single step for the hero flying through the air from jumping, flying,
 * etc.  Called from hurtle() and jump() via walk_path().  We expect the
 * argument to be a pointer to an integer -- the range -- which is
 * used in the calculation of points off if we hit something.
 *
 * Bumping into monsters won't cause damage but will wake them and make
 * them angry.  Auto-pickup isn't done, since you don't have control over
 * your movements at the time.
 *
 * Possible additions/changes:
 *      o really attack monster if we hit one
 *      o set stunned if we hit a wall or door
 *      o reset nomul when we stop
 *      o creepy feeling if pass through monster (if ever implemented...)
 *      o bounce off walls
 *      o let jumps go over boulders
 */
export function hurtle_step(arg, x, y) { /* boolean */
    const $frame = stack_frame(); try {
    let ox, oy;
    let range = ref_to(int, arg);
    let obj;
    let mon;
    let may_pass = TRUE, via_jumping, stopping_short;
    let ttmp;
    let lev;
    let ltyp, dmg = 0;

    if (!isok(x, y)) {
        You_feel(_("the spirits holding you back."));
        return FALSE;
    } else if (!in_out_region(x, y)) {
        return FALSE;
    } else if (range[0] == 0) {
        return FALSE; /* previous step wants to stop now */
    }
    via_jumping = +((EWwalking() & I_SPECIAL) != 0);
    stopping_short = (via_jumping && range[0] < 2 ? 1 : 0);
    lev = levl()[x][y];
    ltyp = lev.typ;

    if (!Passes_walls() || !(may_pass = may_passwall(x, y))) {
        let why = 0;
        let diagonal = +((u.ux - x) != 0 && (u.uy - y) != 0),
                open_door = +(IS_DOOR(ltyp) && (lev.flags & D_ISOPEN) != 0),
                odoor_diag = (open_door && diagonal ? 1 : 0);

        if (IS_OBSTRUCTED(levl()[x][y].typ)
            || closed_door(x, y) || odoor_diag) {
            why = IS_TREE(ltyp) ? _("bumping into a tree")
                  : IS_OBSTRUCTED(ltyp) ? _("bumping into a wall")
                    : odoor_diag ? _("bumping into a door frame")
                      : _("bumping into a closed door");
            if (odoor_diag)
                You(_("hit the door frame!"));
            pline(_("Ouch!"));
        } else if (ltyp == IRONBARS) {
            why = _("crashing into iron bars");
            You(_("crash into some iron bars.  Ouch!"));
        } else if ((obj = sobj_at(BOULDER, x, y)) != null) {
            why = _("bumping into a boulder");
            You(_("bump into a %s.  Ouch!"), xname(obj));
        }  else if (!may_pass) {
            /* did we hit a no-dig non-wall position? */
            why = _("touching the edge of the universe");
            You(_("smack into something!"));
        } else if (diagonal
                   && bad_rock(gy.youmonst.data, u.ux, y)
                   && bad_rock(gy.youmonst.data, x, u.uy)) {
            let too_much = (gi.invent
                       && (inv_weight() + weight_cap() > WT_TOOMUCH_DIAGONAL) ? 1 : 0);

            if (bigmonst(gy.youmonst.data) || too_much) {
                why = _("wedging into a narrow crevice");
                You(_("%sget forcefully wedged into a crevice."),
                    too_much ? _("and all your belongings ") : _(""));
            }
        }
        if (why) {
            dmg = rnd(2 + range[0]);
            losehp(Maybe_Half_Phys(dmg), why, KILLED_BY);
            wake_nearto(x, y, 10);
            return FALSE;
        }
    }

    if ((mon = m_at(x, y)) != null

        ) {
        let mnam;
        let glyph = glyph_at(x, y);

        mon.mundetected = 0; /* wakeup() will handle mimic */
        /* after unhiding; combination of a_monnam() and some_mon_nam();
           yields "someone" or "something" instead of "it" for unseen mon */
        mnam = x_monnam(mon, ARTICLE_A, 0,
                        ((has_mgivenname(mon) ? SUPPRESS_SADDLE : 0)
                         | AUGMENT_IT),
                        FALSE);
        if (!glyph_is_monster(glyph) && !glyph_is_invisible(glyph))
            You(_("find %s by bumping into %s."), mnam, noit_mhim(mon));
        else
            You(_("bump into %s."), mnam);
        wakeup(mon, FALSE);
        if (!canspotmon(mon))
            map_invisible(mon.mx, mon.my);
        setmangry(mon, FALSE);
        if (touch_petrifies(mon.data)
            /* this is a bodily collision, so check for body armor */
            && !uarmu && !uarm && !uarmc) {
            sprintf(svk.killer.name, _("bumping into %s"), an(pmname(mon.data, NEUTRAL)))
;
            instapetrify(svk.killer.name);
        }
        if (touch_petrifies(gy.youmonst.data)
            && !which_armor(mon, W_ARMU | W_ARM | W_ARMC)) {
            minstapetrify(mon, TRUE);
        }
        wake_nearto(x, y, 10);
        return FALSE;
    }

    if ((u.ux - x) && (u.uy - y)
        && bad_rock(gy.youmonst.data, u.ux, y)
        && bad_rock(gy.youmonst.data, x, u.uy)) {
        /* Move at a diagonal. */
        if (Sokoban()) {
            You(_("come to an abrupt halt!"));
            return FALSE;
        }
    }

    /* caller has already determined that dragging the ball is allowed;
       if ball is carried we might still need to drag the chain */
    if (Punished()) {
        let bc_control = stack_var(int);
        let ballx = stack_var(coordxy), bally = stack_var(coordxy), chainx = stack_var(coordxy), chainy = stack_var(coordxy);
        let cause_delay = stack_var(boolean);

        if (drag_ball(x, y, bc_control, ballx, bally, chainx,
                      chainy, addr_of(cause_delay), TRUE))
            move_bc(0, bc_control[0], ballx[0], bally[0], chainx[0], chainy[0]);
    }

    ox = u.ux;
    oy = u.uy;
    u_on_newpos(x, y); /* set u.<ux,uy>, u.usteed-><mx,my>; cliparound(); */
    newsym(ox, oy);    /* update old position */
    vision_recalc(1);  /* update for new position */
    flush_screen(1);
    /* if terrain type changes, levitation or flying might become blocked
       or unblocked; might issue message, so do this after map+vision has
       been updated for new location instead of right after u_on_newpos() */
    if (ltyp != levl()[ox][oy].typ)
        switch_terrain();

    /* might be entering a special room (treasure zoo, thrown room, &c) that
       has a first-time entry message, or leaving shop with unpaid goods */
    check_special_room(FALSE);

    if (is_pool(x, y) && !u.uinwater) {
        if (is_waterwall(x, y) || !(Levitation() || Flying() || Wwalking())) {
            /* couldn't move while hurtling; allow movement now so that
               drown() will give a chance to crawl out of pool and survive */
            gm.multi = 0;
            drown();
            return FALSE;
        } else if (!Is_waterlevel(u.uz) && !stopping_short) {
            Norep(_("You move over %s."), an(is_moat(x, y) ? _("moat") : _("pool")));
        }
    } else if (is_lava(x, y) && !stopping_short) {
        Norep(_("You move over some lava."));
    }

    /* FIXME:
     * Each trap should really trigger on the recoil if it would
     * trigger during normal movement. However, not all the possible
     * side-effects of this are tested [as of 3.4.0] so we trigger
     * those that we have tested, and offer a message for the ones
     * that we have not yet tested.
     */
    if ((ttmp = t_at(x, y)) != null) {
        if (stopping_short) {
            ; /* see the comment above hurtle_jump() */
        } else if (ttmp.ttyp == MAGIC_PORTAL) {
            dotrap(ttmp, NO_TRAP_FLAGS);
            return FALSE;
        } else if (ttmp.ttyp == VIBRATING_SQUARE) {
            pline(_("The ground vibrates as you pass it."));
            dotrap(ttmp, NO_TRAP_FLAGS); /* doesn't print messages */
        } else if (ttmp.ttyp == FIRE_TRAP) {
            dotrap(ttmp, NO_TRAP_FLAGS);
        } else if ((is_pit(ttmp.ttyp) || is_hole(ttmp.ttyp)) && Sokoban()) {
            /* air currents overcome the recoil in Sokoban;
               when jumping, caller performs last step and enters trap */
            if (!via_jumping)
                dotrap(ttmp, NO_TRAP_FLAGS);
            range[0] = 0;
            return TRUE;
        } else {
            if (ttmp.tseen)
                You(_("pass right over %s."), an(trapname(ttmp.ttyp, FALSE)));
        }
    }
    if (--range[0] < 0) /* make sure our range never goes negative */
        range[0] = 0;
    if (range[0] != 0)
        nh_delay_output()();
    return TRUE;
    } finally { stack_pop($frame); }
}

/* used by mhurtle_step() for actual hurtling and also to vary message
   if target will/won't change location when knocked back */
export function will_hurtle(mon, x, y) { /* boolean */
    if (!isok(x, y))
        return FALSE;
    /* redundant when called by mhurtle() but needed for mhitm_knockback() */
    if (mon.data.msize >= MZ_HUGE || mon == u.ustuck || mon.mtrapped)
        return FALSE;
    /*
     * TODO: Treat walls, doors, iron bars, etc. specially
     * rather than just stopping before.
     */
    return goodpos(x, y, mon, MM_IGNOREWATER | MM_IGNORELAVA);
}

function mhurtle_step(arg, x, y) { /* boolean */
    let mon = view_of(struct_monst, arg);
    let mtmp;

    if (!isok(x, y))
        return FALSE;

    if (will_hurtle(mon, x, y) && m_in_out_region(mon, x, y)) {
        let res;

        if (mon != u.usteed) {
            remove_monster(mon.mx, mon.my);
            newsym(mon.mx, mon.my);
            place_monster(mon, x, y);
            newsym(mon.mx, mon.my);
        } else {
            /* steed is hurtling, move hero which will also move steed */
            u.ux0 = u.ux, u.uy0 = u.uy;
            u_on_newpos(x, y);
            newsym(u.ux0, u.uy0); /* update old position */
            vision_recalc(0); /* new location => different lines of sight */
        }
        flush_screen(1);
        nh_delay_output()();
        set_apparxy(mon);
        if (is_waterwall(x, y))
            return FALSE;
        res = mintrap(mon, HURTLING);
        if (res == Trap_Killed_Mon
            || res == Trap_Caught_Mon
            || res == Trap_Moved_Mon)
            return FALSE;
        return TRUE;
    }
    if ((mtmp = m_at(x, y)) != null && mtmp != mon) {
        if (canseemon(mon) || canseemon(mtmp))
            pline(_("%s bumps into %s."), Monnam(mon), a_monnam(mtmp));
        wakeup(mtmp, +!svc.context.mon_moving);
        /* check whether 'mon' is turned to stone by touching 'mtmp' */
        if (touch_petrifies(mtmp.data)
            && !which_armor(mon, W_ARMU | W_ARM | W_ARMC)) {
            minstapetrify(mon, +!svc.context.mon_moving);
            newsym(mon.mx, mon.my);
        }
        /* and whether 'mtmp' is turned to stone by being touched by 'mon' */
        if (touch_petrifies(mon.data)
            && !which_armor(mtmp, W_ARMU | W_ARM | W_ARMC)) {
            minstapetrify(mtmp, +!svc.context.mon_moving);
            newsym(mtmp.mx, mtmp.my);
        }
    } else if (u_at(x, y)) {
        /* a monster has caused 'mon' to hurtle against hero */
        pline(_("%s bumps into you."), Some_Monnam(mon));
        stop_occupation();
        /* check whether 'mon' is turned to stone by touching poly'd hero */
        if (Upolyd() && touch_petrifies(gy.youmonst.data)
            && !which_armor(mon, W_ARMU | W_ARM | W_ARMC)) {
            /* give poly'd hero credit/blame despite a monster causing it */
            minstapetrify(mon, TRUE);
            newsym(mon.mx, mon.my);
        }
        /* and whether hero is turned to stone by being touched by 'mon' */
        if (touch_petrifies(mon.data) && !(uarmu || uarm || uarmc)) {
            Snprintf(svk.killer.name, sizeof_member(svk.killer, "name"), _("being hit by %s"), x_monnam(mon, mon.mtame ? ARTICLE_YOUR : ARTICLE_A,
                              _("hurtling"), EXACT_NAME | SUPPRESS_NAME, FALSE))

;
            instapetrify(svk.killer.name);
            newsym(u.ux, u.uy);
        }
    }

    return FALSE;
}

/*
 * The player moves through the air for a few squares as a result of
 * throwing or kicking something.
 *
 * dx and dy should be the direction of the hurtle, not of the original
 * kick or throw.
 */
export function hurtle(dx, dy, range$, verbose) { /* void */
    const $frame = stack_frame(); try {
    const range = stack_var(int, range$);
    let uc = stack_struct(struct_nhcoord), cc = stack_struct(struct_nhcoord);

    /* The chain is stretched vertically, so you shouldn't be able to move
     * very far diagonally.  The premise that you should be able to move one
     * spot leads to calculations that allow you to only move one spot away
     * from the ball, if you are levitating over the ball, or one spot
     * towards the ball, if you are at the end of the chain.  Rather than
     * bother with all of that, assume that there is no slack in the chain
     * for diagonal movement, give the player a message and return.
     */
    if (Punished() && !carried(uball)) {
        You_feel(_("a tug from the iron ball."));
        nomul(0);
        return;
    } else if (u.utrap) {
        You(_("are anchored by the %s."),
            (u.utraptype == TT_WEB) ? _("web")
            : (u.utraptype == TT_LAVA) ? hliquid(_("lava"))
              : (u.utraptype == TT_INFLOOR) ? surface(u.ux, u.uy)
                : (u.utraptype == TT_BURIEDBALL) ? _("buried ball")
                  : _("trap"));
        nomul(0);
        return;
    }

    /* make sure dx and dy are [-1,0,1] */
    dx = sgn(dx);
    dy = sgn(dy);

    if (!range[0] || (!dx && !dy) || u.ustuck)
        return; /* paranoia */

    nomul(-range[0]);
    gm.multi_reason = _("moving through the air");
    gn.nomovemsg = _(""); /* it just happens */
    if (verbose)
        You(_("%s in the opposite direction."),
            (range[0] > 1) ? _("hurtle") : _("float"));
    /* if we're in the midst of shooting multiple projectiles, stop */
    endmultishot(TRUE);
    uc.x = u.ux;
    uc.y = u.uy;
    /* this setting of cc is only correct if dx and dy are [-1,0,1] only */
    cc.x = u.ux + (dx * range[0]);
    cc.y = u.uy + (dy * range[0]);
    walk_path(uc, cc, hurtle_step, addr_of(range));
    } finally { stack_pop($frame); }
}

/* Move a monster through the air for a few squares. */
export function mhurtle(mon, dx, dy, range) { /* void */
    const $frame = stack_frame(); try {
    let mc = stack_struct(struct_nhcoord), cc = stack_struct(struct_nhcoord);

    wakeup(mon, +!svc.context.mon_moving);
    /* At the very least, debilitate the monster */
    mon.movement = 0;
    mon.mstun = 1;

    /* Is the monster stuck or too heavy to push?
     * (very large monsters have too much inertia, even floaters and flyers)
     */
    if (mon.data.msize >= MZ_HUGE || mon == u.ustuck || mon.mtrapped) {
        if (canseemon(mon))
            pline(_("%s doesn't budge!"), Monnam(mon));
        return;
    }

    /* Make sure dx and dy are [-1,0,1] */
    dx = sgn(dx);
    dy = sgn(dy);
    if (!range || (!dx && !dy))
        return; /* paranoia */
    /* don't let grid bugs be hurtled diagonally */
    if (dx && dy && NODIAG(monsndx(mon.data)))
        return;

    /* undetected monster can be moved by your strike */
    if (mon.mundetected) {
        mon.mundetected = 0;
        newsym(mon.mx, mon.my);
    }
    if (M_AP_TYPE(mon))
        seemimic(mon);

    /* Send the monster along the path */
    mc.x = mon.mx;
    mc.y = mon.my;
    cc.x = mon.mx + (dx * range);
    cc.y = mon.my + (dy * range);
    walk_path(mc, cc, mhurtle_step, addr_of(mon));
    if (!DEADMONSTER(mon)) {
        if (t_at(mon.mx, mon.my))
            mintrap(mon, FORCEBUNGLE);
        else
            minliquid(mon);
    }
    return;
    } finally { stack_pop($frame); }
}

function check_shop_obj(obj, x, y, broken) { /* void */
    let costly_xy;
    let shkp = shop_keeper(chars[u.ushops]);

    if (!shkp)
        return;

    costly_xy = costly_spot(x, y);
    if (broken || !costly_xy || chars[in_rooms(x, y, SHOPBASE)] != chars[u.ushops]) {
        /* thrown out of a shop or into a different shop */
        if (is_unpaid(obj))
            stolen_value(obj, u.ux, u.uy, shkp.mpeaceful,
                                FALSE);
        if (broken)
            obj.no_charge = 1;
    } else if (costly_xy) {
        let oshops = in_rooms(x, y, SHOPBASE);

        /* ushops0: in case we threw while levitating and recoiled
           out of shop (most likely to the shk's spot in front of door) */
        if (chars[oshops] == chars[u.ushops] || chars[oshops] == chars[u.ushops0]) {
            if (is_unpaid(obj)) {
                let gtg = Has_contents(obj) ? contained_gold(obj, TRUE) : 0;

                subfrombill(obj, shkp);
                if (gtg > 0)
                    donate_gold(gtg, shkp, TRUE);
            } else if (x != shkp.mx || y != shkp.my) {
                sellobj(obj, x, y);
            }
        }
    }
}

/* Will 'obj' cause damage if it falls on hero's head when thrown upward?
   Not used to handle things which break when they hit.
   Stone missile hitting hero w/ Passes_walls attribute handled separately. */
export function harmless_missile(obj) { /* boolean */
    let otyp = obj.otyp;

    /* this list is fairly arbitrary */
    switch (otyp) {
    case SLING:
    case EUCALYPTUS_LEAF:
    case KELP_FROND:
    case SPRIG_OF_WOLFSBANE:
    case FORTUNE_COOKIE:
    case PANCAKE:
        return TRUE;
    case RUBBER_HOSE:
    case BAG_OF_TRICKS:
        return +(obj.spe < 1);
    case SACK:
    case OILSKIN_SACK:
    case BAG_OF_HOLDING:
        return +!Has_contents(obj);
    default:
        if (obj.oclass == SCROLL_CLASS) /* scrolls but not all paper objs */
            return TRUE;
        if (objects[otyp].oc_material == CLOTH)
            return TRUE;
        break;
    }
    return FALSE;
}

/*
 * Hero tosses an object upwards with appropriate consequences.
 *
 * Returns FALSE if the object is gone.
 */
function toss_up(obj, hitsroof) { /* boolean */
    const $frame = stack_frame(); try {
    let $goto = null; var dmg = stack_var(int);
    var action;
    var otyp = obj.otyp;
    var petrifier = +((otyp == EGG || otyp == CORPSE)
                         && ismnum(obj.corpsenm)
                         && touch_petrifies(mons[obj.corpsenm]));
    /* note: obj->quan == 1 */

    if (!has_ceiling(u.uz)) {
        action = _("flies up into"); /* into "the sky" or "the water above" */
    } else if (hitsroof) {
        if (breaktest(obj)) {
            pline(_("%s hits the %s."), Doname2(obj), ceiling(u.ux, u.uy));
            breakmsg(obj, +!Blind());
            /* crackable armor will return True for breaktest() but will
               usually return False for breakobj() */
            if (!breakobj(obj, u.ux, u.uy, TRUE, TRUE)) {
                hitfloor(obj, FALSE);
                gt.thrownobj = null;
                return TRUE;
            }
            return FALSE;
        }
        action = _("hits");
    } else {
        action = _("almost hits");
    }
    pline(_("%s %s the %s, then falls back on top of your %s."), Doname2(obj),
          action, ceiling(u.ux, u.uy), body_part(HEAD));

    /* object now hits you */

    $goto_petrify: for (;;) { switch ($goto) { default: case "petrify": if (!$goto && (obj.oclass == POTION_CLASS)) {
        potionhit(gy.youmonst, obj, POTHIT_HERO_THROW);
    } else if (!$goto && (breaktest(obj))) {
        var blindinc;

        /* need to check for blindness result prior to destroying obj */
        blindinc = ((otyp == CREAM_PIE || otyp == BLINDING_VENOM)
                    /* AT_WEAP is ok here even if attack type was AT_SPIT */
                    && can_blnd(gy.youmonst, gy.youmonst, AT_WEAP, obj))
                       ? rnd(25)
                       : 0;
        breakmsg(obj, +!Blind());
        if (breakobj(obj, u.ux, u.uy, TRUE, TRUE))
            obj = null; /* it's now gone */

        switch (otyp) {
        case EGG:
            if (petrifier && !Stone_resistance()
                && !(poly_when_stoned(gy.youmonst.data)
                     && polymon(PM_STONE_GOLEM))) {
                /* egg ends up "all over your face"; perhaps
                   visored helmet should still save you here */
                if (uarmh)
                    Your(_("%s fails to protect you."), helm_simple_name(uarmh));
                { $goto = "petrify"; continue $goto_petrify; }
            }
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case CREAM_PIE:
        case BLINDING_VENOM:
            pline(_("You've got it all over your %s!"), body_part(FACE));
            if (blindinc) {
                if (otyp == BLINDING_VENOM && !Blind())
                    pline(_("It blinds you!"));
                u.ucreamed += unsigned(blindinc);
                make_blinded(BlindedTimeout() + blindinc, FALSE);
                if (!Blind())
                    Your1(vision_clears());
            }
            break;
        default:
            break;
        }
        if (!obj)
            return FALSE;
        /* 'obj' still exists, so drop it and return True */
        hitfloor(obj, FALSE);
        gt.thrownobj = null;
    } else if (!$goto && (harmless_missile(obj))) {
        pline(_("It doesn't hurt."));
        hitfloor(obj, FALSE);
        gt.thrownobj = null;
    } else { /* neither potion nor other breaking object */
        switch ($goto) { default: var material = objects[otyp].oc_material;
        var is_silver = +(material == SILVER),
                less_damage = (hard_helmet(uarmh)
                               && (!is_silver || !Hate_silver()) ? 1 : 0),
                harmless = +(stone_missile(obj)
                            && passes_rocks(gy.youmonst.data)),
                artimsg = FALSE;
        dmg[0] = dmgval(obj, gy.youmonst);

        if (obj.oartifact && !harmless)
            /* need a fake die roll here; rn1(18,2) avoids 1 and 20 */
            artimsg = artifact_hit(null, gy.youmonst, obj,
                                   dmg, rn1(18, 2));

        if (!dmg[0]) { /* probably wasn't a weapon; base damage on weight */
            dmg[0] = Math.trunc((int(obj.owt) + (WT_TO_DMG - 1)) / WT_TO_DMG);
            dmg[0] = (dmg[0] <= 1) ? 1 : rnd(dmg[0]);
            if (dmg[0] > 6)
                dmg[0] = 6;
            /* since obj is a non-weapon, bonuses for silver and blessed
               haven't been applied (otherwise '!dmg' test will fail when
               they're applicable here); we don't have to worry about
               dmgval()'s artifact light against gremlin or axe against
               woody creature since both involve weapons; hero-as-shade is
               hypothetical because hero can't polymorph into that form */
            if (gy.youmonst.data == mons[PM_SHADE] && !is_silver)
                dmg[0] = 0;
            if (obj.blessed && mon_hates_blessings(gy.youmonst))
                dmg[0] += rnd(4);
            if (is_silver && Hate_silver())
                dmg[0] += rnd(20);
        }
        if (dmg[0] > 1 && less_damage)
            dmg[0] = 1;
        if (dmg[0] > 0)
            dmg[0] += u.udaminc;
        if (dmg[0] < 0)
            dmg[0] = 0; /* beware negative rings of increase damage */
        dmg[0] = Maybe_Half_Phys(dmg[0]);

        case "petrify": if (!$goto && (uarmh)) {
            /* note: 'harmless' and 'petrifier' are mutually exclusive */
            if ((less_damage && dmg[0] < (Upolyd() ? u.mh : u.uhp)) || harmless) {
                if (!artimsg) {
                    if (!harmless) /* !harmless => less_damage here */
                        pline(_("Fortunately, you are wearing a hard helmet."));
                    else
                        pline(_("Unfortunately, you are wearing %s."),
                              an(helm_simple_name(uarmh))); /* helm or hat */
                }

            /* helmet definitely protects you when it blocks petrification */
            } else if (!petrifier) {
                if (flags.verbose)
                    Your(_("%s does not protect you."), helm_simple_name(uarmh));
            }
            /* stone missile against hero in xorn form would have been
               harmless, but hitting a worn helmet negates that */
            harmless = FALSE;
        } else if ($goto || (petrifier && !Stone_resistance()
                   && !(poly_when_stoned(gy.youmonst.data)
                        && polymon(PM_STONE_GOLEM)))) {
 $goto = null;
            svk.killer.format = KILLED_BY;
            /* what goes up... */
            strcpy(svk.killer.name, _("elementary physics"));
            You(_("turn to stone."));
            if (obj)
                dropy(obj); /* bypass most of hitfloor() */
            gt.thrownobj = null;  /* now either gone or on floor */
            done(STONING);
            return obj ? TRUE : FALSE;
        } }
        if (is_silver && Hate_silver())
            pline_The(_("silver sears you!"));
        if (harmless)
            hit(thesimpleoname(obj), gy.youmonst, _(" but doesn't hurt."));

        hitfloor(obj, TRUE);
        gt.thrownobj = null;
        if (!harmless)
            losehp(dmg[0], _("falling object"), KILLED_BY_AN);
    } } break; }
    return TRUE;
    } finally { stack_pop($frame); }
}

/* return true for weapon meant to be thrown; excludes ammo */
export function throwing_weapon(obj) { /* boolean */
    return (is_missile(obj) || is_spear(obj)
                      /* daggers and knife (excludes scalpel) */
                      || (is_blade(obj) && !is_sword(obj)
                          && (objects[obj.otyp].oc_dir & PIERCE))
                      /* special cases [might want to add AXE] */
                      || obj.otyp == WAR_HAMMER || obj.otyp == AKLYS ? 1 : 0);
}

/* the currently thrown object is returning to you (not for boomerangs) */
function sho_obj_return_to_u(obj) { /* void */
    /* might already be our location (bounced off a wall) */
    if ((u.dx || u.dy) && (gb.bhitpos.x != u.ux || gb.bhitpos.y != u.uy)) {
        let x = gb.bhitpos.x - u.dx, y = gb.bhitpos.y - u.dy;

        tmp_at(DISP_FLASH, obj_to_glyph(obj, rn2_on_display_rng));
        while (isok(x,y) && (x != u.ux || y != u.uy)) {
            tmp_at(x, y);
            nh_delay_output()();
            x -= u.dx;
            y -= u.dy;
        }
        tmp_at(DISP_END, 0);
    }
}

function throwit_return(clear_thrownobj) { /* void */
    iflags.returning_missile = 0;
    if (clear_thrownobj)
        gt.thrownobj = null;
}

function swallowit(obj) { /* void */
    if (obj != uball) {
        mpickobj(u.ustuck, obj); /* clears 'gt.thrownobj' */
        throwit_return(FALSE);
    } else
        throwit_return(TRUE);
}

/* thrown object hits a monster.
   mon may be NULL.
   returns TRUE if shopkeeper caught the object.
   may delete object, clearing gt.thrownobj */
export function throwit_mon_hit(obj, mon) { /* boolean */
    if (mon) {
        let obj_gone;

        if (mon.isshk && obj.where == OBJ_MINVENT && obj.v.v_ocarry == mon) {
            return TRUE;
        }
        snuff_candle(obj);
        gn.notonhead = +(gb.bhitpos.x != mon.mx || gb.bhitpos.y != mon.my);
        obj_gone = thitmonst(mon, obj);
        /* Monster may have been tamed; this frees old mon [obsolete] */
        mon = m_at(gb.bhitpos.x, gb.bhitpos.y);

        /* [perhaps this should be moved into thitmonst or hmon] */
        if (mon && mon.isshk
            && (!inside_shop(u.ux, u.uy)
                || !strchr(in_rooms(mon.mx, mon.my, SHOPBASE), chars[u.ushops])))
            hot_pursuit(mon);

        if (obj_gone)
            gt.thrownobj = null;
    }
    return FALSE;
}

/* throw an object, NB: obj may be consumed in the process */
export function throwit(
    obj$,
    wep_mask,
    twoweap,

    oldslot) { /* void */ /* for thrown-and-return used with !fixinv */
    const $frame = stack_frame(); try {
    const obj = stack_var(ptr_to(struct_obj), obj$);
    let mon;
    let range, urange;
    let arw = autoreturn_weapon(obj[0]);
    let crossbowing,
            impaired = (Confusion() || Stunned() || Blind()
                        || Hallucination() || Fumbling() ? 1 : 0),
            tethered_weapon = (arw && arw.tethered && (wep_mask & W_WEP) != 0 ? 1 : 0);

    gn.notonhead = FALSE; /* reset potentially stale value */
    if ((obj[0].cursed || obj[0].greased) && (u.dx || u.dy) && !rn2(7)) {
        let slipok = TRUE;

        if (ammo_and_launcher(obj[0], uwep)) {
            pline(_("%s!"), Tobjnam(obj[0], _("misfire")));
        } else {
            /* only slip if it's greased or meant to be thrown */
            if (obj[0].greased || throwing_weapon(obj[0]))
                /* BUG: this message is grammatically incorrect if obj has
                   a plural name; greased gloves or boots for instance. */
                pline(_("%s as you throw it!"), Tobjnam(obj[0], _("slip")));
            else
                slipok = FALSE;
        }
        if (slipok) {
            u.dx = rn2(3) - 1;
            u.dy = rn2(3) - 1;
            if (!u.dx && !u.dy)
                u.dz = 1;
            impaired = TRUE;
        }
    }

    if ((u.dx || u.dy || (u.dz < 1))
        && calc_capacity(int((obj[0].owt))) > SLT_ENCUMBER
        && (Upolyd() ? (u.mh < 5 && u.mh != u.mhmax)
                   : (u.uhp < 10 && u.uhp != u.uhpmax))
        && obj[0].owt > unsigned(((Upolyd() ? u.mh : u.uhp) * 2))
        && !Is_airlevel(u.uz)) {
        You(_("have so little stamina, %s drops from your grasp."),
            the(xname(obj[0])));
        exercise(A_CON, FALSE);
        u.dx = u.dy = 0;
        u.dz = 1;
    }

    gt.thrownobj = obj[0];
    gt.thrownobj.how_lost = LOST_THROWN;
    iflags.returning_missile = AutoReturn(obj[0], wep_mask) ? addr_of(obj[0])
                                                         : 0;
    /* NOTE:  No early returns after this point or returning_missile
       will be left with a stale pointer. */

    if (u.uswallow) {
        if (obj[0] == uball) {
            uball.ox = uchain.ox = u.ux;
            uball.oy = uchain.oy = u.uy;
        }
        mon = u.ustuck;
        gb.bhitpos.x = mon.mx;
        gb.bhitpos.y = mon.my;
        if (tethered_weapon)
            tmp_at(DISP_TETHER, obj_to_glyph(obj[0], rn2_on_display_rng));
    } else if (u.dz) {
        if (u.dz < 0
            /* Mjollnir must we wielded to be thrown--caller verifies this;
               aklys must we wielded as primary to return when thrown */
            && iflags.returning_missile
            && !impaired) {
            pline(_("%s the %s and returns to your hand!"), Tobjnam(obj[0], _("hit")),
                  ceiling(u.ux, u.uy));
            obj[0] = return_throw_to_inv(obj[0], wep_mask, twoweap, oldslot);
        } else if (u.dz < 0) {
            toss_up(obj[0], (rn2(5) && !Underwater() ? 1 : 0));
        } else if (u.dz > 0 && u.usteed && obj[0].oclass == POTION_CLASS
                   && rn2(6)) {
            /* alternative to prayer or wand of opening/spell of knock
               for dealing with cursed saddle:  throw holy water > */
            potionhit(u.usteed, obj[0], POTHIT_HERO_THROW);
        } else {
            hitfloor(obj[0], TRUE);
        }
        throwit_return(TRUE);
        return;
    } else if (obj[0].otyp == BOOMERANG && !Underwater()) {
        if (Is_airlevel(u.uz) || Levitation())
            hurtle(-u.dx, -u.dy, 1, TRUE);
        mon = boomhit(obj[0], u.dx, u.dy);
        iflags.returning_missile = 0; /* has returned or isn't going to */
        if (mon == gy.youmonst) { /* the thing was caught */
            exercise(A_DEX, TRUE);
            obj[0] = return_throw_to_inv(obj[0], wep_mask, twoweap, oldslot);
            throwit_return(TRUE);
            return;
        }
    } else {
        /* crossbow range is independent of strength */
        crossbowing = (ammo_and_launcher(obj[0], uwep)
                       && weapon_type(uwep) == P_CROSSBOW ? 1 : 0);
        urange = Math.trunc((crossbowing ? 18 : ACURRSTR()) / 2);
        /* balls are easy to throw or at least roll;
         * also, this insures the maximum range of a ball is greater
         * than 1, so the effects from throwing attached balls are
         * actually possible
         */
        if (obj[0].otyp == HEAVY_IRON_BALL)
            range = urange - int(Math.trunc(obj[0].owt / 100));
        else
            range = urange - int(Math.trunc(obj[0].owt / 40));
        if (obj[0] == uball) {
            if (u.ustuck)
                range = 1;
            else if (range >= 5)
                range = 5;
        }
        if (range < 1)
            range = 1;

        if (is_ammo(obj[0])) {
            if (ammo_and_launcher(obj[0], uwep)) {
                if (crossbowing)
                    range = BOLT_LIM;
                else
                    range++;
            } else if (obj[0].oclass != GEM_CLASS) {
                range = Math.trunc(range / 2);
                pline(_("You aren't wielding %s, so you throw your %s by %s."),
                      an(skill_name(weapon_type(obj[0]))),
                      weapon_descr(obj[0]),
                      body_part(HAND));
            }
        }

        if (Is_airlevel(u.uz) || Levitation()) {
            /* action, reaction... */
            urange -= range;
            if (urange < 1)
                urange = 1;
            range -= urange;
            if (range < 1)
                range = 1;
        }

        if (obj[0].otyp == BOULDER)
            range = 20; /* you must be giant */
        else if (is_art(obj[0], ART_MJOLLNIR))
            range = Math.trunc((range + 1) / 2); /* it's heavy */
        else if (tethered_weapon) /* primary weapon is aklys */
            /* range of a tethered_weapon is limited by the
               length of the attached cord [implicit aspect of item] */
            range = min(range, isqrt(arw.range));
        else if (obj[0] == uball && u.utrap && u.utraptype == TT_INFLOOR)
            range = 1;

        if (Underwater())
            range = 1;

        mon = bhit(u.dx, u.dy, range,
                   tethered_weapon ? THROWN_TETHERED_WEAPON : THROWN_WEAPON,
                   null,
                   null, obj);
        gt.thrownobj = obj[0]; /* obj may be null now */

        /* have to do this after bhit() so u.ux & u.uy are correct */
        if (Is_airlevel(u.uz) || Levitation())
            hurtle(-u.dx, -u.dy, urange, TRUE);

        if (!obj[0]) {
            /* bhit display cleanup was left with this caller
               for tethered_weapon, but clean it up now since
               we're about to return */
            if (tethered_weapon)
                tmp_at(DISP_END, 0);
            throwit_return(FALSE);
            return;
        }
    }

    if (throwit_mon_hit(obj[0], mon)) {
        throwit_return(TRUE); /* alert shk caught it */
        return;
    }

    if (!gt.thrownobj) {
        /* missile has already been handled */
        if (tethered_weapon)
            tmp_at(DISP_END, 0);
    } else if (u.uswallow && !iflags.returning_missile) {
        swallowit(obj[0]);
        return;
    } else {
        /* Mjollnir must be wielded to be thrown--caller verifies this;
           aklys must be wielded as primary to return when thrown */
        if (iflags.returning_missile) { /* Mjollnir or aklys */
            if (rn2(100)) {
                if (tethered_weapon)
                    tmp_at(DISP_END, BACKTRACK);
                else
                    sho_obj_return_to_u(obj[0]); /* display its flight */

                if (!impaired && rn2(100)) {
                    pline(_("%s to your hand!"), Tobjnam(obj[0], _("return")));
                    obj[0] = addinv_before(obj[0], oldslot);
                    encumber_msg();
                    /* addinv autoquivers an aklys if quiver is empty;
                       if obj is quivered, remove it before wielding */
                    if (obj[0].owornmask & W_QUIVER)
                        setuqwep(null);
                    setuwep(obj[0]);
                    set_twoweap(twoweap); /* u.twoweap = twoweap */
                    if (cansee(gb.bhitpos.x, gb.bhitpos.y))
                        newsym(gb.bhitpos.x, gb.bhitpos.y);
                } else {
                    let dmg = stack_var(int, rn2(2));

                    if (!dmg[0]) {
                        pline(Blind() ? _("%s lands %s your %s.")
                                    : _("%s back to you, landing %s your %s."),
                              Blind() ? Something() : Tobjnam(obj[0], _("return")),
                              Levitation() ? _("beneath") : _("at"),
                              makeplural(body_part(FOOT)));
                    } else {
                        dmg[0] += rnd(3);
                        pline(Blind() ? _("%s your %s!")
                                    : _("%s back toward you, hitting your %s!"),
                              Tobjnam(obj[0], Blind() ? _("hit") : _("fly")),
                              body_part(ARM));
                        if (obj[0].oartifact)
                            artifact_hit(null,
                                                gy.youmonst, obj[0], dmg, 0);
                        losehp(Maybe_Half_Phys(dmg[0]), killer_xname(obj[0]),
                               KILLED_BY);
                    }

                    if (u.uswallow) {
                        swallowit(obj[0]);
                        return;
                    }
                    if (!ship_object(obj[0], u.ux, u.uy, FALSE))
                        dropy(obj[0]);
                }
                throwit_return(TRUE);
                return;
            } else {
                if (tethered_weapon)
                    tmp_at(DISP_END, 0);
                /* when this location is stepped on, the weapon will be
                   auto-picked up due to 'obj->how_lost' of LOST_THROWN;
                   addinv() prevents thrown Mjollnir from being placed
                   into the quiver slot, but an aklys will end up there if
                   that slot is empty at the time; since hero will need to
                   explicitly rewield the weapon to get throw-and-return
                   capability back anyway, quivered or not shouldn't matter */
                pline(_("%s to return!"), Tobjnam(obj[0], _("fail")));

                if (u.uswallow) {
                    swallowit(obj[0]);
                    return;
                }
                /* continue below with placing 'obj' at target location */
            }
        }

        if ((!IS_SOFT(levl()[gb.bhitpos.x][gb.bhitpos.y].typ) && breaktest(obj[0]))
            /* venom [via #monster to spit while poly'd] fails breaktest()
               but we want to force breakage even when location IS_SOFT() */
            || obj[0].oclass == VENOM_CLASS) {
            tmp_at(DISP_FLASH, obj_to_glyph(obj[0], rn2_on_display_rng));
            tmp_at(gb.bhitpos.x, gb.bhitpos.y);
            nh_delay_output()();
            tmp_at(DISP_END, 0);
            breakmsg(obj[0], cansee(gb.bhitpos.x, gb.bhitpos.y));
            if (breakobj(obj[0], gb.bhitpos.x, gb.bhitpos.y, TRUE, TRUE)) {
                throwit_return(TRUE);
                return;
            }
        }
        if (!Deaf() && !Underwater()) {
            /* Some sound effects when item lands in water or lava */
            if (is_pool(gb.bhitpos.x, gb.bhitpos.y)
                || (is_lava(gb.bhitpos.x, gb.bhitpos.y)
                    && !is_flammable(obj[0]))) {
                 ;
                pline((weight(obj[0]) > WT_SPLASH_THRESHOLD)
                      ? _("Splash!") : _("Plop!"));
            }
        }
        if (flooreffects(obj[0], gb.bhitpos.x, gb.bhitpos.y, _("fall"))) {
            throwit_return(TRUE);
            return;
        }
        obj_no_longer_held(obj[0]);
        if (mon && mon.isshk && is_pick(obj[0])) {
            if (cansee(gb.bhitpos.x, gb.bhitpos.y))
                pline(_("%s snatches up %s."), Monnam(mon), the(xname(obj[0])));
            if (chars[u.ushops] || obj[0].unpaid)
                check_shop_obj(obj[0], gb.bhitpos.x, gb.bhitpos.y, FALSE);
            mpickobj(mon, obj[0]); /* may merge and free obj */
            throwit_return(TRUE);
            return;
        }
        snuff_candle(obj[0]);
        if (!mon && ship_object(obj[0], gb.bhitpos.x, gb.bhitpos.y, FALSE)) {
            throwit_return(TRUE);
            return;
        }
        gt.thrownobj = null;
        place_object(obj[0], gb.bhitpos.x, gb.bhitpos.y);
        /* container contents might break;
           do so before turning ownership of gt.thrownobj over to shk
           (container_impact_dmg handles item already owned by shop) */
        if (!IS_SOFT(levl()[gb.bhitpos.x][gb.bhitpos.y].typ)) {
            /* <x,y> is spot where you initiated throw, not gb.bhitpos */
            container_impact_dmg(obj[0], u.ux, u.uy);
            impact_disturbs_zombies(obj[0], TRUE);
        }
        /* charge for items thrown out of shop;
           shk takes possession for items thrown into one */
        if ((chars[u.ushops] || obj[0].unpaid) && obj[0] != uball)
            check_shop_obj(obj[0], gb.bhitpos.x, gb.bhitpos.y, FALSE);

        stackobj(obj[0]);
        if (obj[0] == uball)
            drop_ball(gb.bhitpos.x, gb.bhitpos.y);
        if (cansee(gb.bhitpos.x, gb.bhitpos.y))
            newsym(gb.bhitpos.x, gb.bhitpos.y);
        if (obj_sheds_light(obj[0]))
            gv.vision_full_recalc = 1;
    }

    throwit_return(FALSE);
    return;
    } finally { stack_pop($frame); }
}

/* handle a throw-and-return missile coming back into inventory; makes sure
   that if it was wielded, it will be re-wielded; if it was split off of a
   stack (boomerang), don't let it merge with a different compatible stack */
function return_throw_to_inv(
    obj,
    wep_mask,
    twoweap,
    oldslot) { /* struct obj * */ /* following item in invent in case of '!fixinv' */
    let otmp = null;

    /* if 'obj' is from a stack split, we can put it back by undoing split
       so there's no chance of merging with some other compatible stack */
    if (obj.o_id == svc.context.objsplit.parent_oid
        || obj.o_id == svc.context.objsplit.child_oid) {
        obj.nobj = gi.invent;
        gi.invent = obj;
        obj.where = OBJ_INVENT;
        otmp = unsplitobj(obj);
        if (!otmp) {
            gi.invent = obj.nobj;
            obj.nobj = null;
            obj.where = OBJ_FREE;
        } else {
            obj = otmp;
        }
    }

    /* if 'obj' wasn't from a stack split or if it wouldn't merge back
       (maybe new erosion damage?) then it needs to be added to invent;
       don't merge with any other stack even if there is a compatible one
       (others with similar erosion?); can't use addinv_nomerge() here */
    if (!otmp) {
        obj.nomerge = 1; /* redundant unless 'oldslot' somehow went away */
        obj = addinv_before(obj, oldslot);
        obj.nomerge = 0;

        /* in case addinv() autoquivered */
        if ((obj.owornmask & W_QUIVER) != 0
            && (or64(obj.owornmask, wep_mask) & (W_WEP | W_SWAPWEP)) != 0)
            setuqwep(null);

        if ((wep_mask & W_WEP) && !uwep)
            setuwep(obj);
        else if ((wep_mask & W_SWAPWEP) && !uswapwep)
            setuswapwep(obj);
        else if ((wep_mask & W_QUIVER) && !uquiver)
            setuqwep(obj);

        /* in case the throw ended dual-wielding, reinstate it after
           successful catch (not needed for boomerang split/unsplit) */
        if (twoweap && !u.twoweap)
            set_twoweap(TRUE); /* u.twoweap = TRUE */
    }

    encumber_msg();
    return obj;
}

/* an object may hit a monster; various factors adjust chance of hitting */
export function omon_adj(mon, obj, mon_notices) { /* int */
    let tmp = 0;

    /* size of target affects the chance of hitting */
    tmp += (mon.data.msize - MZ_MEDIUM); /* -2..+5 */
    /* sleeping target is more likely to be hit */
    if (mon.msleeping) {
        tmp += 2;
    }
    /* ditto for immobilized target */
    if (!mon.mcanmove || !mon.data.mmove) {
        tmp += 4;
        if (mon_notices && mon.data.mmove && !rn2(10)) {
            mon.mcanmove = 1;
            mon.mfrozen = 0;
        }
    }
    /* some objects are more likely to hit than others */
    switch (obj.otyp) {
    case HEAVY_IRON_BALL:
        if (obj != uball)
            tmp += 2;
        break;
    case BOULDER:
        tmp += 6;
        break;
    default:
        if (obj.oclass == WEAPON_CLASS || is_weptool(obj)
            || obj.oclass == GEM_CLASS)
            tmp += hitval(obj, mon);
        break;
    }
    return tmp;
}

/* thrown object misses target monster */
function tmiss(obj, mon, maybe_wakeup) { /* void */
    let missile = mshot_xname(obj);

    /* If the target can't be seen or doesn't look like a valid target,
       avoid "the arrow misses it," or worse, "the arrows misses the mimic."
       An attentive player will still notice that this is different from
       an arrow just landing short of any target (no message in that case),
       so will realize that there is a valid target here anyway. */
    if (!canseemon(mon) || (M_AP_TYPE(mon) && M_AP_TYPE(mon) != M_AP_MONSTER))
        pline(_("%s %s."), The(missile), otense(obj, _("miss")));
    else
        miss(missile, mon);
    if (maybe_wakeup && !rn2(3))
        wakeup(mon, TRUE);
    return;
}

export function special_obj_hits_leader(obj, mon) { return ((is_quest_artifact(obj) || objects[obj.otyp].oc_unique
      || (obj.otyp == FAKE_AMULET_OF_YENDOR && !obj.known))
     && mon.m_id == svq.quest_status.leader_m_id ? 1 : 0); }

/* whether or not object should be destroyed when it hits its target */
export function should_mulch_missile(obj) { /* boolean */
    let broken;
    let chance;

    /* only ammo (excluding magic stones) or missiles will break */
    if (!obj || !(is_ammo(obj) || is_missile(obj))
        || obj.otyp == BOOMERANG
        || objects[obj.otyp].oc_magic)
        return FALSE;

    /* we had been breaking 2/3 of everything unconditionally.  we still don't
       want anything to survive unconditionally, but we need ammo to stay
       around longer on average. */
    chance = 3 + greatest_erosion(obj) - obj.spe;
    broken = chance > 1 ? rn2(chance) : +!rn2(4);
    if (obj.blessed && (svc.context.mon_moving ? !rn2(3) : !rnl(4)))
        broken = FALSE;

    /* Flint and hard gems don't break easily */
    if (((obj.oclass == GEM_CLASS && objects[obj.otyp].oc_tough)
         || obj.otyp == FLINT)
        && !rn2(2))
        broken = FALSE;

    return broken;
}

/*
 * Object thrown by player arrives at monster's location.
 * Return 1 if obj has disappeared or otherwise been taken care of,
 * 0 if caller must take care of it.
 * Also used for kicked objects and for polearms/grapnel applied at range.
 */
export function thitmonst(
    mon,
    obj) { /* int */ /* gt.thrownobj or gk.kickedobj or uwep */
    const $frame = stack_frame(); try {
    let tmp;     /* Base chance to hit */
    let disttmp; /* distance modifier */
    let otyp = obj.otyp, hmode;
    let guaranteed_hit = engulfing_u(mon);
    let dieroll;

    hmode = (obj == uwep) ? HMON_APPLIED
              : (obj == gk.kickedobj) ? HMON_KICKED
                : HMON_THROWN;

    /* Differences from melee weapons:
     *
     * Dex still gives a bonus, but strength does not.
     * Polymorphed players lacking attacks may still throw.
     * There's a base -1 to hit.
     * No bonuses for fleeing or stunned targets (they don't dodge
     *    melee blows as readily, but dodging arrows is hard anyway).
     * Not affected by traps, etc.
     * Certain items which don't in themselves do damage ignore 'tmp'.
     * Distance and monster size affect chance to hit.
     */
    tmp = -1 + Luck() + find_mac(mon) + u.uhitinc
          + (Upolyd() ? (gy.youmonst.data.mlevel) : (u.ulevel));
    if (ACURR(A_DEX) < 4)
        tmp -= 3;
    else if (ACURR(A_DEX) < 6)
        tmp -= 2;
    else if (ACURR(A_DEX) < 8)
        tmp -= 1;
    else if (ACURR(A_DEX) >= 14)
        tmp += (ACURR(A_DEX) - 14);

    /* Modify to-hit depending on distance; but keep it sane.
     * Polearms get a distance penalty even when wielded; it's
     * hard to hit at a distance.
     */
    disttmp = 3 - distmin(u.ux, u.uy, mon.mx, mon.my);
    if (disttmp < -4)
        disttmp = -4;
    tmp += disttmp;

    /* gloves are a hindrance to proper use of bows */
    if (uarmg && uwep && objects[uwep.otyp].oc_subtyp == P_BOW) {
        switch (uarmg.otyp) {
        case GAUNTLETS_OF_POWER: /* metal */
            tmp -= 2;
            break;
        case GAUNTLETS_OF_FUMBLING:
            tmp -= 3;
            break;
        case LEATHER_GLOVES:
        case GAUNTLETS_OF_DEXTERITY:
            break;
        default:
            impossible(_("Unknown type of gloves (%d)"), uarmg.otyp);
            break;
        }
    }

    tmp += omon_adj(mon, obj, TRUE);
    if (is_orc(mon.data)
        && (Upolyd() ? (is_elf(gy.youmonst.data)) : (Race_if(PM_ELF))))
        tmp++;
    if (guaranteed_hit) {
        tmp += 1000; /* Guaranteed hit */
    }

    /* throwing real gems to co-aligned unicorns boosts Luck,
       to cross-aligned unicorns changes Luck by random amount;
       throwing worthless glass doesn't affect Luck but doesn't anger them;
       5.0: treat rocks and gray stones as attacks rather than like glass
       and also treat gems or glass shot via sling as attacks */
    if (obj.oclass == GEM_CLASS && is_unicorn(mon.data)
        && objects[obj.otyp].oc_material != MINERAL && !uslinging()) {
        if (helpless(mon)) {
            tmiss(obj, mon, FALSE);
            return 0;
        } else if (mon.mtame) {
            pline(_("%s catches and drops %s."), Monnam(mon), the(xname(obj)));
            return 0;
        } else {
            pline(_("%s catches %s."), Monnam(mon), the(xname(obj)));
            return gem_accept(mon, obj);
        }
    }

    /* don't make game unwinnable if naive player throws artifact
       at leader... (kicked artifact is ok too; HMON_APPLIED could
       occur if quest artifact polearm or grapnel ever gets added) */
    if (hmode != HMON_APPLIED && special_obj_hits_leader(obj, mon)) {
        /* AIS: changes to wakeup() means that it's now less inappropriate
           here than it used to be, but manual version works just as well */
        mon.msleeping = 0;
        mon.mstrategy = and64u(mon.mstrategy, ~STRAT_WAITMASK);

        if (mon.mcanmove) {
            pline(_("%s catches %s."), Some_Monnam(mon), the(xname(obj)));
            /* leader will keep tossed invocation item after you've done the
               invocation and it's become unnecessary for completion.. */
            if ((u.uevent.invoked && objects[obj.otyp].oc_unique
                 && obj.otyp != AMULET_OF_YENDOR)
                /* ...or any special item, if you've made him angry */
                || !mon.mpeaceful) {
                /* give an explanation for keeping the item only if leader is
                   not doing it out of anger */
                if (mon.mpeaceful && !Deaf()) {
                    /* just in case, identify the object so its name will
                       appear in the message */
                    fully_identify_obj(obj);
                    verbalize(_("%s part in this is finished."),
                              s_suffix(The(xname(obj))));
                    verbalize(
               _("We will guard it in case it is ever needed again, %s forbid."),
                              align_gname(chars[u.ualignbase + A_ORIGINAL]));
                }
                if (chars[u.ushops] || obj.unpaid) /* not very likely... */
                    check_shop_obj(obj, mon.mx, mon.my, FALSE);
                mpickobj(mon, obj);
            } else {
                /* under normal circumstances, leader will say something and
                   then return the item to the hero */
                let next2u = monnear(mon, u.ux, u.uy);

                finish_quest(obj); /* acknowledge quest completion */
                pline(_("%s %s %s back to you."), Some_Monnam(mon),
                      (next2u ? _("hands") : _("tosses")), the(xname(obj)));
                if (!next2u)
                    sho_obj_return_to_u(obj);
                obj = addinv(obj); /* back into your inventory */
                (obj);
                encumber_msg();
            }
            return 1; /* caller doesn't need to place it */
        }
        return 0;
    }

    dieroll = rnd(20);

    if (obj.oclass == WEAPON_CLASS || is_weptool(obj)
        || obj.oclass == GEM_CLASS) {
        if (hmode == HMON_KICKED) {
            /* throwing adjustments and weapon skill bonus don't apply */
            tmp -= (is_ammo(obj) ? 5 : 3);
        } else if (is_ammo(obj)) {
            if (!ammo_and_launcher(obj, uwep)) {
                tmp -= 4;
            } else {
                tmp += uwep.spe - greatest_erosion(uwep);
                tmp += weapon_hit_bonus(uwep);
                if (uwep.oartifact)
                    tmp += spec_abon(uwep, mon);
                /*
                 * Elves and Samurais are highly trained w/bows,
                 * especially their own special types of bow.
                 * Polymorphing won't make you a bow expert.
                 */
                if ((Race_if(PM_ELF) || Role_if(PM_SAMURAI))
                    && (!Upolyd() || your_race(gy.youmonst.data))
                    && objects[uwep.otyp].oc_subtyp == P_BOW) {
                    ++tmp;
                    if ((Race_if(PM_ELF) && uwep.otyp == ELVEN_BOW)
                        || (Role_if(PM_SAMURAI) && uwep.otyp == YUMI))
                        ++tmp;
                }
            }
        } else { /* thrown non-ammo or applied polearm/grapnel */
            if (otyp == BOOMERANG) /* arbitrary */
                tmp += 4;
            else if (throwing_weapon(obj)) /* meant to be thrown */
                tmp += 2;
            else if (obj == gt.thrownobj) /* not meant to be thrown */
                tmp -= 2;
            /* we know we're dealing with a weapon or weptool handled
               by WEAPON_SKILLS once ammo objects have been excluded */
            tmp += weapon_hit_bonus(obj);
        }

        if (tmp >= dieroll) {
            let wasthrown = +(gt.thrownobj != null),

                    chopper = is_axe(obj);

            /* attack hits mon */
            if (hmode == HMON_APPLIED) { /* ranged hit with wielded polearm */
                /* hmon()'s caller is expected to do this; however, hmon()
                   delivers the "hit with wielded weapon for first time"
                   gamelog message when applicable */
                u.uconduct.weaphit++;
            }
            if (hmon(mon, obj, hmode, dieroll)) { /* mon still alive */
                if (mon.wormno)
                    cutworm(mon, gb.bhitpos.x, gb.bhitpos.y, chopper);
            }
            exercise(A_DEX, TRUE);
            /* if hero was swallowed and projectile killed the engulfer,
               'obj' got added to engulfer's inventory and then dropped,
               so we can't safely use that pointer anymore; it escapes
               the chance to be used up here... */
            if (wasthrown && !gt.thrownobj)
                return 1;

            /* projectiles other than magic stones sometimes disappear
               when thrown; projectiles aren't among the types of weapon
               that hmon() might have destroyed so obj is intact */
            if (should_mulch_missile(obj)) {
                if (chars[u.ushops] || obj.unpaid)
                    check_shop_obj(obj, gb.bhitpos.x, gb.bhitpos.y, TRUE);
                obfree(obj, null);
                return 1;
            }
            passive_obj(mon, obj, null);
        } else {
            tmiss(obj, mon, TRUE);
            if (hmode == HMON_APPLIED)
                wakeup(mon, TRUE);
        }
    } else if (otyp == HEAVY_IRON_BALL) {
        exercise(A_STR, TRUE);
        if (tmp >= dieroll) {
            let was_swallowed = guaranteed_hit;

            exercise(A_DEX, TRUE);
            if (!hmon(mon, obj, hmode, dieroll)) { /* mon killed */
                if (was_swallowed && !u.uswallow && obj == uball)
                    return 1; /* already did placebc() */
            }
        } else {
            tmiss(obj, mon, TRUE);
        }
    } else if (otyp == BOULDER) {
        exercise(A_STR, TRUE);
        if (tmp >= dieroll) {
            exercise(A_DEX, TRUE);
            hmon(mon, obj, hmode, dieroll);
        } else {
            tmiss(obj, mon, TRUE);
        }
    } else if ((otyp == EGG || otyp == CREAM_PIE || otyp == BLINDING_VENOM
                || otyp == ACID_VENOM)
               && (guaranteed_hit || ACURR(A_DEX) > rnd(25))) {
        hmon(mon, obj, hmode, dieroll);
        return 1; /* hmon used it up */
    } else if (obj.oclass == POTION_CLASS
               && (guaranteed_hit || ACURR(A_DEX) > rnd(25))) {
        potionhit(mon, obj, POTHIT_HERO_THROW);
        return 1;
    } else if (befriend_with_obj(mon.data, obj)
               || (mon.mtame && dogfood(mon, obj) <= ACCFOOD)) {
        if (tamedog(mon, obj, TRUE)) {
            return 1; /* obj is gone */
        } else {
            tmiss(obj, mon, FALSE);
            mon.msleeping = 0;
            mon.mstrategy = and64u(mon.mstrategy, ~STRAT_WAITMASK);
        }
    } else if (guaranteed_hit) {
        let trail = stack_array(char, BUFSZ);
        let monname;
        let md = u.ustuck.data;

        /* this assumes that guaranteed_hit is due to swallowing */
        wakeup(mon, TRUE);
        if (obj.otyp == CORPSE && touch_petrifies(mons[obj.corpsenm])) {
            if (is_animal(md)) {
                minstapetrify(u.ustuck, TRUE);
                /* Don't leave a cockatrice corpse available in a statue */
                if (!u.uswallow) {
                    delobj(obj);
                    return 1;
                }
            }
        }
        strcpy(trail, digests(md) ? _(" entrails") : is_whirly(md) ? _(" currents") : _(""))
;
        monname = mon_nam(mon);
        if (chars[trail])
            monname = s_suffix(monname);
        pline(_("%s into %s%s."), Tobjnam(obj, _("vanish")), monname, trail);
    } else {
        tmiss(obj, mon, TRUE);
    }

    return 0;
    } finally { stack_pop($frame); }
}

function gem_accept(mon, obj) { /* int */
    const $frame = stack_frame(); try {
    var nogood = init_string(static_array("gem_accept.nogood", char, sizeof_string(" is not interested in your junk.")), _(" is not interested in your junk."), true),
        acceptgift = init_string(static_array("gem_accept.acceptgift", char, sizeof_string(" accepts your gift.")), _(" accepts your gift."), true),
        maybeluck = init_string(static_array("gem_accept.maybeluck", char, sizeof_string(" hesitatingly")), _(" hesitatingly"), true),
        noluck = init_string(static_array("gem_accept.noluck", char, sizeof_string(" graciously")), _(" graciously"), true),
        addluck = init_string(static_array("gem_accept.addluck", char, sizeof_string(" gratefully")), _(" gratefully"), true);

    var buf = stack_array(char, BUFSZ);
    var is_buddy = +(sgn(mon.data.maligntyp) == sgn(u.ualign.type));
    var is_gem = +(objects[obj.otyp].oc_material == GEMSTONE);
    var ret = 0;

    strcpy(buf, Monnam(mon));
    mon.mpeaceful = 1;
    mon.mavenge = 0;

    /* object properly identified */
    nopick: { if (obj.dknown && objects[obj.otyp].oc_name_known) {
        if (is_gem) {
            if (is_buddy) {
                strcat(buf, addluck);
                change_luck(5);
            } else {
                strcat(buf, maybeluck);
                change_luck(rn2(7) - 3);
            }
        } else {
            strcat(buf, nogood);
            break nopick;
        }

    /* making guesses */
    } else if (has_oname(obj) || objects[obj.otyp].oc_uname) {
        if (is_gem) {
            if (is_buddy) {
                strcat(buf, addluck);
                change_luck(2);
            } else {
                strcat(buf, maybeluck);
                change_luck(rn2(3) - 1);
            }
        } else {
            strcat(buf, nogood);
            break nopick;
        }

    /* value completely unknown to @ */
    } else {
        if (is_gem) {
            if (is_buddy) {
                strcat(buf, addluck);
                change_luck(1);
            } else {
                strcat(buf, maybeluck);
                change_luck(rn2(3) - 1);
            }
        } else {
            strcat(buf, noluck);
        }
    }
    strcat(buf, acceptgift);
    if (chars[u.ushops] || obj.unpaid)
        check_shop_obj(obj, mon.mx, mon.my, TRUE);
    mpickobj(mon, obj); /* may merge and free obj */
    ret = 1;
 }
    if (!Blind())
        pline1(buf);
    if (!tele_restrict(mon))
        rloc(mon, RLOC_MSG);
    return ret;
    } finally { stack_pop($frame); }
}

/*
 * Comments about the restructuring of the old breaks() routine.
 *
 * There are now three distinct phases to object breaking:
 *     breaktest() - which makes the check/decision about whether the
 *                   object is going to break.
 *     breakmsg()  - which outputs a message about the breakage,
 *                   appropriate for that particular object. Should
 *                   only be called after a positive breaktest().
 *                   on the object and, if it going to be called,
 *                   it must be called before calling breakobj().
 *                   Calling breakmsg() is optional.
 *     breakobj()  - which actually does the breakage and the side-effects
 *                   of breaking that particular object. This should
 *                   only be called after a positive breaktest() on the
 *                   object.
 *
 * Each of the above routines is currently static to this source module.
 * There are two routines callable from outside this source module which
 * perform the routines above in the correct sequence.
 *
 *   hero_breaks() - called when an object is to be broken as a result
 *                   of something that the hero has done. (throwing it,
 *                   kicking it, etc.)
 *   breaks()      - called when an object is to be broken for some
 *                   reason other than the hero doing something to it.
 */

/*
 * The hero causes breakage of an object (throwing, dropping it, etc.)
 * Return 0 if the object didn't break, 1 if the object broke.
 */
export function hero_breaks(
    obj,
    x, y,
    breakflags) { /* int */
    /* from_invent: thrown or dropped by player; maybe on shop bill;
       by-hero is implicit so callers don't need to specify BRK_BY_HERO */
    let from_invent = +((breakflags & BRK_FROM_INV) != 0),
            in_view = Blind() ? FALSE : (from_invent || cansee(x, y) ? 1 : 0);
    let brk = (breakflags & BRK_KNOWN_OUTCOME);

    /* only call breaktest if caller hasn't already specified the outcome */
    if (!brk)
        brk = breaktest(obj) ? BRK_KNOWN2BREAK : BRK_KNOWN2NOTBREAK;
    if (brk == BRK_KNOWN2NOTBREAK)
        return 0;

    breakmsg(obj, in_view);
    return breakobj(obj, x, y, TRUE, from_invent);
}

/*
 * The object is going to break for a reason other than the hero doing
 * something to it.
 * Return 0 if the object doesn't break, 1 if the object broke.
 */
export function breaks(
    obj,
    x, y) { /* int */ /* object location (ox, oy may not be right) */
    let in_view = Blind() ? FALSE : cansee(x, y);

    if (!breaktest(obj))
        return 0;
    breakmsg(obj, in_view);
    return breakobj(obj, x, y, FALSE, FALSE);
}

export function release_camera_demon(obj, x, y) { /* void */
    let mtmp;
    if (!rn2(3)
        && (mtmp = makemon(mons[rn2(3) ? PM_HOMUNCULUS : PM_IMP], x, y,
                           MM_NOMSG)) != null) {
        if (canspotmon(mtmp))
            pline(_("%s is released!"), Hallucination()
                                         ? An(rndmonnam(0))
                                         : _("The picture-painting demon"));
        mtmp.mpeaceful = +!obj.cursed;
        set_malign(mtmp);
    }
}

/*
 * Break an object.  Breakable armor goes through erosion steps; other
 * items break unconditionally.  Assumes all resistance checks
 * and break messages have been delivered prior to getting here.
 * (No longer true; breakmsg() is silent for crackable armor and we
 * call erode_obj() for it and that delivers a damaged-the-item message.)
 */
export function breakobj(
    obj,
    x, y,
    hero_caused,
    from_invent) { /* int */
    let fracture = FALSE;
    let explosion = FALSE;

    if (is_crackable(obj)) /* if erodeproof, erode_obj() will say so */
        return +(erode_obj(obj, armor_simple_name(obj), ERODE_CRACK,
                          EF_DESTROY | EF_VERBOSE) == ER_DESTROYED);

    switch (obj.oclass == POTION_CLASS ? POT_WATER : obj.otyp) {
    case MIRROR:
        if (hero_caused)
            change_luck(-2);
        break;
    case POT_WATER:      /* really, all potions */
        obj.in_use = 1; /* in case it's fatal */
        if (obj.otyp == POT_OIL && obj.lamplit) {
            explode_oil(obj, x, y);
        } else if (next2u(x, y)) {
            if (!breathless(gy.youmonst.data) || haseyes(gy.youmonst.data)) {
                /* wet towel protects both eyes and breathing */
                if (obj.otyp != POT_WATER && !Half_gas_damage()) {
                    if (!breathless(gy.youmonst.data)) {
                        /* [what about "familiar odor" when known?] */
                        You(_("smell a peculiar odor..."));
                    } else {
                        let eyes = body_part(EYE);

                        if (eyecount(gy.youmonst.data) != 1)
                            eyes = makeplural(eyes);
                        Your(_("%s %s."), eyes, vtense(eyes, _("water")));
                    }
                }
                potionbreathe(obj);
            }
        }
        /* monster breathing isn't handled... [yet?] */
        break;
    case EXPENSIVE_CAMERA:
        release_camera_demon(obj, x, y);
        break;
    case EGG:
        /* breaking your own eggs is bad luck */
        if (hero_caused && obj.spe && ismnum(obj.corpsenm))
            change_luck(schar((-min(obj.quan, 5))));
        if (obj.corpsenm == PM_PYROLISK)
            explosion = TRUE;
        break;
    case BOULDER:
    case STATUE:
        /* caller will handle object disposition;
           we're just doing the shop theft handling */
        fracture = TRUE;
        break;
    default:
        break;
    }

    if (hero_caused) {
        if (from_invent || obj.unpaid) {
            if (chars[u.ushops] || obj.unpaid)
                check_shop_obj(obj, x, y, TRUE);
        } else if (!obj.no_charge && costly_spot(x, y)) {
            /* it is assumed that the obj is a floor-object */
            let o_shop = in_rooms(x, y, SHOPBASE);
            let shkp = shop_keeper(chars[o_shop]);

            if (shkp) { /* (implies *o_shop != '\0') */
                let eshkp = ESHK(shkp);

                /* base shk actions on her peacefulness at start of
                   this turn, so that "simultaneous" multiple breakage
                   isn't drastically worse than single breakage */
                if (gh.hero_seq != eshkp.break_seq)
                    eshkp.seq_peaceful = shkp.mpeaceful;
                if ((stolen_value(obj, x, y, eshkp.seq_peaceful, FALSE) > 0)
                    && (chars[o_shop] != chars[u.ushops + 0] || !inside_shop(u.ux, u.uy))
                    && gh.hero_seq != eshkp.break_seq)
                    make_angry_shk(shkp, x, y);
                /* make_angry_shk() is only called on the first instance
                   of breakage during any particular hero move */
                eshkp.break_seq = gh.hero_seq;
            }
        }
    }
    if (!fracture)
        delobj(obj);
    if (explosion)
        explode(x, y, -11, d(3, 6), 0, EXPL_FIERY);
    return 1;
}

/*
 * Check to see if obj (which has just hit hard something at speed, e.g.
 * thrown or dropped from height) is going to break, but don't actually
 * break it. Return 0 if the object isn't going to break, 1 if it is.
 */
export function breaktest(obj) { /* boolean */
    let nonbreakchance = 1; /* chance for non-artifacts to resist */

    /* this may need to be changed if actual glass armor gets added someday;
       for now, it affects crystal plate mail and helm of brilliance;
       either of them will have to be cracked 4 times before breaking */
    if (obj.oclass == ARMOR_CLASS && objects[obj.otyp].oc_material == GLASS)
        nonbreakchance = 90;

    if (obj_resists(obj, nonbreakchance, 99))
        return FALSE;
    if (objects[obj.otyp].oc_material == GLASS && !obj.oartifact
        && obj.oclass != GEM_CLASS)
        return TRUE;
    switch (obj.oclass == POTION_CLASS ? POT_WATER : obj.otyp) {
    case EXPENSIVE_CAMERA:
    case POT_WATER: /* really, all potions */
    case EGG:
    case CREAM_PIE:
    case MELON:
    case ACID_VENOM:
    case BLINDING_VENOM:
        return TRUE;
    default:
        return FALSE;
    }
}

function breakmsg(obj, in_view) { /* void */
    let to_pieces;

    if (is_crackable(obj)) /* breakobj() will call erode_obj() for message */
        return;

    to_pieces = _("");
    switch (obj.oclass == POTION_CLASS ? POT_WATER : obj.otyp) {
    default: /* glass or crystal wand */
        if (obj.oclass != WAND_CLASS)
            impossible(_("breaking odd object (%d)?"), obj.otyp);
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case LENSES:
    case MIRROR:
    case CRYSTAL_BALL:
    case EXPENSIVE_CAMERA:
        to_pieces = _(" into a thousand pieces");
        /* FALLTHROUGH */;
    /*FALLTHRU*/
    case POT_WATER: /* really, all potions */
        if (!in_view)
            You_hear(_("%s shatter!"), something());
        else
            pline(_("%s shatter%s%s!"), Doname2(obj),
                  (obj.quan == 1) ? _("s") : _(""), to_pieces);
        break;
    case EGG:
    case MELON:
        pline(_("Splat!"));
        break;
    case CREAM_PIE:
        if (in_view)
            pline(_("What a mess!"));
        break;
    case ACID_VENOM:
    case BLINDING_VENOM:
        pline(_("Splash!"));
        break;
    }
}

function throw_gold(obj$) { /* int */
    const $frame = stack_frame(); try {
    const obj = stack_var(ptr_to(struct_obj), obj$);
    let range, odx, ody;
    let mon;

    if (!u.dx && !u.dy && !u.dz) {
        You(_("cannot throw gold at yourself."));
        /* If we tried to throw part of a stack, force it to merge back
           together (same as in throw_obj).  Essential for gold. */
        if (obj[0].o_id == svc.context.objsplit.parent_oid
            || obj[0].o_id == svc.context.objsplit.child_oid)
            unsplitobj(obj[0]);
        return ECMD_CANCEL;
    }
    freeinv(obj[0]);
    if (u.uswallow) {
        let swallower = mon_nam(u.ustuck);

        if (digests(u.ustuck.data))
            /* note: s_suffix() returns a modifiable buffer */
            swallower = strcat(s_suffix(swallower), _(" entrails"));
        pline_The(_("gold disappears into %s."), swallower);
        add_to_minv(u.ustuck, obj[0]);
        return ECMD_TIME;
    }

    if (u.dz) {
        if (u.dz < 0 && !Is_airlevel(u.uz) && !Underwater()
            && !Is_waterlevel(u.uz)) {
            pline_The(_("gold hits the %s, then falls back on top of your %s."),
                      ceiling(u.ux, u.uy), body_part(HEAD));
            /* some self damage? */
            if (uarmh)
                pline(_("Fortunately, you are wearing %s!"),
                      an(helm_simple_name(uarmh)));
        }
        gb.bhitpos.x = u.ux;
        gb.bhitpos.y = u.uy;
    } else {
        /* consistent with range for normal objects */
        range = int(unsigned(unsigned(Math.trunc(ACURRSTR() / 2)) - Math.trunc(obj[0].owt / 40)));

        /* see if the gold has a place to move into */
        odx = u.ux + u.dx;
        ody = u.uy + u.dy;
        if (!isok(odx, ody)
            || !ZAP_POS(levl()[odx][ody].typ) || closed_door(odx, ody)) {
            gb.bhitpos.x = u.ux;
            gb.bhitpos.y = u.uy;
        } else {
            mon = bhit(u.dx, u.dy, range, THROWN_WEAPON,
                       null,
                       null, obj);
            if (!obj[0])
                return ECMD_TIME; /* object is gone */
            if (mon) {
                if (ghitm(mon, obj[0])) /* was it caught? */
                    return ECMD_TIME;
            } else {
                if (ship_object(obj[0], gb.bhitpos.x, gb.bhitpos.y, FALSE))
                    return ECMD_TIME;
            }
        }
    }

    if (flooreffects(obj[0], gb.bhitpos.x, gb.bhitpos.y, _("fall")))
        return ECMD_TIME;
    if (u.dz > 0)
        pline_The(_("gold hits the %s."), surface(gb.bhitpos.x, gb.bhitpos.y));
    place_object(obj[0], gb.bhitpos.x, gb.bhitpos.y);
    if (chars[u.ushops])
        sellobj(obj[0], gb.bhitpos.x, gb.bhitpos.y);
    stackobj(obj[0]);
    newsym(gb.bhitpos.x, gb.bhitpos.y);
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

/*dothrow.c*/

import { ART_MJOLLNIR } from "./artilist.h.js";
import { A_CON, A_DEX, A_STR } from "./attrib.h.js";
import { ACURR, ACURRSTR, STR19 } from "./attrib.h.macros.js";
import { struct_obj_split } from "./context.h.js";
import { struct_nhcoord } from "./coord.h.js";
import { Something, something, vision_clears } from "./decl.h.macros.js";
import {
    ARMOR_CLASS, COIN_CLASS, GEM_CLASS, POTION_CLASS, SCROLL_CLASS, VENOM_CLASS, WAND_CLASS,
    WEAPON_CLASS,
} from "./defsym.h.js";
import { BACKTRACK, DISP_END, DISP_FLASH, DISP_TETHER, EXPL_FIERY } from "./display.h.js";
import {
    canspotmon, glyph_is_invisible, glyph_is_monster, obj_to_glyph,
} from "./display.h.macros.js";
import { Is_airlevel, Is_waterlevel } from "./dungeon.h.macros.js";
import { BUFSZ, FALSE, LARGEST_INT, TRUE, boolean, coordxy } from "./global.h.js";
import {
    ARM, ARTICLE_A, ARTICLE_YOUR, AUGMENT_IT, BOLT_LIM, BRK_FROM_INV, BRK_KNOWN2BREAK,
    BRK_KNOWN2NOTBREAK, BRK_KNOWN_OUTCOME, CQ_CANNED, CXN_PFX_THE, ECMD_CANCEL, ECMD_OK, ECMD_TIME,
    EXACT_NAME, EYE, FACE, FOOT, FORCEBUNGLE, GETOBJ_ALLOWCNT, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE,
    GETOBJ_PROMPT, GETOBJ_SUGGEST, HAND, HEAD, HMON_APPLIED, HMON_KICKED, HMON_THROWN, HURTLING,
    KILLED_BY, KILLED_BY_AN, MM_IGNORELAVA, MM_IGNOREWATER, MM_NOMSG, NO_TRAP_FLAGS, RLOC_MSG,
    SLT_ENCUMBER, STONING, SUPPRESS_NAME, SUPPRESS_SADDLE, THROWN_TETHERED_WEAPON, THROWN_WEAPON,
} from "./hack.h.js";
import {
    LIMIT_TO_RANGE_INT, Maybe_Half_Phys, NODIAG, Your1, min, pline1, rn1,
} from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { ACCFOOD } from "./mextra.h.js";
import { ESHK, has_mgivenname } from "./mextra.h.macros.js";
import { SHOPBASE } from "./mkroom.h.js";
import { AT_WEAP } from "./monattk.h.js";
import {
    befriend_with_obj, bigmonst, breathless, digests, eyecount, haseyes, is_animal, is_elf, is_orc,
    is_unicorn, is_whirly, monsndx, nohands, notake, passes_rocks, throws_rocks, touch_petrifies,
    your_race,
} from "./mondata.h.macros.js";
import { MZ_HUGE, MZ_MEDIUM, NEUTRAL } from "./monflag.h.js";
import { M_AP_MONSTER, STRAT_WAITMASK, struct_monst } from "./monst.h.js";
import { DEADMONSTER, M_AP_TYPE, engulfing_u, helpless, ismnum } from "./monst.h.macros.js";
import {
    PM_CAVE_DWELLER, PM_CLERIC, PM_DWARF, PM_ELF, PM_GNOME, PM_HEALER, PM_HOMUNCULUS, PM_HUMAN,
    PM_IMP, PM_MONK, PM_NINJA, PM_ORC, PM_PYROLISK, PM_RANGER, PM_ROGUE, PM_SAMURAI, PM_SHADE,
    PM_STONE_GOLEM, PM_TOURIST, PM_VALKYRIE, PM_WIZARD,
} from "./monsters.h.js";
import {
    EF_DESTROY, EF_VERBOSE, ERODE_CRACK, ER_DESTROYED, LOST_THROWN, OBJ_FREE, OBJ_INVENT,
    OBJ_MINVENT, POTHIT_HERO_THROW, struct_obj,
} from "./obj.h.js";
import {
    Has_contents, ammo_and_launcher, carried, greatest_erosion, has_oname, is_ammo, is_axe,
    is_blade, is_missile, is_pick, is_pole, is_spear, is_sword, is_weptool, is_wet_towel,
    matching_launcher, stone_missile, uslinging,
} from "./obj.h.macros.js";
import { CLOTH, GEMSTONE, GLASS, MINERAL, PIERCE, SILVER } from "./objclass.h.js";
import { is_crackable } from "./objclass.h.macros.js";
import {
    ACID_VENOM, AKLYS, AMULET_OF_YENDOR, BAG_OF_HOLDING, BAG_OF_TRICKS, BLINDING_VENOM, BOOMERANG,
    BOULDER, BULLWHIP, CORPSE, CREAM_PIE, CRYSTAL_BALL, EGG, ELVEN_ARROW, ELVEN_BOW,
    EUCALYPTUS_LEAF, EXPENSIVE_CAMERA, FAKE_AMULET_OF_YENDOR, FLINT, FORTUNE_COOKIE,
    GAUNTLETS_OF_DEXTERITY, GAUNTLETS_OF_FUMBLING, GAUNTLETS_OF_POWER, HEAVY_IRON_BALL, KELP_FROND,
    LEATHER_GLOVES, LENSES, MELON, MIRROR, OILSKIN_SACK, ORCISH_ARROW, ORCISH_BOW, PANCAKE, POT_OIL,
    POT_WATER, ROCK, RUBBER_HOSE, SACK, SLING, SPRIG_OF_WOLFSBANE, STATUE, STRANGE_OBJECT,
    WAN_STRIKING, WAR_HAMMER, YA, YUMI,
} from "./objects.h.js";
import {
    I_SPECIAL, WWALKING, W_ARM, W_ARMC, W_ARMU, W_QUIVER, W_SWAPWEP, W_WEP,
} from "./prop.h.js";
import { D_ISOPEN, IRONBARS } from "./rm.h.js";
import {
    IS_ALTAR, IS_DOOR, IS_OBSTRUCTED, IS_SOFT, IS_TREE, Sokoban, ZAP_POS, levl, m_at,
    remove_monster,
} from "./rm.h.macros.js";
import {
    P_BOW, P_CROSSBOW, P_DAGGER, P_DART, P_EXPERT, P_KNIFE, P_SHURIKEN, P_SKILLED, P_SLING, P_SPEAR,
} from "./skills.h.js";
import { P_SKILL } from "./skills.h.macros.js";
import {
    FIRE_TRAP, HOLE, MAGIC_PORTAL, PIT, SPIKED_PIT, TRAPDOOR, Trap_Caught_Mon, Trap_Killed_Mon,
    Trap_Moved_Mon, VIBRATING_SQUARE,
} from "./trap.h.js";
import { is_hole, is_pit } from "./trap.h.macros.js";
import { cansee } from "./vision.h.macros.js";
import { WT_SPLASH_THRESHOLD, WT_TOOMUCH_DIAGONAL, WT_TO_DMG } from "./weight.h.js";
import { nh_delay_output } from "./winprocs.h.macros.js";
import { A_ORIGINAL, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_WEB } from "./you.h.js";
import {
    Luck, Race_if, Race_switch, Role_if, Role_switch, Upolyd, next2u, noit_mhim, u_at,
} from "./you.h.macros.js";
import {
    Blind, BlindedTimeout, Confusion, Deaf, EWwalking, Flying, Fumbling, Half_gas_damage,
    Hallucination, Hate_silver, Levitation, Passes_walls, Punished, Stone_resistance, Stunned,
    Underwater, Wwalking,
} from "./youprop.h.macros.js";
import { char, int, schar, sizeof_string, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64, and64u, or64 } from "../rt/int64.js";
import { assert, sprintf, strcat, strchr, strcpy } from "../rt/libc.js";
import { init_string, stack_array, stack_struct, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, ptr_to, ref_to, sizeof_member, struct_assign, view_of } from "../rt/struct.js";
import { stop_occupation } from "./allmain.js";
import { could_pole_mon, snuff_candle, use_pole, use_whip } from "./apply.js";
import { artifact_hit, is_art, spec_abon } from "./artifact.js";
import { change_luck, exercise } from "./attrib.js";
import { drag_ball, drop_ball, move_bc } from "./ball.js";
import { cmdq_add_ec, cmdq_add_key, getdir, isok } from "./cmd.js";
import { is_lava, is_moat, is_pool, is_waterwall } from "./dbridge.js";
import { flags, gb, gc, gh, gi, gk, gm, gn, gt, gv, gy, iflags, svc, svk, svq, u } from "./decl.js";
import { canseemon, flush_screen, glyph_at, map_invisible, newsym, tmp_at } from "./display.js";
import { canletgo, doaltarobj, dropy, dropz, flooreffects, obj_no_longer_held } from "./do.js";
import {
    Monnam, Some_Monnam, a_monnam, hliquid, mon_nam, pmname, rndmonnam, x_monnam,
} from "./do_name.js";
import { hard_helmet } from "./do_wear.js";
import { dogfood, tamedog } from "./dog.js";
import { container_impact_dmg, ghitm, ship_object } from "./dokick.js";
import { ceiling, has_ceiling, surface, u_on_newpos } from "./dungeon.js";
import { done } from "./end.js";
import { u_wipe_engr } from "./engrave.js";
import { explode, explode_oil } from "./explode.js";
import {
    bad_rock, calc_capacity, check_capacity, check_special_room, impact_disturbs_zombies, in_rooms,
    inv_weight, losehp, may_passwall, nomul, switch_terrain, weight_cap,
} from "./hack.js";
import { distmin, isqrt, ordin, s_suffix, sgn } from "./hacklib.js";
import {
    addinv, addinv_before, delobj, freeinv, fully_identify_obj, getobj, prinv, sobj_at, stackobj,
} from "./invent.js";
import { obj_sheds_light } from "./light.js";
import { makemon, set_malign } from "./makemon.js";
import { add_to_minv, is_flammable, place_object, splitobj, unsplitobj, weight } from "./mkobj.js";
import { minliquid, monnear, seemimic, setmangry, wake_nearto, wakeup } from "./mon.js";
import { can_blnd, mon_hates_blessings, poly_when_stoned } from "./mondata.js";
import { closed_door, set_apparxy } from "./monmove.js";
import { mons } from "./monst.js";
import { objects } from "./objects.js";
import {
    An, Doname2, The, Tobjnam, an, armor_simple_name, corpse_xname, helm_simple_name, killer_xname,
    makeplural, mshot_xname, otense, singular, the, thesimpleoname, vtense, xname,
} from "./objnam.js";
import { encumber_msg } from "./pickup.js";
import {
    Norep, You, You_cant, You_feel, You_hear, Your, impossible, pline, pline_The, verbalize,
} from "./pline.js";
import { body_part, polymon } from "./polyself.js";
import { make_blinded, potionbreathe, potionhit } from "./potion.js";
import { align_gname } from "./pray.js";
import { finish_quest } from "./quest.js";
import { is_quest_artifact } from "./questpgr.js";
import { in_out_region, m_in_out_region } from "./region.js";
import { d, rn2, rn2_on_display_rng, rnd, rnl } from "./rnd.js";
import {
    contained_gold, costly_spot, donate_gold, hot_pursuit, inside_shop, is_unpaid, make_angry_shk,
    obfree, sellobj, shop_keeper, stolen_value, subfrombill,
} from "./shk.js";
import { mpickobj, remove_worn_item } from "./steal.js";
import { place_monster } from "./steed.js";
import { goodpos, rloc, tele_restrict } from "./teleport.js";
import {
    dotrap, drown, erode_obj, instapetrify, minstapetrify, mintrap, t_at, trapname,
} from "./trap.js";
import { hmon, passive_obj } from "./uhitm.js";
import { vision_recalc } from "./vision.js";
import {
    autoreturn_weapon, dmgval, dry_a_towel, hitval, skill_name, weapon_descr, weapon_hit_bonus,
    weapon_type,
} from "./weapon.js";
import {
    doquiver_core, doswapweapon, dowield, set_twoweap, setuqwep, setuswapwep, setuwep, welded,
    weldmsg,
} from "./wield.js";
import { cutworm } from "./worm.js";
import { find_mac, which_armor } from "./worn.js";
import { bhit, boomhit, hit, miss, obj_resists } from "./zap.js";
