/* NetHack 5.0	monflag.h	$NHDT-Date: 1596498549 2020/08/03 23:49:09 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.21 $ */
/* Copyright (c) 1989 Mike Threepoint                             */
/* NetHack may be freely redistributed.  See license for details. */

/* clang-format off */
/* *INDENT-OFF* */

    export const MS_SILENT = 0; /* makes no sound */
    export const MS_BARK = 1; /* if full moon, may howl */
    export const MS_MEW = 2; /* mews or hisses */
    export const MS_ROAR = 3; /* roars */
    export const MS_BELLOW = 4; /* adult male crocodiles; hatchlings 'chirp' */
    export const MS_GROWL = 5; /* growls */
    export const MS_SQEEK = 6; /* squeaks, as a rodent */
    export const MS_SQAWK = 7; /* squawks, as a bird */
    export const MS_CHIRP = 8; /* baby crocodile */
    export const MS_HISS = 9; /* hisses */
    export const MS_BUZZ = 10; /* buzzes (killer bee) */
    export const MS_GRUNT = 11; /* grunts (or speaks own language) */
    export const MS_NEIGH = 12; /* neighs, as an equine */
    export const MS_MOO = 13; /* minotaurs, rothes */
    export const MS_WAIL = 14; /* wails, as a tortured soul */
    export const MS_GURGLE = 15; /* gurgles, as liquid or through saliva */
    export const MS_BURBLE = 16; /* burbles (jabberwock) */
    export const MS_TRUMPET = 17; /* trumpets (elephant) */
    export const MS_ANIMAL = 17; /* up to here are animal noises */
    /* FIXME? the grunt "speaks own language" case above
       shouldn't be classified as animal */
    export const MS_SHRIEK = 18; /* wakes up others */
    export const MS_BONES = 19; /* rattles bones (skeleton) */
    export const MS_LAUGH = 20; /* grins, smiles, giggles, and laughs */
    export const MS_MUMBLE = 21; /* says something or other */
    export const MS_IMITATE = 22; /* imitates others (leocrotta) */
    export const MS_WERE = 23; /* lycanthrope in human form */
    export const MS_ORC = 24; /* intelligent brutes */
    /* from here onward, speech can be comprehended */
    export const MS_HUMANOID = 25; /* generic traveling companion */
    export const MS_ARREST = 26; /* "Stop in the name of the law!" (Kops) */
    export const MS_SOLDIER = 27; /* army and watchmen expressions */
    export const MS_GUARD = 28; /* "Please drop that gold and follow me." */
    export const MS_DJINNI = 29; /* "Thank you for freeing me!" */
    export const MS_NURSE = 30; /* "Take off your shirt, please." */
    export const MS_SEDUCE = 31; /* "Hello, sailor." (Nymphs) */
    export const MS_VAMPIRE = 32; /* vampiric seduction, Vlad's exclamations */
    export const MS_BRIBE = 33; /* asks for money, or berates you */
    export const MS_CUSS = 34; /* berates (demons) or intimidates (Wiz) */
    export const MS_RIDER = 35; /* astral level special monsters */
    export const MS_LEADER = 36; /* your class leader */
    export const MS_NEMESIS = 37; /* your nemesis */
    export const MS_GUARDIAN = 38; /* your leader's guards */
    export const MS_SELL = 39; /* demand payment, complain about shoplifters */
    export const MS_ORACLE = 40; /* do a consultation */
    export const MS_PRIEST = 41; /* ask for contribution; do cleansing */
    export const MS_SPELL = 42; /* spellcaster not matching any of the above */
    export const MS_BOAST = 43; /* giants */
    export const MS_GROAN = 44; /* zombies groan */

export const MR_FIRE = 0x01;
export const MR_COLD = 0x02;
export const MR_SLEEP = 0x04;
export const MR_DISINT = 0x08;
export const MR_ELEC = 0x10;
export const MR_POISON = 0x20;
export const MR_ACID = 0x40;
export const MR_STONE = 0x80;
/* NB: the above resistances correspond to the first 8 hero properties in
   prop_types (FIRE_RES through STONE_RES), which can be converted to their
   MR_foo equivalents with the macro res_to_mr() defined in prop.h */
/* other resistances: magic, sickness */
/* other conveyances: teleport, teleport control, telepathy */

/* individual resistances */

export const M1_FLY = 0x00000001;
export const M1_SWIM = 0x00000002;
export const M1_AMORPHOUS = 0x00000004;
export const M1_WALLWALK = 0x00000008;
export const M1_CLING = 0x00000010;
export const M1_TUNNEL = 0x00000020;
export const M1_NEEDPICK = 0x00000040;
export const M1_CONCEAL = 0x00000080;
export const M1_HIDE = 0x00000100;
export const M1_AMPHIBIOUS = 0x00000200;
export const M1_BREATHLESS = 0x00000400;
export const M1_NOTAKE = 0x00000800;
export const M1_NOEYES = 0x00001000;
export const M1_NOHANDS = 0x00002000;
export const M1_NOLIMBS = 0x00006000;
export const M1_NOHEAD = 0x00008000;
export const M1_MINDLESS = 0x00010000;
export const M1_HUMANOID = 0x00020000;
export const M1_ANIMAL = 0x00040000;
export const M1_SLITHY = 0x00080000;
export const M1_UNSOLID = 0x00100000;
export const M1_THICK_HIDE = 0x00200000;
export const M1_OVIPAROUS = 0x00400000;
export const M1_REGEN = 0x00800000;
export const M1_SEE_INVIS = 0x01000000;
export const M1_TPORT = 0x02000000;
export const M1_TPORT_CNTRL = 0x04000000;
export const M1_ACID = 0x08000000;
export const M1_POIS = 0x10000000;
export const M1_CARNIVORE = 0x20000000;
export const M1_HERBIVORE = 0x40000000;
export const M1_OMNIVORE = 0x60000000;

export const M1_METALLIVORE = 0x80000000;

export const M2_NOPOLY = 0x00000001;
export const M2_UNDEAD = 0x00000002;
export const M2_WERE = 0x00000004;
export const M2_HUMAN = 0x00000008;
export const M2_ELF = 0x00000010;
export const M2_DWARF = 0x00000020;
export const M2_GNOME = 0x00000040;
export const M2_ORC = 0x00000080;
export const M2_DEMON = 0x00000100;
export const M2_MERC = 0x00000200;
export const M2_LORD = 0x00000400;
export const M2_PRINCE = 0x00000800;
export const M2_MINION = 0x00001000;
export const M2_GIANT = 0x00002000;
export const M2_SHAPESHIFTER = 0x00004000;
export const M2_MALE = 0x00010000;
export const M2_FEMALE = 0x00020000;
export const M2_NEUTER = 0x00040000;
export const M2_PNAME = 0x00080000;
export const M2_HOSTILE = 0x00100000;
export const M2_PEACEFUL = 0x00200000;
export const M2_DOMESTIC = 0x00400000;
export const M2_WANDER = 0x00800000;
export const M2_STALK = 0x01000000;
export const M2_NASTY = 0x02000000;
export const M2_STRONG = 0x04000000;
export const M2_ROCKTHROW = 0x08000000;
export const M2_GREEDY = 0x10000000;
export const M2_JEWELS = 0x20000000;
export const M2_COLLECT = 0x40000000;

export const M2_MAGIC = 0x80000000;

export const M3_WANTSAMUL = 0x0001;
export const M3_WANTSBELL = 0x0002;
export const M3_WANTSBOOK = 0x0004;
export const M3_WANTSCAND = 0x0008;
export const M3_WANTSARTI = 0x0010;

export const M3_WAITFORU = 0x0040;
export const M3_CLOSE = 0x0080;

export const M3_COVETOUS = 0x001f;
export const M3_WAITMASK = 0x00c0;

/* Infravision is currently implemented for players only */
export const M3_INFRAVISION = 0x0100;
export const M3_INFRAVISIBLE = 0x0200;

export const M3_DISPLACES = 0x0400;

export const MZ_TINY = 0;
export const MZ_SMALL = 1;
export const MZ_MEDIUM = 2;
export const MZ_HUMAN = MZ_MEDIUM;
export const MZ_LARGE = 3;
export const MZ_HUGE = 4;
export const MZ_GIGANTIC = 7;

/* Monster races -- must stay within ROLE_RACEMASK */
/* Eventually this may become its own field */
export const MH_HUMAN = M2_HUMAN;
export const MH_ELF = M2_ELF;
export const MH_DWARF = M2_DWARF;
export const MH_GNOME = M2_GNOME;
export const MH_ORC = M2_ORC;

/* for mons[].geno (constant during game) */
export const G_UNIQ = 0x1000;
export const G_NOHELL = 0x0800;
export const G_HELL = 0x0400;
export const G_NOGEN = 0x0200;
export const G_SGROUP = 0x0080;
export const G_LGROUP = 0x0040;
export const G_GENO = 0x0020;
export const G_NOCORPSE = 0x0010;
export const G_FREQ = 0x0007;
/* note: G_IGNORE controls handling of mvitals[].mvflags bits but is
   passed to mkclass() as if it dealt with mons[].geno bits */
export const G_IGNORE = 0x8000;

/* for svm.mvitals[].mvflags (variant during game), along with G_NOCORPSE */

export const G_GENOD = 0x02;
export const G_EXTINCT = 0x01;
export const G_GONE = (G_GENOD | G_EXTINCT);
export const MV_KNOWS_EGG = 0x08;

export const MALE = 0; export const FEMALE = MALE + 1; export const NEUTRAL = FEMALE + 1;
               export const NUM_MGENDERS = NEUTRAL + 1;

/* *INDENT-ON* */
/* clang-format on */
