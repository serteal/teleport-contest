/* NetHack 5.0	sndprocs.h	$NHDT-Date: 1725653015 2024/09/06 20:03:35 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.26 $ */
/* Copyright (c) Michael Allison, 2022                                */
/* NetHack may be freely redistributed.  See license for details. */

    export const soundlib_nosound = 0;

    export const soundlib_notused = soundlib_nosound + 1;

export const struct_sound_procs = struct("struct_sound_procs", {
    soundname: ptr_to(char),
    soundlib_id: unsigned,
    sound_triggers: ulong, /* capabilities in the port */
    sound_init_nhsound: fnptr_t,
    sound_exit_nhsound: fnptr_t,
    sound_achievement: fnptr_t,
    sound_soundeffect: fnptr_t,

                                 sound_hero_playnotes: fnptr_t,
    sound_play_usersound: fnptr_t,

                           sound_ambience: fnptr_t,

                         sound_verbal: fnptr_t,
});

export const struct_sound_voice = struct("struct_sound_voice", {
    serialno: int,
    gender: int,
    tone: int,
    volume: int,
    moreinfo: int,
    mon: ptr_to("struct_monst"),
    nameid: ptr_to(char),
});

/*
 * Types of triggers
 */

                            /* 26 free bits */

/* subset for NetHack */

    export const ins_cello = 43; export const ins_orchestral_harp = 47; export const ins_choir_aahs = 53;
    export const ins_trumpet = 57; export const ins_trombone = 58; export const ins_french_horn = 61;
    export const ins_baritone_sax = 68; export const ins_english_horn = 70; export const ins_piccolo = 73;
    export const ins_flute = 74; export const ins_pan_flute = 76; export const ins_blown_bottle = 77;
    export const ins_whistle = 79; export const ins_tinkle_bell = 113; export const ins_woodblock = 116;
    export const ins_taiko_drum = 117; export const ins_melodic_tom = 118; export const ins_seashore = 123;
    export const ins_no_instrument = ins_seashore + 1;

    /* accessibility */

/*
Arguments for sound_achievement(schar arg1, schar arg2, int32_t aflags)

Arguments for actual achievements, those in you.h,
        arg1 = the achievement value.
        arg2 = 0 (irrelevant).
      aflags = 0 for first time, 1 for repeat.

These next ones make use of arg2, and aflags may be
filled with additional int values dependent on arg2.
arg1 must always be 0 for these.

SoundAchievement(0, sa2_splashscreen, 0);
SoundAchievement(0, sa2_newgame_nosplash, 0);
SoundAchievement(0, sa2_restoregame, 0);
SoundAchievement(0, sa2_levelup, level);
SoundAchievement(0, sa2_xpleveldown, level);
*/

/* shortcut for conditional code in other files */

/* Player's perspective, not the hero's; no Deaf suppression */

/* Player's perspective, not the hero's; no Deaf suppression */

/* sound_speak is in sound.c */

/* set_voice is in sound.c */

/*  void (*sound_achievement)(schar, schar, int32_t); */

    export const sff_default = 0; /* add dir prefix + '/' + sound + suffix */
    export const sff_base_only = sff_default + 1; /* base sound name only, no dir, no suffix */
    export const sff_havedir_append_rest = sff_base_only + 1; /* dir provided, append base sound name+suffix */
    export const sff_baseknown_add_rest = sff_havedir_append_rest + 1; /* base is already known, add dir and suffix */

import { char, int, ulong, unsigned } from "../rt/ctypes.js";
import { fnptr_t, ptr_to, struct } from "../rt/struct.js";
