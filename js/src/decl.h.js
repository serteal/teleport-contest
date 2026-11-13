/* default object class symbols */

/* default mon class symbols */

/* empty string that is non-const for parameter use */

/* used by coloratt.c, options.c, utf8map.c, windows.c */

/* material strings */

/* current mon class symbols */

/* current object class symbols */

    /* under-wear, so to speak */

/* defined only when punished */

/* Window system stuff */

export const struct_tc_gbl_data = struct("struct_tc_gbl_data", { /* also declared in tcap.h */
    tc_AS: ptr_to(char), tc_AE: ptr_to(char), /* graphics start and end (tty font swapping) */
    tc_LI: int, tc_CO: int, /* lines and columns */
});

export const struct_display_hints = struct("struct_display_hints", {
    botl: boolean, /* partially redo status line */
    botlx: boolean, /* print an entirely new bottom line */
    time_botl: boolean, /* context.botl for 'time' (moves) only */
});

/*
 * 'gX' -- instance_globals holds engine state that does not need to be
 * persisted upon game exit.  The initialization state is well defined
 * and set in decl.c during early early engine initialization.
 *
 * Unlike instance_flags, values in the structure can be of any type.
 *
 * Pulled from other files to be grouped in one place.  Some comments
 * which came with them don't make much sense out of their original context.
 */

export const struct_instance_globals_a = struct("struct_instance_globals_a", {
    /* decl.c */
    afternmv: fnptr_t,

    /* detect.c */
    already_found_flag: int, /* used to augment first "already found a monster"
                             * message if 'cmdassist' is Off */
    /* do.c */
    at_ladder: boolean,

    /* dog.c */
    apelist: ptr_to("struct_autopickup_exception"),

    /* end.c */
    amulets: array_of("struct_valuable_data", LAST_AMULET + 1 - FIRST_AMULET),

    /* mon.c */
    animal_list: ptr_to(short), /* list of PM values for animal monsters */
    animal_list_count: int,

    /* options.c */

    /* pickup.c */
    A_first_hint: int, /* menustyle:Full plus 'A' response + !paranoid:A */
    A_second_hint: int, /* menustyle:Full plus 'A' response + paranoid:A */
    abort_looting: boolean,

    /* shk.c */
    auto_credit: boolean,

    /* sounds.c */
    active_soundlib: unsigned,

    /* trap.c */
    /* context for water_damage(), managed by water_damage_chain();
        when more than one stack of potions of acid explode while processing
        a chain of objects, use alternate phrasing after the first message */
    acid_ctx: "struct_h2o_ctx",

    havestate: boolean,
});

export const struct_instance_globals_b = struct("struct_instance_globals_b", {
    /* botl.c */
    blstats: array_of(array_of("struct_istat_s", MAXBLSTATS), 2),
    blinit: boolean,

    bl_hilite_moves: long,

    /* decl.c */
    bhitpos: "struct_nhcoord", /* place where throw or zap hits or stops */
    billobjs: ptr_to("struct_obj"), /* objects not yet paid for */

    /* files.c */
    bones: array_of(char, BONESSIZE),

    /* hack.c */
    bldrpush_oid: unsigned, /* id of last boulder pushed */
    bldrpushtime: long, /* turn that a message was given for pushing
                            * a boulder; used in lieu of Norep() */

    /* mkmaze.c */
    bughack: "lev_region", /* for preserving the insect legs when wallifying
                         * baalz level */

    /* pickup.c */
    bucx_filter: boolean,

    /* zap.c */
    buzzer: ptr_to("struct_monst"), /* zapper/caster/breather who initiates buzz() */

    /* new */
    bot_disabled: boolean,

    havestate: boolean,
});

export const struct_instance_globals_c = struct("struct_instance_globals_c", {
    command_queue: array_of(ptr_to("struct__cmd_queue"), NUM_CQS),

    /* botl.c */
    cond_hilites: array_of(ulong, BL_ATTCLR_MAX),
    condmenu_sortorder: int,

    /* cmd.c */
    Cmd: "struct_cmd", /* flag.h */
    /* Provide a means to redo the last command.  The flag `in_doagain'
       (decl.c below) is set to true while redoing the command.  This flag
       is tested in commands that require additional input (like `throw'
       which requires a thing and a direction), and the input prompt is
       not shown.  Also, while in_doagain is TRUE, no keystrokes can be
       saved into the saveq. */
    clicklook_cc: "struct_nhcoord",
    /* decl.c */
    chosen_windowtype: array_of(char, WINTYPELEN),
    cmd_key: int, /* parse() / rhack() */
    cmd_bind: ptr_to("struct_Cmd_bind"),
    command_count: cmdcount_nht,
    /* some objects need special handling during destruction or placement */
    current_wand: ptr_to("struct_obj"), /* wand currently zapped/applied */

    /* external pager; from getenv() or DEF_PAGER */

    /* dog.c */
    catname: array_of(char, PL_PSIZ),

    /* end.c */
    crash_email: ptr_to(char), // email for crash reports
    crash_name: ptr_to(char), // human name for crash reports
    crash_urlmax: int, // maximum length for the url of a crash report

    /* symbols.c */
    currentgraphics: int,

    /* files.c, cfgfiles.c */
    cmdline_rcfile: ptr_to(char), /* set in unixmain.c, used in options.c */
    config_section_chosen: ptr_to(char),
    config_section_current: ptr_to(char),
    chosen_symset_start: boolean,
    chosen_symset_end: boolean,

    /* invent.c */
    /* for perm_invent when operating on a partial inventory display, so that
       persistent one doesn't get shrunk during filtering for item selection
       then regrown to full inventory, possibly being resized in process */
    cached_pickinv_win: winid,
    core_invent_state: int,

    /* options.c */
    cmdline_windowsys: ptr_to(char), /* set in unixmain.c */
    color_colorings: ptr_to("struct_menucoloring"), /* alternate set of menu colors */

    /* pickup.c */
    /* current_container is set in use_container(), to be used by the
       callback routines in_container() and out_container() from askchain()
       and use_container().  Also used by menu_loot() and container_gone(). */
    current_container: ptr_to("struct_obj"),
    class_filter: boolean,

    /* questpgr.c */
    cvt_buf: array_of(char, CVT_BUF_SIZE),

    /* sounds.c */
    chosen_soundlib: unsigned,

    /* sp_lev.c */
    coder: ptr_to("struct_sp_coder"),

    /* uhitm.c */
    corpsenm_digested: short, /* monster type being digested, set by gulpum */

    /* zap.c */
    /* new */
    converted_savefile_loaded: boolean,

    havestate: boolean,
});

export const DOMOVE_WALK = 0x00000001; export const DOMOVE_RUSH = 0x00000002; export const struct_instance_globals_d = struct("struct_instance_globals_d", {
    /* decl.c */
    doorindex: int,
    done_money: long,
    domove_attempting: long,
    domove_succeeded: long,

    defer_see_monsters: boolean,

    /* dig.c */
    did_dig_msg: boolean,

    /* do.c */
    dfr_pre_msg: ptr_to(char), /* pline() before level change */
    dfr_post_msg: ptr_to(char), /* pline() after level change */
    did_nothing_flag: int, /* to augment the no-rest-next-to-monster message */

    /* dog.c */
    dogname: array_of(char, PL_PSIZ),

    /* end.c */
    done_seq: long, /* for counting deaths occurring on same hero_seq */

    /* mon.c */
    disintegested: boolean,

    /* objname.c */
    /* distantname used by distant_name() to pass extra information to
       xname_flags(); it would be much cleaner if this were a parameter,
       but that would require all xname() and doname() calls to be modified */
    distantname: int,

    /* pickup.c */
    decor_fumble_override: boolean,
    decor_levitate_override: boolean,

    /* new */
    deferred_showpaths: boolean,
    deferred_showpaths_dir: ptr_to(char),

    havestate: boolean,
});

export const struct_instance_globals_e = struct("struct_instance_globals_e", {
    /* cmd.c */
    en_win: winid,
    en_via_menu: boolean,
    ext_tlist: ptr_to("struct_ext_func_tab"), /* info for rhack() from doextcmd() */

    /* eat.c */
    eatmbuf: ptr_to(char), /* set by cpostfx() */

    /* mkmaze.c */
    ebubbles: ptr_to("struct_bubble"),

    /* new stuff */
    early_raw_messages: int, /* if raw_prints occurred early prior
                                 to gb.beyond_savefile_load */

    havestate: boolean,
});

export const struct_instance_globals_f = struct("struct_instance_globals_f", {
    /* decl.c */
    ftrap: ptr_to("struct_trap"),
    fqn_prefix: array_of(ptr_to(char), PREFIX_COUNT),
    ffruit: ptr_to("struct_fruit"),

    /* eat.c */
    force_save_hs: boolean,

    /* mhitm.c */
    far_noise: boolean,

    /* rumors.c */
    false_rumor_size: long,
    false_rumor_start: ulong,
    false_rumor_end: long,

    /* shk.c */
    followmsg: long, /* last time of follow message */

    havestate: boolean,
});

export const struct_instance_globals_g = struct("struct_instance_globals_g", {
    /* display.c */
    gbuf: array_of(array_of("gbuf_entry", COLNO), ROWNO),
    gbuf_start: array_of(short, ROWNO),
    gbuf_stop: array_of(short, ROWNO),

    /* do_name.c */
    getposx: coordxy, getposy: coordxy, /* cursor position in case of async resize */
    gloc_filter_map: ptr_to("struct_selectionvar"),
    gloc_filter_floodfill_match_glyph: int,

    /* dog.c */
    gtyp: xint16, /* type of dog's current goal */
    gx: coordxy, /* x position of dog's current goal */
    gy: coordxy, /* y position of dog's current goal */

    /* dokick.c */
    gate_str: ptr_to(char),

    /* end.c */
    /* 1st +1: subtracting first from last, 2nd +1: one slot for all glass */
    gems: array_of("struct_valuable_data", LAST_REAL_GEM + 1 - FIRST_REAL_GEM + 1),

    /* invent.c */
    glyph_reset_timestamp: long,

    /* nhlua.c */
    gmst_stored: boolean,
    gmst_moves: long,
    gmst_invent: ptr_to("struct_obj"),
    gmst_ubak: ptr_to(ptr_to(void_t)), gmst_disco: ptr_to(ptr_to(void_t)), gmst_mvitals: ptr_to(ptr_to(void_t)),
    gmst_spl_book: array_of("struct_spell", MAXSPELL + 1),

    /* pline.c */
    gamelog: ptr_to("struct_gamelog_line"),

    /* region.c */
    gas_cloud_diss_within: boolean,
    gas_cloud_diss_seen: int,

    /* new stuff */
    /* per-level glyph mapping flags */
    glyphmap_perlevel_flags: long,

    havestate: boolean,
});

export const struct_instance_globals_h = struct("struct_instance_globals_h", {
    /* decl.c */
    hname: ptr_to(char), /* name of the game (argv[0] of main) */

    /* where rumors, help, record are */

    hero_seq: long, /* 'moves*8 + n' where n is updated each hero move during
                    * the current turn */

    /* dog.c */
    horsename: array_of(char, PL_PSIZ),

    /* mhitu.c */
    hitmsg_mid: unsigned,
    hitmsg_prev: ptr_to("struct_attack"),

    havestate: boolean,
});

export const struct_instance_globals_i = struct("struct_instance_globals_i", {
    /* decl.c */
    in_doagain: int,
    in_mklev: boolean,
    in_steed_dismounting: boolean,
    invent: ptr_to("struct_obj"),

    /* do_wear.c */
    /* starting equipment gets auto-worn at beginning of new game,
       and we don't want stealth or displacement feedback then */
    initial_don: boolean, /* manipulated in set_wear() */

    /* invent.c */
    invbuf: ptr_to(char),
    invbufsiz: unsigned,
    item_action_in_progress: boolean,
    in_sync_perminvent: int,

    /* mon.c */
    itermonarr: ptr_to(ptr_to("struct_monst")), /* temporary array of all N monsters
                                * on the current level */

    /* restore.c */
    id_map: ptr_to("struct_bucket"),

    /* sp_lev.c */
    in_mk_themerooms: boolean,

    /* new */

    havestate: boolean,
});

export const struct_instance_globals_j = struct("struct_instance_globals_j", {
    /* apply.c */
    jumping_is_magic: int, /* current jump result of magic */

    havestate: boolean,
});

export const struct_instance_globals_k = struct("struct_instance_globals_k", {
    kickedloc: "struct_nhcoord", /* location hero just kicked */

    /* decl.c */
    kickedobj: ptr_to("struct_obj"), /* object in flight due to kicking */

    /* read.c */
    known: boolean,

    havestate: boolean,
});

export const struct_instance_globals_l = struct("struct_instance_globals_l", {
    /* cmd.c */
    last_command_count: cmdcount_nht,

    /* decl.c (before being incorporated into instance_globals_*) */

    locknum: int, /* max num of simultaneous users */

    /* where levels are */

    /* files.c */
    lockptr: int,
    lock: array_of(char, LOCKNAMESIZE),

    /* invent.c */
    lastinvnr: int, /* 0 ... 51 (never saved&restored) */

    /* light.c */
    light_base: ptr_to("struct_ls_t"),

    /* mklev.c */
    luathemes: array_of(ptr_to(void_t), MAXDUNGEON),

    /* mon.c */
    last_hider: unsigned, /* m_id of hides-under mon seen going into hiding */

    /* nhlan.c */

    /* nhlua.c */
    luacore: ptr_to(void_t), /* lua_State * */
    lua_warnbuf: array_of(char, BUFSZ),
    loglua: int,
    lua_sid: int,

    /* options.c */
    loot_reset_justpicked: boolean,

    /* save.c */
    looseball: ptr_to("struct_obj"), /* track uball during save and... */
    loosechain: ptr_to("struct_obj"), /* track uchain since saving might free it */

    /* sp_lev.c */
    lev_message: ptr_to(char),
    lregions: ptr_to("lev_region"),

    /* trap.c */
    launchplace: "struct_launchplace",

    /* windows.c */
    last_winchoice: ptr_to("struct_win_choices"),

    /* new stuff */
    lua_ver: array_of(char, LUA_VER_BUFSIZ),
    lua_copyright: array_of(char, LUA_COPYRIGHT_BUFSIZ),

    havestate: boolean,
});

export const struct_instance_globals_m = struct("struct_instance_globals_m", {
    /* apply.c */
    mkot_trap_warn_count: int,

    /* botl.c */
    mrank_sz: int, /* loaded by max_rank_sz */

    /* decl.c */
    multi: cmdcount_nht,
    multi_reason: ptr_to(char),
    multireasonbuf: array_of(char, QBUFSZ), /* note: smaller than usual [BUFSZ] */
    /* for xname handling of multiple shot missile volleys:
       number of shots, index of current one, validity check, shoot vs throw */
    m_shot: "struct_multishot",
    mrg_to_wielded: boolean, /* weapon picked is merged with wielded one */
    menu_colorings: ptr_to("struct_menucoloring"),
    migrating_objs: ptr_to("struct_obj"), /* objects moving to another dungeon level */

    /* dog.c */
    mydogs: ptr_to("struct_monst"), /* monsters that went down/up together with @ */
    migrating_mons: ptr_to("struct_monst"), /* monsters moving to another level */

    /* dokick.c */
    maploc: ptr_to("struct_rm"),

    /* mhitm.c */
    mswallower: ptr_to("struct_monst"), /* for gas spore explosion when it's swallowed*/

    /* mhitu.c */
    mhitu_dieroll: int,

    /* mklev.c */
    made_branch: boolean, /* used only during level creation */

    /* mkmap.c */
    min_rx: coordxy, /* rectangle bounds for regions */
    max_rx: coordxy,
    min_ry: coordxy,
    max_ry: coordxy,

    /* mkobj.c */
    mkcorpstat_norevive: boolean, /* for trolls */

    /* mthrowu.c */
    mesg_given: int, /* for m_throw()/thitu() 'miss' message */
    mtarget: ptr_to("struct_monst"), /* monster being shot by another monster */
    marcher: ptr_to("struct_monst"), /* monster that is shooting */

    /* muse.c */
    m_using: boolean, /* kludge to use mondied instead of killed */
    m: "struct_musable",

    /* options.c */
    /* Allow the user to map incoming characters to various menu commands. */
    mapped_menu_cmds: array_of(char, MAX_MENU_MAPPED_CMDS + 1), /* exported */
    mapped_menu_op: array_of(char, MAX_MENU_MAPPED_CMDS + 1),

    /* region.c */
    max_regions: int,

    /* trap.c */
    mentioned_water: boolean, /* set to True by water_damage() if it issues
                              * a message about water; dodip() should make
                              * POT_WATER should become discovered */

    havestate: boolean,
});

export const struct_instance_globals_n = struct("struct_instance_globals_n", {
    /* botl.c */
    now_or_before_idx: int, /* 0..1 for array[2][] first index */

    /* decl.c */
    nomovemsg: ptr_to(char),
    nsubroom: int,

    /* dokick.c */
    nowhere: "struct_rm",

    /* files.c */
    nesting: int,
    no_sound_notified: int, /* run-time option processing: warn once if built
                            * without USER_SOUNDS and config file contains
                            * SOUND=foo or SOUNDDIR=bar */

    /* mhitm.c */
    noisetime: long,

    /* mkmap.c */
    new_locations: ptr_to(char),
    n_loc_filled: int,

    /* options.c */
    n_menu_mapped: short,

    /* potion.c */
    notonhead: boolean, /* for long worms */

    /* questpgr.c */
    nambuf: array_of(char, CVT_BUF_SIZE),

    /* restore.c */
    n_ids_mapped: int,

    /* sp_lev.c */
    num_lregions: int,

    /* u_init.c */
    nocreate: short,
    nocreate2: short,
    nocreate3: short,
    nocreate4: short,

    havestate: boolean,
});

export const struct_instance_globals_o = struct("struct_instance_globals_o", {
    objs_deleted: ptr_to("struct_obj"),

    /* dbridge.c */
    occupants: array_of("struct_entity", ENTITIES),

    /* decl.c */
    occupation: fnptr_t,
    occtime: int,
    otg_temp: int, /* used by object_to_glyph() [otg] */
    otg_otmp: ptr_to("struct_obj"), /* used by obj_is_piletop() */
    occtxt: ptr_to(char), /* defined when occupation != NULL */

    /* symbols.c */
    ov_primary_syms: array_of(uchar, SYM_MAX), /* loaded primary symbols          */
    ov_rogue_syms: array_of(uchar, SYM_MAX), /* loaded rogue symbols           */

    /* invent.c */
    /* query objlist callback: return TRUE if obj is at given location */
    only: "struct_nhcoord",

    /* o_init.c */
    oclass_prob_totals: array_of(short, MAXOCLASSES),

    /* options.c */

    /* builtin_opt, syscf_, rc_file_, environ_, play_opt */
    opt_phase: unsigned,
    opt_initial: boolean,
    opt_from_file: boolean,
    opt_need_redraw: boolean, /* for doset() */
    opt_need_glyph_reset: boolean,
    opt_need_promptstyle: boolean,
    opt_reset_customcolors: boolean,
    opt_reset_customsymbols: boolean,
    opt_update_basic_palette: boolean,
    opt_symset_changed: boolean,

    /* pickup.c */
    oldcap: int, /* last encumbrance */

    /* restore.c */
    oldfruit: ptr_to("struct_fruit"),

    /* rumors.c */
    oracle_flg: int, /* -1=>don't use, 0=>need init, 1=>init done */

    /* uhitm.c */
    override_confirmation: boolean, /* Used to flag attacks caused by
                                    * Stormbringer's maliciousness. */
    /* zap.c */
    obj_zapped: boolean,

    havestate: boolean,
});

export const struct_instance_globals_p = struct("struct_instance_globals_p", {
    /* apply.c */
    polearm_range_min: int,
    polearm_range_max: int,

    /* decl.c */
    plnamelen: int, /* length of plname[] if that came from getlogin() */
    pl_race: char, /* character's race */
    plinemsg_types: ptr_to("struct_plinemsg_type"),

    /* dog.c */
    petname_used: int, /* user preferred pet name has been used */
    preferred_pet: char, /* '\0', 'c', 'd', 'n' (none) */

    /* symbols.c */
    primary_syms: array_of(uchar, SYM_MAX), /* loaded primary symbols          */

    /* invent.c */
    perm_invent_toggling_direction: int,

    /* pickup.c */
    picked_filter: boolean,
    pickup_encumbrance: int, /* when picking up multiple items in a single
                             * operation, encumbrance after previous item */

    /* pline.c */
    pline_flags: unsigned,
    prevmsg: array_of(char, BUFSZ),

    /* potion.c */
    potion_nothing: int,
    potion_unkn: int,

    /* pray.c */
    /* values calculated when prayer starts, and used when completed */
    p_aligntyp: aligntyp,
    p_trouble: int,
    p_type: int, /* (-1)-3: (-1)=really naughty, 3=really good */

    /* weapon.c */
    propellor: ptr_to("struct_obj"),

    /* zap.c */
    poly_zapped: int,

    /* new stuff */
    havestate: boolean,
});

export const struct_instance_globals_q = struct("struct_instance_globals_q", {
    havestate: boolean,
});

export const struct_instance_globals_r = struct("struct_instance_globals_r", {
    /* symbols.c */
    rogue_syms: array_of(uchar, SYM_MAX), /* loaded rogue symbols           */

    /* extralev.c */
    r: array_of(array_of("struct_rogueroom", 3), 3),

    /* mkmaze.c */
    ransacked: boolean,

    /* region.c */
    regions: ptr_to(ptr_to("NhRegion")),

    /* rip.c */
    rip: ptr_to(ptr_to(char)),

    /* role.c */
    role_pa: array_of(char, NUM_BP),
    role_post_attribs: char,
    rfilter: "struct_role_filter",

    /* shk.c */
    repo: "struct_repo",

    havestate: boolean,
});

export const struct_instance_globals_s = struct("struct_instance_globals_s", {
    /* artifact.c */
    spec_dbon_applies: int, /* coordinate effects from spec_dbon() with
                              messages in artifact_hit() */

    /* decl.c */
    stairs: ptr_to("struct_stairway"),
    smeq: array_of(int, MAXNROFROOMS + 1),
    stoned: boolean, /* done to monsters hit by 'c' */
    subrooms: ptr_to("struct_mkroom"),

    /* do.c */
    save_dlevel: "struct_d_level", /* ? [even back in 3.4.3, only used in bones.c] */

    /* symbols.c */
    symset: array_of("struct_symsetentry", NUM_GRAPHICS),
    /* adds UNICODESET */

        sym_customizations: array_of(array_of("struct_symset_customization", custom_count), NUM_GRAPHICS + 1),
    showsyms: array_of(uchar, SYM_MAX), /* symbols to be displayed */

    /* files.c */
    symset_count: int, /* for pick-list building only */
    symset_which_set: int,
    /* SAVESIZE, BONESSIZE, LOCKNAMESIZE are defined in "fnamesiz.h" */
    SAVEF: array_of(char, SAVESIZE), /* relative path of save file from playground */

    /* holds path of directory for save file */

    /* invent.c */
    sortlootmode: unsigned, /* set by sortloot() for use by sortloot_cmp();
                            * reset by sortloot when done */
    /* mhitm.c */
    skipdrin: boolean, /* mind flayer against headless target */

    /* mon.c */
    somebody_can_move: boolean,

    /* options.c */
    symset_list: ptr_to("struct_symsetentry"), /* files.c will populate this with
                                      * list of available sets */
    save_menucolors: boolean, /* copy of iflags.use_menu_colors */
    save_colorings: ptr_to("struct_menucoloring"), /* copy of gm.menu_colorings */
    simple_options_help: boolean,

    /* pickup.c */
    sellobj_first: boolean, /* True => need sellobj_state(); False => don't */
    shop_filter: boolean,

    /* pline.c */

    /* slot in saved_plines[] to use next */

    /* polyself.c */
    sex_change_ok: int, /* controls whether taking on new form or becoming new
                          man can also change sex (ought to be an arg to
                          polymon() and newman() instead) */

    /* shk.c */
    /* auto-response flag for/from "sell foo?" 'a' => 'y', 'q' => 'n' */
    sell_response: char,
    sell_how: int,

    /* spells.c */
    spl_sortmode: int, /* index into spl_sortchoices[] */
    spl_orderindx: ptr_to(int), /* array of svs.spl_book[] indices */

    /* steal.c */
    stealoid: unsigned, /* object to be stolen */
    stealmid: unsigned, /* monster doing the stealing */

    /* vision.c */
    seethru: int, /* 'bubble' debugging: clouds and water don't block light */

    havestate: boolean,
});

export const struct_instance_globals_t = struct("struct_instance_globals_t", {
    /* apply.c */
    trapinfo: "struct_trapinfo",

    /* decl.c */
    tbx: schar, /* mthrowu: target x */
    tby: schar, /* mthrowu: target y */
    toplines: array_of(char, TBUFSZ),
    thrownobj: ptr_to("struct_obj"), /* object in flight due to throwing */
    /* Windowing stuff that's really tty oriented, but present for all ports */
    tc_gbl_data: "struct_tc_gbl_data", /* AS,AE, LI,CO */

    /* hack.c */
    tmp_anything: "struct_any",
    travelmap: ptr_to("struct_selectionvar"),

    /* invent.c */
    /* query objlist callback: return TRUE if obj type matches "this_type" */
    this_type: int,
    this_title: ptr_to(char), /* title for inventory list of specific type */

    /* muse.c */
    trapx: coordxy,
    trapy: coordxy,

    /* rumors.c */
    true_rumor_size: long, /* rumor size variables are signed so that value -1
                           * can be used as a flag */
    true_rumor_start: ulong, /* rumor start offsets are unsigned due
                                     * to use of %lx format */
    true_rumor_end: long, /* rumor end offsets are signed because they're
                          * compared with [dlb_]ftell() */

    /* sp_lev.c */
    themeroom_failed: boolean,

    /* timeout.c */
    /* ordered timer list */
    timer_base: ptr_to("struct_fe"), /* "active" */

    /* topten.c */
    toptenwin: winid,

    /* uhitm.c */
    twohits: int, /* 0: single hit; 1: first of 2; 2: second of 2 */

    havestate: boolean,
});

export const struct_instance_globals_u = struct("struct_instance_globals_u", {
    /* botl.c */
    update_all: boolean,

    /* decl.c */
    unweapon: boolean,

    /* role.c */
    urole: "struct_Role", /* player's role. May be munged in role_init() */
    urace: "struct_Race", /* player's race. May be munged in role_init() */

    /* save.c */
    uz_save: "struct_d_level",

    /* new stuff */
    havestate: boolean,
});

export const struct_instance_globals_v = struct("struct_instance_globals_v", {
    /* botl.c */
    valset: array_of(schar, MAXBLSTATS),

    /* end.c */
    valuables: array_of("struct_val_list", 3),

    /* mhitm.c */
    vis: boolean,

    /* mklev.c */
    vault_x: coordxy,
    vault_y: coordxy,

    /* mon.c */
    vamp_rise_msg: boolean,

    /* pickup.c */
    val_for_n_or_more: long,
    /* list of menu classes for query_objlist() and allow_category callback
       (with room for all object classes, 'u'npaid, BUCX, and terminator) */
    valid_menu_classes: array_of(char, MAXOCLASSES + 1 + 4 + 1),

    /* vision.c */
    viz_array: ptr_to(ptr_to(uchar)), /* used in cansee() and couldsee() macros */
    viz_rmin: ptr_to(short), /* min could see indices */
    viz_rmax: ptr_to(short), /* max could see indices */
    vision_full_recalc: boolean,

    /* new stuff */
    voice: "struct_sound_voice",

    havestate: boolean,
});

export const struct_instance_globals_w = struct("struct_instance_globals_w", {
    /* decl.c */
    warn_obj_cnt: int, /* count of monsters meeting criteria */
    wailmsg: long,

    /* do_wear.c */
    wasinwater: uint8,

    /* symbols.c */
    warnsyms: array_of(uchar, WARNCOUNT), /* the current warning display symbols */

    /* files.c */
    wizkit: array_of(char, WIZKIT_MAX),

    /* hack.c */
    wc: int, /* current weight_cap(); valid after call to inv_weight() */

    /* mkmaze.c */
    wportal: ptr_to("struct_trap"),

    /* new */
    wsettings: "struct_win_settings", /* wintype.h */
    were_changes: long, /* were.c, allmain.c */

    havestate: boolean,
});

export const struct_instance_globals_x = struct("struct_instance_globals_x", {
    /* decl.c */
    x_maze_max: int,

    /* lock.c */
    xlock: "struct_xlock_s",

    /* objnam.c */
    xnamep: ptr_to(char), /* obuf[] returned by xname(), for use in doname() for
                   * bounds checking; differs from xname() return value
                   * due to reserving PREFIX bytes at start and possibly
                   * skipping leading "the " after constructing result */

    /* sp_lev.c */
    xstart: coordxy, xsize: coordxy,

    havestate: boolean,
});

export const struct_instance_globals_y = struct("struct_instance_globals_y", {
    /* decl.c */
    y_maze_max: int,
    youmonst: "struct_monst",

    /* pline.c */
    /* work buffer for You(), &c and verbalize() */
    you_buf: ptr_to(char),
    you_buf_siz: int,

    /* sp_lev.c */
    ystart: coordxy, ysize: coordxy,

    havestate: boolean,
});

export const struct_instance_globals_z = struct("struct_instance_globals_z", {
    /* mon.c */
    zombify: boolean,

    /* muse.c */
    zap_oseen: boolean, /* for wands which use mbhitm and are zapped at
                        * players.  We usually want an oseen local to
                        * the function, but this is impossible since the
                        * function mbhitm has to be compatible with the
                        * normal zap routines, and those routines don't
                        * remember who zapped the wand. */

    havestate: boolean,
});

export const struct_instance_globals_saved_b = struct("struct_instance_globals_saved_b", {
    /* dungeon.c */
    branches: ptr_to("struct_branch"), /* dungeon branch list */
    /* mkmaze.c */
    bbubbles: ptr_to("struct_bubble"),
    /* o_init.c */
    bases: array_of(int, MAXOCLASSES + 2), /* make bases[MAXOCLASSES+1] available */
});

export const struct_instance_globals_saved_c = struct("struct_instance_globals_saved_c", {
    /* decl.c */
    context: "struct_context_info",
});

export const struct_instance_globals_saved_d = struct("struct_instance_globals_saved_d", {
    /* dungeon.c */
    dungeons: array_of("struct_dungeon", MAXDUNGEON), /* ini'ed by init_dungeon() */
    dungeon_topology: "struct_dgn_topology",
    /* decl.c */
    dndest: "struct_dest_area",
    doors: ptr_to("struct_nhcoord"), /* array of door locations */
    doors_alloc: int, /* doors-array allocated size */
    /* o_init.c */
    disco: array_of(short, NUM_OBJECTS),
});

export const struct_instance_globals_saved_e = struct("struct_instance_globals_saved_e", {
    /* decl.c */
    exclusion_zones: ptr_to("struct_exclusion_zone"),
});

export const struct_instance_globals_saved_h = struct("struct_instance_globals_saved_h", {
    /* decl.c */
    hackpid: int, /* current process id */
});

export const struct_instance_globals_saved_i = struct("struct_instance_globals_saved_i", {
    /* decl.c */
    inv_pos: "struct_nhcoord",
});

export const struct_instance_globals_saved_k = struct("struct_instance_globals_saved_k", {
    /* decl.c */
    killer: "struct_kinfo",
});

export const struct_instance_globals_saved_l = struct("struct_instance_globals_saved_l", {
    /* decl.c */
    lastseentyp: array_of(array_of(schar, ROWNO), COLNO), /* last seen/touched dungeon typ */
    level: "dlevel_t", /* level map */
    level_info: array_of("struct_linfo", MAXLINFO),
});

export const struct_instance_globals_saved_m = struct("struct_instance_globals_saved_m", {
    /* dungeon.c */
    mapseenchn: ptr_to("struct_mapseen"), /*DUNGEON_OVERVIEW*/
    /* decl.c */
    moves: long, /* turn counter */
    mvitals: array_of("struct_mvitals", NUMMONS),
});

export const struct_instance_globals_saved_n = struct("struct_instance_globals_saved_n", {
    /* dungeon.c */
    n_dgns: int, /* number of dungeons (also used in mklev.c and do.c) */
    /* files.c */
    nhuuid: array_of(char, NHUUIDSZ),
    /* mkroom.c */
    nroom: int,
    /* region.c */
    n_regions: int,
});

export const struct_instance_globals_saved_o = struct("struct_instance_globals_saved_o", {
    /* rumors.c */
    oracle_cnt: unsigned, /* oracles are handled differently from rumors... */
    oracle_loc: ptr_to(ulong),

    /* other */
    omoves: long, /* level timestamp */
});

export const struct_instance_globals_saved_p = struct("struct_instance_globals_saved_p", {
    /* decl.c */
    plname: array_of(char, PL_NSIZ), /* player name */
    pl_character: array_of(char, PL_CSIZ),
    pl_fruit: array_of(char, PL_FSIZ),
});

export const struct_instance_globals_saved_q = struct("struct_instance_globals_saved_q", {
    /* quest.c */
    quest_status: "struct_q_score",
});

export const struct_instance_globals_saved_r = struct("struct_instance_globals_saved_r", {
    /* mkroom.c */
    rooms: array_of("struct_mkroom", (MAXNROFROOMS + 1) * 2),
});

export const struct_instance_globals_saved_s = struct("struct_instance_globals_saved_s", {
    /* decl.c */
    spl_book: array_of("struct_spell", MAXSPELL + 1),
    sp_levchn: ptr_to("struct_s_level"),
});

export const struct_instance_globals_saved_t = struct("struct_instance_globals_saved_t", {
    /* decl.c */
    tune: array_of(char, 6),
    /* timeout.c */
    timer_id: ulong,
});

export const struct_instance_globals_saved_u = struct("struct_instance_globals_saved_u", {
    /* decl.c */
    updest: "struct_dest_area",
});

export const struct_instance_globals_saved_w = struct("struct_instance_globals_saved_w", {
    /* reserved */
    wreserve: long,
    wtreserved: int,
});

export const struct_instance_globals_saved_x = struct("struct_instance_globals_saved_x", {
    /* mkmaze.c */
    xmin: int, xmax: int, /* level boundaries x */
});

export const struct_instance_globals_saved_y = struct("struct_instance_globals_saved_y", {
    /* mkmaze.c */
    ymin: int, ymax: int, /* level boundaries y */
});

/* flags describing game's current state */

export const struct_const_globals = struct("struct_const_globals", {
    zeroobj: "struct_obj", /* used to zero out a struct obj */
    zeromonst: "struct_monst", /* used to zero out a struct monst */
    zeroany: "struct_any", /* used to zero out union any */
    zeroNhRect: "struct_nhrect", /* used to zero out NhRect */
});

import { aligntyp } from "./align.h.js";
import { BL_ATTCLR_MAX, MAXBLSTATS } from "./botl.h.js";
import { MAXOCLASSES } from "./defsym.h.js";
import { BONESSIZE, LOCKNAMESIZE, SAVESIZE } from "./fnamesiz.h.js";
import {
    BUFSZ, COLNO, MAXDUNGEON, MAXNROFROOMS, PL_CSIZ, PL_FSIZ, PL_NSIZ, PL_PSIZ, QBUFSZ, ROWNO,
    TBUFSZ, boolean, coordxy, xint16,
} from "./global.h.js";
import {
    CVT_BUF_SIZE, ENTITIES, LUA_COPYRIGHT_BUFSIZ, LUA_VER_BUFSIZ, MAXLINFO, MAX_MENU_MAPPED_CMDS,
    NHUUIDSZ, NUM_BP, NUM_CQS, PREFIX_COUNT, SYM_MAX, WINTYPELEN, WIZKIT_MAX, cmdcount_nht,
} from "./hack.h.js";
import { uint8 } from "./integer.h.js";
import { NUMMONS } from "./monsters.h.js";
import { MAXSPELL } from "./objclass.h.js";
import {
    FIRST_AMULET, FIRST_REAL_GEM, LAST_AMULET, LAST_REAL_GEM, NUM_OBJECTS,
} from "./objects.h.js";
import { NUM_GRAPHICS, WARNCOUNT, custom_count } from "./sym.h.js";
import { winid } from "./wintype.h.js";
import { char, int, long, schar, short, uchar, ulong, unsigned } from "../rt/ctypes.js";
import { array_of, fnptr_t, ptr_to, struct, void_t } from "../rt/struct.js";
