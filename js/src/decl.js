/* NetHack 5.0	decl.c	$NHDT-Date: 1736530208 2025/01/10 09:30:08 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.341 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2009. */
/* NetHack may be freely redistributed.  See license for details. */

export const nhcb_name = static_array("nhcb_name", ptr_to(char), NUM_NHCB, [
    _("cmd_before"),
    _("level_enter"),
    _("level_leave"),
    _("end_turn"),
]);

export const nhcb_counts = static_array("nhcb_counts", int, NUM_NHCB, []);
 export const c_color_names = static_struct("c_color_names", struct_c_color_names, {
    c_black: _("black"),  c_amber: _("amber"), c_golden: _("golden"), c_light_blue: _("light blue"), c_red: _("red"),   c_green: _("green"),
    c_silver: _("silver"), c_blue: _("blue"),  c_purple: _("purple"), c_white: _("white"),      c_orange: _("orange")
});
export const c_obj_colors = static_array("c_obj_colors", ptr_to(char), null, [
    _("black"),          /* CLR_BLACK */
    _("red"),            /* CLR_RED */
    _("green"),          /* CLR_GREEN */
    _("brown"),          /* CLR_BROWN */
    _("blue"),           /* CLR_BLUE */
    _("magenta"),        /* CLR_MAGENTA */
    _("cyan"),           /* CLR_CYAN */
    _("gray"),           /* CLR_GRAY */
    _("transparent"),    /* no_color */
    _("orange"),         /* CLR_ORANGE */
    _("bright green"),   /* CLR_BRIGHT_GREEN */
    _("yellow"),         /* CLR_YELLOW */
    _("bright blue"),    /* CLR_BRIGHT_BLUE */
    _("bright magenta"), /* CLR_BRIGHT_MAGENTA */
    _("bright cyan"),    /* CLR_BRIGHT_CYAN */
    _("white"),          /* CLR_WHITE */
]);

export const c_common_strings = static_struct("c_common_strings", struct_c_common_strings, { c_nothing_happens: _("Nothing happens."),
      c_nothing_seems_to_happen: _("Nothing seems to happen."),
      c_thats_enough_tries: _("That's enough tries!"),
      c_silly_thing_to: _("That is a silly thing to %s."),
      c_shudder_for_moment: _("shudder for a moment."),
      c_something: _("something"),
      c_Something: _("Something"),
      c_You_can_move_again: _("You can move again."),
      c_Never_mind: _("Never mind."),
      c_vision_clears: _("vision quickly clears."),
      c_the_your: [ _("the"), _("your") ],
      c_fakename: [ _("mon"), _("you") ]
});

export const disclosure_options = init_string(static_array("disclosure_options", char, sizeof_string("iavgco")), _("iavgco"), true);
export const emptystr = static_array("emptystr", char, null, [0]);       /* non-const */

 export const flags = static_struct("flags", struct_flag);  /* extern declaration is in flag.h, not decl.h */

/* Global windowing data, defined here for multi-window-system support */

/* used by coloratt.c, options.c, utf8map.c, windows.c */
export const hexdd = init_string(static_array("hexdd", char, 33), _("00112233445566778899aAbBcCdDeEfF"), true);

/* x/y/z deltas for the 10 movement directions (8 compass pts, 2 down/up) */
export const xdir = static_array("xdir", schar, N_DIRS_Z, [ -1, -1,  0,  1,  1,  1,  0, -1, 0,  0 ]);
export const ydir = static_array("ydir", schar, N_DIRS_Z, [  0, -1, -1, -1,  0,  1,  1,  1, 0,  0 ]);
export const zdir = static_array("zdir", schar, N_DIRS_Z, [  0,  0,  0,  0,  0,  0,  0,  0, 1, -1 ]);
/* reordered directions, cardinals first */
export const dirs_ord = static_array("dirs_ord", schar, N_DIRS, [ DIR_W, DIR_N, DIR_E, DIR_S, DIR_NW, DIR_NE, DIR_SE, DIR_SW ]);

 global_scalar("has_strong_rngseed", schar, FALSE);
global_scalar("head_engr", ptr_to(struct_engr));
 export const iflags = static_struct("iflags", struct_instance_flags);
 export const a11y = static_struct("a11y", struct_accessibility_data);
/* NOTE: the order of these words exactly corresponds to the
   order of oc_material values #define'd in objclass.h. */
export const materialnm = static_array("materialnm", ptr_to(char), null, [ _("mysterious"), _("liquid"),  _("wax"),        _("organic"),
                             _("flesh"),      _("paper"),   _("cloth"),      _("leather"),
                             _("wooden"),     _("bone"),    _("dragonhide"), _("iron"),
                             _("metal"),      _("copper"),  _("silver"),     _("gold"),
                             _("platinum"),   _("mithril"), _("plastic"),    _("glass"),
                             _("gemstone"),   _("stone") ]);
export const quitchars = init_string(static_array("quitchars", char, sizeof_string(" \r\n\x1b")), _(" \r\n\x1b"), true);
export const shield_static = static_array("shield_static", int, SHIELD_COUNT, [
    S_ss1, S_ss2, S_ss3, S_ss2, S_ss1, S_ss2, S_ss4, /* 7 per row */
    S_ss1, S_ss2, S_ss3, S_ss2, S_ss1, S_ss2, S_ss4,
    S_ss1, S_ss2, S_ss3, S_ss2, S_ss1, S_ss2, S_ss4,
]);
 export const u = static_struct("u", struct_you);
 global_scalar("ubirthday", long);
 export const urealtime = static_struct("urealtime", struct_u_realtime);
 global_scalar("uwep", ptr_to(struct_obj)); global_scalar("uarm", ptr_to(struct_obj)); global_scalar("uswapwep", ptr_to(struct_obj));
global_scalar("uquiver", ptr_to(struct_obj));
global_scalar("uarmu", ptr_to(struct_obj));
global_scalar("uskin", ptr_to(struct_obj));
global_scalar("uarmc", ptr_to(struct_obj)); global_scalar("uarmh", ptr_to(struct_obj)); global_scalar("uarms", ptr_to(struct_obj)); global_scalar("uarmg", ptr_to(struct_obj)); global_scalar("uarmf", ptr_to(struct_obj)); global_scalar("uamul", ptr_to(struct_obj));
global_scalar("uright", ptr_to(struct_obj)); global_scalar("uleft", ptr_to(struct_obj)); global_scalar("ublindf", ptr_to(struct_obj)); global_scalar("uchain", ptr_to(struct_obj)); global_scalar("uball", ptr_to(struct_obj));
export const vowels = init_string(static_array("vowels", char, sizeof_string("aeiouAEIOU")), _("aeiouAEIOU"), true);
 global_scalar("WIN_MESSAGE", int); global_scalar("WIN_STATUS", int); global_scalar("WIN_MAP", int); global_scalar("WIN_INVEN", int);
export const ynchars = init_string(static_array("ynchars", char, sizeof_string("yn")), _("yn"), true);
export const ynqchars = init_string(static_array("ynqchars", char, sizeof_string("ynq")), _("ynq"), true);
export const ynaqchars = init_string(static_array("ynaqchars", char, sizeof_string("ynaq")), _("ynaq"), true);
export const ynNaqchars = init_string(static_array("ynNaqchars", char, sizeof_string("yn#aq")), _("yn#aq"), true);
export const rightleftchars = init_string(static_array("rightleftchars", char, sizeof_string("rl")), _("rl"), true);
export const hidespinchars = init_string(static_array("hidespinchars", char, sizeof_string("hsq")), _("hsq"), true);
 global_scalar("yn_number", long, 0);

const urole_init_data = static_struct("urole_init_data", struct_Role, {
    name: { m: _("Undefined"), f: 0 },
    rank: [ { m: 0, f: 0 }, { m: 0, f: 0 }, { m: 0, f: 0 }, { m: 0, f: 0 }, { m: 0, f: 0 },
      { m: 0, f: 0 }, { m: 0, f: 0 }, { m: 0, f: 0 }, { m: 0, f: 0 } ],
    lgod: _("L"), ngod: _("N"), cgod: _("C"),
    filecode: _("Xxx"), homebase: _("home"), intermed: _("locate"),
    mnum: NON_PM, petnum: NON_PM, ldrnum: NON_PM, guardnum: NON_PM, neminum: NON_PM, enemy1num: NON_PM, enemy2num: NON_PM,
    enemy1sym: 0, enemy2sym: 0, questarti: 0, allow: 0,
    /* Str Int Wis Dex Con Cha */
    attrbase: [ 7, 7, 7, 7, 7, 7 ],
    attrdist: [ 20, 15, 15, 20, 20, 10 ],
    /* Init   Lower  Higher */
    hpadv: { infix: 10, inrnd: 0, lofix: 0, lornd: 8, hifix: 1, hirnd: 0 }, /* Hit points */
    enadv: { infix: 2, inrnd: 0, lofix: 0, lornd: 2, hifix: 0, hirnd: 3 },
    xlev: 14, /* Energy */
     initrecord: 0,
    spelbase: 10,
     spelheal: 0,
     spelshld: 0,
     spelarmr: 4,
    spelstat: A_INT,
     spelspec: 0,
    spelsbon: -3
});

const urace_init_data = static_struct("urace_init_data", struct_Race, {
    noun: _("something"),
    adj: _("undefined"),
    coll: _("something"),
    filecode: _("Xxx"),
    individual: { m: 0, f: 0 },
    mnum: NON_PM,
    mummynum: NON_PM,
    zombienum: NON_PM,
    allow: 0,
    selfmask: 0,
    lovemask: 0,
    hatemask: 0,
    /*    Str     Int Wis Dex Con Cha */
    attrmin: [ 3, 3, 3, 3, 3, 3 ],
    attrmax: [ STR18(100), 18, 18, 18, 18, 18 ],
    /* Init   Lower  Higher */
    hpadv: { infix: 2, inrnd: 0, lofix: 0, lornd: 2, hifix: 1, hirnd: 0 }, /* Hit points */
    enadv: { infix: 1, inrnd: 0, lofix: 2, lornd: 0, hifix: 2, hirnd: 0 }  /* Energy */
});

export const disp = static_struct("disp", struct_display_hints, { botl: 0 });

const g_init_a = static_struct("g_init_a", struct_instance_globals_a, {
    /* artifact.c */
    /* decl.c */
    afternmv: null,  /* afternmv */
    /* detect.c */
    already_found_flag: 0,              /* already_found_flag */
    /* do.c */
    at_ladder: FALSE,          /* at_ladder */
    /* dog.c */
    apelist: null, /* apelist */
    /* end.c */
    amulets: [ {} ], /* amulets */
    /* mon.c */
    animal_list: null, /* animal_list */
    animal_list_count: UNDEFINED_VALUE, /* animal_list_count */

    /* pickup.c */
    A_first_hint: 0, /* A_first_hint */
    A_second_hint: 0, /* A_second_hint */
    abort_looting: UNDEFINED_VALUE, /* abort_looting */
    /* shk.c */
    auto_credit: FALSE, /* auto_credit */
    /* sounds.c */
    active_soundlib: soundlib_nosound, /* enum soundlib_ids active_soundlib */

    /* trap.c */
    acid_ctx: { dkn_boom: 0, unk_boom: 0, ctx_valid: FALSE }, /* acid_ctx */
    havestate: TRUE, /* havestate*/
});

const g_init_b = static_struct("g_init_b", struct_instance_globals_b, {
    /* botl.c */
    blstats: [ [ { fldname: 0, fldfmt: 0, time: 0, chg: FALSE, percent_matters: FALSE, percent_value: 0, anytype: ANY_INVALID, a: { a_void: 0 }, rawval: { a_void: 0 }, val: 0, valwidth: 0, idxmax: 0, fld: 0

            , hilite_rule: null, thresholds: null
    } ]
    ], /* blstats */
    blinit: FALSE, /* blinit */

    bl_hilite_moves: 0, /* bl_hilite_moves */

    /* decl.c */
    bhitpos: { x: 0, y: 0 }, /* bhitpos */
    billobjs: null, /* billobjs */
    /* files.c */
    bones: BONESINIT, /* bones */
    /* hack.c */
    bldrpush_oid: 0, /* bldrpush_oid - last boulder pushed */
    bldrpushtime: 0, /* bldrpushtime - turn message was given about pushing that boulder */
    /* mkmaze.c */
    bughack: { inarea: {x1: COLNO, y1: ROWNO, x2: 0, y2: 0}, delarea: {x1: COLNO, y1: ROWNO, x2: 0, y2: 0},
            in_islev: FALSE, del_islev: FALSE, rtype: 0, padding: 0, rname: { str: 0 } }, /* bughack */
    /* pickup.c */
    bucx_filter: FALSE, /* bucx_filter */
    /* zap.c */
    buzzer: null, /* buzzer -- monst that zapped/cast/breathed to initiate buzz() */
    bot_disabled: FALSE, /* bot_disabled */

    havestate: TRUE, /* havestate*/
});

const g_init_c = static_struct("g_init_c", struct_instance_globals_c, {
    command_queue: [], /* command_queue */
    /* botl.c */
    cond_hilites: [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0 ], /* cond_hilites */
    condmenu_sortorder: 0, /* condmenu_sortorder */
    /* cmd.c */
    Cmd: {}, /* Cmd */
    clicklook_cc: { x: 0, y: 0 }, /* clicklook_cc */
    /* decl.c */
    chosen_windowtype: [], /* chosen_windowtype */
    cmd_key: 0, /* cmd_key */
    cmd_bind: null, /* cmd_bind */
    command_count: 0, /* command_count */
    current_wand: null, /* current_wand */

    /* dog.c */
    catname: [], /* catname */
    /* end.c */
    crash_email: 0, /* crash_email */
    crash_name: 0, /* crash_name */
    crash_urlmax: -1, /* crash_urlmax */
    /* symbols.c */
    currentgraphics: 0,     /* currentgraphics */
    /* files.c */
    cmdline_rcfile: 0, /* cmdline_rcfile */
    config_section_chosen: 0, /* config_section_chosen */
    config_section_current: 0, /* config_section_current */
    chosen_symset_start: FALSE, /* chosen_symset_start */
    chosen_symset_end: FALSE, /* chosen_symset_end */
    /* invent.c */
    cached_pickinv_win: WIN_ERR, /* cached_pickinv_win */
    core_invent_state: 0,       /* core_invent_state */
    /* options.c */
    cmdline_windowsys: 0, /* cmdline_windowsys */
    color_colorings: null, /* color_colorings */
    /* pickup.c */
    current_container: null, /* current_container */
    class_filter: FALSE, /* class_filter */
    /* questpgr.c */
    cvt_buf: [], /* cvt_buf */
    /* sounds.c */
    chosen_soundlib: soundlib_nosound, /* chosen_soundlib */
    coder: null, /* coder */
    /* uhitm.c */
    corpsenm_digested: NON_PM, /* corpsenm_digested */
    converted_savefile_loaded: FALSE,  /* converted_savefile_loaded */
    havestate: TRUE, /* havestate*/
});

const g_init_d = static_struct("g_init_d", struct_instance_globals_d, {
    /* decl.c */
    doorindex: 0, /* doorindex */
    done_money: 0, /* done_money */
    domove_attempting: 0, /* domove_attempting */
    domove_succeeded: 0, /* domove_succeeded */
    defer_see_monsters: FALSE, /* defer_see_monsters */
    /* dig.c */
    did_dig_msg: UNDEFINED_VALUE, /* did_dig_msg */
    /* do.c */
    dfr_pre_msg: 0, /* dfr_pre_msg */
    dfr_post_msg: 0, /* dfr_post_msg */
    did_nothing_flag: 0, /* did_nothing_flag */
    /* dog.c */
    dogname: [], /* dogname */
    /* end.c */
    done_seq: 0, /* done_seq */
    /* mon.c */
    disintegested: FALSE, /* disintegested */
    /* objname.c */
    distantname: 0, /* distantname */
    /* pickup.c */
    decor_fumble_override: FALSE, /* decor_fumble_override */
    decor_levitate_override: FALSE, /* decor_levitate_override */
    deferred_showpaths: FALSE, /* deferred_showpaths */
    deferred_showpaths_dir: 0,  /* deferred_showpaths_dir  */
    havestate: TRUE, /* havestate*/
});

const g_init_e = static_struct("g_init_e", struct_instance_globals_e, {
    /* cmd.c */
    en_win: WIN_ERR, /* en_win */
    en_via_menu: FALSE, /* en_via_menu */
    ext_tlist: null, /* ext_tlist */
    /* eat.c */
    eatmbuf: 0, /* eatmbuf */
    /* mkmaze.c */
    ebubbles: null, /* ebubbles */
    /* new */
    early_raw_messages: 0,      /* early_raw_messages */
    havestate: TRUE, /* havestate*/
});

const g_init_f = static_struct("g_init_f", struct_instance_globals_f, {
    /* decl.c */
    ftrap: null, /* ftrap */
    fqn_prefix: [ 0 ], /* fqn_prefix */
    ffruit: null, /* ffruit */
    /* eat.c */
    force_save_hs: FALSE, /* force_save_hs */
    /* mhitm.c */
     far_noise: FALSE, /* far_noise */
    /* rumors.c */
    false_rumor_size: 0, /* false_rumor_size */
    false_rumor_start: 0, /* false_rumor_start*/
    false_rumor_end: 0, /* false_rumor_end */
    /* shk.c */
    followmsg: 0, /* followmsg */
    havestate: TRUE, /* havestate*/
});

const g_init_g = static_struct("g_init_g", struct_instance_globals_g, {
    /* display.c */
    gbuf: [ [ { gnew: 0 } ] ], /* gbuf */
    gbuf_start: [], /* gbuf_start */
    gbuf_stop: [], /* gbug_stop */

    /* do_name.c */
    getposx: 0, getposy: 0, /* getposx, getposy */
    gloc_filter_map: null, /* gloc_filter_map */
    gloc_filter_floodfill_match_glyph: UNDEFINED_VALUE, /* gloc_filter_floodfill_match_glyph */
    /* dog.c */
    gtyp: UNDEFINED_VALUE, /* gtyp */
    gx: 0, /* gx */
    gy: 0, /* gy */
    /* dokick.c */
    gate_str: 0, /* gate_str */
    /* end.c */
    gems: [ {} ], /* gems */
    /* invent.c */
    glyph_reset_timestamp: 0,      /* glyph_reset_timestamp */
    /* nhlua.c */
    gmst_stored: FALSE, /* gmst_stored */
    gmst_moves: 0, /* gmst_moves */
    gmst_invent: null, /* gmst_invent */
    gmst_ubak: null, gmst_disco: null, gmst_mvitals: null, /* gmst_ubak, gmst_disco, gmst_mvitals */
    gmst_spl_book: [ {} ], /* gmst_spl_book */
    /* pline.c */
    gamelog: null, /* gamelog */
    /* region.c */
    gas_cloud_diss_within: FALSE, /* gas_cloud_diss_within */
    gas_cloud_diss_seen: 0, /* gas_cloud_diss_seen */
    /* new */
    /* per-level glyph mapping flags */
    glyphmap_perlevel_flags: 0,     /* glyphmap_perlevel_flags */
    havestate: TRUE, /* havestate*/
});

const g_init_h = static_struct("g_init_h", struct_instance_globals_h, {
    /* decl.c */
    hname: 0, /* hname */

    hero_seq: shl64(1, 3), /* hero_seq: sequence number for hero movement, 'moves*8 + n'
              * where n is usually 1, sometimes 2 when Fast/Very_fast, maybe
              * higher if polymorphed into something that's even faster */
    /* dog.c */
    horsename: [], /* horsename */
    /* mhitu.c */
    hitmsg_mid: 0, /* hitmsg_mid */
    hitmsg_prev: null, /* hitmsg_prev */
    /* save.c */
    havestate: TRUE, /* havestate*/
});

const g_init_i = static_struct("g_init_i", struct_instance_globals_i, {
    /* decl.c */
    in_doagain: 0, /* in_doagain */
    in_mklev: FALSE, /* in_mklev */
    in_steed_dismounting: FALSE, /* in_steed_dismounting */
    invent: null, /* invent */
    /* do_wear.c */
    initial_don: FALSE, /* initial_don */
    /* invent.c */
    invbuf: 0, /* invbuf */
    invbufsiz: 0, /* invbufsize */
    item_action_in_progress: FALSE, /* item_action_in_progress */
    in_sync_perminvent: 0,       /* in_sync_perminvent */
    /* mon.c */
    itermonarr: null, /* itermonarr */
    /* restore.c */
    id_map: null, /* id_map */
    /* sp_lev.c */
    in_mk_themerooms: FALSE, /* in_mk_themerooms */

    havestate: TRUE, /* havestate*/
});

const g_init_j = static_struct("g_init_j", struct_instance_globals_j, {
    /* apply.c */
    jumping_is_magic: 0,  /* jumping_is_magic */
    havestate: TRUE, /* havestate*/
});

const g_init_k = static_struct("g_init_k", struct_instance_globals_k, {
    kickedloc: { x: 0, y: 0 }, /* kickedloc */
    /* decl.c */
    kickedobj: null, /* kickedobj */
    /* read.c */
    known: UNDEFINED_VALUE, /* known */
    havestate: TRUE, /* havestate*/
});

const g_init_l = static_struct("g_init_l", struct_instance_globals_l, {
    /* cmd.c */
    last_command_count: UNDEFINED_VALUE, /* last_command_count */
    /* decl.c */

    locknum: 0, /* locknum */

    /* files.c */
    lockptr: UNDEFINED_VALUE, /* lockptr */
    lock: LOCKNAMEINIT, /* lock */
    /* invent.c */
    lastinvnr: 51, /* lastinvr */
    /* light.c */
    light_base: null, /* light_base */
    /* mklev.c */
    luathemes: [ UNDEFINED_PTR() ], /* luathemes[] */
    /* mon.c */
    last_hider: 0, /* last_hider */
    /* nhlan.c */

    /* nhlua.c */
    luacore: 0, /* luacore */
    lua_warnbuf: [], /* lua_warnbuf[] */
    loglua: 0, /* loglua */
    lua_sid: 0, /* lua_sid */
    /* options.c */
    loot_reset_justpicked: FALSE, /* loot_reset_justpicked */
    /* save.c */
    looseball: null, /* looseball */
    loosechain: null, /* loosechain */
    /* sp_lev.c */
    lev_message: 0, /* lev_message */
    lregions: null, /* lregions */
    /* trap.c */
    launchplace: { obj: null, x: 0, y: 0 }, /* launchplace */
    /* windows.c */
    last_winchoice: null, /* last_winchoice */
    /* new */
    lua_ver: [],   /* lua_ver[LUA_VER_BUFSIZ] */
    lua_copyright: [],   /* lua_copyright[LUA_COPYRIGHT_BUFSIZ] */
    havestate: TRUE, /* havestate*/
});

const g_init_m = static_struct("g_init_m", struct_instance_globals_m, {
    /* apply.c */
    mkot_trap_warn_count: 0, /* mkot_trap_warn_count */
    /* botl.c */
    mrank_sz: 0,  /* mrank_sz */
    /* decl.c */
    multi: 0, /* multi */
    multi_reason: 0, /* multi_reason */
    /* multi_reason usually points to a string literal (when not Null)
       but multireasonbuf[] is available for when it needs to be dynamic */
    multireasonbuf: [], /* multireasonbuf[] */
    m_shot: { n: 0, i: 0, o: STRANGE_OBJECT, s: FALSE }, /* m_shot */
    mrg_to_wielded: FALSE, /* mrg_to_wielded */
    menu_colorings: null, /* menu_colorings */
    migrating_objs: null, /* migrating_objs */
    /* dog.c */
    mydogs: null, /* mydogs */
    migrating_mons: null, /* migrating_mons */
    /* dokick.c */
    maploc: null, /* maploc */
    /* mhitm.c */
    mswallower: null, /* mswallower */
    /* mhitu.c */
    mhitu_dieroll: UNDEFINED_VALUE, /* mhitu_dieroll */
    /* mklev.c */
    made_branch: FALSE, /* made_branch */
    /* mkmap.c */
    min_rx: UNDEFINED_VALUE, /* min_rx */
    max_rx: UNDEFINED_VALUE, /* max_rx */
    min_ry: UNDEFINED_VALUE, /* min_ry */
    max_ry: UNDEFINED_VALUE, /* max_ry */
    /* mkobj.c */
    mkcorpstat_norevive: FALSE, /* mkcorpstat_norevive */
    /* mthrowu.c */
    mesg_given: UNDEFINED_VALUE, /* mesg_given */
    mtarget: null, /* mtarget */
    marcher: null, /* marcher */
    /* muse.c */
    m_using: FALSE, /* m_using */
    m: {}, /* m */
    /* options.c */
    mapped_menu_cmds: [], /* mapped_menu_cmds */
    mapped_menu_op: [], /* mapped_menu_op */
    /* region.c */
    max_regions: 0, /* max_regions */
    /* trap.c */
    mentioned_water: FALSE, /* mentioned_water */
    havestate: TRUE, /* havestate*/
});

const g_init_n = static_struct("g_init_n", struct_instance_globals_n, {
    /* botl.c */
    now_or_before_idx: 0, /* now_or_before_idx */
    /* decl.c */
    nomovemsg: 0, /* nomovemsg */
    nsubroom: 0, /* nsubroom */
    /* dokick.c */
    nowhere: {}, /* nowhere */
    /* files.c */
    nesting: 0, /* nesting */
    no_sound_notified: 0, /* no_sound_notified */
    /* mhitm.c */
    noisetime: 0, /* noisetime */
    /* mkmap.c */
    new_locations: 0, /* new_locations */
    n_loc_filled: UNDEFINED_VALUE, /* n_loc_filled */
    /* options.c */
    n_menu_mapped: 0, /* n_menu_mapped */
    /* potion.c */
    notonhead: FALSE, /* notonhead */
    /* questpgr.c */
    nambuf: [], /* nambuf */
    /* restore.c */
    n_ids_mapped: 0, /* n_ids_mapped */
    /* sp_lev.c */
    num_lregions: 0, /* num_lregions */
    /* u_init.c */
    nocreate: STRANGE_OBJECT, /* nocreate */
    nocreate2: STRANGE_OBJECT, /* nocreate2 */
    nocreate3: STRANGE_OBJECT, /* nocreate3 */
    nocreate4: STRANGE_OBJECT, /* nocreate4 */
    havestate: TRUE, /* havestate*/
});

const g_init_o = static_struct("g_init_o", struct_instance_globals_o, {
    objs_deleted: null, /* objs_deleted */
    /* dbridge.c */
    occupants: [ { emon: null } ], /* occupants */
    /* decl.c */
    occupation: null, /* occupation */
    occtime: 0, /* occtime */
    otg_temp: UNDEFINED_VALUE, /* otg_temp */
    otg_otmp: null, /* otg_otmp */
    occtxt: 0, /* occtxt */
    /* symbols.c */
    ov_primary_syms: [], /* ov_primary_syms */
    ov_rogue_syms: [], /* ov_rogue_syms */
    /* invent.c */
    only: {}, /* only (coord) */
    /* o_init.c */
    oclass_prob_totals: [], /* oclass_prob_totals */
    /* options.c */
    opt_phase: phase_not_set, /* opt_phase */
    opt_initial: FALSE, /* opt_initial */
    opt_from_file: FALSE, /* opt_from_file */
    opt_need_redraw: FALSE, /* opt_need_redraw */
    opt_need_glyph_reset: FALSE, /* opt_need_glyph_reset */
    opt_need_promptstyle: FALSE, /* opt_need_promptstyle */
    opt_reset_customcolors: FALSE, /* opt_reset_customcolors */
    opt_reset_customsymbols: FALSE, /* opt_reset_customsymbols */
    opt_update_basic_palette: FALSE, /* opt_update_basic_palette */
    opt_symset_changed: FALSE, /* opt_symset_changed */
    /* pickup.c */
    oldcap: 0,  /* oldcap */
    /* restore.c */
    oldfruit: null, /* oldfruit */
    /* rumors.c */
    oracle_flg: 0, /* oracle_flag */
    /* uhitm.c */
    override_confirmation: FALSE, /* override_confirmation */
    /* zap.c */
    obj_zapped: FALSE,  /* obj_zapped */
    havestate: TRUE, /* havestate*/
});

const g_init_p = static_struct("g_init_p", struct_instance_globals_p, {
    /* apply.c */
    polearm_range_min: -1, /* polearm_range_min */
    polearm_range_max: -1, /* polearm_range_max  */
    /* decl.c */
    plnamelen: 0, /* plnamelen */
    pl_race: ord('\0'), /* pl_race */
    plinemsg_types: null, /* plinemsg_types */
    /* dog.c */
    petname_used: 0,  /* petname_used */
    preferred_pet: UNDEFINED_VALUE, /* preferred_pet */
    /* symbols.c */
    primary_syms: [], /* primary_syms */
    /* invent.c */
    perm_invent_toggling_direction: 0,       /* perm_invent_toggling_direction */
    /* pickup.c */
    picked_filter: FALSE, /* picked_filter */
    pickup_encumbrance: 0, /* pickup_encumbrance */
    /* pline.c */
    pline_flags: 0, /* pline_flags */
    prevmsg: [], /* prevmsg */
    /* potion.c */
    potion_nothing: UNDEFINED_VALUE, /* potion_nothing */
    potion_unkn: UNDEFINED_VALUE, /* potion_unkn */
    /* pray.c */
    p_aligntyp: UNDEFINED_VALUE, /* p_aligntyp */
    p_trouble: UNDEFINED_VALUE, /* p_trouble */
    p_type: UNDEFINED_VALUE, /* p_type */
    /* weapon.c */
    propellor: null, /* propellor */
    /* zap.c */
    poly_zapped: UNDEFINED_VALUE, /* poly_zap */
    havestate: TRUE, /* havestate*/
});

const g_init_q = static_struct("g_init_q", struct_instance_globals_q, {
    havestate: TRUE, /* havestate*/
});

const g_init_r = static_struct("g_init_r", struct_instance_globals_r, {
    /* symbols.c */
    rogue_syms: [], /* rogue_syms */
    /* extralev.c */
    r: [ [ {} ] ], /* r */
    /* mkmaze.c */
    ransacked: FALSE, /* ransacked */
    /* region.c */
    regions: null, /* regions */
    /* rip.c */
    rip: null, /* rip */
    /* role.c */
    role_pa: [], /* role_pa */
    role_post_attribs: UNDEFINED_VALUE, /* role_post_attrib */
    rfilter: { roles: [ 0 ], mask: 0 }, /* rfilter */
    /* shk.c */
    repo: {}, /* repo */
    havestate: TRUE, /* havestate*/
});

const g_init_s = static_struct("g_init_s", struct_instance_globals_s, {
    /* artifact.c */
    spec_dbon_applies: 0,  /* spec_dbon_applies */
    /* decl.c */
    stairs: null, /* stairs */
    smeq: [], /* smeq */
    stoned: FALSE, /* stoned */
    subrooms: null, /* subrooms */
    /* do.c */
    save_dlevel: { dnum: 0, dlevel: 0 }, /* save_dlevel */
    /* symbols.c */
    symset: [ {} ], /* symset */
    sym_customizations: [ [ { customization_name: 0 } ], [ { customization_name: 0 } ] ], /* symset_customizations */
    showsyms: [], /* showsyms */
    /* files.c */
    symset_count: 0, /* symset_count */
    symset_which_set: 0, /* symset_which_set */
    SAVEF: [], /* SAVEF */

    /* invent.c */
    sortlootmode: 0, /* sortloogmode */
    /* mhitm.c */
    skipdrin: FALSE, /* skipdrin */
    /* mon.c */
    somebody_can_move: FALSE, /* somebody_can_move */
    /* options.c */
    symset_list: null, /* symset_list */
    save_menucolors: FALSE, /* save_menucolors */
    save_colorings: null, /* save_colorings */
    simple_options_help: FALSE, /* simple_options_help */
    /* pickup.c */
    sellobj_first: FALSE, /* sellobj_first */
    shop_filter: FALSE, /* shop_filter */
    /* pline.c */

    /* polyself.c */
    sex_change_ok: 0, /* sex_change_ok */
    /* shk.c */
    sell_response: ord('a'), /* sell_response */
    sell_how: SELL_NORMAL, /* sell_how */
    /* spells.c */
    spl_sortmode: 0, /* spl_sortmode */
    spl_orderindx: null, /* spl_orderindx */
    /* steal.c */
    stealoid: 0, /* stealoid */
    stealmid: 0, /* stealmid */
    /* vision.c */
    seethru: 0, /* seethru */
    havestate: TRUE, /* havestate*/
});

const g_init_t = static_struct("g_init_t", struct_instance_globals_t, {
    /* apply.c */
    trapinfo: {}, /* trapinfo */
    /* decl.c */
    tbx: 0, /* tbx */
    tby: 0, /* tby */
    toplines: [], /* toplines */
    thrownobj: null, /* thrownobj */
    tc_gbl_data: {}, /* tc_gbl_data */
    /* hack.c */
    tmp_anything: {}, /* tmp_anything */
    travelmap: null, /* travelmap */
    /* invent.c */
    this_type: 0, /* this_type */
    this_title: 0, /* this_title */
    /* muse.c */
    trapx: UNDEFINED_VALUE, /* trapx */
    trapy: UNDEFINED_VALUE, /* trapy */
    /* rumors.c */
    true_rumor_size: 0, /* true_rumor_size */
    true_rumor_start: 0, /* true_rumor_start*/
    true_rumor_end: 0, /* true_rumor_end */
    /* sp_lev.c */
    themeroom_failed: FALSE, /* themeroom_failed */
    /* timeout.c */
    timer_base: null, /* timer_base */
    /* topten.c */
    toptenwin: WIN_ERR, /* toptenwin */
    /* uhitm.c */
    twohits: 0, /* twohits */
    /**/
    havestate: TRUE, /* havestate*/
});

const g_init_u = static_struct("g_init_u", struct_instance_globals_u, {
    /* botl.c */
    update_all: FALSE, /* update_all */
    /* decl.c */
    unweapon: FALSE, /* unweapon */
    /* role.c */
    urole: { mnum: NON_PM, petnum: NON_PM, ldrnum: NON_PM, guardnum: NON_PM, neminum: NON_PM, enemy1num: NON_PM, enemy2num: NON_PM, enemy1sym: ord("\x00"), enemy2sym: ord("\x00"), questarti: STRANGE_OBJECT }, /* urole */
    urace: { mnum: NON_PM, mummynum: NON_PM, zombienum: NON_PM }, /* urace */
    /* save.c */
    uz_save: { dnum: 0, dlevel: 0 }, /* uz_save */
    havestate: TRUE, /* havestate*/
});

const g_init_v = static_struct("g_init_v", struct_instance_globals_v, {
    /* botl.c */
    valset: [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ], /* valset */
    /* end.c */
    valuables: [ {} ], /* valuables */
    /* mhitm.c */
    vis: FALSE, /* vis */
    /* mklev.c */
    vault_x: UNDEFINED_VALUE, /* vault_x */
    vault_y: UNDEFINED_VALUE, /* vault_y */
    /* mon.c */
    vamp_rise_msg: FALSE, /* vamp_rise_msg */
    /* pickup.c */
    val_for_n_or_more: 0, /* val_for_n_or_more */
    valid_menu_classes: [], /* valid_menu_classes */
    /* vision.c */
    viz_array: null, /* viz_array */
    viz_rmin: null, /* viz_rmin */
    viz_rmax: null, /* viz_rmax */
    vision_full_recalc: FALSE, /* vision_full_recalc */
    voice: {},  /* voice */
    havestate: TRUE, /* havestate*/
});

const g_init_w = static_struct("g_init_w", struct_instance_globals_w, {
    /* decl.c */
    warn_obj_cnt: 0, /* warn_obj_cnt */
    wailmsg: 0, /* wailmsg */
    /* do_wear.c */
    wasinwater: 0, /* wasinwater */
    /* symbols.c */
    warnsyms: [], /* warnsyms */
    /* files.c */
    wizkit: [], /* wizkit */
    /* hack.c */
    wc: UNDEFINED_VALUE, /* wc */
    /* mkmaze.c */
    wportal: null, /* wportal */
    /* new */
    wsettings: { wdmode: wdmode_traditional, map_frame_color: NO_COLOR },       /* wsettings */
    were_changes: 0,                                     /* were.c, allmain.c */
    havestate: TRUE, /* havestate*/
});

const g_init_x = static_struct("g_init_x", struct_instance_globals_x, {
    /* decl.c */
    x_maze_max: (COLNO - 1) & ~1, /* x_maze_max */
    /* lock.c */
    xlock: {},  /* xlock */
    /* objnam.c */
    xnamep: 0, /* xnamep */
    /* sp_lev.c */
    xstart: UNDEFINED_VALUE, /* xstart */
    xsize: UNDEFINED_VALUE, /* xsize */
    havestate: TRUE, /* havestate*/
});

const g_init_y = static_struct("g_init_y", struct_instance_globals_y, {
    /* decl.c */
    y_maze_max: (ROWNO - 1) & ~1, /* y_maze_max */
    youmonst: {}, /* youmonst */
    /* pline.c */
    you_buf: 0, /* you_buf */
    you_buf_siz: 0, /* you_buf_siz */
    /* sp_lev.c */
    ystart: UNDEFINED_VALUE, /* ystart */
    ysize: UNDEFINED_VALUE, /* ysize */
    havestate: TRUE, /* havestate*/
});

const g_init_z = static_struct("g_init_z", struct_instance_globals_z, {
    /* mon.c */
    zombify: FALSE, /* zombify */
    /* muse.c */
    zap_oseen: FALSE, /* zap_oseen */
    havestate: TRUE, /* havestate*/
});

const init_svb = static_struct("init_svb", struct_instance_globals_saved_b, {
    /* dungeon.c */
    branches: null,                       /* branches */
    /* mkmaze.c */
    bbubbles: null,                       /* bbubbles */
    bases: []                                /* bases */
});

const init_svc = static_struct("init_svc", struct_instance_globals_saved_c, {
    /* decl.c */
    context: {},                               /* context */
});

const init_svd = static_struct("init_svd", struct_instance_globals_saved_d, {
    /* dungeon.c */
    dungeons: [ { dname: [0],proto: [0],fill_lvl: [0],themerms: [0], boneid: 0, flags: {town: 0}, entry_lev: 0, num_dunlevs: 0, dunlev_ureached: 0, ledger_start: 0, depth_start: 0 } ], /* dungeons */
    dungeon_topology: { d_oracle_level: {dnum: 0}, d_bigroom_level: {dnum: 0}, d_rogue_level: {dnum: 0}, d_medusa_level: {dnum: 0}, d_stronghold_level: {dnum: 0}, d_valley_level: {dnum: 0}, d_wiz1_level: {dnum: 0}, d_wiz2_level: {dnum: 0}, d_wiz3_level: {dnum: 0}, d_juiblex_level: {dnum: 0},
    d_orcus_level: {dnum: 0}, d_baalzebub_level: {dnum: 0}, d_asmodeus_level: {dnum: 0}, d_portal_level: {dnum: 0}, d_sanctum_level: {dnum: 0}, d_earth_level: {dnum: 0}, d_water_level: {dnum: 0}, d_fire_level: {dnum: 0}, d_air_level: {dnum: 0}, d_astral_level: {dnum: 0},
    d_tower_dnum: 0, d_sokoban_dnum: 0, d_mines_dnum: 0, d_quest_dnum: 0, d_tutorial_dnum: 0,
    d_qstart_level: {dnum: 0}, d_qlocate_level: {dnum: 0}, d_nemesis_level: {dnum: 0},
    d_knox_level: {dnum: 0}, d_mineend_level: {dnum: 0}, d_sokoend_level: {dnum: 0} },                     /* dungeon_topology */
    /* decl.c */
    dndest: { lx: 0, ly: 0, hx: 0, hy: 0, nlx: 0, nly: 0, nhx: 0, nhy: 0 },          /* dndest */
    doors: null,                                /* doors */
    doors_alloc: 0,                                   /* doors_alloc */
    /* o_init.c */
    disco: [],                               /* disco */
});

const init_sve = static_struct("init_sve", struct_instance_globals_saved_e, {
    /* decl.c */
    exclusion_zones: null                                 /* exclusion_zones */
});

const init_svh = static_struct("init_svh", struct_instance_globals_saved_h, {
    /* decl.c */
    hackpid: 0                                    /* hackpid */
});

const init_svi = static_struct("init_svi", struct_instance_globals_saved_i, {
    /* decl.c */
    inv_pos: { x: 0, y: 0 }                             /* inv_pos */
});

const init_svk = static_struct("init_svk", struct_instance_globals_saved_k, {
    /* decl.c */
    killer: {}                                /* killer */
});

const init_svl = static_struct("init_svl", struct_instance_globals_saved_l, {
    /* decl.c */
    lastseentyp: [ [ 0 ] ],                             /* lastseentyp */
    level: { locations: [ [ {} ] ],            /* level.locations */
      objects: [ [ null ] ],               /* level.objects   */
      monsters: [ [ null ] ],               /* level.monsters  */
      objlist: null, buriedobjlist: null, monlist: null, damagelist: null, bonesinfo: null, flags: {nfountains: 0} }, /* level */
    level_info: [ {} ]                   /* level_info */
});

const init_svm = static_struct("init_svm", struct_instance_globals_saved_m, {
    /* dungeon.c */
    mapseenchn: null,                       /* mapseenchn */
    /* decl.c */
    moves: 0,                                  /* moves; misnamed turn counter */
    mvitals: [ {} ]                 /* mvitals */
});

const init_svn = static_struct("init_svn", struct_instance_globals_saved_n, {
    /* dungeon.c */
    n_dgns: 0,                                   /* n_dgns */
    nhuuid: [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0
    ],                                   /* nhuuid */
    /* mkroom.c */
    nroom: 0,                                   /* nroom */
    /* region.c */
    n_regions: 0                                    /* n_regions */
});

const init_svo = static_struct("init_svo", struct_instance_globals_saved_o, {
    /* rumors.c */
    oracle_cnt: 0,                                  /* oracle_cnt */
    oracle_loc: null,                       /* oracle_loc */

    /* other */
    omoves: 0                                   /* omoves */
});

const init_svp = static_struct("init_svp", struct_instance_globals_saved_p, {
    /* decl.c */
    plname: [],                               /* plname */
    pl_character: [],                               /* pl_character */
    pl_fruit: [],                               /* pl_fruit */
});

const init_svq = static_struct("init_svq", struct_instance_globals_saved_q, {
    /* quest.c */
    quest_status: {}                                /* quest_status */
});

const init_svr = static_struct("init_svr", struct_instance_globals_saved_r, {
    /* mkroom.c */
    rooms: [ {} ],                           /* rooms */
});

const init_svs = static_struct("init_svs", struct_instance_globals_saved_s, {
    /* decl.c */
    spl_book: [ {} ],                           /* spl_book */
    sp_levchn: null                        /* sp_levchn */
});

const init_svt = static_struct("init_svt", struct_instance_globals_saved_t, {
    /* decl.c */
    tune: [],                               /* tune */
    /* timeout.c */
    timer_id: 1,                                 /* timer_id */
});

const init_svu = static_struct("init_svu", struct_instance_globals_saved_u, {
    /* decl.c */
    updest: { lx: 0, ly: 0, hx: 0, hy: 0, nlx: 0, nly: 0, nhx: 0, nhy: 0 },          /* updest */
});

const init_svx = static_struct("init_svx", struct_instance_globals_saved_x, {
    /* mkmaze.c */
    xmin: UNDEFINED_VALUE,                     /* xmin */
    xmax: UNDEFINED_VALUE                      /* xmax */
});

const init_svw = static_struct("init_svw", struct_instance_globals_saved_w, {
    wreserve: 0,                                  /* wreserve */
    wtreserved: 100,                                /* wtreserved, not used currently */
});

const init_svy = static_struct("init_svy", struct_instance_globals_saved_y, {
    /* mkmaze.c */
    ymin: UNDEFINED_VALUE,                     /* ymin */
    ymax: UNDEFINED_VALUE                      /* ymax */
});

const init_program_state = static_struct("init_program_state", struct_sinfo, { gameover: 0 });

export const ga = static_struct("ga", struct_instance_globals_a);
export const gb = static_struct("gb", struct_instance_globals_b);
export const gc = static_struct("gc", struct_instance_globals_c);
export const gd = static_struct("gd", struct_instance_globals_d);
export const ge = static_struct("ge", struct_instance_globals_e);
export const gf = static_struct("gf", struct_instance_globals_f);
export const gg = static_struct("gg", struct_instance_globals_g);
export const gh = static_struct("gh", struct_instance_globals_h);
export const gi = static_struct("gi", struct_instance_globals_i);
export const gj = static_struct("gj", struct_instance_globals_j);
export const gk = static_struct("gk", struct_instance_globals_k);
export const gl = static_struct("gl", struct_instance_globals_l);
export const gm = static_struct("gm", struct_instance_globals_m);
export const gn = static_struct("gn", struct_instance_globals_n);
export const go = static_struct("go", struct_instance_globals_o);
export const gp = static_struct("gp", struct_instance_globals_p);
export const gq = static_struct("gq", struct_instance_globals_q);
export const gr = static_struct("gr", struct_instance_globals_r);
export const gs = static_struct("gs", struct_instance_globals_s);
export const gt = static_struct("gt", struct_instance_globals_t);
export const gu = static_struct("gu", struct_instance_globals_u);
export const gv = static_struct("gv", struct_instance_globals_v);
export const gw = static_struct("gw", struct_instance_globals_w);
export const gx = static_struct("gx", struct_instance_globals_x);
export const gy = static_struct("gy", struct_instance_globals_y);
export const gz = static_struct("gz", struct_instance_globals_z);
export const svb = static_struct("svb", struct_instance_globals_saved_b);
export const svc = static_struct("svc", struct_instance_globals_saved_c);
export const svd = static_struct("svd", struct_instance_globals_saved_d);
export const sve = static_struct("sve", struct_instance_globals_saved_e);
export const svh = static_struct("svh", struct_instance_globals_saved_h);
export const svi = static_struct("svi", struct_instance_globals_saved_i);
export const svk = static_struct("svk", struct_instance_globals_saved_k);
export const svl = static_struct("svl", struct_instance_globals_saved_l);
export const svm = static_struct("svm", struct_instance_globals_saved_m);
export const svn = static_struct("svn", struct_instance_globals_saved_n);
export const svo = static_struct("svo", struct_instance_globals_saved_o);
export const svp = static_struct("svp", struct_instance_globals_saved_p);
export const svq = static_struct("svq", struct_instance_globals_saved_q);
export const svr = static_struct("svr", struct_instance_globals_saved_r);
export const svs = static_struct("svs", struct_instance_globals_saved_s);
export const svt = static_struct("svt", struct_instance_globals_saved_t);
export const svu = static_struct("svu", struct_instance_globals_saved_u);
export const svw = static_struct("svw", struct_instance_globals_saved_w);
export const svx = static_struct("svx", struct_instance_globals_saved_x);
export const svy = static_struct("svy", struct_instance_globals_saved_y);
export const program_state = static_struct("program_state", struct_sinfo);

export const cg = static_struct("cg", struct_const_globals, {
    zeroobj: {}, /* zeroobj */
    zeromonst: {}, /* zeromonst */
    zeroany: {}, /* zeroany */
    zeroNhRect: {}, /* zeroNhRect */
});

export function program_state_init() { /* void */
    struct_assign(program_state, init_program_state);
}

export function decl_globals_init() { /* void */
    struct_assign(ga, g_init_a);
    struct_assign(gb, g_init_b);
    struct_assign(gc, g_init_c);
    struct_assign(gd, g_init_d);
    struct_assign(ge, g_init_e);
    struct_assign(gf, g_init_f);
    struct_assign(gg, g_init_g);
    struct_assign(gh, g_init_h);
    struct_assign(gi, g_init_i);
    struct_assign(gj, g_init_j);
    struct_assign(gk, g_init_k);
    struct_assign(gl, g_init_l);
    struct_assign(gm, g_init_m);
    struct_assign(gn, g_init_n);
    struct_assign(go, g_init_o);
    struct_assign(gp, g_init_p);
    struct_assign(gq, g_init_q);
    struct_assign(gr, g_init_r);
    struct_assign(gs, g_init_s);
    struct_assign(gt, g_init_t);
    struct_assign(gu, g_init_u);
    struct_assign(gv, g_init_v);
    struct_assign(gw, g_init_w);
    struct_assign(gx, g_init_x);
    struct_assign(gy, g_init_y);
    struct_assign(gz, g_init_z);
    struct_assign(svb, init_svb);
    struct_assign(svc, init_svc);
    struct_assign(svd, init_svd);
    struct_assign(sve, init_sve);
    struct_assign(svh, init_svh);
    struct_assign(svi, init_svi);
    struct_assign(svk, init_svk);
    struct_assign(svl, init_svl);
    struct_assign(svm, init_svm);
    struct_assign(svn, init_svn);
    struct_assign(svo, init_svo);
    struct_assign(svp, init_svp);
    struct_assign(svq, init_svq);
    struct_assign(svr, init_svr);
    struct_assign(svs, init_svs);
    struct_assign(svt, init_svt);
    struct_assign(svu, init_svu);
    struct_assign(svw, init_svw);
    struct_assign(svx, init_svx);
    struct_assign(svy, init_svy);

    gv.valuables[0].list = gg.gems[0];
    gv.valuables[0].size = SIZE(gg.gems);
    gv.valuables[1].list = ga.amulets[0];
    gv.valuables[1].size = SIZE(ga.amulets);
    gv.valuables[2].list = null;
    gv.valuables[2].size = 0;

    do { if (((g_init_a).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_a")); exit(1); } } while (0);
    do { if (((g_init_b).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_b")); exit(1); } } while (0);
    do { if (((g_init_c).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_c")); exit(1); } } while (0);
    do { if (((g_init_d).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_d")); exit(1); } } while (0);
    do { if (((g_init_e).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_e")); exit(1); } } while (0);
    do { if (((g_init_f).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_f")); exit(1); } } while (0);
    do { if (((g_init_g).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_g")); exit(1); } } while (0);
    do { if (((g_init_h).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_h")); exit(1); } } while (0);
    do { if (((g_init_i).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_i")); exit(1); } } while (0);
    do { if (((g_init_j).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_j")); exit(1); } } while (0);
    do { if (((g_init_k).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_k")); exit(1); } } while (0);
    do { if (((g_init_l).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_l")); exit(1); } } while (0);
    do { if (((g_init_m).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_m")); exit(1); } } while (0);
    do { if (((g_init_n).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_n")); exit(1); } } while (0);
    do { if (((g_init_o).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_o")); exit(1); } } while (0);
    do { if (((g_init_p).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_p")); exit(1); } } while (0);
    do { if (((g_init_q).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_q")); exit(1); } } while (0);
    do { if (((g_init_r).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_r")); exit(1); } } while (0);
    do { if (((g_init_s).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_s")); exit(1); } } while (0);
    do { if (((g_init_t).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_t")); exit(1); } } while (0);
    do { if (((g_init_u).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_u")); exit(1); } } while (0);
    do { if (((g_init_v).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_v")); exit(1); } } while (0);
    do { if (((g_init_w).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_w")); exit(1); } } while (0);
    do { if (((g_init_x).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_x")); exit(1); } } while (0);
    do { if (((g_init_y).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_y")); exit(1); } } while (0);
    do { if (((g_init_z).havestate != TRUE)) { raw_printf(_("decl_globals_init: %s.havestate not True."), _("g_init_z")); exit(1); } } while (0);

    gs.subrooms = svr.rooms[MAXNROFROOMS + 1];

    memset(addr_of(flags), 0, sizeof(struct_flag));
    memset(addr_of(iflags), 0, sizeof(struct_instance_flags));
    memset(addr_of(a11y), 0, sizeof(struct_accessibility_data));
    memset(addr_of(disp), 0, sizeof(struct_display_hints));
    memset(addr_of(u), 0, sizeof(struct_you));
    memset(addr_of(global_ref("ubirthday", long)), 0, sizeof(long));
    memset(addr_of(urealtime), 0, sizeof(struct_u_realtime));

    uwep = uarm = uswapwep = uquiver = uarmu = uskin = uarmc = null;
    uarmh = uarms = uarmg = uarmf = uamul = uright = uleft = null;
    ublindf = uchain = uball = null;

    WIN_MESSAGE =  WIN_STATUS =  WIN_MAP = WIN_INVEN = WIN_ERR;

    struct_assign(gu.urole, urole_init_data);
    struct_assign(gu.urace, urace_init_data);
}

/* fields in 'hands_obj' don't matter, just its distinct address */
export const hands_obj = static_struct("hands_obj", struct_obj, {});

/* gcc 12.2's static analyzer thinks that some fields of svc.context.victual
   are uninitialized when compiling 'bite(eat.c)' but that's impossible;
   it is defined at global scope so guaranteed to be given implicit
   initialization for fields that aren't explicitly initialized (all of
   'context'); having bite() pass &svc.context.victual to this no-op
   eliminates the analyzer's very verbose complaint */
export function sa_victual(
    context_victual) { /* void */
    return;
}

/*decl.c*/

import { A_INT } from "./attrib.h.js";
import { STR18 } from "./attrib.h.macros.js";
import { NO_COLOR } from "./color.h.js";
import {
    struct_const_globals, struct_display_hints, struct_instance_globals_a,
    struct_instance_globals_b, struct_instance_globals_c, struct_instance_globals_d,
    struct_instance_globals_e, struct_instance_globals_f, struct_instance_globals_g,
    struct_instance_globals_h, struct_instance_globals_i, struct_instance_globals_j,
    struct_instance_globals_k, struct_instance_globals_l, struct_instance_globals_m,
    struct_instance_globals_n, struct_instance_globals_o, struct_instance_globals_p,
    struct_instance_globals_q, struct_instance_globals_r, struct_instance_globals_s,
    struct_instance_globals_saved_b, struct_instance_globals_saved_c,
    struct_instance_globals_saved_d, struct_instance_globals_saved_e,
    struct_instance_globals_saved_h, struct_instance_globals_saved_i,
    struct_instance_globals_saved_k, struct_instance_globals_saved_l,
    struct_instance_globals_saved_m, struct_instance_globals_saved_n,
    struct_instance_globals_saved_o, struct_instance_globals_saved_p,
    struct_instance_globals_saved_q, struct_instance_globals_saved_r,
    struct_instance_globals_saved_s, struct_instance_globals_saved_t,
    struct_instance_globals_saved_u, struct_instance_globals_saved_w,
    struct_instance_globals_saved_x, struct_instance_globals_saved_y, struct_instance_globals_t,
    struct_instance_globals_u, struct_instance_globals_v, struct_instance_globals_w,
    struct_instance_globals_x, struct_instance_globals_y, struct_instance_globals_z,
} from "./decl.h.js";
import { S_ss1, S_ss2, S_ss3, S_ss4 } from "./defsym.h.js";
import { SHIELD_COUNT } from "./display.h.js";
import { struct_engr } from "./engrave.h.js";
import { struct_accessibility_data, struct_flag, struct_instance_flags } from "./flag.h.js";
import { BONESINIT, LOCKNAMEINIT } from "./fnamesiz.h.js";
import { COLNO, FALSE, MAXNROFROOMS, ROWNO, TRUE, phase_not_set } from "./global.h.js";
import {
    DIR_E, DIR_N, DIR_NE, DIR_NW, DIR_S, DIR_SE, DIR_SW, DIR_W, NUM_NHCB, N_DIRS, N_DIRS_Z,
    SELL_NORMAL, UNDEFINED_VALUE, struct_c_color_names, struct_c_common_strings, struct_sinfo,
} from "./hack.h.js";
import { UNDEFINED_PTR } from "./hack.h.macros.js";
import { NON_PM } from "./monsters.h.js";
import { struct_obj } from "./obj.h.js";
import { STRANGE_OBJECT } from "./objects.h.js";
import { soundlib_nosound } from "./sndprocs.h.js";
import { ANY_INVALID, WIN_ERR, wdmode_traditional } from "./wintype.h.js";
import { struct_Race, struct_Role, struct_u_realtime, struct_you } from "./you.h.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, long, ord, schar, sizeof, sizeof_string } from "../rt/ctypes.js";
import { global_ref, global_scalar } from "../rt/globals.js";
import { shl64 } from "../rt/int64.js";
import { exit, memset } from "../rt/libc.js";
import { init_string, static_array, static_struct } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, ptr_to, struct_assign } from "../rt/struct.js";
import { raw_printf } from "./pline.js";
