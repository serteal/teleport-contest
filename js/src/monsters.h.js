/* NetHack 5.0	monsters.h	$NHDT-Date: 1723945838 2024/08/18 01:50:38 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.124 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2006. */
/* NetHack may be freely redistributed.  See license for details. */

/*
 *      Entry Format:   (from permonst.h)
 *
 *      name, symbol (S_* defines),
 *      base monster level, move rate, armor class, magic resistance,
 *      alignment, creation/geno flags (G_* defines),
 *      6 * attack structs ( type , damage-type, # dice, # sides ),
 *      weight (WT_* defines), nutritional value, extension length,
 *      sounds made (MS_* defines), physical size (MZ_* defines),
 *      resistances, resistances conferred (both MR_* defines),
 *      3 * flag bitmaps (M1_*, M2_*, and M3_* defines respectively),
 *      difficulty, symbol color.
 *
 *      The difficulty was generated in separate array monstr[] with
 *      values calculated by makedefs, but has been moved into mons[]
 *      since it rarely changes.  If a new monster is added or an old
 *      one undergoes significant change, 'makedefs -m' can be used to
 *      create a dummy monstr.c containing the calculated difficulty
 *      (of everything in mons[], not just any new or changed ones),
 *      then the value(s) can be plugged in here and monstr.c deleted.
 *      [Note that some monsters might warrant manually calculated
 *      difficulty, on a case by case basis, instead of blindly using
 *      the default value produced by makedefs.  Or fix the algorithm
 *      used by makedefs to generate a more appropriate value....]
 *
 *      TODO:  difficulty is closely related to level; its field ought
 *      to be moved sooner in the permonst struct so that it can become
 *      part of LVL() instead of remaining an orphan near the end.
 *
 *      Rule #1:        monsters of a given class are contiguous in the
 *                      mons[] array.
 *
 *      Rule #2:        monsters of a given class are generally kept in
 *                      the same order as in previous versions of NetHack
 *                      (they used to be presented in ascending order of
 *                      strength, but this rule no longer applies).
 *
 *      Rule #3:        monster frequency is included in the geno mask;
 *                      the frequency can be from 0 to 7.  0's will also
 *                      be skipped during generation.
 *
 *      Rule #4:        monster subclasses (e.g. giants) should be kept
 *                      together, unless it violates Rule 2.  NOGEN monsters
 *                      won't violate Rule 2.
 *
 * Guidelines for color assignment:
 *
 *      * Use the same color for all `growth stages' of a monster (ex.
 *        little dog/big dog, baby naga/full-grown naga.
 *
 *      * Use colors given in names wherever possible. If the class has `real'
 *        members with strong color associations, use those.
 *
 *      * Favor `cool' colors for cold-resistant monsters, `warm' ones for
 *        fire-resistant ones.
 *
 *      * Try to reserve purple (magenta) for powerful `ruler' monsters (queen
 *        bee, kobold lord, &c.).
 *
 *      * Subject to all these constraints, try to use color to make as many
 *        distinctions as the / command (that is, within a monster letter
 *        distinct names should map to distinct colors).
 *
 * The aim in assigning colors is to be consistent enough so a player can
 * become `intuitive' about them, deducing some or all of these rules
 * unconsciously. Use your common sense.
 */

    /*
     * ants
     */
    export const PM_GIANT_ANT = 0;

    export const PM_KILLER_BEE = PM_GIANT_ANT + 1;

    export const PM_SOLDIER_ANT = PM_KILLER_BEE + 1;

    export const PM_FIRE_ANT = PM_SOLDIER_ANT + 1;

    export const PM_GIANT_BEETLE = PM_FIRE_ANT + 1;

    export const PM_QUEEN_BEE = PM_GIANT_BEETLE + 1;

    /*
     * blobs
     */
    export const PM_ACID_BLOB = PM_QUEEN_BEE + 1;

    export const PM_QUIVERING_BLOB = PM_ACID_BLOB + 1;

    export const PM_GELATINOUS_CUBE = PM_QUIVERING_BLOB + 1;

    /*
     * cockatrice
     */
    export const PM_CHICKATRICE = PM_GELATINOUS_CUBE + 1;

    export const PM_COCKATRICE = PM_CHICKATRICE + 1;

    export const PM_PYROLISK = PM_COCKATRICE + 1;

    /*
     * dogs & other canines
     */
    export const PM_JACKAL = PM_PYROLISK + 1;

    export const PM_FOX = PM_JACKAL + 1;

    export const PM_COYOTE = PM_FOX + 1;

    export const PM_WEREJACKAL = PM_COYOTE + 1;

    export const PM_LITTLE_DOG = PM_WEREJACKAL + 1;

    export const PM_DINGO = PM_LITTLE_DOG + 1;

    export const PM_DOG = PM_DINGO + 1;

    export const PM_LARGE_DOG = PM_DOG + 1;

    export const PM_WOLF = PM_LARGE_DOG + 1;

    /* werewolf in wolf form; one in human form uses a different monster
       type (in the S_HUMAN section below); switching back and forth is
       a shape-change that sets monst->data to the appropriate monster */
    export const PM_WEREWOLF = PM_WOLF + 1;

    export const PM_WINTER_WOLF_CUB = PM_WEREWOLF + 1;

    export const PM_WARG = PM_WINTER_WOLF_CUB + 1;

    export const PM_WINTER_WOLF = PM_WARG + 1;

    export const PM_HELL_HOUND_PUP = PM_WINTER_WOLF + 1;

    export const PM_HELL_HOUND = PM_HELL_HOUND_PUP + 1;

    /*
     * eyes
     */
    export const PM_GAS_SPORE = PM_HELL_HOUND + 1;

    export const PM_FLOATING_EYE = PM_GAS_SPORE + 1;

    export const PM_FREEZING_SPHERE = PM_FLOATING_EYE + 1;

    export const PM_FLAMING_SPHERE = PM_FREEZING_SPHERE + 1;

    export const PM_SHOCKING_SPHERE = PM_FLAMING_SPHERE + 1;

    /*
     * felines
     */
    export const PM_KITTEN = PM_SHOCKING_SPHERE + 1;

    export const PM_HOUSECAT = PM_KITTEN + 1;

    export const PM_JAGUAR = PM_HOUSECAT + 1;

    export const PM_LYNX = PM_JAGUAR + 1;

    export const PM_PANTHER = PM_LYNX + 1;

    export const PM_LARGE_CAT = PM_PANTHER + 1;

    export const PM_TIGER = PM_LARGE_CAT + 1;

    export const PM_DISPLACER_BEAST = PM_TIGER + 1;

    /*
     * gremlins and gargoyles
     */
    export const PM_GREMLIN = PM_DISPLACER_BEAST + 1;

    /* gargoyle and winged gargoyle are inspired by a cheesy made-for-TV
       horror movie (starring Cornel Wilde and Jennifer Salt, 1972) */
    export const PM_GARGOYLE = PM_GREMLIN + 1;

    export const PM_WINGED_GARGOYLE = PM_GARGOYLE + 1;

    /*
     * humanoids
     */
    export const PM_HOBBIT = PM_WINGED_GARGOYLE + 1;

    /* unlike plain human|elf|orc, plain "dwarf" is an ordinary monster */
    export const PM_DWARF = PM_HOBBIT + 1;

    export const PM_BUGBEAR = PM_DWARF + 1;

    export const PM_DWARF_LEADER = PM_BUGBEAR + 1;

    export const PM_DWARF_RULER = PM_DWARF_LEADER + 1;

    export const PM_MIND_FLAYER = PM_DWARF_RULER + 1;

    export const PM_MASTER_MIND_FLAYER = PM_MIND_FLAYER + 1;

    /*
     * imps & other minor demons/devils
     */
    export const PM_MANES = PM_MASTER_MIND_FLAYER + 1;

    export const PM_HOMUNCULUS = PM_MANES + 1;

    export const PM_IMP = PM_HOMUNCULUS + 1;

    export const PM_LEMURE = PM_IMP + 1;

    export const PM_QUASIT = PM_LEMURE + 1;

    export const PM_TENGU = PM_QUASIT + 1;

    /*
     * jellies
     */
    export const PM_BLUE_JELLY = PM_TENGU + 1;

    export const PM_SPOTTED_JELLY = PM_BLUE_JELLY + 1;

    export const PM_OCHRE_JELLY = PM_SPOTTED_JELLY + 1;

    /*
     * kobolds
     */
    export const PM_KOBOLD = PM_OCHRE_JELLY + 1;

    export const PM_LARGE_KOBOLD = PM_KOBOLD + 1;

    export const PM_KOBOLD_LEADER = PM_LARGE_KOBOLD + 1;

    export const PM_KOBOLD_SHAMAN = PM_KOBOLD_LEADER + 1;

    /*
     * leprechauns
     */
    export const PM_LEPRECHAUN = PM_KOBOLD_SHAMAN + 1;

    /*
     * mimics
     */
    export const PM_SMALL_MIMIC = PM_LEPRECHAUN + 1;

    export const PM_LARGE_MIMIC = PM_SMALL_MIMIC + 1;

    export const PM_GIANT_MIMIC = PM_LARGE_MIMIC + 1;

    /*
     * nymphs
     */
    export const PM_WOOD_NYMPH = PM_GIANT_MIMIC + 1;

    export const PM_WATER_NYMPH = PM_WOOD_NYMPH + 1;

    export const PM_MOUNTAIN_NYMPH = PM_WATER_NYMPH + 1;

    /*
     * orcs
     */
    export const PM_GOBLIN = PM_MOUNTAIN_NYMPH + 1;

    export const PM_HOBGOBLIN = PM_GOBLIN + 1;

    /* Plain "orc" for zombie and mummy corpses only; not created at random.
     * Orcs (but not goblins and hobgoblins) are granted poison resistance;
     * however, their corpses don't confer it. */
    export const PM_ORC = PM_HOBGOBLIN + 1;

    export const PM_HILL_ORC = PM_ORC + 1;

    export const PM_MORDOR_ORC = PM_HILL_ORC + 1;

    export const PM_URUK_HAI = PM_MORDOR_ORC + 1;

    export const PM_ORC_SHAMAN = PM_URUK_HAI + 1;

    export const PM_ORC_CAPTAIN = PM_ORC_SHAMAN + 1;

    /*
     * piercers
     */
    export const PM_ROCK_PIERCER = PM_ORC_CAPTAIN + 1;

    export const PM_IRON_PIERCER = PM_ROCK_PIERCER + 1;

    export const PM_GLASS_PIERCER = PM_IRON_PIERCER + 1;

    /*
     * quadrupeds
     *  (note: horses are grouped with unicorns in another section below)
     */
    export const PM_ROTHE = PM_GLASS_PIERCER + 1;

    export const PM_MUMAK = PM_ROTHE + 1;

    export const PM_LEOCROTTA = PM_MUMAK + 1;

    export const PM_WUMPUS = PM_LEOCROTTA + 1;

    export const PM_TITANOTHERE = PM_WUMPUS + 1;

    export const PM_BALUCHITHERIUM = PM_TITANOTHERE + 1;

    export const PM_MASTODON = PM_BALUCHITHERIUM + 1;

    /*
     * rodents
     */
    export const PM_SEWER_RAT = PM_MASTODON + 1;

    export const PM_GIANT_RAT = PM_SEWER_RAT + 1;

    export const PM_RABID_RAT = PM_GIANT_RAT + 1;

    export const PM_WERERAT = PM_RABID_RAT + 1;

    export const PM_ROCK_MOLE = PM_WERERAT + 1;

    export const PM_WOODCHUCK = PM_ROCK_MOLE + 1;

        /*LOGGING*/

        /* In reality, they tunnel instead of cutting lumber.  Oh, well. */

    /*
     * spiders & scorpions (keep webmaker() in sync if new critters are added)
     */
    export const PM_CAVE_SPIDER = PM_WOODCHUCK + 1;

    export const PM_CENTIPEDE = PM_CAVE_SPIDER + 1;

    export const PM_GIANT_SPIDER = PM_CENTIPEDE + 1;

    export const PM_SCORPION = PM_GIANT_SPIDER + 1;

    /*
     * trappers, lurkers, &c
     * Note:  prior to 5.0, these were defined to do AD_DGST damage,
     * but they don't swallow their victims into their stomachs and
     * digest, they enfold and crush or suffocate.
     * The Monster Manual states that someone engulfed by a trapper
     * can't use weapons but we do not enforce that.
     */
    export const PM_LURKER_ABOVE = PM_SCORPION + 1;

    export const PM_TRAPPER = PM_LURKER_ABOVE + 1;

    /*
     * unicorns and horses
     */
    export const PM_PONY = PM_TRAPPER + 1;

    export const PM_WHITE_UNICORN = PM_PONY + 1;

    export const PM_GRAY_UNICORN = PM_WHITE_UNICORN + 1;

    export const PM_BLACK_UNICORN = PM_GRAY_UNICORN + 1;

    export const PM_HORSE = PM_BLACK_UNICORN + 1;

    export const PM_WARHORSE = PM_HORSE + 1;

    /*
     * vortices
     */
    export const PM_FOG_CLOUD = PM_WARHORSE + 1;

    export const PM_DUST_VORTEX = PM_FOG_CLOUD + 1;

    export const PM_ICE_VORTEX = PM_DUST_VORTEX + 1;

    export const PM_ENERGY_VORTEX = PM_ICE_VORTEX + 1;

    export const PM_STEAM_VORTEX = PM_ENERGY_VORTEX + 1;

    export const PM_FIRE_VORTEX = PM_STEAM_VORTEX + 1;

    /*
     * worms
     */
    export const PM_BABY_LONG_WORM = PM_FIRE_VORTEX + 1;

    export const PM_BABY_PURPLE_WORM = PM_BABY_LONG_WORM + 1;

    export const PM_LONG_WORM = PM_BABY_PURPLE_WORM + 1;

    export const PM_PURPLE_WORM = PM_LONG_WORM + 1;

    /*
     * xan, &c
     */
    export const PM_GRID_BUG = PM_PURPLE_WORM + 1;

    export const PM_XAN = PM_GRID_BUG + 1;

    /*
     * lights
     */
    /* yellow light is visible and its suicidal explosion causes blindness */
    export const PM_YELLOW_LIGHT = PM_XAN + 1;

    /* black light is invisible and causes hallucination */
    export const PM_BLACK_LIGHT = PM_YELLOW_LIGHT + 1;

    /*
     * zruty
     */
    export const PM_ZRUTY = PM_BLACK_LIGHT + 1;

    /*
     * Angels and other lawful minions
     */
    export const PM_COUATL = PM_ZRUTY + 1;

    export const PM_ALEAX = PM_COUATL + 1;

    /* Angels start with the emin extension attached, and usually have
       the isminion flag set; however, non-minion Angels can be tamed
       and will switch to edog (guardian Angel is handled specially and
       always sticks with emin) */
    export const PM_ANGEL = PM_ALEAX + 1;

    /* the AD&D Monster Manual depicts ki-rin as very similar to unicorns
       except that they fly (without wings) and can cast spells; nethack's
       ki-rin doesn't leave its horn when killed, but it can use the horn
       while alive to cure itself of various maladies */
    export const PM_KI_RIN = PM_ANGEL + 1;

    export const PM_ARCHON = PM_KI_RIN + 1;

    /*
     * Bats and birds
     */
    export const PM_BAT = PM_ARCHON + 1;

    export const PM_GIANT_BAT = PM_BAT + 1;

    export const PM_RAVEN = PM_GIANT_BAT + 1;

    export const PM_VAMPIRE_BAT = PM_RAVEN + 1;

    /*
     * Centaurs
     */
    export const PM_PLAINS_CENTAUR = PM_VAMPIRE_BAT + 1;

    export const PM_FOREST_CENTAUR = PM_PLAINS_CENTAUR + 1;

    export const PM_MOUNTAIN_CENTAUR = PM_FOREST_CENTAUR + 1;

    /*
     * Dragons
     */
    /* The order of the dragons is VERY IMPORTANT.  Quite a few
     * pieces of code depend on gray being first and yellow being last.
     * The code also depends on the *order* being the same as that for
     * dragon scale mail and dragon scales in objects.c.  [Also,
     * 'tilemap' assumes that shimmering dragon follows silver dragon.]
     *
     * Adult dragons are all lawful or chaotic; baby dragons are all
     * neutral.  This affects monster generation on some special levels.
     * Baby dragons cannot confer intrinsics, to avoid polyself/egg abuse.
     *
     * As reptiles, dragons are cold-blooded and thus aren't seen with
     * infravision.  Red and gold dragons (also Chromatic Dragon) are
     * the exceptions because they breathe fire.
     */
    export const PM_BABY_GRAY_DRAGON = PM_MOUNTAIN_CENTAUR + 1;

    export const PM_BABY_GOLD_DRAGON = PM_BABY_GRAY_DRAGON + 1;

    export const PM_BABY_SILVER_DRAGON = PM_BABY_GOLD_DRAGON + 1;

    /* [see "shimmering dragon" below] */

    export const PM_BABY_RED_DRAGON = PM_BABY_SILVER_DRAGON + 1;

    export const PM_BABY_WHITE_DRAGON = PM_BABY_RED_DRAGON + 1;

    export const PM_BABY_ORANGE_DRAGON = PM_BABY_WHITE_DRAGON + 1;

    export const PM_BABY_BLACK_DRAGON = PM_BABY_ORANGE_DRAGON + 1;

    export const PM_BABY_BLUE_DRAGON = PM_BABY_BLACK_DRAGON + 1;

    export const PM_BABY_GREEN_DRAGON = PM_BABY_BLUE_DRAGON + 1;

    export const PM_BABY_YELLOW_DRAGON = PM_BABY_GREEN_DRAGON + 1;

    export const PM_GRAY_DRAGON = PM_BABY_YELLOW_DRAGON + 1;

    /* gold dragon can be seen via infravision but doesn't have infravision */
    export const PM_GOLD_DRAGON = PM_GRAY_DRAGON + 1;

    export const PM_SILVER_DRAGON = PM_GOLD_DRAGON + 1;

    /* shimmering scales/scale-mail would confer displacement when worn by
       the hero, so shimmering dragon ought to be displaced (hero who can
       see one might misjudge its location) but monster displacement hasn't
       been implemented so we don't include it */

    /* red dragon has infravision and can be seen via infravision */
    export const PM_RED_DRAGON = PM_SILVER_DRAGON + 1;

    export const PM_WHITE_DRAGON = PM_RED_DRAGON + 1;

    export const PM_ORANGE_DRAGON = PM_WHITE_DRAGON + 1;

    /* disintegration breath is actually all or nothing, not 1d255 */
    export const PM_BLACK_DRAGON = PM_ORANGE_DRAGON + 1;

    export const PM_BLUE_DRAGON = PM_BLACK_DRAGON + 1;

    export const PM_GREEN_DRAGON = PM_BLUE_DRAGON + 1;

    export const PM_YELLOW_DRAGON = PM_GREEN_DRAGON + 1;

    /*
     * Elementals
     */
    export const PM_STALKER = PM_YELLOW_DRAGON + 1;

    export const PM_AIR_ELEMENTAL = PM_STALKER + 1;

    export const PM_FIRE_ELEMENTAL = PM_AIR_ELEMENTAL + 1;

    export const PM_EARTH_ELEMENTAL = PM_FIRE_ELEMENTAL + 1;

    export const PM_WATER_ELEMENTAL = PM_EARTH_ELEMENTAL + 1;

    /*
     * Fungi
     */
    export const PM_LICHEN = PM_WATER_ELEMENTAL + 1;

    export const PM_BROWN_MOLD = PM_LICHEN + 1;

    export const PM_YELLOW_MOLD = PM_BROWN_MOLD + 1;

    export const PM_GREEN_MOLD = PM_YELLOW_MOLD + 1;

    export const PM_RED_MOLD = PM_GREEN_MOLD + 1;

    export const PM_SHRIEKER = PM_RED_MOLD + 1;

    export const PM_VIOLET_FUNGUS = PM_SHRIEKER + 1;

    /*
     * Gnomes
     *  Unlike plain human|elf|orc, plain "gnome" is an ordinary monster.
     */
    export const PM_GNOME = PM_VIOLET_FUNGUS + 1;

    export const PM_GNOME_LEADER = PM_GNOME + 1;

    export const PM_GNOMISH_WIZARD = PM_GNOME_LEADER + 1;

    export const PM_GNOME_RULER = PM_GNOMISH_WIZARD + 1;

    /*
     * giant Humanoids
     */
    /* plain giant is a placeholder for zombie and mummy corpses */
    export const PM_GIANT = PM_GNOME_RULER + 1;

    export const PM_STONE_GIANT = PM_GIANT + 1;

    export const PM_HILL_GIANT = PM_STONE_GIANT + 1;

    export const PM_FIRE_GIANT = PM_HILL_GIANT + 1;

    export const PM_FROST_GIANT = PM_FIRE_GIANT + 1;

    /* ettin is a two-headed giant but its corpse doesn't confer strength */
    export const PM_ETTIN = PM_FROST_GIANT + 1;

    export const PM_STORM_GIANT = PM_ETTIN + 1;

    export const PM_TITAN = PM_STORM_GIANT + 1;

    export const PM_MINOTAUR = PM_TITAN + 1;

    /*
     * Invisible
     * S_invisible=='I' is a visual marker for all invisible monsters
     * and must be not be used for any specific monster types.  Long
     * time 'invisible stalker' was changed to 'stalker', an Elemental.
     */

    /*
     * Jabberwock
     */
    /* the illustration from _Through_the_Looking_Glass_
       depicts hands as well as wings */
    export const PM_JABBERWOCK = PM_MINOTAUR + 1;

    /*
     * Kops
     */
    export const PM_KEYSTONE_KOP = PM_JABBERWOCK + 1;

    export const PM_KOP_SERGEANT = PM_KEYSTONE_KOP + 1;

    export const PM_KOP_LIEUTENANT = PM_KOP_SERGEANT + 1;

    export const PM_KOP_KAPTAIN = PM_KOP_LIEUTENANT + 1;

    /*
     * Liches
     */
    export const PM_LICH = PM_KOP_KAPTAIN + 1;

    export const PM_DEMILICH = PM_LICH + 1;

    export const PM_MASTER_LICH = PM_DEMILICH + 1;

    export const PM_ARCH_LICH = PM_MASTER_LICH + 1;

    /*
     * Mummies
     */
    export const PM_KOBOLD_MUMMY = PM_ARCH_LICH + 1;

    export const PM_GNOME_MUMMY = PM_KOBOLD_MUMMY + 1;

    export const PM_ORC_MUMMY = PM_GNOME_MUMMY + 1;

    export const PM_DWARF_MUMMY = PM_ORC_MUMMY + 1;

    export const PM_ELF_MUMMY = PM_DWARF_MUMMY + 1;

    export const PM_HUMAN_MUMMY = PM_ELF_MUMMY + 1;

    export const PM_ETTIN_MUMMY = PM_HUMAN_MUMMY + 1;

    export const PM_GIANT_MUMMY = PM_ETTIN_MUMMY + 1;

    /*
     * Nagas
     */
    export const PM_RED_NAGA_HATCHLING = PM_GIANT_MUMMY + 1;

    export const PM_BLACK_NAGA_HATCHLING = PM_RED_NAGA_HATCHLING + 1;

    export const PM_GOLDEN_NAGA_HATCHLING = PM_BLACK_NAGA_HATCHLING + 1;

    export const PM_GUARDIAN_NAGA_HATCHLING = PM_GOLDEN_NAGA_HATCHLING + 1;

    export const PM_RED_NAGA = PM_GUARDIAN_NAGA_HATCHLING + 1;

    export const PM_BLACK_NAGA = PM_RED_NAGA + 1;

    export const PM_GOLDEN_NAGA = PM_BLACK_NAGA + 1;

    /* 5.0: guardian naga used to have three attacks: bite, spit, hug
       but in order for the hug to succeed the two preceding attacks had
       to have hit, and it's not possible to both bite and spit, hence
       the hug never hit; change to spit, bite, touch, hug; if the bite
       and touch hit, the hug will too */
    export const PM_GUARDIAN_NAGA = PM_GOLDEN_NAGA + 1;

    /*
     * Ogres
     */
    export const PM_OGRE = PM_GUARDIAN_NAGA + 1;

    export const PM_OGRE_LEADER = PM_OGRE + 1;

    export const PM_OGRE_TYRANT = PM_OGRE_LEADER + 1;

    /*
     * Puddings
     *
     * must be in the same order as the pudding globs in objects.c
     */
    export const PM_GRAY_OOZE = PM_OGRE_TYRANT + 1;

    export const PM_BROWN_PUDDING = PM_GRAY_OOZE + 1;

    export const PM_GREEN_SLIME = PM_BROWN_PUDDING + 1;

    export const PM_BLACK_PUDDING = PM_GREEN_SLIME + 1;

    /*
     * Quantum mechanics
     */
    export const PM_QUANTUM_MECHANIC = PM_BLACK_PUDDING + 1;

    /* 5.0: from slash'em, to expand Q class; hit polymorphs target */
    export const PM_GENETIC_ENGINEER = PM_QUANTUM_MECHANIC + 1;

    /*
     * Rust monster or disenchanter
     */
    export const PM_RUST_MONSTER = PM_GENETIC_ENGINEER + 1;

    export const PM_DISENCHANTER = PM_RUST_MONSTER + 1;

    /*
     * Snakes
     *  Note: in the real world, most snakes are oviparous but some aren't;
     *  we treat all of these as if they are.
     */
    export const PM_GARTER_SNAKE = PM_DISENCHANTER + 1;

    export const PM_SNAKE = PM_GARTER_SNAKE + 1;

    export const PM_WATER_MOCCASIN = PM_SNAKE + 1;

    export const PM_PYTHON = PM_WATER_MOCCASIN + 1;

    export const PM_PIT_VIPER = PM_PYTHON + 1;

    export const PM_COBRA = PM_PIT_VIPER + 1;

    /*
     * Trolls
     */
    export const PM_TROLL = PM_COBRA + 1;

    export const PM_ICE_TROLL = PM_TROLL + 1;

    export const PM_ROCK_TROLL = PM_ICE_TROLL + 1;

    export const PM_WATER_TROLL = PM_ROCK_TROLL + 1;

    export const PM_OLOG_HAI = PM_WATER_TROLL + 1;

    /*
     * Umber hulk
     */
    export const PM_UMBER_HULK = PM_OLOG_HAI + 1;

    /*
     * Vampires
     */
    export const PM_VAMPIRE = PM_UMBER_HULK + 1;

    export const PM_VAMPIRE_LEADER = PM_VAMPIRE + 1;

    export const PM_VLAD_THE_IMPALER = PM_VAMPIRE_LEADER + 1;

    /*
     * Wraiths
     */
    export const PM_BARROW_WIGHT = PM_VLAD_THE_IMPALER + 1;

    /* wraiths weigh 0 but can leave corpses */
    export const PM_WRAITH = PM_BARROW_WIGHT + 1;

    export const PM_NAZGUL = PM_WRAITH + 1;

    /*
     * Xorn
     */
    export const PM_XORN = PM_NAZGUL + 1;

    /*
     * Apelike beasts
     */
    /* tameable via banana; does not grow up into ape...
       not flagged as domestic, so no guilt penalty for eating non-pet one */
    export const PM_MONKEY = PM_XORN + 1;

    export const PM_APE = PM_MONKEY + 1;

    export const PM_OWLBEAR = PM_APE + 1;

    export const PM_YETI = PM_OWLBEAR + 1;

    export const PM_CARNIVOROUS_APE = PM_YETI + 1;

    export const PM_SASQUATCH = PM_CARNIVOROUS_APE + 1;

    /*
     * Zombies
     */
    export const PM_KOBOLD_ZOMBIE = PM_SASQUATCH + 1;

    export const PM_GNOME_ZOMBIE = PM_KOBOLD_ZOMBIE + 1;

    export const PM_ORC_ZOMBIE = PM_GNOME_ZOMBIE + 1;

    export const PM_DWARF_ZOMBIE = PM_ORC_ZOMBIE + 1;

    export const PM_ELF_ZOMBIE = PM_DWARF_ZOMBIE + 1;

    export const PM_HUMAN_ZOMBIE = PM_ELF_ZOMBIE + 1;

    export const PM_ETTIN_ZOMBIE = PM_HUMAN_ZOMBIE + 1;

    export const PM_GHOUL = PM_ETTIN_ZOMBIE + 1;

    export const PM_GIANT_ZOMBIE = PM_GHOUL + 1;

    export const PM_SKELETON = PM_GIANT_ZOMBIE + 1;

    /*
     * golems
     */
    export const PM_STRAW_GOLEM = PM_SKELETON + 1;

    export const PM_PAPER_GOLEM = PM_STRAW_GOLEM + 1;

    export const PM_ROPE_GOLEM = PM_PAPER_GOLEM + 1;

    export const PM_GOLD_GOLEM = PM_ROPE_GOLEM + 1;

    export const PM_LEATHER_GOLEM = PM_GOLD_GOLEM + 1;

    export const PM_WOOD_GOLEM = PM_LEATHER_GOLEM + 1;

    export const PM_FLESH_GOLEM = PM_WOOD_GOLEM + 1;

    export const PM_CLAY_GOLEM = PM_FLESH_GOLEM + 1;

    export const PM_STONE_GOLEM = PM_CLAY_GOLEM + 1;

    export const PM_GLASS_GOLEM = PM_STONE_GOLEM + 1;

    export const PM_IRON_GOLEM = PM_GLASS_GOLEM + 1;

    /*
     * humans, including elves and were-critters;
     *  the '@' class does not obey rule #2.
     *  Plain "human" is a placeholder, not a normal monster.
     */
    export const PM_HUMAN = PM_IRON_GOLEM + 1; /* for corpses */

    export const PM_HUMAN_WERERAT = PM_HUMAN + 1;

    export const PM_HUMAN_WEREJACKAL = PM_HUMAN_WERERAT + 1;

    export const PM_HUMAN_WEREWOLF = PM_HUMAN_WEREJACKAL + 1;

    /* plain "elf" is a placeholder, not a normal monster */
    export const PM_ELF = PM_HUMAN_WEREWOLF + 1; /* for corpses */

    export const PM_WOODLAND_ELF = PM_ELF + 1;

    export const PM_GREEN_ELF = PM_WOODLAND_ELF + 1;

    export const PM_GREY_ELF = PM_GREEN_ELF + 1;

    export const PM_ELF_NOBLE = PM_GREY_ELF + 1;

    export const PM_ELVEN_MONARCH = PM_ELF_NOBLE + 1;

    export const PM_DOPPELGANGER = PM_ELVEN_MONARCH + 1;

    /* 5.0: shopkeepers used to have speed 18, but if/when they were
       hasted they always got 2 moves per turn and had a tendency to move
       away from blocking the door and then move right back; since they
       might start with a potion of speed and drink that as soon as the
       hero gets close, once inside the shop the hero could have trouble
       getting out again; also, being slowed still guaranteed one move
       per turn; reduce their innate speed from 18 to 16 for a hasted
       speed of 22 rather than 24 and slowed speed of 11 rather than 12;
       they will still block the shop door, but not as tenaciously */
    export const PM_SHOPKEEPER = PM_DOPPELGANGER + 1;

    /* vault guard */
    export const PM_GUARD = PM_SHOPKEEPER + 1;

    /* prisoner is used on some special levels */
    export const PM_PRISONER = PM_GUARD + 1;

    /* the Oracle of Delphi doesn't move */
    export const PM_ORACLE = PM_PRISONER + 1;

    /* aligned priests always have the epri extension attached;
       individual instantiations should always have either ispriest
       or isminion set; role monster priests are separate (below) */
    export const PM_ALIGNED_CLERIC = PM_ORACLE + 1;

    /* high priests always have epri and always have ispriest set;
       they are flagged as unique even through they aren't */
    export const PM_HIGH_CLERIC = PM_ALIGNED_CLERIC + 1;

    export const PM_SOLDIER = PM_HIGH_CLERIC + 1;

    export const PM_SERGEANT = PM_SOLDIER + 1;

    export const PM_NURSE = PM_SERGEANT + 1;

    export const PM_LIEUTENANT = PM_NURSE + 1;

    export const PM_CAPTAIN = PM_LIEUTENANT + 1;

    export const PM_WATCHMAN = PM_CAPTAIN + 1;

    export const PM_WATCH_CAPTAIN = PM_WATCHMAN + 1;

    /* Unique humans not tied to quests.
     */
    export const PM_MEDUSA = PM_WATCH_CAPTAIN + 1;

    export const PM_WIZARD_OF_YENDOR = PM_MEDUSA + 1;

    export const PM_CROESUS = PM_WIZARD_OF_YENDOR + 1;

    /*
     * ghosts
     *  ghosts and shades don't leave corpses; assigning human weight
     *  to them matters for statues
     */
    export const PM_GHOST = PM_CROESUS + 1;

    export const PM_SHADE = PM_GHOST + 1;

    /*
     * (major) demons
     */
    export const PM_WATER_DEMON = PM_SHADE + 1;

    /* standard demons & devils
     */

    /* incubus and succubus; prior to 5.0, succubus and incubus were
       distinct monsters; "amorous demon" is considered to be a temporary
       placeholder but may be here to stay... */
    export const PM_AMOROUS_DEMON = PM_WATER_DEMON + 1;

    export const PM_HORNED_DEVIL = PM_AMOROUS_DEMON + 1;

    /* Used by AD&D for a type of demon, originally one of the Furies
       and spelled this way; plural is erinyes */
    export const PM_ERINYS = PM_HORNED_DEVIL + 1;

        /* erinys attacks (among other things) are variable depending on your
           alignment abuse, can be increased from here by adj_erinys(mon.c) */

    export const PM_BARBED_DEVIL = PM_ERINYS + 1;

    export const PM_MARILITH = PM_BARBED_DEVIL + 1;

    export const PM_VROCK = PM_MARILITH + 1;

    export const PM_HEZROU = PM_VROCK + 1;

    export const PM_BONE_DEVIL = PM_HEZROU + 1;

    export const PM_ICE_DEVIL = PM_BONE_DEVIL + 1;

    export const PM_NALFESHNEE = PM_ICE_DEVIL + 1;

    export const PM_PIT_FIEND = PM_NALFESHNEE + 1;

    /* from Jack Vance's _Rhialto_the_Marvellous_, one of the sequels
       to _The_Dying_Earth_ */
    export const PM_SANDESTIN = PM_PIT_FIEND + 1;

    export const PM_BALROG = PM_SANDESTIN + 1;

    /* Named demon lords & princes plus Arch-Devils.
     * (their order matters; see minion.c)
     */
    export const PM_JUIBLEX = PM_BALROG + 1;

    export const PM_YEENOGHU = PM_JUIBLEX + 1;

    export const PM_ORCUS = PM_YEENOGHU + 1;

    export const PM_GERYON = PM_ORCUS + 1;

    export const PM_DISPATER = PM_GERYON + 1;

    export const PM_BAALZEBUB = PM_DISPATER + 1;

    export const PM_ASMODEUS = PM_BAALZEBUB + 1;

    export const PM_DEMOGORGON = PM_ASMODEUS + 1;

    /* Riders -- the Four Horsemen of the Apocalypse ("War" == player);
     * depicted with '&' but do not have M2_DEMON set.
     */
    export const PM_DEATH = PM_DEMOGORGON + 1;

    export const PM_PESTILENCE = PM_DEATH + 1;

    export const PM_FAMINE = PM_PESTILENCE + 1;

    /* other demons
     */

    export const PM_MAIL_DAEMON = PM_FAMINE + 1;

    /* djinni is singular; plural is djinn */
    export const PM_DJINNI = PM_MAIL_DAEMON + 1;

    /*
     * sea monsters
     *
     * 5.0: all the fish except kraken used to specify M1_SLITHY, presumably
     * cloned from giant eel.  Using "slither" to describe their movement
     * wasn't appropriate.  Unfortunately, locomotion() isn't able to choose
     * "swim" as their movement description because it is only passed a
     * monster type, not a specific monster (for <mx,my>) or the relevant
     * location, and therefore doesn't know whether water is involved.
     */
    export const PM_JELLYFISH = PM_DJINNI + 1;

    export const PM_PIRANHA = PM_JELLYFISH + 1;

    export const PM_SHARK = PM_PIRANHA + 1;

    export const PM_GIANT_EEL = PM_SHARK + 1;

    export const PM_ELECTRIC_EEL = PM_GIANT_EEL + 1;

    export const PM_KRAKEN = PM_ELECTRIC_EEL + 1;

    /*
     * lizards, &c
     */
    export const PM_NEWT = PM_KRAKEN + 1;

    export const PM_GECKO = PM_NEWT + 1;

    export const PM_IGUANA = PM_GECKO + 1;

    export const PM_BABY_CROCODILE = PM_IGUANA + 1;

    /* trivia:  before monster corpses were implemented, "lizard corpse"
       was a specific type of item */
    export const PM_LIZARD = PM_BABY_CROCODILE + 1;

    export const PM_CHAMELEON = PM_LIZARD + 1;

    export const PM_CROCODILE = PM_CHAMELEON + 1;

    export const PM_SALAMANDER = PM_CROCODILE + 1;

    /*
     * dummy monster needed for visual interface
     * (marking it unique prevents figurines)
     */
    export const PM_LONG_WORM_TAIL = PM_SALAMANDER + 1;

    /* Note:
     * Worm tail must be between the normal monsters and the special
     * quest & pseudo-character ones because an optimization in the
     * random monster selection code assumes everything beyond here
     * has the G_NOGEN and M2_NOPOLY attributes.
     */

    /*
     * character classes
     */
    export const PM_ARCHEOLOGIST = PM_LONG_WORM_TAIL + 1;

    export const PM_BARBARIAN = PM_ARCHEOLOGIST + 1;

    export const PM_CAVE_DWELLER = PM_BARBARIAN + 1;

    export const PM_HEALER = PM_CAVE_DWELLER + 1;

    export const PM_KNIGHT = PM_HEALER + 1;

    export const PM_MONK = PM_KNIGHT + 1;

    /* monster priests are separate monsters (above; "aligned cleric") */
    export const PM_CLERIC = PM_MONK + 1;

    export const PM_RANGER = PM_CLERIC + 1;

    export const PM_ROGUE = PM_RANGER + 1;

    export const PM_SAMURAI = PM_ROGUE + 1;

    export const PM_TOURIST = PM_SAMURAI + 1;

    /* valk is lawful by default; player valk can be neutral, in which case
       role_init() will change this monster and 'warrior' to be neutral too;
       if a neutral valk leaves a bones file containing neutral warriors,
       the latter will magically turn lawful if encountered by a lawful valk
       or any non-valk (for bones on the dungeon side of the portal) */
    export const PM_VALKYRIE = PM_TOURIST + 1;

    export const PM_WIZARD = PM_VALKYRIE + 1;

    /*
     * quest leaders
     */
    export const PM_LORD_CARNARVON = PM_WIZARD + 1;

    export const PM_PELIAS = PM_LORD_CARNARVON + 1;

    export const PM_SHAMAN_KARNOV = PM_PELIAS + 1;

    /* Two for elves - one of each sex.
     */

    export const PM_HIPPOCRATES = PM_SHAMAN_KARNOV + 1;

    export const PM_KING_ARTHUR = PM_HIPPOCRATES + 1;

    export const PM_GRAND_MASTER = PM_KING_ARTHUR + 1;

    export const PM_ARCH_PRIEST = PM_GRAND_MASTER + 1;

    export const PM_ORION = PM_ARCH_PRIEST + 1;

    /* Note: Master of Thieves is also the Tourist's nemesis.
     */
    export const PM_MASTER_OF_THIEVES = PM_ORION + 1;

    export const PM_LORD_SATO = PM_MASTER_OF_THIEVES + 1;

    export const PM_TWOFLOWER = PM_LORD_SATO + 1;

    /* for a valkyrie hero, Norn's alignment will be changed to match hero's
       starting alignment */
    export const PM_NORN = PM_TWOFLOWER + 1;

    export const PM_NEFERET_THE_GREEN = PM_NORN + 1;

    /*
     * quest nemeses
     */
    export const PM_MINION_OF_HUHETOTL = PM_NEFERET_THE_GREEN + 1;

    export const PM_THOTH_AMON = PM_MINION_OF_HUHETOTL + 1;

    /* Multi-headed, possessing the breath attacks of all the other dragons
     * (selected at random when attacking).  Despite being a superset of
     * gold dragon, does not emit light.  Also does not fly.
     */
    export const PM_CHROMATIC_DRAGON = PM_THOTH_AMON + 1;

    export const PM_CYCLOPS = PM_CHROMATIC_DRAGON + 1;

    export const PM_IXOTH = PM_CYCLOPS + 1;

    export const PM_MASTER_KAEN = PM_IXOTH + 1;

    export const PM_NALZOK = PM_MASTER_KAEN + 1;

    export const PM_SCORPIUS = PM_NALZOK + 1;

    export const PM_MASTER_ASSASSIN = PM_SCORPIUS + 1;

    /* A renegade daimyo who led a 13 year civil war against the shogun
     * of his time.
     */
    export const PM_ASHIKAGA_TAKAUJI = PM_MASTER_ASSASSIN + 1;

    /*
     * Note: the Master of Thieves was defined above.
     */
    export const PM_LORD_SURTUR = PM_ASHIKAGA_TAKAUJI + 1;

    export const PM_DARK_ONE = PM_LORD_SURTUR + 1;

    /*
     * quest "guardians"
     */
    export const PM_STUDENT = PM_DARK_ONE + 1;

    export const PM_CHIEFTAIN = PM_STUDENT + 1;

    export const PM_NEANDERTHAL = PM_CHIEFTAIN + 1;

    /* attendants used to be lawful but have been changed to neutral because
       grow_up() promotes them to healer and the latter is always neutral */
    export const PM_ATTENDANT = PM_NEANDERTHAL + 1;

    export const PM_PAGE = PM_ATTENDANT + 1;

    export const PM_ABBOT = PM_PAGE + 1;

    export const PM_ACOLYTE = PM_ABBOT + 1;

    export const PM_HUNTER = PM_ACOLYTE + 1;

    export const PM_THUG = PM_HUNTER + 1;

    export const PM_NINJA = PM_THUG + 1;

    export const PM_ROSHI = PM_NINJA + 1;

    export const PM_GUIDE = PM_ROSHI + 1;

    /* warriors used to be chaotic but have been changed to lawful because
       grow_up() promotes them to valkyrie; for a valkyrie hero, they might
       be changed to neutral at game start; see the valkyrie comment above */
    export const PM_WARRIOR = PM_GUIDE + 1;

    export const PM_APPRENTICE = PM_WARRIOR + 1; export const NUMMONS = PM_APPRENTICE + 1; export const NON_PM = -1; export const LOW_PM = (NON_PM + 1); export const LEAVESTATUE = (NON_PM - 1); export const HIGH_PM = (NUMMONS - 1); export const SPECIAL_PM = PM_LONG_WORM_TAIL;

    /*
     * mons_init() in monst.c adds a terminator here, mons[NUMMONS].
     * It is part of the mons[] array without introducing another type
     * of monster.
     */

/*monsters.h*/
