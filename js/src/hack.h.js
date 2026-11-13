/* NetHack 5.0	hack.h	$NHDT-Date: 1736530208 2025/01/10 09:30:08 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.266 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Pasi Kallinen, 2017. */
/* NetHack may be freely redistributed.  See license for details. */

export const TELL = 1;
export const NOTELL = 0;
export const ON = 1;
export const OFF = 0;
export const BOLT_LIM = 8;

export const DEF_NOTHING = ord(' ');

/* Macros for how a rumor was delivered in outrumor() */
export const BY_ORACLE = 0;
export const BY_COOKIE = 1;
export const BY_PAPER = 2;

/* bitmask flags for corpse_xname();
   PFX_THE takes precedence over ARTICLE, NO_PFX takes precedence over both */
export const CXN_NORMAL = 0;
export const CXN_SINGULAR = 1;
export const CXN_NO_PFX = 2;
export const CXN_PFX_THE = 4;
export const CXN_ARTICLE = 8;
export const CXN_NOCORPSE = 16;

/* number of turns it takes for vault guard to show up */
export const VAULT_GUARD_TIME = 30;

/* sellobj_state() states */
export const SELL_NORMAL = (0);
export const SELL_DELIBERATE = (1);
export const SELL_DONTSELL = (2);

export const SHOP_DOOR_COST = 400;
export const SHOP_BARS_COST = 300;
export const SHOP_HOLE_COST = 200;
export const SHOP_WALL_COST = 200;

export const SHOP_PIT_COST = 100;
export const SHOP_WEB_COST = 30;

/* flags for look_here() */
export const LOOKHERE_NOFLAGS = 0;
export const LOOKHERE_PICKED_SOME = 1;
export const LOOKHERE_SKIP_DFEATURE = 2;

/* max size of a windowtype option */
export const WINTYPELEN = 16;

/* str_or_len from sp_lev.h */
export const struct_str_or_len = union("struct_str_or_len", {
    str: ptr_to(char),
    len: int,
});

    export const NROFARTIFACTS = (AFTER_LAST_ARTIFACT - 1);

/* related to breadcrumb struct */
export const override_restriction = -1;

/* types of calls to bhit() */

    export const ZAPPED_WAND = 0;
    export const THROWN_WEAPON = 1;
    export const THROWN_TETHERED_WEAPON = 2;
    export const KICKED_WEAPON = 3;
    export const FLASHED_LIGHT = 4;
    export const INVIS_BEAM = 5;

/* Macros for messages referring to hands, eyes, feet, etc... */

    export const NO_PART = -1;
    export const ARM = 0;
    export const EYE = 1;
    export const FACE = 2;
    export const FINGER = 3;
    export const FINGERTIP = 4;
    export const FOOT = 5;
    export const HAND = 6;
    export const HANDED = 7;
    export const HEAD = 8;
    export const LEG = 9;
    export const LIGHT_HEADED = 10;
    export const NECK = 11;
    export const SPINE = 12;
    export const TOE = 13;
    export const HAIR = 14;
    export const BLOOD = 15;
    export const LUNG = 16;
    export const NOSE = 17;
    export const STOMACH = 18;

export const MAX_BMASK = 4;

export const struct_bubble = struct("struct_bubble", {
    x: coordxy, y: coordxy, /* coordinates of the upper left corner */
    dx: schar, dy: schar, /* the general direction of the bubble's movement */
    bm: array_of(uchar, MAX_BMASK + 2), /* bubble bit mask */
    prev: ptr_to("struct_bubble"), next: ptr_to("struct_bubble"), /* need to traverse the list up and down */
    cons: ptr_to("struct_container"),
});

    export const CONS_OBJ = 0;
    export const CONS_MON = CONS_OBJ + 1;
    export const CONS_HERO = CONS_MON + 1;
    export const CONS_TRAP = CONS_HERO + 1;

/*
 * Rudimentary command queue.
 * Allows the code to put keys and extended commands into the queue,
 * and they're executed just as if the user did them.  Time passes
 * normally when doing queued actions.  The queue will get cleared
 * if hero is interrupted.
 */

    export const CMDQ_KEY = 0; /* a literal character, cmdq_add_key() */
    export const CMDQ_EXTCMD = CMDQ_KEY + 1; /* extended command, cmdq_add_ec() */
    export const CMDQ_DIR = CMDQ_EXTCMD + 1; /* direction, cmdq_add_dir() */
    export const CMDQ_USER_INPUT = CMDQ_DIR + 1; /* placeholder for user input, cmdq_add_userinput() */
    export const CMDQ_INT = CMDQ_USER_INPUT + 1; /* integer value, cmdq_add_int() */

export const struct__cmd_queue = struct("struct__cmd_queue", {
    typ: int,
    key: char,
    dirx: schar, diry: schar, dirz: schar,
    intval: int,
    ec_entry: ptr_to("struct_ext_func_tab"),
    next: ptr_to("struct__cmd_queue"),
});

    export const CQ_CANNED = 0; /* internal canned sequence */
    export const CQ_REPEAT = CQ_CANNED + 1; /* user-inputted, if gi.in_doagain, replayed */
    export const NUM_CQS = CQ_REPEAT + 1;

export const cmdcount_nht = long; /* Command counts */

/* special key functions */

    export const NHKF_ESC = 0;

    export const NHKF_GETDIR_SELF = NHKF_ESC + 1;
    export const NHKF_GETDIR_SELF2 = NHKF_GETDIR_SELF + 1;
    export const NHKF_GETDIR_HELP = NHKF_GETDIR_SELF2 + 1;
    export const NHKF_GETDIR_MOUSE = NHKF_GETDIR_HELP + 1; /* simulated click for #therecmdmenu; use '_' as
                          * direction to initiate, then getpos() finishing
                          * with ',' (left click) or '.' (right click) */
    export const NHKF_COUNT = NHKF_GETDIR_MOUSE + 1;
    export const NHKF_GETPOS_SELF = NHKF_COUNT + 1;
    export const NHKF_GETPOS_PICK = NHKF_GETPOS_SELF + 1;
    export const NHKF_GETPOS_PICK_Q = NHKF_GETPOS_PICK + 1; /* quick */
    export const NHKF_GETPOS_PICK_O = NHKF_GETPOS_PICK_Q + 1; /* once */
    export const NHKF_GETPOS_PICK_V = NHKF_GETPOS_PICK_O + 1; /* verbose */
    export const NHKF_GETPOS_SHOWVALID = NHKF_GETPOS_PICK_V + 1;
    export const NHKF_GETPOS_AUTODESC = NHKF_GETPOS_SHOWVALID + 1;
    export const NHKF_GETPOS_MON_NEXT = NHKF_GETPOS_AUTODESC + 1;
    export const NHKF_GETPOS_MON_PREV = NHKF_GETPOS_MON_NEXT + 1;
    export const NHKF_GETPOS_OBJ_NEXT = NHKF_GETPOS_MON_PREV + 1;
    export const NHKF_GETPOS_OBJ_PREV = NHKF_GETPOS_OBJ_NEXT + 1;
    export const NHKF_GETPOS_DOOR_NEXT = NHKF_GETPOS_OBJ_PREV + 1;
    export const NHKF_GETPOS_DOOR_PREV = NHKF_GETPOS_DOOR_NEXT + 1;
    export const NHKF_GETPOS_UNEX_NEXT = NHKF_GETPOS_DOOR_PREV + 1;
    export const NHKF_GETPOS_UNEX_PREV = NHKF_GETPOS_UNEX_NEXT + 1;
    export const NHKF_GETPOS_INTERESTING_NEXT = NHKF_GETPOS_UNEX_PREV + 1;
    export const NHKF_GETPOS_INTERESTING_PREV = NHKF_GETPOS_INTERESTING_NEXT + 1;
    export const NHKF_GETPOS_VALID_NEXT = NHKF_GETPOS_INTERESTING_PREV + 1;
    export const NHKF_GETPOS_VALID_PREV = NHKF_GETPOS_VALID_NEXT + 1;
    export const NHKF_GETPOS_HELP = NHKF_GETPOS_VALID_PREV + 1;
    export const NHKF_GETPOS_MENU = NHKF_GETPOS_HELP + 1;
    export const NHKF_GETPOS_LIMITVIEW = NHKF_GETPOS_MENU + 1;
    export const NHKF_GETPOS_MOVESKIP = NHKF_GETPOS_LIMITVIEW + 1;

    export const NUM_NHKF = NHKF_GETPOS_MOVESKIP + 1;

/* commands[] is used to directly access cmdlist[] instead of looping
   through it to find the entry for a given input character;
   move_X is the character used for moving one step in direction X;
   alphadirchars corresponds to old sdir,
   dirchars corresponds to ``iflags.num_pad ? ndir : sdir'';
   pcHack_compat and phone_layout only matter when num_pad is on,
   swap_yz only matters when it's off */
export const struct_cmd = struct("struct_cmd", {
    serialno: unsigned, /* incremented after each update */
    num_pad: boolean, /* same as iflags.num_pad except during updates */
    pcHack_compat: boolean, /* for numpad:  affects 5, M-5, and M-0 */
    phone_layout: boolean, /* inverted keypad:  1,2,3 above, 7,8,9 below */
    swap_yz: boolean, /* QWERTZ keyboards; use z to move NW, y to zap */
    dirchars: ptr_to(char), /* current movement/direction characters */
    alphadirchars: ptr_to(char), /* same as dirchars if !numpad */
    cmdbinds: ptr_to("struct_Cmd_bind"),
    mousebtn: array_of(ptr_to("struct_ext_func_tab"), NUM_MOUSE_BUTTONS),
    spkeys: array_of(char, NUM_NHKF),
    extcmd_char: char, /* key that starts an extended command ('#') */
});

export const struct_c_color_names = struct("struct_c_color_names", {
    c_black: ptr_to(char), c_amber: ptr_to(char), c_golden: ptr_to(char),
        c_light_blue: ptr_to(char), c_red: ptr_to(char), c_green: ptr_to(char), c_silver: ptr_to(char),
        c_blue: ptr_to(char), c_purple: ptr_to(char), c_white: ptr_to(char), c_orange: ptr_to(char),
});

export const struct_c_common_strings = struct("struct_c_common_strings", {
    c_nothing_happens: ptr_to(char), c_nothing_seems_to_happen: ptr_to(char),
        c_thats_enough_tries: ptr_to(char), c_silly_thing_to: ptr_to(char),
        c_shudder_for_moment: ptr_to(char), c_something: ptr_to(char), c_Something: ptr_to(char),
        c_You_can_move_again: ptr_to(char), c_Never_mind: ptr_to(char),
        c_vision_clears: ptr_to(char), c_the_your: array_of(ptr_to(char), 2), c_fakename: array_of(ptr_to(char), 2),
});

export const struct_container = struct("struct_container", {
    next: ptr_to("struct_container"),
    x: coordxy, y: coordxy,
    what: short,
    list: ptr_to(void_t),
});

/* alteration types--keep in synch with costly_alteration(mkobj.c) */

    export const COST_CANCEL = 0; /* standard cancellation */
    export const COST_DRAIN = 1; /* drain life upon an object */
    export const COST_UNCHRG = 2; /* cursed charging */
    export const COST_UNBLSS = 3; /* unbless (devalues holy water) */
    export const COST_UNCURS = 4; /* uncurse (devalues unholy water) */
    export const COST_DECHNT = 5; /* disenchant weapons or armor */
    export const COST_DEGRD = 6; /* removal of rustproofing, dulling via engraving */
    export const COST_DILUTE = 7; /* potion dilution */
    export const COST_ERASE = 8; /* scroll or spellbook blanking */
    export const COST_BURN = 9; /* dipped into flaming oil */
    export const COST_NUTRLZ = 10; /* neutralized via unicorn horn */
    export const COST_DSTROY = 11; /* wand breaking (bill first, useup later) */
    export const COST_SPLAT = 12; /* cream pie to own face (ditto) */
    export const COST_BITE = 13; /* start eating food */
    export const COST_OPEN = 14; /* open tin */
    export const COST_BRKLCK = 15; /* break box/chest's lock */
    export const COST_RUST = 16; /* rust damage */
    export const COST_ROT = 17; /* rotting attack */
    export const COST_CORRODE = 18; /* acid damage */
    export const COST_CRACK = 19; /* damage to crystal armor */

/* used by unpaid_cost(shk.h) */

    export const COST_NOCONTENTS = 0;
    export const COST_CONTENTS = 1;
    export const COST_SINGLEOBJ = 2;

/* read.c, create_particular() & create_particular_parse() */
export const struct__create_particular_data = struct("struct__create_particular_data", {
    quan: int,
    which: int,
    fem: int, /* -1, MALE, FEMALE, NEUTRAL */
    genderconf: int, /* conflicting gender */
    monclass: char,
    randmonst: boolean,
    maketame: boolean, makepeaceful: boolean, makehostile: boolean,
    sleeping: boolean, saddled: boolean, invisible: boolean, hidden: boolean,
});

/* dig_check() results */

    export const DIGCHECK_PASSED = 1;
    export const DIGCHECK_PASSED_DESTROY_TRAP = 2;
    export const DIGCHECK_PASSED_PITONLY = 3;
    export const DIGCHECK_FAILED = 4;
    export const DIGCHECK_FAIL_ONSTAIRS = DIGCHECK_FAILED;
    export const DIGCHECK_FAIL_ONLADDER = DIGCHECK_FAIL_ONSTAIRS + 1;
    export const DIGCHECK_FAIL_THRONE = DIGCHECK_FAIL_ONLADDER + 1;
    export const DIGCHECK_FAIL_ALTAR = DIGCHECK_FAIL_THRONE + 1;
    export const DIGCHECK_FAIL_AIRLEVEL = DIGCHECK_FAIL_ALTAR + 1;
    export const DIGCHECK_FAIL_WATERLEVEL = DIGCHECK_FAIL_AIRLEVEL + 1;
    export const DIGCHECK_FAIL_TOOHARD = DIGCHECK_FAIL_WATERLEVEL + 1;
    export const DIGCHECK_FAIL_UNDESTROYABLETRAP = DIGCHECK_FAIL_TOOHARD + 1;
    export const DIGCHECK_FAIL_CANTDIG = DIGCHECK_FAIL_UNDESTROYABLETRAP + 1;
    export const DIGCHECK_FAIL_BOULDER = DIGCHECK_FAIL_CANTDIG + 1;
    export const DIGCHECK_FAIL_OBJ_POOL_OR_TRAP = DIGCHECK_FAIL_BOULDER + 1;

/* Dismount: causes for why you are no longer riding */

    export const DISMOUNT_GENERIC = 0;
    export const DISMOUNT_FELL = 1;
    export const DISMOUNT_THROWN = 2;
    export const DISMOUNT_KNOCKED = 3; /* hero hit for knockback effect */
    export const DISMOUNT_POLY = 4;
    export const DISMOUNT_ENGULFED = 5;
    export const DISMOUNT_BONES = 6;
    export const DISMOUNT_BYCHOICE = 7;

export const struct_dgn_topology = struct("struct_dgn_topology", { /* special dungeon levels for speed */
    d_oracle_level: "struct_d_level",
    d_bigroom_level: "struct_d_level", /* unused */
    d_rogue_level: "struct_d_level",
    d_medusa_level: "struct_d_level",
    d_stronghold_level: "struct_d_level",
    d_valley_level: "struct_d_level",
    d_wiz1_level: "struct_d_level",
    d_wiz2_level: "struct_d_level",
    d_wiz3_level: "struct_d_level",
    d_juiblex_level: "struct_d_level",
    d_orcus_level: "struct_d_level",
    d_baalzebub_level: "struct_d_level", /* unused */
    d_asmodeus_level: "struct_d_level", /* unused */
    d_portal_level: "struct_d_level", /* only in goto_level() [do.c] */
    d_sanctum_level: "struct_d_level",
    d_earth_level: "struct_d_level",
    d_water_level: "struct_d_level",
    d_fire_level: "struct_d_level",
    d_air_level: "struct_d_level",
    d_astral_level: "struct_d_level",
    d_tower_dnum: xint16,
    d_sokoban_dnum: xint16,
    d_mines_dnum: xint16, d_quest_dnum: xint16,
    d_tutorial_dnum: xint16,
    d_qstart_level: "struct_d_level", d_qlocate_level: "struct_d_level", d_nemesis_level: "struct_d_level",
    d_knox_level: "struct_d_level",
    d_mineend_level: "struct_d_level",
    d_sokoend_level: "struct_d_level",
});

export const MAXLINFO = (MAXDUNGEON * MAXLEVEL);

    export const all_themes = 1; /* for end of game */
    export const most_themes = 2; /* for entering endgame */
    export const tut_themes = 3; /* for leaving tutorial */

    export const ARG_DEBUG = 0; export const ARG_VERSION = ARG_DEBUG + 1; export const ARG_SHOWPATHS = ARG_VERSION + 1;

    export const ARG_DUMPENUMS = ARG_SHOWPATHS + 1;

    export const ARG_DUMPGLYPHIDS = ARG_DUMPENUMS + 1;
    export const ARG_DUMPMONGEN = ARG_DUMPGLYPHIDS + 1;
    export const ARG_DUMPWEIGHTS = ARG_DUMPMONGEN + 1;

export const struct_early_opt = struct("struct_early_opt", {
    e: unsigned,
    name: ptr_to(char),
    minlength: int,
    valallowed: boolean,
});

/* symbolic names for capacity levels */

    export const UNENCUMBERED = 0;
    export const SLT_ENCUMBER = 1; /* Burdened */
    export const MOD_ENCUMBER = 2; /* Stressed */
    export const HVY_ENCUMBER = 3; /* Strained */
    export const EXT_ENCUMBER = 4; /* Overtaxed */
    export const OVERLOADED = 5; /* Overloaded */

export const struct_entity = struct("struct_entity", {
    emon: ptr_to("struct_monst"), /* youmonst for the player */
    edata: ptr_to("struct_permonst"), /* must be non-zero for record to be valid */
    ex: int, ey: int,
});

export const struct_enum_dump = struct("struct_enum_dump", {
    val: int,
    nm: ptr_to(char),
});

/*
 * This is the way the game ends.  If these are rearranged, the arrays
 * in end.c and topten.c will need to be changed.  Some parts of the
 * code assume that PANICKED separates the deaths from the non-deaths.
 */

    export const DIED = 0;
    export const CHOKING = 1;
    export const POISONING = 2;
    export const STARVING = 3;
    export const DROWNING = 4;
    export const BURNING = 5;
    export const DISSOLVED = 6;
    export const CRUSHING = 7;
    export const STONING = 8;
    export const TURNED_SLIME = 9;
    export const GENOCIDED = 10;
    export const PANICKED = 11;
    export const TRICKED = 12;
    export const QUIT = 13;
    export const ESCAPED = 14;
    export const ASCENDED = 15;

/* game events log */
export const struct_gamelog_line = struct("struct_gamelog_line", {
    turn: long, /* turn when this happened */
    flags: long, /* LL_foo flags */
    text: ptr_to(char),
    next: ptr_to("struct_gamelog_line"),
});

/* values returned from getobj() callback functions */

    /* generally invalid - can't be used for this purpose. will give a "silly
     * thing" message if the player tries to pick it, unless a more specific
     * failure message is in getobj itself - e.g. "You cannot foo gold". */
    export const GETOBJ_EXCLUDE = -3;
    /* invalid because it is not in inventory; used when the hands/self
     * possibility is queried and the player passed up something on the
     * floor before getobj. */
    export const GETOBJ_EXCLUDE_NONINVENT = -2;
    /* invalid because it is an inaccessible or unwanted piece of gear, but
     * pseudo-valid for the purposes of allowing the player to select it and
     * getobj to return it if there is a prompt instead of getting "silly
     * thing", in order for the getobj caller to present a specific failure
     * message. Other than that, the only thing this does differently from
     * GETOBJ_EXCLUDE is that it inserts an "else" in "You don't have anything
     * else to foo". */
    export const GETOBJ_EXCLUDE_INACCESS = -1;
    /* invalid for purposes of not showing a prompt if nothing is valid but
     * pseudo-valid for selecting - identical to GETOBJ_EXCLUDE_INACCESS but
     * without the "else" in "You don't have anything else to foo". */
    export const GETOBJ_EXCLUDE_SELECTABLE = 0;
    /* valid - invlet not presented in the summary or the ? menu as a
     * recommendation, but is selectable if the player enters it anyway.
     * Used for objects that are actually valid but unimportantly so, such
     * as shirts for reading. */
    export const GETOBJ_DOWNPLAY = 1;
    /* valid - will be shown in summary and ? menu */
    export const GETOBJ_SUGGEST = 2;

/* getpos() return values */

    export const LOOK_TRADITIONAL = 0; /* '.' -- ask about "more info?" */
    export const LOOK_QUICK = 1; /* ',' -- skip "more info?" */
    export const LOOK_ONCE = 2; /* ';' -- skip and stop looping */
    export const LOOK_VERBOSE = 3; /* ':' -- show more info w/o asking */

export const struct_h2o_ctx = struct("struct_h2o_ctx", {
    dkn_boom: int, unk_boom: int, /* track dknown, !dknown separately */
    ctx_valid: boolean,
});

/* attack mode for hmon() */

    export const HMON_MELEE = 0; /* hand-to-hand */
    export const HMON_THROWN = 1; /* normal ranged (or spitting while poly'd) */
    export const HMON_KICKED = 2; /* alternate ranged */
    export const HMON_APPLIED = 3; /* polearm, treated as ranged */
    export const HMON_DRAGGED = 4; /* attached iron ball, pulled into mon */

/* hunger states - see hu_stat in eat.c */

    export const SATIATED = 0;
    export const NOT_HUNGRY = 1;
    export const HUNGRY = 2;
    export const WEAK = 3;
    export const FAINTING = 4;
    export const FAINTED = 5;
    export const STARVED = 6;

/* fake inventory letters, not 'a'..'z' or 'A'..'Z' */
export const NOINVSYM = ord('#');
export const CONTAINED_SYM = ord('>');
export const HANDS_SYM = ord('-');

/* inventory counts (slots in tty parlance)
 * a...zA..Z    invlet_basic (52)
 * $a...zA..Z#  2 special additions
 */

    export const invlet_basic = 52;
    export const invlet_gold = 1;
    export const invlet_overflow = 1;
    export const invlet_max = invlet_basic + invlet_gold + invlet_overflow;
    /* 2023/11/30 invlet_max is not yet used anywhere */

export const KILLED_BY_AN = 0; export const KILLED_BY = 1; export const NO_KILLER_PREFIX = 2; export const struct_kinfo = struct("struct_kinfo", {
    next: ptr_to("struct_kinfo"), /* chain of delayed killers */
    id: int, /* uprop keys to ID a delayed killer */
    format: int, /* one of the killer formats */

    name: array_of(char, BUFSZ), /* actual killer name */
});

export const struct_launchplace = struct("struct_launchplace", {
    obj: ptr_to("struct_obj"),
    x: coordxy, y: coordxy,
});

/* light source */
export const struct_ls_t = struct("struct_ls_t", {
    next: ptr_to("struct_ls_t"),
    x: coordxy, y: coordxy, /* source's position */
    range: short, /* source's current range */
    flags: short,
    type: short, /* type of light source */
    id: "struct_any", /* source's identifier */
});

export const struct_menucoloring = struct("struct_menucoloring", {
    match: ptr_to("struct_nhregex"),
    origstr: ptr_to(char),
    color: int, attr: int,
    next: ptr_to("struct_menucoloring"),
});

    export const MV_ANY = -1;
    export const MV_WALK = MV_ANY + 1;
    export const MV_RUN = MV_WALK + 1;
    export const MV_RUSH = MV_RUN + 1;

    export const N_MOVEMODES = MV_RUSH + 1;

    export const DIR_ERR = -1;
    export const DIR_W = DIR_ERR + 1;
    export const DIR_NW = DIR_W + 1;
    export const DIR_N = DIR_NW + 1;
    export const DIR_NE = DIR_N + 1;
    export const DIR_E = DIR_NE + 1;
    export const DIR_SE = DIR_E + 1;
    export const DIR_S = DIR_SE + 1;
    export const DIR_SW = DIR_S + 1;
    export const DIR_DOWN = DIR_SW + 1;
    export const DIR_UP = DIR_DOWN + 1;

    export const N_DIRS_Z = DIR_UP + 1;

/* N_DIRS_Z, minus up & down */
export const N_DIRS = (N_DIRS_Z - 2);

export const struct_multishot = struct("struct_multishot", {
    n: int, i: int,
    o: short,
    s: boolean,
});

export const struct_musable = struct("struct_musable", {
    offensive: ptr_to("struct_obj"),
    defensive: ptr_to("struct_obj"),
    misc: ptr_to("struct_obj"),
    has_offense: int, has_defense: int, has_misc: int,
    /* =0, no capability; otherwise, different numbers.
     * If it's an object, the object is also set (it's 0 otherwise).
     */
});

export const struct_mvitals = struct("struct_mvitals", {
    born: uchar,
    died: uchar,
    mvflags: uchar,
    seen_close: Bitfield(1),
    photographed: Bitfield(1),
});

/* Lua callback functions */

    export const NHCORE_START_NEW_GAME = 0;
    export const NHCORE_RESTORE_OLD_GAME = NHCORE_START_NEW_GAME + 1;
    export const NHCORE_MOVELOOP_TURN = NHCORE_RESTORE_OLD_GAME + 1;
    export const NHCORE_GAME_EXIT = NHCORE_MOVELOOP_TURN + 1;
    export const NHCORE_GETPOS_TIP = NHCORE_GAME_EXIT + 1;
    export const NHCORE_ENTER_TUTORIAL = NHCORE_GETPOS_TIP + 1;
    export const NHCORE_LEAVE_TUTORIAL = NHCORE_ENTER_TUTORIAL + 1;

    export const NUM_NHCORE_CALLS = NHCORE_LEAVE_TUTORIAL + 1;

/* Lua callbacks. TODO: Merge with NHCORE */

    export const NHCB_CMD_BEFORE = 0;
    export const NHCB_LVL_ENTER = NHCB_CMD_BEFORE + 1;
    export const NHCB_LVL_LEAVE = NHCB_LVL_ENTER + 1;
    export const NHCB_END_TURN = NHCB_LVL_LEAVE + 1;

    export const NUM_NHCB = NHCB_END_TURN + 1;

export const NHUUIDSZ = 37;

export const struct_plinemsg_type = struct("struct_plinemsg_type", {
    msgtype: xint16, /* one of MSGTYP_foo */
    regex: ptr_to("struct_nhregex"),
    pattern: ptr_to(char),
    next: ptr_to("struct_plinemsg_type"),
});

export const MSGTYP_NORMAL = 0;
export const MSGTYP_NOREP = 1;
export const MSGTYP_NOSHOW = 2;
export const MSGTYP_STOP = 3;
/* bitmask for callers of hide_unhide_msgtypes() */
export const MSGTYP_MASK_REP_SHOW = ((1 << MSGTYP_NOREP) | (1 << MSGTYP_NOSHOW));

/* polyself flags */

    export const POLY_NOFLAGS = 0x00;
    export const POLY_CONTROLLED = 0x01;
    export const POLY_MONSTER = 0x02;
    export const POLY_REVERT = 0x04;
    export const POLY_LOW_CTRL = 0x08;

export const struct_repo = struct("struct_repo", { /* repossession context */
    shopkeeper: ptr_to("struct_monst"),
    location: "struct_nhcoord",
});

export const struct_restore_info = struct("struct_restore_info", {
    name: ptr_to(char),
    mread_flags: int,
});

    export const REST_GSTATE = 1; /* restoring game state + first pass of current level */
    export const REST_LEVELS = 2; /* restoring remainder of dungeon */
    export const REST_CURRENT_LEVEL = 3; /* final pass of restoring current level */

export const struct_rogueroom = struct("struct_rogueroom", {
    rlx: coordxy, rly: coordxy,
    dx: coordxy, dy: coordxy,
    real: boolean,
    doortable: uchar,
    nroom: int, /* Only meaningful for "real" rooms */
});

export const NUM_ROLES = (13);
export const struct_role_filter = struct("struct_role_filter", {
    roles: array_of(schar, NUM_ROLES + 1),
    mask: short,
});
export const NUM_RACES = (5);

export const struct_selectionvar = struct("struct_selectionvar", {
    wid: int, hei: int,
    bounds_dirty: boolean,
    bounds: "struct_nhrect", /* use selection_getbounds() */
    map: ptr_to(char),
});

/* structure for 'program_state'; not saved and restored */
export const struct_sinfo = struct("struct_sinfo", {
    gameover: int, /* self-explanatory? */
    stopprint: int, /* inhibit further end of game disclosure */

    done_hup: int, /* SIGHUP or moral equivalent received
                                 * -- no more screen output */
    preserve_locks: int, /* don't remove level files prior to exit */

    something_worth_saving: int, /* in case of panic */
    panicking: int, /* `panic' is in progress */
    exiting: int, /* an exit handler is executing */
    saving: int, /* creating a save file */
    restoring: int, /* reloading a save file */
    freeingdata: int, /* in saveobjchn(), mode FREEING */
    in_getlev: int, /* in getlev() */
    in_moveloop: int, /* normal gameplay in progress */
    in_impossible: int, /* reporting a warning */
    in_docrt: int, /* in docrt(): redrawing the whole screen */
    in_self_recover: int, /* processing orphaned level files */
    in_checkpoint: int, /* saving insurance checkpoint */
    in_parseoptions: int, /* in parseoptions */
    in_role_selection: int, /* role/race/&c selection menus in progress */
    in_getlin: int, /* inside interface getlin routine */
    in_sanity_check: int, /* for impossible() during sanity checking */
    config_error_ready: int, /* config_error_add is ready, available */
    beyond_savefile_load: int, /* set when past savefile loading */
    savefile_completed: int, /* savefile has completed writing */
    reading_bonesfile: int, /* in the midst of trying to read bones file */

    in_paniclog: int, /* writing a panicloc entry */

    wizkit_wishing: int, /* starting wizard mode game w/ WIZKIT file */
    /* input_state:  used in the core for the 'altmeta' option to process ESC;
       used in the curses interface to avoid arrow keys when user is doing
       something other than entering a command or direction and in the Qt
       interface to suppress menu commands in similar conditions;
       readchar() always resets it to 'otherInp' prior to returning */
    input_state: int, /* whether next key pressed will be entering a command */
    early_options: int, /* inside early_options processing */

    /* resize_pending only matters when handling a SIGWINCH signal for tty;
       getting_char is used along with that and also separately for UNIX;
       we minimize #if conditionals for them to avoid unnecessary clutter */
    resize_pending: int, /* set by signal handler */
    getting_char: int, /* referenced during signal handling */
});

/* value of program_state.input_state, significant during readchar();
   get_count() expects digits then a command so sets it to commandInp */

    export const otherInp = 0; /* 'other' */
    export const commandInp = 1; /* readchar() */
    export const getposInp = 2; /* getpos() */
    export const getdirInp = 3; /* getdir() */

/* sortloot() return type; needed before extern.h */
export const struct_sortloot_item = struct("struct_sortloot_item", {
    obj: ptr_to("struct_obj"),
    str: ptr_to(char), /* result of loot_xname(obj) in some cases, otherwise null */
    /* these need to be signed; 'indx' should be big enough to hold a count
       of the largest pile of items, the others fit within char */
    indx: int, /* index into original list (used as tie-breaker) */
    orderclass: int8, /* order rather than object class; 0 => not yet init'd */
    subclass: int8, /* subclass for some classes */
    disco: int8, /* discovery status */
    inuse: int8, /* 0: not in-use or not sorting by inuse_only;
                      * 1: lit candle/lamp or attached leash; 2: worn armor;
                      * 3: wielded weapon (including uswapwep and uquiver);
                      * 4: worn accessory (amulet, rings, blindfold). */
});

export const struct_strbuf = struct("struct_strbuf", {
    len: int,
    str: ptr_to(char),
    buf: array_of(char, 256),
});

    export const st_gloves = 0x1; /* wearing gloves? */
    export const st_corpse = 0x2; /* is it a corpse obj? */
    export const st_petrifies = 0x4; /* does the corpse petrify on touch? */
    export const st_resists = 0x8; /* do you have stoning resistance? */
    export const st_all = (st_gloves | st_corpse | st_petrifies | st_resists);

export const struct_throw_and_return_weapon = struct("struct_throw_and_return_weapon", {
    otyp: short,
    range: int,
    tethered: Bitfield(1),
});

export const struct_trapinfo = struct("struct_trapinfo", {
    tobj: ptr_to("struct_obj"),
    tx: coordxy, ty: coordxy,
    time_needed: int,
    force_bungle: boolean,
});

/* values for rtype are defined in dungeon.h */
/* lev_region from sp_lev.h */
export const lev_region = struct("lev_region", {
    inarea: struct("lev_region.inarea", {
        x1: coordxy, y1: coordxy, x2: coordxy, y2: coordxy,
    }),
    delarea: struct("lev_region.delarea", {
        x1: coordxy, y1: coordxy, x2: coordxy, y2: coordxy,
    }),
    in_islev: boolean, del_islev: boolean,
    rtype: coordxy, padding: coordxy,
    rname: "struct_str_or_len",
});

/* Flags for controlling uptodate */
export const UTD_CHECKSIZES = 0x01;
export const UTD_CHECKFIELDCOUNTS = 0x02;
export const UTD_SKIP_SANITY1 = 0x04;

export const UTD_WITHOUT_WAITSYNCH_PERFILE = 0x10;
export const UTD_QUIETLY = 0x20;

/* Values for savefile status */
export const SF_UPTODATE = 0;
export const SF_OUTDATED = 1;
export const SF_CRITICAL_BYTE_COUNT_MISMATCH = 2;
export const SF_DM_IL32LLP64_ON_ILP32LL64 = 3;
export const SF_DM_I32LP64_ON_ILP32LL64 = 4;
export const SF_DM_ILP32LL64_ON_I32LP64 = 5;
export const SF_DM_ILP32LL64_ON_IL32LLP64 = 6;
export const SF_DM_I32LP64_ON_IL32LLP64 = 7;
export const SF_DM_IL32LLP64_ON_I32LP64 = 8;
export const SF_DM_MISMATCH = 9;

export const ENTITIES = 2;
export const struct_valuable_data = struct("struct_valuable_data", {
    count: long,
    typ: int,
});

export const struct_val_list = struct("struct_val_list", {
    list: ptr_to("struct_valuable_data"),
    size: int,
});

    export const VANQ_MLVL_MNDX = 0; /* t - traditional: by monster level */
    export const VANQ_MSTR_MNDX = VANQ_MLVL_MNDX + 1; /* d - by difficulty rating */
    export const VANQ_ALPHA_SEP = VANQ_MSTR_MNDX + 1; /* a - alphabetical, first uniques, then ordinary */
    export const VANQ_ALPHA_MIX = VANQ_ALPHA_SEP + 1; /* A - alpha with uniques and ordinary intermixed */
    export const VANQ_MCLS_HTOL = VANQ_ALPHA_MIX + 1; /* C - by class, high to low within class */
    export const VANQ_MCLS_LTOH = VANQ_MCLS_HTOL + 1; /* c - by class, low to high within class */
    export const VANQ_COUNT_H_L = VANQ_MCLS_LTOH + 1; /* n - by count, high to low */
    export const VANQ_COUNT_L_H = VANQ_COUNT_H_L + 1; /* z - by count, low to high */

    export const NUM_VANQ_ORDER_MODES = VANQ_COUNT_L_H + 1;

export const struct_autopickup_exception = struct("struct_autopickup_exception", {
    regex: ptr_to("struct_nhregex"),
    pattern: ptr_to(char),
    grab: boolean,
    next: ptr_to("struct_autopickup_exception"),
});

/* at most one of `door' and `box' should be non-null at any given time */
export const struct_xlock_s = struct("struct_xlock_s", {
    door: ptr_to("struct_rm"),
    box: ptr_to("struct_obj"),
    picktyp: int, /* key|pick|card for unlock, sharp vs blunt for #force */
        chance: int, usedtime: int,
    magic_key: boolean,
});

/* NetHack ftypes */
export const NHF_LEVELFILE = 1;
export const NHF_SAVEFILE = 2;
export const NHF_BONESFILE = 3;
/* modes */
export const READING = 0x0;
export const COUNTING = 0x01;
export const WRITING = 0x02;
export const FREEING = 0x04;
export const CONVERTING = 0x08;
export const UNCONVERTING = 0x10;

    export const invalid = 0;
    export const historical = 1; /* entire struct, binary, as-is */
    export const exportascii = 2; /* each field written out as ascii text */
    export const NUM_SAVEFORMATS = exportascii + 1;

/* Content types for fieldlevel files */
export const struct_fieldlevel_content = struct("struct_fieldlevel_content", {
    deflt: boolean, /* individual fields */
    binary: boolean, /* binary rather than text */
});

export const struct_nh_file = struct("struct_nh_file", {
    fd: int, /* for traditional structlevel binary writes */
    mode: int, /* holds READING, WRITING, FREEING, CONVERTING modes  */
    ftype: int, /* NHF_LEVELFILE, NHF_SAVEFILE, or NHF_BONESFILE */
    fnidx: int, /* index of procs for fieldlevel saves */
    rcount: long, /* read count since opening */
         wcount: long, /* write count since opening */
    structlevel: boolean, /* traditional structure binary saves */
    fieldlevel: boolean, /* fieldlevel saves each field individually */
    addinfo: boolean, /* if set, some additional context info from core */
    eof: boolean, /* place to mark eof reached */
    bendian: boolean, /* set to true if executing on big-endian machine */
    fpdef: ptr_to("struct__IO_FILE"), /* file pointer for fieldlevel default style */
    fpdefmap: ptr_to("struct__IO_FILE"), /* file pointer mapfile for def format */
    fplog: ptr_to("struct__IO_FILE"), /* file pointer logfile */
    fpdebug: ptr_to("struct__IO_FILE"), /* file pointer debug info */
    style: "struct_fieldlevel_content",
    nhfpconvert: ptr_to("struct_nh_file"),
});

/* Monster name articles */
export const ARTICLE_NONE = 0;
export const ARTICLE_THE = 1;
export const ARTICLE_A = 2;
export const ARTICLE_YOUR = 3;

/* x_monnam() monster name suppress masks */
export const SUPPRESS_IT = 0x01;
export const SUPPRESS_INVISIBLE = 0x02;
export const SUPPRESS_HALLUCINATION = 0x04;
export const SUPPRESS_SADDLE = 0x08;
export const SUPPRESS_MAPPEARANCE = 0x10;
export const EXACT_NAME = 0x1F;
export const SUPPRESS_NAME = 0x20;
export const AUGMENT_IT = 0x40;

/* Some systems want to use full pathnames for some subsets of file names,
 * rather than assuming that they're all in the current directory.  This
 * provides all the subclasses that seem reasonable, and sets up for all
 * prefixes being null.  Port code can set those that it wants.
 */
export const HACKPREFIX = 0;
export const LEVELPREFIX = 1;
export const SAVEPREFIX = 2;
export const BONESPREFIX = 3;

export const SCOREPREFIX = 5;

export const SYSCONFPREFIX = 7;

export const TROUBLEPREFIX = 9;
export const PREFIX_COUNT = 10;
/* used in files.c; xxconf.h can override if needed */

/* the bare-bones stuff is unconditional above to simplify coding; for
 * ports that actually use prefixes, add some more localized things
 */

/* from options.c */
export const MAX_MENU_MAPPED_CMDS = 32;

/* player selection constants */
export const BP_ALIGN = 0;
export const BP_GEND = 1;
export const BP_RACE = 2;
export const BP_ROLE = 3;
export const NUM_BP = 4;

/* some array sizes for 'g?' */
export const WIZKIT_MAX = 128;
export const CVT_BUF_SIZE = 64;

export const LUA_VER_BUFSIZ = 20;
export const LUA_COPYRIGHT_BUFSIZ = 120;

/* Symbol offsets */
export const SYM_OFF_P = (0);
export const SYM_OFF_O = (SYM_OFF_P + MAXPCHARS);
export const SYM_OFF_M = (SYM_OFF_O + MAXOCLASSES);
export const SYM_OFF_W = (SYM_OFF_M + MAXMCLASSES);
export const SYM_OFF_X = (SYM_OFF_W + WARNCOUNT);
export const SYM_MAX = (SYM_OFF_X + MAXOTHER);

/* The UNDEFINED macros are used to initialize variables whose
   initialized value is not relied upon.
   UNDEFINED_VALUE: used to initialize any scalar type except pointers.
   UNDEFINED_VALUES: used to initialize any non scalar type without pointers.
   UNDEFINED_PTR: can be used only on pointer types. */
export const UNDEFINED_VALUE = 0;

export const mmflags_nht = unsigned; /* makemon MM_ flags */

/* flags to control makemon(); goodpos() uses some plus has some of its own*/
export const NO_MM_FLAGS = 0x00000000;
export const NO_MINVENT = 0x00000001;
export const MM_NOWAIT = 0x00000002;
export const MM_NOCOUNTBIRTH = 0x00000004;
export const MM_IGNOREWATER = 0x00000008;
export const MM_ADJACENTOK = 0x00000010;
export const MM_ANGRY = 0x00000020;
export const MM_NONAME = 0x00000040;
export const MM_EGD = 0x00000080;
export const MM_EPRI = 0x00000100;
export const MM_ESHK = 0x00000200;
export const MM_EMIN = 0x00000400;
export const MM_EDOG = 0x00000800;
export const MM_ASLEEP = 0x00001000;
export const MM_NOGRP = 0x00002000;
export const MM_NOTAIL = 0x00004000;
export const MM_MALE = 0x00008000;
export const MM_FEMALE = 0x00010000;
export const MM_NOMSG = 0x00020000;
export const MM_NOEXCLAM = 0x00040000;

export const MM_IGNORELAVA = 0x00080000;
export const MM_MINVIS = 0x00100000;
/* if more MM_ flag masks are added, skip or renumber the GP_ one(s) */
export const GP_ALLOW_XY = 0x00200000;

export const GP_ALLOW_U = 0x00400000;
export const GP_CHECKSCARY = 0x00800000;
export const GP_AVOID_MONPOS = 0x01000000;
/* 25 bits used */

/* flags for mhidden_description() (pager.c; used for mimics and hiders) */
export const MHID_PREFIX = 1;
export const MHID_ARTICLE = 2;
export const MHID_ALTMON = 4;
export const MHID_REGION = 8;

/* flags for that_is_a_mimic() */
export const MIM_REVEAL = 1;
export const MIM_OMIT_WAIT = 2;

/* flags for make_corpse() and mkcorpstat(); 0..7 are recorded in obj->spe */
export const CORPSTAT_NONE = 0x00;
export const CORPSTAT_GENDER = 0x03;
export const CORPSTAT_HISTORIC = 0x04;
export const CORPSTAT_SPE_VAL = 0x07;
export const CORPSTAT_INIT = 0x08;
export const CORPSTAT_BURIED = 0x10;
/* note: gender flags have different values from those used for monsters
   so that 0 can be unspecified/random instead of male */
export const CORPSTAT_RANDOM = 0;
export const CORPSTAT_FEMALE = 1;
export const CORPSTAT_MALE = 2;
export const CORPSTAT_NEUTER = 3;

/* flag bits for collect_coords(); combining ring_pairs with unshuffled
   makes no sense--if both are specified unshuffled takes precedence */
export const CC_NO_FLAGS = 0x00;

export const CC_INCL_CENTER = 0x01;
export const CC_UNSHUFFLED = 0x02;
export const CC_RING_PAIRS = 0x04;
export const CC_SKIP_MONS = 0x08;
export const CC_SKIP_INACCS = 0x10;

/* flags for decide_to_shift() */

/* m_poisongas_ok() return values */
export const M_POISONGAS_BAD = 0;
export const M_POISONGAS_MINOR = 1;
export const M_POISONGAS_OK = 2;

/* flags for deliver_obj_to_mon */
export const DF_NONE = 0x00;
export const DF_RANDOM = 0x01;
export const DF_ALL = 0x04;

/* special mhpmax value when loading bones monster to flag as extinct or
 * genocided */
export const DEFUNCT_MONSTER = (-100);

/* flags for special ggetobj status returns */
export const ALL_FINISHED = 0x01;

/* flags to control query_objlist() */
export const BY_NEXTHERE = 0x0001;
export const INCLUDE_VENOM = 0x0002;
export const AUTOSELECT_SINGLE = 0x0004;
export const USE_INVLET = 0x0008;
export const INVORDER_SORT = 0x0010;
export const SIGNAL_NOMENU = 0x0020;
export const SIGNAL_ESCAPE = 0x0040;
export const FEEL_COCKATRICE = 0x0080;
export const INCLUDE_HERO = 0x0100;

/* Flags to control query_category() */
/* BY_NEXTHERE and INCLUDE_VENOM are used by query_category() too, so
   skip 0x0001 and 0x0002 */
export const UNPAID_TYPES = 0x0004;

export const WORN_TYPES = 0x0010;
export const ALL_TYPES = 0x0020;
export const BILLED_TYPES = 0x0040;
export const CHOOSE_ALL = 0x0080;
export const BUC_BLESSED = 0x0100;
export const BUC_CURSED = 0x0200;
export const BUC_UNCURSED = 0x0400;
export const BUC_UNKNOWN = 0x0800;
export const JUSTPICKED = 0x1000;
export const BUC_ALLBKNOWN = (BUC_BLESSED | BUC_CURSED | BUC_UNCURSED);
export const BUCX_TYPES = (BUC_ALLBKNOWN | BUC_UNKNOWN);
export const ALL_TYPES_SELECTED = -2;

/* Flags for oname(), artifact_exists(), artifact_origin() */
export const ONAME_NO_FLAGS = 0;
/*                       0x0001U is reserved for 'exists' */
/* flags indicating where an artifact came from */
export const ONAME_VIA_NAMING = 0x0002;

export const ONAME_WISH = 0x0004;
export const ONAME_GIFT = 0x0008;

export const ONAME_VIA_DIP = 0x0010;
export const ONAME_LEVEL_DEF = 0x0020;
export const ONAME_BONES = 0x0040;

export const ONAME_RANDOM = 0x0080;

/* flag controlling potential livelog event of finding an artifact */
export const ONAME_KNOW_ARTI = 0x0100;
/* flag for suppressing perm_invent update when name gets assigned */
export const ONAME_SKIP_INVUPD = 0x0200;

/* Flags to control find_mid() and whereis_mon() */
export const FM_FMON = 0x01;
export const FM_MIGRATE = 0x02;
export const FM_MYDOGS = 0x04;
export const FM_YOU = 0x08;
export const FM_EVERYWHERE = (FM_YOU | FM_FMON | FM_MIGRATE | FM_MYDOGS);

/* Flags to control pick_[race,role,gend,align] routines in role.c */
export const PICK_RANDOM = 0;
export const PICK_RIGID = 1;

/* Flags to control dotrap() and mintrap() in trap.c */
export const NO_TRAP_FLAGS = 0x00;
export const FORCETRAP = 0x01;
export const NOWEBMSG = 0x02;
export const FORCEBUNGLE = 0x04;
export const RECURSIVETRAP = 0x08;
export const TOOKPLUNGE = 0x10;
export const VIASITTING = 0x20;
export const FAILEDUNTRAP = 0x40;
export const HURTLING = 0x80;

/* Flags to control test_move in hack.c */
export const DO_MOVE = 0;
export const TEST_MOVE = 1;
export const TEST_TRAV = 2;
export const TEST_TRAP = 3;

/* m_move return values */
export const MMOVE_NOTHING = 0;
export const MMOVE_MOVED = 1;
export const MMOVE_DIED = 2;
export const MMOVE_DONE = 3;
export const MMOVE_NOMOVES = 4;

/* Macros for scatter */
export const VIS_EFFECTS = 0x01;
export const MAY_HITMON = 0x02;
export const MAY_HITYOU = 0x04;
export const MAY_HIT = (MAY_HITMON | MAY_HITYOU);
export const MAY_DESTROY = 0x08;
export const MAY_FRACTURE = 0x10;

/* Macros for launching objects */
export const ROLL = 0x01;

export const LAUNCH_UNSEEN = 0x40;
export const LAUNCH_KNOWN = 0x80;

/* enlightenment control flags */
export const BASICENLIGHTENMENT = 1;
export const MAGICENLIGHTENMENT = 2;
export const ENL_GAMEINPROGRESS = 0;
export const ENL_GAMEOVERALIVE = 1;
export const ENL_GAMEOVERDEAD = 2;

/* control flags for sortloot() */
export const SORTLOOT_PACK = 0x01;
export const SORTLOOT_INVLET = 0x02;
export const SORTLOOT_LOOT = 0x04;
export const SORTLOOT_INUSE = 0x08;
export const SORTLOOT_PETRIFY = 0x20;

/* flags for xkilled() [note: meaning of first bit used to be reversed,
   1 to give message and 0 to suppress] */
export const XKILL_GIVEMSG = 0;
export const XKILL_NOMSG = 1;
export const XKILL_NOCORPSE = 2;
export const XKILL_NOCONDUCT = 4;

/* pline_flags; mask values for custompline()'s first argument */
/* #define PLINE_ORDINARY 0 */
export const PLINE_NOREPEAT = 1;
export const OVERRIDE_MSGTYPE = 2;
export const SUPPRESS_HISTORY = 4;
export const URGENT_MESSAGE = 8;
export const PLINE_VERBALIZE = 16;

export const NO_CURS_ON_U = 64;

/* get_count flags */
export const GC_NOFLAGS = 0;
export const GC_SAVEHIST = 1;
export const GC_CONDHIST = 2;

export const GC_ECHOFIRST = 4;

/* rloc() flags */
export const RLOC_NONE = 0x00;
export const RLOC_ERR = 0x01;
export const RLOC_MSG = 0x02;
export const RLOC_NOMSG = 0x04;

/* indices for some special tin types */
export const ROTTEN_TIN = 0;
export const HOMEMADE_TIN = 1;
export const SPINACH_TIN = (-1);
export const RANDOM_TIN = (-2);
export const HEALTHY_TIN = (-3);

/* Corpse aging */
export const TAINT_AGE = (50);
export const TROLL_REVIVE_CHANCE = 37;
export const ROT_AGE = (250);

export const WAND_BACKFIRE_CHANCE = 100;
export const WAND_WREST_CHANCE = 121;

/* Flags to control menus */
export const MENUTYPELEN = sizeof_string("traditional ");
export const MENU_TRADITIONAL = 0;
export const MENU_COMBINATION = 1;
export const MENU_FULL = 2;
export const MENU_PARTIAL = 3;

/* flags to control teleds() */
export const TELEDS_NO_FLAGS = 0;
export const TELEDS_ALLOW_DRAG = 1;
export const TELEDS_TELEPORT = 2;

/* flags for mktrap() */
export const MKTRAP_NOFLAGS = 0x0;
export const MKTRAP_SEEN = 0x1;
export const MKTRAP_MAZEFLAG = 0x2;
export const MKTRAP_NOSPIDERONWEB = 0x4;
export const MKTRAP_NOVICTIM = 0x8;

export const MON_POLE_DIST = 5;
export const PET_MISSILE_RANGE2 = 36;

/* flags passed to getobj() to control how it responds to player input */
export const GETOBJ_NOFLAGS = 0x0;
export const GETOBJ_ALLOWCNT = 0x1;
export const GETOBJ_PROMPT = 0x2;

/* flags for hero_breaks() and hits_bars(); BRK_KNOWN* let callers who have
   already called breaktest() prevent it from being called again since it
   has a random factor which makes it be non-deterministic */
export const BRK_BY_HERO = 0x01;
export const BRK_FROM_INV = 0x02;
export const BRK_KNOWN2BREAK = 0x04;
export const BRK_KNOWN2NOTBREAK = 0x08;
export const BRK_KNOWN_OUTCOME = (BRK_KNOWN2BREAK | BRK_KNOWN2NOTBREAK);
export const BRK_MELEE = 0x10;

/* extended command return values */
export const ECMD_OK = 0x00;
export const ECMD_TIME = 0x01;
export const ECMD_CANCEL = 0x02;
export const ECMD_FAIL = 0x04;

/* flags for newcham() */
export const NO_NC_FLAGS = 0;
export const NC_SHOW_MSG = 0x01;
export const NC_VIA_WAND_OR_SPELL = 0x02;

/* Constant passed to explode() for gas spores because gas spores are weird.
 * Specifically, this is an exception to whole "explode() uses dobuzz types"
 * system (the range -1 to -9 isn't used by it, for some reason), where this
 * is effectively an extra dobuzz type, and some zap.c code needs to be aware
 * of it. */
export const PHYS_EXPL_TYPE = -1;

/* These may have been defined to platform-specific values in *conf.h
 * or on the compiler command line from a hints file or Makefile */

export const DEVTEAM_EMAIL = "devteam@nethack.org";
export const DEVTEAM_URL = "https://www.nethack.org/";

import { AFTER_LAST_ARTIFACT } from "./artilist.h.js";
import { MAXMCLASSES, MAXOCLASSES, MAXPCHARS } from "./defsym.h.js";
import { BUFSZ, MAXDUNGEON, MAXLEVEL, boolean, coordxy, xint16 } from "./global.h.js";
import { int8 } from "./integer.h.js";
import { MAXOTHER, WARNCOUNT } from "./sym.h.js";
import { NUM_MOUSE_BUTTONS } from "./wintype.h.js";
import {
    char, int, long, ord, schar, short, sizeof_string, uchar, unsigned,
} from "../rt/ctypes.js";
import { Bitfield, array_of, ptr_to, struct, union, void_t } from "../rt/struct.js";
