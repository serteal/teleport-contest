/* NetHack 5.0	o_init.c	$NHDT-Date: 1771216675 2026/02/15 20:37:55 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.101 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2011. */
/* NetHack may be freely redistributed.  See license for details. */

/* #ifdef TILES_IN_GLYPHMAP: not in this build */

function setgemprobs(dlev) { /* void */
    let j, first, lev, sum = 0;

    if (dlev)
        lev = (ledger_no(dlev) > maxledgerno()) ? maxledgerno()
                                                : ledger_no(dlev);
    else
        lev = 0;
    first = svb.bases[GEM_CLASS];

    for (j = 0; j < 9 - Math.trunc(lev / 3); j++)
        objects[first + j].oc_prob = 0;
    first += j;
    if (first > LAST_REAL_GEM || objects[first].oc_class != GEM_CLASS
        || OBJ_NAME(objects[first]) == 0) {
        raw_printf(_("Not enough gems? - first=%d j=%d LAST_GEM=%d"), first, j,
                   LAST_REAL_GEM);
        wait_synch()();
    }
    for (j = first; j <= LAST_REAL_GEM; j++)
        objects[j].oc_prob = Math.trunc((171 + j - first) / (LAST_REAL_GEM + 1 - first));

    /* recompute GEM_CLASS total oc_prob - including rocks/stones */
    for (j = svb.bases[GEM_CLASS]; j < svb.bases[GEM_CLASS + 1]; j++)
        sum += objects[j].oc_prob;
    go.oclass_prob_totals[GEM_CLASS] = sum;
}

/* some gems can have different colors */
function randomize_gem_colors() { /* void */
    if (rn2(2)) { /* change turquoise from green to blue? */
        COPY_OBJ_DESCR(objects[TURQUOISE], objects[SAPPHIRE]);
    }
    if (rn2(2)) { /* change aquamarine from green to blue? */
        COPY_OBJ_DESCR(objects[AQUAMARINE], objects[SAPPHIRE]);
    }
    switch (rn2(4)) { /* change fluorite from violet? */
    case 0:
        break;
    case 1: /* blue */
        COPY_OBJ_DESCR(objects[FLUORITE], objects[SAPPHIRE]);
        break;
    case 2: /* white */
        COPY_OBJ_DESCR(objects[FLUORITE], objects[DIAMOND]);
        break;
    case 3: /* green */
        COPY_OBJ_DESCR(objects[FLUORITE], objects[EMERALD]);
        break;
    }
}
export function COPY_OBJ_DESCR(o_dst, o_src) { return o_dst.oc_descr_idx = o_src.oc_descr_idx, o_dst.oc_color = o_src.oc_color; }

/* shuffle descriptions on objects o_low to o_high */
function shuffle(o_low, o_high, domaterial) { /* void */
    let i, j, num_to_shuffle;
    let sw;
    let color;

    for (num_to_shuffle = 0, j = o_low; j <= o_high; j++)
        if (!objects[j].oc_name_known)
            num_to_shuffle++;
    if (num_to_shuffle < 2)
        return;

    for (j = o_low; j <= o_high; j++) {
        if (objects[j].oc_name_known)
            continue;
        do
            i = j + rn2(o_high - j + 1);
        while (objects[i].oc_name_known);
        sw = objects[j].oc_descr_idx;
        objects[j].oc_descr_idx = objects[i].oc_descr_idx;
        objects[i].oc_descr_idx = sw;
        sw = objects[j].oc_tough;
        objects[j].oc_tough = objects[i].oc_tough;
        objects[i].oc_tough = unsigned(sw);
        color = objects[j].oc_color;
        objects[j].oc_color = objects[i].oc_color;
        objects[i].oc_color = uchar(color);

        /* shuffle material */
        if (domaterial) {
            sw = objects[j].oc_material;
            objects[j].oc_material = objects[i].oc_material;
            objects[i].oc_material = unsigned(sw);
        }
    }
}

export function init_objects() { /* void */
    let i, first, last, prevoclass;
    let oclass;

    for (i = 0; i <= MAXOCLASSES; i++) {
        svb.bases[i] = 0;
        if (i > 0 && i < MAXOCLASSES && objects[i].oc_class != i)
            panic(
              _("init_objects: class for generic object #%d doesn't match (%d)"),
                  i, objects[i].oc_class);
    }
    /* initialize object descriptions */
    for (i = 0; i < NUM_OBJECTS; i++)
        objects[i].oc_name_idx = objects[i].oc_descr_idx = i;
    /* init base; if probs given check that they add up to 1000,
       otherwise compute probs */
    first = MAXOCLASSES;
    prevoclass = -1;
    while (first < NUM_OBJECTS) {
        oclass = objects[first].oc_class;
        /*
         * objects[] sanity check:  must be in ascending oc_class order to
         * be able to use bases[class+1]-1 for the end of a class's range.
         * Also catches a non-contiguous class because reverting to any
         * earlier class would involve switching back to a lower class
         * number after having moved on to one or more other classes.
         */
        if (oclass < prevoclass)
            panic(_("objects[%d] class #%d not in order!"), first, oclass);

        last = first + 1;
        while (last < NUM_OBJECTS && objects[last].oc_class == oclass)
            last++;
        svb.bases[oclass] = first;

        if (oclass == GEM_CLASS) {
            setgemprobs(null);
            randomize_gem_colors();
        }
        first = last;
        prevoclass = oclass;
    }
    /* extra entry allows deriving the range of a class via
       bases[class] through bases[class+1]-1 for all classes
       (except for ILLOBJ_CLASS which is separated from WEAPON_CLASS
       by generic objects); second extra entry is to prevent an
       unexplained crash in doclassdisco(), where the code ended up
       attempting to process non-existent class MAXOCLASSES; the
       [MAXOCLASSES+1] element gives that non-class 0 objects
       when traversing objects[] from bases[X] through bases[X+1]-1 */
    svb.bases[MAXOCLASSES] = svb.bases[MAXOCLASSES + 1] = NUM_OBJECTS;
    /* hypothetically someone might remove all objects of some class,
       or be adding a new class and not populated it yet, leaving gaps
       in bases[]; guarantee that there are no such gaps */
    for (last = MAXOCLASSES - 1; last >= 0; --last)
        if (!svb.bases[last])
            svb.bases[last] = svb.bases[last + 1];

    /* check objects[].oc_name_known */
    for (i = MAXOCLASSES; i < NUM_OBJECTS; ++i) {
        let nmkn = +(objects[i].oc_name_known != 0);

        if (+!OBJ_DESCR(objects[i]) ^ nmkn) {
            if (iflags.sanity_check) {
                impossible(
                    _("obj #%d (%s) name is %s despite%s alternate description"),
                           i, OBJ_NAME(objects[i]),
                           nmkn ? _("pre-known") : _("not known"),
                           nmkn ? _("") : _(" no"));
            }
            /* repair the mistake and keep going */
            objects[i].oc_name_known = nmkn ? 0 : 1;
        }
    }
    /* compute oclass_prob_totals */
    init_oclass_probs();

    /* shuffle descriptions */
    shuffle_all();

    objects[WAN_NOTHING].oc_dir = rn2(2) ? NODIR : IMMEDIATE;
}

/* Compute the total probability of each object class.
 * Assumes svb.bases[] has already been set. */
export function init_oclass_probs() { /* void */
    let i;
    let sum;
    let oclass;
    for (oclass = 0; oclass < MAXOCLASSES; ++oclass) {
        sum = 0;
        /* note: for ILLOBJ_CLASS, bases[oclass+1]-1 isn't the last item
           in the class; but all the generic items have probability 0 so
           adding them to 'sum' has no impact */
        for (i = svb.bases[oclass]; i < svb.bases[oclass + 1]; ++i) {
            sum += objects[i].oc_prob;
        }
        if (sum <= 0 && oclass != ILLOBJ_CLASS
            && svb.bases[oclass] != svb.bases[oclass + 1]) {
            impossible(_("%s (%d) probability total for oclass %d"),
                       !sum ? _("zero") : _("negative"), sum, oclass);
            /* gracefully fail by setting all members of this class to 1 */
            for (i = svb.bases[oclass]; i < svb.bases[oclass + 1]; ++i) {
                objects[i].oc_prob = 1;
                sum++;
            }
        }
        go.oclass_prob_totals[oclass] = sum;
    }
}

/* retrieve the range of objects that otyp shares descriptions with */
export function obj_shuffle_range(
    otyp,
    lo_p, hi_p) { /* void */ /* output: range that item belongs among */
    let i, ocls = objects[otyp].oc_class;

    /* default is just the object itself */
    lo_p[0] = hi_p[0] = otyp;

    switch (ocls) {
    case ARMOR_CLASS:
        if (otyp >= HELMET && otyp <= HELM_OF_TELEPATHY)
            lo_p[0] = HELMET, hi_p[0] = HELM_OF_TELEPATHY;
        else if (otyp >= LEATHER_GLOVES && otyp <= GAUNTLETS_OF_DEXTERITY)
            lo_p[0] = LEATHER_GLOVES, hi_p[0] = GAUNTLETS_OF_DEXTERITY;
        else if (otyp >= CLOAK_OF_PROTECTION && otyp <= CLOAK_OF_DISPLACEMENT)
            lo_p[0] = CLOAK_OF_PROTECTION, hi_p[0] = CLOAK_OF_DISPLACEMENT;
        else if (otyp >= SPEED_BOOTS && otyp <= LEVITATION_BOOTS)
            lo_p[0] = SPEED_BOOTS, hi_p[0] = LEVITATION_BOOTS;
        break;
    case POTION_CLASS:
        /* potion of water has the only fixed description */
        lo_p[0] = svb.bases[POTION_CLASS];
        hi_p[0] = POT_WATER - 1;
        break;
    case AMULET_CLASS:
    case SCROLL_CLASS:
    case SPBOOK_CLASS:
        /* exclude non-magic types and also unique ones */
        lo_p[0] = svb.bases[ocls];
        for (i = lo_p[0]; objects[i].oc_class == ocls; i++)
            if (objects[i].oc_unique || !objects[i].oc_magic)
                break;
        hi_p[0] = i - 1;
        break;
    case RING_CLASS:
    case WAND_CLASS:
    case VENOM_CLASS:
        /* entire class */
        lo_p[0] = svb.bases[ocls];
        hi_p[0] = svb.bases[ocls + 1] - 1;
        break;
    }

    /* artifact checking might ask about item which isn't part of any range
       but fell within the classes that do have ranges specified above */
    if (otyp < lo_p[0] || otyp > hi_p[0])
        lo_p[0] = hi_p[0] = otyp;
    return;
}

/* randomize object descriptions */
function shuffle_all() { /* void */
    const $frame = stack_frame(); try {
    /* entire classes; obj_shuffle_range() handles their exceptions */
    let shuffle_classes = static_array("shuffle_all.shuffle_classes", char, null, [
        AMULET_CLASS, POTION_CLASS, RING_CLASS,  SCROLL_CLASS,
        SPBOOK_CLASS, WAND_CLASS,   VENOM_CLASS,
    ]);
    /* sub-class type ranges (one item from each group) */
    let shuffle_types = static_array("shuffle_all.shuffle_types", short, null, [
        HELMET, LEATHER_GLOVES, CLOAK_OF_PROTECTION, SPEED_BOOTS,
    ]);
    let first = stack_var(int), last = stack_var(int), idx;

    /* do whole classes (amulets, &c) */
    for (idx = 0; idx < (Math.trunc((static_sizeof("shuffle_all.shuffle_classes") / sizeof(char)))); idx++) {
        obj_shuffle_range(svb.bases[(chars[shuffle_classes + idx])],
                          first, last);
        shuffle(first[0], last[0], TRUE);
    }
    /* do type ranges (helms, &c) */
    for (idx = 0; idx < SIZE(shuffle_types); idx++) {
        obj_shuffle_range(shuffle_types[idx], first, last);
        shuffle(first[0], last[0], FALSE);
    }
    return;
    } finally { stack_pop($frame); }
}

/* Return TRUE if the provided string matches the unidentified description of
 * the provided object. */
export function objdescr_is(obj, descr) { /* boolean */
    let objdescr;

    if (!obj) {
        impossible(_("objdescr_is: null obj"));
        return FALSE;
    }

    objdescr = OBJ_DESCR(objects[obj.otyp]);
    if (!objdescr)
        return FALSE; /* no obj description, no match */
    return +!strcmp(objdescr, descr);
}

/* level dependent initialization */
export function oinit() { /* void */
    setgemprobs(u.uz);
}

export function savenames(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let i;
    let len = stack_var(unsigned);

    if (update_file(nhfp)) {
        for (i = 0; i < (MAXOCLASSES + 2); ++i) {
            Sfo_int(nhfp, svb.bases.subarray(i), _("names-bases"));
        }
        for (i = 0; i < NUM_OBJECTS; ++i) {
            Sfo_short(nhfp, svd.disco.subarray(i), _("names-disco"));
        }
        for (i = 0; i < NUM_OBJECTS; ++i) {
            Sfo_objclass(nhfp, objects[i], _("names-objclass"));
        }
    }
    /* as long as we use only one version of Hack we
       need not save oc_name and oc_descr, but we must save
       oc_uname for all objects */
    for (i = 0; i < NUM_OBJECTS; i++)
        if (objects[i].oc_uname) {
            if (update_file(nhfp)) {
                len[0] = unsigned(Strlen(objects[i].oc_uname) + 1);
                Sfo_unsigned(nhfp, len, _("names-len"));
                Sfo_char(nhfp, objects[i].oc_uname, _("names-oc_uname"),
                             int((len[0])));
            }
            if (release_data(nhfp)) {
                free((objects[i].oc_uname));
                objects[i].oc_uname = 0;
            }
        }
    } finally { stack_pop($frame); }
}

export function restnames(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let i;
    let len = stack_var(unsigned, 0);

    for (i = 0; i < (MAXOCLASSES + 2); ++i) {
        sfi_int(nhfp, svb.bases.subarray(i), _("names-bases"));
    }
    for (i = 0; i < NUM_OBJECTS; ++i) {
        Sfi_short(nhfp, svd.disco.subarray(i), _("names-disco"));
    }
    for (i = 0; i < NUM_OBJECTS; ++i) {
        Sfi_objclass(nhfp, objects[i], _("names-objclass"));
    }
    for (i = 0; i < NUM_OBJECTS; i++) {
        if (objects[i].oc_uname) {
            sfi_unsigned(nhfp, len, _("names-len"));
            objects[i].oc_uname = addr_of(alloc(len[0]));
            Sfi_char(nhfp, objects[i].oc_uname, _("names-oc_uname"), int((len[0])));
        }
    }
    } finally { stack_pop($frame); }
}

/* make the object dknown and mark it as encountered */
export function observe_object(obj) { /* void */
    let oindx = obj.otyp;

    /* skip for generic objects and for STRANGE_OBJECT */
    if (oindx >= FIRST_OBJECT && !Hallucination()) {
        obj.dknown = 1;
        discover_object(oindx, FALSE, TRUE, FALSE);
    }
}

export function discover_object(
    oindx,
    mark_as_known,
    mark_as_encountered,
    credit_hero) { /* void */ /* exercise wisdom */
    if (oindx < FIRST_OBJECT) /* don't discover generic objects */
        return;

    if ((!objects[oindx].oc_name_known && mark_as_known)
        || (!objects[oindx].oc_encountered && mark_as_encountered)
        || (Role_if(PM_SAMURAI)
            && Japanese_item_name(oindx, 0))) {
        let dindx, acls = objects[oindx].oc_class;

        /* Loop thru disco[] 'til we find the target (which may have been
           uname'd) or the next open slot; one or the other will be found
           before we reach the next class... */
        for (dindx = svb.bases[acls]; svd.disco[dindx] != 0; dindx++)
            if (svd.disco[dindx] == oindx)
                break;
        svd.disco[dindx] = oindx;

        if (mark_as_encountered)
            objects[oindx].oc_encountered = 1;

        if (!objects[oindx].oc_name_known && mark_as_known) {
            objects[oindx].oc_name_known = 1;
            if (credit_hero)
                exercise(A_WIS, TRUE);

            /* !in_moveloop => initial inventory,
               gameover => final disclosure */
            if (program_state.in_moveloop && !program_state.gameover) {
                if (objects[oindx].oc_class == GEM_CLASS)
                    gem_learned(oindx); /* could affect price of unpaid gems */
                update_inventory();
            }
        }
    }
}

/* if a class name has been cleared, we may need to purge it from disco[] */
export function undiscover_object(oindx) { /* void */
    if (!objects[oindx].oc_name_known && !objects[oindx].oc_encountered) {
        let dindx, acls = objects[oindx].oc_class;
        let found = FALSE;

        /* find the object; shift those behind it forward one slot */
        for (dindx = svb.bases[acls];
             dindx < NUM_OBJECTS && svd.disco[dindx] != 0
                 && objects[dindx].oc_class == acls;
             dindx++)
            if (found)
                svd.disco[dindx - 1] = svd.disco[dindx];
            else if (svd.disco[dindx] == oindx)
                found = TRUE;

        /* clear last slot */
        if (found)
            svd.disco[dindx - 1] = 0;
        else
            impossible(_("named object not in disco"));

        if (objects[oindx].oc_class == GEM_CLASS)
            gem_learned(oindx); /* ok, it's actually been unlearned */
    }
}

export function interesting_to_discover(i) { /* boolean */
    /* most players who don't speak Japanese manage to figure out what
       gunyoki, osaku, and so forth mean, but treat them as pre-discovered
       to be disclosed by '\' */
    if (Role_if(PM_SAMURAI) && Japanese_item_name(i, 0))
        return TRUE;

    /* Objects that were discovered without encountering them are now printed
       with a '*' */
    return (objects[i].oc_uname != 0
                      || ((objects[i].oc_name_known
                           || objects[i].oc_encountered)
                          && OBJ_DESCR(objects[i]) != 0) ? 1 : 0);
}

/* items that should stand out once they're known */
const uniq_objs = static_array("uniq_objs", short, null, [
    AMULET_OF_YENDOR,
    /* same order as major oracularity; alphabetical when fully IDed */
    BELL_OF_OPENING,
    SPE_BOOK_OF_THE_DEAD,
    CANDELABRUM_OF_INVOCATION,
]);

/* discoveries qsort comparison function */
function discovered_cmp(v1, v2) { /* int QSORTCALLBACK */
    let s1 = ref_to(ptr_to(char), v1)[0];
    let s2 = ref_to(ptr_to(char), v2)[0];
    /* each element starts with "* " or "  " but we don't sort by those */
    let res = strcmpi(s1 + 2, s2 + 2);

    if (res == 0) {
        ; /* no tie-breaker needed */
    }
    return res;
}

function sortloot_descr(otyp, outbuf) { /* char * */
    const $frame = stack_frame(); try {
    let sl_cookie = stack_struct(struct_sortloot_item);
    let o = stack_struct(struct_obj);

    struct_assign(o, cg.zeroobj);
    o.otyp = otyp;
    o.oclass = objects[otyp].oc_class;
    o.dknown = 1; /* not observe_object, this isn't a real object */
    o.known = (objects[otyp].oc_name_known || !objects[otyp].oc_uses_known)
              ? 1 : 0;
    o.corpsenm = NON_PM; /* suppress statue and figurine details */
    /* but suppressing fruit details leads to "bad fruit #0" */
    if (otyp == SLIME_MOLD)
        o.spe = svc.context.current_fruit;

    memset(addr_of(sl_cookie), 0, sizeof(struct_sortloot_item));
    sl_cookie.obj = null;
    sl_cookie.str = 0;

    loot_classify(sl_cookie, o);
    sprintf(outbuf, _("%02d%02d%1d "), sl_cookie.orderclass, sl_cookie.subclass, sl_cookie.disco)
;
    return outbuf;
    } finally { stack_pop($frame); }
}

/* also used in options.c (optfn_sortdiscoveries) */
const disco_order_let = init_string(static_array("disco_order_let", char, sizeof_string("osca")), _("osca"), true);
const disco_orders_descr = static_array("disco_orders_descr", ptr_to(char), null, [
    _("by order of discovery within each class"),
    _("sortloot order (by class with some sub-class groupings)"),
    _("alphabetical within each class"),
    _("alphabetical across all classes"),
    0
]);

export function choose_disco_sort(
    mode) { /* int */ /* 0 => 'O' cmd, 1 => full discoveries; 2 => class disco */
    const $frame = stack_frame(); try {
    let tmpwin;
    let selected = stack_var(ptr_to(struct_mi));
    let any = stack_struct(struct_any);
    let i, n, choice;
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany); /* zero out all bits */
    for (i = 0; disco_orders_descr[i]; ++i) {
        any.a_int = chars[disco_order_let + i];
        add_menu(tmpwin, nul_glyphinfo, any, char(any.a_int),
                 0, ATR_NONE, clr,
                 disco_orders_descr[i],
                 (chars[disco_order_let + i] == flags.discosort)
                    ? MENU_ITEMFLAGS_SELECTED
                    : MENU_ITEMFLAGS_NONE);
    }
    if (mode == 2) {
        /* called via 'm `' where full alphabetize doesn't make sense
           (only showing one class so can't span all classes) but the
           chosen sort will stick and also apply to '\' usage */
        add_menu_str(tmpwin, _(""));
        add_menu_str(tmpwin,
                     _("Note: full alphabetical and alphabetical within class"));
        add_menu_str(tmpwin,
                     _("      are equivalent for single class discovery, but"));
        add_menu_str(tmpwin,
                    _("      will matter for future use of total discoveries."));
    }
    end_menu()(tmpwin, _("Ordering of discoveries"));

    n = select_menu(tmpwin, PICK_ONE, selected);
    destroy_nhwindow()(tmpwin);
    if (n > 0) {
        choice = ptr_add(selected[0], 0).item.a_int;
        /* skip preselected entry if we have more than one item chosen */
        if (n > 1 && choice == flags.discosort)
            choice = ptr_add(selected[0], 1).item.a_int;
        free(addr_of(selected[0]));
        flags.discosort = choice;
    }
    return n;
    } finally { stack_pop($frame); }
}

/* augment obj_typename() with explanation of Japanese item names */
function disco_typename(otyp) { /* char * */
    const $frame = stack_frame(); try {
    let result = obj_typename(otyp);

    if (Role_if(PM_SAMURAI) && Japanese_item_name(otyp, 0)) {
        let buf = stack_array(char, BUFSZ);
        let actualn = (((otyp != MAGIC_HARP && otyp != WOODEN_HARP)
                                || objects[otyp].oc_name_known)
                               ? OBJ_NAME(objects[otyp])
                               /* undiscovered harp (since wooden harp is
                                  non-magic so pre-discovered, only applies
                                  to magic harp and will only be seen if
                                  magic harp has been 'called' something) */
                               : _("harp"));

        if (!actualn) { /* won't happen; used to pacify static analyzer */
            ;
        } else if (strstri(result, _(" called"))) {
            sprintf(buf, _(" [%s] called"), actualn);
            strsubst(result, _(" called"), buf);
        } else if (strstri(result, _(" ("))) {
            sprintf(buf, _(" [%s] ("), actualn);
            strsubst(result, _(" ("), buf);
        } else {
            sprintf(eos(result), _(" [%s]"), actualn);
        }
    }
    return result;
    } finally { stack_pop($frame); }
}

/* append typename(dis) to buf[], possibly truncating in the process;
   also append price quote information if it fits */
function disco_append_typename(buf, dis) { /* void */
    const $frame = stack_frame(); try {
    let len = strlen(buf);
    let p, typnm = disco_typename(dis);
    let typnm_len = strlen(typnm);
    let eos = stack_var(ptr_to(char));

    if (unsigned(len + typnm_len) < BUFSZ) {
        /* ordinary */
        strcat(buf, typnm);
        eos[0] = buf + len + typnm_len;
    } else if ((p = strrchr(typnm, ord('('))) != 0
               && p > typnm && chars[p + (-1)] == ord(' ') && strchr(p, ord(')')) != 0) {
        /* typename() returned "really long user-applied name (actual type)"
           and we want to truncate from "really long user-applied name" while
           keeping " (actual type)" intact */
        --p; /* back up to space in front of open paren */
        strncat(buf, typnm, unsigned(BUFSZ - 1 - unsigned(len + strlen(p))));
        strcat(buf, p);
        eos[0] = buf + strlen(buf);
    } else {
        /* unexpected; just truncate from end of typename */
        strncat(buf, typnm, unsigned(BUFSZ - 1 - len));
        eos[0] = buf + strlen(buf);
    }

    append_price_quote(buf, eos, dis);
    } finally { stack_pop($frame); }
}

/* minor fixup for Book of the Dead needed in more than one place */
function disco_fmt_uniq(uidx, outbuf) { /* void */
    sprintf(outbuf, _("  %s"), objects[uidx].oc_name_known
                              ? OBJ_NAME(objects[uidx])
                              : OBJ_DESCR(objects[uidx]));
    /* in the spellbooks section of main discoveries list, encountered
       but not fully discovered Book of the Dead is shown as
       "spellbook (papyrus)" like other encountered but not discovered books;
       in the unique/relics section we want "papyrus spellbook" instead */
    if (!objects[uidx].oc_name_known
        && objects[uidx].oc_class == SPBOOK_CLASS)
        strcat(outbuf, _(" spellbook"));
}

/* sort and output sorted_lines to window and free the lines */
function disco_output_sorted(
    tmpwin,
    sorted_lines, sorted_ct,
    lootsort) { /* void */
    let p;
    let j;

    nh_deterministic_qsort(addr_of((sorted_lines)), unsigned((sorted_ct)), (sizeof(ptr_to(char))), (discovered_cmp));
    for (j = 0; j < sorted_ct; ++j) {
        p = sorted_lines[j];
        assert(p != (0)); /* pacify static analyzer */
        if (lootsort) {
            chars[p + 6] = chars[p + 0]; /* '*' or ' ' */
            p += 6;
        }
        putstr()(tmpwin, 0, p);
        free(sorted_lines[j]), sorted_lines[j] = 0;
    }
}

/* the #known command - show discovered object types */
export function dodiscovered() { /* int */ /* free after Robert Viduya */
    const $frame = stack_frame(); try {
    let tmpwin;
    let s, oclass, prev_class,
         classes = stack_array(char, MAXOCLASSES), buf = stack_array(char, BUFSZ),
         sorted_lines = stack_array(ptr_to(char), NUM_OBJECTS); /* overkill */
    let p;
    let i, dis, ct, uniq_ct, arti_ct, sorted_ct, uidx;
    let sortindx;  // should be ptrdiff_t, but we don't require that exists
    let alphabetized, alphabyclass, lootsort;

    if (!flags.discosort || !(p = strchr(disco_order_let, flags.discosort)))
        flags.discosort = ord('o');

    if (iflags.menu_requested) {
        if (choose_disco_sort(1) < 0)
            return ECMD_OK;
    }
    alphabyclass = +(flags.discosort == ord('c'));
    alphabetized = (flags.discosort == ord('a') || alphabyclass ? 1 : 0);
    lootsort = +(flags.discosort == ord('s'));
    sortindx = strchr(disco_order_let, flags.discosort) - disco_order_let;

    tmpwin = create_nhwindow()(NHW_TEXT);
    sprintf(buf, _("Discoveries, %s"), disco_orders_descr[sortindx]);
    putstr()(tmpwin, 0, buf);
    putstr()(tmpwin, 0, _(""));

    /*
     * FIXME?
     *  relics and artifacts don't obey player's sort order even though
     *  the header line states that they're shown in such-and-such order.
     */

    /* gather "unique objects", also called "relics", into a pseudo-class;
       they'll also be displayed individually within their regular class */
    uniq_ct = 0;
    for (i = dis = 0; i < SIZE(uniq_objs); i++) {
        uidx = uniq_objs[i];
        if (objects[uidx].oc_name_known
            || (objects[uidx].oc_encountered && uidx != AMULET_OF_YENDOR)) {
            if (!dis++)
                putstr()(tmpwin, iflags.menu_headings.attr,
                       _("Unique items or Relics"));
            ++uniq_ct;
            disco_fmt_uniq(uidx, buf);
            putstr()(tmpwin, 0, buf);
        }
    }
    /* display any known artifacts as another pseudo-class */
    arti_ct = disp_artifact_discoveries(tmpwin);

    /* several classes are omitted from packorder; one is of interest here */
    strcpy(classes, flags.inv_order);
    if (!strchr(classes, VENOM_CLASS))
        strkitten(classes, VENOM_CLASS); /* append char to string */

    ct = uniq_ct + arti_ct;
    sorted_ct = 0;
    for (s = classes; chars[s]; s++) {
        oclass = chars[s];
        prev_class = oclass + 1; /* forced different from oclass */
        for (i = svb.bases[oclass];
             i < NUM_OBJECTS && objects[i].oc_class == oclass; i++) {
            if ((dis = svd.disco[i]) != 0 && interesting_to_discover(dis)) {
                ct++;
                if (oclass != prev_class) {
                    if ((alphabyclass || lootsort) && sorted_ct) {
                        /* output previous class */
                        disco_output_sorted(tmpwin, sorted_lines, sorted_ct,
                                            lootsort);
                        sorted_ct = 0;
                    }
                    if (!alphabetized || alphabyclass) {
                        /* header for new class */
                        putstr()(tmpwin, iflags.menu_headings.attr,
                               let_to_name(oclass, FALSE, FALSE));
                        prev_class = oclass;
                    }
                }
                strcpy(buf, objects[dis].oc_encountered ? _("  ") : _("* "));
                if (lootsort)
                    sortloot_descr(dis, buf + 2);
                disco_append_typename(buf, dis);

                if (!alphabetized && !lootsort)
                    putstr()(tmpwin, 0, buf);
                else
                    sorted_lines[sorted_ct++] = dupstr(buf);
            }
        }
    }
    if (ct == 0) {
        You(_("haven't discovered anything yet..."));
    } else {
        if (sorted_ct) {
            /* if we're alphabetizing by class, we've already shown the
               relevant header above; if we're alphabetizing across all
               classes, we normally don't need a header; but it we showed
               any unique items or any artifacts then we do need one */
            if ((uniq_ct || arti_ct) && alphabetized && !alphabyclass)
                putstr()(tmpwin, iflags.menu_headings.attr, _("Discovered items"));
            disco_output_sorted(tmpwin, sorted_lines, sorted_ct, lootsort);
        }
        display_nhwindow()(tmpwin, TRUE);
    }
    destroy_nhwindow()(tmpwin);

    return ECMD_OK;
    } finally { stack_pop($frame); }
}

/* lower case let_to_name() output, which differs from def_oc_syms[].name */
function oclass_to_name(oclass, buf) { /* char * */
    let s;

    strcpy(buf, let_to_name(oclass, FALSE, FALSE));
    for (s = buf; chars[s]; ++s)
        chars[s] = lowc(chars[s]);
    return buf;
}

/* the #knownclass command - show discovered object types for one class;
   in addition to actual object classes, supports pseudo-class 'a' for
   discovered artifacts and 'u' (or 'r', for "relics") for unique items */
export function doclassdisco() { /* int */
    const $frame = stack_frame(); try {
    let prompt = init_string(static_array("doclassdisco.prompt", char, sizeof_string("View discoveries for which sort of objects?")), _("View discoveries for which sort of objects?"), true),
        havent_discovered_any = init_string(static_array("doclassdisco.havent_discovered_any", char, sizeof_string("haven't discovered any %s yet.")), _("haven't discovered any %s yet."), true),
        unique_items = init_string(static_array("doclassdisco.unique_items", char, sizeof_string("unique items or relics")), _("unique items or relics"), true),
        artifact_items = init_string(static_array("doclassdisco.artifact_items", char, sizeof_string("artifacts")), _("artifacts"), true);

    let tmpwin = WIN_ERR;
    let pick_list = stack_var(ptr_to(struct_mi), null);
    let any = stack_struct(struct_any);
    let s, c, oclass, menulet, allclasses = stack_array(char, MAXOCLASSES),
         discosyms = stack_array(char, 3 + MAXOCLASSES + 1), buf = stack_array(char, BUFSZ),
         sorted_lines = stack_array(ptr_to(char), NUM_OBJECTS); /* overkill */
    let p;
    let i, ct, dis, xtras, sorted_ct, uidx;
    let traditional, alphabetized, lootsort;
    let clr = NO_COLOR;

    if (!flags.discosort || !(p = strchr(disco_order_let, flags.discosort)))
        flags.discosort = ord('o');

    if (iflags.menu_requested) {
        if (choose_disco_sort(2) < 0)
            return ECMD_OK;
    }
    alphabetized = +(flags.discosort == ord('a') || flags.discosort == ord('c'));
    lootsort = +(flags.discosort == ord('s'));

    chars[discosyms + 0] = ord('\0');
    traditional = +(flags.menu_style == MENU_TRADITIONAL
                   || flags.menu_style == MENU_COMBINATION);
    if (!traditional) {
        tmpwin = create_nhwindow()(NHW_MENU);
        start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    }
    struct_assign(any, cg.zeroany);
    menulet = ord('a');

    /*
     * FIXME?
     *  relics and artifacts don't obey player's sort order even though
     *  the header line states that they're shown in such-and-such order.
     */

    /* check whether we've discovered any unique objects (primarily the
       invocation items; the Guidebook calls unique items "relics" but the
       Amulet of Yendor is unique too so we haven't made a blanket change
       from 'u' to 'r') */
    for (i = 0; i < SIZE(uniq_objs); i++) {
        uidx = uniq_objs[i];
        if (objects[uidx].oc_name_known
            || (objects[uidx].oc_encountered && uidx != AMULET_OF_YENDOR)) {
            strcat(discosyms, _("u"));
            if (!traditional) {
                any.a_int = ord('u');
                /* FIXME: having 'r' as an accelerator to provide an unseen
                   synonym works but doesn't make much sense since the main
                   selector is 'a' (implicit lootabc) rather than 'u' */
                add_menu(tmpwin, nul_glyphinfo, any, menulet++, ord('r'),
                         ATR_NONE, clr, unique_items, MENU_ITEMFLAGS_NONE);
            }
            break;
        }
    }

    /* check whether we've discovered any artifacts */
    if (disp_artifact_discoveries(WIN_ERR) > 0) {
        strcat(discosyms, _("a"));
        if (!traditional) {
            any.a_int = ord('a');
            add_menu(tmpwin, nul_glyphinfo, any, menulet++, 0,
                     ATR_NONE, clr, artifact_items, MENU_ITEMFLAGS_NONE);
        }
    }

    /* collect classes with discoveries, in packorder ordering; several
       classes are omitted from packorder and one is of interest here */
    strcpy(allclasses, flags.inv_order);
    if (!strchr(allclasses, VENOM_CLASS))
        strkitten(allclasses, VENOM_CLASS); /* append char to string */
    /* construct discosyms[] */
    for (s = allclasses; chars[s]; ++s) {
        oclass = chars[s];
        c = def_oc_syms[oclass].sym;
        for (i = svb.bases[oclass];
             i < NUM_OBJECTS && objects[i].oc_class == oclass; ++i)
            if ((dis = svd.disco[i]) != 0 && interesting_to_discover(dis)) {
                if (!strchr(discosyms, c)) {
                    strkitten(discosyms, c);
                    if (!traditional) {
                        any.a_int = c;
                        add_menu(tmpwin, nul_glyphinfo, any,
                                 menulet++, c, ATR_NONE, clr,
                                 oclass_to_name(oclass, buf),
                                 MENU_ITEMFLAGS_NONE);
                    }
                }
            }
    }

    /* there might not be anything for us to do... */
    if (!chars[discosyms + 0]) {
        You(havent_discovered_any, _("items"));
        if (tmpwin != WIN_ERR)
            destroy_nhwindow()(tmpwin);
        return ECMD_OK;
    }

    /* have player choose a class */
    c = ord('\0'); /* class not chosen yet */
    if (traditional) {
        let allclasses_plustwo = stack_array(char, sizeof(array_of(char, MAXOCLASSES)) + 3);

        /* we'll prompt even if there's only one viable class; we add all
           nonviable classes as unseen acceptable choices so player can ask
           for discoveries of any class whether it has discoveries or not */
        sprintf(allclasses_plustwo, _("%s%c%c%c"), allclasses, ord('a'), ord('u'), ord('r'));
        for (s = allclasses_plustwo, xtras = 0; chars[s]; ++s) {
            c = strchr(_("aur"), chars[s]) ? chars[s] : def_oc_syms[(chars[s])].sym;
            if (!strchr(discosyms, c)) {
                if (!xtras++)
                    strkitten(discosyms, ord('\x1b'));
                strkitten(discosyms, c);
            }
        }
        /* get the class (via its symbol character) */
        c = yn_function(prompt, discosyms, ord('\0'), TRUE);
        if (!c)
            clear_nhwindow()(WIN_MESSAGE);
    } else {
        /* menustyle:full or menustyle:partial */
        if (!chars[discosyms + 1] && flags.menu_style == MENU_PARTIAL) {
            /* only one class; menustyle:partial normally jumps past class
               filtering straight to final menu so skip class filter here */
            c = chars[discosyms + 0];
        } else {
            /* more than one choice, or menustyle:full which normally has
               an intermediate class selection menu before the final menu */
            end_menu()(tmpwin, prompt);
            i = select_menu(tmpwin, PICK_ONE, pick_list);
            if (i > 0) {
                c = ptr_add(pick_list[0], 0).item.a_int;
                free(addr_of(pick_list[0]));
            } /* else c stays 0 */
        }
        destroy_nhwindow()(tmpwin);
    }
    if (!c)
        return ECMD_OK; /* player declined to make a selection */

    /*
     * show discoveries for object class c
     */
    tmpwin = create_nhwindow()(NHW_TEXT);
    ct = 0;
    switch (c) {
    case ord('u'):
    case ord('r'):
        putstr()(tmpwin, iflags.menu_headings.attr,
               upstart(strcpy(buf, unique_items)));
        for (i = 0; i < SIZE(uniq_objs); i++) {
            uidx = uniq_objs[i];
            if (objects[uidx].oc_name_known
                || (objects[uidx].oc_encountered
                    && uidx != AMULET_OF_YENDOR)) {
                ++ct;
                disco_fmt_uniq(uidx, buf);
                putstr()(tmpwin, 0, buf);
            }
        }
        if (!ct)
            You(havent_discovered_any, unique_items);
        break;
    case ord('a'):
        /* note: this will work all the time for menustyle traditional
           but requires at least one artifact discovery for other styles
           [could fix that by forcing the 'a' choice into the pick-class
           menu when running in wizard mode] */
        if (wizard() && y_n(_("Dump information about all artifacts?")) == ord('y')) {
            dump_artifact_info(tmpwin);
            ct = NROFARTIFACTS; /* non-zero vs zero is what matters below */
            break;
        }
        /* disp_artifact_discoveries() includes a header */
        ct = disp_artifact_discoveries(tmpwin);
        if (!ct)
            You(havent_discovered_any, artifact_items);
        break;
    default:
        oclass = def_char_to_objclass(c);
        /* this should never happen but has been observed via the fuzzer */
        if (oclass == MAXOCLASSES)
            impossible(_("doclassdisco: invalid object class '%s'"), visctrl(c));
        sprintf(buf, _("Discovered %s in %s"), let_to_name(oclass, FALSE, FALSE), (flags.discosort == ord('o')) ? _("order of discovery")
                : (flags.discosort == ord('s')) ? _("'sortloot' order")
                  : _("alphabetical order"))
;
        putstr()(tmpwin, 0, buf); /* skip iflags.menu_headings */
        sorted_ct = 0;
        for (i = svb.bases[oclass]; i <= svb.bases[oclass + 1] - 1;
             ++i) {
            if ((dis = svd.disco[i]) != 0 && interesting_to_discover(dis)) {
                ++ct;
                strcpy(buf, objects[dis].oc_encountered ? _("  ") : _("* "));
                if (lootsort)
                    sortloot_descr(dis, buf + 2);
                disco_append_typename(buf, dis);

                if (!alphabetized && !lootsort)
                    putstr()(tmpwin, 0, buf);
                else
                    sorted_lines[sorted_ct++] = dupstr(buf);
            }
        }
        if (!ct) {
            You(havent_discovered_any, oclass_to_name(oclass, buf));
        } else if (sorted_ct) {
            nh_deterministic_qsort(addr_of((sorted_lines)), unsigned((sorted_ct)), (sizeof(ptr_to(char))), (discovered_cmp));
            for (i = 0; i < sorted_ct; ++i) {
                let sl;

                sl = sorted_lines[i];
                if (lootsort) {
                    chars[sl + 6] = chars[sl + 0]; /* '*' or ' ' */
                    sl += 6;
                }
                putstr()(tmpwin, 0, sl);
                free(sorted_lines[i]), sorted_lines[i] = 0;
            }
        }
        break;
    }
    if (ct)
        display_nhwindow()(tmpwin, TRUE);
    destroy_nhwindow()(tmpwin);
    return ECMD_OK;
    } finally { stack_pop($frame); }
}

/* put up nameable subset of discoveries list as a menu */
export function rename_disco() { /* void */
    const $frame = stack_frame(); try {
    let i, dis;
    let ct = 0, mn = 0, sl;
    let s, oclass, prev_class;
    let tmpwin;
    let any = stack_struct(struct_any);
    let selected = stack_var(ptr_to(struct_mi), null);
    let clr = NO_COLOR;
    let buf = stack_array(char, BUFSZ);

    struct_assign(any, cg.zeroany);
    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);

    /*
     * Skip the "unique objects" section (each will appear within its
     * regular class if it is nameable) and the artifacts section.
     * We assume that classes omitted from packorder aren't nameable
     * so we skip venom too.
     */

    /* for each class, show discoveries in that class */
    for (s = flags.inv_order; chars[s]; s++) {
        oclass = chars[s];
        prev_class = oclass + 1; /* forced different from oclass */
        for (i = svb.bases[oclass];
             i < NUM_OBJECTS && objects[i].oc_class == oclass; i++) {
            dis = svd.disco[i];
            if (!dis || !interesting_to_discover(dis))
                continue;
            ct++;
            if (!objtyp_is_callable(dis))
                continue;
            mn++;

            if (oclass != prev_class) {
                any.a_int = 0;
                add_menu_heading(tmpwin,
                                 let_to_name(oclass, FALSE, FALSE));
                prev_class = oclass;
            }
            any.a_int = dis;
            chars[buf] = ord('\0');
            disco_append_typename(buf, dis);
            add_menu(tmpwin, nul_glyphinfo, any, 0, 0,
                     ATR_NONE, clr, buf, MENU_ITEMFLAGS_NONE);
        }
    }
    if (ct == 0) {
        You(_("haven't discovered anything yet..."));
    } else if (mn == 0) {
        pline(_("None of your discoveries can be assigned names..."));
    } else {
        end_menu()(tmpwin, _("Pick an object type to name"));
        dis = STRANGE_OBJECT;
        sl = select_menu(tmpwin, PICK_ONE, selected);
        if (sl > 0) {
            dis = ptr_add(selected[0], 0).item.a_int;
            free(addr_of(selected[0]));
        }
        if (dis != STRANGE_OBJECT) {
            let odummy = stack_struct(struct_obj);

            struct_assign(odummy, cg.zeroobj);
            odummy.otyp = dis;
            odummy.oclass = objects[dis].oc_class;
            odummy.quan = 1;
            odummy.known = +!objects[dis].oc_uses_known;
            odummy.dknown = 1; /* not observe_object: it isn't real */
            docall(odummy);
        }
    }
    destroy_nhwindow()(tmpwin);
    return;
    } finally { stack_pop($frame); }
}

export function get_sortdisco(opts, cnf) { /* void */
    let p = strchr(disco_order_let, flags.discosort);

    if (!p)
        flags.discosort = ord('o'), p = disco_order_let;
    if (cnf)
        sprintf(opts, _("%c"), flags.discosort);
    else
        strcpy(opts, disco_orders_descr[p - disco_order_let]);
}
/*o_init.c*/

import { A_WIS } from "./attrib.h.js";
import { NO_COLOR } from "./color.h.js";
import {
    AMULET_CLASS, ARMOR_CLASS, GEM_CLASS, ILLOBJ_CLASS, MAXOCLASSES, POTION_CLASS, RING_CLASS,
    SCROLL_CLASS, SPBOOK_CLASS, VENOM_CLASS, WAND_CLASS,
} from "./defsym.h.js";
import { wizard } from "./flag.h.macros.js";
import { BUFSZ, FALSE, TRUE } from "./global.h.js";
import { Strlen, strcmpi } from "./global.h.macros.js";
import {
    ECMD_OK, MENU_COMBINATION, MENU_PARTIAL, MENU_TRADITIONAL, NROFARTIFACTS, struct_sortloot_item,
} from "./hack.h.js";
import { release_data, update_file, y_n } from "./hack.h.macros.js";
import { NON_PM, PM_SAMURAI } from "./monsters.h.js";
import { struct_obj } from "./obj.h.js";
import { IMMEDIATE, NODIR } from "./objclass.h.js";
import { OBJ_DESCR, OBJ_NAME } from "./objclass.h.macros.js";
import {
    AMULET_OF_YENDOR, AQUAMARINE, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION, CLOAK_OF_DISPLACEMENT,
    CLOAK_OF_PROTECTION, DIAMOND, EMERALD, FIRST_OBJECT, FLUORITE, GAUNTLETS_OF_DEXTERITY, HELMET,
    HELM_OF_TELEPATHY, LAST_REAL_GEM, LEATHER_GLOVES, LEVITATION_BOOTS, MAGIC_HARP, NUM_OBJECTS,
    POT_WATER, SAPPHIRE, SLIME_MOLD, SPEED_BOOTS, SPE_BOOK_OF_THE_DEAD, STRANGE_OBJECT, TURQUOISE,
    WAN_NOTHING, WOODEN_HARP,
} from "./objects.h.js";
import {
    Sfi_char, Sfi_objclass, Sfi_short, Sfo_char, Sfo_int, Sfo_objclass, Sfo_short, Sfo_unsigned,
} from "./savefile.h.macros.js";
import {
    clear_nhwindow, create_nhwindow, destroy_nhwindow, display_nhwindow, end_menu, putstr,
    start_menu, wait_synch,
} from "./winprocs.h.macros.js";
import {
    ATR_NONE, MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, MENU_ITEMFLAGS_SELECTED, NHW_MENU,
    NHW_TEXT, PICK_ONE, WIN_ERR, struct_any, struct_mi,
} from "./wintype.h.js";
import { Role_if } from "./you.h.macros.js";
import { Hallucination } from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, short, sizeof, sizeof_string, uchar, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import {
    assert, free, memset, sprintf, strcat, strchr, strcmp, strcpy, strlen, strncat, strrchr,
} from "../rt/libc.js";
import {
    init_string, stack_array, stack_struct, stack_var, static_array, static_sizeof,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, array_of, ptr_add, ptr_to, ref_to, struct_assign } from "../rt/struct.js";
import { alloc, dupstr } from "./alloc.js";
import { disp_artifact_discoveries, dump_artifact_info } from "./artifact.js";
import { exercise } from "./attrib.js";
import { yn_function } from "./cmd.js";
import { cg, flags, go, iflags, program_state, svb, svc, svd, u } from "./decl.js";
import { nul_glyphinfo } from "./display.js";
import { docall, objtyp_is_callable } from "./do_name.js";
import { def_char_to_objclass, def_oc_syms } from "./drawing.js";
import { ledger_no, maxledgerno } from "./dungeon.js";
import { panic } from "./end.js";
import {
    eos, lowc, nh_deterministic_qsort, strkitten, strstri, strsubst, upstart, visctrl,
} from "./hacklib.js";
import { let_to_name, loot_classify, update_inventory } from "./invent.js";
import { objects } from "./objects.js";
import { Japanese_item_name, obj_typename } from "./objnam.js";
import { You, impossible, pline, raw_printf } from "./pline.js";
import { rn2 } from "./rnd.js";
import { sfi_int, sfi_unsigned } from "./sfbase.js";
import { append_price_quote, gem_learned } from "./shk.js";
import { add_menu, add_menu_heading, add_menu_str, select_menu } from "./windows.js";
