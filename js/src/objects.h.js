/*
 * Note...
 *  OBJECTS() currently has 15 parameters; it more become needed, some
 *  will need to be combined the way BITS() is used, because compilers
 *  are allowed to impose a limit of 15.
 */

/* notes: 'sub' was once a bitfield but got changed to separate schar when
   it was overloaded to hold negative weapon skill indices; the first zero
   is padding for oc_prediscovered which has variable init at run-time;
   the second zero is oc_spare1 for padding between oc_tough and oc_dir */

/* note: 0UL-1UL is a method of expressing the largest possible
   unsigned long value whilst working around a false-positive warning
   in Microsoft Visual C (which assumes that a negative number was
   intended despite the explicit U suffix) */

/* dummy object[0] -- description [2nd arg] *must* be NULL */
export const STRANGE_OBJECT = 0;

/* slots [1] through [MAXOCLASSES-1] are indexed by class; some are
   used for display purposes, most aren't used; none are actual objects;
   note that 'real' strange object is in slot [0] but ILLOBJ_CLASS is 1
   so we add a dummy for it in slot [1] to simplify accessing the rest;
   there isn't any entry for RANDOM_CLASS (0) */
export const GENERIC_ILLOBJ = STRANGE_OBJECT + 1; /* [1] */
export const GENERIC_WEAPON = GENERIC_ILLOBJ + 1; /* [2] */
export const GENERIC_ARMOR = GENERIC_WEAPON + 1; /* [3] */
export const GENERIC_RING = GENERIC_ARMOR + 1; /* [4] */
export const GENERIC_AMULET = GENERIC_RING + 1; /* [5] */
export const GENERIC_TOOL = GENERIC_AMULET + 1; /* [6] */
export const GENERIC_FOOD = GENERIC_TOOL + 1; /* [7] */
export const GENERIC_POTION = GENERIC_FOOD + 1; /* [8] */
export const GENERIC_SCROLL = GENERIC_POTION + 1; /* [9] */
export const GENERIC_SPBOOK = GENERIC_SCROLL + 1; /* [10] */
export const GENERIC_WAND = GENERIC_SPBOOK + 1; /* [11] */
export const GENERIC_COIN = GENERIC_WAND + 1; /* [12] */
export const GENERIC_GEM = GENERIC_COIN + 1; /* [13] */
export const GENERIC_ROCK = GENERIC_GEM + 1; /* [14] bldr+statue */
export const GENERIC_BALL = GENERIC_ROCK + 1; /* [15] */
export const GENERIC_CHAIN = GENERIC_BALL + 1; /* [16] */
export const GENERIC_VENOM = GENERIC_CHAIN + 1; /* [17] */

/* FIRST_OBJECT: it would be simpler just to use MARKER(FIRST_OBJECT,ARROW)
   below but that is vulnerable to neglecting to update the marker enum
   after inserting something in front of arrow */
export const LAST_GENERIC = GENERIC_VENOM;
export const FIRST_OBJECT = LAST_GENERIC + 1;
/* this definition of FIRST_OBJECT advances the default value for next enum;
   backtrack to fix that, otherwise ARROW and the rest would be off by 1 */
export const OBJCLASS_HACK = FIRST_OBJECT - 1;

/* weapons ... */

/* Note: for weapons that don't do an even die of damage (ex. 2-7 or 3-18)
   the extra damage is added on in weapon.c, not here! */

/* weapon strike mode overloads the oc_dir field */

/* missiles; materiel reflects the arrowhead, not the shaft */
export const ARROW = OBJCLASS_HACK + 1;

export const ELVEN_ARROW = ARROW + 1;

export const ORCISH_ARROW = ELVEN_ARROW + 1;

export const SILVER_ARROW = ORCISH_ARROW + 1;

export const YA = SILVER_ARROW + 1;

export const CROSSBOW_BOLT = YA + 1;

/* missiles that don't use a launcher */
export const DART = CROSSBOW_BOLT + 1;

export const SHURIKEN = DART + 1;

export const BOOMERANG = SHURIKEN + 1;

/* spears [note: javelin used to have a separate skill from spears,
   because the latter are primarily stabbing weapons rather than
   throwing ones; but for playability, they've been merged together
   under spear skill and spears can now be thrown like javelins] */
export const SPEAR = BOOMERANG + 1;

export const ELVEN_SPEAR = SPEAR + 1;

export const ORCISH_SPEAR = ELVEN_SPEAR + 1;

export const DWARVISH_SPEAR = ORCISH_SPEAR + 1;

export const SILVER_SPEAR = DWARVISH_SPEAR + 1;

export const JAVELIN = SILVER_SPEAR + 1;

/* spearish; doesn't stack, not intended to be thrown */
export const TRIDENT = JAVELIN + 1;

        /* +1 small, +2d4 large */

/* blades; all stack */
export const DAGGER = TRIDENT + 1;

export const ELVEN_DAGGER = DAGGER + 1;

export const ORCISH_DAGGER = ELVEN_DAGGER + 1;

export const SILVER_DAGGER = ORCISH_DAGGER + 1;

export const ATHAME = SILVER_DAGGER + 1;

export const SCALPEL = ATHAME + 1;

export const KNIFE = SCALPEL + 1;

export const STILETTO = KNIFE + 1;

/* 3.6: worm teeth and crysknives now stack;
   when a stack of teeth is enchanted at once, they fuse into one crysknife;
   when a stack of crysknives drops, the whole stack reverts to teeth */
/* 5.0: change crysknife from MINERAL to BONE and worm tooth from 0 to BONE */
export const WORM_TOOTH = STILETTO + 1;

export const CRYSKNIFE = WORM_TOOTH + 1;

/* axes */
export const AXE = CRYSKNIFE + 1;

export const BATTLE_AXE = AXE + 1; /* "double-bitted"? */

/* swords */
export const SHORT_SWORD = BATTLE_AXE + 1;

export const ELVEN_SHORT_SWORD = SHORT_SWORD + 1;

export const ORCISH_SHORT_SWORD = ELVEN_SHORT_SWORD + 1;

export const DWARVISH_SHORT_SWORD = ORCISH_SHORT_SWORD + 1;

export const SCIMITAR = DWARVISH_SHORT_SWORD + 1;

export const SILVER_SABER = SCIMITAR + 1;

export const BROADSWORD = SILVER_SABER + 1;

        /* +d4 small, +1 large */
export const ELVEN_BROADSWORD = BROADSWORD + 1;

        /* +d4 small, +1 large */
export const LONG_SWORD = ELVEN_BROADSWORD + 1;

export const TWO_HANDED_SWORD = LONG_SWORD + 1;

        /* +2d6 large */
export const KATANA = TWO_HANDED_SWORD + 1;

/* special swords set up for artifacts */
export const TSURUGI = KATANA + 1;

        /* +2d6 large */
export const RUNESWORD = TSURUGI + 1;

        /* +d4 small, +1 large; Stormbringer: +5d2 +d8 from level drain */

/* polearms */
/* spear-type */
export const PARTISAN = RUNESWORD + 1;

        /* +1 large */
export const RANSEUR = PARTISAN + 1;

        /* +d4 both */
export const SPETUM = RANSEUR + 1;

        /* +1 small, +d6 large */
export const GLAIVE = SPETUM + 1;

/* axe-type */
export const HALBERD = GLAIVE + 1;

        /* +1d6 large */
export const BARDICHE = HALBERD + 1;

        /* +1d4 small, +2d4 large */
export const VOULGE = BARDICHE + 1;

        /* +d4 both */
/* curved/hooked */
export const FAUCHARD = VOULGE + 1;

export const GUISARME = FAUCHARD + 1;

        /* +1d4 small */
export const BILL_GUISARME = GUISARME + 1;

        /* +1d4 small */
/* other */
export const LUCERN_HAMMER = BILL_GUISARME + 1;

        /* +1d4 small */
export const BEC_DE_CORBIN = LUCERN_HAMMER + 1;

/* formerly grouped with the polearms but don't use polearms skill;
   lance isn't even two-handed */
export const DWARVISH_MATTOCK = BEC_DE_CORBIN + 1;

export const LANCE = DWARVISH_MATTOCK + 1;

        /* +2d10 when jousting with lance as primary weapon,
           +2d2 when jousting with it as secondary when dual wielding */

/* bludgeons */
export const MACE = LANCE + 1;

        /* +1 small */
export const SILVER_MACE = MACE + 1;

        /* +1 small */
export const MORNING_STAR = SILVER_MACE + 1;

        /* +d4 small, +1 large */
export const WAR_HAMMER = MORNING_STAR + 1;

        /* +1 small */
export const CLUB = WAR_HAMMER + 1;

export const RUBBER_HOSE = CLUB + 1;

export const QUARTERSTAFF = RUBBER_HOSE + 1;

/* two-piece */
export const AKLYS = QUARTERSTAFF + 1;

export const FLAIL = AKLYS + 1;

        /* +1 small, +1d4 large */

/* misc */
export const BULLWHIP = FLAIL + 1;

/* bows */
export const BOW = BULLWHIP + 1;

export const ELVEN_BOW = BOW + 1;

export const ORCISH_BOW = ELVEN_BOW + 1;

export const YUMI = ORCISH_BOW + 1;

export const SLING = YUMI + 1;

export const CROSSBOW = SLING + 1;

/* armor ... */
        /* IRON denotes ferrous metals, including steel.
         * Only IRON weapons and armor can rust.
         * Only COPPER (including brass) corrodes.
         * Some creatures are vulnerable to SILVER.
         */

/* helmets */
export const ELVEN_LEATHER_HELM = CROSSBOW + 1;

export const ORCISH_HELM = ELVEN_LEATHER_HELM + 1;

export const DWARVISH_IRON_HELM = ORCISH_HELM + 1;

export const FEDORA = DWARVISH_IRON_HELM + 1;

export const CORNUTHAUM = FEDORA + 1;

        /* name coined by devteam; confers clairvoyance for wizards,
           blocks clairvoyance if worn by role other than wizard */

export const DUNCE_CAP = CORNUTHAUM + 1;

        /* sets Int and Wis to fixed value of 6, so actually provides
           protection against death caused by Int being drained below 3 */

export const DENTED_POT = DUNCE_CAP + 1;

export const HELM_OF_BRILLIANCE = DENTED_POT + 1;

        /* used to be iron and shuffled as "etched helmet" but required
           special case for the effect of iron armor on spell casting */

/* with shuffled appearances... */
export const HELMET = HELM_OF_BRILLIANCE + 1;

export const HELM_OF_CAUTION = HELMET + 1;

export const HELM_OF_OPPOSITE_ALIGNMENT = HELM_OF_CAUTION + 1;

export const HELM_OF_TELEPATHY = HELM_OF_OPPOSITE_ALIGNMENT + 1;

/* suits of armor */
/*
 * There is code in polyself.c that assumes (1) and (2).
 * There is code in obj.h, objnam.c, mon.c, read.c that assumes (2).
 *      (1) The dragon scale mails and the dragon scales are together.
 *      (2) That the order of the dragon scale mail and dragon scales
 *          is the same as order of dragons defined in monst.c.
 */

/* 3.4.1: dragon scale mail reclassified as "magic" since magic is
   needed to create them */
export const GRAY_DRAGON_SCALE_MAIL = HELM_OF_TELEPATHY + 1;

    /* gold DSM is a light source; there's no property for that */
export const GOLD_DRAGON_SCALE_MAIL = GRAY_DRAGON_SCALE_MAIL + 1;

export const SILVER_DRAGON_SCALE_MAIL = GOLD_DRAGON_SCALE_MAIL + 1;

export const RED_DRAGON_SCALE_MAIL = SILVER_DRAGON_SCALE_MAIL + 1;

export const WHITE_DRAGON_SCALE_MAIL = RED_DRAGON_SCALE_MAIL + 1;

export const ORANGE_DRAGON_SCALE_MAIL = WHITE_DRAGON_SCALE_MAIL + 1;

export const BLACK_DRAGON_SCALE_MAIL = ORANGE_DRAGON_SCALE_MAIL + 1;

export const BLUE_DRAGON_SCALE_MAIL = BLACK_DRAGON_SCALE_MAIL + 1;

export const GREEN_DRAGON_SCALE_MAIL = BLUE_DRAGON_SCALE_MAIL + 1;

export const YELLOW_DRAGON_SCALE_MAIL = GREEN_DRAGON_SCALE_MAIL + 1;

/* For now, only dragons leave these. */
/* 3.4.1: dragon scales left classified as "non-magic"; they confer magical
   properties but are produced "naturally"; affects use as polypile fodder */
export const GRAY_DRAGON_SCALES = YELLOW_DRAGON_SCALE_MAIL + 1;

export const GOLD_DRAGON_SCALES = GRAY_DRAGON_SCALES + 1;

export const SILVER_DRAGON_SCALES = GOLD_DRAGON_SCALES + 1;

export const RED_DRAGON_SCALES = SILVER_DRAGON_SCALES + 1;

export const WHITE_DRAGON_SCALES = RED_DRAGON_SCALES + 1;

export const ORANGE_DRAGON_SCALES = WHITE_DRAGON_SCALES + 1;

export const BLACK_DRAGON_SCALES = ORANGE_DRAGON_SCALES + 1;

export const BLUE_DRAGON_SCALES = BLACK_DRAGON_SCALES + 1;

export const GREEN_DRAGON_SCALES = BLUE_DRAGON_SCALES + 1;

export const YELLOW_DRAGON_SCALES = GREEN_DRAGON_SCALES + 1;

/* other suits */
export const PLATE_MAIL = YELLOW_DRAGON_SCALES + 1;

export const CRYSTAL_PLATE_MAIL = PLATE_MAIL + 1;

export const BRONZE_PLATE_MAIL = CRYSTAL_PLATE_MAIL + 1;

export const SPLINT_MAIL = BRONZE_PLATE_MAIL + 1;

export const BANDED_MAIL = SPLINT_MAIL + 1;

export const DWARVISH_MITHRIL_COAT = BANDED_MAIL + 1;

export const ELVEN_MITHRIL_COAT = DWARVISH_MITHRIL_COAT + 1;

export const CHAIN_MAIL = ELVEN_MITHRIL_COAT + 1;

export const ORCISH_CHAIN_MAIL = CHAIN_MAIL + 1;

export const SCALE_MAIL = ORCISH_CHAIN_MAIL + 1;

export const STUDDED_LEATHER_ARMOR = SCALE_MAIL + 1;

export const RING_MAIL = STUDDED_LEATHER_ARMOR + 1;

export const ORCISH_RING_MAIL = RING_MAIL + 1;

export const LEATHER_ARMOR = ORCISH_RING_MAIL + 1;

export const LEATHER_JACKET = LEATHER_ARMOR + 1;

/* shirts */
export const HAWAIIAN_SHIRT = LEATHER_JACKET + 1;

export const T_SHIRT = HAWAIIAN_SHIRT + 1;

/* cloaks */
export const MUMMY_WRAPPING = T_SHIRT + 1;

        /* worn mummy wrapping blocks invisibility */
export const ELVEN_CLOAK = MUMMY_WRAPPING + 1;

export const ORCISH_CLOAK = ELVEN_CLOAK + 1;

export const DWARVISH_CLOAK = ORCISH_CLOAK + 1;

export const OILSKIN_CLOAK = DWARVISH_CLOAK + 1;

export const ROBE = OILSKIN_CLOAK + 1;

        /* robe was adopted from slash'em, where it's worn as a suit
           rather than as a cloak and there are several variations */
export const ALCHEMY_SMOCK = ROBE + 1;

export const LEATHER_CLOAK = ALCHEMY_SMOCK + 1;

/* with shuffled appearances... */
export const CLOAK_OF_PROTECTION = LEATHER_CLOAK + 1;

        /* cloak of protection is now the only item conferring MC 3 */
export const CLOAK_OF_INVISIBILITY = CLOAK_OF_PROTECTION + 1;

export const CLOAK_OF_MAGIC_RESISTANCE = CLOAK_OF_INVISIBILITY + 1;

        /*  'cope' is not a spelling mistake... leave it be */
export const CLOAK_OF_DISPLACEMENT = CLOAK_OF_MAGIC_RESISTANCE + 1;

/* shields */
export const SMALL_SHIELD = CLOAK_OF_DISPLACEMENT + 1;

export const SHIELD_OF_DRAIN_RESISTANCE = SMALL_SHIELD + 1;

export const SHIELD_OF_SHOCK_RESISTANCE = SHIELD_OF_DRAIN_RESISTANCE + 1;

export const ELVEN_SHIELD = SHIELD_OF_SHOCK_RESISTANCE + 1;

export const URUK_HAI_SHIELD = ELVEN_SHIELD + 1;

export const ORCISH_SHIELD = URUK_HAI_SHIELD + 1;

export const LARGE_SHIELD = ORCISH_SHIELD + 1;

export const DWARVISH_ROUNDSHIELD = LARGE_SHIELD + 1;

export const SHIELD_OF_REFLECTION = DWARVISH_ROUNDSHIELD + 1;

/* gloves */
/* These have their color but not material shuffled, so the IRON must
 * stay CLR_BROWN (== HI_LEATHER) even though it's normally either
 * HI_METAL or CLR_BLACK.  All have shuffled descriptions.
 */
export const LEATHER_GLOVES = SHIELD_OF_REFLECTION + 1;

export const GAUNTLETS_OF_FUMBLING = LEATHER_GLOVES + 1;

export const GAUNTLETS_OF_POWER = GAUNTLETS_OF_FUMBLING + 1;

export const GAUNTLETS_OF_DEXTERITY = GAUNTLETS_OF_POWER + 1;

/* boots */
export const LOW_BOOTS = GAUNTLETS_OF_DEXTERITY + 1;

export const IRON_SHOES = LOW_BOOTS + 1;

export const HIGH_BOOTS = IRON_SHOES + 1;

/* with shuffled appearances... */
export const SPEED_BOOTS = HIGH_BOOTS + 1;

export const WATER_WALKING_BOOTS = SPEED_BOOTS + 1;

export const JUMPING_BOOTS = WATER_WALKING_BOOTS + 1;

export const ELVEN_BOOTS = JUMPING_BOOTS + 1;

export const KICKING_BOOTS = ELVEN_BOOTS + 1;

        /* CLR_BROWN for same reason as gauntlets of power */
export const FUMBLE_BOOTS = KICKING_BOOTS + 1;

export const LEVITATION_BOOTS = FUMBLE_BOOTS + 1;

/* rings ... */

export const RIN_ADORNMENT = LEVITATION_BOOTS + 1;

export const RIN_GAIN_STRENGTH = RIN_ADORNMENT + 1;

export const RIN_GAIN_CONSTITUTION = RIN_GAIN_STRENGTH + 1;

export const RIN_INCREASE_ACCURACY = RIN_GAIN_CONSTITUTION + 1;

export const RIN_INCREASE_DAMAGE = RIN_INCREASE_ACCURACY + 1;

export const RIN_PROTECTION = RIN_INCREASE_DAMAGE + 1;

        /* 'PROTECTION' intrinsic enhances MC from worn armor by +1,
           regardless of ring's enchantment; wearing a second ring of
           protection (or even one ring of protection combined with
           cloak of protection) doesn't give a second MC boost */
export const RIN_REGENERATION = RIN_PROTECTION + 1;

export const RIN_SEARCHING = RIN_REGENERATION + 1;

export const RIN_STEALTH = RIN_SEARCHING + 1;

export const RIN_SUSTAIN_ABILITY = RIN_STEALTH + 1;

export const RIN_LEVITATION = RIN_SUSTAIN_ABILITY + 1;

export const RIN_HUNGER = RIN_LEVITATION + 1;

export const RIN_AGGRAVATE_MONSTER = RIN_HUNGER + 1;

export const RIN_CONFLICT = RIN_AGGRAVATE_MONSTER + 1;

export const RIN_WARNING = RIN_CONFLICT + 1;

export const RIN_POISON_RESISTANCE = RIN_WARNING + 1;

export const RIN_FIRE_RESISTANCE = RIN_POISON_RESISTANCE + 1;

export const RIN_COLD_RESISTANCE = RIN_FIRE_RESISTANCE + 1;

export const RIN_SHOCK_RESISTANCE = RIN_COLD_RESISTANCE + 1;

export const RIN_FREE_ACTION = RIN_SHOCK_RESISTANCE + 1;

export const RIN_SLOW_DIGESTION = RIN_FREE_ACTION + 1;

export const RIN_TELEPORTATION = RIN_SLOW_DIGESTION + 1;

export const RIN_TELEPORT_CONTROL = RIN_TELEPORTATION + 1;

export const RIN_POLYMORPH = RIN_TELEPORT_CONTROL + 1;

export const RIN_POLYMORPH_CONTROL = RIN_POLYMORPH + 1;

export const RIN_INVISIBILITY = RIN_POLYMORPH_CONTROL + 1;

export const RIN_SEE_INVISIBLE = RIN_INVISIBILITY + 1;

export const RIN_PROTECTION_FROM_SHAPE_CHAN = RIN_SEE_INVISIBLE + 1;

/* amulets ... - THE Amulet comes last because it is special */

export const AMULET_OF_ESP = RIN_PROTECTION_FROM_SHAPE_CHAN + 1;

export const FIRST_AMULET = AMULET_OF_ESP;
export const AMULET_OF_LIFE_SAVING = FIRST_AMULET + 1;

export const AMULET_OF_STRANGULATION = AMULET_OF_LIFE_SAVING + 1;

export const AMULET_OF_RESTFUL_SLEEP = AMULET_OF_STRANGULATION + 1;

export const AMULET_VERSUS_POISON = AMULET_OF_RESTFUL_SLEEP + 1;

export const AMULET_OF_CHANGE = AMULET_VERSUS_POISON + 1;

export const AMULET_OF_UNCHANGING = AMULET_OF_CHANGE + 1;

export const AMULET_OF_REFLECTION = AMULET_OF_UNCHANGING + 1;

export const AMULET_OF_MAGICAL_BREATHING = AMULET_OF_REFLECTION + 1;

        /* +2 AC and +2 MC; +2 takes naked hero past 'warded' to 'guarded' */
export const AMULET_OF_GUARDING = AMULET_OF_MAGICAL_BREATHING + 1;

        /* cubical: some descriptions are already three dimensional and
           parallelogrammatical (real word!) would be way over the top */
export const AMULET_OF_FLYING = AMULET_OF_GUARDING + 1;

/* fixed descriptions; description duplication is deliberate;
 * fake one must come before real one because selection for
 * description shuffling stops when a non-magic amulet is encountered
 */
export const FAKE_AMULET_OF_YENDOR = AMULET_OF_FLYING + 1;

export const AMULET_OF_YENDOR = FAKE_AMULET_OF_YENDOR + 1; /* note: description == name */

export const LAST_AMULET = AMULET_OF_YENDOR;

/* tools ... */
/* tools with weapon characteristics come last */

/* containers */
export const LARGE_BOX = LAST_AMULET + 1;

export const CHEST = LARGE_BOX + 1;

export const ICE_BOX = CHEST + 1;

export const SACK = ICE_BOX + 1;

export const OILSKIN_SACK = SACK + 1;

export const BAG_OF_HOLDING = OILSKIN_SACK + 1;

export const BAG_OF_TRICKS = BAG_OF_HOLDING + 1;

/* lock opening tools */
export const SKELETON_KEY = BAG_OF_TRICKS + 1;

export const LOCK_PICK = SKELETON_KEY + 1;

export const CREDIT_CARD = LOCK_PICK + 1;

/* light sources */
export const TALLOW_CANDLE = CREDIT_CARD + 1;

export const WAX_CANDLE = TALLOW_CANDLE + 1;

export const BRASS_LANTERN = WAX_CANDLE + 1;

export const OIL_LAMP = BRASS_LANTERN + 1;

export const MAGIC_LAMP = OIL_LAMP + 1;

/* other tools */
export const EXPENSIVE_CAMERA = MAGIC_LAMP + 1;

export const MIRROR = EXPENSIVE_CAMERA + 1;

export const CRYSTAL_BALL = MIRROR + 1;

/* eyewear - tools which can be worn on the face; (!mrg, !chg, !mgc)
   worn lenses don't confer the Blinded property, blindfolds and towels do;
   wet towel can be used as a weapon but is not a weptool and uses obj->spe
   differently from weapons and weptools */
export const LENSES = CRYSTAL_BALL + 1;

export const BLINDFOLD = LENSES + 1;

export const TOWEL = BLINDFOLD + 1;

/* still other tools */
export const SADDLE = TOWEL + 1;

export const LEASH = SADDLE + 1;

export const STETHOSCOPE = LEASH + 1;

export const TINNING_KIT = STETHOSCOPE + 1;

export const TIN_OPENER = TINNING_KIT + 1;

export const CAN_OF_GREASE = TIN_OPENER + 1;

export const FIGURINE = CAN_OF_GREASE + 1;

        /* monster type specified by obj->corpsenm */
export const MAGIC_MARKER = FIGURINE + 1;

/* traps */
export const LAND_MINE = MAGIC_MARKER + 1;

export const BEARTRAP = LAND_MINE + 1;

/* instruments;
   "If tin whistles are made out of tin, what do they make foghorns out of?" */
export const TIN_WHISTLE = BEARTRAP + 1;

export const MAGIC_WHISTLE = TIN_WHISTLE + 1;

export const WOODEN_FLUTE = MAGIC_WHISTLE + 1;

export const MAGIC_FLUTE = WOODEN_FLUTE + 1;

export const TOOLED_HORN = MAGIC_FLUTE + 1;

export const FROST_HORN = TOOLED_HORN + 1;

export const FIRE_HORN = FROST_HORN + 1;

export const HORN_OF_PLENTY = FIRE_HORN + 1;

        /* horn, but not an instrument */
export const WOODEN_HARP = HORN_OF_PLENTY + 1;

export const MAGIC_HARP = WOODEN_HARP + 1;

export const BELL = MAGIC_HARP + 1;

export const BUGLE = BELL + 1;

export const LEATHER_DRUM = BUGLE + 1;

export const DRUM_OF_EARTHQUAKE = LEATHER_DRUM + 1;

/* tools useful as weapons */
export const PICK_AXE = DRUM_OF_EARTHQUAKE + 1;

export const GRAPPLING_HOOK = PICK_AXE + 1;

export const UNICORN_HORN = GRAPPLING_HOOK + 1;

        /* 3.4.1: unicorn horn left classified as "magic" */
/* two unique tools;
 * not artifacts, despite the comment which used to be here
 */
export const CANDELABRUM_OF_INVOCATION = UNICORN_HORN + 1;

export const BELL_OF_OPENING = CANDELABRUM_OF_INVOCATION + 1;

/* Comestibles ... */

/* All types of food (except tins & corpses) must have a delay of at least 1.
 * Delay on corpses is computed and is weight dependent.
 * Domestic pets prefer tripe rations above all others.
 * Fortune cookies can be read, using them up without ingesting them.
 * Carrots improve your vision.
 * +0 tins contain monster meat.
 * +1 tins (of spinach) make you stronger (like Popeye).
 * Meatballs/sticks/rings are only created from objects via stone to flesh.
 */
/* meat */
export const TRIPE_RATION = BELL_OF_OPENING + 1;

export const CORPSE = TRIPE_RATION + 1;

export const EGG = CORPSE + 1;

export const MEATBALL = EGG + 1;

export const MEAT_STICK = MEATBALL + 1;

/* formerly "huge chunk of meat" */
export const ENORMOUS_MEATBALL = MEAT_STICK + 1;

/* special case because it's not mergeable */
export const MEAT_RING = ENORMOUS_MEATBALL + 1;

/* pudding 'corpses' will turn into these and combine;
   must be in same order as the pudding monsters */
export const GLOB_OF_GRAY_OOZE = MEAT_RING + 1;

export const GLOB_OF_BROWN_PUDDING = GLOB_OF_GRAY_OOZE + 1;

export const GLOB_OF_GREEN_SLIME = GLOB_OF_BROWN_PUDDING + 1;

export const GLOB_OF_BLACK_PUDDING = GLOB_OF_GREEN_SLIME + 1;

/* fruits & veggies */
export const KELP_FROND = GLOB_OF_BLACK_PUDDING + 1;
export const EUCALYPTUS_LEAF = KELP_FROND + 1;

export const APPLE = EUCALYPTUS_LEAF + 1;
export const ORANGE = APPLE + 1;
export const PEAR = ORANGE + 1;

export const MELON = PEAR + 1;

export const BANANA = MELON + 1;
export const CARROT = BANANA + 1;
export const SPRIG_OF_WOLFSBANE = CARROT + 1;

export const CLOVE_OF_GARLIC = SPRIG_OF_WOLFSBANE + 1;

/* name of slime mold is changed based on player's OPTION=fruit:something
   and bones data might have differently named ones from prior games */
export const SLIME_MOLD = CLOVE_OF_GARLIC + 1;

/* people food */
export const LUMP_OF_ROYAL_JELLY = SLIME_MOLD + 1;

export const CREAM_PIE = LUMP_OF_ROYAL_JELLY + 1;
export const CANDY_BAR = CREAM_PIE + 1;

export const FORTUNE_COOKIE = CANDY_BAR + 1;

export const PANCAKE = FORTUNE_COOKIE + 1;
export const LEMBAS_WAFER = PANCAKE + 1;

export const CRAM_RATION = LEMBAS_WAFER + 1;

export const FOOD_RATION = CRAM_RATION + 1;

export const K_RATION = FOOD_RATION + 1;
export const C_RATION = K_RATION + 1;
/* tins have type specified by obj->spe (+1 for spinach, other implies
   flesh; negative specifies preparation method {homemade,boiled,&c})
   and by obj->corpsenm (type of monster flesh) */
export const TIN = C_RATION + 1;

/* potions ... */

export const POT_GAIN_ABILITY = TIN + 1;

export const POT_RESTORE_ABILITY = POT_GAIN_ABILITY + 1;

export const POT_CONFUSION = POT_RESTORE_ABILITY + 1;

export const POT_BLINDNESS = POT_CONFUSION + 1;

export const POT_PARALYSIS = POT_BLINDNESS + 1;

export const POT_SPEED = POT_PARALYSIS + 1;

export const POT_LEVITATION = POT_SPEED + 1;

export const POT_HALLUCINATION = POT_LEVITATION + 1;

export const POT_INVISIBILITY = POT_HALLUCINATION + 1;

export const POT_SEE_INVISIBLE = POT_INVISIBILITY + 1;

export const POT_HEALING = POT_SEE_INVISIBLE + 1;

export const POT_EXTRA_HEALING = POT_HEALING + 1;

export const POT_GAIN_LEVEL = POT_EXTRA_HEALING + 1;

export const POT_ENLIGHTENMENT = POT_GAIN_LEVEL + 1;

export const POT_MONSTER_DETECTION = POT_ENLIGHTENMENT + 1;

export const POT_OBJECT_DETECTION = POT_MONSTER_DETECTION + 1;

export const POT_GAIN_ENERGY = POT_OBJECT_DETECTION + 1;

export const POT_SLEEPING = POT_GAIN_ENERGY + 1;

export const POT_FULL_HEALING = POT_SLEEPING + 1;

export const POT_POLYMORPH = POT_FULL_HEALING + 1;

export const POT_BOOZE = POT_POLYMORPH + 1;

export const POT_SICKNESS = POT_BOOZE + 1;

export const POT_FRUIT_JUICE = POT_SICKNESS + 1;

export const POT_ACID = POT_FRUIT_JUICE + 1;

export const POT_OIL = POT_ACID + 1;

/* fixed description
 */
export const POT_WATER = POT_OIL + 1;

/* scrolls ... */

export const SCR_ENCHANT_ARMOR = POT_WATER + 1;

export const SCR_DESTROY_ARMOR = SCR_ENCHANT_ARMOR + 1;

export const SCR_CONFUSE_MONSTER = SCR_DESTROY_ARMOR + 1;

export const SCR_SCARE_MONSTER = SCR_CONFUSE_MONSTER + 1;

export const SCR_REMOVE_CURSE = SCR_SCARE_MONSTER + 1;

export const SCR_ENCHANT_WEAPON = SCR_REMOVE_CURSE + 1;

export const SCR_CREATE_MONSTER = SCR_ENCHANT_WEAPON + 1;

export const SCR_TAMING = SCR_CREATE_MONSTER + 1;

export const SCR_GENOCIDE = SCR_TAMING + 1;

export const SCR_LIGHT = SCR_GENOCIDE + 1;

export const SCR_TELEPORTATION = SCR_LIGHT + 1;

export const SCR_GOLD_DETECTION = SCR_TELEPORTATION + 1;

export const SCR_FOOD_DETECTION = SCR_GOLD_DETECTION + 1;

export const SCR_IDENTIFY = SCR_FOOD_DETECTION + 1;

export const SCR_MAGIC_MAPPING = SCR_IDENTIFY + 1;

export const SCR_AMNESIA = SCR_MAGIC_MAPPING + 1;

export const SCR_FIRE = SCR_AMNESIA + 1;

export const SCR_EARTH = SCR_FIRE + 1;

export const SCR_PUNISHMENT = SCR_EARTH + 1;

export const SCR_CHARGING = SCR_PUNISHMENT + 1;

export const SCR_STINKING_CLOUD = SCR_CHARGING + 1;

    /* Extra descriptions, shuffled into use at start of new game.
     * Code in win/share/tilemap.c depends on SCR_STINKING_CLOUD preceding
     * these and on how many of them there are.  If a real scroll gets added
     * after stinking cloud or the number of extra descriptions changes,
     * tilemap.c must be modified to match.  Mgc,Prob,Cost are superfluous.
     * SC values must be distinct but are only used by 'nethack --dumpenums'.
     */

export const SC01 = SCR_STINKING_CLOUD + 1;
export const SC02 = SC01 + 1;
export const SC03 = SC02 + 1;
export const SC04 = SC03 + 1;
export const SC05 = SC04 + 1;
export const SC06 = SC05 + 1;
export const SC07 = SC06 + 1; /* Illuminati */
export const SC08 = SC07 + 1; /* Kurd Lasswitz */
export const SC09 = SC08 + 1; /* traditional incantation */
export const SC10 = SC09 + 1; /* Portal */
export const SC11 = SC10 + 1; /* Zak McKracken */
export const SC12 = SC11 + 1; /* Zak McKracken */
export const SC13 = SC12 + 1;
export const SC14 = SC13 + 1; /* Merseburg Incantations */
export const SC15 = SC14 + 1; /* Merseburg Incantations */
export const SC16 = SC15 + 1; /* pronounced as 'fish',
                                                * George Bernard Shaw */
export const SC17 = SC16 + 1; /* Wizardry */
export const SC18 = SC17 + 1; /* Ultima */
export const SC19 = SC18 + 1; /* Aarne Haapakoski */
export const SC20 = SC19 + 1; /* Czech and Slovak
                                                * tongue-twister */

    /* These must come last because they have special fixed descriptions.
     */

export const SCR_MAIL = SC20 + 1;

export const SCR_BLANK_PAPER = SCR_MAIL + 1;

/* spellbooks ... */
    /* Expanding beyond 52 spells would require changes in spellcasting
     * or imposition of a limit on number of spells hero can know because
     * they are currently assigned successive letters, a-zA-Z, when learned.
     * [The existing spell sorting capability could conceivably be extended
     * to enable moving spells from beyond Z to within it, bumping others
     * out in the process, allowing more than 52 spells be known but keeping
     * only 52 be castable at any given time.]
     */

/* Spellbook description normally refers to book covers (primarily color).
   Parchment and vellum would never be used for such, but rather than
   eliminate those, finagle their definitions to refer to the pages
   rather than the cover.  They are made from animal skin (typically of
   a goat or sheep) and books using them for pages generally need heavy
   covers with straps or clamps to tightly close the book in order to
   keep the pages flat.  (However, a wooden cover might itself be covered
   by a sheet of parchment, making this become less of an exception.  Also,
   changing the internal composition from paper to leather makes eating a
   parchment or vellum spellbook break vegetarian conduct, as it should.) */

export const SPE_DIG = SCR_BLANK_PAPER + 1;

export const FIRST_SPELL = SPE_DIG;
/* magic missile ... finger of death must be in this order; see buzz() */
export const SPE_MAGIC_MISSILE = FIRST_SPELL + 1;

export const SPE_FIREBALL = SPE_MAGIC_MISSILE + 1;

export const SPE_CONE_OF_COLD = SPE_FIREBALL + 1;

export const SPE_SLEEP = SPE_CONE_OF_COLD + 1;

export const SPE_FINGER_OF_DEATH = SPE_SLEEP + 1;

export const SPE_LIGHT = SPE_FINGER_OF_DEATH + 1;

export const SPE_DETECT_MONSTERS = SPE_LIGHT + 1;

export const SPE_HEALING = SPE_DETECT_MONSTERS + 1;

export const SPE_KNOCK = SPE_HEALING + 1;

export const SPE_FORCE_BOLT = SPE_KNOCK + 1;

export const SPE_CONFUSE_MONSTER = SPE_FORCE_BOLT + 1;

export const SPE_CURE_BLINDNESS = SPE_CONFUSE_MONSTER + 1;

export const SPE_DRAIN_LIFE = SPE_CURE_BLINDNESS + 1;

export const SPE_SLOW_MONSTER = SPE_DRAIN_LIFE + 1;

export const SPE_WIZARD_LOCK = SPE_SLOW_MONSTER + 1;

export const SPE_CREATE_MONSTER = SPE_WIZARD_LOCK + 1;

export const SPE_DETECT_FOOD = SPE_CREATE_MONSTER + 1;

export const SPE_CAUSE_FEAR = SPE_DETECT_FOOD + 1;

export const SPE_CLAIRVOYANCE = SPE_CAUSE_FEAR + 1;

export const SPE_CURE_SICKNESS = SPE_CLAIRVOYANCE + 1;

export const SPE_CHARM_MONSTER = SPE_CURE_SICKNESS + 1;

export const SPE_HASTE_SELF = SPE_CHARM_MONSTER + 1;

export const SPE_DETECT_UNSEEN = SPE_HASTE_SELF + 1;

export const SPE_LEVITATION = SPE_DETECT_UNSEEN + 1;

export const SPE_EXTRA_HEALING = SPE_LEVITATION + 1;

export const SPE_RESTORE_ABILITY = SPE_EXTRA_HEALING + 1;

export const SPE_INVISIBILITY = SPE_RESTORE_ABILITY + 1;

export const SPE_DETECT_TREASURE = SPE_INVISIBILITY + 1;

export const SPE_REMOVE_CURSE = SPE_DETECT_TREASURE + 1;

export const SPE_MAGIC_MAPPING = SPE_REMOVE_CURSE + 1;

export const SPE_IDENTIFY = SPE_MAGIC_MAPPING + 1;

export const SPE_TURN_UNDEAD = SPE_IDENTIFY + 1;

export const SPE_POLYMORPH = SPE_TURN_UNDEAD + 1;

export const SPE_TELEPORT_AWAY = SPE_POLYMORPH + 1;

export const SPE_CREATE_FAMILIAR = SPE_TELEPORT_AWAY + 1;

export const SPE_CANCELLATION = SPE_CREATE_FAMILIAR + 1;

export const SPE_PROTECTION = SPE_CANCELLATION + 1;

export const SPE_JUMPING = SPE_PROTECTION + 1;

export const SPE_STONE_TO_FLESH = SPE_JUMPING + 1;

export const SPE_CHAIN_LIGHTNING = SPE_STONE_TO_FLESH + 1;

/* from slash'em, create a tame critter which explodes when attacking,
   damaging adjacent creatures--friend or foe--and dying in the process */

/* books with fixed descriptions
 */
export const SPE_BLANK_PAPER = SPE_CHAIN_LIGHTNING + 1;

/* LAST_SPELL is used to calculate MAXSPELL, allocation size of spl_book[];
   by including blank paper, which has no actual spell, we ensure that
   even if hero learns every spell, spl_book[] will have at least one
   unused slot at end; an unused slot is needed for use as terminator */
export const LAST_SPELL = SPE_BLANK_PAPER;
/* tribute book added in 3.6 */
export const SPE_NOVEL = LAST_SPELL + 1;

/* a special, one of a kind, spellbook */
export const SPE_BOOK_OF_THE_DEAD = SPE_NOVEL + 1;

/* wands ... */

export const WAN_LIGHT = SPE_BOOK_OF_THE_DEAD + 1;

export const WAN_SECRET_DOOR_DETECTION = WAN_LIGHT + 1;

export const WAN_ENLIGHTENMENT = WAN_SECRET_DOOR_DETECTION + 1;

export const WAN_CREATE_MONSTER = WAN_ENLIGHTENMENT + 1;

export const WAN_WISHING = WAN_CREATE_MONSTER + 1;

export const WAN_STASIS = WAN_WISHING + 1;

export const WAN_NOTHING = WAN_STASIS + 1;

export const WAN_STRIKING = WAN_NOTHING + 1;

export const WAN_MAKE_INVISIBLE = WAN_STRIKING + 1;

export const WAN_SLOW_MONSTER = WAN_MAKE_INVISIBLE + 1;

export const WAN_SPEED_MONSTER = WAN_SLOW_MONSTER + 1;

export const WAN_UNDEAD_TURNING = WAN_SPEED_MONSTER + 1;

export const WAN_POLYMORPH = WAN_UNDEAD_TURNING + 1;

export const WAN_CANCELLATION = WAN_POLYMORPH + 1;

export const WAN_TELEPORTATION = WAN_CANCELLATION + 1;

export const WAN_OPENING = WAN_TELEPORTATION + 1;

export const WAN_LOCKING = WAN_OPENING + 1;

export const WAN_PROBING = WAN_LOCKING + 1;

export const WAN_DIGGING = WAN_PROBING + 1;

/* magic missile ... lightning must be in this order; see buzz() */
export const WAN_MAGIC_MISSILE = WAN_DIGGING + 1;

export const WAN_FIRE = WAN_MAGIC_MISSILE + 1;

export const WAN_COLD = WAN_FIRE + 1;

export const WAN_SLEEP = WAN_COLD + 1;

export const WAN_DEATH = WAN_SLEEP + 1;

export const WAN_LIGHTNING = WAN_DEATH + 1;

/* extra descriptions, shuffled into use at start of new game */
export const WAN1 = WAN_LIGHTNING + 1;
export const WAN2 = WAN1 + 1;
export const WAN3 = WAN2 + 1;

/* coins ... - so far, gold is all there is */

export const GOLD_PIECE = WAN3 + 1;

/* gems ... - includes stones and rocks but not boulders */

export const DILITHIUM_CRYSTAL = GOLD_PIECE + 1;

export const FIRST_REAL_GEM = DILITHIUM_CRYSTAL;
export const DIAMOND = FIRST_REAL_GEM + 1;

export const RUBY = DIAMOND + 1;

export const JACINTH = RUBY + 1;

export const SAPPHIRE = JACINTH + 1;

export const BLACK_OPAL = SAPPHIRE + 1;

export const EMERALD = BLACK_OPAL + 1;

export const TURQUOISE = EMERALD + 1;

export const CITRINE = TURQUOISE + 1;

export const AQUAMARINE = CITRINE + 1;

export const AMBER = AQUAMARINE + 1;

export const TOPAZ = AMBER + 1;

export const JET = TOPAZ + 1;

export const OPAL = JET + 1;

export const CHRYSOBERYL = OPAL + 1;

export const GARNET = CHRYSOBERYL + 1;

export const AMETHYST = GARNET + 1;

export const JASPER = AMETHYST + 1;

export const FLUORITE = JASPER + 1;

export const OBSIDIAN = FLUORITE + 1;

export const AGATE = OBSIDIAN + 1;

export const JADE = AGATE + 1;

export const LAST_REAL_GEM = JADE;
export const WORTHLESS_WHITE_GLASS = LAST_REAL_GEM + 1;

export const FIRST_GLASS_GEM = WORTHLESS_WHITE_GLASS;
export const WORTHLESS_BLUE_GLASS = FIRST_GLASS_GEM + 1;

export const WORTHLESS_RED_GLASS = WORTHLESS_BLUE_GLASS + 1;

export const WORTHLESS_YELLOWBROWN_GLASS = WORTHLESS_RED_GLASS + 1;

export const WORTHLESS_ORANGE_GLASS = WORTHLESS_YELLOWBROWN_GLASS + 1;

export const WORTHLESS_YELLOW_GLASS = WORTHLESS_ORANGE_GLASS + 1;

export const WORTHLESS_BLACK_GLASS = WORTHLESS_YELLOW_GLASS + 1;

export const WORTHLESS_GREEN_GLASS = WORTHLESS_BLACK_GLASS + 1;

export const WORTHLESS_VIOLET_GLASS = WORTHLESS_GREEN_GLASS + 1;

export const LAST_GLASS_GEM = WORTHLESS_VIOLET_GLASS;

/* Placement note: there is a wishable subrange for
 * "gray stones" in the o_ranges[] array in objnam.c
 * that is currently everything between luckstones and flint
 * (inclusive).
 */
export const LUCKSTONE = LAST_GLASS_GEM + 1;

export const LOADSTONE = LUCKSTONE + 1;

export const TOUCHSTONE = LOADSTONE + 1;

export const FLINT = TOUCHSTONE + 1;

export const ROCK = FLINT + 1;

/* miscellaneous ... */
/* Note: boulders and rocks are not normally created at random; the
 * probabilities only come into effect when you try to polymorph them.
 * Boulders weigh more than MAX_CARR_CAP; statues use corpsenm to take
 * on a specific type and may act as containers (both affect weight).
 */
export const BOULDER = ROCK + 1;

export const STATUE = BOULDER + 1;

export const HEAVY_IRON_BALL = STATUE + 1;

        /* +d4 when "very heavy" */
export const IRON_CHAIN = HEAVY_IRON_BALL + 1;

        /* +1 both l & s */

/* Venom is normally a transitory missile (spit by various creatures)
 * but can be wished for in wizard mode so could occur in bones data.
 */
export const BLINDING_VENOM = IRON_CHAIN + 1;

export const ACID_VENOM = BLINDING_VENOM + 1; export const NUM_OBJECTS = ACID_VENOM + 1;

        /* +d6 small or large */

/* fencepost, the deadly Array Terminator -- name [1st arg] *must* be NULL */

/*objects.c*/
