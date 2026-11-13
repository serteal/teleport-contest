/* NetHack 5.0	muse.c	$NHDT-Date: 1770949988 2026/02/12 18:33:08 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.241 $ */
/*      Copyright (C) 1990 by Ken Arromdee                         */
/* NetHack may be freely redistributed.  See license for details.  */

/*
 * Monster item usage routines.
 */

/* Let monsters use magic items.  Arbitrary assumptions: Monsters only use
 * scrolls when they can see, monsters know when wands have 0 charges,
 * monsters cannot recognize if items are cursed are not, monsters which
 * are confused don't know not to read scrolls, etc....
 */

/* Any preliminary checks which may result in the monster being unable to use
 * the item.  Returns 0 if nothing happened, 2 if the monster can't do
 * anything (i.e. it teleported) and 1 if it's dead.
 */
function precheck(mon, obj) { /* int */
    const $frame = stack_frame(); try {
    let vis;

    if (!obj)
        return 0;
    vis = cansee(mon.mx, mon.my);

    if (obj.oclass == POTION_CLASS) {
        let cc = stack_struct(struct_nhcoord);
        let empty = static_var("precheck.empty", ptr_to(char), _("The potion turns out to be empty."));
        let mtmp;

        if (objdescr_is(obj, _("milky"))) {
            if (!(svm.mvitals[PM_GHOST].mvflags & G_GONE)
                && !rn2(POTION_OCCUPANT_CHANCE(svm.mvitals[PM_GHOST].born))) {
                if (!enexto(cc, mon.mx, mon.my, mons[PM_GHOST]))
                    return 0;
                mquaffmsg(mon, obj);
                m_useup(mon, obj);
                mtmp = makemon(mons[PM_GHOST], cc.x, cc.y, MM_NOMSG);
                if (!mtmp) {
                    if (vis)
                        pline1(empty[0]);
                } else {
                    if (vis) {
                        pline(
                            _("As %s opens the bottle, an enormous %s emerges!"),
                              mon_nam(mon),
                              Hallucination() ? rndmonnam(0)
                                            : _("ghost"));
                        pline(_("%s is frightened to death," +
                              " and unable to move."),
                              Monnam(mon));
                    }
                    paralyze_monst(mon, 3);
                }
                return 2;
            }
        }
        if (objdescr_is(obj, _("smoky"))
            && !(svm.mvitals[PM_DJINNI].mvflags & G_GONE)
            && !rn2(POTION_OCCUPANT_CHANCE(svm.mvitals[PM_DJINNI].born))) {
            if (!enexto(cc, mon.mx, mon.my, mons[PM_DJINNI]))
                return 0;
            mquaffmsg(mon, obj);
            m_useup(mon, obj);
            mtmp = makemon(mons[PM_DJINNI], cc.x, cc.y, MM_NOMSG);
            if (!mtmp) {
                if (vis)
                    pline1(empty[0]);
            } else {
                if (vis)
                    pline_mon(mtmp, _("In a cloud of smoke, %s emerges!"), a_monnam(mtmp));
                pline(_("%s speaks."), vis ? Monnam(mtmp) : Something());
                /* I suspect few players will be upset that monsters */
                /* can't wish for wands of death here.... */
                   ;
                if (rn2(2)) {
                    verbalize(_("You freed me!"));
                    mtmp.mpeaceful = 1;
                    set_malign(mtmp);
                } else {
                    verbalize(_("It is about time."));
                    if (vis)
                        pline(_("%s vanishes."), Monnam(mtmp));
                    mongone(mtmp);
                }
            }
            return 2;
        }
    }
    if (obj.oclass == WAND_CLASS && obj.cursed
        && !rn2(WAND_BACKFIRE_CHANCE)) {
        let dam = d(obj.spe + 2, 6);

        /* 3.6.1: no Deaf filter; 'if' message doesn't warrant it, 'else'
           message doesn't need it since You_hear() has one of its own */
        if (vis) {
            pline_mon(mon, _("%s zaps %s, which suddenly explodes!"), Monnam(mon),
                  an(xname(obj)));
        } else {
            /* same near/far threshold as mzapwand() */
            let range = couldsee(mon.mx, mon.my) /* 9 or 5 */
                           ? (BOLT_LIM + 1) : (BOLT_LIM - 3);

             ;
            You_hear(_("a zap and an explosion %s."),
                     (mdistu(mon) <= range * range)
                        ? _("nearby") : _("in the distance"));
        }
        m_useup(mon, obj);
        mon.mhp -= dam;
        if (DEADMONSTER(mon)) {
            monkilled(mon, _(""), AD_RBRE);
            return 1;
        }
        gm.m.has_defense = gm.m.has_offense = gm.m.has_misc = 0;
        /* Only one needed to be set to 0 but the others are harmless */
    }
    return 0;
    } finally { stack_pop($frame); }
}

/* when a monster zaps a wand give a message, deduct a charge, and if it
   isn't directly seen, remove hero's memory of the number of charges */
function mzapwand(
    mtmp,
    otmp,
    self) { /* void */
    if (otmp.spe < 1) {
        impossible(_("Mon zapping wand with %d charges?"), otmp.spe);
        return;
    }
    if (!canseemon(mtmp)) {
        let range = couldsee(mtmp.mx, mtmp.my) /* 9 or 5 */
                       ? (BOLT_LIM + 1) : (BOLT_LIM - 3);

         ;
        You_hear(_("a %s zap."), (mdistu(mtmp) <= range * range)
                                 ? _("nearby") : _("distant"));
        unknow_object(otmp); /* hero loses info when unseen obj is used */
    } else if (self) {
        pline(_("%s with %s!"),
              monverbself(mtmp, Monnam(mtmp), _("zap"), 0),
              doname(otmp));
    } else {
        pline_mon(mtmp, _("%s zaps %s!"), Monnam(mtmp), an(xname(otmp)));
        stop_occupation();
    }
    otmp.spe -= 1;
}

/* similar to mzapwand() but for magical horns (only instrument mons play) */
function mplayhorn(
    mtmp,
    otmp,
    self) { /* void */
    const $frame = stack_frame(); try {
    let objnamp, objbuf = stack_array(char, BUFSZ);

    if (!canseemon(mtmp)) {
        let range = couldsee(mtmp.mx, mtmp.my) /* 9 or 5 */
                       ? (BOLT_LIM + 1) : (BOLT_LIM - 3);

         ;
        You_hear(_("a horn being played %s."),
                 (mdistu(mtmp) <= range * range)
                    ? _("nearby") : _("in the distance"));
        unknow_object(otmp); /* hero loses info when unseen obj is used */
    } else if (self) {
        observe_object(otmp);
        objnamp = xname(otmp);
        if (strlen(objnamp) >= QBUFSZ)
            objnamp = simpleonames(otmp);
        sprintf(objbuf, _("a %s directed at"), objnamp);
        /* "<mon> plays a <horn> directed at himself!" */
        pline(_("%s!"), monverbself(mtmp, Monnam(mtmp), _("play"), objbuf));
        makeknown(otmp.otyp); /* (wands handle this slightly differently) */
    } else {
        observe_object(otmp);
        objnamp = xname(otmp);
        if (strlen(objnamp) >= QBUFSZ)
            objnamp = simpleonames(otmp);
        pline(_("%s %s %s directed at you!"),
              /* monverbself() would adjust the verb if hallucination made
                 subject plural; stick with singular here, at least for now */
              Monnam(mtmp), _("plays"), an(objnamp));
        makeknown(otmp.otyp);
        stop_occupation();
    }
    otmp.spe -= 1; /* use a charge */
    } finally { stack_pop($frame); }
}

/* see or hear a monster reading a scroll;
   when scroll hasn't been seen, its label is revealed unless hero is deaf */
function mreadmsg(mtmp, otmp) { /* void */
    const $frame = stack_frame(); try {
    let onambuf = stack_array(char, BUFSZ);
    let vismon = canseemon(mtmp),
            tpindicator = (!vismon && sensemon(mtmp) ? 1 : 0);

    if (!vismon && Deaf())
        return; /* no feedback */

    observe_object(otmp); /* seeing/hearing scroll read reveals its label */
    strcpy(onambuf, singular(otmp, vismon ? doname : ansimpleoname));

    if (vismon) {
        /* directly see the monster reading the scroll */
        pline_mon(mtmp, _("%s reads %s!"), Monnam(mtmp), onambuf);
    } else { /* !Deaf, otherwise we wouldn't reach here */
        let blindbuf = stack_array(char, BUFSZ);
        let similar = same_race(gy.youmonst.data, mtmp.data),
                uniqmon = (((mtmp.data.geno & G_UNIQ) != 0
                           /* shopkeepers aren't unique monsters but since
                              they have distinct names, treat them as such */
                           || mtmp.isshk ? 1 : 0)),
                recognize = (!Hallucination()
                             && (mtmp.meverseen || (similar && !uniqmon)) ? 1 : 0);
        /* describe unseen monster accurately when not hallucinating if it
           has ever been seen or is the same race as the hero (not yet seen
           unique monsters excepted) */
        let mflags = (SUPPRESS_INVISIBLE | SUPPRESS_SADDLE
                      | (recognize ? SUPPRESS_IT : AUGMENT_IT));

        if (sensemon(mtmp)) {
            tpindicator = TRUE;
        } else if (couldsee(mtmp.mx, mtmp.my) && mdistu(mtmp) <= 10 * 10) {
            /* monster can't be seen or sensed; hero might be blind or monster
               might be at a spot that isn't in view or might be invisible;
               remember it if the spot is within line of sight and relatively
               close */
            map_invisible(mtmp.mx, mtmp.my);
        }

        Snprintf(blindbuf, sizeof(array_of(char, BUFSZ)), _("reading %s"), onambuf);
        strsubst(blindbuf, _("reading a scroll labeled"),
                 mtmp.mconf ? _("attempting to incant") : _("incant"));
        You_hear(_("%s %s."),
                 x_monnam(mtmp, ARTICLE_A, 0, mflags, FALSE),
                 blindbuf);
        if (tpindicator)
            flash_mon(mtmp);
    }
    if (mtmp.mconf) /* (note: won't get if not seen and hero can't hear) */
        pline(_("Being confused, %s mispronounces the magic words..."),
              vismon ? mon_nam(mtmp) : mhe(mtmp));
    } finally { stack_pop($frame); }
}

function mquaffmsg(mtmp, otmp) { /* void */
    if (canseemon(mtmp)) {
        observe_object(otmp);
        pline_mon(mtmp, _("%s drinks %s!"), Monnam(mtmp), singular(otmp, doname));
    } else if (!Deaf()) {
         ;
        You_hear(_("a chugging sound."));
    }
}

/* Defines for various types of stuff.  The order in which monsters prefer
 * to use them is determined by the order of the code logic, not the
 * numerical order in which they are defined.
 */
export const MUSE_SCR_TELEPORTATION = 1;
export const MUSE_WAN_TELEPORTATION_SELF = 2;
export const MUSE_POT_HEALING = 3;
export const MUSE_POT_EXTRA_HEALING = 4;
export const MUSE_WAN_DIGGING = 5;
export const MUSE_TRAPDOOR = 6;
export const MUSE_TELEPORT_TRAP = 7;
export const MUSE_UPSTAIRS = 8;
export const MUSE_DOWNSTAIRS = 9;
export const MUSE_WAN_CREATE_MONSTER = 10;
export const MUSE_SCR_CREATE_MONSTER = 11;
export const MUSE_UP_LADDER = 12;
export const MUSE_DN_LADDER = 13;
export const MUSE_SSTAIRS = 14;

export const MUSE_BUGLE = 16;
export const MUSE_UNICORN_HORN = 17;
export const MUSE_POT_FULL_HEALING = 18;
export const MUSE_LIZARD_CORPSE = 19;
export const MUSE_WAN_UNDEAD_TURNING = 20;
/*
#define MUSE_INNATE_TPT 9999
 * We cannot use this.  Since monsters get unlimited teleportation, if they
 * were allowed to teleport at will you could never catch them.  Instead,
 * assume they only teleport at random times, despite the inconsistency
 * that if you polymorph into one you teleport at will.
 */

function m_use_healing(mtmp) { /* boolean */
    let obj;

    if ((obj = m_carrying(mtmp, POT_FULL_HEALING)) != null) {
        gm.m.defensive = obj;
        gm.m.has_defense = MUSE_POT_FULL_HEALING;
        return TRUE;
    }
    if ((obj = m_carrying(mtmp, POT_EXTRA_HEALING)) != null) {
        gm.m.defensive = obj;
        gm.m.has_defense = MUSE_POT_EXTRA_HEALING;
        return TRUE;
    }
    if ((obj = m_carrying(mtmp, POT_HEALING)) != null) {
        gm.m.defensive = obj;
        gm.m.has_defense = MUSE_POT_HEALING;
        return TRUE;
    }
    return FALSE;
}

/* return TRUE if monster mtmp can see at least one sleeping soldier */
function m_sees_sleepy_soldier(mtmp) { /* boolean */
    let x = mtmp.mx, y = mtmp.my;
    let xx, yy;
    let mon;

    /* Distance is arbitrary.  What we really want to do is
     * have the soldier play the bugle when it sees or
     * remembers soldiers nearby...
     */
    for (xx = x - 3; xx <= x + 3; xx++)
        for (yy = y - 3; yy <= y + 3; yy++) {
            if (!isok(xx, yy) || (xx == x && yy == y))
                continue;
            if ((mon = m_at(xx, yy)) != null && is_mercenary(mon.data)
                && mon.data != mons[PM_GUARD]
                && helpless(mon))
                return TRUE;
        }
    return FALSE;
}

function m_tele(
    mtmp,
    vismon,
    oseen,
    how) { /* void */ /* type of that object */
    if (tele_restrict(mtmp)) { /* mysterious force... */
        if (vismon && how)     /* mentions 'teleport' */
            makeknown(how);
        /* monster learns that teleportation isn't useful here */
        if (noteleport_level(mtmp))
            mon_learns_traps(mtmp, TELEP_TRAP);
    } else if ((mon_has_amulet(mtmp) || On_W_tower_level(u.uz)) && !rn2(3)) {
        if (vismon)
            pline_mon(mtmp, _("%s seems disoriented for a moment."), Monnam(mtmp));
    } else {
        /* teleport monster 'mtmp' */
        if (how) {
            /* teleporation has been triggered by an object */
            if (oseen)
                makeknown(how);
            rloc(mtmp, RLOC_MSG);
        } else {
            /* monster is voluntarily entering a teleporation trap; use the
               trap instead of rloc() in case it sends 'victim' to a vault */
            mtmp.mx = gt.trapx, mtmp.my = gt.trapy;
            mintrap(mtmp, FORCETRAP);
        }
    }
}

/* return TRUE if monster mtmp has another monster next to it.
 * Called from find_defensive() where it is limited to Is_knox()
 * only, otherwise you could trap two monsters next to each other
 * in a boulder fort, and they would be happy to stay in there. */
function m_next2m(mtmp) { /* boolean */
    let x, y;
    let m2;

    if (DEADMONSTER(mtmp) || mon_offmap(mtmp))
        return FALSE;

    for (x = mtmp.mx - 1; x <= mtmp.mx + 1; x++)
        for (y = mtmp.my - 1; y <= mtmp.my + 1; y++) {
            if (!isok(x,y))
                continue;
            if ((m2 = m_at(x, y)) && m2 != mtmp)
                return TRUE;
        }
    return FALSE;
}

/* Select a defensive item/action for a monster.  Returns TRUE iff one is
   found. */
export function find_defensive(mtmp, tryescape) { /* boolean */
    const $frame = stack_frame(); try {
    var obj;
    var t;
    var fraction;
    var x = mtmp.mx, y = mtmp.my;
    var stuck = +(mtmp == u.ustuck),
            immobile = +(mtmp.data.mmove == 0);
    var stway;

    gm.m.defensive = null;
    gm.m.has_defense = 0;

    if (is_animal(mtmp.data) || mindless(mtmp.data))
        return FALSE;
    if (!tryescape && dist2(x, y, mtmp.mux, mtmp.muy) > 25)
        return FALSE;
    if (tryescape && Is_knox(u.uz)
        && !m_next2u(mtmp) && m_next2m(mtmp))
        return FALSE;
    if (u.uswallow && stuck)
        return FALSE;

    /*
     * Since unicorn horns don't get used up, the monster would look
     * silly trying to use the same cursed horn round after round,
     * so skip cursed unicorn horns.
     *
     * Unicorns use their own horns; they're excluded from inventory
     * scanning by nohands().  Ki-rin is depicted in the AD&D Monster
     * Manual with same horn as a unicorn, so let it use its horn too.
     * is_unicorn() doesn't include it; the class differs and it has
     * no interest in gems.
     */
    if (mtmp.mconf || mtmp.mstun || !mtmp.mcansee) {
        obj = null;
        if (!nohands(mtmp.data)) {
            for (obj = mtmp.minvent; obj; obj = obj.nobj)
                if (obj.otyp == UNICORN_HORN && !obj.cursed)
                    break;
        }
        if (obj || is_unicorn(mtmp.data) || mtmp.data == mons[PM_KI_RIN]) {
            gm.m.defensive = obj;
            gm.m.has_defense = MUSE_UNICORN_HORN;
            return TRUE;
        }
    }

    if (mtmp.mconf || mtmp.mstun) {
        var liztin = null;

        for (obj = mtmp.minvent; obj; obj = obj.nobj) {
            if (obj.otyp == CORPSE && obj.corpsenm == PM_LIZARD) {
                gm.m.defensive = obj;
                gm.m.has_defense = MUSE_LIZARD_CORPSE;
                return TRUE;
            } else if (obj.otyp == TIN && obj.corpsenm == PM_LIZARD) {
                liztin = obj;
            }
        }
        /* confused or stunned monster might not be able to open tin */
        if (liztin && mcould_eat_tin(mtmp) && rn2(3)) {
            gm.m.defensive = liztin;
            /* tin and corpse ultimately end up being handled the same */
            gm.m.has_defense = MUSE_LIZARD_CORPSE;
            return TRUE;
        }
    }

    /* It so happens there are two unrelated cases when we might want to
     * check specifically for healing alone.  The first is when the monster
     * is blind (healing cures blindness).  The second is when the monster
     * is peaceful; then we don't want to flee the player, and by
     * coincidence healing is all there is that doesn't involve fleeing.
     * These would be hard to combine because of the control flow.
     * Pestilence won't use healing even when blind.
     */
    if (!mtmp.mcansee && !nohands(mtmp.data)
        && mtmp.data != mons[PM_PESTILENCE]) {
        if (m_use_healing(mtmp))
            return TRUE;
    }

    /* monsters aren't given wands of undead turning but if they
       happen to have picked one up, use it against corpse wielder;
       when applicable, use it now even if 'mtmp' isn't wounded */
    if (!mtmp.mpeaceful && !nohands(mtmp.data)
        && uwep && uwep.otyp == CORPSE
        && touch_petrifies(mons[uwep.corpsenm])
        && !poly_when_stoned(mtmp.data) && !resists_ston(mtmp)
        && lined_up(mtmp)) { /* only lines up if distu range is within 5*5 */
        /* could use m_carrying(), then nxtobj() when matching wand
           is empty, but direct traversal is actually simpler here */
        for (obj = mtmp.minvent; obj; obj = obj.nobj)
            if (obj.otyp == WAN_UNDEAD_TURNING && obj.spe > 0) {
                gm.m.defensive = obj;
                gm.m.has_defense = MUSE_WAN_UNDEAD_TURNING;
                return TRUE;
            }
    }

    if (!tryescape) {
        /* do we try to heal? */
        fraction = u.ulevel < 10 ? 5 : u.ulevel < 14 ? 4 : 3;
        if (mtmp.mhp >= mtmp.mhpmax
            || (mtmp.mhp >= 10 && mtmp.mhp * fraction >= mtmp.mhpmax))
            return FALSE;

        if (mtmp.mpeaceful) {
            if (!nohands(mtmp.data)) {
                if (m_use_healing(mtmp))
                    return TRUE;
            }
            return FALSE;
        }
    }

    if (stuck || immobile || mtmp.mtrapped) {
        ; /* fleeing by stairs or traps is not possible */
    } else if (levl()[x][y].typ == STAIRS) {
        stway = stairway_at(x,y);
        if (stway && !stway.up && stway.tolev.dnum == u.uz.dnum) {
            if (!is_floater(mtmp.data))
                gm.m.has_defense = MUSE_DOWNSTAIRS;
        } else if (stway && stway.up && stway.tolev.dnum == u.uz.dnum) {
            gm.m.has_defense = MUSE_UPSTAIRS;
        } else if (stway &&  stway.tolev.dnum != u.uz.dnum) {
            if (stway.up || !is_floater(mtmp.data))
                gm.m.has_defense = MUSE_SSTAIRS;
        }
    } else if (levl()[x][y].typ == LADDER) {
        stway = stairway_at(x,y);
        if (stway && stway.up && stway.tolev.dnum == u.uz.dnum) {
            gm.m.has_defense = MUSE_UP_LADDER;
        } else if (stway && !stway.up && stway.tolev.dnum == u.uz.dnum) {
            if (!is_floater(mtmp.data))
                gm.m.has_defense = MUSE_DN_LADDER;
        } else if (stway && stway.tolev.dnum != u.uz.dnum) {
            if (stway.up || !is_floater(mtmp.data))
                gm.m.has_defense = MUSE_SSTAIRS;
        }
    } else {
        /* Note: trap doors take precedence over teleport traps. */
        var xx, yy, i, locs = stack_array(array_of(short, 2), 10);
        var ignore_boulders = +(verysmall(mtmp.data)
                                   || throws_rocks(mtmp.data)
                                   || passes_walls(mtmp.data)),
            diag_ok = +!NODIAG(monsndx(mtmp.data));

        for (i = 0; i < 10; ++i) /* 10: 9 spots plus sentinel */
            locs[i][0] = locs[i][1] = 0;
        /* collect viable spots; monster's <mx,my> comes first */
        locs[0][0] = x, locs[0][1] = y;
        i = 1;
        for (xx = x - 1; xx <= x + 1; xx++)
            for (yy = y - 1; yy <= y + 1; yy++)
                if (isok(xx, yy) && (xx != x || yy != y)) {
                    locs[i][0] = xx, locs[i][1] = yy;
                    ++i;
                }
        /* look for a suitable trap among the viable spots */
        for (i = 0; i < 10; ++i) {
            xx = locs[i][0], yy = locs[i][1];
            if (!xx)
                break; /* we've run out of spots */
            /* skip if it's hero's location
               or a diagonal spot and monster can't move diagonally
               or some other monster is there */
            if (u_at(xx, yy)
                || (xx != x && yy != y && !diag_ok)
                || (svl.level.monsters[xx][yy] && !(xx == x && yy == y)))
                continue;
            /* skip if there's no trap or can't/won't move onto trap */
            if ((t = t_at(xx, yy)) == null
                || (!ignore_boulders && sobj_at(BOULDER, xx, yy))
                || onscary(xx, yy, mtmp))
                continue;
            /* use trap if it's the correct type */
            if (is_hole(t.ttyp)
                && !is_floater(mtmp.data)
                && !mtmp.isshk && !mtmp.isgd && !mtmp.ispriest
                && Can_fall_thru(u.uz)) {
                gt.trapx = xx;
                gt.trapy = yy;
                gm.m.has_defense = MUSE_TRAPDOOR;
                break; /* no need to look at any other spots */
            } else if (t.ttyp == TELEP_TRAP) {
                gt.trapx = xx;
                gt.trapy = yy;
                gm.m.has_defense = MUSE_TELEPORT_TRAP;
            }
        }
    }

    botm: { if (nohands(mtmp.data)) /* can't use objects */
        break botm;;

    if (is_mercenary(mtmp.data) && (obj = m_carrying(mtmp, BUGLE)) != null
        && m_sees_sleepy_soldier(mtmp)) {
        gm.m.defensive = obj;
        gm.m.has_defense = MUSE_BUGLE;
    }

    /* use immediate physical escape prior to attempting magic */
    if (gm.m.has_defense) /* stairs, trap door or tele-trap, bugle alert */
        break botm;;

    /* kludge to cut down on trap destruction (particularly portals) */
    t = t_at(x, y);
    if (t && (is_pit(t.ttyp) || t.ttyp == WEB
              || t.ttyp == BEAR_TRAP))
        t = null; /* ok for monster to dig here */

    /* selection could be improved by collecting all possibilities
       into an array and then picking one at random */
    for (obj = mtmp.minvent; obj; obj = obj.nobj) {
        /* don't always use the same selection pattern */
        if (gm.m.has_defense && !rn2(3))
            break;

        /* nomore(MUSE_WAN_DIGGING); */
        if (gm.m.has_defense == MUSE_WAN_DIGGING)
            break;
        if (obj.otyp == WAN_DIGGING && obj.spe > 0 && !stuck && !t
            && !mtmp.isshk && !mtmp.isgd && !mtmp.ispriest
            && !is_floater(mtmp.data)
            /* monsters digging in Sokoban can ruin things */
            && !Sokoban()
            /* digging wouldn't be effective; assume they know that */
            && !(levl()[x][y].flags & W_NONDIGGABLE)
            && !(Is_botlevel(u.uz) || In_endgame(u.uz))
            && !(is_ice(x, y) || is_pool(x, y) || is_lava(x, y))
            && !(is_Vlad(mtmp) && In_V_tower(u.uz))) {
            gm.m.defensive = obj;
            gm.m.has_defense = MUSE_WAN_DIGGING;
        }
        if ((gm.m.has_defense == MUSE_WAN_TELEPORTATION_SELF)) continue;
        if ((gm.m.has_defense == MUSE_WAN_TELEPORTATION)) continue;
        if (obj.otyp == WAN_TELEPORTATION && obj.spe > 0) {
            /* use the TELEP_TRAP bit to determine if they know
             * about noteleport on this level or not.  Avoids
             * ineffective re-use of teleportation.  This does
             * mean if the monster leaves the level, they'll know
             * about teleport traps.
             */
            if (!noteleport_level(mtmp)
                || !mon_knows_traps(mtmp, TELEP_TRAP)) {
                gm.m.defensive = obj;
                gm.m.has_defense = mon_has_amulet(mtmp)
                                    ? MUSE_WAN_TELEPORTATION
                                    : MUSE_WAN_TELEPORTATION_SELF;
            }
        }
        if ((gm.m.has_defense == MUSE_SCR_TELEPORTATION)) continue;
        if (obj.otyp == SCR_TELEPORTATION && mtmp.mcansee
            && haseyes(mtmp.data)
            && (!obj.cursed || (!(mtmp.isshk && inhishop(mtmp))
                                 && !mtmp.isgd && !mtmp.ispriest))) {
            /* see WAN_TELEPORTATION case above */
            if (!noteleport_level(mtmp)
                || !mon_knows_traps(mtmp, TELEP_TRAP)) {
                gm.m.defensive = obj;
                gm.m.has_defense = MUSE_SCR_TELEPORTATION;
            }
        }

        if (mtmp.data != mons[PM_PESTILENCE]) {
            if ((gm.m.has_defense == MUSE_POT_FULL_HEALING)) continue;
            if (obj.otyp == POT_FULL_HEALING) {
                gm.m.defensive = obj;
                gm.m.has_defense = MUSE_POT_FULL_HEALING;
            }
            if ((gm.m.has_defense == MUSE_POT_EXTRA_HEALING)) continue;
            if (obj.otyp == POT_EXTRA_HEALING) {
                gm.m.defensive = obj;
                gm.m.has_defense = MUSE_POT_EXTRA_HEALING;
            }
            if ((gm.m.has_defense == MUSE_WAN_CREATE_MONSTER)) continue;
            if (obj.otyp == WAN_CREATE_MONSTER && obj.spe > 0) {
                gm.m.defensive = obj;
                gm.m.has_defense = MUSE_WAN_CREATE_MONSTER;
            }
            if ((gm.m.has_defense == MUSE_POT_HEALING)) continue;
            if (obj.otyp == POT_HEALING) {
                gm.m.defensive = obj;
                gm.m.has_defense = MUSE_POT_HEALING;
            }
        } else { /* Pestilence */
            if ((gm.m.has_defense == MUSE_POT_FULL_HEALING)) continue;
            if (obj.otyp == POT_SICKNESS) {
                gm.m.defensive = obj;
                gm.m.has_defense = MUSE_POT_FULL_HEALING;
            }
            if ((gm.m.has_defense == MUSE_WAN_CREATE_MONSTER)) continue;
            if (obj.otyp == WAN_CREATE_MONSTER && obj.spe > 0) {
                gm.m.defensive = obj;
                gm.m.has_defense = MUSE_WAN_CREATE_MONSTER;
            }
        }
        if ((gm.m.has_defense == MUSE_SCR_CREATE_MONSTER)) continue;
        if (obj.otyp == SCR_CREATE_MONSTER) {
            gm.m.defensive = obj;
            gm.m.has_defense = MUSE_SCR_CREATE_MONSTER;
        }
    }
 }
    return (+!!gm.m.has_defense);
    } finally { stack_pop($frame); }
}

/* when a monster deliberately enters a trap, make sure the spot becomes
   accessible (trap doors and teleporters inside niches are located at
   secret corridor locations; convert such into normal corridor even if
   hero doesn't see it happen) */
function reveal_trap(t, seeit) { /* void */
    let lev = levl()[t.tx][t.ty];

    if (lev.typ == SCORR) {
        lev.typ = CORR, lev.flags = 0; /* set_levltyp(,,CORR) */
        unblock_point(t.tx, t.ty);
    }
    if (seeit)
        seetrap(t);
}

/* Monsters without the Amulet escape the dungeon and
 * are gone for good when they leave up the up stairs.
 * A monster with the Amulet would leave it behind
 * (mongone -> mdrop_special_objs) but we force any
 * monster who manages to acquire it or the invocation
 * tools to stick around instead of letting it escape.
 * Don't let the Wizard escape even when not carrying
 * anything of interest unless there are more than 1
 * of him.
 */
function mon_escape(mtmp, vismon) { /* int */
    if (mon_has_special(mtmp)
        || (mtmp.iswiz && svc.context.no_of_wizards < 2))
        return 0;
    if (vismon)
        pline_mon(mtmp, _("%s escapes the dungeon!"), Monnam(mtmp));
    mongone(mtmp);
    return 2;
}

/* Perform a defensive action for a monster.  Must be called immediately
 * after find_defensive().  Return values are 0: did something, 1: died,
 * 2: did something and can't attack again (i.e. teleported).
 */
export function use_defensive(mtmp) { /* int */
    const $frame = stack_frame(); try {
    let MissingDefensiveItem = init_string(static_array("use_defensive.MissingDefensiveItem", char, sizeof_string("use_defensive: no %s")), _("use_defensive: no %s"), true);
    let i, fleetim;
    let otmp = gm.m.defensive;
    let vis, vismon, oseen;
    let t;
    let stway;

    if ((i = precheck(mtmp, otmp)) != 0)
        return i;
    vis = cansee(mtmp.mx, mtmp.my);
    vismon = canseemon(mtmp);
    oseen = (otmp && vismon ? 1 : 0);

    /* when using defensive choice to run away, we want monster to avoid
       rushing right straight back; don't override if already scared */
    fleetim = !mtmp.mflee ? (33 - Math.trunc(30 * mtmp.mhp / mtmp.mhpmax)) : 0;

    switch (gm.m.has_defense) {
    case MUSE_UNICORN_HORN:
        /* unlike most defensive cases, unicorn horn object is optional */
        if (vismon) {
            if (otmp)
                pline_mon(mtmp, _("%s uses a unicorn horn!"), Monnam(mtmp));
            else
                pline_The(_("tip of %s's horn glows!"), mon_nam(mtmp));
        }
        if (!mtmp.mcansee) {
            mcureblindness(mtmp, vismon);
        } else if (mtmp.mconf || mtmp.mstun) {
            mtmp.mconf = mtmp.mstun = 0;
            if (vismon)
                pline_mon(mtmp, _("%s seems steadier now."), Monnam(mtmp));
        } else {
            impossible(_("No need for unicorn horn?"));
        }
        return 2;
    case MUSE_BUGLE:
        if (!otmp)
            panic(MissingDefensiveItem, _("bugle"));
        if (vismon) {
            pline_mon(mtmp, _("%s plays %s!"), Monnam(mtmp), doname(otmp));
        } else if (!Deaf()) {
             ;
            You_hear(_("a bugle playing reveille!"));
        }
        awaken_soldiers(mtmp);
        return 2;
    case MUSE_WAN_TELEPORTATION_SELF:
        if (!otmp)
            panic(MissingDefensiveItem, _("wand of teleportation"));
        if ((mtmp.isshk && inhishop(mtmp)) || mtmp.isgd || mtmp.ispriest)
            return 2;
        if ((fleetim && !mtmp.iswiz)) { monflee(mtmp, fleetim, FALSE, FALSE); };
        mzapwand(mtmp, otmp, TRUE);
        m_tele(mtmp, vismon, oseen, WAN_TELEPORTATION);
        return 2;
    case MUSE_WAN_TELEPORTATION:
        if (!otmp)
            panic(MissingDefensiveItem, _("wand of teleportation"));
        gz.zap_oseen = oseen;
        mzapwand(mtmp, otmp, FALSE);
        gm.m_using = TRUE;
        mbhit(mtmp, rn1(8, 6), mbhitm, bhito, otmp);
        /* monster learns that teleportation isn't useful here */
        if (noteleport_level(mtmp))
            mon_learns_traps(mtmp, TELEP_TRAP);
        gm.m_using = FALSE;
        return 2;
    case MUSE_SCR_TELEPORTATION: {
        let obj_is_cursed;

        if (!otmp)
            panic(MissingDefensiveItem, _("scroll of teleportation"));
        obj_is_cursed = otmp.cursed;
        if (mtmp.isshk || mtmp.isgd || mtmp.ispriest)
            return 2;
        if ((fleetim && !mtmp.iswiz)) { monflee(mtmp, fleetim, FALSE, FALSE); };
        /* we want to be able to access otmp after the teleport but it
           might get destroyed if still in mtmp's inventory (maybe mtmp
           lands in lava or on a fire trap) so take it out in advance */
        if (otmp.quan > 1)
            otmp = splitobj(otmp, 1);
        extract_from_minvent(mtmp, otmp, FALSE, FALSE);
        /* 'last_msg' will be changed to PLNMSG_UNKNOWN if any messages
           are issued by mreadmsg(), 'if (vismon) pline()', or m_tele() */
        iflags.last_msg = PLNMSG_enum;
        mreadmsg(mtmp, otmp); /* sets otmp->dknown if !Blind or !Deaf */
        if (obj_is_cursed || mtmp.mconf) {
            let nlev;
            let flev = stack_struct(struct_d_level);

            nlev = random_teleport_level();
            if (mon_has_amulet(mtmp) || In_endgame(u.uz)) {
                if (vismon)
                    pline_mon(mtmp, _("%s seems very disoriented for a moment."),
                          Monnam(mtmp));
            } else if (nlev == depth(u.uz)) {
                if (vismon)
                    pline_mon(mtmp, _("%s shudders for a moment."), Monnam(mtmp));
            } else {
                get_level(flev, nlev);
                migrate_to_level(mtmp, ledger_no(flev), MIGR_RANDOM,
                                 null);
            }
        } else {
            m_tele(mtmp, vismon, oseen, SCR_TELEPORTATION);
        }
        /* m_tele() handles makeknown(); trycall() will be a no-op when
           otmp->otyp is already discovered */
        if (otmp.dknown && iflags.last_msg != PLNMSG_enum)
            trycall(otmp);
        /* already removed from mtmp->minvent so not 'm_useup(mtmp, otmp)' */
        obfree(otmp, null);
        return 2;
    }
    case MUSE_WAN_DIGGING:
        if (!otmp)
            panic(MissingDefensiveItem, _("wand of digging"));
        if ((fleetim && !mtmp.iswiz)) { monflee(mtmp, fleetim, FALSE, FALSE); };
        mzapwand(mtmp, otmp, FALSE);
        if (oseen)
            makeknown(WAN_DIGGING);
        if (IS_FURNITURE(levl()[mtmp.mx][mtmp.my].typ)
            || IS_DRAWBRIDGE(levl()[mtmp.mx][mtmp.my].typ)
            || (is_drawbridge_wall(mtmp.mx, mtmp.my) >= 0)
            || stairway_at(mtmp.mx, mtmp.my)) {
            pline_The(_("digging ray is ineffective."));
            return 2;
        }
        if (!Can_dig_down(u.uz) && !levl()[mtmp.mx][mtmp.my].candig) {
            /* can't dig further if there's already a pit (or other trap)
               here, or if pit creation fails for some reason */
            if (t_at(mtmp.mx, mtmp.my)
                || !(t = maketrap(mtmp.mx, mtmp.my, PIT))) {
                if (vismon) {
                    pline_The(_("%s here is too hard to dig in."),
                              surface(mtmp.mx, mtmp.my));
                }
                return 2;
            }
            /* pit creation succeeded */
            if (vis) {
                seetrap(t);
                pline_mon(mtmp, _("%s has made a pit in the %s."), Monnam(mtmp),
                      surface(mtmp.mx, mtmp.my));
            }
            fill_pit(mtmp.mx, mtmp.my);
            recalc_block_point(mtmp.mx, mtmp.my);
            return (mintrap(mtmp, FORCEBUNGLE) == Trap_Killed_Mon) ? 1 : 2;
        }
        t = maketrap(mtmp.mx, mtmp.my, HOLE);
        if (!t)
            return 2;
        recalc_block_point(mtmp.mx, mtmp.my);
        seetrap(t);
        if (vis) {
            pline_mon(mtmp, _("%s has made a hole in the %s."), Monnam(mtmp),
                  surface(mtmp.mx, mtmp.my));
            pline_mon(mtmp, _("%s %s through..."), Monnam(mtmp),
                  is_flyer(mtmp.data) ? _("dives") : _("falls"));
        } else if (!Deaf()) {
             ;
            You_hear(_("%s crash through the %s."), something(),
                     surface(mtmp.mx, mtmp.my));
        }
        fill_pit(mtmp.mx, mtmp.my);
        /* we made sure that there is a level for mtmp to go to */
        migrate_to_level(mtmp, ledger_no(u.uz) + 1, MIGR_RANDOM,
                         null);
        return 2;
    case MUSE_WAN_UNDEAD_TURNING:
        if (!otmp)
            panic(MissingDefensiveItem, _("wand of undead turning"));
        gz.zap_oseen = oseen;
        mzapwand(mtmp, otmp, FALSE);
        gm.m_using = TRUE;
        mbhit(mtmp, rn1(8, 6), mbhitm, bhito, otmp);
        gm.m_using = FALSE;
        return 2;
    case MUSE_WAN_CREATE_MONSTER: {
        let cc = stack_struct(struct_nhcoord);
        let mon;
        /* pm: 0 => random, eel => aquatic, croc => amphibious */
        let pm = !is_pool(mtmp.mx, mtmp.my) ? null
                            : mons[u.uinwater ? PM_GIANT_EEL : PM_CROCODILE];

        if (!otmp)
            panic(MissingDefensiveItem, _("wand of create monster"));
        if (!enexto(cc, mtmp.mx, mtmp.my, pm))
            return 0;
        mzapwand(mtmp, otmp, FALSE);
        mon = makemon(null, cc.x, cc.y, NO_MM_FLAGS);
        if (mon && canspotmon(mon) && oseen)
            makeknown(WAN_CREATE_MONSTER);
        return 2;
    }
    case MUSE_SCR_CREATE_MONSTER: {
        let cc = stack_struct(struct_nhcoord);
        let pm = null, fish = null;
        let cnt = 1;
        let mon;
        let known = FALSE;

        if (!otmp)
            panic(MissingDefensiveItem, _("scroll of create monster"));
        if (!rn2(73))
            cnt += rnd(4);
        if (mtmp.mconf || otmp.cursed)
            cnt += 12;
        if (mtmp.mconf)
            pm = fish = mons[PM_ACID_BLOB];
        else if (is_pool(mtmp.mx, mtmp.my))
            fish = mons[u.uinwater ? PM_GIANT_EEL : PM_CROCODILE];
        mreadmsg(mtmp, otmp);
        while (cnt--) {
            /* `fish' potentially gives bias towards water locations;
               `pm' is what to actually create (0 => random) */
            if (!enexto(cc, mtmp.mx, mtmp.my, fish))
                break;
            mon = makemon(pm, cc.x, cc.y, NO_MM_FLAGS);
            if (mon && canspotmon(mon))
                known = TRUE;
        }
        /* The only case where we don't use oseen.  For wands, you
         * have to be able to see the monster zap the wand to know
         * what type it is.  For teleport scrolls, you have to see
         * the monster to know it teleported.
         */
        if (known)
            makeknown(SCR_CREATE_MONSTER);
        else
            trycall(otmp);
        m_useup(mtmp, otmp);
        return 2;
    }
    case MUSE_TRAPDOOR:
        /* trap doors on "bottom" levels of dungeons are rock-drop
         * trap doors, not holes in the floor.  We check here for
         * safety.
         */
        if (Is_botlevel(u.uz))
            return 0;
        if ((fleetim && !mtmp.iswiz)) { monflee(mtmp, fleetim, FALSE, FALSE); };
        t = t_at(gt.trapx, gt.trapy);
        if (vis) {
            pline_mon(mtmp, _("%s %s into a %s!"), Monnam(mtmp),
                  vtense(fakename()[0], locomotion(mtmp.data, _("jump"))),
                  trapname(t.ttyp, FALSE));
        }
        /* if trap was in a concealed niche, it's no longer concealed */
        reveal_trap(t, vis);

        /*  don't use rloc_to() because worm tails must "move" */
        remove_monster(mtmp.mx, mtmp.my);
        newsym(mtmp.mx, mtmp.my); /* update old location */
        place_monster(mtmp, gt.trapx, gt.trapy);
        if (mtmp.wormno)
            worm_move(mtmp);
        newsym(gt.trapx, gt.trapy);

        migrate_to_level(mtmp, ledger_no(u.uz) + 1, MIGR_RANDOM,
                         null);
        return 2;
    case MUSE_UPSTAIRS:
        if ((fleetim && !mtmp.iswiz)) { monflee(mtmp, fleetim, FALSE, FALSE); };
        stway = stairway_at(mtmp.mx, mtmp.my);
        if (!stway)
            return 0;
        if (ledger_no(u.uz) == 1)
            /* impossible; level 1 upstairs are SSTAIRS */
            return mon_escape(mtmp, vismon);
        if (Inhell() && mon_has_amulet(mtmp) && !rn2(4)
            && (dunlev(u.uz) < dunlevs_in_dungeon(u.uz) - 3)) {
            if (vismon)
                pline(_("As %s climbs the stairs, a mysterious force" +
                      " momentarily surrounds %s..."),
                      mon_nam(mtmp), mhim(mtmp));
            /* simpler than for the player; this will usually be
               the Wizard and he'll immediately go right to the
               upstairs, so there's not much point in having any
               chance for a random position on the current level */
            migrate_to_level(mtmp, ledger_no(u.uz) + 1, MIGR_RANDOM,
                             null);
        } else {
            if (vismon)
                pline_mon(mtmp, _("%s escapes upstairs!"), Monnam(mtmp));
            migrate_to_level(mtmp, ledger_no(stway.tolev),
                             MIGR_STAIRS_DOWN, null);
        }
        return 2;
    case MUSE_DOWNSTAIRS:
        if ((fleetim && !mtmp.iswiz)) { monflee(mtmp, fleetim, FALSE, FALSE); };
        stway = stairway_at(mtmp.mx, mtmp.my);
        if (!stway)
            return 0;
        if (vismon)
            pline_mon(mtmp, _("%s escapes downstairs!"), Monnam(mtmp));
        migrate_to_level(mtmp, ledger_no(stway.tolev), MIGR_STAIRS_UP,
                         null);
        return 2;
    case MUSE_UP_LADDER:
        if ((fleetim && !mtmp.iswiz)) { monflee(mtmp, fleetim, FALSE, FALSE); };
        stway = stairway_at(mtmp.mx, mtmp.my);
        if (!stway)
            return 0;
        if (vismon)
            pline_mon(mtmp, _("%s escapes up the ladder!"), Monnam(mtmp));
        migrate_to_level(mtmp, ledger_no(stway.tolev), MIGR_LADDER_DOWN,
                         null);
        return 2;
    case MUSE_DN_LADDER:
        if ((fleetim && !mtmp.iswiz)) { monflee(mtmp, fleetim, FALSE, FALSE); };
        stway = stairway_at(mtmp.mx, mtmp.my);
        if (!stway)
            return 0;
        if (vismon)
            pline_mon(mtmp, _("%s escapes down the ladder!"), Monnam(mtmp));
        migrate_to_level(mtmp, ledger_no(stway.tolev), MIGR_LADDER_UP,
                         null);
        return 2;
    case MUSE_SSTAIRS:
        if ((fleetim && !mtmp.iswiz)) { monflee(mtmp, fleetim, FALSE, FALSE); };
        stway = stairway_at(mtmp.mx, mtmp.my);
        if (!stway)
            return 0;
        if (ledger_no(u.uz) == 1) {
            return mon_escape(mtmp, vismon);
        }
        if (vismon)
            pline_mon(mtmp, _("%s escapes %sstairs!"), Monnam(mtmp),
                  stway.up ? _("up") : _("down"));
        /* going from the Valley to Castle (Stronghold) has no sstairs
           to target, but having gs.sstairs.<sx,sy> == <0,0> will work the
           same as specifying MIGR_RANDOM when mon_arrive() eventually
           places the monster, so we can use MIGR_SSTAIRS unconditionally */
        migrate_to_level(mtmp, ledger_no(stway.tolev), MIGR_SSTAIRS,
                         null);
        return 2;
    case MUSE_TELEPORT_TRAP:
        if ((fleetim && !mtmp.iswiz)) { monflee(mtmp, fleetim, FALSE, FALSE); };
        t = t_at(gt.trapx, gt.trapy);
        if (vis) {
            pline_mon(mtmp, _("%s %s onto a %s!"), Monnam(mtmp),
                  vtense(fakename()[0], locomotion(mtmp.data, _("jump"))),
                  trapname(t.ttyp, FALSE));
        }
        /* if trap was in a concealed niche, it's no longer concealed */
        reveal_trap(t, vis);
        /*  don't use rloc_to() because worm tails must "move" */
        remove_monster(mtmp.mx, mtmp.my);
        newsym(mtmp.mx, mtmp.my); /* update old location */
        place_monster(mtmp, gt.trapx, gt.trapy);
        if (mtmp.wormno)
            worm_move(mtmp);
        maybe_unhide_at(mtmp.mx, mtmp.my);
        newsym(gt.trapx, gt.trapy);
        /* 0: 'no object' rather than STRANGE_OBJECT; FALSE: obj not seen */
        m_tele(mtmp, vismon, FALSE, 0);
        return 2;
    case MUSE_POT_HEALING:
        if (!otmp)
            panic(MissingDefensiveItem, _("potioh of healing"));
        mquaffmsg(mtmp, otmp);
        i = d(6 + 2 * bcsign(otmp), 4);
        healmon(mtmp, i, 1);
        if (!otmp.cursed && !mtmp.mcansee)
            mcureblindness(mtmp, vismon);
        if (vismon)
            pline_mon(mtmp, _("%s looks better."), Monnam(mtmp));
        if (oseen)
            makeknown(POT_HEALING);
        m_useup(mtmp, otmp);
        return 2;
    case MUSE_POT_EXTRA_HEALING:
        if (!otmp)
            panic(MissingDefensiveItem, _("potioh of extra healing"));
        mquaffmsg(mtmp, otmp);
        i = d(6 + 2 * bcsign(otmp), 8);
        healmon(mtmp, i, otmp.blessed ? 5 : 2);
        if (!mtmp.mcansee)
            mcureblindness(mtmp, vismon);
        if (vismon)
            pline_mon(mtmp, _("%s looks much better."), Monnam(mtmp));
        if (oseen)
            makeknown(POT_EXTRA_HEALING);
        m_useup(mtmp, otmp);
        return 2;
    case MUSE_POT_FULL_HEALING:
        if (!otmp)
            panic(MissingDefensiveItem, _("potioh of full healing"));
        mquaffmsg(mtmp, otmp);
        if (otmp.otyp == POT_SICKNESS)
            unbless(otmp); /* Pestilence */
        healmon(mtmp, mtmp.mhpmax, otmp.blessed ? 8 : 4);
        if (!mtmp.mcansee && otmp.otyp != POT_SICKNESS)
            mcureblindness(mtmp, vismon);
        if (vismon)
            pline_mon(mtmp, _("%s looks completely healed."), Monnam(mtmp));
        if (oseen)
            makeknown(otmp.otyp);
        m_useup(mtmp, otmp);
        return 2;
    case MUSE_LIZARD_CORPSE:
        if (!otmp)
            panic(MissingDefensiveItem, _("lizard corpse"));
        /* not actually called for its unstoning effect */
        mon_consume_unstone(mtmp, otmp, FALSE, FALSE);
        return 2;
    case 0:
        return 0; /* i.e. an exploded wand */
    default:
        impossible(_("%s wanted to perform action %d?"), Monnam(mtmp),
                   gm.m.has_defense);
        break;
    }
    return 0;
    } finally { stack_pop($frame); }
}

export function rnd_defensive_item(mtmp) { /* int */
    var pm = mtmp.data;
    var difficulty = mons[monsndx(pm)].difficulty;
    var trycnt = 0;

    if (is_animal(pm) || attacktype(pm, AT_EXPL) || mindless(mtmp.data)
        || pm.mlet == S_GHOST || pm.mlet == S_KOP)
        return 0;
 try_again: for (;;) {
    switch (rn2(8 + +(difficulty > 3) + +(difficulty > 6) + +(difficulty > 8))) {
    case 6:
    case 9:
        if (noteleport_level(mtmp) && ++trycnt < 2)
            continue try_again;;
        if (!rn2(3))
            return WAN_TELEPORTATION;
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case 0:
    case 1:
        return SCR_TELEPORTATION;
    case 8:
    case 10:
        if (!rn2(3))
            return WAN_CREATE_MONSTER;
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case 2:
        return SCR_CREATE_MONSTER;
    case 3:
        return POT_HEALING;
    case 4:
        return POT_EXTRA_HEALING;
    case 5:
        return (mtmp.data != mons[PM_PESTILENCE]) ? POT_FULL_HEALING
                                                    : POT_SICKNESS;
    case 7: /* wand of digging */
        /* usually avoid digging in Sokoban */
        if (Sokoban() && rn2(4))
            continue try_again;;
        /* some creatures shouldn't dig down to another level when hurt */
        if (is_floater(pm) || mtmp.isshk || mtmp.isgd || mtmp.ispriest)
            return 0;
        return WAN_DIGGING;
    } break; }
    /*NOTREACHED*/
    return 0;
}

export const MUSE_WAN_DEATH = 1;
export const MUSE_WAN_SLEEP = 2;
export const MUSE_WAN_FIRE = 3;
export const MUSE_WAN_COLD = 4;
export const MUSE_WAN_LIGHTNING = 5;
export const MUSE_WAN_MAGIC_MISSILE = 6;
export const MUSE_WAN_STRIKING = 7;

export const MUSE_POT_PARALYSIS = 9;
export const MUSE_POT_BLINDNESS = 10;
export const MUSE_POT_CONFUSION = 11;
export const MUSE_FROST_HORN = 12;
export const MUSE_FIRE_HORN = 13;
export const MUSE_POT_ACID = 14;
export const MUSE_WAN_TELEPORTATION = 15;
export const MUSE_POT_SLEEPING = 16;
export const MUSE_SCR_EARTH = 17;
export const MUSE_CAMERA = 18;
/*#define MUSE_WAN_UNDEAD_TURNING 20*/ /* also a defensive item so don't
                                     * redefine; nonconsecutive value is ok */

function linedup_chk_corpse(x, y) { /* boolean */
    return +(sobj_at(CORPSE, x, y) != null);
}

function m_use_undead_turning(mtmp, obj) { /* void */
    let ax = u.ux + sgn(mtmp.mux - mtmp.mx) * 3,
            ay = u.uy + sgn(mtmp.muy - mtmp.my) * 3;
    let bx = mtmp.mx, by = mtmp.my;

    if (!(obj.otyp == WAN_UNDEAD_TURNING && obj.spe > 0))
        return;

    /* not necrophiliac(); unlike deciding whether to pick this
       type of wand up, we aren't interested in corpses within
       carried containers until they're moved into open inventory;
       we don't check whether hero is poly'd into an undead--the
       wand's turning effect is too weak to be a useful direct
       attack--only whether hero is carrying at least one corpse */
    if (carrying(CORPSE)
        /*
         * If hero is carrying one or more corpses but isn't wielding
         * a cockatrice corpse (unless being hit by one won't do
         * the monster much harm); otherwise we'd be using this wand
         * as a defensive item with higher priority.
         *
         * Might be cockatrice intended as a weapon (or being denied
         * to glove-wearing monsters for use as a weapon) or lizard
         * intended as a cure or lichen intended as veggy food or
         * sacrifice fodder being lugged to an altar.  Zapping with
         * this will deprive hero of one from each stack although
         * they might subsequently be recovered after killing again.
         * In the sacrifice fodder case, it could even be to the
         * player's advantage (fresher corpse if a new one gets
         * dropped; player might not choose to spend a wand charge
         * on that when/if hero acquires this wand).
         */
        || linedup_callback(ax, ay, bx, by, linedup_chk_corpse)
        /* or there's a corpse on the ground in a direct line from the
           monster to the hero, and up to 3 steps beyond. */
        ) {
        gm.m.offensive = obj;
        gm.m.has_offense = MUSE_WAN_UNDEAD_TURNING;
    }
}

/* from monster's point of view, is hero behind a chokepoint? */
function hero_behind_chokepoint(mtmp) { /* boolean */
    const $frame = stack_frame(); try {
    let dx = sgn(mtmp.mx - mtmp.mux);
    let dy = sgn(mtmp.my - mtmp.muy);

    let x = mtmp.mux + dx;
    let y = mtmp.muy + dy;

    let dir = xytodir(dx, dy);
    let dir_l = DIR_CLAMP(DIR_LEFT2(dir));
    let dir_r = DIR_CLAMP(DIR_RIGHT2(dir));

    let c1 = stack_struct(struct_nhcoord), c2 = stack_struct(struct_nhcoord);

    dirtocoord(c1, dir_l);
    dirtocoord(c2, dir_r);
    c1.x += x, c2.x += x;
    c1.y += y, c2.y += y;

    if ((!isok(c1.x, c1.y) || !accessible(c1.x, c1.y))
        && (!isok(c2.x, c2.y) || !accessible(c2.x, c2.y)))
        return TRUE;
    return FALSE;
    } finally { stack_pop($frame); }
}

/* hostile monster has another hostile next to it */
function mon_has_friends(mtmp) { /* boolean */
    let dx, dy;
    let mon2;

    if (mtmp.mtame || mtmp.mpeaceful)
        return FALSE;

    for (dx = -1; dx <= 1; dx++)
        for (dy = -1; dy <= 1; dy++) {
            let x = mtmp.mx + dx;
            let y = mtmp.my + dy;

            if (isok(x, y) && (mon2 = m_at(x, y)) != null
                && mon2 != mtmp
                && !mon2.mtame && !mon2.mpeaceful)
                return TRUE;
        }

    return FALSE;
}

/* does monster like object pile at x,y? */
function mon_likes_objpile_at(mtmp, x, y) { /* boolean */
    let i;
    let otmp;

    if (!isok(x,y) || !OBJ_AT(x,y))
        return FALSE;

    /* monster likes any of the top 3 items in the pile? */
    for (i = 0, otmp = svl.level.objects[x][y]; otmp && i < 3; i++) {
        if (mon_would_take_item(mtmp, otmp))
            return TRUE;
        otmp = otmp.v.v_nexthere;
    }

    /* pile is larger than 3 stacks? */
    if (i >= 3)
        return TRUE;

    return FALSE;
}

/* Select an offensive item/action for a monster.  Returns TRUE iff one is
 * found.
 */
export function find_offensive(mtmp) { /* boolean */
    let obj, mtmp_helmet;
    let reflection_skip;

    gm.m.offensive = null;
    gm.m.has_offense = 0;
    if (mtmp.mpeaceful || is_animal(mtmp.data) || mindless(mtmp.data)
        || nohands(mtmp.data))
        return FALSE;
    if (u.uswallow)
        return FALSE;
    if (in_your_sanctuary(mtmp, 0, 0))
        return FALSE;
    if (dmgtype(mtmp.data, AD_HEAL)
        && !uwep && !uarmu && !uarm && !uarmh
        && !uarms && !uarmg && !uarmc && !uarmf)
        return FALSE;
    /* all offensive items require orthogonal or diagonal targeting */
    if (!lined_up(mtmp))
        return FALSE;

    reflection_skip = (((mtmp).seen_resistance & (M_SEEN_REFL)) != 0
                       || monnear(mtmp, mtmp.mux, mtmp.muy) ? 1 : 0);
    mtmp_helmet = which_armor(mtmp, W_ARMH);
    /* this picks the last viable item rather than prioritizing choices */
    for (obj = mtmp.minvent; obj; obj = obj.nobj) {
        if (!reflection_skip) {
            if ((gm.m.has_offense == MUSE_WAN_DEATH)) continue;
            if (obj.otyp == WAN_DEATH && obj.spe > 0
                && !((mtmp).seen_resistance & (M_SEEN_MAGR))) {
                gm.m.offensive = obj;
                gm.m.has_offense = MUSE_WAN_DEATH;
            }
            if ((gm.m.has_offense == MUSE_WAN_SLEEP)) continue;
            if (obj.otyp == WAN_SLEEP && obj.spe > 0 && gm.multi >= 0
                && !((mtmp).seen_resistance & (M_SEEN_SLEEP))) {
                gm.m.offensive = obj;
                gm.m.has_offense = MUSE_WAN_SLEEP;
            }
            if ((gm.m.has_offense == MUSE_WAN_FIRE)) continue;
            if (obj.otyp == WAN_FIRE && obj.spe > 0
                && !((mtmp).seen_resistance & (M_SEEN_FIRE))) {
                gm.m.offensive = obj;
                gm.m.has_offense = MUSE_WAN_FIRE;
            }
            if ((gm.m.has_offense == MUSE_FIRE_HORN)) continue;
            if (obj.otyp == FIRE_HORN && obj.spe > 0 && can_blow(mtmp)
                && !((mtmp).seen_resistance & (M_SEEN_FIRE))) {
                gm.m.offensive = obj;
                gm.m.has_offense = MUSE_FIRE_HORN;
            }
            if ((gm.m.has_offense == MUSE_WAN_COLD)) continue;
            if (obj.otyp == WAN_COLD && obj.spe > 0
                && !((mtmp).seen_resistance & (M_SEEN_COLD))) {
                gm.m.offensive = obj;
                gm.m.has_offense = MUSE_WAN_COLD;
            }
            if ((gm.m.has_offense == MUSE_FROST_HORN)) continue;
            if (obj.otyp == FROST_HORN && obj.spe > 0 && can_blow(mtmp)
                && !((mtmp).seen_resistance & (M_SEEN_COLD))) {
                gm.m.offensive = obj;
                gm.m.has_offense = MUSE_FROST_HORN;
            }
            if ((gm.m.has_offense == MUSE_WAN_LIGHTNING)) continue;
            if (obj.otyp == WAN_LIGHTNING && obj.spe > 0
                && !((mtmp).seen_resistance & (M_SEEN_ELEC))) {
                gm.m.offensive = obj;
                gm.m.has_offense = MUSE_WAN_LIGHTNING;
            }
            if ((gm.m.has_offense == MUSE_WAN_MAGIC_MISSILE)) continue;
            if (obj.otyp == WAN_MAGIC_MISSILE && obj.spe > 0
                && !((mtmp).seen_resistance & (M_SEEN_MAGR))) {
                gm.m.offensive = obj;
                gm.m.has_offense = MUSE_WAN_MAGIC_MISSILE;
            }
        }
        if ((gm.m.has_offense == MUSE_WAN_UNDEAD_TURNING)) continue;
        m_use_undead_turning(mtmp, obj);
        if ((gm.m.has_offense == MUSE_WAN_STRIKING)) continue;
        if (obj.otyp == WAN_STRIKING && obj.spe > 0
            && !((mtmp).seen_resistance & (M_SEEN_MAGR))) {
            gm.m.offensive = obj;
            gm.m.has_offense = MUSE_WAN_STRIKING;
        }
        if ((gm.m.has_offense == MUSE_WAN_TELEPORTATION)) continue;
        if (obj.otyp == WAN_TELEPORTATION && obj.spe > 0
            /* don't give controlled hero a free teleport */
            && !Teleport_control()
            /* same hack as MUSE_WAN_TELEPORTATION_SELF */
            && (!noteleport_level(mtmp)
                || !mon_knows_traps(mtmp, TELEP_TRAP))
            /* do try to move hero to a more vulnerable spot */
            && (onscary(u.ux, u.uy, mtmp)
                || (hero_behind_chokepoint(mtmp) && mon_has_friends(mtmp))
                || mon_likes_objpile_at(mtmp, u.ux, u.uy)
                || stairway_at(u.ux, u.uy))) {
            gm.m.offensive = obj;
            gm.m.has_offense = MUSE_WAN_TELEPORTATION;
        }
        if ((gm.m.has_offense == MUSE_POT_PARALYSIS)) continue;
        if (obj.otyp == POT_PARALYSIS && gm.multi >= 0) {
            gm.m.offensive = obj;
            gm.m.has_offense = MUSE_POT_PARALYSIS;
        }
        if ((gm.m.has_offense == MUSE_POT_BLINDNESS)) continue;
        if (obj.otyp == POT_BLINDNESS && !attacktype(mtmp.data, AT_GAZE)) {
            gm.m.offensive = obj;
            gm.m.has_offense = MUSE_POT_BLINDNESS;
        }
        if ((gm.m.has_offense == MUSE_POT_CONFUSION)) continue;
        if (obj.otyp == POT_CONFUSION) {
            gm.m.offensive = obj;
            gm.m.has_offense = MUSE_POT_CONFUSION;
        }
        if ((gm.m.has_offense == MUSE_POT_SLEEPING)) continue;
        if (obj.otyp == POT_SLEEPING
            && !((mtmp).seen_resistance & (M_SEEN_SLEEP))) {
            gm.m.offensive = obj;
            gm.m.has_offense = MUSE_POT_SLEEPING;
        }
        if ((gm.m.has_offense == MUSE_POT_ACID)) continue;
        if (obj.otyp == POT_ACID
            && !((mtmp).seen_resistance & (M_SEEN_ACID))) {
            gm.m.offensive = obj;
            gm.m.has_offense = MUSE_POT_ACID;
        }
        /* we can safely put this scroll here since the locations that
         * are in a 1 square radius are a subset of the locations that
         * are in wand or throwing range (in other words, always lined_up())
         */
        if ((gm.m.has_offense == MUSE_SCR_EARTH)) continue;
        if (obj.otyp == SCR_EARTH
            && (hard_helmet(mtmp_helmet) || mtmp.mconf
                || amorphous(mtmp.data) || passes_walls(mtmp.data)
                || noncorporeal(mtmp.data) || unsolid(mtmp.data)
                || !rn2(10))
            && dist2(mtmp.mx, mtmp.my, mtmp.mux, mtmp.muy) <= 2
            && mtmp.mcansee && haseyes(mtmp.data)
            && !Is_rogue_level(u.uz)
            && (!In_endgame(u.uz) || Is_earthlevel(u.uz))) {
            gm.m.offensive = obj;
            gm.m.has_offense = MUSE_SCR_EARTH;
        }
        if ((gm.m.has_offense == MUSE_CAMERA)) continue;
        if (obj.otyp == EXPENSIVE_CAMERA
            && ((!Blind() && !resists_blnd(gy.youmonst))
                || hates_light(gy.youmonst.data))
            && dist2(mtmp.mx, mtmp.my, mtmp.mux, mtmp.muy) <= 2
            && obj.spe > 0 && !rn2(6)) {
            gm.m.offensive = obj;
            gm.m.has_offense = MUSE_CAMERA;
        }
    /* #if 0: not in this build */
    }
    return (+!!gm.m.has_offense);
}

function mbhitm(mtmp, otmp) { /* int */
    let tmp;
    let reveal_invis = FALSE, learnit = FALSE,
            hits_you = +(mtmp == gy.youmonst);

    if (!hits_you && otmp.otyp != WAN_UNDEAD_TURNING) {
        mtmp.msleeping = 0;
        if (mtmp.m_ap_type)
            seemimic(mtmp);
    }
    switch (otmp.otyp) {
    case WAN_STRIKING:
        reveal_invis = TRUE;
        if (hits_you) {
            if (Antimagic()) {
                monstseesu(M_SEEN_MAGR); /* monsters notice hero resisting */
                shieldeff(u.ux, u.uy);
                 ;
                pline(_("Boing!"));
                learnit = TRUE;
            } else if (rnd(20) < 10 + u.uac &&
                       !(gb.buzzer && !gb.buzzer.mwandexp)) {
                monstunseesu(M_SEEN_MAGR); /* mons see hero not resisting */
                pline_The(_("wand hits you!"));
                tmp = d(2, 12);
                if (Half_spell_damage())
                    tmp = Math.trunc((tmp + 1) / 2);
                losehp(tmp, _("wand"), KILLED_BY_AN);
                learnit = TRUE;
            } else {
                pline_The(_("wand misses you."));
            }
            stop_occupation();
            nomul(0);
        } else if (resists_magm(mtmp)) {
            shieldeff(mtmp.mx, mtmp.my);
             ;
            pline(_("Boing!"));
            learnit = TRUE;
        } else if (rnd(20) < 10 + find_mac(mtmp)) {
            tmp = d(2, 12);
            hit(_("wand"), mtmp, exclam(tmp));
            resist(mtmp, otmp.oclass, tmp, TELL);
            learnit = TRUE;
        } else {
            miss(_("wand"), mtmp);
        }
        /* need to see the wand being zapped and also the spot where the
           target is hit; don't have to see the target itself though */
        if (learnit && gz.zap_oseen && (hits_you
                                        || cansee(mtmp.mx, mtmp.my)))
            makeknown(WAN_STRIKING);
        break;
    case WAN_TELEPORTATION:
        if (hits_you) {
            tele();
            if (gz.zap_oseen)
                makeknown(WAN_TELEPORTATION);
        } else {
            /* for consistency with zap.c, don't identify */
            if (mtmp.ispriest && chars[in_rooms(mtmp.mx, mtmp.my, TEMPLE)]) {
                if (cansee(mtmp.mx, mtmp.my))
                    pline_mon(mtmp, _("%s resists the magic!"), Monnam(mtmp));
            } else if (!tele_restrict(mtmp))
                rloc(mtmp, RLOC_MSG);
        }
        break;
    case WAN_CANCELLATION:
    case SPE_CANCELLATION:
        cancel_monst(mtmp, otmp, FALSE, TRUE, FALSE);
        break;
    case WAN_UNDEAD_TURNING:
        if (hits_you) {
            unturn_you();
            learnit = gz.zap_oseen;
        } else {
            let wake = FALSE;

            if (unturn_dead(mtmp)) /* affects mtmp's invent, not mtmp */
                wake = TRUE;
            if (is_undead(mtmp.data) || is_vampshifter(mtmp)) {
                wake = reveal_invis = TRUE;
                /* context.bypasses=True: if resist() happens to be fatal,
                   make_corpse() will set obj->bypass on the new corpse
                   so that mbhito() will skip it instead of reviving it */
                svc.context.bypasses = TRUE; /* for make_corpse() */
                resist(mtmp, WAND_CLASS, rnd(8), NOTELL);
            }
            if (wake) {
                if (!DEADMONSTER(mtmp))
                    wakeup(mtmp, FALSE);
                learnit = gz.zap_oseen;
            }
        }
        if (learnit)
            makeknown(WAN_UNDEAD_TURNING);
        break;
    default:
        break;
    }
    if (reveal_invis && !DEADMONSTER(mtmp)
        && cansee(gb.bhitpos.x, gb.bhitpos.y) && !canspotmon(mtmp))
        map_invisible(gb.bhitpos.x, gb.bhitpos.y);

    return 0;
}

/* hit all objects at x,y with fhito function */
function fhito_loc(obj,
          tx, ty,
          fhito) { /* boolean */
    let otmp, next_obj;
    let hitanything = 0;

    if (!fhito || !OBJ_AT(tx, ty))
        return FALSE;

    for (otmp = svl.level.objects[tx][ty]; otmp; otmp = next_obj) {
        next_obj = otmp.v.v_nexthere;

        if (otmp.where != OBJ_FLOOR || otmp.ox != tx || otmp.oy != ty)
            continue;
        hitanything += fhito(otmp, obj);
    }

    return hitanything ? TRUE : FALSE;
}

/* A modified bhit() for monsters.  Based on bhit() in zap.c.  Unlike
 * buzz(), bhit() doesn't take into account the possibility of a monster
 * zapping you, so we need a special function for it.  (Unless someone wants
 * to merge the two functions...)
 */
function mbhit(
    mon,
    range,
    fhitm,
    fhito,
    obj) { /* void */ /* 2nd arg to fhitm/fhito */
    const $frame = stack_frame(); try {
    let mtmp;
    let ltyp;
    let ddx, ddy, otyp = obj.otyp;

    gb.bhitpos.x = mon.mx;
    gb.bhitpos.y = mon.my;
    ddx = sgn(mon.mux - mon.mx);
    ddy = sgn(mon.muy - mon.my);

    while (range-- > 0) {
        let x, y, dbx = stack_var(coordxy), dby = stack_var(coordxy);

        gb.bhitpos.x += ddx;
        gb.bhitpos.y += ddy;
        x = gb.bhitpos.x;
        y = gb.bhitpos.y;

        if (!isok(x, y)) {
            gb.bhitpos.x -= ddx;
            gb.bhitpos.y -= ddy;
            break;
        }
        if (u_at(gb.bhitpos.x, gb.bhitpos.y)) {
            fhitm(gy.youmonst, obj);
            range -= 3;
        } else if ((mtmp = m_at(gb.bhitpos.x, gb.bhitpos.y)) != null) {
            if (cansee(gb.bhitpos.x, gb.bhitpos.y) && !canspotmon(mtmp))
                map_invisible(gb.bhitpos.x, gb.bhitpos.y);
            fhitm(mtmp, obj);
            range -= 3;
        }
        if (fhito_loc(obj, gb.bhitpos.x, gb.bhitpos.y, fhito))
            range--;
        ltyp = uchar(levl()[gb.bhitpos.x][gb.bhitpos.y].typ);
        dbx[0] = x, dby[0] = y;
        if (otyp == WAN_STRIKING
            /* if levl[x][y].typ is DRAWBRIDGE_UP then the zap is passing
               over the moat in front of a closed drawbridge and doesn't
               hit any part of the bridge's mechanism (yet; it might be
               about to hit the closed portcullis on the next iteration) */
            && ltyp != DRAWBRIDGE_UP && find_drawbridge(dbx, dby)) {
            /* this might kill mon and destroy obj but they'll remain
               accessible; (*fhitm)() and (*fhito)() use obj for zap type */
            destroy_drawbridge(dbx[0], dby[0]);
        } else if (IS_DOOR(ltyp) || ltyp == SDOOR) {
            switch (otyp) {
            /* note: monsters don't use opening or locking magic
               at present, but keep these as placeholders */
            case WAN_OPENING:
            case WAN_LOCKING:
            case WAN_STRIKING:
                if (doorlock(obj, gb.bhitpos.x, gb.bhitpos.y)) {
                    if (gz.zap_oseen)
                        makeknown(otyp);
                    /* if a shop door gets broken, add it to
                       the shk's fix list (no cost to player) */
                    if (levl()[gb.bhitpos.x][gb.bhitpos.y].flags == D_BROKEN
                        && chars[in_rooms(gb.bhitpos.x, gb.bhitpos.y, SHOPBASE)])
                        add_damage(gb.bhitpos.x, gb.bhitpos.y, 0);
                }
                break;
            }
        }
        if (!ZAP_POS(ltyp)
            || (IS_DOOR(ltyp) && (levl()[gb.bhitpos.x][gb.bhitpos.y].flags
                                  & (D_LOCKED | D_CLOSED)))) {
            gb.bhitpos.x -= ddx;
            gb.bhitpos.y -= ddy;
            break;
        }
    }
    } finally { stack_pop($frame); }
}

function buzz_force_miss(type, nd, sx, sy, dx, dy) { /* void */
    dobuzz(type, nd, sx, sy, dx, dy, TRUE, FALSE, TRUE);
}

/* Perform an offensive action for a monster.  Must be called immediately
 * after find_offensive().  Return values are same as use_defensive().
 */
export function use_offensive(mtmp) { /* int */
    let i;
    let otmp = gm.m.offensive;
    let oseen;

    /* if a monster has never used an attack wand before, it takes them some
       time to get used to holding that much power, so the first shot always
       misses */
    let buzzfn = mtmp.mwandexp ? buzz : buzz_force_miss;

    /* offensive potions are not drunk, they're thrown */
    if (otmp.oclass != POTION_CLASS && (i = precheck(mtmp, otmp)) != 0)
        return i;
    oseen = canseemon(mtmp);

    switch (gm.m.has_offense) {
    case MUSE_WAN_DEATH:
    case MUSE_WAN_SLEEP:
    case MUSE_WAN_FIRE:
    case MUSE_WAN_COLD:
    case MUSE_WAN_LIGHTNING:
    case MUSE_WAN_MAGIC_MISSILE:
        mzapwand(mtmp, otmp, FALSE);
        if (oseen)
            makeknown(otmp.otyp);
        gm.m_using = TRUE;
        gc.current_wand = otmp;
        gb.buzzer = mtmp;
        buzzfn(BZ_M_WAND(BZ_OFS_WAN(otmp.otyp)),
               (otmp.otyp == WAN_MAGIC_MISSILE) ? 2 : 6, mtmp.mx, mtmp.my,
               sgn(mtmp.mux - mtmp.mx), sgn(mtmp.muy - mtmp.my));
        gb.buzzer = null;
        gc.current_wand = null;
        gm.m_using = FALSE;
        mtmp.mwandexp = TRUE;
        return DEADMONSTER(mtmp) ? 1 : 2;
    case MUSE_FIRE_HORN:
    case MUSE_FROST_HORN:
        mplayhorn(mtmp, otmp, FALSE);
        gm.m_using = TRUE;
        gb.buzzer = mtmp;
        gc.current_wand = otmp; /* needed by zhitu() */
        buzzfn(BZ_M_WAND(BZ_OFS_AD(
                             (otmp.otyp == FROST_HORN) ? AD_COLD : AD_FIRE)),
             rn1(6, 6), mtmp.mx, mtmp.my, sgn(mtmp.mux - mtmp.mx),
             sgn(mtmp.muy - mtmp.my));
        gb.buzzer = null;
        gc.current_wand = null;
        gm.m_using = FALSE;
        mtmp.mwandexp = TRUE;
        return DEADMONSTER(mtmp) ? 1 : 2;
    case MUSE_WAN_TELEPORTATION:
    case MUSE_WAN_UNDEAD_TURNING:
    case MUSE_WAN_STRIKING:
        gz.zap_oseen = oseen;
        mzapwand(mtmp, otmp, FALSE);
        gm.m_using = TRUE;
        gb.buzzer = mtmp;
        mbhit(mtmp, rn1(8, 6), mbhitm, bhito, otmp);
        gb.buzzer = null;
        /* note: 'otmp' might have been destroyed (drawbridge destruction) */
        gm.m_using = FALSE;
        if (gm.m.has_offense == MUSE_WAN_STRIKING)
            mtmp.mwandexp = TRUE;
        return 2;
    case MUSE_SCR_EARTH: {
        /* TODO: handle steeds */
        let x, y;
        /* don't use monster fields after killing it */
        let confused = (mtmp.mconf ? TRUE : FALSE);
        let mmx = mtmp.mx, mmy = mtmp.my;
        let is_cursed = otmp.cursed, is_blessed = otmp.blessed;

        mreadmsg(mtmp, otmp);
        /* Identify the scroll */
        if (canspotmon(mtmp)) {
            pline_The(_("%s rumbles %s %s!"), ceiling(mtmp.mx, mtmp.my),
                      otmp.blessed ? _("around") : _("above"), mon_nam(mtmp));
            if (oseen)
                makeknown(otmp.otyp);
        } else if (cansee(mtmp.mx, mtmp.my)) {
            pline_The(_("%s rumbles in the middle of nowhere!"),
                      ceiling(mtmp.mx, mtmp.my));
            if (mtmp.minvis)
                map_invisible(mtmp.mx, mtmp.my);
            if (oseen)
                makeknown(otmp.otyp);
        }

        /* could be fatal to monster, so use up the scroll before
           there's a chance that monster's inventory will be dropped */
        m_useup(mtmp, otmp);

        /* Loop through the surrounding squares */
        for (x = mmx - 1; x <= mmx + 1; x++) {
            for (y = mmy - 1; y <= mmy + 1; y++) {
                /* Is this a suitable spot? */
                if (isok(x, y) && !closed_door(x, y)
                    && !IS_OBSTRUCTED(levl()[x][y].typ) && !IS_AIR(levl()[x][y].typ)
                    && (((x == mmx) && (y == mmy)) ? !is_blessed : !is_cursed)
                    && (x != u.ux || y != u.uy)) {
                    drop_boulder_on_monster(x, y, confused, FALSE);
                }
            }
        }
        /* Attack the player */
        if (distmin(mmx, mmy, u.ux, u.uy) == 1 && !is_cursed) {
            drop_boulder_on_player(confused, +!is_cursed, FALSE, TRUE);
        }

        return DEADMONSTER(mtmp) ? 1 : 2;
    } /* case MUSE_SCR_EARTH */
    case MUSE_CAMERA: {
        if (Hallucination()) {
               ;
            verbalize(_("Say cheese!"));
        } else if (!Blind()) {
            pline(_("%s takes a picture of you with %s!"),
                  Monnam(mtmp), an(xname(otmp)));
        }
        gm.m_using = TRUE;
        if (!Blind() && !resists_blnd(gy.youmonst)) {
            You(_("are blinded by the flash of light!"));
            make_blinded(BlindedTimeout() + rnd(1 + 50), FALSE);
        }
        lightdamage(otmp, TRUE, 5);
        gm.m_using = FALSE;
        otmp.spe--;
        return 1;
    } /* case MUSE_CAMERA */
    /* #if 0: not in this build */

    case MUSE_POT_PARALYSIS:
    case MUSE_POT_BLINDNESS:
    case MUSE_POT_CONFUSION:
    case MUSE_POT_SLEEPING:
    case MUSE_POT_ACID:
        /* Note: this setting of dknown doesn't suffice.  A monster
         * which is out of sight might throw and it hits something _in_
         * sight, a problem not existing with wands because wand rays
         * are not objects.  Also set dknown in mthrowu.c.
         */
        if (cansee(mtmp.mx, mtmp.my)) {
            observe_object(otmp);
            pline_mon(mtmp, _("%s hurls %s!"),
                      Monnam(mtmp), singular(otmp, doname));
        }
        m_throw(mtmp, mtmp.mx, mtmp.my, sgn(mtmp.mux - mtmp.mx),
                sgn(mtmp.muy - mtmp.my),
                distmin(mtmp.mx, mtmp.my, mtmp.mux, mtmp.muy), otmp);
        return 2;
    case 0:
        return 0; /* i.e. an exploded wand */
    default:
        impossible(_("%s wanted to perform action %d?"), Monnam(mtmp),
                   gm.m.has_offense);
        break;
    }
    return 0;
}

export function rnd_offensive_item(mtmp) { /* int */
    let pm = mtmp.data;
    let difficulty = mons[monsndx(pm)].difficulty;

    if (is_animal(pm) || attacktype(pm, AT_EXPL) || mindless(mtmp.data)
        || pm.mlet == S_GHOST || pm.mlet == S_KOP)
        return 0;
    if (difficulty > 7 && !rn2(35))
        return WAN_DEATH;
    switch (rn2(9 - +(difficulty < 4) + 4 * +(difficulty > 6))) {
    case 0: {
        let mtmp_helmet = which_armor(mtmp, W_ARMH);

        if (hard_helmet(mtmp_helmet) || amorphous(pm)
            || passes_walls(pm) || noncorporeal(pm) || unsolid(pm))
            return SCR_EARTH;
    }
    /* FALLTHROUGH */;
    /* FALLTHRU */
    case 1:
        return WAN_STRIKING;
    case 2:
        return POT_ACID;
    case 3:
        return POT_CONFUSION;
    case 4:
        return POT_BLINDNESS;
    case 5:
        return POT_SLEEPING;
    case 6:
        return POT_PARALYSIS;
    case 7:
    case 8:
        return WAN_MAGIC_MISSILE;
    case 9:
        return WAN_SLEEP;
    case 10:
        return WAN_FIRE;
    case 11:
        return WAN_COLD;
    case 12:
        return WAN_LIGHTNING;
    }
    /*NOTREACHED*/
    return 0;
}

export const MUSE_POT_GAIN_LEVEL = 1;
export const MUSE_WAN_MAKE_INVISIBLE = 2;
export const MUSE_POT_INVISIBILITY = 3;
export const MUSE_POLY_TRAP = 4;
export const MUSE_WAN_POLYMORPH = 5;
export const MUSE_POT_SPEED = 6;
export const MUSE_WAN_SPEED_MONSTER = 7;
export const MUSE_BULLWHIP = 8;
export const MUSE_POT_POLYMORPH = 9;
export const MUSE_BAG = 10;

export function find_misc(mtmp) { /* boolean */
    let obj;
    let mdat = mtmp.data;
    let x = mtmp.mx, y = mtmp.my;
    let t;
    let xx, yy;
    let pmidx = NON_PM;
    let immobile = +(mdat.mmove == 0);
    let stuck = +(mtmp == u.ustuck);

    gm.m.misc = null;
    gm.m.has_misc = 0;
    if (is_animal(mdat) || mindless(mdat))
        return 0;
    if (u.uswallow && stuck)
        return FALSE;

    /* We arbitrarily limit to times when a player is nearby for the
     * same reason as Junior Pac-Man doesn't have energizers eaten until
     * you can see them...
     */
    if (dist2(x, y, mtmp.mux, mtmp.muy) > 36)
        return FALSE;

    if (!stuck && !immobile && !mtmp.mtrapped && (mtmp.cham == NON_PM)
        && mons[(pmidx = monsndx(mdat))].difficulty < 6) {
        let ignore_boulders = +(verysmall(mdat) || throws_rocks(mdat)
                                   || passes_walls(mdat)),
            diag_ok = +!NODIAG(pmidx);

        for (xx = x - 1; xx <= x + 1; xx++)
            for (yy = y - 1; yy <= y + 1; yy++)
                if (isok(xx, yy) && !u_at(xx, yy)
                    && (diag_ok || xx == x || yy == y)
                    && ((xx == x && yy == y) || !svl.level.monsters[xx][yy]))
                    if ((t = t_at(xx, yy)) != null
                        && (ignore_boulders || !sobj_at(BOULDER, xx, yy))
                        && !onscary(xx, yy, mtmp)) {
                        /* use trap if it's the correct type and will
                           polymorph the monster */
                        if (t.ttyp == POLY_TRAP &&
                            !wearing_iron_shoes(mtmp)) {
                            gt.trapx = xx;
                            gt.trapy = yy;
                            gm.m.has_misc = MUSE_POLY_TRAP;
                            return TRUE;
                        }
                    }
    }
    if (nohands(mdat))
        return 0;

    /* normally we would want to bracket a macro expansion containing
       'if' without matching 'else' with 'do { ... } while (0)' but we
       can't do that here because it would intercept 'continue' */

    /*
     * [bug?]  Choice of item is not prioritized; the last viable one
     * in the monster's inventory will be chosen.
     * 'nomore()' is nearly worthless because it only screens checking
     * of duplicates when there is no alternate type in between them.
     *
     * MUSE_BAG issues:
     * should allow looting floor container instead of needing the
     * monster to have picked it up and now be carrying it which takes
     * extra time and renders heavily filled containers immune;
     * hero should have a chance to see the monster fail to open a
     * locked container instead of monster always knowing lock state
     * (may not be feasible to implement--requires too much per-object
     * info for each monster);
     * monster with key should be able to unlock a locked floor
     * container and not know whether it is trapped.
     */
    for (obj = mtmp.minvent; obj; obj = obj.nobj) {
        /* Monsters shouldn't recognize cursed items; this kludge is
           necessary to prevent serious problems though... */
        if (obj.otyp == POT_GAIN_LEVEL
            && (!obj.cursed
                || (!mtmp.isgd && !mtmp.isshk && !mtmp.ispriest))) {
            gm.m.misc = obj;
            gm.m.has_misc = MUSE_POT_GAIN_LEVEL;
        }
        if ((gm.m.has_misc == (MUSE_BULLWHIP))) continue;;
        if (obj.otyp == BULLWHIP && !mtmp.mpeaceful
            /* the random test prevents whip-wielding
               monster from attempting disarm every turn */
            && uwep && !rn2(5) && obj == MON_WEP(mtmp)
            /* hero's location must be known and adjacent */
            && (((mtmp.mux) == u.ux) && ((mtmp.muy) == u.uy))
            && m_next2u(mtmp)
            /* don't bother if it can't work (this doesn't
               prevent cursed weapons from being targeted) */
            && !u.uswallow
            && (canletgo(uwep, _(""))
                || (u.twoweap && canletgo(uswapwep, _(""))))) {
            gm.m.misc = obj;
            gm.m.has_misc = MUSE_BULLWHIP;
        }
        /* Note: peaceful/tame monsters won't make themselves
         * invisible unless you can see them.  Not really right, but...
         */
        if ((gm.m.has_misc == (MUSE_WAN_MAKE_INVISIBLE))) continue;;
        if (obj.otyp == WAN_MAKE_INVISIBLE && obj.spe > 0 && !mtmp.minvis
            && !mtmp.invis_blkd && (!mtmp.mpeaceful || See_invisible())
            && (!attacktype(mtmp.data, AT_GAZE) || mtmp.mcan)) {
            gm.m.misc = obj;
            gm.m.has_misc = MUSE_WAN_MAKE_INVISIBLE;
        }
        if ((gm.m.has_misc == (MUSE_POT_INVISIBILITY))) continue;;
        if (obj.otyp == POT_INVISIBILITY && !mtmp.minvis
            && !mtmp.invis_blkd && (!mtmp.mpeaceful || See_invisible())
            && (!attacktype(mtmp.data, AT_GAZE) || mtmp.mcan)) {
            gm.m.misc = obj;
            gm.m.has_misc = MUSE_POT_INVISIBILITY;
        }
        if ((gm.m.has_misc == (MUSE_WAN_SPEED_MONSTER))) continue;;
        if (obj.otyp == WAN_SPEED_MONSTER && obj.spe > 0
            && mtmp.mspeed != MFAST && !mtmp.isgd) {
            gm.m.misc = obj;
            gm.m.has_misc = MUSE_WAN_SPEED_MONSTER;
        }
        if ((gm.m.has_misc == (MUSE_POT_SPEED))) continue;;
        if (obj.otyp == POT_SPEED && mtmp.mspeed != MFAST && !mtmp.isgd) {
            gm.m.misc = obj;
            gm.m.has_misc = MUSE_POT_SPEED;
        }
        if ((gm.m.has_misc == (MUSE_WAN_POLYMORPH))) continue;;
        if (obj.otyp == WAN_POLYMORPH && obj.spe > 0
            && (mtmp.cham == NON_PM) && mons[monsndx(mdat)].difficulty < 6) {
            gm.m.misc = obj;
            gm.m.has_misc = MUSE_WAN_POLYMORPH;
        }
        if ((gm.m.has_misc == (MUSE_POT_POLYMORPH))) continue;;
        if (obj.otyp == POT_POLYMORPH && (mtmp.cham == NON_PM)
            && mons[monsndx(mdat)].difficulty < 6) {
            gm.m.misc = obj;
            gm.m.has_misc = MUSE_POT_POLYMORPH;
        }
        if ((gm.m.has_misc == (MUSE_BAG))) continue;;
        if (Is_container(obj) && obj.otyp != BAG_OF_TRICKS && !rn2(5)
            && !SchroedingersBox(obj)
            && !gm.m.has_misc && Has_contents(obj)
            && !obj.olocked && !obj.otrapped) {
            gm.m.misc = obj;
            gm.m.has_misc = MUSE_BAG;
        }
    }
    return (+!!gm.m.has_misc);
}

/* type of monster to polymorph into; defaults to one suitable for the
   current level rather than the totally arbitrary choice of newcham() */
function muse_newcham_mon(mon) { /* struct permonst * */
    let m_armr;

    if ((m_armr = which_armor(mon, W_ARM)) != null) {
        if (Is_dragon_scales(m_armr))
            return Dragon_scales_to_pm(m_armr);
        else if (Is_dragon_mail(m_armr))
            return Dragon_mail_to_pm(m_armr);
    }
    return rndmonst();
}

function mloot_container(
    mon,
    container,
    vismon) { /* int */
    const $frame = stack_frame(); try {
    let contnr_nam = stack_array(char, BUFSZ), mpronounbuf = stack_array(char, 20);
    let nearby;
    let takeout_indx, takeout_count, howfar, res = 0;

    if (!container || !Has_contents(container) || container.olocked)
        return res; /* 0 */
    /* FIXME: handle cursed bag of holding */
    if (Is_mbag(container) && container.cursed)
        return res; /* 0 */
    if (SchroedingersBox(container))
        return res;

    switch (rn2(10)) {
    default: /* case 0, 1, 2, 3: */
        takeout_count = 1;
        break;
    case 4: case 5: case 6:
        takeout_count = 2;
        break;
    case 7: case 8:
        takeout_count = 3;
        break;
    case 9:
        takeout_count = 4;
        break;
    }
    howfar = mdistu(mon);
    nearby = +(howfar <= 7 * 7);
    chars[contnr_nam + 0] = chars[mpronounbuf + 0] = ord('\0');
    if (vismon) {
        /* do this once so that when hallucinating it won't change
           from one item to the next */
        strcpy(mpronounbuf, mhe(mon));
    }

    for (takeout_indx = 0; takeout_indx < takeout_count; ++takeout_indx) {
        let xobj;
        let nitems;

        if (!Has_contents(container)) /* might have removed all items */
            break;
        /* TODO?
         *  Monster ought to prioritize on something it wants to use.
         */
        nitems = 0;
        for (xobj = container.cobj; xobj != null; xobj = xobj.nobj)
            ++nitems;
        /* nitems is always greater than 0 due to Has_contents() check;
           throttle item removal as the container becomes less filled */
        if (!rn2(nitems + 1))
            break;
        nitems = rn2(nitems);
        for (xobj = container.cobj; xobj != null; xobj = xobj.nobj)
            if (--nitems < 0)
                break;
        assert(xobj != null);

        container.cknown = 0; /* hero no longer knows container's contents
                                * even if [attempted] removal is observed */
        if (!chars[contnr_nam]) {
            /* xname sets dknown, distant_name might depending on its own
               idea about nearness */
            strcpy(contnr_nam, an(nearby ? xname(container)
                                         : distant_name(container, xname)));
        }
        /* this was originally just 'can_carry(mon, xobj)' which
           covers objects a monster shouldn't pick up but also
           checks carrying capacity; for that, it ended up counting
           xobj's weight twice when container is carried; so take
           xobj out, check whether it can be carried, and then put
           it back (below) if it can't be */
        obj_extract_self(xobj); /* this reduces container's weight */
        /* check whether mon can handle xobj and whether weight of xobj plus
           minvent (including container, now without xobj) can be carried */
        if (can_carry(mon, xobj)) {
            if (vismon) {
                if (howfar > 2) /* not adjacent */
                    Norep(_("%s rummages through %s."), Monnam(mon), contnr_nam);
                else if (takeout_indx == 0) /* adjacent, first item */
                    pline_mon(mon, _("%s removes %s from %s."), Monnam(mon),
                          doname(xobj), contnr_nam);
                else /* adjacent, additional items */
                    pline(_("%s removes %s."), upstart(mpronounbuf),
                          doname(xobj));
            }
            if (container.otyp == ICE_BOX)
                removed_from_icebox(xobj); /* resume rotting for corpse */
            /* obj_extract_self(xobj); -- already done above */
            mpickobj(mon, xobj);
            res = 2;
        } else { /* couldn't carry xobj separately so put back inside */
            /* an achievement prize (castle's wand?) might already be
               marked nomerge (when it hasn't been in invent yet) */
            let already_nomerge = +(xobj.nomerge != 0),
                    just_xobj = +!Has_contents(container);

            /* this doesn't restore the original contents ordering
               [shouldn't be a problem; even though this item didn't
               give the rummage message, that's what mon was doing] */
            xobj.nomerge = 1;
            xobj = add_to_container(container, xobj);
            if (!already_nomerge)
                xobj.nomerge = 0;
            container.owt = unsigned(weight(container));
            if (just_xobj)
                break; /* out of takeout_count loop */
        } /* can_carry */
    } /* takeout_count */
    return res;
    } finally { stack_pop($frame); }
}

export function use_misc(mtmp) { /* int */
    const $frame = stack_frame(); try {
    let $goto = null; var MissingMiscellaneousItem = init_string(static_array("use_misc.MissingMiscellaneousItem", char, sizeof_string("use_misc: no %s")), _("use_misc: no %s"), true), nambuf = stack_array(char, BUFSZ), tolevel = stack_struct(struct_d_level), the_weapon = stack_array(char, BUFSZ), hand_buf = stack_array(char, BUFSZ);

    var vis, vismon, vistrapspot, oseen;
    var i;
    var t;
    var otmp = gm.m.misc;

    if ((i = precheck(mtmp, otmp)) != 0)
        return i;
    vis = cansee(mtmp.mx, mtmp.my);
    vismon = canseemon(mtmp);
    oseen = (otmp && vismon ? 1 : 0);

    switch (gm.m.has_misc) {
    case MUSE_POT_GAIN_LEVEL:
        if (!otmp)
            panic(MissingMiscellaneousItem, _("potion of gain level"));
        mquaffmsg(mtmp, otmp);
        if (otmp.cursed) {
            $goto_skipmsg: for (;;) { switch ($goto) { default: case "skipmsg": if (!$goto && (Can_rise_up(mtmp.mx, mtmp.my, u.uz))) {
                var tolev = depth(u.uz) - 1;

                get_level(tolevel, tolev);
                /* insurance against future changes... */
                if (on_level(tolevel, u.uz))
                    { $goto = "skipmsg"; continue $goto_skipmsg; };
                if (vismon) {
                    pline_mon(mtmp, _("%s rises up, through the %s!"),
                              Monnam(mtmp),
                              ceiling(mtmp.mx, mtmp.my));
                    trycall(otmp);
                }
                m_useup(mtmp, otmp);
                migrate_to_level(mtmp, ledger_no(tolevel), MIGR_RANDOM,
                                 null);
                return 2;
            } else {
 $goto = null;
                if (vismon) {
                    pline_mon(mtmp, _("%s looks uneasy."), Monnam(mtmp));
                    trycall(otmp);
                }
                m_useup(mtmp, otmp);
                return 2;
            } } break; }
        }
        if (vismon)
            pline_mon(mtmp, _("%s seems more experienced."), Monnam(mtmp));
        if (oseen)
            makeknown(POT_GAIN_LEVEL);
        m_useup(mtmp, otmp);
        if (!grow_up(mtmp, null))
            return 1;
        /* grew into genocided monster */
        return 2;
    case MUSE_WAN_MAKE_INVISIBLE:
    case MUSE_POT_INVISIBILITY:
        if (!otmp)
            panic(MissingMiscellaneousItem, _("potion of invisibility"));
        if (otmp.otyp == WAN_MAKE_INVISIBLE) {
            mzapwand(mtmp, otmp, TRUE);
        } else
            mquaffmsg(mtmp, otmp);
        /* format monster's name before altering its visibility */
        strcpy(nambuf, mon_nam(mtmp));
        mon_set_minvis(mtmp, !otmp.cursed ? FALSE : TRUE);
        if (vismon && mtmp.minvis) { /* was seen, now invisible */
            if (canspotmon(mtmp)) {
                pline(_("%s body takes on a %s transparency."),
                      upstart(s_suffix(nambuf)),
                      Hallucination() ? _("normal") : _("strange"));
            } else {
                pline(_("Suddenly you cannot see %s."), nambuf);
                if (vis)
                    map_invisible(mtmp.mx, mtmp.my);
            }
            if (oseen)
                makeknown(otmp.otyp);
        } else if (vismon && !mtmp.minvis) {
            /* cursed potion; mon tried to make itself invisible but failed */
            pline(_("%s briefly seems to be transparent."), Monnam(mtmp));
            /* we could call map_invisible() before the pline(), then
               newsym() after; unseen monster glyph would be visible during
               the pline, but hero would forget any remembered object under
               the monster */
        } else if (!vismon && canseemon(mtmp)) {
            /* cursed potion; this won't happen because a monster will only
               drink a potion of invisibility when not already invisible */
            pline(_("%s suddenly appears!"), Monnam(mtmp));
        }
        if (otmp.otyp == POT_INVISIBILITY) {
            if (otmp.cursed)
                you_aggravate(mtmp);
            m_useup(mtmp, otmp);
        }
        return 2;
    case MUSE_WAN_SPEED_MONSTER:
        if (!otmp)
            panic(MissingMiscellaneousItem, _("wand of speed monster"));
        mzapwand(mtmp, otmp, TRUE);
        mon_adjust_speed(mtmp, 1, otmp);
        return 2;
    case MUSE_POT_SPEED:
        if (!otmp)
            panic(MissingMiscellaneousItem, _("potion of speed"));
        mquaffmsg(mtmp, otmp);
        /* note difference in potion effect due to substantially
           different methods of maintaining speed ratings:
           player's character becomes "very fast" temporarily;
           monster becomes "one stage faster" permanently */
        mon_adjust_speed(mtmp, 1, otmp);
        m_useup(mtmp, otmp);
        return 2;
    case MUSE_WAN_POLYMORPH:
        if (!otmp)
            panic(MissingMiscellaneousItem, _("wand of polymorph"));
        mzapwand(mtmp, otmp, TRUE);
        newcham(mtmp, muse_newcham_mon(mtmp),
                       NC_VIA_WAND_OR_SPELL | NC_SHOW_MSG);
        if (oseen)
            makeknown(WAN_POLYMORPH);
        return 2;
    case MUSE_POT_POLYMORPH:
        if (!otmp)
            panic(MissingMiscellaneousItem, _("potion of polymorph"));
        mquaffmsg(mtmp, otmp);
        m_useup(mtmp, otmp);
        if (vismon)
            pline_mon(mtmp, _("%s suddenly mutates!"), Monnam(mtmp));
        newcham(mtmp, muse_newcham_mon(mtmp), NC_SHOW_MSG);
        if (oseen)
            makeknown(POT_POLYMORPH);
        return 2;
    case MUSE_POLY_TRAP:
        t = t_at(gt.trapx, gt.trapy);
        vistrapspot = cansee(t.tx, t.ty);
        if (vis || vistrapspot)
            seetrap(t);
        if (vismon || vistrapspot) {
            pline_mon(mtmp, _("%s deliberately %s onto a %s!"), Some_Monnam(mtmp),
                  vtense(fakename()[0], locomotion(mtmp.data, _("jump"))),
                  t.tseen ? trapname(t.ttyp, FALSE) : _("hidden trap"));
            /* note: if mtmp is unseen because it is invisible, its new
               shape will also be invisible and could produce "Its armor
               falls off" messages during the transformation; those make
               more sense after we've given "Someone jumps onto a trap." */
        }

        /*  don't use rloc() due to worms */
        remove_monster(mtmp.mx, mtmp.my);
        newsym(mtmp.mx, mtmp.my);
        place_monster(mtmp, gt.trapx, gt.trapy);
        maybe_unhide_at(gt.trapx, gt.trapy);
        if (mtmp.wormno)
            worm_move(mtmp);
        newsym(gt.trapx, gt.trapy);

        newcham(mtmp, null, NC_SHOW_MSG);
        return 2;
    case MUSE_BAG:
        if (!otmp)
            panic(MissingMiscellaneousItem, _("container"));
        return mloot_container(mtmp, otmp, vismon);
    case MUSE_BULLWHIP:
        /* attempt to disarm hero */
        {
            var The_whip = vismon ? _("The bullwhip") : _("A whip");
            var where_to = rn2(4);
            var obj = uwep;
            var hand;

            if (!obj || !canletgo(obj, _(""))
                || (u.twoweap && canletgo(uswapwep, _("")) && rn2(2)))
                obj = uswapwep;
            if (!obj)
                break; /* shouldn't happen after find_misc() */

            strcpy(the_weapon, the(xname(obj)));
            hand = body_part(HAND);
            if (bimanual(obj))
                hand = makeplural(hand);
            strncpy(hand_buf, hand, sizeof(array_of(char, BUFSZ)) - 1);
            chars[hand_buf + (sizeof(array_of(char, BUFSZ)) - 1)] = ord('\0');

            if (vismon)
                pline_mon(mtmp, _("%s flicks a bullwhip towards your %s!"),
                          Monnam(mtmp), hand_buf);
            if (obj.otyp == HEAVY_IRON_BALL) {
                pline(_("%s fails to wrap around %s."), The_whip, the_weapon);
                return 1;
            }
            urgent_pline(_("%s wraps around %s you're wielding!"), The_whip,
                         the_weapon);
            if (welded(obj)) {
                pline(_("%s welded to your %s%c"),
                      !is_plural(obj) ? _("It is") : _("They are"), hand_buf,
                      !obj.bknown ? ord('!') : ord('.'));
                /* obj->bknown = 1; */ /* welded() takes care of this */
                where_to = 0;
            }
            if (!where_to) {
                pline_The(_("whip slips free.")); /* not `The_whip' */
                return 1;
            } else if (where_to == 3 && mon_hates_silver(mtmp)
                       && objects[obj.otyp].oc_material == SILVER) {
                /* this monster won't want to catch a silver
                   weapon; drop it at hero's feet instead */
                where_to = 2;
            }
            remove_worn_item(obj, FALSE);
            freeinv(obj);
            switch (where_to) {
            case 1: /* onto floor beneath mon */
                pline_mon(mtmp, _("%s yanks %s from your %s!"), Monnam(mtmp),
                          the_weapon, hand_buf);
                place_object(obj, mtmp.mx, mtmp.my);
                break;
            case 2: /* onto floor beneath you */
                pline_mon(mtmp, _("%s yanks %s to the %s!"), Monnam(mtmp),
                          the_weapon, surface(u.ux, u.uy));
                dropy(obj);
                break;
            case 3: /* into mon's inventory */
                pline_mon(mtmp, _("%s snatches %s!"), Monnam(mtmp), the_weapon);
                mpickobj(mtmp, obj);
                break;
            }
            return 1;
        }
        /*NOTREACHED*/
        return 0;
    case 0:
        return 0; /* i.e. an exploded wand */
    default:
        impossible(_("%s wanted to perform action %d?"), Monnam(mtmp),
                   gm.m.has_misc);
        break;
    }
    return 0;
    } finally { stack_pop($frame); }
}

function you_aggravate(mtmp) { /* void */
    pline(_("For some reason, %s presence is known to you."),
          s_suffix(noit_mon_nam(mtmp)));
    cls();

    cliparound()(mtmp.mx, mtmp.my);

    show_glyph(mtmp.mx, mtmp.my, mon_to_glyph(mtmp, rn2_on_display_rng));
    display_self();
    You_feel(_("aggravated at %s."), noit_mon_nam(mtmp));
    display_nhwindow()(WIN_MAP, TRUE);
    docrt();
    if (unconscious()) {
        gm.multi = -1;
        gn.nomovemsg = _("Aggravated, you are jolted into full consciousness.");
    }
    newsym(mtmp.mx, mtmp.my);
    if (!canspotmon(mtmp))
        map_invisible(mtmp.mx, mtmp.my);
}

export function rnd_misc_item(mtmp) { /* int */
    let pm = mtmp.data;
    let difficulty = mons[monsndx(pm)].difficulty;

    if (is_animal(pm) || attacktype(pm, AT_EXPL) || mindless(mtmp.data)
        || pm.mlet == S_GHOST || pm.mlet == S_KOP)
        return 0;
    /* Unlike other rnd_item functions, we only allow _weak_ monsters
     * to have this item; after all, the item will be used to strengthen
     * the monster and strong monsters won't use it at all...
     */
    if (difficulty < 6 && !rn2(30))
        return rn2(6) ? POT_POLYMORPH : WAN_POLYMORPH;

    if (!rn2(40) && !nonliving(pm) && !is_vampshifter(mtmp))
        return AMULET_OF_LIFE_SAVING;

    switch (rn2(3)) {
    case 0:
        if (mtmp.isgd)
            return 0;
        return rn2(6) ? POT_SPEED : WAN_SPEED_MONSTER;
    case 1:
        if (mtmp.mpeaceful && !See_invisible())
            return 0;
        return rn2(6) ? POT_INVISIBILITY : WAN_MAKE_INVISIBLE;
    case 2:
        return POT_GAIN_LEVEL;
    }
    /*NOTREACHED*/
    return 0;
}

/* #if 0: not in this build */

export function searches_for_item(mon, obj) { /* boolean */
    let typ = obj.otyp;

    /* don't let monsters interact with protected items on the floor */
    if (obj.where == OBJ_FLOOR
        && (obj.ox == mon.mx && obj.oy == mon.my)
        && onscary(obj.ox, obj.oy, mon)) {
        return FALSE;
    }

    if (is_animal(mon.data) || mindless(mon.data)
        || mon.data == mons[PM_GHOST]) /* don't loot bones piles */
        return FALSE;

    if (typ == WAN_MAKE_INVISIBLE || typ == POT_INVISIBILITY)
        return (+(!mon.minvis && !mon.invis_blkd
                          && !attacktype(mon.data, AT_GAZE)));
    if (typ == WAN_SPEED_MONSTER || typ == POT_SPEED)
        return (+(mon.mspeed != MFAST));

    switch (obj.oclass) {
    case WAND_CLASS:
        if (obj.spe <= 0)
            return FALSE;
        if (typ == WAN_DIGGING)
            return (+!is_floater(mon.data));
        if (typ == WAN_POLYMORPH)
            return (+(mons[monsndx(mon.data)].difficulty < 6));
        if (objects[typ].oc_dir == RAY || typ == WAN_STRIKING
            || typ == WAN_UNDEAD_TURNING
            || typ == WAN_TELEPORTATION || typ == WAN_CREATE_MONSTER)
            return TRUE;
        break;
    case POTION_CLASS:
        if (typ == POT_HEALING || typ == POT_EXTRA_HEALING
            || typ == POT_FULL_HEALING || typ == POT_POLYMORPH
            || typ == POT_GAIN_LEVEL || typ == POT_PARALYSIS
            || typ == POT_SLEEPING || typ == POT_ACID || typ == POT_CONFUSION)
            return TRUE;
        if (typ == POT_BLINDNESS && !attacktype(mon.data, AT_GAZE))
            return TRUE;
        break;
    case SCROLL_CLASS:
        if (typ == SCR_TELEPORTATION || typ == SCR_CREATE_MONSTER
            || typ == SCR_EARTH || typ == SCR_FIRE)
            return TRUE;
        break;
    case AMULET_CLASS:
        if (typ == AMULET_OF_LIFE_SAVING)
            return (+!(nonliving(mon.data) || is_vampshifter(mon)));
        if (typ == AMULET_OF_REFLECTION || typ == AMULET_OF_GUARDING)
            return TRUE;
        break;
    case TOOL_CLASS:
        if (typ == PICK_AXE)
            return needspick(mon.data);
        if (typ == UNICORN_HORN)
            return (+(!obj.cursed && !is_unicorn(mon.data)
                              && mon.data != mons[PM_KI_RIN]));
        if (typ == FROST_HORN || typ == FIRE_HORN)
            return (obj.spe > 0 && can_blow(mon) ? 1 : 0);
        if (Is_container(obj) && !(Is_mbag(obj) && obj.cursed)
            && !obj.olocked)
            return TRUE;
        if (typ == EXPENSIVE_CAMERA)
            return +(obj.spe > 0);
        break;
    case FOOD_CLASS:
        if (typ == CORPSE)
            return (((mon.misc_worn_check & W_ARMG) != 0
                               && touch_petrifies(mons[obj.corpsenm]))
                              || (!resists_ston(mon)
                                  && cures_stoning(mon, obj, FALSE)) ? 1 : 0);
        if (typ == TIN)
            return (mcould_eat_tin(mon)
                              && (!resists_ston(mon)
                                  && cures_stoning(mon, obj, TRUE)) ? 1 : 0);
        if (typ == EGG && ismnum(obj.corpsenm))
            return touch_petrifies(mons[obj.corpsenm]);
        break;
    default:
        break;
    }

    return FALSE;
}

export function mon_reflects(mon, str) { /* boolean */
    let orefl = which_armor(mon, W_ARMS);

    if (orefl && orefl.otyp == SHIELD_OF_REFLECTION) {
        if (str) {
            pline(str, s_suffix(mon_nam(mon)), _("shield"));
            makeknown(SHIELD_OF_REFLECTION);
        }
        return TRUE;
    } else if (arti_reflects(MON_WEP(mon))) {
        /* due to wielded artifact weapon */
        if (str)
            pline(str, s_suffix(mon_nam(mon)), _("weapon"));
        return TRUE;
    } else if ((orefl = which_armor(mon, W_AMUL))
               && orefl.otyp == AMULET_OF_REFLECTION) {
        if (str) {
            pline(str, s_suffix(mon_nam(mon)), _("amulet"));
            makeknown(AMULET_OF_REFLECTION);
        }
        return TRUE;
    } else if ((orefl = which_armor(mon, W_ARM))
               && (orefl.otyp == SILVER_DRAGON_SCALES
                   || orefl.otyp == SILVER_DRAGON_SCALE_MAIL)) {
        if (str)
            pline(str, s_suffix(mon_nam(mon)), _("armor"));
        return TRUE;
    } else if (mon.data == mons[PM_SILVER_DRAGON]
               || mon.data == mons[PM_CHROMATIC_DRAGON]) {
        /* Silver dragons only reflect when mature; babies do not */
        if (str)
            pline(str, s_suffix(mon_nam(mon)), _("scales"));
        return TRUE;
    }
    return FALSE;
}

export function ureflects(fmt, str) { /* boolean */
    /* Check from outermost to innermost objects */
    if (EReflecting() & W_ARMS) {
        if (fmt && str) {
            pline(fmt, str, _("shield"));
            makeknown(SHIELD_OF_REFLECTION);
        }
        return TRUE;
    } else if (EReflecting() & W_WEP) {
        /* Due to wielded artifact weapon */
        if (fmt && str)
            pline(fmt, str, _("weapon"));
        return TRUE;
    } else if (EReflecting() & W_AMUL) {
        if (fmt && str) {
            pline(fmt, str, _("medallion"));
            makeknown(AMULET_OF_REFLECTION);
        }
        return TRUE;
    } else if (EReflecting() & W_ARM) {
        if (fmt && str)
            pline(fmt, str, uskin ? _("luster") : _("armor"));
        return TRUE;
    } else if (gy.youmonst.data == mons[PM_SILVER_DRAGON]) {
        if (fmt && str)
            pline(fmt, str, _("scales"));
        return TRUE;
    }
    return FALSE;
}

/* cure mon's blindness (use_defensive, dog_eat, meatobj) */
export function mcureblindness(mon, verbos) { /* void */
    if (!mon.mcansee) {
        mon.mcansee = 1;
        mon.mblinded = 0;
        if (verbos && haseyes(mon.data))
            pline_mon(mon, _("%s can see again."), Monnam(mon));
    }
}

/* TRUE if the monster ate something */
export function munstone(mon, by_you) { /* boolean */
    let obj;
    let tinok;

    if (resists_ston(mon))
        return FALSE;
    if (mon.meating || helpless(mon))
        return FALSE;
    mon.mstrategy = and64u(mon.mstrategy, ~STRAT_WAITFORU);

    tinok = mcould_eat_tin(mon);
    for (obj = mon.minvent; obj; obj = obj.nobj) {
        if (cures_stoning(mon, obj, tinok)) {
            mon_consume_unstone(mon, obj, by_you, TRUE);
            return TRUE;
        }
    }
    return FALSE;
}

function mon_consume_unstone(
    mon,
    obj,
    by_you,
    stoning) { /* void */ /* T: stop petrification, F: cure stun && confusion */
    let vis = canseemon(mon), tinned = +(obj.otyp == TIN),
            food = (obj.otyp == CORPSE || tinned ? 1 : 0),
            acid = (obj.otyp == POT_ACID
                   || (food && acidic(mons[obj.corpsenm])) ? 1 : 0),
            lizard = (food && obj.corpsenm == PM_LIZARD ? 1 : 0);
    let nutrit = food ? dog_nutrition(mon, obj) : 0; /* also sets meating */

    /* give a "<mon> is slowing down" message and also remove
       intrinsic speed (comparable to similar effect on the hero) */
    if (stoning)
        mon_adjust_speed(mon, -3, null);

    if (vis) {
        let save_quan = obj.quan;

        obj.quan = 1;
        pline_mon(mon, _("%s %s %s."), Monnam(mon),
              ((obj.oclass == POTION_CLASS) ? _("quaffs")
               : (obj.otyp == TIN) ? _("opens and eats the contents of")
                 : _("eats")),
              distant_name(obj, doname));
        obj.quan = save_quan;
    } else if (!Deaf())
        You_hear(_("%s."),
                 (obj.oclass == POTION_CLASS) ? _("drinking") : _("chewing"));

    m_useup(mon, obj);
    /* obj is now gone */

    if (acid && !tinned && !resists_acid(mon)) {
        mon.mhp -= rnd(15);
        if (vis)
            pline_mon(mon, _("%s has a very bad case of stomach acid."), Monnam(mon));
        if (DEADMONSTER(mon)) {
            pline_mon(mon, _("%s dies!"), Monnam(mon));
            if (by_you)
                /* hero gets credit (experience) and blame (possible loss
                   of alignment and/or luck and/or telepathy depending on
                   mon) for the kill but does not break pacifism conduct */
                xkilled(mon, XKILL_NOMSG | XKILL_NOCONDUCT);
            else
                mondead(mon);
            return;
        }
    }
    if (stoning && vis) {
        if (Hallucination())
            pline(_("What a pity - %s just ruined a future piece of art!"),
                  mon_nam(mon));
        else
            pline_mon(mon, _("%s seems limber!"), Monnam(mon));
    }
    if (lizard && (mon.mconf || mon.mstun)) {
        mon.mconf = 0;
        mon.mstun = 0;
        if (vis && !is_bat(mon.data) && mon.data != mons[PM_STALKER])
            pline_mon(mon, _("%s seems steadier now."), Monnam(mon));
    }
    if (mon.mtame && !mon.isminion && nutrit > 0) {
        let edog = EDOG(mon);

        if (edog.hungrytime < svm.moves)
            edog.hungrytime = svm.moves;
        edog.hungrytime += nutrit;
        mon.mconf = 0;
    }
    /* use up monster's next move */
    mon.movement -= NORMAL_SPEED;
    mon.mlstmv = svm.moves;
}

/* decide whether obj can cure petrification; also used when picking up */
function cures_stoning(mon, obj, tinok) { /* boolean */
    if (obj.otyp == POT_ACID)
        return TRUE;
    if (obj.otyp == GLOB_OF_GREEN_SLIME)
        return slimeproof(mon.data);
    if (obj.otyp != CORPSE && (obj.otyp != TIN || !tinok))
        return FALSE;
    /* corpse, or tin that mon can open */
    if (obj.corpsenm == NON_PM) /* empty/special tin */
        return FALSE;
    return (+(obj.corpsenm == PM_LIZARD
                      || acidic(mons[obj.corpsenm])));
}

function mcould_eat_tin(mon) { /* boolean */
    let obj, mwep;
    let welded_wep;

    /* monkeys who manage to steal tins can't open and eat them
       even if they happen to also have the appropriate tool */
    if (is_animal(mon.data))
        return FALSE;

    mwep = MON_WEP(mon);
    welded_wep = (mwep && mwelded(mwep) ? 1 : 0);
    /* this is different from the player; tin opener or dagger doesn't
       have to be wielded, and knife can be used instead of dagger */
    for (obj = mon.minvent; obj; obj = obj.nobj) {
        /* if stuck with a cursed weapon, don't check rest of inventory */
        if (welded_wep && obj != mwep)
            continue;

        if (obj.otyp == TIN_OPENER
            || (obj.oclass == WEAPON_CLASS
                && (objects[obj.otyp].oc_subtyp == P_DAGGER
                    || objects[obj.otyp].oc_subtyp == P_KNIFE)))
            return TRUE;
    }
    return FALSE;
}

/* TRUE if monster does something to avoid turning into green slime */
export function munslime(mon, by_you) { /* boolean */
    const $frame = stack_frame(); try {
    let obj, odummy = stack_struct(struct_obj);
    let mptr = mon.data;

    /*
     * muse_unslime() gives "mon starts turning green", "mon zaps
     * itself with a wand of fire", and "mon's slime burns away"
     * messages.  Monsters who don't get any chance at that just have
     * (via our caller) newcham()'s "mon turns into slime" feedback.
     */

    if (slimeproof(mptr))
        return FALSE;
    if (mon.meating || helpless(mon))
        return FALSE;
    mon.mstrategy = and64u(mon.mstrategy, ~STRAT_WAITFORU);

    /* if monster can breathe fire, do so upon self; a monster who deals
       fire damage by biting, clawing, gazing, and especially exploding
       isn't able to cure itself of green slime with its own attack
       [possible extension: monst capable of casting high level clerical
       spells could toss pillar of fire at self--probably too suicidal] */
    if (!mon.mcan && !mon.mspec_used
        && attacktype_fordmg(mptr, AT_BREA, AD_FIRE)) {
        struct_assign(odummy, cg.zeroobj); /* otyp == STRANGE_OBJECT */
        return muse_unslime(mon, odummy, null, by_you);
    }

    /* same MUSE criteria as use_defensive() */
    if (!is_animal(mptr) && !mindless(mptr)) {
        let t;

        for (obj = mon.minvent; obj; obj = obj.nobj)
            if (cures_sliming(mon, obj))
                return muse_unslime(mon, obj, null, by_you);

        if (((t = t_at(mon.mx, mon.my)) == null || t.ttyp != FIRE_TRAP)
            && mptr.mmove && !mon.mtrapped) {
            let xy = stack_array(array_of(short, 8), 2), x, y, idx, ridx, nxy = 0;

            for (x = mon.mx - 1; x <= mon.mx + 1; ++x)
                for (y = mon.my - 1; y <= mon.my + 1; ++y)
                    if (isok(x, y) && accessible(x, y)
                        && !m_at(x, y) && (x != u.ux || y != u.uy)) {
                        xy[0][nxy] = x, xy[1][nxy] = y;
                        ++nxy;
                    }
            for (idx = 0; idx < nxy; ++idx) {
                ridx = rn1(nxy - idx, idx);
                if (ridx != idx) {
                    x = xy[0][idx];
                    xy[0][idx] = xy[0][ridx];
                    xy[0][ridx] = x;
                    y = xy[1][idx];
                    xy[1][idx] = xy[1][ridx];
                    xy[1][ridx] = y;
                }
                if ((t = t_at(xy[0][idx], xy[1][idx])) != null
                    && t.ttyp == FIRE_TRAP)
                    break;
            }
        }
        if (t && t.ttyp == FIRE_TRAP)
            return muse_unslime(mon, hands_obj, t, by_you);
    } /* MUSE */

    return FALSE;
    } finally { stack_pop($frame); }
}

/* mon uses an item--selected by caller--to burn away incipient slime */
function muse_unslime(
    mon,
    obj,
    trap,
    by_you) { /* boolean */ /* true: if mon kills itself, hero gets credit/blame */
    const $frame = stack_frame(); try {                   /* [by_you not honored if 'mon' triggers fire trap]. */
    let odummyp = stack_var(ptr_to(struct_obj));
    let otyp = obj.otyp, dmg = 0;
    let vis = canseemon(mon), res = TRUE;

    if (vis)
        pline_mon(mon, _("%s starts turning %s."), Monnam(mon),
              green_mon(mon) ? _("into ooze") : hcolor(NH_GREEN()));
    /* -4 => sliming, causes quiet loss of enhanced speed */
    mon_adjust_speed(mon, -4, null);

    if (trap) {
        let Mnam = vis ? Monnam(mon) : 0;

        if (mon.mx == trap.tx && mon.my == trap.ty) {
            if (vis)
                pline(_("%s triggers %s fire trap!"), Mnam,
                      trap.tseen ? _("the") : _("a"));
        } else {
            remove_monster(mon.mx, mon.my);
            newsym(mon.mx, mon.my);
            place_monster(mon, trap.tx, trap.ty);
            if (mon.wormno) /* won't happen; worms don't MUSE to unslime */
                worm_move(mon);
            newsym(mon.mx, mon.my);
            if (vis)
                pline(_("%s %s %s %s fire trap!"), Mnam,
                      vtense(fakename()[0], locomotion(mon.data, _("move"))),
                      is_floater(mon.data) ? _("over") : _("onto"),
                      trap.tseen ? _("the") : _("a"));
        }
        mintrap(mon, FORCETRAP);
    } else if (otyp == STRANGE_OBJECT) {
        /* monster is using fire breath on self */
        if (vis)
            pline_mon(mon, _("%s."),
                      monverbself(mon, Monnam(mon), _("breath"), _("fire on")));
        if (!rn2(3))
            mon.mspec_used = rn1(10, 5);
        /* -21 => monster's fire breath; 1 => # of damage dice */
        dmg = zhitm(mon, by_you ? 21 : -21, 1, odummyp);
    } else if (otyp == SCR_FIRE) {
        mreadmsg(mon, obj);
        if (mon.mconf) {
            if (cansee(mon.mx, mon.my))
                pline(_("Oh, what a pretty fire!"));
            if (vis)
                trycall(obj);
            m_useup(mon, obj); /* after trycall() */
            vis = FALSE;       /* skip makeknown() below */
            res = FALSE;       /* failed to cure sliming */
        } else {
            dmg = Math.trunc((2 * (rn1(3, 3) + 2 * bcsign(obj)) + 1) / 3);
            m_useup(mon, obj); /* before explode() */
            /* -11 => monster's fireball */
            explode(mon.mx, mon.my, -11, dmg, SCROLL_CLASS,
                    /* by_you: override -11 for mon but not others */
                    by_you ? -EXPL_FIERY : EXPL_FIERY);
            dmg = 0; /* damage has been applied by explode() */
        }
    } else if (otyp == POT_OIL) {
        let Pronoun = stack_array(char, 40);
        let was_lit = obj.lamplit ? TRUE : FALSE, saw_lit = FALSE;
        /*
         * If not already lit, requires two actions.  We cheat and let
         * monster do both rather than render the potion unusable.
         *
         * Monsters don't start with oil and don't actively pick up oil
         * so this may never occur in a real game.  (Possible though;
         * nymph can steal potions of oil; shapechanger could take on
         * nymph form or vacuum up stuff as a gel.cube and then eventually
         * engage with a green slime.)
         */

        if (obj.quan > 1)
            obj = splitobj(obj, 1);
        if (vis && !was_lit) {
            pline_mon(mon, _("%s ignites %s."), Monnam(mon), ansimpleoname(obj));
            saw_lit = TRUE;
        }
        begin_burn(obj, was_lit);
        vis |= canseemon(mon); /* burning potion may improve visibility */
        if (vis) {
            if (!Unaware())
                observe_object(obj); /* hero is watching mon drink obj */
            pline(_("%s quaffs a burning %s"),
                  saw_lit ? upstart(strcpy(Pronoun, mhe(mon))) : Monnam(mon),
                  simpleonames(obj));
            makeknown(POT_OIL);
        }
        dmg = d(3, 4); /* [**TEMP** (different from hero)] */
        m_useup(mon, obj);
    } else { /* wand/horn of fire w/ positive charge count */
        if (obj.otyp == FIRE_HORN)
            mplayhorn(mon, obj, TRUE);
        else
            mzapwand(mon, obj, TRUE);
        /* -1 => monster's wand of fire; 2 => # of damage dice */
        dmg = zhitm(mon, by_you ? 1 : -1, 2, odummyp);
    }

    if (dmg) {
        /* zhitm() applies damage but doesn't kill creature off;
           for fire breath, dmg is going to be 0 (fire breathers are
           immune to fire damage) but for wand of fire or fire horn,
           'mon' could have taken damage so might die */
        if (DEADMONSTER(mon)) {
            if (by_you) {
                /* mon killed self but hero gets credit and blame (except
                   for pacifist conduct); xkilled()'s message would say
                   "You killed/destroyed <mon>" so give our own message */
                if (vis)
                    pline_mon(mon, _("%s is %s by the fire!"), Monnam(mon),
                          nonliving(mon.data) ? _("destroyed") : _("killed"));
                xkilled(mon, XKILL_NOMSG | XKILL_NOCONDUCT);
            } else
                monkilled(mon, _("fire"), AD_FIRE);
        } else {
            /* non-fatal damage occurred */
            if (vis)
                pline_mon(mon, _("%s is burned%s"), Monnam(mon), exclam(dmg));
        }
    }
    if (vis) {
        if (res && !DEADMONSTER(mon))
            pline_mon(mon, _("%s slime is burned away!"), s_suffix(Monnam(mon)));
        if (otyp != STRANGE_OBJECT)
            makeknown(otyp);
    }
    /* use up monster's next move */
    mon.movement -= NORMAL_SPEED;
    mon.mlstmv = svm.moves;
    return res;
    } finally { stack_pop($frame); }
}

/* decide whether obj can be used to cure green slime */
function cures_sliming(mon, obj) { /* int */
    /* scroll of fire */
    if (obj.otyp == SCR_FIRE)
        return (haseyes(mon.data) && mon.mcansee && !nohands(mon.data) ? 1 : 0);

    /* potion of oil; will be set burning if not already */
    if (obj.otyp == POT_OIL)
        return +!nohands(mon.data);

    /* non-empty wand or horn of fire;
       hero doesn't need hands or even limbs to zap, so mon doesn't either */
    return ((obj.otyp == WAN_FIRE
             || (obj.otyp == FIRE_HORN && can_blow(mon)))
            && obj.spe > 0 ? 1 : 0);
}

/* TRUE if monster appears to be green; we go by the display color.
   The alternative was to just pick things that
   seem plausibly green (which didn't necessarily match the categorization
   by the color of the text).
   iflags.use_color is not meant for game behavior decisions */
function green_mon(mon) { /* boolean */
    let ptr = mon.data;

    if (Hallucination())
        return FALSE;
    return +(ptr.mcolor == CLR_GREEN || ptr.mcolor == CLR_BRIGHT_GREEN);
/* #if 0: not in this build */
}

/*muse.c*/

import { CLR_BRIGHT_GREEN, CLR_GREEN } from "./color.h.js";
import { struct_nhcoord } from "./coord.h.js";
import { NH_GREEN, Something, fakename, something } from "./decl.h.macros.js";
import {
    AMULET_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, S_GHOST, S_KOP, TOOL_CLASS, WAND_CLASS,
    WEAPON_CLASS,
} from "./defsym.h.js";
import { EXPL_FIERY } from "./display.h.js";
import { canspotmon, display_self, mon_to_glyph } from "./display.h.macros.js";
import {
    MIGR_LADDER_DOWN, MIGR_LADDER_UP, MIGR_RANDOM, MIGR_SSTAIRS, MIGR_STAIRS_DOWN, MIGR_STAIRS_UP,
    struct_d_level,
} from "./dungeon.h.js";
import { In_endgame, Inhell, Is_earthlevel, Is_knox, Is_rogue_level } from "./dungeon.h.macros.js";
import { PLNMSG_enum } from "./flag.h.js";
import { BUFSZ, FALSE, QBUFSZ, TRUE, coordxy } from "./global.h.js";
import {
    ARTICLE_A, AUGMENT_IT, BOLT_LIM, FORCEBUNGLE, FORCETRAP, HAND, KILLED_BY_AN, MM_NOMSG,
    NC_SHOW_MSG, NC_VIA_WAND_OR_SPELL, NOTELL, NO_MM_FLAGS, RLOC_MSG, SUPPRESS_INVISIBLE,
    SUPPRESS_IT, SUPPRESS_SADDLE, TELL, WAND_BACKFIRE_CHANCE, XKILL_NOCONDUCT, XKILL_NOMSG,
} from "./hack.h.js";
import {
    BZ_M_WAND, BZ_OFS_AD, BZ_OFS_WAN, DIR_CLAMP, DIR_LEFT2, DIR_RIGHT2, NODIAG,
    POTION_OCCUPANT_CHANCE, makeknown, mdistu, pline1, rn1,
} from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { EDOG } from "./mextra.h.macros.js";
import { SHOPBASE, TEMPLE } from "./mkroom.h.js";
import { AD_COLD, AD_FIRE, AD_HEAL, AD_RBRE, AT_BREA, AT_EXPL, AT_GAZE } from "./monattk.h.js";
import {
    acidic, amorphous, haseyes, hates_light, is_animal, is_bat, is_floater, is_flyer, is_mercenary,
    is_undead, is_unicorn, mindless, monsndx, needspick, nohands, noncorporeal, nonliving,
    passes_walls, slimeproof, throws_rocks, touch_petrifies, unsolid, verysmall,
} from "./mondata.h.macros.js";
import { G_GONE, G_UNIQ } from "./monflag.h.js";
import {
    MFAST, M_SEEN_ACID, M_SEEN_COLD, M_SEEN_ELEC, M_SEEN_FIRE, M_SEEN_MAGR, M_SEEN_REFL,
    M_SEEN_SLEEP, STRAT_WAITFORU,
} from "./monst.h.js";
import {
    DEADMONSTER, MON_WEP, helpless, is_Vlad, is_vampshifter, ismnum, mon_offmap, resists_acid,
    resists_ston,
} from "./monst.h.macros.js";
import {
    NON_PM, PM_ACID_BLOB, PM_CHROMATIC_DRAGON, PM_CROCODILE, PM_DJINNI, PM_GHOST, PM_GIANT_EEL,
    PM_GUARD, PM_KI_RIN, PM_LIZARD, PM_PESTILENCE, PM_SILVER_DRAGON, PM_STALKER,
} from "./monsters.h.js";
import { OBJ_FLOOR, struct_obj } from "./obj.h.js";
import {
    Dragon_mail_to_pm, Dragon_scales_to_pm, Has_contents, Is_container, Is_dragon_mail,
    Is_dragon_scales, Is_mbag, SchroedingersBox, bimanual, is_plural,
} from "./obj.h.macros.js";
import { RAY, SILVER } from "./objclass.h.js";
import {
    AMULET_OF_GUARDING, AMULET_OF_LIFE_SAVING, AMULET_OF_REFLECTION, BAG_OF_TRICKS, BOULDER, BUGLE,
    BULLWHIP, CORPSE, EGG, EXPENSIVE_CAMERA, FIRE_HORN, FROST_HORN, GLOB_OF_GREEN_SLIME,
    HEAVY_IRON_BALL, ICE_BOX, PICK_AXE, POT_ACID, POT_BLINDNESS, POT_CONFUSION, POT_EXTRA_HEALING,
    POT_FULL_HEALING, POT_GAIN_LEVEL, POT_HEALING, POT_INVISIBILITY, POT_OIL, POT_PARALYSIS,
    POT_POLYMORPH, POT_SICKNESS, POT_SLEEPING, POT_SPEED, SCR_CREATE_MONSTER, SCR_EARTH, SCR_FIRE,
    SCR_TELEPORTATION, SHIELD_OF_REFLECTION, SILVER_DRAGON_SCALES, SILVER_DRAGON_SCALE_MAIL,
    SPE_CANCELLATION, STRANGE_OBJECT, TIN, TIN_OPENER, UNICORN_HORN, WAN_CANCELLATION, WAN_COLD,
    WAN_CREATE_MONSTER, WAN_DEATH, WAN_DIGGING, WAN_FIRE, WAN_LIGHTNING, WAN_LOCKING,
    WAN_MAGIC_MISSILE, WAN_MAKE_INVISIBLE, WAN_OPENING, WAN_POLYMORPH, WAN_SLEEP, WAN_SPEED_MONSTER,
    WAN_STRIKING, WAN_TELEPORTATION, WAN_UNDEAD_TURNING,
} from "./objects.h.js";
import { NORMAL_SPEED } from "./permonst.h.js";
import { W_AMUL, W_ARM, W_ARMG, W_ARMH, W_ARMS, W_WEP } from "./prop.h.js";
import {
    CORR, DRAWBRIDGE_UP, D_BROKEN, D_CLOSED, D_LOCKED, LADDER, SCORR, SDOOR, STAIRS, W_NONDIGGABLE,
} from "./rm.h.js";
import {
    IS_AIR, IS_DOOR, IS_DRAWBRIDGE, IS_FURNITURE, IS_OBSTRUCTED, OBJ_AT, Sokoban, ZAP_POS, levl,
    m_at, remove_monster,
} from "./rm.h.macros.js";
import { P_DAGGER, P_KNIFE } from "./skills.h.js";
import {
    BEAR_TRAP, FIRE_TRAP, HOLE, PIT, POLY_TRAP, TELEP_TRAP, Trap_Killed_Mon, WEB,
} from "./trap.h.js";
import { is_hole, is_pit } from "./trap.h.macros.js";
import { cansee, couldsee } from "./vision.h.macros.js";
import { cliparound, display_nhwindow } from "./winprocs.h.macros.js";
import { m_next2u, mhe, mhim, u_at } from "./you.h.macros.js";
import {
    Antimagic, Blind, BlindedTimeout, Deaf, EReflecting, Half_spell_damage, Hallucination,
    See_invisible, Teleport_control, Unaware,
} from "./youprop.h.macros.js";
import { char, ord, short, sizeof, sizeof_string, uchar, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64u } from "../rt/int64.js";
import { assert, sprintf, strcpy, strlen, strncpy } from "../rt/libc.js";
import {
    init_string, stack_array, stack_struct, stack_var, static_array, static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { array_of, ptr_to, struct_assign } from "../rt/struct.js";
import { stop_occupation } from "./allmain.js";
import { arti_reflects } from "./artifact.js";
import { dirtocoord, isok, xytodir } from "./cmd.js";
import {
    destroy_drawbridge, find_drawbridge, is_drawbridge_wall, is_ice, is_lava, is_pool,
} from "./dbridge.js";
import { cg, gb, gc, gm, gn, gt, gy, gz, hands_obj, iflags, svc, svl, svm, u } from "./decl.js";
import {
    canseemon, cls, docrt, map_invisible, newsym, sensemon, shieldeff, show_glyph,
} from "./display.js";
import { canletgo, dropy, trycall } from "./do.js";
import {
    Monnam, Some_Monnam, a_monnam, hcolor, mon_nam, monverbself, noit_mon_nam, rndmonnam, x_monnam,
} from "./do_name.js";
import { hard_helmet } from "./do_wear.js";
import { migrate_to_level } from "./dog.js";
import { dog_nutrition } from "./dogmove.js";
import {
    Can_dig_down, Can_fall_thru, Can_rise_up, In_V_tower, Is_botlevel, On_W_tower_level, ceiling,
    depth, dunlev, dunlevs_in_dungeon, get_level, ledger_no, on_level, surface,
} from "./dungeon.js";
import { panic } from "./end.js";
import { explode } from "./explode.js";
import { in_rooms, losehp, nomul } from "./hack.js";
import { dist2, distmin, s_suffix, sgn, strsubst, upstart } from "./hacklib.js";
import { carrying, freeinv, sobj_at } from "./invent.js";
import { doorlock } from "./lock.js";
import { grow_up, makemon, rndmonst, set_malign } from "./makemon.js";
import { paralyze_monst } from "./mhitm.js";
import {
    add_to_container, bcsign, obj_extract_self, place_object, splitobj, unbless, unknow_object,
    weight,
} from "./mkobj.js";
import {
    can_carry, flash_mon, healmon, maybe_unhide_at, mondead, mongone, monkilled, monnear, newcham,
    seemimic, wakeup, xkilled,
} from "./mon.js";
import {
    attacktype, attacktype_fordmg, can_blow, dmgtype, locomotion, mon_hates_silver, mon_knows_traps,
    mon_learns_traps, monstseesu, monstunseesu, poly_when_stoned, resists_blnd, resists_magm,
    same_race,
} from "./mondata.js";
import { accessible, closed_door, mon_would_take_item, monflee, onscary } from "./monmove.js";
import { mons } from "./monst.js";
import { lined_up, linedup_callback, m_carrying, m_throw, m_useup } from "./mthrowu.js";
import { awaken_soldiers } from "./music.js";
import { objdescr_is, observe_object } from "./o_init.js";
import { objects } from "./objects.js";
import {
    an, ansimpleoname, distant_name, doname, makeplural, simpleonames, singular, the, vtense, xname,
} from "./objnam.js";
import { removed_from_icebox } from "./pickup.js";
import {
    Norep, You, You_feel, You_hear, impossible, pline, pline_The, pline_mon, urgent_pline,
    verbalize,
} from "./pline.js";
import { body_part } from "./polyself.js";
import { make_blinded } from "./potion.js";
import { in_your_sanctuary } from "./priest.js";
import { drop_boulder_on_monster, drop_boulder_on_player } from "./read.js";
import { d, rn2, rn2_on_display_rng, rnd } from "./rnd.js";
import { add_damage, inhishop, obfree } from "./shk.js";
import { stairway_at } from "./stairs.js";
import { mpickobj, remove_worn_item } from "./steal.js";
import { place_monster } from "./steed.js";
import {
    enexto, noteleport_level, random_teleport_level, rloc, tele, tele_restrict,
} from "./teleport.js";
import { begin_burn } from "./timeout.js";
import {
    fill_pit, maketrap, mintrap, seetrap, t_at, trapname, unconscious, wearing_iron_shoes,
} from "./trap.js";
import { recalc_block_point, unblock_point } from "./vision.js";
import { mwelded, welded } from "./wield.js";
import { mon_has_amulet, mon_has_special } from "./wizard.js";
import { worm_move } from "./worm.js";
import {
    extract_from_minvent, find_mac, mon_adjust_speed, mon_set_minvis, which_armor,
} from "./worn.js";
import {
    bhito, buzz, cancel_monst, dobuzz, exclam, hit, lightdamage, miss, resist, unturn_dead,
    unturn_you, zhitm,
} from "./zap.js";
