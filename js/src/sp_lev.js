/* NetHack 5.0	sp_lev.c	$NHDT-Date: 1737610109 2025/01/22 21:28:29 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.373 $ */
/*      Copyright (c) 1989 by Jean-Christophe Collet */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * This file contains the various functions that are related to the special
 * levels.
 *
 * It contains also the special level loader.
 */

/* #if 0: not in this build */

/* lua_CFunction prototypes */

export const SPLEV_LEFT = 1;
export const SPLEV_H_LEFT = 2;
export const SPLEV_CENTER = 3;
export const SPLEV_H_RIGHT = 4;
export const SPLEV_RIGHT = 5;

export const TOP = 1;
export const BOTTOM = 5;

export const XLIM = 4;
export const YLIM = 3;

export function Free(ptr) { do {
        if (ptr)
            free(ptr);
    } while (0) }

    /*
     * No need for 'struct instance_globals g' to contain these.
     * sp_level_coder_init() always re-initializes them prior to use.
     */
const splev_init_present = static_var("splev_init_present", schar); const icedpools = static_var("icedpools", schar);
/* positions touched by level elements explicitly defined in the level */
const SpLev_Map = static_array("SpLev_Map", array_of(char, ROWNO), COLNO);
export const MAX_CONTAINMENT = 10;
const container_idx = static_var("container_idx", int, 0); /* next slot in container_obj[] to use */
const container_obj = static_array("container_obj", ptr_to(struct_obj), MAX_CONTAINMENT);
const invent_carrying_monster = static_var("invent_carrying_monster", ptr_to(struct_monst), null);
    /*
     * end of no 'g.'
     */

export function reset_xystart_size() { /* void */
    gx.xstart = 1; /* column [0] is off limits */
    gy.ystart = 0;
    gx.xsize = COLNO - 1; /* 1..COLNO-1 */
    gy.ysize = ROWNO; /* 0..ROWNO-1 */
}

/* Does typ match with levl[][].typ, considering special types
   MATCH_WALL and MAX_TYPE (aka transparency)? */
export function match_maptyps(typ, levltyp) { /* boolean */
    if ((typ == MATCH_WALL) && !IS_STWALL(levltyp))
        return FALSE;
    if ((typ < MAX_TYPE) && (typ != levltyp))
        return FALSE;
    return TRUE;
}

export function mapfrag_fromstr(str) { /* struct mapfragment * */
    let mf = view_of(struct_mapfragment, addr_of(alloc(sizeof(struct_mapfragment))));

    let tmps;

    mf.data = dupstr(str);

    stripdigits(mf.data);
    mf.wid = str_lines_maxlen(mf.data);
    mf.hei = 0;
    tmps = mf.data;
    while (tmps && chars[tmps]) {
        let s1 = strchr(tmps, ord('\n'));

        if (mf.hei > MAP_Y_LIM) {
            free(mf.data);
            free(addr_of(mf));
            return null;
        }
        if (s1)
            s1++;
        tmps = s1;
        mf.hei++;
    }
    return mf;
}

export function mapfrag_free(mf) { /* void */
    if (mf && mf[0]) {
        free((mf[0]).data);
        free(addr_of(mf[0]));
        mf[0] = null;
    }
}

export function mapfrag_get(mf, x, y) { /* schar */
    if (y < 0 || x < 0 || y > mf.hei - 1 || x > mf.wid - 1)
        panic(_("outside mapfrag (%i,%i), wanted (%i,%i)"),
              mf.wid, mf.hei, x, y);
    return splev_chr2typ(chars[mf.data + (y * (mf.wid + 1) + x)]);
}

export function mapfrag_canmatch(mf) { /* boolean */
    return ((mf.wid % 2) && (mf.hei % 2) ? 1 : 0);
}

export function mapfrag_error(mf$) { /* const char * */
    const $frame = stack_frame(); try {
    const mf = stack_var(ptr_to(struct_mapfragment), mf$);
    let res = 0;

    if (!mf[0]) {
        res = _("mapfragment error");
    } else if (!mapfrag_canmatch(mf[0])) {
        mapfrag_free(mf);
        res = _("mapfragment needs to have odd height and width");
    } else if ((((mapfrag_get(mf[0], Math.trunc(mf[0].wid / 2), Math.trunc(mf[0].hei / 2))) == MAX_TYPE) || ((mapfrag_get(mf[0], Math.trunc(mf[0].wid / 2), Math.trunc(mf[0].hei / 2))) == INVALID_TYPE))) {
        mapfrag_free(mf);
        res = _("mapfragment center must be valid terrain");
    }
    return res;
    } finally { stack_pop($frame); }
}

export function mapfrag_match(mf, x, y) { /* boolean */
    let rx, ry;

    for (rx = -Math.trunc(mf.wid / 2); rx <= Math.trunc(mf.wid / 2); rx++)
        for (ry = -Math.trunc(mf.hei / 2); ry <= Math.trunc(mf.hei / 2); ry++) {
            let mapc = mapfrag_get(mf, rx + Math.trunc(mf.wid / 2),
                                     ry + Math.trunc(mf.hei / 2));
            let levc = isok(x+rx, y+ry) ? levl()[x+rx][y+ry].typ : STONE;

            if (!match_maptyps(mapc, levc))
                return FALSE;
        }
    return TRUE;
}

function solidify_map() { /* void */
    let x, y;

    for (x = 0; x < COLNO; x++)
        for (y = 0; y < ROWNO; y++)
            if (IS_STWALL(levl()[x][y].typ) && !chars[SpLev_Map[x] + y])
                levl()[x][y].flags |= (W_NONDIGGABLE | W_NONPASSWALL);
}

/* do a post-level-creation cleanup of map, such as
   removing boulders and traps from lava */
function map_cleanup() { /* void */
    let otmp;
    let ttmp;
    let etmp;
    let x, y;

    for (x = 0; x < COLNO; x++)
        for (y = 0; y < ROWNO; y++) {
            let typ = levl()[x][y].typ;

            if (IS_LAVA(typ) || IS_POOL(typ)) {
                /* in case any boulders are on liquid, delete them */
                while ((otmp = sobj_at(BOULDER, x, y)) != null) {
                    obj_extract_self(otmp);
                    obfree(otmp, null);
                }

                /* traps on liquid? */
                if (((ttmp = t_at(x, y)) != null)
                    && !undestroyable_trap(ttmp.ttyp))
                    deltrap(ttmp);

                /* engravings? */
                if ((etmp = engr_at(x, y)) != null)
                  del_engr(etmp);
            }
        }
}

function lvlfill_maze_grid(x1, y1, x2, y2, filling) { /* void */
    let x, y;

    for (x = x1; x <= x2; x++)
        for (y = y1; y <= y2; y++) {
            if (svl.level.flags.corrmaze)
                levl()[x][y].typ = STONE;
            else
                levl()[x][y].typ = (y < 2 || ((x % 2) && (y % 2))) ? STONE
                                                                 : filling;
        }
}

function lvlfill_solid(filling, lit) { /* void */
    let x, y;

    for (x = 2; x <= gx.x_maze_max; x++)
        for (y = 0; y <= gy.y_maze_max; y++) {
            if (!set_levltyp_lit(x, y, filling, lit))
                continue;
            /* TODO: consolidate this w lspo_map ? */
            levl()[x][y].flags = 0;
            levl()[x][y].horizontal = 0;
            levl()[x][y].roomno = 0;
            levl()[x][y].edge = 0;
        }
}

function lvlfill_swamp(fg, bg, lit) { /* void */
    let x, y;

    lvlfill_solid(bg, lit);

    /* "relaxed blockwise maze" algorithm, Jamis Buck */
    for (x = 2; x <= min(gx.x_maze_max, COLNO-2); x += 2)
        for (y = 0; y <= min(gy.y_maze_max, ROWNO-2); y += 2) {
            let c = 0;

            set_levltyp_lit(x, y, fg, lit);
            if (levl()[x + 1][y].typ == bg)
                ++c;
            if (levl()[x][y + 1].typ == bg)
                ++c;
            if (levl()[x + 1][y + 1].typ == bg)
                ++c;
            if (c == 3) {
                switch (rn2(3)) {
                case 0:
                    set_levltyp_lit(x + 1,y, fg, lit);
                    break;
                case 1:
                    set_levltyp_lit(x, y + 1, fg, lit);
                    break;
                case 2:
                    set_levltyp_lit(x + 1, y + 1, fg, lit);
                    break;
                default:
                    break;
                }
            }
        }
}

function flip_dbridge_horizontal(lev) { /* void */
    if (IS_DRAWBRIDGE(lev.typ)) {
        if ((lev.flags & DB_DIR) == DB_WEST) {
            lev.flags &= ~DB_WEST;
            lev.flags |=  DB_EAST;
        } else if ((lev.flags & DB_DIR) == DB_EAST) {
            lev.flags &= ~DB_EAST;
            lev.flags |=  DB_WEST;
        }
    }
}

function flip_dbridge_vertical(lev) { /* void */
    if (IS_DRAWBRIDGE(lev.typ)) {
        if ((lev.flags & DB_DIR) == DB_NORTH) {
            lev.flags &= ~DB_NORTH;
            lev.flags |=  DB_SOUTH;
        } else if ((lev.flags & DB_DIR) == DB_SOUTH) {
            lev.flags &= ~DB_SOUTH;
            lev.flags |=  DB_NORTH;
        }
    }
}

/* for #wizfliplevel; not needed when flipping during level creation;
   update seen vector for whole flip area and glyph for known walls */
function flip_visuals(flp, minx, miny, maxx, maxy) { /* void */
    let lev;
    let x, y, seenv;

    for (y = miny; y <= maxy; ++y) {
        for (x = minx; x <= maxx; ++x) {
            lev = levl()[x][y];
            seenv = lev.seenv & 0xff;
            /* locations which haven't been seen can be skipped */
            if (seenv == 0)
                continue;
            /* flip <x,y>'s seen vector; not necessary for locations seen
               from all directions (the whole level after magic mapping) */
            if (seenv != SVALL) {
                /* SV2 SV1 SV0 *
                 * SV3 -+- SV7 *
                 * SV4 SV5 SV6 */
                if (flp & 1) { /* swap top and bottom */
                    seenv = swapbits(seenv, 2, 4);
                    seenv = swapbits(seenv, 1, 5);
                    seenv = swapbits(seenv, 0, 6);
                }
                if (flp & 2) { /* swap left and right */
                    seenv = swapbits(seenv, 2, 0);
                    seenv = swapbits(seenv, 3, 7);
                    seenv = swapbits(seenv, 4, 6);
                }
                lev.seenv = uchar(seenv);
            }
            /* if <x,y> is displayed as a wall, reset its display glyph so
               that remembered, out of view T's and corners get flipped */
            if ((IS_WALL(lev.typ) || lev.typ == SDOOR)
                && glyph_is_cmap(lev.glyph))
                lev.glyph = back_to_glyph(x, y);
        }
    }
}

/* transpose an encoded direction */
function flip_encoded_dir_bits(flp, val) { /* int */
    /* these depend on xdir[] and ydir[] order */
    if (flp & 1) {
        val = swapbits(val, 1, 7);
        val = swapbits(val, 2, 6);
        val = swapbits(val, 3, 5);
    }
    if (flp & 2) {
        val = swapbits(val, 1, 3);
        val = swapbits(val, 0, 4);
        val = swapbits(val, 7, 5);
    }

    return val;
}

/* transpose top with bottom or left with right or both; sometimes called
   for new special levels, or for any level via the #wizfliplevel command */
export function flip_level(
    flp,
    extras) { /* void */ /* False: level creation; True: #wizfliplevel is * altering an active level so more needs to be done */
    const $frame = stack_frame(); try {
    let x, y, i, itmp;
    let minx = stack_var(coordxy), miny = stack_var(coordxy), maxx = stack_var(coordxy), maxy = stack_var(coordxy);
    let trm = stack_struct(struct_rm);
    let ttmp;
    let otmp;
    let mtmp;
    let etmp;
    let sroom;
    let timer;
    let ball_active = FALSE, ball_fliparea = FALSE;
    let stway;
    let ez;

    /* nothing to do unless (flp & 1) or (flp & 2) or both */
    if ((flp & 3) == 0)
        return;

    get_level_extends(minx, miny, maxx, maxy);
    /* get_level_extends() returns -1,-1 to COLNO,ROWNO at max */
    if (miny[0] < 0)
        miny[0] = 0;
    if (minx[0] < 1)
        minx[0] = 1;
    if (maxx[0] >= COLNO)
        maxx[0] = (COLNO - 1);
    if (maxy[0] >= ROWNO)
        maxy[0] = (ROWNO - 1);

    if (extras) {
        if (Punished() && uball.where != OBJ_FREE) {
            ball_active = TRUE;
            /* if hero and ball and chain are all inside flip area,
               flip b&c coordinates along with other objects; if they
               are all outside, leave them to be rejected when flipping
               so that they stay as is; if some are inside and some are
               outside, un-place here and subsequently re-place them on
               hero's [possibly new] spot below */
            if (carried(uball))
                uball.ox = u.ux, uball.oy = u.uy;
            ball_fliparea = +((+(((((uball.ox) >= minx[0]) && ((uball.ox) <= maxx[0])) && ((uball.oy) >= miny[0])) && ((uball.oy) <= maxy[0]))
                              == +(((((uchain.ox) >= minx[0]) && ((uchain.ox) <= maxx[0])) && ((uchain.oy) >= miny[0])) && ((uchain.oy) <= maxy[0])))
                             && (+(((((uball.ox) >= minx[0]) && ((uball.ox) <= maxx[0])) && ((uball.oy) >= miny[0])) && ((uball.oy) <= maxy[0]))
                                 == +(((((u.ux) >= minx[0]) && ((u.ux) <= maxx[0])) && ((u.uy) >= miny[0])) && ((u.uy) <= maxy[0]))));
            if (!ball_fliparea)
                unplacebc();
        }
    }

    /* stairs and ladders */
    for (stway = gs.stairs; stway; stway = stway.next) {
        if (flp & 1)
            stway.sy = ((maxy[0] - (stway.sy)) + miny[0]);
        if (flp & 2)
            stway.sx = ((maxx[0] - (stway.sx)) + minx[0]);
    }

    /* traps */
    for (ttmp = gf.ftrap; ttmp; ttmp = ttmp.ntrap) {
        if (!(((((ttmp.tx) >= minx[0]) && ((ttmp.tx) <= maxx[0])) && ((ttmp.ty) >= miny[0])) && ((ttmp.ty) <= maxy[0])))
            continue;
        if (flp & 1) {
            ttmp.ty = ((maxy[0] - (ttmp.ty)) + miny[0]);
            if (ttmp.ttyp == ROLLING_BOULDER_TRAP) {
                ttmp.launch.y = ((maxy[0] - (ttmp.launch.y)) + miny[0]);
                ttmp.vl.v_launch2.y = ((maxy[0] - (ttmp.vl.v_launch2.y)) + miny[0]);
            } else if (is_pit(ttmp.ttyp) && ttmp.vl.v_conjoined) {
                ttmp.vl.v_conjoined = uchar(flip_encoded_dir_bits(flp, ttmp.vl.v_conjoined));
            }
        }
        if (flp & 2) {
            ttmp.tx = ((maxx[0] - (ttmp.tx)) + minx[0]);
            if (ttmp.ttyp == ROLLING_BOULDER_TRAP) {
                ttmp.launch.x = ((maxx[0] - (ttmp.launch.x)) + minx[0]);
                ttmp.vl.v_launch2.x = ((maxx[0] - (ttmp.vl.v_launch2.x)) + minx[0]);
            } else if (is_pit(ttmp.ttyp) && ttmp.vl.v_conjoined) {
                ttmp.vl.v_conjoined = uchar(flip_encoded_dir_bits(flp, ttmp.vl.v_conjoined));
            }
        }
    }

    /* objects */
    for (otmp = fobj(); otmp; otmp = otmp.nobj) {
        if (!(((((otmp.ox) >= minx[0]) && ((otmp.ox) <= maxx[0])) && ((otmp.oy) >= miny[0])) && ((otmp.oy) <= maxy[0])))
            continue;
        if (flp & 1)
            otmp.oy = ((maxy[0] - (otmp.oy)) + miny[0]);
        if (flp & 2)
            otmp.ox = ((maxx[0] - (otmp.ox)) + minx[0]);
    }

    /* buried objects */
    for (otmp = svl.level.buriedobjlist; otmp; otmp = otmp.nobj) {
        if (!(((((otmp.ox) >= minx[0]) && ((otmp.ox) <= maxx[0])) && ((otmp.oy) >= miny[0])) && ((otmp.oy) <= maxy[0])))
            continue;
        if (flp & 1)
            otmp.oy = ((maxy[0] - (otmp.oy)) + miny[0]);
        if (flp & 2)
            otmp.ox = ((maxx[0] - (otmp.ox)) + minx[0]);
    }

    /* monsters */
    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (mtmp.isgd) {
            if (extras) /* flip mtmp->mextra->egd */
                flip_vault_guard(flp, mtmp, minx[0], miny[0], maxx[0], maxy[0]);
            if (mtmp.mx == 0) /* not on map so don't flip guard->mx,my */
                continue;
        }
        /* skip the occasional earth elemental outside the flip area */
        if (!(((((mtmp.mx) >= minx[0]) && ((mtmp.mx) <= maxx[0])) && ((mtmp.my) >= miny[0])) && ((mtmp.my) <= maxy[0])))
            continue;
        if (flp & 1)
            mtmp.my = ((maxy[0] - (mtmp.my)) + miny[0]);
        if (flp & 2)
            mtmp.mx = ((maxx[0] - (mtmp.mx)) + minx[0]);

        do { if (((mtmp.mgoal).x && ((((((mtmp.mgoal).x) >= minx[0]) && (((mtmp.mgoal).x) <= maxx[0])) && (((mtmp.mgoal).y) >= miny[0])) && (((mtmp.mgoal).y) <= maxy[0])))) { if ((flp & 1)) (mtmp.mgoal).y = ((maxy[0] - ((mtmp.mgoal).y)) + miny[0]); if ((flp & 2)) (mtmp.mgoal).x = ((maxx[0] - ((mtmp.mgoal).x)) + minx[0]); } } while (0);

        if (mtmp.ispriest) {
            do { if (((EPRI(mtmp).shrpos).x && ((((((EPRI(mtmp).shrpos).x) >= minx[0]) && (((EPRI(mtmp).shrpos).x) <= maxx[0])) && (((EPRI(mtmp).shrpos).y) >= miny[0])) && (((EPRI(mtmp).shrpos).y) <= maxy[0])))) { if ((flp & 1)) (EPRI(mtmp).shrpos).y = ((maxy[0] - ((EPRI(mtmp).shrpos).y)) + miny[0]); if ((flp & 2)) (EPRI(mtmp).shrpos).x = ((maxx[0] - ((EPRI(mtmp).shrpos).x)) + minx[0]); } } while (0);
        } else if (mtmp.isshk) {
            do { if (((ESHK(mtmp).shk).x && ((((((ESHK(mtmp).shk).x) >= minx[0]) && (((ESHK(mtmp).shk).x) <= maxx[0])) && (((ESHK(mtmp).shk).y) >= miny[0])) && (((ESHK(mtmp).shk).y) <= maxy[0])))) { if ((flp & 1)) (ESHK(mtmp).shk).y = ((maxy[0] - ((ESHK(mtmp).shk).y)) + miny[0]); if ((flp & 2)) (ESHK(mtmp).shk).x = ((maxx[0] - ((ESHK(mtmp).shk).x)) + minx[0]); } } while (0); /* shk's preferred spot */
            do { if (((ESHK(mtmp).shd).x && ((((((ESHK(mtmp).shd).x) >= minx[0]) && (((ESHK(mtmp).shd).x) <= maxx[0])) && (((ESHK(mtmp).shd).y) >= miny[0])) && (((ESHK(mtmp).shd).y) <= maxy[0])))) { if ((flp & 1)) (ESHK(mtmp).shd).y = ((maxy[0] - ((ESHK(mtmp).shd).y)) + miny[0]); if ((flp & 2)) (ESHK(mtmp).shd).x = ((maxx[0] - ((ESHK(mtmp).shd).x)) + minx[0]); } } while (0); /* shop door */
        } else if (mtmp.wormno) {
            if (flp & 1)
                flip_worm_segs_vertical(mtmp, miny[0], maxy[0]);
            if (flp & 2)
                flip_worm_segs_horizontal(mtmp, minx[0], maxx[0]);
        }
    }
    if (extras) { /* #wizfliplevel rather than level creation */
        for (mtmp = gm.migrating_mons; mtmp; mtmp = mtmp.nmon) {
            if (mtmp.isgd && on_level(u.uz, EGD(mtmp).gdlevel)) {
                flip_vault_guard(flp, mtmp, minx[0], miny[0], maxx[0], maxy[0]); /* egd */
            } else if (mtmp.ispriest
                       && on_level(u.uz, EPRI(mtmp).shrlevel)) {
                do { if (((EPRI(mtmp).shrpos).x && ((((((EPRI(mtmp).shrpos).x) >= minx[0]) && (((EPRI(mtmp).shrpos).x) <= maxx[0])) && (((EPRI(mtmp).shrpos).y) >= miny[0])) && (((EPRI(mtmp).shrpos).y) <= maxy[0])))) { if ((flp & 1)) (EPRI(mtmp).shrpos).y = ((maxy[0] - ((EPRI(mtmp).shrpos).y)) + miny[0]); if ((flp & 2)) (EPRI(mtmp).shrpos).x = ((maxx[0] - ((EPRI(mtmp).shrpos).x)) + minx[0]); } } while (0); /* priest's altar */
            } else if (mtmp.isshk
                       && on_level(u.uz, ESHK(mtmp).shoplevel)) {
                do { if (((ESHK(mtmp).shk).x && ((((((ESHK(mtmp).shk).x) >= minx[0]) && (((ESHK(mtmp).shk).x) <= maxx[0])) && (((ESHK(mtmp).shk).y) >= miny[0])) && (((ESHK(mtmp).shk).y) <= maxy[0])))) { if ((flp & 1)) (ESHK(mtmp).shk).y = ((maxy[0] - ((ESHK(mtmp).shk).y)) + miny[0]); if ((flp & 2)) (ESHK(mtmp).shk).x = ((maxx[0] - ((ESHK(mtmp).shk).x)) + minx[0]); } } while (0); /* shk's preferred spot */
                do { if (((ESHK(mtmp).shd).x && ((((((ESHK(mtmp).shd).x) >= minx[0]) && (((ESHK(mtmp).shd).x) <= maxx[0])) && (((ESHK(mtmp).shd).y) >= miny[0])) && (((ESHK(mtmp).shd).y) <= maxy[0])))) { if ((flp & 1)) (ESHK(mtmp).shd).y = ((maxy[0] - ((ESHK(mtmp).shd).y)) + miny[0]); if ((flp & 2)) (ESHK(mtmp).shd).x = ((maxx[0] - ((ESHK(mtmp).shd).x)) + minx[0]); } } while (0); /* shop door */
            }
        }
    }

    /* engravings */
    for (etmp = head_engr; etmp; etmp = etmp.nxt_engr) {
        if (flp & 1)
            etmp.engr_y = ((maxy[0] - (etmp.engr_y)) + miny[0]);
        if (flp & 2)
            etmp.engr_x = ((maxx[0] - (etmp.engr_x)) + minx[0]);
    }

    /* level (teleport) regions */
    for (i = 0; i < gn.num_lregions; i++) {
        if (flp & 1) {
            ptr_add(gl.lregions, i).inarea.y1 = ((maxy[0] - (ptr_add(gl.lregions, i).inarea.y1)) + miny[0]);
            ptr_add(gl.lregions, i).inarea.y2 = ((maxy[0] - (ptr_add(gl.lregions, i).inarea.y2)) + miny[0]);
            if (ptr_add(gl.lregions, i).inarea.y1 > ptr_add(gl.lregions, i).inarea.y2) {
                itmp = ptr_add(gl.lregions, i).inarea.y1;
                ptr_add(gl.lregions, i).inarea.y1 = ptr_add(gl.lregions, i).inarea.y2;
                ptr_add(gl.lregions, i).inarea.y2 = itmp;
            }

            ptr_add(gl.lregions, i).delarea.y1 = ((maxy[0] - (ptr_add(gl.lregions, i).delarea.y1)) + miny[0]);
            ptr_add(gl.lregions, i).delarea.y2 = ((maxy[0] - (ptr_add(gl.lregions, i).delarea.y2)) + miny[0]);
            if (ptr_add(gl.lregions, i).delarea.y1 > ptr_add(gl.lregions, i).delarea.y2) {
                itmp = ptr_add(gl.lregions, i).delarea.y1;
                ptr_add(gl.lregions, i).delarea.y1 = ptr_add(gl.lregions, i).delarea.y2;
                ptr_add(gl.lregions, i).delarea.y2 = itmp;
            }
        }
        if (flp & 2) {
            ptr_add(gl.lregions, i).inarea.x1 = ((maxx[0] - (ptr_add(gl.lregions, i).inarea.x1)) + minx[0]);
            ptr_add(gl.lregions, i).inarea.x2 = ((maxx[0] - (ptr_add(gl.lregions, i).inarea.x2)) + minx[0]);
            if (ptr_add(gl.lregions, i).inarea.x1 > ptr_add(gl.lregions, i).inarea.x2) {
                itmp = ptr_add(gl.lregions, i).inarea.x1;
                ptr_add(gl.lregions, i).inarea.x1 = ptr_add(gl.lregions, i).inarea.x2;
                ptr_add(gl.lregions, i).inarea.x2 = itmp;
            }

            ptr_add(gl.lregions, i).delarea.x1 = ((maxx[0] - (ptr_add(gl.lregions, i).delarea.x1)) + minx[0]);
            ptr_add(gl.lregions, i).delarea.x2 = ((maxx[0] - (ptr_add(gl.lregions, i).delarea.x2)) + minx[0]);
            if (ptr_add(gl.lregions, i).delarea.x1 > ptr_add(gl.lregions, i).delarea.x2) {
                itmp = ptr_add(gl.lregions, i).delarea.x1;
                ptr_add(gl.lregions, i).delarea.x1 = ptr_add(gl.lregions, i).delarea.x2;
                ptr_add(gl.lregions, i).delarea.x2 = itmp;
            }
        }
    }

    /* regions (poison clouds, etc) */
    for (i = 0; i < svn.n_regions; i++) {
        let j, tmp1, tmp2;
        if (flp & 1) {
            tmp1 = ((maxy[0] - (gr.regions[i].bounding_box.ly)) + miny[0]);
            tmp2 = ((maxy[0] - (gr.regions[i].bounding_box.hy)) + miny[0]);
            gr.regions[i].bounding_box.ly = min(tmp1, tmp2);
            gr.regions[i].bounding_box.hy = max(tmp1, tmp2);
            for (j = 0; j < gr.regions[i].nrects; j++) {
                tmp1 = ((maxy[0] - (ptr_add(gr.regions[i].rects, j).ly)) + miny[0]);
                tmp2 = ((maxy[0] - (ptr_add(gr.regions[i].rects, j).hy)) + miny[0]);
                ptr_add(gr.regions[i].rects, j).ly = min(tmp1, tmp2);
                ptr_add(gr.regions[i].rects, j).hy = max(tmp1, tmp2);
            }
        }
        if (flp & 2) {
            tmp1 = ((maxx[0] - (gr.regions[i].bounding_box.lx)) + minx[0]);
            tmp2 = ((maxx[0] - (gr.regions[i].bounding_box.hx)) + minx[0]);
            gr.regions[i].bounding_box.lx = min(tmp1, tmp2);
            gr.regions[i].bounding_box.hx = max(tmp1, tmp2);
            for (j = 0; j < gr.regions[i].nrects; j++) {
                tmp1 = ((maxx[0] - (ptr_add(gr.regions[i].rects, j).lx)) + minx[0]);
                tmp2 = ((maxx[0] - (ptr_add(gr.regions[i].rects, j).hx)) + minx[0]);
                ptr_add(gr.regions[i].rects, j).lx = min(tmp1, tmp2);
                ptr_add(gr.regions[i].rects, j).hx = max(tmp1, tmp2);
            }
        }
    }

    /* rooms */
    for (sroom = ptr_add(svr.rooms[0], 0); ; sroom = ptr_add(sroom, 1)) {
        if (sroom.hx < 0)
            break;

        if (flp & 1) {
            sroom.ly = ((maxy[0] - (sroom.ly)) + miny[0]);
            sroom.hy = ((maxy[0] - (sroom.hy)) + miny[0]);
            if (sroom.ly > sroom.hy) {
                itmp = sroom.ly;
                sroom.ly = sroom.hy;
                sroom.hy = itmp;
            }
        }
        if (flp & 2) {
            sroom.lx = ((maxx[0] - (sroom.lx)) + minx[0]);
            sroom.hx = ((maxx[0] - (sroom.hx)) + minx[0]);
            if (sroom.lx > sroom.hx) {
                itmp = sroom.lx;
                sroom.lx = sroom.hx;
                sroom.hx = itmp;
            }
        }

        if (sroom.nsubrooms)
            for (i = 0; i < sroom.nsubrooms; i++) {
                let rroom = sroom.sbrooms[i];

                if (flp & 1) {
                    rroom.ly = ((maxy[0] - (rroom.ly)) + miny[0]);
                    rroom.hy = ((maxy[0] - (rroom.hy)) + miny[0]);
                    if (rroom.ly > rroom.hy) {
                        itmp = rroom.ly;
                        rroom.ly = rroom.hy;
                        rroom.hy = itmp;
                    }
                }
                if (flp & 2) {
                    rroom.lx = ((maxx[0] - (rroom.lx)) + minx[0]);
                    rroom.hx = ((maxx[0] - (rroom.hx)) + minx[0]);
                    if (rroom.lx > rroom.hx) {
                        itmp = rroom.lx;
                        rroom.lx = rroom.hx;
                        rroom.hx = itmp;
                    }
                }
            }
    }

    /* doors */
    for (i = 0; i < gd.doorindex; i++) {
        do { if (((ptr_add(svd.doors, i)).x && ((((((ptr_add(svd.doors, i)).x) >= minx[0]) && (((ptr_add(svd.doors, i)).x) <= maxx[0])) && (((ptr_add(svd.doors, i)).y) >= miny[0])) && (((ptr_add(svd.doors, i)).y) <= maxy[0])))) { if ((flp & 1)) (ptr_add(svd.doors, i)).y = ((maxy[0] - ((ptr_add(svd.doors, i)).y)) + miny[0]); if ((flp & 2)) (ptr_add(svd.doors, i)).x = ((maxx[0] - ((ptr_add(svd.doors, i)).x)) + minx[0]); } } while (0);
    }

    /* the map */
    if (flp & 1) {
        for (x = minx[0]; x <= maxx[0]; x++)
            for (y = miny[0]; y < (miny[0] + Math.trunc((maxy[0] - miny[0] + 1) / 2)); y++) {
                let ny = ((maxy[0] - (y)) + miny[0]);

                flip_dbridge_vertical(levl()[x][y]);
                flip_dbridge_vertical(levl()[x][ny]);

                struct_assign(trm, levl()[x][y]);
                struct_assign(levl()[x][y], levl()[x][ny]);
                struct_assign(levl()[x][ny], trm);

                otmp = svl.level.objects[x][y];
                svl.level.objects[x][y] = svl.level.objects[x][ny];
                svl.level.objects[x][ny] = otmp;

                mtmp = svl.level.monsters[x][y];
                svl.level.monsters[x][y] = svl.level.monsters[x][ny];
                svl.level.monsters[x][ny] = mtmp;
            }
    }
    if (flp & 2) {
        for (x = minx[0]; x < (minx[0] + Math.trunc((maxx[0] - minx[0] + 1) / 2)); x++)
            for (y = miny[0]; y <= maxy[0]; y++) {
                let nx = ((maxx[0] - (x)) + minx[0]);

                flip_dbridge_horizontal(levl()[x][y]);
                flip_dbridge_horizontal(levl()[nx][y]);

                struct_assign(trm, levl()[x][y]);
                struct_assign(levl()[x][y], levl()[nx][y]);
                struct_assign(levl()[nx][y], trm);

                otmp = svl.level.objects[x][y];
                svl.level.objects[x][y] = svl.level.objects[nx][y];
                svl.level.objects[nx][y] = otmp;

                mtmp = svl.level.monsters[x][y];
                svl.level.monsters[x][y] = svl.level.monsters[nx][y];
                svl.level.monsters[nx][y] = mtmp;
            }
    }

    /* timed effects */
    for (timer = gt.timer_base; timer; timer = timer.next) {
        if (timer.func_index == MELT_ICE_AWAY) {
            let ty = timer.arg.a_long & 0xffff;
            let tx = shr64(timer.arg.a_long, 16) & 0xffff;

            if (flp & 1)
                ty = ((maxy[0] - (ty)) + miny[0]);
            if (flp & 2)
                tx = ((maxx[0] - (tx)) + minx[0]);
            timer.arg.a_long = or64(shl64(tx, 16), ty);
        }
    }

    /* exclusion zones */
    for (ez = sve.exclusion_zones; ez; ez = ez.next) {
        if (flp & 1) {
            ez.ly = ((maxy[0] - (ez.ly)) + miny[0]);
            ez.hy = ((maxy[0] - (ez.hy)) + miny[0]);
            if (ez.ly > ez.hy) {
                itmp = ez.ly;
                ez.ly = ez.hy;
                ez.hy = itmp;
            }
        }
        if (flp & 2) {
            ez.lx = ((maxx[0] - (ez.lx)) + minx[0]);
            ez.hx = ((maxx[0] - (ez.hx)) + minx[0]);
            if (ez.lx > ez.hx) {
                itmp = ez.lx;
                ez.lx = ez.hx;
                ez.hx = itmp;
            }
        }
    }

    if (extras) { /* for #wizfliplevel rather than during level creation */
        /* flip hero location only if inside the flippable area */
        if ((((((u.ux) >= minx[0]) && ((u.ux) <= maxx[0])) && ((u.uy) >= miny[0])) && ((u.uy) <= maxy[0]))) {
            if (flp & 1)
                u.uy = ((maxy[0] - (u.uy)) + miny[0]);
            if (flp & 2)
                u.ux = ((maxx[0] - (u.ux)) + minx[0]);
            /* we could flip <ux0,uy0> too if it's inside the flip area,
               but have to resort to this if outside, so just do this */
            u.ux0 = u.ux, u.uy0 = u.uy;
        }
        if (ball_active && !ball_fliparea)
            placebc();
        do { if (((iflags.travelcc).x && ((((((iflags.travelcc).x) >= minx[0]) && (((iflags.travelcc).x) <= maxx[0])) && (((iflags.travelcc).y) >= miny[0])) && (((iflags.travelcc).y) <= maxy[0])))) { if ((flp & 1)) (iflags.travelcc).y = ((maxy[0] - ((iflags.travelcc).y)) + miny[0]); if ((flp & 2)) (iflags.travelcc).x = ((maxx[0] - ((iflags.travelcc).x)) + minx[0]); } } while (0);
        do { if (((svc.context.digging.pos).x && ((((((svc.context.digging.pos).x) >= minx[0]) && (((svc.context.digging.pos).x) <= maxx[0])) && (((svc.context.digging.pos).y) >= miny[0])) && (((svc.context.digging.pos).y) <= maxy[0])))) { if ((flp & 1)) (svc.context.digging.pos).y = ((maxy[0] - ((svc.context.digging.pos).y)) + miny[0]); if ((flp & 2)) (svc.context.digging.pos).x = ((maxx[0] - ((svc.context.digging.pos).x)) + minx[0]); } } while (0);
    }

    fix_wall_spines(1, 0, COLNO - 1, ROWNO - 1);
    if (extras && flp) {
        set_wall_state();
        /* after wall_spines; flips seenv and wall joins */
        flip_visuals(flp, minx[0], miny[0], maxx[0], maxy[0]);
    }
    vision_reset();
    } finally { stack_pop($frame); }
}

/* for #wizfliplevel, flip guard's egd data; not needed for level creation */
function flip_vault_guard(
    flp,
    grd,
    minx, miny,
    maxx, maxy) { /* void */ /* and inFlipArea() macros */
    let i;
    let egd = EGD(grd);

    if ((((((egd.gdx) >= minx) && ((egd.gdx) <= maxx)) && ((egd.gdy) >= miny)) && ((egd.gdy) <= maxy))) {
        if (flp & 1)
            egd.gdy = ((maxy - (egd.gdy)) + miny);
        if (flp & 2)
            egd.gdx = ((maxx - (egd.gdx)) + minx);
    }
    if ((((((egd.ogx) >= minx) && ((egd.ogx) <= maxx)) && ((egd.ogy) >= miny)) && ((egd.ogy) <= maxy))) {
        if (flp & 1)
            egd.ogy = ((maxy - (egd.ogy)) + miny);
        if (flp & 2)
            egd.ogx = ((maxx - (egd.ogx)) + minx);
    }
    for (i = egd.fcbeg; i < egd.fcend; ++i) {
        let fx = egd.fakecorr[i].fx, fy = egd.fakecorr[i].fy;

        if ((((((fx) >= minx) && ((fx) <= maxx)) && ((fy) >= miny)) && ((fy) <= maxy))) {
            if (flp & 1)
                egd.fakecorr[i].fy = ((maxy - (fy)) + miny);
            if (flp & 2)
                egd.fakecorr[i].fx = ((maxx - (fx)) + minx);
        }
    }
    return;
}

/* randomly transpose top with bottom or left with right or both;
   caller controls which transpositions are allowed */
export function flip_level_rnd(flp, extras) { /* void */
    let c = 0;

    /* TODO?
     *  Might change rn2(2) to !rn2(3) or (rn2(5) < 2) in order to bias
     *  the outcome towards the traditional orientation.
     */
    if ((flp & 1) && rn2(2))
        c |= 1;
    if ((flp & 2) && rn2(2))
        c |= 2;

    if (c)
        flip_level(c, extras);
}

function sel_set_wall_property(x, y, arg) { /* void */
    let prop = ref_to(int, arg)[0];

    if (IS_STWALL(levl()[x][y].typ) || IS_TREE(levl()[x][y].typ)
        /* 3.6.2: made iron bars eligible to be flagged nondiggable
           (checked by chewing(hack.c) and zap_over_floor(zap.c)) */
        || levl()[x][y].typ == IRONBARS)
        levl()[x][y].flags |= prop;
}

/*
 * Make walls of the area (x1, y1, x2, y2) non diggable/non passwall-able
 */
function set_wall_property(x1, y1, x2, y2, prop$) { /* void */
    const $frame = stack_frame(); try {
    const prop = stack_var(int, prop$);
    let x, y;

    x1 = max(x1, 1);
    x2 = min(x2, COLNO - 1);
    y1 = max(y1, 0);
    y2 = min(y2, ROWNO - 1);
    for (y = y1; y <= y2; y++)
        for (x = x1; x <= x2; x++) {
            sel_set_wall_property(x, y, addr_of(prop));
        }
    } finally { stack_pop($frame); }
}

function remove_boundary_syms() { /* void */
    /*
     * If any CROSSWALLs are found, must change to ROOM after REGION's
     * are laid out.  CROSSWALLS are used to specify "invisible"
     * boundaries where DOOR syms look bad or aren't desirable.
     */
    let x, y;
    let has_bounds = FALSE;

    for (x = 0; x < COLNO - 1; x++)
        for (y = 0; y < ROWNO - 1; y++)
            if (levl()[x][y].typ == CROSSWALL) {
                has_bounds = TRUE;
                break;
            }
    if (has_bounds) {
        for (x = 0; x < gx.x_maze_max; x++)
            for (y = 0; y < gy.y_maze_max; y++)
                if ((levl()[x][y].typ == CROSSWALL) && chars[SpLev_Map[x] + y])
                    levl()[x][y].typ = ROOM;
    }
}

/* used by sel_set_door() and link_doors_rooms() */
function set_door_orientation(x, y) { /* void */
    let wleft, wright, wup, wdown;

    /* If there's a wall or door on either the left side or right
     * side (or both) of this secret door, make it be horizontal.
     *
     * It is feasible to put SDOOR in a corner, tee, or crosswall
     * position, although once the door is found and opened it won't
     * make a lot sense (diagonal access required).  Still, we try to
     * handle that as best as possible.  For top or bottom tee, using
     * horizontal is the best we can do.  For corner or crosswall,
     * either horizontal or vertical are just as good as each other;
     * we produce horizontal for corners and vertical for crosswalls.
     * For left or right tee, using vertical is best.
     *
     * A secret door with no adjacent walls is also feasible and makes
     * even less sense.  It will be displayed as a vertical wall while
     * hidden and become a vertical door when found.  Before resorting
     * to that, we check for solid rock which hasn't been wallified
     * yet (cf lower leftside of leader's room in Cav quest).
     */
    wleft  = (isok(x - 1, y) && (IS_WALL(levl()[x - 1][y].typ)
                                 || IS_DOOR(levl()[x - 1][y].typ)
                                 || levl()[x - 1][y].typ == SDOOR) ? 1 : 0);
    wright = (isok(x + 1, y) && (IS_WALL(levl()[x + 1][y].typ)
                                 || IS_DOOR(levl()[x + 1][y].typ)
                                 || levl()[x + 1][y].typ == SDOOR) ? 1 : 0);
    wup    = (isok(x, y - 1) && (IS_WALL(elt(levl()[x], y - 1).typ)
                                 || IS_DOOR(elt(levl()[x], y - 1).typ)
                                 || elt(levl()[x], y - 1).typ == SDOOR) ? 1 : 0);
    wdown  = (isok(x, y + 1) && (IS_WALL(levl()[x][y + 1].typ)
                                 || IS_DOOR(levl()[x][y + 1].typ)
                                 || levl()[x][y + 1].typ == SDOOR) ? 1 : 0);
    if (!wleft && !wright && !wup && !wdown) {
        /* out of bounds is treated as implicit wall; should be academic
           because we don't expect to have doors so near the level's edge */
        wleft  = +(!isok(x - 1, y) || IS_DOORJOIN(levl()[x - 1][y].typ));
        wright = +(!isok(x + 1, y) || IS_DOORJOIN(levl()[x + 1][y].typ));
        wup    = +(!isok(x, y - 1) || IS_DOORJOIN(elt(levl()[x], y - 1).typ));
        wdown  = +(!isok(x, y + 1) || IS_DOORJOIN(levl()[x][y + 1].typ));
    }
    levl()[x][y].horizontal = ((wleft || wright) && !(wup && wdown)) ? 1 : 0;
}

/* is x,y right next to room droom? */
function shared_with_room(x, y, droom) { /* boolean */
    let rmno = ptr_diff(droom, svr.rooms[0]) + ROOMOFFSET;

    if (!isok(x,y))
        return FALSE;
    if ((levl()[x][y].roomno) == rmno && !levl()[x][y].edge)
        return FALSE;
    if (isok(x-1, y) && (levl()[x-1][y].roomno) == rmno && x-1 <= droom.hx)
        return TRUE;
    if (isok(x+1, y) && (levl()[x+1][y].roomno) == rmno && x+1 >= droom.lx)
        return TRUE;
    if (isok(x, y-1) && (elt(levl()[x], y-1).roomno) == rmno && y-1 <= droom.hy)
        return TRUE;
    if (isok(x, y+1) && (levl()[x][y+1].roomno) == rmno && y+1 >= droom.ly)
        return TRUE;
    return FALSE;
}

/* maybe add door at x,y to room droom */
function maybe_add_door(x, y, droom) { /* void */
    if (droom.hx >= 0
        && ((!droom.irregular && inside_room(droom, x, y))
            || (levl()[x][y].roomno) == ptr_diff(droom, svr.rooms[0]) + ROOMOFFSET
            || shared_with_room(x, y, droom))) {
        add_door(x, y, droom);
    }
}

/* link all doors in the map to their corresponding rooms */
function link_doors_rooms() { /* void */
    let x, y;
    let tmpi, m;

    for (y = 0; y < ROWNO; y++)
        for (x = 0; x < COLNO; x++)
            if (IS_DOOR(levl()[x][y].typ) || levl()[x][y].typ == SDOOR) {
                /* in case this door was a '+' or 'S' from the
                   MAP...ENDMAP section without an explicit DOOR
                   directive, set/clear levl[][].horizontal for it */
                set_door_orientation(x, y);

                for (tmpi = 0; tmpi < svn.nroom; tmpi++) {
                    maybe_add_door(x, y, svr.rooms[tmpi]);
                    for (m = 0; m < svr.rooms[tmpi].nsubrooms; m++) {
                        maybe_add_door(x, y, svr.rooms[tmpi].sbrooms[m]);
                    }
                }
            }
}

/*
 * Choose randomly the state (nodoor, open, closed or locked) for a door
 */
function rnddoor() { /* int */
    let state = static_array("rnddoor.state", int, null, [ D_NODOOR, D_BROKEN, D_ISOPEN, D_CLOSED, D_LOCKED ]);

    return ROLL_FROM(state);
}

/*
 * Select a random trap
 */
function rndtrap() { /* int */
    let rtrap;

    do {
        rtrap = rnd(TRAPNUM - 1);
        switch (rtrap) {
        case HOLE: /* no random holes on special levels */
        case VIBRATING_SQUARE:
        case MAGIC_PORTAL:
            rtrap = NO_TRAP;
            break;
        case TRAPDOOR:
            if (!Can_dig_down(u.uz))
                rtrap = NO_TRAP;
            break;
        case LEVEL_TELEP:
        case TELEP_TRAP:
            if (svl.level.flags.noteleport)
                rtrap = NO_TRAP;
            break;
        case ROLLING_BOULDER_TRAP:
        case ROCKTRAP:
            if (In_endgame(u.uz))
                rtrap = NO_TRAP;
            break;
        }
    } while (rtrap == NO_TRAP);
    return rtrap;
}

/*
 * Translate a given coordinate from a special level definition into an actual
 * location on the map.
 *
 * If x or y is negative, we generate a random coordinate within the area. If
 * not negative, they are interpreted as relative to the last defined map or
 * room, and are output as absolute svl.level.locations coordinates.
 *
 * The "humidity" flag is used to ensure that engravings aren't created
 * underwater, or eels on dry land.
 */
function get_location(
    x, y,
    humidity,
    croom) { /* void */
    const $frame = stack_frame(); try {
    var cpt = 0;
    var mx, my, sx, sy;

    if (croom) {
        mx = croom.lx;
        my = croom.ly;
        sx = croom.hx - mx + 1;
        sy = croom.hy - my + 1;
    } else {
        mx = gx.xstart;
        my = gy.ystart;
        sx = gx.xsize;
        sy = gy.ysize;
    }

    found_it: { if (x[0] >= 0) { /* normal locations */
        x[0] += mx;
        y[0] += my;
    } else { /* random location */
        do {
            if (croom) { /* handle irregular areas */
                var tmpc = stack_struct(struct_nhcoord);
                somexy(croom, tmpc);
                x[0] = tmpc.x;
                y[0] = tmpc.y;
            } else {
                x[0] = mx + rn2(sx);
                y[0] = my + rn2(sy);
            }
            if (is_ok_location(x[0], y[0], humidity))
                break;
        } while (++cpt < 100);
        if (cpt >= 100) {
            var xx, yy;

            /* last try */
            for (xx = 0; xx < sx; xx++)
                for (yy = 0; yy < sy; yy++) {
                    x[0] = mx + xx;
                    y[0] = my + yy;
                    if (is_ok_location(x[0], y[0], humidity))
                        break found_it;;
                }
            if (!(humidity & NO_LOC_WARN)) {
                impossible(_("get_location:  can't find a place!"));
            } else {
                x[0] = y[0] = -1;
            }
        }
    }
 }
    ;

    if (!(humidity & ANY_LOC) && !isok(x[0], y[0])) {
        if (!(humidity & NO_LOC_WARN)) {
            /*warning("get_location:  (%d,%d) out of bounds", *x, *y);*/
            x[0] = gx.x_maze_max;
            y[0] = gy.y_maze_max;
        } else {
            x[0] = y[0] = -1;
        }
    }
    } finally { stack_pop($frame); }
}

const is_ok_location_func = static_var("is_ok_location_func", fnptr_t, null);

function set_ok_location_func(func) { /* void */
    is_ok_location_func[0] = func;
}

function is_ok_location(x, y, humidity) { /* boolean */
    let typ = levl()[x][y].typ;

    if (Is_waterlevel(u.uz))
        return TRUE; /* accept any spot */

    if (is_ok_location_func[0])
        return is_ok_location_func[0](x, y);

    /* TODO: Should perhaps check if wall is diggable/passwall? */
    if (humidity & ANY_LOC)
        return TRUE;

    if ((humidity & SOLID) && IS_OBSTRUCTED(typ))
        return TRUE;

    if ((humidity & (DRY|SPACELOC)) && SPACE_POS(typ)) {
        let bould = +(sobj_at(BOULDER, x, y) != null);

        if (!bould || (bould && (humidity & SOLID)))
            return TRUE;
    }
    if ((humidity & WET) && is_pool(x, y))
        return TRUE;
    if ((humidity & HOT) && is_lava(x, y))
        return TRUE;
    return FALSE;
}

export function pm_good_location(x, y, pm) { /* boolean */
    return is_ok_location(x, y, unsigned(pm_to_humidity(pm)));
}

function get_unpacked_coord(loc, defhumidity) { /* unpacked_coord */
    let c = static_struct("get_unpacked_coord.c", unpacked_coord);

    if (loc & SP_COORD_IS_RANDOM) {
        c.x = c.y = -1;
        c.is_random = 1;
        c.getloc_flags = getloc_flags_t(and64(loc, ~SP_COORD_IS_RANDOM));
        if (!c.getloc_flags)
            c.getloc_flags = unsigned(defhumidity);
    } else {
        c.is_random = 0;
        c.getloc_flags = unsigned(defhumidity);
        c.x = SP_COORD_X(loc);
        c.y = SP_COORD_Y(loc);
    }
    return c;
}

export function get_location_coord(
    x, y,
    humidity,
    croom,
    crd) { /* void */
    const $frame = stack_frame(); try {
    let c = stack_struct(unpacked_coord);

    struct_assign(c, get_unpacked_coord(crd, humidity));
    x[0] = c.x;
    y[0] = c.y;
    get_location(x, y, unsigned(c.getloc_flags | (c.is_random ? NO_LOC_WARN : 0)),
                 croom);

    if (x[0] == -1 && y[0] == -1 && c.is_random)
        get_location(x, y, unsigned(humidity), croom);
    } finally { stack_pop($frame); }
}

/*
 * Get a relative position inside a room.
 * negative values for x or y means RANDOM!
 */
function get_room_loc(x, y, croom) { /* void */
    const $frame = stack_frame(); try {
    let c = stack_struct(struct_nhcoord);

    if (x[0] < 0 && y[0] < 0) {
        if (somexy(croom, c)) {
            x[0] = c.x;
            y[0] = c.y;
        } else
            panic(_("get_room_loc : can't find a place!"));
    } else {
        if (x[0] < 0)
            x[0] = rn2(croom.hx - croom.lx + 1);
        if (y[0] < 0)
            y[0] = rn2(croom.hy - croom.ly + 1);
        x[0] += croom.lx;
        y[0] += croom.ly;
    }
    } finally { stack_pop($frame); }
}

/*
 * Get a relative position inside a room.
 * negative values for x or y means RANDOM!
 */
function get_free_room_loc(
    x, y,
    croom,
    pos) { /* void */
    const $frame = stack_frame(); try {
    let try_x = stack_var(coordxy), try_y = stack_var(coordxy);
    let trycnt = 0;

    get_location_coord(try_x, try_y, DRY, croom, pos);
    if (levl()[try_x[0]][try_y[0]].typ != ROOM) {
        do {
            try_x[0] = x[0], try_y[0] = y[0];
            get_room_loc(try_x, try_y, croom);
        } while (levl()[try_x[0]][try_y[0]].typ != ROOM && ++trycnt <= 100);

        if (trycnt > 100)
            panic(_("get_free_room_loc:  can't find a place!"));
    }
    x[0] = try_x[0], y[0] = try_y[0];
    } finally { stack_pop($frame); }
}

export function check_room(
    lowx, ddx,
    lowy, ddy,
    vault) { /* boolean */
    var x, y, hix = lowx[0] + ddx[0], hiy = lowy[0] + ddy[0];
    var lev;
    var xlim, ylim, ymax;
    var s_lowx, s_ddx, s_lowy, s_ddy;

    s_lowx = lowx[0]; s_ddx = ddx[0];
    s_lowy = lowy[0]; s_ddy = ddy[0];

    xlim = XLIM + (vault ? 1 : 0);
    ylim = YLIM + (vault ? 1 : 0);

    if (lowx[0] < 3)
        lowx[0] = 3;
    if (lowy[0] < 2)
        lowy[0] = 2;
    if (hix > COLNO - 3)
        hix = COLNO - 3;
    if (hiy > ROWNO - 3)
        hiy = ROWNO - 3;
 chk: for (;;) {
    if (hix <= lowx[0] || hiy <= lowy[0])
        return FALSE;

    if (gi.in_mk_themerooms && (s_lowx != lowx[0]) && (s_ddx != ddx[0])
        && (s_lowy != lowy[0]) && (s_ddy != ddy[0]))
        return FALSE;

    /* check area around room (and make room smaller if necessary) */
    for (x = lowx[0] - xlim; x <= hix + xlim; x++) {
        if (x <= 0 || x >= COLNO)
            continue;
        y = lowy[0] - ylim;
        ymax = hiy + ylim;
        if (y < 0)
            y = 0;
        if (ymax >= ROWNO)
            ymax = (ROWNO - 1);
        lev = ptr_add(levl()[x][0], y);
        for (; y <= ymax; y++) {
            if ((lev = ptr_add(lev, 1), ptr_add(lev, -1)).typ != STONE) {
                if (!vault) {
                    debugpline2(_("strange area [%d,%d] in check_room."), x, y, __FILE__);
                }
                if (!rn2(3))
                    return FALSE;
                if (gi.in_mk_themerooms)
                    return FALSE;
                if (x < lowx[0])
                    lowx[0] = x + xlim + 1;
                else
                    hix = x - xlim - 1;
                if (y < lowy[0])
                    lowy[0] = y + ylim + 1;
                else
                    hiy = y - ylim - 1;
                continue chk;
            }
        }
    } break; }
    ddx[0] = hix - lowx[0];
    ddy[0] = hiy - lowy[0];

    if (gi.in_mk_themerooms && (s_lowx != lowx[0]) && (s_ddx != ddx[0])
        && (s_lowy != lowy[0]) && (s_ddy != ddy[0]))
        return FALSE;

    return TRUE;
}

/*
 * Create a new room.
 * This is still very incomplete...
 */
export function create_room(
    x, y,
    w, h,
    xal, yal,
    rtype, rlit) { /* boolean */
    const $frame = stack_frame(); try {
    let xabs = stack_var(coordxy, 0), yabs = stack_var(coordxy, 0);
    let wtmp, htmp, xaltmp, yaltmp, xtmp, ytmp;
    let r1 = null, r2 = stack_struct(struct_nhrect);
    let trycnt = 0;
    let vault = FALSE;
    let xlim = XLIM, ylim = YLIM;

    if (rtype == -1) /* Is the type random ? */
        rtype = OROOM;

    if (rtype == VAULT) {
        vault = TRUE;
        xlim++;
        ylim++;
    }

    /* on low levels the room is lit (usually) */
    /* some other rooms may require lighting */

    /* is light state random ? */
    rlit = litstate_rnd(rlit);

    /*
     * Here we will try to create a room. If some parameters are
     * random we are willing to make several try before we give
     * it up.
     */
    do {
        let xborder, yborder;

        wtmp = w;
        htmp = h;
        xtmp = x;
        ytmp = y;
        xaltmp = xal;
        yaltmp = yal;

        /* First case : a totally random room */

        if ((xtmp < 0 && ytmp < 0 && wtmp < 0 && xaltmp < 0 && yaltmp < 0)
            || vault) {
            let hx, hy, lx, ly, dx = stack_var(coordxy), dy = stack_var(coordxy);

            r1 = rnd_rect(); /* Get a random rectangle */

            if (!r1) { /* No more free rectangles ! */
                debugpline0(_("No more rects..."), __FILE__);
                return FALSE;
            }
            hx = r1.hx;
            hy = r1.hy;
            lx = r1.lx;
            ly = r1.ly;
            if (vault) {
                dx[0] = dy[0] = 1;
            } else {
                dx[0] = 2 + rn2((hx - lx > 28) ? 12 : 8);
                dy[0] = 2 + rn2(4);
                if (dx[0] * dy[0] > 50)
                    dy[0] = Math.trunc(50 / dx[0]);
            }
            xborder = (lx > 0 && hx < COLNO - 1) ? 2 * xlim : xlim + 1;
            yborder = (ly > 0 && hy < ROWNO - 1) ? 2 * ylim : ylim + 1;
            if (hx - lx < dx[0] + 3 + xborder || hy - ly < dy[0] + 3 + yborder) {
                r1 = null;
                continue;
            }
            xabs[0] = lx + (lx > 0 ? xlim : 3)
                   + rn2(hx - (lx > 0 ? lx : 3) - dx[0] - xborder + 1);
            yabs[0] = ly + (ly > 0 ? ylim : 2)
                   + rn2(hy - (ly > 0 ? ly : 2) - dy[0] - yborder + 1);
            if (ly == 0 && hy >= ROWNO - 1
                && (!svn.nroom || !rn2(svn.nroom))
                && (yabs[0] + dy[0] > Math.trunc(ROWNO / 2))) {
                yabs[0] = rn1(3, 2);
                if (svn.nroom < 4 && dy[0] > 1)
                    dy[0]--;
            }
            if (!check_room(xabs, dx, yabs, dy, vault)) {
                r1 = null;
                continue;
            }
            wtmp = dx[0] + 1;
            htmp = dy[0] + 1;
            r2.lx = xabs[0] - 1;
            r2.ly = yabs[0] - 1;
            r2.hx = xabs[0] + wtmp;
            r2.hy = yabs[0] + htmp;
        } else { /* Only some parameters are random */
            let rndpos = 0;
            let dx = stack_var(coordxy), dy = stack_var(coordxy);

            if (xtmp < 0 && ytmp < 0) { /* Position is RANDOM */
                xtmp = rnd(5);
                ytmp = rnd(5);
                rndpos = 1;
            }
            if (wtmp < 0 || htmp < 0) { /* Size is RANDOM */
                wtmp = rn1(15, 3);
                htmp = rn1(8, 2);
            }
            if (xaltmp == -1) /* Horizontal alignment is RANDOM */
                xaltmp = rnd(3);
            if (yaltmp == -1) /* Vertical alignment is RANDOM */
                yaltmp = rnd(3);

            /* Try to generate real (absolute) coordinates here! */

            xabs[0] = Math.trunc(((xtmp - 1) * COLNO) / 5) + 1;
            yabs[0] = Math.trunc(((ytmp - 1) * ROWNO) / 5) + 1;
            switch (xaltmp) {
            case SPLEV_LEFT:
                break;
            case SPLEV_RIGHT:
                xabs[0] += Math.trunc(COLNO / 5) - wtmp;
                break;
            case SPLEV_CENTER:
                xabs[0] += Math.trunc((Math.trunc(COLNO / 5) - wtmp) / 2);
                break;
            }
            switch (yaltmp) {
            case TOP:
                break;
            case BOTTOM:
                yabs[0] += Math.trunc(ROWNO / 5) - htmp;
                break;
            case SPLEV_CENTER:
                yabs[0] += Math.trunc((Math.trunc(ROWNO / 5) - htmp) / 2);
                break;
            }

            if (xabs[0] + wtmp - 1 > COLNO - 2)
                xabs[0] = COLNO - wtmp - 3;
            if (xabs[0] < 2)
                xabs[0] = 2;
            if (yabs[0] + htmp - 1 > ROWNO - 2)
                yabs[0] = ROWNO - htmp - 3;
            if (yabs[0] < 2)
                yabs[0] = 2;

            /* Try to find a rectangle that fit our room ! */

            r2.lx = xabs[0] - 1;
            r2.ly = yabs[0] - 1;
            r2.hx = xabs[0] + wtmp + rndpos;
            r2.hy = yabs[0] + htmp + rndpos;
            r1 = get_rect(r2);
            dx[0] = wtmp;
            dy[0] = htmp;

            if (r1 && !check_room(xabs, dx, yabs, dy, vault)) {
                r1 = null;
            }
        }
    } while (++trycnt <= 100 && !r1);
    if (!r1) { /* creation of room failed ? */
        return FALSE;
    }
    split_rects(r1, r2);

    if (!vault) {
        gs.smeq[svn.nroom] = svn.nroom;
        add_room(xabs[0], yabs[0], xabs[0] + wtmp - 1, yabs[0] + htmp - 1, rlit, rtype,
                 FALSE);
    } else {
        svr.rooms[svn.nroom].lx = xabs[0];
        svr.rooms[svn.nroom].ly = yabs[0];
    }
    return TRUE;
    } finally { stack_pop($frame); }
}

/*
 * Create a subroom in room proom at pos x,y with width w & height h.
 * x & y are relative to the parent room.
 */
function create_subroom(
    proom,
    x, y,
    w, h,
    rtype, rlit) { /* boolean */
    let width, height;

    width = proom.hx - proom.lx + 1;
    height = proom.hy - proom.ly + 1;

    /* There is a minimum size for the parent room */
    if (width < 4 || height < 4)
        return FALSE;

    /* Check for random position, size, etc... */

    if (w == -1)
        w = rnd(width - 3);
    if (h == -1)
        h = rnd(height - 3);
    if (x == -1)
        x = rnd(width - w);
    if (y == -1)
        y = rnd(height - h);
    if (x == 1)
        x = 0;
    if (y == 1)
        y = 0;
    if ((x + w + 1) == width)
        x++;
    if ((y + h + 1) == height)
        y++;
    if (rtype == -1)
        rtype = OROOM;
    rlit = litstate_rnd(rlit);
    add_subroom(proom, proom.lx + x, proom.ly + y, proom.lx + x + w - 1,
                proom.ly + y + h - 1, rlit, rtype, FALSE);
    return TRUE;
}

/*
 * Create a new door in a room.
 * It's placed on a wall (north, south, east or west).
 */
function create_door(dd, broom) { /* void */
    let x = 0, y = 0;
    let trycnt;

    if (dd.secret == -1)
        dd.secret = rn2(2);

    if (dd.wall == W_RANDOM)
        dd.wall = W_ANY; /* speeds things up in the below loop */

    if (dd.mask == -1) {
        /* is it a locked door, closed, or a doorway? */
        if (!dd.secret) {
            if (!rn2(3)) {
                if (!rn2(5))
                    dd.mask = D_ISOPEN;
                else if (!rn2(6))
                    dd.mask = D_LOCKED;
                else
                    dd.mask = D_CLOSED;
                if (dd.mask != D_ISOPEN && !rn2(25))
                    dd.mask |= D_TRAPPED;
            } else
                dd.mask = D_NODOOR;
        } else {
            if (!rn2(5))
                dd.mask = D_LOCKED;
            else
                dd.mask = D_CLOSED;

            if (!rn2(20))
                dd.mask |= D_TRAPPED;
        }
    }

    for (trycnt = 0; trycnt < 100; ++trycnt) {
        let dwall = dd.wall, dpos = dd.pos;

        /* Convert wall and pos into an absolute coordinate! */
        switch (rn2(4)) {
        case 0:
            if (!(dwall & W_NORTH))
                continue;
            y = broom.ly - 1;
            x = broom.lx + ((dpos == -1) ? rn2(1 + broom.hx - broom.lx)
                                          : dpos);
            if (!isok(x, y - 1) || IS_OBSTRUCTED(elt(levl()[x], y - 1).typ))
                continue;
            break;
        case 1:
            if (!(dwall & W_SOUTH))
                continue;
            y = broom.hy + 1;
            x = broom.lx + ((dpos == -1) ? rn2(1 + broom.hx - broom.lx)
                                          : dpos);
            if (!isok(x, y + 1) || IS_OBSTRUCTED(levl()[x][y + 1].typ))
                continue;
            break;
        case 2:
            if (!(dwall & W_WEST))
                continue;
            x = broom.lx - 1;
            y = broom.ly + ((dpos == -1) ? rn2(1 + broom.hy - broom.ly)
                                          : dpos);
            if (!isok(x - 1, y) || IS_OBSTRUCTED(levl()[x - 1][y].typ))
                continue;
            break;
        case 3:
            if (!(dwall & W_EAST))
                continue;
            x = broom.hx + 1;
            y = broom.ly + ((dpos == -1) ? rn2(1 + broom.hy - broom.ly)
                                          : dpos);
            if (!isok(x + 1, y) || IS_OBSTRUCTED(levl()[x + 1][y].typ))
                continue;
            break;
        default:
            /*NOTREACHED*/
            break;
        }

        if (okdoor(x, y))
            break;
    }
    if (trycnt >= 100) {
        impossible(_("create_door: Can't find a proper place!"));
        return;
    }
    if (!set_levltyp(x, y, (dd.secret ? SDOOR : DOOR)))
        return;
    levl()[x][y].flags = unsigned(dd.mask);
}

/*
 * Create a trap in a room.
 */
function create_trap(t, croom) { /* void */
    const $frame = stack_frame(); try {
    let x = stack_var(coordxy, -1), y = stack_var(coordxy, -1);
    let tm = stack_struct(struct_nhcoord);
    let mktrap_flags = MKTRAP_MAZEFLAG;

    if (t.type == VIBRATING_SQUARE) {
        pick_vibrasquare_location();
        maketrap(svi.inv_pos.x, svi.inv_pos.y, VIBRATING_SQUARE);
        return;
    } else if (croom) {
        get_free_room_loc(x, y, croom, t.coord);
    } else {
        let trycnt = 0;

        do {
            get_location_coord(x, y, DRY, croom, t.coord);
        } while ((levl()[x[0]][y[0]].typ == STAIRS || levl()[x[0]][y[0]].typ == LADDER)
                 && ++trycnt <= 100);
        if (trycnt > 100)
            return;
    }

    if (!t.spider_on_web)
        mktrap_flags = unsigned(mktrap_flags | MKTRAP_NOSPIDERONWEB);
    if (t.seen)
        mktrap_flags = unsigned(mktrap_flags | MKTRAP_SEEN);
    if (t.novictim)
        mktrap_flags = unsigned(mktrap_flags | MKTRAP_NOVICTIM);

    tm.x = x[0];
    tm.y = y[0];

    mktrap(t.type, mktrap_flags, null, tm);
    } finally { stack_pop($frame); }
}

/*
 * Create a monster in a room.
 */
function noncoalignment(alignment) { /* int */
    let k;

    k = rn2(2);
    if (!alignment)
        return (k ? -1 : 1);
    return (k ? -alignment : 0);
}

/* attempt to screen out locations where a mimic-as-boulder shouldn't occur */
function m_bad_boulder_spot(x, y) { /* boolean */
    let lev;

    /* avoid trap locations */
    if (t_at(x, y))
        return TRUE;
    /* try to avoid locations which already have a boulder (this won't
       actually work; we get called before objects have been placed...) */
    if (sobj_at(BOULDER, x, y))
        return TRUE;
    /* avoid closed doors */
    lev = levl()[x][y];
    if (IS_DOOR(lev.typ) && (lev.flags & (D_CLOSED | D_LOCKED)) != 0)
        return TRUE;
    /* spot is ok */
    return FALSE;
}

function pm_to_humidity(pm) { /* int */
    let loc = DRY;

    if (!pm)
        return loc;
    if (pm.mlet == S_EEL || amphibious(pm) || is_swimmer(pm))
        loc = WET;
    if (is_flyer(pm) || is_floater(pm))
        loc |= (HOT | WET);
    if (passes_walls(pm) || noncorporeal(pm))
        loc |= SOLID;
    if (likes_fire(pm))
        loc |= HOT;
    return loc;
}

/*
 * Convert a special level alignment mask (an alignment mask with possible
 * extra values/flags) to a "normal" alignment mask (no extra flags).
 *
 * When random: there is an 80% chance that the altar will be co-aligned.
 */
function sp_amask_to_amask(sp_amask) { /* unsigned int */
    let amask;

    if (sp_amask == AM_SPLEV_CO)
        amask = Align2amask(chars[u.ualignbase + A_ORIGINAL]);
    else if (sp_amask == AM_SPLEV_NONCO)
        amask = unsigned((((noncoalignment(chars[u.ualignbase + A_ORIGINAL])) == A_NONE) ? AM_NONE : (((noncoalignment(chars[u.ualignbase + A_ORIGINAL])) == A_LAWFUL) ? AM_LAWFUL : ((noncoalignment(chars[u.ualignbase + A_ORIGINAL])) + 2))));
    else if (sp_amask == AM_SPLEV_RANDOM)
        amask = induced_align(80);
    else
        amask = sp_amask & AM_MASK;

    return amask;
}

function create_monster(m, croom) { /* void */
    const $frame = stack_frame(); try {
    let mtmp;
    let x = stack_var(coordxy), y = stack_var(coordxy);
    let class_;
    let amask;
    let cc = stack_struct(struct_nhcoord);
    let pm;
    let g_mvflags;

    if (m.class >= 0)
        class_ = char(def_char_to_monclass(char(m.class)));
    else
        class_ = 0;

    if (class_ == MAXMCLASSES)
        panic(_("create_monster: unknown monster class '%c'"), m.class);

    amask = sp_amask_to_amask(m.sp_amask);

    if (!class_) {
        pm = null;
    } else if (m.id != NON_PM) {
        pm = mons[m.id];
        g_mvflags = (svm.mvitals[monsndx(pm)].mvflags);
        if ((pm.geno & G_UNIQ) && (g_mvflags & G_EXTINCT))
            return;
        if (g_mvflags & G_GONE) /* genocided or extinct */
            pm = null; /* make random monster */
    } else {
        pm = mkclass(class_, G_NOGEN);
        /* if we can't get a specific monster type (pm == 0) then the
           class has been genocided, so settle for a random monster */
    }
    if (In_mines(u.uz) && pm && your_race(pm)
        && (Race_if(PM_DWARF) || Race_if(PM_GNOME)) && rn2(3))
        pm = null;

    if (pm) {
        let loc = pm_to_humidity(pm);

        /* If water-liking monster, first try is without DRY */
        get_location_coord(x, y, loc | NO_LOC_WARN, croom, m.coord);
        if (x[0] == -1 && y[0] == -1) {
            loc |= DRY;
            get_location_coord(x, y, loc, croom, m.coord);
        }
    } else {
        get_location_coord(x, y, DRY, croom, m.coord);
    }

    /* try to find a close place if someone else is already there */
    if (MON_AT(x[0], y[0]) && enexto(cc, x[0], y[0], pm))
        x[0] = cc.x, y[0] = cc.y;

    if (croom && !inside_room(croom, x[0], y[0]))
        return;

    if (m.sp_amask != AM_SPLEV_RANDOM)
        mtmp = mk_roamer(pm, Amask2align(amask), x[0], y[0], m.peaceful);
    else if (PM_ARCHEOLOGIST <= m.id && m.id <= PM_WIZARD)
        mtmp = mk_mplayer(pm, x[0], y[0], FALSE);
    else
        mtmp = makemon(pm, x[0], y[0], m.mm_flags);

    if (mtmp) {
        x[0] = mtmp.mx, y[0] = mtmp.my; /* sanity precaution */
        m.x = x[0], m.y = y[0];
        /* handle specific attributes for some special monsters */
        if (m.name.str)
            mtmp = christen_monst(mtmp, m.name.str);

        /*
         * This doesn't complain if an attempt is made to give a
         * non-mimic/non-shapechanger an appearance or to give a
         * shapechanger a non-monster shape, it just refuses to comply.
         */
        if (m.appear_as.str
            && ((mtmp.data.mlet == S_MIMIC)
                /* shapechanger (chameleons, et al, and vampires) */
                || (ismnum(mtmp.cham) && m.appear == M_AP_MONSTER))
            && !Protection_from_shape_changers()) {
            let i;

            switch (m.appear) {
            case M_AP_NOTHING:
                impossible(
                 _("create_monster: mon has an appearance, \"%s\", but no type"),
                           m.appear_as.str);
                break;

            case M_AP_FURNITURE:
                for (i = 0; i < MAXPCHARS; i++)
                    if (!strcmp(defsyms[i].explanation, m.appear_as.str))
                        break;
                if (i == MAXPCHARS) {
                    impossible(_("create_monster: can't find feature \"%s\""),
                               m.appear_as.str);
                } else {
                    mtmp.m_ap_type = M_AP_FURNITURE;
                    mtmp.mappearance = unsigned(i);
                }
                break;

            case M_AP_OBJECT:
                for (i = 0; i < NUM_OBJECTS; i++)
                    if (OBJ_NAME(objects[i])
                        && !strcmp(OBJ_NAME(objects[i]), m.appear_as.str))
                        break;
                if (i == NUM_OBJECTS) {
                    impossible(_("create_monster: can't find object \"%s\""),
                               m.appear_as.str);
                } else {
                    mtmp.m_ap_type = M_AP_OBJECT;
                    mtmp.mappearance = unsigned(i);
                    /* try to avoid placing mimic boulder on a trap */
                    if (i == BOULDER && m.x < 0
                        && m_bad_boulder_spot(x[0], y[0])) {
                        let retrylimit = 10;

                        remove_monster(x[0], y[0]);
                        do {
                            x[0] = m.x;
                            y[0] = m.y;
                            get_location(x, y, DRY, croom);
                            if (MON_AT(x[0], y[0]) && enexto(cc, x[0], y[0], pm))
                                x[0] = cc.x, y[0] = cc.y;
                        } while (m_bad_boulder_spot(x[0], y[0])
                                 && --retrylimit > 0);
                        place_monster(mtmp, x[0], y[0]);
                        /* if we didn't find a good spot
                           then mimic something else */
                        if (!retrylimit)
                            set_mimic_sym(mtmp);
                    }
                }
                break;

            case M_AP_MONSTER: {
                let mndx = stack_var(int), gender_name_var = stack_var(int, NEUTRAL);

                if (!strncmpi((m.appear_as.str), _(("random")), -1))
                    mndx[0] = select_newcham_form(mtmp);
                else
                    mndx[0] = name_to_mon(m.appear_as.str, gender_name_var);

                if (mndx[0] == NON_PM || (is_vampshifter(mtmp)
                                       && !validvamp(mtmp, mndx, S_HUMAN))) {
                    impossible(_("create_monster: invalid %s (\"%s\")"),
                               (mtmp.data.mlet == S_MIMIC)
                                 ? _("mimic appearance")
                                 : (mtmp.data == mons[PM_WIZARD_OF_YENDOR])
                                     ? _("Wizard appearance")
                                     : is_vampshifter(mtmp)
                                         ? _("vampire shape")
                                         : _("chameleon shape"),
                               m.appear_as.str);
                } else if (mons[mndx[0]] == mtmp.data) {
                    /* explicitly forcing a mimic to appear as itself */
                    mtmp.m_ap_type = M_AP_NOTHING;
                    mtmp.mappearance = 0;
                } else if (mtmp.data.mlet == S_MIMIC
                           || mtmp.data == mons[PM_WIZARD_OF_YENDOR]) {
                    /* this is ordinarily only used for Wizard clones
                       and hasn't been exhaustively tested for mimics */
                    mtmp.m_ap_type = M_AP_MONSTER;
                    mtmp.mappearance = unsigned(mndx[0]);
                } else { /* chameleon or vampire */
                    let mdat = mons[mndx[0]];
                    let olddata = mtmp.data;

                    mgender_from_permonst(mtmp, mdat);
                    if (gender_name_var[0] != NEUTRAL)
                        mtmp.female = unsigned(gender_name_var[0]);
                    set_mon_data(mtmp, mdat);
                    if (emits_light(olddata) != emits_light(mtmp.data)) {
                        /* used to give light, now doesn't, or vice versa,
                           or light's range has changed */
                        if (emits_light(olddata))
                            del_light_source(LS_MONSTER, monst_to_any(mtmp));
                        if (emits_light(mtmp.data))
                            new_light_source(mtmp.mx, mtmp.my,
                                             emits_light(mtmp.data),
                                             LS_MONSTER, monst_to_any(mtmp));
                    }
                    if (!mtmp.perminvis || pm_invisible(olddata))
                        mtmp.perminvis = pm_invisible(mdat);
                }
                break;
            }
            default:
                impossible(
                  _("create_monster: unimplemented mon appear type [%d,\"%s\"]"),
                           m.appear, m.appear_as.str);
                break;
            }
            if (does_block(x[0], y[0], levl()[x[0]][y[0]]))
                block_point(x[0], y[0]);
        }

        mtmp.female = unsigned(m.female);
        if (m.peaceful > BOOL_RANDOM) {
            mtmp.mpeaceful = unsigned(m.peaceful);
            /* changed mpeaceful again; have to reset malign */
            set_malign(mtmp);
        }
        if (m.asleep > BOOL_RANDOM)
            mtmp.msleeping = unsigned(m.asleep);
        if (m.seentraps)
            mtmp.mtrapseen = m.seentraps;
        if (m.cancelled)
            mtmp.mcan = 1;
        if (m.revived)
            mtmp.mrevived = 1;
        if (m.avenge)
            mtmp.mavenge = 1;
        if (m.stunned)
            mtmp.mstun = 1;
        if (m.confused)
            mtmp.mconf = 1;
        if (m.invis) {
            mtmp.minvis = mtmp.perminvis = 1;
        }
        if (m.blinded) {
            mtmp.mcansee = 0;
            mtmp.mblinded = unsigned((m.blinded % 127));
        }
        if (m.paralyzed) {
            mtmp.mcanmove = 0;
            mtmp.mfrozen = unsigned((m.paralyzed % 127));
        }
        if (m.fleeing) {
            mtmp.mflee = 1;
            mtmp.mfleetim = unsigned((m.fleeing % 127));
        }
        if (m.waiting) {
            mtmp.mstrategy = or64u(mtmp.mstrategy, STRAT_WAITFORU);
            /* if this is a vampire that got created already shifted into
               bat/fog/wolf form and the special level or theme room didn't
               explicitly request that, shift back to vampire */
            if (vampshifted(mtmp) && m.appear != M_AP_MONSTER)
                newcham(mtmp, mons[mtmp.cham], NO_NC_FLAGS);
        }
        if (m.m_lev_adj) {
            if (mtmp.m_lev + m.m_lev_adj > 49)
                mtmp.m_lev = 49;
            else if (mtmp.m_lev + m.m_lev_adj < 0)
                mtmp.m_lev = 0;
            else
                mtmp.m_lev += m.m_lev_adj;
        }
        if (!(m.has_invent & DEFAULT_INVENT)) {
            /* guard against someone accidentally specifying e.g. quest nemesis
             * with custom inventory that lacks Bell or quest artifact but
             * forgetting to flag them as receiving their default inventory */
            mdrop_special_objs(mtmp);
            discard_minvent(mtmp, TRUE);
        }
        if (m.has_invent & CUSTOM_INVENT) {
            invent_carrying_monster[0] = mtmp;
        }
    }
    } finally { stack_pop($frame); }
}

/*
 * Create an object in a room.
 */
function create_object(o, croom) { /* struct obj * */
    const $frame = stack_frame(); try {
    let otmp;
    let x = stack_var(coordxy), y = stack_var(coordxy);
    let c;
    let named; /* has a name been supplied in level description? */

    named = o.name.str ? TRUE : FALSE;

    get_location_coord(x, y, DRY, croom, o.coord);

    if (o.class >= 0)
        c = o.class;
    else
        c = 0;

    if (!c) {
        otmp = mkobj_at(RANDOM_CLASS, x[0], y[0], +!named);
    } else if (o.id != -1) {
        otmp = mksobj_at(o.id, x[0], y[0], TRUE, +!named);
    } else {
        /*
         * The special levels are compiled with the default "text" object
         * class characters.  We must convert them to the internal format.
         */
        let oclass = char(def_char_to_objclass(c));

        if (oclass == MAXOCLASSES)
            panic(_("create_object:  unexpected object class '%c'"), c);

        /* KMH -- Create piles of gold properly */
        if (oclass == COIN_CLASS)
            otmp = mkgold(0, x[0], y[0]);
        else
            otmp = mkobj_at(oclass, x[0], y[0], +!named);
    }

    if (o.spe != -127) /* That means NOT RANDOM! */
        otmp.spe = schar(o.spe);

    switch (o.curse_state) {
    case 1: /* blessed */
        bless(otmp);
        break;
    case 2: /* uncursed */
        unbless(otmp);
        uncurse(otmp);
        break;
    case 3: /* cursed */
        curse(otmp);
        break;
    case 4: /* not cursed */
        uncurse(otmp);
        break;
    case 5: /* not uncursed */
        blessorcurse(otmp, 1);
        break;
    case 6: /* not blessed */
        unbless(otmp);
        break;
    default: /* random */
        break; /* keep what mkobj gave us */
    }

    /* corpsenm is "empty" if -1, random if -2, otherwise specific */
    if (o.corpsenm != NON_PM) {
        if (o.corpsenm == NON_PM - 1)
            set_corpsenm(otmp, rndmonnum());
        else
            set_corpsenm(otmp, o.corpsenm);
    }
    /* set_corpsenm() took care of egg hatch and corpse timers */

    if (named) {
        otmp = oname(otmp, o.name.str, ONAME_LEVEL_DEF);
        if (otmp.otyp == SPE_NOVEL) {
            /* needs to be an existing title */
            lookup_novel(o.name.str, ref_of(otmp, "corpsenm"));
        }
    }
    if (o.eroded) {
        if (o.eroded < 0) {
            otmp.oerodeproof = 1;
        } else {
            otmp.oeroded = unsigned((o.eroded % 4));
            otmp.oeroded2 = unsigned(((o.eroded >> 2) % 4));
        }
    } else {
        otmp.oeroded = otmp.oeroded2 = 0;
        otmp.oerodeproof = 0;
    }
    if (o.recharged)
        otmp.recharged = unsigned((o.recharged % 8));
    if (o.locked == 0 || o.locked == 1) {
        otmp.olocked = unsigned(o.locked);
    } else if (o.broken) {
        otmp.obroken = 1;
        otmp.olocked = 0; /* obj generation may set */
    }
    if (o.trapped == 0 || o.trapped == 1)
        otmp.otrapped = unsigned(o.trapped);
    if (o.trapped && (o.tknown == 0 || o.tknown == 1))
        otmp.tknown = unsigned(o.tknown);
    otmp.greased = o.greased ? 1 : 0;

    if (o.quan > 0 && objects[otmp.otyp].oc_merge) {
        otmp.quan = o.quan;
        otmp.owt = unsigned(weight(otmp));
    }

    /* contents (of a container or monster's inventory) */
    if (o.containment & SP_OBJ_CONTENT || invent_carrying_monster[0]) {
        if (!container_idx[0]) {
            if (!invent_carrying_monster[0]) {
                /*impossible("create_object: no container");*/
                /* don't complain, the monster may be gone legally
                   (eg. unique demon already generated)
                   TODO: In the case of unique demon lords, they should
                   get their inventories even when they get generated
                   outside the des-file.  Maybe another data file that
                   determines what inventories monsters get by default?
                 */
                ; /* ['otmp' remains on floor] */
            } else {
                remove_object(otmp);
                if (otmp.otyp == SADDLE && can_saddle(invent_carrying_monster[0]))
                    put_saddle_on_mon(otmp, invent_carrying_monster[0]);
                else
                    mpickobj(invent_carrying_monster[0], otmp);
            }
        } else {
            let cobj = container_obj[container_idx[0] - 1];

            remove_object(otmp);
            if (cobj) {
                otmp = add_to_container(cobj, otmp);
                cobj.owt = unsigned(weight(cobj));
            } else {
                obj_extract_self(otmp);
                /* uncreate a random artifact created in a container */
                /* FIXME: it could be intentional rather than random */
                if (otmp.oartifact)
                    artifact_exists(otmp, safe_oname(otmp), FALSE,
                                    ONAME_NO_FLAGS); /* flags don't matter */
                obfree(otmp, null);
                return null;
            }
        }
    }
    /* container */
    if (o.containment & SP_OBJ_CONTAINER) {
        delete_contents(otmp);
        if (container_idx[0] < MAX_CONTAINMENT) {
            container_obj[container_idx[0]] = otmp;
            container_idx[0]++;
        } else
            impossible(_("create_object: too deeply nested containers."));
    }

    /* Medusa level special case: statues are petrified monsters, so they
     * are not stone-resistant and have monster inventory.  They also lack
     * other contents, but that can be specified as an empty container.
     */
    if (o.id == STATUE && Is_medusa_level(u.uz) && o.corpsenm == NON_PM) {
        let was = null;
        let obj;
        let wastyp;
        let i = 0; /* prevent endless loop in case makemon always fails */

        /* Named random statues are of player types, and aren't stone-
         * resistant (if they were, we'd have to reset the name as well as
         * setting corpsenm).
         */
        for (wastyp = otmp.corpsenm; i < 1000; i++, wastyp = rndmonnum()) {
            /* makemon without rndmonst() might create a group */
            was = makemon(mons[wastyp], 0, 0, MM_NOCOUNTBIRTH|MM_NOMSG);
            if (was) {
                if (!resists_ston(was) && !poly_when_stoned(mons[wastyp])) {
                    propagate(wastyp, TRUE, FALSE);
                    break;
                }
                mongone(was);
                was = null;
            }
        }
        if (was) {
            set_corpsenm(otmp, wastyp);
            while (was.minvent) {
                obj = was.minvent;
                obj.owornmask = 0;
                obj_extract_self(obj);
                add_to_container(otmp, obj);
            }
            otmp.owt = unsigned(weight(otmp));
            mongone(was);
        }
    }

    if (o.achievement) {
        let prize_warning = init_string(static_array("create_object.prize_warning", char, sizeof_string("multiple prizes on %s level")), _("multiple prizes on %s level"), true);

        if (Is_mineend_level(u.uz)) {
            if (!svc.context.achieveo.mines_prize_oid) {
                svc.context.achieveo.mines_prize_oid = otmp.o_id;
                svc.context.achieveo.mines_prize_otyp = otmp.otyp;
                /* prevent stacking; cleared when achievement is recorded;
                   will be reset in addinv_core1() */
                otmp.nomerge = 1;
            } else {
                impossible(prize_warning, _("mines end"));
            }
        } else if (Is_sokoend_level(u.uz)) {
            if (!svc.context.achieveo.soko_prize_oid) {
                svc.context.achieveo.soko_prize_oid = otmp.o_id;
                svc.context.achieveo.soko_prize_otyp = otmp.otyp;
                otmp.nomerge = 1; /* redundant; Sokoban prizes don't stack;
                                    * will be reset in addinv_core1() */
            } else {
                impossible(prize_warning, _("sokoban end"));
            }
        } else if (!iflags.lua_testing) {
            let lbuf = stack_array(char, QBUFSZ);

            describe_level(lbuf, 1 | 2);
            impossible(_("create_object: unknown achievement (%s\"%s\")"),
                       lbuf, simpleonames(otmp));
        }
    }

    if (!(o.containment & SP_OBJ_CONTENT)) {
        stackobj(otmp);

        if (o.lit)
            begin_burn(otmp, FALSE);

        if (o.buried) {
            let dealloced = stack_var(boolean);

            bury_an_obj(otmp, addr_of(dealloced));
            if (dealloced[0]) {
                if (container_idx[0])
                    container_obj[container_idx[0] - 1] = null;
                otmp = null;
            }
        }
    }
    return otmp;
    } finally { stack_pop($frame); }
}

/*
 * Create an altar in a room.
 */
function create_altar(a, croom) { /* void */
    const $frame = stack_frame(); try {
    let sproom;
    let x = stack_var(coordxy, -1), y = stack_var(coordxy, -1);
    let amask;
    let croom_is_temple = TRUE;

    if (croom) {
        get_free_room_loc(x, y, croom, a.coord);
        if (croom.rtype != TEMPLE)
            croom_is_temple = FALSE;
    } else {
        get_location_coord(x, y, DRY, croom, a.coord);
        if ((sproom = (chars[in_rooms(x[0], y[0], TEMPLE)])) != 0)
            croom = elt(svr.rooms, sproom - ROOMOFFSET);
        else
            croom_is_temple = FALSE;
    }

    /* check for existing features */
    if (!set_levltyp(x[0], y[0], ALTAR))
        return;

    amask = sp_amask_to_amask(a.sp_amask);

    levl()[x[0]][y[0]].flags = amask;

    if (a.shrine < 0)
        a.shrine = rn2(2); /* handle random case */

    if (!croom_is_temple || !a.shrine)
        return;

    if (a.shrine) { /* Is it a shrine  or sanctum? */
        priestini(u.uz, croom, x[0], y[0], +(a.shrine > 1));
        levl()[x[0]][y[0]].flags |= AM_SHRINE;
        if (a.shrine == 2) /* high altar or sanctum */
            levl()[x[0]][y[0]].flags |= AM_SANCTUM;
        svl.level.flags.has_temple = TRUE;
    }
    } finally { stack_pop($frame); }
}

/*
 * Search for a door in a room on a specified wall.
 */
function search_door(
    croom,
    x, y,
    wall, cnt) { /* boolean */
    let dx, dy;
    let xx, yy;

    switch (wall) {
    case W_SOUTH:
        dy = 0;
        dx = 1;
        xx = croom.lx;
        yy = croom.hy + 1;
        break;
    case W_NORTH:
        dy = 0;
        dx = 1;
        xx = croom.lx;
        yy = croom.ly - 1;
        break;
    case W_EAST:
        dy = 1;
        dx = 0;
        xx = croom.hx + 1;
        yy = croom.ly;
        break;
    case W_WEST:
        dy = 1;
        dx = 0;
        xx = croom.lx - 1;
        yy = croom.ly;
        break;
    default:
        panic(_("search_door: Bad wall!"));
        /*NOTREACHED*/
    }
    while (xx <= croom.hx + 1 && yy <= croom.hy + 1) {
        if (IS_DOOR(levl()[xx][yy].typ) || levl()[xx][yy].typ == SDOOR) {
            x[0] = xx;
            y[0] = yy;
            if (cnt-- <= 0)
                return TRUE;
        }
        xx += dx;
        yy += dy;
    }
    return FALSE;
}

/*
 * Dig a corridor between two points, using terrain ftyp.
 * if nxcor is TRUE, he corridor may be blocked by a boulder,
 * or just end without reaching the destination.
 * if not null, npoints has the number of map locations used
 */
export function dig_corridor(
    org, dest,
    npoints,
    nxcor,
    ftyp, btyp) { /* boolean */
    let dx = 0, dy = 0, dix, diy, cct;
    let crm;
    let tx, ty, xx, yy;

    if (npoints)
        npoints[0] = 0;
    xx = org.x;
    yy = org.y;
    tx = dest.x;
    ty = dest.y;
    if (xx <= 0 || yy <= 0 || tx <= 0 || ty <= 0 || xx > COLNO - 1
        || tx > COLNO - 1 || yy > ROWNO - 1 || ty > ROWNO - 1) {
        debugpline4(_("dig_corridor: bad coords <%d,%d> <%d,%d>."),
                    xx, yy, tx, ty, __FILE__);
        return FALSE;
    }
    if (tx > xx)
        dx = 1;
    else if (ty > yy)
        dy = 1;
    else if (tx < xx)
        dx = -1;
    else
        dy = -1;

    xx -= dx;
    yy -= dy;
    cct = 0;
    while (xx != tx || yy != ty) {
        /* loop: dig corridor at [xx,yy] and find new [xx,yy] */
        if (cct++ > 500 || (nxcor && !rn2(35)))
            return FALSE;

        xx += dx;
        yy += dy;

        if (xx >= COLNO - 1 || xx <= 0 || yy <= 0 || yy >= ROWNO - 1)
            return FALSE; /* impossible */

        crm = levl()[xx][yy];
        if (crm.typ == btyp) {
            if (ftyp == CORR && maybe_sdoor(100)) {
                if (npoints)
                    (npoints[0])++;
                crm.typ = SCORR;
            } else {
                if (npoints)
                    (npoints[0])++;
                crm.typ = ftyp;
                if (nxcor && !rn2(50))
                    mksobj_at(BOULDER, xx, yy, TRUE, FALSE);
            }
        } else if (crm.typ != ftyp && crm.typ != SCORR) {
            /* strange ... */
            return FALSE;
        }

        /* find next corridor position */
        dix = abs(xx - tx);
        diy = abs(yy - ty);

        if ((dix > diy) && diy && !rn2(dix - diy + 1)) {
            dix = 0;
        } else if ((diy > dix) && dix && !rn2(diy - dix + 1)) {
            diy = 0;
        }

        /* do we have to change direction ? */
        if (dy && dix > diy) {
            let ddx = (xx > tx) ? -1 : 1;

            crm = levl()[xx + ddx][yy];
            if (crm.typ == btyp || crm.typ == ftyp || crm.typ == SCORR) {
                dx = ddx;
                dy = 0;
                continue;
            }
        } else if (dx && diy > dix) {
            let ddy = (yy > ty) ? -1 : 1;

            crm = levl()[xx][yy + ddy];
            if (crm.typ == btyp || crm.typ == ftyp || crm.typ == SCORR) {
                dy = ddy;
                dx = 0;
                continue;
            }
        }

        /* continue straight on? */
        crm = levl()[xx + dx][yy + dy];
        if (crm.typ == btyp || crm.typ == ftyp || crm.typ == SCORR)
            continue;

        /* no, what must we do now?? */
        if (dx) {
            dx = 0;
            dy = (ty < yy) ? -1 : 1;
        } else {
            dy = 0;
            dx = (tx < xx) ? -1 : 1;
        }
        crm = levl()[xx + dx][yy + dy];
        if (crm.typ == btyp || crm.typ == ftyp || crm.typ == SCORR)
            continue;
        dy = -dy;
        dx = -dx;
    }
    return TRUE;
}

/*
 * Corridors always start from a door. But it can end anywhere...
 * Basically we search for door coordinates or for endpoints coordinates
 * (from a distance).
 */
function create_corridor(c) { /* void */
    const $frame = stack_frame(); try {
    let org = stack_struct(struct_nhcoord), dest = stack_struct(struct_nhcoord);

    if (c.src.room == -1) {
        makecorridors(); /*makecorridors(c->src.door);*/
        return;
    }

    /* Safety railings - if there's ever a case where des.corridor() needs
     * to be called with src/destwall="random", that logic first needs to be
     * implemented in search_door. */
    if (c.src.wall == W_ANY || c.src.wall == W_RANDOM
        || c.dest.wall == W_ANY || c.dest.wall == W_RANDOM) {
        impossible(_("create_corridor to/from a random wall"));
        return;
    }
    if (!search_door(svr.rooms[c.src.room], ref_of(org, "x"), ref_of(org, "y"), c.src.wall,
                     c.src.door))
        return;
    if (c.dest.room != -1) {
        if (!search_door(svr.rooms[c.dest.room],
                         ref_of(dest, "x"), ref_of(dest, "y"), c.dest.wall, c.dest.door))
            return;
        switch (c.src.wall) {
        case W_NORTH:
            org.y--;
            break;
        case W_SOUTH:
            org.y++;
            break;
        case W_WEST:
            org.x--;
            break;
        case W_EAST:
            org.x++;
            break;
        }
        switch (c.dest.wall) {
        case W_NORTH:
            dest.y--;
            break;
        case W_SOUTH:
            dest.y++;
            break;
        case W_WEST:
            dest.x--;
            break;
        case W_EAST:
            dest.x++;
            break;
        }
        dig_corridor(org, dest, null, FALSE, CORR, STONE);
    }
    } finally { stack_pop($frame); }
}

/*
 * Fill a room (shop, zoo, etc...) with appropriate stuff.
 */
export function fill_special_room(croom) { /* void */
    let i;

    if (!croom)
        return;

    /* First recurse into subrooms. We don't want to block an ordinary room
     * with a special subroom from having the subroom filled, or an unfilled
     * outer room preventing a special subroom from being filled. */
    for (i = 0; i < croom.nsubrooms; ++i) {
        fill_special_room(croom.sbrooms[i]);
    }

    if (croom.rtype == OROOM || croom.rtype == THEMEROOM
        || croom.needfill == FILL_NONE)
        return;

    if (croom.needfill == FILL_NORMAL) {
        let x, y;

        /* Shop ? */
        if (croom.rtype >= SHOPBASE) {
            stock_room(croom.rtype - SHOPBASE, croom);
            svl.level.flags.has_shop = TRUE;
            return;
        }

        switch (croom.rtype) {
        case VAULT:
            for (x = croom.lx; x <= croom.hx; x++)
                for (y = croom.ly; y <= croom.hy; y++)
                    mkgold((rn2(abs(depth(u.uz)) * 100) + (51)),
                                  x, y);
            break;
        case COURT:
        case ZOO:
        case BEEHIVE:
        case ANTHOLE:
        case COCKNEST:
        case LEPREHALL:
        case MORGUE:
        case BARRACKS:
            fill_zoo(croom);
            break;
        }
    }
    switch (croom.rtype) {
    case VAULT:
        svl.level.flags.has_vault = TRUE;
        break;
    case ZOO:
        svl.level.flags.has_zoo = TRUE;
        break;
    case COURT:
        svl.level.flags.has_court = TRUE;
        break;
    case MORGUE:
        svl.level.flags.has_morgue = TRUE;
        break;
    case BEEHIVE:
        svl.level.flags.has_beehive = TRUE;
        break;
    case BARRACKS:
        svl.level.flags.has_barracks = TRUE;
        break;
    case TEMPLE:
        svl.level.flags.has_temple = TRUE;
        break;
    case SWAMP:
        svl.level.flags.has_swamp = TRUE;
        break;
    }
}

function build_room(r, mkr) { /* struct mkroom * */
    let okroom;
    let aroom;
    let rtype = (!r.chance || rn2(100) < r.chance) ? r.rtype : OROOM;

    if (mkr) {
        aroom = ptr_add(gs.subrooms, gn.nsubroom);
        okroom = create_subroom(mkr, r.x, r.y, r.w, r.h, rtype, r.rlit);
    } else {
        aroom = svr.rooms[svn.nroom];
        okroom = create_room(r.x, r.y, r.w, r.h, r.xalign, r.yalign,
                             rtype, r.rlit);
    }

    if (okroom) {
        topologize(aroom); /* set roomno */

        aroom.needfill = r.needfill;
        aroom.needjoining = r.joined;
        return aroom;
    }
    return null;
}

/*
 * set lighting in a region that will not become a room.
 */
function light_region(tmpregion) { /* void */
    let litstate = tmpregion.rlit ? 1 : 0;
    let hiy = tmpregion.y2;
    let x, y;
    let lev;
    let lowy = tmpregion.y1;
    let lowx = tmpregion.x1, hix = tmpregion.x2;

    if (litstate) {
        /* adjust region size for walls, but only if lighted */
        lowx = max(lowx - 1, 1);
        hix = min(hix + 1, COLNO - 1);
        lowy = max(lowy - 1, 0);
        hiy = min(hiy + 1, ROWNO - 1);
    }
    for (x = lowx; x <= hix; x++) {
        lev = ptr_add(levl()[x][0], lowy);
        for (y = lowy; y <= hiy; y++) {
            lev.lit = unsigned(IS_LAVA(lev.typ) ? 1 : litstate);
            lev = ptr_add(lev, 1);
        }
    }
}

export function wallify_map(x1, y1, x2, y2) { /* void */
    let x, y, xx, yy, lo_xx, lo_yy, hi_xx, hi_yy;

    y1 = max(y1, 0);
    x1 = max(x1, 1);
    y2 = min(y2, ROWNO - 1);
    x2 = min(x2, COLNO - 1);
    for (y = y1; y <= y2; y++) {
        lo_yy = (y > 0) ? y - 1 : 0;
        hi_yy = (y < y2) ? y + 1 : y2;
        for (x = x1; x <= x2; x++) {
            if (levl()[x][y].typ != STONE)
                continue;
            lo_xx = (x > 1) ? x - 1 : 1;
            hi_xx = (x < x2) ? x + 1 : x2;
            for (yy = lo_yy; yy <= hi_yy; yy++)
                for (xx = lo_xx; xx <= hi_xx; xx++)
                    if (IS_ROOM(levl()[xx][yy].typ)
                        || levl()[xx][yy].typ == CROSSWALL) {
                        levl()[x][y].typ = (yy != y) ? HWALL : VWALL;
                        yy = hi_yy; /* end `yy' loop */
                        break;      /* end `xx' loop */
                    }
        }
    }
}

/*
 * Select a random coordinate in the maze.
 *
 * We want a place not 'touched' by the loader.  That is, a place in
 * the maze outside every part of the special level.
 */
function maze1xy(m, humidity) { /* void */
    let x, y, tryct = 2000;
    /* tryct:  normally it won't take more than ten or so tries due
       to the circumstances under which we'll be called, but the
       `humidity' screening might drastically change the chances */

    do {
        x = rn1(gx.x_maze_max - 3, 3);
        y = rn1(gy.y_maze_max - 3, 3);
        if (--tryct < 0)
            break; /* give up */
    } while (!(x % 2) || !(y % 2) || chars[SpLev_Map[x] + y]
             || !is_ok_location(coordxy(x), coordxy(y), unsigned(humidity)));

    m.x = coordxy(x), m.y = coordxy(y);
}

/*
 * If there's a significant portion of maze unused by the special level,
 * we don't want it empty.
 *
 * Makes the number of traps, monsters, etc. proportional
 * to the size of the maze.
 */
function fill_empty_maze() { /* void */
    const $frame = stack_frame(); try {
    let mapcountmax, mapcount, mapfact;
    let x, y;
    let mm = stack_struct(struct_nhcoord);

    mapcountmax = int(mapcount = (gx.x_maze_max - 2) * (gy.y_maze_max - 2));
    mapcountmax = Math.trunc(mapcountmax / 2);

    for (x = 2; x < gx.x_maze_max; x++)
        for (y = 0; y < gy.y_maze_max; y++)
            if (chars[SpLev_Map[x] + y])
                mapcount--;

    if ((mapcount > Math.trunc(mapcountmax / 10))) {
        mapfact = int(Math.trunc((mapcount * 100) / mapcountmax));
        for (x = rnd(Math.trunc((20 * mapfact) / 100)); x; x--) {
            maze1xy(mm, DRY);
            mkobj_at(rn2(2) ? GEM_CLASS : RANDOM_CLASS, mm.x, mm.y,
                            TRUE);
        }
        for (x = rnd(Math.trunc((12 * mapfact) / 100)); x; x--) {
            let ttmp;

            maze1xy(mm, DRY);
            if ((ttmp = t_at(mm.x, mm.y)) != null
                && (is_pit(ttmp.ttyp) || is_hole(ttmp.ttyp)))
                continue;
            mksobj_at(BOULDER, mm.x, mm.y, TRUE, FALSE);
        }
        for (x = rn2(2); x; x--) {
            maze1xy(mm, DRY);
            makemon(mons[PM_MINOTAUR], mm.x, mm.y, NO_MM_FLAGS);
        }
        for (x = rnd(Math.trunc((12 * mapfact) / 100)); x; x--) {
            maze1xy(mm, DRY);
            makemon(null, mm.x, mm.y, NO_MM_FLAGS);
        }
        for (x = rn2(Math.trunc((15 * mapfact) / 100)); x; x--) {
            maze1xy(mm, DRY);
            mkgold(0, mm.x, mm.y);
        }
        for (x = rn2(Math.trunc((15 * mapfact) / 100)); x; x--) {
            let trytrap;

            maze1xy(mm, DRY);
            trytrap = rndtrap();
            if (sobj_at(BOULDER, mm.x, mm.y))
                while (is_pit(trytrap) || is_hole(trytrap))
                    trytrap = rndtrap();
            maketrap(mm.x, mm.y, trytrap);
        }
    }
    } finally { stack_pop($frame); }
}

function splev_initlev(linit) { /* void */
    switch (linit.init_style) {
    default:
        impossible(_("Unrecognized level init style."));
        break;
    case LVLINIT_NONE:
        break;
    case LVLINIT_SOLIDFILL:
        if (linit.lit == BOOL_RANDOM)
            linit.lit = rn2(2);
        lvlfill_solid(linit.filling, linit.lit);
        break;
    case LVLINIT_MAZEGRID:
        lvlfill_maze_grid(2, 0, gx.x_maze_max, gy.y_maze_max, linit.bg);
        break;
    case LVLINIT_MAZE:
        create_maze(linit.corrwid, linit.wallthick, linit.rm_deadends);
        break;
    case LVLINIT_ROGUE:
        makeroguerooms();
        break;
    case LVLINIT_MINES:
        if (linit.lit == BOOL_RANDOM)
            linit.lit = rn2(2);
        if (linit.filling > -1)
            lvlfill_solid(linit.filling, 0);
        linit.icedpools = icedpools[0];
        mkmap(linit);
        break;
    case LVLINIT_SWAMP:
        if (linit.lit == BOOL_RANDOM)
            linit.lit = rn2(2);
        lvlfill_swamp(linit.fg, linit.bg, linit.lit);
        break;
    }
}

/*ARGUSED*/
function spo_end_moninvent() { /* void */
    if (invent_carrying_monster[0])
        m_dowear(invent_carrying_monster[0], TRUE);
    invent_carrying_monster[0] = null;
}

/*ARGUSED*/
function spo_pop_container() { /* void */
    if (container_idx[0] > 0) {
        container_idx[0]--;
        container_obj[container_idx[0]] = null;
    }
}

/* push a table on lua stack: {width=wid, height=hei} */
function l_push_wid_hei_table(L, wid, hei) { /* void */
    lua_newtable(L);
    nhl_add_table_entry_int(L, _("width"), wid);
    nhl_add_table_entry_int(L, _("height"), hei);
}

/* push a table on lua stack containing room data */
function l_push_mkroom_table(L, tmpr) { /* void */
    lua_newtable(L);
    nhl_add_table_entry_int(L, _("width"), 1 + (tmpr.hx - tmpr.lx));
    nhl_add_table_entry_int(L, _("height"), 1 + (tmpr.hy - tmpr.ly));
    nhl_add_table_entry_region(L, _("region"), tmpr.lx, tmpr.ly,
                               tmpr.hx, tmpr.hy);
    nhl_add_table_entry_bool(L, _("lit"), tmpr.rlit);
    nhl_add_table_entry_bool(L, _("irregular"), tmpr.irregular);
    nhl_add_table_entry_bool(L, _("needjoining"), tmpr.needjoining);
    nhl_add_table_entry_str(L, _("type"), get_mkroom_name(tmpr.rtype));
}

/* message("What a strange feeling!"); */
export function lspo_message(L) { /* int */
    let levmsg;
    let old_n, n;
    let msg;

    let argc = lua_gettop(L);

    if (argc < 1) {
        nhl_error(L, _("Wrong parameters"));
        /*NOTREACHED*/
        return 0;
    }

    create_des_coder();

    msg = luaL_checkstring(L, 1);

    old_n = int(gl.lev_message ? unsigned(Strlen(gl.lev_message) + 1) : 0);
    n = int(Strlen(msg));

    levmsg = addr_of(alloc(unsigned(old_n + n + 1)));
    if (old_n)
        chars[levmsg + (old_n - 1)] = ord('\n');
    if (gl.lev_message)
        memcpy(levmsg, gl.lev_message,
                      unsigned(old_n - 1));
    memcpy((levmsg + old_n), msg, unsigned(n));
    chars[levmsg + (old_n + n)] = ord('\0');
    Free(gl.lev_message);
    gl.lev_message = levmsg;

    return 0;  /* number of results */
}

function get_table_align(L) { /* int */
    let gtaligns = static_array("get_table_align.gtaligns", ptr_to(char), null, [
        _("noalign"), _("law"), _("neutral"), _("chaos"),
        _("coaligned"), _("noncoaligned"), _("random"), 0
    ]);
    let aligns2i = static_array("get_table_align.aligns2i", int, null, [
        AM_NONE, AM_LAWFUL, AM_NEUTRAL, AM_CHAOTIC,
        AM_SPLEV_CO, AM_SPLEV_NONCO, AM_SPLEV_RANDOM, 0
    ]);

    let a = aligns2i[get_table_option(L, _("align"), _("random"), gtaligns)];

    return a;
}

function get_table_monclass(L) { /* int */
    let s = get_table_str_opt(L, _("class"), 0);
    let ret = -1;

    if (s && strlen(s) == 1)
        ret = (chars[s]);
    Free(s);
    return ret;
}

function find_montype(
    L,
    s,
    mgender) { /* int */
    const $frame = stack_frame(); try {
    let i, mgend = stack_var(int, NEUTRAL);

    i = name_to_monplus(s, null, mgend);
    if (i >= LOW_PM && i < NUMMONS) {
        if (is_male(mons[i]) || is_female(mons[i]))
            mgend[0] = is_female(mons[i]) ? FEMALE : MALE;
        else
            mgend[0] = (mgend[0] == FEMALE) ? FEMALE
                        : (mgend[0] == MALE) ? MALE : rn2(2);
        if (mgender)
            mgender[0] = mgend[0];
        return i;
    }
    if (mgender)
        mgender[0] = NEUTRAL;
    return NON_PM;
    } finally { stack_pop($frame); }
}

function get_table_montype(L, mgender) { /* int */
    let s = get_table_str_opt(L, _("id"), 0);
    let ret = NON_PM;

    if (s) {
        ret = find_montype(L, s, mgender);
        Free(s);
        if (ret == NON_PM)
            nhl_error(L, _("Unknown monster id"));
    }
    return ret;
}

/* Get x and y values from a table (which the caller has already checked for
 * the existence of), handling both a table with x= and y= specified and a
 * table with coord= specified.
 * Returns absolute rather than map-relative coordinates; the caller of this
 * function must decide if it wants to interpret the coordinates as
 * map-relative and adjust accordingly. */
function get_table_xy_or_coord(
    L,
    x,
    y) { /* void */
    const $frame = stack_frame(); try {
    let mx = stack_var(lua_Integer, get_table_int_opt(L, _("x"), -1));
    let my = stack_var(lua_Integer, get_table_int_opt(L, _("y"), -1));

    if (mx[0] == -1 && my[0] == -1) {
        lua_getfield(L, 1, _("coord"));
        get_coord(L, -1, mx, my);
        lua_pop(L, 1);
    }

    x[0] = mx[0];
    y[0] = my[0];
    } finally { stack_pop($frame); }
}

/* monster(); */
/* monster("wood nymph"); */
/* monster("D"); */
/* monster("giant eel",11,06); */
/* monster("hill giant", {08,06}); */
/* monster({ id = "giant mimic", appear_as = "obj:boulder" }); */
/* monster({ class = "H", peaceful = 0 }); */
export function lspo_monster(L) { /* int */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);
    let tmpmons = stack_struct(monster);
    let mx = stack_var(lua_Integer, -1), my = stack_var(lua_Integer, -1);
    let mgend = stack_var(int, NEUTRAL);
    let mappear = 0;

    create_des_coder();

    tmpmons.peaceful = -1;
    tmpmons.asleep = -1;
    tmpmons.name.str = 0;
    tmpmons.appear = 0;
    tmpmons.appear_as.str = 0;
    tmpmons.sp_amask = AM_SPLEV_RANDOM;
    tmpmons.female = 0;
    tmpmons.invis = 0;
    tmpmons.cancelled = 0;
    tmpmons.revived = 0;
    tmpmons.avenge = 0;
    tmpmons.fleeing = 0;
    tmpmons.blinded = 0;
    tmpmons.paralyzed = 0;
    tmpmons.stunned = 0;
    tmpmons.confused = 0;
    tmpmons.seentraps = 0;
    tmpmons.has_invent = DEFAULT_INVENT;
    tmpmons.waiting = 0;
    tmpmons.mm_flags = NO_MM_FLAGS;
    tmpmons.m_lev_adj = 0;

    if (argc == 1 && lua_type(L, 1) == LUA_TSTRING) {
        let paramstr = luaL_checkstring(L, 1);

        if (strlen(paramstr) == 1) {
            tmpmons.class = chars[paramstr];
            tmpmons.id = NON_PM;
        } else {
            tmpmons.class = -1;
            tmpmons.id = find_montype(L, paramstr, mgend);
            tmpmons.female = (mgend[0] == FEMALE) ? FEMALE
                                : (mgend[0] == MALE) ? MALE : rn2(2);
        }
    } else if (argc == 2 && lua_type(L, 1) == LUA_TSTRING
               && lua_type(L, 2) == LUA_TTABLE) {
        let paramstr = luaL_checkstring(L, 1);

        get_coord(L, 2, mx, my);

        if (strlen(paramstr) == 1) {
            tmpmons.class = chars[paramstr];
            tmpmons.id = NON_PM;
        } else {
            tmpmons.class = -1;
            tmpmons.id = find_montype(L, paramstr, mgend);
            tmpmons.female = (mgend[0] == FEMALE) ? FEMALE
                                : (mgend[0] == MALE) ? MALE : rn2(2);
        }
    } else if (argc == 3) {
        let paramstr = luaL_checkstring(L, 1);

        mx[0] = luaL_checkinteger(L, 2);
        my[0] = luaL_checkinteger(L, 3);

        if (strlen(paramstr) == 1) {
            tmpmons.class = chars[paramstr];
            tmpmons.id = NON_PM;
        } else {
            tmpmons.class = -1;
            tmpmons.id = find_montype(L, paramstr, mgend);
            tmpmons.female = (mgend[0] == FEMALE) ? FEMALE
                                : (mgend[0] == MALE) ? MALE : rn2(2);
        }
    } else {
        let keep_default_invent = -1; /* -1 = unspecified */
        lcheck_param_table(L);

        tmpmons.peaceful = get_table_boolean_opt(L, _("peaceful"), BOOL_RANDOM);
        tmpmons.asleep = get_table_boolean_opt(L, _("asleep"), BOOL_RANDOM);
        tmpmons.name.str = get_table_str_opt(L, _("name"), 0);
        tmpmons.appear = 0;
        tmpmons.appear_as.str = 0;
        tmpmons.sp_amask = unsigned(get_table_align(L));
        tmpmons.female = get_table_boolean_opt(L, _("female"), BOOL_RANDOM);
        tmpmons.invis = get_table_boolean_opt(L, _("invisible"), FALSE);
        tmpmons.cancelled = get_table_boolean_opt(L, _("cancelled"), FALSE);
        tmpmons.revived = get_table_boolean_opt(L, _("revived"), FALSE);
        tmpmons.avenge = get_table_boolean_opt(L, _("avenge"), FALSE);
        tmpmons.fleeing = get_table_int_opt(L, _("fleeing"), 0);
        tmpmons.blinded = get_table_int_opt(L, _("blinded"), 0);
        tmpmons.paralyzed = get_table_int_opt(L, _("paralyzed"), 0);
        tmpmons.stunned = get_table_boolean_opt(L, _("stunned"), FALSE);
        tmpmons.confused = get_table_boolean_opt(L, _("confused"), FALSE);
        tmpmons.waiting = get_table_boolean_opt(L, _("waiting"), FALSE);
        tmpmons.m_lev_adj = get_table_int_opt(L, _("m_lev_adj"), 0);
        tmpmons.seentraps = 0; /* TODO: list of trap names to bitfield */
        keep_default_invent =
            get_table_boolean_opt(L, _("keep_default_invent"), -1);

        if (!get_table_boolean_opt(L, _("tail"), TRUE))
            tmpmons.mm_flags = or64(tmpmons.mm_flags, MM_NOTAIL);
        if (!get_table_boolean_opt(L, _("group"), TRUE))
            tmpmons.mm_flags = or64(tmpmons.mm_flags, MM_NOGRP);
        if (get_table_boolean_opt(L, _("adjacentok"), FALSE))
            tmpmons.mm_flags = or64(tmpmons.mm_flags, MM_ADJACENTOK);
        if (get_table_boolean_opt(L, _("ignorewater"), FALSE))
            tmpmons.mm_flags = or64(tmpmons.mm_flags, MM_IGNOREWATER);
        if (!get_table_boolean_opt(L, _("countbirth"), TRUE))
            tmpmons.mm_flags = or64(tmpmons.mm_flags, MM_NOCOUNTBIRTH);

        mappear = get_table_str_opt(L, _("appear_as"), 0);
        if (mappear) {
            if (!strncmp(_("obj:"), mappear, 4)) {
                tmpmons.appear = M_AP_OBJECT;
            } else if (!strncmp(_("mon:"), mappear, 4)) {
                tmpmons.appear = M_AP_MONSTER;
            } else if (!strncmp(_("ter:"), mappear, 4)) {
                tmpmons.appear = M_AP_FURNITURE;
            } else {
                nhl_error(L, _("Unknown appear_as type"));
            }
            tmpmons.appear_as.str = dupstr(mappear + 4);
            Free(mappear);
        }

        get_table_xy_or_coord(L, mx, my);

        tmpmons.id = get_table_montype(L, mgend);
        /* get_table_montype will return a random gender if the species isn't
         * all-male or all-female; if the level designer specified a certain
         * gender, override that random one now, unless it *is* a one-gender
         * species, in which case don't override (don't permit creation of a
         * male nymph or female Nazgul, etc.) */
        if (mgend[0] != NEUTRAL
            && (tmpmons.female == BOOL_RANDOM || is_female(mons[tmpmons.id])
                || is_male(mons[tmpmons.id])))
            tmpmons.female = mgend[0];
        /* safety net - if find_montype did not find a gender for this species
         * (should cause a lua error anyway) */
        if (tmpmons.female == BOOL_RANDOM)
            tmpmons.female = 0;

        tmpmons.class = get_table_monclass(L);

        lua_getfield(L, 1, _("inventory"));
        if (!lua_isnil(L, -1)) {
            /* overwrite DEFAULT_INVENT - most times inventory is specified,
             * the monster should not get its species' default inventory. Only
             * provide it if explicitly requested. */
            tmpmons.has_invent = CUSTOM_INVENT;
            if (keep_default_invent == TRUE)
                tmpmons.has_invent |= DEFAULT_INVENT;
        }
        else {
            /* if keep_default_invent was not specified (-1), keep has_invent as
             * DEFAULT_INVENT and provide the species' default inventory.
             * But if it was explicitly set to false, provide *no* inventory. */
            if (keep_default_invent == FALSE)
                tmpmons.has_invent = NO_INVENT;
        }
    }

    if (mx[0] == -1 && my[0] == -1)
        tmpmons.coord = SP_COORD_PACK_RANDOM(0);
    else
        tmpmons.coord = (((mx[0]) & 255) + (shl64(((my[0]) & 255), 16)));

    if (tmpmons.id != NON_PM && tmpmons.class == -1)
        tmpmons.class = monsym(mons[tmpmons.id]);

    create_monster(tmpmons, gc.coder.croom);

    if ((tmpmons.has_invent & CUSTOM_INVENT)
        && lua_type(L, -1) == LUA_TFUNCTION) {
        lua_remove(L, -2);
        nhl_pcall_handle(L, 0, 0, _("lspo_monster"), NHLpa_panic);
        spo_end_moninvent();
    } else
        lua_pop(L, 1);

    Free(tmpmons.name.str);
    Free(tmpmons.appear_as.str);

    return 0;
    } finally { stack_pop($frame); }
}

/* the hash key 'name' is an integer or "random",
   or if not existent, also return rndval */
function get_table_int_or_random(L, name, rndval) { /* lua_Integer */
    const $frame = stack_frame(); try {
    let ret;
    let buf = stack_array(char, BUFSZ);

    lua_getfield(L, 1, name);
    if (lua_type(L, -1) == LUA_TNIL) {
        lua_pop(L, 1);
        return rndval;
    }
    if (!lua_isnumber(L, -1)) {
        let tmp = lua_tostring(L, -1);

        if (tmp && !strncmpi(_(("random")), (tmp), -1)) {
            lua_pop(L, 1);
            return rndval;
        }
        sprintf(buf, _("Expected integer or \"random\" for \"%s\", got "), name);
        if (tmp)
            sprintf(eos(buf), _("\"%s\""), tmp);
        else
            strcat(buf, _("<Null>"));
        nhl_error(L, buf);
        /*NOTREACHED*/
        lua_pop(L, 1);
        return 0;
    }
    ret = luaL_optinteger(L, -1, rndval);
    lua_pop(L, 1);
    return ret;
    } finally { stack_pop($frame); }
}

function get_table_buc(L) { /* int */
    let bucs = static_array("get_table_buc.bucs", ptr_to(char), null, [
        _("random"), _("blessed"), _("uncursed"), _("cursed"),
        _("not-cursed"), _("not-uncursed"), _("not-blessed"), 0,
    ]);
    let bucs2i = static_array("get_table_buc.bucs2i", int, null, [ 0, 1, 2, 3, 4, 5, 6, 0 ]);
    let curse_state = bucs2i[get_table_option(L, _("buc"), _("random"), bucs)];

    return curse_state;
}

export function get_table_objclass(L) { /* int */
    let s = get_table_str_opt(L, _("class"), 0);
    let ret = -1;

    if (s && strlen(s) == 1)
        ret = (chars[s]);
    Free(s);
    return ret;
}

/* find object otyp by text s (optionally considering oclass) */
function find_objtype(L, s, oclass) { /* int */
    if (s && chars[s]) {
        let i;
        let objname;
        let class_ = def_char_to_objclass(oclass);

        /* In objects.h, some item classes are defined without prefixes
           (such as "scroll of ") in their names, making some names (such
           as "teleportation") ambiguous.  Get the object class if it is
           specified, and only return an object of the matching class. */
        const struct_objclasspfx = struct("find_objtype.struct_objclasspfx", {
            prefix: ptr_to(char),
            class: char,
        }); let class_prefixes = static_array("find_objtype.class_prefixes", struct_objclasspfx, null, [
            { prefix: _("ring of "), class: RING_CLASS },
            { prefix: _("potion of "), class: POTION_CLASS },
            { prefix: _("scroll of "), class: SCROLL_CLASS },
            { prefix: _("spellbook of "), class: SPBOOK_CLASS },
            { prefix: _("wand of "), class: WAND_CLASS },
            { prefix: 0, class: 0 }
        ]);

        if (class_ == MAXOCLASSES)
            class_ = 0;

        if (strstri(s, _(" of "))) {
            for (i = 0; class_prefixes[i].prefix; i++) {
                let p = class_prefixes[i].prefix;

                if (!strncmpi(s, p, int(strlen(p)))) {
                    class_ = class_prefixes[i].class;
                    s = s + strlen(p);
                    break;
                }
            }
        }

        /* find by object name */
        for (i = 0; i < NUM_OBJECTS; i++) {
            objname = OBJ_NAME(objects[i]);
            if ((!class_ || class_ == objects[i].oc_class)
                && objname && !strcmpi(s, objname))
                return i;
        }

        /*
         * FIXME:
         *  If the file specifies "orange potion", the actual object
         *  description is just "orange" and won't match.  [There's a
         *  reason that wish handling is insanely complicated.]  And
         *  even if that gets fixed, if the file specifies "gray stone"
         *  it will start matching but would always pick the first one.
         *
         *  "orange potion" is an unlikely thing to have in a special
         *  level description but "gray stone" is not....
         */

        /* find by object description */
        for (i = 0; i < NUM_OBJECTS; i++) {
            objname = OBJ_DESCR(objects[i]);
            if (objname && !strcmpi(s, objname))
                return i;
        }

        nhl_error(L, _("Unknown object id"));
    }
    return STRANGE_OBJECT;
}

export function get_table_objtype(L) { /* int */
    let s = get_table_str_opt(L, _("id"), 0);
    let oclass = get_table_objclass(L);
    let ret = find_objtype(L, s, oclass);

    Free(s);
    return ret;
}

/* object(); */
/* object("sack"); */
/* object("scimitar", 6,7); */
/* object("scimitar", {6,7}); */
/* object({ class = "%" }); */
/* object({ id = "boulder", x = 03, y = 12}); */
/* object({ id = "boulder", coord = {03,12} }); */
export function lspo_object(L) { /* int */
    const $frame = stack_frame(); try {
    let zeroobject = static_struct("lspo_object.zeroobject", object, {
            name: { str: 0 },   /* Str_or_len name */
            corpsenm: 0,       /* corpsenm */
            id: 0, spe: 0,    /* id, spe */
            coord: 0,       /* coord */
            x: 0, y: 0,    /* coordxy x,y */
            class: 0, containment: 0,    /* class, containment */
            curse_state: 0,       /* curse_state */
            quan: 0,       /* quan */
            buried: 0,       /* buried */
            lit: 0,       /* lit */
            eroded: 0, locked: 0, trapped: 0, tknown: 0, recharged: 0, /* eroded, locked, trapped, tknown, recharged */
            invis: 0, greased: 0, broken: 0, achievement: 0, /* invis, greased, broken, achievement */
    });

    let quancnt;
    let tmpobj = stack_struct(object);
    let ox = stack_var(lua_Integer, -1), oy = stack_var(lua_Integer, -1);
    let argc = lua_gettop(L);
    let maybe_contents = 0;
    let otmp = null;

    create_des_coder();

    struct_assign(tmpobj, zeroobject);
    tmpobj.name.str = 0;
    tmpobj.spe = -127;
    tmpobj.quan = -1;
    tmpobj.trapped = -1;
    tmpobj.tknown = -1;
    tmpobj.locked = -1;
    tmpobj.corpsenm = NON_PM;

    if (argc == 1 && lua_type(L, 1) == LUA_TSTRING) {
        let paramstr = luaL_checkstring(L, 1);

        if (strlen(paramstr) == 1) {
            tmpobj.class = chars[paramstr];
            tmpobj.id = STRANGE_OBJECT;
        } else {
            tmpobj.class = -1;
            tmpobj.id = find_objtype(L, paramstr, -1);
        }
    } else if (argc == 2 && lua_type(L, 1) == LUA_TSTRING
               && lua_type(L, 2) == LUA_TTABLE) {
        let paramstr = luaL_checkstring(L, 1);

        get_coord(L, 2, ox, oy);

        if (strlen(paramstr) == 1) {
            tmpobj.class = chars[paramstr];
            tmpobj.id = STRANGE_OBJECT;
        } else {
            tmpobj.class = -1;
            tmpobj.id = find_objtype(L, paramstr, -1);
        }
    } else if (argc == 3 && lua_type(L, 2) == LUA_TNUMBER
               && lua_type(L, 3) == LUA_TNUMBER) {
        let paramstr = luaL_checkstring(L, 1);

        ox[0] = luaL_checkinteger(L, 2);
        oy[0] = luaL_checkinteger(L, 3);

        if (strlen(paramstr) == 1) {
            tmpobj.class = chars[paramstr];
            tmpobj.id = STRANGE_OBJECT;
        } else {
            tmpobj.class = -1;
            tmpobj.id = find_objtype(L, paramstr, -1);
        }
    } else {
        lcheck_param_table(L);

        tmpobj.spe = get_table_int_or_random(L, _("spe"), -127);
        tmpobj.curse_state = get_table_buc(L);
        tmpobj.corpsenm = NON_PM;
        tmpobj.name.str = get_table_str_opt(L, _("name"), 0);
        tmpobj.quan = get_table_int_or_random(L, _("quantity"), -1);
        tmpobj.buried = get_table_boolean_opt(L, _("buried"), 0);
        tmpobj.lit = get_table_boolean_opt(L, _("lit"), 0);
        tmpobj.eroded = get_table_int_opt(L, _("eroded"), 0);
        tmpobj.locked = get_table_boolean_opt(L, _("locked"), -1);
        tmpobj.trapped = get_table_boolean_opt(L, _("trapped"), -1);
        tmpobj.tknown = get_table_boolean_opt(L, _("trap_known"), -1);
        tmpobj.recharged = get_table_int_opt(L, _("recharged"), 0);
        tmpobj.greased = get_table_boolean_opt(L, _("greased"), 0);
        tmpobj.broken = get_table_boolean_opt(L, _("broken"), 0);
        tmpobj.achievement = get_table_boolean_opt(L, _("achievement"), 0);

        get_table_xy_or_coord(L, ox, oy);

        tmpobj.id = get_table_objtype(L);
        tmpobj.class = get_table_objclass(L);
        maybe_contents = 1;
    }

    if (ox[0] == -1 && oy[0] == -1)
        tmpobj.coord = SP_COORD_PACK_RANDOM(0);
    else
        tmpobj.coord = (((ox[0]) & 255) + (shl64(((oy[0]) & 255), 16)));

    if (tmpobj.class == -1 && tmpobj.id > STRANGE_OBJECT)
        tmpobj.class = objects[tmpobj.id].oc_class;
    else if (tmpobj.class > -1 && tmpobj.id == STRANGE_OBJECT)
        tmpobj.id = -1;

    if (tmpobj.id == STATUE || tmpobj.id == EGG
        || tmpobj.id == CORPSE || tmpobj.id == TIN
        || tmpobj.id == FIGURINE) {
        let pm = null;
        let nonpmobj = FALSE;
        let i;
        let montype = get_table_str_opt(L, _("montype"), 0);

        if (montype) {
            if ((tmpobj.id == TIN && (!strncmpi((montype), _(("spinach")), -1)
                /* id="tin",montype="empty" produces an empty tin */
                                      || !strncmpi((montype), _(("empty")), -1)))
                /* id="egg",montype="empty" produces a generic, unhatchable
                   egg rather than an "empty egg" */
                || (tmpobj.id == EGG && !strncmpi((montype), _(("empty")), -1))) {
                tmpobj.corpsenm = NON_PM;
                tmpobj.spe = !strncmpi((montype), _(("spinach")), -1) ? 1 : 0;
                nonpmobj = TRUE;
            } else if (strlen(montype) == 1
                       && def_char_to_monclass(chars[montype]) != MAXMCLASSES) {
                pm = mkclass(def_char_to_monclass(chars[montype]),
                             G_NOGEN | G_IGNORE);
            } else {
                for (i = LOW_PM; i < NUMMONS; i++)
                    if (!strcmpi(mons[i].pmnames[NEUTRAL], montype)
                        || (mons[i].pmnames[MALE] != 0
                            && !strcmpi(mons[i].pmnames[MALE], montype))
                        || (mons[i].pmnames[FEMALE] != 0
                            && !strcmpi(mons[i].pmnames[FEMALE], montype))) {
                        pm = mons[i];
                        break;
                    }
            }
            free(montype);
            if (pm)
                tmpobj.corpsenm = monsndx(pm);
            else if (!nonpmobj)
                nhl_error(L, _("Unknown montype"));
        }
        if (tmpobj.id == STATUE || tmpobj.id == CORPSE) {
            let lflags = 0;

            if (get_table_boolean_opt(L, _("historic"), 0))
                lflags |= CORPSTAT_HISTORIC;
            if (get_table_boolean_opt(L, _("male"), 0))
                lflags |= CORPSTAT_MALE;
            if (get_table_boolean_opt(L, _("female"), 0))
                lflags |= CORPSTAT_FEMALE;
            tmpobj.spe = lflags;
        } else if (tmpobj.id == EGG) {
            tmpobj.spe = get_table_boolean_opt(L, _("laid_by_you"), 0) ? 1 : 0;
        } else if (!nonpmobj) { /* tmpobj.spe is already set for nonpmobj */
            tmpobj.spe = 0;
        }
    }

    quancnt = (tmpobj.id > STRANGE_OBJECT) ? tmpobj.quan : 0;

    if (container_idx[0])
        tmpobj.containment |= SP_OBJ_CONTENT;

    if (maybe_contents) {
        lua_getfield(L, 1, _("contents"));
        if (!lua_isnil(L, -1))
            tmpobj.containment |= SP_OBJ_CONTAINER;
    }

    do {
        otmp = create_object(tmpobj, gc.coder.croom);
        quancnt--;
    } while ((quancnt > 0) && ((tmpobj.id > STRANGE_OBJECT)
                               && !objects[tmpobj.id].oc_merge));

    if (lua_type(L, -1) == LUA_TFUNCTION) {
        lua_remove(L, -2);
        nhl_push_obj(L, otmp);
        nhl_pcall_handle(L, 1, 0, _("lspo_object"), NHLpa_panic);
    } else
        lua_pop(L, 1);

    if ((tmpobj.containment & SP_OBJ_CONTAINER) != 0)
        spo_pop_container();

    Free(tmpobj.name.str);

    nhl_push_obj(L, otmp);

    return 1;
    } finally { stack_pop($frame); }
}

/* level_flags("noteleport", "mazelevel", ... ); */
export function lspo_level_flags(L) { /* int */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);
    let i;

    create_des_coder();

    if (argc < 1)
        nhl_error(L, _("expected string params"));

    for (i = 1; i <= argc; i++) {
        let s = luaL_checkstring(L, i);

        if (!strncmpi((s), _(("noteleport")), -1))
            svl.level.flags.noteleport = 1;
        else if (!strncmpi((s), _(("hardfloor")), -1))
            svl.level.flags.hardfloor = 1;
        else if (!strncmpi((s), _(("nommap")), -1))
            svl.level.flags.nommap = 1;
        else if (!strncmpi((s), _(("shortsighted")), -1))
            svl.level.flags.shortsighted = 1;
        else if (!strncmpi((s), _(("arboreal")), -1))
            svl.level.flags.arboreal = 1;
        else if (!strncmpi((s), _(("mazelevel")), -1))
            svl.level.flags.is_maze_lev = 1;
        else if (!strncmpi((s), _(("shroud")), -1))
            svl.level.flags.hero_memory = 1;
        else if (!strncmpi((s), _(("graveyard")), -1))
            svl.level.flags.graveyard = 1;
        else if (!strncmpi((s), _(("icedpools")), -1))
            icedpools[0] = 1;
        else if (!strncmpi((s), _(("corrmaze")), -1))
            svl.level.flags.corrmaze = 1;
        else if (!strncmpi((s), _(("premapped")), -1))
            gc.coder.premapped = 1;
        else if (!strncmpi((s), _(("solidify")), -1))
            gc.coder.solidify = 1;
        else if (!strncmpi((s), _(("sokoban")), -1))
            svl.level.flags.sokoban_rules = 1; /* svl.level.flags.sokoban_rules */
        else if (!strncmpi((s), _(("inaccessibles")), -1))
            gc.coder.check_inaccessibles = 1;
        else if (!strncmpi((s), _(("noflipx")), -1))
            gc.coder.allow_flips &= ~2;
        else if (!strncmpi((s), _(("noflipy")), -1))
            gc.coder.allow_flips &= ~1;
        else if (!strncmpi((s), _(("noflip")), -1))
            gc.coder.allow_flips = 0;
        else if (!strncmpi((s), _(("temperate")), -1))
            svl.level.flags.temperature = 0;
        else if (!strncmpi((s), _(("hot")), -1))
            svl.level.flags.temperature = 1;
        else if (!strncmpi((s), _(("cold")), -1))
            svl.level.flags.temperature = -1;
        else if (!strncmpi((s), _(("nomongen")), -1))
            svl.level.flags.rndmongen = 0;
        else if (!strncmpi((s), _(("nodeathdrops")), -1))
            svl.level.flags.deathdrops = 0;
        else if (!strncmpi((s), _(("noautosearch")), -1))
            svl.level.flags.noautosearch = 1;
        else if (!strncmpi((s), _(("fumaroles")), -1))
            svl.level.flags.fumaroles = 1;
        else if (!strncmpi((s), _(("stormy")), -1))
            svl.level.flags.stormy = 1;
        else {
            let buf = stack_array(char, BUFSZ);

            sprintf(buf, _("Unknown level flag %s"), s);
            nhl_error(L, buf);
        }
    }

    return 0;
    } finally { stack_pop($frame); }
}

/* level_init({ style = "solidfill", fg = " " }); */
/* level_init({ style = "mines", fg = ".", bg = "}",
                smoothed=true, joined=true, lit=0 }) */
export function lspo_level_init(L) { /* int */
    const $frame = stack_frame(); try {
    let initstyles = static_array("lspo_level_init.initstyles", ptr_to(char), null, [
        _("solidfill"), _("mazegrid"), _("maze"), _("rogue"), _("mines"), _("swamp"), 0
    ]);
    let initstyles2i = static_array("lspo_level_init.initstyles2i", int, null, [
        LVLINIT_SOLIDFILL, LVLINIT_MAZEGRID, LVLINIT_MAZE, LVLINIT_ROGUE,
        LVLINIT_MINES, LVLINIT_SWAMP, 0
    ]);
    let init_lev = stack_struct(lev_init);

    create_des_coder();

    lcheck_param_table(L);

    splev_init_present[0] = TRUE;

    init_lev.init_style
        = initstyles2i[get_table_option(L, _("style"), _("solidfill"), initstyles)];
    init_lev.fg = get_table_mapchr_opt(L, _("fg"), ROOM);
    init_lev.bg = get_table_mapchr_opt(L, _("bg"), INVALID_TYPE);
    init_lev.smoothed = get_table_boolean_opt(L, _("smoothed"), FALSE);
    init_lev.joined = get_table_boolean_opt(L, _("joined"), FALSE);
    init_lev.lit = get_table_boolean_opt(L, _("lit"), BOOL_RANDOM);
    init_lev.walled = get_table_boolean_opt(L, _("walled"), FALSE);
    init_lev.filling = get_table_mapchr_opt(L, _("filling"), init_lev.fg);
    init_lev.corrwid = get_table_int_opt(L, _("corrwid"), -1);
    init_lev.wallthick = get_table_int_opt(L, _("wallthick"), -1);
    init_lev.rm_deadends = +!get_table_boolean_opt(L, _("deadends"), TRUE);

    gc.coder.lvl_is_joined = init_lev.joined;

    if (init_lev.bg == INVALID_TYPE)
        init_lev.bg = (init_lev.init_style == LVLINIT_SWAMP) ? MOAT : STONE;

    splev_initlev(init_lev);

    return 0;
    } finally { stack_pop($frame); }
}

/* engraving({ x = 1, y = 1, type="burn", text="Foo" }); */
/* engraving({ coord={1, 1}, type="burn", text="Foo" }); */
/* engraving({x,y}, "engrave", "Foo"); */
export function lspo_engraving(L) { /* int */
    const $frame = stack_frame(); try {
    let engrtypes = static_array("lspo_engraving.engrtypes", ptr_to(char), null, [
        _("dust"), _("engrave"), _("burn"), _("mark"), _("blood"), 0
    ]);
    let engrtypes2i = static_array("lspo_engraving.engrtypes2i", int, null, [
        DUST, ENGRAVE, BURN, MARK, ENGR_BLOOD, 0
    ]);
    let etyp = DUST;
    let txt = 0;
    let ecoord;
    let x = stack_var(coordxy, -1), y = stack_var(coordxy, -1);
    let argc = lua_gettop(L);
    let guardobjs = FALSE;
    let wipeout = TRUE;
    let ep;

    create_des_coder();

    if (argc == 1) {
        let ex = stack_var(lua_Integer), ey = stack_var(lua_Integer);
        lcheck_param_table(L);

        get_table_xy_or_coord(L, ex, ey);
        x[0] = ex[0];
        y[0] = ey[0];
        etyp = engrtypes2i[get_table_option(L, _("type"), _("engrave"), engrtypes)];
        txt = get_table_str(L, _("text"));
        wipeout = get_table_boolean_opt(L, _("degrade"), TRUE);
        guardobjs = get_table_boolean_opt(L, _("guardobjects"), FALSE);
    } else if (argc == 3) {
        let ex = stack_var(lua_Integer), ey = stack_var(lua_Integer);
        get_coord(L, 1, ex, ey);
        x[0] = ex[0];
        y[0] = ey[0];
        etyp = engrtypes2i[luaL_checkoption(L, 2, _("engrave"), engrtypes)];
        txt = dupstr(luaL_checkstring(L, 3));
    } else {
        nhl_error(L, _("Wrong parameters"));
    }

    if (x[0] == -1 && y[0] == -1)
        ecoord = SP_COORD_PACK_RANDOM(0);
    else
        ecoord = SP_COORD_PACK(x[0], y[0]);

    get_location_coord(x, y, DRY, gc.coder.croom, ecoord);
    make_engr_at(x[0], y[0], txt, 0, 0, etyp);
    Free(txt);
    ep = engr_at(x[0], y[0]);
    if (ep) {
        ep.guardobjects = unsigned(guardobjs);
        ep.nowipeout = +!wipeout;
    }
    return 0;
    } finally { stack_pop($frame); }
}

export function lspo_mineralize(L) { /* int */
    let gem_prob, gold_prob, kelp_moat, kelp_pool;

    create_des_coder();

    lcheck_param_table(L);
    /* -1 produces default mineralize behavior */
    gem_prob = get_table_int_opt(L, _("gem_prob"), -1);
    gold_prob = get_table_int_opt(L, _("gold_prob"), -1);
    kelp_moat = get_table_int_opt(L, _("kelp_moat"), -1);
    kelp_pool = get_table_int_opt(L, _("kelp_pool"), -1);

    mineralize(kelp_pool, kelp_moat, gold_prob, gem_prob, TRUE);

    return 0;
}

  const struct___anon4 = struct("sp_lev.struct___anon4", {
    name: ptr_to(char),
    type: int,
}); const room_types = static_array("room_types", struct___anon4, null, [
    { name: _("ordinary"), type: OROOM },
    { name: _("themed"), type: THEMEROOM },
    { name: _("throne"), type: COURT },
    { name: _("swamp"), type: SWAMP },
    { name: _("vault"), type: VAULT },
    { name: _("beehive"), type: BEEHIVE },
    { name: _("morgue"), type: MORGUE },
    { name: _("barracks"), type: BARRACKS },
    { name: _("zoo"), type: ZOO },
    { name: _("delphi"), type: DELPHI },
    { name: _("temple"), type: TEMPLE },
    { name: _("anthole"), type: ANTHOLE },
    { name: _("cocknest"), type: COCKNEST },
    { name: _("leprehall"), type: LEPREHALL },
    { name: _("shop"), type: SHOPBASE },
    { name: _("armor shop"), type: ARMORSHOP },
    { name: _("scroll shop"), type: SCROLLSHOP },
    { name: _("potion shop"), type: POTIONSHOP },
    { name: _("weapon shop"), type: WEAPONSHOP },
    { name: _("food shop"), type: FOODSHOP },
    { name: _("ring shop"), type: RINGSHOP },
    { name: _("wand shop"), type: WANDSHOP },
    { name: _("tool shop"), type: TOOLSHOP },
    { name: _("book shop"), type: BOOKSHOP },
    { name: _("health food shop"), type: FODDERSHOP },
    { name: _("candle shop"), type: CANDLESHOP },
    { name: 0, type: 0 }
]);

function get_mkroom_name(rtype) { /* const char * */
    let i;

    for (i = 0; room_types[i].name; i++)
        if (room_types[i].type == rtype)
            return room_types[i].name;

    impossible(_("get_mkroom_name unknown rtype %d"), rtype);
    return _("unknown"); /* not NULL */
}

function get_table_roomtype_opt(L, name, defval) { /* int */
    let roomstr = get_table_str_opt(L, name, emptystr);
    let i, res = defval;

    if (roomstr && chars[roomstr]) {
        for (i = 0; room_types[i].name; i++)
            if (!strcmpi(roomstr, room_types[i].name)) {
                res = room_types[i].type;
                break;
            }
        if (!room_types[i].name)
            impossible(_("Unknown room type '%s'"), roomstr);
    }
    Free(roomstr);
    return res;
}

/* room({ type="ordinary", lit=1, x=3,y=3, xalign="center",yalign="center",
 *        w=11,h=9 }); */
/* room({ lit=1, coord={3,3}, xalign="center",yalign="center", w=11,h=9 }); */
/* room({ coord={3,3}, xalign="center",yalign="center", w=11,h=9,
 *        contents=function(room) ... end }); */
export function lspo_room(L) { /* int */
    const $frame = stack_frame(); try {
    create_des_coder();

    if (gi.in_mk_themerooms && gt.themeroom_failed)
        return 0;

    lcheck_param_table(L);

    if (gc.coder.n_subroom > MAX_NESTED_ROOMS) {
        panic(_("Too deeply nested rooms?!"));
    } else {
        let left_or_right = static_array("lspo_room.left_or_right", ptr_to(char), null, [
            _("left"), _("half-left"), _("center"), _("half-right"), _("right"),
            _("none"), _("random"), 0
        ]);
        let l_or_r2i = static_array("lspo_room.l_or_r2i", int, null, [
            SPLEV_LEFT, SPLEV_H_LEFT, SPLEV_CENTER, SPLEV_H_RIGHT,
            SPLEV_RIGHT, -1, -1, -1
        ]);
        let top_or_bot = static_array("lspo_room.top_or_bot", ptr_to(char), null, [
            _("top"), _("center"), _("bottom"), _("none"), _("random"), 0
        ]);
        let t_or_b2i = static_array("lspo_room.t_or_b2i", int, null, [ TOP, SPLEV_CENTER, BOTTOM,
                                        -1, -1, -1 ]);
        let tmproom = stack_struct(struct__room);
        let tmpcr;
        let rx = stack_var(lua_Integer), ry = stack_var(lua_Integer);

        get_table_xy_or_coord(L, rx, ry);
        tmproom.x = rx[0], tmproom.y = ry[0];
        if ((tmproom.x == -1 || tmproom.y == -1) && tmproom.x != tmproom.y)
            nhl_error(L, _("Room must have both x and y"));

        tmproom.w = get_table_int_opt(L, _("w"), -1);
        tmproom.h = get_table_int_opt(L, _("h"), -1);

        if ((tmproom.w == -1 || tmproom.h == -1) && tmproom.w != tmproom.h)
            nhl_error(L, _("Room must have both w and h"));

        tmproom.xalign = l_or_r2i[get_table_option(L, _("xalign"), _("random"),
                                                   left_or_right)];
        tmproom.yalign = t_or_b2i[get_table_option(L, _("yalign"), _("random"),
                                                   top_or_bot)];
        tmproom.rtype = get_table_roomtype_opt(L, _("type"), OROOM);
        tmproom.chance = get_table_int_opt(L, _("chance"), 100);
        tmproom.rlit = get_table_int_opt(L, _("lit"), -1);
        /* theme rooms default to unfilled */
        tmproom.needfill = get_table_int_opt(L, _("filled"),
                                             gi.in_mk_themerooms ? 0 : 1);
        tmproom.joined = get_table_boolean_opt(L, _("joined"), TRUE);

        if (!chars[gc.coder.failed_room + (gc.coder.n_subroom - 1)]) {
            tmpcr = build_room(tmproom, gc.coder.croom);
            if (tmpcr) {
                let n = gc.coder.n_subroom;

                gc.coder.tmproomlist[n] = tmpcr; /* TRUE to get here... */
                chars[gc.coder.failed_room + n] = FALSE;
                /* added a subroom, make parent room irregular */
                if (gc.coder.tmproomlist[n - 1])
                    gc.coder.tmproomlist[n - 1].irregular = TRUE;
                gc.coder.n_subroom++;
                update_croom();
                lua_getfield(L, 1, _("contents"));
                if (lua_type(L, -1) == LUA_TFUNCTION) {
                    lua_remove(L, -2);
                    l_push_mkroom_table(L, tmpcr);
                    nhl_pcall_handle(L, 1, 0, _("lspo_room"), NHLpa_panic);
                } else
                    lua_pop(L, 1);
                spo_endroom(gc.coder);
                add_doors_to_room(tmpcr);
                return 0;
            }
            if (gi.in_mk_themerooms)
                gt.themeroom_failed = TRUE;
        } /* failed to create parent room, so fail this too */
    }
    gc.coder.tmproomlist[gc.coder.n_subroom] = null;
    chars[gc.coder.failed_room + gc.coder.n_subroom] = TRUE;
    gc.coder.n_subroom++;
    update_croom();
    spo_endroom(gc.coder);
    if (gi.in_mk_themerooms)
        gt.themeroom_failed = TRUE;

    return 0;
    } finally { stack_pop($frame); }
}

function spo_endroom(coder) { /* void */
    if (gc.coder.n_subroom > 1) {
        gc.coder.n_subroom--;
        gc.coder.tmproomlist[gc.coder.n_subroom] = null;
        chars[gc.coder.failed_room + gc.coder.n_subroom] = TRUE;
    } else {
        /* no subroom, get out of top-level room */
        /* Need to ensure xstart/ystart/xsize/ysize have something sensible,
           in case there's some stuff to be created outside the outermost
           room, and there's no MAP. */
        if (gx.xsize <= 1 && gy.ysize <= 1)
            reset_xystart_size();
    }
    update_croom();
}

/* callback for is_ok_location.
   stairs generated at random location shouldn't overwrite special terrain */
function good_stair_loc(x, y) { /* boolean */
    let typ = levl()[x][y].typ;

    return +(typ == ROOM || typ == CORR || typ == ICE);
}

function l_create_stairway(L, using_ladder) { /* int */
    const $frame = stack_frame(); try {
    let stairdirs = static_array("l_create_stairway.stairdirs", ptr_to(char), null, [ _("down"), _("up"), 0 ]);
    let stairdirs2i = static_array("l_create_stairway.stairdirs2i", int, null, [ 0, 1 ]);
    let argc = lua_gettop(L);
    let x = stack_var(coordxy, -1), y = stack_var(coordxy, -1);
    let badtrap;

    let scoord;
    let up = 0; /* default is down */
    let ltype = lua_type(L, 1);

    create_des_coder();

    if (argc == 1 && ltype == LUA_TTABLE) {
        let ax = stack_var(lua_Integer, -1), ay = stack_var(lua_Integer, -1);
        lcheck_param_table(L);
        get_table_xy_or_coord(L, ax, ay);
        up = stairdirs2i[get_table_option(L, _("dir"), _("down"), stairdirs)];
        x[0] = coordxy((ax[0]));
        y[0] = coordxy((ay[0]));
    } else {
        let ix = stack_var(lua_Integer, -1), iy = stack_var(lua_Integer, -1);
        if (argc > 0 && ltype == LUA_TSTRING) {
            up = stairdirs2i[luaL_checkoption(L, 1, _("down"), stairdirs)];
            lua_remove(L, 1);
        }
        nhl_get_xy_params(L, ix, iy);
        x[0] = coordxy((ix[0]));
        y[0] = coordxy((iy[0]));
    }

    if (x[0] == -1 && y[0] == -1) {
        set_ok_location_func(good_stair_loc);
        scoord = SP_COORD_PACK_RANDOM(0);
    } else
        scoord = SP_COORD_PACK(x[0], y[0]);

    get_location_coord(x, y, DRY, gc.coder.croom, scoord);
    set_ok_location_func(null);
    if ((badtrap = t_at(x[0], y[0])) != null)
        deltrap(badtrap);
    chars[SpLev_Map[x[0]] + (y[0])] = 1;

    if (using_ladder) {
        levl()[x[0]][y[0]].typ = LADDER;
        if (up) {
            let dest = stack_struct(struct_d_level);

            dest.dnum = u.uz.dnum;
            dest.dlevel = u.uz.dlevel - 1;
            stairway_add(x[0], y[0], TRUE, TRUE, dest);
            levl()[x[0]][y[0]].flags = LA_UP;
        } else {
            let dest = stack_struct(struct_d_level);

            dest.dnum = u.uz.dnum;
            dest.dlevel = u.uz.dlevel + 1;
            stairway_add(x[0], y[0], FALSE, TRUE, dest);
            levl()[x[0]][y[0]].flags = LA_DOWN;
        }
    } else {
        mkstairs(x[0], y[0], char(up), gc.coder.croom,
                 +!(scoord & SP_COORD_IS_RANDOM));
    }
    return 0;
    } finally { stack_pop($frame); }
}

/* stair("up"); */
/* stair({ dir = "down" }); */
/* stair({ dir = "down", x = 4, y = 7 }); */
/* stair({ dir = "down", coord = {x,y} }); */
/* stair("down", 4, 7); */
/* TODO: stair(selection, "down"); */
/* TODO: stair("up", {x,y}); */
export function lspo_stair(L) { /* int */
    return l_create_stairway(L, FALSE);
}

/* ladder("down"); */
/* ladder("up", 6,10); */
/* ladder({ x=11, y=05, dir="down" }); */
export function lspo_ladder(L) { /* int */
    return l_create_stairway(L, TRUE);
}

/* grave(); */
/* grave(x,y, "text"); */
/* grave({ x = 1, y = 1 }); */
/* grave({ x = 1, y = 1, text = "Foo" }); */
/* grave({ coord = {1, 1}, text = "Foo" }); */
export function lspo_grave(L) { /* int */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);
    let x = stack_var(coordxy), y = stack_var(coordxy);
    let scoord;
    let ax = stack_var(lua_Integer), ay = stack_var(lua_Integer);
    let txt;

    create_des_coder();

    if (argc == 3) {
        x[0] = ax[0] = luaL_checkinteger(L, 1);
        y[0] = ay[0] = luaL_checkinteger(L, 2);
        txt = dupstr(luaL_checkstring(L, 3));
    } else {
        lcheck_param_table(L);

        get_table_xy_or_coord(L, ax, ay);
        x[0] = ax[0], y[0] = ay[0];
        txt = get_table_str_opt(L, _("text"), 0);
    }

    if (x[0] == -1 && y[0] == -1)
        scoord = SP_COORD_PACK_RANDOM(0);
    else
        scoord = (((ax[0]) & 255) + (shl64(((ay[0]) & 255), 16)));

    get_location_coord(x, y, DRY, gc.coder.croom, scoord);

    if (isok(x[0], y[0]) && !t_at(x[0], y[0])) {
        levl()[x[0]][y[0]].typ = GRAVE;
        make_grave(x[0], y[0], txt); /* note: 'txt' might be Null */
    }
    Free(txt);
    return 0;
    } finally { stack_pop($frame); }
}

/* altar({ x=NN, y=NN, align=ALIGNMENT, type=SHRINE }); */
/* des.altar({ coord = {5, 10}, align="noalign", type="altar" }); */
export function lspo_altar(L) { /* int */
    const $frame = stack_frame(); try {
    let shrines = static_array("lspo_altar.shrines", ptr_to(char), null, [
        _("altar"), _("shrine"), _("sanctum"), 0
    ]);
    let shrines2i = static_array("lspo_altar.shrines2i", int, null, [ 0, 1, 2, 0 ]);

    let tmpaltar = stack_struct(altar);

    let x = stack_var(lua_Integer), y = stack_var(lua_Integer);
    let acoord;
    let shrine;
    let al;

    create_des_coder();

    lcheck_param_table(L);

    get_table_xy_or_coord(L, x, y);

    al = get_table_align(L);
    shrine = shrines2i[get_table_option(L, _("type"), _("altar"), shrines)];

    if (x[0] == -1 && y[0] == -1)
        acoord = SP_COORD_PACK_RANDOM(0);
    else
        acoord = (((x[0]) & 255) + (shl64(((y[0]) & 255), 16)));

    tmpaltar.coord = acoord;
    tmpaltar.sp_amask = unsigned(al);
    tmpaltar.shrine = shrine;

    create_altar(tmpaltar, gc.coder.croom);

    return 0;
    } finally { stack_pop($frame); }
}

  const struct___anon5 = struct("sp_lev.struct___anon5", {
    name: ptr_to(char),
    type: int,
}); const trap_types = static_array("trap_types", struct___anon5, null, [ { name: _("arrow"), type: ARROW_TRAP },
                   { name: _("dart"), type: DART_TRAP },
                   { name: _("falling rock"), type: ROCKTRAP },
                   { name: _("board"), type: SQKY_BOARD },
                   { name: _("bear"), type: BEAR_TRAP },
                   { name: _("land mine"), type: LANDMINE },
                   { name: _("rolling boulder"), type: ROLLING_BOULDER_TRAP },
                   { name: _("sleep gas"), type: SLP_GAS_TRAP },
                   { name: _("rust"), type: RUST_TRAP },
                   { name: _("fire"), type: FIRE_TRAP },
                   { name: _("pit"), type: PIT },
                   { name: _("spiked pit"), type: SPIKED_PIT },
                   { name: _("hole"), type: HOLE },
                   { name: _("trap door"), type: TRAPDOOR },
                   { name: _("teleport"), type: TELEP_TRAP },
                   { name: _("level teleport"), type: LEVEL_TELEP },
                   { name: _("magic portal"), type: MAGIC_PORTAL },
                   { name: _("web"), type: WEB },
                   { name: _("statue"), type: STATUE_TRAP },
                   { name: _("magic"), type: MAGIC_TRAP },
                   { name: _("anti magic"), type: ANTI_MAGIC },
                   { name: _("polymorph"), type: POLY_TRAP },
                   { name: _("vibrating square"), type: VIBRATING_SQUARE },
                   { name: _("random"), type: -1 },
                   { name: 0, type: NO_TRAP } ]);

function get_table_traptype_opt(L, name, defval) { /* int */
    let trapstr = get_table_str_opt(L, name, emptystr);
    let i, res = defval;

    if (trapstr && chars[trapstr]) {
        for (i = 0; trap_types[i].name; i++)
            if (!strcmpi(trapstr, trap_types[i].name)) {
                res = trap_types[i].type;
                break;
            }
    }
    Free(trapstr);
    return res;
}

export function get_trapname_bytype(ttyp) { /* const char * */
    let i;

    for (i = 0; trap_types[i].name; i++)
        if (ttyp == trap_types[i].type)
            return trap_types[i].name;

    return 0;
}

function get_traptype_byname(trapname) { /* int */
    let i;

    for (i = 0; trap_types[i].name; i++)
        if (!strcmpi(trapname, trap_types[i].name))
            return trap_types[i].type;

    return NO_TRAP;
}

/* trap({ type = "hole", x = 1, y = 1 }); */
/* trap({ type = "web", spider_on_web = 0 }); */
/* trap("hole", 3, 4); */
/* trap("level teleport", {5, 8}); */
/* trap("rust") */
/* trap(); */
export function lspo_trap(L) { /* int */
    const $frame = stack_frame(); try {
    let tmptrap = stack_struct(spltrap);
    let x = stack_var(lua_Integer), y = stack_var(lua_Integer);
    let argc = lua_gettop(L);

    create_des_coder();

    tmptrap.spider_on_web = TRUE;
    tmptrap.seen = FALSE;
    tmptrap.novictim = FALSE;

    if (argc == 1 && lua_type(L, 1) == LUA_TSTRING) {
        let trapstr = luaL_checkstring(L, 1);

        tmptrap.type = get_traptype_byname(trapstr);
        x[0] = y[0] = -1;
    } else if (argc == 2 && lua_type(L, 1) == LUA_TSTRING
               && lua_type(L, 2) == LUA_TTABLE) {
        let trapstr = luaL_checkstring(L, 1);

        tmptrap.type = get_traptype_byname(trapstr);
        get_coord(L, 2, x, y);
    } else if (argc == 3) {
        let trapstr = luaL_checkstring(L, 1);

        tmptrap.type = get_traptype_byname(trapstr);
        x[0] = luaL_checkinteger(L, 2);
        y[0] = luaL_checkinteger(L, 3);
    } else {
        lcheck_param_table(L);

        get_table_xy_or_coord(L, x, y);
        tmptrap.type = get_table_traptype_opt(L, _("type"), -1);
        tmptrap.spider_on_web = get_table_boolean_opt(L, _("spider_on_web"), 1);
        tmptrap.seen = get_table_boolean_opt(L, _("seen"), FALSE);
        tmptrap.novictim = +!get_table_boolean_opt(L, _("victim"), TRUE);

        lua_getfield(L, -1, _("launchfrom"));
        if (lua_type(L, -1) == LUA_TTABLE) {
            let lx = stack_var(lua_Integer, -1), ly = stack_var(lua_Integer, -1);

            get_coord(L, -1, lx, ly);
            lua_pop(L, 1);
            gl.launchplace.x = lx[0];
            gl.launchplace.y = ly[0];
        } else
            lua_pop(L, 1);

        lua_getfield(L, -1, _("teledest"));
        if (lua_type(L, -1) == LUA_TTABLE) {
            let lx = stack_var(lua_Integer, -1), ly = stack_var(lua_Integer, -1);

            get_coord(L, -1, lx, ly);
            lua_pop(L, 1);
            gl.launchplace.x = lx[0];
            gl.launchplace.y = ly[0];
        } else
            lua_pop(L, 1);
    }

    if (tmptrap.type == NO_TRAP)
        nhl_error(L, _("Unknown trap type"));

    if (x[0] == -1 && y[0] == -1)
        tmptrap.coord = SP_COORD_PACK_RANDOM(0);
    else
        tmptrap.coord = (((x[0]) & 255) + (shl64(((y[0]) & 255), 16)));

    create_trap(tmptrap, gc.coder.croom);
    gl.launchplace.x = gl.launchplace.y = 0;

    return 0;
    } finally { stack_pop($frame); }
}

/* gold(500, 3,5); */
/* gold(500, {5, 6}); */
/* gold({ amount = 500, x = 2, y = 5 });*/
/* gold({ amount = 500, coord = {2, 5} });*/
/* gold(); */
export function lspo_gold(L) { /* int */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);
    let x = stack_var(coordxy), y = stack_var(coordxy);
    let amount;
    let gcoord;
    let gldx = stack_var(lua_Integer), gldy = stack_var(lua_Integer);

    create_des_coder();

    if (argc == 3) {
        amount = luaL_checkinteger(L, 1);
        x[0] = gldx[0] = luaL_checkinteger(L, 2);
        y[0] = gldy[0] = luaL_checkinteger(L, 3);
    } else if (argc == 2 && lua_type(L, 2) == LUA_TTABLE) {
        amount = luaL_checkinteger(L, 1);
        get_coord(L, 2, gldx, gldy);
        x[0] = gldx[0];
        y[0] = gldy[0];
    } else if (argc == 0 || (argc == 1 && lua_type(L, 1) == LUA_TTABLE)) {
        lcheck_param_table(L);

        amount = get_table_int_opt(L, _("amount"), -1);
        get_table_xy_or_coord(L, gldx, gldy);
        x[0] = gldx[0], y[0] = gldy[0];
    } else {
        nhl_error(L, _("Wrong parameters"));
        /*NOTREACHED*/
        return 0;
    }

    if (x[0] == -1 && y[0] == -1)
        gcoord = SP_COORD_PACK_RANDOM(0);
    else
        gcoord = (((gldx[0]) & 255) + (shl64(((gldy[0]) & 255), 16)));

    get_location_coord(x, y, DRY, gc.coder.croom, gcoord);
    if (amount < 0)
        amount = rnd(200);
    mkgold(amount, x[0], y[0]);

    return 0;
    } finally { stack_pop($frame); }
}

/* corridor({ srcroom=1, srcdoor=2, srcwall="north",
 *            destroom=2, destdoor=1, destwall="west" }); */
export function lspo_corridor(L) { /* int */
    const $frame = stack_frame(); try {
    let walldirs = static_array("lspo_corridor.walldirs", ptr_to(char), null, [
        _("all"), _("random"), _("north"), _("west"), _("east"), _("south"), 0
    ]);
    let walldirs2i = static_array("lspo_corridor.walldirs2i", int, null, [
        W_ANY, W_RANDOM, W_NORTH, W_WEST, W_EAST, W_SOUTH, 0
    ]);
    let tc = stack_struct(corridor);

    create_des_coder();

    lcheck_param_table(L);

    tc.src.room = get_table_int(L, _("srcroom"));
    tc.src.door = get_table_int(L, _("srcdoor"));
    tc.src.wall = walldirs2i[get_table_option(L, _("srcwall"), _("all"), walldirs)];
    tc.dest.room = get_table_int(L, _("destroom"));
    tc.dest.door = get_table_int(L, _("destdoor"));
    tc.dest.wall = walldirs2i[get_table_option(L, _("destwall"), _("all"),
                                               walldirs)];

    create_corridor(tc);

    return 0;
    } finally { stack_pop($frame); }
}

/* random_corridors(); */
export function lspo_random_corridors(L) { /* int */
    const $frame = stack_frame(); try {
    let tc = stack_struct(corridor);

    create_des_coder();

    tc.src.room = -1;
    tc.src.door = -1;
    tc.src.wall = -1;
    tc.dest.room = -1;
    tc.dest.door = -1;
    tc.dest.wall = -1;

    create_corridor(tc);

    return 0;
    } finally { stack_pop($frame); }
}

/* Choose a single random W_* direction. */
export function random_wdir() { /* coordxy */
    let wdirs = static_array("random_wdir.wdirs", short, 4, [ W_NORTH, W_SOUTH, W_EAST, W_WEST ]);
    return wdirs[rn2(4)];
}

const floodfillchk_match_under_typ = static_var("floodfillchk_match_under_typ", schar);

function floodfillchk_match_under(x, y) { /* int */
    return +(floodfillchk_match_under_typ[0] == levl()[x][y].typ);
}

export function set_floodfillchk_match_under(typ) { /* void */
    floodfillchk_match_under_typ[0] = typ;
    set_selection_floodfillchk(floodfillchk_match_under);
}

function floodfillchk_match_accessible(x, y) { /* int */
    return +(ACCESSIBLE(levl()[x][y].typ)
            || levl()[x][y].typ == SDOOR
            || levl()[x][y].typ == SCORR);
}

/* change map location terrain type during level creation */
function sel_set_ter(x, y, arg) { /* void */
    const $frame = stack_frame(); try {
    let terr = stack_struct(terrain);

    struct_assign(terr, view_of(terrain, arg));
    if (!set_levltyp_lit(x, y, terr.ter, terr.tlit))
        return;
    /* TODO: move this below into set_levltyp? */
    /* handle doors and secret doors */
    if (levl()[x][y].typ == SDOOR || IS_DOOR(levl()[x][y].typ)) {
        if (levl()[x][y].typ == SDOOR)
            levl()[x][y].flags = D_CLOSED;
        if (x && (IS_WALL(levl()[x - 1][y].typ) || levl()[x - 1][y].horizontal))
            levl()[x][y].horizontal = 1;
    } else if (levl()[x][y].typ == HWALL || levl()[x][y].typ == IRONBARS) {
        levl()[x][y].horizontal = 1;
    } else if (splev_init_present[0] && levl()[x][y].typ == ICE) {
        levl()[x][y].flags = icedpools[0] ? ICED_POOL : ICED_MOAT;
    } else if (levl()[x][y].typ == CLOUD) {
        del_engr_at(x, y); /* clouds cannot have engravings */
    }
    } finally { stack_pop($frame); }
}

function sel_set_feature(x, y, arg) { /* void */
    if (!isok(x, y)) {
        return;
    }
    if (IS_FURNITURE(levl()[x][y].typ))
        return;
    levl()[x][y].typ = (ref_to(int, arg)[0]);
}

function sel_set_door(dx, dy, arg) { /* void */
    let typ = ref_to(short, arg)[0];
    let x = dx, y = dy;

    if (!IS_DOOR(levl()[x][y].typ) && levl()[x][y].typ != SDOOR)
        levl()[x][y].typ = (typ & D_SECRET) ? SDOOR : DOOR;
    if (typ & D_SECRET) {
        typ &= ~D_SECRET;
        if (typ < D_CLOSED)
            typ = D_CLOSED;
    }
    set_door_orientation(x, y); /* set/clear levl[x][y].horizontal */
    levl()[x][y].flags = unsigned(typ);
    chars[SpLev_Map[x] + y] = 1;
}

/* door({ x = 1, y = 1, state = "nodoor" }); */
/* door({ coord = {1, 1}, state = "nodoor" }); */
/* door({ wall = "north", pos = 3, state="secret" }); */
/* door("nodoor", 1, 2); */
export function lspo_door(L) { /* int */
    const $frame = stack_frame(); try {
    let doorstates = static_array("lspo_door.doorstates", ptr_to(char), null, [
        _("random"), _("open"), _("closed"), _("locked"), _("nodoor"), _("broken"),
        _("secret"), 0
    ]);
    let doorstates2i = static_array("lspo_door.doorstates2i", int, null, [
        -1, D_ISOPEN, D_CLOSED, D_LOCKED, D_NODOOR, D_BROKEN, D_SECRET
    ]);
    let msk;
    let x = stack_var(coordxy), y = stack_var(coordxy);
    let typ = stack_var(coordxy);
    let argc = lua_gettop(L);

    create_des_coder();

    if (argc == 3) {
        msk = doorstates2i[luaL_checkoption(L, 1, _("random"), doorstates)];
        x[0] = luaL_checkinteger(L, 2);
        y[0] = luaL_checkinteger(L, 3);
    } else {
        let dx = stack_var(lua_Integer), dy = stack_var(lua_Integer);
        lcheck_param_table(L);

        get_table_xy_or_coord(L, dx, dy);
        x[0] = dx[0], y[0] = dy[0];
        msk = doorstates2i[get_table_option(L, _("state"), _("random"),
                                            doorstates)];
    }

    typ[0] = (msk == -1) ? rnddoor() : coordxy(msk);

    if (x[0] == -1 && y[0] == -1) {
        let walldirs = static_array("lspo_door.walldirs", ptr_to(char), null, [
            _("all"), _("random"), _("north"), _("west"), _("east"), _("south"), 0
        ]);
        /* Note that "random" is also W_ANY, because create_door just wants a
         * mask of acceptable walls */
        let walldirs2i = static_array("lspo_door.walldirs2i", int, null, [
            W_ANY, W_ANY, W_NORTH, W_WEST, W_EAST, W_SOUTH, 0
        ]);
        let tmpd = stack_struct(room_door);

        tmpd.secret = (typ[0] == D_SECRET) ? 1 : 0;
        tmpd.mask = msk;
        tmpd.pos = get_table_int_opt(L, _("pos"), -1);
        tmpd.wall = walldirs2i[get_table_option(L, _("wall"), _("all"), walldirs)];

        create_door(tmpd, gc.coder.croom);
    } else {
        /*selection_iterate(sel, sel_set_door, (genericptr_t) &typ);*/
        get_location_coord(x, y, ANY_LOC, gc.coder.croom,
                           SP_COORD_PACK(x[0], y[0]));
        if (!isok(x[0], y[0])) {
            nhl_error(L, _("door coord not ok"));
            /*NOTREACHED*/
            return 0;
        }
        sel_set_door(x[0], y[0], addr_of(typ));
    }

    return 0;
    } finally { stack_pop($frame); }
}

function l_table_getset_feature_flag(
    L,
    x, y,
    name,
    flag) { /* void */
    let val = get_table_boolean_opt(L, name, -2);

    if (val != -2) {
        if (val == -1)
            val = rn2(2);
        if (val)
            levl()[x][y].flags |= flag;
        else
            levl()[x][y].flags &= ~flag;
    }
}

/* guts of nhl_abs_coord; convert a coordinate relative to a map or room
 * into an absolute coordinate in svl.level.locations.
 *
 * If there is no enclosing map or room, the coordinates are assumed to be
 * absolute already.
 *
 * Part of the reason this is a function is to make it clearer in the calling
 * code that this conversion is what is intended.
 *
 * NOTE: if the coordinates are going to get passed to one of the get_location
 * family of functions, this should NOT be called; get_location already makes
 * an adjustment like this. (What this function supports which get_location
 * doesn't is the input coordinates being negative. get_location will treat
 * that as "level designer wants a random coordinate".) */
export function cvt_to_abscoord(x, y) { /* void */
    /* since commit 99715e0, xstart and ystart are only relevant in mklev when
     * maps are being used, and 0 otherwise. It is possible in the future that
     * map positions and dimensions can be saved and retrieved outside of
     * mklev which would reintroduce nonzero xstart/ystart/xsiz/ysiz, but
     * this is not currently implemented, so this function can be assumed to
     * have no effect outside of mklev.
     */
    if (gc.coder && gc.coder.croom) {
        x[0] += gc.coder.croom.lx;
        y[0] += gc.coder.croom.ly;
    } else {
        x[0] += gx.xstart;
        y[0] += gy.ystart;
    }
}

/* inverse of cvt_to_abscoord; turn an absolute svl.level.locations coordinate
 * into one relative to the current map or room. */
export function cvt_to_relcoord(x, y) { /* void */
    if (gc.coder && gc.coder.croom) {
        x[0] -= gc.coder.croom.lx;
        y[0] -= gc.coder.croom.ly;
    } else {
        x[0] -= gx.xstart;
        y[0] -= gy.ystart;
    }
}

/* convert map-relative coordinate to absolute.
  local ax,ay = nh.abscoord(rx, ry);
  local pt = nh.abscoord({ x = 10, y = 5 });
 */
export function nhl_abs_coord(L) { /* int */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);
    let x = stack_var(coordxy, -1), y = stack_var(coordxy, -1);

    if (argc == 2) {
        x[0] = coordxy(lua_tointeger(L, 1));
        y[0] = coordxy(lua_tointeger(L, 2));
        cvt_to_abscoord(x, y);
        lua_pushinteger(L, x[0]);
        lua_pushinteger(L, y[0]);
        return 2;
    } else if (argc == 1 && lua_type(L, 1) == LUA_TTABLE) {
        x[0] = coordxy(get_table_int(L, _("x")));
        y[0] = coordxy(get_table_int(L, _("y")));
        cvt_to_abscoord(x, y);
        lua_newtable(L);
        nhl_add_table_entry_int(L, _("x"), x[0]);
        nhl_add_table_entry_int(L, _("y"), y[0]);
        return 1;
    } else {
        nhl_error(L, _("nhl_abs_coord: Wrong args"));
        /*NOTREACHED*/
        return 0;
    }
    } finally { stack_pop($frame); }
}

/* feature("fountain", x, y); */
/* feature("fountain", {x,y}); */
/* feature({ type="fountain", x=NN, y=NN }); */
/* feature({ type="fountain", coord={NN, NN} }); */
/* feature({ type="tree", coord={NN, NN}, swarm=true, looted=false }); */
export function lspo_feature(L) { /* int */
    const $frame = stack_frame(); try {
    let features = static_array("lspo_feature.features", ptr_to(char), null, [ _("fountain"), _("sink"), _("pool"),
                                            _("throne"), _("tree"), 0 ]);
    let features2i = static_array("lspo_feature.features2i", int, null, [ FOUNTAIN, SINK, POOL,
                                      THRONE, TREE, STONE ]);
    let x = stack_var(coordxy), y = stack_var(coordxy);
    let typ = stack_var(int);
    let argc = lua_gettop(L);
    let can_have_flags = FALSE;
    let fcoord;
    let humidity;

    create_des_coder();

    if (argc == 1 && lua_type(L, 1) == LUA_TSTRING) {
        typ[0] = features2i[luaL_checkoption(L, 1, 0, features)];
        x[0] = y[0] = -1;
    } else if (argc == 2 && lua_type(L, 1) == LUA_TSTRING
        && lua_type(L, 2) == LUA_TTABLE) {
        let fx = stack_var(lua_Integer), fy = stack_var(lua_Integer);
        typ[0] = features2i[luaL_checkoption(L, 1, 0, features)];
        get_coord(L, 2, fx, fy);
        x[0] = fx[0];
        y[0] = fy[0];
    } else if (argc == 3) {
        typ[0] = features2i[luaL_checkoption(L, 1, 0, features)];
        x[0] = luaL_checkinteger(L, 2);
        y[0] = luaL_checkinteger(L, 3);
    } else {
        let fx = stack_var(lua_Integer), fy = stack_var(lua_Integer);
        lcheck_param_table(L);

        get_table_xy_or_coord(L, fx, fy);
        x[0] = fx[0], y[0] = fy[0];
        typ[0] = features2i[get_table_option(L, _("type"), 0, features)];
        can_have_flags = TRUE;
    }

    if (x[0] == -1 && y[0] == -1) {
        fcoord = SP_COORD_PACK_RANDOM(0);
        humidity = DRY; /* pick a regular space, no rock or other furniture */
    }
    else {
        fcoord = SP_COORD_PACK(x[0], y[0]);
        humidity = ANY_LOC; /* assume the author knows what they're doing */
    }
    get_location_coord(x, y, humidity, gc.coder.croom, fcoord);

    if (typ[0] == STONE)
        impossible(_("feature has unknown type param."));
    else
        sel_set_feature(x[0], y[0], addr_of(typ));

    if (levl()[x[0]][y[0]].typ != typ[0] || !can_have_flags)
        return 0;

    switch (typ[0]) {
    default:
        break;
    case FOUNTAIN:
        l_table_getset_feature_flag(L, x[0], y[0], _("looted"), F_LOOTED);
        l_table_getset_feature_flag(L, x[0], y[0], _("warned"), F_WARNED);
        break;
    case SINK:
        l_table_getset_feature_flag(L, x[0], y[0], _("pudding"), S_LPUDDING);
        l_table_getset_feature_flag(L, x[0], y[0], _("dishwasher"), S_LDWASHER);
        l_table_getset_feature_flag(L, x[0], y[0], _("ring"), S_LRING);
        break;
    case THRONE:
        l_table_getset_feature_flag(L, x[0], y[0], _("looted"), T_LOOTED);
        break;
    case TREE:
        l_table_getset_feature_flag(L, x[0], y[0], _("looted"), TREE_LOOTED);
        l_table_getset_feature_flag(L, x[0], y[0], _("swarm"), TREE_SWARM);
        break;
    }

    return 0;
    } finally { stack_pop($frame); }
}

/* gas_cloud({ selection=SELECTION }); */
/* gas_cloud({ selection=SELECTION, damage=N }); */
/* gas_cloud({ selection=SELECTION, damage=N, ttl=N }); */
export function lspo_gas_cloud(L) { /* int */
    const $frame = stack_frame(); try {
    let x = 0, y = 0;
    let sel = null;
    let argc = lua_gettop(L);
    let damage = 0;
    let ttl = -2;

    create_des_coder();

    if (argc == 1 && lua_type(L, 1) == LUA_TTABLE) {
        let tx = stack_var(lua_Integer), ty = stack_var(lua_Integer);
        let reg;

        lcheck_param_table(L);

        get_table_xy_or_coord(L, tx, ty);
        x = tx[0], y = ty[0];
        if (tx[0] == -1 && ty[0] == -1) {
            lua_getfield(L, 1, _("selection"));
            sel = l_selection_check(L, -1);
            lua_pop(L, 1);
        }
        damage = get_table_int_opt(L, _("damage"), 0);
        ttl = get_table_int_opt(L, _("ttl"), -2);
        if (!sel) {
            reg = create_gas_cloud(x, y, 1, damage);
        } else
            reg = create_gas_cloud_selection(sel, damage);
        if (ttl > -2)
            reg.ttl = ttl;
    } else {
        nhl_error(L, _("wrong parameters"));
    }

    return 0;
    } finally { stack_pop($frame); }
}

/*
 * [lit_state: 1 On, 0 Off, -1 random, -2 leave as-is]
 * terrain({ x=NN, y=NN, typ=MAPCHAR, lit=lit_state });
 * terrain({ coord={X, Y}, typ=MAPCHAR, lit=lit_state });
 * terrain({ selection=SELECTION, typ=MAPCHAR, lit=lit_state });
 * terrain( SELECTION, MAPCHAR [, lit_state ] );
 * terrain({x,y}, MAPCHAR);
 * terrain(x,y, MAPCHAR);
 */
export function lspo_terrain(L) { /* int */
    const $frame = stack_frame(); try {
    let tmpterrain = stack_struct(terrain);
    let x = stack_var(coordxy, 0), y = stack_var(coordxy, 0);
    let sel = null;
    let argc = lua_gettop(L);

    create_des_coder();
    tmpterrain.tlit = SET_LIT_NOCHANGE;
    tmpterrain.ter = INVALID_TYPE;

    if (argc == 1) {
        let tx = stack_var(lua_Integer), ty = stack_var(lua_Integer);
        lcheck_param_table(L);

        get_table_xy_or_coord(L, tx, ty);
        x[0] = tx[0], y[0] = ty[0];
        if (tx[0] == -1 && ty[0] == -1) {
            lua_getfield(L, 1, _("selection"));
            sel = l_selection_check(L, -1);
            lua_pop(L, 1);
        }
        tmpterrain.ter = get_table_mapchr(L, _("typ"));
        tmpterrain.tlit = get_table_int_opt(L, _("lit"), SET_LIT_NOCHANGE);
    } else if (argc == 2 && lua_type(L, 1) == LUA_TTABLE
               && lua_type(L, 2) == LUA_TSTRING) {
        let tx = stack_var(lua_Integer), ty = stack_var(lua_Integer);
        tmpterrain.ter = check_mapchr(luaL_checkstring(L, 2));
        lua_pop(L, 1);
        get_coord(L, 1, tx, ty);
        x[0] = tx[0];
        y[0] = ty[0];
    } else if (argc == 2) {
        sel = l_selection_check(L, 1);
        tmpterrain.ter = check_mapchr(luaL_checkstring(L, 2));
    } else if (argc == 3) {
        x[0] = luaL_checkinteger(L, 1);
        y[0] = luaL_checkinteger(L, 2);
        tmpterrain.ter = check_mapchr(luaL_checkstring(L, 3));
    } else {
        nhl_error(L, _("wrong parameters"));
    }

    if (tmpterrain.ter == INVALID_TYPE)
        nhl_error(L, _("Erroneous map char"));

    if (sel) {
        selection_iterate(sel, sel_set_ter, addr_of(tmpterrain));
    } else {
        get_location_coord(x, y, ANY_LOC, gc.coder.croom,
                           SP_COORD_PACK(x[0], y[0]));
        if (!isok(x[0], y[0])) {
            nhl_error(L, _("terrain coord not ok"));
            /*NOTREACHED*/
            return 0;
        }
        sel_set_ter(x[0], y[0], addr_of(tmpterrain));
    }

    return 0;
    } finally { stack_pop($frame); }
}

/*
 * replace_terrain({ x1=NN,y1=NN, x2=NN,y2=NN, fromterrain=MAPCHAR,
 *                   toterrain=MAPCHAR, lit=N, chance=NN });
 * replace_terrain({ region={x1,y1, x2,y2}, fromterrain=MAPCHAR,
 *                   toterrain=MAPCHAR, lit=N, chance=NN });
 * replace_terrain({ selection=selection.area(2,5, 40,10),
 *                   fromterrain=MAPCHAR, toterrain=MAPCHAR });
 * replace_terrain({ selection=SEL, mapfragment=[[...]],
 *                   toterrain=MAPCHAR });
 */
export function lspo_replace_terrain(L) { /* int */
    const $frame = stack_frame(); try {
    let totyp, fromtyp;
    let mf = stack_var(ptr_to(struct_mapfragment), null);
    let sel = null;
    let freesel = FALSE;
    let x, y;
    let x1 = stack_var(lua_Integer), y1 = stack_var(lua_Integer), x2 = stack_var(lua_Integer), y2 = stack_var(lua_Integer);
    let chance;
    let tolit;
    let rect = struct_assign(stack_struct(struct_nhrect), cg.zeroNhRect);

    create_des_coder();

    lcheck_param_table(L);

    totyp = get_table_mapchr(L, _("toterrain"));

    if (totyp >= MAX_TYPE)
        return 0;

    fromtyp = get_table_mapchr_opt(L, _("fromterrain"), INVALID_TYPE);

    if (fromtyp == INVALID_TYPE) {
        let err;
        let tmpstr = get_table_str(L, _("mapfragment"));
        mf[0] = mapfrag_fromstr(tmpstr);
        free(tmpstr);

        if ((err = mapfrag_error(mf[0])) != (0)) {
            nhl_error(L, err);
            /*NOTREACHED*/
        }
    }

    chance = get_table_int_opt(L, _("chance"), 100);
    tolit = get_table_int_opt(L, _("lit"), SET_LIT_NOCHANGE);
    x1[0] = get_table_int_opt(L, _("x1"), -1);
    y1[0] = get_table_int_opt(L, _("y1"), -1);
    x2[0] = get_table_int_opt(L, _("x2"), -1);
    y2[0] = get_table_int_opt(L, _("y2"), -1);

    if (x1[0] == -1 && y1[0] == -1 && x2[0] == -1 && y2[0] == -1) {
        get_table_region(L, _("region"), x1, y1, x2, y2, TRUE);
    }

    if (x1[0] == -1 && y1[0] == -1 && x2[0] == -1 && y2[0] == -1) {
        lua_getfield(L, 1, _("selection"));
        if (lua_type(L, -1) != LUA_TNIL)
            sel = l_selection_check(L, -1);
        lua_pop(L, 1);
    }

    if (!sel) {
        sel = selection_new();
        freesel = TRUE;

        if (x1[0] == -1 && y1[0] == -1 && x2[0] == -1 && y2[0] == -1) {
            selection_clear(sel, 1);
        } else {
            let rx1 = stack_var(coordxy), ry1 = stack_var(coordxy), rx2 = stack_var(coordxy), ry2 = stack_var(coordxy);
            rx1[0] = x1[0], ry1[0] = y1[0], rx2[0] = x2[0], ry2[0] = y2[0];
            get_location(rx1, ry1, ANY_LOC, gc.coder.croom);
            get_location(rx2, ry2, ANY_LOC, gc.coder.croom);
            for (x = max(rx1[0], 0); x <= min(rx2[0], COLNO - 1); x++)
                for (y = max(ry1[0], 0); y <= min(ry2[0], ROWNO - 1); y++)
                    selection_setpoint(x, y, sel, 1);
        }
    }

    selection_getbounds(sel, rect);

    for (x = max(1, rect.lx); x <= rect.hx; x++)
        for (y = rect.ly; y <= rect.hy; y++)
            if (selection_getpoint(x, y,sel)) {
                if (mf[0]) {
                    if (mapfrag_match(mf[0], x, y) && rn2(100) < chance)
                        set_levltyp_lit(x, y, totyp, tolit);
                } else {
                    if (((fromtyp == MATCH_WALL && IS_STWALL(levl()[x][y].typ))
                         || levl()[x][y].typ == fromtyp)
                        && rn2(100) < chance)
                        set_levltyp_lit(x, y, totyp, tolit);
                }
            }

    if (freesel)
        selection_free(sel, TRUE);

    mapfrag_free(mf);

    return 0;
    } finally { stack_pop($frame); }
}

function generate_way_out_method(
    nx, ny,
    ov) { /* boolean */
    const $frame = stack_frame(); try {
    var escapeitems = static_array("generate_way_out_method.escapeitems", int, null, [
        PICK_AXE, DWARVISH_MATTOCK, WAN_DIGGING,
        WAN_TELEPORTATION, SCR_TELEPORTATION, RIN_TELEPORTATION
    ]);
    var ov2 = selection_new(), ov3;
    var x = stack_var(coordxy), y = stack_var(coordxy);
    var res = TRUE;

    selection_floodfill(ov2, nx, ny, TRUE);
    ov3 = selection_clone(ov2);

    /* try to make a secret door */
    gotitdone: { while (selection_rndcoord(ov3, x, y, TRUE)) {
        if (isok(x[0] + 1, y[0]) && !selection_getpoint(x[0] + 1, y[0], ov)
            && IS_WALL(levl()[x[0] + 1][y[0]].typ)
            && isok(x[0] + 2, y[0]) &&  selection_getpoint(x[0] + 2, y[0], ov)
            && ACCESSIBLE(levl()[x[0] + 2][y[0]].typ)) {
            levl()[x[0] + 1][y[0]].typ = SDOOR;
            break gotitdone;
        }
        if (isok(x[0] - 1, y[0]) && !selection_getpoint(x[0] - 1, y[0], ov)
            && IS_WALL(levl()[x[0] - 1][y[0]].typ)
            && isok(x[0] - 2, y[0]) && selection_getpoint(x[0] - 2, y[0], ov)
            && ACCESSIBLE(levl()[x[0] - 2][y[0]].typ)) {
            levl()[x[0] - 1][y[0]].typ = SDOOR;
            break gotitdone;
        }
        if (isok(x[0], y[0] + 1) && !selection_getpoint(x[0], y[0] + 1, ov)
            && IS_WALL(levl()[x[0]][y[0] + 1].typ)
            && isok(x[0], y[0] + 2) && selection_getpoint(x[0], y[0] + 2, ov)
            && ACCESSIBLE(levl()[x[0]][y[0] + 2].typ)) {
            levl()[x[0]][y[0] + 1].typ = SDOOR;
            break gotitdone;
        }
        if (isok(x[0], y[0] - 1) && !selection_getpoint(x[0], y[0] - 1, ov)
            && IS_WALL(elt(levl()[x[0]], y[0] - 1).typ)
            && isok(x[0], y[0] - 2) && selection_getpoint(x[0], y[0] - 2, ov)
            && ACCESSIBLE(elt(levl()[x[0]], y[0] - 2).typ)) {
            elt(levl()[x[0]], y[0] - 1).typ = SDOOR;
            break gotitdone;
        }
    }

    /* try to make a hole or a trapdoor */
    if (Can_fall_thru(u.uz)) {
        selection_free(ov3, TRUE);
        ov3 = selection_clone(ov2);
        while (selection_rndcoord(ov3, x, y, TRUE)) {
            if (maketrap(x[0], y[0], rn2(2) ? HOLE : TRAPDOOR))
                break gotitdone;;
        }
    }

    /* generate one of the escape items */
    if (selection_rndcoord(ov2, x, y, FALSE)) {
        mksobj_at(ROLL_FROM(escapeitems), x[0], y[0], TRUE, FALSE);
        break gotitdone;
    }

    res = FALSE;
 }
    selection_free(ov2, TRUE);
    selection_free(ov3, TRUE);
    return res;
    } finally { stack_pop($frame); }
}

function ensure_way_out() { /* void */
    var ov = selection_new();
    var ttmp = gf.ftrap;
    var x, y;
    var ret = TRUE;
    var stway = gs.stairs;

    set_selection_floodfillchk(floodfillchk_match_accessible);

    while (stway) {
        if (stway.tolev.dnum == u.uz.dnum)
            selection_floodfill(ov, stway.sx, stway.sy, TRUE);
        stway = stway.next;
    }

    while (ttmp) {
        if ((undestroyable_trap(ttmp.ttyp) || is_hole(ttmp.ttyp))
            && !selection_getpoint(ttmp.tx, ttmp.ty, ov))
            selection_floodfill(ov, ttmp.tx, ttmp.ty, TRUE);
        ttmp = ttmp.ntrap;
    }

    do {
        ret = TRUE;
        outhere: { for (x = 1; x < COLNO; x++)
            for (y = 0; y < ROWNO; y++)
                if (ACCESSIBLE(levl()[x][y].typ)
                    && !selection_getpoint(x, y, ov)) {
                    if (generate_way_out_method(x, y, ov))
                        selection_floodfill(ov, x, y, TRUE);
                    ret = FALSE;
                    break outhere;
                }
 }
        ;
    } while (!ret);
    selection_free(ov, TRUE);
}

function get_table_intarray_entry(L, tableidx, entrynum) { /* lua_Integer */
    const $frame = stack_frame(); try {
    let ret = 0;
    if (tableidx < 0)
        tableidx--;

    lua_pushinteger(L, entrynum);
    lua_gettable(L, tableidx);
    if (lua_isnumber(L, -1)) {
        ret = lua_tointeger(L, -1);
    } else {
        let buf = stack_array(char, BUFSZ);

        sprintf(buf, _("Array entry #%i is %s, expected number"), 1, luaL_typename(L, -1))
;
        nhl_error(L, buf);
    }
    lua_pop(L, 1);
    return ret;
    } finally { stack_pop($frame); }
}

function get_table_region(
    L,
    name,
    x1, y1,
    x2, y2,
    optional) { /* int */
    let arrlen;

    lua_getfield(L, 1, name);
    if (optional && lua_type(L, -1) == LUA_TNIL) {
        lua_pop(L, 1);
        return 1;
    }

    luaL_checktype(L, -1, LUA_TTABLE);

    lua_len(L, -1);
    arrlen = lua_tointeger(L, -1);
    lua_pop(L, 1);
    if (arrlen != 4) {
        nhl_error(L, _("Not a region"));
        /*NOTREACHED*/
        lua_pop(L, 1);
        return 0;
    }

    x1[0] = get_table_intarray_entry(L, -1, 1);
    y1[0] = get_table_intarray_entry(L, -1, 2);
    x2[0] = get_table_intarray_entry(L, -1, 3);
    y2[0] = get_table_intarray_entry(L, -1, 4);

    lua_pop(L, 1);
    return 1;
}

export function get_coord(L, i, x, y) { /* boolean */
    let ret = FALSE;
    let ltyp = lua_type(L, i);

    if (ltyp == LUA_TTABLE) {
        let arrlen;
        let gotx = FALSE;

        lua_getfield(L, i, _("x"));
        if (!lua_isnil(L, -1)) {
            x[0] = luaL_checkinteger(L, -1);
            gotx = TRUE;
        }
        lua_pop(L, 1);

        if (gotx) {
            lua_getfield(L, i, _("y"));
            if (!lua_isnil(L, -1)) {
                y[0] = luaL_checkinteger(L, -1);
                lua_pop(L, 1);
                ret = TRUE;
            } else {
                nhl_error(L, _("Not a coordinate"));
                /*NOTREACHED*/
                return FALSE;
            }
        } else {
            lua_len(L, i);
            arrlen = lua_tointeger(L, -1);
            lua_pop(L, 1);
            if (arrlen != 2) {
                nhl_error(L, _("Not a coordinate"));
                /*NOTREACHED*/
                return FALSE;
            }

            x[0] = get_table_intarray_entry(L, i, 1);
            y[0] = get_table_intarray_entry(L, i, 2);

            return TRUE;
        }
    } else if (ltyp != LUA_TNIL) {
        /* non-existent coord is ok */
        nhl_error(L, _("non-table coord specified"));
    }
    return ret;
}

function levregion_add(lregion) { /* void */
    if (!lregion.in_islev) {
        get_location(ref_of(lregion.inarea, "x1"), ref_of(lregion.inarea, "y1"), ANY_LOC,
                     null);
        get_location(ref_of(lregion.inarea, "x2"), ref_of(lregion.inarea, "y2"), ANY_LOC,
                     null);
    }

    if (!lregion.del_islev) {
        get_location(ref_of(lregion.delarea, "x1"), ref_of(lregion.delarea, "y1"),
                     ANY_LOC, null);
        get_location(ref_of(lregion.delarea, "x2"), ref_of(lregion.delarea, "y2"),
                     ANY_LOC, null);
    }
    if (gn.num_lregions) {
        /* realloc the lregion space to add the new one */
        let newl = view_of(lev_region, addr_of(alloc(
            unsigned(Math.imul(sizeof(lev_region), unsigned((1 + gn.num_lregions)))))));

        memcpy(addr_of(newl), addr_of(gl.lregions),
                      unsigned(Math.imul(sizeof(lev_region), unsigned(gn.num_lregions))));
        do { if (gl.lregions) free(addr_of((gl.lregions))); } while (0);
        gn.num_lregions++;
        gl.lregions = newl;
    } else {
        gn.num_lregions = 1;
        gl.lregions = view_of(lev_region, addr_of(alloc(sizeof(lev_region))));
    }
    memcpy(addr_of(ptr_add(gl.lregions, gn.num_lregions - 1)), addr_of(lregion),
                  sizeof(lev_region));
}

/* get params from topmost lua hash:
   - region = {x1,y1,x2,y2}
   - exclude = {x1,y1,x2,y2} (optional)
   - region_islev=true, exclude_islev=true (optional)
   - negative x and y are invalid */
function l_get_lregion(L, tmplregion) { /* void */
    const $frame = stack_frame(); try {
    let x1 = stack_var(lua_Integer), y1 = stack_var(lua_Integer), x2 = stack_var(lua_Integer), y2 = stack_var(lua_Integer);

    get_table_region(L, _("region"), x1, y1, x2, y2, FALSE);
    tmplregion.inarea.x1 = x1[0];
    tmplregion.inarea.y1 = y1[0];
    tmplregion.inarea.x2 = x2[0];
    tmplregion.inarea.y2 = y2[0];

    x1[0] = y1[0] = x2[0] = y2[0] = -1;
    get_table_region(L, _("exclude"), x1, y1, x2, y2, TRUE);
    tmplregion.delarea.x1 = x1[0];
    tmplregion.delarea.y1 = y1[0];
    tmplregion.delarea.x2 = x2[0];
    tmplregion.delarea.y2 = y2[0];

    tmplregion.in_islev = get_table_boolean_opt(L, _("region_islev"), 0);
    tmplregion.del_islev = get_table_boolean_opt(L, _("exclude_islev"), 0);

    /* if x1 is still negative, exclude wasn't specified, so we should treat
     * it as if there is no exclude region at all. Force exclude_islev to
     * true so the -1,-1,-1,-1 region is safely off the map and won't
     * interfere with branch or portal placement. */
    if (x1[0] < 0)
        tmplregion.del_islev = TRUE;
    } finally { stack_pop($frame); }
}

/* teleport_region({ region = { x1,y1, x2,y2 } }); */
/* teleport_region({ region = { x1,y1, x2,y2 }, [ region_islev = 1, ]
 *   exclude = { x1,y1, x2,y2 }, [ exclude_islen = 1, ] [ dir = "up" ] }); */
/* TODO: maybe allow using selection, with a new method "getextents()"? */
export function lspo_teleport_region(L) { /* int */
    const $frame = stack_frame(); try {
    let teledirs = static_array("lspo_teleport_region.teledirs", ptr_to(char), null, [ _("both"), _("down"), _("up"), 0 ]);
    let teledirs2i = static_array("lspo_teleport_region.teledirs2i", int, null, [ LR_TELE, LR_DOWNTELE, LR_UPTELE, -1 ]);
    let tmplregion = stack_struct(lev_region);

    create_des_coder();
    lcheck_param_table(L);
    l_get_lregion(L, tmplregion);
    tmplregion.rtype = teledirs2i[get_table_option(L, _("dir"), _("both"),
                                                   teledirs)];
    tmplregion.padding = 0;
    tmplregion.rname.str = 0;

    levregion_add(tmplregion);

    return 0;
    } finally { stack_pop($frame); }
}

/* TODO: FIXME
   from lev_comp SPO_LEVREGION was called as:
   - STAIR:(x1,y1,x2,y2),(x1,y1,x2,y2),dir
   - PORTAL:(x1,y1,x2,y2),(x1,y1,x2,y2),string
   - BRANCH:(x1,y1,x2,y2),(x1,y1,x2,y2),dir
*/
/* levregion({ region = { x1,y1, x2,y2 }, exclude = { x1,y1, x2,y2 },
 *             type = "portal", name="air" }); */
/* TODO: allow region to be optional, defaulting to whole level */
export function lspo_levregion(L) { /* int */
    const $frame = stack_frame(); try {
    let regiontypes = static_array("lspo_levregion.regiontypes", ptr_to(char), null, [
        _("stair-down"), _("stair-up"), _("portal"), _("branch"),
        _("teleport"), _("teleport-up"), _("teleport-down"), 0
    ]);
    let regiontypes2i = static_array("lspo_levregion.regiontypes2i", int, null, [
        LR_DOWNSTAIR, LR_UPSTAIR, LR_PORTAL, LR_BRANCH,
        LR_TELE, LR_UPTELE, LR_DOWNTELE, 0
    ]);
    let tmplregion = stack_struct(lev_region);

    create_des_coder();
    lcheck_param_table(L);
    l_get_lregion(L, tmplregion);
    tmplregion.rtype = regiontypes2i[get_table_option(L, _("type"), _("stair-down"),
                                                      regiontypes)];
    tmplregion.padding = get_table_int_opt(L, _("padding"), 0);
    tmplregion.rname.str = get_table_str_opt(L, _("name"), 0);

    levregion_add(tmplregion);
    return 0;
    } finally { stack_pop($frame); }
}

/* exclusion({ type = "teleport", region = { x1,y1, x2,y2 } }); */
export function lspo_exclusion(L) { /* int */
    const $frame = stack_frame(); try {
    let ez_types = static_array("lspo_exclusion.ez_types", ptr_to(char), null, [
        _("teleport"), _("teleport-up"), _("teleport-down"), _("monster-generation"), 0
    ]);
    let ez_types2i = static_array("lspo_exclusion.ez_types2i", int, null, [
        LR_TELE, LR_UPTELE, LR_DOWNTELE, LR_MONGEN, 0
    ]);
    let ez = view_of(struct_exclusion_zone, addr_of(alloc(sizeof(struct_exclusion_zone))));
    let x1 = stack_var(lua_Integer), y1 = stack_var(lua_Integer), x2 = stack_var(lua_Integer), y2 = stack_var(lua_Integer);
    let a1 = stack_var(coordxy), b1 = stack_var(coordxy), a2 = stack_var(coordxy), b2 = stack_var(coordxy);

    create_des_coder();
    lcheck_param_table(L);
    ez.zonetype = ez_types2i[get_table_option(L, _("type"), _("teleport"),
                                                      ez_types)];
    get_table_region(L, _("region"), x1, y1, x2, y2, FALSE);

    a1[0] = x1[0], b1[0] = y1[0];
    a2[0] = x2[0], b2[0] = y2[0];

    get_location_coord(a1, b1, ANY_LOC|NO_LOC_WARN, gc.coder.croom,
                       SP_COORD_PACK(a1[0], b1[0]));
    get_location_coord(a2, b2, ANY_LOC|NO_LOC_WARN, gc.coder.croom,
                       SP_COORD_PACK(a2[0], b2[0]));

    ez.lx = a1[0];
    ez.ly = b1[0];
    ez.hx = a2[0];
    ez.hy = b2[0];

    ez.next = sve.exclusion_zones;
    sve.exclusion_zones = ez;
    return 0;
    } finally { stack_pop($frame); }
}

function sel_set_lit(x, y, arg) { /* void */
     let lit = ref_to(int, arg)[0];

     levl()[x][y].lit = (IS_LAVA(levl()[x][y].typ) || lit) ? 1 : 0;
}

/* Add to the room any doors within/bordering it */
function add_doors_to_room(croom) { /* void */
    let x, y;
    let i;

    for (x = croom.lx - 1; x <= croom.hx + 1; x++)
        for (y = croom.ly - 1; y <= croom.hy + 1; y++)
            if (IS_DOOR(levl()[x][y].typ) || levl()[x][y].typ == SDOOR)
                maybe_add_door(x, y, croom);
    for (i = 0; i < croom.nsubrooms; i++)
        add_doors_to_room(croom.sbrooms[i]);
}

/* inside a lua table, get fields x1,y1,x2,y2 or region table */
function get_table_coords_or_region(L,
                           dx1, dy1,
                           dx2, dy2) { /* void */
    const $frame = stack_frame(); try {
    dx1[0] = get_table_int_opt(L, _("x1"), -1);
    dy1[0] = get_table_int_opt(L, _("y1"), -1);
    dx2[0] = get_table_int_opt(L, _("x2"), -1);
    dy2[0] = get_table_int_opt(L, _("y2"), -1);

    if (dx1[0] == -1 && dy1[0] == -1 && dx2[0] == -1 && dy2[0] == -1) {
        let rx1 = stack_var(lua_Integer), ry1 = stack_var(lua_Integer), rx2 = stack_var(lua_Integer), ry2 = stack_var(lua_Integer);

        get_table_region(L, _("region"), rx1, ry1, rx2, ry2, FALSE);
        dx1[0] = rx1[0]; dy1[0] = ry1[0];
        dx2[0] = rx2[0]; dy2[0] = ry2[0];
    }
    } finally { stack_pop($frame); }
}

/* region(selection, lit); */
/* region({ x1=NN, y1=NN, x2=NN, y2=NN, lit=BOOL, type=ROOMTYPE, joined=BOOL,
 *          irregular=BOOL, filled=NN [ , contents = FUNCTION ] }); */
/* region({ region={x1,y1, x2,y2}, type="ordinary" }); */
export function lspo_region(L) { /* int */
    const $frame = stack_frame(); try {
    let dx1 = stack_var(coordxy), dy1 = stack_var(coordxy), dx2 = stack_var(coordxy), dy2 = stack_var(coordxy);
    let troom;
    let do_arrival_room = FALSE, room_not_needed,
            irregular = FALSE, joined = TRUE;
    let rtype = OROOM, rlit = stack_var(int, 1), needfill = 0;
    let argc = lua_gettop(L);

    create_des_coder();

    if (argc <= 1) {
        lcheck_param_table(L);

        /* TODO: "unfilled" => filled=0, "filled" => filled=1, and
         * "lvflags_only" => filled=2, probably in a get_table_needfill_opt */
        needfill = get_table_int_opt(L, _("filled"), 0);
        irregular = get_table_boolean_opt(L, _("irregular"), 0);
        joined = get_table_boolean_opt(L, _("joined"), TRUE);
        do_arrival_room = get_table_boolean_opt(L, _("arrival_room"), 0);
        rtype = get_table_roomtype_opt(L, _("type"), OROOM);
        rlit[0] = get_table_int_opt(L, _("lit"), -1);

        get_table_coords_or_region(L, dx1, dy1, dx2, dy2);

        if (dx1[0] == -1 && dy1[0] == -1 && dx2[0] == -1 && dy2[0] == -1) {
            nhl_error(L, _("region needs region"));
        }
    } else if (argc == 2) {
        /* region(selection, "lit"); */
        let lits = static_array("lspo_region.lits", ptr_to(char), null, [ _("unlit"), _("lit"), 0 ]);
        let orig = l_selection_check(L, 1),
                            sel = selection_clone(orig);

        rlit[0] = luaL_checkoption(L, 2, _("lit"), lits);

        /*
    TODO: lit=random
        */
        if (rlit[0])
            selection_do_grow(sel, W_ANY);
        selection_iterate(sel, sel_set_lit, addr_of(rlit));

        selection_free(sel, TRUE);

        /* TODO: skip the rest of this function? */
        return 0;
    } else {
        nhl_error(L, _("Wrong parameters"));
        /*NOTREACHED*/
        return 0;
    }

    rlit[0] = litstate_rnd(rlit[0]);

    get_location(dx1, dy1, ANY_LOC, null);
    get_location(dx2, dy2, ANY_LOC, null);

    /* Many regions are simple, rectangular areas that just need to set
     * lighting in an area. In that case, we don't need to do anything
     * complicated by creating a room. The exceptions are:
     *  - Special rooms (which usually need to be filled).
     *  - Irregular regions (more convenient to use the room-making code).
     *  - Themed room regions (which often have contents).
     *  - When a room is desired to constrain the arrival of migrating
     *    monsters (see the mon_arrive function for details).
     */
    room_not_needed = +(rtype == OROOM && !irregular
                       && !do_arrival_room && !gi.in_mk_themerooms);
    if (room_not_needed || svn.nroom >= MAXNROFROOMS) {
        let tmpregion = stack_struct(region);
        if (!room_not_needed)
            impossible(_("Too many rooms on new level!"));
        tmpregion.rlit = rlit[0];
        tmpregion.x1 = dx1[0];
        tmpregion.y1 = dy1[0];
        tmpregion.x2 = dx2[0];
        tmpregion.y2 = dy2[0];
        light_region(tmpregion);

        return 0;
    }

    troom = svr.rooms[svn.nroom];

    /* mark rooms that must be filled, but do it later */
    troom.needfill = needfill;

    troom.needjoining = joined;

    if (irregular) {
        gm.min_rx = gm.max_rx = dx1[0];
        gm.min_ry = gm.max_ry = dy1[0];
        gs.smeq[svn.nroom] = svn.nroom;
        flood_fill_rm(dx1[0], dy1[0], svn.nroom + ROOMOFFSET, rlit[0], TRUE);
        add_room(gm.min_rx, gm.min_ry, gm.max_rx, gm.max_ry, FALSE, rtype,
                 TRUE);
        troom.rlit = rlit[0];
        troom.irregular = TRUE;
    } else {
        add_room(dx1[0], dy1[0], dx2[0], dy2[0], rlit[0], rtype, TRUE);

        topologize(troom); /* set roomno */
    }

    if (!room_not_needed) {
        if (gc.coder.n_subroom > 1) {
            impossible(_("region as subroom"));
        } else {
            gc.coder.tmproomlist[gc.coder.n_subroom] = troom;
            chars[gc.coder.failed_room + gc.coder.n_subroom] = FALSE;
            gc.coder.n_subroom++;
            update_croom();
            lua_getfield(L, 1, _("contents"));
            if (lua_type(L, -1) == LUA_TFUNCTION) {
                lua_remove(L, -2);
                l_push_mkroom_table(L, troom);
                nhl_pcall_handle(L, 1, 0, _("lspo_region"), NHLpa_panic);
            } else {
                lua_pop(L, 1);
            }
            spo_endroom(gc.coder);
            add_doors_to_room(troom);
        }
    }

    return 0;
    } finally { stack_pop($frame); }
}

/* drawbridge({ dir="east", state="closed", x=05,y=08 }); */
/* drawbridge({ dir="east", state="closed", coord={05,08} }); */
export function lspo_drawbridge(L) { /* int */
    const $frame = stack_frame(); try {
    let mwdirs = static_array("lspo_drawbridge.mwdirs", ptr_to(char), null, [
        _("north"), _("south"), _("west"), _("east"), _("random"), 0
    ]);
    let mwdirs2i = static_array("lspo_drawbridge.mwdirs2i", int, null, [
        DB_NORTH, DB_SOUTH, DB_WEST, DB_EAST, -1, -2
    ]);
    let dbopens = static_array("lspo_drawbridge.dbopens", ptr_to(char), null, [
        _("open"), _("closed"), _("random"), 0
    ]);
    let dbopens2i = static_array("lspo_drawbridge.dbopens2i", int, null, [ 1, 0, -1, -2 ]);
    let x = stack_var(coordxy), y = stack_var(coordxy);
    let mx = stack_var(lua_Integer), my = stack_var(lua_Integer);
    let dir;
    let db_open;
    let dcoord;

    create_des_coder();

    lcheck_param_table(L);

    get_table_xy_or_coord(L, mx, my);

    dir = mwdirs2i[get_table_option(L, _("dir"), _("random"), mwdirs)];
    dcoord = (((mx[0]) & 255) + (shl64(((my[0]) & 255), 16)));
    db_open = dbopens2i[get_table_option(L, _("state"), _("random"), dbopens)];
    x[0] = mx[0];
    y[0] = my[0];

    get_location_coord(x, y, DRY | WET | HOT, gc.coder.croom, dcoord);
    if (!isok(mx[0], my[0])) {
        nhl_error(L, _("drawbridge coord not ok"));
        /*NOTREACHED*/
        return 0;
    }
    if (db_open == -1)
        db_open = +!rn2(2);
    if (!create_drawbridge(x[0], y[0], dir, db_open ? TRUE : FALSE))
        impossible(_("Cannot create drawbridge."));
    chars[SpLev_Map[x[0]] + (y[0])] = 1;

    return 0;
    } finally { stack_pop($frame); }
}

/* mazewalk({ x = NN, y = NN, typ = ".", dir = "north", stocked = 0 }); */
/* mazewalk({ coord = {XX, YY}, typ = ".", dir = "north", stocked = 0 }); */
/* mazewalk(x,y,dir); */
export function lspo_mazewalk(L) { /* int */
    const $frame = stack_frame(); try {
    let mwdirs = static_array("lspo_mazewalk.mwdirs", ptr_to(char), null, [
        _("north"), _("south"), _("east"), _("west"), _("random"), 0
    ]);
    let mwdirs2i = static_array("lspo_mazewalk.mwdirs2i", int, null, [
        W_NORTH, W_SOUTH, W_EAST, W_WEST, W_RANDOM, -2
    ]);
    let x = stack_var(coordxy), y = stack_var(coordxy);
    let mx = stack_var(lua_Integer), my = stack_var(lua_Integer);
    let ftyp = ROOM;
    let fstocked = 1, dir = -1;
    let mcoord;
    let argc = lua_gettop(L);

    create_des_coder();

    if (argc == 3) {
        mx[0] = luaL_checkinteger(L, 1);
        my[0] = luaL_checkinteger(L, 2);
        dir = mwdirs2i[luaL_checkoption(L, 3, _("random"), mwdirs)];
    } else {
        lcheck_param_table(L);

        get_table_xy_or_coord(L, mx, my);
        ftyp = get_table_mapchr_opt(L, _("typ"), ROOM);
        fstocked = get_table_boolean_opt(L, _("stocked"), 1);
        dir = mwdirs2i[get_table_option(L, _("dir"), _("random"), mwdirs)];
    }

    mcoord = (((mx[0]) & 255) + (shl64(((my[0]) & 255), 16)));
    x[0] = mx[0];
    y[0] = my[0];

    get_location_coord(x, y, ANY_LOC, gc.coder.croom, mcoord);

    if (!isok(x[0], y[0])) {
        nhl_error(L, _("mazewalk coord not ok"));
        /*NOTREACHED*/
        return 0;
    }

    if (ftyp < 1) {
        ftyp = svl.level.flags.corrmaze ? CORR : ROOM;
    }

    if (dir == W_RANDOM)
        dir = random_wdir();

    /* don't use move() - it doesn't use W_NORTH, etc. */
    switch (dir) {
    case W_NORTH:
        --y[0];
        break;
    case W_SOUTH:
        y[0]++;
        break;
    case W_EAST:
        x[0]++;
        break;
    case W_WEST:
        --x[0];
        break;
    default:
        impossible(_("mazewalk: Bad direction"));
    }

    if (!IS_DOOR(levl()[x[0]][y[0]].typ)) {
        levl()[x[0]][y[0]].typ = ftyp;
        levl()[x[0]][y[0]].flags = 0;
    }

    /*
     * We must be sure that the parity of the coordinates for
     * walkfrom() is odd.  But we must also take into account
     * what direction was chosen.
     */
    if (!(x[0] % 2)) {
        if (dir == W_EAST)
            x[0]++;
        else
            x[0]--;

        /* no need for IS_DOOR check; out of map bounds */
        levl()[x[0]][y[0]].typ = ftyp;
        levl()[x[0]][y[0]].flags = 0;
    }

    if (!(y[0] % 2)) {
        if (dir == W_SOUTH)
            y[0]++;
        else
            y[0]--;
    }

    walkfrom(x[0], y[0], ftyp);
    if (fstocked)
        fill_empty_maze();

    return 0;
    } finally { stack_pop($frame); }
}

/* wall_property({ x1=0, y1=0, x2=78, y2=20, property="nondiggable" }); */
/* wall_property({ region = {1,0, 78,20}, property="nonpasswall" }); */
export function lspo_wall_property(L) { /* int */
    const $frame = stack_frame(); try {
    let wprops = static_array("lspo_wall_property.wprops", ptr_to(char), null, [
        _("nondiggable"), _("nonpasswall"), 0
    ]);
    let wprop2i = static_array("lspo_wall_property.wprop2i", int, null, [ W_NONDIGGABLE, W_NONPASSWALL, -1 ]);
    let dx1 = stack_var(coordxy, -1), dy1 = stack_var(coordxy, -1), dx2 = stack_var(coordxy, -1), dy2 = stack_var(coordxy, -1);
    let wprop;

    create_des_coder();

    lcheck_param_table(L);

    get_table_coords_or_region(L, dx1, dy1, dx2, dy2);

    wprop = wprop2i[get_table_option(L, _("property"), _("nondiggable"), wprops)];

    if (dx1[0] == -1)
        dx1[0] = gx.xstart - 1;
    if (dy1[0] == -1)
        dy1[0] = gy.ystart - 1;
    if (dx2[0] == -1)
        dx2[0] = gx.xstart + gx.xsize + 1;
    if (dy2[0] == -1)
        dy2[0] = gy.ystart + gy.ysize + 1;

    get_location(dx1, dy1, ANY_LOC, null);
    get_location(dx2, dy2, ANY_LOC, null);

    set_wall_property(dx1[0], dy1[0], dx2[0], dy2[0], wprop);

    return 0;
    } finally { stack_pop($frame); }
}

function set_wallprop_in_selection(L, prop$) { /* void */
    const $frame = stack_frame(); try {
    const prop = stack_var(int, prop$);
    let argc = lua_gettop(L);
    let freesel = FALSE;
    let sel = null;

    create_des_coder();

    if (argc == 1) {
        sel = l_selection_check(L, -1);
    } else if (argc == 0) {
        freesel = TRUE;
        sel = selection_new();
        selection_clear(sel, 1);
    }

    if (sel) {
        selection_iterate(sel, sel_set_wall_property, addr_of(prop));
        if (freesel)
            selection_free(sel, TRUE);
    }
    } finally { stack_pop($frame); }
}

/* non_diggable(selection); */
/* non_diggable(); */
export function lspo_non_diggable(L) { /* int */
    set_wallprop_in_selection(L, W_NONDIGGABLE);
    return 0;
}

/* non_passwall(selection); */
/* non_passwall(); */
export function lspo_non_passwall(L) { /* int */
    set_wallprop_in_selection(L, W_NONPASSWALL);
    return 0;
}

/* TODO: wallify(selection) */
/* wallify({ x1=NN,y1=NN, x2=NN,y2=NN }); */
/* wallify(); */
export function lspo_wallify(L) { /* int */
    let dx1 = -1, dy1 = -1, dx2 = -1, dy2 = -1;

    /* TODO: clamp coord values */
    /* TODO: maybe allow wallify({x1,y1}, {x2,y2}) */
    /* TODO: is_table_coord(), is_table_area(),
             get_table_coord(), get_table_area() */

    create_des_coder();

    if (lua_gettop(L) == 1) {
        dx1 = get_table_int(L, _("x1"));
        dy1 = get_table_int(L, _("y1"));
        dx2 = get_table_int(L, _("x2"));
        dy2 = get_table_int(L, _("y2"));
    }

    wallify_map(dx1 < 0 ? (gx.xstart - 1) : dx1,
                dy1 < 0 ? (gy.ystart - 1) : dy1,
                dx2 < 0 ? (gx.xstart + gx.xsize + 1) : dx2,
                dy2 < 0 ? (gy.ystart + gy.ysize + 1) : dy2);

    return 0;
}

/* reset_level is only needed for testing purposes */
export function lspo_reset_level(L) { /* int */
    let wtower = In_W_tower(u.ux, u.uy, u.uz);

    iflags.lua_testing = TRUE;
    if (L) {
        if (gc.coder) {
            do { if (gc.coder) free(addr_of((gc.coder))); } while (0);
            gc.coder = null;
        }
        create_des_coder();
    }
    makemap_prepost(TRUE, wtower);
    gi.in_mklev = TRUE;
    oinit(); /* assign level dependent obj probabilities */
    clear_level_structures();
    return 0;
}

/* finalize_level is only needed for testing purposes */
export function lspo_finalize_level(L) { /* int */
    let wtower = In_W_tower(u.ux, u.uy, u.uz);
    let i;

    if (L)
        create_des_coder();

    link_doors_rooms();
    remove_boundary_syms();

    /* TODO: ensure_way_out() needs rewrite */
    if (L && gc.coder.check_inaccessibles)
        ensure_way_out();

    map_cleanup();

    /* FIXME: Ideally, we want this call to only cover areas of the map
     * which were not inserted directly by the special level file (see
     * the insect legs on Baalzebub's level, for instance). Since that
     * is currently not possible, we overload the corrmaze flag for this
     * purpose.
     */
    if (!svl.level.flags.corrmaze)
        wallification(1, 0, COLNO - 1, ROWNO - 1);

    if (L)
        flip_level_rnd(gc.coder.allow_flips, FALSE);

    count_level_features();

    if (L && gc.coder.solidify)
        solidify_map();

    /* This must be done before premap_detect(),
     * otherwise branch stairs won't be premapped. */
    fixup_special();

    if (L && gc.coder.premapped)
        premap_detect();

    level_finalize_topology();

    for (i = 0; i < svn.nroom; ++i) {
        fill_special_room(svr.rooms[i]);
    }

    makemap_prepost(FALSE, wtower);
    iflags.lua_testing = FALSE;
    return 0;
}

/* map({ x = 10, y = 10, map = [[...]] }); */
/* map({ coord = {10, 10}, map = [[...]] }); */
/* map({ halign = "center", valign = "center", map = [[...]] }); */
/* map({ map = [[...]], contents = function(map) ... end }); */
/* map([[...]]) */
/* local selection = map( ... ); */
export function lspo_map(L) { /* int */
    const $frame = stack_frame(); try {
    /*
TODO: allow passing an array of strings as map data
TODO: handle if map lines aren't same length
TODO: gc.coder->croom needs to be updated
     */

    var left_or_right = static_array("lspo_map.left_or_right", ptr_to(char), null, [
        _("left"), _("half-left"), _("center"), _("half-right"), _("right"), _("none"), 0
    ]);
    var l_or_r2i = static_array("lspo_map.l_or_r2i", int, null, [
        SPLEV_LEFT, SPLEV_H_LEFT, SPLEV_CENTER, SPLEV_H_RIGHT,
        SPLEV_RIGHT, -1, -1
    ]);
    var top_or_bot = static_array("lspo_map.top_or_bot", ptr_to(char), null, [
        _("top"), _("center"), _("bottom"), _("none"), 0
    ]);
    var t_or_b2i = static_array("lspo_map.t_or_b2i", int, null, [ TOP, SPLEV_CENTER, BOTTOM, -1, -1 ]);
    var lr, tb;
    var x = stack_var(lua_Integer, -1), y = stack_var(lua_Integer, -1);
    var mf = stack_var(ptr_to(struct_mapfragment));
    var tmpstr;
    var argc = lua_gettop(L);
    var has_contents = FALSE;
    var tryct = 0;
    var ox, oy;
    var lit = FALSE;
    var sel;

    create_des_coder();

    if (gi.in_mk_themerooms && gt.themeroom_failed)
        return 0;

    if (argc == 1 && lua_type(L, 1) == LUA_TSTRING) {
        tmpstr = dupstr(luaL_checkstring(L, 1));
        lr = tb = SPLEV_CENTER;
        mf[0] = mapfrag_fromstr(tmpstr);
        free(tmpstr);
    } else {
        lcheck_param_table(L);
        lr = l_or_r2i[get_table_option(L, _("halign"), _("none"), left_or_right)];
        tb = t_or_b2i[get_table_option(L, _("valign"), _("none"), top_or_bot)];
        get_table_xy_or_coord(L, x, y);
        tmpstr = get_table_str(L, _("map"));
        lit = boolean(get_table_boolean_opt(L, _("lit"), FALSE));
        lua_getfield(L, 1, _("contents"));
        if (lua_type(L, -1) == LUA_TFUNCTION) {
            lua_remove(L, -2);
            has_contents = TRUE;
        } else {
            lua_pop(L, 1);
        }
        mf[0] = mapfrag_fromstr(tmpstr);
        free(tmpstr);
    }

    if (!mf[0]) {
        nhl_error(L, _("Map data error"));
        /*NOTREACHED*/
        return 0;
    }

    sel = selection_new();
    ox = x[0];
    oy = y[0];
 redo_maploc: for (;;) {
    gx.xsize = mf[0].wid;
    gy.ysize = mf[0].hei;

    if (lr == -1 && tb == -1) {
        if (gi.in_mk_themerooms && (ox == -1 || oy == -1)) {
            if (ox == -1) {
                if (gc.coder.croom) {
                    x[0] = somex(gc.coder.croom) - mf[0].wid;
                    if (x[0] < 1)
                        x[0] = 1;
                } else {
                    x[0] = 1 + rn2(COLNO - 1 - mf[0].wid);
                }
            }

            if (oy == -1) {
                if (gc.coder.croom) {
                    y[0] = somey(gc.coder.croom) - mf[0].hei;
                    if (y[0] < 1)
                        y[0] = 1;
                } else {
                    y[0] = rn2(ROWNO - mf[0].hei);
                }
            }
        }

        if (isok(x[0], y[0])) {
            /* x,y is given, place map starting at x,y */
            if (gc.coder.croom) {
                /* in a room? adjust to room relative coords */
                gx.xstart = x[0] + gc.coder.croom.lx;
                gy.ystart = y[0] + gc.coder.croom.ly;
                gx.xsize = min(mf[0].wid,
                              (gc.coder.croom.hx - gc.coder.croom.lx));
                gy.ysize = min(mf[0].hei,
                              (gc.coder.croom.hy - gc.coder.croom.ly));
            } else {
                gx.xsize = mf[0].wid;
                gy.ysize = mf[0].hei;
                gx.xstart = x[0];
                gy.ystart = y[0];
            }
        } else {
            mapfrag_free(mf);
            nhl_error(L, _("Map requires either x,y or halign,valign params"));
            selection_free(sel, TRUE);
            return 0;
        }
    } else {
        /* place map starting at halign,valign */
        switch (lr) {
        case SPLEV_LEFT:
            gx.xstart = splev_init_present[0] ? 1 : 3;
            break;
        case SPLEV_H_LEFT:
            gx.xstart = 2 + Math.trunc((gx.x_maze_max - 2 - gx.xsize) / 4);
            break;
        case SPLEV_CENTER:
            gx.xstart = 2 + Math.trunc((gx.x_maze_max - 2 - gx.xsize) / 2);
            break;
        case SPLEV_H_RIGHT:
            gx.xstart = 2 + Math.trunc((gx.x_maze_max - 2 - gx.xsize) * 3 / 4);
            break;
        case SPLEV_RIGHT:
            gx.xstart = gx.x_maze_max - gx.xsize - 1;
            break;
        }
        switch (tb) {
        case TOP:
            gy.ystart = 3;
            break;
        case SPLEV_CENTER:
            gy.ystart = 2 + Math.trunc((gy.y_maze_max - 2 - gy.ysize) / 2);
            break;
        case BOTTOM:
            gy.ystart = gy.y_maze_max - gy.ysize - 1;
            break;
        }
        if (!(gx.xstart % 2))
            gx.xstart++;
        if (!(gy.ystart % 2))
            gy.ystart++;
    }

    skipmap: { if (gy.ystart < 0 || gy.ystart + gy.ysize > ROWNO) {
        if (gi.in_mk_themerooms) {
            gt.themeroom_failed = TRUE;
            break skipmap;
        }
        /* try to move the start a bit */
        gy.ystart += (gy.ystart > 0) ? -2 : 2;
        if (gy.ysize == ROWNO)
            gy.ystart = 0;
        if (gy.ystart < 0 || gy.ystart + gy.ysize > ROWNO)
            gy.ystart = 0;
    }
    if (gx.xsize <= 1 && gy.ysize <= 1) {
        reset_xystart_size();
    } else {
        var mptyp;
        var terr = stack_struct(terrain);

        /* Themed rooms should never overwrite anything */
        if (gi.in_mk_themerooms) {
            var isokp = TRUE;
            for (y[0] = gy.ystart - 1;
                 y[0] < min(ROWNO, gy.ystart + gy.ysize) + 1; y[0]++)
                for (x[0] = gx.xstart - 1;
                     x[0] < min(COLNO, gx.xstart + gx.xsize) + 1; x[0]++) {
                    if (!isok(x[0], y[0])) {
                        isokp = FALSE;
                    } else if (y[0] < gy.ystart || y[0] >= (gy.ystart + gy.ysize)
                            || x[0] < gx.xstart || x[0] >= (gx.xstart + gx.xsize)) {
                        if (levl()[x[0]][y[0]].typ != STONE
                            || levl()[x[0]][y[0]].roomno != NO_ROOM)
                            isokp = FALSE;
                    } else {
                        mptyp = mapfrag_get(mf[0], x[0] - gx.xstart, y[0] - gy.ystart);
                        if (mptyp >= MAX_TYPE)
                            continue;
                        if ((levl()[x[0]][y[0]].typ != STONE
                             && levl()[x[0]][y[0]].typ != mptyp)
                            || levl()[x[0]][y[0]].roomno != NO_ROOM)
                            isokp = FALSE;
                    }
                    if (!isokp) {
                        if (tryct++ < 100 && (lr == -1 || tb == -1))
                            continue redo_maploc;;
                        gt.themeroom_failed = TRUE;
                        break skipmap;
                    }
                }
        }

        /* Load the map */
        for (y[0] = gy.ystart; y[0] < min(ROWNO, gy.ystart + gy.ysize); y[0]++)
            for (x[0] = gx.xstart; x[0] < min(COLNO, gx.xstart + gx.xsize); x[0]++) {
                mptyp = mapfrag_get(mf[0], (x[0] - gx.xstart), (y[0] - gy.ystart));
                if (mptyp == INVALID_TYPE) {
                    /* TODO: warn about illegal map char */
                    continue;
                }
                if (mptyp >= MAX_TYPE)
                    continue;
                /* clear out levl: load_common_data may set them */
                levl()[x[0]][y[0]].flags = 0;
                levl()[x[0]][y[0]].horizontal = 0;
                levl()[x[0]][y[0]].roomno = 0;
                levl()[x[0]][y[0]].edge = 0;
                chars[SpLev_Map[x[0]] + (y[0])] = 1;
                selection_setpoint(x[0], y[0], sel, 1);
                terr.ter = mptyp;
                terr.tlit = lit;
                sel_set_ter(x[0], y[0], addr_of(terr));
            }
    }
 }
    mapfrag_free(mf); break; }

    if (gi.in_mk_themerooms && gt.themeroom_failed) {
        /* this mutated xstart and ystart in the process of trying to make a
         * themed room, so undo them */
        reset_xystart_size();
    }
    else if (has_contents) {
        l_push_wid_hei_table(L, gx.xsize, gy.ysize);
        nhl_pcall_handle(L, 1, 0, _("lspo_map"), NHLpa_panic);
        reset_xystart_size();
    }

    /* return selection where map locations were put */
    l_selection_push_copy(L, sel);
    selection_free(sel, TRUE);

    return 1;
    } finally { stack_pop($frame); }
}

export function update_croom() { /* void */
    if (!gc.coder)
        return;

    if (gc.coder.n_subroom)
        gc.coder.croom = gc.coder.tmproomlist[gc.coder.n_subroom - 1];
    else
        gc.coder.croom = null;
}

function sp_level_coder_init() { /* struct sp_coder * */
    let tmpi;
    let coder = view_of(struct_sp_coder, addr_of(alloc(sizeof(struct_sp_coder))));

    coder.premapped = FALSE;
    coder.solidify = FALSE;
    coder.check_inaccessibles = FALSE;
    coder.allow_flips = 3; /* allow flipping level horiz/vert */
    coder.croom = null;
    coder.n_subroom = 1;
    coder.lvl_is_joined = FALSE;
    coder.room_stack = 0;

    splev_init_present[0] = FALSE;
    icedpools[0] = FALSE;

    for (tmpi = 0; tmpi <= MAX_NESTED_ROOMS; tmpi++) {
        coder.tmproomlist[tmpi] = null;
        chars[coder.failed_room + tmpi] = FALSE;
    }

    update_croom();

    for (tmpi = 0; tmpi < MAX_CONTAINMENT; tmpi++)
        container_obj[tmpi] = null;
    container_idx[0] = 0;

    invent_carrying_monster[0] = null;

    memset(addr_of(SpLev_Map), 0, sizeof(array_of(array_of(char, ROWNO), COLNO)));

    svl.level.flags.is_maze_lev = 0;
    svl.level.flags.temperature = In_hell(u.uz) ? 1 : 0;
    svl.level.flags.rndmongen = 1;
    svl.level.flags.deathdrops = 1;

    reset_xystart_size();

    return coder;
}

const nhl_functions = static_array("sp_lev.c/nhl_functions", struct_luaL_Reg, null, [
    { name: _("message"), func: lspo_message },
    { name: _("monster"), func: lspo_monster },
    { name: _("object"), func: lspo_object },
    { name: _("level_flags"), func: lspo_level_flags },
    { name: _("level_init"), func: lspo_level_init },
    { name: _("engraving"), func: lspo_engraving },
    { name: _("mineralize"), func: lspo_mineralize },
    { name: _("door"), func: lspo_door },
    { name: _("stair"), func: lspo_stair },
    { name: _("ladder"), func: lspo_ladder },
    { name: _("grave"), func: lspo_grave },
    { name: _("altar"), func: lspo_altar },
    { name: _("map"), func: lspo_map },
    { name: _("feature"), func: lspo_feature },
    { name: _("terrain"), func: lspo_terrain },
    { name: _("replace_terrain"), func: lspo_replace_terrain },
    { name: _("room"), func: lspo_room },
    { name: _("corridor"), func: lspo_corridor },
    { name: _("random_corridors"), func: lspo_random_corridors },
    { name: _("gold"), func: lspo_gold },
    { name: _("trap"), func: lspo_trap },
    { name: _("mazewalk"), func: lspo_mazewalk },
    { name: _("drawbridge"), func: lspo_drawbridge },
    { name: _("region"), func: lspo_region },
    { name: _("levregion"), func: lspo_levregion },
    { name: _("exclusion"), func: lspo_exclusion },
    { name: _("wallify"), func: lspo_wallify },
    { name: _("wall_property"), func: lspo_wall_property },
    { name: _("non_diggable"), func: lspo_non_diggable },
    { name: _("non_passwall"), func: lspo_non_passwall },
    { name: _("teleport_region"), func: lspo_teleport_region },
    { name: _("reset_level"), func: lspo_reset_level },
    { name: _("finalize_level"), func: lspo_finalize_level },
    { name: _("gas_cloud"), func: lspo_gas_cloud },
    /* TODO: { "branch", lspo_branch }, */
    /* TODO: { "portal", lspo_portal }, */
    { name: 0, func: null }
]);

/* TODO:

 - if des-file used MAZE_ID to start a level, the level needs
   des.level_flags("mazelevel")
 - expose gc.coder->croom or gx.xstart gy.ystart and gx.xsize gy.ysize to lua.
 - detect a "subroom" automatically.
 - new function get_mapchar(x,y) to return the mapchar on map
 - many params should accept their normal type (eg, int or bool), AND "random"
 - automatically add shuffle(array)
 - automatically add align = { "law", "neutral", "chaos" } and shuffle it.
   (remove from lua files)
 - grab the header comments from des-files and add them to the lua files

*/

export function l_register_des(L) { /* void */
    /* register des -table, and functions for it */
    lua_newtable(L);
    luaL_setfuncs(L, nhl_functions[0], 0);
    lua_setglobal(L, _("des"));
}

export function create_des_coder() { /* void */
    if (!gc.coder)
        gc.coder = sp_level_coder_init();
}

/*
 * General loader
 */
export function load_special(name) { /* boolean */
    const $frame = stack_frame(); try {
    var result = FALSE;
    var sbi = init_list(stack_struct(struct_nhl_sandbox_info), {flags: NHL_SB_SAFE, memlimit: 1*1024*1024, steps: 0, perpcall: 1*1024*1024});

    create_des_coder();

    give_up: { if (!load_lua(name, sbi))
        break give_up;;

    link_doors_rooms();
    remove_boundary_syms();

    /* TODO: ensure_way_out() needs rewrite */
    if (gc.coder.check_inaccessibles)
        ensure_way_out();

    map_cleanup();

    /* FIXME: Ideally, we want this call to only cover areas of the map
     * which were not inserted directly by the special level file (see
     * the insect legs on Baalzebub's level, for instance). Since that
     * is currently not possible, we overload the corrmaze flag for this
     * purpose.
     */
    if (!svl.level.flags.corrmaze)
        wallification(1, 0, COLNO - 1, ROWNO - 1);

    flip_level_rnd(gc.coder.allow_flips, FALSE);

    count_level_features();

    if (gc.coder.solidify)
        solidify_map();

    /* This must be done before premap_detect(),
     * otherwise branch stairs won't be premapped. */
    fixup_special();

    if (gc.coder.premapped)
        premap_detect();

    result = TRUE;
 }
    do { if (gc.coder) free(addr_of((gc.coder))); } while (0);
    gc.coder = null;

    return result;
    } finally { stack_pop($frame); }
}

/*sp_lev.c*/

import {
    AM_CHAOTIC, AM_LAWFUL, AM_MASK, AM_NEUTRAL, AM_NONE, AM_SANCTUM, AM_SHRINE, AM_SPLEV_CO,
    AM_SPLEV_NONCO, AM_SPLEV_RANDOM, A_LAWFUL, A_NONE,
} from "./align.h.js";
import { Align2amask, Amask2align } from "./align.h.macros.js";
import { struct_nhcoord } from "./coord.h.js";
import {
    COIN_CLASS, GEM_CLASS, MAXMCLASSES, MAXOCLASSES, MAXPCHARS, POTION_CLASS, RANDOM_CLASS,
    RING_CLASS, SCROLL_CLASS, SPBOOK_CLASS, S_EEL, S_HUMAN, S_MIMIC, WAND_CLASS,
} from "./defsym.h.js";
import { glyph_is_cmap } from "./display.h.macros.js";
import {
    LR_BRANCH, LR_DOWNSTAIR, LR_DOWNTELE, LR_MONGEN, LR_PORTAL, LR_TELE, LR_UPSTAIR, LR_UPTELE,
    struct_d_level, struct_exclusion_zone,
} from "./dungeon.h.js";
import {
    In_endgame, Is_medusa_level, Is_mineend_level, Is_sokoend_level, Is_waterlevel,
} from "./dungeon.h.macros.js";
import { BURN, DUST, ENGRAVE, ENGR_BLOOD, MARK } from "./engrave.h.js";
import {
    BOOL_RANDOM, BUFSZ, COLNO, FALSE, MAXNROFROOMS, NHL_SB_SAFE, NHLpa_panic, QBUFSZ, ROWNO, TRUE,
    boolean, coordxy, struct_nhl_sandbox_info,
} from "./global.h.js";
import { Strlen, strcmpi } from "./global.h.macros.js";
import {
    CORPSTAT_FEMALE, CORPSTAT_HISTORIC, CORPSTAT_MALE, MKTRAP_MAZEFLAG, MKTRAP_NOSPIDERONWEB,
    MKTRAP_NOVICTIM, MKTRAP_SEEN, MM_ADJACENTOK, MM_IGNOREWATER, MM_NOCOUNTBIRTH, MM_NOGRP,
    MM_NOMSG, MM_NOTAIL, NO_MM_FLAGS, NO_NC_FLAGS, ONAME_LEVEL_DEF, ONAME_NO_FLAGS, lev_region,
} from "./hack.h.js";
import { ROLL_FROM, max, min, rn1 } from "./hack.h.macros.js";
import { struct_luaL_Reg } from "./lauxlib.h.js";
import { luaL_checkstring, luaL_typename } from "./lauxlib.h.macros.js";
import { debugpline0, debugpline2, debugpline4 } from "./lint.h.macros.js";
import {
    LUA_TFUNCTION, LUA_TNIL, LUA_TNUMBER, LUA_TSTRING, LUA_TTABLE, lua_Integer,
} from "./lua.h.js";
import {
    lua_isnil, lua_newtable, lua_pop, lua_remove, lua_tointeger, lua_tostring,
} from "./lua.h.macros.js";
import { EGD, EPRI, ESHK } from "./mextra.h.macros.js";
import {
    ANTHOLE, ARMORSHOP, BARRACKS, BEEHIVE, BOOKSHOP, CANDLESHOP, COCKNEST, COURT, DELPHI, FILL_NONE,
    FILL_NORMAL, FODDERSHOP, FOODSHOP, LEPREHALL, MORGUE, NO_ROOM, OROOM, POTIONSHOP, RINGSHOP,
    ROOMOFFSET, SCROLLSHOP, SHOPBASE, SWAMP, TEMPLE, THEMEROOM, TOOLSHOP, VAULT, WANDSHOP,
    WEAPONSHOP, ZOO,
} from "./mkroom.h.js";
import {
    amphibious, emits_light, is_female, is_floater, is_flyer, is_male, is_swimmer, likes_fire,
    monsndx, monsym, noncorporeal, passes_walls, pm_invisible, your_race,
} from "./mondata.h.macros.js";
import {
    FEMALE, G_EXTINCT, G_GONE, G_IGNORE, G_NOGEN, G_UNIQ, MALE, NEUTRAL,
} from "./monflag.h.js";
import {
    M_AP_FURNITURE, M_AP_MONSTER, M_AP_NOTHING, M_AP_OBJECT, STRAT_WAITFORU, struct_monst,
} from "./monst.h.js";
import { is_vampshifter, ismnum, resists_ston, vampshifted } from "./monst.h.macros.js";
import {
    LOW_PM, NON_PM, NUMMONS, PM_ARCHEOLOGIST, PM_DWARF, PM_GNOME, PM_MINOTAUR, PM_WIZARD,
    PM_WIZARD_OF_YENDOR,
} from "./monsters.h.js";
import { OBJ_FREE, struct_obj } from "./obj.h.js";
import { carried } from "./obj.h.macros.js";
import { OBJ_DESCR, OBJ_NAME } from "./objclass.h.macros.js";
import {
    BOULDER, CORPSE, DWARVISH_MATTOCK, EGG, FIGURINE, NUM_OBJECTS, PICK_AXE, RIN_TELEPORTATION,
    SADDLE, SCR_TELEPORTATION, SPE_NOVEL, STATUE, STRANGE_OBJECT, TIN, WAN_DIGGING,
    WAN_TELEPORTATION,
} from "./objects.h.js";
import { struct_nhrect } from "./rect.h.js";
import {
    ALTAR, CLOUD, CORR, CROSSWALL, DB_DIR, DB_EAST, DB_NORTH, DB_SOUTH, DB_WEST, DOOR, D_BROKEN,
    D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR, D_SECRET, D_TRAPPED, FOUNTAIN, F_LOOTED, F_WARNED,
    GRAVE, HWALL, ICE, ICED_MOAT, ICED_POOL, INVALID_TYPE, IRONBARS, LADDER, LA_DOWN, LA_UP,
    MATCH_WALL, MAX_TYPE, MOAT, POOL, ROOM, SCORR, SDOOR, SET_LIT_NOCHANGE, SINK, STAIRS, STONE,
    SVALL, S_LDWASHER, S_LPUDDING, S_LRING, THRONE, TREE, TREE_LOOTED, TREE_SWARM, T_LOOTED, VWALL,
    W_NONDIGGABLE, W_NONPASSWALL, struct_rm,
} from "./rm.h.js";
import {
    ACCESSIBLE, IS_DOOR, IS_DOORJOIN, IS_DRAWBRIDGE, IS_FURNITURE, IS_LAVA, IS_OBSTRUCTED, IS_POOL,
    IS_ROOM, IS_STWALL, IS_TREE, IS_WALL, MON_AT, SPACE_POS, fmon, fobj, levl, remove_monster,
} from "./rm.h.macros.js";
import {
    ANY_LOC, CUSTOM_INVENT, DEFAULT_INVENT, DRY, HOT, LVLINIT_MAZE, LVLINIT_MAZEGRID, LVLINIT_MINES,
    LVLINIT_NONE, LVLINIT_ROGUE, LVLINIT_SOLIDFILL, LVLINIT_SWAMP, MAP_Y_LIM, MAX_NESTED_ROOMS,
    NO_INVENT, NO_LOC_WARN, SOLID, SPACELOC, SP_COORD_IS_RANDOM, SP_OBJ_CONTAINER, SP_OBJ_CONTENT,
    WET, W_ANY, W_EAST, W_NORTH, W_RANDOM, W_SOUTH, W_WEST, altar, corridor, getloc_flags_t,
    lev_init, monster, object, region, room_door, spltrap, struct__room, struct_mapfragment,
    struct_sp_coder, terrain, unpacked_coord,
} from "./sp_lev.h.js";
import { SP_COORD_PACK, SP_COORD_PACK_RANDOM, SP_COORD_X, SP_COORD_Y } from "./sp_lev.h.macros.js";
import { MELT_ICE_AWAY } from "./timeout.h.js";
import {
    ANTI_MAGIC, ARROW_TRAP, BEAR_TRAP, DART_TRAP, FIRE_TRAP, HOLE, LANDMINE, LEVEL_TELEP,
    MAGIC_PORTAL, MAGIC_TRAP, NO_TRAP, PIT, POLY_TRAP, ROCKTRAP, ROLLING_BOULDER_TRAP, RUST_TRAP,
    SLP_GAS_TRAP, SPIKED_PIT, SQKY_BOARD, STATUE_TRAP, TELEP_TRAP, TRAPDOOR, TRAPNUM,
    VIBRATING_SQUARE, WEB,
} from "./trap.h.js";
import { is_hole, is_pit, undestroyable_trap } from "./trap.h.macros.js";
import { LS_MONSTER } from "./vision.h.js";
import { A_ORIGINAL } from "./you.h.js";
import { Race_if } from "./you.h.macros.js";
import { Protection_from_shape_changers, Punished } from "./youprop.h.macros.js";
import {
    char, int, ord, schar, short, sizeof, sizeof_string, uchar, unsigned,
} from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64, or64, or64u, shl64, shr64 } from "../rt/int64.js";
import {
    abs, free, memcpy, memset, sprintf, strcat, strchr, strcmp, strlen, strncmp,
} from "../rt/libc.js";
import {
    init_list, init_string, stack_array, stack_struct, stack_var, static_array, static_struct,
    static_var,
} from "../rt/locals.js";
import {
    luaL_checkinteger, luaL_checkoption, luaL_checktype, luaL_optinteger, luaL_setfuncs,
    lua_getfield, lua_gettable, lua_gettop, lua_isnumber, lua_len, lua_pushinteger, lua_setglobal,
    lua_type,
} from "../rt/lua.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, elt, fnptr_t, ptr_add, ptr_diff, ptr_to, ref_of, ref_to, struct,
    struct_assign, view_of,
} from "../rt/struct.js";
import { alloc, dupstr } from "./alloc.js";
import { artifact_exists } from "./artifact.js";
import { placebc, unplacebc } from "./ball.js";
import { describe_level } from "./botl.js";
import { isok, makemap_prepost } from "./cmd.js";
import { create_drawbridge, is_lava, is_pool } from "./dbridge.js";
import {
    cg, emptystr, gc, gd, gf, gi, gl, gm, gn, gr, gs, gt, gx, gy, iflags, svc, svd, sve, svi, svl,
    svm, svn, svr, u,
} from "./decl.js";
import { premap_detect } from "./detect.js";
import { bury_an_obj } from "./dig.js";
import { back_to_glyph, set_wall_state } from "./display.js";
import { christen_monst, lookup_novel, oname, safe_oname } from "./do_name.js";
import { def_char_to_monclass, def_char_to_objclass, defsyms } from "./drawing.js";
import {
    Can_dig_down, Can_fall_thru, In_W_tower, In_hell, In_mines, depth, induced_align, on_level,
} from "./dungeon.js";
import { panic } from "./end.js";
import { del_engr, del_engr_at, engr_at, make_engr_at, make_grave } from "./engrave.js";
import { makeroguerooms } from "./extralev.js";
import { in_rooms, monst_to_any } from "./hack.js";
import { eos, str_lines_maxlen, stripdigits, strncmpi, strstri, swapbits } from "./hacklib.js";
import { sobj_at, stackobj } from "./invent.js";
import { del_light_source, new_light_source } from "./light.js";
import { makemon, mkclass, propagate, set_malign, set_mimic_sym } from "./makemon.js";
import {
    add_door, add_room, add_subroom, clear_level_structures, count_level_features,
    level_finalize_topology, makecorridors, maybe_sdoor, mineralize, mkstairs, mktrap, okdoor,
    topologize,
} from "./mklev.js";
import { flood_fill_rm, litstate_rnd, mkmap } from "./mkmap.js";
import {
    create_maze, fix_wall_spines, fixup_special, get_level_extends, pick_vibrasquare_location,
    set_levltyp, set_levltyp_lit, walkfrom, wallification,
} from "./mkmaze.js";
import {
    add_to_container, bless, blessorcurse, curse, discard_minvent, mkgold, mkobj_at, mksobj_at,
    obj_extract_self, remove_object, rndmonnum, set_corpsenm, unbless, uncurse, weight,
} from "./mkobj.js";
import { fill_zoo, inside_room, somex, somexy, somey } from "./mkroom.js";
import { mgender_from_permonst, mongone, newcham, select_newcham_form, validvamp } from "./mon.js";
import { name_to_mon, name_to_monplus, poly_when_stoned, set_mon_data } from "./mondata.js";
import { mons } from "./monst.js";
import { mk_mplayer } from "./mplayer.js";
import { nhl_push_obj } from "./nhlobj.js";
import { l_selection_check, l_selection_push_copy } from "./nhlsel.js";
import {
    check_mapchr, get_table_boolean_opt, get_table_int, get_table_int_opt, get_table_mapchr,
    get_table_mapchr_opt, get_table_option, get_table_str, get_table_str_opt, lcheck_param_table,
    load_lua, nhl_add_table_entry_bool, nhl_add_table_entry_int, nhl_add_table_entry_region,
    nhl_add_table_entry_str, nhl_error, nhl_get_xy_params, nhl_pcall_handle, splev_chr2typ,
} from "./nhlua.js";
import { oinit } from "./o_init.js";
import { objects } from "./objects.js";
import { simpleonames } from "./objnam.js";
import { impossible } from "./pline.js";
import { mk_roamer, priestini } from "./priest.js";
import { get_rect, rnd_rect, split_rects } from "./rect.js";
import { create_gas_cloud, create_gas_cloud_selection } from "./region.js";
import { rn2, rnd } from "./rnd.js";
import {
    selection_clear, selection_clone, selection_do_grow, selection_floodfill, selection_free,
    selection_getbounds, selection_getpoint, selection_iterate, selection_new, selection_rndcoord,
    selection_setpoint, set_selection_floodfillchk,
} from "./selvar.js";
import { delete_contents, obfree } from "./shk.js";
import { stock_room } from "./shknam.js";
import { stairway_add } from "./stairs.js";
import { mdrop_special_objs, mpickobj } from "./steal.js";
import { can_saddle, place_monster, put_saddle_on_mon } from "./steed.js";
import { enexto } from "./teleport.js";
import { begin_burn } from "./timeout.js";
import { deltrap, maketrap, t_at } from "./trap.js";
import { block_point, does_block, vision_reset } from "./vision.js";
import { flip_worm_segs_horizontal, flip_worm_segs_vertical } from "./worm.js";
import { m_dowear } from "./worn.js";
const __FILE__ = "sp_lev.c";
