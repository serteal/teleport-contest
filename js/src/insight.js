/* NetHack 5.0	insight.c	$NHDT-Date: 1777004419 2026/04/23 20:20:19 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.134 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * Enlightenment and Conduct+Achievements and Vanquished+Extinct+Geno'd
 * and stethoscope/probing feedback.
 *
 * Most code used to reside in cmd.c, presumably because ^X was originally
 * a wizard mode command and the majority of those are in that file.
 * Some came from end.c where it is used during end of game disclosure.
 * And some came from priest.c that had once been in pline.c.
 */

  /* hunger status from eat.c */
 /* encumbrance status from botl.c */

const You_ = init_string(static_array("You_", char, sizeof_string("You ")), _("You "), true); const are = init_string(static_array("are", char, sizeof_string("are ")), _("are "), true); const were = init_string(static_array("were", char, sizeof_string("were ")), _("were "), true);
const have = init_string(static_array("have", char, sizeof_string("have ")), _("have "), true); const had = init_string(static_array("had", char, sizeof_string("had ")), _("had "), true); const can = init_string(static_array("can", char, sizeof_string("can ")), _("can "), true);
const could = init_string(static_array("could", char, sizeof_string("could ")), _("could "), true);
const have_been = init_string(static_array("have_been", char, sizeof_string("have been ")), _("have been "), true); const have_never = init_string(static_array("have_never", char, sizeof_string("have never ")), _("have never "), true);
const never = init_string(static_array("never", char, sizeof_string("never ")), _("never "), true);

/* for livelogging: */
const struct_ll_achieve_msg = struct("struct_ll_achieve_msg", {
    llflag: long,
    msg: ptr_to(char),
});
/* ordered per 'enum achievements' in you.h */
/* take care to keep them in sync! */
const achieve_msg = static_array("achieve_msg", struct_ll_achieve_msg, null, [
    { llflag: 0, msg: _("") }, /* actual achievements are numbered from 1 */
    { llflag: LL_ACHIEVE, msg: _("acquired the Bell of Opening") },
    { llflag: LL_ACHIEVE, msg: _("entered Gehennom") },
    { llflag: LL_ACHIEVE, msg: _("acquired the Candelabrum of Invocation") },
    { llflag: LL_ACHIEVE, msg: _("acquired the Book of the Dead") },
    { llflag: LL_ACHIEVE, msg: _("performed the invocation") },
    { llflag: LL_ACHIEVE, msg: _("acquired The Amulet of Yendor") },
    { llflag: LL_ACHIEVE, msg: _("entered the Elemental Planes") },
    { llflag: LL_ACHIEVE, msg: _("entered the Astral Plane") },
    { llflag: LL_ACHIEVE, msg: _("ascended") },
    /* if the type of item isn't discovered yet, disclosing the event
       via #chronicle would be a spoiler (particularly for gray stone);
       the ID'd name for the type of item will be appended to the next
       two messages, for display via livelog and/or dumplog */
    { llflag: LL_ACHIEVE | LL_SPOILER, msg: _("acquired the Mines' End") }, /* " luckstone" */
    { llflag: LL_ACHIEVE | LL_SPOILER, msg: _("acquired the Sokoban") }, /* " <item>" */
    { llflag: LL_ACHIEVE | LL_UMONST, msg: _("killed Medusa") },
     /* these two are not logged */
    { llflag: 0, msg: _("hero was always blond, no, blind") },
    { llflag: 0, msg: _("hero never wore armor") },
     /* */
    { llflag: LL_MINORAC | LL_DUMP, msg: _("entered the Gnomish Mines") },
    { llflag: LL_ACHIEVE, msg: _("reached Mine Town") }, /* probably minor, but dnh logs it */
    { llflag: LL_MINORAC, msg: _("entered a shop") },
    { llflag: LL_MINORAC, msg: _("entered a temple") },
    { llflag: LL_ACHIEVE, msg: _("consulted the Oracle") }, /* minor, but rare enough */
    { llflag: LL_MINORAC | LL_DUMP, msg: _("read a Discworld novel") }, /* even more so */
    { llflag: LL_ACHIEVE, msg: _("entered Sokoban") }, /* keep as major for turn comparison
                                        * with completed sokoban */
    { llflag: LL_ACHIEVE, msg: _("entered the Bigroom") },
    /* The following 8 are for advancing through the ranks
       and messages differ by role so are created on the fly;
       rank 0 (Xp 1 and 2) isn't an achievement */
    { llflag: LL_MINORAC | LL_DUMP, msg: _("") }, /* Xp 3 */
    { llflag: LL_MINORAC | LL_DUMP, msg: _("") }, /* Xp 6 */
    { llflag: LL_MINORAC | LL_DUMP, msg: _("") }, /* Xp 10 */
    { llflag: LL_ACHIEVE, msg: _("") }, /* Xp 14, so able to attempt the quest */
    { llflag: LL_ACHIEVE, msg: _("") }, /* Xp 18 */
    { llflag: LL_ACHIEVE, msg: _("") }, /* Xp 22 */
    { llflag: LL_ACHIEVE, msg: _("") }, /* Xp 26 */
    { llflag: LL_ACHIEVE, msg: _("") }, /* Xp 30 */
    { llflag: LL_MINORAC, msg: _("learned castle drawbridge's tune") }, /* achievement #31 */
    { llflag: 0, msg: _("") } /* keep this one at the end */
]);

/* macros to simplify output of enlightenment messages; also used by
   conduct and achievements */

function enlght_out(buf) { /* void */
    if (ge.en_via_menu) {
        add_menu_str(ge.en_win, buf);
    } else
        putstr()(ge.en_win, 0, buf);
}

function enlght_line(
    start,
    middle,
    end,
    ps) { /* void */
    const $frame = stack_frame(); try {
    const struct_contrctn = struct("enlght_line.struct_contrctn", {
        twowords: ptr_to(char), contrctn: ptr_to(char),
    }); let contra = static_array("enlght_line.contra", struct_contrctn, null, [
        { twowords: _(" are not "), contrctn: _(" aren't ") },
        { twowords: _(" were not "), contrctn: _(" weren't ") },
        { twowords: _(" have not "), contrctn: _(" haven't ") },
        { twowords: _(" had not "), contrctn: _(" hadn't ") },
        { twowords: _(" can not "), contrctn: _(" can't ") },
        { twowords: _(" could not "), contrctn: _(" couldn't ") },
    ]);
    let i;

    let buf = stack_array(char, BUFSZ);

    sprintf(buf, _(" %s%s%s%s."), start, middle, end, ps);

    if (strstri(buf, _(" not "))) { /* TODO: switch to libc strstr() */
        for (i = 0; i < SIZE(contra); ++i)
            strsubst(buf, contra[i].twowords, contra[i].contrctn);
    }

    enlght_out(buf);
    } finally { stack_pop($frame); }
}

/* format increased chance to hit or damage or defense (Protection) */
function enlght_combatinc(
    inctyp,
    incamt,
    final,
    outbuf) { /* char * */
    let modif, bonus;
    let invrt;
    let absamt;

    absamt = abs(incamt);
    /* Protection amount is typically larger than damage or to-hit;
       reduce magnitude by a third in order to stretch modifier ranges
       (small:1..5, moderate:6..10, large:11..19, huge:20+) */
    if (!strcmp(inctyp, _("defense")))
        absamt = Math.trunc((absamt * 2) / 3);

    if (absamt <= 3)
        modif = _("small");
    else if (absamt <= 6)
        modif = _("moderate");
    else if (absamt <= 12)
        modif = _("large");
    else
        modif = _("huge");

    modif = !incamt ? _("no") : an(modif); /* ("no" case shouldn't happen) */
    bonus = (incamt >= 0) ? _("bonus") : _("penalty");
    /* "bonus <foo>" (to hit) vs "<bar> bonus" (damage, defense) */
    invrt = strcmp(inctyp, _("to hit")) ? TRUE : FALSE;

    sprintf(outbuf, _("%s %s %s"), modif, invrt ? inctyp : bonus, invrt ? bonus : inctyp)
;
    if (final || wizard())
        sprintf(eos(outbuf), _(" (%s%d)"), (incamt > 0) ? _("+") : _(""), incamt);

    return outbuf;
}

/* report half physical or half spell damage */
function enlght_halfdmg(category, final) { /* void */
    const $frame = stack_frame(); try {
    let category_name;
    let buf = stack_array(char, BUFSZ);

    switch (category) {
    case HALF_PHDAM:
        category_name = _("physical");
        break;
    case HALF_SPDAM:
        category_name = _("spell");
        break;
    default:
        category_name = _("unknown");
        break;
    }
    sprintf(buf, _(" %s %s damage"), (final || wizard()) ? _("half") : _("reduced"), category_name)
;
    enlght_line((You_), (final ? _(("took")) : _(("take"))), (buf), (from_what(category)));
    } finally { stack_pop($frame); }
}

/* is hero actively using water walking capability on water (or lava)? */
function walking_on_water() { /* boolean */
    if (u.uinwater || Levitation() || Flying())
        return FALSE;
    return (Wwalking() && is_pool_or_lava(u.ux, u.uy) ? 1 : 0);
}

/* describe u.utraptype; used by status_enlightenment() and self_lookat() */
export function trap_predicament(outbuf, final, wizxtra) { /* char * */
    let t;

    /* caller has verified u.utrap */
    chars[outbuf] = ord('\0');
    switch (u.utraptype) {
    case TT_BURIEDBALL:
        strcpy(outbuf, _("tethered to something buried"));
        break;
    case TT_LAVA:
        sprintf(outbuf, _("sinking into %s"), final ? _("lava") : hliquid(_("lava")));
        break;
    case TT_INFLOOR:
        sprintf(outbuf, _("stuck in %s"), the(surface(u.ux, u.uy)));
        break;
    default: /* TT_BEARTRAP, TT_PIT, or TT_WEB */
        strcpy(outbuf, _("trapped"));
        if ((t = t_at(u.ux, u.uy)) != null) /* should never be null */
            sprintf(eos(outbuf), _(" in %s"), an(trapname(t.ttyp, FALSE)));
        break;
    }
    if (wizxtra) { /* give extra information for wizard mode enlightenment */
        /* curly braces: u.utrap is an escape attempt counter rather than a
           turn timer so use different ornamentation than usual parentheses */
        sprintf(eos(outbuf), _(" {%u}"), u.utrap);
    }
    return outbuf;
}

/* check whether hero is wearing something that player definitely knows
   confers the target property; item must have been seen and its type
   discovered but it doesn't necessarily have to be fully identified */
function cause_known(
    propindx) { /* boolean */ /* index of a property which can be conveyed by worn item */
    let o;
    let mask = W_ARMOR | W_AMUL | W_RING | W_TOOL;

    /* simpler than from_what()/what_gives(); we don't attempt to
       handle artifacts and we deliberately ignore wielded items */
    for (o = gi.invent; o; o = o.nobj) {
        if (!(o.owornmask & mask))
            continue;
        if ((objects[o.otyp].oc_oprop) == propindx
            && objects[o.otyp].oc_name_known && o.dknown)
            return TRUE;
    }
    return FALSE;
}

/* format a characteristic value, accommodating Strength's strangeness */
function attrval(
    attrindx,
    attrvalue,
    resultbuf) { /* char * */ /* should be at least [7] to hold "18/100\0" */
    if (attrindx != A_STR || attrvalue <= 18)
        sprintf(resultbuf, _("%d"), attrvalue);
    else if (attrvalue > STR18(100)) /* 19 to 25 */
        sprintf(resultbuf, _("%d"), attrvalue - 100);
    else /* simplify "18/\**" to be "18/100" */
        sprintf(resultbuf, _("18/%02d"), attrvalue - 18);
    return resultbuf;
}

/* format urealtime.realtime as
      " D days, H hours, M minutes and S seconds"
   with any fields having a value of 0 omitted:
      0-00:00:20 => " 20 seconds"
      0-00:15:05 => " 15 minutes and 5 seconds"
      0-00:16:00 => " 16 minutes"
      0-01:15:10 => " 1 hour, 15 minutes and 10 seconds"
      0-02:00:01 => " 2 hours and 1 second"
      3-00:25:40 => " 3 days, 25 minutes and 40 seconds"
   (note: for a list of more than two entries, nethack usually includes the
   [style-wise] optional comma before "and" but in this instance it does not)
 */
function fmt_elapsed_time(outbuf, final) { /* char * */
    let fieldcnt;
    let edays, ehours, eminutes, eseconds;
    /* for a game that's over, reallydone() has updated urealtime.realtime
       to its final value before calling us during end of game disclosure;
       for a game that's still in progress, it holds the amount of elapsed
       game time from previous sessions up through most recent save/restore
       (or up through latest level change when 'checkpoint' is On);
       '.start_timing' has a non-zero value even if '.realtime' is 0 */
    let etim = urealtime.realtime;

    if (!final)
        etim += timet_delta(getnow(), urealtime.start_timing);
    /* we could use localtime() to convert the value into a 'struct tm'
       to get date and time fields but this is simple and straightforward */
    eseconds = etim % 60, etim = Math.trunc(etim / 60);
    eminutes = etim % 60, etim = Math.trunc(etim / 60);
    ehours = etim % 24;
    edays = Math.trunc(etim / 24);
    fieldcnt = +!!edays + +!!ehours + +!!eminutes + +!!eseconds;

    strcpy(outbuf, fieldcnt ? _("") : _(" none")); /* 'none' should never happen */
    if (edays) {
        sprintf(eos(outbuf), _(" %lld day%s"), edays, plur(edays));
        if (fieldcnt > 1) /* hours and/or minutes and/or seconds to follow */
            strcat(outbuf, (fieldcnt == 2) ? _(" and") : _(","));
        --fieldcnt; /* edays has been processed */
    }
    if (ehours) {
        sprintf(eos(outbuf), _(" %lld hour%s"), ehours, plur(ehours));
        if (fieldcnt > 1) /* minutes and/or seconds to follow */
            strcat(outbuf, (fieldcnt == 2) ? _(" and") : _(","));
        --fieldcnt; /* ehours has been processed */
    }
    if (eminutes) {
        sprintf(eos(outbuf), _(" %lld minute%s"), eminutes, plur(eminutes));
        if (fieldcnt > 1) /* seconds to follow */
            strcat(outbuf, _(" and"));
        /* eminutes has been processed but no need to decrement fieldcnt */
    }
    if (eseconds)
        sprintf(eos(outbuf), _(" %lld second%s"), eseconds, plur(eseconds));
    return outbuf;
}

/* "once" vs "twice" vs "17 times", used in several places */
function N_times(n, outbuf) { /* char * */
    switch (n) {
    case 0:
    default:
        sprintf(outbuf, _("%lld times"), n);
        break;
    case 1:
        strcpy(outbuf, _("once"));
        break;
    case 2:
        strcpy(outbuf, _("twice"));
        break;
    case 3:
        strcpy(outbuf, _("thrice"));
        break;
    }
    return outbuf;
}

export function enlightenment(
    mode,
    final) { /* void */ /* ENL_GAMEINPROGRESS:0, ENL_GAMEOVERALIVE, ENL_GAMEOVERDEAD */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ), tmpbuf = stack_array(char, BUFSZ);

    ge.en_win = create_nhwindow()(NHW_MENU);
    ge.en_via_menu = +!final;
    if (ge.en_via_menu)
        start_menu()(ge.en_win, MENU_BEHAVE_STANDARD);

    strcpy(tmpbuf, svp.plname);
    chars[tmpbuf] = highc(chars[tmpbuf]); /* same adjustment as bottom line */
    /* as in background_enlightenment, when poly'd we need to use the saved
       gender in u.mfemale rather than the current you-as-monster gender */
    Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%s the %s's attributes:"), tmpbuf, ((Upolyd() ? u.mfemale : flags.female) && gu.urole.name.f)
                ? gu.urole.name.f
                : gu.urole.name.m)
;

    /* title */
    enlght_out(buf); /* "Conan the Archeologist's attributes:" */
    /* background and characteristics; ^X or end-of-game disclosure */
    if (mode & BASICENLIGHTENMENT) {
        /* role, race, alignment, deities, dungeon level, time, experience */
        background_enlightenment(mode, final);
        /* hit points, energy points, armor class, gold */
        basics_enlightenment(mode, final);
        /* strength, dexterity, &c */
        characteristics_enlightenment(mode, final);
    }
    /* expanded status line information, including things which aren't
       included there due to space considerations;
       shown for both basic and magic enlightenment */
    status_enlightenment(mode, final);
    /* remaining attributes; shown for potion,&c or wizard mode and
       explore mode ^X or end of game disclosure */
    if (mode & MAGICENLIGHTENMENT) {
        /* intrinsics and other traditional enlightenment feedback */
        attributes_enlightenment(mode, final);
    }

    enlght_out(_("")); /* separator */
    enlght_out(_("Miscellaneous:"));
    /* reminder to player and/or information for dumplog */
    if ((mode & BASICENLIGHTENMENT) != 0 && (wizard() || discover() || final)) {
        if (wizard() || discover()) {
            sprintf(buf, _("running in %s mode"), wizard() ? _("debug") : _("explore"));
            enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
        }

        if (!flags.bones) {
            /* mention not saving bones iff hero just died */
            sprintf(buf, _("disabled loading%s of bones levels"), (final == ENL_GAMEOVERDEAD) ? _(" and storing") : _(""))
;
            enlght_line((You_), (final ? (_("")) : (have)), (buf), _(("")));
        } else if (!u.uroleplay.numbones) {
            enlght_line((You_), (final ? _(("didn't encounter")) : _(("haven't encountered"))), _((" any bones levels")), _(("")))
;
        } else {
            sprintf(buf, _("encountered %lld bones level%s"), u.uroleplay.numbones, plur(u.uroleplay.numbones))
;
            enlght_line((You_), (final ? (_("")) : (have)), (buf), _(("")));
        }
    }
    fmt_elapsed_time(buf, final);
    enlght_line(_(("Total elapsed playing time ")), (final ? _(("was")) : _(("is"))), (buf), _(("")));

    if (!ge.en_via_menu) {
        display_nhwindow()(ge.en_win, TRUE);
    } else {
        let selected = stack_var(ptr_to(struct_mi), null);

        end_menu()(ge.en_win, 0);
        if (select_menu(ge.en_win, PICK_NONE, selected) > 0)
            free(addr_of(selected[0]));
        ge.en_via_menu = FALSE;
    }
    destroy_nhwindow()(ge.en_win);
    ge.en_win = WIN_ERR;
    } finally { stack_pop($frame); }
}

/*ARGSUSED*/
/* display role, race, alignment and such to en_win */
function background_enlightenment(unused_mode, final) { /* void */
    const $frame = stack_frame(); try {
    let role_titl, rank_titl;
    let innategend, difgend, difalgn;
    let buf = stack_array(char, BUFSZ), tmpbuf = stack_array(char, BUFSZ);

    /* note that if poly'd, we need to use u.mfemale instead of flags.female
       to access hero's saved gender-as-human/elf/&c rather than current */
    innategend = (Upolyd() ? u.mfemale : flags.female) ? 1 : 0;
    role_titl = (innategend && gu.urole.name.f) ? gu.urole.name.f
                                                : gu.urole.name.m;
    rank_titl = rank_of(u.ulevel, Role_switch(), innategend);

    enlght_out(_("")); /* separator after title */
    enlght_out(_("Background:"));

    /* if polymorphed, report current shape before underlying role;
       will be repeated as first status: "you are transformed" and also
       among various attributes: "you are in beast form" (after being
       told about lycanthropy) or "you are polymorphed into <a foo>"
       (with countdown timer appended for wizard mode); we really want
       the player to know he's not a samurai at the moment... */
    if (Upolyd()) {
        let anbuf = stack_array(char, 20); /* includes trailing space; [4] suffices */
        let uasmon = gy.youmonst.data;
        let altphrasing = vampshifted(gy.youmonst);

        chars[tmpbuf + 0] = ord('\0');
        /* here we always use current gender, not saved role gender */
        if (!is_male(uasmon) && !is_female(uasmon) && !is_neuter(uasmon))
            sprintf(tmpbuf, _("%s "), genders[flags.female ? 1 : 0].adj);
        if (altphrasing)
            sprintf(eos(tmpbuf), _("%s in "), pmname(mons[gy.youmonst.cham],
                           flags.female ? FEMALE : MALE))
;
        Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%s%s%s%s form"), !final ? _("currently ") : _(""), altphrasing ? just_an(anbuf, tmpbuf) : _("in "), tmpbuf, pmname(uasmon, flags.female ? FEMALE : MALE))

;
        enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
    }

    /* report role; omit gender if it's redundant (eg, "female priestess") */
    chars[tmpbuf + 0] = ord('\0');
    if (!gu.urole.name.f
        && ((gu.urole.allow & ROLE_GENDMASK) == (ROLE_MALE | ROLE_FEMALE)
            || innategend != flags.initgend))
        sprintf(tmpbuf, _("%s "), genders[innategend].adj);
    chars[buf + 0] = ord('\0');
    if (Upolyd())
        strcpy(buf, _("actually ")); /* "You are actually a ..." */
    if (!strcmpi(rank_titl, role_titl)) {
        /* omit role when rank title matches it */
        sprintf(eos(buf), _("%s, level %d %s%s"), an(rank_titl), u.ulevel, tmpbuf, gu.urace.noun)
;
    } else {
        sprintf(eos(buf), _("%s, a level %d %s%s %s"), an(rank_titl), u.ulevel, tmpbuf, gu.urace.adj, role_titl)
;
    }
    enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));

    /* report alignment (bypass you_are() in order to omit ending period);
       adverb is used to distinguish between temporary change (helm of opp.
       alignment), permanent change (one-time conversion), and original */
    sprintf(buf, _(" %s%s%s, %son a mission for %s"), You_, !final ? are : were, align_str(u.ualign.type), (u.ualign.type != chars[u.ualignbase + A_CURRENT])
               /* what's the past tense of "currently"? if we used "formerly"
                  it would sound like a reference to the original alignment */
               ? (!final ? _("currently ") : _("temporarily "))
               /* permanent conversion */
               : (u.ualign.type != chars[u.ualignbase + A_ORIGINAL])
                  /* and what's the past tense of "now"? certainly not "then"
                     in a context like this...; "belatedly" == weren't that
                     way sooner (in other words, didn't start that way) */
                  ? (!final ? _("now ") : _("belatedly "))
                  /* atheist (ignored in very early game) */
                  : (!u.uconduct.gnostic && svm.moves > 1000)
                     ? _("nominally ")
                     /* lastly, normal case */
                     : _(""), u_gname())

;
    enlght_out(buf);
    /* show the rest of this game's pantheon (finishes previous sentence)
       [appending "also Moloch" at the end would allow for straightforward
       trailing "and" on all three aligned entries but looks too verbose] */
    sprintf(buf, _(" who %s opposed by"), !final ? _("is") : _("was"));
    if (u.ualign.type != A_LAWFUL)
        sprintf(eos(buf), _(" %s (%s) and"), align_gname(A_LAWFUL), align_str(A_LAWFUL))
;
    if (u.ualign.type != A_NEUTRAL)
        sprintf(eos(buf), _(" %s (%s)%s"), align_gname(A_NEUTRAL), align_str(A_NEUTRAL), (u.ualign.type != A_CHAOTIC) ? _(" and") : _(""))

;
    if (u.ualign.type != A_CHAOTIC)
        sprintf(eos(buf), _(" %s (%s)"), align_gname(A_CHAOTIC), align_str(A_CHAOTIC))
;
    strcat(buf, _(".")); /* terminate sentence */
    enlght_out(buf);

    /* show original alignment,gender,race,role if any have been changed;
       giving separate message for temporary alignment change bypasses need
       for tricky phrasing otherwise necessitated by possibility of having
       helm of opposite alignment mask a permanent alignment conversion */
    difgend = +(innategend != flags.initgend);
    difalgn = (((u.ualign.type != chars[u.ualignbase + A_CURRENT]) ? 1 : 0)
               + ((chars[u.ualignbase + A_CURRENT] != chars[u.ualignbase + A_ORIGINAL])
                  ? 2 : 0));
    if (difalgn & 1) { /* have temporary alignment so report permanent one */
        sprintf(buf, _("actually %s"), align_str(chars[u.ualignbase + A_CURRENT]));
        enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
        difalgn &= ~1; /* suppress helm from "started out <foo>" message */
    }
    if (difgend || difalgn) { /* sex change or perm align change or both */
        sprintf(buf, _(" You started out %s%s%s."), difgend ? genders[flags.initgend].adj : _(""), (difgend && difalgn) ? _(" and ") : _(""), difalgn ? align_str(chars[u.ualignbase + A_ORIGINAL]) : _(""))

;
        enlght_out(buf);
    }

    /* "You are left-handed." won't work well if polymorphed into something
       without hands; use "You are normally left-handed." in that situation */
    sprintf(buf, _("%s%s-handed"), !strcmp(body_part(HANDED), _("handed")) ? _("") : _("normally "), URIGHTY() ? _("right") : _("left"))

;
    enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));

    /* As of 3.6.2: dungeon level, so that ^X really has all status info as
       claimed by the comment below; this reveals more information than
       the basic status display, but that's one of the purposes of ^X;
       similar information is revealed by #overview; the "You died in
       <location>" given by really_done() is more rudimentary than this */
    chars[buf] = chars[tmpbuf] = ord('\0');
    if (In_endgame(u.uz)) {
        let egdepth = observable_depth(u.uz);

        endgamelevelname(tmpbuf, egdepth);
        Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("in the endgame, on the %s%s"), !strncmp(tmpbuf, _("Plane"), 5) ? _("Elemental ") : _(""), tmpbuf)
;
    } else if (Is_knox(u.uz)) {
        /* this gives away the fact that the knox branch is only 1 level */
        sprintf(buf, _("on the %s level"), svd.dungeons[u.uz.dnum].dname);
        /* TODO? maybe phrase it differently when actually inside the fort,
           if we're able to determine that (not trivial) */
    } else {
        let dgnbuf = stack_array(char, QBUFSZ);

        strcpy(dgnbuf, svd.dungeons[u.uz.dnum].dname);
        if (!strncmpi(dgnbuf, _("The "), 4))
            chars[dgnbuf] = lowc(chars[dgnbuf]);
        sprintf(tmpbuf, _("level %d"), In_quest(u.uz) ? dunlev(u.uz) : depth(u.uz))
;
        /* TODO? maybe extend this bit to include various other automatic
           annotations from the dungeon overview code */
        if (Is_rogue_level(u.uz))
            strcat(tmpbuf, _(", a primitive area"));
        else if (Is_bigroom(u.uz) && !Blind())
            strcat(tmpbuf, _(", a very big room"));
        Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("in %s, on %s"), dgnbuf, tmpbuf);
    }
    enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));

    /* this is shown even if the 'time' option is off */
    if (svm.moves == 1) {
        enlght_line((You_), (final ? (had) : (have)), _(("just started your adventure")), _(("")));
    } else {
        /* 'turns' grates on the nerves in this context... */
        sprintf(buf, _("the dungeon %lld turn%s ago"), svm.moves, plur(svm.moves))
;
        /* same phrasing for current and final: "entered" is unconditional */
        enlght_line(You_, _("entered "), buf, _(""));
    }

    /* for gameover, these have been obtained in really_done() so that they
       won't vary if user leaves a disclosure prompt or --More-- unanswered
       long enough for the dynamic value to change between then and now */
    if (final ? iflags.at_midnight : midnight()) {
        enlght_line(_(("It ")), (final ? _(("was ")) : _(("is "))), _(("the midnight hour")), _(("")));
    } else if (final ? iflags.at_night : night()) {
        enlght_line(_(("It ")), (final ? _(("was ")) : _(("is "))), _(("nighttime")), _(("")));
    }
    /* other environmental factors */
    if (flags.moonphase == FULL_MOON || flags.moonphase == NEW_MOON) {
        /* [This had "tonight" but has been changed to "in effect".
           There is a similar issue to Friday the 13th--it's the value
           at the start of the current session but that session might
           have dragged on for an arbitrary amount of time.  We want to
           report the values that currently affect play--or affected
           play when game ended--rather than actual outside situation.] */
        sprintf(buf, _("a %s moon in effect%s"), (flags.moonphase == FULL_MOON) ? _("full")
                : (flags.moonphase == NEW_MOON) ? _("new")
                  /* showing these would probably just lead to confusion
                     since they have no effect on game play... */
                  : (flags.moonphase < FULL_MOON) ? _("first quarter")
                    : _("last quarter"), final ? _(" when your adventure ended") : _(""))

;
        enlght_line(_(("There ")), (final ? _(("was ")) : _(("is "))), (buf), _(("")));
    }
    if (flags.friday13) {
        /* let player know that friday13 penalty is/was in effect;
           we don't say "it is/was Friday the 13th" because that was at
           the start of the session and it might be past midnight (or
           days later if the game has been paused without save/restore),
           so phrase this similar to the start up message */
        sprintf(buf, _(" Bad things %s on Friday the 13th."), !final ? _("can happen")
                : (final == ENL_GAMEOVERALIVE) ? _("could have happened")
                  /* there's no may to tell whether -1 Luck made a
                     difference but hero has died... */
                  : _("happened"))
;
        enlght_out(buf);
    }

    if (!Upolyd()) {
        let ulvl = u.ulevel;
        /* [flags.showexp currently does not matter; should it?] */

        /* experience level is already shown above */
        sprintf(buf, _("%-1lld experience point%s"), u.uexp, plur(u.uexp));
        /* TODO?
         *  Remove wizard-mode restriction since patient players can
         *  determine the numbers needed without resorting to spoilers
         *  (even before this started being disclosed for 'final';
         *  just enable 'showexp' and look at normal status lines
         *  after drinking gain level potions or eating wraith corpses
         *  or being level-drained by vampires).
         */
        if (ulvl < 30 && (final || wizard())) {
            let nxtlvl = newuexp(ulvl), delta = nxtlvl - u.uexp;

            sprintf(eos(buf), _(", %lld %s%sneeded %s level %d"), delta, (u.uexp > 0) ? _("more ") : _(""), !final ? _("") : (delta == 1) ? _("was ") : _("were "), (ulvl < 18) ? _("to attain") : _("for"), (ulvl + 1))

;
        }
        enlght_line((You_), (final ? (had) : (have)), (buf), _(("")));
    }
    } finally { stack_pop($frame); }
}

/* hit points, energy points, armor class -- essential information which
   doesn't fit very well in other categories */
/*ARGSUSED*/
function basics_enlightenment(mode, final) { /* void */
    const $frame = stack_frame(); try {
    let Power = init_string(static_array("basics_enlightenment.Power", char, sizeof_string("energy points (spell power)")), _("energy points (spell power)"), true);
    let buf = stack_array(char, BUFSZ);
    let pw = u.uen, hp = (Upolyd() ? u.mh : u.uhp),
        pwmax = u.uenmax, hpmax = (Upolyd() ? u.mhmax : u.uhpmax);

    enlght_out(_("")); /* separator after background */
    enlght_out(_("Basics:"));

    if (hp < 0)
        hp = 0;
    /* "1 out of 1" rather than "all" if max is only 1; should never happen */
    if (hp == hpmax && hpmax > 1)
        sprintf(buf, _("all %d hit points"), hpmax);
    else
        sprintf(buf, _("%d out of %d hit point%s"), hp, hpmax, plur(hpmax));
    enlght_line((You_), (final ? (had) : (have)), (buf), _(("")));

    /* low max energy is feasible, so handle couple of extra special cases */
    if (pwmax == 0 || (pw == pwmax && pwmax == 2)) /* both: not "all 2" */
        sprintf(buf, _("%s %s"), !pwmax ? _("no") : _("both"), Power);
    else if (pw == pwmax && pwmax > 2)
        sprintf(buf, _("all %d %s"), pwmax, Power);
    else
        sprintf(buf, _("%d out of %d %s"), pw, pwmax, Power);
    enlght_line((You_), (final ? (had) : (have)), (buf), _(("")));

    if (Upolyd()) {
        switch (mons[u.umonnum].mlevel) {
        case 0:
            /* status line currently being explained shows "HD:0" */
            strcpy(buf, _("0 hit dice (actually 1/2)"));
            break;
        case 1:
            strcpy(buf, _("1 hit die"));
            break;
        default:
            sprintf(buf, _("%d hit dice"), mons[u.umonnum].mlevel);
            break;
        }
        enlght_line((You_), (final ? (had) : (have)), (buf), _(("")));
    }

    find_ac(); /* enforces AC_MAX cap */
    sprintf(buf, _("%d"), u.uac);
    if (abs(u.uac) == AC_MAX)
        sprintf(eos(buf), _(", the %s possible"), (u.uac < 0) ? _("best") : _("worst"))
;
    enlght_line(_(("Your armor class ")), (final ? _(("was ")) : _(("is "))), (buf), _(("")));

    /* gold; similar to doprgold (#showgold) but without shop billing info;
       includes container contents, unlike status line but like doprgold */
    {
        let umoney = money_cnt(gi.invent), hmoney = hidden_gold(final);

        if (!umoney) {
            sprintf(buf, _(" Your wallet %s empty"), !final ? _("is") : _("was"));
        } else {
            sprintf(buf, _(" Your wallet contain%s %lld %s"), !final ? _("s") : _("ed"), umoney, currency(umoney))
;
        }
        /* terminate the wallet line if appropriate, otherwise add an
           introduction to subsequent continuation; output now either way */
        strcat(buf, !hmoney ? _(".") : !umoney ? _(", but") : _(", and"));
        enlght_out(buf);

        /* put contained gold on its own line to avoid excessive width; it's
           phrased as a continuation of the wallet line so not capitalized */
        if (hmoney) {
            sprintf(buf, _("%lld %s stashed away in your pack"), hmoney, umoney ? _("more") : currency(hmoney))
;
            enlght_line(_(("you ")), (final ? _(("had ")) : _(("have "))), (buf), _(("")));
        }
    }

    if (flags.pickup) {
        let ocl = stack_array(char, MAXOCLASSES + 1);

        strcpy(buf, _("on"));
        if (costly_spot(u.ux, u.uy)) {
            /* being in a shop inhibits autopickup, even 'pickup_thrown' */
            strcat(buf, _(", but temporarily disabled while inside the shop"));
        } else {
            oc_to_str(flags.pickup_types, ocl);
            sprintf(eos(buf), _(" for %s%s%s"), chars[ocl] ? _("'") : _(""), chars[ocl] ? ocl : _("all types"), chars[ocl] ? _("'") : _(""))
;
            if (flags.pickup_thrown && chars[ocl])
                strcat(buf, _(" plus thrown")); /* show when not 'all types' */
            if (ga.apelist)
                strcat(buf, _(", with exceptions"));
        }
    } else
        strcpy(buf, _("off"));
    enlght_line(_(("Autopickup ")), (final ? _(("was ")) : _(("is "))), (buf), _(("")));
    } finally { stack_pop($frame); }
}

/* characteristics: expanded version of bottom line strength, dexterity, &c */
function characteristics_enlightenment(mode, final) { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);

    enlght_out(_(""));
    sprintf(buf, _("%sCharacteristics:"), !final ? _("") : _("Final "));
    enlght_out(buf);

    /* bottom line order */
    one_characteristic(mode, final, A_STR); /* strength */
    one_characteristic(mode, final, A_DEX); /* dexterity */
    one_characteristic(mode, final, A_CON); /* constitution */
    one_characteristic(mode, final, A_INT); /* intelligence */
    one_characteristic(mode, final, A_WIS); /* wisdom */
    one_characteristic(mode, final, A_CHA); /* charisma */
    } finally { stack_pop($frame); }
}

/* display one attribute value for characteristics_enlightenment() */
function one_characteristic(mode, final, attrindx) { /* void */
    const $frame = stack_frame(); try {
     /* attrib.c */
    let hide_innate_value = FALSE, interesting_alimit;
    let acurrent, abase, apeak, alimit;
    let paren_pfx;
    let subjbuf = stack_array(char, BUFSZ), valubuf = stack_array(char, BUFSZ), valstring = stack_array(char, 32);

    /* being polymorphed or wearing certain cursed items prevents
       hero from reliably tracking changes to characteristics so
       we don't show base & peak values then; when the items aren't
       cursed, hero could take them off to check underlying values
       and we show those in such case so that player doesn't need
       to actually resort to doing that */
    if (Upolyd()) {
        hide_innate_value = TRUE;
    } else if (Fixed_abil()) {
        if (stuck_ring(uleft, RIN_SUSTAIN_ABILITY)
            || stuck_ring(uright, RIN_SUSTAIN_ABILITY))
            hide_innate_value = TRUE;
    }
    switch (attrindx) {
    case A_STR:
        if (uarmg && uarmg.otyp == GAUNTLETS_OF_POWER && uarmg.cursed)
            hide_innate_value = TRUE;
        break;
    case A_DEX:
        break;
    case A_CON:
        if (u_wield_art(ART_OGRESMASHER) && uwep.cursed)
            hide_innate_value = TRUE;
        break;
    case A_INT:
        if (uarmh && uarmh.otyp == DUNCE_CAP && uarmh.cursed)
            hide_innate_value = TRUE;
        break;
    case A_WIS:
        if (uarmh && uarmh.otyp == DUNCE_CAP && uarmh.cursed)
            hide_innate_value = TRUE;
        break;
    case A_CHA:
        break;
    default:
        return; /* impossible */
    };
    /* note: final disclosure includes MAGICENLIGHTENTMENT */
    if ((mode & MAGICENLIGHTENMENT) && !Upolyd())
        hide_innate_value = FALSE;

    acurrent = ACURR(attrindx);
    attrval(attrindx, acurrent, valubuf); /* Sprintf(valubuf,"%d",) */
    sprintf(subjbuf, _("Your %s "), attrname[attrindx]);

    if (!hide_innate_value) {
        /* show abase, amax, and/or attrmax if acurr doesn't match abase
           (a magic bonus or penalty is in effect) or abase doesn't match
           amax (some points have been lost to poison or exercise abuse
           and are restorable) or attrmax is different from normal human
           (while game is in progress; trying to reduce dependency on
           spoilers to keep track of such stuff) or attrmax was different
           from abase (at end of game; this attribute wasn't maxed out) */
        abase = ABASE(attrindx);
        apeak = AMAX(attrindx);
        alimit = ATTRMAX(attrindx);
        /* criterium for whether the limit is interesting varies */
        interesting_alimit =
            final ? TRUE /* was originally `(abase != alimit)' */
                  : +(alimit != (attrindx != A_STR ? 18 : STR18(100)));
        paren_pfx = final ? _(" (") : _(" (current; ");
        if (acurrent != abase) {
            sprintf(eos(valubuf), _("%sbase:%s"), paren_pfx, attrval(attrindx, abase, valstring))
;
            paren_pfx = _(", ");
        }
        if (abase != apeak) {
            sprintf(eos(valubuf), _("%speak:%s"), paren_pfx, attrval(attrindx, apeak, valstring))
;
            paren_pfx = _(", ");
        }
        if (interesting_alimit) {
            sprintf(eos(valubuf), _("%s%slimit:%s"), paren_pfx, (acurrent > alimit) ? _("innate ") : _(""), attrval(attrindx, alimit, valstring))

;
            /* paren_pfx = ", "; */
        }
        if (acurrent != abase || abase != apeak || interesting_alimit)
            strcat(valubuf, _(")"));
    }
    enlght_line((subjbuf), (final ? _(("was ")) : _(("is "))), (valubuf), _(("")));
    } finally { stack_pop($frame); }
}

/* status: selected obvious capabilities, assorted troubles */
function status_enlightenment(mode, final) { /* void */
    const $frame = stack_frame(); try {
    let magic = (mode & MAGICENLIGHTENMENT) ? TRUE : FALSE;
    let cap;
    let buf = stack_array(char, BUFSZ), youtoo = stack_array(char, BUFSZ), heldmon = stack_array(char, BUFSZ);
    let Riding = (u.usteed
                      /* if hero dies while dismounting, u.usteed will still
                         be set; we want to ignore steed in that situation */
                      && !(final == ENL_GAMEOVERDEAD
                           && !strcmp(svk.killer.name, _("riding accident"))) ? 1 : 0);
    let steedname = (!Riding ? 0
                      : x_monnam(u.usteed,
                                 u.usteed.mtame ? ARTICLE_YOUR : ARTICLE_THE,
                                 0,
                                 (SUPPRESS_SADDLE | SUPPRESS_HALLUCINATION),
                                 FALSE));

    /*\
     * Status (many are abbreviated on bottom line; others are or
     *     should be discernible to the hero hence to the player)
    \*/
    enlght_out(_("")); /* separator after title or characteristics */
    enlght_out(final ? _("Final Status:") : _("Status:"));

    strcpy(youtoo, You_);
    /* not a traditional status but inherently obvious to player; more
       detail given below (attributes section) for magic enlightenment */
    if (Upolyd()) {
        strcpy(buf, _("transformed"));
        if (ugenocided())
            sprintf(eos(buf), _(" and %s %s inside"), final ? _("felt") : _("feel"), udeadinside())
;
        enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
    }
    /* not a trouble, but we want to display riding status before maybe
       reporting steed as trapped or hero stuck to cursed saddle */
    if (Riding) {
        sprintf(buf, _("riding %s"), steedname);
        enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
        sprintf(eos(youtoo), _("and %s "), steedname);
    }
    /* other movement situations that hero should always know */
    if (Levitation()) {
        if (Lev_at_will() && magic)
            enlght_line((You_), (final ? (were) : (are)), _(("levitating, at will")), _(("")));
        else
            enlght_line((youtoo), (final ? (were) : (are)), _(("levitating")), (from_what(LEVITATION)));
    } else if (Flying()) { /* can only fly when not levitating */
        enlght_line((youtoo), (final ? (were) : (are)), _(("flying")), (from_what(FLYING)));
    }
    if (Underwater()) {
        enlght_line((You_), (final ? (were) : (are)), _(("underwater")), _(("")));
    } else if (u.uinwater) {
        enlght_line((You_), (final ? (were) : (are)), (Swimming() ? _("swimming") : _("in water")), (from_what(SWIMMING)));
    } else if (walking_on_water()) {
        /* show active Wwalking here, potential Wwalking elsewhere */
        sprintf(buf, _("walking on %s"), is_pool(u.ux, u.uy) ? _("water")
                : is_lava(u.ux, u.uy) ? _("lava")
                  : surface(u.ux, u.uy))
; /* catchall; shouldn't happen */
        enlght_line((You_), (final ? (were) : (are)), (buf), (from_what(WWALKING)));
    }
    if (Upolyd() && (u.uundetected || U_AP_TYPE() != M_AP_NOTHING))
        youhiding(TRUE, final);

    /* internal troubles, mostly in the order that prayer ranks them */
    if (Stoned()) {
        if (final && (Stoned() & I_SPECIAL))
            enlght_out(_(" You turned into stone."));
        else
            enlght_line((You_), (final ? (were) : (are)), _(("turning to stone")), _(("")));
    }
    if (Slimed()) {
        if (final && (Slimed() & I_SPECIAL))
            enlght_out(_(" You turned into slime."));
        else
            enlght_line((You_), (final ? (were) : (are)), _(("turning into slime")), _(("")));
    }
    if (Strangled()) {
        if (u.uburied) {
            enlght_line((You_), (final ? (were) : (are)), _(("buried")), _(("")));
        } else {
            if (final && (Strangled() & I_SPECIAL)) {
                enlght_out(_(" You died from strangulation."));
            } else {
                strcpy(buf, _("being strangled"));
                if (wizard())
                    sprintf(eos(buf), _(" (%lld)"), (Strangled() & TIMEOUT));
                enlght_line((You_), (final ? (were) : (are)), (buf), (from_what(STRANGLED)));
            }
        }
    }
    if (Sick()) {
        /* the two types of sickness are lumped together; hero can be
           afflicted by both but there is only one timeout; botl status
           puts TermIll before FoodPois and death due to timeout reports
           terminal illness if both are in effect, so do the same here */
        if (final && (Sick() & I_SPECIAL)) {
            sprintf(buf, _(" %sdied from %s."), You_, (u.usick_type & SICK_NONVOMITABLE)
                    ? _("terminal illness") : _("food poisoning"))
;
            enlght_out(buf);
        } else {
            /* unlike death due to sickness, report the two cases separately
               because it is possible to cure one without curing the other */
            if (u.usick_type & SICK_NONVOMITABLE)
                enlght_line((You_), (final ? (were) : (are)), _(("terminally sick from illness")), _(("")));
            if (u.usick_type & SICK_VOMITABLE)
                enlght_line((You_), (final ? (were) : (are)), _(("terminally sick from food poisoning")), _(("")));
        }
    }
    if (Vomiting())
        enlght_line((You_), (final ? (were) : (are)), _(("nauseated")), _(("")));
    if (Stunned())
        enlght_line((You_), (final ? (were) : (are)), _(("stunned")), _(("")));
    if (Confusion())
        enlght_line((You_), (final ? (were) : (are)), _(("confused")), _(("")));
    if (Hallucination())
        enlght_line((You_), (final ? (were) : (are)), _(("hallucinating")), _(("")));
    if (Blind()) {
        /* check the reasons in same order as from_what() */
        sprintf(buf, _("%s blind"), (HBlinded() & FROMOUTSIDE) != 0 ? _("permanently")
                : (HBlinded() & FROMFORM) ? _("innately")
                  /* better phrasing desperately wanted... */
                  : Blindfolded_only() ? _("deliberately")
                    /* timed, possibly combined with blindfold */
                    : _("temporarily"))
;
        if (wizard() && (HBlinded() == BlindedTimeout() && !Blindfolded()))
            sprintf(eos(buf), _(" (%lld)"), BlindedTimeout());
        /* !haseyes: avoid "you are innately blind innately" */
        enlght_line((You_), (final ? (were) : (are)), (buf), (!haseyes(gy.youmonst.data) ? _("") : from_what(BLINDED)));
    }
    if (Deaf())
        enlght_line((You_), (final ? (were) : (are)), _(("deaf")), (from_what(DEAF)));

    /* external troubles, more or less */
    if (Punished()) {
        if (uball) {
            sprintf(buf, _("chained to %s"), ansimpleoname(uball));
        } else {
            impossible(_("Punished without uball?"));
            strcpy(buf, _("punished"));
        }
        enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
    }
    if (u.utrap) {
        let predicament = stack_array(char, BUFSZ);
        let anchored = +(u.utraptype == TT_BURIEDBALL);

        trap_predicament(predicament, final, wizard());
        if (u.usteed) { /* not `Riding' here */
            sprintf(buf, _("%s%s "), anchored ? _("you and ") : _(""), steedname);
            chars[buf] = highc(chars[buf]);
            enlght_line((buf), (final ? (anchored ? _("were ") : _("was ")) : (anchored ? _("are ") : _("is "))), (predicament), _(("")))
;
        } else
            enlght_line((You_), (final ? (were) : (are)), (predicament), _(("")));
    } /* (u.utrap) */
    chars[heldmon + 0] = ord('\0'); /* lint suppression */
    if (u.ustuck) { /* includes u.uswallow */
        strcpy(heldmon, a_monnam(u.ustuck));
        if (!strcmp(heldmon, _("it"))
            && (!has_mgivenname(u.ustuck)
                || strcmp(MGIVENNAME(u.ustuck), _("it")) != 0))
            strcpy(heldmon, _("an unseen creature"));
    }
    if (u.uswallow) {
        assert(u.ustuck != null); /* implied by u.uswallow */
        Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%s by %s"), digests(u.ustuck.data) ? _("swallowed") : _("engulfed"), heldmon)

;
        if (dmgtype(u.ustuck.data, AD_DGST)) {
            /* if final, death via digestion can be deduced by u.uswallow
               still being True and u.uswldtim having been decremented to 0 */
            if (final && !u.uswldtim)
                strcat(buf, _(" and got totally digested"));
            else
                sprintf(eos(buf), _(" and %s being digested"), final ? _("were") : _("are"))
;
        }
        if (wizard())
            sprintf(eos(buf), _(" (%u)"), u.uswldtim);
        enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
    } else if (u.ustuck) {
        let ustick = (Upolyd() && sticks(gy.youmonst.data) ? 1 : 0);
        let dx = u.ustuck.mx - u.ux, dy = u.ustuck.my - u.uy;

        Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%s %s (%s)"), ustick ? _("holding") : _("held by"), heldmon, dxdy_to_dist_descr(dx, dy, TRUE))

;
        enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
    }
    if (Riding) {
        let saddle = which_armor(u.usteed, W_SADDLE);

        if (saddle && saddle.cursed) {
            sprintf(buf, _("stuck to %s %s"), s_suffix(steedname), simpleonames(saddle))
;
            enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
        }
    }
    if (Wounded_legs()) {
        /* EWounded_legs is used to track left/right/both rather than some
           form of extrinsic impairment; HWounded_legs is used for timeout;
           both apply to steed instead of hero when mounted */
        let whichleg = (EWounded_legs() & BOTH_SIDES);
        let bp = u.usteed ? mbodypart(u.usteed, LEG) : body_part(LEG),
            article = _("a "),
            leftright = _("");

        if (whichleg == BOTH_SIDES)
            bp = makeplural(bp), article = _("");
        else
            leftright = (whichleg == LEFT_SIDE) ? _("left ") : _("right ");
        sprintf(buf, _("%swounded %s%s"), article, leftright, bp);

        /* when mounted, Wounded_legs applies to steed rather than to
           hero; we only report steed's wounded legs in wizard mode */
        if (u.usteed) { /* not `Riding' here */
            if (wizard() && steedname) {
                let steednambuf = stack_array(char, BUFSZ);

                strcpy(steednambuf, steedname);
                chars[steednambuf] = highc(chars[steednambuf]);
                enlght_line((steednambuf), (final ? _((" had ")) : _((" has "))), (buf), _(("")));
            }
        } else {
            enlght_line((You_), (final ? (had) : (have)), (buf), _(("")));
        }
    }
    if (Glib()) {
        sprintf(buf, _("slippery %s"), fingers_or_gloves(TRUE));
        if (wizard())
            sprintf(eos(buf), _(" (%lld)"), (Glib() & TIMEOUT));
        enlght_line((You_), (final ? (had) : (have)), (buf), _(("")));
    }
    if (Fumbling()) {
        if (magic || cause_known(FUMBLING))
            enlght_line((You_), (final ? _(("fumbled")) : _(("fumble"))), _(("")), (from_what(FUMBLING)));
    }
    if (Sleepy()) {
        if (magic || cause_known(SLEEPY)) {
            strcpy(buf, from_what(SLEEPY));
            if (wizard())
                sprintf(eos(buf), _(" (%lld)"), (HSleepy() & TIMEOUT));
            enlght_line(_(("You ")), (final ? _(("fell")) : _(("fall"))), _((" asleep uncontrollably")), (buf));
        }
    }
    /* hunger/nutrition */
    if (Hunger()) {
        if (magic || cause_known(HUNGER))
            enlght_line((You_), (final ? _(("hungered")) : _(("hunger"))), _((" rapidly")), (from_what(HUNGER)))
;
    }
    strcpy(buf, hu_stat[u.uhs]); /* hunger status; omitted if "normal" */
    mungspaces(buf);             /* strip trailing spaces */
    /* status line doesn't show hunger when state is "not hungry", we do;
       needed for wizard mode's reveal of u.uhunger but add it for everyone */
    if (!chars[buf])
        strcpy(buf, _("not hungry"));
    if (chars[buf]) { /* (since "not hungry" was added, this will always be True) */
        chars[buf] = lowc(chars[buf]); /* override capitalization */
        if (!strcmp(buf, _("weak")))
            strcat(buf, _(" from severe hunger"));
        else if (!strncmp(buf, _("faint"), 5)) /* fainting, fainted */
            strcat(buf, _(" due to starvation"));
        if (wizard())
            sprintf(eos(buf), _(" <%d>"), u.uhunger);
        enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
    }
    /* encumbrance */
    if ((cap = near_capacity()) > UNENCUMBERED) {
        let adj = _("?_?"); /* (should always get overridden) */

        strcpy(buf, enc_stat[cap]);
        chars[buf] = lowc(chars[buf]);
        switch (cap) {
        case SLT_ENCUMBER:
            adj = _("slightly");
            break; /* burdened */
        case MOD_ENCUMBER:
            adj = _("moderately");
            break; /* stressed */
        case HVY_ENCUMBER:
            adj = _("very");
            break; /* strained */
        case EXT_ENCUMBER:
            adj = _("extremely");
            break; /* overtaxed */
        case OVERLOADED:
            adj = _("not possible");
            break;
        }
        if (wizard())
            sprintf(eos(buf), _(" <%d>"), inv_weight());
        sprintf(eos(buf), _("; movement %s %s%s"), !final ? _("is") : _("was"), adj, (cap < OVERLOADED) ? _(" slowed") : _(""))
;
        enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
    } else {
        /* last resort entry, guarantees Status section is non-empty
           (no longer needed for that purpose since weapon status added;
           still useful though) */
        strcpy(buf, _("unencumbered"));
        if (wizard())
            sprintf(eos(buf), _(" <%d>"), inv_weight());
        enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
    }
    /* current weapon(s) and corresponding skill level(s) */
    weapon_insight(final);
    /* unlike ring of increase accuracy's effect, the monk's suit penalty
       is too blatant to be restricted to magical enlightenment */
    if (iflags.tux_penalty && !Upolyd()) {
        enlght_combatinc(_("to hit"), -gu.urole.spelarmr, final, buf);
        /* if from_what() ever gets extended from wizard mode to normal
           play, it could be adapted to handle this */
        sprintf(eos(buf), _(" due to your %s"), suit_simple_name(uarm));
        enlght_line((You_), (final ? (had) : (have)), (buf), _(("")));
    }
    /* report 'nudity' */
    if (!uarm && !uarmu && !uarmc && !uarms && !uarmg && !uarmf && !uarmh) {
        if (u.uroleplay.nudist)
            enlght_line((You_), (final ? _(("did")) : _(("do"))), _((" not wear any armor")), _(("")));
        else
            enlght_line((You_), (final ? (were) : (are)), _(("not wearing any armor")), _(("")));
    }
    } finally { stack_pop($frame); }
}

/* extracted from status_enlightenment() to reduce clutter there */
function weapon_insight(final) { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);
    let wtype;

    /* report being weaponless; distinguish whether gloves are worn
       [perhaps mention silver ring(s) when not wearing gloves?] */
    if (!uwep) {
        enlght_line((You_), (final ? (were) : (are)), (empty_handed()), _(("")));

    /* two-weaponing implies hands and
       a weapon or wep-tool (not other odd stuff) in each hand */
    } else if (u.twoweap) {
        enlght_line((You_), (final ? (were) : (are)), _(("wielding two weapons at once")), _(("")));

    /* report most weapons by their skill class (so a katana will be
       described as a long sword, for instance; mattock, hook, and aklys
       are exceptions), or wielded non-weapon item by its object class */
    } else {
        let what = weapon_descr(uwep);

        /* [what about other silver items?] */
        if (uwep.otyp == SHIELD_OF_REFLECTION)
            what = shield_simple_name(uwep); /* silver|smooth shield */
        else if (is_wet_towel(uwep))
            what = /* (uwep->spe < 3) ? "moist towel" : */ _("wet towel");

        if (!strncmpi((what), _(("armor")), -1) || !strncmpi((what), _(("food")), -1)
            || !strncmpi((what), _(("venom")), -1))
            sprintf(buf, _("wielding some %s"), what);
        else
            /* [maybe include known blessed?] */
            sprintf(buf, _("wielding %s"), (uwep.quan == 1) ? an(what) : makeplural(what))
;
        enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
    }

    /*
     * Skill with current weapon.  Might help players who've never
     * noticed #enhance or decided that it was pointless.
     */
    if ((wtype = weapon_type(uwep)) != P_NONE && (!uwep || !is_ammo(uwep))) {
        let sklvlbuf = stack_array(char, 20);
        let sklvl = P_SKILL(wtype);
        let hav = +(sklvl != P_UNSKILLED && sklvl != P_SKILLED);

        if (sklvl == P_ISRESTRICTED)
            strcpy(sklvlbuf, _("no"));
        else
            lcase(skill_level_name(wtype, sklvlbuf));
        /* "you have no/basic/expert/master/grand-master skill with <skill>"
           or "you are unskilled/skilled in <skill>" */
        sprintf(buf, _("%s %s %s"), sklvlbuf, hav ? _("skill with") : _("in"), skill_name(wtype))
;

        if (!u.twoweap) {
            if (can_advance(wtype, FALSE))
                sprintf(eos(buf), _(" and %s that"), !final ? _("can enhance") : _("could have enhanced"))
;
            if (hav)
                enlght_line((You_), (final ? (had) : (have)), (buf), _(("")));
            else
                enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
        } else { /* two-weapon */
            let also_ = init_string(static_array("weapon_insight.also_", char, sizeof_string("also ")), _("also "), true);
            let pfx = stack_array(char, QBUFSZ), sfx = stack_array(char, QBUFSZ),
                sknambuf2 = stack_array(char, 20), sklvlbuf2 = stack_array(char, 20), twobuf = stack_array(char, 20);
            let also = _(""), also2 = _(""), also3 = 0,
                       verb_present, verb_past;
            let wtype2 = weapon_type(uswapwep),
                sklvl2 = P_SKILL(wtype2),
                twoskl = P_SKILL(P_TWO_WEAPON_COMBAT);
            let a1, a2, ab,
                    hav2 = +(sklvl2 != P_UNSKILLED && sklvl2 != P_SKILLED);

            /* normally hero must have access to two-weapon skill in
               order to initiate u.twoweap, but not if polymorphed into
               a form which has multiple weapon attacks, so we need to
               avoid getting bitten by unexpected skill value */
            if (twoskl == P_ISRESTRICTED) {
                twoskl = P_UNSKILLED;
                /* restricted is the same as unskilled as far as bonus
                   or penalty goes, and it isn't ordinarily seen so
                   skill_level_name() returns "Unknown" for it */
                strcpy(twobuf, _("restricted"));
            } else {
                lcase(skill_level_name(P_TWO_WEAPON_COMBAT, twobuf));
            }

            /* keep buf[] from above in case skill levels match */
            chars[pfx + 0] = chars[sfx + 0] = ord('\0');
            if (twoskl < sklvl) {
                /* twoskil won't be restricted so sklvl is at least basic */
                sprintf(pfx, _("Your skill in %s "), skill_name(wtype));
                sprintf(sfx, _(" limited by being %s with two weapons"), twobuf);
                also = also_;
            } else if (twoskl > sklvl) {
                /* sklvl might be restricted */
                strcpy(pfx, _("Your two weapon skill "));
                strcpy(sfx, _(" limited by "));
                if (sklvl > P_ISRESTRICTED)
                    sprintf(eos(sfx), _("being %s"), sklvlbuf);
                else
                    sprintf(eos(sfx), _("having no skill"));
                sprintf(eos(sfx), _(" with %s"), skill_name(wtype));
                also2 = also_;
            } else {
                strcat(buf, _(" and two weapons"));
                also3 = also_;
            }
            if (chars[pfx])
                enlght_line((pfx), (final ? _(("was")) : _(("is"))), (sfx), _(("")));
            else if (hav)
                enlght_line((You_), (final ? (had) : (have)), (buf), _(("")));
            else
                enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));

            /* skip comparison between secondary and two-weapons if it is
               identical to the comparison between primary and twoweap */
            if (wtype2 != wtype) {
                strcpy(sknambuf2, skill_name(wtype2));
                lcase(skill_level_name(wtype2, sklvlbuf2));
                verb_present = _("is"), verb_past = _("was");
                chars[pfx + 0] = chars[sfx + 0] = chars[buf + 0] = ord('\0');
                if (twoskl < sklvl2) {
                    /* twoskil is at least unskilled, sklvl2 at least basic */
                    sprintf(pfx, _("Your skill in %s "), sknambuf2);
                    sprintf(sfx, _(" %slimited by being %s with two weapons"), also, twobuf)
;
                } else if (twoskl > sklvl2) {
                    /* sklvl2 might be restricted */
                    strcpy(pfx, _("Your two weapon skill "));
                    sprintf(sfx, _(" %slimited by "), also2);
                    if (sklvl2 > P_ISRESTRICTED)
                        sprintf(eos(sfx), _("being %s"), sklvlbuf2);
                    else
                        strcat(eos(sfx), _("having no skill"));
                    sprintf(eos(sfx), _(" with %s"), sknambuf2);
                } else {
                    /* equal; two-weapon is at least unskilled, so sklvl2 is
                       too; "you [also] have basic/expert/master/grand-master
                       skill with <skill>" or "you [also] are unskilled/
                       skilled in <skill> */
                    sprintf(buf, _("%s %s %s"), sklvlbuf2, hav2 ? _("skill with") : _("in"), sknambuf2)
;
                    strcat(buf, _(" and two weapons"));
                    if (also3) {
                        strcpy(pfx, _("You also "));
                        Snprintf(sfx, sizeof(array_of(char, QBUFSZ)), _(" %s"), buf), chars[buf + 0] = ord('\0');
                        verb_present = hav2 ? _("have") : _("are");
                        verb_past = hav2 ? _("had") : _("were");
                    }
                }
                if (chars[pfx])
                    enlght_line((pfx), (final ? (verb_past) : (verb_present)), (sfx), _(("")));
                else if (hav2)
                    enlght_line((You_), (final ? (had) : (have)), (buf), _(("")));
                else
                    enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
            } /* wtype2 != wtype */

            /* if training and available skill credits already allow
               #enhance for any of primary, secondary, or two-weapon,
               tell the player; avoid attempting figure out whether
               spending skill credits enhancing one might make either
               or both of the others become ineligible for enhancement */
            a1 = can_advance(wtype, FALSE);
            a2 = (wtype2 != wtype) ? can_advance(wtype2, FALSE) : FALSE;
            ab = can_advance(P_TWO_WEAPON_COMBAT, FALSE);
            if (a1 || a2 || ab) {
                let also_wik_ = init_string(static_array("weapon_insight.also_wik_", char, sizeof_string(" and also with ")), _(" and also with "), true);

                /* for just one, the conditionals yield
                   1) "skill with <that one>"; for more than one:
                   2) "skills with <primary> and also with <secondary>" or
                   3) "skills with <primary> and also with two-weapons" or
                   4) "skills with <secondary> and also with two-weapons" or
                   5) "skills with <primary>, <secondary>, and two-weapons"
                   (no 'also's or extra 'with's for case 5); when primary
                   and secondary use the same skill, only cases 1 and 3 are
                   possible because 'a2' gets forced to False above */
                sprintf(sfx, _(" skill%s with %s%s%s%s%s"), (a1 + a2 + ab > 1) ? _("s") : _(""), a1 ? skill_name(wtype) : _(""), ((a1 && a2 && ab) ? _(", ")
                         : (a1 && (a2 || ab)) ? also_wik_ : _("")), a2 ? skill_name(wtype2) : _(""), ((a1 && a2 && ab) ? _(", and ")
                         : (a2 && ab) ? also_wik_ : _("")), ab ? _("two weapons") : _(""))

;
                enlght_line((You_), (final ? _(("could have enhanced")) : _(("can enhance"))), (sfx), _(("")));
            }
        } /* two-weapon */
    } /* skill applies */
    } finally { stack_pop($frame); }
}

function item_resistance_message(
    adtyp,
    prot_message,
    final) { /* void */
    let protection = u_adtyp_resistance_obj(adtyp);

    if (protection) {
        let somewhat = +(protection < 99);

        enlght_line(_(("Your items ")), (final ? (somewhat ? _("were somewhat") : _("were")) : (somewhat ? _("are somewhat") : _("are"))), (prot_message), (item_what(adtyp)))

;
    }
}

/* attributes: intrinsics and the like, other non-obvious capabilities */
function attributes_enlightenment(
    unused_mode,
    final) { /* void */
    const $frame = stack_frame(); try {
    let if_surroundings_permitted = init_string(static_array("attributes_enlightenment.if_surroundings_permitted", char, sizeof_string(" if surroundings permitted")), _(" if surroundings permitted"), true);

    let ltmp, armpro, warnspecies;
    let buf = stack_array(char, BUFSZ);

    /*\
     *  Attributes
    \*/
    enlght_out(_(""));
    enlght_out(final ? _("Final Attributes:") : _("Attributes:"));

    if (u.uevent.uhand_of_elbereth) {
        let hofe_titles = static_array("attributes_enlightenment.hofe_titles", ptr_to(char), 3, [ _("the Hand of Elbereth"),
                                                    _("the Envoy of Balance"),
                                                    _("the Glory of Arioch") ]);
        enlght_line((You_), (final ? (were) : (are)), (hofe_titles[u.uevent.uhand_of_elbereth - 1]), _(("")));
    }

    sprintf(buf, _("%s"), piousness(TRUE, _("aligned")));
    if (u.ualign.record >= 0)
        enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
    else
        enlght_line((You_), (final ? (had) : (have)), (buf), _(("")));

    if (wizard()) {
        sprintf(buf, _(" %d"), u.ualign.record);
        enlght_line(_(("Your alignment ")), (final ? _(("was")) : _(("is"))), (buf), _(("")));
    }

    /*** Resistances to troubles ***/
    if (Invulnerable())
        enlght_line((You_), (final ? (were) : (are)), _(("invulnerable")), (from_what(INVULNERABLE)));
    if (Antimagic())
        enlght_line((You_), (final ? (were) : (are)), _(("magic-protected")), (from_what(ANTIMAGIC)));
    if (Fire_resistance())
        enlght_line((You_), (final ? (were) : (are)), _(("fire resistant")), (from_what(FIRE_RES)));
    item_resistance_message(AD_FIRE, _(" protected from fire"), final);
    if (Cold_resistance())
        enlght_line((You_), (final ? (were) : (are)), _(("cold resistant")), (from_what(COLD_RES)));
    item_resistance_message(AD_COLD, _(" protected from cold"), final);
    if (Sleep_resistance())
        enlght_line((You_), (final ? (were) : (are)), _(("sleep resistant")), (from_what(SLEEP_RES)));
    if (Disint_resistance())
        enlght_line((You_), (final ? (were) : (are)), _(("disintegration resistant")), (from_what(DISINT_RES)));
    item_resistance_message(AD_DISN, _(" protected from disintegration"), final);
    if (Shock_resistance())
        enlght_line((You_), (final ? (were) : (are)), _(("shock resistant")), (from_what(SHOCK_RES)));
    item_resistance_message(AD_ELEC, _(" protected from electric shocks"),
                            final);
    if (Poison_resistance())
        enlght_line((You_), (final ? (were) : (are)), _(("poison resistant")), (from_what(POISON_RES)));
    if (Acid_resistance()) {
        sprintf(buf, _("%.20s%.30s"), temp_resist(ACID_RES) ? _("temporarily ") : _(""), _("acid resistant"))

;
        enlght_line((You_), (final ? (were) : (are)), (buf), (from_what(ACID_RES)));
    }
    item_resistance_message(AD_ACID, _(" protected from acid"), final);
    if (Drain_resistance())
        enlght_line((You_), (final ? (were) : (are)), _(("level-drain resistant")), (from_what(DRAIN_RES)));
    if (Sick_resistance())
        enlght_line((You_), (final ? (were) : (are)), _(("immune to sickness")), (from_what(SICK_RES)));
    if (Stone_resistance()) {
        sprintf(buf, _("%.20s%.30s"), temp_resist(STONE_RES) ? _("temporarily ") : _(""), _("petrification resistant"))

;
        enlght_line((You_), (final ? (were) : (are)), (buf), (from_what(STONE_RES)));
    }
    if (Halluc_resistance())
        enlght_line((You_), (final ? _(("resisted")) : _(("resist"))), _((" hallucinations")), (from_what(HALLUC_RES)))
;
    if (u.uedibility)
        enlght_line((You_), (final ? (could) : (can)), _(("recognize detrimental food")), _(("")));

    /*** Vision and senses ***/
    if ((HBlinded() || EBlinded()) && BBlinded()) /* blind w/ blindness blocked */
        enlght_line((You_), (final ? (could) : (can)), _(("see")), (from_what(-BLINDED))); /* Eyes of the Overworld */
    if (Blnd_resist() && !Blind()) /* skip if no eyes or blindfolded */
        enlght_line((You_), (final ? (were) : (are)), _(("not subject to light-induced blindness")), (from_what(BLND_RES)))
;
    if (See_invisible()) {
        if (!Blind())
            enlght_line((You_), (final ? _(("saw")) : _(("see"))), _((" invisible")), (from_what(SEE_INVIS)));
        else if (!PermaBlind())
            enlght_line((You_), (final ? _(("would have seen")) : _(("will see"))), _((" invisible when not blind")), _(("")));
        else
            enlght_line((You_), (final ? _(("would have seen")) : _(("would see"))), _((" invisible if not blind")), _(("")))

;
    }
    if (Blind_telepat())
        enlght_line((You_), (final ? (were) : (are)), _(("telepathic")), (from_what(TELEPAT)));
    if (Warning())
        enlght_line((You_), (final ? (were) : (are)), _(("warned")), (from_what(WARNING)));
    if (Warn_of_mon() && svc.context.warntype.obj) {
        sprintf(buf, _("aware of the presence of %s"), (svc.context.warntype.obj & M2_ORC) ? _("orcs")
                : (svc.context.warntype.obj & M2_ELF) ? _("elves")
                  : (svc.context.warntype.obj & M2_DEMON) ? _("demons")
                    : something())
;
        enlght_line((You_), (final ? (were) : (are)), (buf), (from_what(WARN_OF_MON)));
    }
    if (Warn_of_mon() && svc.context.warntype.polyd) {
        sprintf(buf, _("aware of the presence of %s"), ((svc.context.warntype.polyd & (M2_HUMAN | M2_ELF))
                 == (M2_HUMAN | M2_ELF)) ? _("humans and elves")
                    : (svc.context.warntype.polyd & M2_HUMAN) ? _("humans")
                      : (svc.context.warntype.polyd & M2_ELF) ? _("elves")
                        : (svc.context.warntype.polyd & M2_ORC) ? _("orcs")
                          : (svc.context.warntype.polyd & M2_DEMON) ? _("demons")
                            : _("certain monsters"))
;
        enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
    }
    warnspecies =  svc.context.warntype.speciesidx;
    if (Warn_of_mon() && ismnum(warnspecies)) {
        sprintf(buf, _("aware of the presence of %s"), makeplural(mons[warnspecies].pmnames[NEUTRAL]))
;
        enlght_line((You_), (final ? (were) : (are)), (buf), (from_what(WARN_OF_MON)));
    }
    if (Undead_warning())
        enlght_line((You_), (final ? (were) : (are)), _(("warned of undead")), (from_what(WARN_UNDEAD)));
    if (Searching())
        enlght_line((You_), (final ? (had) : (have)), _(("automatic searching")), (from_what(SEARCHING)));
    if (Clairvoyant()) {
        enlght_line((You_), (final ? (were) : (are)), _(("clairvoyant")), (from_what(CLAIRVOYANT)));
    } else if ((HClairvoyant() || EClairvoyant()) && BClairvoyant()) {
        strcpy(buf, from_what(-CLAIRVOYANT));
        strsubst(buf, _(" because of "), _(" if not for "));
        enlght_line((You_), (final ? _(("could have been")) : _(("could be"))), _((" clairvoyant")), (buf));
    }
    if (Infravision())
        enlght_line((You_), (final ? (had) : (have)), _(("infravision")), (from_what(INFRAVISION)));
    if (Detect_monsters()) {
        strcpy(buf, _("sensing the presence of monsters"));
        if (wizard()) {
            let detectmon_timeout = (HDetect_monsters() & TIMEOUT);

            if (detectmon_timeout)
                sprintf(eos(buf), _(" (%lld)"), detectmon_timeout);
        }
        enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
    }
    if (u.umconf) { /* 'u.umconf' is a counter rather than a timeout */
        strcpy(buf, _(" monsters when hitting them"));
        if (wizard() && !final) {
            if (u.umconf == 1)
                strcat(buf, _(" (next hit only)"));
            else /* u.umconf > 1 */
                sprintf(eos(buf), _(" (next %u hits)"), u.umconf);
        }
        enlght_line((You_), (final ? _(("would have confused")) : _(("will confuse"))), (buf), _(("")));
    }

    /*** Appearance and behavior ***/
    if (Adornment()) {
        let adorn = 0;

        if (uleft && uleft.otyp == RIN_ADORNMENT)
            adorn += uleft.spe;
        if (uright && uright.otyp == RIN_ADORNMENT)
            adorn += uright.spe;
        /* the sum might be 0 (+0 ring or two which negate each other);
           that yields "you are charismatic" (which isn't pointless
           because it potentially impacts seduction attacks) */
        sprintf(buf, _("%scharismatic"), (adorn > 0) ? _("more ") : (adorn < 0) ? _("less ") : _(""))
;
        enlght_line((You_), (final ? (were) : (are)), (buf), (from_what(ADORNED)));
    }
    if (Invisible())
        enlght_line((You_), (final ? (were) : (are)), _(("invisible")), (from_what(INVIS)));
    else if (Invis())
        enlght_line((You_), (final ? (were) : (are)), _(("invisible to others")), (from_what(INVIS)));
    /* ordinarily "visible" is redundant; this is a special case for
       the situation when invisibility would be an expected attribute */
    else if ((HInvis() || EInvis()) && BInvis())
        enlght_line((You_), (final ? (were) : (are)), _(("visible")), (from_what(-INVIS)));
    if (Displaced())
        enlght_line((You_), (final ? (were) : (are)), _(("displaced")), (from_what(DISPLACED)));
    if (Stealth()) {
        enlght_line((You_), (final ? (were) : (are)), _(("stealthy")), (from_what(STEALTH)));
    } else if (BStealth() && (HStealth() || EStealth())) {
        sprintf(buf, _(" stealthy%s"), (BStealth() == FROMOUTSIDE) ? _(" if not mounted") : _(""))
;
        enlght_line((You_), (final ? _(("would have been")) : _(("would be"))), (buf), _(("")));
    }
    if (Aggravate_monster())
        enlght_line(_(("You aggravate")), (final ? _(("d")) : _((""))), _((" monsters")), (from_what(AGGRAVATE_MONSTER)))
;
    if (Conflict())
        enlght_line(_(("You cause")), (final ? _(("d")) : _((""))), _((" conflict")), (from_what(CONFLICT)));

    /*** Transportation ***/
    if (Jumping())
        enlght_line((You_), (final ? (could) : (can)), _(("jump")), (from_what(JUMPING)));
    if (Teleportation())
        enlght_line((You_), (final ? (could) : (can)), _(("teleport")), (from_what(TELEPORT)));
    if (Teleport_control())
        enlght_line((You_), (final ? (had) : (have)), _(("teleport control")), (from_what(TELEPORT_CONTROL)));
    /* actively levitating handled earlier as a status condition */
    if (BLevitation()) { /* levitation is blocked */
        let save_BLev = BLevitation();

        u.uprops[LEVITATION].blocked = 0;
        if (Levitation()) {
            /* either trapped in the floor or inside solid rock
               (or both if chained to buried iron ball and have
               moved one step into solid rock somehow) */
            let trapped = +((save_BLev & I_SPECIAL) != 0),
                    terrain = +((save_BLev & FROMOUTSIDE) != 0);

            sprintf(buf, _("%s%s%s"), trapped ? _(" if not trapped") : _(""), (trapped && terrain) ? _(" and") : _(""), terrain ? if_surroundings_permitted : _(""))

;
            enlght_line((You_), (final ? _(("would have levitated")) : _(("would levitate"))), (buf), _(("")));
        }
        u.uprops[LEVITATION].blocked = save_BLev;
    }
    /* actively flying handled earlier as a status condition */
    if (BFlying()) { /* flight is blocked */
        let save_BFly = BFlying();

        u.uprops[FLYING].blocked = 0;
        if (Flying()) {
            enlght_line((You_), (final ? _(("would have flown")) : _(("would fly"))), (Levitation()
                       ? _(" if you weren't levitating")
                       : (save_BFly == I_SPECIAL)
                          /* this is an oversimplification; being trapped
                             might also be blocking levitation so flight
                             would still be blocked after escaping trap */
                          ? _(" if you weren't trapped")
                          : (save_BFly == FROMOUTSIDE)
                             ? if_surroundings_permitted
                             /* two or more of levitation, surroundings,
                                and being trapped in the floor */
                             : _(" if circumstances permitted")), _(("")))

;
        }
        u.uprops[FLYING].blocked = save_BFly;
    }
    /* including this might bring attention to the fact that ceiling
       clinging has inconsistencies... */
    if (is_clinger(gy.youmonst.data)) {
        let has_lid = has_ceiling(u.uz);

        if (has_lid && !u.uinwater) {
            enlght_line((You_), (final ? (could) : (can)), _(("cling to the ceiling")), _(("")));
        } else {
            sprintf(buf, _(" to the ceiling if %s%s%s"), !has_lid ? _("there was one") : _(""), (!has_lid && u.uinwater) ? _(" and ") : _(""), u.uinwater ? (Underwater() ? _("you weren't underwater")
                                  : _("you weren't in the water")) : _(""))

;
            /* past tense is applicable for death while Unchanging */
            enlght_line((You_), (final ? _(("could have clung")) : _(("could cling"))), (buf), _(("")));
        }
    }
    /* actively walking on water handled earlier as a status condition */
    if (Wwalking() && !walking_on_water())
        enlght_line((You_), (final ? (could) : (can)), _(("walk on water")), (from_what(WWALKING)));
    /* actively swimming (in water but not under it) handled earlier */
    if (Swimming() && (Underwater() || !u.uinwater))
        enlght_line((You_), (final ? (could) : (can)), _(("swim")), (from_what(SWIMMING)));
    if (Breathless())
        enlght_line((You_), (final ? (could) : (can)), _(("survive without air")), (from_what(MAGICAL_BREATHING)));
    else if (Amphibious())
        enlght_line((You_), (final ? (could) : (can)), _(("breathe water")), (from_what(MAGICAL_BREATHING)));
    if (Passes_walls())
        enlght_line((You_), (final ? (could) : (can)), _(("walk through walls")), (from_what(PASSES_WALLS)));

    /*** Physical attributes ***/
    if (Regeneration())
        enlght_line(_(("You regenerate")), (final ? _(("d")) : _((""))), _(("")), (from_what(REGENERATION)));
    if (Slow_digestion())
        enlght_line((You_), (final ? (had) : (have)), _(("slower digestion")), (from_what(SLOW_DIGESTION)));
    if (u.uhitinc) {
        enlght_combatinc(_("to hit"), u.uhitinc, final, buf);
        if (iflags.tux_penalty && !Upolyd())
            sprintf(eos(buf), _(" %s your suit's penalty"), (u.uhitinc < 0) ? _("increasing")
                    : (u.uhitinc < Math.trunc(4 * gu.urole.spelarmr / 5))
                      ? _("partly offsetting")
                      : (u.uhitinc < gu.urole.spelarmr) ? _("nearly offsetting")
                        : _("overcoming"))
;
        enlght_line((You_), (final ? (had) : (have)), (buf), _(("")));
    }
    if (u.udaminc)
        enlght_line((You_), (final ? (had) : (have)), (enlght_combatinc(_("damage"), u.udaminc, final, buf)), _(("")));
    if (u.uspellprot || Protection()) {
        let prot = 0;

        if (uleft && uleft.otyp == RIN_PROTECTION)
            prot += uleft.spe;
        if (uright && uright.otyp == RIN_PROTECTION)
            prot += uright.spe;
        if (uamul && uamul.otyp == AMULET_OF_GUARDING)
            prot += 2;
        if (HProtection() & INTRINSIC)
            prot += u.ublessed;
        prot += u.uspellprot;
        if (prot)
            enlght_line((You_), (final ? (had) : (have)), (enlght_combatinc(_("defense"), prot, final, buf)), _(("")));
    }
    if ((armpro = magic_negation(gy.youmonst)) > 0) {
        /* magic cancellation factor, conferred by worn armor */
        let mc_types = static_array("attributes_enlightenment.mc_types", ptr_to(char), null, [
            _("") /*ordinary*/, _("warded"), _("guarded"), _("protected"),
        ]);
        /* sanity check */
        if (armpro >= SIZE(mc_types))
            armpro = SIZE(mc_types) - 1;
        enlght_line((You_), (final ? (were) : (are)), (mc_types[armpro]), _(("")));
    }
    if (Half_physical_damage())
        enlght_halfdmg(HALF_PHDAM, final);
    if (Half_spell_damage())
        enlght_halfdmg(HALF_SPDAM, final);
    if (Half_gas_damage())
        enlght_line((You_), (final ? _(("took")) : _(("take"))), _((" reduced poison gas damage")), _(("")));
    if (spellid(0) > NO_SPELL) { /* skip if no spells are known yet */
        /* greatly simplified edition of percent_success(spell.c)--may need
           to be suppressed if oversimplification leads to player confusion */
        let cast_adj = stack_array(char, QBUFSZ);
        let suit = (uarm && is_metallic(uarm) ? 1 : 0),
                robe = (uarmc && uarmc.otyp == ROBE ? 1 : 0);

        chars[cast_adj] = ord('\0');
        if (suit) /* omit "wearing" to shorten the text */
            sprintf(cast_adj, _(" impaired by metallic armor%s"), robe ? _(", mitigated by your robe") : _(""));
        else if (robe)
            strcpy(cast_adj, _(" enhanced by wearing a robe"))
;

        if (chars[cast_adj])
            enlght_line(_(("Your spell casting ")), (final ? _(("was")) : _(("is"))), (cast_adj), _(("")));
    }
    /* polymorph and other shape change */
    if (Protection_from_shape_changers())
        enlght_line((You_), (final ? (were) : (are)), _(("protected from shape changers")), (from_what(PROT_FROM_SHAPE_CHANGERS)))
;
    if (Unchanging()) {
        let what = 0;

        if (!Upolyd()) /* Upolyd handled below after current form */
            enlght_line((You_), (final ? (could) : (can)), _(("not change from your current form")), (from_what(UNCHANGING)))
;
        /* blocked shape changes */
        if (Polymorph())
            what = !final ? _("polymorph") : _("have polymorphed");
        else if (ismnum(u.ulycn))
            what = !final ? _("change shape") : _("have changed shape");
        if (what) {
            sprintf(buf, _("would %s periodically"), what);
            /* omit from_what(UNCHANGING); too verbose */
            enlght_line((You_), (final ? (buf) : (buf)), _((" if not locked into your current form")), _(("")))
;
        }
    } else if (Polymorph()) {
        enlght_line((You_), (final ? (were) : (are)), _(("polymorphing periodically")), (from_what(POLYMORPH)));
    }
    if (Polymorph_control())
        enlght_line((You_), (final ? (had) : (have)), _(("polymorph control")), (from_what(POLYMORPH_CONTROL)));
    if (Upolyd() && u.umonnum != u.ulycn
        /* if we've died from turning into slime, we're polymorphed
           right now but don't want to list it as a temporary attribute
           [we need a more reliable way to detect this situation] */
        && !(final == ENL_GAMEOVERDEAD
             && u.umonnum == PM_GREEN_SLIME && !Unchanging())) {
        /* foreign shape (except were-form which is handled below) */
        if (!vampshifted(gy.youmonst))
            sprintf(buf, _("polymorphed into %s"), an(pmname(gy.youmonst.data,
                              flags.female ? FEMALE : MALE)));
        else
            sprintf(buf, _("polymorphed into %s in %s form"), an(pmname(mons[gy.youmonst.cham],
                              flags.female ? FEMALE : MALE)), pmname(gy.youmonst.data, flags.female ? FEMALE : MALE))

;
        if (wizard())
            sprintf(eos(buf), _(" (%d)"), u.mtimedone);
        enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
    }
    if (lays_eggs(gy.youmonst.data) && flags.female) /* Upolyd */
        enlght_line((You_), (final ? (could) : (can)), _(("lay eggs")), _(("")));
    if (ismnum(u.ulycn)) {
        /* "you are a werecreature [in beast form]" */
        strcpy(buf, an(pmname(mons[u.ulycn],
               flags.female ? FEMALE : MALE)));
        if (u.umonnum == u.ulycn) {
            strcat(buf, _(" in beast form"));
            if (wizard())
                sprintf(eos(buf), _(" (%d)"), u.mtimedone);
        }
        enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
    }
    if (Unchanging() && Upolyd()) /* !Upolyd handled above */
        enlght_line((You_), (final ? (could) : (can)), _(("not change from your current form")), (from_what(UNCHANGING)));
    if (Hate_silver())
        enlght_line((You_), (final ? (were) : (are)), _(("harmed by silver")), _(("")));
    /* movement and non-armor-based protection */
    if (Fast())
        enlght_line((You_), (final ? (were) : (are)), (Very_fast() ? _("very fast") : _("fast")), (from_what(FAST)));
    if (Reflecting())
        enlght_line((You_), (final ? (had) : (have)), _(("reflection")), (from_what(REFLECTING)));
    if (Free_action())
        enlght_line((You_), (final ? (had) : (have)), _(("free action")), (from_what(FREE_ACTION)));
    if (Fixed_abil())
        enlght_line((You_), (final ? (had) : (have)), _(("fixed abilities")), (from_what(FIXED_ABIL)));
    if (Lifesaved())
        enlght_line(_(("Your life ")), (final ? _(("would have been")) : _(("will be"))), _((" saved")), _(("")));

    /*** Miscellany ***/
    if (Luck()) {
        ltmp = abs(Luck());
        sprintf(buf, _("%s%slucky"), ltmp >= 10 ? _("extremely ") : ltmp >= 5 ? _("very ") : _(""), Luck() < 0 ? _("un") : _(""))

;
        if (wizard())
            sprintf(eos(buf), _(" (%d)"), Luck());
        enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
    } else if (wizard())
        enlght_line(_(("Your luck ")), (final ? _(("was")) : _(("is"))), _((" zero")), _(("")));
    if (u.moreluck > 0)
        enlght_line((You_), (final ? (had) : (have)), _(("extra luck")), _(("")));
    else if (u.moreluck < 0)
        enlght_line((You_), (final ? (had) : (have)), _(("reduced luck")), _(("")));
    if (carrying(LUCKSTONE) || stone_luck(TRUE)) {
        ltmp = stone_luck(FALSE);
        if (ltmp <= 0)
            enlght_line(_(("Bad luck ")), (final ? _(("did")) : _(("does"))), _((" not time out for you")), _(("")));
        if (ltmp >= 0)
            enlght_line(_(("Good luck ")), (final ? _(("did")) : _(("does"))), _((" not time out for you")), _(("")));
    }

    if (u.ugangr) {
        sprintf(buf, _(" %sangry with you"), u.ugangr > 6 ? _("extremely ") : u.ugangr > 3 ? _("very ") : _(""))
;
        if (wizard())
            sprintf(eos(buf), _(" (%d)"), u.ugangr);
        enlght_line((u_gname()), (final ? _((" was")) : _((" is"))), (buf), _(("")));
    } else {
        /*
         * We need to suppress this when the game is over, because death
         * can change the value calculated by can_pray(), potentially
         * resulting in a false claim that you could have prayed safely.
         */
        if (!final) {
            sprintf(buf, _("%ssafely pray"), can_pray(FALSE) ? _("") : _("not "));

            if (wizard())
                sprintf(eos(buf), _(" (%d)"), u.ublesscnt);
            enlght_line((You_), (final ? (could) : (can)), (buf), _(("")));
        }
    }

    /* named fruit debugging (doesn't really belong here...); to enable,
       include 'fruit' in DEBUGFILES list (even though it isn't a file...) */
    if (wizard() && explicitdebug(_("fruit"))) {
        let f;

        reorder_fruit(TRUE); /* sort by fruit index, from low to high;
                              * this modifies the gf.ffruit chain, so could
                              * possibly mask or even introduce a problem,
                              * but it does useful sanity checking */
        for (f = gf.ffruit; f; f = f.nextf) {
            sprintf(buf, _("Fruit #%d "), f.fid);
            enlght_line((buf), (final ? _(("was ")) : _(("is "))), (f.fname), _(("")));
        }
        enlght_line(_(("The current fruit ")), (final ? _(("was ")) : _(("is "))), (svp.pl_fruit), _(("")));
        sprintf(buf, _("%d"), flags.made_fruit);
        enlght_line(_(("The made fruit flag ")), (final ? _(("was ")) : _(("is "))), (buf), _(("")));
    }

    {
        let p;

        chars[buf + 0] = ord('\0');
        if (final < 2) { /* still in progress, or quit/escaped/ascended */
            p = _("survived after being killed ");
            if (!u.umortality)
                p = !final ? 0 : _("survived");
            else
                N_times(u.umortality, buf);
        } else { /* game ended in character's death */
            p = _("are dead");
            switch (u.umortality) {
            case 0:
                impossible(_("dead without dying?"));
                /* FALLTHROUGH */;
                /* FALLTHRU */
            case 1:
                break; /* just "are dead" */
            default:
                sprintf(buf, _(" (%d%s time!)"), u.umortality, ordin(u.umortality))
;
                break;
            }
        }
        if (p)
            enlght_line((You_), (final ? (p) : _(("have been killed "))), (buf), _(("")));
    }
    } finally { stack_pop($frame); }
}

/* ^X command */
export function doattributes() { /* int */
    let mode = BASICENLIGHTENMENT;

    /* show more--as if final disclosure--for wizard and explore modes */
    if (wizard() || discover())
        mode |= MAGICENLIGHTENMENT;

    enlightenment(mode, ENL_GAMEINPROGRESS);
    return ECMD_OK;
}

export function youhiding(via_enlghtmt,
          msgflag) { /* void */ /* for variant message phrasing */
    const $frame = stack_frame(); try {
    let bp, buf = stack_array(char, BUFSZ);

    strcpy(buf, _("hiding"));
    if (U_AP_TYPE() != M_AP_NOTHING) {
        /* mimic; hero is only able to mimic a strange object or gold
           or hallucinatory alternative to gold, so we skip the details
           for the hypothetical furniture and monster cases */
        bp = eos(strcpy(buf, _("mimicking")));
        if (U_AP_TYPE() == M_AP_OBJECT) {
            sprintf(bp, _(" %s"), an(simple_typename(int(gy.youmonst.mappearance))));
        } else if (U_AP_TYPE() == M_AP_FURNITURE) {
            strcpy(bp, _(" something"));
        } else if (U_AP_TYPE() == M_AP_MONSTER) {
            strcpy(bp, _(" someone"));
        } else {
            ; /* something unexpected; leave 'buf' as-is */
        }
    } else if (u.uundetected) {
        bp = eos(buf); /* points past "hiding" */
        if (gy.youmonst.data.mlet == S_EEL) {
            if (is_pool(u.ux, u.uy))
                sprintf(bp, _(" in the %s"), waterbody_name(u.ux, u.uy));
        } else if (hides_under(gy.youmonst.data)) {
            let o = svl.level.objects[u.ux][u.uy];

            if (o)
                sprintf(bp, _(" underneath %s"), ansimpleoname(o));
        } else if (is_clinger(gy.youmonst.data) || Flying()) {
            /* Flying: 'lurker above' hides on ceiling but doesn't cling */
            sprintf(bp, _(" on the %s"), ceiling(u.ux, u.uy));
        } else {
            /* on floor; is_hider() but otherwise not special: 'trapper' */
            if (u.utrap && u.utraptype == TT_PIT) {
                let t = t_at(u.ux, u.uy);

                sprintf(bp, _(" in a %spit"), (t && t.ttyp == SPIKED_PIT) ? _("spiked ") : _(""))
;
            } else
                sprintf(bp, _(" on the %s"), surface(u.ux, u.uy));
        }
    } else {
        ; /* shouldn't happen; will result in generic "you are hiding" */
    }

    if (via_enlghtmt) {
        let final = msgflag; /* 'final' is used by you_are() macro */

        enlght_line((You_), (final ? (were) : (are)), (buf), _(("")));
    } else {
        /* for dohide(), when player uses '#monster' command */
        You(_("are %s %s."), msgflag ? _("already") : _("now"), buf);
    }
    } finally { stack_pop($frame); }
}

/* #conduct command [KMH]; shares enlightenment's tense handling */
export function doconduct() { /* int */
    show_conduct(ENL_GAMEINPROGRESS);
    return ECMD_OK;
}

/* display conducts; for doconduct(), also disclose() and dump_everything() */
export function show_conduct(final) { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ), bufN = stack_array(char, 40);
    let ngenocided;

    /* Create the conduct window */
    ge.en_win = create_nhwindow()(NHW_MENU);
    putstr()(ge.en_win, 0, _("Voluntary challenges:"));

    /* rerolling; "You <this or that>" is about the character, rerolling
       is about the player so phrase it differently;
       also, always use past tense since the chance to do something with it
       is gone by time player can issue #conduct command or see disclosure */
    if (!u.uroleplay.reroll)
        strcpy(buf, _(" Character rerolling was not enabled."));
    else if (!u.uroleplay.numrerolls)
        strcpy(buf, _(" Your character was not rerolled."));
    else
        sprintf(buf, _(" Your character was rerolled %s."), N_times(u.uroleplay.numrerolls, bufN))
;
    enlght_out(buf);

    if (u.uroleplay.blind)
        enlght_line((You_), (final ? (were) : (have_been)), _(("blind from birth")), _(("")));
    if (u.uroleplay.deaf)
        enlght_line((You_), (final ? (were) : (have_been)), _(("deaf from birth")), _(("")));
    /* note: we don't report "you are without possessions" unless the
       game started with the pauper option set */
    if (u.uroleplay.pauper)
        enlght_line((You_), (final ? _(("started out")) : (gi.invent ? _("started") : _("are"))), _((" without possessions")), _(("")))
;
    /* nudist is far more than a subset of possessionless, and a much
       more impressive accomplishment, but showing "started out without
       possessions" before "faithfully nudist" looks more logical */
    if (u.uroleplay.nudist)
        enlght_line((You_), (final ? (were) : (have_been)), _(("faithfully nudist")), _(("")));

    if (!u.uconduct.food)
        enlght_line((You_), (final ? _(("went")) : _(("have gone"))), _((" without food")), _(("")));
        /* but beverages are okay */
    else if (!u.uconduct.unvegan)
        enlght_line((You_), (final ? (_("")) : (have)), _(("followed a strict vegan diet")), _(("")));
    else if (!u.uconduct.unvegetarian)
        enlght_line((You_), (final ? (were) : (have_been)), _(("vegetarian")), _(("")));

    if (!u.uconduct.gnostic)
        enlght_line((You_), (final ? (were) : (have_been)), _(("an atheist")), _(("")));

    if (!u.uconduct.weaphit) {
        enlght_line((You_), (final ? (never) : (have_never)), _(("hit with a wielded weapon")), _(("")));
    } else if (wizard()) {
        sprintf(buf, _("hit with a wielded weapon %lld time%s"), u.uconduct.weaphit, plur(u.uconduct.weaphit))
;
        enlght_line((You_), (final ? (_("")) : (have)), (buf), _(("")));
    }
    if (!u.uconduct.killer)
        enlght_line((You_), (final ? (were) : (have_been)), _(("a pacifist")), _(("")));

    if (!u.uconduct.literate) {
        enlght_line((You_), (final ? (were) : (have_been)), _(("illiterate")), _(("")));
    } else if (wizard()) {
        sprintf(buf, _("read items or engraved %lld time%s"), u.uconduct.literate, plur(u.uconduct.literate))
;
        enlght_line((You_), (final ? (_("")) : (have)), (buf), _(("")));
    }

    if (!u.uconduct.pets)
        enlght_line((You_), (final ? (never) : (have_never)), _(("had a pet")), _(("")));

    ngenocided = num_genocides();
    if (ngenocided == 0) {
        enlght_line((You_), (final ? (never) : (have_never)), _(("genocided any monsters")), _(("")));
    } else {
        sprintf(buf, _("genocided %d type%s of monster%s"), ngenocided, plur(ngenocided), plur(ngenocided))
;
        enlght_line((You_), (final ? (_("")) : (have)), (buf), _(("")));
    }

    if (!u.uconduct.polypiles) {
        enlght_line((You_), (final ? (never) : (have_never)), _(("polymorphed an object")), _(("")));
    } else if (wizard()) {
        sprintf(buf, _("polymorphed %lld item%s"), u.uconduct.polypiles, plur(u.uconduct.polypiles))
;
        enlght_line((You_), (final ? (_("")) : (have)), (buf), _(("")));
    }

    if (!u.uconduct.polyselfs) {
        enlght_line((You_), (final ? (never) : (have_never)), _(("changed form")), _(("")));
    } else if (wizard()) {
        sprintf(buf, _("changed form %lld time%s"), u.uconduct.polyselfs, plur(u.uconduct.polyselfs))
;
        enlght_line((You_), (final ? (_("")) : (have)), (buf), _(("")));
    }

    if (!u.uconduct.wishes) {
        enlght_line((You_), (final ? (_("")) : (have)), _(("used no wishes")), _(("")));
    } else {
        sprintf(buf, _("used %lld wish%s"), u.uconduct.wishes, (u.uconduct.wishes > 1) ? _("es") : _(""))
;
        if (u.uconduct.wisharti) {
            /* if wisharti == wishes
             *  1 wish (for an artifact)
             *  2 wishes (both for artifacts)
             *  N wishes (all for artifacts)
             * else (N is at least 2 in order to get here; M < N)
             *  N wishes (1 for an artifact)
             *  N wishes (M for artifacts)
             */
            if (u.uconduct.wisharti == u.uconduct.wishes)
                sprintf(eos(buf), _(" (%s"), (u.uconduct.wisharti > 2) ? _("all ")
                          : (u.uconduct.wisharti == 2) ? _("both ") : _(""));
            else
                sprintf(eos(buf), _(" (%lld "), u.uconduct.wisharti)
;

            sprintf(eos(buf), _("for %s)"), (u.uconduct.wisharti == 1) ? _("an artifact")
                                                : _("artifacts"))
;
        }
        enlght_line((You_), (final ? (_("")) : (have)), (buf), _(("")));

        if (!u.uconduct.wisharti)
            enlght_line((You_), (final ? _(("did not wish")) : _(("have not wished"))), _((" for any artifacts")), _(("")))
;
    }

    /* only report Sokoban conduct if the Sokoban branch has been entered */
    if (sokoban_in_play()) {
        let presentverb = _("have violated"), pastverb = _("violated");

        if (!u.uconduct.sokocheat) {
            presentverb = _("have not violated");
            pastverb = _("did not violate");
            strcpy(buf, _(" any of the special Sokoban rules"));
        } else {
            strcpy(buf, _(" the special Sokoban rules "));
            strcat(buf, N_times(u.uconduct.sokocheat, bufN));
        }
        enlght_line((You_), (final ? (pastverb) : (presentverb)), (buf), _(("")));
    }

    show_achievements(final);

    /* Pop up the window and wait for a key */
    display_nhwindow()(ge.en_win, TRUE);
    destroy_nhwindow()(ge.en_win);
    ge.en_win = WIN_ERR;
    } finally { stack_pop($frame); }
}

/*
 *      Achievements (see 'enum achievements' in you.h).
 */

function show_achievements(
    final) { /* void */ /* 'final' is used "behind the curtain" by enl_foo() macros */
    const $frame = stack_frame(); try {
    let i, achidx, absidx, acnt;
    let title = stack_array(char, QBUFSZ), buf = stack_array(char, QBUFSZ);
    let awin = WIN_ERR;

    /* unfortunately we can't show the achievements (at least not all of
       them) while the game is in progress because it would give away the
       ID of luckstone (at Mine's End) and of real Amulet of Yendor */
    if (!final && !wizard())
        return;

    /* first, figure whether any achievements have been accomplished
       so that we don't show the header for them if the resulting list
       below it would be empty */
    if ((acnt = count_achievements()) == 0)
        return;

    if (ge.en_win != WIN_ERR) {
        awin = ge.en_win; /* end of game disclosure window */
        putstr()(awin, 0, _(""));
    } else {
        awin = create_nhwindow()(NHW_MENU);
    }
    sprintf(title, _("Achievement%s:"), plur(acnt));
    putstr()(awin, 0, title);

    /* display achievements in the order in which they were recorded;
       lone exception is to defer the Amulet if we just ascended;
       it warrants alternate wording when given away during ascension,
       but the Amulet achievement is always attained before entering
       endgame and the alternate wording looks strange if shown before
       "reached endgame" and "reached Astral" */
    if (remove_achievement(ACH_UWIN)) { /* UWIN == Ascended! */
        /* for ascension, force it to be last and Amulet next to last
           by taking them out and then adding them back */
        if (remove_achievement(ACH_AMUL)) /* should always be True here */
            record_achievement(ACH_AMUL);
        record_achievement(ACH_UWIN);
    }
    for (i = 0; i < acnt; ++i) {
        achidx = chars[u.uachieved + i];
        absidx = abs(achidx);

        switch (absidx) {
        case ACH_BLND:
            enlght_line((You_), (final ? _(("explored")) : _(("are exploring"))), _((" without being able to see")), _(("")))
;
            break;
        case ACH_NUDE:
            enlght_line((You_), (final ? _(("went")) : _(("have gone"))), _((" without any armor")), _(("")));
            break;
        case ACH_MINE:
            enlght_line((You_), (final ? (_("")) : (have)), _(("entered the Gnomish Mines")), _(("")));
            break;
        case ACH_TOWN:
            enlght_line((You_), (final ? (_("")) : (have)), _(("entered Minetown")), _(("")));
            break;
        case ACH_SHOP:
            enlght_line((You_), (final ? (_("")) : (have)), _(("entered a shop")), _(("")));
            break;
        case ACH_TMPL:
            enlght_line((You_), (final ? (_("")) : (have)), _(("entered a temple")), _(("")));
            break;
        case ACH_ORCL:
            enlght_line((You_), (final ? (_("")) : (have)), _(("consulted the Oracle of Delphi")), _(("")));
            break;
        case ACH_NOVL:
            enlght_line((You_), (final ? (_("")) : (have)), _(("read from a Discworld novel")), _(("")));
            break;
        case ACH_SOKO:
            enlght_line((You_), (final ? (_("")) : (have)), _(("entered Sokoban")), _(("")));
            break;
        case ACH_SOKO_PRIZE: /* hard to reach guaranteed bag or amulet */
            enlght_line((You_), (final ? (_("")) : (have)), _(("completed Sokoban")), _(("")));
            break;
        case ACH_MINE_PRIZE: /* hidden guaranteed luckstone */
            enlght_line((You_), (final ? (_("")) : (have)), _(("completed the Gnomish Mines")), _(("")));
            break;
        case ACH_BGRM:
            enlght_line((You_), (final ? (_("")) : (have)), _(("entered the Big Room")), _(("")));
            break;
        case ACH_MEDU:
            enlght_line((You_), (final ? (_("")) : (have)), _(("defeated Medusa")), _(("")));
            break;
        case ACH_TUNE:
            enlght_line((You_), (final ? (_("")) : (have)), _(("learned the tune to open and close the Castle's drawbridge")), _(("")))
;
            break;
        case ACH_BELL:
            /* alternate phrasing for present vs past and also for
               possessing the item vs once held it */
            enlght_line((You_), (final ? (u.uhave.bell ? _("had") : _("handled")) : (u.uhave.bell ? _("have") : _("have handled"))), _((" the Bell of Opening")), _(("")))

;
            break;
        case ACH_HELL:
            enlght_line((You_), (final ? _(("")) : _(("have "))), _(("entered Gehennom")), _(("")));
            break;
        case ACH_CNDL:
            enlght_line((You_), (final ? (u.uhave.menorah ? _("had") : _("handled")) : (u.uhave.menorah ? _("have") : _("have handled"))), _((" the Candelabrum of Invocation")), _(("")))

;
            break;
        case ACH_BOOK:
            enlght_line((You_), (final ? (u.uhave.book ? _("had") : _("handled")) : (u.uhave.book ? _("have") : _("have handled"))), _((" the Book of the Dead")), _(("")))

;
            break;
        case ACH_INVK:
            enlght_line((You_), (final ? (_("")) : (have)), _(("gained access to Moloch's Sanctum")), _(("")));
            break;
        case ACH_AMUL:
            /* alternate wording for ascended (always past tense) since
               hero had it until #offer forced it to be relinquished */
            enlght_line((You_), (final ? (u.uevent.ascended ? _("delivered")
                     : u.uhave.amulet ? _("had") : _("had obtained")) : (u.uhave.amulet ? _("have") : _("have obtained"))), _((" the Amulet of Yendor")), _(("")))

;
            break;

        /* reaching Astral makes feedback about reaching the Planes
           be redundant and ascending makes both be redundant, but
           we display all that apply */
        case ACH_ENDG:
            enlght_line((You_), (final ? (_("")) : (have)), _(("reached the Elemental Planes")), _(("")));
            break;
        case ACH_ASTR:
            enlght_line((You_), (final ? (_("")) : (have)), _(("reached the Astral Plane")), _(("")));
            break;
        case ACH_UWIN:
            /* the ultimate achievement... */
            enlght_out(_(" You ascended!"));
            break;

        /* rank 0 is the starting condition, not an achievement; 8 is Xp 30 */
        case ACH_RNK1: case ACH_RNK2: case ACH_RNK3: case ACH_RNK4:
        case ACH_RNK5: case ACH_RNK6: case ACH_RNK7: case ACH_RNK8:
            sprintf(buf, _("attained the rank of %s"), rank_of(rank_to_xlev(absidx - (ACH_RNK1 - 1)),
                            Role_switch(), (achidx < 0) ? TRUE : FALSE))
;
            enlght_line((You_), (final ? (_("")) : (have)), (buf), _(("")));
            break;

        default:
            sprintf(buf, _(" [Unexpected achievement #%d.]"), achidx);
            enlght_out(buf);
            break;
        } /* switch */
    } /* for */

    if (awin != ge.en_win) {
        display_nhwindow()(awin, TRUE);
        destroy_nhwindow()(awin);
    }
    } finally { stack_pop($frame); }
}

/* record an achievement (add at end of list unless already present) */
export function record_achievement(achidx) { /* void */
    let i, absidx;
    let repeat_achievement = 0;

    absidx = abs(achidx);
    /* valid achievements range from 1 to N_ACH-1; however, ranks can be
       stored as the complement (ie, negative) to track gender */
    if ((achidx < 1 && (absidx < ACH_RNK1 || absidx > ACH_RNK8))
        || achidx >= N_ACH) {
        impossible(_("Achievement #%d is out of range."), achidx);
        return;
    }

    /* the list has an extra slot so there is always at least one 0 at
       its end (more than one unless all N_ACH-1 possible achievements
       have been recorded); find first empty slot or achievement #achidx;
       an attempt to duplicate an achievement can happen if any of Bell,
       Candelabrum, Book, or Amulet is dropped then picked up again */
    for (i = 0; chars[u.uachieved + i]; ++i)
        if (abs(chars[u.uachieved + i]) == absidx) {
            repeat_achievement = 1;
            break;
        }

    /*
     * We do the sound for an achievement, even if it has already been
     * achieved before. Some players might have set up level-based
     * theme music or something. We do let the sound interface know
     * that it's not the original achievement though.
     */
      ;

    if (repeat_achievement)
        return; /* already recorded, don't duplicate it */
    chars[u.uachieved + i] = achidx;

    /* avoid livelog for achievements recorded during final disclosure:
       nudist and blind-from-birth; also ascension which is suppressed
       by this gets logged separately in really_done() */
    if (program_state.gameover)
        return;

    if (absidx >= ACH_RNK1 && absidx <= ACH_RNK8) {
        livelog_printf(achieve_msg[absidx].llflag,
                       _("attained the rank of %s (level %d)"),
                       rank_of(rank_to_xlev(absidx - (ACH_RNK1 - 1)),
                               Role_switch(), (achidx < 0) ? TRUE : FALSE),
                       u.ulevel);
    } else if (achidx == ACH_SOKO_PRIZE
               || achidx == ACH_MINE_PRIZE) {
        /* need to supply extra information for these two */
        let otyp = ((achidx == ACH_SOKO_PRIZE)
                      ? svc.context.achieveo.soko_prize_otyp
                      : svc.context.achieveo.mines_prize_otyp);

        /* note: OBJ_NAME() works here because both "bag of holding" and
           "amulet of reflection" are fully named in their objects[] entry
           but that's not true in the general case */
        livelog_printf(achieve_msg[achidx].llflag, _("%s %s"),
                       achieve_msg[achidx].msg, OBJ_NAME(objects[otyp]));
    } else {
        livelog_printf(achieve_msg[absidx].llflag, _("%s"),
                       achieve_msg[absidx].msg);
    }
}

/* discard a recorded achievement; return True if removed, False otherwise */
export function remove_achievement(achidx) { /* boolean */
    let i;

    for (i = 0; chars[u.uachieved + i]; ++i)
        if (abs(chars[u.uachieved + i]) == abs(achidx))
            break; /* stop when found */
    if (!chars[u.uachieved + i]) /* not found */
        return FALSE;
    /* list is 0 terminated so any beyond the removed one move up a slot */
    do {
        chars[u.uachieved + i] = chars[u.uachieved + (i + 1)];
    } while (chars[u.uachieved + (++i)]);
    return TRUE;
}

/* used to decide whether there are any achievements to display */
export function count_achievements() { /* int */
    let i, acnt = 0;

    for (i = 0; chars[u.uachieved + i]; ++i)
        ++acnt;
    return acnt;
}

/* convert a rank index to an achievement number; encode it when female
   in order to subsequently report gender-specific ranks accurately */
export function achieve_rank(rank) { /* schar */ /* 1..8 */
    let achidx = schar(((rank - 1) + ACH_RNK1));

    if (flags.female)
        achidx = -achidx;
    return achidx;
}

/* return True if sokoban branch has been entered, False otherwise */
export function sokoban_in_play() { /* boolean */
    let achidx;

    /* TODO? move this to dungeon.c and test furthest level reached of the
       sokoban branch instead of relying on the entered-sokoban achievement */

    for (achidx = 0; chars[u.uachieved + achidx]; ++achidx)
        if (chars[u.uachieved + achidx] == ACH_SOKO)
            return TRUE;
    return FALSE;
}

/* #chronicle command */
export function do_gamelog() { /* int */
    if (gg.gamelog) {
        show_gamelog(ENL_GAMEINPROGRESS);
    } else {
        pline(_("No chronicled events."));
    }

    return ECMD_OK;
}

/* 'major' events for dumplog; inclusion or exclusion here may need tuning */
export const LL_majors = (0
                   | LL_WISH
                   | LL_ACHIEVE
                   | LL_UMONST
                   | LL_DIVINEGIFT
                   | LL_LIFESAVE
                   | LL_ARTIFACT
                   | LL_GENOCIDE
                   | LL_DUMP);
export function majorevent(llmsg) { return +((llmsg.flags & LL_majors) != 0); }
export function spoilerevent(llmsg) { return +((llmsg.flags & LL_SPOILER) != 0); }

/* #chronicle details */
export function show_gamelog(final) { /* void */
    const $frame = stack_frame(); try {
    let llmsg;
    let win;
    let buf = stack_array(char, BUFSZ);
    let eventcnt = 0;

    win = create_nhwindow()(NHW_TEXT);
    sprintf(buf, _("%s events:"), final ? _("Major") : _("Logged"));
    putstr()(win, 0, buf);
    for (llmsg = gg.gamelog; llmsg; llmsg = llmsg.next) {
        if (final && !majorevent(llmsg))
            continue;
        if (!final && !wizard() && spoilerevent(llmsg))
            continue;
        if (!eventcnt++)
            putstr()(win, 0, _(" Turn"));
        Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%5lld: %s"), llmsg.turn, llmsg.text);
        putstr()(win, 0, buf);
    }
    /* since start of game is logged as a major event, 'eventcnt' should
       never end up as 0; for 'final', end of game is a major event too */
    if (!eventcnt)
        putstr()(win, 0, _(" none"));

    display_nhwindow()(win, TRUE);
    destroy_nhwindow()(win);

    return;
    } finally { stack_pop($frame); }
}

/*
 *      Vanquished monsters.
 */

/* the two uppercase choices are implemented but suppressed from menu.
   also used in options.c */
export const vanqorders = static_array("vanqorders", array_of(ptr_to(char), 3), NUM_VANQ_ORDER_MODES, [
    [ _("t"), _("traditional: by monster level"),
           _("traditional: by monster level, by internal monster index") ],
    [ _("d"), _("by monster difficulty rating"),
           _("by monster difficulty rating, by internal monster index") ],
    [ _("a"), _("alphabetically, unique monsters separate"),
           _("alphabetically, first unique monsters, then others") ],
    [ _("A"), _("alphabetically, unique monsters intermixed"),
           _("alphabetically, unique monsters and others intermixed") ],
    [ _("C"), _("by monster class, high to low level in class"),
           _("by monster class, high to low level within class") ],
    [ _("c"), _("by monster class, low to high level in class"),
           _("by monster class, low to high level within class") ],
    [ _("n"), _("by count, high to low"),
           _("by count, high to low, by internal index within tied count") ],
    [ _("z"), _("by count, low to high"),
           _("by count, low to high, by internal index within tied count") ],
]);

function vanqsort_cmp(
    vptr1,
    vptr2) { /* int QSORTCALLBACK */
    let indx1 = ref_to(short, vptr1)[0], indx2 = ref_to(short, vptr2)[0],
        mlev1, mlev2, mstr1, mstr2, uniq1, uniq2, died1, died2, res;
    let name1, name2, punct;
    let mcls1, mcls2;

    switch (flags.vanq_sortmode) {
    default:
    case VANQ_MLVL_MNDX:
        /* sort by monster level */
        mlev1 = mons[indx1].mlevel;
        mlev2 = mons[indx2].mlevel;
        res = mlev2 - mlev1; /* mlevel high to low */
        break;
    case VANQ_MSTR_MNDX:
        /* sort by monster toughness */
        mstr1 = mons[indx1].difficulty;
        mstr2 = mons[indx2].difficulty;
        res = mstr2 - mstr1; /* monstr high to low */
        break;
    case VANQ_ALPHA_SEP:
        uniq1 = ((mons[indx1].geno & G_UNIQ) && indx1 != PM_HIGH_CLERIC ? 1 : 0);
        uniq2 = ((mons[indx2].geno & G_UNIQ) && indx2 != PM_HIGH_CLERIC ? 1 : 0);
        if (uniq1 ^ uniq2) { /* one or other uniq, but not both */
            res = uniq2 - uniq1;
            break;
        } /* else both unique or neither unique */
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case VANQ_ALPHA_MIX:
        name1 = mons[indx1].pmnames[NEUTRAL];
        name2 = mons[indx2].pmnames[NEUTRAL];
        res = strcmpi(name1, name2); /* caseblind alpha, low to high */
        break;
    case VANQ_MCLS_HTOL:
    case VANQ_MCLS_LTOH:
        /* mons[].mlet is a small integer, 1..N, of type plain char;
           if 'char' happens to be unsigned, (mlet1 - mlet2) would yield
           an inappropriate result when mlet2 is greater than mlet1,
           so force our copies (mcls1, mcls2) to be signed */
        mcls1 = (mons[indx1].mlet);
        mcls2 = (mons[indx2].mlet);
        /* S_ANT through S_ZRUTY correspond to lowercase monster classes,
           S_ANGEL through S_ZOMBIE correspond to uppercase, and various
           punctuation characters are used for classes beyond those */
        if (mcls1 > S_ZOMBIE && mcls2 > S_ZOMBIE) {
            /* force a specific order to the punctuation classes that's
               different from the internal order;
               internal order is ok if neither or just one is punctuation
               since letters have lower values so come out before punct */
            let punctclasses = static_array("vanqsort_cmp.punctclasses", char, null, [
                S_LIZARD, S_EEL, S_GOLEM, S_GHOST, S_DEMON, S_HUMAN, ord('\0')
            ]);

            if ((punct = strchr(punctclasses, mcls1)) != 0)
                mcls1 = schar((S_ZOMBIE + 1 + (punct - punctclasses)));
            if ((punct = strchr(punctclasses, mcls2)) != 0)
                mcls2 = schar((S_ZOMBIE + 1 + (punct - punctclasses)));
        }
        res = mcls1 - mcls2; /* class */
        if (res == 0) {
            /* Riders are in the same class as major demons, yielding res==0
               above when both mcls1 and mcls2 are either Riders or demons or
               one of each; force Riders to be sorted before demons */
            res = is_rider(mons[indx2]) - is_rider(mons[indx1]);
            /* res -1 => #1 is a Rider, #2 isn't;
                    0 => both Riders or neither;
                   +1 => #2 is a Rider, #1 isn't */
            if (res)
                break;
            mlev1 = mons[indx1].mlevel;
            mlev2 = mons[indx2].mlevel;
            res = mlev1 - mlev2; /* mlevel low to high */
            if (flags.vanq_sortmode == VANQ_MCLS_HTOL)
                res = -res; /* mlevel high to low */
        }
        break;
    case VANQ_COUNT_H_L:
    case VANQ_COUNT_L_H:
        died1 = svm.mvitals[indx1].died;
        died2 = svm.mvitals[indx2].died;
        res = died2 - died1; /* dead count high to low */
        if (flags.vanq_sortmode == VANQ_COUNT_L_H)
            res = -res; /* dead count low to high */
        break;
    }
    /* tiebreaker: internal mons[] index */
    if (res == 0)
        res = indx1 - indx2; /* mndx low to high */
    return res;
}

/* returns -1 if cancelled via ESC */
export function set_vanq_order(for_vanq) { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let selected = stack_var(ptr_to(struct_mi));
    let any = stack_struct(struct_any);
    let buf = stack_array(char, BUFSZ);
    let desc;
    let i, n, choice,
        clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany); /* zero out all bits */
    for (i = 0; i < SIZE(vanqorders); i++) {
        if (i == VANQ_ALPHA_MIX || i == VANQ_MCLS_HTOL) /* skip these */
            continue;
        /* suppress some orderings if this menu if for 'm #genocided' */
        if (!for_vanq && (i == VANQ_COUNT_H_L || i == VANQ_COUNT_L_H))
            continue;
        desc = vanqorders[i][2];
        /* unique monsters can't be genocided so "alpha, unique separate"
           and "alpha, unique intermixed" are confusing descriptions when
           this menu is for #genocided rather than for #vanquished */
        if (!for_vanq && i == VANQ_ALPHA_SEP)
            desc = _("alphabetically");
        any.a_int = i + 1;
        add_menu(tmpwin, nul_glyphinfo, any, chars[vanqorders[i][0]], 0,
                 ATR_NONE, clr, desc,
                 (i == flags.vanq_sortmode) ? MENU_ITEMFLAGS_SELECTED
                                            : MENU_ITEMFLAGS_NONE);
    }
    sprintf(buf, _("Sort order for %s"), for_vanq ? _("vanquished monster counts (also genocided types)")
                     : _("genocided monster types (also vanquished counts)"))
;
    end_menu()(tmpwin, buf);

    n = select_menu(tmpwin, PICK_ONE, selected);
    destroy_nhwindow()(tmpwin);
    if (n > 0) {
        choice = ptr_add(selected[0], 0).item.a_int - 1;
        /* skip preselected entry if we have more than one item chosen */
        if (n > 1 && choice == flags.vanq_sortmode)
            choice = ptr_add(selected[0], 1).item.a_int - 1;
        free(addr_of(selected[0]));
        flags.vanq_sortmode = uchar(choice);
    }
    return (n < 0) ? -1 : flags.vanq_sortmode;
    } finally { stack_pop($frame); }
}

/* #vanquished command */
export function dovanquished() { /* int */
    list_vanquished(iflags.menu_requested ? ord('A') : ord('y'), FALSE);
    iflags.menu_requested = FALSE;
    return ECMD_OK;
}

/* high priests aren't unique but are flagged as such to simplify something */
export function UniqCritterIndx(mndx) { return +((mons[mndx].geno & G_UNIQ) != 0 && mndx != PM_HIGH_CLERIC); }

/* used for #vanquished and end of game disclosure and end of game dumplog */
export function list_vanquished(defquery, ask) { /* void */
    const $frame = stack_frame(); try {
    let i;
    let pfx, nkilled;
    let ntypes, ni;
    let total_killed = 0;
    let klwin;
    let mindx = stack_array(short, NUMMONS);
    let c, buf = stack_array(char, BUFSZ), buftoo = stack_array(char, BUFSZ);
    /* 'A' is only supplied by 'm #vanquished'; 'd' is only supplied by
       dump_everything() when writing dumplog, so won't happen if built
       without '#define DUMPLOG' but there's no need for conditionals here */
    let force_sort = +(defquery == ord('A')),
            dumping = +(defquery == ord('d'));

    /* normally we don't ask about sort order for the vanquished list unless
       it contains at least two entries; however, if player has used explicit
       'm #vanquished', choose order no matter what it contains so far */
    if (force_sort) { /* iflags.menu_requested via dovanquished() */
        /* choose value for vanq_sortmode via menu; ESC cancels choosing
           sort order but continues with vanquishd monsters display */
        set_vanq_order(TRUE);
    }
    if (dumping || force_sort) {
        /* switch from 'A' or 'd' to 'y'; 'ask' is already False for the
           cases that might supply 'A' or 'd' */
        defquery = ord('y');
        ask = FALSE; /* redundant */
    }

    /* get totals first */
    ntypes = 0;
    for (i = LOW_PM; i < NUMMONS; i++) {
        if ((nkilled = (svm.mvitals[i].died)) == 0)
            continue;
        mindx[ntypes++] = i;
        total_killed += nkilled;
    }

    /* vanquished creatures list;
     * includes all dead monsters, not just those killed by the player
     */
    if (ntypes != 0) {
        let mlet, prev_mlet = 0; /* used as small integer, not character */
        let class_header, uniq_header, Rider,
                was_uniq = FALSE, special_hdr = FALSE;

        if (ask) {
            let allow_yn = stack_array(char, 10);

            if (ntypes > 1) {
                strcpy(allow_yn, ynaqchars);
            } else {
                strcpy(allow_yn, ynqchars); /* don't include 'a', but */
                strcat(allow_yn, _("\x1ba"));  /* allow user to answer 'a' */
                if (defquery == ord('a')) /* potential default from 'disclose' */
                    defquery = ord('y');
            }
            c = yn_function(_("Do you want an account of creatures vanquished?"),
                            allow_yn, defquery, TRUE);
        } else {
            c = defquery;
        }

        if (c == ord('q'))
            program_state.stopprint++;
        if (c == ord('y') || c == ord('a')) {
            if (c == ord('a') && ntypes > 1) { /* ask user to choose sort order */
                /* choose value for vanq_sortmode via menu; ESC cancels list
                   of vanquished monsters but does not set 'done_stopprint' */
                if (set_vanq_order(TRUE) < 0)
                    return;
            }
            uniq_header = +(flags.vanq_sortmode == VANQ_ALPHA_SEP);
            class_header = +((flags.vanq_sortmode == VANQ_MCLS_LTOH
                             || flags.vanq_sortmode == VANQ_MCLS_HTOL)
                            && ntypes > 1);

            klwin = create_nhwindow()(NHW_MENU);
            putstr()(klwin, 0, _("Vanquished creatures:"));
            if (!dumping)
                putstr()(klwin, 0, _(""));

            qsort(addr_of(mindx), ntypes, sizeof(short), vanqsort_cmp);
            for (ni = 0; ni < ntypes; ni++) {
                i = mindx[ni];
                nkilled = svm.mvitals[i].died;
                Rider = is_rider(mons[i]);
                mlet = mons[i].mlet;
                if (class_header
                    && (mlet != prev_mlet || (special_hdr && !Rider))) {
                    if (!Rider) {
                        strcpy(buf, def_monsyms[mlet].explain);
                        special_hdr = FALSE;
                    } else {
                        strcpy(buf, _("Rider"));
                        special_hdr = TRUE;
                    }
                    /* 'ask' implies final disclosure, where highlighting
                       of various header lines is suppressed */
                    putstr()(klwin, ask ? ATR_NONE : iflags.menu_headings.attr,
                           upstart(buf));
                    prev_mlet = mlet;
                }
                if (UniqCritterIndx(i)) {
                    sprintf(buf, _("%s%s"), !type_is_pname(mons[i]) ? _("the ") : _(""), mons[i].pmnames[NEUTRAL])

;
                    if (nkilled > 1)
                        sprintf(eos(buf), _(" (%s)"), N_times(nkilled, buftoo))
;
                    was_uniq = TRUE;
                } else {
                    if (uniq_header && was_uniq) {
                        putstr()(klwin, 0, _(""));
                        was_uniq = FALSE;
                    }
                    /* trolls or undead might have come back,
                       but we don't keep track of that */
                    if (nkilled == 1)
                        strcpy(buf, an(mons[i].pmnames[NEUTRAL]));
                    else
                        sprintf(buf, _("%3d %s"), nkilled, makeplural(mons[i].pmnames[NEUTRAL]))
;
                }
                /* number of leading spaces to match 3 digit prefix */
                pfx = !strncmpi(buf, _("the "), 4) ? 0
                      : !strncmpi(buf, _("an "), 3) ? 1
                        : !strncmpi(buf, _("a "), 2) ? 2
                          : !digit(chars[buf + 2]) ? 4 : 0;
                if (class_header)
                    ++pfx;
                Snprintf(buftoo, sizeof(array_of(char, BUFSZ)), _("%*s%s"), pfx, _(""), buf);
                putstr()(klwin, 0, buftoo);
            }
            /*
             * if (Hallucination)
             *     putstr(klwin, 0, "and a partridge in a pear tree");
             */
            if (ntypes > 1) {
                if (!dumping)
                    putstr()(klwin, 0, _(""));
                sprintf(buf, _("%lld creatures vanquished."), total_killed);
                putstr()(klwin, 0, buf);
            }
            display_nhwindow()(klwin, TRUE);
            destroy_nhwindow()(klwin);
        }

    /*
     * For end-of-game disclosure, we're only called when some monsters
     * were vanquished and won't reach these 'else-if's.
     *
     * If no monsters have been vanquished, we're either called for game
     * still in progress, so use present tense via pline(), or for dumplog
     * which needs putstr() and past tense.
     */
    } else if (!program_state.gameover) {
        /* #vanquished rather than final disclosure, so pline() is ok */
        pline(_("No creatures have been vanquished."));
    }
    } finally { stack_pop($frame); }
}

/* number of monster species which have been genocided */
export function num_genocides() { /* int */
    let i, n = 0;

    for (i = LOW_PM; i < NUMMONS; ++i) {
        if (svm.mvitals[i].mvflags & G_GENOD) {
            ++n;
            if (UniqCritterIndx(i))
                impossible(_("unique creature '%d: %s' genocided?"),
                           i, mons[i].pmnames[NEUTRAL]);
        }
    }
    return n;
}

/* return a count of the number of extinct species */
function num_extinct() { /* int */
    let i, n = 0;

    for (i = LOW_PM; i < NUMMONS; ++i) {
        if (UniqCritterIndx(i))
            continue;
        if ((svm.mvitals[i].mvflags & G_GONE) == G_EXTINCT)
            ++n;
    }
    return n;
}

/* collect both genocides and extinctions, skipping uniques */
function num_gone(mvflags, mindx) { /* int */
    let mflg = uchar(mvflags);
    let i, n = 0;

    memset(addr_of(mindx), 0, NUMMONS * sizeof(int));

    for (i = LOW_PM; i < NUMMONS; ++i) {
        /* uniques can't be genocided but can become extinct;
           however, they're never reported as extinct, so skip them */
        if (UniqCritterIndx(i))
            continue;

        if ((svm.mvitals[i].mvflags & mflg) != 0)
            mindx[n++] = i;
    }
    return n;
}

/* show genocided and extinct monster types for final disclosure/dumplog
   or for the #genocided command */
export function list_genocided(defquery, ask) { /* void */
    const $frame = stack_frame(); try {
    let i, mndx;
    let ngenocided, nextinct, ngone, mvflags, mindx = stack_array(int, NUMMONS);
    let c;
    let klwin;
    let buf = stack_array(char, BUFSZ);
    let genoing,
            dumping; /* for DUMPLOG; doesn't need to be conditional */
    let both = (program_state.gameover || wizard() || discover() ? 1 : 0);

    dumping = +(defquery == ord('d'));
    genoing = +(defquery == ord('g'));
    if (dumping || genoing)
        defquery = ord('y');
    if (genoing)
        both = FALSE; /* genocides only, not extinctions */

    /* this goes through the whole monster list up to three times but will
       happen rarely and is simpler than a more general single pass check;
       extinctions are only revealed during end of game disclosure or when
       running in wizard or explore mode */
    ngenocided = num_genocides();
    nextinct = both ? num_extinct() : 0;
    mvflags = G_GENOD | (both ? G_EXTINCT : 0);
    ngone = num_gone(mvflags, mindx);

    /* genocided or extinct species list */
    if (ngone > 0) {
        sprintf(buf, _("Do you want a list of %sspecies%s%s?"), (nextinct && !ngenocided) ? _("extinct ") : _(""), ngenocided ? _(" genocided") : _(""), (nextinct && ngenocided) ? _(" and extinct") : _(""))

;
        c = ask ? yn_function(buf, (ngone > 1) ? _("ynaq") : _("ynq\x1ba"),
                              defquery, TRUE)
                : defquery;
        if (c == ord('q'))
            program_state.stopprint++;
        if (c == ord('y') || c == ord('a')) {
            let save_sortmode;
            let mlet, prev_mlet = 0;
            let class_header = FALSE;

            if (ngone > 1) {
                if (c == ord('a')) { /* ask player to choose sort order */
                    /* #genocided shares #vanquished's sort order */
                    if (set_vanq_order(FALSE) < 0)
                        return;
                }
                /* sort orderings count-high-to-low or count-low-to-high
                   don't make sense for genocides; if the preferred order
                   to set to either of those, use alphabetical instead;
                   note: the tie breaker for by-class is level-high-to-low
                   or level-low-to-high rather than count so is ok as-is */
                save_sortmode = flags.vanq_sortmode;
                if (flags.vanq_sortmode == VANQ_COUNT_H_L
                    || flags.vanq_sortmode == VANQ_COUNT_L_H)
                    flags.vanq_sortmode = VANQ_ALPHA_MIX;
                nh_deterministic_qsort((addr_of(mindx)), unsigned((ngone)), (sizeof(int)), (vanqsort_cmp))
;
                class_header = +(flags.vanq_sortmode == VANQ_MCLS_LTOH
                                || flags.vanq_sortmode == VANQ_MCLS_HTOL);
                flags.vanq_sortmode = uchar(save_sortmode);
            }

            klwin = create_nhwindow()(NHW_MENU);
            sprintf(buf, _("%s%s species:"), ngenocided ? _("Genocided") : _("Extinct"), (nextinct && ngenocided) ? _(" or extinct") : _(""))

;
            putstr()(klwin, 0, buf);
            if (!dumping)
                putstr()(klwin, 0, _(""));

            for (i = 0; i < ngone; ++i) {
                mndx = mindx[i];
                mlet = mons[mndx].mlet;
                if (class_header && mlet != prev_mlet) {
                    strcpy(buf, def_monsyms[mlet].explain);
                    /* 'ask' implies final disclosure, where highlighting
                       of various header lines is suppressed */
                    putstr()(klwin, ask ? ATR_NONE : iflags.menu_headings.attr,
                           upstart(buf));
                    prev_mlet = mlet;
                }
                sprintf(buf, _(" %s"), makeplural(mons[mndx].pmnames[NEUTRAL]));
                /*
                 * "Extinct" is unfortunate terminology.  A species
                 * is marked extinct when its birth limit is reached,
                 * but there might be members of the species still
                 * alive, contradicting the meaning of the word.
                 *
                 * We only append "(extinct)" if the G_GENOD bit is
                 * clear.  During normal play, 'mndx' won't be in the
                 * collected list unless that bit is set.
                 */
                if ((svm.mvitals[mndx].mvflags & G_GONE) == G_EXTINCT)
                    strcat(buf, _(" (extinct)"));
                putstr()(klwin, 0, buf);
            }
            if (!dumping)
                putstr()(klwin, 0, _(""));
            if (ngenocided > 0) {
                sprintf(buf, _("%d species genocided."), ngenocided);
                putstr()(klwin, 0, buf);
            }
            if (nextinct > 0) {
                sprintf(buf, _("%d species extinct."), nextinct);
                putstr()(klwin, 0, buf);
            }

            display_nhwindow()(klwin, TRUE);
            destroy_nhwindow()(klwin);
        }

    /* See the comment for similar code near the end of list_vanquished(). */
    } else if (!program_state.gameover) {
        /* #genocided rather than final disclosure, so pline() is ok and
           extinction has been ignored */
        pline(_("No creatures have been genocided%s."), genoing ? _(" yet") : _(""));
    }
    } finally { stack_pop($frame); }
}

/* M-g - #genocided command */
export function dogenocided() { /* int */
    list_genocided(iflags.menu_requested ? ord('a') : ord('y'), FALSE);
    return ECMD_OK;
}

/* #wizborn extended command */
export function doborn() { /* int */
    const $frame = stack_frame(); try {
    let fmt = init_string(static_array("doborn.fmt", char, sizeof_string("%4i %4i %c %-30s")), _("%4i %4i %c %-30s"), true);
    let i;
    let datawin = create_nhwindow()(NHW_TEXT);
    let buf = stack_array(char, BUFSZ);
    let nborn = 0, ndied = 0;

    putstr()(datawin, 0, _("died born"));
    for (i = LOW_PM; i < NUMMONS; i++)
        if (svm.mvitals[i].born || svm.mvitals[i].died
            || (svm.mvitals[i].mvflags & G_GONE) != 0) {
            sprintf(buf, fmt, svm.mvitals[i].died, svm.mvitals[i].born, ((svm.mvitals[i].mvflags & G_GONE) == G_EXTINCT) ? ord('E')
                    : ((svm.mvitals[i].mvflags & G_GONE) == G_GENOD) ? ord('G')
                      : ((svm.mvitals[i].mvflags & G_GONE) != 0) ? ord('X')
                        : ord(' '), mons[i].pmnames[NEUTRAL])

;
            putstr()(datawin, 0, buf);
            nborn += svm.mvitals[i].born;
            ndied += svm.mvitals[i].died;
        }

    putstr()(datawin, 0, _(""));
    sprintf(buf, fmt, ndied, nborn, ord(' '), _(""));

    display_nhwindow()(datawin, FALSE);
    destroy_nhwindow()(datawin);

    return ECMD_OK;
    } finally { stack_pop($frame); }
}

/*
 * align_str(), piousness(), mstatusline() and ustatusline() once resided
 * in pline.c, then got moved to priest.c just to be out of there.  They
 * fit better here.
 */

export function align_str(alignment) { /* const char * */
    switch (alignment) {
    case A_CHAOTIC:
        return _("chaotic");
    case A_NEUTRAL:
        return _("neutral");
    case A_LAWFUL:
        return _("lawful");
    case A_NONE:
        return _("unaligned");
    }
    return _("unknown");
}

function size_str(msize) { /* char * */
    let outbuf = static_array("size_str.outbuf", char, 40);

    switch (msize) {
    case MZ_TINY:
        strcpy(outbuf, _("tiny"));
        break;
    case MZ_SMALL:
        strcpy(outbuf, _("small"));
        break;
    case MZ_MEDIUM:
        strcpy(outbuf, _("medium"));
        break;
    case MZ_LARGE:
        strcpy(outbuf, _("large"));
        break;
    case MZ_HUGE:
        strcpy(outbuf, _("huge"));
        break;
    case MZ_GIGANTIC:
        strcpy(outbuf, _("gigantic"));
        break;
    default:
        sprintf(outbuf, _("unknown size (%d)"), msize);
        break;
    }
    return outbuf;
}

/* used for self-probing */
export function piousness(showneg, suffix) { /* char * */
    let buf = static_array("piousness.buf", char, 32); /* bigger than "insufficiently neutral" */
    let pio;

    /* note: piousness 20 matches MIN_QUEST_ALIGN (quest.h) */
    if (u.ualign.record >= 20)
        pio = _("piously");
    else if (u.ualign.record > 13)
        pio = _("devoutly");
    else if (u.ualign.record > 8)
        pio = _("fervently");
    else if (u.ualign.record > 3)
        pio = _("stridently");
    else if (u.ualign.record == 3)
        pio = _("");
    else if (u.ualign.record > 0)
        pio = _("haltingly");
    else if (u.ualign.record == 0)
        pio = _("nominally");
    else if (!showneg)
        pio = _("insufficiently");
    else if (u.ualign.record >= -3)
        pio = _("strayed");
    else if (u.ualign.record >= -8)
        pio = _("sinned");
    else
        pio = _("transgressed");

    sprintf(buf, _("%s"), pio);
    if (suffix && (!showneg || u.ualign.record >= 0)) {
        if (u.ualign.record != 3)
            strcat(buf, _(" "));
        strcat(buf, suffix);
    }
    return buf;
}

/* stethoscope or probing applied to monster -- one-line feedback */
export function mstatusline(mtmp) { /* void */
    const $frame = stack_frame(); try {
    let alignment = mon_aligntyp(mtmp);
    let info = stack_array(char, BUFSZ), monnambuf = stack_array(char, BUFSZ);

    chars[info + 0] = 0;
    if (mtmp.mtame) {
        strcat(info, _(", tame"));
        if (wizard()) {
            sprintf(eos(info), _(" (%d"), mtmp.mtame);
            if (!mtmp.isminion)
                sprintf(eos(info), _("; hungry %lld; apport %d"), EDOG(mtmp).hungrytime, EDOG(mtmp).apport)
;
            strcat(info, _(")"));
        }
    } else if (mtmp.mpeaceful)
        strcat(info, _(", peaceful"));

    if (mtmp.data == mons[PM_LONG_WORM]) {
        let segndx, nsegs = count_wsegs(mtmp);

        /* the worm code internals don't consider the head to be one of
           the worm's segments, but we count it as such when presenting
           worm feedback to the player */
        if (!nsegs) {
            strcat(info, _(", single segment"));
        } else {
            ++nsegs; /* include head in the segment count */
            segndx = wseg_at(mtmp, gb.bhitpos.x, gb.bhitpos.y);
            sprintf(eos(info), _(", %d%s of %d segments"), segndx, ordin(segndx), nsegs)
;
        }
    }
    if (ismnum(mtmp.cham) && mtmp.data != mons[mtmp.cham])
        /* don't reveal the innate form (chameleon, vampire, &c),
           just expose the fact that this current form isn't it */
        strcat(info, _(", shapechanger"));
    /* pets eating mimic corpses mimic while eating, so this comes first */
    if (mtmp.meating)
        strcat(info, _(", eating"));
    /* a stethoscope exposes mimic before getting here so this
       won't be relevant for it, but wand of probing doesn't */
    if (mtmp.mundetected || mtmp.m_ap_type
        || visible_region_at(gb.bhitpos.x, gb.bhitpos.y))
        mhidden_description(mtmp,
                       MHID_PREFIX | MHID_ARTICLE | MHID_ALTMON | MHID_REGION,
                            eos(info));
    if (mtmp.mcan)
        strcat(info, _(", cancelled"));
    if (mtmp.mconf)
        strcat(info, _(", confused"));
    if (mtmp.mblinded || !mtmp.mcansee)
        strcat(info, _(", blind"));
    if (mtmp.mstun)
        strcat(info, _(", stunned"));
    if (mtmp.msleeping)
        strcat(info, _(", asleep"));

    else if (mtmp.mfrozen || !mtmp.mcanmove)
        strcat(info, _(", can't move"));

    /* [arbitrary reason why it isn't moving] */
    else if ((mtmp.mstrategy & STRAT_WAITMASK) != 0)
        strcat(info, _(", meditating"));
    if (mtmp.mflee)
        strcat(info, _(", scared"));
    if (mtmp.mtrapped)
        strcat(info, _(", trapped"));
    if (mtmp.mspeed)
        strcat(info, (mtmp.mspeed == MFAST) ? _(", fast")
                      : (mtmp.mspeed == MSLOW) ? _(", slow")
                         : _(", [? speed]"));
    if (mtmp.minvis)
        strcat(info, _(", invisible"));
    if (mtmp == u.ustuck) {
        let pm = u.ustuck.data;

        /* being swallowed/engulfed takes priority over sticks(youmonst);
           this used to have that backwards and checked sticks() first */
        strcat(info, u.uswallow ? (digests(pm)
                                   ? _(", digesting you")
                                   /* note: the "swallowing you" case won't
                                      happen because all animal engulfers
                                      either digest their victims (purple
                                      worm) or enfold them (trappers and
                                      lurkers above) */
                                   : (is_animal(pm) && !enfolds(pm))
                                     ? _(", swallowing you")
                                     : _(", engulfing you"))
                     /* !u.uswallow; if both youmonst and ustuck are holders,
                        youmonst wins */
                     : (!sticks(gy.youmonst.data) ? _(", holding you")
                                                 : _(", held by you")));
    }
    if (mtmp == u.usteed) {
        strcat(info, _(", carrying you"));
        if (Wounded_legs()) {
            /* EWounded_legs is used to track left/right/both rather than
               some form of extrinsic impairment; HWounded_legs is used for
               timeout; both apply to steed instead of hero when mounted */
            let legs = (EWounded_legs() & BOTH_SIDES);
            let what = mbodypart(mtmp, LEG);

            if (legs == BOTH_SIDES)
                what = makeplural(what);
            sprintf(eos(info), _(", injured %s"), what);
        }
    }
    if (mtmp.mleashed)
        strcat(info, _(", leashed"));

    /* avoid "Status of the invisible newt ..., invisible" */
    /* and unlike a normal mon_nam, use "saddled" even if it has a name */
    strcpy(monnambuf, x_monnam(mtmp, ARTICLE_YOUR, 0,
                               (SUPPRESS_IT | SUPPRESS_INVISIBLE), FALSE));

    pline(_("Status of %s (%s, %s):  Level %d  HP %d(%d)  AC %d%s."),
          monnambuf, align_str(alignment), size_str(mtmp.data.msize),
          mtmp.m_lev, mtmp.mhp, mtmp.mhpmax, find_mac(mtmp), info);
    } finally { stack_pop($frame); }
}

/* stethoscope or probing applied to hero -- one-line feedback */
export function ustatusline() { /* void */
    const $frame = stack_frame(); try {
    let reg;
    let info = stack_array(char, BUFSZ);
    let ln;

    chars[info + 0] = ord('\0');
    if (Sick()) {
        strcat(info, _(", dying from"));
        if (u.usick_type & SICK_VOMITABLE)
            strcat(info, _(" food poisoning"));
        if (u.usick_type & SICK_NONVOMITABLE) {
            if (u.usick_type & SICK_VOMITABLE)
                strcat(info, _(" and"));
            strcat(info, _(" illness"));
        }
    }
    if (Stoned())
        strcat(info, _(", solidifying"));
    if (Slimed())
        strcat(info, _(", becoming slimy"));
    if (Strangled())
        strcat(info, _(", being strangled"));
    if (Vomiting())
        strcat(info, _(", nauseated")); /* !"nauseous" */
    if (Confusion())
        strcat(info, _(", confused"));
    if (Blind()) {
        strcat(info, _(", blind"));
        if (u.ucreamed) {
            if (u.ucreamed < BlindedTimeout() || Blindfolded()
                || !haseyes(gy.youmonst.data))
                strcat(info, _(", cover"));
            strcat(info, _("ed by sticky goop"));
        } /* note: "goop" == "glop"; variation is intentional */
    }
    if (Stunned())
        strcat(info, _(", stunned"));
    if (Wounded_legs() && !u.usteed) {
        /* EWounded_legs is used to track left/right/both rather than some
           form of extrinsic impairment; HWounded_legs is used for timeout;
           both apply to steed instead of hero when mounted */
        let legs = (EWounded_legs() & BOTH_SIDES);
        let what = body_part(LEG);

        if (legs == BOTH_SIDES)
            what = makeplural(what);
        /* when it's just one leg, ^X reports which, left or right;
           ustatusline() doesn't, in order to keep the output a bit shorter */
        sprintf(eos(info), _(", injured %s"), what);
    }
    if (Glib())
        sprintf(eos(info), _(", slippery %s"), fingers_or_gloves(TRUE));
    if (u.utrap)
        strcat(info, _(", trapped"));
    if (Fast())
        strcat(info, Very_fast() ? _(", very fast") : _(", fast"));
    if (u.uundetected)
        strcat(info, _(", concealed"));
    else if (U_AP_TYPE() != M_AP_NOTHING)
        strcat(info, _(", disguised"));
    if (Invis())
        strcat(info, _(", invisible"));
    if (u.ustuck) {
        if (u.uswallow)
            strcat(info, digests(u.ustuck.data) ? _(", being digested by ")
                                                 : _(", engulfed by "));
        else if (!sticks(gy.youmonst.data))
            strcat(info, _(", held by "));
        else
            strcat(info, _(", holding "));
        /* FIXME? a_monnam() uses x_monnam() which has a special case that
           forces "the" instead of "a" when formatting u.ustuck while hero
           is swallowed; we don't really want that here but it isn't worth
           fiddling with just for self-probing while engulfed */
        strcat(info, a_monnam(u.ustuck));
    }
    if (!u.uswallow
        && (reg = visible_region_at(u.ux, u.uy)) != null
        && (ln = strlen(info)) < sizeof(array_of(char, BUFSZ)))
        Snprintf(eos(info), unsigned(sizeof(array_of(char, BUFSZ)) - ln), _(", in a cloud of %s"), reg_damg(reg) ? _("poison gas") : _("vapor"))
;

    pline(_("Status of %s (%s):  Level %d  HP %d(%d)  AC %d%s."), svp.plname,
          piousness(FALSE, align_str(u.ualign.type)),
          Upolyd() ? mons[u.umonnum].mlevel : u.ulevel, Upolyd() ? u.mh : u.uhp,
          Upolyd() ? u.mhmax : u.uhpmax, u.uac, info);
    } finally { stack_pop($frame); }
}

/* for 'onefile' processing where end of this file isn't necessarily the
   end of the source code seen by the compiler */

/*insight.c*/

import { A_CHAOTIC, A_LAWFUL, A_NEUTRAL, A_NONE } from "./align.h.js";
import { ART_OGRESMASHER } from "./artilist.h.js";
import { A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS } from "./attrib.h.js";
import { ABASE, ACURR, AMAX, ATTRMAX, STR18 } from "./attrib.h.macros.js";
import { NO_COLOR } from "./color.h.js";
import { something } from "./decl.h.macros.js";
import {
    MAXOCLASSES, S_DEMON, S_EEL, S_GHOST, S_GOLEM, S_HUMAN, S_LIZARD, S_ZOMBIE,
} from "./defsym.h.js";
import { In_endgame, Is_bigroom, Is_knox, Is_rogue_level } from "./dungeon.h.macros.js";
import { FULL_MOON, NEW_MOON } from "./flag.h.js";
import { discover, wizard } from "./flag.h.macros.js";
import {
    BUFSZ, FALSE, LL_ACHIEVE, LL_ARTIFACT, LL_DIVINEGIFT, LL_DUMP, LL_GENOCIDE, LL_LIFESAVE,
    LL_MINORAC, LL_SPOILER, LL_UMONST, LL_WISH, QBUFSZ, TRUE,
} from "./global.h.js";
import { strcmpi } from "./global.h.macros.js";
import {
    ARTICLE_THE, ARTICLE_YOUR, BASICENLIGHTENMENT, ECMD_OK, ENL_GAMEINPROGRESS, ENL_GAMEOVERALIVE,
    ENL_GAMEOVERDEAD, EXT_ENCUMBER, HANDED, HVY_ENCUMBER, LEG, MAGICENLIGHTENMENT, MHID_ALTMON,
    MHID_ARTICLE, MHID_PREFIX, MHID_REGION, MOD_ENCUMBER, NUM_VANQ_ORDER_MODES, OVERLOADED,
    SLT_ENCUMBER, SUPPRESS_HALLUCINATION, SUPPRESS_INVISIBLE, SUPPRESS_IT, SUPPRESS_SADDLE,
    UNENCUMBERED, VANQ_ALPHA_MIX, VANQ_ALPHA_SEP, VANQ_COUNT_H_L, VANQ_COUNT_L_H, VANQ_MCLS_HTOL,
    VANQ_MCLS_LTOH, VANQ_MLVL_MNDX, VANQ_MSTR_MNDX,
} from "./hack.h.js";
import { plur, qsort } from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { explicitdebug } from "./lint.h.macros.js";
import { EDOG, MGIVENNAME, has_mgivenname } from "./mextra.h.macros.js";
import { AD_ACID, AD_COLD, AD_DGST, AD_DISN, AD_ELEC, AD_FIRE } from "./monattk.h.js";
import {
    digests, enfolds, haseyes, hides_under, is_animal, is_clinger, is_female, is_male, is_neuter,
    is_rider, lays_eggs, type_is_pname,
} from "./mondata.h.macros.js";
import {
    FEMALE, G_EXTINCT, G_GENOD, G_GONE, G_UNIQ, M2_DEMON, M2_ELF, M2_HUMAN, M2_ORC, MALE,
    MZ_GIGANTIC, MZ_HUGE, MZ_LARGE, MZ_MEDIUM, MZ_SMALL, MZ_TINY, NEUTRAL,
} from "./monflag.h.js";
import {
    MFAST, MSLOW, M_AP_FURNITURE, M_AP_MONSTER, M_AP_NOTHING, M_AP_OBJECT, STRAT_WAITMASK,
} from "./monst.h.js";
import { U_AP_TYPE, ismnum, vampshifted } from "./monst.h.macros.js";
import { LOW_PM, NUMMONS, PM_GREEN_SLIME, PM_HIGH_CLERIC, PM_LONG_WORM } from "./monsters.h.js";
import { is_ammo, is_wet_towel, u_wield_art } from "./obj.h.macros.js";
import { OBJ_NAME, is_metallic } from "./objclass.h.macros.js";
import {
    AMULET_OF_GUARDING, DUNCE_CAP, GAUNTLETS_OF_POWER, LUCKSTONE, RIN_ADORNMENT, RIN_PROTECTION,
    RIN_SUSTAIN_ABILITY, ROBE, SHIELD_OF_REFLECTION,
} from "./objects.h.js";
import {
    ACID_RES, ADORNED, AGGRAVATE_MONSTER, ANTIMAGIC, BLINDED, BLND_RES, BOTH_SIDES, CLAIRVOYANT,
    COLD_RES, CONFLICT, DEAF, DISINT_RES, DISPLACED, DRAIN_RES, FAST, FIRE_RES, FIXED_ABIL, FLYING,
    FREE_ACTION, FROMFORM, FROMOUTSIDE, FUMBLING, HALF_PHDAM, HALF_SPDAM, HALLUC_RES, HUNGER,
    INFRAVISION, INTRINSIC, INVIS, INVULNERABLE, I_SPECIAL, JUMPING, LEFT_SIDE, LEVITATION,
    MAGICAL_BREATHING, PASSES_WALLS, POISON_RES, POLYMORPH, POLYMORPH_CONTROL,
    PROT_FROM_SHAPE_CHANGERS, REFLECTING, REGENERATION, SEARCHING, SEE_INVIS, SHOCK_RES, SICK_RES,
    SLEEPY, SLEEP_RES, SLOW_DIGESTION, STEALTH, STONE_RES, STRANGLED, SWIMMING, TELEPAT, TELEPORT,
    TELEPORT_CONTROL, TIMEOUT, UNCHANGING, WARNING, WARN_OF_MON, WARN_UNDEAD, WWALKING, W_AMUL,
    W_ARMOR, W_RING, W_SADDLE, W_TOOL,
} from "./prop.h.js";
import { P_ISRESTRICTED, P_NONE, P_SKILLED, P_TWO_WEAPON_COMBAT, P_UNSKILLED } from "./skills.h.js";
import { P_SKILL } from "./skills.h.macros.js";
import { NO_SPELL } from "./spell.h.js";
import { spellid } from "./spell.h.macros.js";
import { SPIKED_PIT } from "./trap.h.js";
import {
    create_nhwindow, destroy_nhwindow, display_nhwindow, end_menu, putstr, start_menu,
} from "./winprocs.h.macros.js";
import {
    ATR_NONE, MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, MENU_ITEMFLAGS_SELECTED, NHW_MENU,
    NHW_TEXT, PICK_NONE, PICK_ONE, WIN_ERR, struct_any, struct_mi,
} from "./wintype.h.js";
import {
    ACH_AMUL, ACH_ASTR, ACH_BELL, ACH_BGRM, ACH_BLND, ACH_BOOK, ACH_CNDL, ACH_ENDG, ACH_HELL,
    ACH_INVK, ACH_MEDU, ACH_MINE, ACH_MINE_PRIZE, ACH_NOVL, ACH_NUDE, ACH_ORCL, ACH_RNK1, ACH_RNK2,
    ACH_RNK3, ACH_RNK4, ACH_RNK5, ACH_RNK6, ACH_RNK7, ACH_RNK8, ACH_SHOP, ACH_SOKO, ACH_SOKO_PRIZE,
    ACH_TMPL, ACH_TOWN, ACH_TUNE, ACH_UWIN, AC_MAX, A_CURRENT, A_ORIGINAL, N_ACH, ROLE_FEMALE,
    ROLE_GENDMASK, ROLE_MALE, SICK_NONVOMITABLE, SICK_VOMITABLE, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA,
    TT_PIT,
} from "./you.h.js";
import { Luck, Role_switch, URIGHTY, Upolyd } from "./you.h.macros.js";
import {
    Acid_resistance, Adornment, Aggravate_monster, Amphibious, Antimagic, BBlinded, BClairvoyant,
    BFlying, BInvis, BLevitation, BStealth, Blind, Blind_telepat, BlindedTimeout, Blindfolded,
    Blindfolded_only, Blnd_resist, Breathless, Clairvoyant, Cold_resistance, Conflict, Confusion,
    Deaf, Detect_monsters, Disint_resistance, Displaced, Drain_resistance, EBlinded, EClairvoyant,
    EInvis, EStealth, EWounded_legs, Fast, Fire_resistance, Fixed_abil, Flying, Free_action,
    Fumbling, Glib, HBlinded, HClairvoyant, HDetect_monsters, HInvis, HProtection, HSleepy,
    HStealth, Half_gas_damage, Half_physical_damage, Half_spell_damage, Halluc_resistance,
    Hallucination, Hate_silver, Hunger, Infravision, Invis, Invisible, Invulnerable, Jumping,
    Lev_at_will, Levitation, Lifesaved, Passes_walls, PermaBlind, Poison_resistance, Polymorph,
    Polymorph_control, Protection, Protection_from_shape_changers, Punished, Reflecting,
    Regeneration, Searching, See_invisible, Shock_resistance, Sick, Sick_resistance,
    Sleep_resistance, Sleepy, Slimed, Slow_digestion, Stealth, Stone_resistance, Stoned, Strangled,
    Stunned, Swimming, Teleport_control, Teleportation, Unchanging, Undead_warning, Underwater,
    Very_fast, Vomiting, Warn_of_mon, Warning, Wounded_legs, Wwalking,
} from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import {
    char, int, long, ord, schar, short, sizeof, sizeof_string, uchar, unsigned,
} from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import {
    abs, assert, free, memset, sprintf, strcat, strchr, strcmp, strcpy, strlen, strncmp,
} from "../rt/libc.js";
import { init_string, stack_array, stack_struct, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, array_of, ptr_add, ptr_to, ref_to, struct, struct_assign } from "../rt/struct.js";
import { timet_delta } from "./allmain.js";
import { attrname, from_what, stone_luck } from "./attrib.js";
import { enc_stat, rank_of, rank_to_xlev } from "./botl.js";
import { getnow, midnight, night } from "./calendar.js";
import { yn_function } from "./cmd.js";
import { is_lava, is_pool, is_pool_or_lava } from "./dbridge.js";
import {
    cg, flags, ga, gb, ge, gf, gg, gi, gu, gy, iflags, program_state, svc, svd, svk, svl, svm, svp,
    u, urealtime, ynaqchars, ynqchars,
} from "./decl.js";
import { nul_glyphinfo } from "./display.js";
import { a_monnam, hliquid, pmname, x_monnam } from "./do_name.js";
import { find_ac, fingers_or_gloves, stuck_ring } from "./do_wear.js";
import { def_monsyms } from "./drawing.js";
import {
    In_quest, ceiling, depth, dunlev, endgamelevelname, has_ceiling, surface,
} from "./dungeon.js";
import { hu_stat, temp_resist } from "./eat.js";
import { newuexp } from "./exper.js";
import { dxdy_to_dist_descr } from "./getpos.js";
import { inv_weight, money_cnt, near_capacity } from "./hack.js";
import {
    digit, eos, highc, lcase, lowc, mungspaces, nh_deterministic_qsort, ordin, s_suffix, strncmpi,
    strstri, strsubst, upstart,
} from "./hacklib.js";
import { carrying, currency } from "./invent.js";
import { magic_negation } from "./mhitu.js";
import { dmgtype, sticks } from "./mondata.js";
import { mons } from "./monst.js";
import { objects } from "./objects.js";
import {
    an, ansimpleoname, just_an, makeplural, reorder_fruit, shield_simple_name, simple_typename,
    simpleonames, suit_simple_name, the,
} from "./objnam.js";
import { oc_to_str } from "./options.js";
import { mhidden_description, waterbody_name } from "./pager.js";
import { You, impossible, livelog_printf, pline } from "./pline.js";
import { body_part, mbodypart, udeadinside, ugenocided } from "./polyself.js";
import { align_gname, can_pray, u_gname } from "./pray.js";
import { mon_aligntyp } from "./priest.js";
import { reg_damg, visible_region_at } from "./region.js";
import { genders } from "./role.js";
import { costly_spot } from "./shk.js";
import { observable_depth } from "./topten.js";
import { t_at, trapname } from "./trap.js";
import { hidden_gold } from "./vault.js";
import { can_advance, skill_level_name, skill_name, weapon_descr, weapon_type } from "./weapon.js";
import { empty_handed } from "./wield.js";
import { add_menu, add_menu_str, select_menu } from "./windows.js";
import { count_wsegs, wseg_at } from "./worm.js";
import { find_mac, which_armor } from "./worn.js";
import { item_what, u_adtyp_resistance_obj } from "./zap.js";
