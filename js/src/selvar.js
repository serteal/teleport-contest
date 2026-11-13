/* NetHack 5.0	selvar.c	$NHDT-Date: 1769840272 2026/01/30 22:17:52 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.4 $ */
/* Copyright (c) 2024 by Pasi Kallinen */
/* NetHack may be freely redistributed.  See license for details. */

/* selection */
export function selection_new() { /* struct selectionvar * */
    let tmps = view_of(struct_selectionvar, addr_of(alloc(sizeof(struct_selectionvar))));

    tmps.wid = COLNO;
    tmps.hei = ROWNO;
    tmps.bounds_dirty = FALSE;
    tmps.bounds.lx = COLNO;
    tmps.bounds.ly = ROWNO;
    tmps.bounds.hx = tmps.bounds.hy = 0;
    tmps.map = addr_of(alloc((COLNO * ROWNO) + 1));
    memset(tmps.map, 1, (COLNO * ROWNO));
    chars[tmps.map + (COLNO * ROWNO)] = ord('\0');

    return tmps;
}

export function selection_free(sel, freesel) { /* void */
    if (sel) {
        if (sel.map)
            free(sel.map);
        sel.map = 0;
        if (freesel)
            free(addr_of(sel));
        else
            memset(addr_of(sel), 0, sizeof(struct_selectionvar));
    }
}

/* clear selection, setting all locations to value val */
export function selection_clear(sel, val) { /* void */
    memset(sel.map, 1 + val, (COLNO * ROWNO));
    if (val) {
        sel.bounds.lx = 0;
        sel.bounds.ly = 0;
        sel.bounds.hx = COLNO - 1;
        sel.bounds.hy = ROWNO - 1;
    } else {
        sel.bounds.lx = COLNO;
        sel.bounds.ly = ROWNO;
        sel.bounds.hx = sel.bounds.hy = 0;
    }
    sel.bounds_dirty = FALSE;
}

export function selection_clone(sel) { /* struct selectionvar * */
    let tmps = view_of(struct_selectionvar, addr_of(alloc(sizeof(struct_selectionvar))));

    struct_assign(tmps, sel);
    tmps.map = dupstr(sel.map);

    return tmps;
}

/* get boundary rect of selection sel into b */
export function selection_getbounds(sel, b) { /* void */
    if (!sel || !b)
        return;

    selection_recalc_bounds(sel);

    if (sel.bounds.lx >= sel.wid) {
        b.lx = 0;
        b.ly = 0;
        b.hx = COLNO - 1;
        b.hy = ROWNO - 1;
    } else {
        b.lx = sel.bounds.lx;
        b.ly = sel.bounds.ly;
        b.hx = sel.bounds.hx;
        b.hy = sel.bounds.hy;
    }
}

/* recalc the boundary of selection, if necessary */
export function selection_recalc_bounds(sel) { /* void */
    const $frame = stack_frame(); try {
    let x, y;
    let r = stack_struct(struct_nhrect);

    if (!sel.bounds_dirty)
        return;

    sel.bounds.lx = COLNO;
    sel.bounds.ly = ROWNO;
    sel.bounds.hx = sel.bounds.hy = 0;

    r.lx = r.ly = r.hx = r.hy = -1;

    /* left */
    for (x = 0; x < sel.wid; x++) {
        for (y = 0; y < sel.hei; y++) {
            if (selection_getpoint(x, y, sel)) {
                r.lx = x;
                break;
            }
        }
        if (r.lx > -1)
            break;
    }

    if (r.lx > -1) {
        /* right */
        for (x = sel.wid-1; x >= r.lx; x--) {
            for (y = 0; y < sel.hei; y++) {
                if (selection_getpoint(x, y, sel)) {
                    r.hx = x;
                    break;
                }
            }
            if (r.hx > -1)
                break;
        }

        /* top */
        for (y = 0; y < sel.hei; y++) {
            for (x = r.lx; x <= r.hx; x++) {
                if (selection_getpoint(x, y, sel)) {
                    r.ly = y;
                    break;
                }
            }
            if (r.ly > -1)
                break;
        }

        /* bottom */
        for (y = sel.hei-1; y >= r.ly; y--) {
            for (x = r.lx; x <= r.hx; x++) {
                if (selection_getpoint(x, y, sel)) {
                    r.hy = y;
                    break;
                }
            }
            if (r.hy > -1)
                break;
        }
        struct_assign(sel.bounds, r);
    }

    sel.bounds_dirty = FALSE;
    } finally { stack_pop($frame); }
}

export function selection_getpoint(
    x, y,
    sel) { /* coordxy */
    if (!sel || !sel.map)
        return 0;
    if (x < 0 || y < 0 || x >= sel.wid || y >= sel.hei)
        return 0;

    return (chars[sel.map + (sel.wid * y + x)] - 1);
}

export function selection_setpoint(
    x, y,
    sel,
    c) { /* void */
    if (!sel || !sel.map)
        return;
    if (x < 0 || y < 0 || x >= sel.wid || y >= sel.hei)
        return;

    if (c && !sel.bounds_dirty) {
        if (sel.bounds.lx > x)
            sel.bounds.lx = x;
        if (sel.bounds.ly > y)
            sel.bounds.ly = y;
        if (sel.bounds.hx < x)
            sel.bounds.hx = x;
        if (sel.bounds.hy < y)
            sel.bounds.hy = y;

    /* only set bounds_dirty if changing a point from 1 to 0; if changing
       a point from 0 to 0, nothing has really changed with the bounds */
    } else if (chars[sel.map + (sel.wid * y + x)] != 0) {
        sel.bounds_dirty = TRUE;
    }

    chars[sel.map + (sel.wid * y + x)] = char((c + 1));
}

export function selection_not(s) { /* struct selectionvar * */
    const $frame = stack_frame(); try {
    let x, y;
    let tmprect = struct_assign(stack_struct(struct_nhrect), cg.zeroNhRect);

    for (x = 0; x < s.wid; x++)
        for (y = 0; y < s.hei; y++)
            selection_setpoint(x, y, s, selection_getpoint(x, y, s) ? 0 : 1);
    selection_getbounds(s, tmprect);
    return s;
    } finally { stack_pop($frame); }
}

export function selection_filter_percent(
    ov,
    percent) { /* struct selectionvar * */
    const $frame = stack_frame(); try {
    let x, y;
    let ret;
    let rect = struct_assign(stack_struct(struct_nhrect), cg.zeroNhRect);

    if (!ov)
        return null;

    ret = selection_new();

    selection_getbounds(ov, rect);

    for (x = rect.lx; x <= rect.hx; x++)
        for (y = rect.ly; y <= rect.hy; y++)
            if (selection_getpoint(x, y, ov) && (rn2(100) < percent))
                selection_setpoint(x, y, ret, 1);

    return ret;
    } finally { stack_pop($frame); }
}

export function selection_filter_mapchar(ov, typ, lit) { /* struct selectionvar * */
    const $frame = stack_frame(); try {
    let x, y;
    let ret;
    let rect = struct_assign(stack_struct(struct_nhrect), cg.zeroNhRect);

    if (!ov)
        return null;

    ret = selection_new();

    selection_getbounds(ov, rect);

    for (x = rect.lx; x <= rect.hx; x++)
        for (y = rect.ly; y <= rect.hy; y++)
            if (selection_getpoint(x, y, ov)
                && match_maptyps(typ, levl()[x][y].typ)) {
                switch (lit) {
                default:
                case -2:
                    selection_setpoint(x, y, ret, 1);
                    break;
                case -1:
                    selection_setpoint(x, y, ret, rn2(2));
                    break;
                case 0:
                case 1:
                    if (levl()[x][y].lit == unsigned(lit))
                        selection_setpoint(x, y, ret, 1);
                    break;
                }
            }
    return ret;
    } finally { stack_pop($frame); }
}

export function selection_rndcoord(
    ov,
    x, y,
    removeit) { /* int */
    const $frame = stack_frame(); try {
    let idx = 0;
    let c;
    let dx, dy;
    let rect = struct_assign(stack_struct(struct_nhrect), cg.zeroNhRect);

    selection_getbounds(ov, rect);

    for (dx = rect.lx; dx <= rect.hx; dx++)
        for (dy = rect.ly; dy <= rect.hy; dy++)
            if (selection_getpoint(dx, dy, ov))
                idx++;

    if (idx) {
        c = rn2(idx);
        for (dx = rect.lx; dx <= rect.hx; dx++)
            for (dy = rect.ly; dy <= rect.hy; dy++)
                if (selection_getpoint(dx, dy, ov)) {
                    if (!c) {
                        x[0] = dx;
                        y[0] = dy;
                        if (removeit)
                            selection_setpoint(dx, dy, ov, 0);
                        return 1;
                    }
                    c--;
                }
    }
    x[0] = y[0] = -1;
    return 0;
    } finally { stack_pop($frame); }
}

export function selection_do_grow(ov, dir) { /* void */
    const $frame = stack_frame(); try {
    let x, y;
    let tmp;
    let rect = struct_assign(stack_struct(struct_nhrect), cg.zeroNhRect);

    if (!ov)
        return;

    tmp = selection_new();

    if (dir == W_RANDOM)
        dir = random_wdir();

    selection_getbounds(ov, rect);

    for (x = max(0, rect.lx-1); x <= min(COLNO-1, rect.hx+1); x++)
        for (y = max(0, rect.ly-1); y <= min(ROWNO-1, rect.hy+1); y++) {
            /* note:  dir is a mask of multiple directions, but the only
               way to specify diagonals is by including the two adjacent
               orthogonal directions, which effectively specifies three-
               way growth [WEST|NORTH => WEST plus WEST|NORTH plus NORTH] */
            if (((dir & W_WEST) && selection_getpoint(x + 1, y, ov))
                || (((dir & (W_WEST | W_NORTH)) == (W_WEST | W_NORTH))
                    && selection_getpoint(x + 1, y + 1, ov))
                || ((dir & W_NORTH) && selection_getpoint(x, y + 1, ov))
                || (((dir & (W_NORTH | W_EAST)) == (W_NORTH | W_EAST))
                    && selection_getpoint(x - 1, y + 1, ov))
                || ((dir & W_EAST) && selection_getpoint(x - 1, y, ov))
                || (((dir & (W_EAST | W_SOUTH)) == (W_EAST | W_SOUTH))
                    && selection_getpoint(x - 1, y - 1, ov))
                || ((dir & W_SOUTH) && selection_getpoint(x, y - 1, ov))
                ||  (((dir & (W_SOUTH | W_WEST)) == (W_SOUTH | W_WEST))
                     && selection_getpoint(x + 1, y - 1, ov))) {
                selection_setpoint(x, y, tmp, 1);
            }
        }

    selection_getbounds(tmp, rect);

    for (x = rect.lx; x <= rect.hx; x++)
        for (y = rect.ly; y <= rect.hy; y++)
            if (selection_getpoint(x, y, tmp))
                selection_setpoint(x, y, ov, 1);

    selection_free(tmp, TRUE);
    } finally { stack_pop($frame); }
}

const selection_flood_check_func = static_var("selection_flood_check_func", fnptr_t);

export function set_selection_floodfillchk(f) { /* void */
    selection_flood_check_func[0] = f;
}

/* check whethere <x,y> is already in xs[],ys[] */
function sel_flood_havepoint(
    x, y,
    xs, ys,
    n) { /* boolean */
    let xx = x, yy = y;

    while (n > 0) {
        --n;
        if (xs[n] == xx && ys[n] == yy)
            return TRUE;
    }
    return FALSE;
}

export function selection_floodfill(
    ov,
    x, y,
    diagonals) { /* void */
    const $frame = stack_frame(); try {
    let tmp = selection_new();

    let floodfill_stack_overrun = init_string(static_array("selection_floodfill.floodfill_stack_overrun", char, sizeof_string("floodfill stack overrun")), _("floodfill stack overrun"), true);
    let idx = 0;
    let dx = stack_array(short, SEL_FLOOD_STACK);
    let dy = stack_array(short, SEL_FLOOD_STACK);

    if (selection_flood_check_func[0] == null) {
        selection_free(tmp, TRUE);
        return;
    }
    do { if ((idx < SEL_FLOOD_STACK)) { dx[idx] = (x); dy[idx] = (y); idx++; } else panic(floodfill_stack_overrun); } while (0);
    do {
        idx--;
        x = dx[idx];
        y = dy[idx];
        if (isok(x, y)) {
            selection_setpoint(x, y, ov, 1);
            selection_setpoint(x, y, tmp, 1);
        }
        do { if ((((isok((x + 1), (y)) && (selection_flood_check_func[0])((x + 1), (y))) && !selection_getpoint((x + 1), (y), (tmp))) && !sel_flood_havepoint((x + 1), (y), dx, dy, idx))) do { if ((idx < SEL_FLOOD_STACK)) { dx[idx] = (x + 1); dy[idx] = (y); idx++; } else panic(floodfill_stack_overrun); } while (0) } while (0);
        do { if ((((isok((x - 1), (y)) && (selection_flood_check_func[0])((x - 1), (y))) && !selection_getpoint((x - 1), (y), (tmp))) && !sel_flood_havepoint((x - 1), (y), dx, dy, idx))) do { if ((idx < SEL_FLOOD_STACK)) { dx[idx] = (x - 1); dy[idx] = (y); idx++; } else panic(floodfill_stack_overrun); } while (0) } while (0);
        do { if ((((isok((x), (y + 1)) && (selection_flood_check_func[0])((x), (y + 1))) && !selection_getpoint((x), (y + 1), (tmp))) && !sel_flood_havepoint((x), (y + 1), dx, dy, idx))) do { if ((idx < SEL_FLOOD_STACK)) { dx[idx] = (x); dy[idx] = (y + 1); idx++; } else panic(floodfill_stack_overrun); } while (0) } while (0);
        do { if ((((isok((x), (y - 1)) && (selection_flood_check_func[0])((x), (y - 1))) && !selection_getpoint((x), (y - 1), (tmp))) && !sel_flood_havepoint((x), (y - 1), dx, dy, idx))) do { if ((idx < SEL_FLOOD_STACK)) { dx[idx] = (x); dy[idx] = (y - 1); idx++; } else panic(floodfill_stack_overrun); } while (0) } while (0);
        if (diagonals) {
            do { if ((((isok((x + 1), (y + 1)) && (selection_flood_check_func[0])((x + 1), (y + 1))) && !selection_getpoint((x + 1), (y + 1), (tmp))) && !sel_flood_havepoint((x + 1), (y + 1), dx, dy, idx))) do { if ((idx < SEL_FLOOD_STACK)) { dx[idx] = (x + 1); dy[idx] = (y + 1); idx++; } else panic(floodfill_stack_overrun); } while (0) } while (0);
            do { if ((((isok((x - 1), (y - 1)) && (selection_flood_check_func[0])((x - 1), (y - 1))) && !selection_getpoint((x - 1), (y - 1), (tmp))) && !sel_flood_havepoint((x - 1), (y - 1), dx, dy, idx))) do { if ((idx < SEL_FLOOD_STACK)) { dx[idx] = (x - 1); dy[idx] = (y - 1); idx++; } else panic(floodfill_stack_overrun); } while (0) } while (0);
            do { if ((((isok((x - 1), (y + 1)) && (selection_flood_check_func[0])((x - 1), (y + 1))) && !selection_getpoint((x - 1), (y + 1), (tmp))) && !sel_flood_havepoint((x - 1), (y + 1), dx, dy, idx))) do { if ((idx < SEL_FLOOD_STACK)) { dx[idx] = (x - 1); dy[idx] = (y + 1); idx++; } else panic(floodfill_stack_overrun); } while (0) } while (0);
            do { if ((((isok((x + 1), (y - 1)) && (selection_flood_check_func[0])((x + 1), (y - 1))) && !selection_getpoint((x + 1), (y - 1), (tmp))) && !sel_flood_havepoint((x + 1), (y - 1), dx, dy, idx))) do { if ((idx < SEL_FLOOD_STACK)) { dx[idx] = (x + 1); dy[idx] = (y - 1); idx++; } else panic(floodfill_stack_overrun); } while (0) } while (0);
        }
    } while (idx > 0);

    selection_free(tmp, TRUE);
    } finally { stack_pop($frame); }
}
export const SEL_FLOOD_STACK = (COLNO * ROWNO);

/* McIlroy's Ellipse Algorithm */
export function selection_do_ellipse(
    ov,
    xc, yc,
    a, b,
    filled) { /* void */
 /* e(x,y) = b^2*x^2 + a^2*y^2 - a^2*b^2 */
    let x = 0, y = b;
    let a2 = a * a, b2 = b * b;
    let crit1 = -(Math.trunc(a2 / 4) + a % 2 + b2);
    let crit2 = -(Math.trunc(b2 / 4) + b % 2 + a2);
    let crit3 = -(Math.trunc(b2 / 4) + b % 2);
    let t = -a2 * y; /* e(x+1/2,y-1/2) - (a^2+b^2)/4 */
    let dxt = 2 * b2 * x, dyt = -2 * a2 * y;
    let d2xt = 2 * b2, d2yt = 2 * a2;
    let width = 1;
    let i;

    if (!ov)
        return;

    filled = +!filled;

    if (!filled) {
        while (y >= 0 && x <= a) {
            selection_setpoint(xc + x, yc + y, ov, 1);
            if (x != 0 || y != 0)
                selection_setpoint(xc - x, yc - y, ov, 1);
            if (x != 0 && y != 0) {
                selection_setpoint(xc + x, yc - y, ov, 1);
                selection_setpoint(xc - x, yc + y, ov, 1);
            }
            if (t + b2 * x <= crit1       /* e(x+1,y-1/2) <= 0 */
                || t + a2 * y <= crit3) { /* e(x+1/2,y) <= 0 */
                x++;
                dxt += d2xt;
                t += dxt;
            } else if (t - a2 * y > crit2) { /* e(x+1/2,y-1) > 0 */
                y--;
                dyt += d2yt;
                t += dyt;
            } else {
                x++;
                dxt += d2xt;
                t += dxt;
                y--;
                dyt += d2yt;
                t += dyt;
            }
        }
    } else {
        while (y >= 0 && x <= a) {
            if (t + b2 * x <= crit1       /* e(x+1,y-1/2) <= 0 */
                || t + a2 * y <= crit3) { /* e(x+1/2,y) <= 0 */
                x++;
                dxt += d2xt;
                t += dxt;
                width += 2;
            } else if (t - a2 * y > crit2) { /* e(x+1/2,y-1) > 0 */
                for (i = 0; i < width; i++)
                    selection_setpoint(xc - x + i, yc - y, ov, 1);
                if (y != 0)
                    for (i = 0; i < width; i++)
                        selection_setpoint(xc - x + i, yc + y, ov, 1);
                y--;
                dyt += d2yt;
                t += dyt;
            } else {
                for (i = 0; i < width; i++)
                    selection_setpoint(xc - x + i, yc - y, ov, 1);
                if (y != 0)
                    for (i = 0; i < width; i++)
                        selection_setpoint(xc - x + i, yc + y, ov, 1);
                x++;
                dxt += d2xt;
                t += dxt;
                y--;
                dyt += d2yt;
                t += dyt;
                width += 2;
            }
        }
    }
}

/* square of distance from line segment (x1,y1, x2,y2) to point (x3,y3) */
function line_dist_coord(x1, y1, x2, y2, x3, y3) { /* long long */
    let px = x2 - x1;
    let py = y2 - y1;
    let s = px * px + py * py;
    let x, y, dx, dy, distsq = 0;
    let lu = 0;

    if (x1 == x2 && y1 == y2)
        return dist2(x1, y1, x3, y3);

    lu = ((x3 - x1) * px + (y3 - y1) * py) / s;
    if (lu > 1)
        lu = 1;
    else if (lu < 0)
        lu = 0;

    x = long(x1 + lu * px);
    y = long(y1 + lu * py);
    dx = x - x3;
    dy = y - y3;
    distsq = dx * dx + dy * dy;

    return distsq;
}

/* guts of l_selection_gradient */
export function selection_do_gradient(
    ov,
    x, y,
    x2, y2,
    gtyp,
    mind, maxd) { /* void */
    let dx, dy, dofs;

    if (mind > maxd) {
        let tmp = mind;
        mind = maxd;
        maxd = tmp;
    }

    dofs = maxd * maxd - mind * mind;
    if (dofs < 1)
        dofs = 1;

    switch (gtyp) {
    default:
        impossible(_("Unrecognized gradient type! Defaulting to radial..."));
        /* FALLTHROUGH */;
        /* FALLTHRU */
    case SEL_GRADIENT_RADIAL: {
        for (dx = 0; dx < COLNO; dx++)
            for (dy = 0; dy < ROWNO; dy++) {
                let d0 = line_dist_coord(x, y, x2, y2, dx, dy);

                if (d0 <= mind * mind
                    || (d0 <= maxd * maxd && d0 - mind * mind < rn2(dofs)))
                    selection_setpoint(dx, dy, ov, 1);
            }
        break;
    }
    case SEL_GRADIENT_SQUARE: {
        for (dx = 0; dx < COLNO; dx++)
            for (dy = 0; dy < ROWNO; dy++) {
                let d1 = line_dist_coord(x, y, x2, y2, x, dy);
                let d2 = line_dist_coord(x, y, x2, y2, dx, y);
                let d3 = line_dist_coord(x, y, x2, y2, x2, dy);
                let d4 = line_dist_coord(x, y, x2, y2, dx, y2);
                let d5 = line_dist_coord(x, y, x2, y2, dx, dy);
                let d0 = min(d5, min(max(d1, d2), max(d3, d4)));

                if (d0 <= mind * mind
                    || (d0 <= maxd * maxd && d0 - mind * mind < rn2(dofs)))
                    selection_setpoint(dx, dy, ov, 1);
            }
        break;
    } /*case*/
    } /*switch*/
}

/* bresenham line algo */
export function selection_do_line(
    x1, y1,
    x2, y2,
    ov) { /* void */
    let d0, dx, dy, ai, bi, xi, yi;

    if (x1 < x2) {
        xi = 1;
        dx = x2 - x1;
    } else {
        xi = -1;
        dx = x1 - x2;
    }
    if (y1 < y2) {
        yi = 1;
        dy = y2 - y1;
    } else {
        yi = -1;
        dy = y1 - y2;
    }

    selection_setpoint(x1, y1, ov, 1);

    if (!dx && !dy) {
        /* single point - already all done */
        ;
    } else if (dx > dy) {
        ai = (dy - dx) * 2;
        bi = dy * 2;
        d0 = bi - dx;
        do {
            if (d0 >= 0) {
                y1 += yi;
                d0 += ai;
            } else
                d0 += bi;
            x1 += xi;
            selection_setpoint(x1, y1, ov, 1);
        } while (x1 != x2);
    } else {
        ai = (dx - dy) * 2;
        bi = dx * 2;
        d0 = bi - dy;
        do {
            if (d0 >= 0) {
                x1 += xi;
                d0 += ai;
            } else
                d0 += bi;
            y1 += yi;
            selection_setpoint(x1, y1, ov, 1);
        } while (y1 != y2);
    }
}

export function selection_do_randline(
    x1, y1,
    x2, y2,
    rough,
    rec,
    ov) { /* void */
    let mx, my;
    let dx, dy;

    if (rec < 1 || (x2 == x1 && y2 == y1))
        return;

    if (rough > (((abs(x2 - x1)) > (abs(y2 - y1))) ? (abs(x2 - x1)) : (abs(y2 - y1))))
        rough = (((abs(x2 - x1)) > (abs(y2 - y1))) ? (abs(x2 - x1)) : (abs(y2 - y1)));

    if (rough < 2) {
        mx = Math.trunc((x1 + x2) / 2);
        my = Math.trunc((y1 + y2) / 2);
    } else {
        do {
            dx = rn2(rough) - Math.trunc(rough / 2);
            dy = rn2(rough) - Math.trunc(rough / 2);
            mx = Math.trunc((x1 + x2) / 2) + dx;
            my = Math.trunc((y1 + y2) / 2) + dy;
        } while ((mx > COLNO - 1 || mx < 0 || my < 0 || my > ROWNO - 1));
    }

    if (!selection_getpoint(mx, my, ov)) {
        selection_setpoint(mx, my, ov, 1);
    }

    rough = Math.trunc((rough * 2) / 3);

    rec--;

    selection_do_randline(x1, y1, mx, my, rough, rec, ov);
    selection_do_randline(mx, my, x2, y2, rough, rec, ov);

    selection_setpoint(x2, y2, ov, 1);
}

export function selection_iterate(
    ov,
    func,
    arg) { /* void */
    const $frame = stack_frame(); try {
    let x, y;
    let rect = struct_assign(stack_struct(struct_nhrect), cg.zeroNhRect);

    if (!ov)
        return;

    selection_getbounds(ov, rect);

    for (x = rect.lx; x <= rect.hx; x++)
        for (y = rect.ly; y <= rect.hy; y++)
            if (isok(x,y) && selection_getpoint(x, y, ov))
                func(x, y, arg);
    } finally { stack_pop($frame); }
}

/* selection is not rectangular, or has holes in it */
export function selection_is_irregular(sel) { /* boolean */
    const $frame = stack_frame(); try {
    let x, y;
    let rect = struct_assign(stack_struct(struct_nhrect), cg.zeroNhRect);

    selection_getbounds(sel, rect);

    for (x = rect.lx; x <= rect.hx; x++)
        for (y = rect.ly; y <= rect.hy; y++)
            if (isok(x,y) && !selection_getpoint(x, y, sel))
                return TRUE;

    return FALSE;
    } finally { stack_pop($frame); }
}

/* return a description of the selection size */
export function selection_size_description(sel, buf) { /* char * */
    const $frame = stack_frame(); try {
    let rect = struct_assign(stack_struct(struct_nhrect), cg.zeroNhRect);
    let dx, dy;

    selection_getbounds(sel, rect);
    dx = rect.hx - rect.lx + 1;
    dy = rect.hy - rect.ly + 1;
    sprintf(buf, _("%s %i by %i"), selection_is_irregular(sel) ? _("irregularly shaped")
            : (dx == dy) ? _("square")
              : _("rectangular"), dx, dy)

;
    return buf;
    } finally { stack_pop($frame); }
}

export function selection_from_mkroom(croom) { /* struct selectionvar * */
    let sel = selection_new();
    let x, y;
    let rmno;

    if (!croom && gc.coder && gc.coder.croom)
        croom = gc.coder.croom;
    if (!croom)
        return sel;

    rmno = unsigned((ptr_diff(croom, svr.rooms[0]) + ROOMOFFSET));
    for (y = croom.ly; y <= croom.hy; y++)
        for (x = croom.lx; x <= croom.hx; x++)
            if (isok(x, y) && !levl()[x][y].edge
                && levl()[x][y].roomno == rmno)
                selection_setpoint(x, y, sel, 1);
    return sel;
}

export function selection_force_newsyms(sel) { /* void */
    let x, y;

    for (x = 1; x < sel.wid; x++)
        for (y = 0; y < sel.hei; y++)
            if (selection_getpoint(x, y, sel))
                newsym_force(x, y);
}

/*selvar.c*/

import { COLNO, FALSE, ROWNO, TRUE } from "./global.h.js";
import { struct_selectionvar } from "./hack.h.js";
import { max, min } from "./hack.h.macros.js";
import { ROOMOFFSET } from "./mkroom.h.js";
import { struct_nhrect } from "./rect.h.js";
import { levl } from "./rm.h.macros.js";
import {
    SEL_GRADIENT_RADIAL, SEL_GRADIENT_SQUARE, W_EAST, W_NORTH, W_RANDOM, W_SOUTH, W_WEST,
} from "./sp_lev.h.js";
import { char, long, ord, short, sizeof, sizeof_string, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { abs, free, memset, sprintf } from "../rt/libc.js";
import { init_string, stack_array, stack_struct, static_array, static_var } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, fnptr_t, ptr_diff, struct_assign, view_of } from "../rt/struct.js";
import { alloc, dupstr } from "./alloc.js";
import { isok } from "./cmd.js";
import { cg, gc, svr } from "./decl.js";
import { newsym_force } from "./display.js";
import { panic } from "./end.js";
import { dist2 } from "./hacklib.js";
import { impossible } from "./pline.js";
import { rn2 } from "./rnd.js";
import { match_maptyps, random_wdir } from "./sp_lev.js";
