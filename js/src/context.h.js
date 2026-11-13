/* NetHack 5.0	context.h	$NHDT-Date: 1753856387 2025/07/29 22:19:47 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.58 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2006. */
/* NetHack may be freely redistributed.  See license for details. */

/* If you change the context structure make sure you increment EDITLEVEL in */
/* patchlevel.h if needed. */

export const CONTEXTVERBSZ = 30;

    export const TIP_ENHANCE = 0; /* #enhance */
    export const TIP_SWIM = TIP_ENHANCE + 1; /* walking into water */
    export const TIP_UNTRAP_MON = TIP_SWIM + 1; /* walking into trapped peaceful */
    export const TIP_GETPOS = TIP_UNTRAP_MON + 1; /* getpos/farlook */

    export const NUM_TIPS = TIP_GETPOS + 1;

/*
 * The context structure houses things that the game tracks
 * or adjusts during the game, to preserve game state or context.
 *
 * The entire structure is saved with the game.
 *
 */

export const struct_dig_info = struct("struct_dig_info", { /* apply.c, hack.c */
    effort: int,
    level: "struct_d_level",
    pos: "struct_nhcoord",
    lastdigtime: long,
    down: boolean, chew: boolean, warned: boolean, quiet: boolean,
});

export const struct_tin_info = struct("struct_tin_info", {
    tin: ptr_to("struct_obj"),
    o_id: unsigned, /* o_id of tin in save file */
    usedtime: int, reqtime: int,
});

export const struct_book_info = struct("struct_book_info", {
    book: ptr_to("struct_obj"), /* last/current book being xscribed */
    o_id: unsigned, /* o_id of book in save file */
    delay: schar, /* moves left for this spell */
});

export const struct_takeoff_info = struct("struct_takeoff_info", {
    mask: long,
    what: long,
    delay: int,
    cancelled_don: boolean,
    disrobing: array_of(char, CONTEXTVERBSZ + 1),
});

export const struct_victual_info = struct("struct_victual_info", {
    piece: ptr_to("struct_obj"), /* the thing being eaten, or last thing that
                        * was partially eaten, unless that thing was
                        * a tin, which uses the tin structure above,
                        * in which case this should be 0 */
    o_id: unsigned, /* o_id of food object in save file */
    /* doeat() initializes these when piece is valid */
    usedtime: int, /* turns spent eating */
        reqtime: int, /* turns required to eat */
    nmod: int, /* coded nutrition per turn */
    canchoke: Bitfield(1), /* was satiated at beginning */

    /* start_eating() initializes these */
    fullwarn: Bitfield(1), /* have warned about being full */
    eating: Bitfield(1), /* victual currently being eaten */
    doreset: Bitfield(1), /* stop eating at end of turn */
});

export const struct_engrave_info = struct("struct_engrave_info", {
    text: array_of(char, BUFSZ), /* actual text being engraved - doengrave() handles all
                           the possible mutations of this */
    nextc: ptr_to(char), /* next character(s) in text[] to engrave */
    stylus: ptr_to("struct_obj"), /* object doing the writing */
    type: xint8, /* type of engraving (DUST, MARK, etc) */
    pos: "struct_nhcoord", /* location the engraving is being placed on */
    actionct: int, /* nth turn spent engraving */
});

export const struct_warntype_info = struct("struct_warntype_info", {
    obj: ulong, /* object warn_of_mon monster type M2 */
    polyd: ulong, /* warn_of_mon monster type M2 due to poly */
    species: ptr_to("struct_permonst"), /* particular species due to poly */
    speciesidx: short, /* index of above in mons[] (for save/restore) */
});

export const struct_polearm_info = struct("struct_polearm_info", {
    hitmon: ptr_to("struct_monst"), /* the monster we tried to hit last */
    m_id: unsigned, /* monster id of hitmon, in save file */
});

export const struct_obj_split = struct("struct_obj_split", {
    parent_oid: unsigned, /* set: splitobj(),         */
             child_oid: unsigned, /* reset: clear_splitobjs() */
});

export const struct_tribute_info = struct("struct_tribute_info", {
    tributesz: unsigned, /* make it possible to skip this in future */
    enabled: boolean, /* Do we have tributes turned on? */
    bookstock: Bitfield(1), /* Have we stocked the book? */
    Deathnotice: Bitfield(1), /* Did Death notice the book? */
    /* Markers for other tributes can go here */
    /* 30 free bits */
});

export const struct_novel_tracking = struct("struct_novel_tracking", { /* for choosing random passage when reading novel */
    id: unsigned, /* novel oid from previous passage selection */
    count: int, /* number of passage indices available in pasg[] */
    pasg: array_of(schar, 30), /* pasg[0..count-1] are passage indices */
    /* tribute file is allowed to have more than 30 passages for a novel;
       if it does, reading will first choose a random subset of 30 of them;
       reading all 30 or switching to a different novel and then back again
       will pick a new subset, independent of previous ones so might not
       contain all--or even any--of the ones left out of the prior subset;
       chatting with Death works the same as reading a novel except that
       sometimes he delivers one of a few hardcoded messages rather than a
       passage from the Death Quotes section of dat/tribute */
});

export const struct_achievement_tracking = struct("struct_achievement_tracking", {
    mines_prize_oid: unsigned, /* luckstone->o_id */
             soko_prize_oid: unsigned, /* {bag or amulet}->o_id */
             castle_prize_old: unsigned, /* wand->o_id; not yet implemented */
    /* record_achievement() wants the item type for livelog() event */
    mines_prize_otyp: short, /* luckstone */
             soko_prize_otyp: short, /* bag of holding or amulet of reflection */
             castle_prize_otyp: short, /* strange object (someday wand of wishing) */
    minetn_reached: boolean, /* avoid redundant checking for town entry */
});

export const struct_lifelists = struct("struct_lifelists", {
    total_seen_upclose: long, /* count of critters seen up close */
    total_photographed: long, /* count of critters photographed (tourists) */
});

export const struct_context_info = struct("struct_context_info", {
    ident: unsigned, /* social security number for each monster */
    no_of_wizards: unsigned, /* 0, 1 or 2 (wizard and his shadow) */
    run: unsigned, /* 0: h (etc), 1: H (etc), 2: fh (etc),
                             * 3: FH, 4: ff+, 5: ff-, 6: FF+, 7: FF-,
                             * 8: travel */
    startingpet_mid: unsigned, /* monster id number for initial pet */
    current_fruit: int, /* fruit->fid corresponding to svp.pl_fruit[] */
    mysteryforce: int, /* adjusts how often "mysterious force" kicks in */
    rndencode: int, /* randomized escape sequence introducer */
    startingpet_typ: int, /* monster type for initial pet */
    warnlevel: int, /* threshold (digit) to warn about unseen mons */
    next_attrib_check: long, /* next attribute check */
    seer_turn: long, /* when random clairvoyance will next kick in */
    snickersnee_turn: long, /* Snickersnee last used to distance attack */
    stethoscope_seq: long, /* when a stethoscope was last used; first use
                             * during a move takes no time, second uses move */
    travel: boolean, /* find way automatically to u.tx,u.ty */
    travel1: boolean, /* first travel step */
    forcefight: boolean,
    nopick: boolean, /* do not pickup objects (as when running) */
    made_amulet: boolean,
    mon_moving: boolean, /* monsters' turn to move */
    move: boolean,
    mv: boolean,
    bypasses: boolean, /* bypass flag is set on at least one fobj */
    door_opened: boolean, /* set to true if door was opened during test_move */
    resume_wish: boolean, /* game was exited while in wish prompt */
    tips: ulong,
    digging: "struct_dig_info",
    victual: "struct_victual_info",
    engraving: "struct_engrave_info",
    tin: "struct_tin_info",
    spbook: "struct_book_info",
    takeoff: "struct_takeoff_info",
    warntype: "struct_warntype_info",
    polearm: "struct_polearm_info",
    objsplit: "struct_obj_split", /* track most recently split object stack */
    tribute: "struct_tribute_info",
    novel: "struct_novel_tracking",
    achieveo: "struct_achievement_tracking",
    lifelist: "struct_lifelists",
    jingle: array_of(char, 5 + 1),
});

import { BUFSZ, boolean, xint8 } from "./global.h.js";
import { char, int, long, schar, short, ulong, unsigned } from "../rt/ctypes.js";
import { Bitfield, array_of, ptr_to, struct } from "../rt/struct.js";
