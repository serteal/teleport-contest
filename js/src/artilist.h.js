/* NetHack 5.0  artilist.h      $NHDT-Date: 1710957374 2024/03/20 17:56:14 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.30 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2017. */
/* NetHack may be freely redistributed.  See license for details. */

/* in makedefs.c, all we care about is the list of names */

/* in artifact.c, set up the actual artifact list structure;
   color field is for an artifact when it glows, not for the item itself */

/* clang-format off */

/* clang-format on */

    /* Artifact cost rationale:
     * 1.  The more useful the artifact, the better its cost.
     * 2.  Quest artifacts are highly valued.
     * 3.  Chaotic artifacts are inflated due to scarcity (and balance).
     *
     * Artifact gen_spe rationale:
     * 1.  If the artifact is useful against most enemies, +0.
     * 2.  If the artifact is useful against only a few enemies, usually +2.
     *     This gives the artifact use to early-game characters who receive
     *     it as a gift or find it on the ground.
     * 3.  Role gift gen_spe is chosen to balance against the role's
     *     default starting weapon (it should be better, but need not be
     *     much better).
     * 4.  This can be modified as required for special cases.
     *     (In some cases, like Excalibur, the value is irrelevant.)
     * 5.  Nonweapon spe may have a special meaning, so gen_spe for
     *     nonweapons must always be 0.
     *
     * Artifact gift_value is chosen so that "endgame-quality" artifacts are
     * not gifted in the early game (so that characters don't grind on an
     * altar early-game until they have their endgame weapon, then use it to
     * carry them through the game).  Those artifacts have values ranging from
     * around 8 to 10, based on how good the artifact is.  Less powerful
     * artifacts have values in the 1 to 5 range.  Values in between are used
     * for conditionally good artifacts.  (Note that the value of a gift is
     * normally 1 higher than the difficulty of the monster.)
     */

    /*  dummy element #0, so that all interesting indices are non-zero */
    export const ART_NONARTIFACT = 0;

    export const ART_EXCALIBUR = ART_NONARTIFACT + 1;

    /*
     *      Stormbringer only has a 2 because it can drain a level,
     *      providing 8 more.
     */
    export const ART_STORMBRINGER = ART_EXCALIBUR + 1;

    /*
     *      Mjollnir can be thrown when wielded if hero has 25 Strength
     *      (usually via gauntlets of power but possible with rings of
     *      gain strength).  If the thrower is a Valkyrie, Mjollnir will
     *      usually (99%) return and then usually (separate 99%) be caught
     *      and automatically be re-wielded.  When returning Mjollnir is
     *      not caught, there is a 50:50 chance of hitting hero for damage
     *      and its lightning shock might destroy some wands and/or rings.
     *
     *      Monsters don't throw Mjollnir regardless of strength (not even
     *      fake-player valkyries).
     */
    export const ART_MJOLLNIR = ART_STORMBRINGER + 1; /* Mjo:llnir */

    export const ART_CLEAVER = ART_MJOLLNIR + 1;

    /*
     *      Grimtooth glows in warning when elves are present, but its
     *      damage bonus applies to all targets rather than just elves
     *      (handled as special case in spec_dbon()).
     */
    export const ART_GRIMTOOTH = ART_CLEAVER + 1;

    /*
     *      Orcrist and Sting have same alignment as elves.
     *
     *      The combination of SPFX_WARN+SPFX_DFLAG2+M2_value will trigger
     *      EWarn_of_mon for all monsters that have the M2_value flag.
     *      Sting and Orcrist will warn of M2_ORC monsters.
     */
    export const ART_ORCRIST = ART_GRIMTOOTH + 1;

      /* actually light blue */

    export const ART_STING = ART_ORCRIST + 1;

    /*
     *      Magicbane is a bit different!  Its magic fanfare
     *      unbalances victims in addition to doing some damage.
     */
    export const ART_MAGICBANE = ART_STING + 1;

    export const ART_FROST_BRAND = ART_MAGICBANE + 1;

    export const ART_FIRE_BRAND = ART_FROST_BRAND + 1;

    export const ART_DRAGONBANE = ART_FIRE_BRAND + 1;

    export const ART_DEMONBANE = ART_DRAGONBANE + 1;

    export const ART_WEREBANE = ART_DEMONBANE + 1;

    export const ART_GRAYSWANDIR = ART_WEREBANE + 1;

    export const ART_GIANTSLAYER = ART_GRAYSWANDIR + 1;

    export const ART_OGRESMASHER = ART_GIANTSLAYER + 1;

    export const ART_TROLLSBANE = ART_OGRESMASHER + 1;

    /*
     *      Two problems:  1) doesn't let trolls regenerate heads,
     *      2) doesn't give unusual message for 2-headed monsters (but
     *      allowing those at all causes more problems than worth the effort).
     */
    export const ART_VORPAL_BLADE = ART_TROLLSBANE + 1;

    /*
     *      Ah, never shall I forget the cry,
     *              or the shriek that shrieked he,
     *      As I gnashed my teeth, and from my sheath
     *              I drew my Snickersnee!
     *                      --Ko-Ko, Lord high executioner of Titipu
     *                        (From Sir W.S. Gilbert's "The Mikado")
     */
    export const ART_SNICKERSNEE = ART_VORPAL_BLADE + 1;

    /* Sunsword emits light when wielded (handled in the core rather than
       via artifact fields), but that light has no particular color */
    export const ART_SUNSWORD = ART_SNICKERSNEE + 1;

    /*
     *      The artifacts for the quest dungeon, all self-willed.
     *      gen_spe should be 0; gift_value irrelevant and set to 12.
     */

    export const ART_ORB_OF_DETECTION = ART_SUNSWORD + 1;

    export const ART_HEART_OF_AHRIMAN = ART_ORB_OF_DETECTION + 1;

      /* this stone does double damage if used as a projectile weapon */

    export const ART_SCEPTRE_OF_MIGHT = ART_HEART_OF_AHRIMAN + 1;

    export const ART_STAFF_OF_AESCULAPIUS = ART_SCEPTRE_OF_MIGHT + 1;

    export const ART_MAGIC_MIRROR_OF_MERLIN = ART_STAFF_OF_AESCULAPIUS + 1;

    export const ART_EYES_OF_THE_OVERWORLD = ART_MAGIC_MIRROR_OF_MERLIN + 1;

    export const ART_MITRE_OF_HOLINESS = ART_EYES_OF_THE_OVERWORLD + 1;

    export const ART_LONGBOW_OF_DIANA = ART_MITRE_OF_HOLINESS + 1;

    /* MKoT has an additional carry property if the Key is not cursed (for
       rogues) or blessed (for non-rogues):  #untrap of doors and chests
       will always find any traps and disarming those will always succeed */
    export const ART_MASTER_KEY_OF_THIEVERY = ART_LONGBOW_OF_DIANA + 1;

    export const ART_TSURUGI_OF_MURAMASA = ART_MASTER_KEY_OF_THIEVERY + 1;

    export const ART_YENDORIAN_EXPRESS_CARD = ART_TSURUGI_OF_MURAMASA + 1;

    export const ART_ORB_OF_FATE = ART_YENDORIAN_EXPRESS_CARD + 1;

    export const ART_EYE_OF_THE_AETHIOPICA = ART_ORB_OF_FATE + 1; export const AFTER_LAST_ARTIFACT = ART_EYE_OF_THE_AETHIOPICA + 1;

    /*
     *  terminator; otyp must be zero
     */

/* artilist[] (or artifact_names[]) */

/*artilist.h*/
