/* NetHack 5.0	optlist.h */
/* NetHack may be freely redistributed.  See license for details. */

/*
 *  NOTE:  If you add (or delete) an option, please review:
 *             doc/options.txt
 *
 *         It contains how-to info and outlines some required/suggested
 *         updates that should accompany your change.
 */

export const BoolOpt = 0; export const CompOpt = BoolOpt + 1; export const OthrOpt = CompOpt + 1;
export const No = 0; export const Yes = No + 1;
export const Off = 0; export const On = Off + 1;
/* Advanced options are only shown in the full, traditional options menu */

    export const OptS_General = 0; export const OptS_Behavior = OptS_General + 1; export const OptS_Map = OptS_Behavior + 1; export const OptS_Status = OptS_Map + 1; export const OptS_Advanced = OptS_Status + 1;

    export const Term_False = 0; export const Term_Off = Term_False + 1; export const Term_Disabled = Term_Off + 1; export const Term_Excluded = Term_Disabled + 1; export const num_terms = Term_Excluded + 1;

export const struct_allopt_t = struct("struct_allopt_t", {
    name: ptr_to(char),
    section: unsigned,
    minmatch: int,
    expectedbuf: int,
    idx: int,
    setwhere: unsigned,
    opttyp: unsigned,
    negateok: unsigned,
    valok: unsigned,
    dupeok: unsigned,
    pfx: unsigned,
    termpref: unsigned,
    opt_in_out: boolean, addr: ptr_to(schar),
    optfn: fnptr_t,
    alias: ptr_to(char),
    descr: ptr_to(char),
    prefixgw: ptr_to(char),
    initval: boolean, has_handler: boolean, dupdetected: boolean, disregarded: boolean,
});

/* this is not reliable because TILES_IN_GLYPHMAP might be defined
 * in a multi-interface binary but not apply to the current interface */

export const ascii_map_Def = On;
export const tiled_map_Def = Off;

/* B:nm, sec, ln, opt_*, setwhere?, on?, negat?, val?, dup?, hndlr? Alias,
            bool_p, term */
/* C:nm, sec, ln, opt_*, setwhere?, negateok?, valok?, dupok?, hndlr? Alias,
            desc */
/* P:pfx, sec, ln, opt_*, setwhere?, negateok?, valok?, dupok?, hndlr? Alias,
            desc*/
    /*
     * Most of the options are in alphabetical order; a few are forced
     * to the top of list so that doset() will list them first and
     * all_options_str() will gather them first to write to the top of
     * a new RC file by #saveoptions.
     *
     * windowtype comes first because its value can affect how wc_ and
     * wc2_ options are processed; playmode (for players who can't or
     * don't know how to specify a command line) and name (ditto, more
     * or less) come next; then role, race, gender, align.  Those will
     * be at the top of the file for #saveoptions constructed RC file.
     */
    export const opt_prefix_only = -1; export const opt_windowtype = opt_prefix_only + 1;

    export const opt_playmode = opt_windowtype + 1;

    export const opt_name = opt_playmode + 1;

    export const opt_role = opt_name + 1;

    export const opt_race = opt_role + 1;

    export const opt_gender = opt_race + 1;

    export const opt_alignment = opt_gender + 1;

    /* end of special ordering; remainder of entries are in alphabetical order
     */
    export const opt_accessiblemsg = opt_alignment + 1;

    export const opt_acoustics = opt_accessiblemsg + 1;

 /* NHOPTC(align) -- moved to top */
    export const opt_align_message = opt_acoustics + 1;

    export const opt_align_status = opt_align_message + 1;

    export const opt_altkeyhandling = opt_align_status + 1;

    export const opt_altmeta = opt_altkeyhandling + 1;

    export const opt_armorstatus = opt_altmeta + 1;

    export const opt_ascii_map = opt_armorstatus + 1;

    export const opt_o_autocomplete = opt_ascii_map + 1;

    export const opt_autodescribe = opt_o_autocomplete + 1;

    export const opt_autodig = opt_autodescribe + 1;

    export const opt_autoopen = opt_autodig + 1;

    export const opt_autopickup = opt_autoopen + 1;

    export const opt_o_autopickup_exceptions = opt_autopickup + 1;

    export const opt_autoquiver = opt_o_autopickup_exceptions + 1;

    export const opt_autounlock = opt_autoquiver + 1;

    export const opt_bgcolors = opt_autounlock + 1;

    export const opt_o_bind_keys = opt_bgcolors + 1;

    export const opt_BIOS = opt_o_bind_keys + 1;

    export const opt_blind = opt_BIOS + 1;

    export const opt_bones = opt_blind + 1;

    export const opt_boulder = opt_bones + 1;

    export const opt_catname = opt_boulder + 1;

    export const opt_checkpoint = opt_catname + 1;

    export const opt_cmdassist = opt_checkpoint + 1;

    export const opt_color = opt_cmdassist + 1;

    export const opt_confirm = opt_color + 1;

    export const opt_crash_email = opt_confirm + 1;

    export const opt_crash_name = opt_crash_email + 1;

    export const opt_crash_urlmax = opt_crash_name + 1;

    export const opt_customcolors = opt_crash_urlmax + 1;

    export const opt_customsymbols = opt_customcolors + 1;

    export const opt_dark_room = opt_customsymbols + 1;

    export const opt_deaf = opt_dark_room + 1;

    export const opt_DECgraphics = opt_deaf + 1;

    export const opt_debug_hunger = opt_DECgraphics + 1;

    export const opt_debug_mongen = opt_debug_hunger + 1;

    export const opt_debug_overwrite_stairs = opt_debug_mongen + 1;

    export const opt_disclose = opt_debug_overwrite_stairs + 1;

    export const opt_dogname = opt_disclose + 1;

    export const opt_dropped_nopick = opt_dogname + 1;

    export const opt_dungeon = opt_dropped_nopick + 1;

    export const opt_effects = opt_dungeon + 1;

    export const opt_eight_bit_tty = opt_effects + 1;

    export const opt_extmenu = opt_eight_bit_tty + 1;

    export const opt_female = opt_extmenu + 1;

    export const opt_fireassist = opt_female + 1;

    export const opt_fixinv = opt_fireassist + 1;

    export const opt_font_map = opt_fixinv + 1;

    export const opt_font_menu = opt_font_map + 1;

    export const opt_font_message = opt_font_menu + 1;

    export const opt_font_size_map = opt_font_message + 1;

    export const opt_font_size_menu = opt_font_size_map + 1;

    export const opt_font_size_message = opt_font_size_menu + 1;

    export const opt_font_size_status = opt_font_size_message + 1;

    export const opt_font_size_text = opt_font_size_status + 1;

    export const opt_font_status = opt_font_size_text + 1;

    export const opt_font_text = opt_font_status + 1;

    export const opt_force_invmenu = opt_font_text + 1;

    export const opt_fruit = opt_force_invmenu + 1;

    export const opt_fullscreen = opt_fruit + 1;

 /* NHOPTC(gender) -- moved to top */
    export const opt_glyph = opt_fullscreen + 1;

    export const opt_goldX = opt_glyph + 1;

    export const opt_guicolor = opt_goldX + 1;

    export const opt_help = opt_guicolor + 1;

    export const opt_herecmd_menu = opt_help + 1;

    export const opt_hilite_pet = opt_herecmd_menu + 1;

    export const opt_hilite_pile = opt_hilite_pet + 1;

    export const opt_hilite_status = opt_hilite_pile + 1;

    export const opt_hitpointbar = opt_hilite_status + 1;

    export const opt_horsename = opt_hitpointbar + 1;

    export const opt_IBMgraphics = opt_horsename + 1;

    export const opt_idlecheckpoint = opt_IBMgraphics + 1;

    export const opt_ignintr = opt_idlecheckpoint + 1;

    export const opt_implicit_uncursed = opt_ignintr + 1;

    export const opt_legacy = opt_implicit_uncursed + 1;

    export const opt_lit_corridor = opt_legacy + 1;

    export const opt_lootabc = opt_lit_corridor + 1;

    export const opt_mail = opt_lootabc + 1;

    export const opt_map_mode = opt_mail + 1;

    export const opt_mention_decor = opt_map_mode + 1;

    export const opt_mention_map = opt_mention_decor + 1;

    export const opt_mention_walls = opt_mention_map + 1;

    export const opt_menu_deselect_all = opt_mention_walls + 1;

    export const opt_menu_deselect_page = opt_menu_deselect_all + 1;

    export const opt_menu_first_page = opt_menu_deselect_page + 1;

    export const opt_menu_headings = opt_menu_first_page + 1;

    export const opt_menu_invert_all = opt_menu_headings + 1;

    export const opt_menu_invert_page = opt_menu_invert_all + 1;

    export const opt_menu_last_page = opt_menu_invert_page + 1;

    export const opt_menu_next_page = opt_menu_last_page + 1;

    export const opt_menu_objsyms = opt_menu_next_page + 1;

    export const opt_menu_overlay = opt_menu_objsyms + 1;

    export const opt_menu_previous_page = opt_menu_overlay + 1;

    export const opt_menu_search = opt_menu_previous_page + 1;

    export const opt_menu_select_all = opt_menu_search + 1;

    export const opt_menu_select_page = opt_menu_select_all + 1;

    export const opt_menu_shift_left = opt_menu_select_page + 1;

    export const opt_menu_shift_right = opt_menu_shift_left + 1;

    export const opt_menu_tab_sep = opt_menu_shift_right + 1;

    export const opt_menucolors = opt_menu_tab_sep + 1;

    export const opt_o_menu_colors = opt_menucolors + 1;

    export const opt_menuinvertmode = opt_o_menu_colors + 1;

    export const opt_menustyle = opt_menuinvertmode + 1;

    export const opt_o_message_types = opt_menustyle + 1;

    export const opt_mon_movement = opt_o_message_types + 1;

    export const opt_monpolycontrol = opt_mon_movement + 1;

    export const opt_montelecontrol = opt_monpolycontrol + 1;

    export const opt_monsters = opt_montelecontrol + 1;

    export const opt_mouse_support = opt_monsters + 1;

    export const opt_msg_window = opt_mouse_support + 1;

    export const opt_msghistory = opt_msg_window + 1;

 /* NHOPTC(name) -- moved to top */

    export const opt_news = opt_msghistory + 1;

    export const opt_nudist = opt_news + 1;

    export const opt_null = opt_nudist + 1;

    export const opt_number_pad = opt_null + 1;

    export const opt_objects = opt_number_pad + 1;

    export const opt_packorder = opt_objects + 1;

    /* prior to paranoid_confirmation, 'prayconfirm' was a distinct option */
    export const opt_paranoid_confirmation = opt_packorder + 1;

    export const opt_pauper = opt_paranoid_confirmation + 1;

    export const opt_perm_invent = opt_pauper + 1;

    export const opt_perminv_mode = opt_perm_invent + 1;

    export const opt_petattr = opt_perminv_mode + 1; /* tty/curses only */

    /* pettype is ignored for some roles */
    export const opt_pettype = opt_petattr + 1;

    export const opt_pickup_burden = opt_pettype + 1;

    export const opt_pickup_stolen = opt_pickup_burden + 1;

    export const opt_pickup_thrown = opt_pickup_stolen + 1;

    export const opt_pickup_types = opt_pickup_thrown + 1;

    export const opt_pile_limit = opt_pickup_types + 1;

    export const opt_player_selection = opt_pile_limit + 1;

 /* NHOPTC(playmode) -- moved to top */
    export const opt_popup_dialog = opt_player_selection + 1;

    export const opt_preload_tiles = opt_popup_dialog + 1; /* MSDOS only */

    export const opt_price_quotes = opt_preload_tiles + 1;

    export const opt_pushweapon = opt_price_quotes + 1;

    export const opt_query_menu = opt_pushweapon + 1;

    export const opt_quick_farsight = opt_query_menu + 1;

 /* NHOPTC(race) -- moved to top */

    export const opt_rawio = opt_quick_farsight + 1;

    export const opt_reroll = opt_rawio + 1;

    export const opt_rest_on_space = opt_reroll + 1;

    export const opt_roguesymset = opt_rest_on_space + 1;

 /* NHOPTC(role) -- moved to top */
    export const opt_runmode = opt_roguesymset + 1;

    export const opt_safe_pet = opt_runmode + 1;

    export const opt_safe_wait = opt_safe_pet + 1;

    export const opt_sanity_check = opt_safe_wait + 1;

    export const opt_scores = opt_sanity_check + 1;

    export const opt_scroll_amount = opt_scores + 1;

    export const opt_scroll_margin = opt_scroll_amount + 1;

    export const opt_selectsaved = opt_scroll_margin + 1;

    export const opt_showdamage = opt_selectsaved + 1;

    export const opt_showexp = opt_showdamage + 1;

    export const opt_showrace = opt_showexp + 1;

    export const opt_showscore = opt_showrace + 1;

    export const opt_showvers = opt_showscore + 1;

    export const opt_silent = opt_showvers + 1;

    export const opt_softkeyboard = opt_silent + 1;

    export const opt_sortdiscoveries = opt_softkeyboard + 1;

    export const opt_sortloot = opt_sortdiscoveries + 1;

    export const opt_sortpack = opt_sortloot + 1;

    export const opt_sortvanquished = opt_sortpack + 1;

    export const opt_soundlib = opt_sortvanquished + 1;

    export const opt_sounds = opt_soundlib + 1;

    export const opt_sparkle = opt_sounds + 1;

    export const opt_spot_monsters = opt_sparkle + 1;

    export const opt_splash_screen = opt_spot_monsters + 1;

    export const opt_standout = opt_splash_screen + 1;

    export const opt_status_updates = opt_standout + 1;

    export const opt_o_status_cond = opt_status_updates + 1;

    export const opt_statushilites = opt_o_status_cond + 1;

    export const opt_o_status_hilites = opt_statushilites + 1;

    export const opt_statuslines = opt_o_status_hilites + 1;

    export const opt_suppress_alert = opt_statuslines + 1;

    export const opt_symset = opt_suppress_alert + 1;

    export const opt_term_cols = opt_symset + 1;

    export const opt_term_rows = opt_term_cols + 1;

    export const opt_terrainstatus = opt_term_rows + 1;

    export const opt_tile_file = opt_terrainstatus + 1;

    export const opt_tile_height = opt_tile_file + 1;

    export const opt_tile_width = opt_tile_height + 1;

    export const opt_tiled_map = opt_tile_width + 1;

    export const opt_time = opt_tiled_map + 1;

    export const opt_timed_delay = opt_time + 1;

    export const opt_tips = opt_timed_delay + 1;

    export const opt_tombstone = opt_tips + 1;

    export const opt_toptenwin = opt_tombstone + 1;

    export const opt_traps = opt_toptenwin + 1;

    export const opt_travel = opt_traps + 1;

    export const opt_travel_debug = opt_travel + 1;

    export const opt_tutorial = opt_travel_debug + 1;

    export const opt_use_darkgray = opt_tutorial + 1;

    export const opt_use_inverse = opt_use_darkgray + 1;

    export const opt_use_truecolor = opt_use_inverse + 1;

    export const opt_vary_msgcount = opt_use_truecolor + 1;

    export const opt_verbose = opt_vary_msgcount + 1;

    export const opt_versinfo = opt_verbose + 1;

    export const opt_voices = opt_versinfo + 1;

    export const opt_vt_tiledata = opt_voices + 1;

    export const opt_vt_sounddata = opt_vt_tiledata + 1;

    export const opt_warnings = opt_vt_sounddata + 1;

    export const opt_weaponstatus = opt_warnings + 1;

    export const opt_whatis_coord = opt_weaponstatus + 1;

    export const opt_whatis_filter = opt_whatis_coord + 1;

    export const opt_whatis_menu = opt_whatis_filter + 1;

    export const opt_whatis_moveskip = opt_whatis_menu + 1;

    export const opt_windowborders = opt_whatis_moveskip + 1;

    export const opt_windowcolors = opt_windowborders + 1;

 /* NHOPTC(windowtype) -- moved to top */
    export const opt_wizmgender = opt_windowcolors + 1;

    export const opt_wizweight = opt_wizmgender + 1;

    export const opt_wraptext = opt_wizweight + 1;

    /*
     * Prefix-based Options
     */

    export const pfx_cond_ = opt_wraptext + 1;

    export const pfx_font = pfx_cond_ + 1; export const OPTCOUNT = pfx_font + 1;

    /* included for compatibility with old NetHack.cnf files */

/* *INDENT-ON* */
/* clang-format on */

/*optlist.h*/

import { boolean } from "./global.h.js";
import { char, int, schar, unsigned } from "../rt/ctypes.js";
import { fnptr_t, ptr_to, struct } from "../rt/struct.js";
