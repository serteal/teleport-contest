/* NetHack 5.0	read.c	$NHDT-Date: 1762577372 2025/11/07 20:49:32 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.323 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2012. */
/* NetHack may be freely redistributed.  See license for details. */

export function Your_Own_Role(mndx) { return +(mndx == gu.urole.mnum); }
export function Your_Own_Race(mndx) { return +(mndx == gu.urace.mnum); }

function learnscrolltyp(scrolltyp) { /* boolean */
    if (!objects[scrolltyp].oc_name_known) {
        makeknown(scrolltyp);
        more_experienced(0, 10);
        return TRUE;
    } else
        return FALSE;
}

/* also called from teleport.c for scroll of teleportation */
export function learnscroll(sobj) { /* void */
    /* it's implied that sobj->dknown is set;
       we couldn't be reading this scroll otherwise */
    if (sobj.oclass != SPBOOK_CLASS)
        learnscrolltyp(sobj.otyp);
}

/* max spe is +99, min is -99 */
function cap_spe(obj) { /* void */
    if (obj) {
        if (abs(obj.spe) > SPE_LIM)
            obj.spe = sgn(obj.spe) * SPE_LIM;
    }
}

function erode_obj_text(otmp, buf) { /* char * */
    let erosion = greatest_erosion(otmp);

    if (erosion)
        wipeout_text(buf, int(Math.trunc(unsigned(Math.imul(strlen(buf), unsigned(erosion))) / (2 * MAX_ERODE))),
                     unsigned(otmp.o_id ^ unsigned(ubirthday)));
    return buf;
}

export function tshirt_text(tshirt, buf) { /* char * */
    let shirt_msgs = static_array("tshirt_text.shirt_msgs", ptr_to(char), null, [
        /* Scott Bigham */
      _("I explored the Dungeons of Doom and all I got was this lousy T-shirt!"),
        _("Is that Mjollnir in your pocket or are you just happy to see me?"),
      _("It's not the size of your sword, it's how #enhance'd you are with it."),
        _("Madame Elvira's House O' Succubi Lifetime Customer"),
        _("Madame Elvira's House O' Succubi Employee of the Month"),
        _("Ludios Vault Guards Do It In Small, Dark Rooms"),
        _("Yendor Military Soldiers Do It In Large Groups"),
        _("I survived Yendor Military Boot Camp"),
        _("Ludios Accounting School Intra-Mural Lacrosse Team"),
        _("Oracle(TM) Fountains 10th Annual Wet T-Shirt Contest"),
        _("Hey, black dragon!  Disintegrate THIS!"),
        _("I'm With Stupid -->"),
        _("Don't blame me, I voted for Izchak!"),
        _("Don't Panic"), /* HHGTTG */
        _("Furinkan High School Athletic Dept."),                /* Ranma 1/2 */
        _("Hel-LOOO, Nurse!"),                                   /* Animaniacs */
        _("=^.^="),
        _("100% goblin hair - do not wash"),
        _("Aberzombie and Fitch"),
        _("cK -- Cockatrice touches the Kop"),
        _("Don't ask me, I only adventure here"),
        _("Down with pants!"),
        _("d, your dog or a killer?"),
        _("FREE PUG AND NEWT!"),
        _("Go team ant!"),
        _("Got newt?"),
        _("Hello, my darlings!"), /* Charlie Drake */
        _("Hey!  Nymphs!  Steal This T-Shirt!"),
        _("I <3 Dungeon of Doom"),
        _("I <3 Maud"),
        /* note: there is a similarly worded apron (alchemy smock) slogan */
        _("I am a Valkyrie.  If you see me running, try to keep up."),
        _("I am not a pack rat - I am a collector"),
        _("I bounced off a rubber tree"),         /* Monkey Island */
        _("Plunder Island Brimstone Beach Club"), /* Monkey Island */
        _("If you can read this, I can hit you with my polearm"),
        _("I'm confused!"),
        _("I scored with the princess"),
        _("I want to live forever or die in the attempt."),
        _("Lichen Park"),
        _("LOST IN THOUGHT - please send search party"),
        _("Meat is Mordor"),
        _("Minetown Better Business Bureau"),
        _("Minetown Watch"),
        /* Discworld riff; unfortunately long */
        _(("Ms. Palm's House of Negotiable Affection--A Very Reputable" +
            " House Of Disrepute")),
        _("Protection Racketeer"),
        _("Real men love Crom"),
        _("Somebody stole my Mojo!"),
        _("The Hellhound Gang"),
        _("The Werewolves"),
        _("They Might Be Storm Giants"),
        _("Weapons don't kill people, I kill people"),
        _("White Zombie"),
        _("You're killing me!"),
        _("Anhur State University - Home of the Fighting Fire Ants!"),
        _("FREE HUGS"),
        _("Serial Ascender"),
        _("Real men are valkyries"),
        _("Young Men's Cavedigging Association"),
        _("Occupy Fort Ludios"),
        _("I couldn't afford this T-shirt so I stole it!"),
        _("Mind flayers suck"),
        _("I'm not wearing any pants"),
        _("Down with the living!"),
        _("Pudding farmer"),
        _("Vegetarian"),
        _("Hello, I'm War!"),
        _("It is better to light a candle than to curse the darkness"),
        _("It is easier to curse the darkness than to light a candle"),
        /* expanded "rock--paper--scissors" featured in TV show "Big Bang
           Theory" although they didn't create it (and an actual T-shirt
           with pentagonal diagram showing which choices defeat which) */
        _("rock--paper--scissors--lizard--Spock!"),
        /* "All men must die -- all men must serve" challenge and response
           from book series _A_Song_of_Ice_and_Fire_ by George R.R. Martin,
           TV show "Game of Thrones" (probably an actual T-shirt too...) */
        _("/Valar morghulis/ -- /Valar dohaeris/"),
    ]);

    strcpy(buf, shirt_msgs[tshirt.o_id % SIZE(shirt_msgs)]);
    return erode_obj_text(tshirt, buf);
}

export function hawaiian_motif(shirt, buf) { /* char * */
    let hawaiian_motifs = static_array("hawaiian_motif.hawaiian_motifs", ptr_to(char), null, [
        /* birds */
        _("flamingo"),
        _("parrot"),
        _("toucan"),
        _("bird of paradise"), /* could be a bird or a flower */
        /* sea creatures */
        _("sea turtle"),
        _("tropical fish"),
        _("jellyfish"),
        _("giant eel"),
        _("water nymph"),
        /* plants */
        _("plumeria"),
        _("orchid"),
        _("hibiscus flower"),
        _("palm tree"),
        /* other */
        _("hula dancer"),
        _("sailboat"),
        _("ukulele"),
    ]);

    /* a tourist's starting shirt always has the same o_id; we need some
       additional randomness or else its design will never differ */
    let motif = unsigned(shirt.o_id ^ unsigned(ubirthday));

    strcpy(buf, hawaiian_motifs[motif % SIZE(hawaiian_motifs)]);
    return buf;
}

function hawaiian_design(shirt, buf) { /* char * */
    let hawaiian_bgs = static_array("hawaiian_design.hawaiian_bgs", ptr_to(char), null, [
        /* solid colors */
        _("purple"),
        _("yellow"),
        _("red"),
        _("blue"),
        _("orange"),
        _("black"),
        _("green"),
        /* adjectives */
        _("abstract"),
        _("geometric"),
        _("patterned"),
        _("naturalistic"),
    ]);

    /* This hash method is slightly different than the one in hawaiian_motif;
       using the same formula in both cases may lead to some shirt combos
       never appearing, if the sizes of the two lists have common factors. */
    let bg = unsigned(shirt.o_id ^ unsigned(not64(ubirthday)));

    sprintf(buf, _("%s on %s background"), makeplural(hawaiian_motif(shirt, buf)), an(hawaiian_bgs[bg % SIZE(hawaiian_bgs)]))

;
    return buf;
}

export function apron_text(apron, buf) { /* char * */
    let apron_msgs = static_array("apron_text.apron_msgs", ptr_to(char), null, [
        _("Kiss the cook"),
        _("I'm making SCIENCE!"),
        _("Don't mess with the chef"),
        _("Don't make me poison you"),
        _("Gehennom's Kitchen"),
        _("Rat: The other white meat"),
        _("If you can't stand the heat, get out of Gehennom!"),
        _("If we weren't meant to eat animals, why are they made out of meat?"),
        _("If you don't like the food, I'll stab you"),
        /* In the movie "The Sum of All Fears", a Russian worker in a weapons
           facility wears a T-shirt that a translator says reads, "I am a
           bomb technician, if you see me running ... try to catch up."
           In nethack, the quote is far more suitable to an alchemy smock
           (particularly since so many of these others are about cooking)
           than a T-shirt and is paraphrased to simplify/shorten it.
           [later... turns out that this is already a T-shirt message:
            "I am a Valkyrie.  If you see me running, try to keep up."
           so this one has been revised a little:  added alchemist prefix,
           changed "keep up" to original source's "catch up"] */
        _("I am an alchemist; if you see me running, try to catch up..."),
    ]);

    strcpy(buf, apron_msgs[apron.o_id % SIZE(apron_msgs)]);
    return erode_obj_text(apron, buf);
}

const candy_wrappers = static_array("candy_wrappers", ptr_to(char), null, [
    _(""),                         /* (none -- should never happen) */
    _("Apollo"),                   /* Lost */
    _("Moon Crunchy"),             /* South Park */
    _("Snacky Cake"),    _("Chocolate Nuggie"), _("The Small Bar"),
    _("Crispy Yum Yum"), _("Nilla Crunchie"),   _("Berry Bar"),
    _("Choco Nummer"),   _("Om-nom"), /* Cat Macro */
    _("Fruity Oaty"),              /* Serenity */
    _("Wonka Bar"),                /* Charlie and the Chocolate Factory */
]);

/* return the text of a candy bar's wrapper */
export function candy_wrapper_text(obj) { /* const char * */
    /* modulo operation is just bullet proofing; 'spe' is already in range */
    return candy_wrappers[obj.spe % SIZE(candy_wrappers)];
}

/* assign a wrapper to a candy bar stack */
export function assign_candy_wrapper(obj) { /* void */
    if (obj.otyp == CANDY_BAR) {
        /* skips candy_wrappers[0] */
        obj.spe = 1 + rn2(SIZE(candy_wrappers) - 1);
    }
    return;
}

/* getobj callback for object to read */
function read_ok(obj) { /* int */
    if (!obj)
        return GETOBJ_EXCLUDE;

    if (obj.oclass == SCROLL_CLASS || obj.oclass == SPBOOK_CLASS)
        return GETOBJ_SUGGEST;

    return GETOBJ_DOWNPLAY;
}

/* the #read command; read a scroll or spell book or various other things */
export function doread() { /* int */
    const $frame = stack_frame(); try {
    let find_any_braille = init_string(static_array("doread.find_any_braille", char, sizeof_string("feel any Braille writing.")), _("feel any Braille writing."), true);
    let scroll;
    let confused, nodisappear;
    let otyp;

    /*
     * Reading while blind is allowed in most cases, including the
     * Book of the Dead but not regular spellbooks.  For scrolls, the
     * description has to have been seen or magically learned (so only
     * when scroll->dknown is true):  hero recites the label while
     * holding the unfurled scroll.  We deliberately don't require
     * free hands because that would cripple scroll of remove curse,
     * but we ought to be requiring hands or at least limbs.  The
     * recitation could be sub-vocal; actual speech isn't required.
     *
     * Reading while confused is allowed and can produce alternate
     * outcome.
     *
     * Reading while stunned is currently allowed but probably should
     * be prevented....
     */

    gk.known = FALSE;
    if (check_capacity(0))
        return ECMD_OK;

    scroll = getobj(_("read"), read_ok, GETOBJ_PROMPT);
    if (!scroll)
        return ECMD_CANCEL;
    otyp = scroll.otyp;
    scroll.pickup_prev = 0; /* no longer 'just picked up' */

    /* outrumor has its own blindness check */
    if (otyp == FORTUNE_COOKIE) {
        if (flags.verbose)
            You(_("break up the cookie and throw away the pieces."));
        outrumor(bcsign(scroll), BY_COOKIE);
        if (!Blind())
            if (!u.uconduct.literate++)
                livelog_printf(LL_CONDUCT,
                               _("became literate by reading a fortune cookie"));
        useup(scroll);
        return ECMD_TIME;
    } else if (otyp == T_SHIRT || otyp == ALCHEMY_SMOCK
               || otyp == HAWAIIAN_SHIRT) {
        let buf = stack_array(char, BUFSZ), mesg;
        let endpunct;

        if (Blind()) {
            You_cant(find_any_braille);
            return ECMD_OK;
        }
        /* can't read shirt worn under suit (under cloak is ok though) */
        if ((otyp == T_SHIRT || otyp == HAWAIIAN_SHIRT) && uarm
            && scroll == uarmu) {
            pline(_("%s shirt is obscured by %s%s."),
                  scroll.unpaid ? _("That") : _("Your"), shk_your(buf, uarm),
                  suit_simple_name(uarm));
            return ECMD_OK;
        }
        if (otyp == HAWAIIAN_SHIRT) {
            pline(_("%s features %s."), flags.verbose ? _("The design") : _("It"),
                  hawaiian_design(scroll, buf));
            return ECMD_TIME;
        }
        if (!u.uconduct.literate++)
            livelog_printf(LL_CONDUCT, _("became literate by reading %s"),
                           (scroll.otyp == T_SHIRT) ? _("a T-shirt")
                           : _("an apron"));

        /* populate 'buf[]' */
        mesg = (otyp == T_SHIRT) ? tshirt_text(scroll, buf)
                                 : apron_text(scroll, buf);
        endpunct = _("");
        if (flags.verbose) {
            let ln = int(strlen(mesg));

            /* we will be displaying a sentence; need ending punctuation */
            if (ln > 0 && !strchr(_(".!?"), chars[mesg + (ln - 1)]))
                endpunct = _(".");
            pline(_("It reads:"));
        }
        pline(_("\"%s\"%s"), mesg, endpunct);
        return ECMD_TIME;
    } else if ((otyp == DUNCE_CAP || otyp == CORNUTHAUM)
        /* note: "DUNCE" isn't directly connected to tourists but
           if everyone could read it, they would always be able to
           trivially distinguish between the two types of conical hat;
           limiting this to tourists is better than rejecting it */
               && Role_if(PM_TOURIST)) {
        /* another note: the misspelling, "wizzard", is correct;
           that's what is written on Rincewind's pointy hat from
           Pratchett's Discworld series, along with a lot of stars;
           rather than inked on or painted on, treat them as stitched
           or even separate pieces of fabric which have been attached
           (don't recall whether the books mention anything like that...) */
        let cap_text = (otyp == DUNCE_CAP) ? _("DUNCE") : _("WIZZARD");

        if (scroll.o_id % 3) {
            /* no need to vary this when blind; "on this ___" is important
               because it suggests that there might be something on others */
            You_cant(_("find anything to read on this %s."),
                     simpleonames(scroll));
            return ECMD_OK;
        }
        pline(_("%s on the %s.  It reads:  %s."),
              !Blind() ? _("There is writing") : _("You feel lettering"),
              simpleonames(scroll), cap_text);
        if (!u.uconduct.literate++)
            livelog_printf(LL_CONDUCT, _("became literate by reading %s"),
                           (otyp == DUNCE_CAP) ? _("a dunce cap")
                                               : _("a cornuthaum"));

        /* yet another note: despite the fact that player will recognize
           the object type, don't make it become a discovery for hero */
        trycall(scroll);
        return ECMD_TIME;
    } else if (otyp == CREDIT_CARD) {
        let card_msgs = static_array("doread.card_msgs", ptr_to(char), null, [
            _("Leprechaun Gold Tru$t - Shamrock Card"),
            _("Magic Memory Vault Charge Card"),
            _("Larn National Bank"),                /* Larn */
            _("First Bank of Omega"),               /* Omega */
            _("Bank of Zork - Frobozz Magic Card"), /* Zork */
            _("Ankh-Morpork Merchant's Guild Barter Card"),
            _("Ankh-Morpork Thieves' Guild Unlimited Transaction Card"),
            _("Ransmannsby Moneylenders Association"),
            _("Bank of Gehennom - 99% Interest Card"),
            _("Yendorian Express - Copper Card"),
            _("Yendorian Express - Silver Card"),
            _("Yendorian Express - Gold Card"),
            _("Yendorian Express - Mithril Card"),
            _("Yendorian Express - Platinum Card"), /* must be last */
        ]);

        if (Blind()) {
            You(_("feel the embossed numbers:"));
        } else {
            if (flags.verbose)
                pline(_("It reads:"));
            pline(_("\"%s\""),
                  scroll.oartifact
                      ? card_msgs[SIZE(card_msgs) - 1]
                      : card_msgs[scroll.o_id % (SIZE(card_msgs) - 1)]);
        }
        /* Make a credit card number */
        pline(_("\"%d0%d %lld%d1 0%d%d0\"%s"),
              ((int(scroll.o_id) % 89) + 10),
              (int(scroll.o_id) % 4),
              (((scroll.o_id * 499) % 899999) + 100000),
              (int(scroll.o_id) % 10),
              (+!(int(scroll.o_id) % 3)),
              ((int(scroll.o_id) * 7) % 10),
              (flags.verbose || Blind()) ? _(".") : _(""));
        if (!u.uconduct.literate++)
            livelog_printf(LL_CONDUCT,
                           _("became literate by reading a credit card"));

        return ECMD_TIME;
    } else if (otyp == CAN_OF_GREASE) {
        pline(_("This %s has no label."), singular(scroll, xname));
        return ECMD_OK;
    } else if (otyp == MAGIC_MARKER) {
        let red_mons = static_array("doread.red_mons", int, null, [
            PM_FIRE_ANT, PM_PYROLISK, PM_HELL_HOUND, PM_IMP,
            PM_LARGE_MIMIC, PM_LEOCROTTA, PM_SCORPION, PM_XAN,
            PM_GIANT_BAT, PM_WATER_MOCCASIN, PM_FLESH_GOLEM,
            PM_BARBED_DEVIL, PM_MARILITH, PM_PIRANHA
        ]);
        let buf = stack_array(char, BUFSZ);
        let pm = mons[red_mons[scroll.o_id % SIZE(red_mons)]];

        if (Blind()) {
            You_cant(find_any_braille);
            return ECMD_OK;
        }
        if (flags.verbose)
            pline(_("It reads:"));
        sprintf(buf, _("%s"), pmname(pm, NEUTRAL));
        pline(_("\"Magic Marker(TM) %s Red Ink Marker Pen.  Water Soluble.\""),
              upwords(buf));
        if (!u.uconduct.literate++)
            livelog_printf(LL_CONDUCT,
                           _("became literate by reading a magic marker"));

        return ECMD_TIME;
    } else if (scroll.oclass == COIN_CLASS) {
        if (Blind())
            You(_("feel the embossed words:"));
        else if (flags.verbose)
            You(_("read:"));
        pline(_("\"1 Zorkmid.  857 GUE.  In Frobs We Trust.\""));
        if (!u.uconduct.literate++)
            livelog_printf(LL_CONDUCT,
                           _("became literate by reading a coin's engravings"));

        return ECMD_TIME;
    } else if (is_art(scroll, ART_ORB_OF_FATE)) {
        if (Blind())
            You(_("feel the engraved signature:"));
        else
            pline(_("It is signed:"));
        pline(_("\"Odin.\""));
        if (!u.uconduct.literate++)
            livelog_printf(LL_CONDUCT,
                   _("became literate by reading the divine signature of Odin"));

        return ECMD_TIME;
    } else if (otyp == CANDY_BAR) {
        let wrapper = candy_wrapper_text(scroll);

        if (Blind()) {
            You_cant(find_any_braille);
            return ECMD_OK;
        }
        if (!chars[wrapper]) {
            pline(_("The candy bar's wrapper is blank."));
            return ECMD_OK;
        }
        pline(_("The wrapper reads: \"%s\"."), wrapper);
        if (!u.uconduct.literate++)
            livelog_printf(LL_CONDUCT,
                           _("became literate by reading a candy bar wrapper"));

        return ECMD_TIME;
    } else if (scroll.oclass != SCROLL_CLASS
               && scroll.oclass != SPBOOK_CLASS) {
        pline(silly_thing_to(), _("read"));
        return ECMD_OK;
    } else if (Blind() && otyp != SPE_BOOK_OF_THE_DEAD) {
        let what = 0;

        if (otyp == SPE_NOVEL)
            /* unseen novels are already distinguishable from unseen
               spellbooks so this isn't revealing any extra information */
            what = _("words");
        else if (scroll.oclass == SPBOOK_CLASS)
            what = _("mystic runes");
        else if (!scroll.dknown)
            what = _("formula on the scroll");
        if (what) {
            pline(_("Being blind, you cannot read the %s."), what);
            return ECMD_OK;
        }
    }

    confused = +(Confusion() != 0);

    if (otyp == SCR_MAIL) {
        confused = FALSE; /* override */
        /* reading mail is a convenience for the player and takes
           place outside the game, so shouldn't affect gameplay;
           on the other hand, it starts by explicitly making the
           hero actively read something, which is pretty hard
           to simply ignore; as a compromise, if the player has
           maintained illiterate conduct so far, and this mail
           scroll didn't come from bones, ask for confirmation */
        if (!u.uconduct.literate) {
            if (!scroll.spe && y_n(
             _("Reading mail will violate \"illiterate\" conduct.  Read anyway?")
                                   ) != ord('y'))
                return ECMD_OK;
        }
    }

    /* Actions required to win the game aren't counted towards conduct */
    /* Novel conduct is handled in read_tribute so exclude it too */
    if (otyp != SPE_BOOK_OF_THE_DEAD && otyp != SPE_NOVEL
        && otyp != SPE_BLANK_PAPER && otyp != SCR_BLANK_PAPER)
        if (!u.uconduct.literate++)
            livelog_printf(LL_CONDUCT, _("became literate by reading %s"),
                           (scroll.oclass == SPBOOK_CLASS) ? _("a book")
                           : (scroll.oclass == SCROLL_CLASS) ? _("a scroll")
                             : something());

    if (scroll.oclass == SPBOOK_CLASS) {
        return study_book(scroll) ? ECMD_TIME : ECMD_OK;
    }
    scroll.in_use = TRUE; /* scroll, not spellbook, now being read */
    if (otyp != SCR_BLANK_PAPER) {
        let silently = +!can_chant(gy.youmonst);

        /* a few scroll feedback messages describe something happening
           to the scroll itself, so avoid "it disappears" for those */
        nodisappear = (otyp == SCR_FIRE
                       || (otyp == SCR_REMOVE_CURSE && scroll.cursed) ? 1 : 0);
        if (Blind())
            pline(nodisappear
                      ? _("You %s the formula on the scroll.")
                      : _("As you %s the formula on it, the scroll disappears."),
                  silently ? _("cogitate") : _("pronounce"));
        else
            pline(nodisappear ? _("You read the scroll.")
                              : _("As you read the scroll, it disappears."));
        if (confused) {
            if (Hallucination())
                pline(_("Being so trippy, you screw up..."));
            else
                pline(_("Being confused, you %s the magic words..."),
                      silently ? _("misunderstand") : _("mispronounce"));
        }
    }
    if (!seffects(scroll)) {
        if (!objects[otyp].oc_name_known) {
            if (gk.known)
                learnscroll(scroll);
            else
                trycall(scroll);
        }
        scroll.in_use = FALSE;
        if (otyp != SCR_BLANK_PAPER)
            useup(scroll);
    }
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

function stripspe(obj) { /* void */
    if (obj.blessed || obj.spe <= 0) {
        pline1(nothing_happens());
    } else {
        /* order matters: message, shop handling, actual transformation */
        pline(_("%s briefly."), Yobjnam2(obj, _("vibrate")));
        costly_alteration(obj, COST_UNCHRG);
        obj.spe = 0;
        if (obj.otyp == OIL_LAMP || obj.otyp == BRASS_LANTERN)
            obj.age = 0;
    }
}

function p_glow1(otmp) { /* void */
    pline(_("%s briefly."), Yobjnam2(otmp, Blind() ? _("vibrate") : _("glow")));
}

function p_glow2(otmp, color) { /* void */
    pline(_("%s%s%s for a moment."), Yobjnam2(otmp, Blind() ? _("vibrate") : _("glow")),
          Blind() ? _("") : _(" "), Blind() ? _("") : hcolor(color));
}

function p_glow3(otmp, color) { /* void */
    pline(_("%s feebly%s%s for a moment."),
          Yobjnam2(otmp, Blind() ? _("vibrate") : _("glow")),
          Blind() ? _("") : _(" "), Blind() ? _("") : hcolor(color));
}

/* getobj callback for object to charge */
export function charge_ok(obj) { /* int */
    if (!obj)
        return GETOBJ_EXCLUDE;

    if (obj.oclass == WAND_CLASS)
        return GETOBJ_SUGGEST;

    if (obj.oclass == RING_CLASS && objects[obj.otyp].oc_charged
        && obj.dknown && objects[obj.otyp].oc_name_known)
        return GETOBJ_SUGGEST;

    if (is_weptool(obj)) /* specific check before general tools */
        return GETOBJ_EXCLUDE;

    if (obj.oclass == TOOL_CLASS) {
        /* suggest tools that aren't oc_charged but can still be recharged */
        if (obj.otyp == BRASS_LANTERN
            || (obj.otyp == OIL_LAMP)
            /* only list magic lamps if they are not identified yet */
            || (obj.otyp == MAGIC_LAMP
                && !objects[MAGIC_LAMP].oc_name_known)) {
            return GETOBJ_SUGGEST;
        }
        /* suggest chargeable tools only if discovered, to prevent leaking
           info (e.g. revealing if an unidentified 'flute' is magic or not) */
        if (objects[obj.otyp].oc_charged) {
            return (obj.dknown && objects[obj.otyp].oc_name_known)
                     ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY;
        }
        return GETOBJ_EXCLUDE;
    }
    /* why are weapons/armor considered charged anyway?
     * make them selectable even so for "feeling of loss" message */
    return GETOBJ_EXCLUDE_SELECTABLE;
}

/* recharge an object; curse_bless is -1 if the recharging implement
   was cursed, +1 if blessed, 0 otherwise. */
export function recharge(obj, curse_bless) { /* void */
    let $goto = null;
    var n;
    var is_cursed, is_blessed;

    is_cursed = +(curse_bless < 0);
    is_blessed = +(curse_bless > 0);

    $goto_not_chargable: for (;;) { switch ($goto) { default: case "not_chargable": if (!$goto && (obj.oclass == WAND_CLASS)) {
        var lim = (obj.otyp == WAN_WISHING)
                      ? 1
                      : (objects[obj.otyp].oc_dir != NODIR) ? 8 : 15;

        /* undo any prior cancellation, even when is_cursed */
        if (obj.spe == -1)
            obj.spe = 0;

        /*
         * Recharging might cause wands to explode.
         *      v = number of previous recharges
         *            v = percentage chance to explode on this attempt
         *                    v = cumulative odds for exploding
         *      0 :   0       0
         *      1 :   0.29    0.29
         *      2 :   2.33    2.62
         *      3 :   7.87   10.28
         *      4 :  18.66   27.02
         *      5 :  36.44   53.62
         *      6 :  62.97   82.83
         *      7 : 100     100
         */
        n = obj.recharged;
        if (n > 0 && (obj.otyp == WAN_WISHING
                      || (n * n * n > rn2(7 * 7 * 7)))) { /* recharge_limit */
            wand_explode(obj, rnd(lim));
            return;
        }
        /* didn't explode, so increment the recharge count */
        obj.recharged = unsigned((n + 1));

        /* now handle the actual recharging */
        if (is_cursed) {
            stripspe(obj);
        } else {
            n = (lim == 1) ? 1 : rn1(5, lim + 1 - 5);
            if (!is_blessed)
                n = rnd(n);

            if (obj.spe < n)
                obj.spe = n;
            else
                obj.spe++;
            if (obj.otyp == WAN_WISHING && obj.spe > 3) {
                /* wands can't give more than three wishes; this code is
                   currently unreachable but left in case the rules for
                   wands of wishing change in future */
                wand_explode(obj, 1);
                return;
            }
            if (lim == 1)
                p_glow3(obj, NH_BLUE());
            else if (obj.spe >= lim)
                p_glow2(obj, NH_BLUE());
            else
                p_glow1(obj);
        }
    } else if (!$goto && (obj.oclass == RING_CLASS && objects[obj.otyp].oc_charged)) {
        /* charging does not affect ring's curse/bless status */
        var s = is_blessed ? rnd(3) : is_cursed ? -rnd(2) : 1;
        var is_on = +(obj == uleft || obj == uright);

        /* destruction depends on current state, not adjustment */
        if (obj.spe > rn2(7) || obj.spe <= -5) {
            pline(_("%s momentarily, then %s!"), Yobjnam2(obj, _("pulsate")),
                  otense(obj, _("explode")));
            if (is_on)
                Ring_gone(obj);
            s = rnd(3 * abs(obj.spe)); /* amount of damage */
            useup(obj), obj = null;
            losehp(Maybe_Half_Phys(s), _("exploding ring"), KILLED_BY_AN);
        } else {
            var mask = is_on ? (obj == uleft ? LEFT_RING : RIGHT_RING) : 0;

            pline(_("%s spins %sclockwise for a moment."), Yname2(obj),
                  s < 0 ? _("counter") : _(""));
            if (s < 0)
                costly_alteration(obj, COST_DECHNT);
            /* cause attributes and/or properties to be updated */
            if (is_on)
                Ring_off(obj);
            obj.spe += s; /* update the ring while it's off */
            if (is_on)
                setworn(obj, mask), Ring_on(obj);
            /* oartifact: if a touch-sensitive artifact ring is
               ever created the above will need to be revised  */
            /* update shop bill to reflect new higher price */
            if (s > 0 && obj.unpaid)
                alter_cost(obj, 0);
        }
    } else if (!$goto && (obj.oclass == TOOL_CLASS)) {
        var rechrg = obj.recharged;

        if (objects[obj.otyp].oc_charged) {
            /* tools don't have a limit, but the counter used does */
            if (rechrg < 7) /* recharge_limit */
                obj.recharged++;
        }
        switch (obj.otyp) {
        case BELL_OF_OPENING:
            if (is_cursed)
                stripspe(obj);
            else if (is_blessed)
                obj.spe += rnd(3);
            else
                obj.spe += 1;
            if (obj.spe > 5)
                obj.spe = 5;
            break;
        case MAGIC_MARKER:
        case TINNING_KIT:
        case EXPENSIVE_CAMERA:
            if (is_cursed) {
                stripspe(obj);
            } else if (rechrg && obj.otyp == MAGIC_MARKER) {
                /* previously recharged */
                obj.recharged = 1; /* override increment done above */
                if (obj.spe < 3)
                    Your(_("marker seems permanently dried out."));
                else
                    pline1(nothing_happens());
            } else if (is_blessed) {
                n = rn1(16, 15); /* 15..30 */
                if (obj.spe + n <= 50)
                    obj.spe = 50;
                else if (obj.spe + n <= 75)
                    obj.spe = 75;
                else {
                    var chrg = obj.spe;
                    if ((chrg + n) > 127)
                        obj.spe = 127;
                    else
                        obj.spe += n;
                }
                p_glow2(obj, NH_BLUE());
            } else {
                n = rn1(11, 10); /* 10..20 */
                if (obj.spe + n <= 50)
                    obj.spe = 50;
                else {
                    var chrg = obj.spe;

                    if (chrg + n > SPE_LIM)
                        obj.spe = SPE_LIM;
                    else
                        obj.spe += n;
                }
                p_glow2(obj, NH_WHITE());
            }
            break;
        case OIL_LAMP:
        case BRASS_LANTERN:
            if (is_cursed) {
                stripspe(obj);
                if (obj.lamplit) {
                    if (!Blind())
                        pline(_("%s out!"), Tobjnam(obj, _("go")));
                    end_burn(obj, TRUE);
                }
            } else if (is_blessed) {
                obj.spe = 1;
                obj.age = 1500;
                p_glow2(obj, NH_BLUE());
            } else {
                obj.spe = 1;
                obj.age += 750;
                if (obj.age > 1500)
                    obj.age = 1500;
                p_glow1(obj);
            }
            break;
        case CRYSTAL_BALL:
            if (obj.spe == -1) /* like wands, first uncancel */
                obj.spe = 0;

            if (is_cursed) {
                /* cursed scroll removes charges and curses ball */
                /*stripspe(obj); -- doesn't do quite what we want...*/
                if (!obj.cursed) {
                    p_glow2(obj, NH_BLACK());
                    curse(obj);
                } else {
                    pline(_("%s briefly."), Yobjnam2(obj, _("vibrate")));
                }
                if (obj.spe > 0)
                    costly_alteration(obj, COST_UNCHRG);
                obj.spe = 0;
            } else if (is_blessed) {
                /* blessed scroll sets charges to max and blesses ball */
                obj.spe = 7;
                p_glow2(obj, !obj.blessed ? NH_LIGHT_BLUE() : NH_BLUE());
                if (!obj.blessed)
                    bless(obj);
                /* [shop price stays the same regardless of charges or BUC] */
            } else {
                /* uncursed scroll increments charges and uncurses ball */
                if (obj.spe < 7 || obj.cursed) {
                    n = rnd(2);
                    obj.spe = min(obj.spe + n, 7);
                    if (!obj.cursed) {
                        p_glow1(obj);
                    } else {
                        p_glow2(obj, NH_AMBER());
                        uncurse(obj);
                    }
                } else {
                    /* charges at max and ball not being uncursed */
                    pline1(nothing_happens());
                }
            }
            break;
        case HORN_OF_PLENTY:
        case BAG_OF_TRICKS:
        case CAN_OF_GREASE:
            if (is_cursed) {
                stripspe(obj);
            } else if (is_blessed) {
                if (obj.spe <= 10)
                    obj.spe += rn1(10, 6);
                else
                    obj.spe += rn1(5, 6);
                if (obj.spe > 50)
                    obj.spe = 50;
                p_glow2(obj, NH_BLUE());
            } else {
                obj.spe += rn1(5, 2);
                if (obj.spe > 50)
                    obj.spe = 50;
                p_glow1(obj);
            }
            break;
        case MAGIC_FLUTE:
        case MAGIC_HARP:
        case FROST_HORN:
        case FIRE_HORN:
        case DRUM_OF_EARTHQUAKE:
            if (is_cursed) {
                stripspe(obj);
            } else if (is_blessed) {
                obj.spe += d(2, 4);
                if (obj.spe > 20)
                    obj.spe = 20;
                p_glow2(obj, NH_BLUE());
            } else {
                obj.spe += rnd(4);
                if (obj.spe > 20)
                    obj.spe = 20;
                p_glow1(obj);
            }
            break;
        default:
            { $goto = "not_chargable"; continue $goto_not_chargable; };
            /*NOTREACHED*/
            break;
        } /* switch */
    } else {
 $goto = null;
        You(_("have a feeling of loss."));
    } } break; }

    /* prevent enchantment from getting out of range */
    cap_spe(obj);
}

/*
 * Forget some things (e.g. after reading a scroll of amnesia).  When called,
 * the following are always forgotten:
 *      - felt ball & chain
 *      - skill training
 *
 * Other things are subject to flags:
 *      howmuch & ALL_SPELLS    = forget all spells
 */
function forget(howmuch) { /* void */
    let mtmp;

    if (Punished())
        u.bc_felt = 0; /* forget felt ball&chain */

    if (howmuch & ALL_SPELLS)
        losespells();

    /* Forget some skills. */
    drain_weapon_skill(rnd(howmuch ? 5 : 3));

    /* forget having seen monsts (affects recognizing unseen ones by sound) */
    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon)
        if (mtmp != u.usteed && mtmp != u.ustuck)
            mtmp.meverseen = 0;
    /* [perhaps ought to forget having seen every monster on every level] */
    for (mtmp = gm.migrating_mons; mtmp; mtmp = mtmp.nmon)
        mtmp.meverseen = 0;
}

/* monster is hit by scroll of taming's effect */
function maybe_tame(mtmp, sobj) { /* int */
    let was_tame = mtmp.mtame;
    let was_peaceful = mtmp.mpeaceful;

    if (sobj.cursed) {
        setmangry(mtmp, FALSE);
        if (was_peaceful && !mtmp.mpeaceful)
            return -1;
    } else {
        /* for a shopkeeper, tamedog() will call make_happy_shk() but
           not tame the target, so call it even if taming gets resisted */
        if (!resist(mtmp, sobj.oclass, 0, NOTELL) || mtmp.isshk)
            tamedog(mtmp, sobj, FALSE);

        if ((!was_peaceful && mtmp.mpeaceful) || was_tame != mtmp.mtame)
            return 1;
    }
    return 0;
}

/* Can a stinking cloud physically exist at a certain position?
 * NOT the same thing as can_center_cloud.
 */
export function valid_cloud_pos(x, y) { /* boolean */
    if (!isok(x,y))
        return FALSE;
    return (ACCESSIBLE(levl()[x][y].typ) || is_pool(x, y) || is_lava(x, y) ? 1 : 0);
}

/* Callback for getpos_sethilite, also used in determining whether a scroll
 * should have its regular effects, or not because it was out of range.
 */
function can_center_cloud(x, y) { /* boolean */
    if (!valid_cloud_pos(x, y))
        return FALSE;
    return +(cansee(x, y) && distu(x, y) < 32);
}

function display_stinking_cloud_positions(on_off) { /* void */
    let x, y, dx, dy;
    let dist = 6;

    if (on_off) {
        /* on */
        tmp_at(DISP_BEAM, cmap_to_glyph(S_goodpos));
        for (dx = -dist; dx <= dist; dx++)
            for (dy = -dist; dy <= dist; dy++) {
                x = u.ux + dx;
                y = u.uy + dy;
                /* hero's location is allowed but highlighting the hero's
                   spot makes map harder to read (if using '$' rather than
                   by changing background color) */
                if (u_at(x, y))
                    continue;
                if (can_center_cloud(x, y))
                    tmp_at(x, y);
            }
    } else {
        /* off */
        tmp_at(DISP_END, 0);
    }
}

function seffect_enchant_armor(sobjp) { /* void */
    let sobj = sobjp[0];
    let s;
    let special_armor;
    let same_color;
    let otmp = some_armor(gy.youmonst);
    let sblessed = sobj.blessed;
    let scursed = sobj.cursed;
    let confused = +(Confusion() != 0);
    let old_erodeproof, new_erodeproof;

    if (!otmp) {
        strange_feeling(sobj, !Blind()
                        ? _("Your skin glows then fades.")
                        : _("Your skin feels warm for a moment."));
        sobjp[0] = null; /* useup() in strange_feeling() */
        exercise(A_CON, +!scursed);
        exercise(A_STR, +!scursed);
        return;
    }
    if (confused) {
        old_erodeproof = +(otmp.oerodeproof != 0);
        new_erodeproof = +!scursed;
        otmp.oerodeproof = 0; /* for messages */
        if (Blind()) {
            otmp.rknown = FALSE;
            pline(_("%s warm for a moment."), Yobjnam2(otmp, _("feel")));
        } else {
            otmp.rknown = TRUE;
            pline(_("%s covered by a %s %s %s!"), Yobjnam2(otmp, _("are")),
                  scursed ? _("mottled") : _("shimmering"),
                  hcolor(scursed ? NH_BLACK() : NH_GOLDEN()),
                  scursed ? _("glow")
                  : (is_shield(otmp) ? _("layer") : _("shield")));
        }
        if (new_erodeproof && (otmp.oeroded || otmp.oeroded2)) {
            otmp.oeroded = otmp.oeroded2 = 0;
            pline(_("%s as good as new!"),
                  Yobjnam2(otmp, Blind() ? _("feel") : _("look")));
        }
        if (old_erodeproof && !new_erodeproof) {
            /* restore old_erodeproof before shop charges */
            otmp.oerodeproof = 1;
            costly_alteration(otmp, COST_DEGRD);
        }
        otmp.oerodeproof = new_erodeproof ? 1 : 0;
        return;
    }
    /* elven armor vibrates warningly when enchanted beyond a limit */
    special_armor = +(is_elven_armor(otmp)
        || (Role_if(PM_WIZARD) && otmp.otyp == CORNUTHAUM));
    if (scursed)
        same_color = +(otmp.otyp == BLACK_DRAGON_SCALE_MAIL
                      || otmp.otyp == BLACK_DRAGON_SCALES);
    else
        same_color = +(otmp.otyp == SILVER_DRAGON_SCALE_MAIL
                      || otmp.otyp == SILVER_DRAGON_SCALES
                      || otmp.otyp == SHIELD_OF_REFLECTION);
    if (Blind())
        same_color = FALSE;

    /* KMH -- catch underflow */
    s = scursed ? -otmp.spe : otmp.spe;
    if (s > (special_armor ? 5 : 3) && rn2(s)) {
        otmp.in_use = TRUE;
        pline(_("%s violently %s%s%s for a while, then %s."), Yname2(otmp),
              otense(otmp, Blind() ? _("vibrate") : _("glow")),
              (!Blind() && !same_color) ? _(" ") : _(""),
              (Blind() || same_color) ? _("") : hcolor(scursed ? NH_BLACK()
                                                  : NH_SILVER()),
              otense(otmp, _("evaporate")));
        remove_worn_item(otmp, FALSE);
        useup(otmp);
        return;
    }
    if (s < -100)
        s = -100; /* avoid integer overflow with very negative armor */

    /* Base power of the enchantment:

       2 for -1 to +0 armor;
       1 for +1 to +2 armor;
       0 for +3 to +4 armor, etc.

       When disenchanting, everything is done with reversed signs. */
    s = Math.trunc((4 - s) / 2);

    /* Elven/artifact and nonmagical armor is easier to enchant;
       blessed scrolls are more effective. */
    if (special_armor)
        ++s;
    if (!objects[otmp.otyp].oc_magic)
        ++s;
    if (sblessed)
        ++s;

    if (s <= 0) {
        s = 0;
        if (otmp.spe > 0 && !rn2(otmp.spe))
            s = 1;
    } else {
        s = rnd(s);
    }
    if (s > 11)
        s = 11;    /* unlikely but possible: avoids an overflow later */

    if (scursed)
        s = -s;

    if (s >= 0 && Is_dragon_scales(otmp)) {
        let was_lit = otmp.lamplit;
        let old_light = artifact_light(otmp) ? arti_light_radius(otmp) : 0;

        /* dragon scales get turned into dragon scale mail */
        pline(_("%s merges and hardens!"), Yname2(otmp));
        setworn(null, W_ARM);
        /* assumes same order */
        otmp.otyp += GRAY_DRAGON_SCALE_MAIL - GRAY_DRAGON_SCALES;
        otmp.lamplit = 0; /* don't want bless() or uncurse() to adjust
                            * light radius because scales -> scale_mail will
                            * result in a second increase with own message */
        if (sblessed) {
            otmp.spe++;
            cap_spe(otmp);
            if (!otmp.blessed)
                bless(otmp);
        } else if (otmp.cursed)
            uncurse(otmp);
        otmp.known = 1;
        setworn(otmp, W_ARM);
        if (otmp.unpaid)
            alter_cost(otmp, 0); /* shop bill */
        otmp.lamplit = was_lit;
        if (old_light)
            maybe_adjust_light(otmp, old_light);
        return;
    }
    pline(_("%s %s%s%s%s for a %s."), Yname2(otmp),
          (s == 0) ? _("violently ") : _(""),
          otense(otmp, Blind() ? _("vibrate") : _("glow")),
          (!Blind() && !same_color) ? _(" ") : _(""),
          (Blind() || same_color)
          ? _("") : hcolor(scursed ? NH_BLACK() : NH_SILVER()),
          (s * s > 1) ? _("while") : _("moment"));
    /* [this cost handling will need updating if shop pricing is
       ever changed to care about curse/bless status of armor] */
    if (s < 0)
        costly_alteration(otmp, COST_DECHNT);
    if (scursed && !otmp.cursed)
        curse(otmp);
    else if (sblessed && !otmp.blessed)
        bless(otmp);
    else if (!scursed && otmp.cursed)
        uncurse(otmp);
    if (s) {
        let oldspe = otmp.spe;
        /* despite being schar, it shouldn't be possible for spe to wrap
           here because it has been capped at 99 and s is quite small;
           however, might need to change s if it takes spe past 99 */
        otmp.spe += s;
        cap_spe(otmp); /* make sure that it doesn't exceed SPE_LIM */
        s = otmp.spe - oldspe; /* cap_spe() might have throttled 's' */
        if (s) /* skip if it got changed to 0 */
            adj_abon(otmp, s); /* adjust armor bonus for Dex or Int+Wis */
        gk.known = otmp.known;
        /* update shop bill to reflect new higher price */
        if (s > 0 && otmp.unpaid)
            alter_cost(otmp, 0);
    }

    if ((otmp.spe > (special_armor ? 5 : 3))
        && (special_armor || !rn2(7)))
        pline(_("%s %s."), Yobjnam2(otmp, _("suddenly vibrate")),
              Blind() ? _("again") : _("unexpectedly"));
}

/* destroy a random cursed armor worn by hero */
function disintegrate_cursed_armor() { /* boolean */
    const $frame = stack_frame(); try {
    let armors = stack_array(ptr_to(struct_obj), 10);
    let idx = 0;

    armors[0] = null;
    if (uarm && uarm.cursed)
        armors[idx++] = uarm;
    if (uarmc && uarmc.cursed)
        armors[idx++] = uarmc;
    if (uarmh && uarmh.cursed)
        armors[idx++] = uarmh;
    if (uarms && uarms.cursed)
        armors[idx++] = uarms;
    if (uarmg && uarmg.cursed)
        armors[idx++] = uarmg;
    if (uarmf && uarmf.cursed)
        armors[idx++] = uarmf;
    if (uarmu && uarmu.cursed)
        armors[idx++] = uarmu;
    if (!idx)
        return FALSE;

    if (disintegrate_arm(armors[rn2(idx)]))
        return TRUE;

    return FALSE;
    } finally { stack_pop($frame); }
}

function seffect_destroy_armor(sobjp) { /* void */
    let sobj = sobjp[0];
    let otmp = some_armor(gy.youmonst);
    let scursed = sobj.cursed;
    let confused = +(Confusion() != 0);
    let old_erodeproof, new_erodeproof;

    if (confused) {
        if (!otmp) {
            strange_feeling(sobj, _("Your bones itch."));
            sobjp[0] = null; /* useup() in strange_feeling() */
            exercise(A_STR, FALSE);
            exercise(A_CON, FALSE);
            return;
        }
        old_erodeproof = +(otmp.oerodeproof != 0);
        new_erodeproof = scursed;
        otmp.oerodeproof = 0; /* for messages */
        p_glow2(otmp, NH_PURPLE());
        if (old_erodeproof && !new_erodeproof) {
            /* restore old_erodeproof before shop charges */
            otmp.oerodeproof = 1;
            costly_alteration(otmp, COST_DEGRD);
        }
        otmp.oerodeproof = new_erodeproof ? 1 : 0;
        return;
    }

    if (scursed) {
        if (otmp && otmp.cursed) {
            /* armor and scroll both cursed */
            pline(_("%s."), Yobjnam2(otmp, _("vibrate")));
            if (otmp.spe >= -6) {
                otmp.spe += -1;
                adj_abon(otmp, -1);
            }
            make_stunned((HStun() & TIMEOUT) + rn1(10, 10), TRUE);
        } else if (disintegrate_arm(otmp)) {
            gk.known = TRUE;
            return;
        }
    } else {
        let gets_choice = (otmp && sobj && sobj.blessed
                               && count_worn_armor() > 1 ? 1 : 0);

        if (gets_choice) {
            let atmp;

            if (!objects[sobj.otyp].oc_name_known)
                pline(_("This is %s!"), an(actualoname(sobj)));
            gk.known = TRUE;
            atmp = getobj(_("destroy"), any_worn_armor_ok, GETOBJ_PROMPT);
            /* check the return value, if user picked non-valid obj */
            if (any_worn_armor_ok(atmp) == GETOBJ_SUGGEST)
                otmp = atmp;
            if (disintegrate_arm(otmp)) {
                gk.known = TRUE;
                return;
            }
        } else if (sobj.blessed && disintegrate_cursed_armor()) {
            gk.known = TRUE;
            return;
        } else if (!destroy_arm()) {
            strange_feeling(sobj, _("Your skin itches."));
            sobjp[0] = null; /* useup() in strange_feeling() */
            exercise(A_STR, FALSE);
            exercise(A_CON, FALSE);
            return;
        } else
            gk.known = TRUE;
    }
}

function seffect_confuse_monster(sobjp) { /* void */
    let sobj = sobjp[0];
    let sblessed = sobj.blessed,
            scursed = sobj.cursed,
            confused = +(Confusion() != 0),
            altfeedback = (Blind() || Invisible() ? 1 : 0);
    let hands = makeplural(body_part(HAND));

    if (gy.youmonst.data.mlet != S_HUMAN || scursed) {
        if (!HConfusion())
            You_feel(_("confused."));
        make_confused(HConfusion() + rnd(100), FALSE);
    } else if (confused) {
        if (!sblessed) {
            Your(_("%s begin to %s%s."), hands,
                 altfeedback ? _("tingle") : _("glow "),
                 altfeedback ? _("") : hcolor(NH_PURPLE()));
            make_confused(HConfusion() + rnd(100), FALSE);
        } else {
            pline(_("A %s%s surrounds your %s."),
                  altfeedback ? _("") : hcolor(NH_RED()),
                  altfeedback ? _("faint buzz") : _(" glow"), body_part(HEAD));
            make_confused(0, TRUE);
        }
    } else {
        /* scroll vs spell */
        let incr = (sobj.oclass == SCROLL_CLASS) ? 3 : 0;

        if (!sblessed) {
            if (altfeedback)
                Your(_("%s tingle%s."), hands, u.umconf ? _(" even more") : _(""));
            else if (!u.umconf)
                Your(_("%s begin to glow %s."), hands, hcolor(NH_RED()));
            else
                pline_The(_("%s glow of your %s intensifies."), hcolor(NH_RED()),
                          hands);
            incr += rnd(2);
        } else {
            if (altfeedback)
                Your(_("%s tingle %s sharply."), hands,
                     u.umconf ? _("even more") : _("very"));
            else
                Your(_("%s glow %s brilliant %s."), hands,
                     u.umconf ? _("an even more") : _("a"), hcolor(NH_RED()));
            incr += rn1(8, 2);
        }
        /* after a while, repeated uses become less effective */
        if (u.umconf >= 40)
            incr = 1;
        u.umconf += unsigned(incr);
    }
}

function seffect_scare_monster(sobjp) { /* void */
    let sobj = sobjp[0];
    let otyp = sobj.otyp;
    let scursed = sobj.cursed;
    let confused = +(Confusion() != 0);
    let ct = 0;
    let mtmp;

    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (DEADMONSTER(mtmp))
            continue;
        if (cansee(mtmp.mx, mtmp.my)) {
            if (confused || scursed) {
                mtmp.mflee = mtmp.mfrozen = mtmp.msleeping = 0;
                mtmp.mcanmove = 1;
            } else if (!resist(mtmp, sobj.oclass, 0, NOTELL))
                monflee(mtmp, 0, FALSE, FALSE);
            if (!mtmp.mtame)
                ct++; /* pets don't laugh at you */
        }
    }
    if (otyp == SCR_SCARE_MONSTER || !ct) {
        if (confused || scursed) {
             ;
        } else {
             ;
        }
        You_hear(_("%s %s."), (confused || scursed) ? _("sad wailing")
                 : _("maniacal laughter"),
                 !ct ? _("in the distance") : _("close by"));
    }
}

function seffect_remove_curse(sobjp) { /* void */
    let sobj = sobjp[0]; /* scroll or fake spellbook */
    let otyp = sobj.otyp;
    let sblessed = sobj.blessed;
    let scursed = sobj.cursed;
    let confused = +(Confusion() != 0);
    let obj, nxto;
    let wornmask;

    You_feel(!Hallucination()
             ? (!confused ? _("like someone is helping you.")
                : _("like you need some help."))
             : (!confused ? _("in touch with the Universal Oneness.")
                : _("the power of the Force against you!")));

    if (scursed) {
        pline_The(_("scroll disintegrates."));
    } else {
        /* 5.0: this used to use a straight
               for (obj = invent; obj; obj = obj->nobj) {}
           traversal, but for the confused case, secondary weapon might
           become cursed and be dropped, moving it from the invent chain
           to the floor chain at hero's spot, so we have to remember the
           next object prior to processing the current one */
        for (obj = gi.invent; obj; obj = nxto) {
            nxto = obj.nobj;
            /* gold isn't subject to cursing and blessing */
            if (obj.oclass == COIN_CLASS)
                continue;
            /* hide current scroll from itself so that perm_invent won't
               show known blessed scroll losing bknown when confused */
            if (obj == sobj && obj.quan == 1)
                continue;
            wornmask = and64(obj.owornmask, ~(W_BALL | W_ART | W_ARTI));
            if (wornmask && !sblessed) {
                /* handle a couple of special cases; we don't
                   allow auxiliary weapon slots to be used to
                   artificially increase number of worn items */
                if (obj == uswapwep) {
                    if (!u.twoweap)
                        wornmask = 0;
                } else if (obj == uquiver) {
                    if (obj.oclass == WEAPON_CLASS) {
                        /* mergeable weapon test covers ammo,
                           missiles, spears, daggers & knives */
                        if (!objects[obj.otyp].oc_merge)
                            wornmask = 0;
                    } else if (obj.oclass == GEM_CLASS) {
                        /* possibly ought to check whether
                           alternate weapon is a sling... */
                        if (!uslinging())
                            wornmask = 0;
                    } else {
                        /* weptools don't merge and aren't
                           reasonable quivered weapons */
                        wornmask = 0;
                    }
                }
            }
            if (sblessed || wornmask || obj.otyp == LOADSTONE
                /* this treats an in-use leash as a worn item but does not
                   do the same for lit lamp/candle [seems inconsistent] */
                || (obj.otyp == LEASH && obj.corpsenm)) {
                /* water price varies by curse/bless status */
                let shop_h2o = (obj.unpaid && obj.otyp == POT_WATER ? 1 : 0);

                if (confused) {
                    blessorcurse(obj, 2);
                    /* lose knowledge of this object's curse/bless
                       state (even if it didn't actually change) */
                    obj.bknown = 0;
                    /* blessorcurse() only affects uncursed items
                       so no need to worry about price of water
                       going down (hence no costly_alteration) */
                    if (shop_h2o && (obj.cursed || obj.blessed))
                        alter_cost(obj, 0); /* price goes up */
                } else if (obj.cursed) {
                    if (shop_h2o)
                        costly_alteration(obj, COST_UNCURS);
                    uncurse(obj);
                    /* if the object was known to be cursed and is now
                       known not to be, make the scroll known; it's
                       trivial to identify anyway by comparing inventory
                       before and after */
                    if (obj.bknown && otyp == SCR_REMOVE_CURSE)
                        learnscrolltyp(SCR_REMOVE_CURSE);
                }
            }
        }
        /* if riding, treat steed's saddle as if part of hero's invent */
        if (u.usteed && (obj = which_armor(u.usteed, W_SADDLE)) != null) {
            if (confused) {
                blessorcurse(obj, 2);
                obj.bknown = 0; /* skip set_bknown() */
            } else if (obj.cursed) {
                uncurse(obj);
                /* like rndcurse(sit.c), effect on regular inventory
                   doesn't show things glowing but saddle does */
                if (!Blind()) {
                    pline(_("%s %s."), Yobjnam2(obj, _("glow")),
                              hcolor(_("amber")));
                    obj.bknown = Hallucination() ? 0 : 1;
                } else {
                    obj.bknown = 0; /* skip set_bknown() */
                }
            }
        }
    }
    if (Punished() && !confused)
        unpunish();
    if (u.utrap && u.utraptype == TT_BURIEDBALL) {
        buried_ball_to_freedom();
        pline_The(_("clasp on your %s vanishes."), body_part(LEG));
    }
    update_inventory();
}

function seffect_create_monster(sobjp) { /* void */
    let sobj = sobjp[0];
    let sblessed = sobj.blessed;
    let scursed = sobj.cursed;
    let confused = +(Confusion() != 0);

    if (create_critters(1 + ((confused || scursed) ? 12 : 0)
                        + ((sblessed || rn2(73)) ? 0 : rnd(4)),
                        confused ? mons[PM_ACID_BLOB]
                        : null,
                        FALSE))
        gk.known = TRUE;
    /* no need to flush monsters; we ask for identification only if the
     * monsters are not visible
     */
}

function seffect_enchant_weapon(sobjp) { /* void */
    let sobj = sobjp[0];
    let sblessed = sobj.blessed;
    let scursed = sobj.cursed;
    let confused = +(Confusion() != 0);
    let old_erodeproof, new_erodeproof;
    let s;

    /* [What about twoweapon mode?  Proofing/repairing/enchanting both
       would be too powerful, but shouldn't we choose randomly between
       primary and secondary instead of always acting on primary?] */
    if (confused && uwep
        && erosion_matters(uwep) && uwep.oclass != ARMOR_CLASS) {
        old_erodeproof = +(uwep.oerodeproof != 0);
        new_erodeproof = +!scursed;
        uwep.oerodeproof = 0; /* for messages */
        if (Blind()) {
            uwep.rknown = FALSE;
            Your(_("weapon feels warm for a moment."));
        } else {
            uwep.rknown = TRUE;
            pline(_("%s covered by a %s %s %s!"), Yobjnam2(uwep, _("are")),
                  scursed ? _("mottled") : _("shimmering"),
                  hcolor(scursed ? NH_PURPLE() : NH_GOLDEN()),
                  scursed ? _("glow") : _("shield"));
        }
        if (new_erodeproof && (uwep.oeroded || uwep.oeroded2)) {
            uwep.oeroded = uwep.oeroded2 = 0;
            pline(_("%s as good as new!"),
                  Yobjnam2(uwep, Blind() ? _("feel") : _("look")));
        }
        if (old_erodeproof && !new_erodeproof) {
            /* restore old_erodeproof before shop charges */
            uwep.oerodeproof = 1;
            costly_alteration(uwep, COST_DEGRD);
        }
        uwep.oerodeproof = new_erodeproof ? 1 : 0;
        return;
    }
    s = scursed ? -1
        : !uwep ? 1 /* guard further tests against null pointer */
          : (uwep.spe >= 9) ? +(rn2(uwep.spe) == 0) /* usually 0, maybe  1 */
            : sblessed ? rnd(3 - Math.trunc(uwep.spe / 3)) /* >= 9 case prevents rnd(0) */
              : 1; /* uncursed */
    if (!chwepon(sobj, s))
        sobjp[0] = null; /* nothing enchanted: strange_feeling -> useup */
    if (uwep)
        cap_spe(uwep);
}

function seffect_taming(sobjp) { /* void */
    let sobj = sobjp[0];
    let confused = +(Confusion() != 0);
    let candidates, res, results, vis_results;

    if (u.uswallow) {
        candidates = 1;
        results = vis_results = maybe_tame(u.ustuck, sobj);
    } else {
        let i, j, bd = confused ? 5 : 1;
        let mtmp;

        /* note: maybe_tame() can return either positive or
           negative values, but not both for the same scroll */
        candidates = results = vis_results = 0;
        for (i = -bd; i <= bd; i++)
            for (j = -bd; j <= bd; j++) {
                if (!isok(u.ux + i, u.uy + j))
                    continue;
                if ((mtmp = m_at(u.ux + i, u.uy + j)) != null
                    || (!i && !j && (mtmp = u.usteed) != null)) {
                    ++candidates;
                    res = maybe_tame(mtmp, sobj);
                    results += res;
                    if (canspotmon(mtmp))
                        vis_results += res;
                }
            }
    }
    if (!results) {
        pline(_("Nothing interesting %s."),
              !candidates ? _("happens") : _("seems to happen"));
    } else {
        pline_The(_("neighborhood %s %sfriendlier."),
                  vis_results ? _("is") : _("seems"),
                  (results < 0) ? _("un") : _(""));
        if (vis_results > 0)
            gk.known = TRUE;
    }
}

function seffect_genocide(sobjp) { /* void */
    let sobj = sobjp[0];
    let otyp = sobj.otyp;
    let sblessed = sobj.blessed;
    let scursed = sobj.cursed;
    let already_known = (sobj.oclass == SPBOOK_CLASS /* spell */
                             || objects[otyp].oc_name_known ? 1 : 0);

    if (!already_known)
        You(_("have found a scroll of genocide!"));
    gk.known = TRUE;
    if (sblessed)
        do_class_genocide();
    else
        do_genocide((+!scursed) | (2 * +!!Confusion()));
}

function seffect_light(sobjp) { /* void */
    let sobj = sobjp[0];
    let sblessed = sobj.blessed;
    let scursed = sobj.cursed;
    let confused = +(Confusion() != 0);

    if (!confused) {
        if (!Blind())
            gk.known = TRUE;
        litroom(+!scursed, sobj);
        if (!scursed) {
            if (lightdamage(sobj, TRUE, 5))
                gk.known = TRUE;
        }
    } else {
        let pm = scursed ? PM_BLACK_LIGHT : PM_YELLOW_LIGHT;

        if ((svm.mvitals[pm].mvflags & G_GONE)) {
            pline(_("Tiny lights sparkle in the air momentarily."));
        } else {
            /* surround with cancelled tame lights which won't explode */
            let mon;
            let sawlights = FALSE;
            let i, numlights = rn1(2, 3) + (sblessed * 2);

            for (i = 0; i < numlights; ++i) {
                mon = makemon(mons[pm], u.ux, u.uy,
                              MM_EDOG | NO_MINVENT | MM_NOMSG);
                if (mon) {
                    initedog(mon, TRUE);
                    mon.msleeping = 0;
                    mon.mcan = TRUE;
                    if (canspotmon(mon))
                        sawlights = TRUE;
                    newsym(mon.mx, mon.my);
                }
            }
            if (sawlights) {
                pline(_("Lights appear all around you!"));
                gk.known = TRUE;
            }
        }
    }
}

function seffect_charging(sobjp) { /* void */
    let sobj = sobjp[0];
    let otyp = sobj.otyp;
    let sblessed = sobj.blessed;
    let scursed = sobj.cursed;
    let confused = +(Confusion() != 0);
    let already_known = (sobj.oclass == SPBOOK_CLASS /* spell */
                             || objects[otyp].oc_name_known ? 1 : 0);
    let otmp;

    if (confused) {
        if (scursed) {
            You_feel(_("discharged."));
            u.uen = 0;
        } else {
            You_feel(_("charged up!"));
            u.uen += d(sblessed ? 6 : 4, 4);
            if (u.uen > u.uenmax) /* if current energy is already at   */
                u.uenmax = u.uen; /* or near maximum, increase maximum */
            else
                u.uen = u.uenmax; /* otherwise restore current to max  */
        }
        disp.botl = TRUE;
        return;
    }
    /* known = TRUE; -- handled inline here */
    if (!already_known) {
        pline(_("This is a charging scroll."));
        learnscroll(sobj);
    }
    /* use it up now to prevent it from showing in the
       getobj picklist because the "disappears" message
       was already delivered */
    useup(sobj);
    sobjp[0] = null; /* it's gone */
    otmp = getobj(_("charge"), charge_ok, GETOBJ_PROMPT | GETOBJ_ALLOWCNT);
    if (otmp)
        recharge(otmp, scursed ? -1 : sblessed ? 1 : 0);
}

function seffect_amnesia(sobjp) { /* void */
    let sobj = sobjp[0];
    let sblessed = sobj.blessed;

    gk.known = TRUE;
    forget((!sblessed ? ALL_SPELLS : 0));
    if (Hallucination()) /* Ommmmmm! */
        Your(_("mind releases itself from mundane concerns."));
    else if (!strncmpi(svp.plname, _("Maud"), 4))
        pline(_("As your mind turns inward on itself," +
              " you forget everything else."));
    else if (rn2(2))
        pline(_("Who was that Maud person anyway?"));
    else
        pline(_("Thinking of Maud you forget everything else."));
    exercise(A_WIS, FALSE);
}

function seffect_fire(sobjp) { /* void */
    const $frame = stack_frame(); try {
    let sobj = sobjp[0];
    let otyp = sobj.otyp;
    let sblessed = sobj.blessed;
    let confused = +(Confusion() != 0);
    let already_known = (sobj.oclass == SPBOOK_CLASS /* spell */
                             || objects[otyp].oc_name_known ? 1 : 0);
    let cc = stack_struct(struct_nhcoord);
    let dam, cval;

    cc.x = u.ux;
    cc.y = u.uy;
    cval = bcsign(sobj);
    dam = Math.trunc((2 * (rn1(3, 3) + 2 * cval) + 1) / 3);
    useup(sobj);
    sobjp[0] = null; /* it's gone */
    if (!already_known)
        learnscrolltyp(SCR_FIRE);
    if (confused) {
        if (Underwater()) {
            pline(_("A little %s around you vaporizes."), hliquid(_("water")));
        }
        else if (Fire_resistance()) {
            shieldeff(u.ux, u.uy);
            monstseesu(M_SEEN_FIRE);
            if (!Blind())
                pline(_("Oh, look, what a pretty fire in your %s."),
                      makeplural(body_part(HAND)));
            else
                You_feel(_("a pleasant warmth in your %s."),
                         makeplural(body_part(HAND)));
        } else {
            monstunseesu(M_SEEN_FIRE);
            pline_The(_("scroll catches fire and you burn your %s."),
                      makeplural(body_part(HAND)));
            losehp(1, _("scroll of fire"), KILLED_BY_AN);
        }
        return;
    }
    if (Underwater()) {
        pline_The(_("%s around you vaporizes violently!"), hliquid(_("water")));
    } else {
        if (sblessed) {
            if (!already_known)
                pline(_("This is a scroll of fire!"));
            dam *= 5;
            pline(_("Where do you want to center the explosion?"));
            getpos_sethilite(display_stinking_cloud_positions,
                             can_center_cloud);
            getpos(cc, TRUE, _("the desired position"));
            if (!can_center_cloud(cc.x, cc.y)) {
                /* try to reach too far, get burned */
                cc.x = u.ux;
                cc.y = u.uy;
            }
        }
        if (u_at(cc.x, cc.y)) {
            pline_The(_("scroll erupts in a tower of flame!"));
            iflags.last_msg = PLNMSG_TOWER_OF_FLAME; /* for explode() */
            burn_away_slime();
        }
    }

    explode(cc.x, cc.y, ZT_SPELL_O_FIRE, dam, SCROLL_CLASS, EXPL_FIERY);
    } finally { stack_pop($frame); }
}
export const ZT_SPELL_O_FIRE = 11;

function seffect_earth(sobjp) { /* void */
    const $frame = stack_frame(); try {
    let sobj = sobjp[0];
    let sblessed = sobj.blessed;
    let scursed = sobj.cursed;
    let confused = +(Confusion() != 0);

    /* TODO: handle steeds */
    if (!Is_rogue_level(u.uz) && has_ceiling(u.uz)
        && (!In_endgame(u.uz) || Is_earthlevel(u.uz))) {
        let x, y;
        let nboulders = 0;

        /* Identify the scroll */
        if (u.uswallow) {
            You_hear(_("rumbling."));
        } else {
            if (!avoid_ceiling(u.uz)) {
                pline_The(_("%s rumbles %s you!"), ceiling(u.ux, u.uy),
                          sblessed ? _("around") : _("above"));
            } else {
                let matbuf = stack_array(char, BUFSZ);
                let avalanche = _("avalanche");

                sprintf(matbuf, _("%s"), sblessed ? makeplural(avalanche) : an(avalanche))
;
                pline(_("%s of boulders %s %s you!"),
                      upstart(matbuf), vtense(matbuf, _("materialize")),
                      sblessed ? _("around") : _("above"));
            }
        }
        gk.known = 1;
        sokoban_guilt();

        /* Loop through the surrounding squares */
        if (!scursed)
            for (x = u.ux - 1; x <= u.ux + 1; x++) {
                for (y = u.uy - 1; y <= u.uy + 1; y++) {
                    /* Is this a suitable spot? */
                    if (isok(x, y) && !closed_door(x, y)
                        && !IS_OBSTRUCTED(levl()[x][y].typ)
                        && !IS_AIR(levl()[x][y].typ)
                        && (x != u.ux || y != u.uy)) {
                        nboulders +=
                            drop_boulder_on_monster(x, y, confused, TRUE);
                    }
                }
            }
        /* Attack the player */
        if (!sblessed) {
            drop_boulder_on_player(confused, +!scursed, TRUE, FALSE);
        } else if (!nboulders)
            pline(_("But nothing else happens."));
    }
    } finally { stack_pop($frame); }
}

function seffect_punishment(sobjp) { /* void */
    let sobj = sobjp[0];
    let sblessed = sobj.blessed;
    let confused = +(Confusion() != 0);

    gk.known = TRUE;
    if (confused || sblessed) {
        You_feel(_("guilty."));
        return;
    }
    punish(sobj);
}

function seffect_stinking_cloud(sobjp) { /* void */
    let sobj = sobjp[0];
    let otyp = sobj.otyp;
    let already_known = (sobj.oclass == SPBOOK_CLASS /* spell */
                             || objects[otyp].oc_name_known ? 1 : 0);

    if (!already_known)
        You(_("have found a scroll of stinking cloud!"));
    gk.known = TRUE;
    do_stinking_cloud(sobj, already_known);
}

function seffect_blank_paper(sobjp) { /* void */
    if (Blind())
        You(_("don't remember there being any magic words on this scroll."));
    else
        pline(_("This scroll seems to be blank."));
    gk.known = TRUE;
}

function seffect_teleportation(sobjp) { /* void */
    let sobj = sobjp[0];
    let scursed = sobj.cursed;
    let confused = +(Confusion() != 0);

    if (confused || scursed) {
        level_tele();
        /* gives "materialize on different/same level!" message, must
           be a teleport scroll */
        gk.known = TRUE;
    } else {
        scrolltele(sobj);
        /* this will call learnscroll() as appropriate, and has results
           which maybe shouldn't result in the scroll becoming known;
           either way, no need to set gk.known here */
    }
}

function seffect_gold_detection(sobjp) { /* void */
    let sobj = sobjp[0];
    let scursed = sobj.cursed;
    let confused = +(Confusion() != 0);

    if ((confused || scursed) ? trap_detect(sobj) : gold_detect(sobj))
        sobjp[0] = null; /* failure: strange_feeling() -> useup() */
}

function seffect_food_detection(sobjp) { /* void */
    let sobj = sobjp[0];

    if (food_detect(sobj))
        sobjp[0] = null; /* nothing detected: strange_feeling -> useup */
}

function seffect_identify(sobjp) { /* void */
    let sobj = sobjp[0];
    let otyp = sobj.otyp;
    let is_scroll = +(sobj.oclass == SCROLL_CLASS);
    let sblessed = sobj.blessed;
    let scursed = sobj.cursed;
    let confused = +(Confusion() != 0);
    let already_known = (sobj.oclass == SPBOOK_CLASS /* spell */
                             || objects[otyp].oc_name_known ? 1 : 0);

    if (is_scroll) { /* scroll of identify */
        /* known = TRUE; -- handled inline here */
        /* use up the scroll first, before learnscrolltyp() -> makeknown()
           performs perm_invent update; also simplifies empty invent check */
        useup(sobj);
        sobjp[0] = null; /* it's gone */
        /* scroll just identifies itself for any scroll read while confused
           or for cursed scroll read without knowing identify yet */
        if (confused || (scursed && !already_known))
            You(_("identify this as an identify scroll."));
        else if (!already_known)
            pline(_("This is an identify scroll."));
        if (!already_known)
            learnscrolltyp(SCR_IDENTIFY);
        if (confused || (scursed && !already_known))
            return;
    }

    if (gi.invent) {
        let cval = 1;
        if (sblessed || (!scursed && !rn2(5))) {
            cval = rn2(5);
            /* note: if cval==0, identify all items */
            if (cval == 1 && sblessed && Luck() > 0)
                ++cval;
        }
        identify_pack(cval, +!already_known);
    } else {
        /* spell cast with inventory empty or scroll read when it's
           the only item leaving empty inventory after being used up */
        pline(_("You're not carrying anything%s to be identified."),
              is_scroll ? _(" else") : _(""));
    }
}

function seffect_magic_mapping(sobjp) { /* void */
    let sobj = sobjp[0];
    let is_scroll = +(sobj.oclass == SCROLL_CLASS);
    let sblessed = sobj.blessed;
    let scursed = sobj.cursed;
    let confused = +(Confusion() != 0);
    let cval;

    if (is_scroll) {
        if (svl.level.flags.nommap) {
            Your(_("mind is filled with crazy lines!"));
            if (Hallucination())
                pline(_("Wow!  Modern art."));
            else
                Your(_("%s spins in bewilderment."), body_part(HEAD));
            make_confused(HConfusion() + rnd(30), FALSE);
            return;
        }
        if (sblessed) {
            let x, y;

            for (x = 1; x < COLNO; x++)
                for (y = 0; y < ROWNO; y++)
                    if (levl()[x][y].typ == SDOOR) {
                        cvt_sdoor_to_door(levl()[x][y]);
                        if (Is_rogue_level(u.uz))
                            unblock_point(x, y);
                    }
            /* do_mapping() already reveals secret passages */
        }
        gk.known = TRUE;
    }

    if (svl.level.flags.nommap) {
        Your(_("%s spins as %s blocks the spell!"), body_part(HEAD),
             something());
        make_confused(HConfusion() + rnd(30), FALSE);
        return;
    }
    pline(_("A map coalesces in your mind!"));
    cval = (scursed && !confused ? 1 : 0);
    if (cval)
        u.uprops[CONFUSION].intrinsic = 1; /* to screw up map */
    notice_mon_off();
    do_mapping();
    notice_mon_on();
    if (cval) {
        u.uprops[CONFUSION].intrinsic = 0; /* restore */
        pline(_("Unfortunately, you can't grasp the details."));
    }
}

function seffect_mail(sobjp) { /* void */
    let sobj = sobjp[0];
    let odd = +((sobj.o_id % 2) == 1);

    gk.known = TRUE;
    switch (sobj.spe) {
    case 2:
        /* "stamped scroll" created via magic marker--without a stamp */
        pline(_("This scroll is marked \"%s\"."),
              odd ? _("Postage Due") : _("Return to Sender"));
        break;
    case 1:
        /* scroll of mail obtained from bones file or from wishing;
           note to the puzzled: the game Larn actually sends you junk
           mail if you win! */
        pline(_("This seems to be %s."),
              odd ? _("a chain letter threatening your luck")
              : _("junk mail addressed to the finder of the Eye of Larn"));
        break;
    default:

        readmail(sobj);

        break;
    }
}

/* scroll effects; return 1 if we use up the scroll and possibly make it
   become discovered, 0 if caller should take care of those side-effects */
export function seffects(
    sobj$) { /* int */ /* sobj - scroll or fake spellbook for spell */
    const $frame = stack_frame(); try {
    const sobj = stack_var(ptr_to(struct_obj), sobj$);
    let otyp = sobj[0].otyp;

    if (objects[otyp].oc_magic)
        exercise(A_WIS, TRUE);                       /* just for trying */

    switch (otyp) {
    case SCR_MAIL:
        seffect_mail(sobj);
        break;

    case SCR_ENCHANT_ARMOR:
        seffect_enchant_armor(sobj);
        break;
    case SCR_DESTROY_ARMOR:
        seffect_destroy_armor(sobj);
        break;
    case SCR_CONFUSE_MONSTER:
    case SPE_CONFUSE_MONSTER:
        seffect_confuse_monster(sobj);
        break;
    case SCR_SCARE_MONSTER:
    case SPE_CAUSE_FEAR:
        seffect_scare_monster(sobj);
        break;
    case SCR_BLANK_PAPER:
        seffect_blank_paper(sobj);
        break;
    case SCR_REMOVE_CURSE:
    case SPE_REMOVE_CURSE:
        seffect_remove_curse(sobj);
        break;
    case SCR_CREATE_MONSTER:
    case SPE_CREATE_MONSTER:
        seffect_create_monster(sobj);
        break;
    case SCR_ENCHANT_WEAPON:
        seffect_enchant_weapon(sobj);
        break;
    case SCR_TAMING:
    case SPE_CHARM_MONSTER:
        seffect_taming(sobj);
        break;
    case SCR_GENOCIDE:
        seffect_genocide(sobj);
        break;
    case SCR_LIGHT:
        seffect_light(sobj);
        break;
    case SCR_TELEPORTATION:
        seffect_teleportation(sobj);
        break;
    case SCR_GOLD_DETECTION:
        seffect_gold_detection(sobj);
        break;
    case SCR_FOOD_DETECTION:
    case SPE_DETECT_FOOD:
        seffect_food_detection(sobj);
        break;
    case SCR_IDENTIFY:
    case SPE_IDENTIFY:
        seffect_identify(sobj);
        break;
    case SCR_CHARGING:
        seffect_charging(sobj);
        break;
    case SCR_MAGIC_MAPPING:
    case SPE_MAGIC_MAPPING:
        seffect_magic_mapping(sobj);
        break;
    case SCR_AMNESIA:
        seffect_amnesia(sobj);
        break;
    case SCR_FIRE:
        seffect_fire(sobj);
        break;
    case SCR_EARTH:
        seffect_earth(sobj);
        break;
    case SCR_PUNISHMENT:
        seffect_punishment(sobj);
        break;
    case SCR_STINKING_CLOUD:
        seffect_stinking_cloud(sobj);
        break;
    default:
        impossible(_("What weird effect is this? (%u)"), otyp);
    }
    /* if sobj is gone, we've already called useup() above and the
       update_inventory() that it performs might have come too soon
       (before charging an item, for instance) */
    if (!sobj[0])
        update_inventory();
    return sobj[0] ? 0 : 1;
    } finally { stack_pop($frame); }
}

export function drop_boulder_on_player(
    confused,
    helmet_protects,
    byu,
    skip_uswallow) { /* void */
    let dmg;
    let otmp2;

    /* hit monster if swallowed */
    if (u.uswallow && !skip_uswallow) {
        drop_boulder_on_monster(u.ux, u.uy, confused, byu);
        return;
    }

    otmp2 = mksobj(confused ? ROCK : BOULDER, FALSE, FALSE);
    if (!otmp2)
        return;
    otmp2.quan = confused ? rn1(5, 2) : 1;
    otmp2.owt = unsigned(weight(otmp2));
    if (!amorphous(gy.youmonst.data) && !Passes_walls()
        && !noncorporeal(gy.youmonst.data) && !unsolid(gy.youmonst.data)) {
        You(_("are hit by %s!"), doname(otmp2));
        dmg = int((dmgval(otmp2, gy.youmonst) * otmp2.quan));
        if (uarmh && helmet_protects) {
            if (hard_helmet(uarmh)) {
                pline(_("Fortunately, you are wearing a hard helmet."));
                if (dmg > 2)
                    dmg = 2;
            } else if (flags.verbose) {
                pline(_("%s does not protect you."), Yname2(uarmh));
            }
        }
    } else
        dmg = 0;
    wake_nearto(u.ux, u.uy, 4 * 4);
    /* Must be before the losehp(), for bones files */
    if (!flooreffects(otmp2, u.ux, u.uy, _("fall"))) {
        place_object(otmp2, u.ux, u.uy);
        stackobj(otmp2);
        newsym(u.ux, u.uy);
    }
    if (dmg)
        losehp(Maybe_Half_Phys(dmg), _("scroll of earth"), KILLED_BY_AN);
}

export function drop_boulder_on_monster(x, y, confused, byu) { /* boolean */
    let otmp2;
    let mtmp;

    /* Make the object(s) */
    otmp2 = mksobj(confused ? ROCK : BOULDER, FALSE, FALSE);
    if (!otmp2)
        return FALSE; /* Shouldn't happen */
    otmp2.quan = confused ? rn1(5, 2) : 1;
    otmp2.owt = unsigned(weight(otmp2));

    /* Find the monster here (won't be player) */
    mtmp = m_at(x, y);
    if (mtmp && !amorphous(mtmp.data) && !passes_walls(mtmp.data)
        && !noncorporeal(mtmp.data) && !unsolid(mtmp.data)) {
        let helmet = which_armor(mtmp, W_ARMH);
        let mdmg;

        if (cansee(mtmp.mx, mtmp.my)) {
            pline(_("%s is hit by %s!"), Monnam(mtmp), doname(otmp2));
            if (mtmp.minvis && !canspotmon(mtmp))
                map_invisible(mtmp.mx, mtmp.my);
        } else if (engulfing_u(mtmp))
            You_hear(_("something hit %s %s over your %s!"),
                     s_suffix(mon_nam(mtmp)), mbodypart(mtmp, STOMACH),
                     body_part(HEAD));

        mdmg = dmgval(otmp2, mtmp) * otmp2.quan;
        if (helmet) {
            if (hard_helmet(helmet)) {
                if (canspotmon(mtmp))
                    pline(_("Fortunately, %s is wearing a hard helmet."),
                          mon_nam(mtmp));
                else if (!Deaf())
                    You_hear(_("a clanging sound."));
                if (mdmg > 2)
                    mdmg = 2;
            } else {
                if (canspotmon(mtmp))
                    pline(_("%s's %s does not protect %s."), Monnam(mtmp),
                          xname(helmet), mhim(mtmp));
            }
        }
        mtmp.mhp -= mdmg;
        if (DEADMONSTER(mtmp)) {
            if (byu) {
                killed(mtmp);
            } else {
                pline(_("%s is killed."), Monnam(mtmp));
                mondied(mtmp);
            }
        } else {
            wakeup(mtmp, byu);
        }
        wake_nearto(x, y, 4 * 4);
    } else if (engulfing_u(mtmp)) {
        obfree(otmp2, null);
        /* fall through to player */
        drop_boulder_on_player(confused, TRUE, FALSE, TRUE);
        return 1;
    }
    /* Drop the rock/boulder to the floor */
    if (!flooreffects(otmp2, x, y, _("fall"))) {
        place_object(otmp2, x, y);
        stackobj(otmp2);
        newsym(x, y); /* map the rock */
    }
    return TRUE;
}

/* overcharging any wand or zapping/engraving cursed wand */
export function wand_explode(obj, chg) { /* void */
    let expl = !chg ? _("suddenly") : _("vibrates violently and");
    let dmg, n, k;

    /* number of damage dice */
    if (!chg)
        chg = 2; /* zap/engrave adjustment */
    n = obj.spe + chg;
    if (n < 2)
        n = 2; /* arbitrary minimum */
    /* size of damage dice */
    switch (obj.otyp) {
    case WAN_WISHING:
        k = 12;
        break;
    case WAN_CANCELLATION:
    case WAN_DEATH:
    case WAN_POLYMORPH:
    case WAN_UNDEAD_TURNING:
        k = 10;
        break;
    case WAN_COLD:
    case WAN_FIRE:
    case WAN_LIGHTNING:
    case WAN_MAGIC_MISSILE:
        k = 8;
        break;
    case WAN_NOTHING:
        k = 4;
        break;
    default:
        k = 6;
        break;
    }
    /* inflict damage and destroy the wand */
    dmg = d(n, k);
    obj.in_use = TRUE; /* in case losehp() is fatal (or --More--^C) */
    pline(_("%s %s explodes!"), Yname2(obj), expl);
    losehp(Maybe_Half_Phys(dmg), _("exploding wand"), KILLED_BY_AN);
    useup(obj);
    /* obscure side-effect */
    exercise(A_STR, FALSE);
}

/* used to collect gremlins being hit by light so that they can be processed
   after vision for the entire lit area has been brought up to date */
const struct_litmon = struct("struct_litmon", {
    mon: ptr_to("struct_monst"),
    nxt: ptr_to("struct_litmon"),
});
const gremlins = static_var("gremlins", ptr_to(struct_litmon), null);

/*
 * Low-level lit-field update routine.
 */
function set_lit(x, y, val) { /* void */
    let mtmp;
    let gremlin;

    if (val) {
        levl()[x][y].lit = 1;
        if ((mtmp = m_at(x, y)) != null && mtmp.data == mons[PM_GREMLIN]) {
            gremlin = view_of(struct_litmon, addr_of(alloc(sizeof(struct_litmon))));
            gremlin.mon = mtmp;
            gremlin.nxt = gremlins[0];
            gremlins[0] = gremlin;
        }
    } else {
        levl()[x][y].lit = 0;
        snuff_light_source(x, y);
    }
}

export function litroom(
    on,
    obj) { /* void */ /* scroll, spellbook (for spell), or wand of light */
    const $frame = stack_frame(); try {
    let otmp, nextobj;
    let blessed_effect = (obj && obj.oclass == SCROLL_CLASS
                              && obj.blessed ? 1 : 0);
    let no_op = (u.uswallow || Underwater() || Is_waterlevel(u.uz) ? 1 : 0);
    let is_lit = stack_var(char, 0); /* value is irrelevant but assign something anyway; its
                      * address is used as a 'not null' flag for set_lit() */

    /* update object lights and produce message (provided you're not blind) */
    if (!on) {
        let still_lit = 0;

        /*
         * The magic douses lamps,&c too and might curse artifact lights.
         *
         * FIXME?
         *  Shouldn't this affect all lit objects in the area of effect
         *  rather than just those carried by the hero?
         */
        for (otmp = gi.invent; otmp; otmp = nextobj) {
            nextobj = otmp.nobj;
            if (otmp.lamplit) {
                if (!artifact_light(otmp))
                    snuff_lit(otmp);
                else
                    /* wielded Sunsword or worn gold dragon scales/mail;
                       maybe lower its BUC state if not already cursed */
                    impact_arti_light(otmp, TRUE, (+!Blind()));

                if (otmp.lamplit)
                    ++still_lit;
            }
        }
        /* scroll of light becomes discovered when not blind, so some
           message to justify that is needed */
        if (!Blind()) {
            /* for the still_lit case, we don't know at this point whether
               anything currently visibly lit is going to go dark; if this
               message came after the darkening, we could count visibly
               lit squares before and after to know; we do know that being
               swallowed won't be affected--the interior is still lit */
            if (still_lit)
                pline_The(_("ambient light seems dimmer."));
            else if (u.uswallow)
                pline(_("It seems even darker in here than before."));
            else
                You(_("are surrounded by darkness!"));
        }
    } else { /* on */
        if (blessed_effect) {
            /* might bless artifact lights; no effect on ordinary lights */
            for (otmp = gi.invent; otmp; otmp = nextobj) {
                nextobj = otmp.nobj;
                if (otmp.lamplit && artifact_light(otmp))
                    /* wielded Sunsword or worn gold dragon scales/mail;
                       maybe raise its BUC state if not already blessed */
                    impact_arti_light(otmp, FALSE, (+!Blind()));
            }
        }
        if (u.uswallow) {
            if (Blind())
                ; /* no feedback */
            else if (digests(u.ustuck.data))
                pline(_("%s %s is lit."), s_suffix(Monnam(u.ustuck)),
                      mbodypart(u.ustuck, STOMACH));
            else if (is_whirly(u.ustuck.data))
                pline(_("%s shines briefly."), Monnam(u.ustuck));
            else
                pline(_("%s glistens."), Monnam(u.ustuck));
        } else if (!Blind() && (!Is_rogue_level(u.uz)
                              || levl()[u.ux][u.uy].typ != CORR)) {
            pline(_("A lit field %ssurrounds you!"), no_op ? _("briefly ") : _(""));
        }
    }

    /* No-op when swallowed or in water */
    if (no_op)
        return;
    /*
     *  If we are darkening the room and the hero is punished but not
     *  blind, then we have to pick up and replace the ball and chain so
     *  that we don't remember them if they are out of sight.
     */
    if (Punished() && !on && !Blind())
        move_bc(1, 0, uball.ox, uball.oy, uchain.ox, uchain.oy);

    if (Is_rogue_level(u.uz)) {
        /* Can't use do_clear_area because MAX_RADIUS is too small */
        /* rogue lighting must light the entire room */
        let rnum = levl()[u.ux][u.uy].roomno - ROOMOFFSET;
        let rx, ry;

        if (rnum >= 0) {
            for (rx = svr.rooms[rnum].lx - 1; rx <= svr.rooms[rnum].hx + 1;
                 rx++)
                for (ry = svr.rooms[rnum].ly - 1;
                     ry <= svr.rooms[rnum].hy + 1; ry++)
                    set_lit(rx, ry,
                            (on ? addr_of(is_lit) : 0));
            svr.rooms[rnum].rlit = on;
        }
        /* hallways remain dark on the rogue level */
    } else if (is_art(obj, ART_SUNSWORD)) {
        /* Sunsword's #invoke power directed up or down lights hero's spot
           (do_clear_area() rejects radius 0 so call set_lit() directly) */
        set_lit(u.ux, u.uy, addr_of(is_lit));
    } else {
        do_clear_area(u.ux, u.uy, blessed_effect ? 9 : 5,
                      set_lit, (on ? addr_of(is_lit) : 0));
    }

    /*
     *  If we are not blind, then force a redraw on all positions in sight
     *  by temporarily blinding the hero.  The vision recalculation will
     *  correctly update all previously seen positions *and* correctly
     *  set the waslit bit [could be messed up from above].
     */
    if (!Blind()) {
        vision_recalc(2);

        /* replace ball&chain */
        if (Punished() && !on)
            move_bc(0, 0, uball.ox, uball.oy, uchain.ox, uchain.oy);
    }

    gv.vision_full_recalc = 1; /* delayed vision recalculation */
    if (gremlins[0]) {
        let gremlin;

        /* can't delay vision recalc after all */
        vision_recalc(0);
        /* after vision has been updated, monsters who are affected
           when hit by light can now be hit by it */
        do {
            gremlin = gremlins[0];
            gremlins[0] = gremlin.nxt;
            light_hits_gremlin(gremlin.mon, rnd(5));
            free(addr_of(gremlin));
        } while (gremlins[0]);
    }
    return;
    } finally { stack_pop($frame); }
}

function do_class_genocide() { /* void */
    const $frame = stack_frame(); try {
    let i, j, immunecnt, gonecnt, goodcnt, class_, feel_dead = 0;
    let ll_done = 0;
    let buf = stack_array(char, BUFSZ), promptbuf = stack_array(char, QBUFSZ);
    let gameover = FALSE; /* true iff killed self */

    chars[buf + 0] = ord('\0'); /* for EDIT_GETLIN */
    for (j = 0; ; j++) {
        if (j >= 5) {
            pline1(thats_enough_tries());
            return;
        }
        strcpy(promptbuf, _("What class of monsters do you want to genocide?"));
        if (j > 0)
            Snprintf(eos(promptbuf), unsigned(sizeof(array_of(char, QBUFSZ)) - strlen(promptbuf)), _(" [enter %s]"), iflags.cmdassist
                       ? _("the symbol or name representing a class, or '?'")
                       : _("'?' to see previous genocides"))

;
        getlin(promptbuf, buf);
        mungspaces(buf);
        /* avoid 'that does not represent any monster' for empty input */
        if (!chars[buf]) {
            pline(_("%s."), (j + 1 < 5)
                         ? _("Type letter (or punctuation)" +
                           " or name used for a class of monsters or 'none'")
                         /* next iteration gives "that's enough tries"
                            so don't suggest typing anything this time */
                         : _("No class of monsters specified"));
            continue; /* try again */
        }
        /* choosing "none" preserves genocideless conduct */
        if (chars[buf] == ord('\x1b') || !strncmpi((buf), _(("none")), -1)
            || !strncmpi((buf), _(("'none'")), -1) || !strncmpi((buf), _(("nothing")), -1)) {
            livelog_printf(LL_GENOCIDE,
                           _("declined to perform class genocide"));
            return;
        }
        /* "?" runs #genocided to show existing genocides, then re-prompts;
           accept "'?'" too because the prompt's hint shows it that way */
        if (!strcmp(buf, _("?")) || !strcmp(buf, _("'?'"))) {
            list_genocided(ord('g'), FALSE);
            --j; /* don't count this iteration as one of the tries */
            continue;
        }

        class_ = name_to_monclass(buf, null);
        if (class_ == 0 && (i = name_to_mon(buf, null)) != NON_PM)
            class_ = mons[i].mlet;
        immunecnt = gonecnt = goodcnt = 0;
        for (i = LOW_PM; i < NUMMONS; i++) {
            if (mons[i].mlet == class_) {
                if (!(mons[i].geno & G_GENO))
                    immunecnt++;
                else if (svm.mvitals[i].mvflags & G_GENOD)
                    gonecnt++;
                else
                    goodcnt++;
            }
        }
        if (!goodcnt && class_ != mons[gu.urole.mnum].mlet
            && class_ != mons[gu.urace.mnum].mlet) {
            if (gonecnt)
                pline(_("All such monsters are already nonexistent."));
            else if (immunecnt || class_ == S_invisible)
                You(_("aren't permitted to genocide such monsters."));
            else if (wizard() && chars[buf + 0] == ord('*')) {
                let mtmp, mtmp2;

                gonecnt = 0;
                for (mtmp = fmon(); mtmp; mtmp = mtmp2) {
                    mtmp2 = mtmp.nmon;
                    if (DEADMONSTER(mtmp))
                        continue;
                    mongone(mtmp);
                    gonecnt++;
                }
                pline(_("Eliminated %d monster%s."), gonecnt, plur(gonecnt));
                return;
            } else
                pline(_("That %s does not represent any monster."),
                      strlen(buf) == 1 ? _("symbol") : _("response"));
            continue;
        }

        for (i = LOW_PM; i < NUMMONS; i++) {
            if (mons[i].mlet == class_) {
                let nam = stack_array(char, BUFSZ);

                strcpy(nam, makeplural(mons[i].pmnames[NEUTRAL]));
                /* Although "genus" is Latin for race, the hero benefits
                 * from both race and role; thus genocide affects either.
                 */
                if (Your_Own_Role(i) || Your_Own_Race(i)
                    || ((mons[i].geno & G_GENO)
                        && !(svm.mvitals[i].mvflags & G_GENOD))) {
                    /* This check must be first since player monsters might
                     * have G_GENOD or !G_GENO.
                     */
                    if (!ll_done++) {
                        if (!num_genocides())
                            livelog_printf(LL_CONDUCT | LL_GENOCIDE,
                                     _("performed %s first genocide (class %c)"),
                                           uhis(), def_monsyms[class_].sym);
                        else
                            livelog_printf(LL_GENOCIDE, _("genocided class %c"),
                                           def_monsyms[class_].sym);
                    }

                    svm.mvitals[i].mvflags |= (G_GENOD | G_NOCORPSE);
                    kill_genocided_monsters();
                    update_inventory(); /* eggs & tins */
                    pline(_("Wiped out all %s."), nam);
                    if (Upolyd() && vampshifted(gy.youmonst)
                        /* current shifted form or base vampire form */
                        && (i == u.umonnum || i == gy.youmonst.cham))
                        polyself(POLY_REVERT); /* vampshifter to vampire */
                    if (Upolyd() && i == u.umonnum) {
                        u.mh = -1;
                        if (Unchanging()) {
                            if (!feel_dead++)
                                urgent_pline(_("You die."));
                            /* finish genociding this class of
                               monsters before ultimately dying */
                            gameover = TRUE;
                        } else
                            rehumanize();
                    }
                    /* Self-genocide if it matches either your race
                       or role.  Assumption:  male and female forms
                       share same monster class. */
                    if (i == gu.urole.mnum || i == gu.urace.mnum) {
                        u.uhp = -1;
                        if (Upolyd()) {
                            if (!feel_dead++)
                                You_feel(_("%s inside."), udeadinside());
                        } else {
                            if (!feel_dead++)
                                urgent_pline(_("You die."));
                            gameover = TRUE;
                        }
                    }
                } else if (svm.mvitals[i].mvflags & G_GENOD) {
                    if (!gameover)
                        pline(_("%s are already nonexistent."), upstart(nam));
                } else if (!gameover) {
                    /* suppress feedback about quest beings except
                       for those applicable to our own role */
                    if ((mons[i].msound != MS_LEADER
                         || quest_info(MS_LEADER) == i)
                        && (mons[i].msound != MS_NEMESIS
                            || quest_info(MS_NEMESIS) == i)
                        && (mons[i].msound != MS_GUARDIAN
                            || quest_info(MS_GUARDIAN) == i)
                        /* non-leader/nemesis/guardian role-specific monster
                           */
                        && (i != PM_NINJA /* nuisance */
                            || Role_if(PM_SAMURAI))) {
                        let named, uniq;

                        named = type_is_pname(mons[i]) ? TRUE : FALSE;
                        uniq = (mons[i].geno & G_UNIQ) ? TRUE : FALSE;
                        /* one special case */
                        if (i == PM_HIGH_CLERIC)
                            uniq = FALSE;

                        You(_("aren't permitted to genocide %s%s."),
                            (uniq && !named) ? _("the ") : _(""),
                            (uniq || named) ? mons[i].pmnames[NEUTRAL] : nam);
                    }
                }
            }
        }
        if (gameover || u.uhp == -1) {
            svk.killer.format = KILLED_BY_AN;
            strcpy(svk.killer.name, _("scroll of genocide"));
            if (gameover)
                done(GENOCIDED);
        }
        return;
    }
    } finally { stack_pop($frame); }
}

export const REALLY = 1;
export const PLAYER = 2;
export const ONTHRONE = 4;
export function do_genocide(
    how) { /* void */ /* 0 = no genocide; create monsters (cursed scroll) * 1 = normal genocide * 3 = forced genocide of player * 5 (4 | 1) = normal genocide from throne */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ), realbuf = stack_array(char, BUFSZ), promptbuf = stack_array(char, QBUFSZ);
    let i, killplayer = 0;
    let mndx;
    let ptr;
    let which;

    if (how & PLAYER) {
        mndx = u.umonster; /* non-polymorphed mon num */
        ptr = mons[mndx];
        strcpy(buf, pmname(ptr, Ugender()));
        killplayer++;
    } else {
        chars[buf + 0] = ord('\0'); /* init for EDIT_GETLIN */
        for (i = 0; ; i++) {
            if (i >= 5) {
                /* cursed effect => no free pass (unless rndmonst() fails) */
                if (!(how & REALLY) && (ptr = rndmonst()) != null)
                    break;

                pline1(thats_enough_tries());
                return;
            }
            strcpy(promptbuf, _("What type of monster do you want to genocide?"))
;
            if (i > 0)
                Snprintf(eos(promptbuf), unsigned(sizeof(array_of(char, QBUFSZ)) - strlen(promptbuf)), _(" [enter %s]"), iflags.cmdassist
                           ? _("the name of a type of monster, or '?'")
                           : _("'?' to see previous genocides"))

;
            getlin(promptbuf, buf);
            mungspaces(buf);
            /* avoid 'such creatures do not exist' for empty input */
            if (!chars[buf]) {
                pline(_("%s."), (i + 1 < 5)
                             ? _("Type the name of a type of monster or 'none'")
                             /* next iteration gives "that's enough tries"
                                so don't suggest typing anything this time */
                             : _("No type of monster specified"));
                continue; /* try again */
            }
            /* choosing "none" preserves genocideless conduct */
            if (chars[buf] == ord('\x1b') || !strncmpi((buf), _(("none")), -1)
                || !strncmpi((buf), _(("'none'")), -1) || !strncmpi((buf), _(("nothing")), -1)) {
                /* ... but no free pass if cursed */
                if (!(how & REALLY) && (ptr = rndmonst()) != null)
                    break; /* remaining checks don't apply */

                livelog_printf(LL_GENOCIDE, _("declined to perform genocide"));
                return;
            }
            /* "?" or "'?'" runs #genocided to show existing genocides */
            if (!strcmp(buf, _("?")) || !strcmp(buf, _("'?'"))) {
                list_genocided(ord('g'), FALSE);
                --i; /* don't count this iteration as one of the tries */
                continue;
            }

            mndx = name_to_mon(buf, null);
            if (mndx == NON_PM || (svm.mvitals[mndx].mvflags & G_GENOD)) {
                pline(_("Such creatures %s exist in this world."),
                      (mndx == NON_PM) ? _("do not") : _("no longer"));
                continue;
            }
            ptr = mons[mndx];
            /* first revert if current shifted form or base vampire form */
            if (Upolyd() && vampshifted(gy.youmonst)
                && (mndx == u.umonnum || mndx == gy.youmonst.cham))
                polyself(POLY_REVERT); /* vampshifter (bat, &c) to vampire */
            /* Although "genus" is Latin for race, the hero benefits
             * from both race and role; thus genocide affects either.
             */
            if (Your_Own_Role(mndx) || Your_Own_Race(mndx)) {
                killplayer++;
                break;
            }
            if (is_human(ptr))
                adjalign(-sgn(u.ualign.type));
            if (is_demon(ptr))
                adjalign(sgn(u.ualign.type));

            if (!(ptr.geno & G_GENO)) {
                if (!Deaf()) {
                    /* FIXME: unconditional "caverns" will be silly in some
                     * circumstances.  Who's speaking?  Divine pronouncements
                     * aren't supposed to be hampered by deafness....
                     */
                    if (flags.verbose)
                        pline(_("A thunderous voice booms" +
                              " through the caverns:"));
                          ;
                    /* FIXME? shouldn't this override deafness? */
                    verbalize(_("No, mortal!  That will not be done."));
                }
                continue;
            }
            /* KMH -- Unchanging prevents rehumanization */
            if (Unchanging() && ptr == gy.youmonst.data)
                killplayer++;
            break;
        }
        mndx = monsndx(ptr); /* needed for the 'no free pass' cases */
    }

    which = _("all ");
    strcpy(realbuf, ptr.pmnames[NEUTRAL]); /* standard singular */
    if (Hallucination()) {
        /* hallucinate hero's type */
        if (Upolyd()) {
            strcpy(buf, pmname(gy.youmonst.data,
                               flags.female ? FEMALE : MALE));
        } else {
            strcpy(buf, (flags.female && gu.urole.name.f) ? gu.urole.name.f
                                                          : gu.urole.name.m);
            chars[buf + 0] = lowc(chars[buf + 0]);
        }
    } else {
        /* use actual type */
        strcpy(buf, realbuf);
        if ((ptr.geno & G_UNIQ) && ptr != mons[PM_HIGH_CLERIC])
            which = !type_is_pname(ptr) ? _("the ") : _("");
    }

    if (how & REALLY) {
        if (!num_genocides())
            livelog_printf(LL_CONDUCT | LL_GENOCIDE,
                           _("performed %s first genocide (%s)"),
                           uhis(), makeplural(realbuf));
        else
            livelog_printf(LL_GENOCIDE, _("genocided %s"), makeplural(realbuf));

        /* setting no-corpse affects wishing and random tin generation */
        svm.mvitals[mndx].mvflags |= (G_GENOD | G_NOCORPSE);
        pline(_("Wiped out %s%s."), which,
              (chars[which] != ord('a')) ? buf : makeplural(buf));

        if (killplayer) {
            u.uhp = -1;
            if (how & PLAYER) {
                svk.killer.format = KILLED_BY;
                strcpy(svk.killer.name, _("genocidal confusion"));
            } else if (how & ONTHRONE) {
                /* player selected while on a throne */
                svk.killer.format = KILLED_BY_AN;
                strcpy(svk.killer.name, _("imperious order"));
            } else { /* selected player deliberately, not confused */
                svk.killer.format = KILLED_BY_AN;
                strcpy(svk.killer.name, _("scroll of genocide"));
            }

            /* Polymorphed characters will die as soon as they're rehumanized.
               KMH -- Unchanging prevents rehumanization. */
            if (Upolyd() && ptr != gy.youmonst.data) {
                delayed_killer(POLYMORPH, svk.killer.format, svk.killer.name);
                You_feel(_("%s inside."), udeadinside());
            } else {
                done(GENOCIDED);
            }
        } else if (ptr == gy.youmonst.data) {
            rehumanize();
        }
        kill_genocided_monsters();
        update_inventory(); /* in case identified eggs were affected */
    } else {
        let cnt = 0, census = monster_census(FALSE);

        if (!(mons[mndx].geno & G_UNIQ)
            && !(svm.mvitals[mndx].mvflags & (G_GENOD | G_EXTINCT)))
            for (i = rn1(3, 4); i > 0; i--) {
                if (!makemon(ptr, u.ux, u.uy, NO_MINVENT | MM_NOMSG))
                    break; /* couldn't make one */
                ++cnt;
                if (svm.mvitals[mndx].mvflags & G_EXTINCT)
                    break; /* just made last one */
            }
        if (cnt) {
            /* accumulated 'cnt' doesn't take groups into account;
               assume bringing in new mon(s) didn't remove any old ones */
            cnt = monster_census(FALSE) - census;
            pline(_("Sent in %s%s."), (cnt > 1) ? _("some ") : _(""),
                  (cnt > 1) ? makeplural(buf) : an(buf));
        } else
            pline1(nothing_happens());
    }
    } finally { stack_pop($frame); }
}

export function punish(sobj) { /* void */
    /* angrygods() calls this with NULL sobj arg */
    let reuse_ball = (sobj && sobj.otyp == HEAVY_IRON_BALL)
                                ? sobj : null;
    /* analyzer doesn't know that the one caller that passes a NULL
     * sobj (angrygods) checks !Punished first, so add a guard */
    let cursed_levy = (sobj && sobj.cursed) ? 1 : 0;

    /* KMH -- Punishment is still okay when you are riding */
    if (!reuse_ball)
        You(_("are being punished for your misbehavior!"));
    if (Punished()) {
        Your(_("iron ball gets heavier."));
        uball.owt += unsigned(WT_IRON_BALL_INCR * (1 + cursed_levy));
        return;
    }
    if (amorphous(gy.youmonst.data) || is_whirly(gy.youmonst.data)
        || unsolid(gy.youmonst.data)) {
        if (!reuse_ball) {
            pline(_("A ball and chain appears, then falls away."));
            dropy(mkobj(BALL_CLASS, TRUE));
        } else {
            dropy(reuse_ball);
        }
        return;
    }
    setworn(mkobj(CHAIN_CLASS, TRUE), W_CHAIN);
    if (!reuse_ball)
        setworn(mkobj(BALL_CLASS, TRUE), W_BALL);
    else
        setworn(reuse_ball, W_BALL);

    /*
     *  Place ball & chain if not swallowed.  If swallowed, the ball & chain
     *  variables will be set at the next call to placebc().
     */
    if (!u.uswallow) {
        placebc();
        if (Blind())
            set_bc(1);      /* set up ball and chain variables */
        newsym(u.ux, u.uy); /* see ball&chain if can't see self */
    }
}

/* remove the ball and chain */
export function unpunish() { /* void */
    let savechain = uchain;

    /* chain goes away */
    setworn(null, W_CHAIN); /* sets 'uchain' to Null */
    /* for floor, unhides monster hidden under chain, calls newsym() */
    delobj(savechain);

    /* the chain is gone but the no longer attached ball persists */
    setworn(null, W_BALL); /* sets 'uball' to Null */
}

/* prompt the player to create a stinking cloud and then create it if they
   give a location */
function do_stinking_cloud(sobj, mention_stinking) { /* void */
    const $frame = stack_frame(); try {
    let cc = stack_struct(struct_nhcoord);

    pline(_("Where do you want to center the %scloud?"),
          mention_stinking ? _("stinking ") : _(""));
    cc.x = u.ux;
    cc.y = u.uy;
    getpos_sethilite(display_stinking_cloud_positions, can_center_cloud);
    if (getpos(cc, TRUE, _("the desired position")) < 0) {
        pline1(Never_mind());
        return;
    } else if (!can_center_cloud(cc.x, cc.y)) {
        if (Hallucination())
            pline(_("Ugh... someone cut the cheese."));
        else
            pline(_("%s a whiff of rotten eggs."),
                  sobj.oclass == SCROLL_CLASS ? _("The scroll crumbles with")
                                               : _("You smell"));
        return;
    }
    create_gas_cloud(cc.x, cc.y, 15 + 10 * bcsign(sobj),
                            8 + 4 * bcsign(sobj));
    } finally { stack_pop($frame); }
}

/* some creatures have special data structures that only make sense in their
 * normal locations -- if the player tries to create one elsewhere, or to
 * revive one, the disoriented creature becomes a zombie
 */
export function cant_revive(
    mtype,
    revival,
    from_obj) { /* boolean */
    /* SHOPKEEPERS can be revived now */
    if (mtype[0] == PM_GUARD || (mtype[0] == PM_SHOPKEEPER && !revival)
        || mtype[0] == PM_HIGH_CLERIC || mtype[0] == PM_ALIGNED_CLERIC
        || mtype[0] == PM_ANGEL) {
        mtype[0] = PM_HUMAN_ZOMBIE;
        return TRUE;
    } else if (mtype[0] == PM_LONG_WORM_TAIL) { /* for create_particular() */
        mtype[0] = PM_LONG_WORM;
        return TRUE;
    } else if (unique_corpstat(mons[mtype[0]])
               && (!from_obj || !has_omonst(from_obj))) {
        /* unique corpses (from bones or wizard mode wish) or
           statues (bones or any wish) end up as shapechangers */
        mtype[0] = PM_DOPPELGANGER;
        return TRUE;
    }
    return FALSE;
}

function create_particular_parse(
    str,
    d) { /* boolean */
    const $frame = stack_frame(); try {
    let gender_name_var = stack_var(int, NEUTRAL);
    let bufp = str;
    let tmpp;

    d.quan = 1 + ((gm.multi > 0) ? int(gm.multi) : 0);
    d.monclass = MAXMCLASSES;
    d.which = gu.urole.mnum; /* an arbitrary index into mons[] */
    d.fem = -1;     /* gender not specified */
    d.genderconf = -1;  /* no confusion on which gender to assign */
    d.randmonst = FALSE;
    d.maketame = d.makepeaceful = d.makehostile = FALSE;
    d.sleeping = d.saddled = d.invisible = d.hidden = FALSE;

    /* quantity */
    if (digit(chars[bufp])) {
        d.quan = atoi(bufp);
        while (digit(chars[bufp]))
            bufp++;
        while (chars[bufp] == ord(' '))
            bufp++;
    }

    /* maximum possible quantity is one per cell: (0..ROWNO-1) x (1..COLNO-1)
       [21*79==1659 for default map size; could subtract 1 for hero's spot] */
    if (d.quan < 1 || d.quan > QUAN_LIMIT)
        d.quan = QUAN_LIMIT - monster_census(FALSE);

    /* gear -- extremely limited number of possibilities supported */
    if ((tmpp = strstri(bufp, _("saddled "))) != 0) {
        d.saddled = TRUE;
        memset(tmpp, ord(' '), sizeof_string("saddled ") - 1);
    }
    /* state -- limited number of possibilities supported */
    if ((tmpp = strstri(bufp, _("sleeping "))) != 0) {
        d.sleeping = TRUE;
        memset(tmpp, ord(' '), sizeof_string("sleeping ") - 1);
    }
    if ((tmpp = strstri(bufp, _("invisible "))) != 0) {
        d.invisible = TRUE;
        memset(tmpp, ord(' '), sizeof_string("invisible ") - 1);
    }
    if ((tmpp = strstri(bufp, _("hidden "))) != 0) {
        d.hidden = TRUE;
        memset(tmpp, ord(' '), sizeof_string("hidden ") - 1);
    }
    /* check "female" before "male" to avoid false hit mid-word */
    if ((tmpp = strstri(bufp, _("female "))) != 0) {
        d.fem = 1;
        memset(tmpp, ord(' '), sizeof_string("female ") - 1);
    }
    if ((tmpp = strstri(bufp, _("male "))) != 0) {
        d.fem = 0;
        memset(tmpp, ord(' '), sizeof_string("male ") - 1);
    }
    bufp = mungspaces(bufp); /* after potential memset(' ') */
    /* allow the initial disposition to be specified */
    if (!strncmpi(bufp, _("tame "), 5)) {
        bufp += 5;
        d.maketame = TRUE;
    } else if (!strncmpi(bufp, _("peaceful "), 9)) {
        bufp += 9;
        d.makepeaceful = TRUE;
    } else if (!strncmpi(bufp, _("hostile "), 8)) {
        bufp += 8;
        d.makehostile = TRUE;
    }
    /* decide whether a valid monster was chosen */
    if (wizard() && (!strcmp(bufp, _("*")) || !strcmp(bufp, _("random")))) {
        d.randmonst = TRUE;
        return TRUE;
    }
    d.which = name_to_mon(bufp, gender_name_var);
    /*
     * With the introduction of male and female monster names
     * in 5.0, preserve that detail.
     *
     * If d->fem is already set to MALE or FEMALE at this juncture, it means
     * one of those terms was explicitly specified.
     */
    if (d.fem == MALE || d.fem == FEMALE) {     /* explicitly expressed */
        if ((gender_name_var[0] != NEUTRAL) && (d.fem != gender_name_var[0])) {
            /* apparent selection incompatibility */
            d.genderconf = gender_name_var[0];        /* resolve later */
        }
        /* otherwise keep the value of d->fem, as it's okay */
    } else {  /* no explicit gender term was specified */
        d.fem = gender_name_var[0];
    }
    if (ismnum(d.which))
        return TRUE; /* got one */
    d.monclass = name_to_monclass(bufp, ref_of(d, "which"));

    if (ismnum(d.which)) {
        d.monclass = MAXMCLASSES; /* matters below */
        return TRUE;
    } else if (d.monclass == S_invisible) { /* not an actual monster class */
        d.which = PM_STALKER;
        d.monclass = MAXMCLASSES;
        return TRUE;
    } else if (d.monclass == S_WORM_TAIL) { /* empty monster class */
        d.which = PM_LONG_WORM;
        d.monclass = MAXMCLASSES;
        return TRUE;
    } else if (d.monclass > 0) {
        d.which = gu.urole.mnum; /* reset from NON_PM */
        return TRUE;
    }
    return FALSE;
    } finally { stack_pop($frame); }
}
export const QUAN_LIMIT = (ROWNO * (COLNO - 1));

function create_particular_creation(
    d) { /* boolean */
    const $frame = stack_frame(); try {
    let whichpm = null;
    let i, mx, my, firstchoice = NON_PM;
    let mtmp;
    let madeany = FALSE;

    if (!d.randmonst) {
        firstchoice = d.which;
        if (cant_revive(ref_of(d, "which"), FALSE, null)
            && firstchoice != PM_LONG_WORM_TAIL) {
            /* wizard mode can override handling of special monsters */
            let buf = stack_array(char, BUFSZ);

            sprintf(buf, _("Creating %s instead; force %s?"), mons[d.which].pmnames[NEUTRAL], mons[firstchoice].pmnames[NEUTRAL])

;
            if (y_n(buf) == ord('y'))
                d.which = firstchoice;
        }
        whichpm = mons[d.which];
    }
    for (i = 0; i < d.quan; i++) {
        let mmflags = NO_MM_FLAGS;

        if (d.monclass != MAXMCLASSES)
            whichpm = mkclass(d.monclass, 0);
        else if (d.randmonst)
            whichpm = rndmonst();
        if (d.genderconf == -1) {
            /* no conflict exists between explicit gender term and
               the specified monster name */
            if (d.fem != -1 && (!whichpm || (!is_male(whichpm)
                                              && !is_female(whichpm))))
                mmflags = or64(mmflags, (d.fem == FEMALE) ? MM_FEMALE
                               : (d.fem == MALE) ? MM_MALE : 0);
            /* no surprise; "<mon> appears." rather than "<mon> appears!" */
            mmflags = or64(mmflags, MM_NOEXCLAM);
        } else {
            /* conundrum alert: an explicit gender term conflicts with an
               explicit gender-tied naming term (i.e. male cavewoman) */

            /* option not gone with: name overrides the explicit gender as
               commented out here */
            /*  d->fem = d->genderconf; */

            /* option chosen: let the explicit gender term (male or female)
               override the gender-tied naming term, so leave d->fem as-is */

            mmflags = or64(mmflags, (d.fem == FEMALE) ? MM_FEMALE
                           : (d.fem == MALE) ? MM_MALE : 0);

            /* another option would be to consider it a faulty specification
               and reject the request completely and produce a random monster
               with a gender matching that specified instead (i.e. there is
               no such thing as a male cavewoman) */
            /* whichpm = rndmonst(); */
            /* mmflags |= (d->fem == FEMALE) ? MM_FEMALE : MM_MALE; */
        }
        if (d.invisible)
            mmflags = or64(mmflags, MM_MINVIS);

        mtmp = makemon(whichpm, u.ux, u.uy, mmflags);
        if (!mtmp) {
            /* quit trying if creation failed and is going to repeat */
            if (d.monclass == MAXMCLASSES && !d.randmonst)
                break;
            /* otherwise try again */
            continue;
        }
        mx = mtmp.mx, my = mtmp.my;
        if (d.maketame) {
            tamedog(mtmp, null, FALSE);
        } else if (d.makepeaceful || d.makehostile) {
            mtmp.mtame = 0; /* sanity precaution */
            mtmp.mpeaceful = d.makepeaceful ? 1 : 0;
            set_malign(mtmp);
        }
        if (d.saddled && can_saddle(mtmp) && !which_armor(mtmp, W_SADDLE)) {
            /* NULL obj arg means put_saddle_on_mon()
             * will create the saddle itself */
            put_saddle_on_mon(null, mtmp);
        }
        if (d.hidden
           && ((is_hider(mtmp.data) && mtmp.data.mlet != S_MIMIC)
               || (hides_under(mtmp.data) && OBJ_AT(mx, my))
               || (mtmp.data.mlet == S_EEL && is_pool(mx, my))))
            mtmp.mundetected = 1;
        if (d.sleeping)
            mtmp.msleeping = 1;
        /* if asking for 'hidden', show location of every created monster
           that can't be seen--whether that's due to successfully hiding
           or vision issues (line-of-sight, invisibility, blindness) */
        if ((d.hidden || d.invisible) && !canspotmon(mtmp))
            flash_mon(mtmp);

        madeany = TRUE;
        /* in case we got a doppelganger instead of what was asked
           for, make it start out looking like what was asked for */
        if (mtmp.cham != NON_PM && firstchoice != NON_PM
            && mtmp.cham != firstchoice)
            newcham(mtmp, mons[firstchoice], NO_NC_FLAGS);
    }
    return madeany;
    } finally { stack_pop($frame); }
}

/*
 * Make a new monster with the type controlled by the user.
 *
 * Note:  when creating a monster by class letter, specifying the
 * "strange object" (']') symbol produces a random monster rather
 * than a mimic.  This behavior quirk is useful so don't "fix" it
 * (use 'm'--or "mimic"--to create a random mimic).
 *
 * Used in wizard mode only (for ^G command and for scroll or spell
 * of create monster).  Once upon a time, an earlier incarnation of
 * this code was also used for the scroll/spell in explore mode.
 */
export function create_particular() { /* boolean */
    const $frame = stack_frame(); try {
    let d = stack_struct(struct__create_particular_data);
    let bufp, buf = stack_array(char, BUFSZ), prompt = stack_array(char, QBUFSZ);
    let tryct = CP_TRYLIM, altmsg = 0;

    chars[buf + 0] = ord('\0'); /* for EDIT_GETLIN */
    strcpy(prompt, _("Create what kind of monster?"));
    do {
        getlin(prompt, buf);
        bufp = mungspaces(buf);
        if (chars[bufp] == ord('\x1b'))
            return FALSE;

        if (create_particular_parse(bufp, d))
            break;

        /* no good; try again... */
        if (chars[bufp] || altmsg || tryct < 2) {
            pline(_("I've never heard of such monsters."));
        } else {
            pline(_("Try again (type * for random, ESC to cancel)."));
            ++altmsg;
        }
        /* when a second try is needed, expand the prompt */
        if (tryct == CP_TRYLIM)
            strcat(prompt, _(" [type name or symbol]"));
    } while (--tryct > 0);

    if (!tryct)
        pline1(thats_enough_tries());
    else
        return create_particular_creation(d);

    return FALSE;
    } finally { stack_pop($frame); }
}
export const CP_TRYLIM = 5;

/*read.c*/

import { ART_ORB_OF_FATE, ART_SUNSWORD } from "./artilist.h.js";
import { A_CON, A_STR, A_WIS } from "./attrib.h.js";
import { struct_nhcoord } from "./coord.h.js";
import {
    NH_AMBER, NH_BLACK, NH_BLUE, NH_GOLDEN, NH_LIGHT_BLUE, NH_PURPLE, NH_RED, NH_SILVER, NH_WHITE,
    Never_mind, nothing_happens, silly_thing_to, something, thats_enough_tries,
} from "./decl.h.macros.js";
import {
    ARMOR_CLASS, BALL_CLASS, CHAIN_CLASS, COIN_CLASS, GEM_CLASS, MAXMCLASSES, RING_CLASS,
    SCROLL_CLASS, SPBOOK_CLASS, S_EEL, S_HUMAN, S_MIMIC, S_WORM_TAIL, S_goodpos, S_invisible,
    TOOL_CLASS, WAND_CLASS, WEAPON_CLASS,
} from "./defsym.h.js";
import { DISP_BEAM, DISP_END, EXPL_FIERY } from "./display.h.js";
import { canspotmon, cmap_to_glyph } from "./display.h.macros.js";
import { In_endgame, Is_earthlevel, Is_rogue_level, Is_waterlevel } from "./dungeon.h.macros.js";
import { PLNMSG_TOWER_OF_FLAME } from "./flag.h.js";
import { notice_mon_off, notice_mon_on, wizard } from "./flag.h.macros.js";
import { BUFSZ, COLNO, FALSE, LL_CONDUCT, LL_GENOCIDE, QBUFSZ, ROWNO, TRUE } from "./global.h.js";
import {
    BY_COOKIE, COST_DECHNT, COST_DEGRD, COST_UNCHRG, COST_UNCURS, ECMD_CANCEL, ECMD_OK, ECMD_TIME,
    GENOCIDED, GETOBJ_ALLOWCNT, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_SELECTABLE,
    GETOBJ_PROMPT, GETOBJ_SUGGEST, HAND, HEAD, KILLED_BY, KILLED_BY_AN, LEG, MM_EDOG, MM_FEMALE,
    MM_MALE, MM_MINVIS, MM_NOEXCLAM, MM_NOMSG, NOTELL, NO_MINVENT, NO_MM_FLAGS, NO_NC_FLAGS,
    POLY_REVERT, STOMACH, struct__create_particular_data,
} from "./hack.h.js";
import { Maybe_Half_Phys, distu, makeknown, min, pline1, plur, rn1, y_n } from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { ROOMOFFSET } from "./mkroom.h.js";
import {
    amorphous, digests, hides_under, is_demon, is_female, is_hider, is_human, is_male, is_whirly,
    monsndx, noncorporeal, passes_walls, type_is_pname, unique_corpstat, unsolid,
} from "./mondata.h.macros.js";
import {
    FEMALE, G_EXTINCT, G_GENO, G_GENOD, G_GONE, G_NOCORPSE, G_UNIQ, MALE, MS_GUARDIAN, MS_LEADER,
    MS_NEMESIS, NEUTRAL,
} from "./monflag.h.js";
import { M_SEEN_FIRE } from "./monst.h.js";
import { DEADMONSTER, engulfing_u, ismnum, vampshifted } from "./monst.h.macros.js";
import {
    LOW_PM, NON_PM, NUMMONS, PM_ACID_BLOB, PM_ALIGNED_CLERIC, PM_ANGEL, PM_BARBED_DEVIL,
    PM_BLACK_LIGHT, PM_DOPPELGANGER, PM_FIRE_ANT, PM_FLESH_GOLEM, PM_GIANT_BAT, PM_GREMLIN,
    PM_GUARD, PM_HELL_HOUND, PM_HIGH_CLERIC, PM_HUMAN_ZOMBIE, PM_IMP, PM_LARGE_MIMIC, PM_LEOCROTTA,
    PM_LONG_WORM, PM_LONG_WORM_TAIL, PM_MARILITH, PM_NINJA, PM_PIRANHA, PM_PYROLISK, PM_SAMURAI,
    PM_SCORPION, PM_SHOPKEEPER, PM_STALKER, PM_TOURIST, PM_WATER_MOCCASIN, PM_WIZARD, PM_XAN,
    PM_YELLOW_LIGHT,
} from "./monsters.h.js";
import { MAX_ERODE, SPE_LIM, struct_obj } from "./obj.h.js";
import {
    Is_dragon_scales, greatest_erosion, has_omonst, is_elven_armor, is_shield, is_weptool,
    uslinging,
} from "./obj.h.macros.js";
import { NODIR } from "./objclass.h.js";
import {
    ALCHEMY_SMOCK, BAG_OF_TRICKS, BELL_OF_OPENING, BLACK_DRAGON_SCALES, BLACK_DRAGON_SCALE_MAIL,
    BOULDER, BRASS_LANTERN, CANDY_BAR, CAN_OF_GREASE, CORNUTHAUM, CREDIT_CARD, CRYSTAL_BALL,
    DRUM_OF_EARTHQUAKE, DUNCE_CAP, EXPENSIVE_CAMERA, FIRE_HORN, FORTUNE_COOKIE, FROST_HORN,
    GRAY_DRAGON_SCALES, GRAY_DRAGON_SCALE_MAIL, HAWAIIAN_SHIRT, HEAVY_IRON_BALL, HORN_OF_PLENTY,
    LEASH, LOADSTONE, MAGIC_FLUTE, MAGIC_HARP, MAGIC_LAMP, MAGIC_MARKER, OIL_LAMP, POT_WATER, ROCK,
    SCR_AMNESIA, SCR_BLANK_PAPER, SCR_CHARGING, SCR_CONFUSE_MONSTER, SCR_CREATE_MONSTER,
    SCR_DESTROY_ARMOR, SCR_EARTH, SCR_ENCHANT_ARMOR, SCR_ENCHANT_WEAPON, SCR_FIRE,
    SCR_FOOD_DETECTION, SCR_GENOCIDE, SCR_GOLD_DETECTION, SCR_IDENTIFY, SCR_LIGHT,
    SCR_MAGIC_MAPPING, SCR_MAIL, SCR_PUNISHMENT, SCR_REMOVE_CURSE, SCR_SCARE_MONSTER,
    SCR_STINKING_CLOUD, SCR_TAMING, SCR_TELEPORTATION, SHIELD_OF_REFLECTION, SILVER_DRAGON_SCALES,
    SILVER_DRAGON_SCALE_MAIL, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_CAUSE_FEAR,
    SPE_CHARM_MONSTER, SPE_CONFUSE_MONSTER, SPE_CREATE_MONSTER, SPE_DETECT_FOOD, SPE_IDENTIFY,
    SPE_MAGIC_MAPPING, SPE_NOVEL, SPE_REMOVE_CURSE, TINNING_KIT, T_SHIRT, WAN_CANCELLATION,
    WAN_COLD, WAN_DEATH, WAN_FIRE, WAN_LIGHTNING, WAN_MAGIC_MISSILE, WAN_NOTHING, WAN_POLYMORPH,
    WAN_UNDEAD_TURNING, WAN_WISHING,
} from "./objects.h.js";
import {
    CONFUSION, LEFT_RING, POLYMORPH, RIGHT_RING, TIMEOUT, W_ARM, W_ARMH, W_ART, W_ARTI, W_BALL,
    W_CHAIN, W_SADDLE,
} from "./prop.h.js";
import { CORR, SDOOR } from "./rm.h.js";
import { ACCESSIBLE, IS_AIR, IS_OBSTRUCTED, OBJ_AT, fmon, levl, m_at } from "./rm.h.macros.js";
import { ALL_SPELLS } from "./spell.h.js";
import { cansee } from "./vision.h.macros.js";
import { WT_IRON_BALL_INCR } from "./weight.h.js";
import { TT_BURIEDBALL } from "./you.h.js";
import { Luck, Role_if, Ugender, Upolyd, mhim, u_at, uhis } from "./you.h.macros.js";
import {
    Blind, Confusion, Deaf, Fire_resistance, HConfusion, HStun, Hallucination, Invisible,
    Passes_walls, Punished, Unchanging, Underwater,
} from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, sizeof, sizeof_string, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64, not64, or64 } from "../rt/int64.js";
import {
    abs, atoi, free, memset, sprintf, strcat, strchr, strcmp, strcpy, strlen,
} from "../rt/libc.js";
import {
    init_string, stack_array, stack_struct, stack_var, static_array, static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, array_of, ptr_to, ref_of, struct, view_of } from "../rt/struct.js";
import { alloc } from "./alloc.js";
import { snuff_lit } from "./apply.js";
import { artifact_light, is_art } from "./artifact.js";
import { adjalign, exercise } from "./attrib.js";
import { move_bc, placebc, set_bc } from "./ball.js";
import { isok } from "./cmd.js";
import { is_lava, is_pool } from "./dbridge.js";
import { disp, flags, gi, gk, gm, gu, gv, gy, iflags, svk, svl, svm, svp, svr, u } from "./decl.js";
import { cvt_sdoor_to_door, do_mapping, food_detect, gold_detect, trap_detect } from "./detect.js";
import { buried_ball_to_freedom } from "./dig.js";
import { map_invisible, newsym, shieldeff, tmp_at } from "./display.js";
import { dropy, flooreffects, trycall } from "./do.js";
import { Monnam, hcolor, hliquid, mon_nam, pmname } from "./do_name.js";
import {
    Ring_gone, Ring_off, Ring_on, adj_abon, any_worn_armor_ok, count_worn_armor, destroy_arm,
    disintegrate_arm, hard_helmet, some_armor,
} from "./do_wear.js";
import { initedog, tamedog } from "./dog.js";
import { def_monsyms } from "./drawing.js";
import { avoid_ceiling, ceiling, has_ceiling } from "./dungeon.js";
import { delayed_killer, done } from "./end.js";
import { wipeout_text } from "./engrave.js";
import { more_experienced } from "./exper.js";
import { explode } from "./explode.js";
import { getpos, getpos_sethilite } from "./getpos.js";
import { check_capacity, losehp } from "./hack.js";
import {
    digit, eos, lowc, mungspaces, s_suffix, sgn, strncmpi, strstri, upstart, upwords,
} from "./hacklib.js";
import { list_genocided, num_genocides } from "./insight.js";
import { delobj, getobj, identify_pack, stackobj, update_inventory, useup } from "./invent.js";
import { arti_light_radius, snuff_light_source } from "./light.js";
import { readmail } from "./mail.js";
import { create_critters, makemon, mkclass, rndmonst, set_malign } from "./makemon.js";
import { monster_census } from "./minion.js";
import {
    bcsign, bless, blessorcurse, costly_alteration, curse, maybe_adjust_light, mkobj, mksobj,
    place_object, uncurse, weight,
} from "./mkobj.js";
import {
    flash_mon, kill_genocided_monsters, killed, mondied, mongone, newcham, setmangry, wake_nearto,
    wakeup,
} from "./mon.js";
import { can_chant, monstseesu, monstunseesu, name_to_mon, name_to_monclass } from "./mondata.js";
import { closed_door, monflee } from "./monmove.js";
import { mons } from "./monst.js";
import { objects } from "./objects.js";
import {
    Tobjnam, Yname2, Yobjnam2, actualoname, an, doname, erosion_matters, makeplural, otense,
    simpleonames, singular, suit_simple_name, vtense, xname,
} from "./objnam.js";
import {
    You, You_cant, You_feel, You_hear, Your, impossible, livelog_printf, pline, pline_The,
    urgent_pline, verbalize,
} from "./pline.js";
import { body_part, mbodypart, polyself, rehumanize, udeadinside } from "./polyself.js";
import { impact_arti_light, make_confused, make_stunned, strange_feeling } from "./potion.js";
import { quest_info } from "./questpgr.js";
import { create_gas_cloud } from "./region.js";
import { d, rn2, rnd } from "./rnd.js";
import { outrumor } from "./rumors.js";
import { alter_cost, obfree, shk_your } from "./shk.js";
import { losespells, study_book } from "./spell.js";
import { remove_worn_item } from "./steal.js";
import { can_saddle, put_saddle_on_mon } from "./steed.js";
import { level_tele, scrolltele } from "./teleport.js";
import { burn_away_slime, end_burn } from "./timeout.js";
import { sokoban_guilt } from "./trap.js";
import { light_hits_gremlin } from "./uhitm.js";
import { do_clear_area, unblock_point, vision_recalc } from "./vision.js";
import { dmgval, drain_weapon_skill } from "./weapon.js";
import { chwepon } from "./wield.js";
import { getlin } from "./windows.js";
import { setworn, which_armor } from "./worn.js";
import { lightdamage, resist } from "./zap.js";
