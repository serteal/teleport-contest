/* NetHack 5.0	sounds.c	$NHDT-Date: 1736530208 2025/01/10 09:30:08 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.165 $ */
/*      Copyright (c) 1989 Janet Walz, Mike Threepoint */
/* NetHack may be freely redistributed.  See license for details. */

/* this easily could be a macro, but it might overtax dumb compilers */
function mon_in_room(mon, rmtyp) { /* int */
    let rno = levl()[mon.mx][mon.my].roomno;
    if (rno >= ROOMOFFSET)
        return +(elt(svr.rooms, rno - ROOMOFFSET).rtype == rmtyp);
    return FALSE;
}

function throne_mon_sound(mtmp) { /* boolean */
    if ((mtmp.msleeping || is_lord(mtmp.data)
         || is_prince(mtmp.data)) && !is_animal(mtmp.data)
        && mon_in_room(mtmp, COURT)) {
        let throne_msg = static_array("throne_mon_sound.throne_msg", ptr_to(char), 4, [
            _("the tones of courtly conversation."),
            _("a sceptre pounded in judgment."),
            _("Someone shouts \"Off with %s head!\""),
            _("Queen Beruthiel's cats!"),
        ]);
        let which = rn2(3) + (Hallucination() ? 1 : 0);

        if (which != 2) {
            if (which == 0) {
                 ;
            } else if (which == 1) {
                 ;
            }
            You_hear1(throne_msg[which]);
        } else {
            pline(throne_msg[2], uhis());
        }
        return TRUE;
    }
    return FALSE;
}

function beehive_mon_sound(mtmp) { /* boolean */
    if ((mtmp.data.mlet == S_ANT && is_flyer(mtmp.data))
        && mon_in_room(mtmp, BEEHIVE)) {
        let hallu = Hallucination() ? 1 : 0;

        switch (rn2(2) + hallu) {
        case 0:
            ;
            You_hear(_("a low buzzing."));
            break;
        case 1:
            ;
            You_hear(_("an angry drone."));
            break;
        case 2:
            ;
            You_hear(_("bees in your %sbonnet!"),
                     uarmh ? _("") : _("(nonexistent) "));
            break;
        }
        return TRUE;
    }
    return FALSE;
}

function morgue_mon_sound(mtmp) { /* boolean */
    if ((is_undead(mtmp.data) || is_vampshifter(mtmp))
        && mon_in_room(mtmp, MORGUE)) {
        let hallu = Hallucination() ? 1 : 0;
        let hair = body_part(HAIR); /* hair/fur/scales */

        switch (rn2(2) + hallu) {
        case 0:
            You(_("suddenly realize it is unnaturally quiet."));
            break;
        case 1:
            pline_The(_("%s on the back of your %s %s up."), hair,
                      body_part(NECK), vtense(hair, _("stand")));
            break;
        case 2:
            pline_The(_("%s on your %s %s to stand up."), hair,
                      body_part(HEAD), vtense(hair, _("seem")));
            break;
        }
        return TRUE;
    }
    return FALSE;
}

function zoo_mon_sound(mtmp) { /* boolean */
    if ((mtmp.msleeping || is_animal(mtmp.data))
        && mon_in_room(mtmp, ZOO)) {
        let hallu = Hallucination() ? 1 : 0, selection = rn2(2) + hallu;
        let zoo_msg = static_array("zoo_mon_sound.zoo_msg", ptr_to(char), 3, [
            _("a sound reminiscent of an elephant stepping on a peanut."),
            _("a sound reminiscent of a seal barking."), _("Doctor Dolittle!"),
        ]);
        You_hear1(zoo_msg[selection]);
        return TRUE;
    }
    return FALSE;
}

function temple_priest_sound(mtmp) { /* boolean */
    if (mtmp.ispriest && inhistemple(mtmp)
        /* priest must be active */
        && !helpless(mtmp)
        /* hero must be outside this temple */
        && temple_occupied(u.urooms) != EPRI(mtmp).shroom) {
        /* Generic temple messages; no attempt to match topic or tone
           to the pantheon involved, let alone to the specific deity.
           These are assumed to be coming from the attending priest;
           asterisk means that the priest must be capable of speech;
           pound sign (octathorpe,&c--don't go there) means that the
           priest and the altar must not be directly visible (we don't
           care if telepathy or extended detection reveals that the
           priest is not currently standing on the altar; he's mobile). */
        let temple_msg = static_array("temple_priest_sound.temple_msg", ptr_to(char), null, [
            _("*someone praising %s."), _("*someone beseeching %s."),
            _("#an animal carcass being offered in sacrifice."),
            _("*a strident plea for donations."),
        ]);
        let msg;
        let hallu = Hallucination() ? 1 : 0;
        let trycount = 0,
            ax = EPRI(mtmp).shrpos.x,
            ay = EPRI(mtmp).shrpos.y;
        let speechless = +(mtmp.data.msound <= MS_ANIMAL),
            in_sight = (canseemon(mtmp) || cansee(ax, ay) ? 1 : 0);

        do {
            msg = temple_msg[rn2(SIZE(temple_msg) - 1 + hallu)];
            if (strchr(msg, ord('*')) && speechless)
                continue;
            if (strchr(msg, ord('#')) && in_sight)
                continue;
            break; /* msg is acceptable */
        } while (++trycount < 50);
        while (!letter(chars[msg]))
            ++msg; /* skip control flags */
        if (strchr(msg, ord('%'))) {
            You_hear(msg, halu_gname(EPRI(mtmp).shralign));
        } else
            You_hear1(msg);
        return TRUE;
    }
    return FALSE;
}

function oracle_sound(mtmp) { /* boolean */
    if (mtmp.data != mons[PM_ORACLE])
        return FALSE;

    /* and don't produce silly effects when she's clearly visible */
    if (Hallucination() || !canseemon(mtmp)) {
        let hallu = Hallucination() ? 1 : 0;
        let ora_msg = static_array("oracle_sound.ora_msg", ptr_to(char), 5, [
            _("a strange wind."),     /* Jupiter at Dodona */
            _("convulsive ravings."), /* Apollo at Delphi */
            _("snoring snakes."),     /* AEsculapius at Epidaurus */
            _("someone say \"No more woodchucks!\""),
            _("a loud ZOT!") /* both rec.humor.oracle */
        ]);
        You_hear(_("%s"), ora_msg[rn2(3) + hallu * 2]);
    }
    return TRUE;
}

export function dosounds() { /* void */
    let sroom;
    let hallu, vx, vy;
    let mtmp;

    if (Deaf() || !flags.acoustics || u.uswallow || Underwater())
        return;

    hallu = Hallucination() ? 1 : 0;

    if (svl.level.flags.nfountains && !rn2(400)) {
        let fountain_msg = static_array("dosounds.fountain_msg", ptr_to(char), 4, [
            _("bubbling water."), _("water falling on coins."),
            _("the splashing of a naiad."), _("a soda fountain!"),
        ]);
        You_hear(_("%s"), fountain_msg[rn2(3) + hallu]);
    }
    if (svl.level.flags.nsinks && !rn2(300)) {
        let sink_msg = static_array("dosounds.sink_msg", ptr_to(char), 3, [
            _("a slow drip."), _("a gurgling noise."), _("dishes being washed!"),
        ]);
        You_hear(_("%s"), sink_msg[rn2(2) + hallu]);
    }
    if (svl.level.flags.has_court && !rn2(200)) {
        if (get_iter_mons(throne_mon_sound))
            return;
    }
    if (svl.level.flags.has_swamp && !rn2(200)) {
        let swamp_msg = static_array("dosounds.swamp_msg", ptr_to(char), 3, [
            _("hear mosquitoes!"), _("smell marsh gas!"), /* so it's a smell...*/
            _("hear Donald Duck!"),
        ]);
        You(_("%s"), swamp_msg[rn2(2) + hallu]);
        return;
    }
    if (svl.level.flags.has_vault && !rn2(200)) {
        if (!(sroom = search_special(VAULT))) {
            /* strange ... */
            svl.level.flags.has_vault = 0;
            return;
        }
        if (gd_sound())
            switch (rn2(2) + hallu) {
            case 1: {
                let gold_in_vault = FALSE;

                for (vx = sroom.lx; vx <= sroom.hx; vx++)
                    for (vy = sroom.ly; vy <= sroom.hy; vy++)
                        if (g_at(vx, vy))
                            gold_in_vault = TRUE;
                if (vault_occupied(u.urooms)
                    != (ROOM_INDEX(sroom) + ROOMOFFSET)) {
                    if (gold_in_vault) {
                        You_hear(!hallu
                                     ? _("someone counting gold coins.")
                                     : _("the quarterback calling the play."));
                    } else {
                         ;
                        You_hear(_("someone searching."));
                    }
                    break;
                }
            }
            /* FALLTHROUGH */;
                /*FALLTHRU*/
            case 0:
                ;
                You_hear(_("the footsteps of a guard on patrol."));
                break;
            case 2:
                You_hear(_("Ebenezer Scrooge!"));
                break;
            }
        return;
    }
    if (svl.level.flags.has_beehive && !rn2(200)) {
        if (get_iter_mons(beehive_mon_sound))
            return;
    }
    if (svl.level.flags.has_morgue && !rn2(200)) {
        if (get_iter_mons(morgue_mon_sound))
            return;
    }
    if (svl.level.flags.has_barracks && !rn2(200)) {
        let barracks_msg = static_array("dosounds.barracks_msg", ptr_to(char), 4, [
            _("blades being honed."), _("loud snoring."), _("dice being thrown."),
            _("General MacArthur!"),
        ]);
        let count = 0;

        for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
            if (DEADMONSTER(mtmp))
                continue;
            if (is_mercenary(mtmp.data)

                && mon_in_room(mtmp, BARRACKS)
                /* sleeping implies not-yet-disturbed (usually) */
                && (mtmp.msleeping || ++count > 5)) {
                You_hear(_("%s"), barracks_msg[rn2(3) + hallu]);
                return;
            }
        }
    }
    if (svl.level.flags.has_zoo && !rn2(200)) {
        if (get_iter_mons(zoo_mon_sound))
            return;
    }
    if (svl.level.flags.has_shop && !rn2(200)) {
        if (!(sroom = search_special(ANY_SHOP))) {
            /* strange... */
            svl.level.flags.has_shop = 0;
            return;
        }
        if (tended_shop(sroom)
            && !strchr(u.ushops, int((ROOM_INDEX(sroom) + ROOMOFFSET)))) {
            let shop_msg = static_array("dosounds.shop_msg", ptr_to(char), 3, [
                _("someone cursing shoplifters."),
                _("the chime of a cash register."), _("Neiman and Marcus arguing!"),
            ]);
            You_hear(_("%s"), shop_msg[rn2(2) + hallu]);
            noisy_shop(sroom);
        }
        return;
    }
    if (svl.level.flags.has_temple && !rn2(200)
        && !(Is_astralevel(u.uz) || Is_sanctum(u.uz))) {
        if (get_iter_mons(temple_priest_sound))
            return;
    }
    if (Is_oracle_level(u.uz) && !rn2(400)) {
        if (get_iter_mons(oracle_sound))
            return;
    }
}

const h_sounds = static_array("h_sounds", ptr_to(char), null, [
    _("beep"),   _("boing"),   _("sing"),   _("belche"), _("creak"),   _("cough"),
    _("rattle"), _("ululate"), _("pop"),    _("jingle"), _("sniffle"), _("tinkle"),
    _("eep"),    _("clatter"), _("hum"),    _("sizzle"), _("twitter"), _("wheeze"),
    _("rustle"), _("honk"),    _("lisp"),   _("yodel"),  _("coo"),     _("burp"),
    _("moo"),    _("boom"),    _("murmur"), _("oink"),   _("quack"),   _("rumble"),
    _("twang"),  _("toot"),    _("gargle"), _("hoot"),    _("warble")
]);

export function growl_sound(mtmp) { /* const char * */
    let ret;

    switch (mtmp.data.msound) {
    case MS_MEW:
    case MS_HISS:
        ret = _("hiss");
        break;
    case MS_BARK:
    case MS_GROWL:
        ret = _("growl");
        break;
    case MS_ROAR:
        ret = _("roar");
        break;
    case MS_BELLOW:
        ret = _("bellow");
        break;
    case MS_BUZZ:
        ret = _("buzz");
        break;
    case MS_SQEEK:
        ret = _("squeal");
        break;
    case MS_SQAWK:
        ret = _("screech");
        break;
    case MS_NEIGH:
        ret = _("neigh");
        break;
    case MS_WAIL:
        ret = _("wail");
        break;
    case MS_GROAN:
        ret = _("groan");
        break;
    case MS_MOO:
        ret = _("low");
        break;
    case MS_SILENT:
        ret = _("commotion");
        break;
    default:
        ret = _("scream");
    }
    return ret;
}

/* the sounds of a seriously abused pet, including player attacking it */
export function growl(mtmp) { /* void */
    let growl_verb = 0;

    if (helpless(mtmp) || mtmp.data.msound == MS_SILENT)
        return;

    /* presumably nearness and soundok checks have already been made */
    if (Hallucination())
        growl_verb = ROLL_FROM(h_sounds);
    else
        growl_verb = growl_sound(mtmp);
    if (growl_verb) {
        if (canseemon(mtmp) || !Deaf()) {
            pline(_("%s %s!"), Monnam(mtmp), vtense(0, growl_verb));
            iflags.last_msg = PLNMSG_GROWL;
            if (svc.context.run)
                nomul(0);
        }
        wake_nearto(mtmp.mx, mtmp.my, mtmp.data.mlevel * 18);
    }
}

/* the sounds of mistreated pets */
export function yelp(mtmp) { /* void */
    let yelp_verb = 0;
    let se = se_yelp;

    if (helpless(mtmp) || !mtmp.data.msound)
        return;

    /* presumably nearness and soundok checks have already been made */
    if (Hallucination())
        yelp_verb = ROLL_FROM(h_sounds);
    else
        switch (mtmp.data.msound) {
        case MS_MEW:
            se = se_feline_yelp;
            yelp_verb = (!Deaf()) ? _("yowl") : _("arch");
            break;
        case MS_BARK:
        case MS_GROWL:
            se = se_canine_yelp;
            yelp_verb = (!Deaf()) ? _("yelp") : _("recoil");
            break;
        case MS_ROAR:
            yelp_verb = (!Deaf()) ? _("snarl") : _("bluff");
            break;
        case MS_SQEEK:
            se = se_squeal;
            yelp_verb = (!Deaf()) ? _("squeal") : _("quiver");
            break;
        case MS_SQAWK:
            se = se_avian_screak;
            yelp_verb = (!Deaf()) ? _("screak") : _("thrash");
            break;
        case MS_WAIL:
            se = se_wail;
            yelp_verb = (!Deaf()) ? _("wail") : _("cringe");
            break;
        }
    if (yelp_verb) {
         ;  /* Soundeffect() handles Deaf or not Deaf */
        pline(_("%s %s!"), Monnam(mtmp), vtense(0, yelp_verb));
        if (svc.context.run)
            nomul(0);
        wake_nearto(mtmp.mx, mtmp.my, mtmp.data.mlevel * 12);
    }

    (se);
}

/* the sounds of distressed pets */
export function whimper(mtmp) { /* void */
    let whimper_verb = 0;
    let se = se_canine_whine;
    if (helpless(mtmp) || !mtmp.data.msound)
        return;

    /* presumably nearness and soundok checks have already been made */
    if (Hallucination())
        whimper_verb = ROLL_FROM(h_sounds);
    else
        switch (mtmp.data.msound) {
        case MS_MEW:
        case MS_GROWL:
            whimper_verb = _("whimper");
            break;
        case MS_BARK:
            whimper_verb = _("whine");
            break;
        case MS_SQEEK:
            se = se_squeal;
            whimper_verb = _("squeal");
            break;
        }
    if (whimper_verb) {
        if (!Hallucination()) {
             ;
        }
        pline(_("%s %s."), Monnam(mtmp), vtense(0, whimper_verb));
        if (svc.context.run)
            nomul(0);
        wake_nearto(mtmp.mx, mtmp.my, mtmp.data.mlevel * 6);
    }

    (se);
}

/* pet makes "I'm hungry" noises */
export function beg(mtmp) { /* void */
    if (helpless(mtmp)
        || !(carnivorous(mtmp.data) || herbivorous(mtmp.data)))
        return;

    /* presumably nearness and soundok checks have already been made */
    if (!is_silent(mtmp.data) && mtmp.data.msound <= MS_ANIMAL) {
        domonnoise(mtmp);
    } else if (mtmp.data.msound >= MS_HUMANOID) {
        if (!canspotmon(mtmp))
            map_invisible(mtmp.mx, mtmp.my);
           ;
        verbalize(_("I'm hungry."));
    } else {
        /* this is pretty lame but is better than leaving out the block
           of speech types between animal and humanoid; this covers
           MS_SILENT too (if caller lets that get this far) since it's
           excluded by the first two cases */
        if (canspotmon(mtmp))
            pline(_("%s seems famished."), Monnam(mtmp));
        /* looking famished will be a good trick for a tame skeleton... */
    }
}

/* hero has attacked a peaceful monster within 'mon's view */
export function maybe_gasp(mon) { /* const char * */
    let Exclam = static_array("maybe_gasp.Exclam", ptr_to(char), null, [
        _("Gasp!"), _("Uh-oh."), _("Oh my!"), _("What?"), _("Why?"),
    ]);
    let mptr = mon.data;
    let msound = mptr.msound;
    let dogasp = FALSE;

    /* other roles' guardians and cross-aligned priests don't gasp */
    if ((msound == MS_GUARDIAN && mptr != mons[gu.urole.guardnum])
        || (msound == MS_PRIEST && !p_coaligned(mon)))
        msound = MS_SILENT;
    /* co-aligned angels do gasp */
    else if (msound == MS_CUSS && has_emin(mon)
           && (p_coaligned(mon) ? !EMIN(mon).renegade : EMIN(mon).renegade))
        msound = MS_HUMANOID;

    /*
     * Only called for humanoids so animal noise handling is ignored.
     */
    switch (msound) {
    case MS_HUMANOID:
    case MS_ARREST: /* Kops */
    case MS_SOLDIER: /* solider, watchman */
    case MS_GUARD: /* vault guard */
    case MS_NURSE:
    case MS_SEDUCE: /* nymph, succubus/incubus */
    case MS_LEADER: /* quest leader */
    case MS_GUARDIAN: /* leader's guards */
    case MS_SELL: /* shopkeeper */
    case MS_ORACLE:
    case MS_PRIEST: /* temple priest, roaming aligned priest (not mplayer) */
    case MS_BOAST: /* giants */
    case MS_IMITATE: /* doppelganger, leocrotta, Aleax */
        dogasp = TRUE;
        break;
    /* issue comprehensible word(s) if hero is similar type of creature */
    case MS_ORC: /* used to be synonym for MS_GRUNT */
    case MS_GRUNT: /* ogres, trolls, gargoyles, one or two others */
    case MS_LAUGH: /* leprechaun, gremlin */
    case MS_ROAR: /* dragon, xorn, owlbear */
    case MS_BELLOW: /* crocodile */
    /* capable of speech but only do so if hero is similar type */
    case MS_DJINNI:
    case MS_VAMPIRE: /* vampire in its own form */
    case MS_WERE: /* lycanthrope in human form */
    case MS_SPELL: /* titan, barrow wight, Nazgul, nalfeshnee */
        dogasp = +(mptr.mlet == gy.youmonst.data.mlet);
        break;
    /* capable of speech but don't care if you attack peacefuls */
    case MS_BRIBE:
    case MS_CUSS:
    case MS_RIDER:
    case MS_NEMESIS:
    /* can't speak */
    case MS_SILENT:
    default:
        break;
    }
    if (dogasp) {
        return ROLL_FROM(Exclam); /* [mon->m_id % SIZE(Exclam)]; */
    }
    return 0;
}

/* for egg hatching; caller will apply "ing" suffix
   [the old message when a carried egg hatches was
   "its cries sound like {mommy,daddy}"
   regardless of what type of sound--if any--the creature made] */
export function cry_sound(mtmp) { /* const char * */
    let ret = 0;
    let ptr = mtmp.data;

    /* a relatively small subset of MS_ sound values are used by oviparous
       species so we don't try to supply something for every MS_ type */
    switch (ptr.msound) {
    default:
    case MS_SILENT: /* insects, arthropods, worms, sea creatures */
        /* "chitter": have silent critters make some noise
           or the mommy/daddy gag when hatching doesn't work */
        ret = (ptr.mlet == S_EEL) ? _("gurgle") : _("chitter");
        break;
    case MS_HISS: /* chickatrice, pyrolisk, snakes */
        ret = _("hiss");
        break;
    case MS_ROAR: /* baby dragons; have them growl instead of roar */
    case MS_GROWL: /* (none) */
        ret = _("growl");
        break;
    case MS_CHIRP: /* adult crocodiles bellow, babies chirp */
        ret = _("chirp");
        break;
    case MS_BUZZ: /* killer bees */
        ret = _("buzz");
        break;
    case MS_SQAWK: /* ravens */
        ret = _("screech");
        break;
    case MS_GRUNT: /* gargoyles */
        ret = _("grunt");
        break;
    case MS_MUMBLE: /* naga hatchlingss */
        ret = _("mumble");
        break;
    }
    return ret;
}

/* return True if mon is a gecko or seems to look like one (hallucination) */
function mon_is_gecko(mon) { /* boolean */
    let glyph;

    /* return True if it is actually a gecko */
    if (mon.data == mons[PM_GECKO])
        return TRUE;
    /* return False if it is a long worm; we might be chatting to its tail
       (not strictly needed; long worms are MS_SILENT so won't get here) */
    if (mon.data == mons[PM_LONG_WORM])
        return FALSE;
    /* result depends upon whether map spot shows a gecko, which will
       be due to hallucination or to mimickery since mon isn't one */
    glyph = glyph_at(mon.mx, mon.my);
    return (+(glyph_to_mon(glyph) == PM_GECKO));
}

export function domonnoise(mtmp) { /* int */
    const $frame = stack_frame(); try {
    let verbuf = stack_array(char, BUFSZ);
    let pline_msg = 0,
        verbl_msg = 0,
        verbl_msg_mcan = 0;            /* verbalize() if cancelled */
    let ptr = mtmp.data;
    let msound = ptr.msound, gnomeplan = 0;

    /* presumably nearness and sleep checks have already been made */
    if (Deaf())
        return ECMD_OK;
    /* shk_chat can handle nonverbal monsters */
    if (is_silent(ptr) && !mtmp.isshk)
        return ECMD_OK;

    /* leader might be poly'd; if he can still speak, give leader speech */
    if (mtmp.m_id == svq.quest_status.leader_m_id && msound > MS_ANIMAL)
        msound = MS_LEADER;
    /* make sure it's your role's quest guardian; adjust if not */
    else if (msound == MS_GUARDIAN && ptr != mons[gu.urole.guardnum])
        msound = mons[genus(monsndx(ptr), 1)].msound;
    /* even polymorphed, shopkeepers retain their minds and capitalist bent */
    else if (mtmp.isshk)
        msound = MS_SELL;
    /* some normally non-speaking types can/will speak if hero is similar */
    else if (msound == MS_ORC
             && ((same_race(ptr, gy.youmonst.data)        /* current form, */
                  || same_race(ptr, mons[Race_switch()])) /* unpoly'd form */
                 || Hallucination()))
        msound = MS_HUMANOID;
    else if (msound == MS_MOO && !mtmp.mtame)
        msound = MS_BELLOW;
    /* silliness; formerly had a slight chance to interfere with shopping */
    else if (Hallucination() && mon_is_gecko(mtmp))
        msound = MS_SELL;

    /* be sure to do this before talking; the monster might teleport away, in
     * which case we want to check its pre-teleport position
     */
    if (!canspotmon(mtmp))
        map_invisible(mtmp.mx, mtmp.my);

    switch (msound) {
    case MS_ORACLE:
        return doconsult(mtmp); /* check this */
    case MS_PRIEST:
        priest_talk(mtmp);
        break;
    case MS_LEADER:
    case MS_NEMESIS:
    case MS_GUARDIAN:
        quest_chat(mtmp);
        break;
    case MS_SELL: /* pitch, pay, total */
        if (!Hallucination() || is_silent(ptr) || (mtmp.isshk && !rn2(2))) {
            shk_chat(mtmp);
        } else {
            /* approximation of GEICO's advertising slogan (it actually
               concludes with "save you 15% or more on car insurance.") */
            sprintf(verbuf, _("15 minutes could save you 15 %s."), currency(15))
; /* "zorkmids" */
            verbl_msg = verbuf;
        }
        break;
    case MS_VAMPIRE: {
        /* vampire messages are varied by tameness, peacefulness, and time of
           night */
        let isnight = night();
        let kindred = +(Upolyd() && (u.umonnum == PM_VAMPIRE
                                      || u.umonnum == PM_VAMPIRE_LEADER));
        let nightchild = +(Upolyd() && (u.umonnum == PM_WOLF
                                         || u.umonnum == PM_WINTER_WOLF
                                         || u.umonnum == PM_WINTER_WOLF_CUB));
        let racenoun = (flags.female && gu.urace.individual.f)
                               ? gu.urace.individual.f
                               : gu.urace.individual.m
                                 ? gu.urace.individual.m
                                 : gu.urace.noun;

        if (mtmp.mtame) {
            if (kindred) {
                sprintf(verbuf, _("Good %s to you Master%s"), isnight ? _("evening") : _("day"), isnight ? _("!") : _(".  Why do we not rest?"))

;
                verbl_msg = verbuf;
            } else {
                sprintf(verbuf, _("%s%s"), nightchild ? _("Child of the night, ") : _(""), midnight()
                         ? _("I can stand this craving no longer!")
                         : isnight
                          ? _("I beg you, help me satisfy this growing craving!")
                          : _("I find myself growing a little weary."))

;
                verbl_msg = verbuf;
            }
        } else if (mtmp.mpeaceful) {
            if (kindred && isnight) {
                sprintf(verbuf, _("Good feeding %s!"), flags.female ? _("sister") : _("brother"))
;
                verbl_msg = verbuf;
            } else if (nightchild && isnight) {
                sprintf(verbuf, _("How nice to hear you, child of the night!"));
                verbl_msg = verbuf;
            } else
                verbl_msg = _("I only drink... potions.");
        } else {
            let vampmsg = static_array("domonnoise.vampmsg", ptr_to(char), null, [
                /* These first two (0 and 1) are specially handled below */
                _("I vant to suck your %s!"),
                _("I vill come after %s without regret!"),
                /* other famous vampire quotes can follow here if desired */
            ]);
            let vampindex;

            if (kindred) {
                verbl_msg = _("This is my hunting ground" +
                            " that you dare to prowl!");
            } else if (gy.youmonst.data == mons[PM_SILVER_DRAGON]
                       || gy.youmonst.data == mons[PM_BABY_SILVER_DRAGON]) {
                /* Silver dragons are silver in color, not made of silver */
                sprintf(verbuf, _("%s!  Your silver sheen" +" does not frighten me!"), (gy.youmonst.data == mons[PM_SILVER_DRAGON])
                            ? _("Fool")
                            : _("Young Fool"))

;
                verbl_msg = verbuf;
            } else {
                vampindex = rn2(SIZE(vampmsg));
                if (vampindex == 0) {
                    sprintf(verbuf, vampmsg[vampindex], body_part(BLOOD));
                    verbl_msg = verbuf;
                } else if (vampindex == 1) {
                    sprintf(verbuf, vampmsg[vampindex], Upolyd() ? an(pmname(mons[u.umonnum],
                                               flags.female ? FEMALE : MALE))
                                   : an(racenoun))
;
                    verbl_msg = verbuf;
                } else
                    verbl_msg = vampmsg[vampindex];
            }
        }
        break;
    }
    case MS_WERE:
        if (flags.moonphase == FULL_MOON && (night() ^ +!rn2(13))) {
            pline(_("%s throws back %s head and lets out a blood curdling %s!"),
                  Monnam(mtmp), mhis(mtmp),
                  (ptr == mons[PM_HUMAN_WERERAT]) ? _("shriek") : _("howl"));

                        ;
            wake_nearto(mtmp.mx, mtmp.my, 11 * 11);
        } else {
            pline_msg =
                _("whispers inaudibly.  All you can make out is \"moon\".");
        }
        break;
    case MS_BARK:
        if (flags.moonphase == FULL_MOON && night()) {
            pline_msg = _("howls.");
        } else if (mtmp.mpeaceful) {
            if (mtmp.mtame
                && (mtmp.mconf || mtmp.mflee || mtmp.mtrapped
                    || svm.moves > EDOG(mtmp).hungrytime || mtmp.mtame < 5))
                pline_msg = _("whines.");
            else if (mtmp.mtame && EDOG(mtmp).hungrytime > svm.moves + 1000)
                pline_msg = _("yips.");
            else {
                if (ptr != mons[PM_DINGO]) /* dingos do not actually bark */
                    pline_msg = _("barks.");
            }
        } else {
            pline_msg = _("growls.");
        }
        break;
    case MS_MEW:
        if (mtmp.mtame) {
            if (mtmp.mconf || mtmp.mflee || mtmp.mtrapped
                || mtmp.mtame < 5) {
                 ;
                pline_msg = _("yowls.");
            } else if (svm.moves > EDOG(mtmp).hungrytime) {
                 ;
                pline_msg = _("meows.");
            } else if (EDOG(mtmp).hungrytime > svm.moves + 1000) {
                 ;
                pline_msg = _("purrs.");
            } else {
                 ;
                pline_msg = _("mews.");
            }
            break;
        }
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case MS_GROWL:
        ;
        pline_msg = mtmp.mpeaceful ? _("snarls.") : _("growls!");
        break;
    case MS_ROAR:
        ;
        pline_msg = mtmp.mpeaceful ? _("snarls.") : _("roars!");
        break;
    case MS_SQEEK:
        ;
        pline_msg = _("squeaks.");
        break;
    case MS_SQAWK:
        if (ptr == mons[PM_RAVEN] && !mtmp.mpeaceful) {
            verbl_msg = _("Nevermore!");
        } else {
             ;
            pline_msg = _("squawks.");
        }
        break;
    case MS_HISS:
        if (!mtmp.mpeaceful) {
             ;
            pline_msg = _("hisses!");
        } else {
            return ECMD_OK; /* no sound */
        }
        break;
    case MS_BUZZ:
        ;
        pline_msg = mtmp.mpeaceful ? _("drones.") : _("buzzes angrily.");
        break;
    case MS_GRUNT:
        ;
        pline_msg = _("grunts.");
        break;
    case MS_NEIGH:
        if (mtmp.mtame < 5) {
             ;
            pline_msg = _("neighs.");
        } else if (svm.moves > EDOG(mtmp).hungrytime) {
             ;
            pline_msg = _("whinnies.");
        } else {
             ;
            pline_msg = _("whickers.");
        }
        break;
    case MS_MOO:
        ;
        pline_msg = _("moos.");
        break;
    case MS_BELLOW:
        ;

        pline_msg = _("bellows!");
        break;
    case MS_CHIRP:
        ;
        pline_msg = _("chirps.");
        break;
    case MS_WAIL:
        ;
        pline_msg = _("wails mournfully.");
        break;
    case MS_GROAN:
        if (!rn2(3)) {
             ;
            pline_msg = _("groans.");
        }
        break;
    case MS_GURGLE:
        ;
        pline_msg = _("gurgles.");
        break;
    case MS_BURBLE:
        ;
        pline_msg = _("burbles.");
        break;
    case MS_TRUMPET:
        ;
        pline_msg = _("trumpets!");
        wake_nearto(mtmp.mx, mtmp.my, 11 * 11);
        break;
    case MS_SHRIEK:
        ;
        pline_msg = _("shrieks.");
        aggravate();
        break;
    case MS_IMITATE:
        pline_msg = _("imitates you.");
        break;
    case MS_BONES:
        ;
        pline(_("%s rattles noisily."), Monnam(mtmp));
        You(_("freeze for a moment."));
        nomul(-2);
        gm.multi_reason = _("scared by rattling");
        gn.nomovemsg = 0;
        break;
    case MS_LAUGH: {
        let laugh_msg = static_array("domonnoise.laugh_msg", ptr_to(char), 4, [
            _("giggles."), _("chuckles."), _("snickers."), _("laughs."),
        ]);
         ;
        pline_msg = laugh_msg[rn2(4)];
        break;
    }
    case MS_MUMBLE:
        pline_msg = _("mumbles incomprehensibly.");
        break;
    case MS_ORC: /* this used to be an alias for grunt, now it is distinct */
        ;
        pline_msg = _("grunts.");
        break;
    case MS_DJINNI:
        if (mtmp.mtame) {
            verbl_msg = _("Sorry, I'm all out of wishes.");
        } else if (mtmp.mpeaceful) {
            if (ptr == mons[PM_WATER_DEMON])
                pline_msg = _("gurgles.");
            else
                verbl_msg = _("I'm free!");
        } else {
            if (ptr != mons[PM_PRISONER])
                verbl_msg = _("This will teach you not to disturb me!");
            else /* vague because prisoner might already be out of cell */
                verbl_msg = _("Get me out of here.");
        }
        break;
    case MS_BOAST: /* giants */
        if (!mtmp.mpeaceful) {
            switch (rn2(4)) {
            case 0:
                pline(_("%s boasts about %s gem collection."), Monnam(mtmp),
                      mhis(mtmp));
                break;
            case 1:
                pline_msg = _("complains about a diet of mutton.");
                break;
            default:
                pline_msg = _("shouts \"Fee Fie Foe Foo!\" and guffaws.");
                wake_nearto(mtmp.mx, mtmp.my, 7 * 7);
                break;
            }
            break;
        }
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case MS_HUMANOID:
        if (!mtmp.mpeaceful) {
            if (In_endgame(u.uz) && is_mplayer(ptr))
                mplayer_talk(mtmp);
            else
                pline_msg = _("threatens you.");
            break;
        }
        /* Generic peaceful humanoid behavior. */
        if (mtmp.mflee)
            pline_msg = _("wants nothing to do with you.");
        else if (mtmp.mhp < Math.trunc(mtmp.mhpmax / 4))
            pline_msg = _("moans.");
        else if (mtmp.mconf || mtmp.mstun)
            verbl_msg = !rn2(3) ? _("Huh?") : rn2(2) ? _("What?") : _("Eh?");
        else if (!mtmp.mcansee)
            verbl_msg = _("I can't see!");
        else if (mtmp.mtrapped) {
            let t = t_at(mtmp.mx, mtmp.my);

            if (t)
                t.tseen = 1;
            verbl_msg = _("I'm trapped!");
        } else if (mtmp.mhp < Math.trunc(mtmp.mhpmax / 2))
            pline_msg = _("asks for a potion of healing.");
        else if (mtmp.mtame && !mtmp.isminion
                 && svm.moves > EDOG(mtmp).hungrytime)
            verbl_msg = _("I'm hungry.");
        /* Specific monsters' interests */
        else if (is_elf(ptr))
            pline_msg = _("curses orcs.");
        else if (is_dwarf(ptr))
            pline_msg = _("talks about mining.");
        else if (likes_magic(ptr))
            pline_msg = _("talks about spellcraft.");
        else if (ptr.mlet == S_CENTAUR)
            pline_msg = _("discusses hunting.");
        else if (is_gnome(ptr)) {
            if (Hallucination() && (gnomeplan = rn2(4)) % 2) {
                /* skipped for rn2(4) result of 0 or 2;
                   gag from an early episode of South Park called "Gnomes";
                   initially, Tweek (introduced in that episode) is the only
                   one aware of the tiny gnomes after spotting them sneaking
                   about; they are embarked upon a three-step business plan;
                   a diagram of the plan shows:
                               Phase 1         Phase 2      Phase 3
                         Collect underpants       ?          Profit
                   and they never verbalize step 2 so we don't either */
                verbl_msg = (gnomeplan == 1)
                            ? _("Phase one, collect underpants.")
                            : _("Phase three, profit!");
            } else {
                verbl_msg = _("Many enter the dungeon," +
                            " and few return to the sunlit lands.");
            }
        } else
            switch (monsndx(ptr)) {
            case PM_HOBBIT:
                /* 5.0: the 'complains' message used to be given if the
                   hobbit's current hit points were at 10 below max or
                   less, but their max is normally less than 10 so it
                   would almost never occur */
                pline_msg = (mtmp.mhp < mtmp.mhpmax
                             && (mtmp.mhpmax <= 10
                                 || mtmp.mhp <= mtmp.mhpmax - 10))
                            ? _("complains about unpleasant dungeon conditions.")
                            : _("asks you about the One Ring.");
                break;
            case PM_ARCHEOLOGIST:
                pline_msg =
                _("describes a recent article in \"Spelunker Today\" magazine.");
                break;
            case PM_TOURIST:
                verbl_msg = _("Aloha.");
                break;
            default:
                pline_msg = _("discusses dungeon exploration.");
                break;
            }
        break;
    case MS_SEDUCE: {
        let swval;

        if (SYSOPT_SEDUCE()) {
            if (ptr.mlet != S_NYMPH
                && (could_seduce(mtmp, gy.youmonst, null)
                    == 1)) {
                doseduce(mtmp);
                break;
            }
            swval = ((poly_gender() != mtmp.female) ? rn2(3) : 0);
        } else
            swval = ((poly_gender() == 0) ? rn2(3) : 0);
        switch (swval) {
        case 2:
            verbl_msg = _("Hello, sailor.");
            break;
        case 1:
            pline_msg = _("comes on to you.");
            break;
        default:
            pline_msg = _("cajoles you.");
        }
    } break;
    case MS_ARREST:
        if (mtmp.mpeaceful) {
               ;
            verbalize(_("Just the facts, %s."), flags.female ? _("Ma'am") : _("Sir"));
        } else {
            let arrest_msg = static_array("domonnoise.arrest_msg", ptr_to(char), 3, [
                _("Anything you say can be used against you."),
                _("You're under arrest!"), _("Stop in the name of the Law!"),
            ]);
            verbl_msg = arrest_msg[rn2(3)];
        }
        break;
    case MS_BRIBE:
        if (mtmp.mpeaceful && !mtmp.mtame) {
            demon_talk(mtmp);
            break;
        }
        /* FALLTHROUGH */;
        /* FALLTHRU */
    case MS_CUSS:
        if (!mtmp.mpeaceful)
            cuss(mtmp);
        else if (is_lminion(mtmp))
            verbl_msg = _("It's not too late.");
        else
            verbl_msg = _("We're all doomed.");
        break;
    case MS_SPELL:
        /* deliberately vague, since it's not actually casting any spell */
        pline_msg = _("seems to mutter a cantrip.");
        break;
    case MS_NURSE:
        verbl_msg_mcan = _("I hate this job!");
        if (uwep && (uwep.oclass == WEAPON_CLASS || is_weptool(uwep)))
            verbl_msg = _("Put that weapon away before you hurt someone!");
        else if (uarmc || uarm || uarmh || uarms || uarmg || uarmf)
            verbl_msg = Role_if(PM_HEALER)
                            ? _("Doc, I can't help you unless you cooperate.")
                            : _("Please undress so I can examine you.");
        else if (uarmu)
            verbl_msg = _("Take off your shirt, please.");
        else
            verbl_msg = _("Relax, this won't hurt a bit.");
        break;
    case MS_GUARD:
        if (money_cnt(gi.invent))
            verbl_msg = _("Please drop that gold and follow me.");
        else
            verbl_msg = _("Please follow me.");
        break;
    case MS_SOLDIER: {
        let soldier_foe_msg = static_array("domonnoise.soldier_foe_msg", ptr_to(char), 3, [
                _("Resistance is useless!"), _("You're dog meat!"), _("Surrender!"),
            ]),
            soldier_pax_msg = static_array("domonnoise.soldier_pax_msg", ptr_to(char), 3, [
                _("What lousy pay we're getting here!"),
                _("The food's not fit for Orcs!"),
                _("My feet hurt, I've been on them all day!"),
            ]);

        verbl_msg = mtmp.mpeaceful ? soldier_pax_msg[rn2(3)]
                                    : soldier_foe_msg[rn2(3)];
        break;
    }
    case MS_RIDER: {
        let tribtitle;
        let book = null;
        let ms_Death = +(ptr == mons[PM_DEATH]);

        /* 3.6 tribute */
        if (ms_Death && !svc.context.tribute.Deathnotice
            && (book = u_have_novel()) != null) {
            if ((tribtitle = noveltitle(ref_of(book, "corpsenm"))) != 0) {
                sprintf(verbuf, _("Ah, so you have a copy of /%s/."), tribtitle);
                /* no Death featured in these two, so exclude them */
                if (strncmpi((tribtitle), _(("Snuff")), -1)
                    && strncmpi((tribtitle), _(("The Wee Free Men")), -1))
                    strcat(verbuf, _("  I may have been misquoted there."));
                verbl_msg = verbuf;
            }
            svc.context.tribute.Deathnotice = 1;
        } else if (ms_Death && rn2(3) && Death_quote(verbuf, sizeof(array_of(char, BUFSZ)))) {
            verbl_msg = verbuf;
        /* end of tribute addition */
        } else if (ms_Death && !rn2(10)) {
            pline_msg = _("is busy reading a copy of Sandman #8.");
        } else
            verbl_msg = _("Who do you think you are, War?");
        break;
    } /* case MS_RIDER */
    } /* switch */

    if (pline_msg) {
        pline(_("%s %s"), Monnam(mtmp), pline_msg);
    } else if (mtmp.mcan && verbl_msg_mcan) {
           ;
        verbalize1(verbl_msg_mcan);
    } else if (verbl_msg) {
        /* more 3.6 tribute */
        if (ptr == mons[PM_DEATH]) {
            /* Death talks in CAPITAL LETTERS
               and without quotation marks */
            let tmpbuf = stack_array(char, BUFSZ);
            pline(_("%s"), ucase(strcpy(tmpbuf, verbl_msg)));
                  ;
            sound_speak(tmpbuf);
        } else {
               ;
            verbalize1(verbl_msg);
        }
    }
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

/* #chat command */
export function dotalk() { /* int */
    let result;

    result = dochat();
    return result;
}

function dochat() { /* int */
    let mtmp;
    let tx, ty;
    let otmp;

    if (is_silent(gy.youmonst.data)) {
        pline(_("As %s, you cannot speak."),
              an(pmname(gy.youmonst.data, flags.female ? FEMALE : MALE)));
        return ECMD_OK;
    }
    if (Strangled()) {
        You_cant(_("speak.  You're choking!"));
        return ECMD_OK;
    }
    if (u.uswallow) {
        pline(_("They won't hear you out there."));
        return ECMD_OK;
    }
    if (Underwater()) {
        Your(_("speech is unintelligible underwater."));
        return ECMD_OK;
    }
    if (!Deaf() && !Blind() && (otmp = shop_object(u.ux, u.uy)) != null) {
        /* standing on something in a shop and chatting causes the shopkeeper
           to describe the price(s).  This can inhibit other chatting inside
           a shop, but that shouldn't matter much.  shop_object() returns an
           object iff inside a shop and the shopkeeper is present and willing
           (not angry) and able (not asleep) to speak and the position
           contains any objects other than just gold.
        */
        price_quote(otmp);
        return ECMD_TIME;
    }

    if (!getdir(_("Talk to whom? (in what direction)"))) {
        /* decided not to chat */
        return ECMD_CANCEL;
    }

    if (u.usteed && u.dz > 0) {
        if (helpless(u.usteed)) {
            pline(_("%s seems not to notice you."), Monnam(u.usteed));
            return ECMD_TIME;
        } else
            return domonnoise(u.usteed);
    }

    if (u.dz) {
        pline(_("They won't hear you %s there."), u.dz < 0 ? _("up") : _("down"));
        return ECMD_OK;
    }

    if (u.dx == 0 && u.dy == 0) {
        /*
         * Let's not include this.
         * It raises all sorts of questions: can you wear
         * 2 helmets, 2 amulets, 3 pairs of gloves or 6 rings as a marilith,
         * etc...  --KAA
        if (u.umonnum == PM_ETTIN) {
            You("discover that your other head makes boring conversation.");
            return 1;
        }
         */
        pline(_("Talking to yourself is a bad habit for a dungeoneer."));
        return ECMD_OK;
    }

    tx = u.ux + u.dx;
    ty = u.uy + u.dy;

    if (!isok(tx, ty))
        return ECMD_OK;

    mtmp = m_at(tx, ty);

    if (!mtmp || mtmp.mundetected) {
        if ((otmp = vobj_at(tx, ty)) != null && otmp.otyp == STATUE) {
            /* Talking to a statue */
            if (!Blind())
                pline_The(_("%s seems not to notice you."),
                          /* if hallucinating, you can't tell it's a statue */
                          Hallucination() ? rndmonnam(0) : _("statue"));
            return ECMD_OK;
        }
        if (!Deaf() && (IS_WALL(levl()[tx][ty].typ)
                      || levl()[tx][ty].typ == SDOOR)) {
            /* Talking to a wall; secret door remains hidden by behaving
               like a wall; IS_WALL() test excludes solid rock even when
               that serves as a wall bordering a corridor */
            if (Blind() && !IS_WALL(chars[svl.lastseentyp[tx] + ty])) {
                /* when blind, you can only talk to a wall if it has
                   already been mapped as a wall */
                ;
            } else if (!Hallucination()) {
                pline(_("It's like talking to a wall."));
            } else {
                let walltalk = static_array("dochat.walltalk", ptr_to(char), null, [
                    _("gripes about its job."),
                    _("tells you a funny joke!"),
                    _("insults your heritage!"),
                    _("chuckles."),
                    _("guffaws merrily!"),
                    _("deprecates your exploration efforts."),
                    _("suggests a stint of rehab..."),
                    _("doesn't seem to be interested."),
                ]);
                let idx = rn2(10);

                if (idx >= SIZE(walltalk))
                    idx = SIZE(walltalk) - 1;
                pline_The(_("wall %s"), walltalk[idx]);
            }
            return ECMD_OK;
        }
    }

    if (!mtmp || mtmp.mundetected
        || M_AP_TYPE(mtmp) == M_AP_FURNITURE
        || M_AP_TYPE(mtmp) == M_AP_OBJECT)
        return ECMD_OK;

    /* sleeping monsters won't talk, except priests (who wake up) */
    if (helpless(mtmp) && !mtmp.ispriest) {
        /* If it is unseen, the player can't tell the difference between
           not noticing him and just not existing, so skip the message. */
        if (canspotmon(mtmp))
            pline(_("%s seems not to notice you."), Monnam(mtmp));
        return ECMD_OK;
    }

    /* if this monster is waiting for something, prod it into action */
    mtmp.mstrategy = and64u(mtmp.mstrategy, ~STRAT_WAITMASK);

    if (!Deaf() && mtmp.mtame && mtmp.meating) {
        if (!canspotmon(mtmp))
            map_invisible(mtmp.mx, mtmp.my);
        pline(_("%s is eating noisily."), Monnam(mtmp));
        return ECMD_OK;
    }
    if (Deaf()) {
        let xresponse = humanoid(gy.youmonst.data)
                    ? _("falls on deaf ears")
                    : _("is inaudible");

        pline(_("Any response%s%s %s."),
              canspotmon(mtmp) ? _(" from ") : _(""),
              canspotmon(mtmp) ? mon_nam(mtmp) : _(""),
              xresponse);
        return ECMD_OK;
    }
    return domonnoise(mtmp);
}

/* is there a monster at <x,y> that can see the hero and react? */
function responsive_mon_at(x, y) { /* struct monst * */
    let mtmp = isok(x, y) ? m_at(x, y) : null;

    if (mtmp && (helpless(mtmp) /* immobilized monst */
                 || !mtmp.mcansee || !haseyes(mtmp.data) /* blind monst */
                 || (Invis() && !perceives(mtmp.data)) /* unseen hero */
                 || (x != mtmp.mx || y != mtmp.my))) /* worm tail */
        mtmp = null;
    return mtmp;
}

/* player chose 'uarmh' for #tip (pickup.c); visual #chat, sort of... */
export function tiphat() { /* int */
    let $goto = null; var reaction = static_array("tiphat.reaction", ptr_to(char), 3, [ _("curses"), _("gestures rudely"), _("gestures offensively"), ]);
    var mtmp;
    var otmp;
    var x, y, range, glyph, vismon, unseen, statue, res;

    if (!uarmh) /* can't get here from there */
        return 0;

    res = uarmh.bknown ? 0 : 1;
    if (cursed(uarmh)) /* "You can't.  It is cursed." */
        return res; /* if learned of curse, use a move */

    /* might choose a position, but dealing with direct lines is simpler */
    if (!getdir(_("At whom? (in what direction)"))) /* bail on ESC */
        return res; /* iffy; now know it's not cursed for sure (since we got
                     * past prior test) but might have already known that */
    res = 1; /* physical action is going to take place */

    /* most helmets have a short wear/take-off delay and we could set
       'multi' to account for that, but we'll pretend that no extra time
       beyond the current move is necessary */
    You(_("briefly doff your %s."), helm_simple_name(uarmh));

    if (!u.dx && !u.dy) {
        if (u.usteed && u.dz > 0) {
            if (helpless(u.usteed))
                pline(_("%s doesn't notice."), Monnam(u.usteed));
            else
                domonnoise(u.usteed);
        } else if (u.dz) {
            pline(_("There's no one %s there."), (u.dz < 0) ? _("up") : _("down"));
        } else {
            pline_The(_("lout here doesn't acknowledge you..."));
        }
        return res;
    }

    mtmp = null;
    vismon = unseen = statue = 0, glyph = GLYPH_MON_OFF;
    x = u.ux, y = u.uy;
    for (range = 1; range <= BOLT_LIM + 1; ++range) {
        x += u.dx, y += u.dy;
        if (!isok(x, y) || (range > 1 && !couldsee(x, y))) {
            /* switch back to coordinates for previous iteration's 'mtmp' */
            x -= u.dx, y -= u.dy;
            break;
        }
        mtmp = m_at(x, y);
        vismon = (mtmp && canseemon(mtmp) ? 1 : 0);
        glyph = glyph_at(x, y);
        unseen = glyph_is_invisible(glyph);
        statue = +(glyph_is_statue(glyph) /* mimic or hallucinatory statue */
                  || (!vismon && !unseen && (otmp = vobj_at(x, y)) != null
                      && otmp.otyp == STATUE)); /* or actual statue */
        if (vismon && (M_AP_TYPE(mtmp) == M_AP_FURNITURE
                       || M_AP_TYPE(mtmp) == M_AP_OBJECT))
            vismon = 0, mtmp = null;
        if (vismon || unseen || (statue && Hallucination())
            /* unseen adjacent monster will respond if able */
            || (range == 1 && mtmp && responsive_mon_at(x, y)
                && !is_silent(mtmp.data))
            /* we check accessible() after m_at() in case there's a
               visible monster phazing through a wall here */
            || !(accessible(x, y) || levl()[x][y].typ == IRONBARS))
            break;
    }

    $goto_nada: for (;;) { switch ($goto) { default: case "nada": if (!$goto && (unseen || (statue && Hallucination()))) {
        pline(_("That %screature is ignoring you!"), unseen ? _("unseen ") : _(""));
    } else if (!$goto && (!mtmp || !responsive_mon_at(x, y))) {
        if (vismon) /* 'vismon' is only True when 'mtmp' is non-Null */
            pline(_("%s seems not to notice you."), Monnam(mtmp));
        else
            { $goto = "nada"; continue $goto_nada; };
    } else { /* 'mtmp' is guaranteed to be non-Null if we get here */
        /* if this monster is waiting for something, prod it into action */
        switch ($goto) { default: mtmp.mstrategy = and64u(mtmp.mstrategy, ~STRAT_WAITMASK);

        case "nada": if (!$goto && (vismon && humanoid(mtmp.data) && mtmp.mpeaceful && !Conflict())) {
            if ((otmp = which_armor(mtmp, W_ARMH)) == null) {
                pline(_("%s waves."), Monnam(mtmp));
            } else if (otmp.cursed) {
                pline(_("%s grasps %s %s but can't remove it."), Monnam(mtmp),
                      mhis(mtmp), helm_simple_name(otmp));
                otmp.bknown = 1;
            } else {
                pline(_("%s tips %s %s in response."), Monnam(mtmp),
                      mhis(mtmp), helm_simple_name(otmp));
            }
        } else if (!$goto && (vismon && humanoid(mtmp.data))) {
            var which = !Deaf() ? rn2(3) : rn1(2, 1),
                twice = (Deaf() || which > 0 || rn2(3)) ? 0 : rn1(2, 1);

            pline(_("%s %s%s%s at you..."), Monnam(mtmp), reaction[which],
                  twice ? _(" and ") : _(""), twice ? reaction[twice] : _(""));
        } else if (!$goto && ((dist2(coordxy((x)), coordxy((y)), u.ux, u.uy) <= 2) && !Deaf() && domonnoise(mtmp))) {
            if (!vismon)
                map_invisible(x, y);
        } else if (!$goto && (vismon)) {
            pline(_("%s doesn't respond."), Monnam(mtmp));
        } else {
 $goto = null;
            pline(_("%s"), nothing_happens());
        } }
    } } break; }
    return res;
}

/* #ifdef USER_SOUNDS: not in this build */

export const soundprocs = static_struct("soundprocs", struct_sound_procs);

const nosound_procs = static_struct("nosound_procs", struct_sound_procs, { soundname: _("nosound"), soundlib_id: (soundlib_nosound) });

/* The order of these array entries must match the
   order of the enum soundlib_ids in sndprocs.h */

 const struct_sound_choices = struct("struct_sound_choices", {
    sndprocs: ptr_to("struct_sound_procs"),
}); const soundlib_choices = static_array("soundlib_choices", struct_sound_choices, null, [
    { sndprocs: nosound_procs },     /* default, built-in */

]);

export function activate_chosen_soundlib() { /* void */
    let idx = int(gc.chosen_soundlib);

    if (!IndexOk(idx, soundlib_choices))
        panic(_("activate_chosen_soundlib: invalid soundlib (%d)"), idx);

    if (ga.active_soundlib != soundlib_nosound || idx != soundlib_nosound) {
        if (soundprocs.sound_exit_nhsound)
            soundprocs.sound_exit_nhsound(_("assigning a new sound library"));
    }
    struct_assign(soundprocs, soundlib_choices[idx].sndprocs);
    if (soundprocs.sound_init_nhsound)
        soundprocs.sound_init_nhsound();
    ga.active_soundlib = soundprocs.soundlib_id;
    gc.chosen_soundlib = ga.active_soundlib;
}

export function assign_soundlib(idx) { /* void */
    if (!IndexOk(idx, soundlib_choices))
        panic(_("assign_soundlib: invalid soundlib (%d)"), idx);

    gc.chosen_soundlib
        = (soundlib_choices[idx].sndprocs.soundlib_id);
}

/* #if 0: not in this build */

/* copy up to maxlen-1 characters; 'dest' must be able to hold maxlen;
   treat comma as alternate end of 'src' */
export function get_soundlib_name(dest, maxlen) { /* void */
    let count, idx;
    let src;

    idx = int(ga.active_soundlib);
    if (!IndexOk(idx, soundlib_choices))
        panic(_("get_soundlib_name: invalid active_soundlib (%d)"), idx);

    src = soundlib_choices[idx].sndprocs.soundname;
    for (count = 1; count < maxlen; count++) {
        if (chars[src] == ord(',') || chars[src] == ord('\0'))
            break; /*exit on \0 terminator*/
        chars[dest++] = chars[src++];
    }
    chars[dest] = ord('\0');
}

export function soundlib_id_from_opt(op) { /* enum soundlib_ids */
    let idx;
    let defproc = nosound_procs,
                       sp = null;

    for (idx = 0; idx < SIZE(soundlib_choices); ++idx) {
        sp = soundlib_choices[idx].sndprocs;
        if (!strcmp(sp.soundname, op))
            return sp.soundlib_id;
    }
    return defproc.soundlib_id;
}

/*
 * The default sound interface
 *
 * 3rd party sound_procs should be placed in ../sound/x
 * and build procedures should reference them there.
 */

/* #if 0: not in this build */

/* #ifdef SND_SOUNDEFFECTS_AUTOMAP: not in this build */

export function base_soundname_to_filename(
    basename,
    buf,
    bufsz,
    approach) { /* char * */
    let suffix = init_string(static_array("base_soundname_to_filename.suffix", char, sizeof_string(".wav")), _(".wav"), true);
    let consumes = 0, baselen = 0, existinglen = 0;
    let cp = buf;
    let needslash = TRUE;

    if (!buf)
        return 0;

    baselen = strlen(basename);
    consumes = baselen;

    if (approach == sff_havedir_append_rest) {
        /* consumes += (sizeof suffix - 1); */
        existinglen = strlen(buf);
        if (existinglen > 0) {
            cp = buf + existinglen; /* points at trailing NUL */
            cp--;                   /* points at last character */
            if (chars[cp] == ord('/') || chars[cp] == ord('\\'))
                needslash = FALSE;
            cp++;                   /* points back at trailing NUL */
        }
        if (needslash)
            consumes++;  /* for '/' */
        consumes = unsigned(consumes + existinglen);
        consumes = unsigned(consumes + (sizeof_string(".wav") - 1));
    }
    consumes = unsigned(consumes + 1); /* for trailing NUL */
    /* existinglen could be >= bufsz if caller didn't initialize buf
     * to properly include a trailing NUL */
    if (!baselen || consumes > bufsz || existinglen >= bufsz)
        return 0;

    /* #if 0: not in this build */

    if (approach == sff_havedir_append_rest) {
        if (needslash) {
            chars[cp] = ord('/');
            cp++;
            chars[cp] = ord('\0');
            existinglen++;
        }
        Snprintf(cp, unsigned(bufsz - unsigned(existinglen + 1)), _("%s%s"), basename, suffix)
;
    } else if (approach == sff_base_only) {
        Snprintf(buf, bufsz, _("%s"), basename);
    } else {
        return 0;
    }

    return buf;
}

export function set_voice(
    mtmp,
    tone,
    volume,
    moreinfo) { /* void */
/* #ifdef SND_SPEECH: not in this build */
}

export function sound_speak(text) { /* void */
/* #ifdef SND_SPEECH: not in this build */
}

/*sounds.c*/

import { nothing_happens } from "./decl.h.macros.js";
import { S_ANT, S_CENTAUR, S_EEL, S_NYMPH, WEAPON_CLASS } from "./defsym.h.js";
import { GLYPH_MON_OFF } from "./display.h.js";
import {
    canspotmon, glyph_is_invisible, glyph_is_statue, glyph_to_mon, vobj_at,
} from "./display.h.macros.js";
import { In_endgame, Is_astralevel, Is_oracle_level, Is_sanctum } from "./dungeon.h.macros.js";
import { FULL_MOON, PLNMSG_GROWL } from "./flag.h.js";
import { BUFSZ, FALSE, TRUE, coordxy } from "./global.h.js";
import { BLOOD, BOLT_LIM, ECMD_CANCEL, ECMD_OK, ECMD_TIME, HAIR, HEAD, NECK } from "./hack.h.js";
import { IndexOk, ROLL_FROM, You_hear1, rn1, verbalize1 } from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { EDOG, EMIN, EPRI, has_emin } from "./mextra.h.macros.js";
import { ANY_SHOP, BARRACKS, BEEHIVE, COURT, MORGUE, ROOMOFFSET, VAULT, ZOO } from "./mkroom.h.js";
import { ROOM_INDEX } from "./mkroom.h.macros.js";
import {
    carnivorous, haseyes, herbivorous, humanoid, is_animal, is_dwarf, is_elf, is_flyer, is_gnome,
    is_lord, is_mercenary, is_mplayer, is_prince, is_silent, is_undead, likes_magic, monsndx,
    perceives,
} from "./mondata.h.macros.js";
import {
    FEMALE, MALE, MS_ANIMAL, MS_ARREST, MS_BARK, MS_BELLOW, MS_BOAST, MS_BONES, MS_BRIBE, MS_BURBLE,
    MS_BUZZ, MS_CHIRP, MS_CUSS, MS_DJINNI, MS_GROAN, MS_GROWL, MS_GRUNT, MS_GUARD, MS_GUARDIAN,
    MS_GURGLE, MS_HISS, MS_HUMANOID, MS_IMITATE, MS_LAUGH, MS_LEADER, MS_MEW, MS_MOO, MS_MUMBLE,
    MS_NEIGH, MS_NEMESIS, MS_NURSE, MS_ORACLE, MS_ORC, MS_PRIEST, MS_RIDER, MS_ROAR, MS_SEDUCE,
    MS_SELL, MS_SHRIEK, MS_SILENT, MS_SOLDIER, MS_SPELL, MS_SQAWK, MS_SQEEK, MS_TRUMPET, MS_VAMPIRE,
    MS_WAIL, MS_WERE,
} from "./monflag.h.js";
import { M_AP_FURNITURE, M_AP_OBJECT, STRAT_WAITMASK } from "./monst.h.js";
import { DEADMONSTER, M_AP_TYPE, helpless, is_lminion, is_vampshifter } from "./monst.h.macros.js";
import {
    PM_ARCHEOLOGIST, PM_BABY_SILVER_DRAGON, PM_DEATH, PM_DINGO, PM_GECKO, PM_HEALER, PM_HOBBIT,
    PM_HUMAN_WERERAT, PM_LONG_WORM, PM_ORACLE, PM_PRISONER, PM_RAVEN, PM_SILVER_DRAGON, PM_TOURIST,
    PM_VAMPIRE, PM_VAMPIRE_LEADER, PM_WATER_DEMON, PM_WINTER_WOLF, PM_WINTER_WOLF_CUB, PM_WOLF,
} from "./monsters.h.js";
import { is_weptool } from "./obj.h.macros.js";
import { STATUE } from "./objects.h.js";
import { W_ARMH } from "./prop.h.js";
import { IRONBARS, SDOOR } from "./rm.h.js";
import { IS_WALL, fmon, levl, m_at } from "./rm.h.macros.js";
import {
    se_avian_screak, se_canine_whine, se_canine_yelp, se_feline_yelp, se_squeal, se_wail, se_yelp,
} from "./seffects.h.js";
import {
    sff_base_only, sff_havedir_append_rest, soundlib_nosound, struct_sound_procs,
} from "./sndprocs.h.js";
import { SYSOPT_SEDUCE } from "./sys.h.macros.js";
import { cansee, couldsee } from "./vision.h.macros.js";
import { Race_switch, Role_if, Upolyd, mhis, uhis } from "./you.h.macros.js";
import {
    Blind, Conflict, Deaf, Hallucination, Invis, Strangled, Underwater,
} from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, sizeof, sizeof_string, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64u } from "../rt/int64.js";
import { sprintf, strcat, strchr, strcmp, strcpy, strlen } from "../rt/libc.js";
import { init_string, stack_array, static_array, static_struct } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { array_of, elt, ptr_to, ref_of, struct, struct_assign } from "../rt/struct.js";
import { midnight, night } from "./calendar.js";
import { getdir, isok } from "./cmd.js";
import { flags, ga, gc, gi, gm, gn, gu, gy, iflags, svc, svl, svm, svq, svr, u } from "./decl.js";
import { canseemon, glyph_at, map_invisible } from "./display.js";
import { Monnam, mon_nam, noveltitle, pmname, rndmonnam } from "./do_name.js";
import { cursed } from "./do_wear.js";
import { panic } from "./end.js";
import { Death_quote } from "./files.js";
import { money_cnt, nomul } from "./hack.js";
import { dist2, letter, strncmpi, ucase } from "./hacklib.js";
import { currency, g_at, u_have_novel } from "./invent.js";
import { could_seduce, doseduce } from "./mhitu.js";
import { demon_talk } from "./minion.js";
import { search_special } from "./mkroom.js";
import { genus, get_iter_mons, wake_nearto } from "./mon.js";
import { same_race } from "./mondata.js";
import { accessible } from "./monmove.js";
import { mons } from "./monst.js";
import { mplayer_talk } from "./mplayer.js";
import { an, helm_simple_name, vtense } from "./objnam.js";
import { You, You_cant, You_hear, Your, pline, pline_The, verbalize } from "./pline.js";
import { body_part, poly_gender } from "./polyself.js";
import { halu_gname } from "./pray.js";
import { inhistemple, p_coaligned, priest_talk, temple_occupied } from "./priest.js";
import { quest_chat } from "./quest.js";
import { rn2 } from "./rnd.js";
import { doconsult } from "./rumors.js";
import { noisy_shop, price_quote, shk_chat, shop_object, tended_shop } from "./shk.js";
import { t_at } from "./trap.js";
import { gd_sound, vault_occupied } from "./vault.js";
import { aggravate, cuss } from "./wizard.js";
import { which_armor } from "./worn.js";
