/* NetHack 5.0	steal.c	$NHDT-Date: 1720895742 2024/07/13 18:35:42 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.132 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2012. */
/* NetHack may be freely redistributed.  See license for details. */

/* proportional subset of gold; return value actually fits in an int */
export function somegold(lmoney) { /* long long */
    let igold = (lmoney >= LARGEST_INT) ? LARGEST_INT : int(lmoney);

    if (igold < 50)
        ; /* all gold */
    else if (igold < 100)
        igold = rn1(igold - 25 + 1, 25);
    else if (igold < 500)
        igold = rn1(igold - 50 + 1, 50);
    else if (igold < 1000)
        igold = rn1(igold - 100 + 1, 100);
    else if (igold < 5000)
        igold = rn1(igold - 500 + 1, 500);
    else if (igold < 10000)
        igold = rn1(igold - 1000 + 1, 1000);
    else
        igold = rn1(igold - 5000 + 1, 5000);

    return igold;
}

/*
 * Find the first (and hopefully only) gold object in a chain.
 * Used when leprechaun (or you as leprechaun) looks for
 * someone else's gold.  Returns a pointer so the gold may
 * be seized without further searching.
 * May search containers too.
 * Deals in gold only, as leprechauns don't care for lesser coins.
*/
export function findgold(argchain) { /* struct obj * */
    let chain = argchain; /* allow arg to be nonnull */

    while (chain && chain.otyp != GOLD_PIECE)
        chain = chain.nobj;
    return chain;
}

/*
 * Steal gold coins only.  Leprechauns don't care for lesser coins.
*/
export function stealgold(mtmp) { /* void */
    let fgold = g_at(u.ux, u.uy);
    let ygold;
    let tmp;
    let who;
    let whose, what;

    /* skip lesser coins on the floor */
    while (fgold && fgold.otyp != GOLD_PIECE)
        fgold = fgold.v.v_nexthere;

    /* Do you have real gold? */
    ygold = findgold(gi.invent);

    if (fgold && (!ygold || fgold.quan > ygold.quan || !rn2(5))) {
        obj_extract_self(fgold);
        add_to_minv(mtmp, fgold);
        newsym(u.ux, u.uy);
        if (u.usteed) {
            who = u.usteed;
            whose = s_suffix(y_monnam(who));
            what = makeplural(mbodypart(who, FOOT));
        } else {
            who = gy.youmonst;
            whose = _("your");
            what = makeplural(body_part(FOOT));
        }
        /* [ avoid "between your rear regions" :-] */
        if (slithy(who.data))
            what = _("coils");
        /* reduce "rear hooves/claws" to "hooves/claws" */
        if (!strncmp(what, _("rear "), 5))
            what += 5;
        pline(_("%s quickly snatches some gold from %s %s %s!"), Monnam(mtmp),
              (Levitation() || Flying()) ? _("beneath") : _("between"), whose, what);
        if (!ygold || !rn2(5)) {
            if (!tele_restrict(mtmp))
                rloc(mtmp, RLOC_MSG);
            monflee(mtmp, 0, FALSE, FALSE);
        }
    } else if (ygold) {
        let gold_price = objects[GOLD_PIECE].oc_cost;

        tmp = Math.trunc((somegold(money_cnt(gi.invent)) + gold_price - 1) / gold_price);
        tmp = min(tmp, ygold.quan);
        if (tmp < ygold.quan)
            ygold = splitobj(ygold, tmp);
        else
            setnotworn(ygold);
        freeinv(ygold);
        add_to_minv(mtmp, ygold);
        Your(_("purse feels lighter."));
        if (!tele_restrict(mtmp))
            rloc(mtmp, RLOC_MSG);
        monflee(mtmp, 0, FALSE, FALSE);
        disp.botl = TRUE;
    }
}

/* monster who was stealing from hero has just died */
export function thiefdead() { /* void */
    /* hero is busy taking off an item of armor which takes multiple turns */
    gs.stealmid = 0;
    if (ga.afternmv == stealarm) {
        ga.afternmv = unstolenarm;
        gn.nomovemsg = 0;
    }
}

/* checks whether hero can be responsive to seduction attempts; similar to
   Unaware but also includes paralysis */
export function unresponsive() { /* boolean */
    if (gm.multi >= 0)
        return FALSE;

    return (unconscious() || is_fainted()
            || (gm.multi_reason
                && (!strncmp(gm.multi_reason, _("frozen"), 6)
                    || !strncmp(gm.multi_reason, _("paralyzed"), 9))) ? 1 : 0);
}

/* called via (*ga.afternmv)() when hero finishes taking off armor that
   was slated to be stolen but the thief died in the interim */
function unstolenarm() { /* int */
    let obj;

    /* find the object before clearing stealoid; it has already become
       not-worn and is still in hero's inventory */
    for (obj = gi.invent; obj; obj = obj.nobj)
        if (obj.o_id == gs.stealoid)
            break;
    gs.stealoid = 0;
    if (obj) {
        You(_("finish taking off your %s."), armor_simple_name(obj));
    }
    return 0;
}

/* finish stealing an item of armor which takes multiple turns to take off */
function stealarm() { /* int */
    var mtmp;
    var otmp, nextobj;

    botm: { if (!gs.stealoid || !gs.stealmid)
        break botm;;

    for (otmp = gi.invent; otmp; otmp = nextobj) {
        nextobj = otmp.nobj;
        if (otmp.o_id == gs.stealoid) {
            for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
                if (mtmp.m_id == gs.stealmid) {
                    if (DEADMONSTER(mtmp)) {
                        impossible(_("stealarm(): dead monster stealing"));
                        break botm; /* (could just use 'break' here) */
                    }
                    /* maybe the thief polymorphed into something without a
                       steal attack, or perhaps while stealing hero's suit
                       the thief took away other items causing hero to fall
                       into water or lava and then teleport to safety */
                    if (!dmgtype(mtmp.data, AD_SITM)
                        || distu(mtmp.mx, mtmp.my) > 2)
                        break botm;; /* (could just use 'break' here) */
                    if (otmp.unpaid)
                        subfrombill(otmp, shop_keeper(chars[u.ushops]));
                    freeinv(otmp);
                    pline(_("%s steals %s!"), Monnam(mtmp), doname(otmp));
                    mpickobj(mtmp, otmp); /* may free otmp */
                    /* Implies seduction, "you gladly hand over ..."
                       so we don't set mavenge bit here. */
                    monflee(mtmp, 0, FALSE, FALSE);
                    if (!tele_restrict(mtmp))
                        rloc(mtmp, RLOC_MSG);
                    break;
                }
            }
            break;
        }
    }
 }
    gs.stealoid = gs.stealmid = 0; /* in case only one has been reset so far */
    return 0;
}

/* An object you're wearing has been taken off by a monster (theft or
   seduction).  Also used if a worn item gets transformed (stone to flesh). */
export function remove_worn_item(
    obj,
    unchain_ball) { /* void */ /* whether to unpunish or just unwield */
    let oldinuse;

    if (donning(obj))
        cancel_don();
    if (!obj.owornmask)
        return;

    /*
     * Losing worn gear might drop hero into water or lava or onto a
     * location-changing trap or take away the ability to breathe in water.
     * Marking it 'in_use' prevents emergency_disrobe() from dropping it
     * and lava_effects() from destroying it; other cases impacting object
     * location (or destruction) might still have issues.
     *
     * Note:  if a hangup save occurs when 'in_use' is set, the item will
     * be destroyed via useup() during restore.  Maybe remove_worn_item()
     * and emergency_disrobe() should switch to using obj->bypass instead
     * but that would need a lot more cooperation by callers.  It's a
     * tradeoff between protecting the player against unintentional hangup
     * and defending the game against deliberate hangup when player sees a
     * message about something undesirable followed by --More--.
     */
    oldinuse = obj.in_use;
    obj.in_use = 1;

    if (obj.owornmask & W_ARMOR) {
        if (obj == uskin) {
            impossible(_("Removing embedded scales?"));
            skinback(TRUE); /* uarm = uskin; uskin = 0; */
        }
        if (obj == uarm)
            Armor_off();
        else if (obj == uarmc)
            Cloak_off();
        else if (obj == uarmf)
            Boots_off();
        else if (obj == uarmg)
            Gloves_off();
        else if (obj == uarmh)
            Helmet_off();
        else if (obj == uarms)
            Shield_off();
        else if (obj == uarmu)
            Shirt_off();
        /* catchall -- should never happen */
        else
            setworn(null, obj.owornmask & W_ARMOR);
    } else if (obj.owornmask & W_AMUL) {
        Amulet_off();
    } else if (obj.owornmask & W_RING) {
        Ring_gone(obj);
    } else if (obj.owornmask & W_TOOL) {
        Blindf_off(obj);
    } else if (obj.owornmask & W_WEAPONS) {
        if (obj == uwep)
            uwepgone();
        if (obj == uswapwep)
            uswapwepgone();
        if (obj == uquiver)
            uqwepgone();
    }

    if (obj.owornmask & (W_BALL | W_CHAIN)) {
        if (unchain_ball)
            unpunish();
    } else if (obj.owornmask) {
        /* catchall */
        setnotworn(obj);
    }

    if (obj.where == OBJ_DELETED)
        do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(_("remove_worn_item() \"%s\" deleted!"), simpleonames(obj)); iflags.last_msg = save_plnmsg; } } while (0);
    obj.in_use = oldinuse;
}

/* during theft of a worn item: remove_worn_item(), prefaced by a message */
function worn_item_removal(
    mon,
    obj) { /* void */
    const $frame = stack_frame(); try {
    let objbuf = stack_array(char, BUFSZ), article = stack_array(char, 20), p;
    let verb;
    let strip_art;

    strcpy(objbuf, doname(obj));
    /* massage the object description */
    strip_art = !strncmp(objbuf, _("the "), 4) ? 4
                : !strncmp(objbuf, _("an "), 3) ? 3
                  : !strncmp(objbuf, _("a "), 2) ? 2
                    : 0;
    if (strip_art) { /* convert "a/an/the <object>" to "your object" */
        copynchars(article, objbuf, strip_art);
        /* when removing attached iron ball, caller passes 'uchain';
           when formatted, it will be "an iron chain (attached to you)";
           change "an" to "the" rather than to "your" in that situation */
        strsubst(objbuf, article, (obj == uchain) ? _("the ") : _("your "));
    }
    /* these ought to be guarded against matching user-supplied name */
    strsubst(objbuf, _(" (being worn)"), _(""));
    strsubst(objbuf, _(" (alternate weapon; not wielded)"), _(""));
    /* convert "ring (on left hand)" to "ring (from left hand)" */
    if ((p = strstri(objbuf, _(" (on ")))
        && (!strncmp(p + 5, _("left "), 5) || !strncmp(p + 5, _("right "), 6)))
        strsubst(p + 2, _("on"), _("from"));

    /* slightly iffy for alternate weapon that isn't actively dual-wielded,
       but it's better to alert the player to the change in equipment than
       to suppress the message for that case */
    verb = ((obj.owornmask & W_WEAPONS) != 0) ? _("disarms")
           : ((obj.owornmask & W_ACCESSORY) != 0) ? _("removes")
             : _("takes off");
    pline(_("%s %s %s."), Some_Monnam(mon), verb, objbuf);
    iflags.last_msg = PLNMSG_MON_TAKES_OFF_ITEM;
    /* removal might trigger more messages (due to loss of Lev|Fly;
       descending happens before the theft in progress finishes) */
    remove_worn_item(obj, TRUE);
    } finally { stack_pop($frame); }
}

/* Returns 1 when something was stolen (or at least, when N should flee now),
 * returns -1 if the monster died in the attempt.
 * Avoid stealing the object 'stealoid'.
 * Nymphs and monkeys won't steal coins (so that their "steal item" attack
 * doesn't become a superset of leprechaun's "steal gold" attack).
 */
export function steal(mtmp, objnambuf) { /* int */
    const $frame = stack_frame(); try {
    let $goto = null; var Monnambuf = stack_array(char, BUFSZ), dummy = stack_var(boolean), how = static_array("steal.how", ptr_to(char), null, [ _("steal"), _("snatch"), _("grab"), _("take") ]);
    var otmp;

    var tmp, could_petrify, armordelay, olddelay, icnt,
        named = 0, retrycnt = 0;
    var monkey_business = is_animal(mtmp.data),
            seen = canspotmon(mtmp),
            was_doffing, was_punished = Punished();

    if (objnambuf)
        chars[objnambuf] = ord('\0');
    /* the following is true if successful on first of two attacks. */
    if (!monnear(mtmp, u.ux, u.uy))
        return 0;

    /* stealing a worn item might drop hero into water or lava where
       teleporting to safety could result in a previously visible thief
       no longer being visible; it could also be a case of a blinded
       hero being able to see via wearing the Eyes of the Overworld and
       having those stolen; remember the name as it is now; if unseen,
       nymphs will be "Someone" and monkeys will be "Something" */
    strcpy(Monnambuf, Some_Monnam(mtmp));

    /* food being eaten might already be used up but will not have
       been removed from inventory yet; we don't want to steal that,
       so this will cause it to be removed now */
    if (go.occupation)
        maybe_finished_meal(FALSE);

    icnt = inv_cnt(FALSE); /* don't include gold */
    $goto_nothing_to_steal: for (;;) { switch ($goto) { default: case "nothing_to_steal": if ($goto || (!icnt || (icnt == 1 && uskin))) {
        /* Not even a thousand men in armor can strip a naked man. */
 $goto = null;
        /* nymphs might target uchain if invent is empty; monkeys won't;
           hero becomes unpunished but nymph ends up empty handed */
        if (Punished() && !monkey_business && rn2(4)) {
            /* uball is not carried (uchain never is) */
            assert(uball != null && uball.where == OBJ_FLOOR);
            worn_item_removal(mtmp, uchain);
        } else if (u.utrap && u.utraptype == TT_BURIEDBALL
                   && !monkey_business && !rn2(4)) {
            /* buried ball is not tracked via 'uball' and there is no chain
               at all (hence no uchain to take off) */
            pline(_("%s takes off your unseen chain."), Monnambuf);
            openholdingtrap(gy.youmonst, addr_of(dummy));
        } else if (Blind()) {
            pline(_("Somebody tries to rob you, but finds nothing to steal."));
        } else if (inv_cnt(TRUE) > inv_cnt(FALSE)) {
            pline(_("%s tries to rob you, but isn't interested in gold."),
                  Monnambuf);
        } else {
            pline(_("%s tries to rob you, but there is nothing to steal!"),
                  Monnambuf);
        }
        return 1; /* let her flee */
    }

    if (monkey_business || uarmg) {
        ; /* skip ring special cases */
    } else if (Adornment() & LEFT_RING) {
        otmp = uleft;
        { $goto = "gotobj"; continue $goto_nothing_to_steal; }
    } else if (Adornment() & RIGHT_RING) {
        otmp = uright;
        { $goto = "gotobj"; continue $goto_nothing_to_steal; }
    }

 case "retry": $goto = null;
    tmp = 0;
    for (otmp = gi.invent; otmp; otmp = otmp.nobj)
        if ((!uarm || otmp != uarmc) && otmp != uskin
            && otmp.oclass != COIN_CLASS)
            tmp += (otmp.owornmask & (W_ARMOR | W_ACCESSORY)) ? 5 : 1;
    if (!tmp)
        { $goto = "nothing_to_steal"; continue $goto_nothing_to_steal; };
    tmp = rn2(tmp);
    for (otmp = gi.invent; otmp; otmp = otmp.nobj)
        if ((!uarm || otmp != uarmc) && otmp != uskin
            && otmp.oclass != COIN_CLASS) {
            tmp -= (otmp.owornmask & (W_ARMOR | W_ACCESSORY)) ? 5 : 1;
            if (tmp < 0)
                break;
        }
    if (!otmp) {
        impossible(_("Steal fails!"));
        return 0;
    }
    /* can't steal ring(s) while wearing gloves */
    if ((otmp == uleft || otmp == uright) && uarmg)
        otmp = uarmg;
    /* can't steal gloves while wielding - so steal the wielded item. */
    if (otmp == uarmg && uwep)
        otmp = uwep;
    /* can't steal armor while wearing cloak - so steal the cloak. */
    else if (otmp == uarm && uarmc)
        otmp = uarmc;
    /* can't steal shirt while wearing cloak or suit */
    else if (otmp == uarmu && uarmc)
        otmp = uarmc;
    else if (otmp == uarmu && uarm)
        otmp = uarm;

 case "gotobj": $goto = null;
    if (otmp.o_id == gs.stealoid)
        return 0;

    if (otmp.otyp == BOULDER && !throws_rocks(mtmp.data)) {
        if (!retrycnt++)
            { $goto = "retry"; continue $goto_nothing_to_steal; };
        { $goto = "cant_take"; continue $goto_nothing_to_steal; }
    }
    /* animals can't overcome curse stickiness nor unlock chains */
    case "cant_take": if ($goto || (monkey_business)) {
        switch ($goto) { default: var ostuck;

        /* is the player prevented from voluntarily giving up this item?
           (ignores loadstones; the !can_carry() check will catch those) */
        if (otmp == uball)
            ostuck = TRUE; /* effectively worn; curse is implicit */
        else if (otmp == uquiver || (otmp == uswapwep && !u.twoweap))
            ostuck = FALSE; /* not really worn; curse doesn't matter */
        else
            ostuck = (((otmp.cursed && otmp.owornmask)
                      /* nymphs can steal rings from under
                         cursed weapon but animals can't */
                      || (otmp == RING_ON_PRIMARY() && welded(uwep))
                      || (otmp == RING_ON_SECONDARY() && welded(uwep)
                          && bimanual(uwep)) ? 1 : 0));

        case "cant_take": if ($goto || (ostuck || can_carry(mtmp, otmp) == 0)) {
            switch ($goto) { default:

 case "cant_take": $goto = null;
            pline(_("%s tries to %s %s%s but gives up."), Monnambuf,
                  ROLL_FROM(how),
                  (otmp.owornmask & W_ARMOR) ? _("your ") : _(""),
                  (otmp.owornmask & W_ARMOR) ? armor_simple_name(otmp)
                                              : yname(otmp)); }
            /* the fewer items you have, the less likely the thief
               is going to stick around to try again (0) instead of
               running away (1) */
            return +!rn2(Math.trunc(inv_cnt(FALSE) / 5) + 2);
        } }
    }

    if (otmp.otyp == LEASH && otmp.corpsenm) {
        if (monkey_business && otmp.cursed)
            { $goto = "cant_take"; continue $goto_nothing_to_steal; };
        o_unleash(otmp);
    }

    was_doffing = doffing(otmp);
    /* stop donning/doffing now so that afternmv won't be clobbered
       below; stop_occupation doesn't handle donning/doffing */
    olddelay = stop_donning(otmp);
    /* you're going to notice the theft... */
    stop_occupation();

    if (otmp.owornmask & (W_ARMOR | W_ACCESSORY)) {
        switch (otmp.oclass) {
        case TOOL_CLASS:
        case AMULET_CLASS:
        case RING_CLASS:
        case FOOD_CLASS: /* meat ring */
            worn_item_removal(mtmp, otmp);
            break;
        case ARMOR_CLASS:
            armordelay = objects[otmp.otyp].oc_delay;
            if (olddelay > 0 && olddelay < armordelay)
                armordelay = olddelay;
            if (monkey_business || unresponsive()) {
                /* animals usually don't have enough patience to take off
                   items which require extra time; unconscious or paralyzed
                   hero can't be charmed into taking off his own armor */
                if (armordelay >= 1 && !olddelay && rn2(10))
                    { $goto = "cant_take"; continue $goto_nothing_to_steal; };
                worn_item_removal(mtmp, otmp);
                break;
            } else {
                var curssv = otmp.cursed;
                var slowly;

                otmp.cursed = 0;
                slowly = +(armordelay >= 1 || gm.multi < 0);
                if (flags.female)
                    urgent_pline(_("%s charms you.  You gladly %s your %s."),
                                 !seen ? _("She") : Monnambuf,
                                 curssv ? _("let her take")
                                 : !slowly ? _("hand over")
                                   : was_doffing ? _("continue removing")
                                     : _("start removing"),
                                 armor_simple_name(otmp));
                else
                    urgent_pline(_("%s seduces you and %s off your %s."),
                                 !seen ? _("She") : Adjmonnam(mtmp, _("beautiful")),
                                 curssv ? _("helps you to take")
                                 : !slowly ? _("you take")
                                   : was_doffing ? _("you continue taking")
                                     : _("you start taking"),
                                 armor_simple_name(otmp));
                named++;
                /* the following is to set multi for later on */
                nomul(-armordelay);
                gm.multi_reason = _("taking off clothes");
                gn.nomovemsg = 0;
                remove_worn_item(otmp, TRUE);
                otmp.cursed = unsigned(curssv);
                if (gm.multi < 0) {
                    gs.stealoid = otmp.o_id;
                    gs.stealmid = mtmp.m_id;
                    ga.afternmv = stealarm;
                    return 0;
                }
            }
            break;
        default:
            impossible(_("Tried to steal a strange worn thing. [%d]"),
                       otmp.oclass);
        }
        /* hero's blindfold might have just been stolen; if so, replace
           cached "Someone" or "Something" with Monnam */
        if (!seen && canspotmon(mtmp))
            strcpy(Monnambuf, Monnam(mtmp));
    } else if (otmp.owornmask) { /* weapon or ball&chain */
        var item = otmp;

        if (otmp == uball) /* non-Null uball implies non-Null uchain */
            item = uchain; /* yields a more accurate 'takes off' message */
        worn_item_removal(mtmp, item);
        /* if we switched from uball to uchain for the preface message,
           then unpunish() took place and both those pointers are now Null,
           with 'item' a stale pointer to freed chain; the ball is still
           present though and 'otmp' is still valid; if uball was also
           wielded or quivered, the corresponding weapon pointer hasn't
           been cleared yet; do that, with no preface message this time */
        if ((otmp.owornmask & W_WEAPONS) != 0)
            remove_worn_item(otmp, FALSE);
    } } break; }

    /* do this before removing it from inventory */
    if (objnambuf)
        strcpy(objnambuf, yname(otmp));
    /* usually set mavenge bit so knights won't suffer an alignment penalty
       during retaliation; not applicable for removing attached iron ball */
    if (!Conflict() && !(was_punished && !Punished()))
        mtmp.mavenge = 1;

    if (otmp.unpaid)
        subfrombill(otmp, shop_keeper(chars[u.ushops]));
    freeinv(otmp);

    /* if we just gave a message about removing a worn item and there have
       been no intervening messages, shorten '<mon> stole <item>' message */
    if (iflags.last_msg == PLNMSG_MON_TAKES_OFF_ITEM
        && mtmp.data.mlet == S_NYMPH)
        ++named;
    urgent_pline(_("%s stole %s."), named ? _("She") : Monnambuf, doname(otmp));
    encumber_msg();
    could_petrify = +(otmp.otyp == CORPSE
                     && touch_petrifies(mons[otmp.corpsenm]));
    otmp.how_lost = LOST_STOLEN;
    mpickobj(mtmp, otmp); /* may free otmp */
    if (could_petrify && !(mtmp.misc_worn_check & W_ARMG)) {
        minstapetrify(mtmp, TRUE);
        return -1;
    }
    return (gm.multi < 0) ? 0 : 1;
    } finally { stack_pop($frame); }
}

/* Returns 1 if otmp is free'd, 0 otherwise. */
export function mpickobj(mtmp, otmp) { /* int */
    let freed_otmp;
    let snuff_otmp = FALSE;

    if (!otmp) {
        impossible(_("monster (%s) taking or picking up nothing?"),
                   pmname(mtmp.data, Mgender(mtmp)));
        return 1;
    } else if (otmp == uball || otmp == uchain) {
        impossible(_("monster (%s) taking or picking up attached %s (%s)?"),
                   pmname(mtmp.data, Mgender(mtmp)),
                   (otmp == uchain) ? _("chain") : _("ball"), simpleonames(otmp));
        return 0;
    }
    /* if monster is acquiring a thrown or kicked object, the throwing
       or kicking code shouldn't continue to track and place it */
    if (otmp == gt.thrownobj)
        gt.thrownobj = null;
    else if (otmp == gk.kickedobj)
        gk.kickedobj = null;
    /* an unpaid item can be on the floor; if a monster picks it up, take
       it off the shop bill */
    if (otmp.unpaid || (Has_contents(otmp) && count_unpaid(otmp.cobj))) {
        subfrombill(otmp, find_objowner(otmp, otmp.ox, otmp.oy));
    }
    /* don't want hidden light source inside the monster; assumes that
       engulfers won't have external inventories; whirly monsters cause
       the light to be extinguished rather than letting it shine through */
    if (obj_sheds_light(otmp) && attacktype(mtmp.data, AT_ENGL)) {
        /* this is probably a burning object that you dropped or threw */
        if (engulfing_u(mtmp) && !Blind())
            pline(_("%s out."), Tobjnam(otmp, _("go")));
        snuff_otmp = TRUE;
    }
    /* for hero owned object on shop floor, mtmp is taking possession
       and if it's eventually dropped in a shop, shk will claim it */
    otmp.no_charge = 0;
    /* some object handling is only done if mtmp isn't a pet */
    if (!mtmp.mtame) {
        /* if monst is unseen, some info hero knows about this object becomes
           lost; continual pickup and drop by pets makes this too annoying if
           it is applied to them; when engulfed (where monster can't be seen
           because vision is disabled), or when held (or poly'd and holding)
           while blind, behave as if the monster can be 'seen' by touch */
        if (!canseemon(mtmp) && mtmp != u.ustuck)
            unknow_object(otmp);
        /* if otmp has flags set for how it left hero's inventory, change
           those flags; if thrown, now stolen and autopickup might override
           pickup_types and autopickup exceptions based on 'pickup_stolen'
           rather than 'pickup_thrown'; if previously stolen, stays stolen;
           if previously dropped, now forgotten and autopickup will operate
           normally regardless of the setting for 'dropped_nopick' */
        if (otmp.how_lost == LOST_THROWN)
            otmp.how_lost = LOST_STOLEN;
        else if (otmp.how_lost == LOST_DROPPED)
            otmp.how_lost = LOST_NONE;
    }
    /* Must do carrying effects on object prior to add_to_minv() */
    carry_obj_effects(otmp);
    /* add_to_minv() might free otmp [if merged with something else],
       so we have to call it after doing the object checks */
    freed_otmp = add_to_minv(mtmp, otmp);
    /* and we had to defer this until object is in mtmp's inventory */
    if (snuff_otmp)
        snuff_light_source(mtmp.mx, mtmp.my);
    return freed_otmp;
}

/* called for AD_SAMU (the Wizard and quest nemeses) */
export function stealamulet(mtmp) { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);
    let otmp = null, obj = null;
    let real = 0, fake = 0, n;

    /* target every quest artifact, not just current role's;
       if hero has more than one, choose randomly so that player
       can't use inventory ordering to influence the theft */
    for (n = 0, obj = gi.invent; obj; obj = obj.nobj)
        if (any_quest_artifact(obj))
            ++n, otmp = obj;
    if (n > 1) {
        n = rnd(n);
        for (otmp = gi.invent; otmp; otmp = otmp.nobj)
            if (any_quest_artifact(otmp) && !--n)
                break;
    }

    if (!otmp) {
        /* if we didn't find any quest artifact, find another valuable item */
        if (u.uhave.amulet) {
            real = AMULET_OF_YENDOR;
            fake = FAKE_AMULET_OF_YENDOR;
        } else if (u.uhave.bell) {
            real = BELL_OF_OPENING;
            fake = BELL;
        } else if (u.uhave.book) {
            real = SPE_BOOK_OF_THE_DEAD;
        } else if (u.uhave.menorah) {
            real = CANDELABRUM_OF_INVOCATION;
        } else
            return; /* you have nothing of special interest */

        /* If we get here, real and fake have been set up. */
        for (n = 0, obj = gi.invent; obj; obj = obj.nobj)
            if (obj.otyp == real || (obj.otyp == fake && !mtmp.iswiz))
                ++n, otmp = obj;
        if (n > 1) {
            n = rnd(n);
            for (otmp = gi.invent; otmp; otmp = otmp.nobj)
                if ((otmp.otyp == real
                     || (otmp.otyp == fake && !mtmp.iswiz)) && !--n)
                    break;
        }
    }

    if (otmp) { /* we have something to snatch */
        /* take off outer gear if we're targeting [hypothetical]
           quest artifact suit, shirt, gloves, or rings */
        if ((otmp == uarm || otmp == uarmu) && uarmc)
            worn_item_removal(mtmp, uarmc);
        if (otmp == uarmu && uarm)
            worn_item_removal(mtmp, uarm);
        if ((otmp == uarmg || ((otmp == uright || otmp == uleft) && uarmg))
            && uwep) {
            /* gloves are about to be unworn; unwield weapon(s) first */
            if (u.twoweap)    /* remove_worn_item(uswapwep) indirectly */
                worn_item_removal(mtmp, uswapwep); /* clears u.twoweap */
            worn_item_removal(mtmp, uwep);
        }
        if ((otmp == uright || otmp == uleft) && uarmg)
            /* calls Gloves_off() to handle wielded cockatrice corpse */
            worn_item_removal(mtmp, uarmg);

        /* finally, steal the target item */
        if (otmp.owornmask)
            worn_item_removal(mtmp, otmp);
        if (otmp.unpaid)
            subfrombill(otmp, shop_keeper(chars[u.ushops]));
        freeinv(otmp);
        strcpy(buf, doname(otmp));
        mpickobj(mtmp, otmp); /* could merge and free otmp but won't */
        pline(_("%s steals %s!"), Some_Monnam(mtmp), buf);
        if (can_teleport(mtmp.data) && !tele_restrict(mtmp))
            rloc(mtmp, RLOC_MSG);
        encumber_msg();
    }
    } finally { stack_pop($frame); }
}

/* when a mimic gets poked with something, it might take that thing
   (at present, only implemented for when the hero does the poking) */
export function maybe_absorb_item(
    mon,
    obj,
    ochance, achance) { /* void */ /* percent chance for ordinary item, artifact */
    if (obj == uball || obj == uchain || obj.oclass == ROCK_CLASS
        || obj_resists(obj, 100 - ochance, 100 - achance)
        || !touch_artifact(obj, mon))
        return;

    if (carried(obj)) {
        if (obj.owornmask)
            remove_worn_item(obj, TRUE);
        if (obj.unpaid)
            subfrombill(obj, shop_keeper(chars[u.ushops]));
        if (cansee(mon.mx, mon.my)) {
            /* Some_Monnam() avoids "It pulls ... and absorbs it!"
               if hero can see the location but not the monster */
            pline(_("%s pulls %s away from you and absorbs %s!"),
                  Some_Monnam(mon), /* Monnam() or "Something" */
                  yname(obj), (obj.quan > 1) ? _("them") : _("it"));
        } else {
            let hand_s = body_part(HAND);

            if (bimanual(obj))
                hand_s = makeplural(hand_s);
            pline(_("%s %s pulled from your %s!"), upstart(yname(obj)),
                  otense(obj, _("are")), hand_s);
        }
        freeinv(obj);
        encumber_msg();
    } else {
        /* not carried; presumably thrown or kicked */
        if (canspotmon(mon))
            pline(_("%s absorbs %s!"), Monnam(mon), yname(obj));
    }
    /* add to mon's inventory */
    mpickobj(mon, obj);
}

/* drop one object taken from a (possibly dead) monster's inventory */
export function mdrop_obj(
    mon,
    obj,
    verbosely) { /* void */
    let omx = mon.mx, omy = mon.my;
    let unwornmask = obj.owornmask;
    /* call distant_name() for its possible side-effects even if the result
       might not be printed, and do it before extracting obj from minvent */
    let obj_name = distant_name(obj, doname);

    extract_from_minvent(mon, obj, FALSE, TRUE);
    /* don't charge for an owned saddle on dead steed (provided
        that the hero is within the same shop at the time) */
    if (unwornmask && mon.mtame && (unwornmask & W_SADDLE) != 0
        && !obj.unpaid && costly_spot(omx, omy)
        /* being at costly_spot guarantees lev->roomno is not 0 */
        && strchr(in_rooms(u.ux, u.uy, SHOPBASE), levl()[omx][omy].roomno)) {
        obj.no_charge = 1;
    }
    /* obj_no_longer_held(obj); -- done by place_object */
    if (verbosely && cansee(omx, omy))
        pline_mon(mon, _("%s drops %s."), Monnam(mon), obj_name);
    if (!flooreffects(obj, omx, omy, _("fall"))) {
        place_object(obj, omx, omy);
        stackobj(obj);
    }
    /* do this last, after placing obj on floor; removing steed's saddle
       throws rider, possibly inflicting fatal damage and producing bones; this
       is why we had to call extract_from_minvent() with do_intrinsics=FALSE */
    if (!DEADMONSTER(mon) && unwornmask)
        update_mon_extrinsics(mon, obj, FALSE, TRUE);
}

/* some monsters bypass the normal rules for moving between levels or
   even leaving the game entirely; when that happens, prevent them from
   taking the Amulet, invocation items, or quest artifact with them */
export function mdrop_special_objs(mon) { /* void */
    let obj, otmp;

    for (obj = mon.minvent; obj; obj = otmp) {
        otmp = obj.nobj;
        /* the Amulet, invocation tools, and Rider corpses resist even when
           artifacts and ordinary objects are given 0% resistance chance;
           current role's quest artifact is rescued too--quest artifacts
           for the other roles are not */
        if (obj_resists(obj, 0, 0) || is_quest_artifact(obj)) {
            if (mon.mx) {
                mdrop_obj(mon, obj, FALSE);
            } else { /* migrating monster not on map */
                extract_from_minvent(mon, obj, TRUE, TRUE);
                rloco(obj);
            }
        }
    }
}

/* release the objects the creature is carrying */
export function relobj(
    mtmp,
    show,
    is_pet) { /* void */ /* If true, pet should keep wielded/worn items */
    let otmp;
    let omx = mtmp.mx, omy = mtmp.my;

    /* vault guard's gold goes away rather than be dropped... */
    if (mtmp.isgd && (otmp = findgold(mtmp.minvent)) != null) {
        if (canspotmon(mtmp))
            pline(_("%s gold %s."), s_suffix(Monnam(mtmp)),
                  canseemon(mtmp) ? _("vanishes") : _("seems to vanish"));
        obj_extract_self(otmp);
        obfree(otmp, null);
    } /* isgd && has gold */

    while ((otmp = (is_pet ? droppables(mtmp) : mtmp.minvent)) != null) {
        mdrop_obj(mtmp, otmp, (is_pet && flags.verbose ? 1 : 0));
    }

    if (show && cansee(omx, omy))
        newsym(omx, omy);
}

/*steal.c*/

import {
    AMULET_CLASS, ARMOR_CLASS, COIN_CLASS, FOOD_CLASS, RING_CLASS, ROCK_CLASS, S_NYMPH, TOOL_CLASS,
} from "./defsym.h.js";
import { canspotmon } from "./display.h.macros.js";
import { PLNMSG_MON_TAKES_OFF_ITEM } from "./flag.h.js";
import { BUFSZ, FALSE, LARGEST_INT, TRUE, boolean } from "./global.h.js";
import { FOOT, HAND, RLOC_MSG } from "./hack.h.js";
import { ROLL_FROM, distu, min, rn1 } from "./hack.h.macros.js";
import { showdebug } from "./lint.h.macros.js";
import { SHOPBASE } from "./mkroom.h.js";
import { AD_SITM, AT_ENGL } from "./monattk.h.js";
import {
    can_teleport, is_animal, slithy, throws_rocks, touch_petrifies,
} from "./mondata.h.macros.js";
import { DEADMONSTER, engulfing_u } from "./monst.h.macros.js";
import {
    LOST_DROPPED, LOST_NONE, LOST_STOLEN, LOST_THROWN, OBJ_DELETED, OBJ_FLOOR,
} from "./obj.h.js";
import { Has_contents, any_quest_artifact, bimanual, carried } from "./obj.h.macros.js";
import {
    AMULET_OF_YENDOR, BELL, BELL_OF_OPENING, BOULDER, CANDELABRUM_OF_INVOCATION, CORPSE,
    FAKE_AMULET_OF_YENDOR, GOLD_PIECE, LEASH, SPE_BOOK_OF_THE_DEAD,
} from "./objects.h.js";
import {
    LEFT_RING, RIGHT_RING, W_ACCESSORY, W_AMUL, W_ARMG, W_ARMOR, W_BALL, W_CHAIN, W_RING, W_SADDLE,
    W_TOOL, W_WEAPONS,
} from "./prop.h.js";
import { fmon, levl } from "./rm.h.macros.js";
import { cansee } from "./vision.h.macros.js";
import { TT_BURIEDBALL } from "./you.h.js";
import { RING_ON_PRIMARY, RING_ON_SECONDARY } from "./you.h.macros.js";
import { Adornment, Blind, Conflict, Flying, Levitation, Punished } from "./youprop.h.macros.js";
import { char, int, ord, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { assert, strchr, strcpy, strncmp } from "../rt/libc.js";
import { stack_array, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, ptr_to } from "../rt/struct.js";
import { stop_occupation } from "./allmain.js";
import { o_unleash } from "./apply.js";
import { touch_artifact } from "./artifact.js";
import { disp, flags, ga, gi, gk, gm, gn, go, gs, gt, gy, iflags, u } from "./decl.js";
import { canseemon, newsym } from "./display.js";
import { flooreffects } from "./do.js";
import { Adjmonnam, Mgender, Monnam, Some_Monnam, pmname, y_monnam } from "./do_name.js";
import {
    Amulet_off, Armor_off, Blindf_off, Boots_off, Cloak_off, Gloves_off, Helmet_off, Ring_gone,
    Shield_off, Shirt_off, cancel_don, doffing, donning, stop_donning,
} from "./do_wear.js";
import { droppables } from "./dogmove.js";
import { is_fainted, maybe_finished_meal } from "./eat.js";
import { in_rooms, inv_cnt, money_cnt, nomul } from "./hack.js";
import { copynchars, s_suffix, strstri, strsubst, upstart } from "./hacklib.js";
import { carry_obj_effects, count_unpaid, freeinv, g_at, stackobj } from "./invent.js";
import { obj_sheds_light, snuff_light_source } from "./light.js";
import { add_to_minv, obj_extract_self, place_object, splitobj, unknow_object } from "./mkobj.js";
import { can_carry, monnear } from "./mon.js";
import { attacktype, dmgtype } from "./mondata.js";
import { monflee } from "./monmove.js";
import { mons } from "./monst.js";
import { objects } from "./objects.js";
import {
    Tobjnam, armor_simple_name, distant_name, doname, makeplural, otense, simpleonames, yname,
} from "./objnam.js";
import { encumber_msg } from "./pickup.js";
import { You, Your, impossible, pline, pline_mon, urgent_pline } from "./pline.js";
import { body_part, mbodypart, skinback } from "./polyself.js";
import { is_quest_artifact } from "./questpgr.js";
import { unpunish } from "./read.js";
import { rn2, rnd } from "./rnd.js";
import { costly_spot, find_objowner, obfree, shop_keeper, subfrombill } from "./shk.js";
import { rloc, rloco, tele_restrict } from "./teleport.js";
import { minstapetrify, openholdingtrap, unconscious } from "./trap.js";
import { uqwepgone, uswapwepgone, uwepgone, welded } from "./wield.js";
import { extract_from_minvent, setnotworn, setworn, update_mon_extrinsics } from "./worn.js";
import { obj_resists } from "./zap.js";
const __FILE__ = "steal.c";
