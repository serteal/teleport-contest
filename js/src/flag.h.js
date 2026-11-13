/* NetHack 5.0	flag.h	$NHDT-Date: 1744860497 2025/04/16 19:28:17 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.251 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2006. */
/* NetHack may be freely redistributed.  See license for details. */

/* If you change the flag structure make sure you increment EDITLEVEL in   */
/* patchlevel.h if needed.  Changing the instance_flags structure does     */
/* not require incrementing EDITLEVEL.                                     */

/*
 * Persistent flags that are saved and restored with the game.
 *
 */

export const AUTOUNLOCK_UNTRAP = 1; export const AUTOUNLOCK_APPLY_KEY = 2; export const AUTOUNLOCK_KICK = 4; export const AUTOUNLOCK_FORCE = 8; export const NEW_MOON = 0; export const FULL_MOON = 4; export const PARANOID_CONFIRM = 0x0001; export const PARANOID_QUIT = 0x0002; export const PARANOID_DIE = 0x0004; export const PARANOID_BONES = 0x0008; export const PARANOID_HIT = 0x0010; export const PARANOID_PRAY = 0x0020; export const PARANOID_REMOVE = 0x0040; export const PARANOID_BREAKWAND = 0x0080; export const PARANOID_WERECHANGE = 0x0100; export const PARANOID_EATING = 0x0200; export const PARANOID_SWIM = 0x0400; export const PARANOID_TRAP = 0x0800; export const PARANOID_AUTOALL = 0x1000; export const VI_NUMBER = 1; export const VI_NAME = 2; export const VI_BRANCH = 4; export const NUM_DISCLOSURE_OPTIONS = 6; export const DISCLOSE_PROMPT_DEFAULT_YES = ord('y'); export const DISCLOSE_PROMPT_DEFAULT_NO = ord('n'); export const DISCLOSE_PROMPT_DEFAULT_SPECIAL = ord('?'); export const DISCLOSE_YES_WITHOUT_PROMPT = ord('+'); export const DISCLOSE_NO_WITHOUT_PROMPT = ord('-'); export const DISCLOSE_SPECIAL_WITHOUT_PROMPT = ord('#'); export const struct_flag = struct("struct_flag", {
    acoustics: boolean, /* allow dungeon sound messages */
    armorstatus: boolean, /* show armor info on status lines */
    autodig: boolean, /* MRKR: Automatically dig */
    autoquiver: boolean, /* Automatically fill quiver */
    autoopen: boolean, /* open doors by walking into them */
    beginner: boolean, /* True early in each game; affects feedback */
    biff: boolean, /* enable checking for mail */
    bones: boolean, /* allow saving/loading bones */
    confirm: boolean, /* confirm before hitting tame monsters */
    dark_room: boolean, /* show shadows in lit rooms */
    debug: boolean, /* in debugging mode (aka wizard mode) */

    end_own: boolean, /* list all own scores */
    explore: boolean, /* in exploration mode (aka discover mode) */

    female: boolean,
    friday13: boolean, /* it's Friday the 13th */
    goldX: boolean, /* for BUCX filtering, whether gold is X or U */
    help: boolean, /* look in data file for info about stuff */
    tips: boolean, /* show helpful hints? */
    tutorial: boolean, /* ask if player wants tutorial level? */
    ignintr: boolean, /* ignore interrupts */
    implicit_uncursed: boolean, /* maybe omit "uncursed" status in inventory */
    ins_chkpt: boolean, /* checkpoint as appropriate; INSURANCE */
    invlet_constant: boolean, /* let objects keep their inventory symbol */
    legacy: boolean, /* print game entry "story" */
    lit_corridor: boolean, /* show a dark corr as lit if it is in sight */
    mention_decor: boolean, /* give feedback for unobscured furniture */
    mention_walls: boolean, /* give feedback when bumping walls */
    nap: boolean, /* `timed_delay' option for display effects */
    nopick_dropped: boolean, /* items you dropped may be autopicked */
    null: boolean, /* OK to send nulls to the terminal */
    pickup: boolean, /* whether you pickup or move and look */
    pickup_stolen: boolean, /* auto-pickup items stolen by a monster */
    pickup_thrown: boolean, /* auto-pickup items you threw */
    pushweapon: boolean, /* When wielding, push old weapon into second slot */
    quick_farsight: boolean, /* True disables map browsing during random
                              * clairvoyance */
    rest_on_space: boolean, /* space means rest */
    safe_dog: boolean, /* give complete protection to the dog */
    safe_wait: boolean, /* prevent wait or search next to hostile */
    showexp: boolean, /* show experience points */
    showscore: boolean, /* show score */
    showvers: boolean, /* show version on status lines */
    silent: boolean, /* whether the bell rings or not */
    sortpack: boolean, /* sorted inventory */
    sparkle: boolean, /* show "resisting" special FX (Scott Bigham) */
    standout: boolean, /* use standout for --More-- */
    terrainstatus: boolean, /* show terrain info on status lines */
    time: boolean, /* display elapsed 'time' */
    tombstone: boolean, /* print tombstone */
    verbose: boolean, /* max battle info */
    weaponstatus: boolean, /* show weapon info on status lines */
    end_top: int, end_around: int, /* describe desired score list */
    autounlock: unsigned, /* locked door/chest action */

    moonphase: unsigned,
    suppress_alert: ulong,

    paranoia_bits: unsigned, /* alternate confirmation prompting */

    versinfo: unsigned, /* flag mask for 'showvers' option */
    /* mask bits for 'versinfo'; numeric order does not match display order
       which is "name branch number" */

    pickup_burden: int, /* maximum burden before prompt */
    pile_limit: int, /* controls feedback when walking over objects */
    discosort: char, /* order of dodiscovery/doclassdisco output: o,s,c,a */
    sortloot: char, /* 'n'=none, 'l'=loot (pickup), 'f'=full ('l'+invent) */
    vanq_sortmode: uchar, /* [uint_8] order of vanquished monsters: 0..7 */
    inv_order: array_of(char, MAXOCLASSES),
    pickup_types: array_of(char, MAXOCLASSES),

    end_disclose: array_of(char, NUM_DISCLOSURE_OPTIONS + 1), /* disclose various
                                                      info upon exit */
    menu_style: char, /* User interface style setting */
    made_fruit: boolean, /* don't easily let user overflow fruit limit */

    /* KMH, role patch -- Variables used during startup.
     *
     * If the user wishes to select a role, race, gender, and/or alignment
     * during startup, the choices should be recorded here.  This
     * might be specified through command-line options, environmental
     * variables, a popup dialog box, menus, etc.
     *
     * These values are each an index into an array.  They are not
     * characters or letters, because that limits us to 26 roles.
     * They are not booleans, because someday someone may need a neuter
     * gender.  Negative values are used to indicate that the user
     * hasn't yet specified that particular value.  If you determine
     * that the user wants a random choice, then you should set an
     * appropriate random value; if you just left the negative value,
     * the user would be asked again!
     *
     * These variables are stored here because the u structure is
     * cleared during character initialization, and because the
     * flags structure is restored for saved games.  Thus, we can
     * use the same parameters to build the role entry for both
     * new and restored games.
     *
     * These variables should not be referred to after the character
     * is initialized or restored (specifically, after role_init()
     * is called).
     */
    initrole: int, /* starting role      (index into roles[])   */
    initrace: int, /* starting race      (index into races[])   */
    initgend: int, /* starting gender    (index into genders[]) */
    initalign: int, /* starting alignment (index into aligns[])  */
    randomall: int, /* randomly assign everything not specified */
    pantheon: int, /* deity selection for priest character */
    /* Items which were in iflags in 3.4.x to preserve savefile compatibility
     */
    lootabc: boolean, /* use "a/b/c" rather than "o/i/b" when looting */
    showrace: boolean, /* show hero glyph by race rather than by role */
    travelcmd: boolean, /* allow travel command */
    runmode: int, /* update screen display during run moves */

    reserved1: int,
    reserved2: int,
    reserved3: int,
    reserved4: int,
    reserved5: int,
    reserved6: int,
    reserved7: int,
    reserved8: int,
});

/*
 * Flags that are set each time the game is started.
 * These are not saved with the game.
 *
 */

/* values for iflags.getpos_coords */
export const GPCOORDS_NONE = ord('n');
export const GPCOORDS_MAP = ord('m');
export const GPCOORDS_COMPASS = ord('c');
export const GPCOORDS_COMFULL = ord('f');
export const GPCOORDS_SCREEN = ord('s');

    export const GFILTER_NONE = 0;
    export const GFILTER_VIEW = GFILTER_NONE + 1;
    export const GFILTER_AREA = GFILTER_VIEW + 1;

    export const NUM_GFILTER = GFILTER_AREA + 1;

export const struct_debug_flags = struct("struct_debug_flags", {
    test: boolean,

    ttystatus: boolean,
});

    export const wcolor_menu = 0; export const wcolor_message = wcolor_menu + 1; export const wcolor_status = wcolor_message + 1; export const wcolor_text = wcolor_status + 1;
    export const WC_COUNT = wcolor_text + 1;

export const struct_windowcolors_struct = struct("struct_windowcolors_struct", {
    fg: ptr_to(char),
    bg: ptr_to(char),
});

export const struct_accessibility_data = struct("struct_accessibility_data", {
    accessiblemsg: boolean, /* use msg_loc for plined messages */
    msg_loc: "struct_nhcoord", /* accessiblemsg: location */
    mon_notices: boolean, /* msg when hero notices a monster */
    mon_notices_blocked: int, /* temp disable mon_notices */
    mon_movement: boolean, /* msg when hero sees monster move */
    glyph_updates: boolean, /* msg when map glyphs change */
});

    export const fuzzer_off = 0;
    export const fuzzer_impossible_panic = fuzzer_off + 1;
    export const fuzzer_impossible_continue = fuzzer_impossible_panic + 1;

/*
 * Stuff that really isn't option or platform related and does not
 * get saved and restored.  They are set and cleared during the game
 * to control the internal behavior of various NetHack functions
 * and probably warrant a structure of their own elsewhere some day.
 */
export const TER_MAP = 0x01; export const TER_TRP = 0x02; export const TER_OBJ = 0x04; export const TER_MON = 0x08; export const TER_FULL = 0x10; export const TER_DETECT = 0x20; export const struct_instance_flags = struct("struct_instance_flags", {
    defer_plname: boolean, /* X11 hack: askname() might not set svp.plname */
    fuzzerpending: boolean, /* fuzzing requested on command line but not active
                            * yet (to allow interactive initialization prior
                            * to input becoming taken over);
                            * True => enable fuzzer when entering moveloop */
    herecmd_menu: boolean, /* use menu when mouseclick on yourself */
    idlecheckpoint: boolean, /* platform should perform a checkpoint update
                              * if waiting for input longer than 10 seconds */
    invis_goldsym: boolean, /* gold symbol is ' '? */
    in_lua: boolean, /* executing a lua script */
    lua_testing: boolean, /* doing lua tests */
    term_gone: boolean, /* terminal is gone, abort abort abort */
    nofollowers: boolean, /* level change ignores pets (for tutorial) */
    partly_eaten_hack: boolean, /* extra flag for xname() used when it's called
                                * indirectly so we can't use xname_flags() */
    query_menu: boolean, /* use a menu for yes/no queries */
    remember_getpos: boolean, /* save getpos() positioning in do-again queue */
    sad_feeling: boolean, /* unseen pet is dying */
    showdamage: boolean, /* extra message reporting damage hero has taken */
    pending_customizations: boolean, /* at least one custom. was specified */
    debug_fuzzer: xint8, /* fuzz testing */
    at_midnight: int, /* only valid during end of game disclosure */
    at_night: int, /* also only valid during end of game disclosure */
    failing_untrap: int, /* move_into_trap() -> spoteffects() -> dotrap() */
    getdir_click: int, /* as input to getdir(): non-zero, accept simulated
                            * click that's not adjacent to or on hero;
                            * as output from getdir(): simulated button used
                            * 0 (none) or CLICK_1 (left) or CLICK_2 (right) */
    getloc_filter: int, /* GFILTER_foo */
    in_lava_effects: int, /* hack for Boots_off() */
    last_msg: int, /* indicator of last message player saw */
    menuobjsyms: int, /* value of 'menu_objsyms' option;
                            * ought to be in flags rather than iflags */
    override_ID: int, /* true to force full identification of objects */
    parse_config_file_src: int, /* hack for parse_config_line() */
    purge_monsters: int, /* # of dead monsters still on fmon list */
    raw_printed: int, /* count of messages issued before window_inited */
    suppress_price: int, /* controls doname() for unpaid objects */
    terrainmode: unsigned, /* for getpos()'s autodescribe during #terrain */

    bgcolors: boolean, /* display background colors on a map position */
    getloc_moveskip: boolean,
    getloc_travelmode: boolean,
    getloc_usemenu: boolean,
    travelcc: "struct_nhcoord", /* coordinates for travel_cache */
    trav_debug: boolean, /* display travel path (#if DEBUG only) */
    window_inited: boolean, /* true if init_nhwindows() completed */
    vision_inited: boolean, /* true if vision is ready */
    sanity_check: boolean, /* run sanity checks */
    sanity_no_check: boolean, /* skip next sanity check */
    debug_overwrite_stairs: boolean, /* debug: allow overwriting stairs */
    debug_mongen: boolean, /* debug: prevent monster generation */
    debug_hunger: boolean, /* debug: prevent hunger */
    debug_prevent_pline: boolean, /* debug: prevent pline going to UI */
    mon_polycontrol: boolean, /* debug: control monster polymorphs */
    mon_telecontrol: boolean, /* debug: control monster teleports */
    in_dumplog: boolean, /* doing the dumplog right now? */
    in_parse: boolean, /* is a command being parsed? */
     /* suppress terminate during options parsing, for --showpaths */
    initoptions_noterminate: boolean,

    /* stuff that is related to options and/or user or platform preferences
     */
    msg_history: unsigned, /* hint: # of top lines to save */
    getpos_coords: int, /* show coordinates when getting cursor position */
    menuinvertmode: int, /* 0 = invert toggles every item;
                           * 1 = invert skips 'all items' item */
    terrain_typ: int, /* index into terrain_descr[] for botl */
    menu_headings: "struct_color_and_attr", /* CLR_ and ATR_ for menu headings */
    colorcount: unsigned, /* store how many colors terminal is capable of */
    use_truecolor: boolean, /* force use of truecolor */

    altmeta: boolean, /* Alt+c sends ESC c rather than M-c */

    autodescribe: boolean, /* autodescribe mode in getpos() */
    cbreak: boolean, /* in cbreak mode, rogue format */
    deferred_X: boolean, /* deferred entry into explore mode */
    defer_decor: boolean, /* terrain change message vs slipping on ice */
    echo: boolean, /* 1 to echo characters */
    force_invmenu: boolean, /* always menu when handling inventory */
    hilite_pile: boolean, /* mark piles of objects with a hilite */
    menu_head_objsym: boolean, /* Show obj symbol in menu headings; controlled
                               * by 'menuobjsyms' */
    menu_overlay: boolean, /* Draw menus over the map */
    menu_requested: boolean, /* Flag for overloaded use of 'm' prefix
                               * on some non-move commands */
    menu_tab_sep: boolean, /* Use tabs to separate option menu fields */
    news: boolean, /* print news */
    num_pad: boolean, /* use numbers for movement commands */
    perm_invent: boolean, /* display persistent inventory window */
    perm_invent_pending: boolean, /* need to try again */
    pricequotes: boolean, /* display price quotes on unIDd objects */
    renameallowed: boolean, /* can change hero name during role selection */
    renameinprogress: boolean, /* we are changing hero name */
    sounds: boolean, /* master on/off switch for using soundlib */
    status_updates: boolean, /* allow updates to bottom status lines;
                               * disable to avoid excessive noise when using
                               * a screen reader (use ^X to review status) */
    toptenwin: boolean, /* ending list in window instead of stdout */
    tux_penalty: boolean, /* True iff hero is a monk and wearing a suit */
    use_background_glyph: boolean, /* use background glyph when appropriate */
    use_menu_color: boolean, /* use color in menus; only if wc_color */
    use_menu_glyphs: boolean, /* use object glyphs in menus, if the port
                               * supports it; controlled by 'menuobjsyms' */

    hilite_delta: long, /* number of moves to leave a temp hilite lit */
    unhilite_deadline: long, /* time when oldest temp hilite should be unlit */

    voices: boolean, /* enable text-to-speech or other talking */
    zerocomp: boolean, /* write zero-compressed save files */
    rlecomp: boolean, /* alternative to zerocomp; run-length encoding
                               * compression of levels when writing savefile */
    ice_rating: schar, /* ice_descr()'s classification of ice terrain */
    prev_decor: schar, /* 'mention_decor' just mentioned this */
    num_pad_mode: uchar, /* for num_pad==True, controls how 5 behaves
                               * and/or 789456123 vs phone-style 123456789;
                               * for False, qwertY vs qwertZ */
    perminv_mode: uchar, /* what to display in persistent invent window
                               * 0: nothing, 1: all inventory except gold,
                               * 2: full including gold, 8: in-use items only,
                               * 5|6: 1|2 with invent letters shown in empty
                               * slots (TTY only: 'sparse' modes) */
    bouldersym: uchar, /* symbol for boulder display */
    prevmsg_window: char, /* type of old message window to use */
    extmenu: boolean, /* extended commands use menu interface */

    /* use IBM or ST BIOS calls when appropriate */

    /* whether can use rawio (IOCTL call) */

    /* has a vga adapter */
    /* use the vga adapter */
    /* has a VESA-capable VGA adapter */
    /* use the VESA-capable VGA adapter */
    /* currently in graphics mode */

    /* mail is initialized */
    /* mail is awaiting display */

    /* output console codes for tile support in TTY */

    /* output console codes for sound support in TTY*/

    cmdassist: boolean, /* provide detailed assistance for some comnds */
    fireassist: boolean, /* autowield launcher when using fire-command */
    wizweight: boolean, /* display weight of everything in wizard mode */
    wizmgender: boolean, /* test gender info from core in window port */
    customcolors: boolean, /* support customcolors defined in glyphmap */
    customsymbols: boolean, /* support customsymbols defined in glyphmap */
    /*
     * Window capability support.
     */
    wc_color: boolean, /* use color graphics                  */
    wc_hilite_pet: boolean, /* hilight pets                        */
    wc_ascii_map: boolean, /* show map using traditional ascii    */
    wc_tiled_map: boolean, /* show map using tiles                */
    wc_preload_tiles: boolean, /* preload tiles into memory           */
    wc_tile_width: int, /* tile width                          */
    wc_tile_height: int, /* tile height                         */
    wc_tile_file: ptr_to(char), /* name of tile file;overrides default */
    wc_inverse: boolean, /* use inverse video for some things   */
    wc_align_status: int, /*  status win at top|bot|right|left   */
    wc_align_message: int, /* message win at top|bot|right|left   */
    wc_vary_msgcount: int, /* show more old messages at a time    */

    /* points to foregrnd color name for menu win   */
    /* points to backgrnd color name for menu win   */
    /* points to foregrnd color name for msg win */
    /* points to backgrnd color name for msg win */
    /* points to foregrnd color name for status   */
    /* points to backgrnd color name for status   */
    /* points to foregrnd color name for text win   */
    /* points to backgrnd color name for text win   */

    wcolors: array_of("struct_windowcolors_struct", WC_COUNT),

    wc_font_map: ptr_to(char), /* points to font name for the map win */
    wc_font_message: ptr_to(char), /* points to font name for message win */
    wc_font_status: ptr_to(char), /* points to font name for status win  */
    wc_font_menu: ptr_to(char), /* points to font name for menu win    */
    wc_font_text: ptr_to(char), /* points to font name for text win    */
    wc_fontsiz_map: int, /* font size for the map win           */
    wc_fontsiz_message: int, /* font size for the message window    */
    wc_fontsiz_status: int, /* font size for the status window     */
    wc_fontsiz_menu: int, /* font size for the menu window       */
    wc_fontsiz_text: int, /* font size for text windows          */
    wc_scroll_amount: int, /* scroll this amount at scroll_margin */
    wc_scroll_margin: int, /* scroll map when this far from the edge */
    wc_map_mode: int, /* specify map viewing options, mostly
                             * for backward compatibility */
    wc_player_selection: int, /* method of choosing character */

    /* X resolution of screen */
    /* Y resolution of screen */

    wc_splash_screen: boolean, /* display an opening splash screen or not */
    wc_popup_dialog: boolean, /* put queries in pop up dialogs instead of
                                 * in the message window */
    wc_eight_bit_input: boolean, /* allow eight bit input               */
    wc2_fullscreen: boolean, /* run fullscreen */
    wc2_softkeyboard: boolean, /* use software keyboard */
    wc2_wraptext: boolean, /* wrap text */
    wc2_selectsaved: boolean, /* display a menu of user's saved games */
    wc2_darkgray: boolean, /* try to use dark-gray color for black glyphs */
    wc2_hitpointbar: boolean, /* show graphical bar representing hit points */
    wc2_guicolor: boolean, /* allow colours in gui (outside map) */
    wc_mouse_support: int, /* allow mouse support */
    wc2_term_cols: int, /* terminal width, in characters */
    wc2_term_rows: int, /* terminal height, in characters */
    wc2_statuslines: int, /* default = 2, curses can handle 3 */
    wc2_windowborders: int, /* display borders on NetHack windows */
    wc2_petattr: int, /* text attributes for pet */

    /* copies of values in struct u, used during detection when the
       originals are temporarily cleared; kept here rather than
       locally so that they can be restored during a hangup save */
    save_uswallow: Bitfield(1),
    save_uinwater: Bitfield(1),
    save_uburied: Bitfield(1),
    debug: "struct_debug_flags",
    windowtype_locked: boolean, /* windowtype can't change from configfile */
    windowtype_deferred: boolean, /* pick a windowport and store it in
                                    chosen_windowport[], but do not switch to
                                    it in the midst of options processing */
    returning_missile: ptr_to(void_t), /* 'struct obj *'; Mjollnir or aklys */
    wiz_error_flag: boolean, /* flag for tracking failed wizmode auth */
    explore_error_flag: boolean, /* ditto for explore mode */
    obsolete: boolean, /* obsolete options can point at this, it isn't used */
});

/*
 * Old, deprecated names
 */

/* last_msg values
 * Usage:
 *  pline("some message");
 *    pline: vsprintf + putstr + iflags.last_msg = PLNMSG_UNKNOWN;
 *  iflags.last_msg = PLNMSG_some_message;
 * and subsequent code can adjust the next message if it is affected
 * by some_message.  The next message will clear iflags.last_msg.
 */

    export const PLNMSG_UNKNOWN = 0; /* arbitrary */
    export const PLNMSG_ONE_ITEM_HERE = PLNMSG_UNKNOWN + 1; /* "you see <single item> here" */
    export const PLNMSG_TOWER_OF_FLAME = PLNMSG_ONE_ITEM_HERE + 1; /* scroll of fire */
    export const PLNMSG_CAUGHT_IN_EXPLOSION = PLNMSG_TOWER_OF_FLAME + 1; /* explode() feedback */
    export const PLNMSG_ENVELOPED_IN_GAS = PLNMSG_CAUGHT_IN_EXPLOSION + 1; /* create_gas_cloud() feedback */
    export const PLNMSG_OBJ_GLOWS = PLNMSG_ENVELOPED_IN_GAS + 1; /* "the <obj> glows <color>" */
    export const PLNMSG_OBJNAM_ONLY = PLNMSG_OBJ_GLOWS + 1; /* xname/doname only, for #tip */
    export const PLNMSG_OK_DONT_DIE = PLNMSG_OBJNAM_ONLY + 1; /* overriding death in explore/wizard mode */
    export const PLNMSG_BACK_ON_GROUND = PLNMSG_OK_DONT_DIE + 1; /* leaving water */
    export const PLNMSG_GROWL = PLNMSG_BACK_ON_GROUND + 1; /* growl() gave some message */
    export const PLNMSG_HIDE_UNDER = PLNMSG_GROWL + 1; /* hero saw a monster hide under something */
    export const PLNMSG_MON_TAKES_OFF_ITEM = PLNMSG_HIDE_UNDER + 1; /* thief (nymph, monkey) taking worn item */
    export const PLNMSG_enum = PLNMSG_MON_TAKES_OFF_ITEM + 1; /* 'none of the above' */

/* runmode options */

    export const RUN_TPORT = 0; /* don't update display until movement stops */
    export const RUN_LEAP = RUN_TPORT + 1; /* update display every 7 steps */
    export const RUN_STEP = RUN_LEAP + 1; /* update display every single step */
    export const RUN_CRAWL = RUN_STEP + 1; /* walk w/ extra delay after each update */

/* command parsing, mainly dealing with number_pad handling;
   not saved and restored */

/* forward declaration sufficient to declare pointers */
/* from func_tab.h */

    export const GLOC_MONS = 0;
    export const GLOC_OBJS = GLOC_MONS + 1;
    export const GLOC_DOOR = GLOC_OBJS + 1;
    export const GLOC_EXPLORE = GLOC_DOOR + 1;
    export const GLOC_INTERESTING = GLOC_EXPLORE + 1;
    export const GLOC_VALID = GLOC_INTERESTING + 1;

    export const NUM_GLOCS = GLOC_VALID + 1;

import { MAXOCLASSES } from "./defsym.h.js";
import { boolean, xint8 } from "./global.h.js";
import { char, int, long, ord, schar, uchar, ulong, unsigned } from "../rt/ctypes.js";
import { Bitfield, array_of, ptr_to, struct, void_t } from "../rt/struct.js";
