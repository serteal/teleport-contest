/* NetHack 5.0	minion.c	$NHDT-Date: 1762727599 2025/11/09 14:33:19 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.81 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2008. */
/* NetHack may be freely redistributed.  See license for details. */

/* used to pick among the four basic elementals without worrying whether
   they've been reordered (difficulty reassessment?) or any new ones have
   been introduced (hybrid types added to 'E'-class?) */
const elementals = static_array("elementals", int, 4, [
    PM_AIR_ELEMENTAL, PM_FIRE_ELEMENTAL,
    PM_EARTH_ELEMENTAL, PM_WATER_ELEMENTAL
]);

export function newemin(mtmp) { /* void */
    if (!mtmp.mextra)
        mtmp.mextra = newmextra();
    if (!EMIN(mtmp)) {
        ((mtmp).mextra.emin) = view_of(struct_emin, addr_of(alloc(sizeof(struct_emin))));
        memset(addr_of(EMIN(mtmp)), 0, sizeof(struct_emin));
        EMIN(mtmp).parentmid = mtmp.m_id;
    }
}

export function free_emin(mtmp) { /* void */
    if (mtmp.mextra && EMIN(mtmp)) {
        free(addr_of(EMIN(mtmp)));
        ((mtmp).mextra.emin) = null;
    }
    mtmp.isminion = 0;
}

/* count the number of monsters on the level */
export function monster_census(spotted) { /* int */ /* seen|sensed vs all */
    let mtmp;
    let count = 0;

    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (DEADMONSTER(mtmp))
            continue;
        if (mtmp.isgd && mtmp.mx == 0)
            continue;
        if (spotted && !canspotmon(mtmp))
            continue;
        ++count;
    }
    return count;
}

/* mon summons a monster */
export function msummon(mon) { /* int */
    const $frame = stack_frame(); try {
    let ptr;
    let dtype = NON_PM, cnt = 0, result = 0, census;
    let xlight;
    let atyp;
    let mtmp;

    if (mon) {
        ptr = mon.data;

        if (u_wield_art(ART_DEMONBANE) && is_demon(ptr)) {
            if (canseemon(mon))
                pline(_("%s looks puzzled for a moment."), Monnam(mon));
            return 0;
        }

        atyp = mon.ispriest ? EPRI(mon).shralign
               : mon.isminion ? EMIN(mon).min_align
                 : (ptr.maligntyp == A_NONE) ? A_NONE
                   : sgn(ptr.maligntyp);
    } else {
        ptr = mons[PM_WIZARD_OF_YENDOR];
        atyp = (ptr.maligntyp == A_NONE) ? A_NONE : sgn(ptr.maligntyp);
    }

    if (is_dprince(ptr) || (ptr == mons[PM_WIZARD_OF_YENDOR])) {
        dtype = (!rn2(20)) ? dprince(atyp) : (!rn2(4)) ? dlord(atyp)
                                                       : ndemon(atyp);
        cnt = ((dtype != NON_PM)
               && !rn2(4) && is_ndemon(mons[dtype])) ? 2 : 1;
    } else if (is_dlord(ptr)) {
        dtype = (!rn2(50)) ? dprince(atyp) : (!rn2(20)) ? dlord(atyp)
                                                        : ndemon(atyp);
        cnt = ((dtype != NON_PM)
               && !rn2(4) && is_ndemon(mons[dtype])) ? 2 : 1;
    } else if (ptr == mons[PM_BONE_DEVIL]) {
        dtype = PM_SKELETON;
        cnt = 1;
    } else if (is_ndemon(ptr)) {
        dtype = (!rn2(20)) ? dlord(atyp) : (!rn2(6)) ? ndemon(atyp)
                                                     : monsndx(ptr);
        cnt = 1;
    } else if (is_lminion(mon)) {
        dtype = (is_lord(ptr) && !rn2(20))
                    ? llord()
                    : (is_lord(ptr) || !rn2(6)) ? lminion() : monsndx(ptr);
        cnt = ((dtype != NON_PM)
               && !rn2(4) && !is_lord(mons[dtype])) ? 2 : 1;
    } else if (ptr == mons[PM_ANGEL]) {
        /* non-lawful angels can also summon */
        if (!rn2(6)) {
            switch (atyp) { /* see summon_minion */
            case A_NEUTRAL:
                dtype = ROLL_FROM(elementals);
                break;
            case A_CHAOTIC:
            case A_NONE:
                dtype = ndemon(atyp);
                break;
            }
        } else {
            dtype = PM_ANGEL;
        }
        cnt = ((dtype != NON_PM)
               && !rn2(4) && !is_lord(mons[dtype])) ? 2 : 1;
    }

    if (dtype == NON_PM)
        return 0;

    /* sanity checks */
    if (cnt > 1 && (mons[dtype].geno & G_UNIQ) != 0)
        cnt = 1;
    /*
     * If this daemon is unique and being re-summoned (the only way we
     * could get this far with an extinct dtype), try another.
     */
    if ((svm.mvitals[dtype].mvflags & G_GONE) != 0) {
        dtype = ndemon(atyp);
        if (dtype == NON_PM)
            return 0;
    }

    /* some candidates can generate a group of monsters, so simple
       count of non-null makemon() result is not sufficient */
    census = monster_census(FALSE);
    xlight = FALSE;

    while (cnt > 0) {
        mtmp = makemon(mons[dtype], u.ux, u.uy, MM_EMIN|MM_NOMSG);
        if (mtmp) {
            result++;
            /* an angel's alignment should match the summoner */
            if (dtype == PM_ANGEL) {
                mtmp.isminion = 1;
                EMIN(mtmp).min_align = atyp;
                /* renegade if same alignment but not peaceful
                   or peaceful but different alignment */
                EMIN(mtmp).renegade =
                    +(atyp != u.ualign.type) ^ +!mtmp.mpeaceful;
            }

            if (mtmp.data.mlet == S_ANGEL && !Blind()) {
                /* for any 'A', 'cloud of smoke' will be 'flash of light';
                   if more than one monster is being created, that message
                   might be skipped for this monster but show 'mtmp' anyway */
                show_transient_light(null, mtmp.mx, mtmp.my);
                xlight = TRUE;
                /* we don't do this for 'burst of flame' (fire elemental)
                   because those monsters become their own light source */
            }

            if (cnt == 1 && canseemon(mtmp)) {
                let cloud = stack_var(ptr_to(char), 0),
                           what = msummon_environ(mtmp.data, cloud);

                pline(_("%s appears in a %s of %s!"), Amonnam(mtmp),
                      cloud[0], what);
            }
        }
        cnt--;
    }

    if (xlight) {
        /* Note: if we forced --More-- here, the 'A's would be visible for
           long enough to be seen, but like with clairvoyance, some players
           would be annoyed at the disruption of having to acknowledge it */
        transient_light_cleanup();
    }

    /* how many monsters exist now compared to before? */
    if (result)
        result = monster_census(FALSE) - census;

    return result;
    } finally { stack_pop($frame); }
}

export function summon_minion(alignment, talk) { /* void */
    let mon;
    let mnum;

    switch (alignment) {
    case A_LAWFUL:
        mnum = lminion();
        break;
    case A_NEUTRAL:
        mnum = ROLL_FROM(elementals);
        break;
    case A_CHAOTIC:
    case A_NONE:
        mnum = ndemon(alignment);
        break;
    default:
        impossible(_("unaligned player?"));
        mnum = ndemon(A_NONE);
        break;
    }
    if (mnum == NON_PM) {
        mon = null;
    } else if (mnum == PM_ANGEL) {
        mon = makemon(mons[mnum], u.ux, u.uy, MM_EMIN|MM_NOMSG);
        if (mon) {
            mon.isminion = 1;
            EMIN(mon).min_align = alignment;
            EMIN(mon).renegade = FALSE;
        }
    } else if (mnum != PM_SHOPKEEPER && mnum != PM_GUARD
               && mnum != PM_ALIGNED_CLERIC && mnum != PM_HIGH_CLERIC) {
        /* This was mons[mnum].pxlth == 0 but is this restriction
           appropriate or necessary now that the structures are separate? */
        mon = makemon(mons[mnum], u.ux, u.uy, MM_EMIN|MM_NOMSG);
        if (mon) {
            mon.isminion = 1;
            EMIN(mon).min_align = alignment;
            EMIN(mon).renegade = FALSE;
        }
    } else {
        mon = makemon(mons[mnum], u.ux, u.uy, MM_NOMSG);
    }
    if (mon) {
        if (talk) {
            if (!Deaf())
                pline_The(_("voice of %s booms:"), align_gname(alignment));
            else
                You_feel(_("%s booming voice:"),
                         s_suffix(align_gname(alignment)));
               ;
            verbalize(_("Thou shalt pay for thine indiscretion!"));
            if (canspotmon(mon))
                pline(_("%s appears before you."), Amonnam(mon));
            mon.mstrategy = and64u(mon.mstrategy, not64u(STRAT_APPEARMSG));
        }
        mon.mpeaceful = FALSE;
        /* don't call set_malign(); player was naughty */
    }
}

/* returns 1 if it won't attack. */
export function demon_talk(mtmp) { /* int */
    let cash, demand, offer;

    if (u_wield_art(ART_EXCALIBUR) || u_wield_art(ART_DEMONBANE)) {
        if (canspotmon(mtmp))
            pline(_("%s looks very angry."), Amonnam(mtmp));
        else
            You_feel(_("tension building."));
        mtmp.mpeaceful = mtmp.mtame = 0;
        set_malign(mtmp);
        newsym(mtmp.mx, mtmp.my);
        return 0;
    }

    if (is_fainted()) {
        reset_faint(); /* if fainted - wake up */
    } else {
        stop_occupation();
        if (gm.multi > 0) {
            nomul(0);
            unmul(0);
        }
    }

    /* Slight advantage given. */
    if (is_dprince(mtmp.data) && mtmp.minvis) {
        let wasunseen = +!canspotmon(mtmp);

        mtmp.minvis = mtmp.perminvis = 0;
        if (wasunseen && canspotmon(mtmp)) {
            pline(_("%s appears before you."), Amonnam(mtmp));
            mtmp.mstrategy = and64u(mtmp.mstrategy, not64u(STRAT_APPEARMSG));
        }
        newsym(mtmp.mx, mtmp.my);
    }
    if (gy.youmonst.data.mlet == S_DEMON) { /* Won't blackmail their own. */
        if (!Deaf())
            pline(_("%s says, \"Good hunting, %s.\""), Amonnam(mtmp),
                  flags.female ? _("Sister") : _("Brother"));
        else if (canseemon(mtmp))
            pline(_("%s says something."), Amonnam(mtmp));
        if (!tele_restrict(mtmp))
            rloc(mtmp, RLOC_MSG);
        return 1;
    }
    cash = money_cnt(gi.invent);
    demand = Math.trunc((cash * (rnd(80) + 20 * ((Inhell() && (mtmp.cham == NON_PM)) ? 1 : 0)))
           / (100 * (1 + +(sgn(u.ualign.type) == sgn(mtmp.data.maligntyp)))));

    if (!demand || gm.multi < 0) { /* you have no gold or can't move */
        mtmp.mpeaceful = 0;
        set_malign(mtmp);
        return 0;
    } else {
        /* make sure that the demand is unmeetable if the monster
           has the Amulet, preventing monster from being satisfied
           and removed from the game (along with said Amulet...) */
        /* [actually the Amulet is safe; it would be dropped when
           mongone() gets rid of the monster; force combat anyway;
           also make it unmeetable if the player is Deaf, to simplify
           handling that case as player-won't-pay] */
        if (mon_has_amulet(mtmp) || Deaf())
            /* 125: 5*25 in case hero has maximum possible charisma */
            demand = cash + rn1(1000, 125);

        if (!Deaf())
            pline(_("%s demands %lld %s for safe passage."),
                  Amonnam(mtmp), demand, currency(demand));
        else if (canseemon(mtmp))
            pline(_("%s seems to be demanding something."), Amonnam(mtmp));
        offer = 0;
        if (!Deaf() &&
            ((offer = bribe(mtmp, _("How much will you offer?"))) >= demand)) {
            pline(_("%s vanishes, laughing about cowardly mortals."),
                  Amonnam(mtmp));
        } else if (offer > 0
                   && rnd(5 * ACURR(A_CHA)) > (demand - offer)) {
            pline(_("%s scowls at you menacingly, then vanishes."),
                  Amonnam(mtmp));
        } else {
            pline(_("%s gets angry..."), Amonnam(mtmp));
            mtmp.mpeaceful = 0;
            set_malign(mtmp);
            return 0;
        }
    }
    /* if 'mtmp' is unrecognizable due to hero's hallucination,
       #chronicle will reveal its true identity -- just live with that;
       also, avoid random hallucinatory currency() units */
    livelog_printf(LL_UMONST, _("bribed %s with %lld %s for safe passage"),
                   x_monnam(mtmp, ARTICLE_A, 0, EXACT_NAME, FALSE),
                   offer, (offer == 1) ? _("zorkmid") : _("zorkmids"));
    mongone(mtmp);
    return 1;
}

export function bribe(mtmp, prompt) { /* long long */
    const $frame = stack_frame(); try {
    let buf = init_list(stack_array(char, BUFSZ), []);
    let offer = stack_var(long);
    let umoney = money_cnt(gi.invent);

    getlin(prompt, buf);
    if (sscanf(buf, _("%lld"), offer) != 1)
        offer[0] = 0;

    /*Michael Paddon -- fix for negative offer to monster*/
    /*JAR880815 - */
    if (offer[0] < 0) {
        You(_("try to shortchange %s, but fumble."), mon_nam(mtmp));
        return 0;
    } else if (offer[0] == 0) {
        You(_("refuse."));
        return 0;
    } else if (offer[0] >= umoney) {
        You(_("give %s all your gold."), mon_nam(mtmp));
        offer[0] = umoney;
    } else {
        You(_("give %s %lld %s."), mon_nam(mtmp), offer[0], currency(offer[0]));
    }
    money2mon(mtmp, offer[0]);
    disp.botl = TRUE;
    return offer[0];
    } finally { stack_pop($frame); }
}

export function dprince(atyp) { /* int */
    let tryct, pm;

    for (tryct = !In_endgame(u.uz) ? 20 : 0; tryct > 0; --tryct) {
        pm = rn1(PM_DEMOGORGON + 1 - PM_ORCUS, PM_ORCUS);
        if (!(svm.mvitals[pm].mvflags & G_GONE)
            && (atyp == A_NONE || sgn(mons[pm].maligntyp) == sgn(atyp)))
            return pm;
    }
    return dlord(atyp); /* approximate */
}

export function dlord(atyp) { /* int */
    let tryct, pm;

    for (tryct = !In_endgame(u.uz) ? 20 : 0; tryct > 0; --tryct) {
        pm = rn1(PM_YEENOGHU + 1 - PM_JUIBLEX, PM_JUIBLEX);
        if (!(svm.mvitals[pm].mvflags & G_GONE)
            && (atyp == A_NONE || sgn(mons[pm].maligntyp) == sgn(atyp)))
            return pm;
    }
    return ndemon(atyp); /* approximate */
}

/* create lawful (good) lord */
export function llord() { /* int */
    if (!(svm.mvitals[PM_ARCHON].mvflags & G_GONE))
        return PM_ARCHON;

    return lminion(); /* approximate */
}

export function lminion() { /* int */
    let tryct;
    let ptr;

    for (tryct = 0; tryct < 20; tryct++) {
        ptr = mkclass(S_ANGEL, 0);
        if (ptr && !is_lord(ptr))
            return monsndx(ptr);
    }

    return NON_PM;
}

export function ndemon(atyp) { /* int */ /* A_NONE is used for 'any alignment' */
    let ptr;

    /*
     * 3.6.2:  [fixed #H2204, 22-Dec-2010, eight years later...]
     * pick a correctly aligned demon in one try.  This used to
     * use mkclass() to choose a random demon type and keep trying
     * (up to 20 times) until it got one with the desired alignment.
     * mkclass_aligned() skips wrongly aligned potential candidates.
     * [The only neutral demons are djinni and mail daemon and
     * mkclass() won't pick them, but call it anyway in case either
     * aspect of that changes someday.]
     */

    ptr = mkclass_aligned(S_DEMON, 0, atyp);
    return (ptr && is_ndemon(ptr)) ? monsndx(ptr) : NON_PM;
}

/* guardian angel has been affected by conflict so is abandoning hero */
export function lose_guardian_angel(
    mon) { /* void */ /* if Null, angel hasn't been created yet */
    const $frame = stack_frame(); try {
    let mm = stack_struct(struct_nhcoord);
    let i;

    if (mon) {
        if (canspotmon(mon)) {
            if (!Deaf()) {
                pline(_("%s rebukes you, saying:"), Monnam(mon));
                   ;
                verbalize(_("Since you desire conflict, have some more!"));
            } else {
                pline(_("%s vanishes!"), Monnam(mon));
            }
        }
        mongone(mon);
    }
    /* create 2 to 4 hostile angels to replace the lost guardian */
    for (i = rn1(3, 2); i > 0; --i) {
        mm.x = u.ux;
        mm.y = u.uy;
        if (enexto(mm, mm.x, mm.y, mons[PM_ANGEL]))
            mk_roamer(mons[PM_ANGEL], u.ualign.type, mm.x, mm.y,
                             FALSE);
    }
    } finally { stack_pop($frame); }
}

/* just entered the Astral Plane; receive tame guardian angel if worthy */
export function gain_guardian_angel() { /* void */
    const $frame = stack_frame(); try {
    let mtmp;
    let otmp;
    let mm = stack_struct(struct_nhcoord);

    Hear_again(); /* attempt to cure any deafness now (divine
                     message will be heard even if that fails) */
    if (Conflict()) {
       if (!Deaf())
            pline(_("A voice booms:"));
        else
            You_feel(_("a booming voice:"));
              ;
        verbalize(_("Thy desire for conflict shall be fulfilled!"));
        /* send in some hostile angels instead */
        lose_guardian_angel(null);
    } else if (u.ualign.record > 8) { /* fervent */
        if (!Deaf())
            pline(_("A voice whispers:"));
        else
            You_feel(_("a soft voice:"));
              ;
        verbalize(_("Thou hast been worthy of me!"));
        mm.x = u.ux;
        mm.y = u.uy;
        if (enexto(mm, mm.x, mm.y, mons[PM_ANGEL])
            && (mtmp = mk_roamer(mons[PM_ANGEL], u.ualign.type, mm.x, mm.y,
                                 TRUE)) != null) {
            mtmp.mstrategy = and64u(mtmp.mstrategy, not64u(STRAT_APPEARMSG));
            /* guardian angel -- the one case mtame doesn't imply an
             * edog structure, so we don't want to call tamedog().
             * [Note: this predates mon->mextra which allows a monster
             * to have both emin and edog at the same time.]
             */
            /* Too nasty for the game to unexpectedly break petless conduct on
             * the final level of the game. The angel will still appear, but
             * won't be tamed. */
            if (u.uconduct.pets) {
                mtmp.mtame = 10;
                u.uconduct.pets++;
            }
            /* for 'hilite_pet'; after making tame, before next message */
            newsym(mtmp.mx, mtmp.my);
            if (!Blind())
                pline(_("An angel appears near you."));
            else
                You_feel(_("the presence of a friendly angel near you."));
            /* make him strong enough vs. endgame foes */
            mtmp.m_lev = uchar(rn1(8, 15));
            mtmp.mhp = int(mtmp.mhpmax =
                d(mtmp.m_lev, 10) + 30 + rnd(30));
            if ((otmp = select_hwep(mtmp)) == null) {
                otmp = mksobj(SILVER_SABER, FALSE, FALSE);
                if (mpickobj(mtmp, otmp))
                    panic(_("merged weapon?"));
            }
            bless(otmp);
            if (otmp.spe < 4)
                otmp.spe += rnd(4);
            if ((otmp = which_armor(mtmp, W_ARMS)) == null
                || otmp.otyp != SHIELD_OF_REFLECTION) {
                mongets(mtmp, AMULET_OF_REFLECTION);
                m_dowear(mtmp, TRUE);
            }
        }
    }
    } finally { stack_pop($frame); }
}

/*minion.c*/

import { A_CHAOTIC, A_LAWFUL, A_NEUTRAL, A_NONE } from "./align.h.js";
import { ART_DEMONBANE, ART_EXCALIBUR } from "./artilist.h.js";
import { A_CHA } from "./attrib.h.js";
import { ACURR } from "./attrib.h.macros.js";
import { struct_nhcoord } from "./coord.h.js";
import { S_ANGEL, S_DEMON } from "./defsym.h.js";
import { canspotmon } from "./display.h.macros.js";
import { In_endgame, Inhell } from "./dungeon.h.macros.js";
import { BUFSZ, FALSE, LL_UMONST, TRUE } from "./global.h.js";
import { ARTICLE_A, EXACT_NAME, MM_EMIN, MM_NOMSG, RLOC_MSG } from "./hack.h.js";
import { ROLL_FROM, rn1 } from "./hack.h.macros.js";
import { struct_emin } from "./mextra.h.js";
import { EMIN, EPRI } from "./mextra.h.macros.js";
import { is_demon, is_dlord, is_dprince, is_lord, is_ndemon, monsndx } from "./mondata.h.macros.js";
import { G_GONE, G_UNIQ } from "./monflag.h.js";
import { STRAT_APPEARMSG } from "./monst.h.js";
import { DEADMONSTER, is_lminion } from "./monst.h.macros.js";
import {
    NON_PM, PM_AIR_ELEMENTAL, PM_ALIGNED_CLERIC, PM_ANGEL, PM_ARCHON, PM_BONE_DEVIL, PM_DEMOGORGON,
    PM_EARTH_ELEMENTAL, PM_FIRE_ELEMENTAL, PM_GUARD, PM_HIGH_CLERIC, PM_JUIBLEX, PM_ORCUS,
    PM_SHOPKEEPER, PM_SKELETON, PM_WATER_ELEMENTAL, PM_WIZARD_OF_YENDOR, PM_YEENOGHU,
} from "./monsters.h.js";
import { u_wield_art } from "./obj.h.macros.js";
import { AMULET_OF_REFLECTION, SHIELD_OF_REFLECTION, SILVER_SABER } from "./objects.h.js";
import { W_ARMS } from "./prop.h.js";
import { fmon } from "./rm.h.macros.js";
import { Blind, Conflict, Deaf } from "./youprop.h.macros.js";
import { char, int, long, sizeof, uchar } from "../rt/ctypes.js";
import { stack_frame, stack_pop } from "../rt/heap.js";
import { and64u, not64u } from "../rt/int64.js";
import { free, memset, sscanf } from "../rt/libc.js";
import { init_list, stack_array, stack_struct, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, ptr_to, view_of } from "../rt/struct.js";
import { stop_occupation } from "./allmain.js";
import { alloc } from "./alloc.js";
import { disp, flags, gi, gm, gy, svm, u } from "./decl.js";
import { canseemon, newsym } from "./display.js";
import { Amonnam, Monnam, mon_nam, x_monnam } from "./do_name.js";
import { Hear_again, is_fainted, reset_faint } from "./eat.js";
import { panic } from "./end.js";
import { money_cnt, nomul, unmul } from "./hack.js";
import { s_suffix, sgn } from "./hacklib.js";
import { currency } from "./invent.js";
import { show_transient_light, transient_light_cleanup } from "./light.js";
import { makemon, mkclass, mkclass_aligned, mongets, newmextra, set_malign } from "./makemon.js";
import { bless, mksobj } from "./mkobj.js";
import { mongone } from "./mon.js";
import { msummon_environ } from "./mondata.js";
import { mons } from "./monst.js";
import { You, You_feel, impossible, livelog_printf, pline, pline_The, verbalize } from "./pline.js";
import { align_gname } from "./pray.js";
import { mk_roamer } from "./priest.js";
import { d, rn2, rnd } from "./rnd.js";
import { money2mon } from "./shk.js";
import { mpickobj } from "./steal.js";
import { enexto, rloc, tele_restrict } from "./teleport.js";
import { select_hwep } from "./weapon.js";
import { getlin } from "./windows.js";
import { mon_has_amulet } from "./wizard.js";
import { m_dowear, which_armor } from "./worn.js";
