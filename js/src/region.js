/* NetHack 5.0	region.c	$NHDT-Date: 1727251269 2024/09/25 08:01:09 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.104 $ */
/* Copyright (c) 1996 by Jean-Christophe Collet  */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * This should really go into the level structure, but
 * I'll start here for ease. It *WILL* move into the level
 * structure eventually.
 */

export const NO_CALLBACK = (-1);

export const EXPIRE_GAS_CLOUD = 1; export const INSIDE_GAS_CLOUD = 0; const callbacks = static_array("callbacks", fnptr_t, null, [

    inside_gas_cloud,

    expire_gas_cloud
]);

/* Should be inlined. */
export function inside_rect(r, x, y) { /* boolean */
    return (+(x >= r.lx && x <= r.hx && y >= r.ly && y <= r.hy));
}

/*
 * Check if a point is inside a region.
 */
export function inside_region(reg, x, y) { /* boolean */
    let i;

    if (reg == null || !inside_rect(reg.bounding_box, x, y))
        return FALSE;
    for (i = 0; i < reg.nrects; i++)
        if (inside_rect(ptr_add(reg.rects, i), x, y))
            return TRUE;
    return FALSE;
}

/*
 * Create a region. It does not activate it.
 */
export function create_region(rects, nrect) { /* NhRegion * */
    let i;
    let reg;

    reg = view_of(NhRegion, addr_of(alloc(sizeof(NhRegion))));
    memset(addr_of(reg), 0, sizeof(NhRegion));
    /* Determines bounding box */
    if (nrect > 0) {
        struct_assign(reg.bounding_box, ptr_add(rects, 0));
    } else {
        reg.bounding_box.lx = COLNO;
        reg.bounding_box.ly = ROWNO;
        reg.bounding_box.hx = 0; /* 1 */
        reg.bounding_box.hy = 0;
    }
    reg.nrects = nrect;
    reg.rects = (nrect > 0) ? view_of(struct_nhrect, addr_of(alloc(unsigned(Math.imul(unsigned(nrect), sizeof(struct_nhrect)))))) : null;
    for (i = 0; i < nrect; i++) {
        if (ptr_add(rects, i).lx < reg.bounding_box.lx)
            reg.bounding_box.lx = ptr_add(rects, i).lx;
        if (ptr_add(rects, i).ly < reg.bounding_box.ly)
            reg.bounding_box.ly = ptr_add(rects, i).ly;
        if (ptr_add(rects, i).hx > reg.bounding_box.hx)
            reg.bounding_box.hx = ptr_add(rects, i).hx;
        if (ptr_add(rects, i).hy > reg.bounding_box.hy)
            reg.bounding_box.hy = ptr_add(rects, i).hy;
        struct_assign(ptr_add(reg.rects, i), ptr_add(rects, i));
    }
    reg.ttl = -1; /* Defaults */
    reg.attach_2_u = FALSE;
    reg.attach_2_m = 0;
    /* reg->attach_2_o = NULL; */
    reg.enter_msg = 0;
    reg.leave_msg = 0;
    reg.expire_f = NO_CALLBACK;
    reg.enter_f = NO_CALLBACK;
    reg.can_enter_f = NO_CALLBACK;
    reg.leave_f = NO_CALLBACK;
    reg.can_leave_f = NO_CALLBACK;
    reg.inside_f = NO_CALLBACK;
    clear_hero_inside(reg);
    clear_heros_fault(reg);
    reg.n_monst = 0;
    reg.max_monst = 0;
    reg.monsters = null;
    struct_assign(reg.arg, cg.zeroany);
    return reg;
}

/*
 * Add rectangle to region.
 */
export function add_rect_to_reg(reg, rect) { /* void */
    let tmp_rect;

    tmp_rect = view_of(struct_nhrect, addr_of(alloc(unsigned(Math.imul(unsigned((reg.nrects + 1)), sizeof(struct_nhrect))))));
    if (reg.nrects > 0) {
        memcpy(addr_of(tmp_rect), addr_of(reg.rects),
                      unsigned(Math.imul(unsigned(reg.nrects), sizeof(struct_nhrect))));
        free(addr_of(reg.rects));
    }
    struct_assign(ptr_add(tmp_rect, reg.nrects), rect);
    reg.nrects++;
    reg.rects = tmp_rect;
    /* Update bounding box if needed */
    if (reg.bounding_box.lx > rect.lx)
        reg.bounding_box.lx = rect.lx;
    if (reg.bounding_box.ly > rect.ly)
        reg.bounding_box.ly = rect.ly;
    if (reg.bounding_box.hx < rect.hx)
        reg.bounding_box.hx = rect.hx;
    if (reg.bounding_box.hy < rect.hy)
        reg.bounding_box.hy = rect.hy;
}

/*
 * Add a monster to the region
 */
export function add_mon_to_reg(reg, mon) { /* void */
    let i;
    let tmp_m;

    /* if this is a long worm, it might already be present in the region;
       only include it once no matter how segments the region contains */
    if (mon_in_region(reg, mon)) {
        if (mon.data != mons[PM_LONG_WORM])
            impossible(_("add_mon_to_reg: %s [#%u] already in region."),
                       m_monnam(mon), mon.m_id);
        return;
    }
    if (reg.max_monst <= reg.n_monst) {
        tmp_m = ref_to(unsigned, addr_of(alloc(unsigned(Math.imul(sizeof(unsigned), unsigned((reg.max_monst + MONST_INC)))))))
;
        if (reg.max_monst > 0) {
            for (i = 0; i < reg.max_monst; i++)
                tmp_m[i] = reg.monsters[i];
            free(addr_of(reg.monsters));
        }
        reg.monsters = tmp_m;
        reg.max_monst += MONST_INC;
    }
    reg.monsters[reg.n_monst++] = mon.m_id;
}

/*
 * Remove a monster from the region list (it left or died...)
 */
export function remove_mon_from_reg(reg, mon) { /* void */
    let i;

    for (i = 0; i < reg.n_monst; i++)
        if (reg.monsters[i] == mon.m_id) {
            reg.n_monst--;
            reg.monsters[i] = reg.monsters[reg.n_monst];
            return;
        }
}

/*
 * Check if a monster is inside the region.
 * It's probably quicker to check with the region internal list
 * than to check for coordinates.
 */
export function mon_in_region(reg, mon) { /* boolean */
    let i;

    for (i = 0; i < reg.n_monst; i++)
        if (reg.monsters[i] == mon.m_id)
            return TRUE;
    return FALSE;
}

/* #if 0: not in this build */

/*
 * Free mem from region.
 */
export function free_region(reg) { /* void */
    if (reg) {
        if (reg.rects)
            free(addr_of(reg.rects));
        if (reg.monsters)
            free(addr_of(reg.monsters));
        if (reg.enter_msg)
            free(reg.enter_msg);
        if (reg.leave_msg)
            free(reg.leave_msg);
        free(addr_of(reg));
    }
}

/*
 * Add a region to the list.
 * This actually activates the region.
 */
export function add_region(reg) { /* void */
    let tmp_reg;
    let i, j;

    if (gm.max_regions <= svn.n_regions) {
        tmp_reg = gr.regions;
        gr.regions =
            ref_to(ptr_to(NhRegion), addr_of(alloc(unsigned(Math.imul(unsigned((gm.max_regions + 10)), sizeof(ptr_to(NhRegion)))))));
        if (gm.max_regions > 0) {
            memcpy(addr_of(gr.regions), addr_of(tmp_reg),
                          unsigned(Math.imul(unsigned(gm.max_regions), sizeof(ptr_to(NhRegion)))));
            free(addr_of(tmp_reg));
        }
        gm.max_regions += 10;
    }
    gr.regions[svn.n_regions] = reg;
    svn.n_regions++;
    /* Check for monsters inside the region */
    for (i = reg.bounding_box.lx; i <= reg.bounding_box.hx; i++)
        for (j = reg.bounding_box.ly; j <= reg.bounding_box.hy; j++) {
            let mtmp;
            let is_inside = FALSE;

            /* Some regions can cross the level boundaries */
            if (!isok(i, j))
                continue;
            if (inside_region(reg, i, j)) {
                is_inside = TRUE;
                /* if there's a monster here, add it to the region */
                if ((mtmp = m_at(i, j)) != null

                    ) {
                    add_mon_to_reg(reg, mtmp);
                }
            }
            if (reg.visible) {
                if (is_inside)
                    block_point(i, j);
                if (cansee(i, j))
                    newsym(i, j);
            }
        }
    /* Check for player now... */
    if (inside_region(reg, u.ux, u.uy))
        set_hero_inside(reg);
    else
        clear_hero_inside(reg);
}

/*
 * Remove a region from the list & free it.
 */
export function remove_region(reg) { /* void */
    let i, x, y;

    for (i = 0; i < svn.n_regions; i++)
        if (gr.regions[i] == reg)
            break;
    if (i == svn.n_regions)
        return;

    /* remove region before potential newsym() calls, but don't free it yet */
    if (--svn.n_regions != i)
        gr.regions[i] = gr.regions[svn.n_regions];
    gr.regions[svn.n_regions] = null;

    /* Update screen if necessary */
    reg.ttl = -2; /* for visible_region_at */
    if (reg.visible) {
        let pass;
        let tmp_uinwater = u.uinwater;

        /* need to process the region's spots twice, first unblocking all
           locations which no longer block line-of-sight, then redrawing
           spots within revised line-of-sight; skip second pass if blind */
        for (pass = 1; pass <= (Blind() ? 1 : 2); ++pass) {
            u.uinwater = unsigned((pass == 1) ? 0 : tmp_uinwater);

            for (x = reg.bounding_box.lx; x <= reg.bounding_box.hx; x++)
                for (y = reg.bounding_box.ly; y <= reg.bounding_box.hy; y++)
                    if (isok(x, y) && inside_region(reg, x, y)) {
                        if (pass == 1) {
                            if (!does_block(x, y, levl()[x][y]))
                                unblock_point(x, y);
                        } else { /* pass==2 */
                            if (cansee(x, y))
                                newsym(x, y);
                        }
                    }
        }
        u.uinwater = unsigned(tmp_uinwater);
    }
    free_region(reg);
}

/*
 * Remove all regions and clear all related data.  This must be done
 * when changing level, for instance.
 */
export function clear_regions() { /* void */
    let i;

    for (i = 0; i < svn.n_regions; i++)
        free_region(gr.regions[i]);
    svn.n_regions = 0;
    if (gm.max_regions > 0)
        free(addr_of(gr.regions));
    gm.max_regions = 0;
    gr.regions = null;
}

/*
 * This function is called every turn.
 * It makes the regions age, if necessary and calls the appropriate
 * callbacks when needed.
 */
export function run_regions() { /* void */
    let i, j, k;
    let f_indx;

    /* reset some messaging variables */
    gg.gas_cloud_diss_within = FALSE;
    gg.gas_cloud_diss_seen = 0;

    /* End of life ? */
    /* Do it backward because the array will be modified */
    for (i = svn.n_regions - 1; i >= 0; i--) {
        if (gr.regions[i].ttl == 0) {
            if ((f_indx = gr.regions[i].expire_f) == NO_CALLBACK
                || (callbacks[f_indx])(addr_of(gr.regions[i]), 0))
                remove_region(gr.regions[i]);
        }
    }

    /* Process remaining regions */
    for (i = 0; i < svn.n_regions; i++) {
        /* Make the region age */
        if (gr.regions[i].ttl > 0)
            gr.regions[i].ttl--;
        /* Check if player is inside region */
        f_indx = gr.regions[i].inside_f;
        if (f_indx != NO_CALLBACK && hero_inside(gr.regions[i]))
            (callbacks[f_indx])(addr_of(gr.regions[i]), 0);
        /* Check if any monster is inside region */
        if (f_indx != NO_CALLBACK) {
            for (j = 0; j < gr.regions[i].n_monst; j++) {
                let mtmp = find_mid(gr.regions[i].monsters[j], FM_FMON);

                if (!mtmp || DEADMONSTER(mtmp)
                    || (callbacks[f_indx])(addr_of(gr.regions[i]), addr_of(mtmp))) {
                    /* The monster died, remove it from list */
                    k = (gr.regions[i].n_monst -= 1);
                    gr.regions[i].monsters[j] = gr.regions[i].monsters[k];
                    gr.regions[i].monsters[k] = 0;
                    --j; /* current slot has been reused; recheck it next */
                }
            }
        }
    }

    if (gg.gas_cloud_diss_within) {
        pline_The(_("gas cloud around you dissipates."));
        /* normally won't see additional dissipation when within */
        /* FIXME? this assumes that additional dissipation is close by */
        if (u.xray_range <= 1)
            gg.gas_cloud_diss_seen = 0;
        gg.gas_cloud_diss_within = FALSE;
    }
    if (gg.gas_cloud_diss_seen) {
        You_see(_("%s gas cloud%s dissipate."),
                (gg.gas_cloud_diss_seen == 1) ? _("a") : _("some"),
                plur(gg.gas_cloud_diss_seen));
        gg.gas_cloud_diss_seen = 0;
    }
}

/*
 * check whether player enters/leaves one or more regions.
 */
export function in_out_region(x, y) { /* boolean */
    let i, f_indx = 0;

    /* First check if hero can do the move */
    for (i = 0; i < svn.n_regions; i++) {
        if (gr.regions[i].attach_2_u)
            continue;
        if (inside_region(gr.regions[i], x, y)
            ? (!hero_inside(gr.regions[i])
               && (f_indx = gr.regions[i].can_enter_f) != NO_CALLBACK)
            : (hero_inside(gr.regions[i])
               && (f_indx = gr.regions[i].can_leave_f) != NO_CALLBACK)) {
            if (!(callbacks[f_indx])(addr_of(gr.regions[i]), 0))
                return FALSE;
        }
    }

    /* Callbacks for the regions hero does leave */
    for (i = 0; i < svn.n_regions; i++) {
        if (gr.regions[i].attach_2_u)
            continue;
        if (hero_inside(gr.regions[i])
            && !inside_region(gr.regions[i], x, y)) {
            clear_hero_inside(gr.regions[i]);
            if (gr.regions[i].leave_msg != 0)
                pline1(gr.regions[i].leave_msg);
            if ((f_indx = gr.regions[i].leave_f) != NO_CALLBACK)
                (callbacks[f_indx])(addr_of(gr.regions[i]), 0);
        }
    }

    /* Callbacks for the regions hero does enter */
    for (i = 0; i < svn.n_regions; i++) {
        if (gr.regions[i].attach_2_u)
            continue;
        if (!hero_inside(gr.regions[i])
            && inside_region(gr.regions[i], x, y)) {
            set_hero_inside(gr.regions[i]);
            if (gr.regions[i].enter_msg != 0)
                pline1(gr.regions[i].enter_msg);
            if ((f_indx = gr.regions[i].enter_f) != NO_CALLBACK)
                (callbacks[f_indx])(addr_of(gr.regions[i]), 0);
        }
    }

    return TRUE;
}

/*
 * check whether a monster enters/leaves one or more regions.
 */
export function m_in_out_region(mon, x, y) { /* boolean */
    let i, f_indx = 0;

    /* First check if mon can do the move */
    for (i = 0; i < svn.n_regions; i++) {
        if (gr.regions[i].attach_2_m == mon.m_id)
            continue;
        if (inside_region(gr.regions[i], x, y)
            ? (!mon_in_region(gr.regions[i], mon)
               && (f_indx = gr.regions[i].can_enter_f) != NO_CALLBACK)
            : (mon_in_region(gr.regions[i], mon)
               && (f_indx = gr.regions[i].can_leave_f) != NO_CALLBACK)) {
            if (!(callbacks[f_indx])(addr_of(gr.regions[i]), addr_of(mon)))
                return FALSE;
        }
    }

    /* Callbacks for the regions mon does leave */
    for (i = 0; i < svn.n_regions; i++) {
        if (gr.regions[i].attach_2_m == mon.m_id)
            continue;
        if (mon_in_region(gr.regions[i], mon)
            && !inside_region(gr.regions[i], x, y)) {
            remove_mon_from_reg(gr.regions[i], mon);
            if ((f_indx = gr.regions[i].leave_f) != NO_CALLBACK)
                (callbacks[f_indx])(addr_of(gr.regions[i]), addr_of(mon));
        }
    }

    /* Callbacks for the regions mon does enter */
    for (i = 0; i < svn.n_regions; i++) {
        if (gr.regions[i].attach_2_m == mon.m_id)
            continue;
        if (!mon_in_region(gr.regions[i], mon)
            && inside_region(gr.regions[i], x, y)) {
            add_mon_to_reg(gr.regions[i], mon);
            if ((f_indx = gr.regions[i].enter_f) != NO_CALLBACK)
                (callbacks[f_indx])(addr_of(gr.regions[i]), addr_of(mon));
        }
    }

    return TRUE;
}

/*
 * Checks player's regions after a teleport for instance.
 */
export function update_player_regions() { /* void */
    let i;

    for (i = 0; i < svn.n_regions; i++)
        if (!gr.regions[i].attach_2_u
            && inside_region(gr.regions[i], u.ux, u.uy))
            set_hero_inside(gr.regions[i]);
        else
            clear_hero_inside(gr.regions[i]);
}

/*
 * Ditto for a specified monster.
 */
export function update_monster_region(mon) { /* void */
    let i;

    for (i = 0; i < svn.n_regions; i++) {
        if (inside_region(gr.regions[i], mon.mx, mon.my)) {
            if (!mon_in_region(gr.regions[i], mon))
                add_mon_to_reg(gr.regions[i], mon);
        } else {
            if (mon_in_region(gr.regions[i], mon))
                remove_mon_from_reg(gr.regions[i], mon);
        }
    }
}

/* #if 0: not in this build */

/* per-turn damage inflicted by visible region; hides details from caller */
export function reg_damg(reg) { /* int */
    let damg = (!reg.visible || reg.ttl == -2) ? 0 : reg.arg.a_int;

    return damg;
}

/* check whether current level has any visible regions */
export function any_visible_region() { /* boolean */
    let i;

    for (i = 0; i < svn.n_regions; i++) {
        if (!gr.regions[i].visible || gr.regions[i].ttl == -2)
            continue;
        return TRUE;
    }
    return FALSE;
}

/* for the wizard mode #timeout command */
export function visible_region_summary(win) { /* void */
    const $frame = stack_frame(); try {
    let reg;
    let buf = stack_array(char, BUFSZ), typbuf = stack_array(char, QBUFSZ);
    let i, damg, hdr_done = 0;
    let fldsep = iflags.menu_tab_sep ? _("\t") : _("  ");

    for (i = 0; i < svn.n_regions; i++) {
        reg = gr.regions[i];
        if (!reg.visible || reg.ttl == -2)
            continue;

        if (!hdr_done++) {
            putstr()(win, 0, _(""));
            putstr()(win, 0, _("Visible regions"));
        }
        /*
         * TODO? sort the regions by time-to-live or by bounding box.
         */

        /* we display relative time (turns left) rather than absolute
           (the turn when region will go away);
           since time-to-live has already been decremented, regions
           which are due to timeout on the next turn have ttl==0;
           adding 1 is intended to make the display be less confusing */
        sprintf(buf, _("%5lld"), reg.ttl + 1);
        damg = reg.arg.a_int;
        if (damg)
            sprintf(typbuf, _("poison gas (%d)"), damg);
        else
            strcpy(typbuf, _("vapor"));
        sprintf(eos(buf), _("%s%-16s"), fldsep, typbuf);
        sprintf(eos(buf), _("%s@[%d,%d..%d,%d]"), fldsep, reg.bounding_box.lx, reg.bounding_box.ly, reg.bounding_box.hx, reg.bounding_box.hy)

;
        putstr()(win, 0, buf);
    }
    } finally { stack_pop($frame); }
}

/*
 * Check if a spot is under a visible region (eg: gas cloud).
 * Returns NULL if not, otherwise returns region.
 */
export function visible_region_at(x, y) { /* NhRegion * */
    let i;

    for (i = 0; i < svn.n_regions; i++) {
        if (!gr.regions[i].visible || gr.regions[i].ttl == -2)
            continue;
        if (inside_region(gr.regions[i], x, y))
            return gr.regions[i];
    }
    return null;
}

export function show_region(reg, x, y) { /* void */
    show_glyph(x, y, reg.glyph);
}

/**
 * save_regions :
 */
export function save_regions(nhfp) { /* void */
    const $frame = stack_frame(); try {
    var r;
    var i, j;
    var n = stack_var(unsigned);

    skip_lots: { if (!update_file(nhfp))
        break skip_lots;;
    /* timestamp */
    sfo_long(nhfp, ref_of(svm, "moves"), _("region-tmstamp"));
    Sfo_int(nhfp, ref_of(svn, "n_regions"), _("region-region_count"));

    for (i = 0; i < svn.n_regions; i++) {
        r = gr.regions[i];
        Sfo_nhrect(nhfp, r.bounding_box, _("region-bounding_box"));
        Sfo_short(nhfp, ref_of(r, "nrects"), _("region-nrects"));
        for (j = 0; j < r.nrects; j++) {
            Sfo_nhrect(nhfp, ptr_add(r.rects, j), _("region-rect"));
        }
        Sfo_boolean(nhfp, addr_of(ref_of(r, "attach_2_u")), _("region-attach_2_u"));
        Sfo_unsigned(nhfp, ref_of(r, "attach_2_m"), _("region-attach_2_m"));
        n[0] = 0;
        n[0] = !r.enter_msg ? 0 : strlen(r.enter_msg);
        Sfo_unsigned(nhfp, n, _("region-enter_msg_length"));
        if (n[0] > 0) {
            Sfo_char(nhfp, r.enter_msg,
                     _("region-enter_msg"), int((n[0])));
        }
        n[0] = !r.leave_msg ? 0 : strlen(r.leave_msg);
        Sfo_unsigned(nhfp, n, _("region-leave_msg_length"));
        if (n[0] > 0) {
            Sfo_char(nhfp, r.leave_msg, _("region-leave_msg"), int((n[0])));
        }
        sfo_long(nhfp, ref_of(r, "ttl"), _("region-ttl"));
        Sfo_short(nhfp, ref_of(r, "expire_f"), _("region-expire_f"));
        Sfo_short(nhfp, ref_of(r, "can_enter_f"), _("region-can_enter_f"));
        Sfo_short(nhfp, ref_of(r, "enter_f"), _("region-enter_f"));
        Sfo_short(nhfp, ref_of(r, "can_leave_f"), _("region-can_leave_f"));
        Sfo_short(nhfp, ref_of(r, "leave_f"), _("region-leave_f"));
        Sfo_short(nhfp, ref_of(r, "inside_f"), _("region-inside_f"));
        Sfo_unsigned(nhfp, ref_of(r, "player_flags"), _("region-player_flags"));
        Sfo_short(nhfp, ref_of(r, "n_monst"), _("region-monster_count"));

        for (j = 0; j < r.n_monst; j++) {
            Sfo_unsigned(nhfp, r.monsters.subarray(j), _("region-monster"));
        }
        Sfo_boolean(nhfp, addr_of(ref_of(r, "visible")), _("region-visible"));
        Sfo_int(nhfp, ref_of(r, "glyph"), _("region-glyph"));
        Sfo_any(nhfp, r.arg, _("region-arg"));
    }
 }
    if (release_data(nhfp))
        clear_regions();
    } finally { stack_pop($frame); }
}

export function rest_regions(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let r;
    let i, j;
    let n = stack_var(unsigned, 0);
    let tmstamp = stack_var(long, 0);
    let msg_buf;
    let ghostly = +(nhfp.ftype == NHF_BONESFILE);

    clear_regions(); /* Just for security */
    sfi_long(nhfp, tmstamp, _("region-tmstamp"));
    if (ghostly)
        tmstamp[0] = 0;
    else
        tmstamp[0] = (svm.moves - tmstamp[0]);
    sfi_int(nhfp, ref_of(svn, "n_regions"), _("region-region_count"));
    gm.max_regions = svn.n_regions;
    if (svn.n_regions > 0)
        gr.regions = ref_to(ptr_to(NhRegion), addr_of(alloc(unsigned(Math.imul(unsigned(svn.n_regions), sizeof(ptr_to(NhRegion)))))));
    for (i = 0; i < svn.n_regions; i++) {
        r = gr.regions[i] = view_of(NhRegion, addr_of(alloc(sizeof(NhRegion))));
        Sfi_nhrect(nhfp, r.bounding_box, _("region-bounding box"));
        Sfi_short(nhfp, ref_of(r, "nrects"), _("region-nrects"));
        if (r.nrects > 0)
            r.rects = view_of(struct_nhrect, addr_of(alloc(unsigned(Math.imul(unsigned(r.nrects), sizeof(struct_nhrect))))));
        else
            r.rects = null;
        for (j = 0; j < r.nrects; j++) {
           Sfi_nhrect(nhfp, ptr_add(r.rects, j), _("region-rect"));
        }

        Sfi_boolean(nhfp, addr_of(ref_of(r, "attach_2_u")), _("region-attach_2_u"));
        sfi_unsigned(nhfp, ref_of(r, "attach_2_m"), _("region-attach_2_m"));
        sfi_unsigned(nhfp, n, _("region-enter_msg_length"));
        if (n[0] > 0) {
            msg_buf = addr_of(alloc(unsigned(n[0] + 1)));
            Sfi_char(nhfp, msg_buf, _("region-enter_msg"), int(n[0]));
            chars[msg_buf + (n[0])] = ord('\0');
        } else {
            msg_buf = 0;
        }
        r.enter_msg = msg_buf;

        sfi_unsigned(nhfp, n, _("region-leave_msg_length"));
        if (n[0] > 0) {
            msg_buf = addr_of(alloc(unsigned(n[0] + 1)));
            Sfi_char(nhfp, msg_buf, _("region-leave_msg"), int(n[0]));
            chars[msg_buf + (n[0])] = ord('\0');
            r.leave_msg = msg_buf;
        } else {
            msg_buf = 0;
        }
        r.leave_msg = msg_buf;

        sfi_long(nhfp, ref_of(r, "ttl"), _("region-ttl"));
        /* check for expired region */
        if (r.ttl >= 0)
            r.ttl = (r.ttl > tmstamp[0]) ? r.ttl - tmstamp[0] : 0;
        Sfi_short(nhfp, ref_of(r, "expire_f"), _("region-expire_f"));
        Sfi_short(nhfp, ref_of(r, "can_enter_f"), _("region-can_enter_f"));
        Sfi_short(nhfp, ref_of(r, "enter_f"), _("region-enter_f"));
        Sfi_short(nhfp, ref_of(r, "can_leave_f"), _("region-can_leave_f"));
        Sfi_short(nhfp, ref_of(r, "leave_f"), _("region-leave_f"));
        Sfi_short(nhfp, ref_of(r, "inside_f"), _("region-inside_f"));
        sfi_unsigned(nhfp, ref_of(r, "player_flags"), _("region-player_flags"));
        if (ghostly) { /* settings pertained to old player */
            clear_hero_inside(r);
            clear_heros_fault(r);
        }
        Sfi_short(nhfp, ref_of(r, "n_monst"), _("region-monster_count"));
        if (r.n_monst > 0)
            r.monsters = ref_to(unsigned, addr_of(alloc(unsigned(Math.imul(unsigned(r.n_monst), sizeof(unsigned))))));
        else
            r.monsters = null;
        r.max_monst = r.n_monst;
        for (j = 0; j < r.n_monst; j++) {
            sfi_unsigned(nhfp, r.monsters.subarray(j), _("region-monster"));
        }
        Sfi_boolean(nhfp, addr_of(ref_of(r, "visible")), _("region-visible"));
        sfi_int(nhfp, ref_of(r, "glyph"), _("region-glyph"));
        Sfi_any(nhfp, r.arg, _("region-arg"));
    }

    /* remove expired regions, do not trigger the expire_f callback (yet!);
       also update monster lists if this data is coming from a bones file */
    for (i = svn.n_regions - 1; i >= 0; i--) {
        r = gr.regions[i];
        if (r.ttl == 0)
            remove_region(r);
        else if (ghostly && r.n_monst > 0)
            reset_region_mids(r);
    }
    } finally { stack_pop($frame); }
}

/* to support '#stats' wizard-mode command */
export function region_stats(
    hdrfmt,
    hdrbuf,
    count,
    size) { /* void */
    let rg;
    let i;

    /* other stats formats take one parameter; this takes two */
    sprintf(hdrbuf, hdrfmt, NHJS_SIZEOF_NhRegion, NHJS_SIZEOF_NhRect);
    count[0] = svn.n_regions; /* might be 0 even tho max_regions isn't */
    size[0] = gm.max_regions * NHJS_SIZEOF_NhRegion;
    for (i = 0; i < svn.n_regions; ++i) {
        rg = gr.regions[i];
        size[0] += rg.nrects * NHJS_SIZEOF_NhRect;
        if (rg.enter_msg)
            size[0] += unsigned(strlen(rg.enter_msg) + 1);
        if (rg.leave_msg)
            size[0] += unsigned(strlen(rg.leave_msg) + 1);
        size[0] += rg.max_monst * sizeof(unsigned);
    }
    /* ? */
}

/* update monster IDs for region being loaded from bones; `ghostly' implied */
function reset_region_mids(reg) { /* void */
    let i = 0, n = reg.n_monst;
    let mid_list = reg.monsters;

    while (i < n)
        if (!lookup_id_mapping(mid_list[i], mid_list.subarray(i))) {
            /* shrink list to remove missing monster; order doesn't matter */
            mid_list[i] = mid_list[--n];
        } else {
            /* move on to next monster */
            ++i;
        }
    reg.n_monst = n;
    return;
}

/* #if 0: not in this build */

/*--------------------------------------------------------------*
 *                                                              *
 *                      Gas cloud related code                  *
 *                                                              *
 *--------------------------------------------------------------*/

/*
 * Here is an example of an expire function that may prolong
 * region life after some mods...
 */
/*ARGSUSED*/
export function expire_gas_cloud(p1, p2) { /* boolean */
    let reg;
    let damage, pass;
    let x, y;

    reg = view_of(NhRegion, p1);
    damage = reg.arg.a_int;

    /* If it was a thick cloud, it dissipates a little first */
    if (damage >= 5) {
        damage = Math.trunc(damage / 2); /* It dissipates, let's do less damage */
        struct_assign(reg.arg, cg.zeroany);
        reg.arg.a_int = damage;
        reg.ttl = 2; /* Here's the trick : reset ttl */
        return FALSE;  /* THEN return FALSE, means "still there" */
    }

    /* The cloud no longer blocks vision.  cansee() checks shouldn't be made
       until all blocked spots have been unblocked, so we need two passes */
    for (pass = 1; pass <= (Blind() ? 1 : 2); ++pass) {
        for (x = reg.bounding_box.lx; x <= reg.bounding_box.hx; x++) {
            for (y = reg.bounding_box.ly; y <= reg.bounding_box.hy; y++) {
                if (inside_region(reg, x, y)) {
                    if (pass == 1) {
                        if (!does_block(x, y, levl()[x][y]))
                            unblock_point(x, y);
                    } else { /* pass==2 */
                        if (!u.uswallow) {
                            if (u_at(x, y))
                                gg.gas_cloud_diss_within = TRUE;
                            else if (cansee(x, y))
                                gg.gas_cloud_diss_seen++;
                        }
                    }
                }
            }
        }
    }

    return TRUE; /* OK, it's gone, you can free it! */
}

/* returns True if p2 is killed by region p1, False otherwise */
export function inside_gas_cloud(p1, p2) { /* boolean */
    let reg = view_of(NhRegion, p1);
    let mtmp = view_of(struct_monst, p2);
    let umon = mtmp ? mtmp : gy.youmonst;
    let dam = reg.arg.a_int;

    /*
     * Gas clouds can't be targeted at water locations, but they can
     * start next to water and spread over it.
     */

    /* fog clouds maintain gas clouds, even poisonous ones */
    if (reg.ttl < 20 && umon && umon.data == mons[PM_FOG_CLOUD])
        reg.ttl += 5;

    if (dam < 1)
        return FALSE; /* if no damage then there's nothing to do here... */

    if (!mtmp) { /* hero is indicated by Null rather than by &youmonst */
        if (m_poisongas_ok(gy.youmonst) == M_POISONGAS_OK)
            return FALSE;
        if (!Blind()) {
            Your(_("%s sting."), makeplural(body_part(EYE)));
            make_blinded(1, FALSE);
        }
        if (!Poison_resistance()) {
            pline(_("%s is burning your %s!"), Something(),
                  makeplural(body_part(LUNG)));
            You(_("cough and spit blood!"));
            wake_nearto(u.ux, u.uy, 2);
            dam = ((Half_physical_damage()) ? (Math.trunc((((rnd(dam) + 5) + 1) / 2))) : (rnd(dam) + 5));
            if (Half_gas_damage()) /* worn towel */
                dam = Math.trunc((dam + 1) / 2);
            losehp(dam, _("gas cloud"), KILLED_BY_AN);
            monstunseesu(M_SEEN_POISON);
            return FALSE;
        } else {
            You(_("cough!"));
            wake_nearto(u.ux, u.uy, 2);
            monstseesu(M_SEEN_POISON);
            return FALSE;
        }
    } else { /* A monster is inside the cloud */
        mtmp = view_of(struct_monst, p2);

        if (m_poisongas_ok(mtmp) != M_POISONGAS_OK) {
            if (!is_silent(mtmp.data)) {
                if (cansee(mtmp.mx, mtmp.my)
                    || (distu(mtmp.mx, mtmp.my) < 8))
                    pline(_("%s coughs!"), Monnam(mtmp));
                wake_nearto(mtmp.mx, mtmp.my, 2);
            }
            if (heros_fault(reg))
                setmangry(mtmp, TRUE);
            if (haseyes(mtmp.data) && mtmp.mcansee) {
                mtmp.mblinded = 1;
                mtmp.mcansee = 0;
            }
            if (resists_poison(mtmp))
                return FALSE;
            mtmp.mhp -= rnd(dam) + 5;
            if (DEADMONSTER(mtmp)) {
                if (heros_fault(reg))
                    killed(mtmp);
                else
                    monkilled(mtmp, _("gas cloud"), AD_DRST);
                if (DEADMONSTER(mtmp)) { /* not lifesaved */
                    return TRUE;
                }
            }
        }
    }
    return FALSE; /* Monster is still alive */
}

function is_hero_inside_gas_cloud() { /* boolean */
    let i;

    for (i = 0; i < svn.n_regions; i++)
        if (hero_inside(gr.regions[i])
            && gr.regions[i].inside_f == INSIDE_GAS_CLOUD)
            return TRUE;
    return FALSE;
}

/* details of gas cloud creation which are common to create_gas_cloud()
   and create_gas_cloud_selection() */
function make_gas_cloud(
    cloud,
    damage,
    inside_cloud) { /* void */
    if (!gi.in_mklev && !svc.context.mon_moving)
        set_heros_fault(cloud); /* assume player has created it */
    cloud.inside_f = INSIDE_GAS_CLOUD;
    cloud.expire_f = EXPIRE_GAS_CLOUD;
    struct_assign(cloud.arg, cg.zeroany);
    cloud.arg.a_int = damage;
    cloud.visible = TRUE;
    cloud.glyph = cmap_to_glyph(damage ? S_poisoncloud : S_cloud);
    add_region(cloud);

    if (!gi.in_mklev && !inside_cloud && is_hero_inside_gas_cloud()) {
        You(_("are enveloped in a cloud of %s!"),
            /* FIXME: "steam" is wrong if this cloud is just the trail of
               a fog cloud's movement; changing to "vapor" would handle
               that but seems a step backward when it really is steam */
            damage ? _("noxious gas") : _("steam"));
        iflags.last_msg = PLNMSG_ENVELOPED_IN_GAS;
    }
}

/* Create a gas cloud which starts at (x,y) and grows outward from it via
 * breadth-first search.
 * cloudsize is the number of squares the cloud will attempt to fill.
 * damage is how much it deals to afflicted creatures. */
export const MAX_CLOUD_SIZE = 150;
export function create_gas_cloud(
    x, y,
    cloudsize,
    damage) { /* NhRegion * */
    const $frame = stack_frame(); try {
    let cloud;
    let i, j;
    let tmprect = stack_struct(struct_nhrect);

    /* store visited coords */
    let xcoords = stack_array(short, MAX_CLOUD_SIZE);
    let ycoords = stack_array(short, MAX_CLOUD_SIZE);
    xcoords[0] = x;
    ycoords[0] = y;
    let curridx;
    let newidx = 1; /* initial spot is already taken */
    let inside_cloud = is_hero_inside_gas_cloud();

    /* a single-point cloud on hero and it deals no damage.
       probably a natural cause of being polyed. don't message about it */
    if (!svc.context.mon_moving && u_at(x, y) && cloudsize == 1
        && (!damage
            || (damage && m_poisongas_ok(gy.youmonst) == M_POISONGAS_OK)))
        inside_cloud = TRUE;

    if (cloudsize > MAX_CLOUD_SIZE) {
        impossible(_("create_gas_cloud: cloud too large (%d)!"), cloudsize);
        cloudsize = MAX_CLOUD_SIZE;
    }

    for (curridx = 0; curridx < newidx; curridx++) {
        if (newidx >= cloudsize)
            break;
        let xx = xcoords[curridx];
        let yy = ycoords[curridx];
        /* Do NOT check for if there is already a gas cloud created at some
         * other time at this position. They can overlap. */

        /* Primitive Fisher-Yates-Knuth shuffle to randomize the order of
         * directions chosen. */
        let dirs = init_list(stack_array(struct_nhcoord, 4), [ {x: 0, y: -1}, {x: 0, y: 1}, {x: -1, y: 0}, {x: 1, y: 0} ]);
        for (i = 4; i > 0; --i) {
            let swapidx = rn2(i);
            let tmp = struct_assign(stack_struct(struct_nhcoord), dirs[swapidx]);

            struct_assign(dirs[swapidx], dirs[i - 1]);
            struct_assign(dirs[i - 1], tmp);
        }
        let nvalid = 0; /* # of valid adjacent spots */
        for (i = 0; i < 4; ++i) {
            /* try all 4 cardinal directions */
            let dx = dirs[i].x, dy = dirs[i].y;
            let isunpicked = TRUE;

            if (valid_cloud_pos(xx + dx, yy + dy)) {
                nvalid++;
                /* don't pick a location we've already picked */
                for (j = 0; j < newidx; ++j) {
                    if (xcoords[j] == xx + dx && ycoords[j] == yy + dy) {
                        isunpicked = FALSE;
                        break;
                    }
                }
                /* randomly disrupt the natural breadth-first search, so that
                 * clouds released in open spaces don't always tend towards a
                 * rhombus shape */
                if (nvalid == 4 && !rn2(2))
                    continue;

                if (isunpicked) {
                    xcoords[newidx] = xx + dx;
                    ycoords[newidx] = yy + dy;
                    newidx++;
                }
            }
            if (newidx >= cloudsize) {
                /* don't try further directions */
                break;
            }
        }
    }
    /* We have now either filled up xcoord and ycoord entirely or run out
       of space.  In either case, newidx is the correct total number of
       coordinates inserted. */
    cloud = create_region(null, 0);
    for (i = 0; i < newidx; ++i) {
        tmprect.lx = tmprect.hx = xcoords[i];
        tmprect.ly = tmprect.hy = ycoords[i];
        add_rect_to_reg(cloud, tmprect);
    }
    cloud.ttl = rn1(3, 4);
    /* If cloud was constrained in small space, give it more time to live. */
    cloud.ttl = Math.trunc((cloud.ttl * cloudsize) / newidx);

    make_gas_cloud(cloud, damage, inside_cloud);
    return cloud;
    } finally { stack_pop($frame); }
}

/* create a single gas cloud from selection */
export function create_gas_cloud_selection(
    sel,
    damage) { /* NhRegion * */
    const $frame = stack_frame(); try {
    let cloud;
    let tmprect = stack_struct(struct_nhrect);
    let x, y;
    let r = struct_assign(stack_struct(struct_nhrect), cg.zeroNhRect);
    let inside_cloud = is_hero_inside_gas_cloud();

    selection_getbounds(sel, r);

    cloud = create_region(null, 0);
    for (x = r.lx; x <= r.hx; x++)
        for (y = r.ly; y <= r.hy; y++)
            if (selection_getpoint(x, y, sel)) {
                tmprect.lx = tmprect.hx = x;
                tmprect.ly = tmprect.hy = y;
                add_rect_to_reg(cloud, tmprect);
            }

    make_gas_cloud(cloud, damage, inside_cloud);
    return cloud;
    } finally { stack_pop($frame); }
}

/* for checking troubles during prayer; is hero at risk? */
export function region_danger() { /* boolean */
    let i, f_indx, n = 0;

    for (i = 0; i < svn.n_regions; i++) {
        /* only care about regions that hero is in */
        if (!hero_inside(gr.regions[i]))
            continue;
        f_indx = gr.regions[i].inside_f;
        /* the only type of region we understand is gas_cloud */
        if (f_indx == INSIDE_GAS_CLOUD) {
            /* completely harmless if you don't need to breathe */
            if (nonliving(gy.youmonst.data) || Breathless())
                continue;
            /* minor inconvenience if you're poison resistant;
               not harmful enough to be a prayer-level trouble */
            if (Poison_resistance())
                continue;
            ++n;
        }
    }
    return n ? TRUE : FALSE;
}

/* for fixing trouble at end of prayer;
   danger detected at start of prayer might have expired by now */
export function region_safety() { /* void */
    let r = null;
    let i, f_indx, n = 0;

    for (i = 0; i < svn.n_regions; i++) {
        /* only care about regions that hero is in */
        if (!hero_inside(gr.regions[i]))
            continue;
        f_indx = gr.regions[i].inside_f;
        /* the only type of region we understand is gas_cloud */
        if (f_indx == INSIDE_GAS_CLOUD) {
            if (!n++ && gr.regions[i].ttl >= 0)
                r = gr.regions[i];
        }
    }

    if (n > 1 || (n == 1 && !r)) {
        /* multiple overlapping cloud regions or non-expiring one */
        safe_teleds(TELEDS_NO_FLAGS);
        /* maybe there's no safe place available; must get hero out of danger
           or prayer's "fix all troubles" result will get stuck in a loop */
        if (region_danger()) {
            set_itimeout(ref_of(u.uprops[MAGICAL_BREATHING], "intrinsic"), (d(4, 4) + 4));
            /* not already Breathless or wouldn't be in region danger */
            You_feel(_("able to breathe."));
        }
    } else if (r) {
        remove_region(r);
        pline_The(_("gas cloud enveloping you dissipates."));
    } else {
        /* cloud dissipated on its own, so nothing needs to be done */
        pline_The(_("gas cloud has dissipated."));
    }
    /* maybe cure blindness too */
    if (BlindedTimeout() == 1)
        make_blinded(0, TRUE);
}

/*region.c*/

import { struct_nhcoord } from "./coord.h.js";
import { Something } from "./decl.h.macros.js";
import { S_cloud, S_poisoncloud } from "./defsym.h.js";
import { cmap_to_glyph } from "./display.h.macros.js";
import { PLNMSG_ENVELOPED_IN_GAS } from "./flag.h.js";
import { BUFSZ, COLNO, FALSE, QBUFSZ, ROWNO, TRUE } from "./global.h.js";
import {
    EYE, FM_FMON, KILLED_BY_AN, LUNG, M_POISONGAS_OK, NHF_BONESFILE, TELEDS_NO_FLAGS,
} from "./hack.h.js";
import { distu, pline1, plur, release_data, rn1, update_file } from "./hack.h.macros.js";
import { AD_DRST } from "./monattk.h.js";
import { haseyes, is_silent, nonliving } from "./mondata.h.macros.js";
import { M_SEEN_POISON, struct_monst } from "./monst.h.js";
import { DEADMONSTER, resists_poison } from "./monst.h.macros.js";
import { PM_FOG_CLOUD, PM_LONG_WORM } from "./monsters.h.js";
import { NHJS_SIZEOF_NhRect, NHJS_SIZEOF_NhRegion } from "./nhjs_struct_sizes.h.js";
import { MAGICAL_BREATHING } from "./prop.h.js";
import { struct_nhrect } from "./rect.h.js";
import { MONST_INC, NhRegion } from "./region.h.js";
import {
    clear_hero_inside, clear_heros_fault, hero_inside, heros_fault, set_hero_inside,
    set_heros_fault,
} from "./region.h.macros.js";
import { levl, m_at } from "./rm.h.macros.js";
import {
    Sfi_any, Sfi_boolean, Sfi_char, Sfi_nhrect, Sfi_short, Sfo_any, Sfo_boolean, Sfo_char, Sfo_int,
    Sfo_nhrect, Sfo_short, Sfo_unsigned,
} from "./savefile.h.macros.js";
import { cansee } from "./vision.h.macros.js";
import { putstr } from "./winprocs.h.macros.js";
import { u_at } from "./you.h.macros.js";
import {
    Blind, BlindedTimeout, Breathless, Half_gas_damage, Half_physical_damage, Poison_resistance,
} from "./youprop.h.macros.js";
import { char, int, long, ord, short, sizeof, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { free, memcpy, memset, sprintf, strcpy, strlen } from "../rt/libc.js";
import { init_list, stack_array, stack_struct, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, fnptr_t, ptr_add, ptr_to, ref_of, ref_to, struct_assign, view_of,
} from "../rt/struct.js";
import { alloc } from "./alloc.js";
import { isok } from "./cmd.js";
import { cg, gg, gi, gm, gr, gy, iflags, svc, svm, svn, u } from "./decl.js";
import { newsym, show_glyph } from "./display.js";
import { Monnam, m_monnam } from "./do_name.js";
import { losehp } from "./hack.js";
import { eos } from "./hacklib.js";
import { find_mid } from "./light.js";
import { killed, m_poisongas_ok, monkilled, setmangry, wake_nearto } from "./mon.js";
import { monstseesu, monstunseesu } from "./mondata.js";
import { mons } from "./monst.js";
import { makeplural } from "./objnam.js";
import { You, You_feel, You_see, Your, impossible, pline, pline_The } from "./pline.js";
import { body_part } from "./polyself.js";
import { make_blinded, set_itimeout } from "./potion.js";
import { valid_cloud_pos } from "./read.js";
import { lookup_id_mapping } from "./restore.js";
import { d, rn2, rnd } from "./rnd.js";
import { selection_getbounds, selection_getpoint } from "./selvar.js";
import { sfi_int, sfi_long, sfi_unsigned, sfo_long } from "./sfbase.js";
import { safe_teleds } from "./teleport.js";
import { block_point, does_block, unblock_point } from "./vision.js";
