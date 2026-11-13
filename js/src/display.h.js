/*
 * tmp_at() control calls.
 */
export const DISP_BEAM = (-1);
export const DISP_ALL = (-2);
export const DISP_TETHER = (-3);
export const DISP_FLASH = (-4);
export const DISP_ALWAYS = (-5);
export const DISP_CHANGE = (-6);
export const DISP_END = (-7);
export const DISP_FREEMEM = (-8);

/* Total number of cmap indices in the shield_static[] array. */
export const SHIELD_COUNT = 21;
export const BACKTRACK = (-1);

/*
 * NetHack glyphs
 *
 * A glyph is an abstraction that represents a _unique_ monster, object,
 * dungeon part, or effect.  The uniqueness is important.  For example,
 * It is not enough to have four (one for each "direction") zap beam glyphs,
 * we need a set of four for each beam type.  Why go to so much trouble?
 * Because it is possible that any given window dependent display driver
 * [print_glyph()] can produce something different for each type of glyph.
 * That is, a beam of cold and a beam of fire would not only be different
 * colors, but would also be represented by different symbols.
 */

/* 3.6.3: poison gas zap used to be yellow and acid zap was green,
   which conflicted with the corresponding dragon colors */

    export const zap_color_missile = HI_ZAP;
    export const zap_color_fire = CLR_ORANGE;
    export const zap_color_frost = CLR_WHITE;
    export const zap_color_sleep = HI_ZAP;
    export const zap_color_death = CLR_BLACK;
    export const zap_color_lightning = CLR_WHITE;
    export const zap_color_poison_gas = CLR_GREEN;
    export const zap_color_acid = CLR_YELLOW;

    export const altar_color_unaligned = CLR_RED;

        /* On OSX with TERM=xterm-color256 these render as
         *  white -> tty: gray, curses: ok
         *  gray  -> both tty and curses: black
         *  black -> both tty and curses: blue
         *  red   -> both tty and curses: ok.
         * Since the colors have specific associations (with the
         * unicorns matched with each alignment), we shouldn't use
         * scrambled colors and we don't have sufficient information
         * to handle platform-specific color variations.
         */

    export const altar_color_chaotic = CLR_GRAY;
    export const altar_color_neutral = CLR_GRAY;
    export const altar_color_lawful = CLR_GRAY;

    export const altar_color_other = CLR_BRIGHT_MAGENTA;

/* types of explosions */

    export const EXPL_DARK = 0;
    export const EXPL_NOXIOUS = 1;
    export const EXPL_MUDDY = 2;
    export const EXPL_WET = 3;
    export const EXPL_MAGICAL = 4;
    export const EXPL_FIERY = 5;
    export const EXPL_FROSTY = 6;
    export const EXPL_MAX = 7;

/* above plus this redundant? */

    export const expl_dark = 0;
    export const expl_noxious = expl_dark + 1;
    export const expl_muddy = expl_noxious + 1;
    export const expl_wet = expl_muddy + 1;
    export const expl_magical = expl_wet + 1;
    export const expl_fiery = expl_magical + 1;
    export const expl_frosty = expl_fiery + 1;

    export const explode_color_dark = CLR_BLACK;
    export const explode_color_noxious = CLR_GREEN;
    export const explode_color_muddy = CLR_BROWN;
    export const explode_color_wet = CLR_BLUE;
    export const explode_color_magical = CLR_MAGENTA;
    export const explode_color_fiery = CLR_ORANGE;
    export const explode_color_frosty = CLR_WHITE;

    export const altar_unaligned = 0;
    export const altar_chaotic = altar_unaligned + 1;
    export const altar_neutral = altar_chaotic + 1;
    export const altar_lawful = altar_neutral + 1;
    export const altar_other = altar_lawful + 1;

export const main_walls = 0; export const mines_walls = main_walls + 1; export const gehennom_walls = mines_walls + 1;
                    export const knox_walls = gehennom_walls + 1; export const sokoban_walls = knox_walls + 1;
/* glyphmod entries */
export const gm_nochange = 0; export const gm_newgame = gm_nochange + 1; export const gm_levelchange = gm_newgame + 1;
                                export const gm_optionchange = gm_levelchange + 1; export const gm_symchange = gm_optionchange + 1;
                                export const gm_accessibility_change = gm_symchange + 1;
export const NUM_ZAP = 8;

/*
 * Glyphs are grouped for easy accessibility:
 *
 * male monsters    Represents all the wild (not tame) male monsters.
 *                  Count: NUMMONS.
 *
 * female monsters  Represents all the wild (not tame) female monsters.
 *                  Count: NUMMONS.
 *
 * male pets        Represents all of the male tame monsters.
 *                  Count: NUMMONS.
 *
 * female pets      Represents all of the female tame monsters.
 *                  Count: NUMMONS.
 *
 * invisible        Invisible monster placeholder.
 *                  Count: 1.
 *
 * detect (male)    Represents all detected male monsters.
 *                  Count: NUMMONS.
 *
 * detect (female)  Represents all detected female monsters.
 *                  Count: NUMMONS.
 *
 * corpse           One for each monster (male/female not differentiated).
 *                  Count: NUMMONS.
 *
 * ridden (male)    Represents all male monsters being ridden.
 *                  Count: NUMMONS
 *
 * ridden (female)  Represents all female monsters being ridden.
 *                  Count: NUMMONS
 *
 * object           One for each type of object.  The first entry is
 *                  'strange object', the next 1..MAXOCLASSES-1 entries
 *                  are generic (one for each class, including one for
 *                  strange object's 'illobj class'), the rest are
 *                  regular objects.  Some members of the generic
 *                  subset are used to prevent color of potions, gems,
 *                  and spellbooks from being revealed when obj->dknown
 *                  hasn't been set, avoiding a bug which had been
 *                  present since day one of color support.
 *                  Count: NUM_OBJECTS
 *
 * Stone            Stone
 *                  Count: 1
 *
 * main walls       level walls (main)
 *                  Count: (S_trwall - S_vwall) + 1 = 11
 *
 * mines walls      level walls (mines)
 *                  Count: (S_trwall - S_vwall) + 1 = 11
 *
 * gehennom walls   level walls (gehennom)
 *                  Count: (S_trwall - S_vwall) + 1 = 11
 *
 * knox walls       level walls (knox)
 *                  Count: (S_trwall - S_vwall) + 1 = 11
 *
 * sokoban walls    level walls (sokoban)
 *                  Count: (S_trwall - S_vwall) + 1 = 11
 *
 * cmap A           S_ndoor through S_brdnladder
 *                  Count: (S_brdnladder - S_ndoor) + 1 = 19
 *
 * Altars           Altar (unaligned, chaotic, neutral, lawful, other)
 *                  Count: 5
 *
 * cmap B           S_grave through S_arrow_trap + TRAPNUM - 1
 *                  Count: (S_arrow_trap + (TRAPNUM - 1) - S_grave) = 39
 *
 * zap beams        set of four (there are four directions) HI_ZAP.
 *                  Count: 4 * NUM_ZAP
 *
 * cmap C           S_digbeam through S_goodpos
 *                  Count: (S_goodpos - S_digbeam) + 1 = 10
 *
 * swallow          A set of eight for each monster.  The eight positions
 *                  represent those surrounding the hero.  The monster
 *                  number is shifted over 3 positions and the swallow
 *                  position is stored in the lower three bits.
 *                  Count: NUMMONS << 3
 *
 * dark explosions        A set of nine.
 *                        Count: MAXEXPCHAR
 *
 * noxious explosions     A set of nine.
 *                        Count: MAXEXPCHAR
 *
 * muddy explosions       A set of nine.
 *                        Count: MAXEXPCHAR
 *
 * wet explosions         A set of nine.
 *                        Count: MAXEXPCHAR
 *
 * magical explosions     A set of nine.
 *                        Count: MAXEXPCHAR
 *
 * fiery explosions       A set of nine.
 *                        Count: MAXEXPCHAR
 *
 * frosty explosions      A set of nine.
 *                        Count: MAXEXPCHAR
 *
 * warning                A set of six representing the different warning
 *                        levels.
 *                        Count: 6
 *
 * statues (male)         One for each male monster.
 *                        Count: NUMMONS
 *
 * statues (female)       One for each female mo nster.
 *                        Count: NUMMONS
 *
 * objects piletop        Represents the top of a pile as well as
 *                        the object.
 *                        Count: NUM_OBJECTS
 *
 * bodies piletop         Represents the top of a pile as well as
 *                        the object, corpse in this case.
 *                        Count: NUMMONS
 *
 * male statues piletop   Represents the top of a pile as well as
 *                        the statue of a male monster.
 *                        Count: NUMMONS
 *
 * female statues piletop Represents the top of a pile as well as
 *                        the statue of a female monster.
 *                        Count: NUMMONS
 *
 * unexplored             One for unexplored areas of the map
 * nothing                Nothing but background
 *
 * The following are offsets used to convert to and from a glyph.
 */

    export const GLYPH_MON_OFF = 0;
    export const GLYPH_MON_MALE_OFF = GLYPH_MON_OFF;
    export const GLYPH_MON_FEM_OFF = (NUMMONS + GLYPH_MON_MALE_OFF);
    export const GLYPH_PET_OFF = (NUMMONS + GLYPH_MON_FEM_OFF);
    export const GLYPH_PET_MALE_OFF = GLYPH_PET_OFF;
    export const GLYPH_PET_FEM_OFF = (NUMMONS + GLYPH_PET_MALE_OFF);
    export const GLYPH_INVIS_OFF = (NUMMONS + GLYPH_PET_FEM_OFF);
    export const GLYPH_DETECT_OFF = (1 + GLYPH_INVIS_OFF);
    export const GLYPH_DETECT_MALE_OFF = GLYPH_DETECT_OFF;
    export const GLYPH_DETECT_FEM_OFF = (NUMMONS + GLYPH_DETECT_MALE_OFF);
    export const GLYPH_BODY_OFF = (NUMMONS + GLYPH_DETECT_FEM_OFF);
    export const GLYPH_RIDDEN_OFF = (NUMMONS + GLYPH_BODY_OFF);
    export const GLYPH_RIDDEN_MALE_OFF = GLYPH_RIDDEN_OFF;
    export const GLYPH_RIDDEN_FEM_OFF = (NUMMONS + GLYPH_RIDDEN_MALE_OFF);
    export const GLYPH_OBJ_OFF = (NUMMONS + GLYPH_RIDDEN_FEM_OFF);
    export const GLYPH_CMAP_OFF = (NUM_OBJECTS + GLYPH_OBJ_OFF);
    export const GLYPH_CMAP_STONE_OFF = GLYPH_CMAP_OFF;
    export const GLYPH_CMAP_MAIN_OFF = (1 + GLYPH_CMAP_STONE_OFF);
    export const GLYPH_CMAP_MINES_OFF = (((S_trwall - S_vwall) + 1) + GLYPH_CMAP_MAIN_OFF);
    export const GLYPH_CMAP_GEH_OFF = (((S_trwall - S_vwall) + 1) + GLYPH_CMAP_MINES_OFF);
    export const GLYPH_CMAP_KNOX_OFF = (((S_trwall - S_vwall) + 1) + GLYPH_CMAP_GEH_OFF);
    export const GLYPH_CMAP_SOKO_OFF = (((S_trwall - S_vwall) + 1) + GLYPH_CMAP_KNOX_OFF);
    export const GLYPH_CMAP_A_OFF = (((S_trwall - S_vwall) + 1) + GLYPH_CMAP_SOKO_OFF);
    export const GLYPH_ALTAR_OFF = (((S_brdnladder - S_ndoor) + 1) + GLYPH_CMAP_A_OFF);
    export const GLYPH_CMAP_B_OFF = (5 + GLYPH_ALTAR_OFF);
    export const GLYPH_ZAP_OFF = ((S_arrow_trap + MAXTCHARS - S_grave) + GLYPH_CMAP_B_OFF);
    export const GLYPH_CMAP_C_OFF = ((NUM_ZAP << 2) + GLYPH_ZAP_OFF);
    export const GLYPH_SWALLOW_OFF = (((S_goodpos - S_digbeam) + 1) + GLYPH_CMAP_C_OFF);
    export const GLYPH_EXPLODE_OFF = ((NUMMONS << 3) + GLYPH_SWALLOW_OFF);
    export const GLYPH_EXPLODE_DARK_OFF = GLYPH_EXPLODE_OFF;
    export const GLYPH_EXPLODE_NOXIOUS_OFF = (MAXEXPCHARS + GLYPH_EXPLODE_DARK_OFF);
    export const GLYPH_EXPLODE_MUDDY_OFF = (MAXEXPCHARS + GLYPH_EXPLODE_NOXIOUS_OFF);
    export const GLYPH_EXPLODE_WET_OFF = (MAXEXPCHARS + GLYPH_EXPLODE_MUDDY_OFF);
    export const GLYPH_EXPLODE_MAGICAL_OFF = (MAXEXPCHARS + GLYPH_EXPLODE_WET_OFF);
    export const GLYPH_EXPLODE_FIERY_OFF = (MAXEXPCHARS + GLYPH_EXPLODE_MAGICAL_OFF);
    export const GLYPH_EXPLODE_FROSTY_OFF = (MAXEXPCHARS + GLYPH_EXPLODE_FIERY_OFF);
    export const GLYPH_WARNING_OFF = (MAXEXPCHARS + GLYPH_EXPLODE_FROSTY_OFF);
    export const GLYPH_STATUE_OFF = (WARNCOUNT + GLYPH_WARNING_OFF);
    export const GLYPH_STATUE_MALE_OFF = GLYPH_STATUE_OFF;
    export const GLYPH_STATUE_FEM_OFF = (NUMMONS + GLYPH_STATUE_MALE_OFF);
    export const GLYPH_PILETOP_OFF = (NUMMONS + GLYPH_STATUE_FEM_OFF);
    export const GLYPH_OBJ_PILETOP_OFF = GLYPH_PILETOP_OFF;
    export const GLYPH_BODY_PILETOP_OFF = (NUM_OBJECTS + GLYPH_OBJ_PILETOP_OFF);
    export const GLYPH_STATUE_MALE_PILETOP_OFF = (NUMMONS + GLYPH_BODY_PILETOP_OFF);
    export const GLYPH_STATUE_FEM_PILETOP_OFF = (NUMMONS + GLYPH_STATUE_MALE_PILETOP_OFF);
    export const GLYPH_UNEXPLORED_OFF = (NUMMONS + GLYPH_STATUE_FEM_PILETOP_OFF);
    export const GLYPH_NOTHING_OFF = (GLYPH_UNEXPLORED_OFF + 1);
    export const MAX_GLYPH = GLYPH_NOTHING_OFF + 1;

export const NO_GLYPH = MAX_GLYPH;
export const GLYPH_INVISIBLE = GLYPH_INVIS_OFF;
export const GLYPH_UNEXPLORED = GLYPH_UNEXPLORED_OFF;
export const GLYPH_NOTHING = GLYPH_NOTHING_OFF;

export const GLYPH_TRAP_OFF = (GLYPH_CMAP_B_OFF + (S_arrow_trap - S_grave));

/* mgflags for altering map_glyphinfo() internal behavior */

export const MG_FLAG_NOOVERRIDE = 0x01;

/* Special mapped glyphflags encoded by reset_glyphmap() + map_glyphinfo() */
export const MG_HERO = 0x00001;
export const MG_CORPSE = 0x00002;
export const MG_INVIS = 0x00004;
export const MG_DETECT = 0x00008;
export const MG_PET = 0x00010;
export const MG_RIDDEN = 0x00020;
export const MG_STATUE = 0x00040;
export const MG_OBJPILE = 0x00080;
export const MG_BW_LAVA = 0x00100;

export const MG_BW_ICE = 0x00200;
export const MG_BW_SINK = 0x00200;

export const MG_BW_ENGR = 0x00200;
export const MG_NOTHING = 0x00400;
export const MG_UNEXPL = 0x00800;
export const MG_MALE = 0x01000;
export const MG_FEMALE = 0x02000;
export const MG_BADXY = 0x04000;

/* docrt(): re-draw whole screen; docrt_flags(): docrt() with more control */

    export const docrtRecalc = 0; /* full docrt(), recalculate what the map should show */
    export const docrtRefresh = 1; /* redraw_map(), draw what we think the map shows */
    export const docrtMapOnly = 2; /* ORed with Recalc or Refresh; draw the map but not
                       * status or perminv */
    export const docrtNocls = 4;

export const gbuf_entry = struct("gbuf_entry", {
    gnew: xint8, /* perhaps move this bit into the rm structure. */
    glyphinfo: "struct_glyphinfo",
});

/* If TILES_IN_GLYPHMAP is defined during build, this is defined
 * in the generated tile.c, complete with appropriate tile references in
 * the initialization.  Otherwise, it gets defined in display.c.
 */

import {
    CLR_BLACK, CLR_BLUE, CLR_BRIGHT_MAGENTA, CLR_BROWN, CLR_GRAY, CLR_GREEN, CLR_MAGENTA,
    CLR_ORANGE, CLR_RED, CLR_WHITE, CLR_YELLOW, HI_ZAP,
} from "./color.h.js";
import {
    S_arrow_trap, S_brdnladder, S_digbeam, S_goodpos, S_grave, S_ndoor, S_trwall, S_vwall,
} from "./defsym.h.js";
import { xint8 } from "./global.h.js";
import { NUMMONS } from "./monsters.h.js";
import { NUM_OBJECTS } from "./objects.h.js";
import { MAXEXPCHARS, MAXTCHARS, WARNCOUNT } from "./sym.h.js";
import { struct } from "../rt/struct.js";
