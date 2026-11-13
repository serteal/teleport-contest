export function DUMMY() { return null; }

export function SHOP_WALL_DMG() { return (10 * ACURRSTR()); }

/* macros for accessing the dungeon levels by their old names */
/* clang-format off */
export function oracle_level() { return svd.dungeon_topology.d_oracle_level; }

export function medusa_level() { return svd.dungeon_topology.d_medusa_level; }

export function valley_level() { return svd.dungeon_topology.d_valley_level; }
export function wiz1_level() { return svd.dungeon_topology.d_wiz1_level; }

export function astral_level() { return svd.dungeon_topology.d_astral_level; }
export function tower_dnum() { return svd.dungeon_topology.d_tower_dnum; }
export function sokoban_dnum() { return svd.dungeon_topology.d_sokoban_dnum; }
export function mines_dnum() { return svd.dungeon_topology.d_mines_dnum; }
export function quest_dnum() { return svd.dungeon_topology.d_quest_dnum; }
export function tutorial_dnum() { return svd.dungeon_topology.d_tutorial_dnum; }
export function qstart_level() { return svd.dungeon_topology.d_qstart_level; }
export function qlocate_level() { return svd.dungeon_topology.d_qlocate_level; }

export function knox_level() { return svd.dungeon_topology.d_knox_level; }

/* clang-format on */

export function dunlev_reached(x) { return (svd.dungeons[x.dnum].dunlev_ureached); }

/* direction adjustments */
export function DIR_180(dir) { return ((dir + 4) % N_DIRS); }
export function DIR_LEFT(dir) { return ((dir + 7) % N_DIRS); }
export function DIR_RIGHT(dir) { return ((dir + 1) % N_DIRS); }
export function DIR_LEFT2(dir) { return ((dir + 6) % N_DIRS); }
export function DIR_RIGHT2(dir) { return ((dir + 2) % N_DIRS); }
export function DIR_CLAMP(dir) { return ((dir + N_DIRS) % N_DIRS); }

/* operations of the various saveXXXchn & co. routines */

/* operations of the various saveXXXchn & co. routines */
export function update_file(nhfp) { return (nhfp.mode & (COUNTING | WRITING)); }
export function release_data(nhfp) { return (nhfp.mode & FREEING); }

/* pline (et al) for a single string argument (suppress compiler warning) */
export function pline1(cstr) { return pline(_("%s"), cstr); }
export function Your1(cstr) { return Your(_("%s"), cstr); }
export function You1(cstr) { return You(_("%s"), cstr); }
export function verbalize1(cstr) { return verbalize(_("%s"), cstr); }
export function You_hear1(cstr) { return You_hear(_("%s"), cstr); }

export function panic1(cstr) { return panic(_("%s"), cstr); }

export function UNDEFINED_PTR() { return (0); }

/* The UNDEFINED_ROLE macro is used to initialize Role variables */

/* The UNDEFINED_RACE macro is used to initialize Race variables */

export function MATCH_WARN_OF_MON(mon) { return (Warn_of_mon()
     && ((svc.context.warntype.obj & mon.data.mflags2) != 0
         || (svc.context.warntype.polyd & mon.data.mflags2) != 0
         || (svc.context.warntype.species
             && (svc.context.warntype.species == mon.data))) ? 1 : 0); }

/* macro form of adjustments of physical damage based on Half_physical_damage.
 * Can be used on-the-fly with the 1st parameter to losehp() if you don't
 * need to retain the dmg value beyond that call scope.
 * Take care to ensure it doesn't get used more than once in other instances.
 */
export function Maybe_Half_Phys(dmg) { return (Half_physical_damage() ? Math.trunc((dmg + 1) / 2) : dmg); }

/*** some utility macros ***/
export function y_n(query) { return yn_function(query, ynchars, ord('n'), TRUE); }
export function ynq(query) { return yn_function(query, ynqchars, ord('q'), TRUE); }
export function ynaq(query) { return yn_function(query, ynaqchars, ord('y'), TRUE); }
export function nyaq(query) { return yn_function(query, ynaqchars, ord('n'), TRUE); }

export function ynNaq(query) { return yn_function(query, ynNaqchars, ord('y'), TRUE); }
/* YN() is same as y_n() except doesn't save the response in do-again buffer */
export function YN(query) { return yn_function(query, ynchars, ord('n'), FALSE); }

/* Some misc definitions */
export function POTION_OCCUPANT_CHANCE(n) { return (13 + 2 * n); }

export function BALL_IN_MON() { return (u.uswallow && uball && uball.where == OBJ_FREE ? 1 : 0); }
export function CHAIN_IN_MON() { return (u.uswallow && uchain && uchain.where == OBJ_FREE ? 1 : 0); }
export function NODIAG(monnum) { return +(monnum == PM_GRID_BUG); }

/* macros for dobuzz() type */
export function BZ_VALID_ADTYP(adtyp) { return +(adtyp >= AD_MAGM && adtyp <= AD_SPC2); }

export function BZ_OFS_AD(adtyp) { return (abs(adtyp - AD_MAGM) % 10); }
export function BZ_OFS_WAN(otyp) { return (abs(otyp - WAN_MAGIC_MISSILE) % 10); }
export function BZ_OFS_SPE(otyp) { return (abs(otyp - SPE_MAGIC_MISSILE) % 10); }
/* hero shooting a wand */
export function BZ_U_WAND(bztyp) { return (0 + bztyp); }
/* hero casting a spell */
export function BZ_U_SPELL(bztyp) { return (10 + bztyp); }
/* hero breathing as a monster */
export function BZ_U_BREATH(bztyp) { return (20 + bztyp); }
/* monster casting a spell */
export function BZ_M_SPELL(bztyp) { return (-10 - bztyp); }
/* monster breathing */
export function BZ_M_BREATH(bztyp) { return (-20 - bztyp); }
/* monster shooting a wand; note: not -9 to -0 because -0 is ambiguous  */
export function BZ_M_WAND(bztyp) { return (-30 - bztyp); }

/* pick a random entry from array */
export function ROLL_FROM(array) { return array[rn2(SIZE(array))]; }
/* array with terminator variation */
/* #define ROLL_FROMT(array) array[rn2(SIZE(array) - 1)] */

/* validate index of array */
export function IndexOk(idx, array) { return +(idx >= 0 && idx < SIZE(array)); }

/* array with terminator variation */
export function IndexOkT(idx, array) { return +(idx >= 0 && idx < (SIZE(array) - 1)); }

export function FEATURE_NOTICE_VER(major, minor, patch) { return (shl64(major, 24) | shl64(minor, 16)
     | shl64(patch, 8) | (0)); }

export function FEATURE_NOTICE_VER_MAJ() { return shr64u(flags.suppress_alert, 24); }
export function FEATURE_NOTICE_VER_MIN() { return ((0x0000000000FF0000 & flags.suppress_alert) >> 16); }

export function FEATURE_NOTICE_VER_PATCH() { return ((0x000000000000FF00 & flags.suppress_alert) >> 8); }

export function max(a, b) { return (a > b ? a : b); }

export function min(x, y) { return (x < y ? x : y); }

export function plur(x) { return ((x == 1) ? _("") : _("s")); }

/* Cast to int, but limit value to range. */
export function LIMIT_TO_RANGE_INT(lo, hi, var_) { return int((var_ < lo ? lo : var_ > hi ? hi : var_)); }

export function ARM_BONUS(obj) { return (objects[obj.otyp].oc_oc1 + obj.spe
     - min(greatest_erosion(obj), objects[obj.otyp].oc_oc1)); }

export function makeknown(x) { return discover_object(x, TRUE, TRUE, TRUE); }
export function distu(xx, yy) { return dist2(xx, yy, u.ux, u.uy); }
export function mdistu(mon) { return distu(mon.mx, mon.my); }
export function onlineu(xx, yy) { return online2(xx, yy, u.ux, u.uy); }

export function rn1(x, y) { return (rn2(x) + y); }

/* negative armor class is randomly weakened to prevent invulnerability */
export function AC_VALUE(AC) { return (AC >= 0 ? AC : -rnd(-AC)); }

/*
 * Harness determinism: replace libc qsort() with a stable wrapper so
 * equal-key ordering does not vary by platform libc behavior.
 */

export function qsort(base, nmemb, size, compar) { return nh_deterministic_qsort(base, nmemb, size, compar); }

/*
 * PRNG call logging macros (004-prng-logging patch).
 *
 * These use a C preprocessor trick: function-like macros only match
 * when followed by '('.  So `init_random(rn2)` passes the bare function
 * pointer (no parens) and the macro doesn't fire.  But `rn2(42)` does
 * match, setting the caller's __func__, __FILE__:__LINE__ before
 * calling the real rn2 function.
 *
 * The self-reference in the expansion (e.g. rn2 calling rn2) is safe:
 * C99 6.10.3.4 says a macro name found during its own expansion is
 * not replaced again, so it resolves to the real function.
 *
 * Suppressed inside rnd.c itself (RNGLOG_IN_RND_C) so that internal
 * calls (rnz->rn2, rne->rn2, etc) inherit the outer caller's context
 * rather than setting their own.
 */

import { ACURRSTR } from "./attrib.h.macros.js";
import { FALSE, TRUE } from "./global.h.js";
import { COUNTING, FREEING, N_DIRS, WRITING } from "./hack.h.js";
import { AD_MAGM, AD_SPC2 } from "./monattk.h.js";
import { PM_GRID_BUG } from "./monsters.h.js";
import { OBJ_FREE } from "./obj.h.js";
import { greatest_erosion } from "./obj.h.macros.js";
import { SPE_MAGIC_MISSILE, WAN_MAGIC_MISSILE } from "./objects.h.js";
import { Half_physical_damage, Warn_of_mon } from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { int, ord } from "../rt/ctypes.js";
import { shl64, shr64u } from "../rt/int64.js";
import { abs } from "../rt/libc.js";
import { _ } from "../rt/strings.js";
import { yn_function } from "./cmd.js";
import { flags, svc, svd, u, ynNaqchars, ynaqchars, ynchars, ynqchars } from "./decl.js";
import { panic } from "./end.js";
import { dist2, nh_deterministic_qsort, online2 } from "./hacklib.js";
import { discover_object } from "./o_init.js";
import { objects } from "./objects.js";
import { You, You_hear, Your, pline, verbalize } from "./pline.js";
import { rn2, rnd } from "./rnd.js";
