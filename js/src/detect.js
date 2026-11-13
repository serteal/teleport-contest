/* NetHack 5.0	detect.c	$NHDT-Date: 1763708572 2025/11/20 23:02:52 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.191 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2018. */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * Detection routines, including crystal ball, magic mapping, and search
 * command.
 */

/* for screen alert shown to player when secret door detection or ^E
   finds stuff; to use tmp_at() instead of flash_glyph_at(), define as 0;
   extra code for tmp_at() will be included and the flash_glyph_at()
   calls will execute but won't do anything */
export const FOUND_FLASH_COUNT = 6;

/* dummytrap: used when detecting traps finds a door or chest trap; the
   couple of fields that matter are always re-initialized during use so
   this does not need to be part of 'struct instance_globals g'; fields
   that aren't used are compile-/link-/load-time initialized to 0 */
const dummytrap = static_struct("dummytrap", struct_trap);

/* data for enhanced feedback from findone() */
const struct_found_things = struct("struct_found_things", {
    ft_cc: "struct_nhcoord",
    num_sdoors: uchar,
    num_scorrs: uchar,
    num_traps: uchar,
    num_mons: uchar,
    num_invis: uchar,
    num_cleared_invis: uchar,
    num_kept_invis: uchar,
});

/* wildcard class for clear_stale_map - this used to be used as a getobj()
   input but it's no longer used for that function */
export const ALL_CLASSES = (MAXOCLASSES + 1);

/* bring hero out from underwater or underground or being engulfed;
   return True iff any change occurred */
function unconstrain_map() { /* boolean */
    let res = (u.uinwater || u.uburied || u.uswallow ? 1 : 0);

    /* bring Underwater, buried, or swallowed hero to normal map;
       bypass set_uinwater() */
    iflags.save_uinwater = u.uinwater, u.uinwater = 0;
    iflags.save_uburied  = u.uburied,  u.uburied  = 0;
    iflags.save_uswallow = u.uswallow, u.uswallow = 0;

    return res;
}

/* put hero back underwater or underground or engulfed */
function reconstrain_map() { /* void */
    /* if was in water and taken out, put back; bypass set_uinwater() */
    u.uinwater = iflags.save_uinwater, iflags.save_uinwater = 0;
    u.uburied  = iflags.save_uburied,  iflags.save_uburied  = 0;
    u.uswallow = iflags.save_uswallow, iflags.save_uswallow = 0;
}

function map_redisplay() { /* void */
    reconstrain_map();
    docrt(); /* redraw the screen to remove unseen traps from the map */
    if (Underwater())
        under_water(2);
    if (u.uburied)
        under_ground(2);
}

/* use getpos()'s 'autodescribe' to view whatever is currently shown on map */
function browse_map(ter_typ, ter_explain) { /* void */
    const $frame = stack_frame(); try {
    let dummy_pos = stack_struct(struct_nhcoord); /* don't care whether player actually picks a spot */
    let save_autodescribe;

    dummy_pos.x = u.ux, dummy_pos.y = u.uy; /* starting spot for getpos() */
    save_autodescribe = iflags.autodescribe;
    iflags.autodescribe = TRUE;
    iflags.terrainmode = ter_typ;
    getpos(dummy_pos, FALSE, ter_explain);
    iflags.terrainmode = 0;
    iflags.autodescribe = save_autodescribe;
    } finally { stack_pop($frame); }
}

/* extracted from monster_detection() so can be shared by do_vicinity_map() */
function map_monst(mtmp, showtail) { /* void */
    let glyph = (monsym(mtmp.data) == ord(' '))
                ? detected_mon_to_glyph(mtmp, newsym_rn2)
                : mtmp.mtame
                  ? pet_to_glyph(mtmp, newsym_rn2)
                  : mon_to_glyph(mtmp, newsym_rn2);

    show_glyph(mtmp.mx, mtmp.my, glyph);

    if (showtail && mtmp.data == mons[PM_LONG_WORM])
        detect_wsegs(mtmp, 0);
}

/* this is checking whether a trap symbol represents a trapped chest,
   not whether a trapped chest is actually present */
export function trapped_chest_at(ttyp, x, y) { /* boolean */
    let mtmp;
    let otmp;

    if (!glyph_is_trap(glyph_at(x, y)))
        return FALSE;
    if (ttyp != TRAPPED_CHEST || (Hallucination() && rn2(20)))
        return FALSE;

    /*
     * TODO?  We should check containers recursively like the trap
     * detecting routine does.  Chests and large boxes do not nest in
     * themselves or each other, but could be contained inside statues.
     *
     * For farlook, we should also check for buried containers, but
     * for '^' command to examine adjacent trap glyph, we shouldn't.
     */

    /* on map, presence of any trappable container will do */
    if (sobj_at(CHEST, x, y) || sobj_at(LARGE_BOX, x, y))
        return TRUE;
    /* in inventory, we need to find one which is actually trapped */
    if (u_at(x, y)) {
        for (otmp = gi.invent; otmp; otmp = otmp.nobj)
            if (Is_box(otmp) && otmp.otrapped)
                return TRUE;
        if (u.usteed) { /* steed isn't on map so won't be found by m_at() */
            for (otmp = u.usteed.minvent; otmp; otmp = otmp.nobj)
                if (Is_box(otmp) && otmp.otrapped)
                    return TRUE;
        }
    }
    if ((mtmp = m_at(x, y)) != null)
        for (otmp = mtmp.minvent; otmp; otmp = otmp.nobj)
            if (Is_box(otmp) && otmp.otrapped)
                return TRUE;
    return FALSE;
}

/* this is checking whether a trap symbol represents a trapped door,
   not whether the door here is actually trapped */
export function trapped_door_at(ttyp, x, y) { /* boolean */
    let lev;

    if (!glyph_is_trap(glyph_at(x, y)))
        return FALSE;
    if (ttyp != TRAPPED_DOOR || (Hallucination() && rn2(20)))
        return FALSE;
    lev = levl()[x][y];
    if (!IS_DOOR(lev.typ))
        return FALSE;
    if ((lev.flags & (D_NODOOR | D_BROKEN | D_ISOPEN)) != 0
         && trapped_chest_at(ttyp, x, y))
        return FALSE;
    return TRUE;
}

/* recursively search obj for an object in class oclass, return 1st found */
export function o_in(obj, oclass) { /* struct obj * */
    let otmp;
    let temp;

    if (obj.oclass == oclass)
        return obj;
    /*
     * Note:  we exclude SchroedingersBox because the corpse it contains
     * isn't necessarily a corpse yet.  Resolving the status would lead
     * to complications if it turns out to be a live cat.  We know that
     * that Box can't contain anything else because putting something in
     * would resolve the cat/corpse situation and convert to ordinary box.
     */
    if (Has_contents(obj) && !SchroedingersBox(obj)) {
        for (otmp = obj.cobj; otmp; otmp = otmp.nobj)
            if (otmp.oclass == oclass)
                return otmp;
            else if (Has_contents(otmp) && (temp = o_in(otmp, oclass)) != null)
                return temp;
    }
    return null;
}

/* Recursively search obj for an object made of specified material.
 * Return first found.
 */
export function o_material(obj, material) { /* struct obj * */
    let otmp;
    let temp;

    if (objects[obj.otyp].oc_material == material)
        return obj;

    if (Has_contents(obj)) {
        for (otmp = obj.cobj; otmp; otmp = otmp.nobj)
            if (objects[otmp.otyp].oc_material == material)
                return otmp;
            else if (Has_contents(otmp)
                     && (temp = o_material(otmp, material)) != null)
                return temp;
    }
    return null;
}

function observe_recursively(obj) { /* void */
    let otmp;

    observe_object(obj);
    if (Has_contents(obj)) {
        for (otmp = obj.cobj; otmp; otmp = otmp.nobj)
            observe_recursively(otmp);
    }
}

/* Check whether the location has an outdated object displayed on it. */
function check_map_spot(x, y, oclass, material) { /* boolean */
    let glyph;
    let otmp;
    let mtmp;

    glyph = glyph_at(x, y);
    if (glyph_is_object(glyph)) {
        /* there's some object shown here */
        if (oclass == ALL_CLASSES) {
            return +!(svl.level.objects[x][y] /* stale if nothing here */
                     || ((mtmp = m_at(x, y)) != null && mtmp.minvent));
        } else {
            if (material
                && objects[glyph_to_obj(glyph)].oc_material == material) {
                /* object shown here is of interest because material matches */
                for (otmp = svl.level.objects[x][y]; otmp;
                     otmp = otmp.v.v_nexthere)
                    if (o_material(otmp, GOLD))
                        return FALSE;
                /* didn't find it; perhaps a monster is carrying it */
                if ((mtmp = m_at(x, y)) != null) {
                    for (otmp = mtmp.minvent; otmp; otmp = otmp.nobj)
                        if (o_material(otmp, GOLD))
                            return FALSE;
                }
                /* detection indicates removal of this object from the map */
                return TRUE;
            }
            if (oclass && objects[glyph_to_obj(glyph)].oc_class == oclass) {
                /* obj shown here is of interest because its class matches */
                for (otmp = svl.level.objects[x][y]; otmp;
                     otmp = otmp.v.v_nexthere)
                    if (o_in(otmp, oclass))
                        return FALSE;
                /* didn't find it; perhaps a monster is carrying it */
                if ((mtmp = m_at(x, y)) != null) {
                    for (otmp = mtmp.minvent; otmp; otmp = otmp.nobj)
                        if (o_in(otmp, oclass))
                            return FALSE;
                }
                /* detection indicates removal of this object from the map */
                return TRUE;
            }
        }
    }
    return FALSE;
}

/*
 * When doing detection, remove stale data from the map display (corpses
 * rotted away, objects carried away by monsters, etc) so that it won't
 * reappear after the detection has completed.  Return true if noticeable
 * change occurs.
 */
function clear_stale_map(oclass, material) { /* boolean */
    let zx, zy;
    let change_made = FALSE;

    for (zx = 1; zx < COLNO; zx++)
        for (zy = 0; zy < ROWNO; zy++)
            if (check_map_spot(zx, zy, oclass, material)) {
                unmap_object(zx, zy);
                change_made = TRUE;
            }

    return change_made;
}

/* look for gold, on the floor or in monsters' possession */
export function gold_detect(sobj) { /* int */
    const $frame = stack_frame(); try {
    var obj;
    var mtmp;
    var gold = stack_struct(struct_obj), temp = null;
    var stale, ugold = FALSE, steedgold = FALSE;
    var ter_typ = TER_DETECT | TER_OBJ;

    gk.known = stale = clear_stale_map(COIN_CLASS,
                                       (sobj.blessed ? GOLD : 0));

    /* look for gold carried by monsters (might be in a container) */
    outgoldmap: { for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (DEADMONSTER(mtmp) || (mtmp.isgd && !mtmp.mx))
            continue;
        if (findgold(mtmp.minvent) || monsndx(mtmp.data) == PM_GOLD_GOLEM) {
            if (mtmp == u.usteed) {
                steedgold = TRUE;
            } else {
                gk.known = TRUE;
                break outgoldmap; /* skip further searching */
            }
        } else {
            for (obj = mtmp.minvent; obj; obj = obj.nobj)
                if ((sobj.blessed && o_material(obj, GOLD))
                    || o_in(obj, COIN_CLASS)) {
                    if (mtmp == u.usteed) {
                        steedgold = TRUE;
                    } else {
                        gk.known = TRUE;
                        break outgoldmap; /* skip further searching */
                    }
                }
        }
    }

    /* look for gold objects */
    for (obj = fobj(); obj; obj = obj.nobj) {
        if (sobj.blessed && o_material(obj, GOLD)) {
            gk.known = TRUE;
            if (obj.ox != u.ux || obj.oy != u.uy)
                break outgoldmap;;
        } else if (o_in(obj, COIN_CLASS)) {
            gk.known = TRUE;
            if (obj.ox != u.ux || obj.oy != u.uy)
                break outgoldmap;;
        }
    }

    if (!gk.known) {
        /* no gold found on floor or monster's inventory.
           adjust message if you have gold in your inventory */
        var buf = stack_array(char, BUFSZ);

        if (gy.youmonst.data == mons[PM_GOLD_GOLEM])
            sprintf(buf, _("You feel like a million %s!"), currency(2));
        else if (money_cnt(gi.invent) || hidden_gold(TRUE))
            strcpy(buf, _("You feel worried about your future financial situation."));
        else if (steedgold)
            sprintf(buf, _("You feel interested in %s financial situation."), s_suffix(x_monnam(u.usteed,
                                      u.usteed.mtame ? ARTICLE_YOUR
                                                      : ARTICLE_THE,
                                      0,
                                      SUPPRESS_SADDLE, FALSE)));
        else
            strcpy(buf, _("You feel materially poor."))

;

        strange_feeling(sobj, buf);
        return 1;
    }
    /* only under me - no separate display required */
    if (stale)
        docrt();
    You(_("notice some gold between your %s."), makeplural(body_part(FOOT)));
    return 0;
 }
    cls();

    unconstrain_map();
    /* Discover gold locations. */
    for (obj = fobj(); obj; obj = obj.nobj) {
        if (sobj.blessed && (temp = o_material(obj, GOLD)) != null) {
            if (temp != obj) {
                temp.ox = obj.ox;
                temp.oy = obj.oy;
            }
            map_object(temp, 1);
        } else if ((temp = o_in(obj, COIN_CLASS)) != null) {
            if (temp != obj) {
                temp.ox = obj.ox;
                temp.oy = obj.oy;
            }
            map_object(temp, 1);
        }
        if (temp && (((temp.ox) == u.ux) && ((temp.oy) == u.uy)))
            ugold = TRUE;
    }
    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (DEADMONSTER(mtmp) || (mtmp.isgd && !mtmp.mx))
            continue;
        temp = null;
        if (findgold(mtmp.minvent) || monsndx(mtmp.data) == PM_GOLD_GOLEM) {
            struct_assign(gold, cg.zeroobj); /* ensure oextra is cleared too */
            gold.otyp = GOLD_PIECE;
            gold.quan = rnd(10); /* usually more than 1 */
            gold.ox = mtmp.mx;
            gold.oy = mtmp.my;
            map_object(gold, 1);
            temp = gold;
        } else {
            for (obj = mtmp.minvent; obj; obj = obj.nobj)
                if (sobj.blessed && (temp = o_material(obj, GOLD)) != null) {
                    temp.ox = mtmp.mx;
                    temp.oy = mtmp.my;
                    map_object(temp, 1);
                    break;
                } else if ((temp = o_in(obj, COIN_CLASS)) != null) {
                    temp.ox = mtmp.mx;
                    temp.oy = mtmp.my;
                    map_object(temp, 1);
                    break;
                }
        }
        if (temp && (((temp.ox) == u.ux) && ((temp.oy) == u.uy)))
            ugold = TRUE;
    }
    if (!ugold) {
        newsym(u.ux, u.uy);
        ter_typ = int(ter_typ | TER_MON); /* so autodescribe will recognize hero */
    }
    You_feel(_("very greedy, and sense gold!"));
    exercise(A_WIS, TRUE);

    browse_map(unsigned(ter_typ), _("gold"));

    map_redisplay();
    return 0;
    } finally { stack_pop($frame); }
}

/* returns 1 if nothing was detected, 0 if something was detected */
export function food_detect(sobj) { /* int */
    const $frame = stack_frame(); try {
    let obj;
    let mtmp;
    let ct = 0, ctu = 0;
    let confused = (Confusion() || (sobj && sobj.cursed) ? 1 : 0), stale;
    let oclass = confused ? POTION_CLASS : FOOD_CLASS;
    let what = confused ? something() : _("food");

    stale = clear_stale_map(oclass, 0);
    if (u.usteed) /* some situations leave steed with stale coordinates */
        u.usteed.mx = u.ux, u.usteed.my = u.uy;

    for (obj = fobj(); obj; obj = obj.nobj)
        if (o_in(obj, oclass)) {
            if ((((obj.ox) == u.ux) && ((obj.oy) == u.uy)))
                ctu++;
            else
                ct++;
        }
    for (mtmp = fmon(); mtmp && (!ct || !ctu); mtmp = mtmp.nmon) {
        if (DEADMONSTER(mtmp) || (mtmp.isgd && !mtmp.mx))
            continue;
        for (obj = mtmp.minvent; obj; obj = obj.nobj)
            if (o_in(obj, oclass)) {
                if ((((mtmp.mx) == u.ux) && ((mtmp.my) == u.uy)))
                    ctu++; /* steed or an engulfer with inventory */
                else
                    ct++;
                break;
            }
    }

    if (!ct && !ctu) {
        gk.known = (stale && !confused ? 1 : 0);
        if (stale) {
            docrt();
            You(_("sense a lack of %s nearby."), what);
            if (sobj && sobj.blessed) {
                if (!u.uedibility)
                    Your(_("%s starts to tingle."), body_part(NOSE));
                u.uedibility = 1;
            }
        } else if (sobj) {
            let buf = stack_array(char, BUFSZ);

            sprintf(buf, _("Your %s twitches%s."), body_part(NOSE), (sobj.blessed && !u.uedibility)
                        ? _(" then starts to tingle")
                        : _(""))
;
            if (sobj.blessed && !u.uedibility) {
                let savebeginner = flags.beginner;

                flags.beginner = FALSE; /* prevent non-delivery of message */
                strange_feeling(sobj, buf);
                flags.beginner = savebeginner;
                u.uedibility = 1;
            } else
                strange_feeling(sobj, buf);
        }
        return +!stale;
    } else if (!ct) {
        gk.known = TRUE;
        You(_("%s %s nearby."), sobj ? _("smell") : _("sense"), what);
        if (sobj && sobj.blessed) {
            if (!u.uedibility)
                Your(_("%s starts to tingle."), body_part(NOSE));
            u.uedibility = 1;
        }
    } else {
        let temp;
        let ter_typ = TER_DETECT | TER_OBJ;

        gk.known = TRUE;
        cls();
        unconstrain_map();
        for (obj = fobj(); obj; obj = obj.nobj)
            if ((temp = o_in(obj, oclass)) != null) {
                if (temp != obj) {
                    temp.ox = obj.ox;
                    temp.oy = obj.oy;
                }
                map_object(temp, 1);
            }
        for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
            if (DEADMONSTER(mtmp) || (mtmp.isgd && !mtmp.mx))
                continue;
            for (obj = mtmp.minvent; obj; obj = obj.nobj)
                if ((temp = o_in(obj, oclass)) != null) {
                    temp.ox = mtmp.mx;
                    temp.oy = mtmp.my;
                    map_object(temp, 1);
                    break; /* skip rest of this monster's inventory */
                }
        }
        if (!ctu) {
            newsym(u.ux, u.uy);
            ter_typ = int(ter_typ | TER_MON); /* for autodescribe of self */
        }
        if (sobj) {
            if (sobj.blessed) {
                Your(_("%s %s to tingle and you smell %s."), body_part(NOSE),
                     u.uedibility ? _("continues") : _("starts"), what);
                u.uedibility = 1;
            } else
                Your(_("%s tingles and you smell %s."), body_part(NOSE), what);
        } else
            You(_("sense %s."), what);
        exercise(A_WIS, TRUE);

        browse_map(unsigned(ter_typ), _("food"));

        map_redisplay();
    }
    return 0;
    } finally { stack_pop($frame); }
}

/*
 * Used for scrolls, potions, spells, and crystal balls.  Returns:
 *
 *      1 - nothing was detected
 *      0 - something was detected
 */
export function object_detect(detector,
              class_) { /* int */ /* an object class, 0 for all */
    const $frame = stack_frame(); try {
    let x, y;
    let stuff = stack_array(char, BUFSZ);
    let is_cursed = (detector && detector.cursed ? 1 : 0);
    let do_dknown = (detector && (detector.oclass == POTION_CLASS
                                  || detector.oclass == SPBOOK_CLASS)
                     && detector.blessed ? 1 : 0);
    let ct = 0, ctu = 0;
    let obj, otmp = null;
    let mtmp;
    let sym, boulder = 0, ter_typ = TER_DETECT | TER_OBJ;

    if (class_ < 0 || class_ >= MAXOCLASSES) {
        impossible(_("object_detect:  illegal class %d"), class_);
        class_ = 0;
    }

    /* Special boulder symbol check - does the class symbol happen
     * to match showsyms[SYM_BOULDER + SYM_OFF_X] which is user-defined.
     * If so, that means we aren't sure what they really wanted to
     * detect. Rather than trump anything, show both possibilities.
     * We can exclude checking the buried obj chain for boulders below.
     */
    sym = class_ ? def_oc_syms[class_].sym : 0;
    if (sym && sym == uchars[gs.showsyms + (SYM_BOULDER + SYM_OFF_X)])
        boulder = ROCK_CLASS;

    if (Hallucination() || (Confusion() && class_ == SCROLL_CLASS))
        strcpy(stuff, something());
    else
        strcpy(stuff, class_ ? def_oc_syms[class_].name : _("objects"));
    if (boulder && class_ != ROCK_CLASS)
        strcat(stuff, _(" and/or large stones"));

    if (do_dknown)
        for (obj = gi.invent; obj; obj = obj.nobj)
            observe_recursively(obj);

    for (obj = fobj(); obj; obj = obj.nobj) {
        if ((!class_ && !boulder) || o_in(obj, class_) || o_in(obj, boulder)) {
            if ((((obj.ox) == u.ux) && ((obj.oy) == u.uy)))
                ctu++;
            else
                ct++;
        }
        if (do_dknown)
            observe_recursively(obj);
    }

    for (obj = svl.level.buriedobjlist; obj; obj = obj.nobj) {
        if (!class_ || o_in(obj, class_)) {
            if ((((obj.ox) == u.ux) && ((obj.oy) == u.uy)))
                ctu++;
            else
                ct++;
        }
        if (do_dknown)
            observe_recursively(obj);
    }

    if (u.usteed)
        u.usteed.mx = u.ux, u.usteed.my = u.uy;

    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (DEADMONSTER(mtmp) || (mtmp.isgd && !mtmp.mx))
            continue;
        for (obj = mtmp.minvent; obj; obj = obj.nobj) {
            if ((!class_ && !boulder) || o_in(obj, class_)
                || o_in(obj, boulder))
                ct++;
            if (do_dknown)
                observe_recursively(obj);
        }
        if ((is_cursed && M_AP_TYPE(mtmp) == M_AP_OBJECT
             && (!class_ || class_ == objects[mtmp.mappearance].oc_class))
            || (findgold(mtmp.minvent) && (!class_ || class_ == COIN_CLASS))) {
            ct++;
            break;
        }
    }

    if (!clear_stale_map(!class_ ? ALL_CLASSES : class_, 0) && !ct) {
        if (!ctu) {
            if (detector)
                strange_feeling(detector, _("You feel a lack of something."));
            return 1;
        }
        You(_("sense %s nearby."), stuff);
        return 0;
    }

    cls();

    unconstrain_map();
    /*
     *  Map all buried objects first.
     */
    for (obj = svl.level.buriedobjlist; obj; obj = obj.nobj)
        if (!class_ || (otmp = o_in(obj, class_)) != null) {
            if (class_) {
                if (otmp != obj) {
                    otmp.ox = obj.ox;
                    otmp.oy = obj.oy;
                }
                map_object(otmp, 1);
            } else
                map_object(obj, 1);
        }
    /*
     * If we are mapping all objects, map only the top object of a pile or
     * the first object in a monster's inventory.  Otherwise, go looking
     * for a matching object class and display the first one encountered
     * at each location.
     *
     * Objects on the floor override buried objects.
     */
    for (x = 1; x < COLNO; x++)
        for (y = 0; y < ROWNO; y++)
            for (obj = svl.level.objects[x][y]; obj; obj = obj.v.v_nexthere)
                if ((!class_ && !boulder) || (otmp = o_in(obj, class_)) != null
                    || (otmp = o_in(obj, boulder)) != null) {
                    if (class_ || boulder) {
                        if (otmp != obj) {
                            otmp.ox = obj.ox;
                            otmp.oy = obj.oy;
                        }
                        map_object(otmp, 1);
                    } else
                        map_object(obj, 1);
                    break;
                }

    /* Objects in the monster's inventory override floor objects. */
    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (DEADMONSTER(mtmp) || (mtmp.isgd && !mtmp.mx))
            continue;
        for (obj = mtmp.minvent; obj; obj = obj.nobj)
            if ((!class_ && !boulder) || (otmp = o_in(obj, class_)) != null
                || (otmp = o_in(obj, boulder)) != null) {
                if (!class_ && !boulder)
                    otmp = obj;
                otmp.ox = mtmp.mx; /* at monster location */
                otmp.oy = mtmp.my;
                map_object(otmp, 1);
                break;
            }
        /* Allow a mimic to override the detected objects it is carrying. */
        if (is_cursed && M_AP_TYPE(mtmp) == M_AP_OBJECT
            && (!class_ || class_ == objects[mtmp.mappearance].oc_class)) {
            let temp = stack_struct(struct_obj);

            struct_assign(temp, cg.zeroobj);
            temp.otyp = short(mtmp.mappearance); /* needed for obj_to_glyph() */
            temp.quan = 1;
            temp.ox = mtmp.mx;
            temp.oy = mtmp.my;
            /* used for mimicking a corpse or statue */
            temp.corpsenm = has_mcorpsenm(mtmp) ? MCORPSENM(mtmp) : PM_TENGU;
            map_object(temp, 1);
        } else if (findgold(mtmp.minvent)
                   && (!class_ || class_ == COIN_CLASS)) {
            let gold = stack_struct(struct_obj);

            struct_assign(gold, cg.zeroobj); /* ensure oextra is cleared too */
            gold.otyp = GOLD_PIECE;
            gold.quan = rnd(10); /* usually more than 1 */
            gold.ox = mtmp.mx;
            gold.oy = mtmp.my;
            map_object(gold, 1);
        }
    }
    if (!glyph_is_object(glyph_at(u.ux, u.uy))) {
        newsym(u.ux, u.uy);
        ter_typ = int(ter_typ | TER_MON);
    }
    You(_("detect the %s of %s."), ct ? _("presence") : _("absence"), stuff);

    if (!ct)
        display_nhwindow()(WIN_MAP, TRUE);
    else
        browse_map(unsigned(ter_typ), _("object"));

    map_redisplay();
    return 0;
    } finally { stack_pop($frame); }
}

/*
 * Used by: crystal balls, potions, fountains
 *
 * Returns 1 if nothing was detected.
 * Returns 0 if something was detected.
 */
export function monster_detect(otmp,
               mclass) { /* int */ /* monster class, 0 for all */
    let mtmp;
    let mcnt = 0;

    /* Note: This used to just check fmon for a non-zero value
     * but in versions since 3.3.0 fmon can test TRUE due to the
     * presence of dmons, so we have to find at least one
     * with positive hit-points to know for sure.
     */
    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (DEADMONSTER(mtmp) || (mtmp.isgd && !mtmp.mx))
            continue;
        ++mcnt;
        break; /* no need for full count, just 1 or more vs 0 */
    }

    if (!mcnt) {
        if (otmp)
            strange_feeling(otmp, Hallucination()
                                      ? _("You get the heebie jeebies.")
                                      : _("You feel threatened."));
        return 1;
    } else {
        let unconstrained, woken = FALSE;
        let swallowed = u.uswallow; /* before unconstrain_map() */

        cls();
        unconstrained = unconstrain_map();
        for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
            if (DEADMONSTER(mtmp) || (mtmp.isgd && !mtmp.mx))
                continue;
            if (!mclass || mtmp.data.mlet == mclass
                || (mtmp.data == mons[PM_LONG_WORM]
                    && mclass == S_WORM_TAIL))
                map_monst(mtmp, TRUE);

            if (otmp && otmp.cursed && helpless(mtmp)) {
                mtmp.msleeping = mtmp.mfrozen = 0;
                mtmp.mcanmove = 1;
                woken = TRUE;
            }
        }
        if (!swallowed)
            display_self();
        You(_("sense the presence of monsters."));
        if (woken)
            pline(_("Monsters sense the presence of you."));

        if ((otmp && otmp.blessed) && !unconstrained) {
            /* persistent detection--just show updated map */
            display_nhwindow()(WIN_MAP, TRUE);
        } else {
            /* one-shot detection--allow player to move cursor around and
               get autodescribe feedback */
            u.uprops[DETECT_MONSTERS].extrinsic = or64(u.uprops[DETECT_MONSTERS].extrinsic, I_SPECIAL);
            browse_map(TER_DETECT | TER_MON, _("monster of interest"));
            u.uprops[DETECT_MONSTERS].extrinsic = and64(u.uprops[DETECT_MONSTERS].extrinsic, ~I_SPECIAL);
        }

        map_redisplay();
    }
    return 0;
}

function sense_trap(trap, x, y, src_cursed) { /* void */
    const $frame = stack_frame(); try {
    if (Hallucination() || src_cursed) {
        let obj = stack_struct(struct_obj); /* fake object */

        struct_assign(obj, cg.zeroobj);
        if (trap) {
            obj.ox = trap.tx;
            obj.oy = trap.ty;
        } else {
            obj.ox = x;
            obj.oy = y;
        }
        obj.otyp = !Hallucination() ? GOLD_PIECE : random_object(rn2);
        obj.quan = ((obj.otyp == GOLD_PIECE) ? rnd(10)
                           : objects[obj.otyp].oc_merge ? rnd(2) : 1);
        obj.corpsenm = random_monster(rn2); /* if otyp == CORPSE */
        map_object(obj, 1);
    } else if (trap) {
        map_trap(trap, 1);
        trap.tseen = 1;
    } else {
        /*
         * OBSOLETE; this was for trapped door or trapped chest
         * but those are handled by 'if (trap) {map_trap()}' now
         * and this block of code shouldn't be reachable anymore.
         */
        dummytrap.tx = x;
        dummytrap.ty = y;
        dummytrap.ttyp = BEAR_TRAP; /* some kind of trap */
        map_trap(dummytrap, 1);
    }
    } finally { stack_pop($frame); }
}

export const OTRAP_NONE = 0;
export const OTRAP_HERE = 1;
export const OTRAP_THERE = 2;

/* check a list of objects for chest traps; return 1 if found at <ux,uy>,
   2 if found at some other spot, 3 if both, 0 otherwise; optionally
   update the map to show where such traps were found */
function detect_obj_traps(
    objlist,
    show_them,
    how,
    ft) { /* int */ /* being called by findone() when non-Null */
    const $frame = stack_frame(); try {
    let otmp;
    let x = stack_var(coordxy), y = stack_var(coordxy);
    let trapglyph, result = OTRAP_NONE;

    /*
     * TODO?  Display locations of unarmed land mine and beartrap objects.
     * If so, should they be displayed as objects or as traps?
     */

    dummytrap.ttyp = TRAPPED_CHEST;
    trapglyph = ft ? trap_to_glyph(dummytrap) : GLYPH_NOTHING;
    for (otmp = objlist; otmp; otmp = otmp.nobj) {
        x[0] = y[0] = 0; /* lint suppression */
        if ((Is_box(otmp) && otmp.otrapped) || Has_contents(otmp)) {
            /* !get_obj_location and !isok should both be impossible here */
            if (!get_obj_location(otmp, x, y, BURIED_TOO | CONTAINED_TOO)
                || !isok(x[0], y[0])
                || (ft && (x[0] != ft.ft_cc.x || y[0] != ft.ft_cc.y)))
                continue;
        }
        if (Is_box(otmp) && otmp.otrapped) {
            otmp.tknown = 1;
            observe_object(otmp);
            result |= u_at(x[0], y[0]) ? OTRAP_HERE : OTRAP_THERE;
            if (ft) {
                flash_glyph_at(x[0], y[0], trapglyph, FOUND_FLASH_COUNT);
            }
            if (show_them) {
                dummytrap.tx = x[0], dummytrap.ty = y[0];
                sense_trap(dummytrap, x[0], y[0], how);
            }
            if (ft) {
                foundone(x[0], y[0], trapglyph);
                ft.num_traps++;
            }
        }
        if (Has_contents(otmp))
            result |= detect_obj_traps(otmp.cobj, show_them, how, ft);
    }
    return result;
    } finally { stack_pop($frame); }
}

function display_trap_map(cursed_src) { /* void */
    const $frame = stack_frame(); try {
    let mon;
    let ttmp;
    let door, glyph, ter_typ = TER_DETECT | (cursed_src ? TER_OBJ : TER_TRP);
    let cc = stack_struct(struct_nhcoord);

    cls();

    unconstrain_map();
    /* show chest traps first, first buried chests then floor chests, so
       that subsequent floor trap display will override if both types are
       present at the same location */
    detect_obj_traps(svl.level.buriedobjlist, TRUE, cursed_src, null);
    detect_obj_traps(fobj(), TRUE, cursed_src, null);
    for (mon = fmon(); mon; mon = mon.nmon) {
        if (DEADMONSTER(mon) || (mon.isgd && !mon.mx))
            continue;
        detect_obj_traps(mon.minvent, TRUE, cursed_src, null);
    }
    detect_obj_traps(gi.invent, TRUE, cursed_src, null);

    for (ttmp = gf.ftrap; ttmp; ttmp = ttmp.ntrap)
        sense_trap(ttmp, 0, 0, cursed_src);

    dummytrap.ttyp = TRAPPED_DOOR;
    for (door = 0; door < gd.doorindex; door++) {
        struct_assign(cc, ptr_add(svd.doors, door));
        if (levl()[cc.x][cc.y].typ == SDOOR) /* can't be trapped; see above */
            continue;
        if (levl()[cc.x][cc.y].flags & D_TRAPPED) {
            dummytrap.tx = cc.x, dummytrap.ty = cc.y;
            sense_trap(dummytrap, cc.x, cc.y, cursed_src);
        }
    }

    /* redisplay hero unless sense_trap() revealed something at <ux,uy> */
    glyph = glyph_at(u.ux, u.uy);
    if (!(glyph_is_trap(glyph) || glyph_is_object(glyph))) {
        newsym(u.ux, u.uy);
        ter_typ = int(ter_typ | TER_MON); /* for autodescribe at <u.ux,u.uy> */
    }
    You_feel(_("%s."), cursed_src ? _("very greedy") : _("entrapped"));

    browse_map(unsigned(ter_typ), cursed_src ? _("gold") : _("trap of interest"));

    map_redisplay();
    } finally { stack_pop($frame); }
}

/* the detections are pulled out so they can
 * also be used in the crystal ball routine
 * returns 1 if nothing was detected
 * returns 0 if something was detected
 */
export function trap_detect(
    sobj) { /* int */ /* Null if crystal ball, scroll if gold detection */
    const $frame = stack_frame(); try {
    let ttmp;
    let mon;
    let door, tr;
    let cursed_src = (sobj && sobj.cursed ? 1 : 0);
    let found = FALSE;
    let cc = stack_struct(struct_nhcoord);

    if (u.usteed)
        u.usteed.mx = u.ux, u.usteed.my = u.uy;

    /* floor/ceiling traps */
    for (ttmp = gf.ftrap; ttmp; ttmp = ttmp.ntrap) {
        if (ttmp.tx != u.ux || ttmp.ty != u.uy) {
            display_trap_map(cursed_src);
            return 0;
        }
        found = TRUE;
    }
    /* chest traps (might be buried or carried) */
    if ((tr = detect_obj_traps(fobj(), FALSE, 0, null)) != OTRAP_NONE) {
        if (tr & OTRAP_THERE) {
            display_trap_map(cursed_src);
            return 0;
        }
        found = TRUE;
    }
    if ((tr = detect_obj_traps(svl.level.buriedobjlist, FALSE, 0, null))
        != OTRAP_NONE) {
        if (tr & OTRAP_THERE) {
            display_trap_map(cursed_src);
            return 0;
        }
        found = TRUE;
    }
    for (mon = fmon(); mon; mon = mon.nmon) {
        if (DEADMONSTER(mon) || (mon.isgd && !mon.mx))
            continue;
        if ((tr = detect_obj_traps(mon.minvent, FALSE, 0, null))
            != OTRAP_NONE) {
            if (tr & OTRAP_THERE) {
                display_trap_map(cursed_src);
                return 0;
            }
            found = TRUE;
        }
    }
    if (detect_obj_traps(gi.invent, FALSE, 0, null) != OTRAP_NONE)
        found = TRUE;
    /* door traps */
    for (door = 0; door < gd.doorindex; door++) {
        struct_assign(cc, ptr_add(svd.doors, door));
        /* levl[][].doormask and .wall_info both overlay levl[][].flags;
           the bit in doormask for D_TRAPPED is also a bit in wall_info;
           secret doors use wall_info so can't be marked as trapped */
        if (levl()[cc.x][cc.y].typ == SDOOR)
            continue;
        if (levl()[cc.x][cc.y].flags & D_TRAPPED) {
            if (cc.x != u.ux || cc.y != u.uy) {
                display_trap_map(cursed_src);
                return 0;
            }
            found = TRUE;
        }
    }
    if (!found) {
        let buf = stack_array(char, BUFSZ);

        sprintf(buf, _("Your %s stop itching."), makeplural(body_part(TOE)));
        strange_feeling(sobj, buf);
        return 1;
    }
    /* traps exist, but only under me - no separate display required */
    Your(_("%s itch."), makeplural(body_part(TOE)));
    return 0;
    } finally { stack_pop($frame); }
}

function furniture_detect() { /* int */
    let mon;
    let x, y;
    let glyph, sym, found = 0, revealed = 0;

    unconstrain_map();

    for (y = 0; y < ROWNO; ++y)
        for (x = 1; x < COLNO; ++x) {
            glyph = glyph_at(x, y);
            sym = glyph_to_cmap(glyph);
            if (IS_FURNITURE(levl()[x][y].typ)) {
                ++found;
                magic_map_background(x, y, 1);
            } else if (is_cmap_furniture(sym)) {
                ++found;
                if ((mon = m_at(x, y)) != null
                    && M_AP_TYPE(mon) == M_AP_FURNITURE)
                    seemimic(mon);
                if (!mon || !canspotmon(mon))
                    map_invisible(x, y);
            }
            if (glyph_at(x, y) != glyph)
                ++revealed;
        }

    if (!found)
        There(_("seems to be nothing of interest on this level."));
    else if (!revealed)
        /* [what about clipped map with points of interest outside of the
            currently shown area?] */
        Your(_("map already shows all relevant locations."));

    if (!revealed)
        display_nhwindow()(WIN_MAP, TRUE);
    else /* we need to browse all types because we haven't redrawn the map
          * with only points of interest */
        browse_map(TER_DETECT | TER_MAP | TER_TRP | TER_OBJ | TER_MON,
                   _("location"));

    map_redisplay();
    return 0;
}

/* way back in 3.0plN and/or 2.x, you could use a crystal ball to find out
   where the wizard was relative to your current location; that was when the
   Wizard guarded the Amulet and was located on a random maze level, and you
   were expected to level teleport deep into Hell and hunt for him while
   working your way up; this isn't of much use anymore */
export function level_distance(where) { /* const char * */
    let ll = depth(u.uz) - depth(where);
    let indun = +(u.uz.dnum == where.dnum);
    let res = _(""); /* always replaced by some other non-Null value */

    if (ll < 0) {
        if (ll < (-8 - rn2(3)))
            if (!indun)
                res = _("far away");
            else
                res = _("far below");
        else if (ll < -1)
            if (!indun)
                res = _("away below you");
            else
                res = _("below you");
        else if (!indun)
            res = _("in the distance");
        else
            res = _("just below");
    } else if (ll > 0) {
        if (ll > (8 + rn2(3)))
            if (!indun)
                res = _("far away");
            else
                res = _("far above");
        else if (ll > 1)
            if (!indun)
                res = _("away above you");
            else
                res = _("above you");
        else if (!indun)
            res = _("in the distance");
        else
            res = _("just above");
    } else { /* l1 == 0 */
        if (!indun)
            res = _("in the distance");
        else
            res = _("near you");
    }
    return res;
}

    /*
     * This could be made a lot more useful.  Especially now that
     * amnesia no longer causes levels to be forgotten.  Perhaps a
     * menu, and it ought to include the entrance to Vlad's Tower,
     * one of the few things that requires active searching/mapping
     * to find.  And once the Wizard is in play, he is easy for the
     * game to locate but not necessarily for the player.
     */
  const struct_crystalballlevels = struct("struct_crystalballlevels", {
    what: ptr_to(char),
    where: ptr_to("struct_d_level"),
}); const level_detects = static_array("level_detects", struct_crystalballlevels, null, [
    { what: _("Delphi"), where: svd.dungeon_topology.d_oracle_level },
    { what: _("Medusa's lair"), where: svd.dungeon_topology.d_medusa_level },
    { what: _("a castle"), where: svd.dungeon_topology.d_stronghold_level },
    { what: _("the Wizard of Yendor's tower"), where: svd.dungeon_topology.d_wiz1_level },
]);

export function use_crystal_ball(optr) { /* void */
    let $goto = null;
    var ch;
    var oops;
    var obj = optr[0];
    var charged = +(obj.spe > 0);

    if (Blind()) {
        pline(_("Too bad you can't see %s."), the(xname(obj)));
        return;
    }
    oops = is_quest_artifact(obj) ? 8 : obj.blessed ? 16 : 20;
    if (charged && (obj.cursed || rnd(oops) > ACURR(A_INT))) {
        var impair = rnd(100 - 3 * ACURR(A_INT));

        switch (rnd((obj.oartifact || obj.blessed) ? 4 : 5)) {
        case 1:
            pline(_("%s too much to comprehend!"), Tobjnam(obj, _("are")));
            break;
        case 2:
            pline(_("%s you!"), Tobjnam(obj, _("confuse")));
            make_confused((HConfusion() & TIMEOUT) + impair, FALSE);
            break;
        case 3:
            if (!resists_blnd(gy.youmonst)) {
                pline(_("%s your vision!"), Tobjnam(obj, _("damage")));
                make_blinded(BlindedTimeout() + impair, FALSE);
                if (!Blind())
                    Your1(vision_clears());
            } else {
                pline(_("%s your vision."), Tobjnam(obj, _("assault")));
                You(_("are unaffected!"));
            }
            break;
        case 4:
            pline(_("%s your mind!"), Tobjnam(obj, _("zap")));
            make_hallucinated((HHallucination() & TIMEOUT) + impair,
                                     FALSE, 0);
            break;
        case 5:
            pline(_("%s!"), Tobjnam(obj, _("explode")));
            useup(obj);
            optr[0] = obj = null; /* it's gone */
            /* physical damage cause by the shards and force */
            losehp(((Half_physical_damage()) ? (Math.trunc((((rnd(30)) + 1) / 2))) : (rnd(30))), _("exploding crystal ball"),
                   KILLED_BY_AN);
            break;
        }
        if (obj)
            consume_obj_charge(obj, TRUE);
        return;
    }

    $goto_implode: for (;;) { switch ($goto) { default: if (Hallucination()) {
        nomul(-rnd(charged ? 4 : 2));
        gm.multi_reason = _("gazing into a Magic 8-Ball (tm)");
        gn.nomovemsg = _("");

        if (!charged) {
            pline(_("All you see is funky %s haze."), hcolor(0));
            if (obj.spe < 0)
                { $goto = "implode"; continue $goto_implode; }; /* destroy it when it has been cancelled */
        } else {
            switch (rnd(6)) {
            case 1:
                You(_("grok some groovy globs of incandescent lava."));
                break;
            case 2:
                pline(_("Whoa!  Psychedelic colors, %s!"),
                      poly_gender() == 1 ? _("babe") : _("dude"));
                break;
            case 3:
                pline_The(_("crystal pulses with sinister %s light!"),
                          hcolor(0));
                break;
            case 4:
                You_see(_("goldfish swimming above fluorescent rocks."));
                break;
            case 5:
                You_see(
                    _("tiny snowflakes spinning around a miniature farmhouse."));
                break;
            default:
                pline(_("Oh wow... like a kaleidoscope!"));
                break;
            }
            consume_obj_charge(obj, TRUE);
        }
        return;
    }

    /* read a single character */
    if (flags.verbose)
        You(_("may look for an object, monster, or special map symbol."));
    ch = yn_function(_("What do you look for?"), 0, ord('\0'), TRUE);
    /* Don't filter out ' ' here; it has a use */
    if ((ch != def_monsyms[S_GHOST].sym) && strchr(quitchars, ch)) {
        if (flags.verbose)
            pline1(Never_mind());
        return;
    }
    /* Possible extension:
     *  If ch=='?', ask whether player wants to find scrolls or is asking
     *  for help in using the crystal ball.
     */

    You(_("peer into %s..."), the(xname(obj)));
    nomul(-rnd(charged ? 10 : 2));
    gm.multi_reason = _("gazing into a crystal ball");
    gn.nomovemsg = _("");

    case "implode": if ($goto || (!charged)) {
        switch ($goto) { default: pline_The(_("vision is unclear."));

        case "implode": if ($goto || (obj.spe < 0)) { /* destroy ball if used after being cancelled */
 $goto = null;   /* no damage to hero but 'multi' has a small negative value */
            pline(_("%s!"), Tobjnam(obj, _("implode")));
            useup(obj);
            optr[0] = obj = null; /* it's gone */
            return;
        } }
    } else {
        var class_, i;
        var ret = 0;

        makeknown(CRYSTAL_BALL);
        consume_obj_charge(obj, TRUE);

        /* special case: accept ']' as synonym for mimic
         * we have to do this before the def_char_to_objclass check
         */
        if (ch == DEF_MIMIC_DEF)
            ch = DEF_MIMIC;

        /* checking furniture before objects allows '_' to find altars
           (along with other furniture) instead of finding iron chains */
        if (def_char_is_furniture(ch) >= 0) {
            ret = furniture_detect();
        } else if ((class_ = def_char_to_objclass(ch)) != MAXOCLASSES) {
            ret = object_detect(null, class_);
        } else if ((class_ = def_char_to_monclass(ch)) != MAXMCLASSES) {
            ret = monster_detect(null, class_);
        } else if (uchars[gs.showsyms + (SYM_BOULDER + SYM_OFF_X)]
                 && (ch == uchars[gs.showsyms + (SYM_BOULDER + SYM_OFF_X)])) {
            ret = object_detect(null, ROCK_CLASS);
        } else if (ch == ord('^')) {
            ret = trap_detect(null);
        } else {
            i = rn2(SIZE(level_detects));
            You_see(_("%s, %s."), level_detects[i].what,
                    level_distance(level_detects[i].where));
            ret = 0;
        }

        if (ret) {
            if (!rn2(100)) /* make them nervous */
                You_see(_("the Wizard of Yendor gazing out at you."));
            else
                pline_The(_("vision is unclear."));
        }
    } } break; }
    return;
}

/* used by magic mapping, clairvoyance, and wand of probing */
export function show_map_spot(x, y, cnf) { /* void */
    let lev;
    let t;
    let ep;
    let oldglyph;

    if (cnf && rn2(7))
        return;
    lev = levl()[x][y];

    lev.seenv = SVALL;

    /* Secret corridors are found, but not secret doors. */
    if (lev.typ == SCORR) {
        lev.typ = CORR;
        unblock_point(x, y);
    }

    /*
     * Force the real background, then if it's not furniture and there's
     * a known trap there, display the trap, else if there was an object
     * shown there, redisplay the object.  So during mapping, furniture
     * takes precedence over traps, which take precedence over objects,
     * opposite to how normal vision behaves.
     */
    oldglyph = glyph_at(x, y);
    if (svl.level.flags.hero_memory) {
        magic_map_background(x, y, 0);
        newsym(x, y); /* show it, if not blocked */
    } else {
        magic_map_background(x, y, 1); /* display it */
    }
    if (!IS_FURNITURE(lev.typ)) {
        if ((t = t_at(x, y)) != null && t.tseen) {
            map_trap(t, 1);
        } else if ((ep = engr_at(x, y)) != null && !cnf) {
            map_engraving(ep, 1);
        } else if (glyph_is_trap(oldglyph) || glyph_is_object(oldglyph)) {
            show_glyph(x, y, oldglyph);
            if (svl.level.flags.hero_memory)
                lev.glyph = oldglyph;
        }
    }
    /* possibly update #overview */
    if (!cnf && lev.roomno >= ROOMOFFSET)
        room_discovered(lev.roomno - ROOMOFFSET);
}

export function do_mapping() { /* void */
    let zx, zy;
    let unconstrained;

    unconstrained = unconstrain_map();
    for (zx = 1; zx < COLNO; zx++)
        for (zy = 0; zy < ROWNO; zy++)
            show_map_spot(zx, zy, Confusion());

    if (!svl.level.flags.hero_memory || unconstrained) {
        flush_screen(1);                 /* flush temp screen */
        /* browse_map() instead of display_nhwindow(WIN_MAP, TRUE) */
        browse_map(TER_DETECT | TER_MAP | TER_TRP | TER_OBJ,
                   _("anything of interest"));
        map_redisplay(); /* calls reconstrain_map() and docrt() */
    } else {
        /* we only get here when unconstrained is False, so reconstrain_map
           will be a no-op; call it anyway */
        reconstrain_map();
    }
    exercise(A_WIS, TRUE);
}

/* clairvoyance */
export function do_vicinity_map(
    sobj) { /* void */ /* scroll--actually fake spellbook--object */
    let zx, zy;
    let mtmp;
    let otmp;
    let save_EDetect_mons;
    let save_viz_uyux;
    let unconstrained, refresh = FALSE,
            mdetected = FALSE, odetected = FALSE,

            extended = (sobj && (sobj.blessed || Clairvoyant()) ? 1 : 0),
            random_farsight = +!sobj;
    let newglyph, oldglyph,
        lo_y = ((u.uy - 5 < 0) ? 0 : u.uy - 5),
        hi_y = ((u.uy + 6 >= ROWNO) ? ROWNO - 1 : u.uy + 6),
        lo_x = ((u.ux - 9 < 1) ? 1 : u.ux - 9),
        hi_x = ((u.ux + 10 >= COLNO) ? COLNO - 1 : u.ux + 10),
        ter_typ = TER_DETECT | TER_MAP | TER_TRP | TER_OBJ;

    /*
     * 3.6.0 attempted to emphasize terrain over transient map
     * properties (monsters and objects) but that led to problems.
     * Notably, known trap would be displayed instead of a monster
     * on or in it and then the display remained that way after the
     * clairvoyant snapshot finished.  That could have been fixed by
     * issuing --More-- and then regular vision update, but we want
     * to avoid that when having a clairvoyant episode every N turns
     * (from donating to a temple priest or by carrying the Amulet).
     * Unlike when casting the spell, it is much too intrusive when
     * in the midst of walking around or combatting monsters.
     *
     * As of 3.6.2, show terrain, then object, then monster like regular
     * map updating, except in this case the map locations get marked
     * as seen from every direction rather than just from direction of
     * hero.  Skilled spell marks revealed objects as 'seen up close'
     * (but for piles, only the top item) and shows monsters as if
     * detected.  Non-skilled and timed clairvoyance reveals non-visible
     * monsters as 'remembered, unseen'.
     */

    /* if hero is engulfed, show engulfer at <u.ux,u.uy> */
    save_viz_uyux = char(uchars[gv.viz_array[u.uy] + u.ux]);
    if (u.uswallow)
        uchars[gv.viz_array[u.uy] + u.ux] |= IN_SIGHT; /* <x,y> are reversed, [y][x] */
    save_EDetect_mons = EDetect_monsters();
    /* for skilled spell, getpos() scanning of the map will display all
       monsters within range; otherwise, "unseen creature" will be shown */
    u.uprops[DETECT_MONSTERS].extrinsic = or64(u.uprops[DETECT_MONSTERS].extrinsic, I_SPECIAL);
    unconstrained = unconstrain_map();
    for (zx = lo_x; zx <= hi_x; zx++)
        for (zy = lo_y; zy <= hi_y; zy++) {
            oldglyph = glyph_at(zx, zy);
            /* this will remove 'remembered, unseen mon' (and objects) */
            show_map_spot(zx, zy, Confusion());
            /* if there are any objects here, see the top one */
            if (OBJ_AT(zx, zy)) {
                /* not vobj_at(); this is not vision-based access;
                   unlike object detection, we don't notice buried items */
                otmp = svl.level.objects[zx][zy];
                if (extended)
                    observe_object(otmp);
                map_object(otmp, TRUE);
                newglyph = glyph_at(zx, zy);
                /* if otmp is underwater, we'll need to redisplay the water */
                if (newglyph != oldglyph && covers_objects(zx, zy))
                    odetected = TRUE;
            }
            /* if there is a monster here, see or detect it,
               possibly as "remembered, unseen monster" */
            if ((mtmp = m_at(zx, zy)) != null
                && mtmp.mx == zx && mtmp.my == zy) { /* skip worm tails */
                /* if we're going to offer browse_map()/getpos() scanning of
                   the map and we're not doing extended/blessed clairvoyance
                   (hence must be swallowed or underwater), show "unseen
                   creature" unless map already displayed a monster here */
                if ((unconstrained || !svl.level.flags.hero_memory)
                    && !extended && (zx != u.ux || zy != u.uy)
                    && !glyph_is_monster(oldglyph))
                    map_invisible(zx, zy);
                else
                    map_monst(mtmp, FALSE);
                newglyph = glyph_at(zx, zy);
                if (extended && newglyph != oldglyph
                    && !glyph_is_invisible(newglyph))
                    mdetected = TRUE;
            }
        }

    /* when this instance of clairvoyance is random (see allmain()) and
       the only reason to browse the map is that previously undetected
       monster(s) or object(s) have been revealed, player can prevent
       the you-sense-your-surroundings message and browse operation from
       happening by setting 'quick_farsight' option; for clairvoyance
       spell, that option is ignored because the message and the pause
       for map browsing isn't as intrusive in that circumstance */
    if (random_farsight && flags.quick_farsight)
        mdetected = odetected = FALSE;

    if (!svl.level.flags.hero_memory || unconstrained
        || mdetected || odetected) {
        flush_screen(1);                 /* flush temp screen */
        /* the getpos() prompt from browse_map() is only shown when
           flags.verbose is set, but make this unconditional so that
           not-verbose users become aware of the prompting situation */
        You(_("sense your surroundings."));
        if (extended || glyph_is_monster(glyph_at(u.ux, u.uy)))
            ter_typ = int(ter_typ | TER_MON);
        browse_map(unsigned(ter_typ), _("anything of interest"));
        refresh = TRUE;
    }
    reconstrain_map();
    u.uprops[DETECT_MONSTERS].extrinsic = save_EDetect_mons;
    uchars[gv.viz_array[u.uy] + u.ux] = uchar(save_viz_uyux);

    /* replace monsters with remembered,unseen monster, then run
       see_monsters() to update visible ones and warned-of ones */
    for (zx = lo_x; zx <= hi_x; zx++)
        for (zy = lo_y; zy <= hi_y; zy++) {
            if (u_at(zx, zy))
                continue;
            newglyph = glyph_at(zx, zy);
            if (glyph_is_monster(newglyph)
                && glyph_to_mon(newglyph) != PM_LONG_WORM_TAIL) {
                /* map_invisible() was unconditional here but that made
                   remembered objects be forgotten for the case where a
                   monster is immediately redrawn by see_monsters() */
                if ((mtmp = m_at(zx, zy)) == null || !canspotmon(mtmp))
                    map_invisible(zx, zy);
            }
        }
    see_monsters();

    if (refresh)
        docrt();
}

/* convert a secret door into a normal door; it might be trapped */
export function cvt_sdoor_to_door(lev) { /* void */
    let newmask = lev.flags & ~WM_MASK;

    if (Is_rogue_level(u.uz)) {
        /* rogue didn't have doors, only doorways */
        newmask = D_NODOOR;
    } else {
        /* newly exposed door is closed */
        if (!(newmask & D_LOCKED))
            newmask |= D_CLOSED;
    }
    lev.typ = DOOR;
    lev.flags = unsigned(newmask);
    lev.candig = 0; /* clears 'candig' */
}

/* update the map for something which has just been found by wand of secret
   door detection or wizard mode ^E; will be called multiple times during a
   single operation if multiple things of interest are discovered */
function foundone(zx, zy, glyph) { /* void */
    if (glyph_is_cmap(glyph) || glyph_is_unexplored(glyph))
        levl()[zx][zy].seenv = SVALL;

    {
        let save_viz = uchars[gv.viz_array[zy] + zx];

        if (!Blind())
            uchars[gv.viz_array[zy] + zx] = COULD_SEE | IN_SIGHT;
        newsym(zx, zy);
        uchars[gv.viz_array[zy] + zx] = save_viz;
    }

/* #if FOUND_FLASH_COUNT == 0: not in this build */
}

/* find something at one location; this should find all somethings there
   since it is used for magical detection rather than physical searching */
function findone(zx, zy, whatfound) { /* void */
    let lev = levl()[zx][zy];
    let ttmp = t_at(zx, zy);
    let mtmp = m_at(zx, zy);
    let found_p = view_of(struct_found_things, whatfound);

    if (mtmp && (DEADMONSTER(mtmp) || (mtmp.isgd && !mtmp.mx)))
        mtmp = null;
    found_p.ft_cc.x = zx; /* needed by detect_obj_traps() */
    found_p.ft_cc.y = zy;

    if (lev.typ == SDOOR) {
        let sym = lev.horizontal ? S_hcdoor : S_vcdoor;

        flash_glyph_at(zx, zy, cmap_to_glyph(sym), FOUND_FLASH_COUNT);
        cvt_sdoor_to_door(lev); /* set lev->typ = DOOR */
        recalc_block_point(zx, zy);
        magic_map_background(zx, zy, 0);
        foundone(zx, zy, back_to_glyph(zx, zy));
        found_p.num_sdoors++;
    } else if (lev.typ == SCORR) {
        flash_glyph_at(zx, zy, cmap_to_glyph(S_corr), FOUND_FLASH_COUNT);
        lev.typ = CORR;
        unblock_point(zx, zy);
        magic_map_background(zx, zy, 0);
        foundone(zx, zy, cmap_to_glyph(S_corr));
        found_p.num_scorrs++;
    }

    if (ttmp && !ttmp.tseen
        /* [shouldn't successful 'find' reveal and activate statue traps?] */
        && ttmp.ttyp != STATUE_TRAP) {
        flash_glyph_at(zx, zy, trap_to_glyph(ttmp), FOUND_FLASH_COUNT);
        ttmp.tseen = 1;
        sense_trap(ttmp, zx, zy, 0); /* handles Hallucination */
        foundone(zx, zy, trap_to_glyph(ttmp));
        found_p.num_traps++;
    }
    if (closed_door(zx, zy) && (lev.flags & D_TRAPPED) != 0) {
        dummytrap.ttyp = TRAPPED_DOOR;
        dummytrap.tx = zx, dummytrap.ty = zy;
        flash_glyph_at(zx, zy, trap_to_glyph(dummytrap), FOUND_FLASH_COUNT);
        dummytrap.tseen = 1;
        sense_trap(dummytrap, zx, zy, 0); /* handles Hallucination */
        foundone(zx, zy, trap_to_glyph(dummytrap));
        found_p.num_traps++;
    }
    /* trapped chests */
    detect_obj_traps(svl.level.buriedobjlist, TRUE, 0, found_p);
    detect_obj_traps(fobj(), TRUE, 0, found_p);
    if (mtmp)
        detect_obj_traps(mtmp.minvent, TRUE, 0, found_p);
    if (u_at(zx, zy))
        detect_obj_traps(gi.invent, TRUE, 0, found_p);

    if (mtmp && (!canspotmon(mtmp) || mtmp.mundetected || M_AP_TYPE(mtmp))) {
        if (M_AP_TYPE(mtmp)) {
            flash_glyph_at(zx, zy, mon_to_glyph(mtmp, rn2_on_display_rng),
                           FOUND_FLASH_COUNT);
            seemimic(mtmp);
            /*foundone(zx, zy, mon_to_glyph(mtmp, rn2_on_display_rng);*/
            found_p.num_mons++;
        } else if (mtmp.mundetected && (is_hider(mtmp.data)
                                         || hides_under(mtmp.data)
                                         || mtmp.data.mlet == S_EEL)) {
            flash_glyph_at(zx, zy, mon_to_glyph(mtmp, rn2_on_display_rng),
                           FOUND_FLASH_COUNT);
            mtmp.mundetected = 0;
            /*foundone(zx, zy, mon_to_glyph(mtmp, rn2_on_display_rng);*/
            newsym(zx, zy);
            found_p.num_mons++;
        }
        if (!glyph_is_invisible(lev.glyph)) {
            if (!canspotmon(mtmp)) {
                flash_glyph_at(zx, zy, GLYPH_INVISIBLE, FOUND_FLASH_COUNT);
                map_invisible(zx, zy);
                found_p.num_invis++;
            }
        } else {
            found_p.num_kept_invis++;
        }
    } else if (unmap_invisible(zx, zy)) {
        /* flash the invisible monster glyph because it is already gone */
        flash_glyph_at(zx, zy, GLYPH_INVISIBLE, FOUND_FLASH_COUNT);
        found_p.num_cleared_invis++;
    }
}

function openone(zx$, zy$, num) { /* void */
    const $frame = stack_frame(); try {
    const zx = stack_var(short, zx$);
    const zy = stack_var(short, zy$);
    let ttmp;
    let otmp;
    let num_p = ref_to(int, num);

    if (OBJ_AT(zx[0], zy[0])) {
        for (otmp = svl.level.objects[zx[0]][zy[0]]; otmp; otmp = otmp.v.v_nexthere) {
            if (Is_box(otmp) && otmp.olocked) {
                otmp.olocked = 0;
                (num_p[0])++;
            }
        }
        /* let it fall to the next cases. could be on trap. */
    }
    /* note: secret doors can't be trapped; they use levl[][].wall_info;
       see rm.h for the troublesome overlay of doormask and wall_info */
    if (levl()[zx[0]][zy[0]].typ == SDOOR
        || (levl()[zx[0]][zy[0]].typ == DOOR
            && (levl()[zx[0]][zy[0]].flags & (D_CLOSED | D_LOCKED)))) {
        if (levl()[zx[0]][zy[0]].typ == SDOOR)
            cvt_sdoor_to_door(levl()[zx[0]][zy[0]]); /* .typ = DOOR */
        if (levl()[zx[0]][zy[0]].flags & D_TRAPPED) {
            if (distu(zx[0], zy[0]) < 3)
                b_trapped(_("door"), NO_PART);
            else
                Norep(_("You %s an explosion!"),
                      cansee(zx[0], zy[0]) ? _("see") : (!Deaf() ? _("hear")
                                                      : _("feel the shock of")));
            wake_nearto(zx[0], zy[0], 11 * 11);
            levl()[zx[0]][zy[0]].flags = D_NODOOR;
        } else
            levl()[zx[0]][zy[0]].flags = D_ISOPEN;
        unblock_point(zx[0], zy[0]);
        newsym(zx[0], zy[0]);
        (num_p[0])++;
    } else if (levl()[zx[0]][zy[0]].typ == SCORR) {
        levl()[zx[0]][zy[0]].typ = CORR;
        unblock_point(zx[0], zy[0]);
        newsym(zx[0], zy[0]);
        (num_p[0])++;
    } else if ((ttmp = t_at(zx[0], zy[0])) != null) {
        let mon;
        let dummy = stack_var(boolean); /* unneeded "you notice it arg" */

        if (!ttmp.tseen && ttmp.ttyp != STATUE_TRAP) {
            ttmp.tseen = 1;
            newsym(zx[0], zy[0]);
            (num_p[0])++;
        }
        mon = u_at(zx[0], zy[0]) ? gy.youmonst : m_at(zx[0], zy[0]);
        if (openholdingtrap(mon, addr_of(dummy))
            || openfallingtrap(mon, TRUE, addr_of(dummy)))
            (num_p[0])++;
    } else if (find_drawbridge(zx, zy)) {
        /* make sure it isn't an open drawbridge */
        open_drawbridge(zx[0], zy[0]);
        (num_p[0])++;
    }
    } finally { stack_pop($frame); }
}

/* returns number of things found */
export function findit() { /* int */
    const $frame = stack_frame(); try {
    let num = 0, k;
    let buf = stack_array(char, BUFSZ);
    let found = stack_struct(struct_found_things);

    /*
     *  findit() -> do_clear_area(findone) -> findone() -> foundone()
     *  is used to notify player where various things have been found.
     *  Changing FOUND_FLASH_COUNT to 0 will switch to tmp_at() to
     *  highlight all discoveries for the current operation, but requires
     *  player to respond to --More-- when done.  Neither allows browsing
     *  the map via getpos() autodescribe (until after it has reverted to
     *  normal display, where found traps might be covered by objects).
     */

    if (u.uswallow)
        return 0;

    memset(addr_of(found), 0, sizeof(struct_found_things));
    do_clear_area(u.ux, u.uy, BOLT_LIM, findone, addr_of(found));
    /* count that controls "reveal" punctuation; 0..4 */
    k = +!!found.num_sdoors + +!!found.num_scorrs + +!!found.num_traps
        + +!!found.num_mons;

    chars[buf + 0] = ord('\0');
    if (found.num_sdoors) {
        if (found.num_sdoors > 1)
            sprintf(eos(buf), _("%d secret doors"), found.num_sdoors);
        else
            strcat(buf, _("a secret door"));
        num += found.num_sdoors;
    }
    /* note: non-\0 *buf implies that at least one previous type is present */
    if (found.num_scorrs) {
        if (chars[buf]) /* "doors and corrs" or "doors, corrs ..." */
            strcat(buf, (k == 2) ? _(" and ") : _(", "));
        if (found.num_scorrs > 1)
            sprintf(eos(buf), _("%d secret corridors"), found.num_scorrs);
        else
            strcat(buf, _("a secret corridor"));
        num += found.num_scorrs;
    }
    if (found.num_traps) {
        if (chars[buf]) /* "doors, corrs, and traps" or "{doors|corrs} and traps"
                   * or "..., traps ..." */
            strcat(buf, (k == 3 && !found.num_mons) ? _(", and ")
                        : (k == 2) ? _(" and ") : _(", "));
        if (found.num_traps > 1)
            sprintf(eos(buf), _("%d traps"), found.num_traps);
        else
            strcat(buf, _("a trap"));
        num += found.num_traps;
    }

    if (found.num_mons) {
        if (chars[buf])
            strcat(buf, (k > 2) ? _(", and ") : _(" and "));
        if (found.num_mons > 1)
            sprintf(eos(buf), _("%d hidden monsters"), found.num_mons);
        else
            strcat(buf, _("a hidden monster"));
        num += found.num_mons;
    }
    if (chars[buf])
        You(_("reveal %s!"), buf);

    if (found.num_invis) {
        if (found.num_invis > 1)
            sprintf(buf, _("%d%s unseen monsters"), found.num_invis, found.num_kept_invis ? _(" other") : _(""));
        else
            sprintf(buf, _("%s unseen monster"), found.num_kept_invis ? _("another") : _("an"))

;
        You(_("detect %s!"), buf);
        num += found.num_invis;
    }

    if (found.num_cleared_invis) {
        /* at least 1 "remembered, unseen monster" marker has been removed */
        if (!num)
            You_feel(_("%sless paranoid."),
                     found.num_kept_invis ? _("somewhat ") : _(""));
        num += found.num_cleared_invis;
    }
    /* note: num_kept_invis is not included in the final result */

    if (!num)
        You(_("don't find anything."));

    return num;
    } finally { stack_pop($frame); }
}

/* returns number of things found and opened */
export function openit() { /* int */
    const $frame = stack_frame(); try {
    let num = stack_var(int, 0);

    if (u.uswallow) {
        if (digests(u.ustuck.data)) {
            /* purple worm */
            if (Blind())
                pline(_("Its mouth opens!"));
            else
                pline(_("%s opens its mouth!"), Monnam(u.ustuck));
        }
        expels(u.ustuck, u.ustuck.data, TRUE);
        return -1;
    }

    do_clear_area(u.ux, u.uy, BOLT_LIM, openone, addr_of(num));
    return num[0];
    } finally { stack_pop($frame); }
}

/* callback hack for overriding vision in do_clear_area() */
export function detecting(func) { /* boolean */
    return +(func == findone || func == openone);
}

export function find_trap(trap) { /* void */
    let cleared = FALSE;

    trap.tseen = 1;
    exercise(A_WIS, TRUE);
    feel_newsym(trap.tx, trap.ty);

    /* The "Hallucination ||" is to preserve 3.6.1 behavior, but this
       behavior might need a rework in the hallucination case
       (e.g. to not prompt if any trap glyph appears on the square). */
    if (Hallucination() ||
        levl()[trap.tx][trap.ty].glyph != trap_to_glyph(trap)) {
        /* There's too much clutter to see your find otherwise */
        cls();
        map_trap(trap, 1);
        display_self();
        cleared = TRUE;
    }

    set_msg_xy(trap.tx, trap.ty);
    You(_("find %s."), an(trapname(trap.ttyp, FALSE)));

    if (cleared) {
        display_nhwindow()(WIN_MAP, TRUE); /* wait */
        docrt();
    }
}

function mfind0(mtmp, via_warning) { /* int */
    let x = mtmp.mx, y = mtmp.my;
    let found_something = FALSE;

    if (via_warning && !warning_of(mtmp))
        return -1;

    if (M_AP_TYPE(mtmp)) {
        seemimic(mtmp);
        found_something = TRUE;
    } else {
        /* this used to only be executed if a !canspotmon() test passed
           but that failed to bring sensed monsters out of hiding */
        found_something = +!canspotmon(mtmp);
        if (mtmp.mundetected && (is_hider(mtmp.data)
                                  || hides_under(mtmp.data)
                                  || mtmp.data.mlet == S_EEL)) {
            if (via_warning && found_something) {
                set_msg_xy(x, y);
                Your(_("danger sense causes you to take a second %s."),
                     Blind() ? _("to check nearby") : _("look close by"));
                display_nhwindow()(WIN_MESSAGE, FALSE); /* flush messages */
            }
            mtmp.mundetected = 0;
            found_something = TRUE;
        }
        newsym(x, y);
    }

    if (found_something) {
        if (!canspotmon(mtmp) && glyph_is_invisible(levl()[x][y].glyph))
            return -1; /* Found invisible monster in square which already has
                        * 'I' in it.  Logically, this should still take time
                        * and lead to `return 1', but if we did that the hero
                        * would keep finding the same monster every turn. */
        exercise(A_WIS, TRUE);
        if (!canspotmon(mtmp)) {
            map_invisible(x, y);
            set_msg_xy(x, y);
            You_feel(_("an unseen monster!"));
        } else if (!sensemon(mtmp)) {
            set_msg_xy(x, y);
            You(_("find %s."), mtmp.mtame ? y_monnam(mtmp) : a_monnam(mtmp));
        }
        return 1;
    }
    return 0;
}

export function dosearch0(aflag) { /* int */ /* intrinsic autosearch vs explicit searching */
    let x, y;
    let trap;
    let mtmp;

    if (u.uswallow) {
        if (!aflag)
            Norep(_("What are you looking for?  The exit?"));
    } else {
        let fund = (uwep && uwep.oartifact
                    && spec_ability(uwep, SPFX_SEARCH)) ? uwep.spe : 0;

        if (ublindf && ublindf.otyp == LENSES && !Blind())
            fund += 2; /* JDS: lenses help searching */
        if (fund > 5)
            fund = 5;
        for (x = u.ux - 1; x < u.ux + 2; x++)
            for (y = u.uy - 1; y < u.uy + 2; y++) {
                if (!isok(x, y))
                    continue;
                if (u_at(x, y))
                    continue;

                if (!aflag && (Blind() || visible_region_at(x, y)))
                    feel_location(x, y);
                if (levl()[x][y].typ == SDOOR) {
                    if (rnl(7 - fund))
                        continue;
                    cvt_sdoor_to_door(levl()[x][y]); /* .typ = DOOR */
                    recalc_block_point(x, y);
                    exercise(A_WIS, TRUE);
                    nomul(0);
                    feel_location(x, y); /* make sure it shows up */
                    set_msg_xy(x, y);
                    You(_("find a hidden door."));
                } else if (levl()[x][y].typ == SCORR) {
                    if (rnl(7 - fund))
                        continue;
                    levl()[x][y].typ = CORR;
                    unblock_point(x, y); /* vision */
                    exercise(A_WIS, TRUE);
                    nomul(0);
                    feel_newsym(x, y); /* make sure it shows up */
                    set_msg_xy(x, y);
                    You(_("find a hidden passage."));
                } else {
                    /* Be careful not to find anything in an SCORR or SDOOR */
                    if ((mtmp = m_at(x, y)) != null && !aflag) {
                        let mfres = mfind0(mtmp, 0);

                        if (mfres == -1)
                            continue;
                        else if (mfres > 0)
                            return mfres;
                    }

                    /* see if an invisible monster has moved--if Blind,
                     * feel_location() already did it
                     */
                    if (!aflag && !mtmp && !Blind())
                        unmap_invisible(x, y);

                    if ((trap = t_at(x, y)) && !trap.tseen && !rnl(8)) {
                        nomul(0);
                        if (trap.ttyp == STATUE_TRAP) {
                            if (activate_statue_trap(trap, x, y, FALSE))
                                exercise(A_WIS, TRUE);
                            return 1;
                        } else {
                            find_trap(trap);
                        }
                    }
                }
            }
    }
    return 1;
}

/* the #search command -- explicit searching */
export function dosearch() { /* int */
    if (cmd_safety_prevention(_("Searching"), _("another search"),
                          _("You already found a monster."),
                          ref_of(ga, "already_found_flag")))
        return ECMD_OK;
    return dosearch0(0) ? ECMD_TIME : ECMD_OK;
}

export function warnreveal() { /* void */
    let x, y;
    let mtmp;

    for (x = u.ux - 1; x <= u.ux + 1; x++)
        for (y = u.uy - 1; y <= u.uy + 1; y++) {
            if (!isok(x, y) || u_at(x, y))
                continue;
            if ((mtmp = m_at(x, y)) != null
                && warning_of(mtmp) && mtmp.mundetected)
                mfind0(mtmp, 1); /* via_warning */
        }
}

/* skip premap detection of areas outside Sokoban map */
function skip_premap_detect(x, y) { /* boolean */
    if ((levl()[x][y].typ == STONE)
        && (levl()[x][y].flags & (W_NONDIGGABLE | W_NONPASSWALL)) != 0)
        return TRUE;
    return FALSE;
}

/* Pre-map (the sokoban) levels */
export function premap_detect() { /* void */
    let x, y;
    let ttmp;
    let obj;

    /* Map the background and boulders */
    for (x = 1; x < COLNO; x++)
        for (y = 0; y < ROWNO; y++) {
            if (skip_premap_detect(x, y))
                continue;
            levl()[x][y].seenv = SVALL;
            levl()[x][y].waslit = TRUE;
            if (levl()[x][y].typ == SDOOR)
                levl()[x][y].flags = 0; /* see rm.h for explanation */
            map_background(x, y, 1);
            if ((obj = sobj_at(BOULDER, x, y)) != null)
                map_object(obj, 1);
        }

    /* Map the traps */
    for (ttmp = gf.ftrap; ttmp; ttmp = ttmp.ntrap) {
        ttmp.tseen = 1;
        map_trap(ttmp, 1);
    }
}

/* used to see under visible gas/cloud regions; caller must declare cmaptmp */

function reveal_terrain_getglyph(
    x, y,
    swallowed,
    default_glyph,
    which_subset) { /* int */
    const $frame = stack_frame(); try {
    let t;
    let mtmp;
    let glyph, levl_glyph;
    let seenv;
    let keep_traps = +((which_subset & TER_TRP) != 0),
            keep_objs = +((which_subset & TER_OBJ) != 0),
            keep_mons = +((which_subset & TER_MON) != 0),
            full = +((which_subset & TER_FULL) != 0);

    /*
     * FIXME:
     *  travel treats discovered vibrating square as if it were terrain
     *  rather than a trap so this should do so too.
     */

    /* for 'full', show the actual terrain for the entire level,
       otherwise what the hero remembers for seen locations with
       monsters, objects, and/or traps removed as caller dictates */
    seenv = (full || svl.level.flags.hero_memory)
              ? levl()[x][y].seenv : cansee(x, y) ? SVALL : 0;
    if (full) {
        levl()[x][y].seenv = SVALL;
        glyph = back_to_glyph(x, y);
        levl()[x][y].seenv = seenv;
    } else {
        let cmaptmp = 0; /* used by glyph_is_gascloud() macro */
        let reg = visible_region_at(x, y);
        let was_mon = FALSE;

        levl_glyph = svl.level.flags.hero_memory ? levl()[x][y].glyph
                     : seenv ? back_to_glyph(x, y)
                       : default_glyph;
        /* glyph_at() returns the displayed glyph, which might
           be a monster.  levl[][].glyph contains the remembered
           glyph, which will never be a monster (unless it is
           the invisible monster glyph, which is handled like
           an object, replacing any object or trap at its spot) */
        glyph = !swallowed ? glyph_at(x, y) : levl_glyph;
        if (keep_mons && u_at(x, y) && swallowed) {
            glyph = mon_to_glyph(u.ustuck, rn2_on_display_rng);
        } else if ((!keep_mons && (glyph_is_monster(glyph)
                                 || glyph_is_warning(glyph)))
                   || glyph_is_swallow(glyph)) {
            glyph = levl_glyph;
            was_mon = TRUE;
        }
        if (((!keep_objs && glyph_is_object(glyph))
             || glyph_is_invisible(glyph))
            && keep_traps && !covers_traps(x, y)) {
            if ((t = t_at(x, y)) != null && t.tseen)
                glyph = trap_to_glyph(t);
        }
        if ((!keep_objs && glyph_is_object(glyph))
            /* we either show both traps and visible regions (trap if both
               are present at the same spot) or neither traps nor regions */
            || (!keep_traps && (glyph_is_trap(glyph)
                                || (reg && (glyph_is_cmap(glyph) && (((cmaptmp = glyph_to_cmap(glyph)) == S_cloud) || (cmaptmp == S_poisoncloud))))))
            || (reg && was_mon)
            || glyph_is_invisible(glyph)) {
            if (!seenv) {
                /* it's possible to have a visible region shown at an
                   otherwise unexplored location (cast stinking cloud
                   through unexplored corridor into lit room, then approach
                   far enough to be adjacent to the cloud without having
                   seen the corridor underneath it) */
                glyph = !reg ? default_glyph : GLYPH_UNEXPLORED;
            } else if (keep_traps && reg
                       && ((glyph_is_cmap(glyph) && (((cmaptmp = glyph_to_cmap(glyph)) == S_cloud) || (cmaptmp == S_poisoncloud))) || was_mon)) {
                t = t_at(x, y);
                /* we need reg->glyph here when there's a monster shown
                   at a region spot; the region glyph isn't the remembered
                   background glyph or the current glyph */
                glyph = (t && t.tseen) ? trap_to_glyph(t) : reg.glyph;
                /* FIXME? what about objects temporarily hidden by regions?
                   when objects are being shown, shouldn't showing them take
                   precedence over showing the region, just like traps? */
            } else if (chars[svl.lastseentyp[x] + y] == levl()[x][y].typ) {
                glyph = back_to_glyph(x, y);
            } else {
                /* look for a mimic here posing as furniture;
                   if we don't find one, we'll have to fake it */
                if ((mtmp = m_at(x, y)) != null
                    && M_AP_TYPE(mtmp) == M_AP_FURNITURE) {
                    glyph = int((((mtmp.mappearance) == S_stone) ? GLYPH_CMAP_STONE_OFF : (((mtmp.mappearance) <= S_trwall) ? (unsigned((unsigned(((mtmp.mappearance) - S_vwall)) + (In_mines(u.uz) ? GLYPH_CMAP_MINES_OFF : (In_hell(u.uz) ? GLYPH_CMAP_GEH_OFF : (Is_knox(u.uz) ? GLYPH_CMAP_KNOX_OFF : (In_sokoban(u.uz) ? GLYPH_CMAP_SOKO_OFF : GLYPH_CMAP_MAIN_OFF))))))) : (((mtmp.mappearance) < S_altar) ? (unsigned(((unsigned(((mtmp.mappearance) - S_ndoor))) + GLYPH_CMAP_A_OFF))) : (((mtmp.mappearance) == S_altar) ? altar_to_glyph(AM_NEUTRAL) : (((mtmp.mappearance) < (S_arrow_trap + MAXTCHARS)) ? (unsigned(((unsigned(((mtmp.mappearance) - S_grave))) + GLYPH_CMAP_B_OFF))) : (((mtmp.mappearance) <= S_goodpos) ? (unsigned(((unsigned(((mtmp.mappearance) - S_digbeam))) + GLYPH_CMAP_C_OFF))) : NO_GLYPH)))))));
                } else {
                    let save_spot = stack_struct(struct_rm);

                    /*
                     * We have a topology type but we want a screen symbol
                     * in order to derive a glyph.  Some screen symbols need
                     * the flags field of levl[][] in addition to the type
                     * (to disambiguate STAIRS to S_upstair or S_dnstair,
                     * for example).  Current flags might not be intended
                     * for remembered type, but we've got no other choice.
                     * An exception is wall_info which can be recalculated and
                     * needs to be.  Otherwise back_to_glyph() -> wall_angle()
                     * might issue an impossible() for it if it is currently
                     * doormask==D_OPEN for an open door remembered as a wall.
                     */
                    struct_assign(save_spot, levl()[x][y]);
                    levl()[x][y].typ = chars[svl.lastseentyp[x] + y];
                    if (IS_WALL(levl()[x][y].typ) || levl()[x][y].typ == SDOOR)
                        xy_set_wall_state(x, y); /* levl[x][y].wall_info */
                    glyph = back_to_glyph(x, y);
                    struct_assign(levl()[x][y], save_spot);
                }
            }
        }
    }
    /* FIXME: dirty hack */
    if (glyph == cmap_to_glyph(S_darkroom))
        glyph = cmap_to_glyph(S_room);
    else if (glyph == cmap_to_glyph(S_litcorr))
        glyph = cmap_to_glyph(S_corr);
    return glyph;
    } finally { stack_pop($frame); }
}

/* #ifdef DUMPLOG: not in this build */

/* idea from crawl; show known portion of map without any monsters,
   objects, or traps occluding the view of the underlying terrain;
   in explore or wizard modes, can also display unexplored portion */
export function reveal_terrain(
    which_subset) { /* void */ /* TER_TRP | TER_OBJ | TER_MON | TER_FULL */
    const $frame = stack_frame(); try {
    /* 'full' overrides impairment and implies no-traps, no-objs, no-mons */
    let full = +((which_subset & TER_FULL) != 0); /* show whole map */

    if ((Hallucination() || Stunned() || Confusion()) && !full) {
        You(_("are too disoriented for this."));
    } else {
        let x, y;
        let glyph, default_glyph;
        let buf = stack_array(char, BUFSZ);
        /* there is a TER_MAP bit too; we always show map regardless of it */
        let keep_traps = +((which_subset & TER_TRP) != 0),
                keep_objs = +((which_subset & TER_OBJ) != 0),
                keep_mons = +((which_subset & TER_MON) != 0); /* not used */
        let swallowed = u.uswallow; /* before unconstrain_map() */
        let default_sym = svl.level.flags.arboreal ? S_tree : S_stone;

        if (unconstrain_map())
            docrt();
        default_glyph = cmap_to_glyph(default_sym);

        for (x = 1; x < COLNO; x++)
            for (y = 0; y < ROWNO; y++) {
                glyph = reveal_terrain_getglyph(x, y, swallowed,
                                                default_glyph, which_subset);
                show_glyph(x, y, glyph);
            }

        /* hero's location is not highlighted, but getpos() starts with
           cursor there, and after moving it anywhere '@' moves it back */
        flush_screen(1);
        if (full) {
            strcpy(buf, _("underlying terrain"));
        } else {
            strcpy(buf, _("known terrain"));
            if (keep_traps)
                sprintf(eos(buf), _("%s traps"), (keep_objs || keep_mons) ? _(",") : _(" and"))
;
            if (keep_objs)
                sprintf(eos(buf), _("%s%s objects"), (keep_traps || keep_mons) ? _(",") : _(""), keep_mons ? _("") : _(" and"))

;
            if (keep_mons)
                sprintf(eos(buf), _("%s and monsters"), (keep_traps || keep_objs) ? _(",") : _(""))
;
        }
        pline(_("Showing %s only..."), buf);

        /* allow player to move cursor around and get autodescribe feedback
           based on what is visible now rather than what is on 'real' map */
        which_subset = unsigned(which_subset | TER_MAP); /* guarantee non-zero */
        browse_map(which_subset, _("anything of interest"));

        map_redisplay();
    }
    return;
    } finally { stack_pop($frame); }
}

/*detect.c*/

import { AM_NEUTRAL } from "./align.h.js";
import { SPFX_SEARCH } from "./artifact.h.js";
import { A_INT, A_WIS } from "./attrib.h.js";
import { ACURR } from "./attrib.h.macros.js";
import { struct_nhcoord } from "./coord.h.js";
import { Never_mind, something, vision_clears } from "./decl.h.macros.js";
import {
    COIN_CLASS, DEF_MIMIC, DEF_MIMIC_DEF, FOOD_CLASS, MAXMCLASSES, MAXOCLASSES, POTION_CLASS,
    ROCK_CLASS, SCROLL_CLASS, SPBOOK_CLASS, S_EEL, S_GHOST, S_WORM_TAIL, S_altar, S_arrow_trap,
    S_cloud, S_corr, S_darkroom, S_digbeam, S_goodpos, S_grave, S_hcdoor, S_litcorr, S_ndoor,
    S_poisoncloud, S_room, S_stone, S_tree, S_trwall, S_vcdoor, S_vwall,
} from "./defsym.h.js";
import {
    GLYPH_CMAP_A_OFF, GLYPH_CMAP_B_OFF, GLYPH_CMAP_C_OFF, GLYPH_CMAP_GEH_OFF, GLYPH_CMAP_KNOX_OFF,
    GLYPH_CMAP_MAIN_OFF, GLYPH_CMAP_MINES_OFF, GLYPH_CMAP_SOKO_OFF, GLYPH_CMAP_STONE_OFF,
    GLYPH_INVISIBLE, GLYPH_NOTHING, GLYPH_UNEXPLORED, NO_GLYPH,
} from "./display.h.js";
import {
    altar_to_glyph, canspotmon, cmap_to_glyph, covers_objects, covers_traps, detected_mon_to_glyph,
    display_self, glyph_is_cmap, glyph_is_invisible, glyph_is_monster, glyph_is_object,
    glyph_is_swallow, glyph_is_trap, glyph_is_unexplored, glyph_is_warning, glyph_to_mon,
    glyph_to_obj, mon_to_glyph, newsym_rn2, pet_to_glyph, random_monster, random_object,
    trap_to_glyph,
} from "./display.h.macros.js";
import { In_sokoban, Is_knox, Is_rogue_level } from "./dungeon.h.macros.js";
import { TER_DETECT, TER_FULL, TER_MAP, TER_MON, TER_OBJ, TER_TRP } from "./flag.h.js";
import { BUFSZ, COLNO, FALSE, ROWNO, TRUE, boolean, coordxy } from "./global.h.js";
import {
    ARTICLE_THE, ARTICLE_YOUR, BOLT_LIM, ECMD_OK, ECMD_TIME, FOOT, KILLED_BY_AN, NOSE, NO_PART,
    SUPPRESS_SADDLE, SYM_OFF_X, TOE,
} from "./hack.h.js";
import { Your1, distu, makeknown, pline1 } from "./hack.h.macros.js";
import { MCORPSENM, has_mcorpsenm } from "./mextra.h.macros.js";
import { ROOMOFFSET } from "./mkroom.h.js";
import { digests, hides_under, is_hider, monsndx, monsym } from "./mondata.h.macros.js";
import { M_AP_FURNITURE, M_AP_OBJECT } from "./monst.h.js";
import { DEADMONSTER, M_AP_TYPE, helpless } from "./monst.h.macros.js";
import { PM_GOLD_GOLEM, PM_LONG_WORM, PM_LONG_WORM_TAIL, PM_TENGU } from "./monsters.h.js";
import { BURIED_TOO, CONTAINED_TOO, struct_obj } from "./obj.h.js";
import { Has_contents, Is_box, SchroedingersBox } from "./obj.h.macros.js";
import { GOLD } from "./objclass.h.js";
import { BOULDER, CHEST, CRYSTAL_BALL, GOLD_PIECE, LARGE_BOX, LENSES } from "./objects.h.js";
import { DETECT_MONSTERS, I_SPECIAL, TIMEOUT } from "./prop.h.js";
import {
    CORR, DOOR, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, SCORR, SDOOR, STONE,
    SVALL, WM_MASK, W_NONDIGGABLE, W_NONPASSWALL, struct_rm,
} from "./rm.h.js";
import { IS_DOOR, IS_FURNITURE, IS_WALL, OBJ_AT, fmon, fobj, levl, m_at } from "./rm.h.macros.js";
import { MAXTCHARS, SYM_BOULDER } from "./sym.h.js";
import { is_cmap_furniture } from "./sym.h.macros.js";
import { BEAR_TRAP, STATUE_TRAP, TRAPPED_CHEST, TRAPPED_DOOR, struct_trap } from "./trap.h.js";
import { COULD_SEE, IN_SIGHT } from "./vision.h.js";
import { cansee } from "./vision.h.macros.js";
import { display_nhwindow } from "./winprocs.h.macros.js";
import { u_at } from "./you.h.macros.js";
import {
    Blind, BlindedTimeout, Clairvoyant, Confusion, Deaf, EDetect_monsters, HConfusion,
    HHallucination, Half_physical_damage, Hallucination, Stunned, Underwater,
} from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, short, sizeof, uchar, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { and64, or64 } from "../rt/int64.js";
import { memset, sprintf, strcat, strchr, strcpy } from "../rt/libc.js";
import { stack_array, stack_struct, stack_var, static_array, static_struct } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, ptr_add, ptr_to, ref_of, ref_to, struct, struct_assign, view_of,
} from "../rt/struct.js";
import { spec_ability } from "./artifact.js";
import { exercise } from "./attrib.js";
import { isok, yn_function } from "./cmd.js";
import { find_drawbridge, open_drawbridge } from "./dbridge.js";
import {
    cg, flags, ga, gd, gf, gi, gk, gm, gn, gs, gv, gy, iflags, quitchars, svd, svl, u,
} from "./decl.js";
import {
    back_to_glyph, cls, docrt, feel_location, feel_newsym, flash_glyph_at, flush_screen, glyph_at,
    magic_map_background, map_background, map_engraving, map_invisible, map_object, map_trap,
    newsym, see_monsters, sensemon, show_glyph, under_ground, under_water, unmap_invisible,
    unmap_object, warning_of, xy_set_wall_state,
} from "./display.js";
import { cmd_safety_prevention } from "./do.js";
import { Monnam, a_monnam, hcolor, x_monnam, y_monnam } from "./do_name.js";
import {
    def_char_is_furniture, def_char_to_monclass, def_char_to_objclass, def_monsyms, def_oc_syms,
} from "./drawing.js";
import { In_hell, In_mines, depth, room_discovered } from "./dungeon.js";
import { engr_at } from "./engrave.js";
import { getpos } from "./getpos.js";
import { glyph_to_cmap } from "./glyphs.js";
import { losehp, money_cnt, nomul } from "./hack.js";
import { eos, s_suffix } from "./hacklib.js";
import { consume_obj_charge, currency, sobj_at, useup } from "./invent.js";
import { expels } from "./mhitu.js";
import { seemimic, wake_nearto } from "./mon.js";
import { resists_blnd } from "./mondata.js";
import { closed_door } from "./monmove.js";
import { mons } from "./monst.js";
import { observe_object } from "./o_init.js";
import { objects } from "./objects.js";
import { Tobjnam, an, makeplural, the, xname } from "./objnam.js";
import {
    Norep, There, You, You_feel, You_see, Your, impossible, pline, pline_The, set_msg_xy,
} from "./pline.js";
import { body_part, poly_gender } from "./polyself.js";
import { make_blinded, make_confused, make_hallucinated, strange_feeling } from "./potion.js";
import { is_quest_artifact } from "./questpgr.js";
import { visible_region_at } from "./region.js";
import { rn2, rn2_on_display_rng, rnd, rnl } from "./rnd.js";
import { findgold } from "./steal.js";
import {
    activate_statue_trap, b_trapped, openfallingtrap, openholdingtrap, t_at, trapname,
} from "./trap.js";
import { hidden_gold } from "./vault.js";
import { do_clear_area, recalc_block_point, unblock_point } from "./vision.js";
import { detect_wsegs } from "./worm.js";
import { get_obj_location } from "./zap.js";
