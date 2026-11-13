/* NetHack 5.0	u_init.c	$NHDT-Date: 1769398807 2026/01/25 19:40:07 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.121 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2017. */
/* NetHack may be freely redistributed.  See license for details. */

const struct_trobj = struct("struct_trobj", {
    trotyp: short,
    trspe: schar,
    trclass: char,
    trquan_min: char,
    trquan_max: char,
    trbless: char,
});

export const UNDEF_TYP = 0;
export const UNDEF_SPE = ord('\x7f');
export const UNDEF_BLESS = 2;

/*
 *      Initial inventory for the various roles.
 */

const Archeologist = static_array("Archeologist", struct_trobj, null, [
    /* if adventure has a name...  idea from tan@uvm-gen */
    { trotyp: BULLWHIP, trspe: 2, trclass: WEAPON_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: LEATHER_JACKET, trspe: 0, trclass: ARMOR_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: FEDORA, trspe: 0, trclass: ARMOR_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: FOOD_RATION, trspe: 0, trclass: FOOD_CLASS, trquan_min: 3, trquan_max: 3, trbless: 0 },
    { trotyp: PICK_AXE, trspe: UNDEF_SPE, trclass: TOOL_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: TINNING_KIT, trspe: UNDEF_SPE, trclass: TOOL_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: TOUCHSTONE, trspe: 0, trclass: GEM_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
    { trotyp: SACK, trspe: 0, trclass: TOOL_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
    { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 }
]);
const Barbarian_0 = static_array("Barbarian_0", struct_trobj, null, [
    { trotyp: TWO_HANDED_SWORD, trspe: 0, trclass: WEAPON_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: AXE, trspe: 0, trclass: WEAPON_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: RING_MAIL, trspe: 0, trclass: ARMOR_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: FOOD_RATION, trspe: 0, trclass: FOOD_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
    { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 }
]);
const Barbarian_1 = static_array("Barbarian_1", struct_trobj, null, [
    { trotyp: BATTLE_AXE, trspe: 0, trclass: WEAPON_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: SHORT_SWORD, trspe: 0, trclass: WEAPON_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: RING_MAIL, trspe: 0, trclass: ARMOR_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: FOOD_RATION, trspe: 0, trclass: FOOD_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
    { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 }
]);
const Cave_man = static_array("Cave_man", struct_trobj, null, [
    { trotyp: CLUB, trspe: 1, trclass: WEAPON_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: SLING, trspe: 2, trclass: WEAPON_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: FLINT, trspe: 0, trclass: GEM_CLASS, trquan_min: 10, trquan_max: 20, trbless: UNDEF_BLESS },
    { trotyp: ROCK, trspe: 0, trclass: GEM_CLASS, trquan_min: 3, trquan_max: 3, trbless: 0 }, /* yields 18..33 */
    { trotyp: LEATHER_ARMOR, trspe: 0, trclass: ARMOR_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 }
]);
const Healer = static_array("Healer", struct_trobj, null, [
    { trotyp: SCALPEL, trspe: 0, trclass: WEAPON_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: LEATHER_GLOVES, trspe: 1, trclass: ARMOR_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: STETHOSCOPE, trspe: 0, trclass: TOOL_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
    { trotyp: POT_HEALING, trspe: 0, trclass: POTION_CLASS, trquan_min: 4, trquan_max: 4, trbless: UNDEF_BLESS },
    { trotyp: POT_EXTRA_HEALING, trspe: 0, trclass: POTION_CLASS, trquan_min: 4, trquan_max: 4, trbless: UNDEF_BLESS },
    { trotyp: WAN_SLEEP, trspe: UNDEF_SPE, trclass: WAND_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    /* always blessed, so it's guaranteed readable */
    { trotyp: SPE_HEALING, trspe: 0, trclass: SPBOOK_CLASS, trquan_min: 1, trquan_max: 1, trbless: 1 },
    { trotyp: SPE_EXTRA_HEALING, trspe: 0, trclass: SPBOOK_CLASS, trquan_min: 1, trquan_max: 1, trbless: 1 },
    { trotyp: SPE_STONE_TO_FLESH, trspe: 0, trclass: SPBOOK_CLASS, trquan_min: 1, trquan_max: 1, trbless: 1 },
    { trotyp: APPLE, trspe: 0, trclass: FOOD_CLASS, trquan_min: 5, trquan_max: 5, trbless: 0 },
    { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 }
]);
const Knight = static_array("Knight", struct_trobj, null, [
    { trotyp: LONG_SWORD, trspe: 1, trclass: WEAPON_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: LANCE, trspe: 1, trclass: WEAPON_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: RING_MAIL, trspe: 1, trclass: ARMOR_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: HELMET, trspe: 0, trclass: ARMOR_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: SMALL_SHIELD, trspe: 0, trclass: ARMOR_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: LEATHER_GLOVES, trspe: 0, trclass: ARMOR_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: APPLE, trspe: 0, trclass: FOOD_CLASS, trquan_min: 10, trquan_max: 10, trbless: 0 },
    { trotyp: CARROT, trspe: 0, trclass: FOOD_CLASS, trquan_min: 10, trquan_max: 10, trbless: 0 },
    { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 }
]);
const Monk = static_array("Monk", struct_trobj, null, [
    { trotyp: LEATHER_GLOVES, trspe: 2, trclass: ARMOR_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: ROBE, trspe: 1, trclass: ARMOR_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: UNDEF_TYP, trspe: UNDEF_SPE, trclass: SCROLL_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: POT_HEALING, trspe: 0, trclass: POTION_CLASS, trquan_min: 3, trquan_max: 3, trbless: UNDEF_BLESS },
    { trotyp: FOOD_RATION, trspe: 0, trclass: FOOD_CLASS, trquan_min: 3, trquan_max: 3, trbless: 0 },
    { trotyp: APPLE, trspe: 0, trclass: FOOD_CLASS, trquan_min: 5, trquan_max: 5, trbless: UNDEF_BLESS },
    { trotyp: ORANGE, trspe: 0, trclass: FOOD_CLASS, trquan_min: 5, trquan_max: 5, trbless: UNDEF_BLESS },
    /* Yes, we know fortune cookies aren't really from China.  They were
       invented by George Jung in Los Angeles, California, USA in 1916. */
    { trotyp: FORTUNE_COOKIE, trspe: 0, trclass: FOOD_CLASS, trquan_min: 3, trquan_max: 3, trbless: UNDEF_BLESS },
    { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 }
]);
const Priest = static_array("Priest", struct_trobj, null, [
    { trotyp: MACE, trspe: 1, trclass: WEAPON_CLASS, trquan_min: 1, trquan_max: 1, trbless: 1 },
    { trotyp: ROBE, trspe: 0, trclass: ARMOR_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: SMALL_SHIELD, trspe: 0, trclass: ARMOR_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: POT_WATER, trspe: 0, trclass: POTION_CLASS, trquan_min: 4, trquan_max: 4, trbless: 1 }, /* holy water */
    { trotyp: CLOVE_OF_GARLIC, trspe: 0, trclass: FOOD_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
    { trotyp: SPRIG_OF_WOLFSBANE, trspe: 0, trclass: FOOD_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
    { trotyp: UNDEF_TYP, trspe: UNDEF_SPE, trclass: SPBOOK_CLASS, trquan_min: 2, trquan_max: 2, trbless: UNDEF_BLESS },
    { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 }
]);
const Ranger = static_array("Ranger", struct_trobj, null, [
    { trotyp: DAGGER, trspe: 1, trclass: WEAPON_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: BOW, trspe: 1, trclass: WEAPON_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: ARROW, trspe: 2, trclass: WEAPON_CLASS, trquan_min: 50, trquan_max: 59, trbless: UNDEF_BLESS },
    { trotyp: ARROW, trspe: 0, trclass: WEAPON_CLASS, trquan_min: 30, trquan_max: 39, trbless: UNDEF_BLESS },
    { trotyp: CLOAK_OF_DISPLACEMENT, trspe: 2, trclass: ARMOR_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: CRAM_RATION, trspe: 0, trclass: FOOD_CLASS, trquan_min: 4, trquan_max: 4, trbless: 0 },
    { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 }
]);
const Rogue = static_array("Rogue", struct_trobj, null, [
    { trotyp: SHORT_SWORD, trspe: 0, trclass: WEAPON_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: DAGGER, trspe: 0, trclass: WEAPON_CLASS, trquan_min: 6, trquan_max: 15, trbless: 0 },
    { trotyp: LEATHER_ARMOR, trspe: 1, trclass: ARMOR_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: POT_SICKNESS, trspe: 0, trclass: POTION_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
    { trotyp: LOCK_PICK, trspe: 0, trclass: TOOL_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
    { trotyp: SACK, trspe: 0, trclass: TOOL_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
    { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 }
]);
const Samurai = static_array("Samurai", struct_trobj, null, [
    { trotyp: KATANA, trspe: 0, trclass: WEAPON_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: SHORT_SWORD, trspe: 0, trclass: WEAPON_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS }, /* wakizashi */
    { trotyp: YUMI, trspe: 0, trclass: WEAPON_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: YA, trspe: 0, trclass: WEAPON_CLASS, trquan_min: 26, trquan_max: 45, trbless: UNDEF_BLESS },
    { trotyp: SPLINT_MAIL, trspe: 0, trclass: ARMOR_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 }
]);
const Tourist = static_array("Tourist", struct_trobj, null, [
    { trotyp: DART, trspe: 2, trclass: WEAPON_CLASS, trquan_min: 21, trquan_max: 40, trbless: UNDEF_BLESS },
    { trotyp: UNDEF_TYP, trspe: UNDEF_SPE, trclass: FOOD_CLASS, trquan_min: 10, trquan_max: 10, trbless: 0 },
    { trotyp: POT_EXTRA_HEALING, trspe: 0, trclass: POTION_CLASS, trquan_min: 2, trquan_max: 2, trbless: UNDEF_BLESS },
    { trotyp: SCR_MAGIC_MAPPING, trspe: 0, trclass: SCROLL_CLASS, trquan_min: 4, trquan_max: 4, trbless: UNDEF_BLESS },
    { trotyp: HAWAIIAN_SHIRT, trspe: 0, trclass: ARMOR_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: EXPENSIVE_CAMERA, trspe: UNDEF_SPE, trclass: TOOL_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
    { trotyp: CREDIT_CARD, trspe: 0, trclass: TOOL_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
    { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 }
]);
const Valkyrie = static_array("Valkyrie", struct_trobj, null, [
    { trotyp: SPEAR, trspe: 1, trclass: WEAPON_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: DAGGER, trspe: 0, trclass: WEAPON_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: SMALL_SHIELD, trspe: 3, trclass: ARMOR_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: FOOD_RATION, trspe: 0, trclass: FOOD_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
    { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 }
]);
const Wizard = static_array("Wizard", struct_trobj, null, [
    { trotyp: QUARTERSTAFF, trspe: 1, trclass: WEAPON_CLASS, trquan_min: 1, trquan_max: 1, trbless: 1 },
    { trotyp: CLOAK_OF_MAGIC_RESISTANCE, trspe: 0, trclass: ARMOR_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: UNDEF_TYP, trspe: UNDEF_SPE, trclass: WAND_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: UNDEF_TYP, trspe: UNDEF_SPE, trclass: RING_CLASS, trquan_min: 2, trquan_max: 2, trbless: UNDEF_BLESS },
    { trotyp: UNDEF_TYP, trspe: UNDEF_SPE, trclass: POTION_CLASS, trquan_min: 3, trquan_max: 3, trbless: UNDEF_BLESS },
    { trotyp: UNDEF_TYP, trspe: UNDEF_SPE, trclass: SCROLL_CLASS, trquan_min: 3, trquan_max: 3, trbless: UNDEF_BLESS },
    { trotyp: SPE_FORCE_BOLT, trspe: 0, trclass: SPBOOK_CLASS, trquan_min: 1, trquan_max: 1, trbless: 1 },
    { trotyp: UNDEF_TYP, trspe: UNDEF_SPE, trclass: SPBOOK_CLASS, trquan_min: 1, trquan_max: 1, trbless: UNDEF_BLESS },
    { trotyp: MAGIC_MARKER, trspe: 19, trclass: TOOL_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 }, /* actually spe = 18 + d4 */
    { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 }
]);

/*
 *      Optional extra inventory items.
 */

const Healing_book = static_array("Healing_book", struct_trobj, null, [ { trotyp: SPE_HEALING, trspe: UNDEF_SPE, trclass: SPBOOK_CLASS, trquan_min: 1, trquan_max: 1, trbless: 1 },
      { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 } ]);

const Protection_book = static_array("Protection_book", struct_trobj, null, [ { trotyp: SPE_PROTECTION, trspe: UNDEF_SPE, trclass: SPBOOK_CLASS, trquan_min: 1, trquan_max: 1, trbless: 1 },
      { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 } ]);

const Confuse_monster_book = static_array("Confuse_monster_book", struct_trobj, null, [ { trotyp: SPE_CONFUSE_MONSTER, trspe: UNDEF_SPE, trclass: SPBOOK_CLASS, trquan_min: 1, trquan_max: 1, trbless: 1 },
      { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 } ]);

const Tinopener = static_array("Tinopener", struct_trobj, null, [ { trotyp: TIN_OPENER, trspe: 0, trclass: TOOL_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
      { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 } ]);

const Magicmarker = static_array("Magicmarker", struct_trobj, null, [ { trotyp: MAGIC_MARKER, trspe: 19, trclass: TOOL_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
      { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 } ]);

const Lamp = static_array("Lamp", struct_trobj, null, [ { trotyp: OIL_LAMP, trspe: 1, trclass: TOOL_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
      { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 } ]);

const Blindfold = static_array("Blindfold", struct_trobj, null, [ { trotyp: BLINDFOLD, trspe: 0, trclass: TOOL_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
      { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 } ]);

const Xtra_food = static_array("Xtra_food", struct_trobj, null, [ { trotyp: UNDEF_TYP, trspe: UNDEF_SPE, trclass: FOOD_CLASS, trquan_min: 2, trquan_max: 2, trbless: 0},
      { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 } ]);

const Leash = static_array("Leash", struct_trobj, null, [ { trotyp: LEASH, trspe: 0, trclass: TOOL_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
      { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 } ]);

const Towel = static_array("Towel", struct_trobj, null, [ { trotyp: TOWEL, trspe: 0, trclass: TOOL_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
      { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 } ]);

const Wishing = static_array("Wishing", struct_trobj, null, [ { trotyp: WAN_WISHING, trspe: 3, trclass: WAND_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
      { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 } ]);

const Money = static_array("Money", struct_trobj, null, [ { trotyp: GOLD_PIECE, trspe: 0, trclass: COIN_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
      { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 } ]);

/* race-based substitutions for initial inventory;
   the weaker cloak for elven rangers is intentional--they shoot better */
  const struct_inv_sub = struct("struct_inv_sub", {
    race_pm: short, item_otyp: short, subs_otyp: short,
}); const inv_subs = static_array("inv_subs", struct_inv_sub, null, [
    { race_pm: PM_ELF, item_otyp: DAGGER, subs_otyp: ELVEN_DAGGER },
    { race_pm: PM_ELF, item_otyp: SPEAR, subs_otyp: ELVEN_SPEAR },
    { race_pm: PM_ELF, item_otyp: SHORT_SWORD, subs_otyp: ELVEN_SHORT_SWORD },
    { race_pm: PM_ELF, item_otyp: BOW, subs_otyp: ELVEN_BOW },
    { race_pm: PM_ELF, item_otyp: ARROW, subs_otyp: ELVEN_ARROW },
    { race_pm: PM_ELF, item_otyp: HELMET, subs_otyp: ELVEN_LEATHER_HELM },
    /* { PM_ELF, SMALL_SHIELD, ELVEN_SHIELD }, */
    { race_pm: PM_ELF, item_otyp: CLOAK_OF_DISPLACEMENT, subs_otyp: ELVEN_CLOAK },
    { race_pm: PM_ELF, item_otyp: CRAM_RATION, subs_otyp: LEMBAS_WAFER },
    { race_pm: PM_ORC, item_otyp: DAGGER, subs_otyp: ORCISH_DAGGER },
    { race_pm: PM_ORC, item_otyp: SPEAR, subs_otyp: ORCISH_SPEAR },
    { race_pm: PM_ORC, item_otyp: SHORT_SWORD, subs_otyp: ORCISH_SHORT_SWORD },
    { race_pm: PM_ORC, item_otyp: BOW, subs_otyp: ORCISH_BOW },
    { race_pm: PM_ORC, item_otyp: ARROW, subs_otyp: ORCISH_ARROW },
    { race_pm: PM_ORC, item_otyp: HELMET, subs_otyp: ORCISH_HELM },
    { race_pm: PM_ORC, item_otyp: SMALL_SHIELD, subs_otyp: ORCISH_SHIELD },
    { race_pm: PM_ORC, item_otyp: RING_MAIL, subs_otyp: ORCISH_RING_MAIL },
    { race_pm: PM_ORC, item_otyp: CHAIN_MAIL, subs_otyp: ORCISH_CHAIN_MAIL },
    { race_pm: PM_ORC, item_otyp: CRAM_RATION, subs_otyp: TRIPE_RATION },
    { race_pm: PM_ORC, item_otyp: LEMBAS_WAFER, subs_otyp: TRIPE_RATION },
    { race_pm: PM_DWARF, item_otyp: SPEAR, subs_otyp: DWARVISH_SPEAR },
    { race_pm: PM_DWARF, item_otyp: SHORT_SWORD, subs_otyp: DWARVISH_SHORT_SWORD },
    { race_pm: PM_DWARF, item_otyp: HELMET, subs_otyp: DWARVISH_IRON_HELM },
    /* { PM_DWARF, SMALL_SHIELD, DWARVISH_ROUNDSHIELD }, */
    /* { PM_DWARF, PICK_AXE, DWARVISH_MATTOCK }, */
    { race_pm: PM_DWARF, item_otyp: LEMBAS_WAFER, subs_otyp: CRAM_RATION },
    { race_pm: PM_GNOME, item_otyp: BOW, subs_otyp: CROSSBOW },
    { race_pm: PM_GNOME, item_otyp: ARROW, subs_otyp: CROSSBOW_BOLT },
    { race_pm: NON_PM, item_otyp: STRANGE_OBJECT, subs_otyp: STRANGE_OBJECT }
]);

const Skill_A = static_array("Skill_A", struct_def_skill, null, [
    { skill: P_DAGGER, skmax: P_BASIC },
    { skill: P_KNIFE, skmax: P_BASIC },
    { skill: P_PICK_AXE, skmax: P_EXPERT },
    { skill: P_SHORT_SWORD, skmax: P_BASIC },
    { skill: P_SABER, skmax: P_EXPERT },
    { skill: P_CLUB, skmax: P_SKILLED },
    { skill: P_QUARTERSTAFF, skmax: P_SKILLED },
    { skill: P_SLING, skmax: P_SKILLED },
    { skill: P_DART, skmax: P_BASIC },
    { skill: P_BOOMERANG, skmax: P_EXPERT },
    { skill: P_WHIP, skmax: P_EXPERT },
    { skill: P_UNICORN_HORN, skmax: P_SKILLED },
    { skill: P_ATTACK_SPELL, skmax: P_BASIC },
    { skill: P_HEALING_SPELL, skmax: P_BASIC },
    { skill: P_DIVINATION_SPELL, skmax: P_EXPERT },
    { skill: P_MATTER_SPELL, skmax: P_BASIC },
    { skill: P_RIDING, skmax: P_BASIC },
    { skill: P_TWO_WEAPON_COMBAT, skmax: P_BASIC },
    { skill: P_BARE_HANDED_COMBAT, skmax: P_EXPERT },
    { skill: P_NONE, skmax: 0 }
]);
const Skill_B = static_array("Skill_B", struct_def_skill, null, [
    { skill: P_DAGGER, skmax: P_BASIC },
    { skill: P_AXE, skmax: P_EXPERT },
    { skill: P_PICK_AXE, skmax: P_SKILLED },
    { skill: P_SHORT_SWORD, skmax: P_EXPERT },
    { skill: P_BROAD_SWORD, skmax: P_SKILLED },
    { skill: P_LONG_SWORD, skmax: P_SKILLED },
    { skill: P_TWO_HANDED_SWORD, skmax: P_EXPERT },
    { skill: P_SABER, skmax: P_SKILLED },
    { skill: P_CLUB, skmax: P_SKILLED },
    { skill: P_MACE, skmax: P_SKILLED },
    { skill: P_MORNING_STAR, skmax: P_SKILLED },
    { skill: P_FLAIL, skmax: P_BASIC },
    { skill: P_HAMMER, skmax: P_EXPERT },
    { skill: P_QUARTERSTAFF, skmax: P_BASIC },
    { skill: P_SPEAR, skmax: P_SKILLED },
    { skill: P_TRIDENT, skmax: P_SKILLED },
    { skill: P_BOW, skmax: P_BASIC },
    { skill: P_ATTACK_SPELL, skmax: P_BASIC },
    { skill: P_ESCAPE_SPELL, skmax: P_BASIC }, /* special spell is haste self */
    { skill: P_RIDING, skmax: P_BASIC },
    { skill: P_TWO_WEAPON_COMBAT, skmax: P_BASIC },
    { skill: P_BARE_HANDED_COMBAT, skmax: P_MASTER },
    { skill: P_NONE, skmax: 0 }
]);
const Skill_C = static_array("Skill_C", struct_def_skill, null, [
    { skill: P_DAGGER, skmax: P_BASIC },
    { skill: P_KNIFE, skmax: P_SKILLED },
    { skill: P_AXE, skmax: P_SKILLED },
    { skill: P_PICK_AXE, skmax: P_BASIC },
    { skill: P_CLUB, skmax: P_EXPERT },
    { skill: P_MACE, skmax: P_EXPERT },
    { skill: P_MORNING_STAR, skmax: P_BASIC },
    { skill: P_FLAIL, skmax: P_SKILLED },
    { skill: P_HAMMER, skmax: P_SKILLED },
    { skill: P_QUARTERSTAFF, skmax: P_EXPERT },
    { skill: P_POLEARMS, skmax: P_SKILLED },
    { skill: P_SPEAR, skmax: P_EXPERT },
    { skill: P_TRIDENT, skmax: P_SKILLED },
    { skill: P_BOW, skmax: P_SKILLED },
    { skill: P_SLING, skmax: P_EXPERT },
    { skill: P_ATTACK_SPELL, skmax: P_BASIC },
    { skill: P_MATTER_SPELL, skmax: P_SKILLED },
    { skill: P_BOOMERANG, skmax: P_EXPERT },
    { skill: P_UNICORN_HORN, skmax: P_BASIC },
    { skill: P_BARE_HANDED_COMBAT, skmax: P_MASTER },
    { skill: P_NONE, skmax: 0 }
]);
const Skill_H = static_array("Skill_H", struct_def_skill, null, [
    { skill: P_DAGGER, skmax: P_SKILLED },
    { skill: P_KNIFE, skmax: P_EXPERT },
    { skill: P_SHORT_SWORD, skmax: P_SKILLED },
    { skill: P_SABER, skmax: P_BASIC },
    { skill: P_CLUB, skmax: P_SKILLED },
    { skill: P_MACE, skmax: P_BASIC },
    { skill: P_QUARTERSTAFF, skmax: P_EXPERT },
    { skill: P_POLEARMS, skmax: P_BASIC },
    { skill: P_SPEAR, skmax: P_BASIC },
    { skill: P_TRIDENT, skmax: P_BASIC },
    { skill: P_SLING, skmax: P_SKILLED },
    { skill: P_DART, skmax: P_EXPERT },
    { skill: P_SHURIKEN, skmax: P_SKILLED },
    { skill: P_UNICORN_HORN, skmax: P_EXPERT },
    { skill: P_HEALING_SPELL, skmax: P_EXPERT },
    { skill: P_BARE_HANDED_COMBAT, skmax: P_BASIC },
    { skill: P_NONE, skmax: 0 }
]);
const Skill_K = static_array("Skill_K", struct_def_skill, null, [
    { skill: P_DAGGER, skmax: P_BASIC },
    { skill: P_KNIFE, skmax: P_BASIC },
    { skill: P_AXE, skmax: P_SKILLED },
    { skill: P_PICK_AXE, skmax: P_BASIC },
    { skill: P_SHORT_SWORD, skmax: P_SKILLED },
    { skill: P_BROAD_SWORD, skmax: P_SKILLED },
    { skill: P_LONG_SWORD, skmax: P_EXPERT },
    { skill: P_TWO_HANDED_SWORD, skmax: P_SKILLED },
    { skill: P_SABER, skmax: P_SKILLED },
    { skill: P_CLUB, skmax: P_BASIC },
    { skill: P_MACE, skmax: P_SKILLED },
    { skill: P_MORNING_STAR, skmax: P_SKILLED },
    { skill: P_FLAIL, skmax: P_BASIC },
    { skill: P_HAMMER, skmax: P_BASIC },
    { skill: P_POLEARMS, skmax: P_SKILLED },
    { skill: P_SPEAR, skmax: P_SKILLED },
    { skill: P_TRIDENT, skmax: P_BASIC },
    { skill: P_LANCE, skmax: P_EXPERT },
    { skill: P_BOW, skmax: P_BASIC },
    { skill: P_CROSSBOW, skmax: P_SKILLED },
    { skill: P_ATTACK_SPELL, skmax: P_SKILLED },
    { skill: P_HEALING_SPELL, skmax: P_SKILLED },
    { skill: P_CLERIC_SPELL, skmax: P_SKILLED },
    { skill: P_RIDING, skmax: P_EXPERT },
    { skill: P_TWO_WEAPON_COMBAT, skmax: P_SKILLED },
    { skill: P_BARE_HANDED_COMBAT, skmax: P_EXPERT },
    { skill: P_NONE, skmax: 0 }
]);
const Skill_Mon = static_array("Skill_Mon", struct_def_skill, null, [
    { skill: P_QUARTERSTAFF, skmax: P_BASIC },
    { skill: P_SPEAR, skmax: P_BASIC },
    { skill: P_CROSSBOW, skmax: P_BASIC },
    { skill: P_SHURIKEN, skmax: P_BASIC },
    { skill: P_ATTACK_SPELL, skmax: P_BASIC },
    { skill: P_HEALING_SPELL, skmax: P_EXPERT },
    { skill: P_DIVINATION_SPELL, skmax: P_BASIC },
    { skill: P_ENCHANTMENT_SPELL, skmax: P_BASIC },
    { skill: P_CLERIC_SPELL, skmax: P_SKILLED },
    { skill: P_ESCAPE_SPELL, skmax: P_SKILLED },
    { skill: P_MATTER_SPELL, skmax: P_BASIC },
    { skill: P_MARTIAL_ARTS, skmax: P_GRAND_MASTER },
    { skill: P_NONE, skmax: 0 }
]);
const Skill_P = static_array("Skill_P", struct_def_skill, null, [
    { skill: P_CLUB, skmax: P_EXPERT },
    { skill: P_MACE, skmax: P_EXPERT },
    { skill: P_MORNING_STAR, skmax: P_EXPERT },
    { skill: P_FLAIL, skmax: P_EXPERT },
    { skill: P_HAMMER, skmax: P_EXPERT },
    { skill: P_QUARTERSTAFF, skmax: P_EXPERT },
    { skill: P_POLEARMS, skmax: P_SKILLED },
    { skill: P_SPEAR, skmax: P_SKILLED },
    { skill: P_TRIDENT, skmax: P_SKILLED },
    { skill: P_LANCE, skmax: P_BASIC },
    { skill: P_BOW, skmax: P_BASIC },
    { skill: P_SLING, skmax: P_BASIC },
    { skill: P_CROSSBOW, skmax: P_BASIC },
    { skill: P_DART, skmax: P_BASIC },
    { skill: P_SHURIKEN, skmax: P_BASIC },
    { skill: P_BOOMERANG, skmax: P_BASIC },
    { skill: P_UNICORN_HORN, skmax: P_SKILLED },
    { skill: P_HEALING_SPELL, skmax: P_EXPERT },
    { skill: P_DIVINATION_SPELL, skmax: P_EXPERT },
    { skill: P_CLERIC_SPELL, skmax: P_EXPERT },
    { skill: P_BARE_HANDED_COMBAT, skmax: P_BASIC },
    { skill: P_NONE, skmax: 0 }
]);
const Skill_R = static_array("Skill_R", struct_def_skill, null, [
    { skill: P_DAGGER, skmax: P_EXPERT },
    { skill: P_KNIFE, skmax: P_EXPERT },
    { skill: P_SHORT_SWORD, skmax: P_EXPERT },
    { skill: P_BROAD_SWORD, skmax: P_SKILLED },
    { skill: P_LONG_SWORD, skmax: P_SKILLED },
    { skill: P_TWO_HANDED_SWORD, skmax: P_BASIC },
    { skill: P_SABER, skmax: P_SKILLED },
    { skill: P_CLUB, skmax: P_SKILLED },
    { skill: P_MACE, skmax: P_SKILLED },
    { skill: P_MORNING_STAR, skmax: P_BASIC },
    { skill: P_FLAIL, skmax: P_BASIC },
    { skill: P_HAMMER, skmax: P_BASIC },
    { skill: P_POLEARMS, skmax: P_BASIC },
    { skill: P_SPEAR, skmax: P_BASIC },
    { skill: P_CROSSBOW, skmax: P_EXPERT },
    { skill: P_DART, skmax: P_EXPERT },
    { skill: P_SHURIKEN, skmax: P_SKILLED },
    { skill: P_DIVINATION_SPELL, skmax: P_SKILLED },
    { skill: P_ESCAPE_SPELL, skmax: P_SKILLED },
    { skill: P_MATTER_SPELL, skmax: P_SKILLED },
    { skill: P_RIDING, skmax: P_BASIC },
    { skill: P_TWO_WEAPON_COMBAT, skmax: P_EXPERT },
    { skill: P_BARE_HANDED_COMBAT, skmax: P_EXPERT },
    { skill: P_NONE, skmax: 0 }
]);
const Skill_Ran = static_array("Skill_Ran", struct_def_skill, null, [
    { skill: P_DAGGER, skmax: P_EXPERT },
    { skill: P_KNIFE, skmax: P_SKILLED },
    { skill: P_AXE, skmax: P_SKILLED },
    { skill: P_PICK_AXE, skmax: P_BASIC },
    { skill: P_SHORT_SWORD, skmax: P_BASIC },
    { skill: P_MORNING_STAR, skmax: P_BASIC },
    { skill: P_FLAIL, skmax: P_SKILLED },
    { skill: P_HAMMER, skmax: P_BASIC },
    { skill: P_QUARTERSTAFF, skmax: P_BASIC },
    { skill: P_POLEARMS, skmax: P_SKILLED },
    { skill: P_SPEAR, skmax: P_EXPERT },
    { skill: P_TRIDENT, skmax: P_BASIC },
    { skill: P_BOW, skmax: P_EXPERT },
    { skill: P_SLING, skmax: P_EXPERT },
    { skill: P_CROSSBOW, skmax: P_EXPERT },
    { skill: P_DART, skmax: P_EXPERT },
    { skill: P_SHURIKEN, skmax: P_SKILLED },
    { skill: P_BOOMERANG, skmax: P_EXPERT },
    { skill: P_WHIP, skmax: P_BASIC },
    { skill: P_HEALING_SPELL, skmax: P_BASIC },
    { skill: P_DIVINATION_SPELL, skmax: P_EXPERT },
    { skill: P_ESCAPE_SPELL, skmax: P_BASIC },
    { skill: P_RIDING, skmax: P_BASIC },
    { skill: P_BARE_HANDED_COMBAT, skmax: P_BASIC },
    { skill: P_NONE, skmax: 0 }
]);
const Skill_S = static_array("Skill_S", struct_def_skill, null, [
    { skill: P_DAGGER, skmax: P_BASIC },
    { skill: P_KNIFE, skmax: P_SKILLED },
    { skill: P_SHORT_SWORD, skmax: P_EXPERT },
    { skill: P_BROAD_SWORD, skmax: P_SKILLED },
    { skill: P_LONG_SWORD, skmax: P_EXPERT },
    { skill: P_TWO_HANDED_SWORD, skmax: P_EXPERT },
    { skill: P_SABER, skmax: P_BASIC },
    { skill: P_FLAIL, skmax: P_SKILLED },
    { skill: P_QUARTERSTAFF, skmax: P_BASIC },
    { skill: P_POLEARMS, skmax: P_SKILLED },
    { skill: P_SPEAR, skmax: P_SKILLED },
    { skill: P_LANCE, skmax: P_SKILLED },
    { skill: P_BOW, skmax: P_EXPERT },
    { skill: P_SHURIKEN, skmax: P_EXPERT },
    { skill: P_ATTACK_SPELL, skmax: P_BASIC },
    { skill: P_DIVINATION_SPELL, skmax: P_BASIC }, /* special spell is clairvoyance */
    { skill: P_CLERIC_SPELL, skmax: P_SKILLED },
    { skill: P_RIDING, skmax: P_SKILLED },
    { skill: P_TWO_WEAPON_COMBAT, skmax: P_EXPERT },
    { skill: P_MARTIAL_ARTS, skmax: P_MASTER },
    { skill: P_NONE, skmax: 0 }
]);
const Skill_T = static_array("Skill_T", struct_def_skill, null, [
    { skill: P_DAGGER, skmax: P_EXPERT },
    { skill: P_KNIFE, skmax: P_SKILLED },
    { skill: P_AXE, skmax: P_BASIC },
    { skill: P_PICK_AXE, skmax: P_BASIC },
    { skill: P_SHORT_SWORD, skmax: P_EXPERT },
    { skill: P_BROAD_SWORD, skmax: P_BASIC },
    { skill: P_LONG_SWORD, skmax: P_BASIC },
    { skill: P_TWO_HANDED_SWORD, skmax: P_BASIC },
    { skill: P_SABER, skmax: P_SKILLED },
    { skill: P_MACE, skmax: P_BASIC },
    { skill: P_MORNING_STAR, skmax: P_BASIC },
    { skill: P_FLAIL, skmax: P_BASIC },
    { skill: P_HAMMER, skmax: P_BASIC },
    { skill: P_QUARTERSTAFF, skmax: P_BASIC },
    { skill: P_POLEARMS, skmax: P_BASIC },
    { skill: P_SPEAR, skmax: P_BASIC },
    { skill: P_TRIDENT, skmax: P_BASIC },
    { skill: P_LANCE, skmax: P_BASIC },
    { skill: P_BOW, skmax: P_BASIC },
    { skill: P_SLING, skmax: P_BASIC },
    { skill: P_CROSSBOW, skmax: P_BASIC },
    { skill: P_DART, skmax: P_EXPERT },
    { skill: P_SHURIKEN, skmax: P_BASIC },
    { skill: P_BOOMERANG, skmax: P_BASIC },
    { skill: P_WHIP, skmax: P_BASIC },
    { skill: P_UNICORN_HORN, skmax: P_SKILLED },
    { skill: P_DIVINATION_SPELL, skmax: P_BASIC },
    { skill: P_ENCHANTMENT_SPELL, skmax: P_BASIC },
    { skill: P_ESCAPE_SPELL, skmax: P_SKILLED },
    { skill: P_RIDING, skmax: P_BASIC },
    { skill: P_TWO_WEAPON_COMBAT, skmax: P_SKILLED },
    { skill: P_BARE_HANDED_COMBAT, skmax: P_SKILLED },
    { skill: P_NONE, skmax: 0 }
]);
const Skill_V = static_array("Skill_V", struct_def_skill, null, [
    { skill: P_DAGGER, skmax: P_EXPERT },
    { skill: P_AXE, skmax: P_EXPERT },
    { skill: P_PICK_AXE, skmax: P_SKILLED },
    { skill: P_SHORT_SWORD, skmax: P_SKILLED },
    { skill: P_BROAD_SWORD, skmax: P_SKILLED },
    { skill: P_LONG_SWORD, skmax: P_EXPERT },
    { skill: P_TWO_HANDED_SWORD, skmax: P_EXPERT },
    { skill: P_SABER, skmax: P_BASIC },
    { skill: P_HAMMER, skmax: P_EXPERT },
    { skill: P_QUARTERSTAFF, skmax: P_BASIC },
    { skill: P_POLEARMS, skmax: P_SKILLED },
    { skill: P_SPEAR, skmax: P_EXPERT },
    { skill: P_TRIDENT, skmax: P_BASIC },
    { skill: P_LANCE, skmax: P_SKILLED },
    { skill: P_SLING, skmax: P_BASIC },
    { skill: P_ATTACK_SPELL, skmax: P_BASIC },
    { skill: P_ESCAPE_SPELL, skmax: P_BASIC },
    { skill: P_RIDING, skmax: P_SKILLED },
    { skill: P_TWO_WEAPON_COMBAT, skmax: P_SKILLED },
    { skill: P_BARE_HANDED_COMBAT, skmax: P_EXPERT },
    { skill: P_NONE, skmax: 0 }
]);
const Skill_W = static_array("Skill_W", struct_def_skill, null, [
    { skill: P_DAGGER, skmax: P_EXPERT },
    { skill: P_KNIFE, skmax: P_SKILLED },
    { skill: P_AXE, skmax: P_SKILLED },
    { skill: P_SHORT_SWORD, skmax: P_BASIC },
    { skill: P_CLUB, skmax: P_SKILLED },
    { skill: P_MACE, skmax: P_BASIC },
    { skill: P_QUARTERSTAFF, skmax: P_EXPERT },
    { skill: P_POLEARMS, skmax: P_SKILLED },
    { skill: P_SPEAR, skmax: P_BASIC },
    { skill: P_TRIDENT, skmax: P_BASIC },
    { skill: P_SLING, skmax: P_SKILLED },
    { skill: P_DART, skmax: P_EXPERT },
    { skill: P_SHURIKEN, skmax: P_BASIC },
    { skill: P_ATTACK_SPELL, skmax: P_EXPERT },
    { skill: P_HEALING_SPELL, skmax: P_SKILLED },
    { skill: P_DIVINATION_SPELL, skmax: P_EXPERT },
    { skill: P_ENCHANTMENT_SPELL, skmax: P_SKILLED },
    { skill: P_CLERIC_SPELL, skmax: P_SKILLED },
    { skill: P_ESCAPE_SPELL, skmax: P_EXPERT },
    { skill: P_MATTER_SPELL, skmax: P_EXPERT },
    { skill: P_RIDING, skmax: P_BASIC },
    { skill: P_BARE_HANDED_COMBAT, skmax: P_BASIC },
    { skill: P_NONE, skmax: 0 }
]);

function knows_object(obj, override_pauper) { /* void */
    if (u.uroleplay.pauper && !override_pauper)
        return;
    /* mark as known, but not yet encountered */
    discover_object(obj, TRUE, FALSE, FALSE);
}

/* Know ordinary (non-magical) objects of a certain class,
   like all gems except the loadstone and luckstone. */
function knows_class(sym) { /* void */
    const $frame = stack_frame(); try {
    let odummy = stack_struct(struct_obj), o;
    let ct;

    if (u.uroleplay.pauper)
        return;

    struct_assign(odummy, cg.zeroobj);
    odummy.oclass = sym;
    o = odummy; /* for use in various obj.h macros */

    /*
     * Note:  the exceptions here can be bypassed if necessary by
     *        calling knows_object() directly.  So an elven ranger,
     *        for example, knows all elven weapons despite the bow,
     *        arrow, and spear limitation below.
     */

    for (ct = svb.bases[uchar(sym)]; ct < svb.bases[uchar(sym) + 1]; ct++) {
        /* not flagged as magic but shouldn't be pre-discovered
           (small shields look the same as two types of magical shield;
           cornuthaum / dunce cap look the same as each other) */
        if (ct == CORNUTHAUM || ct == DUNCE_CAP || ct == SMALL_SHIELD)
            continue;
        if (sym == WEAPON_CLASS) {
            odummy.otyp = ct; /* update 'o' */
            /* arbitrary: only knights and samurai recognize polearms */
            if ((!Role_if(PM_KNIGHT) && !Role_if(PM_SAMURAI)) && is_pole(o))
                continue;
            /* rangers know all launchers (bows, &c), ammo (arrows, &c),
               and spears regardless of race/species, but not other weapons */
            if (Role_if(PM_RANGER)
                && (!is_launcher(o) && !is_ammo(o) && !is_spear(o)))
                continue;
            /* rogues know daggers, regardless of racial variations */
            if (Role_if(PM_ROGUE) && (objects[o.otyp].oc_subtyp != P_DAGGER))
                continue;
        }

        if (objects[ct].oc_class == sym && !objects[ct].oc_magic)
            knows_object(ct, FALSE);
    }
    } finally { stack_pop($frame); }
}

/* role-specific initializations, mostly inventory

   other things may be initialised here, but the function might run more than
   once, so any non-inventory initialisations should be nonrandom and
   idempotent (i.e. doing them twice is OK) */
function u_init_role() { /* void */
    let i;

    /* the program used to check moves<=1 && invent==NULL do decide whether
       a new game has started, but due to the 'pauper' option/conduct, can't
       rely on invent becoming non-Null anymore; instead, initialize moves
       to 0 instead of 1, then set it to 1 here, where invent init occurs */
    svm.moves = 1;

    switch (Role_switch()) {
    /* rn2(100) > 50 necessary for some choices because some
     * random number generators are bad enough to seriously
     * skew the results if we use rn2(2)...  --KAA
     */
    case PM_ARCHEOLOGIST:
        ini_inv(Archeologist[0]);
        if (!rn2(10))
            ini_inv(Tinopener[0]);
        else if (!rn2(4))
            ini_inv(Lamp[0]);
        else if (!rn2(5))
            ini_inv(Magicmarker[0]);
        knows_object(SACK, FALSE);
        knows_object(TOUCHSTONE, FALSE); /* FALSE: don't override pauper here,
                                          * but TOUCHSTONE will be made known
                                          * in pauper_reinit() */
        break;
    case PM_BARBARIAN:
        if (rn2(100) >= 50) { /* see above comment */
            ini_inv(Barbarian_0[0]);
        } else {
            ini_inv(Barbarian_1[0]);
        }
        if (!rn2(6))
            ini_inv(Lamp[0]);
        knows_class(WEAPON_CLASS); /* excluding polearms */
        knows_class(ARMOR_CLASS);
        break;
    case PM_CAVE_DWELLER:
        ini_inv(Cave_man[0]);
        break;
    case PM_HEALER:
        u.umoney0 = rn1(1000, 1001);
        ini_inv(Healer[0]);
        if (!rn2(25))
            ini_inv(Lamp[0]);
        knows_object(POT_FULL_HEALING, FALSE);
        break;
    case PM_KNIGHT:
        ini_inv(Knight[0]);
        knows_class(WEAPON_CLASS); /* all weapons */
        knows_class(ARMOR_CLASS);
        /* give knights chess-like mobility--idea from wooledge@..cwru.edu */
        u.uprops[JUMPING].intrinsic = or64(u.uprops[JUMPING].intrinsic, FROMOUTSIDE);
        break;
    case PM_MONK: {
        let M_spell = static_array("u_init_role.M_spell", ptr_to(struct_trobj), null, [
            Healing_book[0], Protection_book[0], Confuse_monster_book[0]
        ]);

        ini_inv(Monk[0]);
        ini_inv(M_spell[Math.trunc(rn2(90) / 30)]); /* [0..2] */
        if (!rn2(4))
            ini_inv(Magicmarker[0]);
        else if (!rn2(10))
            ini_inv(Lamp[0]);
        knows_class(ARMOR_CLASS);
        /* sufficiently martial-arts oriented item to ignore language issue */
        knows_object(SHURIKEN, FALSE);
        break;
    }
    case PM_CLERIC: /* priest/priestess */
        ini_inv(Priest[0]);
        if (!rn2(5))
            ini_inv(Magicmarker[0]);
        else if (!rn2(10))
            ini_inv(Lamp[0]);
        knows_object(POT_WATER, TRUE); /* override pauper */
        /* KMH, conduct --
         * Some may claim that this isn't agnostic, since they
         * are literally "priests" and they have holy water.
         * But we don't count it as such.  Purists can always
         * avoid playing priests and/or confirm another player's
         * role in their YAAP.
         */
        break;
    case PM_RANGER:
        ini_inv(Ranger[0]);
        knows_class(WEAPON_CLASS); /* bows, arrows, spears only */
        break;
    case PM_ROGUE:
        u.umoney0 = 0;
        ini_inv(Rogue[0]);
        if (!rn2(5))
            ini_inv(Blindfold[0]);
        knows_object(SACK, FALSE); /* FALSE: don't override pauper here,
                                    * but sack will be made known in
                                    * pauper_reinit() */
        knows_class(WEAPON_CLASS); /* daggers only */
        break;
    case PM_SAMURAI:
        ini_inv(Samurai[0]);
        if (!rn2(5))
            ini_inv(Blindfold[0]);
        knows_class(WEAPON_CLASS); /* all weapons */
        knows_class(ARMOR_CLASS);
        /* in order to assist non-Japanese speakers, pre-discover items
           that switch to Japanese names when playing as a Samurai */
        for (i = MAXOCLASSES; i < NUM_OBJECTS; ++i) {
            if (objects[i].oc_magic) /* skip "magic koto" */
                continue;
            if (Japanese_item_name(i, 0))
                /* we don't override pauper here because that would give
                   samarai an advantage of knowing several items in advance */
                knows_object(i, FALSE);
        }
        break;
    case PM_TOURIST:
        u.umoney0 = rnd(1000);
        ini_inv(Tourist[0]);
        if (!rn2(25))
            ini_inv(Tinopener[0]);
        else if (!rn2(25))
            ini_inv(Leash[0]);
        else if (!rn2(25))
            ini_inv(Towel[0]);
        else if (!rn2(20))
            ini_inv(Magicmarker[0]);
        break;
    case PM_VALKYRIE:
        ini_inv(Valkyrie[0]);
        if (!rn2(6))
            ini_inv(Lamp[0]);
        knows_class(WEAPON_CLASS); /* excludes polearms */
        knows_class(ARMOR_CLASS);
        break;
    case PM_WIZARD:
        ini_inv(Wizard[0]);
        if (!rn2(5))
            ini_inv(Blindfold[0]);
        break;

    default: /* impossible */
        break;
    }

    gn.nocreate = STRANGE_OBJECT;
    gn.nocreate2 = STRANGE_OBJECT;
    gn.nocreate3 = STRANGE_OBJECT;
    gn.nocreate4 = STRANGE_OBJECT;
}

/* race-specific initializations, same restrictions as u_init_role */
function u_init_race() { /* void */
    const $frame = stack_frame(); try {
    switch (Race_switch()) {
    case PM_HUMAN:
        /* Nothing special */
        break;

    case PM_ELF:
        /*
         * Elves are people of music and song, or they are warriors.
         * Non-warriors get an instrument.  We use a kludge to
         * get only non-magic instruments.
         */
        if (Role_if(PM_CLERIC) || Role_if(PM_WIZARD)) {
            let trotyp = static_array("u_init_race.trotyp", int, null, [ WOODEN_FLUTE, TOOLED_HORN, WOODEN_HARP,
                  BELL,         BUGLE,       LEATHER_DRUM ]);

            let Instrument = stack_array(struct_trobj, null, [ { trotyp: ROLL_FROM(trotyp), trspe: 0, trclass: TOOL_CLASS, trquan_min: 1, trquan_max: 1, trbless: 0 },
                  { trotyp: 0, trspe: 0, trclass: 0, trquan_min: 0, trquan_max: 0, trbless: 0 } ]);

            ini_inv(Instrument[0]);
        }

        /* Elves can recognize all elvish objects */
        knows_object(ELVEN_SHORT_SWORD, FALSE);
        knows_object(ELVEN_ARROW, FALSE);
        knows_object(ELVEN_BOW, FALSE);
        knows_object(ELVEN_SPEAR, FALSE);
        knows_object(ELVEN_DAGGER, FALSE);
        knows_object(ELVEN_BROADSWORD, FALSE);
        knows_object(ELVEN_MITHRIL_COAT, FALSE);
        knows_object(ELVEN_LEATHER_HELM, FALSE);
        knows_object(ELVEN_SHIELD, FALSE);
        knows_object(ELVEN_BOOTS, FALSE);
        knows_object(ELVEN_CLOAK, FALSE);
        break;

    case PM_DWARF:
        /* Dwarves can recognize all dwarvish objects */
        knows_object(DWARVISH_SPEAR, FALSE);
        knows_object(DWARVISH_SHORT_SWORD, FALSE);
        knows_object(DWARVISH_MATTOCK, FALSE);
        knows_object(DWARVISH_IRON_HELM, FALSE);
        knows_object(DWARVISH_MITHRIL_COAT, FALSE);
        knows_object(DWARVISH_CLOAK, FALSE);
        knows_object(DWARVISH_ROUNDSHIELD, FALSE);
        break;

    case PM_GNOME:
        break;

    case PM_ORC:
        /* compensate for generally inferior equipment */
        if (!Role_if(PM_WIZARD))
            ini_inv(Xtra_food[0]);
        /* Orcs can recognize all orcish objects */
        knows_object(ORCISH_SHORT_SWORD, FALSE);
        knows_object(ORCISH_ARROW, FALSE);
        knows_object(ORCISH_BOW, FALSE);
        knows_object(ORCISH_SPEAR, FALSE);
        knows_object(ORCISH_DAGGER, FALSE);
        knows_object(ORCISH_CHAIN_MAIL, FALSE);
        knows_object(ORCISH_RING_MAIL, FALSE);
        knows_object(ORCISH_HELM, FALSE);
        knows_object(ORCISH_SHIELD, FALSE);
        knows_object(URUK_HAI_SHIELD, FALSE);
        knows_object(ORCISH_CLOAK, FALSE);
        break;

    default: /* impossible */
        break;
    }
    } finally { stack_pop($frame); }
}

/* for 'pauper' aka 'unprepared'; take away any skills (bare-handed combat,
   riding) that are better than unskilled; learn the book (without carrying
   it or knowing its spell yet) for some key spells */
function pauper_reinit() { /* void */
    let skill, preknown = STRANGE_OBJECT;

    if (!u.uroleplay.pauper)
        return;

    for (skill = 0; skill < P_NUM_SKILLS; skill++)
        if (P_SKILL(skill) > P_UNSKILLED) {
            (u.weapon_skills[skill].skill) = P_UNSKILLED;
            (u.weapon_skills[skill].advance) = 0;
        }
    /* pauper has lost out on initial skills, but provide some unspent skill
       credits to make up for that */
    u.weapon_slots = 2;

    /* paupers don't know any spells yet, but several roles will recognize
       the spellbook for a key spell (not necessarily that role's special
       spell); "supply chests" on the first few levels provide a fairly
       high chance to find the book; some other roles know a non-book item */
    switch (Role_switch()) {
    case PM_HEALER:
        preknown = SPE_HEALING;
        break;
    case PM_CLERIC:
    case PM_KNIGHT:
    case PM_MONK:
        preknown = SPE_PROTECTION;
        break;
    case PM_WIZARD:
        preknown = SPE_FORCE_BOLT;
        break;
    case PM_ARCHEOLOGIST:
        preknown = TOUCHSTONE;
        break;
    case PM_CAVE_DWELLER:
        preknown = FLINT;
        break;
    case PM_ROGUE:
    case PM_TOURIST:
        preknown = SACK;
        break;
    case PM_SAMURAI:
        /* food ration isn't interesting to discover, but put "gunyoki" into
           discoveries list for players who might not recognize what it is */
        preknown = FOOD_RATION;
        break;
    default:
    case PM_BARBARIAN:
    case PM_RANGER:
    case PM_VALKYRIE:
        break;
    }
    if (preknown != STRANGE_OBJECT)
        knows_object(preknown, TRUE);
}

/* boost STR and CON until hero can carry inventory */
function u_init_carry_attr_boost() { /* void */
    /* make sure you can carry all you have - especially for Tourists */
    while (inv_weight() > 0) {
        if (adjattrib(A_STR, 1, TRUE))
            continue;
        if (adjattrib(A_CON, 1, TRUE))
            continue;
        /* only get here when didn't boost strength or constitution */
        break;
    }
}

/* initialise u, except inventory, attributes, skills and discoveries */
export function u_init_misc() { /* void */
    const $frame = stack_frame(); try {
    let i;
    let tmpuroleplay = struct_assign(stack_struct(struct_u_roleplay), u.uroleplay); /* set by rcfile options */

    flags.female = flags.initgend;
    flags.beginner = TRUE;

    /* zero u, including pointer values --
     * necessary when aborting from a failed restore */
    memset(addr_of(u), 0, sizeof(struct_you));
    u.ustuck = null;
    memset(addr_of(global_ref("ubirthday", long)), 0, sizeof(long));
    memset(addr_of(urealtime), 0, sizeof(struct_u_realtime));

    struct_assign(u.uroleplay, tmpuroleplay); /* restore options set via rcfile */

    /* #if 0: not in this build */

    u.uz.dlevel = 1;
    u.uz0.dlevel = 0;
    struct_assign(u.utolev, u.uz);

    u.umoved = FALSE;
    u.umortality = 0;
    u.ugrave_arise = NON_PM;

    u.umonnum = u.umonster = gu.urole.mnum;
    u.ulycn = NON_PM;
    set_uasmon();

    u.ulevel = 0; /* set up some of the initial attributes */
    u.uhp = u.uhpmax = u.uhppeak = newhp();
    u.uen = u.uenmax = u.uenpeak = newpw();
    u.uspellprot = 0;
    adjabil(0, 1);
    u.ulevel = u.ulevelmax = 1;

    init_uhunger();
    for (i = 0; i <= MAXSPELL; i++)
        svs.spl_book[i].sp_id = NO_SPELL;
    u.ublesscnt = 300; /* no prayers just yet */
    chars[u.ualignbase + A_CURRENT] = chars[u.ualignbase + A_ORIGINAL] = u.ualign.type =
        aligns[flags.initalign].value;

    /* Route through getnow() so fixed datetime also controls ubirthday. */
    ubirthday = getnow();

    /*
     *  For now, everyone starts out with a night vision range of 1 and
     *  their xray_range disabled.
     */
    u.nv_range = 1;
    u.xray_range = -1;
    u.unblind_telepat_range = -1;

    /* OPTIONS:blind results in permanent blindness (unless overridden
       by the Eyes of the Overworld, which will clear 'u.uroleplay.blind'
       to void the conduct, but will leave the PermaBlind bit set so that
       blindness resumes when the Eyes are removed). */
    if (u.uroleplay.blind)
        u.uprops[BLINDED].intrinsic = or64(u.uprops[BLINDED].intrinsic, FROMOUTSIDE); /* set PermaBlind */

    /* roughly based on distribution in human population */
    u.uhandedness = rn2(10) ? RIGHT_HANDED : LEFT_HANDED;

    max_rank_sz(); /* set max str size for class ranks */

    return;
    } finally { stack_pop($frame); }
}

/* the appropriate set of skills for the role */
function skills_for_role() { /* const struct def_skill * */
    let skills;

    switch (Role_switch()) {
    case PM_ARCHEOLOGIST:
        skills = Skill_A[0];
        break;
    case PM_BARBARIAN:
        skills = Skill_B[0];
        break;
    case PM_CAVE_DWELLER:
        skills = Skill_C[0];
        break;
    case PM_HEALER:
        skills = Skill_H[0];
        break;
    case PM_KNIGHT:
        skills = Skill_K[0];
        break;
    case PM_MONK:
        skills = Skill_Mon[0];
        break;
    case PM_CLERIC:
        skills = Skill_P[0];
        break;
    case PM_RANGER:
        skills = Skill_Ran[0];
        break;
    case PM_ROGUE:
        skills = Skill_R[0];
        break;
    case PM_SAMURAI:
        skills = Skill_S[0];
        break;
    case PM_TOURIST:
        skills = Skill_T[0];
        break;
    case PM_VALKYRIE:
        skills = Skill_V[0];
        break;
    case PM_WIZARD:
        skills = Skill_W[0];
        break;
    default:
        panic(_("No skills found for role"));
        break;
    }

    return skills;
}

/* skills aren't initialized, so we use the role-specific skill lists */
function restricted_spell_discipline(otyp) { /* boolean */
    let skills = skills_for_role();
    let this_skill = spell_skilltype(otyp);

    while (skills && skills.skill != P_NONE) {
        if (skills.skill == this_skill)
            return FALSE;
        skills = ptr_add(skills, 1);
    }
    return TRUE;
}

/* randomizes the quantity given a trobj description */
function trquan(trop) { /* long long */
    if (!trop.trquan_min)
        return 1;
    return trop.trquan_min + rn2(trop.trquan_max - trop.trquan_min + 1);
}

/* create random object of certain class, filtering out too powerful items */
function ini_inv_mkobj_filter(oclass, got_level1_spellbook) { /* struct obj * */
    let obj;
    let otyp, trycnt = 0;

    /*
     * For random objects, do not create certain overly powerful
     * items: wand of wishing, ring of levitation, or the
     * polymorph/polymorph control combination.  Specific objects,
     * i.e. the discovery wishing, are still OK.
     * Also, don't get a couple of really useless items.  (Note:
     * punishment isn't "useless".  Some players who start out with
     * one will immediately read it and use the iron ball as a
     * weapon.)
     */
    obj = mkobj(oclass, FALSE);
    otyp = obj.otyp;

    while (otyp == WAN_WISHING || otyp == gn.nocreate
           || otyp == gn.nocreate2 || otyp == gn.nocreate3
           || otyp == gn.nocreate4 || otyp == RIN_LEVITATION
           /* 'useless' items */
           || otyp == POT_HALLUCINATION
           || otyp == POT_ACID
           || otyp == SCR_AMNESIA
           || otyp == SCR_FIRE
           || otyp == SCR_BLANK_PAPER
           || otyp == SPE_BLANK_PAPER
           || otyp == RIN_AGGRAVATE_MONSTER
           || otyp == RIN_HUNGER
           || otyp == WAN_NOTHING
           /* orcs start with poison resistance */
           || (otyp == RIN_POISON_RESISTANCE && Race_if(PM_ORC))
           /* Monks don't use weapons */
           || (otyp == SCR_ENCHANT_WEAPON && Role_if(PM_MONK))
           /* wizard patch -- they already have one */
           || (otyp == SPE_FORCE_BOLT && Role_if(PM_WIZARD))
           /* powerful spells are either useless to
              low level players or unbalancing; also
              spells in restricted skill categories */
           || (obj.oclass == SPBOOK_CLASS
               && (objects[otyp].oc_oc2 > (got_level1_spellbook ? 3 : 1)
                   || restricted_spell_discipline(otyp)))
           || otyp == SPE_NOVEL) {
        dealloc_obj(obj);
        if (++trycnt > 1000) {
            /* This lonely pancake's potential will never be realized.
             * It will exist only as a thought, of something that could have
             * been, but never will be. It will never experience maple syrup
             * oozing into its nooks, or see the delightful expression on
             * someone's face as they are about to let it dance across their
             * taste buds. */
            obj = mksobj(PANCAKE, TRUE, FALSE);
            break;
        }
        obj = mkobj(oclass, FALSE);
        otyp = obj.otyp;
    }
    return obj;
}

/* substitute object with something else based on race.
   only changes otyp, and returns it. */
function ini_inv_obj_substitution(trop, obj) { /* short */
    if (gu.urace.mnum != PM_HUMAN) {
        let i;

        /* substitute race-specific items; this used to be in
           the 'if (otyp != UNDEF_TYP) { }' block above, but then
           substitutions didn't occur for randomly generated items
           (particularly food) which have racial substitutes */
        for (i = 0; inv_subs[i].race_pm != NON_PM; ++i)
            if (inv_subs[i].race_pm == gu.urace.mnum
                && obj.otyp == inv_subs[i].item_otyp) {
                do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(_("ini_inv: substituting %s for %s%s"), OBJ_NAME(objects[inv_subs[i].subs_otyp]), (trop.trotyp == UNDEF_TYP) ? _("random ") : _(""), OBJ_NAME(objects[obj.otyp])); iflags.last_msg = save_plnmsg; } } while (0)

;
                obj.otyp = inv_subs[i].subs_otyp;
                break;
            }
    }
    return obj.otyp;
}

/* returns: TRUE to stop generating items from this trobj,
   FALSE for normal behaviour */
function ini_inv_adjust_obj(trop, obj) { /* boolean */
    let stop = FALSE;
    if (trop.trclass == COIN_CLASS) {
        /* no "blessed" or "identified" money */
        obj.quan = u.umoney0;
    } else {
        if (objects[obj.otyp].oc_uses_known)
            obj.known = 1;
        /* not observe_object during startup, that's handled later */
        obj.dknown = obj.bknown = obj.rknown = 1;
        if (Is_container(obj) || obj.otyp == STATUE) {
            obj.cknown = obj.lknown = 1;
            obj.otrapped = 0;
        }
        obj.cursed = 0;
        if (obj.otrapped && u.ualign.type != A_CHAOTIC)
            obj.otrapped = 0;
        if (obj.oclass == WEAPON_CLASS || obj.oclass == TOOL_CLASS) {
            obj.quan = trquan(trop);
            stop = TRUE;
        } else if (obj.oclass == GEM_CLASS && is_graystone(obj)
                   && obj.otyp != FLINT) {
            obj.quan = 1;
        }
        if (trop.trspe != UNDEF_SPE) {
            obj.spe = trop.trspe;
            if (trop.trotyp == MAGIC_MARKER && obj.spe < 96)
                obj.spe += rn2(4);
        } else {
            /* Don't start with +0 or negative rings */
            if (objects[obj.otyp].oc_class == RING_CLASS
                && objects[obj.otyp].oc_charged && obj.spe <= 0)
                obj.spe = rne(3);
        }
        if (trop.trbless != UNDEF_BLESS)
            obj.blessed = unsigned(trop.trbless);
    }
    /* defined after setting otyp+quan + blessedness */
    obj.owt = unsigned(weight(obj));
    return stop;
}

/* initial inventory: wear, wield, learn the spell/obj */
function ini_inv_use_obj(obj) { /* void */
    /* Make the type known if necessary */
    if (OBJ_DESCR(objects[obj.otyp]) && obj.known)
        discover_object(obj.otyp, TRUE, TRUE, FALSE);
    if (obj.otyp == OIL_LAMP)
        discover_object(POT_OIL, TRUE, TRUE, FALSE);

    if (obj.oclass == ARMOR_CLASS) {
        if (is_shield(obj) && !uarms && !(uwep && bimanual(uwep))) {
            /* Prior to 3.6.2 this used to unset uswapwep if it was set,
               but wearing a shield doesn't prevent having an alternate
               weapon ready to swap with the primary; just make sure we
               aren't two-weaponing (academic; no one starts that way) */
            set_twoweap(FALSE); /* u.twoweap = FALSE */
            setworn(obj, W_ARMS);
        } else if (is_helmet(obj) && !uarmh)
            setworn(obj, W_ARMH);
        else if (is_gloves(obj) && !uarmg)
            setworn(obj, W_ARMG);
        else if (is_shirt(obj) && !uarmu)
            setworn(obj, W_ARMU);
        else if (is_cloak(obj) && !uarmc)
            setworn(obj, W_ARMC);
        else if (is_boots(obj) && !uarmf)
            setworn(obj, W_ARMF);
        else if (is_suit(obj) && !uarm)
            setworn(obj, W_ARM);
    }

    if (obj.oclass == WEAPON_CLASS || is_weptool(obj)
        || obj.otyp == TIN_OPENER
        || obj.otyp == FLINT || obj.otyp == ROCK) {
        if (is_ammo(obj) || is_missile(obj)) {
            if (!uquiver)
                setuqwep(obj);
        } else if (!uwep && (!uarms || !bimanual(obj))) {
            setuwep(obj);
        } else if (!uswapwep) {
            setuswapwep(obj);
        }
    }
    if (obj.oclass == SPBOOK_CLASS && obj.otyp != SPE_BLANK_PAPER)
        initialspell(obj);
}

function ini_inv(trop) { /* void */
    let obj;
    let otyp;
    let got_sp1 = FALSE; /* got a level 1 spellbook? */
    let quan;

    if (u.uroleplay.pauper) /* pauper gets no items */
        return;

    quan = trquan(trop);
    while (trop.trclass) {
        otyp = trop.trotyp;
        if (otyp != UNDEF_TYP) {
            obj = mksobj(otyp, TRUE, FALSE);
        } else { /* UNDEF_TYP */
            obj = ini_inv_mkobj_filter(trop.trclass, got_sp1);
            otyp = obj.otyp;
            /* Heavily relies on the facts that 1) we create wands
             * before rings, that 2) we create rings before
             * spellbooks, and that 3) not more than 1 object of a
             * particular symbol is to be prohibited.  (For more
             * objects, we need more nocreate variables...)
             */
            switch (otyp) {
            case WAN_POLYMORPH:
            case RIN_POLYMORPH:
            case POT_POLYMORPH:
                gn.nocreate = RIN_POLYMORPH_CONTROL;
                break;
            case RIN_POLYMORPH_CONTROL:
                gn.nocreate = RIN_POLYMORPH;
                gn.nocreate2 = SPE_POLYMORPH;
                gn.nocreate3 = POT_POLYMORPH;
            }
            /* Don't have 2 of the same ring or spellbook */
            if (obj.oclass == RING_CLASS || obj.oclass == SPBOOK_CLASS)
                gn.nocreate4 = otyp;
        }
        /* Put post-creation object adjustments that don't depend on whether
         * it was UNDEF_TYP or not after this. */

        otyp = ini_inv_obj_substitution(trop, obj);
        (otyp);

        /* nudist gets no armor */
        if (u.uroleplay.nudist && obj.oclass == ARMOR_CLASS) {
            dealloc_obj(obj);
            trop = ptr_add(trop, 1);
            continue;
        }

        if (ini_inv_adjust_obj(trop, obj))
            quan = 1;
        obj = addinv(obj);

        /* First spellbook should be level 1 - did we get it? */
        if (obj.oclass == SPBOOK_CLASS && objects[obj.otyp].oc_oc2 == 1)
            got_sp1 = TRUE;

        if (--quan)
            continue; /* make a similar object */
        trop = ptr_add(trop, 1);
        quan = trquan(trop);
    }
}

/* initialise starting inventory and attributes

   this function can be run multiple times and will overwrite the effects of
   previous runs */
export function u_init_inventory_attrs() { /* void */
    gl.lastinvnr = 51;
    while (gi.invent)
        useupall(gi.invent);

    u.umoney0 = 0;
    u_init_role();
    u_init_race();

    if (discover())
        ini_inv(Wishing[0]);

    if (u.umoney0)
        ini_inv(Money[0]);
    u.umoney0 += hidden_gold(TRUE); /* in case sack has gold in it */

    init_attr(75);    /* init attribute values */
    vary_init_attr(); /* minor variation to attrs */
    u_init_carry_attr_boost();
}

/* side effects of starting inventory (e.g. discovering it) and skills (both
   those based on role and those based on starting inventory) */
export function u_init_skills_discoveries() { /* void */
    let otmp;
    for (otmp = gi.invent; otmp; otmp = otmp.nobj)
        ini_inv_use_obj(otmp);

    skill_init(skills_for_role());
    if (u.uroleplay.pauper)
        pauper_reinit();

    /* If we have at least one spell, force starting Pw to be enough,
       so hero can cast the level 1 spell they should have */
    if (num_spells() && (u.uenmax < SPELL_LEV_PW(1)))
        u.uen = u.uenmax = u.uenpeak = u.ueninc[u.ulevel] = SPELL_LEV_PW(1);

    find_ac();     /* get initial ac value */
}

/*u_init.c*/

import { A_CHAOTIC } from "./align.h.js";
import { A_CON, A_STR } from "./attrib.h.js";
import {
    ARMOR_CLASS, COIN_CLASS, FOOD_CLASS, GEM_CLASS, MAXOCLASSES, POTION_CLASS, RING_CLASS,
    SCROLL_CLASS, SPBOOK_CLASS, TOOL_CLASS, WAND_CLASS, WEAPON_CLASS,
} from "./defsym.h.js";
import { discover } from "./flag.h.macros.js";
import { FALSE, TRUE } from "./global.h.js";
import { ROLL_FROM, rn1 } from "./hack.h.macros.js";
import { showdebug } from "./lint.h.macros.js";
import {
    NON_PM, PM_ARCHEOLOGIST, PM_BARBARIAN, PM_CAVE_DWELLER, PM_CLERIC, PM_DWARF, PM_ELF, PM_GNOME,
    PM_HEALER, PM_HUMAN, PM_KNIGHT, PM_MONK, PM_ORC, PM_RANGER, PM_ROGUE, PM_SAMURAI, PM_TOURIST,
    PM_VALKYRIE, PM_WIZARD,
} from "./monsters.h.js";
import { struct_obj } from "./obj.h.js";
import {
    Is_container, bimanual, is_ammo, is_boots, is_cloak, is_gloves, is_graystone, is_helmet,
    is_launcher, is_missile, is_pole, is_shield, is_shirt, is_spear, is_suit, is_weptool,
} from "./obj.h.macros.js";
import { MAXSPELL } from "./objclass.h.js";
import { OBJ_DESCR, OBJ_NAME } from "./objclass.h.macros.js";
import {
    APPLE, ARROW, AXE, BATTLE_AXE, BELL, BLINDFOLD, BOW, BUGLE, BULLWHIP, CARROT, CHAIN_MAIL,
    CLOAK_OF_DISPLACEMENT, CLOAK_OF_MAGIC_RESISTANCE, CLOVE_OF_GARLIC, CLUB, CORNUTHAUM,
    CRAM_RATION, CREDIT_CARD, CROSSBOW, CROSSBOW_BOLT, DAGGER, DART, DUNCE_CAP, DWARVISH_CLOAK,
    DWARVISH_IRON_HELM, DWARVISH_MATTOCK, DWARVISH_MITHRIL_COAT, DWARVISH_ROUNDSHIELD,
    DWARVISH_SHORT_SWORD, DWARVISH_SPEAR, ELVEN_ARROW, ELVEN_BOOTS, ELVEN_BOW, ELVEN_BROADSWORD,
    ELVEN_CLOAK, ELVEN_DAGGER, ELVEN_LEATHER_HELM, ELVEN_MITHRIL_COAT, ELVEN_SHIELD,
    ELVEN_SHORT_SWORD, ELVEN_SPEAR, EXPENSIVE_CAMERA, FEDORA, FLINT, FOOD_RATION, FORTUNE_COOKIE,
    GOLD_PIECE, HAWAIIAN_SHIRT, HELMET, KATANA, LANCE, LEASH, LEATHER_ARMOR, LEATHER_DRUM,
    LEATHER_GLOVES, LEATHER_JACKET, LEMBAS_WAFER, LOCK_PICK, LONG_SWORD, MACE, MAGIC_MARKER,
    NUM_OBJECTS, OIL_LAMP, ORANGE, ORCISH_ARROW, ORCISH_BOW, ORCISH_CHAIN_MAIL, ORCISH_CLOAK,
    ORCISH_DAGGER, ORCISH_HELM, ORCISH_RING_MAIL, ORCISH_SHIELD, ORCISH_SHORT_SWORD, ORCISH_SPEAR,
    PANCAKE, PICK_AXE, POT_ACID, POT_EXTRA_HEALING, POT_FULL_HEALING, POT_HALLUCINATION,
    POT_HEALING, POT_OIL, POT_POLYMORPH, POT_SICKNESS, POT_WATER, QUARTERSTAFF, RING_MAIL,
    RIN_AGGRAVATE_MONSTER, RIN_HUNGER, RIN_LEVITATION, RIN_POISON_RESISTANCE, RIN_POLYMORPH,
    RIN_POLYMORPH_CONTROL, ROBE, ROCK, SACK, SCALPEL, SCR_AMNESIA, SCR_BLANK_PAPER,
    SCR_ENCHANT_WEAPON, SCR_FIRE, SCR_MAGIC_MAPPING, SHORT_SWORD, SHURIKEN, SLING, SMALL_SHIELD,
    SPEAR, SPE_BLANK_PAPER, SPE_CONFUSE_MONSTER, SPE_EXTRA_HEALING, SPE_FORCE_BOLT, SPE_HEALING,
    SPE_NOVEL, SPE_POLYMORPH, SPE_PROTECTION, SPE_STONE_TO_FLESH, SPLINT_MAIL, SPRIG_OF_WOLFSBANE,
    STATUE, STETHOSCOPE, STRANGE_OBJECT, TINNING_KIT, TIN_OPENER, TOOLED_HORN, TOUCHSTONE, TOWEL,
    TRIPE_RATION, TWO_HANDED_SWORD, URUK_HAI_SHIELD, WAN_NOTHING, WAN_POLYMORPH, WAN_SLEEP,
    WAN_WISHING, WOODEN_FLUTE, WOODEN_HARP, YA, YUMI,
} from "./objects.h.js";
import {
    BLINDED, FROMOUTSIDE, JUMPING, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU,
} from "./prop.h.js";
import {
    P_ATTACK_SPELL, P_AXE, P_BARE_HANDED_COMBAT, P_BASIC, P_BOOMERANG, P_BOW, P_BROAD_SWORD,
    P_CLERIC_SPELL, P_CLUB, P_CROSSBOW, P_DAGGER, P_DART, P_DIVINATION_SPELL, P_ENCHANTMENT_SPELL,
    P_ESCAPE_SPELL, P_EXPERT, P_FLAIL, P_GRAND_MASTER, P_HAMMER, P_HEALING_SPELL, P_KNIFE, P_LANCE,
    P_LONG_SWORD, P_MACE, P_MARTIAL_ARTS, P_MASTER, P_MATTER_SPELL, P_MORNING_STAR, P_NONE,
    P_NUM_SKILLS, P_PICK_AXE, P_POLEARMS, P_QUARTERSTAFF, P_RIDING, P_SABER, P_SHORT_SWORD,
    P_SHURIKEN, P_SKILLED, P_SLING, P_SPEAR, P_TRIDENT, P_TWO_HANDED_SWORD, P_TWO_WEAPON_COMBAT,
    P_UNICORN_HORN, P_UNSKILLED, P_WHIP, struct_def_skill,
} from "./skills.h.js";
import { P_SKILL } from "./skills.h.macros.js";
import { NO_SPELL } from "./spell.h.js";
import { SPELL_LEV_PW } from "./spell.h.macros.js";
import {
    A_CURRENT, A_ORIGINAL, LEFT_HANDED, RIGHT_HANDED, struct_u_realtime, struct_u_roleplay,
    struct_you,
} from "./you.h.js";
import { Race_if, Race_switch, Role_if, Role_switch } from "./you.h.macros.js";
import { char, int, long, ord, schar, short, sizeof, uchar, unsigned } from "../rt/ctypes.js";
import { global_ref } from "../rt/globals.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { or64 } from "../rt/int64.js";
import { memset } from "../rt/libc.js";
import { init_list, stack_array, stack_struct, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, ptr_add, ptr_to, struct, struct_assign } from "../rt/struct.js";
import { adjabil, adjattrib, init_attr, newhp, vary_init_attr } from "./attrib.js";
import { max_rank_sz } from "./botl.js";
import { getnow } from "./calendar.js";
import { cg, flags, gi, gl, gn, gu, iflags, svb, svm, svs, u, urealtime } from "./decl.js";
import { find_ac } from "./do_wear.js";
import { init_uhunger } from "./eat.js";
import { panic } from "./end.js";
import { newpw } from "./exper.js";
import { inv_weight } from "./hack.js";
import { addinv, useupall } from "./invent.js";
import { dealloc_obj, mkobj, mksobj, weight } from "./mkobj.js";
import { discover_object } from "./o_init.js";
import { objects } from "./objects.js";
import { Japanese_item_name } from "./objnam.js";
import { pline } from "./pline.js";
import { set_uasmon } from "./polyself.js";
import { rn2, rnd, rne } from "./rnd.js";
import { aligns } from "./role.js";
import { initialspell, num_spells, spell_skilltype } from "./spell.js";
import { hidden_gold } from "./vault.js";
import { skill_init } from "./weapon.js";
import { set_twoweap, setuqwep, setuswapwep, setuwep } from "./wield.js";
import { setworn } from "./worn.js";
const __FILE__ = "u_init.c";
