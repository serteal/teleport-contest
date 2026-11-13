/* NetHack 5.0	sfbase.c.template $NHDT-Date$  $NHDT-Branch$:$NHDT-Revision$ */
/* Copyright (c) Michael Allison, 2025. */
/* NetHack may be freely redistributed.  See license for details. */

/* #define DO_DEBUG */

//#define TURN_OFF_LOGGING 0x20
export const TURN_OFF_LOGGING = (UNCONVERTING << 1);

export const sfoprocs = static_array("sfoprocs", struct_sf_structlevel_procs, NUM_SAVEFORMATS); export const sfiprocs = static_array("sfiprocs", struct_sf_structlevel_procs, NUM_SAVEFORMATS);
export const zerosfoprocs = static_struct("zerosfoprocs", struct_sf_structlevel_procs, {ext: 0}); export const zerosfiprocs = static_struct("zerosfiprocs", struct_sf_structlevel_procs, {ext: 0});
export const sfoflprocs = static_array("sfoflprocs", struct_sf_fieldlevel_procs, NUM_SAVEFORMATS); export const sfiflprocs = static_array("sfiflprocs", struct_sf_fieldlevel_procs, NUM_SAVEFORMATS);
export const zerosfoflprocs = static_struct("zerosfoflprocs", struct_sf_fieldlevel_procs, {ext: 0}); export const zerosfiflprocs = static_struct("zerosfiflprocs", struct_sf_fieldlevel_procs, {ext: 0});

export function Sfvalue_aligntyp(a) { return sfvalue_aligntyp(a); }

export function Sfvalue_genericptr(a) { return sfvalue_genericptr(a); }
export function Sfvalue_coordxy(a) { return sfvalue_int16(a); }
export function Sfvalue_int16(a) { return sfvalue_int16(a); }
export function Sfvalue_int32(a) { return sfvalue_int32(a); }
export function Sfvalue_int64(a) { return sfvalue_int64(a); }
export function Sfvalue_uchar(a) { return sfvalue_uchar(a); }
export function Sfvalue_uint16(a) { return sfvalue_uint16(a); }
export function Sfvalue_uint32(a) { return sfvalue_uint32(a); }
export function Sfvalue_uint64(a) { return sfvalue_uint64(a); }

export function Sfvalue_short(a) { return sfvalue_short(a); }
export function Sfvalue_ushort(a) { return sfvalue_ushort(a); }
export function Sfvalue_int(a) { return sfvalue_int(a); }
export function Sfvalue_unsigned(a) { return sfvalue_unsigned(a); }
export function Sfvalue_xint8(a) { return sfvalue_xint8(a); }
export function Sfvalue_xint16(a) { return sfvalue_xint16(a); }

/* #else (#if NH_C < 202300LL): not in this build */

/* not in _Generic */

export function Sfvalue_ulong(a) { return sfvalue_ulong(a); }
export function Sfvalue_char(a, d) { return sfvalue_char(a, d); }
export function Sfvalue_boolean(a) { return sfvalue_boolean(a); }
export function Sfvalue_schar(a) { return sfvalue_schar(a); }
export function Sfvalue_bitfield(a) { return sfvalue_bitfield(a); }
export function Sfvalue_time_t(a) { return sfvalue_time_t(a); }
export function Sfvalue_size_t(a) { return sfvalue_size_t(a); }

export function sfo_bitfield(nhfp, d_bitfield, myname, bfsz) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(uchar), 1, Sfvalue_bitfield(d_bitfield)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_bitfield)(nhfp, d_bitfield, myname, bfsz); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_bitfield)(nhfp, d_bitfield, myname, bfsz); nhfp.fplog = save_fplog; } if ((nhfp.fplog && !nhfp.eof)) sf_log(nhfp, myname, sizeof(uchar), 1, Sfvalue_bitfield(d_bitfield)); }
export function sfi_bitfield(nhfp, d_bitfield, myname, bfsz) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_bitfield)(nhfp, d_bitfield, myname, bfsz); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_bitfield)(nhfp, d_bitfield, myname, bfsz); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_bitfield(nhfp.nhfpconvert, d_bitfield, myname, bfsz); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(uchar), 1, bitfield_dump(d_bitfield)); } }

export function sfo_char(nhfp, d_char, myname, cnt) { /* void */
    if (nhfp.fplog)
        sf_log(nhfp, myname, sizeof(char), cnt, Sfvalue_char(d_char, cnt));
    if (nhfp.structlevel) {
        (sfoprocs[nhfp.fnidx].fn.sf_char)(nhfp, d_char, myname, cnt);
    } else {
        let save_fplog = nhfp.fplog;

        nhfp.fplog = null;
        (sfoflprocs[nhfp.fnidx].fn_x.sf_char)(nhfp, d_char, myname, cnt);
        nhfp.fplog = save_fplog;
    }
}

export function sfi_char(nhfp, d_char, myname, cnt) { /* void */
    if (nhfp.structlevel) {
        (sfiprocs[nhfp.fnidx].fn.sf_char)(nhfp, d_char, myname, cnt);
    } else {
        let save_mode = nhfp.mode;

        nhfp.mode &= ~(CONVERTING | UNCONVERTING);
        nhfp.mode |= TURN_OFF_LOGGING;
        (sfiflprocs[nhfp.fnidx].fn_x.sf_char)(nhfp, d_char, myname, cnt);
        nhfp.mode = save_mode;
    }
    if (!nhfp.eof) {
        if ((((nhfp.mode & CONVERTING) != 0)
             || ((nhfp.mode & UNCONVERTING) != 0))
            && nhfp.nhfpconvert) {
            sfo_char(nhfp.nhfpconvert, d_char, myname, cnt);
        }
        if (nhfp.fplog)
            sf_log(nhfp, myname, sizeof(char), cnt,
                   Sfvalue_char(d_char, cnt));
    }
}

export function sfo_genericptr(nhfp, d_genericptr, myname) { /* void */
    if (nhfp.fplog)
        sf_log(nhfp, myname, sizeof(ptr_to(void_t)), 1,
               Sfvalue_genericptr(addr_of(d_genericptr)));
    if (nhfp.structlevel) {
        (sfoprocs[nhfp.fnidx].fn.sf_genericptr)(nhfp, d_genericptr, myname);
    } else {
        let save_fplog = nhfp.fplog;
        nhfp.fplog = null;
        (sfoflprocs[nhfp.fnidx].fn_x.sf_genericptr)(nhfp, d_genericptr,
                                                    myname);
        nhfp.fplog = save_fplog;
    }
}
export function sfi_genericptr(nhfp, d_genericptr, myname) { /* void */
    if (nhfp.structlevel) {
        (sfiprocs[nhfp.fnidx].fn.sf_genericptr)(nhfp, d_genericptr, myname);
    } else {
        let save_mode = nhfp.mode;
        nhfp.mode &= ~(CONVERTING | UNCONVERTING);
        nhfp.mode |= TURN_OFF_LOGGING;
        (sfiflprocs[nhfp.fnidx].fn_x.sf_genericptr)(nhfp, d_genericptr,
                                                    myname);
        nhfp.mode = save_mode;
    }
    if (!nhfp.eof) {
        if ((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0))
            && nhfp.nhfpconvert) {
            sfo_genericptr(nhfp.nhfpconvert, d_genericptr, myname);
        }
        if (nhfp.fplog)
            sf_log(nhfp, myname, sizeof(ptr_to(void_t)), 1,
                   Sfvalue_genericptr(addr_of(d_genericptr)));
    }
}

export function sfo_version_info(nhfp, d_version_info,
                 myname) { /* void */
    if (nhfp.fplog)
        sf_log(nhfp, myname, sizeof(struct_version_info), 1,
               complex_dump(addr_of(d_version_info)));
    if (nhfp.structlevel) {
        (sfoprocs[nhfp.fnidx].fn.sf_version_info)(nhfp, d_version_info,
                                                    myname);
    } else {
        let save_fplog = nhfp.fplog;
        nhfp.fplog = null;
        (sfoflprocs[nhfp.fnidx].fn_x.sf_version_info)(nhfp, d_version_info,
                                                      myname);
        nhfp.fplog = save_fplog;
    }
}
export function sfi_version_info(nhfp, d_version_info,
                 myname) { /* void */
    if (nhfp.structlevel) {
        (sfiprocs[nhfp.fnidx].fn.sf_version_info)(nhfp, d_version_info,
                                                    myname);
    } else {
        let save_mode = nhfp.mode;
        nhfp.mode &= ~(CONVERTING | UNCONVERTING);
        nhfp.mode |= TURN_OFF_LOGGING;
        (sfiflprocs[nhfp.fnidx].fn_x.sf_version_info)(nhfp, d_version_info,
                                                      myname);
        nhfp.mode = save_mode;
    }
    if (!nhfp.eof) {
        if ((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0))
            && nhfp.nhfpconvert) {
            d_version_info.feature_set = or64u(d_version_info.feature_set, SFCTOOL_BIT);
            sfo_version_info(nhfp.nhfpconvert, d_version_info, myname);
        }
        if (nhfp.fplog)
            sf_log(nhfp, myname, sizeof(struct_version_info), 1,
                   complex_dump(addr_of(d_version_info)));
    }
}

/* ---------------------------------------------------------------*/

export function sf_log(nhfp, t1, sz, cnt, txtvalue) { /* void */
    let fp = nhfp.fplog;
    let iocount;
    let dolog = +((nhfp.mode & TURN_OFF_LOGGING) == 0);

    if (fp && dolog) {
        iocount = ((nhfp.mode & WRITING) == 0) ? ref_of(nhfp, "rcount") : ref_of(nhfp, "wcount");
        fprintf(fp,

                       _("%08lld %s sz=%zu cnt=%d |%s|\n"),

                       iocount[0],
                       t1,

                       sz,

                       cnt, txtvalue);
//        (*iocount)++;
//        if (*iocount == 87)
//            __debugbreak();
        fflush(fp);
    }
}

export function sfvalue_char(a, n) { /* char * */
    let i;
    let buf = static_array("sfvalue_char.buf", char, 120);
    let cp;

    cp = buf + 0;
    if (n < (sizeof(array_of(char, 120)) - 1))
        chars[buf + n] = ord('\0');
    else
        chars[buf + (sizeof(array_of(char, 120)) - 1)] = ord('\0');
    for (i = 0; i < n; ++i, ++cp, ++a)
        chars[cp] = chars[a];
    chars[cp] = ord('\0');
    return buf;
}

export function sfvalue_boolean(a) { /* char * */
    let buf = static_array("sfvalue_boolean.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%s"), (chars[a] == 0) ? _("false") : _("true"))
;
    return buf;
}

export function sfvalue_schar(a) { /* char * */
    let buf = static_array("sfvalue_schar.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%d"), (chars[a]));
    return buf;
}

export function sfvalue_aligntyp(a) { /* char * */
    let buf = static_array("sfvalue_aligntyp.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%d"), (chars[a]));
    return buf;
}

export function sfvalue_any(a) { /* char * */
    let buf = static_array("sfvalue_any.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%lld"), a.a_int64)

;
    return buf;
}

export function sfvalue_genericptr(a) { /* char * */
    let buf = static_array("sfvalue_genericptr.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%s"), (a == 0) ? _("0") : _("glorkum"))
;
    return buf;
}

export function sfvalue_int16(a) { /* char * */
    let buf = static_array("sfvalue_int16.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%d"), a[0]);
    return buf;
}

export function sfvalue_int32(a) { /* char * */
    let buf = static_array("sfvalue_int32.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%d"), a[0]);
    return buf;
}

export function sfvalue_int64(a) { /* char * */
    let buf = static_array("sfvalue_int64.buf", char, 20);
    Snprintf(buf, sizeof(array_of(char, 20)), _("%lld"), a[0]);
    return buf;
}

export function sfvalue_uchar(a) { /* char * */
    let buf = static_array("sfvalue_uchar.buf", char, 20);
    let x;

    x = uchars[a];
    Snprintf(buf, sizeof(array_of(char, 20)), _("%03u"), x);
    return buf;
}

export function sfvalue_uint16(a) { /* char * */
    let buf = static_array("sfvalue_uint16.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%u"), (a[0]));
    return buf;
}

export function sfvalue_uint32(a) { /* char * */
    let buf = static_array("sfvalue_uint32.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%u"), a[0]);
    return buf;
}

export function sfvalue_uint64(a) { /* char * */
    let buf = static_array("sfvalue_uint64.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%llu"), a[0]);
    return buf;
}

export function sfvalue_size_t(a) { /* char * */
    let buf = static_array("sfvalue_size_t.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%s"), _(""));
    return buf;
}

export function sfvalue_time_t(a) { /* char * */
    let buf = static_array("sfvalue_time_t.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%s"), _(""));
    return buf;
}

export function sfvalue_short(a) { /* char * */
    let buf = static_array("sfvalue_short.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%d"), (a[0]));
    return buf;
}

export function sfvalue_ushort(a) { /* char * */
    let buf = static_array("sfvalue_ushort.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%u"), (a[0]));
    return buf;
}

export function sfvalue_int(a) { /* char * */
    let buf = static_array("sfvalue_int.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%d"), a[0]);
    return buf;
}

export function sfvalue_unsigned(a) { /* char * */
    let buf = static_array("sfvalue_unsigned.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%u"), a[0]);
    return buf;
}

export function sfvalue_long(a) { /* char * */
    let buf = static_array("sfvalue_long.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%lld"), a[0]);
    return buf;
}

export function sfvalue_ulong(a) { /* char * */
    let buf = static_array("sfvalue_ulong.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%llu"), a[0]);
    return buf;
}

export function sfvalue_xint8(a) { /* char * */
    let buf = static_array("sfvalue_xint8.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%d"), (chars[a]));
    return buf;
}

export function sfvalue_xint16(a) { /* char * */
    let buf = static_array("sfvalue_xint16.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%d"), (a[0]));
    return buf;
}

export function sfvalue_bitfield(a) { /* char * */
    let buf = static_array("sfvalue_bitfield.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%u"), (uchars[a]));
    return buf;
}

export function bitfield_dump(a) { /* char * */
    let buf = static_array("bitfield_dump.buf", char, 20);

    Snprintf(buf, sizeof(array_of(char, 20)), _("%u"), (uchars[a]));
    return buf;
}
export function complex_dump(a) { /* char * */
    const $frame = stack_frame(); try {
    let i;
    let uc = a;
    let buf = static_array("complex_dump.buf", char, 50);
    let x = stack_array(unsigned, 10);

    for (i = 0; i < SIZE(x); ++i) {
        x[i] = uchars[uc++];
    }
    Snprintf(buf, sizeof(array_of(char, 50)), _("%03x %03x %03x %03x %03x %03x %03x %03x %03x %03x"), x[0], x[1], x[2], x[3], x[4], x[5], x[6], x[7], x[8], x[9])
;
    chars[buf + 40] = ord('\0');
    return buf;
    } finally { stack_pop($frame); }
}
/*
 *----------------------------------------------------------------------------
 * initialize the function pointers. These are called from initoptions_init().
 *----------------------------------------------------------------------------
 */

export function sf_init() { /* void */
    struct_assign(sfoprocs[invalid], zerosfoprocs);
    struct_assign(sfiprocs[invalid], zerosfiprocs);
    struct_assign(sfoprocs[historical], historical_sfo_procs);
    struct_assign(sfiprocs[historical], historical_sfi_procs);
    struct_assign(sfoflprocs[exportascii], zerosfoflprocs);
    struct_assign(sfiflprocs[exportascii], zerosfiflprocs);
}

export function sf_setprocs(idx, sfi, sfo) { /* void */
    struct_assign(sfoprocs[idx], sfo);
    struct_assign(sfiprocs[idx], sfi);
}
export function sf_setflprocs(idx, flsfi,
            flsfo) { /* void */
    struct_assign(sfoflprocs[idx], flsfo);
    struct_assign(sfiflprocs[idx], flsfi);
}

export function norm_ptrs_any(d_any) { /* void */
}
export function norm_ptrs_align(d_align) { /* void */
}

export function norm_ptrs_arti_info(d_arti_info) { /* void */
}

export function norm_ptrs_attribs(d_attribs) { /* void */
}

export function norm_ptrs_bill_x(d_bill_x) { /* void */
}

export function norm_ptrs_branch(d_branch) { /* void */
}

export function norm_ptrs_bubble(d_bubble) { /* void */
}

export function norm_ptrs_cemetery(d_cemetery) { /* void */
}

export function norm_ptrs_context_info(d_context_info) { /* void */
}

export function norm_ptrs_achievement_tracking(d_achievement_tracking) { /* void */
}

export function norm_ptrs_book_info(d_book_info) { /* void */
}

export function norm_ptrs_dig_info(d_dig_info) { /* void */
}

export function norm_ptrs_engrave_info(d_engrave_info) { /* void */
}

export function norm_ptrs_obj_split(d_obj_split) { /* void */
}

export function norm_ptrs_polearm_info(d_polearm_info) { /* void */
}

export function norm_ptrs_takeoff_info(d_takeoff_info) { /* void */
}

export function norm_ptrs_tin_info(d_tin_info) { /* void */
}

export function norm_ptrs_tribute_info(d_tribute_info) { /* void */
}

export function norm_ptrs_victual_info(d_victual_info) { /* void */
}

export function norm_ptrs_warntype_info(d_warntype_info) { /* void */
}

export function norm_ptrs_d_flags(d_d_flags) { /* void */
}

export function norm_ptrs_d_level(d_d_level) { /* void */
}

export function norm_ptrs_damage(d_damage) { /* void */
}

export function norm_ptrs_dest_area(d_dest_area) { /* void */
}

export function norm_ptrs_dgn_topology(d_dgn_topology) { /* void */
}

export function norm_ptrs_dungeon(d_dungeon) { /* void */
}

export function norm_ptrs_ebones(d_ebones) { /* void */
}

export function norm_ptrs_edog(d_edog) { /* void */
}

export function norm_ptrs_egd(d_egd) { /* void */
}

export function norm_ptrs_emin(d_emin) { /* void */
}

export function norm_ptrs_engr(d_engr) { /* void */
}

export function norm_ptrs_epri(d_epri) { /* void */
}

export function norm_ptrs_eshk(d_eshk) { /* void */
}

export function norm_ptrs_fakecorridor(d_fakecorridor) { /* void */
}

export function norm_ptrs_fe(d_fe) { /* void */
}

export function norm_ptrs_flag(d_flag) { /* void */
}

export function norm_ptrs_fruit(d_fruit) { /* void */
}

export function norm_ptrs_gamelog_line(d_gamelog_line) { /* void */
}

export function norm_ptrs_kinfo(d_kinfo) { /* void */
}

export function norm_ptrs_levelflags(d_levelflags) { /* void */
}

export function norm_ptrs_linfo(d_linfo) { /* void */
}

export function norm_ptrs_ls_t(d_ls_t) { /* void */
}

export function norm_ptrs_mapseen_feat(d_mapseen_feat) { /* void */
}

export function norm_ptrs_mapseen_flags(d_mapseen_flags) { /* void */
}

export function norm_ptrs_mapseen_rooms(d_mapseen_rooms) { /* void */
}

export function norm_ptrs_mapseen(d_mapseen) { /* void */
}

export function norm_ptrs_mextra(d_mextra) { /* void */
}

export function norm_ptrs_mkroom(d_mkroom) { /* void */
}

export function norm_ptrs_monst(d_monst) { /* void */
}

export function norm_ptrs_mvitals(d_mvitals) { /* void */
}

export function norm_ptrs_nhcoord(d_nhcoord) { /* void */
}

export function norm_ptrs_nhrect(d_nhrect) { /* void */
}

export function norm_ptrs_novel_tracking(d_novel_tracking) { /* void */
}

export function norm_ptrs_obj(d_obj) { /* void */
}

export function norm_ptrs_objclass(d_objclass) { /* void */
}

export function norm_ptrs_oextra(d_oextra) { /* void */
}

export function norm_ptrs_prop(d_prop) { /* void */
}

export function norm_ptrs_q_score(d_q_score) { /* void */
}

export function norm_ptrs_rm(d_rm) { /* void */
}

export function norm_ptrs_s_level(d_s_level) { /* void */
}

export function norm_ptrs_skills(d_skills) { /* void */
}

export function norm_ptrs_spell(d_spell) { /* void */
}

export function norm_ptrs_stairway(d_stairway) { /* void */
}

export function norm_ptrs_trap(d_trap) { /* void */
}

export function norm_ptrs_u_conduct(d_u_conduct) { /* void */
}

export function norm_ptrs_u_event(d_u_event) { /* void */
}

export function norm_ptrs_u_have(d_u_have) { /* void */
}

export function norm_ptrs_u_realtime(d_u_realtime) { /* void */
}

export function norm_ptrs_u_roleplay(d_u_roleplay) { /* void */
}

export function norm_ptrs_version_info(d_version_info) { /* void */
}

export function norm_ptrs_vlaunchinfo(d_vlaunchinfo) { /* void */
}

export function norm_ptrs_vptrs(d_vptrs) { /* void */
}

export function norm_ptrs_you(d_you) { /* void */
}

/* end of sfbase.c */

/* long64: SF_C(long, long) serializes `long long` through the
   keyword form, which calls a pointer-normalization hook. */

export function norm_ptrs_long(d_long) { /* void */
    d_long;
}

import { struct_arti_info } from "./artifact.h.js";
import { struct_context_info } from "./context.h.js";
import { struct_nhcoord } from "./coord.h.js";
import {
    struct_branch, struct_d_level, struct_dest_area, struct_dungeon, struct_linfo,
    struct_mapseen_feat, struct_mapseen_flags, struct_mapseen_rooms, struct_s_level,
} from "./dungeon.h.js";
import { struct_engr } from "./engrave.h.js";
import { struct_flag } from "./flag.h.js";
import { SFCTOOL_BIT, struct_version_info } from "./global.h.js";
import {
    CONVERTING, NUM_SAVEFORMATS, UNCONVERTING, WRITING, exportascii, historical, invalid,
    struct_bubble, struct_dgn_topology, struct_gamelog_line, struct_kinfo, struct_ls_t,
    struct_mvitals,
} from "./hack.h.js";
import { Snprintf } from "./hacklib.h.macros.js";
import {
    struct_ebones, struct_edog, struct_egd, struct_emin, struct_epri, struct_eshk,
} from "./mextra.h.js";
import { struct_mkroom } from "./mkroom.h.js";
import { struct_monst } from "./monst.h.js";
import { struct_obj } from "./obj.h.js";
import { struct_fruit, struct_objclass } from "./objclass.h.js";
import { struct_q_score } from "./quest.h.js";
import { struct_nhrect } from "./rect.h.js";
import { struct_cemetery, struct_damage, struct_levelflags, struct_rm } from "./rm.h.js";
import { struct_sf_fieldlevel_procs, struct_sf_structlevel_procs } from "./sfprocs.h.js";
import { struct_spell } from "./spell.h.js";
import { struct_stairway } from "./stairs.h.js";
import { struct_fe } from "./timeout.h.js";
import { struct_trap } from "./trap.h.js";
import { struct_any } from "./wintype.h.js";
import { struct_you } from "./you.h.js";
import { SIZE } from "../rt/cmacros.js";
import {
    char, int, int64_t, long, ord, schar, short, sizeof, uchar, uint64_t, ulong, unsigned, ushort,
} from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { or64u } from "../rt/int64.js";
import { fflush, fprintf } from "../rt/libc.js";
import { stack_array, static_array, static_struct } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, array_of, ptr_to, ref_of, struct_assign, void_t } from "../rt/struct.js";
import { historical_sfi_procs, historical_sfo_procs } from "./sfstruct.js";

// defined by sfmacros.h (included above; at the line shown)
// sfmacros.h:9
export function sfo_arti_info(nhfp, d_arti_info, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_arti_info), 1, complex_dump(addr_of(d_arti_info))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_arti_info)(nhfp, d_arti_info, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_arti_info)(nhfp, d_arti_info, myname); nhfp.fplog = save_fplog; } }
export function sfi_arti_info(nhfp, d_arti_info, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_arti_info)(nhfp, d_arti_info, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_arti_info)(nhfp, d_arti_info, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_arti_info(nhfp.nhfpconvert, d_arti_info, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_arti_info), 1, complex_dump(addr_of(d_arti_info))); } }
// sfmacros.h:10
export function sfo_nhrect(nhfp, d_nhrect, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_nhrect), 1, complex_dump(addr_of(d_nhrect))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_nhrect)(nhfp, d_nhrect, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_nhrect)(nhfp, d_nhrect, myname); nhfp.fplog = save_fplog; } }
export function sfi_nhrect(nhfp, d_nhrect, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_nhrect)(nhfp, d_nhrect, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_nhrect)(nhfp, d_nhrect, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_nhrect(nhfp.nhfpconvert, d_nhrect, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_nhrect), 1, complex_dump(addr_of(d_nhrect))); } }
// sfmacros.h:11
export function sfo_branch(nhfp, d_branch, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_branch), 1, complex_dump(addr_of(d_branch))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_branch)(nhfp, d_branch, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_branch)(nhfp, d_branch, myname); nhfp.fplog = save_fplog; } }
export function sfi_branch(nhfp, d_branch, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_branch)(nhfp, d_branch, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_branch)(nhfp, d_branch, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_branch(nhfp.nhfpconvert, d_branch, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_branch), 1, complex_dump(addr_of(d_branch))); } }
// sfmacros.h:12
export function sfo_bubble(nhfp, d_bubble, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_bubble), 1, complex_dump(addr_of(d_bubble))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_bubble)(nhfp, d_bubble, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_bubble)(nhfp, d_bubble, myname); nhfp.fplog = save_fplog; } }
export function sfi_bubble(nhfp, d_bubble, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_bubble)(nhfp, d_bubble, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_bubble)(nhfp, d_bubble, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_bubble(nhfp.nhfpconvert, d_bubble, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_bubble), 1, complex_dump(addr_of(d_bubble))); } }
// sfmacros.h:13
export function sfo_cemetery(nhfp, d_cemetery, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_cemetery), 1, complex_dump(addr_of(d_cemetery))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_cemetery)(nhfp, d_cemetery, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_cemetery)(nhfp, d_cemetery, myname); nhfp.fplog = save_fplog; } }
export function sfi_cemetery(nhfp, d_cemetery, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_cemetery)(nhfp, d_cemetery, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_cemetery)(nhfp, d_cemetery, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_cemetery(nhfp.nhfpconvert, d_cemetery, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_cemetery), 1, complex_dump(addr_of(d_cemetery))); } }
// sfmacros.h:14
export function sfo_context_info(nhfp, d_context_info, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_context_info), 1, complex_dump(addr_of(d_context_info))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_context_info)(nhfp, d_context_info, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_context_info)(nhfp, d_context_info, myname); nhfp.fplog = save_fplog; } }
export function sfi_context_info(nhfp, d_context_info, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_context_info)(nhfp, d_context_info, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_context_info)(nhfp, d_context_info, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_context_info(nhfp.nhfpconvert, d_context_info, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_context_info), 1, complex_dump(addr_of(d_context_info))); } }
// sfmacros.h:15
export function sfo_nhcoord(nhfp, d_nhcoord, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_nhcoord), 1, complex_dump(addr_of(d_nhcoord))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_nhcoord)(nhfp, d_nhcoord, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_nhcoord)(nhfp, d_nhcoord, myname); nhfp.fplog = save_fplog; } }
export function sfi_nhcoord(nhfp, d_nhcoord, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_nhcoord)(nhfp, d_nhcoord, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_nhcoord)(nhfp, d_nhcoord, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_nhcoord(nhfp.nhfpconvert, d_nhcoord, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_nhcoord), 1, complex_dump(addr_of(d_nhcoord))); } }
// sfmacros.h:16
export function sfo_damage(nhfp, d_damage, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_damage), 1, complex_dump(addr_of(d_damage))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_damage)(nhfp, d_damage, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_damage)(nhfp, d_damage, myname); nhfp.fplog = save_fplog; } }
export function sfi_damage(nhfp, d_damage, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_damage)(nhfp, d_damage, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_damage)(nhfp, d_damage, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_damage(nhfp.nhfpconvert, d_damage, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_damage), 1, complex_dump(addr_of(d_damage))); } }
// sfmacros.h:17
export function sfo_dest_area(nhfp, d_dest_area, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_dest_area), 1, complex_dump(addr_of(d_dest_area))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_dest_area)(nhfp, d_dest_area, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_dest_area)(nhfp, d_dest_area, myname); nhfp.fplog = save_fplog; } }
export function sfi_dest_area(nhfp, d_dest_area, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_dest_area)(nhfp, d_dest_area, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_dest_area)(nhfp, d_dest_area, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_dest_area(nhfp.nhfpconvert, d_dest_area, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_dest_area), 1, complex_dump(addr_of(d_dest_area))); } }
// sfmacros.h:18
export function sfo_dgn_topology(nhfp, d_dgn_topology, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_dgn_topology), 1, complex_dump(addr_of(d_dgn_topology))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_dgn_topology)(nhfp, d_dgn_topology, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_dgn_topology)(nhfp, d_dgn_topology, myname); nhfp.fplog = save_fplog; } }
export function sfi_dgn_topology(nhfp, d_dgn_topology, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_dgn_topology)(nhfp, d_dgn_topology, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_dgn_topology)(nhfp, d_dgn_topology, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_dgn_topology(nhfp.nhfpconvert, d_dgn_topology, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_dgn_topology), 1, complex_dump(addr_of(d_dgn_topology))); } }
// sfmacros.h:19
export function sfo_dungeon(nhfp, d_dungeon, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_dungeon), 1, complex_dump(addr_of(d_dungeon))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_dungeon)(nhfp, d_dungeon, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_dungeon)(nhfp, d_dungeon, myname); nhfp.fplog = save_fplog; } }
export function sfi_dungeon(nhfp, d_dungeon, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_dungeon)(nhfp, d_dungeon, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_dungeon)(nhfp, d_dungeon, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_dungeon(nhfp.nhfpconvert, d_dungeon, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_dungeon), 1, complex_dump(addr_of(d_dungeon))); } }
// sfmacros.h:20
export function sfo_d_level(nhfp, d_d_level, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_d_level), 1, complex_dump(addr_of(d_d_level))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_d_level)(nhfp, d_d_level, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_d_level)(nhfp, d_d_level, myname); nhfp.fplog = save_fplog; } }
export function sfi_d_level(nhfp, d_d_level, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_d_level)(nhfp, d_d_level, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_d_level)(nhfp, d_d_level, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_d_level(nhfp.nhfpconvert, d_d_level, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_d_level), 1, complex_dump(addr_of(d_d_level))); } }
// sfmacros.h:21
export function sfo_ebones(nhfp, d_ebones, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_ebones), 1, complex_dump(addr_of(d_ebones))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_ebones)(nhfp, d_ebones, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_ebones)(nhfp, d_ebones, myname); nhfp.fplog = save_fplog; } }
export function sfi_ebones(nhfp, d_ebones, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_ebones)(nhfp, d_ebones, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_ebones)(nhfp, d_ebones, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_ebones(nhfp.nhfpconvert, d_ebones, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_ebones), 1, complex_dump(addr_of(d_ebones))); } }
// sfmacros.h:22
export function sfo_edog(nhfp, d_edog, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_edog), 1, complex_dump(addr_of(d_edog))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_edog)(nhfp, d_edog, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_edog)(nhfp, d_edog, myname); nhfp.fplog = save_fplog; } }
export function sfi_edog(nhfp, d_edog, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_edog)(nhfp, d_edog, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_edog)(nhfp, d_edog, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_edog(nhfp.nhfpconvert, d_edog, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_edog), 1, complex_dump(addr_of(d_edog))); } }
// sfmacros.h:23
export function sfo_egd(nhfp, d_egd, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_egd), 1, complex_dump(addr_of(d_egd))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_egd)(nhfp, d_egd, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_egd)(nhfp, d_egd, myname); nhfp.fplog = save_fplog; } }
export function sfi_egd(nhfp, d_egd, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_egd)(nhfp, d_egd, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_egd)(nhfp, d_egd, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_egd(nhfp.nhfpconvert, d_egd, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_egd), 1, complex_dump(addr_of(d_egd))); } }
// sfmacros.h:24
export function sfo_emin(nhfp, d_emin, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_emin), 1, complex_dump(addr_of(d_emin))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_emin)(nhfp, d_emin, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_emin)(nhfp, d_emin, myname); nhfp.fplog = save_fplog; } }
export function sfi_emin(nhfp, d_emin, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_emin)(nhfp, d_emin, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_emin)(nhfp, d_emin, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_emin(nhfp.nhfpconvert, d_emin, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_emin), 1, complex_dump(addr_of(d_emin))); } }
// sfmacros.h:25
export function sfo_engr(nhfp, d_engr, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_engr), 1, complex_dump(addr_of(d_engr))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_engr)(nhfp, d_engr, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_engr)(nhfp, d_engr, myname); nhfp.fplog = save_fplog; } }
export function sfi_engr(nhfp, d_engr, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_engr)(nhfp, d_engr, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_engr)(nhfp, d_engr, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_engr(nhfp.nhfpconvert, d_engr, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_engr), 1, complex_dump(addr_of(d_engr))); } }
// sfmacros.h:26
export function sfo_epri(nhfp, d_epri, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_epri), 1, complex_dump(addr_of(d_epri))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_epri)(nhfp, d_epri, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_epri)(nhfp, d_epri, myname); nhfp.fplog = save_fplog; } }
export function sfi_epri(nhfp, d_epri, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_epri)(nhfp, d_epri, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_epri)(nhfp, d_epri, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_epri(nhfp.nhfpconvert, d_epri, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_epri), 1, complex_dump(addr_of(d_epri))); } }
// sfmacros.h:27
export function sfo_eshk(nhfp, d_eshk, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_eshk), 1, complex_dump(addr_of(d_eshk))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_eshk)(nhfp, d_eshk, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_eshk)(nhfp, d_eshk, myname); nhfp.fplog = save_fplog; } }
export function sfi_eshk(nhfp, d_eshk, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_eshk)(nhfp, d_eshk, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_eshk)(nhfp, d_eshk, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_eshk(nhfp.nhfpconvert, d_eshk, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_eshk), 1, complex_dump(addr_of(d_eshk))); } }
// sfmacros.h:28
export function sfo_fe(nhfp, d_fe, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_fe), 1, complex_dump(addr_of(d_fe))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_fe)(nhfp, d_fe, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_fe)(nhfp, d_fe, myname); nhfp.fplog = save_fplog; } }
export function sfi_fe(nhfp, d_fe, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_fe)(nhfp, d_fe, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_fe)(nhfp, d_fe, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_fe(nhfp.nhfpconvert, d_fe, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_fe), 1, complex_dump(addr_of(d_fe))); } }
// sfmacros.h:29
export function sfo_flag(nhfp, d_flag, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_flag), 1, complex_dump(addr_of(d_flag))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_flag)(nhfp, d_flag, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_flag)(nhfp, d_flag, myname); nhfp.fplog = save_fplog; } }
export function sfi_flag(nhfp, d_flag, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_flag)(nhfp, d_flag, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_flag)(nhfp, d_flag, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_flag(nhfp.nhfpconvert, d_flag, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_flag), 1, complex_dump(addr_of(d_flag))); } }
// sfmacros.h:30
export function sfo_fruit(nhfp, d_fruit, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_fruit), 1, complex_dump(addr_of(d_fruit))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_fruit)(nhfp, d_fruit, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_fruit)(nhfp, d_fruit, myname); nhfp.fplog = save_fplog; } }
export function sfi_fruit(nhfp, d_fruit, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_fruit)(nhfp, d_fruit, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_fruit)(nhfp, d_fruit, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_fruit(nhfp.nhfpconvert, d_fruit, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_fruit), 1, complex_dump(addr_of(d_fruit))); } }
// sfmacros.h:31
export function sfo_gamelog_line(nhfp, d_gamelog_line, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_gamelog_line), 1, complex_dump(addr_of(d_gamelog_line))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_gamelog_line)(nhfp, d_gamelog_line, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_gamelog_line)(nhfp, d_gamelog_line, myname); nhfp.fplog = save_fplog; } }
export function sfi_gamelog_line(nhfp, d_gamelog_line, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_gamelog_line)(nhfp, d_gamelog_line, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_gamelog_line)(nhfp, d_gamelog_line, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_gamelog_line(nhfp.nhfpconvert, d_gamelog_line, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_gamelog_line), 1, complex_dump(addr_of(d_gamelog_line))); } }
// sfmacros.h:32
export function sfo_kinfo(nhfp, d_kinfo, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_kinfo), 1, complex_dump(addr_of(d_kinfo))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_kinfo)(nhfp, d_kinfo, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_kinfo)(nhfp, d_kinfo, myname); nhfp.fplog = save_fplog; } }
export function sfi_kinfo(nhfp, d_kinfo, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_kinfo)(nhfp, d_kinfo, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_kinfo)(nhfp, d_kinfo, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_kinfo(nhfp.nhfpconvert, d_kinfo, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_kinfo), 1, complex_dump(addr_of(d_kinfo))); } }
// sfmacros.h:33
export function sfo_levelflags(nhfp, d_levelflags, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_levelflags), 1, complex_dump(addr_of(d_levelflags))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_levelflags)(nhfp, d_levelflags, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_levelflags)(nhfp, d_levelflags, myname); nhfp.fplog = save_fplog; } }
export function sfi_levelflags(nhfp, d_levelflags, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_levelflags)(nhfp, d_levelflags, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_levelflags)(nhfp, d_levelflags, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_levelflags(nhfp.nhfpconvert, d_levelflags, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_levelflags), 1, complex_dump(addr_of(d_levelflags))); } }
// sfmacros.h:34
export function sfo_ls_t(nhfp, d_ls_t, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_ls_t), 1, complex_dump(addr_of(d_ls_t))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_ls_t)(nhfp, d_ls_t, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_ls_t)(nhfp, d_ls_t, myname); nhfp.fplog = save_fplog; } }
export function sfi_ls_t(nhfp, d_ls_t, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_ls_t)(nhfp, d_ls_t, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_ls_t)(nhfp, d_ls_t, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_ls_t(nhfp.nhfpconvert, d_ls_t, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_ls_t), 1, complex_dump(addr_of(d_ls_t))); } }
// sfmacros.h:35
export function sfo_linfo(nhfp, d_linfo, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_linfo), 1, complex_dump(addr_of(d_linfo))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_linfo)(nhfp, d_linfo, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_linfo)(nhfp, d_linfo, myname); nhfp.fplog = save_fplog; } }
export function sfi_linfo(nhfp, d_linfo, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_linfo)(nhfp, d_linfo, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_linfo)(nhfp, d_linfo, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_linfo(nhfp.nhfpconvert, d_linfo, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_linfo), 1, complex_dump(addr_of(d_linfo))); } }
// sfmacros.h:36
export function sfo_mapseen_feat(nhfp, d_mapseen_feat, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_mapseen_feat), 1, complex_dump(addr_of(d_mapseen_feat))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_mapseen_feat)(nhfp, d_mapseen_feat, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_mapseen_feat)(nhfp, d_mapseen_feat, myname); nhfp.fplog = save_fplog; } }
export function sfi_mapseen_feat(nhfp, d_mapseen_feat, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_mapseen_feat)(nhfp, d_mapseen_feat, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_mapseen_feat)(nhfp, d_mapseen_feat, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_mapseen_feat(nhfp.nhfpconvert, d_mapseen_feat, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_mapseen_feat), 1, complex_dump(addr_of(d_mapseen_feat))); } }
// sfmacros.h:37
export function sfo_mapseen_flags(nhfp, d_mapseen_flags, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_mapseen_flags), 1, complex_dump(addr_of(d_mapseen_flags))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_mapseen_flags)(nhfp, d_mapseen_flags, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_mapseen_flags)(nhfp, d_mapseen_flags, myname); nhfp.fplog = save_fplog; } }
export function sfi_mapseen_flags(nhfp, d_mapseen_flags, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_mapseen_flags)(nhfp, d_mapseen_flags, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_mapseen_flags)(nhfp, d_mapseen_flags, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_mapseen_flags(nhfp.nhfpconvert, d_mapseen_flags, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_mapseen_flags), 1, complex_dump(addr_of(d_mapseen_flags))); } }
// sfmacros.h:38
export function sfo_mapseen_rooms(nhfp, d_mapseen_rooms, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_mapseen_rooms), 1, complex_dump(addr_of(d_mapseen_rooms))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_mapseen_rooms)(nhfp, d_mapseen_rooms, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_mapseen_rooms)(nhfp, d_mapseen_rooms, myname); nhfp.fplog = save_fplog; } }
export function sfi_mapseen_rooms(nhfp, d_mapseen_rooms, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_mapseen_rooms)(nhfp, d_mapseen_rooms, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_mapseen_rooms)(nhfp, d_mapseen_rooms, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_mapseen_rooms(nhfp.nhfpconvert, d_mapseen_rooms, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_mapseen_rooms), 1, complex_dump(addr_of(d_mapseen_rooms))); } }
// sfmacros.h:39
export function sfo_mkroom(nhfp, d_mkroom, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_mkroom), 1, complex_dump(addr_of(d_mkroom))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_mkroom)(nhfp, d_mkroom, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_mkroom)(nhfp, d_mkroom, myname); nhfp.fplog = save_fplog; } }
export function sfi_mkroom(nhfp, d_mkroom, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_mkroom)(nhfp, d_mkroom, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_mkroom)(nhfp, d_mkroom, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_mkroom(nhfp.nhfpconvert, d_mkroom, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_mkroom), 1, complex_dump(addr_of(d_mkroom))); } }
// sfmacros.h:40
export function sfo_monst(nhfp, d_monst, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_monst), 1, complex_dump(addr_of(d_monst))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_monst)(nhfp, d_monst, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_monst)(nhfp, d_monst, myname); nhfp.fplog = save_fplog; } }
export function sfi_monst(nhfp, d_monst, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_monst)(nhfp, d_monst, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_monst)(nhfp, d_monst, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_monst(nhfp.nhfpconvert, d_monst, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_monst), 1, complex_dump(addr_of(d_monst))); } }
// sfmacros.h:41
export function sfo_mvitals(nhfp, d_mvitals, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_mvitals), 1, complex_dump(addr_of(d_mvitals))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_mvitals)(nhfp, d_mvitals, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_mvitals)(nhfp, d_mvitals, myname); nhfp.fplog = save_fplog; } }
export function sfi_mvitals(nhfp, d_mvitals, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_mvitals)(nhfp, d_mvitals, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_mvitals)(nhfp, d_mvitals, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_mvitals(nhfp.nhfpconvert, d_mvitals, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_mvitals), 1, complex_dump(addr_of(d_mvitals))); } }
// sfmacros.h:42
export function sfo_obj(nhfp, d_obj, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_obj), 1, complex_dump(addr_of(d_obj))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_obj)(nhfp, d_obj, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_obj)(nhfp, d_obj, myname); nhfp.fplog = save_fplog; } }
export function sfi_obj(nhfp, d_obj, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_obj)(nhfp, d_obj, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_obj)(nhfp, d_obj, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_obj(nhfp.nhfpconvert, d_obj, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_obj), 1, complex_dump(addr_of(d_obj))); } }
// sfmacros.h:43
export function sfo_objclass(nhfp, d_objclass, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_objclass), 1, complex_dump(addr_of(d_objclass))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_objclass)(nhfp, d_objclass, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_objclass)(nhfp, d_objclass, myname); nhfp.fplog = save_fplog; } }
export function sfi_objclass(nhfp, d_objclass, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_objclass)(nhfp, d_objclass, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_objclass)(nhfp, d_objclass, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_objclass(nhfp.nhfpconvert, d_objclass, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_objclass), 1, complex_dump(addr_of(d_objclass))); } }
// sfmacros.h:44
export function sfo_q_score(nhfp, d_q_score, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_q_score), 1, complex_dump(addr_of(d_q_score))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_q_score)(nhfp, d_q_score, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_q_score)(nhfp, d_q_score, myname); nhfp.fplog = save_fplog; } }
export function sfi_q_score(nhfp, d_q_score, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_q_score)(nhfp, d_q_score, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_q_score)(nhfp, d_q_score, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_q_score(nhfp.nhfpconvert, d_q_score, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_q_score), 1, complex_dump(addr_of(d_q_score))); } }
// sfmacros.h:45
export function sfo_rm(nhfp, d_rm, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_rm), 1, complex_dump(addr_of(d_rm))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_rm)(nhfp, d_rm, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_rm)(nhfp, d_rm, myname); nhfp.fplog = save_fplog; } }
export function sfi_rm(nhfp, d_rm, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_rm)(nhfp, d_rm, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_rm)(nhfp, d_rm, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_rm(nhfp.nhfpconvert, d_rm, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_rm), 1, complex_dump(addr_of(d_rm))); } }
// sfmacros.h:46
export function sfo_spell(nhfp, d_spell, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_spell), 1, complex_dump(addr_of(d_spell))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_spell)(nhfp, d_spell, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_spell)(nhfp, d_spell, myname); nhfp.fplog = save_fplog; } }
export function sfi_spell(nhfp, d_spell, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_spell)(nhfp, d_spell, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_spell)(nhfp, d_spell, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_spell(nhfp.nhfpconvert, d_spell, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_spell), 1, complex_dump(addr_of(d_spell))); } }
// sfmacros.h:47
export function sfo_stairway(nhfp, d_stairway, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_stairway), 1, complex_dump(addr_of(d_stairway))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_stairway)(nhfp, d_stairway, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_stairway)(nhfp, d_stairway, myname); nhfp.fplog = save_fplog; } }
export function sfi_stairway(nhfp, d_stairway, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_stairway)(nhfp, d_stairway, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_stairway)(nhfp, d_stairway, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_stairway(nhfp.nhfpconvert, d_stairway, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_stairway), 1, complex_dump(addr_of(d_stairway))); } }
// sfmacros.h:48
export function sfo_s_level(nhfp, d_s_level, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_s_level), 1, complex_dump(addr_of(d_s_level))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_s_level)(nhfp, d_s_level, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_s_level)(nhfp, d_s_level, myname); nhfp.fplog = save_fplog; } }
export function sfi_s_level(nhfp, d_s_level, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_s_level)(nhfp, d_s_level, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_s_level)(nhfp, d_s_level, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_s_level(nhfp.nhfpconvert, d_s_level, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_s_level), 1, complex_dump(addr_of(d_s_level))); } }
// sfmacros.h:49
export function sfo_trap(nhfp, d_trap, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_trap), 1, complex_dump(addr_of(d_trap))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_trap)(nhfp, d_trap, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_trap)(nhfp, d_trap, myname); nhfp.fplog = save_fplog; } }
export function sfi_trap(nhfp, d_trap, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_trap)(nhfp, d_trap, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_trap)(nhfp, d_trap, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_trap(nhfp.nhfpconvert, d_trap, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_trap), 1, complex_dump(addr_of(d_trap))); } }
// sfmacros.h:50
export function sfo_you(nhfp, d_you, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_you), 1, complex_dump(addr_of(d_you))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_you)(nhfp, d_you, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_you)(nhfp, d_you, myname); nhfp.fplog = save_fplog; } }
export function sfi_you(nhfp, d_you, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_you)(nhfp, d_you, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_you)(nhfp, d_you, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_you(nhfp.nhfpconvert, d_you, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_you), 1, complex_dump(addr_of(d_you))); } }
// sfmacros.h:51
export function sfo_any(nhfp, d_any, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_any), 1, complex_dump(addr_of(d_any))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_any)(nhfp, d_any, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_any)(nhfp, d_any, myname); nhfp.fplog = save_fplog; } }
export function sfi_any(nhfp, d_any, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_any)(nhfp, d_any, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_any)(nhfp, d_any, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_any(nhfp.nhfpconvert, d_any, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(struct_any), 1, complex_dump(addr_of(d_any))); } }
// sfmacros.h:53
export function sfo_aligntyp(nhfp, d_aligntyp, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(schar), 1, Sfvalue_aligntyp(d_aligntyp)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_aligntyp)(nhfp, d_aligntyp, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_aligntyp)(nhfp, d_aligntyp, myname); nhfp.fplog = save_fplog; } }
export function sfi_aligntyp(nhfp, d_aligntyp, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_aligntyp)(nhfp, d_aligntyp, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_aligntyp)(nhfp, d_aligntyp, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_aligntyp(nhfp.nhfpconvert, d_aligntyp, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(schar), 1, Sfvalue_aligntyp(d_aligntyp)); } }
// sfmacros.h:54
export function sfo_boolean(nhfp, d_boolean, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(schar), 1, Sfvalue_boolean(d_boolean)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_boolean)(nhfp, d_boolean, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_boolean)(nhfp, d_boolean, myname); nhfp.fplog = save_fplog; } }
export function sfi_boolean(nhfp, d_boolean, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_boolean)(nhfp, d_boolean, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_boolean)(nhfp, d_boolean, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_boolean(nhfp.nhfpconvert, d_boolean, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(schar), 1, Sfvalue_boolean(d_boolean)); } }
// sfmacros.h:55
export function sfo_coordxy(nhfp, d_coordxy, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(short), 1, Sfvalue_coordxy(d_coordxy)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_coordxy)(nhfp, d_coordxy, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_coordxy)(nhfp, d_coordxy, myname); nhfp.fplog = save_fplog; } }
export function sfi_coordxy(nhfp, d_coordxy, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_coordxy)(nhfp, d_coordxy, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_coordxy)(nhfp, d_coordxy, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_coordxy(nhfp.nhfpconvert, d_coordxy, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(short), 1, Sfvalue_coordxy(d_coordxy)); } }
// sfmacros.h:57
export function sfo_int(nhfp, d_int, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(int), 1, Sfvalue_int(d_int)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_int)(nhfp, d_int, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_int)(nhfp, d_int, myname); nhfp.fplog = save_fplog; } }
export function sfi_int(nhfp, d_int, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_int)(nhfp, d_int, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_int)(nhfp, d_int, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_int(nhfp.nhfpconvert, d_int, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(int), 1, Sfvalue_int(d_int)); } }
// sfmacros.h:58
export function sfo_int16(nhfp, d_int16, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(short), 1, Sfvalue_int16(d_int16)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_int16)(nhfp, d_int16, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_int16)(nhfp, d_int16, myname); nhfp.fplog = save_fplog; } }
export function sfi_int16(nhfp, d_int16, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_int16)(nhfp, d_int16, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_int16)(nhfp, d_int16, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_int16(nhfp.nhfpconvert, d_int16, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(short), 1, Sfvalue_int16(d_int16)); } }
// sfmacros.h:59
export function sfo_int32(nhfp, d_int32, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(int), 1, Sfvalue_int32(d_int32)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_int32)(nhfp, d_int32, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_int32)(nhfp, d_int32, myname); nhfp.fplog = save_fplog; } }
export function sfi_int32(nhfp, d_int32, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_int32)(nhfp, d_int32, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_int32)(nhfp, d_int32, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_int32(nhfp.nhfpconvert, d_int32, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(int), 1, Sfvalue_int32(d_int32)); } }
// sfmacros.h:60
export function sfo_int64(nhfp, d_int64, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(int64_t), 1, Sfvalue_int64(d_int64)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_int64)(nhfp, d_int64, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_int64)(nhfp, d_int64, myname); nhfp.fplog = save_fplog; } }
export function sfi_int64(nhfp, d_int64, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_int64)(nhfp, d_int64, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_int64)(nhfp, d_int64, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_int64(nhfp.nhfpconvert, d_int64, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(int64_t), 1, Sfvalue_int64(d_int64)); } }
// sfmacros.h:61
export function sfo_long(nhfp, d_long, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(long), 1, complex_dump(addr_of(d_long))); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_long)(nhfp, d_long, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_long)(nhfp, d_long, myname); nhfp.fplog = save_fplog; } }
export function sfi_long(nhfp, d_long, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_long)(nhfp, d_long, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_long)(nhfp, d_long, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_long(nhfp.nhfpconvert, d_long, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(long), 1, complex_dump(addr_of(d_long))); } }
// sfmacros.h:62
export function sfo_schar(nhfp, d_schar, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(schar), 1, Sfvalue_schar(d_schar)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_schar)(nhfp, d_schar, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_schar)(nhfp, d_schar, myname); nhfp.fplog = save_fplog; } }
export function sfi_schar(nhfp, d_schar, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_schar)(nhfp, d_schar, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_schar)(nhfp, d_schar, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_schar(nhfp.nhfpconvert, d_schar, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(schar), 1, Sfvalue_schar(d_schar)); } }
// sfmacros.h:63
export function sfo_short(nhfp, d_short, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(short), 1, Sfvalue_short(d_short)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_short)(nhfp, d_short, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_short)(nhfp, d_short, myname); nhfp.fplog = save_fplog; } }
export function sfi_short(nhfp, d_short, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_short)(nhfp, d_short, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_short)(nhfp, d_short, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_short(nhfp.nhfpconvert, d_short, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(short), 1, Sfvalue_short(d_short)); } }
// sfmacros.h:64
export function sfo_size_t(nhfp, d_size_t, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(unsigned), 1, Sfvalue_size_t(d_size_t)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_size_t)(nhfp, d_size_t, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_size_t)(nhfp, d_size_t, myname); nhfp.fplog = save_fplog; } }
export function sfi_size_t(nhfp, d_size_t, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_size_t)(nhfp, d_size_t, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_size_t)(nhfp, d_size_t, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_size_t(nhfp.nhfpconvert, d_size_t, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(unsigned), 1, Sfvalue_size_t(d_size_t)); } }
// sfmacros.h:65
export function sfo_time_t(nhfp, d_time_t, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(long), 1, Sfvalue_time_t(d_time_t)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_time_t)(nhfp, d_time_t, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_time_t)(nhfp, d_time_t, myname); nhfp.fplog = save_fplog; } }
export function sfi_time_t(nhfp, d_time_t, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_time_t)(nhfp, d_time_t, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_time_t)(nhfp, d_time_t, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_time_t(nhfp.nhfpconvert, d_time_t, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(long), 1, Sfvalue_time_t(d_time_t)); } }
// sfmacros.h:66
export function sfo_uchar(nhfp, d_uchar, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(uchar), 1, Sfvalue_uchar(d_uchar)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_uchar)(nhfp, d_uchar, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_uchar)(nhfp, d_uchar, myname); nhfp.fplog = save_fplog; } }
export function sfi_uchar(nhfp, d_uchar, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_uchar)(nhfp, d_uchar, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_uchar)(nhfp, d_uchar, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_uchar(nhfp.nhfpconvert, d_uchar, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(uchar), 1, Sfvalue_uchar(d_uchar)); } }
// sfmacros.h:67
export function sfo_uint16(nhfp, d_uint16, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(ushort), 1, Sfvalue_uint16(d_uint16)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_uint16)(nhfp, d_uint16, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_uint16)(nhfp, d_uint16, myname); nhfp.fplog = save_fplog; } }
export function sfi_uint16(nhfp, d_uint16, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_uint16)(nhfp, d_uint16, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_uint16)(nhfp, d_uint16, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_uint16(nhfp.nhfpconvert, d_uint16, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(ushort), 1, Sfvalue_uint16(d_uint16)); } }
// sfmacros.h:68
export function sfo_uint32(nhfp, d_uint32, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(unsigned), 1, Sfvalue_uint32(d_uint32)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_uint32)(nhfp, d_uint32, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_uint32)(nhfp, d_uint32, myname); nhfp.fplog = save_fplog; } }
export function sfi_uint32(nhfp, d_uint32, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_uint32)(nhfp, d_uint32, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_uint32)(nhfp, d_uint32, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_uint32(nhfp.nhfpconvert, d_uint32, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(unsigned), 1, Sfvalue_uint32(d_uint32)); } }
// sfmacros.h:69
export function sfo_uint64(nhfp, d_uint64, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(uint64_t), 1, Sfvalue_uint64(d_uint64)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_uint64)(nhfp, d_uint64, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_uint64)(nhfp, d_uint64, myname); nhfp.fplog = save_fplog; } }
export function sfi_uint64(nhfp, d_uint64, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_uint64)(nhfp, d_uint64, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_uint64)(nhfp, d_uint64, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_uint64(nhfp.nhfpconvert, d_uint64, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(uint64_t), 1, Sfvalue_uint64(d_uint64)); } }
// sfmacros.h:70
export function sfo_ulong(nhfp, d_ulong, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(ulong), 1, Sfvalue_ulong(d_ulong)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_ulong)(nhfp, d_ulong, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_ulong)(nhfp, d_ulong, myname); nhfp.fplog = save_fplog; } }
export function sfi_ulong(nhfp, d_ulong, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_ulong)(nhfp, d_ulong, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_ulong)(nhfp, d_ulong, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_ulong(nhfp.nhfpconvert, d_ulong, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(ulong), 1, Sfvalue_ulong(d_ulong)); } }
// sfmacros.h:71
export function sfo_unsigned(nhfp, d_unsigned, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(unsigned), 1, Sfvalue_unsigned(d_unsigned)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_unsigned)(nhfp, d_unsigned, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_unsigned)(nhfp, d_unsigned, myname); nhfp.fplog = save_fplog; } }
export function sfi_unsigned(nhfp, d_unsigned, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_unsigned)(nhfp, d_unsigned, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_unsigned)(nhfp, d_unsigned, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_unsigned(nhfp.nhfpconvert, d_unsigned, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(unsigned), 1, Sfvalue_unsigned(d_unsigned)); } }
// sfmacros.h:72
export function sfo_ushort(nhfp, d_ushort, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(ushort), 1, Sfvalue_ushort(d_ushort)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_ushort)(nhfp, d_ushort, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_ushort)(nhfp, d_ushort, myname); nhfp.fplog = save_fplog; } }
export function sfi_ushort(nhfp, d_ushort, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_ushort)(nhfp, d_ushort, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_ushort)(nhfp, d_ushort, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_ushort(nhfp.nhfpconvert, d_ushort, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(ushort), 1, Sfvalue_ushort(d_ushort)); } }
// sfmacros.h:73
export function sfo_xint16(nhfp, d_xint16, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(short), 1, Sfvalue_xint16(d_xint16)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_xint16)(nhfp, d_xint16, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_xint16)(nhfp, d_xint16, myname); nhfp.fplog = save_fplog; } }
export function sfi_xint16(nhfp, d_xint16, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_xint16)(nhfp, d_xint16, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_xint16)(nhfp, d_xint16, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_xint16(nhfp.nhfpconvert, d_xint16, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(short), 1, Sfvalue_xint16(d_xint16)); } }
// sfmacros.h:74
export function sfo_xint8(nhfp, d_xint8, myname) { /* void */ if (nhfp.fplog) sf_log(nhfp, myname, sizeof(schar), 1, Sfvalue_xint8(d_xint8)); if (nhfp.structlevel) { (sfoprocs[nhfp.fnidx].fn.sf_xint8)(nhfp, d_xint8, myname); } else { let save_fplog = nhfp.fplog; nhfp.fplog = null; (sfoflprocs[nhfp.fnidx].fn_x.sf_xint8)(nhfp, d_xint8, myname); nhfp.fplog = save_fplog; } }
export function sfi_xint8(nhfp, d_xint8, myname) { /* void */ if (nhfp.structlevel) { (sfiprocs[nhfp.fnidx].fn.sf_xint8)(nhfp, d_xint8, myname); } else { let save_mode = nhfp.mode; nhfp.mode &= ~(CONVERTING | UNCONVERTING); nhfp.mode |= TURN_OFF_LOGGING; (sfiflprocs[nhfp.fnidx].fn_x.sf_xint8)(nhfp, d_xint8, myname); nhfp.mode = save_mode; } if (!nhfp.eof) { if (((((nhfp.mode & CONVERTING) != 0) || ((nhfp.mode & UNCONVERTING) != 0)) && nhfp.nhfpconvert)) { sfo_xint8(nhfp.nhfpconvert, d_xint8, myname); } if (nhfp.fplog) sf_log(nhfp, myname, sizeof(schar), 1, Sfvalue_xint8(d_xint8)); } }
