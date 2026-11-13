/* NetHack 5.0	weight.h	$NHDT-Date: 1742427965 2025/03/19 23:46:05 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $ */
/* Copyright (c) Michael Allison, 2025. */
/* NetHack may be freely redistributed.  See license for details. */

/* weight-related constants and thresholds */

    export const WT_ETHEREAL = 0;
    export const WT_SPLASH_THRESHOLD = 9; /* weight needed to make splash in water */
    export const WT_WEIGHTCAP_STRCON = 25; /* str + con multiplied by this for conv to
                                   * carrying capacity in weight_cap() */
    export const WT_WEIGHTCAP_SPARE = 50; /* used in weight_cap calc */
    export const WT_JELLY = 50; /* weight of jelly body */
    export const WT_WOUNDEDLEG_REDUCT = 100; /* wounded legs reduce carrcap by this */
    export const WT_TO_DMG = 100; /* divisor to convert weight to dmg amt */
    export const WT_IRON_BALL_INCR = 160; /* weight increment of heavy iron ball */
    export const WT_IRON_BALL_BASE = 480; /* base starting weight of iron ball */
    export const WT_NOISY_INV = 500; /* inv_weight() max for noisy fumbling */
    export const WT_NYMPH = 600; /* weight of nymph body */
    export const WT_TOOMUCH_DIAGONAL = 600; /* weight_cap threshold for diag squeeze */
    export const WT_ELF = 800; /* weight of elf body */
    export const WT_SQUEEZABLE_INV = 850; /* inv_weight() maximum for squeezing */
    export const MAX_CARR_CAP = 1000; /* max carrying capacity, so that
                                   * boulders can be heavier */
    export const WT_HUMAN = 1450; /* weight of human body */
    export const WT_BABY_DRAGON = 1500; /* weight of baby dragon body */
    export const WT_DRAGON = 4500; /* weight of dragon body */
