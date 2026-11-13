/* NetHack 5.0	quest.c	$NHDT-Date: 1774269965 2026/03/23 04:46:05 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.46 $ */
/*      Copyright 1991, M. Stephenson             */
/* NetHack may be freely redistributed.  See license for details. */

/*  quest dungeon branch routines. */

export function Not_firsttime() { return on_level(u.uz0, u.uz); }

function on_start() { /* void */
    if (!svq.quest_status.first_start) {
        qt_pager(_("firsttime"));
        svq.quest_status.first_start = TRUE;
    } else if ((u.uz0.dnum != u.uz.dnum) || (u.uz0.dlevel < u.uz.dlevel)) {
        if (svq.quest_status.not_ready <= 2)
            qt_pager(_("nexttime"));
        else
            qt_pager(_("othertime"));
    }
}

function on_locate() { /* void */
    /* the locate messages are phrased in a manner such that they only
       make sense when arriving on the level from above */
    let from_above = +(u.uz0.dlevel < u.uz.dlevel);

    if (svq.quest_status.killed_nemesis) {
        return;
    } else if (!svq.quest_status.first_locate) {
        if (from_above)
            qt_pager(_("locate_first"));
        /* if we've arrived from below this will be a lie, but there won't
           be any point in delivering the message upon a return visit from
           above later since the level has now been seen */
        svq.quest_status.first_locate = TRUE;
    } else {
        if (from_above)
            qt_pager(_("locate_next"));
    }
}

function on_goal() { /* void */
    if (svq.quest_status.killed_nemesis) {
        return;
    } else if (!svq.quest_status.made_goal) {
        qt_pager(_("goal_first"));
        svq.quest_status.made_goal = 1;
    } else {
        /*
         * Some QT_NEXTGOAL messages reference the quest artifact;
         * find out if it is still present.  If not, request an
         * alternate message (qt_pager() will revert to delivery
         * of QT_NEXTGOAL if current role doesn't have QT_ALTGOAL).
         * Note: if hero is already carrying it, it is treated as
         * being absent from the level for quest message purposes.
         */
        let whichobjchains = ((1 << OBJ_FLOOR)
                                   | (1 << OBJ_MINVENT)
                                   | (1 << OBJ_BURIED));
        let qarti = find_quest_artifact(whichobjchains);

        qt_pager(qarti ? _("goal_next") : _("goal_alt"));
        if (svq.quest_status.made_goal < 7)
            svq.quest_status.made_goal++;
    }
}

export function onquest() { /* void */
    if (u.uevent.qcompleted || Not_firsttime())
        return;
    if (!Is_special(u.uz))
        return;

    if (Is_qstart(u.uz))
        on_start();
    else if (Is_qlocate(u.uz))
        on_locate();
    else if (Is_nemesis(u.uz))
        on_goal();
    return;
}

export function nemdead() { /* void */
    if (!svq.quest_status.killed_nemesis) {
        svq.quest_status.killed_nemesis = TRUE;
        qt_pager(_("killed_nemesis"));
    }
}

export function leaddead() { /* void */
    if (!svq.quest_status.killed_leader) {
        svq.quest_status.killed_leader = TRUE;
        /* TODO: qt_pager("killed_leader"); ? */
    }
}

export function artitouch(obj) { /* void */
    if (!svq.quest_status.touched_artifact) {
        /* in case we haven't seen the item yet (ie, currently blinded),
           this quest message describes it by name so mark it as seen */
        observe_object(obj);
        /* only give this message once */
        svq.quest_status.touched_artifact = TRUE;
        qt_pager(_("gotit"));
        exercise(A_WIS, TRUE);
    }
}

/* external hook for do.c (level change check) */
export function ok_to_quest() { /* boolean */
    return (((svq.quest_status.got_quest || svq.quest_status.got_thanks)
                       && is_pure(FALSE) > 0) || svq.quest_status.killed_leader ? 1 : 0);
}

function not_capable() { /* boolean */
    return (+(u.ulevel < MIN_QUEST_LEVEL));
}

function is_pure(talk) { /* int */
    let purity;
    let original_alignment = chars[u.ualignbase + A_ORIGINAL];

    if (wizard() && talk) {
        if (u.ualign.type != original_alignment) {
            You(_("are currently %s instead of %s."), align_str(u.ualign.type),
                align_str(original_alignment));
        } else if (chars[u.ualignbase + A_CURRENT] != original_alignment) {
            You(_("have converted."));
        } else if (u.ualign.record < MIN_QUEST_ALIGN) {
            You(_("are currently %d and require %d."), u.ualign.record,
                MIN_QUEST_ALIGN);
            if (yn_function(_("adjust?"), 0, ord('y'), TRUE) == ord('y'))
                u.ualign.record = MIN_QUEST_ALIGN;
        }
    }
    purity = (u.ualign.record >= MIN_QUEST_ALIGN
              && u.ualign.type == original_alignment
              && chars[u.ualignbase + A_CURRENT] == original_alignment)
                 ? 1
                 : (chars[u.ualignbase + A_CURRENT] != original_alignment) ? -1 : 0;
    return purity;
}

/*
 * Expel the player to the stairs on the parent of the quest dungeon.
 *
 * This assumes that the hero is currently _in_ the quest dungeon and that
 * there is a single branch to and from it.
 */
function expulsion(seal) { /* void */
    let br;
    let dest;
    let t;
    let portal_flag = u.uevent.qexpelled ? UTOTYPE_NONE : UTOTYPE_PORTAL;

    br = dungeon_branch(_("The Quest"));
    dest = (br.end1.dnum == u.uz.dnum) ? br.end2 : br.end1;
    if (seal)
        portal_flag |= UTOTYPE_RMPORTAL;
    nomul(0); /* stop running */
    schedule_goto(dest, portal_flag, 0, 0);
    if (seal) { /* remove the portal to the quest - sealing it off */
        let reexpelled = u.uevent.qexpelled;

        u.uevent.qexpelled = 1;
        remdun_mapseen(quest_dnum());
        /* Delete the near portal now; the far (main dungeon side)
           portal will be deleted as part of arrival on that level.
           If monster movement is in progress, any who haven't moved
           yet will now miss out on a chance to wander through it... */
        for (t = gf.ftrap; t; t = t.ntrap)
            if (t.ttyp == MAGIC_PORTAL)
                break;
        if (t)
            deltrap(t); /* (display might be briefly out of sync) */
        else if (!reexpelled)
            impossible(_("quest portal already gone?"));
    }
}

/* Either you've returned to quest leader while carrying the quest
   artifact or you've just thrown it to/at him or her.  If quest
   completion text hasn't been given yet, give it now.  Otherwise
   give another message about the character keeping the artifact
   and using the magic portal to return to the dungeon.  Also called
   if hero throws or kicks an invocation item (probably the Bell)
   at the leader. */
export function finish_quest(obj) { /* void */ /* quest artifact or thrown unique item or faux * AoY; possibly null if carrying the Amulet */
    let otmp;

    if (obj && !is_quest_artifact(obj)) {
        /* tossed an invocation item (or [fake] AoY) at the quest leader */
        if (Deaf())
            return; /* optional (unlike quest completion) so skip if deaf */
        /* do ID first so that the message identifying the item will refer to
           it by name (and so justify the ID we already gave...) */
        fully_identify_obj(obj);
        /* update_inventory() is not necessary or helpful here because item
           was thrown, so isn't currently in inventory anyway */
        if (obj.otyp == AMULET_OF_YENDOR) {
            qt_pager(_("hasamulet"));
        } else if (obj.otyp == FAKE_AMULET_OF_YENDOR) {
            verbalize(
      _("Sorry to say, this is a mere imitation of the true Amulet of Yendor."));
        } else {
            verbalize(_("Ah, I see you've found %s."), the(xname(obj)));
        }
        return;
    }

    if (u.uhave.amulet) {
        /* has the amulet in inventory -- most likely the player has already
           completed the quest and stopped in on her way back up, but it's not
           impossible to have gotten the amulet before formally presenting the
           quest artifact to the leader. */
        qt_pager(_("hasamulet"));
        /* leader IDs the real amulet but ignores any fakes */
        if ((otmp = carrying(AMULET_OF_YENDOR)) != null) {
            fully_identify_obj(otmp);
            update_inventory();
        }
    } else {
        /* normal quest completion; threw artifact or walked up carrying it */
        qt_pager(!svq.quest_status.got_thanks ? _("offeredit") : _("offeredit2"));
        /* should have obtained bell during quest;
           if not, suggest returning for it now */
        if ((otmp = carrying(BELL_OF_OPENING)) == null)
            com_pager(_("quest_complete_no_bell"));
    }
    svq.quest_status.got_thanks = TRUE;

    if (obj) {
        u.uevent.qcompleted = 1; /* you did it! */
        /* behave as if leader imparts sufficient info about the
           quest artifact */
        fully_identify_obj(obj);
        update_inventory();
    }
}

function chat_with_leader(mtmp) { /* void */
    if (!mtmp.mpeaceful || svq.quest_status.pissed_off)
        return;

    /*  Rule 0: Cheater checks. */
    if (u.uhave.questart && !svq.quest_status.met_nemesis)
        svq.quest_status.cheater = TRUE;

    /*  It is possible for you to get the amulet without completing
     *  the quest.  If so, try to induce the player to quest.
     */
    if (svq.quest_status.got_thanks) {
        /* Rule 1: You've gone back with/without the amulet. */
        if (u.uhave.amulet)
            finish_quest(null);

        /* Rule 2: You've gone back before going for the amulet. */
        else
            qt_pager(_("posthanks"));

    /* Rule 3: You've got the artifact and are back to return it. */
    } else if (u.uhave.questart) {
        let otmp;

        for (otmp = gi.invent; otmp; otmp = otmp.nobj)
            if (is_quest_artifact(otmp))
                break;

        finish_quest(otmp);

    /* Rule 4: You haven't got the artifact yet. */
    } else if (svq.quest_status.got_quest) {
        qt_pager(_("encourage"));

    /* Rule 5: You aren't yet acceptable - or are you? */
    } else {
        let purity = 0;

        if (!svq.quest_status.met_leader) {
            qt_pager(_("leader_first"));
            svq.quest_status.met_leader = TRUE;
            svq.quest_status.not_ready = 0;
        } else
            qt_pager(_("leader_next"));

        /* the quest leader might have passed through the portal into
           the regular dungeon; none of the remaining make sense there */
        if (!on_level(u.uz, svd.dungeon_topology.d_qstart_level))
            return;

        if (not_capable()) {
            qt_pager(_("badlevel"));
            exercise(A_WIS, TRUE);
            expulsion(FALSE);
        } else if ((purity = is_pure(TRUE)) < 0) {
            if (!svq.quest_status.pissed_off) {
                com_pager(_("banished"));
                svq.quest_status.pissed_off = TRUE;
                expulsion(FALSE);

                /* being expelled is hardly an achievement but none of the
                   other livelog classifications fit */
                livelog_printf(LL_ACHIEVE,
                               _("%s has expelled you from the quest"),
                               noit_mon_nam(mtmp));
            }
        } else if (purity == 0) {
            qt_pager(_("badalign"));
            svq.quest_status.not_ready = 1;
            exercise(A_WIS, TRUE);
            expulsion(FALSE);
        } else { /* You are worthy! */
            qt_pager(_("assignquest"));
            exercise(A_WIS, TRUE);
            svq.quest_status.got_quest = TRUE;

            /* phrasing is a bit clumsy but allows #chronicle to provide a
               clue to players who are reaching the quest for first time;
               matters most for Home 1 that has stairs down which aren't
               easily found */
            livelog_printf(LL_ACHIEVE,
                     _("%s has granted access to proceed deeper into the quest"),
                           noit_mon_nam(mtmp));
        }
    }
}

export function leader_speaks(mtmp) { /* void */
    /* maybe you attacked leader? */
    if (!mtmp.mpeaceful) {
        if (!svq.quest_status.pissed_off) {
            /* again, don't end it permanently if the leader gets angry
             * since you're going to have to kill him to go questing... :)
             * ...but do only show this crap once. */
            qt_pager(_("leader_last"));
        }
        svq.quest_status.pissed_off = TRUE;
        mtmp.mstrategy = and64u(mtmp.mstrategy, ~STRAT_WAITMASK); /* end the inaction */
    }
    /* the quest leader might have passed through the portal into the
       regular dungeon; if so, mustn't perform "backwards expulsion" */
    if (!on_level(u.uz, svd.dungeon_topology.d_qstart_level))
        return;

    if (!svq.quest_status.pissed_off)
        chat_with_leader(mtmp);
}

function chat_with_nemesis() { /* void */
    /*  The nemesis will do most of the talking, but... */
    qt_pager(_("discourage"));
    if (!svq.quest_status.met_nemesis)
        svq.quest_status.met_nemesis++;
}

export function nemesis_speaks() { /* void */
    if (!svq.quest_status.in_battle) {
        if (u.uhave.questart)
            qt_pager(_("nemesis_wantsit"));
        else if (svq.quest_status.made_goal == 1 || !svq.quest_status.met_nemesis)
            qt_pager(_("nemesis_first"));
        else if (svq.quest_status.made_goal < 4)
            qt_pager(_("nemesis_next"));
        else if (svq.quest_status.made_goal < 7)
            qt_pager(_("nemesis_other"));
        else if (!rn2(5))
            qt_pager(_("discourage"));
        if (svq.quest_status.made_goal < 7)
            svq.quest_status.made_goal++;
        svq.quest_status.met_nemesis = TRUE;
    } else /* he will spit out random maledictions */
        if (!rn2(5))
        qt_pager(_("discourage"));
}

/* create cloud of stinking gas around dying nemesis */
export function nemesis_stinks(mx, my) { /* void */
    let save_mon_moving = svc.context.mon_moving;

    /*
     * Some nemeses (determined by caller) release a cloud of noxious
     * gas when they die.  Don't make the hero be responsible for such
     * a cloud even if hero has just killed nemesis.
     */
    svc.context.mon_moving = TRUE;
    create_gas_cloud(mx, my, 5, 8);
    svc.context.mon_moving = save_mon_moving;
}

function chat_with_guardian() { /* void */
    /*  These guys/gals really don't have much to say... */
    if (u.uhave.questart && svq.quest_status.killed_nemesis)
        qt_pager(_("guardtalk_after"));
    else
        qt_pager(_("guardtalk_before"));
}

function prisoner_speaks(mtmp) { /* void */
    if (mtmp.data == mons[PM_PRISONER]
        && (mtmp.mstrategy & STRAT_WAITMASK)) {
        /* Awaken the prisoner */
        if (canseemon(mtmp))
            pline(_("%s speaks:"), Monnam(mtmp));
           ;
        verbalize(_("I'm finally free!"));
        mtmp.mstrategy = and64u(mtmp.mstrategy, ~STRAT_WAITMASK);
        mtmp.mpeaceful = 1;

        /* Your god is happy... */
        adjalign(3);

        /* ...But the guards are not */
        angry_guards(FALSE);
    }
    return;
}

export function quest_chat(mtmp) { /* void */
    if (mtmp.m_id == svq.quest_status.leader_m_id) {
        chat_with_leader(mtmp);
        /* leader might have become pissed during the chat */
        if (svq.quest_status.pissed_off)
            setmangry(mtmp, FALSE);
        return;
    }
    switch (mtmp.data.msound) {
    case MS_NEMESIS:
        chat_with_nemesis();
        break;
    case MS_GUARDIAN:
        chat_with_guardian();
        break;
    default:
        impossible(_("quest_chat: Unknown quest character %s."), mon_nam(mtmp));
    }
}

export function quest_talk(mtmp) { /* void */
    if (mtmp.m_id == svq.quest_status.leader_m_id) {
        leader_speaks(mtmp);
        return;
    }
    switch (mtmp.data.msound) {
    case MS_NEMESIS:
        nemesis_speaks();
        break;
    case MS_DJINNI:
        prisoner_speaks(mtmp);
        break;
    default:
        break;
    }
}

export function quest_stat_check(mtmp) { /* void */
    if (mtmp.data.msound == MS_NEMESIS)
        svq.quest_status.in_battle = (!helpless(mtmp) && monnear(mtmp, u.ux, u.uy) ? 1 : 0);
}

/*quest.c*/

import { A_WIS } from "./attrib.h.js";
import { Is_nemesis, Is_qlocate, Is_qstart } from "./dungeon.h.macros.js";
import { wizard } from "./flag.h.macros.js";
import { FALSE, LL_ACHIEVE, TRUE } from "./global.h.js";
import { quest_dnum } from "./hack.h.macros.js";
import { MS_DJINNI, MS_GUARDIAN, MS_NEMESIS } from "./monflag.h.js";
import { STRAT_WAITMASK } from "./monst.h.js";
import { helpless } from "./monst.h.macros.js";
import { PM_PRISONER } from "./monsters.h.js";
import { OBJ_BURIED, OBJ_FLOOR, OBJ_MINVENT } from "./obj.h.js";
import { AMULET_OF_YENDOR, BELL_OF_OPENING, FAKE_AMULET_OF_YENDOR } from "./objects.h.js";
import { MIN_QUEST_ALIGN, MIN_QUEST_LEVEL } from "./quest.h.js";
import { MAGIC_PORTAL } from "./trap.h.js";
import { A_CURRENT, A_ORIGINAL, UTOTYPE_NONE, UTOTYPE_PORTAL, UTOTYPE_RMPORTAL } from "./you.h.js";
import { Deaf } from "./youprop.h.macros.js";
import { ord } from "../rt/ctypes.js";
import { chars } from "../rt/heap.js";
import { and64u } from "../rt/int64.js";
import { _ } from "../rt/strings.js";
import { adjalign, exercise } from "./attrib.js";
import { yn_function } from "./cmd.js";
import { gf, gi, svc, svd, svq, u } from "./decl.js";
import { canseemon } from "./display.js";
import { schedule_goto } from "./do.js";
import { Monnam, mon_nam, noit_mon_nam } from "./do_name.js";
import { Is_special, dungeon_branch, on_level, remdun_mapseen } from "./dungeon.js";
import { nomul } from "./hack.js";
import { align_str } from "./insight.js";
import { carrying, fully_identify_obj, update_inventory } from "./invent.js";
import { angry_guards, monnear, setmangry } from "./mon.js";
import { mons } from "./monst.js";
import { observe_object } from "./o_init.js";
import { the, xname } from "./objnam.js";
import { You, impossible, livelog_printf, pline, verbalize } from "./pline.js";
import { com_pager, find_quest_artifact, is_quest_artifact, qt_pager } from "./questpgr.js";
import { create_gas_cloud } from "./region.js";
import { rn2 } from "./rnd.js";
import { deltrap } from "./trap.js";
