/* NetHack 5.0	invent.c	$NHDT-Date: 1762680996 2025/11/09 01:36:36 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.543 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Derek S. Ray, 2015. */
/* NetHack may be freely redistributed.  See license for details. */

/* enum and structs are defined in wintype.h */
const wri_info = static_struct("wri_info", struct_win_request_info_t);
const perminv_flags = static_var("perminv_flags", int, InvOptNone);
const in_perm_invent_toggled = static_var("in_perm_invent_toggled", schar);

/* wizards can wish for venom, which will become an invisible inventory
 * item without this.  putting it in inv_order would mean venom would
 * suddenly become a choice for all the inventory-class commands, which
 * would probably cause mass confusion.  the test for inventory venom
 * is only WIZARD and not wizard because the wizard can leave venom lying
 * around on a bones level for normal players to find.  [Note to the
 * confused:  'WIZARD' used to be a compile-time conditional so this was
 * guarded by #ifdef WIZARD/.../#endif.]
 */
const venom_inv = static_array("venom_inv", char, null, [ VENOM_CLASS, 0 ]); /* (constant) */

/* menu heading lines used instead of object classes when sorting by in-use;
   pointers aren't const because dispinv_with_action() might temporarily
   change "Accessories" to "Rings" or "Amulet", then back again */
const inuse_headers = static_array("inuse_headers", ptr_to(char), null, [ /* [4] shown first, [1] last */
    _(""), _("Miscellaneous"), _("Worn Armor"),
    _("Wielded/Readied Weapons"), _("Accessories"),
]);

/* sortloot() classification for in-use sort;
   called at most once [per sort] for each object */
function inuse_classify(sort_item, obj) { /* void */
    var w_mask = (obj.owornmask & (W_ACCESSORY | W_WEAPONS | W_ARMOR));
    var rating = 0, altclass = 0;

    /*
     * In order of importance, least to most, somewhat arbitrarily.
     *
     * For instance, all accessories are grouped together even
     * though they're usually less important than other stuff, so
     * that they appear earlier within displayed list of used items.
     * Amulet is rated as most important primarily because the
     * default 'packorder' puts amulets first (possibly because one
     * might be The Amulet).  Non-wielded alternate weapon and
     * quiver are grouped with primary weapon.  Weapons are rated
     * above armor because of default 'packorder'.
     *
     * These ratings don't match either subclasses or 'packorder'.
     *
     * USE_RATING() sets up 'rating' then jumps to 'assign_rating'
     * if 'obj' warrants that.
     */
    /* "Miscellaneous" */
    ++altclass; /* 1 */
    /* lamp and leash might be used doubly, as a tool and also wielded
       or readied-in-quiver; these tests for used-as-tool only pass
       when owornmask is 0 so that used-as-weapon takes precedence */
    assign_rating: { do { ++rating; if (((!w_mask && obj.otyp == LEASH && obj.corpsenm) != 0)) break assign_rating; } while (0);
    do { ++rating; if (((!w_mask && obj.oclass == TOOL_CLASS && obj.lamplit) != 0)) break assign_rating; } while (0);
    /* "Armor" */
    ++altclass; /* 2 */
    do { ++rating; if (((w_mask & WORN_SHIRT) != 0)) break assign_rating; } while (0);
    do { ++rating; if (((w_mask & WORN_BOOTS) != 0)) break assign_rating; } while (0);
    do { ++rating; if (((w_mask & WORN_GLOVES) != 0)) break assign_rating; } while (0);
    do { ++rating; if (((w_mask & WORN_HELMET) != 0)) break assign_rating; } while (0);
    do { ++rating; if (((w_mask & WORN_SHIELD) != 0)) break assign_rating; } while (0);
    do { ++rating; if (((w_mask & WORN_CLOAK) != 0)) break assign_rating; } while (0);
    do { ++rating; if (((w_mask & WORN_ARMOR) != 0)) break assign_rating; } while (0);
    /* "Weapons" */
    ++altclass; /* 3 */
    /* could get more complicated:  if uswapwep is just alternate weapon
       rather than wielded secondary, swap order with quiver (unless
       quiver is ammo for uswapwep without also being ammo for uwep) */
    do { ++rating; if (((w_mask & W_QUIVER) != 0)) break assign_rating; } while (0);
    do { ++rating; if (((w_mask & W_SWAPWEP) != 0)) break assign_rating; } while (0);
    do { ++rating; if (((w_mask & W_WEP) != 0)) break assign_rating; } while (0);
    /* "Accessories" */
    ++altclass; /* 4 */
    do { ++rating; if (((w_mask & WORN_BLINDF) != 0)) break assign_rating; } while (0);
    do { ++rating; if (((w_mask & (ULEFTY() ? RIGHT_RING : LEFT_RING)) != 0)) break assign_rating; } while (0); /* off hand */
    do { ++rating; if (((w_mask & (URIGHTY() ? RIGHT_RING : LEFT_RING)) != 0)) break assign_rating; } while (0); /* main hand */
    do { ++rating; if (((w_mask & WORN_AMUL) != 0)) break assign_rating; } while (0);

    /* if we get here, the USE_RATING() checks failed to find a match */
    rating = 0;
    altclass = -1; /* 'orderclass' must end up non-zero */
 }
    sort_item.inuse = rating;
    sort_item.orderclass = altclass; /* used for alternate headings */

    /* not applicable for in-use */
    sort_item.subclass = 0;
    sort_item.disco = 0;
}

/* sortloot() classification; called at most once [per sort] for each object;
   also called by '\' command if discoveries use sortloot order */
export function loot_classify(sort_item, obj) { /* void */
    /* we may eventually make this a settable option to always use
       with sortloot instead of only when the 'sortpack' option isn't
       set; it is similar to sortpack's inv_order but items most
       likely to be picked up are moved to the front */
    let def_srt_order = static_array("loot_classify.def_srt_order", char, MAXOCLASSES, [
        COIN_CLASS, AMULET_CLASS, RING_CLASS, WAND_CLASS, POTION_CLASS,
        SCROLL_CLASS, SPBOOK_CLASS, GEM_CLASS, FOOD_CLASS, TOOL_CLASS,
        WEAPON_CLASS, ARMOR_CLASS, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS, 0,
    ]);
    let armcat = static_array("loot_classify.armcat", char, 8);
    let classorder;
    let p;
    let k, otyp = obj.otyp, oclass = obj.oclass;
    let seen, discovered = objects[otyp].oc_name_known ? TRUE : FALSE;

    /*
     * For the value types assigned by this classification, sortloot()
     * will put lower valued ones before higher valued ones.
     */
    if (!Blind())
        observe_object(obj); /* xname(obj) does this; we want it sooner */
    seen = obj.dknown ? TRUE : FALSE,
    /* class order */
    classorder = flags.sortpack ? flags.inv_order : def_srt_order;
    p = strchr(classorder, oclass);
    if (p)
        k = 1 + (p - classorder);
    else
        k = 1 + int(strlen(classorder)) + +(oclass != VENOM_CLASS);
    sort_item.orderclass = k;
    /* subclass designation; only a few classes have subclasses
       and the non-armor ones we use are fairly arbitrary */
    switch (oclass) {
    case ARMOR_CLASS:
        if (!chars[armcat + 7]) {
            /* one-time init; we use a different order than the subclass
               values defined by objclass.h */
            chars[armcat + ARM_HELM]   = 1; /* [2] */
            chars[armcat + ARM_GLOVES] = 2; /* [3] */
            chars[armcat + ARM_BOOTS]  = 3; /* [4] */
            chars[armcat + ARM_SHIELD] = 4; /* [1] */
            chars[armcat + ARM_CLOAK]  = 5; /* [5] */
            chars[armcat + ARM_SHIRT]  = 6; /* [6] */
            chars[armcat + ARM_SUIT]   = 7; /* [0] */
            chars[armcat + 7]          = 8; /* sanity protection */
        }
        k = objects[otyp].oc_subtyp;
        /* oc_armcat overloads oc_subtyp which is an 'schar' so guard
           against somebody assigning something unexpected to it */
        if (k < 0 || k >= 7)
            k = 7;
        k = chars[armcat + k];
        break;
    case WEAPON_CLASS:
        /* for weapons, group by ammo (arrows, bolts), launcher (bows),
           missile (darts, boomerangs), stackable (daggers, knives, spears),
           'other' (swords, axes, &c), polearms */
        k = objects[otyp].oc_subtyp;
        k = (k < 0) ? ((k >= -P_CROSSBOW && k <= -P_BOW) ? 1 : 3)
                    : ((k >= P_BOW && k <= P_CROSSBOW) ? 2
                       : (k == P_SPEAR || k == P_DAGGER || k == P_KNIFE) ? 4
                          : !is_pole(obj) ? 5 : 6);
        break;
    case TOOL_CLASS:
        if (seen && discovered
            && (otyp == BAG_OF_TRICKS || otyp == HORN_OF_PLENTY))
            k = 2; /* known pseudo-container */
        else if (Is_container(obj))
            k = 1; /* regular container or unknown bag of tricks */
        else
            switch (otyp) {
            case WOODEN_FLUTE:
            case MAGIC_FLUTE:
            case TOOLED_HORN:
            case FROST_HORN:
            case FIRE_HORN:
            case WOODEN_HARP:
            case MAGIC_HARP:
            case BUGLE:
            case LEATHER_DRUM:
            case DRUM_OF_EARTHQUAKE:
            case HORN_OF_PLENTY: /* not a musical instrument */
                k = 3; /* instrument or unknown horn of plenty */
                break;
            default:
                k = 4; /* 'other' tool */
                break;
            }
        break;
    case FOOD_CLASS:
        /* [what about separating "partly eaten" within each group?] */
        switch (otyp) {
        case SLIME_MOLD:
            k = 1;
            break;
        default:
            /* [maybe separate one-bite foods from rations and such?] */
            k = obj.globby ? 6 : 2;
            break;
        case TIN:
            k = 3;
            break;
        case EGG:
            k = 4;
            break;
        case CORPSE:
            k = 5;
            break;
        }
        break;
    case GEM_CLASS:
        /*
         * Normally subclass takes priority over discovery status, but
         * that would give away information for gems (assuming we'll
         * group them as valuable gems, next glass, then gray stones,
         * and finally rocks once they're all fully identified).
         *
         * Order:
         *  1) unseen gems and glass ("gem")
         *  2) seen but undiscovered gems and glass ("blue gem"),
         *  3) discovered gems ("sapphire"),
         *  4) discovered glass ("worthless pieced of blue glass"),
         *  5) unseen gray stones and rocks ("stone"),
         *  6) seen but undiscovered gray stones ("gray stone"),
         *  7) discovered gray stones ("touchstone"),
         *  8) seen rocks ("rock").
         */
        switch (objects[obj.otyp].oc_material) {
        case GEMSTONE:
            k = !seen ? 1 : !discovered ? 2 : 3;
            break;
        case GLASS:
            k = !seen ? 1 : !discovered ? 2 : 4;
            break;
        default: /* MINERAL */
            k = !seen ? 5 : (obj.otyp != ROCK) ? (!discovered ? 6 : 7) : 8;
            break;
        }
        break;
    default:
        /* other classes don't have subclasses; we assign a nonzero
           value because sortloot() uses 0 to mean 'not yet classified' */
        k = 1; /* any non-zero would do */
        break;
    }
    sort_item.subclass = k;
    /* discovery status */
    k = !seen ? 1 /* unseen */
        : (discovered || !OBJ_DESCR(objects[otyp])) ? 4
          : (objects[otyp].oc_uname) ? 3 /* named (partially discovered) */
            : 2; /* undiscovered */
    sort_item.disco = k;
    /* not applicable */
    sort_item.inuse = 0;
}

/* sortloot() formatting routine; for alphabetizing, not shown to user */
function loot_xname(obj) { /* char * */
    const $frame = stack_frame(); try {
    let saveo = stack_struct(struct_obj);
    let save_debug;
    let res, save_oname;

    /*
     * Deal with things that xname() includes as a prefix.  We don't
     * want such because they change alphabetical ordering.  First,
     * remember 'obj's current settings.
     */
    saveo.oeroded = obj.oeroded;
    saveo.blessed = obj.blessed, saveo.cursed = obj.cursed;
    saveo.spe = obj.spe;
    saveo.owt = obj.owt;
    save_oname = has_oname(obj) ? ONAME(obj) : 0;
    save_debug = flags.debug;
    /* suppress "diluted" for potions and "holy/unholy" for water;
       sortloot() will deal with them using other criteria than name */
    if (obj.oclass == POTION_CLASS) {
        obj.oeroded = 0;
        if (obj.otyp == POT_WATER)
            obj.blessed = 0, obj.cursed = 0;
    }
    /* make "wet towel" and "moist towel" format as "towel" so that all
       three group together */
    if (obj.otyp == TOWEL)
        obj.spe = 0;
    /* group globs by monster type rather than by size:  force all to
       have the same size adjective hence same "small glob of " prefix */
    if (obj.globby)
        obj.owt = 20; /* weight of a fresh glob (one pudding's worth) */
    /* suppress user-assigned name */
    if (save_oname && !obj.oartifact)
        ((obj).oextra.oname) = 0;
    /* avoid wizard mode formatting variations */
    if (wizard()) { /* flags.debug */
        /* paranoia:  before toggling off wizard mode, guard against a
           panic in xname() producing a normal mode panic save file */
        program_state.something_worth_saving = 0;
        flags.debug = FALSE;
    }

    res = cxname_singular(obj);

    if (save_debug) {
        flags.debug = TRUE;
        program_state.something_worth_saving = 1;
    }
    /* restore the object */
    if (obj.oclass == POTION_CLASS) {
        obj.oeroded = saveo.oeroded;
        if (obj.otyp == POT_WATER)
            obj.blessed = saveo.blessed, obj.cursed = saveo.cursed;
    }
    if (obj.otyp == TOWEL) {
        obj.spe = saveo.spe;
        /* give "towel" a suffix that will force wet ones to come first,
           moist ones next, and dry ones last regardless of whether
           they've been flagged as having spe known */
        strcat(res, is_wet_towel(obj) ? ((obj.spe >= 3) ? _("x") : _("y")) : _("z"));
    }
    if (obj.globby) {
        obj.owt = saveo.owt;
        /* we've suppressed the size prefix (above); there normally won't
           be more than one of a given creature type because they coalesce,
           but globs with different bless/curse state won't merge so it is
           feasible to have multiple at the same location; add a suffix to
           get such sorted by size (small first) */
        strcat(res, (obj.owt <= 100) ? _("a")
                    : (obj.owt <= 300) ? _("b")
                      : (obj.owt <= 500) ? _("c")
                        : _("d"));
    }
    if (save_oname && !obj.oartifact)
        ((obj).oextra.oname) = save_oname;

    return res;
    } finally { stack_pop($frame); }
}

/* '$'==1, 'a'-'z'==2..27, 'A'-'Z'==28..53, '#'==54, catchall 55 */
function invletter_value(c) { /* int */
    return (ord('a') <= c && c <= ord('z')) ? (c - ord('a') + 2)
           : (ord('A') <= c && c <= ord('Z')) ? (c - ord('A') + 2 + 26)
             : (c == ord('$')) ? 1
               : (c == ord('#')) ? 1 + invlet_basic + 1
                 : 1 + invlet_basic + 1 + 1; /* none of the above
                                              * (shouldn't happen) */
}

/* qsort comparison routine for sortloot() */
function sortloot_cmp(vptr1, vptr2) { /* int QSORTCALLBACK */
    var sli1 = view_of(struct_sortloot_item, vptr1),
                         sli2 = view_of(struct_sortloot_item, vptr2);
    var obj1 = sli1.obj,
               obj2 = sli2.obj;
    var nam1, nam2, tmpstr;
    var val1, val2, namcmp;

    /* in-use takes precedence over all others */
    tiebreak: { if ((gs.sortlootmode & SORTLOOT_INUSE) != 0) {
        /* Classify each object at most once no matter how many
           comparisons it is involved in. */
        if (!sli1.orderclass)
            inuse_classify(sli1, obj1);
        if (!sli2.orderclass)
            inuse_classify(sli2, obj2);

        val1 = sli1.inuse;
        val2 = sli2.inuse;
        if (val1 != val2)
            return val2 - val1; /* bigger value comes before smaller */
        /* neither item in use (or both are lit lamps/candles or both are
           attached leashes; items using owornmask don't produce ties) */
        break tiebreak;
    }

    /* order by object class unless we're doing by-invlet without sortpack */
    if ((gs.sortlootmode & (SORTLOOT_PACK | SORTLOOT_INVLET))
        != SORTLOOT_INVLET) {
        /* Classify each object at most once no matter how many
           comparisons it is involved in. */
        if (!sli1.orderclass)
            loot_classify(sli1, obj1);
        if (!sli2.orderclass)
            loot_classify(sli2, obj2);

        /* Sort by class. */
        val1 = sli1.orderclass;
        val2 = sli2.orderclass;
        if (val1 != val2)
            return val1 - val2;

        /* skip sub-classes when ordering by sortpack+invlet */
        if ((gs.sortlootmode & SORTLOOT_INVLET) == 0) {
            /* Class matches; sort by subclass. */
            val1 = sli1.subclass;
            val2 = sli2.subclass;
            if (val1 != val2)
                return val1 - val2;

            /* Class and subclass match; sort by discovery status:
             * first unseen, then seen but not named or discovered,
             * then named, lastly discovered.
             * 1) potion
             * 2) pink potion
             * 3) dark green potion called confusion
             * 4) potion of healing
             * Multiple entries within each group will be put into
             * alphabetical order below.
             */
            val1 = sli1.disco;
            val2 = sli2.disco;
            if (val1 != val2)
                return val1 - val2;
        }
    }

    /* order by assigned inventory letter */
    if ((gs.sortlootmode & SORTLOOT_INVLET) != 0) {
        val1 = invletter_value(obj1.invlet);
        val2 = invletter_value(obj2.invlet);
        if (val1 != val2)
            return val1 - val2;
    }

    if ((gs.sortlootmode & SORTLOOT_LOOT) == 0)
        break tiebreak;;

    /*
     * Sort object names in lexicographical order, ignoring quantity.
     *
     * Each obj gets formatted at most once (per sort) no matter how many
     * comparisons it gets subjected to.
     */
    nam1 = sli1.str;
    if (!nam1) {
        tmpstr = loot_xname(obj1);
        nam1 = sli1.str = dupstr(tmpstr);
        maybereleaseobuf(tmpstr);
    }
    nam2 = sli2.str;
    if (!nam2) {
        tmpstr = loot_xname(obj2);
        nam2 = sli2.str = dupstr(tmpstr);
        maybereleaseobuf(tmpstr);
    }
    if ((namcmp = strcmpi(nam1, nam2)) != 0)
        return namcmp;

    /* Sort by BUCX. */
    val1 = obj1.bknown ? (obj1.blessed ? 3 : !obj1.cursed ? 2 : 1) : 0;
    val2 = obj2.bknown ? (obj2.blessed ? 3 : !obj2.cursed ? 2 : 1) : 0;
    if (val1 != val2)
        return val2 - val1; /* bigger is better */

    /* Sort by greasing.  This will put the objects in degreasing order. */
    val1 = obj1.greased;
    val2 = obj2.greased;
    if (val1 != val2)
        return val2 - val1; /* bigger is better */

    /* Sort by erosion.  The effective amount is what matters. */
    val1 = greatest_erosion(obj1);
    val2 = greatest_erosion(obj2);
    if (val1 != val2)
        return val1 - val2; /* bigger is WORSE */

    /* Sort by erodeproofing.  Map known-invulnerable to 1, and both
       known-vulnerable and unknown-vulnerability to 0, because that's
       how they're displayed. */
    val1 = (obj1.rknown && obj1.oerodeproof ? 1 : 0);
    val2 = (obj2.rknown && obj2.oerodeproof ? 1 : 0);
    if (val1 != val2)
        return val2 - val1; /* bigger is better */

    /* Sort by enchantment.  Map unknown to -1000, which is comfortably
       below the range of obj->spe.  oc_uses_known means that obj->known
       matters, which usually indirectly means that obj->spe is relevant.
       Lots of objects use obj->spe for some other purpose (see obj.h). */
    if (objects[obj1.otyp].oc_uses_known
        /* exclude eggs (laid by you) and tins (homemade, pureed, &c) */
        && obj1.oclass != FOOD_CLASS) {
        val1 = obj1.known ? obj1.spe : -1000;
        val2 = obj2.known ? obj2.spe : -1000;
        if (val1 != val2)
            return val2 - val1; /* bigger is better */
    }
 }
    /* They're identical, as far as we're concerned.  We want
       to force a deterministic order, and do so by producing a
       stable sort: maintain the original order of equal items. */
    return (sli1.indx - sli2.indx);
}

/*
 * sortloot() - the story so far...
 *
 *      The original implementation constructed and returned an array
 *      of pointers to objects in the requested order.  Callers had to
 *      count the number of objects, allocate the array, pass one
 *      object at a time to the routine which populates it, traverse
 *      the objects via stepping through the array, then free the
 *      array.  The ordering process used a basic insertion sort which
 *      is fine for short lists but inefficient for long ones.
 *
 *      3.6.0 (and continuing with 3.6.1) changed all that so that
 *      sortloot was self-contained as far as callers were concerned.
 *      It reordered the linked list into the requested order and then
 *      normal list traversal was used to process it.  It also switched
 *      to qsort() on the assumption that the C library implementation
 *      put some effort into sorting efficiently.  It also checked
 *      whether the list was already sorted as it got ready to do the
 *      sorting, so re-examining inventory or a pile of objects without
 *      having changed anything would gobble up less CPU than a full
 *      sort.  But it had at least two problems (aside from the ordinary
 *      complement of bugs):
 *      1) some players wanted to get the original order back when they
 *      changed the 'sortloot' option back to 'none', but the list
 *      reordering made that infeasible;
 *      2) object identification giving the 'ID whole pack' result
 *      would call makeknown() on each newly ID'd object, that would
 *      call update_inventory() to update the persistent inventory
 *      window if one existed, the interface would call the inventory
 *      display routine which would call sortloot() which might change
 *      the order of the list being traversed by the identify code,
 *      possibly skipping the ID of some objects.  That could have been
 *      avoided by suppressing 'perm_invent' during identification
 *      (fragile) or by avoiding sortloot() during inventory display
 *      (more robust).
 *
 *      As of 3.6.2: revert to the temporary array of ordered obj pointers
 *      but have sortloot() do the counting and allocation.  Callers
 *      need to use array traversal instead of linked list traversal
 *      and need to free the temporary array when done.  And the
 *      array contains 'struct sortloot_item' (aka 'Loot') entries
 *      instead of simple 'struct obj *' entries.
 */
export function sortloot(
    olist,
    mode,
    by_nexthere,
    filterfunc) { /* Loot * */ /* optional filter */
    let zerosli = static_struct("sortloot.zerosli", struct_sortloot_item);
    let sliarray;
    let o;
    let n, i;
    let augment_filter;

    for (n = 0, o = olist[0]; o; o = by_nexthere ? o.v.v_nexthere : o.nobj)
        ++n;
    /* note: if there is a filter function, this might overallocate */
    sliarray = view_of(struct_sortloot_item, addr_of(alloc(unsigned(Math.imul(unsigned(n + 1), sizeof(struct_sortloot_item))))));

    /* the 'keep cockatrice corpses' flag is overloaded with sort mode */
    augment_filter = (mode & SORTLOOT_PETRIFY) ? TRUE : FALSE;
    mode = unsigned(mode & unsigned(~SORTLOOT_PETRIFY)); /* remove flag, leaving mode */
    /* populate aliarray[0..n-1] */
    for (i = 0, o = olist[0]; o; o = by_nexthere ? o.v.v_nexthere : o.nobj) {
        if (filterfunc && !filterfunc(o)
            /* caller may be asking us to override filterfunc (in order
               to do a cockatrice corpse touch check during pickup even
               if/when the filter rejects food class) */
            && (!augment_filter || o.otyp != CORPSE
                || !touch_petrifies(mons[o.corpsenm])))
            continue;
        struct_assign(ptr_add(sliarray, i), zerosli);
        ptr_add(sliarray, i).obj = o, ptr_add(sliarray, i).indx = int(i);
        ++i;
    }
    n = i;
    /* add a terminator so that we don't have to pass 'n' back to caller */
    struct_assign(ptr_add(sliarray, n), zerosli);
    ptr_add(sliarray, n).indx = -1;

    /* do the sort; if no sorting is requested, we'll just return
       a sortloot_item array reflecting the current ordering */
    if (mode && n > 1) {
        gs.sortlootmode = mode; /* extra input for sortloot_cmp() */
        qsort(addr_of(sliarray), n, sizeof(struct_sortloot_item), sortloot_cmp);
        gs.sortlootmode = 0; /* reset static mode flags */
        /* if sortloot_cmp formatted any objects, discard their strings now */
        for (i = 0; i < n; ++i)
            if (ptr_add(sliarray, i).str)
                free((ptr_add(sliarray, i).str)), ptr_add(sliarray, i).str = 0;
    }
    return sliarray;
}

/* sortloot() callers should use this to free up memory it allocates */
export function unsortloot(loot_array_p) { /* void */
    if (loot_array_p[0])
        free(addr_of(loot_array_p[0])), loot_array_p[0] = null;
}

/* #if 0: not in this build */

export function assigninvlet(otmp) { /* void */
    const $frame = stack_frame(); try {
    let inuse = stack_array(schar, invlet_basic);
    let i;
    let obj;

    /* there should be at most one of these in inventory... */
    if (otmp.oclass == COIN_CLASS) {
        otmp.invlet = GOLD_SYM;
        return;
    }

    for (i = 0; i < invlet_basic; i++)
        chars[inuse + i] = FALSE;
    for (obj = gi.invent; obj; obj = obj.nobj)
        if (obj != otmp) {
            i = obj.invlet;
            if (ord('a') <= i && i <= ord('z'))
                chars[inuse + (i - ord('a'))] = TRUE;
            else if (ord('A') <= i && i <= ord('Z'))
                chars[inuse + (i - ord('A') + 26)] = TRUE;
            if (i == otmp.invlet)
                otmp.invlet = 0;
        }
    if ((i = otmp.invlet)
        && ((ord('a') <= i && i <= ord('z')) || (ord('A') <= i && i <= ord('Z'))))
        return;
    for (i = gl.lastinvnr + 1; i != gl.lastinvnr; i++) {
        if (i == invlet_basic) {
            i = -1;
            continue;
        }
        if (!chars[inuse + i])
            break;
    }
    otmp.invlet =
        (chars[inuse + i] ? NOINVSYM : (i < 26) ? (ord('a') + i) : (ord('A') + i - 26));
    gl.lastinvnr = i;
    } finally { stack_pop($frame); }
}

/* note: assumes ASCII; toggling a bit puts lowercase in front of uppercase */
export function inv_rank(o) { return (o.invlet ^ 0o40); }

/* sort the inventory; used by addinv() and doorganize() */
function reorder_invent() { /* void */
    let otmp, prev, next;
    let need_more_sorting;

    do {
        /*
         * We expect at most one item to be out of order, so this
         * isn't nearly as inefficient as it may first appear.
         */
        need_more_sorting = FALSE;
        for (otmp = gi.invent, prev = null; otmp; ) {
            next = otmp.nobj;
            if (next && inv_rank(next) < inv_rank(otmp)) {
                need_more_sorting = TRUE;
                if (prev)
                    prev.nobj = next;
                else
                    gi.invent = next;
                otmp.nobj = next.nobj;
                next.nobj = otmp;
                prev = next;
            } else {
                prev = otmp;
                otmp = next;
            }
        }
    } while (need_more_sorting);
}

/* scan a list of objects to see whether another object will merge with
   one of them; used in pickup.c when all 52 inventory slots are in use,
   to figure out whether another object could still be picked up */
export function merge_choice(objlist, obj) { /* struct obj * */
    let shkp;
    let save_nocharge;

    if (!objlist) /* might be checking 'obj' against empty inventory */
        return null;
    if (obj.otyp == SCR_SCARE_MONSTER) /* punt on these */
        return null;
    /* if this is an item on the shop floor, the attributes it will
       have when carried are different from what they are now; prevent
       that from eliciting an incorrect result from mergable() */
    save_nocharge = obj.no_charge;
    if (objlist == gi.invent && obj.where == OBJ_FLOOR
        && (shkp = shop_keeper(inside_shop(obj.ox, obj.oy))) != null) {
        if (obj.no_charge)
            obj.no_charge = 0;
        /* A billable object won't have its `unpaid' bit set, so would
           erroneously seem to be a candidate to merge with a similar
           ordinary object.  That's no good, because once it's really
           picked up, it won't merge after all.  It might merge with
           another unpaid object, but we can't check that here (depends
           too much upon shk's bill) and if it doesn't merge it would
           end up in the '#' overflow inventory slot, so reject it now. */
        else if (inhishop(shkp))
            return null;
    }
    do {
        /*assert(objlist != NULL);*/
        if (mergable(objlist, obj))
            break;
        objlist = objlist.nobj;
    } while (objlist);
    obj.no_charge = save_nocharge;
    return objlist;
}

/* merge obj with otmp and delete obj if types agree */
export function merged(potmp, pobj) { /* int */
    let otmp = potmp[0], obj = pobj[0];
    let discovered = FALSE;

    if (mergable(otmp, obj)) {
        /* Approximate age: we do it this way because if we were to
         * do it "accurately" (merge only when ages are identical)
         * we'd wind up never merging any corpses.
         * otmp->age = otmp->age*(1-proportion) + obj->age*proportion;
         *
         * Don't do the age manipulation if lit.  We would need
         * to stop the burn on both items, then merge the age,
         * then restart the burn.  Glob ages are averaged in the
         * absorb routine, which uses weight rather than quantity
         * to adjust for proportion (glob quantity is always 1).
         */
        if (!obj.lamplit && !obj.globby)
            otmp.age = Math.trunc(((otmp.age * otmp.quan) + (obj.age * obj.quan))
                        / (otmp.quan + obj.quan));

        if (!otmp.globby)
            otmp.quan += obj.quan;
        /* temporary special case for gold objects!!!! */
        if (otmp.oclass == COIN_CLASS)
            otmp.owt = unsigned(weight(otmp)), otmp.bknown = 0;
        /* and puddings!!!1!!one! */
        else if (!Is_pudding(otmp))
            otmp.owt = unsigned(weight(otmp));
        if (!has_oname(otmp) && has_oname(obj))
            otmp = potmp[0] = oname(otmp, ONAME(obj), ONAME_SKIP_INVUPD);
        obj_extract_self(obj);

        if (obj.pickup_prev && otmp.where == OBJ_INVENT)
            otmp.pickup_prev = 1;

        /* really should merge the timeouts */
        if (obj.lamplit)
            obj_merge_light_sources(obj, otmp);
        if (obj.timed)
            obj_stop_timers(obj); /* follows lights */

        /* objects can be identified by comparing them (unless Blind,
           but that is handled in mergable()); the object becomes
           identified in a particular dimension if either object was
           previously identified in that dimension, and if the
           identification states don't match, one of them must have
           previously been identified */
        if (obj.known != otmp.known) {
            otmp.known = 1;
            discovered = TRUE;
        }
        if (obj.rknown != otmp.rknown) {
            otmp.rknown = 1;
            if (otmp.oerodeproof)
                discovered = TRUE;
        }
        if (obj.bknown != otmp.bknown) {
            otmp.bknown = 1;
            if (!Role_if(PM_CLERIC))
                discovered = TRUE;
        }

        /* fixup for `#adjust' merging wielded darts, daggers, &c */
        if (obj.owornmask && carried(otmp)) {
            let wmask = or64(otmp.owornmask, obj.owornmask);

            /* Both the items might be worn in competing slots;
               merger preference (regardless of which is which):
             primary weapon + alternate weapon -> primary weapon;
             primary weapon + quiver -> primary weapon;
             alternate weapon + quiver -> alternate weapon.
               (Prior to 3.3.0, it was not possible for the two
               stacks to be worn in different slots and `obj'
               didn't need to be unworn when merging.) */
            if ((wmask & W_WEP) != 0) {
                wmask = W_WEP;
            } else if ((wmask & W_SWAPWEP) != 0) {
                wmask = W_SWAPWEP;
            } else if ((wmask & W_QUIVER) != 0) {
                wmask = W_QUIVER;
            } else {
                impossible(_("merging strangely worn items (%llx)"), wmask);
                wmask = otmp.owornmask;
            }
            if ((otmp.owornmask & not64(wmask)) != 0)
                setnotworn(otmp);
            setworn(otmp, wmask);
            setnotworn(obj);
        /* #if 0: not in this build */
        }

        /* mergable() no longer requires 'bypass' to match; if 'obj' has
           the bypass bit set, force the combined stack to have that too;
           primarily in case this merge is occurring because stackobj()
           is operating on an object just dropped by a monster that was
           zapped with polymorph, we want bypass set in order to inhibit
           the same zap from affecting the new combined stack when it hits
           objects at the monster's spot (but also in case we're called by
           code that's using obj->bypass to track 'already processed') */
        if (obj.bypass)
            otmp.bypass = 1;

        /* handle puddings a bit differently; absorption will free the
           other object automatically so we can just return out from here */
        if (obj.globby) {
            pudding_merge_message(otmp, obj);
            obj_absorb(potmp, pobj);
            return 1;
        }

        /* Print a message if item comparison discovers more
           information about the items (with the exception of thrown
           items, where this would be too spammy as such items get
           unidentified by monsters very frequently). */
        if (discovered && otmp.where == OBJ_INVENT
            && obj.how_lost != LOST_THROWN
            && otmp.how_lost != LOST_THROWN) {
            pline(_("You learn more about your items by comparing them."));
        }

        obfree(obj, otmp); /* free(obj), bill->otmp */
        return 1;
    }
    return 0;
}

/*
 * Adjust hero intrinsics as if this object was being added to the hero's
 * inventory.  Called _before_ the object has been added to the hero's
 * inventory.
 *
 * This is called when adding objects to the hero's inventory normally (via
 * addinv) or when an object in the hero's inventory has been polymorphed
 * in-place.
 */
export function addinv_core1(obj) { /* void */
    if (obj.oclass == COIN_CLASS) {
        disp.botl = TRUE;
    } else if (obj.otyp == AMULET_OF_YENDOR) {
        if (u.uhave.amulet)
            impossible(_("already have amulet?"));
        u.uhave.amulet = 1;
        record_achievement(ACH_AMUL);
    } else if (obj.otyp == CANDELABRUM_OF_INVOCATION) {
        if (u.uhave.menorah)
            impossible(_("already have candelabrum?"));
        u.uhave.menorah = 1;
        record_achievement(ACH_CNDL);
    } else if (obj.otyp == BELL_OF_OPENING) {
        if (u.uhave.bell)
            impossible(_("already have silver bell?"));
        u.uhave.bell = 1;
        record_achievement(ACH_BELL);
    } else if (obj.otyp == SPE_BOOK_OF_THE_DEAD) {
        if (u.uhave.book)
            impossible(_("already have the book?"));
        u.uhave.book = 1;
        record_achievement(ACH_BOOK);
    } else if (obj.oartifact) {
        if (is_quest_artifact(obj)) {
            if (u.uhave.questart)
                impossible(_("already have quest artifact?"));
            u.uhave.questart = 1;
            artitouch(obj);
        }
        set_artifact_intrinsic(obj, 1, W_ART);
    }

    /* "special achievements"; revealed in end of game disclosure and
       dumplog, originally just recorded in XLOGFILE */
    if (is_mines_prize(obj)) {
        record_achievement(ACH_MINE_PRIZE);
        svc.context.achieveo.mines_prize_oid = 0; /* done w/ luckstone o_id */
        obj.nomerge = 0; /* was set in create_object(sp_lev.c) */
    } else if (is_soko_prize(obj)) {
        record_achievement(ACH_SOKO_PRIZE);
        svc.context.achieveo.soko_prize_oid = 0; /* done w/ bag/amulet o_id */
        obj.nomerge = 0; /* (got set in sp_lev.c) */
    }
}

/*
 * Adjust hero intrinsics (and perform other side effects) as if this
 * object was being added to the hero's inventory.  Called _after_ the
 * object has been added to the hero's inventory.
 *
 * This can be used either for updating intrinsics, or to allow the hero to
 * react to objects that are now in inventory.
 *
 * This is called when adding objects to the hero's inventory normally (via
 * addinv), when an object in the hero's inventory has been polymorphed
 * in-place, or when the hero re-examines objects that they picked up while
 * blind.
 *
 * This may occasionally be called on an item that was already in inventory,
 * so it should be written to work even if called multiple times in a row
 * (e.g. do not assume that the object was not in inventory already).
 */
export function addinv_core2(obj) { /* void */
    if (confers_luck(obj)) {
        /* new luckstone must be in inventory by this point
           for correct calculation */
        set_moreluck();
    }

    /* Archeologists can decipher the writing on a scroll label to work out
       what they are (exception: unlabeled scrolls don't have a label to
       decipher) */
    if (Role_if(PM_ARCHEOLOGIST) && obj.oclass == SCROLL_CLASS &&
        obj.otyp != SCR_BLANK_PAPER && !Blind() &&
        !objects[obj.otyp].oc_name_known) {
        observe_object(obj);
        pline(_("You decipher the label on %s."), yname(obj));
        makeknown(obj.otyp);

        /* conduct: this is avoidable via not picking up / wishing for
           scrolls */
        if (!u.uconduct.literate++)
            livelog_printf(LL_CONDUCT,
                           _("became literate by deciphering a scroll label"));
    }
}

/*
 * Add obj to the hero's inventory.  Make sure the object is "free".
 * Adjust hero attributes as necessary.
 */
function addinv_core0(
    obj$, other_obj,
    update_perm_invent) { /* struct obj * */
    const $frame = stack_frame(); try {
    const obj = stack_var(ptr_to(struct_obj), obj$);
    var otmp = stack_var(ptr_to(struct_obj)), prev;
    var saved_otyp = (obj[0].otyp); /* for panic */
    var obj_was_thrown;

    if (obj[0].where != OBJ_FREE)
        panic(_("addinv: obj not free"));
    if (obj[0].how_lost == LOST_EXPLODING)
        return null;

    /* normally addtobill() clears no_charge when items in a shop are
       picked up, but won't do so if the shop has become untended */
    obj[0].no_charge = 0; /* should not be set in hero's invent */
    if (Has_contents(obj[0]))
        picked_container(obj[0]); /* clear no_charge */
    obj_was_thrown = +(obj[0].how_lost == LOST_THROWN);
    obj[0].how_lost = LOST_NONE;

    if (gl.loot_reset_justpicked) {
        gl.loot_reset_justpicked = FALSE;
        reset_justpicked(gi.invent);
    }

    addinv_core1(obj[0]); /* handle most side effects of carrying obj */

    /* for addinv_before(); if something has been removed and is now being
       reinserted, try to put it in the same place instead of merging or
       placing at end; for thrown-and-return weapon with !fixinv setting */
    added: { if (other_obj) {
        for (otmp[0] = gi.invent; otmp[0]; otmp[0] = otmp[0].nobj) {
            if (otmp[0].nobj == other_obj) {
                obj[0].nobj = other_obj;
                otmp[0].nobj = obj[0];
                obj[0].where = OBJ_INVENT;
                break added;
            }
        }
    }

    /* merge with quiver in preference to any other inventory slot
       in case quiver and wielded weapon are both eligible; adding
       extra to quivered stack is more useful than to wielded one */
    if (uquiver && merged(global_ref("uquiver", ptr_to(struct_obj)), obj)) {
        obj[0] = uquiver;
        if (!obj[0])
            panic(_("addinv: null obj after quiver merge otyp=%d"), saved_otyp);
        break added;
    }
    /* merge if possible; find end of chain in the process */
    for (prev = null, otmp[0] = gi.invent; otmp[0]; prev = otmp[0], otmp[0] = otmp[0].nobj)
        if (merged(otmp, obj)) {
            obj[0] = otmp[0];
            if (!obj[0])
                panic(_("addinv: null obj after merge otyp=%d"), saved_otyp);
            break added;
        }
    /* didn't merge, so insert into chain */
    assigninvlet(obj[0]);
    if (flags.invlet_constant || !prev) {
        obj[0].nobj = gi.invent; /* insert at beginning */
        gi.invent = obj[0];
        if (flags.invlet_constant)
            reorder_invent();
    } else {
        prev.nobj = obj[0]; /* insert at end */
        obj[0].nobj = null;
    }
    obj[0].where = OBJ_INVENT;

    /* fill empty quiver if obj was thrown */
    if (obj_was_thrown && flags.pickup_thrown && !uquiver
        /* if Mjollnir is thrown and fails to return, we want to
           auto-pick it when we move to its spot, but not into quiver
           because it needs to be wielded to be re-thrown;
           aklys likewise because player using 'f' to throw it might
           not notice that it isn't wielded until it fails to return
           several times; we never auto-wield, just omit from quiver
           so that player will be prompted for what to throw and
           possibly realize that re-wielding is necessary */
        && obj[0].oartifact != ART_MJOLLNIR && obj[0].otyp != AKLYS
        && (throwing_weapon(obj[0]) || is_ammo(obj[0])))
        setuqwep(obj[0]);
 }
    obj[0].pickup_prev = 1;
    addinv_core2(obj[0]); /* handle extrinsics conferred by carrying obj */
    carry_obj_effects(obj[0]); /* carrying affects the obj */
    if (update_perm_invent)
        update_inventory();
    return obj[0];
    } finally { stack_pop($frame); }
}

/* add obj to the hero's inventory in the default fashion */
export function addinv(obj) { /* struct obj * */
    return addinv_core0(obj, null, TRUE);
}

/* add obj to the hero's inventory by inserting in front of a specific item;
   used for throw-and-return in case '!fixinv' is in effect */
export function addinv_before(
    obj, other_obj) { /* struct obj * */
    /* if 'other_obj' is present this will implicitly be 'nomerge' */
    return addinv_core0(obj, other_obj, TRUE);
}

/* return value will always be 'obj' */
export function addinv_nomerge(obj) { /* struct obj * */
    let result;
    let save_nomerge = obj.nomerge;

    obj.nomerge = 1;
    result = addinv(obj);
    obj.nomerge = save_nomerge;
    return result;
}

/*
 * Some objects are affected by being carried.
 * Make those adjustments here. Called _after_ the object
 * has been added to the hero's or monster's inventory,
 * and after hero's intrinsics have been updated.
 */
export function carry_obj_effects(obj) { /* void */
    /* Cursed figurines can spontaneously transform when carried. */
    if (obj.otyp == FIGURINE) {
        if (obj.cursed && obj.corpsenm != NON_PM
            && !dead_species(obj.corpsenm, TRUE)) {
            attach_fig_transform_timeout(obj);
        }
    }
}

/* Add an item to the inventory unless we're fumbling or it refuses to be
 * held (via touch_artifact), and give a message.
 * If there aren't any free inventory slots, we'll drop it instead.
 * If both success and failure messages are NULL, then we're just doing the
 * fumbling/slot-limit checking for a silent grab.  In any case,
 * touch_artifact will print its own messages if they are warranted.
 */
export function hold_another_object(
    obj,
    drop_fmt,
    drop_arg,
    hold_msg) { /* struct obj * */ /* message to display if successfully held */
    const $frame = stack_frame(); try {
    var buf = stack_array(char, BUFSZ);

    if (!Blind())
        observe_object(obj); /* maximize mergeability */
    if (obj.oartifact) {
        /* place_object may change these */
        var crysknife = +(obj.otyp == CRYSKNIFE);
        var oerode = obj.oerodeproof;
        var wasUpolyd = Upolyd();

        /* in case touching this object turns out to be fatal */
        place_object(obj, u.ux, u.uy);

        if (!touch_artifact(obj, gy.youmonst)) {
            obj_extract_self(obj); /* remove it from the floor */
            dropy(obj);            /* now put it back again :-) */
            return obj;
        } else if (wasUpolyd && !Upolyd()) {
            /* lose your grip if you revert your form */
            if (drop_fmt)
                pline(drop_fmt, drop_arg);
            obj_extract_self(obj);
            dropy(obj);
            return obj;
        }
        obj_extract_self(obj);
        if (crysknife) {
            obj.otyp = CRYSKNIFE;
            obj.oerodeproof = unsigned(oerode);
        }
    }
    drop_it: { if (Fumbling()) {
        obj.nomerge = 1;
        /* dropping expects obj to be in invent; since it's going to be
           dropped, avoid perminv update when temporarily adding it */
        obj = addinv_core0(obj, null, FALSE);
        break drop_it;
    } else if (obj.otyp == CORPSE
               && !u_safe_from_fatal_corpse(obj, st_all)
               && obj.usecount) {
        obj.usecount = 0;
        obj = addinv_core0(obj, null, FALSE);
        break drop_it;
    } else {
        var oquan = obj.quan;
        var prev_encumbr = near_capacity(); /* before addinv() */

        /* encumbrance limit is max( current_state, pickup_burden );
           this used to use hardcoded MOD_ENCUMBER (stressed) instead
           of the 'pickup_burden' option (which defaults to stressed) */
        if (prev_encumbr < flags.pickup_burden)
            prev_encumbr = flags.pickup_burden;
        /* addinv() may redraw the entire inventory, overwriting
           drop_arg when it is kept in an 'obuf' from doname();
           [should no longer be necessary now that perm_invent update is
           suppressed, but it's cheap to keep as a paranoid precaution] */
        if (drop_arg)
            drop_arg = strcpy(buf, drop_arg);

        obj = addinv_core0(obj, null, FALSE);
        if (inv_cnt(FALSE) > invlet_basic
                || ((obj.otyp != LOADSTONE || !obj.cursed)
                       && near_capacity() > prev_encumbr)) {
            /* undo any merge which took place */
            if (obj.quan > oquan)
                obj = splitobj(obj, oquan);
            break drop_it;
        } else {
            if (flags.autoquiver && !uquiver && !obj.owornmask
                && (is_missile(obj) || ammo_and_launcher(obj, uwep)
                    || ammo_and_launcher(obj, uswapwep)))
                setuqwep(obj);
            if (hold_msg || drop_fmt)
                prinv(hold_msg, obj, oquan);
            /* obj made it into inventory and is staying there */
            update_inventory();
            encumber_msg();
        }
    }
    return obj;
 }
    if (drop_fmt)
        pline(drop_fmt, drop_arg);
    obj.nomerge = 0;
    if (can_reach_floor(TRUE) || u.uswallow) {
        dropx(obj);
    } else {
        freeinv(obj);
        hitfloor(obj, FALSE);
    }
    return null; /* might be gone */
    } finally { stack_pop($frame); }
}

/* useup() all of an item regardless of its quantity */
export function useupall(obj) { /* void */
    setnotworn(obj);
    freeinv(obj);
    obfree(obj, null); /* deletes contents also */
}

/* an item in inventory is going away after being used */
export function useup(obj) { /* void */
    /* Note:  This works correctly for containers because they (containers)
       don't merge. */
    if (obj.quan > 1) {
        obj.in_use = FALSE; /* no longer in use */
        obj.quan--;
        obj.owt = unsigned(weight(obj));
        update_inventory();
    } else {
        useupall(obj);
    }
}

/* use one charge from an item and possibly incur shop debt for it */
export function consume_obj_charge(
    obj,
    maybe_unpaid) { /* void */ /* false if caller handles shop billing */
    if (maybe_unpaid)
        check_unpaid(obj);
    obj.spe -= 1;
    if (obj.known)
        update_inventory();
}

/*
 * Adjust hero's attributes as if this object was being removed from the
 * hero's inventory.  This should only be called from freeinv() and
 * where we are polymorphing an object already in the hero's inventory.
 *
 * Should think of a better name...
 */
export function freeinv_core(obj) { /* void */
    if (obj.oclass == COIN_CLASS) {
        disp.botl = TRUE;
        return;
    } else if (obj.otyp == AMULET_OF_YENDOR) {
        if (!u.uhave.amulet)
            impossible(_("don't have amulet?"));
        u.uhave.amulet = 0;
    } else if (obj.otyp == CANDELABRUM_OF_INVOCATION) {
        if (!u.uhave.menorah)
            impossible(_("don't have candelabrum?"));
        u.uhave.menorah = 0;
    } else if (obj.otyp == BELL_OF_OPENING) {
        if (!u.uhave.bell)
            impossible(_("don't have silver bell?"));
        u.uhave.bell = 0;
    } else if (obj.otyp == SPE_BOOK_OF_THE_DEAD) {
        if (!u.uhave.book)
            impossible(_("don't have the book?"));
        u.uhave.book = 0;
    } else if (obj.oartifact) {
        if (is_quest_artifact(obj)) {
            if (!u.uhave.questart)
                impossible(_("don't have quest artifact?"));
            u.uhave.questart = 0;
        }
        set_artifact_intrinsic(obj, 0, W_ART);
    }

    if (obj.otyp == LOADSTONE) {
        curse(obj);
    } else if (confers_luck(obj)) {
        set_moreluck();
        disp.botl = TRUE;
    } else if (obj.otyp == FIGURINE && obj.timed) {
        stop_timer(FIG_TRANSFORM, obj_to_any(obj));
    }

    if (obj == svc.context.tin.tin) {
        svc.context.tin.tin = null;
        svc.context.tin.o_id = 0;
    }
}

/* remove an object from the hero's inventory */
export function freeinv(obj) { /* void */
    extract_nobj(obj, ref_of(gi, "invent"));
    obj.pickup_prev = 0;
    freeinv_core(obj);
    update_inventory();
}

/* drawbridge is destroying all objects at <x,y> */
export function delallobj(x, y) { /* void */
    let otmp, otmp2;

    for (otmp = svl.level.objects[x][y]; otmp; otmp = otmp2) {
        if (otmp == uball)
            unpunish();
        /* after unpunish(), or might get deallocated chain */
        otmp2 = otmp.v.v_nexthere;
        if (otmp == uchain)
            continue;
        delobj(otmp);
    }
}

/* normal object deletion (if unpaid, it remains on the bill) */
export function delobj(obj) { /* void */
    delobj_core(obj, FALSE);
}

/* destroy object; caller has control over whether to destroy something
   that ordinarily shouldn't be destroyed */
export function delobj_core(
    obj,
    force) { /* void */ /* 'force==TRUE' used when reviving Rider corpses */
    let update_map;

    /* obj_resists(obj,0,0) protects the Amulet, the invocation tools,
       and Rider corpses */
    if (!force && obj_resists(obj, 0, 0)) {
        /* player might be doing something stupid, but we
         * can't guarantee that.  assume special artifacts
         * are indestructible via drawbridges, and exploding
         * chests, and golem creation, and ...
         */
        obj.in_use = 0; /* in case caller has set this to 1 */
        return;
    }
    update_map = +(obj.where == OBJ_FLOOR);
    obj_extract_self(obj);
    if (update_map) { /* floor object's coordinates are always up to date */
        maybe_unhide_at(obj.ox, obj.oy);
        newsym(obj.ox, obj.oy);
    }
    obfree(obj, null); /* frees contents also */
}

/* try to find a particular type of object at designated map location */
export function sobj_at(otyp, x, y) { /* struct obj * */
    let otmp;

    for (otmp = svl.level.objects[x][y]; otmp; otmp = otmp.v.v_nexthere)
        if (otmp.otyp == otyp)
            break;

    return otmp;
}

/* sobj_at(&c) traversal -- find next object of specified type */
export function nxtobj(obj, type, by_nexthere) { /* struct obj * */
    let otmp;

    otmp = obj; /* start with the object after this one */
    do {
        otmp = !by_nexthere ? otmp.nobj : otmp.v.v_nexthere;
        if (!otmp)
            break;
    } while (otmp.otyp != type);

    return otmp;
}

/* return inventory object of type 'type' if hero has one, otherwise Null */
export function carrying(type) { /* struct obj * */
    let otmp;

    /* this could be replaced by 'return m_carrying(&gy.youmonst, type);' */
    for (otmp = gi.invent; otmp; otmp = otmp.nobj)
        if (otmp.otyp == type)
            break;
    return otmp;
}

/* return inventory object of type that will petrify on touch */
export function carrying_stoning_corpse() { /* struct obj * */
    let otmp;

    for (otmp = gi.invent; otmp; otmp = otmp.nobj)
        if (otmp.otyp == CORPSE && touch_petrifies(mons[otmp.corpsenm]))
            break;
    return otmp;
}

/* Fictional and not-so-fictional currencies.
 * http://concord.wikia.com/wiki/List_of_Fictional_Currencies
 */
const currencies = static_array("currencies", ptr_to(char), null, [
    _("Altarian Dollar"),       /* The Hitchhiker's Guide to the Galaxy */
    _("Ankh-Morpork Dollar"),   /* Discworld */
    _("auric"),                 /* The Domination of Draka */
    _("buckazoid"),             /* Space Quest */
    _("cirbozoid"),             /* Starslip */
    _("credit chit"),           /* Deus Ex */
    _("cubit"),                 /* Battlestar Galactica */
    _("Flanian Pobble Bead"),   /* The Hitchhiker's Guide to the Galaxy */
    _("fretzer"),               /* Jules Verne */
    _("imperial credit"),       /* Star Wars */
    _("Hong Kong Luna Dollar"), /* The Moon is a Harsh Mistress */
    _("kongbuck"),              /* Snow Crash */
    _("nanite"),                /* System Shock 2 */
    _("quatloo"),               /* Star Trek, Sim City */
    _("simoleon"),              /* Sim City */
    _("solari"),                /* Spaceballs */
    _("spacebuck"),             /* Spaceballs */
    _("sporebuck"),             /* Spore */
    _("Triganic Pu"),           /* The Hitchhiker's Guide to the Galaxy */
    _("woolong"),               /* Cowboy Bebop */
    _("zorkmid"),               /* Zork, NetHack */
]);

export function currency(amount) { /* const char * */
    let res;

    res = Hallucination() ? ROLL_FROM(currencies) : _("zorkmid");
    if (amount != 1)
        res = makeplural(res);
    return res;
}

export function u_carried_gloves() { /* struct obj * */
    let otmp, gloves = null;

    if (uarmg) {
        gloves = uarmg;
    } else {
        for (otmp = gi.invent; otmp; otmp = otmp.nobj)
            if (is_gloves(otmp)) {
                gloves = otmp;
                break;
            }
    }
    return gloves;
}

/* 3.6 tribute */
export function u_have_novel() { /* struct obj * */
    let otmp;

    for (otmp = gi.invent; otmp; otmp = otmp.nobj)
        if (otmp.otyp == SPE_NOVEL)
            return otmp;
    return null;
}

export function o_on(id, objchn) { /* struct obj * */
    let temp;

    while (objchn) {
        if (objchn.o_id == id)
            return objchn;
        if (Has_contents(objchn) && (temp = o_on(id, objchn.cobj)))
            return temp;
        objchn = objchn.nobj;
    }
    return null;
}

export function obj_here(obj, x, y) { /* boolean */
    let otmp;

    for (otmp = svl.level.objects[x][y]; otmp; otmp = otmp.v.v_nexthere)
        if (obj == otmp)
            return TRUE;
    return FALSE;
}

export function g_at(x, y) { /* struct obj * */
    let obj = svl.level.objects[x][y];

    while (obj) {
        if (obj.oclass == COIN_CLASS)
            return obj;
        obj = obj.v.v_nexthere;
    }
    return null;
}

/* compact a string of inventory letters by dashing runs of letters */
function compactify(buf) { /* void */
    let i1 = 1, i2 = 1;
    let ilet, ilet1, ilet2;

    ilet2 = chars[buf + 0];
    ilet1 = chars[buf + 1];
    chars[buf + (++i2)] = chars[buf + (++i1)];
    ilet = chars[buf + i1];
    while (ilet) {
        if (ilet == ilet1 + 1) {
            if (ilet1 == ilet2 + 1)
                chars[buf + (i2 - 1)] = ilet1 = ord('-');
            else if (ilet2 == ord('-')) {
                chars[buf + (i2 - 1)] = ++ilet1;
                chars[buf + i2] = chars[buf + (++i1)];
                ilet = chars[buf + i1];
                continue;
            }
        } else if (ilet == NOINVSYM) {
            /* compact three or more consecutive '#'
               characters into "#-#" */
            if (i2 >= 2 && chars[buf + (i2 - 2)] == NOINVSYM && chars[buf + (i2 - 1)] == NOINVSYM)
                chars[buf + (i2 - 1)] = ord('-');
            else if (i2 >= 3 && chars[buf + (i2 - 3)] == NOINVSYM && chars[buf + (i2 - 2)] == ord('-')
                     && chars[buf + (i2 - 1)] == NOINVSYM)
                --i2;
        }
        ilet2 = ilet1;
        ilet1 = ilet;
        chars[buf + (++i2)] = chars[buf + (++i1)];
        ilet = chars[buf + i1];
    }
}

/* some objects shouldn't be split when count given to getobj or askchain */
export function splittable(obj) { /* boolean */
    return +!((obj.otyp == LOADSTONE && obj.cursed)
             || (obj == uwep && welded(uwep)));
}

/* match the prompt for either 'T' or 'R' command */
function taking_off(action) { /* boolean */
    return +(!strcmp(action, _("take off")) || !strcmp(action, _("remove")));
}

function mime_action(word) { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);
    let bp, pfx, sfx;

    strcpy(buf, word);
    bp = pfx = sfx = 0;

    if ((bp = strstr(buf, _(" on the "))) != 0) {
        /* rub on the stone[s] */
        chars[bp] = ord('\0');
        sfx = (bp + 1); /* "something <sfx>" */
    }
    if ((!strncmp(buf, _("rub the "), 8) && strstr(buf + 8, _(" on")))
        || (!strncmp(buf, _("dip "), 4) && strstr(buf + 4, _(" into")))) {
        /* "rub the royal jelly on" -> "rubbing the royal jelly on", or
           "dip <foo> into" => "dipping <foo> into" */
        chars[buf + 3] = ord('\0');
        pfx = buf + (3 + 1); /* "<pfx> something" */
    }
    if ((bp = strstr(buf, _(" or "))) != 0) {
        chars[bp] = ord('\0');
        bp = (rn2(2) ? buf : (bp + 4));
    } else
        bp = buf;

    You(_("mime %s%s%s something%s%s."), ing_suffix(bp),
        pfx ? _(" ") : _(""), pfx ? pfx : _(""), sfx ? _(" ") : _(""), sfx ? sfx : _(""));
    } finally { stack_pop($frame); }
}

/* getobj callback that allows any object - but not hands. */
export function any_obj_ok(obj) { /* int */
    if (obj)
        return GETOBJ_SUGGEST;
    return GETOBJ_EXCLUDE;
}

/* return string describing your hands based on action. */
function getobj_hands_txt(action, qbuf) { /* char * */
    if (!strcmp(action, _("grease"))) {
        sprintf(qbuf, _("your %s"), fingers_or_gloves(FALSE));
    } else if (!strcmp(action, _("write with"))) {
        sprintf(qbuf, _("your %s"), body_part(FINGERTIP));
    } else if (!strcmp(action, _("wield"))) {
        sprintf(qbuf, _("your %s %s%s"), uarmg ? _("gloved") : _("bare"), makeplural(body_part(HAND)), !uwep ? _(" (wielded)") : _(""))

;
    } else if (!strcmp(action, _("ready"))) {
        sprintf(qbuf, _("empty quiver%s"), !uquiver ? _(" (nothing readied)") : _(""))
;
    } else {
        sprintf(qbuf, _("your %s"), makeplural(body_part(HAND)));
    }
    return qbuf;
}

/*
 * getobj returns:
 *      struct obj *xxx:        object to do something with.
 *      (struct obj *) 0        error return: no object.
 *      &hands_obj              explicitly no object (as in w-).
 * The obj_ok callback should not have side effects (apart from
 * abnormal-behavior things like impossible calls); it can be called multiple
 * times on the same object during the execution of this function.
 * Callbacks' argument is either a valid object pointer or a null pointer,
 * which represents the validity of doing that action on HANDS_SYM. getobj
 * won't call it with &hands_obj, so its behavior can be undefined in that
 * case.
 */
export function getobj(
    word,
    obj_ok,
    ctrlflags) { /* struct obj * */ /* some control to fine-tune the behavior */
    const $frame = stack_frame(); try {
    var otmp;
    var ilet = 0;
    var buf = stack_array(char, BUFSZ), qbuf = stack_array(char, QBUFSZ);
    var lets = stack_array(char, BUFSZ), altlets = stack_array(char, BUFSZ);
    var suggested = 0;
    var bp = buf, ap = altlets;
    var allowcnt = (ctrlflags & GETOBJ_ALLOWCNT),
            forceprompt = (ctrlflags & GETOBJ_PROMPT),
            allownone = FALSE;
    var inaccess = 0; /* counts GETOBJ_EXCLUDE_INACCESS items to decide
                       * between "you don't have anything to <foo>"
                       * versus "you don't have anything _else_ to <foo>"
                       * (also used for GETOBJ_EXCLUDE_NONINVENT) */
    var cnt = 0;
    var cntgiven = FALSE;
    var msggiven = FALSE;
    var oneloop = FALSE;
    var sortedinvent = stack_var(ptr_to(struct_sortloot_item)), srtinv;
    var cq = stack_struct(struct__cmd_queue), cmdq;
    var need_more_cq = FALSE;

 split_otmp: { need_more_cq: for (;;) {
    if ((cmdq = cmdq_pop()) != null) {
        struct_assign(cq, cmdq);
        free(addr_of(cmdq));
        /* user-input means pick something interactively now, with more
           in the command queue for after that; if not user-input, it
           has to be a key here */
        if (cq.typ != CMDQ_USER_INPUT) {
            otmp = null; /* in case of non-key or lookup failure */
            if (cq.typ == CMDQ_KEY) {
                var v;

                if (cq.key == HANDS_SYM) {
                    /* check whether the hands/self choice is suitable */
                    v = obj_ok(null);
                    if (v == GETOBJ_SUGGEST || v == GETOBJ_DOWNPLAY)
                        otmp = hands_obj;
                } else {
                    /* there could be more than one match if key is '#';
                       take first one which passes the obj_ok callback */
                    for (otmp = gi.invent; otmp; otmp = otmp.nobj)
                        if (otmp.invlet == cq.key) {
                            v = obj_ok(otmp);
                            if (v == GETOBJ_SUGGEST || v == GETOBJ_DOWNPLAY)
                                break;
                        }
                }
            } else if (cq.typ == CMDQ_INT) {
                /* getting a partial stack */
                if (!cntgiven && allowcnt) {
                    cnt = cq.intval;
                    cntgiven = TRUE;
                    continue need_more_cq; /* now, get CMDQ_KEY */
                } else {
                    cmdq_clear(CQ_CANNED);
                    /* should maybe clear the CQ_REPEAT too? */
                    return null;
                }
            }
            if (!otmp) {           /* didn't find what we were looking for, */
                cmdq_clear(CQ_CANNED); /* so discard any other queued cmnds */
            } else if (cntgiven) {
                /* if stack is smaller than count, drop the whole stack */
                if (cnt < 1 || otmp.quan <= cnt)
                    cntgiven = FALSE;
                break split_otmp;
            }
            return otmp;
        } /* !CMDQ_USER_INPUT */
    } else if (need_more_cq) {
        return null;
    } break; }

    /* is "hands"/"self" a valid thing to do this action on? */
    switch (obj_ok(null)) {
    case GETOBJ_SUGGEST: /* treat as likely candidate */
        allownone = TRUE;
        chars[bp++] = HANDS_SYM;
        chars[bp++] = ord(' '); /* put a space after the '-' in the prompt */
        break;
    case GETOBJ_DOWNPLAY: /* acceptable but not shown as likely choice */
    case GETOBJ_EXCLUDE_INACCESS:   /* nothing currently gives this for '-'
                                     * but theoretically could if wearing
                                     * gloves */
    case GETOBJ_EXCLUDE_SELECTABLE: /* ditto, I think... */
        allownone = TRUE;
        chars[ap++] = HANDS_SYM;
        break;
    case GETOBJ_EXCLUDE_NONINVENT: /* player skipped some alternative that's
                                    * not in inventory, now the hands/self
                                    * possibility is telling us so */
        forceprompt = FALSE;
        inaccess++;
        break;
    default:
        break;
    }

    if (!flags.invlet_constant)
        reassign();

    /* force invent to be in invlet order before collecting candidate
       inventory letters */
    sortedinvent[0] = sortloot(ref_of(gi, "invent"), SORTLOOT_INVLET, FALSE,
                            null);

    for (srtinv = sortedinvent[0]; (otmp = srtinv.obj) != null; srtinv = ptr_add(srtinv, 1)) {
        if (bp + suggested == buf + (sizeof(array_of(char, BUFSZ)) - 1)
            || ap == altlets + (sizeof(array_of(char, BUFSZ)) - 1)) {
            /* we must have a huge number of noinvsym items somehow */
            impossible(_("getobj: inventory overflow"));
            break;
        }

        chars[bp + (suggested++)] = otmp.invlet;
        switch (obj_ok(otmp)) {
        case GETOBJ_EXCLUDE_INACCESS:
            /* remove inaccessible things */
            suggested--;
            inaccess++;
            break;
        case GETOBJ_EXCLUDE:
        case GETOBJ_EXCLUDE_SELECTABLE:
            /* remove more inappropriate things, but unlike the first it won't
               trigger an "else" in "you don't have anything else to ___" */
            suggested--;
            break;
        case GETOBJ_DOWNPLAY:
            /* acceptable but not listed as likely candidates in the prompt
               or in the inventory subset if player responds with '?' - thus,
               don't add it to lets with bp, but add it to altlets with ap */
            suggested--;
            forceprompt = TRUE;
            chars[ap++] = otmp.invlet;
            break;
        case GETOBJ_SUGGEST:
            break; /* adding otmp->invlet is all that's needed */
        case GETOBJ_EXCLUDE_NONINVENT: /* not applicable for invent items */
        default:
            impossible(_("bad return from getobj callback"));
        }
    }
    unsortloot(sortedinvent);

    chars[bp + suggested] = ord('\0');
    /* If no objects were suggested but we added '- ' at the beginning for
     * hands, destroy the trailing space */
    if (suggested == 0 && bp > buf && chars[bp + (-1)] == ord(' '))
        chars[--bp] = ord('\0');
    strcpy(lets, bp); /* necessary since we destroy buf */
    if (suggested > 5)      /* compactify string */
        compactify(bp);
    chars[ap] = ord('\0');

    if (suggested == 0 && !forceprompt && !allownone) {
        You(_("don't have anything %sto %s."), inaccess ? _("else ") : _(""), word);
        return null;
    }
    $out_redo_menu: for (;;) {
        cnt = 0;
        cntgiven = FALSE;
        sprintf(qbuf, _("What do you want to %s?"), word);
        if (gi.in_doagain) {
            ilet = readchar();
        } else if (iflags.force_invmenu) {
            /* don't overwrite a possible quitchars */
            if (!oneloop)
                ilet = (chars[lets] || chars[altlets]) ? ord('?') : ord('*');
            if (!msggiven)
                putmsghistory()(qbuf, FALSE);
            msggiven = TRUE;
            oneloop = TRUE;
        } else {
            if (!chars[buf + 0])
                strcat(qbuf, _(" [*]"));
            else
                sprintf(eos(qbuf), _(" [%s or ?*]"), buf);
            ilet = yn_function(qbuf, 0, ord('\0'), FALSE);
        }
        if (digit(ilet)) {
            var tmpcnt = stack_var(long, 0);

            if (!allowcnt) {
                pline(_("No count allowed with this command."));
                continue;
            }
            ilet = get_count(0, ilet, LARGEST_INT, tmpcnt, GC_SAVEHIST);
            if (tmpcnt[0]) {
                cnt = tmpcnt[0];
                cntgiven = TRUE;
            }
        }
        if (strchr(quitchars, ilet)) {
            if (flags.verbose)
                pline1(Never_mind());
            return null;
        }
        if (ilet == HANDS_SYM) { /* '-' */
            if (!allownone)
                mime_action(word);
            return (allownone ? hands_obj : null);
        }
 redo_menu: for (;;) {
        /* since gold is now kept in inventory, we need to do processing for
           select-from-invent before checking whether gold has been picked */
        if (ilet == ord('?') || ilet == ord('*')) {
            var allowed_choices = (ilet == ord('?')) ? lets : 0;
            var ctmp = stack_var(long, 0);
            var menuquery = stack_array(char, QBUFSZ);
            var handsbuf = 0;

            if (ilet == ord('?') && !chars[lets] && chars[altlets])
                allowed_choices = altlets;

            chars[menuquery + 0] = chars[qbuf + 0] = ord('\0');
            if (iflags.force_invmenu)
                Snprintf(menuquery, sizeof(array_of(char, QBUFSZ)), _("What do you want to %s?"), word)
;
            if (!allowed_choices || chars[allowed_choices] == HANDS_SYM
                || chars[buf] == HANDS_SYM)
                handsbuf = getobj_hands_txt(word, qbuf);
            ilet = display_pickinv(allowed_choices, handsbuf,
                                   menuquery, allownone, TRUE,
                                   allowcnt ? ctmp : null);
            if (!ilet) {
                if (oneloop)
                    return null;
                continue $out_redo_menu;
            }
            if (ilet == HANDS_SYM)
                return hands_obj;
            if (ilet == ord('\x1b')) {
                if (flags.verbose)
                    pline1(Never_mind());
                return null;
            }
            if (ilet == ord('*') || ilet == ord('?'))
                continue redo_menu;;
            if (allowcnt && ctmp[0] >= 0) {
                cnt = ctmp[0];
                cntgiven = TRUE;
            }
            /* they typed a letter (not a space) at the prompt */
        } break; }
        /* find the item which was picked */
        for (otmp = gi.invent; otmp; otmp = otmp.nobj)
            if (otmp.invlet == ilet)
                break;
        /* some items have restrictions */
        if (ilet == GOLD_SYM
            /* guard against the [hypothetical] chance of having more
               than one invent slot of gold and picking the non-'$' one */
            || (otmp && otmp.oclass == COIN_CLASS)) {
            if (otmp && obj_ok(otmp) <= GETOBJ_EXCLUDE) {
                You(_("cannot %s gold."), word);
                return null;
            }
            /*
             * Historical note: early Nethack had a bug which was
             * first reported for Larn, where trying to drop 2^32-n
             * gold pieces was allowed, and did interesting things to
             * your money supply.  The LRS is the tax bureau from Larn.
             */
            if (cntgiven && cnt <= 0) {
                if (cnt < 0)
                    pline_The(_("LRS would be very interested to know" +
                              " you have that much."));
                return null;
            }
        }
        if (cntgiven && !strcmp(word, _("throw"))) {
            var only_one = init_string(static_array("getobj.only_one", char, sizeof_string("can only throw one at a time")), _("can only throw one at a time"), true);
            var coins;

            /* permit counts for throwing gold, but don't accept counts
               for other things since the throw code will split off a
               single item anyway; if populating quiver, 'word' will be
               "ready" or "fire" and this restriction doesn't apply */
            if (cnt == 0 || !otmp)
                return null;
            coins = +(otmp.oclass == COIN_CLASS);
            if (cnt > 1 && (!coins || cnt > otmp.quan)) {
                if (cnt > otmp.quan)
                    You(_("only have %lld%s%s."), otmp.quan,
                        (!coins && otmp.quan > 1) ? _(" and ") : _(""),
                        (!coins && otmp.quan > 1) ? only_one : _(""));
                else
                    You(_("%s."), only_one);
                continue;
            }
        }
        disp.botl = TRUE; /* May have changed the amount of money */
        if (otmp && !gi.in_doagain) {
            if (cntgiven && cnt > 0)
                cmdq_add_int(CQ_REPEAT, cnt);
            cmdq_add_key(CQ_REPEAT, ilet);
        }
        /* [we used to set otmp (by finding ilet in invent) here, but
           that's been moved above so that otmp can be checked earlier] */
        /* verify the chosen object */
        if (!otmp) {
            You(_("don't have that object."));
            if (gi.in_doagain)
                return null;
            continue;
        } else if (cnt < 0 || otmp.quan < cnt) {
            You(_("don't have that many!  You have only %lld."), otmp.quan);
            if (gi.in_doagain)
                return null;
            continue;
        }
        break;
    }
    if (obj_ok(otmp) == GETOBJ_EXCLUDE) {
        silly_thing(word, otmp);
        return null;
    }
 }
    if (cntgiven) {
        if (cnt == 0)
            return null;
        if (cnt != otmp.quan) {
            /* don't split a stack of cursed loadstones */
            if (splittable(otmp))
                otmp = splitobj(otmp, cnt);
            else if (otmp.otyp == LOADSTONE && otmp.cursed)
                /* kludge for canletgo()'s can't-drop-this message */
                otmp.corpsenm = int(cnt);
        }
    }
    return otmp;
    } finally { stack_pop($frame); }
}

export function silly_thing(word,
            otmp) { /* void */
    /* #ifdef OBSOLETE_HANDLING: not in this build */

    /* see comment about Amulet of Yendor in objtyp_is_callable(do_name.c);
       known fakes yield the silly thing feedback */
    if (!strcmp(word, _("call"))
        && (otmp.otyp == AMULET_OF_YENDOR
            || (otmp.otyp == FAKE_AMULET_OF_YENDOR && !otmp.known)))
        pline_The(_("Amulet doesn't like being called names."));
    else
        pline(silly_thing_to(), word);
}

function ckvalidcat(otmp) { /* int */
    /* use allow_category() from pickup.c */
    return allow_category(otmp);
}

function ckunpaid(otmp) { /* int */
    return (otmp.unpaid || (Has_contents(otmp) && count_unpaid(otmp.cobj)) ? 1 : 0);
}

export function wearing_armor() { /* boolean */
    return (uarm || uarmc || uarmf || uarmg
                      || uarmh || uarms || uarmu ? 1 : 0);
}

export function is_worn(otmp) { /* boolean */
    return (otmp.owornmask & (W_ARMOR | W_ACCESSORY | W_SADDLE | W_WEAPONS))
            ? TRUE
            : FALSE;
}

/* is 'obj' being used by the hero?  worn, wielded, active lamp or leash;
   not to be confused with obj->in_use, which finishes using up an item
   (destroys it) if restoring a save file finds that bit set */
export function is_inuse(obj) { /* boolean */
    return (carried(obj) && (is_worn(obj) || tool_being_used(obj)) ? 1 : 0);
}

/* extra xprname() input that askchain() can't pass through safe_qbuf() */
 const struct_xprnctx = struct("struct_xprnctx", {
    let: char,
    dot: boolean,
}); const safeq_xprn_ctx = static_struct("safeq_xprn_ctx", struct_xprnctx);

/* safe_qbuf() -> short_oname() callback */
function safeq_xprname(obj) { /* char * */
    return xprname(obj, 0, safeq_xprn_ctx.let, safeq_xprn_ctx.dot,
                   0, 0);
}

/* alternate safe_qbuf() -> short_oname() callback */
function safeq_shortxprname(obj) { /* char * */
    return xprname(obj, ansimpleoname(obj), safeq_xprn_ctx.let,
                   safeq_xprn_ctx.dot, 0, 0);
}

const removeables = static_array("removeables", char, null, [ ARMOR_CLASS, WEAPON_CLASS,
                                             RING_CLASS,  AMULET_CLASS,
                                             TOOL_CLASS,  0 ]);

/* Interactive version of getobj - used for Drop, Identify, and Takeoff (A).
   Return the number of times fn was called successfully.
   If combo is TRUE, we just use this to get a category list. */
export function ggetobj(word, fn, mx,
        combo,
        resultflags) { /* int */
    const $frame = stack_frame(); try {
    let ckfn = null;
    let ofilter = null;
    let takeoff, ident, allflag, m_seen;
    let itemcount = stack_var(int);
    let oletct, iletct, unpaid, oc_of_sym;
    let sym, ip, olets = stack_array(char, MAXOCLASSES + 6), ilets = stack_array(char, MAXOCLASSES + 11);
    let extra_removeables = stack_array(char, 3 + 1); /* uwep,uswapwep,uquiver */
    let buf = init_list(stack_array(char, BUFSZ), []), qbuf = stack_array(char, QBUFSZ);

    if (!gi.invent) {
        You(_("have nothing to %s."), word);
        if (resultflags)
            resultflags[0] = ALL_FINISHED;
        return 0;
    }
    if (resultflags)
        resultflags[0] = 0;
    takeoff = ident = allflag = m_seen = FALSE;
    add_valid_menu_class(0); /* reset */
    if (taking_off(word)) {
        takeoff = TRUE;
        ofilter = is_worn;
    } else if (!strcmp(word, _("identify"))) {
        ident = TRUE;
        ofilter = not_fully_identified;
    }

    iletct = collect_obj_classes(ilets, gi.invent, FALSE, ofilter,
                                 itemcount);
    unpaid = count_unpaid(gi.invent);

    if (ident && !iletct) {
        return -1; /* no further identifications */
    } else if (gi.invent) {
        chars[ilets + (iletct++)] = ord(' ');
        if (unpaid)
            chars[ilets + (iletct++)] = ord('u');
        if (count_buc(gi.invent, BUC_BLESSED, ofilter))
            chars[ilets + (iletct++)] = ord('B');
        if (count_buc(gi.invent, BUC_UNCURSED, ofilter))
            chars[ilets + (iletct++)] = ord('U');
        if (count_buc(gi.invent, BUC_CURSED, ofilter))
            chars[ilets + (iletct++)] = ord('C');
        if (count_buc(gi.invent, BUC_UNKNOWN, ofilter))
            chars[ilets + (iletct++)] = ord('X');
        if (count_justpicked(gi.invent))
            chars[ilets + (iletct++)] = ord('P');
        chars[ilets + (iletct++)] = ord('a');
    }
    chars[ilets + (iletct++)] = ord('i');
    if (!combo)
        chars[ilets + (iletct++)] = ord('m'); /* allow menu presentation on request */
    chars[ilets + iletct] = ord('\0');

    for (;;) {
        sprintf(qbuf, _("What kinds of thing do you want to %s? [%s]"), word, ilets)
;
        getlin(qbuf, buf);
        if (chars[buf + 0] == ord('\x1b'))
            return 0;
        if (strchr(buf, ord('i'))) {
            let ailets = stack_array(char, 1+26+26+1+5+1); /* $ + a-z + A-Z + # + slop + \0 */
            let otmp, nextobj;

            /* applicable inventory letters; if empty, show entire invent */
            chars[ailets + 0] = ord('\0');
            if (ofilter)
                for (otmp = gi.invent; otmp; otmp = nextobj) {
                    nextobj = otmp.nobj;
                    /* strchr() check: limit overflow items to one '#' */
                    if (ofilter(otmp) && !strchr(ailets, otmp.invlet))
                        strkitten(ailets, otmp.invlet);
                }
            if (display_inventory(ailets, TRUE) == ord('\x1b'))
                return 0;
        } else
            break;
    }

    chars[extra_removeables + 0] = ord('\0');
    if (takeoff) {
        /* arbitrary types of items can be placed in the weapon slots
           [any duplicate entries in extra_removeables[] won't matter] */
        if (uwep)
            strkitten(extra_removeables, uwep.oclass);
        if (uswapwep)
            strkitten(extra_removeables, uswapwep.oclass);
        if (uquiver)
            strkitten(extra_removeables, uquiver.oclass);
    }

    ip = buf;
    chars[olets + (oletct = 0)] = ord('\0');
    while ((sym = chars[ip++]) != ord('\0')) {
        if (sym == ord(' '))
            continue;
        oc_of_sym = def_char_to_objclass(sym);
        if (takeoff && oc_of_sym != MAXOCLASSES) {
            if (strchr(extra_removeables, oc_of_sym)) {
                ; /* skip rest of takeoff checks */
            } else if (!strchr(removeables, oc_of_sym)) {
                pline(_("Not applicable."));
                return 0;
            } else if (oc_of_sym == ARMOR_CLASS && !wearing_armor()) {
                noarmor(FALSE);
                return 0;
            } else if (oc_of_sym == WEAPON_CLASS && !uwep && !uswapwep
                       && !uquiver) {
                You(_("are not wielding anything."));
                return 0;
            } else if (oc_of_sym == RING_CLASS && !uright && !uleft) {
                You(_("are not wearing rings."));
                return 0;
            } else if (oc_of_sym == AMULET_CLASS && !uamul) {
                You(_("are not wearing an amulet."));
                return 0;
            } else if (oc_of_sym == TOOL_CLASS && !ublindf) {
                You(_("are not wearing a blindfold."));
                return 0;
            }
        }

        if (sym == ord('a')) {
            allflag = TRUE;
        } else if (sym == ord('A')) {
            ; /* same as the default */
        } else if (sym == ord('u')) {
            add_valid_menu_class(ord('u'));
            ckfn = ckunpaid;
        } else if (strchr(_("BUCXP"), sym)) {
            add_valid_menu_class(sym); /* 'B','U','C','X', or 'P' */
            ckfn = ckvalidcat;
        } else if (sym == ord('m')) {
            m_seen = TRUE;
        } else if (oc_of_sym == MAXOCLASSES) {
            You(_("don't have any %c's."), sym);
        } else {
            if (!strchr(olets, oc_of_sym)) {
                add_valid_menu_class(oc_of_sym);
                chars[olets + (oletct++)] = oc_of_sym;
                chars[olets + oletct] = ord('\0');
            }
        }
    }

    if (m_seen) {
        return (allflag
                || (!oletct && ckfn != ckunpaid && ckfn != ckvalidcat))
               ? -2 : -3;
    } else if (flags.menu_style != MENU_TRADITIONAL && combo && !allflag) {
        return 0;
    } else {
        let cnt = askchain(ref_of(gi, "invent"), olets, allflag, fn, ckfn, mx, word);
        /*
         * askchain() has already finished the job in this case
         * so set a special flag to convey that back to the caller
         * so that it won't continue processing.
         * Fix for bug C331-1 reported by Irina Rempt-Drijfhout.
         */
        if (combo && allflag && resultflags)
            resultflags[0] |= ALL_FINISHED;
        return cnt;
    }
    } finally { stack_pop($frame); }
}

/*
 * Walk through the chain starting at objchn and ask for all objects
 * with olet in olets (if nonNULL) and satisfying ckfn (if nonnull)
 * whether the action in question (i.e., fn) has to be performed.
 */
export function askchain(
    objchn,
    olets,
    allflag,
    fn,
    ckfn,
    mx,
    word) { /* int */ /* name of the action */
    const $frame = stack_frame(); try {
    var otmp, otmpo;
    var sym, ilet;
    var cnt = 0, dud = 0, tmp;
    var takeoff, nodot, ident, take_out, put_in, first, ininv, bycat;
    var qbuf = stack_array(char, QBUFSZ), qpfx = stack_array(char, QBUFSZ);
    var sortedchn = stack_var(ptr_to(struct_sortloot_item), null);

    takeoff = taking_off(word);
    ident = +!strcmp(word, _("identify"));
    take_out = +!strcmp(word, _("take out"));
    put_in = +!strcmp(word, _("put in"));
    nodot = (!strcmp(word, _("nodot")) || !strcmp(word, _("drop")) || ident
             || takeoff || take_out || put_in ? 1 : 0);
    ininv = +(objchn[0] == gi.invent);
    bycat = (menu_class_present(ord('u'))
             || menu_class_present(ord('B')) || menu_class_present(ord('U'))
             || menu_class_present(ord('C')) || menu_class_present(ord('X'))
             || menu_class_present(ord('P')) ? 1 : 0);

    /* someday maybe we'll sort by 'olets' too (temporarily replace
       flags.packorder and pass SORTLOOT_PACK), but not yet... */
    sortedchn[0] = sortloot(objchn, SORTLOOT_INVLET, FALSE,
                         null);

    first = TRUE;
    /*
     * Interrogate in the object class order specified.
     * For example, if a person specifies =/ then first all rings
     * will be asked about followed by all wands.  -dgk
     */
 nextclass: for (;;) {
    ilet = ord('a') - 1;
    if (objchn[0] && (objchn[0]).oclass == COIN_CLASS)
        ilet--;                     /* extra iteration */
    /*
     * Multiple Drop can change the gi.invent chain while it operates
     * (dropping a burning potion of oil while levitating creates
     * an explosion which can destroy inventory items), so simple
     * list traversal
     *  for (otmp = *objchn; otmp; otmp = otmp2) {
     *      otmp2 = otmp->nobj;
     *      ...
     *  }
     * is inadequate here.  Use each object's bypass bit to keep
     * track of which list elements have already been processed.
     */
    bypass_objlist(objchn[0], FALSE); /* clear chain's bypass bits */
    ret: { while ((otmp = nxt_unbypassed_loot(sortedchn[0], objchn[0])) != null) {
        if (ilet == ord('z'))
            ilet = ord('A');
        else if (ilet == ord('Z'))
            ilet = NOINVSYM; /* '#' */
        else
            ilet++;
        if (olets && chars[olets] && otmp.oclass != chars[olets])
            continue;
        if (takeoff && !is_worn(otmp))
            continue;
        if (ident && !not_fully_identified(otmp))
            continue;
        if (ckfn && !ckfn(otmp))
            continue;
        if (bycat && !ckvalidcat(otmp))
            continue;
        if (!allflag) {
            safeq_xprn_ctx.let = ilet;
            safeq_xprn_ctx.dot = +!nodot;
            chars[qpfx] = ord('\0');
            if (first) {
                /* traditional_loot() skips prompting when only one
                   class of objects is involved, so prefix the first
                   object being queried here with an explanation why */
                if (take_out || put_in)
                    sprintf(qpfx, _("%s: "), word), chars[qpfx] = highc(chars[qpfx]);
                first = FALSE;
            }
            safe_qbuf(qbuf, qpfx, _("?"), otmp,
                             ininv ? safeq_xprname : doname,
                             ininv ? safeq_shortxprname : ansimpleoname,
                             _("item"));
            /* nyaq(qbuf) or nyNaq(qbuf), bypassing canned input for ^A */
            sym = yn_function(qbuf,
                              (takeoff || ident || otmp.quan < 2)
                                ? ynaqchars : ynNaqchars,
                              ord('n'), FALSE);
        } else
            sym = ord('y');

        otmpo = otmp;
        if (sym == ord('#')) {
            /* Number was entered; split the object unless it corresponds
               to 'none' or 'all'.  2 special cases: cursed loadstones and
               welded weapons (eg, multiple daggers) will remain as merged
               unit; done to avoid splitting an object that won't be
               droppable (even if we're picking up rather than dropping). */
            if (!yn_number) {
                sym = ord('n');
            } else {
                sym = ord('y');
                if (yn_number < otmp.quan && splittable(otmp))
                    otmp = splitobj(otmp, yn_number);
            }
        }
        switch (sym) {
        case ord('a'):
            allflag = 1;
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case ord('y'):
            tmp = fn(otmp);
            if (tmp <= 0) {
                if (container_gone(fn)) {
                    /* otmp caused magic bag to explode;
                       both are now gone */
                    otmp = null; /* and return */
                } else if (otmp && otmp != otmpo) {
                    /* split occurred, merge again */
                    unsplitobj(otmp);
                }
                if (tmp < 0)
                    break ret;;
            }
            cnt += tmp;
            if (--mx == 0)
                break ret;;
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case ord('n'):
            if (nodot)
                dud++;
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        default:
            break;
        case ord('q'):
            /* special case for seffects() */
            if (ident)
                cnt = -1;
            break ret;
        }
    }
    if (olets && chars[olets] && chars[++olets])
        continue nextclass;;

    if (!takeoff && (dud || cnt))
        pline(_("That was all."));
    else if (!dud && !cnt)
        pline(_("No applicable objects."));
 }
    unsortloot(sortedchn); break; }
    /* can't just clear bypass bit of items in objchn because the action
       applied to selected ones might move them to a different chain */
    /*bypass_objlist(*objchn, FALSE);*/
    clear_bypasses();
    return cnt;
    } finally { stack_pop($frame); }
}

/* The menu for rerolling attributes and inventory.

   This is similar to the other inventory menus, but simpler to help it fit on
   the screen (there's more text around it and rerolling is difficult if you
   can't see the whole list at once).

   Returns TRUE (and increases numrerolls) if a reroll was requested. */
export function reroll_menu() { /* boolean */
    const $frame = stack_frame(); try {
    let win;
    let any = stack_struct(struct_any);
    let pick_list = stack_var(ptr_to(struct_mi), null);
    let otmp;
    let tmpglyph;
    let tmpglyphinfo = stack_struct(struct_glyphinfo);
    let option;
    let buf = stack_array(char, BUFSZ);

    win = create_nhwindow()(NHW_MENU);
    start_menu()(win, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);

    any.a_char = ord('n');
    add_menu(win, nul_glyphinfo, any, flags.lootabc ? 0 : ord('p'), 0,
             ATR_NONE, NO_COLOR, _("start the game with this character"),
             MENU_ITEMFLAGS_NONE);
    any.a_char = ord('y');
    add_menu(win, nul_glyphinfo, any, flags.lootabc ? 0 : ord('r'), 0,
             ATR_NONE, NO_COLOR, _("reroll another character"),
             MENU_ITEMFLAGS_NONE);
    any.a_char = 0;
    add_menu(win, nul_glyphinfo, any, 0, 0, ATR_NONE, NO_COLOR, _(""),
             MENU_ITEMFLAGS_NONE);

    ++gd.distantname;     /* avoid adding items to discoveries */
    ++iflags.override_ID; /* identify them */
    for (otmp = gi.invent; otmp; otmp = otmp.nobj) {
        tmpglyph = obj_to_glyph(otmp, rn2_on_display_rng);
        map_glyphinfo(0, 0, tmpglyph, 0, tmpglyphinfo);
        add_menu(win, tmpglyphinfo, any, 0, 0,
                 ATR_NONE, NO_COLOR, doname(otmp), MENU_ITEMFLAGS_NONE);
    }
    --iflags.override_ID;
    --gd.distantname;

    add_menu(win, nul_glyphinfo, any, 0, 0, ATR_NONE, NO_COLOR, _(""),
             MENU_ITEMFLAGS_NONE);
    sprintf(buf, _("St:%s Dx:%-1d Co:%-1d In:%-1d Wi:%-1d Ch:%-1d"), get_strength_str(), ACURR(A_DEX), ACURR(A_CON), ACURR(A_INT), ACURR(A_WIS), ACURR(A_CHA))

;
    add_menu(win, nul_glyphinfo, any, 0, 0, ATR_NONE, NO_COLOR,
             buf, MENU_ITEMFLAGS_NONE);

    end_menu()(win, _("Reroll this character?"));
    if (select_menu(win, PICK_ONE, pick_list) > 0) {
        option = ptr_add(pick_list[0], 0).item.a_char;
        free(addr_of(pick_list[0]));
    } else {
        /* user closed the menu without selecting; unclear what their choice
           is here so ask again; but (e.g. for hangup handling) stop asking if
           the user cancels out again */
        option = y_n(_("Reroll this character?"));
    }
    destroy_nhwindow()(win);

    if (option == ord('y')) {
        ++u.uroleplay.numrerolls;
        return TRUE;
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

/*
 *      Object identification routines:
 */

/* set the cknown and lknown flags on an object if they're applicable */
export function set_cknown_lknown(obj) { /* void */
    if (Is_container(obj) || obj.otyp == STATUE)
        obj.cknown = obj.lknown = 1;
    else if (obj.otyp == TIN)
        obj.cknown = 1;
    /* TODO? cknown might be extended to candy bar, where it would mean that
       wrapper's text was known which in turn indicates candy bar's content */
    return;
}

/* make an object actually be identified; no display updating */
export function fully_identify_obj(otmp) { /* void */
    makeknown(otmp.otyp);
    if (otmp.oartifact)
        discover_artifact(otmp.oartifact);
    observe_object(otmp);
    otmp.known = otmp.bknown = otmp.rknown = 1;
    set_cknown_lknown(otmp); /* set otmp->{cknown,lknown} if applicable */
    if (otmp.otyp == EGG && otmp.corpsenm != NON_PM)
        learn_egg_type(otmp.corpsenm);
}

/* ggetobj callback routine; identify an object and give immediate feedback */
export function identify(otmp) { /* int */
    fully_identify_obj(otmp);
    prinv(0, otmp, 0);
    return 1;
}

/* menu of unidentified objects; select and identify up to id_limit of them */
function menu_identify(id_limit) { /* void */
    const $frame = stack_frame(); try {
    let pick_list = stack_var(ptr_to(struct_mi));
    let n, i, first = 1, tryct = 5;
    let buf = stack_array(char, BUFSZ);
    /* assumptions:  id_limit > 0 and at least one unID'd item is present */

    while (id_limit) {
        sprintf(buf, _("What would you like to identify %s?"), first ? _("first") : _("next"))
;
        n = query_objlist(buf, ref_of(gi, "invent"), (SIGNAL_NOMENU | SIGNAL_ESCAPE
                                           | USE_INVLET | INVORDER_SORT),
                          pick_list, PICK_ANY, not_fully_identified);

        if (n > 0) {
            if (n > id_limit)
                n = id_limit;
            for (i = 0; i < n; i++, id_limit--)
                identify(ptr_add(pick_list[0], i).item.a_obj);
            free(addr_of(pick_list[0]));
            if (id_limit)
                wait_synch()(); /* Before we loop to pop open another menu */
            first = 0;
        } else if (n == -2) { /* player used ESC to quit menu */
            break;
        } else if (n == -1) { /* no eligible items found */
            pline(_("That was all."));
            break;
        } else if (!--tryct) { /* stop re-prompting */
            pline1(thats_enough_tries());
            break;
        } else { /* try again */
            pline(_("Choose an item; use ESC to decline."));
        }
    }
    } finally { stack_pop($frame); }
}
/* count the unidentified items */
export function count_unidentified(objchn) { /* int */
    let unid_cnt = 0;
    let obj;

    for (obj = objchn; obj; obj = obj.nobj)
        if (not_fully_identified(obj))
            ++unid_cnt;
    return unid_cnt;
}

/* dialog with user to identify a given number of items; 0 means all */
export function identify_pack(
    id_limit,
    learning_id) { /* void */ /* T: just read unknown identify scroll */
    let obj;
    let n, unid_cnt = count_unidentified(gi.invent);

    if (!unid_cnt) {
        You(_("have already identified %s of your possessions."),
            !learning_id ? _("all") : _("the rest"));
    } else if (!id_limit || id_limit >= unid_cnt) {
        /* identify everything */
        /* TODO:  use fully_identify_obj and cornline/menu/whatever here */
        for (obj = gi.invent; obj; obj = obj.nobj) {
            if (not_fully_identified(obj)) {
                identify(obj);
                if (--unid_cnt < 1)
                    break;
            }
        }
    } else {
        /* identify up to `id_limit' items */
        n = 0;
        if (flags.menu_style == MENU_TRADITIONAL)
            do {
                n = ggetobj(_("identify"), identify, id_limit, FALSE,
                            null);
                if (n < 0)
                    break; /* quit or no eligible items */
            } while ((id_limit -= n) > 0);
        if (n == 0 || n < -1)
            menu_identify(id_limit);
    }
    update_inventory();
}

/* called when regaining sight; mark inventory objects which were picked
   up while blind as now having been seen */
export function learn_unseen_invent() { /* void */
    let otmp;
    let invupdated = FALSE;

    if (Blind())
        return; /* sanity check */

    for (otmp = gi.invent; otmp; otmp = otmp.nobj) {
        if (otmp.dknown && (otmp.bknown || !Role_if(PM_CLERIC)) &&
            (otmp.oclass != SCROLL_CLASS || !Role_if(PM_ARCHEOLOGIST)))
            continue; /* already seen */
        invupdated = TRUE;
        /* xname() will set dknown, perhaps bknown (for priest[ess]);
           result from xname() is immediately released for re-use */
        maybereleaseobuf(xname(otmp));
        addinv_core2(otmp); /* you react to seeing the object */

        /*
         * If object->eknown gets implemented (see learnwand(zap.c)),
         * handle deferred discovery here.
         */
    }
    if (invupdated)
        update_inventory();
}

/* persistent inventory window is maintained by interface code;
   'update_inventory' used to be a macro for
   (*windowprocs.win_update_inventory) but the restore hackery to suppress
   screen updates was getting out of hand; this is now a central call point */
export function update_inventory() { /* void */
    let save_suppress_price;

    if (!program_state.in_moveloop) /* not covered by suppress_map_output */
        return;
    if (suppress_map_output()) /* despite name, used for perm_invent too */
        return;

    /*
     * Ought to check (windowprocs.wincap & WC_PERM_INVENT) here....
     *
     * We currently don't skip this call when iflags.perm_invent is False
     * because curses uses that to disable a previous perm_invent window
     * (after toggle via 'O'; perhaps the options code should handle that).
     *
     * perm_invent might get updated while some code is avoiding price
     * feedback during obj name formatting for messages.  Temporarily
     * force 'normal' formatting during the perm_invent update.  (Cited
     * example was an update triggered by change in invent gold when
     * transferring some to shk during itemized billing.  A previous fix
     * attempt in the shop code handled it for unpaid items but not for
     * paying for used-up shop items; that follows a different code path.)
     */
    save_suppress_price = iflags.suppress_price;
    iflags.suppress_price = 0;
    windowprocs.win_update_inventory(0);
    iflags.suppress_price = save_suppress_price;
}

/* the #perminv command - call interface's persistent inventory routine */
export function doperminv() { /* int */
    /*
     * If persistent inventory window is enabled, interact with it.
     *
     * Depending on interface, might accept and execute one scrolling
     * request (MENU_{FIRST,NEXT,PREVIOUS,LAST}_PAGE) then return,
     * or might stay and handle multiple requests until user finishes
     * (typically by typing <return> or <esc> but that's up to interface).
     */

    if ((windowprocs.wincap & WC_PERM_INVENT) == 0) {
        /* [TODO? perhaps omit "by <interface>" if all the window ports
           compiled into this binary lack support for perm_invent...] */
        pline(_("Persistent inventory display is not supported by '%s'."),
              windowprocs.name);
    } else if (!iflags.perm_invent) {
        pline(
     _("Persistent inventory ('perm_invent' option) is not presently enabled."));
    } else if (!gi.invent) {
        /* [should this be left for the interface to decide?] */
        pline(_("Persistent inventory display is empty."));
    } else {
        /* note: we used to request a scrolling key here and pass that to
           (*win_update_inventory)(key), but that limited the functionality
           and also cluttered message history with prompt and response so
           just send non-zero and have the interface be responsible for it */
        windowprocs.win_update_inventory(1);
    } /* iflags.perm_invent */

    return ECMD_OK;
}

/* should of course only be called for things in invent */
function obj_to_let(obj) { /* char */
    if (!flags.invlet_constant) {
        obj.invlet = NOINVSYM;
        reassign();
    }
    return obj.invlet;
}

/*
 * Print the indicated quantity of the given object.  If quan == 0L then use
 * the current quantity.
 */
export function prinv(prefix, obj, quan) { /* void */
    const $frame = stack_frame(); try {
    let total_of = (quan && (quan < obj.quan) ? 1 : 0);
    let totalbuf = stack_array(char, QBUFSZ);

    if (!prefix)
        prefix = _("");

    chars[totalbuf + 0] = ord('\0');
    if (total_of)
        Snprintf(totalbuf, sizeof(array_of(char, QBUFSZ)), _(" (%lld in total)."), obj.quan)
;
    pline(_("%s%s%s%s"), prefix, chars[prefix] ? _(" ") : _(""),
          xprname(obj, 0, obj_to_let(obj), +!total_of, 0, quan),
          flags.verbose ? totalbuf : _(""));
    } finally { stack_pop($frame); }
}

export function xprname(
    obj,
    txt,
    let_,
    dot,
    cost,
    quan) { /* char * */ /* if non-0, print this quantity, not obj->quan */
    const $frame = stack_frame(); try {
    let li = static_array("xprname.li", char, BUFSZ);
    let suffix = stack_array(char, 80); /* plenty of room for count and hallucinatory currency */
    let sfxlen, txtlen; /* signed int for %*s formatting */
    let fmt;
    let use_invlet = (flags.invlet_constant && obj != null
                          && let_ != CONTAINED_SYM && let_ != HANDS_SYM ? 1 : 0);
    let savequan = 0;

    if (quan && obj) {
        savequan = obj.quan;
        obj.quan = quan;
    }
    /*
     * If let is:
     *  -  Then obj == null and 'txt' refers to hands or fingers.
     *  *  Then obj == null and we are printing a total amount.
     *  >  Then the object is contained and doesn't have an inventory letter.
     */
    fmt = _("%c - %.*s%s");
    if (!txt) {
        assert(obj != null);
        txt = doname(obj);
    }
    txtlen = int(strlen(txt));

    if (cost != 0 || let_ == ord('*')) {
        /* if dot is true, we're doing Iu, otherwise Ix */
        if (dot && use_invlet)
            let_ = obj.invlet;
        sprintf(suffix, _("%c%6lld %.50s"), iflags.menu_tab_sep ? ord('\t') : ord(' '), cost, currency(cost))
;
        if (!iflags.menu_tab_sep) {
            fmt = _("%c - %-45.*s%s");
            if (txtlen < 45)
                txtlen = 45;
        }
    } else {
        /* ordinary inventory display or pickup message */
        if (use_invlet)
            let_ = obj.invlet;
        strcpy(suffix, dot ? _(".") : _(""));
    }
    sfxlen = int(strlen(suffix));
    if (txtlen > BUFSZ - 1 - (4 + sfxlen)) /* 4: "c - " prefix */
        txtlen = BUFSZ - 1 - (4 + sfxlen);
    sprintf(li, fmt, let_, txtlen, txt, suffix);

    if (savequan)
        obj.quan = savequan;

    return li;
    } finally { stack_pop($frame); }
}

/* show some or all of inventory while allowing the picking of an item in
   order to preform context-sensitive item action on it; always returns 'ok';
   invent subsets specified by the ')', '[', '(', '=', '"', or '*' commands
   when they're invoked with the 'm' prefix (or without it for '*') */
function dispinv_with_action(
    lets,
    use_inuse_ordering,
    alt_label) { /* int */ /* alternate value for in-use "Accessories" */
    let otmp, nextobj;
    let save_accessories = 0;
    let c, save_sortloot = 0;
    let len = lets ? strlen(lets) : 0;
    let menumode = (len != 1 || iflags.menu_requested) ? TRUE : FALSE,
            save_force_invmenu = iflags.force_invmenu;

    if (use_inuse_ordering) {
        save_accessories = inuse_headers[4];
        save_sortloot = flags.sortloot;

        flags.sortloot = ord('i'); /* checked by display_pickinv() */
        if (alt_label)
            inuse_headers[4] = alt_label;
    }
    iflags.force_invmenu = FALSE;

    c = display_inventory(lets, menumode);

    if (use_inuse_ordering) {
        flags.sortloot = save_sortloot;
        inuse_headers[4] = save_accessories;
    }
    iflags.force_invmenu = save_force_invmenu;

    if (c && c != ord('\x1b')) {
        for (otmp = gi.invent; otmp; otmp = nextobj) {
            nextobj = otmp.nobj;
            if (otmp.invlet == c)
                return itemactions(otmp);
        }
    }
    return ECMD_OK;
}

/* the #inventory command (not much left...) */
export function ddoinv() { /* int */
    return dispinv_with_action(0, FALSE, 0);
}

/*
 * find_unpaid()
 *
 * Scan the given list of objects.  If last_found is NULL, return the first
 * unpaid object found.  If last_found is not NULL, then skip over unpaid
 * objects until last_found is reached, then set last_found to NULL so the
 * next unpaid object is returned.  This routine recursively follows
 * containers.
 */
function find_unpaid(list, last_found) { /* struct obj * */
    let obj;

    while (list) {
        if (list.unpaid) {
            if (last_found[0]) {
                /* still looking for previous unpaid object */
                if (list == last_found[0])
                    last_found[0] = null;
            } else
                return (last_found[0] = list);
        }
        if (Has_contents(list)) {
            if ((obj = find_unpaid(list.cobj, last_found)) != null)
                return obj;
        }
        list = list.nobj;
    }
    return null;
}

export function free_pickinv_cache() { /* void */
    if (gc.cached_pickinv_win != WIN_ERR) {
        destroy_nhwindow()(gc.cached_pickinv_win);
        gc.cached_pickinv_win = WIN_ERR;
    }
}

/*
 * Internal function used by display_inventory and getobj that can display
 * inventory and return a count as well as a letter.
 */
function display_pickinv(
    lets,
    xtra_choice,
    query,
    allowxtra,
    want_reply,
    out_cnt) { /* char */ /* optional; count player entered when selecting an item */
    const $frame = stack_frame(); try {
    var not_carrying_anything = init_string(static_array("display_pickinv.not_carrying_anything", char, sizeof_string("Not carrying anything")), _("Not carrying anything"), true),
        not_using_anything = init_string(static_array("display_pickinv.not_using_anything", char, sizeof_string("Not using any items")), _("Not using any items"), true),
        only_carrying_gold = init_string(static_array("display_pickinv.only_carrying_gold", char, sizeof_string("Only carrying gold")), _("Only carrying gold"), true);

    var otmp, wizid_fakeobj = stack_struct(struct_obj), inuse_fakeobj = stack_struct(struct_obj);
    var ilet, ret, formattedobj;
    var invlet = flags.inv_order;
    var n, classcount, inusecount = 0;
    var win; /* windows being used */
    var any = stack_struct(struct_any);
    var selected = stack_var(ptr_to(struct_mi));
    var sortflags;
    var sortedinvent = stack_var(ptr_to(struct_sortloot_item)), srtinv;
    var prevorderclass;
    var filter = null;
    var wizid = (wizard() && iflags.override_ID ? 1 : 0), gotsomething = FALSE;
    var clr = NO_COLOR, menu_behavior = MENU_BEHAVE_STANDARD;
    var show_gold = TRUE, inuse_only = FALSE, skipped_gold = FALSE,
            doing_perm_invent = FALSE, save_flags_sortpack,
            usextra = (xtra_choice && allowxtra ? 1 : 0);

    if (lets && !chars[lets])
        lets = 0; /* simplify tests: (lets) instead of (lets && *lets) */

    if (lets || usextra || wizid || want_reply

        || WIN_INVEN == WIN_ERR) {
        /* partial inventory in perm_invent setting; don't operate on
           full inventory window, use an alternate one instead; create
           the first time needed and keep it for re-use as needed later */
        if (gc.cached_pickinv_win == WIN_ERR)
            gc.cached_pickinv_win = create_nhwindow()(NHW_MENU);
        win = gc.cached_pickinv_win;
        if (flags.sortloot == ord('i'))
            inuse_only = TRUE;
    } else {
        win = WIN_INVEN;
        menu_behavior = MENU_BEHAVE_PERMINV;
        prepare_perminvent(win);
        show_gold = +((wri_info.fromcore.invmode & InvShowGold) != 0);
        inuse_only = +((wri_info.fromcore.invmode & InvInUse) != 0);
        doing_perm_invent = TRUE;
    }
    /*
     * Exit early if no inventory -- but keep going if we are doing
     * a permanent inventory update.  We need to keep going so the
     * permanent inventory window updates itself to remove the last
     * item(s) dropped.  One down side:  the addition of the exception
     * for permanent inventory window updates _can_ pop the window
     * up when it's not displayed -- even if it's empty -- because we
     * don't know at this level if its up or not.  This may not be
     * an issue if empty checks are done before hand and the call
     * to here is short circuited away.
     *
     * 2: our count here is only to distinguish between 0 or 1 or
     * more than 1; for the last case, we don't need a precise number.
     * For perm_invent update we force 'more than 1'.
     */
    n = (doing_perm_invent && !lets && !want_reply) ? 2
        : lets ? int(strlen(lets))
               : !gi.invent ? 0 : !gi.invent.nobj ? 1 : 2;
    /* for xtra_choice, there's another 'item' not included in initial 'n';
       for !lets (full invent or inuse_only) and for override_ID (wizard
       mode identify), skip message_menu handling of single item even if
       item count was 1 */
    if (usextra || (n == 1 && (!lets || wizid)))
        ++n;

    if (n == 0) {
        pline(_("%s."), not_carrying_anything);
        return 0;
    }

    /* oxymoron? temporarily assign permanent inventory letters */
    if (!flags.invlet_constant)
        reassign();

    if (n == 1 && !iflags.force_invmenu && !iflags.menu_requested) {
        /* when only one item of interest, use pline instead of menus;
           we actually use a fake message-line menu in order to allow
           the user to perform selection at the --More-- prompt for tty */
        ret = ord('\0');
        if (usextra) {
            /* xtra_choice is "bare hands" (wield), "fingertip" (Engrave),
               "nothing" (prepare Quiver), "fingers" (apply grease), or
               "hands" (default) */
            ret = message_menu()(HANDS_SYM, PICK_ONE,
                               xprname(null, xtra_choice,
                                       HANDS_SYM, TRUE, 0, 0)); /* '-' */
        } else {
            for (otmp = gi.invent; otmp; otmp = otmp.nobj)
                if (!lets || otmp.invlet == chars[lets + 0])
                    break;
            if (otmp)
                ret = message_menu()(otmp.invlet,
                                   want_reply ? PICK_ONE : PICK_NONE,
                                   xprname(otmp, 0, chars[lets + 0],
                                           TRUE, 0, 0));
        }
        if (out_cnt)
            out_cnt[0] = -1; /* select all */
        return ret;
    }

    sortflags = (flags.sortloot == ord('f')) ? SORTLOOT_LOOT : SORTLOOT_INVLET;
    if (flags.sortpack)
        sortflags = unsigned(sortflags | SORTLOOT_PACK);
    save_flags_sortpack = flags.sortpack;

    if (inuse_only) {
        flags.sortpack = FALSE;
        sortflags = SORTLOOT_INUSE; /* override */
        filter = is_inuse;
        if (!uwep) {
            /*
             * inuse_only and not wielding anything: insert "bare hands"
             * into primary weapon slot.  Unlike adding an extra menu
             * entry for 'xtra_choice' at top of menu, we need an object
             * in invent for it to be sorted into desired position.
             * It will need custom formatting below.
             */
            struct_assign(inuse_fakeobj, cg.zeroobj); /* STRANGE_OBJECT, ILLOBJ_CLASS */
            inuse_fakeobj.invlet = HANDS_SYM; /* '-' */
            inuse_fakeobj.owornmask = W_WEP;  /* inuse_classify needs this */
            inuse_fakeobj.where = OBJ_INVENT; /* is_inuse filter needs this */
            inuse_fakeobj.nobj = gi.invent;
            gi.invent = inuse_fakeobj;
        }
    }

    sortedinvent[0] = sortloot(ref_of(gi, "invent"), sortflags, FALSE, filter);
    /* inuse_only: if we inserted bare hands as a fake weapon, remove them;
       although the fake object will no longer be in invent, sortedinvent
       will still contain a pointer to it */
    if (gi.invent == inuse_fakeobj) {
        gi.invent = inuse_fakeobj.nobj;
        inuse_fakeobj.nobj = null;
        /* if inuse_fakeobj is the only thing present in sortedinvent, get
           rid of it in order to produce "not using any items" */
        if (ptr_add(sortedinvent[0], 0).obj == inuse_fakeobj && !ptr_add(sortedinvent[0], 1).obj)
            ptr_add(sortedinvent[0], 0).obj = null;
    }

    start_menu()(win, ulong(menu_behavior));
    struct_assign(any, cg.zeroany);
    if (wizid) {
        var unid_cnt;
        var prompt = stack_array(char, QBUFSZ);

        unid_cnt = count_unidentified(gi.invent);
        sprintf(prompt, _("Debug Identify")); /* 'title' rather than 'prompt' */
        if (unid_cnt)
            sprintf(eos(prompt), _(" -- unidentified or partially identified item%s"), plur(unid_cnt))

;
        add_menu_str(win, prompt);
        if (!unid_cnt) {
            add_menu_str(win,
                         _("(all items are permanently identified already)"));
            gotsomething = TRUE;
        } else {
            any.a_obj = wizid_fakeobj;
            sprintf(prompt, _("select %s to permanently identify"), (unid_cnt == 1) ? _("it"): _("any or all of them"))
;
            /* wiz_identify stuffed the wiz_identify command character (^I)
               into iflags.override_ID for our use as an accelerator;
               it could be ambiguous if player has assigned a letter to
               the #wizidentify command, so include it as a group accelerator
               but use '_' as the primary selector */
            if (unid_cnt > 1)
                sprintf(eos(prompt), _(" (%s for all)"), visctrl(iflags.override_ID))
;
            add_menu(win, nul_glyphinfo, any, ord('_'), iflags.override_ID,
                     ATR_NONE, clr, prompt, MENU_ITEMFLAGS_SKIPINVERT);
            gotsomething = TRUE;
        }
   } else if (usextra) {
        /* wizard override ID and xtra_choice are mutually exclusive */
        if (flags.sortpack)
            add_menu_heading(win, _("Miscellaneous"));
        any.a_char = HANDS_SYM; /* '-' */
        add_menu(win, nul_glyphinfo, any, HANDS_SYM, 0, ATR_NONE,
                 clr, xtra_choice, MENU_ITEMFLAGS_NONE);
        gotsomething = TRUE;
    }

 nextclass: for (;;) {
    classcount = 0;
    prevorderclass = 0;
    for (srtinv = sortedinvent[0]; (otmp = srtinv.obj) != null; srtinv = ptr_add(srtinv, 1)) {
        var tmpglyph;
        var tmpglyphinfo = struct_assign(stack_struct(struct_glyphinfo), nul_glyphinfo);

        /* for showing a set of specific letters, skip ones not in the set */
        if (lets && !strchr(lets, otmp.invlet))
            continue;
        if (!flags.sortpack || otmp.oclass == chars[invlet]) {
            if (wizid && !not_fully_identified(otmp))
                continue;
            if (inuse_only) {
                /* for inuse-only, start with an extra header */
                if (!inusecount++)
                    add_menu_heading(win, doing_perm_invent ? _("In use")
                                            : _("Inventory in use"));
            } else if (doing_perm_invent && !show_gold) {
                /* don't skip gold if it is quivered, even for !show_gold */
                if (otmp.invlet == GOLD_SYM && !otmp.owornmask) {
                    skipped_gold = TRUE;
                    continue;
                }
            }
            /* maybe insert a class header */
            if (inuse_only ? (srtinv.orderclass != prevorderclass)
                           : (flags.sortpack && !classcount)) {
                var withsym = (want_reply && iflags.menu_head_objsym ? 1 : 0);
                var class_header = inuse_only
                        ? inuse_headers[srtinv.orderclass]
                        : let_to_name(chars[invlet], FALSE, withsym);

                add_menu_heading(win, class_header);
                classcount++;
                prevorderclass = srtinv.orderclass;
            }

            ilet = otmp.invlet;
            struct_assign(any, cg.zeroany); /* all bits zero */
            if (wizid)
                any.a_obj = otmp;
            else
                any.a_char = ilet;

            if (otmp == inuse_fakeobj) {
                /* fake item to format as "bare|gloved hands" */
                var barehands = stack_array(char, QBUFSZ);

                /* like doname() below, makeplural() returns an obuf[] */
                formattedobj = makeplural(body_part(HAND));
                sprintf(barehands, _("%s %s (no weapon)"), uarmg ? _("gloved") : _("bare"), formattedobj)
;
                add_menu(win, nul_glyphinfo, any, ilet, 0,
                         ATR_NONE, clr, barehands, MENU_ITEMFLAGS_NONE);
            } else {
                /* normal inventory item */
                tmpglyph = obj_to_glyph(otmp, rn2_on_display_rng);
                map_glyphinfo(0, 0, tmpglyph, 0, tmpglyphinfo);
                formattedobj = doname(otmp);
                add_menu(win, tmpglyphinfo, any, ilet,
                         wizid ? def_oc_syms[otmp.oclass].sym : 0,
                         ATR_NONE, clr, formattedobj, MENU_ITEMFLAGS_NONE);
            }
            /* doname() uses a static pool of obuf[] output buffers and
               we don't want inventory display to overwrite all of them,
               so when we've used one we release it for re-use */
            maybereleaseobuf(formattedobj);
            gotsomething = TRUE;
        }
    }
    if (flags.sortpack) {
        if (chars[++invlet])
            continue nextclass;;
        if (--invlet != venom_inv) {
            invlet = venom_inv;
            continue nextclass;
        }
    } break; }
    if (save_flags_sortpack != flags.sortpack)
        flags.sortpack = save_flags_sortpack;

    /* default for force_invmenu is a menu listing likely candidates;
       add '*' for 'list all' as an extra choice unless the menu already
       includes everything; when reissuing the menu after player has
       picked '*', add '?' for 'list likely candidates' to reverse that */
    if (iflags.force_invmenu && want_reply) {
        var menutext = 0;

        struct_assign(any, cg.zeroany);
        if ((allowxtra && !usextra)
            || (lets && int(strlen(lets)) < inv_cnt(TRUE))) {
            any.a_char = ord('*');
            menutext = _("(list everything)");
        } else if (!lets) {
            any.a_char = ord('?');
            menutext = _("(list likely candidates)");
        }
        if (menutext) {
            add_menu_heading(win, _("Special"));
            add_menu(win, nul_glyphinfo, any, any.a_char, 0, ATR_NONE, clr,
                     menutext, MENU_ITEMFLAGS_NONE);
            gotsomething = TRUE; /* menu isn't empty */
        }
    }
    unsortloot(sortedinvent);
    /* for permanent inventory where nothing has been listed (because
       there isn't anything applicable to list; the n==0 case above
       gets skipped for perm_invent), put something into the menu */
    if (doing_perm_invent && !lets && !gotsomething) {
        add_menu_str(win, inuse_only ? not_using_anything
                          : (!show_gold && skipped_gold) ? only_carrying_gold
                            : not_carrying_anything);
        want_reply = FALSE;
    }
    end_menu()(win, (query && chars[query]) ? query : 0);

    n = select_menu(win,
                    wizid ? PICK_ANY : want_reply ? PICK_ONE : PICK_NONE,
                    selected);
    if (n > 0) {
        if (wizid) {
            var all_id = FALSE;
            var i;

            /* identifying items will update perm_invent, calling this
               routine recursively, and we don't want the nested call
               to filter on unID'd items */
            iflags.override_ID = 0;
            ret = ord('\0');
            for (i = 0; i < n; ++i) {
                otmp = ptr_add(selected[0], i).item.a_obj;
                if (otmp == wizid_fakeobj) {
                    identify_pack(0, FALSE);
                    /* identify_pack() performs update_inventory() */
                    all_id = TRUE;
                    break;
                } else {
                    if (not_fully_identified(otmp))
                        identify(otmp);
                    /* identify() does not perform update_inventory() */
                }
            }
            if (!all_id)
                update_inventory();
        } else {
            ret = ptr_add(selected[0], 0).item.a_char;
            if (out_cnt)
                out_cnt[0] = ptr_add(selected[0], 0).count;
        }
        free(addr_of(selected[0]));
    } else
        ret = !n ? ord('\0') : ord('\x1b'); /* cancelled */

    return ret;
    } finally { stack_pop($frame); }
}

/*
 * If lets == NULL or "", list all objects in the inventory.  Otherwise,
 * list all objects with object classes that match the order in lets.
 *
 * Returns the letter identifier of a selected item, or 0 if nothing
 * was selected.
 */
export function display_inventory(lets, want_reply) { /* char */
    let cmdq = cmdq_pop();

    if (cmdq) {
        if (cmdq.typ == CMDQ_KEY) {
            let otmp;

            for (otmp = gi.invent; otmp; otmp = otmp.nobj)
                if (otmp.invlet == cmdq.key
                    && (!lets || !chars[lets]
                        || strchr(lets,
                                  def_oc_syms[otmp.oclass].sym))) {
                    free(addr_of(cmdq));
                    return otmp.invlet;
                }
        }

        /* cmdq not a key, or did not find the object, abort */
        free(addr_of(cmdq));
        cmdq_clear(CQ_CANNED);
        return ord('\0');
    }
    return display_pickinv(lets, 0, 0,
                           FALSE, want_reply, null);
}

export function repopulate_perminvent() { /* void */
        display_pickinv(0, 0, 0,
                               FALSE, FALSE, null);
}

/*
 * Show what is current using inventory letters.
 *
 */
function display_used_invlets(avoidlet) { /* char */
    const $frame = stack_frame(); try {
    let otmp;
    let ilet, ret = 0;
    let invlet = flags.inv_order;
    let n, classcount, invdone = 0, tmpglyph;
    let tmpglyphinfo = struct_assign(stack_struct(struct_glyphinfo), nul_glyphinfo);
    let win;
    let any = stack_struct(struct_any);
    let selected = stack_var(ptr_to(struct_mi));
    let clr = NO_COLOR;

    if (gi.invent) {
        win = create_nhwindow()(NHW_MENU);
        start_menu()(win, MENU_BEHAVE_STANDARD);
        while (!invdone) {
            struct_assign(any, cg.zeroany); /* set all bits to zero */
            classcount = 0;
            for (otmp = gi.invent; otmp; otmp = otmp.nobj) {
                ilet = otmp.invlet;
                if (ilet == avoidlet)
                    continue;
                if (!flags.sortpack || otmp.oclass == chars[invlet]) {
                    if (flags.sortpack && !classcount) {
                        struct_assign(any, cg.zeroany); /* zero */
                        add_menu_heading(win,
                                         let_to_name(chars[invlet], FALSE, FALSE));
                        classcount++;
                    }
                    any.a_char = ilet;
                    tmpglyph = obj_to_glyph(otmp, rn2_on_display_rng);
                    map_glyphinfo(0, 0, tmpglyph, 0, tmpglyphinfo);
                    add_menu(win, tmpglyphinfo, any, ilet, 0,
                             ATR_NONE, clr, doname(otmp),
                             MENU_ITEMFLAGS_NONE);
                }
            }
            if (flags.sortpack && chars[++invlet])
                continue;
            invdone = 1;
        }
        end_menu()(win, _("Inventory letters used:"));

        n = select_menu(win, PICK_ONE, selected);
        if (n > 0) {
            ret = ptr_add(selected[0], 0).item.a_char;
            free(addr_of(selected[0]));
        } else
            ret = !n ? ord('\0') : ord('\x1b'); /* cancelled */
        destroy_nhwindow()(win);
    }
    return ret;
    } finally { stack_pop($frame); }
}

/*
 * Returns the number of unpaid items within the given list.  This includes
 * contained objects.
 */
export function count_unpaid(list) { /* int */
    let count = 0;

    while (list) {
        if (list.unpaid)
            count++;
        if (Has_contents(list))
            count += count_unpaid(list.cobj);
        list = list.nobj;
    }
    return count;
}

/*
 * Returns the number of items with b/u/c/unknown within the given list.
 * This does NOT include contained objects.
 *
 * Assumes that the hero sees or touches or otherwise senses the objects
 * at some point:  bknown is forced for priest[ess], like in xname().
 */
export function count_buc(list, type, filterfunc) { /* int */
    let count = 0;

    for (; list; list = list.nobj) {
        /* priests always know bless/curse state */
        if (Role_if(PM_CLERIC))
            list.bknown = +(list.oclass != COIN_CLASS);
        /* some actions exclude some or most items */
        if (filterfunc && !filterfunc(list))
            continue;

        /* coins are either uncursed or unknown based upon option setting */
        if (list.oclass == COIN_CLASS) {
            if (type == (flags.goldX ? BUC_UNKNOWN : BUC_UNCURSED))
                ++count;
            continue;
        }
        /* check whether this object matches the requested type */
        if (!list.bknown
                ? (type == BUC_UNKNOWN)
                : list.blessed ? (type == BUC_BLESSED)
                                : list.cursed ? (type == BUC_CURSED)
                                               : (type == BUC_UNCURSED))
            ++count;
    }
    return count;
}

/* similar to count_buc(), but tallies all states at once
   rather than looking for a specific type */
export function tally_BUCX(
    list,
    by_nexthere,
    bcp, ucp, ccp, xcp, ocp, jcp) { /* void */
    /* Future extensions:
     *  Skip current_container when list is invent, uchain when
     *  first object of list is located on the floor.  'ocp' will then
     *  have a function again (it was a counter for having skipped gold,
     *  but that's not skipped anymore).
     */
    bcp[0] = ucp[0] = ccp[0] = xcp[0] = ocp[0] = jcp[0] = 0;
    for ( ; list; list = (by_nexthere ? list.v.v_nexthere : list.nobj)) {
        /* priests always know bless/curse state */
        if (Role_if(PM_CLERIC))
            list.bknown = +(list.oclass != COIN_CLASS);
        if (list.pickup_prev)
            ++(jcp[0]);
        /* coins are either uncursed or unknown based upon option setting */
        if (list.oclass == COIN_CLASS) {
            if (flags.goldX)
                ++(xcp[0]);
            else
                ++(ucp[0]);
            continue;
        }
        /* ordinary items */
        if (!list.bknown)
            ++(xcp[0]);
        else if (list.blessed)
            ++(bcp[0]);
        else if (list.cursed)
            ++(ccp[0]);
        else /* neither blessed nor cursed => uncursed */
            ++(ucp[0]);
    }
}

/* count everything inside a container, or just shop-owned items inside */
export function count_contents(
    container,
    nested,
    quantity,
    everything,
    newdrop) { /* long long */ /* on floor, but hero-owned items haven't * been marked no_charge yet and shop-owned * items are still marked unpaid -- used * when asking the player whether to sell */
    const $frame = stack_frame(); try {
    let otmp, topc;
    let shoppy = FALSE;
    let count = 0;

    if (!everything && !newdrop) {
        let x = stack_var(coordxy), y = stack_var(coordxy);

        for (topc = container; topc.where == OBJ_CONTAINED;
             topc = topc.v.v_ocontainer)
            continue;
        if (topc.where == OBJ_FLOOR && get_obj_location(topc, x, y, 0))
            shoppy = costly_spot(x[0], y[0]);
    }
    for (otmp = container.cobj; otmp; otmp = otmp.nobj) {
        if (nested && Has_contents(otmp))
            count += count_contents(otmp, nested, quantity, everything,
                                    newdrop);
        if (everything || otmp.unpaid || (shoppy && !otmp.no_charge))
            count += quantity ? otmp.quan : 1;
    }
    return count;
    } finally { stack_pop($frame); }
}

function dounpaid(
    count,
    floorcount,
    buriedcount) { /* void */ /* unpaid items under the floor (extremely rare) */
    const $frame = stack_frame(); try {
    let win;
    let otmp, marker = stack_var(ptr_to(struct_obj)), contnr;
    let ilet;
    let invlet = flags.inv_order;
    let classcount, num_so_far, xtracount;
    let cost, totcost;

    otmp = marker[0] = contnr = null;
    xtracount = floorcount + buriedcount;

    if (count == 1 && !xtracount) {
        otmp = find_unpaid(gi.invent, marker);
        contnr = unknwn_contnr_contents(otmp);
    }
    if  (otmp && !contnr) {
        /* 1 item; use pline instead of popup menu */
        cost = unpaid_cost(otmp, COST_NOCONTENTS);
        iflags.suppress_price++; /* suppress "(unpaid)" suffix */
        pline(_("%s"), xprname(otmp, distant_name(otmp, doname),
                       carried(otmp) ? otmp.invlet : CONTAINED_SYM,
                       TRUE, cost, 0));
        iflags.suppress_price--;
        return;
    }

    win = create_nhwindow()(NHW_MENU);
    totcost = 0;
    num_so_far = 0; /* count of # printed so far */
    if (!flags.invlet_constant)
        reassign();

    do {
        classcount = 0;
        for (otmp = gi.invent; otmp; otmp = otmp.nobj) {
            ilet = otmp.invlet;
            if (otmp.unpaid) {
                if (!flags.sortpack || otmp.oclass == chars[invlet]) {
                    if (flags.sortpack && !classcount) {
                        putstr()(win, 0, let_to_name(chars[invlet], TRUE, FALSE));
                        classcount++;
                    }

                    totcost += cost = unpaid_cost(otmp, COST_NOCONTENTS);
                    iflags.suppress_price++; /* suppress "(unpaid)" suffix */
                    putstr()(win, 0, xprname(otmp, distant_name(otmp, doname),
                                           ilet, TRUE, cost, 0));
                    iflags.suppress_price--;
                    num_so_far++;
                }
            }
        }
    } while (flags.sortpack && (chars[++invlet]));

    if (count > num_so_far) {
        /* something unpaid is contained */
        if (flags.sortpack)
            putstr()(win, 0, let_to_name(CONTAINED_SYM, TRUE, FALSE));
        /*
         * Search through the container objects in the inventory for
         * unpaid items.  The top level inventory items have already
         * been listed.
         */
        for (otmp = gi.invent; otmp; otmp = otmp.nobj) {
            if (Has_contents(otmp)) {
                let contcost = 0;

                marker[0] = null; /* haven't found any */
                while (find_unpaid(otmp.cobj, marker)) {
                    totcost += cost = unpaid_cost(marker[0], COST_NOCONTENTS);
                    contcost += cost;
                    if (otmp.cknown) {
                        iflags.suppress_price++; /* suppress "(unpaid)" sfx */
                        putstr()(win, 0,
                               xprname(marker[0], distant_name(marker[0], doname),
                                       CONTAINED_SYM, TRUE, cost, 0));
                        iflags.suppress_price--;
                    }
                }
                if (!otmp.cknown) {
                    let contbuf = stack_array(char, BUFSZ);

                    /* Shopkeeper knows what to charge for contents */
                    sprintf(contbuf, _("%s contents"), s_suffix(xname(otmp)));
                    putstr()(win, 0,
                           xprname(null, contbuf, CONTAINED_SYM,
                                   TRUE, contcost, 0));
                }
            }
        }
    }

    if (count > 0) {
        putstr()(win, 0, _(""));
        putstr()(win, 0,
               xprname(null, _("Total:"), ord('*'), FALSE, totcost, 0));
    }

    /* an unpaid item can be on the floor if dropped on the shop boundary
       (then possibly moved all the way into the shop during wall repair);
       one can be buried if it started that way and a pit was dug at its
       spot then filled by a boulder (or perhaps a theme room with a pool
       and an unpaid item moved into that by wall repair, then freezing) */
    if (xtracount > 0) { /* floorcount + buriedcount > 0 */
        let buf = stack_array(char, BUFSZ);
        let floorverb = (xtracount > 1) ? _("are") : _("is"),

            where = (buriedcount == 0) ? _("on the floor")
                     : (floorcount == 0) ? _("under the floor")
                       : _("on or under the floor");

        if (!count) {
            You(_("aren't carrying any unpaid items but there %s %d %s."),
                floorverb, xtracount, where);
        } else {
            putstr()(win, 0, _(""));
            sprintf(buf, _("(There %s %d more unpaid object%s %s.)"), floorverb, xtracount, plur(xtracount), where)
;
            putstr()(win, 0, buf);
        }
    }

    if (count > 0)
        display_nhwindow()(win, FALSE);
    destroy_nhwindow()(win);
    return;
    } finally { stack_pop($frame); }
}

function this_type_only(obj) { /* boolean */
    let res = +(obj.oclass == gt.this_type);

    if (gt.this_type == ord('P')) {
        res = obj.pickup_prev;
    } else if (obj.oclass == COIN_CLASS) {
        /* if filtering by bless/curse state, gold is classified as
           either unknown or uncursed based on user option setting */
        if (gt.this_type && strchr(_("BUCX"), gt.this_type))
            res = +(gt.this_type == (flags.goldX ? ord('X') : ord('U')));
    } else {
        switch (gt.this_type) {
        case ord('B'):
            res = (obj.bknown && obj.blessed ? 1 : 0);
            break;
        case ord('U'):
            res = (obj.bknown && !(obj.blessed || obj.cursed) ? 1 : 0);
            break;
        case ord('C'):
            res = (obj.bknown && obj.cursed ? 1 : 0);
            break;
        case ord('X'):
            res = +!obj.bknown;
            break;
        default:
            break; /* use 'res' as-is */
        }
    }
    return res;
}

/* the #inventtype command */
export function dotypeinv() { /* int */
    const $frame = stack_frame(); try {
    var prompt = init_string(static_array("dotypeinv.prompt", char, sizeof_string("What type of object do you want an inventory of?")), _("What type of object do you want an inventory of?"), true);

    var c = ord('\0');
    var n, i = 0;
    var extra_types, types = stack_array(char, BUFSZ), title = stack_array(char, QBUFSZ);
    var before = _(""), after = _("");
    var class_count, oclass, itemcount = stack_var(int),
        any_unpaid, u_carried, u_floor, u_buried;
    var bcnt = stack_var(int), ccnt = stack_var(int), ucnt = stack_var(int), xcnt = stack_var(int), ocnt = stack_var(int), jcnt = stack_var(int);
    var billx = (chars[u.ushops] && doinvbill(0) ? 1 : 0);
    var pick_list = stack_var(ptr_to(struct_mi));
    var traditional = TRUE;

    gt.this_type = 0;
    gt.this_title = 0;
    doI_done: { if (!gi.invent && !billx) {
        You(_("aren't carrying anything."));
        break doI_done;
    }
    chars[title + 0] = ord('\0');
    u_carried = count_unpaid(gi.invent);
    u_floor = count_unpaid(fobj());
    u_buried = count_unpaid(svl.level.buriedobjlist);
    any_unpaid = u_carried + u_floor + u_buried;
    tally_BUCX(gi.invent, FALSE, bcnt, ucnt, ccnt, xcnt, ocnt, jcnt);

    if (flags.menu_style != MENU_TRADITIONAL) {
        if (flags.menu_style == MENU_FULL
            || flags.menu_style == MENU_PARTIAL) {
            traditional = FALSE;
            i = UNPAID_TYPES;
            if (billx)
                i |= BILLED_TYPES;
            if (bcnt[0])
                i |= BUC_BLESSED;
            if (ucnt[0])
                i |= BUC_UNCURSED;
            if (ccnt[0])
                i |= BUC_CURSED;
            if (xcnt[0])
                i |= BUC_UNKNOWN;
            if (jcnt[0])
                i |= JUSTPICKED;
            i |= INCLUDE_VENOM;
            n = query_category(prompt, gi.invent, i, pick_list, PICK_ONE);
            if (!n)
                break doI_done;;
            gt.this_type = c = ptr_add(pick_list[0], 0).item.a_int;
            free(addr_of(pick_list[0]));
        }
    }
    if (traditional) {
        /* collect list of classes of objects carried, for use as a prompt */
        chars[types + 0] = 0;
        class_count = collect_obj_classes(types, gi.invent, FALSE,
                                          null,
                                          itemcount);
        if (any_unpaid || billx || (bcnt[0] + ccnt[0] + ucnt[0] + xcnt[0]) != 0 || jcnt[0])
            chars[types + (class_count++)] = ord(' ');
        if (any_unpaid)
            chars[types + (class_count++)] = ord('u');
        if (billx)
            chars[types + (class_count++)] = ord('x');
        if (bcnt[0])
            chars[types + (class_count++)] = ord('B');
        if (ucnt[0])
            chars[types + (class_count++)] = ord('U');
        if (ccnt[0])
            chars[types + (class_count++)] = ord('C');
        if (xcnt[0])
            chars[types + (class_count++)] = ord('X');
        if (jcnt[0])
            chars[types + (class_count++)] = ord('P');
        chars[types + class_count] = ord('\0');
        /* add everything not already included; user won't see these */
        extra_types = eos(types);
        chars[extra_types++] = ord('\x1b');
        if (!any_unpaid)
            chars[extra_types++] = ord('u');
        if (!billx)
            chars[extra_types++] = ord('x');
        if (!bcnt[0])
            chars[extra_types++] = ord('B');
        if (!ucnt[0])
            chars[extra_types++] = ord('U');
        if (!ccnt[0])
            chars[extra_types++] = ord('C');
        if (!xcnt[0])
            chars[extra_types++] = ord('X');
        if (!jcnt[0])
            chars[extra_types++] = ord('P');
        chars[extra_types] = ord('\0'); /* for strchr() */
        for (i = 0; i < MAXOCLASSES; i++)
            if (!strchr(types, def_oc_syms[i].sym)) {
                chars[extra_types++] = def_oc_syms[i].sym;
                chars[extra_types] = ord('\0');
            }

        if (class_count > 1) {
            c = yn_function(prompt, types, ord('\0'), TRUE);
            if (c == ord('\0')) {
                clear_nhwindow()(WIN_MESSAGE);
                break doI_done;
            }
        } else {
            /* only one thing to itemize */
            if (any_unpaid)
                c = ord('u');
            else if (billx)
                c = ord('x');
            else
                c = chars[types + 0];
        }
    }
    if (c == ord('x') || (c == ord('X') && billx && !xcnt[0])) {
        if (billx)
            doinvbill(1);
        else
            pline(_("No used-up objects%s."),
                  any_unpaid ? _(" on your shopping bill") : _(""));
        break doI_done;
    }
    if (c == ord('u') || (c == ord('U') && any_unpaid && !ucnt[0])) {
        if (any_unpaid)
            dounpaid(u_carried, u_floor, u_buried);
        else
            You(_("are not carrying any unpaid objects."));
        break doI_done;
    }

    if (strchr(_("BUCXP"), c))
        oclass = c; /* not a class but understood by this_type_only() */
    else
        oclass = def_char_to_objclass(c); /* change to object class */

    /* these are used for traditional when not applicable and also for
       constructing a title to be used by query_objlist() */
    switch (c) {
    case ord('B'):
        before = _("known to be blessed ");
        break;
    case ord('U'):
        before = _("known to be uncursed ");
        break;
    case ord('C'):
        before = _("known to be cursed ");
        break;
    case ord('X'):
        after = _(" whose blessed/uncursed/cursed status is unknown");
        break; /* better phrasing is desirable */
    case ord('P'):
        after = _(" that were just picked up");
        break;
    default:
        /* 'c' is an object class, because we've already handled
           all the non-class letters which were put into 'types[]';
           could/should move object class names[] array from below
           to somewhere above so that we can access it here (via
           lcase(strcpy(classnamebuf, names[(int) c]))), but the
           game-play value of doing so is low... */
        before = _("such ");
        break;
    }

    if (traditional) {
        if (strchr(types, c) > strchr(types, ord('\x1b'))) {
            You(_("have no %sobjects%s."), before, after);
            break doI_done;
        }
        gt.this_type = oclass; /* extra input for this_type_only() */
    }
    if (strchr(_("BUCXP"), c)) {
        /* the before and after phrases for "you have no..." can both be
           treated as mutually-exclusive suffices when creating a title */
        sprintf(title, _("Items %s"), (before && chars[before]) ? before : after);
        /* get rid of trailing space from 'before' and double-space from
           'after's leading space */
        mungspaces(title);
        strcat(title, _(":")); /* after removing unwanted trailing space */
        gt.this_title = title;
    }

    if (query_objlist(0, ref_of(gi, "invent"),
                      ((flags.invlet_constant ? USE_INVLET : 0)
                       | INVORDER_SORT | INCLUDE_VENOM),
                      pick_list, PICK_ONE, this_type_only) > 0) {
        var otmp = ptr_add(pick_list[0], 0).item.a_obj;

        free(addr_of(pick_list[0]));
        itemactions(otmp); /* always returns ECMD_OK */
    }
 }
    gt.this_type = 0;
    gt.this_title = 0;
    return ECMD_OK;
    } finally { stack_pop($frame); }
}

/* return a string describing the dungeon feature at <x,y> if there
   is one worth mentioning at that location; otherwise null */
export function dfeature_at(x, y, buf) { /* const char * */
    let lev = levl()[x][y];
    let ltyp = lev.typ, cmap = -1;
    let dfeature = 0;
    let altbuf = static_array("dfeature_at.altbuf", char, BUFSZ);
    let stway = stairway_at(x, y);

    if (IS_DOOR(ltyp)) {
        switch (lev.flags) {
        case D_NODOOR:
            cmap = S_ndoor;
            break; /* "doorway" */
        case D_ISOPEN:
            cmap = S_vodoor;
            break; /* "open door" */
        case D_BROKEN:
            dfeature = _("broken door");
            break;
        default:
            cmap = S_vcdoor;
            break; /* "closed door" */
        }
        /* override door description for open drawbridge */
        if (is_drawbridge_wall(x, y) >= 0)
            dfeature = _("open drawbridge portcullis"), cmap = -1;
    } else if (IS_FOUNTAIN(ltyp))
        cmap = S_fountain; /* "fountain" */
    else if (IS_THRONE(ltyp))
        cmap = S_throne; /* "opulent throne" */
    else if (is_lava(x, y))
        cmap = S_lava; /* "molten lava" */
    else if (is_ice(x, y))
        dfeature = ice_descr(x, y, altbuf), cmap = -1; /* "ice" */
    else if (is_pool(x, y))
        dfeature = _("pool of water");
    else if (IS_SINK(ltyp))
        cmap = S_sink; /* "sink" */
    else if (IS_ALTAR(ltyp)) {
        sprintf(altbuf, _("%saltar to %s (%s)"), (lev.flags & AM_SANCTUM) ? _("high ") : _(""), a_gname(), align_str(Amask2align(lev.flags & ~AM_SHRINE)))

;
        dfeature = altbuf;
    } else if (stway) {
        dfeature = stairs_description(stway, altbuf, TRUE);
    } else if (ltyp == DRAWBRIDGE_DOWN)
        cmap = S_vodbridge; /* "lowered drawbridge" */
    else if (ltyp == DBWALL)
        cmap = S_vcdbridge; /* "raised drawbridge" */
    else if (IS_GRAVE(ltyp))
        cmap = S_grave; /* "grave" */
    else if (ltyp == TREE)
        cmap = S_tree; /* "tree" */
    else if (ltyp == IRONBARS)
        dfeature = _("set of iron bars");

    if (cmap >= 0)
        dfeature = defsyms[cmap].explanation;
    if (dfeature)
        strcpy(buf, dfeature);
    return dfeature;
}

/* look at what is here; if there are many objects (pile_limit or more),
   don't show them unless obj_cnt is 0 */
export function look_here(
    obj_cnt,
    lookhere_flags) { /* int */
    const $frame = stack_frame(); try {
    let otmp;
    let trap;
    let verb = Blind() ? _("feel") : _("see");
    let dfeature = 0;
    let fbuf = stack_array(char, BUFSZ), fbuf2 = stack_array(char, BUFSZ);
    let tmpwin;
    let skip_objects, felt_cockatrice = FALSE,
            picked_some = +((lookhere_flags & LOOKHERE_PICKED_SOME) != 0),

            skip_dfeature = +((lookhere_flags & LOOKHERE_SKIP_DFEATURE) != 0);

    /* default pile_limit is 5; a value of 0 means "never skip"
       (and 1 effectively forces "always skip") */
    skip_objects = +(flags.pile_limit > 0 && obj_cnt >= flags.pile_limit);
    if (u.uswallow) {
        let mtmp = u.ustuck;

        /*
         * FIXME?
         *  Engulfer's inventory can include worn items (specific case is
         *  Juiblex being created with an amulet as random defensive item)
         *  which will be flagged as "(being worn)".  This code includes
         *  such a worn item under the header "Contents of <mon>'s stomach",
         *  a nifty trick for how/where to wear stuff.  The situation is
         *  rare enough to turn a blind eye.
         *
         *  3.6.3:  Pickup has been changed to decline to pick up a worn
         *  item from inside an engulfer, but if player tries, it just
         *  says "you can't" without giving a reason why (which would be
         *  something along the lines of "because it's worn on the outside
         *  so is unreachable from in here...").
         */
        sprintf(fbuf, _("Contents of %s %s"), s_suffix(mon_nam(mtmp)), mbodypart(mtmp, STOMACH))
;
        /* Skip "Contents of " by using fbuf index 12 */
        You(_("%s to %s what is lying in %s."), Blind() ? _("try") : _("look around"),
            verb, fbuf + 12);
        otmp = mtmp.minvent;
        if (otmp) {
            for (; otmp; otmp = otmp.nobj) {
                /* If swallower is an animal, it should have become stone
                 * but... */
                if (otmp.otyp == CORPSE)
                    feel_cockatrice(otmp, FALSE);
            }
            if (Blind())
                strcpy(fbuf, _("You feel"));
            strcat(fbuf, _(":"));
            display_minventory(mtmp, MINV_ALL | PICK_NONE, fbuf);
        } else {
            You(_("%s no objects here."), verb);
        }
        return (!!Blind() ? ECMD_TIME : ECMD_OK);
    }
    if (!skip_objects) {
        let reg;
        let regbuf = stack_array(char, QBUFSZ);

        chars[regbuf + 0] = ord('\0');
        if ((reg = visible_region_at(u.ux, u.uy)) != null)
            sprintf(regbuf, _("a %s cloud"), reg_damg(reg) ? _("poison gas") : _("vapor"))
;
        if ((trap = t_at(u.ux, u.uy)) != null && !trap.tseen)
            trap = null;

        if (reg || trap)
            There(_("is %s%s%s here."),
                  reg ? regbuf : _(""),
                  (reg && trap) ? _(" and ") : _(""),
                  trap ? an(trapname(trap.ttyp, FALSE)) : _(""));
    }

    otmp = svl.level.objects[u.ux][u.uy];
    dfeature = dfeature_at(u.ux, u.uy, fbuf2);
    if (dfeature && !strcmp(dfeature, _("pool of water")) && Underwater())
        dfeature = 0;

    if (Blind()) {
        let drift = (Is_airlevel(u.uz) || Is_waterlevel(u.uz) ? 1 : 0);

        if (dfeature && !strncmp(dfeature, _("altar "), 6)) {
            /* don't say "altar" twice, dfeature has more info */
            You(_("try to feel what is here."));
        } else if (SURFACE_AT(u.ux, u.uy) == ICE) {
            /* using describe_decor() to handle ice is simpler than
               replicating it in the conditional message construction */
            if (!flags.mention_decor || iflags.prev_decor == ICE)
                force_decor(FALSE);
            /* plain "ice" if blind and levitating, otherwise "solid ice" &c;
              "There is [thin ]ice here.  You try to feel what is on it." */
            You(_("try to feel what is on it."));
            skip_dfeature = TRUE; /* ice already described */
        } else {
            let cant_reach = +!can_reach_floor(TRUE);
            let surf = surface(u.ux, u.uy),
                       where = cant_reach ? _("lying beneath you")
                                           : _("lying here on the "),
                       onwhat = cant_reach ? _("") : surf;

            You(_("try to feel what is %s%s."), drift ? _("floating here") : where,
                drift ? _("") : onwhat);

            if (dfeature && !drift && !strcmp(dfeature, surf))
                skip_dfeature = TRUE; /* terrain feature already identified */
        }
        trap = t_at(u.ux, u.uy);
        if (!can_reach_floor((trap && is_pit(trap.ttyp) ? 1 : 0))) {
            pline(_("But you can't reach it!"));
            return ECMD_OK;
        }
    }

    if (dfeature && !skip_dfeature) {
        let p;
        let article = 1; /* 0 => none, 1 => a/an, 2 => the (not used here) */

        /* "molten lava", "iron bars", and plain "ice" are handled as special
           cases in an() but probably shouldn't be; don't rely on that */
        if (!strcmp(dfeature, _("molten lava"))
            || !strcmp(dfeature, _("iron bars"))
            || !strcmp(dfeature, _("ice"))
            || !strncmp(dfeature, _("frozen "), 7) /* ice while hallucinating */
            /* thawing ice ("solid ice", "thin ice", &c) */
            || ((p = strchr(dfeature, ord(' '))) != 0 && !strncmpi((p), _((" ice")), -1)))
            article = 0;
        if (article == 1)
            dfeature = an(dfeature);

        /* hardcoded "is" worked here because "iron bars" is actually
           "set of iron bars"; use vtense() instead of relying on that */
        sprintf(fbuf, _("There %s %s here."), vtense(dfeature, _("are")), dfeature);
    }

    if (!otmp || is_lava(u.ux, u.uy)
        || (is_pool(u.ux, u.uy) && !Underwater())) {
        if (dfeature && !skip_dfeature)
            pline1(fbuf);
        read_engr_at(u.ux, u.uy); /* Eric Backus */
        if (!skip_objects && (Blind() || !dfeature))
            You(_("%s no objects here."), verb);
        return (!!Blind() ? ECMD_TIME : ECMD_OK);
    }
    /* we know there is something here */

    if (skip_objects) {
        if (dfeature && !skip_dfeature)
            pline1(fbuf);
        read_engr_at(u.ux, u.uy); /* Eric Backus */
        if (obj_cnt == 1 && otmp.quan == 1)
            There(_("is %s object here."), picked_some ? _("another") : _("an"));
        else
            There(_("are %s%s objects here."),
                  (obj_cnt == 2) ? _("two")
                  : (obj_cnt < 5) ? _("a few")
                    : (obj_cnt < 10) ? _("several")
                      : _("many"),
                  picked_some ? _(" more") : _(""));
        for (; otmp; otmp = otmp.v.v_nexthere)
            if (otmp.otyp == CORPSE && will_feel_cockatrice(otmp, FALSE)) {
                pline(_("%s %s%s."),
                      (obj_cnt > 1) ? _("Including")
                      : (otmp.quan > 1) ? _("They're")
                        : _("It's"),
                      corpse_xname(otmp, 0, CXN_ARTICLE),
                      poly_when_stoned(gy.youmonst.data) ? _("")
                      : _(", unfortunately"));
                feel_cockatrice(otmp, FALSE);
                break;
            }
    } else if (!otmp.v.v_nexthere) {
        /* only one object */
        if (dfeature && !skip_dfeature)
            pline1(fbuf);
        read_engr_at(u.ux, u.uy); /* Eric Backus */
        You(_("%s here %s."), verb, doname_with_price(otmp));
        iflags.last_msg = PLNMSG_ONE_ITEM_HERE;
        if (otmp.otyp == CORPSE)
            feel_cockatrice(otmp, FALSE);
    } else {
        let buf = stack_array(char, BUFSZ);

        display_nhwindow()(WIN_MESSAGE, FALSE);
        tmpwin = create_nhwindow()(NHW_MENU);
        if (dfeature && !skip_dfeature) {
            putstr()(tmpwin, 0, fbuf);
            putstr()(tmpwin, 0, _(""));
        }
        sprintf(buf, _("%s that %s here:"), picked_some ? _("Other things") : _("Things"), Blind() ? _("you feel") : _("are"))

;
        putstr()(tmpwin, 0, buf);
        for (; otmp; otmp = otmp.v.v_nexthere) {
            if (otmp.otyp == CORPSE && will_feel_cockatrice(otmp, FALSE)) {
                felt_cockatrice = TRUE;
                sprintf(buf, _("%s..."), doname(otmp));
                putstr()(tmpwin, 0, buf);
                break;
            }
            putstr()(tmpwin, 0, doname_with_price(otmp));
        }
        display_nhwindow()(tmpwin, TRUE);
        destroy_nhwindow()(tmpwin);
        if (felt_cockatrice)
            feel_cockatrice(otmp, FALSE);
        read_engr_at(u.ux, u.uy); /* Eric Backus */
    }
    return (!!Blind() ? ECMD_TIME : ECMD_OK);
    } finally { stack_pop($frame); }
}

/* #look command - explicitly look at what is here, including all objects */
export function dolook() { /* int */
    let res;

    /* don't let
       MSGTYPE={norep,noshow} "You see here"
       interfere with feedback from the look-here command */
    hide_unhide_msgtypes(TRUE, MSGTYP_MASK_REP_SHOW);
    res = look_here(0, LOOKHERE_NOFLAGS);
    /* restore normal msgtype handling */
    hide_unhide_msgtypes(FALSE, MSGTYP_MASK_REP_SHOW);
    return res;
}

export function will_feel_cockatrice(otmp, force_touch) { /* boolean */
    if ((Blind() || force_touch) && !uarmg && !Stone_resistance()
        && (otmp.otyp == CORPSE && touch_petrifies(mons[otmp.corpsenm])))
        return TRUE;
    return FALSE;
}

export function feel_cockatrice(otmp, force_touch) { /* void */
    const $frame = stack_frame(); try {
    let kbuf = stack_array(char, BUFSZ);

    if (will_feel_cockatrice(otmp, force_touch)) {
        /* "the <cockatrice> corpse" */
        strcpy(kbuf, corpse_xname(otmp, 0, CXN_PFX_THE));

        if (poly_when_stoned(gy.youmonst.data))
            You(_("touched %s with your bare %s."), kbuf,
                makeplural(body_part(HAND)));
        else
            pline(_("Touching %s is a fatal mistake..."), kbuf);
        /* normalize body shape here; hand, not body_part(HAND) */
        sprintf(kbuf, _("touching %s bare-handed"), killer_xname(otmp));
        /* will call polymon() for the poly_when_stoned() case */
        instapetrify(kbuf);
    }
    } finally { stack_pop($frame); }
}

/* 'obj' is being placed on the floor; if it can merge with something that
   is already there, combine them and discard obj as a separate object */
export function stackobj(obj$) { /* void */
    const $frame = stack_frame(); try {
    const obj = stack_var(ptr_to(struct_obj), obj$);
    let otmp = stack_var(ptr_to(struct_obj));

    for (otmp[0] = svl.level.objects[obj[0].ox][obj[0].oy]; otmp[0];
         otmp[0] = otmp[0].v.v_nexthere)
        if (otmp[0] != obj[0] && merged(obj, otmp))
            break;
    return;
    } finally { stack_pop($frame); }
}

/* returns TRUE if obj & otmp can be merged; used in invent.c and mkobj.c */
export function mergable(
    otmp,
    obj) { /* boolean */ /* 'combine' stack */
    let objnamelth = 0, otmpnamelth = 0;

    /* fail if already the same object, if different types, if either is
       explicitly marked to prevent merge, or if not mergable in general */
    if (obj == otmp || obj.otyp != otmp.otyp
        || obj.nomerge || otmp.nomerge || !objects[obj.otyp].oc_merge)
        return FALSE;

    /* coins of the same kind will always merge */
    if (obj.oclass == COIN_CLASS)
        return TRUE;

    if (obj.cursed != otmp.cursed || obj.blessed != otmp.blessed)
        return FALSE;

    if (obj.how_lost == LOST_EXPLODING
        || otmp.how_lost == LOST_EXPLODING)
        return FALSE;
    if (otmp.how_lost != LOST_NONE && (obj.how_lost != otmp.how_lost))
        return FALSE;

    if (obj.globby)
        return TRUE;
    /* Checks beyond this point either aren't applicable to globs
     * or don't inhibit their merger.
     */

    if (obj.unpaid != otmp.unpaid || obj.spe != otmp.spe
        || obj.no_charge != otmp.no_charge || obj.obroken != otmp.obroken
        || obj.otrapped != otmp.otrapped || obj.lamplit != otmp.lamplit)
        return FALSE;

    if (obj.oclass == FOOD_CLASS
        && (obj.oeaten != otmp.oeaten || obj.oeroded != otmp.oeroded))
        return FALSE;

    if (obj.dknown != otmp.dknown
        || (obj.bknown != otmp.bknown && !Role_if(PM_CLERIC) &&
            (Blind() || Hallucination()))
        || obj.oeroded != otmp.oeroded || obj.oeroded2 != otmp.oeroded2
        || obj.greased != otmp.greased)
        return FALSE;

    if (erosion_matters(obj)
        && (obj.oerodeproof != otmp.oerodeproof
            || (obj.rknown != otmp.rknown && (Blind() || Hallucination()))))
        return FALSE;

    if (obj.otyp == CORPSE || obj.otyp == EGG || obj.otyp == TIN) {
        if (obj.corpsenm != otmp.corpsenm)
            return FALSE;
    }

    /* hatching eggs don't merge; ditto for revivable corpses */
    if ((obj.otyp == EGG && (obj.timed || otmp.timed))
        || (obj.otyp == CORPSE && otmp.corpsenm >= LOW_PM
            && is_reviver(mons[otmp.corpsenm])))
        return FALSE;

    /* allow candle merging only if their ages are close */
    /* see begin_burn() for a reference for the magic "25" */
    if (Is_candle(obj) && Math.trunc(obj.age / 25) != Math.trunc(otmp.age / 25))
        return FALSE;

    /* burning potions of oil never merge */
    if (obj.otyp == POT_OIL && obj.lamplit)
        return FALSE;

    /* don't merge surcharged item with base-cost item */
    if (obj.unpaid && !same_price(obj, otmp))
        return FALSE;

    /* some additional information is always incompatible */
    if (has_omonst(obj) || has_omid(obj)
        || has_omonst(otmp) || has_omid(otmp))
        return FALSE;

    /* if they have names, make sure they're the same */
    objnamelth = strlen(safe_oname(obj));
    otmpnamelth = strlen(safe_oname(otmp));
    if ((objnamelth != otmpnamelth
         && ((objnamelth && otmpnamelth) || obj.otyp == CORPSE))
        || (objnamelth && otmpnamelth
           /* verify pointers before deref for static analyzer */
            && has_oname(obj) && has_oname(otmp)
               && strncmp(ONAME(obj), ONAME(otmp), objnamelth)))
        return FALSE;

    /* if one has an attached mail command, other must have same command */
    if (!has_omailcmd(obj) ? has_omailcmd(otmp)
        : (!has_omailcmd(otmp) || strcmp(OMAILCMD(obj), OMAILCMD(otmp)) != 0))
        return FALSE;

    if (obj.otyp == SCR_MAIL
        /* wished or bones mail and hand written stamped scrolls
           each have two flavors; spe keeps them separate from each
           other but we want to keep their flavors separate too */
        && obj.spe > 0 && (obj.o_id % 2) != (otmp.o_id % 2))
        return FALSE;

    /* should be moot since matching artifacts wouldn't be unique */
    if (obj.oartifact != otmp.oartifact)
        return FALSE;

    if (obj.known != otmp.known && (Blind() || Hallucination()))
        return FALSE;

    return TRUE;
}

/* the #showgold command */
export function doprgold() { /* int */
    const $frame = stack_frame(); try {
    /* Command takes containers into account. */
    let umoney = money_cnt(gi.invent);

    /* Only list the money you know about.  Guards and shopkeepers
       can somehow tell if there is any gold anywhere on your
       person, but you have no such preternatural gold-sense. */
    let hmoney = hidden_gold(FALSE);

    if (flags.verbose) {
        let buf = stack_array(char, BUFSZ);

        if (!umoney) {
            strcpy(buf, _("Your wallet is empty"));
        } else {
            sprintf(buf, _("Your wallet contains %lld %s"), umoney, currency(umoney))
;
        }
        if (hmoney) {
            sprintf(eos(buf), _(", %s you have %lld %s stashed away in your pack"), umoney ? _("and") : _("but"), hmoney, umoney ? _("more") : currency(hmoney))

;
        }
        pline(_("%s."), buf);
    } else {
        let total = umoney + hmoney;
        if (total)
            You(_("are carrying a total of %lld %s."), total, currency(total));
        else
            You(_("have no money."));
    }
    shopper_financial_report();

    if (umoney && iflags.menu_requested) {
        let dollarsign = init_string(stack_array(char, sizeof_string("$")), _("$"));

        /* mustn't use TRUE or gold wouldn't show up unless it was quivered */
        dispinv_with_action(dollarsign, FALSE, 0);
    }

    return ECMD_OK;
    } finally { stack_pop($frame); }
}

/* the #seeweapon command */
export function doprwep() { /* int */
    const $frame = stack_frame(); try {
    if (!uwep) {
        You(_("are %s."), empty_handed());
    } else if (!iflags.menu_requested) {
        prinv(0, uwep, 0);
        if (u.twoweap)
            prinv(0, uswapwep, 0);
    } else {
        let lets = stack_array(char, 4); /* 4: uwep, uswapwep, uquiver, terminator */
        let ct = 0;

        /* obj_to_let() will assign letters to all of invent if necessary
           (for '!fixinv') so doesn't need to be repeated once called here */
        chars[lets + (ct++)] = obj_to_let(uwep);
        if (uswapwep)
            chars[lets + (ct++)] = uswapwep.invlet;
        if (uquiver)
            chars[lets + (ct++)] = uquiver.invlet;
        chars[lets + ct] = ord('\0');

        dispinv_with_action(lets, TRUE, 0);
    }
    return ECMD_OK;
    } finally { stack_pop($frame); }
}

/* caller is responsible for checking !wearing_armor() */
function noarmor(report_uskin) { /* void */
    const $frame = stack_frame(); try {
    if (!uskin || !report_uskin) {
        You(_("are not wearing any armor."));
    } else {
        let p, uskinname, buf = stack_array(char, BUFSZ);

        uskinname = strcpy(buf, simpleonames(uskin));
        /* shorten "set of <color> dragon scales" to "<color> scales"
           and "<color> dragon scale mail" to "<color> scale mail" */
        if (!strncmpi(uskinname, _("set of "), 7))
            uskinname += 7;
        if ((p = strstri(uskinname, _(" dragon "))) != 0)
            while ((chars[p + 1] = chars[p + 8]) != ord('\0'))
                ++p;

        You(_("are not wearing armor but have %s embedded in your skin."),
            uskinname);
    }
    } finally { stack_pop($frame); }
}

/* the #seearmor command */
export function doprarm() { /* int */
    const $frame = stack_frame(); try {
    /*
     * Note:  players sometimes get here by pressing a function key which
     * transmits ''ESC [ <something>'' rather than by pressing '[';
     * there's nothing we can--or should-do about that here.
     */

    if (!wearing_armor()) {
        noarmor(TRUE);
    } else {
        let lets = stack_array(char, 8); /* 8: up to 7 pieces of armor plus terminator */
        let ct = 0;

        /* obj_to_let() will assign letters to all of invent if necessary
           (for '!fixinv') so doesn't need to be repeated once called, but
           each armor slot doesn't know whether any that precede have made
           that call so just do it for each one; use SORTPACK_INUSE order */
        if (uarm)
            chars[lets + (ct++)] = obj_to_let(uarm);
        if (uarmc)
            chars[lets + (ct++)] = obj_to_let(uarmc);
        if (uarms)
            chars[lets + (ct++)] = obj_to_let(uarms);
        if (uarmh)
            chars[lets + (ct++)] = obj_to_let(uarmh);
        if (uarmg)
            chars[lets + (ct++)] = obj_to_let(uarmg);
        if (uarmf)
            chars[lets + (ct++)] = obj_to_let(uarmf);
        if (uarmu)
            chars[lets + (ct++)] = obj_to_let(uarmu);
        chars[lets + ct] = 0;

        dispinv_with_action(lets, TRUE, 0);
    }
    return ECMD_OK;
    } finally { stack_pop($frame); }
}

/* the #seerings command */
export function doprring() { /* int */
    const $frame = stack_frame(); try {
    if (!uleft && !uright) {
        You(_("are not wearing any rings."));
    } else {
        let lets = stack_array(char, 3); /* 3: uright, uleft, terminator */
        let use_inuse_mode = FALSE;
        let ct = 0;

        /* if either ring is a meat ring, switch to use_inuse_mode in order
           to label it/them as "Rings" rather than "Comestibles" */
        if (uright) {
            chars[lets + (ct++)] = obj_to_let(uright);
            if (uright.oclass != RING_CLASS)
                use_inuse_mode = TRUE;
        }
        if (uleft) {
            chars[lets + (ct++)] = obj_to_let(uleft);
            if (uleft.oclass != RING_CLASS)
                use_inuse_mode = TRUE;
        }
        chars[lets + ct] = ord('\0');
        /* also switch to use_inuse_mode if there are two rings or player
           used the 'm' prefix */
        if (ct > 1 || iflags.menu_requested)
            use_inuse_mode = TRUE;

        dispinv_with_action(lets, use_inuse_mode,
                                   /* note; alternate label will be ignored
                                      if 'use_inuse_mode' is False */
                                   (ct == 1) ? _("Ring") : _("Rings"));
    }
    return ECMD_OK;
    } finally { stack_pop($frame); }
}

/* the #seeamulet command */
export function dopramulet() { /* int */
    const $frame = stack_frame(); try {
    if (!uamul) {
        You(_("are not wearing an amulet."));
    } else {
        let lets = stack_array(char, 2);

        /* using display_inventory() instead of prinv() allows player
           to use 'm "' to force and menu and be able to choose amulet
           in order to perform a context-sensitive item action */
        chars[lets + 0] = obj_to_let(uamul), chars[lets + 1] = ord('\0');

        dispinv_with_action(lets, TRUE, _("Amulet"));
    }
    return ECMD_OK;
    } finally { stack_pop($frame); }
}

/* is 'obj' a tool that's in use?  can't simply check obj->owornmask */
function tool_being_used(obj) { /* boolean */
    /*
     * [Should this also include lit potions of oil?  They're not tools
     *  but they are "in use" without being noticeable via obj->owornmask.]
     */
    if ((obj.owornmask & (W_TOOL | W_SADDLE)) != 0)
        return TRUE;
    if (obj.oclass != TOOL_CLASS)
        return FALSE;
    /* [don't actually need to check uwep here; caller catches it] */
    return (obj == uwep || obj.lamplit
                      || (obj.otyp == LEASH && obj.corpsenm) ? 1 : 0);
}

/* the #seetools command */
export function doprtool() { /* int */
    const $frame = stack_frame(); try {
    let otmp;
    let ct = 0;
    let lets = stack_array(char, invlet_basic + 1);

    for (otmp = gi.invent; otmp; otmp = otmp.nobj)
        if (tool_being_used(otmp)) {
            /* we could be carrying more than 52 items; theoretically they
               might all be lit candles so avoid potential lets[] overflow */
            if (ct >= sizeof(array_of(char, invlet_basic + 1)) - 1)
                break;
            chars[lets + (ct++)] = obj_to_let(otmp);
        }
    chars[lets + ct] = ord('\0');
    if (!ct)
        You(_("are not using any tools."));
    else
        dispinv_with_action(lets, TRUE, 0);
    return ECMD_OK;
    } finally { stack_pop($frame); }
}

/* the #seeall command; combines the ')' + '[' + '=' + '"' + '(' commands;
   show inventory of all currently wielded, worn, or used objects */
export function doprinuse() { /* int */
    let otmp;
    let ct = 0;

    /* no longer need to collect letters; sortloot() takes care of it, but
       still want to count far enough to know whether anything is in use */
    for (otmp = gi.invent; otmp; otmp = otmp.nobj)
        if (is_inuse(otmp)) {
            ++ct;
            break;
        }
    if (!ct)
        You(_("are not wearing or wielding anything."));
    else
        dispinv_with_action(0, TRUE, 0);
    return ECMD_OK;
}

/*
 * uses up an object that's on the floor, charging for it as necessary
 */
export function useupf(obj, numused) { /* void */
    let otmp;
    let at_u = +(((obj.ox) == u.ux) && ((obj.oy) == u.uy));

    /* burn_floor_objects() keeps an object pointer that it tries to
     * useupf() multiple times, so obj must survive if plural */
    if (obj.quan > numused)
        otmp = splitobj(obj, numused);
    else
        otmp = obj;
    if (!svc.context.mon_moving && costly_spot(otmp.ox, otmp.oy)) {
        if (strchr(u.urooms, chars[in_rooms(otmp.ox, otmp.oy, 0)]))
            addtobill(otmp, FALSE, FALSE, FALSE);
        else
            stolen_value(otmp, otmp.ox, otmp.oy, FALSE, FALSE);
    }
    delobj(otmp);
    if (at_u && u.uundetected && hides_under(gy.youmonst.data))
        hideunder(gy.youmonst);
}

/*
 * Conversion from a class to a string for printing.
 * This must match the object class order.
 */
const names = static_array("names", ptr_to(char), null, [
    0, _("Illegal objects"), _("Weapons"), _("Armor"), _("Rings"), _("Amulets"), _("Tools"),
    _("Comestibles"), _("Potions"), _("Scrolls"), _("Spellbooks"), _("Wands"), _("Coins"),
    _("Gems/Stones"), _("Boulders/Statues"), _("Iron balls"), _("Chains"), _("Venoms")
]);
const oth_symbols = static_array("oth_symbols", char, null, [ CONTAINED_SYM, ord('\0') ]);
const oth_names = static_array("oth_names", ptr_to(char), null, [ _("Bagged/Boxed items") ]);

export function let_to_name(let_, unpaid, showsym) { /* char * */
    let ocsymfmt = _("  ('%c')");
    let invbuf_sympadding = 8; /* arbitrary */
    let class_name;
    let pos;
    let oclass = (let_ >= 1 && let_ < MAXOCLASSES) ? let_ : 0;
    let len;

    if (oclass)
        class_name = names[oclass];
    else if ((pos = strchr(oth_symbols, let_)) != 0)
        class_name = oth_names[pos - oth_symbols];
    else
        class_name = names[ILLOBJ_CLASS];

    len = unsigned(unsigned(Strlen(class_name) + (unpaid ? sizeof_string("unpaid_") : sizeof_string("")))
          + unsigned((oclass ? unsigned(Strlen(ocsymfmt) + unsigned(invbuf_sympadding)) : 0)));
    if (len > gi.invbufsiz) {
        if (gi.invbuf)
            free(gi.invbuf);
        gi.invbufsiz = unsigned(len + 10); /* add slop to reduce incremental realloc */
        gi.invbuf = addr_of(alloc(gi.invbufsiz));
    }
    if (unpaid)
        strcat(strcpy(gi.invbuf, _("Unpaid ")), class_name);
    else
        strcpy(gi.invbuf, class_name);
    if ((oclass != 0) && showsym) {
        let bp = eos(gi.invbuf);
        let mlen = int(unsigned(unsigned(invbuf_sympadding) - Strlen(class_name)));
        while (--mlen > 0) {
            chars[bp] = ord(' ');
            bp++;
        }
        chars[bp] = ord('\0');
        sprintf(eos(gi.invbuf), ocsymfmt, def_oc_syms[oclass].sym);
    }
    return gi.invbuf;
}

/* release the static buffer used by let_to_name() */
export function free_invbuf() { /* void */
    if (gi.invbuf)
        free(gi.invbuf), gi.invbuf = 0;
    gi.invbufsiz = 0;
}

/* give consecutive letters to every item in inventory (for !fixinv mode);
   gold is always forced to '$' slot at head of list */
export function reassign() { /* void */
    let i;
    let obj, prevobj, goldobj;

    /* first, remove [first instance of] gold from invent, if present */
    prevobj = goldobj = null;
    for (obj = gi.invent; obj; prevobj = obj, obj = obj.nobj)
        if (obj.oclass == COIN_CLASS) {
            goldobj = obj;
            if (prevobj)
                prevobj.nobj = goldobj.nobj;
            else
                gi.invent = goldobj.nobj;
            break;
        }
    /* second, re-letter the rest of the list */
    for (obj = gi.invent, i = 0; obj; obj = obj.nobj, i++)
        obj.invlet =
            (i < 26) ? (ord('a') + i) : (i < 52) ? (ord('A') + i - 26) : NOINVSYM;
    /* third, assign gold the "letter" '$' and re-insert it at head */
    if (goldobj) {
        goldobj.invlet = GOLD_SYM;
        goldobj.nobj = gi.invent;
        gi.invent = goldobj;
    }
    if (i >= 52)
        i = 52 - 1;
    gl.lastinvnr = i;
}

/* invent gold sanity check; used by doorganize() to control how getobj()
   deals with gold and also by wizard mode sanity_check() */
export function check_invent_gold(why) { /* boolean */ /* 'why' == caller in case of warning */
    let otmp;
    let goldstacks = 0, wrongslot = 0;

    /* there should be at most one stack of gold in invent, in slot '$' */
    for (otmp = gi.invent; otmp; otmp = otmp.nobj)
        if (otmp.oclass == COIN_CLASS) {
            ++goldstacks;
            if (otmp.invlet != GOLD_SYM)
                ++wrongslot;
        }

    if (goldstacks > 1 || wrongslot > 0) {
        impossible(_("%s: %s%s%s"), why,
                   (wrongslot > 1) ? _("gold in wrong slots")
                      : (wrongslot > 0) ? _("gold in wrong slot")
                           : _(""),
                   (wrongslot > 0 && goldstacks > 1) ? _(" and ") : _(""),
                   (goldstacks > 1) ? _("multiple gold stacks") : _(""));
        return TRUE; /* gold can be #adjusted */
    }

    return FALSE; /* gold can't be #adjusted */
}

/* normal getobj callback for item to #adjust; excludes gold */
function adjust_ok(obj) { /* int */
    if (!obj || obj.oclass == COIN_CLASS)
        return GETOBJ_EXCLUDE;

    return GETOBJ_SUGGEST;
}

/* getobj callback for item to #adjust if gold is wonky; allows gold */
function adjust_gold_ok(obj) { /* int */
    if (!obj)
        return GETOBJ_EXCLUDE;

    return GETOBJ_SUGGEST;
}

/* #adjust command
 *
 *      User specifies a 'from' slot for inventory stack to move,
 *      then a 'to' slot for its destination.  Open slots and those
 *      filled by compatible stacks are listed as likely candidates
 *      but user can pick any inventory letter (including 'from').
 *
 *  to == from, 'from' has a name
 *      All compatible items (same name or no name) are gathered
 *      into the 'from' stack.  No count is allowed.
 *  to == from, 'from' does not have a name
 *      All compatible items without a name are gathered into the
 *      'from' stack.  No count is allowed.  Compatible stacks with
 *      names are left as-is.
 *  to != from, no count
 *      Move 'from' to 'to'.  If 'to' is not empty, merge 'from'
 *      into it if possible, otherwise swap it with the 'from' slot.
 *  to != from, count given
 *      If the user specifies a count when choosing the 'from' slot,
 *      and that count is less than the full size of the stack,
 *      then the stack will be split.  The 'count' portion is moved
 *      to the destination, and the only candidate for merging with
 *      it is the stack already at the 'to' slot, if any.  When the
 *      destination is non-empty but won't merge, whatever is there
 *      will be moved to an open slot; if there isn't any open slot
 *      available, the adjustment attempt fails.
 *
 *      To minimize merging for 'from == to', unnamed stacks will
 *      merge with named 'from' but named ones won't merge with
 *      unnamed 'from'.  Otherwise attempting to collect all unnamed
 *      stacks would lump the first compatible named stack with them
 *      and give them its name.
 *
 *      To maximize merging for 'from != to', compatible stacks will
 *      merge when either lacks a name (or they already have the same
 *      name).  When no count is given and one stack has a name and
 *      the other doesn't, the merged result will have that name.
 *      However, when splitting results in a merger, the name of the
 *      destination overrides that of the source, even if destination
 *      is unnamed and source is named.
 *
 *      Gold is only a candidate to adjust if we've somehow managed
 *      to get multiple stacks and/or it is in a slot other than '$'.
 *      Specifying a count to split it into two stacks is not allowed.
 */
export function doorganize() { /* int */ /* inventory organizer by Del Lamb */
    let adjust_filter;
    let obj;

    /* when no invent, or just gold in '$' slot, there's nothing to adjust */
    if (!gi.invent || (gi.invent.oclass == COIN_CLASS
                      && gi.invent.invlet == GOLD_SYM && !gi.invent.nobj)) {
        You(_("aren't carrying anything %s."),
            !gi.invent ? _("to adjust") : _("adjustable"));
        return ECMD_OK;
    }

    if (!flags.invlet_constant)
        reassign();

    /* filter passed to getobj() depends upon gold sanity */
    adjust_filter = check_invent_gold(_("adjust")) ? adjust_gold_ok : adjust_ok;

    /* get object the user wants to organize (the 'from' slot) */
    obj = getobj(_("adjust"), adjust_filter, GETOBJ_PROMPT | GETOBJ_ALLOWCNT);

    return doorganize_core(obj);
}

/* alternate version of #adjust used by itemactions() for splitting */
export function adjust_split() { /* int */
    const $frame = stack_frame(); try {
    let obj;
    let splitamount = stack_var(cmdcount_nht, 0);
    let let_, dig = ord('\0');

    /* invlet should be queued so no getobj prompting is expected */
    obj = getobj(_("split"), adjust_ok, GETOBJ_NOFLAGS);
    if (!obj || obj.quan < 2 || obj.otyp == GOLD_PIECE)
        return ECMD_FAIL; /* caller has set things up to avoid this */

    if (obj.quan == 2) {
        splitamount[0] = 1;
    } else {
        /* get first digit; doesn't wait for <return> */
        dig = yn_function(_("Split off how many?"), 0, ord('\0'), TRUE);
        if (!digit(dig)) {
            pline1(Never_mind());
            return ECMD_CANCEL;
        }
        /* got first digit, get more until next non-digit (except for
           backspace/delete which will take away most recent digit and
           keep going; we expect one of ' ', '\n', or '\r') */
        let_ = get_count(0, dig, 0, splitamount,
                        /* yn_function() added the first digit to the
                           prompt when recording message history; have
                           get_count() display "Count: N" when waiting
                           for additional digits (ordinarily that won't be
                           shown until a second digit is entered) and also
                           add "Count: N" to message history if more than
                           one digit gets entered or the original N is
                           deleted and replaced with different digit */
                        GC_ECHOFIRST | GC_CONDHIST);
        /* \033 is in quitchars[] so we need to check for it separately
           in order to treat it as cancel rather than as accept */
        if (!let_ || let_ == ord('\x1b') || !strchr(quitchars, let_)) {
            pline1(Never_mind());
            return ECMD_CANCEL;
        }
    }
    if (splitamount[0] < 1 || splitamount[0] >= obj.quan) {
        let Amount = init_string(static_array("adjust_split.Amount", char, sizeof_string("Amount to split from current stack must be")), _("Amount to split from current stack must be"), true);

        if (splitamount[0] < 1)
            pline(_("%s at least 1."), Amount);
        else
            pline(_("%s less than %lld."), Amount, obj.quan);
        return ECMD_CANCEL;
    }

    /* normally a split would take place in getobj() if player supplies
       a count there, so doorganize_core() figures out 'splitamount'
       from the object; it will undo the split if player cancels while
       selecting the destination slot */
    obj = splitobj(obj, (splitamount[0]));
    return doorganize_core(obj);
    } finally { stack_pop($frame); }
}

function doorganize_core(obj$) { /* int */
    const $frame = stack_frame(); try {
    const obj = stack_var(ptr_to(struct_obj), obj$);
    let $goto = null; var otmp = stack_var(ptr_to(struct_obj)), splitting = stack_var(ptr_to(struct_obj)), lets = stack_array(char, 1 + invlet_basic + 1 + 1), qbuf = stack_array(char, QBUFSZ);
    var bumped;
    var ix, cur, trycnt;
    var let_;

     /* room for '$a-zA-Z#\0' */

    var objname, otmpname;
    var adj_type;
    var ever_mind = FALSE, collect, isgold;

    if (!obj[0])
        return ECMD_CANCEL;

    /* can only be gold if check_invent_gold() found a problem:  multiple '$'
       stacks and/or gold in some other slot, otherwise (*adjust_filter)()
       won't allow gold to be picked; if player has picked any stack of gold
       as #adjust 'from' slot, we'll force the 'to' slot to be '$' below */
    isgold = +(obj[0].oclass == COIN_CLASS);

    /* figure out whether user gave a split count to getobj() */
    splitting[0] = bumped = null;
    for (otmp[0] = gi.invent; otmp[0]; otmp[0] = otmp[0].nobj)
        if (otmp[0].nobj == obj[0]) { /* knowledge of splitobj() operation */
            if (otmp[0].invlet == obj[0].invlet)
                splitting[0] = otmp[0];
            break;
        }

    /* initialize the list with all lower and upper case letters */
    chars[lets + GOLD_INDX] = (obj[0].oclass == COIN_CLASS) ? GOLD_SYM : ord(' ');
    for (ix = GOLD_OFFSET, let_ = ord('a'); let_ <= ord('z');)
        chars[lets + (ix++)] = let_++;
    for (let_ = ord('A'); let_ <= ord('Z');)
        chars[lets + (ix++)] = let_++;
    chars[lets + OVRFLW_INDX] = ord(' ');
    chars[lets + (sizeof(array_of(char, 1 + invlet_basic + 1 + 1)) - 1)] = ord('\0');
    /* for floating inv letters, truncate list after the first open slot */
    if (!flags.invlet_constant && (ix = inv_cnt(FALSE)) < invlet_basic)
        chars[lets + (ix + (splitting[0] ? 1 : 2))] = ord('\0');

    /* blank out all the letters currently in use in the inventory
       except those that will be merged with the selected object */
    for (otmp[0] = gi.invent; otmp[0]; otmp[0] = otmp[0].nobj)
        if (otmp[0] != obj[0] && !mergable(otmp[0], obj[0])) {
            let_ = otmp[0].invlet;
            if (let_ >= ord('a') && let_ <= ord('z'))
                chars[lets + (GOLD_OFFSET + let_ - ord('a'))] = ord(' ');
            else if (let_ >= ord('A') && let_ <= ord('Z'))
                chars[lets + (GOLD_OFFSET + let_ - ord('A') + 26)] = ord(' ');
            /* overflow defaults to off, but it we find a stack using that
               slot, switch to on -- the opposite of normal invlet handling */
            else if (let_ == NOINVSYM)
                chars[lets + OVRFLW_INDX] = NOINVSYM;
        }

    /* compact the list by removing all the blanks */
    for (ix = cur = 0; chars[lets + ix]; ix++)
        if (chars[lets + ix] != ord(' ') && cur++ < ix)
            chars[lets + (cur - 1)] = chars[lets + ix];
    chars[lets + cur] = ord('\0');
    /* and by dashing runs of letters */
    if (cur > 5)
        compactify(lets);

    /* get 'to' slot to use as destination */
    if (!splitting[0])
        strcpy(qbuf, _("Adjust letter"));
    else /* note: splitting->quan is the amount being left in original slot */
        sprintf(qbuf, _("Split %lld"), obj[0].quan);
    sprintf(eos(qbuf), _(" to what [%s]%s?"), lets, gi.invent ? _(" (? see used letters)") : _(""))
;
    $out_noadjust: for (trycnt = 1; ; ++trycnt) {
        let_ = !isgold ? yn_function(qbuf, 0, ord('\0'), TRUE) : GOLD_SYM;
        $goto_noadjust: for (;;) { switch ($goto) { default: if (let_ == ord('?') || let_ == ord('*')) {
            let_ = display_used_invlets(splitting[0] ? obj[0].invlet : 0);
            if (!let_)
                continue $out_noadjust;
            if (let_ == ord('\x1b'))
                { $goto = "noadjust"; continue $goto_noadjust; };
        }
        case "noadjust": if ($goto || (strchr(quitchars, let_)
            /* adjusting to same slot is meaningful since all
               compatible stacks get collected along the way,
               but splitting to same slot is not */
            || (splitting[0] && let_ == obj[0].invlet))) {
 $goto = null;
            if (splitting[0])
                merged(splitting, obj);
            if (!ever_mind)
                pline1(Never_mind());
            return ECMD_OK;
        } else if (let_ == GOLD_SYM && obj[0].oclass != COIN_CLASS) {
            pline(_("Only gold coins may be moved into the '%c' slot."),
                  GOLD_SYM);
            ever_mind = TRUE;
            { $goto = "noadjust"; continue $goto_noadjust; }
        }
        /* letter() classifies '@' as one; compactify() can put '-' in lets;
           the only thing of interest that strchr() might find is '$' or '#'
           since letter() catches everything else that we put into lets[] */
        if ((letter(let_) && let_ != ord('@')) || (strchr(lets, let_) && let_ != ord('-')))
            break $out_noadjust; /* got one */
        if (trycnt == 5)
            { $goto = "noadjust"; continue $goto_noadjust; }; } break; }
        pline(_("Select an inventory slot letter.")); /* else try again */
    }

    collect = +(let_ == obj[0].invlet);
    /* change the inventory and print the resulting item */
    adj_type = collect ? _("Collecting:")
               : !splitting[0] ? _("Moving:")
                 : _("Splitting:");

    /*
     * don't use freeinv/addinv to avoid double-touching artifacts,
     * dousing lamps, losing luck, cursing loadstone, etc.
     */
    extract_nobj(obj[0], ref_of(gi, "invent"));

    for (otmp[0] = gi.invent; otmp[0]; ) {
        otmpname = has_oname(otmp[0]) ? ONAME(otmp[0]) : 0;
        /* it's tempting to pull this outside the loop, but merged() could
           free ONAME(obj) [via obfree()] and replace it with ONAME(otmp) */
        objname = has_oname(obj[0]) ? ONAME(obj[0]) : 0;

        if (collect) {
            /* Collecting: #adjust an inventory stack into its same slot;
               keep it there and merge other compatible stacks into it.
               Traditional inventory behavior is to merge unnamed stacks
               with compatible named ones; we only want that if it is
               the 'from' stack (obj) with a name and candidate (otmp)
               without one, not unnamed 'from' with named candidate. */
            if ((!otmpname || (objname && !strcmp(objname, otmpname)))
                && merged(otmp, obj)) {
                /*adj_type = "Collecting:"; //already set to this*/
                obj[0] = otmp[0];
                otmp[0] = otmp[0].nobj;
                extract_nobj(obj[0], ref_of(gi, "invent"));
                continue; /* otmp has already been updated */
            }
        } else if (otmp[0].invlet == let_) {
            /* Merging: when from and to are compatible */
            if ((!otmpname || (objname && !strcmp(objname, otmpname)))
                && merged(otmp, obj)) {
                adj_type = _("Merging:");
                obj[0] = otmp[0];
                otmp[0] = otmp[0].nobj;
                extract_nobj(obj[0], ref_of(gi, "invent"));
                break; /* otmp has been updated and we're done merging */
            }
            /* Moving or splitting: don't merge extra compatible stacks.
               Found 'otmp' in destination slot; merge if compatible,
               otherwise bump whatever is there to an open slot. */
            if (!splitting[0]) {
                adj_type = _("Swapping:");
                otmp[0].invlet = obj[0].invlet;
            } else {
                /* strip 'from' name if it has one */
                if (objname && !obj[0].oartifact)
                    ((obj[0]).oextra.oname) = 0;
                if (!mergable(otmp[0], obj[0])) {
                    /* won't merge; put 'from' name back */
                    if (objname)
                        ((obj[0]).oextra.oname) = objname;
                } else {
                    /* will merge; discard 'from' name */
                    if (objname)
                        free(objname), objname = 0;
                }

                if (merged(otmp, obj)) {
                    adj_type = _("Splitting and merging:");
                    obj[0] = otmp[0];
                    extract_nobj(obj[0], ref_of(gi, "invent"));
                } else if (inv_cnt(FALSE) >= invlet_basic) {
                    merged(splitting, obj); /* undo split */
                    /* "knapsack cannot accommodate any more items" */
                    Your(_("pack is too full."));
                    return ECMD_OK;
                } else {
                    bumped = otmp[0];
                    extract_nobj(bumped, ref_of(gi, "invent"));
                }
            } /* moving vs splitting */
            break; /* not collecting and found 'to' slot */
        } /* collect */
        otmp[0] = otmp[0].nobj;
    }

    /* inline addinv; insert loose object at beginning of inventory */
    obj[0].invlet = let_;
    obj[0].nobj = gi.invent;
    obj[0].where = OBJ_INVENT;
    gi.invent = obj[0];
    reorder_invent();
    if (bumped) {
        /* splitting the 'from' stack is causing an incompatible
           stack in the 'to' slot to be moved into an open one;
           we need to do another inline insertion to inventory */
        assigninvlet(bumped);
        bumped.nobj = gi.invent;
        bumped.where = OBJ_INVENT;
        gi.invent = bumped;
        reorder_invent();
    }

    /* messages deferred until inventory has been fully reestablished */
    prinv(adj_type, obj[0], 0);
    if (bumped)
        prinv(_("Moving:"), bumped, 0);
    if (splitting[0])
        clear_splitobjs(); /* reset splitobj context */
    update_inventory();
    return ECMD_OK;
    } finally { stack_pop($frame); }
}
export const GOLD_INDX = 0;
export const GOLD_OFFSET = 1;
export const OVRFLW_INDX = (GOLD_OFFSET + invlet_basic);

/* common to display_minventory and display_cinventory */
function invdisp_nothing(hdr, txt) { /* void */
    const $frame = stack_frame(); try {
    let win;
    let selected = stack_var(ptr_to(struct_mi));

    win = create_nhwindow()(NHW_MENU);
    start_menu()(win, MENU_BEHAVE_STANDARD);
    add_menu_heading(win, hdr);
    add_menu_str(win, _(""));
    add_menu_str(win, txt);
    end_menu()(win, 0);
    if (select_menu(win, PICK_NONE, selected) > 0)
        free(addr_of(selected[0]));
    destroy_nhwindow()(win);
    return;
    } finally { stack_pop($frame); }
}

/* query_objlist callback: return things that are worn or wielded */
function worn_wield_only(obj) { /* boolean */
    /* check for things that *are* worn or wielded (only used for monsters,
       so we don't worry about excluding W_CHAIN, W_ARTI and the like) */
    return (+(obj.owornmask != 0));
/* #else (#if 1): not in this build */
}

/*
 * Display a monster's inventory.
 * Returns a pointer to the object from the monster's inventory selected
 * or NULL if nothing was selected.
 *
 * By default, only worn and wielded items are displayed.  The caller
 * can pick one.  Modifier flags are:
 *
 *      PICK_NONE, PICK_ONE - standard menu control
 *      PICK_ANY            - allowed, but we only return a single object
 *      MINV_NOLET          - nothing selectable
 *      MINV_ALL            - display all inventory
 */
export function display_minventory(
    mon,
    dflags,
    title) { /* struct obj * */ /* menu title */
    const $frame = stack_frame(); try {
    let ret;
    let tmp = stack_array(char, QBUFSZ);
    let n;
    let selected = stack_var(ptr_to(struct_mi), null);
    let do_all = +((dflags & MINV_ALL) != 0),
        incl_hero = (do_all && engulfing_u(mon) ? 1 : 0),
        have_inv = +(mon.minvent != null),
        have_any = (have_inv || incl_hero ? 1 : 0),
        pickings = (dflags & MINV_PICKMASK);

    sprintf(tmp, _("%s %s:"), s_suffix(noit_Monnam(mon)), do_all ? _("possessions") : _("armament"))
;

    if (do_all ? have_any : (mon.misc_worn_check || MON_WEP(mon))) {
        /* Fool the 'weapon in hand' routine into
         * displaying 'weapon in claw', etc. properly.
         */
        gy.youmonst.data = mon.data;
        /* in case inside a shop, don't append "for sale" prices */
        iflags.suppress_price++;

        n = query_objlist(title ? title : tmp, ref_of(mon, "minvent"),
                          (INVORDER_SORT | (incl_hero ? INCLUDE_HERO : 0)),
                          selected, pickings,
                          do_all ? allow_all : worn_wield_only);

        iflags.suppress_price--;
        /* was 'set_uasmon();' but that potentially has side-effects */
        gy.youmonst.data = mons[u.umonnum]; /* basic part of set_uasmon() */
    } else {
        invdisp_nothing(title ? title : tmp, _("(none)"));
        n = 0;
    }

    if (n > 0) {
        ret = ptr_add(selected[0], 0).item.a_obj;
        free(addr_of(selected[0]));
    } else
        ret = null;
    return ret;
    } finally { stack_pop($frame); }
}

/* format a container name for cinventory_display(), inserting "trapped"
   if that's appropriate */
function cinv_doname(obj) { /* char * */
    let result = doname(obj);

    /*
     * If obj->tknown ever gets implemented, doname() will handle this.
     * Assumes that probing reveals the trap prior to calling us.  Since
     * we lack that flag, hero forgets about it as soon as we're done....
     */

    /* 'result' is an obuf[] but might point into the middle (&buf[PREFIX])
       rather than the beginning and we don't have access to that;
       assume that there is at least QBUFSZ available when reusing it */
    if (obj.otrapped && unsigned(strlen(result) + sizeof_string("trapped ")) <= QBUFSZ) {
        /* obj->lknown has been set before calling us so either "locked" or
           "unlocked" should always be present (for a trapped container) */
        let p = strstri(result, _(" locked")),
             q = strstri(result, _(" unlocked"));

        if (p && (!q || p < q))
            strsubst(p, _(" locked "), _(" trapped locked "));
        else if (q)
            strsubst(q, _(" unlocked "), _(" trapped unlocked "));
        /* might need to change "an" to "a"; when no BUC is present,
           "an unlocked" yielded "an trapped unlocked" above */
        strsubst(result, _("an trapped "), _("a trapped "));
    }
    return result;
}

/* used by safe_qbuf() if the full doname() result is too long */
function cinv_ansimpleoname(obj) { /* char * */
    let result = ansimpleoname(obj);

    /* result is an obuf[] so we know this will always fit */
    if (obj.otrapped) {
        if (strncmp(result, _("a "), 2))
            strsubst(result, _("a "), _("a trapped "));
        else if (strncmp(result, _("an "), 3))
            strsubst(result, _("an "), _("an trapped "));
        /* unique container? nethack doesn't have any */
        else if (strncmp(result, _("the "), 4))
            strsubst(result, _("the "), _("the trapped "));
        /* no leading article at all? shouldn't happen with ansimpleoname() */
        else
            strsubst(result, _(""), _("trapped ")); /* insert at beginning */
    }
    return result;
}

/* Display the contents of a container in inventory style.
   Used for wand of probing of non-empty containers and statues. */
export function display_cinventory(obj) { /* struct obj * */
    const $frame = stack_frame(); try {
    let ret;
    let qbuf = stack_array(char, QBUFSZ);
    let n;
    let selected = stack_var(ptr_to(struct_mi), null);

    safe_qbuf(qbuf, _("Contents of "), _(":"), obj,
                     /* custom formatting routines to insert "trapped"
                        into the object's name when appropriate;
                        last resort "that" won't ever get used */
                     cinv_doname, cinv_ansimpleoname, _("that"));

    if (obj.cobj) {
        n = query_objlist(qbuf, ref_of(obj, "cobj"), INVORDER_SORT,
                          selected, PICK_NONE, allow_all);
    } else {
        invdisp_nothing(qbuf, _("(empty)"));
        n = 0;
    }
    if (n > 0) {
        ret = ptr_add(selected[0], 0).item.a_obj;
        free(addr_of(selected[0]));
    } else
        ret = null;
    obj.cknown = 1;
    return ret;
    } finally { stack_pop($frame); }
}

function only_here(obj) { /* boolean */
    return +(obj.ox == go.only.x && obj.oy == go.only.y);
}

/*
 * Display a list of buried or underwater items in inventory style.
 * Return a non-zero value if there were items at that spot.
 *
 * Currently, this is only used with a wand of probing zapped downwards.
 */
export function display_binventory(x, y, as_if_seen) { /* int */
    const $frame = stack_frame(); try {
    let obj;
    let qbuf = stack_array(char, QBUFSZ);
    let underwhat = _("here");
    let selected = stack_var(ptr_to(struct_mi), null);
    let n, n2 = 0;

    /* if hero is levitating or flying over water or lava, list any items
       below (the map won't be showing them); if hero is underwater, player
       should use the normal look_here command instead of probing (caller
       has already used bhitpile() which will have set dknown on all items) */
    if (is_pool_or_lava(x, y) && !Underwater()
        && (obj = svl.level.objects[x][y]) != null) {
        let real_liquid = is_pool(x, y) ? _("water") : _("lava"),
                   seen_liquid = hliquid(real_liquid);

        if (!obj.v.v_nexthere) {
            let more_than_1 = is_plural(obj);

            There(_("%s %s under the %s here."), more_than_1 ? _("are") : _("is"),
                  doname(obj), seen_liquid);
            n2 = 1;
            /* "pair of boots" is singular but "beneath it" sounds strange */
            if (pair_of(obj))
                more_than_1 = TRUE;
            underwhat = more_than_1 ? _("under them") : _("beneath it");
        } else {
            sprintf(qbuf, _("Things that are under the %s here:"), seen_liquid);
            if (query_objlist(qbuf, svl.level.objects[x].subarray(y), BY_NEXTHERE,
                              selected, PICK_NONE, allow_all) > 0)
                free(addr_of(selected[0])), selected[0] = null;
            for (n2 = 0; obj; obj = obj.v.v_nexthere)
                ++n2;
            underwhat = _("beneath them");
        }
    }

    /* count # of buried objects here */
    for (n = 0, obj = svl.level.buriedobjlist; obj; obj = obj.nobj)
        if (obj.ox == x && obj.oy == y) {
            if (as_if_seen)
                observe_object(obj);
            n++;
        }

    if (n) {
        go.only.x = x;
        go.only.y = y;
        /* "buried here", but vary if we've already shown underwater items */
        sprintf(qbuf, _("Things that are buried %s:"), underwhat);
        if (query_objlist(qbuf, ref_of(svl.level, "buriedobjlist"), INVORDER_SORT,
                          selected, PICK_NONE, only_here) > 0)
            free(addr_of(selected[0]));
        go.only.x = go.only.y = 0;
    }
    return n + n2;
    } finally { stack_pop($frame); }
}

export function prepare_perminvent(window) { /* void */
    let wri;
    let invmode = iflags.perminv_mode;

    if (perminv_flags[0] != invmode) {
        struct_assign(wri_info, zerowri);
        wri_info.fromcore.invmode = unsigned(invmode);
        /*  relay the mode settings to the window port */
        wri = ctrl_nhwindow()(window, set_mode, wri_info);
        perminv_flags[0] = invmode;
        (wri);
    }
}

export function sync_perminvent() { /* void */
    let wri = static_var("sync_perminvent.wri", ptr_to(struct_win_request_info_t), null);
    let wport_id;

    if (WIN_INVEN == WIN_ERR) {
        if ((gc.core_invent_state
             || (wri_info.tocore.tocore_flags & prohibited))
            && !(in_perm_invent_toggled[0]
                 && gp.perm_invent_toggling_direction == toggling_on))
            return;
    }
    prepare_perminvent(WIN_INVEN);

    if ((!iflags.perm_invent && gc.core_invent_state)) {
        /* Odd - but this could be end-of-game disclosure
         * which just sets boolean iflags.perm_invent to
         * FALSE without actually doing anything else.
         */

        docrt();
        return;
    }

    /*
     * The following conditions can bring us to here:
     * 1. iflags.perm_invent is on
     *      AND
     *    gc.core_invent_state is still zero.
     * OR
     * 2. iflags.perm_invent is off, but we're in the
     *    midst of toggling it on.
     * OR
     * 3. iflags.perminv_mode has been changed via 'm O'.
     */

    if ((iflags.perm_invent && !gc.core_invent_state)
        || (!iflags.perm_invent
            && (in_perm_invent_toggled[0]
                && gp.perm_invent_toggling_direction == toggling_on))) {
        /* Send windowport a request to return the related settings to us */
        if ((iflags.perm_invent && !gc.core_invent_state)
            || in_perm_invent_toggled[0]) {
            wri[0] = ctrl_nhwindow()(WIN_INVEN, request_settings, wri_info);
            if (wri[0] != null) {
                if ((wri[0].tocore.tocore_flags & too_early) != 0) {
                    /* don't be too noisy about this as it's really
                     * a startup timing issue. Just set a marker. */
                    iflags.perm_invent_pending = TRUE;
                    return;
                }
                if ((wri[0].tocore.tocore_flags & (too_small | prohibited))
                    != 0) {
                    /* sizes aren't good enough */
                    if ((wri[0].tocore.tocore_flags & prohibited) != 0) {
                        set_option_mod_status(_("perm_invent"), set_gameview);
                        set_option_mod_status(_("perminv_mode"), set_gameview);
                    }
                    iflags.perm_invent = FALSE;
                    if (WIN_INVEN != WIN_ERR)
                        destroy_nhwindow()(WIN_INVEN), WIN_INVEN = WIN_ERR;
                    wport_id = (windowprocs.wp_id == wp_tty) ? _("tty perm_invent")
                                               : _("perm_invent");
                    pline(_("%s could not be enabled."), wport_id);
                    pline(_("%s needs a terminal that is at least %dx%d, yours " +
                          "is %dx%d."),
                          wport_id, wri[0].tocore.needrows,
                          wri[0].tocore.needcols, wri[0].tocore.haverows,
                          wri[0].tocore.havecols);
                    wait_synch()();
                    return;
                }
            }
            gc.core_invent_state++;
        }
    }

    if (!wri[0] || wri[0].tocore.maxslot == 0)
        return;

    if (in_perm_invent_toggled[0]
        && gp.perm_invent_toggling_direction == toggling_on) {
        WIN_INVEN = create_nhwindow()(NHW_MENU);
    }

    if (WIN_INVEN != WIN_ERR && program_state.beyond_savefile_load) {
        gi.in_sync_perminvent = 1;
        display_inventory(0, FALSE);
        gi.in_sync_perminvent = 0;
    }
}

export function perm_invent_toggled(negated) { /* void */
    in_perm_invent_toggled[0] = TRUE;
    if (negated) {
        gp.perm_invent_toggling_direction = toggling_off;
        if (WIN_INVEN != WIN_ERR)
            destroy_nhwindow()(WIN_INVEN), WIN_INVEN = WIN_ERR;
        gc.core_invent_state = 0;
    } else {
        gp.perm_invent_toggling_direction = toggling_on;
        if (iflags.perminv_mode == InvOptNone)
            iflags.perminv_mode = InvOptOn; /* all inventory except gold */
        sync_perminvent();
    }
    gp.perm_invent_toggling_direction = toggling_not;
    in_perm_invent_toggled[0] = FALSE;
}

/*invent.c*/

import { AM_SANCTUM, AM_SHRINE } from "./align.h.js";
import { Amask2align } from "./align.h.macros.js";
import { ART_MJOLLNIR } from "./artilist.h.js";
import { A_CHA, A_CON, A_DEX, A_INT, A_WIS } from "./attrib.h.js";
import { ACURR } from "./attrib.h.macros.js";
import { NO_COLOR } from "./color.h.js";
import { Never_mind, silly_thing_to, thats_enough_tries } from "./decl.h.macros.js";
import {
    AMULET_CLASS, ARMOR_CLASS, BALL_CLASS, CHAIN_CLASS, COIN_CLASS, FOOD_CLASS, GEM_CLASS, GOLD_SYM,
    ILLOBJ_CLASS, MAXOCLASSES, POTION_CLASS, RING_CLASS, ROCK_CLASS, SCROLL_CLASS, SPBOOK_CLASS,
    S_fountain, S_grave, S_lava, S_ndoor, S_sink, S_throne, S_tree, S_vcdbridge, S_vcdoor,
    S_vodbridge, S_vodoor, TOOL_CLASS, VENOM_CLASS, WAND_CLASS, WEAPON_CLASS,
} from "./defsym.h.js";
import { obj_to_glyph } from "./display.h.macros.js";
import { Is_airlevel, Is_waterlevel } from "./dungeon.h.macros.js";
import { PLNMSG_ONE_ITEM_HERE } from "./flag.h.js";
import { wizard } from "./flag.h.macros.js";
import {
    BUFSZ, FALSE, LARGEST_INT, LL_CONDUCT, QBUFSZ, TRUE, boolean, coordxy, set_gameview,
} from "./global.h.js";
import { Strlen, strcmpi } from "./global.h.macros.js";
import {
    ALL_FINISHED, BILLED_TYPES, BUC_BLESSED, BUC_CURSED, BUC_UNCURSED, BUC_UNKNOWN, BY_NEXTHERE,
    CMDQ_INT, CMDQ_KEY, CMDQ_USER_INPUT, CONTAINED_SYM, COST_NOCONTENTS, CQ_CANNED, CQ_REPEAT,
    CXN_ARTICLE, CXN_PFX_THE, ECMD_CANCEL, ECMD_FAIL, ECMD_OK, ECMD_TIME, FINGERTIP, GC_CONDHIST,
    GC_ECHOFIRST, GC_SAVEHIST, GETOBJ_ALLOWCNT, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE,
    GETOBJ_EXCLUDE_INACCESS, GETOBJ_EXCLUDE_NONINVENT, GETOBJ_EXCLUDE_SELECTABLE, GETOBJ_NOFLAGS,
    GETOBJ_PROMPT, GETOBJ_SUGGEST, HAND, HANDS_SYM, INCLUDE_HERO, INCLUDE_VENOM, INVORDER_SORT,
    JUSTPICKED, LOOKHERE_NOFLAGS, LOOKHERE_PICKED_SOME, LOOKHERE_SKIP_DFEATURE, MENU_FULL,
    MENU_PARTIAL, MENU_TRADITIONAL, MSGTYP_MASK_REP_SHOW, NOINVSYM, ONAME_SKIP_INVUPD,
    SIGNAL_ESCAPE, SIGNAL_NOMENU, SORTLOOT_INUSE, SORTLOOT_INVLET, SORTLOOT_LOOT, SORTLOOT_PACK,
    SORTLOOT_PETRIFY, STOMACH, UNPAID_TYPES, USE_INVLET, cmdcount_nht, invlet_basic, st_all,
    struct__cmd_queue, struct_sortloot_item,
} from "./hack.h.js";
import { ROLL_FROM, makeknown, pline1, plur, qsort, y_n } from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { hides_under, is_reviver, touch_petrifies } from "./mondata.h.macros.js";
import { MINV_ALL, MINV_PICKMASK } from "./monst.h.js";
import { MON_WEP, engulfing_u } from "./monst.h.macros.js";
import { LOW_PM, NON_PM, PM_ARCHEOLOGIST, PM_CLERIC } from "./monsters.h.js";
import {
    LOST_EXPLODING, LOST_NONE, LOST_THROWN, OBJ_CONTAINED, OBJ_FLOOR, OBJ_FREE, OBJ_INVENT,
    struct_obj,
} from "./obj.h.js";
import {
    Has_contents, Is_candle, Is_container, Is_pudding, OMAILCMD, ONAME, ammo_and_launcher, carried,
    greatest_erosion, has_omailcmd, has_omid, has_omonst, has_oname, is_ammo, is_gloves,
    is_mines_prize, is_missile, is_plural, is_pole, is_soko_prize, is_wet_towel, pair_of,
} from "./obj.h.macros.js";
import {
    ARM_BOOTS, ARM_CLOAK, ARM_GLOVES, ARM_HELM, ARM_SHIELD, ARM_SHIRT, ARM_SUIT, GEMSTONE, GLASS,
} from "./objclass.h.js";
import { OBJ_DESCR } from "./objclass.h.macros.js";
import {
    AKLYS, AMULET_OF_YENDOR, BAG_OF_TRICKS, BELL_OF_OPENING, BUGLE, CANDELABRUM_OF_INVOCATION,
    CORPSE, CRYSKNIFE, DRUM_OF_EARTHQUAKE, EGG, FAKE_AMULET_OF_YENDOR, FIGURINE, FIRE_HORN,
    FROST_HORN, GOLD_PIECE, HORN_OF_PLENTY, LEASH, LEATHER_DRUM, LOADSTONE, MAGIC_FLUTE, MAGIC_HARP,
    POT_OIL, POT_WATER, ROCK, SCR_BLANK_PAPER, SCR_MAIL, SCR_SCARE_MONSTER, SLIME_MOLD,
    SPE_BOOK_OF_THE_DEAD, SPE_NOVEL, STATUE, TIN, TOOLED_HORN, TOWEL, WOODEN_FLUTE, WOODEN_HARP,
} from "./objects.h.js";
import {
    LEFT_RING, RIGHT_RING, WORN_AMUL, WORN_ARMOR, WORN_BLINDF, WORN_BOOTS, WORN_CLOAK, WORN_GLOVES,
    WORN_HELMET, WORN_SHIELD, WORN_SHIRT, W_ACCESSORY, W_ARMOR, W_ART, W_QUIVER, W_SADDLE,
    W_SWAPWEP, W_TOOL, W_WEAPONS, W_WEP,
} from "./prop.h.js";
import {
    DBWALL, DRAWBRIDGE_DOWN, D_BROKEN, D_ISOPEN, D_NODOOR, ICE, IRONBARS, TREE,
} from "./rm.h.js";
import {
    IS_ALTAR, IS_DOOR, IS_FOUNTAIN, IS_GRAVE, IS_SINK, IS_THRONE, SURFACE_AT, fobj, levl,
} from "./rm.h.macros.js";
import { P_BOW, P_CROSSBOW, P_DAGGER, P_KNIFE, P_SPEAR } from "./skills.h.js";
import { FIG_TRANSFORM } from "./timeout.h.js";
import { is_pit } from "./trap.h.macros.js";
import { WC_PERM_INVENT, wp_tty } from "./winprocs.h.js";
import {
    clear_nhwindow, create_nhwindow, ctrl_nhwindow, destroy_nhwindow, display_nhwindow, end_menu,
    message_menu, putmsghistory, putstr, start_menu, wait_synch,
} from "./winprocs.h.macros.js";
import {
    ATR_NONE, InvInUse, InvOptNone, InvOptOn, InvShowGold, MENU_BEHAVE_PERMINV,
    MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, MENU_ITEMFLAGS_SKIPINVERT, NHW_MENU, PICK_ANY,
    PICK_NONE, PICK_ONE, WIN_ERR, prohibited, request_settings, set_mode, struct_any,
    struct_glyphinfo, struct_mi, struct_win_request_info_t, toggling_not, toggling_off, toggling_on,
    too_early, too_small,
} from "./wintype.h.js";
import { ACH_AMUL, ACH_BELL, ACH_BOOK, ACH_CNDL, ACH_MINE_PRIZE, ACH_SOKO_PRIZE } from "./you.h.js";
import { Role_if, ULEFTY, URIGHTY, Upolyd } from "./you.h.macros.js";
import {
    Blind, Fumbling, Hallucination, Stone_resistance, Underwater,
} from "./youprop.h.macros.js";
import {
    char, int, long, ord, schar, sizeof, sizeof_string, ulong, unsigned,
} from "../rt/ctypes.js";
import { global_ref } from "../rt/globals.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { not64, or64 } from "../rt/int64.js";
import {
    assert, free, sprintf, strcat, strchr, strcmp, strcpy, strlen, strncmp, strstr,
} from "../rt/libc.js";
import {
    init_list, init_string, stack_array, stack_struct, stack_var, static_array, static_struct,
    static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, ptr_add, ptr_to, ref_of, struct, struct_assign, view_of,
} from "../rt/struct.js";
import { alloc, dupstr } from "./alloc.js";
import {
    confers_luck, discover_artifact, set_artifact_intrinsic, touch_artifact,
} from "./artifact.js";
import { set_moreluck } from "./attrib.js";
import { get_strength_str } from "./botl.js";
import {
    cmdq_add_int, cmdq_add_key, cmdq_clear, cmdq_pop, get_count, readchar, yn_function,
} from "./cmd.js";
import { is_drawbridge_wall, is_ice, is_lava, is_pool, is_pool_or_lava } from "./dbridge.js";
import {
    cg, disp, flags, gc, gd, gi, gl, go, gp, gs, gt, gy, hands_obj, iflags, program_state,
    quitchars, svc, svl, u, ynNaqchars, ynaqchars,
} from "./decl.js";
import { docrt, map_glyphinfo, newsym, nul_glyphinfo, suppress_map_output } from "./display.js";
import { dropx, dropy } from "./do.js";
import { hliquid, mon_nam, noit_Monnam, oname, safe_oname } from "./do_name.js";
import { fingers_or_gloves } from "./do_wear.js";
import { hitfloor, throwing_weapon } from "./dothrow.js";
import { def_char_to_objclass, def_oc_syms, defsyms } from "./drawing.js";
import { surface } from "./dungeon.js";
import { panic } from "./end.js";
import { can_reach_floor, read_engr_at } from "./engrave.js";
import { in_rooms, inv_cnt, money_cnt, near_capacity, obj_to_any } from "./hack.js";
import {
    digit, eos, highc, ing_suffix, letter, mungspaces, s_suffix, strkitten, strncmpi, strstri,
    strsubst, visctrl,
} from "./hacklib.js";
import { itemactions } from "./iactions.js";
import { align_str, record_achievement } from "./insight.js";
import { obj_merge_light_sources } from "./light.js";
import {
    clear_splitobjs, curse, extract_nobj, obj_absorb, obj_extract_self, place_object,
    pudding_merge_message, splitobj, unknwn_contnr_contents, unsplitobj, weight,
} from "./mkobj.js";
import { dead_species, hideunder, maybe_unhide_at } from "./mon.js";
import { poly_when_stoned } from "./mondata.js";
import { mons } from "./monst.js";
import { observe_object } from "./o_init.js";
import { objects } from "./objects.js";
import {
    an, ansimpleoname, corpse_xname, cxname_singular, distant_name, doname, doname_with_price,
    erosion_matters, killer_xname, makeplural, maybereleaseobuf, not_fully_identified, safe_qbuf,
    simpleonames, vtense, xname, yname,
} from "./objnam.js";
import { hide_unhide_msgtypes, set_option_mod_status } from "./options.js";
import { ice_descr } from "./pager.js";
import {
    add_valid_menu_class, allow_all, allow_category, collect_obj_classes, container_gone,
    count_justpicked, encumber_msg, force_decor, menu_class_present, query_category, query_objlist,
    reset_justpicked, u_safe_from_fatal_corpse,
} from "./pickup.js";
import { There, You, Your, impossible, livelog_printf, pline, pline_The } from "./pline.js";
import { body_part, mbodypart } from "./polyself.js";
import { a_gname } from "./pray.js";
import { artitouch } from "./quest.js";
import { is_quest_artifact } from "./questpgr.js";
import { unpunish } from "./read.js";
import { reg_damg, visible_region_at } from "./region.js";
import { rn2, rn2_on_display_rng } from "./rnd.js";
import {
    addtobill, check_unpaid, costly_spot, doinvbill, inhishop, inside_shop, obfree,
    picked_container, same_price, shop_keeper, shopper_financial_report, stolen_value, unpaid_cost,
} from "./shk.js";
import { stairs_description, stairway_at } from "./stairs.js";
import {
    attach_fig_transform_timeout, learn_egg_type, obj_stop_timers, stop_timer,
} from "./timeout.js";
import { instapetrify, t_at, trapname } from "./trap.js";
import { hidden_gold } from "./vault.js";
import { empty_handed, setuqwep, welded } from "./wield.js";
import {
    add_menu, add_menu_heading, add_menu_str, getlin, select_menu, windowprocs, zerowri,
} from "./windows.js";
import {
    bypass_objlist, clear_bypasses, nxt_unbypassed_loot, setnotworn, setworn,
} from "./worn.js";
import { get_obj_location, obj_resists } from "./zap.js";
