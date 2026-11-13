/* NetHack 5.0	savefile.h	$NHDT-Date: 1738638877 2025/02/03 19:14:37 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1476 $ */
/* Copyright (c) Michael Allison, 2025.                           */
/* NetHack may be freely redistributed.  See license for details. */

/* #define SAVEFILE_DEBUGGING */

/* sfbase.c output functions */

//extern void sfo_str(NHFILE *, char *, const char *, int);

/* sfbase.c input functions */

export function Sfo_any(a, b, c) { return sfo_any(a, b, c); }

export function Sfo_coordxy(a, b, c) { return sfo_int16(a, b, c); }
export function Sfo_char(a, b, c, d) { return sfo_char(a, b, c, d); }

export function Sfo_int32(a, b, c) { return sfo_int32(a, b, c); }

export function Sfo_uchar(a, b, c) { return sfo_uchar(a, b, c); }

export function Sfo_arti_info(a, b, c) { return sfo_arti_info(a, b, c); }
export function Sfo_dgn_topology(a, b, c) { return sfo_dgn_topology(a, b, c); }
export function Sfo_dungeon(a, b, c) { return sfo_dungeon(a, b, c); }
export function Sfo_branch(a, b, c) { return sfo_branch(a, b, c); }
export function Sfo_linfo(a, b, c) { return sfo_linfo(a, b, c); }
export function Sfo_nhcoord(a, b, c) { return sfo_nhcoord(a, b, c); }
export function Sfo_d_level(a, b, c) { return sfo_d_level(a, b, c); }
export function Sfo_mapseen_feat(a, b, c) { return sfo_mapseen_feat(a, b, c); }
export function Sfo_mapseen_flags(a, b, c) { return sfo_mapseen_flags(a, b, c); }
export function Sfo_mapseen_rooms(a, b, c) { return sfo_mapseen_rooms(a, b, c); }
export function Sfo_kinfo(a, b, c) { return sfo_kinfo(a, b, c); }
export function Sfo_engr(a, b, c) { return sfo_engr(a, b, c); }
export function Sfo_ls_t(a, b, c) { return sfo_ls_t(a, b, c); }
export function Sfo_bubble(a, b, c) { return sfo_bubble(a, b, c); }
export function Sfo_mkroom(a, b, c) { return sfo_mkroom(a, b, c); }
export function Sfo_objclass(a, b, c) { return sfo_objclass(a, b, c); }
export function Sfo_nhrect(a, b, c) { return sfo_nhrect(a, b, c); }
export function Sfo_fe(a, b, c) { return sfo_fe(a, b, c); }
export function Sfo_version_info(a, b, c) { return sfo_version_info(a, b, c); }
export function Sfo_context_info(a, b, c) { return sfo_context_info(a, b, c); }
export function Sfo_flag(a, b, c) { return sfo_flag(a, b, c); }
export function Sfo_you(a, b, c) { return sfo_you(a, b, c); }
export function Sfo_mvitals(a, b, c) { return sfo_mvitals(a, b, c); }
export function Sfo_q_score(a, b, c) { return sfo_q_score(a, b, c); }
export function Sfo_spell(a, b, c) { return sfo_spell(a, b, c); }
export function Sfo_dest_area(a, b, c) { return sfo_dest_area(a, b, c); }
export function Sfo_levelflags(a, b, c) { return sfo_levelflags(a, b, c); }
export function Sfo_rm(a, b, c) { return sfo_rm(a, b, c); }
export function Sfo_cemetery(a, b, c) { return sfo_cemetery(a, b, c); }
export function Sfo_damage(a, b, c) { return sfo_damage(a, b, c); }
export function Sfo_stairway(a, b, c) { return sfo_stairway(a, b, c); }
export function Sfo_obj(a, b, c) { return sfo_obj(a, b, c); }
export function Sfo_monst(a, b, c) { return sfo_monst(a, b, c); }
export function Sfo_ebones(a, b, c) { return sfo_ebones(a, b, c); }
export function Sfo_edog(a, b, c) { return sfo_edog(a, b, c); }
export function Sfo_egd(a, b, c) { return sfo_egd(a, b, c); }
export function Sfo_emin(a, b, c) { return sfo_emin(a, b, c); }

export function Sfo_epri(a, b, c) { return sfo_epri(a, b, c); }
export function Sfo_eshk(a, b, c) { return sfo_eshk(a, b, c); }
export function Sfo_trap(a, b, c) { return sfo_trap(a, b, c); }
export function Sfo_gamelog_line(a, b, c) { return sfo_gamelog_line(a, b, c); }
export function Sfo_fruit(a, b, c) { return sfo_fruit(a, b, c); }
export function Sfo_s_level(a, b, c) { return sfo_s_level(a, b, c); }
export function Sfo_short(a, b, c) { return sfo_short(a, b, c); }

export function Sfo_int(a, b, c) { return sfo_int(a, b, c); }
export function Sfo_unsigned(a, b, c) { return sfo_unsigned(a, b, c); }

export function Sfo_xint16(a, b, c) { return sfo_xint16(a, b, c); }
/* sfbase.c input functions */

export function Sfi_any(a, b, c) { return sfi_any(a, b, c); }

export function Sfi_coordxy(a, b, c) { return sfi_int16(a, b, c); }

export function Sfi_int32(a, b, c) { return sfi_int32(a, b, c); }

export function Sfi_uchar(a, b, c) { return sfi_uchar(a, b, c); }

export function Sfi_arti_info(a, b, c) { return sfi_arti_info(a, b, c); }
export function Sfi_dungeon(a, b, c) { return sfi_dungeon(a, b, c); }
export function Sfi_dgn_topology(a, b, c) { return sfi_dgn_topology(a, b, c); }
export function Sfi_branch(a, b, c) { return sfi_branch(a, b, c); }
export function Sfi_linfo(a, b, c) { return sfi_linfo(a, b, c); }
export function Sfi_nhcoord(a, b, c) { return sfi_nhcoord(a, b, c); }
export function Sfi_d_level(a, b, c) { return sfi_d_level(a, b, c); }
export function Sfi_mapseen_feat(a, b, c) { return sfi_mapseen_feat(a, b, c); }
export function Sfi_mapseen_flags(a, b, c) { return sfi_mapseen_flags(a, b, c); }
export function Sfi_mapseen_rooms(a, b, c) { return sfi_mapseen_rooms(a, b, c); }
export function Sfi_kinfo(a, b, c) { return sfi_kinfo(a, b, c); }
export function Sfi_engr(a, b, c) { return sfi_engr(a, b, c); }
export function Sfi_ls_t(a, b, c) { return sfi_ls_t(a, b, c); }
export function Sfi_bubble(a, b, c) { return sfi_bubble(a, b, c); }
export function Sfi_mkroom(a, b, c) { return sfi_mkroom(a, b, c); }
export function Sfi_objclass(a, b, c) { return sfi_objclass(a, b, c); }
export function Sfi_nhrect(a, b, c) { return sfi_nhrect(a, b, c); }
export function Sfi_fe(a, b, c) { return sfi_fe(a, b, c); }
export function Sfi_version_info(a, b, c) { return sfi_version_info(a, b, c); }
export function Sfi_context_info(a, b, c) { return sfi_context_info(a, b, c); }
export function Sfi_flag(a, b, c) { return sfi_flag(a, b, c); }
export function Sfi_you(a, b, c) { return sfi_you(a, b, c); }
export function Sfi_mvitals(a, b, c) { return sfi_mvitals(a, b, c); }
export function Sfi_q_score(a, b, c) { return sfi_q_score(a, b, c); }
export function Sfi_spell(a, b, c) { return sfi_spell(a, b, c); }
export function Sfi_dest_area(a, b, c) { return sfi_dest_area(a, b, c); }
export function Sfi_levelflags(a, b, c) { return sfi_levelflags(a, b, c); }
export function Sfi_rm(a, b, c) { return sfi_rm(a, b, c); }
export function Sfi_cemetery(a, b, c) { return sfi_cemetery(a, b, c); }
export function Sfi_damage(a, b, c) { return sfi_damage(a, b, c); }
export function Sfi_stairway(a, b, c) { return sfi_stairway(a, b, c); }
export function Sfi_obj(a, b, c) { return sfi_obj(a, b, c); }
export function Sfi_monst(a, b, c) { return sfi_monst(a, b, c); }
export function Sfi_ebones(a, b, c) { return sfi_ebones(a, b, c); }
export function Sfi_edog(a, b, c) { return sfi_edog(a, b, c); }
export function Sfi_egd(a, b, c) { return sfi_egd(a, b, c); }
export function Sfi_emin(a, b, c) { return sfi_emin(a, b, c); }

export function Sfi_epri(a, b, c) { return sfi_epri(a, b, c); }
export function Sfi_eshk(a, b, c) { return sfi_eshk(a, b, c); }
export function Sfi_trap(a, b, c) { return sfi_trap(a, b, c); }
export function Sfi_fruit(a, b, c) { return sfi_fruit(a, b, c); }
export function Sfi_gamelog_line(a, b, c) { return sfi_gamelog_line(a, b, c); }
export function Sfi_s_level(a, b, c) { return sfi_s_level(a, b, c); }
export function Sfi_short(a, b, c) { return sfi_short(a, b, c); }

/*    struct container * : sfo_container, */
/*    struct mapseen *   : sfo_mapseen,   */
/*    struct mextra *    : sfo_mextra,    */
/*    struct oextra *    : sfo_oextra,    */
/*    struct permonst *  : sfo_permonst,  */

/*    char *                : sfo_char,   */
/*    char *                : sfi_char,   */
/*    struct container * : sfi_container, */
/*    struct mapseen *   : sfi_mapseen,   */
/*    struct mextra *    : sfi_mextra,    */
/*    struct oextra *    : sfi_oextra,    */
/*    struct permonst *  : sfi_permonst,  */

/* sfbase.c input functions */

/* not in _Generic */

export function Sfo_boolean(a, b, c) { return sfo_boolean(a, b, c); }
export function Sfo_schar(a, b, c) { return sfo_schar(a, b, c); }

export function Sfi_char(a, b, c, d) { return sfi_char(a, b, c, d); }
export function Sfi_boolean(a, b, c) { return sfi_boolean(a, b, c); }
export function Sfi_schar(a, b, c) { return sfi_schar(a, b, c); }

import {
    sfi_any, sfi_arti_info, sfi_boolean, sfi_branch, sfi_bubble, sfi_cemetery, sfi_char,
    sfi_context_info, sfi_d_level, sfi_damage, sfi_dest_area, sfi_dgn_topology, sfi_dungeon,
    sfi_ebones, sfi_edog, sfi_egd, sfi_emin, sfi_engr, sfi_epri, sfi_eshk, sfi_fe, sfi_flag,
    sfi_fruit, sfi_gamelog_line, sfi_int16, sfi_int32, sfi_kinfo, sfi_levelflags, sfi_linfo,
    sfi_ls_t, sfi_mapseen_feat, sfi_mapseen_flags, sfi_mapseen_rooms, sfi_mkroom, sfi_monst,
    sfi_mvitals, sfi_nhcoord, sfi_nhrect, sfi_obj, sfi_objclass, sfi_q_score, sfi_rm, sfi_s_level,
    sfi_schar, sfi_short, sfi_spell, sfi_stairway, sfi_trap, sfi_uchar, sfi_version_info, sfi_you,
    sfo_any, sfo_arti_info, sfo_boolean, sfo_branch, sfo_bubble, sfo_cemetery, sfo_char,
    sfo_context_info, sfo_d_level, sfo_damage, sfo_dest_area, sfo_dgn_topology, sfo_dungeon,
    sfo_ebones, sfo_edog, sfo_egd, sfo_emin, sfo_engr, sfo_epri, sfo_eshk, sfo_fe, sfo_flag,
    sfo_fruit, sfo_gamelog_line, sfo_int, sfo_int16, sfo_int32, sfo_kinfo, sfo_levelflags,
    sfo_linfo, sfo_ls_t, sfo_mapseen_feat, sfo_mapseen_flags, sfo_mapseen_rooms, sfo_mkroom,
    sfo_monst, sfo_mvitals, sfo_nhcoord, sfo_nhrect, sfo_obj, sfo_objclass, sfo_q_score, sfo_rm,
    sfo_s_level, sfo_schar, sfo_short, sfo_spell, sfo_stairway, sfo_trap, sfo_uchar, sfo_unsigned,
    sfo_version_info, sfo_xint16, sfo_you,
} from "./sfbase.js";
