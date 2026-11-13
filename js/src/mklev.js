/* NetHack 5.0	mklev.c	$NHDT-Date: 1737387068 2025/01/20 07:31:08 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.194 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Alex Smith, 2017. */
/* NetHack may be freely redistributed.  See license for details. */

/* for UNIX, Rand #def'd to (long)lrand48() or (long)random() */
/* croom->lx etc are schar (width <= int), so % arith ensures that */
/* conversion of result to int is reasonable */

export function create_vault() { return create_room(-1, -1, 2, 2, -1, -1, VAULT, TRUE); }
export function init_vault() { return gv.vault_x = -1; }
export function do_vault() { return +(gv.vault_x != -1); }

/* Args must be (const genericptr) so that qsort will always be happy. */

function mkroom_cmp(vx, vy) { /* int QSORTCALLBACK */
    let x, y;

    x = view_of(struct_mkroom, vx);
    y = view_of(struct_mkroom, vy);
    if (x.lx < y.lx)
        return -1;
    return +(x.lx > y.lx);
}

/* is x,y a good location for a door into room? */
function good_rm_wall_doorpos(x, y, dir, room) { /* boolean */
    let tx, ty;
    let rmno;

    if (!isok(x, y) || !room.needjoining)
        return FALSE;

    if (!(levl()[x][y].typ == HWALL
          || levl()[x][y].typ == VWALL
          || IS_DOOR(levl()[x][y].typ)
          || levl()[x][y].typ == SDOOR))
        return FALSE;

    if (bydoor(x, y))
        return FALSE;

    tx = x + chars[xdir + dir];
    ty = y + chars[ydir + dir];

    if (!isok(tx,ty) || IS_OBSTRUCTED(levl()[tx][ty].typ))
        return FALSE;

    rmno = ptr_diff(room, svr.rooms[0]) + ROOMOFFSET;

    if (rmno != (levl()[tx][ty].roomno))
        return FALSE;

    return TRUE;
}

/* starting from x,y going towards dir, find a good location for a door */
function finddpos_shift(x, y, dir, aroom) { /* boolean */
    let dx, dy;

    dir = DIR_180(dir);

    dx = chars[xdir + dir];
    dy = chars[ydir + dir];

    if (good_rm_wall_doorpos(x[0], y[0], dir, aroom))
        return TRUE;

    /* irregular rooms may have the room wall away from the room rectangular
       area; go into the area until we encounter something */
    if (aroom.irregular) {
        let rx = x[0], ry = y[0];
        let fail = FALSE;

        while (!fail && isok(rx, ry)
               && (levl()[rx][ry].typ == STONE || levl()[rx][ry].typ == CORR)) {
            rx += dx;
            ry += dy;
            if (good_rm_wall_doorpos(rx, ry, dir, aroom)) {
                x[0] = rx;
                y[0] = ry;
                return TRUE;
            }
            if (!(levl()[rx][ry].typ == STONE || levl()[rx][ry].typ == CORR))
                fail = TRUE;
            if (rx < aroom.lx || rx > aroom.hx
                || ry < aroom.ly || ry > aroom.hy)
                fail = TRUE;
        }
    }
    return FALSE;
}

/* find a valid door position at room edge.
   dir is the preferred edge of the room.
   if found, returns TRUE and the coordinate in cc */
function finddpos(cc, dir, aroom) { /* boolean */
    const $frame = stack_frame(); try {
    var x = stack_var(coordxy), y = stack_var(coordxy);
    var x1, y1, x2, y2;
    var tryct = 0;

    switch (dir) {
    case DIR_N:
        x1 = aroom.lx;
        x2 = aroom.hx;
        y1 = aroom.ly - 1;
        y2 = aroom.ly - 1;
        break;
    case DIR_S:
        x1 = aroom.lx;
        x2 = aroom.hx;
        y1 = aroom.hy + 1;
        y2 = aroom.hy + 1;
        break;
    case DIR_W:
        x1 = aroom.lx - 1;
        x2 = aroom.lx - 1;
        y1 = aroom.ly;
        y2 = aroom.hy;
        break;
    case DIR_E:
        x1 = aroom.hx + 1;
        x2 = aroom.hx + 1;
        y1 = aroom.ly;
        y2 = aroom.hy;
        break;
    default:
        impossible(_("finddpos: illegal dir"));
        return FALSE;
    }

    /* try random points */
    gotit: { do {
        x[0] = (x2 - x1) ? rn1(x2 - x1 + 1, x1) : x1;
        y[0] = (y2 - y1) ? rn1(y2 - y1 + 1, y1) : y1;
        if (finddpos_shift(x, y, dir, aroom))
          break gotit;;
    } while (++tryct < 20);

    /* try all the points */
    for (x[0] = x1; x[0] <= x2; x[0]++)
        for (y[0] = y1; y[0] <= y2; y[0]++)
            if (finddpos_shift(x, y, dir, aroom))
                break gotit;;

    /* cannot find something reasonable -- strange */
    cc.x = x1;
    cc.y = y1;
    return FALSE;
 }
    cc.x = x[0];
    cc.y = y[0];
    return TRUE;
    } finally { stack_pop($frame); }
}

/* Sort rooms on the level so they're ordered from left to right on the map.
   makecorridors() by default links rooms N and N+1 */
export function sort_rooms() { /* void */
    const $frame = stack_frame(); try {
    let x, y;
    let i, ri = init_list(stack_array(unsigned, MAXNROFROOMS + 1), [ 0 ]), n = unsigned(svn.nroom);

    qsort(addr_of(svr.rooms[0]), n, sizeof(struct_mkroom), mkroom_cmp);

    /* Update the roomnos on the map */
    for (i = 0; i < n; i++)
        ri[svr.rooms[i].roomnoidx] = i;

    for (x = 1; x < COLNO; x++)
        for (y = 0; y < ROWNO; y++) {
            let rno = levl()[x][y].roomno;

            if (rno >= ROOMOFFSET && rno < MAXNROFROOMS + 1)
                levl()[x][y].roomno = unsigned(ri[unsigned(rno - ROOMOFFSET)] + ROOMOFFSET);
        }
    } finally { stack_pop($frame); }
}

function do_room_or_subroom(croom,
                   lowx, lowy, hix, hiy,
                   lit, rtype, special, is_room) { /* void */
    let x, y;
    let lev;

    /* locations might bump level edges in wall-less rooms */
    /* add/subtract 1 to allow for edge locations */
    if (!lowx)
        lowx++;
    if (!lowy)
        lowy++;
    if (hix >= COLNO - 1)
        hix = COLNO - 2;
    if (hiy >= ROWNO - 1)
        hiy = ROWNO - 2;

    if (lit) {
        for (x = lowx - 1; x <= hix + 1; x++) {
            lev = ptr_add(levl()[x][0], max(lowy - 1, 0));
            for (y = lowy - 1; y <= hiy + 1; y++)
                (lev = ptr_add(lev, 1), ptr_add(lev, -1)).lit = 1;
        }
        croom.rlit = 1;
    } else
        croom.rlit = 0;

    croom.roomnoidx = ptr_diff(croom, svr.rooms[0]);
    croom.lx = lowx;
    croom.hx = hix;
    croom.ly = lowy;
    croom.hy = hiy;
    croom.rtype = rtype;
    croom.doorct = 0;
    /* if we're not making a vault, gd.doorindex will still be 0
     * if we are, we'll have problems adding niches to the previous room
     * unless fdoor is at least gd.doorindex
     */
    croom.fdoor = gd.doorindex;
    croom.irregular = FALSE;

    croom.nsubrooms = 0;
    croom.sbrooms[0] = null;
    if (!special) {
        croom.needjoining = TRUE;
        for (x = lowx - 1; x <= hix + 1; x++)
            for (y = lowy - 1; y <= hiy + 1; y += (hiy - lowy + 2)) {
                levl()[x][y].typ = HWALL;
                levl()[x][y].horizontal = 1; /* For open/secret doors. */
            }
        for (x = lowx - 1; x <= hix + 1; x += (hix - lowx + 2))
            for (y = lowy; y <= hiy; y++) {
                levl()[x][y].typ = VWALL;
                levl()[x][y].horizontal = 0; /* For open/secret doors. */
            }
        for (x = lowx; x <= hix; x++) {
            lev = ptr_add(levl()[x][0], lowy);
            for (y = lowy; y <= hiy; y++)
                (lev = ptr_add(lev, 1), ptr_add(lev, -1)).typ = ROOM;
        }
        if (is_room) {
            levl()[lowx - 1][lowy - 1].typ = TLCORNER;
            levl()[hix + 1][lowy - 1].typ = TRCORNER;
            levl()[lowx - 1][hiy + 1].typ = BLCORNER;
            levl()[hix + 1][hiy + 1].typ = BRCORNER;
        } else { /* a subroom */
            wallification(lowx - 1, lowy - 1, hix + 1, hiy + 1);
        }
    }
}

export function add_room(lowx, lowy, hix, hiy,
         lit, rtype, special) { /* void */
    let croom;

    if (svn.nroom >= MAXNROFROOMS)
        panic(_("level has too many rooms"));

    croom = ptr_add(svr.rooms[0], svn.nroom);
    do_room_or_subroom(croom, lowx, lowy, hix, hiy, lit, rtype, special,
                       TRUE);
    croom = ptr_add(croom, 1);
    croom.hx = -1;
    svn.nroom++;
}

export function add_subroom(proom,
            lowx, lowy,
            hix, hiy,
            lit, rtype, special) { /* void */
    let croom;

    if (gn.nsubroom >= MAXNROFROOMS)
        panic(_("level has too many subrooms"));
    if (proom.nsubrooms >= MAX_SUBROOMS)
        panic(_("room has too many subrooms"));

    croom = ptr_add(gs.subrooms, gn.nsubroom);
    do_room_or_subroom(croom, lowx, lowy, hix, hiy, lit, rtype, special,
                       FALSE);
    proom.sbrooms[proom.nsubrooms++] = croom;
    croom = ptr_add(croom, 1);
    croom.hx = -1;
    gn.nsubroom++;
}

export function free_luathemes(theme_group) { /* void */
    let i;

    /*
     * Release which group(s)?
     *  tut_themes  => leaving tutorial, free tutorial themes only;
     *  most_themes => entering endgame, free non-endgame themes;
     *  all_themes  => end of game, free all themes.
     */
    for (i = 0; i < svn.n_dgns; ++i) {
        if ((theme_group == tut_themes && i != tutorial_dnum())
            || (theme_group == most_themes && i == astral_level().dnum))
            continue;
        if (gl.luathemes[i]) {
            nhl_done(view_of(struct_lua_State, gl.luathemes[i]));
            gl.luathemes[i] = null;
        }
    }
}

function makerooms() { /* void */
    const $frame = stack_frame(); try {
    let tried_vault = FALSE;
    let themeroom_tries = 0;
    let fname;
    let sbi = init_list(stack_struct(struct_nhl_sandbox_info), {flags: NHL_SB_SAFE, memlimit: 1*1024*1024, steps: 0, perpcall: 1*1024*1024});
    let themes = view_of(struct_lua_State, gl.luathemes[u.uz.dnum]);

    if (!themes && chars[(fname = svd.dungeons[u.uz.dnum].themerms)]) {
        if ((themes = nhl_init(sbi)) != null) {
            if (!nhl_loadlua(themes, fname)) {
                /* loading lua failed, don't use themed rooms */
                nhl_done(themes);
                themes = null;
            } else {
                /* success; save state for this dungeon branch */
                gl.luathemes[u.uz.dnum] = addr_of(themes);
                /* keep themes context, so not 'nhl_done(themes);' */
                iflags.in_lua = FALSE; /* can affect error messages */
            }
        }
        if (!themes) /* don't try again when making next level */
            chars[fname] = ord('\0'); /* svd.dungeons[u.uz.dnum].themerms */
    }

    if (themes) {
        create_des_coder();
        iflags.in_lua = gi.in_mk_themerooms = TRUE;
        gt.themeroom_failed = FALSE;
        lua_getglobal(themes, _("pre_themerooms_generate"));
        nhl_pcall_handle(themes, 0, 0, _("makerooms-1"), NHLpa_impossible);
        iflags.in_lua = gi.in_mk_themerooms = FALSE;
    }

    /* make rooms until satisfied */
    /* rnd_rect() will returns 0 if no more rects are available... */
    while (svn.nroom < (MAXNROFROOMS - 1) && rnd_rect()) {
        if (svn.nroom >= Math.trunc(MAXNROFROOMS / 6) && rn2(2) && !tried_vault) {
            tried_vault = TRUE;
            if (create_vault()) {
                gv.vault_x = svr.rooms[svn.nroom].lx;
                gv.vault_y = svr.rooms[svn.nroom].ly;
                svr.rooms[svn.nroom].hx = -1;
            }
        } else {
            if (themes) {
                iflags.in_lua = gi.in_mk_themerooms = TRUE;
                gt.themeroom_failed = FALSE;
                lua_getglobal(themes, _("themerooms_generate"));
                nhl_pcall_handle(themes, 0, 0, _("makerooms-2"), NHLpa_panic);
                iflags.in_lua = gi.in_mk_themerooms = FALSE;
                if (gt.themeroom_failed
                    && ((themeroom_tries++ > 10)
                        || (svn.nroom >= Math.trunc(MAXNROFROOMS / 6))))
                    break;
            } else {
                if (!create_room(-1, -1, -1, -1, -1, -1, OROOM, -1))
                    break;;
            }
        }
    }
    if (themes) {
        reset_xystart_size();
        iflags.in_lua = gi.in_mk_themerooms = TRUE;
        gt.themeroom_failed = FALSE;
        lua_getglobal(themes, _("post_themerooms_generate"));
        nhl_pcall_handle(themes, 0, 0, _("makerooms-3"), NHLpa_panic);
        iflags.in_lua = gi.in_mk_themerooms = FALSE;
    }
    } finally { stack_pop($frame); }
}

function join(a, b, nxcor) { /* void */
    const $frame = stack_frame(); try {
    let cc = stack_struct(struct_nhcoord), tt = stack_struct(struct_nhcoord), org = stack_struct(struct_nhcoord), dest = stack_struct(struct_nhcoord);
    let tx, ty, xx, yy;
    let croom, troom;
    let dx, dy;
    let npoints = stack_var(int);
    let dig_result;

    croom = svr.rooms[a];
    troom = svr.rooms[b];

    if (!croom.needjoining || !troom.needjoining)
        return;

    /* find positions cc and tt for doors in croom and troom
       and direction for a corridor between them */

    if (troom.hx < 0 || croom.hx < 0)
        return;
    if (troom.lx > croom.hx) {
        dx = 1;
        dy = 0;
        if (!finddpos(cc, DIR_E, croom))
            return;
        if (!finddpos(tt, DIR_W, troom))
            return;
    } else if (troom.hy < croom.ly) {
        dy = -1;
        dx = 0;
        if (!finddpos(cc, DIR_N, croom))
            return;
        if (!finddpos(tt, DIR_S, troom))
            return;
    } else if (troom.hx < croom.lx) {
        dx = -1;
        dy = 0;
        if (!finddpos(cc, DIR_W, croom))
            return;
        if (!finddpos(tt, DIR_E, troom))
            return;
    } else {
        dy = 1;
        dx = 0;
        if (!finddpos(cc, DIR_S, croom))
            return;
        if (!finddpos(tt, DIR_N, troom))
            return;
    }
    xx = cc.x;
    yy = cc.y;
    tx = tt.x - dx;
    ty = tt.y - dy;
    if (nxcor && levl()[xx + dx][yy + dy].typ != STONE)
        return;

    org.x = xx + dx;
    org.y = yy + dy;
    dest.x = tx;
    dest.y = ty;

    dig_result = dig_corridor(org, dest, npoints, nxcor,
                              svl.level.flags.arboreal ? ROOM : CORR, STONE);

    /* we created at least 1 tile of corridor, even if it failed */
    if ((npoints[0] > 0) && (okdoor(xx, yy) || !nxcor))
        dodoor(xx, yy, croom);

    if (!dig_result)
        return;

    /* we succeeded in digging the corridor */
    if (okdoor(tt.x, tt.y) || !nxcor)
        dodoor(tt.x, tt.y, troom);

    if (gs.smeq[a] < gs.smeq[b])
        gs.smeq[b] = gs.smeq[a];
    else
        gs.smeq[a] = gs.smeq[b];
    } finally { stack_pop($frame); }
}

/* create random corridors between rooms */
export function makecorridors() { /* void */
    let a, b, i;
    let any = TRUE;

    for (a = 0; a < svn.nroom - 1; a++) {
        join(a, a + 1, FALSE);
        if (!rn2(50))
            break; /* allow some randomness */
    }
    for (a = 0; a < svn.nroom - 2; a++)
        if (gs.smeq[a] != gs.smeq[a + 2])
            join(a, a + 2, FALSE);
    for (a = 0; any && a < svn.nroom; a++) {
        any = FALSE;
        for (b = 0; b < svn.nroom; b++)
            if (gs.smeq[a] != gs.smeq[b]) {
                join(a, b, FALSE);
                any = TRUE;
            }
    }
    /* add some extra corridors which may be blocked off */
    if (svn.nroom > 2)
        for (i = rn2(svn.nroom) + 4; i; i--) {
            a = rn2(svn.nroom);
            b = rn2(svn.nroom - 2);
            if (b >= a)
                b += 2;
            join(a, b, TRUE);
        }
}

/* (re)allocate space for svd.doors array */
function alloc_doors() { /* void */
    if (!svd.doors || gd.doorindex >= svd.doors_alloc) {
        let c = svd.doors_alloc + DOORINC;
        let doortmp = view_of(struct_nhcoord, addr_of(alloc(unsigned(Math.imul(unsigned(c), sizeof(struct_nhcoord))))));

        memset(addr_of(doortmp), 0, unsigned(Math.imul(unsigned(c), sizeof(struct_nhcoord))));
        if (svd.doors) {
            memcpy(addr_of(doortmp), addr_of(svd.doors),
                          unsigned(Math.imul(unsigned(svd.doors_alloc), sizeof(struct_nhcoord))));
            free(addr_of(svd.doors));
        }
        svd.doors = doortmp;
        svd.doors_alloc = c;
    }
}

export function add_door(x, y, aroom) { /* void */
    let broom;
    let tmp;
    let i;

    alloc_doors();

    if (aroom.doorct) {
        for (i = 0; i < aroom.doorct; i++) {
            tmp = aroom.fdoor + i;
            if (ptr_add(svd.doors, tmp).x == x && ptr_add(svd.doors, tmp).y == y)
                return;
        }
    }

    if (aroom.doorct == 0)
        aroom.fdoor = gd.doorindex;

    aroom.doorct++;

    for (tmp = gd.doorindex; tmp > aroom.fdoor; tmp--)
        struct_assign(ptr_add(svd.doors, tmp), ptr_add(svd.doors, tmp - 1));

    for (i = 0; i < svn.nroom; i++) {
        broom = svr.rooms[i];
        if (broom != aroom && broom.doorct && broom.fdoor >= aroom.fdoor)
            broom.fdoor++;
    }
    for (i = 0; i < gn.nsubroom; i++) {
        broom = ptr_add(gs.subrooms, i);
        if (broom != aroom && broom.doorct && broom.fdoor >= aroom.fdoor)
            broom.fdoor++;
    }

    gd.doorindex++;
    ptr_add(svd.doors, aroom.fdoor).x = x;
    ptr_add(svd.doors, aroom.fdoor).y = y;
}

function dosdoor(x, y, aroom, type) { /* void */
    let shdoor = chars[in_rooms(x, y, SHOPBASE)] ? TRUE : FALSE;

    if (!IS_WALL(levl()[x][y].typ)) /* avoid S.doors on already made doors */
        type = DOOR;
    levl()[x][y].typ = type;
    if (type == DOOR) {
        if (!rn2(3)) { /* is it a locked door, closed, or a doorway? */
            if (!rn2(5))
                levl()[x][y].flags = D_ISOPEN;
            else if (!rn2(6))
                levl()[x][y].flags = D_LOCKED;
            else
                levl()[x][y].flags = D_CLOSED;

            if (levl()[x][y].flags != D_ISOPEN && !shdoor
                && level_difficulty() >= 5 && !rn2(25))
                levl()[x][y].flags |= D_TRAPPED;
        } else {
            levl()[x][y].flags = (shdoor ? D_ISOPEN : D_NODOOR);
        }

        /* also done in roguecorr(); doing it here first prevents
           making mimics in place of trapped doors on rogue svl.level */
        if (Is_rogue_level(u.uz))
            levl()[x][y].flags = D_NODOOR;

        if (levl()[x][y].flags & D_TRAPPED) {
            let mtmp;

            if (level_difficulty() >= 9 && !rn2(5)
                && !((svm.mvitals[PM_SMALL_MIMIC].mvflags & G_GONE)
                     && (svm.mvitals[PM_LARGE_MIMIC].mvflags & G_GONE)
                     && (svm.mvitals[PM_GIANT_MIMIC].mvflags & G_GONE))) {
                /* make a mimic instead */
                levl()[x][y].flags = D_NODOOR;
                mtmp = makemon(mkclass(S_MIMIC, 0), x, y, NO_MM_FLAGS);
                if (mtmp)
                    set_mimic_sym(mtmp);
            }
        }
        /* newsym(x,y); */
    } else { /* SDOOR */
        if (shdoor || !rn2(5))
            levl()[x][y].flags = D_LOCKED;
        else
            levl()[x][y].flags = D_CLOSED;

        if (!shdoor && level_difficulty() >= 4 && !rn2(20))
            levl()[x][y].flags |= D_TRAPPED;
    }

    add_door(x, y, aroom);
}

/* is x,y location such that NEWS direction from it is inside aroom,
   excluding subrooms */
function cardinal_nextto_room(aroom, x, y) { /* boolean */
    let rmno = int((ptr_diff(aroom, svr.rooms[0]) + ROOMOFFSET));

    if (isok(x - 1, y) && !levl()[x - 1][y].edge
        && (levl()[x - 1][y].roomno) == rmno)
        return TRUE;
    if (isok(x + 1, y) && !levl()[x + 1][y].edge
        && (levl()[x + 1][y].roomno) == rmno)
        return TRUE;
    if (isok(x, y - 1) && !elt(levl()[x], y - 1).edge
        && (elt(levl()[x], y - 1).roomno) == rmno)
        return TRUE;
    if (isok(x, y + 1) && !levl()[x][y + 1].edge
        && (levl()[x][y + 1].roomno) == rmno)
        return TRUE;
    return FALSE;
}

function place_niche(
    aroom,
    dy,
    xx, yy) { /* boolean */
    const $frame = stack_frame(); try {
    let dd = stack_struct(struct_nhcoord);

    if (rn2(2)) {
        dy[0] = 1;
        if (!finddpos(dd, DIR_S, aroom))
            return FALSE;
    } else {
        dy[0] = -1;
        if (!finddpos(dd, DIR_N, aroom))
            return FALSE;
    }
    xx[0] = dd.x;
    yy[0] = dd.y;
    return ((isok(xx[0], yy[0] + dy[0])
                       && levl()[xx[0]][yy[0] + dy[0]].typ == STONE)
                      && (isok(xx[0], yy[0] - dy[0])
                          && !IS_POOL(levl()[xx[0]][yy[0] - dy[0]].typ)
                          && !IS_FURNITURE(levl()[xx[0]][yy[0] - dy[0]].typ))
                      && cardinal_nextto_room(aroom, xx[0], yy[0]) ? 1 : 0);
    } finally { stack_pop($frame); }
}

/* there should be one of these per trap, in the same order as trap.h */
const trap_engravings = static_array("trap_engravings", ptr_to(char), TRAPNUM, [
    0,      0,    0,    0, 0,
    0,      0,    0,    0, 0,
    0,      0,    0,    0,
    /* 14..16: trap door, teleport, level-teleport */
    _("Vlad was here"), _("ad aerarium"), _("ad aerarium"), 0, 0,
    0,      0,    0,    0, 0,
    /* 24..25 */
    0, 0,
]);

function makeniche(trap_type) { /* void */
    const $frame = stack_frame(); try {
    let aroom;
    let rm;
    let dy = stack_var(int), vct = 8;
    let xx = stack_var(coordxy), yy = stack_var(coordxy);
    let ttmp;

    while (vct--) {
        aroom = svr.rooms[rn2(svn.nroom)];
        if (aroom.rtype != OROOM)
            continue; /* not an ordinary room */
        if (aroom.doorct == 1 && rn2(5))
            continue;
        if (!place_niche(aroom, dy, xx, yy))
            continue;

        rm = levl()[xx[0]][yy[0] + dy[0]];
        if (trap_type || !rn2(4)) {
            rm.typ = SCORR;
            if (trap_type) {
                if (is_hole(trap_type) && !Can_fall_thru(u.uz))
                    trap_type = ROCKTRAP;
                ttmp = maketrap(xx[0], yy[0] + dy[0], trap_type);
                if (ttmp) {
                    if (trap_type != ROCKTRAP)
                        ttmp.once = 1;
                    if (trap_engravings[trap_type]) {
                        make_engr_at(xx[0], yy[0] - dy[0],
                                     trap_engravings[trap_type], 0, 0,
                                     DUST);
                        wipe_engr_at(xx[0], yy[0] - dy[0], 5,
                                     FALSE); /* age it a little */
                    }
                }
            }
            dosdoor(xx[0], yy[0], aroom, SDOOR);
        } else {
            rm.typ = CORR;
            if (rn2(7)) {
                dosdoor(xx[0], yy[0], aroom, rn2(5) ? SDOOR : DOOR);
            } else {
                /* inaccessible niches occasionally have iron bars */
                if (!rn2(5) && IS_WALL(levl()[xx[0]][yy[0]].typ)) {
                    set_levltyp(xx[0], yy[0], IRONBARS);
                    if (rn2(3))
                        mkcorpstat(CORPSE, null,
                                          mkclass(S_HUMAN, 0), xx[0],
                                          yy[0] + dy[0], TRUE);
                }
                if (!svl.level.flags.noteleport)
                    mksobj_at(SCR_TELEPORTATION, xx[0], yy[0] + dy[0], TRUE,
                                     FALSE);
                if (!rn2(3))
                    mkobj_at(RANDOM_CLASS, xx[0], yy[0] + dy[0], TRUE);
            }
        }
        return;
    }
    } finally { stack_pop($frame); }
}

function make_niches() { /* void */
    let ct = rnd((svn.nroom >> 1) + 1), dep = depth(u.uz);
    let ltptr = +(!svl.level.flags.noteleport && dep > 15),
            vamp = +(dep > 5 && dep < 25);

    while (ct--) {
        if (ltptr && !rn2(6)) {
            ltptr = FALSE;
            makeniche(LEVEL_TELEP);
        } else if (vamp && !rn2(6)) {
            vamp = FALSE;
            makeniche(TRAPDOOR);
        } else
            makeniche(NO_TRAP);
    }
}

function makevtele() { /* void */
    makeniche(TELEP_TRAP);
}

/* count the tracked features (sinks, fountains) present on the level */
export function count_level_features() { /* void */
    let x, y;

    svl.level.flags.nfountains = svl.level.flags.nsinks = 0;
    for (y = 0; y < ROWNO; y++)
        for (x = 1; x < COLNO; x++) {
            let typ = levl()[x][y].typ;

            if (typ == FOUNTAIN)
                svl.level.flags.nfountains++;
            else if (typ == SINK)
                svl.level.flags.nsinks++;
        }
}

/* clear out various globals that keep information on the current level.
 * some of this is only necessary for some types of levels (maze, normal,
 * special) but it's easier to put it all in one place than make sure
 * each type initializes what it needs to separately.
 */
export function clear_level_structures() { /* void */
    let zerorm = static_struct("clear_level_structures.zerorm", struct_rm, { glyph: GLYPH_UNEXPLORED,
                                typ: 0, seenv: 0, flags: 0, horizontal: 0, lit: 0, waslit: 0, roomno: 0, edge: 0, candig: 0 });
    let x, y;
    let lev;

    /* note:  normally we'd start at x=1 because map column #0 isn't used
       (except for placing vault guard at <0,0> when removed from the map
       but not from the level); explicitly reset column #0 along with the
       rest so that we start the new level with a completely clean slate */
    for (x = 0; x < COLNO; x++) {
        lev = ptr_add(levl()[x][0], 0);
        for (y = 0; y < ROWNO; y++) {
            struct_assign((lev = ptr_add(lev, 1), ptr_add(lev, -1)), zerorm);
            svl.level.objects[x][y] = null;
            svl.level.monsters[x][y] = null;
        }
    }
    svl.level.objlist = null;
    svl.level.buriedobjlist = null;
    svl.level.monlist = null;
    svl.level.damagelist = null;
    svl.level.bonesinfo = null;

    svl.level.flags.nfountains = 0;
    svl.level.flags.nsinks = 0;
    svl.level.flags.has_shop = 0;
    svl.level.flags.has_vault = 0;
    svl.level.flags.has_zoo = 0;
    svl.level.flags.has_court = 0;
    svl.level.flags.has_morgue = svl.level.flags.graveyard = 0;
    svl.level.flags.has_beehive = 0;
    svl.level.flags.has_barracks = 0;
    svl.level.flags.has_temple = 0;
    svl.level.flags.has_swamp = 0;
    svl.level.flags.noteleport = 0;
    svl.level.flags.hardfloor = 0;
    svl.level.flags.nommap = 0;
    svl.level.flags.hero_memory = 1;
    svl.level.flags.shortsighted = 0;
    svl.level.flags.sokoban_rules = 0;
    svl.level.flags.is_maze_lev = 0;
    svl.level.flags.is_cavernous_lev = 0;
    svl.level.flags.arboreal = 0;
    svl.level.flags.has_town = 0;
    svl.level.flags.wizard_bones = 0;
    svl.level.flags.corrmaze = 0;
    svl.level.flags.temperature = In_hell(u.uz) ? 1 : 0;
    svl.level.flags.rndmongen = 1;
    svl.level.flags.deathdrops = 1;
    svl.level.flags.noautosearch = 0;
    svl.level.flags.fumaroles = 0;
    svl.level.flags.stormy = 0;
    svl.level.flags.stasis_until = 0;

    svn.nroom = 0;
    svr.rooms[0].hx = -1;
    gn.nsubroom = 0;
    ptr_add(gs.subrooms, 0).hx = -1;
    gd.doorindex = 0;
    if (svd.doors_alloc) {
        free(addr_of(svd.doors));
        svd.doors = null;
        svd.doors_alloc = 0;
    }
    init_rect();
    init_vault();
    stairway_free_all();
    gm.made_branch = FALSE;
    clear_regions();
    free_exclusions();
    reset_xystart_size();
    if (gl.lev_message) {
        free(gl.lev_message);
        gl.lev_message = 0;
    }
}

export function ROOM_IS_FILLABLE(croom) { return +((croom.rtype == OROOM || croom.rtype == THEMEROOM)
     && croom.needfill == FILL_NORMAL); }

/* Fill a "random" room (i.e. a typical non-special room in the Dungeons of
   Doom) with random monsters, objects, and dungeon features.

   If bonus_items is TRUE, there may be an additional special item
   generated, depending on depth. */
function fill_ordinary_room(
    croom,
    bonus_items) { /* void */
    const $frame = stack_frame(); try {
    var trycnt = 0;
    var pos = stack_struct(struct_nhcoord);
    var tmonst; /* always put a web with a spider */
    var x, y;
    var skip_chests = FALSE;

    if (croom.rtype != OROOM && croom.rtype != THEMEROOM)
        return;

    /* If there are subrooms, fill them now - we don't want an outer room
     * that's specified to be unfilled to block an inner subroom that's
     * specified to be filled. */
    for (x = 0; x < croom.nsubrooms; ++x) {
        var subroom = croom.sbrooms[x];

        if (!subroom) {
            impossible(_("fill_ordinary_room: Null subroom"));
            return;
        }
        fill_ordinary_room(subroom, FALSE);
    }

    if (croom.needfill != FILL_NORMAL)
        return;

    /* put a sleeping monster inside */
    /* Note: monster may be on the stairs. This cannot be
       avoided: maybe the player fell through a trap door
       while a monster was on the stairs. Conclusion:
       we have to check for monsters on the stairs anyway. */

    if ((u.uhave.amulet || !rn2(3)) && somexyspace(croom, pos)) {
        tmonst = makemon(null, pos.x, pos.y, MM_NOGRP);
        if (tmonst && tmonst.data == mons[PM_GIANT_SPIDER]
            && !occupied(pos.x, pos.y))
            maketrap(pos.x, pos.y, WEB);
    }
    /* put traps and mimics inside */
    x = 8 - Math.trunc(level_difficulty() / 6);
    if (x <= 1)
        x = 2;
    while (!rn2(x) && (++trycnt < 1000))
        mktrap(0, MKTRAP_NOFLAGS, croom, null);
    if (!rn2(3) && somexyspace(croom, pos))
        mkgold(0, pos.x, pos.y);
    skip_nonrogue: { if (Is_rogue_level(u.uz))
        break skip_nonrogue;;
    if (!rn2(10))
        mkfount(croom);
    if (!rn2(60))
        mksink(croom);
    if (!rn2(60))
        mkaltar(croom);
    x = 80 - (depth(u.uz) * 2);
    if (x < 2)
        x = 2;
    if (!rn2(x))
        mkgrave(croom);

    /* put statues inside */
    if (!rn2(20) && somexyspace(croom, pos))
        mkcorpstat(STATUE, null,
                            null, pos.x,
                            pos.y, CORPSTAT_INIT);

    /*
     * bonus_items means that this is the room where the bonus item
     * should be placed, if there is one; but there might not be a
     * bonus item on any given level.
     *
     * Bonus items are currently as follows:
     * a) on the Mines branch level, 100% chance of a fairly filling
     *    comestible;
     * b) on other levels above the Oracle, 2/3 chance of a "supply
     *    chest" that contains an early-game survivability item
     *    (there are therefore more of these when Sokoban is deep,
     *    which is intentional as those games are harder).
     * This mechanism could be expanded in the future to place
     * near-guaranteed items on particular levels (but, it is possible
     * that no room will be given a bonus item if there is no suitable
     * room to place it in, so it should not be used for plot-critical
     * items).
     */
    if (bonus_items && somexyspace(croom, pos)) {
        var uz_branch = Is_branchlev(u.uz);

        if (uz_branch && u.uz.dnum != mines_dnum()
            && (uz_branch.end1.dnum == mines_dnum()
                || uz_branch.end2.dnum == mines_dnum())) {
            mksobj_at((rn2(5) < 3) ? FOOD_RATION
                             : rn2(2) ? CRAM_RATION
                               : LEMBAS_WAFER,
                             pos.x, pos.y, TRUE, FALSE);
        } else if (u.uz.dnum == oracle_level().dnum
                   && u.uz.dlevel < oracle_level().dlevel && rn2(3)) {
            var otmp;
            var otyp, tryct = 0;
            var cursed;
            /* reverse probabilities compared to non-supply chests;
               these are twice as likely to be chests than large
               boxes, rather than vice versa */
            var supply_chest = mksobj_at(rn2(3) ? CHEST : LARGE_BOX,
                                                 pos.x, pos.y, FALSE, FALSE);

            supply_chest.olocked = +!!rn2(6);

            do {
                var supply_items = static_array("fill_ordinary_room.supply_items", int, null, [
                    POT_EXTRA_HEALING,
                    POT_SPEED,
                    POT_GAIN_ENERGY,
                    SCR_ENCHANT_WEAPON,
                    SCR_ENCHANT_ARMOR,
                    SCR_CONFUSE_MONSTER,
                    SCR_SCARE_MONSTER,
                    WAN_DIGGING,
                    SPE_HEALING,
                ]);

                /* 50% this is a potion of healing */
                otyp = rn2(2) ? POT_HEALING : ROLL_FROM(supply_items);
                otmp = mksobj(otyp, TRUE, FALSE);
                if (otyp == POT_HEALING && rn2(2)) {
                    otmp.quan = 2;
                    otmp.owt = unsigned(weight(otmp));
                }
                cursed = otmp.cursed;
                add_to_container(supply_chest, otmp); /* owt updated below */

                ++tryct;
                if (tryct == 50) {
                    impossible(_("couldn't generate supply chest item"));
                    break;
                }
                /* guarantee at least one noncursed item, with a small
                   probability of more; if we generate a cursed item, it's
                   added to the supply chest but we reroll for a noncursed
                   item and add that too */
            } while (cursed || !rn2(5));

            /* maybe put a random item into the supply chest, biased
               slightly towards low-level spellbooks; avoid tools
               because chests don't fit into other chests */
            if (rn2(3)) {
                var extra_classes = static_array("fill_ordinary_room.extra_classes", int, null, [
                    FOOD_CLASS,
                    WEAPON_CLASS,
                    ARMOR_CLASS,
                    GEM_CLASS,
                    SCROLL_CLASS,
                    POTION_CLASS,
                    RING_CLASS,
                    SPBOOK_no_NOVEL,
                    SPBOOK_no_NOVEL,
                    SPBOOK_no_NOVEL
                ]);
                var oclass = ROLL_FROM(extra_classes);

                otmp = mkobj(oclass, FALSE);
                if (oclass == SPBOOK_no_NOVEL) {
                    var pass, maxpass = (depth(u.uz) > 2) ? 2 : 3;

                    /* bias towards lower level by generating again
                       and taking the lower-level book; do that three
                       times if on level 1 or 2, twice when deeper */
                    for (pass = 1; pass <= maxpass; ++pass) {
                        var otmp2 = mkobj(oclass, FALSE);

                        if (objects[otmp.otyp].oc_oc2
                            <= objects[otmp2.otyp].oc_oc2) {
                            dealloc_obj(otmp2);
                        } else {
                            dealloc_obj(otmp);
                            otmp = otmp2;
                        }
                    }
                }
                add_to_container(supply_chest, otmp); /* owt updated below */
            }

            /* add_to_container() doesn't update the container's weight */
            supply_chest.owt = unsigned(weight(supply_chest));

            skip_chests = TRUE; /* don't want a second chest in this room */
        }
    }

    /* put box/chest inside;
     *  40% chance for at least 1 box, regardless of number
     *  of rooms; about 5 - 7.5% for 2 boxes, least likely
     *  when few rooms; chance for 3 or more is negligible.
     */
    /*assert(svn.nroom > 0); // must be true because we're filling a room*/
    if (!skip_chests && !rn2(Math.trunc(svn.nroom * 5 / 2)) && somexyspace(croom, pos))
        mksobj_at(rn2(3) ? LARGE_BOX : CHEST,
                         pos.x, pos.y, TRUE, FALSE);

    /* maybe make some graffiti */
    if (!rn2(27 + 3 * abs(depth(u.uz)))) {
        var buf = stack_array(char, BUFSZ), pristinebuf = stack_array(char, BUFSZ);
        var mesg = random_engraving(buf, pristinebuf);

        if (mesg) {
            do {
                somexyspace(croom, pos);
                x = pos.x;
                y = pos.y;
            } while (levl()[x][y].typ != ROOM && !rn2(40));
            if (levl()[x][y].typ == ROOM)
                make_engr_at(x, y, mesg, pristinebuf, 0, MARK);
        }
    }
 }
    if (!rn2(3) && somexyspace(croom, pos)) {
        mkobj_at(RANDOM_CLASS, pos.x, pos.y, TRUE);
        trycnt = 0;
        while (!rn2(5)) {
            if (++trycnt > 100) {
                impossible(_("trycnt overflow4"));
                break;
            }
            if (somexyspace(croom, pos)) {
                mkobj_at(RANDOM_CLASS, pos.x, pos.y, TRUE);
            }
        }
    }
    } finally { stack_pop($frame); }
}

function themerooms_post_level_generate() { /* void */
    let themes = view_of(struct_lua_State, gl.luathemes[u.uz.dnum]);

     /* themes should already be loaded by makerooms();
      * if not, we don't run this either */
    if (!themes)
        return;

    reset_xystart_size();
    iflags.in_lua = gi.in_mk_themerooms = TRUE;
    gt.themeroom_failed = FALSE;
    lua_getglobal(themes, _("post_level_generate"));
    nhl_pcall_handle(themes, 0, 0, _("post_level_generate"), NHLpa_panic);
    iflags.in_lua = gi.in_mk_themerooms = FALSE;

    wallification(1, 0, COLNO - 1, ROWNO - 1);
    if (gc.coder)
        free(addr_of(gc.coder)), gc.coder = null;
    lua_gc(themes, LUA_GCCOLLECT);
}

/* if x,y is door, does it open into solid terrain */
function chk_okdoor(x, y) { /* boolean */
    if (IS_DOOR(levl()[x][y].typ)) {
        if (levl()[x][y].horizontal) {
            if ((isok(x, y-1) && (elt(levl()[x], y-1).typ > TREE))
                && (isok(x, y+1) && (levl()[x][y+1].typ <= TREE)))
                return FALSE;
            if ((isok(x, y-1) && (elt(levl()[x], y-1).typ <= TREE))
                && (isok(x, y+1) && (levl()[x][y+1].typ > TREE)))
                return FALSE;
        } else {
            if ((isok(x-1, y) && (levl()[x-1][y].typ > TREE))
                && (isok(x+1, y) && (levl()[x+1][y].typ <= TREE)))
                return FALSE;
            if ((isok(x-1, y) && (levl()[x-1][y].typ <= TREE))
                && (isok(x+1, y) && (levl()[x+1][y].typ > TREE)))
                return FALSE;
        }
        return TRUE;
    }
    return TRUE;
}

/* check mklev created level sanity */
function mklev_sanity_check() { /* void */
    let x, y;
    let i;
    let rmno = -1;

    if (!(iflags.sanity_check || iflags.debug_fuzzer))
        return;

    for (y = 0; y < ROWNO; y++) {
        for (x = 1; x < COLNO; x++) {
            if (!chk_okdoor(x,y))
                impossible(_("levl[%i][%i] door not ok"), x, y);
        }
    }

    for (i = 0; i < svn.nroom; i++) {
        if (!svr.rooms[i].needjoining)
            continue;
        if (rmno == -1)
            rmno = gs.smeq[i];
        if (rmno != -1 && gs.smeq[i] != rmno)
            impossible(_("room %i not connected?"), i);
    }
}

function makelevel() { /* void */
    const $frame = stack_frame(); try {
    let $goto = null; var fillname = stack_array(char, 9), w = stack_var(coordxy), h = stack_var(coordxy);
    var croom;
    var branchp;
    var prevstairs;
    var room_threshold;
    var slev;
    var i;

    if (wiz1_level().dlevel == 0) {
        impossible(_("makelevel() called when dungeon not yet initialized."));
        init_dungeons();
    }
    oinit(); /* assign level dependent obj probabilities */
    clear_level_structures();

    slev = Is_special(u.uz);
    /* check for special levels */
    if (slev && !Is_rogue_level(u.uz)) {
        makemaz(slev.proto);
    } else if (chars[svd.dungeons[u.uz.dnum].proto + 0]) {
        makemaz(_(""));
    } else if (chars[svd.dungeons[u.uz.dnum].fill_lvl + 0]) {
        makemaz(svd.dungeons[u.uz.dnum].fill_lvl);
    } else if (In_quest(u.uz)) {
        var loc_lev;

        sprintf(fillname, _("%s-loca"), gu.urole.filecode);
        loc_lev = find_level(fillname);

        sprintf(fillname, _("%s-fil"), gu.urole.filecode);
        strcat(fillname, (u.uz.dlevel < loc_lev.dlevel.dlevel) ? _("a") : _("b"))
;
        makemaz(fillname);
    } else if (In_hell(u.uz)
                || (rn2(5) && u.uz.dnum == medusa_level().dnum
                    && depth(u.uz) > depth(svd.dungeon_topology.d_medusa_level))) {
        makemaz(_(""));
    } else {
        /* otherwise, fall through - it's a "regular" level. */
        var u_depth = depth(u.uz);

        if (Is_rogue_level(u.uz)) {
            makeroguerooms();
            makerogueghost();
        } else {
            makerooms();
        }
        assert(svn.nroom > 0);
        sort_rooms();

        generate_stairs(); /* up and down stairs */

        branchp = Is_branchlev(u.uz);    /* possible dungeon branch */
        room_threshold = branchp ? 4 : 3; /* minimum number of rooms needed
                                            to allow a random special room */
        skip0: { if (Is_rogue_level(u.uz))
            break skip0;;
        makecorridors();
        make_niches();

        mklev_sanity_check();

        /* make a secret treasure vault, not connected to the rest */
        if (do_vault()) {
            debugpline0(_("trying to make a vault..."), __FILE__);
            w[0] = 1;
            h[0] = 1;
            $goto_fill_vault: for (;;) { switch ($goto) { default: case "fill_vault": if ($goto || (check_room(ref_of(gv, "vault_x"), w, ref_of(gv, "vault_y"), h, TRUE))) {
 $goto = null;
                add_room(gv.vault_x, gv.vault_y,
                         gv.vault_x + w[0], gv.vault_y + h[0],
                         TRUE, VAULT, FALSE);
                svl.level.flags.has_vault = 1;
                ++room_threshold;
                elt(svr.rooms, svn.nroom - 1).needfill = FILL_NORMAL;
                fill_special_room(elt(svr.rooms, svn.nroom - 1));
                mk_knox_portal(gv.vault_x + w[0], gv.vault_y + h[0]);
                if (!svl.level.flags.noteleport && !rn2(3))
                    makevtele();
            } else if (rnd_rect() && create_vault()) {
                gv.vault_x = svr.rooms[svn.nroom].lx;
                gv.vault_y = svr.rooms[svn.nroom].ly;
                if (check_room(ref_of(gv, "vault_x"), w, ref_of(gv, "vault_y"), h, TRUE))
                    { $goto = "fill_vault"; continue $goto_fill_vault; }
                else
                    svr.rooms[svn.nroom].hx = -1;
            } } break; }
        }

        /* make up to 1 special room, with type dependent on depth;
           note that mkroom doesn't guarantee a room gets created, and that
           this step only sets the room's rtype - it doesn't fill it yet. */
        if (wizard() && nh_getenv(_("SHOPTYPE")))
            do_mkroom(SHOPBASE);
        else if (u_depth > 1 && u_depth < depth(svd.dungeon_topology.d_medusa_level)
                 && svn.nroom >= room_threshold && rn2(u_depth) < 3)
            do_mkroom(SHOPBASE);
        else if (u_depth > 4 && !rn2(6))
            do_mkroom(COURT);
        else if (u_depth > 5 && !rn2(8)
                 && !(svm.mvitals[PM_LEPRECHAUN].mvflags & G_GONE))
            do_mkroom(LEPREHALL);
        else if (u_depth > 6 && !rn2(7))
            do_mkroom(ZOO);
        else if (u_depth > 8 && !rn2(5))
            do_mkroom(TEMPLE);
        else if (u_depth > 9 && !rn2(5)
                 && !(svm.mvitals[PM_KILLER_BEE].mvflags & G_GONE))
            do_mkroom(BEEHIVE);
        else if (u_depth > 11 && !rn2(6))
            do_mkroom(MORGUE);
        else if (u_depth > 12 && !rn2(8) && antholemon())
            do_mkroom(ANTHOLE);
        else if (u_depth > 14 && !rn2(4)
                 && !(svm.mvitals[PM_SOLDIER].mvflags & G_GONE))
            do_mkroom(BARRACKS);
        else if (u_depth > 15 && !rn2(6))
            do_mkroom(SWAMP);
        else if (u_depth > 16 && !rn2(8)
                 && !(svm.mvitals[PM_COCKATRICE].mvflags & G_GONE))
            do_mkroom(COCKNEST);
 }
        prevstairs = gs.stairs; /* used to test for place_branch() success */
        /* Place multi-dungeon branch. */
        place_branch(branchp, 0, 0);

        /* for main dungeon level 1, the stairs up where the hero starts
           are branch stairs; treat them as if hero had just come down
           them by marking them as having been traversed; most recently
           created stairway is held in 'gs.stairs' */
        if (u.uz.dnum == 0 && u.uz.dlevel == 1 && gs.stairs != prevstairs)
            gs.stairs.u_traversed = TRUE;

        /* some levels have specially generated items in ordinary
           rooms (intended to be indistinguishable from the normally
           generated items); work out which room these will be placed in */
        var fillable_room_count = 0;
        for (croom = svr.rooms[0]; croom.hx > 0; croom = ptr_add(croom, 1)) {
            if (ROOM_IS_FILLABLE(croom))
                fillable_room_count++;
        }
        /* choose a random fillable room to be the one that gets the
           bonus items, if there are any; if there aren't any we don't
           generate the bonus items (but levels with no fillable rooms
           typically don't have any bonus items to generate anyway) */
        var bonus_item_room_countdown = fillable_room_count
                                        ? rn2(fillable_room_count) : -1;

        /* for each room: put things inside */
        for (croom = svr.rooms[0]; croom.hx > 0; croom = ptr_add(croom, 1)) {
            var fillable = ROOM_IS_FILLABLE(croom);

            fill_ordinary_room(croom,
                               (fillable && bonus_item_room_countdown == 0 ? 1 : 0));
            if (fillable)
                --bonus_item_room_countdown;
        }
    }
    /* Fill all special rooms now, regardless of whether this is a special
     * level, proto level, or ordinary level. */
    for (i = 0; i < svn.nroom; ++i) {
        fill_special_room(svr.rooms[i]);
    }

    themerooms_post_level_generate();

    if (gl.luacore && nhcb_counts[NHCB_LVL_ENTER]) {
        lua_getglobal(view_of(struct_lua_State, gl.luacore), _("nh_callback_run"));
        lua_pushstring(view_of(struct_lua_State, gl.luacore), nhcb_name[NHCB_LVL_ENTER]);
        nhl_pcall_handle(view_of(struct_lua_State, gl.luacore), 1, 0, _("makelevel"), NHLpa_panic);
        lua_settop(view_of(struct_lua_State, gl.luacore), 0);
    }
    } finally { stack_pop($frame); }
}

/* return TRUE if water location at (x,y) should have kelp. */
function water_has_kelp(x, y, kelp_pool, kelp_moat) { /* boolean */
    if ((kelp_pool && (levl()[x][y].typ == POOL
                       || (levl()[x][y].typ == WATER && !Is_waterlevel(u.uz)))
         && !rn2(kelp_pool))
        || (kelp_moat && levl()[x][y].typ == MOAT && !rn2(kelp_moat)))
        return TRUE;
    return FALSE;
}

/*
 *      Place deposits of minerals (gold and misc gems) in the stone
 *      surrounding the rooms on the map.
 *      Also place kelp in water.
 *      mineralize(-1, -1, -1, -1, FALSE); => "default" behavior
 */
export function mineralize(kelp_pool, kelp_moat, goldprob, gemprob,
           skip_lvl_checks) { /* void */
    let sp;
    let otmp;
    let x, y;
    let cnt;

    if (kelp_pool < 0)
        kelp_pool = 10;
    if (kelp_moat < 0)
        kelp_moat = 30;

    /* Place kelp, except on the plane of water */
    if (!skip_lvl_checks && In_endgame(u.uz))
        return;
    for (x = 2; x < (COLNO - 2); x++)
        for (y = 1; y < (ROWNO - 1); y++)
            if (water_has_kelp(x, y, kelp_pool, kelp_moat))
                mksobj_at(KELP_FROND, x, y, TRUE, FALSE);

    /* determine if it is even allowed;
       almost all special levels are excluded */
    if (!skip_lvl_checks
        && (In_hell(u.uz) || In_V_tower(u.uz) || Is_rogue_level(u.uz)
            || svl.level.flags.arboreal
            || ((sp = Is_special(u.uz)) != null && !Is_oracle_level(u.uz)
                && (!In_mines(u.uz) || sp.flags.town))))
        return;

    /* basic level-related probabilities */
    if (goldprob < 0)
        goldprob = 20 + Math.trunc(depth(u.uz) / 3);
    if (gemprob < 0)
        gemprob = Math.trunc(goldprob / 4);

    /* mines have ***MORE*** goodies - otherwise why mine? */
    if (!skip_lvl_checks) {
        if (In_mines(u.uz)) {
            goldprob *= 2;
            gemprob *= 3;
        } else if (In_quest(u.uz)) {
            goldprob = Math.trunc(goldprob / 4);
            gemprob = Math.trunc(gemprob / 6);
        }
    }

    /*
     * Seed rock areas with gold and/or gems.
     * We use fairly low level object handling to avoid unnecessary
     * overhead from placing things in the floor chain prior to burial.
     */
    for (x = 2; x < (COLNO - 2); x++)
        for (y = 1; y < (ROWNO - 1); y++)
            if (levl()[x][y + 1].typ != STONE) { /* <x,y> spot not eligible */
                y += 2; /* next two spots aren't eligible either */
            } else if (levl()[x][y].typ != STONE) { /* this spot not eligible */
                y += 1; /* next spot isn't eligible either */
            } else if (!(levl()[x][y].flags & W_NONDIGGABLE)
                       && levl()[x][y - 1].typ == STONE
                       && levl()[x + 1][y - 1].typ == STONE
                       && levl()[x - 1][y - 1].typ == STONE
                       && levl()[x + 1][y].typ == STONE
                       && levl()[x - 1][y].typ == STONE
                       && levl()[x + 1][y + 1].typ == STONE
                       && levl()[x - 1][y + 1].typ == STONE) {
                if (rn2(1000) < goldprob) {
                    if ((otmp = mksobj(GOLD_PIECE, FALSE, FALSE)) != null) {
                        otmp.ox = x, otmp.oy = y;
                        otmp.quan = 1 + rnd(goldprob * 3);
                        otmp.owt = unsigned(weight(otmp));
                        if (!rn2(3))
                            add_to_buried(otmp);
                        else
                            place_object(otmp, x, y);
                    }
                }
                if (rn2(1000) < gemprob) {
                    for (cnt = rnd(2 + Math.trunc(dunlev(u.uz) / 3)); cnt > 0; cnt--)
                        if ((otmp = mkobj(GEM_CLASS, FALSE)) != null) {
                            if (otmp.otyp == ROCK) {
                                dealloc_obj(otmp); /* discard it */
                            } else {
                                otmp.ox = x, otmp.oy = y;
                                if (!rn2(3))
                                    add_to_buried(otmp);
                                else
                                    place_object(otmp, x, y);
                            }
                        }
                }
            }
}

export function level_finalize_topology() { /* void */
    let croom;
    let ridx;

    bound_digging();
    mineralize(-1, -1, -1, -1, FALSE);
    gi.in_mklev = FALSE;
    /* avoid coordinates in future lua-loads for this level being thrown off
     * because xstart and ystart aren't saved with the level and will be 0
     * after leaving and returning */
    gx.xstart = gy.ystart = 0;
    /* has_morgue gets cleared once morgue is entered; graveyard stays
       set (graveyard might already be set even when has_morgue is clear
       [see fixup_special()], so don't update it unconditionally) */
    if (svl.level.flags.has_morgue)
        svl.level.flags.graveyard = 1;
    if (!svl.level.flags.is_maze_lev) {
        for (croom = ptr_add(svr.rooms[0], 0); croom != svr.rooms[svn.nroom]; croom = ptr_add(croom, 1))

            topologize(croom);
    }
    set_wall_state();
    /* for many room types, svr.rooms[].rtype is zeroed once the room has been
       entered; svr.rooms[].orig_rtype always retains original rtype value */
    for (ridx = 0; ridx < SIZE(svr.rooms); ridx++)
        svr.rooms[ridx].orig_rtype = svr.rooms[ridx].rtype;
}

export function mklev() { /* void */
    reseed_random(rn2);
    reseed_random(rn2_on_display_rng);

    init_mapseen(u.uz);
    if (getbones())
        return;

    gi.in_mklev = TRUE;
    makelevel();

    level_finalize_topology();

    reseed_random(rn2);
    reseed_random(rn2_on_display_rng);
}

export function topologize(croom) { /* void */
    let x, y;
    let roomno = int((ptr_diff(croom, svr.rooms[0]) + ROOMOFFSET));
    let lowx = croom.lx, lowy = croom.ly;
    let hix = croom.hx, hiy = croom.hy;

    let subindex, nsubrooms = croom.nsubrooms;

    /* skip the room if already done; i.e. a shop handled out of order */
    /* also skip if this is non-rectangular (it _must_ be done already) */
    if ((levl()[lowx][lowy].roomno) == roomno || croom.irregular)
        return;

        {
        /* do innards first */
        for (x = lowx; x <= hix; x++)
            for (y = lowy; y <= hiy; y++)

                    levl()[x][y].roomno = unsigned(roomno);
        /* top and bottom edges */
        for (x = lowx - 1; x <= hix + 1; x++)
            for (y = lowy - 1; y <= hiy + 1; y += (hiy - lowy + 2)) {
                levl()[x][y].edge = 1;
                if (levl()[x][y].roomno)
                    levl()[x][y].roomno = SHARED;
                else
                    levl()[x][y].roomno = unsigned(roomno);
            }
        /* sides */
        for (x = lowx - 1; x <= hix + 1; x += (hix - lowx + 2))
            for (y = lowy; y <= hiy; y++) {
                levl()[x][y].edge = 1;
                if (levl()[x][y].roomno)
                    levl()[x][y].roomno = SHARED;
                else
                    levl()[x][y].roomno = unsigned(roomno);
            }
    }
    /* gs.subrooms */
    for (subindex = 0; subindex < nsubrooms; subindex++)

        topologize(croom.sbrooms[subindex]);
}

/* Find an unused room for a branch location. */
function find_branch_room(mp) { /* struct mkroom * */
    let croom = null;

    if (svn.nroom == 0) {
        mazexy(mp); /* already verifies location */
    } else {
        croom = generate_stairs_find_room();
        assert(croom != null); /* Null iff nroom==0 which won't get here */
        if (!somexyspace(croom, mp))
            impossible(_("Can't place branch!"));
    }
    return croom;
}

/* Find the room for (x,y).  Return null if not in a room. */
function pos_to_room(x, y) { /* struct mkroom * */
    let i;
    let curr;

    for (curr = svr.rooms[0], i = 0; i < svn.nroom; curr = ptr_add(curr, 1), i++)
        if (inside_room(curr, x, y))
            return curr;
    ;
    return null;
}

/* If given a branch, randomly place a special stair or portal. */
export function place_branch(
    br,
    x, y) { /* void */ /* location */
    const $frame = stack_frame(); try {
    let m = init_list(stack_struct(struct_nhcoord), {x: 0});
    let dest;
    let make_stairs;

    /*
     * Return immediately if there is no branch to make or we have
     * already made one.  This routine can be called twice when
     * a special level is loaded that specifies an SSTAIR location
     * as a favored spot for a branch.
     */
    if (!br || gm.made_branch)
        return;

    if (!x) { /* find random coordinates for branch */
        /* br_room = find_branch_room(&m); */
        find_branch_room(m);  /* sets m via mazexy() or somexy() */
        x = m.x;
        y = m.y;
    } else {
        pos_to_room(x, y);
    }

    if (on_level(br.end1, u.uz)) {
        /* we're on end1 */
        make_stairs = +(br.type != BR_NO_END1);
        dest = br.end2;
    } else {
        /* we're on end2 */
        make_stairs = +(br.type != BR_NO_END2);
        dest = br.end1;
    }

    if (br.type == BR_PORTAL) {
        if (iflags.debug_fuzzer && (u.ucamefrom.dnum || u.ucamefrom.dlevel))
            mkportal(x, y, u.ucamefrom.dnum, u.ucamefrom.dlevel);
        else
            mkportal(x, y, dest.dnum, dest.dlevel);
    } else if (make_stairs) {
        let goes_up = on_level(br.end1, u.uz) ? br.end1_up
                                                     : +!br.end1_up;

        stairway_add(x, y, goes_up, FALSE, dest);
        set_levltyp(x, y, STAIRS);
        levl()[x][y].flags = goes_up ? LA_UP : LA_DOWN;
    }
    /*
     * Set made_branch to TRUE even if we didn't make a stairwell (i.e.
     * make_stairs is false) since there is currently only one branch
     * per level, if we failed once, we're going to fail again on the
     * next call.
     */
    gm.made_branch = TRUE;
    } finally { stack_pop($frame); }
}

function bydoor(x, y) { /* boolean */
    let typ;

    if (isok(x + 1, y)) {
        typ = levl()[x + 1][y].typ;
        if (IS_DOOR(typ) || typ == SDOOR)
            return TRUE;
    }
    if (isok(x - 1, y)) {
        typ = levl()[x - 1][y].typ;
        if (IS_DOOR(typ) || typ == SDOOR)
            return TRUE;
    }
    if (isok(x, y + 1)) {
        typ = levl()[x][y + 1].typ;
        if (IS_DOOR(typ) || typ == SDOOR)
            return TRUE;
    }
    if (isok(x, y - 1)) {
        typ = elt(levl()[x], y - 1).typ;
        if (IS_DOOR(typ) || typ == SDOOR)
            return TRUE;
    }
    return FALSE;
}

/* see whether it is allowable to create a door at [x,y] */
export function okdoor(x, y) { /* int */
    let near_door = bydoor(x, y);

    return ((levl()[x][y].typ == HWALL || levl()[x][y].typ == VWALL)
            && ((isok(x - 1, y) && !IS_OBSTRUCTED(levl()[x - 1][y].typ))
                || (isok(x + 1, y) && !IS_OBSTRUCTED(levl()[x + 1][y].typ))
                || (isok(x, y - 1) && !IS_OBSTRUCTED(elt(levl()[x], y - 1).typ))
                || (isok(x, y + 1) && !IS_OBSTRUCTED(levl()[x][y + 1].typ)))
            && !near_door ? 1 : 0);
}

/* do we want a secret door/corridor? */
export function maybe_sdoor(chance) { /* boolean */
    return +((depth(u.uz) > 2) && !rn2(max(2, chance)));
}

/* create a door at x,y in room aroom */
export function dodoor(x, y, aroom) { /* void */
    dosdoor(x, y, aroom, maybe_sdoor(8) ? SDOOR : DOOR);
}

export function occupied(x, y) { /* boolean */
    return (t_at(x, y) || IS_FURNITURE(levl()[x][y].typ)
                      || is_lava(x, y) || is_pool(x, y)
                      || invocation_pos(x, y) ? 1 : 0);
}

/* generate a corpse and some items on top of a trap */
function mktrap_victim(ttmp) { /* void */
    /* Object generated by the trap; initially NULL, stays NULL if
       the trap doesn't generate objects. */
    let otmp = null;
    let victim_mnum; /* race of the victim */
    let lvl = unsigned(level_difficulty());
    let kind = ttmp.ttyp;
    let x = ttmp.tx, y = ttmp.ty;

    assert(x > 0 && x < COLNO && y >= 0 && y < ROWNO);
    /* Not all trap types have special handling here; only the ones
       that kill in a specific way that's obvious after the fact. */
    switch (kind) {
    case ARROW_TRAP:
        otmp = mksobj(ARROW, TRUE, FALSE);
        otmp.otrapped = 0;
        /* don't adjust the quantity; maybe the trap shot multiple
           times, there was an untrapping attempt, etc... */
        break;
    case DART_TRAP:
        otmp = mksobj(DART, TRUE, FALSE);
        break;
    case ROCKTRAP:
        otmp = mksobj(ROCK, TRUE, FALSE);
        break;
    default:
        /* no item dropped by the trap */
        break;
    }
    if (otmp) {
        place_object(otmp, x, y);
    }

    /* now otmp is reused for other items we're placing */

    /* Place a random possession. This could be a weapon, tool,
       food, or gem, i.e. the item classes that are typically
       nonmagical and not worthless. */
    do {
        let poss_class = RANDOM_CLASS; /* init => lint suppression */

        switch (rn2(4)) {
        case 0:
            poss_class = WEAPON_CLASS;
            break;
        case 1:
            poss_class = TOOL_CLASS;
            break;
        case 2:
            poss_class = FOOD_CLASS;
            break;
        case 3:
            poss_class = GEM_CLASS;
            break;
        }

        /* these items are always cursed, both for flavour (owned
           by a dead adventurer, bones-pile-style) and for balance
           (less useful to use, and encourage pets to avoid the trap) */
        otmp = mkobj(poss_class, FALSE);
        curse(otmp);
        /* for mktrap_victim(), PIT is actually an exploded LANDMINE */
        if (ttmp.ttyp == PIT && breaktest(otmp)) {
            /* landmine: if fragile object has been created, destroy it;
               don't worry about non-empty containers--they aren't
               breakable--nor about breakable contents of such */
            dealloc_obj(otmp);
        } else {
            place_object(otmp, x, y);
        }

        /* 20% chance of placing an additional item, recursively */
    } while (!rn2(5));

    /* Place a corpse. */
    switch (rn2(15)) {
    case 0:
        /* elf corpses are the rarest as they're the most useful */
        victim_mnum = PM_ELF;
        /* elven adventurers get sleep resistance early; so don't
           generate elf corpses on sleeping gas traps unless a)
           we're on dlvl 2 (1 is impossible) and b) we pass a coin
           flip */
        if (kind == SLP_GAS_TRAP && !(lvl <= 2 && rn2(2)))
            victim_mnum = PM_HUMAN;
        break;
    case 1: case 2:
        victim_mnum = PM_DWARF;
        break;
    case 3: case 4: case 5:
        victim_mnum = PM_ORC;
        break;
    case 6: case 7: case 8: case 9:
        /* more common as they could have come from the Mines */
        victim_mnum = PM_GNOME;
        /* 10% chance of a candle too */
        if (!rn2(10)) {
            otmp = mksobj(rn2(4) ? TALLOW_CANDLE : WAX_CANDLE, TRUE, FALSE);
            otmp.quan = 1;
            otmp.owt = unsigned(weight(otmp));
            curse(otmp);
            place_object(otmp, x, y);
            if (!levl()[x][y].lit)
                begin_burn(otmp, FALSE);
        }
        break;
    default:
        /* human is the most common result */
        victim_mnum = PM_HUMAN;
        break;
    }
    /* PM_HUMAN is a placeholder monster primarily used for zombie, mummy,
       and vampire corpses; usually change it into a fake player monster
       instead (always human); no role-specific equipment is provided */
    if (victim_mnum == PM_HUMAN && rn2(25))
        victim_mnum = rn1(PM_WIZARD - PM_ARCHEOLOGIST, PM_ARCHEOLOGIST);
    otmp = mkcorpstat(CORPSE, null, mons[victim_mnum], x, y, CORPSTAT_INIT);
    otmp.age -= (TAINT_AGE + 1); /* died too long ago to safely eat */
}

/* pick a random trap type, return NO_TRAP if "too hard" */
function traptype_rnd(mktrapflags) { /* int */
    let lvl = unsigned(level_difficulty());
    let kind = rnd(TRAPNUM - 1);

    switch (kind) {
        /* these are controlled by the feature or object they guard,
           not by the map so mustn't be created on it */
    case TRAPPED_DOOR:
    case TRAPPED_CHEST:
        kind = NO_TRAP;
        break;
        /* these can have a random location but can't be generated
           randomly */
    case MAGIC_PORTAL:
    case VIBRATING_SQUARE:
        kind = NO_TRAP;
        break;
    case ROLLING_BOULDER_TRAP:
    case SLP_GAS_TRAP:
        if (lvl < 2)
            kind = NO_TRAP;
        break;
    case LEVEL_TELEP:
        if (lvl < 5 || svl.level.flags.noteleport
            || single_level_branch(u.uz))
            kind = NO_TRAP;
        break;
    case SPIKED_PIT:
        if (lvl < 5)
            kind = NO_TRAP;
        break;
    case LANDMINE:
        if (lvl < 6)
            kind = NO_TRAP;
        break;
    case WEB:
        if (lvl < 7 && !(mktrapflags & MKTRAP_NOSPIDERONWEB))
            kind = NO_TRAP;
        break;
    case STATUE_TRAP:
    case POLY_TRAP:
        if (lvl < 8)
            kind = NO_TRAP;
        break;
    case FIRE_TRAP:
        if (!Inhell())
            kind = NO_TRAP;
        break;
    case TELEP_TRAP:
        if (svl.level.flags.noteleport)
            kind = NO_TRAP;
        break;
    case HOLE:
        /* make these much less often than other traps */
        if (rn2(7))
            kind = NO_TRAP;
        break;
    }
    return kind;
}

/* random trap type for the Rogue level */
function traptype_roguelvl() { /* int */
    let kind;

    switch (rn2(7)) {
    default:
        kind = BEAR_TRAP;
        break; /* 0 */
    case 1:
        kind = ARROW_TRAP;
        break;
    case 2:
        kind = DART_TRAP;
        break;
    case 3:
        kind = TRAPDOOR;
        break;
    case 4:
        kind = PIT;
        break;
    case 5:
        kind = SLP_GAS_TRAP;
        break;
    case 6:
        kind = RUST_TRAP;
        break;
    }
    return kind;
}

/* mktrap(): select trap type and location, then use maketrap() to create it;
   make it at location 'tm' when that isn't Null, otherwise in 'croom'
   if mktrapflags doesn't have MKTRAP_MAZEFLAG set, else in maze corridor */
export function mktrap(
    num,
    mktrapflags,
    croom,
    tm) { /* void */ /* specific location for trap */
    const $frame = stack_frame(); try {
    let mktrap_err = static_var("mktrap.mktrap_err", int, 0); /* move to struct g? */
    let t;
    let m = stack_struct(struct_nhcoord);
    let kind;
    let lvl = unsigned(level_difficulty());

    if (!tm && !croom && !(mktrapflags & MKTRAP_MAZEFLAG)) {
        /* complain when the combination of arguments will never set 'm' */
        if (!mktrap_err[0]++) {
            let errbuf = stack_array(char, BUFSZ);

            Snprintf(errbuf, sizeof(array_of(char, BUFSZ)), _("args (%d,%d,%s,%s) are invalid"), num, mktrapflags, _("null room"), _("null location"))

;
            paniclog(_("mktrap"), errbuf);
        }
        return;
    }
    m.x = m.y = 0;

    /* no traps in pools */
    if (tm && is_pool_or_lava(tm.x, tm.y))
        return;

    if (num > NO_TRAP && num < TRAPNUM) {
        kind = num;
    } else if (Is_rogue_level(u.uz)) {
        kind = traptype_roguelvl();
    } else if (Inhell() && !rn2(5)) {
        /* bias the frequency of fire traps in Gehennom */
        kind = FIRE_TRAP;
    } else {
        do {
            kind = traptype_rnd(mktrapflags);
        } while (kind == NO_TRAP);
    }

    if (is_hole(kind) && !Can_fall_thru(u.uz))
        kind = ROCKTRAP;

    if (tm) {
        struct_assign(m, tm);
    } else {
        let tryct = 0;
        let avoid_boulder = +(is_pit(kind) || is_hole(kind));

        do {
            if (++tryct > 200)
                return;
            if ((mktrapflags & MKTRAP_MAZEFLAG) != 0)
                mazexy(m);
            else if (croom && !somexyspace(croom, m))
                return;
        } while (occupied(m.x, m.y)
                 || (avoid_boulder && sobj_at(BOULDER, m.x, m.y)));
    }

    t = maketrap(m.x, m.y, kind);
    /* we should always get type of trap we're asking for (occupied() test
       should prevent cases where that might not happen) but be paranoid */
    kind = t ? t.ttyp : NO_TRAP;

    if (kind == WEB && !(mktrapflags & MKTRAP_NOSPIDERONWEB))
        makemon(mons[PM_GIANT_SPIDER], m.x, m.y, NO_MM_FLAGS);
    if (t && (mktrapflags & MKTRAP_SEEN))
        t.tseen = TRUE;
    if (kind == MAGIC_PORTAL && (u.ucamefrom.dnum || u.ucamefrom.dlevel)) {
        assign_level(t.dst, u.ucamefrom);
    }

    /* The hero isn't the only person who's entered the dungeon in
       search of treasure. On the very shallowest levels, there's a
       chance that a created trap will have killed something already
       (and this is guaranteed on the first level).

       This isn't meant to give any meaningful treasure (in fact, any
       items we drop here are typically cursed, other than ammo fired
       by the trap). Rather, it's mostly just for flavour and to give
       players on very early levels a sufficient chance to avoid traps
       that may end up killing them before they have a fair chance to
       build max HP. Including cursed items gives the same fair chance
       to the starting pet, and fits the rule that possessions of the
       dead are normally cursed.

       Some types of traps are excluded because they're entirely
       nonlethal, even indirectly. We also exclude all of the
       later/fancier traps because they tend to have special
       considerations (e.g. webs, portals), often are indirectly
       lethal, and tend not to generate on shallower levels anyway
       (exception: magic traps can generate on dlvl 1 and be
       immediately lethal). Finally, pits are excluded because it's
       weird to see an item in a pit and yet not be able to identify
       that the pit is there. */
    if (gi.in_mklev
        && kind != NO_TRAP && !(mktrapflags & MKTRAP_NOVICTIM)
        && lvl <= unsigned(rnd(4))
        && kind != SQKY_BOARD && kind != RUST_TRAP
        /* rolling boulder trap might not have a boulder if there was no
           viable path (such as when placed in the corner of a room), in
           which case tx,ty==launch.x,y; no boulder => no dead predecessor */
        && !(kind == ROLLING_BOULDER_TRAP
             && t.launch.x == t.tx && t.launch.y == t.ty)
        && !is_pit(kind) && (kind < HOLE || kind == MAGIC_TRAP)) {
        if (kind == LANDMINE) {
            /* if victim was killed by a land mine, we won't scatter objects;
               treat it as exploded, converting it into an unconcealed pit */
            t.ttyp = PIT;
            t.tseen = 1;
        }
        mktrap_victim(t);
    }
    return;
    } finally { stack_pop($frame); }
}

/* Create stairs up or down at x,y.
   If force is TRUE, change the terrain to ROOM first */
export function mkstairs(
    x, y,
    up,
    croom,
    force) { /* void */
    const $frame = stack_frame(); try {
    let ltyp;
    let dest = stack_struct(struct_d_level);

    if (!x || !isok(x, y)) {
        impossible(_("mkstairs:  bogus stair attempt at <%d,%d>"), x, y);
        return;
    }
    if (force)
        levl()[x][y].typ = ROOM;
    ltyp = levl()[x][y].typ; /* somexyspace() allows ice */
    if (ltyp != ROOM && ltyp != CORR && ltyp != ICE) {
        let glyph = back_to_glyph(x, y),
            sidx = glyph_to_cmap(glyph);

        impossible(_("mkstairs:  placing stairs %s on %s at <%d,%d>"),
                   up ? _("up") : _("down"), defsyms[sidx].explanation, x, y);
    }

    /*
     * We can't make a regular stair off an end of the dungeon.  This
     * attempt can happen when a special level is placed at an end and
     * has an up or down stair specified in its description file.
     */
    if (dunlev(u.uz) == (up ? 1 : dunlevs_in_dungeon(u.uz)))
        return;

    dest.dnum = u.uz.dnum;
    dest.dlevel = u.uz.dlevel + (up ? -1 : 1);
    stairway_add(x, y, up ? TRUE : FALSE, FALSE, dest);

    set_levltyp(x, y, STAIRS);
    levl()[x][y].flags = up ? LA_UP : LA_DOWN;
    } finally { stack_pop($frame); }
}

/* is room a good one to generate up or down stairs in? */
function generate_stairs_room_good(croom, phase) { /* boolean */
    /*
     * phase values, smaller allows for more relaxed criteria:
     *  2 == no relaxed criteria;
     *  1 == allow a themed room;
     *  0 == allow same room as existing up/downstairs;
     * -1 == allow an unjoined room.
     */
    return (croom && (croom.needjoining || (phase < 0))
            && ((!has_dnstairs(croom) && !has_upstairs(croom))
                || phase < 1)
            && (croom.rtype == OROOM
                || ((phase < 2) && croom.rtype == THEMEROOM)) ? 1 : 0);
}

/* find a good room to generate an up or down stairs in */
function generate_stairs_find_room() { /* struct mkroom * */
    let croom;
    let i, phase, ai;
    let rmarr;

    if (!svn.nroom)
        return null;

    rmarr = ref_to(int, addr_of(alloc(unsigned(Math.imul(sizeof(int), unsigned(svn.nroom))))));

    for (phase = 2; phase > -1; phase--) {
        ai = 0;
        for (i = 0; i < svn.nroom; i++)
            if (generate_stairs_room_good(svr.rooms[i], phase))
                rmarr[ai++] = i;
        if (ai > 0) {
            i = rmarr[rn2(ai)];
            free(addr_of(rmarr));
            return svr.rooms[i];
        }
    }

    free(addr_of(rmarr));
    croom = svr.rooms[rn2(svn.nroom)];
    return croom;
}

/* construct stairs up and down within the same branch,
   up and down in different rooms if possible */
function generate_stairs() { /* void */
    const $frame = stack_frame(); try {
    /* generate_stairs_find_room() returns Null if nroom == 0, but that
       should never happen for a rooms+corridors style level */
    let gen_stairs_panic = init_string(static_array("generate_stairs.gen_stairs_panic", char, sizeof_string("generate_stairs: failed to find a room! (%d)")), _("generate_stairs: failed to find a room! (%d)"), true);

    let croom;
    let pos = stack_struct(struct_nhcoord);

    if (!Is_botlevel(u.uz)) {
        if ((croom = generate_stairs_find_room()) == null)
            panic(gen_stairs_panic, svn.nroom);

        if (!somexyspace(croom, pos)) {
            pos.x = somex(croom);
            pos.y = somey(croom);
        }
        mkstairs(pos.x, pos.y, 0, croom, FALSE); /* down */
    }

    if (u.uz.dlevel != 1) {
        /* if there is only 1 room and we found it above, this will find
           it again */
        if ((croom = generate_stairs_find_room()) == null)
            panic(gen_stairs_panic, svn.nroom);

        if (!somexyspace(croom, pos)) {
            pos.x = somex(croom);
            pos.y = somey(croom);
        }
        mkstairs(pos.x, pos.y, 1, croom, FALSE); /* up */
    }
    } finally { stack_pop($frame); }
}

function mkfount(croom) { /* void */
    const $frame = stack_frame(); try {
    let m = stack_struct(struct_nhcoord);

    if (!find_okay_roompos(croom, m))
        return;

    /* Put a fountain at m.x, m.y */
    if (!set_levltyp(m.x, m.y, FOUNTAIN))
        return;
    /* Is it a "blessed" fountain? (affects drinking from fountain) */
    if (!rn2(7))
        levl()[m.x][m.y].horizontal = 1;

    svl.level.flags.nfountains++;
    } finally { stack_pop($frame); }
}

function find_okay_roompos(croom, crd) { /* boolean */
    let tryct = 0;

    do {
        if (++tryct > 200)
            return FALSE;
        if (!somexyspace(croom, crd))
            return FALSE;
    } while (occupied(crd.x, crd.y) || bydoor(crd.x, crd.y));
    return TRUE;
}

function mksink(croom) { /* void */
    const $frame = stack_frame(); try {
    let m = stack_struct(struct_nhcoord);

    if (!find_okay_roompos(croom, m))
        return;

    /* Put a sink at m.x, m.y */
    if (!set_levltyp(m.x, m.y, SINK))
        return;

    svl.level.flags.nsinks++;
    } finally { stack_pop($frame); }
}

function mkaltar(croom) { /* void */
    const $frame = stack_frame(); try {
    let m = stack_struct(struct_nhcoord);
    let al;

    if (croom.rtype != OROOM)
        return;

    if (!find_okay_roompos(croom, m))
        return;

    /* Put an altar at m.x, m.y */
    if (!set_levltyp(m.x, m.y, ALTAR))
        return;

    /* -1 - A_CHAOTIC, 0 - A_NEUTRAL, 1 - A_LAWFUL */
    al = rn2(A_LAWFUL + 2) - 1;
    levl()[m.x][m.y].flags = Align2amask(al);
    } finally { stack_pop($frame); }
}

function mkgrave(croom) { /* void */
    const $frame = stack_frame(); try {
    let m = stack_struct(struct_nhcoord);
    let tryct = 0;
    let otmp;
    let dobell = +!rn2(10);

    if (croom.rtype != OROOM)
        return;

    if (!find_okay_roompos(croom, m))
        return;

    /* Put a grave at <m.x,m.y> */
    make_grave(m.x, m.y, dobell ? _("Saved by the bell!") : 0);

    /* Possibly fill it with objects */
    if (!rn2(3)) {
        /* this used to use mkgold(), which puts a stack of gold on
           the ground (or merges it with an existing one there if
           present), and didn't bother burying it; now we create a
           loose, easily buriable, stack but we make no attempt to
           replicate mkgold()'s level-based formula for the amount */
        let gold = mksobj(GOLD_PIECE, TRUE, FALSE);

        gold.quan = (rnd(20) + level_difficulty() * rnd(5));
        gold.owt = unsigned(weight(gold));
        gold.ox = m.x, gold.oy = m.y;
        add_to_buried(gold);
    }
    for (tryct = rn2(5); tryct; tryct--) {
        otmp = mkobj(RANDOM_CLASS, TRUE);
        if (!otmp)
            return;
        curse(otmp);
        otmp.ox = m.x;
        otmp.oy = m.y;
        add_to_buried(otmp);
    }

    /* Leave a bell, in case we accidentally buried someone alive */
    if (dobell)
        mksobj_at(BELL, m.x, m.y, TRUE, FALSE);
    return;
    } finally { stack_pop($frame); }
}

/*
 * Major level transmutation:  add a set of stairs (to the Sanctum) after
 * an earthquake that leaves behind a new topology, centered at inv_pos.
 * Assumes there are no rooms within the invocation area and that svi.inv_pos
 * is not too close to the edge of the map.  Also assume the hero can see,
 * which is guaranteed for normal play due to the fact that sight is needed
 * to read the Book of the Dead.  [That assumption is not valid; it is
 * possible that "the Book reads the hero" rather than vice versa if
 * attempted while blind (in order to make blind-from-birth conduct viable).]
 */
export function mkinvokearea() { /* void */
    let dist, wallct;
    let xmin, xmax, ymin, ymax;
    let i;

    /* slightly odd if levitating, but not wrong */
    pline_The(_("floor shakes violently under you!"));
    /* decide whether to issue the crumbling walls message */
    {
        xmin = xmax = svi.inv_pos.x;
        ymin = ymax = svi.inv_pos.y;
        wallct = mkinvk_check_wall(xmin, ymin);
        /* this replicates the somewhat convoluted loop below, working
           out from the stair position, except for stopping early when
           walls are found */
        for (dist = 1; !wallct && dist < 7; ++dist) {
            xmin--, xmax++;
            /* top and bottom */
            if (dist != 3) { /* the area is wider that it is high */
                ymin--, ymax++;
                for (i = xmin + 1; i < xmax; i++) {
                    if (mkinvk_check_wall(i, ymin))
                        ++wallct; /* we could break after finding first wall
                                   * but it isn't a significant optimization
                                   * for code which only executes once */
                    if (mkinvk_check_wall(i, ymax))
                        ++wallct;
                }
            }
            /* left and right */
            if (!wallct) { /* skip y loop if x loop found any walls */
                for (i = ymin; i <= ymax; i++) {
                    if (mkinvk_check_wall(xmin, i))
                        ++wallct;
                    if (mkinvk_check_wall(xmax, i))
                        ++wallct;
                }
            }
        }
        /* message won't appear if the maze 'walls' on this level are lava
           or if all the walls within range have been dug away; when it does
           appear, it will describe iron bars as "walls" (which is ok) */
        if (wallct)
            pline_The(_("walls around you begin to bend and crumble!"));
    }
    display_nhwindow()(WIN_MESSAGE, TRUE);

    /* any trap hero is stuck in will be going away now */
    if (u.utrap) {
        if (u.utraptype == TT_BURIEDBALL)
            buried_ball_to_punishment();
        reset_utrap(FALSE);
    }

    xmin = xmax = svi.inv_pos.x; /* reset after the check for walls */
    ymin = ymax = svi.inv_pos.y;
    mkinvpos(xmin, ymin, 0); /* middle, before placing stairs */

    for (dist = 1; dist < 7; dist++) {
        xmin--;
        xmax++;

        /* top and bottom */
        if (dist != 3) { /* the area is wider that it is high */
            ymin--;
            ymax++;
            for (i = xmin + 1; i < xmax; i++) {
                mkinvpos(i, ymin, dist);
                mkinvpos(i, ymax, dist);
            }
        }

        /* left and right */
        for (i = ymin; i <= ymax; i++) {
            mkinvpos(xmin, i, dist);
            mkinvpos(xmax, i, dist);
        }

        flush_screen(1); /* make sure the new glyphs shows up */
        nh_delay_output()();
    }

    You(_("are standing at the top of a stairwell leading down!"));
    mkstairs(u.ux, u.uy, 0, null, FALSE); /* down */
    newsym(u.ux, u.uy);
    gv.vision_full_recalc = 1; /* everything changed */
}

/* Change level topology.  Boulders in the vicinity are eliminated.
 * Temporarily overrides vision in the name of a nice effect.
 */
function mkinvpos(x, y, dist) { /* void */
    let ttmp;
    let otmp;
    let make_rocks;
    let lev = levl()[x][y];
    let mon;
    /* maze levels have slightly different constraints from normal levels;
       these are also defined in mkmaze.c and may not be appropriate for
       mazes with corridors wider than 1 or for cavernous levels */

    /* clip at existing map borders if necessary */
    if (!within_bounded_area(x, y, x_maze_min, y_maze_min,
                             gx.x_maze_max, gy.y_maze_max)) {
        /* outermost 2 columns and/or rows may be truncated due to edge */
        if (dist < (7 - 2)) { /* panic() or impossible() */
            let errfunc;

            errfunc = !isok(x, y) ? panic : impossible;
            errfunc(_("mkinvpos: <%d,%d> (%d) off map edge!"), x, y, dist);
        }
        return;
    }

    /* clear traps */
    if ((ttmp = t_at(x, y)) != null)
        deltrap(ttmp);

    /* clear boulders; leave some rocks for non-{moat|trap} locations */
    make_rocks = (dist != 1 && dist != 4 && dist != 5) ? TRUE : FALSE;
    while ((otmp = sobj_at(BOULDER, x, y)) != null) {
        if (make_rocks) {
            fracture_rock(otmp);
            make_rocks = FALSE; /* don't bother with more rocks */
        } else {
            obj_extract_self(otmp);
            obfree(otmp, null);
        }
    }

    /* fake out saved state */
    lev.seenv = 0;
    lev.flags = 0;
    if (dist < 6)
        lev.lit = TRUE;
    lev.waslit = TRUE;
    lev.horizontal = FALSE;
    /* short-circuit vision recalc */
    uchars[gv.viz_array[y] + x] = (dist < 6) ? (IN_SIGHT | COULD_SEE) : COULD_SEE;

    switch (dist) {
    case 1: /* fire traps */
        if (is_pool(x, y))
            break;
        lev.typ = ROOM;
        ttmp = maketrap(x, y, FIRE_TRAP);
        if (ttmp)
            ttmp.tseen = TRUE;
        break;
    case 0: /* lit room locations */
    case 2:
    case 3:
    case 6: /* unlit room locations */
        lev.typ = ROOM;
        break;
    case 4: /* pools (aka a wide moat) */
    case 5:
        lev.typ = MOAT;
        /* No kelp! */
        break;
    default:
        impossible(_("mkinvpos called with dist %d"), dist);
        break;
    }

    if ((mon = m_at(x, y)) != null) {
        /* wake up mimics, don't want to deal with them blocking vision */
        if (mon.m_ap_type)
            seemimic(mon);

        if ((ttmp = t_at(x, y)) != null)
            mintrap(mon, NO_TRAP_FLAGS);
        else
            minliquid(mon);
    }

    if (!does_block(x, y, lev))
        unblock_point(x, y); /* make sure vision knows location is open */

    /* display new value of position; could have a monster/object on it */
    newsym(x, y);
}
export const x_maze_min = 2;
export const y_maze_min = 2;

/* reduces clutter in mkinvokearea() while avoiding potential static analyzer
   confusion about using isok(x,y) to control access to levl[x][y] */
function mkinvk_check_wall(x, y) { /* int */
    let ltyp;

    if (!isok(x, y))
        return 0;
    assert(x > 0 && x < COLNO);
    assert(y >= 0 && y < ROWNO);
    ltyp = unsigned(levl()[x][y].typ);
    return (IS_STWALL(ltyp) || ltyp == IRONBARS) ? 1 : 0;
}

/*
 * The portal to Ludios is special.  The entrance can only occur within a
 * vault in the main dungeon at a depth greater than 10.  The Ludios branch
 * structure reflects this by having a bogus "source" dungeon:  the value
 * of n_dgns (thus, Is_branchlev() will never find it).
 *
 * Ludios will remain isolated until the branch is corrected by this function.
 */
function mk_knox_portal(x, y) { /* void */
    let source;
    let br;
    let u_depth;

    br = dungeon_branch(_("Fort Ludios"));
    /* dungeon_branch() panics (so never returns) if result would be Null */
    assert(br != null);

    if (on_level(svd.dungeon_topology.d_knox_level, br.end1)) {
        source = br.end2;
    } else {
        /* disallow Knox branch on a level with one branch already */
        if (Is_branchlev(u.uz))
            return;
        source = br.end1;
    }

    /* Already set or 2/3 chance of deferring until a later level. */
    if (source.dnum < svn.n_dgns || (rn2(3) && !wizard()))
        return;

    if (!(u.uz.dnum == oracle_level().dnum      /* in main dungeon */
          && !at_dgn_entrance(_("The Quest"))    /* but not Quest's entry */
          && (u_depth = depth(u.uz)) > 10    /* beneath 10 */
          && u_depth < depth(svd.dungeon_topology.d_medusa_level))) /* and above Medusa */
        return;

    /* Adjust source to be current level and re-insert branch. */
    struct_assign(source, u.uz);
    insert_branch(br, TRUE);

    debugpline0(_("Made knox portal."), __FILE__);
    place_branch(br, x, y);
}

/*mklev.c*/

import { A_LAWFUL } from "./align.h.js";
import { Align2amask } from "./align.h.macros.js";
import { struct_nhcoord } from "./coord.h.js";
import {
    ARMOR_CLASS, FOOD_CLASS, GEM_CLASS, POTION_CLASS, RANDOM_CLASS, RING_CLASS, SCROLL_CLASS,
    S_HUMAN, S_MIMIC, TOOL_CLASS, WEAPON_CLASS,
} from "./defsym.h.js";
import { GLYPH_UNEXPLORED } from "./display.h.js";
import { BR_NO_END1, BR_NO_END2, BR_PORTAL, struct_d_level } from "./dungeon.h.js";
import {
    In_endgame, Inhell, Is_oracle_level, Is_rogue_level, Is_waterlevel, within_bounded_area,
} from "./dungeon.h.macros.js";
import { DUST, MARK } from "./engrave.h.js";
import { wizard } from "./flag.h.macros.js";
import {
    BUFSZ, COLNO, DOORINC, FALSE, MAXNROFROOMS, MAX_SUBROOMS, NHL_SB_SAFE, NHLpa_impossible,
    NHLpa_panic, ROWNO, TRUE, coordxy, struct_nhl_sandbox_info,
} from "./global.h.js";
import {
    CORPSTAT_INIT, DIR_E, DIR_N, DIR_S, DIR_W, MKTRAP_MAZEFLAG, MKTRAP_NOFLAGS,
    MKTRAP_NOSPIDERONWEB, MKTRAP_NOVICTIM, MKTRAP_SEEN, MM_NOGRP, NHCB_LVL_ENTER, NO_MM_FLAGS,
    NO_TRAP_FLAGS, TAINT_AGE, most_themes, tut_themes,
} from "./hack.h.js";
import {
    DIR_180, ROLL_FROM, astral_level, max, medusa_level, mines_dnum, oracle_level, qsort, rn1,
    tutorial_dnum, wiz1_level,
} from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { debugpline0 } from "./lint.h.macros.js";
import { LUA_GCCOLLECT } from "./lua.h.js";
import {
    ANTHOLE, BARRACKS, BEEHIVE, COCKNEST, COURT, FILL_NORMAL, LEPREHALL, MORGUE, OROOM, ROOMOFFSET,
    SHARED, SHOPBASE, SWAMP, TEMPLE, THEMEROOM, VAULT, ZOO, struct_mkroom,
} from "./mkroom.h.js";
import { G_GONE } from "./monflag.h.js";
import {
    PM_ARCHEOLOGIST, PM_COCKATRICE, PM_DWARF, PM_ELF, PM_GIANT_MIMIC, PM_GIANT_SPIDER, PM_GNOME,
    PM_HUMAN, PM_KILLER_BEE, PM_LARGE_MIMIC, PM_LEPRECHAUN, PM_ORC, PM_SMALL_MIMIC, PM_SOLDIER,
    PM_WIZARD,
} from "./monsters.h.js";
import { SPBOOK_no_NOVEL } from "./objclass.h.js";
import {
    ARROW, BELL, BOULDER, CHEST, CORPSE, CRAM_RATION, DART, FOOD_RATION, GOLD_PIECE, KELP_FROND,
    LARGE_BOX, LEMBAS_WAFER, POT_EXTRA_HEALING, POT_GAIN_ENERGY, POT_HEALING, POT_SPEED, ROCK,
    SCR_CONFUSE_MONSTER, SCR_ENCHANT_ARMOR, SCR_ENCHANT_WEAPON, SCR_SCARE_MONSTER,
    SCR_TELEPORTATION, SPE_HEALING, STATUE, TALLOW_CANDLE, WAN_DIGGING, WAX_CANDLE,
} from "./objects.h.js";
import {
    ALTAR, BLCORNER, BRCORNER, CORR, DOOR, D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED,
    FOUNTAIN, HWALL, ICE, IRONBARS, LA_DOWN, LA_UP, MOAT, POOL, ROOM, SCORR, SDOOR, SINK, STAIRS,
    STONE, TLCORNER, TRCORNER, TREE, VWALL, WATER, W_NONDIGGABLE, struct_rm,
} from "./rm.h.js";
import {
    IS_DOOR, IS_FURNITURE, IS_OBSTRUCTED, IS_POOL, IS_STWALL, IS_WALL, levl, m_at,
} from "./rm.h.macros.js";
import {
    ARROW_TRAP, BEAR_TRAP, DART_TRAP, FIRE_TRAP, HOLE, LANDMINE, LEVEL_TELEP, MAGIC_PORTAL,
    MAGIC_TRAP, NO_TRAP, PIT, POLY_TRAP, ROCKTRAP, ROLLING_BOULDER_TRAP, RUST_TRAP, SLP_GAS_TRAP,
    SPIKED_PIT, SQKY_BOARD, STATUE_TRAP, TELEP_TRAP, TRAPDOOR, TRAPNUM, TRAPPED_CHEST, TRAPPED_DOOR,
    VIBRATING_SQUARE, WEB,
} from "./trap.h.js";
import { is_hole, is_pit } from "./trap.h.macros.js";
import { COULD_SEE, IN_SIGHT } from "./vision.h.js";
import { display_nhwindow, nh_delay_output } from "./winprocs.h.macros.js";
import { TT_BURIEDBALL } from "./you.h.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, sizeof, sizeof_string, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { abs, assert, free, memcpy, memset, sprintf, strcat } from "../rt/libc.js";
import {
    init_list, init_string, stack_array, stack_struct, stack_var, static_array, static_struct,
    static_var,
} from "../rt/locals.js";
import { lua_gc, lua_getglobal, lua_pushstring, lua_settop } from "../rt/lua.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, elt, ptr_add, ptr_diff, ptr_to, record_or_opaque, ref_of, ref_to,
    struct_assign, view_of,
} from "../rt/struct.js";
import { alloc } from "./alloc.js";
import { getbones } from "./bones.js";
import { isok } from "./cmd.js";
import { is_lava, is_pool, is_pool_or_lava } from "./dbridge.js";
import {
    gc, gd, gi, gl, gm, gn, gs, gt, gu, gv, gx, gy, iflags, nhcb_counts, nhcb_name, svd, svi, svl,
    svm, svn, svr, u, xdir, ydir,
} from "./decl.js";
import { buried_ball_to_punishment } from "./dig.js";
import { back_to_glyph, flush_screen, newsym, set_wall_state } from "./display.js";
import { breaktest } from "./dothrow.js";
import { defsyms } from "./drawing.js";
import {
    Can_fall_thru, In_V_tower, In_hell, In_mines, In_quest, Is_botlevel, Is_branchlev, Is_special,
    assign_level, at_dgn_entrance, depth, dungeon_branch, dunlev, dunlevs_in_dungeon, find_level,
    free_exclusions, init_dungeons, init_mapseen, insert_branch, level_difficulty, on_level,
    single_level_branch,
} from "./dungeon.js";
import { panic } from "./end.js";
import { make_engr_at, make_grave, random_engraving, wipe_engr_at } from "./engrave.js";
import { makerogueghost, makeroguerooms } from "./extralev.js";
import { paniclog } from "./files.js";
import { glyph_to_cmap } from "./glyphs.js";
import { in_rooms, invocation_pos } from "./hack.js";
import { sobj_at } from "./invent.js";
import { makemon, mkclass, set_mimic_sym } from "./makemon.js";
import { bound_digging, makemaz, mazexy, mkportal, set_levltyp, wallification } from "./mkmaze.js";
import {
    add_to_buried, add_to_container, curse, dealloc_obj, mkcorpstat, mkgold, mkobj, mkobj_at,
    mksobj, mksobj_at, obj_extract_self, place_object, weight,
} from "./mkobj.js";
import {
    antholemon, do_mkroom, has_dnstairs, has_upstairs, inside_room, somex, somexyspace, somey,
} from "./mkroom.js";
import { minliquid, seemimic } from "./mon.js";
import { mons } from "./monst.js";
import { nhl_done, nhl_init, nhl_loadlua, nhl_pcall_handle } from "./nhlua.js";
import { oinit } from "./o_init.js";
import { objects } from "./objects.js";
import { nh_getenv } from "./options.js";
import { You, impossible, pline_The } from "./pline.js";
import { init_rect, rnd_rect } from "./rect.js";
import { clear_regions } from "./region.js";
import { reseed_random, rn2, rn2_on_display_rng, rnd } from "./rnd.js";
import { obfree } from "./shk.js";
import {
    check_room, create_des_coder, create_room, dig_corridor, fill_special_room, reset_xystart_size,
} from "./sp_lev.js";
import { stairway_add, stairway_free_all } from "./stairs.js";
import { begin_burn } from "./timeout.js";
import { deltrap, maketrap, mintrap, reset_utrap, t_at } from "./trap.js";
import { does_block, unblock_point } from "./vision.js";
import { fracture_rock } from "./zap.js";
const struct_lua_State = record_or_opaque("struct_lua_State");
const __FILE__ = "mklev.c";
