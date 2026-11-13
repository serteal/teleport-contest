export function U_AP_TYPE() { return (gy.youmonst.m_ap_type & M_AP_TYPMASK); }

export function M_AP_TYPE(m) { return (m.m_ap_type & M_AP_TYPMASK); }
export function M_AP_FLAG(m) { return (m.m_ap_type & ~M_AP_TYPMASK); }

export function m_seenres(mon, mask) { return and64u(mon.seen_resistance, mask); }
export function m_setseenres(mon, mask) { return (mon.seen_resistance = or64u(mon.seen_resistance, mask)); }
export function m_clearseenres(mon, mask) { return (mon.seen_resistance = and64u(mon.seen_resistance, not64u(mask))); }
export function monstseesu_ad(adtyp) { return monstseesu(cvt_adtyp_to_mseenres(adtyp)); }
export function monstunseesu_ad(adtyp) { return monstunseesu(cvt_adtyp_to_mseenres(adtyp)); }
export function monstunseesu_prop(prop) { return monstunseesu(cvt_prop_to_mseenres(prop)); }

export function newmonst() { return view_of(struct_monst, addr_of(alloc(sizeof(struct_monst)))); }

export function MON_WEP(mon) { return mon.mw; }
export function MON_NOWEP(mon) { return (mon.mw = null); }

/* dead monsters stay on the fmon list until dmonsfree() at end of turn */
export function DEADMONSTER(mon) { return +(mon.mhp < 1); }

export function is_vampshifter(mon) { return +(mon.cham == PM_VAMPIRE || mon.cham == PM_VAMPIRE_LEADER
     || mon.cham == PM_VLAD_THE_IMPALER); }

export function vampshifted(mon) { return +(is_vampshifter(mon) && !is_vampire(mon.data)); }
/* Vlad might be vampshifted so just checking monst->data is insufficient */
export function is_Vlad(m) { return +(m.data == mons[PM_VLAD_THE_IMPALER]
                    || m.cham == PM_VLAD_THE_IMPALER); }

/* monsters which cannot be displaced: temple priests, shopkeepers,
   vault guards, the Oracle, quest leader */
export function mundisplaceable(mon) { return (mon.ispriest || mon.isshk
     || mon.isgd || mon.data == mons[PM_ORACLE]
     || mon.m_id == svq.quest_status.leader_m_id ? 1 : 0); }

/* mimic appearances that block vision/light */
export function is_lightblocker_mappear(mon) { return +(is_obj_mappear(mon, BOULDER)
     || (M_AP_TYPE(mon) == M_AP_FURNITURE
         && (mon.mappearance == S_hcdoor
             || mon.mappearance == S_vcdoor
             || mon.mappearance < S_ndoor /* = walls */
             || mon.mappearance == S_tree))); }

export function is_door_mappear(mon) { return +(M_AP_TYPE(mon) == M_AP_FURNITURE
                              && (mon.mappearance == S_hcdoor
                                  || mon.mappearance == S_vcdoor)); }
export function is_obj_mappear(mon, otyp) { return +(M_AP_TYPE(mon) == M_AP_OBJECT
                                  && mon.mappearance == otyp); }

/* is mon m (presumably just killed) a troll and obj o Trollsbane? */
export function troll_baned(m, o) { return (m.data.mlet == S_TROLL && o && o.oartifact == ART_TROLLSBANE ? 1 : 0); }

export function engulfing_u(mon) { return (u.uswallow && (u.ustuck == mon) ? 1 : 0); }
export function helpless(mon) { return (mon.msleeping || !mon.mcanmove ? 1 : 0); }

export function mon_perma_blind(mon) { return +(!mon.mcansee && !mon.mblinded); }

export function mon_offmap(mon) { return +(mon.mstate != MON_FLOOR); }

/* Get the maximum difficulty monsters that can currently be generated,
   given the current level difficulty and the hero's level. */
export function monmax_difficulty(levdif) { return Math.trunc((levdif + u.ulevel) / 2); }
export function monmin_difficulty(levdif) { return Math.trunc(levdif / 6); }
export function monmax_difficulty_lev() { return monmax_difficulty(level_difficulty()); }

/* Macros for whether a type of monster is too strong for a specific level. */
export function montoostrong(monindx, lev) { return +(mons[monindx].difficulty > lev); }
export function montooweak(monindx, lev) { return +(mons[monindx].difficulty < lev); }

export function mon_resistancebits(mon) { return (mon.data.mresists | mon.mextrinsics | mon.mintrinsics); }

export function resists_fire(mon) { return Resists_Elem(mon, FIRE_RES); }
export function resists_cold(mon) { return Resists_Elem(mon, COLD_RES); }
export function resists_sleep(mon) { return Resists_Elem(mon, SLEEP_RES); }
export function resists_disint(mon) { return Resists_Elem(mon, DISINT_RES); }
export function resists_elec(mon) { return Resists_Elem(mon, SHOCK_RES); }
export function resists_poison(mon) { return Resists_Elem(mon, POISON_RES); }
export function resists_acid(mon) { return Resists_Elem(mon, ACID_RES); }
export function resists_ston(mon) { return Resists_Elem(mon, STONE_RES); }

export function is_lminion(mon) { return +(is_minion(mon.data) && mon_aligntyp(mon) == A_LAWFUL); }

/* x is a valid index into mons[] array */
export function ismnum(x) { return +(x >= LOW_PM && x < NUMMONS); }

import { A_LAWFUL } from "./align.h.js";
import { ART_TROLLSBANE } from "./artilist.h.js";
import { S_TROLL, S_hcdoor, S_ndoor, S_tree, S_vcdoor } from "./defsym.h.js";
import { is_minion, is_vampire } from "./mondata.h.macros.js";
import { MON_FLOOR, M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPMASK, struct_monst } from "./monst.h.js";
import {
    LOW_PM, NUMMONS, PM_ORACLE, PM_VAMPIRE, PM_VAMPIRE_LEADER, PM_VLAD_THE_IMPALER,
} from "./monsters.h.js";
import { BOULDER } from "./objects.h.js";
import {
    ACID_RES, COLD_RES, DISINT_RES, FIRE_RES, POISON_RES, SHOCK_RES, SLEEP_RES, STONE_RES,
} from "./prop.h.js";
import { sizeof } from "../rt/ctypes.js";
import { and64u, not64u, or64u } from "../rt/int64.js";
import { addr_of, view_of } from "../rt/struct.js";
import { alloc } from "./alloc.js";
import { gy, svq, u } from "./decl.js";
import { level_difficulty } from "./dungeon.js";
import {
    Resists_Elem, cvt_adtyp_to_mseenres, cvt_prop_to_mseenres, monstseesu, monstunseesu,
} from "./mondata.js";
import { mons } from "./monst.js";
import { mon_aligntyp } from "./priest.js";
