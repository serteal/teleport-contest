/* NetHack 3.6 sfprocs.h	Tue Nov  6 19:38:48 2018 */
/* Copyright (c) NetHack Development Team 2025.                   */
/* NetHack may be freely redistributed.  See license for details. */

export const struct_sf_procs = struct("struct_sf_procs", {
    sf_arti_info: fnptr_t,
    sf_nhrect: fnptr_t,
    sf_branch: fnptr_t,
    sf_bubble: fnptr_t,
    sf_cemetery: fnptr_t,
    sf_context_info: fnptr_t,
    sf_nhcoord: fnptr_t,
    sf_damage: fnptr_t,
    sf_dest_area: fnptr_t,
    sf_dgn_topology: fnptr_t,
    sf_dungeon: fnptr_t,
    sf_d_level: fnptr_t,
    sf_ebones: fnptr_t,
    sf_edog: fnptr_t,
    sf_egd: fnptr_t,
    sf_emin: fnptr_t,
    sf_engr: fnptr_t,
    sf_epri: fnptr_t,
    sf_eshk: fnptr_t,
    sf_fe: fnptr_t,
    sf_flag: fnptr_t,
    sf_fruit: fnptr_t,
    sf_gamelog_line: fnptr_t,
    sf_kinfo: fnptr_t,
    sf_levelflags: fnptr_t,
    sf_ls_t: fnptr_t,
    sf_linfo: fnptr_t,
    sf_mapseen_feat: fnptr_t,
    sf_mapseen_flags: fnptr_t,
    sf_mapseen_rooms: fnptr_t,
    sf_mkroom: fnptr_t,
    sf_monst: fnptr_t,
    sf_mvitals: fnptr_t,
    sf_obj: fnptr_t,
    sf_objclass: fnptr_t,
    sf_q_score: fnptr_t,
    sf_rm: fnptr_t,
    sf_spell: fnptr_t,
    sf_stairway: fnptr_t,
    sf_s_level: fnptr_t,
    sf_trap: fnptr_t,
    sf_version_info: fnptr_t,
    sf_you: fnptr_t,
    sf_any: fnptr_t,

    sf_aligntyp: fnptr_t,
    sf_boolean: fnptr_t,
    sf_coordxy: fnptr_t,
    sf_genericptr: fnptr_t,
    sf_int: fnptr_t,
    sf_int16: fnptr_t,
    sf_int32: fnptr_t,
    sf_int64: fnptr_t,
    sf_long: fnptr_t,
    sf_schar: fnptr_t,
    sf_short: fnptr_t,
    sf_size_t: fnptr_t,
    sf_time_t: fnptr_t,
    sf_uchar: fnptr_t,
    sf_uint16: fnptr_t,
    sf_uint32: fnptr_t,
    sf_uint64: fnptr_t,
    sf_ulong: fnptr_t,
    sf_unsigned: fnptr_t,
    sf_ushort: fnptr_t,
    sf_xint16: fnptr_t,
    sf_xint8: fnptr_t,
    sf_char: fnptr_t,
    sf_bitfield: fnptr_t,
});

export const struct_sf_structlevel_procs = struct("struct_sf_structlevel_procs", {
    ext: ptr_to(char),
    fn: "struct_sf_procs", /* called for structlevel (historical) */
});
export const struct_sf_fieldlevel_procs = struct("struct_sf_fieldlevel_procs", {
    ext: ptr_to(char),
    fn_x: "struct_sf_procs", /* called for fieldlevel */
});

import { char } from "../rt/ctypes.js";
import { fnptr_t, ptr_to, struct } from "../rt/struct.js";
