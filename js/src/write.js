/* NetHack 5.0	write.c	$NHDT-Date: 1702023275 2023/12/08 08:14:35 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.41 $ */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * returns base cost of a scroll or a spellbook
 */
function cost(otmp) { /* int */
    if (otmp.oclass == SPBOOK_CLASS)
        return (10 * objects[otmp.otyp].oc_oc2);

    switch (otmp.otyp) {
    case SCR_MAIL:
        return 2;

    case SCR_LIGHT:
    case SCR_GOLD_DETECTION:
    case SCR_FOOD_DETECTION:
    case SCR_MAGIC_MAPPING:
    case SCR_AMNESIA:
    case SCR_FIRE:
    case SCR_EARTH:
        return 8;
    case SCR_DESTROY_ARMOR:
    case SCR_CREATE_MONSTER:
    case SCR_PUNISHMENT:
        return 10;
    case SCR_CONFUSE_MONSTER:
        return 12;
    case SCR_IDENTIFY:
        return 14;
    case SCR_ENCHANT_ARMOR:
    case SCR_REMOVE_CURSE:
    case SCR_ENCHANT_WEAPON:
    case SCR_CHARGING:
        return 16;
    case SCR_SCARE_MONSTER:
    case SCR_STINKING_CLOUD:
    case SCR_TAMING:
    case SCR_TELEPORTATION:
        return 20;
    case SCR_GENOCIDE:
        return 30;
    case SCR_BLANK_PAPER:
    default:
        impossible(_("You can't write such a weird scroll!"));
    }
    return 1000;
}

/* getobj callback for object to write on */
function write_ok(obj) { /* int */
    if (!obj || (obj.oclass != SCROLL_CLASS && obj.oclass != SPBOOK_CLASS))
        return GETOBJ_EXCLUDE;

    if (obj.otyp == SCR_BLANK_PAPER || obj.otyp == SPE_BLANK_PAPER)
        return GETOBJ_SUGGEST;

    return GETOBJ_DOWNPLAY;
}

/* write -- applying a magic marker */
export function dowrite(pen) { /* int */
    const $frame = stack_frame(); try {
    var paper;
    var namebuf = init_list(stack_array(char, BUFSZ), []), nm, bp;
    var new_obj;
    var basecost, actualcost;
    var curseval;
    var qbuf = stack_array(char, QBUFSZ);
    var first, last, i, deferred, deferralchance, real;
    var by_descr = FALSE;
    var typeword;
    var spell_knowledge;

    if (nohands(gy.youmonst.data)) {
        You(_("need hands to be able to write!"));
        return ECMD_OK;
    } else if (Glib()) {
        pline(_("%s from your %s."), Tobjnam(pen, _("slip")),
              fingers_or_gloves(FALSE));
        dropx(pen);
        return ECMD_TIME;
    }

    /* get paper to write on */
    paper = getobj(_("write on"), write_ok, GETOBJ_NOFLAGS);
    if (!paper)
        return ECMD_CANCEL;
    /* can't write on a novel (unless/until it's been converted into a blank
       spellbook), but we want messages saying so to avoid "spellbook" */
    typeword = (paper.otyp == SPE_NOVEL) ? _("book")
               : (paper.oclass == SPBOOK_CLASS) ? _("spellbook")
                 : _("scroll");
    if (Blind()) {
        if (!paper.dknown) {
            You(_("don't know whether that %s is blank or not."), typeword);
            return ECMD_OK;
        } else if (paper.oclass == SPBOOK_CLASS) {
            /* can't write a magic book while blind */
            pline(_("%s can't create braille text."),
                  upstart(ysimple_name(pen)));
            return ECMD_OK;
        }
    }
    observe_object(paper);
    if (paper.otyp != SCR_BLANK_PAPER && paper.otyp != SPE_BLANK_PAPER) {
        pline(_("That %s is not blank!"), typeword);
        exercise(A_WIS, FALSE);
        return ECMD_TIME;
    }
    makeknown(SCR_BLANK_PAPER);

    /* what to write */
    sprintf(qbuf, _("What type of %s do you want to write?"), typeword);
    getlin(qbuf, namebuf);
    mungspaces(namebuf); /* remove any excess whitespace */
    if (chars[namebuf + 0] == ord('\x1b') || !chars[namebuf + 0])
        return ECMD_TIME;
    nm = namebuf;
    if (!strncmpi(nm, _("scroll "), 7))
        nm += 7;
    else if (!strncmpi(nm, _("spellbook "), 10))
        nm += 10;
    if (!strncmpi(nm, _("of "), 3))
        nm += 3;

    if ((bp = strstri(nm, _(" armour"))) != 0) {
        memcpy(bp, _(" armor "), 7);
        mungspaces(bp + 1);        /* remove the extra space */
    }

    deferred = real = 0; /* not any scroll or book */
    deferralchance = 0;  /* incremented for each oc_uname match */
    first = svb.bases[paper.oclass];
    last = svb.bases[paper.oclass + 1] - 1;
    /* first loop: look for match with name/description */
    found: { for (i = first; i <= last; i++) {
        /* extra shufflable descr not representing a real object */
        if (!OBJ_NAME(objects[i]))
            continue;

        if (!strcmpi(OBJ_NAME(objects[i]), nm)) {
            if (objects[i].oc_name_known
                /* spellbooks can only be written by_name, so no need to
                   hold out for a 'better' by_descr match */
                || paper.oclass == SPBOOK_CLASS) {
                break found;
            } else {
                /* save item in case there are no better by_descr matches */
                real = deferred = i;
                break;
            }
        }

        if (!strcmpi(OBJ_DESCR(objects[i]), nm)) {
            by_descr = TRUE;
            break found;
        }
    }
    /* second loop: look for match with user-assigned name */
    /* we will get here if 'nm' isn't a real scroll name/descr, or is the name
     * of a real scroll that hasn't been formally IDed. */
    for (i = first; i <= last; i++) {
        /* player might assign same name multiple times and if so,
           we choose one of those matches randomly */
        if (objects[i].oc_uname && !strcmpi(objects[i].oc_uname, nm)
            /* prefer attempting to write the real scroll type if
               the typename clobbers a real scroll and is known to
               be incorrect */
            && !(real && objects[i].oc_name_known)
            /*
             * First match: chance incremented to 1,
             *   !rn2(1) is 1, we remember i;
             * second match: chance incremented to 2,
             *   !rn2(2) has 1/2 chance to replace i;
             * third match: chance incremented to 3,
             *   !rn2(3) has 1/3 chance to replace i
             *   and 2/3 chance to keep previous 50:50
             *   choice; so on for higher match counts.
             */
            && !rn2(++deferralchance)) {
            deferred = i;
            /* writing by user-assigned name is same as by description:
               fails for books, works for scrolls (having an assigned
               type name guarantees presence on discoveries list) */
            by_descr = TRUE;
        }
    }

    if (deferred) {
        i = deferred;
        break found;
    }

    There(_("is no such %s!"), typeword);
    return ECMD_TIME;
 }

    if (i == SCR_BLANK_PAPER || i == SPE_BLANK_PAPER) {
        You_cant(_("write that!"));
        pline(_("It's obscene!"));
        return ECMD_TIME;
    } else if (i == SPE_NOVEL) {
        var fanfic = +!rn2(3), tearup = +!rn2(3);

        if (!fanfic) {
            You(_("%s to write the Great Yendorian Novel, but %s inspiration."),
                !tearup ? _("prepare") : _("try"),
                !Hallucination() ? _("lack") : _("have too much"));
        } else {
            You(_("%sproduce really %s fan-fiction."),
                !tearup ? _("start to ") : _(""),
                !Hallucination() ? _("lame") : _("awesome"));
        }
        if (!tearup) {
            You(_("give up on the idea."));
        } else {
            You(_("tear it up."));
            useup(paper);
        }
        return ECMD_TIME;
    } else if (i == SPE_BOOK_OF_THE_DEAD) {
        pline(_("No mere dungeon adventurer could write that."));
        return ECMD_TIME;
    } else if (by_descr && paper.oclass == SPBOOK_CLASS
               && !objects[i].oc_name_known) {
        /* can't write unknown spellbooks by description */
        pline(_("Unfortunately you don't have enough information to go on."));
        return ECMD_TIME;
    }

    /* KMH, conduct */
    if (!u.uconduct.literate++)
        livelog_printf(LL_CONDUCT,
                       _("became literate by writing %s"), an(typeword));

    new_obj = mksobj(i, FALSE, FALSE);
    new_obj.bknown = (paper.bknown && pen.bknown ? 1 : 0);

    /* shk imposes a flat rate per use, not based on actual charges used */
    check_unpaid(pen);

    /* see if there's enough ink */
    basecost = cost(new_obj);
    if (pen.spe < Math.trunc(basecost / 2)) {
        Your(_("marker is too dry to write that!"));
        obfree(new_obj, null);
        return ECMD_TIME;
    }

    /* we're really going to write now, so calculate cost
     */
    actualcost = rn1(Math.trunc(basecost / 2), Math.trunc(basecost / 2));
    curseval = bcsign(pen) + bcsign(paper);
    exercise(A_WIS, TRUE);
    /* dry out marker */
    if (pen.spe < actualcost) {
        pen.spe = 0;
        Your(_("marker dries out!"));
        /* scrolls disappear, spellbooks don't */
        if (paper.oclass == SPBOOK_CLASS) {
            pline_The(_("spellbook is left unfinished and your writing fades."));
            update_inventory(); /* pen charges */
        } else {
            pline_The(_("scroll is now useless and disappears!"));
            useup(paper);
        }
        obfree(new_obj, null);
        return ECMD_TIME;
    }
    pen.spe -= actualcost;

    /*
     * Writing by name requires that the hero knows the scroll or
     * book type.  One has previously been read (and its effect
     * was evident) or been ID'd via scroll/spell/throne (or skill
     * for Wizards) and it will be on the discoveries list.
     * Unknown spellbooks can also be written by name if the hero
     * has fresh knowledge of the spell, or if the spell is almost
     * forgotten and the hero is Lucky (with a greater chance than
     * if the spell is unknown or forgotten).
     * (Previous versions allowed scrolls and books to be written
     * by type name if they were on the discoveries list via being
     * given a user-assigned name, even though doing the latter
     * doesn't--and shouldn't--make the actual type become known.)
     *
     * Writing by description requires that the hero knows the
     * description (a scroll's label, that is, since books by_descr
     * are rejected above).  This is done by checking to see if a
     * scroll with the same description has been encountered.
     *
     * Normal requirements can be overridden if hero is Lucky.
     */

    if (paper.oclass == SPBOOK_CLASS) {
        spell_knowledge = known_spell(new_obj.otyp);
    } else {
        spell_knowledge = spe_Unknown;
    }
    /* if known, then either by-name or by-descr works */
    if (!objects[new_obj.otyp].oc_name_known
        /* else if named, then only by-descr works */
        && !(by_descr && objects[new_obj.otyp].oc_encountered)
        /* else fresh knowledge of the spell works */
        && spell_knowledge != spe_Fresh
        /* and Luck might override after previous checks have failed */
        && rnl(((Role_if(PM_WIZARD) && paper.oclass != SPBOOK_CLASS)
                || spell_knowledge == spe_GoingStale)
               ? 5 : 15)) {
        You(_("%s to write that."), by_descr ? _("fail") : _("don't know how"));
        /* scrolls disappear, spellbooks don't */
        if (paper.oclass == SPBOOK_CLASS) {
            You(
      _("write in your best handwriting:  \"My Diary\", but it quickly fades."));
            update_inventory(); /* pen charges */
        } else {
            if (by_descr) {
                strcpy(namebuf, OBJ_DESCR(objects[new_obj.otyp]));
                wipeout_text(namebuf, Math.trunc((6 + MAXULEV - u.ulevel) / 6), 0);
            } else
                sprintf(namebuf, _("%s was here!"), svp.plname);
            You(_("write \"%s\" and the scroll disappears."), namebuf);
            useup(paper);
        }
        obfree(new_obj, null);
        return ECMD_TIME;
    }
    /* can write scrolls when blind, but requires luck too;
       attempts to write books when blind are caught above */
    if (Blind() && rnl(3)) {
        /* writing while blind usually fails regardless of
           whether the target scroll is known; even if we
           have passed the write-an-unknown scroll test
           above we can still fail this one, so it's doubly
           hard to write an unknown scroll while blind */
        You(_("fail to write the scroll correctly and it disappears."));
        useup(paper);
        obfree(new_obj, null);
        return ECMD_TIME;
    }

    /* use up old scroll / spellbook */
    useup(paper);

    /* success */
    if (new_obj.oclass == SPBOOK_CLASS) {
        /* acknowledge the change in the object's description... */
        pline_The(_("spellbook warps strangely, then turns %s."),
                  new_book_description(new_obj.otyp, namebuf));
    }
    new_obj.blessed = +(curseval > 0);
    new_obj.cursed = +(curseval < 0);

    if (new_obj.otyp == SCR_MAIL)
        /* 0: delivered in-game via external event (or randomly for fake mail);
           1: from bones or wishing; 2: written with marker */
        new_obj.spe = 2;

    /* unlike alchemy, for example, a successful result yields the
       specifically chosen item so hero recognizes it even if blind;
       the exception is for being lucky writing an undiscovered scroll,
       where the label associated with the type-name isn't known yet;
       but if writing by description, the description is always known */
    new_obj.dknown = FALSE;
    if (objects[new_obj.otyp].oc_name_known || by_descr)
        observe_object(new_obj);

    new_obj = hold_another_object(new_obj, _("Oops!  %s out of your grasp!"),
                                  The(aobjnam(new_obj, _("slip"))),
                                  0);
    (new_obj); /* try to avoid complaint about dead assignment */
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

/* most book descriptions refer to cover appearance, so we can issue a
   message for converting a plain book into one of those with something
   like "the spellbook turns red" or "the spellbook turns ragged";
   but some descriptions refer to composition and "the book turns vellum"
   looks funny, so we want to insert "into " prior to such descriptions;
   even that's rather iffy, indicating that such descriptions probably
   ought to be eliminated (especially "cloth"!) */
function new_book_description(booktype, outbuf) { /* char * */
    /* subset of description strings from objects.c; if it grows
       much, we may need to add a new flag field to objects[] instead */
    let compositions = static_array("new_book_description.compositions", ptr_to(char), null, [
        _("parchment"),
        _("vellum"),
        _("cloth"),

        0
    ]);
    let descr, comp_p;

    descr = OBJ_DESCR(objects[booktype]);
    for (comp_p = compositions; comp_p[0]; comp_p = comp_p.subarray(1))
        if (!strcmpi(descr, comp_p[0]))
            break;

    sprintf(outbuf, _("%s%s"), comp_p[0] ? _("into ") : _(""), descr);
    return outbuf;
}

/*write.c*/

import { A_WIS } from "./attrib.h.js";
import { SCROLL_CLASS, SPBOOK_CLASS } from "./defsym.h.js";
import { BUFSZ, FALSE, LL_CONDUCT, MAXULEV, QBUFSZ, TRUE } from "./global.h.js";
import { strcmpi } from "./global.h.macros.js";
import {
    ECMD_CANCEL, ECMD_OK, ECMD_TIME, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_NOFLAGS,
    GETOBJ_SUGGEST,
} from "./hack.h.js";
import { makeknown, rn1 } from "./hack.h.macros.js";
import { nohands } from "./mondata.h.macros.js";
import { PM_WIZARD } from "./monsters.h.js";
import { OBJ_DESCR, OBJ_NAME } from "./objclass.h.macros.js";
import {
    SCR_AMNESIA, SCR_BLANK_PAPER, SCR_CHARGING, SCR_CONFUSE_MONSTER, SCR_CREATE_MONSTER,
    SCR_DESTROY_ARMOR, SCR_EARTH, SCR_ENCHANT_ARMOR, SCR_ENCHANT_WEAPON, SCR_FIRE,
    SCR_FOOD_DETECTION, SCR_GENOCIDE, SCR_GOLD_DETECTION, SCR_IDENTIFY, SCR_LIGHT,
    SCR_MAGIC_MAPPING, SCR_MAIL, SCR_PUNISHMENT, SCR_REMOVE_CURSE, SCR_SCARE_MONSTER,
    SCR_STINKING_CLOUD, SCR_TAMING, SCR_TELEPORTATION, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD,
    SPE_NOVEL,
} from "./objects.h.js";
import { spe_Fresh, spe_GoingStale, spe_Unknown } from "./spell.h.js";
import { Role_if } from "./you.h.macros.js";
import { Blind, Glib, Hallucination } from "./youprop.h.macros.js";
import { char, ord } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { memcpy, sprintf, strcpy } from "../rt/libc.js";
import { init_list, stack_array, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { ptr_to } from "../rt/struct.js";
import { exercise } from "./attrib.js";
import { gy, svb, svp, u } from "./decl.js";
import { dropx } from "./do.js";
import { fingers_or_gloves } from "./do_wear.js";
import { wipeout_text } from "./engrave.js";
import { mungspaces, strncmpi, strstri, upstart } from "./hacklib.js";
import { getobj, hold_another_object, update_inventory, useup } from "./invent.js";
import { bcsign, mksobj } from "./mkobj.js";
import { observe_object } from "./o_init.js";
import { objects } from "./objects.js";
import { The, Tobjnam, an, aobjnam, ysimple_name } from "./objnam.js";
import {
    There, You, You_cant, Your, impossible, livelog_printf, pline, pline_The,
} from "./pline.js";
import { rn2, rnl } from "./rnd.js";
import { check_unpaid, obfree } from "./shk.js";
import { known_spell } from "./spell.js";
import { getlin } from "./windows.js";
