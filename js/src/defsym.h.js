/* NetHack 5.0	defsym.h $NHDT-Date: 1725653007 2024/09/06 20:03:27 $ $NHDT-Branch: NetHack-3.7 $ $NHDT-Revision: 1.25 $ */
/*      Copyright (c) 2016 by Pasi Kallinen              */
/* NetHack may be freely redistributed.  See license for details. */

/*
    This header is included in multiple places to produce
    different code depending on its use. Its purpose is to
    ensure that there is only one definitive source for
    pchar, objclass and mon symbols.

    The morphing macro expansions are used in these places:
  - in include/sym.h for enums of some S_* symbol values
    (define PCHAR_S_ENUM, MONSYMS_S_ENUM prior to #include defsym.h)
  - in include/sym.h for enums of some DEF_* symbol values
    (define MONSYMS_DEFCHAR_ENUM prior to #include defsym.h)
  - in include/objclass.h for enums of some default character values
    (define OBJCLASS_DEFCHAR_ENUM prior to #include defsym.h)
  - in include/objclass.h for enums of some *_CLASS values
    (define OBJCLASS_CLASS_ENUM prior to #include defsym.h)
  - in include/objclass.h for enums of S_* symbol values
    (define OBJCLASS_S_ENUM prior to #include defsym.h)
  - in src/symbols.c for parsing S_ entries in config files
    (define PCHAR_PARSE, MONSYMS_PARSE, OBJCLASS_PARSE prior
    to #include defsym.h)
  - in src/drawing.c for initializing some data structures/arrays
    (define PCHAR_DRAWING, MONSYMS_DRAWING, OBJCLASS_DRAWING prior
    to #include defsym.h)
  - in win/share/tilemap.c for processing a tile file
    (define PCHAR_TILES prior to #include defsym.h).
  - in src/allmain.c for setting up the dumping of several enums
    (define DUMP_ENUMS_PCHAR, DUMP_ENUMS_MONSYS, DUMP_ENUMS_MONSYMS_DEFCHAR
     DUMP_ENUMS_OBJCLASS_DEFCHARS, DUMP_ENUMS_OBJCLASS_DEFCHARS
     DUMP_ENUMS_OBJCLASS_CLASSES, DUMP_ENUMS_OBJCLASS_SYMS)
*/

/*
   PCHAR(idx, ch, sym, desc, clr)
       idx:     index used in enum
       ch:      character symbol
       sym:     symbol name for parsing purposes (also tile name)
       desc:    description
       clr:     color

   PCHAR2(idx, ch, sym, tilenm, desc, clr)
       idx:     index used in enum
       ch:      character symbol
       sym:     symbol name for parsing purposes
       tilenm:  if the name in the tile txt file differs from desc (below),
                the name in the tile txt file can be specified here.
       desc:    description
       clr:     color
*/

/* sym.h */

/* symbols.c */

/* drawing.c */

/* win/share/tilemap.c */

/* allmain.c */

/* PCHAR with extra arg */

    export const S_stone = 0;
    export const S_vwall = 1;
    export const S_hwall = 2;
    export const S_tlcorn = 3;
    export const S_trcorn = 4;
    export const S_blcorn = 5;
    export const S_brcorn = 6;
    export const S_crwall = 7;
    export const S_tuwall = 8;
    export const S_tdwall = 9;
    export const S_tlwall = 10;
    export const S_trwall = 11;
    /* start cmap A                                                      */
    export const S_ndoor = 12;
    export const S_vodoor = 13;
    export const S_hodoor = 14;
    export const S_vcdoor = 15;

    export const S_hcdoor = 16;

    export const S_bars = 17;
    export const S_tree = 18;
    export const S_room = 19;
    export const S_darkroom = 20;
    export const S_engroom = 21;

    export const S_corr = 22;
    export const S_litcorr = 23;
    export const S_engrcorr = 24;

    export const S_upstair = 25;
    export const S_dnstair = 26;
    export const S_upladder = 27;
    export const S_dnladder = 28;
    export const S_brupstair = 29;
    export const S_brdnstair = 30;
    export const S_brupladder = 31;
    export const S_brdnladder = 32;
    /* end cmap A */
    export const S_altar = 33;
    /* start cmap B */
    export const S_grave = 34;
    export const S_throne = 35;
    export const S_sink = 36;
    export const S_fountain = 37;
    /* the S_pool symbol is used for both POOL terrain and MOAT terrain */
    export const S_pool = 38;
    export const S_ice = 39;
    export const S_lava = 40;
    export const S_lavawall = 41;
    export const S_vodbridge = 42;

    export const S_hodbridge = 43;

    export const S_vcdbridge = 44;

    export const S_hcdbridge = 45;

    export const S_air = 46;
    export const S_cloud = 47;
    /* the S_water symbol is used for WATER terrain: wall of water in the
       dungeon and Plane of Water in the endgame */
    export const S_water = 48;
    /* end dungeon characters                                          */
    /*                                                                 */
    /* begin traps                                                     */
    /*                                                                 */
    export const S_arrow_trap = 49;
    export const S_dart_trap = 50;
    export const S_falling_rock_trap = 51;
    export const S_squeaky_board = 52;
    export const S_bear_trap = 53;
    export const S_land_mine = 54;
    export const S_rolling_boulder_trap = 55;
    export const S_sleeping_gas_trap = 56;
    export const S_rust_trap = 57;
    export const S_fire_trap = 58;
    export const S_pit = 59;
    export const S_spiked_pit = 60;
    export const S_hole = 61;
    export const S_trap_door = 62;
    export const S_teleportation_trap = 63;
    export const S_level_teleporter = 64;
    export const S_magic_portal = 65;
    export const S_web = 66;
    export const S_statue_trap = 67;
    export const S_magic_trap = 68;
    export const S_anti_magic_trap = 69;

    export const S_polymorph_trap = 70;
    export const S_vibrating_square = 71;
    export const S_trapped_door = 72;
    export const S_trapped_chest = 73;
    /* end traps                                                       */
    /* end cmap B */
    /*                                                                   */
    /* begin special effects                                             */
    /*                                                                   */
    /* zap colors are changed by reset_glyphmap() to match type of beam */
    /*                                                                   */
    export const S_vbeam = 74;
    export const S_hbeam = 75;
    export const S_lslant = 76;
    export const S_rslant = 77;
    /* start cmap C */
    export const S_digbeam = 78;
    export const S_flashbeam = 79;
    export const S_boomleft = 80;
    export const S_boomright = 81;
    /* 4 magic shield symbols                                          */
    export const S_ss1 = 82;
    export const S_ss2 = 83;
    export const S_ss3 = 84;
    export const S_ss4 = 85;
    export const S_poisoncloud = 86;
    /* for a time S_goodpos was a question mark, but dollar sign is the
       default keystroke for getpos() to toggle goodpos glyphs on or off */
    export const S_goodpos = 87;
    /* end cmap C */
    /*                                                             */
    /* The 8 swallow symbols.  Do NOT separate.                    */
    /* To change order or add, see the function swallow_to_glyph() */
    /* in display.c. swallow colors are changed by                 */
    /* reset_glyphmap() to match the engulfing monst.              */
    /*                                                             */
    /*  Order:                                                     */
    /*                                                             */
    /*      1 2 3                                                  */
    /*      4 5 6                                                  */
    /*      7 8 9                                                  */
    /*                                                             */
    export const S_sw_tl = 88; /*1*/
    export const S_sw_tc = 89; /*2*/
    export const S_sw_tr = 90; /*3*/
    export const S_sw_ml = 91; /*4*/
    export const S_sw_mr = 92; /*6*/
    export const S_sw_bl = 93; /*7*/
    export const S_sw_bc = 94; /*8*/
    export const S_sw_br = 95; /*9*/
    /*                                                             */
    /* explosion colors are changed by reset_glyphmap() to match   */
    /* the type of expl.                                           */
    /*                                                             */
    /*    Ex.                                                      */
    /*                                                             */
    /*      /-\                                                    */
    /*      |@|                                                    */
    /*      \-/                                                    */
    /*                                                             */
    export const S_expl_tl = 96;
    export const S_expl_tc = 97;
    export const S_expl_tr = 98;
    export const S_expl_ml = 99;
    export const S_expl_mc = 100;
    export const S_expl_mr = 101;
    export const S_expl_bl = 102;
    export const S_expl_bc = 103;
    export const S_expl_br = 104; export const MAXPCHARS = S_expl_br + 1;

/*
    MONSYM(idx, ch, sym desc)
        idx:     index used in enum
        ch:      character symbol
        sym:     symbol name for parsing purposes
        desc:    description
*/

/* sym.h */

/* sym.h */

/* symbols.c */

/* drawing.c */

/* allmain.c */

    export const S_ANT = 1; export const DEF_ANT = ord("a");
    export const S_BLOB = 2; export const DEF_BLOB = ord("b");
    export const S_COCKATRICE = 3; export const DEF_COCKATRICE = ord("c");
    export const S_DOG = 4; export const DEF_DOG = ord("d");
    export const S_EYE = 5; export const DEF_EYE = ord("e");
    export const S_FELINE = 6; export const DEF_FELINE = ord("f");
    export const S_GREMLIN = 7; export const DEF_GREMLIN = ord("g");
    /* small humanoids: hobbit, dwarf */
    export const S_HUMANOID = 8; export const DEF_HUMANOID = ord("h");
    /* minor demons */
    export const S_IMP = 9; export const DEF_IMP = ord("i");
    export const S_JELLY = 10; export const DEF_JELLY = ord("j");
    export const S_KOBOLD = 11; export const DEF_KOBOLD = ord("k");
    export const S_LEPRECHAUN = 12; export const DEF_LEPRECHAUN = ord("l");
    export const S_MIMIC = 13; export const DEF_MIMIC = ord("m");
    export const S_NYMPH = 14; export const DEF_NYMPH = ord("n");
    export const S_ORC = 15; export const DEF_ORC = ord("o");
    export const S_PIERCER = 16; export const DEF_PIERCER = ord("p");
    /* quadruped excludes horses */
    export const S_QUADRUPED = 17; export const DEF_QUADRUPED = ord("q");
    export const S_RODENT = 18; export const DEF_RODENT = ord("r");
    export const S_SPIDER = 19; export const DEF_SPIDER = ord("s");
    export const S_TRAPPER = 20; export const DEF_TRAPPER = ord("t");
    /* unicorn, horses */
    export const S_UNICORN = 21; export const DEF_UNICORN = ord("u");
    export const S_VORTEX = 22; export const DEF_VORTEX = ord("v");
    export const S_WORM = 23; export const DEF_WORM = ord("w");
    export const S_XAN = 24; export const DEF_XAN = ord("x");
    /* yellow light, black light */
    export const S_LIGHT = 25; export const DEF_LIGHT = ord("y");
    export const S_ZRUTY = 26; export const DEF_ZRUTY = ord("z");
    export const S_ANGEL = 27; export const DEF_ANGEL = ord("A");
    export const S_BAT = 28; export const DEF_BAT = ord("B");
    export const S_CENTAUR = 29; export const DEF_CENTAUR = ord("C");
    export const S_DRAGON = 30; export const DEF_DRAGON = ord("D");
    /* elemental includes invisible stalker */
    export const S_ELEMENTAL = 31; export const DEF_ELEMENTAL = ord("E");
    export const S_FUNGUS = 32; export const DEF_FUNGUS = ord("F");
    export const S_GNOME = 33; export const DEF_GNOME = ord("G");
    /* large humanoid: giant, ettin, minotaur */
    export const S_GIANT = 34; export const DEF_GIANT = ord("H");
    export const S_invisible = 35; export const DEF_INVISIBLE = ord("I");
    export const S_JABBERWOCK = 36; export const DEF_JABBERWOCK = ord("J");
    export const S_KOP = 37; export const DEF_KOP = ord("K");
    export const S_LICH = 38; export const DEF_LICH = ord("L");
    export const S_MUMMY = 39; export const DEF_MUMMY = ord("M");
    export const S_NAGA = 40; export const DEF_NAGA = ord("N");
    export const S_OGRE = 41; export const DEF_OGRE = ord("O");
    export const S_PUDDING = 42; export const DEF_PUDDING = ord("P");
    export const S_QUANTMECH = 43; export const DEF_QUANTMECH = ord("Q");
    export const S_RUSTMONST = 44; export const DEF_RUSTMONST = ord("R");
    export const S_SNAKE = 45; export const DEF_SNAKE = ord("S");
    export const S_TROLL = 46; export const DEF_TROLL = ord("T");
    /* umber hulk */
    export const S_UMBER = 47; export const DEF_UMBER = ord("U");
    export const S_VAMPIRE = 48; export const DEF_VAMPIRE = ord("V");
    export const S_WRAITH = 49; export const DEF_WRAITH = ord("W");
    export const S_XORN = 50; export const DEF_XORN = ord("X");
    /* apelike creature includes owlbear, monkey */
    export const S_YETI = 51; export const DEF_YETI = ord("Y");
    export const S_ZOMBIE = 52; export const DEF_ZOMBIE = ord("Z");
    export const S_HUMAN = 53; export const DEF_HUMAN = ord("@");
    /* space symbol*/
    export const S_GHOST = 54; export const DEF_GHOST = ord(" ");
    export const S_GOLEM = 55; export const DEF_GOLEM = ord("'");
    export const S_DEMON = 56; export const DEF_DEMON = ord("&");
    /* fish */
    export const S_EEL = 57; export const DEF_EEL = ord(";");
    /* reptiles */
    export const S_LIZARD = 58; export const DEF_LIZARD = ord(":");
    export const S_WORM_TAIL = 59; export const DEF_WORM_TAIL = ord("~");
    export const S_MIMIC_DEF = 60; export const MAXMCLASSES = S_MIMIC_DEF + 1; export const DEF_MIMIC_DEF = ord("]");

/*
    OBJCLASS(idx, ch, basename, sym, name, explain)
        idx:      index used in enum
        ch:       default character
        basename: unadorned base name of objclass, used
                  to construct enums through suffixes/prefixes
        sym:      symbol name for enum and parsing purposes
        name:     used in object_detect()
        explain:  used in do_look()

    OBJCLASS2(idx, ch, basename, sname, sym, name, explain)
        idx:      index used in enum
        ch:       default character
        basename: unadorned base name of objclass, used
                  to construct enums through suffixes/prefixes
        sname:    hardcoded *_SYM value for this entry (required
                  only because basename and GOLD_SYM differ
        sym:      symbol name for enum and parsing purposes
        name:     used in object_detect()
        explain:  used in do_look()
*/

/* objclass.h */

/* objclass.h */

/* objclass.h */

/* symbols.c */

/* drawing.c */

/* allmain.c */

/* allmain.c */

/* allmain.c */

/* OBJCLASS with extra arg */

    export const RANDOM_CLASS = 0; export const ILLOBJ_CLASS = 1; export const ILLOBJ_SYM = ord("]"); export const S_strange_obj = 1;

    export const WEAPON_CLASS = 2; export const WEAPON_SYM = ord(")"); export const S_weapon = 2;
    export const ARMOR_CLASS = 3; export const ARMOR_SYM = ord("["); export const S_armor = 3;
    export const RING_CLASS = 4; export const RING_SYM = ord("="); export const S_ring = 4;
    export const AMULET_CLASS = 5; export const AMULET_SYM = ord("\""); export const S_amulet = 5;
    export const TOOL_CLASS = 6; export const TOOL_SYM = ord("("); export const S_tool = 6;

    export const FOOD_CLASS = 7; export const FOOD_SYM = ord("%"); export const S_food = 7;
    export const POTION_CLASS = 8; export const POTION_SYM = ord("!"); export const S_potion = 8;
    export const SCROLL_CLASS = 9; export const SCROLL_SYM = ord("?"); export const S_scroll = 9;
    export const SPBOOK_CLASS = 10; export const SPBOOK_SYM = ord("+"); export const S_book = 10;
    export const WAND_CLASS = 11; export const WAND_SYM = ord("/"); export const S_wand = 11;
    export const COIN_CLASS = 12; export const GOLD_SYM = ord("$"); export const S_coin = 12;
    export const GEM_CLASS = 13; export const GEM_SYM = ord("*"); export const S_gem = 13;
    export const ROCK_CLASS = 14; export const ROCK_SYM = ord("`"); export const S_rock = 14;
    export const BALL_CLASS = 15; export const BALL_SYM = ord("0"); export const S_ball = 15;
    export const CHAIN_CLASS = 16; export const CHAIN_SYM = ord("_"); export const S_chain = 16;
    export const VENOM_CLASS = 17; export const MAXOCLASSES = VENOM_CLASS + 1; export const VENOM_SYM = ord("."); export const S_venom = 17;

/* end of defsym.h */

import { ord } from "../rt/ctypes.js";
