/* NetHack 5.0	artifact.c	$NHDT-Date: 1715889721 2024/05/16 20:02:01 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.236 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2013. */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * Note:  both artilist[] and artiexist[] have a dummy element #0,
 *        so loops over them should normally start at #1.  The primary
 *        exception is the save & restore code, which doesn't care about
 *        the contents, just the total size.
 */

/* #define get_artifact(o) \
    (((o) && ((o)->artifact > 0 && (o)->artifact < AFTER_LAST_ARTIFACT)) \
                             ? &artilist[(int) (o)->oartifact] \
                             : &artilist[ART_NONARTIFACT]) */

/* The amount added to the victim's total hit points to insure that the
   victim will be killed even after damage bonus/penalty adjustments.
   Most such penalties are small, and 200 is plenty; the exception is
   half physical damage.  3.3.1 and previous versions tried to use a very
   large number to account for this case; now, we just compute the fatal
   damage by adding it to 2 times the total hit points instead of 1 time.
   Note: this will still break if they have more than about half the number
   of hit points that will fit in a 15 bit integer. */
export const FATAL_DAMAGE_MODIFIER = 200;

/* arti_info struct definition moved to artifact.h */

/* array of flags tracking which artifacts exist, indexed by ART_xx;
   ART_xx values are 1..N, element [0] isn't used; no terminator needed */
const artiexist = static_array("artiexist", struct_arti_info, 1 + NROFARTIFACTS);
/* discovery list; for N discovered artifacts, the first N entries are ART_xx
   values in discovery order, the remaining (NROFARTIFACTS-N) slots are 0 */
const artidisco = static_array("artidisco", short, NROFARTIFACTS);
/* note: artiexist[] and artidisco[] don't need to be in struct ga; they
 * get explicitly initialized at game start so don't need to be part of
 * bulk re-init if game restart ever gets implemented.  They are saved
 * and restored but that is done through this file so they can be local.
 */

const zero_artiexist = static_struct("zero_artiexist", struct_arti_info, {exists: 0}); /* all bits zero */

/* handle some special cases; must be called after u_init() */
function hack_artifacts() { /* void */
    let art;
    let alignmnt = aligns[flags.initalign].value;

    /* Fix up the alignments of "gift" artifacts */
    for (art = ptr_add(artilist[0], 1); art.otyp; art = ptr_add(art, 1))
        if (art.role == Role_switch() && art.alignment != A_NONE)
            art.alignment = alignmnt;

    /* Excalibur can be used by any lawful character, not just knights */
    if (!Role_if(PM_KNIGHT))
        artilist[ART_EXCALIBUR].role = NON_PM;

    /* Fix up the quest artifact */
    if (gu.urole.questarti) {
        artilist[gu.urole.questarti].alignment = alignmnt;
        artilist[gu.urole.questarti].role = Role_switch();
    }
    return;
}

/* zero out the artifact existence list */
export function init_artifacts() { /* void */
    memset(addr_of(artiexist[0]), 0, sizeof(array_of(struct_arti_info, 1 + NROFARTIFACTS)));
    memset(addr_of(artidisco), 0, sizeof(array_of(short, NROFARTIFACTS)));
    hack_artifacts();
}

export function save_artifacts(nhfp) { /* void */
    let i;

    for (i = 0; i < (NROFARTIFACTS + 1); ++i)
        Sfo_arti_info(nhfp, artiexist[i], _("artiexist"));

    for (i = 0; i < NROFARTIFACTS; ++i)
        Sfo_xint16(nhfp, artidisco.subarray(i), _("artidisco"));
}

export function restore_artifacts(nhfp) { /* void */
    let i;

    for (i = 0; i < (NROFARTIFACTS + 1); ++i)
        Sfi_arti_info(nhfp, artiexist[i], _("artiexist"));
    for (i = 0; i < NROFARTIFACTS; ++i)
        Sfi_short(nhfp, artidisco.subarray(i), _("artidisco"));

    hack_artifacts();   /* redo non-saved special cases */
}

export function artiname(artinum) { /* const char * */
    if (artinum <= 0 || artinum > NROFARTIFACTS)
        return _("");
    return artilist[artinum].name;
}

/*
   Make an artifact.  If a specific alignment is specified, then an object of
   the appropriate alignment is created from scratch, or 0 is returned if
   none is available.  (If at least one aligned artifact has already been
   given, then unaligned ones also become eligible for this.)
   If no alignment is given, then 'otmp' is converted
   into an artifact of matching type, or returned as-is if that's not
   possible.
   For the 2nd case, caller should use ``obj = mk_artifact(obj, A_NONE, 99);''
   For the 1st, ``obj = mk_artifact((struct obj *) 0, some_alignment, ...);''.
   The max_giftvalue is the value of the sacrifice, for an artifact obtained
   by sacrificing, or 99 otherwise.
 */
export function mk_artifact(
    otmp,

    alignment,
    max_giftvalue,
    adjust_spe) { /* struct obj * */ /* whether to add spe to situational artifacts */
    const $frame = stack_frame(); try {
    let a;
    let m, n, altn;
    let by_align = +(alignment != A_NONE);
    let o_typ = (by_align || !otmp) ? 0 : otmp.otyp;
    let unique = (!by_align && otmp && objects[o_typ].oc_unique ? 1 : 0);
    let eligible = stack_array(short, NROFARTIFACTS);
    let skill_compatibility;

    n = altn = 0;    /* no candidates found yet */
    eligible[0] = 0; /* lint suppression */
    /* gather eligible artifacts */
    for (m = 1, a = ptr_add(artilist[0], m); a.otyp; a = ptr_add(a, 1), m++) {
        if (artiexist[m].exists)
            continue;
        if ((a.spfx & SPFX_NOGEN) || unique)
            continue;
        if (a.gift_value > max_giftvalue && !Role_if(a.role))
            continue;

        if (!by_align) {
            /* looking for a particular type of item; not producing a
               divine gift so we don't care about role's first choice */
            if (a.otyp == o_typ)
                eligible[n++] = m;
            continue; /* move on to next possibility */
        }

        /* we're looking for an alignment-specific item
           suitable for hero's role+race */
        if ((a.alignment == alignment || a.alignment == A_NONE)
            /* avoid enemies' equipment */
            && (a.race == NON_PM || !race_hostile(mons[a.race]))) {
            /* when a role-specific first choice is available, use it */
            if (Role_if(a.role)) {
                /* make this be the only possibility in the list */
                eligible[0] = m;
                n = 1;
                break; /* skip all other candidates */
            }

            /* check if this is skill-compatible */
            skill_compatibility = P_SKILLED;
            if (objects[a.otyp].oc_class == WEAPON_CLASS) {
                let skill = objects[a.otyp].oc_subtyp;
                if (skill < 0)
                    skill_compatibility = P_MAX_SKILL(-skill);
                else
                    skill_compatibility = (u.weapon_skills[skill].max_skill);
            }

            /* found something to consider for random selection */
            if ((a.alignment != A_NONE || u.ugifts > 0 || !rn2(3)) &&
                (!rn2(4) || skill_compatibility >= P_SKILLED ||
                 (skill_compatibility >= P_BASIC && rn2(2)))) {
                /* right alignment, or non-aligned with at least 1
                   previous gift bestowed, makes this one viable;
                   unaligned artifacts are possible even as the first
                   gift, but less likely; if it's a bad weapon type
                   for the role that also makes it less likely */
                eligible[n++] = m;
            } else {
                /* if no candidates have been found yet, record
                   this one as a[nother] fallback possibility in
                   case all aligned candidates have been used up
                   (via wishing, naming, bones, random generation)
                   or failed the randomized compatibility checks */
                if (!n)
                    eligible[altn++] = m;
                /* [once a regular candidate is found, the list
                   is overwritten and `altn' becomes irrelevant] */
            }
        }
    }

    /* resort to fallback list if main list was empty */
    if (!n)
        n = altn;

    if (n) {
        /* found at least one candidate; pick one at random */
        m = eligible[rn2(n)]; /* [0..n-1] */
        a = ptr_add(artilist[0], m);

        /* make an appropriate object if necessary, then christen it */
        if (by_align) {
            /* 'by_align' indicates that an alignment was passed as
             * an argument, but also that the 'otmp' argument is not
             * relevant */
            let artiobj = mksobj(a.otyp, TRUE, FALSE);

            /* nonnull value of 'otmp' is unexpected. Cope. */
            if (otmp) /* just in case; avoid orphaning */
                dispose_of_orig_obj(otmp);
            otmp = artiobj;
        }
        /*
         * otmp should be nonnull at this point:
         * either the passed argument (if !by_align == A_NONE), or
         * the result of mksobj() just above if by_align is an alignment. */
        assert(otmp != null);
        /* prevent erosion from generating */
        otmp.oeroded = otmp.oeroded2 = 0;
        otmp = oname(otmp, a.name, ONAME_NO_FLAGS);
        otmp.oartifact = m;  /* probably already set by this point, but */
        /* set existence and reason for creation bits */
        artifact_origin(otmp, ONAME_RANDOM); /* 'random' is default */
        if (adjust_spe) {
            let new_spe;

            /* Adjust artiobj->spe by a->gen_spe. (This is a no-op for
               non-weapons, which always have a gen_spe of 0, and for many
               weapons, too.) The result is clamped into the "normal" range to
               prevent an outside chance of +12 artifacts generating. */
            new_spe = otmp.spe + a.gen_spe;
            if (new_spe >= -10 && new_spe < 10)
                otmp.spe = new_spe;
        }
    } else {
        /* nothing appropriate could be found; return original object */
        if (by_align && otmp) {
            /* (there shouldn't have been an original object). Deal with it.
             * The callers that passed an alignment and a NULL otmp are
             * prepared to get a potential NULL return value, so this is okay */
            dispose_of_orig_obj(otmp);
            otmp = null;
        } /* otherwise, otmp has not changed; just fallthrough to return it */
    }
    if (otmp && permapoisoned(otmp))
        otmp.otrapped = 1;
    return otmp;
    } finally { stack_pop($frame); }
}

function dispose_of_orig_obj(obj) { /* void */
    if (!obj)
        return;

    obj_extract_self(obj);
    obfree(obj, null);
}

/*
 * Returns the full name (with articles and correct capitalization) of an
 * artifact named "name" if one exists, or NULL, it not.
 * The given name must be rather close to the real name for it to match.
 * The object type of the artifact is returned in otyp if the return value
 * is non-NULL.
 */
export function artifact_name(
    name,
    otyp_p,
    fuzzy) { /* const char * */ /* whether to allow extra or omitted spaces or dashes */
    let a;
    let aname;

    if (!strncmpi(name, _("the "), 4))
        name += 4;

    for (a = ptr_add(artilist[0], 1); a.otyp; a = ptr_add(a, 1)) {
        aname = a.name;
        if (!strncmpi(aname, _("the "), 4))
            aname += 4;
        if (!fuzzy ? !strcmpi(name, aname)
                   : fuzzymatch(name, aname, _(" -"), TRUE)) {
            if (otyp_p)
                otyp_p[0] = a.otyp;
            return a.name;
        }
    }

    return 0;
}

export function exist_artifact(otyp, name) { /* boolean */
    let a;
    let arex;

    if (otyp && chars[name])
        for (a = ptr_add(artilist[0], 1), arex = ptr_add(artiexist[0], 1); a.otyp; a = ptr_add(a, 1), arex = ptr_add(arex, 1))
            if (a.otyp == otyp && !strcmp(a.name, name))
                return arex.exists ? TRUE : FALSE;
    return FALSE;
}

/* an artifact has just been created or is being "un-created" for a chance
   to be created again later */
export function artifact_exists(
    otmp,
    name,
    mod,
    flgs) { /* void */ /* ONAME_xyz flags; not relevant if !mod */
    let a;

    if (otmp && chars[name])
        for (a = ptr_add(artilist[0], 1); a.otyp; a = ptr_add(a, 1))
            if (a.otyp == otmp.otyp && !strcmp(a.name, name)) {
                let m = ptr_diff(a, artilist[0]);

                otmp.oartifact = char((mod ? m : 0));
                otmp.age = 0;
                if (otmp.otyp == RIN_INCREASE_DAMAGE)
                    otmp.spe = 0;
                if (mod) { /* means being created rather than un-created */
                    /* one--and only one--of these should always be set */
                    if ((flgs & (ONAME_VIA_NAMING | ONAME_WISH | ONAME_GIFT
                                 | ONAME_VIA_DIP | ONAME_LEVEL_DEF
                                 | ONAME_BONES | ONAME_RANDOM)) == 0)
                        flgs = unsigned(flgs | ONAME_RANDOM); /* the default origin */
                    /* 'exists' bit will become set (in artifact_origin();
                       there's no ONAME_ flag) and flgs might also contain
                       the know_arti bit (hero knows that artifact exists) */
                    artifact_origin(otmp, flgs);
                } else { /* uncreate */
                    /* clear all the flag bits */
                    struct_assign(artiexist[m], zero_artiexist);
                }
                break;
            }
    return;
}

/* mark an artifact as 'found' */
export function found_artifact(a) { /* void */
    if (a < 1 || a > NROFARTIFACTS)
        impossible(_("found_artifact: invalid artifact index! (%d)"), a);
    else if (!artiexist[a].exists)
        impossible(_("found_artifact: artifact doesn't exist yet? (%d)"), a);
    else
        artiexist[a].found = 1;
}

/* if an artifact hasn't already been designated 'found', do that now
   and generate a livelog event about finding it */
export function find_artifact(otmp) { /* void */
    let a = otmp.oartifact;

    if (a && !artiexist[a].found) {
        let where;

        found_artifact(a); /* artiexist[a].found = 1 */
        /*
         * Unlike costly_spot(), inside_shop() includes the "free spot"
         * in front of the door.  And it doesn't care whether or not
         * there is a shopkeeper present.
         *
         * If hero sees a monster pick up a not-yet-found artifact, it
         * will have its dknown flag set even if far away and will be
         * described as 'found on the floor'.  Similarly for dropping
         * (possibly upon monster's death), dknown will be set and the
         * artifact will be described as 'carried by a monster'.
         * That's handled by caller:  dog_invent(), mpickstuff(), or
         * mdrop_obj() so that we get called before obj->where changes.
         */
        where = ((otmp.where == OBJ_FLOOR)
                 ?  ((inside_shop(otmp.ox, otmp.oy) != NO_ROOM)
                     ? _(" in a shop")
                     : _(" on the floor"))
                 /* artifacts aren't created in containers but could be
                    inside one if it comes from a bones level */
                 : (otmp.where == OBJ_CONTAINED) ? _(" in a container")
                   /* perhaps probing, or seeing monster wield artifact */
                   : (otmp.where == OBJ_MINVENT) ? _(" carried by a monster")
                     /* catchall: probably in inventory, picked up while
                        blind but now seen; there's no previous_where to
                        figure out how it got here */
                     : _(""));
        livelog_printf(LL_ARTIFACT, _("found %s%s"),
                       bare_artifactname(otmp), where);
    }
}

export function nartifact_exist() { /* int */
    let i, a = 0;

    for (i = 1; i <= NROFARTIFACTS; ++i)
        if (artiexist[i].exists)
            ++a;

    return a;
}

/* set artifact tracking flags;
   calling sequence: oname() -> artifact_exists() -> artifact_origin() or
   mksobj(),others -> mk_artifact() -> artifact_origin(random) possibly
   followed by mksobj(),others -> artifact_origin(non-random origin) */
export function artifact_origin(
    arti,
    aflags) { /* void */ /* ONAME_xxx flags, shared by artifact_exists() */
    let ct, a = arti.oartifact;

    if (a) {
        /* start by clearing all bits; most are mutually exclusive */
        struct_assign(artiexist[a], zero_artiexist);
        /* set 'exists' bit back on; not specified via flag bit in aflags */
        artiexist[a].exists = 1;
        /* 'hero knows it exists' is expected for wish, gift, viadip, or
           named and could eventually become set for any of the others */
        if ((aflags & ONAME_KNOW_ARTI) != 0)
            artiexist[a].found = 1;
        /* should be exactly one of wish, gift, via_dip, via_naming,
           level_def (quest), bones, and random (floor or monst's minvent) */
        ct = 0;
        if ((aflags & ONAME_WISH) != 0)
            artiexist[a].wish = 1, ++ct;
        if ((aflags & ONAME_GIFT) != 0)
            artiexist[a].gift = 1, ++ct;
        if ((aflags & ONAME_VIA_DIP) != 0)
            artiexist[a].viadip = 1, ++ct;
        if ((aflags & ONAME_VIA_NAMING) != 0)
            artiexist[a].named = 1, ++ct;
        if ((aflags & ONAME_LEVEL_DEF) != 0)
            artiexist[a].lvldef = 1, ++ct;
        if ((aflags & ONAME_BONES) != 0)
            artiexist[a].bones = 1, ++ct;
        if ((aflags & ONAME_RANDOM) != 0)
            artiexist[a].rndm = 1, ++ct;
        if (ct != 1)
            impossible(_("invalid artifact origin: %4o"), aflags);
    }
}

export function spec_ability(otmp, abil) { /* boolean */
    let arti = get_artifact(otmp);

    return (+(arti != artilist[ART_NONARTIFACT]
                      && (arti.spfx & abil) != 0));
}

/* used so that callers don't need to known about SPFX_ codes */
export function confers_luck(obj) { /* boolean */
    /* might as well check for this too */
    if (obj.otyp == LUCKSTONE)
        return TRUE;

    return (obj.oartifact && spec_ability(obj, SPFX_LUCK) ? 1 : 0);
}

/* used to check whether a monster is getting reflection from an artifact */
export function arti_reflects(obj) { /* boolean */
    let arti = get_artifact(obj);

    if (arti != artilist[ART_NONARTIFACT]) {
        /* while being worn */
        if ((obj.owornmask & ~W_ART) && (arti.spfx & SPFX_REFLECT))
            return TRUE;
        /* just being carried */
        if (arti.cspfx & SPFX_REFLECT)
            return TRUE;
    }
    return FALSE;
}

/* decide whether this obj is effective when attacking against shades;
   does not consider the bonus for blessed objects versus undead */
export function shade_glare(obj) { /* boolean */
    let arti;

    /* any silver object is effective */
    if (objects[obj.otyp].oc_material == SILVER)
        return TRUE;
    /* non-silver artifacts with bonus against undead also are effective */
    arti = get_artifact(obj);
    if (arti != artilist[ART_NONARTIFACT] && (arti.spfx & SPFX_DFLAG2)
                             && arti.mtype == M2_UNDEAD)
        return TRUE;
    /* [if there was anything with special bonus against noncorporeals,
       it would be effective too] */
    /* otherwise, harmless to shades */
    return FALSE;
}

/* returns 1 if name is restricted for otmp->otyp */
export function restrict_name(otmp, name) { /* boolean */
    const $frame = stack_frame(); try {
    let a;
    let aname, odesc, other;
    let sametype = stack_array(schar, NUM_OBJECTS);
    let i, lo = stack_var(int), hi = stack_var(int), otyp = otmp.otyp, ocls = objects[otyp].oc_class;

    if (!chars[name])
        return FALSE;
    if (!strncmpi(name, _("the "), 4))
        name += 4;

    /* decide what types of objects are the same as otyp;
       if it's been discovered, then only itself matches;
       otherwise, include all other undiscovered objects
       of the same class which have the same description
       or share the same pool of shuffled descriptions */
    memset(sametype, 0, sizeof(array_of(schar, NUM_OBJECTS))); /* FALSE */
    chars[sametype + otyp] = TRUE;
    if (!objects[otyp].oc_name_known
        && (odesc = OBJ_DESCR(objects[otyp])) != 0) {
        obj_shuffle_range(otyp, lo, hi);
        for (i = svb.bases[ocls]; i < NUM_OBJECTS; i++) {
            if (objects[i].oc_class != ocls)
                break;
            if (!objects[i].oc_name_known
                && (other = OBJ_DESCR(objects[i])) != 0
                && (!strcmp(odesc, other) || (i >= lo[0] && i <= hi[0])))
                chars[sametype + i] = TRUE;
        }
    }

    /* Since almost every artifact is SPFX_RESTR, it doesn't cost
       us much to do the string comparison before the spfx check.
       Bug fix:  don't name multiple elven daggers "Sting".
     */
    for (a = ptr_add(artilist[0], 1); a.otyp; a = ptr_add(a, 1)) {
        if (!chars[sametype + a.otyp])
            continue;
        aname = a.name;
        if (!strncmpi(aname, _("the "), 4))
            aname += 4;
        if (!strcmp(aname, name))
            return (+((a.spfx & (SPFX_NOGEN | SPFX_RESTR)) != 0
                              || otmp.quan > 1));
    }

    return FALSE;
    } finally { stack_pop($frame); }
}

export function attacks(adtyp, otmp) { /* boolean */
    let weap;

    if ((weap = get_artifact(otmp)) != artilist[ART_NONARTIFACT])
        return (+(weap.attk.adtyp == adtyp));
    return FALSE;
}

export function defends(adtyp, otmp) { /* boolean */
    let weap;

    if (!otmp)
        return FALSE;
    if ((weap = get_artifact(otmp)) != artilist[ART_NONARTIFACT])
        return (+(weap.defn.adtyp == adtyp));
    if (Is_dragon_armor(otmp)) {
        let otyp = otmp.otyp;

        /* convert mail to scales to simplify testing */
        if (Is_dragon_mail(otmp))
            otyp += GRAY_DRAGON_SCALES - GRAY_DRAGON_SCALE_MAIL;

        switch (adtyp) {
        case AD_MAGM: /* magic missiles => general magic resistance */
            return +(otyp == GRAY_DRAGON_SCALES);
        case AD_HALU: /* confers hallucination resistance */
            return +(otyp == GOLD_DRAGON_SCALES);
        case AD_FIRE:
      /*case AD_BLND: -- gives infravision but does not prevent blindness */
            return +(otyp == RED_DRAGON_SCALES); /* red but not gold */
        case AD_COLD:
      /*case AD_FAMN: -- slows digestion but does not override Famine */
            return +(otyp == WHITE_DRAGON_SCALES); /* white but not silver */
        case AD_DRST: /* drain strength => poison */
        case AD_DISE: /* blocks disease but not slime */
            return +(otyp == GREEN_DRAGON_SCALES);
        case AD_SLEE: /* sleep */
        case AD_PLYS: /* paralysis => free action */
            return +(otyp == ORANGE_DRAGON_SCALES);
        case AD_DISN: /* disintegration */
        case AD_DRLI: /* level drain resistance */
            return +(otyp == BLACK_DRAGON_SCALES);
        case AD_ELEC: /* electricity == lightning */
        case AD_SLOW: /* confers speed so blocks speed removal */
            return +(otyp == BLUE_DRAGON_SCALES);
        case AD_ACID:
        case AD_STON: /* petrification resistance */
            return +(otyp == YELLOW_DRAGON_SCALES);
        default:
            /* SILVER_DRAGON_SCALES don't resist any particular attack type */
            break;
        }
    }
    return FALSE;
}

/* used for monsters */
export function defends_when_carried(adtyp, otmp) { /* boolean */
    let weap;

    if ((weap = get_artifact(otmp)) != artilist[ART_NONARTIFACT])
        return (+(weap.cary.adtyp == adtyp));
    return FALSE;
}

/* determine whether an item confers Protection */
export function protects(otmp, being_worn) { /* boolean */
    let arti;

    if (being_worn && objects[otmp.otyp].oc_oprop == PROTECTION)
        return TRUE;
    arti = get_artifact(otmp);
    if (arti == artilist[ART_NONARTIFACT])
        return FALSE;
    return ((arti.cspfx & SPFX_PROTECT) != 0
                      || (being_worn && (arti.spfx & SPFX_PROTECT) != 0) ? 1 : 0);
}

/*
 * a potential artifact has just been worn/wielded/picked-up or
 * unworn/unwielded/dropped.  Pickup/drop only set/reset the W_ART mask.
 */
export function set_artifact_intrinsic(
    otmp,
    on,
    wp_mask) { /* void */
    let mask = null;
    let art, oart = get_artifact(otmp);
    let obj;
    let dtyp;
    let spfx;

    if (oart == artilist[ART_NONARTIFACT])
        return;

    /* effects from the defn field */
    dtyp = (wp_mask != W_ART) ? oart.defn.adtyp : oart.cary.adtyp;

    if (dtyp == AD_FIRE)
        mask = ref_of(u.uprops[FIRE_RES], "extrinsic");
    else if (dtyp == AD_COLD)
        mask = ref_of(u.uprops[COLD_RES], "extrinsic");
    else if (dtyp == AD_ELEC)
        mask = ref_of(u.uprops[SHOCK_RES], "extrinsic");
    else if (dtyp == AD_MAGM)
        mask = ref_of(u.uprops[ANTIMAGIC], "extrinsic");
    else if (dtyp == AD_DISN)
        mask = ref_of(u.uprops[DISINT_RES], "extrinsic");
    else if (dtyp == AD_DRST)
        mask = ref_of(u.uprops[POISON_RES], "extrinsic");
    else if (dtyp == AD_DRLI)
        mask = ref_of(u.uprops[DRAIN_RES], "extrinsic");

    if (mask && wp_mask == W_ART && !on) {
        /* find out if some other artifact also confers this intrinsic;
           if so, leave the mask alone */
        for (obj = gi.invent; obj; obj = obj.nobj) {
            if (obj != otmp && obj.oartifact) {
                art = get_artifact(obj);
                if (art != artilist[ART_NONARTIFACT]
                        && art.cary.adtyp == dtyp) {
                    mask = null;
                    break;
                }
            }
        }
    }
    if (mask) {
        if (on)
            mask[0] = or64(mask[0], wp_mask);
        else
            mask[0] = and64(mask[0], not64(wp_mask));
    }

    /* intrinsics from the spfx field; there could be more than one */
    spfx = (wp_mask != W_ART) ? oart.spfx : oart.cspfx;
    if (spfx && wp_mask == W_ART && !on) {
        /* don't change any spfx also conferred by other artifacts */
        for (obj = gi.invent; obj; obj = obj.nobj)
            if (obj != otmp && obj.oartifact) {
                art = get_artifact(obj);
                if (art != artilist[ART_NONARTIFACT])
                    spfx = and64u(spfx, not64u(art.cspfx));
            }
    }

    if (spfx & SPFX_SEARCH) {
        if (on)
            u.uprops[SEARCHING].extrinsic = or64(u.uprops[SEARCHING].extrinsic, wp_mask);
        else
            u.uprops[SEARCHING].extrinsic = and64(u.uprops[SEARCHING].extrinsic, not64(wp_mask));
    }
    if (spfx & SPFX_HALRES) {
        /* make_hallucinated must (re)set the mask itself to get
         * the display right */
        /* restoring needed because this is the only artifact intrinsic
         * that can print a message--need to guard against being printed
         * when restoring a game
         */
        make_hallucinated((+!on),
                                 program_state.restoring ? FALSE : TRUE,
                                 wp_mask);
    }
    if (spfx & SPFX_ESP) {
        if (on)
            u.uprops[TELEPAT].extrinsic = or64(u.uprops[TELEPAT].extrinsic, wp_mask);
        else
            u.uprops[TELEPAT].extrinsic = and64(u.uprops[TELEPAT].extrinsic, not64(wp_mask));
        recalc_telepat_range();
        see_monsters();
    }
    if (spfx & SPFX_STLTH) {
        if (on)
            u.uprops[STEALTH].extrinsic = or64(u.uprops[STEALTH].extrinsic, wp_mask);
        else
            u.uprops[STEALTH].extrinsic = and64(u.uprops[STEALTH].extrinsic, not64(wp_mask));
    }
    if (spfx & SPFX_REGEN) {
        if (on)
            u.uprops[REGENERATION].extrinsic = or64(u.uprops[REGENERATION].extrinsic, wp_mask);
        else
            u.uprops[REGENERATION].extrinsic = and64(u.uprops[REGENERATION].extrinsic, not64(wp_mask));
    }
    if (spfx & SPFX_TCTRL) {
        if (on)
            u.uprops[TELEPORT_CONTROL].extrinsic = or64(u.uprops[TELEPORT_CONTROL].extrinsic, wp_mask);
        else
            u.uprops[TELEPORT_CONTROL].extrinsic = and64(u.uprops[TELEPORT_CONTROL].extrinsic, not64(wp_mask));
    }
    if (spfx & SPFX_WARN) {
        if (spec_m2(otmp)) {
            if (on) {
                u.uprops[WARN_OF_MON].extrinsic = or64(u.uprops[WARN_OF_MON].extrinsic, wp_mask);
                svc.context.warntype.obj = or64u(svc.context.warntype.obj, spec_m2(otmp));
            } else {
                u.uprops[WARN_OF_MON].extrinsic = and64(u.uprops[WARN_OF_MON].extrinsic, not64(wp_mask));
                svc.context.warntype.obj = and64u(svc.context.warntype.obj, not64(spec_m2(otmp)));
            }
            see_monsters();
        } else {
            if (on)
                u.uprops[WARNING].extrinsic = or64(u.uprops[WARNING].extrinsic, wp_mask);
            else
                u.uprops[WARNING].extrinsic = and64(u.uprops[WARNING].extrinsic, not64(wp_mask));
        }
    }
    if (spfx & SPFX_EREGEN) {
        if (on)
            u.uprops[ENERGY_REGENERATION].extrinsic = or64(u.uprops[ENERGY_REGENERATION].extrinsic, wp_mask);
        else
            u.uprops[ENERGY_REGENERATION].extrinsic = and64(u.uprops[ENERGY_REGENERATION].extrinsic, not64(wp_mask));
    }
    if (spfx & SPFX_HSPDAM) {
        if (on)
            u.uprops[HALF_SPDAM].extrinsic = or64(u.uprops[HALF_SPDAM].extrinsic, wp_mask);
        else
            u.uprops[HALF_SPDAM].extrinsic = and64(u.uprops[HALF_SPDAM].extrinsic, not64(wp_mask));
    }
    if (spfx & SPFX_HPHDAM) {
        if (on)
            u.uprops[HALF_PHDAM].extrinsic = or64(u.uprops[HALF_PHDAM].extrinsic, wp_mask);
        else
            u.uprops[HALF_PHDAM].extrinsic = and64(u.uprops[HALF_PHDAM].extrinsic, not64(wp_mask));
    }
    if (spfx & SPFX_XRAY) {
        /* this assumes that no one else is using xray_range */
        if (on)
            u.xray_range = 3;
        else
            u.xray_range = -1;
        gv.vision_full_recalc = 1;
    }
    if ((spfx & SPFX_REFLECT) && (wp_mask & W_WEP)) {
        if (on)
            u.uprops[REFLECTING].extrinsic = or64(u.uprops[REFLECTING].extrinsic, wp_mask);
        else
            u.uprops[REFLECTING].extrinsic = and64(u.uprops[REFLECTING].extrinsic, not64(wp_mask));
    }
    if (spfx & SPFX_PROTECT) {
        if (on)
            u.uprops[PROTECTION].extrinsic = or64(u.uprops[PROTECTION].extrinsic, wp_mask);
        else
            u.uprops[PROTECTION].extrinsic = and64(u.uprops[PROTECTION].extrinsic, not64(wp_mask));
    }

    if (wp_mask == W_ART && !on && oart.inv_prop) {
        /* might have to turn off invoked power too */
        if (oart.inv_prop <= LAST_PROP
            && (u.uprops[oart.inv_prop].extrinsic & W_ARTI))
            arti_invoke(otmp);
    }

    if (wp_mask == W_WEP && is_art(otmp, ART_SUNSWORD)) {
        if (on)
            u.uprops[BLND_RES].extrinsic = or64(u.uprops[BLND_RES].extrinsic, wp_mask);
        else
            u.uprops[BLND_RES].extrinsic = and64(u.uprops[BLND_RES].extrinsic, not64(wp_mask));
    }
}

/* touch_artifact()'s return value isn't sufficient to tell whether it
   dished out damage, and tracking changes to u.uhp, u.mh, Lifesaved
   when trying to avoid second wounding is too cumbersome */
const touch_blasted = static_var("touch_blasted", schar); /* for retouch_object() */

/*
 * creature (usually hero) tries to touch (pick up or wield) an artifact obj.
 * Returns 0 if the object refuses to be touched.
 * This routine does not change any object chains.
 * Ignores such things as gauntlets, assuming the artifact is not
 * fooled by such trappings.
 */
export function touch_artifact(obj, mon) { /* int */
    const $frame = stack_frame(); try {
    let oart = get_artifact(obj);
    let badclass, badalign, self_willed, yours;

    touch_blasted[0] = FALSE;
    if (oart == artilist[ART_NONARTIFACT])
        return 1;

    yours = +(mon == gy.youmonst);
    /* all quest artifacts are self-willed; if this ever changes, `badclass'
       will have to be extended to explicitly include quest artifacts */
    self_willed = +((oart.spfx & SPFX_INTEL) != 0);
    if (yours) {
        badclass = (self_willed
                   && ((oart.role != NON_PM && !Role_if(oart.role))
                       || (oart.race != NON_PM && !Race_if(oart.race))) ? 1 : 0);
        badalign = +((oart.spfx & SPFX_RESTR) != 0
                    && oart.alignment != A_NONE
                    && (oart.alignment != u.ualign.type
                        || u.ualign.record < 0));
    } else if (!is_covetous(mon.data) && !is_mplayer(mon.data)) {
        badclass = (self_willed && oart.role != NON_PM
                   && oart != artilist[ART_EXCALIBUR] ? 1 : 0);
        badalign = ((oart.spfx & SPFX_RESTR) && oart.alignment != A_NONE
                   && (oart.alignment != mon_aligntyp(mon)) ? 1 : 0);
    } else { /* an M3_WANTSxxx monster or a fake player */
        /* special monsters trying to take the Amulet, invocation tools or
           quest item can touch anything except `spec_applies' artifacts */
        badclass = badalign = FALSE;
    }
    /* weapons which attack specific categories of monsters are
       bad for them even if their alignments happen to match */
    if (!badalign)
        badalign = bane_applies(oart, mon);

    if (((badclass || badalign) && self_willed)
        || (badalign && (!yours || !rn2(4)))) {
        let dmg, tmp;
        let buf = stack_array(char, BUFSZ);

        if (!yours)
            return 0;
        You(_("are blasted by %s power!"), s_suffix(the(xname(obj))));
        touch_blasted[0] = TRUE;
        dmg = d((Antimagic() ? 2 : 4), (self_willed ? 10 : 4));
        /* add half (maybe quarter) of the usual silver damage bonus */
        if (objects[obj.otyp].oc_material == SILVER && Hate_silver())
            tmp = rnd(10), dmg += Maybe_Half_Phys(tmp);
        sprintf(buf, _("touching %s"), oart.name);
        losehp(dmg, buf, KILLED_BY); /* magic damage, not physical */
        exercise(A_WIS, FALSE);
    }

    /* can pick it up unless you're totally non-synch'd with the artifact */
    if (badclass && badalign && self_willed) {
        if (yours) {
            if (!carried(obj))
                pline(_("%s your grasp!"), Tobjnam(obj, _("evade")));
            else
                pline(_("%s beyond your control!"), Tobjnam(obj, _("are")));
        }
        return 0;
    }

    return 1;
    } finally { stack_pop($frame); }
}

/* decide whether an artifact itself is vulnerable to a particular type
   of erosion damage, independent of the properties of its bearer */
export function arti_immune(obj, dtyp) { /* boolean */
    let weap = get_artifact(obj);

    if (weap == artilist[ART_NONARTIFACT])
        return FALSE;
    if (dtyp == AD_PHYS)
        return FALSE; /* nothing is immune to phys dmg */
    return (+(weap.attk.adtyp == dtyp
                      || weap.defn.adtyp == dtyp
                      || weap.cary.adtyp == dtyp));
}

function bane_applies(oart, mon) { /* boolean */
    const $frame = stack_frame(); try {
    let atmp = stack_struct(struct_artifact);

    if (oart != artilist[ART_NONARTIFACT]
            && (oart.spfx & SPFX_DBONUS) != 0) {
        struct_assign(atmp, oart);
        atmp.spfx = and64u(atmp.spfx, SPFX_DBONUS); /* clear other spfx fields */
        if (spec_applies(atmp, mon))
            return TRUE;
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

/* decide whether an artifact's special attacks apply against mtmp */
function spec_applies(weap, mtmp) { /* int */
    let ptr;
    let yours;

    if (!(weap.spfx & (SPFX_DBONUS | SPFX_ATTK)))
        return +(weap.attk.adtyp == AD_PHYS);

    yours = +(mtmp == gy.youmonst);
    ptr = mtmp.data;

    if (weap.spfx & SPFX_DMONS) {
        return +(ptr == mons[int(weap.mtype)]);
    } else if (weap.spfx & SPFX_DCLAS) {
        return +(weap.mtype == ulong(ptr.mlet));
    } else if (weap.spfx & SPFX_DFLAG1) {
        return +((ptr.mflags1 & weap.mtype) != 0);
    } else if (weap.spfx & SPFX_DFLAG2) {
        return ((ptr.mflags2 & weap.mtype)
                || (yours
                    && ((!Upolyd() && (gu.urace.selfmask & weap.mtype))
                        || ((weap.mtype & M2_WERE) && ismnum(u.ulycn)))) ? 1 : 0);
    } else if (weap.spfx & SPFX_DALIGN) {
        return yours ? +(u.ualign.type != weap.alignment)
                     : +(ptr.maligntyp == A_NONE
                        || sgn(ptr.maligntyp) != weap.alignment);
    } else if (weap.spfx & SPFX_ATTK) {
        if (defended(mtmp, weap.attk.adtyp))
            return FALSE;

        switch (weap.attk.adtyp) {
        case AD_FIRE:
            return +!(yours ? Fire_resistance() : resists_fire(mtmp));
        case AD_COLD:
            return +!(yours ? Cold_resistance() : resists_cold(mtmp));
        case AD_ELEC:
            return +!(yours ? Shock_resistance() : resists_elec(mtmp));
        case AD_MAGM:
        case AD_STUN:
            return +!(yours ? Antimagic() : (rn2(100) < ptr.mr));
        case AD_DRST:
            return +!(yours ? Poison_resistance() : resists_poison(mtmp));
        case AD_DRLI:
            return +!(yours ? Drain_resistance() : resists_drli(mtmp));
        case AD_STON:
            return +!(yours ? Stone_resistance() : resists_ston(mtmp));
        default:
            impossible(_("Weird weapon special attack."));
        }
    }
    return 0;
}

/* return the M2 flags of monster that an artifact's special attacks apply
 * against */
export function spec_m2(otmp) { /* long long */
    let artifact = get_artifact(otmp);

    if (artifact != artilist[ART_NONARTIFACT])
        return artifact.mtype;
    return 0;
}

/* special attack bonus */
export function spec_abon(otmp, mon) { /* int */
    let weap = get_artifact(otmp);

    /* no need for an extra check for `NO_ATTK' because this will
       always return 0 for any artifact which has that attribute */

    if (weap != artilist[ART_NONARTIFACT]
            && weap.attk.damn && spec_applies(weap, mon))
        return rnd(weap.attk.damn);
    return 0;
}

/* special damage bonus */
export function spec_dbon(otmp, mon, tmp) { /* int */
    let weap = get_artifact(otmp);

    if ((weap == artilist[ART_NONARTIFACT])
        || (weap.attk.adtyp == AD_PHYS /* check for `NO_ATTK' */
                  && weap.attk.damn == 0 && weap.attk.damd == 0))
        gs.spec_dbon_applies = FALSE;
    else if (is_art(otmp, ART_GRIMTOOTH))
        /* Grimtooth has SPFX settings to warn against elves but we want its
           damage bonus to apply to all targets, so bypass spec_applies() */
        gs.spec_dbon_applies = TRUE;
    else
        gs.spec_dbon_applies = spec_applies(weap, mon);

    if (gs.spec_dbon_applies)
        return weap.attk.damd ? rnd(weap.attk.damd) : max(tmp, 1);
    return 0;
}

/* add identified artifact to discoveries list */
export function discover_artifact(m) { /* void */
    let i;

    /* look for this artifact in the discoveries list;
       if we hit an empty slot then it's not present, so add it */
    for (i = 0; i < NROFARTIFACTS; i++)
        if (artidisco[i] == 0 || artidisco[i] == m) {
            artidisco[i] = m;
            return;
        }
    /* there is one slot per artifact, so we should never reach the
       end without either finding the artifact or an empty slot... */
    impossible(_("couldn't discover artifact (%d)"), m);
}

/* used to decide whether an artifact has been fully identified */
export function undiscovered_artifact(m) { /* boolean */
    let i;

    /* look for this artifact in the discoveries list;
       if we hit an empty slot then it's undiscovered */
    for (i = 0; i < NROFARTIFACTS; i++)
        if (artidisco[i] == m)
            return FALSE;
        else if (artidisco[i] == 0)
            break;
    return TRUE;
}

/* display a list of discovered artifacts; return their count */
export function disp_artifact_discoveries(
    tmpwin) { /* int */ /* supplied by dodiscover(); type is NHW_TEXT */
    const $frame = stack_frame(); try {
    let i, m, otyp;
    let algnstr;
    let buf = stack_array(char, BUFSZ);

    for (i = 0; i < NROFARTIFACTS; i++) {
        if (artidisco[i] == 0)
            break; /* empty slot implies end of list */
        if (tmpwin == WIN_ERR)
            continue; /* for WIN_ERR, we just count */

        if (i == 0)
            putstr()(tmpwin, iflags.menu_headings.attr, _("Artifacts"));
        m = artidisco[i];
        otyp = artilist[m].otyp;
        algnstr = align_str(artilist[m].alignment);
        if (!strcmp(algnstr, _("unaligned")))
            algnstr = _("non-aligned");

        sprintf(buf, _("  %s [%s %s]"), artiname(m), algnstr, simple_typename(otyp))
;
        putstr()(tmpwin, 0, buf);
    }
    return i;
    } finally { stack_pop($frame); }
}

/* (wizard mode only) show all artifacts and their flags */
export function dump_artifact_info(tmpwin) { /* void */
    const $frame = stack_frame(); try {
    let m;
    let buf = stack_array(char, BUFSZ), buf2 = stack_array(char, BUFSZ);

    /* not a menu, but header uses same bold or whatever attribute as such */
    putstr()(tmpwin, iflags.menu_headings.attr, _("Artifacts"));
    for (m = 1; m <= NROFARTIFACTS; ++m) {
        Snprintf(buf2, sizeof(array_of(char, BUFSZ)), _("[%s%s%s%s%s%s%s%s%s]"), artiexist[m].exists ? _("exists;") : _(""), artiexist[m].found  ? _(" hero knows;") : _(""), artiexist[m].gift   ? _(" gift")   : _(""), artiexist[m].wish   ? _(" wish")   : _(""), artiexist[m].named  ? _(" named")  : _(""), artiexist[m].viadip ? _(" viadip") : _(""), artiexist[m].lvldef ? _(" lvldef") : _(""), artiexist[m].bones  ? _(" bones")  : _(""), artiexist[m].rndm   ? _(" random") : _(""))

;

            /* "The Platinum Yendorian Express Card" is 35 characters */
            Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("  %-36.36s%s"), artiname(m), buf2);

        putstr()(tmpwin, 0, buf);
    }
    return;
    } finally { stack_pop($frame); }
}

/*
 * Magicbane's intrinsic magic is incompatible with normal
 * enchantment magic.  Thus, its effects have a negative
 * dependence on spe.  Against low mr victims, it typically
 * does "double athame" damage, 2d4.  Occasionally, it will
 * cast unbalancing magic which effectively averages out to
 * 4d4 damage (3d4 against high mr victims), for spe = 0.
 *
 * Prior to 3.4.1, the cancel (aka purge) effect always
 * included the scare effect too; now it's one or the other.
 * Likewise, the stun effect won't be combined with either
 * of those two; it will be chosen separately or possibly
 * used as a fallback when scare or cancel fails.
 *
 * [Historical note: a change to artifact_hit() for 3.4.0
 * unintentionally made all of Magicbane's special effects
 * be blocked if the defender successfully saved against a
 * stun attack.  As of 3.4.1, those effects can occur but
 * will be slightly less likely than they were in 3.3.x.]
 */

    const MB_INDEX_PROBE = 0;
    const MB_INDEX_STUN = MB_INDEX_PROBE + 1;
    const MB_INDEX_SCARE = MB_INDEX_STUN + 1;
    const MB_INDEX_CANCEL = MB_INDEX_SCARE + 1;

    const NUM_MB_INDICES = MB_INDEX_CANCEL + 1;

export const MB_MAX_DIEROLL = 8;
const mb_verb = static_array("mb_verb", array_of(ptr_to(char), NUM_MB_INDICES), 2, [
    [ _("probe"), _("stun"), _("scare"), _("cancel") ],
    [ _("prod"), _("amaze"), _("tickle"), _("purge") ],
]);

/* called when someone is being hit by Magicbane */
function Mb_hit(magr,
       mdef,
       mb,
       dmgptr,
       dieroll,
       vis,
       hittee) { /* boolean */ /* target's name: "you" or mon_nam(mdef) */
    const $frame = stack_frame(); try {
    let old_mdat;
    let verb;
    let youattack = +(magr == gy.youmonst),
            youdefend = +(mdef == gy.youmonst),
            resisted = FALSE, do_stun, do_confuse, result;
    let attack_indx, fakeidx, scare_dieroll = Math.trunc(MB_MAX_DIEROLL / 2);

    result = FALSE; /* no message given yet */
    /* the most severe effects are less likely at higher enchantment */
    if (mb.spe >= 3)
        scare_dieroll = Math.trunc(scare_dieroll / (1 << Math.trunc(mb.spe / 3)));
    /* if target successfully resisted the artifact damage bonus,
       reduce overall likelihood of the assorted special effects */
    if (!gs.spec_dbon_applies)
        dieroll += 1;

    /* might stun even when attempting a more severe effect, but
       in that case it will only happen if the other effect fails;
       extra damage will apply regardless; 3.4.1: sometimes might
       just probe even when it hasn't been enchanted */
    do_stun = +(max(mb.spe, 0) < rn2(gs.spec_dbon_applies ? 11 : 7));

    /* the special effects also boost physical damage; increments are
       generally cumulative, but since the stun effect is based on a
       different criterium its damage might not be included; the base
       damage is either 1d4 (athame) or 2d4 (athame+spec_dbon) depending
       on target's resistance check against AD_STUN (handled by caller)
       [note that a successful save against AD_STUN doesn't actually
       prevent the target from ending up stunned] */
    attack_indx = MB_INDEX_PROBE;
    dmgptr[0] += rnd(4); /* (2..3)d4 */
    if (do_stun) {
        attack_indx = MB_INDEX_STUN;
        dmgptr[0] += rnd(4); /* (3..4)d4 */
    }
    if (dieroll <= scare_dieroll) {
        attack_indx = MB_INDEX_SCARE;
        dmgptr[0] += rnd(4); /* (3..5)d4 */
    }
    if (dieroll <= Math.trunc(scare_dieroll / 2)) {
        attack_indx = MB_INDEX_CANCEL;
        dmgptr[0] += rnd(4); /* (4..6)d4 */
    }

    /* give the hit message prior to inflicting the effects */
    verb = mb_verb[+!!Hallucination()][attack_indx];
    if (youattack || youdefend || vis) {
        result = TRUE;
        pline_The(_("magic-absorbing blade %s %s!"),
                  vtense(0, verb), hittee);
        /* assume probing has some sort of noticeable feedback
           even if it is being done by one monster to another */
        if (attack_indx == MB_INDEX_PROBE && !canspotmon(mdef))
            map_invisible(mdef.mx, mdef.my);
    }

    /* now perform special effects */
    switch (attack_indx) {
    case MB_INDEX_CANCEL:
        old_mdat = youdefend ? gy.youmonst.data : mdef.data;
        /* No mdef->mcan check: even a cancelled monster can be polymorphed
         * into a golem, and the "cancel" effect acts as if some magical
         * energy remains in spellcasting defenders to be absorbed later.
         */
        if (!cancel_monst(mdef, mb, youattack, FALSE, FALSE)) {
            resisted = TRUE;
        } else {
            do_stun = FALSE;
            if (youdefend) {
                if (gy.youmonst.data != old_mdat)
                    dmgptr[0] = 0; /* rehumanized, so no more damage */
                if (u.uenmax > 0) {
                    u.uenmax--;
                    if (u.uen > 0)
                        u.uen--;
                    disp.botl = TRUE;
                    You(_("lose magical energy!"));
                }
            } else {
                /* canceled shapeshifter/vamp may have changed forms, so
                   update its name if necessary */
                if (mdef.data != old_mdat)
                    strcpy(hittee, mon_nam(mdef));
                if (mdef.data == mons[PM_CLAY_GOLEM])
                    mdef.mhp = 1; /* cancelled clay golems will die */
                if (youattack && attacktype(mdef.data, AT_MAGC)) {
                    u.uenmax++;
                    if (u.uenmax > u.uenpeak)
                        u.uenpeak = u.uenmax;
                    u.uen++;
                    disp.botl = TRUE;
                    You(_("absorb magical energy!"));
                }
            }
        }
        break;

    case MB_INDEX_SCARE:
        if (youdefend) {
            if (Antimagic()) {
                resisted = TRUE;
            } else {
                nomul(-3);
                gm.multi_reason = _("being scared stiff");
                gn.nomovemsg = _("");
                if (magr && magr == u.ustuck && sticks(gy.youmonst.data)) {
                    set_ustuck(null);
                    You(_("release %s!"), mon_nam(magr));
                }
            }
        } else {
            if (rn2(2) && resist(mdef, WEAPON_CLASS, 0, NOTELL))
                resisted = TRUE;
            else
                monflee(mdef, 3, FALSE, +(mdef.mhp > dmgptr[0]));
        }
        if (!resisted)
            do_stun = FALSE;
        break;

    case MB_INDEX_STUN:
        do_stun = TRUE; /* (this is redundant...) */
        break;

    case MB_INDEX_PROBE:
        if (youattack && (mb.spe == 0 || !rn2(3 * abs(mb.spe)))) {
            pline_The(_("%s is insightful."), verb);
            /* pre-damage status */
            probe_monster(mdef);
        }
        break;
    }
    /* stun if that was selected and a worse effect didn't occur */
    if (do_stun) {
        if (youdefend)
            make_stunned(((HStun() & TIMEOUT) + 3), FALSE);
        else
            mdef.mstun = 1;
        /* avoid extra stun message below if we used mb_verb["stun"] above */
        if (attack_indx == MB_INDEX_STUN)
            do_stun = FALSE;
    }
    /* lastly, all this magic can be confusing... */
    do_confuse = +!rn2(12);
    if (do_confuse) {
        if (youdefend)
            make_confused((HConfusion() & TIMEOUT) + 4, FALSE);
        else
            mdef.mconf = 1;
    }

    /* now give message(s) describing side-effects; Use fakename
       so vtense() won't be fooled by assigned name ending in 's' */
    fakeidx = youdefend ? 1 : 0;
    if (youattack || youdefend || vis) {
        upstart(hittee); /* capitalize */
        if (resisted) {
            pline(_("%s %s!"), hittee, vtense(fakename()[fakeidx], _("resist")));
            shieldeff(youdefend ? u.ux : mdef.mx,
                      youdefend ? u.uy : mdef.my);
        }
        if ((do_stun || do_confuse) && flags.verbose) {
            let buf = stack_array(char, BUFSZ);

            chars[buf + 0] = ord('\0');
            if (do_stun)
                strcat(buf, _("stunned"));
            if (do_stun && do_confuse)
                strcat(buf, _(" and "));
            if (do_confuse)
                strcat(buf, _("confused"));
            pline(_("%s %s %s%c"), hittee, vtense(fakename()[fakeidx], _("are")), buf,
                  (do_stun && do_confuse) ? ord('!') : ord('.'));
        }
    }

    return result;
    } finally { stack_pop($frame); }
}

/* Function used when someone attacks someone else with an artifact
 * weapon.  Only adds the special (artifact) damage, and returns a 1 if it
 * did something special (in which case the caller won't print the normal
 * hit message).  This should be called once upon every artifact attack;
 * dmgval() no longer takes artifact bonuses into account.  Possible
 * extension: change the killer so that when an orc kills you with
 * Stormbringer it's "killed by Stormbringer" instead of "killed by an orc".
 */
export function artifact_hit(
    magr,
    mdef,
    otmp,
    dmgptr,
    dieroll) { /* boolean */ /* needed for Magicbane and vorpal blades */
    const $frame = stack_frame(); try {
    let youattack = +(magr == gy.youmonst);
    let youdefend = +(mdef == gy.youmonst);
    let vis = ((!youattack && magr && cansee(magr.mx, magr.my))
                  || (!youdefend && cansee(mdef.mx, mdef.my))
                  || (youattack && engulfing_u(mdef) && !Blind()) ? 1 : 0);
    let realizes_damage;
    let wepdesc;
    let you = init_string(static_array("artifact_hit.you", char, sizeof_string("you")), _("you"), true);
    let hittee = stack_array(char, BUFSZ);

    strcpy(hittee, youdefend ? you : mon_nam(mdef));

    /* The following takes care of most of the damage, but not all--
     * the exception being for level draining, which is specially
     * handled.  Messages are done in this function, however.
     */
    dmgptr[0] += spec_dbon(otmp, mdef, dmgptr[0]);

    if (youattack && youdefend) {
        impossible(_("attacking yourself with weapon?"));
        return FALSE;
    }

    realizes_damage = (youdefend || vis
                       /* feel the effect even if not seen */
                       || (youattack && mdef == u.ustuck) ? 1 : 0);

    /* the four basic attacks: fire, cold, shock and missiles */
    if (attacks(AD_FIRE, otmp)) {
        if (realizes_damage)
            pline_The(_("fiery blade %s %s%c"),
                      !gs.spec_dbon_applies
                          ? _("hits")
                          : (mdef.data == mons[PM_WATER_ELEMENTAL])
                                ? _("vaporizes part of")
                                : _("burns"),
                      hittee, !gs.spec_dbon_applies ? ord('.') : ord('!'));
        if (!rn2(4)) {
            let itemdmg = destroy_items(mdef, AD_FIRE, dmgptr[0]);
            if (!youdefend)
                dmgptr[0] += itemdmg; /* item destruction dmg */
            ignite_items(mdef.minvent);
        }
        if (youdefend && Slimed())
            burn_away_slime();
        return realizes_damage;
    }
    if (attacks(AD_COLD, otmp)) {
        if (realizes_damage)
            pline_The(_("ice-cold blade %s %s%c"),
                      !gs.spec_dbon_applies ? _("hits") : _("freezes"), hittee,
                      !gs.spec_dbon_applies ? ord('.') : ord('!'));
        if (!rn2(4)) {
            let itemdmg = destroy_items(mdef, AD_COLD, dmgptr[0]);
            if (!youdefend)
                dmgptr[0] += itemdmg; /* item destruction dmg */
        }
        return realizes_damage;
    }
    if (attacks(AD_ELEC, otmp)) {
        if (realizes_damage)
            pline_The(_("massive hammer hits%s %s%c"),
                      !gs.spec_dbon_applies ? _("") : _("!  Lightning strikes"),
                      hittee, !gs.spec_dbon_applies ? ord('.') : ord('!'));
        if (gs.spec_dbon_applies)
            wake_nearto(mdef.mx, mdef.my, 4 * 4);
        if (!rn2(5)) {
            let itemdmg = destroy_items(mdef, AD_ELEC, dmgptr[0]);
            if (!youdefend)
                dmgptr[0] += itemdmg; /* item destruction dmg */
        }
        return realizes_damage;
    }
    if (attacks(AD_MAGM, otmp)) {
        if (realizes_damage)
            pline_The(_("imaginary widget hits%s %s%c"),
                      !gs.spec_dbon_applies
                          ? _("")
                          : _("!  A hail of magic missiles strikes"),
                      hittee, !gs.spec_dbon_applies ? ord('.') : ord('!'));
        return realizes_damage;
    }

    if (attacks(AD_STUN, otmp) && dieroll <= MB_MAX_DIEROLL) {
        /* Magicbane's special attacks (possibly modifies hittee[]) */
        return Mb_hit(magr, mdef, otmp, dmgptr, dieroll, vis, hittee);
    }

    if (!gs.spec_dbon_applies) {
        /* since damage bonus didn't apply, nothing more to do;
           no further attacks have side-effects on inventory */
        return FALSE;
    }

    /* We really want "on a natural 20" but Nethack does it in */
    /* reverse from AD&D. */
    if (spec_ability(otmp, SPFX_BEHEAD)) {
        if (is_art(otmp, ART_TSURUGI_OF_MURAMASA) && dieroll == 1) {
            wepdesc = _("The razor-sharp blade");
            /* not really beheading, but so close, why add another SPFX */
            if (youattack && engulfing_u(mdef)) {
                You(_("slice %s wide open!"), mon_nam(mdef));
                dmgptr[0] = 2 * mdef.mhp + FATAL_DAMAGE_MODIFIER;
                return TRUE;
            }
            if (!youdefend) {
                /* allow normal cutworm() call to add extra damage */
                if (gn.notonhead)
                    return FALSE;

                if (bigmonst(mdef.data)) {
                    if (youattack)
                        You(_("slice deeply into %s!"), mon_nam(mdef));
                    else if (vis)
                        pline(_("%s cuts deeply into %s!"), Monnam(magr),
                              hittee);
                    dmgptr[0] *= 2;
                    return TRUE;
                }
                dmgptr[0] = 2 * mdef.mhp + FATAL_DAMAGE_MODIFIER;
                pline(_("%s cuts %s in half!"), wepdesc, mon_nam(mdef));
                observe_object(otmp);
                return TRUE;
            } else {
                if (bigmonst(gy.youmonst.data)) {
                    pline(_("%s cuts deeply into you!"),
                          magr ? Monnam(magr) : wepdesc);
                    dmgptr[0] *= 2;
                    return TRUE;
                }

                /* Players with negative AC's take less damage instead
                 * of just not getting hit.  We must add a large enough
                 * value to the damage so that this reduction in
                 * damage does not prevent death.
                 */
                dmgptr[0] = 2 * (Upolyd() ? u.mh : u.uhp) + FATAL_DAMAGE_MODIFIER;
                pline(_("%s cuts you in half!"), wepdesc);
                observe_object(otmp);
                return TRUE;
            }
        } else if (is_art(otmp, ART_VORPAL_BLADE)
                   && (dieroll == 1 || mdef.data == mons[PM_JABBERWOCK])) {
            let behead_msg = static_array("artifact_hit.behead_msg", ptr_to(char), 2, [ _("%s beheads %s!"),
                                                       _("%s decapitates %s!") ]);

            if (youattack && engulfing_u(mdef))
                return FALSE;
            wepdesc = artilist[ART_VORPAL_BLADE].name;
            if (!youdefend) {
                if (!has_head(mdef.data) || gn.notonhead || u.uswallow) {
                    if (youattack)
                        pline(_("Somehow, you miss %s wildly."), mon_nam(mdef));
                    else if (vis)
                        pline(_("Somehow, %s misses wildly."), mon_nam(magr));
                    dmgptr[0] = 0;
                    return (youattack || vis ? 1 : 0);
                }
                if (noncorporeal(mdef.data) || amorphous(mdef.data)) {
                    pline(_("%s slices through %s %s."), wepdesc,
                          s_suffix(mon_nam(mdef)), mbodypart(mdef, NECK));
                    return TRUE;
                }
                dmgptr[0] = 2 * mdef.mhp + FATAL_DAMAGE_MODIFIER;
                pline(ROLL_FROM(behead_msg), wepdesc,
                      mon_nam(mdef));
                if (Hallucination() && !flags.female)
                    pline(_("Good job Henry, but that wasn't Anne."));
                observe_object(otmp);
                return TRUE;
            } else {
                if (!has_head(gy.youmonst.data)) {
                    pline(_("Somehow, %s misses you wildly."),
                          magr ? mon_nam(magr) : wepdesc);
                    dmgptr[0] = 0;
                    return TRUE;
                }
                if (noncorporeal(gy.youmonst.data)
                    || amorphous(gy.youmonst.data)) {
                    pline(_("%s slices through your %s."), wepdesc,
                          body_part(NECK));
                    return TRUE;
                }
                dmgptr[0] = 2 * (Upolyd() ? u.mh : u.uhp) + FATAL_DAMAGE_MODIFIER;
                pline(ROLL_FROM(behead_msg), wepdesc, _("you"));
                observe_object(otmp);
                /* Should amulets fall off? */
                return TRUE;
            }
        }
    }
    if (spec_ability(otmp, SPFX_DRLI)) {
        /* some non-living creatures (golems, vortices) are vulnerable to
           life drain effects so can get "<Arti> draws the <life>" feedback */
        let life = nonliving(mdef.data) ? _("animating force") : _("life");

        if (!youdefend) {
            let m_lev = mdef.m_lev,
                mhpmax = mdef.mhpmax,
                drain = monhp_per_lvl(mdef); /* usually 1d8 */
                /* note: DRLI attack uses 2d6, attacker doesn't get healed */

            /* stop draining HP if it drops too low (still drains level;
               also caller still inflicts regular weapon damage) */
            if (mhpmax - drain <= m_lev)
                drain = (mhpmax > m_lev) ? (mhpmax - (m_lev + 1)) : 0;

            if (vis) {
                /* call distant_name() for possible side-effects even if
                   the result won't be printed */
                let otmpname = distant_name(otmp, xname);

                if (is_art(otmp, ART_STORMBRINGER))
                    pline_The(_("%s blade draws the %s from %s!"),
                              hcolor(NH_BLACK()), life, mon_nam(mdef));
                else
                    pline(_("%s draws the %s from %s!"),
                          The(otmpname), life, mon_nam(mdef));
            }
            if (mdef.m_lev == 0) {
                /* losing a level when at 0 is fatal */
                dmgptr[0] = 2 * mdef.mhp + FATAL_DAMAGE_MODIFIER;
            } else {
                dmgptr[0] += drain;
                mdef.mhpmax -= drain;
                mdef.m_lev--;
            }

            if (drain > 0) {
                /* drain: was target's damage, now heal attacker by half */
                drain = Math.trunc((drain + 1) / 2); /* drain/2 rounded up */
                if (youattack) {
                    healup(drain, 0, FALSE, FALSE);
                } else {
                    assert(magr != null);
                    healmon(magr, drain, 0);
                }
            }
            return vis;
        } else { /* youdefend */
            let oldhpmax = u.uhpmax;

            if (Blind()) {
                You_feel(_("an %s drain your %s!"),
                         is_art(otmp, ART_STORMBRINGER)
                            ? _("unholy blade")
                            : _("object"),
                         life);
            } else {
                /* call distant_name() for possible side-effects even if
                   the result won't be printed */
                let otmpname = distant_name(otmp, xname);

                if (is_art(otmp, ART_STORMBRINGER))
                    pline_The(_("%s blade drains your %s!"),
                              hcolor(NH_BLACK()), life);
                else
                    pline(_("%s drains your %s!"), The(otmpname), life);
            }
            losexp(_("life drainage"));
            if (magr && magr.mhp < magr.mhpmax) {
                healmon(magr, Math.trunc((abs(oldhpmax - u.uhpmax) + 1) / 2), 0);
            }
            return TRUE;
        }
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

/* getobj callback for object to be invoked */
function invoke_ok(obj) { /* int */
    if (!obj)
        return GETOBJ_EXCLUDE;

    /* artifacts and other special items */
    if (obj.oartifact || objects[obj.otyp].oc_unique
        || (obj.otyp == FAKE_AMULET_OF_YENDOR && !obj.known))
        return GETOBJ_SUGGEST;

    /* synonym for apply, though actually invoking it will do different things
     * depending if it's a regular crystal ball, an artifact one that has an
     * invoke power, and a (theoretical) artifact one that doesn't have an
     * invoke power */
    if (obj.otyp == CRYSTAL_BALL)
        return GETOBJ_SUGGEST;

    return GETOBJ_EXCLUDE;
}

/* the #invoke command */
export function doinvoke() { /* int */
    const $frame = stack_frame(); try {
    let obj = stack_var(ptr_to(struct_obj));

    obj[0] = getobj(_("invoke"), invoke_ok, GETOBJ_PROMPT);
    if (!obj[0])
        return ECMD_CANCEL;
    if (!retouch_object(obj, FALSE))
        return ECMD_TIME;
    return arti_invoke(obj[0]);
    } finally { stack_pop($frame); }
}

function nothing_special(obj) { /* void */
    if (carried(obj))
        You_feel(_("a surge of power, but nothing seems to happen."));
}

function invoke_taming(obj) { /* int */
    const $frame = stack_frame(); try {
    let pseudo = stack_struct(struct_obj);

    struct_assign(pseudo, cg.zeroobj); /* neither cursed nor blessed, zero oextra too */
    pseudo.otyp = SCR_TAMING;
    seffects(pseudo);
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

function invoke_healing(obj) { /* int */
    let healamt = Math.trunc((u.uhpmax + 1 - u.uhp) / 2);
    let creamed = u.ucreamed;

    if (Upolyd())
        healamt = Math.trunc((u.mhmax + 1 - u.mh) / 2);
    if (healamt || Sick() || Slimed() || Blinded() > creamed)
        You_feel(_("better."));
    if (healamt || Sick() || Slimed() || BlindedTimeout() > creamed)
        You_feel(_("%sbetter."),
                 (!healamt && !Sick() && !Slimed()
                  /* when healing temporary blindness (aside from
                     goop covering face), might still be blind
                     due to PermaBlind or eyeless polymorph;
                     vary the message in that situation */
                  && (HBlinded() & ~TIMEOUT) != 0) ? _("slightly ") : _(""));
    else {
        nothing_special(obj);
        return ECMD_TIME;
    }
    if (healamt > 0) {
        if (Upolyd())
            u.mh += healamt;
        else
            u.uhp += healamt;
    }
    if (Sick())
        make_sick(0, 0, FALSE, SICK_ALL);
    if (Slimed())
        make_slimed(0, 0);
    if (BlindedTimeout() > creamed)
        make_blinded(creamed, FALSE);
    disp.botl = TRUE;
    return ECMD_TIME;
}

function invoke_energy_boost(obj) { /* int */
    let epboost = Math.trunc((u.uenmax + 1 - u.uen) / 2);

    if (epboost > 120)
        epboost = 120; /* arbitrary */
    else if (epboost < 12)
        epboost = u.uenmax - u.uen;
    if (epboost) {
        u.uen += epboost;
        disp.botl = TRUE;
        You_feel(_("re-energized."));
    } else {
        nothing_special(obj);
        return ECMD_TIME;
    }
    return ECMD_TIME;
}

function invoke_untrap(obj) { /* int */
    if (!untrap(TRUE, 0, 0, null)) {
        obj.age = 0; /* don't charge for changing their mind */
        return ECMD_CANCEL;
    }
    return ECMD_TIME;
}

function invoke_charge_obj(obj) { /* int */
    let oart = get_artifact(obj);
    let otmp = getobj(_("charge"), charge_ok,
                              GETOBJ_PROMPT | GETOBJ_ALLOWCNT);
    let b_effect;

    if (!otmp) {
        obj.age = 0;
        return ECMD_CANCEL;
    }
    b_effect = (obj.blessed && (oart.role == Role_switch()
                                 || oart.role == NON_PM) ? 1 : 0);
    recharge(otmp, b_effect ? 1 : obj.cursed ? -1 : 0);
    update_inventory();
    return ECMD_TIME;
}

function invoke_create_portal(obj) { /* int */
    const $frame = stack_frame(); try {
    let i, num_ok_dungeons, last_ok_dungeon = 0;
    let newlev = stack_struct(struct_d_level);
    let tmpwin = create_nhwindow()(NHW_MENU);
    let any = stack_struct(struct_any);
    let clr = NO_COLOR;

    struct_assign(any, cg.zeroany); /* set all bits to zero */
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    /* use index+1 (can't use 0) as identifier */
    for (i = num_ok_dungeons = 0; i < svn.n_dgns; i++) {
        if (!svd.dungeons[i].dunlev_ureached)
            continue;
        if (i == tutorial_dnum()) /* can't portal into tutorial */
            continue;
        any.a_int = i + 1;
        add_menu(tmpwin, nul_glyphinfo, any, 0, 0,
                 ATR_NONE, clr,
                 svd.dungeons[i].dname, MENU_ITEMFLAGS_NONE);
        num_ok_dungeons++;
        last_ok_dungeon = i;
    }
    end_menu()(tmpwin, _("Open a portal to which dungeon?"));
    if (num_ok_dungeons > 1) {
        /* more than one entry; display menu for choices */
        let selected = stack_var(ptr_to(struct_mi));
        let n;

        n = select_menu(tmpwin, PICK_ONE, selected);
        if (n <= 0) {
            destroy_nhwindow()(tmpwin);
            nothing_special(obj);
            return ECMD_TIME;
        }
        i = ptr_add(selected[0], 0).item.a_int - 1;
        free(addr_of(selected[0]));
    } else
        i = last_ok_dungeon; /* also first & only OK dungeon */
    destroy_nhwindow()(tmpwin);

    /*
     * i is now index into dungeon structure for the new dungeon.
     * Find the closest level in the given dungeon, open
     * a use-once portal to that dungeon and go there.
     * The closest level is either the entry or dunlev_ureached.
     */
    newlev.dnum = i;
    if (svd.dungeons[i].depth_start >= depth(u.uz))
        newlev.dlevel = svd.dungeons[i].entry_lev;
    else
        newlev.dlevel = svd.dungeons[i].dunlev_ureached;

    if (u.uhave.amulet || In_endgame(u.uz) || In_endgame(newlev)
        || newlev.dnum == u.uz.dnum || !next_to_u()) {
        You_feel(_("very disoriented for a moment."));
    } else {
        if (!Blind())
            You(_("are surrounded by a shimmering sphere!"));
        else
            You_feel(_("weightless for a moment."));
        goto_level(newlev, FALSE, FALSE, FALSE);
    }
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

function invoke_create_ammo(obj) { /* int */
    let otmp = mksobj(ARROW, TRUE, FALSE);

    if (!otmp) {
        nothing_special(obj);
        return ECMD_TIME;
    }
    otmp.blessed = obj.blessed;
    otmp.cursed = obj.cursed;
    otmp.bknown = obj.bknown;
    otmp.oeroded = otmp.oeroded2 = 0;
    if (obj.blessed) {
        if (otmp.spe < 0)
            otmp.spe = 0;
        otmp.quan += rnd(10);
    } else if (obj.cursed) {
        if (otmp.spe > 0)
            otmp.spe = 0;
    } else
        otmp.quan += rnd(5);
    otmp.owt = unsigned(weight(otmp));
    otmp = hold_another_object(otmp, _("Suddenly %s out."),
                               aobjnam(otmp, _("fall")), 0);
    (otmp);
    return ECMD_TIME;
}

function invoke_banish(obj) { /* int */
    const $frame = stack_frame(); try {
    let nvanished = 0, nstayed = 0;
    let mtmp, mtmp2;
    let dest = stack_struct(struct_d_level);

    find_hell(dest);

    for (mtmp = fmon(); mtmp; mtmp = mtmp2) {
        let chance = 1;

        mtmp2 = mtmp.nmon;
        if (DEADMONSTER(mtmp) || !isok(mtmp.mx, mtmp.my))
            continue;
        if (!is_demon(mtmp.data) && mtmp.data.mlet != S_IMP)
            continue;
        if (!couldsee(mtmp.mx, mtmp.my))
            continue;
        if (mtmp.data.msound == MS_NEMESIS)
            continue;

        if (In_quest(u.uz) && !svq.quest_status.killed_nemesis)
            chance += 10;
        if (is_dprince(mtmp.data))
            chance += 2;
        if (is_dlord(mtmp.data))
            chance++;

        mtmp.msleeping = mtmp.mtame = mtmp.mpeaceful = 0;
        if (chance <= 1 || !rn2(chance)) {
            if (!Inhell()) {
                nvanished++;
                /* banish to a random level in Gehennom */
                dest.dlevel = rn2(dunlevs_in_dungeon(dest));
                migrate_mon(mtmp, ledger_no(dest), MIGR_RANDOM);
            } else {
                u_teleport_mon(mtmp, FALSE);
            }
        } else {
            nstayed++;
        }
    }

    if (nvanished) {
        let subject = init_string(stack_array(char, sizeof_string("demons")), _("demons"));

        if (nvanished == 1)
            chars[(eos(subject) - 1)] = ord('\0'); /* remove 's' */
        pline(_("%s %s %s in a cloud of brimstone!"),
              nstayed ? ((nvanished > nstayed)
                         ? _("Most of the")
                         : _("Some of the"))
              : _("The"),
              subject, vtense(subject, _("disappear")));
    }
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

function invoke_fling_poison(obj) { /* int */
    if (getdir(0)) {
        let venom = rn2(2) ? BLINDING_VENOM : ACID_VENOM;
        let otmp = mksobj(venom, TRUE, FALSE);

        otmp.spe = 1; /* the poison is yours */
        throwit(otmp, 0, FALSE, null);
    } else {
        /* no direction picked */
        pline(_("%s"), Never_mind());
        obj.age = svm.moves;
        return ECMD_CANCEL;
    }
    return ECMD_TIME;
}

function invoke_storm_spell(obj) { /* int */
    let oart = get_artifact(obj);
    let storm = oart.inv_prop == SNOWSTORM ? SPE_CONE_OF_COLD : SPE_FIREBALL;
    let skill = spell_skilltype(storm);
    let expertise = P_SKILL(skill);

    (u.weapon_skills[skill].skill) = P_EXPERT;
    spelleffects(storm, FALSE, TRUE);
    (u.weapon_skills[skill].skill) = expertise;
    return ECMD_TIME;
}

function invoke_blinding_ray(obj) { /* int */
    if (getdir(0)) {
        if (u.dx || u.dy) {
            do_blinding_ray(obj);
        } else if (u.dz) {
            /* up or down => light this map spot; litroom() uses
               radius 0 for Sunsword, except on Rogue level where
               whole room gets lit and corridor spots remain unlit */
            litroom(TRUE, obj);
            pline(_("%s"), ((!Blind() && levl()[u.ux][u.uy].lit
                          && !levl()[u.ux][u.uy].waslit)
                         ? _("It is lit here now.")
                         : nothing_seems_to_happen()));
        } else { /* zapyourself() */
            let vulnerable = +(u.umonnum == PM_GREMLIN);
            let damg = obj.blessed ? 15 : !obj.cursed ? 10 : 5;

            if (vulnerable) /* could be fatal if Unchanging */
                lightdamage(obj, TRUE, 2 * damg);

            if (!flashburn((damg + rnd(damg)), FALSE)
                && !vulnerable)
                pline(_("%s"), nothing_seems_to_happen());
        }
    } else {
        /* no direction picked */
        pline(_("%s"), Never_mind());
        obj.age = svm.moves;
        return ECMD_CANCEL;
    }
    return ECMD_TIME;
}

/* return the amount of Pw invoking an object costs.
   return a negative value, if obj invoking cannot be paid with Pw */
function arti_invoke_cost_pw(obj) { /* int */
    let oart = get_artifact(obj);

    if (oart.inv_prop == FLING_POISON
        || oart.inv_prop == BLINDING_RAY) {
        /* pretend it's a level 5 spell */
        return SPELL_LEV_PW(5);
    }

    return -1;
}

/* return TRUE if artifact object's invoke cost can be paid (and pay it) */
function arti_invoke_cost(obj) { /* boolean */
    if (obj.age > svm.moves) {
        let pw_cost = arti_invoke_cost_pw(obj);

        if (pw_cost < 0 || u.uen < pw_cost) {
            /* the artifact is tired :-) */
            You_feel(_("that %s %s ignoring you."), the(xname(obj)),
                     otense(obj, _("are")));
            /* and just got more so; patience is essential... */
            obj.age += d(3, 10);
            return FALSE;
        } else {
            /* you pay invoke cost with your own magic */
            You_feel(_("drained..."));
            u.uen -= pw_cost;
            disp.botl = TRUE;
        }
    } else {
        obj.age = svm.moves + rnz(100);
    }
    return TRUE;
}

function arti_invoke(obj$) { /* int */
    const $frame = stack_frame(); try {
    const obj = stack_var(ptr_to(struct_obj), obj$);
    let oart;
    let res = ECMD_OK;

    if (!obj[0]) {
        impossible(_("arti_invoke without obj"));
        return ECMD_OK;
    }
    oart = get_artifact(obj[0]);
    if (oart == artilist[ART_NONARTIFACT] || !oart.inv_prop) {
        if (obj[0].otyp == CRYSTAL_BALL)
            use_crystal_ball(obj);
        else
            pline1(nothing_happens());
        return ECMD_TIME;
    }

    /* It's a special power, not "just" a property */
    if (oart.inv_prop > LAST_PROP) {
        if (!arti_invoke_cost(obj[0]))
            return ECMD_TIME;

        switch (oart.inv_prop) {
        case TAMING: res = invoke_taming(obj[0]); break;
        case HEALING: res = invoke_healing(obj[0]); break;
        case ENERGY_BOOST: res = invoke_energy_boost(obj[0]); break;
        case UNTRAP: res = invoke_untrap(obj[0]); break;
        case CHARGE_OBJ: res = invoke_charge_obj(obj[0]); break;
        case LEV_TELE: level_tele(); res = ECMD_TIME; break;
        case CREATE_PORTAL: res = invoke_create_portal(obj[0]); break;
        case ENLIGHTENING:
            enlightenment(MAGICENLIGHTENMENT, ENL_GAMEINPROGRESS);
            res = ECMD_TIME;
            break;
        case CREATE_AMMO: res = invoke_create_ammo(obj[0]); break;
        case BANISH: res = invoke_banish(obj[0]); break;
        case FLING_POISON: res = invoke_fling_poison(obj[0]); break;
        case SNOWSTORM:
            /*FALLTHRU*/
        case FIRESTORM: res = invoke_storm_spell(obj[0]); break;
        case BLINDING_RAY: res = invoke_blinding_ray(obj[0]); break;
        default:
            impossible(_("Unknown invoke power %d."), oart.inv_prop);
            break;
        }
        return res;
    } else {
        let eprop = (u.uprops[oart.inv_prop].extrinsic = xor64(u.uprops[oart.inv_prop].extrinsic, W_ARTI)),
             iprop = u.uprops[oart.inv_prop].intrinsic;
        let on = +((eprop & W_ARTI) != 0); /* true if prop just set */

        if (on && obj[0].age > svm.moves) {
            /* the artifact is tired :-) */
            u.uprops[oart.inv_prop].extrinsic = xor64(u.uprops[oart.inv_prop].extrinsic, W_ARTI);
            You_feel(_("that %s %s ignoring you."), the(xname(obj[0])),
                     otense(obj[0], _("are")));
            /* can't just keep repeatedly trying */
            obj[0].age += d(3, 10);
            return ECMD_TIME;
        } else if (!on) {
            /* when turning off property, determine downtime */
            /* arbitrary for now until we can tune this -dlc */
            obj[0].age = svm.moves + rnz(100);
        }

        if ((eprop & ~W_ARTI) || iprop) {
            /* you had the property from some other source too */
            nothing_special(obj[0]);
            return ECMD_TIME;
        }
        switch (oart.inv_prop) {
        case CONFLICT:
            if (on)
                You_feel(_("like a rabble-rouser."));
            else
                You_feel(_("the tension decrease around you."));
            break;
        case LEVITATION:
            if (on) {
                float_up();
                spoteffects(FALSE);
            } else
                float_down(I_SPECIAL | TIMEOUT, W_ARTI);
            break;
        case INVIS:
            if (BInvis() || Blind()) {
                nothing_special(obj[0]);
                return ECMD_TIME;
            }
            newsym(u.ux, u.uy);
            if (on)
                Your(_("body takes on a %s transparency..."),
                     Hallucination() ? _("normal") : _("strange"));
            else
                Your(_("body seems to unfade..."));
            break;
        }
    }

    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

/* will freeing this object from inventory cause levitation to end? */
export function finesse_ahriman(obj) { /* boolean */
    const $frame = stack_frame(); try {
    let oart;
    let save_Lev = stack_struct(struct_prop);
    let result;

    /* if we aren't levitating or this isn't an artifact which confers
       levitation via #invoke then freeinv() won't toggle levitation */
    if (!Levitation()
        || (oart = get_artifact(obj)) == artilist[ART_NONARTIFACT]
        || oart.inv_prop != LEVITATION || !(ELevitation() & W_ARTI))
        return FALSE;

    /* arti_invoke(off) -> float_down() clears I_SPECIAL|TIMEOUT & W_ARTI;
       probe ahead to see whether that actually results in floating down;
       (this assumes that there aren't two simultaneously invoked artifacts
       both conferring levitation--safe, since if there were two of them,
       invoking the 2nd would negate the 1st rather than stack with it) */
    struct_assign(save_Lev, u.uprops[LEVITATION]);
    u.uprops[LEVITATION].intrinsic = and64(u.uprops[LEVITATION].intrinsic, ~(I_SPECIAL | TIMEOUT));
    u.uprops[LEVITATION].extrinsic = and64(u.uprops[LEVITATION].extrinsic, ~W_ARTI);
    result = (+!Levitation());
    struct_assign(u.uprops[LEVITATION], save_Lev);
    return result;
    } finally { stack_pop($frame); }
}

/* WAC return TRUE if artifact is always lit */
export function artifact_light(obj) { /* boolean */
    /* not artifacts but treat them as if they were because they emit
       light without burning */
    if (obj && (obj.otyp == GOLD_DRAGON_SCALE_MAIL
                || obj.otyp == GOLD_DRAGON_SCALES)
        && (obj.owornmask & W_ARM) != 0)
        return TRUE;

    return ((get_artifact(obj) != artilist[ART_NONARTIFACT])
                      && is_art(obj, ART_SUNSWORD) ? 1 : 0);
}

/* KMH -- Talking artifacts are finally implemented */
export function arti_speak(obj) { /* int */
    const $frame = stack_frame(); try {
    let oart = get_artifact(obj);
    let line;
    let buf = stack_array(char, BUFSZ);

    /* Is this a speaking artifact? */
    if (oart == artilist[ART_NONARTIFACT] || !(oart.spfx & SPFX_SPEAK))
        return ECMD_OK; /* nothing happened */

    line = getrumor(bcsign(obj), buf, TRUE);
    if (!chars[line])
        line = _("NetHack rumors file closed for renovation.");
    pline(_("%s:"), Tobjnam(obj, _("whisper")));
          ;
    verbalize1(line);
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

export function artifact_has_invprop(otmp, inv_prop) { /* boolean */
    let arti = get_artifact(otmp);

    return (+((arti != artilist[ART_NONARTIFACT])
                      && (arti.inv_prop == inv_prop)));
}

/* Return the price sold to the hero of a given artifact or unique item */
export function arti_cost(otmp) { /* long long */
    if (!otmp.oartifact)
        return (objects[otmp.otyp].oc_cost);
    else if (artilist[otmp.oartifact].cost)
        return artilist[otmp.oartifact].cost;
    else
        return (100 * (objects[otmp.otyp].oc_cost));
}

function abil_to_adtyp(abil) { /* uchar */
    const $frame = stack_frame(); try {
    const struct_abil2adtyp_tag = struct("abil_to_adtyp.struct_abil2adtyp_tag", {
        abil: ptr_to(long),
        adtyp: uchar,
    }); let abil2adtyp = stack_array(struct_abil2adtyp_tag, null, [
        { abil: ref_of(u.uprops[FIRE_RES], "extrinsic"), adtyp: AD_FIRE },
        { abil: ref_of(u.uprops[COLD_RES], "extrinsic"), adtyp: AD_COLD },
        { abil: ref_of(u.uprops[SHOCK_RES], "extrinsic"), adtyp: AD_ELEC },
        { abil: ref_of(u.uprops[ANTIMAGIC], "extrinsic"), adtyp: AD_MAGM },
        { abil: ref_of(u.uprops[DISINT_RES], "extrinsic"), adtyp: AD_DISN },
        { abil: ref_of(u.uprops[POISON_RES], "extrinsic"), adtyp: AD_DRST },
        { abil: ref_of(u.uprops[DRAIN_RES], "extrinsic"), adtyp: AD_DRLI },
    ]);
    let k;

    for (k = 0; k < SIZE(abil2adtyp); k++) {
        if ((addr_of(abil2adtyp[k].abil) == addr_of(abil)))
            return abil2adtyp[k].adtyp;
    }
    return 0;
    } finally { stack_pop($frame); }
}

function abil_to_spfx(abil) { /* unsigned long long */
    const struct_abil2spfx_tag = struct("abil_to_spfx.struct_abil2spfx_tag", {
        abil: ptr_to(long),
        spfx: ulong,
    }); let abil2spfx = static_array("abil_to_spfx.abil2spfx", struct_abil2spfx_tag, null, [
        { abil: ref_of(u.uprops[SEARCHING], "extrinsic"), spfx: SPFX_SEARCH },
        { abil: ref_of(u.uprops[HALLUC_RES], "extrinsic"), spfx: SPFX_HALRES },
        { abil: ref_of(u.uprops[TELEPAT], "extrinsic"), spfx: SPFX_ESP },
        { abil: ref_of(u.uprops[STEALTH], "extrinsic"), spfx: SPFX_STLTH },
        { abil: ref_of(u.uprops[REGENERATION], "extrinsic"), spfx: SPFX_REGEN },
        { abil: ref_of(u.uprops[TELEPORT_CONTROL], "extrinsic"), spfx: SPFX_TCTRL },
        { abil: ref_of(u.uprops[WARN_OF_MON], "extrinsic"), spfx: SPFX_WARN },
        { abil: ref_of(u.uprops[WARNING], "extrinsic"), spfx: SPFX_WARN },
        { abil: ref_of(u.uprops[ENERGY_REGENERATION], "extrinsic"), spfx: SPFX_EREGEN },
        { abil: ref_of(u.uprops[HALF_SPDAM], "extrinsic"), spfx: SPFX_HSPDAM },
        { abil: ref_of(u.uprops[HALF_PHDAM], "extrinsic"), spfx: SPFX_HPHDAM },
        { abil: ref_of(u.uprops[REFLECTING], "extrinsic"), spfx: SPFX_REFLECT },
    ]);
    let k;

    for (k = 0; k < SIZE(abil2spfx); k++) {
        if ((addr_of(abil2spfx[k].abil) == addr_of(abil)))
            return abil2spfx[k].spfx;
    }
    return 0;
}

/*
 * Return the first item that is conveying a particular intrinsic.
 */
export function what_gives(abil) { /* struct obj * */
    let obj;
    let dtyp;
    let spfx;
    let wornbits;
    let wornmask = (W_ARM | W_ARMC | W_ARMH | W_ARMS
                     | W_ARMG | W_ARMF | W_ARMU
                     | W_AMUL | W_RINGL | W_RINGR | W_TOOL
                     | W_ART | W_ARTI);

    if (u.twoweap)
        wornmask = or64(wornmask, W_SWAPWEP);
    dtyp = abil_to_adtyp(abil);
    spfx = abil_to_spfx(abil);
    wornbits = and64(wornmask, abil[0]);

    for (obj = gi.invent; obj; obj = obj.nobj) {
        if (obj.oartifact
            && ((addr_of(abil) != addr_of(ref_of(u.uprops[WARN_OF_MON], "extrinsic"))) || svc.context.warntype.obj)) {
            let art = get_artifact(obj);

            if (art != artilist[ART_NONARTIFACT]) {
                if (dtyp) {
                    if (art.cary.adtyp == dtyp /* carried */
                        || (art.defn.adtyp == dtyp /* defends while worn */
                            && (obj.owornmask & ~(W_ART | W_ARTI))))
                        return obj;
                }
                if (spfx) {
                    /* property conferred when carried */
                    if (and64u(art.cspfx, spfx) == spfx)
                        return obj;
                    /* property conferred when wielded or worn */
                    if (and64u(art.spfx, spfx) == spfx && obj.owornmask)
                        return obj;
                }
                if (obj == uwep && (addr_of(abil) == addr_of(ref_of(u.uprops[BLND_RES], "extrinsic")))
                    && (abil[0] & W_WEP) != 0) {
                    return obj; /* Sunsword */
                }
            }
        } else {
            if (wornbits && wornbits == and64(wornmask, obj.owornmask))
                return obj;
        }
    }
    return null;
}

export function glow_color(arti_indx) { /* const char * */
    let colornum = artilist[arti_indx].acolor;
    let colorstr = clr2colorname(colornum);

    return hcolor(colorstr);
}

/* glow verb; [0] holds the value used when blind */
const glow_verbs = static_array("glow_verbs", ptr_to(char), null, [
    _("quiver"), _("flicker"), _("glimmer"), _("gleam")
]);

/* relative strength that Sting is glowing (0..3), to select verb */
function glow_strength(count) { /* int */
    /* glow strength should also be proportional to proximity and
       probably difficulty, but we don't have that information and
       gathering it is more trouble than this would be worth */
    return (count > 12) ? 3 : (count > 4) ? 2 : +(count > 0);
}

export function glow_verb(count,
          ingsfx) { /* const char * */
    let resbuf = static_array("glow_verb.resbuf", char, 20);

    strcpy(resbuf, glow_verbs[glow_strength(count)]);
    /* ing_suffix() will double the last consonant for all the words
       we're using and none of them should have that, so bypass it */
    if (ingsfx)
        strcat(resbuf, _("ing"));
    return resbuf;
}

/* use for warning "glow" for Sting, Orcrist, and Grimtooth */
export function Sting_effects(
    orc_count) { /* void */ /* new count (warn_obj_cnt is old count); * -1 is a flag value */
    if (u_wield_art(ART_STING)
        || u_wield_art(ART_ORCRIST)
        || u_wield_art(ART_GRIMTOOTH)) {
        let oldstr = glow_strength(gw.warn_obj_cnt),
            newstr = glow_strength(orc_count);

        if (orc_count == -1 && gw.warn_obj_cnt > 0) {
            /* -1 means that blindness has just been toggled; give a
               'continue' message that eventual 'stop' message will match */
            pline(_("%s is %s."), bare_artifactname(uwep),
                  glow_verb(Blind() ? 0 : gw.warn_obj_cnt, TRUE));
        } else if (newstr > 0 && newstr != oldstr) {
            /* goto_level() -> docrt() -> see_monsters() -> Sting_effects();
               if "you materialize on a different level" is pending, give
               it now so that start-glowing message comes after it */
            maybe_lvltport_feedback(); /* usually called by goto_level() */

            /* 'start' message */
            if (!Blind())
                pline(_("%s %s %s%c"), bare_artifactname(uwep),
                      otense(uwep, glow_verb(orc_count, FALSE)),
                      glow_color(uwep.oartifact),
                      (newstr > oldstr) ? ord('!') : ord('.'));
            else if (oldstr == 0) /* quivers */
                pline(_("%s %s slightly."), bare_artifactname(uwep),
                      otense(uwep, glow_verb(0, FALSE)));
        } else if (orc_count == 0 && gw.warn_obj_cnt > 0) {
            /* 'stop' message */
            pline(_("%s stops %s."), bare_artifactname(uwep),
                  glow_verb(Blind() ? 0 : gw.warn_obj_cnt, TRUE));
        }
    }
}

/* called when hero is wielding/applying/invoking a carried item, or
   after undergoing a transformation (alignment change, lycanthropy,
   polymorph) which might affect item access */
export function retouch_object(
    objp,
    loseit) { /* int */ /* whether to drop it if hero can longer touch it */
    const $frame = stack_frame(); try {
    let obj = objp[0];

    /* allow hero in silver-hating form to try to perform invocation ritual */
    if (obj.otyp == BELL_OF_OPENING
        && invocation_pos(u.ux, u.uy) && !On_stairs(u.ux, u.uy)) {
        return 1;
    }

    if (touch_artifact(obj, gy.youmonst)) {
        let buf = stack_array(char, BUFSZ);
        let dmg = 0, tmp;
        let ag = (objects[obj.otyp].oc_material == SILVER && Hate_silver() ? 1 : 0),
                bane = bane_applies(get_artifact(obj), gy.youmonst);

        /* nothing else to do if hero can successfully handle this object */
        if (!ag && !bane)
            return 1;

        /* hero can't handle this object, but didn't get touch_artifact()'s
           "<obj> evades your grasp|control" message; give an alternate one */
        You_cant(_("handle %s%s!"), yname(obj),
                 obj.owornmask ? _(" anymore") : _(""));
        /* also inflict damage unless touch_artifact() already did so */
        if (!touch_blasted[0]) {
            let what = killer_xname(obj);

            if (ag && !obj.oartifact && !bane) {
                /* 'obj' is silver; for rings and wands it ended up that
                   way due to randomization at start of game; showing this
                   game's silver item without stating that it is silver
                   potentially leads to confusion about cause of death */
                if (obj.oclass == RING_CLASS)
                    what = _("a silver ring");
                else if (obj.oclass == WAND_CLASS)
                    what = _("a silver wand");
                /* for anything else, stick with killer_xname() */
            }
            /* damage is somewhat arbitrary; half the usual 1d20 physical
               for silver, 1d10 magical for <foo>bane, potentially both */
            if (ag)
                tmp = rnd(10), dmg += Maybe_Half_Phys(tmp);
            if (bane)
                dmg += rnd(10);
            sprintf(buf, _("handling %s"), what);
            losehp(dmg, buf, KILLED_BY);
            exercise(A_CON, FALSE);
        }
    }

    /* removing a worn item might result in loss of levitation,
       dropping the hero onto a polymorph trap or into water or
       lava and potentially dropping or destroying the item */
    if (obj.owornmask) {
        let otmp;

        remove_worn_item(obj, FALSE);
        for (otmp = gi.invent; otmp; otmp = otmp.nobj)
            if (otmp == obj)
                break;
        if (!otmp)
            objp[0] = obj = null;
    }

    /* if we still have it and caller wants us to drop it, do so now */
    if (loseit && obj) {
        if (Levitation()) {
            freeinv(obj);
            hitfloor(obj, TRUE);
        } else {
            /* dropx gives a message if a dropped item lands on an altar;
               we provide one for other terrain */
            if (!IS_ALTAR(levl()[u.ux][u.uy].typ))
                pline(_("%s to the %s."), Tobjnam(obj, _("fall")),
                      surface(u.ux, u.uy));
            dropx(obj);
        }
        objp[0] = obj = null; /* no longer in inventory */
    }
    return 0;
    } finally { stack_pop($frame); }
}

/* hero has changed form or alignment; an item which is worn/wielded
   or an artifact which conveys something via being carried or which
   has an #invoke effect currently in operation undergoes a touch test;
   if it fails, it will be unworn/unwielded and maybe dropped */
function untouchable(
    obj$,
    drop_untouchable) { /* boolean */ /* whether to drop it if it can't be touched */
    const $frame = stack_frame(); try {
    const obj = stack_var(ptr_to(struct_obj), obj$);
    let art;
    let beingworn, carryeffect, invoked;
    let wearmask = ~(W_QUIVER | (u.twoweap ? 0 : W_SWAPWEP) | W_BALL);

    beingworn = ((obj[0] /* never Null; this pacifies static analysis when
                      * the get_artifact() macro tests 'obj' for Null */
                 && ((obj[0].owornmask & wearmask) != 0
                     /* some items in use don't have any wornmask setting */
                     || (obj[0].oclass == TOOL_CLASS
                         && (obj[0].lamplit
                             || (obj[0].otyp == LEASH && obj[0].corpsenm)
                             || (Is_container(obj[0]) && Has_contents(obj[0]))))) ? 1 : 0));

    if ((art = get_artifact(obj[0])) != artilist[ART_NONARTIFACT]) {
        carryeffect = (art.cary.adtyp || art.cspfx ? 1 : 0);
        invoked = +(art.inv_prop > 0 && art.inv_prop <= LAST_PROP
                   && (u.uprops[art.inv_prop].extrinsic & W_ARTI) != 0);
    } else {
        carryeffect = invoked = FALSE;
    }

    if (beingworn || carryeffect || invoked) {
        if (!retouch_object(obj, drop_untouchable)) {
            /* "<artifact> is beyond your control" or "you can't handle
               <object>" has been given and it is now unworn/unwielded
               and possibly dropped (depending upon caller); if dropped,
               carried effect was turned off, else we leave that alone;
               we turn off invocation property here if still carried */
            if (invoked && obj[0])
                arti_invoke(obj[0]); /* reverse #invoke */
            return TRUE;
        }
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

/* check all items currently in use (mostly worn) for touchability */
export function retouch_equipment(
    dropflag) { /* void */ /* 0==don't drop, 1==drop all, 2==drop weapon */
    let nesting = static_var("retouch_equipment.nesting", int, 0); /* recursion control */
    let obj;
    let dropit, had_gloves = +(uarmg != null);
    let had_rings = (+!!uleft + +!!uright);

    /*
     * We can potentially be called recursively if losing/unwearing
     * an item causes worn helm of opposite alignment to come off or
     * be destroyed.
     *
     * BUG: if the initial call was due to putting on a helm of
     * opposite alignment and it does come off to trigger recursion,
     * after the inner call executes, the outer call will finish
     * using the non-helm alignment rather than the helm alignment
     * which triggered this in the first place.
     */
    if (!nesting[0]++)
        clear_bypasses(); /* init upon initial entry */

    dropit = +(dropflag > 0); /* drop all or drop weapon */
    /* check secondary weapon first, before possibly unwielding primary */
    if (u.twoweap) {
        bypass_obj(uswapwep); /* so loop below won't process it again */
        untouchable(uswapwep, dropit);
    }
    /* check primary weapon next so that they're handled together */
    if (uwep) {
        bypass_obj(uwep); /* so loop below won't process it again */
        untouchable(uwep, dropit);
    }

    /* in case someone is daft enough to add artifact or silver saddle */
    if (u.usteed && (obj = which_armor(u.usteed, W_SADDLE)) != null) {
        /* untouchable() calls retouch_object() which expects an object in
           hero's inventory, but remove_worn_item() will be harmless for
           saddle and we're suppressing drop, so this works as intended */
        if (untouchable(obj, FALSE))
            dismount_steed(DISMOUNT_THROWN);
    }
    /*
     * TODO?  Force off gloves if either or both rings are going to
     * become unworn; force off cloak [suit] before suit [shirt].
     * The torso handling is hypothetical; the case for gloves is
     * not, due to the possibility of unwearing silver rings.
     */

    dropit = +(dropflag == 1); /* all untouchable items */
    /* loss of levitation (silver ring, or Heart of Ahriman invocation)
       might cause hero to lose inventory items (by dropping into lava,
       for instance), so inventory traversal needs to rescan the whole
       gi.invent chain each time it moves on to another object; we use bypass
       handling to keep track of which items have already been processed */
    while ((obj = nxt_unbypassed_obj(gi.invent)) != null)
        untouchable(obj, dropit);

    if (had_rings != (+!!uleft + +!!uright) && uarmg && uarmg.cursed)
        uncurse(uarmg); /* temporary? hack for ring removal plausibility */
    if (had_gloves && !uarmg)
        selftouch(_("After losing your gloves, you"));

    if (!--nesting[0])
        clear_bypasses(); /* reset upon final exit */
}

function count_surround_traps(x, y) { /* int */
    let levp;
    let o;
    let dx, dy;
    let glyph, ret = 0;

    for (dx = x - 1; dx < x + 2; ++dx)
        for (dy = y - 1; dy < y + 2; ++dy) {
            if (!isok(dx, dy))
                continue;
            /* If a trap is shown here, don't count it; the hero
             * should be expecting it.  But if there is a trap here
             * that's not shown, either undiscovered or covered by
             * something, do count it.
             */
            glyph = glyph_at(dx, dy);
            if (glyph_is_trap(glyph))
                continue;
            if (t_at(dx, dy)) {
                ++ret;
                continue;
            }
            levp = levl()[dx][dy];
            if (IS_DOOR(levp.typ) && (levp.flags & D_TRAPPED) != 0) {
                ++ret;
                continue;
            }
            for (o = svl.level.objects[dx][dy]; o; o = o.v.v_nexthere)
                if (Is_container(o) && o.otrapped) {
                    ++ret; /* we're counting locations, so just */
                    break; /* count the first one in a pile     */
                }
        }
    /*
     * [Shouldn't we also check inventory for a trapped container?
     * Even if its trap has already been found, there's no 'tknown'
     * flag to help hero remember that so we have nothing comparable
     * to a shown glyph to justify skipping it.]
     */
    return ret;
}

/* sense adjacent traps if wielding MKoT without wearing gloves */
export function mkot_trap_warn() { /* void */
    let heat = static_array("mkot_trap_warn.heat", ptr_to(char), 7, [
        _("cool"), _("slightly warm"), _("warm"), _("very warm"),
        _("hot"), _("very hot"), _("like fire")
    ]);

    if (!uarmg && u_wield_art(ART_MASTER_KEY_OF_THIEVERY)) {
        let idx, ntraps = count_surround_traps(u.ux, u.uy);

        if (ntraps != gm.mkot_trap_warn_count) {
            idx = min(ntraps, SIZE(heat) - 1);
            pline_The(_("Key feels %s%c"), heat[idx], (ntraps > 3) ? ord('!') : ord('.'));
        }
        gm.mkot_trap_warn_count = ntraps;
    } else
        gm.mkot_trap_warn_count = 0;
}

/* Master Key is magic key if its bless/curse state meets our criteria:
   not cursed for rogues or blessed for non-rogues */
export function is_magic_key(mon,
             obj) { /* boolean */
    if (is_art(obj, ART_MASTER_KEY_OF_THIEVERY)) {
        if ((mon == gy.youmonst) ? Role_if(PM_ROGUE)
                                 : (mon && mon.data == mons[PM_ROGUE]))
            return +!obj.cursed; /* a rogue; non-cursed suffices for magic */
        /* not a rogue; key must be blessed to behave as a magic one */
        return obj.blessed;
    }
    return FALSE;
}

/* figure out whether 'mon' (usually youmonst) is carrying the magic key */
export function has_magic_key(mon) { /* struct obj * */ /* if null, hero assumed */
    let o;
    let key = artilist[ART_MASTER_KEY_OF_THIEVERY].otyp;

    if (!mon)
        mon = gy.youmonst;
    for (o = ((mon == gy.youmonst) ? gi.invent : mon.minvent); o;
         o = nxtobj(o, key, FALSE)) {
        if (is_magic_key(mon, o))
            return o;
    }
    return null;
}

/* #define is_art(o,art) ((o) && (o)->oartifact == (art)) */

export function is_art(obj, art) { /* boolean */
    if (obj && obj.oartifact == art)
        return TRUE;
    return FALSE;
}

/* #define get_artifact(o) \
    (((o) && ((o)->artifact > 0 && (o)->artifact < AFTER_LAST_ARTIFACT)) \
                             ? &artilist[(int) (o)->oartifact] \
                             : &artilist[ART_NONARTIFACT]) */

function get_artifact(obj) { /* struct artifact * */
    if (obj) {
        let artidx = obj.oartifact;

        /* skip 0, 1st artifact at 1 */
        /* SIZE(artilist) would include the terminator,
           so use AFTER_LAST_ARTIFACT instead */
        if (artidx > 0 && artidx < AFTER_LAST_ARTIFACT)
            return artilist[artidx];
    }
    return artilist[ART_NONARTIFACT];
}

/* is object permanently poisoned? (currently only Grimtooth) */
export function permapoisoned(obj) { /* boolean */
    return (obj && is_art(obj, ART_GRIMTOOTH) ? 1 : 0);
}

/*artifact.c*/

import { A_CHAOTIC, A_LAWFUL, A_NEUTRAL, A_NONE } from "./align.h.js";
import {
    BANISH, BLINDING_RAY, CHARGE_OBJ, CREATE_AMMO, CREATE_PORTAL, ENERGY_BOOST, ENLIGHTENING,
    FIRESTORM, FLING_POISON, HEALING, LEV_TELE, SNOWSTORM, SPFX_ATTK, SPFX_BEHEAD, SPFX_DALIGN,
    SPFX_DBONUS, SPFX_DCLAS, SPFX_DEFN, SPFX_DFLAG1, SPFX_DFLAG2, SPFX_DMONS, SPFX_DRLI,
    SPFX_EREGEN, SPFX_ESP, SPFX_HALRES, SPFX_HPHDAM, SPFX_HSPDAM, SPFX_INTEL, SPFX_LUCK, SPFX_NOGEN,
    SPFX_PROTECT, SPFX_REFLECT, SPFX_REGEN, SPFX_RESTR, SPFX_SEARCH, SPFX_SEEK, SPFX_SPEAK,
    SPFX_STLTH, SPFX_TCTRL, SPFX_WARN, SPFX_XRAY, TAMING, UNTRAP, struct_arti_info, struct_artifact,
} from "./artifact.h.js";
import {
    AFTER_LAST_ARTIFACT, ART_EXCALIBUR, ART_GRIMTOOTH, ART_MASTER_KEY_OF_THIEVERY, ART_NONARTIFACT,
    ART_ORCRIST, ART_STING, ART_STORMBRINGER, ART_SUNSWORD, ART_TSURUGI_OF_MURAMASA,
    ART_VORPAL_BLADE,
} from "./artilist.h.js";
import { A_CON, A_WIS } from "./attrib.h.js";
import { CLR_BRIGHT_BLUE, CLR_RED, NO_COLOR } from "./color.h.js";
import {
    NH_BLACK, Never_mind, fakename, nothing_happens, nothing_seems_to_happen,
} from "./decl.h.macros.js";
import {
    RING_CLASS, S_DRAGON, S_IMP, S_OGRE, S_TROLL, TOOL_CLASS, WAND_CLASS, WEAPON_CLASS,
} from "./defsym.h.js";
import { canspotmon, glyph_is_trap } from "./display.h.macros.js";
import { MIGR_RANDOM, struct_d_level } from "./dungeon.h.js";
import { In_endgame, Inhell } from "./dungeon.h.macros.js";
import { BUFSZ, FALSE, LL_ARTIFACT, TRUE } from "./global.h.js";
import { strcmpi } from "./global.h.macros.js";
import {
    DISMOUNT_THROWN, ECMD_CANCEL, ECMD_OK, ECMD_TIME, ENL_GAMEINPROGRESS, GETOBJ_ALLOWCNT,
    GETOBJ_EXCLUDE, GETOBJ_PROMPT, GETOBJ_SUGGEST, KILLED_BY, MAGICENLIGHTENMENT, NECK, NOTELL,
    NROFARTIFACTS, ONAME_BONES, ONAME_GIFT, ONAME_KNOW_ARTI, ONAME_LEVEL_DEF, ONAME_NO_FLAGS,
    ONAME_RANDOM, ONAME_VIA_DIP, ONAME_VIA_NAMING, ONAME_WISH,
} from "./hack.h.js";
import {
    Maybe_Half_Phys, ROLL_FROM, max, min, pline1, tutorial_dnum, verbalize1,
} from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { NO_ROOM } from "./mkroom.h.js";
import {
    AD_ACID, AD_BLND, AD_COLD, AD_DISE, AD_DISN, AD_DRLI, AD_DRST, AD_ELEC, AD_FIRE, AD_HALU,
    AD_MAGM, AD_PHYS, AD_PLYS, AD_SLEE, AD_SLOW, AD_STON, AD_STUN, AD_WERE, AT_MAGC,
} from "./monattk.h.js";
import {
    amorphous, bigmonst, has_head, is_covetous, is_demon, is_dlord, is_dprince, is_mplayer,
    noncorporeal, nonliving, race_hostile,
} from "./mondata.h.macros.js";
import { M2_DEMON, M2_ELF, M2_GIANT, M2_ORC, M2_UNDEAD, M2_WERE, MS_NEMESIS } from "./monflag.h.js";
import {
    DEADMONSTER, engulfing_u, ismnum, resists_cold, resists_elec, resists_fire, resists_poison,
    resists_ston,
} from "./monst.h.macros.js";
import {
    NON_PM, PM_ARCHEOLOGIST, PM_BARBARIAN, PM_CAVE_DWELLER, PM_CLAY_GOLEM, PM_CLERIC, PM_ELF,
    PM_GREMLIN, PM_HEALER, PM_JABBERWOCK, PM_KNIGHT, PM_MONK, PM_ORC, PM_RANGER, PM_ROGUE,
    PM_SAMURAI, PM_TOURIST, PM_VALKYRIE, PM_WATER_ELEMENTAL, PM_WIZARD,
} from "./monsters.h.js";
import { OBJ_CONTAINED, OBJ_FLOOR, OBJ_MINVENT, struct_obj } from "./obj.h.js";
import {
    Has_contents, Is_container, Is_dragon_armor, Is_dragon_mail, carried, u_wield_art,
} from "./obj.h.macros.js";
import { SILVER } from "./objclass.h.js";
import { OBJ_DESCR } from "./objclass.h.macros.js";
import {
    ACID_VENOM, AMULET_OF_ESP, ARROW, ATHAME, BATTLE_AXE, BELL_OF_OPENING, BLACK_DRAGON_SCALES,
    BLINDING_VENOM, BLUE_DRAGON_SCALES, BOW, BROADSWORD, CREDIT_CARD, CRYSTAL_BALL,
    ELVEN_BROADSWORD, ELVEN_DAGGER, FAKE_AMULET_OF_YENDOR, GOLD_DRAGON_SCALES,
    GOLD_DRAGON_SCALE_MAIL, GRAY_DRAGON_SCALES, GRAY_DRAGON_SCALE_MAIL, GREEN_DRAGON_SCALES,
    HELM_OF_BRILLIANCE, KATANA, LEASH, LENSES, LONG_SWORD, LUCKSTONE, MACE, MIRROR, MORNING_STAR,
    NUM_OBJECTS, ORANGE_DRAGON_SCALES, ORCISH_DAGGER, QUARTERSTAFF, RED_DRAGON_SCALES,
    RIN_INCREASE_DAMAGE, RUNESWORD, SCR_TAMING, SILVER_MACE, SILVER_SABER, SKELETON_KEY,
    SPE_CONE_OF_COLD, SPE_FIREBALL, STRANGE_OBJECT, TSURUGI, WAR_HAMMER, WHITE_DRAGON_SCALES,
    YELLOW_DRAGON_SCALES,
} from "./objects.h.js";
import {
    ANTIMAGIC, BLND_RES, COLD_RES, CONFLICT, DISINT_RES, DRAIN_RES, ENERGY_REGENERATION, FIRE_RES,
    HALF_PHDAM, HALF_SPDAM, HALLUC_RES, INVIS, I_SPECIAL, LAST_PROP, LEVITATION, POISON_RES,
    PROTECTION, REFLECTING, REGENERATION, SEARCHING, SHOCK_RES, STEALTH, TELEPAT, TELEPORT_CONTROL,
    TIMEOUT, WARNING, WARN_OF_MON, W_AMUL, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU,
    W_ART, W_ARTI, W_BALL, W_QUIVER, W_RINGL, W_RINGR, W_SADDLE, W_SWAPWEP, W_TOOL, W_WEP,
    struct_prop,
} from "./prop.h.js";
import { D_TRAPPED } from "./rm.h.js";
import { IS_ALTAR, IS_DOOR, fmon, levl } from "./rm.h.macros.js";
import { Sfi_arti_info, Sfi_short, Sfo_arti_info, Sfo_xint16 } from "./savefile.h.macros.js";
import { P_BASIC, P_EXPERT, P_SKILLED } from "./skills.h.js";
import { P_MAX_SKILL, P_SKILL } from "./skills.h.macros.js";
import { SPELL_LEV_PW } from "./spell.h.macros.js";
import { cansee, couldsee } from "./vision.h.macros.js";
import {
    create_nhwindow, destroy_nhwindow, end_menu, putstr, start_menu,
} from "./winprocs.h.macros.js";
import {
    ATR_NONE, MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, NHW_MENU, PICK_ONE, WIN_ERR, struct_any,
    struct_mi,
} from "./wintype.h.js";
import { SICK_ALL } from "./you.h.js";
import { Race_if, Role_if, Role_switch, Upolyd } from "./you.h.macros.js";
import {
    Antimagic, BInvis, Blind, Blinded, BlindedTimeout, Cold_resistance, Drain_resistance,
    ELevitation, Fire_resistance, HBlinded, HConfusion, HStun, Hallucination, Hate_silver,
    Levitation, Poison_resistance, Shock_resistance, Sick, Slimed, Stone_resistance,
} from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import {
    char, int, long, ord, schar, short, sizeof, sizeof_string, uchar, ulong, unsigned,
} from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64, and64u, not64, not64u, or64, or64u, xor64 } from "../rt/int64.js";
import { abs, assert, free, memset, sprintf, strcat, strcmp, strcpy } from "../rt/libc.js";
import {
    init_list, init_string, stack_array, stack_struct, stack_var, static_array, static_struct,
    static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, ptr_add, ptr_diff, ptr_to, ref_of, struct, struct_assign,
} from "../rt/struct.js";
import { do_blinding_ray, next_to_u } from "./apply.js";
import { exercise } from "./attrib.js";
import { getdir, isok } from "./cmd.js";
import { clr2colorname } from "./coloratt.js";
import {
    cg, disp, flags, gi, gm, gn, gs, gu, gv, gw, gy, iflags, program_state, svb, svc, svd, svl, svm,
    svn, svq, u,
} from "./decl.js";
import { use_crystal_ball } from "./detect.js";
import {
    glyph_at, map_invisible, newsym, nul_glyphinfo, see_monsters, shieldeff,
} from "./display.js";
import { dropx, goto_level, maybe_lvltport_feedback } from "./do.js";
import { Monnam, hcolor, mon_nam, oname } from "./do_name.js";
import { hitfloor, throwit } from "./dothrow.js";
import { In_quest, depth, dunlevs_in_dungeon, find_hell, ledger_no, surface } from "./dungeon.js";
import { losexp } from "./exper.js";
import { invocation_pos, losehp, nomul, spoteffects } from "./hack.js";
import { eos, fuzzymatch, s_suffix, sgn, strncmpi, upstart } from "./hacklib.js";
import { align_str, enlightenment } from "./insight.js";
import { freeinv, getobj, hold_another_object, nxtobj, update_inventory } from "./invent.js";
import { monhp_per_lvl } from "./makemon.js";
import { bcsign, mksobj, obj_extract_self, uncurse, weight } from "./mkobj.js";
import { healmon, migrate_mon, set_ustuck, wake_nearto } from "./mon.js";
import { attacktype, defended, resists_drli, sticks } from "./mondata.js";
import { monflee } from "./monmove.js";
import { mons } from "./monst.js";
import { obj_shuffle_range, observe_object } from "./o_init.js";
import { objects } from "./objects.js";
import {
    The, Tobjnam, aobjnam, bare_artifactname, distant_name, killer_xname, otense, simple_typename,
    the, vtense, xname, yname,
} from "./objnam.js";
import {
    You, You_cant, You_feel, Your, impossible, livelog_printf, pline, pline_The,
} from "./pline.js";
import { body_part, mbodypart } from "./polyself.js";
import {
    healup, make_blinded, make_confused, make_hallucinated, make_sick, make_slimed, make_stunned,
} from "./potion.js";
import { mon_aligntyp } from "./priest.js";
import { charge_ok, litroom, recharge, seffects } from "./read.js";
import { d, rn2, rnd, rnz } from "./rnd.js";
import { aligns } from "./role.js";
import { getrumor } from "./rumors.js";
import { inside_shop, obfree } from "./shk.js";
import { spell_skilltype, spelleffects } from "./spell.js";
import { On_stairs } from "./stairs.js";
import { remove_worn_item } from "./steal.js";
import { dismount_steed } from "./steed.js";
import { level_tele, u_teleport_mon } from "./teleport.js";
import { burn_away_slime } from "./timeout.js";
import { float_down, float_up, ignite_items, selftouch, t_at, untrap } from "./trap.js";
import { add_menu, select_menu } from "./windows.js";
import {
    bypass_obj, clear_bypasses, nxt_unbypassed_obj, recalc_telepat_range, which_armor,
} from "./worn.js";
import {
    cancel_monst, destroy_items, flashburn, lightdamage, probe_monster, resist,
} from "./zap.js";

// defined by artilist.h (included above; at the line shown)
// artilist.h:49
const artilist = static_array("artilist", struct_artifact, null, [

    /* Artifact cost rationale:
     * 1.  The more useful the artifact, the better its cost.
     * 2.  Quest artifacts are highly valued.
     * 3.  Chaotic artifacts are inflated due to scarcity (and balance).
     *
     * Artifact gen_spe rationale:
     * 1.  If the artifact is useful against most enemies, +0.
     * 2.  If the artifact is useful against only a few enemies, usually +2.
     *     This gives the artifact use to early-game characters who receive
     *     it as a gift or find it on the ground.
     * 3.  Role gift gen_spe is chosen to balance against the role's
     *     default starting weapon (it should be better, but need not be
     *     much better).
     * 4.  This can be modified as required for special cases.
     *     (In some cases, like Excalibur, the value is irrelevant.)
     * 5.  Nonweapon spe may have a special meaning, so gen_spe for
     *     nonweapons must always be 0.
     *
     * Artifact gift_value is chosen so that "endgame-quality" artifacts are
     * not gifted in the early game (so that characters don't grind on an
     * altar early-game until they have their endgame weapon, then use it to
     * carry them through the game).  Those artifacts have values ranging from
     * around 8 to 10, based on how good the artifact is.  Less powerful
     * artifacts have values in the 1 to 5 range.  Values in between are used
     * for conditionally good artifacts.  (Note that the value of a gift is
     * normally 1 higher than the difficulty of the monster.)
     */

    /*  dummy element #0, so that all interesting indices are non-zero */
    { otyp: STRANGE_OBJECT, name: _(""), alignment: A_NONE,
      role: NON_PM, race: NON_PM,
      acolor: NO_COLOR },

    { otyp: LONG_SWORD, name: _("Excalibur"), spfx: (SPFX_NOGEN | SPFX_RESTR | SPFX_SEEK
                                | SPFX_DEFN | SPFX_INTEL | SPFX_SEARCH),
      attk: { adtyp: AD_PHYS,
      damn: 5, damd: 10 }, defn: { adtyp: AD_DRLI }, alignment: A_LAWFUL, role: PM_KNIGHT, race: NON_PM,
      gift_value: 10, cost: 4000, acolor: NO_COLOR },
    /*
     *      Stormbringer only has a 2 because it can drain a level,
     *      providing 8 more.
     */
    { otyp: RUNESWORD, name: _("Stormbringer"),
      spfx: (SPFX_RESTR | SPFX_ATTK | SPFX_DEFN | SPFX_INTEL | SPFX_DRLI),
      attk: { adtyp: AD_DRLI,
      damn: 5, damd: 2 }, defn: { adtyp: AD_DRLI }, alignment: A_CHAOTIC, role: NON_PM, race: NON_PM,
      gift_value: 9, cost: 8000, acolor: NO_COLOR },
    /*
     *      Mjollnir can be thrown when wielded if hero has 25 Strength
     *      (usually via gauntlets of power but possible with rings of
     *      gain strength).  If the thrower is a Valkyrie, Mjollnir will
     *      usually (99%) return and then usually (separate 99%) be caught
     *      and automatically be re-wielded.  When returning Mjollnir is
     *      not caught, there is a 50:50 chance of hitting hero for damage
     *      and its lightning shock might destroy some wands and/or rings.
     *
     *      Monsters don't throw Mjollnir regardless of strength (not even
     *      fake-player valkyries).
     */
    { otyp: WAR_HAMMER, name: _("Mjollnir"),
      spfx: (SPFX_RESTR | SPFX_ATTK), attk: { adtyp: AD_ELEC,
      damn: 5, damd: 24 },
      alignment: A_NEUTRAL, role: PM_VALKYRIE, race: NON_PM,
      gift_value: 8, cost: 4000, acolor: NO_COLOR },

    { otyp: BATTLE_AXE, name: _("Cleaver"), spfx: SPFX_RESTR, attk: { adtyp: AD_PHYS, damn: 3, damd: 6 },
      alignment: A_NEUTRAL, role: PM_BARBARIAN, race: NON_PM,
      gift_value: 8, cost: 1500, acolor: NO_COLOR },

    /*
     *      Grimtooth glows in warning when elves are present, but its
     *      damage bonus applies to all targets rather than just elves
     *      (handled as special case in spec_dbon()).
     */
    { otyp: ORCISH_DAGGER, name: _("Grimtooth"), spfx: (SPFX_RESTR | SPFX_WARN | SPFX_DFLAG2),
      mtype: M2_ELF, attk: { adtyp: AD_PHYS,
      damn: 2, damd: 6 }, defn: { adtyp: AD_DRST },
      inv_prop: FLING_POISON, alignment: A_CHAOTIC, role: NON_PM, race: PM_ORC,
      gift_value: 5, cost: 1200, acolor: CLR_RED },
    /*
     *      Orcrist and Sting have same alignment as elves.
     *
     *      The combination of SPFX_WARN+SPFX_DFLAG2+M2_value will trigger
     *      EWarn_of_mon for all monsters that have the M2_value flag.
     *      Sting and Orcrist will warn of M2_ORC monsters.
     */
    { otyp: ELVEN_BROADSWORD, name: _("Orcrist"), spfx: (SPFX_WARN | SPFX_DFLAG2), mtype: M2_ORC,
      attk: { adtyp: AD_PHYS,
      damn: 5 }, alignment: A_CHAOTIC, role: NON_PM, race: PM_ELF,
      gen_spe: 3, gift_value: 4, cost: 2000, acolor: CLR_BRIGHT_BLUE }, /* actually light blue */

    { otyp: ELVEN_DAGGER, name: _("Sting"), spfx: (SPFX_WARN | SPFX_DFLAG2), mtype: M2_ORC,
      attk: { adtyp: AD_PHYS,
      damn: 5 }, alignment: A_CHAOTIC, role: NON_PM, race: PM_ELF,
      gen_spe: 3, gift_value: 1, cost: 800, acolor: CLR_BRIGHT_BLUE },
    /*
     *      Magicbane is a bit different!  Its magic fanfare
     *      unbalances victims in addition to doing some damage.
     */
    { otyp: ATHAME, name: _("Magicbane"), spfx: (SPFX_RESTR | SPFX_ATTK | SPFX_DEFN),
      attk: { adtyp: AD_STUN,
      damn: 3, damd: 4 }, defn: { adtyp: AD_MAGM }, alignment: A_NEUTRAL, role: PM_WIZARD, race: NON_PM,
      gift_value: 7, cost: 3500, acolor: NO_COLOR },

    { otyp: LONG_SWORD, name: _("Frost Brand"), spfx: (SPFX_RESTR | SPFX_ATTK | SPFX_DEFN),
      attk: { adtyp: AD_COLD,
      damn: 5 }, defn: { adtyp: AD_COLD }, inv_prop: SNOWSTORM, alignment: A_NONE, role: NON_PM, race: NON_PM,
      gift_value: 9, cost: 3000, acolor: NO_COLOR },

    { otyp: LONG_SWORD, name: _("Fire Brand"), spfx: (SPFX_RESTR | SPFX_ATTK | SPFX_DEFN),
      attk: { adtyp: AD_FIRE,
      damn: 5 }, defn: { adtyp: AD_FIRE }, inv_prop: FIRESTORM, alignment: A_NONE, role: NON_PM, race: NON_PM,
      gift_value: 5, cost: 3000, acolor: NO_COLOR },

    { otyp: BROADSWORD, name: _("Dragonbane"),
      spfx: (SPFX_RESTR | SPFX_DCLAS | SPFX_REFLECT), mtype: S_DRAGON,
      attk: { adtyp: AD_PHYS,
      damn: 5 }, alignment: A_NONE, role: NON_PM, race: NON_PM,
      gen_spe: 2, gift_value: 5, cost: 500, acolor: NO_COLOR },

    { otyp: SILVER_MACE, name: _("Demonbane"), spfx: (SPFX_RESTR | SPFX_DFLAG2), mtype: M2_DEMON,
      attk: { adtyp: AD_PHYS,
      damn: 5 }, inv_prop: BANISH, alignment: A_LAWFUL, role: PM_CLERIC, race: NON_PM,
      gen_spe: 1, gift_value: 3, cost: 2500, acolor: NO_COLOR },

    { otyp: SILVER_SABER, name: _("Werebane"), spfx: (SPFX_RESTR | SPFX_DFLAG2), mtype: M2_WERE,
      attk: { adtyp: AD_PHYS,
      damn: 5 }, defn: { adtyp: AD_WERE }, alignment: A_NONE, role: NON_PM, race: NON_PM,
      gen_spe: 1, gift_value: 4, cost: 1500, acolor: NO_COLOR },

    { otyp: SILVER_SABER, name: _("Grayswandir"), spfx: (SPFX_RESTR | SPFX_HALRES),
      attk: { adtyp: AD_PHYS,
      damn: 5 }, alignment: A_LAWFUL, role: NON_PM, race: NON_PM,
      gift_value: 10, cost: 8000, acolor: NO_COLOR },

    { otyp: LONG_SWORD, name: _("Giantslayer"), spfx: (SPFX_RESTR | SPFX_DFLAG2), mtype: M2_GIANT,
      attk: { adtyp: AD_PHYS,
      damn: 5 }, alignment: A_NEUTRAL, role: NON_PM, race: NON_PM,
      gen_spe: 2, gift_value: 4, cost: 200, acolor: NO_COLOR },

    { otyp: WAR_HAMMER, name: _("Ogresmasher"), spfx: (SPFX_RESTR | SPFX_DCLAS), mtype: S_OGRE,
      attk: { adtyp: AD_PHYS,
      damn: 5 }, alignment: A_NONE, role: NON_PM, race: NON_PM,
      gen_spe: 2, gift_value: 1, cost: 200, acolor: NO_COLOR },

    { otyp: MORNING_STAR, name: _("Trollsbane"), spfx: (SPFX_RESTR | SPFX_DCLAS | SPFX_REGEN),
      mtype: S_TROLL, attk: { adtyp: AD_PHYS,
      damn: 5 }, alignment: A_NONE, role: NON_PM, race: NON_PM,
      gen_spe: 2, gift_value: 1, cost: 200, acolor: NO_COLOR },

    /*
     *      Two problems:  1) doesn't let trolls regenerate heads,
     *      2) doesn't give unusual message for 2-headed monsters (but
     *      allowing those at all causes more problems than worth the effort).
     */
    { otyp: LONG_SWORD, name: _("Vorpal Blade"), spfx: (SPFX_RESTR | SPFX_BEHEAD),
      attk: { adtyp: AD_PHYS,
      damn: 5, damd: 1 }, alignment: A_NEUTRAL, role: NON_PM, race: NON_PM,
      gen_spe: 1, gift_value: 5, cost: 4000, acolor: NO_COLOR },

    /*
     *      Ah, never shall I forget the cry,
     *              or the shriek that shrieked he,
     *      As I gnashed my teeth, and from my sheath
     *              I drew my Snickersnee!
     *                      --Ko-Ko, Lord high executioner of Titipu
     *                        (From Sir W.S. Gilbert's "The Mikado")
     */
    { otyp: KATANA, name: _("Snickersnee"), spfx: SPFX_RESTR, attk: { adtyp: AD_PHYS, damd: 8 },
      alignment: A_LAWFUL, role: PM_SAMURAI, race: NON_PM,
      gift_value: 8, cost: 1200, acolor: NO_COLOR },

    /* Sunsword emits light when wielded (handled in the core rather than
       via artifact fields), but that light has no particular color */
    { otyp: LONG_SWORD, name: _("Sunsword"), spfx: (SPFX_RESTR | SPFX_DFLAG2), mtype: M2_UNDEAD,
      attk: { adtyp: AD_PHYS,
      damn: 5 }, defn: { adtyp: AD_BLND }, inv_prop: BLINDING_RAY, alignment: A_LAWFUL, role: NON_PM,
      race: NON_PM,
      gift_value: 6, cost: 1500, acolor: NO_COLOR },

    /*
     *      The artifacts for the quest dungeon, all self-willed.
     *      gen_spe should be 0; gift_value irrelevant and set to 12.
     */

    { otyp: CRYSTAL_BALL, name: _("The Orb of Detection"),
      spfx: (SPFX_NOGEN | SPFX_RESTR | SPFX_INTEL), cspfx: (SPFX_ESP | SPFX_HSPDAM),
      cary: { adtyp: AD_MAGM }, inv_prop: INVIS, alignment: A_LAWFUL, role: PM_ARCHEOLOGIST,
      race: NON_PM,
      gift_value: 12, cost: 2500, acolor: NO_COLOR },

    { otyp: LUCKSTONE, name: _("The Heart of Ahriman"),
      spfx: (SPFX_NOGEN | SPFX_RESTR | SPFX_INTEL), cspfx: SPFX_STLTH,
      attk: { adtyp: AD_PHYS,
      damn: 5 }, inv_prop: LEVITATION, alignment: A_NEUTRAL, role: PM_BARBARIAN,
      race: NON_PM,
      gift_value: 12, cost: 2500, acolor: NO_COLOR },

    { otyp: MACE, name: _("The Sceptre of Might"),
      spfx: (SPFX_NOGEN | SPFX_RESTR | SPFX_INTEL | SPFX_DALIGN), attk: { adtyp: AD_PHYS,
      damn: 5 },
      defn: { adtyp: AD_MAGM }, inv_prop: CONFLICT, alignment: A_LAWFUL, role: PM_CAVE_DWELLER, race: NON_PM,
      gift_value: 12, cost: 2500, acolor: NO_COLOR },

    { otyp: QUARTERSTAFF, name: _("The Staff of Aesculapius"),
      spfx: (SPFX_NOGEN | SPFX_RESTR | SPFX_ATTK | SPFX_INTEL | SPFX_DRLI
       | SPFX_REGEN),
      attk: { adtyp: AD_DRLI }, defn: { adtyp: AD_DRLI }, inv_prop: HEALING, alignment: A_NEUTRAL, role: PM_HEALER,
      race: NON_PM,
      gift_value: 12, cost: 5000, acolor: NO_COLOR },

    { otyp: MIRROR, name: _("The Magic Mirror of Merlin"),
      spfx: (SPFX_NOGEN | SPFX_RESTR | SPFX_INTEL | SPFX_SPEAK), cspfx: SPFX_ESP,
      cary: { adtyp: AD_MAGM }, alignment: A_LAWFUL, role: PM_KNIGHT, race: NON_PM,
      gift_value: 12, cost: 1500, acolor: NO_COLOR },

    { otyp: LENSES, name: _("The Eyes of the Overworld"),
      spfx: (SPFX_NOGEN | SPFX_RESTR | SPFX_INTEL | SPFX_XRAY),
      defn: { adtyp: AD_MAGM }, inv_prop: ENLIGHTENING, alignment: A_NEUTRAL, role: PM_MONK, race: NON_PM,
      gift_value: 12, cost: 2500, acolor: NO_COLOR },

    { otyp: HELM_OF_BRILLIANCE, name: _("The Mitre of Holiness"),
      spfx: (SPFX_NOGEN | SPFX_RESTR | SPFX_DFLAG2 | SPFX_INTEL | SPFX_PROTECT),
      mtype: M2_UNDEAD, cary: { adtyp: AD_FIRE }, inv_prop: ENERGY_BOOST, alignment: A_LAWFUL,
      role: PM_CLERIC, race: NON_PM,
      gift_value: 12, cost: 2000, acolor: NO_COLOR },

    { otyp: BOW, name: _("The Longbow of Diana"),
      spfx: (SPFX_NOGEN | SPFX_RESTR | SPFX_INTEL | SPFX_REFLECT), cspfx: SPFX_ESP,
      attk: { adtyp: AD_PHYS,
      damn: 5 }, inv_prop: CREATE_AMMO, alignment: A_CHAOTIC, role: PM_RANGER, race: NON_PM,
      gift_value: 12, cost: 4000, acolor: NO_COLOR },

    /* MKoT has an additional carry property if the Key is not cursed (for
       rogues) or blessed (for non-rogues):  #untrap of doors and chests
       will always find any traps and disarming those will always succeed */
    { otyp: SKELETON_KEY, name: _("The Master Key of Thievery"),
      spfx: (SPFX_NOGEN | SPFX_RESTR | SPFX_INTEL | SPFX_SPEAK),
      cspfx: (SPFX_WARN | SPFX_TCTRL | SPFX_HPHDAM),
      inv_prop: UNTRAP, alignment: A_CHAOTIC, role: PM_ROGUE, race: NON_PM,
      gift_value: 12, cost: 3500, acolor: NO_COLOR },

    { otyp: TSURUGI, name: _("The Tsurugi of Muramasa"),
      spfx: (SPFX_NOGEN | SPFX_RESTR | SPFX_INTEL | SPFX_BEHEAD | SPFX_LUCK
       | SPFX_PROTECT),
      attk: { adtyp: AD_PHYS,
      damd: 8 }, alignment: A_LAWFUL, role: PM_SAMURAI, race: NON_PM,
      gift_value: 12, cost: 4500, acolor: NO_COLOR },

    { otyp: CREDIT_CARD, name: _("The Platinum Yendorian Express Card"),
      spfx: (SPFX_NOGEN | SPFX_RESTR | SPFX_INTEL | SPFX_DEFN),
      cspfx: (SPFX_ESP | SPFX_HSPDAM), cary: { adtyp: AD_MAGM },
      inv_prop: CHARGE_OBJ, alignment: A_NEUTRAL, role: PM_TOURIST, race: NON_PM,
      gift_value: 12, cost: 7000, acolor: NO_COLOR },

    { otyp: CRYSTAL_BALL, name: _("The Orb of Fate"),
      spfx: (SPFX_NOGEN | SPFX_RESTR | SPFX_INTEL | SPFX_LUCK),
      cspfx: (SPFX_WARN | SPFX_HSPDAM | SPFX_HPHDAM),
      inv_prop: LEV_TELE, alignment: A_NEUTRAL, role: PM_VALKYRIE, race: NON_PM,
      gift_value: 12, cost: 3500, acolor: NO_COLOR },

    { otyp: AMULET_OF_ESP, name: _("The Eye of the Aethiopica"),
      spfx: (SPFX_NOGEN | SPFX_RESTR | SPFX_INTEL), cspfx: (SPFX_EREGEN | SPFX_HSPDAM),
      defn: { adtyp: AD_MAGM }, inv_prop: CREATE_PORTAL, alignment: A_NEUTRAL, role: PM_WIZARD,
      race: NON_PM,
      gift_value: 12, cost: 4000, acolor: NO_COLOR },

{ alignment: A_NONE, role: NON_PM, race: NON_PM,
      acolor: NO_COLOR }

]);
