/* NetHack 5.0	shk.c	$NHDT-Date: 1736516428 2025/01/10 05:40:28 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.306 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2012. */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * FIXME:
 *  The normal shop messages are verbal.  There are a lot of cases
 *  where an alternate message is given if the hero is deaf or shk
 *  is mute (when poly'd), but that is usually visual-based.  It is
 *  possible for hero to pay for items while blind (only if adjacent
 *  to shk) and the alternate messages fail to account for that.
 */

export const PAY_BUY = 1;
export const PAY_CANT = 0;
export const PAY_SKIP = (-1);
export const PAY_BROKE = (-2);

    const FullyUsedUp = 1;
    const PartlyUsedUp = 2;
    const PartlyIntact = 3;
    const FullyIntact = 4;
    const KnownContainer = 5;
    const UndisclosedContainer = 6;

/* this is similar to sortloot; the shop bill gets converted into an array of
   struct sortbill_item so that sorting and traversal don't need to access
   the original bill or even the shk; the array gets sorted by usedup vs
   unpaid and by cost within each of those two categories */
const struct_sortbill_item = struct("struct_sortbill_item", {
    obj: ptr_to("struct_obj"),
    cost: long,
    quan: long,

    bidx: int,

    usedup: int8,

    queuedpay: boolean,
});

export function NOTANGRY(mon) { return mon.mpeaceful; }
export function ANGRY(mon) { return (+!NOTANGRY(mon)); }
export function IS_SHOP(x) { return +(elt(svr.rooms, x).rtype >= SHOPBASE); }

export function muteshk(shkp) { return (helpless(shkp) || shkp.data.msound <= MS_ANIMAL ? 1 : 0); }

 /* defined in shknam.c */

const and_its_contents = init_string(static_array("and_its_contents", char, sizeof_string(" and its contents")), _(" and its contents"), true);
const the_contents_of = init_string(static_array("the_contents_of", char, sizeof_string("the contents of ")), _("the contents of "), true);

/*
        invariants: obj->unpaid iff onbill(obj) [unless bp->useup]
                    obj->quan <= bp->bquan
 */

const angrytexts = static_array("angrytexts", ptr_to(char), null, [
    _("quite upset"), _("ticked off"), _("furious")
]);

/*
 *  Transfer money from inventory to monster when paying
 *  shopkeepers, priests, oracle, succubus, and other demons.
 *  Simple with only gold coins.
 *  This routine will handle money changing when multiple
 *  coin types is implemented, only appropriate
 *  monsters will pay change.  (Peaceful shopkeepers, priests
 *  and the oracle try to maintain goodwill while selling
 *  their wares or services.  Angry monsters and all demons
 *  will keep anything they get their hands on.
 *  Returns the amount actually paid, so we can know
 *  if the monster kept the change.
 */
export function money2mon(mon, amount) { /* long long */
    let ygold = findgold(gi.invent);

    if (amount <= 0) {
        impossible(_("%s payment in money2mon!"), amount ? _("negative") : _("zero"));
        return 0;
    }
    if (!ygold || ygold.quan < amount) {
        impossible(_("Paying without %s gold?"), ygold ? _("enough") : _(""));
        return 0;
    }

    if (ygold.quan > amount)
        ygold = splitobj(ygold, amount);
    else if (ygold.owornmask)
        remove_worn_item(ygold, FALSE); /* quiver */
    freeinv(ygold);
    add_to_minv(mon, ygold);
    disp.botl = TRUE;
    return amount;
}

/*
 *  Transfer money from monster to inventory.
 *  Used when the shopkeeper pay for items, and when
 *  the priest gives you money for an ale.
 */
export function money2u(mon, amount) { /* void */
    let mongold = findgold(mon.minvent);

    if (amount <= 0) {
        impossible(_("%s payment in money2u!"), amount ? _("negative") : _("zero"));
        return;
    }
    if (!mongold || mongold.quan < amount) {
        impossible(_("%s paying without %s gold?"), a_monnam(mon),
                   mongold ? _("enough") : _(""));
        return;
    }

    if (mongold.quan > amount)
        mongold = splitobj(mongold, amount);
    obj_extract_self(mongold);

    if (!merge_choice(gi.invent, mongold)
            && inv_cnt(FALSE) >= invlet_basic) {
        You(_("have no room for the gold!"));
        dropy(mongold);
    } else {
        addinv(mongold);
        disp.botl = TRUE;
    }
}

function next_shkp(shkp, withbill) { /* struct monst * */
    for (; shkp; shkp = shkp.nmon) {
        if (DEADMONSTER(shkp))
            continue;
        if (shkp.isshk && (ESHK(shkp).billct || !withbill))
            break;
    }

    if (shkp) {
        if (ANGRY(shkp)) {
            if (!ESHK(shkp).surcharge)
                rile_shk(shkp);
        }
    }
    return shkp;
}

/* called in mon.c */
export function shkgone(mtmp) { /* void */
    let eshk = ESHK(mtmp);
    let sroom = elt(svr.rooms, eshk.shoproom - ROOMOFFSET);
    let otmp;
    let p;
    let sx, sy;

    /* [BUG: some of this should be done on the shop level */
    /*       even when the shk dies on a different level.] */
    if (on_level(eshk.shoplevel, u.uz)) {
        discard_damage_owned_by(mtmp);
        sroom.resident = null;
        if (!search_special(ANY_SHOP))
            svl.level.flags.has_shop = 0;

        /* items on shop floor revert to ordinary objects */
        for (sx = sroom.lx; sx <= sroom.hx; sx++)
            for (sy = sroom.ly; sy <= sroom.hy; sy++)
                for (otmp = svl.level.objects[sx][sy]; otmp;
                     otmp = otmp.v.v_nexthere)
                    otmp.no_charge = 0;

        /* Make sure bill is set only when the
           dead shk is the resident shk. */
        if ((p = strchr(u.ushops, eshk.shoproom)) != 0) {
            setpaid(mtmp);
            eshk.bill_p = null;
            /* remove eshk->shoproom from u.ushops */
            do {
                chars[p] = chars[(p + 1)];
            } while (chars[++p]);
        }
    }
}

export function set_residency(shkp, zero_out) { /* void */
    if (on_level((ESHK(shkp).shoplevel), u.uz))
        elt(svr.rooms, ESHK(shkp).shoproom - ROOMOFFSET).resident =
            zero_out ? null : shkp;
}

export function replshk(mtmp, mtmp2) { /* void */
    elt(svr.rooms, ESHK(mtmp2).shoproom - ROOMOFFSET).resident = mtmp2;
    if (inhishop(mtmp) && chars[u.ushops] == ESHK(mtmp).shoproom) {
        ESHK(mtmp2).bill_p = (ESHK(mtmp2).bill[0]);
    }
}

/* do shopkeeper specific structure munging -dlc */
export function restshk(shkp, ghostly) { /* void */
    if (u.uz.dlevel) {
        let eshkp = ESHK(shkp);

        if (eshkp.bill_p != view_of(struct_bill_x, unsigned(-1000)))
            eshkp.bill_p = eshkp.bill[0];
        /* shoplevel can change as dungeons move around */
        /* savebones guarantees that non-homed shk's will be gone */
        if (ghostly) {
            assign_level(eshkp.shoplevel, u.uz);
            if (ANGRY(shkp) && strncmpi(eshkp.customer, svp.plname, PL_NSIZ))
                pacify_shk(shkp, TRUE);
        }
    }
}

/* clear the unpaid bit on a single object and its contents */
function clear_unpaid_obj(shkp, otmp) { /* void */
    if (Has_contents(otmp))
        clear_unpaid(shkp, otmp.cobj);
    if (onbill(otmp, shkp, TRUE))
        otmp.unpaid = 0;
}

/* clear the unpaid bit on all of the objects in the list */
function clear_unpaid(shkp, list) { /* void */
    while (list) {
        clear_unpaid_obj(shkp, list);
        list = list.nobj;
    }
}

/* clear the no_charge bit on a single object and its contents */
function clear_no_charge_obj(
    shkp,
    otmp) { /* void */
    const $frame = stack_frame(); try {
    if (Has_contents(otmp))
        clear_no_charge(shkp, otmp.cobj);
    if (otmp.no_charge) {
        let rm_shkp;
        let rno;
        let x = stack_var(coordxy), y = stack_var(coordxy);

        /*
         * Clear no_charge if
         *  shkp is Null (clear all items on specified list)
         *  or not located somewhere that we expect no_charge (which is
         *    floor [of shop] or inside container [on shop floor])
         *  or can't find object's map coordinates (should never happen
         *    for floor or contained; conceivable if on shop bill somehow
         *    but would have failed the floor-or-contained test since
         *    containers get emptied before going onto bill)
         *  or fails location sanity check (should always be good when
         *    location successfully found)
         *  or not inside any room
         *  or the room isn't a shop
         *  or the shop has no shopkeeper (deserted)
         *  or shopkeeper is the current one (to avoid clearing no_charge
         *    for items located in some rival's shop).
         *
         * no_charge items in a shop which is only temporarily deserted
         * become owned by the shop now and will be for-sale once the shk
         * returns.
         */
        if (!shkp
            || (otmp.where != OBJ_FLOOR
                && otmp.where != OBJ_CONTAINED
                && otmp.where != OBJ_BURIED)
            || !get_obj_location(otmp, x, y, OBJ_CONTAINED | OBJ_BURIED)
            || !isok(x[0], y[0])
            || (rno = levl()[x[0]][y[0]].roomno) < ROOMOFFSET
            || !IS_SHOP(rno - ROOMOFFSET)
            || (rm_shkp = elt(svr.rooms, rno - ROOMOFFSET).resident) == null
            || rm_shkp == shkp)
            otmp.no_charge = 0;
    }
    } finally { stack_pop($frame); }
}

/* clear the no_charge bit on all of the objects in the list */
function clear_no_charge(shkp, list) { /* void */
    while (list) {
        /* handle first element of list and any contents it may have */
        clear_no_charge_obj(shkp, list);
        /* move on to next element of list */
        list = list.nobj;
    }
}

/* clear no_charge from objects in pets' inventories belonging to shkp */
function clear_no_charge_pets(shkp) { /* void */
    let mtmp;

    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon)
        if (mtmp.mtame && mtmp.minvent)
            clear_no_charge(shkp, mtmp.minvent);
}

/* either you paid or left the shop or the shopkeeper died */
export function setpaid(shkp) { /* void */
    let obj;
    let mtmp;

    clear_unpaid(shkp, gi.invent);
    clear_unpaid(shkp, fobj());
    if (svl.level.buriedobjlist)
        clear_unpaid(shkp, svl.level.buriedobjlist);
    if (gt.thrownobj)
        clear_unpaid_obj(shkp, gt.thrownobj);
    if (gk.kickedobj)
        clear_unpaid_obj(shkp, gk.kickedobj);
    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon)
        if (mtmp.minvent)
            clear_unpaid(shkp, mtmp.minvent);
    for (mtmp = gm.migrating_mons; mtmp; mtmp = mtmp.nmon)
        if (mtmp.minvent)
            clear_unpaid(shkp, mtmp.minvent);

    /* clear obj->no_charge for all obj in shkp's shop */
    clear_no_charge(shkp, fobj());
    clear_no_charge(shkp, svl.level.buriedobjlist);

    while ((obj = gb.billobjs) != null) {
        obj_extract_self(obj);
        dealloc_obj(obj);
    }
    if (shkp) {
        ESHK(shkp).billct = 0;
        ESHK(shkp).credit = 0;
        ESHK(shkp).debit = 0;
        ESHK(shkp).loan = 0;
    }
}

/* Remembers that a shopkeeper has quoted a particular price for a
   particular type of object. */
export function record_price_quote(otyp, price, buyprice) { /* void */
    let oc = objects[otyp];
    if (buyprice) {
        if (price > oc.oc_buy_maxseen) oc.oc_buy_maxseen = price;
        if (price < oc.oc_buy_minseen) oc.oc_buy_minseen = price;
    } else {
        if (price > oc.oc_sell_maxseen) oc.oc_sell_maxseen = price;
        if (price < oc.oc_sell_minseen) oc.oc_sell_minseen = price;
    }
}

/* Appends price-quote information to the given buffer, updating the
   given end of string position. *eos mut be buf + strlen(buf). If the
   update would make bug longer than BUFSZ, instead does nothing. */
export function append_price_quote(buf, eos, otyp) { /* void */
    const $frame = stack_frame(); try {
    let buf2 = stack_array(char, BUFSZ);
    let eos2 = buf2;
    let sep = _("");
    let len = unsigned(eos[0] - buf);
    let len2;

    if (objects[otyp].oc_sell_minseen > objects[otyp].oc_sell_maxseen &&
        objects[otyp].oc_buy_minseen > objects[otyp].oc_buy_maxseen)
        return;

    eos2 += sprintf(eos2, _(" {"));

    if (objects[otyp].oc_buy_minseen < objects[otyp].oc_buy_maxseen) {
        eos2 += sprintf(eos2, _("buy %llu-%llu"),
                        objects[otyp].oc_buy_minseen,
                        objects[otyp].oc_buy_maxseen);
        sep = _(" ");
    } else if (objects[otyp].oc_buy_minseen == objects[otyp].oc_buy_maxseen) {
        eos2 += sprintf(eos2, _("buy %llu"),
                        objects[otyp].oc_buy_minseen);
        sep = _(" ");
    }

    if (objects[otyp].oc_sell_minseen < objects[otyp].oc_sell_maxseen) {
        eos2 += sprintf(eos2, _("%ssell %llu-%llu"), sep,
                        objects[otyp].oc_sell_minseen,
                        objects[otyp].oc_sell_maxseen);
    } else if (objects[otyp].oc_sell_minseen == objects[otyp].oc_sell_maxseen) {
        eos2 += sprintf(eos2, _("%ssell %llu"), sep,
                        objects[otyp].oc_sell_minseen);
    }

    eos2 += sprintf(eos2, _("}"));
    len2 = unsigned(eos2 - buf2);
    if (len2 < unsigned(unsigned(BUFSZ - len) - 1)) {
        strcpy(eos[0], buf2);
        eos[0] += len2;
    }
    } finally { stack_pop($frame); }
}

function addupbill(shkp) { /* long long */
    let ct = ESHK(shkp).billct;
    let bp = ESHK(shkp).bill_p;
    let total = 0;

    while (ct--) {
        total += bp.price * bp.bquan;
        bp = ptr_add(bp, 1);
    }
    return total;
}

function call_kops(shkp, nearshop) { /* void */
    const $frame = stack_frame(); try {
    /* Keystone Kops srt@ucla */
    let nokops;

    if (!shkp)
        return;

     ;
    if (!Deaf())
        pline(_("An alarm sounds!"));

    nokops = ((svm.mvitals[PM_KEYSTONE_KOP].mvflags & G_GONE)
              && (svm.mvitals[PM_KOP_SERGEANT].mvflags & G_GONE)
              && (svm.mvitals[PM_KOP_LIEUTENANT].mvflags & G_GONE)
              && (svm.mvitals[PM_KOP_KAPTAIN].mvflags & G_GONE) ? 1 : 0);

    if (!angry_guards(+!!Deaf()) && nokops) {
        if (flags.verbose && !Deaf())
            pline(_("But no one seems to respond to it."));
        return;
    }

    if (nokops)
        return;

    {
        let mm = stack_struct(struct_nhcoord);
        let sx = stack_var(coordxy, 0), sy = stack_var(coordxy, 0);

        choose_stairs(sx, sy, TRUE);

        if (nearshop) {
            /* Create swarm around you, if you merely "stepped out" */
            if (flags.verbose)
                pline_The(_("Keystone Kops appear!"));
            mm.x = u.ux;
            mm.y = u.uy;
            makekops(mm);
            return;
        }
        if (flags.verbose)
            pline_The(_("Keystone Kops are after you!"));
        /* Create swarm near down staircase (hinders return to level) */
        if (isok(sx[0], sy[0])) {
            mm.x = sx[0];
            mm.y = sy[0];
            makekops(mm);
        }
        /* Create swarm near shopkeeper (hinders return to shop) */
        mm.x = shkp.mx;
        mm.y = shkp.my;
        makekops(mm);
    }
    } finally { stack_pop($frame); }
}

/* x,y is strictly inside shop */
export function inside_shop(x, y) { /* char */
    let rno;

    rno = levl()[x][y].roomno;
    if ((rno < ROOMOFFSET) || levl()[x][y].edge || !IS_SHOP(rno - ROOMOFFSET))
        rno = NO_ROOM;
    return rno;
}

export function u_left_shop(leavestring, newlev) { /* void */
    let shkp;
    let eshkp;

    /*
     * IF player
     * ((didn't leave outright) AND
     *  ((he is now strictly-inside the shop) OR
     *   (he wasn't strictly-inside last turn anyway)))
     * THEN (there's nothing to do, so just return)
     */
    if (!chars[leavestring] && (!levl()[u.ux][u.uy].edge || levl()[u.ux0][u.uy0].edge))
        return;

    shkp = shop_keeper(chars[leavestring] ? chars[leavestring] : chars[u.ushops0]);
    if (!shkp || !inhishop(shkp))
        return; /* shk died, teleported, changed levels... */

    eshkp = ESHK(shkp);
    if (!eshkp.billct && !eshkp.debit) /* bill is settled */
        return;

    if (!chars[leavestring] && !muteshk(shkp)) {
        /*
         * Player just stepped onto shop-boundary (known from above logic).
         * Try to intimidate him into paying his bill
         */
        let not_upset = +!eshkp.surcharge;
        if (!Deaf() && !muteshk(shkp)) {
               ;
            verbalize(not_upset ? _("%s!  Please pay before leaving.")
                                : _("%s!  Don't you leave without paying!"),
                      svp.plname);
        } else {
            pline(_("%s %s that you need to pay before leaving%s"),
                  Shknam(shkp),
                  not_upset ? _("points out") : _("makes it clear"),
                  not_upset ? _(".") : _("!"));
        }
        return;
    }

    if (rob_shop(shkp)) {
        call_kops(shkp, (!newlev && levl()[u.ux0][u.uy0].edge ? 1 : 0));
    }
}

export function credit_report(shkp, idx, silent) { /* void */
    let eshkp = ESHK(shkp);
    let credit_snap = static_array("credit_report.credit_snap", array_of(long, 3), 2, [[0, 0, 0], [0, 0, 0]]);

    if (!idx) {
        credit_snap[BEFORE][0] = credit_snap[NOW][0] = 0;
        credit_snap[BEFORE][1] = credit_snap[NOW][1] = 0;
        credit_snap[BEFORE][2] = credit_snap[NOW][2] = 0;
    } else {
        idx = 1;
    }

    credit_snap[idx][0] = eshkp.credit;
    credit_snap[idx][1] = eshkp.debit;
    credit_snap[idx][2] = eshkp.loan;

    if (idx && !silent) {
        let amt = 0;
        let msg = _("debt has increased");

        if (credit_snap[NOW][0] < credit_snap[BEFORE][0]) {
            amt = credit_snap[BEFORE][0] - credit_snap[NOW][0];
            msg = _("credit has been reduced");
        } else if (credit_snap[NOW][1] > credit_snap[BEFORE][1]) {
            amt = credit_snap[NOW][1] - credit_snap[BEFORE][1];
        } else if (credit_snap[NOW][2] > credit_snap[BEFORE][2]) {
            amt = credit_snap[NOW][2] - credit_snap[BEFORE][2];
        }
        if (amt)
            Your(_("%s by %lld %s."), msg, amt, currency(amt));
    }
}

/* robbery from outside the shop via telekinesis or grappling hook */
export function remote_burglary(x, y) { /* void */
    let shkp;
    let eshkp;

    shkp = shop_keeper(chars[in_rooms(x, y, SHOPBASE)]);
    if (!shkp || !inhishop(shkp))
        return; /* shk died, teleported, changed levels... */

    eshkp = ESHK(shkp);
    if (!eshkp.billct && !eshkp.debit) /* bill is settled */
        return;

    if (rob_shop(shkp)) {
        /*[might want to set 2nd arg based on distance from shop doorway]*/
        call_kops(shkp, FALSE);
    }
}

/* shop merchandise has been taken; pay for it with any credit available;
   return false if the debt is fully covered by credit, true otherwise */
function rob_shop(shkp) { /* boolean */
    let eshkp;
    let total;

    eshkp = ESHK(shkp);
    rouse_shk(shkp, TRUE);
    total = (addupbill(shkp) + eshkp.debit);
    if (eshkp.credit >= total) {
        Your(_("credit of %lld %s is used to cover your shopping bill."),
             eshkp.credit, currency(eshkp.credit));
        total = 0; /* credit gets cleared by setpaid() */
    } else {
        You(_("escaped the shop without paying!"));
        total -= eshkp.credit;
    }
    setpaid(shkp);
    if (!total)
        return FALSE;

    /* by this point, we know an actual robbery has taken place */
    eshkp.robbed += total;
    You(_("stole %lld %s worth of merchandise."), total, currency(total));
    livelog_printf(LL_ACHIEVE, _("stole %lld %s worth of merchandise from %s %s"),
                   total, currency(total), s_suffix(shkname(shkp)),
                   elt(shtypes, eshkp.shoptype - SHOPBASE).name);

    if (!Role_if(PM_ROGUE)) /* stealing is unlawful */
        adjalign(-sgn(u.ualign.type));

    hot_pursuit(shkp);
    return TRUE;
}

/* give a message when entering an untended shop (caller has verified that) */
function deserted_shop(enterstring) { /* void */
    let mtmp;
    let r = elt(svr.rooms, (chars[enterstring]) - ROOMOFFSET);
    let x, y, m = 0, n = 0;

    for (x = r.lx; x <= r.hx; ++x)
        for (y = r.ly; y <= r.hy; ++y) {
            if (u_at(x, y))
                continue;
            if ((mtmp = m_at(x, y)) != null) {
                ++n;
                if (sensemon(mtmp) || ((M_AP_TYPE(mtmp) == M_AP_NOTHING
                                        || M_AP_TYPE(mtmp) == M_AP_MONSTER)
                                       && canseemon(mtmp)))
                    ++m;
            }
        }

    if (Blind() && !(Blind_telepat() || Detect_monsters()))
        ++n; /* force feedback to be less specific */

    pline(_("This shop %s %s."), (m < n) ? _("seems to be") : _("is"),
          !n ? _("deserted") : _("untended"));
}

/* called from check_special_room(hack.c) */
export function u_entered_shop(enterstring) { /* void */
    let empty_shops = static_array("u_entered_shop.empty_shops", char, 5);
    let shkp;
    let eshkp;
    let rt;

    if (!chars[enterstring])
        return;

    shkp = shop_keeper(chars[enterstring]);
    if (!shkp) {
        if (!strchr(empty_shops, chars[enterstring])
            && (in_rooms(u.ux, u.uy, SHOPBASE)
                != in_rooms(u.ux0, u.uy0, SHOPBASE)))
            deserted_shop(enterstring);
        strcpy(empty_shops, u.ushops);
        chars[u.ushops + 0] = ord('\0');
        return;
    }

    eshkp = ESHK(shkp);

    if (!inhishop(shkp)) {
        /* dump core when referenced */
        eshkp.bill_p = view_of(struct_bill_x, unsigned(-1000));
        if (!strchr(empty_shops, chars[enterstring]))
            deserted_shop(enterstring);
        strcpy(empty_shops, u.ushops);
        chars[u.ushops + 0] = ord('\0');
        return;
    }
    record_achievement(ACH_SHOP);

    eshkp.bill_p = (eshkp.bill[0]);

    if ((!eshkp.visitct || chars[eshkp.customer])
        && strncmpi(eshkp.customer, svp.plname, PL_NSIZ)) {
        /* You seem to be new here */
        eshkp.visitct = 0;
        eshkp.following = 0;
        strncpy(eshkp.customer, svp.plname, PL_NSIZ);
        pacify_shk(shkp, TRUE);
    }

    if (muteshk(shkp) || eshkp.following)
        return; /* no dialog */

    if (Invis()) {
        pline(_("%s senses your presence."), Shknam(shkp));
        if (!Deaf() && !muteshk(shkp)) {
               ;
            verbalize(_("Invisible customers are not welcome!"));
        } else {
            pline(_("%s stands firm as if %s knows you are there."),
                  Shknam(shkp), noit_mhe(shkp));
        }
        return;
    }

    rt = elt(svr.rooms, chars[enterstring] - ROOMOFFSET).rtype;

    if (ANGRY(shkp)) {
        if (!Deaf() && !muteshk(shkp)) {
               ;
            verbalize(_("So, %s, you dare return to %s %s?!"), svp.plname,
                      s_suffix(shkname(shkp)), elt(shtypes, rt - SHOPBASE).name);
        } else {
            pline(_("%s seems %s over your return to %s %s!"),
                  Shknam(shkp), ROLL_FROM(angrytexts),
                  noit_mhis(shkp), elt(shtypes, rt - SHOPBASE).name);
        }
    } else if (eshkp.surcharge) {
        if (!Deaf() && !muteshk(shkp)) {
               ;
            verbalize(_("Back again, %s?  I've got my %s on you."),
                      svp.plname, mbodypart(shkp, EYE));
        } else {
            pline_The(_("atmosphere at %s %s seems unwelcoming."),
                      s_suffix(shkname(shkp)), elt(shtypes, rt - SHOPBASE).name);
        }
    } else if (eshkp.robbed) {
        if (!Deaf()) {
             ;
            pline(_("%s mutters imprecations against shoplifters."),
                  Shknam(shkp));
        } else {
            pline(_("%s is combing through %s inventory list."),
                  Shknam(shkp), noit_mhis(shkp));
        }
    } else {
        if (!Deaf() && !muteshk(shkp)) {
            set_voice(shkp, 0, 80, 0);
            verbalize(_("%s, %s!  Welcome%s to %s %s!"), Hello(shkp), svp.plname,
                      eshkp.visitct++ ? _(" again") : _(""),
                      s_suffix(shkname(shkp)), elt(shtypes, rt - SHOPBASE).name);
        } else {
            You(_("enter %s %s%s!"),
                s_suffix(shkname(shkp)),
                elt(shtypes, rt - SHOPBASE).name,
                eshkp.visitct++ ? _(" again") : _(""));
        }
    }
    /* can't do anything about blocking if teleported in */
    if (!inside_shop(u.ux, u.uy)) {
        let should_block, not_upset = +!eshkp.surcharge;
        let cnt;
        let tool;
        let pick = carrying(PICK_AXE),
                   mattock = carrying(DWARVISH_MATTOCK);

        if (pick || mattock) {
            cnt = 1;               /* so far */
            if (pick && mattock) { /* carrying both types */
                tool = _("digging tool");
                cnt = 2; /* `more than 1' is all that matters */
            } else if (pick) {
                tool = _("pick-axe");
                /* hack: `pick' already points somewhere into inventory */
                while ((pick = pick.nobj) != null)
                    if (pick.otyp == PICK_AXE)
                        ++cnt;
            } else { /* assert(mattock != 0) */
                tool = _("mattock");
                while ((mattock = mattock.nobj) != null)
                    if (mattock.otyp == DWARVISH_MATTOCK)
                        ++cnt;
                /* [ALI] Shopkeeper identifies mattock(s) */
                if (!Blind())
                    makeknown(DWARVISH_MATTOCK);
            }
            if (!Deaf() && !muteshk(shkp)) {
                   ;
                verbalize(not_upset
                              ? _("Will you please leave your %s%s outside?")
                              : _("Leave the %s%s outside."),
                          tool, plur(cnt));
            } else {
                pline(_("%s %s to let you in with your %s%s."),
                      Shknam(shkp),
                      not_upset ? _("is hesitant") : _("refuses"),
                      tool, plur(cnt));
            }
            should_block = TRUE;
        } else if (u.usteed) {
            if (!Deaf() && !muteshk(shkp)) {
                   ;
                verbalize(not_upset ? _("Will you please leave %s outside?")
                                    : _("Leave %s outside."),
                          y_monnam(u.usteed));
            } else {
                pline(_("%s %s to let you in while you're riding %s."),
                      Shknam(shkp),
                      not_upset ? _("doesn't want") : _("refuses"),
                      y_monnam(u.usteed));
            }
            should_block = TRUE;
        } else {
            should_block =
                (Fast() && (sobj_at(PICK_AXE, u.ux, u.uy)
                          || sobj_at(DWARVISH_MATTOCK, u.ux, u.uy)) ? 1 : 0);
        }
        if (should_block)
            dochug(shkp); /* shk gets extra move */
    }
    return;
}

/* called when removing a pick-axe or mattock from a container */
export function pick_pick(obj) { /* void */
    let shkp;

    if (obj.unpaid || !is_pick(obj))
        return;
    shkp = shop_keeper(chars[u.ushops]);
    if (shkp && inhishop(shkp)) {
        let pickmovetime = static_var("pick_pick.pickmovetime", long, 0);

        /* if you bring a sack of N picks into a shop to sell,
           don't repeat this N times when they're taken out */
        if (svm.moves != pickmovetime[0]) {
            if (!Deaf() && !muteshk(shkp)) {
                   ;
                verbalize(_("You sneaky %s!  Get out of here with that pick!"),
                      cad(FALSE));
            } else {
                pline(_("%s %s your pick!"),
                      Shknam(shkp),
                      haseyes(shkp.data) ? _("glares at")
                                          : _("is dismayed because of"));
            }
        }
        pickmovetime[0] = svm.moves;
    }
}

/*
   Decide whether two unpaid items are mergeable; caller is responsible for
   making sure they're unpaid and the same type of object; we check the price
   quoted by the shopkeeper and also that they both belong to the same shk.
 */
export function same_price(obj1, obj2) { /* boolean */
    let shkp1, shkp2;
    let bp1 = null, bp2 = null;
    let are_mergable = FALSE;

    /* look up the first object by finding shk whose bill it's on */
    for (shkp1 = next_shkp(fmon(), TRUE); shkp1;
         shkp1 = next_shkp(shkp1.nmon, TRUE))
        if ((bp1 = onbill(obj1, shkp1, TRUE)) != null)
            break;
    /* second object is probably owned by same shk; if not, look harder */
    if (shkp1 && (bp2 = onbill(obj2, shkp1, TRUE)) != null) {
        shkp2 = shkp1;
    } else {
        for (shkp2 = next_shkp(fmon(), TRUE); shkp2;
             shkp2 = next_shkp(shkp2.nmon, TRUE))
            if ((bp2 = onbill(obj2, shkp2, TRUE)) != null)
                break;
    }

    if (!bp1 || !bp2)
        impossible(_("same_price: object wasn't on any bill!"));
    else
        are_mergable = +(shkp1 == shkp2 && bp1.price == bp2.price);
    return are_mergable;
}

/*
 * Figure out how much is owed to a given shopkeeper.
 * At present, we ignore any amount robbed from the shop, to avoid
 * turning the `$' command into a way to discover that the current
 * level is bones data which has a shk on the warpath.
 */
function shop_debt(eshkp) { /* long long */
    let bp;
    let ct;
    let debt = eshkp.debit;

    for (bp = eshkp.bill_p, ct = eshkp.billct; ct > 0; bp = ptr_add(bp, 1), ct--)
        debt += bp.price * bp.bquan;
    return debt;
}

/* called in response to the `$' command */
export function shopper_financial_report() { /* void */
    let shkp, this_shkp = shop_keeper(inside_shop(u.ux, u.uy));
    let eshkp;
    let amt;
    let pass;

    eshkp = this_shkp ? ESHK(this_shkp) : null;
    if (eshkp && !(eshkp.credit || shop_debt(eshkp))) {
        You(_("have no credit or debt in here."));
        this_shkp = null; /* skip first pass */
    }

    /* pass 0: report for the shop we're currently in, if any;
       pass 1: report for all other shops on this level. */
    for (pass = this_shkp ? 0 : 1; pass <= 1; pass++)
        for (shkp = next_shkp(fmon(), FALSE); shkp;
             shkp = next_shkp(shkp.nmon, FALSE)) {
            if (+(shkp != this_shkp) ^ pass)
                continue;
            eshkp = ESHK(shkp);
            if ((amt = eshkp.credit) != 0)
                You(_("have %lld %s credit at %s %s."), amt, currency(amt),
                    s_suffix(shkname(shkp)),
                    elt(shtypes, eshkp.shoptype - SHOPBASE).name);
            else if (shkp == this_shkp)
                You(_("have no credit in here."));
            if ((amt = shop_debt(eshkp)) != 0)
                You(_("owe %s %lld %s."), shkname(shkp), amt, currency(amt));
            else if (shkp == this_shkp)
                You(_("don't owe any gold here."));
        }
}

/* 1: shopkeeper is currently in her shop or its boundary; 0: not */
export function inhishop(shkp) { /* int */
    let shkrooms;
    let eshkp = ESHK(shkp);

    if (!on_level(eshkp.shoplevel, u.uz))
        return FALSE;
    shkrooms = in_rooms(shkp.mx, shkp.my, SHOPBASE);
    return +(strchr(shkrooms, eshkp.shoproom) != 0);
}

/* return the shopkeeper for rooms[rmno-2]; returns Null if there isn't one */
export function shop_keeper(rmno) { /* struct monst * */
    let shkp;

    shkp = (rmno >= ROOMOFFSET) ? elt(svr.rooms, rmno - ROOMOFFSET).resident : null;
    if (shkp) {
        if (has_eshk(shkp)) {
            if (ANGRY(shkp)) {
                if (!ESHK(shkp).surcharge)
                    rile_shk(shkp);
            }
        } else {
            /* would have segfaulted on ESHK dereference previously */
            impossible(_("%s? (rmno=%d, rtype=%d, mnum=%d, \"%s\")"),
                       shkp.isshk ? _("shopkeeper career change")
                                   : _("shop resident not shopkeeper"),
                       rmno,
                       (elt(svr.rooms, rmno - ROOMOFFSET).rtype),
                       shkp.mnum,
                       /* [real shopkeeper name is kept in ESHK,
                          not MGIVENNAME] */
                       has_mgivenname(shkp) ? MGIVENNAME(shkp) : _("anonymous"));
            /* not sure if this is appropriate, because it does nothing to
               correct the underlying svr.rooms[].resident issue but... */
            return null;
        }
    }
    return shkp;
}

/* find the shopkeeper who owns 'obj'; needed to handle shared shop walls */
export function find_objowner(
    obj,
    x, y) { /* struct monst * */ /* caller passes obj's location since obj->ox,oy * might be stale; don't update coordinates here * because if we're called during sanity checking * they shouldn't be modified */
    let shkp, deflt_shkp = null;

    if (obj.where == OBJ_ONBILL) {
        /* used up item; bill obj coordinates are useless and so are x,y */
        for (shkp = next_shkp(fmon(), TRUE); shkp;
             shkp = next_shkp(shkp.nmon, TRUE))
            if (onshopbill(obj, shkp, TRUE))
                return shkp;
    } else {
        let roomindx, where = in_rooms(x, y, SHOPBASE);

        /* conceptually object could be inside up to 4 rooms simultaneously;
           in practice it will usually be one room but can sometimes be two;
           check shk and bill for each room rather than just the first;
           fallback to the first shk if obj isn't on the relevant bill(s) */
        for (roomindx = where; chars[roomindx]; ++roomindx)
            if ((shkp = shop_keeper(chars[roomindx])) != null) {
                if (onshopbill(obj, shkp, TRUE))
                    return shkp;
                if (!deflt_shkp)
                    deflt_shkp = shkp;
            }
    }
    return deflt_shkp;
}

export function tended_shop(sroom) { /* boolean */
    let mtmp = sroom.resident;

    return !mtmp ? FALSE : boolean(inhishop(mtmp));
}

export function noisy_shop(sroom) { /* void */
    let mtmp = sroom.resident;

    if (mtmp && inhishop(mtmp)) {
        wake_nearto(mtmp.mx, mtmp.my, 11 * 11);
    }
}

function onbill(obj, shkp, silent) { /* struct bill_x * */
    if (shkp) {
        let bp;
        let ct;

        for (ct = ESHK(shkp).billct, bp = ESHK(shkp).bill_p;
             ct > 0; --ct, bp = ptr_add(bp, 1)) {
            if (bp.bo_id == obj.o_id) {
                if (!obj.unpaid)
                    impossible(_("onbill: paid obj on bill?"));
                return bp;
            }
        }
    }
    if (obj.unpaid && !silent)
        impossible(_("onbill: unpaid obj %s?"),
                   !shkp ? _("without shopkeeper") : _("not on shk's bill"));
    return null;
}

/* used outside of shk.c when caller wants to know whether item is on bill
   but doesn't need to know any details about the bill itself */
export function onshopbill(obj, shkp, silent) { /* boolean */
    return onbill(obj, shkp, silent) ? TRUE : FALSE;
}

/* check whether an object or any of its contents belongs to a shop */
export function is_unpaid(obj) { /* boolean */
    return (obj.unpaid
                      || (Has_contents(obj) && count_unpaid(obj.cobj)) ? 1 : 0);
}

/* Delete the contents of the given object. */
export function delete_contents(obj) { /* void */
    let curr;

    while ((curr = obj.cobj) != null) {
        obj_extract_self(curr);
        obfree(curr, null);
    }
}

/* called with two args on merge */
export function obfree(obj, merge) { /* void */
    let bp;
    let bpm;
    let shkp;

    if (obj.otyp == LEASH && obj.corpsenm)
        o_unleash(obj);
    if (obj.oclass == FOOD_CLASS)
        food_disappears(obj);
    if (obj.oclass == SPBOOK_CLASS)
        book_disappears(obj);
    if (Has_contents(obj))
        delete_contents(obj);
    if (Is_container(obj))
        maybe_reset_pick(obj);
    if (obj.otyp == BOULDER)
        obj.corpsenm = 0;

    shkp = null;
    if (obj.unpaid) {
        /* look for a shopkeeper who owns this object */
        for (shkp = next_shkp(fmon(), TRUE); shkp;
             shkp = next_shkp(shkp.nmon, TRUE))
            if (onbill(obj, shkp, TRUE))
                break;
    }
    /* sanity check, in case obj is on bill but not marked 'unpaid' */
    if (!shkp)
        shkp = shop_keeper(chars[u.ushops]);
    /*
     * Note:  `shkp = shop_keeper(*u.ushops)' used to be
     *    unconditional.  But obfree() is used all over
     *    the place, so making its behavior be dependent
     *    upon player location doesn't make much sense.
     */

    if ((bp = onbill(obj, shkp, FALSE)) != null) {
        if (!merge) {
            bp.useup = TRUE;
            obj.unpaid = 0; /* only for doinvbill */
            /* for used up glob, put back original weight in case it gets
               formatted ('I x' or itemized billing) with 'wizweight' On */
            if (obj.globby && !obj.owt && has_omid(obj))
                obj.owt = OMID(obj);
            add_to_billobjs(obj);
            return;
        }
        bpm = onbill(merge, shkp, FALSE);
        if (!bpm) {
            /* this used to be a rename */
            /* !merge already returned */
            impossible(
                   _("obfree: not on bill, %s = (%d,%d,%lld,%d) (%d,%d,%lld,%d)?"),
                       _("otyp,where,quan,unpaid"),
                       obj.otyp, obj.where, obj.quan, obj.unpaid ? 1 : 0,
                       merge.otyp, merge.where, merge.quan,
                       merge.unpaid ? 1 : 0);
            return;
        } else {
            let eshkp = ESHK(shkp);

            /* this was a merger */
            bpm.bquan += bp.bquan;
            eshkp.billct--;
            struct_assign(bp, ptr_add(eshkp.bill_p, eshkp.billct));
        }
    } else {
        /* not on bill; if the item is being merged away rather than
           just deleted and has a higher price adjustment than the stack
           being merged into, give the latter the former's obj->o_id so
           that the merged stack takes on higher price; matters if hero
           eventually buys them from a shop, but doesn't matter if hero
           owns them and intends to sell (unless he subsequently buys
           them back) or if no shopping activity ever involves them */
        if (merge && (oid_price_adjustment(obj, obj.o_id)
                      > oid_price_adjustment(merge, merge.o_id)))
            merge.o_id = obj.o_id;
    }
    if (obj.owornmask) {
        impossible(_("obfree: deleting worn obj (%d: %lld)"), obj.otyp,
                   obj.owornmask);
        /* unfortunately at this point we don't know whether worn mask
           applied to hero or a monster or perhaps something bogus, so
           can't call remove_worn_item() to get <X>_off() side-effects */
        setnotworn(obj);
    }
    dealloc_obj(obj);
}

function check_credit(tmp, shkp) { /* long long */
    let credit = ESHK(shkp).credit;

    if (credit == 0) {
        ; /* nothing to do; just 'return tmp;' */
    } else if (credit >= tmp) {
        pline_The(_("price is deducted from your credit."));
        ESHK(shkp).credit -= tmp;
        tmp = 0;
    } else {
        pline_The(_("price is partially covered by your credit."));
        ESHK(shkp).credit = 0;
        tmp -= credit;
    }
    return tmp;
}

function pay(tmp, shkp) { /* void */
    let robbed = ESHK(shkp).robbed;
    let balance = ((tmp <= 0) ? tmp : check_credit(tmp, shkp));

    if (balance > 0)
        money2mon(shkp, balance);
    else if (balance < 0)
        money2u(shkp, -balance);
    disp.botl = TRUE;
    if (robbed) {
        robbed -= tmp;
        if (robbed < 0)
            robbed = 0;
        ESHK(shkp).robbed = robbed;
    }
}

/* return shkp to home position */
function home_shk(shkp, killkops) { /* void */
    let x = ESHK(shkp).shk.x, y = ESHK(shkp).shk.y;

    mnearto(shkp, x, y, TRUE, RLOC_NOMSG);
    svl.level.flags.has_shop = 1;
    if (killkops) {
        kops_gone(TRUE);
        pacify_guards();
    }
    after_shk_move(shkp);
}

function angry_shk_exists() { /* boolean */
    let shkp;

    for (shkp = next_shkp(fmon(), FALSE); shkp;
         shkp = next_shkp(shkp.nmon, FALSE))
        if (ANGRY(shkp))
            return TRUE;
    return FALSE;
}

/* remove previously applied surcharge from all billed items */
function pacify_shk(shkp, clear_surcharge) { /* void */
    ((shkp).mpeaceful) = TRUE; /* make peaceful */
    if (clear_surcharge && ESHK(shkp).surcharge) {
        let bp = ESHK(shkp).bill_p;
        let ct = ESHK(shkp).billct;

        ESHK(shkp).surcharge = FALSE;
        while (ct-- > 0) {
            let reduction = Math.trunc((bp.price + 3) / 4);
            bp.price -= reduction; /* undo 33% increase */
            bp = ptr_add(bp, 1);
        }
    }
}

/* add aggravation surcharge to all billed items */
function rile_shk(shkp) { /* void */
    ((shkp).mpeaceful) = FALSE; /* make angry */
    if (!ESHK(shkp).surcharge) {
        let surcharge;
        let bp = ESHK(shkp).bill_p;
        let ct = ESHK(shkp).billct;

        ESHK(shkp).surcharge = TRUE;
        while (ct-- > 0) {
            surcharge = Math.trunc((bp.price + 2) / 3);
            bp.price += surcharge;
            bp = ptr_add(bp, 1);
        }
    }
}

/* wakeup and/or unparalyze shopkeeper */
function rouse_shk(shkp, verbosely) { /* void */
    if (helpless(shkp)) {
        /* greed induced recovery... */
        if (verbosely && canspotmon(shkp))
            pline(_("%s %s."), Shknam(shkp),
                  shkp.msleeping ? _("wakes up") : _("can move again"));
        shkp.msleeping = 0;
        shkp.mfrozen = 0;
        shkp.mcanmove = 1;
    }
}

export function make_happy_shk(shkp, silentkops) { /* void */
    const $frame = stack_frame(); try {
    let wasmad = ANGRY(shkp);
    let eshkp = ESHK(shkp);

    pacify_shk(shkp, FALSE);
    eshkp.following = 0;
    eshkp.robbed = 0;
    if (!Role_if(PM_ROGUE))
        adjalign(sgn(u.ualign.type));
    if (!inhishop(shkp)) {
        let shk_nam = stack_array(char, BUFSZ);
        let vanished = canseemon(shkp);

        strcpy(shk_nam, shkname(shkp));
        if (on_level(eshkp.shoplevel, u.uz)) {
            home_shk(shkp, FALSE);
            if (canspotmon(shkp)) {
                pline(_("%s returns to %s shop."), Shknam(shkp),
                      noit_mhis(shkp));
                vanished = FALSE; /* don't give 'Shk disappears' message */
            }
        } else {
            /* if sensed, does disappear regardless whether seen */
            if (sensemon(shkp))
                vanished = TRUE;
            /* can't act as porter for the Amulet, even if shk
               happens to be going farther down rather than up */
            mdrop_special_objs(shkp);
            /* arrive near shop's door */
            migrate_to_level(shkp, ledger_no(eshkp.shoplevel),
                             MIGR_APPROX_XY, eshkp.shd);
            /* dismiss kops on that level when shk arrives */
            eshkp.dismiss_kops = TRUE;
        }
        if (vanished)
            pline(_("Satisfied, %s suddenly disappears!"), shk_nam);
    } else if (wasmad)
        pline(_("%s calms down."), Shknam(shkp));

    make_happy_shoppers(silentkops);
    } finally { stack_pop($frame); }
}

/* called by make_happy_shk() and also by losedogs() for migrating shk */
export function make_happy_shoppers(silentkops) { /* void */
    if (!angry_shk_exists()) {
        kops_gone(silentkops);
        pacify_guards();
    }
}

export function hot_pursuit(shkp) { /* void */
    if (!shkp.isshk)
        return;

    rile_shk(shkp);
    strncpy(ESHK(shkp).customer, svp.plname, PL_NSIZ);
    ESHK(shkp).following = 1;

    /* shopkeeper networking:  clear obj->no_charge for all obj on the
       floor of this level (including inside containers on floor), even
       those that are in other shopkeepers' shops */
    clear_no_charge(null, fobj());
    clear_no_charge_pets(shkp);
}

/* Used when the shkp is teleported or falls (ox == 0) out of his shop, or
   when the player is not on a costly_spot and he damages something inside
   the shop.  These conditions must be checked by the calling function. */
/*ARGSUSED*/
export function make_angry_shk(
    shkp,
    ox, oy) { /* void */ /* <ox,oy> predate 'noit_Monnam()', let alone Shknam() */
    let eshkp = ESHK(shkp);

    /* all pending shop transactions are now "past due" */
    if (eshkp.billct || eshkp.debit || eshkp.loan || eshkp.credit) {
        eshkp.robbed += (addupbill(shkp) + eshkp.debit + eshkp.loan);
        eshkp.robbed -= eshkp.credit;
        if (eshkp.robbed < 0)
            eshkp.robbed = 0;
        /* billct, debit, loan, and credit will be cleared by setpaid */
        setpaid(shkp);
    }

    pline(_("%s %s!"), Shknam(shkp), !ANGRY(shkp) ? _("gets angry") : _("is furious"));
    hot_pursuit(shkp);
}

const no_money = init_string(static_array("no_money", char, sizeof_string("Moreover, you%s have no gold.")), _("Moreover, you%s have no gold."), true);
const not_enough_money = init_string(static_array("not_enough_money", char, sizeof_string("Besides, you don't have enough to interest %s.")), _("Besides, you don't have enough to interest %s."), true);

/* if one item is used-up and the other isn't, the used-up one comes first;
   otherwise, if their costs differ, the more expensive one comes first;
   if costs are the same, use internal index as tie-breaker for stable sort */
function sortbill_cmp(vptr1, vptr2) { /* int QSORTCALLBACK */
    let sbi1 = view_of(struct_sortbill_item, vptr1),
                               sbi2 = view_of(struct_sortbill_item, vptr2);
    let cost1 = sbi1.cost, cost2 = sbi2.cost;
    let bidx1 = sbi1.bidx, bidx2 = sbi2.bidx,

        used1 = +(sbi1.usedup <= PartlyUsedUp),
        used2 = +(sbi2.usedup <= PartlyUsedUp);

    if (used1 != used2)
        return (used2 - used1); /* bigger comes before smaller here */
    if (cost1 != cost2)
        return (cost2 - cost1); /* bigger comes before smaller here too */
    /* index into eshkp->bill_p[] isn't unique (an item that is partly
       used and partly intact will have two ibill[] entries indexing same
       bill_p[] element) but duplicates won't reach here (used1 vs used2) */
    return (bidx1 - bidx2);
}

/* delivers the cheapest item on the list */
function cheapest_item(ibillct, ibill) { /* long long */
    let i;
    let gmin = ptr_add(ibill, 0).cost;

    /*
     * 5.0: old version didn't determine cheapest item correctly if it
     * was either the partly used or partly intact portion of a partially
     * used stack.  Rather than modify it to use bp_to_obj() in order to
     * obtain quanities for every entry on eshkp->bill_p[], switch to
     * ibill[] which has already split such items into separate entries.
     */

    for (i = 1; i < ibillct; ++i)
        if (ptr_add(ibill, i).cost < gmin)
            gmin = ptr_add(ibill, i).cost;
    return gmin;
}

/* for itemized purchasing, create an alternate shop bill that hides
   container contents */
function make_itemized_bill(
    shkp,
    ibill_p) { /* int */ /* output, augmented bill similar to a 'sortloot array' */
    let zerosbi = static_struct("make_itemized_bill.zerosbi", struct_sortbill_item); /* Null sortbill item */
    let ibill;
    let bp;
    let otmp;
    let eshkp = ESHK(shkp);
    let i, n, bidx, ebillct = eshkp.billct;
    let used;
    let quan, cost;

    /* this overallocates unless there happens to be a used-up portion
       and an intact potion for every object on the bill; doing it this
       way avoids the need to look up every object on the bill an extra
       time; (the +1 for a terminator isn't actually needed) */
    n = 2 * ebillct + 1;
    ibill = ibill_p[0] = view_of(struct_sortbill_item, addr_of(alloc(unsigned(Math.imul(unsigned(n), sizeof(struct_sortbill_item))))));
    for (i = 0; i < n; ++i)
        struct_assign(ptr_add(ibill, i), zerosbi);

    n = 0; /* number of entries in ibill[]; won't necessary match ebillct */
    for (i = 0; i < ebillct; ++i) {
        bp = ptr_add(eshkp.bill_p, i);
        /* find the object on the bill */
        otmp = bp_to_obj(bp);
        if (!otmp) {
            impossible(_("Can't find shop bill entry for #%d"), bp.bo_id);
            continue;
        }
        bidx = i; /* index into bill_p[], except for hero-owner container */

        if (otmp.quan == 0 || otmp.where == OBJ_ONBILL) {
            /* item is completely used up; restore quantity from when it
               was first unpaid; otmp is on billobjs list where it can
               only be seen via Ix and itemized billing while paying shk */
            otmp.quan = bp.bquan;
            bp.useup = TRUE; /* (expected to be set already) */
        } else if (otmp.quan < bp.bquan) {
            /* item is partly used up; we will create two entries in the
               augmented bill: one for the used up part here, another for
               the intact part (which might be inside a container if put in
               after using part of a stack; used up part isn't) below */
            ptr_add(ibill, n).obj = otmp;
            ptr_add(ibill, n).quan = bp.bquan - otmp.quan;
            ptr_add(ibill, n).cost = bp.price * ptr_add(ibill, n).quan;
            ptr_add(ibill, n).bidx = bidx; /* duplicate index into eshkp->bill_p[] */
            ptr_add(ibill, n).usedup = PartlyUsedUp; /* for sorting */
            ++n; /* intact portion will be a separate entry, next */
        }

        if (otmp.where == OBJ_ONBILL) {
            /* completely used up */
            quan = bp.bquan;
            cost = bp.price * quan;
            used = FullyUsedUp;
        } else if (otmp.where == OBJ_CONTAINED || Has_contents(otmp)) {
            let j;
            let item = otmp;
            let cknown = TRUE; /* assume container contents are known */

            /* when it's in a container, put the container rather than the
               specific object into ibill[]; find outermost container */
            while (otmp.where == OBJ_CONTAINED) {
                otmp = otmp.v.v_ocontainer;
                if (!otmp.cknown)
                    cknown = FALSE;
            }
            /* this container might already be in ibill[] if it is unpaid
               itself or if it holds more than one unpaid item and another
               besides this one has already been processed; only include
               first instance */
            for (j = 0; j < n; ++j)
                if (otmp == ptr_add(ibill, j).obj)
                    break;
            if (j < n) {
                /* when already on bill as FullyIntact, update; the cost
                   saved in ibill[j] is based on the container even if the
                   entry was initially created for an item of its contents */
                if (ptr_add(ibill, j).usedup == FullyIntact)
                    ptr_add(ibill, j).usedup = cknown ? KnownContainer
                                             : UndisclosedContainer;
                continue; /* 'i' loop */
            }
            /* include 1 container containing unpaid item(s) */
            quan = 1;
            cost = unpaid_cost(otmp, COST_CONTENTS);
            if (!otmp.unpaid)
                bidx = -1;
            /* an unpaid container without any unpaid contents is classified
               as 'FullyIntact'; a container with unpaid contents will be
               '*Container' regardless of whether it is unpaid itself */
            used = (otmp == item) ? FullyIntact
                   : cknown ? KnownContainer
                     : UndisclosedContainer;
        } else {
            /* ordinary unpaid; when partly used, these are values for the
               intact portion; might be an empty shop-owned container */
            quan = otmp.quan;
            cost = bp.price * quan;
            used = (quan < bp.bquan) ? PartlyIntact : FullyIntact;
        }

        ptr_add(ibill, n).obj = otmp;
        ptr_add(ibill, n).quan = quan;
        ptr_add(ibill, n).cost = cost;
        ptr_add(ibill, n).bidx = bidx;
        ptr_add(ibill, n).usedup = used;
        ++n;
    }
    ptr_add(ibill, n).bidx = -1; /* end of list; not strictly needed */

    /* ibill[0..n-1] contains data, ibill[n] has Null obj and -1 bidx and
       is excluded from the sort */
    if (n > 1)
        nh_deterministic_qsort((addr_of(ibill)), unsigned((n)), (sizeof(struct_sortbill_item)), (sortbill_cmp));
    return n;
}

/* show items on your bill in a menu, and ask which to pay.
   returns the number of entries selected. */
function menu_pick_pay_items(
    ibillct,
    ibill) { /* int */ /* all used up items, if any, precede all intact items */
    const $frame = stack_frame(); try {
    let otmp;
    let win;
    let any = stack_struct(struct_any);
    let pick_list = stack_var(ptr_to(struct_mi), null);
    let p, buf = stack_array(char, BUFSZ);
    let amt, largest_amt, save_quan;
    let i, j, n, amt_width;

    struct_assign(any, cg.zeroany);
    win = create_nhwindow()(NHW_MENU);
    start_menu()(win, MENU_BEHAVE_STANDARD);

    /* we go through ibill[] twice, first time to control price formatting
       during the second */
    largest_amt = 0;
    for (i = 0; i < ibillct; ++i)
        if (ptr_add(ibill, i).cost > largest_amt)
            largest_amt = ptr_add(ibill, i).cost;
    sprintf(buf, _("%lld"), largest_amt);
    amt_width = int(strlen(buf));

    /* show the "used up items" header if there are any used up items on
       the bill, no matter whether there are also any intact items;
       note: ibill[] has been sorted to hold used-up items first */
    if (ptr_add(ibill, 0).usedup <= PartlyUsedUp) {
        sprintf(buf, _("Used up item%s:"), (ibillct > 1 && ptr_add(ibill, 1).usedup <= PartlyUsedUp) ? _("s") : _(""))
;
        add_menu_heading(win, buf);
    }
    for (i = 0; i < ibillct; ++i) {
        /* the "unpaid items" header is only shown if the "used up items"
           one was shown before the first menu entry */
        if (i > 0 && ptr_add(ibill, i - 1).usedup <= PartlyUsedUp
            && ptr_add(ibill, i).usedup >= PartlyIntact) {
            sprintf(buf, _("Unpaid item%s:"), (i < ibillct - 1) ? _("s") : _(""));
            add_menu_heading(win, buf);
        }
        otmp = ptr_add(ibill, i).obj;
        save_quan = otmp.quan;
        otmp.quan = ptr_add(ibill, i).quan; /* in case it's partly used */
        p = paydoname(otmp);
        otmp.quan = save_quan;
        amt = ptr_add(ibill, i).cost;
        /* this doesn't support hallucinatory currency because shopkeeper
           isn't hallucinating; also, that would mess up the alignment */
        Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%*lld Zm, %s"), amt_width, amt, p);
        any.a_int = i + 1; /* +1: avoid 0 */
        add_menu(win, nul_glyphinfo, any, 0, 0, ATR_NONE, NO_COLOR, buf,
                 MENU_ITEMFLAGS_NONE);
    }

    end_menu()(win, _("Pay for which items?"));
    n = select_menu(win, PICK_ANY, pick_list);
    destroy_nhwindow()(win);

    for (j = 0; j < n; ++j) {
        /*
         * FIXME:
         *  The menu will accept a subset count for each entry but buying
         *  doesn't have any support for that.
         */
        i = ptr_add(pick_list[0], j).item.a_int - 1; /* -1: reverse +1 above */
        ptr_add(ibill, i).queuedpay = TRUE;
    }
    free(addr_of(pick_list[0]));
    /* for ESC, return 0 instead of usual -1 */
    return max(n, 0);
    } finally { stack_pop($frame); }
}

/* the #pay command */
export function dopay() { /* int */
    const $frame = stack_frame(); try {
    var eshkp;
    var shkp;
    var nxtm, resident;
    var ibill = stack_var(ptr_to(struct_sortbill_item), null);
    var ltmp;
    var umoney;
    var sk = 0, seensk = 0, nexttosk = 0;
    var paid = stack_var(boolean, FALSE), stashed_gold = +(hidden_gold(TRUE) > 0),
            pay_done;

    gm.multi = 0;

    /* Find how many shk's there are, how many are in
     * sight, and are you in a shop room with one.
     */
    nxtm = resident = null;
    for (shkp = next_shkp(fmon(), FALSE); shkp;
         shkp = next_shkp(shkp.nmon, FALSE)) {
        sk++;
        if (m_next2u(shkp)) {
            /* next to an irate shopkeeper? prioritize that */
            if (nxtm && ANGRY(nxtm))
                continue;
            nexttosk++;
            nxtm = shkp;
        }
        if (canspotmon(shkp))
            seensk++;
        if (inhishop(shkp) && (chars[u.ushops] == ESHK(shkp).shoproom))
            resident = shkp;
    }

    proceed: { if (nxtm && nexttosk == 1) {
        shkp = nxtm;
        break proceed;
    }

    if ((!sk && (!Blind() || Blind_telepat())) || (!Blind() && !seensk)) {
        There(_("appears to be no shopkeeper here to receive your payment."));
        return ECMD_OK;
    }

    if (!seensk) {
        You_cant(_("see..."));
        return ECMD_OK;
    }

    /* The usual case.  Allow paying at a distance when
     * inside a tended shop.  Should we change that?
     */
    if (sk == 1 && resident) {
        shkp = resident;
        break proceed;
    }

    if (seensk == 1) {
        for (shkp = next_shkp(fmon(), FALSE); shkp;
             shkp = next_shkp(shkp.nmon, FALSE))
            if (canspotmon(shkp))
                break;
        assert(shkp != null); /* seensk==1 =>  traversal will spot one shk */
        if (shkp != resident && !m_next2u(shkp)) {
            pline(_("%s is not near enough to receive your payment."),
                  Shknam(shkp));
            return ECMD_OK;
        }
    } else {
        var mtmp;
        var cc = stack_struct(struct_nhcoord);
        var cx, cy;

        pline(_("Pay whom?"));
        cc.x = u.ux;
        cc.y = u.uy;
        if (getpos(cc, TRUE, _("the creature you want to pay")) < 0)
            return ECMD_CANCEL; /* player pressed ESC */
        cx = cc.x;
        cy = cc.y;
        if (cx < 0) {
            pline(_("Try again..."));
            return ECMD_OK;
        }
        if (u_at(cx, cy)) {
            You(_("are generous to yourself."));
            return ECMD_OK;
        }
        mtmp = m_at(cx, cy);
        if (!cansee(cx, cy) && (!mtmp || !canspotmon(mtmp))) {
            You(_("can't %s anyone there."), !Blind() ? _("see") : _("sense"));
            return ECMD_OK;
        }
        if (!mtmp) {
            There(_("is no one there to receive your payment."));
            return ECMD_OK;
        }
        if (!mtmp.isshk) {
            pline(_("%s is not interested in your payment."), Monnam(mtmp));
            return ECMD_OK;
        }
        if (mtmp != resident && !m_next2u(mtmp)) {
            pline(_("%s is too far to receive your payment."), Shknam(mtmp));
            return ECMD_OK;
        }
        shkp = mtmp;
    }

    if (!shkp) {
        debugpline0(_("dopay: null shkp."), __FILE__);
        return ECMD_OK;
    }
 }
    eshkp = ESHK(shkp);
    ltmp = eshkp.robbed;

    /* wake sleeping shk when someone who owes money offers payment */
    if (ltmp || eshkp.billct || eshkp.debit)
        rouse_shk(shkp, TRUE);

    if (helpless(shkp)) { /* still asleep/paralyzed */
        pline(_("%s %s."), Shknam(shkp),
              rn2(2) ? _("seems to be napping") : _("doesn't respond"));
        return ECMD_OK;
    }

    if (shkp != resident && NOTANGRY(shkp)) {
        umoney = money_cnt(gi.invent);
        if (!ltmp) {
            You(_("do not owe %s anything."), shkname(shkp));
        } else if (!umoney) {
            You(_("%shave no gold."), stashed_gold ? _("seem to ") : _(""));
            if (stashed_gold)
                pline(_("But you have some gold stashed away."));
        } else {
            if (umoney > ltmp) {
                You(_("give %s the %lld gold piece%s %s asked for."),
                    shkname(shkp), ltmp, plur(ltmp), noit_mhe(shkp));
                pay(ltmp, shkp);
            } else {
                You(_("give %s all your%s gold."), shkname(shkp),
                    stashed_gold ? _(" openly kept") : _(""));
                pay(umoney, shkp);
                if (stashed_gold)
                    pline(_("But you have hidden gold!"));
            }
            if ((umoney < Math.trunc(ltmp / 2)) || (umoney < ltmp && stashed_gold))
                pline(_("Unfortunately, %s doesn't look satisfied."),
                      noit_mhe(shkp));
            else
                make_happy_shk(shkp, FALSE);
        }
        return ECMD_TIME;
    }

    /* ltmp is still eshkp->robbed here */
    if (!eshkp.billct && !eshkp.debit) {
        umoney = money_cnt(gi.invent);
        if (!ltmp && NOTANGRY(shkp)) {
            You(_("do not owe %s anything."), shkname(shkp));
            if (!umoney)
                pline(no_money, stashed_gold ? _(" seem to") : _(""));
        } else if (ltmp) {
            pline(_("%s is after blood, not gold!"), shkname(shkp));
            if (umoney < Math.trunc(ltmp / 2) || (umoney < ltmp && stashed_gold)) {
                if (!umoney)
                    pline(no_money, stashed_gold ? _(" seem to") : _(""));
                else
                    pline(not_enough_money, noit_mhim(shkp));
                return ECMD_TIME;
            }
            pline(_("But since %s shop has been robbed recently,"),
                  noit_mhis(shkp));
            pline(_("you %scompensate %s for %s losses."),
                  (umoney < ltmp) ? _("partially ") : _(""), shkname(shkp),
                  noit_mhis(shkp));
            pay(umoney < ltmp ? umoney : ltmp, shkp);
            make_happy_shk(shkp, FALSE);
        } else {
            /* shopkeeper is angry, but has not been robbed --
             * door broken, attacked, etc. */
            pline(_("%s is after your hide, not your gold!"), Shknam(shkp));
            if (umoney < 1000) {
                if (!umoney)
                    pline(no_money, stashed_gold ? _(" seem to") : _(""));
                else
                    pline(not_enough_money, noit_mhim(shkp));
                return ECMD_TIME;
            }
            You(_("try to appease %s by giving %s 1000 gold pieces."),
                canspotmon(shkp)
                    ? x_monnam(shkp, ARTICLE_THE, _("angry"), 0, FALSE)
                    : shkname(shkp),
                noit_mhim(shkp));
            pay(1000, shkp);
            if (strncmp(eshkp.customer, svp.plname, PL_NSIZ) || rn2(3))
                make_happy_shk(shkp, FALSE);
            else
                pline(_("But %s is as angry as ever."), shkname(shkp));
        }
        return ECMD_TIME;
    }
    if (shkp != resident) {
        impossible(_("dopay: not to shopkeeper?"));
        if (resident)
            setpaid(resident);
        return ECMD_OK;
    }
    /* pay debt, if any, first */
    if (eshkp.debit) {
        var dtmp = eshkp.debit;
        var loan = eshkp.loan;
        var sbuf = stack_array(char, BUFSZ);

        umoney = money_cnt(gi.invent);
        sprintf(sbuf, _("You owe %s %lld %s "), shkname(shkp), dtmp, currency(dtmp))
;
        if (loan) {
            if (loan == dtmp)
                strcat(sbuf, _("you picked up in the store."));
            else
                strcat(sbuf, _("for gold picked up and the use of merchandise."))
;
        } else {
            strcat(sbuf, _("for the use of merchandise."));
        }
        pline1(sbuf);
        if (umoney + eshkp.credit < dtmp) {
            pline(_("But you don't%s have enough gold%s."),
                  stashed_gold ? _(" seem to") : _(""),
                  eshkp.credit ? _(" or credit") : _(""));
            return ECMD_TIME;
        } else {
            if (eshkp.credit >= dtmp) {
                eshkp.credit -= dtmp;
                eshkp.debit = 0;
                eshkp.loan = 0;
                Your(_("debt is covered by your credit."));
            } else if (!eshkp.credit) {
                money2mon(shkp, dtmp);
                eshkp.debit = 0;
                eshkp.loan = 0;
                You(_("pay that debt."));
                disp.botl = TRUE;
            } else {
                dtmp -= eshkp.credit;
                eshkp.credit = 0;
                money2mon(shkp, dtmp);
                eshkp.debit = 0;
                eshkp.loan = 0;
                pline(_("That debt is partially offset by your credit."));
                You(_("pay the remainder."));
                disp.botl = TRUE;
            }
            paid[0] = TRUE;
        }
    }

    /* now check items on bill */
    pay_done = TRUE; /* assume success */
    if (eshkp.billct) {
        var ibillct = make_itemized_bill(shkp, ibill);

        if (!pay_billed_items(shkp, ibillct, ibill[0], stashed_gold, addr_of(paid)))
            pay_done = FALSE; /* skip thank you message */
    }

    /* {mute shk,deaf hero}-aware thank you message */
    if (pay_done && !ANGRY(shkp) && paid[0]) {
        if (!Deaf() && !muteshk(shkp)) {
               ;
            verbalize(_("Thank you for shopping in %s %s%s"),
                      s_suffix(shkname(shkp)),
                      elt(shtypes, eshkp.shoptype - SHOPBASE).name,
                      !eshkp.surcharge ? _("!") : _("."));
        } else {
            pline(_("%s nods%s at you for shopping in %s %s%s"),
                  Shknam(shkp), !eshkp.surcharge ? _(" appreciatively") : _(""),
                  noit_mhis(shkp), elt(shtypes, eshkp.shoptype - SHOPBASE).name,
                  !eshkp.surcharge ? _("!") : _("."));
        }
    }

    if (paid[0])
        update_inventory();
    iflags.menu_requested = FALSE; /* reset */
    /* free the sortbill array used for itemized billing */
    if (ibill[0]) {
        free(addr_of(ibill[0])), ibill[0] = null;
        (ibill[0]);
    }
    return paid[0] ? ECMD_TIME : ECMD_OK;
    } finally { stack_pop($frame); }
}

/* for menustyle=Traditional, choose between paying for everything (by
   declining to itemize), asking item-by-item (by accepting itemization),
   or switch to selecting via menu (special 'm' answer at "Itemize? [ynq m]"
   prompt); for other menustyles, always select via menu;
   player can use 'm' prefix before 'p' command to invert those behaviors;
   once the method is chosen, actually pay for the selected items, item by
   item for as long as hero has enough credit+cash */
function pay_billed_items(
    shkp,
    ibillct,
    ibill,
    stashed_gold,
    paid_p) { /* boolean */ /* output */
    let bp;
    let otmp;
    let umoney;
    let itemize, more_than_one;
    let queuedpay = FALSE, via_menu;
    let buy, indx, bidx, pass, iprompt, ebillct;
    let eshkp = ESHK(shkp);

    umoney = money_cnt(gi.invent);
    if (!umoney && !eshkp.credit) {
        You(_("%shave no gold or credit%s."),
            stashed_gold ? _("seem to ") : _(""), chars[paid_p] ? _(" left") : _(""));
        return TRUE;
    }
    bp = eshkp.bill_p;
    otmp = bp_to_obj(bp);
    ebillct = eshkp.billct;
    more_than_one = +(ebillct > 1 || otmp.quan < bp.bquan
                     /* note: will only get here for a single item, so
                        we can deduce that it is ibill[0] */
                     || ptr_add(ibill, 0).usedup == UndisclosedContainer);
    if ((umoney + eshkp.credit) < cheapest_item(ibillct, ibill)) {
        You(_("don't have enough gold to buy%s the item%s %s."),
            more_than_one ? _(" any of") : _(""), plur(more_than_one ? 2 : 1),
            (ebillct > 1) ? _("you've picked") : _("on your bill"));
        if (stashed_gold)
            pline(_("Maybe you have some gold stashed away?"));
        return TRUE;
    }

    via_menu = +(flags.menu_style != MENU_TRADITIONAL);
    /* allow 'm p' to request a menu for menustyle:traditional;
       for other styles, it will do the opposite; that doesn't make
       a whole lot of sense for a 'request-menu' prefix, but otherwise
       it would simply be redundant and there wouldn't be any way to
       skip the menu when hero owes for multiple items */
    if (iflags.menu_requested)
        via_menu = +!via_menu;
    /* this will loop for a second iteration iff not initially using a
       menu and player answers 'm' at custom ynq prompt */
    do {
        if (via_menu /*&& more_than_one*/ ) {
            if (!menu_pick_pay_items(ibillct, ibill))
                return TRUE;
            queuedpay = TRUE;
            itemize = FALSE;
            via_menu = FALSE; /* reset so that we don't loop */
        } else {
            iprompt = !more_than_one ? ord('y')
                      : yn_function(_("Itemized billing?"), _("ynq m"), ord('q'), TRUE);
            if (iprompt == ord('q'))
                return TRUE;
            itemize = +(iprompt == ord('y'));
            via_menu = +(iprompt == ord('m'));
        }
    } while (via_menu);

    /*
     * 5.0:  this used to make two passes through eshkp->bill_p[],
     * the first for used up items and the second for unpaid ones.
     * Items which were partly used were processed on both passes.
     *
     * Now it makes one pass through ibill[], which has all used up
     * items sorted to the beginning and unpaid ones sorted to the end.
     * Partly used items have two entries for same base item, one in
     * each section.
     */
    for (indx = 0; indx < ibillct; ++indx) {
        if (queuedpay && !ptr_add(ibill, indx).queuedpay)
            continue;

        otmp = ptr_add(ibill, indx).obj; /* ordinary object or outermost container */
        if (ptr_add(ibill, indx).usedup >= KnownContainer) {
            /* when successfull, buy_container() will call both
               dopayobj() and update_bill(), possibly multiple times */
            let boxbag_result = buy_container(shkp, indx, ibillct, ibill);

            if (boxbag_result == 0) {
                buy = PAY_BUY;
            } else { /* buy_container() failed... */
                if (boxbag_result == 2)    /* ... but didn't explain why */
                    verbalize(_("You need to remove any unpaid items from" +
                              " that %s and buy them separately."),
                              simpleonames(otmp));
                buy = PAY_CANT;
            }
        } else {
            bidx = ptr_add(ibill, indx).bidx;
            bp = ptr_add(eshkp.bill_p, bidx);
            pass = (ptr_add(ibill, indx).usedup <= PartlyUsedUp) ? 0 : 1;

            buy = dopayobj(shkp, bp, otmp, pass, itemize, FALSE);

            if (buy == PAY_BUY)
                update_bill(indx, ibillct, ibill, eshkp, bp, otmp);
        }
        switch (buy) {
        case PAY_CANT:
            return FALSE;
        case PAY_BROKE:
            chars[paid_p] = TRUE;
            return TRUE;
        case PAY_SKIP:
            continue;
     /* case PAY_SOME: //no longer used */
        case PAY_BUY:
            chars[paid_p] = TRUE;
            if (itemize || queuedpay) {
                update_inventory();
                bot();
            }
            break;
        }
    }
    return TRUE;
}

/* update shk's bill and augmented bill after an item has been purchased */
function update_bill(
    indx,
    ibillct,
    ibill,
    eshkp,
    bp,
    paiditem) { /* void */
    let j, newebillct;

    /* remove from eshkp->bill_p[] unless this was the used up portion
       of partly used item (since removal would take out both; note:
       can't buy PartlyIntact until PartlyUsedUp has been paid for) */
    if (indx >= 0 && ptr_add(ibill, indx).usedup == PartlyUsedUp) {
        /* 'paiditem' points to the partly intact portion still in invent or
           inside a container (ibill[indx].obj points to the container) */
        bp.bquan = paiditem.quan;
        for (j = 0; j < ibillct; ++j)
            if (ptr_add(ibill, j).obj == paiditem && ptr_add(ibill, j).usedup == PartlyIntact) {
                ptr_add(ibill, j).usedup = FullyIntact;
                break;
            }
    } else {
        /* if we get here, something was bought and needs to be removed
           from shop bill; if it was used up, remove it from the billobjs
           list and delete it; update shop's bill by moving last bill_p[]
           entry into vacated slot; also update ibill[] indices for that */
        paiditem.unpaid = 0; /* clear before maybe deallocating */
        if (paiditem.where == OBJ_ONBILL) {
            obj_extract_self(paiditem);
            dealloc_obj(paiditem);
        }
        newebillct = eshkp.billct - 1;
        struct_assign(bp, ptr_add(eshkp.bill_p, newebillct));
        for (j = 0; j < ibillct; ++j)
            if (ptr_add(ibill, j).bidx == newebillct)
                ptr_add(ibill, j).bidx = ptr_diff(bp, eshkp.bill_p);
        eshkp.billct = newebillct; /* eshkp->billct - 1 */
    }
    return;
}

/* return 2 if used-up portion paid
 *        1 if paid successfully
 *        0 if not enough money
 *       -1 if skip this object
 *       -2 if no money/credit left
 */
function dopayobj(
    shkp,
    bp,
    obj,
    which,
    itemize,
    unseen) { /* int */
    const $frame = stack_frame(); try {
    let ltmp, quan, save_quan;
    let buy;
    let consumed = +(which == 0);

    if (!obj.unpaid && !bp.useup
        && !(Has_contents(obj) && unpaid_cost(obj, COST_CONTENTS))) {
        impossible(_("Paid object on bill??"));
        return PAY_BUY;
    }
    if (itemize && insufficient_funds(shkp, obj, 0)) {
        return PAY_BROKE;
    }
    /* we may need to temporarily adjust the object, if part of the
       original quantity has been used up but part remains unpaid; [note:
       this predates 'ibill[]' and feels redundant but still works] */
    save_quan = obj.quan;
    if (consumed) {
        /* either completely used up (simple), or split needed */
        quan = bp.bquan;
        if (quan > obj.quan) /* difference is amount used up */
            quan -= obj.quan;
    } else {
        /* dealing with ordinary unpaid item */
        quan = obj.quan;
    }
    ltmp = bp.price * quan;

    obj.quan = quan;        /* to be used by doname() */
    iflags.suppress_price++; /* affects containers */
    buy = PAY_BUY; /* flag; if changed then return early */

    if (itemize) {
        let qbuf = stack_array(char, BUFSZ), qsfx = stack_array(char, BUFSZ);

        /*
         * TODO:
         *  This should also accept 'a' and 'q' to end itemized paying:
         *  'a' to buy the rest without asking, 'q' to just stop.
         */

        sprintf(qsfx, _(" for %lld %s.  Pay?"), ltmp, currency(ltmp));
        safe_qbuf(qbuf, 0, qsfx, obj,
                         (quan == 1) ? Doname2 : doname, ansimpleoname,
                         (quan == 1) ? _("that") : _("those"));
        if (y_n(qbuf) == ord('n')) {
            buy = PAY_SKIP;                         /* don't want to buy */
        }
    } /* itemize */

    if (quan < bp.bquan && !consumed) { /* partly used goods */
        /* shk won't sell the intact portion until the used up portion has
           been paid for (once it has been, bp->bquan will match quan) */
        reject_purchase(shkp, obj, bp.bquan);
        buy = PAY_SKIP;
    }
    if (buy == PAY_BUY && insufficient_funds(shkp, obj, ltmp)) {
        buy = itemize ? PAY_SKIP : PAY_CANT;
    }

    if (buy == PAY_BUY) {
        pay(ltmp, shkp);
        if (!unseen)
            shk_names_obj(shkp, obj,
                          consumed
                              ? _("paid for %s at a cost of %lld gold piece%s.%s")
                              : _("bought %s for %lld gold piece%s.%s"),
                          ltmp, _(""));
    }

    /* restore obj to original state */
    obj.quan = save_quan; /* restore original count */
    iflags.suppress_price--;

    return buy;
    } finally { stack_pop($frame); }
}

/* pay for the unpaid contents of a container without itemizing,
   and for the container itself if it is unpaid too;
   returns 0==successfully bought; 1==rejected, message given here;
   2=rejected, caller should issue message */
function buy_container(
    shkp,
    indx,
    ibillct,
    ibill) { /* int */
    const $frame = stack_frame(); try {
    let boid, boids = stack_array(unsigned, BILLSZ);
    let i, j, buy, buycount = 0, boidsct = 0;
    let eshkp = ESHK(shkp);
    let ebillct = eshkp.billct;
    let bp;
    let otmp, otop,
               container = ptr_add(ibill, indx).obj;
    let unpaidcontainer = container.unpaid;
    let totalcost = ptr_add(ibill, indx).cost;
    let sightunseen = +(ptr_add(ibill, indx).usedup == UndisclosedContainer
                          /* give feedback just for container+contents rather
                             than for individiual contents even when those
                             contents are known */
                          || ptr_add(ibill, indx).usedup == KnownContainer);

    /* check for no-gold first, then for not-enough-gold; feedback is
       different for the two cases */
    if (insufficient_funds(shkp, container, 0)
        || insufficient_funds(shkp, container, totalcost))
        return 1; /* message given by insufficent_funds() */

    /* check for partly intact portion of a not-yet-paid partly used item */
    for (i = 0; i < ebillct; ++i) {
        bp = ptr_add(eshkp.bill_p, i);
        otmp = bp_to_obj(bp); /* ibill[bidx].obj is the container */
        if (!otmp) {
            impossible(_("Can't find contained item on shop bill (#%d)."),
                       bp.bo_id);
            return 2; /* failure; have caller give a generic message */
        }
        if (otmp.where != OBJ_CONTAINED && !Has_contents(otmp))
            continue;
        /* otmp is contained, but possibly inside a different container */
        for (otop = otmp; otop.where == OBJ_CONTAINED;
             otop = otop.v.v_ocontainer)
            continue; /* where==OBJ_CONTAINED loop */
        if (otop != container)
            continue; /* 'i' loop */
        /* now check for partly intact portion of partly used item */
        if (otmp.quan < bp.bquan) {
            reject_purchase(shkp, otmp, bp.bquan);
            return 1; /* message given by reject_purchase() */
        }
        /* record this for the second pass; unless it's the container--that
           will be deferred until after the loop so that it will be last */
        if (bp.bo_id != container.o_id)
            boids[boidsct++] = bp.bo_id;
    }
    if (unpaidcontainer)
        boids[boidsct++] = container.o_id;

    /* now make the actual purchasing pass; we've collected a set of
       o_id values in order to avoid traversing the shk's bill while it
       undergoes updates */
    for (j = 0; j < boidsct; ++j) {
        boid = boids[j];
        for (i = 0, bp = eshkp.bill_p; i < ebillct; ++i, bp = ptr_add(bp, 1))
            if (bp.bo_id == boid)
                break;
        if (i == ebillct) {
            impossible(_("Buying %s contents: item #%u disappeared from bill."),
                       simpleonames(container), boid);
            return 2;
        }
        otmp = bp_to_obj(bp);

        buy = dopayobj(shkp, bp, otmp, 1, FALSE, sightunseen);
        if (buy != PAY_BUY) {
            impossible(_("Buying %s contents failed unexpectedly (#%u %d)."),
                       simpleonames(container), otmp.o_id, buy);
            continue;
        }
        /* [updating cost here is not necessary but useful when debugging] */
        ptr_add(ibill, indx).cost -= (bp.price * bp.bquan); /* update container */
        update_bill((boid == container.o_id) ? indx : -1,
                    ibillct, ibill, eshkp, bp, otmp);
        ++buycount;
    }
    if (buycount && sightunseen) {
        /* if the container was unpaid, the hero has just purchased it;
           normally paydoname()--called by shk_names_obj()--would give
           "contents of your <container>" when it's hero-owned but we
           want it to reflect container's state before purchase;
           since paydoname() isn't called for no_charge items, we use
           obj->no_charge as a hack to avoid that phrasing in favor of
           "a/an <container> and its contents"; temporarily set
           obj->unpaid to reflect the before-purchase state too */
        if (unpaidcontainer)
            container.unpaid = container.no_charge = 1;
        shk_names_obj(shkp, container,
                      _("bought %s for %lld gold piece%s.%s"),
                      totalcost, _(""));
        container.unpaid = container.no_charge = 0;
    }

    return buycount ? 0 : 2; /* we don't expect buycount to be 0 */
    } finally { stack_pop($frame); }
}

/* called if an item on shop bill is partly used up and partly intact and
   player tries to buy the intact portion before paying for used up portion
   (not actually very effective since player can just drop the unpaid
   portion then pick it back up to have it get its own distinct bill entry;
   the former partly used up portion becomes a fully used up separate item) */
function reject_purchase(
    shkp,
    obj,
    billed_quan) { /* void */
    const $frame = stack_frame(); try {
    let intact_quan = obj.quan;

    assert(intact_quan < billed_quan);
    /* temporarily change obj to refer to the used up portion */
    obj.quan = billed_quan - intact_quan;
    if (!Deaf() && !muteshk(shkp)) {
        let which = stack_array(char, BUFSZ);

        if (obj.where == OBJ_CONTAINED)
            Snprintf(which, sizeof(array_of(char, BUFSZ)), _("the one%s in %s"), plur(intact_quan), thesimpleoname(obj.v.v_ocontainer));
        else
            sprintf(which, _("%s"), (intact_quan > 1) ? _("these") : _("this one"))
;

           ;
        verbalize(_("%s for the other %s before buying %s."),
                  ANGRY(shkp) ? _("Pay") : _("Please pay"),
                  simpleonames(obj), /* short name suffices */
                  which);
    } else {
        pline(_("%s %s%s your bill for the other %s first."),
              Shknam(shkp),
              ANGRY(shkp) ? _("angrily ") : _(""),
              nolimbs(shkp.data) ? _("motions to") : _("points out"),
              simpleonames(obj));
    }
    obj.quan = intact_quan;
    } finally { stack_pop($frame); }
}

/* gold+credit checking+feedback common to dopayobj() and buy_container() */
function insufficient_funds(
    shkp,
    item,
    cost) { /* boolean */ /* 0: check for no-gold; >0: check for specified amount */
    let stashed_gold;
    let umoney = money_cnt(gi.invent),
         ecredit = ESHK(shkp).credit;

    /* dopayobj() checks for no-gold early and not-enough-gold later;
       buy_container() checks for both early but uses separate calls to us */
    if (!cost && umoney + ecredit == 0) {
        stashed_gold = hidden_gold(TRUE);
        You(_("%shave no gold or credit left."),
            (stashed_gold > 0) ? _("seem to ") : _(""));
        return TRUE;
    }
    if (cost && umoney + ecredit < cost) {
        stashed_gold = hidden_gold(TRUE);
        You(_("don't%s have gold%s enough to pay for %s."),
            (stashed_gold > 0) ? _(" seem to") : _(""),
            (ecredit > 0) ? _(" or credit") : _(""),
            paydoname(item));
        return TRUE;
    }
    return FALSE;
}

/* routine called after dying (or quitting) */
export function paybill(
    croaked,
    silently) { /* boolean */ /* maybe avoid messages */
    let mtmp, mtmp2, firstshk, resident, creditor, hostile,
        localshk;
    let eshkp;
    let taken = FALSE, local;
    let numsk = 0;

    /* if we escaped from the dungeon, shopkeepers can't reach us;
       shops don't occur on level 1, but this could happen if hero
       level teleports out of the dungeon and manages not to die */
    if (croaked < 0)
        return FALSE;
    /* [should probably also return false when dead hero has been
        petrified since shk shouldn't be able to grab inventory
        which has been shut inside a statue] */

    /* this is where inventory will end up if any shk takes it */
    gr.repo.location.x = gr.repo.location.y = 0;
    gr.repo.shopkeeper = null;

    /*
     * Scan all shopkeepers on the level, to prioritize them:
     * 1) keeper of shop hero is inside and who is owed money,
     * 2) keeper of shop hero is inside who isn't owed any money,
     * 3) other shk who is owed money, 4) other shk who is angry,
     * 5) any shk local to this level, and if none is found,
     * 6) first shk on monster list (last resort; unlikely, since
     * any nonlocal shk will probably be in the owed category
     * and almost certainly be in the angry category).
     */
    resident = creditor = hostile = localshk = null;
    for (mtmp = next_shkp(fmon(), FALSE); mtmp;
         mtmp = next_shkp(mtmp2, FALSE)) {
        mtmp2 = mtmp.nmon;
        eshkp = ESHK(mtmp);
        local = on_level(eshkp.shoplevel, u.uz);
        if (local && strchr(u.ushops, eshkp.shoproom)) {
            /* inside this shk's shop [there might be more than one
               resident shk if hero is standing in a breech of a shared
               wall, so give priority to one who's also owed money] */
            if (!resident || eshkp.billct || eshkp.debit || eshkp.robbed)
                resident = mtmp;
        } else if (eshkp.billct || eshkp.debit || eshkp.robbed) {
            /* owe this shopkeeper money (might also owe others) */
            if (!creditor)
                creditor = mtmp;
        } else if (eshkp.following || ANGRY(mtmp)) {
            /* this shopkeeper is antagonistic (others might be too) */
            if (!hostile)
                hostile = mtmp;
        } else if (local) {
            /* this shopkeeper's shop is on current level */
            if (!localshk)
                localshk = mtmp;
        }
    }

    /* give highest priority shopkeeper first crack */
    firstshk = resident ? resident
                        : creditor ? creditor
                                   : hostile ? hostile
                                             : localshk;
    if (firstshk) {
        numsk++;
        taken = inherits(firstshk, numsk, croaked, silently);
    }

    /* now handle the rest */
    for (mtmp = next_shkp(fmon(), FALSE); mtmp;
         mtmp = next_shkp(mtmp2, FALSE)) {
        mtmp2 = mtmp.nmon;
        eshkp = ESHK(mtmp);
        local = on_level(eshkp.shoplevel, u.uz);
        if (mtmp != firstshk) {
            numsk++;
            taken |= inherits(mtmp, numsk, croaked, silently);
        }
        /* for bones: we don't want a shopless shk around */
        if (!local)
            mongone(mtmp);
    }
    return taken;
}

/* decide whether a shopkeeper will take possession of dying hero's invent;
   when this returns True, it should call set_repo_loc() before returning;
   when it returns False, it should not do such because that might have
   already been called for some shopkeeper */
function inherits(
    shkp,
    numsk,
    croaked,
    silently) { /* boolean */
    const $frame = stack_frame(); try {
    let $goto = null; var takes = stack_array(char, BUFSZ);
    var loss = 0;
    var umoney;
    var eshkp = ESHK(shkp);
    var take = FALSE, taken = FALSE,
            uinshop = +(strchr(u.ushops, eshkp.shoproom) != 0);

    /* not strictly consistent; affects messages and prevents next player
       (if bones are saved) from blundering into or being ambushed by an
       invisible shopkeeper */
    shkp.minvis = shkp.perminvis = 0;

    /* The simplifying principle is that first-come
       already took everything you had. */
    $goto_skip: for (;;) { switch ($goto) { default: if (numsk > 1) {
        if (cansee(shkp.mx, shkp.my) && croaked && !silently) {
            chars[takes + 0] = ord('\0');
            if (has_head(shkp.data) && !rn2(2))
                sprintf(takes, _(", shakes %s %s,"), noit_mhis(shkp), mbodypart(shkp, HEAD))
;
            pline(_("%s %slooks at your corpse%s and %s."), Shknam(shkp),
                  helpless(shkp) ? _("wakes up, ") : _(""),
                  takes, !inhishop(shkp) ? _("disappears") : _("sighs"));
        }
        taken = uinshop;
        { $goto = "skip"; continue $goto_skip; }
    }

    /* get one case out of the way: you die in the shop, the
       shopkeeper is peaceful, nothing stolen, nothing owed */
    if (uinshop && inhishop(shkp) && !eshkp.billct
        && !eshkp.robbed && !eshkp.debit && NOTANGRY(shkp)
        && !eshkp.following && u.ugrave_arise < LOW_PM) {
        taken = +(gi.invent != null);
        if (taken && !silently)
            pline(_("%s gratefully inherits all your possessions."),
                  Shknam(shkp));
        { $goto = "clear"; continue $goto_skip; }
    }

    if (eshkp.billct || eshkp.debit || eshkp.robbed) {
        if (uinshop && inhishop(shkp))
            loss = addupbill(shkp) + eshkp.debit;
        if (loss < eshkp.robbed)
            loss = eshkp.robbed;
        take = TRUE;
    }

    case "skip": if ($goto || (eshkp.following || ANGRY(shkp) || take)) {
        switch ($goto) { default: if (!gi.invent)
            { $goto = "skip"; continue $goto_skip; };
        umoney = money_cnt(gi.invent);
        chars[takes + 0] = ord('\0');
        if (helpless(shkp))
            strcat(takes, _("wakes up and "));
        if (!m_next2u(shkp))
            strcat(takes, _("comes and "));
        strcat(takes, _("takes"));

        if (loss > umoney || !loss || uinshop) {
            eshkp.robbed -= umoney;
            if (eshkp.robbed < 0)
                eshkp.robbed = 0;
            if (umoney > 0) {
                money2mon(shkp, umoney);
                disp.botl = TRUE;
            }
            if (!silently)
                pline(_("%s %s all your possessions."), Shknam(shkp), takes);
            taken = TRUE;
        } else {
            money2mon(shkp, loss);
            disp.botl = TRUE;
            if (!silently)
                pline(_("%s %s the %lld %s %sowed %s."), Shknam(shkp),
                      takes, loss, currency(loss),
                      strncmp(eshkp.customer, svp.plname, PL_NSIZ) ? _("")
                        : _("you "),
                      noit_mhim(shkp));
            /* shopkeeper has now been paid in full */
            pacify_shk(shkp, FALSE);
            eshkp.following = 0;
            eshkp.robbed = 0;
        }
 case "skip": $goto = null;
        /* in case we create bones */
        rouse_shk(shkp, FALSE); } /* wake up */
        if (!inhishop(shkp))
            home_shk(shkp, FALSE);
    }
 case "clear": $goto = null;
    setpaid(shkp); } break; } /* clear this shk's bill */
    /* where to put player's invent (after disclosure) */
    if (taken)
        set_repo_loc(shkp);
    return taken;
    } finally { stack_pop($frame); }
}

function set_repo_loc(shkp) { /* void */
    let ox, oy;
    let eshkp = ESHK(shkp);

    /* when multiple shopkeepers are present, we might get called more
       than once; don't override previous setting */
    if (gr.repo.shopkeeper)
        return;

    /* savebones() sets u.ux,u.uy to 0,0 to remove hero from map but that
       takes place after finish_paybill() has been called so we expect
       u.ux,u.uy to be valid; however, there has been a report of
       impossible "place_object: \"<item>\" off map <0,0>" when hero died
       in a gap in a shop's wall (in Minetown, so multiple shopkeepers in
       play, and prior to adding 'if (gr.repo.shopkeeper) return' above) */
    ox = u.ux ? u.ux : u.ux0;
    oy = u.ux ? u.uy : u.uy0; /* [testing u.ux when setting oy is correct] */

    /* if you're not in this shk's shop room, or if you're in its doorway
       or entry spot or one of its walls (temporary gap or Passes_walls),
       then your gear gets dumped all the way inside */
    if (!strchr(u.ushops, eshkp.shoproom) || costly_adjacent(shkp, ox, oy)) {
        /* shk.x,shk.y is the position immediately in front of the door;
           move in one more space */
        ox = eshkp.shk.x;
        oy = eshkp.shk.y;
        ox += sgn(ox - eshkp.shd.x);
        oy += sgn(oy - eshkp.shd.y);
    } else {
        ; /* already inside this shk's shop so use ox,oy as-is */
    }
    /* finish_paybill will deposit invent here */
    gr.repo.location.x = ox;
    gr.repo.location.y = oy;
    gr.repo.shopkeeper = shkp;
}

/* called at game exit, after inventory disclosure but before making bones;
   shouldn't issue any messages */
export function finish_paybill() { /* void */
    let shkp = gr.repo.shopkeeper;
    let ox = gr.repo.location.x, oy = gr.repo.location.y;

    /*
     * If set_repo_loc() didn't get called for some reason (good luck
     * untangling inherits() to figure out why...), ox,oy will be 0,0
     * and shkp will be Null.  Fix coordinates if that happens.
     */

    if (!isok(ox, oy)) {
        /* this used to be suppressed as "don't bother" (too late to matter)
           but that led to "place_object: \"<item>\" off map <0,0>" warning */
        if (shkp)
            impossible(_("finish_paybill: bad location <%d,%d>."), ox, oy);
        /* force a valid location */
        ox = u.ux ? u.ux : u.ux0;
        oy = u.ux ? u.uy : u.uy0; /* [note: testing u.ux when setting oy
                                   *  is correct here]*/
    }
    /* normally done by savebones(), but that's too late in this case */
    unleash_all();
    /* if hero has any gold left, take it into shopkeeper's possession */
    if (shkp) {
        let umoney = money_cnt(gi.invent);

        if (umoney)
            money2mon(shkp, umoney);
    }
    /* transfer rest of the character's inventory to the shop floor */
    drop_upon_death(null, null, ox, oy);
}

/* find obj on one of the lists */
function bp_to_obj(bp) { /* struct obj * */
    let obj;
    let id = bp.bo_id;

    if (bp.useup)
        obj = o_on(id, gb.billobjs);
    else
        obj = find_oid(id);
    return obj;
}

/*
 * Look for o_id on all lists but billobj.  Return obj or NULL if not found.
 * Its OK for restore_timers() to call this function, there should not
 * be any timeouts on the gb.billobjs chain.
 */
export function find_oid(id) { /* struct obj * */
    const $frame = stack_frame(); try {
    let obj;
    let mon, mmtmp = stack_array(ptr_to(struct_monst), 3);
    let i;

    /* first check various obj lists directly */
    if ((obj = o_on(id, gi.invent)) != null)
        return obj;
    if ((obj = o_on(id, fobj())) != null)
        return obj;
    if ((obj = o_on(id, svl.level.buriedobjlist)) != null)
        return obj;
    if ((obj = o_on(id, gm.migrating_objs)) != null)
        return obj;

    /* not found yet; check inventory for members of various monst lists */
    mmtmp[0] = fmon();
    mmtmp[1] = gm.migrating_mons;
    mmtmp[2] = gm.mydogs; /* for use during level changes */
    for (i = 0; i < 3; i++)
        for (mon = mmtmp[i]; mon; mon = mon.nmon)
            if ((obj = o_on(id, mon.minvent)) != null)
                return obj;

    /* not found at all */
    return null;
    } finally { stack_pop($frame); }
}

/* Returns the price of an arbitrary item in the shop,
   0 if the item doesn't belong to a shopkeeper or hero is not in the shop. */
export function get_cost_of_shop_item(
    obj,
    nochrg) { /* long long */ /* alternate return value: 1: no charge, 0: shop owned, * -1: not in a shop (so don't format as "no charge") */
    const $frame = stack_frame(); try {
    let shkp;
    let top;
    let x = stack_var(coordxy), y = stack_var(coordxy);
    let freespot;
    let cost = 0;

    nochrg[0] = -1; /* assume 'not applicable' */
    if (chars[u.ushops] && obj.oclass != COIN_CLASS
        && obj != uball && obj != uchain
        && get_obj_location(obj, x, y, CONTAINED_TOO)
        && chars[in_rooms(x[0], y[0], SHOPBASE)] == chars[u.ushops]
        && (shkp = shop_keeper(inside_shop(x[0], y[0]))) != null && inhishop(shkp)) {
        for (top = obj; top.where == OBJ_CONTAINED; top = top.v.v_ocontainer)
            continue;
        freespot = +(top.where == OBJ_FLOOR
                    && x[0] == ESHK(shkp).shk.x && y[0] == ESHK(shkp).shk.y);
        /* no_charge is only set for floor items inside shop proper;
           items on freespot are implicitly 'no charge' */
        nochrg[0] = (top.where == OBJ_FLOOR && (obj.no_charge || freespot) ? 1 : 0);

        if (carried(top) ? obj.unpaid : !nochrg[0]) {
            let per_unit_cost = get_cost(obj, shkp);

            cost = get_pricing_units(obj) * per_unit_cost;
        }
        if (Has_contents(obj) && !freespot)
            cost += contained_cost(obj, shkp, 0, FALSE, TRUE);
    }
    return cost;
    } finally { stack_pop($frame); }
}

function get_pricing_units(obj) { /* long long */
    let units = obj.quan;

    if (obj.globby) {
        /* globs must be sold by weight not by volume */
        let unit_weight = (objects[obj.otyp].oc_weight),
             wt = (obj.owt > 0) ? obj.owt : weight(obj);

        if (unit_weight)
            units = Math.trunc((wt + unit_weight - 1) / unit_weight);
    }
    return units;
}

/* decide whether to apply a surcharge (or hypothetically, a discount) to obj
   if it had ID number 'oid'; returns 1: increase, 0: normal, -1: decrease */
export function oid_price_adjustment(obj, oid) { /* int */
    let res = 0, otyp = obj.otyp;

    if (!(obj.dknown && objects[otyp].oc_name_known)
        && (obj.oclass != GEM_CLASS || objects[otyp].oc_material != GLASS)) {
        res = +((oid % 4) == 0); /* id%4 ==0 -> +1, ==1..3 -> 0 */
    }
    return res;
}

/* calculate the value that the shk will charge for [one of] an object */
function get_cost(
    obj,
    shkp) { /* long long */ /* if angry, impose a surcharge */
    /*
     * FIXME:
     *  If this obj is already on the shop's bill, use the price which
     *  has been set there.  Otherwise, the amount could be different
     *  (if billed while undiscovered and now become discovered or
     *  hero's charisma and/or visible worn gear have changed).
     */
    let tmp = getprice(obj, FALSE),

        multiplier = 1, divisor = 1;

    if (!tmp)
        tmp = 5;
    /* shopkeeper may notice if the player isn't very knowledgeable -
       especially when gem prices are concerned */
    if (!obj.dknown || !objects[obj.otyp].oc_name_known) {
        if (obj.oclass == GEM_CLASS
            && objects[obj.otyp].oc_material == GLASS) {
            let i;
            /* get a value that's 'random' from game to game, but the
               same within the same game */
            let pseudorand = +((int(ubirthday) % obj.otyp) >= Math.trunc(obj.otyp / 2));

            /* all gems are priced high - real or not */
            switch (obj.otyp - FIRST_GLASS_GEM) {
            case 0: /* white */
                i = pseudorand ? DIAMOND : OPAL;
                break;
            case 1: /* blue */
                i = pseudorand ? SAPPHIRE : AQUAMARINE;
                break;
            case 2: /* red */
                i = pseudorand ? RUBY : JASPER;
                break;
            case 3: /* yellowish brown */
                i = pseudorand ? AMBER : TOPAZ;
                break;
            case 4: /* orange */
                i = pseudorand ? JACINTH : AGATE;
                break;
            case 5: /* yellow */
                i = pseudorand ? CITRINE : CHRYSOBERYL;
                break;
            case 6: /* black */
                i = pseudorand ? BLACK_OPAL : JET;
                break;
            case 7: /* green */
                i = pseudorand ? EMERALD : JADE;
                break;
            case 8: /* violet */
                i = pseudorand ? AMETHYST : FLUORITE;
                break;
            default:
                impossible(_("bad glass gem %d?"), obj.otyp);
                i = STRANGE_OBJECT;
                break;
            }
            tmp = (objects[i].oc_cost);
        } else if (oid_price_adjustment(obj, obj.o_id) > 0) {
            /* unid'd, arbitrarily impose surcharge: tmp *= 4/3 */
            multiplier *= 4;
            divisor *= 3;
        }
    }
    if (uarmh && uarmh.otyp == DUNCE_CAP)
        multiplier *= 4, divisor *= 3;
    else if ((Role_if(PM_TOURIST) && u.ulevel < Math.trunc(MAXULEV / 2))
             || (uarmu && !uarm && !uarmc)) /* touristy shirt visible */
        multiplier *= 4, divisor *= 3;

    if (ACURR(A_CHA) > 18)
        divisor *= 2;
    else if (ACURR(A_CHA) == 18)
        multiplier *= 2, divisor *= 3;
    else if (ACURR(A_CHA) >= 16)
        multiplier *= 3, divisor *= 4;
    else if (ACURR(A_CHA) <= 5)
        multiplier *= 2;
    else if (ACURR(A_CHA) <= 7)
        multiplier *= 3, divisor *= 2;
    else if (ACURR(A_CHA) <= 10)
        multiplier *= 4, divisor *= 3;

    /* tmp = (tmp * multiplier) / divisor [with roundoff tweak] */
    tmp *= multiplier;
    if (divisor > 1) {
        /* tmp = (((tmp * 10) / divisor) + 5) / 10 */
        tmp *= 10;
        tmp = Math.trunc(tmp / divisor);
        tmp += 5;
        tmp = Math.trunc(tmp / 10);
    }

    if (tmp <= 0)
        tmp = 1;
    /* the artifact prices in artilist[] are also used as a score bonus;
       inflate their shop price here without affecting score calculation */
    if (obj.oartifact)
        tmp *= 4;

    /* anger surcharge should match rile_shk's, so we do it separately
       from the multiplier/divisor calculation */
    if (shkp && ESHK(shkp).surcharge)
        tmp += Math.trunc((tmp + 2) / 3);
    return tmp;
}

/* returns the price of a container's content.  the price
 * of the "top" container is added in the calling functions.
 * a different price quoted for selling as vs. buying.
 */
export function contained_cost(
    obj,
    shkp,
    price,
    usell,
    unpaid_only) { /* long long */
    const $frame = stack_frame(); try {
    let otmp, top;
    let x = stack_var(coordxy), y = stack_var(coordxy);
    let on_floor, freespot;

    for (top = obj; top.where == OBJ_CONTAINED; top = top.v.v_ocontainer)
        continue;
    /* pick_obj() removes item from floor, adds it to shop bill, then
       puts it in inventory; behave as if it is still on the floor
       during the add-to-bill portion of that situation */
    on_floor = +(top.where == OBJ_FLOOR || top.where == OBJ_FREE);
    if (top.where == OBJ_FREE || !get_obj_location(top, x, y, 0))
        x[0] = u.ux, y[0] = u.uy;
    freespot = (on_floor && x[0] == ESHK(shkp).shk.x && y[0] == ESHK(shkp).shk.y ? 1 : 0);

    /* price of contained objects; "top" container handled by caller */
    for (otmp = obj.cobj; otmp; otmp = otmp.nobj) {
        if (otmp.oclass == COIN_CLASS)
            continue;

        if (usell) {
            if (saleable(shkp, otmp) && !otmp.unpaid
                && otmp.oclass != BALL_CLASS
                && !(otmp.oclass == FOOD_CLASS && otmp.oeaten)
                && !(Is_candle(otmp)
                     && otmp.age < 20 * (objects[otmp.otyp].oc_cost)))
                price += set_cost(otmp, shkp);
        } else {
            /* no_charge is only set for floor items (including
               contents of floor containers) inside shop proper;
               items on freespot are implicitly 'no charge' */
            if (on_floor ? (!otmp.no_charge && !freespot)
                         : (otmp.unpaid || !unpaid_only))
                price += get_cost(otmp, shkp) * get_pricing_units(otmp);
        }

        if (Has_contents(otmp))
            price = contained_cost(otmp, shkp, price, usell, unpaid_only);
    }

    return price;
    } finally { stack_pop($frame); }
}

/* count amount of gold inside container 'obj' and any nested containers */
export function contained_gold(
    obj,
    even_if_unknown) { /* long long */ /* T: all gold; F: limit to known contents */
    let otmp;
    let value = 0;

    /* accumulate contained gold */
    for (otmp = obj.cobj; otmp; otmp = otmp.nobj)
        if (otmp.oclass == COIN_CLASS)
            value += otmp.quan;
        else if (Has_contents(otmp) && (otmp.cknown || even_if_unknown))
            value += contained_gold(otmp, even_if_unknown);

    return value;
}

function dropped_container(
    obj,
    shkp,
    sale) { /* void */
    let otmp;

    /* the "top" container is treated in the calling fn */
    for (otmp = obj.cobj; otmp; otmp = otmp.nobj) {
        if (otmp.oclass == COIN_CLASS)
            continue;

        if (!otmp.unpaid && !(sale && saleable(shkp, otmp)))
            otmp.no_charge = 1;

        if (Has_contents(otmp))
            dropped_container(otmp, shkp, sale);
    }
}

export function picked_container(obj) { /* void */
    let otmp;

    /* the "top" container is treated in the calling fn */
    for (otmp = obj.cobj; otmp; otmp = otmp.nobj) {
        if (otmp.oclass == COIN_CLASS)
            continue;

        if (otmp.no_charge)
            otmp.no_charge = 0;

        if (Has_contents(otmp))
            picked_container(otmp);
    }
}

function special_stock(
    obj,
    shkp,
    quietly) { /* boolean */
    /* for unique situations */
    if (ESHK(shkp).shoptype == CANDLESHOP
        && obj.otyp == CANDELABRUM_OF_INVOCATION) {
        if (!quietly) {
            if (is_izchak(shkp, TRUE) && !u.uevent.invoked) {
                if (Deaf() || muteshk(shkp)) {
                    pline(_("%s seems %s that you want to sell that."),
                          Shknam(shkp),
                          (obj.spe < 7) ? _("horrified") : _("concerned"));
                } else {
                       ;
                    verbalize(_("No thanks, I'd hang onto that if I were you."));
                    if (obj.spe < 7) {
                           ;
                        verbalize(
                             _("You'll need %d%s candle%s to go along with it."),
                                (7 - obj.spe), (obj.spe > 0) ? _(" more") : _(""),
                                  plur(7 - obj.spe));
                    }
                    /* [what if hero is already carrying enough candles?
                       should Izchak explain how to attach them instead?] */
                }
            } else {
                if (!Deaf() && !muteshk(shkp)) {
                       ;
                    verbalize(_("I won't stock that.  Take it out of here!"));
                } else {
                    pline(_("%s shakes %s %s in refusal."),
                          Shknam(shkp), noit_mhis(shkp),
                          mbodypart(shkp, HEAD));
                }
            }
        }
        return TRUE;
    }
    return FALSE;
}

/* calculate how much the shk will pay when buying [all of] an object */
function set_cost(obj, shkp) { /* long long */
    let tmp, unit_price = getprice(obj, TRUE), multiplier = 1, divisor = 1;

    tmp = get_pricing_units(obj) * unit_price;

    if (uarmh && uarmh.otyp == DUNCE_CAP)
        divisor *= 3;
    else if ((Role_if(PM_TOURIST) && u.ulevel < Math.trunc(MAXULEV / 2))
             || (uarmu && !uarm && !uarmc)) /* touristy shirt visible */
        divisor *= 3;
    else
        divisor *= 2;

    /* shopkeeper may notice if the player isn't very knowledgeable -
       especially when gem prices are concerned */
    if (!obj.dknown || !objects[obj.otyp].oc_name_known) {
        if (obj.oclass == GEM_CLASS) {
            /* different shop keepers give different prices */
            if (objects[obj.otyp].oc_material == GEMSTONE
                || objects[obj.otyp].oc_material == GLASS) {
                tmp = (unsigned((obj.otyp - FIRST_REAL_GEM)) % (6 - shkp.m_id % 3));
                tmp = (tmp + 3) * obj.quan;
                divisor = 1;
            }
        } else if (tmp > 1 && !(shkp.m_id % 4))
            multiplier *= 3, divisor *= 4;
    }

    if (tmp >= 1) {
        /* [see get_cost()] */
        tmp *= multiplier;
        if (divisor > 1) {
            tmp *= 10;
            tmp = Math.trunc(tmp / divisor);
            tmp += 5;
            tmp = Math.trunc(tmp / 10);
        }
        /* avoid adjusting nonzero to zero */
        if (tmp < 1)
            tmp = 1;
    }

    /* (no adjustment for angry shk here) */
    return tmp;
}

/* unlike alter_cost() which operates on a specific item, identifying or
   forgetting a gem causes all unpaid gems of its type to change value */
export function gem_learned(oindx) { /* void */
    let obj;
    let shkp;
    let bp;
    let ct;

    /*
     * Unfortunately, shop bill doesn't have object type included,
     * just obj->oid for each unpaid stack, so we have to go through
     * every bill and every item on that bill and match up against
     * every unpaid stack on the level....
     *
     * Fortunately, there's no need to catch up when changing dungeon
     * levels even if we ID'd or forget some gems while gone from a
     * level.  There won't be any shop bills when arriving; they were
     * either paid before leaving or got treated as robbery and it's
     * too late to adjust pricing.
     */
    for (shkp = next_shkp(fmon(), TRUE); shkp;
         shkp = next_shkp(shkp.nmon, TRUE)) {
        ct = ESHK(shkp).billct;
        bp = ESHK(shkp).bill_p;
        while (--ct >= 0) {
            obj = find_oid(bp.bo_id);
            if (!obj) /* shouldn't happen */
                continue;
            if ((oindx != STRANGE_OBJECT) ? (obj.otyp == oindx)
                                          : (obj.oclass == GEM_CLASS))
                bp.price = get_cost(obj, shkp);
            bp = ptr_add(bp, 1);
        }
    }
}

/* called when an item's value has been enhanced; if it happens to be
   on any shop bill, update that bill to reflect the new higher price
   [if the new price drops for some reason, keep the old one in place] */
export function alter_cost(
    obj,
    amt) { /* void */ /* if 0, use regular shop pricing, otherwise force amount; if negative, use abs(amt) even if it's less than old cost */
    let bp = null;
    let shkp;
    let new_price;

    for (shkp = next_shkp(fmon(), TRUE); shkp; shkp = next_shkp(shkp, TRUE))
        if ((bp = onbill(obj, shkp, TRUE)) != null) {
            new_price = !amt ? get_cost(obj, shkp) : (amt < 0) ? -amt : amt;
            if (new_price > bp.price || amt < 0) {
                bp.price = new_price;
                update_inventory();
            }
            break; /* done */
        }
    return;
}

/* called from doinv(invent.c) for inventory of unpaid objects */
export function unpaid_cost(
    unp_obj,
    cost_type) { /* long long */ /* COST_NOCONTENTS, COST_CONTENTS, or COST_SINGLEOBJ */
    let bp = null;
    let shkp = null;
    let shop;
    let amt = 0;

    /* #if 0: not in this build */

    for (shop = u.ushops; chars[shop]; shop++) {
        if ((shkp = shop_keeper(chars[shop])) != null) {
            if ((bp = onbill(unp_obj, shkp, TRUE))) {
                amt = bp.price;
                if (cost_type != COST_SINGLEOBJ) {
                    /* use quan rather than get_pricing_units -- glob weight
                       should already be factored into bp->price */
                    amt *= unp_obj.quan;
                }
            }
            if (cost_type == COST_CONTENTS && Has_contents(unp_obj))
                amt = contained_cost(unp_obj, shkp, amt, FALSE, TRUE);
            if (bp || (!unp_obj.unpaid && amt))
                break;
        }
    }

    /* onbill() gave no message if unexpected problem occurred */
    if (!shkp || (unp_obj.unpaid && !bp))
        impossible(_("unpaid_cost: object wasn't on any bill."));
    return amt;
}

/* add 'obj' to 'shkp's bill */
function add_one_tobill(
    obj,
    dummy,
    shkp$) { /* void */
    const $frame = stack_frame(); try {
    const shkp = stack_var(ptr_to(struct_monst), shkp$);
    let eshkp;
    let bp;
    let bct;
    let unbilled = FALSE;

    eshkp = ESHK(shkp[0]);
    /* normally bill_p gets set up whenever you enter the shop, but obj
       might be going onto the bill because hero just snagged it with
       a grappling hook from outside without ever having been inside */
    if (!eshkp.bill_p)
        eshkp.bill_p = eshkp.bill[0];

    if (!billable(shkp, obj, chars[u.ushops], TRUE)) {
        /* shk doesn't want it */
        unbilled = TRUE;
    } else if (eshkp.billct == BILLSZ) {
        /* shk's bill is completely full */
        You(_("got that for free!"));
        unbilled = TRUE;
    }
    /* if not on any list (probably from bill_dummy_object() which creates
       a new OBJ_FREE object), don't leave unmanaged object hanging around */
    if (unbilled) {
        if (obj.where == OBJ_FREE)
            dealloc_obj(obj); /* change to obj->where==OBJ_DELETED */
        return;
    }

    bct = eshkp.billct;
    bp = ptr_add(eshkp.bill_p, bct);
    bp.bo_id = obj.o_id;
    bp.bquan = obj.quan;
    if (dummy) {              /* a dummy object must be inserted into  */
        bp.useup = TRUE;     /* the gb.billobjs chain here.  crucial for */
        add_to_billobjs(obj); /* eating floorfood in shop.  see eat.c  */
    } else
        bp.useup = FALSE;
    bp.price = get_cost(obj, shkp[0]);
    if (obj.globby) {
        /* for globs, the amt charged for quan 1 depends on owt */
        bp.price *= get_pricing_units(obj);
        /* remember the weight this glob had when it was added to bill;
           glob oextra_owt field overlays corpse omid field */
        newomid(obj);
        ((obj).oextra.omid) = obj.owt;
    }
    eshkp.billct++;
    obj.unpaid = 1;
    record_price_quote(obj.otyp, ulong(bp.price), TRUE);
    } finally { stack_pop($frame); }
}

function add_to_billobjs(obj) { /* void */
    if (obj.where != OBJ_FREE)
        panic(_("add_to_billobjs: obj not free"));
    if (obj.timed)
        obj_stop_timers(obj);

    obj.nobj = gb.billobjs;
    gb.billobjs = obj;
    obj.where = OBJ_ONBILL;

    /* if hero drinks a shop-owned potion, it will have been flagged
       in_use by dodrink/dopotion but isn't being used up yet because
       it stays on the bill; only object sanity checking actually cares */
    obj.in_use = 0;
    /* ... same for bypass by destroy_items */
    obj.bypass = 0;
}

/* recursive billing of objects within containers. */
function bill_box_content(
    obj,
    ininv,
    dummy,
    shkp) { /* void */
    let otmp;

    if (SchroedingersBox(obj))
        return;
    for (otmp = obj.cobj; otmp; otmp = otmp.nobj) {
        if (otmp.oclass == COIN_CLASS)
            continue;

        /* the "top" box is added in addtobill() */
        if (!otmp.no_charge)
            add_one_tobill(otmp, dummy, shkp);
        if (Has_contents(otmp))
            bill_box_content(otmp, ininv, dummy, shkp);
    }
}

/* shopkeeper tells you what you bought or sold, sometimes partly IDing it */
function shk_names_obj(
    shkp,
    obj,
    fmt,
    amt,
    arg) { /* void */
    const $frame = stack_frame(); try {
    let obj_name, fmtbuf = stack_array(char, BUFSZ);
    let was_unknown = +!obj.dknown;

    observe_object(obj);
    /* Use real name for ordinary weapons/armor, and spell-less
     * scrolls/books (that is, blank and mail), but only if the
     * object is within the shk's area of interest/expertise.
     */
    if (!objects[obj.otyp].oc_magic && saleable(shkp, obj)
        && (obj.oclass == WEAPON_CLASS || obj.oclass == ARMOR_CLASS
            || obj.oclass == SCROLL_CLASS || obj.oclass == SPBOOK_CLASS
            || obj.otyp == MIRROR)) {
        was_unknown |= +!objects[obj.otyp].oc_name_known;
        makeknown(obj.otyp);
    }
    obj_name = paydoname(obj);
    /* Use an alternate message when extra information is being provided */
    if (was_unknown) {
        sprintf(fmtbuf, _("%%s; you %s"), fmt);
        chars[obj_name + 0] = highc(chars[obj_name + 0]);
        pline(fmtbuf, obj_name, (obj.quan > 1) ? _("them") : _("it"), amt,
              plur(amt), arg);
    } else {
        You(fmt, obj_name, amt, plur(amt), arg);
    }
    } finally { stack_pop($frame); }
}

/* decide whether a shopkeeper thinks an item belongs to her */
export function billable(
    shkpp,

    obj,
    roomno,
    reset_nocharge) { /* boolean */
    let shkp = shkpp[0];

    /* if caller hasn't supplied a shopkeeper, look one up now */
    if (!shkp) {
        if (!roomno)
            return FALSE;
        shkp = shop_keeper(roomno);
        if (!shkp || !inhishop(shkp))
            return FALSE;
        shkpp[0] = shkp;
    }
    /* perhaps we threw it away earlier */
    if (onbill(obj, shkp, FALSE)
        || (obj.oclass == FOOD_CLASS && obj.oeaten))
        return FALSE;
    /* outer container might be marked no_charge but still have contents
       which should be charged for; clear no_charge when picking things up */
    if (obj.no_charge) {
        if (!Has_contents(obj) || (contained_gold(obj, TRUE) == 0
                                   && contained_cost(obj, shkp, 0, FALSE,
                                                     +!reset_nocharge) == 0))
            shkp = null; /* not billable */
        if (reset_nocharge && !shkp && obj.oclass != COIN_CLASS) {
            obj.no_charge = 0;
            if (Has_contents(obj))
                picked_container(obj); /* clear no_charge */
        }
    }
    return shkp ? TRUE : FALSE;
}

export function addtobill(
    obj,
    ininv,
    dummy,
    silent) { /* void */
    const $frame = stack_frame(); try {
    let shkp = stack_var(ptr_to(struct_monst), null);
    let ltmp, cltmp, gltmp;
    let contentscount;
    let container;

    if (!billable(shkp, obj, chars[u.ushops], TRUE))
        return;

    if (obj.oclass == COIN_CLASS) {
        costly_gold(obj.ox, obj.oy, obj.quan, silent);
        return;
    } else if (ESHK(shkp[0]).billct == BILLSZ) {
        if (!silent)
            You(_("got that for free!"));
        return;
    }

    ltmp = cltmp = gltmp = 0;
    container = Has_contents(obj);

    if (!obj.no_charge) {
        ltmp = get_cost(obj, shkp[0]);
        if (obj.globby)
            ltmp *= get_pricing_units(obj);
    }
    if (obj.no_charge && !container) {
        obj.no_charge = 0;
        return;
    }

    if (container) {
        cltmp = contained_cost(obj, shkp[0], cltmp, FALSE, FALSE);
        gltmp = contained_gold(obj, TRUE);

        if (ltmp)
            add_one_tobill(obj, dummy, shkp[0]);
        if (cltmp)
            bill_box_content(obj, ininv, dummy, shkp[0]);
        picked_container(obj); /* reset contained obj->no_charge */

        ltmp += cltmp;

        if (gltmp) {
            costly_gold(obj.ox, obj.oy, gltmp, silent);
            if (!ltmp)
                return;
        }

        if (obj.no_charge)
            obj.no_charge = 0;
        contentscount = count_unpaid(obj.cobj);
    } else { /* !container */
        add_one_tobill(obj, dummy, shkp[0]);
        contentscount = 0;
    }

    if (!Deaf() && !muteshk(shkp[0]) && !silent) {
        let buf = stack_array(char, BUFSZ);

        /* no need to update price quotes here; it was done by
           add_one_tobill above */

        if (!ltmp) {
            pline(_("%s has no interest in %s."), Shknam(shkp[0]), the(xname(obj)));
            return;
        }
        if (!ininv) {
            pline(_("%s will cost you %lld %s%s."), The(xname(obj)), ltmp,
                  currency(ltmp), (obj.quan > 1) ? _(" each") : _(""));
        } else {
            let save_quan = obj.quan;

            strcpy(buf, _("\"For you,"));
            if (ANGRY(shkp[0])) {
                strcat(buf, _(" scum;"));
            } else if (!ESHK(shkp[0]).surcharge) {
                strcat(buf, _(" "));
                append_honorific(buf);
                strcat(buf, _("; only"));
            }
            obj.quan = 1; /* fool xname() into giving singular */
            set_voice(shkp[0], 0, 80, 0);
            pline(_("%s %lld %s %s %s%s.\""), buf, ltmp, currency(ltmp),
                  (save_quan > 1) ? _("per")
                                   : (contentscount && !obj.unpaid)
                                       ? _("for the contents of this")
                                       : _("for this"),
                  xname(obj),
                  (contentscount && obj.unpaid) ? and_its_contents : _(""));
            obj.quan = save_quan;
        }
    } else if (!silent) {
        if (ltmp) {
            set_voice(shkp[0], 0, 80, 0);
            pline_The(_("list price of %s%s%s is %lld %s%s."),
                      (contentscount && !obj.unpaid) ? the_contents_of : _(""),
                      the(xname(obj)),
                      (contentscount && obj.unpaid) ? and_its_contents : _(""),
                      ltmp, currency(ltmp), (obj.quan > 1) ? _(" each") : _(""));
        } else {
            pline(_("%s does not notice."), Shknam(shkp[0]));
        }
    }
    } finally { stack_pop($frame); }
}

function append_honorific(buf) { /* void */
    /* (chooses among [0]..[3] normally; [1]..[4] after the
       Wizard has been killed or invocation ritual performed) */
    let honored = static_array("append_honorific.honored", ptr_to(char), null, [
        _("good"), _("honored"), _("most gracious"), _("esteemed"),
        _("most renowned and sacred")
    ]);

    strcat(buf, honored[rn2(SIZE(honored) - 1) + u.uevent.udemigod]);
    if (is_vampire(gy.youmonst.data))
        strcat(buf, flags.female ? _(" dark lady") : _(" dark lord"));
    else if ((Upolyd() ? (is_elf(gy.youmonst.data)) : (Race_if(PM_ELF))))
        strcat(buf, flags.female ? _(" hiril") : _(" hir"));
    else
        strcat(buf, !is_human(gy.youmonst.data) ? _(" creature")
                      : flags.female ? _(" lady")
                        : _(" sir"));
}

export function splitbill(obj, otmp) { /* void */
    /* otmp has been split off from obj */
    let bp;
    let tmp;
    let shkp = shop_keeper(chars[u.ushops]);

    if (!shkp || !inhishop(shkp)) {
        impossible(_("splitbill: no resident shopkeeper??"));
        return;
    }
    bp = onbill(obj, shkp, FALSE);
    if (!bp) {
        impossible(_("splitbill: not on bill?"));
        return;
    }
    if (bp.bquan < otmp.quan) {
        impossible(_("Negative quantity on bill??"));
    }
    if (bp.bquan == otmp.quan) {
        impossible(_("Zero quantity on bill??"));
    }
    bp.bquan -= otmp.quan;

    if (ESHK(shkp).billct == BILLSZ) {
        otmp.unpaid = 0;
    } else {
        tmp = bp.price;
        bp = ptr_add(ESHK(shkp).bill_p, ESHK(shkp).billct);
        bp.bo_id = otmp.o_id;
        bp.bquan = otmp.quan;
        bp.useup = FALSE;
        bp.price = tmp;
        ESHK(shkp).billct++;
    }
}

function sub_one_frombill(obj, shkp) { /* void */
    let bp;
    let eshkp;

    if ((bp = onbill(obj, shkp, FALSE)) != null) {
        let otmp;

        obj.unpaid = 0;
        if (bp.bquan > obj.quan) {
            otmp = newobj();
            struct_assign(otmp, obj);
            otmp.oextra = null;
            bp.bo_id = otmp.o_id = next_ident(); /* svc.context.ident++ */
            otmp.where = OBJ_FREE;
            otmp.quan = (bp.bquan -= obj.quan);
            otmp.owt = 0; /* superfluous */
            bp.useup = TRUE;
            add_to_billobjs(otmp);
            return;
        }
        eshkp = ESHK(shkp);
        eshkp.billct--;
        struct_assign(bp, ptr_add(eshkp.bill_p, eshkp.billct));
        return;
    } else if (obj.unpaid) {
        impossible(_("sub_one_frombill: unpaid object not on bill"));
        obj.unpaid = 0;
    }
}

/* recursive check of unpaid objects within nested containers. */
export function subfrombill(obj, shkp) { /* void */
    let otmp;

    sub_one_frombill(obj, shkp);

    if (Has_contents(obj))
        for (otmp = obj.cobj; otmp; otmp = otmp.nobj) {
            if (otmp.oclass == COIN_CLASS)
                continue;

            if (Has_contents(otmp))
                subfrombill(otmp, shkp);
            else
                sub_one_frombill(otmp, shkp);
        }
}

function stolen_container(
    obj,
    shkp$,
    price,
    ininv) { /* long long */
    const $frame = stack_frame(); try {
    const shkp = stack_var(ptr_to(struct_monst), shkp$);
    let otmp;
    let bp;
    let billamt;

    /* the price of contained objects; caller handles top container */
    for (otmp = obj.cobj; otmp; otmp = otmp.nobj) {
        if (otmp.oclass == COIN_CLASS)
            continue;
        billamt = 0;
        if (!billable(shkp, otmp, ESHK(shkp[0]).shoproom, TRUE)) {
            /* billable() returns false for objects already on bill */
            if ((bp = onbill(otmp, shkp[0], FALSE)) == null)
                continue;
            assert(shkp[0] != null); /* onbill() found shkp so it's not Null */
            /* this assumes that we're being called by stolen_value()
               (or by a recursive call to self on behalf of it) where
               the cost of this object is about to be added to shop
               debt in place of having it remain on the current bill */
            billamt = bp.bquan * bp.price;
            sub_one_frombill(otmp, shkp[0]); /* avoid double billing */
        }

        if (billamt)
            price += billamt;
        else if (ininv ? otmp.unpaid : !otmp.no_charge)
            price += get_pricing_units(otmp) * get_cost(otmp, shkp[0]);

        if (Has_contents(otmp))
            price = stolen_container(otmp, shkp[0], price, ininv);
    }

    return price;
    } finally { stack_pop($frame); }
}

export function stolen_value(
    obj,
    x,
    y,
    peaceful,
    silent) { /* long long */
    const $frame = stack_frame(); try {
    let value = 0, gvalue = 0, billamt = 0;
    let roomno;
    let bp;
    let shkp = stack_var(ptr_to(struct_monst));
    let was_unpaid;
    let c_count = 0, u_count = 0;

    if ((shkp[0] = find_objowner(obj, x, y)) != null) {
        roomno = ESHK(shkp[0]).shoproom;
    } else {
        roomno = chars[in_rooms(x, y, SHOPBASE)];
    }

    /* gather information for message(s) prior to manipulating bill */
    was_unpaid = obj.unpaid ? TRUE : FALSE;
    if (Has_contents(obj)) {
        c_count = count_contents(obj, TRUE, FALSE, TRUE, FALSE);
        u_count = count_contents(obj, TRUE, FALSE, FALSE, FALSE);
    }

    shkp[0] = null;
    if (!billable(shkp, obj, roomno, TRUE)) {
        /* things already on the bill yield a not-billable result, so
           we need to check bill before deciding that shk doesn't care */
        if ((bp = onbill(obj, shkp[0], FALSE)) != null) {
            assert(shkp[0] != null); /* onbill() found shkp so it's not Null */
            /* shk does care; take obj off bill to avoid double billing */
            billamt = bp.bquan * bp.price;
            sub_one_frombill(obj, shkp[0]);
        }
        if (!bp && !u_count)
            return 0;
    }

    if (obj.oclass == COIN_CLASS) {
        gvalue += obj.quan;
    } else {
        if (billamt)
            value += billamt;
        else if (!obj.no_charge)
            value += get_pricing_units(obj) * get_cost(obj, shkp[0]);

        if (Has_contents(obj)) {
            let ininv = +(obj.where == OBJ_INVENT || obj.where == OBJ_FREE);

            value += stolen_container(obj, shkp[0], 0, ininv);
            if (!ininv)
                gvalue += contained_gold(obj, TRUE);
        }
    }

    if (gvalue + value == 0)
        return 0;

    value += gvalue;

    if (peaceful) {
        let credit_use = +!!ESHK(shkp[0]).credit;

        value = check_credit(value, shkp[0]);
        /* 'peaceful' affects general treatment, but doesn't affect
         * the fact that other code expects that all charges after the
         * shopkeeper is angry are included in robbed, not debit */
        if (ANGRY(shkp[0]))
            ESHK(shkp[0]).robbed += value;
        else
            ESHK(shkp[0]).debit += value;

        if (!silent) {
            let buf = stack_array(char, BUFSZ);
            let still = _("");

            if (credit_use) {
                if (ESHK(shkp[0]).credit) {
                    You(_("have %lld %s credit remaining."), ESHK(shkp[0]).credit,
                        currency(ESHK(shkp[0]).credit));
                    return value;
                } else if (!value) {
                    You(_("have no credit remaining."));
                    return 0;
                }
                still = _("still ");
            }
            sprintf(buf, _("%sowe %s %lld %s"), still, shkname(shkp[0]), value, currency(value))
;
            if (u_count) /* u_count > 0 implies Has_contents(obj) */
                sprintf(eos(buf), _(" for %s%sits contents"), was_unpaid ? _("it and ") : _(""), (c_count > u_count) ? _("some of ") : _(""));
            else if (obj.oclass != COIN_CLASS)
                sprintf(eos(buf), _(" for %s"), (obj.quan > 1) ? _("them") : _("it"))

;

            You(_("%s!"), buf); /* "You owe <shk> N zorkmids for it!" */
        }
    } else {
        ESHK(shkp[0]).robbed += value;

        if (!silent) {
            if (canseemon(shkp[0])) {
                Norep(_("%s booms: \"%s, you are a thief!\""),
                      Shknam(shkp[0]), svp.plname);
            } else if (!Deaf()) {
                Norep(_("You hear a scream, \"Thief!\""));  /* Deaf-aware */
            }
        }
        hot_pursuit(shkp[0]);
        angry_guards(FALSE);
    }
    return value;
    } finally { stack_pop($frame); }
}

/* opposite of costly_gold(); hero has dropped gold in a shop;
   called from sellobj(); ought to be called from subfrombill() too */
export function donate_gold(
    gltmp,
    shkp,
    selling) { /* void */ /* T: dropped in shop; F: kicked and landed in shop */
    let eshkp = ESHK(shkp);

    if (eshkp.debit >= gltmp) {
        if (eshkp.loan) { /* you carry shop's gold */
            if (eshkp.loan > gltmp)
                eshkp.loan -= gltmp;
            else
                eshkp.loan = 0;
        }
        eshkp.debit -= gltmp;
        Your(_("debt is %spaid off."), eshkp.debit ? _("partially ") : _(""));
    } else {
        let delta = gltmp - eshkp.debit;

        eshkp.credit += delta;
        if (eshkp.debit) {
            eshkp.debit = 0;
            eshkp.loan = 0;
            Your(_("debt is paid off."));
        }
        if (eshkp.credit == delta)
            You(_("have %sestablished %lld %s credit."),
                !selling ? _("re-") : _(""), delta, currency(delta));
        else
            pline(_("%lld %s added%s to your credit; total is now %lld %s."),
                  delta, currency(delta), !selling ? _(" back") : _(""),
                  eshkp.credit, currency(eshkp.credit));
    }
}

export function sellobj_state(deliberate) { /* void */
    /* If we're deliberately dropping something, there's no automatic
       response to the shopkeeper's "want to sell" query; however, if we
       accidentally drop anything, the shk will buy it/them without asking.
       This retains the old pre-query risk that slippery fingers while in
       shops entailed:  you drop it, you've lost it.
     */
    gs.sell_response = (deliberate != SELL_NORMAL) ? ord('\0') : ord('a');
    gs.sell_how = deliberate;
    ga.auto_credit = FALSE;
}

export function sellobj(
    obj,
    x, y) { /* void */
    const $frame = stack_frame(); try {
    let shkp;
    let eshkp;
    let ltmp = 0, cltmp = 0, gltmp = 0, offer, shkmoney;
    let saleitem, cgold = FALSE, container = Has_contents(obj);
    let isgold = +(obj.oclass == COIN_CLASS);
    let only_partially_your_contents = FALSE;

    if (!chars[u.ushops]) /* do cheapest exclusion test first */
        return;
    shkp = shop_keeper(chars[in_rooms(x, y, SHOPBASE)]);
    if (!shkp || !inhishop(shkp))
        return;
    if (!costly_spot(x, y))
        return;

    if (obj.unpaid && !container && !isgold) {
        sub_one_frombill(obj, shkp);
        return;
    }
    if (container) {
        /* find the price of content before subfrombill */
        cltmp = contained_cost(obj, shkp, cltmp, TRUE, FALSE);
        /* find the value of contained gold */
        gltmp += contained_gold(obj, TRUE);
        cgold = +(gltmp > 0);
    }

    saleitem = saleable(shkp, obj);
    if (!isgold && !obj.unpaid && saleitem)
        ltmp = set_cost(obj, shkp);

    offer = ltmp + cltmp;

    /* you dropped something of your own - probably want to sell it */
    rouse_shk(shkp, TRUE); /* wake up sleeping or paralyzed shk */
    eshkp = ESHK(shkp);

    if (ANGRY(shkp)) { /* they become shop-objects, no pay */
        if (!Deaf() && !muteshk(shkp)) {
               ;
            verbalize(_("Thank you, scum!"));
        } else {
            pline(_("%s smirks with satisfaction."), Shknam(shkp));
        }
        subfrombill(obj, shkp);
        return;
    }

    /* get one case out of the way: nothing to sell, and no gold */
    if (!(isgold || cgold)
        && ((offer + gltmp) == 0 || gs.sell_how == SELL_DONTSELL)) {
        let unpaid = is_unpaid(obj);

        if (container) {
            dropped_container(obj, shkp, FALSE);
            if (!obj.unpaid)
                obj.no_charge = 1;
            if (unpaid)
                subfrombill(obj, shkp);
        } else
            obj.no_charge = 1;

        if (!unpaid && (gs.sell_how != SELL_DONTSELL)
            && !special_stock(obj, shkp, FALSE))
            pline(_("%s seems uninterested."), Shknam(shkp));
        return;
    }

    if (eshkp.robbed) { /* bones; shop robbed by previous customer */
        if (isgold)
            offer = obj.quan;
        else if (cgold)
            offer += cgold;
        if ((eshkp.robbed -= +(offer < 0)))
            eshkp.robbed = 0;
        if (offer && !Deaf() && !muteshk(shkp)) {
               ;
            verbalize(
  _("Thank you for your contribution to restock this recently plundered shop."));
        }
        subfrombill(obj, shkp);
        return;
    }

    if (isgold || cgold) {
        if (!cgold)
            gltmp = obj.quan;

        donate_gold(gltmp, shkp, TRUE);

        if (!offer || gs.sell_how == SELL_DONTSELL) {
            if (!isgold) {
                if (container)
                    dropped_container(obj, shkp, FALSE);
                if (!obj.unpaid)
                    obj.no_charge = 1;
                subfrombill(obj, shkp);
            }
            return;
        }
    }

    if ((!saleitem && !(container && cltmp > 0)) || eshkp.billct == BILLSZ
        || obj.oclass == BALL_CLASS || obj.oclass == CHAIN_CLASS
        || offer == 0 || (obj.oclass == FOOD_CLASS && obj.oeaten)
        || (Is_candle(obj)
            && obj.age < 20 * (objects[obj.otyp].oc_cost))) {
        pline(_("%s seems uninterested%s."), Shknam(shkp),
              cgold ? _(" in the rest") : _(""));
        if (container)
            dropped_container(obj, shkp, FALSE);
        obj.no_charge = 1;
        return;
    }

    shkmoney = money_cnt(shkp.minvent);
    if (!shkmoney) {
        let c, qbuf = stack_array(char, BUFSZ);
        let tmpcr = Math.trunc((offer * 9) / 10) + +(offer <= 1);

        if (gs.sell_how == SELL_NORMAL || ga.auto_credit) {
            c = gs.sell_response = ord('y');
        } else if (gs.sell_response != ord('n')) {
            pline(_("%s cannot pay you at present."), Shknam(shkp));
            sprintf(qbuf, _("Will you accept %lld %s in credit for "), tmpcr, currency(tmpcr))
;
            record_price_quote(obj.otyp, ulong(Math.trunc(tmpcr / obj.quan)), FALSE);
            c = yn_function(safe_qbuf(qbuf, qbuf, _("?"), obj, doname, thesimpleoname,
                               (obj.quan == 1) ? _("that") : _("those")), ynaqchars, ord("y"), TRUE);
            if (c == ord('a')) {
                c = ord('y');
                ga.auto_credit = TRUE;
            }
        } else /* previously specified "quit" */
            c = ord('n');

        if (c == ord('y')) {
            shk_names_obj(shkp, obj,
                          ((gs.sell_how != SELL_NORMAL)
                           ? _("traded %s for %lld zorkmid%s in %scredit.")
                    : _("relinquish %s and acquire %lld zorkmid%s in %scredit.")),
                          tmpcr, (eshkp.credit > 0) ? _("additional ") : _(""));
            eshkp.credit += tmpcr;
            if (container)
                dropped_container(obj, shkp, TRUE);
            subfrombill(obj, shkp);
        } else {
            if (c == ord('q'))
                gs.sell_response = ord('n');
            if (container)
                dropped_container(obj, shkp, FALSE);
            if (!obj.unpaid)
                obj.no_charge = 1;
            subfrombill(obj, shkp);
        }
    } else {
        let qbuf = stack_array(char, BUFSZ), qsfx = stack_array(char, BUFSZ);
        let short_funds = +(offer > shkmoney), one;

        if (short_funds)
            offer = shkmoney;
        if (!gs.sell_response) {
            let yourc = 0, shksc;

            if (container) {
                /* number of items owned by shk */
                shksc = count_contents(obj, TRUE, TRUE, FALSE, TRUE);
                /* number of items owned by you (total - shksc) */
                yourc = count_contents(obj, TRUE, TRUE, TRUE, TRUE) - shksc;
                only_partially_your_contents = (shksc && yourc ? 1 : 0);
            }
            /*
               "<shk> offers * for ..." query formatting.
               Normal item(s):
                "... your <object>.  Sell it?"
                "... your <objects>.  Sell them?"
               A container is either owned by the hero, or already
               owned by the shk (!ltmp), or the shk isn't interested
               in buying it (also !ltmp).  It's either empty (!cltmp)
               or it has contents owned by the hero or it has some
               contents owned by the hero and others by the shk.
               (The case where it has contents already entirely owned
               by the shk is treated the same was if it were empty
               since the hero isn't selling any of those contents.)
               Your container and shk is willing to buy it:
                "... your <empty bag>.  Sell it?"
                "... your <bag> and its contents.  Sell them?"
                "... your <bag> and item inside.  Sell them?"
                "... your <bag> and items inside.  Sell them?"
               Your container but shk only cares about the contents:
                "... your item in your <bag>.  Sell it?"
                "... your items in your <bag>.  Sell them?"
               Shk's container:
                "... your item in the <bag>.  Sell it?"
                "... your items in the <bag>.  Sell them?"
              FIXME:
               "your items" should sometimes be "some of your items"
               (when container has some stuff the shk is willing to buy
               and other stuff he or she doesn't care about); likewise,
               "your item" should sometimes be "one of your items".
               That would make the prompting even more verbose so
               living without it might be a good thing.
              FIXME too:
               when container's contents are unknown, plural "items"
               should be used to not give away information.
             */
            sprintf(qbuf, _("%s offers%s %lld gold piece%s for %s%s "), Shknam(shkp), short_funds ? _(" only") : _(""), offer, plur(offer), (cltmp && !ltmp)
                        ? ((yourc == 1) ? _("your item in ") : _("your items in "))
                        : _(""), obj.unpaid ? _("the") : _("your"))

;
            one = !ltmp ? +(yourc == 1) : +(obj.quan == 1 && !cltmp);
            sprintf(qsfx, _("%s.  Sell %s?"), (cltmp && ltmp)
                        ? (only_partially_your_contents
                               ? ((yourc == 1) ? _(" and item inside")
                                                : _(" and items inside"))
                               : and_its_contents)
                        : _(""), one ? _("it") : _("them"))

;
            record_price_quote(obj.otyp, ulong(Math.trunc(offer / obj.quan)), FALSE);
            safe_qbuf(qbuf, qbuf, qsfx, obj, xname, simpleonames,
                             one ? _("that") : _("those"));
        } else
            chars[qbuf + 0] = ord('\0'); /* just to pacify lint */

        switch (gs.sell_response ? gs.sell_response : nyaq(qbuf)) {
        case ord('q'):
            gs.sell_response = ord('n');
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case ord('n'):
            if (container)
                dropped_container(obj, shkp, FALSE);
            if (!obj.unpaid)
                obj.no_charge = 1;
            subfrombill(obj, shkp);
            break;
        case ord('a'):
            gs.sell_response = ord('y');
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case ord('y'):
            if (container)
                dropped_container(obj, shkp, TRUE);
            if (!obj.unpaid && !saleitem)
                obj.no_charge = 1;
            subfrombill(obj, shkp);
            pay(-offer, shkp);
            shk_names_obj(shkp, obj,
                          (gs.sell_how != SELL_NORMAL)
                           ? ((!ltmp && cltmp && only_partially_your_contents)
                         ? _("sold some items inside %s for %lld gold piece%s.%s")
                         : _("sold %s for %lld gold piece%s.%s"))
            : _("relinquish %s and receive %lld gold piece%s in compensation.%s"),
                          offer, _(""));
            break;
        default:
            impossible(_("invalid sell response"));
        }
    }
    } finally { stack_pop($frame); }
}

export function doinvbill(
    mode) { /* int */ /* 0: deliver count 1: paged */
    var shkp;
    var eshkp;
    var bp, end_bp;
    var obj;
    var totused;
    var buf_p;
    var datawin;

    shkp = shop_keeper(chars[u.ushops]);
    if (!shkp || !inhishop(shkp)) {
        if (mode != 0)
            impossible(_("doinvbill: no shopkeeper?"));
        return 0;
    }
    eshkp = ESHK(shkp);

    if (mode == 0) {
        /* count expended items, so that the `I' command can decide
           whether to include 'x' in its prompt string */
        var cnt = !eshkp.debit ? 0 : 1;

        for (bp = eshkp.bill_p, end_bp = ptr_add(eshkp.bill_p, eshkp.billct);
             bp < end_bp; bp = ptr_add(bp, 1))
            if (bp.useup
                || ((obj = bp_to_obj(bp)) != null && obj.quan < bp.bquan))
                cnt++;
        return cnt;
    }

    datawin = create_nhwindow()(NHW_MENU);
    putstr()(datawin, 0, _("Unpaid articles already used up:"));
    putstr()(datawin, 0, _(""));

    totused = 0;
    quit: { for (bp = eshkp.bill_p, end_bp = ptr_add(eshkp.bill_p, eshkp.billct);
         bp < end_bp; bp = ptr_add(bp, 1)) {
        obj = bp_to_obj(bp);
        if (!obj) {
            impossible(_("Bad shopkeeper administration."));
            break quit;
        }
        if (bp.useup || bp.bquan > obj.quan) {
            var oquan, uquan, thisused;

            oquan = obj.quan;
            uquan = (bp.useup ? bp.bquan : bp.bquan - oquan);
            thisused = bp.price * uquan;
            totused += thisused;
            iflags.suppress_price++; /* suppress "(unpaid)" suffix */
            /* Why 'x'?  To match `I x', more or less. */
            buf_p = xprname(obj, 0, ord('x'), FALSE, thisused, uquan);
            iflags.suppress_price--;
            putstr()(datawin, 0, buf_p);
        }
    }
    if (eshkp.debit) {
        /* additional shop debt which has no itemization available */
        if (totused)
            putstr()(datawin, 0, _(""));
        totused += eshkp.debit;
        buf_p = xprname(null, _("usage charges and/or other fees"),
                        GOLD_SYM, FALSE, eshkp.debit, 0);
        putstr()(datawin, 0, buf_p);
    }
    buf_p = xprname(null, _("Total:"), ord('*'), FALSE, totused, 0);
    putstr()(datawin, 0, _(""));
    putstr()(datawin, 0, buf_p);
    display_nhwindow()(datawin, FALSE);
 }
    destroy_nhwindow()(datawin);
    return 0;
}

/* adjust tin, egg, or corpse price based on monster data */
function corpsenm_price_adj(obj) { /* long long */
    const $frame = stack_frame(); try {
    let val = 0;

    if ((obj.otyp == TIN || obj.otyp == EGG || obj.otyp == CORPSE)
        && ismnum(obj.corpsenm)) {
        let i;
        let tmp = 1;
        let ptr = mons[obj.corpsenm];
        const struct___anon1 = struct("corpsenm_price_adj.struct___anon1", {
            trinsic: int,
            cost: int,
        }); let icost = stack_array(struct___anon1, null, [
            { trinsic: FIRE_RES,   cost: 2 },
            { trinsic: SLEEP_RES,  cost: 3 },
            { trinsic: COLD_RES,   cost: 2 },
            { trinsic: DISINT_RES, cost: 5 },
            { trinsic: SHOCK_RES,  cost: 4 },
            { trinsic: POISON_RES, cost: 2 },
            { trinsic: ACID_RES,   cost: 1 },
            { trinsic: STONE_RES,  cost: 3 },
            { trinsic: TELEPORT,   cost: 2 },
            { trinsic: TELEPORT_CONTROL,  cost: 3 },
            { trinsic: TELEPAT,  cost: 5 }
        ]);

        for (i = 0; i < SIZE(icost); i++)
            if (intrinsic_possible(icost[i].trinsic, ptr))
                tmp += icost[i].cost;
        if (unique_corpstat(ptr))
            tmp += 50;

        val = max(1, ((ptr.mlevel - 1) * 2));
        if (obj.otyp == CORPSE)
            val += max(1, Math.trunc(ptr.cnutrit / 30));

        val = val * tmp;
    }

    return val;
    } finally { stack_pop($frame); }
}

function getprice(obj, shk_buying) { /* long long */
    let tmp = (objects[obj.otyp].oc_cost);

    if (obj.oartifact) {
        tmp = arti_cost(obj);
        if (shk_buying)
            tmp = Math.trunc(tmp / 4);
    }
    switch (obj.oclass) {
    case FOOD_CLASS:
        tmp += corpsenm_price_adj(obj);

        /* simpler hunger check, (2-4)*cost */
        if (u.uhs >= HUNGRY && !shk_buying)
            tmp *= u.uhs;
        if (obj.oeaten)
            tmp = 0;
        break;
    case WAND_CLASS:
        if (obj.spe == -1)
            tmp = 0;
        break;
    case POTION_CLASS:
        if (obj.otyp == POT_WATER && !obj.blessed && !obj.cursed)
            tmp = 0;
        break;
    case ARMOR_CLASS:
    case WEAPON_CLASS:
        if (obj.spe > 0)
            tmp += 10 * obj.spe;
        break;
    case TOOL_CLASS:
        if (Is_candle(obj)
            && obj.age < 20 * (objects[obj.otyp].oc_cost))
            tmp = Math.trunc(tmp / 2);
        break;
    }
    return tmp;
}

/* shk catches thrown pick-axe */
export function shkcatch(
    obj,
    x, y) { /* struct monst * */
    let shkp;

    shkp = shop_keeper(inside_shop(x, y));
    if (!shkp || !inhishop(shkp))
        return null;

    if (!helpless(shkp)
        && (chars[u.ushops] != ESHK(shkp).shoproom || !inside_shop(u.ux, u.uy))
        && dist2(shkp.mx, shkp.my, x, y) < 3
        /* if it is the shk's pos, you hit and anger him */
        && (shkp.mx != x || shkp.my != y)) {
        if (mnearto(shkp, x, y, TRUE, RLOC_NOMSG) == 2
            && !Deaf() && !muteshk(shkp)) {
               ;
            verbalize(_("Out of my way, scum!"));
        }
        if (cansee(x, y)) {
            pline(_("%s nimbly%s catches %s."), Shknam(shkp),
                  (x == shkp.mx && y == shkp.my) ? _("") : _(" reaches over and"),
                  the(xname(obj)));
            if (!canspotmon(shkp))
                map_invisible(x, y);
            nh_delay_output()();
            mark_synch()();
        }
        subfrombill(obj, shkp);
        mpickobj(shkp, obj);
        return shkp;
    }
    return null;
}

export function add_damage(
    x,
    y,
    cost) { /* void */
    let tmp_dam;
    let shops;

    if (IS_DOOR(levl()[x][y].typ)) {
        let mtmp;

        /* Don't schedule for repair unless it's a real shop entrance */
        for (shops = in_rooms(x, y, SHOPBASE); chars[shops]; shops++)
            if ((mtmp = shop_keeper(chars[shops])) != null
                && x == ESHK(mtmp).shd.x && y == ESHK(mtmp).shd.y)
                break;
        if (!chars[shops])
            return;
    }
    for (tmp_dam = svl.level.damagelist; tmp_dam; tmp_dam = tmp_dam.next)
        if (tmp_dam.place.x == x && tmp_dam.place.y == y) {
            tmp_dam.cost += cost;
            tmp_dam.when = svm.moves; /* needed by pay_for_damage() */
            return;
        }
    tmp_dam = view_of(struct_damage, addr_of(alloc(sizeof(struct_damage))));
    memset(addr_of(tmp_dam), 0, sizeof(struct_damage));
    tmp_dam.when = svm.moves;
    tmp_dam.place.x = x;
    tmp_dam.place.y = y;
    tmp_dam.cost = cost;
    tmp_dam.typ = levl()[x][y].typ;
    tmp_dam.flags = levl()[x][y].flags;
    tmp_dam.next = svl.level.damagelist;
    svl.level.damagelist = tmp_dam;
    /* If player saw damage, display walls post-repair as walls, not stone */
    if (cansee(x, y))
        levl()[x][y].seenv = SVALL;
}

/* is shopkeeper impaired, so they cannot act? */
function shk_impaired(shkp) { /* boolean */
    if (!shkp || !shkp.isshk || !inhishop(shkp))
        return TRUE;
    if (helpless(shkp) || ESHK(shkp).following)
        return TRUE;
    return FALSE;
}

/* is damage dam repairable by shopkeeper shkp? */
function repairable_damage(dam, shkp) { /* boolean */
    let x, y;
    let ttmp;
    let mtmp;

    if (!dam || shk_impaired(shkp))
        return FALSE;

    x = dam.place.x;
    y = dam.place.y;

    /* too soon to fix it? */
    if ((svm.moves - dam.when) < REPAIR_DELAY)
        return FALSE;
    /* is it a wall? don't fix if anyone is in the way */
    if (!IS_ROOM(dam.typ)) {
        if ((u_at(x, y) && !Passes_walls())
            || (x == shkp.mx && y == shkp.my)
            || ((mtmp = m_at(x, y)) != null && !passes_walls(mtmp.data)))
            return FALSE;
    }
    /* is it a trap? don't fix if hero or monster is in it */
    ttmp = t_at(x, y);
    if (ttmp) {
        if (u_at(x, y))
            return FALSE;
        if ((mtmp = m_at(x,y)) != null && mtmp.mtrapped)
            return FALSE;
    }
    /* does it belong to shkp? */
    if (!strchr(in_rooms(x, y, SHOPBASE), ESHK(shkp).shoproom))
        return FALSE;

    return TRUE;
}

/* find any damage shopkeeper shkp could repair. returns NULL is none found */
function find_damage(shkp) { /* struct damage * */
    let dam = svl.level.damagelist;

    if (shk_impaired(shkp))
        return null;

    while (dam) {
        if (repairable_damage(dam, shkp))
            return dam;

        dam = dam.next;
    }

    return null;
}

function discard_damage_struct(dam) { /* void */
    if (!dam)
        return;

    if (dam == svl.level.damagelist) {
        svl.level.damagelist = dam.next;
    } else {
        let prev = svl.level.damagelist;

        while (prev && prev.next != dam)
            prev = prev.next;
        if (prev)
            prev.next = dam.next;
    }
    memset(addr_of(dam), 0, sizeof(struct_damage));
    free(addr_of(dam));
}

/* discard all damage structs owned by shopkeeper */
function discard_damage_owned_by(shkp) { /* void */
    let dam = svl.level.damagelist, dam2, prevdam = null;

    while (dam) {
        let x = dam.place.x, y = dam.place.y;

        if (strchr(in_rooms(x, y, SHOPBASE), ESHK(shkp).shoproom)) {
            dam2 = dam.next;
            if (prevdam)
                prevdam.next = dam2;
            if (dam == svl.level.damagelist)
                svl.level.damagelist = dam2;
            memset(addr_of(dam), 0, sizeof(struct_damage));
            free(addr_of(dam)), dam = null;
        } else {
            prevdam = dam;
            dam2 = dam.next;
        }

        dam = dam2;
    }
}

/* Shopkeeper tries to repair damage belonging to them */
function shk_fixes_damage(shkp) { /* void */
    let dam = find_damage(shkp);
    let shk_closeby;

    if (!dam)
        return;

    shk_closeby = +(mdistu(shkp) <= Math.trunc(BOLT_LIM / 2) * Math.trunc(BOLT_LIM / 2));

    if (canseemon(shkp)) {
        pline(_("%s whispers %s."), Shknam(shkp),
              shk_closeby ? _("an incantation") : _("something"));
    } else if (!Deaf() && shk_closeby) {
         ;
        You_hear(_("someone muttering an incantation."));
    }

    repair_damage(shkp, dam, FALSE);

    discard_damage_struct(dam);
}

export const LITTER_UPDATE = 0x01;
export const LITTER_OPEN = 0x02;
export const LITTER_INSHOP = 0x04;
export function horiz(i) { return ((i % 3) - 1); }
export function vert(i) { return (Math.trunc(i / 3) - 1); }

/* find eligible spots to move items from a gap in a shop's wall that is
   being repaired; this guarantees that items will end up inside shkp's
   shop (possibly in the "free spot" or even in doorway or an adjacent
   wall gap), but if they are in a gap in a wall shared by two shops
   they might have started in the other shop */
function litter_getpos(
    litter,
    x, y,
    shkp) { /* uint8 */
    let i, ix, iy;
    let k = 0; /* number of adjacent shop spots */

    memset(litter, 0, 9 * sizeof(uchar));

    if (svl.level.objects[x][y] && !IS_ROOM(levl()[x][y].typ)) {
        for (i = 0; i < 9; i++) {
            ix = x + horiz(i);
            iy = y + vert(i);
            if (i == 4 || !isok(ix, iy) || !ZAP_POS(levl()[ix][iy].typ))
                continue;
            uchars[litter + i] = LITTER_OPEN;
            if (inside_shop(ix, iy) == ESHK(shkp).shoproom) {
                uchars[litter + i] |= LITTER_INSHOP;
                ++k;
            }
        }
    }
    return k;
}

/* move items from a gap in a shop's wall that is being repaired;
   litter[] guarantees that items will end up inside shkp's shop, but
   if the wall being repaired is shared by two shops the items might
   have started in the other shop */
function litter_scatter(
    litter,
    x, y,
    shkp) { /* void */
    let otmp;

    /* placement below assumes there is always at least one adjacent spot
       that's inside the shop; caller guarantees that */
    {
        /* Scatter objects haphazardly into the shop */
        if (Punished() && !u.uswallow
            && ((uchain.ox == x && uchain.oy == y)
                || (uball.where == OBJ_FLOOR
                    && uball.ox == x && uball.oy == y))) {
            /*
             * Either the ball or chain is in the repair location.
             * Take the easy way out and put ball&chain under hero.
             *
             * FIXME: message should be reworded; this might be the
             * shop's doorway rather than a wall, there might be some
             * other stuff here which isn't junk, and "your junk" has
             * a slang connotation which could be applicable if hero
             * has Passes_walls ability.
             */
            if (!Deaf() && !muteshk(shkp)) {
                   ;
                verbalize(_("Get your junk out of my wall!"));
            }
            unplacebc(); /* pick 'em up */
            placebc();   /* put 'em down */
        }
        while ((otmp = svl.level.objects[x][y]) != null) {
            /* Don't mess w/ boulders -- just merge into wall */
            if (otmp.otyp == BOULDER || otmp.otyp == ROCK) {
                obj_extract_self(otmp);
                obfree(otmp, null);
            } else {
                let trylimit = 10;
                let i = rn2(9), ix, iy;

                /* otmp must be moved otherwise svl.level.objects[x][y] will
                   never become Null and while-loop won't terminate */
                do {
                    i = (i + 1) % 9;
                } while (--trylimit && !(uchars[litter + i] & LITTER_INSHOP));
                if ((uchars[litter + i] & (LITTER_OPEN | LITTER_INSHOP)) != 0) {
                    ix = x + horiz(i);
                    iy = y + vert(i);
                } else {
                    /* we know shk isn't at <x,y> because repair
                       is deferred in that situation */
                    ix = shkp.mx;
                    iy = shkp.my;
                }
                /* if the wall being repaired is shared by two adjacent
                   shops, <ix,iy> might be in a different shop than the
                   one that is billing for otmp or decided it was free;
                   control of the item goes to the shk repairing the wall
                   but otmp->no_charge isn't recalculated for new shop */
                if (otmp.unpaid) {
                    let oshk = shkp;

                    /* !costly_spot() happens if otmp is moved from wall
                       to shop's "free spot", still costly_adjacent() and
                       still unpaid/on-bill; otherwise, it is being moved
                       all the way into the shop so take it off the bill */
                    if (costly_spot(ix, iy)
                        && (onbill(otmp, oshk, TRUE)
                             || ((oshk = find_objowner(otmp, ix, iy)) != null
                                 && onbill(otmp, oshk, FALSE))))
                        subfrombill(otmp, oshk);
                }
                if (otmp.no_charge) {
                    /* not strictly necessary; destination is inside a
                       shop so existing no_charge remains relevant */
                    if (!costly_spot(ix, iy)
                        && !costly_adjacent(shkp, ix, iy))
                        otmp.no_charge = 0;
                }

                remove_object(otmp);
                place_object(otmp, ix, iy);
                uchars[litter + i] |= LITTER_UPDATE;
            }
        } /* while level.objects[x][y] != 0 */
    }
}

function litter_newsyms(litter, x, y) { /* void */
    let i;

    for (i = 0; i < 9; i++)
        if (uchars[litter + i] & LITTER_UPDATE)
            newsym(x + horiz(i), y + vert(i));
}

/*
 * 0: repair postponed, 1: silent repair (no messages), 2: normal repair
 * 3: untrap
 */
function repair_damage(
    shkp,
    tmp_dam,
    catchup) { /* int */
    const $frame = stack_frame(); try {
    let x, y;
    let litter = stack_array(uchar, 9);
    let otmp;
    let ttmp;
    let disposition = 1;
    let seeit, stop_picking = FALSE;

    if (!repairable_damage(tmp_dam, shkp))
        return 0;

    x = tmp_dam.place.x;
    y = tmp_dam.place.y;
    seeit = cansee(x, y);

    ttmp = t_at(x, y);
    if (ttmp) {
        switch (ttmp.ttyp) {
        case LANDMINE:
        case BEAR_TRAP:
            /* convert to an object */
            otmp = mksobj((ttmp.ttyp == LANDMINE) ? LAND_MINE : BEARTRAP,
                          TRUE, FALSE);
            otmp.quan = 1;
            otmp.owt = unsigned(weight(otmp));
            if (!catchup) {
                if (canseemon(shkp) && dist2(x, y, shkp.mx, shkp.my) <= 2)
                    pline(_("%s untraps %s."), Shknam(shkp), ansimpleoname(otmp));
                else if (ttmp.tseen && cansee(ttmp.tx, ttmp.ty))
                    pline(_("The %s vanishes."), trapname(ttmp.ttyp, TRUE));
            }
            mpickobj(shkp, otmp);
            break;
        case HOLE:
        case PIT:
        case SPIKED_PIT:
            if (!catchup && ttmp.tseen && cansee(ttmp.tx, ttmp.ty))
                pline(_("The %s is filled in."), trapname(ttmp.ttyp, TRUE));
            break;
        default:
            if (!catchup && ttmp.tseen && cansee(ttmp.tx, ttmp.ty))
                pline(_("The %s vanishes."), trapname(ttmp.ttyp, TRUE));
            break;
        }
        deltrap(ttmp);
        del_engr_at(x, y);
        if (seeit)
            newsym(x, y);
        if (!catchup)
            disposition = 3;
    }
    if (IS_ROOM(tmp_dam.typ)
        || (tmp_dam.typ == levl()[x][y].typ
            && (!IS_DOOR(tmp_dam.typ) || levl()[x][y].flags > D_BROKEN)))
        /* no terrain fix necessary (trap removal or manually repaired) */
        return disposition;

    if (closed_door(x, y))
        stop_picking = picking_at(x, y);

    /* door or wall repair; trap, if any, is now gone;
       restore original terrain type and move any items away;
       rm.doormask and rm.wall_info are both overlaid on rm.flags
       so the new flags value needs to match the restored typ */
    levl()[x][y].typ = tmp_dam.typ;
    if (IS_DOOR(tmp_dam.typ))
        levl()[x][y].flags = D_CLOSED; /* arbitrary */
    else /* not a door; set rm.wall_info or whatever old flags are relevant */
        levl()[x][y].flags = tmp_dam.flags;

    if (litter_getpos(litter, x, y, shkp))
        litter_scatter(litter, x, y, shkp);
    del_engr_at(x, y);

    /* needed if hero has line-of-sight to the former gap from outside
       the shop but is farther than one step away; once the light inside
       the shop is blocked, the other newsym() below won't redraw the
       spot showing its repaired wall */
    if (seeit)
        newsym(x, y);
    block_point(x, y);

    if (catchup)
        return 1; /* repair occurred while off level so no messages */

    if (seeit) {
        if (IS_WALL(tmp_dam.typ)) {
            /* player sees actual repair process, so KNOWS it's a wall */
            levl()[x][y].seenv = SVALL;
            pline(_("Suddenly, a section of the wall closes up!"));
        } else if (IS_DOOR(tmp_dam.typ)) {
            pline(_("Suddenly, the shop door reappears!"));
        }
        newsym(x, y);
    } else if (IS_WALL(tmp_dam.typ)) {
        if (inside_shop(u.ux, u.uy) == ESHK(shkp).shoproom)
            You_feel(_("more claustrophobic than before."));
        else if (!Deaf() && !rn2(10))
            Norep(_("The dungeon acoustics noticeably change."));
    }

    if (stop_picking)
        stop_occupation();

    litter_newsyms(litter, x, y);

    if (disposition < 3)
        disposition = 2;
    return disposition;
    } finally { stack_pop($frame); }
}

/* normally repair is done when a shopkeeper moves, but we also try to
   catch up for lost time when reloading a previously visited level */
export function fix_shop_damage() { /* void */
    let shkp;
    let damg, nextdamg;

    /* if this level has no shop damage, there's nothing to do */
    if (!svl.level.damagelist)
        return;

    /* go through all shopkeepers on the level */
    for (shkp = next_shkp(fmon(), FALSE); shkp;
         shkp = next_shkp(shkp.nmon, FALSE)) {
        /* if this shopkeeper isn't in his shop or can't move, skip */
        if (shk_impaired(shkp))
            continue;
        /* go through all damage data trying to have this shopkeeper
           fix it; repair_damage() will only make repairs for damage
           matching shop controlled by specified shopkeeper */
        for (damg = svl.level.damagelist; damg; damg = nextdamg) {
            nextdamg = damg.next;
            if (repair_damage(shkp, damg, TRUE))
                discard_damage_struct(damg);
        }
    }
}

/*
 * shk_move: return 1: moved  0: didn't  -1: let m_move do it  -2: died
 */
export function shk_move(shkp) { /* int */
    let gtx, gty, omx, omy;
    let udist;
    let appr;
    let eshkp = ESHK(shkp);
    let z;
    let uondoor = FALSE, satdoor, avoid = FALSE, badinv;

    omx = shkp.mx;
    omy = shkp.my;

    if (inhishop(shkp))
        shk_fixes_damage(shkp);

    if ((udist = distu(omx, omy)) < 3 && (shkp.data != mons[PM_GRID_BUG]
                                          || (omx == u.ux || omy == u.uy))) {
        if (ANGRY(shkp) || (Conflict() && !resist_conflict(shkp))) {
            if (Displaced())
                Your(_("displaced image doesn't fool %s!"), shkname(shkp));
            mattacku(shkp);
            return 0;
        }
        if (eshkp.following) {
            if (strncmp(eshkp.customer, svp.plname, PL_NSIZ)) {
                if (!Deaf() && !muteshk(shkp)) {
                       ;
                    verbalize(_("%s, %s!  I was looking for %s."), Hello(shkp),
                              svp.plname, eshkp.customer);
                }
                eshkp.following = 0;
                return 0;
            }
            if (svm.moves > gf.followmsg + 4) {
                if (!Deaf() && !muteshk(shkp)) {
                       ;
                    verbalize(_("%s, %s!  Didn't you forget to pay?"),
                              Hello(shkp), svp.plname);
                } else {
                    pline(_("%s holds out %s upturned %s."),
                          Shknam(shkp), noit_mhis(shkp),
                          mbodypart(shkp, HAND));
                }
                gf.followmsg = svm.moves;
                if (!rn2(9)) {
                    pline(_("%s doesn't like customers who don't pay."),
                          Shknam(shkp));
                    rile_shk(shkp);
                }
            }
            if (udist < 2)
                return 0;
        }
    }

    appr = 1;
    gtx = eshkp.shk.x;
    gty = eshkp.shk.y;
    satdoor = +(gtx == omx && gty == omy);
    if (eshkp.following || ((z = holetime()) >= 0 && z * z <= udist)) {
        /* [This distance check used to apply regardless of
            whether the shk was following, but that resulted in
            m_move() sometimes taking the shk out of the shop if
            the player had fenced him in with boulders or traps.
            Such voluntary abandonment left unpaid objects in
            invent, triggering billing impossibilities on the
            next level once the character fell through the hole.] */
        if (udist > 4 && eshkp.following && !eshkp.billct)
            return -1; /* leave it to m_move */
        gtx = u.ux;
        gty = u.uy;
    } else if (ANGRY(shkp)) {
        /* Move towards the hero if the shopkeeper can see him. */
        if (shkp.mcansee && m_canseeu(shkp)) {
            gtx = u.ux;
            gty = u.uy;
        }
        avoid = FALSE;
    } else {
        if (Invis() || u.usteed) {
            avoid = FALSE;
        } else {
            uondoor = +(((eshkp.shd.x) == u.ux) && ((eshkp.shd.y) == u.uy));
            if (uondoor) {
                badinv = (carrying(PICK_AXE) || carrying(DWARVISH_MATTOCK)
                          || (Fast() && (sobj_at(PICK_AXE, u.ux, u.uy)
                                  || sobj_at(DWARVISH_MATTOCK, u.ux, u.uy))) ? 1 : 0);
                if (satdoor && badinv)
                    return 0;
                avoid = +!badinv;
            } else {
                avoid = (chars[u.ushops] && distu(gtx, gty) > 8 ? 1 : 0);
                badinv = FALSE;
            }

            if (((!eshkp.robbed && !eshkp.billct && !eshkp.debit) || avoid)
                && dist2(omx, omy, gtx, gty) < 3) {
                if (!badinv && !onlineu(omx, omy))
                    return 0;
                if (satdoor)
                    appr = gtx = gty = 0;
            }
        }
    }

    z = move_special(shkp, inhishop(shkp), appr, uondoor, avoid, omx, omy,
                     gtx, gty);
    if (z > 0)
        after_shk_move(shkp);

    return z;
}

/* called after shopkeeper moves, in case move causes re-entry into shop */
export function after_shk_move(shkp) { /* void */
    let eshkp = ESHK(shkp);

    if (eshkp.bill_p == view_of(struct_bill_x, unsigned(-1000)) && inhishop(shkp)) {
        /* reset bill_p, need to re-calc player's occupancy too */
        eshkp.bill_p = eshkp.bill[0];
        /* only re-check occupancy if game hasn't just ended */
        if (!program_state.gameover)
            check_special_room(FALSE);
    }
}

/* for use in levl_follower (mondata.c) */
export function is_fshk(mtmp) { /* boolean */
    return (mtmp.isshk && ESHK(mtmp).following ? 1 : 0);
}

/* You are digging in the shop. */
export function shopdig(fall) { /* void */
    let shkp = shop_keeper(chars[u.ushops]);
    let lang;
    let grabs = _("grabs");

    if (!shkp)
        return;
    if (!inhishop(shkp)) {
        if (Role_if(PM_KNIGHT)) {
            You_feel(_("like a common thief."));
            adjalign(-sgn(u.ualign.type));
        }
        return;
    }
    /* 0 == can't speak, 1 == makes animal noises, 2 == speaks */
    lang = 0;
    if (helpless(shkp) || is_silent(shkp.data))
        ; /* lang stays 0 */
    else if (shkp.data.msound <= MS_ANIMAL)
        lang = 1;
    else if (shkp.data.msound >= MS_HUMANOID)
        lang = 2;

    if (!fall) {
        if (lang == 2) {
            if (!Deaf() && !muteshk(shkp)) {
                   ;
                if (u.utraptype == TT_PIT) {
                    verbalize(
                       _("Be careful, %s, or you might fall through the floor."),
                              flags.female ? _("madam") : _("sir"));
                } else {
                    verbalize(_("%s, do not damage the floor here!"),
                              flags.female ? _("Madam") : _("Sir"));
                }
            }
        }
        if (Role_if(PM_KNIGHT)) {
            You_feel(_("like a common thief."));
            adjalign(-sgn(u.ualign.type));
        }
    } else if (!um_dist(shkp.mx, shkp.my, 5)
               && !helpless(shkp)
               && (ESHK(shkp).billct || ESHK(shkp).debit)) {
        let obj, obj2;

        if (nolimbs(shkp.data)) {
            grabs = _("knocks off");
        /* #if 0: not in this build */
        }
        if (!m_next2u(shkp)) {
            mnexto(shkp, RLOC_MSG);
            /* for some reason the shopkeeper can't come next to you */
            if (!m_next2u(shkp)) {
                if (lang == 2)
                    pline(_("%s curses you in anger and frustration!"),
                          Shknam(shkp));
                else if (lang == 1)
                    growl(shkp);
                rile_shk(shkp);
                return;
            } else
                pline(_("%s %s, and %s your backpack!"), Shknam(shkp),
                      makeplural(locomotion(shkp.data, _("leap"))), grabs);
        } else
            pline(_("%s %s your backpack!"), Shknam(shkp), grabs);

        for (obj = gi.invent; obj; obj = obj2) {
            obj2 = obj.nobj;
            if ((obj.owornmask & ~(W_SWAPWEP | W_QUIVER)) != 0
                || (obj == uswapwep && u.twoweap)
                || (obj.otyp == LEASH && obj.corpsenm))
                continue;
            if (obj == gc.current_wand)
                continue;
            setnotworn(obj);
            freeinv(obj);
            subfrombill(obj, shkp);
            add_to_minv(shkp, obj); /* may free obj */
        }
    }
}

function makekops(mm) { /* void */
    const $frame = stack_frame(); try {
    let k_mndx = static_array("makekops.k_mndx", short, 4, [ PM_KEYSTONE_KOP, PM_KOP_SERGEANT,
                                     PM_KOP_LIEUTENANT, PM_KOP_KAPTAIN ]);
    let k_cnt = stack_array(int, 4), cnt, mndx, k;

    k_cnt[0] = int(cnt = abs(depth(u.uz)) + rnd(5));
    k_cnt[1] = Math.trunc(cnt / 3) + 1; /* at least one sarge */
    k_cnt[2] = Math.trunc(cnt / 6);     /* maybe a lieutenant */
    k_cnt[3] = Math.trunc(cnt / 9);     /* and maybe a kaptain */

    for (k = 0; k < 4; k++) {
        if ((cnt = k_cnt[k]) == 0)
            break;
        mndx = k_mndx[k];
        if (svm.mvitals[mndx].mvflags & G_GONE)
            continue;

        while (cnt--)
            if (enexto(mm, mm.x, mm.y, mons[mndx]))
                makemon(mons[mndx], mm.x, mm.y, MM_NOMSG);
    }
    } finally { stack_pop($frame); }
}

function getcad(
    shkp, dmgstr, x, y,
    uinshp, animal, pursue) { /* void */
    let dugwall = +(!strcmp(dmgstr, _("dig into"))    /* wand */
                    || !strcmp(dmgstr, _("damage"))); /* pick-axe */

    if (muteshk(shkp)) {
        if (animal && !helpless(shkp))
            yelp(shkp);
    } else if (pursue || uinshp || !um_dist(x, y, 1)) {
        if (!Deaf()) {
               ;
            verbalize(_("How dare you %s my %s?"), dmgstr,
                        dugwall ? _("shop") : _("door"));
        } else {
            pline(_("%s is %s that you decided to %s %s %s!"),
                    Shknam(shkp), ROLL_FROM(angrytexts),
                    dmgstr, noit_mhis(shkp), dugwall ? _("shop") : _("door"));
        }
    } else {
        if (!Deaf()) {
            pline(_("%s shouts:"), Shknam(shkp));
               ;
            verbalize(_("Who dared %s my %s?"), dmgstr,
                        dugwall ? _("shop") : _("door"));
        } else {
            pline(_("%s is %s that someone decided to %s %s %s!"),
                    Shknam(shkp), ROLL_FROM(angrytexts),
                    dmgstr, noit_mhis(shkp), dugwall ? _("shop") : _("door"));
        }
    }
    hot_pursuit(shkp);
}

export function pay_for_damage(dmgstr, cant_mollify) { /* void */
    const $frame = stack_frame(); try {
    let shkp = null;
    let shops_affected = stack_array(char, 5);
    let uinshp = +(chars[u.ushops] != ord('\0'));
    let qbuf = stack_array(char, 80);
    let x, y;
    let animal, pursue;
    let tmp_dam, appear_here = null;
    let cost_of_damage = 0;
    let nearest_shk = (ROWNO * ROWNO) + (COLNO * COLNO),
                 nearest_damage = nearest_shk;
    let picks = 0;

    for (tmp_dam = svl.level.damagelist; tmp_dam; tmp_dam = tmp_dam.next) {
        let shp;

        if (tmp_dam.when != svm.moves || !tmp_dam.cost)
            continue;
        cost_of_damage += tmp_dam.cost;
        strcpy(shops_affected, in_rooms(tmp_dam.place.x, tmp_dam.place.y, SHOPBASE))
;
        for (shp = shops_affected; chars[shp]; shp++) {
            let tmp_shk;
            let shk_distance;

            if (!(tmp_shk = shop_keeper(chars[shp])))
                continue;
            if (tmp_shk == shkp) {
                let damage_distance = unsigned(distu(tmp_dam.place.x, tmp_dam.place.y));

                if (damage_distance < nearest_damage) {
                    nearest_damage = damage_distance;
                    appear_here = tmp_dam;
                }
                continue;
            }
            if (!inhishop(tmp_shk))
                continue;
            shk_distance = unsigned(mdistu(tmp_shk));
            if (shk_distance > nearest_shk)
                continue;
            if ((shk_distance == nearest_shk) && picks) {
                if (rn2(++picks))
                    continue;
            } else
                picks = 1;
            shkp = tmp_shk;
            nearest_shk = shk_distance;
            appear_here = tmp_dam;
            nearest_damage = unsigned(distu(tmp_dam.place.x, tmp_dam.place.y));
        }
    }

    if (!cost_of_damage || !shkp)
        return;

    animal = +(shkp.data.msound <= MS_ANIMAL);
    pursue = FALSE;
    x = appear_here.place.x;
    y = appear_here.place.y;

    /* not the best introduction to the shk... */
    strncpy(ESHK(shkp).customer, svp.plname, PL_NSIZ);

    /* if the shk is already on the war path, be sure it's all out */
    if (ANGRY(shkp) || ESHK(shkp).following) {
        hot_pursuit(shkp);
        return;
    }

    /* if the shk is not in their shop.. */
    if (!chars[in_rooms(shkp.mx, shkp.my, SHOPBASE)]) {
        if (!cansee(shkp.mx, shkp.my))
            return;
        pursue = TRUE;
        getcad(shkp, dmgstr, x, y, uinshp, animal, pursue);
        return;
    }

    if (uinshp) {
        if (um_dist(shkp.mx, shkp.my, 1)
            && !um_dist(shkp.mx, shkp.my, 3)) {
            pline(_("%s leaps towards you!"), Shknam(shkp));
            mnexto(shkp, RLOC_NOMSG);
        }
        pursue = um_dist(shkp.mx, shkp.my, 1);
        if (pursue) {
            getcad(shkp, dmgstr, x, y, uinshp, animal, pursue);
            return;
        }
    } else {
        /*
         * Make shkp show up at the door.  Effect:  If there is a monster
         * in the doorway, have the hero hear the shopkeeper yell a bit,
         * pause, then have the shopkeeper appear at the door, having
         * yanked the hapless critter out of the way.
         */
        if (MON_AT(x, y)) {
            if (!animal) {
                if (!Deaf() && !muteshk(shkp)) {
                    /* Soundeffect(se_angry_voice, 75); */
                    You_hear(_("an angry voice:"));
                       ;
                    verbalize(_("Out of my way, scum!"));
                }
                wait_synch()();

                sleep(1)

;
            } else {
                growl(shkp);
            }
        }
        mnearto(shkp, x, y, TRUE, RLOC_MSG);
    }

    if ((um_dist(x, y, 1) && !uinshp) || cant_mollify
        || (money_cnt(gi.invent) + ESHK(shkp).credit) < cost_of_damage
        || !rn2(50)) {
        getcad(shkp, dmgstr, x, y, uinshp, animal, pursue);
        return;
    }

    if (Invis())
        Your(_("invisibility does not fool %s!"), shkname(shkp));
    sprintf(qbuf, _("%sYou did %lld %s worth of damage!%s  Pay?"), !animal ? cad(TRUE) : _(""), cost_of_damage, currency(cost_of_damage), !animal ? _("\"") : _(""))

;
    if (y_n(qbuf) != ord('n')) {
        let is_seen, was_seen = canseemon(shkp),
                was_outside = +!inhishop(shkp);
        let sx = shkp.mx, sy = shkp.my;

        cost_of_damage = check_credit(cost_of_damage, shkp);
        if (cost_of_damage > 0) {
            money2mon(shkp, cost_of_damage);
            disp.botl = TRUE;
        }
        pline(_("Mollified, %s accepts your restitution."), shkname(shkp));
        /* move shk back to his home loc */
        home_shk(shkp, FALSE);
        pacify_shk(shkp, FALSE);
        /* home_shk() suppresses rloc()'s vanish/appear messages */
        if (shkp.mx != sx || shkp.my != sy) {
            if (was_outside && canspotmon(shkp))
                pline(_("%s returns to %s shop."), Shknam(shkp),
                      noit_mhis(shkp));
            else if ((is_seen = canseemon(shkp)) == TRUE || was_seen)
                pline(_("%s %s."), Shknam(shkp), !was_seen ? _("appears")
                                              : is_seen ? _("shifts location")
                                                : _("disappears"));
        }
    } else {
        if (!animal) {
            if (!Deaf() && !muteshk(shkp)) {
                   ;
                verbalize(_("Oh, yes!  You'll pay!"));
            } else {
                pline(_("%s lunges %s %s toward your %s!"),
                      Shknam(shkp), noit_mhis(shkp),
                      mbodypart(shkp, HAND), body_part(NECK));
            }
        } else
            growl(shkp);
        hot_pursuit(shkp);
        adjalign(-sgn(u.ualign.type));
    }
    } finally { stack_pop($frame); }
}

/* called in dokick.c when we kick an object that might be in a store */
export function costly_spot(x, y) { /* boolean */
    let shkp;
    let eshkp;

    if (!svl.level.flags.has_shop)
        return FALSE;
    shkp = shop_keeper(chars[in_rooms(x, y, SHOPBASE)]);
    if (!shkp || !inhishop(shkp))
        return FALSE;
    eshkp = ESHK(shkp);
    return  (inside_shop(x, y)
                       && !(x == eshkp.shk.x && y == eshkp.shk.y) ? 1 : 0);
}

/* called by sanity checking when an unpaid or no_charge item is not at a
   costly_spot; it might still be within the boundary of the shop; if so,
   those flags are still valid */
export function costly_adjacent(
    shkp,
    x, y) { /* boolean */
    let eshkp;

    if (!shkp || !inhishop(shkp) || !isok(x, y))
        return FALSE;
    eshkp = ESHK(shkp);
    /* adjacent if <x,y> is a shop wall spot, including door;
       also treat "free spot" one step inside the door as adjacent */
    return (levl()[x][y].edge || (x == eshkp.shk.x && y == eshkp.shk.y) ? 1 : 0);
}

/* called by dotalk(sounds.c) when #chatting; returns obj if location
   contains shop goods and shopkeeper is willing & able to speak */
export function shop_object(x, y) { /* struct obj * */
    let otmp;
    let shkp;

    shkp = shop_keeper(chars[in_rooms(x, y, SHOPBASE)]);
    if (!shkp || !inhishop(shkp))
        return null;

    for (otmp = svl.level.objects[x][y]; otmp; otmp = otmp.v.v_nexthere)
        if (otmp.oclass != COIN_CLASS)
            break;
    /* note: otmp might have ->no_charge set, but that's ok */
    return (otmp && costly_spot(x, y) && NOTANGRY(shkp) && !muteshk(shkp))
               ? otmp
               : null;
}

/* give price quotes for all objects linked to this one (ie, on this spot) */
export function price_quote(first_obj) { /* void */
    const $frame = stack_frame(); try {
    let otmp;
    let buf = stack_array(char, BUFSZ), price = stack_array(char, 40);
    let cost = 0;
    let cnt = 0;
    let contentsonly = FALSE;
    let tmpwin;
    let shkp;

    shkp = shop_keeper(inside_shop(u.ux, u.uy));
    /* caller has verified that there is a shopkeeper, but the static
       analyzer doesn't realize it */
    if (!shkp || !inhishop(shkp))
        return;

    tmpwin = create_nhwindow()(NHW_MENU);
    putstr()(tmpwin, 0, _("Fine goods for sale:"));
    putstr()(tmpwin, 0, _(""));
    for (otmp = first_obj; otmp; otmp = otmp.v.v_nexthere) {
        if (otmp.oclass == COIN_CLASS)
            continue;
        cost = (otmp.no_charge || otmp == uball || otmp == uchain) ? 0
                 : get_cost(otmp, shkp);
        contentsonly = +!cost;
        if (Has_contents(otmp))
            cost += contained_cost(otmp, shkp, 0, FALSE, FALSE);
        if (otmp.globby)
            cost *= get_pricing_units(otmp);  /* always quan 1, vary by wt */
        if (!cost) {
            strcpy(price, _("no charge"));
            contentsonly = FALSE;
        } else {
            sprintf(price, _("%lld %s%s"), cost, currency(cost), otmp.quan > 1 ? _(" each") : _(""))
;
        }
        sprintf(buf, _("%s%s, %s"), contentsonly ? the_contents_of : _(""), doname(otmp), price)
;
        putstr()(tmpwin, 0, buf), cnt++;
    }
    if (cnt > 1) {
        display_nhwindow()(tmpwin, TRUE);
    } else if (cnt == 1) {
        if (!cost) {
            /* "<doname(obj)>, no charge" */
               ;
            verbalize(_("%s!"), upstart(buf)); /* buf contains the string */
        } else {
            /* print cost in slightly different format, so can't reuse buf;
               cost and contentsonly are already set up */
            sprintf(buf, _("%s%s"), contentsonly ? the_contents_of : _(""), doname(first_obj))
;
               ;
            verbalize(_("%s, price %lld %s%s%s"), upstart(buf), cost,
                      currency(cost), (first_obj.quan > 1) ? _(" each") : _(""),
                      contentsonly ? _(".") : shk_embellish(first_obj, cost));
        }
    }
    destroy_nhwindow()(tmpwin);
    } finally { stack_pop($frame); }
}

function shk_embellish(itm, cost) { /* const char * */
    if (!rn2(3)) {
        let o, choice = rn2(5);

        if (choice == 0)
            choice = (cost < 100 ? 1 : cost < 500 ? 2 : 3);
        switch (choice) {
        case 4:
            if (cost < 10)
                break;
            else
                o = itm.oclass;
            if (o == FOOD_CLASS)
                return _(", gourmets' delight!");
            if (objects[itm.otyp].oc_name_known
                    ? objects[itm.otyp].oc_magic
                    : (o == AMULET_CLASS || o == RING_CLASS || o == WAND_CLASS
                       || o == POTION_CLASS || o == SCROLL_CLASS
                       || o == SPBOOK_CLASS))
                return _(", painstakingly developed!");
            return _(", superb craftsmanship!");
        case 3:
            return _(", finest quality.");
        case 2:
            return _(", an excellent choice.");
        case 1:
            return _(", a real bargain.");
        default:
            break;
        }
    } else if (itm.oartifact) {
        return _(", one of a kind!");
    }
    return _(".");
}

/* First 4 supplied by Ronen and Tamar, remainder by development team */
const Izchak_speaks = static_array("Izchak_speaks", ptr_to(char), null, [
    _("%s says: 'These shopping malls give me a headache.'"),
    _("%s says: 'Slow down.  Think clearly.'"),
    _("%s says: 'You need to take things one at a time.'"),
    _("%s says: 'I don't like poofy coffee... give me Colombian Supremo.'"),
    _("%s says that getting the devteam's agreement on anything is difficult."),
    _("%s says that he has noticed those who serve their deity will prosper."),
    _("%s says: 'Don't try to steal from me - I have friends in high places!'"),
    _("%s says: 'You may well need something from this shop in the future.'"),
    _("%s comments about the Valley of the Dead as being a gateway.")
]);

export function shk_chat(shkp) { /* void */
    let eshk;
    let shkmoney;

    if (!shkp.isshk) {
        /* The monster type is shopkeeper, but this monster is
           not actually a shk, which could happen if someone
           wishes for a shopkeeper statue and then animates it.
           (Note: shkname() would be "" in a case like this.) */
        pline(_("%s asks whether you've seen any untended shops recently."),
              Monnam(shkp));
        /* [Perhaps we ought to check whether this conversation
           is taking place inside an untended shop, but a shopless
           shk can probably be expected to be rather disoriented.] */
        return;
    }

    eshk = ESHK(shkp);
    if (ANGRY(shkp)) {
        pline(_("%s %s how much %s dislikes %s customers."),
              Shknam(shkp),
              (!Deaf() && !muteshk(shkp)) ? _("mentions") : _("indicates"),
              noit_mhe(shkp), eshk.robbed ? _("non-paying") : _("rude"));
    } else if (eshk.following) {
        if (strncmp(eshk.customer, svp.plname, PL_NSIZ)) {
            if (!Deaf() && !muteshk(shkp)) {
                   ;
                verbalize(_("%s %s!  I was looking for %s."),
                      Hello(shkp), svp.plname, eshk.customer);
            }
            eshk.following = 0;
        } else {
            if (!Deaf() && !muteshk(shkp)) {
                   ;
                verbalize(_("%s %s!  Didn't you forget to pay?"),
                          Hello(shkp), svp.plname);
            } else {
                pline(_("%s taps you on the %s."),
                      Shknam(shkp), body_part(ARM));
            }
        }
    } else if (eshk.billct) {
        let total = addupbill(shkp) + eshk.debit;

        pline(_("%s %s that your bill comes to %lld %s."),
              Shknam(shkp),
              (!Deaf() && !muteshk(shkp)) ? _("says") : _("indicates"),
              total, currency(total));
    } else if (eshk.debit) {
        pline(_("%s %s that you owe %s %lld %s."),
              Shknam(shkp),
              (!Deaf() && !muteshk(shkp)) ? _("reminds you") : _("indicates"),
              noit_mhim(shkp), eshk.debit, currency(eshk.debit));
    } else if (eshk.credit) {
        pline(_("%s encourages you to use your %lld %s of credit."),
              Shknam(shkp), eshk.credit, currency(eshk.credit));
    } else if (eshk.robbed) {
        pline(_("%s %s about a recent robbery."),
              Shknam(shkp),
              (!Deaf() && !muteshk(shkp)) ? _("complains") : _("indicates concern"));
    } else if (eshk.surcharge) {
        pline(_("%s %s that %s is watching you carefully."), Shknam(shkp),
              (!Deaf() && !muteshk(shkp)) ? _("warns you") : _("indicates"),
              noit_mhe(shkp));
    } else if ((shkmoney = money_cnt(shkp.minvent)) < 50) {
        pline(_("%s %s that business is bad."),
              Shknam(shkp),
              (!Deaf() && !muteshk(shkp)) ? _("complains") : _("indicates"));
    } else if (shkmoney > 4000) {
        pline(_("%s %s that business is good."),
              Shknam(shkp),
              (!Deaf() && !muteshk(shkp)) ? _("says") : _("indicates"));
    } else if (is_izchak(shkp, FALSE)) {
        if (!Deaf() && !muteshk(shkp))
            pline(ROLL_FROM(Izchak_speaks), shkname(shkp));
    } else {
        if (!Deaf() && !muteshk(shkp))
            pline(_("%s talks about the problem of shoplifters."), Shknam(shkp));
    }
}

function kops_gone(silent) { /* void */
    let cnt = 0;
    let mtmp, mtmp2;

    for (mtmp = fmon(); mtmp; mtmp = mtmp2) {
        mtmp2 = mtmp.nmon;
        if (DEADMONSTER(mtmp))
            continue;
        if (mtmp.data.mlet == S_KOP) {
            if (canspotmon(mtmp))
                cnt++;
            mongone(mtmp);
        }
    }
    if (cnt && !silent)
        pline_The(_("Kop%s (disappointed) vanish%s into thin air."),
                  plur(cnt), (cnt == 1) ? _("es") : _(""));
}

function cost_per_charge(
    shkp,
    otmp,
    altusage) { /* long long */ /* some items have "alternate" use with different cost */
    let tmp = 0;

    if (!shkp || !inhishop(shkp))
        return 0; /* insurance */
    tmp = get_cost(otmp, shkp);

    /* The idea is to make the exhaustive use of an unpaid item
     * more expensive than buying it outright.
     */
    if (otmp.otyp == MAGIC_LAMP) { /* 1 */
        /* normal use (ie, as light source) of a magic lamp never
           degrades its value, but not charging anything would make
           identification too easy; charge an amount comparable to
           what is charged for an ordinary lamp (don't bother with
           angry shk surcharge) */
        if (!altusage)
            tmp = (objects[OIL_LAMP].oc_cost);
        else
            tmp += Math.trunc(tmp / 3);                 /* djinni is being released */
    } else if (otmp.otyp == MAGIC_MARKER) { /* 70 - 100 */
        /* No way to determine in advance how many charges will be
         * wasted.  So, arbitrarily, one half of the price per use.
         */
        tmp = Math.trunc(tmp / 2);
    } else if (otmp.otyp == BAG_OF_TRICKS /* 1 - 20 */
               || otmp.otyp == HORN_OF_PLENTY) {
        /* altusage: emptying of all the contents at once */
        if (!altusage)
            tmp = Math.trunc(tmp / 5);
    } else if (otmp.otyp == CRYSTAL_BALL               /* 1 - 5 */
               || otmp.otyp == OIL_LAMP                /* 1 - 10 */
               || otmp.otyp == BRASS_LANTERN
               || (otmp.otyp >= MAGIC_FLUTE
                   && otmp.otyp <= DRUM_OF_EARTHQUAKE) /* 5 - 9 */
               || otmp.oclass == WAND_CLASS) {         /* 3 - 11 */
        if (otmp.spe > 1)
            tmp = Math.trunc(tmp / 4);
    } else if (otmp.oclass == SPBOOK_CLASS) {
        tmp -= Math.trunc(tmp / 5);
    } else if (otmp.otyp == CAN_OF_GREASE || otmp.otyp == TINNING_KIT
               || otmp.otyp == EXPENSIVE_CAMERA) {
        tmp = Math.trunc(tmp / 10);
    } else if (otmp.otyp == POT_OIL) {
        tmp = Math.trunc(tmp / 5);
    }
    return tmp;
}

/* Charge the player for partial use of an unpaid object.
 *
 * Note that bill_dummy_object() should be used instead
 * when an object is completely used.
 */
export function check_unpaid_usage(otmp, altusage) { /* void */
    const $frame = stack_frame(); try {
    let shkp;
    let fmt, arg1, arg2;
    let buf = stack_array(char, BUFSZ);
    let tmp;

    if (!otmp.unpaid || !chars[u.ushops]
        || (otmp.spe <= 0 && objects[otmp.otyp].oc_charged))
        return;
    shkp = shop_keeper(chars[u.ushops]);
    if (!shkp || !inhishop(shkp))
        return;
    if ((tmp = cost_per_charge(shkp, otmp, altusage)) == 0)
        return;

    arg1 = arg2 = _("");
    if (otmp.oclass == SPBOOK_CLASS) {
        fmt = _("%sYou owe%s %lld %s.");
        sprintf(buf, _("This is no free library, %s!  "), cad(FALSE));
        arg1 = rn2(2) ? buf : _("");
        arg2 = ESHK(shkp).debit > 0 ? _(" an additional") : _("");
    } else if (otmp.otyp == POT_OIL) {
        fmt = _("%s%sThat will cost you %lld %s (Yendorian Fuel Tax).");
    } else if (altusage && (otmp.otyp == BAG_OF_TRICKS
                            || otmp.otyp == HORN_OF_PLENTY)) {
        fmt = _("%s%sEmptying that will cost you %lld %s.");
        if (!rn2(3))
            arg1 = _("Whoa!  ");
        if (!rn2(3))
            arg1 = _("Watch it!  ");
    } else {
        fmt = _("%s%sUsage fee, %lld %s.");
        if (!rn2(3))
            arg1 = _("Hey!  ");
        if (!rn2(3))
            arg2 = _("Ahem.  ");
    }

    if (!Deaf() && !muteshk(shkp)) {
           ;
        verbalize(fmt, arg1, arg2, tmp, currency(tmp));
        exercise(A_WIS, TRUE); /* you just got info */
    }
    ESHK(shkp).debit += tmp;
    } finally { stack_pop($frame); }
}

/* for using charges of unpaid objects "used in the normal manner" */
export function check_unpaid(otmp) { /* void */
    check_unpaid_usage(otmp, FALSE); /* normal item use */
}

export function costly_gold(
    x, y,
    amount,
    silent) { /* void */
    let delta;
    let shkp;
    let eshkp;

    if (!costly_spot(x, y))
        return;
    /* shkp is guaranteed to exist after successful costly_spot(), but
       the static analyzer isn't smart enough to realize that, so follow
       the shkp assignment with a redundant test that will always fail */
    shkp = shop_keeper(chars[in_rooms(x, y, SHOPBASE)]);
    if (!shkp)
        return;

    eshkp = ESHK(shkp);
    if (eshkp.credit >= amount) {
        if (!silent) {
            if (eshkp.credit > amount)
                Your(_("credit is reduced by %lld %s."), amount, currency(amount));
            else
                Your(_("credit is erased."));
        }
        eshkp.credit -= amount;
    } else {
        delta = amount - eshkp.credit;
        if (!silent) {
            if (eshkp.credit)
                Your(_("credit is erased."));
            if (eshkp.debit)
                Your(_("debt increases by %lld %s."), delta, currency(delta));
            else
                You(_("owe %s %lld %s."), shkname(shkp), delta, currency(delta));
        }
        eshkp.debit += delta;
        eshkp.loan += delta;
        eshkp.credit = 0;
    }
}

/* used in domove to block diagonal shop-exit */
/* x,y should always be a door */
export function block_door(x, y) { /* boolean */
    let roomno = chars[in_rooms(x, y, SHOPBASE)];
    let shkp;

    if (roomno < 0 || !(svr.rooms[roomno].rtype >= SHOPBASE))
        return FALSE;
    if (!IS_DOOR(levl()[x][y].typ))
        return FALSE;
    if (roomno != chars[u.ushops])
        return FALSE;

    shkp = shop_keeper(char(roomno));
    if (!shkp || !inhishop(shkp))
        return FALSE;

    if (shkp.mx == ESHK(shkp).shk.x && shkp.my == ESHK(shkp).shk.y
        /* Actually, the shk should be made to block _any_
         * door, including a door the player digs, if the
         * shk is within a 'jumping' distance.
         */
        && ESHK(shkp).shd.x == x
        && ESHK(shkp).shd.y == y
        && !helpless(shkp)
        && (ESHK(shkp).debit || ESHK(shkp).billct || ESHK(shkp).robbed)) {
        pline(_("%s%s blocks your way!"), Shknam(shkp),
              Invis() ? _(" senses your motion and") : _(""));
        return TRUE;
    }
    return FALSE;
}

/* used in domove to block diagonal shop-entry;
   u.ux, u.uy should always be a door */
export function block_entry(x, y) { /* boolean */
    let sx, sy;
    let roomno;
    let shkp;

    if (!(IS_DOOR(levl()[u.ux][u.uy].typ)
          && levl()[u.ux][u.uy].flags == D_BROKEN))
        return FALSE;

    roomno = chars[in_rooms(x, y, SHOPBASE)];
    if (roomno < 0 || !(svr.rooms[roomno].rtype >= SHOPBASE))
        return FALSE;
    shkp = shop_keeper(char(roomno));
    if (!shkp || !inhishop(shkp))
        return FALSE;

    if (ESHK(shkp).shd.x != u.ux || ESHK(shkp).shd.y != u.uy)
        return FALSE;

    sx = ESHK(shkp).shk.x;
    sy = ESHK(shkp).shk.y;

    if (shkp.mx == sx && shkp.my == sy && !helpless(shkp)
        && (x == sx - 1 || x == sx + 1 || y == sy - 1 || y == sy + 1)
        && (Invis() || carrying(PICK_AXE) || carrying(DWARVISH_MATTOCK)
            || u.usteed)) {
        pline(_("%s%s blocks your way!"), Shknam(shkp),
              Invis() ? _(" senses your motion and") : _(""));
        return TRUE;
    }
    return FALSE;
}

/* "your " or "Foobar's " (note the trailing space) */
export function shk_your(buf, obj) { /* char * */
    let chk_pm = +(obj.otyp == CORPSE && ismnum(obj.corpsenm));

    chars[buf + 0] = ord('\0');
    if (chk_pm && type_is_pname(mons[obj.corpsenm]))
        return buf; /* skip ownership prefix and space: "Medusa's corpse" */
    else if (chk_pm && the_unique_pm(mons[obj.corpsenm]))
        strcpy(buf, _("the")); /* override ownership: "the Oracle's corpse" */
    else if (!shk_owns(buf, obj) && !mon_owns(buf, obj))
        strcpy(buf, the_your()[carried(obj) ? 1 : 0]);
    return strcat(buf, _(" "));
}

export function Shk_Your(buf, obj) { /* char * */
    shk_your(buf, obj);
    chars[buf] = highc(chars[buf]);
    return buf;
}

function shk_owns(buf, obj) { /* char * */
    const $frame = stack_frame(); try {
    let shkp;
    let x = stack_var(coordxy), y = stack_var(coordxy);

    if (get_obj_location(obj, x, y, 0)
        && (obj.unpaid || (obj.where == OBJ_FLOOR && !obj.no_charge
                            && costly_spot(x[0], y[0])))) {
        shkp = shop_keeper(inside_shop(x[0], y[0]));
        return strcpy(buf, shkp ? s_suffix(shkname(shkp)) : the_your()[0]);
    }
    return 0;
    } finally { stack_pop($frame); }
}

function mon_owns(buf, obj) { /* char * */
    if (obj.where == OBJ_MINVENT)
        return strcpy(buf, s_suffix(y_monnam(obj.v.v_ocarry)));
    return 0;
}

function cad(
    altusage) { /* const char * */ /* used as a verbalized exclamation: \"Cad! ...\" */
    let res = 0;

    switch (is_demon(gy.youmonst.data) ? 3 : poly_gender()) {
    case 0:
        res = _("cad");
        break;
    case 1:
        res = _("minx");
        break;
    case 2:
        res = _("beast");
        break;
    case 3:
        res = _("fiend");
        break;
    default:
        impossible(_("cad: unknown gender"));
        res = _("thing");
        break;
    }
    if (altusage) {
        let cadbuf = mon_nam(gy.youmonst); /* snag an output buffer */

        /* alternate usage adds a leading double quote and trailing
           exclamation point plus sentence separating spaces */
        sprintf(cadbuf, _("\"%s!  "), res);
        chars[cadbuf + 1] = highc(chars[cadbuf + 1]);
        res = cadbuf;
    }
    return res;
}

/*
 * The caller is about to make obj_absorbed go away.
 *
 * There's no way for you (or a shopkeeper) to prevent globs
 * from merging with each other on the floor due to the
 * inherent nature of globs so it irretrievably becomes part
 * of the floor glob mass. When one glob is absorbed by another
 * glob, the two become indistinguishable and the remaining
 * glob object grows in mass, the product of both.
 *
 * billing admin, player compensation, shopkeeper compensation
 * all need to be considered.
 *
 * Any original billed item is lost to the absorption so the
 * original billed amount for the object being absorbed must
 * get added to the cost owing for the absorber, and the
 * separate cost for the object being absorbed goes away.
 *
 * There are four scenarios to deal with:
 *     1. shop_owned glob merging into shop_owned glob
 *     2. player_owned glob merging into shop_owned glob
 *     3. shop_owned glob merging into player_owned glob
 *     4. player_owned glob merging into player_owned glob
 */
export function globby_bill_fixup(obj_absorber, obj_absorbed) { /* void */
    const $frame = stack_frame(); try {
    let x = 0, y = 0;
    let bp, bp_absorber = null;
    let shkp = stack_var(ptr_to(struct_monst), null);
    let eshkp;
    let amount, per_unit_cost;
    let floor_absorber = +(obj_absorber.where == OBJ_FLOOR);

    if (!obj_absorber.globby)
        impossible(_("globby_bill_fixup called for non-globby object"));

    if (floor_absorber) {
        x = obj_absorber.ox, y = obj_absorber.oy;
    }
    if (obj_absorber.unpaid) {
        /* look for a shopkeeper who owns this object */
        for (shkp[0] = next_shkp(fmon(), TRUE); shkp[0];
             shkp[0] = next_shkp(shkp[0].nmon, TRUE))
            if (onbill(obj_absorber, shkp[0], TRUE))
                break;
    } else if (obj_absorbed.unpaid) {
        if (obj_absorbed.where == OBJ_FREE
             && floor_absorber && costly_spot(x, y)) {
            shkp[0] = shop_keeper(chars[in_rooms(x, y, SHOPBASE)]);
        }
    }
    /* sanity check, in case obj is on bill but not marked 'unpaid' */
    if (!shkp[0])
        shkp[0] = shop_keeper(chars[u.ushops]);
    if (!shkp[0])
        return;
    bp_absorber = onbill(obj_absorber, shkp[0], FALSE);
    bp = onbill(obj_absorbed, shkp[0], FALSE);
    eshkp = ESHK(shkp[0]);
    per_unit_cost = set_cost(obj_absorbed, shkp[0]);

    /**************************************************************
     * Scenario 1. Shop-owned glob absorbing into shop-owned glob
     **************************************************************/
    if (bp && (!obj_absorber.no_charge
               || billable(shkp, obj_absorber, eshkp.shoproom, FALSE))) {
        /* the glob being absorbed has a billing record */
        amount = bp.price;
        eshkp.billct--;
        struct_assign(bp, ptr_add(eshkp.bill_p, eshkp.billct));
        clear_unpaid_obj(shkp[0], obj_absorbed);

        if (bp_absorber) {
            /* the absorber has a billing record */
            bp_absorber.price += amount;
        } else {
            /* the absorber has no billing record */
            ;
        }
        return;
    }
    /**************************************************************
     * Scenario 2. Player-owned glob absorbing into shop-owned glob
     **************************************************************/
    if (!bp_absorber && !bp && !obj_absorber.no_charge) {
        /* there are no billing records */
        amount = get_pricing_units(obj_absorbed) * per_unit_cost;
        if (saleable(shkp[0], obj_absorbed)) {
            if (eshkp.debit >= amount) {
                if (eshkp.loan) { /* you carry shop's gold */
                   if (eshkp.loan >= amount)
                        eshkp.loan -= amount;
                   else
                        eshkp.loan = 0;
                }
                eshkp.debit -= amount;
                pline_The(_("donated %s %spays off your debt."),
                          obj_typename(obj_absorbed.otyp),
                          eshkp.debit ? _("partially ") : _(""));
            } else {
                let delta = amount - eshkp.debit;

                eshkp.credit += delta;
                if (eshkp.debit) {
                    eshkp.debit = 0;
                    eshkp.loan = 0;
                    Your(_("debt is paid off."));
                }
                if (eshkp.credit == delta)
                    pline_The(_("%s established %lld %s credit."),
                              obj_typename(obj_absorbed.otyp),
                              delta, currency(delta));
                else
                    pline_The(_("%s added %lld %s %s %lld %s."),
                              obj_typename(obj_absorbed.otyp),
                              delta, currency(delta),
                              _("to your credit; total is now"),
                              eshkp.credit, currency(eshkp.credit));
            }
        }
        return;
    } else if (bp_absorber) {
        /* absorber has a billing record */
        bp_absorber.price += per_unit_cost * get_pricing_units(obj_absorbed);
        return;
    }
    /**************************************************************
     * Scenario 3. shop_owned glob merging into player_owned glob
     **************************************************************/
    if (bp && (obj_absorber.no_charge
               || (floor_absorber && !costly_spot(x, y)))) {
        amount = bp.price;
        bill_dummy_object(obj_absorbed);
           ;
        verbalize(_("You owe me %lld %s for my %s that you %s with your%s"),
                  amount, currency(amount), obj_typename(obj_absorbed.otyp),
                  ANGRY(shkp[0]) ? _("had the audacity to mix") : _("just mixed"),
                  ANGRY(shkp[0]) ? _(" stinking batch!") : _("s."));
        return;
    }
    /**************************************************************
     * Scenario 4. player_owned glob merging into player_owned glob
     **************************************************************/

    return;
    } finally { stack_pop($frame); }
}

/* Shopkeeper bills for use of a land mine or bear trap they own */
export function use_unpaid_trapobj(otmp, x, y) { /* void */
    if (otmp.unpaid) {
        if (!Deaf()) {
            let shkp = find_objowner(otmp, x, y);

            if (shkp && !muteshk(shkp)) {
                   ;
                verbalize(_("You set it, you buy it!"));
            }
        }
        bill_dummy_object(otmp);
    }
}

/*shk.c*/

import { A_CHA, A_WIS } from "./attrib.h.js";
import { ACURR } from "./attrib.h.macros.js";
import { BEFORE, NOW } from "./botl.h.js";
import { NO_COLOR } from "./color.h.js";
import { struct_nhcoord } from "./coord.h.js";
import { the_your } from "./decl.h.macros.js";
import {
    AMULET_CLASS, ARMOR_CLASS, BALL_CLASS, CHAIN_CLASS, COIN_CLASS, FOOD_CLASS, GEM_CLASS, GOLD_SYM,
    POTION_CLASS, RING_CLASS, SCROLL_CLASS, SPBOOK_CLASS, S_KOP, TOOL_CLASS, WAND_CLASS,
    WEAPON_CLASS,
} from "./defsym.h.js";
import { canspotmon } from "./display.h.macros.js";
import { MIGR_APPROX_XY } from "./dungeon.h.js";
import {
    BUFSZ, COLNO, FALSE, LL_ACHIEVE, MAXULEV, PL_NSIZ, ROWNO, TRUE, boolean, coordxy,
} from "./global.h.js";
import {
    ARM, ARTICLE_THE, BOLT_LIM, COST_CONTENTS, COST_SINGLEOBJ, ECMD_CANCEL, ECMD_OK, ECMD_TIME, EYE,
    HAND, HEAD, HUNGRY, MENU_TRADITIONAL, MM_NOMSG, NECK, RLOC_MSG, RLOC_NOMSG, SELL_DONTSELL,
    SELL_NORMAL, invlet_basic,
} from "./hack.h.js";
import {
    ROLL_FROM, distu, makeknown, max, mdistu, nyaq, onlineu, pline1, plur, y_n,
} from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { int8 } from "./integer.h.js";
import { debugpline0 } from "./lint.h.macros.js";
import { BILLSZ, REPAIR_DELAY, struct_bill_x } from "./mextra.h.js";
import { ESHK, MGIVENNAME, has_eshk, has_mgivenname } from "./mextra.h.macros.js";
import { ANY_SHOP, CANDLESHOP, NO_ROOM, ROOMOFFSET, SHOPBASE } from "./mkroom.h.js";
import {
    has_head, haseyes, is_demon, is_elf, is_human, is_silent, is_vampire, nolimbs, passes_walls,
    type_is_pname, unique_corpstat,
} from "./mondata.h.macros.js";
import { G_GONE, MS_ANIMAL, MS_HUMANOID } from "./monflag.h.js";
import { M_AP_MONSTER, M_AP_NOTHING, struct_monst } from "./monst.h.js";
import { DEADMONSTER, M_AP_TYPE, helpless, ismnum } from "./monst.h.macros.js";
import {
    LOW_PM, PM_ELF, PM_GRID_BUG, PM_KEYSTONE_KOP, PM_KNIGHT, PM_KOP_KAPTAIN, PM_KOP_LIEUTENANT,
    PM_KOP_SERGEANT, PM_ROGUE, PM_TOURIST,
} from "./monsters.h.js";
import {
    CONTAINED_TOO, OBJ_BURIED, OBJ_CONTAINED, OBJ_FLOOR, OBJ_FREE, OBJ_INVENT, OBJ_MINVENT,
    OBJ_ONBILL,
} from "./obj.h.js";
import {
    Has_contents, Is_candle, Is_container, OMID, SchroedingersBox, carried, has_omid, is_pick,
    newobj,
} from "./obj.h.macros.js";
import { GEMSTONE, GLASS } from "./objclass.h.js";
import {
    AGATE, AMBER, AMETHYST, AQUAMARINE, BAG_OF_TRICKS, BEARTRAP, BLACK_OPAL, BOULDER, BRASS_LANTERN,
    CANDELABRUM_OF_INVOCATION, CAN_OF_GREASE, CHRYSOBERYL, CITRINE, CORPSE, CRYSTAL_BALL, DIAMOND,
    DRUM_OF_EARTHQUAKE, DUNCE_CAP, DWARVISH_MATTOCK, EGG, EMERALD, EXPENSIVE_CAMERA,
    FIRST_GLASS_GEM, FIRST_REAL_GEM, FLUORITE, HORN_OF_PLENTY, JACINTH, JADE, JASPER, JET,
    LAND_MINE, LEASH, MAGIC_FLUTE, MAGIC_LAMP, MAGIC_MARKER, MIRROR, OIL_LAMP, OPAL, PICK_AXE,
    POT_OIL, POT_WATER, ROCK, RUBY, SAPPHIRE, STRANGE_OBJECT, TIN, TINNING_KIT, TOPAZ,
} from "./objects.h.js";
import {
    ACID_RES, COLD_RES, DISINT_RES, FIRE_RES, POISON_RES, SHOCK_RES, SLEEP_RES, STONE_RES, TELEPAT,
    TELEPORT, TELEPORT_CONTROL, W_QUIVER, W_SWAPWEP,
} from "./prop.h.js";
import { D_BROKEN, D_CLOSED, SVALL, struct_damage } from "./rm.h.js";
import {
    IS_DOOR, IS_ROOM, IS_WALL, MON_AT, ZAP_POS, fmon, fobj, levl, m_at,
} from "./rm.h.macros.js";
import { BEAR_TRAP, HOLE, LANDMINE, PIT, SPIKED_PIT } from "./trap.h.js";
import { cansee, m_canseeu } from "./vision.h.macros.js";
import {
    create_nhwindow, destroy_nhwindow, display_nhwindow, end_menu, mark_synch, nh_delay_output,
    putstr, start_menu, wait_synch,
} from "./winprocs.h.macros.js";
import {
    ATR_NONE, MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, NHW_MENU, PICK_ANY, struct_any, struct_mi,
} from "./wintype.h.js";
import { ACH_SHOP, TT_PIT } from "./you.h.js";
import {
    Race_if, Role_if, Upolyd, m_next2u, noit_mhe, noit_mhim, noit_mhis, u_at,
} from "./you.h.macros.js";
import {
    Blind, Blind_telepat, Conflict, Deaf, Detect_monsters, Displaced, Fast, Invis, Passes_walls,
    Punished,
} from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import {
    char, int, long, ord, short, sizeof, sizeof_string, uchar, ulong, unsigned,
} from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import {
    abs, assert, free, memset, sleep, sprintf, strcat, strchr, strcmp, strcpy, strlen, strncmp,
    strncpy,
} from "../rt/libc.js";
import {
    init_list, init_string, stack_array, stack_struct, stack_var, static_array, static_struct,
    static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, elt, ptr_add, ptr_diff, ptr_to, struct, struct_assign, view_of,
} from "../rt/struct.js";
import { stop_occupation } from "./allmain.js";
import { alloc } from "./alloc.js";
import { o_unleash, um_dist, unleash_all } from "./apply.js";
import { arti_cost } from "./artifact.js";
import { adjalign, exercise } from "./attrib.js";
import { placebc, unplacebc } from "./ball.js";
import { drop_upon_death } from "./bones.js";
import { bot } from "./botl.js";
import { isok, yn_function } from "./cmd.js";
import {
    cg, disp, flags, ga, gb, gc, gf, gi, gk, gm, gr, gs, gt, gy, iflags, program_state, svl, svm,
    svp, svr, u, ynaqchars,
} from "./decl.js";
import { holetime } from "./dig.js";
import { canseemon, map_invisible, newsym, nul_glyphinfo, sensemon } from "./display.js";
import { dropy } from "./do.js";
import { Monnam, a_monnam, mon_nam, x_monnam, y_monnam } from "./do_name.js";
import { migrate_to_level } from "./dog.js";
import { assign_level, depth, ledger_no, on_level } from "./dungeon.js";
import { food_disappears, intrinsic_possible } from "./eat.js";
import { panic } from "./end.js";
import { del_engr_at } from "./engrave.js";
import { getpos } from "./getpos.js";
import { check_special_room, in_rooms, inv_cnt, money_cnt } from "./hack.js";
import {
    dist2, eos, highc, nh_deterministic_qsort, s_suffix, sgn, strncmpi, upstart,
} from "./hacklib.js";
import { record_achievement } from "./insight.js";
import {
    addinv, carrying, count_contents, count_unpaid, currency, freeinv, merge_choice, o_on, sobj_at,
    update_inventory, xprname,
} from "./invent.js";
import { maybe_reset_pick, picking_at } from "./lock.js";
import { makemon } from "./makemon.js";
import { mattacku } from "./mhitu.js";
import {
    add_to_minv, bill_dummy_object, dealloc_obj, mksobj, newomid, next_ident, obj_extract_self,
    place_object, remove_object, splitobj, weight,
} from "./mkobj.js";
import { search_special } from "./mkroom.js";
import { angry_guards, mnearto, mnexto, mongone, pacify_guards, wake_nearto } from "./mon.js";
import { locomotion, resist_conflict } from "./mondata.js";
import { closed_door, dochug } from "./monmove.js";
import { mons } from "./monst.js";
import { observe_object } from "./o_init.js";
import { objects } from "./objects.js";
import {
    Doname2, The, ansimpleoname, doname, makeplural, obj_typename, paydoname, safe_qbuf,
    simpleonames, the, the_unique_pm, thesimpleoname, xname,
} from "./objnam.js";
import {
    Norep, There, You, You_cant, You_feel, You_hear, Your, impossible, livelog_printf, pline,
    pline_The, verbalize,
} from "./pline.js";
import { body_part, mbodypart, poly_gender } from "./polyself.js";
import { move_special } from "./priest.js";
import { rn2, rnd } from "./rnd.js";
import { Hello } from "./role.js";
import { Shknam, is_izchak, saleable, shkname, shtypes } from "./shknam.js";
import { growl, set_voice, yelp } from "./sounds.js";
import { book_disappears } from "./spell.js";
import { findgold, mdrop_special_objs, mpickobj, remove_worn_item } from "./steal.js";
import { enexto } from "./teleport.js";
import { obj_stop_timers } from "./timeout.js";
import { deltrap, t_at, trapname } from "./trap.js";
import { hidden_gold } from "./vault.js";
import { block_point } from "./vision.js";
import { add_menu, add_menu_heading, select_menu } from "./windows.js";
import { choose_stairs } from "./wizard.js";
import { setnotworn } from "./worn.js";
import { get_obj_location } from "./zap.js";
const __FILE__ = "shk.c";
