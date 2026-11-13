/* NetHack 5.0	spell.c	$NHDT-Date: 1769498874 2026/01/26 23:27:54 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.185 $ */
/*      Copyright (c) M. Stephenson 1988                          */
/* NetHack may be freely redistributed.  See license for details. */

/* spellmenu arguments; 0..n-1 used as svs.spl_book[] index when swapping */
export const SPELLMENU_DUMP = (-3);
export const SPELLMENU_CAST = (-2);
export const SPELLMENU_VIEW = (-1);
export const SPELLMENU_SORT = MAXSPELL;

/* spell retention period, in turns; at 10% of this value, player becomes
   eligible to reread the spellbook and regain 100% retention (the threshold
   used to be 1000 turns, which was 10% of the original 10000 turn retention
   period but didn't get adjusted when that period got doubled to 20000) */
export const KEEN = 20000;
/* x: need to add 1 when used for reading a spellbook rather than for hero
   initialization; spell memory is decremented at the end of each turn,
   including the turn on which the spellbook is read; without the extra
   increment, the hero used to get cheated out of 1 turn of retention */
export function incrnknow(spell, x) { return (svs.spl_book[spell].sp_know = KEEN + x); }

export function spellev(spell) { return svs.spl_book[spell].sp_lev; }
export function spellname(spell) { return OBJ_NAME(objects[spellid(spell)]); }
export function spellet(spell) { return char(((spell < 26) ? (ord('a') + spell) : (ord('A') + spell - 26))); }

/* The roles[] table lists the role-specific values for tuning
 * percent_success().
 *
 * Reasoning:
 *   spelbase, spelheal:
 *      Arc are aware of magic through historical research
 *      Bar abhor magic (Conan finds it "interferes with his animal instincts")
 *      Cav are ignorant to magic
 *      Hea are very aware of healing magic through medical research
 *      Kni are moderately aware of healing from Paladin training
 *      Mon use magic to attack and defend in lieu of weapons and armor
 *      Pri are very aware of healing magic through theological research
 *      Ran avoid magic, preferring to fight unseen and unheard
 *      Rog are moderately aware of magic through trickery
 *      Sam have limited magical awareness, preferring meditation to conjuring
 *      Tou are aware of magic from all the great films they have seen
 *      Val have limited magical awareness, preferring fighting
 *      Wiz are trained mages
 *
 *      The arms penalty is lessened for trained fighters Bar, Kni, Ran,
 *      Sam, Val -- the penalty is its metal interference, not encumbrance.
 *      The `spelspec' is a single spell which is fundamentally easier
 *      for that role to cast.
 *
 *  spelspec, spelsbon:
 *      Arc map masters (SPE_MAGIC_MAPPING)
 *      Bar fugue/berserker (SPE_HASTE_SELF)
 *      Cav born to dig (SPE_DIG)
 *      Hea to heal (SPE_CURE_SICKNESS)
 *      Kni to turn back evil (SPE_TURN_UNDEAD)
 *      Mon to preserve their abilities (SPE_RESTORE_ABILITY)
 *      Pri to bless (SPE_REMOVE_CURSE)
 *      Ran to hide (SPE_INVISIBILITY)
 *      Rog to find loot (SPE_DETECT_TREASURE)
 *      Sam to be At One (SPE_CLAIRVOYANCE)
 *      Tou to smile (SPE_CHARM_MONSTER)
 *      Val control the cold (SPE_CONE_OF_COLD)
 *      Wiz all really, but SPE_MAGIC_MISSILE is their party trick
 *
 *      See percent_success() below for more comments.
 *
 *  uarmbon, uarmsbon, uarmhbon, uarmgbon, uarmfbon:
 *      Fighters find body armour & shield a little less limiting.
 *      Headgear, Gauntlets and Footwear are not role-specific (but
 *      still have an effect, except helm of brilliance, which is designed
 *      to permit magic use).
 */

export const uarmhbon = 4;
export const uarmgbon = 6;
export const uarmfbon = 2;

/* since the spellbook itself doesn't blow up, don't say just "explodes" */
const explodes = init_string(static_array("explodes", char, sizeof_string("radiates explosive energy")), _("radiates explosive energy"), true);

/* convert a letter into a number in the range 0..51, or -1 if not a letter */
function spell_let_to_idx(ilet) { /* int */
    let indx;

    indx = ilet - ord('a');
    if (indx >= 0 && indx < 26)
        return indx;
    indx = ilet - ord('A');
    if (indx >= 0 && indx < 26)
        return indx + 26;
    return -1;
}

/* TRUE: book should be destroyed by caller */
function cursed_book(bp) { /* boolean */
    let was_in_use;
    let lev = objects[bp.otyp].oc_oc2;
    let dmg = 0;

    switch (rn2(lev)) {
    case 0:
        You_feel(_("a wrenching sensation."));
        tele(); /* teleport him */
        break;
    case 1:
        You_feel(_("threatened."));
        aggravate();
        break;
    case 2:
        make_blinded(BlindedTimeout() + rn1(100, 250), TRUE);
        break;
    case 3:
        take_gold();
        break;
    case 4:
        pline(_("These runes were just too much to comprehend."));
        make_confused(HConfusion() + rn1(7, 16), FALSE);
        break;
    case 5:
        pline_The(_("book was coated with contact poison!"));
        if (uarmg) {
            erode_obj(uarmg, _("gloves"), ERODE_CORRODE, EF_GREASE | EF_VERBOSE);
            break;
        }
        /* temp disable in_use; death should not destroy the book */
        was_in_use = bp.in_use;
        bp.in_use = FALSE;
        poison_strdmg(Poison_resistance() ? rn1(2, 1) : rn1(4, 3),
                      rnd(Poison_resistance() ? 6 : 10),
                      _("contact-poisoned spellbook"), KILLED_BY_AN);
        bp.in_use = unsigned(was_in_use);
        break;
    case 6:
        if (Antimagic()) {
            shieldeff(u.ux, u.uy);
            pline_The(_("book %s, but you are unharmed!"), explodes);
        } else {
            pline(_("As you read the book, it %s in your %s!"), explodes,
                  body_part(FACE));
            dmg = 2 * rnd(10) + 5;
            losehp(Maybe_Half_Phys(dmg), _("exploding rune"), KILLED_BY_AN);
        }
        return TRUE;
    default:
        rndcurse();
        break;
    }
    return FALSE;
}

/* study while confused: returns TRUE if the book is destroyed */
function confused_book(spellbook) { /* boolean */
    let gone = FALSE;

    if (!rn2(3) && spellbook.otyp != SPE_BOOK_OF_THE_DEAD) {
        spellbook.in_use = TRUE; /* in case called from learn() */
        pline(
         _("Being confused you have difficulties in controlling your actions."));
        display_nhwindow()(WIN_MESSAGE, FALSE);
        You(_("accidentally tear the spellbook to pieces."));
        trycall(spellbook);
        useup(spellbook);
        gone = TRUE;
    } else {
        You(_("find yourself reading the %s line over and over again."),
            spellbook == svc.context.spbook.book ? _("next") : _("first"));
    }
    return gone;
}

/* pacify or tame an undead monster */
function deadbook_pacify_undead(mtmp) { /* void */
    if ((is_undead(mtmp.data) || is_vampshifter(mtmp))
        && cansee(mtmp.mx, mtmp.my)) {
        mtmp.mpeaceful = TRUE;
        if (sgn(mtmp.data.maligntyp) == sgn(u.ualign.type)
            && mdistu(mtmp) < 4)
            if (mtmp.mtame) {
                if (mtmp.mtame < 20)
                    mtmp.mtame++;
            } else
                tamedog(mtmp, null, TRUE);
        else
            monflee(mtmp, 0, FALSE, TRUE);
    }
}

/* special effects for the Book of the Dead; reading it while blind is
   allowed so that needs to be taken into account too */
function deadbook(book2) { /* void */
    const $frame = stack_frame(); try {
    let $goto = null; var mm = stack_struct(struct_nhcoord);
    var mtmp;

    You(_("turn the pages of the Book of the Dead..."));
    makeknown(SPE_BOOK_OF_THE_DEAD);
    observe_object(book2); /* in case blind now and hasn't been seen yet */
    /* KMH -- Need ->known to avoid "_a_ Book of the Dead" */
    book2.known = 1;
    $goto_raise_dead: for (;;) { switch ($goto) { default: if (invocation_pos(u.ux, u.uy) && !On_stairs(u.ux, u.uy)) {
        var otmp;
        var arti1_primed = FALSE, arti2_primed = FALSE,
                         arti_cursed = FALSE;

        if (book2.cursed) {
            pline_The(_("%s!"),
                      Blind() ? _("Book seems to be ignoring you")
                            : _("runes appear scrambled.  You can't read them"));
            return;
        }

        if (!u.uhave.bell || !u.uhave.menorah) {
            pline(_("A chill runs down your %s."), body_part(SPINE));
            if (!u.uhave.bell) {
                 ;
                You_hear(_("a faint chime..."));
            }
            if (!u.uhave.menorah)
                pline(_("Vlad's doppelganger is amused."));
            return;
        }

        for (otmp = gi.invent; otmp; otmp = otmp.nobj) {
            if (otmp.otyp == CANDELABRUM_OF_INVOCATION && otmp.spe == 7
                && otmp.lamplit) {
                if (!otmp.cursed)
                    arti1_primed = TRUE;
                else
                    arti_cursed = TRUE;
            }
            if (otmp.otyp == BELL_OF_OPENING
                && (svm.moves - otmp.age) < 5) { /* you rang it recently */
                if (!otmp.cursed)
                    arti2_primed = TRUE;
                else
                    arti_cursed = TRUE;
            }
        }

        if (arti_cursed) {
            pline_The(_("invocation fails!"));
            /* this used to say "your artifacts" but the invocation tools
               are not artifacts */
            pline(_("At least one of your relics is cursed..."));
        } else if (arti1_primed && arti2_primed) {
            var soon = unsigned(d(2, 6)); /* time til next intervene() */

            /* successful invocation */
            mkinvokearea();
            u.uevent.invoked = 1;
            record_achievement(ACH_INVK);
            /* in case you haven't killed the Wizard yet, behave as if
               you just did */
            u.uevent.udemigod = 1; /* wizdeadorgone() */
            if (!u.udg_cnt || u.udg_cnt > soon)
                u.udg_cnt = soon;
        } else { /* at least one relic not prepared properly */
            You(_("have a feeling that %s is amiss..."), something());
            { $goto = "raise_dead"; continue $goto_raise_dead; }
        }
        return;
    }

    /* when not an invocation situation */
    case "raise_dead": if ($goto || (book2.cursed)) {
 $goto = null;

        You(_("raised the dead!"));
        /* first maybe place a dangerous adversary */
        if (!rn2(3) && ((mtmp = makemon(mons[PM_MASTER_LICH], u.ux, u.uy,
                                        NO_MINVENT)) != null
                        || (mtmp = makemon(mons[PM_NALFESHNEE], u.ux, u.uy,
                                           NO_MINVENT)) != null)) {
            mtmp.mpeaceful = 0;
            set_malign(mtmp);
        }
        /* next handle the affect on things you're carrying */
        unturn_dead(gy.youmonst);
        /* last place some monsters around you */
        mm.x = u.ux;
        mm.y = u.uy;
        mkundead(mm, TRUE, NO_MINVENT);
    } else if (book2.blessed) {
        iter_mons(deadbook_pacify_undead);
    } else {
        switch (rn2(3)) {
        case 0:
            Your(_("ancestors are annoyed with you!"));
            break;
        case 1:
            pline_The(_("headstones in the cemetery begin to move!"));
            break;
        default:
            pline(_("Oh my!  Your name appears in the book!"));
        }
    } } break; }
    return;
    } finally { stack_pop($frame); }
}

/* 'book' has just become cursed; if we're reading it, interrupt */
export function book_cursed(book) { /* void */
    if (book.cursed && gm.multi >= 0
        && go.occupation == learn && svc.context.spbook.book == book) {
        pline(_("%s shut!"), Tobjnam(book, _("slam")));
        set_bknown(book, 1);
        stop_occupation();
    }
}

function learn() { /* int */
    const $frame = stack_frame(); try {
    let i;
    let booktype;
    let splname = stack_array(char, BUFSZ);
    let costly = TRUE, faded_to_blank = FALSE;
    let book = svc.context.spbook.book;

    /* JDS: lenses give 50% faster reading; 33% smaller read time */
    if (svc.context.spbook.delay && ublindf
        && ublindf.otyp == LENSES && rn2(2))
        svc.context.spbook.delay++;
    if (Confusion()) { /* became confused while learning */
        confused_book(book);
        svc.context.spbook.book = null; /* no longer studying */
        svc.context.spbook.o_id = 0;
        nomul(svc.context.spbook.delay); /* remaining delay is uninterrupted */
        gm.multi_reason = _("reading a book");
        gn.nomovemsg = 0;
        svc.context.spbook.delay = 0;
        return 0;
    }
    if (svc.context.spbook.delay) {
        /* not if (svc.context.spbook.delay++), so at end delay == 0 */
        svc.context.spbook.delay++;
        return 1; /* still busy */
    }
    exercise(A_WIS, TRUE); /* you're studying. */
    booktype = book.otyp;
    if (booktype == SPE_BOOK_OF_THE_DEAD) {
        deadbook(book);
        return 0;
    }

    sprintf(splname, objects[booktype].oc_name_known ? _("\"%s\"") : _("the \"%s\" spell"), OBJ_NAME(objects[booktype]))

;
    for (i = 0; i < MAXSPELL; i++)
        if (spellid(i) == booktype || spellid(i) == NO_SPELL)
            break;

    if (i == MAXSPELL) {
        impossible(_("Too many spells memorized!"));
    } else if (spellid(i) == booktype) {
        /* normal book can be read and re-read a total of 4 times */
        if (book.usecount > MAX_SPELL_STUDY) {
            pline(_("This spellbook is too faint to be read any more."));
            book.otyp = booktype = SPE_BLANK_PAPER;
            faded_to_blank = TRUE;
            /* reset spestudied as if polymorph had taken place */
            book.usecount = rn2(book.usecount);
        } else {
            Your(_("knowledge of %s is %s."), splname,
                 spellknow(i) ? _("keener") : _("restored"));
            incrnknow(i, 1);
            book.usecount++;
            exercise(A_WIS, TRUE); /* extra study */
        }
    } else { /* (spellid(i) == NO_SPELL) */
        /* for a normal book, spestudied will be zero, but for
           a polymorphed one, spestudied will be non-zero and
           one less reading is available than when re-learning */
        if (book.usecount >= MAX_SPELL_STUDY) {
            /* pre-used due to being the product of polymorph */
            pline(_("This spellbook is too faint to read even once."));
            book.otyp = booktype = SPE_BLANK_PAPER;
            faded_to_blank = TRUE;
            /* reset spestudied as if polymorph had taken place */
            book.usecount = rn2(book.usecount);
        } else {
            svs.spl_book[i].sp_id = booktype;
            svs.spl_book[i].sp_lev = objects[booktype].oc_oc2;
            incrnknow(i, 1);
            book.usecount++;
            if (!i)
                /* first is always 'a', so no need to mention the letter */
                You(_("learn %s."), splname);
            else
                You(_("add %s to your repertoire, as '%c'."),
                    splname, spellet(i));
        }
    }
    if (i < MAXSPELL) {
        /* might be learning a new spellbook type or spellbook of blank paper;
           if so, persistent inventory will get updated */
        makeknown(booktype);
        /* makeknown() calls update_inventory() when discovering something
           new but is a no-op for something that's already known so wouldn't
           update persistent inventory to reflect faded book if spellbook of
           blank paper happens to already be discovered */
        if (faded_to_blank)
            update_inventory();
    }

    if (book.cursed) { /* maybe a demon cursed it */
        if (cursed_book(book)) {
            useup(book);
            svc.context.spbook.book = null;
            svc.context.spbook.o_id = 0;
            return 0;
        }
    }
    if (costly)
        check_unpaid(book);
    svc.context.spbook.book = null;
    svc.context.spbook.o_id = 0;
    return 0;
    } finally { stack_pop($frame); }
}

export function study_book(spellbook) { /* int */
    const $frame = stack_frame(); try {
    let booktype = spellbook.otyp, i;
    let confused = +(Confusion() != 0);
    let too_hard = FALSE;

    /* attempting to read dull book may make hero fall asleep */
    if (!confused && !Sleep_resistance()
        && objdescr_is(spellbook, _("dull"))) {
        let eyes;
        let dullbook = rnd(25) - ACURR(A_WIS);

        /* adjust chance if hero stayed awake, got interrupted, retries */
        if (svc.context.spbook.delay && spellbook == svc.context.spbook.book)
            dullbook -= rnd(objects[booktype].oc_oc2);

        if (dullbook > 0) {
            eyes = body_part(EYE);
            if (eyecount(gy.youmonst.data) > 1)
                eyes = makeplural(eyes);
            pline(_("This book is so dull that you can't keep your %s open."),
                  eyes);
            dullbook += rnd(2 * objects[booktype].oc_oc2);
            fall_asleep(-dullbook, TRUE);
            return 1;
        }
    }

    if (svc.context.spbook.delay && !confused
        && spellbook == svc.context.spbook.book
        /* handle the sequence: start reading, get interrupted, have
           svc.context.spbook.book become erased somehow, resume reading it */
        && booktype != SPE_BLANK_PAPER) {
        You(_("continue your efforts to %s."),
            (booktype == SPE_NOVEL) ? _("read the novel")
                                    : _("memorize the spell"));
    } else {
        /* KMH -- Simplified this code */
        if (booktype == SPE_BLANK_PAPER) {
            pline(_("This spellbook is all blank."));
            makeknown(booktype);
            return 1;
        }

        /* 3.6 tribute */
        if (booktype == SPE_NOVEL) {
            /* Obtain current Terry Pratchett book title */
            let tribtitle = noveltitle(ref_of(spellbook, "corpsenm"));

            if (read_tribute(_("books"), tribtitle, 0, 0, 0,
                             spellbook.o_id)) {
                if (!u.uconduct.literate++)
                    livelog_printf(LL_CONDUCT,
                                   _("became literate by reading %s"),
                                   tribtitle);

                check_unpaid(spellbook);
                makeknown(booktype);
                if (!u.uevent.read_tribute) {
                    record_achievement(ACH_NOVL);
                    /* give bonus of 20 xp and 4*20+0 pts */
                    more_experienced(20, 0);
                    newexplevel();
                    u.uevent.read_tribute = 1; /* only once */
                }
            }
            return 1;
        }

        switch (objects[booktype].oc_oc2) {
        case 1:
        case 2:
            svc.context.spbook.delay = -objects[booktype].oc_delay;
            break;
        case 3:
        case 4:
            svc.context.spbook.delay = -(objects[booktype].oc_oc2 - 1)
                                   * objects[booktype].oc_delay;
            break;
        case 5:
        case 6:
            svc.context.spbook.delay =
                -objects[booktype].oc_oc2 * objects[booktype].oc_delay;
            break;
        case 7:
            svc.context.spbook.delay = -8 * objects[booktype].oc_delay;
            break;
        default:
            impossible(_("Unknown spellbook level %d, book %d;"),
                       objects[booktype].oc_oc2, booktype);
            return 0;
        }

        /* check to see if we already know it and want to refresh our memory */
        for (i = 0; i < MAXSPELL; i++)
            if (spellid(i) == booktype || spellid(i) == NO_SPELL)
                break;
        if (spellid(i) == booktype && spellknow(i) > Math.trunc(KEEN / 10)) {
            You(_("know \"%s\" quite well already."),
                OBJ_NAME(objects[booktype]));
            /* hero has just been told what spell this book is for; it may
               have been undiscovered if spell was learned via divine gift */
            makeknown(booktype);
            if (y_n(_("Refresh your memory anyway?")) == ord('n'))
                return 0;
        }

        /* Books are often wiser than their readers (Rus.) */
        spellbook.in_use = TRUE;
        if (!spellbook.blessed && spellbook.otyp != SPE_BOOK_OF_THE_DEAD) {
            if (spellbook.cursed) {
                too_hard = TRUE;
            } else {
                /* uncursed - chance to fail */
                let read_ability = ACURR(A_INT) + 4 + Math.trunc(u.ulevel / 2)
                                   - 2 * objects[booktype].oc_oc2
                             + ((ublindf && ublindf.otyp == LENSES) ? 2 : 0);

                /* only wizards know if a spell is too difficult */
                if (Role_if(PM_WIZARD) && read_ability < 20 && !confused) {
                    let qbuf = stack_array(char, QBUFSZ);

                    sprintf(qbuf, _("This spellbook is %sdifficult to comprehend.  Continue?"), (read_ability < 12 ? _("very ") : _("")))

;
                    if (y_n(qbuf) != ord('y')) {
                        spellbook.in_use = FALSE;
                        return 1;
                    }
                }
                /* its up to random luck now */
                if (rnd(20) > read_ability) {
                    too_hard = TRUE;
                }
            }
        }

        if (too_hard) {
            let gone = cursed_book(spellbook);

            nomul(svc.context.spbook.delay); /* study time */
            gm.multi_reason = _("reading a book");
            gn.nomovemsg = 0;
            svc.context.spbook.delay = 0;
            if (gone || !rn2(3)) {
                if (!gone)
                    pline_The(_("spellbook crumbles to dust!"));
                trycall(spellbook);
                useup(spellbook);
            } else
                spellbook.in_use = FALSE;
            return 1;
        } else if (confused) {
            if (!confused_book(spellbook)) {
                spellbook.in_use = FALSE;
            }
            nomul(svc.context.spbook.delay);
            gm.multi_reason = _("reading a book");
            gn.nomovemsg = 0;
            svc.context.spbook.delay = 0;
            return 1;
        }
        spellbook.in_use = FALSE;

        You(_("begin to %s the runes."),
            spellbook.otyp == SPE_BOOK_OF_THE_DEAD ? _("recite") : _("memorize"));
    }

    svc.context.spbook.book = spellbook;
    if (svc.context.spbook.book)
        svc.context.spbook.o_id = svc.context.spbook.book.o_id;
    set_occupation(learn, _("studying"), 0);
    return 1;
    } finally { stack_pop($frame); }
}

/* a spellbook has been destroyed or the character has changed levels;
   the stored address for the current book is no longer valid */
export function book_disappears(obj) { /* void */
    if (obj == svc.context.spbook.book) {
        svc.context.spbook.book = null;
        svc.context.spbook.o_id = 0;
    }
}

/* renaming an object usually results in it having a different address;
   so the sequence start reading, get interrupted, name the book, resume
   reading would read the "new" book from scratch */
export function book_substitution(old_obj, new_obj) { /* void */
    if (old_obj == svc.context.spbook.book) {
        svc.context.spbook.book = new_obj;
        if (svc.context.spbook.book)
            svc.context.spbook.o_id = svc.context.spbook.book.o_id;
    }
}

/* called from moveloop() */
export function age_spells() { /* void */
    let i;
    /*
     * The time relative to the hero (a pass through move
     * loop) causes all spell knowledge to be decremented.
     * The hero's speed, rest status, conscious status etc.
     * does not alter the loss of memory.
     */
    for (i = 0; i < MAXSPELL && spellid(i) != NO_SPELL; i++)
        if (spellknow(i))
            decrnknow(i);
    return;
}

/* return True if spellcasting is inhibited;
   only covers a small subset of reasons why casting won't work */
function rejectcasting() { /* boolean */
    /* rejections which take place before selecting a particular spell */
    if (Stunned()) {
        You(_("are too impaired to cast a spell."));
        return TRUE;
    } else if (!can_chant(gy.youmonst)) {
        You(_("are unable to chant the incantation."));
        return TRUE;
    } else if (!freehand() && !(uwep && uwep.otyp == QUARTERSTAFF)) {
        /* Note: !freehand() occurs when weapon and shield (or two-handed
         * weapon) are welded to hands, so "arms" probably doesn't need
         * to be makeplural(bodypart(ARM)).
         *
         * But why isn't lack of free arms (for gesturing) an issue when
         * poly'd hero has no limbs?
         */
        Your(_("arms are not free to cast!"));
        return TRUE;
    }
    return FALSE;
}

/*
 * Return TRUE if a spell was picked, with the spell index in the return
 * parameter.  Otherwise return FALSE.
 */
function getspell(spell_no) { /* boolean */
    const $frame = stack_frame(); try {
    let nspells, idx, retry_limit;
    let ilet, lets = stack_array(char, BUFSZ), qbuf = stack_array(char, QBUFSZ);
    let cq = stack_struct(struct__cmd_queue), cmdq;

    nspells = num_spells();
    if (!nspells) {
        You(_("don't know any spells right now."));
        return FALSE;
    }
    if (rejectcasting())
        return FALSE; /* no spell chosen */

    if ((cmdq = cmdq_pop()) != null) {
        struct_assign(cq, cmdq);
        free(addr_of(cmdq));
        if (cq.typ == CMDQ_KEY) {
            idx = spell_let_to_idx(cq.key);
            if (idx < 0 || idx >= nspells)
                return FALSE;
            spell_no[0] = idx;
            return TRUE;
        } else {
            return FALSE;
        }
    }

    if (flags.menu_style == MENU_TRADITIONAL) {
        /* if we get here, we know there is at least 1 known spell */
        if (nspells == 1)
            strcpy(lets, _("a"));
        else if (nspells < 27)
            sprintf(lets, _("a-%c"), ord('a') + nspells - 1);
        else if (nspells == 27)
            strcpy(lets, _("a-zA"));
        /* this assumes that there are at most 52 spells... */
        else
            sprintf(lets, _("a-zA-%c"), ord('A') + nspells - 27);

        Snprintf(qbuf, sizeof(array_of(char, QBUFSZ)), _("Cast which spell? [%s *?]"), lets);
        for (retry_limit = 0; ; ++retry_limit) {
            if (retry_limit == 10) {
                /* limit is mainly to prevent the fuzzer from getting stuck
                   since hangup should hit the 'quitchars' case; fuzzer
                   would too, but after an arbitrary number of attempts */
                pline(_("That's enough tries."));
                return FALSE;
            }
            ilet = yn_function(qbuf, 0, ord('\0'), TRUE);
            if (ilet == ord('*') || ilet == ord('?'))
                break; /* use menu mode */
            if (strchr(quitchars, ilet)) {
                pline1(Never_mind());
                return FALSE;
            }

            idx = spell_let_to_idx(ilet);
            if (idx < 0 || idx >= nspells) {
                You(_("don't know that spell."));
                continue; /* ask again */
            }
            spell_no[0] = idx;
            return TRUE;
        }
    }
    return dospellmenu(_("Choose which spell to cast"), SPELLMENU_CAST,
                       spell_no);
    } finally { stack_pop($frame); }
}

/* #wizcast - cast any spell even without knowing it */
export function dowizcast() { /* int */
    const $frame = stack_frame(); try {
    let win;
    let selected = stack_var(ptr_to(struct_mi));
    let any = stack_struct(struct_any);
    let i, n;

    win = create_nhwindow()(NHW_MENU);
    start_menu()(win, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);

    for (i = 0; i < MAXSPELL; i++) {
        n = (SPE_DIG + i);
        if (n >= SPE_BLANK_PAPER)
            break;
        any.a_int = n;
        add_menu(win, nul_glyphinfo, any, 0, 0, ATR_NONE, NO_COLOR,
                 OBJ_NAME(objects[n]), MENU_ITEMFLAGS_NONE);
    }
    end_menu()(win, _("Cast which spell?"));
    n = select_menu(win, PICK_ONE, selected);
    destroy_nhwindow()(win);
    if (n > 0) {
        i = ptr_add(selected[0], 0).item.a_int;
        free(addr_of(selected[0]));
        return spelleffects(i, FALSE, TRUE);
    }
    return ECMD_OK;
    } finally { stack_pop($frame); }
}

/* the #cast command -- cast a spell */
export function docast() { /* int */
    const $frame = stack_frame(); try {
    let spell_no = stack_var(int);

    if (getspell(spell_no)) {
        cmdq_add_key(CQ_REPEAT, spellet(spell_no[0]));
        return spelleffects(svs.spl_book[spell_no[0]].sp_id, FALSE, FALSE);
    }
    return ECMD_FAIL;
    } finally { stack_pop($frame); }
}

function spelltypemnemonic(skill) { /* const char * */
    switch (skill) {
    case P_ATTACK_SPELL:
        return _("attack");
    case P_HEALING_SPELL:
        return _("healing");
    case P_DIVINATION_SPELL:
        return _("divination");
    case P_ENCHANTMENT_SPELL:
        return _("enchantment");
    case P_CLERIC_SPELL:
        return _("clerical");
    case P_ESCAPE_SPELL:
        return _("escape");
    case P_MATTER_SPELL:
        return _("matter");
    default:
        impossible(_("Unknown spell skill, %d;"), skill);
        return _("");
    }
}

export function spell_skilltype(booktype) { /* int */
    return objects[booktype].oc_subtyp;
}

/* Wizards learn what spellbooks look like based on their skill in the
   spell's school */
export function skill_based_spellbook_id() { /* void */
    if (!Role_if(PM_WIZARD))
        return;

    let booktype;
    let spbook_class = SPBOOK_CLASS;

    for (booktype = svb.bases[spbook_class];
         booktype < svb.bases[spbook_class + 1];
         booktype++) {
        let known_up_to_level;
        let skill = spell_skilltype(booktype);

        if (skill == P_NONE)
            continue;

        switch (P_SKILL(skill)) {
        case P_BASIC:
            known_up_to_level = 3;
            break;
        case P_SKILLED:
            known_up_to_level = 5;
            break;
        case P_EXPERT:
        case P_MASTER:
        case P_GRAND_MASTER:
            known_up_to_level = 7;
            break;
        case P_UNSKILLED:
        default:
            /* paupers need more skill than this to ID books, but most wizards
               know the basics */
            known_up_to_level = u.uroleplay.pauper ? 0 : 1;
            break;
        }

        if (objects[booktype].oc_oc2 <= known_up_to_level)
            /* makeknown(booktype) but don't exercise Wisdom or mark as
               encountered */
            discover_object(booktype, TRUE, FALSE, FALSE);
    }
}

/* Limit the total area chain lightning can cover; this is both for
   technical reasons (making it possible to limit the size of arrays
   here and in the display code) and for gameplay balance reasons;
   this value should be smaller than TMP_AT_MAX_GLYPHS (display.c) in
   order for chain lightning to display properly */
export const CHAIN_LIGHTNING_LIMIT = 100;
/* Unlike most zaps, chain lightning can't hit solid terrain (it
   doesn't have enough power), it only covers open space; this also
   means that it can't hit monsters inside walls, which makes sense as
   they would be earthed */
export function CHAIN_LIGHTNING_TYP(typ) { return +(SPACE_POS(typ) || typ == POOL || typ == MOAT /* not WATER */
     || typ == DRAWBRIDGE_UP || typ == LAVAPOOL); }

export function CHAIN_LIGHTNING_POS(x, y) { return (isok(x, y) && (CHAIN_LIGHTNING_TYP(levl()[x][y].typ)
                    || (IS_DOOR(levl()[x][y].typ)
                        && !(levl()[x][y].flags & (D_CLOSED | D_LOCKED)))) ? 1 : 0); }

const struct_chain_lightning_zap = struct("struct_chain_lightning_zap", {
    dir: uchar,

    x: coordxy, y: coordxy,

    strength: char,
});

const struct_chain_lightning_queue = struct("struct_chain_lightning_queue", {
    q: array_of("struct_chain_lightning_zap", CHAIN_LIGHTNING_LIMIT),
    head: int,
    tail: int,
    displayed_beam: int,
});

/* Given a potential chain lightning zap, moves it one square forward in
   the given direction, then adds it to the queue unless it would hit an
   invalid square or is out of power.

   zap is passed by value, so the move-forward doesn't change the passed
   argument. */
function propagate_chain_lightning(
    clq,
    zap) { /* void */
    let mon;

    zap.x += chars[xdir + zap.dir];
    zap.y += chars[ydir + zap.dir];

    if (clq.tail >= CHAIN_LIGHTNING_LIMIT)
        return;    /* zap has covered too many squares */
    if (!CHAIN_LIGHTNING_POS(zap.x, zap.y))
        return;    /* zap can't go to this square */

    mon = m_at(zap.x, zap.y);
    if (mon && mon.mpeaceful)
        return;    /* chain lightning avoids peaceful and tame monsters */

    /* When hitting a monster that isn't electricity-resistant, a
       particular chain lightning zap regains all its power, allowing it to
       chain to other monsters; upon hitting a shock-resistant monster it
       can't continue any further, but we let it hit the monster to show
       the shield effect */
    if (mon && !resists_elec(mon) && !defended(mon, AD_ELEC))
        zap.strength = 3;
    else if (mon)
        zap.strength = 0;

    /* Unless it hits a monster, the last square of a zap isn't drawn on
       screen and can't propagate further, so it may as well be discarded
       now */
    if (!mon && !zap.strength)
        return;

    /* The same square can't be chained to twice. */
    for (let i = 0; i < clq.tail; i++) {
        if (clq.q[i].x == zap.x && clq.q[i].y == zap.y)
            return;
    }

    /* This array access must be inbounds due to the CHAIN_LIGHTNING_LIMIT
       check earlier. */
    struct_assign(clq.q[clq.tail++], zap);

    /* Draw it. */
    tmp_at(DISP_CHANGE, zapdir_to_glyph(chars[xdir + zap.dir], chars[ydir + zap.dir],
                                        clq.displayed_beam));
    tmp_at(zap.x, zap.y);
}

function cast_chain_lightning() { /* void */
    const $frame = stack_frame(); try {
    let clq = init_list(stack_struct(struct_chain_lightning_queue), {
        q: [{dir: 0}], head: 0, tail: 0, displayed_beam: Hallucination() ? rn2_on_display_rng(6) : (AD_ELEC - 1)
    });

    if (u.uswallow) {
        // TODO: damage the engulfer
        return;
    }

    /* set the type of beam we're using; the direction here is arbitrary
       because we change the beam direction just before drawing the beam
       anyway */
    tmp_at(DISP_BEAM, zapdir_to_glyph(0, 1, clq.displayed_beam));

    /* start by propagating in all directions from the caster */
    for (let dir = 0; dir < N_DIRS; dir++) {
        let zap = init_list(stack_struct(struct_chain_lightning_zap), { dir: uchar(dir), x: u.ux, y: u.uy, strength: 2 });

        propagate_chain_lightning(clq, struct_copy(zap));
    }
    nh_delay_output()();

    while (clq.head < clq.tail) {
        let delay_tail = clq.tail;

        while (clq.head < delay_tail) {
            let zap = struct_assign(stack_struct(struct_chain_lightning_zap), clq.q[clq.head++]);
            /* damage any monster that was hit */
            let mon = m_at(zap.x, zap.y);

            if (mon) {
                let unused = stack_var(ptr_to(struct_obj), null); /* AD_ELEC can't destroy armor */
                let dmg;

                gn.notonhead = +(mon.mx != gb.bhitpos.x
                                || mon.my != gb.bhitpos.y);
                dmg = zhitm(mon, BZ_U_SPELL(AD_ELEC - 1), 2, unused);

                if (dmg) {
                    /* mon has been damaged, but we haven't yet printed the
                       messages or given kill credit; assume the hero can
                       sense their spell hitting monsters, because they can
                       steer it away from peacefuls */
                    if (DEADMONSTER(mon)) {
                        xkilled(mon, XKILL_GIVEMSG);
                    } else {
                        pline(_("You shock %s%s"), mon_nam(mon), exclam(dmg));
                        /* if a long worm, only map 'I' for its head */
                        if (!canseemon(mon) && !gn.notonhead)
                            /* FIXME: this doesn't work, possibly because
                               cleaning up tmp_at() restores old glyph? */
                            map_invisible(zap.x, zap.y);
                    }
                } else if (canseemon(mon)) {
                    pline(_("%s resists."), Monnam(mon));
                }
                if (!DEADMONSTER(mon)) {
                    /* wakeup is via attack, but since mon is already
                       hostile we pass via_attack==False rather than True,
                       otherwise other monsters witnessing this would treat
                       it as seeing hero attack a peaceful; mimic will be
                       exposed; forcefight makes hider unhide */
                    svc.context.forcefight++;
                    wakeup(mon, FALSE);
                    svc.context.forcefight--;
                }
            }

            /* each zap propagates forwards with 1 less strength, and
               diagonally with 0 strength (thus the diagonal zaps aren't
               drawn and don't spread unless they hit a monster);
               exception: if the zap just hit a monster, the diagonals have
               as much strength as the forwards zap */
            if (!zap.strength)
                continue; /* happens upon hitting a shock-resistant monster */
            zap.strength--;

            propagate_chain_lightning(clq, struct_copy(zap));

            if (zap.strength < 2)
                zap.strength = 0;
            else if (u.uen > 0)
                u.uen--; /* propagating past mons increases Pw cost a bit */
            zap.dir = DIR_LEFT(zap.dir);
            propagate_chain_lightning(clq, struct_copy(zap));

            zap.dir = DIR_RIGHT2(zap.dir);
            propagate_chain_lightning(clq, struct_copy(zap));
        }
        nh_delay_output()();
    }
    nh_delay_output()();
    nh_delay_output()();

    tmp_at(DISP_END, 0);
    } finally { stack_pop($frame); }
}

function cast_protection() { /* void */
    let l = u.ulevel, loglev = 0,
        gain, natac = u.uac + u.uspellprot;
    /* note: u.uspellprot is subtracted when find_ac() factors it into u.uac,
       so adding here factors it back out
       (versions prior to 3.6 had this backwards) */

    /* loglev=log2(u.ulevel)+1 (1..5) */
    while (l) {
        loglev++;
        l = Math.trunc(l / 2);
    }

    /* The more u.uspellprot you already have, the less you get,
     * and the better your natural ac, the less you get.
     *
     *  LEVEL AC    SPELLPROT from successive SPE_PROTECTION casts
     *      1     10    0,  1,  2,  3,  4
     *      1      0    0,  1,  2,  3
     *      1    -10    0,  1,  2
     *      2-3   10    0,  2,  4,  5,  6,  7,  8
     *      2-3    0    0,  2,  4,  5,  6
     *      2-3  -10    0,  2,  3,  4
     *      4-7   10    0,  3,  6,  8,  9, 10, 11, 12
     *      4-7    0    0,  3,  5,  7,  8,  9
     *      4-7  -10    0,  3,  5,  6
     *      7-15 -10    0,  3,  5,  6
     *      8-15  10    0,  4,  7, 10, 12, 13, 14, 15, 16
     *      8-15   0    0,  4,  7,  9, 10, 11, 12
     *      8-15 -10    0,  4,  6,  7,  8
     *     16-30  10    0,  5,  9, 12, 14, 16, 17, 18, 19, 20
     *     16-30   0    0,  5,  9, 11, 13, 14, 15
     *     16-30 -10    0,  5,  8,  9, 10
     */
    natac = Math.trunc((10 - natac) / 10); /* convert to positive and scale down */
    gain = loglev - Math.trunc(u.uspellprot / (4 - min(3, natac)));

    if (gain > 0) {
        if (!Blind()) {
            let rmtyp;
            let hgolden = hcolor(NH_GOLDEN()), atmosphere;

            if (u.uspellprot) {
                pline_The(_("%s haze around you becomes more dense."), hgolden);
            } else {
                let pm = u.ustuck ? u.ustuck.data : null;

                rmtyp = levl()[u.ux][u.uy].typ;
                atmosphere = (pm && u.uswallow)
                                ? ((pm == mons[PM_FOG_CLOUD]) ? _("mist")
                                   : is_whirly(pm) ? _("maelstrom")
                                     : enfolds(pm) ? _("folds")
                                       : is_animal(pm) ? _("maw")
                                         : _("ooze"))
                                : (u.uinwater ? hliquid(_("water"))
                                   : (rmtyp == CLOUD) ? _("cloud")
                                     : IS_TREE(rmtyp) ? _("vegetation")
                                       : IS_STWALL(rmtyp) ? _("stone")
                                         : _("air"));
                pline_The(_("%s around you begins to shimmer with %s haze."),
                          atmosphere, an(hgolden));
            }
        }
        u.uspellprot += gain;
        u.uspmtime = (P_SKILL(spell_skilltype(SPE_PROTECTION)) == P_EXPERT)
                        ? 20 : 10;
        if (!u.usptime)
            u.usptime = u.uspmtime;
        find_ac();
    } else {
        Your(_("skin feels warm for a moment."));
    }
}

/* attempting to cast a forgotten spell will cause disorientation */
function spell_backfire(spell) { /* void */
    let duration = ((spellev(spell) + 1) * 3),
         old_stun = (HStun() & TIMEOUT), old_conf = (HConfusion() & TIMEOUT);

    /* Prior to 3.4.1, only effect was confusion; it still predominates.
     *
     * 3.6.0: this used to override pre-existing confusion duration
     * (cases 0..8) and pre-existing stun duration (cases 4..9);
     * increase them instead.   (Hero can no longer cast spells while
     * Stunned, so the potential increment to stun duration here is
     * just hypothetical.)
     */
    switch (rn2(10)) {
    case 0:
    case 1:
    case 2:
    case 3:
        make_confused(old_conf + duration, FALSE); /* 40% */
        break;
    case 4:
    case 5:
    case 6:
        make_confused(old_conf + Math.trunc(2 * duration / 3), FALSE); /* 30% */
        make_stunned(old_stun + Math.trunc(duration / 3), FALSE);
        break;
    case 7:
    case 8:
        make_stunned(old_stun + Math.trunc(2 * duration / 3), FALSE); /* 20% */
        make_confused(old_conf + Math.trunc(duration / 3), FALSE);
        break;
    case 9:
        make_stunned(old_stun + duration, FALSE); /* 10% */
        break;
    }
    return;
}

function spelleffects_check(spell, res, energy) { /* boolean */
    let chance;
    let confused = +(Confusion() != 0);

    energy[0] = 0;

    /*
     * Reject attempting to cast while stunned or with no free hands.
     * Already done in getspell() to stop casting before choosing
     * which spell, but duplicated here for cases where spelleffects()
     * gets called directly for ^T without intrinsic teleport capability
     * or #turn for non-priest/non-knight.
     * (There's no duplication of messages; when the rejection takes
     * place in getspell(), we don't get called.)
     */
    if ((spell == UNKNOWN_SPELL) || rejectcasting()) {
        res[0] = ECMD_OK; /* no time elapses */
        return TRUE;
    }

    /*
     *  Note: dotele() also calculates energy use and checks nutrition
     *  and strength requirements; if any of these change, update it too.
     */
    energy[0] = SPELL_LEV_PW(spellev(spell)); /* 5 <= energy <= 35 */

    /*
     * Spell casting no longer affects knowledge of the spell. A
     * decrement of spell knowledge is done every turn.
     */
    if (spellknow(spell) <= 0) {
        Your(_("knowledge of this spell is twisted."));
        pline(_("It invokes nightmarish images in your mind..."));
        spell_backfire(spell);
        u.uen -= rnd(energy[0]);
        if (u.uen < 0)
            u.uen = 0;
        disp.botl = TRUE;
        res[0] = ECMD_TIME;
        return TRUE;
    } else if (spellknow(spell) <= Math.trunc(KEEN / 200)) { /* 100 turns left */
        You(_("strain to recall the spell."));
    } else if (spellknow(spell) <= Math.trunc(KEEN / 40)) { /* 500 turns left */
        You(_("have difficulty remembering the spell."));
    } else if (spellknow(spell) <= Math.trunc(KEEN / 20)) { /* 1000 turns left */
        Your(_("knowledge of this spell is growing faint."));
    } else if (spellknow(spell) <= Math.trunc(KEEN / 10)) { /* 2000 turns left */
        Your(_("recall of this spell is gradually fading."));
    }

    if (u.uhunger <= 10 && spellid(spell) != SPE_DETECT_FOOD) {
        You(_("are too hungry to cast that spell."));
        res[0] = ECMD_OK;
        return TRUE;
    } else if (ACURR(A_STR) < 4 && spellid(spell) != SPE_RESTORE_ABILITY) {
        You(_("lack the strength to cast spells."));
        res[0] = ECMD_OK;
        return TRUE;
    } else if (check_capacity(
                _("Your concentration falters while carrying so much stuff."))) {
        res[0] = ECMD_TIME;
        return TRUE;
    }

    /* if the cast attempt is already going to fail due to insufficient
       energy (ie, u.uen < energy), the Amulet's drain effect won't kick
       in and no turn will be consumed; however, when it does kick in,
       the attempt may fail due to lack of energy after the draining, in
       which case a turn will be used up in addition to the energy loss */
    if (u.uhave.amulet && u.uen >= energy[0]) {
        You_feel(_("the amulet draining your energy away."));
        /* this used to be 'energy += rnd(2 * energy)' (without 'res'),
           so if amulet-induced cost was more than u.uen, nothing
           (except the "don't have enough energy" message) happened
           and player could just try again (and again and again...);
           now we drain some energy immediately, which has a
           side-effect of not increasing the hunger aspect of casting */
        u.uen -= rnd(2 * energy[0]);
        if (u.uen < 0)
            u.uen = 0;
        disp.botl = TRUE;
        res[0] = ECMD_TIME; /* time is used even if spell doesn't get cast */
    }

    if (energy[0] > u.uen) {
        /*
         * Hero has insufficient energy/power to cast the spell.
         * Augment the message when current energy is at maximum.
         * "yet": mainly for level 1 characters who already know a spell
         * but don't start with enough energy to cast it.
         * "anymore": maximum energy was high enough at some point but
         * isn't now (lost energy when losing levels or polymorphing into
         * new person or had some stripped away by traps or monsters).
         */
        You(_("don't have enough energy to cast that spell%s."),
            (u.uen < u.uenmax) ? _("") /* not at full energy => normal message */
            : (energy[0] > u.uenpeak) ? _(" yet") /* haven't ever had enough */
              : _(" anymore")); /* once had enough but have lost some since */
        return TRUE;
    } else {
        if (spellid(spell) != SPE_DETECT_FOOD) {
            let hungr = energy[0] * 2;

            /* If hero is a wizard, their current intelligence
             * (bonuses + temporary + current)
             * affects hunger reduction in casting a spell.
             * 1. int = 17-18 no reduction
             * 2. int = 16    1/4 hungr
             * 3. int = 15    1/2 hungr
             * 4. int = 1-14  normal reduction
             * The reason for this is:
             * a) Intelligence affects the amount of exertion
             * in thinking.
             * b) Wizards have spent their life at magic and
             * understand quite well how to cast spells.
             */
            let intell = acurr(A_INT);
            if (!Role_if(PM_WIZARD))
                intell = 10;
            switch (intell) {
            case 25:
            case 24:
            case 23:
            case 22:
            case 21:
            case 20:
            case 19:
            case 18:
            case 17:
                hungr = 0;
                break;
            case 16:
                hungr = Math.trunc(hungr / 4);
                break;
            case 15:
                hungr = Math.trunc(hungr / 2);
                break;
            }
            /* don't put player (quite) into fainting from
             * casting a spell, particularly since they might
             * not even be hungry at the beginning; however,
             * this is low enough that they must eat before
             * casting anything else except detect food
             */
            if (hungr > u.uhunger - 3)
                hungr = u.uhunger - 3;
            morehungry(hungr);
        }
    }

    chance = percent_success(spell);
    if (confused || (rnd(100) > chance)) {
        You(_("fail to cast the spell correctly."));
        u.uen -= Math.trunc(energy[0] / 2);
        disp.botl = TRUE;
        res[0] = ECMD_TIME;
        return TRUE;
    }
    return FALSE;
}

/* hero casts a spell of type spell_otyp, eg. SPE_SLEEP.
   hero must know the spell (unless force is TRUE). */
export function spelleffects(spell_otyp, atme, force) { /* int */
    const $frame = stack_frame(); try {
    let spell = force ? spell_otyp : spell_idx(spell_otyp);
    let energy = stack_var(int, 0), damage, n;
    let otyp, skill, role_skill, res = stack_var(int, ECMD_OK);
    let physical_damage = FALSE;
    let pseudo;
    let cc = stack_struct(struct_nhcoord);

    if (!force && spelleffects_check(spell, res, energy))
        return res[0];

    u.uen -= energy[0];
    disp.botl = TRUE;
    exercise(A_WIS, TRUE);
    /* pseudo is a temporary "false" object containing the spell stats */
    pseudo = mksobj(force ? spell : spellid(spell), FALSE, FALSE);
    pseudo.blessed = pseudo.cursed = 0;
    pseudo.quan = 20; /* do not let useup get it */
    /*
     * Find the skill the hero has in a spell type category.
     * See spell_skilltype for categories.
     */
    otyp = pseudo.otyp;
    skill = spell_skilltype(otyp);
    role_skill = P_SKILL(skill);

    switch (otyp) {
    /*
     * At first spells act as expected.  As the hero increases in skill
     * with the appropriate spell type, some spells increase in their
     * effects, e.g. more damage, further distance, and so on, without
     * additional cost to the spellcaster.
     */
    case SPE_FIREBALL:
    case SPE_CONE_OF_COLD:
        if (role_skill >= P_SKILLED) {
            if (throwspell()) {
                cc.x = u.dx;
                cc.y = u.dy;
                n = rnd(8) + 1;
                while (n--) {
                    if (!u.dx && !u.dy && !u.dz) {
                        if ((damage = zapyourself(pseudo, TRUE)) != 0) {
                            let buf = stack_array(char, BUFSZ);
                            sprintf(buf, _("zapped %sself with a spell"), uhim())
;
                            losehp(damage, buf, NO_KILLER_PREFIX);
                        }
                    } else {
                        explode(u.dx, u.dy,
                                otyp - SPE_MAGIC_MISSILE + 10,
                                spell_damage_bonus(Math.trunc(u.ulevel / 2) + 1), 0,
                                (otyp == SPE_CONE_OF_COLD)
                                   ? EXPL_FROSTY
                                   : EXPL_FIERY);
                    }
                    u.dx = cc.x + rnd(3) - 2;
                    u.dy = cc.y + rnd(3) - 2;
                    if (!isok(u.dx, u.dy) || !cansee(u.dx, u.dy)
                        || IS_STWALL(levl()[u.dx][u.dy].typ) || u.uswallow) {
                        /* Spell is reflected back to center */
                        u.dx = cc.x;
                        u.dy = cc.y;
                    }
                }
            }
            break;
        } /* else */
        /* FALLTHROUGH */;
        /*FALLTHRU*/

    /* these spells are all duplicates of wand effects */
    case SPE_FORCE_BOLT:
        physical_damage = TRUE;
        /* FALLTHROUGH */;
    /*FALLTHRU*/
    case SPE_SLEEP:
    case SPE_MAGIC_MISSILE:
    case SPE_KNOCK:
    case SPE_SLOW_MONSTER:
    case SPE_WIZARD_LOCK:
    case SPE_DIG:
    case SPE_TURN_UNDEAD:
    case SPE_POLYMORPH:
    case SPE_TELEPORT_AWAY:
    case SPE_CANCELLATION:
    case SPE_FINGER_OF_DEATH:
    case SPE_LIGHT:
    case SPE_DETECT_UNSEEN:
    case SPE_HEALING:
    case SPE_EXTRA_HEALING:
    case SPE_DRAIN_LIFE:
    case SPE_STONE_TO_FLESH:
        if (objects[otyp].oc_dir != NODIR) {
            if (otyp == SPE_HEALING || otyp == SPE_EXTRA_HEALING) {
                /* healing and extra healing are actually potion effects,
                   but they've been extended to take a direction like wands */
                if (role_skill >= P_SKILLED)
                    pseudo.blessed = 1;
            }
            if (atme) {
                u.dx = u.dy = u.dz = 0;
            } else if (!getdir(0)) {
                /* getdir cancelled, re-use previous direction */
                /*
                 * FIXME:  reusing previous direction only makes sense
                 * if there is an actual previous direction.  When there
                 * isn't one, the spell gets cast at self which is rarely
                 * what the player intended.  Unfortunately, the way
                 * spelleffects() is organized means that aborting with
                 * "nevermind" is not an option.
                 */
                pline_The(_("magical energy is released!"));
            }
            if (!u.dx && !u.dy && !u.dz) {
                if ((damage = zapyourself(pseudo, TRUE)) != 0) {
                    let buf = stack_array(char, BUFSZ);

                    sprintf(buf, _("zapped %sself with a spell"), uhim());
                    if (physical_damage)
                        damage = Maybe_Half_Phys(damage);
                    losehp(damage, buf, NO_KILLER_PREFIX);
                }
            } else
                weffects(pseudo);
        } else
            weffects(pseudo);
        update_inventory(); /* spell may modify inventory */
        break;

    /* these are all duplicates of scroll effects */
    case SPE_REMOVE_CURSE:
    case SPE_CONFUSE_MONSTER:
    case SPE_DETECT_FOOD:
    case SPE_CAUSE_FEAR:
    case SPE_IDENTIFY:
    case SPE_CHARM_MONSTER:
        /* high skill yields effect equivalent to blessed scroll */
        if (role_skill >= P_SKILLED)
            pseudo.blessed = 1;
        /* FALLTHROUGH */;
    /*FALLTHRU*/
    case SPE_MAGIC_MAPPING:
    case SPE_CREATE_MONSTER:
        seffects(pseudo);
        break;

    /* these are all duplicates of potion effects */
    case SPE_HASTE_SELF:
    case SPE_DETECT_TREASURE:
    case SPE_DETECT_MONSTERS:
    case SPE_LEVITATION:
    case SPE_RESTORE_ABILITY:
        /* high skill yields effect equivalent to blessed potion */
        if (role_skill >= P_SKILLED)
            pseudo.blessed = 1;
        /* FALLTHROUGH */;
    /*FALLTHRU*/
    case SPE_INVISIBILITY:
        peffects(pseudo);
        break;
    /* end of potion-like spells */

    case SPE_CURE_BLINDNESS:
        healup(0, 0, FALSE, TRUE);
        break;
    case SPE_CURE_SICKNESS: {
        let was_sick = +!!Sick(), was_slimed = +!!Slimed();

        /* cure conditions (which updates status) before feedback */
        healup(0, 0, TRUE, FALSE);
        /*
         *  Sick + !Slimed -- You are no longer ill.
         * !Sick + !Slimed -- You are not ill.
         * !Sick +  Slimed -- The slime disappears.
         *  Sick +  Slimed -- You are no longer ill.  The slime disappears.
         */
        if (was_sick || !was_slimed)
            You(_("are %s ill."), was_sick ? _("no longer") : _("not"));
        if (was_slimed)
            make_slimed(0, _("The slime disappears!"));
        break;
    }
    case SPE_CREATE_FAMILIAR:
        make_familiar(null, u.ux, u.uy, FALSE);
        break;
    case SPE_CLAIRVOYANCE:
        if (!BClairvoyant()) {
            if (role_skill >= P_SKILLED)
                pseudo.blessed = 1; /* detect monsters as well as map */
            do_vicinity_map(pseudo);
        /* at present, only one thing blocks clairvoyance */
        } else if (uarmh && uarmh.otyp == CORNUTHAUM)
            You(_("sense a pointy hat on top of your %s."), body_part(HEAD));
        break;
    case SPE_PROTECTION:
        cast_protection();
        break;
    case SPE_JUMPING:
        if (!(jump(max(role_skill, 1)) & ECMD_TIME))
            pline1(nothing_happens());
        break;
    case SPE_CHAIN_LIGHTNING:
        cast_chain_lightning();
        break;
    default:
        impossible(_("Unknown spell %d attempted."), spell);
        obfree(pseudo, null);
        return ECMD_OK;
    }

    /* gain skill for successful cast */
    if (!force)
        use_skill(skill, spellev(spell));

    obfree(pseudo, null); /* now, get rid of it */
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

/*ARGSUSED*/
function spell_aim_step(arg, x, y) { /* boolean */
    if (!isok(x,y))
        return FALSE;
    if (!ZAP_POS(levl()[x][y].typ)
        && !(IS_DOOR(levl()[x][y].typ) && (levl()[x][y].flags & D_ISOPEN)))
        return FALSE;
    return TRUE;
}

/* not quite the same as throwspell limits, but close enough */
function can_center_spell_location(x, y) { /* boolean */
    if (distmin(u.ux, u.uy, x, y) > 10)
        return FALSE;
    return (isok(x, y) && cansee(x, y) && !IS_STWALL(levl()[x][y].typ) ? 1 : 0);
}

function display_spell_target_positions(on_off) { /* void */
    let x, y, dx, dy;
    let dist = 10;

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
                if (can_center_spell_location(x, y))
                    tmp_at(x, y);
            }
    } else {
        /* off */
        tmp_at(DISP_END, 0);
    }
}

/* Choose location where spell takes effect. */
function throwspell() { /* int */
    const $frame = stack_frame(); try {
    let cc = stack_struct(struct_nhcoord), uc = stack_struct(struct_nhcoord);
    let mtmp;

    if (u.uinwater) {
        pline(_("You're joking!  In this weather?"));
        return 0;
    } else if (Is_waterlevel(u.uz)) {
        You(_("had better wait for the sun to come out."));
        return 0;
    }

    pline(_("Where do you want to cast the spell?"));
    cc.x = u.ux;
    cc.y = u.uy;
    getpos_sethilite(display_spell_target_positions,
                     can_center_spell_location);
    if (getpos(cc, TRUE, _("the desired position")) < 0)
        return 0; /* user pressed ESC */
    clear_nhwindow()(WIN_MESSAGE); /* discard any autodescribe feedback */

    /* The number of moves from hero to where the spell drops.*/
    if (distmin(u.ux, u.uy, cc.x, cc.y) > 10) {
        pline_The(_("spell dissipates over the distance!"));
        return 0;
    } else if (u.uswallow) {
        pline_The(_("spell is cut short!"));
        exercise(A_WIS, FALSE); /* What were you THINKING! */
        u.dx = 0;
        u.dy = 0;
        return 1;
    } else if (((cc.x != u.ux || cc.y != u.uy) && !cansee(cc.x, cc.y)
                && (!(mtmp = m_at(cc.x, cc.y)) || !canspotmon(mtmp)))
               || IS_STWALL(levl()[cc.x][cc.y].typ)) {
        Your(_("mind fails to lock onto that location!"));
        return 0;
    }

    uc.x = u.ux;
    uc.y = u.uy;

    walk_path(uc, cc, spell_aim_step, 0);

    u.dx = cc.x;
    u.dy = cc.y;
    return 1;
    } finally { stack_pop($frame); }
}

/* add/hide/remove/unhide teleport-away on behalf of dotelecmd() to give
   more control to behavior of ^T when used in wizard mode */
export function tport_spell(what) { /* int */
    const struct_tport_hideaway = struct("tport_spell.struct_tport_hideaway", {
        savespell: "struct_spell",
        tport_indx: int,
    }); let save_tport = static_struct("tport_spell.save_tport", struct_tport_hideaway);
    let i;
/* also defined in teleport.c */

    for (i = 0; i < MAXSPELL; i++)
        if (spellid(i) == SPE_TELEPORT_AWAY || spellid(i) == NO_SPELL)
            break;
    if (i == MAXSPELL) {
        impossible(_("tport_spell: spellbook full"));
        /* wizard mode ^T is not able to honor player's menu choice */
    } else if (spellid(i) == NO_SPELL) {
        if (what == HIDE_SPELL || what == REMOVESPELL) {
            save_tport.tport_indx = MAXSPELL;
        } else if (what == UNHIDESPELL) {
            /*assert( save_tport.savespell.sp_id == SPE_TELEPORT_AWAY );*/
            struct_assign(svs.spl_book[save_tport.tport_indx], save_tport.savespell);
            save_tport.tport_indx = MAXSPELL; /* burn bridge... */
        } else if (what == ADD_SPELL) {
            struct_assign(save_tport.savespell, svs.spl_book[i]);
            save_tport.tport_indx = i;
            svs.spl_book[i].sp_id = SPE_TELEPORT_AWAY;
            svs.spl_book[i].sp_lev = objects[SPE_TELEPORT_AWAY].oc_oc2;
            svs.spl_book[i].sp_know = KEEN;
            return REMOVESPELL; /* operation needed to reverse */
        }
    } else { /* spellid(i) == SPE_TELEPORT_AWAY */
        if (what == ADD_SPELL || what == UNHIDESPELL) {
            save_tport.tport_indx = MAXSPELL;
        } else if (what == REMOVESPELL) {
            /*assert( i == save_tport.tport_indx );*/
            struct_assign(svs.spl_book[i], save_tport.savespell);
            save_tport.tport_indx = MAXSPELL;
        } else if (what == HIDE_SPELL) {
            struct_assign(save_tport.savespell, svs.spl_book[i]);
            save_tport.tport_indx = i;
            svs.spl_book[i].sp_id = NO_SPELL;
            return UNHIDESPELL; /* operation needed to reverse */
        }
    }
    return NOOP_SPELL;
}
export const HIDE_SPELL = 1;
export const REMOVESPELL = 4;
export const UNHIDESPELL = 3;
export const ADD_SPELL = 2;
export const NOOP_SPELL = 0;

/* forget a random selection of known spells due to amnesia;
   they used to be lost entirely, as if never learned, but now we
   just set the memory retention to zero so that they can't be cast */
export function losespells() { /* void */
    let n, nzap, i;

    /* in case reading has been interrupted earlier, discard context */
    svc.context.spbook.book = null;
    svc.context.spbook.o_id = 0;
    /* count the number of known spells */
    for (n = 0; n < MAXSPELL; ++n)
        if (spellid(n) == NO_SPELL)
            break;

    /* lose anywhere from zero to all known spells;
       if confused, use the worse of two die rolls */
    nzap = rn2(n + 1);
    if (Confusion()) {
        i = rn2(n + 1);
        if (i > nzap)
            nzap = i;
    }
    /* good Luck might ameliorate spell loss */
    if (nzap > 1 && !rnl(7))
        nzap = rnd(nzap);

    /*
     * Forget 'nzap' out of 'n' known spells by setting their memory
     * retention to zero.  Every spell has the same probability to be
     * forgotten, even if its retention is already zero.
     *
     * Perhaps we should forget the corresponding book too?
     *
     * (3.4.3 removed spells entirely from the list, but always did
     * so from its end, so the 'nzap' most recently learned spells
     * were the ones lost by default.  Player had sort control over
     * the list, so could move the most useful spells to front and
     * only lose them if 'nzap' turned out to be a large value.
     *
     * Discarding from the end of the list had the virtue of making
     * casting letters for lost spells become invalid and retaining
     * the original letter for the ones which weren't lost, so there
     * was no risk to the player of accidentally casting the wrong
     * spell when using a letter that was in use prior to amnesia.
     * That wouldn't be the case if we implemented spell loss spread
     * throughout the list of known spells; every spell located past
     * the first lost spell would end up with new letter assigned.)
     */
    for (i = 0; nzap > 0; ++i) {
        /* when nzap is small relative to the number of spells left,
           the chance to lose spell [i] is small; as the number of
           remaining candidates shrinks, the chance per candidate
           gets bigger; overall, exactly nzap entries are affected */
        if (rn2(n - i) < nzap) {
            /* lose access to spell [i] */
            svs.spl_book[i].sp_know = 0;

            /* and abuse wisdom */
            exercise(A_WIS, FALSE);
            /* there's now one less spell slated to be forgotten */
            --nzap;
        }
    }
}

/*
 * Allow player to sort the list of known spells.  Manually swapping
 * pairs of them becomes very tedious once the list reaches two pages.
 *
 * Possible extensions:
 *      provide means for player to control ordering of skill classes;
 *      provide means to supply value N such that first N entries stick
 *      while rest of list is being sorted;
 *      make chosen sort order be persistent such that when new spells
 *      are learned, they get inserted into sorted order rather than be
 *      appended to the end of the list?
 */

    const SORTBY_LETTER = 0;
    const SORTBY_ALPHA = SORTBY_LETTER + 1;
    const SORTBY_LVL_LO = SORTBY_ALPHA + 1;
    const SORTBY_LVL_HI = SORTBY_LVL_LO + 1;
    const SORTBY_SKL_AL = SORTBY_LVL_HI + 1;
    const SORTBY_SKL_LO = SORTBY_SKL_AL + 1;
    const SORTBY_SKL_HI = SORTBY_SKL_LO + 1;
    const SORTBY_CURRENT = SORTBY_SKL_HI + 1;
    const SORTRETAINORDER = SORTBY_CURRENT + 1;

    const NUM_SPELL_SORTBY = SORTRETAINORDER + 1;

const spl_sortchoices = static_array("spl_sortchoices", ptr_to(char), NUM_SPELL_SORTBY, [
    _("by casting letter"),
    _("alphabetically"),
    _("by level, low to high"),
    _("by level, high to low"),
    _("by skill group, alphabetized within each group"),
    _("by skill group, low to high level within group"),
    _("by skill group, high to low level within group"),
    _("maintain current ordering"),
    /* a menu choice rather than a sort choice */
    _("reassign casting letters to retain current order"),
]);

/* qsort callback routine */
function spell_cmp(vptr1, vptr2) { /* int QSORTCALLBACK */
    /*
     * gather up all of the possible parameters except spell name
     * in advance, even though some might not be needed:
     *  indx. = spl_orderindx[] index into svs.spl_book[];
     *  otyp. = svs.spl_book[] index into objects[];
     *  levl. = spell level;
     *  skil. = skill group aka spell class.
     */
    let indx1 = ref_to(int, vptr1)[0], indx2 = ref_to(int, vptr2)[0],
        otyp1 = svs.spl_book[indx1].sp_id, otyp2 = svs.spl_book[indx2].sp_id,
        levl1 = objects[otyp1].oc_oc2, levl2 = objects[otyp2].oc_oc2,
        skil1 = objects[otyp1].oc_subtyp, skil2 = objects[otyp2].oc_subtyp;

    switch (gs.spl_sortmode) {
    case SORTBY_LETTER:
        return indx1 - indx2;
    case SORTBY_ALPHA:
        break;
    case SORTBY_LVL_LO:
        if (levl1 != levl2)
            return levl1 - levl2;
        break;
    case SORTBY_LVL_HI:
        if (levl1 != levl2)
            return levl2 - levl1;
        break;
    case SORTBY_SKL_AL:
        if (skil1 != skil2)
            return skil1 - skil2;
        break;
    case SORTBY_SKL_LO:
        if (skil1 != skil2)
            return skil1 - skil2;
        if (levl1 != levl2)
            return levl1 - levl2;
        break;
    case SORTBY_SKL_HI:
        if (skil1 != skil2)
            return skil1 - skil2;
        if (levl1 != levl2)
            return levl2 - levl1;
        break;
    case SORTBY_CURRENT:
    default:
        return (vptr1 < vptr2) ? -1
                               : +(vptr1 > vptr2); /* keep current order */
    }
    /* tie-breaker for most sorts--alphabetical by spell name */
    return strcmpi(OBJ_NAME(objects[otyp1]), OBJ_NAME(objects[otyp2]));
}

/* sort the index used for display order of the "view known spells"
   list (sortmode == SORTBY_xxx), or sort the spellbook itself to make
   the current display order stick (sortmode == SORTRETAINORDER) */
function sortspells() { /* void */
    const $frame = stack_frame(); try {
    let i;

    let n;

    if (gs.spl_sortmode == SORTBY_CURRENT)
        return;
    for (n = 0; n < MAXSPELL && spellid(n) != NO_SPELL; ++n)
        continue;
    if (n < 2)
        return; /* not enough entries to need sorting */

    if (!gs.spl_orderindx) {
        /* we haven't done any sorting yet; list is in casting order */
        if (gs.spl_sortmode == SORTBY_LETTER /* default */
            || gs.spl_sortmode == SORTRETAINORDER)
            return;
        /* allocate enough for full spellbook rather than just N spells */
        gs.spl_orderindx = ref_to(int, addr_of(alloc(MAXSPELL * sizeof(int))));
        for (i = 0; i < MAXSPELL; i++)
            gs.spl_orderindx[i] = i;
    }

    if (gs.spl_sortmode == SORTRETAINORDER) {
        let tmp_book = stack_array(struct_spell, MAXSPELL);

        /* sort svs.spl_book[] rather than spl_orderindx[];
           this also updates the index to reflect the new ordering (we
           could just free it since that ordering becomes the default) */
        for (i = 0; i < MAXSPELL; i++)
            struct_assign(tmp_book[i], svs.spl_book[gs.spl_orderindx[i]]);
        for (i = 0; i < MAXSPELL; i++)
            struct_assign(svs.spl_book[i], tmp_book[i]), gs.spl_orderindx[i] = i;
        gs.spl_sortmode = SORTBY_LETTER; /* reset */
        return;
    }

    /* usual case, sort the index rather than the spells themselves */
    qsort(addr_of(gs.spl_orderindx), n,
          sizeof(int), spell_cmp);
    return;
    } finally { stack_pop($frame); }
}

/* called if the [sort spells] entry in the view spells menu gets chosen */
function spellsortmenu() { /* boolean */
    const $frame = stack_frame(); try {
    let tmpwin;
    let selected = stack_var(ptr_to(struct_mi));
    let any = stack_struct(struct_any);
    let let_;
    let i, n, choice;
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany); /* zero out all bits */

    for (i = 0; i < SIZE(spl_sortchoices); i++) {
        if (i == SORTRETAINORDER) {
            let_ = ord('z'); /* assumes fewer than 26 sort choices... */
            /* separate final choice from others with a blank line */
            add_menu_str(tmpwin, _(""));
        } else {
            let_ = ord('a') + i;
        }
        any.a_int = i + 1;
        add_menu(tmpwin, nul_glyphinfo, any, let_, 0,
                 ATR_NONE, clr, spl_sortchoices[i],
                 (i == gs.spl_sortmode) ? MENU_ITEMFLAGS_SELECTED
                                        : MENU_ITEMFLAGS_NONE);
    }
    end_menu()(tmpwin, _("View known spells list sorted"));

    n = select_menu(tmpwin, PICK_ONE, selected);
    destroy_nhwindow()(tmpwin);
    if (n > 0) {
        choice = ptr_add(selected[0], 0).item.a_int - 1;
        /* skip preselected entry if we have more than one item chosen */
        if (n > 1 && choice == gs.spl_sortmode)
            choice = ptr_add(selected[0], 1).item.a_int - 1;
        free(addr_of(selected[0]));
        gs.spl_sortmode = choice;
        return TRUE;
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

/* the #showspells command -- view known spells */
export function dovspell() { /* int */
    const $frame = stack_frame(); try {
    let qbuf = stack_array(char, QBUFSZ);
    let splnum = stack_var(int), othnum = stack_var(int);
    let spl_tmp = stack_struct(struct_spell);

    if (spellid(0) == NO_SPELL) {
        You(_("don't know any spells right now."));
    } else {
        while (dospellmenu(_("Currently known spells"),
                           SPELLMENU_VIEW, splnum)) {
            if (splnum[0] == SPELLMENU_SORT) {
                if (spellsortmenu())
                    sortspells();
            } else {
                sprintf(qbuf, _("Reordering spells; swap '%c' with"), spellet(splnum[0]))
;
                if (!dospellmenu(qbuf, splnum[0], othnum))
                    break;

                struct_assign(spl_tmp, svs.spl_book[splnum[0]]);
                struct_assign(svs.spl_book[splnum[0]], svs.spl_book[othnum[0]]);
                struct_assign(svs.spl_book[othnum[0]], spl_tmp);
            }
        }
    }
    if (gs.spl_orderindx) {
        free(addr_of(gs.spl_orderindx));
        gs.spl_orderindx = null;
    }
    gs.spl_sortmode = SORTBY_LETTER; /* 0 */
    return ECMD_OK;
    } finally { stack_pop($frame); }
}

/* lists spells for endgame dumplog purposes */
export function show_spells() { /* void */
    const $frame = stack_frame(); try {
    let unused = stack_var(int, SPELLMENU_DUMP);
    if (spellid(0) == NO_SPELL) {
        pline(_("You didn't know any spells."));
        pline(_("%s"), _(""));
    } else {
        pline(_("Spells:"));
        dospellmenu(_(""), SPELLMENU_DUMP, unused);
    }
    } finally { stack_pop($frame); }
}

/* shows menu of known spells, with options to sort them.
   return FALSE on cancel, TRUE otherwise.
   spell_no is set to the internal spl_book index, if any selected */
function dospellmenu(
    prompt,
    splaction,

    spell_no) { /* boolean */
    const $frame = stack_frame(); try {
    let tmpwin;
    let i, n, how, splnum;
    let buf = stack_array(char, BUFSZ), retentionbuf = stack_array(char, 24), sep;
    let fmt;
    let selected = stack_var(ptr_to(struct_mi));
    let any = stack_struct(struct_any);
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany); /* zero out all bits */

    /*
     * The correct spacing of the columns when not using
     * tab separation depends on the following:
     * (1) that the font is monospaced, and
     * (2) that selection letters are prepended to the
     *     given string and are of the form "a - ".
     * For SPELLMENU_DUMP, (2) is untrue, so four spaces
     * need to be subtracted.
     */
    if (!iflags.menu_tab_sep) {
        sprintf(buf, _("%s%-20s Level %-12s Fail Retention"), splaction == SPELLMENU_DUMP ? _("") : _("    "), _("Name"), _("Category"))

;
        fmt = _("%-20s  %2d   %-12s %3d%% %9s");
        sep = ord(' ');
    } else {
        sprintf(buf, _("Name\tLevel\tCategory\tFail\tRetention"));
        fmt = _("%s\t%-d\t%s\t%-d%%\t%s");
        sep = ord('\t');
    }
    if (wizard())
        sprintf(eos(buf), _("%c%6s"), sep, _("turns"));

    add_menu_heading(tmpwin, buf);
    for (i = 0; i < MAXSPELL && spellid(i) != NO_SPELL; i++) {
        splnum = !gs.spl_orderindx ? i : gs.spl_orderindx[i];
        sprintf(buf, fmt, spellname(splnum), spellev(splnum), spelltypemnemonic(spell_skilltype(spellid(splnum))), 100 - percent_success(splnum), spellretention(splnum, retentionbuf))

;
        if (wizard())
            sprintf(eos(buf), _("%c%6d"), sep, spellknow(i));

        any.a_int = splnum + 1; /* must be non-zero */
        add_menu(tmpwin, nul_glyphinfo, any, spellet(splnum), 0,
                 ATR_NONE, clr, buf,
                 (splnum == splaction)
                    ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);
    }
    how = PICK_ONE;
    if (splaction == SPELLMENU_VIEW) {
        if (spellid(1) == NO_SPELL) {
            /* only one spell => nothing to swap with */
            how = PICK_NONE;
        } else {
            /* more than 1 spell, add an extra menu entry */
            any.a_int = SPELLMENU_SORT + 1;
            add_menu(tmpwin, nul_glyphinfo, any, ord('+'), 0,
                     ATR_NONE, clr, _("[sort spells]"), MENU_ITEMFLAGS_NONE);
        }
    }
    end_menu()(tmpwin, prompt);

    n = select_menu(tmpwin, how, selected);
    destroy_nhwindow()(tmpwin);
    if (n > 0) {
        spell_no[0] = ptr_add(selected[0], 0).item.a_int - 1;
        /* menu selection for `PICK_ONE' does not
           de-select any preselected entry */
        if (n > 1 && spell_no[0] == splaction)
            spell_no[0] = ptr_add(selected[0], 1).item.a_int - 1;
        free(addr_of(selected[0]));
        /* default selection of preselected spell means that
           user chose not to swap it with anything */
        if (spell_no[0] == splaction)
            return FALSE;
        return TRUE;
    } else if (splaction >= 0) {
        /* explicit de-selection of preselected spell means that
           user is still swapping but not for the current spell */
        spell_no[0] = splaction;
        return TRUE;
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

function percent_success(spell) { /* int */
    /* Intrinsic and learned ability are combined to calculate
     * the probability of player's success at casting a given spell.
     */
    let chance, splcaster, special, statused;
    let difficulty;
    let skill, skilltype = spell_skilltype(spellid(spell));
    /* Knights don't get metal armor penalty for clerical spells */
    let paladin_bonus = +(Role_if(PM_KNIGHT)
                             && skilltype == P_CLERIC_SPELL);

    /* Calculate intrinsic ability (splcaster) */

    splcaster = gu.urole.spelbase;
    special = gu.urole.spelheal;
    statused = ACURR(gu.urole.spelstat);

    if (uarm && is_metallic(uarm) && !paladin_bonus)
        splcaster += (uarmc && uarmc.otyp == ROBE) ? Math.trunc(gu.urole.spelarmr / 2)
                                                    : gu.urole.spelarmr;
    else if (uarmc && uarmc.otyp == ROBE)
        splcaster -= gu.urole.spelarmr;
    if (uarms)
        splcaster += gu.urole.spelshld;

    if (uwep && uwep.otyp == QUARTERSTAFF)
        splcaster -= 3; /* Small bonus */

    if (!paladin_bonus) {
        if (uarmh && is_metallic(uarmh)) /* && otyp != HELM_OF_BRILLIANCE */
            splcaster += uarmhbon;
        if (uarmg && is_metallic(uarmg))
            splcaster += uarmgbon;
        if (uarmf && is_metallic(uarmf))
            splcaster += uarmfbon;
    }

    if (spellid(spell) == gu.urole.spelspec)
        splcaster += gu.urole.spelsbon;

    /* `healing spell' bonus */
    if (spellid(spell) == SPE_HEALING || spellid(spell) == SPE_EXTRA_HEALING
        || spellid(spell) == SPE_CURE_BLINDNESS
        || spellid(spell) == SPE_CURE_SICKNESS
        || spellid(spell) == SPE_RESTORE_ABILITY
        || spellid(spell) == SPE_REMOVE_CURSE)
        splcaster += special;

    if (splcaster > 20)
        splcaster = 20;

    /* Calculate learned ability */

    /* The player's basic likelihood of being able to cast any spell
     * is based of their `magic' statistic. (Int or Wis)
     */
    chance = Math.trunc(11 * statused / 2);

    /*
     * High-level spells are harder.  Easier for higher-level casters.
     * The difficulty is based on the hero's level and their skill level
     * in that spell type.
     */
    skill = P_SKILL(skilltype);
    skill = max(skill, P_UNSKILLED) - 1; /* unskilled => 0 */
    difficulty =
        (spellev(spell) - 1) * 4 - ((skill * 6) + Math.trunc(u.ulevel / 3) + 1);

    if (difficulty > 0) {
        /* Player is too low level or unskilled. */
        chance -= isqrt(900 * difficulty + 2000);
    } else {
        /* Player is above level.  Learning continues, but the
         * law of diminishing returns sets in quickly for
         * low-level spells.  That is, a player quickly gains
         * no advantage for raising level.
         */
        let learning = Math.trunc(15 * -difficulty / spellev(spell));
        chance += learning > 20 ? 20 : learning;
    }

    /* Clamp the chance: >18 stat and advanced learning only help
     * to a limit, while chances below "hopeless" only raise the
     * specter of overflowing 16-bit ints (and permit wearing a
     * shield to raise the chances :-).
     */
    if (chance < 0)
        chance = 0;
    if (chance > 120)
        chance = 120;

    /* Wearing anything but a light shield makes it very awkward
     * to cast a spell.  The penalty is not quite so bad for the
     * player's role-specific spell.
     */
    if (uarms && weight(uarms) > int((objects[SMALL_SHIELD].oc_weight))) {
        if (spellid(spell) == gu.urole.spelspec) {
            chance = Math.trunc(chance / 2);
        } else {
            chance = Math.trunc(chance / 4);
        }
    }

    /* Finally, chance (based on player intell/wisdom and level) is
     * combined with ability (based on player intrinsics and
     * encumbrances).  No matter how intelligent/wise and advanced
     * a player is, intrinsics and encumbrance can prevent casting;
     * and no matter how able, learning is always required.
     */
    chance = Math.trunc(chance * (20 - splcaster) / 15) - splcaster;

    /* Clamp to percentile */
    if (chance > 100)
        chance = 100;
    if (chance < 0)
        chance = 0;

    return chance;
}

function spellretention(idx, outbuf) { /* char * */
    let turnsleft, percent, accuracy;
    let skill;

    skill = P_SKILL(spell_skilltype(spellid(idx)));
    skill = max(skill, P_UNSKILLED); /* restricted same as unskilled */
    turnsleft = spellknow(idx);
    chars[outbuf] = ord('\0'); /* lint suppression */

    if (turnsleft < 1) {
        /* spell has expired; hero can't successfully cast it anymore */
        strcpy(outbuf, _("(gone)"));
    } else if (turnsleft >= KEEN) {
        /* full retention, first turn or immediately after reading book */
        strcpy(outbuf, _("100%"));
    } else {
        /*
         * Retention is displayed as a range of percentages of
         * amount of time left until memory of the spell expires;
         * the precision of the range depends upon hero's skill
         * in this spell.
         *    expert:  2% intervals; 1-2,   3-4,  ...,   99-100;
         *   skilled:  5% intervals; 1-5,   6-10, ...,   95-100;
         *     basic: 10% intervals; 1-10, 11-20, ...,   91-100;
         * unskilled: 25% intervals; 1-25, 26-50, 51-75, 76-100.
         *
         * At the low end of each range, a value of N% really means
         * (N-1)%+1 through N%; so 1% is "greater than 0, at most 200".
         * KEEN is a multiple of 100; KEEN/100 loses no precision.
         */
        percent = Math.trunc((turnsleft - 1) / Math.trunc(KEEN / 100)) + 1;
        accuracy = (skill == P_EXPERT) ? 2
                   : (skill == P_SKILLED) ? 5
                     : (skill == P_BASIC) ? 10
                       : 25;
        /* round up to the high end of this range */
        percent = accuracy * (Math.trunc((percent - 1) / accuracy) + 1);
        sprintf(outbuf, _("%lld%%-%lld%%"), percent - accuracy + 1, percent);
    }
    return outbuf;
}

/* Learn a spell during creation of the initial inventory */
export function initialspell(obj) { /* void */
    let i, otyp = obj.otyp;

    for (i = 0; i < MAXSPELL; i++)
        if (spellid(i) == NO_SPELL || spellid(i) == otyp)
            break;

    if (i == MAXSPELL) {
        impossible(_("Too many spells memorized!"));
    } else if (spellid(i) != NO_SPELL) {
        /* initial inventory shouldn't contain duplicate spellbooks */
        impossible(_("Spell %s already known."), OBJ_NAME(objects[otyp]));
    } else {
        svs.spl_book[i].sp_id = otyp;
        svs.spl_book[i].sp_lev = objects[otyp].oc_oc2;
        incrnknow(i, 0);
    }
    return;
}

/* returns one of spe_Unknown, spe_Fresh, spe_GoingStale, spe_Forgotten */
export function known_spell(otyp) { /* int */
    let i, k;

    for (i = 0; (i < MAXSPELL) && (spellid(i) != NO_SPELL); i++)
        if (spellid(i) == otyp) {
            k = spellknow(i);
            return (k > Math.trunc(KEEN / 10)) ? spe_Fresh
                   : (k > 0) ? spe_GoingStale
                     : spe_Forgotten;
        }
    return spe_Unknown;
}

/* return index for spell otyp, or UNKNOWN_SPELL if not found */
export function spell_idx(otyp) { /* int */
    let i;

    for (i = 0; (i < MAXSPELL) && (spellid(i) != NO_SPELL); i++)
        if (spellid(i) == otyp)
            return i;
    return UNKNOWN_SPELL;
}

/* learn or refresh spell otyp, if feasible; return casting letter or '\0' */
export function force_learn_spell(otyp) { /* char */
    let i;

    if (otyp == SPE_BLANK_PAPER || otyp == SPE_BOOK_OF_THE_DEAD
        || known_spell(otyp) == spe_Fresh)
        return ord('\0');

    for (i = 0; i < MAXSPELL; i++)
        if (spellid(i) == NO_SPELL || spellid(i) == otyp)
            break;
    if (i == MAXSPELL) {
        impossible(_("Too many spells memorized"));
        return ord('\0');
    }
    /* for a going-stale or forgotten spell the sp_id and sp_lev assignments
       are redundant but harmless; for an unknown spell, they're essential */
    svs.spl_book[i].sp_id = otyp;
    svs.spl_book[i].sp_lev = objects[otyp].oc_oc2;
    incrnknow(i, 0); /* set spl_book[i].sp_know to KEEN; unlike when learning
                      * a spell by reading its book, we don't need to add 1 */
    return spellet(i);
}

/* number of spells hero knows */
export function num_spells() { /* int */
    let i;

    for (i = 0; i < MAXSPELL; i++)
        if (spellid(i) == NO_SPELL)
            break;
    return i;
}

/*spell.c*/

import { A_INT, A_STR, A_WIS } from "./attrib.h.js";
import { ACURR } from "./attrib.h.macros.js";
import { NO_COLOR } from "./color.h.js";
import { struct_nhcoord } from "./coord.h.js";
import { NH_GOLDEN, Never_mind, nothing_happens, something } from "./decl.h.macros.js";
import { SPBOOK_CLASS, S_goodpos } from "./defsym.h.js";
import { DISP_BEAM, DISP_CHANGE, DISP_END, EXPL_FIERY, EXPL_FROSTY } from "./display.h.js";
import { canspotmon, cmap_to_glyph } from "./display.h.macros.js";
import { Is_waterlevel } from "./dungeon.h.macros.js";
import { wizard } from "./flag.h.macros.js";
import { BUFSZ, FALSE, LL_CONDUCT, QBUFSZ, TRUE, coordxy } from "./global.h.js";
import { strcmpi } from "./global.h.macros.js";
import {
    CMDQ_KEY, CQ_REPEAT, ECMD_FAIL, ECMD_OK, ECMD_TIME, EYE, FACE, HEAD, KILLED_BY_AN,
    MENU_TRADITIONAL, NO_KILLER_PREFIX, NO_MINVENT, N_DIRS, SPINE, XKILL_GIVEMSG, struct__cmd_queue,
} from "./hack.h.js";
import {
    BZ_U_SPELL, DIR_LEFT, DIR_RIGHT2, Maybe_Half_Phys, makeknown, max, mdistu, min, pline1, qsort,
    rn1, y_n,
} from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { AD_ELEC } from "./monattk.h.js";
import { enfolds, eyecount, is_animal, is_undead, is_whirly } from "./mondata.h.macros.js";
import { DEADMONSTER, is_vampshifter, resists_elec } from "./monst.h.macros.js";
import { PM_FOG_CLOUD, PM_KNIGHT, PM_MASTER_LICH, PM_NALFESHNEE, PM_WIZARD } from "./monsters.h.js";
import { EF_GREASE, EF_VERBOSE, ERODE_CORRODE, struct_obj } from "./obj.h.js";
import { MAXSPELL, NODIR } from "./objclass.h.js";
import { OBJ_NAME, is_metallic } from "./objclass.h.macros.js";
import {
    BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION, CORNUTHAUM, LENSES, QUARTERSTAFF, ROBE,
    SMALL_SHIELD, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_CANCELLATION, SPE_CAUSE_FEAR,
    SPE_CHAIN_LIGHTNING, SPE_CHARM_MONSTER, SPE_CLAIRVOYANCE, SPE_CONE_OF_COLD, SPE_CONFUSE_MONSTER,
    SPE_CREATE_FAMILIAR, SPE_CREATE_MONSTER, SPE_CURE_BLINDNESS, SPE_CURE_SICKNESS, SPE_DETECT_FOOD,
    SPE_DETECT_MONSTERS, SPE_DETECT_TREASURE, SPE_DETECT_UNSEEN, SPE_DIG, SPE_DRAIN_LIFE,
    SPE_EXTRA_HEALING, SPE_FINGER_OF_DEATH, SPE_FIREBALL, SPE_FORCE_BOLT, SPE_HASTE_SELF,
    SPE_HEALING, SPE_IDENTIFY, SPE_INVISIBILITY, SPE_JUMPING, SPE_KNOCK, SPE_LEVITATION, SPE_LIGHT,
    SPE_MAGIC_MAPPING, SPE_MAGIC_MISSILE, SPE_NOVEL, SPE_POLYMORPH, SPE_PROTECTION,
    SPE_REMOVE_CURSE, SPE_RESTORE_ABILITY, SPE_SLEEP, SPE_SLOW_MONSTER, SPE_STONE_TO_FLESH,
    SPE_TELEPORT_AWAY, SPE_TURN_UNDEAD, SPE_WIZARD_LOCK,
} from "./objects.h.js";
import { TIMEOUT } from "./prop.h.js";
import {
    CLOUD, DRAWBRIDGE_UP, D_CLOSED, D_ISOPEN, D_LOCKED, LAVAPOOL, MOAT, POOL,
} from "./rm.h.js";
import { IS_DOOR, IS_STWALL, IS_TREE, SPACE_POS, ZAP_POS, levl, m_at } from "./rm.h.macros.js";
import {
    P_ATTACK_SPELL, P_BASIC, P_CLERIC_SPELL, P_DIVINATION_SPELL, P_ENCHANTMENT_SPELL,
    P_ESCAPE_SPELL, P_EXPERT, P_GRAND_MASTER, P_HEALING_SPELL, P_MASTER, P_MATTER_SPELL, P_NONE,
    P_SKILLED, P_UNSKILLED,
} from "./skills.h.js";
import { P_SKILL } from "./skills.h.macros.js";
import {
    MAX_SPELL_STUDY, NO_SPELL, UNKNOWN_SPELL, spe_Forgotten, spe_Fresh, spe_GoingStale, spe_Unknown,
    struct_spell,
} from "./spell.h.js";
import { SPELL_LEV_PW, decrnknow, spellid, spellknow } from "./spell.h.macros.js";
import { cansee } from "./vision.h.macros.js";
import {
    clear_nhwindow, create_nhwindow, destroy_nhwindow, display_nhwindow, end_menu, nh_delay_output,
    start_menu,
} from "./winprocs.h.macros.js";
import {
    ATR_NONE, MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, MENU_ITEMFLAGS_SELECTED, NHW_MENU,
    PICK_NONE, PICK_ONE, struct_any, struct_mi,
} from "./wintype.h.js";
import { ACH_INVK, ACH_NOVL } from "./you.h.js";
import { Role_if, u_at, uhim } from "./you.h.macros.js";
import {
    Antimagic, BClairvoyant, Blind, BlindedTimeout, Confusion, HConfusion, HStun, Hallucination,
    Poison_resistance, Sick, Sleep_resistance, Slimed, Stunned,
} from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, sizeof, sizeof_string, uchar, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { free, sprintf, strchr, strcpy } from "../rt/libc.js";
import {
    init_list, init_string, stack_array, stack_struct, stack_var, static_array, static_struct,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, ptr_add, ptr_to, ref_of, ref_to, struct, struct_assign, struct_copy,
} from "../rt/struct.js";
import { stop_occupation } from "./allmain.js";
import { alloc } from "./alloc.js";
import { jump } from "./apply.js";
import { acurr, exercise, poison_strdmg } from "./attrib.js";
import { cmdq_add_key, cmdq_pop, getdir, isok, set_occupation, yn_function } from "./cmd.js";
import {
    cg, disp, flags, gb, gi, gm, gn, go, gs, gu, gy, iflags, quitchars, svb, svc, svm, svs, u, xdir,
    ydir,
} from "./decl.js";
import { do_vicinity_map } from "./detect.js";
import {
    canseemon, map_invisible, nul_glyphinfo, shieldeff, tmp_at, zapdir_to_glyph,
} from "./display.js";
import { trycall } from "./do.js";
import { Monnam, hcolor, hliquid, mon_nam, noveltitle } from "./do_name.js";
import { find_ac } from "./do_wear.js";
import { make_familiar, tamedog } from "./dog.js";
import { walk_path } from "./dothrow.js";
import { morehungry } from "./eat.js";
import { freehand } from "./engrave.js";
import { more_experienced, newexplevel } from "./exper.js";
import { explode } from "./explode.js";
import { read_tribute } from "./files.js";
import { getpos, getpos_sethilite } from "./getpos.js";
import { check_capacity, invocation_pos, losehp, nomul } from "./hack.js";
import { distmin, eos, isqrt, sgn } from "./hacklib.js";
import { record_achievement } from "./insight.js";
import { update_inventory, useup } from "./invent.js";
import { makemon, set_malign } from "./makemon.js";
import { mkinvokearea } from "./mklev.js";
import { mksobj, set_bknown, weight } from "./mkobj.js";
import { mkundead } from "./mkroom.js";
import { iter_mons, wakeup, xkilled } from "./mon.js";
import { can_chant, defended } from "./mondata.js";
import { monflee } from "./monmove.js";
import { mons } from "./monst.js";
import { discover_object, objdescr_is, observe_object } from "./o_init.js";
import { objects } from "./objects.js";
import { Tobjnam, an, makeplural } from "./objnam.js";
import {
    You, You_feel, You_hear, Your, impossible, livelog_printf, pline, pline_The,
} from "./pline.js";
import { body_part } from "./polyself.js";
import {
    healup, make_blinded, make_confused, make_slimed, make_stunned, peffects,
} from "./potion.js";
import { seffects } from "./read.js";
import { d, rn2, rn2_on_display_rng, rnd, rnl } from "./rnd.js";
import { check_unpaid, obfree } from "./shk.js";
import { rndcurse, take_gold } from "./sit.js";
import { On_stairs } from "./stairs.js";
import { tele } from "./teleport.js";
import { fall_asleep } from "./timeout.js";
import { erode_obj } from "./trap.js";
import { use_skill } from "./weapon.js";
import { add_menu, add_menu_heading, add_menu_str, select_menu } from "./windows.js";
import { aggravate } from "./wizard.js";
import { exclam, spell_damage_bonus, unturn_dead, weffects, zapyourself, zhitm } from "./zap.js";
