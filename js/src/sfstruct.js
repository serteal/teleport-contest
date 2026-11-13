/* NetHack 5.0	sfstruct.c	$NHDT-Date: 1606765215 2020/11/30 19:40:15 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.4 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2025. */
/* NetHack may be freely redistributed.  See license for details. */

/* #define SFLOGGING */          /* debugging */

/* historical full struct savings */

export function historical_sfo_version_info(nhfp, d_version_info, myname) { /* void */ norm_ptrs_version_info(d_version_info); bwrite(nhfp.fd, addr_of(d_version_info), sizeof(struct_version_info)); }
export function historical_sfi_version_info(nhfp, d_version_info, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_version_info), sizeof(struct_version_info)); norm_ptrs_version_info(d_version_info); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }

export function historical_sfo_char(nhfp, d_char,
                    myname, cnt) { /* void */
    bwrite(nhfp.fd, d_char, unsigned(cnt) * sizeof(char));
}

export function historical_sfi_char(nhfp, d_char,
                    myname, cnt) { /* void */
    mread(nhfp.fd, d_char, unsigned(cnt) * sizeof(char));
    if (restoreinfo.mread_flags == -1)
        nhfp.eof = TRUE;
}
//extern void sfo_genericptr(NHFILE *, void **, const char *);
//extern void sfi_genericptr(NHFILE *, void **, const char *);
//extern void sfo_x_genericptr(NHFILE *, void **, const char *);
//extern void sfi_x_genericptr(NHFILE *, void **, const char *);

export function historical_sfo_genericptr_t(nhfp, d_genericptr_t,
                            myname) { /* void */
    bwrite(nhfp.fd, addr_of(d_genericptr_t), sizeof(ptr_to(void_t)));
}
export function historical_sfi_genericptr_t(nhfp, d_genericptr_t,
                            myname) { /* void */
    if (nhfp.eof) {
        sfstruct_read_error();
    }
    mread(nhfp.fd, addr_of(d_genericptr_t), sizeof(ptr_to(void_t)));
    if (restoreinfo.mread_flags == -1)
        nhfp.eof = TRUE;
}

export function historical_sfo_bitfield(nhfp, d_bitfield, myname, bflen) { /* void */ bwrite(nhfp.fd, d_bitfield, sizeof(uchar)); }
export function historical_sfi_bitfield(nhfp, d_bitfield, myname, bflen) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, d_bitfield, sizeof(uchar)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }

export const historical_sfo_procs = static_struct("historical_sfo_procs", struct_sf_structlevel_procs, {
    ext: _(""),
    /* sf */
    fn: {
        sf_arti_info: historical_sfo_arti_info,
        sf_nhrect: historical_sfo_nhrect,
        sf_branch: historical_sfo_branch,
        sf_bubble: historical_sfo_bubble,
        sf_cemetery: historical_sfo_cemetery,
        sf_context_info: historical_sfo_context_info,
        sf_nhcoord: historical_sfo_nhcoord,
        sf_damage: historical_sfo_damage,
        sf_dest_area: historical_sfo_dest_area,
        sf_dgn_topology: historical_sfo_dgn_topology,
        sf_dungeon: historical_sfo_dungeon,
        sf_d_level: historical_sfo_d_level,
        sf_ebones: historical_sfo_ebones,
        sf_edog: historical_sfo_edog,
        sf_egd: historical_sfo_egd,
        sf_emin: historical_sfo_emin,
        sf_engr: historical_sfo_engr,
        sf_epri: historical_sfo_epri,
        sf_eshk: historical_sfo_eshk,
        sf_fe: historical_sfo_fe,
        sf_flag: historical_sfo_flag,
        sf_fruit: historical_sfo_fruit,
        sf_gamelog_line: historical_sfo_gamelog_line,
        sf_kinfo: historical_sfo_kinfo,
        sf_levelflags: historical_sfo_levelflags,
        sf_ls_t: historical_sfo_ls_t,
        sf_linfo: historical_sfo_linfo,
        sf_mapseen_feat: historical_sfo_mapseen_feat,
        sf_mapseen_flags: historical_sfo_mapseen_flags,
        sf_mapseen_rooms: historical_sfo_mapseen_rooms,
        sf_mkroom: historical_sfo_mkroom,
        sf_monst: historical_sfo_monst,
        sf_mvitals: historical_sfo_mvitals,
        sf_obj: historical_sfo_obj,
        sf_objclass: historical_sfo_objclass,
        sf_q_score: historical_sfo_q_score,
        sf_rm: historical_sfo_rm,
        sf_spell: historical_sfo_spell,
        sf_stairway: historical_sfo_stairway,
        sf_s_level: historical_sfo_s_level,
        sf_trap: historical_sfo_trap,
        sf_version_info: historical_sfo_version_info,
        sf_you: historical_sfo_you,
        sf_any: historical_sfo_any,

        sf_aligntyp: historical_sfo_aligntyp,
        sf_boolean: historical_sfo_boolean,
        sf_coordxy: historical_sfo_coordxy,
        sf_genericptr: historical_sfo_genericptr_t,
        sf_int: historical_sfo_int,
        sf_int16: historical_sfo_int16,
        sf_int32: historical_sfo_int32,
        sf_int64: historical_sfo_int64,
        sf_long: historical_sfo_long,
        sf_schar: historical_sfo_schar,
        sf_short: historical_sfo_short,
        sf_size_t: historical_sfo_size_t,
        sf_time_t: historical_sfo_time_t,
        sf_uchar: historical_sfo_uchar,
        sf_uint16: historical_sfo_uint16,
        sf_uint32: historical_sfo_uint32,
        sf_uint64: historical_sfo_uint64,
        sf_ulong: historical_sfo_ulong,
        sf_unsigned: historical_sfo_unsigned,
        sf_ushort: historical_sfo_ushort,
        sf_xint16: historical_sfo_xint16,
        sf_xint8: historical_sfo_xint8,
        sf_char: historical_sfo_char,
        sf_bitfield: historical_sfo_bitfield,
    }
});

export const historical_sfi_procs = static_struct("historical_sfi_procs", struct_sf_structlevel_procs, {
    ext: _(""),
    /* sf */
    fn: {
        sf_arti_info: historical_sfi_arti_info,
        sf_nhrect: historical_sfi_nhrect,
        sf_branch: historical_sfi_branch,
        sf_bubble: historical_sfi_bubble,
        sf_cemetery: historical_sfi_cemetery,
        sf_context_info: historical_sfi_context_info,
        sf_nhcoord: historical_sfi_nhcoord,
        sf_damage: historical_sfi_damage,
        sf_dest_area: historical_sfi_dest_area,
        sf_dgn_topology: historical_sfi_dgn_topology,
        sf_dungeon: historical_sfi_dungeon,
        sf_d_level: historical_sfi_d_level,
        sf_ebones: historical_sfi_ebones,
        sf_edog: historical_sfi_edog,
        sf_egd: historical_sfi_egd,
        sf_emin: historical_sfi_emin,
        sf_engr: historical_sfi_engr,
        sf_epri: historical_sfi_epri,
        sf_eshk: historical_sfi_eshk,
        sf_fe: historical_sfi_fe,
        sf_flag: historical_sfi_flag,
        sf_fruit: historical_sfi_fruit,
        sf_gamelog_line: historical_sfi_gamelog_line,
        sf_kinfo: historical_sfi_kinfo,
        sf_levelflags: historical_sfi_levelflags,
        sf_ls_t: historical_sfi_ls_t,
        sf_linfo: historical_sfi_linfo,
        sf_mapseen_feat: historical_sfi_mapseen_feat,
        sf_mapseen_flags: historical_sfi_mapseen_flags,
        sf_mapseen_rooms: historical_sfi_mapseen_rooms,
        sf_mkroom: historical_sfi_mkroom,
        sf_monst: historical_sfi_monst,
        sf_mvitals: historical_sfi_mvitals,
        sf_obj: historical_sfi_obj,
        sf_objclass: historical_sfi_objclass,
        sf_q_score: historical_sfi_q_score,
        sf_rm: historical_sfi_rm,
        sf_spell: historical_sfi_spell,
        sf_stairway: historical_sfi_stairway,
        sf_s_level: historical_sfi_s_level,
        sf_trap: historical_sfi_trap,
        sf_version_info: historical_sfi_version_info,
        sf_you: historical_sfi_you,
        sf_any: historical_sfi_any,

        sf_aligntyp: historical_sfi_aligntyp,
        sf_boolean: historical_sfi_boolean,
        sf_coordxy: historical_sfi_coordxy,
        sf_genericptr: historical_sfi_genericptr_t,
        sf_int: historical_sfi_int,
        sf_int16: historical_sfi_int16,
        sf_int32: historical_sfi_int32,
        sf_int64: historical_sfi_int64,
        sf_long: historical_sfi_long,
        sf_schar: historical_sfi_schar,
        sf_short: historical_sfi_short,
        sf_size_t: historical_sfi_size_t,
        sf_time_t: historical_sfi_time_t,
        sf_uchar: historical_sfi_uchar,
        sf_uint16: historical_sfi_uint16,
        sf_uint32: historical_sfi_uint32,
        sf_uint64: historical_sfi_uint64,
        sf_ulong: historical_sfi_ulong,
        sf_unsigned: historical_sfi_unsigned,
        sf_ushort: historical_sfi_ushort,
        sf_xint16: historical_sfi_xint16,
        sf_xint8: historical_sfi_xint8,
        sf_char: historical_sfi_char,
        sf_bitfield: historical_sfi_bitfield,
    }
});

/*
 * The historical bwrite() and mread() functions follow
 */

/*
 * historical structlevel savefile writing and reading routines follow.
 * These were moved here from save.c and restore.c between 3.6.3 and 5.0.0,.
 */

export const restoreinfo = static_struct("restoreinfo", struct_restore_info, {
    name: _("externalcomp"), mread_flags: 0,
});

export const MAXFD = 5;
const NOFLG = 0; const NOSLOT = 1;
const bw_sticky = static_array("bw_sticky", int, MAXFD, [-1,-1,-1,-1,-1]);
const bw_buffered = static_array("bw_buffered", int, MAXFD, [0,0,0,0,0]);

const bw_FILE = static_array("bw_FILE", ptr_to("struct__IO_FILE"), MAXFD, [null,null,null,null,null]);

/* #ifdef SFLOGGING: not in this build */

/*
 * Presumably, the fdopen() to allow use of stdio fwrite()
 * over write() was done for performance or functionality
 * reasons to help some particular platform long ago.
 *
 * There have been some issues being encountered with the
 * implementation due to having an individual set of
 * tracking variables, even though there were nested
 * sets of open fd (like INSURANCE).
 *
 * This uses an individual tracking entry for each fd
 * being used.
 *
 * Some notes:
 *
 * Once buffered IO (stdio) has been enabled on the file
 * associated with a descriptor via fdopen():
 *
 *    1. If you use bufoff and bufon to try to toggle the
 *       use of write vs fwrite; the code just tracks which
 *       routine is to be called through the tracking
 *       variables and acts accordingly.
 *             bw_sticky[]    -  used to find the index number for
 *                               the fd that is stored in it, or -1
 *                               if it is a free slot.
 *             bw_buffered[]  -  indicator that buffered IO routines
 *                               are available for use.
 *             bw_FILE[]      -  the non-zero FILE * for use in calling
 *                               fwrite() when bw_buffered[] is also
 *                               non-zero.
 *
 *    2. It is illegal to call close(fd) after fdopen(), you
 *       must always use fclose() on the FILE * from
 *       that point on, so care must be taken to never call
 *       close(fd) on the underlying fd or bad things will
 *       happen.
 */

function getidx(fd, flg) { /* int */
    let i, retval = -1;

    for (i = 0; i < MAXFD; ++i)
        if (bw_sticky[i] == fd)
            return i;
    if (flg == NOSLOT)
        return retval;
    for (i = 0; i < MAXFD; ++i)
        if (bw_sticky[i] < 0) {
            bw_sticky[i] = fd;
            retval = i;
            break;
        }
    return retval;
}

/* Let caller know that bclose() should handle it (TRUE) */
export function close_check(fd) { /* boolean */
    let idx = getidx(fd, NOSLOT);
    let retval = FALSE;

    if (idx >= 0)
        retval = TRUE;
    return retval;
}

export function bufon(fd) { /* void */
    let idx = getidx(fd, NOFLG);

    if (idx >= 0) {
        bw_sticky[idx] = fd;

        if (bw_buffered[idx])
            panic(_("buffering already enabled"));
        if (!bw_FILE[idx]) {
            if ((bw_FILE[idx] = fdopen(fd, _("w"))) == null)
                panic(_("buffering of file %d failed"), fd);
        }
        bw_buffered[idx] = +(bw_FILE[idx] != null);
    }
}

export function bufoff(fd) { /* void */
    let idx = getidx(fd, NOFLG);

    if (idx >= 0) {
        bflush(fd);
        bw_buffered[idx] = 0;     /* just a flag that says "use write(fd)" */
    }
}

export function bclose(fd) { /* void */
    let idx = getidx(fd, NOSLOT);

    bufoff(fd);     /* sets bw_buffered[idx] = 0 */
    if (idx >= 0) {
        if (bw_FILE[idx]) {
            fclose(bw_FILE[idx]);
            bw_FILE[idx] = null;
        } else

            close(fd);
        /* return the idx to the pool */
        bw_sticky[idx] = -1;
    }
    /* #ifdef SFLOGGING: not in this build */

    return;
}

export function bflush(fd) { /* void */
    let idx = getidx(fd, NOFLG);

    if (idx >= 0) {
        if (bw_FILE[idx]) {
           if (fflush(bw_FILE[idx]) == EOF)
               panic(_("flush of savefile failed!"));
        }
    }
    return;
}

export function bwrite(fd, loc, num) { /* void */
    let failed;
    let idx = getidx(fd, NOFLG);

    /* #ifdef SFLOGGING: not in this build */

    if (idx >= 0) {
        if (num == 0) {
            /* nothing to do; we need a special case to exit early
               because glibc fwrite doesn't give reliable
               success/failure indication when writing 0 bytes */
            return;
        }

        if (bw_buffered[idx] && bw_FILE[idx]) {
            failed = +(fwrite(loc, unsigned(int(num)), 1, bw_FILE[idx]) != 1);
        } else

        {
            /* lint wants 3rd arg of write to be an int; lint -p an unsigned */

            failed = +(write(fd, loc, num) != num);
        }
        if (failed) {
            if (program_state.done_hup)
                nh_terminate(EXIT_FAILURE);
            else

                panic(_("cannot write %u bytes to file #%d"), num, fd);
        }
    } else
        impossible(_("fd not in list (%d)?"), fd);
}

/*  ===================================================== */

export function mread(fd, buf, len) { /* void */
    /* #ifdef SFLOGGING: not in this build */

    let rlen;
        /* Not perfect, but we don't have ssize_t available. */
    rlen = unsigned(read(fd, buf, len));
    if (rlen != len) {
        if ((restoreinfo.mread_flags == 1) /* means "return anyway" */
            || (program_state.reading_bonesfile == 1)) {
            restoreinfo.mread_flags = -1;
            return;
        } else {
            pline(_("Read %d instead of %u bytes."), int(rlen), len);
            display_nhwindow()(WIN_MESSAGE, TRUE); /* flush before error() */
            if (program_state.restoring) {
                nhclose(fd);
                delete_savefile();
                error(_("Error restoring old game."));
            }
            panic(_("Error reading level file."));
        }
    }
}

function sfstruct_read_error() { /* void */
    /* problem */;
}

/* #ifdef SFLOGGING: not in this build */

/* end of sfstruct.c */

import { struct_arti_info } from "./artifact.h.js";
import { struct_context_info } from "./context.h.js";
import { struct_nhcoord } from "./coord.h.js";
import {
    struct_branch, struct_d_level, struct_dest_area, struct_dungeon, struct_linfo,
    struct_mapseen_feat, struct_mapseen_flags, struct_mapseen_rooms, struct_s_level,
} from "./dungeon.h.js";
import { struct_engr } from "./engrave.h.js";
import { struct_flag } from "./flag.h.js";
import { FALSE, TRUE, struct_version_info } from "./global.h.js";
import {
    struct_bubble, struct_dgn_topology, struct_gamelog_line, struct_kinfo, struct_ls_t,
    struct_mvitals, struct_restore_info,
} from "./hack.h.js";
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
import { struct_sf_structlevel_procs } from "./sfprocs.h.js";
import { struct_spell } from "./spell.h.js";
import { struct_stairway } from "./stairs.h.js";
import { struct_fe } from "./timeout.h.js";
import { struct_trap } from "./trap.h.js";
import { display_nhwindow } from "./winprocs.h.macros.js";
import { struct_any } from "./wintype.h.js";
import { struct_you } from "./you.h.js";
import {
    char, int, int64_t, long, schar, short, sizeof, uchar, uint64_t, ulong, unsigned, ushort,
} from "../rt/ctypes.js";
import {
    EOF, EXIT_FAILURE, close, fclose, fdopen, fflush, fwrite, read, write,
} from "../rt/libc.js";
import { static_array, static_struct } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, ptr_to, void_t } from "../rt/struct.js";
import { program_state } from "./decl.js";
import { nh_terminate, panic } from "./end.js";
import { delete_savefile, nhclose } from "./files.js";
import { impossible, pline } from "./pline.js";
import {
    norm_ptrs_any, norm_ptrs_arti_info, norm_ptrs_branch, norm_ptrs_bubble, norm_ptrs_cemetery,
    norm_ptrs_context_info, norm_ptrs_d_level, norm_ptrs_damage, norm_ptrs_dest_area,
    norm_ptrs_dgn_topology, norm_ptrs_dungeon, norm_ptrs_ebones, norm_ptrs_edog, norm_ptrs_egd,
    norm_ptrs_emin, norm_ptrs_engr, norm_ptrs_epri, norm_ptrs_eshk, norm_ptrs_fe, norm_ptrs_flag,
    norm_ptrs_fruit, norm_ptrs_gamelog_line, norm_ptrs_kinfo, norm_ptrs_levelflags, norm_ptrs_linfo,
    norm_ptrs_long, norm_ptrs_ls_t, norm_ptrs_mapseen_feat, norm_ptrs_mapseen_flags,
    norm_ptrs_mapseen_rooms, norm_ptrs_mkroom, norm_ptrs_monst, norm_ptrs_mvitals,
    norm_ptrs_nhcoord, norm_ptrs_nhrect, norm_ptrs_obj, norm_ptrs_objclass, norm_ptrs_q_score,
    norm_ptrs_rm, norm_ptrs_s_level, norm_ptrs_spell, norm_ptrs_stairway, norm_ptrs_trap,
    norm_ptrs_version_info, norm_ptrs_you,
} from "./sfbase.js";
import { error } from "../sys/c2js/nhjs_host.js";

// defined by sfmacros.h (included above; at the line shown)
// sfmacros.h:9
export function historical_sfo_arti_info(nhfp, d_arti_info, myname) { /* void */ norm_ptrs_arti_info(d_arti_info); bwrite(nhfp.fd, addr_of(d_arti_info), sizeof(struct_arti_info)); }
export function historical_sfi_arti_info(nhfp, d_arti_info, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_arti_info), sizeof(struct_arti_info)); norm_ptrs_arti_info(d_arti_info); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:10
export function historical_sfo_nhrect(nhfp, d_nhrect, myname) { /* void */ norm_ptrs_nhrect(d_nhrect); bwrite(nhfp.fd, addr_of(d_nhrect), sizeof(struct_nhrect)); }
export function historical_sfi_nhrect(nhfp, d_nhrect, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_nhrect), sizeof(struct_nhrect)); norm_ptrs_nhrect(d_nhrect); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:11
export function historical_sfo_branch(nhfp, d_branch, myname) { /* void */ norm_ptrs_branch(d_branch); bwrite(nhfp.fd, addr_of(d_branch), sizeof(struct_branch)); }
export function historical_sfi_branch(nhfp, d_branch, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_branch), sizeof(struct_branch)); norm_ptrs_branch(d_branch); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:12
export function historical_sfo_bubble(nhfp, d_bubble, myname) { /* void */ norm_ptrs_bubble(d_bubble); bwrite(nhfp.fd, addr_of(d_bubble), sizeof(struct_bubble)); }
export function historical_sfi_bubble(nhfp, d_bubble, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_bubble), sizeof(struct_bubble)); norm_ptrs_bubble(d_bubble); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:13
export function historical_sfo_cemetery(nhfp, d_cemetery, myname) { /* void */ norm_ptrs_cemetery(d_cemetery); bwrite(nhfp.fd, addr_of(d_cemetery), sizeof(struct_cemetery)); }
export function historical_sfi_cemetery(nhfp, d_cemetery, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_cemetery), sizeof(struct_cemetery)); norm_ptrs_cemetery(d_cemetery); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:14
export function historical_sfo_context_info(nhfp, d_context_info, myname) { /* void */ norm_ptrs_context_info(d_context_info); bwrite(nhfp.fd, addr_of(d_context_info), sizeof(struct_context_info)); }
export function historical_sfi_context_info(nhfp, d_context_info, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_context_info), sizeof(struct_context_info)); norm_ptrs_context_info(d_context_info); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:15
export function historical_sfo_nhcoord(nhfp, d_nhcoord, myname) { /* void */ norm_ptrs_nhcoord(d_nhcoord); bwrite(nhfp.fd, addr_of(d_nhcoord), sizeof(struct_nhcoord)); }
export function historical_sfi_nhcoord(nhfp, d_nhcoord, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_nhcoord), sizeof(struct_nhcoord)); norm_ptrs_nhcoord(d_nhcoord); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:16
export function historical_sfo_damage(nhfp, d_damage, myname) { /* void */ norm_ptrs_damage(d_damage); bwrite(nhfp.fd, addr_of(d_damage), sizeof(struct_damage)); }
export function historical_sfi_damage(nhfp, d_damage, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_damage), sizeof(struct_damage)); norm_ptrs_damage(d_damage); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:17
export function historical_sfo_dest_area(nhfp, d_dest_area, myname) { /* void */ norm_ptrs_dest_area(d_dest_area); bwrite(nhfp.fd, addr_of(d_dest_area), sizeof(struct_dest_area)); }
export function historical_sfi_dest_area(nhfp, d_dest_area, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_dest_area), sizeof(struct_dest_area)); norm_ptrs_dest_area(d_dest_area); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:18
export function historical_sfo_dgn_topology(nhfp, d_dgn_topology, myname) { /* void */ norm_ptrs_dgn_topology(d_dgn_topology); bwrite(nhfp.fd, addr_of(d_dgn_topology), sizeof(struct_dgn_topology)); }
export function historical_sfi_dgn_topology(nhfp, d_dgn_topology, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_dgn_topology), sizeof(struct_dgn_topology)); norm_ptrs_dgn_topology(d_dgn_topology); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:19
export function historical_sfo_dungeon(nhfp, d_dungeon, myname) { /* void */ norm_ptrs_dungeon(d_dungeon); bwrite(nhfp.fd, addr_of(d_dungeon), sizeof(struct_dungeon)); }
export function historical_sfi_dungeon(nhfp, d_dungeon, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_dungeon), sizeof(struct_dungeon)); norm_ptrs_dungeon(d_dungeon); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:20
export function historical_sfo_d_level(nhfp, d_d_level, myname) { /* void */ norm_ptrs_d_level(d_d_level); bwrite(nhfp.fd, addr_of(d_d_level), sizeof(struct_d_level)); }
export function historical_sfi_d_level(nhfp, d_d_level, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_d_level), sizeof(struct_d_level)); norm_ptrs_d_level(d_d_level); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:21
export function historical_sfo_ebones(nhfp, d_ebones, myname) { /* void */ norm_ptrs_ebones(d_ebones); bwrite(nhfp.fd, addr_of(d_ebones), sizeof(struct_ebones)); }
export function historical_sfi_ebones(nhfp, d_ebones, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_ebones), sizeof(struct_ebones)); norm_ptrs_ebones(d_ebones); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:22
export function historical_sfo_edog(nhfp, d_edog, myname) { /* void */ norm_ptrs_edog(d_edog); bwrite(nhfp.fd, addr_of(d_edog), sizeof(struct_edog)); }
export function historical_sfi_edog(nhfp, d_edog, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_edog), sizeof(struct_edog)); norm_ptrs_edog(d_edog); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:23
export function historical_sfo_egd(nhfp, d_egd, myname) { /* void */ norm_ptrs_egd(d_egd); bwrite(nhfp.fd, addr_of(d_egd), sizeof(struct_egd)); }
export function historical_sfi_egd(nhfp, d_egd, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_egd), sizeof(struct_egd)); norm_ptrs_egd(d_egd); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:24
export function historical_sfo_emin(nhfp, d_emin, myname) { /* void */ norm_ptrs_emin(d_emin); bwrite(nhfp.fd, addr_of(d_emin), sizeof(struct_emin)); }
export function historical_sfi_emin(nhfp, d_emin, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_emin), sizeof(struct_emin)); norm_ptrs_emin(d_emin); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:25
export function historical_sfo_engr(nhfp, d_engr, myname) { /* void */ norm_ptrs_engr(d_engr); bwrite(nhfp.fd, addr_of(d_engr), sizeof(struct_engr)); }
export function historical_sfi_engr(nhfp, d_engr, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_engr), sizeof(struct_engr)); norm_ptrs_engr(d_engr); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:26
export function historical_sfo_epri(nhfp, d_epri, myname) { /* void */ norm_ptrs_epri(d_epri); bwrite(nhfp.fd, addr_of(d_epri), sizeof(struct_epri)); }
export function historical_sfi_epri(nhfp, d_epri, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_epri), sizeof(struct_epri)); norm_ptrs_epri(d_epri); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:27
export function historical_sfo_eshk(nhfp, d_eshk, myname) { /* void */ norm_ptrs_eshk(d_eshk); bwrite(nhfp.fd, addr_of(d_eshk), sizeof(struct_eshk)); }
export function historical_sfi_eshk(nhfp, d_eshk, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_eshk), sizeof(struct_eshk)); norm_ptrs_eshk(d_eshk); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:28
export function historical_sfo_fe(nhfp, d_fe, myname) { /* void */ norm_ptrs_fe(d_fe); bwrite(nhfp.fd, addr_of(d_fe), sizeof(struct_fe)); }
export function historical_sfi_fe(nhfp, d_fe, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_fe), sizeof(struct_fe)); norm_ptrs_fe(d_fe); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:29
export function historical_sfo_flag(nhfp, d_flag, myname) { /* void */ norm_ptrs_flag(d_flag); bwrite(nhfp.fd, addr_of(d_flag), sizeof(struct_flag)); }
export function historical_sfi_flag(nhfp, d_flag, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_flag), sizeof(struct_flag)); norm_ptrs_flag(d_flag); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:30
export function historical_sfo_fruit(nhfp, d_fruit, myname) { /* void */ norm_ptrs_fruit(d_fruit); bwrite(nhfp.fd, addr_of(d_fruit), sizeof(struct_fruit)); }
export function historical_sfi_fruit(nhfp, d_fruit, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_fruit), sizeof(struct_fruit)); norm_ptrs_fruit(d_fruit); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:31
export function historical_sfo_gamelog_line(nhfp, d_gamelog_line, myname) { /* void */ norm_ptrs_gamelog_line(d_gamelog_line); bwrite(nhfp.fd, addr_of(d_gamelog_line), sizeof(struct_gamelog_line)); }
export function historical_sfi_gamelog_line(nhfp, d_gamelog_line, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_gamelog_line), sizeof(struct_gamelog_line)); norm_ptrs_gamelog_line(d_gamelog_line); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:32
export function historical_sfo_kinfo(nhfp, d_kinfo, myname) { /* void */ norm_ptrs_kinfo(d_kinfo); bwrite(nhfp.fd, addr_of(d_kinfo), sizeof(struct_kinfo)); }
export function historical_sfi_kinfo(nhfp, d_kinfo, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_kinfo), sizeof(struct_kinfo)); norm_ptrs_kinfo(d_kinfo); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:33
export function historical_sfo_levelflags(nhfp, d_levelflags, myname) { /* void */ norm_ptrs_levelflags(d_levelflags); bwrite(nhfp.fd, addr_of(d_levelflags), sizeof(struct_levelflags)); }
export function historical_sfi_levelflags(nhfp, d_levelflags, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_levelflags), sizeof(struct_levelflags)); norm_ptrs_levelflags(d_levelflags); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:34
export function historical_sfo_ls_t(nhfp, d_ls_t, myname) { /* void */ norm_ptrs_ls_t(d_ls_t); bwrite(nhfp.fd, addr_of(d_ls_t), sizeof(struct_ls_t)); }
export function historical_sfi_ls_t(nhfp, d_ls_t, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_ls_t), sizeof(struct_ls_t)); norm_ptrs_ls_t(d_ls_t); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:35
export function historical_sfo_linfo(nhfp, d_linfo, myname) { /* void */ norm_ptrs_linfo(d_linfo); bwrite(nhfp.fd, addr_of(d_linfo), sizeof(struct_linfo)); }
export function historical_sfi_linfo(nhfp, d_linfo, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_linfo), sizeof(struct_linfo)); norm_ptrs_linfo(d_linfo); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:36
export function historical_sfo_mapseen_feat(nhfp, d_mapseen_feat, myname) { /* void */ norm_ptrs_mapseen_feat(d_mapseen_feat); bwrite(nhfp.fd, addr_of(d_mapseen_feat), sizeof(struct_mapseen_feat)); }
export function historical_sfi_mapseen_feat(nhfp, d_mapseen_feat, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_mapseen_feat), sizeof(struct_mapseen_feat)); norm_ptrs_mapseen_feat(d_mapseen_feat); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:37
export function historical_sfo_mapseen_flags(nhfp, d_mapseen_flags, myname) { /* void */ norm_ptrs_mapseen_flags(d_mapseen_flags); bwrite(nhfp.fd, addr_of(d_mapseen_flags), sizeof(struct_mapseen_flags)); }
export function historical_sfi_mapseen_flags(nhfp, d_mapseen_flags, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_mapseen_flags), sizeof(struct_mapseen_flags)); norm_ptrs_mapseen_flags(d_mapseen_flags); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:38
export function historical_sfo_mapseen_rooms(nhfp, d_mapseen_rooms, myname) { /* void */ norm_ptrs_mapseen_rooms(d_mapseen_rooms); bwrite(nhfp.fd, addr_of(d_mapseen_rooms), sizeof(struct_mapseen_rooms)); }
export function historical_sfi_mapseen_rooms(nhfp, d_mapseen_rooms, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_mapseen_rooms), sizeof(struct_mapseen_rooms)); norm_ptrs_mapseen_rooms(d_mapseen_rooms); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:39
export function historical_sfo_mkroom(nhfp, d_mkroom, myname) { /* void */ norm_ptrs_mkroom(d_mkroom); bwrite(nhfp.fd, addr_of(d_mkroom), sizeof(struct_mkroom)); }
export function historical_sfi_mkroom(nhfp, d_mkroom, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_mkroom), sizeof(struct_mkroom)); norm_ptrs_mkroom(d_mkroom); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:40
export function historical_sfo_monst(nhfp, d_monst, myname) { /* void */ norm_ptrs_monst(d_monst); bwrite(nhfp.fd, addr_of(d_monst), sizeof(struct_monst)); }
export function historical_sfi_monst(nhfp, d_monst, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_monst), sizeof(struct_monst)); norm_ptrs_monst(d_monst); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:41
export function historical_sfo_mvitals(nhfp, d_mvitals, myname) { /* void */ norm_ptrs_mvitals(d_mvitals); bwrite(nhfp.fd, addr_of(d_mvitals), sizeof(struct_mvitals)); }
export function historical_sfi_mvitals(nhfp, d_mvitals, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_mvitals), sizeof(struct_mvitals)); norm_ptrs_mvitals(d_mvitals); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:42
export function historical_sfo_obj(nhfp, d_obj, myname) { /* void */ norm_ptrs_obj(d_obj); bwrite(nhfp.fd, addr_of(d_obj), sizeof(struct_obj)); }
export function historical_sfi_obj(nhfp, d_obj, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_obj), sizeof(struct_obj)); norm_ptrs_obj(d_obj); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:43
export function historical_sfo_objclass(nhfp, d_objclass, myname) { /* void */ norm_ptrs_objclass(d_objclass); bwrite(nhfp.fd, addr_of(d_objclass), sizeof(struct_objclass)); }
export function historical_sfi_objclass(nhfp, d_objclass, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_objclass), sizeof(struct_objclass)); norm_ptrs_objclass(d_objclass); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:44
export function historical_sfo_q_score(nhfp, d_q_score, myname) { /* void */ norm_ptrs_q_score(d_q_score); bwrite(nhfp.fd, addr_of(d_q_score), sizeof(struct_q_score)); }
export function historical_sfi_q_score(nhfp, d_q_score, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_q_score), sizeof(struct_q_score)); norm_ptrs_q_score(d_q_score); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:45
export function historical_sfo_rm(nhfp, d_rm, myname) { /* void */ norm_ptrs_rm(d_rm); bwrite(nhfp.fd, addr_of(d_rm), sizeof(struct_rm)); }
export function historical_sfi_rm(nhfp, d_rm, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_rm), sizeof(struct_rm)); norm_ptrs_rm(d_rm); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:46
export function historical_sfo_spell(nhfp, d_spell, myname) { /* void */ norm_ptrs_spell(d_spell); bwrite(nhfp.fd, addr_of(d_spell), sizeof(struct_spell)); }
export function historical_sfi_spell(nhfp, d_spell, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_spell), sizeof(struct_spell)); norm_ptrs_spell(d_spell); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:47
export function historical_sfo_stairway(nhfp, d_stairway, myname) { /* void */ norm_ptrs_stairway(d_stairway); bwrite(nhfp.fd, addr_of(d_stairway), sizeof(struct_stairway)); }
export function historical_sfi_stairway(nhfp, d_stairway, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_stairway), sizeof(struct_stairway)); norm_ptrs_stairway(d_stairway); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:48
export function historical_sfo_s_level(nhfp, d_s_level, myname) { /* void */ norm_ptrs_s_level(d_s_level); bwrite(nhfp.fd, addr_of(d_s_level), sizeof(struct_s_level)); }
export function historical_sfi_s_level(nhfp, d_s_level, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_s_level), sizeof(struct_s_level)); norm_ptrs_s_level(d_s_level); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:49
export function historical_sfo_trap(nhfp, d_trap, myname) { /* void */ norm_ptrs_trap(d_trap); bwrite(nhfp.fd, addr_of(d_trap), sizeof(struct_trap)); }
export function historical_sfi_trap(nhfp, d_trap, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_trap), sizeof(struct_trap)); norm_ptrs_trap(d_trap); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:50
export function historical_sfo_you(nhfp, d_you, myname) { /* void */ norm_ptrs_you(d_you); bwrite(nhfp.fd, addr_of(d_you), sizeof(struct_you)); }
export function historical_sfi_you(nhfp, d_you, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_you), sizeof(struct_you)); norm_ptrs_you(d_you); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:51
export function historical_sfo_any(nhfp, d_any, myname) { /* void */ norm_ptrs_any(d_any); bwrite(nhfp.fd, addr_of(d_any), sizeof(struct_any)); }
export function historical_sfi_any(nhfp, d_any, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_any), sizeof(struct_any)); norm_ptrs_any(d_any); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:53
export function historical_sfo_aligntyp(nhfp, d_aligntyp, myname) { /* void */ bwrite(nhfp.fd, d_aligntyp, sizeof(schar)); }
export function historical_sfi_aligntyp(nhfp, d_aligntyp, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, d_aligntyp, sizeof(schar)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:54
export function historical_sfo_boolean(nhfp, d_boolean, myname) { /* void */ bwrite(nhfp.fd, d_boolean, sizeof(schar)); }
export function historical_sfi_boolean(nhfp, d_boolean, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, d_boolean, sizeof(schar)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:55
export function historical_sfo_coordxy(nhfp, d_coordxy, myname) { /* void */ bwrite(nhfp.fd, addr_of(d_coordxy), sizeof(short)); }
export function historical_sfi_coordxy(nhfp, d_coordxy, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_coordxy), sizeof(short)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:57
export function historical_sfo_int(nhfp, d_int, myname) { /* void */ bwrite(nhfp.fd, addr_of(d_int), sizeof(int)); }
export function historical_sfi_int(nhfp, d_int, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_int), sizeof(int)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:58
export function historical_sfo_int16(nhfp, d_int16, myname) { /* void */ bwrite(nhfp.fd, addr_of(d_int16), sizeof(short)); }
export function historical_sfi_int16(nhfp, d_int16, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_int16), sizeof(short)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:59
export function historical_sfo_int32(nhfp, d_int32, myname) { /* void */ bwrite(nhfp.fd, addr_of(d_int32), sizeof(int)); }
export function historical_sfi_int32(nhfp, d_int32, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_int32), sizeof(int)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:60
export function historical_sfo_int64(nhfp, d_int64, myname) { /* void */ bwrite(nhfp.fd, addr_of(d_int64), sizeof(int64_t)); }
export function historical_sfi_int64(nhfp, d_int64, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_int64), sizeof(int64_t)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:61
export function historical_sfo_long(nhfp, d_long, myname) { /* void */ norm_ptrs_long(d_long); bwrite(nhfp.fd, addr_of(d_long), sizeof(long)); }
export function historical_sfi_long(nhfp, d_long, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_long), sizeof(long)); norm_ptrs_long(d_long); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:62
export function historical_sfo_schar(nhfp, d_schar, myname) { /* void */ bwrite(nhfp.fd, d_schar, sizeof(schar)); }
export function historical_sfi_schar(nhfp, d_schar, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, d_schar, sizeof(schar)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:63
export function historical_sfo_short(nhfp, d_short, myname) { /* void */ bwrite(nhfp.fd, addr_of(d_short), sizeof(short)); }
export function historical_sfi_short(nhfp, d_short, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_short), sizeof(short)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:64
export function historical_sfo_size_t(nhfp, d_size_t, myname) { /* void */ bwrite(nhfp.fd, addr_of(d_size_t), sizeof(unsigned)); }
export function historical_sfi_size_t(nhfp, d_size_t, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_size_t), sizeof(unsigned)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:65
export function historical_sfo_time_t(nhfp, d_time_t, myname) { /* void */ bwrite(nhfp.fd, addr_of(d_time_t), sizeof(long)); }
export function historical_sfi_time_t(nhfp, d_time_t, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_time_t), sizeof(long)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:66
export function historical_sfo_uchar(nhfp, d_uchar, myname) { /* void */ bwrite(nhfp.fd, d_uchar, sizeof(uchar)); }
export function historical_sfi_uchar(nhfp, d_uchar, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, d_uchar, sizeof(uchar)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:67
export function historical_sfo_uint16(nhfp, d_uint16, myname) { /* void */ bwrite(nhfp.fd, addr_of(d_uint16), sizeof(ushort)); }
export function historical_sfi_uint16(nhfp, d_uint16, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_uint16), sizeof(ushort)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:68
export function historical_sfo_uint32(nhfp, d_uint32, myname) { /* void */ bwrite(nhfp.fd, addr_of(d_uint32), sizeof(unsigned)); }
export function historical_sfi_uint32(nhfp, d_uint32, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_uint32), sizeof(unsigned)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:69
export function historical_sfo_uint64(nhfp, d_uint64, myname) { /* void */ bwrite(nhfp.fd, addr_of(d_uint64), sizeof(uint64_t)); }
export function historical_sfi_uint64(nhfp, d_uint64, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_uint64), sizeof(uint64_t)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:70
export function historical_sfo_ulong(nhfp, d_ulong, myname) { /* void */ bwrite(nhfp.fd, addr_of(d_ulong), sizeof(ulong)); }
export function historical_sfi_ulong(nhfp, d_ulong, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_ulong), sizeof(ulong)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:71
export function historical_sfo_unsigned(nhfp, d_unsigned, myname) { /* void */ bwrite(nhfp.fd, addr_of(d_unsigned), sizeof(unsigned)); }
export function historical_sfi_unsigned(nhfp, d_unsigned, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_unsigned), sizeof(unsigned)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:72
export function historical_sfo_ushort(nhfp, d_ushort, myname) { /* void */ bwrite(nhfp.fd, addr_of(d_ushort), sizeof(ushort)); }
export function historical_sfi_ushort(nhfp, d_ushort, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_ushort), sizeof(ushort)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:73
export function historical_sfo_xint16(nhfp, d_xint16, myname) { /* void */ bwrite(nhfp.fd, addr_of(d_xint16), sizeof(short)); }
export function historical_sfi_xint16(nhfp, d_xint16, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, addr_of(d_xint16), sizeof(short)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
// sfmacros.h:74
export function historical_sfo_xint8(nhfp, d_xint8, myname) { /* void */ bwrite(nhfp.fd, d_xint8, sizeof(schar)); }
export function historical_sfi_xint8(nhfp, d_xint8, myname) { /* void */ if (nhfp.eof) { sfstruct_read_error(); } mread(nhfp.fd, d_xint8, sizeof(schar)); if ((restoreinfo.mread_flags == -1)) nhfp.eof = TRUE; }
