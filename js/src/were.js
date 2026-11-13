/* NetHack 5.0	were.c	$NHDT-Date: 1766588485 2025/12/24 07:01:25 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.41 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2011. */
/* NetHack may be freely redistributed.  See license for details. */

export function were_change(mon) { /* void */
    if (!is_were(mon.data))
        return;

    if (is_human(mon.data)) {
        if (!Protection_from_shape_changers()
            && !rn2(night() ? (flags.moonphase == FULL_MOON ? 3 : 30)
                            : (flags.moonphase == FULL_MOON ? 10 : 50))) {
            new_were(mon); /* change into animal form */
            gw.were_changes++;
            if (!Deaf() && !canseemon(mon)) {
                let howler;

                switch (monsndx(mon.data)) {
                case PM_WEREWOLF:
                    howler = _("wolf");
                    break;
                case PM_WEREJACKAL:
                    howler = _("jackal");
                    break;
                default:
                    howler = 0;
                    break;
                }
                if (howler) {
                     ;
                    You_hear(_("a %s howling at the moon."), howler);
                    wake_nearto(mon.mx, mon.my, 4 * 4);
                }
            }
        }
    } else if (!rn2(30) || Protection_from_shape_changers()) {
        new_were(mon); /* change back into human form */
        gw.were_changes++;
    }
}

export function counter_were(pm) { /* int */
    switch (pm) {
    case PM_WEREWOLF:
        return PM_HUMAN_WEREWOLF;
    case PM_HUMAN_WEREWOLF:
        return PM_WEREWOLF;
    case PM_WEREJACKAL:
        return PM_HUMAN_WEREJACKAL;
    case PM_HUMAN_WEREJACKAL:
        return PM_WEREJACKAL;
    case PM_WERERAT:
        return PM_HUMAN_WERERAT;
    case PM_HUMAN_WERERAT:
        return PM_WERERAT;
    default:
        return NON_PM;
    }
}

/* convert monsters similar to werecritters into appropriate werebeast */
export function were_beastie(pm) { /* int */
    switch (pm) {
    case PM_WERERAT:
    case PM_SEWER_RAT:
    case PM_GIANT_RAT:
    case PM_RABID_RAT:
        return PM_WERERAT;
    case PM_WEREJACKAL:
    case PM_JACKAL:
    case PM_FOX:
    case PM_COYOTE:
        return PM_WEREJACKAL;
    case PM_WEREWOLF:
    case PM_WOLF:
    case PM_WARG:
    case PM_WINTER_WOLF:
    case PM_WINTER_WOLF_CUB:
        return PM_WEREWOLF;
    default:
        break;
    }
    return NON_PM;
}

export function new_were(mon) { /* void */
    let pm;

    /* neither hero nor werecreature can change from human form to
       critter form if hero has Protection_from_shape_changers extrinsic;
       if already in critter form, always change to human form for that */
    if (Protection_from_shape_changers() && is_human(mon.data))
        return;

    pm = counter_were(monsndx(mon.data));
    if (pm < LOW_PM) {
        impossible(_("unknown lycanthrope %s."),
                    mon.data.pmnames[NEUTRAL]);
        return;
    }

    if (canseemon(mon) && !Hallucination())
        pline(_("%s changes into a %s."), Monnam(mon),
              is_human(mons[pm]) ? _("human")
                                  /* pmname()+4: skip past "were" prefix */
                                  : pmname(mons[pm], Mgender(mon)) + 4);

    set_mon_data(mon, mons[pm]);
    if (helpless(mon)) {
        /* transformation wakens and/or revitalizes */
        mon.msleeping = 0;
        mon.mfrozen = 0; /* not asleep or paralyzed */
        mon.mcanmove = 1;
    }
    /* regenerate by 1/4 of the lost hit points */
    healmon(mon, Math.trunc((mon.mhpmax - mon.mhp) / 4), 0);
    newsym(mon.mx, mon.my);
    mon_break_armor(mon, FALSE);
    possibly_unwield(mon, FALSE);

    /* vision capability isn't changing so we don't call set_apparxy() to
       update mon's idea of where hero is; peaceful check is redundant */
    if (svc.context.mon_moving && !mon.mpeaceful
        && onscary(mon.mux, mon.muy, mon)
        && monnear(mon, mon.mux, mon.muy))
        monflee(mon, rn1(9, 2), TRUE, TRUE); /* 2..10 turns */
}

/* were-creature (even you) summons a horde */
export function were_summon(
    ptr,
    yours,
    visible,
    genbuf) { /* int */
    let i, typ, pm = monsndx(ptr);
    let mtmp;
    let total = 0;

    visible[0] = 0;
    if (Protection_from_shape_changers() && !yours)
        return 0;
    for (i = rnd(5); i > 0; i--) {
        switch (pm) {
        case PM_WERERAT:
        case PM_HUMAN_WERERAT:
            typ = rn2(3) ? PM_SEWER_RAT
                         : rn2(3) ? PM_GIANT_RAT : PM_RABID_RAT;
            if (genbuf)
                strcpy(genbuf, _("rat"));
            break;
        case PM_WEREJACKAL:
        case PM_HUMAN_WEREJACKAL:
            typ = rn2(7) ? PM_JACKAL : rn2(3) ? PM_COYOTE : PM_FOX;
            if (genbuf)
                strcpy(genbuf, _("jackal"));
            break;
        case PM_WEREWOLF:
        case PM_HUMAN_WEREWOLF:
            typ = rn2(5) ? PM_WOLF : rn2(2) ? PM_WARG : PM_WINTER_WOLF;
            if (genbuf)
                strcpy(genbuf, _("wolf"));
            break;
        default:
            continue;
        }
        mtmp = makemon(mons[typ], u.ux, u.uy, NO_MM_FLAGS);
        if (mtmp) {
            total++;
            if (canseemon(mtmp))
                visible[0] += 1;
        }
        if (yours && mtmp)
            tamedog(mtmp, null, FALSE);
    }
    return total;
}

export function you_were() { /* void */
    const $frame = stack_frame(); try {
    let qbuf = stack_array(char, QBUFSZ);
    let controllable_poly = (Polymorph_control() && !(Stunned() || Unaware()) ? 1 : 0);

    if (Unchanging() || u.umonnum == u.ulycn)
        return;
    if (controllable_poly) {
        /* `+4' => skip "were" prefix to get name of beast */
        sprintf(qbuf, _("Do you want to change into %s?"), an(mons[u.ulycn].pmnames[NEUTRAL] + 4))
;
        if (!paranoid_query(ParanoidWerechange(), qbuf))
            return;
    } else if (monster_nearby()) {
        return;
    }
    gw.were_changes++;
    polymon(u.ulycn);
    } finally { stack_pop($frame); }
}

export function you_unwere(purify) { /* void */
    let controllable_poly = (Polymorph_control() && !(Stunned() || Unaware()) ? 1 : 0);

    if (purify) {
        You_feel(_("purified."));
        set_ulycn(NON_PM); /* cure lycanthropy */
    }
    if (!Unchanging() && is_were(gy.youmonst.data)
        && !monster_nearby()
        && (!controllable_poly
            || !paranoid_query(ParanoidWerechange(), _("Remain in beast form?"))))
        rehumanize();
    else if (is_were(gy.youmonst.data) && !u.mtimedone)
        u.mtimedone = rn1(200, 200); /* 40% of initial were change */
}

/* lycanthropy is being caught or cured, but no shape change is involved */
export function set_ulycn(which) { /* void */
    u.ulycn = which;
    /* add or remove lycanthrope's innate intrinsics (Drain_resistance) */
    set_uasmon();
}

/*were.c*/

import { FULL_MOON } from "./flag.h.js";
import { ParanoidWerechange } from "./flag.h.macros.js";
import { FALSE, QBUFSZ, TRUE } from "./global.h.js";
import { NO_MM_FLAGS } from "./hack.h.js";
import { rn1 } from "./hack.h.macros.js";
import { is_human, is_were, monsndx } from "./mondata.h.macros.js";
import { NEUTRAL } from "./monflag.h.js";
import { helpless } from "./monst.h.macros.js";
import {
    LOW_PM, NON_PM, PM_COYOTE, PM_FOX, PM_GIANT_RAT, PM_HUMAN_WEREJACKAL, PM_HUMAN_WERERAT,
    PM_HUMAN_WEREWOLF, PM_JACKAL, PM_RABID_RAT, PM_SEWER_RAT, PM_WARG, PM_WEREJACKAL, PM_WERERAT,
    PM_WEREWOLF, PM_WINTER_WOLF, PM_WINTER_WOLF_CUB, PM_WOLF,
} from "./monsters.h.js";
import {
    Deaf, Hallucination, Polymorph_control, Protection_from_shape_changers, Stunned, Unaware,
    Unchanging,
} from "./youprop.h.macros.js";
import { char } from "../rt/ctypes.js";
import { stack_frame, stack_pop } from "../rt/heap.js";
import { sprintf, strcpy } from "../rt/libc.js";
import { stack_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { night } from "./calendar.js";
import { paranoid_query } from "./cmd.js";
import { flags, gw, gy, svc, u } from "./decl.js";
import { canseemon, newsym } from "./display.js";
import { Mgender, Monnam, pmname } from "./do_name.js";
import { tamedog } from "./dog.js";
import { monster_nearby } from "./hack.js";
import { makemon } from "./makemon.js";
import { healmon, monnear, wake_nearto } from "./mon.js";
import { set_mon_data } from "./mondata.js";
import { monflee, onscary } from "./monmove.js";
import { mons } from "./monst.js";
import { an } from "./objnam.js";
import { You_feel, You_hear, impossible, pline } from "./pline.js";
import { polymon, rehumanize, set_uasmon } from "./polyself.js";
import { rn2, rnd } from "./rnd.js";
import { possibly_unwield } from "./weapon.js";
import { mon_break_armor } from "./worn.js";
