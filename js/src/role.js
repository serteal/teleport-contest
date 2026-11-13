/* NetHack 5.0	role.c	$NHDT-Date: 1737607158 2025/01/22 20:39:18 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.107 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985-1999. */
/*-Copyright (c) Robert Patrick Rankin, 2012. */
/* NetHack may be freely redistributed.  See license for details. */

/*** Table of all roles ***/
/* According to AD&D, HD for some classes (ex. Wizard) should be smaller
 * (4-sided for wizards).  But this is not AD&D, and using the AD&D
 * rule here produces an unplayable character.  Thus I have used a minimum
 * of an 10-sided hit die for everything.  Another AD&D change: wizards get
 * a minimum strength of 4 since without one you can't teleport or cast
 * spells. --KAA
 *
 * As the wizard has been updated (wizard patch 5 jun '96) their HD can be
 * brought closer into line with AD&D. This forces wizards to use magic more
 * and distance themselves from their attackers. --LSZ
 *
 * With the introduction of races, some hit points and energy
 * has been reallocated for each race.  The values assigned
 * to the roles has been reduced by the amount allocated to
 * humans.  --KMH
 *
 * God names use a leading underscore to flag goddesses.
 */

/* NUM_ROLES is defined in hack.h */

export const roles = static_array("roles", struct_Role, NUM_ROLES+1, [
    { name: { m: _("Archeologist"), f: 0 },
      rank: [ { m: _("Digger"), f: 0 },
        { m: _("Field Worker"), f: 0 },
        { m: _("Investigator"), f: 0 },
        { m: _("Exhumer"), f: 0 },
        { m: _("Excavator"), f: 0 },
        { m: _("Spelunker"), f: 0 },
        { m: _("Speleologist"), f: 0 },
        { m: _("Collector"), f: 0 },
        { m: _("Curator"), f: 0 } ],
      lgod: _("Quetzalcoatl"), ngod: _("Camaxtli"), cgod: _("Huhetotl"), /* Central American */
      filecode: _("Arc"),
      homebase: _("the College of Archeology"),
      intermed: _("the Tomb of the Toltec Kings"),
      mnum: PM_ARCHEOLOGIST,
      petnum: NON_PM,
      ldrnum: PM_LORD_CARNARVON,
      guardnum: PM_STUDENT,
      neminum: PM_MINION_OF_HUHETOTL,
      enemy1num: NON_PM,
      enemy2num: PM_HUMAN_MUMMY,
      enemy1sym: S_SNAKE,
      enemy2sym: S_MUMMY,
      questarti: ART_ORB_OF_DETECTION,
      allow: MH_HUMAN | MH_DWARF | MH_GNOME | ROLE_MALE | ROLE_FEMALE | AM_LAWFUL
          | AM_NEUTRAL,
      /* Str Int Wis Dex Con Cha */
      attrbase: [ 7, 10, 10, 7, 7, 7 ],
      attrdist: [ 20, 20, 20, 10, 20, 10 ],
      /* Init   Lower  Higher */
      hpadv: { infix: 11, inrnd: 0, lofix: 0, lornd: 8, hifix: 1, hirnd: 0 }, /* Hit points */
      enadv: { infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 1 },
      xlev: 14, /* Energy */
      initrecord: 10,
      spelbase: 5,
      spelheal: 0,
      spelshld: 2,
      spelarmr: 10,
      spelstat: A_INT,
      spelspec: SPE_MAGIC_MAPPING,
      spelsbon: -4 },
    { name: { m: _("Barbarian"), f: 0 },
      rank: [ { m: _("Plunderer"), f: _("Plunderess") },
        { m: _("Pillager"), f: 0 },
        { m: _("Bandit"), f: 0 },
        { m: _("Brigand"), f: 0 },
        { m: _("Raider"), f: 0 },
        { m: _("Reaver"), f: 0 },
        { m: _("Slayer"), f: 0 },
        { m: _("Chieftain"), f: _("Chieftainess") },
        { m: _("Conqueror"), f: _("Conqueress") } ],
      lgod: _("Mitra"), ngod: _("Crom"), cgod: _("Set"), /* Hyborian */
      filecode: _("Bar"),
      homebase: _("the Camp of the Duali Tribe"),
      intermed: _("the Duali Oasis"),
      mnum: PM_BARBARIAN,
      petnum: NON_PM,
      ldrnum: PM_PELIAS,
      guardnum: PM_CHIEFTAIN,
      neminum: PM_THOTH_AMON,
      enemy1num: PM_OGRE,
      enemy2num: PM_TROLL,
      enemy1sym: S_OGRE,
      enemy2sym: S_TROLL,
      questarti: ART_HEART_OF_AHRIMAN,
      allow: MH_HUMAN | MH_ORC | ROLE_MALE | ROLE_FEMALE | AM_NEUTRAL
          | AM_CHAOTIC,
      /* Str Int Wis Dex Con Cha */
      attrbase: [ 16, 7, 7, 15, 16, 6 ],
      attrdist: [ 30, 6, 7, 20, 30, 7 ],
      /* Init   Lower  Higher */
      hpadv: { infix: 14, inrnd: 0, lofix: 0, lornd: 10, hifix: 2, hirnd: 0 }, /* Hit points */
      enadv: { infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 1 },
      xlev: 10, /* Energy */
      initrecord: 10,
      spelbase: 14,
      spelheal: 0,
      spelshld: 0,
      spelarmr: 8,
      spelstat: A_INT,
      spelspec: SPE_HASTE_SELF,
      spelsbon: -4 },
    { name: { m: _("Caveman"), f: _("Cavewoman") },
      rank: [ { m: _("Troglodyte"), f: 0 },
        { m: _("Aborigine"), f: 0 },
        { m: _("Wanderer"), f: 0 },
        { m: _("Vagrant"), f: 0 },
        { m: _("Wayfarer"), f: 0 },
        { m: _("Roamer"), f: 0 },
        { m: _("Nomad"), f: 0 },
        { m: _("Rover"), f: 0 },
        { m: _("Pioneer"), f: 0 } ],
      lgod: _("Anu"), ngod: _("_Ishtar"), cgod: _("Anshar"), /* Babylonian */
      filecode: _("Cav"),
      homebase: _("the Caves of the Ancestors"),
      intermed: _("the Dragon's Lair"),
      mnum: PM_CAVE_DWELLER,
      petnum: PM_LITTLE_DOG,
      ldrnum: PM_SHAMAN_KARNOV,
      guardnum: PM_NEANDERTHAL,
      neminum: PM_CHROMATIC_DRAGON,
      enemy1num: PM_BUGBEAR,
      enemy2num: PM_HILL_GIANT,
      enemy1sym: S_HUMANOID,
      enemy2sym: S_GIANT,
      questarti: ART_SCEPTRE_OF_MIGHT,
      allow: MH_HUMAN | MH_DWARF | MH_GNOME | ROLE_MALE | ROLE_FEMALE | AM_LAWFUL
          | AM_NEUTRAL,
      /* Str Int Wis Dex Con Cha */
      attrbase: [ 10, 7, 7, 7, 8, 6 ],
      attrdist: [ 30, 6, 7, 20, 30, 7 ],
      /* Init   Lower  Higher */
      hpadv: { infix: 14, inrnd: 0, lofix: 0, lornd: 8, hifix: 2, hirnd: 0 }, /* Hit points */
      enadv: { infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 1 },
      xlev: 10, /* Energy */
      initrecord: 0,
      spelbase: 12,
      spelheal: 0,
      spelshld: 1,
      spelarmr: 8,
      spelstat: A_INT,
      spelspec: SPE_DIG,
      spelsbon: -4 },
    { name: { m: _("Healer"), f: 0 },
      rank: [ { m: _("Rhizotomist"), f: 0 },
        { m: _("Empiric"), f: 0 },
        { m: _("Embalmer"), f: 0 },
        { m: _("Dresser"), f: 0 },
        { m: _("Medicus ossium"), f: _("Medica ossium") },
        { m: _("Herbalist"), f: 0 },
        { m: _("Magister"), f: _("Magistra") },
        { m: _("Physician"), f: 0 },
        { m: _("Chirurgeon"), f: 0 } ],
      lgod: _("_Athena"), ngod: _("Hermes"), cgod: _("Poseidon"), /* Greek */
      filecode: _("Hea"),
      homebase: _("the Temple of Epidaurus"),
      intermed: _("the Temple of Coeus"),
      mnum: PM_HEALER,
      petnum: NON_PM,
      ldrnum: PM_HIPPOCRATES,
      guardnum: PM_ATTENDANT,
      neminum: PM_CYCLOPS,
      enemy1num: PM_GIANT_RAT,
      enemy2num: PM_SNAKE,
      enemy1sym: S_RODENT,
      enemy2sym: S_YETI,
      questarti: ART_STAFF_OF_AESCULAPIUS,
      allow: MH_HUMAN | MH_GNOME | ROLE_MALE | ROLE_FEMALE | AM_NEUTRAL,
      /* Str Int Wis Dex Con Cha */
      attrbase: [ 7, 7, 13, 7, 11, 16 ],
      attrdist: [ 15, 20, 20, 15, 25, 5 ],
      /* Init   Lower  Higher */
      hpadv: { infix: 11, inrnd: 0, lofix: 0, lornd: 8, hifix: 1, hirnd: 0 }, /* Hit points */
      enadv: { infix: 1, inrnd: 4, lofix: 0, lornd: 1, hifix: 0, hirnd: 2 },
      xlev: 20, /* Energy */
      initrecord: 10,
      spelbase: 3,
      spelheal: -3,
      spelshld: 2,
      spelarmr: 10,
      spelstat: A_WIS,
      spelspec: SPE_CURE_SICKNESS,
      spelsbon: -4 },
    { name: { m: _("Knight"), f: 0 },
      rank: [ { m: _("Gallant"), f: 0 },
        { m: _("Esquire"), f: 0 },
        { m: _("Bachelor"), f: 0 },
        { m: _("Sergeant"), f: 0 },
        { m: _("Knight"), f: 0 },
        { m: _("Banneret"), f: 0 },
        { m: _("Chevalier"), f: _("Chevaliere") },
        { m: _("Seignieur"), f: _("Dame") },
        { m: _("Paladin"), f: 0 } ],
      lgod: _("Lugh"), ngod: _("_Brigit"), cgod: _("Manannan Mac Lir"), /* Celtic */
      filecode: _("Kni"),
      homebase: _("Camelot Castle"),
      intermed: _("the Isle of Glass"),
      mnum: PM_KNIGHT,
      petnum: PM_PONY,
      ldrnum: PM_KING_ARTHUR,
      guardnum: PM_PAGE,
      neminum: PM_IXOTH,
      enemy1num: PM_QUASIT,
      enemy2num: PM_OCHRE_JELLY,
      enemy1sym: S_IMP,
      enemy2sym: S_JELLY,
      questarti: ART_MAGIC_MIRROR_OF_MERLIN,
      allow: MH_HUMAN | ROLE_MALE | ROLE_FEMALE | AM_LAWFUL,
      /* Str Int Wis Dex Con Cha */
      attrbase: [ 13, 7, 14, 8, 10, 17 ],
      attrdist: [ 30, 15, 15, 10, 20, 10 ],
      /* Init   Lower  Higher */
      hpadv: { infix: 14, inrnd: 0, lofix: 0, lornd: 8, hifix: 2, hirnd: 0 }, /* Hit points */
      enadv: { infix: 1, inrnd: 4, lofix: 0, lornd: 1, hifix: 0, hirnd: 2 },
      xlev: 10, /* Energy */
      initrecord: 10,
      spelbase: 8,
      spelheal: -2,
      spelshld: 0,
      spelarmr: 9,
      spelstat: A_WIS,
      spelspec: SPE_TURN_UNDEAD,
      spelsbon: -4 },
    { name: { m: _("Monk"), f: 0 },
      rank: [ { m: _("Candidate"), f: 0 },
        { m: _("Novice"), f: 0 },
        { m: _("Initiate"), f: 0 },
        { m: _("Student of Stones"), f: 0 },
        { m: _("Student of Waters"), f: 0 },
        { m: _("Student of Metals"), f: 0 },
        { m: _("Student of Winds"), f: 0 },
        { m: _("Student of Fire"), f: 0 },
        { m: _("Master"), f: 0 } ],
      lgod: _("Shan Lai Ching"), ngod: _("Chih Sung-tzu"), cgod: _("Huan Ti"), /* Chinese */
      filecode: _("Mon"),
      homebase: _("the Monastery of Chan-Sune"),
      intermed: _("the Monastery of the Earth-Lord"),
      mnum: PM_MONK,
      petnum: NON_PM,
      ldrnum: PM_GRAND_MASTER,
      guardnum: PM_ABBOT,
      neminum: PM_MASTER_KAEN,
      enemy1num: PM_EARTH_ELEMENTAL,
      enemy2num: PM_XORN,
      enemy1sym: S_ELEMENTAL,
      enemy2sym: S_XORN,
      questarti: ART_EYES_OF_THE_OVERWORLD,
      allow: MH_HUMAN | ROLE_MALE | ROLE_FEMALE | AM_LAWFUL | AM_NEUTRAL
          | AM_CHAOTIC,
      /* Str Int Wis Dex Con Cha */
      attrbase: [ 10, 7, 8, 8, 7, 7 ],
      attrdist: [ 25, 10, 20, 20, 15, 10 ],
      /* Init   Lower  Higher */
      hpadv: { infix: 12, inrnd: 0, lofix: 0, lornd: 8, hifix: 1, hirnd: 0 }, /* Hit points */
      enadv: { infix: 2, inrnd: 2, lofix: 0, lornd: 2, hifix: 0, hirnd: 2 },
      xlev: 10, /* Energy */
      initrecord: 10,
      spelbase: 8,
      spelheal: -2,
      spelshld: 2,
      spelarmr: 20,
      spelstat: A_WIS,
      spelspec: SPE_RESTORE_ABILITY,
      spelsbon: -4 },
    { name: { m: _("Priest"), f: _("Priestess") },
      rank: [ { m: _("Aspirant"), f: 0 },
        { m: _("Acolyte"), f: 0 },
        { m: _("Adept"), f: 0 },
        { m: _("Priest"), f: _("Priestess") },
        { m: _("Curate"), f: 0 },
        { m: _("Canon"), f: _("Canoness") },
        { m: _("Lama"), f: 0 },
        { m: _("Patriarch"), f: _("Matriarch") },
        { m: _("High Priest"), f: _("High Priestess") } ],
      lgod: 0, ngod: 0, cgod: 0, /* deities from a randomly chosen other role will be used */
      filecode: _("Pri"),
      homebase: _("the Great Temple"),
      intermed: _("the Temple of Nalzok"),
      mnum: PM_CLERIC,
      petnum: NON_PM,
      ldrnum: PM_ARCH_PRIEST,
      guardnum: PM_ACOLYTE,
      neminum: PM_NALZOK,
      enemy1num: PM_HUMAN_ZOMBIE,
      enemy2num: PM_WRAITH,
      enemy1sym: S_ZOMBIE,
      enemy2sym: S_WRAITH,
      questarti: ART_MITRE_OF_HOLINESS,
      allow: MH_HUMAN | MH_ELF | ROLE_MALE | ROLE_FEMALE | AM_LAWFUL | AM_NEUTRAL
          | AM_CHAOTIC,
      /* Str Int Wis Dex Con Cha */
      attrbase: [ 7, 7, 10, 7, 7, 7 ],
      attrdist: [ 15, 10, 30, 15, 20, 10 ],
      /* Init   Lower  Higher */
      hpadv: { infix: 12, inrnd: 0, lofix: 0, lornd: 8, hifix: 1, hirnd: 0 }, /* Hit points */
      enadv: { infix: 4, inrnd: 3, lofix: 0, lornd: 2, hifix: 0, hirnd: 2 },
      xlev: 10, /* Energy */
      initrecord: 0,
      spelbase: 3,
      spelheal: -2,
      spelshld: 2,
      spelarmr: 10,
      spelstat: A_WIS,
      spelspec: SPE_REMOVE_CURSE,
      spelsbon: -4 },
    /* Note:  Rogue precedes Ranger so that use of `-R' on the command line
       retains its traditional meaning. */
    { name: { m: _("Rogue"), f: 0 },
      rank: [ { m: _("Footpad"), f: 0 },
        { m: _("Cutpurse"), f: 0 },
        { m: _("Rogue"), f: 0 },
        { m: _("Pilferer"), f: 0 },
        { m: _("Robber"), f: 0 },
        { m: _("Burglar"), f: 0 },
        { m: _("Filcher"), f: 0 },
        { m: _("Magsman"), f: _("Magswoman") },
        { m: _("Thief"), f: 0 } ],
      lgod: _("Issek"), ngod: _("Mog"), cgod: _("Kos"), /* Nehwon */
      filecode: _("Rog"),
      homebase: _("the Thieves' Guild Hall"),
      intermed: _("the Assassins' Guild Hall"),
      mnum: PM_ROGUE,
      petnum: NON_PM,
      ldrnum: PM_MASTER_OF_THIEVES,
      guardnum: PM_THUG,
      neminum: PM_MASTER_ASSASSIN,
      enemy1num: PM_LEPRECHAUN,
      enemy2num: PM_GUARDIAN_NAGA,
      enemy1sym: S_NYMPH,
      enemy2sym: S_NAGA,
      questarti: ART_MASTER_KEY_OF_THIEVERY,
      allow: MH_HUMAN | MH_ORC | ROLE_MALE | ROLE_FEMALE | AM_CHAOTIC,
      /* Str Int Wis Dex Con Cha */
      attrbase: [ 7, 7, 7, 10, 7, 6 ],
      attrdist: [ 20, 10, 10, 30, 20, 10 ],
      /* Init   Lower  Higher */
      hpadv: { infix: 10, inrnd: 0, lofix: 0, lornd: 8, hifix: 1, hirnd: 0 }, /* Hit points */
      enadv: { infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 1 },
      xlev: 11, /* Energy */
      initrecord: 10,
      spelbase: 8,
      spelheal: 0,
      spelshld: 1,
      spelarmr: 9,
      spelstat: A_INT,
      spelspec: SPE_DETECT_TREASURE,
      spelsbon: -4 },
    { name: { m: _("Ranger"), f: 0 },
      rank: [
        /* #if 0: not in this build */

        { m: _("Tenderfoot"), f: 0 },
        { m: _("Lookout"), f: 0 },
        { m: _("Trailblazer"), f: 0 },
        { m: _("Reconnoiterer"), f: _("Reconnoiteress") },
        { m: _("Scout"), f: 0 },
        { m: _("Arbalester"), f: 0 }, /* One skilled at crossbows */
        { m: _("Archer"), f: 0 },
        { m: _("Sharpshooter"), f: 0 },
        { m: _("Marksman"), f: _("Markswoman") } ],
      lgod: _("Mercury"), ngod: _("_Venus"), cgod: _("Mars"), /* Roman/planets */
      filecode: _("Ran"),
      homebase: _("Orion's camp"),
      intermed: _("the cave of the wumpus"),
      mnum: PM_RANGER,
      petnum: PM_LITTLE_DOG /* Orion & canis major */,
      ldrnum: PM_ORION,
      guardnum: PM_HUNTER,
      neminum: PM_SCORPIUS,
      enemy1num: PM_FOREST_CENTAUR,
      enemy2num: PM_SCORPION,
      enemy1sym: S_CENTAUR,
      enemy2sym: S_SPIDER,
      questarti: ART_LONGBOW_OF_DIANA,
      allow: MH_HUMAN | MH_ELF | MH_GNOME | MH_ORC | ROLE_MALE | ROLE_FEMALE
          | AM_NEUTRAL | AM_CHAOTIC,
      /* Str Int Wis Dex Con Cha */
      attrbase: [ 13, 13, 13, 9, 13, 7 ],
      attrdist: [ 30, 10, 10, 20, 20, 10 ],
      /* Init   Lower  Higher */
      hpadv: { infix: 13, inrnd: 0, lofix: 0, lornd: 6, hifix: 1, hirnd: 0 }, /* Hit points */
      enadv: { infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 1 },
      xlev: 12, /* Energy */
      initrecord: 10,
      spelbase: 9,
      spelheal: 2,
      spelshld: 1,
      spelarmr: 10,
      spelstat: A_INT,
      spelspec: SPE_INVISIBILITY,
      spelsbon: -4 },
    { name: { m: _("Samurai"), f: 0 },
      rank: [ { m: _("Hatamoto"), f: 0 },       /* Banner Knight */
        { m: _("Ronin"), f: 0 },          /* no allegiance */
        { m: _("Ninja"), f: _("Kunoichi") }, /* secret society */
        { m: _("Joshu"), f: 0 },          /* heads a castle */
        { m: _("Ryoshu"), f: 0 },         /* has a territory */
        { m: _("Kokushu"), f: 0 },        /* heads a province */
        { m: _("Daimyo"), f: 0 },         /* a samurai lord */
        { m: _("Kuge"), f: 0 },           /* Noble of the Court */
        { m: _("Shogun"), f: 0 } ],       /* supreme commander, warlord */
      lgod: _("_Amaterasu Omikami"), ngod: _("Raijin"), cgod: _("Susanowo"), /* Japanese */
      filecode: _("Sam"),
      homebase: _("the Castle of the Taro Clan"),
      intermed: _("the Shogun's Castle"),
      mnum: PM_SAMURAI,
      petnum: PM_LITTLE_DOG,
      ldrnum: PM_LORD_SATO,
      guardnum: PM_ROSHI,
      neminum: PM_ASHIKAGA_TAKAUJI,
      enemy1num: PM_WOLF,
      enemy2num: PM_STALKER,
      enemy1sym: S_DOG,
      enemy2sym: S_ELEMENTAL,
      questarti: ART_TSURUGI_OF_MURAMASA,
      allow: MH_HUMAN | ROLE_MALE | ROLE_FEMALE | AM_LAWFUL,
      /* Str Int Wis Dex Con Cha */
      attrbase: [ 10, 8, 7, 10, 17, 6 ],
      attrdist: [ 30, 10, 8, 30, 14, 8 ],
      /* Init   Lower  Higher */
      hpadv: { infix: 13, inrnd: 0, lofix: 0, lornd: 8, hifix: 1, hirnd: 0 }, /* Hit points */
      enadv: { infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 1 },
      xlev: 11, /* Energy */
      initrecord: 10,
      spelbase: 10,
      spelheal: 0,
      spelshld: 0,
      spelarmr: 8,
      spelstat: A_INT,
      spelspec: SPE_CLAIRVOYANCE,
      spelsbon: -4 },
    { name: { m: _("Tourist"), f: 0 },
      rank: [ { m: _("Rambler"), f: 0 },
        { m: _("Sightseer"), f: 0 },
        { m: _("Excursionist"), f: 0 },
        { m: _("Peregrinator"), f: _("Peregrinatrix") },
        { m: _("Traveler"), f: 0 },
        { m: _("Journeyer"), f: 0 },
        { m: _("Voyager"), f: 0 },
        { m: _("Explorer"), f: 0 },
        { m: _("Adventurer"), f: 0 } ],
      lgod: _("Blind Io"), ngod: _("_The Lady"), cgod: _("Offler"), /* Discworld */
      filecode: _("Tou"),
      homebase: _("Ankh-Morpork"),
      intermed: _("the Thieves' Guild Hall"),
      mnum: PM_TOURIST,
      petnum: NON_PM,
      ldrnum: PM_TWOFLOWER,
      guardnum: PM_GUIDE,
      neminum: PM_MASTER_OF_THIEVES,
      enemy1num: PM_GIANT_SPIDER,
      enemy2num: PM_FOREST_CENTAUR,
      enemy1sym: S_SPIDER,
      enemy2sym: S_CENTAUR,
      questarti: ART_YENDORIAN_EXPRESS_CARD,
      allow: MH_HUMAN | ROLE_MALE | ROLE_FEMALE | AM_NEUTRAL,
      /* Str Int Wis Dex Con Cha */
      attrbase: [ 7, 10, 6, 7, 7, 10 ],
      attrdist: [ 15, 10, 10, 15, 30, 20 ],
      /* Init   Lower  Higher */
      hpadv: { infix: 8, inrnd: 0, lofix: 0, lornd: 8, hifix: 0, hirnd: 0 }, /* Hit points */
      enadv: { infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 1 },
      xlev: 14, /* Energy */
      initrecord: 0,
      spelbase: 5,
      spelheal: 1,
      spelshld: 2,
      spelarmr: 10,
      spelstat: A_INT,
      spelspec: SPE_CHARM_MONSTER,
      spelsbon: -4 },
    { name: { m: _("Valkyrie"), f: 0 },
      rank: [ { m: _("Stripling"), f: 0 },
        { m: _("Skirmisher"), f: 0 },
        { m: _("Fighter"), f: 0 },
        { m: _("Man-at-arms"), f: _("Woman-at-arms") },
        { m: _("Warrior"), f: 0 },
        { m: _("Swashbuckler"), f: 0 },
        { m: _("Hero"), f: _("Heroine") },
        { m: _("Champion"), f: 0 },
        { m: _("Lord"), f: _("Lady") } ],
      lgod: _("Tyr"), ngod: _("Odin"), cgod: _("Loki"), /* Norse */
      filecode: _("Val"),
      homebase: _("the Shrine of Destiny"),
      intermed: _("the cave of Surtur"),
      mnum: PM_VALKYRIE,
      petnum: NON_PM /*PM_WINTER_WOLF_CUB*/,
      ldrnum: PM_NORN,
      guardnum: PM_WARRIOR,
      neminum: PM_LORD_SURTUR,
      enemy1num: PM_FIRE_ANT,
      enemy2num: PM_FIRE_GIANT,
      enemy1sym: S_ANT,
      enemy2sym: S_GIANT,
      questarti: ART_ORB_OF_FATE,
      allow: MH_HUMAN | MH_DWARF | ROLE_FEMALE | AM_LAWFUL | AM_NEUTRAL,
      /* Str Int Wis Dex Con Cha */
      attrbase: [ 10, 7, 7, 7, 10, 7 ],
      attrdist: [ 30, 6, 7, 20, 30, 7 ],
      /* Init   Lower  Higher */
      hpadv: { infix: 14, inrnd: 0, lofix: 0, lornd: 8, hifix: 2, hirnd: 0 }, /* Hit points */
      enadv: { infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 1 },
      xlev: 10, /* Energy */
      initrecord: 0,
      spelbase: 10,
      spelheal: -2,
      spelshld: 0,
      spelarmr: 9,
      spelstat: A_WIS,
      spelspec: SPE_CONE_OF_COLD,
      spelsbon: -4 },
    { name: { m: _("Wizard"), f: 0 },
      rank: [ { m: _("Evoker"), f: 0 },
        { m: _("Conjurer"), f: 0 },
        { m: _("Thaumaturge"), f: 0 },
        { m: _("Magician"), f: 0 },
        { m: _("Enchanter"), f: _("Enchantress") },
        { m: _("Sorcerer"), f: _("Sorceress") },
        { m: _("Necromancer"), f: 0 },
        { m: _("Wizard"), f: 0 },
        { m: _("Mage"), f: 0 } ],
      lgod: _("Ptah"), ngod: _("Thoth"), cgod: _("Anhur"), /* Egyptian */
      filecode: _("Wiz"),
      homebase: _("the Lonely Tower"),
      intermed: _("the Tower of Darkness"),
      mnum: PM_WIZARD,
      petnum: PM_KITTEN,
      ldrnum: PM_NEFERET_THE_GREEN,
      guardnum: PM_APPRENTICE,
      neminum: PM_DARK_ONE,
      enemy1num: PM_VAMPIRE_BAT,
      enemy2num: PM_XORN,
      enemy1sym: S_BAT,
      enemy2sym: S_WRAITH,
      questarti: ART_EYE_OF_THE_AETHIOPICA,
      allow: MH_HUMAN | MH_ELF | MH_GNOME | MH_ORC | ROLE_MALE | ROLE_FEMALE
          | AM_NEUTRAL | AM_CHAOTIC,
      /* Str Int Wis Dex Con Cha */
      attrbase: [ 7, 10, 7, 7, 7, 7 ],
      attrdist: [ 10, 30, 10, 20, 20, 10 ],
      /* Init   Lower  Higher */
      hpadv: { infix: 10, inrnd: 0, lofix: 0, lornd: 8, hifix: 1, hirnd: 0 }, /* Hit points */
      enadv: { infix: 4, inrnd: 3, lofix: 0, lornd: 2, hifix: 0, hirnd: 3 },
      xlev: 12, /* Energy */
      initrecord: 0,
      spelbase: 1,
      spelheal: 0,
      spelshld: 3,
      spelarmr: 10,
      spelstat: A_INT,
      spelspec: SPE_MAGIC_MISSILE,
      spelsbon: -4 },
    /* Array terminator */
    { mnum: NON_PM, petnum: NON_PM, ldrnum: NON_PM, guardnum: NON_PM, neminum: NON_PM, enemy1num: NON_PM, enemy2num: NON_PM, enemy1sym: ord("\x00"), enemy2sym: ord("\x00"), questarti: STRANGE_OBJECT },
]);

/* Table of all races */

/* NUM_RACES is defined in hack.h */
export const races = static_array("races", struct_Race, NUM_RACES + 1, [
    {
        noun: _("human"),
        adj: _("human"),
        coll: _("humanity"),
        filecode: _("Hum"),
        individual: { m: _("man"), f: _("woman") },
        mnum: PM_HUMAN,
        mummynum: PM_HUMAN_MUMMY,
        zombienum: PM_HUMAN_ZOMBIE,
        allow: MH_HUMAN | ROLE_MALE | ROLE_FEMALE | AM_LAWFUL | AM_NEUTRAL
            | AM_CHAOTIC,
        selfmask: MH_HUMAN,
        lovemask: 0,
        hatemask: MH_GNOME | MH_ORC,
        /*    Str     Int Wis Dex Con Cha */
        attrmin: [ 3, 3, 3, 3, 3, 3 ],
        attrmax: [ STR18(100), 18, 18, 18, 18, 18 ],
        /* Init   Lower  Higher */
        hpadv: { infix: 2, inrnd: 0, lofix: 0, lornd: 2, hifix: 1, hirnd: 0 }, /* Hit points */
        enadv: { infix: 1, inrnd: 0, lofix: 2, lornd: 0, hifix: 2, hirnd: 0 }  /* Energy */
    },
    {
        noun: _("elf"),
        adj: _("elven"),
        coll: _("elvenkind"),
        filecode: _("Elf"),
        individual: { m: 0, f: 0 },
        mnum: PM_ELF,
        mummynum: PM_ELF_MUMMY,
        zombienum: PM_ELF_ZOMBIE,
        allow: MH_ELF | ROLE_MALE | ROLE_FEMALE | AM_CHAOTIC,
        selfmask: MH_ELF,
        lovemask: MH_ELF,
        hatemask: MH_ORC,
        /*  Str    Int Wis Dex Con Cha */
        attrmin: [ 3, 3, 3, 3, 3, 3 ],
        attrmax: [ 18, 20, 20, 18, 16, 18 ],
        /* Init   Lower  Higher */
        hpadv: { infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 1, hirnd: 0 }, /* Hit points */
        enadv: { infix: 2, inrnd: 0, lofix: 3, lornd: 0, hifix: 3, hirnd: 0 }  /* Energy */
    },
    {
        noun: _("dwarf"),
        adj: _("dwarven"),
        coll: _("dwarvenkind"),
        filecode: _("Dwa"),
        individual: { m: 0, f: 0 },
        mnum: PM_DWARF,
        mummynum: PM_DWARF_MUMMY,
        zombienum: PM_DWARF_ZOMBIE,
        allow: MH_DWARF | ROLE_MALE | ROLE_FEMALE | AM_LAWFUL,
        selfmask: MH_DWARF,
        lovemask: MH_DWARF | MH_GNOME,
        hatemask: MH_ORC,
        /*    Str     Int Wis Dex Con Cha */
        attrmin: [ 3, 3, 3, 3, 3, 3 ],
        attrmax: [ STR18(100), 16, 16, 20, 20, 16 ],
        /* Init   Lower  Higher */
        hpadv: { infix: 4, inrnd: 0, lofix: 0, lornd: 3, hifix: 2, hirnd: 0 }, /* Hit points */
        enadv: { infix: 0, inrnd: 0, lofix: 0, lornd: 0, hifix: 0, hirnd: 0 }  /* Energy */
    },
    {
        noun: _("gnome"),
        adj: _("gnomish"),
        coll: _("gnomehood"),
        filecode: _("Gno"),
        individual: { m: 0, f: 0 },
        mnum: PM_GNOME,
        mummynum: PM_GNOME_MUMMY,
        zombienum: PM_GNOME_ZOMBIE,
        allow: MH_GNOME | ROLE_MALE | ROLE_FEMALE | AM_NEUTRAL,
        selfmask: MH_GNOME,
        lovemask: MH_DWARF | MH_GNOME,
        hatemask: MH_HUMAN,
        /*  Str    Int Wis Dex Con Cha */
        attrmin: [ 3, 3, 3, 3, 3, 3 ],
        attrmax: [ STR18(50), 19, 18, 18, 18, 18 ],
        /* Init   Lower  Higher */
        hpadv: { infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 0 }, /* Hit points */
        enadv: { infix: 2, inrnd: 0, lofix: 2, lornd: 0, hifix: 2, hirnd: 0 }  /* Energy */
    },
    {
        noun: _("orc"),
        adj: _("orcish"),
        coll: _("orcdom"),
        filecode: _("Orc"),
        individual: { m: 0, f: 0 },
        mnum: PM_ORC,
        mummynum: PM_ORC_MUMMY,
        zombienum: PM_ORC_ZOMBIE,
        allow: MH_ORC | ROLE_MALE | ROLE_FEMALE | AM_CHAOTIC,
        selfmask: MH_ORC,
        lovemask: 0,
        hatemask: MH_HUMAN | MH_ELF | MH_DWARF,
        /*  Str    Int Wis Dex Con Cha */
        attrmin: [ 3, 3, 3, 3, 3, 3 ],
        attrmax: [ STR18(50), 16, 16, 18, 18, 16 ],
        /* Init   Lower  Higher */
        hpadv: { infix: 1, inrnd: 0, lofix: 0, lornd: 1, hifix: 0, hirnd: 0 }, /* Hit points */
        enadv: { infix: 1, inrnd: 0, lofix: 1, lornd: 0, hifix: 1, hirnd: 0 }  /* Energy */
    },
    /* Array terminator */
    { mnum: NON_PM, mummynum: NON_PM, zombienum: NON_PM },
]);

/* Table of all genders */
export const genders = static_array("genders", struct_Gender, null, [
    { adj: _("male"), he: _("he"), him: _("him"), his: _("his"), filecode: _("Mal"), allow: ROLE_MALE },
    { adj: _("female"), he: _("she"), him: _("her"), his: _("her"), filecode: _("Fem"), allow: ROLE_FEMALE },
    { adj: _("neuter"), he: _("it"), him: _("it"), his: _("its"), filecode: _("Ntr"), allow: ROLE_NEUTER },
    /* used by pronoun_gender() when hallucinating */
    { adj: _("group"), he: _("they"), him: _("them"), his: _("their"), filecode: _("Grp"), allow: 0 },
]);

/* Table of all alignments */
export const aligns = static_array("aligns", struct_Align, null, [
    { noun: _("law"), adj: _("lawful"), filecode: _("Law"), allow: AM_LAWFUL, value: A_LAWFUL },
    { noun: _("balance"), adj: _("neutral"), filecode: _("Neu"), allow: AM_NEUTRAL, value: A_NEUTRAL },
    { noun: _("chaos"), adj: _("chaotic"), filecode: _("Cha"), allow: AM_CHAOTIC, value: A_CHAOTIC },
    { noun: _("evil"), adj: _("unaligned"), filecode: _("Una"), allow: 0, value: A_NONE }
]);

/* used by str2XXX() */
const randomstr = init_string(static_array("randomstr", char, sizeof_string("random")), _("random"), true);

export function validrole(rolenum) { /* boolean */
    return IndexOkT(rolenum, roles);
}

export function randrole(for_display) { /* int */
    let res = SIZE(roles) - 1;

    if (for_display)
        res = rn2_on_display_rng(res);
    else
        res = rn2(res);
    return res;
}

function randrole_filtered() { /* int */
    const $frame = stack_frame(); try {
    let i, n = 0, set = stack_array(int, SIZE(roles));

    /* this doesn't rule out impossible combinations but attempts to
       honor all the filter masks */
    for (i = 0; i < SIZE(roles) - 1; ++i) /* -1: avoid terminating element */
        if (ok_role(i, ROLE_NONE, ROLE_NONE, ROLE_NONE)
            && ok_race(i, ROLE_RANDOM, ROLE_NONE, ROLE_NONE)
            && ok_gend(i, ROLE_NONE, ROLE_RANDOM, ROLE_NONE)
            && ok_align(i, ROLE_NONE, ROLE_NONE, ROLE_RANDOM))
            set[n++] = i;
    return n ? set[rn2(n)] : randrole(FALSE);
    } finally { stack_pop($frame); }
}

export function str2role(str) { /* int */
    let i, len;

    /* Is str valid? */
    if (!str || !chars[str + 0])
        return ROLE_NONE;

    /* Match as much of str as is provided */
    len = int(Strlen(str));
    for (i = 0; roles[i].name.m; i++) {
        /* Does it match the male name? */
        if (!strncmpi(str, roles[i].name.m, len))
            return i;
        /* Or the female name? */
        if (roles[i].name.f && !strncmpi(str, roles[i].name.f, len))
            return i;
        /* Or the filecode? */
        if (!strcmpi(str, roles[i].filecode))
            return i;
    }

    if ((len == 1 && (chars[str] == ord('*') || chars[str] == ord('@')))
        || !strncmpi(str, randomstr, len))
        return ROLE_RANDOM;

    /* Couldn't find anything appropriate */
    return ROLE_NONE;
}

export function validrace(rolenum, racenum) { /* boolean */
    /* Assumes validrole */
    return (IndexOkT(racenum, races)
                      && (roles[rolenum].allow & races[racenum].allow
                          & ROLE_RACEMASK) ? 1 : 0);
}

export function randrace(rolenum) { /* int */
    let i, n = 0;

    /* Count the number of valid races */
    for (i = 0; races[i].noun; i++)
        if (roles[rolenum].allow & races[i].allow & ROLE_RACEMASK)
            n++;

    /* Pick a random race */
    /* Use a factor of 100 in case of bad random number generators */
    if (n)
        n = Math.trunc(rn2(n * 100) / 100);
    for (i = 0; races[i].noun; i++)
        if (roles[rolenum].allow & races[i].allow & ROLE_RACEMASK) {
            if (n)
                n--;
            else
                return i;
        }

    /* This role has no permitted races? */
    return rn2(SIZE(races) - 1);
}

export function str2race(str) { /* int */
    let i, len;

    /* Is str valid? */
    if (!str || !chars[str + 0])
        return ROLE_NONE;

    /* Match as much of str as is provided */
    len = int(Strlen(str));
    for (i = 0; races[i].noun; i++) {
        /* Does it match the noun? */
        if (!strncmpi(str, races[i].noun, len))
            return i;
        /* check adjective too */
        if (races[i].adj && !strncmpi(str, races[i].adj, len))
            return i;
        /* Or the filecode? */
        if (!strcmpi(str, races[i].filecode))
            return i;
    }

    if ((len == 1 && (chars[str] == ord('*') || chars[str] == ord('@')))
        || !strncmpi(str, randomstr, len))
        return ROLE_RANDOM;

    /* Couldn't find anything appropriate */
    return ROLE_NONE;
}

export function validgend(rolenum, racenum, gendnum) { /* boolean */
    /* Assumes validrole and validrace */
    return (gendnum >= 0 && gendnum < ROLE_GENDERS
                      && (roles[rolenum].allow & races[racenum].allow
                          & genders[gendnum].allow & ROLE_GENDMASK) ? 1 : 0);
}

export function randgend(rolenum, racenum) { /* int */
    let i, n = 0;

    /* Count the number of valid genders */
    for (i = 0; i < ROLE_GENDERS; i++)
        if (roles[rolenum].allow & races[racenum].allow & genders[i].allow
            & ROLE_GENDMASK)
            n++;

    /* Pick a random gender */
    if (n)
        n = rn2(n);
    for (i = 0; i < ROLE_GENDERS; i++)
        if (roles[rolenum].allow & races[racenum].allow & genders[i].allow
            & ROLE_GENDMASK) {
            if (n)
                n--;
            else
                return i;
        }

    /* This role/race has no permitted genders? */
    return rn2(ROLE_GENDERS);
}

export function str2gend(str) { /* int */
    let i, len;

    /* Is str valid? */
    if (!str || !chars[str + 0])
        return ROLE_NONE;

    /* Match as much of str as is provided */
    len = int(Strlen(str));
    for (i = 0; i < ROLE_GENDERS; i++) {
        /* Does it match the adjective? */
        if (!strncmpi(str, genders[i].adj, len))
            return i;
        /* Or the filecode? */
        if (!strcmpi(str, genders[i].filecode))
            return i;
    }
    if ((len == 1 && (chars[str] == ord('*') || chars[str] == ord('@')))
        || !strncmpi(str, randomstr, len))
        return ROLE_RANDOM;

    /* Couldn't find anything appropriate */
    return ROLE_NONE;
}

export function validalign(rolenum, racenum, alignnum) { /* boolean */
    /* Assumes validrole and validrace */
    return (alignnum >= 0 && alignnum < ROLE_ALIGNS
                      && (roles[rolenum].allow & races[racenum].allow
                          & aligns[alignnum].allow & AM_MASK) ? 1 : 0);
}

export function randalign(rolenum, racenum) { /* int */
    let i, n = 0;

    /* Count the number of valid alignments */
    for (i = 0; i < ROLE_ALIGNS; i++)
        if (roles[rolenum].allow & races[racenum].allow & aligns[i].allow
            & AM_MASK)
            n++;

    /* Pick a random alignment */
    if (n)
        n = rn2(n);
    for (i = 0; i < ROLE_ALIGNS; i++)
        if (roles[rolenum].allow & races[racenum].allow & aligns[i].allow
            & AM_MASK) {
            if (n)
                n--;
            else
                return i;
        }

    /* This role/race has no permitted alignments? */
    return rn2(ROLE_ALIGNS);
}

export function str2align(str) { /* int */
    let i, len;

    /* Is str valid? */
    if (!str || !chars[str + 0])
        return ROLE_NONE;

    /* Match as much of str as is provided */
    len = int(Strlen(str));
    for (i = 0; i < ROLE_ALIGNS; i++) {
        /* Does it match the adjective? */
        if (!strncmpi(str, aligns[i].adj, len))
            return i;
        /* Or the filecode? */
        if (!strcmpi(str, aligns[i].filecode))
            return i;
    }
    if ((len == 1 && (chars[str] == ord('*') || chars[str] == ord('@')))
        || !strncmpi(str, randomstr, len))
        return ROLE_RANDOM;

    /* Couldn't find anything appropriate */
    return ROLE_NONE;
}

/* is rolenum compatible with any racenum/gendnum/alignnum constraints? */
export function ok_role(rolenum, racenum, gendnum, alignnum) { /* boolean */
    let i;
    let allow;

    if (IndexOkT(rolenum, roles)) {
        if (chars[gr.rfilter.roles + rolenum])
            return FALSE;
        allow = roles[rolenum].allow;
        if (IndexOkT(racenum, races)
            && !(allow & races[racenum].allow & ROLE_RACEMASK))
            return FALSE;
        if (gendnum >= 0 && gendnum < ROLE_GENDERS
            && !(allow & genders[gendnum].allow & ROLE_GENDMASK))
            return FALSE;
        if (alignnum >= 0 && alignnum < ROLE_ALIGNS
            && !(allow & aligns[alignnum].allow & AM_MASK))
            return FALSE;
        return TRUE;
    } else {
        /* random; check whether any selection is possible */
        for (i = 0; i < SIZE(roles) - 1; i++) {
            if (chars[gr.rfilter.roles + i])
                continue;
            allow = roles[i].allow;
            if (IndexOkT(racenum, races)
                && !(allow & races[racenum].allow & ROLE_RACEMASK))
                continue;
            if (gendnum >= 0 && gendnum < ROLE_GENDERS
                && !(allow & genders[gendnum].allow & ROLE_GENDMASK))
                continue;
            if (alignnum >= 0 && alignnum < ROLE_ALIGNS
                && !(allow & aligns[alignnum].allow & AM_MASK))
                continue;
            return TRUE;
        }
        return FALSE;
    }
}

/* pick a random role subject to any racenum/gendnum/alignnum constraints */
/* If pickhow == PICK_RIGID a role is returned only if there is  */
/* a single possibility */
export function pick_role(racenum, gendnum, alignnum, pickhow) { /* int */
    const $frame = stack_frame(); try {
    let i;
    let roles_ok = 0, set = stack_array(int, SIZE(roles));

    for (i = 0; i < SIZE(roles) - 1; i++) {
        if (ok_role(i, racenum, gendnum, alignnum)
            && ok_race(i, (racenum >= 0) ? racenum : ROLE_RANDOM,
                       gendnum, alignnum)
            && ok_gend(i, racenum,
                       (gendnum >= 0) ? gendnum : ROLE_RANDOM, alignnum)
            && ok_align(i, racenum,
                        gendnum, (alignnum >= 0) ? alignnum : ROLE_RANDOM))
            set[roles_ok++] = i;
    }
    if (roles_ok == 0 || (roles_ok > 1 && pickhow == PICK_RIGID))
        return ROLE_NONE;
    return set[rn2(roles_ok)];
    } finally { stack_pop($frame); }
}

/* is racenum compatible with any rolenum/gendnum/alignnum constraints? */
export function ok_race(rolenum, racenum, gendnum, alignnum) { /* boolean */
    let i;
    let allow;

    if (IndexOkT(racenum, races)) {
        if (gr.rfilter.mask & races[racenum].selfmask)
            return FALSE;
        allow = races[racenum].allow;
        if (IndexOkT(rolenum, roles)
            && !(allow & roles[rolenum].allow & ROLE_RACEMASK))
            return FALSE;
        if (gendnum >= 0 && gendnum < ROLE_GENDERS
            && !(allow & genders[gendnum].allow & ROLE_GENDMASK))
            return FALSE;
        if (alignnum >= 0 && alignnum < ROLE_ALIGNS
            && !(allow & aligns[alignnum].allow & AM_MASK))
            return FALSE;
        return TRUE;
    } else {
        /* random; check whether any selection is possible */
        for (i = 0; i < SIZE(races) - 1; i++) {
            if (gr.rfilter.mask & races[i].selfmask)
                continue;
            allow = races[i].allow;
            if (IndexOkT(rolenum, roles)
                && !(allow & roles[rolenum].allow & ROLE_RACEMASK))
                continue;
            if (gendnum >= 0 && gendnum < ROLE_GENDERS
                && !(allow & genders[gendnum].allow & ROLE_GENDMASK))
                continue;
            if (alignnum >= 0 && alignnum < ROLE_ALIGNS
                && !(allow & aligns[alignnum].allow & AM_MASK))
                continue;
            return TRUE;
        }
        return FALSE;
    }
}

/* Pick a random race subject to any rolenum/gendnum/alignnum constraints.
   If pickhow == PICK_RIGID a race is returned only if there is
   a single possibility. */
export function pick_race(rolenum, gendnum, alignnum, pickhow) { /* int */
    let i;
    let races_ok = 0;

    for (i = 0; i < SIZE(races) - 1; i++) {
        if (ok_race(rolenum, i, gendnum, alignnum))
            races_ok++;
    }
    if (races_ok == 0 || (races_ok > 1 && pickhow == PICK_RIGID))
        return ROLE_NONE;
    races_ok = rn2(races_ok);
    for (i = 0; i < SIZE(races) - 1; i++) {
        if (ok_race(rolenum, i, gendnum, alignnum)) {
            if (races_ok == 0)
                return i;
            else
                races_ok--;
        }
    }
    return ROLE_NONE;
}

/* is gendnum compatible with any rolenum/racenum/alignnum constraints? */
/* gender and alignment are not comparable (and also not constrainable) */
export function ok_gend(rolenum, racenum, gendnum, alignnum) { /* boolean */
    let i;
    let allow;

    if (gendnum >= 0 && gendnum < ROLE_GENDERS) {
        if (gr.rfilter.mask & genders[gendnum].allow)
            return FALSE;
        allow = genders[gendnum].allow;
        if (IndexOkT(rolenum, roles)
            && !(allow & roles[rolenum].allow & ROLE_GENDMASK))
            return FALSE;
        if (IndexOkT(racenum, races)
            && !(allow & races[racenum].allow & ROLE_GENDMASK))
            return FALSE;
        return TRUE;
    } else {
        /* random; check whether any selection is possible */
        for (i = 0; i < ROLE_GENDERS; i++) {
            if (gr.rfilter.mask & genders[i].allow)
                continue;
            allow = genders[i].allow;
            if (IndexOkT(rolenum, roles)
                && !(allow & roles[rolenum].allow & ROLE_GENDMASK))
                continue;
            if (IndexOkT(racenum, races)
                && !(allow & races[racenum].allow & ROLE_GENDMASK))
                continue;
            return TRUE;
        }
        return FALSE;
    }
}

/* pick a random gender subject to any rolenum/racenum/alignnum constraints */
/* gender and alignment are not comparable (and also not constrainable) */
/* If pickhow == PICK_RIGID a gender is returned only if there is  */
/* a single possibility */
export function pick_gend(rolenum, racenum, alignnum, pickhow) { /* int */
    let i;
    let gends_ok = 0;

    for (i = 0; i < ROLE_GENDERS; i++) {
        if (ok_gend(rolenum, racenum, i, alignnum))
            gends_ok++;
    }
    if (gends_ok == 0 || (gends_ok > 1 && pickhow == PICK_RIGID))
        return ROLE_NONE;
    gends_ok = rn2(gends_ok);
    for (i = 0; i < ROLE_GENDERS; i++) {
        if (ok_gend(rolenum, racenum, i, alignnum)) {
            if (gends_ok == 0)
                return i;
            else
                gends_ok--;
        }
    }
    return ROLE_NONE;
}

/* is alignnum compatible with any rolenum/racenum/gendnum constraints? */
/* alignment and gender are not comparable (and also not constrainable) */
export function ok_align(rolenum, racenum, gendnum, alignnum) { /* boolean */
    let i;
    let allow;

    if (alignnum >= 0 && alignnum < ROLE_ALIGNS) {
        if (gr.rfilter.mask & aligns[alignnum].allow)
            return FALSE;
        allow = aligns[alignnum].allow;
        if (IndexOkT(rolenum, roles)
            && !(allow & roles[rolenum].allow & AM_MASK))
            return FALSE;
        if (IndexOkT(racenum, races)
            && !(allow & races[racenum].allow & AM_MASK))
            return FALSE;
        return TRUE;
    } else {
        /* random; check whether any selection is possible */
        for (i = 0; i < ROLE_ALIGNS; i++) {
            if (gr.rfilter.mask & aligns[i].allow)
                continue;
            allow = aligns[i].allow;
            if (IndexOkT(rolenum, roles)
                && !(allow & roles[rolenum].allow & AM_MASK))
                continue;
            if (IndexOkT(racenum, races)
                && !(allow & races[racenum].allow & AM_MASK))
                continue;
            return TRUE;
        }
        return FALSE;
    }
}

/* Pick a random alignment subject to any rolenum/racenum/gendnum constraints;
   alignment and gender are not comparable (and also not constrainable).
   If pickhow == PICK_RIGID an alignment is returned only if there is
   a single possibility. */
export function pick_align(rolenum, racenum, gendnum, pickhow) { /* int */
    let i;
    let aligns_ok = 0;

    for (i = 0; i < ROLE_ALIGNS; i++) {
        if (ok_align(rolenum, racenum, gendnum, i))
            aligns_ok++;
    }
    if (aligns_ok == 0 || (aligns_ok > 1 && pickhow == PICK_RIGID))
        return ROLE_NONE;
    aligns_ok = rn2(aligns_ok);
    for (i = 0; i < ROLE_ALIGNS; i++) {
        if (ok_align(rolenum, racenum, gendnum, i)) {
            if (aligns_ok == 0)
                return i;
            else
                aligns_ok--;
        }
    }
    return ROLE_NONE;
}

export function rigid_role_checks() { /* void */
    let tmp;

    /* Some roles are limited to a single race, alignment, or gender and
     * calling this routine prior to XXX_player_selection() will help
     * prevent an extraneous prompt that actually doesn't allow
     * you to choose anything further. Note the use of PICK_RIGID which
     * causes the pick_XX() routine to return a value only if there is one
     * single possible selection, otherwise it returns ROLE_NONE.
     *
     */
    if (flags.initrole == ROLE_RANDOM) {
        /* If the role was explicitly specified as ROLE_RANDOM
         * via -uXXXX-@ or OPTIONS=role:random then choose the role
         * in here to narrow down later choices.
         */
        flags.initrole = pick_role(flags.initrace, flags.initgend,
                                   flags.initalign, PICK_RANDOM);
        if (flags.initrole < 0)
            flags.initrole = randrole_filtered();
    }
    if (flags.initrace == ROLE_RANDOM
        && (tmp = pick_race(flags.initrole, flags.initgend,
                            flags.initalign, PICK_RANDOM)) != ROLE_NONE)
        flags.initrace = tmp;
    if (flags.initalign == ROLE_RANDOM
        && (tmp = pick_align(flags.initrole, flags.initrace,
                             flags.initgend, PICK_RANDOM)) != ROLE_NONE)
        flags.initalign = tmp;
    if (flags.initgend == ROLE_RANDOM
        && (tmp = pick_gend(flags.initrole, flags.initrace,
                            flags.initalign, PICK_RANDOM)) != ROLE_NONE)
        flags.initgend = tmp;

    if (flags.initrole != ROLE_NONE) {
        if (flags.initrace == ROLE_NONE)
            flags.initrace = pick_race(flags.initrole, flags.initgend,
                                       flags.initalign, PICK_RIGID);
        if (flags.initalign == ROLE_NONE)
            flags.initalign = pick_align(flags.initrole, flags.initrace,
                                         flags.initgend, PICK_RIGID);
        if (flags.initgend == ROLE_NONE)
            flags.initgend = pick_gend(flags.initrole, flags.initrace,
                                       flags.initalign, PICK_RIGID);
    }
}

export function setrolefilter(bufp) { /* boolean */
    let i;
    let reslt = TRUE;

    if ((i = str2role(bufp)) != ROLE_NONE && i != ROLE_RANDOM)
        chars[gr.rfilter.roles + i] = TRUE;
    else if ((i = str2race(bufp)) != ROLE_NONE && i != ROLE_RANDOM)
        gr.rfilter.mask |= races[i].selfmask;
    else if ((i = str2gend(bufp)) != ROLE_NONE && i != ROLE_RANDOM)
        gr.rfilter.mask |= genders[i].allow;
    else if ((i = str2align(bufp)) != ROLE_NONE && i != ROLE_RANDOM)
        gr.rfilter.mask |= aligns[i].allow;
    else
        reslt = FALSE;
    return reslt;
}

export function gotrolefilter() { /* boolean */
    let i;

    if (gr.rfilter.mask)
        return TRUE;
    for (i = 0; i < SIZE(roles) - 1; ++i)
        if (chars[gr.rfilter.roles + i])
            return TRUE;
    return FALSE;
}

/* create a string like " !Bar !Kni" or " !chaotic" that can be
   put back into an RC file by #saveoptions */
export function rolefilterstring(outbuf, which) { /* char * */
    let i;

    chars[outbuf + 0] = chars[outbuf + 1] = ord('\0');
    switch (which) {
    case RS_ROLE:
        for (i = 0; i < SIZE(roles) - 1; ++i) {
            if (chars[gr.rfilter.roles + i])
                sprintf(eos(outbuf), _(" !%.3s"), roles[i].name.m);
        }
        break;
    case RS_RACE:
        for (i = 0; i < SIZE(races) - 1; ++i) {
            if ((gr.rfilter.mask & races[i].selfmask) != 0)
                sprintf(eos(outbuf), _(" !%s"), races[i].noun);
        }
        break;
    case RS_GENDER:
        for (i = 0; i < SIZE(genders) - 1; ++i) {
            if ((gr.rfilter.mask & genders[i].allow) != 0)
                sprintf(eos(outbuf), _(" !%s"), genders[i].adj);
        }
        break;
    case RS_ALGNMNT:
        for (i = 0; i < SIZE(aligns) - 1; ++i) {
            if ((gr.rfilter.mask & aligns[i].allow) != 0)
                sprintf(eos(outbuf), _(" !%s"), aligns[i].adj);
        }
        break;
    default:
        impossible(_("rolefilterstring: bad role aspect (%d)"), which);
        strcpy(outbuf, _(" ?"));
        break;
    }
    /* constructed with a leading space; drop it */
    return outbuf + 1;
}

export function clearrolefilter(which) { /* void */
    let i;

    switch (which) {
    case RS_filter:
        gr.rfilter.mask = 0; /* clear race, gender, and alignment filters */
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case RS_ROLE:
        for (i = 0; i < SIZE(roles) - 1; ++i)
            chars[gr.rfilter.roles + i] = FALSE;
        break;
    case RS_RACE:
        gr.rfilter.mask &= ~ROLE_RACEMASK;
        break;
    case RS_GENDER:
        gr.rfilter.mask &= ~ROLE_GENDMASK;
        break;
    case RS_ALGNMNT:
        gr.rfilter.mask &= ~AM_MASK;
        break;
    }
}

function promptsep(buf, num_post_attribs) { /* char * */
    let conjuct = _("and ");

    if (num_post_attribs > 1 && gr.role_post_attribs < num_post_attribs
        && gr.role_post_attribs > 1)
        strcat(buf, _(","));
    strcat(buf, _(" "));
    --gr.role_post_attribs;
    if (!gr.role_post_attribs && num_post_attribs > 1)
        strcat(buf, conjuct);
    return buf;
}

function role_gendercount(rolenum) { /* int */
    let gendcount = 0;

    if (validrole(rolenum)) {
        if (roles[rolenum].allow & ROLE_MALE)
            ++gendcount;
        if (roles[rolenum].allow & ROLE_FEMALE)
            ++gendcount;
        if (roles[rolenum].allow & ROLE_NEUTER)
            ++gendcount;
    }
    return gendcount;
}

function race_alignmentcount(racenum) { /* int */
    let aligncount = 0;

    if (racenum != ROLE_NONE && racenum != ROLE_RANDOM) {
        if (races[racenum].allow & AM_CHAOTIC)
            ++aligncount;
        if (races[racenum].allow & AM_LAWFUL)
            ++aligncount;
        if (races[racenum].allow & AM_NEUTRAL)
            ++aligncount;
    }
    return aligncount;
}

export function root_plselection_prompt(
    suppliedbuf, buflen,
    rolenum, racenum, gendnum, alignnum) { /* char * */
    const $frame = stack_frame(); try {
    let k, gendercount = 0, aligncount = 0;
    let buf = stack_array(char, BUFSZ);
    let err_ret = init_string(static_array("root_plselection_prompt.err_ret", char, sizeof_string(" character's")), _(" character's"), true);
    let donefirst = FALSE;

    if (!suppliedbuf || buflen < 1)
        return err_ret;

    /* initialize these static variables each time this is called */
    gr.role_post_attribs = 0;
    for (k = 0; k < NUM_BP; ++k)
        chars[gr.role_pa + k] = 0;
    chars[buf + 0] = ord('\0');
    chars[suppliedbuf] = ord('\0');

    /* How many alignments are allowed for the desired race? */
    if (racenum != ROLE_NONE && racenum != ROLE_RANDOM)
        aligncount = race_alignmentcount(racenum);

    if (alignnum != ROLE_NONE && alignnum != ROLE_RANDOM
        && ok_align(rolenum, racenum, gendnum, alignnum)) {
        if (donefirst)
            strcat(buf, _(" "));
        strcat(buf, aligns[alignnum].adj);
        donefirst = TRUE;
    } else {
        /* in case we got here by failing the ok_align() test */
        if (alignnum != ROLE_RANDOM)
            alignnum = ROLE_NONE;
        /* if alignment not specified, but race is specified
           and only one choice of alignment for that race then
           don't include it in the later list */
        if ((((racenum != ROLE_NONE && racenum != ROLE_RANDOM)
              && ok_race(rolenum, racenum, gendnum, alignnum))
             && (aligncount > 1))
            || (racenum == ROLE_NONE || racenum == ROLE_RANDOM)) {
            chars[gr.role_pa + BP_ALIGN] = 1;
            gr.role_post_attribs++;
        }
    }
    /* <your lawful> */

    /* How many genders are allowed for the desired role? */
    if (validrole(rolenum))
        gendercount = role_gendercount(rolenum);

    if (gendnum != ROLE_NONE && gendnum != ROLE_RANDOM) {
        if (validrole(rolenum)) {
            /* if role specified, and multiple choice of genders for it,
               and name of role itself does not distinguish gender */
            if ((rolenum != ROLE_NONE) && (gendercount > 1)
                && !roles[rolenum].name.f) {
                if (donefirst)
                    strcat(buf, _(" "));
                strcat(buf, genders[gendnum].adj);
                donefirst = TRUE;
            }
        } else {
            if (donefirst)
                strcat(buf, _(" "));
            strcat(buf, genders[gendnum].adj);
            donefirst = TRUE;
        }
    } else {
        /* if gender not specified, but role is specified
                and only one choice of gender then
                don't include it in the later list */
        if ((validrole(rolenum) && (gendercount > 1))
            || !validrole(rolenum)) {
            chars[gr.role_pa + BP_GEND] = 1;
            gr.role_post_attribs++;
        }
    }
    /* <your lawful female> */

    if (racenum != ROLE_NONE && racenum != ROLE_RANDOM) {
        if (validrole(rolenum)
            && ok_race(rolenum, racenum, gendnum, alignnum)) {
            if (donefirst)
                strcat(buf, _(" "));
            strcat(buf, (rolenum == ROLE_NONE) ? races[racenum].noun
                                               : races[racenum].adj);
            donefirst = TRUE;
        } else if (!validrole(rolenum)) {
            if (donefirst)
                strcat(buf, _(" "));
            strcat(buf, races[racenum].noun);
            donefirst = TRUE;
        } else {
            chars[gr.role_pa + BP_RACE] = 1;
            gr.role_post_attribs++;
        }
    } else {
        chars[gr.role_pa + BP_RACE] = 1;
        gr.role_post_attribs++;
    }
    /* <your lawful female gnomish> || <your lawful female gnome> */

    if (validrole(rolenum)) {
        assert(IndexOkT(rolenum, roles));
        if (donefirst)
            strcat(buf, _(" "));
        if (gendnum != ROLE_NONE) {
            if (gendnum == 1 && roles[rolenum].name.f)
                strcat(buf, roles[rolenum].name.f);
            else
                strcat(buf, roles[rolenum].name.m);
        } else {
            if (roles[rolenum].name.f) {
                strcat(buf, roles[rolenum].name.m);
                strcat(buf, _("/"));
                strcat(buf, roles[rolenum].name.f);
            } else
                strcat(buf, roles[rolenum].name.m);
        }
        donefirst = TRUE;
    } else if (rolenum == ROLE_NONE) {
        chars[gr.role_pa + BP_ROLE] = 1;
        gr.role_post_attribs++;
    }

    if ((racenum == ROLE_NONE || racenum == ROLE_RANDOM)
        && !validrole(rolenum)) {
        if (donefirst)
            strcat(buf, _(" "));
        strcat(buf, _("character"));
        /*donefirst = TRUE;*/
    }
    /* <your lawful female gnomish cavewoman> || <your lawful female gnome>
     *    || <your lawful female character>
     */
    if (buflen > int(unsigned(strlen(buf) + 1))) {
        strcpy(suppliedbuf, buf);
        return suppliedbuf;
    } else
        return err_ret;
    } finally { stack_pop($frame); }
}

export function build_plselection_prompt(
    buf, buflen,
    rolenum, racenum, gendnum, alignnum) { /* char * */
    const $frame = stack_frame(); try {
    let defprompt = _("Shall I pick a character for you? [ynaq] ");
    let num_post_attribs = 0;
    let tmpbuf = stack_array(char, BUFSZ), p;

    if (buflen < QBUFSZ)
        return defprompt;

    strcpy(tmpbuf, _("Shall I pick "));
    if (racenum != ROLE_NONE || validrole(rolenum))
        strcat(tmpbuf, _("your "));
    else
        strcat(tmpbuf, _("a "));
    /* <your> */

    root_plselection_prompt(eos(tmpbuf), int(unsigned(unsigned(buflen) - Strlen(tmpbuf))),
                                   rolenum, racenum, gendnum, alignnum);
    /* "Shall I pick a character's role, race, gender, and alignment for you?"
       plus " [ynaq] (y)" is a little too long for a conventional 80 columns;
       also, "pick a character's <anything>" sounds a bit stilted */
    strsubst(tmpbuf, _("pick a character"), _("pick character"));
    sprintf(buf, _("%s"), s_suffix(tmpbuf));
    /* don't bother splitting caveman/cavewoman or priest/priestess
       in order to apply possessive suffix to both halves, but do
       change "priest/priestess'" to "priest/priestess's" */
    if ((p = strstri(buf, _("priest/priestess'"))) != 0
        && chars[p + (sizeof_string("priest/priestess'") - sizeof_string(""))] == ord('\0'))
        strkitten(buf, ord('s'));

    /* buf should now be:
     *    <your lawful female gnomish cavewoman's>
     * || <your lawful female gnome's>
     * || <your lawful female character's>
     *
     * Now append the post attributes to it
     */
    num_post_attribs = gr.role_post_attribs;
    if (!num_post_attribs) {
        /* some constraints might have been mutually exclusive, in which case
           some prompting that would have been omitted is needed after all */
        if (flags.initrole == ROLE_NONE && !chars[gr.role_pa + BP_ROLE])
            chars[gr.role_pa + BP_ROLE] = ++gr.role_post_attribs;
        if (flags.initrace == ROLE_NONE && !chars[gr.role_pa + BP_RACE])
            chars[gr.role_pa + BP_RACE] = ++gr.role_post_attribs;
        if (flags.initalign == ROLE_NONE && !chars[gr.role_pa + BP_ALIGN])
            chars[gr.role_pa + BP_ALIGN] = ++gr.role_post_attribs;
        if (flags.initgend == ROLE_NONE && !chars[gr.role_pa + BP_GEND])
            chars[gr.role_pa + BP_GEND] = ++gr.role_post_attribs;
        num_post_attribs = gr.role_post_attribs;
    }
    if (num_post_attribs) {
        if (chars[gr.role_pa + BP_RACE]) {
            promptsep(eos(buf), num_post_attribs);
            strcat(buf, _("race"));
        }
        if (chars[gr.role_pa + BP_ROLE]) {
            promptsep(eos(buf), num_post_attribs);
            strcat(buf, _("role"));
        }
        if (chars[gr.role_pa + BP_GEND]) {
            promptsep(eos(buf), num_post_attribs);
            strcat(buf, _("gender"));
        }
        if (chars[gr.role_pa + BP_ALIGN]) {
            promptsep(eos(buf), num_post_attribs);
            strcat(buf, _("alignment"));
        }
    }
    strcat(buf, _(" for you? [ynaq] "));
    return buf;
    } finally { stack_pop($frame); }
}

export function plnamesuffix() { /* void */
    let sptr, eptr;
    let i;

    /* some generic user names will be ignored in favor of prompting */
    if (sysopt.genericusers) {
        if (chars[sysopt.genericusers] == ord('*')) {
            chars[svp.plname + 0] = ord('\0');
        } else {
            /* need to ignore appended '-role-race-gender-alignment';
               'plnamelen' is non-zero when dealing with plname[] value that
               contains a username with dash(es) in it and is usually 0 */
            i = ((eptr = strchr(svp.plname + gp.plnamelen, ord('-'))) != 0)
                ? (eptr - svp.plname)
                : int(Strlen(svp.plname));
            /* look for plname[] in the 'genericusers' space-separated list */
            if (findword(sysopt.genericusers, svp.plname, i, FALSE))
                /* it's generic; remove it so that askname() will be called */
                chars[svp.plname + 0] = ord('\0');
        }
        if (!chars[svp.plname + 0])
            gp.plnamelen = 0;
    }

    do {
        if (!chars[svp.plname + 0]) {
            askname()(); /* fill svp.plname[] if necessary, or set
                        * defer_plname */
            gp.plnamelen = 0; /* plname[] might have -role-race-&c attached */
        }

        /* Look for tokens delimited by '-' */
        sptr = svp.plname + gp.plnamelen;
        if ((eptr = strchr(sptr, ord('-'))) != 0)
            chars[eptr++] = ord('\0');
        while (eptr) {
            /* Isolate the next token */
            sptr = eptr;
            if ((eptr = strchr(sptr, ord('-'))) != 0)
                chars[eptr++] = ord('\0');

            /* Try to match it to something */
            if ((i = str2role(sptr)) != ROLE_NONE)
                flags.initrole = i;
            else if ((i = str2race(sptr)) != ROLE_NONE)
                flags.initrace = i;
            else if ((i = str2gend(sptr)) != ROLE_NONE)
                flags.initgend = i;
            else if ((i = str2align(sptr)) != ROLE_NONE)
                flags.initalign = i;
        }
    } while (!chars[svp.plname + 0] && !iflags.defer_plname);

    /* commas in the svp.plname confuse the record file, convert to spaces */
    strNsubst(svp.plname, _(","), _(" "), 0);
}

/* show current settings for name, role, race, gender, and alignment
   in the specified window */
export function role_selection_prolog(which, where) { /* void */
    const $frame = stack_frame(); try {
    let choosing = init_string(static_array("role_selection_prolog.choosing", char, sizeof_string(" choosing now")), _(" choosing now"), true),
                               not_yet = init_string(static_array("role_selection_prolog.not_yet", char, sizeof_string(" not yet specified")), _(" not yet specified"), true),
                               rand_choice = init_string(static_array("role_selection_prolog.rand_choice", char, sizeof_string(" random")), _(" random"), true);
    let buf = stack_array(char, BUFSZ);
    let r, c, gend, a, allowmask;

    r = flags.initrole;
    c = flags.initrace;
    gend = flags.initgend;
    a = flags.initalign;
    if (r >= 0) {
        assert(IndexOkT(r, roles));
        allowmask = roles[r].allow;
        if ((allowmask & ROLE_RACEMASK) == MH_HUMAN)
            c = 0; /* races[human] */
        else if (IndexOkT(c, races)
                 && !(allowmask & ROLE_RACEMASK & races[c].allow))
            c = ROLE_RANDOM;
        if ((allowmask & ROLE_GENDMASK) == ROLE_MALE)
            gend = 0; /* role forces male (hypothetical) */
        else if ((allowmask & ROLE_GENDMASK) == ROLE_FEMALE)
            gend = 1; /* role forces female (valkyrie) */
        if ((allowmask & AM_MASK) == AM_LAWFUL)
            a = 0; /* aligns[lawful] */
        else if ((allowmask & AM_MASK) == AM_NEUTRAL)
            a = 1; /* aligns[neutral] */
        else if ((allowmask & AM_MASK) == AM_CHAOTIC)
            a = 2; /* aligns[chaotic] */
    }
    if (c >= 0) {
        assert(IndexOkT(c, races));
        allowmask = races[c].allow;
        if ((allowmask & AM_MASK) == AM_LAWFUL)
            a = 0; /* aligns[lawful] */
        else if ((allowmask & AM_MASK) == AM_NEUTRAL)
            a = 1; /* aligns[neutral] */
        else if ((allowmask & AM_MASK) == AM_CHAOTIC)
            a = 2; /* aligns[chaotic] */
        /* [c never forces gender] */
    }
    /* [g and a don't constrain anything sufficiently
       to narrow something done to a single choice] */

    sprintf(buf, _("%12s "), _("name:"));
    strcat(buf, (which == RS_NAME) ? choosing
                : !chars[svp.plname] ? not_yet : svp.plname);
    putstr()(where, 0, buf);
    sprintf(buf, _("%12s "), _("role:"));
    assert(which == RS_ROLE || r == ROLE_NONE || r == ROLE_RANDOM
           || IndexOkT(r, roles));
    strcat(buf, (which == RS_ROLE) ? choosing
                : (r == ROLE_NONE) ? not_yet
                  : (r == ROLE_RANDOM) ? rand_choice
                    : roles[r].name.m);
    if (r >= 0 && roles[r].name.f) {
        /* distinct female name [caveman/cavewoman, priest/priestess] */
        if (gend == 1)
            /* female specified; replace male role name with female one */
            sprintf(strchr(buf, ord(':')), _(": %s"), roles[r].name.f);
        else if (gend < 0)
            /* gender unspecified; append slash and female role name */
            sprintf(eos(buf), _("/%s"), roles[r].name.f);
    }
    putstr()(where, 0, buf);
    sprintf(buf, _("%12s "), _("race:"));
    assert(which == RS_RACE || c == ROLE_NONE || c == ROLE_RANDOM
           || IndexOkT(c, races));
    strcat(buf, (which == RS_RACE) ? choosing
                : (c == ROLE_NONE) ? not_yet
                  : (c == ROLE_RANDOM) ? rand_choice
                    : races[c].noun);
    putstr()(where, 0, buf);
    sprintf(buf, _("%12s "), _("gender:"));
    strcat(buf, (which == RS_GENDER) ? choosing
                : (gend == ROLE_NONE) ? not_yet
                  : (gend == ROLE_RANDOM) ? rand_choice
                    : genders[gend].adj);
    putstr()(where, 0, buf);
    sprintf(buf, _("%12s "), _("alignment:"));
    strcat(buf, (which == RS_ALGNMNT) ? choosing
                : (a == ROLE_NONE) ? not_yet
                  : (a == ROLE_RANDOM) ? rand_choice
                    : aligns[a].adj);
    putstr()(where, 0, buf);
    } finally { stack_pop($frame); }
}

/* add a "pick alignment first"-type entry to the specified menu */
export function role_menu_extra(which, where, preselect) { /* void */
    const $frame = stack_frame(); try {
    let RS_menu_let = static_array("role_menu_extra.RS_menu_let", char, null, [
        ord('='),  /* name */
        ord('?'),  /* role */
        ord('/'),  /* race */
        ord('\"'), /* gender */
        ord('['),  /* alignment */
    ]);
    let any = stack_struct(struct_any);
    let buf = stack_array(char, BUFSZ);
    let what = 0, constrainer = 0, forcedvalue = 0;
    let f = 0, r, c, gend, a, i, allowmask;
    let clr = NO_COLOR;

    r = flags.initrole;
    c = flags.initrace;
    switch (which) {
    case RS_NAME:
        what = _("name");
        break;
    case RS_ROLE:
        what = _("role");
        f = r;
        for (i = 0; i < SIZE(roles) - 1; ++i)
            if (i != f && !chars[gr.rfilter.roles + i])
                break;
        if (i == SIZE(roles) - 1) {
            constrainer = _("filter");
            forcedvalue = _("role");
        }
        break;
    case RS_RACE:
        what = _("race");
        f = flags.initrace;
        c = ROLE_NONE; /* override player's setting */
        if (r >= 0) {
            allowmask = roles[r].allow & ROLE_RACEMASK;
            if (allowmask == MH_HUMAN)
                c = 0; /* races[human] */
            if (c >= 0) {
                constrainer = _("role");
                forcedvalue = races[c].noun;
            } else if (f >= 0 && ((allowmask & ~gr.rfilter.mask)
                                  == races[f].selfmask)) {
                /* if there is only one race choice available due to user
                   options disallowing others, race menu entry is disabled */
                constrainer = _("filter");
                forcedvalue = _("race");
            }
        }
        break;
    case RS_GENDER:
        what = _("gender");
        f = flags.initgend;
        gend = ROLE_NONE;
        if (r >= 0) {
            allowmask = roles[r].allow & ROLE_GENDMASK;
            if (allowmask == ROLE_MALE)
                gend = 0; /* genders[male] */
            else if (allowmask == ROLE_FEMALE)
                gend = 1; /* genders[female] */
            if (gend >= 0) {
                constrainer = _("role");
                forcedvalue = genders[gend].adj;
            } else if (f >= 0 && ((allowmask & ~gr.rfilter.mask)
                                  == genders[f].allow)) {
                /* if there is only one gender choice available due to user
                   options disallowing other, gender menu entry is disabled */
                constrainer = _("filter");
                forcedvalue = _("gender");
            }
        }
        break;
    case RS_ALGNMNT:
        what = _("alignment");
        f = flags.initalign;
        a = ROLE_NONE;
        if (r >= 0) {
            allowmask = roles[r].allow & AM_MASK;
            if (allowmask == AM_LAWFUL)
                a = 0; /* aligns[lawful] */
            else if (allowmask == AM_NEUTRAL)
                a = 1; /* aligns[neutral] */
            else if (allowmask == AM_CHAOTIC)
                a = 2; /* aligns[chaotic] */
            if (a >= 0)
                constrainer = _("role");
        }
        if (c >= 0 && !constrainer) {
            allowmask = races[c].allow & AM_MASK;
            if (allowmask == AM_LAWFUL)
                a = 0; /* aligns[lawful] */
            else if (allowmask == AM_NEUTRAL)
                a = 1; /* aligns[neutral] */
            else if (allowmask == AM_CHAOTIC)
                a = 2; /* aligns[chaotic] */
            if (a >= 0)
                constrainer = _("race");
        }
        if (f >= 0 && !constrainer
            && (AM_MASK & ~gr.rfilter.mask) == aligns[f].allow) {
            /* if there is only one alignment choice available due to user
               options disallowing others, algn menu entry is disabled */
            constrainer = _("filter");
            forcedvalue = _("alignment");
        }
        if (a >= 0)
            forcedvalue = aligns[a].adj;
        break;
    }

    struct_assign(any, cg.zeroany); /* zero out all bits */
    if (constrainer) {
        any.a_int = 0;
        /* use four spaces of padding to fake a grayed out menu choice */
        sprintf(buf, _("%4s%s forces %s"), _(""), constrainer, forcedvalue);
        add_menu_str(where, buf);
    } else if (what) {
        any.a_int = RS_menu_arg(which);
        sprintf(buf, _("Pick%s %s first"), (f >= 0) ? _(" another") : _(""), what);
        add_menu(where, nul_glyphinfo, any, chars[RS_menu_let + which], 0,
                 ATR_NONE, clr, buf, MENU_ITEMFLAGS_NONE);
    } else if (which == RS_filter) {
        let setfiltering = stack_array(char, 40);

        any.a_int = RS_menu_arg(RS_filter);
        sprintf(setfiltering, _("%s role/race/&c filtering"), gotrolefilter() ? _("Reset") : _("Set"))
;
        add_menu(where, nul_glyphinfo, any, ord('~'), 0, ATR_NONE,
                 clr, setfiltering, MENU_ITEMFLAGS_NONE);
    } else if (which == ROLE_RANDOM) {
        any.a_int = ROLE_RANDOM;
        add_menu(where, nul_glyphinfo, any, ord('*'), 0,
                 ATR_NONE, clr, _("Random"),
                 preselect ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);
    } else if (which == ROLE_NONE) {
        any.a_int = ROLE_NONE;
        add_menu(where, nul_glyphinfo, any, ord('q'), 0,
                 ATR_NONE, clr, _("Quit"),
                 preselect ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);
    } else {
        impossible(_("role_menu_extra: bad arg (%d)"), which);
    }
    } finally { stack_pop($frame); }
}

/*
 *      Special setup modifications here:
 *
 *      Unfortunately, this is going to have to be done
 *      on each newgame or restore, because you lose the permonst mods
 *      across a save/restore.  :-)
 *
 *      1 - The Rogue Leader is the Tourist Nemesis.
 *      2 - Priests start with a random alignment - convert the leader and
 *          guardians here.
 *      3 - Priests also get their set of deities from a randomly chosen role.
 *      4 - [obsolete] Elves can have one of two different leaders,
 *          but can't work it out here because it requires hacking the
 *          level file data (see sp_lev.c).
 *
 * This code also replaces quest_init().
 */
export function role_init() { /* void */
    let alignmnt;
    let pm;

    /* Strip the role letter out of the player name.
     * This is included for backwards compatibility.
     */
    plnamesuffix();

    /* Check for a valid role.  Try flags.initrole first. */
    if (!validrole(flags.initrole)) {
        /* Try the player letter second */
        if ((flags.initrole = str2role(svp.pl_character)) < 0)
            /* None specified; pick a random role */
            flags.initrole = randrole_filtered();
    }

    /* We now have a valid role index.  Copy the role name back. */
    /* This should become OBSOLETE */
    strcpy(svp.pl_character, roles[flags.initrole].name.m);
    chars[svp.pl_character + (PL_CSIZ - 1)] = ord('\0');

    /* Check for a valid race */
    if (!validrace(flags.initrole, flags.initrace))
        flags.initrace = randrace(flags.initrole);

    /* Check for a valid gender.  If new game, check both initgend
     * and female.  On restore, assume flags.female is correct. */
    if (flags.pantheon == -1) { /* new game */
        if (!validgend(flags.initrole, flags.initrace, flags.female))
            flags.female = +!flags.female;
    }
    if (!validgend(flags.initrole, flags.initrace, flags.initgend))
        /* Note that there is no way to check for an unspecified gender. */
        flags.initgend = flags.female;

    /* Check for a valid alignment */
    if (!validalign(flags.initrole, flags.initrace, flags.initalign))
        /* Pick a random alignment */
        flags.initalign = randalign(flags.initrole, flags.initrace);
    alignmnt = aligns[flags.initalign].value;

    /* Initialize gu.urole and gu.urace */
    struct_assign(gu.urole, roles[flags.initrole]);
    struct_assign(gu.urace, races[flags.initrace]);

    /* Fix up the quest leader */
    if (gu.urole.ldrnum != NON_PM) {
        pm = mons[gu.urole.ldrnum];
        pm.msound = MS_LEADER;
        pm.mflags2 = or64u(pm.mflags2, M2_PEACEFUL);
        pm.mflags3 |= M3_CLOSE;
        pm.maligntyp = alignmnt * 3;
        /* if gender is random, we choose it now instead of waiting
           until the leader monster is created */
        svq.quest_status.ldrgend =
            is_neuter(pm) ? 2 : is_female(pm) ? 1 : is_male(pm)
                                                        ? 0
                                                        : +(rn2(100) < 50);
    }

    /* Fix up the quest guardians */
    if (gu.urole.guardnum != NON_PM) {
        pm = mons[gu.urole.guardnum];
        pm.mflags2 = or64u(pm.mflags2, M2_PEACEFUL);
        pm.maligntyp = alignmnt * 3;
    }

    /* Fix up the quest nemesis */
    if (gu.urole.neminum != NON_PM) {
        pm = mons[gu.urole.neminum];
        pm.msound = MS_NEMESIS;
        pm.mflags2 = and64u(pm.mflags2, ~M2_PEACEFUL);
        pm.mflags2 = or64u(pm.mflags2, (M2_NASTY | M2_STALK | M2_HOSTILE));
        pm.mflags3 &= ~M3_CLOSE;
        pm.mflags3 |= M3_WANTSARTI | M3_WAITFORU;
        /* if gender is random, we choose it now instead of waiting
           until the nemesis monster is created */
        svq.quest_status.nemgend = is_neuter(pm) ? 2 : is_female(pm) ? 1
                                   : is_male(pm) ? 0 : +(rn2(100) < 50);
    }

    /* Fix up the god names */
    if (flags.pantheon == -1) {             /* new game */
        let trycnt = 0;
        flags.pantheon = flags.initrole;    /* use own gods */
        /* unless they're missing */
        while (!roles[flags.pantheon].lgod && ++trycnt < 100)
            flags.pantheon = randrole(FALSE);
        if (!roles[flags.pantheon].lgod) {
            let i;
            for (i = 0; i < SIZE(roles) - 1; i++)
                if (roles[i].lgod) {
                    flags.pantheon = i;
                    break;
                }
        }
    }
    if (!gu.urole.lgod) {
        gu.urole.lgod = roles[flags.pantheon].lgod;
        gu.urole.ngod = roles[flags.pantheon].ngod;
        gu.urole.cgod = roles[flags.pantheon].cgod;
    }
    /* 0 or 1; no gods are neuter, nor is gender randomized */
    svq.quest_status.godgend = +!strncmpi((align_gtitle(alignmnt)), _(("goddess")), -1);

    if (Role_if(PM_CLERIC))
        objects[SPE_LIGHT].oc_subtyp = P_CLERIC_SPELL;

    /* #if 0: not in this build */

    /* Artifacts are fixed in hack_artifacts() */

    /* Success! */
    return;
}

export function Hello(mtmp) { /* const char * */
    switch (Role_switch()) {
    case PM_KNIGHT:
        return _("Salutations"); /* Olde English */
    case PM_SAMURAI:
        return (mtmp && mtmp.data == mons[PM_SHOPKEEPER])
                    ? _("Irasshaimase")
                    : _("Konnichi wa"); /* Japanese */
    case PM_TOURIST:
        return _("Aloha"); /* Hawaiian */
    case PM_VALKYRIE:
        return (

               (mtmp && mtmp.data == mons[PM_MAIL_DAEMON]) ? _("Hallo") :

               _("Velkommen")); /* Norse */
    default:
        return _("Hello");
    }
}

export function Goodbye() { /* const char * */
    switch (Role_switch()) {
    case PM_KNIGHT:
        return _("Fare thee well"); /* Olde English */
    case PM_SAMURAI:
        return _("Sayonara"); /* Japanese */
    case PM_TOURIST:
        return _("Aloha"); /* Hawaiian */
    case PM_VALKYRIE:
        return _("Farvel"); /* Norse */
    default:
        return _("Goodbye");
    }
}

/* if pmindex is any player race (not necessarily the hero's),
   return a pointer to the races[] entry for it; if pmindex is for some
   other type of monster which isn't a player race, return Null */
export function character_race(pmindex) { /* const struct Race * */
    let r;

    for (r = races[0]; r.noun != (0); r = ptr_add(r, 1))
        if (r.mnum == pmindex)
            return r;
    return null;
}

/*--------------------------------------------------------------------------*/

/* potential interface routine */
export function genl_player_selection() { /* void */
    if (genl_player_setup(0))
        return;

    /* player cancelled role/race/&c selection, so quit */
    nh_terminate(EXIT_SUCCESS);
    /*NOTREACHED*/
}

/* ['#else' far below] */

/* try to reduce clutter in the code below... */
export function ROLE() { return flags.initrole; }
export function RACE() { return flags.initrace; }
export function GEND() { return flags.initgend; }
export function ALGN() { return flags.initalign; }

/* guts of tty's player_selection() */
export function genl_player_setup(screenheight) { /* int */
    const $frame = stack_frame(); try {
    var pbuf = stack_array(char, QBUFSZ);
    var any = stack_struct(struct_any);
    var i, k, n, choice, nextpick;
    var getconfirmation, picksomething;
    var win = WIN_ERR;
    var selected = stack_var(ptr_to(struct_mi), null);
    var clr = NO_COLOR;
    var pick4u = ord('n');
    var result = 0; /* assume failure (player chooses to 'quit') */

    program_state.in_role_selection++; /* affects tty menu cleanup */
    /* Used to avoid "Is this ok?" if player has already specified all
     * four facets of role.
     * Note that rigid_role_checks might force any unspecified facets to
     * have a specific value, but that will still require confirmation;
     * player can specify the forced ones if avoiding that is demanded.
     */
    picksomething = +(ROLE() == ROLE_NONE || RACE() == ROLE_NONE
                     || GEND() == ROLE_NONE || ALGN() == ROLE_NONE);
    /* Used for '-@';
     * choose randomly without asking for all unspecified facets.
     */
    if (flags.randomall && picksomething) {
        if (ROLE() == ROLE_NONE)
            flags.initrole = ROLE_RANDOM;
        if (RACE() == ROLE_NONE)
            flags.initrace = ROLE_RANDOM;
        if (GEND() == ROLE_NONE)
            flags.initgend = ROLE_RANDOM;
        if (ALGN() == ROLE_NONE)
            flags.initalign = ROLE_RANDOM;
    }

    /* prevent unnecessary prompting if role forces race (samurai) or gender
       (valkyrie) or alignment (rogue), or race forces alignment (orc), &c */
    rigid_role_checks();

    setup_done: { if (ROLE() == ROLE_NONE || RACE() == ROLE_NONE
        || GEND() == ROLE_NONE || ALGN() == ROLE_NONE) {
        var prompt = build_plselection_prompt(pbuf, QBUFSZ,
                                                ROLE(), RACE(), GEND(), ALGN());
        /* prompt[] contains "Shall I pick ... for you? [ynaq] "
           y - game picks role,&c then asks player to confirm;
           n - player manually chooses via menu selections;
           a - like 'y', but skips confirmation and starts game;
           q - quit
         */

        trimspaces(prompt); /* 'prompt' is constructed with trailing space */
        /* accept any character and do validation ourselves so that we can
           shorten prompt; it will be "Shall I pick ... for you? [ynaq] "
           with final space appended by yn_function() [for tty at least] */
        do {
            pick4u = yn_function(prompt, 0, ord('\0'), FALSE);
            pick4u = lowc(pick4u);
            if (pick4u == ord('\x1b') || pick4u == ord('q')) /* handle [q] */
                break setup_done;;
            if (pick4u == ord(' ') || pick4u == ord('\n') || pick4u == ord('\r'))
                pick4u = ord('y'); /* default */
            else if (pick4u == ord('@') || pick4u == ord('*'))
                pick4u = ord('a'); /* similar to '-@' on command line */
            /* TODO? handle response of '?' */
        } while (pick4u != ord('y') && pick4u != ord('n') && pick4u != ord('a')); /* [yna] */

    /* #else (#if 1): not in this build */
    }

 makepicks: for (;;) {
    nextpick = RS_ROLE;
    do {
        if (nextpick == RS_ROLE) {
            nextpick = RS_RACE;
            /* Select a role, if necessary;
               we'll try to be compatible with pre-selected
               race/gender/alignment, but may not succeed. */
            if (ROLE() < 0) {
                /* process the choice */
                if (pick4u == ord('y') || pick4u == ord('a') || ROLE() == ROLE_RANDOM) {
                    /* pick a random role */
                    k = pick_role(RACE(), GEND(), ALGN(), PICK_RANDOM);
                    if (k < 0) {
                        pline(_("Incompatible role!"));
                        k = randrole(FALSE);
                    }
                } else {
                    /* 'excess' is used to try to avoid tty pagination */
                    var excess = maybe_skip_seps(screenheight, RS_ROLE);

                    /* prompt for a role */
                    win = plsel_startmenu(screenheight, RS_ROLE);
                    /* populate the menu with role choices */
                    setup_rolemenu(win, TRUE, RACE(), GEND(), ALGN());
                    /* add miscellaneous menu entries */
                    role_menu_extra(ROLE_RANDOM, win, TRUE);
                    struct_assign(any, cg.zeroany); /* separator, not a choice */
                    if (excess < 1 || excess > 2)
                        add_menu_str(win, _(""));
                    role_menu_extra(RS_RACE, win, FALSE);
                    role_menu_extra(RS_GENDER, win, FALSE);
                    role_menu_extra(RS_ALGNMNT, win, FALSE);
                    role_menu_extra(RS_filter, win, FALSE);
                    role_menu_extra(ROLE_NONE, win, FALSE); /* quit */
                    strcpy(pbuf, _("Pick a role or profession"));
                    end_menu()(win, pbuf);
                    n = select_menu(win, PICK_ONE, selected);
                    /*
                     * PICK_ONE with preselected choice behaves strangely:
                     *  n == -1 -- <escape>, so use quit choice;
                     *  n ==  0 -- explicitly chose preselected entry,
                     *             toggling it off, so use it;
                     *  n ==  1 -- implicitly chose preselected entry
                     *             with <space> or <return>;
                     *  n ==  2 -- explicitly chose a different entry, so
                     *             both it and preselected one are in list.
                     */
                    if (n > 0) {
                        choice = ptr_add(selected[0], 0).item.a_int;
                        if (n > 1 && choice == ROLE_RANDOM)
                            choice = ptr_add(selected[0], 1).item.a_int;
                    } else
                        choice = (n == 0) ? ROLE_RANDOM : ROLE_NONE;
                    if (selected[0])
                        free(addr_of(selected[0])), selected[0] = null;
                    destroy_nhwindow()(win), win = WIN_ERR;

                    if (choice == ROLE_NONE) {
                        break setup_done; /* selected quit */
                    } else if (choice == RS_menu_arg(RS_ALGNMNT)) {
                        flags.initalign = k = ROLE_NONE;
                        nextpick = RS_ALGNMNT;
                    } else if (choice == RS_menu_arg(RS_GENDER)) {
                        flags.initgend = k = ROLE_NONE;
                        nextpick = RS_GENDER;
                    } else if (choice == RS_menu_arg(RS_RACE)) {
                        flags.initrace = k = ROLE_NONE;
                        nextpick = RS_RACE;
                    } else if (choice == RS_menu_arg(RS_filter)) {
                        flags.initrole = k = ROLE_NONE;
                        reset_role_filtering();
                        nextpick = RS_ROLE;
                    } else if (choice == ROLE_RANDOM) {
                        k = pick_role(RACE(), GEND(), ALGN(), PICK_RANDOM);
                        if (k < 0)
                            k = randrole(FALSE);
                    } else {
                        k = choice - 1;
                    }
                }
                flags.initrole = k;
            } /* needed role */
        }     /* picking role */

        if (nextpick == RS_RACE) {
            nextpick = (ROLE() < 0) ? RS_ROLE : RS_GENDER;
            /* Select a race, if necessary;
               force compatibility with role, try for compatibility
               with pre-selected gender/alignment. */
            if (RACE() < 0 || !validrace(ROLE(), RACE())) {
                /* no race yet, or pre-selected race not valid */
                if (pick4u == ord('y') || pick4u == ord('a') || RACE() == ROLE_RANDOM) {
                    k = pick_race(ROLE(), GEND(), ALGN(), PICK_RANDOM);
                    if (k < 0) {
                        pline(_("Incompatible race!"));
                        k = randrace(ROLE());
                    }
                } else { /* pick4u == 'n' */
                    /* Count the number of valid races */
                    n = 0; /* number valid */
                    k = 0; /* valid race */
                    for (i = 0; races[i].noun; i++)
                        if (ok_race(ROLE(), i, GEND(), ALGN())) {
                            n++;
                            k = i;
                        }
                    if (n == 0) {
                        for (i = 0; races[i].noun; i++)
                            if (validrace(ROLE(), i)) {
                                n++;
                                k = i;
                            }
                    }
                    /* Permit the user to pick, if there is more than one */
                    if (n > 1) {
                        win = plsel_startmenu(screenheight, RS_RACE);
                        struct_assign(any, cg.zeroany); /* zero out all bits */
                        /* populate the menu with role choices */
                        setup_racemenu(win, TRUE, ROLE(), GEND(), ALGN());
                        /* add miscellaneous menu entries */
                        role_menu_extra(ROLE_RANDOM, win, TRUE);
                        any.a_int = 0; /* separator, not a choice */
                        add_menu_str(win, _(""));
                        role_menu_extra(RS_ROLE, win, FALSE);
                        role_menu_extra(RS_GENDER, win, FALSE);
                        role_menu_extra(RS_ALGNMNT, win, FALSE);
                        role_menu_extra(RS_filter, win, FALSE);
                        role_menu_extra(ROLE_NONE, win, FALSE); /* quit */
                        strcpy(pbuf, _("Pick a race or species"));
                        end_menu()(win, pbuf);
                        n = select_menu(win, PICK_ONE, selected);
                        if (n > 0) {
                            choice = ptr_add(selected[0], 0).item.a_int;
                            if (n > 1 && choice == ROLE_RANDOM)
                                choice = ptr_add(selected[0], 1).item.a_int;
                        } else
                            choice = (n == 0) ? ROLE_RANDOM : ROLE_NONE;
                        if (selected[0])
                            free(addr_of(selected[0])), selected[0] = null;
                        destroy_nhwindow()(win), win = WIN_ERR;

                        if (choice == ROLE_NONE) {
                            break setup_done; /* selected quit */
                        } else if (choice == RS_menu_arg(RS_ALGNMNT)) {
                            flags.initalign = k = ROLE_NONE;
                            nextpick = RS_ALGNMNT;
                        } else if (choice == RS_menu_arg(RS_GENDER)) {
                            flags.initgend = k = ROLE_NONE;
                            nextpick = RS_GENDER;
                        } else if (choice == RS_menu_arg(RS_ROLE)) {
                            flags.initrole = k = ROLE_NONE;
                            nextpick = RS_ROLE;
                        } else if (choice == RS_menu_arg(RS_filter)) {
                            flags.initrace = k = ROLE_NONE;
                            if (reset_role_filtering())
                                nextpick = RS_ROLE;
                            else
                                nextpick = RS_RACE;
                        } else if (choice == ROLE_RANDOM) {
                            k = pick_race(ROLE(), GEND(), ALGN(), PICK_RANDOM);
                            if (k < 0)
                                k = randrace(ROLE());
                        } else {
                            k = choice - 1;
                        }
                    }
                }
                flags.initrace = k;
            } /* needed race */
        }     /* picking race */

        if (nextpick == RS_GENDER) {
            nextpick = (ROLE() < 0) ? RS_ROLE : (RACE() < 0) ? RS_RACE
                       : RS_ALGNMNT;
            /* Select a gender, if necessary;
               force compatibility with role/race, try for compatibility
               with pre-selected alignment. */
            if (GEND() < 0 || !validgend(ROLE(), RACE(), GEND())) {
                /* no gender yet, or pre-selected gender not valid */
                if (pick4u == ord('y') || pick4u == ord('a') || GEND() == ROLE_RANDOM) {
                    k = pick_gend(ROLE(), RACE(), ALGN(), PICK_RANDOM);
                    if (k < 0) {
                        pline(_("Incompatible gender!"));
                        k = randgend(ROLE(), RACE());
                    }
                } else { /* pick4u == 'n' */
                    /* Count the number of valid genders */
                    n = 0; /* number valid */
                    k = 0; /* valid gender */
                    for (i = 0; i < ROLE_GENDERS; i++)
                        if (ok_gend(ROLE(), RACE(), i, ALGN())) {
                            n++;
                            k = i;
                        }
                    if (n == 0) {
                        for (i = 0; i < ROLE_GENDERS; i++)
                            if (validgend(ROLE(), RACE(), i)) {
                                n++;
                                k = i;
                            }
                    }
                    /* Permit the user to pick, if there is more than one */
                    if (n > 1) {
                        win = plsel_startmenu(screenheight, RS_GENDER);
                        struct_assign(any, cg.zeroany); /* zero out all bits */
                        /* populate the menu with gender choices */
                        setup_gendmenu(win, TRUE, ROLE(), RACE(), ALGN());
                        /* add miscellaneous menu entries */
                        role_menu_extra(ROLE_RANDOM, win, TRUE);
                        any.a_int = 0; /* separator, not a choice */
                        add_menu_str(win, _(""));
                        role_menu_extra(RS_ROLE, win, FALSE);
                        role_menu_extra(RS_RACE, win, FALSE);
                        role_menu_extra(RS_ALGNMNT, win, FALSE);
                        role_menu_extra(RS_filter, win, FALSE);
                        role_menu_extra(ROLE_NONE, win, FALSE); /* quit */
                        strcpy(pbuf, _("Pick a gender or sex"));
                        end_menu()(win, pbuf);
                        n = select_menu(win, PICK_ONE, selected);
                        if (n > 0) {
                            choice = ptr_add(selected[0], 0).item.a_int;
                            if (n > 1 && choice == ROLE_RANDOM)
                                choice = ptr_add(selected[0], 1).item.a_int;
                        } else
                            choice = (n == 0) ? ROLE_RANDOM : ROLE_NONE;
                        if (selected[0])
                            free(addr_of(selected[0])), selected[0] = null;
                        destroy_nhwindow()(win), win = WIN_ERR;

                        if (choice == ROLE_NONE) {
                            break setup_done; /* selected quit */
                        } else if (choice == RS_menu_arg(RS_ALGNMNT)) {
                            flags.initalign = k = ROLE_NONE;
                            nextpick = RS_ALGNMNT;
                        } else if (choice == RS_menu_arg(RS_RACE)) {
                            flags.initrace = k = ROLE_NONE;
                            nextpick = RS_RACE;
                        } else if (choice == RS_menu_arg(RS_ROLE)) {
                            flags.initrole = k = ROLE_NONE;
                            nextpick = RS_ROLE;
                        } else if (choice == RS_menu_arg(RS_filter)) {
                            flags.initgend = k = ROLE_NONE;
                            if (reset_role_filtering())
                                nextpick = RS_ROLE;
                            else
                                nextpick = RS_GENDER;
                        } else if (choice == ROLE_RANDOM) {
                            k = pick_gend(ROLE(), RACE(), ALGN(), PICK_RANDOM);
                            if (k < 0)
                                k = randgend(ROLE(), RACE());
                        } else {
                            k = choice - 1;
                        }
                    }
                }
                flags.initgend = k;
            } /* needed gender */
        }     /* picking gender */

        if (nextpick == RS_ALGNMNT) {
            nextpick = (ROLE() < 0) ? RS_ROLE
                       : (RACE() < 0) ? RS_RACE
                         : RS_GENDER;
            /* Select an alignment, if necessary;
               force compatibility with role/race/gender. */
            if (ALGN() < 0 || !validalign(ROLE(), RACE(), ALGN())) {
                /* no alignment yet, or pre-selected alignment not valid */
                if (pick4u == ord('y') || pick4u == ord('a') || ALGN() == ROLE_RANDOM) {
                    k = pick_align(ROLE(), RACE(), GEND(), PICK_RANDOM);
                    if (k < 0) {
                        pline(_("Incompatible alignment!"));
                        k = randalign(ROLE(), RACE());
                    }
                } else { /* pick4u == 'n' */
                    /* Count the number of valid alignments */
                    n = 0; /* number valid */
                    k = 0; /* valid alignment */
                    for (i = 0; i < ROLE_ALIGNS; i++)
                        if (ok_align(ROLE(), RACE(), GEND(), i)) {
                            n++;
                            k = i;
                        }
                    if (n == 0) {
                        for (i = 0; i < ROLE_ALIGNS; i++)
                            if (validalign(ROLE(), RACE(), i)) {
                                n++;
                                k = i;
                            }
                    }
                    /* Permit the user to pick, if there is more than one */
                    if (n > 1) {
                        win = plsel_startmenu(screenheight, RS_ALGNMNT);
                        struct_assign(any, cg.zeroany); /* zero out all bits */
                        setup_algnmenu(win, TRUE, ROLE(), RACE(), GEND());
                        role_menu_extra(ROLE_RANDOM, win, TRUE);
                        any.a_int = 0; /* separator, not a choice */
                        add_menu_str(win, _(""));
                        role_menu_extra(RS_ROLE, win, FALSE);
                        role_menu_extra(RS_RACE, win, FALSE);
                        role_menu_extra(RS_GENDER, win, FALSE);
                        role_menu_extra(RS_filter, win, FALSE);
                        role_menu_extra(ROLE_NONE, win, FALSE); /* quit */
                        strcpy(pbuf, _("Pick an alignment or creed"));
                        end_menu()(win, pbuf);
                        n = select_menu(win, PICK_ONE, selected);
                        if (n > 0) {
                            choice = ptr_add(selected[0], 0).item.a_int;
                            if (n > 1 && choice == ROLE_RANDOM)
                                choice = ptr_add(selected[0], 1).item.a_int;
                        } else
                            choice = (n == 0) ? ROLE_RANDOM : ROLE_NONE;
                        if (selected[0])
                            free(addr_of(selected[0])), selected[0] = null;
                        destroy_nhwindow()(win), win = WIN_ERR;

                        if (choice == ROLE_NONE) {
                            break setup_done; /* selected quit */
                        } else if (choice == RS_menu_arg(RS_GENDER)) {
                            flags.initgend = k = ROLE_NONE;
                            nextpick = RS_GENDER;
                        } else if (choice == RS_menu_arg(RS_RACE)) {
                            flags.initrace = k = ROLE_NONE;
                            nextpick = RS_RACE;
                        } else if (choice == RS_menu_arg(RS_ROLE)) {
                            flags.initrole = k = ROLE_NONE;
                            nextpick = RS_ROLE;
                        } else if (choice == RS_menu_arg(RS_filter)) {
                            flags.initalign = k = ROLE_NONE;
                            if (reset_role_filtering())
                                nextpick = RS_ROLE;
                            else
                                nextpick = RS_ALGNMNT;
                        } else if (choice == ROLE_RANDOM) {
                            k = pick_align(ROLE(), RACE(), GEND(), PICK_RANDOM);
                            if (k < 0)
                                k = randalign(ROLE(), RACE());
                        } else {
                            k = choice - 1;
                        }
                    }
                }
                flags.initalign = k;
            } /* needed alignment */
        }     /* picking alignment */
    } while (ROLE() < 0 || RACE() < 0 || GEND() < 0 || ALGN() < 0);

    /*
     *  Role, race, &c have now been determined;
     *  ask for confirmation and maybe go back to choose all over again.
     *
     *  Uses ynaq for familiarity, although 'a' is usually a
     *  superset of 'y' but here is an alternate form of 'n'.
     *  Menu layout:
     *   title:  Is this ok? [ynaq]
     *   blank:
     *    text:  $name, $alignment $gender $race $role
     *   blank:
     *    menu:  y + yes; play
     *           n - no; pick again
     *   maybe:  a - no; rename hero
     *           q - quit
     *           (end)
     */
    getconfirmation = (picksomething && pick4u != ord('a') && !flags.randomall ? 1 : 0);
    while (getconfirmation) {
        win = plsel_startmenu(screenheight, RS_filter); /* filter: not ROLE */
        struct_assign(any, cg.zeroany); /* zero out all bits */
        /* [ynaq] menu choices */
        any.a_int = 1;
        add_menu(win, nul_glyphinfo, any, ord('y'), 0,
                 ATR_NONE, clr, _("Yes; start game"), MENU_ITEMFLAGS_SELECTED);
        any.a_int = 2;
        add_menu(win, nul_glyphinfo, any, ord('n'), 0,
                 ATR_NONE, clr, _("No; choose role again"), MENU_ITEMFLAGS_NONE);
        if (iflags.renameallowed) {
            any.a_int = 3;
            add_menu(win, nul_glyphinfo, any, ord('a'), 0, ATR_NONE,
                     clr, _("Not yet; choose another name"),
                     MENU_ITEMFLAGS_NONE);
        }
        any.a_int = -1;
        add_menu(win, nul_glyphinfo, any, ord('q'), 0,
                 ATR_NONE, clr, _("Quit"), MENU_ITEMFLAGS_NONE);
        sprintf(pbuf, _("Is this ok? [yn%sq]"), iflags.renameallowed ? _("a") : _(""));
        end_menu()(win, pbuf);
        n = select_menu(win, PICK_ONE, selected);
        /* [pick-one menus with a preselected entry behave oddly...] */
        choice = (n > 0) ? ptr_add(selected[0], n - 1).item.a_int : (n == 0) ? 1 : -1;
        if (selected[0])
            free(addr_of(selected[0])), selected[0] = null;
        destroy_nhwindow()(win);

        switch (choice) {
        default: /* 'q' or ESC */
            break setup_done;; /* quit */
            break;
        case 3: { /* 'a' */
            /*
             * TODO: what, if anything, should be done if the name is
             * changed to or from "wizard" after port-specific startup
             * code has set flags.debug based on the original name?
             */
            var saveROLE, saveRACE, saveGEND, saveALGN;

            iflags.renameinprogress = TRUE; /* affects main() in unixmain.c */
            /* plnamesuffix() can change any or all of ROLE, RACE,
               GEND, ALGN; we'll override that and honor only the name */
            saveROLE = ROLE(), saveRACE = RACE(),
            saveGEND = GEND(), saveALGN = ALGN();
            chars[svp.plname + 0] = ord('\0');
            plnamesuffix(); /* calls askname() when svp.plname[] is empty */
            flags.initrole = saveROLE, flags.initrace = saveRACE,
            flags.initgend = saveGEND, flags.initalign = saveALGN;
            break; /* getconfirmation is still True */
        }
        case 2: /* 'n' */
            /* start fresh, but bypass "shall I pick everything for you?"
               step; any partial role selection via config file, command
               line, or name suffix is discarded this time */
            pick4u = ord('n');
            flags.initrole = flags.initrace = flags.initgend = flags.initalign = ROLE_NONE;
            continue makepicks;
            break;
        case 1: /* 'y' or Space or Return/Enter */
            /* success; drop out through end of function */
            getconfirmation = FALSE;
            break;
        }
    } break; } /* while 'getconfirmation' */
    /* Success! */
    result = 1;
 }
    program_state.in_role_selection--;
    return result;
    } finally { stack_pop($frame); }
}

function reset_role_filtering() { /* boolean */
    const $frame = stack_frame(); try {
    let win;
    let i, n;
    let filterprompt = stack_array(char, QBUFSZ);
    let selected = stack_var(ptr_to(struct_mi), null);

    win = create_nhwindow()(NHW_MENU);
    start_menu()(win, MENU_BEHAVE_STANDARD);

    /* no extra blank line preceding this entry; end_menu supplies one */
    add_menu_str(win, _("Unacceptable roles"));
    setup_rolemenu(win, FALSE, ROLE_NONE, ROLE_NONE, ROLE_NONE);

    add_menu_str(win, _(""));
    add_menu_str(win, _("Unacceptable races"));
    setup_racemenu(win, FALSE, ROLE_NONE, ROLE_NONE, ROLE_NONE);

    add_menu_str(win, _(""));
    add_menu_str(win, _("Unacceptable genders"));
    setup_gendmenu(win, FALSE, ROLE_NONE, ROLE_NONE, ROLE_NONE);

    add_menu_str(win, _(""));
    add_menu_str(win, _("Unacceptable alignments"));
    setup_algnmenu(win, FALSE, ROLE_NONE, ROLE_NONE, ROLE_NONE);

    sprintf(filterprompt, _("Pick all that apply%s"), gotrolefilter() ? _(" and/or unpick any that no longer apply") : _(""))
;
    end_menu()(win, filterprompt);
    n = select_menu(win, PICK_ANY, selected);

    if (n >= 0) { /* n==0: clear current filters and don't set new ones */
        clearrolefilter(RS_filter);
        for (i = 0; i < n; i++)
            setrolefilter(ptr_add(selected[0], i).item.a_string);

        flags.initrole = flags.initrace = flags.initgend = flags.initalign = ROLE_NONE;
    }
    if (selected[0])
        free(addr_of(selected[0])), selected[0] = null;
    destroy_nhwindow()(win);
    return (n > 0) ? TRUE : FALSE;
    } finally { stack_pop($frame); }
}

/* the change in format when this extended role selection was converted from
   tty-only to tty+curses+? made the role selection menu require two pages
   on a traditional 24-line tty; that wasn't fair to tty, so squeeze out
   some blank separator lines from the menu if that will make it fit on one */
function maybe_skip_seps(rows, aspect) { /* int */
    let i, n = 0;

    /* not much point to generalizing this to other aspects */
    if (aspect != RS_ROLE)
        return 0;
    /*
     * If there are one or two excess lines, setup_rolemenu() will omit
     * the separator between 'random' and 'pick race first'.  If there are
     * two, plsel_startmenu() will omit the one between role info so far
     * ("<role> <race> ...") and the set of role entries.
     */

    n += 4; /* title and ensuing separator, role info so far and separator */
    for (i = 0; roles[i].name.m; ++i)
        if (ok_role(i, RACE(), GEND(), ALGN()) && ok_race(i, RACE(), GEND(), ALGN())
            && ok_gend(i, RACE(), GEND(), ALGN()) && ok_align(i, RACE(), GEND(), ALGN()))
            ++n;
    n += 2; /* 'random' and separator */
    n += 5; /* race 1st, gender 1st, alignment 1st, reset filter, quit */
    n += 1; /* footer/prompt */
    if (rows > 0 && n > rows)
        return n - rows;
    return 0;
}

/* start a menu; show role aspects specified so far as a header line */
function plsel_startmenu(ttyrows, aspect) { /* winid */
    const $frame = stack_frame(); try {
    let qbuf = stack_array(char, QBUFSZ);
    let win;
    let rolename;

    /* whatever aspect was just chosen might force others (Orc => chaotic,
       Samurai => Human+lawful, Valkyrie => female) */
    rigid_role_checks();

    rolename = (ROLE() < 0) ? _("<role>")
               : (GEND() == 1 && roles[ROLE()].name.f) ? roles[ROLE()].name.f
                 : roles[ROLE()].name.m;
    if (!chars[svp.plname + 0] || ROLE() < 0 || RACE() < 0 || GEND() < 0 || ALGN() < 0) {
        /* "<role> <race.noun> <gender> <alignment>" */
        sprintf(qbuf, _("%.20s %.20s %.20s %.20s"), rolename, (RACE() < 0) ? _("<race>") : races[RACE()].noun, (GEND() < 0) ? _("<gender>") : genders[GEND()].adj, (ALGN() < 0) ? _("<alignment>") : aligns[ALGN()].adj)

;
    } else {
        /* "<name> the <alignment> <gender> <race.adjective> <role>" */
        sprintf(qbuf, _("%.20s the %.20s %.20s %.20s %.20s"), svp.plname, aligns[ALGN()].adj, genders[GEND()].adj, races[RACE()].adj, rolename)

;
    }

    win = create_nhwindow()(NHW_MENU);
    if (win == WIN_ERR)
        panic(_("could not create role selection window"));
    start_menu()(win, MENU_BEHAVE_STANDARD);

    add_menu_str(win, qbuf);
    if (maybe_skip_seps(ttyrows, aspect) != 2)
        add_menu_str(win, _(""));
    return win;
    } finally { stack_pop($frame); }
}

/* add entries a-Archeologist, b-Barbarian, &c to menu being built in 'win' */
function setup_rolemenu(
    win,
    filtering,

    race, gend, algn) { /* void */ /* all ROLE_NONE for !filtering case */
    const $frame = stack_frame(); try {
    let any = stack_struct(struct_any);
    let i;
    let role_ok;
    let thisch, lastch = ord('\0'), rolenamebuf = stack_array(char, 50);
    let clr = NO_COLOR;

    struct_assign(any, cg.zeroany); /* zero out all bits */
    for (i = 0; roles[i].name.m; i++) {
        /* role can be constrained by any of race, gender, or alignment */
        role_ok = (ok_role(i, race, gend, algn)
                   && ok_race(i, race, gend, algn)
                   && ok_gend(i, race, gend, algn)
                   && ok_align(i, race, gend, algn) ? 1 : 0);
        if (filtering && !role_ok)
            continue;
        if (filtering)
            any.a_int = i + 1;
        else
            any.a_string = roles[i].name.m;
        thisch = lowc(chars[roles[i].name.m]);
        if (thisch == lastch)
            thisch = highc(thisch);
        strcpy(rolenamebuf, roles[i].name.m);
        if (roles[i].name.f) {
            /* role has distinct name for female (C,P) */
            if (gend == 1) {
                /* female already chosen; replace male name */
                strcpy(rolenamebuf, roles[i].name.f);
            } else if (gend < 0) {
                /* not chosen yet; append slash+female name */
                strcat(rolenamebuf, _("/"));
                strcat(rolenamebuf, roles[i].name.f);
            }
        }
        /* !filtering implies reset_role_filtering() where we want to
           mark this role as preselected if current filter excludes it */
        add_menu(win, nul_glyphinfo, any, thisch, 0,
                 ATR_NONE, clr, an(rolenamebuf),
                 (!filtering && !role_ok)
                    ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);
        lastch = thisch;
    }
    } finally { stack_pop($frame); }
}

function setup_racemenu(
    win,
    filtering,
    role, gend, algn) { /* void */
    const $frame = stack_frame(); try {
    let any = stack_struct(struct_any);
    let race_ok;
    let i;
    let this_ch;
    let clr = NO_COLOR;

    struct_assign(any, cg.zeroany);
    for (i = 0; races[i].noun; i++) {
        /* no ok_gend(); race isn't constrained by gender */
        race_ok = (ok_race(role, i, gend, algn)
                   && ok_role(role, i, gend, algn)
                   && ok_align(role, i, gend, algn) ? 1 : 0);
        if (filtering && !race_ok)
            continue;
        if (filtering)
            any.a_int = i + 1;
        else
            any.a_string = races[i].noun;
        this_ch = chars[races[i].noun];
        /* filtering: picking race, so choose by first letter, with
           capital letter as unseen accelerator;
           !filtering: resetting filter rather than picking, choose by
           capital letter since lowercase role letters will be present */
        add_menu(win, nul_glyphinfo, any,
                 filtering ? this_ch : highc(this_ch),
                 filtering ? highc(this_ch) : 0,
                 ATR_NONE, clr, races[i].noun,
                 (!filtering && !race_ok)
                    ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);
    }
    } finally { stack_pop($frame); }
}

function setup_gendmenu(
    win,
    filtering,
    role, race, algn) { /* void */
    const $frame = stack_frame(); try {
    let any = stack_struct(struct_any);
    let gend_ok;
    let i;
    let this_ch;
    let clr = NO_COLOR;

    struct_assign(any, cg.zeroany);
    for (i = 0; i < ROLE_GENDERS; i++) {
        /* no ok_align(); gender isn't constrained by alignment */
        gend_ok = (ok_gend(role, race, i, algn)
                   && ok_role(role, race, i, algn)
                   && ok_race(role, race, i, algn) ? 1 : 0);
        if (filtering && !gend_ok)
            continue;
        if (filtering)
            any.a_int = i + 1;
        else
            any.a_string = genders[i].adj;
        this_ch = chars[genders[i].adj];
        /* (see setup_racemenu for explanation of selector letters
           and setup_rolemenu for preselection) */
        add_menu(win, nul_glyphinfo, any,
                 filtering ? this_ch : highc(this_ch),
                 filtering ? highc(this_ch) : 0,
                 ATR_NONE, clr, genders[i].adj,
                 (!filtering && !gend_ok)
                    ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);
    }
    } finally { stack_pop($frame); }
}

function setup_algnmenu(
    win,
    filtering,
    role, race, gend) { /* void */
    const $frame = stack_frame(); try {
    let any = stack_struct(struct_any);
    let algn_ok;
    let i;
    let this_ch;
    let clr = NO_COLOR;

    struct_assign(any, cg.zeroany);
    for (i = 0; i < ROLE_ALIGNS; i++) {
        /* no ok_gend(); alignment isn't constrained by gender */
        algn_ok = (ok_align(role, race, gend, i)
                   && ok_role(role, race, gend, i)
                   && ok_race(role, race, gend, i) ? 1 : 0);
        if (filtering && !algn_ok)
            continue;
        if (filtering)
            any.a_int = i + 1;
        else
            any.a_string = aligns[i].adj;
        this_ch = chars[aligns[i].adj];
        /* (see setup_racemenu for explanation of selector letters
           and setup_rolemenu for preselection) */
        add_menu(win, nul_glyphinfo, any,
                 filtering ? this_ch : highc(this_ch),
                 filtering ? highc(this_ch) : 0,
                 ATR_NONE, clr, aligns[i].adj,
                 (!filtering && !algn_ok)
                    ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);
    }
    } finally { stack_pop($frame); }
}

/* role.c */

import {
    AM_CHAOTIC, AM_LAWFUL, AM_MASK, AM_NEUTRAL, A_CHAOTIC, A_LAWFUL, A_NEUTRAL, A_NONE,
} from "./align.h.js";
import {
    ART_EYES_OF_THE_OVERWORLD, ART_EYE_OF_THE_AETHIOPICA, ART_HEART_OF_AHRIMAN,
    ART_LONGBOW_OF_DIANA, ART_MAGIC_MIRROR_OF_MERLIN, ART_MASTER_KEY_OF_THIEVERY,
    ART_MITRE_OF_HOLINESS, ART_ORB_OF_DETECTION, ART_ORB_OF_FATE, ART_SCEPTRE_OF_MIGHT,
    ART_STAFF_OF_AESCULAPIUS, ART_TSURUGI_OF_MURAMASA, ART_YENDORIAN_EXPRESS_CARD,
} from "./artilist.h.js";
import { A_INT, A_WIS } from "./attrib.h.js";
import { STR18 } from "./attrib.h.macros.js";
import { NO_COLOR } from "./color.h.js";
import {
    S_ANT, S_BAT, S_CENTAUR, S_DOG, S_ELEMENTAL, S_GIANT, S_HUMANOID, S_IMP, S_JELLY, S_MUMMY,
    S_NAGA, S_NYMPH, S_OGRE, S_RODENT, S_SNAKE, S_SPIDER, S_TROLL, S_WRAITH, S_XORN, S_YETI,
    S_ZOMBIE,
} from "./defsym.h.js";
import { BUFSZ, FALSE, PL_CSIZ, QBUFSZ, TRUE } from "./global.h.js";
import { Strlen, strcmpi } from "./global.h.macros.js";
import {
    BP_ALIGN, BP_GEND, BP_RACE, BP_ROLE, NUM_BP, NUM_RACES, NUM_ROLES, PICK_RANDOM, PICK_RIGID,
} from "./hack.h.js";
import { IndexOkT } from "./hack.h.macros.js";
import { is_female, is_male, is_neuter } from "./mondata.h.macros.js";
import {
    M2_HOSTILE, M2_NASTY, M2_PEACEFUL, M2_STALK, M3_CLOSE, M3_WAITFORU, M3_WANTSARTI, MH_DWARF,
    MH_ELF, MH_GNOME, MH_HUMAN, MH_ORC, MS_LEADER, MS_NEMESIS,
} from "./monflag.h.js";
import {
    NON_PM, PM_ABBOT, PM_ACOLYTE, PM_APPRENTICE, PM_ARCHEOLOGIST, PM_ARCH_PRIEST,
    PM_ASHIKAGA_TAKAUJI, PM_ATTENDANT, PM_BARBARIAN, PM_BUGBEAR, PM_CAVE_DWELLER, PM_CHIEFTAIN,
    PM_CHROMATIC_DRAGON, PM_CLERIC, PM_CYCLOPS, PM_DARK_ONE, PM_DWARF, PM_DWARF_MUMMY,
    PM_DWARF_ZOMBIE, PM_EARTH_ELEMENTAL, PM_ELF, PM_ELF_MUMMY, PM_ELF_ZOMBIE, PM_FIRE_ANT,
    PM_FIRE_GIANT, PM_FOREST_CENTAUR, PM_GIANT_RAT, PM_GIANT_SPIDER, PM_GNOME, PM_GNOME_MUMMY,
    PM_GNOME_ZOMBIE, PM_GRAND_MASTER, PM_GUARDIAN_NAGA, PM_GUIDE, PM_HEALER, PM_HILL_GIANT,
    PM_HIPPOCRATES, PM_HUMAN, PM_HUMAN_MUMMY, PM_HUMAN_ZOMBIE, PM_HUNTER, PM_IXOTH, PM_KING_ARTHUR,
    PM_KITTEN, PM_KNIGHT, PM_LEPRECHAUN, PM_LITTLE_DOG, PM_LORD_CARNARVON, PM_LORD_SATO,
    PM_LORD_SURTUR, PM_MAIL_DAEMON, PM_MASTER_ASSASSIN, PM_MASTER_KAEN, PM_MASTER_OF_THIEVES,
    PM_MINION_OF_HUHETOTL, PM_MONK, PM_NALZOK, PM_NEANDERTHAL, PM_NEFERET_THE_GREEN, PM_NORN,
    PM_OCHRE_JELLY, PM_OGRE, PM_ORC, PM_ORC_MUMMY, PM_ORC_ZOMBIE, PM_ORION, PM_PAGE, PM_PELIAS,
    PM_PONY, PM_QUASIT, PM_RANGER, PM_ROGUE, PM_ROSHI, PM_SAMURAI, PM_SCORPION, PM_SCORPIUS,
    PM_SHAMAN_KARNOV, PM_SHOPKEEPER, PM_SNAKE, PM_STALKER, PM_STUDENT, PM_THOTH_AMON, PM_THUG,
    PM_TOURIST, PM_TROLL, PM_TWOFLOWER, PM_VALKYRIE, PM_VAMPIRE_BAT, PM_WARRIOR, PM_WIZARD, PM_WOLF,
    PM_WRAITH, PM_XORN,
} from "./monsters.h.js";
import {
    SPE_CHARM_MONSTER, SPE_CLAIRVOYANCE, SPE_CONE_OF_COLD, SPE_CURE_SICKNESS, SPE_DETECT_TREASURE,
    SPE_DIG, SPE_HASTE_SELF, SPE_INVISIBILITY, SPE_LIGHT, SPE_MAGIC_MAPPING, SPE_MAGIC_MISSILE,
    SPE_REMOVE_CURSE, SPE_RESTORE_ABILITY, SPE_TURN_UNDEAD, STRANGE_OBJECT,
} from "./objects.h.js";
import { P_CLERIC_SPELL } from "./skills.h.js";
import { RS_ALGNMNT, RS_GENDER, RS_NAME, RS_RACE, RS_ROLE, RS_filter } from "./winprocs.h.js";
import {
    RS_menu_arg, askname, create_nhwindow, destroy_nhwindow, end_menu, putstr, start_menu,
} from "./winprocs.h.macros.js";
import {
    ATR_NONE, MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, MENU_ITEMFLAGS_SELECTED, NHW_MENU,
    PICK_ANY, PICK_ONE, WIN_ERR, struct_any, struct_mi,
} from "./wintype.h.js";
import {
    ROLE_ALIGNS, ROLE_FEMALE, ROLE_GENDERS, ROLE_GENDMASK, ROLE_MALE, ROLE_NEUTER, ROLE_NONE,
    ROLE_RACEMASK, ROLE_RANDOM, struct_Align, struct_Gender, struct_Race, struct_Role,
} from "./you.h.js";
import { Role_if, Role_switch } from "./you.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, sizeof_string, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64u, or64u } from "../rt/int64.js";
import { EXIT_SUCCESS, assert, free, sprintf, strcat, strchr, strcpy, strlen } from "../rt/libc.js";
import { init_string, stack_array, stack_struct, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, ptr_add, ptr_to, struct_assign } from "../rt/struct.js";
import { yn_function } from "./cmd.js";
import { cg, flags, gp, gr, gu, iflags, program_state, svp, svq } from "./decl.js";
import { nul_glyphinfo } from "./display.js";
import { nh_terminate, panic } from "./end.js";
import {
    eos, findword, highc, lowc, s_suffix, strNsubst, strkitten, strncmpi, strstri, strsubst,
    trimspaces,
} from "./hacklib.js";
import { mons } from "./monst.js";
import { objects } from "./objects.js";
import { an } from "./objnam.js";
import { impossible, pline } from "./pline.js";
import { align_gtitle } from "./pray.js";
import { rn2, rn2_on_display_rng } from "./rnd.js";
import { sysopt } from "./sys.js";
import { add_menu, add_menu_str, select_menu } from "./windows.js";
