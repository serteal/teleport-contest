/* NetHack 5.0	pager.c	$NHDT-Date: 1774846177 2026/03/29 20:49:37 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.296 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2018. */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * This file contains the command routines dowhatis() and dohelp() and
 * a few other help related facilities such as data.base lookup.
 */

/* lookat() can return Null */

    const chkfilNone = 0;
    const chkfilUsrTyped = 1;
    const chkfilDontAsk = 2;
    const chkfilIaCheck = 4;

const invisexplain = init_string(static_array("invisexplain", char, sizeof_string("remembered, unseen, creature")), _("remembered, unseen, creature"), true);
const altinvisexplain = init_string(static_array("altinvisexplain", char, sizeof_string("unseen creature")), _("unseen creature"), true); /* for clairvoyance */

/* Returns "true" for characters that could represent a monster's stomach. */
function is_swallow_sym(c) { /* boolean */
    let i;

    for (i = S_sw_tl; i <= S_sw_br; i++)
        if ((uchars[gs.showsyms + i]) == c)
            return TRUE;
    return FALSE;
}

/* Append " or "+new_str to the end of buf if new_str doesn't already exist
   as a substring of buf.  Return 1 if the string was appended, 0 otherwise.
   It is expected that buf is of size BUFSZ. */
function append_str(buf, new_str) { /* int */
    let sep = init_string(static_array("append_str.sep", char, sizeof_string(" or ")), _(" or "), true);
    let oldlen, space_left;

    if (strstri(buf, new_str))
        return 0; /* already present */

    oldlen = strlen(buf);
    if (oldlen >= BUFSZ - 1) {
        if (oldlen > BUFSZ - 1)
            impossible(_("append_str: 'buf' contains %llu characters."),
                       oldlen);
        return 0; /* no space available */
    }

    /* some space available, but not necessarily enough for full append */
    space_left = unsigned(BUFSZ - 1 - oldlen);  /* space remaining in buf */
    strncat(buf, sep, space_left);
    if (space_left > sizeof_string(" or ") - 1)
        strncat(buf, new_str, unsigned(space_left - (sizeof_string(" or ") - 1)));
    return 1; /* something was appended, possibly just part of " or " */
}

/* shared by monster probing (via query_objlist!) as well as lookat() */
export function self_lookat(outbuf) { /* char * */
    const $frame = stack_frame(); try {
    let race = stack_array(char, QBUFSZ), trapbuf = stack_array(char, QBUFSZ);

    /* include race with role unless polymorphed */
    chars[race + 0] = ord('\0');
    if (!Upolyd())
        sprintf(race, _("%s "), gu.urace.adj);
    sprintf(outbuf, _("%s%s%s called %s"), (Invis() && (senseself() || !Blind())) ? _("invisible ") : _(""), race, pmname(mons[u.umonnum], Ugender()), svp.plname)

;
    if (u.usteed)
        sprintf(eos(outbuf), _(", mounted on %s"), y_monnam(u.usteed));
    if (u.uundetected || (Upolyd() && U_AP_TYPE())
        || visible_region_at(u.ux, u.uy))
        mhidden_description(gy.youmonst,
                            MHID_PREFIX | MHID_ARTICLE | MHID_REGION,
                            eos(outbuf));
    if (Punished())
        sprintf(eos(outbuf), _(", chained to %s"), uball ? ansimpleoname(uball) : _("nothing?"))
;
    if (u.utrap) /* bear trap, pit, web, in-floor, in-lava, tethered */
        sprintf(eos(outbuf), _(", %s"), trap_predicament(trapbuf, 0, FALSE));
    return outbuf;
    } finally { stack_pop($frame); }
}

/* format a description of 'mon's health for look_at_monster(), done_in_by();
   result isn't Healer-specific (not trained for arbitrary creatures) */
export function monhealthdescr(mon, addspace, outbuf) { /* char * */
    /* #if 0: not in this build */

    (mon);
    (addspace);
    chars[outbuf] = ord('\0');

    return outbuf;
}

/* copy a trap's description into outbuf[] */
function trap_description(outbuf, tnum, x, y) { /* void */
    /*
     * Trap detection used to display a bear trap at locations having
     * a trapped door or trapped container or both.  They're semi-real
     * traps now (defined trap types but not part of ftrap chain).
     */
    if (trapped_chest_at(tnum, x, y))
        strcpy(outbuf, _("trapped chest")); /* might actually be a large box */
    else if (trapped_door_at(tnum, x, y))
        strcpy(outbuf, _("trapped door")); /* not "trap door"... */
    else
        strcpy(outbuf, trapname(tnum, FALSE));
    return;
}

/* describe a hidden monster; used for look_at during extended monster
   detection and for probing; also when looking at self and camera feedback */
export function mhidden_description(
    mon,
    mhid_flags,
    outbuf) { /* void */ /* output buffer */
    const $frame = stack_frame(); try {
    let $goto = null; var otmp = stack_var(ptr_to(struct_obj));

    var what;
    var reg;
    var buflen;
    var incl_prefix = +((mhid_flags & MHID_PREFIX) != 0),
            incl_article = +((mhid_flags & MHID_ARTICLE) != 0),
            show_altmon = +((mhid_flags & MHID_ALTMON) != 0),
            force_region = +((mhid_flags & MHID_REGION) != 0);
    var fakeobj, isyou = +(mon == gy.youmonst);
    var x = isyou ? u.ux : mon.mx, y = isyou ? u.uy : mon.my;
    var glyph = (svl.level.flags.hero_memory && !isyou) ? levl()[x][y].glyph
                                                       : glyph_at(x, y);

    chars[outbuf] = ord('\0');
    $goto_objfrommap: for (;;) { switch ($goto) { default: case "objfrommap": if ($goto || (M_AP_TYPE(mon) == M_AP_FURNITURE
        || M_AP_TYPE(mon) == M_AP_OBJECT)) {
        switch ($goto) { default: if (incl_prefix)
            strcpy(outbuf, _(", mimicking "));
        case "objfrommap": if (!$goto && (M_AP_TYPE(mon) == M_AP_FURNITURE)) {
            what = defsyms[mon.mappearance].explanation;
            if (incl_article)
                what = an(what);
            strcat(outbuf, what);
        } else if ($goto || (M_AP_TYPE(mon) == M_AP_OBJECT
                   /* remembered glyph, not glyph_at() which is 'mon' */
                   && glyph_is_object(glyph))) {
 $goto = null;
            otmp[0] = null;
            fakeobj = object_from_map(glyph, x, y, otmp);
            what = (otmp[0] && otmp[0].otyp != STRANGE_OBJECT)
                   ? simpleonames(otmp[0])
                   : obj_descr[STRANGE_OBJECT].oc_name;
            if (incl_article && (!otmp[0] || otmp[0].quan == 1))
                what = an(what);
            strcat(outbuf, what);

            if (fakeobj && otmp[0]) {
                otmp[0].where = OBJ_FREE; /* object_from_map set to OBJ_FLOOR */
                dealloc_obj(otmp[0]); /* has no contents */
            }
        } else {
            strcat(outbuf, something());
        } }
    } else if (M_AP_TYPE(mon) == M_AP_MONSTER) {
        if (show_altmon) {
            if (incl_prefix)
                strcat(outbuf, _(", masquerading as "));
            what = pmname(mons[mon.mappearance], Mgender(mon));
            if (incl_prefix)
                what = an(what);
            strcat(outbuf, what);
        }
    } else if (isyou ? u.uundetected : mon.mundetected) {
        strcpy(outbuf, _(", hiding"));
        if (hides_under(mon.data)) {
            strcat(outbuf, _(" under "));
            /* remembered glyph, not glyph_at() which is 'mon' */
            if (glyph_is_object(glyph))
                { $goto = "objfrommap"; continue $goto_objfrommap; };
            strcat(outbuf, something());
        } else if (is_hider(mon.data)) {
            sprintf(eos(outbuf), _(" on the %s"), ceiling_hider(mon.data) ? _("ceiling")
                       : surface(x, y))
; /* trapper */
        } else {
            if (mon.data.mlet == S_EEL && is_pool(x, y))
                strcat(outbuf, _(" in murky water"));
        }
    } } break; }

    /* FIXME: <x,y> isn't right when looking at long worm tails */
    if ((reg = visible_region_at(x, y)) != null
        && (buflen = strlen(outbuf)) < BUFSZ - 1) {
        var r = (u.xray_range > 1) ? u.xray_range : 1;

        /* at present, hero must be next to the monster; being able to see
           from the hero's spot to the monster's spot would be much better,
           but a visible region marks all its spots as can't-be-seen, so
           this monster's spot is !cansee and !couldsee [maybe we need an
           additional vision bit for "hero's side of edge of gas cloud"?] */
        if (distu(x, y) <= r * (r + 1) || force_region) {
            var rglyph = reg.glyph;
            var poison_gas = +(glyph_is_cmap(rglyph)
                                  && glyph_to_cmap(rglyph) == S_poisoncloud);

            Snprintf(eos(outbuf), unsigned(BUFSZ - buflen), _(", in a cloud of %s"), poison_gas ? _("poison gas") : _("vapor"))
;
        }
    }
    } finally { stack_pop($frame); }
}

/* extracted from lookat(); also used by namefloorobj() */
export function object_from_map(
    glyph,
    x, y,
    obj_p) { /* boolean */
    let fakeobj = FALSE, mimic_obj = FALSE;
    let mtmp;
    let otmp;
    let glyphotyp = glyph_is_object(glyph) ? glyph_to_obj(glyph)
                    /* if not an object, probably a detected chest trap */
                    : glyph_is_cmap(glyph) /* assume trapped chest|door */
                      ? (sobj_at(CHEST, x, y) ? CHEST : LARGE_BOX)
                      : STRANGE_OBJECT;

    obj_p[0] = null;
    /* TODO: check inside containers in case glyph came from detection */
    if ((otmp = sobj_at(glyphotyp, x, y)) == null)
        for (otmp = svl.level.buriedobjlist; otmp; otmp = otmp.nobj)
            if (otmp.ox == x && otmp.oy == y && otmp.otyp == glyphotyp)
                break;

    /* there might be a mimic here posing as an object */
    mtmp = m_at(x, y);
    if (mtmp && is_obj_mappear(mtmp, unsigned(glyphotyp))) {
        otmp = null;
        mimic_obj = TRUE;
    } else
        mtmp = null;

    if (!otmp || otmp.otyp != glyphotyp) {
        /* this used to exclude STRANGE_OBJECT; now caller deals with it */
        if (OBJ_NAME(objects[glyphotyp])) {
            /* map shows a regular object, but one that's not actually here */
            otmp = mksobj(glyphotyp, FALSE, FALSE);
        } else {
            /* map shows a non-item that holds an extra object type (shown
               on map due to hallucination) for a name which might have been
               shuffled into play but wasn't (or was shuffled out of play);
               pick another item that is a regular one in same object class */
            otmp = mkobj(objects[glyphotyp].oc_class, FALSE);
            /* mkobj() doesn't provide any no-init option; however, there
               aren't any extra tool items (or statues) so we won't get here
               for tools and don't need to check for and delete container
               contents or extinguish lights on the temporary object */
        }
        /* even though we pass False for mksobj()'s 'init' arg, corpse-rot,
           egg-hatch, and figurine-transform timers get initialized */
        if (otmp.timed)
            obj_stop_timers(otmp);
        fakeobj = TRUE;
        if (otmp.oclass == COIN_CLASS)
            otmp.quan = 2; /* to force pluralization */
        else if (otmp.otyp == SLIME_MOLD)
            otmp.spe = svc.context.current_fruit; /* give it a type */
        if (mtmp && has_mcorpsenm(mtmp)) { /* mimic as corpse/statue */
            if (otmp.otyp == SLIME_MOLD)
                /* override svc.context.current_fruit to avoid
                     look, use 'O' to make new named fruit, look again
                   giving different results when current_fruit changes */
                otmp.spe = MCORPSENM(mtmp);
            else
                otmp.corpsenm = MCORPSENM(mtmp);
        } else if (otmp.otyp == CORPSE && glyph_is_body(glyph)) {
            otmp.corpsenm = glyph_to_body_corpsenm(glyph);
        } else if (otmp.otyp == STATUE && glyph_is_statue(glyph)) {
            otmp.corpsenm = glyph_to_statue_corpsenm(glyph);
        }
        if (otmp.otyp == LEASH)
            otmp.corpsenm = 0;
        /* extra fields needed for shop price with doname() formatting */
        otmp.where = OBJ_FLOOR;
        otmp.ox = x, otmp.oy = y;
        otmp.no_charge = (otmp.otyp == STRANGE_OBJECT && costly_spot(x, y) ? 1 : 0);
    }
    /* if located at adjacent spot, mark it as having been seen up close
       (corpse type will be known even if dknown is 0, so we don't need a
       touch check for cockatrice corpse--we're looking without touching) */
    if (otmp && next2u(x, y) && !Blind() && !Hallucination()
        /* redundant: we only look for an object which matches current
           glyph among floor and buried objects; when !Blind, any buried
           object's glyph will have been replaced by whatever is present
           on the surface as soon as we moved next to its spot */
        && (fakeobj || otmp.where == OBJ_FLOOR) /* not buried */
        /* terrain mode views what's already known, doesn't learn new stuff */
        && !iflags.terrainmode) /* so don't set dknown when in terrain mode */
        observe_object(otmp); /* if a pile, clearly see the top item only */
    if (fakeobj && mtmp && mimic_obj
        && (otmp.dknown || (M_AP_FLAG(mtmp) & M_AP_F_DKNOWN))) {
        mtmp.m_ap_type |= M_AP_F_DKNOWN;
        observe_object(otmp);
    }
    obj_p[0] = otmp;
    return fakeobj; /* when True, caller needs to dealloc *obj_p */
}

function look_at_object(
    buf,
    x, y,
    glyph) { /* void */
    const $frame = stack_frame(); try {
    let otmp = stack_var(ptr_to(struct_obj), null);
    let fakeobj = object_from_map(glyph, x, y, otmp);

    if (otmp[0]) {
        strcpy(buf, (otmp[0].otyp != STRANGE_OBJECT)
                     ? distant_name(otmp[0], otmp[0].dknown ? doname_with_price
                                                       : doname_vague_quan)
                     : obj_descr[STRANGE_OBJECT].oc_name);
        if (fakeobj) {
            otmp[0].where = OBJ_FREE; /* object_from_map set it to OBJ_FLOOR */
            dealloc_obj(otmp[0]), otmp[0] = null; /* has no contents */
        }
    } else {
        strcpy(buf, something()); /* sanity precaution */
    }

    if (otmp[0] && otmp[0].where == OBJ_BURIED)
        strcat(buf, _(" (buried)"));
    /* check TREE before STONE due to level.flags.arboreal */
    else if (IS_TREE(levl()[x][y].typ))
        /* "dangling": "hanging" could imply that it's growing on this tree */
        Snprintf(eos(buf), unsigned(BUFSZ - strlen(buf)), _(" %s in a tree"), (otmp[0] && is_treefruit(otmp[0])) ? _("dangling") : _("stuck"));
    else if (levl()[x][y].typ == STONE || levl()[x][y].typ == SCORR)
        strcat(buf, _(" embedded in stone"));
    else if (IS_WALL(levl()[x][y].typ) || levl()[x][y].typ == SDOOR)
        strcat(buf, _(" embedded in a wall"));
    else if (closed_door(x, y))
        strcat(buf, _(" embedded in a door"));
    else if (is_pool(x, y))
        strcat(buf, _(" in water"));
    else if (is_lava(x, y))
        strcat(buf, _(" in molten lava"))
; /* [can this ever happen?] */
    return;
    } finally { stack_pop($frame); }
}

function look_at_monster(
    buf, monbuf,
    mtmp,
    x, y) { /* void */
    const $frame = stack_frame(); try {
    let name, monnambuf = stack_array(char, BUFSZ), healthbuf = stack_array(char, BUFSZ);
    let accurate = +!Hallucination();

    name = (mtmp.data == mons[PM_COYOTE] && accurate)
              ? coyotename(mtmp, monnambuf)
              : distant_monnam(mtmp, ARTICLE_NONE, monnambuf);
    sprintf(buf, _("%s%s%s%s"), (mtmp.mx != x || mtmp.my != y)
                ? ((mtmp.isshk && accurate) ? _("tail of ") : _("tail of a "))
                : _(""), accurate ? monhealthdescr(mtmp, TRUE, healthbuf) : _(""), (mtmp.mtame && accurate)
                ? _("tame ")
                : (mtmp.mpeaceful && accurate)
                    ? _("peaceful ")
                    : _(""), name)

;
    if (u.ustuck == mtmp) {
        if (u.uswallow || iflags.save_uswallow) /* monster detection */
            strcat(buf, digests(mtmp.data) ? _(", swallowing you")
                                            : _(", engulfing you"));
        else
            strcat(buf, (Upolyd() && sticks(gy.youmonst.data))
                          ? _(", being held") : _(", holding you"));
    }
    /* if mtmp isn't able to move (other than because it is a type of
       monster that never moves), say so [excerpt from mstatusline() for
       stethoscope or wand of probing] */
    if (mtmp.mfrozen)
        /* unfortunately mfrozen covers temporary sleep and being busy
           (donning armor, for instance) as well as paralysis */
        strcat(buf, _(", can't move (paralyzed or sleeping or busy)"));
    else if (mtmp.msleeping)
        /* sleeping for an indeterminate duration */
        strcat(buf, _(", asleep"));
    else if ((mtmp.mstrategy & STRAT_WAITMASK) != 0)
        /* arbitrary reason why it isn't moving */
        strcat(buf, _(", meditating"));

    if (mtmp.mleashed)
        strcat(buf, _(", leashed to you"));
    if (mtmp.mtrapped && cansee(mtmp.mx, mtmp.my)) {
        let t = t_at(mtmp.mx, mtmp.my);
        let tt = t ? t.ttyp : NO_TRAP;

        /* newsym lets you know of the trap, so mention it here */
        if (tt == BEAR_TRAP || is_pit(tt) || tt == WEB) {
            sprintf(eos(buf), _(", trapped in %s"), an(trapname(tt, FALSE)));
            t.tseen = 1;
        }
    }

    /* we know the hero sees a monster at this location, but if it's shown
       due to persistent monster detection he might remember something else */
    if (mtmp.mundetected || M_AP_TYPE(mtmp) || visible_region_at(x, y))
        mhidden_description(mtmp, MHID_PREFIX | MHID_ARTICLE | MHID_REGION,
                            eos(buf));

    if (monbuf) {
        let how_seen = howmonseen(mtmp);

        chars[monbuf + 0] = ord('\0');
        if (how_seen != 0 && how_seen != MONSEEN_NORMAL) {
            if (how_seen & MONSEEN_NORMAL) {
                strcat(monbuf, _("normal vision"));
                how_seen = unsigned(how_seen & unsigned(~MONSEEN_NORMAL));
                /* how_seen can't be 0 yet... */
                if (how_seen)
                    strcat(monbuf, _(", "));
            }
            if (how_seen & MONSEEN_SEEINVIS) {
                strcat(monbuf, _("see invisible"));
                how_seen = unsigned(how_seen & unsigned(~MONSEEN_SEEINVIS));
                if (how_seen)
                    strcat(monbuf, _(", "));
            }
            if (how_seen & MONSEEN_INFRAVIS) {
                strcat(monbuf, _("infravision"));
                how_seen = unsigned(how_seen & unsigned(~MONSEEN_INFRAVIS));
                if (how_seen)
                    strcat(monbuf, _(", "));
            }
            if (how_seen & MONSEEN_TELEPAT) {
                strcat(monbuf, _("telepathy"));
                how_seen = unsigned(how_seen & unsigned(~MONSEEN_TELEPAT));
                if (how_seen)
                    strcat(monbuf, _(", "));
            }
            if (how_seen & MONSEEN_XRAYVIS) {
                /* Eyes of the Overworld */
                strcat(monbuf, _("astral vision"));
                how_seen = unsigned(how_seen & unsigned(~MONSEEN_XRAYVIS));
                if (how_seen)
                    strcat(monbuf, _(", "));
            }
            if (how_seen & MONSEEN_DETECT) {
                strcat(monbuf, _("monster detection"));
                how_seen = unsigned(how_seen & unsigned(~MONSEEN_DETECT));
                if (how_seen)
                    strcat(monbuf, _(", "));
            }
            if (how_seen & MONSEEN_WARNMON) {
                if (Hallucination()) {
                    strcat(monbuf, _("paranoid delusion"));
                } else {
                    let mW = or64u(svc.context.warntype.obj, svc.context.warntype.polyd),
                                  m2 = mtmp.data.mflags2;

                    let whom = ((mW & M2_HUMAN & m2) ? _("human")
                                        : (mW & M2_ELF & m2) ? _("elf")
                                          : (mW & M2_ORC & m2) ? _("orc")
                                            : (mW & M2_DEMON & m2) ? _("demon")
                                              : pmname(mtmp.data,
                                                       Mgender(mtmp)));

                    sprintf(eos(monbuf), _("warned of %s"), makeplural(whom));
                }
                how_seen = unsigned(how_seen & unsigned(~MONSEEN_WARNMON));
                if (how_seen)
                    strcat(monbuf, _(", "));
            }
            /* should have used up all the how_seen bits by now */
            if (how_seen) {
                impossible(_("lookat: unknown method of seeing monster"));
                sprintf(eos(monbuf), _("(%u)"), how_seen);
            }
        } /* seen by something other than normal vision */
    } /* monbuf is non-null */
    } finally { stack_pop($frame); }
}

/* describe a pool location's contents; might return a static buffer so
   caller should use it or copy it before calling waterbody_name() again
   [5.0: moved here from mkmaze.c] */
export function waterbody_name(x, y) { /* const char * */
    let pooltype = static_array("waterbody_name.pooltype", char, 40);
    let ltyp;
    let hallucinate = (Hallucination() && !program_state.gameover ? 1 : 0);

    if (!isok(x, y))
        return _("drink"); /* should never happen */
    ltyp = SURFACE_AT(x, y);

    if (ltyp == LAVAPOOL) {
        Snprintf(pooltype, sizeof(array_of(char, 40)), _("molten %s"), hliquid(_("lava")));
        return pooltype;
    } else if (ltyp == ICE) {
        if (!hallucinate)
            return _("ice");
        Snprintf(pooltype, sizeof(array_of(char, 40)), _("frozen %s"), hliquid(_("water")));
        return pooltype;
    } else if (ltyp == POOL) {
        Snprintf(pooltype, sizeof(array_of(char, 40)), _("pool of %s"), hliquid(_("water")));
        return pooltype;
    } else if (ltyp == MOAT) {
        /* a bit of extra flavor over general moat */
        if (hallucinate) {
            Snprintf(pooltype, sizeof(array_of(char, 40)), _("deep %s"), hliquid(_("water")));
            return pooltype;
        } else if (Is_medusa_level(u.uz)) {
            /* somewhat iffy since ordinary stairs can take you beneath,
               but previous generic "water" was rather anti-climactic */
            return _("shallow sea");
        } else if (Is_juiblex_level(u.uz)) {
            return _("swamp");
        } else if (Role_if(PM_SAMURAI) && Is_qstart(u.uz)) {
            /* samurai quest home level has two isolated moat spots;
               they sound silly if farlook describes them as such */
            return _("pond");
        } else {
            return _("moat");
        }
    } else if (IS_WATERWALL(ltyp)) {
        if (Is_waterlevel(u.uz))
            return _("limitless water"); /* even if hallucinating */
        Snprintf(pooltype, sizeof(array_of(char, 40)), _("wall of %s"), hliquid(_("water")));
        return pooltype;
    } else if (ltyp == LAVAWALL) {
        Snprintf(pooltype, sizeof(array_of(char, 40)), _("wall of %s"), hliquid(_("lava")));
        return pooltype;
    }
    /* default; should be unreachable */
    return _("water"); /* don't hallucinate this as some other liquid */
}

export function ice_descr(x, y, outbuf) { /* char * */
    let icetyp = static_array("ice_descr.icetyp", ptr_to(char), null, [
        _("solid"),    /* 0: not melting */
        _("sturdy"),   /* 1: more than 1000 turns left */
        _("steady"),   /* 2: 101..1000 turns left */
        _("unsteady"), /* 3:  51..100 turns left */
        _("thin"),     /* 4:  15..50 turns left */
        _("slushy"),   /* 5:   1..14 turns left; matches Warning on ice */
    ]);
    /* same formula as is used in distant_name() for objects */
    let r = (u.xray_range > 2) ? u.xray_range : 2,
        neardist = (r * r) * 2 - r; /* same as r*r + r*(r-1) */

    iflags.ice_rating = -1; /* secondary output, for 'mention_decor' */
    if (SURFACE_AT(x, y) != ICE) {
        sprintf(outbuf, _("[ice:%d?]"), (levl()[x][y].typ));
    } else if ((distu(x, y) > neardist
                || (!cansee(x, y) && (!u_at(x, y) || Levitation())))
               && !gd.decor_levitate_override) { /* probe_decor(pickup.c) */
        strcpy(outbuf, waterbody_name(x, y)); /* "ice" or "frozen <liquid>" */
    } else {
        let time_left = spot_time_left(x, y, MELT_ICE_AWAY);

        /* other, real ice thickness/strength terminology exists but seems
           to be too unfamiliar for nethack's use */
        iflags.ice_rating = !time_left ? 0                /* solid */
                            : (time_left > 1000) ? 1     /* sturdy */
                              : (time_left > 100) ? 2    /* steady */
                                : (time_left > 50) ? 3   /* unsteady */
                                  : (time_left > 14) ? 4 /* thin */
                                    : 5;                  /* slushy */
        sprintf(outbuf, _("%s %s"), icetyp[iflags.ice_rating], waterbody_name(x, y))
;
    }
    return outbuf;
}

/*
 * Return the name of the glyph found at (x,y).
 * If not hallucinating and the glyph is a monster, also monster data.
 */
function lookat(x, y, buf, monbuf) { /* struct permonst * */
    let mtmp = null;
    let pm = null;
    let glyph;

    chars[buf + 0] = chars[monbuf + 0] = ord('\0');
    glyph = glyph_at(x, y);
    if (u_at(x, y) && canspotself()
        && !(iflags.save_uswallow
             && glyph == mon_to_glyph(u.ustuck, rn2_on_display_rng))
        && (!iflags.terrainmode || (iflags.terrainmode & TER_MON) != 0)) {
        /* fill in buf[] */
        self_lookat(buf);

        /* file lookup can't distinguish between "gnomish wizard" monster
           and correspondingly named player character, always picking the
           former; force it to find the general "wizard" entry instead */
        if (Role_if(PM_WIZARD) && Race_if(PM_GNOME) && !Upolyd())
            pm = mons[PM_WIZARD];

        /* When you see yourself normally, no explanation is appended
           (even if you could also see yourself via other means).
           Sensing self while blind or swallowed is treated as if it
           were by normal vision (cf canseeself()). */
        if ((Invisible() || u.uundetected) && !Blind()
            && !(u.uswallow || iflags.save_uswallow)) {
            let how = 0;

            if (Infravision())
                how = unsigned(how | 1);
            if (Unblind_telepat())
                how = unsigned(how | 2);
            if (Detect_monsters())
                how = unsigned(how | 4);

            if (how)
                sprintf(eos(buf), _(" [seen: %s%s%s%s%s]"), (how & 1) ? _("infravision") : _(""), ((how & 3) > 2) ? _(", ") : _(""), (how & 2) ? _("telepathy") : _(""), ((how & 7) > 4) ? _(", ") : _(""), (how & 4) ? _("monster detection") : _(""))

;
        }
    } else if (u.uswallow) {
        /* when swallowed, we're only called for spots adjacent to hero,
           and blindness doesn't prevent hero from feeling what holds him */
        sprintf(buf, _("interior of %s"), mon_nam(u.ustuck));
        pm = u.ustuck.data;
    } else if (glyph_is_monster(glyph)) {
        if ((mtmp = m_at(x, y)) != null) {
            look_at_monster(buf, monbuf, mtmp, x, y);
            pm = mtmp.data;
        } else if (Hallucination()) {
            /* 'monster' must actually be a statue */
            strcpy(buf, rndmonnam(0));
        }
    } else if (glyph_is_object(glyph)) {
        look_at_object(buf, x, y, glyph); /* fill in buf[] */
    } else if (glyph_is_trap(glyph)) {
        let tnum = glyph_to_trap(glyph);

        trap_description(buf, tnum, x, y);
    } else if (glyph_is_warning(glyph)) {
        let warnindx = glyph_to_warning(glyph);

        strcpy(buf, def_warnsyms[warnindx].explanation);
    } else if (glyph_is_invisible(glyph)) {
        strcpy(buf, invisexplain); /* redundant; handled by caller */
    } else if (glyph_is_nothing(glyph)) {
        strcpy(buf, _("dark part of a room"));
    } else if (glyph_is_unexplored(glyph)) {
        if (Underwater() && !Is_waterlevel(u.uz)) {
            /* "unknown" == previously mapped but not visible when
               submerged; better terminology appreciated... */
            strcpy(buf, next2u(x, y) ? _("land") : _("unknown"));
        } else {
            strcpy(buf, _("unexplored area"));
        }
    } else if (glyph_is_cmap(glyph)) {
        let amsk;
        let algn;
        let symidx = glyph_to_cmap(glyph);

        switch (symidx) {
        case S_altar:
            amsk = altarmask_at(x, y);
            algn = Amask2align(amsk & AM_MASK);
            sprintf(buf, _("%s %saltar"), (Is_astralevel(u.uz) && !next2u(x, y)
                     && (amsk & AM_SANCTUM))
                        ? _("aligned")
                        : align_str(algn), (amsk & AM_SANCTUM) ? _("high ") : _(""))

;
            break;
        case S_ndoor:
            if (is_drawbridge_wall(x, y) >= 0)
                strcpy(buf, _("open drawbridge portcullis"));
            else if ((levl()[x][y].flags & ~D_TRAPPED) == D_BROKEN)
                strcpy(buf, _("broken door"));
            else
                strcpy(buf, _("doorway"));
            break;
        case S_cloud:
            strcpy(buf, Is_airlevel(u.uz) ? _("cloudy area") : _("fog/vapor cloud"))
;
            break;
        case S_pool:
        case S_water: /* was Plane of Water, now that or "wall of water" */
        case S_lava:
        case S_lavawall:
        case S_ice: /* for hallucination; otherwise defsyms[] would be fine */
            strcpy(buf, waterbody_name(x, y));
            break;
        case S_engroom:
        case S_engrcorr:
            strcpy(buf, _("engraving"));
            break;
        case S_stone:
            if (!levl()[x][y].seenv) {
                strcpy(buf, _("unexplored"));
                break;
            } else if (Underwater() && !Is_waterlevel(u.uz)) {
                /* "unknown" == previously mapped but not visible when
                   submerged; better terminology appreciated... */
                strcpy(buf, next2u(x, y) ? _("land") : _("unknown"));
                break;
            } else if (levl()[x][y].typ == STONE || levl()[x][y].typ == SCORR) {
                strcpy(buf, _("stone"));
                break;
            }
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        default:
            strcpy(buf, defsyms[symidx].explanation);
            break;
        }
    } else { /* not mon, obj, trap, or cmap */
        strcpy(buf, _("unexplored area"));
    }
    return (pm && !Hallucination()) ? pm : null;
}

/* used to decide whether the context-sensitive inventory action menu for
   item 'otmp' should include the "/ - look up this item" choice */
export function ia_checkfile(otmp) { /* boolean */
    const $frame = stack_frame(); try {
    let itemnam = stack_array(char, BUFSZ);

    /* singular() of xname() of otmp is what "/i" looks up */
    strcpy(itemnam, singular(otmp, xname));
    return checkfile(itemnam, null,
                     chkfilIaCheck | chkfilDontAsk, 0);
    } finally { stack_pop($frame); }
}

/*
 * Look in the "data" file for more info.  Called if the user typed in the
 * whole name (user_typed_name == TRUE), or we've found a possible match
 * with a character/glyph and flags.help is TRUE.
 *
 * NOTE: when (user_typed_name == FALSE), inp is considered read-only and
 *       must not be changed directly, e.g. via lcase(). We want to force
 *       lcase() for data.base lookup so that we can have a clean key.
 *       Therefore, we create a copy of inp _just_ for data.base lookup.
 *
 * Returns True if an entry is found, False otherwise.
 */
function checkfile(
    inp,
    pm,
    chkflags,
    supplemental_name) { /* boolean */
    const $frame = stack_frame(); try {
    var fp;
    var buf = stack_array(char, BUFSZ), newstr = stack_array(char, BUFSZ), givenname = stack_array(char, BUFSZ);
    var ep, dbase_str;
    var user_typed_name = +((chkflags & chkfilUsrTyped) != 0),
            without_asking = +((chkflags & chkfilDontAsk) != 0),
            ia_checking = +((chkflags & chkfilIaCheck) != 0);
    var txt_offset = stack_var(ulong, 0);
    var datawin = WIN_ERR;
    var res = FALSE;

    fp = dlb_fopen(_(DATAFILE), _("r"));
    if (!fp) {
        pline(_("Cannot open 'data' file!"));
        return res;
    }
    /* If someone passed us garbage, prevent fault. */
    checkfile_done: { if (!inp || strlen(inp) > (BUFSZ - 1)) {
        impossible(_("bad do_look buffer passed (%s)!"),
                   !inp ? _("null") : _("too long"));
        break checkfile_done;
    }

    /* To prevent the need for entries in data.base like *ngel to account
     * for Angel and angel, make the lookup string the same for both
     * user_typed_name and picked name.
     */
    if (pm != null && !user_typed_name)
        dbase_str = strcpy(newstr, pm.pmnames[NEUTRAL]);
    else
        dbase_str = strcpy(newstr, inp);
    lcase(dbase_str);

    /*
     * TODO:
     * The switch from xname() to doname_vague_quan() in look_at_obj()
     * had the unintended side-effect of making names picked from
     * pointing at map objects become harder to simplify for lookup.
     * We should split the prefix and suffix handling used by wish
     * parsing and also wizmode monster generation out into separate
     * routines and use those routines here.  This currently lacks
     * erosion handling and probably lots of other bits and pieces
     * that wishing already understands and most of this duplicates
     * stuff already done for wish handling or monster generation.
     */
    if (!strncmp(dbase_str, _("interior of "), 12))
        dbase_str += 12;
    if (!strncmp(dbase_str, _("a "), 2))
        dbase_str += 2;
    else if (!strncmp(dbase_str, _("an "), 3))
        dbase_str += 3;
    else if (!strncmp(dbase_str, _("the "), 4))
        dbase_str += 4;
    else if (!strncmp(dbase_str, _("some "), 5))
        dbase_str += 5;
    else if (digit(chars[dbase_str])) {
        /* remove count prefix ("2 ya") which can come from looking at map */
        while (digit(chars[dbase_str]))
            ++dbase_str;
        if (chars[dbase_str] == ord(' '))
            ++dbase_str;
    }
    if (!strncmp(dbase_str, _("pair of "), 8))
        dbase_str += 8;
    if (!strncmp(dbase_str, _("tame "), 5))
        dbase_str += 5;
    else if (!strncmp(dbase_str, _("peaceful "), 9))
        dbase_str += 9;
    if (!strncmp(dbase_str, _("invisible "), 10))
        dbase_str += 10;
    if (!strncmp(dbase_str, _("saddled "), 8))
        dbase_str += 8;
    if (!strncmp(dbase_str, _("blessed "), 8))
        dbase_str += 8;
    else if (!strncmp(dbase_str, _("uncursed "), 9))
        dbase_str += 9;
    else if (!strncmp(dbase_str, _("cursed "), 7))
        dbase_str += 7;
    if (!strncmp(dbase_str, _("empty "), 6))
        dbase_str += 6;
    if (!strncmp(dbase_str, _("partly used "), 12))
        dbase_str += 12;
    else if (!strncmp(dbase_str, _("partly eaten "), 13))
        dbase_str += 13;
    if (!strncmp(dbase_str, _("statue of "), 10))
        chars[dbase_str + 6] = ord('\0');
    else if (!strncmp(dbase_str, _("figurine of "), 12))
        chars[dbase_str + 8] = ord('\0');
    /* remove enchantment ("+0 aklys"); [for 3.6.0 and earlier, this wasn't
       needed because looking at items on the map used xname() rather than
       doname() hence known enchantment was implicitly suppressed] */
    if (chars[dbase_str] && strchr(_("+-"), chars[dbase_str + 0]) && digit(chars[dbase_str + 1])) {
        ++dbase_str; /* skip sign */
        while (digit(chars[dbase_str]))
            ++dbase_str;
        if (chars[dbase_str] == ord(' '))
            ++dbase_str;
    }
    /* "towel", "wet towel", and "moist towel" share one data.base entry;
       for "wet towel", we keep prefix so that the prompt will ask about
       "wet towel"; for "moist towel", we also want to ask about "wet towel".
       (note: strncpy() only terminates output string if the specified
       count is bigger than the length of the substring being copied) */
    if (!strncmp(dbase_str, _("moist towel"), 11))
        memcpy(dbase_str += 2, _("wet"), 3); /* skip "mo" replace "ist" */

    /* Make sure the name is non-empty. */
    bad_data_file: { if (chars[dbase_str]) {
        var pass1offset = -1;
        var chk_skip, pass = 1;
        var yes_to_moreinfo, found_in_file, pass1found_in_file,
                skipping_entry;
        var sp, ap, alt = 0; /* alternate description */

        /* adjust the input to remove "named " and "called " */
        if ((ep = strstri(dbase_str, _(" named "))) != 0) {
            alt = ep + 7;
            if ((ap = strstri(dbase_str, _(" called "))) != 0 && ap < ep)
                ep = ap; /* "named" is alt but truncate at "called" */
        } else if ((ep = strstri(dbase_str, _(" called "))) != 0) {
            copynchars(givenname, ep + 8, BUFSZ - 1);
            alt = givenname;
            if (supplemental_name && (sp = strstri(inp, _(" called "))) != 0)
                copynchars(supplemental_name, sp + 8, BUFSZ - 1);
        } else
            ep = strstri(dbase_str, _(", "));
        if (ep && ep > dbase_str)
            chars[ep] = ord('\0');
        /* remove article from 'alt' name ("a pair of lenses named
           The Eyes of the Overworld" simplified above to "lenses named
           The Eyes of the Overworld", now reduced to "The Eyes of the
           Overworld", skip "The" as with base name processing) */
        if (alt && (!strncmpi(alt, _("a "), 2)
                    || !strncmpi(alt, _("an "), 3)
                    || !strncmpi(alt, _("the "), 4)))
            alt = strchr(alt, ord(' ')) + 1;
        /* remove charges or "(lit)" or wizmode "(N aum)" */
        if ((ep = strstri(dbase_str, _(" ("))) != 0 && ep > dbase_str)
            chars[ep] = ord('\0');
        if (alt && (ap = strstri(alt, _(" ("))) != 0 && ap > alt)
            chars[ap] = ord('\0');

        /* If the object's name matches the player-specified fruitname,
           then "fruit" is the alternate description. We do this here so that
           if the fruit name is an extant object, looking at the fruit yields
           that object's description. */
        if (!alt && fruit_from_name(dbase_str, TRUE, null))
            alt = strcpy(newstr, obj_descr[SLIME_MOLD].oc_name);
        /*
         * If the object is named, then the name is the alternate description;
         * otherwise, the result of makesingular() applied to the name is.
         * This isn't strictly optimal, but named objects of interest to the
         * user will usually be found under their name, rather than under
         * their object type, so looking for a singular form is pointless.
         */
        else if (!alt)
            alt = makesingular(dbase_str);

        pass1found_in_file = FALSE;
        for (pass = !strcmp(alt, dbase_str) ? 0 : 1; pass >= 0; --pass) {
            found_in_file = skipping_entry = FALSE;
            txt_offset[0] = 0;
            if (dlb_fseek(fp, int(txt_offset[0]), SEEK_SET) < 0 ) {
                impossible(_("can't get to start of 'data' file"));
                break checkfile_done;
            }
            /* skip first record; read second */
            if (!dlb_fgets(buf, BUFSZ, fp) || !dlb_fgets(buf, BUFSZ, fp)) {
                impossible(_("can't read 'data' file"));
                break checkfile_done;
            } else if (sscanf(buf, _("%8llx\n"), txt_offset) < 1
                       || txt_offset[0] == 0)
                break bad_data_file;;

            /* look for the appropriate entry */
            while (dlb_fgets(buf, BUFSZ, fp)) {
                if (chars[buf] == ord('.'))
                    break; /* we passed last entry without success */

                if (digit(chars[buf])) {
                    /* a number indicates the end of current entry */
                    skipping_entry = FALSE;
                } else if (!skipping_entry) {
                    if (!(ep = strchr(buf, ord('\n'))))
                        break bad_data_file;;
                    strip_newline((ep > buf) ? ep - 1 : ep);
                    /* if we match a key that begins with "~", skip
                       this entry */
                    chk_skip = (chars[buf] == ord('~')) ? 1 : 0;
                    if ((pass == 0 && pmatch(buf + chk_skip, dbase_str))
                        || (pass == 1 && alt && pmatch(buf + chk_skip, alt))) {
                        if (chk_skip) {
                            skipping_entry = TRUE;
                            continue;
                        } else {
                            found_in_file = TRUE;
                            if (pass == 1)
                                pass1found_in_file = TRUE;
                            break;
                        }
                    }
                }
            }
            if (found_in_file) {
                var entry_offset = stack_var(long), fseekoffset;
                var entry_count = stack_var(int);
                var i;

                /* skip over other possible matches for the info */
                do {
                    if (!dlb_fgets(buf, BUFSZ, fp))
                        break bad_data_file;;
                } while (!digit(chars[buf]));
                if (sscanf(buf, _("%lld,%d\n"), entry_offset, entry_count) < 2)
                    break bad_data_file;;
                fseekoffset = (txt_offset[0]) + entry_offset[0];
                if (pass == 1)
                    pass1offset = fseekoffset;
                else if (fseekoffset == pass1offset)
                    break checkfile_done;;

                yes_to_moreinfo = FALSE;
                if (!user_typed_name && !without_asking) {
                    var entrytext = pass ? alt : dbase_str;
                    var question = stack_array(char, QBUFSZ);

                    strcpy(question, _("More info about \""));
                    /* +2 => length of "\"?" */
                    copynchars(eos(question), entrytext,
                               int(unsigned(sizeof(array_of(char, QBUFSZ)) - 1
                                      - unsigned(strlen(question) + 2))));
                    strcat(question, _("\"?"));
                    if (y_n(question) == ord('y'))
                        yes_to_moreinfo = TRUE;
                }

                if (user_typed_name || without_asking || yes_to_moreinfo) {
                    if (dlb_fseek(fp, fseekoffset, SEEK_SET) < 0) {
                        pline(_("? Seek error on 'data' file!"));
                        break checkfile_done;
                    }
                    res = TRUE;
                    if (ia_checking)
                        break checkfile_done;;

                    datawin = create_nhwindow()(NHW_MENU);
                    for (i = 0; i < entry_count[0]; i++) {
                        /* room for 1-tab or 8-space prefix + BUFSZ-1 + \0 */
                        var tabbuf = stack_array(char, BUFSZ + 8), tp;

                        if (!dlb_fgets(tabbuf, BUFSZ, fp))
                            break bad_data_file;;
                        tp = tabbuf;
                        if (!strchr(tp, ord('\n')))
                            break bad_data_file;;
                        strip_newline(tp);
                        /* text in this file is indented with one tab but
                           someone modifying it might use spaces instead */
                        if (chars[tp] == ord('\t')) {
                            ++tp;
                        } else if (chars[tp] == ord(' ')) {
                            /* remove up to 8 spaces (we expect 8-column
                               tab stops but user might have them set at
                               something else so we don't require it) */
                            do {
                                ++tp;
                            } while (tp < tabbuf + 8 && chars[tp] == ord(' '));
                        } else if (chars[tp]) { /* empty lines are ok */
                            break bad_data_file;
                        }
                        /* if a tab after the leading one is found,
                           convert tabs into spaces; the attributions
                           at the end of quotes typically have them */
                        if (strchr(tp, ord('\t')) != 0)
                            tabexpand(tp);
                        putstr()(datawin, 0, tp);
                    }
                    display_nhwindow()(datawin, FALSE);
                    destroy_nhwindow()(datawin), datawin = WIN_ERR;
                }
            } else if (user_typed_name && pass == 0 && !pass1found_in_file) {
                pline(_("You don't have any information on those things."));
            }
        }
    }
    break checkfile_done; /* skip error feedback */
 }
    impossible(_("'data' file in wrong format or corrupted"));
 }
    if (datawin != WIN_ERR)
        destroy_nhwindow()(datawin);
    dlb_fclose(fp);
    return res;
    } finally { stack_pop($frame); }
}

/* extracted from do_screen_description() */
function add_cmap_descr(
    found,
    idx,
    glyph,

    article,
    cc,
    x_str,
    prefix,
    hit_trap,
    firstmatch,
    out_str) { /* int */ /* input/output: current description gets appended */
    let mbuf = 0;
    let p;
    let absidx = abs(idx);

    if (glyph == NO_GLYPH) {
        /* use x_str [almost] as-is */
        if (!strcmp(x_str, _("water"))) {
            /* duplicate some transformations performed by waterbody_name() */
            if (idx == S_pool)
                x_str = _("pool of water");
            else if (idx == S_water)
                x_str = !Is_waterlevel(u.uz) ? _("wall of water")
                                              : _("limitless water");
        }
        if (absidx == S_pool)
            idx = S_pool;
    } else if (absidx == S_pool || idx == S_water
               || idx == S_lava || idx == S_lavawall || idx == S_ice) {
        /* replace some descriptions (x_str) with waterbody_name() */
        let save_ltyp = levl()[cc.x][cc.y].typ;
        let save_prop = EHalluc_resistance();

        /* grab a scratch buffer we can safely return (via *firstmatch
           when applicable) */
        mbuf = mon_nam(gy.youmonst);

        if (absidx == S_pool) {
            levl()[cc.x][cc.y].typ = (idx == S_pool) ? POOL : MOAT;
            idx = S_pool; /* force fake negative moat value to be positive */
        } else {
            /* we might be examining a pool location but trying to match
               water or lava; override the terrain with what we're matching
               because that's what waterbody_name() bases its result on;
               it's not pool so must be one of water/lava/ice to get here */
            levl()[cc.x][cc.y].typ = (idx == S_water) ? WATER
                                   : (idx == S_lava) ? LAVAPOOL
                                     : (idx == S_lavawall) ? LAVAWALL
                                       : ICE;
        }
        u.uprops[HALLUC_RES].extrinsic = 1;
        strcpy(mbuf, waterbody_name(cc.x, cc.y));
        u.uprops[HALLUC_RES].extrinsic = save_prop;
        levl()[cc.x][cc.y].typ = save_ltyp;

        /* shorten the feedback for farlook/quicklook: "pool or ..." */
        if (!strcmp(mbuf, _("pool of water")))
            chars[mbuf + 4] = ord('\0');
        else if (!strcmp(mbuf, _("molten lava")))
            strcpy(mbuf, _("lava"));
        x_str = mbuf;
        /* avoid "an ice" and so forth; "a pool", "a moat", and
           "a wall of ..." are grammatically correct but make
           "a pool or a moat or a wall of water" become too verbose */
        article = +!(!strncmp(x_str, _("water"), 5)
                    || !strncmp(x_str, _("ice"), 3)
                    || !strncmp(x_str, _("pool"), 4)
                    || !strncmp(x_str, _("moat"), 4)
                    || !strncmp(x_str, _("lava"), 4)
                    || !strncmp(x_str, _("swamp"), 5)
                    || !strncmp(x_str, _("molten"), 6)
                    || !strncmp(x_str, _("shallow"), 7)
                    || !strncmp(x_str, _("limitless"), 9)
                    || !strncmp(x_str, _("wall of lava"), 12)
                    || !strncmp(x_str, _("wall of water"), 13)
                    /* ice while hallucinating */
                    || !strncmp(x_str, _("frozen"), 6)
                    /* thawing ice ("solid ice", "thin ice", &c) */
                    || ((p = strchr(x_str, ord(' '))) != 0 && !strncmpi((p), _((" ice")), -1))
                    );
    }

    if (!found) {
        /* this is the first match */
        if (is_cmap_trap(idx) && idx != S_vibrating_square) {
            sprintf(out_str, _("%sa trap"), prefix);
            chars[hit_trap] = TRUE;
        } else {
            sprintf(out_str, _("%s%s"), prefix, (article == 2) ? the(x_str)
                                             : (article == 1) ? an(x_str)
                                               : x_str);
        }
        firstmatch[0] = x_str;
        found = 1;
    } else if (!(chars[hit_trap] && is_cmap_trap(idx))
               && !(found >= 3 && is_cmap_drawbridge(idx))
               /* don't mention vibrating square outside of Gehennom
                  unless this happens to be one (hallucination?) */
               && (idx != S_vibrating_square || Inhell()
                   || (glyph_is_trap(glyph)
                       && glyph_to_trap(glyph) == VIBRATING_SQUARE))) {
        /* append unless out_str already contains the string to append */
        found += append_str(out_str, (article == 2) ? the(x_str)
                                     : (article == 1) ? an(x_str)
                                       : x_str);
        if (is_cmap_trap(idx) && idx != S_vibrating_square)
            chars[hit_trap] = TRUE;
    }
    return found;
}

export function do_screen_description(
    cc, looked,
    sym, out_str,
    firstmatch,
    for_supplement) { /* int */
    const $frame = stack_frame(); try {
    var mon_interior = init_string(static_array("do_screen_description.mon_interior", char, sizeof_string("the interior of a monster")), _("the interior of a monster"), true),
                      unreconnoitered = init_string(static_array("do_screen_description.unreconnoitered", char, sizeof_string("unreconnoitered")), _("unreconnoitered"), true);
    var look_buf = static_array("do_screen_description.look_buf", char, BUFSZ);
    var prefix = stack_array(char, BUFSZ);
    var i, j, alt_i, glyph = NO_GLYPH,
        skipped_venom = 0, found = 0; /* count of matching syms found */
    var hit_trap = stack_var(boolean), need_to_look = FALSE,
            submerged = (Underwater() && !Is_waterlevel(u.uz) ? 1 : 0),
            hallucinate = (Hallucination() && !program_state.gameover ? 1 : 0);
    var x_str;
    var tmpsym;
    var glyphinfo = struct_assign(stack_struct(struct_glyphinfo), nul_glyphinfo);

    if (looked) {
        glyph = glyph_at(cc.x, cc.y);
        /* Convert glyph at selected position to a symbol for use below. */
        map_glyphinfo(cc.x, cc.y, glyph, 0, glyphinfo);
        sym = glyphinfo.ttychar;
        sprintf(prefix, _("%s        "), encglyph(glyphinfo.glyph));
    } else
        sprintf(prefix, _("%c        "), sym);

    /*
     * Check all the possibilities, saving all explanations in a buffer.
     * When all have been checked then the string is printed.
     */

    /*
     * Handle restricted vision range (limited to adjacent spots when
     * swallowed or underwater) cases first.
     *
     * 3.6.0 listed anywhere on map, other than self, as "interior
     * of a monster" when swallowed, and non-adjacent water or
     * non-water anywhere as "dark part of a room" when underwater.
     * "unreconnoitered" is an attempt to convey "even if you knew
     * what was there earlier, you don't know what is there in the
     * current circumstance".
     *
     * (Note: 'self' will always be visible when swallowed so we don't
     * need special swallow handling for <ux,uy>.
     * Another note: for '#terrain' without monsters, u.uswallow and
     * submerged will always both be False and skip this code.)
     */
    x_str = 0;
    if (!looked) {
        ; /* skip special handling */
    } else if (((u.uswallow || submerged) && !next2u(cc.x, cc.y))
               /* detection showing some category, so mostly background */
               || ((iflags.terrainmode & (TER_DETECT | TER_MAP)) == TER_DETECT
                   && glyph == cmap_to_glyph(S_stone))) {
        x_str = unreconnoitered;
        need_to_look = FALSE;
    } else if (is_swallow_sym(sym)) {
        x_str = mon_interior;
        need_to_look = TRUE; /* for specific monster type */
    }
    didlook: { if (x_str) {
        /* we know 'found' is zero here, but guard against some other
           special case being inserted ahead of us someday */
        if (!found) {
            sprintf(out_str, _("%s%s"), prefix, x_str);
            firstmatch[0] = x_str;
            found++;
        } else {
            found += append_str(out_str, x_str); /* not 'an(x_str)' */
        }
        /* for is_swallow_sym(), we want to list the current symbol's
           other possibilities (wand for '/', throne for '\\', &c) so
           don't jump to the end for the x_str==mon_interior case */
        if (x_str == unreconnoitered)
            break didlook;;
    }

 check_monsters: for (;;) {
    /* Check for monsters */
    if (!iflags.terrainmode || (iflags.terrainmode & TER_MON) != 0) {
        for (i = 1; i < MAXMCLASSES; i++) {
            if (i == S_invisible)  /* avoid matching on this */
                continue;
            if (sym == (looked ? uchars[gs.showsyms + (i + SYM_OFF_M)]
                               : def_monsyms[i].sym)
                && def_monsyms[i].explain && chars[def_monsyms[i].explain]) {
                need_to_look = TRUE;
                if (!found) {
                    sprintf(out_str, _("%s%s"), prefix, an(def_monsyms[i].explain))
;
                    firstmatch[0] = def_monsyms[i].explain;
                    found++;
                } else {
                    found += append_str(out_str, an(def_monsyms[i].explain));
                }
            }
        }
        /* handle '@' as a special case if it refers to you and you're
           playing a character which isn't normally displayed by that
           symbol; firstmatch is assumed to already be set for '@' */
        if ((looked ? (sym == uchars[gs.showsyms + (S_HUMAN + SYM_OFF_M)]
                       && u_at(cc.x, cc.y))
                    : (sym == def_monsyms[S_HUMAN].sym && !flags.showrace))
            && !(Race_if(PM_HUMAN) || Race_if(PM_ELF)) && !Upolyd())
            found += append_str(out_str, _("you")); /* tack on "or you" */
    }

    /* Now check for objects */
    if (!iflags.terrainmode || (iflags.terrainmode & TER_OBJ) != 0) {
        var oc_ptr;
        var bouldersym;

        j = SYM_BOULDER + SYM_OFF_X;
        bouldersym = Is_rogue_level(u.uz) ? uchars[go.ov_rogue_syms + j]
                                           : uchars[go.ov_primary_syms + j];
        if (!bouldersym)
            bouldersym = uchar(def_oc_syms[ROCK_CLASS].sym);

        for (i = 1; i < MAXOCLASSES; i++) {
            if ((i != ROCK_CLASS)
                ? (sym == (looked ? uchars[gs.showsyms + (i + SYM_OFF_O)]
                                  : def_oc_syms[i].sym))
                /* ROCK_CLASS is complicated; statues are displayed as the
                   monster they depict rather than as S_rock; boulders might
                   be displayed as a custom symbol rather than as S_rock */
                : (glyph_is_statue(glyph) || sym == bouldersym)) {
                oc_ptr = def_oc_syms[i].explain;
                /* for added fun, engravings are shown with the same symbol
                   as S_rock which is why we want to shorten this */
                if (i == ROCK_CLASS && !strcmp(oc_ptr, _("boulder or statue"))) {
                    if (sym == bouldersym)
                        oc_ptr = _("boulder"); /* discard "or statue" */
                    else if (glyph_is_statue(glyph))
                        oc_ptr = _("statue"); /* discard "boulder or" */
                    else if (looked)
                        continue; /* discard both */
                }
                need_to_look = TRUE;
                if (looked && i == VENOM_CLASS) {
                    skipped_venom++;
                    continue;
                }
                if (!found) {
                    sprintf(out_str, _("%s%s"), prefix, an(oc_ptr));
                    /* note: if the value assigned to *firstmatch ever
                       becomes dynamically constructed, it will need to be
                       copied into a static buffer; as of now, all alternate
                       values are string literals and implicitly static */
                    firstmatch[0] = oc_ptr;
                    found++;
                } else {
                    found += append_str(out_str, an(oc_ptr));
                }
            }
        }
    }

    if (sym == DEF_INVISIBLE) {
        /* for active clairvoyance, use alternate "unseen creature" */
        var usealt = +((EDetect_monsters() & I_SPECIAL) != 0);
        var unseen_explain = (usealt || Blind()) ? altinvisexplain
                                                       : invisexplain;

        if (!found) {
            sprintf(out_str, _("%s%s"), prefix, an(unseen_explain));
            firstmatch[0] = unseen_explain;
            found++;
        } else {
            found += append_str(out_str, an(unseen_explain));
        }
    }
    if ((glyph && glyph_is_nothing(glyph))
        || (looked && sym == uchars[gs.showsyms + (SYM_NOTHING + SYM_OFF_X)])) {
        x_str = _("the dark part of a room");
        if (!found) {
            sprintf(out_str, _("%s%s"), prefix, x_str);
            firstmatch[0] = x_str;
            found++;
        } else {
            found += append_str(out_str, x_str);
        }
    }
    if ((glyph && glyph_is_unexplored(glyph))
        || (looked && sym == uchars[gs.showsyms + (SYM_UNEXPLORED + SYM_OFF_X)])) {
        x_str = _("unexplored");
        if (submerged)
            x_str = _("land"); /* replace "unexplored" */
        if (!found) {
            sprintf(out_str, _("%s%s"), prefix, x_str);
            firstmatch[0] = x_str;
            found++;
        } else {
            found += append_str(out_str, x_str);
        }
    }
    /* Now check for graphics symbols */
    for (hit_trap[0] = FALSE, i = 0; i < MAXPCHARS; i++) {
        /*
         * Index hackery:  we want
         *   "pool or moat or wall of water or lava or wall of lava"
         * rather than
         *   "pool or moat or lava or wall of lava or wall of water"
         * but S_lava comes before S_water so 'i' reaches it sooner.
         * Use 'alt_i' for the rest of the loop to behave as if their
         * places were swapped.
         * This was much simpler when it just exchanged water and lava.
         * Now it rotates water to the first of (lava, lavawall, water)
         * lava to the middle of (lava, lavawall, water), and lavawall
         * to last of (lava, lavawall, water); other values are used
         * as-is.
         * If S_water (and corresponding tile) were renumbered, this
         * hackery could go away.
         */
        alt_i = (i == S_lava) ? S_water /* do water first (of these 3) */
                : (i == S_lavawall) ? S_lava /* process lava second */
                  : (i == S_water) ? S_lavawall /* and wall of lava third */
                    : i; /* other; handle in defsyms[] order */
        x_str = defsyms[alt_i].explanation;
        /* cmap includes beams, shield effects, swallow boundaries, and
           explosions; skip all of those */
        if (!chars[x_str])
            continue;

        if (sym == (looked ? uchars[gs.showsyms + alt_i] : defsyms[alt_i].sym)) {
            var article; /* article==2 => "the", 1 => "an", 0 => (none) */

            /* check if dark part of a room was already included above */
            if (alt_i == S_darkroom && glyph && glyph_is_nothing(glyph))
                continue;

            /* avoid "an unexplored", "an stone", "an air",
               "a floor of a room", "a dark part of a room" */
            article = strstri(x_str, _(" of a room")) ? 2
                      : +!(alt_i == S_stone
                          || strcmp(x_str, _("air")) == 0
                          || strcmp(x_str, _("land")) == 0);

            found = add_cmap_descr(found, alt_i, glyph, article,
                                   struct_copy(cc), x_str, prefix,
                                   addr_of(hit_trap), firstmatch, out_str);
            if (alt_i == S_pool) {
                /* "pool of water" and "moat" use the same symbol and glyph
                   but have different descriptions; when handling pool, add
                   it a second time for moat but pass an alternate symbol;
                   skip incrementing 'found' to avoid "can be many things" */
                add_cmap_descr(found, -S_pool, glyph, 1,
                                      struct_copy(cc), _("moat"), prefix,
                                      addr_of(hit_trap), firstmatch, out_str);
                need_to_look = TRUE;
            }

            if (alt_i == S_altar || is_cmap_trap(alt_i)
                || (hallucinate && (alt_i == S_water /* S_pool already done */
                                    || alt_i == S_lava
                                    || alt_i == S_lavawall
                                    || alt_i == S_ice))
                || alt_i == S_engroom || alt_i == S_engrcorr
                || alt_i == S_grave) /* 'need_to_look' to report engraving */
                need_to_look = TRUE;
        }
    }

    /* Now check for warning symbols */
    for (i = 1; i < WARNCOUNT; i++) {
        x_str = def_warnsyms[i].explanation;
        if (sym == (looked ? uchars[gw.warnsyms + i] : def_warnsyms[i].sym)) {
            if (!found) {
                sprintf(out_str, _("%s%s"), prefix, x_str);
                firstmatch[0] = x_str;;
                found++;
            } else {
                found += append_str(out_str, x_str);
            }
            /* Kludge: warning trumps boulders on the display.
               Reveal the boulder too or player can get confused */
            if (looked && sobj_at(BOULDER, cc.x, cc.y))
                strcat(out_str, _(" co-located with a boulder"));
            break; /* out of for loop*/
        }
    }

    /* if we ignored venom and list turned out to be short, put it back */
    if (skipped_venom && found < 2) {
        x_str = def_oc_syms[VENOM_CLASS].explain;
        if (!found) {
            sprintf(out_str, _("%s%s"), prefix, an(x_str));
            firstmatch[0] = x_str;
            found++;
        } else {
            found += append_str(out_str, an(x_str));
        }
    }

    /* Finally, handle some optional overriding symbols */
    for (j = SYM_OFF_X; j < SYM_MAX; ++j) {
        if (j == SYM_INVISIBLE + SYM_OFF_X || j == SYM_BOULDER + SYM_OFF_X)
            continue;       /* already handled above */
        tmpsym = Is_rogue_level(u.uz) ? uchars[go.ov_rogue_syms + j]
                                       : uchars[go.ov_primary_syms + j];
        if (tmpsym && sym == tmpsym) {
            switch (j) {
            /* #if 0: not in this build */

            case SYM_PET_OVERRIDE + SYM_OFF_X:
                if (looked) {
                    /* convert to symbol without override in effect */
                    map_glyphinfo(cc.x, cc.y, glyph, MG_FLAG_NOOVERRIDE,
                                  glyphinfo);
                    sym = glyphinfo.ttychar;
                    continue check_monsters;
                }
                break;
            case SYM_HERO_OVERRIDE + SYM_OFF_X:
                sym = uchars[gs.showsyms + (S_HUMAN + SYM_OFF_M)];
                continue check_monsters;
            }
        }
    } break; }

    /*
     * If we are looking at the screen, follow multiple possibilities or
     * an ambiguous explanation by something more detailed.
     */

    if (found > 4)
        /* 3.6.3: this used to be "That can be many things" (without prefix)
           which turned it into a sentence that lacked its terminating period;
           we could add one below but reinstating the prefix here is better */
        sprintf(out_str, _("%scan be many things"), prefix);
 }
    if (looked) {
        var pm = null;

        if (found > 1 || need_to_look) {
            var monbuf = stack_array(char, BUFSZ);
            var temp_buf = stack_array(char, BUFSZ);

            pm = lookat(cc.x, cc.y, look_buf, monbuf);
            if (pm && for_supplement)
                for_supplement[0] = pm;
            if (!strcmp(look_buf, _("ice")))
                ice_descr(cc.x, cc.y, look_buf);
            if (!strcmp(look_buf, _("staircase down"))
                && on_level(u.uz, svd.dungeon_topology.d_qstart_level) && !ok_to_quest())
                strcpy(look_buf, _("blocked staircase down"));

            if (chars[look_buf + 0] != ord('\0'))
                firstmatch[0] = look_buf;
            if (chars[(firstmatch[0])]) {
                sprintf(temp_buf, _(" (%s"), firstmatch[0]);
                add_quoted_engraving(cc.x, cc.y, temp_buf, FALSE);
                strcat(temp_buf, _(")"));
                strncat(out_str, temp_buf,
                               unsigned(unsigned(BUFSZ - strlen(out_str)) - 1));
                found = 1; /* we have something to look up */
            }
            if (chars[monbuf + 0]) {
                Snprintf(temp_buf, sizeof(array_of(char, BUFSZ)), _(" [seen: %s]"), monbuf);
                strncat(out_str, temp_buf,
                               unsigned(unsigned(BUFSZ - strlen(out_str)) - 1));
            }
        }
    }

    return found;
    } finally { stack_pop($frame); }
}

/* when farlook is reporting on an engraving, include its text */
function add_quoted_engraving(
    x, y,
    buf,
    force) { /* boolean */ /* True: '/e' or '/E', False: '//' or ';' */
    const $frame = stack_frame(); try {
    let temp_buf = stack_array(char, BUFSZ);
    let ep = engr_at(x, y);
    let floorengr = +!strcmp(buf, _(" (engraving")),
            headstone = +!strcmp(buf, _(" (grave"));

    /*
     * If there is no engraving here, there's nothing to do; just return.
     *
     * When buf[] is " (engraving" or " (grave" then we're looking at an
     * engraving and we'll add its text.  Caller supplies the closing paren.
     *
     * If buf[] contains anything else, we're looking at something (monster
     * or object) that happens to be on top of an engraving, so we won't
     * append the engraving text.
     */
    if (!ep)
        return FALSE;

    if (!floorengr && !headstone && !force)
        return FALSE;

    if (ep.eread)
        Snprintf(temp_buf, sizeof(array_of(char, BUFSZ)), _(" with %s: \"%s\""), headstone ? _("headstone reading") : _("remembered text"), ep.engr_txt[remembered_text]);
    else
        Snprintf(temp_buf, sizeof(array_of(char, BUFSZ)), _(" %s you haven't read"), headstone ? _("whose headstone") : _("that"))

;

    strncat(buf, temp_buf, unsigned(unsigned(BUFSZ - strlen(buf)) - 1));
    return TRUE;
    } finally { stack_pop($frame); }
}

/* also used by getpos hack in getpos.c */
export const what_is_a_location = init_string(static_array("what_is_a_location", char, sizeof_string("a monster, object or location")), _("a monster, object or location"), true);

export function do_look(mode, click_cc) { /* int */
    const $frame = stack_frame(); try {
    let $goto = null; var out_str = stack_array(char, BUFSZ), cq = stack_struct(struct__cmd_queue), firstmatch = stack_var(ptr_to(char)), supplemental_pm = stack_var(ptr_to(struct_permonst)), cc = stack_struct(struct_nhcoord), pick_list = stack_var(ptr_to(struct_mi)), any = stack_struct(struct_any), temp_buf = stack_array(char, BUFSZ), supplemental_name = stack_array(char, BUFSZ);
    var quick = +(mode == 1); /* use cursor; don't search for "more info" */
    var clicklook = +(mode == 2); /* right mouse-click method */
    init_list(out_str, []);
    var cmdq;
    firstmatch[0] = 0;
    var pm = null; supplemental_pm[0] = null;
    var i = ord('\0'), ans = 0;
    var sym;              /* typed symbol or converted glyph */
    var found;            /* count of matching syms found */
                 /* screen pos of unknown glyph */
    var save_verbose; /* saved value of flags.verbose */
    var from_screen;  /* question from the screen */
    var clr = NO_COLOR;

    cc.x = 0;
    cc.y = 0;

    $goto_dowhatiscmd: for (;;) { switch ($goto) { default: if ((cmdq = cmdq_pop()) != null) {
        struct_assign(cq, cmdq);
        free(addr_of(cmdq));
        if (cq.typ == CMDQ_KEY)
            i = cq.key;
        else
            cmdq_clear(CQ_CANNED);
        { $goto = "dowhatiscmd"; continue $goto_dowhatiscmd; }
    }

    case "dowhatiscmd": if ($goto || (!clicklook)) {
        switch ($goto) { default: if (quick) {
            i = ord('y');
        } else {
            pick_list[0] = null;
            var win;

            struct_assign(any, cg.zeroany);
            win = create_nhwindow()(NHW_MENU);
            start_menu()(win, MENU_BEHAVE_STANDARD);

            /*
             * Originally this was just a y|n question about whether to
             * use the cursor or to type a word.  When other choices were
             * added, it was changed to be a menu.  Using 'y' and 'n' as
             * unshown accelerators keeps backwards compatibility with
             * the old y|n behavior.
             *
             * Initially the menu included a third choice and always used
             * 'a', 'b', and 'c'.  Then it was changed to be controlled by
             * the 'lootabc' option instead, defaulting to '/', 'i', '?'
             * when that's false.  Eventually additional entries have been
             * introduced.
             *
             * When lootabc is set, abandon the 'y'|'n' compatibility in
             * favor of newer '/' and '?' compatibility instead.
             */

            any.a_char = ord('/');
            add_menu(win, nul_glyphinfo, any,
                     flags.lootabc ? 0 : any.a_char,
                     flags.lootabc ? ord('/') : ord('y'), ATR_NONE,
                     clr, _("something on the map"), MENU_ITEMFLAGS_NONE);
            any.a_char = ord('i');
            add_menu(win, nul_glyphinfo, any,
                     /* [don't use 'i' as lootabc group accelerator because
                        it will make the regular 'i' choice inaccessible] */
                     flags.lootabc ? 0 : any.a_char, 0, ATR_NONE,
                     clr, _("something you're carrying"), MENU_ITEMFLAGS_NONE);
            any.a_char = ord('?');
            add_menu(win, nul_glyphinfo, any,
                     flags.lootabc ? 0 : any.a_char,
                     flags.lootabc ? ord('?') : ord('n'), ATR_NONE,
                     clr, _("something else (by symbol or name)"),
                     MENU_ITEMFLAGS_NONE);
            if (!u.uswallow && !Hallucination()) {
                struct_assign(any, cg.zeroany);
                add_menu_str(win, _(""));
                /* these options work sensibly for swallowed case, but
                   there's no reason for player to use them then because
                   the swallowed display hides all applicable targets;
                   objects work fine when hallucinating, but screen
                   symbol/monster class letter doesn't match up with
                   bogus monster type, so suppress when hallucinating */
                any.a_char = ord('m');
                add_menu(win, nul_glyphinfo, any,
                         flags.lootabc ? 0 : any.a_char,
                         flags.lootabc ? any.a_char : 0, ATR_NONE,
                         clr, _("nearby monsters"), MENU_ITEMFLAGS_NONE);
                any.a_char = ord('M');
                add_menu(win, nul_glyphinfo, any,
                         flags.lootabc ? 0 : any.a_char,
                         flags.lootabc ? any.a_char : 0, ATR_NONE,
                         clr, _("all monsters shown on map"),
                         MENU_ITEMFLAGS_NONE);
                any.a_char = ord('o');
                add_menu(win, nul_glyphinfo, any,
                         flags.lootabc ? 0 : any.a_char,
                         flags.lootabc ? any.a_char : 0, ATR_NONE,
                         clr, _("nearby objects"), MENU_ITEMFLAGS_NONE);
                any.a_char = ord('O');
                add_menu(win, nul_glyphinfo, any,
                         flags.lootabc ? 0 : any.a_char,
                         flags.lootabc ? any.a_char : 0, ATR_NONE,
                         clr, _("all objects shown on map"),
                         MENU_ITEMFLAGS_NONE);
                any.a_char = ord('t');
                add_menu(win, nul_glyphinfo, any,
                         flags.lootabc ? 0 : any.a_char,
                         flags.lootabc ? any.a_char : ord('^'), ATR_NONE,
                         clr, _("nearby traps"), MENU_ITEMFLAGS_NONE);
                any.a_char = ord('T');
                add_menu(win, nul_glyphinfo, any,
                         flags.lootabc ? 0 : any.a_char,
                         flags.lootabc ? any.a_char : ord('\"'), ATR_NONE,
                         clr, _("all seen or remembered traps"),
                         MENU_ITEMFLAGS_NONE);
                any.a_char = ord('e');
                add_menu(win, nul_glyphinfo, any,
                         flags.lootabc ? 0 : any.a_char,
                         /* [don't use 'e' as lootabc group accelerator] */
                         flags.lootabc ? 0 : ord('`'), ATR_NONE,
                         clr, _("nearby engravings"), MENU_ITEMFLAGS_NONE);
                any.a_char = ord('E');
                add_menu(win, nul_glyphinfo, any,
                         flags.lootabc ? 0 : any.a_char,
                         flags.lootabc ? any.a_char : ord('|'), ATR_NONE,
                         clr, _("all seen or remembered engravings"),
                         MENU_ITEMFLAGS_NONE);
            }
            end_menu()(win, _("What do you want to look at:"));
            if (select_menu(win, PICK_ONE, pick_list) > 0) {
                i = pick_list[0].item.a_char;
                free(addr_of(pick_list[0]));
            }
            destroy_nhwindow()(win);
        }

 case "dowhatiscmd": $goto = null;
        switch (i) {
        default:
        case ord('q'):
            return ECMD_OK;
        case ord('y'):
        case ord('/'):
            from_screen = TRUE;
            sym = 0;
            cc.x = u.ux;
            cc.y = u.uy;
            break;
        case ord('i'):
          {
            var invlet;
            var invobj;

            invlet = display_inventory(0, TRUE);
            if (!invlet || invlet == ord('\x1b'))
                return ECMD_OK;
            chars[out_str] = ord('\0');
            for (invobj = gi.invent; invobj; invobj = invobj.nobj)
                if (invobj.invlet == invlet) {
                    strcpy(out_str, singular(invobj, xname));
                    break;
                }
            if (chars[out_str])
                checkfile(out_str, pm, chkfilUsrTyped | chkfilDontAsk,
                                 0);
            return ECMD_OK;
          }
        case ord('?'):
            from_screen = FALSE;
            getlin(_("Specify what? (type the word)"), out_str);
            if (strcmp(out_str, _(" "))) /* keep single space as-is */
                /* remove leading and trailing whitespace and
                   condense consecutive internal whitespace */
                mungspaces(out_str);
            if (chars[out_str + 0] == ord('\0') || chars[out_str + 0] == ord('\x1b'))
                return ECMD_OK;

            if (chars[out_str + 1]) { /* user typed in a complete string */
                checkfile(out_str, pm,  chkfilUsrTyped | chkfilDontAsk,
                                 0);
                return ECMD_OK;
            }
            sym = chars[out_str + 0];
            break;
        case ord('m'):
            look_all(TRUE, TRUE); /* list nearby monsters */
            return ECMD_OK;
        case ord('M'):
            look_all(FALSE, TRUE); /* list all monsters */
            return ECMD_OK;
        case ord('o'):
            look_all(TRUE, FALSE); /* list nearby objects */
            return ECMD_OK;
        case ord('O'):
            look_all(FALSE, FALSE); /* list all objects */
            return ECMD_OK;
        case ord('t'):
            look_traps(TRUE); /* list nearby traps */
            return ECMD_OK;
        case ord('T'):
            look_traps(FALSE); /* list all traps (visible or remembered) */
            return ECMD_OK;
        case ord('e'):
            look_engrs(TRUE); /* list nearby engravings */
            return ECMD_OK;
        case ord('E'):
            look_engrs(FALSE); /* list all engravings (visible|remembered) */
            return ECMD_OK;
        } }
    } else { /* clicklook */
        cc.x = click_cc.x;
        cc.y = click_cc.y;
        sym = 0;
        from_screen = FALSE;
    } } break; }

    /* Save the verbose flag, we change it later. */
    save_verbose = flags.verbose;
    flags.verbose = (flags.verbose && !quick ? 1 : 0);
    /*
     * The user typed one letter, or we're identifying from the screen.
     */
    do {
        /* Reset some variables. */
        pm = null;
        chars[out_str + 0] = ord('\0');

        if (from_screen || clicklook) {
            if (from_screen) {
                if (flags.verbose)
                    pline(_("Please move the cursor to %s."),
                          what_is_a_location);
                else
                    pline(_("Pick %s."), what_is_a_location);

                ans = getpos(cc, quick, what_is_a_location);
                if (ans < 0 || cc.x < 0)
                    break; /* done */
                flags.verbose = FALSE; /* only print long question once */
            }
        }

        found = do_screen_description(struct_copy(cc), (from_screen || clicklook ? 1 : 0), sym,
                                      out_str, firstmatch, supplemental_pm);

        /* Finally, print out our explanation. */
        if (found) {
            /* use putmixed() because there may be an encoded glyph present */
            putmixed()(WIN_MESSAGE, 0, out_str);
            /* #ifdef DUMPLOG_CORE: not in this build */

            /* check the data file for information about this thing */
            if (found == 1 && ans != LOOK_QUICK && ans != LOOK_ONCE
                && (ans == LOOK_VERBOSE || (flags.help && !quick))
                && !clicklook) {
                chars[supplemental_name + 0] = ord('\0');
                strcpy(temp_buf, firstmatch[0]);
                checkfile(temp_buf, pm,
                                 (ans == LOOK_VERBOSE) ? chkfilDontAsk
                                                       : chkfilNone,
                                 supplemental_name);
                if (supplemental_pm[0])
                    do_supplemental_info(supplemental_name, supplemental_pm[0],
                                         (+(ans == LOOK_VERBOSE)));
            }
        } else {
            pline(_("I've never heard of such things."));
        }
    } while (from_screen && !quick && ans != LOOK_ONCE && !clicklook);

    flags.verbose = save_verbose;
    return ECMD_OK;
    } finally { stack_pop($frame); }
}

function look_region_nearby(
    lo_x, lo_y,
    hi_x, hi_y, nearby) { /* void */
    lo_y[0] = nearby ? max(u.uy - BOLT_LIM, 0) : 0;
    lo_x[0] = nearby ? max(u.ux - BOLT_LIM, 1) : 1;
    hi_y[0] = nearby ? min(u.uy + BOLT_LIM, ROWNO - 1) : ROWNO - 1;
    hi_x[0] = nearby ? min(u.ux + BOLT_LIM, COLNO - 1) : COLNO - 1;
}

 /* RESTORE is after do_supplemental_info() */

function look_all(
    nearby,
    do_mons) { /* void */ /* True => monsters, False => objects */
    const $frame = stack_frame(); try {
    let win;
    let glyph, count = 0;
    let x, y, lo_x = stack_var(coordxy), lo_y = stack_var(coordxy), hi_x = stack_var(coordxy), hi_y = stack_var(coordxy);
    let lookbuf = stack_array(char, BUFSZ), outbuf = stack_array(char, BUFSZ);

    win = create_nhwindow()(NHW_TEXT);
    look_region_nearby(lo_x, lo_y, hi_x, hi_y, nearby);
    for (y = lo_y[0]; y <= hi_y[0]; y++) {
        for (x = lo_x[0]; x <= hi_x[0]; x++) {
            chars[lookbuf + 0] = ord('\0');
            glyph = glyph_at(x, y);
            if (do_mons) {
                if (glyph_is_monster(glyph)) {
                    let mtmp;

                    if (u_at(x, y) && canspotself()) {
                        self_lookat(lookbuf);
                        ++count;
                    } else if ((mtmp = m_at(x, y)) != null) {
                        look_at_monster(lookbuf, 0, mtmp, x, y);
                        ++count;
                    }
                } else if (glyph_is_invisible(glyph)) {
                    /* remembered, unseen, creature */
                    strcpy(lookbuf, invisexplain);
                    ++count;
                } else if (glyph_is_warning(glyph)) {
                    let warnindx = glyph_to_warning(glyph);

                    strcpy(lookbuf, def_warnsyms[warnindx].explanation);
                    ++count;
                }
            } else { /* !do_mons */
                if (glyph_is_object(glyph)) {
                    look_at_object(lookbuf, x, y, glyph);
                    ++count;
                }
            }
            if (chars[lookbuf]) {
                let coordbuf = stack_array(char, 20), which = stack_array(char, 12), cmode;

                cmode = (iflags.getpos_coords != GPCOORDS_NONE)
                           ? iflags.getpos_coords : GPCOORDS_MAP;
                if (count == 1) {
                    strcpy(which, do_mons ? _("monsters") : _("objects"));
                    if (nearby)
                        sprintf(outbuf, _("%s currently shown near %s:"), upstart(which), (cmode != GPCOORDS_COMPASS)
                                  ? coord_desc(u.ux, u.uy, coordbuf, cmode)
                                  : !canspotself() ? _("your position") : _("you"));
                    else
                        sprintf(outbuf, _("All %s currently shown on the map:"), which)

;
                    putstr()(win, 0, outbuf);
                    /* hack alert! Qt watches a text window for any line
                       with 4 consecutive spaces and renders the window
                       in a fixed-width font it if finds at least one */
                    putstr()(win, 0, _("    ")); /* separator */
                }
                coord_desc(x, y, coordbuf, cmode);
                /* this format wrinkle makes the commas of <x,y> line up;
                   it isn't needed when all the y values have same number
                   of digits but looks better when there is a mixture of 1
                   and 2 digit values; done unconditionally because we
                   would need two passes over the map to determine whether
                   y width is uniform or a mixture; x width is not a factor
                   because the result gets right-justified by %8s; adding
                   a trailing space effectively pushes non-space text left */
                if (cmode == GPCOORDS_MAP && y < 10)
                    strkitten(coordbuf, ord(' '));
                /* prefix: "coords  C  " where 'C' is mon or obj symbol */
                sprintf(outbuf, (cmode == GPCOORDS_SCREEN) ? _("%s  ")
                                  : (cmode == GPCOORDS_MAP) ? _("%8s  ")
                                      : _("%12s  "), coordbuf)
;
                sprintf(eos(outbuf), _("%s  "), encglyph(glyph));
                /* guard against potential overflow */
                chars[lookbuf + unsigned(sizeof(array_of(char, BUFSZ)) - 1 - strlen(outbuf))] = ord('\0');
                strcat(outbuf, lookbuf);
                putmixed()(win, 0, outbuf);
            }
        }
    }
    if (count)
        display_nhwindow()(win, TRUE);
    else
        pline(_("No %s are currently shown %s."),
              do_mons ? _("monsters") : _("objects"),
              nearby ? _("nearby") : _("on the map"));
    destroy_nhwindow()(win);
    } finally { stack_pop($frame); }
}

/* give a /M style display of discovered traps, even when they're covered */
function look_traps(nearby) { /* void */
    const $frame = stack_frame(); try {
    let win;
    let t;
    let glyph, tnum, count = 0;
    let x, y, lo_x = stack_var(coordxy), lo_y = stack_var(coordxy), hi_x = stack_var(coordxy), hi_y = stack_var(coordxy);
    let lookbuf = stack_array(char, BUFSZ), outbuf = stack_array(char, BUFSZ);

    win = create_nhwindow()(NHW_TEXT);
    look_region_nearby(lo_x, lo_y, hi_x, hi_y, nearby);
    for (y = lo_y[0]; y <= hi_y[0]; y++) {
        for (x = lo_x[0]; x <= hi_x[0]; x++) {
            chars[lookbuf + 0] = ord('\0');
            glyph = glyph_at(x, y);
            if (glyph_is_trap(glyph)) {
                tnum = glyph_to_trap(glyph);
                trap_description(lookbuf, tnum, x, y);
                ++count;
            } else if ((t = t_at(x, y)) != null && t.tseen
                       /* can't use /" to track traps moved by bubbles or
                          clouds except when hero has direct line of sight */
                       && ((!Is_waterlevel(u.uz) && !Is_airlevel(u.uz))
                           || couldsee(x, y))) {
                strcpy(lookbuf, trapname(t.ttyp, FALSE));
                sprintf(eos(lookbuf), _(", obscured by %s"), encglyph(glyph));
                glyph = trap_to_glyph(t);
                ++count;
            }
            if (chars[lookbuf]) {
                let coordbuf = stack_array(char, 20), cmode;

                cmode = (iflags.getpos_coords != GPCOORDS_NONE)
                           ? iflags.getpos_coords : GPCOORDS_MAP;
                if (count == 1) {
                    sprintf(outbuf, _("%sseen or remembered traps%s:"), nearby ? _("nearby ") : _(""), nearby ? _("") : _(" on this level"))

;
                    putstr()(win, 0, upstart(outbuf));
                    /* hack alert! Qt watches a text window for any line
                       with 4 consecutive spaces and renders the window
                       in a fixed-width font it if finds at least one */
                    putstr()(win, 0, _("    ")); /* separator */
                }
                /* prefix: "coords  C  " where 'C' is trap symbol */
                sprintf(outbuf, (cmode == GPCOORDS_SCREEN) ? _("%s  ")
                                  : (cmode == GPCOORDS_MAP) ? _("%8s  ")
                                      : _("%12s  "), coord_desc(x, y, coordbuf, cmode))
;
                sprintf(eos(outbuf), _("%s  "), encglyph(glyph));
                /* guard against potential overflow */
                chars[lookbuf + unsigned(sizeof(array_of(char, BUFSZ)) - 1 - strlen(outbuf))] = ord('\0');
                strcat(outbuf, lookbuf);
                putmixed()(win, 0, outbuf);
            }
        }
    }
    if (count)
        display_nhwindow()(win, TRUE);
    else
        pline(_("No traps seen or remembered%s."), nearby ? _(" nearby") : _(""));
    destroy_nhwindow()(win);
    } finally { stack_pop($frame); }
}

/* display of discovered engravings including headstones, even when they're
   covered provided they've been read */
function look_engrs(nearby) { /* void */
    const $frame = stack_frame(); try {
    let win;
    let e;
    let lookbuf = stack_array(char, BUFSZ), outbuf = stack_array(char, BUFSZ);
    let x, y, lo_x = stack_var(coordxy), lo_y = stack_var(coordxy), hi_x = stack_var(coordxy), hi_y = stack_var(coordxy);
    let is_headstone;
    let sym;
    let glyph, count = 0;

    win = create_nhwindow()(NHW_TEXT);
    look_region_nearby(lo_x, lo_y, hi_x, hi_y, nearby);
    /*assert(lo_x >= 1 && lo_y >= 0 && hi_x < MAXCO && hi_y < MAXLI);*/
    for (y = lo_y[0]; y <= hi_y[0]; y++) {
        for (x = lo_x[0]; x <= hi_x[0]; x++) {
            chars[lookbuf + 0] = ord('\0');
            if (!levl()[x][y].seenv)
                continue;
            /* this won't find remembered engravings which aren't there
               anymore (in case the hero is unaware that they're gone;
               scuffed away by monster movement or deleted during shop
               or vault wall repair); not sure what to do about that */
            e = engr_at(x, y);
            if (!e)
                continue;
            is_headstone = IS_GRAVE(chars[svl.lastseentyp[x] + y]);
            sprintf(lookbuf, _(" (%s"), is_headstone ? _("grave") : _("engraving"));
            add_quoted_engraving(x, y, lookbuf, TRUE);
            /* the paren is used by farlook and add_quoted_engraving()
               expected to see it; we don't want it here */
            if (is_headstone) {
                strsubst(lookbuf, _("(grave with "), _(""));
                strsubst(lookbuf, _("(grave whose "), _(""));
            } else {
                strsubst(lookbuf, _("(engraving with "), _(""));
                strsubst(lookbuf, _("(engraving "), _("engraving "));
            }

            glyph = glyph_at(x, y);
            sym = uchar(glyph_is_cmap(glyph) ? glyph_to_cmap(glyph) : SYM_NOTHING);
            if (is_cmap_engraving(sym) || sym == S_grave) {
                /* engraving or grave+headstone shown on the map */
                ++count;
            } else {
                /* engraving or grave covered by object(s) */
                Snprintf(eos(lookbuf), unsigned(sizeof(array_of(char, BUFSZ)) - strlen(lookbuf)), _(", obscured by %s"), encglyph(glyph))
;
                glyph = is_headstone ? cmap_to_glyph(S_grave)
                                     : engraving_to_glyph(e);
                ++count;
            }
            if (chars[lookbuf]) { /* (redundant) */
                let coordbuf = stack_array(char, 20), cmode;

                cmode = (iflags.getpos_coords != GPCOORDS_NONE)
                           ? iflags.getpos_coords : GPCOORDS_MAP;
                if (count == 1) {
                    sprintf(outbuf, _("%sseen or remembered engravings%s:"), nearby ? _("nearby ") : _(""), nearby ? _("") : _(" on this level"))

;
                    putstr()(win, 0, upstart(outbuf));
                    /* hack alert! Qt watches a text window for any line
                       with 4 consecutive spaces and renders the window
                       in a fixed-width font it if finds at least one */
                    putstr()(win, 0, _("    ")); /* separator */
                }
                /* prefix: "coords  C  " where 'C' is engrvng|grave symbol */
                sprintf(outbuf, (cmode == GPCOORDS_SCREEN) ? _("%s  ")
                                  : (cmode == GPCOORDS_MAP) ? _("%8s  ")
                                      : _("%12s  "), coord_desc(x, y, coordbuf, cmode))
;
                sprintf(eos(outbuf), _("%s "), encglyph(glyph));
                /* guard against potential overflow */
                chars[lookbuf + unsigned(sizeof(array_of(char, BUFSZ)) - 1 - strlen(outbuf))] = ord('\0');
                strcat(outbuf, lookbuf);
                putmixed()(win, 0, outbuf);
            }
        }
    }
    if (count)
        display_nhwindow()(win, TRUE);
    else
        pline(_("No engravings seen or remembered%s."), nearby ? _(" nearby") : _(""));
    destroy_nhwindow()(win);
    } finally { stack_pop($frame); }
}

const suptext1 = static_array("suptext1", ptr_to(char), null, [
    _("%s is a member of a marauding horde of orcs"),
    _("rumored to have brutally attacked and plundered"),
    _("the ordinarily sheltered town that is located "),
    _("deep within The Gnomish Mines."),
    _(""),
    _("The members of that vicious horde proudly and "),
    _("defiantly acclaim their allegiance to their"),
    _("leader %s in their names."),
    0,
]);

const suptext2 = static_array("suptext2", ptr_to(char), null, [
    _("\"%s\" is the common dungeon name of"),
    _("a nefarious orc who is known to acquire property"),
    _("from thieves and sell it off for profit."),
    _(""),
    _("The perpetrator was last seen hanging around the"),
    _("stairs leading to the Gnomish Mines."),
    0,
]);

function do_supplemental_info(
    name,
    pm,
    without_asking) { /* void */
    const $frame = stack_frame(); try {
    let textp;
    let datawin = WIN_ERR;
    let entrytext = name, bp = 0, bp2 = 0;
    let question = stack_array(char, QBUFSZ);
    let yes_to_moreinfo = FALSE;
    let is_marauder = is_orc(pm);

    /*
     * Provide some info on some specific things
     * meant to support in-game mythology, and not
     * available from data.base or other sources.
     */
    if (is_marauder && (strlen(name) < (BUFSZ - 1))) {
        let fullname = stack_array(char, BUFSZ);

        bp = strstri(name, _(" of "));
        bp2 = strstri(name, _(" the Fence"));

        if (bp || bp2) {
            strcpy(fullname, name);
            if (!without_asking) {
                strcpy(question, _("More info about \""));
                /* +2 => length of "\"?" */
                copynchars(eos(question), entrytext,
                        int(unsigned(sizeof(array_of(char, QBUFSZ)) - 1 - unsigned(strlen(question) + 2))));
                strcat(question, _("\"?"));
                if (y_n(question) == ord('y'))
                yes_to_moreinfo = TRUE;
            }
            if (yes_to_moreinfo) {
                let i, subs = 0;
                let gang = 0;

                if (bp) {
                    textp = suptext1;
                    gang = bp + 4;
                    chars[bp] = ord('\0');
                } else {
                    textp = suptext2;
                    gang = _("");
                }
                datawin = create_nhwindow()(NHW_MENU);
                for (i = 0; textp[i]; i++) {
                    let buf = stack_array(char, BUFSZ);
                    let txt;

                    if (strstri(textp[i], _("%s")) != 0) {
                        sprintf(buf, textp[i], subs++ ? gang : fullname);
                        txt = buf;
                    } else
                        txt = textp[i];
                    putstr()(datawin, 0, txt);
                }
                display_nhwindow()(datawin, FALSE);
                destroy_nhwindow()(datawin), datawin = WIN_ERR;
            }
        }
    }
    } finally { stack_pop($frame); }
}

/* the #whatis command */
export function dowhatis() { /* int */
    return do_look(0, null);
}

/* the #glance command */
export function doquickwhatis() { /* int */
    return do_look(1, null);
}

/* the #showtrap command */
export function doidtrap() { /* int */
    let trap;
    let tt, glyph;
    let x, y;

    if (!getdir(_("^")))
        return ECMD_CANCEL;
    x = u.ux + u.dx;
    y = u.uy + u.dy;

    /* trapped doors and chests used to be shown as fake bear traps;
       they have their own trap types now but aren't part of the ftrap
       chain; usually they revert to normal door or chest when the hero
       sees them but player might be using '^' while the hero is blind */
    glyph = glyph_at(x, y);
    if (glyph_is_trap(glyph)
        && ((tt = glyph_to_trap(glyph)) == BEAR_TRAP
            || tt == TRAPPED_DOOR || tt == TRAPPED_CHEST)) {
        let chesttrap = trapped_chest_at(tt, x, y);

        if (chesttrap || trapped_door_at(tt, x, y)) {
            pline(_("That is a trapped %s."), chesttrap ? _("chest") : _("door"));
            return ECMD_OK; /* trap ID'd, but no time elapses */
        }
    }

    for (trap = gf.ftrap; trap; trap = trap.ntrap)
        if (trap.tx == x && trap.ty == y) {
            if (!trap.tseen)
                break;
            tt = trap.ttyp;
            if (u.dz) {
                if (u.dz < 0 ? is_hole(tt) : tt == ROCKTRAP)
                    break;
            }
            pline(_("That is %s%s%s."),
                  an(trapname(tt, FALSE)),
                  !trap.madeby_u
                     ? _("")
                     : (tt == WEB)
                        ? _(" woven")
                        /* trap doors & spiked pits can't be made by
                           player, and should be considered at least
                           as much "set" as "dug" anyway */
                        : (tt == HOLE || tt == PIT)
                           ? _(" dug")
                           : _(" set"),
                  !trap.madeby_u ? _("") : _(" by you"));
            return ECMD_OK;
        }
    pline(_("I can't see a trap there."));
    return ECMD_OK;
}

/*
    Implements a rudimentary if/elif/else/endif interpreter and use
    conditionals in dat/cmdhelp to describe what command each keystroke
    currently invokes, so that there isn't a lot of "(debug mode only)"
    and "(if number_pad is off)" cluttering the feedback that the user
    sees.  (The conditionals add quite a bit of clutter to the raw data
    but users don't see that.  number_pad produces a lot of conditional
    commands:  basic letters vs digits, 'g' vs 'G' for '5', phone
    keypad vs normal layout of digits, and QWERTZ keyboard swap between
    y/Y/^Y/M-y/M-Y/M-^Y and z/Z/^Z/M-z/M-Z/M-^Z.)

    The interpreter understands
     '&#' for comment,
     '&? option' for 'if' (also '&? !option'
                           or '&? option=value[,value2,...]'
                           or '&? !option=value[,value2,...]'),
     '&: option' for 'elif' (with argument variations same as 'if';
                             any number of instances for each 'if'),
     '&:' for 'else' (also '&: #comment';
                      0 or 1 instance for a given 'if'), and
     '&.' for 'endif' (also '&. #comment'; required for each 'if').

    The option handling is a bit of a mess, with no generality for
    which options to deal with and only a comma separated list of
    integer values for the '=value' part.  number_pad is the only
    supported option that has a value; the few others (wizard/debug,
    rest_on_space, #if SHELL, #if SUSPEND) are booleans.
*/

function whatdoes_help() { /* void */
    const $frame = stack_frame(); try {
    let fp;
    let p, buf = stack_array(char, BUFSZ);
    let tmpwin;

    fp = dlb_fopen(_(KEYHELP), _("r"));
    if (!fp) {
        pline(_("Cannot open \"%s\" data file!"), _(KEYHELP));
        display_nhwindow()(WIN_MESSAGE, TRUE);
        return;
    }
    tmpwin = create_nhwindow()(NHW_TEXT);
    while (dlb_fgets(buf, sizeof(array_of(char, BUFSZ)), fp)) {
        if (chars[buf] == ord('#'))
            continue;
        for (p = buf; chars[p]; p++)
            if (chars[p] != ord(' ') && chars[p] != ord('\t'))
                break;
        putstr()(tmpwin, 0, p);
    }
    dlb_fclose(fp);
    display_nhwindow()(tmpwin, TRUE);
    destroy_nhwindow()(tmpwin);
    } finally { stack_pop($frame); }
}

/* #if 0: not in this build */

export function dowhatdoes_core(q, cbuf) { /* char * */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);

    let ec_desc;

    if ((ec_desc = key2extcmddesc(uchar(q))) != (0)) {
        let keybuf = stack_array(char, QBUFSZ);

        /* note: if "%-8s" gets changed, the "%8.8s" in dowhatdoes() will
           need a comparable change */
        sprintf(buf, _("%-8s%s."), key2txt(uchar(q), keybuf), ec_desc);
        strcpy(cbuf, buf);
        return cbuf;
    }
    return 0;
    /* #if 0: not in this build */
    } finally { stack_pop($frame); }
}

/* the whatdoes command */
export function dowhatdoes() { /* int */
    const $frame = stack_frame(); try {
    let once = static_var("dowhatdoes.once", schar, FALSE);
    let bufr = stack_array(char, BUFSZ);
    let q, reslt;

    if (!once[0]) {
        pline(_("Ask about '&' or '?' to get more info.%s"),

              iflags.altmeta ? _("  (For ESC, type it twice.)") :

              _(""));
        once[0] = TRUE;
    }

    introff(); /* disables ^C but not ^\ */

    q = yn_function(_("What command?"), 0, ord('\0'), TRUE);

    if (q == ord('\x1b') && iflags.altmeta) {
        /* in an ideal world, we would know whether another keystroke
           was already pending, but this is not an ideal world...
           if user typed ESC, we'll essentially hang until another
           character is typed */
        q = yn_function(_("]"), 0, ord('\0'), TRUE);
        if (q != ord('\x1b'))
            q = char((uchar(q) | 0o200));
    }

    intron(); /* reenables ^C */

    reslt = dowhatdoes_core(q, bufr);
    if (reslt) {
        let p = strchr(reslt, ord('\n')); /* 'm' prefix has two lines of output */

        if (q == ord('&') || q == ord('?'))
            whatdoes_help();
        if (!p) {
            /* normal usage; 'reslt' starts with key, some indentation, and
               then explanation followed by '.' for sentence punctuation */
            pline(_("%s"), reslt);
        } else {
            /* for 'm' prefix, where 'reslt' has an embedded newline to
               indicate and separate two lines of output; we add a comma to
               first line so that the combination is a complete sentence */
            chars[p] = ord('\0'); /* replace embedded newline with end of first line */
            pline(_("%s,"), reslt);
            /* cheat by knowing how dowhatdoes_core() handles key portion */
            pline(_("%8.8s%s"), reslt, p + 1);
        }
    } else {
        pline(_("No such command '%s', char code %d (0%03o or 0x%02x)."),
              visctrl(q), uchar(q), uchar(q), uchar(q));
    }
    return ECMD_OK;
    } finally { stack_pop($frame); }
}

function docontact() { /* void */
    const $frame = stack_frame(); try {
    let cwin = create_nhwindow()(NHW_TEXT);
    let buf = stack_array(char, BUFSZ);

    if (sysopt.support) {
        /*XXX overflow possibilities*/
        sprintf(buf, _("To contact local support, %s"), sysopt.support);
        putstr()(cwin, 0, buf);
        putstr()(cwin, 0, _(""));
    } else if (sysopt.fmtd_wizard_list) { /* formatted SYSCF WIZARDS */
        sprintf(buf, _("To contact local support, contact %s."), sysopt.fmtd_wizard_list)
;
        putstr()(cwin, 0, buf);
        putstr()(cwin, 0, _(""));
    }
    putstr()(cwin, 0, _("To contact the NetHack development team directly,"));
    /*XXX overflow possibilities*/
    sprintf(buf, _("see the 'Contact' form on our website or email <%s>."), _(DEVTEAM_EMAIL))
;
    putstr()(cwin, 0, buf);
    putstr()(cwin, 0, _(""));
    putstr()(cwin, 0, _("For more information on NetHack, or to report a bug,"));
    sprintf(buf, _("visit our website \"%s\"."), _(DEVTEAM_URL));
    putstr()(cwin, 0, buf);
    display_nhwindow()(cwin, FALSE);
    destroy_nhwindow()(cwin);
    } finally { stack_pop($frame); }
}

function dispfile_help() { /* void */
    display_file()(_(HELP), TRUE);
}

function dispfile_shelp() { /* void */
    display_file()(_(SHELP), TRUE);
}

function dispfile_optionfile() { /* void */
    display_file()(_(OPTIONFILE), TRUE);
}

function dispfile_optmenu() { /* void */
    display_file()(_(OPTMENUHELP), TRUE);
}

function dispfile_license() { /* void */
    display_file()(_(LICENSE), TRUE);
}

function dispfile_debughelp() { /* void */
    display_file()(_(DEBUGHELP), TRUE);
}

function dispfile_usagehelp() { /* void */
    display_file()(_(USAGEHELP), TRUE);
}

function hmenu_doextversion() { /* void */
    doextversion();
}

function hmenu_dohistory() { /* void */
    dohistory();
}

function hmenu_dowhatis() { /* void */
    dowhatis();
}

function hmenu_dowhatdoes() { /* void */
    dowhatdoes();
}

function hmenu_doextlist() { /* void */
    doextlist();
}

function domenucontrols() { /* void */
    let cwin = create_nhwindow()(NHW_TEXT);

    show_menu_controls(cwin, FALSE);
    display_nhwindow()(cwin, FALSE);
    destroy_nhwindow()(cwin);
}

/* data for dohelp() */
  const struct___anon1 = struct("pager.struct___anon1", {
    f: fnptr_t,
    text: ptr_to(char),
}); const help_menu_items = static_array("help_menu_items", struct___anon1, null, [
    { f: hmenu_doextversion, text: _("About NetHack (version information).") },
    { f: dispfile_help, text: _("Long description of the game and commands.") },
    { f: dispfile_shelp, text: _("List of game commands.") },
    { f: hmenu_dohistory, text: _("Concise history of NetHack.") },
    { f: hmenu_dowhatis, text: _("Info on a character in the game display.") },
    { f: hmenu_dowhatdoes, text: _("Info on what a given key does.") },
    { f: option_help, text: _("List of game options.") },
    { f: dispfile_optionfile, text: _("Longer explanation of game options.") },
    { f: dispfile_optmenu, text: _("Using the %s command to set options.") },
    { f: dokeylist, text: _("Full list of keyboard commands.") },
    { f: hmenu_doextlist, text: _("List of extended commands.") },
    { f: domenucontrols, text: _("List menu control keys.") },
    { f: dispfile_usagehelp, text: _("Description of NetHack's command line.") },
    { f: dispfile_license, text: _("The NetHack license.") },
    { f: docontact, text: _("Support information.") },

    { f: dispfile_debughelp, text: _("List of wizard-mode commands.") },
    { f: null, text: 0 }
]);

/* the #help command */
export function dohelp() { /* int */
    const $frame = stack_frame(); try {
    let tmpwin = create_nhwindow()(NHW_MENU);
    let helpbuf = stack_array(char, QBUFSZ), tmpbuf = stack_array(char, QBUFSZ);
    let i, n;
    let selected = stack_var(ptr_to(struct_mi));
    let any = stack_struct(struct_any);
    let sel;
    let clr = NO_COLOR;

    struct_assign(any, cg.zeroany); /* zero all bits */
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);

    for (i = 0; help_menu_items[i].text; i++) {
        if (!wizard() && help_menu_items[i].f == dispfile_debughelp)
            continue;
        if (sysopt.hideusage && help_menu_items[i].f == dispfile_usagehelp)
            continue;

        if (chars[help_menu_items[i].text + 0] == ord('%')) {
            sprintf(helpbuf, help_menu_items[i].text, _("MacOS"));
        } else if (help_menu_items[i].f == dispfile_optmenu) {
            sprintf(helpbuf, help_menu_items[i].text, setopt_cmd(tmpbuf));
        } else {
            strcpy(helpbuf, help_menu_items[i].text);
        }
        any.a_int = i + 1;
        add_menu(tmpwin, nul_glyphinfo, any, 0, 0, ATR_NONE, clr,
                 helpbuf, MENU_ITEMFLAGS_NONE);
    }
    end_menu()(tmpwin, _("Select one item:"));
    n = select_menu(tmpwin, PICK_ONE, selected);
    destroy_nhwindow()(tmpwin);
    if (n > 0) {
        sel = ptr_add(selected[0], 0).item.a_int - 1;
        free(addr_of(selected[0]));
        (help_menu_items[sel].f)();
    }
    return ECMD_OK;
    } finally { stack_pop($frame); }
}

/* format the key or extended command name of command used to set options;
   normally 'O' but could be bound to something else, or not bound at all;
   with the implementation of a simple options subset, now need 'mO' to get
   the full options command; format it as 'm O' */
function setopt_cmd(outbuf) { /* char * */
    const $frame = stack_frame(); try {
    let cmdbuf = stack_array(char, QBUFSZ);
    let cmdnm;
    let key;

    strcpy(outbuf, _("\'"));
    /* #optionsfull */
    key = cmd_from_func(doset);
    if (key) {
        strcat(outbuf, visctrl(key));
    } else {
        /* extended command name, with leading "#" */
        cmdnm = cmdname_from_func(doset, cmdbuf, TRUE);
        if (!cmdnm) /* paranoia */
            cmdnm = _("optionsfull");
        sprintf(eos(outbuf), _("%s%.31s"), (chars[cmdnm] != ord('#')) ? _("#") : _(""), cmdnm);

        /* since there's no key bound to #optionsfull, include 'm O' */
        strcat(outbuf, _("\' or \'"));
        /* m prefix plus #options */
        key = cmd_from_func(do_reqmenu);
        if (key) {
            /* key for 'm' prefix */
            strcat(outbuf, visctrl(key));
        } else {
            /* extended command name for 'm' prefix */
            cmdnm = cmdname_from_func(do_reqmenu, cmdbuf, TRUE);
            if (!cmdnm)
                cmdnm = _("reqmenu");
            sprintf(eos(outbuf), _("%s%.31s"), (chars[cmdnm] != ord('#')) ? _("#") : _(""), cmdnm);
        }
        /* this is slightly iffy because the user shouldn't type <space> to
           get the command we're describing, but it improves readability */
        strcat(outbuf, _(" "));
        /* now #options, normally 'O' */
        key = cmd_from_func(doset_simple);
        if (key) {
            strcat(outbuf, visctrl(key));
        } else {
            /* extended command name */
            cmdnm = cmdname_from_func(doset_simple, cmdbuf, TRUE);
            if (!cmdnm) /* paranoia */
                cmdnm = _("options");
            sprintf(eos(outbuf), _("%s%.31s"), (chars[cmdnm] != ord('#')) ? _("#") : _(""), cmdnm);
        }
    }
    strcat(outbuf, _("\'"));
    return outbuf;
    } finally { stack_pop($frame); }
}

/* the 'V' command; also a choice for '?' */
export function dohistory() { /* int */
    display_file()(_(HISTORY), TRUE);
    return ECMD_OK;
}

/*pager.c*/

import { AM_MASK, AM_SANCTUM } from "./align.h.js";
import { Amask2align } from "./align.h.macros.js";
import { NO_COLOR } from "./color.h.js";
import { struct_nhcoord } from "./coord.h.js";
import { something } from "./decl.h.macros.js";
import {
    COIN_CLASS, DEF_INVISIBLE, MAXMCLASSES, MAXOCLASSES, MAXPCHARS, ROCK_CLASS, S_EEL, S_HUMAN,
    S_altar, S_cloud, S_darkroom, S_engrcorr, S_engroom, S_grave, S_ice, S_invisible, S_lava,
    S_lavawall, S_ndoor, S_poisoncloud, S_pool, S_stone, S_sw_br, S_sw_tl, S_vibrating_square,
    S_water, VENOM_CLASS,
} from "./defsym.h.js";
import { MG_FLAG_NOOVERRIDE, NO_GLYPH } from "./display.h.js";
import {
    canspotself, cmap_to_glyph, engraving_to_glyph, glyph_is_body, glyph_is_cmap,
    glyph_is_invisible, glyph_is_monster, glyph_is_nothing, glyph_is_object, glyph_is_statue,
    glyph_is_trap, glyph_is_unexplored, glyph_is_warning, glyph_to_body_corpsenm, glyph_to_obj,
    glyph_to_statue_corpsenm, glyph_to_trap, glyph_to_warning, mon_to_glyph, senseself,
    trap_to_glyph,
} from "./display.h.macros.js";
import { dlb_fclose, dlb_fgets, dlb_fopen, dlb_fseek } from "./dlb.h.macros.js";
import {
    Inhell, Is_airlevel, Is_astralevel, Is_juiblex_level, Is_medusa_level, Is_qstart,
    Is_rogue_level, Is_waterlevel,
} from "./dungeon.h.macros.js";
import { remembered_text } from "./engrave.h.js";
import {
    GPCOORDS_COMPASS, GPCOORDS_MAP, GPCOORDS_NONE, GPCOORDS_SCREEN, TER_DETECT, TER_MAP, TER_MON,
    TER_OBJ,
} from "./flag.h.js";
import { wizard } from "./flag.h.macros.js";
import {
    BUFSZ, COLNO, DATAFILE, DEBUGHELP, FALSE, HELP, HISTORY, KEYHELP, LICENSE, OPTIONFILE,
    OPTMENUHELP, QBUFSZ, ROWNO, SHELP, TRUE, USAGEHELP, boolean, coordxy,
} from "./global.h.js";
import {
    ARTICLE_NONE, BOLT_LIM, CMDQ_KEY, CQ_CANNED, DEVTEAM_EMAIL, DEVTEAM_URL, ECMD_CANCEL, ECMD_OK,
    LOOK_ONCE, LOOK_QUICK, LOOK_VERBOSE, MHID_ALTMON, MHID_ARTICLE, MHID_PREFIX, MHID_REGION,
    SYM_MAX, SYM_OFF_M, SYM_OFF_O, SYM_OFF_X, struct__cmd_queue,
} from "./hack.h.js";
import { distu, max, min, y_n } from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { MCORPSENM, has_mcorpsenm } from "./mextra.h.macros.js";
import { ceiling_hider, digests, hides_under, is_hider, is_orc } from "./mondata.h.macros.js";
import { M2_DEMON, M2_ELF, M2_HUMAN, M2_ORC, NEUTRAL } from "./monflag.h.js";
import {
    M_AP_FURNITURE, M_AP_F_DKNOWN, M_AP_MONSTER, M_AP_OBJECT, STRAT_WAITMASK,
} from "./monst.h.js";
import { M_AP_FLAG, M_AP_TYPE, U_AP_TYPE, is_obj_mappear } from "./monst.h.macros.js";
import { PM_COYOTE, PM_ELF, PM_GNOME, PM_HUMAN, PM_SAMURAI, PM_WIZARD } from "./monsters.h.js";
import { OBJ_BURIED, OBJ_FLOOR, OBJ_FREE, struct_obj } from "./obj.h.js";
import { OBJ_NAME } from "./objclass.h.macros.js";
import {
    BOULDER, CHEST, CORPSE, LARGE_BOX, LEASH, SLIME_MOLD, STATUE, STRANGE_OBJECT,
} from "./objects.h.js";
import { struct_permonst } from "./permonst.h.js";
import { HALLUC_RES, I_SPECIAL } from "./prop.h.js";
import {
    D_BROKEN, D_TRAPPED, ICE, LAVAPOOL, LAVAWALL, MOAT, POOL, SCORR, SDOOR, STONE, WATER,
} from "./rm.h.js";
import { IS_GRAVE, IS_TREE, IS_WALL, IS_WATERWALL, SURFACE_AT, levl, m_at } from "./rm.h.macros.js";
import {
    SYM_BOULDER, SYM_HERO_OVERRIDE, SYM_INVISIBLE, SYM_NOTHING, SYM_PET_OVERRIDE, SYM_UNEXPLORED,
    WARNCOUNT,
} from "./sym.h.js";
import { is_cmap_drawbridge, is_cmap_engraving, is_cmap_trap } from "./sym.h.macros.js";
import { MELT_ICE_AWAY } from "./timeout.h.js";
import {
    BEAR_TRAP, HOLE, NO_TRAP, PIT, ROCKTRAP, TRAPPED_CHEST, TRAPPED_DOOR, VIBRATING_SQUARE, WEB,
} from "./trap.h.js";
import { is_hole, is_pit } from "./trap.h.macros.js";
import {
    MONSEEN_DETECT, MONSEEN_INFRAVIS, MONSEEN_NORMAL, MONSEEN_SEEINVIS, MONSEEN_TELEPAT,
    MONSEEN_WARNMON, MONSEEN_XRAYVIS,
} from "./vision.h.js";
import { cansee, couldsee } from "./vision.h.macros.js";
import {
    create_nhwindow, destroy_nhwindow, display_file, display_nhwindow, end_menu, putmixed, putstr,
    start_menu,
} from "./winprocs.h.macros.js";
import {
    ATR_NONE, MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, NHW_MENU, NHW_TEXT, PICK_ONE, WIN_ERR,
    struct_any, struct_glyphinfo, struct_mi,
} from "./wintype.h.js";
import { Race_if, Role_if, Ugender, Upolyd, next2u, u_at } from "./you.h.macros.js";
import {
    Blind, Detect_monsters, EDetect_monsters, EHalluc_resistance, Hallucination, Infravision, Invis,
    Invisible, Levitation, Punished, Unblind_telepat, Underwater,
} from "./youprop.h.macros.js";
import {
    char, int, long, ord, schar, sizeof, sizeof_string, uchar, ulong, unsigned,
} from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { or64u } from "../rt/int64.js";
import {
    SEEK_SET, abs, free, memcpy, sprintf, sscanf, strcat, strchr, strcmp, strcpy, strlen, strncat,
    strncmp,
} from "../rt/libc.js";
import {
    init_list, init_string, stack_array, stack_struct, stack_var, static_array, static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, fnptr_t, ptr_add, ptr_to, struct, struct_assign, struct_copy,
} from "../rt/struct.js";
import {
    cmd_from_func, cmdname_from_func, cmdq_clear, cmdq_pop, do_reqmenu, doextlist, dokeylist,
    getdir, isok, key2extcmddesc, key2txt, yn_function,
} from "./cmd.js";
import { is_drawbridge_wall, is_lava, is_pool } from "./dbridge.js";
import {
    cg, flags, gd, gf, gi, go, gs, gu, gw, gy, iflags, program_state, svc, svd, svl, svp, u,
} from "./decl.js";
import { trapped_chest_at, trapped_door_at } from "./detect.js";
import { glyph_at, map_glyphinfo, nul_glyphinfo } from "./display.js";
import {
    Mgender, coyotename, distant_monnam, hliquid, mon_nam, pmname, rndmonnam, y_monnam,
} from "./do_name.js";
import { def_monsyms, def_oc_syms, def_warnsyms, defsyms } from "./drawing.js";
import { on_level, surface } from "./dungeon.js";
import { engr_at } from "./engrave.js";
import { coord_desc, getpos } from "./getpos.js";
import { glyph_to_cmap } from "./glyphs.js";
import {
    copynchars, digit, eos, lcase, mungspaces, strip_newline, strkitten, strncmpi, strstri,
    strsubst, tabexpand, upstart, visctrl,
} from "./hacklib.js";
import { align_str, trap_predicament } from "./insight.js";
import { display_inventory, sobj_at } from "./invent.js";
import { dealloc_obj, is_treefruit, mkobj, mksobj } from "./mkobj.js";
import { sticks } from "./mondata.js";
import { closed_door } from "./monmove.js";
import { mons } from "./monst.js";
import { observe_object } from "./o_init.js";
import { obj_descr, objects } from "./objects.js";
import {
    an, ansimpleoname, distant_name, doname_vague_quan, doname_with_price, fruit_from_name,
    makeplural, makesingular, simpleonames, singular, the, xname,
} from "./objnam.js";
import { doset, doset_simple, option_help, show_menu_controls } from "./options.js";
import { impossible, pline } from "./pline.js";
import { altarmask_at } from "./pray.js";
import { ok_to_quest } from "./quest.js";
import { visible_region_at } from "./region.js";
import { rn2_on_display_rng } from "./rnd.js";
import { costly_spot } from "./shk.js";
import { pmatch } from "./strutil.js";
import { sysopt } from "./sys.js";
import { obj_stop_timers, spot_time_left } from "./timeout.js";
import { t_at, trapname } from "./trap.js";
import { doextversion } from "./version.js";
import { howmonseen } from "./vision.js";
import { add_menu, add_menu_str, encglyph, getlin, select_menu } from "./windows.js";
import { introff, intron } from "../sys/c2js/nhjs_host.js";
