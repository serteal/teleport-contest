/* NetHack 5.0	drawing.c	$NHDT-Date: 1596498163 2020/08/03 23:42:43 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.78 $ */
/* Copyright (c) NetHack Development Team 1992.                   */
/* NetHack may be freely redistributed.  See license for details. */

/* Relevant header information in rm.h, objclass.h, sym.h, defsym.h. */

/* Default object class symbols.  See objclass.h.
 * {symbol, name, explain}
 *     name:    used in object_detect().
 *     explain: used in do_look().
 */
export const def_oc_syms = static_array("def_oc_syms", struct_class_sym, MAXOCLASSES, [
    { sym: ord('\0'), name: _(""), explain: _("") }, /* placeholder for the "random class" */

...def_oc_syms_records(),

]);

/* Default monster class symbols.  See sym.h and defsym.h. */
export const def_monsyms = static_array("def_monsyms", struct_class_sym, MAXMCLASSES, [
    { sym: ord('\0'), name: _(""), explain: _("") },

...def_monsyms_records(),

]);

export const def_warnsyms = static_array("def_warnsyms", struct_symdef, WARNCOUNT, [
    /* white warning  */
    { sym: ord('0'), explanation: _("unknown creature causing you worry"),    color: CLR_WHITE },
    /* pink warning   */
    { sym: ord('1'), explanation: _("unknown creature causing you concern"),  color: CLR_RED },
    /* red warning    */
    { sym: ord('2'), explanation: _("unknown creature causing you anxiety"),  color: CLR_RED },
    /* ruby warning   */
    { sym: ord('3'), explanation: _("unknown creature causing you disquiet"), color: CLR_RED },
    /* purple warning */
    { sym: ord('4'), explanation: _("unknown creature causing you alarm"),    color: CLR_MAGENTA },
    /* black warning  */
    { sym: ord('5'), explanation: _("unknown creature causing you dread"),    color: CLR_BRIGHT_MAGENTA },
]);

/*
 *  Default screen symbols with explanations and colors.
 *
 *  If adding to or removing from this list, please note that,
 *  for builds with tile support, there is an array called altlabels[] in
 *  win/share/tilemap.c that requires the same number of elements as
 *  this, in the same order. It is used for tile name matching when
 *  parsing other.txt because some of the useful tile names don't exist
 *  within NetHack itself.
 */
export const defsyms = static_array("defsyms", struct_symdef, MAXPCHARS + 1, [

...defsyms_records(),

    { sym: 0, explanation: 0, color: NO_COLOR }
]);

/* default rogue level symbols */
export const def_r_oc_syms = static_array("def_r_oc_syms", uchar, MAXOCLASSES, [
/* 0*/ ord('\0'), ILLOBJ_SYM, WEAPON_SYM, ord(']'), /* armor */
       RING_SYM,
/* 5*/ ord(','),                     /* amulet */
       TOOL_SYM, ord(':'),           /* food */
       POTION_SYM, SCROLL_SYM,
/*10*/ SPBOOK_SYM, WAND_SYM,
       GEM_SYM,                /* gold -- yes it's the same as gems */
       GEM_SYM, ROCK_SYM,
/*15*/ BALL_SYM, CHAIN_SYM, VENOM_SYM
]);

/*
 * Convert the given character to an object class.  If the character is not
 * recognized, then MAXOCLASSES is returned.  Used in detect.c, drawing.c,
 * invent.c, o_init.c, objnam.c, options.c, pickup.c, sp_lev.c, and
 * windows.c.
 */
export function def_char_to_objclass(ch) { /* int */
    let i;

    for (i = 1; i < MAXOCLASSES; i++)
        if (ch == def_oc_syms[i].sym)
            break;
    return i;
}

/*
 * Convert a character into a monster class.  This returns the _first_
 * match made.  If there are no matches, return MAXMCLASSES.
 * Used in detect.c, drawing.c, mondata.c, options.c, pickup.c,
 * sp_lev.c, and windows.c.
 */
export function def_char_to_monclass(ch) { /* int */
    let i;

    for (i = 1; i < MAXMCLASSES; i++)
        if (ch == def_monsyms[i].sym)
            break;
    return i;
}

/* does 'ch' represent a furniture character?  returns index into defsyms[] */
export function def_char_is_furniture(ch) { /* int */
    /* note: these refer to defsyms[] order which is much different from
       levl[][].typ order but both keep furniture in a contiguous block */
    let first_furniture = init_string(static_array("def_char_is_furniture.first_furniture", char, sizeof_string("stair")), _("stair"), true),
                      last_furniture = init_string(static_array("def_char_is_furniture.last_furniture", char, sizeof_string("fountain")), _("fountain"), true);
    let i;
    let furniture = FALSE;

    for (i = 0; i < MAXPCHARS; ++i) {
        if (!furniture) {
            if (!strncmp(defsyms[i].explanation, first_furniture, 5))
                furniture = TRUE;
        }
        if (furniture) {
            if (defsyms[i].sym == uchar(ch))
                return i;
            if (!strcmp(defsyms[i].explanation, last_furniture))
                break; /* reached last furniture */
        }
    }
    return -1;
}

/*drawing.c*/

import {
    CLR_BLACK, CLR_BLUE, CLR_BRIGHT_BLUE, CLR_BRIGHT_GREEN, CLR_BRIGHT_MAGENTA, CLR_BROWN, CLR_CYAN,
    CLR_GRAY, CLR_GREEN, CLR_MAGENTA, CLR_ORANGE, CLR_RED, CLR_WHITE, CLR_YELLOW, HI_GOLD, HI_METAL,
    HI_WOOD, HI_ZAP, NO_COLOR,
} from "./color.h.js";
import {
    AMULET_SYM, ARMOR_SYM, BALL_SYM, CHAIN_SYM, DEF_ANGEL, DEF_ANT, DEF_BAT, DEF_BLOB, DEF_CENTAUR,
    DEF_COCKATRICE, DEF_DEMON, DEF_DOG, DEF_DRAGON, DEF_EEL, DEF_ELEMENTAL, DEF_EYE, DEF_FELINE,
    DEF_FUNGUS, DEF_GHOST, DEF_GIANT, DEF_GNOME, DEF_GOLEM, DEF_GREMLIN, DEF_HUMAN, DEF_HUMANOID,
    DEF_IMP, DEF_INVISIBLE, DEF_JABBERWOCK, DEF_JELLY, DEF_KOBOLD, DEF_KOP, DEF_LEPRECHAUN,
    DEF_LICH, DEF_LIGHT, DEF_LIZARD, DEF_MIMIC, DEF_MIMIC_DEF, DEF_MUMMY, DEF_NAGA, DEF_NYMPH,
    DEF_OGRE, DEF_ORC, DEF_PIERCER, DEF_PUDDING, DEF_QUADRUPED, DEF_QUANTMECH, DEF_RODENT,
    DEF_RUSTMONST, DEF_SNAKE, DEF_SPIDER, DEF_TRAPPER, DEF_TROLL, DEF_UMBER, DEF_UNICORN,
    DEF_VAMPIRE, DEF_VORTEX, DEF_WORM, DEF_WORM_TAIL, DEF_WRAITH, DEF_XAN, DEF_XORN, DEF_YETI,
    DEF_ZOMBIE, DEF_ZRUTY, FOOD_SYM, GEM_SYM, GOLD_SYM, ILLOBJ_SYM, MAXMCLASSES, MAXOCLASSES,
    MAXPCHARS, POTION_SYM, RING_SYM, ROCK_SYM, SCROLL_SYM, SPBOOK_SYM, TOOL_SYM, VENOM_SYM,
    WAND_SYM, WEAPON_SYM,
} from "./defsym.h.js";
import { FALSE, TRUE } from "./global.h.js";
import { struct_class_sym } from "./objclass.h.js";
import { WARNCOUNT, struct_symdef } from "./sym.h.js";
import { char, ord, sizeof_string, uchar } from "../rt/ctypes.js";
import { strcmp, strncmp } from "../rt/libc.js";
import { init_string, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";

// the records of def_oc_syms[] from defsym.h, laid out like it
function def_oc_syms_records() {
    return [
    { sym: ILLOBJ_SYM, name: _("illegal objects"),
                                              explain: _("strange object") },
    { sym: WEAPON_SYM, name: _("weapons"), explain: _("weapon") },
    { sym: ARMOR_SYM, name: _("armor"), explain: _("suit or piece of armor") },
    { sym: RING_SYM, name: _("rings"), explain: _("ring") },
    { sym: AMULET_SYM, name: _("amulets"), explain: _("amulet") },
    { sym: TOOL_SYM, name: _("tools"),
                                       explain: _("useful item (pick-axe, key, lamp...)") },
    { sym: FOOD_SYM, name: _("food"), explain: _("piece of food") },
    { sym: POTION_SYM, name: _("potions"), explain: _("potion") },
    { sym: SCROLL_SYM, name: _("scrolls"), explain: _("scroll") },
    { sym: SPBOOK_SYM, name: _("spellbooks"), explain: _("spellbook") },
    { sym: WAND_SYM, name: _("wands"), explain: _("wand") },
    { sym: GOLD_SYM, name: _("coins"), explain: _("pile of coins") },
    { sym: GEM_SYM, name: _("rocks"), explain: _("gem or rock") },
    { sym: ROCK_SYM, name: _("large stones"), explain: _("boulder or statue") },
    { sym: BALL_SYM, name: _("iron balls"), explain: _("iron ball") },
    { sym: CHAIN_SYM, name: _("chains"), explain: _("iron chain") },
    { sym: VENOM_SYM, name: _("venoms"), explain: _("splash of venom") },
    ];
}

// the records of def_monsyms[] from defsym.h, laid out like it
function def_monsyms_records() {
    return [
    { sym: DEF_ANT, name: _(""), explain: _("ant or other insect") },
    { sym: DEF_BLOB, name: _(""), explain: _("blob") },
    { sym: DEF_COCKATRICE, name: _(""), explain: _("cockatrice") },
    { sym: DEF_DOG, name: _(""), explain: _("dog or other canine") },
    { sym: DEF_EYE, name: _(""), explain: _("eye or sphere") },
    { sym: DEF_FELINE, name: _(""), explain: _("cat or other feline") },
    { sym: DEF_GREMLIN, name: _(""), explain: _("gremlin") },

    { sym: DEF_HUMANOID, name: _(""), explain: _("humanoid") },

    { sym: DEF_IMP, name: _(""), explain: _("imp or minor demon") },
    { sym: DEF_JELLY, name: _(""), explain: _("jelly") },
    { sym: DEF_KOBOLD, name: _(""), explain: _("kobold") },
    { sym: DEF_LEPRECHAUN, name: _(""), explain: _("leprechaun") },
    { sym: DEF_MIMIC, name: _(""), explain: _("mimic") },
    { sym: DEF_NYMPH, name: _(""), explain: _("nymph") },
    { sym: DEF_ORC, name: _(""), explain: _("orc") },
    { sym: DEF_PIERCER, name: _(""), explain: _("piercer") },

    { sym: DEF_QUADRUPED, name: _(""), explain: _("quadruped") },
    { sym: DEF_RODENT, name: _(""), explain: _("rodent") },
    { sym: DEF_SPIDER, name: _(""), explain: _("arachnid or centipede") },
    { sym: DEF_TRAPPER, name: _(""), explain: _("trapper or lurker above") },

    { sym: DEF_UNICORN, name: _(""), explain: _("unicorn or horse") },
    { sym: DEF_VORTEX, name: _(""), explain: _("vortex") },
    { sym: DEF_WORM, name: _(""), explain: _("worm") },
    { sym: DEF_XAN, name: _(""), explain: _("xan or other mythical/fantastic insect") },

    { sym: DEF_LIGHT, name: _(""), explain: _("light") },
    { sym: DEF_ZRUTY, name: _(""), explain: _("zruty") },
    { sym: DEF_ANGEL, name: _(""), explain: _("angelic being") },
    { sym: DEF_BAT, name: _(""), explain: _("bat or bird") },
    { sym: DEF_CENTAUR, name: _(""), explain: _("centaur") },
    { sym: DEF_DRAGON, name: _(""), explain: _("dragon") },

    { sym: DEF_ELEMENTAL, name: _(""), explain: _("elemental") },
    { sym: DEF_FUNGUS, name: _(""), explain: _("fungus or mold") },
    { sym: DEF_GNOME, name: _(""), explain: _("gnome") },

    { sym: DEF_GIANT, name: _(""), explain: _("giant humanoid") },
    { sym: DEF_INVISIBLE, name: _(""), explain: _("invisible monster") },
    { sym: DEF_JABBERWOCK, name: _(""), explain: _("jabberwock") },
    { sym: DEF_KOP, name: _(""), explain: _("Keystone Kop") },
    { sym: DEF_LICH, name: _(""), explain: _("lich") },
    { sym: DEF_MUMMY, name: _(""), explain: _("mummy") },
    { sym: DEF_NAGA, name: _(""), explain: _("naga") },
    { sym: DEF_OGRE, name: _(""), explain: _("ogre") },
    { sym: DEF_PUDDING, name: _(""), explain: _("pudding or ooze") },
    { sym: DEF_QUANTMECH, name: _(""), explain: _("quantum mechanic") },
    { sym: DEF_RUSTMONST, name: _(""), explain: _("rust monster or disenchanter") },
    { sym: DEF_SNAKE, name: _(""), explain: _("snake") },
    { sym: DEF_TROLL, name: _(""), explain: _("troll") },

    { sym: DEF_UMBER, name: _(""), explain: _("umber hulk") },
    { sym: DEF_VAMPIRE, name: _(""), explain: _("vampire") },
    { sym: DEF_WRAITH, name: _(""), explain: _("wraith") },
    { sym: DEF_XORN, name: _(""), explain: _("xorn") },

    { sym: DEF_YETI, name: _(""), explain: _("apelike creature") },
    { sym: DEF_ZOMBIE, name: _(""), explain: _("zombie") },
    { sym: DEF_HUMAN, name: _(""), explain: _("human or elf") },

    { sym: DEF_GHOST, name: _(""), explain: _("ghost") },
    { sym: DEF_GOLEM, name: _(""), explain: _("golem") },
    { sym: DEF_DEMON, name: _(""), explain: _("major demon") },

    { sym: DEF_EEL, name: _(""), explain: _("sea monster") },

    { sym: DEF_LIZARD, name: _(""), explain: _("lizard") },
    { sym: DEF_WORM_TAIL, name: _(""), explain: _("long worm tail") },
    { sym: DEF_MIMIC_DEF, name: _(""), explain: _("mimic") },
    ];
}

// the records of defsyms[] from defsym.h, laid out like it
function defsyms_records() {
    return [
    { sym: ord(" "), explanation: _("stone"), color: NO_COLOR },
    { sym: ord("|"), explanation: _("wall"), color: CLR_GRAY },
    { sym: ord("-"), explanation: _("wall"), color: CLR_GRAY },
    { sym: ord("-"), explanation: _("wall"), color: CLR_GRAY },
    { sym: ord("-"), explanation: _("wall"), color: CLR_GRAY },
    { sym: ord("-"), explanation: _("wall"), color: CLR_GRAY },
    { sym: ord("-"), explanation: _("wall"), color: CLR_GRAY },
    { sym: ord("-"), explanation: _("wall"), color: CLR_GRAY },
    { sym: ord("-"), explanation: _("wall"), color: CLR_GRAY },
    { sym: ord("-"), explanation: _("wall"), color: CLR_GRAY },
    { sym: ord("|"), explanation: _("wall"), color: CLR_GRAY },
    { sym: ord("|"), explanation: _("wall"), color: CLR_GRAY },

    { sym: ord("."), explanation: _("doorway"), color: CLR_GRAY },
    { sym: ord("-"), explanation: _("open door"), color: CLR_BROWN },
    { sym: ord("|"), explanation: _("open door"), color: CLR_BROWN },
    { sym: ord("+"),
                               explanation: _("closed door"), color: CLR_BROWN },
    { sym: ord("+"),
                               explanation: _("closed door"), color: CLR_BROWN },
    { sym: ord("#"), explanation: _("iron bars"), color: HI_METAL },
    { sym: ord("#"), explanation: _("tree"), color: CLR_GREEN },
    { sym: ord("."), explanation: _("floor of a room"), color: CLR_GRAY },
    { sym: ord("."), explanation: _("dark part of a room"), color: CLR_BLACK },
    { sym: ord("`"), explanation: _("engraving"),
                                color: CLR_BRIGHT_BLUE },
    { sym: ord("#"), explanation: _("corridor"), color: CLR_GRAY },
    { sym: ord("#"), explanation: _("lit corridor"), color: CLR_GRAY },
    { sym: ord("#"), explanation: _("engraving"),
                                 color: CLR_BRIGHT_BLUE },
    { sym: ord("<"), explanation: _("staircase up"), color: CLR_GRAY },
    { sym: ord(">"), explanation: _("staircase down"), color: CLR_GRAY },
    { sym: ord("<"), explanation: _("ladder up"), color: CLR_BROWN },
    { sym: ord(">"), explanation: _("ladder down"), color: CLR_BROWN },
    { sym: ord("<"), explanation: _("branch staircase up"), color: CLR_YELLOW },
    { sym: ord(">"), explanation: _("branch staircase down"), color: CLR_YELLOW },
    { sym: ord("<"), explanation: _("branch ladder up"), color: CLR_YELLOW },
    { sym: ord(">"), explanation: _("branch ladder down"), color: CLR_YELLOW },

    { sym: ord("_"), explanation: _("altar"), color: CLR_GRAY },

    { sym: ord("|"), explanation: _("grave"), color: CLR_WHITE },
    { sym: ord("\\"), explanation: _("opulent throne"), color: HI_GOLD },
    { sym: ord("{"), explanation: _("sink"), color: CLR_WHITE },
    { sym: ord("{"), explanation: _("fountain"), color: CLR_BRIGHT_BLUE },

    { sym: ord("}"), explanation: _("water"), color: CLR_BLUE },
    { sym: ord("."), explanation: _("ice"), color: CLR_CYAN },
    { sym: ord("}"), explanation: _("molten lava"), color: CLR_RED },
    { sym: ord("}"), explanation: _("wall of lava"), color: CLR_ORANGE },
    { sym: ord("."),
                                  explanation: _("lowered drawbridge"), color: CLR_BROWN },
    { sym: ord("."),
                                  explanation: _("lowered drawbridge"), color: CLR_BROWN },
    { sym: ord("#"),
                                  explanation: _("raised drawbridge"), color: CLR_BROWN },
    { sym: ord("#"),
                                  explanation: _("raised drawbridge"), color: CLR_BROWN },
    { sym: ord(" "), explanation: _("air"), color: CLR_CYAN },
    { sym: ord("#"), explanation: _("cloud"), color: CLR_GRAY },

    { sym: ord("}"), explanation: _("water"), color: CLR_BRIGHT_BLUE },

    { sym: ord("^"), explanation: _("arrow trap"), color: HI_METAL },
    { sym: ord("^"), explanation: _("dart trap"), color: HI_METAL },
    { sym: ord("^"), explanation: _("falling rock trap"), color: CLR_GRAY },
    { sym: ord("^"), explanation: _("squeaky board"), color: CLR_BROWN },
    { sym: ord("^"), explanation: _("bear trap"), color: HI_METAL },
    { sym: ord("^"), explanation: _("land mine"), color: CLR_RED },
    { sym: ord("^"), explanation: _("rolling boulder trap"), color: CLR_GRAY },
    { sym: ord("^"), explanation: _("sleeping gas trap"), color: HI_ZAP },
    { sym: ord("^"), explanation: _("rust trap"), color: CLR_BLUE },
    { sym: ord("^"), explanation: _("fire trap"), color: CLR_ORANGE },
    { sym: ord("^"), explanation: _("pit"), color: CLR_BLACK },
    { sym: ord("^"), explanation: _("spiked pit"), color: CLR_BLACK },
    { sym: ord("^"), explanation: _("hole"), color: CLR_BROWN },
    { sym: ord("^"), explanation: _("trap door"), color: CLR_BROWN },
    { sym: ord("^"), explanation: _("teleportation trap"), color: CLR_MAGENTA },
    { sym: ord("^"), explanation: _("level teleporter"), color: CLR_MAGENTA },
    { sym: ord("^"), explanation: _("magic portal"), color: CLR_BRIGHT_MAGENTA },
    { sym: ord("\""), explanation: _("web"), color: CLR_GRAY },
    { sym: ord("^"), explanation: _("statue trap"), color: CLR_GRAY },
    { sym: ord("^"), explanation: _("magic trap"), color: HI_ZAP },
    { sym: ord("^"), explanation: _("anti-magic field"),
                                        color: HI_ZAP },
    { sym: ord("^"), explanation: _("polymorph trap"), color: CLR_BRIGHT_GREEN },
    { sym: ord("~"), explanation: _("vibrating square"), color: CLR_MAGENTA },
    { sym: ord("^"), explanation: _("trapped door"), color: CLR_ORANGE },
    { sym: ord("^"), explanation: _("trapped chest"), color: CLR_ORANGE },

    { sym: ord("|"), explanation: _(""), color: CLR_GRAY },
    { sym: ord("-"), explanation: _(""), color: CLR_GRAY },
    { sym: ord("\\"), explanation: _(""), color: CLR_GRAY },
    { sym: ord("/"), explanation: _(""), color: CLR_GRAY },

    { sym: ord("*"), explanation: _(""), color: CLR_WHITE },
    { sym: ord("!"), explanation: _(""), color: CLR_WHITE },
    { sym: ord(")"), explanation: _(""), color: HI_WOOD },
    { sym: ord("("), explanation: _(""), color: HI_WOOD },

    { sym: ord("0"), explanation: _(""), color: HI_ZAP },
    { sym: ord("#"), explanation: _(""), color: HI_ZAP },
    { sym: ord("@"), explanation: _(""), color: HI_ZAP },
    { sym: ord("*"), explanation: _(""), color: HI_ZAP },
    { sym: ord("#"), explanation: _("poison cloud"), color: CLR_BRIGHT_GREEN },

    { sym: ord("$"), explanation: _("valid position"), color: HI_ZAP },

    { sym: ord("/"), explanation: _(""), color: CLR_GREEN },
    { sym: ord("-"), explanation: _(""), color: CLR_GREEN },
    { sym: ord("\\"), explanation: _(""), color: CLR_GREEN },
    { sym: ord("|"), explanation: _(""), color: CLR_GREEN },
    { sym: ord("|"), explanation: _(""), color: CLR_GREEN },
    { sym: ord("\\"), explanation: _(""), color: CLR_GREEN },
    { sym: ord("-"), explanation: _(""), color: CLR_GREEN },
    { sym: ord("/"), explanation: _(""), color: CLR_GREEN },

    { sym: ord("/"), explanation: _(""), color: CLR_ORANGE },
    { sym: ord("-"), explanation: _(""), color: CLR_ORANGE },
    { sym: ord("\\"), explanation: _(""), color: CLR_ORANGE },
    { sym: ord("|"), explanation: _(""), color: CLR_ORANGE },
    { sym: ord(" "), explanation: _(""), color: CLR_ORANGE },
    { sym: ord("|"), explanation: _(""), color: CLR_ORANGE },
    { sym: ord("\\"), explanation: _(""), color: CLR_ORANGE },
    { sym: ord("-"), explanation: _(""), color: CLR_ORANGE },
    { sym: ord("/"), explanation: _(""), color: CLR_ORANGE },
    ];
}
