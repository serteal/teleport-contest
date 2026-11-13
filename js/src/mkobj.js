/* NetHack 5.0	mkobj.c	$NHDT-Date: 1764044196 2025/11/24 20:16:36 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.326 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Derek S. Ray, 2015. */
/* NetHack may be freely redistributed.  See license for details. */

const struct_icp = struct("struct_icp", {
    iprob: int,
    iclass: char,
});

const mkobjprobs = static_array("mkobjprobs", struct_icp, null, [ { iprob: 10, iclass: WEAPON_CLASS },
                                         { iprob: 11, iclass: ARMOR_CLASS },
                                         { iprob: 20, iclass: FOOD_CLASS },
                                         { iprob: 8, iclass: TOOL_CLASS },
                                         { iprob: 7, iclass: GEM_CLASS },
                                         { iprob: 16, iclass: POTION_CLASS },
                                         { iprob: 16, iclass: SCROLL_CLASS },
                                         { iprob: 4, iclass: SPBOOK_CLASS },
                                         { iprob: 4, iclass: WAND_CLASS },
                                         { iprob: 3, iclass: RING_CLASS },
                                         { iprob: 1, iclass: AMULET_CLASS } ]);

const boxiprobs = static_array("boxiprobs", struct_icp, null, [ { iprob: 18, iclass: GEM_CLASS },
                                        { iprob: 15, iclass: FOOD_CLASS },
                                        { iprob: 18, iclass: POTION_CLASS },
                                        { iprob: 18, iclass: SCROLL_CLASS },
                                        { iprob: 12, iclass: SPBOOK_CLASS },
                                        { iprob: 7, iclass: COIN_CLASS },
                                        { iprob: 6, iclass: WAND_CLASS },
                                        { iprob: 5, iclass: RING_CLASS },
                                        { iprob: 1, iclass: AMULET_CLASS } ]);

const rogueprobs = static_array("rogueprobs", struct_icp, null, [ { iprob: 12, iclass: WEAPON_CLASS },
                                         { iprob: 12, iclass: ARMOR_CLASS },
                                         { iprob: 22, iclass: FOOD_CLASS },
                                         { iprob: 22, iclass: POTION_CLASS },
                                         { iprob: 22, iclass: SCROLL_CLASS },
                                         { iprob: 5, iclass: WAND_CLASS },
                                         { iprob: 5, iclass: RING_CLASS } ]);

const hellprobs = static_array("hellprobs", struct_icp, null, [ { iprob: 20, iclass: WEAPON_CLASS },
                                        { iprob: 20, iclass: ARMOR_CLASS },
                                        { iprob: 16, iclass: FOOD_CLASS },
                                        { iprob: 12, iclass: TOOL_CLASS },
                                        { iprob: 10, iclass: GEM_CLASS },
                                        { iprob: 1, iclass: POTION_CLASS },
                                        { iprob: 1, iclass: SCROLL_CLASS },
                                        { iprob: 8, iclass: WAND_CLASS },
                                        { iprob: 8, iclass: RING_CLASS },
                                        { iprob: 4, iclass: AMULET_CLASS } ]);

const zerooextra = static_struct("zerooextra", struct_oextra, {});

function init_oextra(oex) { /* void */
    struct_assign(oex, zerooextra);
}

export function newoextra() { /* struct oextra * */
    let oextra;

    oextra = view_of(struct_oextra, addr_of(alloc(sizeof(struct_oextra))));
    init_oextra(oextra);
    return oextra;
}

export function dealloc_oextra(o) { /* void */
    let x = o.oextra;

    if (x) {
        if (x.oname)
            free(x.oname), x.oname = 0;
        if (x.omonst)
            free_omonst(o); /* note: pass 'o' rather than 'x' */
        if (x.omailcmd)
            free(x.omailcmd), x.omailcmd = 0;

        free(addr_of(x));
        o.oextra = null;
    }
}

export function newomonst(otmp) { /* void */
    if (!otmp.oextra)
        otmp.oextra = newoextra();

    if (!OMONST(otmp)) {
        let m = newmonst();

        struct_assign(m, cg.zeromonst);
        ((otmp).oextra.omonst) = m;
    }
}

export function free_omonst(otmp) { /* void */
    if (otmp.oextra) {
        let m = OMONST(otmp);

        if (m) {
            if (m.mextra)
                dealloc_mextra(m);
            free(addr_of(m));
            ((otmp).oextra.omonst) = null;
        }
    }
}

export function newomid(otmp) { /* void */
    if (!otmp.oextra)
        otmp.oextra = newoextra();
    ((otmp).oextra.omid) = 0;
}

export function free_omid(otmp) { /* void */
    ((otmp).oextra.omid) = 0;
}

export function new_omailcmd(otmp, response_cmd) { /* void */
    if (!otmp.oextra)
        otmp.oextra = newoextra();
    if (OMAILCMD(otmp))
        free_omailcmd(otmp);
    ((otmp).oextra.omailcmd) = dupstr(response_cmd);
}

export function free_omailcmd(otmp) { /* void */
    if (otmp.oextra && OMAILCMD(otmp)) {
        free(OMAILCMD(otmp));
        ((otmp).oextra.omailcmd) = 0;
    }
}

/* can object be generated eroded? */
function may_generate_eroded(otmp) { /* boolean */
    /* initial hero inventory */
    if (svm.moves <= 1 && !gi.in_mklev)
        return FALSE;
    /* already erodeproof or cannot be eroded */
    if (otmp.oerodeproof || !erosion_matters(otmp) || !is_damageable(otmp))
        return FALSE;
    /* part of a monster's body and produced when it dies */
    if (otmp.otyp == WORM_TOOTH || otmp.otyp == UNICORN_HORN)
        return FALSE;
    /* artifacts cannot be generated eroded  */
    if (otmp.oartifact)
        return FALSE;
    return TRUE;
}

/* random chance of applying erosions/grease to object */
function mkobj_erosions(otmp) { /* void */
    if (may_generate_eroded(otmp)) {
        /* A small fraction of non-artifact items will generate eroded or
         * possibly erodeproof. An item that generates eroded will never be
         * erodeproof, and vice versa. */
        if (!rn2(100)) {
            otmp.oerodeproof = 1;
        } else {
            if (!rn2(80) && (is_flammable(otmp) || is_rustprone(otmp)
                             || is_crackable(otmp))) {
                do {
                    otmp.oeroded++;
                } while (otmp.oeroded < 3 && !rn2(9));
            }
            if (!rn2(80) && (is_rottable(otmp) || is_corrodeable(otmp))) {
                do {
                    otmp.oeroded2++;
                } while (otmp.oeroded2 < 3 && !rn2(9));
            }
        }
        /* and an extremely small fraction of the time, erodable items
         * will generate greased */
        if (!rn2(1000))
            otmp.greased = 1;
    }
}

/* make a random object of class 'let' at a specific location;
   'let' might be random class; place_object() will validate <x,y> */
export function mkobj_at(let_, x, y, artif) { /* struct obj * */
    let otmp;

    otmp = mkobj(let_, artif);
    place_object(otmp, x, y);
    return otmp;
}

/* make a specific object at a specific location */
export function mksobj_at(
    otyp,
    x, y,
    init, artif) { /* struct obj * */
    let otmp;

    otmp = mksobj(otyp, init, artif);
    place_object(otmp, x, y);
    return otmp;
}

/* used for extra orctown loot */
export function mksobj_migr_to_species(
    otyp,
    mflags2,
    init, artif) { /* struct obj * */
    let otmp;

    otmp = mksobj(otyp, init, artif);
    add_to_migration(otmp);
    otmp.owornmask = MIGR_TO_SPECIES;
    otmp.corpsenm = int(mflags2);
    return otmp;
}

/* mkobj(): select a type of item from a class, use mksobj() to create it;
   result is always non-Null */
export function mkobj(oclass, artif) { /* struct obj * */
    let tprob, i, prob;

    if (oclass == RANDOM_CLASS) {
        let iprobs = Is_rogue_level(u.uz)
                                   ? (rogueprobs[0])
                                   : Inhell() ? (hellprobs[0])
                                            : (mkobjprobs[0]);

        for (tprob = rnd(100); (tprob -= iprobs.iprob) > 0; iprobs = ptr_add(iprobs, 1))
            continue;
        oclass = iprobs.iclass;
    }

    if (oclass == SPBOOK_no_NOVEL) {
        i = rnd_class(svb.bases[SPBOOK_CLASS], SPE_BLANK_PAPER);
        oclass = SPBOOK_CLASS; /* for sanity check below */
    } else {
        prob = rnd(go.oclass_prob_totals[oclass]);
        i = svb.bases[oclass];
        while ((prob -= objects[i].oc_prob) > 0)
            ++i;
    }

    if (objects[i].oc_class != oclass || !OBJ_NAME(objects[i])) {
        impossible(_("probtype error, oclass=%d i=%d"), oclass, i);
        i = svb.bases[oclass];
    }

    return mksobj(i, TRUE, artif);
}

function mkbox_cnts(box) { /* void */
    let n;
    let otmp;

    box.cobj = null;

    switch (box.otyp) {
    case ICE_BOX:
        n = 20;
        break;
    case CHEST:
        n = box.olocked ? 7 : 5;
        break;
    case LARGE_BOX:
        n = box.olocked ? 5 : 3;
        break;
    case SACK:
    case OILSKIN_SACK:
        /* initial inventory: sack starts out empty */
        if (svm.moves <= 1 && !gi.in_mklev) {
            n = 0;
            break;
        }
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case BAG_OF_HOLDING:
        n = 1;
        break;
    default:
        n = 0;
        break;
    }

    for (n = rn2(n + 1); n > 0; n--) {
        if (box.otyp == ICE_BOX) {
            otmp = mksobj(CORPSE, TRUE, FALSE);
            /* Note: setting age to 0 is correct.  Age has a different
             * from usual meaning for objects stored in ice boxes. -KAA
             */
            otmp.age = 0;
            if (otmp.timed) {
                stop_timer(ROT_CORPSE, obj_to_any(otmp));
                stop_timer(REVIVE_MON, obj_to_any(otmp));
                stop_timer(SHRINK_GLOB, obj_to_any(otmp));
            }
        } else {
            let tprob;
            let iprobs = boxiprobs[0];

            for (tprob = rnd(100); (tprob -= iprobs.iprob) > 0; iprobs = ptr_add(iprobs, 1))
                ;
            if (!(otmp = mkobj(iprobs.iclass, FALSE)))
                continue;

            /* handle a couple of special cases */
            if (otmp.oclass == COIN_CLASS) {
                /* 2.5 x level's usual amount; weight adjusted below */
                otmp.quan = (rnd(level_difficulty() + 2) * rnd(75));
                otmp.owt = unsigned(weight(otmp));
            } else
                while (otmp.otyp == ROCK) {
                    otmp.otyp = rnd_class(DILITHIUM_CRYSTAL, LOADSTONE);
                    if (otmp.quan > 2)
                        otmp.quan = 1;
                    otmp.owt = unsigned(weight(otmp));
                }
            if (box.otyp == BAG_OF_HOLDING) {
                if (Is_mbag(otmp)) {
                    otmp.otyp = SACK;
                    otmp.spe = 0;
                    otmp.owt = unsigned(weight(otmp));
                } else
                    while (otmp.otyp == WAN_CANCELLATION)
                        otmp.otyp = rnd_class(WAN_LIGHT, WAN_LIGHTNING);
            }
        }
        add_to_container(box, otmp);
    }
    /* caller will update box->owt */
}

/* select a random, common monster type */
export function rndmonnum() { /* int */
    return rndmonnum_adj(0, 0);
}

/* select a random, common monster type, with adjusted difficulty */
export function rndmonnum_adj(minadj, maxadj) { /* int */
    let ptr;
    let i;
    let excludeflags;

    /* Plan A: get a level-appropriate common monster */
    ptr = rndmonst_adj(minadj, maxadj);
    if (ptr)
        return monsndx(ptr);

    /* Plan B: get any common monster */
    excludeflags = G_UNIQ | G_NOGEN | (Inhell() ? G_NOHELL : G_HELL);
    do {
        i = rn1(SPECIAL_PM - LOW_PM, LOW_PM);
        ptr = mons[i];
    } while ((ptr.geno & excludeflags) != 0);

    return i;
}

export function copy_oextra(obj2, obj1) { /* void */
    if (!obj2 || !obj1 || !obj1.oextra)
        return;

    if (!obj2.oextra)
        obj2.oextra = newoextra();
    if (has_oname(obj1))
        oname(obj2, ONAME(obj1), ONAME_SKIP_INVUPD);
    if (has_omonst(obj1)) {
        if (!OMONST(obj2))
            newomonst(obj2);
        assert(has_omonst(obj2));
        memcpy(addr_of(OMONST(obj2)),
                      addr_of(OMONST(obj1)), sizeof(struct_monst));
        OMONST(obj2).mextra = null;
        OMONST(obj2).nmon = null;

        if (OMONST(obj1).mextra)
            copy_mextra(OMONST(obj2), OMONST(obj1));
    }
    if (has_omailcmd(obj1)) {
        new_omailcmd(obj2, OMAILCMD(obj1));
    }
    if (has_omid(obj1)) {
        if (!OMID(obj2))
            newomid(obj2);
        ((obj2).oextra.omid) = OMID(obj1);
    }
}

/*
 * Split stack so that its size gets reduced by num.  The quantity num is
 * put in the object structure delivered by this call.  The returned object
 * has its wornmask cleared and is positioned just following the original
 * in the nobj chain (and nexthere chain when on the floor).
 */
export function splitobj(obj, num) { /* struct obj * */
    let otmp;

    /* can't split containers */
    if (obj.cobj || num <= 0 || obj.quan <= num)
        panic(_("splitobj [cobj=%s num=%lld quan=%lld]"),
              obj.cobj ? _("non-empty container") : _("(null)"), num, obj.quan);

    otmp = newobj();
    struct_assign(otmp, obj); /* copies whole structure */
    otmp.oextra = null;
    otmp.o_id = nextoid(obj, otmp);
    otmp.timed = 0;                  /* not timed, yet */
    otmp.lamplit = 0;                /* ditto */
    otmp.owornmask = 0;             /* new object isn't worn */
    obj.quan -= num;
    obj.owt = unsigned(weight(obj));
    otmp.quan = num;
    otmp.owt = unsigned(weight(otmp)); /* -= obj->owt ? */
    otmp.lua_ref_cnt = 0;
    otmp.pickup_prev = 0;

    svc.context.objsplit.parent_oid = obj.o_id;
    svc.context.objsplit.child_oid = otmp.o_id;
    obj.nobj = otmp;
    /* Only set nexthere when on the floor; nexthere is also used
       as a back pointer to the container object when contained.
       For either case, otmp's nexthere pointer is already pointing
       at the right thing. */
    if (obj.where == OBJ_FLOOR)
        obj.v.v_nexthere = otmp; /* insert into chain: obj -> otmp -> next */
    /* lua isn't tracking the split off portion even if it happens to
       be tracking the original */
    if (otmp.where == OBJ_LUAFREE)
        otmp.where = OBJ_FREE;
    if (obj.unpaid)
        splitbill(obj, otmp);
    copy_oextra(otmp, obj);
    if (has_omid(otmp))
        free_omid(otmp); /* only one association with m_id */
    if (obj.timed)
        obj_split_timers(obj, otmp);
    if (obj_sheds_light(obj))
        obj_split_light_source(obj, otmp);
    return otmp;
}

/* return the value of context.ident and then increment it to be ready for
   its next use; used to be simple += 1 so that every value from 1 to N got
   used but now has a random increase that skips half of potential values */
export function next_ident() { /* unsigned */
    let res = svc.context.ident;

    /* +rnd(2): originally just +1; changed to rnd() to avoid potential
       exploit of player using #adjust to split an object stack in a manner
       that makes most recent ident%2 known; since #adjust takes no time,
       no intervening activity like random creation of a new monster will
       take place before next user command; with former +1, o_id%2 of the
       next object to be created was knowable and player could make a wish
       under controlled circumstances for an item that is affected by the
       low bits of its obj->o_id [particularly helm of opposite alignment] */
    svc.context.ident += unsigned(rnd(2)); /* ready for next new object or monster */

    /* if ident has wrapped to 0, force it to be non-zero; if/when it
       ever wraps past 0 (unlikely, but possible on a configuration which
       uses 16-bit 'int'), just live with that and hope no o_id conflicts
       between objects or m_id conflicts between monsters arise */
    if (!svc.context.ident)
        svc.context.ident = unsigned(rnd(2) + 1);   /* id 1 is reserved */

    return res;
}

/* when splitting a stack that has o_id-based shop prices, pick an
   o_id value for the new stack that will maintain the same price */
function nextoid(oldobj, newobj) { /* unsigned */
    let olddif, newdif, trylimit = 256; /* limit of 4 suffices at present */
    let oid = unsigned(svc.context.ident - 1); /* loop increment will reverse -1 */

    olddif = oid_price_adjustment(oldobj, oldobj.o_id);
    do {
        ++oid;
        if (!oid) /* avoid using 0 (in case value wrapped) */
            ++oid;
        newdif = oid_price_adjustment(newobj, oid);
    } while (newdif != olddif && --trylimit >= 0);
    svc.context.ident = oid; /* update 'last ident used' */
    next_ident(); /* increment context.ident for next use */
    return oid; /* caller will use this ident */
}

/* try to find the stack obj was split from, then merge them back together;
   returns the combined object if unsplit is successful, null otherwise */
export function unsplitobj(obj) { /* struct obj * */
    const $frame = stack_frame(); try {
    let target_oid = 0;
    let oparent = stack_var(ptr_to(struct_obj), null), ochild = stack_var(ptr_to(struct_obj), null), list = null;

    /*
     * We don't operate on floor objects (we're following o->nobj rather
     * than o->nexthere), on free objects (don't know which list to use when
     * looking for obj's parent or child), on bill objects (too complicated,
     * not needed), or on buried or migrating objects (not needed).
     * [This could be improved, but at present additional generality isn't
     * necessary.]
     */
    switch (obj.where) {
    case OBJ_FREE:
    case OBJ_FLOOR:
    case OBJ_ONBILL:
    case OBJ_MIGRATING:
    case OBJ_BURIED:
    default:
        return null;
    case OBJ_INVENT:
        list = gi.invent;
        break;
    case OBJ_MINVENT:
        list = obj.v.v_ocarry.minvent;
        break;
    case OBJ_CONTAINED:
        list = obj.v.v_ocontainer.cobj;
        break;
    }

    /* first try the expected case; obj is split from another stack */
    if (obj.o_id == svc.context.objsplit.child_oid) {
        /* parent probably precedes child and will require list traversal */
        ochild[0] = obj;
        target_oid = svc.context.objsplit.parent_oid;
        if (obj.nobj && obj.nobj.o_id == target_oid)
            oparent[0] = obj.nobj;
    } else if (obj.o_id == svc.context.objsplit.parent_oid) {
        /* alternate scenario: another stack was split from obj;
           child probably follows parent and will be found here */
        oparent[0] = obj;
        target_oid = svc.context.objsplit.child_oid;
        if (obj.nobj && obj.nobj.o_id == target_oid)
            ochild[0] = obj.nobj;
    }
    /* if we have only half the split, scan obj's list to find other half */
    if (ochild[0] && !oparent[0]) {
        /* expected case */
        for (obj = list; obj; obj = obj.nobj)
            if (obj.o_id == target_oid) {
                oparent[0] = obj;
                break;
            }
    } else if (oparent[0] && !ochild[0]) {
        /* alternate scenario */
        for (obj = list; obj; obj = obj.nobj)
            if (obj.o_id == target_oid) {
                ochild[0] = obj;
                break;
            }
    }
    /* if we have both parent and child, try to merge them;
       if successful, return the combined stack, otherwise return null */
    return (oparent[0] && ochild[0] && merged(oparent, ochild)) ? oparent[0] : null;
    } finally { stack_pop($frame); }
}

/* reset splitobj()/unsplitobj() context */
export function clear_splitobjs() { /* void */
    svc.context.objsplit.parent_oid = svc.context.objsplit.child_oid = 0;
}

/*
 * Insert otmp right after obj in whatever chain(s) it is on.  Then extract
 * obj from the chain(s).  This function does a literal swap.  It is up to
 * the caller to provide a valid context for the swap.  When done, obj will
 * still exist, but not on any chain.
 *
 * Note:  Don't use obj_extract_self() -- we are doing an in-place swap,
 * not actually moving something.
 */
export function replace_object(obj, otmp) { /* void */
    otmp.where = obj.where;
    switch (obj.where) {
    case OBJ_FREE:
        /* do nothing */
        break;
    case OBJ_INVENT:
        otmp.nobj = obj.nobj;
        obj.nobj = otmp;
        extract_nobj(obj, ref_of(gi, "invent"));
        break;
    case OBJ_CONTAINED:
        otmp.nobj = obj.nobj;
        otmp.v.v_ocontainer = obj.v.v_ocontainer;
        obj.nobj = otmp;
        extract_nobj(obj, ref_of(obj.v.v_ocontainer, "cobj"));
        break;
    case OBJ_MINVENT:
        otmp.nobj = obj.nobj;
        otmp.v.v_ocarry = obj.v.v_ocarry;
        obj.nobj = otmp;
        extract_nobj(obj, ref_of(obj.v.v_ocarry, "minvent"));
        break;
    case OBJ_FLOOR:
        otmp.nobj = obj.nobj;
        otmp.v.v_nexthere = obj.v.v_nexthere;
        otmp.ox = obj.ox;
        otmp.oy = obj.oy;
        obj.nobj = otmp;
        obj.v.v_nexthere = otmp;
        extract_nobj(obj, ref_of(svl.level, "objlist"));
        extract_nexthere(obj, svl.level.objects[obj.ox].subarray(obj.oy));
        break;
    default:
        panic(_("replace_object: obj position"));
        break;
    }
}

/* is 'obj' inside a container whose contents aren't known?
   if so, return the outermost container meeting that criterium */
export function unknwn_contnr_contents(obj) { /* struct obj * */
    let result = null, parent;

    while (obj.where == OBJ_CONTAINED) {
        parent = obj.v.v_ocontainer;
        if (!parent.cknown)
            result = parent;
        obj = parent;
    }
    return result;
}

/*
 * Create a dummy duplicate to put on shop bill.  The duplicate exists
 * only in the billobjs chain.  This function is used when a shop object
 * is being altered, and a copy of the original is needed for billing
 * purposes.  For example, when eating, where an interruption will yield
 * an object which is different from what it started out as; the "I x"
 * command needs to display the original object.
 *
 * The caller is responsible for checking otmp->unpaid and
 * costly_spot(u.ux, u.uy).  This function will make otmp no charge.
 *
 * Note that check_unpaid_usage() should be used instead for partial
 * usage of an object.
 */
export function bill_dummy_object(otmp) { /* void */
    let dummy;
    let cost = 0;

    if (otmp.unpaid) {
        cost = unpaid_cost(otmp, COST_SINGLEOBJ);
        subfrombill(otmp, shop_keeper(chars[u.ushops]));
    }
    dummy = newobj();
    struct_assign(dummy, otmp);
    dummy.oextra = null;
    dummy.where = OBJ_FREE;
    dummy.o_id = nextoid(otmp, dummy);
    dummy.timed = 0;
    copy_oextra(dummy, otmp);
    if (has_omid(dummy))
        free_omid(dummy); /* only one association with m_id */
    if (Is_candle(dummy))
        dummy.lamplit = 0;
    dummy.owornmask = 0; /* dummy object is not worn */
    addtobill(dummy, FALSE, TRUE, TRUE);
    if (cost && dummy.where != OBJ_DELETED)
        alter_cost(dummy, -cost);
    /* no_charge is only valid for some locations */
    otmp.no_charge = (otmp.where == OBJ_FLOOR
                       || otmp.where == OBJ_CONTAINED) ? 1 : 0;
    otmp.unpaid = 0;
    return;
}

/* alteration types; must match COST_xxx macros in hack.h */
const alteration_verbs = static_array("alteration_verbs", ptr_to(char), null, [
    _("cancel"), _("drain"), _("uncharge"), _("unbless"), _("uncurse"), _("disenchant"),
    _("degrade"), _("dilute"), _("erase"), _("burn"), _("neutralize"), _("destroy"), _("splatter"),
    _("bite"), _("open"), _("break the lock on"), _("rust"), _("rot"), _("tarnish"), _("crack"),
]);

/* possibly bill for an object which the player has just modified */
export function costly_alteration(obj, alter_type) { /* void */
    const $frame = stack_frame(); try {
    let ox = stack_var(coordxy), oy = stack_var(coordxy);
    let objroom;
    let learn_bknown;
    let those, them;
    let shkp = stack_var(ptr_to(struct_monst), null);

    if (alter_type < 0 || alter_type >= SIZE(alteration_verbs)) {
        impossible(_("invalid alteration type (%d)"), alter_type);
        alter_type = 0;
    }

    ox[0] = oy[0] = 0;    /* lint suppression */
    objroom = ord('\0'); /* ditto */
    if (carried(obj) || obj.where == OBJ_FREE) {
        /* OBJ_FREE catches obj_no_longer_held()'s transformation
           of crysknife back into worm tooth; the object has been
           removed from inventory but not necessarily placed at
           its new location yet--the unpaid flag will still be set
           if this item is owned by a shop */
        if (!obj.unpaid)
            return;
    } else {
        /* this get_obj_location shouldn't fail, but if it does,
           use hero's location */
        if (!get_obj_location(obj, ox, oy, CONTAINED_TOO))
            ox[0] = u.ux, oy[0] = u.uy;
        if (!costly_spot(ox[0], oy[0]))
            return;
        objroom = chars[in_rooms(ox[0], oy[0], SHOPBASE)];
        /* if no shop cares about it, we're done */
        if (!billable(shkp, obj, objroom, FALSE))
            return;
    }

    if (obj.quan == 1)
        those = _("that"), them = _("it");
    else
        those = _("those"), them = _("them");

    /* when shopkeeper describes the object as being uncursed or unblessed
       hero will know that it is now uncursed; will also make the feedback
       from `I x' after bill_dummy_object() be more specific for this item */
    learn_bknown = +(alter_type == COST_UNCURS || alter_type == COST_UNBLSS);

    switch (obj.where) {
    case OBJ_FREE: /* obj_no_longer_held() */
    case OBJ_INVENT:
        if (learn_bknown)
            set_bknown(obj, 1);
        if (shkp[0]) {
               ;
        }
        verbalize(_("You %s %s %s, you pay for %s!"),
                  alteration_verbs[alter_type], those, simpleonames(obj),
                  them);
        bill_dummy_object(obj);
        break;
    case OBJ_FLOOR:
        if (learn_bknown)
            obj.bknown = 1; /* ok to bypass set_bknown() here */
        if (costly_spot(u.ux, u.uy) && objroom == chars[u.ushops]) {
            if (shkp[0]) {
                   ;
            }
            verbalize(_("You %s %s, you pay for %s!"),
                      alteration_verbs[alter_type], those, them);
            bill_dummy_object(obj);
        } else {
            stolen_value(obj, ox[0], oy[0], FALSE, FALSE);
        }
        break;
    }
    } finally { stack_pop($frame); }
}

const dknowns = static_array("dknowns", char, null, [ WAND_CLASS,   RING_CLASS, POTION_CLASS,
                                SCROLL_CLASS, GEM_CLASS,  SPBOOK_CLASS,
                                WEAPON_CLASS, TOOL_CLASS, VENOM_CLASS, 0 ]);

/* set obj->dknown to 0 for most types of objects, to 1 otherwise;
   split off from unknow_object() */
export function clear_dknown(obj) { /* void */
    /* note: this is an unobserving not an observing, so don't call
       observe_object even if dknown is being set to 1 */
    obj.dknown = strchr(dknowns, obj.oclass) ? 0 : 1;
    if ((obj.otyp >= ELVEN_SHIELD && obj.otyp <= ORCISH_SHIELD)
        || obj.otyp == SHIELD_OF_REFLECTION
        || objects[obj.otyp].oc_merge)
        obj.dknown = 0;
    /* globs always have dknown flag set (to maximize merging) but for new
       object, globby flag won't be set yet so isn't available to check */
    if (Is_pudding(obj))
        obj.dknown = 1;
}

/* some init for a brand new object, or partial re-init when hero loses
   potentially known info about an object (called when an unseen monster
   picks up or uses it); moved from invent.c to here for access to dknowns */
export function unknow_object(obj) { /* void */
    clear_dknown(obj); /* obj->dknown = 0; */

    obj.bknown = obj.rknown = 0;
    obj.cknown = obj.lknown = 0;
    obj.tknown = 0;
    /* for an existing object, awareness of charges or enchantment has
       gone poof...  [object types which don't use the known flag have
       it set True for some reason] */
    obj.known = objects[obj.otyp].oc_uses_known ? 0 : 1;
}

/* do some initialization to newly created object; otyp must already be set */
function mksobj_init(obj, artif) { /* void */
    let mndx, tryct;
    let otmp = obj[0];
    let let_ = objects[otmp.otyp].oc_class;

    switch (let_) {
    case WEAPON_CLASS:
        otmp.quan = is_multigen(otmp) ? rn1(6, 6) : 1;
        if (!rn2(11)) {
            otmp.spe = rne(3);
            otmp.blessed = unsigned(rn2(2));
        } else if (!rn2(10)) {
            curse(otmp);
            otmp.spe = -rne(3);
        } else
            blessorcurse(otmp, 10);
        if (is_poisonable(otmp) && !rn2(100))
            otmp.otrapped = 1;

        if (artif && !rn2(20 + (10 * nartifact_exist()))) {
            /* mk_artifact() with otmp and A_NONE will never return NULL */
            otmp = mk_artifact(otmp, A_NONE, 99, TRUE);
            obj[0] = otmp;
        }
        break;
    case FOOD_CLASS:
        otmp.oeaten = 0;
        switch (otmp.otyp) {
        case CORPSE:
            /* possibly overridden by mkcorpstat() */
            tryct = 50;
            do
                otmp.corpsenm = undead_to_corpse(rndmonnum());
            while ((svm.mvitals[otmp.corpsenm].mvflags & G_NOCORPSE)
                   && (--tryct > 0));
            if (tryct == 0) {
                /* perhaps rndmonnum() only wants to make G_NOCORPSE
                   monsters on this svl.level; create an adventurer's
                   corpse instead, then */
                otmp.corpsenm = PM_HUMAN;
            }
            /* timer set below */
            break;
        case EGG:
            otmp.corpsenm = NON_PM; /* generic egg */
            if (!rn2(3))
                for (tryct = 200; tryct > 0; --tryct) {
                    mndx = can_be_hatched(rndmonnum());
                    if (mndx != NON_PM && !dead_species(mndx, TRUE)) {
                        otmp.corpsenm = mndx; /* typed egg */
                        break;
                    }
                }
            /* timer set below */
            break;
        case TIN:
            otmp.corpsenm = NON_PM; /* empty (so far) */
            if (!rn2(6))
                set_tin_variety(otmp, SPINACH_TIN);
            else
                for (tryct = 200; tryct > 0; --tryct) {
                    mndx = undead_to_corpse(rndmonnum());
                    if (mons[mndx].cnutrit
                        && !(svm.mvitals[mndx].mvflags & G_NOCORPSE)) {
                        otmp.corpsenm = mndx;
                        set_tin_variety(otmp, RANDOM_TIN);
                        break;
                    }
                }
            blessorcurse(otmp, 10);
            break;
        case SLIME_MOLD:
            otmp.spe = svc.context.current_fruit;
            flags.made_fruit = TRUE;
            break;
        case KELP_FROND:
            otmp.quan = rnd(2);
            break;
        case CANDY_BAR:
            /* set otmp->spe */
            assign_candy_wrapper(otmp);
            break;
        default:
            break;
        }
        if (Is_pudding(otmp)) {
            otmp.globby = 1;
            /* for emphasis; glob quantity is always 1 and weight varies
               when other globs coalesce with it or this one shrinks */
            otmp.quan = 1;
            /* 5.0: globs in 3.6.x left owt as 0 and let weight() fix
               that up during 'obj->owt = weight(obj)' below, but now
               we initialize glob->owt explicitly so weight() doesn't
               need to perform any fix up and returns glob->owt as-is */
            otmp.owt = objects[otmp.otyp].oc_weight;
            /* dknown, but not observed */
            otmp.known = otmp.dknown = 1;
            otmp.corpsenm = PM_GRAY_OOZE + (otmp.otyp - GLOB_OF_GRAY_OOZE);
            start_glob_timeout(otmp, 0);
        } else {
            if (otmp.otyp != CORPSE && otmp.otyp != MEAT_RING
                && otmp.otyp != KELP_FROND && !rn2(6)) {
                otmp.quan = 2;
            }
        }
        break;
    case GEM_CLASS:
        otmp.corpsenm = 0; /* LOADSTONE hack */
        if (otmp.otyp == LOADSTONE)
            curse(otmp);
        else if (otmp.otyp == ROCK)
            otmp.quan = rn1(6, 6);
        else if (otmp.otyp != LUCKSTONE && !rn2(6))
            otmp.quan = 2;
        else
            otmp.quan = 1;
        break;
    case TOOL_CLASS:
        switch (otmp.otyp) {
        case TALLOW_CANDLE:
        case WAX_CANDLE:
            otmp.spe = 1;
            otmp.age = 20 * /* 400 or 200 */
                        (objects[otmp.otyp].oc_cost);
            otmp.lamplit = 0;
            otmp.quan = 1 + (rn2(2) ? rn2(7) : 0);
            blessorcurse(otmp, 5);
            break;
        case BRASS_LANTERN:
        case OIL_LAMP:
            otmp.spe = 1;
            otmp.age = rn1(500, 1000);
            otmp.lamplit = 0;
            blessorcurse(otmp, 5);
            break;
        case MAGIC_LAMP:
            otmp.spe = 1;
            otmp.lamplit = 0;
            blessorcurse(otmp, 2);
            break;
        case CHEST:
        case LARGE_BOX:
            otmp.olocked = +!!rn2(5);
            otmp.otrapped = +!rn2(10);
            otmp.tknown = (otmp.otrapped && !rn2(100) ? 1 : 0); /* obvious trap */
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case ICE_BOX:
        case SACK:
        case OILSKIN_SACK:
        case BAG_OF_HOLDING:
            mkbox_cnts(otmp);
            break;
        case EXPENSIVE_CAMERA:
        case TINNING_KIT:
        case MAGIC_MARKER:
            otmp.spe = rn1(70, 30);
            break;
        case CAN_OF_GREASE:
            otmp.spe = rn1(21, 5); /* 0..20 + 5 => 5..25 */
            blessorcurse(otmp, 10);
            break;
        case CRYSTAL_BALL:
            otmp.spe = rn1(5, 3); /* 0..4 + 3 => 3..7 */
            blessorcurse(otmp, 2);
            break;
        case HORN_OF_PLENTY:
        case BAG_OF_TRICKS:
            otmp.spe = rn1(18, 3); /* 0..17 + 3 => 3..20 */
            break;
        case FIGURINE:
            tryct = 0;
            /* figurines are slightly harder monsters */
            do
                otmp.corpsenm = rndmonnum_adj(5, 10);
            while (is_human(mons[otmp.corpsenm]) && tryct++ < 30);
            blessorcurse(otmp, 4);
            break;
        case BELL_OF_OPENING:
            otmp.spe = 3;
            break;
        case MAGIC_FLUTE:
        case MAGIC_HARP:
        case FROST_HORN:
        case FIRE_HORN:
        case DRUM_OF_EARTHQUAKE:
            otmp.spe = rn1(5, 4);
            break;
        }
        break;
    case AMULET_CLASS:
        if (otmp.otyp == AMULET_OF_YENDOR)
            svc.context.made_amulet = TRUE;
        if (rn2(10) && (otmp.otyp == AMULET_OF_STRANGULATION
                        || otmp.otyp == AMULET_OF_CHANGE
                        || otmp.otyp == AMULET_OF_RESTFUL_SLEEP)) {
            curse(otmp);
        } else
            blessorcurse(otmp, 10);
        break;
    case VENOM_CLASS:
    case CHAIN_CLASS:
    case BALL_CLASS:
        break;
    case POTION_CLASS: /* note: potions get some additional init below */
    case SCROLL_CLASS:

        if (otmp.otyp != SCR_MAIL)

            blessorcurse(otmp, 4);
        break;
    case SPBOOK_CLASS:
        otmp.usecount = 0;
        blessorcurse(otmp, 17);
        break;
    case ARMOR_CLASS:
        if (rn2(10)
            && (otmp.otyp == FUMBLE_BOOTS
                || otmp.otyp == LEVITATION_BOOTS
                || otmp.otyp == HELM_OF_OPPOSITE_ALIGNMENT
                || otmp.otyp == GAUNTLETS_OF_FUMBLING || !rn2(11))) {
            curse(otmp);
            otmp.spe = -rne(3);
        } else if (!rn2(10)) {
            otmp.blessed = unsigned(rn2(2));
            otmp.spe = rne(3);
        } else
            blessorcurse(otmp, 10);
        if (artif && !rn2(40 + (10 * nartifact_exist()))) {
            /* mk_artifact() with otmp and A_NONE will never return NULL */
            otmp = mk_artifact(otmp, A_NONE, 99, TRUE);
            obj[0] = otmp;
        }
        /* simulate lacquered armor for samurai */
        if (Role_if(PM_SAMURAI) && otmp.otyp == SPLINT_MAIL
            && (svm.moves <= 1 || In_quest(u.uz))) {
            otmp.oerodeproof = otmp.rknown = 1;
        }
        break;
    case WAND_CLASS:
        if (otmp.otyp == WAN_WISHING)
            otmp.spe = 1;
        else if (otmp.otyp == WAN_STASIS)
            /* just as easy to recharge as other NODIR wands, but starts with
               fewer charges */
            otmp.spe = rn1(4, 3);
        else
            otmp.spe = rn1(5,
                            (objects[otmp.otyp].oc_dir == NODIR) ? 11 : 4);
        blessorcurse(otmp, 17);
        otmp.recharged = 0; /* used to control recharging */
        break;
    case RING_CLASS:
        if (objects[otmp.otyp].oc_charged) {
            blessorcurse(otmp, 3);
            if (rn2(10)) {
                if (rn2(10) && bcsign(otmp))
                    otmp.spe = bcsign(otmp) * rne(3);
                else
                    otmp.spe = rn2(2) ? rne(3) : -rne(3);
            }
            /* make useless +0 rings much less common */
            if (otmp.spe == 0)
                otmp.spe = rn2(4) - rn2(3);
            /* negative rings are usually cursed */
            if (otmp.spe < 0 && rn2(5))
                curse(otmp);
        } else if (rn2(10) && (otmp.otyp == RIN_TELEPORTATION
                               || otmp.otyp == RIN_POLYMORPH
                               || otmp.otyp == RIN_AGGRAVATE_MONSTER
                               || otmp.otyp == RIN_HUNGER || !rn2(9))) {
            curse(otmp);
        }
        break;
    case ROCK_CLASS:
        if (otmp.otyp == STATUE) {
            /* possibly overridden by mkcorpstat() */
            otmp.corpsenm = rndmonnum();
            if (!verysmall(mons[otmp.corpsenm])
                && rn2(Math.trunc(level_difficulty() / 2) + 10) > 10)
                add_to_container(otmp, /* caller will update owt */
                                        mkobj(SPBOOK_no_NOVEL, FALSE));
        }
        /* boulder init'd below in the 'regardless of !init' code */
        break;
    case COIN_CLASS:
        break; /* do nothing */
    default:
        /* 3.6.3: this used to be impossible() followed by return 0
           but most callers aren't prepared to deal with Null result
           and cluttering them up to do so is pointless */
        panic(_("mksobj tried to make type %d, class %d."),
              otmp.otyp, (objects[otmp.otyp].oc_class));
        /*NOTREACHED*/
    }

    mkobj_erosions(otmp);
    if (permapoisoned(otmp))
        otmp.otrapped = 1;
}

/* mksobj(): create a specific type of object; result is always non-Null */
export function mksobj(otyp, init, artif) { /* struct obj * */
    const $frame = stack_frame(); try {
    let otmp = stack_var(ptr_to(struct_obj));
    let let_ = objects[otyp].oc_class;

    otmp[0] = newobj();
    struct_assign(otmp[0], cg.zeroobj);
    otmp[0].age = max(svm.moves, 1);
    otmp[0].o_id = next_ident();
    otmp[0].quan = 1;
    otmp[0].oclass = let_;
    otmp[0].otyp = otyp;
    otmp[0].where = OBJ_FREE;
    unknow_object(otmp[0]); /* set up dknown and known: non-0 for some things */
    otmp[0].corpsenm = NON_PM;
    otmp[0].lua_ref_cnt = 0;
    otmp[0].pickup_prev = 0;

    if (init)
        mksobj_init(otmp, artif);

    /* some things must get done (corpsenm, timers) even if init = 0 */
    switch ((otmp[0].oclass == POTION_CLASS && otmp[0].otyp != POT_OIL)
            ? POT_WATER
            : otmp[0].otyp) {
    case CORPSE:
        if (otmp[0].corpsenm == NON_PM) {
            otmp[0].corpsenm = undead_to_corpse(rndmonnum());
            if (svm.mvitals[otmp[0].corpsenm].mvflags & (G_NOCORPSE | G_GONE))
                otmp[0].corpsenm = gu.urole.mnum;
        }
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case STATUE:
    case FIGURINE:
        if (otmp[0].corpsenm == NON_PM)
            otmp[0].corpsenm = rndmonnum();
        if (otmp[0].corpsenm != NON_PM) {
            let ptr = mons[otmp[0].corpsenm];

            otmp[0].spe = (is_neuter(ptr) ? CORPSTAT_NEUTER
                         : is_female(ptr) ? CORPSTAT_FEMALE
                           : is_male(ptr) ? CORPSTAT_MALE
                             : rn2(2) ? CORPSTAT_FEMALE : CORPSTAT_MALE);
        }
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case EGG:
    /* case TIN: */
        set_corpsenm(otmp[0], otmp[0].corpsenm);
        break;
    case BOULDER:
        /* next_boulder overloads corpsenm so the default value is NON_PM;
           since that is non-zero, the "next boulder" case in xname() would
           happen when it shouldn't; explicitly set it to 0 */
        otmp[0].corpsenm = 0;
        break;
    case POT_OIL:
        otmp[0].age = MAX_OIL_IN_FLASK; /* amount of oil */
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case POT_WATER: /* POTION_CLASS */
        otmp[0].corpsenm = 0; /* overloads corpsenm, which was set to NON_PM */
        break;
    case LEASH:
        otmp[0].corpsenm = 0; /* overloads corpsenm, which was set to NON_PM */
        break;
    case SPE_NOVEL:
        otmp[0].corpsenm = -1; /* "none of the above"; will be changed */
        otmp[0] = oname(otmp[0], noveltitle(ref_of(otmp[0], "corpsenm")), ONAME_NO_FLAGS);
        break;
    }

    /* unique objects may have an associated artifact entry */
    if (objects[otyp].oc_unique && !otmp[0].oartifact) {
        /* mk_artifact() with otmp and A_NONE will never return NULL */
        otmp[0] = mk_artifact(otmp[0], A_NONE, 99, FALSE);
    }
    otmp[0].owt = unsigned(weight(otmp[0]));
    return otmp[0];
    } finally { stack_pop($frame); }
}

/* potential mimic shapes that should be undone by stone-to-flesh;
   not used for objects that will be transformed when hit by stone-to-flesh */
export function stone_object_type(mappearance) { /* boolean */
    let otyp = int(mappearance);

    /* we exclude wands, rings, and gems even though some qualify as stone;
       there aren't any weapons or armor classified as made out of stone */
    return +(otyp == BOULDER || otyp == STATUE || otyp == FIGURINE);
}

/* possible mimic shapes that are affected by stone-to-flesh;
   mappearance for furniture is a display symbol rather than a terrain type */
export function stone_furniture_type(mappearance) { /* boolean */
    let sym = int(mappearance);

    switch (sym) {
    case S_upstair:
    case S_dnstair:
    case S_brupstair:
    case S_brdnstair:
    case S_altar:
    case S_throne:
    case S_sink: /* stone sink is iffy; metal might be more appropriate */
        return TRUE;
    default:
        if (sym >= S_vwall && sym <= S_trwall)
            return TRUE;
        break;
    }
    return FALSE;
}

/*
 * Several areas of the code made direct reassignments
 * to obj->corpsenm.  Because some special handling is
 * required in certain cases, place that handling here
 * and call this routine in place of the direct assignment.
 *
 * If the object was a lizard or lichen corpse:
 *     - ensure that you don't end up with some
 *       other corpse type which has no rot-away timer.
 *
 * If the object was a troll corpse:
 *     - ensure that you don't end up with some other
 *       corpse type which resurrects from the dead.
 *
 * Re-calculates the weight of figurines and corpses to suit the
 * new species.
 *
 * Existing timeout value for egg hatch is preserved.
 *
 */
export function set_corpsenm(obj, id) { /* void */
    let old_id = obj.corpsenm;
    let when = 0;

    if (obj.timed) {
        if (obj.otyp == EGG) {
            when = stop_timer(HATCH_EGG, obj_to_any(obj));
        } else {
            when = 0;
            obj_stop_timers(obj); /* corpse or figurine */
        }
    }
    /* oeaten is used to determine how much nutrition is left in
       multiple-bite food and also used to derive how many hit points
       a creature resurrected from a partly eaten corpse gets; latter
       is of interest when a <foo> corpse revives as a <foo> zombie
       in case they are defined with different mons[].cnutrit values */
    if (obj.otyp == CORPSE && obj.oeaten != 0
        /* when oeaten is non-zero, index old_id can't be NON_PM
           and divisor mons[old_id].cnutrit can't be zero */
        && mons[old_id].cnutrit != mons[id].cnutrit) {
        /* oeaten and cnutrit are unsigned; theoretically that could
           be 16 bits and the calculation might overflow, so force long */
        obj.oeaten = unsigned(Math.trunc(obj.oeaten
                                  * (mons[id].cnutrit)
                                  / (mons[old_id].cnutrit)));
    }

    obj.corpsenm = id;
    switch (obj.otyp) {
    case CORPSE:
        start_corpse_timeout(obj);
        obj.owt = unsigned(weight(obj));
        break;
    case FIGURINE:
        if (obj.corpsenm != NON_PM && !dead_species(obj.corpsenm, TRUE)
            && (carried(obj) || mcarried(obj)))
            attach_fig_transform_timeout(obj);
        obj.owt = unsigned(weight(obj));
        break;
    case EGG:
        if (obj.corpsenm != NON_PM && !dead_species(obj.corpsenm, TRUE))
            attach_egg_hatch_timeout(obj, when);
        break;
    default: /* tin, etc. */
        obj.owt = unsigned(weight(obj));
        break;
    }
}

/* Return the number of turns after which a Rider corpse revives */
export function rider_revival_time(body, retry) { /* long long */
    let when;
    let minturn = retry ? 3 : (body.corpsenm == PM_DEATH) ? 6 : 12;

    /* Riders have a 1/3 chance per turn of reviving after 12, 6, or 3 turns.
       Always revive by 67. */
    for (when = minturn; when < 67; when++)
        if (!rn2(3))
            break;
    return when;
}

/*
 * Start a corpse decay or revive timer.
 * This takes the age of the corpse into consideration as of 3.4.0.
 */
export function start_corpse_timeout(body) { /* void */
    let when;       /* rot away when this old */
    let age;        /* age of corpse          */
    let rot_adjust;
    let action;

    /*
     * Note:
     *      if body->norevive is set, the corpse will rot away instead
     *      of revive when its REVIVE_MON timer finishes.
     */

    /* lizards and lichen don't rot or revive */
    if (body.corpsenm == PM_LIZARD || body.corpsenm == PM_LICHEN)
        return;

    action = ROT_CORPSE;               /* default action: rot away */
    rot_adjust = gi.in_mklev ? 25 : 10; /* give some variation */
    age = max(svm.moves, 1) - body.age;
    if (age > ROT_AGE)
        when = rot_adjust;
    else
        when = ROT_AGE - age;
    when += (rnz(rot_adjust) - rot_adjust);

    if (is_rider(mons[body.corpsenm])) {
        action = REVIVE_MON;
        when = rider_revival_time(body, FALSE);
    } else if (mons[body.corpsenm].mlet == S_TROLL) {
        for (age = 2; age <= TAINT_AGE; age++)
            if (!rn2(TROLL_REVIVE_CHANCE)) { /* troll revives */
                action = REVIVE_MON;
                when = age;
                break;
            }
    } else if (gz.zombify && zombie_form(mons[body.corpsenm]) != NON_PM
               && !body.oeroded2) {
        action = ZOMBIFY_MON;
        when = rn1(15, 5); /* 5..19 */
    }

    start_timer(when, TIMER_OBJECT, action, obj_to_any(body));
}

/* used by item_on_ice() and shrink_glob() */

    const NOT_ON_ICE = 0;
    const SET_ON_ICE = 1;
    const BURIED_UNDER_ICE = 2;

/* used by shrink_glob(); is 'item' or enclosing container on or under ice? */
function item_on_ice(item) { /* int */
    const $frame = stack_frame(); try {
    let otmp;
    let ox = stack_var(coordxy), oy = stack_var(coordxy);

    otmp = item;
    /* if in a container, it might be nested so find outermost one since
       that's the item whose location needs to be checked */
    while (otmp.where == OBJ_CONTAINED)
        otmp = otmp.v.v_ocontainer;

    if (get_obj_location(otmp, ox, oy, BURIED_TOO)) {
        switch (otmp.where) {
        case OBJ_FLOOR:
            if (is_ice(ox[0], oy[0]))
                return SET_ON_ICE;
            break;
        case OBJ_BURIED:
            if (is_ice(ox[0], oy[0]))
                return BURIED_UNDER_ICE;
            break;
        default:
            break;
        }
    }
    return NOT_ON_ICE;
    } finally { stack_pop($frame); }
}

/* schedule a timer that will shrink the target glob by 1 unit of weight */
export function start_glob_timeout(
    obj,
    when) { /* void */ /* when to shrink; if 0L, use random value close to 25 */
    if (!obj.globby) {
        impossible(_("start_glob_timeout for non-glob [%d: %s]?"),
                   obj.otyp, simpleonames(obj));
        return; /* skip timer creation */
    }
    /* sanity precaution */
    if (obj.timed)
        stop_timer(SHRINK_GLOB, obj_to_any(obj));

    if (when < 1) /* caller usually passes 0L; should never be negative */
        when = 25 + rn2(5) - 2; /* 25+[0..4]-2 => 23..27, avg 25 */
    /* 1 new glob weighs 20 units and loses 1 unit every 25 turns,
       so lasts for 500 turns, twice as long as the average corpse */
    start_timer(when, TIMER_OBJECT, SHRINK_GLOB, obj_to_any(obj));
}

/* globs have quantity 1 and size which varies by multiples of 20 in owt;
   they don't become tainted with age, but every 25 turns this timer runs
   and reduces owt by 1; when it hits 0, destroy the glob (if some other
   part of the program destroys it, the timer will be cancelled);
   note: timer keeps going if an object gets buried or scheduled to
   migrate to another level and can delete the glob in those states */
export function shrink_glob(
    arg,
    expire_time) { /* void */ /* turn the timer should have gone off; if less than * current 'moves', we're making up for lost time * after leaving and then returning to this level */
    const $frame = stack_frame(); try {
    let globnambuf = stack_array(char, BUFSZ);
    let obj = arg.a_obj;
    let globloc = item_on_ice(obj);
    let ininv = +(obj.where == OBJ_INVENT),
            shrink = FALSE, gone = FALSE, updinv = FALSE;
    let contnr = (obj.where == OBJ_CONTAINED) ? obj.v.v_ocontainer : null,
               topcontnr = null;
    let old_top_owt = 0;

    if (!obj.globby) {
        impossible(_("shrink_glob for non-glob [%d: %s]?"),
                   obj.otyp, simpleonames(obj));
        return; /* old timer is gone, don't start a new one */
    }
    /* note: if check_glob() complains about a problem, the " obj " here
       will be replaced in the feedback with info about this glob */
    check_glob(obj, _("shrink obj "));

    /*
     * If shrinkage occurred while we were on another level, catch up now.
     */
    if (expire_time < svm.moves && globloc != BURIED_UNDER_ICE) {
        /* number of units of weight to remove */
        let delta = Math.trunc((svm.moves - expire_time + 24) / 25),

             moddelta = 25 - (delta % 25);

        if (globloc == SET_ON_ICE)
            delta = Math.trunc((delta + 2) / 3);

        if (delta >= obj.owt) {
            /* gone; no newsym() or message here--forthcoming map update for
               level arrival is all that's needed */
            obj.owt = 0; /* not required; accurately reflects obj's state */
            shrinking_glob_gone(obj);
        } else {
            /* shrank but not gone; reduce remaining weight */
            obj.owt -= unsigned(delta);
            /* when contained, update container's weight (recursively if
               nested); won't be in a container carried by hero (since
               catching up for lost time never applies in that situation)
               but might be in one on floor or one carried by a monster */
            if (contnr)
                container_weight(contnr);
            /* resume regular shrinking */
            start_glob_timeout(obj, moddelta);
        }
        return;
    }

    /*
     * When on ice, only shrink every third try.  If buried under ice,
     * don't shrink at all, similar to being contained in an ice box
     * except that the timer remains active.  [FIXME:  stop the timer
     * for obj in pool that becomes frozen, restart it if/when unburied.]
     *
     * If the glob is actively being eaten by hero, skip weight reduction
     * to avoid messing up the context.victual data (if/when eaten by a
     * monster, timer won't have a chance to run before meal is finished).
     */
    if (eating_glob(obj)
        || globloc == BURIED_UNDER_ICE
        || (globloc == SET_ON_ICE && (svm.moves % 3) == 1)) {
        /* schedule next shrink attempt; for the being eaten case, the
           glob and its timer might be deleted before this kicks in */
        start_glob_timeout(obj, 0);
        return;
    }

    /* format "Your/Shk's/The [partly eaten] glob of <goo>" into
       globnambuf[] before shrinking the glob; Yname2() calls yname()
       which calls xname() which ordinarily leaves "partly eaten" to
       doname() rather than inserting that itself; ask xname() to add
       that when appropriate */
    iflags.partly_eaten_hack = TRUE;
    strcpy(globnambuf, Yname2(obj));
    iflags.partly_eaten_hack = FALSE;

    if (obj.owt > 0) { /* sanity precaution */
        /* globs start out weighing 20 units; give two messages per glob,
           when going from 20 to 19 and from 10 to 9; a different message
           is given for going from 1 to 0 (gone) */
        let basewt = objects[obj.otyp].oc_weight,
                 msgwt = Math.trunc(unsigned(max(basewt, 1) + 1) / 2); /* 10 */

        shrink = +((obj.owt % msgwt) == 0);
        obj.owt -= 1;
        /* if glob is partly eaten, reduce the amount still available (but
           not all the way to 0 which would change it back to untouched) */
        if (obj.oeaten > 1)
            obj.oeaten -= 1;
    }
    gone = +!obj.owt;

    /* timer might go off when the glob is migrating to another level and
       possibly delete it; messages are only given for in-open-inventory,
       inside-container-in-invent, and going away when can-see-on-floor */
    if (ininv) {
        if (shrink || gone)
            pline(_("%s %s."), globnambuf,
                  /* globs always have quantity 1 so we don't need otense()
                     because the verb always references a singular item */
                  gone ? _("dissolves completely") : _("shrinks"));
        updinv = TRUE;
    } else if (contnr) {
        /* when in a container, it might be nested so find outermost one */
        topcontnr = contnr;
        while (topcontnr.where == OBJ_CONTAINED)
            topcontnr = topcontnr.v.v_ocontainer;
        /* obj's weight has been reduced, but weight(s) of enclosing
           container(s) haven't been adjusted for that yet */
        old_top_owt = topcontnr.owt;
        /* update those weights now; recursively updates nested containers */
        container_weight(contnr);

        if (topcontnr.where == OBJ_INVENT) {
            /* for regular containers, the weight will always be reduced
               when glob's weight has been reduced but we only say so
               when shrinking beneath a particular threshold (N*20 to
               (N-1)*20 + 19 or (N-1)*20 + 10 to (N-1)*20 + 9), or
               if we're going to report a change in carrying capacity;
               for a non-cursed bag of holding the total weight might not
               change because only a fraction of glob's weight is counted;
               however, always say the bag is lighter for the 'gone' case */
            if (gone || (shrink && topcontnr.owt != old_top_owt)
                || near_capacity() != go.oldcap)
                pline(_("%s %s%s lighter."), Yname2(topcontnr),
                      /* containers also always have quantity 1 */
                      (topcontnr.owt != old_top_owt) ? _("becomes") : _("seems"),
                      /* TODO?  maybe also skip "slightly" if description
                         is changing (from "very large" to "large",
                         "large" to "medium", or "medium to "small") */
                      !gone ? _(" slightly") : _(""));
            updinv = TRUE;
        }
    }

    if (gone) {
        let ox = stack_var(coordxy, 0), oy = stack_var(coordxy, 0);
        /* check location for visibility before destroying obj */
        let seeit = (obj.where == OBJ_FLOOR
                         && get_obj_location(obj, ox, oy, 0)
                         && cansee(ox[0], oy[0]) ? 1 : 0);

        /* weight has been reduced to 0 so destroy the glob */
        shrinking_glob_gone(obj);

        if (seeit) {
            newsym(ox[0], oy[0]);
            if ((ox[0] != u.ux || oy[0] != u.uy) && !strncmp(globnambuf, _("The "), 4))
                /* fortunately none of the glob adjectives warrant "An " */
                strsubst(globnambuf, _("The "), _("A "));
            /* again, quantity is always 1 so no need for otense()/vtense() */
            pline(_("%s fades away."), globnambuf);
        }
    } else {
        /* schedule next shrink ~25 turns from now */
        start_glob_timeout(obj, 0);
    }
    if (updinv) {
        update_inventory();
        encumber_msg();
    }
    } finally { stack_pop($frame); }
}

/* a glob has shrunk away to nothing; handle owornmask, then delete glob */
function shrinking_glob_gone(obj) { /* void */
    let owhere = obj.where;

    if (owhere == OBJ_INVENT) {
        if (obj.owornmask) {
            remove_worn_item(obj, FALSE);
            stop_occupation();
        }
        useupall(obj); /* freeinv()+obfree() */
    } else {
        if (owhere == OBJ_MIGRATING) {
            /* destination flag overloads owornmask; clear it so obfree()'s
               check for freeing a worn object doesn't get a false hit */
            obj.owornmask = 0;
        } else if (owhere == OBJ_MINVENT) {
            /* monsters don't wield globs so this isn't strictly needed */
            if (obj.owornmask && obj == MON_WEP(obj.v.v_ocarry))
                setmnotwielded(obj.v.v_ocarry, obj); /* clears owornmask */
        }
        /* remove the glob from whatever list it's on and then delete it;
           if it's contained, obj_extract_self() will update the container's
           weight and if nested, the enclosing containers' weights too */
        obj_extract_self(obj);
        if (owhere == OBJ_FLOOR)
            maybe_unhide_at(obj.ox, obj.oy);
        obfree(obj, null);
    }
}

export function maybe_adjust_light(obj, old_range) { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);
    let ox = stack_var(coordxy), oy = stack_var(coordxy);
    let new_range = arti_light_radius(obj), delta = new_range - old_range;

    /* radius of light emitting artifact varies by curse/bless state
       so will change after blessing or cursing */
    if (delta) {
        obj_adjust_light_radius(obj, new_range);
        /* simplifying assumptions:  hero is wielding or wearing this object;
           artifacts have to be in use to emit light and monsters' gear won't
           change bless or curse state */
        if (!Blind() && get_obj_location(obj, ox, oy, 0)) {
            chars[buf] = ord('\0');
            if (iflags.last_msg == PLNMSG_OBJ_GLOWS)
                /* we just saw "The <obj> glows <color>." from dipping */
                strcpy(buf, (obj.quan == 1) ? _("It") : _("They"));
            else if (carried(obj) || cansee(ox[0], oy[0]))
                strcpy(buf, Yname2(obj));
            if (chars[buf]) {
                /* initial activation says "dimly" if cursed,
                   "brightly" if uncursed, and "brilliantly" if blessed;
                   when changing intensity, using "less brightly" is
                   straightforward for dimming, but we need "brighter"
                   rather than "more brightly" for brightening; ugh */
                pline(_("%s %s %s%s."), buf, otense(obj, _("shine")),
                      (abs(delta) > 1) ? _("much ") : _(""),
                      (delta > 0) ? _("brighter") : _("less brightly"));
            }
        }
    }
    } finally { stack_pop($frame); }
}

/*
 *      bless(), curse(), unbless(), uncurse() -- any relevant message
 *      about glowing amber/black/&c should be delivered prior to calling
 *      these routines to make the actual curse/bless state change.
 */

export function bless(otmp) { /* void */
    let old_light = 0;

    if (otmp.oclass == COIN_CLASS)
        return;
    if (otmp.lamplit)
        old_light = arti_light_radius(otmp);
    otmp.cursed = 0;
    otmp.blessed = 1;
    if (carried(otmp) && confers_luck(otmp))
        set_moreluck();
    else if (otmp.otyp == BAG_OF_HOLDING)
        otmp.owt = unsigned(weight(otmp));
    else if (otmp.otyp == FIGURINE && otmp.timed)
        stop_timer(FIG_TRANSFORM, obj_to_any(otmp));
    if (otmp.lamplit)
        maybe_adjust_light(otmp, old_light);
    return;
}

export function unbless(otmp) { /* void */
    let old_light = 0;

    if (otmp.lamplit)
        old_light = arti_light_radius(otmp);
    otmp.blessed = 0;
    if (carried(otmp) && confers_luck(otmp))
        set_moreluck();
    else if (otmp.otyp == BAG_OF_HOLDING)
        otmp.owt = unsigned(weight(otmp));
    if (otmp.lamplit)
        maybe_adjust_light(otmp, old_light);
}

export function curse(otmp) { /* void */
    let already_cursed;
    let old_light = 0;

    if (otmp.oclass == COIN_CLASS)
        return;
    if (otmp.lamplit)
        old_light = arti_light_radius(otmp);
    already_cursed = otmp.cursed;
    otmp.blessed = 0;
    otmp.cursed = 1;
    /* welded two-handed weapon interferes with some armor removal */
    if (otmp == uwep && bimanual(uwep))
        reset_remarm();
    /* rules at top of wield.c state that twoweapon cannot be done
       with cursed alternate weapon */
    if (otmp == uswapwep && u.twoweap)
        drop_uswapwep();
    /* some cursed items need immediate updating */
    if (carried(otmp) && confers_luck(otmp)) {
        set_moreluck();
    } else if (otmp.otyp == BAG_OF_HOLDING) {
        otmp.owt = unsigned(weight(otmp));
    } else if (otmp.otyp == FIGURINE) {
        if (otmp.corpsenm != NON_PM && !dead_species(otmp.corpsenm, TRUE)
            && (carried(otmp) || mcarried(otmp)))
            attach_fig_transform_timeout(otmp);
    } else if (otmp.oclass == SPBOOK_CLASS) {
        /* if book hero is reading becomes cursed, interrupt */
        if (!already_cursed)
            book_cursed(otmp);
    }
    if (otmp.lamplit)
        maybe_adjust_light(otmp, old_light);
    return;
}

export function uncurse(otmp) { /* void */
    let old_light = 0;

    if (otmp.lamplit)
        old_light = arti_light_radius(otmp);
    otmp.cursed = 0;
    if (carried(otmp) && confers_luck(otmp))
        set_moreluck();
    else if (otmp.otyp == BAG_OF_HOLDING)
        otmp.owt = unsigned(weight(otmp));
    else if (otmp.otyp == FIGURINE && otmp.timed)
        stop_timer(FIG_TRANSFORM, obj_to_any(otmp));
    if (otmp.lamplit)
        maybe_adjust_light(otmp, old_light);
    return;
}

export function blessorcurse(otmp, chance) { /* void */
    if (otmp.blessed || otmp.cursed)
        return;

    if (!rn2(chance)) {
        if (!rn2(2)) {
            curse(otmp);
        } else {
            bless(otmp);
        }
    }
    return;
}

export function bcsign(otmp) { /* int */
    return (+!!otmp.blessed - +!!otmp.cursed);
}

/* set the object's bless/curse-state known flag */
export function set_bknown(
    obj,
    onoff) { /* void */ /* 1 or 0 */
    if (obj.bknown != onoff) {
        obj.bknown = onoff;
        if (obj.where == OBJ_INVENT && svm.moves > 1)
            update_inventory();
    }
}

/*
 *  Calculate the weight of the given object.  This will recursively follow
 *  and calculate the weight of any containers.
 *
 *  Note:  It is possible to end up with an incorrect weight if some part
 *         of the code messes with a contained object and doesn't update the
 *         container's weight.
 *
 *  Note too: obj->owt is an unsigned int and objects[].oc_weight an
 *         unsigned short int, so weight() should probably be changed to
 *         use and return unsigned int instead of signed int.
 */
export function weight(obj) { /* int */
    let wt = int((objects[obj.otyp].oc_weight)); /* weight of 1 'otyp' */

    if (obj.quan < 1) {
        impossible(_("Calculating weight of %lld %s?"),
                   obj.quan, simpleonames(obj));
        return 0;
    }
    /* glob absorption means that merging globs combines their weight
       while quantity stays 1; mksobj(), obj_absorb(), and shrink_glob()
       manage glob->owt and there is nothing for weight() to do except
       return the current value as-is */
    if (obj.globby) {
        /* 5.0: in 3.6.x this checked for owt==0 and then used
           owt as-is when non-zero or objects[].oc_weight if zero;
           we don't do that anymore because it confused calculating
           the weight of a container when a glob inside shrank down
           to 0 and was about to be deleted [mksobj() now initializes
           owt for globs sooner and the subsequent o->owt = weight(o)
           general initialization is benignly redundant for globs] */
        return int(obj.owt);
    }
    if (Is_container(obj) || obj.otyp == STATUE) {
        let contents;
        let cwt;

        if (obj.otyp == STATUE && ismnum(obj.corpsenm)) {
            let msize = (mons[obj.corpsenm].msize),
                minwt = (msize + msize + 1) * 100;

            /* default statue weight is 1.5 times corpse weight */
            wt = Math.trunc(3 * int((mons[obj.corpsenm].cwt)) / 2);
            /* some monsters that never leave a corpse when they die have
               corpse weight defined as 0; statues resembling them need to
               have non-zero weight; others are so tiny (killer bee) that
               they weigh barely more than nothing or so insubstantial
               (wraith) that they actually weigh nothing; statues of such
               need more heft */
            if (wt < minwt)
                wt = minwt;
            /* this has no effect because statues don't stack */
            wt *= int(obj.quan);
        }

        cwt = 0; /* contents weight */
        for (contents = obj.cobj; contents; contents = contents.nobj)
            cwt += weight(contents);
        /*
         *  The weight of bags of holding is calculated as the weight
         *  of the bag plus the weight of the bag's contents modified
         *  as follows:
         *
         *      Bag status      Weight of contents
         *      ----------      ------------------
         *      cursed                  2x
         *      blessed                 x/4 [rounded up: (x+3)/4]
         *      otherwise               x/2 [rounded up: (x+1)/2]
         *
         *  The macro DELTA_CWT in pickup.c also implements these
         *  weight equations.
         */
        if (obj.otyp == BAG_OF_HOLDING)
            cwt = obj.cursed ? (cwt * 2)
                  : obj.blessed ? Math.trunc((cwt + 3) / 4)
                    : Math.trunc((cwt + 1) / 2); /* uncursed */

        return wt + cwt;
    }
    if (obj.otyp == CORPSE && ismnum(obj.corpsenm)) {
        let long_wt = obj.quan * (mons[obj.corpsenm].cwt);

        wt = (long_wt > LARGEST_INT) ? LARGEST_INT : int(long_wt);
        if (obj.oeaten)
            wt = eaten_stat(wt, obj);
        return wt;
    } else if (obj.oclass == FOOD_CLASS && obj.oeaten) {
        return eaten_stat(int(obj.quan) * wt, obj);
    } else if (obj.oclass == COIN_CLASS) {
        /* 5.0: always weigh at least 1 unit; used to yield 0 for 1..49 */
        wt = int(Math.trunc((obj.quan + 50) / 100));
        return max(wt, 1);
    } else if (obj.otyp == HEAVY_IRON_BALL && obj.owt != 0) {
        return int(obj.owt); /* kludge for "very" heavy iron ball */
    } else if (obj.otyp == CANDELABRUM_OF_INVOCATION && obj.spe) {
        return wt + obj.spe * int((objects[TALLOW_CANDLE].oc_weight));
    }
    return (wt ? wt * int(obj.quan) : (int(obj.quan) + 1) >> 1);
}

const treefruits = static_array("treefruits", int, null, [
    APPLE, ORANGE, PEAR, BANANA, EUCALYPTUS_LEAF
]);

/* called when a tree is kicked; never returns Null */
export function rnd_treefruit_at(x, y) { /* struct obj * */
    return mksobj_at(ROLL_FROM(treefruits), x, y, TRUE, FALSE);
}

/* for describing objects embedded in trees */
export function is_treefruit(otmp) { /* boolean */
    let fruitidx;

    for (fruitidx = 0; fruitidx < SIZE(treefruits); ++fruitidx)
        if (treefruits[fruitidx] == otmp.otyp)
            return TRUE;
    return FALSE;
}

/* create a stack of N gold pieces; never returns Null */
export function mkgold(amount, x, y) { /* struct obj * */
    let gold = g_at(x, y);

    if (amount <= 0) {
        let mul = rnd(Math.trunc(30 / max(12-depth(u.uz), 2)));

        amount = (1 + rnd(level_difficulty() + 2) * mul);
    }
    if (gold) {
        gold.quan += amount;
    } else {
        gold = mksobj_at(GOLD_PIECE, x, y, TRUE, FALSE);
        gold.quan = amount;
    }
    gold.owt = unsigned(weight(gold));
    return gold;
}

/* potions of oil use their obj->age field differently from other potions
   so changing potion type to or from oil needs to have that fixed up */
export function fixup_oil(
    potion,
    source) { /* void */ /* item used to create potion; might be Null */
    if (potion.otyp == POT_OIL) {
        if (source && source.otyp == POT_OIL) {
            /* potion of oil being used to set potion's otyp to oil;
               source might be partly used */
            potion.age = source.age;
        } else {
            /* non-oil is being turned into oil; change absolute age
               (turn created) into relative age (amount remaining /
               burn time available) */
            potion.age = MAX_OIL_IN_FLASK;
        }
    } else if (source && source.otyp == POT_OIL) {
        /* potion is no longer oil, being turned into non-oil */
        if (potion.age == source.age)
            potion.age = svm.moves;
        /* when source is a partly used oil, mark potion as diluted */
        if (source.age < MAX_OIL_IN_FLASK)
            potion.oeroded = 1;
    }
}

/* return TRUE if the corpse has special timing;
   lizards and lichen don't rot, trolls and Riders auto-revive */
export function special_corpse(num) { return +((num == PM_LIZARD || num == PM_LICHEN)
     || (mons[num].mlet == S_TROLL || is_rider(mons[num]))); }

/* mkcorpstat: make a corpse or statue; never returns Null.
 *
 * OEXTRA note: Passing mtmp causes mtraits to be saved
 * even if ptr passed as well, but ptr is always used for
 * the corpse type (corpsenm). That allows the corpse type
 * to be different from the original monster,
 *      i.e.  vampire -> human corpse
 * yet still allow restoration of the original monster upon
 * resurrection.
 */
export function mkcorpstat(
    objtype,
    mtmp,
    ptr,
    x, y,
    corpstatflags) { /* struct obj * */
    let otmp;
    let init = +((corpstatflags & CORPSTAT_INIT) != 0);

    if (objtype != CORPSE && objtype != STATUE)
        impossible(_("making corpstat type %d"), objtype);
    if (x == 0 && y == 0) { /* special case - random placement */
        otmp = mksobj(objtype, init, FALSE);
        rloco(otmp);
    } else {
        otmp = mksobj_at(objtype, x, y, init, FALSE);
    }
    /* record gender and 'historic statue' in overloaded enchantment field */
    otmp.spe = (corpstatflags & CORPSTAT_SPE_VAL);
    otmp.oeroded2 = unsigned(gm.mkcorpstat_norevive); /* via envrmt rather than flags */

    /* when 'mtmp' is non-null save the monster's details with the
       corpse or statue; it will also force the 'ptr' override below */
    if (mtmp) {
        /* save_mtraits updates otmp->oextra->omonst in place */
        save_mtraits(otmp, mtmp);

        if (!ptr)
            ptr = mtmp.data;

        /* don't give a revive timer to a cancelled troll's corpse */
        if (mtmp.mcan && !is_rider(ptr))
            otmp.oeroded2 = 1;
    }

    /* when 'ptr' is non-null it comes from our caller or from 'mtmp';
       override mkobjs()'s initialization of a random monster type */
    if (ptr) {
        let old_corpsenm = otmp.corpsenm;

        otmp.corpsenm = monsndx(ptr);
        otmp.owt = unsigned(weight(otmp));
        if (otmp.otyp == CORPSE
            && (gz.zombify || special_corpse(old_corpsenm)
                || special_corpse(otmp.corpsenm))) {
            obj_stop_timers(otmp);
            start_corpse_timeout(otmp);
        }
    }
    return otmp;
}

/*
 * Return the type of monster that this corpse will
 * revive as, even if it has a monster structure
 * attached to it. In that case, you can't just
 * use obj->corpsenm, because the stored monster
 * type can, and often is, different.
 * The return value is an index into mons[].
 */
export function corpse_revive_type(obj) { /* int */
    let revivetype = obj.corpsenm;
    let mtmp;

    if (has_omonst(obj) && ((mtmp = get_mtraits(obj, FALSE)) != null)) {
        /* mtmp is a temporary pointer to a monster's stored
        attributes, not a real monster */
        revivetype = mtmp.mnum;
    }
    return revivetype;
}

/*
 * Attach a monster id to an object, to provide
 * a lasting association between the two.
 */
export function obj_attach_mid(obj, mid) { /* struct obj * */
    if (!mid || !obj)
        return null;
    newomid(obj);
    ((obj).oextra.omid) = mid;
    return obj;
}

function save_mtraits(obj, mtmp) { /* struct obj * */
    if (mtmp.ispriest)
        forget_temple_entry(mtmp); /* EPRI() */
    if (!has_omonst(obj))
        newomonst(obj);
    if (has_omonst(obj)) {
        let baselevel = mtmp.data.mlevel; /* mtmp->data is valid ptr */
        let mtmp2 = OMONST(obj);

        struct_assign(mtmp2, mtmp);
        mtmp2.mextra = null;
        mtmp2.mnum = monsndx(mtmp.data);
        /* invalidate pointers */
        /* m_id is needed to know if this is a revived quest leader */
        /* but m_id must be cleared when loading bones */
        mtmp2.nmon = null;
        mtmp2.data = null;
        mtmp2.minvent = null;
        MON_NOWEP(mtmp2); /* mtmp2->mw = (struct obj *) 0; */
        if (mtmp.mextra)
            copy_mextra(mtmp2, mtmp);
        /* if mtmp is a long worm with segments, its saved traits will
           be one without any segments */
        mtmp2.wormno = 0;
        /* mtmp might have been killed by repeated life draining; make sure
           mtmp2 can survive if revived ('baselevel' will be 0 for 1d4 mon) */
        if (mtmp2.mhpmax <= baselevel)
            mtmp2.mhpmax = baselevel + 1;
        /* mtmp is assumed to be dead but we don't kill it or its saved
           traits, just force those to have a sane value for current HP */
        if (mtmp2.mhp > mtmp2.mhpmax)
            mtmp2.mhp = mtmp2.mhpmax;
        if (mtmp2.mhp < 1)
            mtmp2.mhp = 0;
        mtmp2.mstate = and64(mtmp2.mstate, ~MON_DETACH);
    }
    return obj;
}

/* returns a pointer to a new monst structure based on
 * the one contained within the obj.
 */
export function get_mtraits(obj, copyof) { /* struct monst * */
    let mtmp = null;
    let mnew = null;

    if (has_omonst(obj))
        mtmp = OMONST(obj);
    if (mtmp) {
        if (copyof) {
            mnew = newmonst();
            struct_assign(mnew, mtmp);
            mnew.mextra = null;
            if (mtmp.mextra)
                copy_mextra(mnew, mtmp);
        } else {
            /* Never insert this returned pointer into mon chains! */
            mnew = mtmp;
        }
        mnew.data = mons[mnew.mnum];
    }
    return mnew;
}

/* make an object named after someone listed in the scoreboard file;
   never returns Null */
export function mk_tt_object(
    objtype,
    x, y) { /* struct obj * */
    let otmp;
    let initialize_it;

    /* player statues never contain books */
    initialize_it = +(objtype != STATUE);
    otmp = mksobj_at(objtype, x, y, initialize_it, FALSE);

    /* tt_oname() will return null if the scoreboard is empty, which in
       turn leaves the random corpsenm value; force it to match a player */
    if (!tt_oname(otmp)) {
        let pm = rn1(PM_WIZARD - PM_ARCHEOLOGIST + 1, PM_ARCHEOLOGIST);

        /* update weight for either, force timer sanity for corpses */
        set_corpsenm(otmp, pm);
    }

    return otmp;
}

/* make a new corpse or statue, uninitialized if a statue (i.e. no books);
   never returns Null */
export function mk_named_object(
    objtype,
    ptr,
    x, y,
    nm) { /* struct obj * */
    let otmp;
    let corpstatflags = (objtype != STATUE) ? CORPSTAT_INIT
                                                 : CORPSTAT_NONE;

    otmp = mkcorpstat(objtype, null, ptr, x, y, corpstatflags);
    if (nm)
        otmp = oname(otmp, nm, ONAME_NO_FLAGS);
    return otmp;
}

export function is_flammable(otmp) { /* boolean */
    let otyp = otmp.otyp;
    let omat = objects[otyp].oc_material;

    /* Candles can be burned, but they're not flammable in the sense that
     * they can't get fire damage and it makes no sense for them to be
     * fireproofed.
     */
    if (Is_candle(otmp))
        return FALSE;

    if (objects[otyp].oc_oprop == FIRE_RES || otyp == WAN_FIRE)
        return FALSE;

    return (+((omat <= WOOD && omat != LIQUID) || omat == PLASTIC));
}

export function is_rottable(otmp) { /* boolean */
    let otyp = otmp.otyp;

    return (+((objects[otyp].oc_material <= WOOD
                       && objects[otyp].oc_material != LIQUID)
                      || objects[otyp].oc_material == DRAGON_HIDE));
}

/*
 * These routines maintain the single-linked lists headed in level.objects[][]
 * and threaded through the nexthere fields in the object-instance structure.
 */

/* put the object at the given location */
export function place_object(otmp, x, y) { /* void */
    let otmp2;

    if (!isok(x, y)) { /* validate location */
        let func;

        func = (x < 0 || y < 0 || x > COLNO - 1 || y > ROWNO - 1) ? panic
               : impossible;
        func(_("place_object: \"%s\" [%d] off map <%d,%d>"),
                safe_typename(otmp.otyp), otmp.where, x, y);

        /* we'll only get to here if we've issued a warning (and fuzzer
           is not running since it escalates impossible to panic), so
           x,y has failed isok() but is within array bounds for the map;
           in other words, x specifies column 0 which should not happen
           but we let the game keep going */
    }
    if (otmp.where != OBJ_FREE)
        panic(_("place_object: obj \"%s\" [%d] not free"),
              safe_typename(otmp.otyp), otmp.where);

    assert(x >= 0 && x < COLNO && y >= 0 && y < ROWNO);
    otmp2 = svl.level.objects[x][y];

    obj_no_longer_held(otmp);
    if (otmp.otyp == BOULDER) {
        if (!otmp2 || otmp2.otyp != BOULDER)
            block_point(x, y); /* vision */
    }

    /* non-boulder object goes under boulders so that map will show boulder
       here without display code needing to traverse pile chain to find one */
    if (otmp2 && otmp2.otyp == BOULDER && otmp.otyp != BOULDER) {
        /* 3.6.3: put otmp under last consecutive boulder rather than under
           just the first one */
        while (otmp2.v.v_nexthere && otmp2.v.v_nexthere.otyp == BOULDER)
            otmp2 = otmp2.v.v_nexthere;
        otmp.v.v_nexthere = otmp2.v.v_nexthere;
        otmp2.v.v_nexthere = otmp;
    } else {
        /* put on top of current pile */
        otmp.v.v_nexthere = otmp2;
        svl.level.objects[x][y] = otmp;
    }

    /* set the object's new location */
    otmp.ox = x;
    otmp.oy = y;
    otmp.where = OBJ_FLOOR;

    /* if placed outside of shop, no_charge is no longer applicable */
    if (otmp.no_charge && !costly_spot(x, y)
        && !costly_adjacent(find_objowner(otmp, x, y), x, y))
        otmp.no_charge = 0;

    /* add to floor chain */
    otmp.nobj = fobj();
    svl.level.objlist = otmp;
    if (otmp.timed)
        obj_timer_checks(otmp, x, y, 0);
}

/* tear down the object pile at <x,y> and create it again, so that any
   boulders which are present get forced to the top */
export function recreate_pile_at(x, y) { /* void */
    let otmp, next_obj, reversed = null;

    /* remove all objects at <x,y>, saving a reversed temporary list */
    for (otmp = svl.level.objects[x][y]; otmp; otmp = next_obj) {
        next_obj = otmp.v.v_nexthere;
        remove_object(otmp); /* obj_extract_self() for floor */
        otmp.nobj = reversed;
        reversed = otmp;
    }
    /* pile at <tx,ty> is now empty; create new one, re-reversing to restore
       original order; place_object() handles making boulders be on top */
    for (otmp = reversed; otmp; otmp = next_obj) {
        next_obj = otmp.nobj;
        otmp.nobj = null; /* obj->where is OBJ_FREE */
        place_object(otmp, x, y);
    }
}

export const ROT_ICE_ADJUSTMENT = 2;

/* If ice was affecting any objects correct that now
 * Also used for starting ice effects too. [zap.c]
 */
export function obj_ice_effects(x, y, do_buried) { /* void */
    let otmp;

    for (otmp = svl.level.objects[x][y]; otmp; otmp = otmp.v.v_nexthere) {
        if (otmp.timed)
            obj_timer_checks(otmp, x, y, 0);
    }
    if (do_buried) {
        for (otmp = svl.level.buriedobjlist; otmp; otmp = otmp.nobj) {
            if (otmp.ox == x && otmp.oy == y) {
                if (otmp.timed)
                    obj_timer_checks(otmp, x, y, 0);
            }
        }
    }
}

/*
 * Returns an obj->age for a corpse object on ice, that would be the
 * actual obj->age if the corpse had just been lifted from the ice.
 * This is useful when just using obj->age in a check or calculation because
 * rot timers pertaining to the object don't have to be stopped and
 * restarted etc.
 */
export function peek_at_iced_corpse_age(otmp) { /* long long */
    let age, retval = otmp.age;

    if (otmp.otyp == CORPSE && otmp.recharged) {
        /* Adjust the age; must be same as obj_timer_checks() for off ice*/
        age = svm.moves - otmp.age;
        retval += Math.trunc(age * (ROT_ICE_ADJUSTMENT - 1) / ROT_ICE_ADJUSTMENT);
        do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(_("The %s age has ice modifications: otmp->age = %lld, returning %lld."), s_suffix(doname(otmp)), otmp.age, retval); iflags.last_msg = save_plnmsg; } } while (0)

;
        debugpline1(_("Effective age of corpse: %lld."), svm.moves - retval, __FILE__);
    }
    return retval;
}

function obj_timer_checks(
    otmp,
    x, y,
    force) { /* void */ /* 0 = no force so do checks, <0 = force off, >0 force on */
    let tleft = 0;
    let action = ROT_CORPSE;
    let restart_timer = FALSE;
    let on_floor = +(otmp.where == OBJ_FLOOR);
    let buried = +(otmp.where == OBJ_BURIED);

    /* Check for corpses just placed on or in ice */
    if (otmp.otyp == CORPSE && (on_floor || buried) && is_ice(x, y)) {
        tleft = stop_timer(action, obj_to_any(otmp));
        if (tleft == 0) {
            action = REVIVE_MON;
            tleft = stop_timer(action, obj_to_any(otmp));
        }
        if (tleft != 0) {
            let age;

            /* mark the corpse as being on ice */
            otmp.recharged = 1;
            do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(_("%s is now on ice at <%d,%d>."), The(xname(otmp)), x, y); iflags.last_msg = save_plnmsg; } } while (0)
;
            /* Adjust the time remaining */
            tleft *= ROT_ICE_ADJUSTMENT;
            restart_timer = TRUE;
            /* Adjust the age; time spent off ice needs to be multiplied
               by the ice adjustment and subtracted from the age so that
               later calculations behave as if it had been on ice during
               that time (longwinded way of saying this is the inverse
               of removing it from the ice and of peeking at its age). */
            age = svm.moves - otmp.age;
            otmp.age = svm.moves - (age * ROT_ICE_ADJUSTMENT);
        }

    /* Check for corpses coming off ice */
    } else if (force < 0 || (otmp.otyp == CORPSE && otmp.recharged
                             && !((on_floor || buried) && is_ice(x, y)))) {
        tleft = stop_timer(action, obj_to_any(otmp));
        if (tleft == 0) {
            action = REVIVE_MON;
            tleft = stop_timer(action, obj_to_any(otmp));
        }
        if (tleft != 0) {
            let age;

            otmp.recharged = 0;
            do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(_("%s is no longer on ice at <%d,%d>."), The(xname(otmp)), x, y); iflags.last_msg = save_plnmsg; } } while (0)
;
            /* Adjust the remaining time */
            tleft = Math.trunc(tleft / ROT_ICE_ADJUSTMENT);
            restart_timer = TRUE;
            /* Adjust the age */
            age = svm.moves - otmp.age;
            otmp.age += Math.trunc(age * (ROT_ICE_ADJUSTMENT - 1) / ROT_ICE_ADJUSTMENT);
        }
    }

    /* now re-start the timer with the appropriate modifications */
    if (restart_timer)
        start_timer(tleft, TIMER_OBJECT, action, obj_to_any(otmp));
}

export function remove_object(otmp) { /* void */
    let x = otmp.ox;
    let y = otmp.oy;

    if (otmp.where != OBJ_FLOOR)
        panic(_("remove_object: obj where=%d, not on floor"), otmp.where);
    extract_nexthere(otmp, svl.level.objects[x].subarray(y));
    extract_nobj(otmp, ref_of(svl.level, "objlist"));
    if (otmp.otyp == BOULDER)
        recalc_block_point(x, y); /* vision */
    if (otmp.timed)
        obj_timer_checks(otmp, x, y, 0);
}

/* throw away all of a monster's inventory */
export function discard_minvent(mtmp, uncreate_artifacts) { /* void */
    let otmp;

    while ((otmp = mtmp.minvent) != null) {
        /* this has now become very similar to m_useupall()... */
        extract_from_minvent(mtmp, otmp, TRUE, TRUE);
        if (uncreate_artifacts && otmp.oartifact)
            artifact_exists(otmp, safe_oname(otmp), FALSE, ONAME_NO_FLAGS);
        obfree(otmp, null); /* dealloc_obj() isn't sufficient */
    }
}

/*
 * Free obj from whatever list it is on in preparation for deleting it
 * or moving it elsewhere; obj->where will end up set to OBJ_FREE unless
 * it is already OBJ_LUAFREE or OBJ_DELETED.
 * Doesn't handle unwearing of objects in hero's or monsters' inventories.
 *
 * Object positions:
 *      OBJ_FREE        not on any list
 *      OBJ_FLOOR       fobj, level.locations[][] chains (use remove_object)
 *      OBJ_CONTAINED   cobj chain of container object
 *      OBJ_INVENT      hero's invent chain (use freeinv)
 *      OBJ_MINVENT     monster's invent chain
 *      OBJ_MIGRATING   migrating chain
 *      OBJ_BURIED      level.buriedobjs chain
 *      OBJ_ONBILL      on gb.billobjs chain
 *      OBJ_LUAFREE     obj is dealloc'd from core, but still used by lua
 *      OBJ_DELETED     obj has been deleted from play but not yet deallocated
 */
export function obj_extract_self(obj) { /* void */
    switch (obj.where) {
    case OBJ_FREE:
    case OBJ_LUAFREE:
    case OBJ_DELETED:
        break;
    case OBJ_FLOOR:
        remove_object(obj);
        break;
    case OBJ_CONTAINED:
        extract_nobj(obj, ref_of(obj.v.v_ocontainer, "cobj"));
        container_weight(obj.v.v_ocontainer);
        obj.v.v_ocontainer = null; /* clear stale back-link */
        break;
    case OBJ_INVENT:
        freeinv(obj);
        break;
    case OBJ_MINVENT:
        extract_nobj(obj, ref_of(obj.v.v_ocarry, "minvent"));
        obj.v.v_ocarry = null; /* clear stale back-link */
        break;
    case OBJ_MIGRATING:
        extract_nobj(obj, ref_of(gm, "migrating_objs"));
        break;
    case OBJ_BURIED:
        extract_nobj(obj, ref_of(svl.level, "buriedobjlist"));
        break;
    case OBJ_ONBILL:
        extract_nobj(obj, ref_of(gb, "billobjs"));
        break;
    default:
        panic(_("obj_extract_self, where=%d"), obj.where);
        break;
    }
}

/* Extract the given object from the chain, following nobj chain. */
export function extract_nobj(obj, head_ptr) { /* void */
    let curr, prev;

    curr = head_ptr[0];
    for (prev = null; curr; prev = curr, curr = curr.nobj) {
        if (curr == obj) {
            if (prev)
                prev.nobj = curr.nobj;
            else
                head_ptr[0] = curr.nobj;
            break;
        }
    }
    if (!curr)
        panic(_("extract_nobj: object lost"));
    obj.where = OBJ_FREE;
    obj.nobj = null;
}

/*
 * Extract the given object from the chain, following nexthere chain.
 *
 * This does not set obj->where, this function is expected to be called
 * in tandem with extract_nobj, which does set it.
 */
export function extract_nexthere(obj, head_ptr) { /* void */
    let curr, prev;

    curr = head_ptr[0];
    for (prev = null; curr; prev = curr, curr = curr.v.v_nexthere) {
        if (curr == obj) {
            if (prev)
                prev.v.v_nexthere = curr.v.v_nexthere;
            else
                head_ptr[0] = curr.v.v_nexthere;
            break;
        }
    }
    if (!curr)
        panic(_("extract_nexthere: object lost"));
    obj.v.v_nexthere = null;
}

/*
 * Add obj to mon's inventory.  If obj is able to merge with something already
 * in the inventory, then the passed obj is deleted and 1 is returned.
 * Otherwise 0 is returned.
 */
export function add_to_minv(mon, obj$) { /* int */
    const $frame = stack_frame(); try {
    const obj = stack_var(ptr_to(struct_obj), obj$);
    let otmp = stack_var(ptr_to(struct_obj));

    if (obj[0].where != OBJ_FREE)
        panic(_("add_to_minv: obj where=%d, not free"), obj[0].where);

    /* merge if possible */
    for (otmp[0] = mon.minvent; otmp[0]; otmp[0] = otmp[0].nobj)
        if (merged(otmp, obj))
            return 1; /* obj merged and then free'd */
    /* else insert; don't bother forcing it to end of chain */
    obj[0].where = OBJ_MINVENT;
    obj[0].v.v_ocarry = mon;
    obj[0].nobj = mon.minvent;
    mon.minvent = obj[0];
    return 0; /* obj on mon's inventory chain */
    } finally { stack_pop($frame); }
}

/*
 * Add obj to container, make sure obj is "free".  Returns (merged) obj.
 * The input obj may be deleted in the process.
 *
 * Caveat:  this does not update the container's weight [possibly to
 * prevent that from being recalculated repeatedly when adding multiple
 * items].
 */
export function add_to_container(container, obj$) { /* struct obj * */
    const $frame = stack_frame(); try {
    const obj = stack_var(ptr_to(struct_obj), obj$);
    let otmp = stack_var(ptr_to(struct_obj));

    if (obj[0].where != OBJ_FREE)
        panic(_("add_to_container: obj where=%d, not free"), obj[0].where);
    if (container.where != OBJ_INVENT && container.where != OBJ_MINVENT)
        obj_no_longer_held(obj[0]);

    /* merge if possible */
    for (otmp[0] = container.cobj; otmp[0]; otmp[0] = otmp[0].nobj)
        if (merged(otmp, obj))
            return otmp[0];

    obj[0].where = OBJ_CONTAINED;
    obj[0].v.v_ocontainer = container;
    obj[0].nobj = container.cobj;
    container.cobj = obj[0];
    return obj[0];
    } finally { stack_pop($frame); }
}

export function add_to_migration(obj) { /* void */
    if (obj.where != OBJ_FREE)
        panic(_("add_to_migration: obj where=%d, not free"), obj.where);

    if (obj.unpaid) /* caller should have changed unpaid item to stolen */
        impossible(_("unpaid object migrating to another level? [%s]"),
                   simpleonames(obj));
    obj.no_charge = 0; /* was only relevant while inside a shop */

    /* lock picking context becomes stale if it's for this object */
    if (Is_container(obj))
        maybe_reset_pick(obj);

    obj.where = OBJ_MIGRATING;
    obj.nobj = gm.migrating_objs;
    obj.omigr_from_dnum = u.uz.dnum;
    obj.omigr_from_dlevel = u.uz.dlevel;
    gm.migrating_objs = obj;
}

export function add_to_buried(obj) { /* void */
    if (obj.where != OBJ_FREE)
        panic(_("add_to_buried: obj where=%d, not free"), obj.where);

    obj.where = OBJ_BURIED;
    obj.nobj = svl.level.buriedobjlist;
    svl.level.buriedobjlist = obj;
}

/* recalculate weight of object, which doesn't have to be a container
   itself; if it is contained, recursively handle _its_ container(s) */
export function container_weight(object) { /* void */
    object.owt = unsigned(weight(object));
    if (object.where == OBJ_CONTAINED)
        container_weight(object.v.v_ocontainer);
}

/*
 * Mark object to be deallocated.  _All_ objects should be run through here
 * for them to be deallocated.
 */
export function dealloc_obj(obj) { /* void */
    if (obj.otyp == BOULDER)
        obj.corpsenm = 0;
    if (obj.where == OBJ_DELETED) {
        impossible(_("dealloc_obj: obj already deleted (type=%d)"), obj.otyp);
        return;
    } else if (obj.where != OBJ_FREE && obj.where != OBJ_LUAFREE) {
        panic(_("dealloc_obj: obj not free (type=%d, where=%d)"),
              obj.otyp, obj.where);
    }
    if (obj.nobj)
        panic(_("dealloc_obj with nobj"));
    if (obj.cobj)
        panic(_("dealloc_obj with cobj"));
    if (obj == hands_obj) {
        impossible(_("dealloc_obj with hands_obj"));
        return;
    }

    /* free up any timers attached to the object */
    if (obj.timed)
        obj_stop_timers(obj);

    /*
     * Free up any light sources attached to the object.
     *
     * We may want to just call del_light_source() without any
     * checks (requires a code change there).  Otherwise this
     * list must track all objects that can have a light source
     * attached to it (and also requires lamplit to be set).
     */
    if (obj_sheds_light(obj)) {
        del_light_source(LS_OBJECT, obj_to_any(obj));
        obj.lamplit = 0;
    }

    if (obj == gt.thrownobj)
        gt.thrownobj = null;
    if (obj == gk.kickedobj)
        gk.kickedobj = null;
    if (obj == svc.context.tin.tin) {
        svc.context.tin.tin = null;
        svc.context.tin.o_id = 0;
    }

    /* if obj came from the most recent splitobj(), it's no longer eligible
       for unsplitobj(); perform inline clear_splitobjs() */
    if (obj.o_id == svc.context.objsplit.parent_oid
        || obj.o_id == svc.context.objsplit.child_oid)
        svc.context.objsplit.parent_oid = svc.context.objsplit.child_oid = 0;

    if (obj.lua_ref_cnt) {
        /* obj is referenced from a lua script, let lua gc free it */
        obj.where = OBJ_LUAFREE;
        return;
    }
    if (!program_state.freeingdata) {
        /* mark object as deleted, put it into queue to be freed */
        obj.where = OBJ_DELETED;
        obj.nobj = go.objs_deleted;
        go.objs_deleted = obj;
    } else {
        /* when saving, there's no need to stage deletions on objs_deleted */
        dealloc_obj_real(obj);
    }
}

/* actually deallocate the object */
function dealloc_obj_real(obj) { /* void */
    if (obj.oextra)
        dealloc_oextra(obj);

    /* clear out of date information contained in the about-to-become
       stale memory so that potential used-after-freed bugs (should never
       happen) might trigger an object lost panic instead of continuing;
       linking with a debugging malloc library is likely to do something
       similar so this is mainly useful for ordinary malloc/free */
    struct_assign(obj, cg.zeroobj);
    free(addr_of(obj));
}

/* free all the objects marked for deletion */
export function dobjsfree() { /* void */
    let otmp;

    while (go.objs_deleted) {
        otmp = go.objs_deleted;
        go.objs_deleted = otmp.nobj;
        if (otmp.where != OBJ_DELETED)
            panic(_("dobjsfree: obj where=%d, not OBJ_DELETED"), otmp.where);
        obj_extract_self(otmp);
        dealloc_obj_real(otmp);
    }
}

/* create an object from a horn of plenty; mirrors bagotricks(makemon.c) */
export function hornoplenty(
    horn,
    tipping,
    targetbox) { /* int */ /* if non-Null, container to tip into */
    let objcount = 0;

    if (!horn || horn.otyp != HORN_OF_PLENTY) {
        impossible(_("bad horn o' plenty"));
    } else if (horn.spe < 1) {
        pline1(nothing_happens());
        if (!horn.cknown) {
            horn.cknown = 1;
            update_inventory();
        }
    } else {
        let obj;
        let what;

        consume_obj_charge(horn, +!tipping);
        if (!rn2(13)) {
            obj = mkobj(POTION_CLASS, FALSE);
            if (objects[obj.otyp].oc_magic) {
                do {
                    obj.otyp = rnd_class(POT_BOOZE, POT_WATER);
                } while (obj.otyp == POT_SICKNESS);
                /* oil uses obj->age field differently from other potions */
                if (obj.otyp == POT_OIL)
                    fixup_oil(obj, null);
            }
            what = (obj.quan > 1) ? _("Some potions") : _("A potion");
        } else {
            obj = mkobj(FOOD_CLASS, FALSE);
            if (obj.otyp == FOOD_RATION && !rn2(7))
                obj.otyp = LUMP_OF_ROYAL_JELLY;
            what = _("Some food");
        }
        ++objcount;
        pline(_("%s %s out."), what, vtense(what, _("spill")));
        obj.blessed = horn.blessed;
        obj.cursed = horn.cursed;
        obj.owt = unsigned(weight(obj));
        /* using a shop's horn of plenty entails a usage fee and also
           confers ownership of the created item to the shopkeeper */
        if (horn.unpaid)
            addtobill(obj, FALSE, FALSE, tipping);
        /* if it ended up on bill, we don't want "(unpaid, N zorkmids)"
           being included in its formatted name during next message */
        iflags.suppress_price++;
        if (!tipping) {
            obj = hold_another_object(obj,
                                      u.uswallow
                                        ? _("Oops!  %s out of your reach!")
                                        : (Is_airlevel(u.uz)
                                           || Is_waterlevel(u.uz)
                                           || levl()[u.ux][u.uy].typ < IRONBARS
                                           || levl()[u.ux][u.uy].typ >= ICE)
                                          ? _("Oops!  %s away from you!")
                                          : _("Oops!  %s to the floor!"),
                                      The(aobjnam(obj, _("slip"))), 0);
            (obj);
        } else if (targetbox) {
            add_to_container(targetbox, obj);
            /* add to container doesn't update the weight */
            targetbox.owt = unsigned(weight(targetbox));
            /* item still in magic horn was weightless; when it's now in
               a carried container, hero's encumbrance could change */
            if (carried(targetbox)) {
                encumber_msg();
                update_inventory(); /* for contents count or wizweight */
            }
        } else {
            /* assumes this is taking place at hero's location */
            if (!can_reach_floor(TRUE)) {
                hitfloor(obj, TRUE); /* does altar check, message, drop */
            } else {
                if (IS_ALTAR(levl()[u.ux][u.uy].typ))
                    doaltarobj(obj); /* does its own drop message */
                else
                    pline(_("%s %s to the %s."), Doname2(obj),
                          otense(obj, _("drop")), surface(u.ux, u.uy));
                dropy(obj);
            }
        }
        iflags.suppress_price--;
        if (horn.dknown)
            makeknown(HORN_OF_PLENTY);
    }
    return objcount;
}

/* support for wizard-mode's `sanity_check' option */

const ofmt0 = init_string(static_array("ofmt0", char, sizeof_string("%s obj %s %s: %s")), _("%s obj %s %s: %s"), true);
const ofmt3 = init_string(static_array("ofmt3", char, sizeof_string("%s [not null] %s %s: %s")), _("%s [not null] %s %s: %s"), true);

const mfmt1 = init_string(static_array("mfmt1", char, sizeof_string("%s obj %s %s (%s)")), _("%s obj %s %s (%s)"), true);
const mfmt2 = init_string(static_array("mfmt2", char, sizeof_string("%s obj %s %s (%s) *not*")), _("%s obj %s %s (%s) *not*"), true);

/* Check all object lists for consistency. */
export function obj_sanity_check() { /* void */
    const $frame = stack_frame(); try {
    let x, y;
    let obj, otop, prevo;

    objlist_sanity(fobj(), OBJ_FLOOR, _("floor sanity"));

    /* check that the map's record of floor objects is consistent;
       those objects should have already been sanity checked via
       the floor list so container contents are skipped here */
    for (x = 0; x < COLNO; x++)
        for (y = 0; y < ROWNO; y++) {
            let at_fmt = stack_array(char, BUFSZ);

            otop = svl.level.objects[x][y];
            prevo = null;
            for (obj = otop; obj; prevo = obj, obj = prevo.v.v_nexthere) {
                /* <ox,oy> should match <x,y>; <0,*> should always be empty */
                if (obj.where != OBJ_FLOOR || x == 0
                    || obj.ox != x || obj.oy != y) {
                    sprintf(at_fmt, _("%%s obj@<%d,%d> %%s %%s: %%s@<%d,%d>"), x, y, obj.ox, obj.oy)
;
                    insane_object(obj, at_fmt, _("location sanity"),
                                  null);

                /* when one or more boulders are present, they should always
                   be at the top of their pile; also never in water or lava */
                } else if (obj.otyp == BOULDER) {
                    if (prevo && prevo.otyp != BOULDER) {
                        sprintf(at_fmt, _("%%s boulder@<%d,%d> %%s %%s: not on top"), x, y)

;
                        insane_object(obj, at_fmt, _("boulder sanity"),
                                      null);
                    }
                    if (is_pool_or_lava(x, y)) {
                        sprintf(at_fmt, _("%%s boulder@<%d,%d> %%s %%s: on/in %s"), x, y, is_pool(x, y) ? _("water") : _("lava"))

;
                        insane_object(obj, at_fmt, _("boulder sanity"),
                                      null);
                    }
                }
            }
        }

    objlist_sanity(gi.invent, OBJ_INVENT, _("invent sanity"));
    objlist_sanity(gm.migrating_objs, OBJ_MIGRATING, _("migrating sanity"));
    objlist_sanity(svl.level.buriedobjlist, OBJ_BURIED, _("buried sanity"));
    objlist_sanity(gb.billobjs, OBJ_ONBILL, _("bill sanity"));
    objlist_sanity(go.objs_deleted, OBJ_DELETED, _("deleted object sanity"));

    mon_obj_sanity(fmon(), _("minvent sanity"));
    mon_obj_sanity(gm.migrating_mons, _("migrating minvent sanity"));
    /* monsters temporarily in transit;
       they should have arrived with hero by the time we get called */
    if (gm.mydogs) {
        impossible(_("gm.mydogs sanity [not empty]"));
        mon_obj_sanity(gm.mydogs, _("mydogs minvent sanity"));
    }

    /* objects temporarily freed from invent/floor lists;
       they should have arrived somewhere by the time we get called */
    if (gt.thrownobj)
        insane_object(gt.thrownobj, ofmt3, _("thrownobj sanity"),
                      null);
    if (gk.kickedobj)
        insane_object(gk.kickedobj, ofmt3, _("kickedobj sanity"),
                      null);
    /* returning_missile temporarily remembers thrownobj and should be
       Null in between moves */
    if (iflags.returning_missile)
        insane_object(gk.kickedobj, ofmt3, _("returning_missile sanity"),
                      null);
    /* gc.current_wand isn't removed from invent while in use, but should
       be Null between moves when we're called */
    if (gc.current_wand)
        insane_object(gc.current_wand, ofmt3, _("current_wand sanity"),
                      null);
    } finally { stack_pop($frame); }
}

/* sanity check for objects on specified list (fobj, &c) */
function objlist_sanity(objlist, wheretype, mesg) { /* void */
    const $frame = stack_frame(); try {
    let obj;

    for (obj = objlist; obj; obj = obj.nobj) {
        if (obj.where != wheretype)
            insane_object(obj, ofmt0, mesg, null);
        if (obj.where == OBJ_INVENT && obj.how_lost != LOST_NONE) {
            let lostbuf = stack_array(char, 40);

            /* %d: bitfield is unsigned but narrow, so promotes to int */
            sprintf(lostbuf, _("how_lost=%d obj in inventory!"), obj.how_lost);
            insane_object(obj, ofmt0, lostbuf, null);
        }
        if (Has_contents(obj)) {
            if (wheretype == OBJ_ONBILL)
                /* containers on shop bill should always be empty */
                insane_object(obj, _("%s obj contains something! %s %s: %s"),
                              mesg, null);
            check_contained(obj, mesg);
        }
        if (obj.unpaid || obj.no_charge) {
            shop_obj_sanity(obj, mesg);
        }
        if (obj.owornmask) {
            let maskbuf = stack_array(char, 40);
            let bc_ok = FALSE;

            switch (obj.where) {
            case OBJ_INVENT:
            case OBJ_MINVENT:
                sanity_check_worn(obj);
                break;
            case OBJ_MIGRATING:
                /* migrating objects overload the owornmask field
                   with a destination code; skip attempt to check it */
                break;
            case OBJ_FLOOR:
                /* note: ball and chain can also be OBJ_FREE, but not across
                   turns so this sanity check shouldn't encounter that */
                bc_ok = TRUE;
            /* FALLTHROUGH */;
            /*FALLTHRU*/
            default:
                if ((obj != uchain && obj != uball) || !bc_ok) {
                    /* discovered an object not in inventory which
                       erroneously has worn mask set */
                    sprintf(maskbuf, _("worn mask 0x%08llx"), obj.owornmask);
                    insane_object(obj, ofmt0, maskbuf, null);
                }
                break;
            }
        }
        if (obj.otyp == LEASH && obj.corpsenm) {
            let buf = stack_array(char, BUFSZ);
            let mtmp = find_mid(unsigned(obj.corpsenm), FM_FMON);

            if (obj.where == OBJ_INVENT) {
                if (!mtmp) { /* found leash with phantom mon */
                    sprintf(buf, _("leashmon=%u no monst,"), unsigned(obj.corpsenm))
;
                    insane_object(obj, ofmt0, buf, null);
                } else if (!mtmp.mleashed) { /* found leashed mon
                                               * not flagged as leashed */
                    sprintf(buf, _("leashmon=%u %s not leashed,"), unsigned(obj.corpsenm), mon_pmname(mtmp))
;
                    insane_object(obj, ofmt0, buf, null);
                }

            /* have to explicitly exclude migrating_objs because the
               obj->migr_species field overlays obj->corpsenm just like
               obj->leashmon does, so obj->leashmon and consequently 'mtmp'
               might be inaccurate for any leash found on migrating_objs */
            } else if (obj.where != OBJ_MIGRATING) {
                let mtmp2 = (obj.where == OBJ_MINVENT)
                                      ? obj.v.v_ocarry : null;

                if (mtmp) { /* found monst leashed by non-invent leash */
                    sprintf(buf, _("leashmon:%u %s leashed by %s leash,"), unsigned(obj.corpsenm), mon_pmname(mtmp), where_name(obj))

;
                    insane_object(obj, ofmt0, buf, mtmp2);
                } else { /* found non-invent leash with m_id of phantom mon */
                    sprintf(buf, _("leashmon:%u no monst for %s leash,"), unsigned(obj.corpsenm), where_name(obj))
;
                    insane_object(obj, ofmt0, buf, mtmp2);
                }
            }
        }
        if (obj.globby)
            check_glob(obj, mesg);
        /* temporary flags that might have been set but which should
           be clear by the time this sanity check is taking place */
        if (obj.in_use || obj.bypass || obj.nomerge
            || (obj.otyp == BOULDER && obj.corpsenm))
            insane_obj_bits(obj, null);
    }
    } finally { stack_pop($frame); }
}

/* check obj->unpaid and obj->no_charge for shop sanity; caller has
   verified that at least one of them is set */
function shop_obj_sanity(obj, mesg) { /* void */
    const $frame = stack_frame(); try {
    let otop;
    let shkp;
    let why;
    let costly, costlytoo;
    let x = stack_var(coordxy, 0), y = stack_var(coordxy, 0);

    /* if contained, get top-most container; we needs its location */
    otop = obj;
    while (otop.where == OBJ_CONTAINED)
        otop = otop.v.v_ocontainer;
    /* get obj's or its container's location; do not update obj->ox,oy
       or otop->ox,oy because that would cause sanity checking to
       produce side-effects that won't occur when not sanity checking;
       no need for CONTAINED_TOO because we have a top level container */
    get_obj_location(otop, x, y, BURIED_TOO);

    /* these will always be needed for the normal case, so don't bother
       waiting until we find an insanity to fetch them */
    shkp = find_objowner(obj, x[0], y[0]);
    if (shkp && obj.where == OBJ_ONBILL)
        x[0] = shkp.mx, y[0] = shkp.my;
    costly = costly_spot(x[0], y[0]);
    costlytoo = costly_adjacent(shkp, x[0], y[0]);

    why = 0;
    if (obj.no_charge && obj.unpaid) {
        why = _("%s obj both unpaid and no_charge! %s %s: %s");
    } else if (obj.unpaid) {
        /* unpaid is only applicable for directly carried objects, for
           objects inside carried containers, for used up items on the
           billobjs list, and for floor items outside the shop proper
           but within the shop boundary (walls, door, "free spot") and
           for objects moved from such spots into the shop proper by
           repair of shop walls or items buried while on boundary */
        if (otop.where != OBJ_INVENT
            && obj.where != OBJ_ONBILL /* when on bill, obj==otop */
            && ((otop.where != OBJ_FLOOR && obj.where != OBJ_BURIED)
                || !(costly || costlytoo)))
            why = _("%s unpaid obj not carried! %s %s: %s");
        else if (!costly && !costlytoo)
            why = _("%s unpaid obj not inside tended shop! %s %s: %s");
        else if (!shkp)
            why = _("%s unpaid obj inside untended shop! %s %s: %s");
        else if (!onshopbill(obj, shkp, TRUE))
            why = _("%s unpaid obj not on shop bill! %s %s: %s");
    } else if (obj.no_charge) {
        /* no_charge is only applicable for floor objects in shops, for
           objects inside floor containers in shops, and for objects buried
           beneath the shop floor or carried by a monster (usually pet) */
        if (otop.where != OBJ_FLOOR
            && otop.where != OBJ_BURIED
            && otop.where != OBJ_MINVENT)
            why = _("%s no_charge obj not on floor! %s %s: %s");
        else if (!costly && !costlytoo)
            why = _("%s no_charge obj not inside tended shop! %s %s: %s");
        else if (!shkp)
            why = _("%s no_charge obj inside untended shop! %s %s: %s");
        else if (onshopbill(obj, shkp, TRUE))
            why = _("%s no_charge obj on shop bill! %s %s: %s");
    }
    if (why)
        insane_object(obj, why, mesg,
                      mcarried(otop) ? otop.v.v_ocarry : null);
    return;
    } finally { stack_pop($frame); }
}

/* sanity check for objects carried by all monsters in specified list */
function mon_obj_sanity(monlist, mesg) { /* void */
    let mon;
    let obj, mwep;

    for (mon = monlist; mon; mon = mon.nmon) {
        if (DEADMONSTER(mon))
            continue;
        mwep = MON_WEP(mon); /* mon->mw */
        if (mwep) {
            if (!mcarried(mwep))
                insane_object(mwep, mfmt1, mesg, mon);
            if (mwep.v.v_ocarry != mon)
                insane_object(mwep, mfmt2, mesg, mon);
        }
        for (obj = mon.minvent; obj; obj = obj.nobj) {
            if (obj.where != OBJ_MINVENT)
                insane_object(obj, mfmt1, mesg, mon);
            if (obj.v.v_ocarry != mon)
                insane_object(obj, mfmt2, mesg, mon);
            if (obj.globby)
                check_glob(obj, mesg);
            check_contained(obj, mesg);
            if (obj.unpaid || obj.no_charge)
                shop_obj_sanity(obj, mesg);
            if (obj.in_use || obj.bypass || obj.nomerge
                || (obj.otyp == BOULDER && obj.corpsenm))
                insane_obj_bits(obj, mon);
            if (obj == mwep)
                mwep = null;
        }
        if (mwep) {
            /* this is a monster check rather than an object check, but doing
               it here avoids making an extra pass through mon's minvent;
               if the full pass through that list hasn't reset mwep to Null,
               then mwep isn't in that list where it should be */
            impossible(_("monst (%s: %u) wielding %s (%u) not in %s inventory"),
                       pmname(mon.data, Mgender(mon)), mon.m_id,
                       safe_typename(mwep.otyp), mwep.o_id, mhis(mon));
        }
    }
}

function insane_obj_bits(obj, mon) { /* void */
    const $frame = stack_frame(); try {
    let o_in_use, o_bypass, o_nomerge, o_boulder;

    if (obj.where == OBJ_DELETED)
        return; /* skip bit checking for deleted objects */

    o_in_use = obj.in_use;
    o_bypass = obj.bypass;
    /* having obj->nomerge be set might be intentional */
    o_nomerge = (obj.nomerge && !nomerge_exception(obj) ? 1 : 0);
    /* next_boulder is only for object name formatting when pushing
       boulders and should be reset by time of next sanity check */
    o_boulder = (obj.otyp == BOULDER && obj.corpsenm ? 1 : 0);

    if (o_in_use || o_bypass || o_nomerge || o_boulder) {
        let infobuf = stack_array(char, QBUFSZ);

        sprintf(infobuf, _("flagged%s%s%s%s"), o_in_use ? _(" in_use") : _(""), o_bypass ? _(" bypass") : _(""), o_nomerge ? _(" nomerge") : _(""), o_boulder ? _(" nxtbldr") : _(""))

;
        insane_object(obj, ofmt0, infobuf, mon);
    }
    } finally { stack_pop($frame); }
}

/* does 'obj' use the 'nomerge' flag persistently? */
function nomerge_exception(obj) { /* boolean */
    /* special prize objects for achievement tracking are set 'nomerge'
       until they get picked up by the hero */
    if (is_mines_prize(obj) || is_soko_prize(obj))
        return TRUE;

    return FALSE;
}

/* This must stay consistent with the defines in obj.h. */
const obj_state_names = static_array("obj_state_names", ptr_to(char), NOBJ_STATES, [
    _("free"), _("floor"), _("contained"), _("invent"),
    _("minvent"), _("migrating"), _("buried"), _("onbill"),
    _("luafree"), _("deleted"),
]);

function where_name(obj) { /* const char * */
    let unknown = static_array("where_name.unknown", char, 32); /* big enough to handle rogue 64-bit int */
    let where;

    if (!obj)
        return _("nowhere");
    where = obj.where;
    if (where < 0 || where >= NOBJ_STATES || !obj_state_names[where]) {
        sprintf(unknown, _("unknown[%d]"), where);
        return unknown;
    }
    return obj_state_names[where];
}

function insane_object(
    obj,
    fmt,
    mesg,
    mon) { /* void */
    const $frame = stack_frame(); try {
    let objnm, monnm;
    let altfmt = stack_array(char, BUFSZ);

    objnm = monnm = _("null!");
    if (obj) {
        iflags.override_ID++;
        objnm = doname(obj);
        iflags.override_ID--;
    }
    if (mon || (strstri(mesg, _("minvent")) && !strstri(mesg, _("contained")))) {
        strcat(strcpy(altfmt, fmt), _(" held by mon %s (%s)"));
        if (mon)
            monnm = x_monnam(mon, ARTICLE_A, 0, EXACT_NAME, TRUE);
        impossible(altfmt, mesg, fmt_ptr(addr_of(obj)), where_name(obj),
                   objnm, fmt_ptr(addr_of(mon)), monnm);
    } else {
        impossible(fmt, mesg, fmt_ptr(addr_of(obj)), where_name(obj),
                   objnm);
    }
    } finally { stack_pop($frame); }
}

/* initialize a dummy obj with just enough info to allow some of the tests in
   obj.h that take an obj pointer to work; used when applying a stethoscope
   toward a mimic mimicking an object */
export function init_dummyobj(obj, otyp, oquan) { /* struct obj * */
     if (obj) {
         struct_assign(obj, cg.zeroobj);
         obj.otyp = otyp;
         obj.oclass = objects[otyp].oc_class;
         /* obj->dknown = 0; */
         /* suppress known except for amulets (needed for fakes & real AoY) */
         obj.known = (obj.oclass == AMULET_CLASS)
                         ? obj.known
                         /* default is "on" for types which don't use it */
                         : +!objects[otyp].oc_uses_known;
         obj.quan = oquan ? oquan : 1;
         obj.corpsenm = NON_PM; /* suppress statue and figurine details */
         if (obj.otyp == LEASH)
             obj.corpsenm = 0; /* overloads corpsenm, avoid NON_PM */
         if (obj.otyp == BOULDER)
             obj.corpsenm = 0; /* overloads corpsenm, avoid NON_PM */
         /* but suppressing fruit details leads to "bad fruit #0" */
         if (obj.otyp == SLIME_MOLD)
             obj.spe = svc.context.current_fruit;
     }
     return obj;
}

/* obj sanity check: check objects inside container */
function check_contained(container, mesg) { /* void */
    const $frame = stack_frame(); try {
    let obj;
    /* big enough to work with, not too big to blow out stack in recursion */
    let mesgbuf = stack_array(char, 40), nestedmesg = stack_array(char, 120);

    if (!Has_contents(container))
        return;
    /* change "invent sanity" to "contained invent sanity"
       but leave "nested contained invent sanity" as is */
    if (!strstri(mesg, _("contained")))
        mesg = strcat(strcpy(mesgbuf, _("contained ")), mesg);

    for (obj = container.cobj; obj; obj = obj.nobj) {
        /* catch direct cycle to avoid unbounded recursion */
        if (obj == container)
            panic(_("failed sanity check: container holds itself"));
        if (obj.where != OBJ_CONTAINED)
            insane_object(obj, _("%s obj %s %s: %s"), mesg, null);
        else if (obj.v.v_ocontainer != container)
            impossible(_("%s obj %s in container %s, not %s"), mesg,
                  fmt_ptr(addr_of(obj)),
                  fmt_ptr(addr_of(obj.v.v_ocontainer)),
                  fmt_ptr(addr_of(container)));
        if (obj.globby)
            check_glob(obj, mesg);

        if (Has_contents(obj)) {
            /* catch most likely indirect cycle; we won't notice if
               parent is present when something comes before it, or
               notice more deeply embedded cycles (grandparent, &c) */
            if (obj.cobj == container)
                panic(_("failed sanity check: container holds its parent"));
            /* change "contained... sanity" to "nested contained... sanity"
               and "nested contained..." to "nested nested contained..." */
            strcpy(nestedmesg, _("nested "));
            copynchars(eos(nestedmesg), mesg, sizeof(array_of(char, 120))
                                              - int(strlen(nestedmesg)) - 1);
            /* recursively check contents */
            check_contained(obj, nestedmesg);
        }
    }
    } finally { stack_pop($frame); }
}

/* called when 'obj->globby' is set so we don't recheck it here */
function check_glob(obj, mesg) { /* void */
    const $frame = stack_frame(); try {
    if (obj.quan != 1 || obj.owt == 0
        || obj.otyp < LOWEST_GLOB || obj.otyp > HIGHEST_GLOB

        ) {
        let mesgbuf = stack_array(char, BUFSZ), globbuf = stack_array(char, QBUFSZ);

        sprintf(globbuf, _(" glob %d,quan=%lld,owt=%u "), obj.otyp, obj.quan, obj.owt)
;
        mesg = strsubst(strcpy(mesgbuf, mesg), _(" obj "), globbuf);
        insane_object(obj, ofmt0, mesg,
                      (obj.where == OBJ_MINVENT) ? obj.v.v_ocarry : null);
    }
    } finally { stack_pop($frame); }
}
export const LOWEST_GLOB = GLOB_OF_GRAY_OOZE;
export const HIGHEST_GLOB = GLOB_OF_BLACK_PUDDING;

/* check an object in hero's or monster's inventory which has worn mask set */
function sanity_check_worn(obj) { /* void */
    const $frame = stack_frame(); try {
    let wearbits = static_array("sanity_check_worn.wearbits", ulong, null, [
        W_ARM,    W_ARMC,   W_ARMH,    W_ARMS, W_ARMG,  W_ARMF,  W_ARMU,
        W_WEP,    W_QUIVER, W_SWAPWEP, W_AMUL, W_RINGL, W_RINGR, W_TOOL,
        W_SADDLE, W_BALL,   W_CHAIN,   0
        /* [W_ART,W_ARTI are property bits for items which aren't worn] */
    ]);
    let maskbuf = stack_array(char, 60);
    let what;
    let owornmask, allmask = 0;
    let embedded = FALSE;
    let i, n = 0;

    /* use owornmask for testing and bit twiddling, but use original
       obj->owornmask for printing */
    owornmask = ulong(obj.owornmask);
    /* figure out how many bits are set, and also which are viable */
    for (i = 0; wearbits[i]; ++i) {
        if ((owornmask & wearbits[i]) != 0)
            ++n;
        allmask = or64u(allmask, wearbits[i]);
    }
    if (obj == uskin) {
        /* embedded dragon scales have an extra bit set;
           make sure it's set, then suppress it */
        embedded = TRUE;
        if ((owornmask & (W_ARM | I_SPECIAL)) == (W_ARM | I_SPECIAL))
            owornmask = and64u(owornmask, ~I_SPECIAL);
        else
            n = 0,  owornmask = ulong(~0); /* force insane_object("bogus") below */
    }
    if (n == 2 && carried(obj)
        && obj == uball && (owornmask & W_BALL) != 0
        && (owornmask & W_WEAPONS) != 0) {
        /* chained ball can be wielded/alt-wielded/quivered; if so,
          pretend it's not chained in order to check the weapon pointer
          (we've already verified the ball pointer by successfully passing
          the if-condition to get here...) */
        owornmask = and64u(owornmask, ~W_BALL);
        n = 1;
    }
    if (n > 1) {
        /* multiple bits set */
        sprintf(maskbuf, _("worn mask (multiple) 0x%08llx"), obj.owornmask);
        insane_object(obj, ofmt0, maskbuf, null);
    }
    if ((owornmask & not64u(allmask)) != 0
        || (carried(obj) && (owornmask & W_SADDLE) != 0)) {
        /* non-wearable bit(s) set */
        sprintf(maskbuf, _("worn mask (bogus)) 0x%08llx"), obj.owornmask);
        insane_object(obj, ofmt0, maskbuf, null);
    }
    if (n == 1 && (carried(obj) || (owornmask & (W_BALL | W_CHAIN)) != 0)) {
        what = 0;
        /* verify that obj in hero's invent (or ball/chain elsewhere)
           with owornmask of W_foo is the object pointed to by ufoo */
        switch (owornmask) {
        case W_ARM:
            if (obj != (embedded ? uskin : uarm))
                what = embedded ? _("skin") : _("suit");
            break;
        case W_ARMC:
            if (obj != uarmc)
                what = _("cloak");
            break;
        case W_ARMH:
            if (obj != uarmh)
                what = _("helm");
            break;
        case W_ARMS:
            if (obj != uarms)
                what = _("shield");
            break;
        case W_ARMG:
            if (obj != uarmg)
                what = _("gloves");
            break;
        case W_ARMF:
            if (obj != uarmf)
                what = _("boots");
            break;
        case W_ARMU:
            if (obj != uarmu)
                what = _("shirt");
            break;
        case W_WEP:
            if (obj != uwep)
                what = _("primary weapon");
            break;
        case W_QUIVER:
            if (obj != uquiver)
                what = _("quiver");
            break;
        case W_SWAPWEP:
            if (obj != uswapwep)
                what = u.twoweap ? _("secondary weapon") : _("alternate weapon");
            break;
        case W_AMUL:
            if (obj != uamul)
                what = _("amulet");
            break;
        case W_RINGL:
            if (obj != uleft)
                what = _("left ring");
            break;
        case W_RINGR:
            if (obj != uright)
                what = _("right ring");
            break;
        case W_TOOL:
            if (obj != ublindf)
                what = _("blindfold");
            break;
        /* case W_SADDLE: */
        case W_BALL:
            if (obj != uball)
                what = _("ball");
            break;
        case W_CHAIN:
            if (obj != uchain)
                what = _("chain");
            break;
        default:
            break;
        }
        if (what) {
            sprintf(maskbuf, _("worn mask 0x%08llx != %s"), obj.owornmask, what);
            insane_object(obj, ofmt0, maskbuf, null);
        }
    }
    if (n == 1 && (carried(obj) || (owornmask & (W_BALL | W_CHAIN)) != 0
                   || mcarried(obj))) {
        /* check for items worn in invalid slots; practically anything can
           be wielded/alt-wielded/quivered, so tests on those are limited */
        what = 0;
        if (owornmask & W_ARMOR) {
            if (obj.oclass != ARMOR_CLASS)
                what = _("armor");
            /* 3.6: dragon scale mail reverts to dragon scales when
               becoming embedded in poly'd hero's skin */
            if (embedded && !Is_dragon_scales(obj))
                what = _("skin");
        } else if (owornmask & W_WEAPONS) {
            /* monsters don't maintain alternate weapon or quiver */
            if (mcarried(obj) && (owornmask & (W_SWAPWEP | W_QUIVER)) != 0)
                what = (owornmask & W_SWAPWEP) != 0 ? _("monst alt weapon?")
                                                     : _("monst quiver?");
            /* hero can quiver gold but not wield it (hence not alt-wield
               it either); also catches monster wielding gold */
            else if (obj.oclass == COIN_CLASS
                     && (owornmask & (W_WEP | W_SWAPWEP)) != 0)
                what = (owornmask & W_WEP) != 0 ? _("weapon") : _("alt weapon");
        } else if (owornmask & W_AMUL) {
            if (obj.oclass != AMULET_CLASS)
                what = _("amulet");
        } else if (owornmask & W_RING) {
            if (obj.oclass != RING_CLASS && obj.otyp != MEAT_RING)
                what = _("ring");
        } else if (owornmask & W_TOOL) {
            if (obj.otyp != BLINDFOLD && obj.otyp != TOWEL
                && obj.otyp != LENSES)
                what = _("blindfold");
        } else if (owornmask & W_BALL) {
            if (obj.oclass != BALL_CLASS)
                what = _("chained ball");
        } else if (owornmask & W_CHAIN) {
            if (obj.oclass != CHAIN_CLASS)
                what = _("chain");
        } else if (owornmask & W_SADDLE) {
            if (obj.otyp != SADDLE)
                what = _("saddle");
        }
        if (what) {
            let oclassname = stack_array(char, 30);
            let mon = mcarried(obj) ? obj.v.v_ocarry : null;

            /* if we've found a potion worn in the amulet slot,
               this yields "worn (potion amulet)" */
            strcpy(oclassname, def_oc_syms[uchar(obj.oclass)].name);
            sprintf(maskbuf, _("worn (%s %s)"), makesingular(oclassname), what);
            insane_object(obj, ofmt0, maskbuf, mon);
        }
    }
    } finally { stack_pop($frame); }
}

/*
 * wrapper to make "near this object" convenient
 */
export function obj_nexto(otmp) { /* struct obj * */
    if (!otmp) {
        impossible(_("obj_nexto: wasn't given an object to check"));
        return null;
    }
    return obj_nexto_xy(otmp, otmp.ox, otmp.oy, TRUE);
}

/*
 * looks for objects of a particular type next to x, y
 * skips over oid if found (lets us avoid ourselves if
 * we're looking for a second type of an existing object)
 *
 * TODO: return a list of all objects near us so we can more
 * reliably predict which one we want to 'find' first
 */
export function obj_nexto_xy(obj, x, y, recurs) { /* struct obj * */
    let otmp;
    let fx, fy, ex, ey, otyp = obj.otyp;
    let dx, dy;

    /* check under our "feet" first */
    otmp = sobj_at(otyp, x, y);
    while (otmp) {
        /* don't be clever and find ourselves */
        if (otmp != obj && mergable(otmp, obj))
            return otmp;
        otmp = nxtobj(otmp, otyp, TRUE);
    }

    if (!recurs)
        return null;

    /* search in a random order */
    dx = (rn2(2) ? -1 : 1);
    dy = (rn2(2) ? -1 : 1);
    ex = x - dx;
    ey = y - dy;

    for (fx = ex; abs(fx - ex) < 3; fx += dx) {
        for (fy = ey; abs(fy - ey) < 3; fy += dy) {
            /* 0, 0 was checked above */
            if (isok(fx, fy) && (fx != x || fy != y)) {
                if ((otmp = obj_nexto_xy(obj, fx, fy, FALSE)) != null)
                    return otmp;
            }
        }
    }
    return null;
}

/*
 * Causes one object to absorb another, increasing weight
 * accordingly.  Frees obj2; obj1 remains and is returned.
 */
export function obj_absorb(obj1, obj2) { /* struct obj * */
    let otmp1, otmp2;
    let o1wt, o2wt;
    let agetmp;

    /* don't let people dumb it up */
    if (obj1 && obj2) {
        otmp1 = obj1[0];
        otmp2 = obj2[0];
        if (otmp1 && otmp2 && otmp1 != otmp2) {
            globby_bill_fixup(otmp1, otmp2);
            if (otmp1.bknown != otmp2.bknown)
                otmp1.bknown = otmp2.bknown = 0;
            if (otmp1.rknown != otmp2.rknown)
                otmp1.rknown = otmp2.rknown = 0;
            if (otmp1.greased != otmp2.greased)
                otmp1.greased = otmp2.greased = 0;
            if (otmp1.oeroded || otmp2.oeroded)
                otmp1.oeroded = otmp2.oeroded = 1;
            o1wt = int(otmp1.oeaten ? otmp1.oeaten : otmp1.owt);
            o2wt = int(otmp2.oeaten ? otmp2.oeaten : otmp2.owt);
            /* averaging the relative ages is less likely to overflow
               than averaging the absolute ages directly */
            agetmp = Math.trunc(((svm.moves - otmp1.age) * o1wt
                       + (svm.moves - otmp2.age) * o2wt)
                      / (o1wt + o2wt));
            /* convert relative age back to absolute age */
            otmp1.age = svm.moves - agetmp;
            otmp1.owt += unsigned(o2wt);
            if (otmp1.oeaten || otmp2.oeaten)
                otmp1.oeaten = unsigned(o1wt + o2wt);
            otmp1.quan = 1;
            if (otmp1.globby && otmp2.globby) {
                /* average (not weighted, no pun intended) the two globs'
                   shrink timers and use that to give otmp1 a new timer */
                let tm1 = stop_timer(SHRINK_GLOB, obj_to_any(otmp1)),
                     tm2 = stop_timer(SHRINK_GLOB, obj_to_any(otmp2));

                tm1 = Math.trunc(((tm1 ? tm1 : 25) + (tm2 ? tm2 : 25) + 1) / 2);
                start_glob_timeout(otmp1, tm1);
            }
            /* get rid of second glob, return augmented first one */
            obj_extract_self(otmp2);
            dealloc_obj(otmp2);
            obj2[0] = null;
            return otmp1;
        }
    }

    impossible(_("obj_absorb: not called with two actual objects"));
    return null;
}

/*
 * Causes the heavier object to absorb the lighter object in
 * most cases, but if one object is OBJ_FREE and the other is
 * on the floor, the floor object goes first.  Note that when
 * a globby monster dies, its corpse (new glob) will be created
 * on the floor; when a glob is dropped, thrown, or kicked it
 * will be free at the time obj_meld() gets called.
 *
 * Wrapper for obj_absorb() so that floor_effects works more
 * cleanly (since we don't know which we want to stay around).
 */
export function obj_meld(obj1, obj2) { /* struct obj * */
    let otmp1, otmp2, result = null;
    let ox, oy; /* coordinates for the glob that goes away */

    if (obj1 && obj2) {
        otmp1 = obj1[0];
        otmp2 = obj2[0];
        if (otmp1 && otmp2 && otmp1 != otmp2) {
            ox = oy = 0;
            /*
             * FIXME?
             *  If one of the objects is free because it's being dropped,
             *  we should really finish a full drop and then absorb/meld
             *  if it survives the flooreffects().  Then lighter-melds-into-
             *  heavier will be true even when heavier is the one dropped.
             *
             *  [Also, what about when one of the globs is on the shore
             *  and we drop the other into adjacent pool or vice versa?]
             */
            if (!(otmp2.where == OBJ_FLOOR && otmp1.where == OBJ_FREE)
                && (otmp1.owt > otmp2.owt
                    || (otmp1.owt == otmp2.owt && rn2(2)))) {
                if (otmp2.where == OBJ_FLOOR)
                    ox = otmp2.ox, oy = otmp2.oy;
                result = obj_absorb(obj1, obj2);
            } else {
                if (otmp1.where == OBJ_FLOOR)
                    ox = otmp1.ox, oy = otmp1.oy;
                result = obj_absorb(obj2, obj1);
            }
            /* callers really ought to take care of this; glob melding is
               a bookkeeping issue rather than a display one */
            if (ox) {
                if (cansee(ox, oy))
                    newsym(ox, oy);
                /* and this; a hides-under monster might be hiding under
                   the glob that went away; if there's nothing else there
                   to hide under, force it out of hiding */
                maybe_unhide_at(ox, oy);
            }
        }
    } else {
        impossible(_("obj_meld: not called with two actual objects"));
    }
    return result;
}

/* give a message if hero notices two globs merging [used to be in pline.c] */
export function pudding_merge_message(otmp, otmp2) { /* void */
    let visible = +(cansee(otmp.ox, otmp.oy)
                       || cansee(otmp2.ox, otmp2.oy)),
            onfloor = +(otmp.where == OBJ_FLOOR || otmp2.where == OBJ_FLOOR),
            inpack = +(carried(otmp) || carried(otmp2));

    /* the player will know something happened inside his own inventory */
    if ((!Blind() && visible) || inpack) {
        if (Hallucination()) {
            if (onfloor) {
                You_see(_("parts of the floor melting!"));
            } else if (inpack) {
                Your(_("pack reaches out and grabs something!"));
            }
            /* even though we can see where they should be,
             * they'll be out of our view (minvent or container)
             * so don't actually show anything */
        } else if (onfloor || inpack) {
            let adj = +((otmp.ox != u.ux || otmp.oy != u.uy)
                           && (otmp2.ox != u.ux || otmp2.oy != u.uy));

            pline(_("The %s%s coalesce%s."),
                  (onfloor && adj) ? _("adjacent ") : _(""),
                  makeplural(obj_typename(otmp.otyp)),
                  inpack ? _(" inside your pack") : _(""));
        }
    } else {
         ;
        You_hear(_("a faint sloshing sound."));
    }
}

/*mkobj.c*/

import { A_NONE } from "./align.h.js";
import { nothing_happens } from "./decl.h.macros.js";
import {
    AMULET_CLASS, ARMOR_CLASS, BALL_CLASS, CHAIN_CLASS, COIN_CLASS, FOOD_CLASS, GEM_CLASS,
    POTION_CLASS, RANDOM_CLASS, RING_CLASS, ROCK_CLASS, SCROLL_CLASS, SPBOOK_CLASS, S_TROLL,
    S_altar, S_brdnstair, S_brupstair, S_dnstair, S_sink, S_throne, S_trwall, S_upstair, S_vwall,
    TOOL_CLASS, VENOM_CLASS, WAND_CLASS, WEAPON_CLASS,
} from "./defsym.h.js";
import { MIGR_TO_SPECIES } from "./dungeon.h.js";
import { Inhell, Is_airlevel, Is_rogue_level, Is_waterlevel } from "./dungeon.h.macros.js";
import { PLNMSG_OBJ_GLOWS } from "./flag.h.js";
import { BUFSZ, COLNO, FALSE, LARGEST_INT, QBUFSZ, ROWNO, TRUE, coordxy } from "./global.h.js";
import {
    ARTICLE_A, CORPSTAT_FEMALE, CORPSTAT_INIT, CORPSTAT_MALE, CORPSTAT_NEUTER, CORPSTAT_NONE,
    CORPSTAT_SPE_VAL, COST_SINGLEOBJ, COST_UNBLSS, COST_UNCURS, EXACT_NAME, FM_FMON, ONAME_NO_FLAGS,
    ONAME_SKIP_INVUPD, RANDOM_TIN, ROT_AGE, SPINACH_TIN, TAINT_AGE, TROLL_REVIVE_CHANCE,
} from "./hack.h.js";
import { ROLL_FROM, makeknown, max, pline1, rn1 } from "./hack.h.macros.js";
import { debugpline1, showdebug } from "./lint.h.macros.js";
import { SHOPBASE } from "./mkroom.h.js";
import {
    is_female, is_human, is_male, is_neuter, is_rider, monsndx, verysmall,
} from "./mondata.h.macros.js";
import { G_GONE, G_HELL, G_NOCORPSE, G_NOGEN, G_NOHELL, G_UNIQ } from "./monflag.h.js";
import { MON_DETACH, struct_monst } from "./monst.h.js";
import { DEADMONSTER, MON_NOWEP, MON_WEP, ismnum, newmonst } from "./monst.h.macros.js";
import {
    LOW_PM, NON_PM, PM_ARCHEOLOGIST, PM_DEATH, PM_GRAY_OOZE, PM_HUMAN, PM_LICHEN, PM_LIZARD,
    PM_SAMURAI, PM_WIZARD, SPECIAL_PM,
} from "./monsters.h.js";
import {
    BURIED_TOO, CONTAINED_TOO, LOST_NONE, MAX_OIL_IN_FLASK, NOBJ_STATES, OBJ_BURIED, OBJ_CONTAINED,
    OBJ_DELETED, OBJ_FLOOR, OBJ_FREE, OBJ_INVENT, OBJ_LUAFREE, OBJ_MIGRATING, OBJ_MINVENT,
    OBJ_ONBILL, struct_obj, struct_oextra,
} from "./obj.h.js";
import {
    Has_contents, Is_candle, Is_container, Is_dragon_scales, Is_mbag, Is_pudding, OMAILCMD, OMID,
    OMONST, ONAME, bimanual, carried, has_omailcmd, has_omid, has_omonst, has_oname, is_mines_prize,
    is_multigen, is_poisonable, is_soko_prize, mcarried, newobj,
} from "./obj.h.macros.js";
import { DRAGON_HIDE, LIQUID, NODIR, PLASTIC, SPBOOK_no_NOVEL, WOOD } from "./objclass.h.js";
import {
    OBJ_NAME, is_corrodeable, is_crackable, is_damageable, is_rustprone,
} from "./objclass.h.macros.js";
import {
    AMULET_OF_CHANGE, AMULET_OF_RESTFUL_SLEEP, AMULET_OF_STRANGULATION, AMULET_OF_YENDOR, APPLE,
    BAG_OF_HOLDING, BAG_OF_TRICKS, BANANA, BELL_OF_OPENING, BLINDFOLD, BOULDER, BRASS_LANTERN,
    CANDELABRUM_OF_INVOCATION, CANDY_BAR, CAN_OF_GREASE, CHEST, CORPSE, CRYSTAL_BALL,
    DILITHIUM_CRYSTAL, DRUM_OF_EARTHQUAKE, EGG, ELVEN_SHIELD, EUCALYPTUS_LEAF, EXPENSIVE_CAMERA,
    FIGURINE, FIRE_HORN, FOOD_RATION, FROST_HORN, FUMBLE_BOOTS, GAUNTLETS_OF_FUMBLING,
    GLOB_OF_BLACK_PUDDING, GLOB_OF_GRAY_OOZE, GOLD_PIECE, HEAVY_IRON_BALL,
    HELM_OF_OPPOSITE_ALIGNMENT, HORN_OF_PLENTY, ICE_BOX, KELP_FROND, LARGE_BOX, LEASH, LENSES,
    LEVITATION_BOOTS, LOADSTONE, LUCKSTONE, LUMP_OF_ROYAL_JELLY, MAGIC_FLUTE, MAGIC_HARP,
    MAGIC_LAMP, MAGIC_MARKER, MEAT_RING, OILSKIN_SACK, OIL_LAMP, ORANGE, ORCISH_SHIELD, PEAR,
    POT_BOOZE, POT_OIL, POT_SICKNESS, POT_WATER, RIN_AGGRAVATE_MONSTER, RIN_HUNGER, RIN_POLYMORPH,
    RIN_TELEPORTATION, ROCK, SACK, SADDLE, SCR_MAIL, SHIELD_OF_REFLECTION, SLIME_MOLD,
    SPE_BLANK_PAPER, SPE_NOVEL, SPLINT_MAIL, STATUE, TALLOW_CANDLE, TIN, TINNING_KIT, TOWEL,
    UNICORN_HORN, WAN_CANCELLATION, WAN_FIRE, WAN_LIGHT, WAN_LIGHTNING, WAN_STASIS, WAN_WISHING,
    WAX_CANDLE, WORM_TOOTH,
} from "./objects.h.js";
import {
    FIRE_RES, I_SPECIAL, W_AMUL, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMOR, W_ARMS, W_ARMU,
    W_BALL, W_CHAIN, W_QUIVER, W_RING, W_RINGL, W_RINGR, W_SADDLE, W_SWAPWEP, W_TOOL, W_WEAPONS,
    W_WEP,
} from "./prop.h.js";
import { ICE, IRONBARS } from "./rm.h.js";
import { IS_ALTAR, fmon, fobj, levl } from "./rm.h.macros.js";
import {
    FIG_TRANSFORM, HATCH_EGG, REVIVE_MON, ROT_CORPSE, SHRINK_GLOB, TIMER_OBJECT, ZOMBIFY_MON,
} from "./timeout.h.js";
import { LS_OBJECT } from "./vision.h.js";
import { cansee } from "./vision.h.macros.js";
import { Role_if, mhis } from "./you.h.macros.js";
import { Blind, Hallucination } from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, sizeof, sizeof_string, uchar, ulong, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64, and64u, not64u, or64u } from "../rt/int64.js";
import {
    abs, assert, free, memcpy, sprintf, strcat, strchr, strcpy, strlen, strncmp,
} from "../rt/libc.js";
import { init_string, stack_array, stack_var, static_array, static_struct } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, ptr_add, ptr_to, ref_of, struct, struct_assign, view_of,
} from "../rt/struct.js";
import { stop_occupation } from "./allmain.js";
import { alloc, dupstr, fmt_ptr } from "./alloc.js";
import {
    artifact_exists, confers_luck, mk_artifact, nartifact_exist, permapoisoned,
} from "./artifact.js";
import { set_moreluck } from "./attrib.js";
import { isok } from "./cmd.js";
import { is_ice, is_pool, is_pool_or_lava } from "./dbridge.js";
import {
    cg, flags, gb, gc, gi, gk, gm, go, gt, gu, gz, hands_obj, iflags, program_state, svb, svc, svl,
    svm, u,
} from "./decl.js";
import { newsym } from "./display.js";
import { doaltarobj, dropy, obj_no_longer_held } from "./do.js";
import { Mgender, mon_pmname, noveltitle, oname, pmname, safe_oname, x_monnam } from "./do_name.js";
import { reset_remarm } from "./do_wear.js";
import { hitfloor } from "./dothrow.js";
import { def_oc_syms } from "./drawing.js";
import { In_quest, depth, level_difficulty, surface } from "./dungeon.js";
import { eaten_stat, eating_glob, set_tin_variety } from "./eat.js";
import { panic } from "./end.js";
import { can_reach_floor } from "./engrave.js";
import { in_rooms, near_capacity, obj_to_any } from "./hack.js";
import { copynchars, eos, s_suffix, strstri, strsubst } from "./hacklib.js";
import {
    consume_obj_charge, freeinv, g_at, hold_another_object, mergable, merged, nxtobj, sobj_at,
    update_inventory, useupall,
} from "./invent.js";
import {
    arti_light_radius, del_light_source, find_mid, obj_adjust_light_radius, obj_sheds_light,
    obj_split_light_source,
} from "./light.js";
import { maybe_reset_pick } from "./lock.js";
import { rndmonst_adj } from "./makemon.js";
import {
    can_be_hatched, copy_mextra, dead_species, dealloc_mextra, maybe_unhide_at, undead_to_corpse,
    zombie_form,
} from "./mon.js";
import { mons } from "./monst.js";
import { objects } from "./objects.js";
import {
    Doname2, The, Yname2, aobjnam, doname, erosion_matters, makeplural, makesingular, obj_typename,
    otense, rnd_class, safe_typename, simpleonames, vtense, xname,
} from "./objnam.js";
import { encumber_msg } from "./pickup.js";
import { You_hear, You_see, Your, impossible, pline, verbalize } from "./pline.js";
import { forget_temple_entry } from "./priest.js";
import { assign_candy_wrapper } from "./read.js";
import { rn2, rnd, rne, rnz } from "./rnd.js";
import {
    addtobill, alter_cost, billable, costly_adjacent, costly_spot, find_objowner, globby_bill_fixup,
    obfree, oid_price_adjustment, onshopbill, shop_keeper, splitbill, stolen_value, subfrombill,
    unpaid_cost,
} from "./shk.js";
import { book_cursed } from "./spell.js";
import { remove_worn_item } from "./steal.js";
import { rloco } from "./teleport.js";
import {
    attach_egg_hatch_timeout, attach_fig_transform_timeout, obj_split_timers, obj_stop_timers,
    start_timer, stop_timer,
} from "./timeout.js";
import { tt_oname } from "./topten.js";
import { block_point, recalc_block_point } from "./vision.js";
import { setmnotwielded } from "./weapon.js";
import { drop_uswapwep } from "./wield.js";
import { extract_from_minvent } from "./worn.js";
import { get_obj_location } from "./zap.js";
const __FILE__ = "mkobj.c";
