/* NetHack 5.0	you.h	$NHDT-Date: 1702349061 2023/12/12 02:44:21 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.75 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2016. */
/* NetHack may be freely redistributed.  See license for details. */

/*** Substructures ***/

export const struct_RoleName = struct("struct_RoleName", {
    m: ptr_to(char), /* name when character is male */
    f: ptr_to(char), /* when female; null if same as male */
});

export const struct_RoleAdvance = struct("struct_RoleAdvance", {
    /* "fix" is the fixed amount, "rnd" is the random amount */
    infix: xint16, inrnd: xint16, /* at character initialization */
    lofix: xint16, lornd: xint16, /* gained per level <  gu.urole.xlev */
    hifix: xint16, hirnd: xint16, /* gained per level >= gu.urole.xlev */
});

export const struct_u_have = struct("struct_u_have", {
    amulet: Bitfield(1), /* carrying Amulet   */
    bell: Bitfield(1), /* carrying Bell     */
    book: Bitfield(1), /* carrying Book     */
    menorah: Bitfield(1), /* carrying Candelabrum */
    questart: Bitfield(1), /* carrying the Quest Artifact */
    unused: Bitfield(3),
});

export const struct_u_event = struct("struct_u_event", {
    minor_oracle: Bitfield(1), /* received at least 1 cheap oracle */
    major_oracle: Bitfield(1), /*  "  expensive oracle */
    read_tribute: Bitfield(1), /* read a passage from a novel */
    qcalled: Bitfield(1), /* called by Quest leader to do task */
    qexpelled: Bitfield(1), /* expelled from the Quest dungeon */
    qcompleted: Bitfield(1), /* successfully completed Quest task */
    uheard_tune: Bitfield(2), /* 1=know about, 2=heard passtune, 3=bridge has
                                * been destroyed so tune has become useless */
    uopened_dbridge: Bitfield(1), /* opened the drawbridge */
    invoked: Bitfield(1), /* invoked Gate to the Sanctum level */
    gehennom_entered: Bitfield(1), /* entered Gehennom via Valley */
    uhand_of_elbereth: Bitfield(2), /* became Hand of Elbereth */
    udemigod: Bitfield(1), /* killed the wiz */
    uvibrated: Bitfield(1), /* stepped on "vibrating square" */
    ascended: Bitfield(1), /* has offered the Amulet */

    amulet_wish: Bitfield(1), /* has gained a wish from the Amulet */
    /* 7 free bits */
});

/*
 * Achievements:  milestones reached during the current game.
 * Numerical order of these matters because they've been encoded in
 * a bitmask in xlogfile.  Reordering would break decoding that.
 * Aside from that, the number isn't significant--they're recorded
 * and eventually disclosed in the order achieved.
 *
 * Since xlogfile could be post-processed by unknown tools, we should
 * limit these to 31 total (it's possible that 32-bit signed longs are
 * the best such tools can offer).  Eventually that is likely to need
 * to change, probably by giving xlogfile an achieve2 field rather
 * than by assuming that 64-bit longs are viable or by squeezing in a
 * 32nd entry by switching to unsigned long.
 */

    export const ACH_BELL = 1; /* acquired Bell of Opening */
    export const ACH_HELL = 2; /* entered Gehennom */
    export const ACH_CNDL = 3; /* acquired Candelabrum of Invocation */
    export const ACH_BOOK = 4; /* acquired Book of the Dead */
    export const ACH_INVK = 5; /* performed invocation to gain access to Sanctum */
    export const ACH_AMUL = 6; /* acquired The Amulet */
    export const ACH_ENDG = 7; /* entered end game */
    export const ACH_ASTR = 8; /* entered Astral Plane */
    export const ACH_UWIN = 9; /* ascended */
    export const ACH_MINE_PRIZE = 10; /* acquired Mines' End luckstone */
    export const ACH_SOKO_PRIZE = 11; /* acquired Sokoban bag or amulet */
    export const ACH_MEDU = 12; /* killed Medusa */
    export const ACH_BLND = 13; /* hero was always blond, no, blind */
    export const ACH_NUDE = 14; /* hero never wore armor */
    /* 1 through 14 were present in 3.6.x; the rest are newer; first,
       some easier ones so less skilled players can have achievements */
    export const ACH_MINE = 15; /* entered Gnomish Mines */
    export const ACH_TOWN = 16; /* reached Minetown */
    export const ACH_SHOP = 17; /* entered a shop */
    export const ACH_TMPL = 18; /* entered a temple */
    export const ACH_ORCL = 19; /* consulted the Oracle */
    export const ACH_NOVL = 20; /* read at least one passage from a Discworld novel */
    export const ACH_SOKO = 21; /* entered Sokoban */
    export const ACH_BGRM = 22; /* entered Bigroom (not guaranteed to be in every dgn) */
    /* role's rank titles, beyond first (#0 at level one, not an achievement);
       23..30 are negated if hero is female at the time new rank is gained
       so that disclosing them can use the gender which applied at the time */
    export const ACH_RNK1 = 23; export const ACH_RNK2 = 24; export const ACH_RNK3 = 25; export const ACH_RNK4 = 26;
    export const ACH_RNK5 = 27; export const ACH_RNK6 = 28; export const ACH_RNK7 = 29; export const ACH_RNK8 = 30;
    export const ACH_TUNE = 31; /* discovered the castle drawbridge's open/close tune */
    export const N_ACH = 32; /* allocate room for 31 plus a slot for 0 terminator */

    /*
     * Other potential achievements to track (this comment briefly resided
     * in encodeachieve(topten.c) and has been revised since moving here:
     *  AC <= 0, AC <= -10, AC <= -20 (stop there; lower is better but
     *    not something to encourage with achievements),
     *  got quest summons,
     *  entered quest branch,
     *  chatted with leader,
     *  entered second or lower quest level (implies leader gave the Ok),
     *  entered last quest level,
     *  defeated nemesis (not same as acquiring Bell or artifact),
     *  completed quest (formally, by bringing artifact to leader),
     *  entered rogue level,
     *  entered Fort Ludios level/branch (not guaranteed to be achievable),
     *  entered Medusa level,
     *  entered castle level,
     *  obtained castle wand (handle similarly to mines and sokoban prizes),
     *  passed Valley level (entered-Gehennom already covers Valley itself),
     *  [assorted demon lairs?],
     *  entered Vlad's tower branch,
     *  defeated Vlad (not same as acquiring Candelabrum),
     *  entered Wizard's tower area within relevant level,
     *  defeated Wizard,
     *  found vibrating square,
     *  entered sanctum level (maybe not; too close to performed-invocation),
     *  [defeated Famine, defeated Pestilence, defeated Death]
     */

export const struct_u_realtime = struct("struct_u_realtime", {
    realtime: long, /* accumulated playing time in seconds */
    start_timing: long, /* time game was started or restored or 'realtime'
                            was last updated (savegamestate for checkpoint) */
    finish_time: long, /* end of 'realtime' interval: time of save or
                            end of game; used for topten/logfile/xlogfile */
});

/* KMH, conduct --
 * These are voluntary challenges.  Each field denotes the number of
 * times a challenge has been violated.
 */
export const struct_u_conduct = struct("struct_u_conduct", { /* number of times... */
    unvegetarian: long, /* eaten any animal */
    unvegan: long, /* ... or any animal byproduct */
    food: long, /* ... or any comestible */
    gnostic: long, /* used prayer, priest, or altar */
    weaphit: long, /* hit a monster with a weapon */
    killer: long, /* killed a monster yourself */
    literate: long, /* read something (other than BotD) */
    polypiles: long, /* polymorphed an object */
    polyselfs: long, /* transformed yourself */
    wishes: long, /* used a wish */
    wisharti: long, /* wished for an artifact */
    hf_reserved1: long, /* hf uses for elbereth;for hf savefile compatiblity */
    sokocheat: long, /* violated special 'rules' in Sokoban */
    pets: long, /* obtained a pet */
    /* genocides already listed at end of game */
    reserved1: long,
    reserved2: long,
    reserved3: long,
    reserved4: long,
});

export const struct_u_roleplay = struct("struct_u_roleplay", {
    blind: boolean, /* permanently blind */
    nudist: boolean, /* has not worn any armor, ever */
    deaf: boolean, /* permanently deaf */
    pauper: boolean, /* no starting inventory */
    reroll: boolean, /* starting inventory/attr rerolling enabled */
    reserved1: boolean,
    reserved2: boolean,
    reserved3: boolean,
    numbones: long, /* # of bones files loaded */
    numrerolls: long, /* # of rerolls used */
});

/*** Unified structure containing role information ***/
export const ROLE_RACEMASK = 0x0ff8; export const ROLE_GENDMASK = 0xf000; export const ROLE_MALE = 0x1000; export const ROLE_FEMALE = 0x2000; export const ROLE_NEUTER = 0x4000; export const struct_Role = struct("struct_Role", {
    /*** Strings that name various things ***/
    name: "struct_RoleName", /* the role's name (from u_init.c) */
    rank: array_of("struct_RoleName", 9), /* names for experience levels (from botl.c) */
    lgod: ptr_to(char), ngod: ptr_to(char), cgod: ptr_to(char), /* god names (from pray.c) */
    filecode: ptr_to(char), /* abbreviation for use in file names */
    homebase: ptr_to(char), /* quest leader's location (from questpgr.c) */
    intermed: ptr_to(char), /* quest intermediate goal (from questpgr.c) */

    /*** Indices of important monsters and objects ***/
    mnum: short, /* index (PM_) of role (botl.c) */
        petnum: short, /* PM_ of preferred pet (NON_PM == random) */
        ldrnum: short, /* PM_ of quest leader (questpgr.c) */
        guardnum: short, /* PM_ of quest guardians (questpgr.c) */
        neminum: short, /* PM_ of quest nemesis (questpgr.c) */
        enemy1num: short, /* specific quest enemies (NON_PM == random) */
        enemy2num: short,
    enemy1sym: char, /* quest enemies by class (S_) */
        enemy2sym: char,
    questarti: short, /* index (ART_) of quest artifact (questpgr.c) */

    /*** Bitmasks ***/
    allow: short, /* bit mask of allowed variations */

    /*** Attributes (from attrib.c and exper.c) ***/
    attrbase: array_of(short, A_MAX), /* lowest initial attributes */
    attrdist: array_of(short, A_MAX), /* distribution of initial attributes */
    hpadv: "struct_RoleAdvance", /* hit point advancement */
    enadv: "struct_RoleAdvance", /* energy advancement */
    xlev: xint16, /* cutoff experience level */
    initrecord: xint16, /* initial alignment record */

    /*** Spell statistics (from spell.c) ***/
    spelbase: int, /* base spellcasting penalty */
    spelheal: int, /* penalty (-bonus) for healing spells */
    spelshld: int, /* penalty for wearing any shield */
    spelarmr: int, /* penalty for wearing metal armour */
    spelstat: int, /* which stat (A_) is used */
    spelspec: int, /* spell (SPE_) the class excels at */
    spelsbon: int, /* penalty (-bonus) for that spell */

    /*** Properties in variable-length arrays ***/
    /* intrinsics (see attrib.c) */
    /* initial inventory (see u_init.c) */
    /* skills (see u_init.c) */

    /*** Don't forget to add... ***/
    /* quest leader, guardians, nemesis (monst.c) */
    /* quest artifact (artilist.h) */
    /* quest dungeon definition (dat/Xyz.dat) */
    /* quest text (dat/quest.txt) */
    /* dictionary entries (dat/data.bas) */
});

/* used during initialization for race, gender, and alignment
   as well as for character class */
export const ROLE_NONE = (-1);
export const ROLE_RANDOM = (-2);

/*** Unified structure specifying race information ***/

export const struct_Race = struct("struct_Race", {
    /*** Strings that name various things ***/
    noun: ptr_to(char), /* noun ("human", "elf") */
    adj: ptr_to(char), /* adjective ("human", "elven") */
    coll: ptr_to(char), /* collective ("humanity", "elvenkind") */
    filecode: ptr_to(char), /* code for filenames */
    individual: "struct_RoleName", /* individual as a noun ("man", "elf") */

    /*** Indices of important monsters and objects ***/
    mnum: short, /* PM_ as a monster */
        mummynum: short, /* PM_ as a mummy */
        zombienum: short, /* PM_ as a zombie */

    /*** Bitmasks ***/
    allow: short, /* bit mask of allowed variations */
    selfmask: short, /* your own race's bit mask */
        lovemask: short, /* bit mask of always peaceful */
        hatemask: short, /* bit mask of always hostile */

    /*** Attributes ***/
    attrmin: array_of(short, A_MAX), /* minimum allowable attribute */
    attrmax: array_of(short, A_MAX), /* maximum allowable attribute */
    hpadv: "struct_RoleAdvance", /* hit point advancement */
    enadv: "struct_RoleAdvance", /* energy advancement */

    /* night vision range */
    /* X-ray vision range */

    /*** Properties in variable-length arrays ***/
    /* intrinsics (see attrib.c) */

    /*** Don't forget to add... ***/
    /* quest leader, guardians, nemesis (monst.c) */
    /* quest dungeon definition (dat/Xyz.dat) */
    /* quest text (dat/quest.txt) */
    /* dictionary entries (dat/data.bas) */
});

/*** Unified structure specifying gender information ***/
export const struct_Gender = struct("struct_Gender", {
    adj: ptr_to(char), /* male/female/neuter */
    he: ptr_to(char), /* he/she/it */
    him: ptr_to(char), /* him/her/it */
    his: ptr_to(char), /* his/her/its */
    filecode: ptr_to(char), /* file code */
    allow: short, /* equivalent ROLE_ mask */
});
export const ROLE_GENDERS = 2;

/* pronoun_gender() flag masks */

export const PRONOUN_NO_IT = 1;
export const PRONOUN_HALLU = 2;

/*** Unified structure specifying alignment information ***/
export const struct_Align = struct("struct_Align", {
    noun: ptr_to(char), /* law/balance/chaos */
    adj: ptr_to(char), /* lawful/neutral/chaotic */
    filecode: ptr_to(char), /* file code */
    allow: short, /* equivalent ROLE_ mask */
    value: aligntyp, /* equivalent A_ value */
});
export const ROLE_ALIGNS = 3;

/* table of available alignments */

    export const TT_NONE = 0;
    export const TT_BEARTRAP = 1;
    export const TT_PIT = 2;
    export const TT_WEB = 3;
    export const TT_LAVA = 4;
    export const TT_INFLOOR = 5;
    export const TT_BURIEDBALL = 6;

    export const UTOTYPE_NONE = 0x00;
    export const UTOTYPE_ATSTAIRS = 0x01;
    export const UTOTYPE_FALLING = 0x02;
    export const UTOTYPE_PORTAL = 0x04;
    export const UTOTYPE_RMPORTAL = 0x10; /* remove portal */
    export const UTOTYPE_DEFERRED = 0x20; /* deferred_goto */

/*** Information about the player ***/
export const SICK_VOMITABLE = 0x01; export const SICK_NONVOMITABLE = 0x02; export const SICK_ALL = 0x03; export const BC_BALL = 0x01; export const BC_CHAIN = 0x02; export const RIGHT_HANDED = 0x00; export const LEFT_HANDED = 0x01; export const CONVERT = 2; export const A_ORIGINAL = 1; export const A_CURRENT = 0; export const LUCKADD = 3; export const LUCKMAX = 10; export const LUCKMIN = (-10); export const AC_MAX = 99; export const struct_you = struct("struct_you", {
    ux: coordxy, uy: coordxy, /* current map coordinates */
    dx: int, dy: int, dz: int, /* x,y,z deltas; direction of move (or zap or ... )
                         * usually +1 or 0 or -1 */
    tx: coordxy, ty: coordxy, /* destination of travel */
    ux0: coordxy, uy0: coordxy, /* previous ux,uy */
    uz: "struct_d_level", uz0: "struct_d_level", /* your level on this and the previous turn */
    utolev: "struct_d_level", /* level monster teleported you to, or uz */
    utotype: uchar, /* bitmask of goto_level() flags for utolev */
    ucamefrom: "struct_d_level", /* level where you came from; used for tutorial */
    umoved: boolean, /* changed map location (post-move) */
    last_str_turn: int, /* 0: none, 1: half turn, 2: full turn
                         * +: turn right, -: turn left */
    ulevel: int, /* 1 to MAXULEV (30) */
    ulevelmax: int, /* highest level, but might go down (to throttle
                         * lost level recovery via blessed full healing) */
    ulevelpeak: int, /* really highest level reached; never does down */
    utrap: unsigned, /* trap timeout */
    utraptype: unsigned, /* defined if utrap nonzero. one of utraptypes */
    urooms: array_of(char, 5), /* rooms (roomno + 3) occupied now */
    urooms0: array_of(char, 5), /* ditto, for previous position */
    uentered: array_of(char, 5), /* rooms (roomno + 3) entered this turn */
    ushops: array_of(char, 5), /* shop rooms (roomno + 3) occupied now */
    ushops0: array_of(char, 5), /* ditto, for previous position */
    ushops_entered: array_of(char, 5), /* ditto, shops entered this turn */
    ushops_left: array_of(char, 5), /* ditto, shops exited this turn */

    uhunger: int, /* refd only in eat.c and shk.c (also insight.c) */
    uhs: unsigned, /* hunger state - see eat.c */

    uprops: array_of("struct_prop", LAST_PROP + 1),

    umconf: unsigned,
    usick_type: Bitfield(2),

    /* These ranges can never be more than MAX_RANGE (vision.h). */
    nv_range: int, /* current night vision range */
    xray_range: int, /* current xray vision range */
    unblind_telepat_range: int,

/*
 * These variables are valid globally only when punished and blind.
 */

    bglyph: int, /* glyph under the ball */
    cglyph: int, /* glyph under the chain */
    bc_order: int, /* ball & chain order [see bc_order() in ball.c] */
    bc_felt: int, /* mask for ball/chain being felt */

    umonster: int, /* hero's "real" monster num */
    umonnum: int, /* current monster number */

    mh: int, mhmax: int, /* current and max hit points when polyd */
        mtimedone: int, /* no. of turns until polymorph times out */
    macurr: "struct_attribs", /* for monster attribs */
                   mamax: "struct_attribs", /* for monster attribs */
    ulycn: int, /* lycanthrope type */

    ucreamed: unsigned,
    uswldtim: unsigned, /* time you have been swallowed */

    uswallow: Bitfield(1), /* true if swallowed */
    uinwater: Bitfield(1), /* if you're currently in water (only
                                   underwater possible currently) */
    uundetected: Bitfield(1), /* if you're a hiding monster/piercer */
    mfemale: Bitfield(1), /* saved human value of flags.female */
    uinvulnerable: Bitfield(1), /* you're invulnerable (praying) */
    uburied: Bitfield(1), /* you're buried */
    uedibility: Bitfield(1), /* blessed food detect; sense unsafe food */
    uhandedness: Bitfield(1), /* There is no advantage for either handedness.
                                 The distinction is only for flavor variation
                                 and for use in messages. */

    udg_cnt: unsigned, /* how long you have been demigod */
    uevent: "struct_u_event", /* certain events have happened */
    uhave: "struct_u_have", /* you're carrying special objects */
    uconduct: "struct_u_conduct", /* KMH, conduct */
    uroleplay: "struct_u_roleplay",
    acurr: "struct_attribs", /* your current attributes (eg. str)*/
                    aexe: "struct_attribs", /* for gain/loss via "exercise" */
                    abon: "struct_attribs", /* your bonus attributes (eg. str) */
                    amax: "struct_attribs", /* your max attributes (eg. str) */
                   atemp: "struct_attribs", /* used for temporary loss/gain */
                   atime: "struct_attribs", /* used for loss/gain countdown */
    ualign: "struct_align", /* character alignment */

    ualignbase: array_of(schar, CONVERT), /* for ualign conversion record */
    uluck: schar, moreluck: schar, /* luck and luck bonus */

    uhitinc: schar,
    udaminc: schar,
    uac: schar,

    uspellprot: uchar, /* protection by SPE_PROTECTION */
    usptime: uchar, /* #moves until uspellprot-- */
    uspmtime: uchar, /* #moves between uspellprot-- */
    uhp: int, uhpmax: int, /* hit points, aka health */
        uhppeak: int, /* highest value of uhpmax so far */
    uen: int, uenmax: int, /* magical energy, aka spell power */
        uenpeak: int, /* highest value of uenmax so far */
    uhpinc: array_of(short, MAXULEV), /* increases to uhpmax for each level gain */
          ueninc: array_of(short, MAXULEV), /* increases to uenmax for each level gain */
    ugangr: int, /* if the gods are angry at you */
    ugifts: int, /* number of artifacts bestowed */
    ublessed: int, ublesscnt: int, /* blessing/duration from #pray */
    umoney0: long,
    uspare1: long,
    uexp: long, urexp: long, /* exper pts for gaining levels and for score */
    ucleansed: long, /* to record moves when player was cleansed */
    usleep: long, /* sleeping; monstermove you last started */
    uinvault: int,
    ustuck: ptr_to("struct_monst"), /* engulfer or grabber, maybe grabbee if Upolyd */
    usteed: ptr_to("struct_monst"), /* mount when riding */
    ustuck_mid: unsigned, /* u.ustuck->m_id, used during save/restore */
    usteed_mid: unsigned, /* u.usteed->m_id, used during save/restore */
    ugallop: long, /* turns steed will run after being kicked */
    urideturns: int, /* time spent riding, for skill advancement */
    umortality: int, /* how many times you died */
    ugrave_arise: int, /* you die and become something aside from a ghost */
    weapon_slots: int, /* unused skill slots */
    skills_advanced: int, /* # of advances made so far */
    skill_record: array_of(short, P_SKILL_LIMIT), /* skill advancements */
    weapon_skills: array_of("struct_skills", P_NUM_SKILLS),
    twoweap: boolean, /* KMH -- Using two-weapon combat */
    mcham: short, /* vampire mndx if shapeshifted to bat/cloud */
    umovement: short, /* instead of youmonst.movement */
    uachieved: array_of(schar, N_ACH), /* list of achievements in the order attained */
    umonst: ptr_to("struct_monst"), /* for future conversion of &gy.youmonst to u.umonst */
}); /* end of `struct you' */

/* _hitmon_data: Info for when hero hits a monster */
/* The basic reason we need all these booleans is that we don't want
 * a "hit" message when a monster dies, so we have to know how much
 * damage it did _before_ outputting a hit message, but any messages
 * associated with the damage don't come out until _after_ outputting
 * a hit message.
 *
 * More complications:  first_weapon_hit() should be called before
 * xkilled() in order to have the gamelog messages in the right order.
 * So it can't be deferred until end of known_hitum() as was originally
 * done.
 */
export const struct__hitmon_data = struct("struct__hitmon_data", {
    dmg: int, /* damage */
    thrown: int,
    twohits: int, /* 0: 1 of 1; 1: 1 of 2; 2: 2 of 2 */
    dieroll: int,
    mdat: ptr_to("struct_permonst"),
    use_weapon_skill: boolean,
    train_weapon_skill: boolean,
    barehand_silver_rings: int,
    silvermsg: boolean,
    silverobj: boolean,
    lightobj: boolean,
    material: int,
    jousting: int,
    hittxt: boolean,
    get_dmg_bonus: boolean,
    unarmed: boolean,
    hand_to_hand: boolean,
    ispoisoned: boolean,
    unpoisonmsg: boolean,
    needpoismsg: boolean,
    poiskilled: boolean,
    already_killed: boolean,
    offmap: boolean,
    destroyed: boolean,
    dryit: boolean,
    doreturn: boolean,
    retval: boolean,
    saved_oname: array_of(char, BUFSZ),
});

import { aligntyp } from "./align.h.js";
import { A_MAX } from "./attrib.h.js";
import { BUFSZ, MAXULEV, boolean, coordxy, xint16 } from "./global.h.js";
import { LAST_PROP } from "./prop.h.js";
import { P_NUM_SKILLS, P_SKILL_LIMIT } from "./skills.h.js";
import { char, int, long, schar, short, uchar, unsigned } from "../rt/ctypes.js";
import { Bitfield, array_of, ptr_to, struct } from "../rt/struct.js";
