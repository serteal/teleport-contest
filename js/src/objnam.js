/* NetHack 5.0	objnam.c	$NHDT-Date: 1745114235 2025/04/19 17:57:15 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.453 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2011. */
/* NetHack may be freely redistributed.  See license for details. */

/* "an uncursed greased partly eaten guardian naga hatchling [corpse]" */
export const PREFIX = 80;

export const NUMOBUF = 12;

const struct__readobjnam_data = struct("struct__readobjnam_data", {
    otmp: ptr_to("struct_obj"),
    bp: ptr_to(char),
    origbp: ptr_to(char),
    oclass: char,
    un: ptr_to(char), dn: ptr_to(char), actualn: ptr_to(char),
    name: ptr_to(char),
    p: ptr_to(char),
    cnt: int, spe: int, spesgn: int, typ: int, very: int, rechrg: int,
    blessed: int, uncursed: int, iscursed: int, ispoisoned: int, isgreased: int,
    eroded: int, eroded2: int, erodeproof: int, locked: int, unlocked: int, broken: int, real: int, fake: int,
    halfeaten: int, mntmp: int, contents: int,
    islit: int, unlabeled: int, ishistoric: int, isdiluted: int, trapped: int,
    doorless: int, open: int, closed: int, flags: int,
    tmp: int, tinv: int, tvariety: int, mgend: int,
    wetness: int, gsize: int,
    ftype: int,
    zombify: boolean,
    globbuf: array_of(char, BUFSZ),
    fruitbuf: array_of(char, BUFSZ),
});

const struct_Jitem = struct("struct_Jitem", {
    item: int,
    name: ptr_to(char),
});

export function BSTRCMPI(base, ptr, str) { return (ptr < base || strncmpi((ptr), (str), -1) ? 1 : 0); }
export function BSTRNCMPI(base, ptr, str, num) { return (ptr < base || strncmpi(ptr, str, num) ? 1 : 0); }

export function Strcasecpy(dst, src) { return void strcasecpy(dst, src); }
export function Strncat(dst, src, cnt) { return void strncat(dst, src, cnt); }

/* Concat(): append text to base, adjusted by delta, with bounds checking
   via a pair of behind-the-scenes variables; delta is either 0 for normal
   concatenation or 1 to replace the final character with something */

/* true for gems/rocks that should have " stone" appended to their names */
export function GemStone(typ) { return +(typ == FLINT
     || (objects[typ].oc_material == GEMSTONE
         && (typ != DILITHIUM_CRYSTAL && typ != RUBY && typ != DIAMOND
             && typ != SAPPHIRE && typ != BLACK_OPAL && typ != EMERALD
             && typ != OPAL))); }

const Japanese_items = static_array("Japanese_items", struct_Jitem, null, [
    { item: SHORT_SWORD, name: _("wakizashi") },
    { item: BROADSWORD, name: _("ninja-to") },
    { item: FLAIL, name: _("nunchaku") },
    { item: GLAIVE, name: _("naginata") },
    { item: LOCK_PICK, name: _("osaku") },
    { item: WOODEN_HARP, name: _("koto") },
    { item: MAGIC_HARP, name: _("magic koto") },
    { item: KNIFE, name: _("shito") },
    { item: PLATE_MAIL, name: _("tanko") },
    { item: HELMET, name: _("kabuto") },
    { item: LEATHER_GLOVES, name: _("yugake") },
    { item: FOOD_RATION, name: _("gunyoki") },
    { item: POT_BOOZE, name: _("sake") },
    { item: 0, name: _("") }
]);

function strprepend(s, pref) { /* char * */
    let star_s = chars[s];
    let i = int(strlen(pref));

    if (i > PREFIX) {
        impossible(_("PREFIX too short (for %d)."), i);
        return s;
    }
    copynchars(s - i, pref, i + 1);
    chars[s] = star_s;
    return s - i;
}

/* manage a pool of BUFSZ buffers, so callers don't have to */
const obufs = static_array("obufs", array_of(char, BUFSZ), NUMOBUF);
const obufidx = static_var("obufidx", int, 0);

function nextobuf() { /* char * */
    obufidx[0] = (obufidx[0] + 1) % NUMOBUF;
    return obufs[obufidx[0]];
}

/* put the most recently allocated buffer back if possible */
function releaseobuf(bufp) { /* void */
    /* caller may not know whether bufp is the most recently allocated
       buffer; if it isn't, do nothing; note that because of the somewhat
       obscure PREFIX handling for object name formatting by xname(),
       the pointer our caller has and is passing to us might be into the
       middle of an obuf rather than the address returned by nextobuf() */
    if (bufp >= obufs[obufidx[0]]
        && bufp < obufs[obufidx[0]] + sizeof(array_of(char, BUFSZ))) /* obufs[][BUFSZ] */
        obufidx[0] = (obufidx[0] - 1 + NUMOBUF) % NUMOBUF;
}

/* used by display_pickinv (invent.c, main whole-inventory routine) to
   release each successive doname() result in order to try to avoid
   clobbering all the obufs when 'perm_invent' is enabled and updated
   while one or more obufs have been allocated but not released yet */
export function maybereleaseobuf(obuffer) { /* void */
    releaseobuf(obuffer);

    /*
     * An example from 3.6.x where all obufs got clobbered was when a
     * monster used a bullwhip to disarm the hero of a two-handed weapon:
     * "The ogre lord yanks Cleaver from your corpses!"
     |
     | hand = body_part(HAND);
     | if (use_plural)      // switches 'hand' from static buffer to an obuf
     |   hand = makeplural(hand);
      ...
     | release_worn_item(); // triggers full inventory update for perm_invent
      ...
     | pline(..., hand);    // the obuf[] for "hands" was clobbered with the
     |                      //+ partial formatting of an item from invent
     *
     * Another example was from writing a scroll without room in invent to
     * hold it after being split from a stack of blank scrolls:
     * "Oops!  food rations out of your grasp!"
     * hold_another_object() was passed 'the(aobjnam(newscroll, "slip"))'
     * as an argument and that should have yielded
     * "Oops!  The scroll of <foo> slips out of your grasp!"
     * but attempting to add the item to inventory triggered update for
     * perm_invent and the result from 'the(...)' was clobbered by partial
     * formatting of some inventory item.  [It happened in a shop and the
     * shk claimed ownership of the new scroll, but that wasn't relevant.]
     * That got fixed earlier, by delaying update_inventory() during
     * hold_another_object() rather than by avoiding using all the obufs.
     */
}

export function obj_typename(otyp) { /* char * */
    let buf = nextobuf();
    let ocl = objects[otyp];
    let actualn = OBJ_NAME(ocl);
    let dn = OBJ_DESCR(ocl);
    let un = ocl.oc_uname;
    let nn = ocl.oc_name_known;

    if (Role_if(PM_SAMURAI)) {
        actualn = Japanese_item_name(otyp, actualn);
        if (otyp == WOODEN_HARP || otyp == MAGIC_HARP)
            dn = _("koto");
    }
    /* generic items don't have an actual-name; we shouldn't ever be called
       for those; pacify static analyzer without resorting to impossible() */
    if (!actualn)
        actualn = (otyp > 0 && otyp < MAXOCLASSES) ? _("generic") : _("object?");

    chars[buf + 0] = ord('\0'); /* redundant */
    switch (ocl.oc_class) {
    case COIN_CLASS:
        return strcpy(buf, actualn); /* "gold piece" */
    case POTION_CLASS:
        strcpy(buf, _("potion"));
        break;
    case SCROLL_CLASS:
        strcpy(buf, _("scroll"));
        break;
    case WAND_CLASS:
        strcpy(buf, _("wand"));
        break;
    case SPBOOK_CLASS:
        if (otyp != SPE_NOVEL) {
            strcpy(buf, _("spellbook"));
        } else {
            strcpy(buf, !nn ? _("book") : _("novel"));
            nn = 0;
        }
        break;
    case RING_CLASS:
        strcpy(buf, _("ring"));
        break;
    case AMULET_CLASS:
        if (nn)
            strcpy(buf, actualn);
        else
            strcpy(buf, _("amulet"));
        if (un)
            xcalled(buf, BUFSZ - (dn ? int(strlen(dn)) + 3 : 0), _(""), un);
        if (dn)
            sprintf(eos(buf), _(" (%s)"), dn);
        return buf;
    case ARMOR_CLASS:
        if (objects[otyp].oc_subtyp == ARM_GLOVES
            || objects[otyp].oc_subtyp == ARM_BOOTS)
            strcpy(buf, _("pair of "));
        else if (otyp >= GRAY_DRAGON_SCALES && otyp <= YELLOW_DRAGON_SCALES)
            strcpy(buf, _("set of "));
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    default:
        if (nn) {
            strcat(buf, actualn);
            if (GemStone(otyp))
                strcat(buf, _(" stone"));
            if (un) /* 3: length of " (" + ")" which will enclose 'dn' */
                xcalled(buf, BUFSZ - (dn ? int(strlen(dn)) + 3 : 0), _(""), un);
            if (dn)
                sprintf(eos(buf), _(" (%s)"), dn);
        } else {
            strcat(buf, dn ? dn : actualn);
            if (ocl.oc_class == GEM_CLASS)
                strcat(buf, (ocl.oc_material == MINERAL) ? _(" stone") : _(" gem"))
;
            if (un)
                xcalled(buf, BUFSZ, _(""), un);
        }
        return buf;
    }
    /* here for ring/scroll/potion/wand */
    if (nn) {
        if (ocl.oc_unique)
            strcpy(buf, actualn); /* avoid spellbook of Book of the Dead */
        else
            sprintf(eos(buf), _(" of %s"), actualn);
    }
    if (un) /* 3: length of " (" + ")" which will enclose 'dn' */
        xcalled(buf, BUFSZ - (dn ? int(strlen(dn)) + 3 : 0), _(""), un);
    if (dn)
        sprintf(eos(buf), _(" (%s)"), dn);
    return buf;
}

/* less verbose result than obj_typename(); either the actual name
   or the description (but not both); user-assigned name is ignored */
export function simple_typename(otyp) { /* char * */
    let bufp, pp, save_uname = objects[otyp].oc_uname;

    objects[otyp].oc_uname = 0; /* suppress any name given by user */
    bufp = obj_typename(otyp);
    objects[otyp].oc_uname = save_uname;
    if ((pp = strstri(bufp, _(" ("))) != 0)
        chars[pp] = ord('\0'); /* strip the appended description */
    return bufp;
}

/* typename for debugging feedback where data involved might be suspect */
export function safe_typename(otyp) { /* char * */
    let save_nameknown;
    let res = 0;

    if (otyp < STRANGE_OBJECT || otyp >= NUM_OBJECTS
        || !OBJ_NAME(objects[otyp])) {
        res = nextobuf();
        sprintf(res, _("glorkum[%d]"), otyp);
        impossible(_("safe_typename: %s"), res);
    } else {
        /* force it to be treated as fully discovered */
        save_nameknown = objects[otyp].oc_name_known;
        objects[otyp].oc_name_known = 1;
        res = simple_typename(otyp);
        objects[otyp].oc_name_known = save_nameknown;
    }
    return res;
}

export function obj_is_pname(obj) { /* boolean */
    if (!obj.oartifact || !has_oname(obj))
        return FALSE;
    if (!program_state.gameover && !iflags.override_ID) {
        if (not_fully_identified(obj))
            return FALSE;
    }
    return TRUE;
}

/* Give the name of an object seen at a distance.  Unlike xname/doname,
   we usually don't want to set dknown if it's not set already. */
export function distant_name(
    obj,
    func) { /* char * */ /* formatting routine (usually xname or doname) */
    const $frame = stack_frame(); try {
    let str;
    let save_oid;
    let ox = stack_var(coordxy, 0), oy = stack_var(coordxy, 0);
        /*
         * (r * r): square of the x or y distance;
         * (r * r) * 2: sum of squares of both x and y distances
         * (r * r) * 2 - r: instead of a square extending from the hero,
         * round the corners (so shorter distance imposed for diagonal).
         *
         * distu() matrix covering a range of 3+ for one quadrant:
         *  16 17  -  -  -
         *   9 10 13 18  -
         *   4  5  8 13  -
         *   1  2  5 10 17
         *   @  1  4  9 16
         * Theoretical r==1 would yield 1.
         * r==2 yields 6, functionally equivalent to 5, a knight's jump,
         * r==3, the xray range of the Eyes of the Overworld, yields 15.
         */
    let r = (u.xray_range > 2) ? u.xray_range : 2,
        neardist = (r * r) * 2 - r; /* same as r*r + r*(r-1) */

   /* setting o_id to 0 prevents xname() from adding T-shirt or apron
      slogan, Hawaiian shirt motif, or candy wrapper label when called
      with 'program_state.gameover' set; we want this suppression for
      html-dump (not implemented in nethack) to prevent object-on-map
      tooltips from including that extra text; also guards against a
      potential change to minimal_xname() [indirectly used by attribute
      disclosure] that propagates o_id rather than leave it 0, and
      against a potential extra chance to browse the map with getpos()
      during final disclosure (not currently implemented, nor planned) */
    save_oid = obj.o_id;
    if (program_state.gameover)
        obj.o_id = 0;

    /* this maybe-nearby part used to be replicated in multiple callers */
    if (get_obj_location(obj, ox, oy, 0) && cansee(ox[0], oy[0])
        && (obj.oartifact || distu(ox[0], oy[0]) <= neardist)) {
        /* side-effects:  treat as having been seen up close;
           cansee() is True hence hero isn't Blind so if 'func' is
           the usual doname or xname, obj->dknown will become set
           and then for an artifact, find_artifact() will be called */
        str = func(obj);
    } else {
        /* prior to 3.6.1, this used to save current blindness state,
           explicitly set state to hero-is-blind, make the call (which
           won't set obj->dknown when blind), then restore the saved
           value; but the Eyes of the Overworld override blindness and
           would let characters wearing them get obj->dknown set for
           distant items, so the external flag was added */
        ++gd.distantname;
        str = func(obj);
        --gd.distantname;
    }

    obj.o_id = save_oid; /* reset to normal */

    return str;
    } finally { stack_pop($frame); }
}

/* convert player specified fruit name into corresponding fruit juice name
   ("slice of pizza" -> "pizza juice" rather than "slice of pizza juice") */
export function fruitname(
    juice) { /* char * */ /* whether or not to append " juice" to the name */
    let buf = nextobuf();
    let fruit_nam = strstri(svp.pl_fruit, _(" of "));

    if (fruit_nam)
        fruit_nam += 4; /* skip past " of " */
    else
        fruit_nam = svp.pl_fruit; /* use it as is */

    sprintf(buf, _("%s%s"), makesingular(fruit_nam), juice ? _(" juice") : _(""));
    return buf;
}

/* look up a named fruit by index (1..127) */
export function fruit_from_indx(indx) { /* struct fruit * */
    let f;

    for (f = gf.ffruit; f; f = f.nextf)
        if (f.fid == indx)
            break;
    return f;
}

/* look up a named fruit by name */
export function fruit_from_name(
    fname,
    exact,
    highest_fid) { /* struct fruit * */ /* optional output; only valid if 'fname' isn't found */
    const $frame = stack_frame(); try {
    let f, tentativef;
    let altfname;
    let k;
    /*
     * note: named fruits are case-sensitive...
     */

    if (highest_fid)
        highest_fid[0] = 0;
    /* first try for an exact match */
    for (f = gf.ffruit; f; f = f.nextf)
        if (!strcmp(f.fname, fname))
            return f;
        else if (highest_fid && f.fid > highest_fid[0])
            highest_fid[0] = f.fid;

    /* didn't match as-is; if caller is willing to accept a prefix
       match, try to find one; we want to find the longest prefix that
       matches, not the first */
    if (!exact) {
        tentativef = null;
        for (f = gf.ffruit; f; f = f.nextf) {
            k = Strlen(f.fname);
            if (!strncmp(f.fname, fname, k)
                && (!chars[fname + k] || chars[fname + k] == ord(' '))
                && (!tentativef || k > strlen(tentativef.fname)))
                tentativef = f;
        }
        f = tentativef;
    }
    /* if we still don't have a match, try singularizing the target;
       for exact match, that's trivial, but for prefix, it's hard */
    if (!f) {
        altfname = makesingular(fname);
        for (f = gf.ffruit; f; f = f.nextf) {
            if (!strcmp(f.fname, altfname))
                break;
        }
        releaseobuf(altfname);
    }
    if (!f && !exact) {
        let fnamebuf = stack_array(char, BUFSZ), p;
        let fname_k = Strlen(fname); /* length of assumed plural fname */

        tentativef = null;
        for (f = gf.ffruit; f; f = f.nextf) {
            k = Strlen(f.fname);
            /* reload fnamebuf[] each iteration in case it gets modified;
               there's no need to recalculate fname_k */
            strcpy(fnamebuf, fname);
            /* bug? if singular of fname is longer than plural,
               failing the 'fname_k > k' test could skip a viable
               candidate; unfortunately, we can't singularize until
               after stripping off trailing stuff and we can't get
               accurate fname_k until fname has been singularized;
               compromise and use 'fname_k >= k' instead of '>',
               accepting 1 char length discrepancy without risking
               false match (I hope...) */
            if (fname_k >= k && (p = strchr(fnamebuf + k, ord(' '))) != 0) {
                chars[p] = ord('\0'); /* truncate at 1st space past length of f->fname */
                altfname = makesingular(fnamebuf);
                k = Strlen(altfname); /* actually revised 'fname_k' */
                if (!strcmp(f.fname, altfname)
                    && (!tentativef || k > strlen(tentativef.fname)))
                    tentativef = f;
                releaseobuf(altfname); /* avoid churning through all obufs */
            }
        }
        f = tentativef;
    }
    return f;
    } finally { stack_pop($frame); }
}

/* sort the named-fruit linked list by fruit index number */
export function reorder_fruit(forward) { /* void */
    const $frame = stack_frame(); try {
    let f, allfr = stack_array(ptr_to(struct_fruit), 1 + 127);
    let i, j, k = SIZE(allfr);

    for (i = 0; i < k; ++i)
        allfr[i] = null;
    for (f = gf.ffruit; f; f = f.nextf) {
        /* without sanity checking, this would reduce to 'allfr[f->fid]=f' */
        j = f.fid;
        if (j < 1 || j >= k) {
            impossible(_("reorder_fruit: fruit index (%d) out of range"), j);
            return; /* don't sort after all; should never happen... */
        } else if (allfr[j]) {
            impossible(_("reorder_fruit: duplicate fruit index (%d)"), j);
            return;
        }
        allfr[j] = f;
    }
    gf.ffruit = null; /* reset linked list; we're rebuilding it from scratch */
    /* slot [0] will always be empty; must start 'i' at 1 to avoid
       [k - i] being out of bounds during first iteration */
    for (i = 1; i < k; ++i) {
        /* for forward ordering, go through indices from high to low;
           for backward ordering, go from low to high */
        j = forward ? (k - i) : i;
        if (allfr[j]) {
            allfr[j].nextf = gf.ffruit;
            gf.ffruit = allfr[j];
        }
    }
    } finally { stack_pop($frame); }
}

/* add "<pfx> called <sfx>" to end of buf, truncating if necessary */
function xcalled(
    buf,
    siz,
    pfx,
    sfx) { /* void */ /* user assigned type name */
    let bufsiz = siz - 1 - int(strlen(buf)),
        pfxlen = int(unsigned(unsigned(strlen(pfx) + sizeof_string(" called ")) - sizeof_string("")));

    if (pfxlen > bufsiz)
        panic(_("xcalled: not enough room for prefix (%d > %d)"),
              pfxlen, bufsiz);

    sprintf(eos(buf), _("%s called %.*s"), pfx, bufsiz - pfxlen, sfx);
}

export function xname(obj) { /* char * */
    return xname_flags(obj, CXN_NORMAL);
}

function xname_flags(
    obj,
    cxn_flags) { /* char * */ /* bitmask of CXN_xxx values */
    const $frame = stack_frame(); try {
    let $goto = null; var anbuf = stack_array(char, 10), anbuf = stack_array(char, 10), tmpbuf = stack_array(char, BUFSZ), xname_full = static_var("xname_flags.xname_full", int, 0);
    var buf;
    var obufp, buf_end, buf_eos;
    var bufspaceleft;
    var typ = obj.otyp;
    var ocl = objects[typ];
    var nn = ocl.oc_name_known, omndx = obj.corpsenm;
    var actualn = OBJ_NAME(ocl);
    var dn = OBJ_DESCR(ocl);
    var un = ocl.oc_uname;
    var pluralize = +((obj.quan != 1) && !(cxn_flags & CXN_SINGULAR));
    var known, dknown, bknown;

    gx.xnamep = nextobuf();
    /* set up primary work buffer; the first 'PREFIX' bytes are set
       aside for use by doname() */
    buf = gx.xnamep + PREFIX; /* leave room for "17 -3 " */
    buf_end = gx.xnamep + BUFSZ - 1; /* last byte within the obuf[] */
    chars[buf + 0] = ord('\0');
    (buf_eos = eos(buf), bufspaceleft = unsigned((buf_end - buf_eos))); /* set buf_eos and bufspaceleft */

    if (Role_if(PM_SAMURAI)) {
        actualn = Japanese_item_name(typ, actualn);
        if (typ == WOODEN_HARP || typ == MAGIC_HARP)
            dn = _("koto");
    }
    /* generic items don't have an actual-name; we shouldn't ever be called
       for those; pacify static analyzer without resorting to impossible() */
    if (!actualn)
        actualn = (typ > 0 && typ < MAXOCLASSES) ? _("generic") : _("object?");
    /* 3.6.2: this used to be part of 'dn's initialization, but it
       needs to come after possibly overriding 'actualn' */
    if (!dn)
        dn = actualn;

    /*
     * clean up known when it's tied to oc_name_known, eg after AD_DRIN
     * This is only required for unique objects since the article
     * printed for the object is tied to the combination of the two
     * and printing the wrong article gives away information.
     */
    if (!nn && ocl.oc_uses_known && ocl.oc_unique)
        obj.known = 0;
    if (!Blind() && !gd.distantname)
        observe_object(obj);
    if (Role_if(PM_CLERIC))
        obj.bknown = 1; /* avoid set_bknown() to bypass update_inventory() */

    if (iflags.override_ID) {
        known = dknown = bknown = TRUE;
        nn = 1;
    } else {
        known = obj.known;
        dknown = obj.dknown;
        bknown = obj.bknown;
    }

    /*
     * Maybe find a previously unseen artifact.
     *
     * Assumption 1: if an artifact object is being formatted, it is
     *  being shown to the hero (on floor, or looking into container,
     *  or probing a monster, or seeing a monster wield it).
     * Assumption 2: if in a pile that has been stepped on, the
     *  artifact won't be noticed for cases where the pile to too deep
     *  to be auto-shown, unless the player explicitly looks at that
     *  spot (via ':').  Might need to make an exception somehow (at
     *  the point where the decision whether to auto-show gets made?)
     *  when an artifact is on the top of the pile.
     * Assumption 3: since this is used for livelog events, not being
     *  100% correct won't negatively affect the player's current game.
     *
     * We use the real obj->dknown rather than the override_ID variant
     * so that wizard-mode ^I doesn't cause a not-yet-seen artifact in
     * inventory (picked up while blind, still blind) to become found.
     */
    if (obj.oartifact && obj.dknown)
        find_artifact(obj);

    $goto_nameit: for (;;) { switch ($goto) { default: if (obj_is_pname(obj))
        { $goto = "nameit"; continue $goto_nameit; };

    /* Some classes use strcpy(buf, something)+strcat(buf, otherthing).
       In those cases, ConcUpdate() is needed in between if Concat()
       will be used for the strcat() part.  Other classes just use
       strcpy(buf, something) and the ConcUpdate() can be deferred
       until after the switch. */
    switch (obj.oclass) {
    case AMULET_CLASS:
        if (!dknown)
            strcpy(buf, _("amulet"));
        else if (typ == AMULET_OF_YENDOR || typ == FAKE_AMULET_OF_YENDOR)
            /* each must be identified individually */
            strcpy(buf, known ? actualn : dn);
        else if (nn)
            strcpy(buf, actualn);
        else if (un)
            xcalled(buf, BUFSZ - PREFIX, _("amulet"), un);
        else
            sprintf(buf, _("%s amulet"), dn);
        break;
    case WEAPON_CLASS:
        if (is_poisonable(obj) && obj.otrapped)
            strcpy(buf, _("poisoned "));
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case VENOM_CLASS:
    case TOOL_CLASS:
        /* note: lenses or towel prefix would overwrite poisoned weapon
           prefix if both were simultaneously possible, but they aren't */
        if (typ == LENSES)
            strcpy(buf, _("pair of "));
        else if (is_wet_towel(obj))
            strcpy(buf, (obj.spe < 3) ? _("moist ") : _("wet "));

        if (!dknown)
            strcat(buf, dn);
        else if (nn)
            strcat(buf, actualn);
        else if (un)
            xcalled(buf, BUFSZ - PREFIX, dn, un);
        else
            strcat(buf, dn);
        (buf_eos = eos(buf), bufspaceleft = unsigned((buf_end - buf_eos)));

        if (typ == FIGURINE && omndx != NON_PM) {
             /* [4] would be enough: 'a','n',' ','\0' */
            var pm_name = obj_pmname(obj);

            do { Snprintf((buf_eos - 0), (bufspaceleft + 0), _(" of %s%s"), just_an(anbuf, pm_name), pm_name); (buf_eos = eos(buf), bufspaceleft = unsigned((buf_end - buf_eos))); } while (0);
        } else if (is_wet_towel(obj)) {
            if (wizard())
                do { Snprintf((buf_eos - 0), (bufspaceleft + 0), _(" (%d)"), obj.spe); (buf_eos = eos(buf), bufspaceleft = unsigned((buf_end - buf_eos))); } while (0);
        }
        break;
    case ARMOR_CLASS:
        /* depends on order of the dragon scales objects */
        if (typ >= GRAY_DRAGON_SCALES && typ <= YELLOW_DRAGON_SCALES) {
            sprintf(buf, _("set of %s"), actualn);
            break;
        } else if (is_boots(obj) || is_gloves(obj)) {
            strcpy(buf, _("pair of "));
            /*FALLTHRU*/
        } else if (is_shield(obj) && !dknown) {
            if (obj.otyp >= ELVEN_SHIELD && obj.otyp <= ORCISH_SHIELD) {
                strcpy(buf, _("shield"));
                break;
            } else if (obj.otyp == SHIELD_OF_REFLECTION) {
                strcpy(buf, _("smooth shield"));
                break;
            }
        }
        (buf_eos = eos(buf), bufspaceleft = unsigned((buf_end - buf_eos)));

        if (nn)
            do { Strncat((buf_eos - 0), actualn, (bufspaceleft + 0)); (buf_eos = eos(buf), bufspaceleft = unsigned((buf_end - buf_eos))); } while (0);
        else if (un)
            xcalled(buf, BUFSZ - PREFIX, armor_simple_name(obj), un);
        else
            do { Strncat((buf_eos - 0), dn, (bufspaceleft + 0)); (buf_eos = eos(buf), bufspaceleft = unsigned((buf_end - buf_eos))); } while (0);
        break;
    case FOOD_CLASS:
        /* we could include partly-eaten-hack on fruit but don't need to */
        if (typ == SLIME_MOLD) {
            var f = fruit_from_indx(obj.spe);

            if (!f) {
                impossible(_("Bad fruit #%d?"), obj.spe);
                strcpy(buf, _("fruit"));
            } else {
                /* fruit name is limited in length to PL_FSIZ; converting
                   to/from singular/plural might increase the length a
                   little but not enough to pose a risk of overflowing buf */
                strcpy(buf, f.fname);
                if (pluralize) {
                    /* ick: already pluralized fruit names are allowed--we
                       want to try to avoid adding a redundant plural suffix;
                       double ick: makesingular() and makeplural() each use
                       and return an obuf but we don't want any particular
                       xname() call to consume more than one of those
                       [note: makeXXX() will be fully evaluated and done with
                       'buf' before strcpy() touches its output buffer] */
                    strcpy(buf, obufp = makesingular(buf));
                    releaseobuf(obufp);
                    strcpy(buf, obufp = makeplural(buf));
                    releaseobuf(obufp);

                    pluralize = FALSE;
                }
            }
            break;
        }
        if (iflags.partly_eaten_hack && obj.oeaten) {
            /* normally "partly eaten" is supplied by doname() when
               appropriate and omitted by xname(); shrink_glob() wants
               it but uses Yname2() -> yname() -> xname() rather than
               doname() so we've added an external flag to request it */
            do { Strncat((buf_eos - 0), _("partly eaten "), (bufspaceleft + 0)); (buf_eos = eos(buf), bufspaceleft = unsigned((buf_end - buf_eos))); } while (0);
        }
        if (obj.globby) { /* 5.0 added "medium" to replace no-prefix */
            do { Snprintf((buf_eos - 0), (bufspaceleft + 0), _("%s %s"), (obj.owt <= 100) ? _("small")
                                      : (obj.owt <= 300) ? _("medium")
                                        : (obj.owt <= 500) ? _("large")
                                          : _("very large"), actualn); (buf_eos = eos(buf), bufspaceleft = unsigned((buf_end - buf_eos))); } while (0)
;
            break;
        }

        do { Strncat((buf_eos - 0), actualn, (bufspaceleft + 0)); (buf_eos = eos(buf), bufspaceleft = unsigned((buf_end - buf_eos))); } while (0);
        if (typ == TIN && known)
            tin_details(obj, omndx, buf);
        break;
    case COIN_CLASS:
    case CHAIN_CLASS:
        strcpy(buf, actualn);
        break;
    case ROCK_CLASS:
        if (typ == STATUE && omndx != NON_PM) {
            var statue_pmname = obj_pmname(obj);

            Snprintf(buf, bufspaceleft, _("%s%s of %s%s"), (Role_if(PM_ARCHEOLOGIST)
                      && (obj.spe & CORPSTAT_HISTORIC) != 0) ? _("historic ")
                       : _(""), actualn, type_is_pname(mons[omndx]) ? _("")
                       : the_unique_pm(mons[omndx]) ? _("the ")
                         : just_an(anbuf, statue_pmname), statue_pmname)

;
        } else if (typ == BOULDER && obj.corpsenm == 1) {
            /* sometimes caller wants "next boulder" rather than just
               "boulder" (when pushing against a pile of more than one);
               originally we just tested for non-0 but checking for 1 is
               more robust because the default value for that overloaded
               field (obj->corpsenm) is NON_PM (-1) rather than 0 */
            strcat(strcpy(buf, _("next ")), actualn); /* "next boulder" */
            /* once "next boulder" occurs, subsequent messages should just
               use ordinary "boulder" */
            obj.corpsenm = 0;
        } else {
            strcpy(buf, actualn); /* "boulder" or "statue" */
        }
        break;
    case BALL_CLASS:
        sprintf(buf, _("%sheavy iron ball"), (obj.owt > ocl.oc_weight) ? _("very ") : _(""))
;
        break;
    case POTION_CLASS:
        if (dknown && obj.oeroded)
            strcpy(buf, _("diluted "));
        if (nn || un || !dknown) {
            strcat(buf, _("potion"));
            if (!dknown)
                break;
            if (nn) {
                strcat(buf, _(" of "));
                if (typ == POT_WATER && bknown
                    && (obj.blessed || obj.cursed)) {
                    strcat(buf, obj.blessed ? _("holy ") : _("unholy "));
                }
                strcat(buf, actualn);
            } else {
                xcalled(buf, BUFSZ - PREFIX, _(""), un);
            }
        } else {
            strcat(buf, dn);
            strcat(buf, _(" potion"));
        }
        break;
    case SCROLL_CLASS:
        strcpy(buf, _("scroll"));
        if (!dknown)
            break;
        if (nn) {
            strcat(buf, _(" of "));
            strcat(buf, actualn);
        } else if (un) {
            xcalled(buf, BUFSZ - PREFIX, _(""), un);
        } else if (ocl.oc_magic) {
            strcat(buf, _(" labeled "));
            strcat(buf, dn);
        } else {
            strcpy(buf, dn);
            strcat(buf, _(" scroll"));
        }
        break;
    case WAND_CLASS:
        if (!dknown)
            strcpy(buf, _("wand"));
        else if (nn)
            sprintf(buf, _("wand of %s"), actualn);
        else if (un)
            xcalled(buf, BUFSZ - PREFIX, _("wand"), un);
        else
            sprintf(buf, _("%s wand"), dn);
        break;
    case SPBOOK_CLASS:
        if (typ == SPE_NOVEL) { /* 3.6 tribute */
            if (!dknown)
                strcpy(buf, _("book"));
            else if (nn)
                strcpy(buf, actualn);
            else if (un)
                xcalled(buf, BUFSZ - PREFIX, _("novel"), un);
            else
                sprintf(buf, _("%s book"), dn);
            break;
            /* end of tribute */
        } else if (!dknown) {
            strcpy(buf, _("spellbook"));
        } else if (nn) {
            if (typ != SPE_BOOK_OF_THE_DEAD)
                strcpy(buf, _("spellbook of "));
            strcat(buf, actualn);
        } else if (un) {
            xcalled(buf, BUFSZ - PREFIX, _("spellbook"), un);
        } else
            sprintf(buf, _("%s spellbook"), dn);
        break;
    case RING_CLASS:
        if (!dknown)
            strcpy(buf, _("ring"));
        else if (nn)
            sprintf(buf, _("ring of %s"), actualn);
        else if (un)
            xcalled(buf, BUFSZ - PREFIX, _("ring"), un);
        else
            sprintf(buf, _("%s ring"), dn);
        break;
    case GEM_CLASS: {
        var rock = (ocl.oc_material == MINERAL) ? _("stone") : _("gem");

        if (!dknown) {
            strcpy(buf, rock);
        } else if (!nn) {
            if (un)
                xcalled(buf, BUFSZ - PREFIX, rock, un);
            else
                sprintf(buf, _("%s %s"), dn, rock);
        } else {
            strcpy(buf, actualn);
            if (GemStone(typ))
                strcat(buf, _(" stone"));
        }
        break;
    } /* gem */
    default:
        sprintf(buf, _("glorkum %d %d %d"), obj.oclass, typ, obj.spe);
        impossible(_("xname_flags: %s"), buf);
        break;
    } /* switch */

    /* check whether we've already gone out of bounds of the obuf[], prior
       to pluralization and end-of-game shirt and apron text */
    buf_eos = eos(buf);
    if (buf_eos > buf_end) {
        /* PREFIX is bigger than 6 so there will always be room within the
           obuf[] in front of buf to insert "buf[]="; strncpy(,,N) doesn't
           add '\0' terminator unless fewer than N chars are copied, which
           is what we want, but gcc complains about that so use memcpy() */
        paniclog(_("xname"), memcpy(buf - 6, _("buf[]="), 6));
        panic(_("xname: buffer overflow before appending name."));
        /*NOTREACHED*/
    }
    bufspaceleft = unsigned((buf_end - buf_eos));

    /* if the name should be plural, do that now, after overflow check;
       it could make buf[] become shorter */
    if (pluralize) {
        obufp = makeplural(buf);
        chars[buf + 0] = ord('\0'); /* replace the whole string */
        (buf_eos = eos(buf), bufspaceleft = unsigned((buf_end - buf_eos))); /* reset buf_eos and bufspaceleft */
        do { Strncat((buf_eos - 0), obufp, (bufspaceleft + 0)); (buf_eos = eos(buf), bufspaceleft = unsigned((buf_end - buf_eos))); } while (0);
        releaseobuf(obufp);
    }

    /* give some extra information when game is over; for end-of-game
       attribute disclosure in wizard mode, ysimple_name() calls
       minimal_xname() which passes us a dummy object with o_id==0;
       tshirt_text(), apron_text(), and so forth base their result on
       o_id and would give inconsistent information compared to what
       just got shown for inventory disclosure; fortunately, we want to
       avoid the 'with text' part of
           "You were acid resistant because of your alchemy smock \
           with text \"Kiss the cook\"."
       when disclosing attributes anyway */
    if (program_state.gameover && obj.o_id && bufspaceleft > 0) {
        var lbl;

        /* disclose without breaking illiterate conduct, but mainly tip off
           players who aren't aware that something readable is present */
        switch (obj.otyp) {
        case T_SHIRT:
        case ALCHEMY_SMOCK:
            do { Snprintf((buf_eos - 0), (bufspaceleft + 0), _(" with text \"%s\""), (obj.otyp == T_SHIRT) ? tshirt_text(obj, tmpbuf)
                                            : apron_text(obj, tmpbuf)); (buf_eos = eos(buf), bufspaceleft = unsigned((buf_end - buf_eos))); } while (0)
;
            break;
        case CANDY_BAR:
            lbl = candy_wrapper_text(obj);
            if (chars[lbl])
                do { Snprintf((buf_eos - 0), (bufspaceleft + 0), _(" labeled \"%s\""), lbl); (buf_eos = eos(buf), bufspaceleft = unsigned((buf_end - buf_eos))); } while (0);
            break;
        case HAWAIIAN_SHIRT:
            do { Snprintf((buf_eos - 0), (bufspaceleft + 0), _(" with %s motif"), an(hawaiian_motif(obj, tmpbuf))); (buf_eos = eos(buf), bufspaceleft = unsigned((buf_end - buf_eos))); } while (0)
;
            break;
        default:
            break;
        }
    }

    case "nameit": if ($goto || (has_oname(obj) && dknown)) {
        switch ($goto) { default: do { Strncat((buf_eos - 0), _(" named "), (bufspaceleft + 0)); (buf_eos = eos(buf), bufspaceleft = unsigned((buf_end - buf_eos))); } while (0);

        /* jump directly here if obj passes the has-personal-name test */
 case "nameit": $goto = null;
        /*assert(has_oname(obj));*/
        obufp = eos(buf); } /* remember where the name will start */
        do { Strncat((buf_eos - 0), ONAME(obj), (bufspaceleft + 0)); (buf_eos = eos(buf), bufspaceleft = unsigned((buf_end - buf_eos))); } while (0);
        /* downcase "The" in "<quest-artifact-item> named The ..." */
        if (obj.oartifact && !strncmp(obufp, _("The "), 4))
            chars[obufp] = lowc(chars[obufp]); /* change 'T' in "The " to 't' */
    } } break; }

    if (!strncmpi(buf, _("the "), 4))
        buf += 4;

    buf_eos = eos(buf); /* pointer to '\0' terminator somewhere in obuf[] */
    if (buf_eos >= buf_end) { /* ('>' shouldn't be possible) */
        /* we want a record of something needing more buffer space than
           anticipated; since we aren't panicking here, this could happen
           repeatedly and we don't want to spam the paniclog file */
        if (!xname_full[0]++) {
            paniclog(_("xname"), memcpy(buf - 6, _("buf[]="), 6));
            /* 'PREFIX' ought to be 'PREFIX+4' if we stripped leading "the" */
            paniclog(_("xname"), _("used up entire obuf[PREFIX..BUFSX-1]"));
        }
    }

    return buf;
    } finally { stack_pop($frame); }
}

/* similar to simple_typename but minimal_xname operates on a particular
   object rather than its general type; it formats the most basic info:
     potion                     -- if description not known
     brown potion               -- if oc_name_known not set
     potion of object detection -- if discovered
 */
function minimal_xname(obj) { /* char * */
    const $frame = stack_frame(); try {
    let bufp;
    let bareobj = stack_struct(struct_obj);
    let saveobcls = stack_struct(struct_objclass);
    let otyp = obj.otyp;

    /* suppress user-supplied name */
    saveobcls.oc_uname = objects[otyp].oc_uname;
    objects[otyp].oc_uname = 0;
    /* suppress actual name if object's description is unknown */
    saveobcls.oc_name_known = objects[otyp].oc_name_known;
    if (iflags.override_ID)
        objects[otyp].oc_name_known = 1;
    else if (!obj.dknown)
        objects[otyp].oc_name_known = 0;

    /* caveat: this makes a lot of assumptions about which fields
       are required in order for xname() to yield a sensible result */
    struct_assign(bareobj, cg.zeroobj);
    bareobj.otyp = otyp;
    bareobj.oclass = obj.oclass;
    /* not observe_object, either the hero observed the object already or this
       is overriding ID and shouldn't discover the object */
    bareobj.dknown = (obj.dknown || iflags.override_ID) ? 1 : 0;
    /* suppress known except for amulets (needed for fakes and real A-of-Y) */
    bareobj.known = (obj.oclass == AMULET_CLASS)
                        ? obj.known
                        /* default is "on" for types which don't use it */
                        : +!objects[otyp].oc_uses_known;
    bareobj.quan = 1;         /* don't want plural */
    /* for a boulder, leave corpsenm as 0; non-zero produces "next boulder" */
    if (otyp != BOULDER)
        bareobj.corpsenm = NON_PM; /* suppress statue and figurine details */
    /* but suppressing fruit details leads to "bad fruit #0"
       [perhaps we should force "slime mold" rather than use xname?] */
    if (obj.otyp == SLIME_MOLD)
        bareobj.spe = obj.spe;

    bufp = distant_name(bareobj, xname);
    /* undo forced setting of bareobj.blessed for cleric (priest[ess]);
       bufp is an obuf[] so a pointer into the middle of that is viable */
    if (!strncmp(bufp, _("uncursed "), 9))
        bufp += 9;

    objects[otyp].oc_uname = saveobcls.oc_uname;
    objects[otyp].oc_name_known = saveobcls.oc_name_known;
    return bufp;
    } finally { stack_pop($frame); }
}

/* xname() output augmented for multishot missile feedback */
export function mshot_xname(obj) { /* char * */
    const $frame = stack_frame(); try {
    let tmpbuf = stack_array(char, BUFSZ);
    let onm = xname(obj);

    if (gm.m_shot.n > 1 && gm.m_shot.o == obj.otyp) {
        /* "the Nth arrow"; value will eventually be passed to an() or
           The(), both of which correctly handle this "the " prefix */
        sprintf(tmpbuf, _("the %d%s "), gm.m_shot.i, ordin(gm.m_shot.i));
        onm = strprepend(onm, tmpbuf);
    }
    return onm;
    } finally { stack_pop($frame); }
}

/* used for naming "the unique_item" instead of "a unique_item" */
export function the_unique_obj(obj) { /* boolean */
    let known = (obj.known || iflags.override_ID ? 1 : 0);

    if (!obj.dknown && !iflags.override_ID)
        return FALSE;
    else if (obj.otyp == FAKE_AMULET_OF_YENDOR && !known)
        return TRUE; /* lie */
    else
        return (objects[obj.otyp].oc_unique
                          && (known || obj.otyp == AMULET_OF_YENDOR) ? 1 : 0);
}

/* should monster type be prefixed with "the"? (mostly used for corpses) */
export function the_unique_pm(ptr) { /* boolean */
    let uniq;

    /* even though monsters with personal names are unique, we want to
       describe them as "Name" rather than "the Name" */
    if (type_is_pname(ptr))
        return FALSE;

    uniq = (ptr.geno & G_UNIQ) ? TRUE : FALSE;
    /* high priest is unique if it includes "of <deity>", otherwise not
       (caller needs to handle the 1st possibility; we assume the 2nd);
       worm tail should be irrelevant but is included for completeness */
    if (ptr == mons[PM_HIGH_CLERIC] || ptr == mons[PM_LONG_WORM_TAIL])
        uniq = FALSE;
    /* Wizard no longer needs this; he's flagged as unique these days */
    if (ptr == mons[PM_WIZARD_OF_YENDOR])
        uniq = TRUE;
    return uniq;
}

function add_erosion_words(obj, prefix) { /* void */
    let iscrys = +(obj.otyp == CRYSKNIFE);
    let rknown;

    rknown = (iflags.override_ID == 0) ? obj.rknown : TRUE;

    if (!is_damageable(obj) && !iscrys)
        return;

    /* The only cases where any of these bits do double duty are for
     * rotted food and diluted potions, which are all not is_damageable().
     */
    if (obj.oeroded && !iscrys) {
        switch (obj.oeroded) {
        case 2:
            strcat(prefix, _("very "));
            break;
        case 3:
            strcat(prefix, _("thoroughly "));
            break;
        }
        strcat(prefix, is_rustprone(obj) ? _("rusty ")
                       : is_crackable(obj) ? _("cracked ")
                         : _("burnt "));
    }
    if (obj.oeroded2 && !iscrys) {
        switch (obj.oeroded2) {
        case 2:
            strcat(prefix, _("very "));
            break;
        case 3:
            strcat(prefix, _("thoroughly "));
            break;
        }
        strcat(prefix, is_corrodeable(obj) ? _("corroded ") : _("rotted "));
    }
    /* note: it is possible for an item to be both eroded and erodeproof
       (cursed scroll of destroy armor read while confused erodeproofs an
       item of armor without repairing existing erosion) */
    if (rknown && obj.oerodeproof)
        strcat(prefix, iscrys ? _("fixed ")
                       : is_rustprone(obj) ? _("rustproof ")
                         : is_corrodeable(obj) ? _("corrodeproof ")
                           : is_flammable(obj) ? _("fireproof ")
                             : is_crackable(obj) ? _("tempered ") /* hardened */
                               : is_rottable(obj) ? _("rotproof ")
                                 : _(""));
}

/* used to prevent rust on items where rust makes no difference */
export function erosion_matters(obj) { /* boolean */
    switch (obj.oclass) {
    case TOOL_CLASS:
        /* it's possible for a rusty weptool to be polymorphed into some
           non-weptool iron tool, in which case the rust implicitly goes
           away, but it's also possible for it to be polymorphed into a
           non-iron tool, in which case rust also implicitly goes away,
           so there's no particular reason to try to handle the first
           instance differently [this comment belongs in poly_obj()...] */
        return is_weptool(obj) ? TRUE : FALSE;
    case WEAPON_CLASS:
    case ARMOR_CLASS:
    case BALL_CLASS:
    case CHAIN_CLASS:
        return TRUE;
    default:
        break;
    }
    return FALSE;
}

export const DONAME_WITH_PRICE = 1;
export const DONAME_VAGUE_QUAN = 2;
export const DONAME_FOR_MENU = 4;

/* core of doname() */
function doname_base(
    obj,
    doname_flags) { /* char * */ /* special case requests */
    const $frame = stack_frame(); try {
    let $goto = null; var prefix = stack_array(char, PREFIX), tmpbuf = stack_array(char, PREFIX + 1), bp_eos = stack_var(ptr_to(char)), suffix = stack_array(char, 20), timer = stack_struct(struct_any), handsbuf = stack_array(char, 40), pricebuf = stack_array(char, 40), nochrg = stack_var(int), pricebuf = stack_array(char, 40), doname_full = static_var("doname_base.doname_full", int, 0);
    var ispoisoned = FALSE,
            with_price = +((doname_flags & DONAME_WITH_PRICE) != 0),
            vague_quan = +((doname_flags & DONAME_VAGUE_QUAN) != 0),
            for_menu = +((doname_flags & DONAME_FOR_MENU) != 0);
    var known, dknown, cknown, bknown, lknown,
            fake_arti, force_the;

     /* for when we have to add something at
                              * the start of prefix instead of the
                              * end (Strcat is used on the end) */
    var aname = 0;
    var omndx = obj.corpsenm;
    var bp;
    var bp_end;
    var bpspaceleft;

    /* 'bp' will be within an obuf[] rather than at the start of one,
       usually (but not always) pointing at &obuf[PREFIX];
       gx.xnamep always points to the start of that buffer;
       'bp_eos' and 'bpspaceleft' are used and updated by Concat*() macros */
    bp = xname(obj);
    bp_end = gx.xnamep + BUFSZ - 1;
    bp_eos[0] = eos(bp);
    assert(bp_end >= bp_eos[0]); /* ok provided xname() bounds checking works */
    /* size_t cast: convert signed ptrdiff_t to unsigned size_t */
    bpspaceleft = unsigned((bp_end - bp_eos[0]));

    if (iflags.override_ID) {
        known = dknown = cknown = bknown = lknown = TRUE;
    } else {
        known = obj.known;
        dknown = obj.dknown;
        cknown = obj.cknown;
        bknown = obj.bknown;
        lknown = obj.lknown;
    }

    /* When using xname, we want "poisoned arrow", and when using
     * doname, we want "poisoned +0 arrow".  This kludge is about the only
     * way to do it, at least until someone overhauls xname() and doname(),
     * combining both into one function taking a parameter.
     */
    /* must check opoisoned--someone can have a weirdly-named fruit */
    if (!strncmp(bp, _("poisoned "), 9) && obj.otrapped) {
        bp += 9; /* doesn't affect bp_eos or bpspaceleft */
        ispoisoned = TRUE;
    }

    /* fruits are allowed to be given artifact names; when that happens,
       format the name like the corresponding artifact, which may or may not
       want "the" prefix and when it doesn't, avoid "a"/"an" prefix too */
    fake_arti = +(obj.otyp == SLIME_MOLD
                 && (aname = artifact_name(bp, null, FALSE)) != 0);
    force_the = (fake_arti && !strncmpi(aname, _("the "), 4) ? 1 : 0);

    chars[prefix + 0] = ord('\0');
    if (obj.quan != 1) {
        if (dknown || !vague_quan)
            sprintf(prefix, _("%lld "), obj.quan);
        else
            strcpy(prefix, _("some "));
    } else if (obj.otyp == CORPSE) {
        /* skip article prefix for corpses [else corpse_xname()
           would have to be taught how to strip it off again] */
        ;
    } else if (force_the || obj_is_pname(obj) || the_unique_obj(obj)) {
        if (!strncmpi(bp, _("the "), 4))
            bp += 4; /* doesn't affect bp_eos or bpspaceleft */
        strcpy(prefix, _("the "));
    } else if (!fake_arti) {
        /* default prefix */
        strcpy(prefix, _("a "));
    }

    /* "empty" goes at the beginning, but item count goes at the end */
    if (cknown
        /* bag of tricks: include "empty" prefix if it's known to
           be empty but its precise number of charges isn't known
           (when that is known, suffix of "(n:0)" will be appended,
           making the prefix be redundant; note that 'known' flag
           isn't set when emptiness gets discovered because then
           charging magic would yield known number of new charges);
           horn of plenty isn't a container but is close enough */
        && ((obj.otyp == BAG_OF_TRICKS || obj.otyp == HORN_OF_PLENTY)
             ? (obj.spe == 0 && !known)
             /* not a bag of tricks or horn of plenty: it's empty if
                it is a container that has no contents */
             : ((Is_container(obj) || obj.otyp == STATUE)
                && !Has_contents(obj))))
        strcat(prefix, _("empty "));

    if (bknown && obj.oclass != COIN_CLASS
        && (obj.otyp != POT_WATER || !objects[POT_WATER].oc_name_known
            || (!obj.cursed && !obj.blessed))) {
        /* allow 'blessed clear potion' if we don't know it's holy water;
         * always allow "uncursed potion of water"
         */
        if (obj.cursed)
            strcat(prefix, _("cursed "));
        else if (obj.blessed)
            strcat(prefix, _("blessed "));
        else if (!flags.implicit_uncursed
            /* For most items with charges or +/-, if you know how many
             * charges are left or what the +/- is, then you must have
             * totally identified the item, so "uncursed" is unnecessary,
             * because an identified object not described as "blessed" or
             * "cursed" must be uncursed.
             *
             * If the charges or +/- is not known, "uncursed" must be
             * printed to avoid ambiguity between an item whose curse
             * status is unknown, and an item known to be uncursed.
             */
                 || ((!known || !objects[obj.otyp].oc_charged
                      || obj.oclass == ARMOR_CLASS
                      || obj.oclass == RING_CLASS)

                     && obj.otyp != SCR_MAIL

                     && obj.otyp != FAKE_AMULET_OF_YENDOR
                     && obj.otyp != AMULET_OF_YENDOR
                     && !Role_if(PM_CLERIC)))
            strcat(prefix, _("uncursed "));
    }

    /* "a large trapped box" would perhaps be more correct; [no!]
       what about ``(obj->tknown && !obj->otrapped)''? shouldn't that
       yield "a non-trapped large box"? (not "an untrapped large box");
       TODO: this should be ``(Is_box(obj) || obj->otyp == TIN) && ...''
       but at present there's no way to set obj->tknown for tins */
    if (Is_box(obj) && obj.otrapped && obj.tknown && obj.dknown)
        strcat(prefix, _("trapped "));
    if (lknown && Is_box(obj)) {
        if (obj.obroken)
            /* 3.6.0 used "unlockable" here but that could be misunderstood
               to mean "capable of being unlocked" rather than the intended
               "not capable of being locked" */
            strcat(prefix, _("broken "));
        else if (obj.olocked)
            strcat(prefix, _("locked "));
        else
            strcat(prefix, _("unlocked "));
    }

    if (obj.greased)
        strcat(prefix, _("greased "));

    if (cknown && Has_contents(obj) && bpspaceleft > 0) {
        /* we count the number of separate stacks, which corresponds
           to the number of inventory slots needed to be able to take
           everything out if no merges occur */
        var itemcount = count_contents(obj, FALSE, FALSE, TRUE, FALSE);

        do { Snprintf((bp_eos[0] - 0), (bpspaceleft + 0), _(" containing %lld item%s"), itemcount, plur(itemcount)); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0);
    }

    $goto_charges: for (;;) { switch ($goto || (is_weptool(obj) ? WEAPON_CLASS : obj.oclass)) {
    case AMULET_CLASS:
        if (obj.owornmask & W_AMUL)
            do { Strncat((bp_eos[0] - 0), _(" (being worn)"), (bpspaceleft + 0)); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0);
        break;
    case ARMOR_CLASS:
        if (obj.owornmask & W_ARMOR) {
            do { Strncat((bp_eos[0] - 0), (obj == uskin) ? _(" (embedded in your skin)")
                   /* in case of perm_invent update while Wear/Takeoff
                      is in progress; check doffing() before donning()
                      because donning() returns True for both cases */
                   : doffing(obj) ? _(" (being doffed)")
                     : donning(obj) ? _(" (being donned)")
                       : _(" (being worn)"), (bpspaceleft + 0)); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0)
;
            /* we just added a parenthesized phrase, but the right paren
               might be absent if the appended string got truncated */
            if (chars[bp_eos[0] + (-1)] == ord(')')) {
                /* slippery fingers is an intrinsic condition of the hero
                   rather than extrinsic condition of objects, but gloves
                   are described as slippery when hero has slippery fingers */
                if (obj == uarmg && Glib()) /* just appended "(something)",
                                           * replace paren, changing that
                                           * to be "(something; slippery)" */
                    do { Strncat((bp_eos[0] - 1), _("; slippery)"), unsigned((bpspaceleft + 1))); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0);
            }
            if (chars[bp_eos[0] + (-1)] == ord(')')) {
                /* there could be light-emitting artifact gloves someday,
                   so add 'lit' separately from 'slippery' rather than via
                   'else if' after uarmg+Glib */
                if (!Blind() && obj.lamplit && artifact_light(obj))
                    do { Snprintf((bp_eos[0] - 1), unsigned((bpspaceleft + 1)), _(", %s lit)"), arti_light_description(obj)); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0);
            }
        }
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case WEAPON_CLASS:
        if (ispoisoned)
            strcat(prefix, _("poisoned "));
        add_erosion_words(obj, prefix);
        if (known) {
            sprintf(eos(prefix), _("%+d "), obj.spe); /* sitoa(obj->spe)+" " */
        }
        break;
    case TOOL_CLASS:
        if (obj.owornmask & (W_TOOL | W_SADDLE)) { /* blindfold */
            do { Strncat((bp_eos[0] - 0), _(" (being worn)"), (bpspaceleft + 0)); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0);
            break;
        }
        if (obj.otyp == LEASH && obj.corpsenm != 0) {
            var mlsh = find_mid(unsigned(obj.corpsenm), FM_FMON);

            if (mlsh && !DEADMONSTER(mlsh)) {
                do { Snprintf((bp_eos[0] - 0), (bpspaceleft + 0), _(" (attached to %s)"), noit_mon_nam(mlsh)); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0);
            } else {
                if (mlsh) /*&& DEADMONSTER(mlsh)*/
                    impossible(_("leashed %s #%u is dead"),
                               mon_pmname(mlsh), unsigned(obj.corpsenm));
                else
                    impossible(_("leashed monster #%u not found"),
                               unsigned(obj.corpsenm));
                obj.corpsenm = 0;
            }
            break;
        }
        if (obj.otyp == CANDELABRUM_OF_INVOCATION) {
             /* longest value is "s attached" */

            /* separately formatted suffix avoids need for ConcatF3() */
            sprintf(suffix, _("%s%s"), plur(obj.spe), !obj.lamplit ? _(" attached") : _(", lit"))
;
            do { Snprintf((bp_eos[0] - 0), (bpspaceleft + 0), _(" (%d of 7 candle%s)"), obj.spe, suffix); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0);
            break;
        } else if (obj.otyp == OIL_LAMP || obj.otyp == MAGIC_LAMP
                   || obj.otyp == BRASS_LANTERN || Is_candle(obj)) {
            if (Is_candle(obj)) {
                var full_burn_time = 20 * (objects[obj.otyp].oc_cost),
                     turns_left = obj.age;

                if (obj.lamplit) {
                    struct_assign(timer, cg.zeroany);
                    timer.a_obj = obj;
                    /* without this, wishing for "lit candle" yields
                       "partly used candle (lit)" because the time it can
                       burn gets adjusted when it becomes lit; matters for
                       the message as it gets added to invent and also if it
                       gets snuffed out immediately (where it will end up as
                       not partly used after all) */
                    turns_left += peek_timer(BURN_OBJECT, timer) - svm.moves;
                }
                if (turns_left < full_burn_time)
                    strcat(prefix, _("partly used "));
            }
            if (obj.lamplit)
                do { Strncat((bp_eos[0] - 0), _(" (lit)"), (bpspaceleft + 0)); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0);
            break;
        }
        if (objects[obj.otyp].oc_charged)
            { $goto = "charges"; continue $goto_charges; };
        break;
    case "charges": case WAND_CLASS:
 $goto = null;
        if (known)
            do { Snprintf((bp_eos[0] - 0), (bpspaceleft + 0), _(" (%d:%d)"), obj.recharged, obj.spe); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0);
        break;
    case POTION_CLASS:
        if (obj.otyp == POT_OIL && obj.lamplit)
            do { Strncat((bp_eos[0] - 0), _(" (lit)"), (bpspaceleft + 0)); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0);
        break;
    case "ring": case RING_CLASS:
 $goto = null;  /* normal rings reach here 'naturally'; meat ring jumps here */
        if (obj.owornmask & W_RINGR)
            do { Strncat((bp_eos[0] - 0), _(" (on right "), (bpspaceleft + 0)); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0);
        if (obj.owornmask & W_RINGL)
            do { Strncat((bp_eos[0] - 0), _(" (on left "), (bpspaceleft + 0)); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0);
        if (obj.owornmask & W_RING) /* either left or right */
            do { Snprintf((bp_eos[0] - 0), (bpspaceleft + 0), _("%s)"), body_part(HAND)); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0);
        if (known && objects[obj.otyp].oc_charged) {
            sprintf(eos(prefix), _("%+d "), obj.spe); /* sitoa(obj->spe)+" " */
        }
        break;
    case FOOD_CLASS:
        if (obj.oeaten)
            strcat(prefix, _("partly eaten "));
        if (obj.otyp == CORPSE) {
            /* (quan == 1) => want corpse_xname() to supply article,
               (quan != 1) => already have count or "some" as prefix;
               "corpse" is already in the buffer returned by xname() */
            var cxarg = (((obj.quan != 1) ? 0 : CXN_ARTICLE)
                              | CXN_NOCORPSE);
            var cxstr, save_xnamep;

            /* corpse_xname() sets xnamep; callers other than doname_base()
               itself shouldn't care about xnamep (pointer to start of
               current obuf[]) but keep it accurate anyway */
            save_xnamep = gx.xnamep;
            cxstr = corpse_xname(obj, prefix, cxarg);
            sprintf(prefix, _("%s "), cxstr);
            /* avoid having doname(corpse) consume an extra obuf */
            releaseobuf(cxstr);
            gx.xnamep = save_xnamep;
        } else if (obj.otyp == EGG) {
            if (ismnum(omndx)
                && (known || (svm.mvitals[omndx].mvflags & MV_KNOWS_EGG))) {
                strcat(prefix, mons[omndx].pmnames[NEUTRAL]);
                strcat(prefix, _(" "));
                if (obj.spe == 1)
                    do { Strncat((bp_eos[0] - 0), _(" (laid by you)"), (bpspaceleft + 0)); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0);
            }
        } else if (obj.otyp == MEAT_RING) {
            { $goto = "ring"; continue $goto_charges; }
        }
        break;
    case BALL_CLASS:
    case CHAIN_CLASS:
        add_erosion_words(obj, prefix);
        if (obj.owornmask & (W_BALL | W_CHAIN))
            do { Snprintf((bp_eos[0] - 0), (bpspaceleft + 0), _(" (%s to you)"), (obj.owornmask & W_BALL) ? _("chained") : _("attached")); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0)
;
        break;
    } break; }

    if ((obj.otyp == STATUE || obj.otyp == CORPSE || obj.otyp == FIGURINE)
        && wizard() && iflags.wizmgender) {
        var cgend = (obj.spe & CORPSTAT_GENDER),
            mgend = ((cgend == CORPSTAT_MALE) ? MALE
                     : (cgend == CORPSTAT_FEMALE) ? FEMALE
                       : NEUTRAL);

        do { Snprintf((bp_eos[0] - 0), (bpspaceleft + 0), _(" (%s)"), (cgend != CORPSTAT_RANDOM) ? genders[mgend].adj
                                            : _("unspecified gender")); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0)
;
    }

    if ((obj.owornmask & W_WEP) && !gm.mrg_to_wielded) {
        var twoweap_primary = (obj == uwep && u.twoweap ? 1 : 0),
                tethered = +(obj.otyp == AKLYS);

        /* use alternate phrasing for non-weapons and for wielded ammo
           (arrows, bolts), or missiles (darts, shuriken, boomerangs)
           except when those are being actively dual-wielded where the
           regular phrasing will list them as "in right hand" to
           contrast with secondary weapon's "in left hand" */
        if ((obj.quan != 1
             || ((obj.oclass == WEAPON_CLASS)
                 ? (is_ammo(obj) || is_missile(obj))
                 : !is_weptool(obj)))
            && !twoweap_primary) {
            do { Strncat((bp_eos[0] - 0), _(" (wielded)"), (bpspaceleft + 0)); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0);
        } else {
            var hand_s = body_part(HAND);
            var obufp;

            if (bimanual(obj)) { /* "hands" */
                hand_s = strcpy(handsbuf, obufp = makeplural(hand_s));
                releaseobuf(obufp);
            } else { /* "right hand" or "left hand" */
                sprintf(handsbuf, _("%s %s"), URIGHTY() ? _("right") : _("left"), hand_s)
;
                hand_s = handsbuf;
            }
            /* note: Sting's glow message, if added, will insert text
               in front of "(weapon in hand)"'s closing paren */
            do { Snprintf((bp_eos[0] - 0), (bpspaceleft + 0), _(" (%s %s)"), tethered ? _("tethered to")
                     : twoweap_primary ? _("wielded in")
                       : _("weapon in"), hand_s); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0)

;

            /* we just added a parenthesized phrase, but the right paren
               might be absent if the appended string got truncated */
            if (!Blind() && bpspaceleft && chars[bp_eos[0] + (-1)] == ord(')')) {
                if (gw.warn_obj_cnt && obj == uwep
                    && (EWarn_of_mon() & W_WEP) != 0)
                    /* we know bp[] ends with ')'; overwrite that */
                    do { Snprintf((bp_eos[0] - 1), unsigned((bpspaceleft + 1)), _(", %s %s)"), glow_verb(gw.warn_obj_cnt, TRUE), glow_color(obj.oartifact)); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0);
                else if (obj.lamplit && artifact_light(obj))
                    /* as above, overwrite known closing paren */
                    do { Snprintf((bp_eos[0] - 1), unsigned((bpspaceleft + 1)), _(", %s lit)"), arti_light_description(obj)); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0)

;
            }
        }
    }
    if (obj.owornmask & W_SWAPWEP) {
        if (u.twoweap)
            do { Snprintf((bp_eos[0] - 0), (bpspaceleft + 0), _(" (wielded in %s %s)"), URIGHTY() ? _("left") : _("right"), body_part(HAND)); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0);
        else
            /* TODO: rephrase this when obj isn't a weapon or weptool */
            do { Snprintf((bp_eos[0] - 0), (bpspaceleft + 0), _(" (alternate weapon%s; not wielded)"), plur(obj.quan)); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0)

;
    }
    if (obj.owornmask & W_QUIVER) {
        var Qtyp;

        switch (obj.oclass) {
        case WEAPON_CLASS:
            Qtyp = !is_ammo(obj) ? 3 /* not ammo: "at the ready" */
                   : (objects[obj.otyp].oc_subtyp != -P_BOW) ? 2 /* non-bow */
                     : 1; /* ammo for a bow: "in quiver" */
            break;
        case RING_CLASS:
        case AMULET_CLASS:
        case WAND_CLASS:
        case COIN_CLASS:
        case GEM_CLASS:
            Qtyp = 2; /* small, non-bow: "in quiver pouch" */
            break;
        default: /* odd things */
            Qtyp = 3; /* "at the ready" */
            break;
        }
        do { Snprintf((bp_eos[0] - 0), (bpspaceleft + 0), _(" (%s)"), (Qtyp == 1) ? _("in quiver")
                 : (Qtyp == 2) ? _("in quiver pouch")
                   : _("at the ready")); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0)
;
    }

    /* treat 'restoring' like suppress_price because shopkeeper and
       bill might not be available yet while restore is in progress
       (objects won't normally be formatted during that time, but if
       'perm_invent' is enabled then they might be [not any more...]) */
    if (iflags.suppress_price || program_state.restoring) {
        ; /* don't attempt to obtain any shop pricing, even if 'with_price' */
    } else if (is_unpaid(obj)) { /* in inventory or in container in invent */
        var quotedprice = unpaid_cost(obj, COST_CONTENTS);

        /* separately formatted suffix avoids need for ConcatF3() */
        sprintf(pricebuf, _("%lld %s"), quotedprice, currency(quotedprice));
        do { Snprintf((bp_eos[0] - 0), (bpspaceleft + 0), _(" (%s, %s)"), obj.unpaid ? _("unpaid") : _("contents"), pricebuf); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0)
;

        record_price_quote(obj.otyp, ulong(Math.trunc(quotedprice / obj.quan)), TRUE);
    } else if (with_price) { /* on floor or in container on floor */
        nochrg[0] = 0;
        var price = get_cost_of_shop_item(obj, nochrg);

        if (price > 0) {
            sprintf(pricebuf, _("%lld %s"), price, currency(price));
            do { Snprintf((bp_eos[0] - 0), (bpspaceleft + 0), _(" (%s, %s)"), nochrg[0] ? _("contents") : _("for sale"), pricebuf); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0)
;
        } else if (nochrg[0] > 0) {
            do { Strncat((bp_eos[0] - 0), _(" (no charge)"), (bpspaceleft + 0)); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0);
        } else if (iflags.pricequotes && !objects[obj.otyp].oc_name_known) {
            append_price_quote(bp, bp_eos, obj.otyp);
        }

        if (price > 0)
            record_price_quote(obj.otyp, ulong(Math.trunc(price / obj.quan)), TRUE);
    } else if (iflags.pricequotes && !objects[obj.otyp].oc_name_known) {
        append_price_quote(bp, bp_eos, obj.otyp);
    }

    if (!strncmp(prefix, _("a "), 2)) {
        /* save current prefix, without "a "; might be empty */
        strcpy(tmpbuf, prefix + 2);
        /* set prefix[] to "", "a ", or "an " */
        just_an(prefix, chars[tmpbuf] ? tmpbuf : bp);
        /* append remainder of original prefix */
        strcat(prefix, tmpbuf);
    }

    /* show weight for items (debug tourist info);
       "aum" is stolen from Crawl's "Arbitrary Unit of Measure" */
    if (wizard() && iflags.wizweight) {
        /* wizard mode user has asked to see object weights */
        if (with_price && chars[bp_eos[0] + (-1)] == ord(')'))
            do { Snprintf((bp_eos[0] - 1), unsigned((bpspaceleft + 1)), _(", %u aum)"), obj.owt); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0);
        else
            do { Snprintf((bp_eos[0] - 0), (bpspaceleft + 0), _(" (%u aum)"), obj.owt); (bp_eos[0] = eos(bp), bpspaceleft = unsigned((bp_end - bp_eos[0]))); } while (0);

        /* ConcatF1(bp) updates bp_eos and bpspaceleft but we're done
           with them now; add a fake use so compiler won't complain
           about a variable assignment that won't be subsequently used */
        (bp_eos[0]);
        (bpspaceleft);
    }

    bp = strprepend(bp, prefix);

    /*
     * Last gasp bounds check.
     *
     * If caller intends this to be for a menu entry, make sure that
     * there is some room to combine with menu selector prefix without
     * exceeding BUFSZ-1.
     *
     * offsetbp=4: width of menu entry selector text: "c - " for tty.
     * For curses, that wastes a char since it only needs 3: "c) ".
     *
     * Reaching full BUFSZ-1 length can't happen unless both doname
     * (BUFSZ-PREFIX) and strprepend (PREFIX) use up all available
     * space or one of them overflows without being detected.
     */
    if (strlen(bp) > BUFSZ - 1) {
        paniclog(_("doname"), bp);
        /* ideally this will never happen; if xnamep is any obuf[]
           other than the last, overflow here would be relatively
           benign and we could probably keep going */
        panic(_("doname: long object description overflow."));
        /*NOTREACHED*/
    } else {
        var offsetbp = for_menu ? 4 : 0;

        if (unsigned(strlen(bp) + unsigned(offsetbp)) >= BUFSZ - 1) {
            /* for !offsetbp, we'll only get here if strlen(bp)==BUFSZ-1 */
            if (!doname_full[0]++) {
                paniclog(_("doname"), bp);
                sprintf(tmpbuf, _("long object description%s."), offsetbp ? _(" truncated for menu use") : _(""))
;
                paniclog(_("doname"), tmpbuf);
            }
            chars[bp + (BUFSZ - 1 - offsetbp)] = ord('\0');
        }
    }

    return bp;
    } finally { stack_pop($frame); }
}

export function doname(obj) { /* char * */
    return doname_base(obj, 0);
}

/* Name of object including price. */
export function doname_with_price(obj) { /* char * */
    return doname_base(obj, DONAME_WITH_PRICE);
}

/* "some" instead of precise quantity if obj->dknown not set */
export function doname_vague_quan(obj) { /* char * */
    /* Used by farlook.
     * If it hasn't been seen up close and quantity is more than one,
     * use "some" instead of the quantity: "some gold pieces" rather
     * than "25 gold pieces".  This is suboptimal, to put it mildly,
     * because lookhere and pickup report the precise amount.
     * Picking the item up while blind also shows the precise amount
     * for inventory display, then dropping it while still blind leaves
     * obj->dknown unset so the count reverts to "some" for farlook.
     *
     * TODO: add obj->qknown flag for 'quantity known' on stackable
     * items; it could overlay obj->cknown since no containers stack.
     */
    return doname_base(obj, DONAME_VAGUE_QUAN);
}

/* used from invent.c */
export function not_fully_identified(otmp) { /* boolean */
    /* gold doesn't have any interesting attributes [yet?] */
    if (otmp.oclass == COIN_CLASS)
        return FALSE; /* always fully ID'd */
    /* check fundamental ID hallmarks first */
    if (!otmp.known || !otmp.dknown

        || (!otmp.bknown && otmp.otyp != SCR_MAIL)

        || !objects[otmp.otyp].oc_name_known)
        return TRUE;
    if ((!otmp.cknown && (Is_container(otmp) || otmp.otyp == STATUE))
        || (!otmp.lknown && Is_box(otmp)))
        return TRUE;
    if (otmp.oartifact && undiscovered_artifact(otmp.oartifact))
        return TRUE;
    /* otmp->rknown is the only item of interest if we reach here */
    /*
     *  Note:  if a revision ever allows scrolls to become fireproof or
     *  rings to become shockproof, this checking will need to be revised.
     *  `rknown' ID only matters if xname() will provide the info about it.
     */
    if (otmp.rknown
        || (otmp.oclass != ARMOR_CLASS && otmp.oclass != WEAPON_CLASS
            && !is_weptool(otmp)            /* (redundant) */
            && otmp.oclass != BALL_CLASS)) /* (useless) */
        return FALSE;
    else /* lack of `rknown' only matters for vulnerable objects */
        return is_damageable(otmp);
}

/* format a corpse name (xname() omits monster type; doname() calls us);
   eatcorpse() also uses us for death reason when eating tainted glob */
export function corpse_xname(
    otmp,
    adjective,
    cxn_flags) { /* char * */ /* bitmask of CXN_xxx values */
    let nambuf;
    let omndx = otmp.corpsenm;
    let ignore_quan = +((cxn_flags & CXN_SINGULAR) != 0),

        no_prefix = +((cxn_flags & CXN_NO_PFX) != 0),

        the_prefix = +((cxn_flags & CXN_PFX_THE) != 0),

        any_prefix = +((cxn_flags & CXN_ARTICLE) != 0),

        omit_corpse = +((cxn_flags & CXN_NOCORPSE) != 0),
        possessive = FALSE,
        glob = (otmp.otyp != CORPSE && otmp.globby ? 1 : 0);
    let mnam;

    /* some callers [aobjnam()] rely on prefix area that xname() sets aside */
    gx.xnamep = nextobuf();
    nambuf = gx.xnamep + PREFIX;

    if (glob) {
        mnam = OBJ_NAME(objects[otmp.otyp]); /* "glob of <monster>" */
    } else if (omndx == NON_PM) { /* paranoia */
        mnam = _("thing");
    } else {
        mnam = obj_pmname(otmp);
        if (the_unique_pm(mons[omndx]) || type_is_pname(mons[omndx])) {
            mnam = s_suffix(mnam);
            possessive = TRUE;
            /* don't precede personal name like "Medusa" with an article */
            if (type_is_pname(mons[omndx]))
                no_prefix = TRUE;
            /* always precede non-personal unique monster name like
               "Oracle" with "the" unless explicitly overridden */
            else if (the_unique_pm(mons[omndx]) && !no_prefix)
                the_prefix = TRUE;
        }
    }
    if (no_prefix)
        the_prefix = any_prefix = FALSE;
    else if (the_prefix)
        any_prefix = FALSE; /* mutually exclusive */

    chars[nambuf] = ord('\0');
    /* can't use the() the way we use an() below because any capitalized
       Name causes it to assume a personal name and return Name as-is;
       that's usually the behavior wanted, but here we need to force "the"
       to precede capitalized unique monsters (pnames are handled above) */
    if (the_prefix)
        strcat(nambuf, _("the "));
    /* note: over time, various instances of the(mon_name()) have crept
       into the code, so the() has been modified to deal with capitalized
       monster names; we could switch to using it below like an() */

    if (!adjective || !chars[adjective]) {
        /* normal case:  newt corpse */
        strcat(nambuf, mnam);
    } else {
        /* adjective positioning depends upon format of monster name */
        if (possessive) /* Medusa's cursed partly eaten corpse */
            sprintf(eos(nambuf), _("%s %s"), mnam, adjective);
        else /* cursed partly eaten troll corpse */
            sprintf(eos(nambuf), _("%s %s"), adjective, mnam);
        /* in case adjective has a trailing space, squeeze it out */
        mungspaces(nambuf);
        /* doname() might include a count in the adjective argument;
           if so, don't prepend an article */
        if (digit(chars[adjective]))
            any_prefix = FALSE;
    }

    if (glob) {
        ; /* omit_corpse doesn't apply; quantity is always 1 */
    } else if (!omit_corpse) {
        strcat(nambuf, _(" corpse"));
        /* makeplural(nambuf) => append "s" to "corpse" */
        if (otmp.quan > 1 && !ignore_quan) {
            strcat(nambuf, _("s"));
            any_prefix = FALSE; /* avoid "a newt corpses" */
        }
    }

    /* it's safe to overwrite our nambuf[] after an() has copied its
       old value into another buffer; and once _that_ has been copied,
       the obuf[] returned by an() can be made available for re-use */
    if (any_prefix) {
        let obufp;

        strcpy(nambuf, obufp = an(nambuf));
        releaseobuf(obufp);
    }
    return nambuf;
}

/* xname doesn't include monster type for "corpse"; cxname does */
export function cxname(obj) { /* char * */
    if (obj.otyp == CORPSE)
        return corpse_xname(obj, 0, CXN_NORMAL);
    return xname(obj);
}

/* like cxname, but ignores quantity */
export function cxname_singular(obj) { /* char * */
    if (obj.otyp == CORPSE)
        return corpse_xname(obj, 0, CXN_SINGULAR);
    return xname_flags(obj, CXN_SINGULAR);
}

/* treat an object as fully ID'd when it might be used as reason for death */
export function killer_xname(obj) { /* char * */
    const $frame = stack_frame(); try {
    let save_obj = stack_struct(struct_obj);
    let save_ocknown;
    let buf, save_ocuname, save_oname = 0;

    /* bypass object twiddling for artifacts */
    if (obj.oartifact)
        return bare_artifactname(obj);

    /* remember original settings for core of the object;
       oextra structs other than oname don't matter here--since they
       aren't modified they don't need to be saved and restored */
    struct_assign(save_obj, obj);
    if (has_oname(obj))
        save_oname = ONAME(obj);

    /* killer name should be more specific than general xname; however, exact
       info like blessed/cursed and rustproof makes things be too verbose; set
       dknown (not observe_object) because dead characters don't observe */
    obj.known = obj.dknown = 1;
    obj.bknown = obj.rknown = obj.greased = 0;
    /* if character is a priest[ess], bknown will get toggled back on */
    if (obj.otyp != POT_WATER)
        obj.blessed = obj.cursed = 0;
    else
        obj.bknown = 1; /* describe holy/unholy water as such */
    /* "killed by poisoned <obj>" would be misleading when poison is
       not the cause of death and "poisoned by poisoned <obj>" would
       be redundant when it is, so suppress "poisoned" prefix */
    obj.otrapped = 0;
    /* strip user-supplied name; artifacts keep theirs */
    if (!obj.oartifact && save_oname)
        ((obj).oextra.oname) = 0;
    /* temporarily identify the type of object */
    save_ocknown = objects[obj.otyp].oc_name_known;
    objects[obj.otyp].oc_name_known = 1;
    save_ocuname = objects[obj.otyp].oc_uname;
    objects[obj.otyp].oc_uname = 0; /* avoid "foo called bar" */

    /* format the object */
    if (obj.otyp == CORPSE) {
        buf = corpse_xname(obj, 0, CXN_NORMAL);
    } else if (obj.otyp == SLIME_MOLD) {
        /* concession to "most unique deaths competition" in the annual
           devnull tournament, suppress player supplied fruit names because
           those can be used to fake other objects and dungeon features */
        buf = nextobuf();
        sprintf(buf, _("deadly slime mold%s"), plur(obj.quan));
    } else {
        buf = xname(obj);
    }
    /* apply an article if appropriate; caller should always use KILLED_BY */
    if (obj.quan == 1 && !strstri(buf, _("'s ")) && !strstri(buf, _("s' ")))
        buf = (obj_is_pname(obj) || the_unique_obj(obj)) ? the(buf) : an(buf);

    objects[obj.otyp].oc_name_known = save_ocknown;
    objects[obj.otyp].oc_uname = save_ocuname;
    struct_assign(obj, save_obj); /* restore object's core settings */
    if (!obj.oartifact && save_oname)
        ((obj).oextra.oname) = save_oname;

    return buf;
    } finally { stack_pop($frame); }
}

/* xname,doname,&c with long results reformatted to omit some stuff */
export function short_oname(
    obj,
    func,
    altfunc,
    lenlimit) { /* char * */
    const $frame = stack_frame(); try {
    let save_obj = stack_struct(struct_obj);
    let unamebuf = stack_array(char, 12), onamebuf = stack_array(char, 12), save_oname, save_uname, outbuf;

    outbuf = func(obj);
    if (strlen(outbuf) <= lenlimit)
        return outbuf;

    /* shorten called string to fairly small amount */
    save_uname = objects[obj.otyp].oc_uname;
    if (save_uname && strlen(save_uname) >= sizeof(array_of(char, 12))) {
        strncpy(unamebuf, save_uname, sizeof(array_of(char, 12)) - 4);
        strcpy(unamebuf + sizeof(array_of(char, 12)) - 4, _("..."));
        objects[obj.otyp].oc_uname = unamebuf;
        releaseobuf(outbuf);
        outbuf = func(obj);
        objects[obj.otyp].oc_uname = save_uname; /* restore called string */
        if (strlen(outbuf) <= lenlimit)
            return outbuf;
    }

    /* shorten named string to fairly small amount */
    save_oname = has_oname(obj) ? ONAME(obj) : 0;
    if (save_oname && strlen(save_oname) >= sizeof(array_of(char, 12))) {
        strncpy(onamebuf, save_oname, sizeof(array_of(char, 12)) - 4);
        strcpy(onamebuf + sizeof(array_of(char, 12)) - 4, _("..."));
        ((obj).oextra.oname) = onamebuf;
        releaseobuf(outbuf);
        outbuf = func(obj);
        ((obj).oextra.oname) = save_oname; /* restore named string */
        if (strlen(outbuf) <= lenlimit)
            return outbuf;
    }

    /* shorten both called and named strings;
       unamebuf and onamebuf have both already been populated */
    if (save_uname && strlen(save_uname) >= sizeof(array_of(char, 12)) && save_oname
        && strlen(save_oname) >= sizeof(array_of(char, 12))) {
        objects[obj.otyp].oc_uname = unamebuf;
        ((obj).oextra.oname) = onamebuf;
        releaseobuf(outbuf);
        outbuf = func(obj);
        if (strlen(outbuf) <= lenlimit) {
            objects[obj.otyp].oc_uname = save_uname;
            ((obj).oextra.oname) = save_oname;
            return outbuf;
        }
    }

    /* still long; strip several name-lengthening attributes;
       called and named strings are still in truncated form */
    struct_assign(save_obj, obj);
    obj.bknown = obj.rknown = obj.greased = 0;
    obj.oeroded = obj.oeroded2 = 0;
    releaseobuf(outbuf);
    outbuf = func(obj);
    if (altfunc && strlen(outbuf) > lenlimit) {
        /* still long; use the alternate function (usually one of
           the jackets around minimal_xname()) */
        releaseobuf(outbuf);
        outbuf = altfunc(obj);
    }
    /* restore the object */
    struct_assign(obj, save_obj);
    if (save_oname)
        ((obj).oextra.oname) = save_oname;
    if (save_uname)
        objects[obj.otyp].oc_uname = save_uname;

    /* use whatever we've got, whether it's too long or not */
    return outbuf;
    } finally { stack_pop($frame); }
}

/*
 * Used if only one of a collection of objects is named (e.g. in eat.c).
 */
export function singular(otmp, func) { /* const char * */
    let savequan;
    let nam;

    /* using xname for corpses does not give the monster type */
    if (otmp.otyp == CORPSE && func == xname)
        func = cxname;

    savequan = otmp.quan;
    otmp.quan = 1;
    nam = func(otmp);
    otmp.quan = savequan;
    return nam;
}

/* pick "", "a ", or "an " as article for 'str'; used by an() and doname() */
export function just_an(outbuf, str) { /* char * */
    let c0;

    chars[outbuf] = ord('\0');
    c0 = lowc(chars[str]);
    if (!chars[str + 1] || chars[str + 1] == ord(' ')) {
        /* single letter; might be used for named fruit or a musical note */
        strcpy(outbuf, strchr(_("aefhilmnosx"), c0) ? _("an ") : _("a "));
    } else if (!strncmpi(str, _("the "), 4)
               /* these probably shouldn't be handled here because doing so
                  impacts inventory when using them for named fruit */
               || !strncmpi((str), _(("molten lava")), -1)
               || !strncmpi((str), _(("iron bars")), -1)
               || !strncmpi((str), _(("ice")), -1)
               ) {
        ; /* no article */
    } else {
        /* normal case is "an <vowel>" or "a <consonant>" */
        if ((strchr(vowels, c0) /* some exceptions warranting "a <vowel>" */
             /* 'wun' initial sound */
             && (strncmpi(str, _("one"), 3) || (chars[str + 3] && !strchr(_("-_ "), chars[str + 3])))
             /* long 'u' initial sound */
             && strncmpi(str, _("eu"), 2) /* "eucalyptus leaf" */
             && strncmpi(str, _("uke"), 3) && strncmpi(str, _("ukulele"), 7)
             && strncmpi(str, _("unicorn"), 7) && strncmpi(str, _("uranium"), 7)
             && strncmpi(str, _("useful"), 6)) /* "useful tool" */
            || (c0 == ord('x') && !strchr(vowels, lowc(chars[str + 1]))))
            strcpy(outbuf, _("an "));
        else
            strcpy(outbuf, _("a "));
    }
    return outbuf;
}

export function an(str) { /* char * */
    let buf = nextobuf();

    if (!str || !chars[str]) {
        impossible(_("Alphabet soup: 'an(%s)'."), str ? _("\"\"") : _("<null>"));
        return strcpy(buf, _("an []"));
    }
    just_an(buf, str);
    return strncat(buf, str, unsigned(BUFSZ - 1 - Strlen(buf)));
}

export function An(str) { /* char * */
    let tmp = an(str);

    chars[tmp] = highc(chars[tmp]);
    return tmp;
}

/*
 * Prepend "the" if necessary; assumes str is a subject derived from xname.
 * Use type_is_pname() for monster names, not the().  the() is idempotent.
 */
export function the(str) { /* char * */
    let aname;
    let buf = nextobuf();
    let insert_the = FALSE;

    if (!str || !chars[str]) {
        impossible(_("Alphabet soup: 'the(%s)'."), str ? _("\"\"") : _("<null>"));
        return strcpy(buf, _("the []"));
    }
    if (!strncmpi(str, _("the "), 4)) {
        chars[buf + 0] = lowc(chars[str]);
        strcpy(buf + 1, str + 1);
        return buf;
    } else if (chars[str] < ord('A') || chars[str] > ord('Z')
               /* some capitalized monster names want "the", others don't */
               || CapitalMon(str)
               /* treat named fruit as not a proper name, even if player
                  has assigned a capitalized proper name as his/her fruit,
                  unless it matches an artifact name */
               || (fruit_from_name(str, TRUE, null)
                   && ((aname = artifact_name(str, null, FALSE)) == 0
                       || strncmpi(aname, _("the "), 4) == 0))) {
        /* not a proper name, needs an article */
        insert_the = TRUE;
    } else {
        /* Probably a proper name, might not need an article */
        let named, called;
        let tmp;
        let l;

        /* some objects have capitalized adjectives in their names */
        if (((tmp = strrchr(str, ord(' '))) != 0 || (tmp = strrchr(str, ord('-'))) != 0)
            && (chars[tmp + 1] < ord('A') || chars[tmp + 1] > ord('Z'))) {
            /* insert "the" unless we have an apostrophe (where we assume
               we're dealing with "Unique's corpse" when "Unique" wasn't
               caught by CapitalMon() above) */
            insert_the = +!strchr(str, ord('\''));
        } else if (tmp && strchr(str, ord(' ')) < tmp) { /* has spaces */
            /* it needs an article if the name contains "of" */
            tmp = strstri(str, _(" of "));
            named = strstri(str, _(" named "));
            called = strstri(str, _(" called "));
            if (called && (!named || called < named))
                named = called;

            if (tmp && (!named || tmp < named)) /* found an "of" */
                insert_the = TRUE;
            /* stupid special case: lacks "of" but needs "the" */
            else if (!named && (l = int(Strlen(str))) >= 31
                     && !strcmp(str + (l - 31),
                                _("Platinum Yendorian Express Card")))
                insert_the = TRUE;
        }
    }
    if (insert_the)
        strcpy(buf, _("the "));
    else
        chars[buf + 0] = ord('\0');
    return strncat(buf, str, unsigned(BUFSZ - 1 - Strlen(buf)));
}

export function The(str) { /* char * */
    let tmp = the(str);

    chars[tmp] = highc(chars[tmp]);
    return tmp;
}

/* returns "count cxname(otmp)" or just cxname(otmp) if count == 1 */
export function aobjnam(otmp, verb) { /* char * */
    const $frame = stack_frame(); try {
    let prefix = stack_array(char, PREFIX);
    let bp = cxname(otmp);

    if (otmp.quan != 1) {
        sprintf(prefix, _("%lld "), otmp.quan);
        bp = strprepend(bp, prefix);
    }
    if (verb) {
        strcat(bp, _(" "));
        strcat(bp, otense(otmp, verb));
    }
    return bp;
    } finally { stack_pop($frame); }
}

/* combine yname and aobjnam eg "your count cxname(otmp)" */
export function yobjnam(obj, verb) { /* char * */
    let s = aobjnam(obj, verb);

    /* leave off "your" for most of your artifacts, but prepend
     * "your" for unique objects and "foo of bar" quest artifacts */
    if (!carried(obj) || !obj_is_pname(obj)
        || obj.oartifact >= ART_ORB_OF_DETECTION) {
        let outbuf = shk_your(nextobuf(), obj);
        let space_left = int(unsigned(BUFSZ - 1 - Strlen(outbuf)));

        s = strncat(outbuf, s, unsigned(space_left));
    }
    return s;
}

/* combine Yname2 and aobjnam eg "Your count cxname(otmp)" */
export function Yobjnam2(obj, verb) { /* char * */
    let s = yobjnam(obj, verb);

    chars[s] = highc(chars[s]);
    return s;
}

/* like aobjnam, but prepend "The", not count, and use xname */
export function Tobjnam(otmp, verb) { /* char * */
    let bp = The(xname(otmp));

    if (verb) {
        strcat(bp, _(" "));
        strcat(bp, otense(otmp, verb));
    }
    return bp;
}

/* capitalized variant of doname() */
export function Doname2(obj) { /* char * */
    let s = doname(obj);

    chars[s] = highc(chars[s]);
    return s;
}

/* doname() for itemized buying of 'obj' from a shop */
export function paydoname(obj) { /* char * */
    let and_contents = init_string(static_array("paydoname.and_contents", char, sizeof_string(" and its contents")), _(" and its contents"), true);
    let p;
    let save_cknown = obj.cknown;
    let save_wizweight = iflags.wizweight;

    if (Has_contents(obj))
        obj.cknown = 0;
    /* avoid showing item weights to unclutter billing's pay-menu a bit */
    iflags.wizweight = FALSE;
    /* suppress invent-style price; caller will add billing-style price */
    iflags.suppress_price++;
    p = doname_base(obj, 0);
    iflags.suppress_price--;
    iflags.wizweight = save_wizweight;

    if (Has_contents(obj)) {
        /* buy_container() sets no_charge for a container that has just
           been purchased so that when paydoname() is called by
           shk_names_obj(), we'll provide "a/an <container>" instead of
           "your <container>" */
        if (!obj.no_charge) {
            if (!strncmp(p, _("a "), 2))
                p += 2;
            else if (!strncmp(p, _("an "), 3))
                p += 3;
            p = strprepend(p, obj.unpaid ? _("an unpaid ") : _("your "));
        }

        if (!obj.cknown) {
            if (obj.unpaid) {
                if (unsigned(unsigned(unsigned(int(strlen(p))) + sizeof_string(" and its contents")) - 1)
                    < BUFSZ - PREFIX)
                    strcat(p, and_contents);
            } else {
                p = strprepend(p, _("the contents of "));
            }
        }
    }
    obj.cknown = save_cknown;
    return p;
}

/* returns "[your ]xname(obj)" or "Foobar's xname(obj)" or "the xname(obj)" */
export function yname(obj) { /* char * */
    let s = cxname(obj);

    /* leave off "your" for most of your artifacts, but prepend
     * "your" for unique objects and "foo of bar" quest artifacts */
    if (!carried(obj) || !obj_is_pname(obj)
        || obj.oartifact >= ART_ORB_OF_DETECTION) {
        let outbuf = shk_your(nextobuf(), obj);
        let space_left = int(unsigned(BUFSZ - 1 - Strlen(outbuf)));

        s = strncat(outbuf, s, unsigned(space_left));
    }

    return s;
}

/* capitalized variant of yname() */
export function Yname2(obj) { /* char * */
    let s = yname(obj);

    chars[s] = highc(chars[s]);
    return s;
}

/* returns "your minimal_xname(obj)"
 * or "Foobar's minimal_xname(obj)"
 * or "the minimal_xname(obj)"
 */
export function ysimple_name(obj) { /* char * */
    let outbuf = nextobuf();
    let s = shk_your(outbuf, obj); /* assert( s == outbuf ); */
    let space_left = int(unsigned(BUFSZ - 1 - Strlen(s)));

    return strncat(s, minimal_xname(obj), unsigned(space_left));
}

/* capitalized variant of ysimple_name() */
export function Ysimple_name2(obj) { /* char * */
    let s = ysimple_name(obj);

    chars[s] = highc(chars[s]);
    return s;
}

    /*
     * FIXME:
     *  simpleonames(), ansimpleoname(), and thesimpleoname() need to
     *  know the beginning of the obuf[] they use so that they can
     *  guard against buffer overflow when pluralizing (is that an
     *  actual word?) or inserting "an" or "the".
     *
     *  minimal_xname() returns a call to xname() which writes into
     *  the middle of its obuf[] then backs up to accomodate a prefix,
     *  so BUFSZ is not a reliable limit for the length of the result.
     *
     *  [Overflow likely moot.  Since the formatted object name has
     *  user-supplied name suppressed, the length is sure to be short
     *  enough to added plural suffix or "an" or "the" prefix.]
     */

/* "scroll" or "scrolls" */
export function simpleonames(obj) { /* char * */
    let obufp, simpleoname = minimal_xname(obj);

    if (obj.quan != 1) {
        /* 'simpleoname' points to an obuf; makeplural() will allocate
           another one and only that one can be explicitly released for
           re-use, so this is slightly convoluted to cope with that;
           makeplural() will be fully evaluated and done with its input
           argument before strcpy() touches its output argument */
        strcpy(simpleoname, obufp = makeplural(simpleoname));
        releaseobuf(obufp);
    }
    return simpleoname;
}

/* "a scroll" or "scrolls"; "a silver bell" or "the Bell of Opening" */
export function ansimpleoname(obj) { /* char * */
    let obufp, simpleoname = simpleonames(obj);
    let otyp = obj.otyp;

    /* prefix with "the" if a unique item, or a fake one imitating same,
       has been formatted with its actual name (we let minimal_xname() handle
       any `known' and `dknown' checking necessary) */
    if (otyp == FAKE_AMULET_OF_YENDOR)
        otyp = AMULET_OF_YENDOR;
    if (objects[otyp].oc_unique && OBJ_NAME(objects[otyp])
        && !strcmp(simpleoname, OBJ_NAME(objects[otyp]))) {
        /* the() will allocate another obuf[]; we want to avoid using two */
        obufp = the(simpleoname);
        strcpy(simpleoname, obufp);
        releaseobuf(obufp);
    } else if (obj.quan == 1) {
        /* simpleoname[] is singular if quan==1, plural otherwise;
           an() will allocate another obuf[]; we want to avoid using two */
        obufp = an(simpleoname);
        strcpy(simpleoname, obufp);
        releaseobuf(obufp);
    }
    return simpleoname;
}

/* "the scroll" or "the scrolls" */
export function thesimpleoname(obj) { /* char * */
    let obufp, simpleoname = simpleonames(obj);

    /* the() will allocate another obuf[]; we want to avoid using two */
    obufp = the(simpleoname);
    strcpy(simpleoname, obufp);
    releaseobuf(obufp);
    return simpleoname;
}

/* basic name of obj, as if it has been discovered; for some types of
   items, we can't just use OBJ_NAME() because it doesn't always include
   the class (for instance "light" when we want "spellbook of light");
   minimal_xname() uses xname() to get that */
export function actualoname(obj) { /* char * */
    let res;

    iflags.override_ID = TRUE;
    res = minimal_xname(obj);
    iflags.override_ID = FALSE;
    return res;
}

/* artifact's name without any object type or known/dknown/&c feedback */
export function bare_artifactname(obj) { /* char * */
    let outbuf;

    if (obj.oartifact) {
        outbuf = nextobuf();
        strcpy(outbuf, artiname(obj.oartifact));
        if (!strncmp(outbuf, _("The "), 4))
            chars[outbuf + 0] = lowc(chars[outbuf + 0]);
    } else {
        outbuf = xname(obj);
    }
    return outbuf;
}

const wrp = static_array("wrp", ptr_to(char), null, [
    _("wand"),   _("ring"),      _("potion"),     _("scroll"), _("gem"),
    _("amulet"), _("spellbook"), _("spell book"),
    /* for non-specific wishes */
    _("weapon"), _("armor"),     _("tool"),       _("food"),   _("comestible"),
]);
const wrpsym = static_array("wrpsym", char, null, [ WAND_CLASS,   RING_CLASS,   POTION_CLASS,
                               SCROLL_CLASS, GEM_CLASS,    AMULET_CLASS,
                               SPBOOK_CLASS, SPBOOK_CLASS, WEAPON_CLASS,
                               ARMOR_CLASS,  TOOL_CLASS,   FOOD_CLASS,
                               FOOD_CLASS ]);

/* return form of the verb (input plural) if xname(otmp) were the subject */
export function otense(otmp, verb) { /* char * */
    let buf;

    /*
     * verb is given in plural (without trailing s).  Return as input
     * if the result of xname(otmp) would be plural.  Don't bother
     * recomputing xname(otmp) at this time.
     */
    if (!is_plural(otmp))
        return vtense(0, verb);

    buf = nextobuf();
    strcpy(buf, verb);
    return buf;
}

/* various singular words that vtense would otherwise categorize as plural;
   also used by makesingular() to catch some special cases */
const special_subjs = static_array("special_subjs", ptr_to(char), null, [
    _("erinys"),  _("manes"), /* this one is ambiguous */
    _("Cyclops"), _("Hippocrates"),     _("Pelias"),    _("aklys"),
    _("amnesia"), _("detect monsters"), _("paralysis"), _("shape changers"),
    _("nemesis"), 0
    /* note: "detect monsters" and "shape changers" are normally
       caught via "<something>(s) of <whatever>", but they can be
       wished for using the shorter form, so we include them here
       to accommodate usage by makesingular during wishing */
]);

/* return form of the verb (input plural) for present tense 3rd person subj */
export function vtense(subj, verb) { /* char * */
    var buf = nextobuf(), bspot;
    var len, ltmp;
    var sp, spot;
    var spec;

    /*
     * verb is given in plural (without trailing s).  Return as input
     * if subj appears to be plural.  Add special cases as necessary.
     * Many hard cases can already be handled by using otense() instead.
     * If this gets much bigger, consider decomposing makeplural.
     * Note: monster names are not expected here (except before corpse).
     *
     * Special case: allow null sobj to get the singular 3rd person
     * present tense form so we don't duplicate this code elsewhere.
     */
    sing: { if (subj) {
        if (!strncmpi(subj, _("a "), 2) || !strncmpi(subj, _("an "), 3))
            break sing;;
        spot = 0;
        for (sp = subj; (sp = strchr(sp, ord(' '))) != 0; ++sp) {
            if (!strncmpi(sp, _(" of "), 4) || !strncmpi(sp, _(" from "), 6)
                || !strncmpi(sp, _(" called "), 8) || !strncmpi(sp, _(" named "), 7)
                || !strncmpi(sp, _(" labeled "), 9)) {
                if (sp != subj)
                    spot = sp - 1;
                break;
            }
        }
        len = int(strlen(subj));
        if (!spot)
            spot = subj + len - 1;

        /*
         * plural: anything that ends in 's', but not '*us' or '*ss'.
         * Guess at a few other special cases that makeplural creates.
         */
        if ((lowc(chars[spot]) == ord('s') && spot != subj
             && !strchr(_("us"), lowc(chars[(spot - 1)])))
            || !BSTRNCMPI(subj, spot - 3, _("eeth"), 4)
            || !BSTRNCMPI(subj, spot - 3, _("feet"), 4)
            || !BSTRNCMPI(subj, spot - 1, _("ia"), 2)
            || !BSTRNCMPI(subj, spot - 1, _("ae"), 2)) {
            /* check for special cases to avoid false matches */
            len = (spot - subj) + 1;
            for (spec = special_subjs; spec[0]; spec = spec.subarray(1)) {
                ltmp = int(Strlen(spec[0]));
                if (len == ltmp && !strncmpi(spec[0], subj, len))
                    break sing;;
                /* also check for <prefix><space><special_subj>
                   to catch things like "the invisible erinys" */
                if (len > ltmp && chars[(spot - ltmp)] == ord(' ')
                    && !strncmpi(spec[0], spot - ltmp + 1, ltmp))
                    break sing;;
            }

            return strcpy(buf, verb);
        }
        /*
         * 3rd person plural doesn't end in telltale 's';
         * 2nd person singular behaves as if plural.
         */
        if (!strncmpi((subj), _(("they")), -1) || !strncmpi((subj), _(("you")), -1))
            return strcpy(buf, verb);
    }
 }
    strcpy(buf, verb);
    len = int(strlen(buf));
    bspot = buf + len - 1;

    if (!strncmpi((buf), _(("are")), -1)) {
        Strcasecpy(buf, _("is"));
    } else if (!strncmpi((buf), _(("have")), -1)) {
        Strcasecpy(bspot - 1, _("s"));
    } else if (strchr(_("zxs"), lowc(chars[bspot]))
               || (len >= 2 && lowc(chars[bspot]) == ord('h')
                   && strchr(_("cs"), lowc(chars[(bspot - 1)])))
               || (len == 2 && lowc(chars[bspot]) == ord('o'))) {
        /* Ends in z, x, s, ch, sh; add an "es" */
        Strcasecpy(bspot + 1, _("es"));
    } else if (lowc(chars[bspot]) == ord('y') && !strchr(vowels, lowc(chars[(bspot - 1)]))) {
        /* like "y" case in makeplural */
        Strcasecpy(bspot, _("ies"));
    } else {
        Strcasecpy(bspot + 1, _("s"));
    }

    return buf;
}

const struct_sing_plur = struct("struct_sing_plur", {
    sing: ptr_to(char), plur: ptr_to(char),
});

/* word pairs that don't fit into formula-based transformations;
   also some suffices which have very few--often one--matches or
   which aren't systematically reversible (knives, staves) */
const one_off = static_array("one_off", struct_sing_plur, null, [
    { sing: _("child"),
      plur: _("children") },      /* (for wise guys who give their food funny names) */
    { sing: _("cubus"), plur: _("cubi") }, /* in-/suc-cubus */
    { sing: _("culus"), plur: _("culi") }, /* homunculus */
    { sing: _("Cyclops"), plur: _("Cyclopes") },
    { sing: _("djinni"), plur: _("djinn") },
    { sing: _("erinys"), plur: _("erinyes") },
    { sing: _("foot"), plur: _("feet") },
    { sing: _("fungus"), plur: _("fungi") },
    { sing: _("goose"), plur: _("geese") },
    { sing: _("knife"), plur: _("knives") },
    { sing: _("labrum"), plur: _("labra") }, /* candelabrum */
    { sing: _("louse"), plur: _("lice") },
    { sing: _("mouse"), plur: _("mice") },
    { sing: _("mumak"), plur: _("mumakil") },
    { sing: _("nemesis"), plur: _("nemeses") },
    { sing: _("ovum"), plur: _("ova") },
    { sing: _("ox"), plur: _("oxen") },
    { sing: _("passerby"), plur: _("passersby") },
    { sing: _("rtex"), plur: _("rtices") }, /* vortex */
    { sing: _("serum"), plur: _("sera") },
    { sing: _("staff"), plur: _("staves") },
    { sing: _("tooth"), plur: _("teeth") },
    { sing: 0, plur: 0 }
]);

const as_is = static_array("as_is", ptr_to(char), null, [
    /* makesingular() leaves these plural due to how they're used */
    _("boots"),   _("shoes"),     _("gloves"),    _("lenses"),   _("scales"),
    _("eyes"),    _("gauntlets"), _("iron bars"),
    /* both singular and plural are spelled the same */
    _("bison"),   _("deer"),      _("elk"),       _("fish"),      _("fowl"),
    _("tuna"),    _("yaki"),      _("-hai"),      _("krill"),     _("manes"),
    _("moose"),   _("ninja"),     _("sheep"),     _("ronin"),     _("roshi"),
    _("shito"),   _("tengu"),     _("ki-rin"),    _("Nazgul"),    _("gunyoki"),
    _("piranha"), _("samurai"),   _("shuriken"),  _("haggis"),    _("Bordeaux"),
    0,
    /* Note:  "fish" and "piranha" are collective plurals, suitable
       for "wiped out all <foo>".  For "3 <foo>", they should be
       "fishes" and "piranhas" instead.  We settle for collective
       variant instead of attempting to support both. */
]);

/* singularize/pluralize decisions common to both makesingular & makeplural */
function singplur_lookup(
    basestr, endstring,
    to_plural,
    alt_as_is) { /* boolean */ /* another set like as_is[] */
    let sp;
    let same, other, as;
    let al;
    let baselen = int(Strlen(basestr));

    for (as = as_is; as[0]; as = as.subarray(1)) {
        al = int(strlen(as[0]));
        if (!(((endstring - al) < basestr) || strcmpi((endstring - al), as[0])))
            return TRUE;
    }
    if (alt_as_is) {
        for (as = alt_as_is; as[0]; as = as.subarray(1)) {
            al = int(strlen(as[0]));
            if (!(((endstring - al) < basestr) || strcmpi((endstring - al), as[0])))
                return TRUE;
        }
    }

   /* Leave "craft" as a suffix as-is (aircraft, hovercraft);
      "craft" itself is (arguably) not included in our likely context */
   if ((baselen > 5) && (!BSTRCMPI(basestr, endstring - 5, _("craft"))))
       return TRUE;
   /* avoid false hit on one_off[].plur == "lice" or .sing == "goose";
       if more of these turn up, one_off[] entries will need to flagged
       as to which are whole words and which are matchable as suffices
       then matching in the loop below will end up becoming more complex */
    if (!strncmpi((basestr), _(("slice")), -1)
        || !strncmpi((basestr), _(("mongoose")), -1)) {
        if (to_plural)
            Strcasecpy(endstring, _("s"));
        return TRUE;
    }
    /* skip "ox" -> "oxen" entry when pluralizing "<something>ox"
       unless it is muskox */
    if (to_plural && baselen > 2 && !strncmpi((endstring - 2), _(("ox")), -1)
        && !(baselen > 5 && !strncmpi((endstring - 6), _(("muskox")), -1))) {
        /* "fox" -> "foxes" */
        Strcasecpy(endstring, _("es"));
        return TRUE;
    }
    if (to_plural) {
        if (baselen > 2 && !strncmpi((endstring - 3), _(("man")), -1)
            && badman(basestr, to_plural)) {
            Strcasecpy(endstring, _("s"));
            return TRUE;
        }
    } else {
        if (baselen > 2 && !strncmpi((endstring - 3), _(("men")), -1)
            && badman(basestr, to_plural))
            return TRUE;
    }
    for (sp = one_off[0]; sp.sing; sp = ptr_add(sp, 1)) {
        /* check whether endstring already matches */
        same = to_plural ? sp.plur : sp.sing;
        al = int(strlen(same));
        if (!(((endstring - al) < basestr) || strcmpi((endstring - al), same)))
            return TRUE; /* use as-is */
        /* check whether it matches the inverse; if so, transform it */
        other = to_plural ? sp.sing : sp.plur;
        al = int(strlen(other));
        if (!(((endstring - al) < basestr) || strcmpi((endstring - al), other))) {
            Strcasecpy(endstring - al, same);
            return TRUE; /* one_off[] transformation */
        }
    }
    return FALSE;
}

/* searches for common compounds, ex. lump of royal jelly */
function singplur_compound(str) { /* char * */
    /* if new entries are added, be sure to keep compound_start[] in sync */
    let compounds = static_array("singplur_compound.compounds", ptr_to(char), null, [
          _(" of "),     _(" labeled "), _(" called "),
          _(" named "),  _(" above"), /* lurkers above */
          _(" versus "), _(" from "),    _(" in "),
          _(" on "),     _(" a la "),    _(" with"), /* " with "? */
          _(" de "),     _(" d'"),       _(" du "),
          _(" au "),     _("-in-"),      _("-at-"),
          0
        ]),
        compound_start = init_string(static_array("singplur_compound.compound_start", char, sizeof_string(" -")), _(" -"), true);

    let cmpd;
    let p;

    for (p = str; chars[p]; ++p) {
        /* substring starting at p can only match if *p is found
           within compound_start[] */
        if (!strchr(compound_start, chars[p]))
            continue;

        /* check current substring against all words in the compound[] list */
        for (cmpd = compounds; cmpd[0]; cmpd = cmpd.subarray(1))
            if (!strncmpi(p, cmpd[0], int(strlen(cmpd[0]))))
                return p;
    }
    /* wasn't recognized as a compound phrase */
    return 0;
}

/* Plural routine; once upon a time it may have been chiefly used for
 * user-defined fruits, but it is now used extensively throughout the
 * program.
 *
 * For fruit, we have to try to account for everything reasonable the
 * player has; something unreasonable can still break the code.
 * However, it's still a lot more accurate than "just add an 's' at the
 * end", which Rogue uses...
 *
 * Also used for plural monster names ("Wiped out all homunculi." or the
 * vanquished monsters list) and body parts.  A lot of unique monsters have
 * names which get mangled by makeplural and/or makesingular.  They're not
 * genocidable, and vanquished-mon handling does its own special casing
 * (for uniques who've been revived and re-killed), so we don't bother
 * trying to get those right here.
 *
 * Also misused by muse.c to convert 1st person present verbs to 2nd person.
 * 3.6.0: made case-insensitive.
 */
export function makeplural(oldstr) { /* char * */
    var spot;
    var lo_c, str = nextobuf();
    var excess = 0;
    var len, i;

    if (oldstr)
        while (chars[oldstr] == ord(' '))
            oldstr++;
    if (!oldstr || !chars[oldstr]) {
        impossible(_("plural of null?"));
        strcpy(str, _("s"));
        return str;
    }
    /* makeplural() is sometimes used on monsters rather than objects
       and sometimes pronouns are used for monsters, so check those;
       unfortunately, "her" (which matches genders[1].him and [1].his)
       and "it" (which matches genders[2].he and [2].him) are ambiguous;
       we'll live with that; caller can fix things up if necessary */
    chars[str] = ord('\0');
    for (i = 0; i <= 2; ++i) {
        if (!strcmpi(genders[i].he, oldstr))
            strcpy(str, genders[3].he); /* "they" */
        else if (!strcmpi(genders[i].him, oldstr))
            strcpy(str, genders[3].him); /* "them" */
        else if (!strcmpi(genders[i].his, oldstr))
            strcpy(str, genders[3].his); /* "their" */
        if (chars[str]) {
            if (chars[oldstr + 0] == highc(chars[oldstr + 0]))
                chars[str + 0] = highc(chars[str + 0]);
            return str;
        }
    }

    strcpy(str, oldstr);

    /*
     * Skip changing "pair of" to "pairs of".  According to Webster, usual
     * English usage is use pairs for humans, e.g. 3 pairs of dancers,
     * and pair for objects and non-humans, e.g. 3 pair of boots.  We don't
     * refer to pairs of humans in this game so just skip to the bottom.
     */
    bottom: { if (!strncmpi(str, _("pair of "), 8))
        break bottom;;

    /* look for "foo of bar" so that we can focus on "foo" */
    if ((spot = singplur_compound(str)) != 0) {
        excess = oldstr + (spot - str);
        chars[spot] = ord('\0');
    } else
        spot = eos(str);

    spot--;
    while (spot > str && chars[spot] == ord(' '))
        spot--; /* Strip blanks from end */
    chars[(spot + 1)] = ord('\0');
    /* Now spot is the last character of the string */

    len = int(Strlen(str));

    /* Single letters */
    if (len == 1 || !letter(chars[spot])) {
        strcpy(spot + 1, _("'s"));
        break bottom;
    }

    /* dispense with some words which don't need pluralization */
    {
        var already_plural = static_array("makeplural.already_plural", ptr_to(char), null, [
            _("ae"),  /* algae, larvae, &c */
            _("eaux"), /* chateaux, gateaux */
            _("matzot"), 0,
        ]);

        /* spot+1: synch up with makesingular's usage */
        if (singplur_lookup(str, spot + 1, TRUE, already_plural))
            break bottom;;

        /* more of same, but not suitable for blanket loop checking */
        if ((len == 2 && !strncmpi((str), _(("ya")), -1))
            || (len >= 3 && !strncmpi((spot - 2), _((" ya")), -1)))
            break bottom;;
    }

    /* man/men ("Wiped out all cavemen.") */
    if (len >= 3 && !strncmpi((spot - 2), _(("man")), -1)
        /* exclude shamans and humans etc */
        && !badman(str, TRUE)) {
        Strcasecpy(spot - 1, _("en"));
        break bottom;
    }
    if (lowc(chars[spot]) == ord('f')) { /* (staff handled via one_off[]) */
        lo_c = lowc(chars[(spot - 1)]);
        if (len >= 3 && !strncmpi((spot - 2), _(("erf")), -1)) {
            /* avoid "nerf" -> "nerves", "serf" -> "serves" */
            ; /* fall through to default (append 's') */
        } else if (strchr(_("lr"), lo_c) || strchr(vowels, lo_c)) {
            /* [aeioulr]f to [aeioulr]ves */
            Strcasecpy(spot, _("ves"));
            break bottom;
        }
    }
    /* ium/ia (mycelia, baluchitheria) */
    if (len >= 3 && !strncmpi((spot - 2), _(("ium")), -1)) {
        Strcasecpy(spot - 2, _("ia"));
        break bottom;
    }
    /* algae, larvae, hyphae (another fungus part) */
    if ((len >= 4 && !strncmpi((spot - 3), _(("alga")), -1))
        || (len >= 5
            && (!strncmpi((spot - 4), _(("hypha")), -1) || !strncmpi((spot - 4), _(("larva")), -1)))
        || (len >= 6 && !strncmpi((spot - 5), _(("amoeba")), -1))
        || (len >= 8 && (!strncmpi((spot - 7), _(("vertebra")), -1)))) {
        /* a to ae */
        Strcasecpy(spot + 1, _("e"));
        break bottom;
    }
    /* fungus/fungi, homunculus/homunculi, but buses, lotuses, wumpuses */
    if (len > 3 && !strncmpi((spot - 1), _(("us")), -1)
        && !((len >= 5 && !strncmpi((spot - 4), _(("lotus")), -1))
             || (len >= 6 && !strncmpi((spot - 5), _(("wumpus")), -1)))) {
        Strcasecpy(spot - 1, _("i"));
        break bottom;
    }
    /* sis/ses (nemesis) */
    if (len >= 3 && !strncmpi((spot - 2), _(("sis")), -1)) {
        Strcasecpy(spot - 1, _("es"));
        break bottom;
    }
    /* -eau/-eaux (gateau, chapeau...) */
    if (len >= 3 && !strncmpi((spot - 2), _(("eau")), -1)
        /* 'bureaus' is the more common plural of 'bureau' */
        && BSTRCMPI(str, spot - 5, _("bureau"))) {
        Strcasecpy(spot + 1, _("x"));
        break bottom;
    }
    /* matzoh/matzot, possible food name */
    if (len >= 6
        && (!strncmpi((spot - 5), _(("matzoh")), -1) || !strncmpi((spot - 5), _(("matzah")), -1))) {
        Strcasecpy(spot - 1, _("ot")); /* oh/ah -> ot */
        break bottom;
    }
    if (len >= 5
        && (!strncmpi((spot - 4), _(("matzo")), -1) || !strncmpi((spot - 4), _(("matza")), -1))) {
        Strcasecpy(spot, _("ot")); /* o/a -> ot */
        break bottom;
    }

    /* note: ox/oxen, VAX/VAXen, goose/geese */

    lo_c = lowc(chars[spot]);

    /* codex/spadix/neocortex and the like */
    if (len >= 5
        && (!strncmpi((spot - 2), _(("dex")), -1)
            ||!strncmpi((spot - 2), _(("dix")), -1)
            ||!strncmpi((spot - 2), _(("tex")), -1))
           /* indices would have been ok too, but stick with indexes */
        && (strncmpi((spot - 4), _(("index")), -1) != 0)) {
        Strcasecpy(spot - 1, _("ices")); /* ex|ix -> ices */
        break bottom;
    }
    /* Ends in z, x, s, ch, sh; add an "es" */
    if (strchr(_("zxs"), lo_c)
        || (len >= 2 && lo_c == ord('h') && strchr(_("cs"), lowc(chars[(spot - 1)]))
            /* 21st century k-sound */
            && !(len >= 4 && lowc(chars[(spot - 1)]) == ord('c') && ch_ksound(str)))
        /* Kludge to get "tomatoes" and "potatoes" right */
        || (len >= 4 && !strncmpi((spot - 2), _(("ato")), -1))
        || (len >= 5 && !strncmpi((spot - 4), _(("dingo")), -1))) {
        Strcasecpy(spot + 1, _("es")); /* append es */
        break bottom;
    }
    /* Ends in y preceded by consonant (note: also "qu") change to "ies" */
    if (lo_c == ord('y') && !strchr(vowels, lowc(chars[(spot - 1)]))) {
        Strcasecpy(spot, _("ies")); /* y -> ies */
        break bottom;
    }
    /* Default: append an 's' */
    Strcasecpy(spot + 1, _("s"));
 }
    if (excess)
        strcat(str, excess);
    return str;
}

/*
 * Singularize a string the user typed in; this helps reduce the complexity
 * of readobjnam, and is also used in pager.c to singularize the string
 * for which help is sought.
 *
 * "Manes" is ambiguous: monster type (keep s), or horse body part (drop s)?
 * Its inclusion in as_is[]/special_subj[] makes it get treated as the former.
 *
 * A lot of unique monsters have names ending in s; plural, or singular
 * from plural, doesn't make much sense for them so we don't bother trying.
 * 3.6.0: made case-insensitive.
 */
export function makesingular(oldstr) { /* char * */
    var p, bp;
    var excess = 0;
    var str = nextobuf();

    if (oldstr)
        while (chars[oldstr] == ord(' '))
            oldstr++;
    if (!oldstr || !chars[oldstr]) {
        impossible(_("singular of null?"));
        chars[str + 0] = ord('\0');
        return str;
    }
    /* makeplural() of pronouns isn't reversible but at least we can
       force a singular value */
    chars[str] = ord('\0');
    if (!strcmpi(genders[3].he, oldstr)) /* "they" */
        strcpy(str, genders[2].he); /* "it" */
    else if (!strcmpi(genders[3].him, oldstr)) /* "them" */
        strcpy(str, genders[2].him); /* also "it" */
    else if (!strcmpi(genders[3].his, oldstr)) /* "their" */
        strcpy(str, genders[2].his); /* "its" */
    if (chars[str]) {
        if (chars[oldstr + 0] == highc(chars[oldstr + 0]))
            chars[str + 0] = highc(chars[str + 0]);
        return str;
    }

    bp = strcpy(str, oldstr);

    /* check for "foo of bar" so that we can focus on "foo" */
    if ((p = singplur_compound(bp)) != 0) {
        excess = oldstr + (p - bp);
        chars[p] = ord('\0');
    } else
        p = eos(bp);

    /* dispense with some words which don't need singularization */
    bottom: { if (singplur_lookup(bp, p, FALSE, special_subjs))
        break bottom;;

    /* remove -s or -es (boxes) or -ies (rubies) */
    if (p >= bp + 1 && lowc(chars[p + (-1)]) == ord('s')) {
        mins: { if (p >= bp + 2 && lowc(chars[p + (-2)]) == ord('e')) {
            if (p >= bp + 3 && lowc(chars[p + (-3)]) == ord('i')) { /* "ies" */
                if (!BSTRCMPI(bp, p - 7, _("cookies"))
                    || (!BSTRCMPI(bp, p - 4, _("pies"))
                        /* avoid false match for "harpies" */
                        && (p - 4 == bp || chars[p + (-5)] == ord(' ')))
                    /* alternate djinni/djinn spelling; not really needed */
                    || (!BSTRCMPI(bp, p - 6, _("genies"))
                        /* avoid false match for "progenies" */
                        && (p - 6 == bp || chars[p + (-7)] == ord(' ')))
                    || !BSTRCMPI(bp, p - 5, _("mbies")) /* zombie */
                    || !BSTRCMPI(bp, p - 5, _("yries"))) /* valkyrie */
                    break mins;;
                Strcasecpy(p - 3, _("y")); /* ies -> y */
                break bottom;
            }
            /* wolves, but f to ves isn't fully reversible */
            if (p - 4 >= bp && (strchr(_("lr"), lowc(chars[(p - 4)]))
                                || strchr(vowels, lowc(chars[(p - 4)])))
                && !BSTRCMPI(bp, p - 3, _("ves"))) {
                if (!BSTRCMPI(bp, p - 6, _("cloves"))
                    || !BSTRCMPI(bp, p - 6, _("nerves")))
                    break mins;;
                Strcasecpy(p - 3, _("f")); /* ves -> f */
                break bottom;
            }
            /* note: nurses, axes but boxes, wumpuses */
            if (!BSTRCMPI(bp, p - 4, _("eses"))
                || !BSTRCMPI(bp, p - 4, _("oxes")) /* boxes, foxes */
                || !BSTRCMPI(bp, p - 4, _("nxes")) /* lynxes */
                || !BSTRCMPI(bp, p - 4, _("ches"))
                || !BSTRCMPI(bp, p - 4, _("uses")) /* lotuses */
                || !BSTRCMPI(bp, p - 4, _("shes")) /* splashes [of venom] */
                || !BSTRCMPI(bp, p - 4, _("sses")) /* priestesses */
                || !BSTRCMPI(bp, p - 5, _("atoes")) /* tomatoes */
                || !BSTRCMPI(bp, p - 7, _("dingoes"))
                || !BSTRCMPI(bp, p - 7, _("Aleaxes"))) {
                chars[(p - 2)] = ord('\0'); /* drop es */
                break bottom;
            } /* else fall through to mins */

            /* ends in 's' but not 'es' */
        } else if (!BSTRCMPI(bp, p - 2, _("us"))) { /* lotus, fungus... */
            if (BSTRCMPI(bp, p - 6, _("tengus")) /* but not these... */
                && BSTRCMPI(bp, p - 7, _("hezrous")))
                break bottom;;
        } else if (!BSTRCMPI(bp, p - 2, _("ss"))
                   || !BSTRCMPI(bp, p - 5, _(" lens"))
                   || (p - 4 == bp && !strncmpi((p - 4), _(("lens")), -1))) {
            break bottom;
        }
 }
        chars[(p - 1)] = ord('\0'); /* drop s */
    } else { /* input doesn't end in 's' */
        if (!BSTRCMPI(bp, p - 3, _("men"))
            && !badman(bp, FALSE)) {
            Strcasecpy(p - 2, _("an"));
            break bottom;
        }
        /* matzot -> matzo, algae -> alga */
        if (!BSTRCMPI(bp, p - 6, _("matzot")) || !BSTRCMPI(bp, p - 2, _("ae"))
            || !BSTRCMPI(bp, p - 4, _("eaux"))) {
            chars[(p - 1)] = ord('\0'); /* drop t/e/x */
            break bottom;
        }
        /* balactheria -> balactherium */
        if (p - 4 >= bp && !strncmpi((p - 2), _(("ia")), -1)
            && strchr(_("lr"), lowc(chars[(p - 3)])) && lowc(chars[(p - 4)]) == ord('e')) {
            Strcasecpy(p - 1, _("um")); /* a -> um */
        }

        /* here we cannot find the plural suffix */
    }
 }
    /* if we stripped off a suffix (" of bar" from "foo of bar"),
       put it back now [strcat() isn't actually 100% safe here...] */
    if (excess)
        strcat(bp, excess);

    return bp;
}

function ch_ksound(basestr) { /* boolean */
    /* these are some *ch words/suffixes that make a k-sound. They pluralize by
       adding 's' rather than 'es' */
    let ch_k = static_array("ch_ksound.ch_k", ptr_to(char), null, [
        _("monarch"),     _("poch"),    _("tech"),     _("mech"),      _("stomach"), _("psych"),
        _("amphibrach"),  _("anarch"),  _("atriarch"), _("azedarach"), _("broch"),
        _("gastrotrich"), _("isopach"), _("loch"),     _("oligarch"),  _("peritrich"),
        _("sandarach"),   _("sumach"),  _("symposiarch"),
    ]);
    let i, al;
    let endstr;

    if (!basestr || strlen(basestr) < 4)
        return FALSE;

    endstr = eos(basestr);
    for (i = 0; i < SIZE(ch_k); i++) {
        al = int(strlen(ch_k[i]));
        if (!(((endstr - al) < basestr) || strcmpi((endstr - al), ch_k[i])))
            return TRUE;
    }
    return FALSE;
}

function badman(
    basestr,
    to_plural) { /* boolean */ /* True: makeplural, False: makesingular */
    /* these are all the prefixes for *man that don't have a *men plural */
    let no_men = static_array("badman.no_men", ptr_to(char), null, [
        _("albu"), _("antihu"), _("anti"), _("ata"), _("auto"), _("bildungsro"), _("cai"), _("cay"),
        _("ceru"), _("corner"), _("decu"), _("des"), _("dura"), _("fir"), _("hanu"), _("het"),
        _("infrahu"), _("inhu"), _("nonhu"), _("otto"), _("out"), _("prehu"), _("protohu"),
        _("subhu"), _("superhu"), _("talis"), _("unhu"), _("sha"),
        _("hu"), _("un"), _("le"), _("re"), _("so"), _("to"), _("at"), _("a"),
    ]);
    /* these are all the prefixes for *men that don't have a *man singular */
    let no_man = static_array("badman.no_man", ptr_to(char), null, [
        _("abdo"), _("acu"), _("agno"), _("ceru"), _("cogno"), _("cycla"), _("fleh"), _("grava"),
        _("hegu"), _("preno"), _("sonar"), _("speci"), _("dai"), _("exa"), _("fla"), _("sta"), _("teg"),
        _("tegu"), _("vela"), _("da"), _("hy"), _("lu"), _("no"), _("nu"), _("ra"), _("ru"), _("se"), _("vi"),
        _("ya"), _("o"), _("a"),
    ]);
    let i, al;
    let endstr, spot;

    if (!basestr || strlen(basestr) < 4)
        return FALSE;

    endstr = eos(basestr);

    if (to_plural) {
        for (i = 0; i < SIZE(no_men); i++) {
            al = int(strlen(no_men[i]));
            spot = endstr - (al + 3);
            if (!(((spot) < basestr) || strncmpi((spot), no_men[i], al))
                && (spot == basestr || chars[(spot - 1)] == ord(' ')))
                return TRUE;
        }
    } else {
        for (i = 0; i < SIZE(no_man); i++) {
            al = int(strlen(no_man[i]));
            spot = endstr - (al + 3);
            if (!(((spot) < basestr) || strncmpi((spot), no_man[i], al))
                && (spot == basestr || chars[(spot - 1)] == ord(' ')))
                return TRUE;
        }
    }
    return FALSE;
}

/* compare user string against object name string using fuzzy matching */
function wishymatch(
    u_str,
    o_str,
    retry_inverted) { /* boolean */ /* optional extra "of" handling */
    const $frame = stack_frame(); try {
    let detect_SP = init_string(static_array("wishymatch.detect_SP", char, sizeof_string("detect ")), _("detect "), true),
                               SP_detection = init_string(static_array("wishymatch.SP_detection", char, sizeof_string(" detection")), _(" detection"), true);
    let p, buf = stack_array(char, BUFSZ);

    /* ignore spaces & hyphens and upper/lower case when comparing */
    if (fuzzymatch(u_str, o_str, _(" -"), TRUE))
        return TRUE;

    if (retry_inverted) {
        let u_of, o_of;

        /* when just one of the strings is in the form "foo of bar",
           convert it into "bar foo" and perform another comparison */
        u_of = strstri(u_str, _(" of "));
        o_of = strstri(o_str, _(" of "));
        if (u_of && !o_of) {
            strcpy(buf, u_of + 4);
            copynchars(eos(strcat(buf, _(" "))), u_str, (u_of - u_str));
            if (fuzzymatch(buf, o_str, _(" -"), TRUE))
                return TRUE;
        } else if (o_of && !u_of) {
            strcpy(buf, o_of + 4);
            copynchars(eos(strcat(buf, _(" "))), o_str, (o_of - o_str));
            if (fuzzymatch(u_str, buf, _(" -"), TRUE))
                return TRUE;
        }
    }

    /* [note: if something like "elven speed boots" ever gets added, these
       special cases should be changed to call wishymatch() recursively in
       order to get the "of" inversion handling] */
    if (!strncmp(o_str, _("dwarvish "), 9)) {
        if (!strncmpi(u_str, _("dwarven "), 8))
            return fuzzymatch(u_str + 8, o_str + 9, _(" -"), TRUE);
    } else if (!strncmp(o_str, _("elven "), 6)) {
        if (!strncmpi(u_str, _("elvish "), 7))
            return fuzzymatch(u_str + 7, o_str + 6, _(" -"), TRUE);
        else if (!strncmpi(u_str, _("elfin "), 6))
            return fuzzymatch(u_str + 6, o_str + 6, _(" -"), TRUE);
    } else if (strstri(o_str, _("helm")) && strstri(u_str, _("helmet"))) {
        copynchars(buf, u_str, sizeof(array_of(char, BUFSZ)) - 1);
        strsubst(buf, _("helmet"), _("helm"));
        return wishymatch(buf, o_str,  TRUE);
    } else if (strstri(o_str, _("gauntlets")) && strstri(u_str, _("gloves"))) {
        /* -3: room to replace shorter "gloves" with longer "gauntlets" */
        copynchars(buf, u_str, sizeof(array_of(char, BUFSZ)) - 1 - 3);
        strsubst(buf, _("gloves"), _("gauntlets"));
        return wishymatch(buf, o_str, TRUE);
    } else if (!strncmp(o_str, detect_SP, sizeof_string("detect ") - 1)) {
        /* check for "detect <foo>" vs "<foo> detection" */
        if ((p = strstri(u_str, SP_detection)) != 0
            && !chars[(p + sizeof_string(" detection") - 1)]) {
            /* convert "<foo> detection" into "detect <foo>" */
            chars[p] = ord('\0');
            strcat(strcpy(buf, detect_SP), u_str);
            /* "detect monster" -> "detect monsters" */
            if (!strncmpi((u_str), _(("monster")), -1))
                strcat(buf, _("s"));
            chars[p] = ord(' ');
            return fuzzymatch(buf, o_str, _(" -"), TRUE);
        }
    } else if (strstri(o_str, SP_detection)) {
        /* and the inverse, "<foo> detection" vs "detect <foo>" */
        if (!strncmpi(u_str, detect_SP, sizeof_string("detect ") - 1)) {
            /* convert "detect <foo>s" into "<foo> detection" */
            p = makesingular(u_str + sizeof_string("detect ") - 1);
            strcat(strcpy(buf, p), SP_detection);
            /* caller may be looping through objects[], so avoid
               churning through all the obufs */
            releaseobuf(p);
            return fuzzymatch(buf, o_str, _(" -"), TRUE);
        }
    } else if (strstri(o_str, _("ability"))) {
        /* when presented with "foo of bar", makesingular() used to
           singularize both foo & bar, but now only does so for foo */
        /* catch "{potion(s),ring} of {gain,restore,sustain} abilities" */
        if ((p = strstri(u_str, _("abilities"))) != 0
            && !chars[(p + sizeof_string("abilities") - 1)]) {
            strncpy(buf, u_str, unsigned((p - u_str)));
            strcpy(buf + (p - u_str), _("ability"));
            return fuzzymatch(buf, o_str, _(" -"), TRUE);
        }
    } else if (!strcmp(o_str, _("aluminum"))) {
        /* this special case doesn't really fit anywhere else... */
        /* (note that " wand" will have been stripped off by now) */
        if (!strncmpi((u_str), _(("aluminium")), -1))
            return fuzzymatch(u_str + 9, o_str + 8, _(" -"), TRUE);
    }

    return FALSE;
    } finally { stack_pop($frame); }
}

const struct_o_range = struct("struct_o_range", {
    name: ptr_to(char), oclass: char,
    f_o_range: int, l_o_range: int,
});

/* wishable subranges of objects */
const o_ranges = static_array("o_ranges", struct_o_range, null, [
    { name: _("bag"), oclass: TOOL_CLASS, f_o_range: SACK, l_o_range: BAG_OF_TRICKS },
    { name: _("lamp"), oclass: TOOL_CLASS, f_o_range: OIL_LAMP, l_o_range: MAGIC_LAMP },
    { name: _("candle"), oclass: TOOL_CLASS, f_o_range: TALLOW_CANDLE, l_o_range: WAX_CANDLE },
    { name: _("horn"), oclass: TOOL_CLASS, f_o_range: TOOLED_HORN, l_o_range: HORN_OF_PLENTY },
    { name: _("shield"), oclass: ARMOR_CLASS, f_o_range: SMALL_SHIELD, l_o_range: SHIELD_OF_REFLECTION },
    { name: _("hat"), oclass: ARMOR_CLASS, f_o_range: FEDORA, l_o_range: DUNCE_CAP },
    { name: _("helm"), oclass: ARMOR_CLASS, f_o_range: ELVEN_LEATHER_HELM, l_o_range: HELM_OF_TELEPATHY },
    { name: _("gloves"), oclass: ARMOR_CLASS, f_o_range: LEATHER_GLOVES, l_o_range: GAUNTLETS_OF_DEXTERITY },
    { name: _("gauntlets"), oclass: ARMOR_CLASS, f_o_range: LEATHER_GLOVES, l_o_range: GAUNTLETS_OF_DEXTERITY },
    { name: _("boots"), oclass: ARMOR_CLASS, f_o_range: LOW_BOOTS, l_o_range: LEVITATION_BOOTS },
    { name: _("shoes"), oclass: ARMOR_CLASS, f_o_range: LOW_BOOTS, l_o_range: IRON_SHOES },
    { name: _("cloak"), oclass: ARMOR_CLASS, f_o_range: MUMMY_WRAPPING, l_o_range: CLOAK_OF_DISPLACEMENT },
    { name: _("shirt"), oclass: ARMOR_CLASS, f_o_range: HAWAIIAN_SHIRT, l_o_range: T_SHIRT },
    { name: _("dragon scales"), oclass: ARMOR_CLASS, f_o_range: GRAY_DRAGON_SCALES,
      l_o_range: YELLOW_DRAGON_SCALES },
    { name: _("dragon scale mail"), oclass: ARMOR_CLASS, f_o_range: GRAY_DRAGON_SCALE_MAIL,
      l_o_range: YELLOW_DRAGON_SCALE_MAIL },
    { name: _("sword"), oclass: WEAPON_CLASS, f_o_range: SHORT_SWORD, l_o_range: KATANA },
    { name: _("venom"), oclass: VENOM_CLASS, f_o_range: BLINDING_VENOM, l_o_range: ACID_VENOM },
    { name: _("gray stone"), oclass: GEM_CLASS, f_o_range: LUCKSTONE, l_o_range: FLINT },
    { name: _("grey stone"), oclass: GEM_CLASS, f_o_range: LUCKSTONE, l_o_range: FLINT },
]);

/* alternate spellings; if the difference is only the presence or
   absence of spaces and/or hyphens (such as "pickaxe" vs "pick axe"
   vs "pick-axe") then there is no need for inclusion in this list;
   likewise for ``"of" inversions'' ("boots of speed" vs "speed boots") */
  const struct_alt_spellings = struct("struct_alt_spellings", {
    sp: ptr_to(char),
    ob: int,
}); const spellings = static_array("spellings", struct_alt_spellings, null, [
    { sp: _("pickax"), ob: PICK_AXE },
    { sp: _("whip"), ob: BULLWHIP },
    { sp: _("saber"), ob: SILVER_SABER },
    { sp: _("silver sabre"), ob: SILVER_SABER },
    { sp: _("smooth shield"), ob: SHIELD_OF_REFLECTION },
    { sp: _("grey dragon scale mail"), ob: GRAY_DRAGON_SCALE_MAIL },
    { sp: _("grey dragon scales"), ob: GRAY_DRAGON_SCALES },
    { sp: _("iron ball"), ob: HEAVY_IRON_BALL },
    { sp: _("lantern"), ob: BRASS_LANTERN },
    { sp: _("mattock"), ob: DWARVISH_MATTOCK },
    { sp: _("amulet of poison resistance"), ob: AMULET_VERSUS_POISON },
    { sp: _("amulet of protection"), ob: AMULET_OF_GUARDING },
    { sp: _("amulet of telepathy"), ob: AMULET_OF_ESP },
    { sp: _("helm of esp"), ob: HELM_OF_TELEPATHY },
    { sp: _("gauntlets of ogre power"), ob: GAUNTLETS_OF_POWER },
    { sp: _("gauntlets of giant strength"), ob: GAUNTLETS_OF_POWER },
    { sp: _("elven chain mail"), ob: ELVEN_MITHRIL_COAT },
    { sp: _("silver shield"), ob: SHIELD_OF_REFLECTION },
    { sp: _("potion of sleep"), ob: POT_SLEEPING },
    { sp: _("scroll of recharging"), ob: SCR_CHARGING },
    { sp: _("recharging"), ob: SCR_CHARGING },
    { sp: _("stone"), ob: ROCK },
    { sp: _("camera"), ob: EXPENSIVE_CAMERA },
    { sp: _("tee shirt"), ob: T_SHIRT },
    { sp: _("can"), ob: TIN },
    { sp: _("can opener"), ob: TIN_OPENER },
    { sp: _("kelp"), ob: KELP_FROND },
    { sp: _("eucalyptus"), ob: EUCALYPTUS_LEAF },
    { sp: _("lembas"), ob: LEMBAS_WAFER },
    { sp: _("tripe"), ob: TRIPE_RATION },
    { sp: _("cookie"), ob: FORTUNE_COOKIE },
    { sp: _("pie"), ob: CREAM_PIE },
    { sp: _("huge meatball"), ob: ENORMOUS_MEATBALL }, /* likely conflated name */
    { sp: _("huge chunk of meat"), ob: ENORMOUS_MEATBALL }, /* original name */
    { sp: _("marker"), ob: MAGIC_MARKER },
    { sp: _("hook"), ob: GRAPPLING_HOOK },
    { sp: _("grappling iron"), ob: GRAPPLING_HOOK },
    { sp: _("grapnel"), ob: GRAPPLING_HOOK },
    { sp: _("grapple"), ob: GRAPPLING_HOOK },
    { sp: _("protection from shape shifters"), ob: RIN_PROTECTION_FROM_SHAPE_CHAN },
    { sp: _("accuracy"), ob: RIN_INCREASE_ACCURACY },
    /* if we ever add other sizes, move this to o_ranges[] with "bag" */
    { sp: _("box"), ob: LARGE_BOX },
    /* normally we wouldn't have to worry about unnecessary <space>, but
       " stone" will get stripped off, preventing a wishymatch; that actually
       lets "flint stone" be a match, so we also accept bogus "flintstone" */
    { sp: _("luck stone"), ob: LUCKSTONE },
    { sp: _("load stone"), ob: LOADSTONE },
    { sp: _("touch stone"), ob: TOUCHSTONE },
    { sp: _("flintstone"), ob: FLINT },
    { sp: 0, ob: 0 },
]);

function rnd_otyp_by_wpnskill(skill) { /* short */
    let i, n = 0;
    let otyp = STRANGE_OBJECT;

    for (i = svb.bases[WEAPON_CLASS];
         i < NUM_OBJECTS && objects[i].oc_class == WEAPON_CLASS; i++)
        if (objects[i].oc_subtyp == skill) {
            n++;
            otyp = i;
        }
    if (n > 0) {
        n = rn2(n);
        for (i = svb.bases[WEAPON_CLASS];
             i < NUM_OBJECTS && objects[i].oc_class == WEAPON_CLASS; i++)
            if (objects[i].oc_subtyp == skill)
                if (--n < 0)
                    return i;
    }
    return otyp;
}

function rnd_otyp_by_namedesc(
    name,
    oclass,
    xtra_prob) { /* short */ /* add to item's chance of being chosen; non-zero causes * 0% random generation items to also be considered */
    const $frame = stack_frame(); try {
    let i, n = 0;
    let validobjs = stack_array(short, NUM_OBJECTS);
    let zn, of;
    let check_of;
    let lo, hi, minglob, maxglob, prob, maxprob = 0;

    if (!name || !chars[name])
        return STRANGE_OBJECT;

    /* only skip "foo of" for "foo of bar" if target doesn't contain " of " */
    check_of = +(strstri(name, _(" of ")) == 0);
    minglob = GLOB_OF_GRAY_OOZE;
    maxglob = GLOB_OF_BLACK_PUDDING;

    memset(addr_of(validobjs), 0, sizeof(array_of(short, NUM_OBJECTS)));
    if (oclass) {
        lo = svb.bases[uchar(oclass)];
        hi = svb.bases[uchar(oclass) + 1] - 1;
    } else {
        lo = MAXOCLASSES; /* STRANGE_OBJECT + 1; */
        hi = NUM_OBJECTS - 1;
    }
    /* FIXME:
     * When this spans classes (the !oclass case), the item
     * probabilities are not very useful because they don't take
     * the class generation probability into account.  [If 10%
     * of spellbooks were blank and 1% of scrolls were blank,
     * "blank" would have 10/11 chance to yield a book even though
     * scrolls are supposed to be much more common than books.]
     */
    for (i = lo; i <= hi; ++i) {
        /* don't match extra descriptions (w/o real name) */
        if ((zn = OBJ_NAME(objects[i])) == 0)
            continue;
        if (wishymatch(name, zn, TRUE) /* objects[] name */
            /* let "<bar>" match "<foo> of <bar>" (already does if foo is
               an object class, but this is for lump of royal jelly,
               clove of garlic, bag of tricks, &c) with a few exceptions:
               for "opening", don't match "bell of opening"; for monster
               type ooze/pudding/slime don't match glob of same since that
               ought to match "corpse/egg/figurine of type" too but won't */
            || (check_of
                && i != BELL_OF_OPENING
                && (i < minglob || i > maxglob)
                && (of = strstri(zn, _(" of "))) != 0
                && wishymatch(name, of + 4, FALSE)) /* partial name */
            || ((zn = OBJ_DESCR(objects[i])) != 0
                && wishymatch(name, zn, FALSE)) /* objects[] description */
            /* "cloth" should match "piece of cloth"; there's only one
               description containing " of " so no special case handling */
            || (zn && check_of && (of = strstri(zn, _(" of "))) != 0
                && wishymatch(name, of + 4, FALSE)) /* partial description */
            || ((zn = objects[i].oc_uname) != 0
                && wishymatch(name, zn, FALSE)) /* user-called name */
            ) {
            validobjs[n++] = short(i);
            maxprob += (objects[i].oc_prob + xtra_prob);
        }
    }

    if (n > 0 && maxprob) {
        prob = rn2(maxprob);
        for (i = 0; i < n - 1; i++)
            if ((prob -= (objects[validobjs[i]].oc_prob + xtra_prob)) < 0)
                break;
        return validobjs[i];
    }
    return STRANGE_OBJECT;
    } finally { stack_pop($frame); }
}

export function shiny_obj(oclass) { /* int */
    return rnd_otyp_by_namedesc(_("shiny"), oclass, 0);
}

/* set wall under hero undiggable/unphaseable from string */
function set_wallprop_from_str(bp) { /* void */
    let wall_prop = 0;

    if (strstr(bp, _("undiggable ")) || strstr(bp, _("nondiggable ")))
        wall_prop |= W_NONDIGGABLE;
    if (strstr(bp, _("unphaseable ")) || strstr(bp, _("nonpasswall ")))
        wall_prop |= W_NONPASSWALL;
    /* |= because wall_info (aka flags) is overloaded with other stuff */
    if (wall_prop)
        levl()[u.ux][u.uy].flags |= wall_prop;
}

/* in wizard mode, readobjnam() can accept wishes for traps and terrain */
function wizterrainwish(d) { /* struct obj * */
    const $frame = stack_frame(); try {
    let lev;
    let madeterrain = FALSE, badterrain = FALSE, is_dbridge;
    let trap;
    let oldtyp, ltyp;
    let x = u.ux, y = u.uy;
    let bp = d.bp, p;

    for (trap = NO_TRAP + 1; trap < TRAPNUM; trap++) {
        let t;
        let tname;

        tname = trapname(trap, TRUE);
        if (!str_start_is(bp, tname, TRUE))
            continue;
        /* found it; avoid stupid mistakes */
        if (is_hole(trap) && !Can_fall_thru(u.uz))
            trap = ROCKTRAP;
        if ((t = maketrap(x, y, trap)) != null) {
            trap = t.ttyp;
            tname = trapname(trap, TRUE);
            pline(_("%s%s."), An(tname),
                  (trap != MAGIC_PORTAL) ? _("") : _(" to nowhere"));
        } else {
            pline(_("Creation of %s failed."), an(tname));
        }
        return hands_obj;
    }

    /* furniture and terrain (use at your own risk; can clobber stairs
       or place furniture on existing traps which shouldn't be allowed) */
    lev = levl()[x][y];
    oldtyp = unsigned(lev.typ);
    is_dbridge = +(oldtyp == DRAWBRIDGE_DOWN || oldtyp == DRAWBRIDGE_UP);
    p = eos(bp);
    if (!BSTRCMPI(bp, p - 8, _("fountain"))) {
        lev.typ = FOUNTAIN;
        if (oldtyp != FOUNTAIN)
            svl.level.flags.nfountains++;
        lev.flags = d.flags ? F_LOOTED : 0; /* overlays 'flags' */
        lev.horizontal = (d.blessed || !strncmpi(bp, _("magic "), 6) ? 1 : 0);
        pline(_("A %sfountain."), lev.horizontal ? _("magic ") : _(""));
        madeterrain = TRUE;
    } else if (!BSTRCMPI(bp, p - 6, _("throne"))) {
        lev.typ = THRONE;
        lev.flags = d.flags ? T_LOOTED : 0; /* overlays 'flags' */
        pline(_("A throne."));
        madeterrain = TRUE;
    } else if (!BSTRCMPI(bp, p - 4, _("sink"))) {
        lev.typ = SINK;
        if (oldtyp != SINK)
            svl.level.flags.nsinks++;
        lev.flags = d.flags ? (S_LPUDDING | S_LDWASHER | S_LRING) : 0;
        pline(_("A sink."));
        madeterrain = TRUE;

    /* ("water" matches "potion of water" rather than terrain) */
    } else if (!BSTRCMPI(bp, p - 4, _("pool"))
               || !BSTRCMPI(bp, p - 4, _("moat"))
               || !BSTRCMPI(bp, p - 13, _("wall of water"))) {
        let save_prop;
        let new_water;

        ltyp = !BSTRCMPI(bp, p - 4, _("pool")) ? POOL
               : !BSTRCMPI(bp, p - 4, _("moat")) ? MOAT
                 : WATER;
        if (!is_dbridge) {
            lev.typ = schar(ltyp);
            lev.flags = 0;
        } else {
            /* drawbridgemask overloads flags */
            lev.flags &= ~DB_UNDER;
            lev.flags |= DB_MOAT;
        }
        del_engr_at(x, y);
        if (!is_dbridge) {
            save_prop = EHalluc_resistance();
            u.uprops[HALLUC_RES].extrinsic = 1;
            new_water = waterbody_name(x, y);
            u.uprops[HALLUC_RES].extrinsic = save_prop;
            pline(_("%s."), An(new_water));
            /* Must manually make kelp! */
        } else {
            dbterrainmesg(_("Moat"), x, y);
        }
        water_damage_chain(svl.level.objects[x][y], TRUE);
        madeterrain = TRUE;

    /* also matches "molten lava" */
    } else if (!BSTRCMPI(bp, p - 4, _("lava"))
               || !BSTRCMPI(bp, p - 12, _("wall of lava"))) {
        ltyp = !BSTRCMPI(bp, p - 12, _("wall of lava")) ? LAVAWALL : LAVAPOOL;
        if (!is_dbridge) {
            lev.typ = schar(ltyp);
            lev.flags = 0;
        } else {
            /* drawbridgemask overloads flags */
            lev.flags &= ~DB_UNDER;
            lev.flags |= DB_LAVA;
        }
        del_engr_at(x, y);
        if (!is_dbridge) {
            pline(_("A %s of molten lava."),
                  (lev.typ == LAVAPOOL) ? _("pool") : _("wall"));
            if (!(Levitation() || Flying()) || lev.typ == LAVAWALL)
                pooleffects(FALSE);
        } else {
            dbterrainmesg(_("Lava"), x, y);
        }
        fire_damage_chain(svl.level.objects[x][y], TRUE, TRUE, x, y);
        madeterrain = TRUE;
    } else if (!BSTRCMPI(bp, p - 3, _("ice"))) {
        if (!is_dbridge) {
            lev.typ = ICE;
            /* icedpool overloads flags; specifies what ice will melt into */
            lev.flags = (oldtyp == ROOM) ? ICED_POOL : ICED_MOAT;
        } else {
            /* drawbridgemask overloads flags */
            lev.flags &= ~DB_UNDER;
            lev.flags |= DB_ICE;
        }
        del_engr_at(x, y);

        if (!strncmpi(bp, _("melting "), 8))
            start_melt_ice_timeout(x, y, 0);

        if (!is_dbridge) {
            let icebuf = stack_array(char, 40);

            pline(_("%s."), upstart(ice_descr(x, y, icebuf)));
        } else {
            dbterrainmesg(_("Ice"), x, y);
        }
        madeterrain = TRUE;
    } else if (!BSTRCMPI(bp, p - 5, _("altar"))) {
        let al;

        lev.typ = ALTAR;
        if (!strncmpi(bp, _("chaotic "), 8))
            al = A_CHAOTIC;
        else if (!strncmpi(bp, _("neutral "), 8))
            al = A_NEUTRAL;
        else if (!strncmpi(bp, _("lawful "), 7))
            al = A_LAWFUL;
        else if (!strncmpi(bp, _("unaligned "), 10))
            al = A_NONE;
        else /* -1 - A_CHAOTIC, 0 - A_NEUTRAL, 1 - A_LAWFUL */
            al = !rn2(6) ? A_NONE : (rn2(A_LAWFUL + 2) - 1);
        lev.flags = Align2amask(al); /* overlays 'flags' */
        pline(_("%s altar."), An(align_str(al)));
        madeterrain = TRUE;
    } else if (!BSTRCMPI(bp, p - 5, _("grave"))
               || !BSTRCMPI(bp, p - 9, _("headstone"))) {
        make_grave(x, y, 0);
        if (IS_GRAVE(lev.typ)) {
            lev.flags = 0; /* overlays 'flags' */
            lev.horizontal = d.flags ? 1 : 0;
            pline(_("A %sgrave."), lev.horizontal ? _("disturbed ") : _(""));
            madeterrain = TRUE;
        } else {
            pline(_("Can't place a grave here."));
            badterrain = TRUE;
        }
    } else if (!BSTRCMPI(bp, p - 4, _("tree"))) {
        lev.typ = TREE;
        lev.flags = d.flags ? (TREE_LOOTED | TREE_SWARM) : 0;
        set_wallprop_from_str(bp);
        pline(_("A tree."));
        madeterrain = TRUE;
    } else if (!BSTRCMPI(bp, p - 4, _("bars"))) {
        lev.typ = IRONBARS;
        lev.flags = 0;
        set_wallprop_from_str(bp);
        /* [FIXME: if this isn't a wall or door location where 'horizontal'
            is already set up, that should be calculated for this spot.
            Unfortunately, it can be tricky; placing one in open space
            and then another adjacent might need to recalculate first one.] */
        pline(_("Iron bars."));
        madeterrain = TRUE;
    } else if (!BSTRCMPI(bp, p - 5, _("cloud"))) {
        lev.typ = CLOUD;
        lev.flags = 0;
        pline(_("A cloud."));
        del_engr_at(x, y);
        madeterrain = TRUE;
    } else if (!BSTRCMPI(bp, p - 4, _("door"))
               || (d.doorless && !BSTRCMPI(bp, p - 7, _("doorway")))) {
        let dbuf = stack_array(char, 40);
        let old_wall_info;
        let secret = +!BSTRCMPI(bp, p - 11, _("secret door"));

        /* require door or wall so that the 'horizontal' flag will
           already have the correct value; player might choose to put
           DOOR on top of existing DOOR or SDOOR on top of existing SDOOR
           to control its trapped state; iron bars are surrogate walls;
           a previously dug wall looks like corridor but is actually a
           doorless doorway so will be acceptable here */
        if (lev.typ == DOOR || lev.typ == SDOOR
            || (IS_WALL(lev.typ) && lev.typ != DBWALL)
            || lev.typ == IRONBARS) {
            /* remember previous wall info [is this right for iron bars?] */
            old_wall_info = (lev.typ != DOOR) ? lev.flags : 0;
            /* set the new terrain type */
            lev.typ = secret ? SDOOR : DOOR;
            lev.flags = 0; /* overlays 'flags' */
            /* lev->horizontal stays as-is */
            if (Is_rogue_level(u.uz)) {
                /* all doors on the rogue level are doorless; locking magic
                   there converts them into walls rather than closed doors */
                d.doorless = 1;
                d.locked = d.closed = d.open = d.broken = 0;
            }
            /* if not locked, secret doors are implicitly closed but
               mustn't be set that way explicitly because they use both
               doormask and wall_info which both overload rm[x][y].flags
               (CLOSED overlaps wall_info bits, LOCKED and TRAPPED don't);
               conversion from SDOOR to DOOR changes NODOOR to CLOSED */
            lev.flags = d.locked ? D_LOCKED
                            : (d.doorless || secret) ? D_NODOOR
                              : d.open ? D_ISOPEN
                                : d.broken ? D_BROKEN
                                  : D_CLOSED;
            /* SDOOR uses wall_info, restore relevant bits.
             * FIXME? if we're changing a regular door into a secret door,
             * old_wall_info bits will be 0 instead of being set properly.
             * Probably only matters if player uses Passes_walls and a wish
             * to turn a T- or cross-wall into a door, losing wall info,
             * and then another wish to turn that door into a secret door. */
            if (secret)
                lev.flags |= (old_wall_info & WM_MASK);
            /* set up trapped flag; open door states aren't eligible */
            if (d.trapped == 2 /* 2: wish includes explicit "untrapped" */
                || ((lev.flags & (D_LOCKED | D_CLOSED)) == 0
                    /* D_CLOSED is implicit for secret doors */
                    && !secret))
                d.trapped = 0;
            if (d.trapped)
                lev.flags |= D_TRAPPED;
            /* feedback */
            chars[dbuf + 0] = ord('\0');
            if (lev.flags & D_TRAPPED)
                strcat(dbuf, _("trapped "));
            if (lev.flags & D_LOCKED)
                strcat(dbuf, _("locked "));
            if (lev.typ == SDOOR) {
                strcat(dbuf, _("secret door"));
            } else {
                /* these should be mutually exclusive but we describe them
                   as if they're independent to maybe catch future bugs... */
                if (lev.flags & D_CLOSED)
                    strcat(dbuf, _("closed "));
                if (lev.flags & D_ISOPEN)
                    strcat(dbuf, _("open "));
                if (lev.flags & D_BROKEN)
                    strcat(dbuf, _("broken "));
                if ((lev.flags & ~D_TRAPPED) == D_NODOOR)
                    strcat(dbuf, _("doorless doorway"));
                else
                    strcat(dbuf, _("door"));
            }
            pline(_("%s."), upstart(an(dbuf)));
            madeterrain = TRUE;
        } else {
            strcpy(dbuf, secret ? _("secret door") : _("door"));
            pline(_("%s requires door or wall location."), upstart(dbuf));
            badterrain = TRUE;
        }
    } else if (!BSTRCMPI(bp, p - 4, _("wall"))
                         && (bp == p - 4 || chars[p + (-5)] == ord(' '))) {
        let wall = HWALL;

        if ((isok(u.ux, u.uy-1) && IS_WALL(elt(levl()[u.ux], u.uy-1).typ))
            || (isok(u.ux, u.uy+1) && IS_WALL(levl()[u.ux][u.uy+1].typ)))
            wall = VWALL;
        madeterrain = TRUE;
        lev.typ = wall;
        lev.flags = 0;
        set_wallprop_from_str(bp);
        fix_wall_spines(max(0,u.ux-1), max(0,u.uy-1),
                        min(COLNO,u.ux+1), min(ROWNO,u.uy+1));
        pline(_("A wall."));
    } else if (!BSTRCMPI(bp, p - 15, _("secret corridor"))) {
        if (lev.typ == CORR) {
            lev.typ = SCORR;
            /* neither CORR nor SCORR uses 'flags' or 'horizontal' */
            pline(_("Secret corridor."));
            madeterrain = TRUE;
        } else {
            pline(_("Secret corridor requires corridor location."));
            badterrain = TRUE;
        }
    } else if (!BSTRCMPI(bp, p - 4, _("room"))
               || !BSTRCMPI(bp, p - 5, _("floor"))
               || !BSTRCMPI(bp, p - 6, _("ground"))) {
        if (oldtyp == ROOM
            || (IS_FURNITURE(oldtyp) && CAN_OVERWRITE_TERRAIN(oldtyp))
            || oldtyp == ICE || is_pool_or_lava(x, y)) {
            let t;

            lev.typ = ROOM;
            pline(_("Room floor."));
            if (IS_FURNITURE(oldtyp))
                count_level_features();
            if ((t = t_at(x, y)) != null && t.ttyp != MAGIC_PORTAL)
                deltrap(t);
            madeterrain = TRUE;
        } else if (is_dbridge) {
            lev.flags &= ~DB_UNDER;
            lev.flags |= DB_FLOOR;
            dbterrainmesg(_("Floor"), x, y);
            madeterrain = TRUE;
        } else {
            pline(_("Room|floor|ground not allowed here."));
            badterrain = TRUE;
        }
    }

    if (madeterrain) {
        feel_newsym(x, y); /* map the spot where the wish occurred */

        /* hero started at <x,y> but might not be there anymore (create
           lava, decline to die, and get teleported away to safety) */
        if (u.uinwater && !is_pool(u.ux, u.uy)) {
            set_uinwater(0); /* u.uinwater = 0; leave the water */
            docrt();
            /* [block/unblock_point handled by docrt -> vision_recalc] */
        } else {
            if (u.utrap && u.utraptype == TT_LAVA && !is_lava(u.ux, u.uy))
                reset_utrap(FALSE);
            recalc_block_point(x, y);
        }

        /* fixups for replaced terrain that aren't handled above */
        if (IS_FOUNTAIN(oldtyp) || IS_SINK(oldtyp))
            count_level_features(); /* update level.flags.nfountains,nsinks */
        if (!is_ice(x, y))
            spot_stop_timers(x, y, MELT_ICE_AWAY);
        /* horizontal is overlaid by fountain->blessedftn, grave->disturbed */
        if (IS_FOUNTAIN(oldtyp) || IS_GRAVE(oldtyp)
            || IS_WALL(oldtyp) || oldtyp == IRONBARS
            || IS_DOOR(oldtyp) || oldtyp == SDOOR) {
            /* when new terrain is a fountain, 'blessedftn' was explicitly
               set above; likewise for grave and 'disturbed'; when it's a
               door, the old type was a wall or a door and we retain the
               'horizontal' value from those */
            if (!IS_FOUNTAIN(lev.typ) && !IS_GRAVE(lev.typ)
                && !IS_DOOR(lev.typ) && lev.typ != SDOOR)
                lev.horizontal = 0; /* also clears blessedftn, disturbed */
        }
        /* note: lev->lit and lev->nondiggable retain their values even
           though those might not make sense with the new terrain */

        /* might have changed terrain from something that blocked
           levitation and flying to something that doesn't (levitating
           while in xorn form and replacing solid stone with furniture) */
        switch_terrain();
    }
    if (madeterrain || badterrain)
        return hands_obj;

    return null;
    } finally { stack_pop($frame); }
}

/* message common to several wizterrainwish() results */
function dbterrainmesg(
    newtype,
    x, y) { /* void */
    pline(_("%s %s the drawbridge."), newtype,
          (levl()[x][y].typ == DRAWBRIDGE_UP) ? _("in front of") : _("under"));
}

export const TIN_UNDEFINED = 0;
export const TIN_EMPTY = 1;
export const TIN_SPINACH = 2;

function readobjnam_init(bp, d) { /* void */
    d.otmp = null;
    d.cnt = d.spe = d.spesgn = d.typ = 0;
    d.very = d.rechrg = d.blessed = d.uncursed = d.iscursed
        = d.ispoisoned = d.isgreased = d.eroded = d.eroded2
        = d.erodeproof = d.halfeaten = d.islit = d.unlabeled
        = d.ishistoric = d.isdiluted /* statues, potions */
          /* box/chest and wizard mode door */
        = d.trapped = d.locked = d.unlocked = d.broken
        = d.open = d.closed = d.doorless /* wizard mode door */
        = d.flags /* wizard mode fountain/sink/throne/tree and grave */
        = d.real = d.fake = 0; /* Amulet */
    d.tvariety = RANDOM_TIN;
    d.mgend = -1; /* not specified, aka random */
    d.mntmp = NON_PM;
    d.contents = TIN_UNDEFINED;
    d.oclass = 0;
    d.actualn = d.dn = d.un = 0;
    d.wetness = 0;
    d.gsize = 0;
    d.zombify = FALSE;
    d.bp = d.origbp = bp;
    d.p = 0;
    d.name = 0;
    d.ftype = svc.context.current_fruit;
    memset(d.globbuf, ord('\0'), sizeof_member(d, "globbuf"));
    memset(d.fruitbuf, ord('\0'), sizeof_member(d, "fruitbuf"));
}

/* return 1 if d->bp is empty or contains only various qualifiers like
   "blessed", "rustproof", and so on, or 0 if anything else is present */
function readobjnam_preparse(d) { /* int */
    let save_bp = 0;
    let more_l = 0, res = 1;

    for (;;) {
        let l;

        if (!d.bp || !chars[d.bp])
            break;
        res = 0;

        if (!strncmpi(d.bp, _("an "), l = 3) || !strncmpi(d.bp, _("a "), l = 2)) {
            d.cnt = 1;
        } else if (!strncmpi(d.bp, _("the "), l = 4)) {
            ; /* just increment `bp' by `l' below */
        } else if (!d.cnt && digit(chars[d.bp]) && strcmp(d.bp, _("0"))) {
            d.cnt = atoi(d.bp);
            while (digit(chars[d.bp]))
                d.bp++;
            while (chars[d.bp] == ord(' '))
                d.bp++;
            l = 0;
        } else if (chars[d.bp] == ord('+') || chars[d.bp] == ord('-')) {
            d.spesgn = (chars[d.bp++] == ord('+')) ? 1 : -1;
            d.spe = atoi(d.bp);
            while (digit(chars[d.bp]))
                d.bp++;
            while (chars[d.bp] == ord(' '))
                d.bp++;
            l = 0;
        } else if (!strncmpi(d.bp, _("blessed "), l = 8)
                   || !strncmpi(d.bp, _("holy "), l = 5)) {
            d.blessed = 1, d.uncursed = d.iscursed = 0;
        } else if (!strncmpi(d.bp, _("cursed "), l = 7)
                   || !strncmpi(d.bp, _("unholy "), l = 7)) {
            d.iscursed = 1, d.blessed = d.uncursed = 0;
        } else if (!strncmpi(d.bp, _("uncursed "), l = 9)) {
            d.uncursed = 1, d.blessed = d.iscursed = 0;
        } else if (!strncmpi(d.bp, _("rustproof "), l = 10)
                   || !strncmpi(d.bp, _("erodeproof "), l = 11)
                   || !strncmpi(d.bp, _("corrodeproof "), l = 13)
                   || !strncmpi(d.bp, _("fixed "), l = 6)
                   || !strncmpi(d.bp, _("fireproof "), l = 10)
                   || !strncmpi(d.bp, _("rotproof "), l = 9)
                   || !strncmpi(d.bp, _("tempered "), l = 9)
                   || !strncmpi(d.bp, _("crackproof "), l = 11)) {
            d.erodeproof = 1;
        } else if (!strncmpi(d.bp, _("lit "), l = 4)
                   || !strncmpi(d.bp, _("burning "), l = 8)) {
            d.islit = 1;
        } else if (!strncmpi(d.bp, _("unlit "), l = 6)
                   || !strncmpi(d.bp, _("extinguished "), l = 13)) {
            d.islit = 0;

        /* "wet" and "moist" are only applicable for towels */
        } else if (!strncmpi(d.bp, _("moist "), l = 6)
                   || !strncmpi(d.bp, _("wet "), l = 4)) {
            if (!strncmpi(d.bp, _("wet "), 4))
                d.wetness = 3 + rn2(3); /* 3..5 */
            else
                d.wetness = rnd(2); /* 1..2 */

        /* "unlabeled" and "blank" are synonymous */
        } else if (!strncmpi(d.bp, _("unlabeled "), l = 10)
                   || !strncmpi(d.bp, _("unlabelled "), l = 11)
                   || !strncmpi(d.bp, _("blank "), l = 6)) {
            d.unlabeled = 1;
        } else if (!strncmpi(d.bp, _("poisoned "), l = 9)) {
            d.ispoisoned = 1;

        /* "trapped" recognized but not honored outside wizard mode */
        } else if (!strncmpi(d.bp, _("trapped "), l = 8)) {
            d.trapped = 0; /* undo any previous "untrapped" */
            if (wizard())
                d.trapped = 1;
        } else if (!strncmpi(d.bp, _("untrapped "), l = 10)) {
            d.trapped = 2; /* not trapped */

        /* locked, unlocked, broken: box/chest lock states, also door states;
           open, closed, doorless: additional door states */
        } else if (!strncmpi(d.bp, _("locked "), l = 7)) {
            d.locked = d.closed = 1,
                d.unlocked = d.broken = d.open = d.doorless = 0;
        } else if (!strncmpi(d.bp, _("unlocked "), l = 9)) {
            d.unlocked = d.closed = 1,
                d.locked = d.broken = d.open = d.doorless = 0;
        } else if (!strncmpi(d.bp, _("broken "), l = 7)) {
            d.broken = 1,
                d.locked = d.unlocked = d.open = d.closed
                = d.doorless = 0;
        } else if (!strncmpi(d.bp, _("open "), l = 5)) {
            d.open = 1,
                d.closed = d.locked = d.broken = d.doorless = 0;
        } else if (!strncmpi(d.bp, _("closed "), l = 7)) {
            d.closed = 1,
                d.open = d.locked = d.broken = d.doorless = 0;
        } else if (!strncmpi(d.bp, _("doorless "), l = 9)) {
            d.doorless = 1,
                d.open = d.closed = d.locked = d.unlocked = d.broken = 0;
        /* looted: fountain/sink/throne/tree; disturbed: grave */
        } else if (!strncmpi(d.bp, _("looted "), l = 7)
                   /* overload disturbed grave with looted fountain here
                      even though they're separate in struct rm */
                   || !strncmpi(d.bp, _("disturbed "), l = 10)) {
            d.flags = 1;
        } else if (!strncmpi(d.bp, _("greased "), l = 8)) {
            d.isgreased = 1;
        } else if (!strncmpi(d.bp, _("zombifying "), l = 11)) {
            d.zombify = TRUE;
        } else if (!strncmpi(d.bp, _("very "), l = 5)) {
            /* very rusted very heavy iron ball */
            d.very = 1;
        } else if (!strncmpi(d.bp, _("thoroughly "), l = 11)) {
            d.very = 2;
        } else if (!strncmpi(d.bp, _("rusty "), l = 6)
                   || !strncmpi(d.bp, _("rusted "), l = 7)
                   || !strncmpi(d.bp, _("burnt "), l = 6)
                   || !strncmpi(d.bp, _("burned "), l = 7)
                   || !strncmpi(d.bp, _("cracked "), l = 8)) {
            d.eroded = 1 + d.very;
            d.very = 0;
        } else if (!strncmpi(d.bp, _("corroded "), l = 9)
                   || !strncmpi(d.bp, _("rotted "), l = 7)) {
            d.eroded2 = 1 + d.very;
            d.very = 0;
        } else if (!strncmpi(d.bp, _("partly eaten "), l = 13)
                   || !strncmpi(d.bp, _("partially eaten "), l = 16)) {
            d.halfeaten = 1;
        } else if (!strncmpi(d.bp, _("historic "), l = 9)) {
            d.ishistoric = 1;
        } else if (!strncmpi(d.bp, _("diluted "), l = 8)) {
            d.isdiluted = 1;
        } else if (!strncmpi(d.bp, _("empty "), l = 6)) {
            d.contents = TIN_EMPTY;
        } else if (!strncmpi(d.bp, _("small "), l = 6)) { /* glob sizes */
            /* "small" might be part of monster name (mimic, if wishing
               for its corpse) rather than prefix for glob size; when
               used for globs, it might be either "small glob of <foo>" or
               "small <foo> glob" and user might add 's' even though plural
               doesn't accomplish anything because globs don't stack */
            if (strncmpi(d.bp + l, _("glob"), 4) && !strstri(d.bp + l, _(" glob")))
                break;
            d.gsize = 1;
        } else if (!strncmpi(d.bp, _("medium "), l = 7)) {
            /* 5.0: in 3.6, "medium" was only used during wishing and the
               mid-size glob had no adjective when formatted, but as of
               5.0, "medium" has become an explicit part of the name for
               combined globs of at least 5 individual ones (owt >= 100)
               and less than 15 (owt < 300) */
            d.gsize = 2;
        } else if (!strncmpi(d.bp, _("large "), l = 6)) {
            /* "large" might be part of monster name (dog, cat, kobold,
               mimic) or object name (box, round shield) rather than
               prefix for glob size */
            if (strncmpi(d.bp + l, _("glob"), 4) && !strstri(d.bp + l, _(" glob")))
                break;
            /* "very large " had "very " peeled off on previous iteration */
            d.gsize = (d.very != 1) ? 3 : 4;
        } else if (!strncmpi(d.bp, _("real "), l = 5)) {
            /* accept "real Amulet of Yendor" with "blessed" or "cursed"
               or useless "erodeproof" before or after "real" ... */
            d.real = 1; /* don't negate 'fake' here; "real fake amulet" and
                       * "fake real amulet" will both yield fake amulet
                       * (so will "real amulet" outside of wizard mode) */
        } else if (!strncmpi(d.bp, _("fake "), l = 5)) {
            /* ... and "fake Amulet of Yendor" likewise */
            d.fake = 1, d.real = 0;
            /* ['real' isn't actually needed (unless we someday add
               "real gem" for random non-glass, non-stone)] */
        } else if (!strncmpi(d.bp, _("female "), l = 7)) {
            d.mgend = FEMALE;
            /* if after "corpse/statue/figurine of", remove from string */
            if (save_bp)
                strsubst(d.bp, _("female "), _("")), l = 0;
        } else if (!strncmpi(d.bp, _("male "), l = 5)) {
            d.mgend = MALE;
            if (save_bp)
                strsubst(d.bp, _("male "), _("")), l = 0;
        } else if (!strncmpi(d.bp, _("neuter "), l = 7)) {
            d.mgend = NEUTRAL;
            if (save_bp)
                strsubst(d.bp, _("neuter "), _("")), l = 0;

        /*
         * Corpse/statue/figurine gender hack:  in order to accept
         * "statue of a female gnome ruler" for gnome queen we need
         * to recognize and skip over "statue of [a ]".  Otherwise
         * we would only accept "female gnome ruler statue" and the
         * viable but silly "female statue of a gnome ruler".
         */
        } else if ((!strncmpi(d.bp, _("corpse "), l = 7)
                    || !strncmpi(d.bp, _("statue "), l = 7)
                    || !strncmpi(d.bp, _("figurine "), l = 9))
                   && !strncmpi(d.bp + l, _("of "), more_l = 3)) {
            save_bp = d.bp; /* we'll backtrack to here later */
            l += more_l, more_l = 0;
            if (!strncmpi(d.bp + l, _("a "), more_l = 2)
                || !strncmpi(d.bp + l, _("an "), more_l = 3)
                || !strncmpi(d.bp + l, _("the "), more_l = 4))
                l += more_l;
        } else {
            break;
        }
        d.bp += l;
    }
    if (save_bp)
        d.bp = save_bp;
    return res;
}

function readobjnam_parse_charges(d) { /* void */
    if (strlen(d.bp) > 1 && (d.p = strrchr(d.bp, ord('('))) != 0) {
        let keeptrailingchars = TRUE;
        let idx = 0;

        if (d.p > d.bp && chars[d.p + (-1)] == ord(' '))
            idx = -1;
        chars[d.p + idx] = ord('\0'); /* terminate bp */
        ++d.p; /* advance past '(' */
        if (!strncmpi(d.p, _("lit)"), 4)) {
            d.islit = 1;
            d.p += 4 - 1; /* point at ')' */
        } else {
            d.spe = atoi(d.p);
            while (digit(chars[d.p]))
                d.p++;
            if (chars[d.p] == ord(':')) {
                d.p++;
                d.rechrg = d.spe;
                d.spe = atoi(d.p);
                while (digit(chars[d.p]))
                    d.p++;
            }
            if (chars[d.p] != ord(')')) {
                d.spe = d.rechrg = 0;
                /* mis-matched parentheses; rest of string will be ignored
                 * [probably we should restore everything back to '('
                 * instead since it might be part of "named ..."]
                 */
                keeptrailingchars = FALSE;
            } else {
                d.spesgn = 1;
            }
        }
        if (keeptrailingchars) {
            let pp = eos(d.bp);

            /* 'pp' points at 'pb's terminating '\0',
               'p' points at ')' and will be incremented past it */
            do {
                chars[pp++] = chars[++d.p];
            } while (chars[d.p]);
        }
    }
    /*
     * otmp->spe is type schar, so we don't want spe to be any bigger or
     * smaller.  Also, spe should always be positive --some cheaters may
     * try to confuse atoi().
     */
    if (d.spe < 0) {
        d.spesgn = -1; /* cheaters get what they deserve */
        d.spe = abs(d.spe);
    }
    /* cap on obj->spe is independent of (and less than) SCHAR_LIM */
    if (d.spe > SPE_LIM)
        d.spe = SPE_LIM; /* slime mold uses d.ftype, so not affected */
    if (d.rechrg < 0 || d.rechrg > 7)
        d.rechrg = 7; /* recharge_limit */
}

function readobjnam_postparse1(d) { /* int */
    const $frame = stack_frame(); try {
    let i;

    /* now we have the actual name, as delivered by xname, say
     *  green potions called whisky
     *  scrolls labeled "QWERTY"
     *  egg
     *  fortune cookies
     *  very heavy iron ball named hoei
     *  wand of wishing
     *  elven cloak
     */
    if ((d.p = strstri(d.bp, _(" named "))) != 0) {
        chars[d.p] = 0;
        /* note: if 'name' is too long, oname() will truncate it */
        d.name = d.p + 7;
    }
    if ((d.p = strstri(d.bp, _(" called "))) != 0) {
        chars[d.p] = 0;
        /* note: if 'un' is too long, obj lookup just won't match anything */
        d.un = d.p + 8;
        /* "helmet called telepathy" is not "helmet" (a specific type)
         * "shield called reflection" is not "shield" (a general type)
         */
        for (i = 0; i < SIZE(o_ranges); i++)
            if (!strcmpi(d.bp, o_ranges[i].name)) {
                d.oclass = o_ranges[i].oclass;
                return 1; /*goto srch;*/
            }
    }
    if ((d.p = strstri(d.bp, _(" labeled "))) != 0) {
        chars[d.p] = 0;
        d.dn = d.p + 9;
    } else if ((d.p = strstri(d.bp, _(" labelled "))) != 0) {
        chars[d.p] = 0;
        d.dn = d.p + 10;
    }
    if ((d.p = strstri(d.bp, _(" of spinach"))) != 0) {
        chars[d.p] = 0;
        d.contents = TIN_SPINACH;
    }
    /* real vs fake is only useful for wizard mode but we'll accept its
       parsing in normal play (result is never real Amulet for that case) */
    if ((d.p = strstri(d.bp, OBJ_DESCR(objects[AMULET_OF_YENDOR]))) != 0
        && (d.p == d.bp || chars[d.p + (-1)] == ord(' '))) {
        let s = d.bp;

        /* "Amulet of Yendor" matches two items, name of real Amulet
           and description of fake one; player can explicitly specify
           "real" to disambiguate, but not specifying "fake" achieves
           the same thing; "real" and "fake" are parsed above with other
           prefixes so that combinations like "blessed real" and "real
           blessed" work as expected; also accept partial specification
           of the full name of the fake; unlike the prefix recognition
           loop above, these have to be in the right order when more
           than one is present (similar to worthless glass gems below) */
        if (!strncmpi(s, _("cheap "), 6))
            d.fake = 1, s += 6;
        if (!strncmpi(s, _("plastic "), 8))
            d.fake = 1, s += 8;
        if (!strncmpi(s, _("imitation "), 10))
            d.fake = 1, s += 10;
        (s); /* suppress potential assigned-but-not-used complaint */
        /* when 'fake' is True, it overrides 'real' if both were given;
           when it is False, force 'real' whether that was specified or not */
        d.real = +!d.fake;
        d.typ = d.real ? AMULET_OF_YENDOR : FAKE_AMULET_OF_YENDOR;
        return 2; /*goto typfnd;*/
    }

    /*
     * Skip over "pair of ", "pairs of", "set of" and "sets of".
     *
     * Accept "3 pair of boots" as well as "3 pairs of boots".  It is
     * valid English either way.  See makeplural() for more on pair/pairs.
     *
     * We should only double count if the object in question is not
     * referred to as a "pair of".  E.g. We should double if the player
     * types "pair of spears", but not if the player types "pair of
     * lenses".  Luckily (?) all objects that are referred to as pairs
     * -- boots, gloves, and lenses -- are also not mergeable, so cnt is
     * ignored anyway.
     */
    if (!strncmpi(d.bp, _("pair of "), 8)) {
        d.bp += 8;
        d.cnt *= 2;
    } else if (!strncmpi(d.bp, _("pairs of "), 9)) {
        d.bp += 9;
        if (d.cnt > 1)
            d.cnt *= 2;
    } else if (!strncmpi(d.bp, _("set of "), 7)) {
        d.bp += 7;
    } else if (!strncmpi(d.bp, _("sets of "), 8)) {
        d.bp += 8;
    }

    /* Intercept pudding globs here; they're a valid wish target,
     * but we need them to not get treated like a corpse.
     * If a count is specified, it will be used to magnify weight
     * rather than to specify quantity (which is always 1 for globs).
     */
    i = int(strlen(d.bp));
    d.p = 0;
    /* check for "glob", "<foo> glob", and "glob of <foo>" */
    if (!strncmpi((d.bp), _(("glob")), -1) || !BSTRCMPI(d.bp, d.bp + i - 5, _(" glob"))
        || !strncmpi((d.bp), _(("globs")), -1)
        || !BSTRCMPI(d.bp, d.bp + i - 6, _(" globs"))
        || (d.p = strstri(d.bp, _("glob of "))) != 0
        || (d.p = strstri(d.bp, _("globs of "))) != 0) {
        d.mntmp = name_to_mon(!d.p ? d.bp
                                     : (strstri(d.p, _(" of ")) + 4), null);
        /* if we didn't recognize monster type, pick a valid one at random */
        if (d.mntmp == NON_PM)
            d.mntmp = rn1(PM_BLACK_PUDDING - PM_GRAY_OOZE, PM_GRAY_OOZE);
        /* normally this would be done when makesingular() changes the value
           but canonical form here is already singular so that won't happen */
        if (d.cnt < 2 && strstri(d.bp, _("globs")))
            d.cnt = 2; /* affects otmp->owt but not otmp->quan for globs */
        /* construct canonical spelling in case name_to_mon() recognized a
           variant (grey ooze) or player used inverted syntax (<foo> glob);
           if player has given a valid monster type but not valid glob type,
           object name lookup won't find it and wish attempt will fail */
        sprintf(d.globbuf, _("glob of %s"), mons[d.mntmp].pmnames[NEUTRAL]);
        d.bp = d.globbuf;
        d.mntmp = NON_PM; /* not useful for "glob of <foo>" object lookup */
        d.oclass = FOOD_CLASS;
        d.actualn = d.bp, d.dn = 0;
        return 1; /*goto srch;*/
    } else {
        /*
         * Find corpse type using "of" (figurine of an orc, tin of orc meat)
         * Don't check if it's a wand or spellbook.
         * (avoid "wand/finger of death" confusion).
         * Don't match "ogre" or "giant" monster name inside alternate item
         * names "gauntlets of ogre power" and "gauntlets of giant strength"
         * (or the alternate spelling of those, "gloves of ...").
         */
        if (!strstri(d.bp, _("wand ")) && !strstri(d.bp, _("spellbook "))
            && !strstri(d.bp, _("gauntlets ")) && !strstri(d.bp, _("gloves "))
            && !strstri(d.bp, _("finger "))) {
            if ((d.p = strstri(d.bp, _("tin of "))) != 0) {
                if (!strncmpi((d.p + 7), _(("spinach")), -1)) {
                    d.contents = TIN_SPINACH;
                    d.mntmp = NON_PM;
                } else {
                    d.tmp = tin_variety_txt(d.p + 7, ref_of(d, "tinv"));
                    d.tvariety = d.tinv;
                    d.mntmp = name_to_mon(d.p + 7 + d.tmp, ref_of(d, "mgend"));
                }
                d.typ = TIN;
                return 2; /*goto typfnd;*/
            } else if ((d.p = strstri(d.bp, _(" of "))) != 0
                       && ((d.mntmp = name_to_mon(d.p + 4, ref_of(d, "mgend")))
                           >= LOW_PM))
                chars[d.p] = 0;
        }
    }
    /* Find corpse type w/o "of" (red dragon scale mail, yeti corpse) */
    if (strncmpi(d.bp, _("samurai sword"), 13)  /* not the "samurai" monster! */
        && strncmpi(d.bp, _("wizard lock"), 11) /* not the "wizard" monster! */
        && strncmpi(d.bp, _("death wand"), 10)  /* 'of inversion', not Rider */
        && strncmpi(d.bp, _("master key"), 10)  /* not the "master" rank */
        && strncmpi(d.bp, _("ninja-to"), 8)     /* not the "ninja" rank */
        && strncmpi(d.bp, _("magenta"), 7)) {   /* not the "mage" rank */
        let rest = stack_var(ptr_to(char), 0);

        if (d.mntmp < LOW_PM && strlen(d.bp) > 2
            && ((d.mntmp = name_to_monplus(d.bp, rest, ref_of(d, "mgend")))
                >= LOW_PM)) {
            let obp = d.bp;

            /* 'rest' is a pointer past the matching portion; if that was
               an alternate name or a rank title rather than the canonical
               monster name we wouldn't otherwise know how much to skip */
            d.bp = (rest[0]); /* cast away const */

            if (chars[d.bp] == ord(' ')) {
                d.bp++;
            } else if (!strncmpi(d.bp, _("s "), 2)
                       || (d.bp > d.origbp
                           && !strncmpi(d.bp - 1, _("s' "), 3))) {
                d.bp += 2;
            } else if (!strncmpi(d.bp, _("es "), 3)
                       || !strncmpi(d.bp, _("'s "), 3)) {
                d.bp += 3;
            } else if (!chars[d.bp] && !d.actualn && !d.dn && !d.un
                       && !d.oclass) {
                /* no referent; they don't really mean a monster type */
                d.bp = obp;
                d.mntmp = NON_PM;
            }
        }
    }

    /* first change to singular if necessary */
    if (chars[d.bp]
        /* we want "tricks" to match "bag of tricks" [rnd_otyp_by_namedesc()]
           but that wouldn't work if it gets singularized to "trick"
           ["tricks bag" matches whether or not this exception is present
           because singularize operates on "bag" and wishymatch()'s
           'of inversion' finds a match] */
        && strncmpi((d.bp), _(("tricks")), -1)
        /* an odd potential wish; fail rather than get a false match with
           "cloth" because it might yield a "cloth spellbook" rather than
           a "piece of cloth" cloak [maybe we should give random armor?] */
        && strncmpi((d.bp), _(("clothes")), -1)
        ) {
        let sng = makesingular(d.bp);

        if (strcmp(d.bp, sng)) {
            if (d.cnt == 1)
                d.cnt = 2;
            strcpy(d.bp, sng);
        }
    }

    /* Alternate spellings (pick-ax, silver sabre, &c) */
    {
        let as = spellings[0];

        while (as.sp) {
            if (wishymatch(d.bp, as.sp, TRUE)) {
                d.typ = as.ob;
                return 2; /*goto typfnd;*/
            }
            as = ptr_add(as, 1);
        }
        /* can't use spellings list for this one due to shuffling */
        if (!strncmpi(d.bp, _("grey spell"), 10))
            chars[(d.bp + 2)] = ord('a');

        if ((d.p = strstri(d.bp, _("armour"))) != 0) {
            /* skip past "armo", then copy remainder beyond "u" */
            d.p += 4;
            while ((chars[d.p] = chars[(d.p + 1)]) != ord('\0'))
                ++d.p; /* self terminating */
        }
    }

    /* dragon scales - assumes order of dragons */
    if (!strncmpi((d.bp), _(("scales")), -1) && d.mntmp >= PM_GRAY_DRAGON
        && d.mntmp <= PM_YELLOW_DRAGON) {
        d.typ = GRAY_DRAGON_SCALES + d.mntmp - PM_GRAY_DRAGON;
        d.mntmp = NON_PM; /* no monster */
        return 2; /*goto typfnd;*/
    }

    d.p = eos(d.bp);
    if (!BSTRCMPI(d.bp, d.p - 10, _("holy water"))) {
        /* this isn't needed for "[un]holy water" because adjective parsing
           handles holy==blessed and unholy==cursed and leaves "water" for
           the object type, but it is needed for "potion of [un]holy water"
           since that parsing stops when it reaches "potion"; also, neither
           "holy water" nor "unholy water" is an actual type of potion */
        if (!BSTRNCMPI(d.bp, d.p - 10 - 2, _("un"), 2))
            d.iscursed = 1, d.blessed = d.uncursed = 0; /* unholy water */
        else
            d.blessed = 1, d.iscursed = d.uncursed = 0; /* holy water */
        d.typ = POT_WATER;
        return 2; /*goto typfnd;*/
    }
    /* accept "paperback" or "paperback book", reject "paperback spellbook" */
    if (!strncmpi(d.bp, _("paperback"), 9)) {
        let dbp = d.bp + 9; /* just past "paperback" */

        if (!chars[dbp] || !strncmpi(dbp, _(" book"), 5)) {
            d.typ = SPE_NOVEL;
            return 2; /*goto typfnd;*/
        } else {
            d.otmp = null;
            return 3;
        }
    }
    if (d.unlabeled && !BSTRCMPI(d.bp, d.p - 6, _("scroll"))) {
        d.typ = SCR_BLANK_PAPER;
        return 2; /*goto typfnd;*/
    }
    if (d.unlabeled && !BSTRCMPI(d.bp, d.p - 9, _("spellbook"))) {
        d.typ = SPE_BLANK_PAPER;
        return 2; /*goto typfnd;*/
    }
    /* specific food rather than color of gem/potion/spellbook[/scales] */
    if (!BSTRCMPI(d.bp, d.p - 6, _("orange")) && d.mntmp == NON_PM) {
        d.typ = ORANGE;
        return 2; /*goto typfnd;*/
    }
    /*
     * NOTE: Gold pieces are handled as objects nowadays, and therefore
     * this section should probably be reconsidered as well as the entire
     * gold/money concept.  Maybe we want to add other monetary units as
     * well in the future. (TH)
     */
    if (!BSTRCMPI(d.bp, d.p - 10, _("gold piece"))
        || !BSTRCMPI(d.bp, d.p - 7, _("zorkmid"))
        || !strncmpi((d.bp), _(("gold")), -1) || !strncmpi((d.bp), _(("money")), -1)
        || !strncmpi((d.bp), _(("coin")), -1) || chars[d.bp] == GOLD_SYM) {
        if (d.cnt > 5000 && !wizard())
            d.cnt = 5000;
        else if (d.cnt < 1)
            d.cnt = 1;
        d.otmp = mksobj(GOLD_PIECE, FALSE, FALSE);
        d.otmp.quan = d.cnt;
        d.otmp.owt = unsigned(weight(d.otmp));
        disp.botl = TRUE;
        return 3; /*return otmp;*/
    }

    /* check for single character object class code ("/" for wand, &c) */
    if (strlen(d.bp) == 1 && (i = def_char_to_objclass(chars[d.bp])) < MAXOCLASSES
        && i > ILLOBJ_CLASS && (i != VENOM_CLASS || wizard())) {
        d.oclass = i;
        return 4; /*goto any;*/
    }

    /* Search for class names: XXXXX potion, scroll of XXXXX.
       Avoid false hits on, e.g., rings for "ring mail". */
    if (strncmpi(d.bp, _("enchant "), 8)
        && strncmpi(d.bp, _("destroy "), 8)
        && strncmpi(d.bp, _("detect food"), 11)
        && strncmpi(d.bp, _("food detection"), 14)
        && strncmpi(d.bp, _("ring mail"), 9)
        && strncmpi(d.bp, _("studded leather armor"), 21)
        && strncmpi(d.bp, _("leather armor"), 13)
        && strncmpi(d.bp, _("tooled horn"), 11)
        && strncmpi(d.bp, _("food ration"), 11)
        && strncmpi(d.bp, _("meat ring"), 9))
        for (i = 0; i < static_sizeof("wrpsym"); i++) {
            let j = int(Strlen(wrp[i]));

            /* check for "<class> [ of ] something" */
            if (!strncmpi(d.bp, wrp[i], j)) {
                d.oclass = chars[wrpsym + i];
                if (d.oclass != AMULET_CLASS) {
                    d.bp += j;
                    if (!strncmpi(d.bp, _(" of "), 4))
                        d.actualn = d.bp + 4;
                    /* else if(*bp) ?? */
                } else
                    d.actualn = d.bp;
                return 1; /*goto srch;*/
            }
            /* check for "something <class>" */
            if (!(((d.p - j) < d.bp) || strcmpi((d.p - j), wrp[i]))) {
                d.oclass = chars[wrpsym + i];
                /* for "foo amulet", leave the class name so that
                   wishymatch() can do "of inversion" to try matching
                   "amulet of foo"; other classes don't include their
                   class name in their full object names (where
                   "potion of healing" is just "healing", for instance) */
                if (d.oclass != AMULET_CLASS) {
                    d.p -= j;
                    chars[d.p] = ord('\0');
                    if (d.p > d.bp && chars[d.p + (-1)] == ord(' '))
                        chars[d.p + (-1)] = ord('\0');
                } else {
                    let k, l;
                    let amubuf = stack_array(char, BUFSZ);

                    /* amulet without "of"; convoluted wording but better a
                       special case that's handled than one that's missing */
                    if (!strncmpi(d.bp, _("versus poison "), 14)) {
                        d.typ = AMULET_VERSUS_POISON;
                        return 2; /*goto typfnd;*/
                    }
                    /* check for "<shape> amulet"; strip off trailing
                       " amulet" for that w/o changing contents of d->bp */
                    l = int(strlen(d.bp)) - j;
                    if (l > 0 && chars[d.bp + (l - 1)] == ord(' '))
                        l -= 1;
                    copynchars(amubuf, d.bp, min(l, sizeof(array_of(char, BUFSZ)) - 1));
                    k = rnd_otyp_by_namedesc(amubuf, AMULET_CLASS, 0);
                    if (k != STRANGE_OBJECT) {
                        d.typ = k;
                        return 2; /*goto typfnd;*/
                    }
                }
                d.actualn = d.dn = d.bp;
                return 1; /*goto srch;*/
            }
        }

    /* Wishing in wizard mode can create traps and furniture.
     * Part I:  distinguish between trap and object for the two
     * types of traps which have corresponding objects:  bear trap
     * and land mine.  "beartrap" (object) and "bear trap" (trap)
     * have a difference in spelling which we used to exploit by
     * adding a special case in wishymatch(), but "land mine" is
     * spelled the same either way so needs different handing.
     * Since we need something else for land mine, we've dropped
     * the bear trap hack so that both are handled exactly the
     * same.  To get an armed trap instead of a disarmed object,
     * the player can prefix either the object name or the trap
     * name with "trapped " (which ordinarily applies to chests
     * and tins), or append something--anything at all except for
     * " object", but " trap" is suggested--to either the trap
     * name or the object name.
     */
    if (wizard() && (!strncmpi(d.bp, _("bear"), 4)
                   || !strncmpi(d.bp, _("land"), 4))) {
        let beartrap = +(lowc(chars[d.bp]) == ord('b'));
        let zp = d.bp + 4; /* skip "bear"/"land" */

        if (chars[zp] == ord(' '))
            ++zp; /* embedded space is optional */
        if (!strncmpi(zp, beartrap ? _("trap") : _("mine"), 4)) {
            zp += 4;
            if (d.trapped == 2 || !strncmpi((zp), _((" object")), -1)) {
                /* "untrapped <foo>" or "<foo> object" */
                d.typ = beartrap ? BEARTRAP : LAND_MINE;
                return 2; /*goto typfnd;*/
            } else if (d.trapped == 1 || chars[zp] != ord('\0')) {
                /* "trapped <foo>" or "<foo> trap" (actually "<foo>*") */
                /* use canonical trap spelling, skip object matching */
                strcpy(d.bp, trapname(beartrap ? BEAR_TRAP : LANDMINE, TRUE));
                return 5; /*goto wiztrap;*/
            }
            /* [no prefix or suffix; we're going to end up matching
               the object name and getting a disarmed trap object] */
        }
    }

    return 0;
    } finally { stack_pop($frame); }
}

function readobjnam_postparse2(d) { /* int */
    const $frame = stack_frame(); try {
    let i;

    /* "grey stone" check must be before general "stone" */
    for (i = 0; i < SIZE(o_ranges); i++)
        if (!strcmpi(d.bp, o_ranges[i].name)) {
            d.typ = rnd_class(o_ranges[i].f_o_range, o_ranges[i].l_o_range);
            return 2; /*goto typfnd;*/
        }

    if (!BSTRCMPI(d.bp, d.p - 6, _(" stone"))
        || !BSTRCMPI(d.bp, d.p - 4, _(" gem"))) {
        chars[d.p + (!strncmpi((d.p - 4), _((" gem")), -1) ? -4 : -6)] = ord('\0');
        d.oclass = GEM_CLASS;
        d.dn = d.actualn = d.bp;
        return 1; /*goto srch;*/
    } else if (!strncmpi((d.bp), _(("looking glass")), -1)) {
        ; /* avoid false hit on "* glass" */
    } else if (!BSTRCMPI(d.bp, d.p - 6, _(" glass"))
               || !strncmpi((d.bp), _(("glass")), -1)) {
        let s = d.bp;

        /* treat "broken glass" as a non-existent item; since "broken" is
           also a chest/box prefix it might have been stripped off above */
        if (d.broken || strstri(s, _("broken"))) {
            d.otmp = null;
            return 3; /* return otmp */
        }
        if (!strncmpi(s, _("worthless "), 10))
            s += 10;
        if (!strncmpi(s, _("piece of "), 9))
            s += 9;
        if (!strncmpi(s, _("colored "), 8))
            s += 8;
        else if (!strncmpi(s, _("coloured "), 9))
            s += 9;
        if (!strncmpi((s), _(("glass")), -1)) { /* choose random color */
            /* 9 different kinds */
            d.typ = FIRST_GLASS_GEM + rn2(NUM_GLASS_GEMS);
            if (objects[d.typ].oc_class == GEM_CLASS)
                return 2; /*goto typfnd;*/
            else
                d.typ = 0; /* somebody changed objects[]? punt */
        } else { /* try to construct canonical form */
            let tbuf = stack_array(char, BUFSZ);

            strcpy(tbuf, _("worthless piece of "));
            strcat(tbuf, s); /* assume it starts with the color */
            strcpy(d.bp, tbuf);
        }
    }

    d.actualn = d.bp;
    if (!d.dn)
        d.dn = d.actualn; /* ex. "skull cap" */

    return 0;
    } finally { stack_pop($frame); }
}

function readobjnam_postparse3(d) { /* int */
    const $frame = stack_frame(); try {
    let i;

    /* check real names of gems first */
    if (!d.oclass && d.actualn) {
        for (i = svb.bases[GEM_CLASS]; i <= LAST_REAL_GEM; i++) {
            let zn;

            if ((zn = OBJ_NAME(objects[i])) != 0 && !strcmpi(d.actualn, zn)) {
                d.typ = i;
                return 2; /*goto typfnd;*/
            }
        }
        /* "tin of foo" would be caught above, but plain "tin" has
           a random chance of yielding "tin wand" unless we do this */
        if (!strncmpi((d.actualn), _(("tin")), -1)) {
            d.typ = TIN;
            return 2; /*goto typfnd;*/
        }
    }

    if (((d.typ = rnd_otyp_by_namedesc(d.actualn, d.oclass, 1))
         != STRANGE_OBJECT)
        || (d.dn != d.actualn
            && ((d.typ = rnd_otyp_by_namedesc(d.dn, d.oclass, 1))
                != STRANGE_OBJECT))
        || ((d.typ = rnd_otyp_by_namedesc(d.un, d.oclass, 1))
             != STRANGE_OBJECT)
        || (d.origbp != d.actualn
            && ((d.typ = rnd_otyp_by_namedesc(d.origbp, d.oclass, 1))
                != STRANGE_OBJECT)))
        return 2; /*goto typfnd;*/
    d.typ = 0;

    if (d.actualn) {
        let j = Japanese_items[0];

        while (j.item) {
            if (!strcmpi(d.actualn, j.name)) {
                d.typ = j.item;
                return 2; /*goto typfnd;*/
            }
            j = ptr_add(j, 1);
        }
    }
    /* if we've stripped off "armor" and failed to match anything
       in objects[], append "mail" and try again to catch misnamed
       requests like "plate armor" and "yellow dragon scale armor" */
    if (d.oclass == ARMOR_CLASS && !strstri(d.bp, _("mail"))) {
        /* modifying bp's string is ok; we're about to resort
           to random armor if this also fails to match anything */
        strcat(d.bp, _(" mail"));
        return 6; /*goto retry;*/
    }
    if (!strncmpi((d.bp), _(("spinach")), -1)) {
        d.contents = TIN_SPINACH;
        d.typ = TIN;
        return 2; /*goto typfnd;*/
    }
    /* Fruits must not mess up the ability to wish for real objects (since
     * you can leave a fruit in a bones file and it will be added to
     * another person's game), so they must be checked for last, after
     * stripping all the possible prefixes and seeing if there's a real
     * name in there.  So we have to save the full original name.  However,
     * it's still possible to do things like "uncursed burnt Alaska",
     * or worse yet, "2 burned 5 course meals", so we need to loop to
     * strip off the prefixes again, this time stripping only the ones
     * possible on food.
     * We could get even more detailed so as to allow food names with
     * prefixes that _are_ possible on food, so you could wish for
     * "2 3 alarm chilis".  Currently this isn't allowed; options.c
     * automatically sticks 'candied' in front of such names.
     */
    /* Note: not strcmpi.  2 fruits, one capital, one not, are possible.
       Also not strncmp.  We used to ignore trailing text with it, but
       that resulted in "grapefruit" matching "grape" if the latter came
       earlier than the former in the fruit list. */
    {
        let fp;
        let l, cntf;
        let blessedf, iscursedf, uncursedf, halfeatenf;
        let f;

        blessedf = iscursedf = uncursedf = halfeatenf = 0;
        cntf = 0;

        fp = d.fruitbuf;
        for (;;) {
            if (!fp || !chars[fp])
                break;
            if (!strncmpi(fp, _("an "), l = 3) || !strncmpi(fp, _("a "), l = 2)) {
                cntf = 1;
            } else if (!cntf && digit(chars[fp])) {
                cntf = atoi(fp);
                while (digit(chars[fp]))
                    fp++;
                while (chars[fp] == ord(' '))
                    fp++;
                l = 0;
            } else if (!strncmpi(fp, _("blessed "), l = 8)) {
                blessedf = 1;
            } else if (!strncmpi(fp, _("cursed "), l = 7)) {
                iscursedf = 1;
            } else if (!strncmpi(fp, _("uncursed "), l = 9)) {
                uncursedf = 1;
            } else if (!strncmpi(fp, _("partly eaten "), l = 13)
                       || !strncmpi(fp, _("partially eaten "), l = 16)) {
                halfeatenf = 1;
            } else
                break;
            fp += l;
        }

        for (f = gf.ffruit; f; f = f.nextf) {
            /* match type: 0=none, 1=exact, 2=singular, 3=plural */
            let ftyp = 0;

            if (!strcmp(fp, f.fname))
                ftyp = 1;
            else if (!strcmp(fp, makesingular(f.fname)))
                ftyp = 2;
            else if (!strcmp(fp, makeplural(f.fname)))
                ftyp = 3;
            if (ftyp) {
                d.typ = SLIME_MOLD;
                d.blessed = blessedf;
                d.iscursed = iscursedf;
                d.uncursed = uncursedf;
                d.halfeaten = halfeatenf;
                /* adjust count if user explicitly asked for
                   singular amount (can't happen unless fruit
                   has been given an already pluralized name)
                   or for plural amount */
                if (ftyp == 2 && !cntf)
                    cntf = 1;
                else if (ftyp == 3 && !cntf)
                    cntf = 2;
                d.cnt = cntf;
                d.ftype = f.fid;
                return 2; /*goto typfnd;*/
            }
        }
    }

    if (!d.oclass && d.actualn) {
        let objtyp = stack_var(short);

        /* Perhaps it's an artifact specified by name, not type */
        d.name = artifact_name(d.actualn, objtyp, TRUE);
        if (d.name) {
            d.typ = objtyp[0];
            return 2; /*goto typfnd;*/
        }
    }

    /* got a class, but not specific type;
       check alternate spellings of items with matching classes */
    if (d.oclass && !d.typ) {
        let as = spellings[0];

        while (as.sp) {
            if (objects[as.ob].oc_class == d.oclass
                && wishymatch(d.bp, as.sp, TRUE)) {
                d.typ = as.ob;
                return 2; /*goto typfnd;*/
            }
            as = ptr_add(as, 1);
        }
    }

    return 0;
    } finally { stack_pop($frame); }
}

/*
 * Return something wished for.  Specifying a null pointer for
 * the user request string results in a random object.  Otherwise,
 * if asking explicitly for "nothing" (or "nil") return no_wish;
 * if not an object return &hands_obj; if an error (no matching object),
 * return null.
 */
export function readobjnam(bp, no_wish) { /* struct obj * */
    const $frame = stack_frame(); try {
    let $goto = null; var d = stack_struct(struct__readobjnam_data), objtyp = stack_var(short);

    readobjnam_init(bp, d);
    $goto_retry: for (;;) { switch ($goto) { default: if (!bp)
        { $goto = "any"; continue $goto_retry; };

    /* first, remove extra whitespace they may have typed */
    mungspaces(bp);
    /* allow wishing for "nothing" to preserve wishless conduct...
       [now requires "wand of nothing" if that's what was really wanted] */
    if (!strncmpi((bp), _(("nothing")), -1) || !strncmpi((bp), _(("nil")), -1)
        || !strncmpi((bp), _(("none")), -1))
        return no_wish;
    /* save the [nearly] unmodified choice string */
    strcpy(d.fruitbuf, bp);

    if (readobjnam_preparse(d))
        { $goto = "any"; continue $goto_retry; };

    if (!d.cnt)
        d.cnt = 1; /* will be changed to 2 if makesingular() changes string */

    readobjnam_parse_charges(d);

    switch (readobjnam_postparse1(d)) {
    default:
    case 0: break;
    case 1: { $goto = "srch"; continue $goto_retry; };
    case 2: { $goto = "typfnd"; continue $goto_retry; };
    case 3: return d.otmp;
    case 4: { $goto = "any"; continue $goto_retry; };
    case 5: { $goto = "wiztrap"; continue $goto_retry; };
    }

 case "retry": $goto = null;
    switch (readobjnam_postparse2(d)) {
    default:
    case 0: break;
    case 1: { $goto = "srch"; continue $goto_retry; };
    case 2: { $goto = "typfnd"; continue $goto_retry; };
    case 3: return d.otmp;
    case 4: { $goto = "any"; continue $goto_retry; };
    case 5: { $goto = "wiztrap"; continue $goto_retry; };
    }

 case "srch": $goto = null;
    switch (readobjnam_postparse3(d)) {
    default:
    case 0: break;
    case 1: { $goto = "srch"; continue $goto_retry; };
    case 2: { $goto = "typfnd"; continue $goto_retry; };
    case 3: return d.otmp;
    case 4: { $goto = "any"; continue $goto_retry; };
    case 5: { $goto = "wiztrap"; continue $goto_retry; };
    case 6: { $goto = "retry"; continue $goto_retry; };
    }

    /*
     * Let wizards wish for traps and furniture.
     * Must come after objects check so wizards can still wish for
     * trap objects like beartraps.
     * Disallow such topology tweaks for WIZKIT startup wishes.
     */
 case "wiztrap": $goto = null;
    if (wizard() && !program_state.wizkit_wishing && !d.oclass) {
        /* [inline code moved to separate routine to unclutter readobjnam] */
        if ((d.otmp = wizterrainwish(d)) != null)
            return d.otmp;
    }

    if (!d.oclass && !d.typ) {
        if (!strncmpi(d.bp, _("polearm"), 7)) {
            d.typ = rnd_otyp_by_wpnskill(P_POLEARMS);
            { $goto = "typfnd"; continue $goto_retry; }
        } else if (!strncmpi(d.bp, _("hammer"), 6)) {
            d.typ = rnd_otyp_by_wpnskill(P_HAMMER);
            { $goto = "typfnd"; continue $goto_retry; }
        }
    }

    if (!d.oclass)
        return null;
 case "any": $goto = null;
    if (!d.oclass)
        d.oclass = chars[wrpsym + rn2(static_sizeof("wrpsym"))];
 case "typfnd": $goto = null;
    if (d.typ)
        d.oclass = objects[d.typ].oc_class; } break; }

    /* handle some objects that are only allowed in wizard mode */
    if (d.typ && !wizard()) {
        switch (d.typ) {
        case AMULET_OF_YENDOR:
            d.typ = FAKE_AMULET_OF_YENDOR;
            break;
        case CANDELABRUM_OF_INVOCATION:
            d.typ = rnd_class(TALLOW_CANDLE, WAX_CANDLE);
            break;
        case BELL_OF_OPENING:
            d.typ = BELL;
            break;
        case SPE_BOOK_OF_THE_DEAD:
            d.typ = SPE_BLANK_PAPER;
            break;
        case MAGIC_LAMP:
            d.typ = OIL_LAMP;
            break;
        default:
            /* catch any other non-wishable objects (venom) */
            if (objects[d.typ].oc_nowish)
                return null;
            break;
        }
    }

    /* if asking for corpse of a monster which leaves behind a glob, give
       glob instead of rejecting the monster type to create random corpse */
    if (d.typ == CORPSE && d.mntmp >= LOW_PM
        && mons[d.mntmp].mlet == S_PUDDING) {
        d.typ = GLOB_OF_GRAY_OOZE + (d.mntmp - PM_GRAY_OOZE);
        d.mntmp = NON_PM; /* not used for globs */
    }
    /*
     * Create the object, then fine-tune it.
     */
    d.otmp = d.typ ? mksobj(d.typ, TRUE, FALSE) : mkobj(d.oclass, FALSE);
    d.typ = d.otmp.otyp, d.oclass = d.otmp.oclass; /* what we actually got */

    /* if player specified a reasonable count, maybe honor it;
       quantity for gold is handled elsewhere and d.cnt is 0 for it here */
    if (d.otmp.globby) {
        /* for globs, calculate weight based on gsize, then multiply by cnt;
           asking for 2 globs or for 2 small globs produces 1 small glob
           weighing 40au instead of normal 20au; asking for 5 medium globs
           might produce 1 very large glob weighing 600au */
        d.otmp.quan = 1; /* always 1 for globs */
        d.otmp.owt = unsigned(weight(d.otmp));
        /* gsize 0: unspecified => small;
           1: small (1..5) => keep default owt for 1, yielding 20;
           2: medium (6..15) => use weight for 6, yielding 120;
           3: large (16..25) => 320; 4: very large (26+) => 520 */
        if (d.gsize > 1)
            d.otmp.owt += unsigned(Math.imul(unsigned((5 + (d.gsize - 2) * 10)), d.otmp.owt))
;  /* 20 + {5|15|25} times 20 */
        /* limit overall weight which limits shrink-away time which in turn
           affects how long some of it will remain available to be eaten */
        if (d.cnt > 1) {
            var rn1cnt = rn1(5, 2); /* 2..6 */

            if (rn1cnt > 6 - d.gsize)
                rn1cnt = 6 - d.gsize;
            if (d.cnt > rn1cnt
                && (!wizard() || program_state.wizkit_wishing
                    || y_n(_("Override glob weight limit?")) != ord('y')))
                d.cnt = rn1cnt;
            d.otmp.owt *= unsigned(d.cnt);
        }
        /* note: the owt assignment below will not change glob's weight */
        d.cnt = 0;
    } else if (d.cnt > 0) {
        if (objects[d.typ].oc_merge
            && (wizard() /* quantity isn't restricted when debugging */
                /* note: in normal play, explicitly asking for 1 might
                   fail the 'cnt < rnd(6)' test and could produce more
                   than 1 if mksobj() creates the item that way */
                || d.cnt < rnd(6)
                || (d.cnt <= 7 && Is_candle(d.otmp))
                || (d.cnt <= 20
                    && (d.typ == ROCK || d.typ == FLINT || is_missile(d.otmp)
                        /* WEAPON_CLASS test excludes gems, gray stones */
                        || (d.oclass == WEAPON_CLASS && is_ammo(d.otmp))))))
            d.otmp.quan = d.cnt;
    }

    if (d.islit && (d.typ == OIL_LAMP || d.typ == MAGIC_LAMP
                    || d.typ == BRASS_LANTERN
                    || Is_candle(d.otmp) || d.typ == POT_OIL)) {
        place_object(d.otmp, u.ux, u.uy); /* make it viable light source */
        begin_burn(d.otmp, FALSE);
        obj_extract_self(d.otmp); /* now release it for caller's use */
    }

    if (d.spesgn == 0) {
        /* spe not specified; retain the randomly assigned value */
        d.spe = d.otmp.spe;
    } else if (wizard()) {
        ; /* no restrictions except SPE_LIM */
    } else if (d.oclass == ARMOR_CLASS || d.oclass == WEAPON_CLASS
               || is_weptool(d.otmp)
               || (d.oclass == RING_CLASS && objects[d.typ].oc_charged)) {
        if (d.spe > rnd(5) && d.spe > d.otmp.spe)
            d.spe = 0;
        if (d.spe > 2 && Luck() < 0)
            d.spesgn = -1;
    } else {
        /* crystal ball cancels like a wand, to (n:-1) */
        if (d.oclass == WAND_CLASS || d.typ == CRYSTAL_BALL) {
            if (d.spe > 1 && d.spesgn == -1)
                d.spe = 1;
        } else {
            if (d.spe > 0 && d.spesgn == -1)
                d.spe = 0;
        }
        if (d.spe > d.otmp.spe)
            d.spe = d.otmp.spe;
    }

    if (d.spesgn == -1)
        d.spe = -d.spe;

    /* set otmp->spe.  This may, or may not, use d.spe... */
    switch (d.typ) {
    case TIN:
        d.otmp.spe = 0; /* default: not spinach */
        if (d.contents == TIN_EMPTY) {
            d.otmp.corpsenm = NON_PM;
        } else if (d.contents == TIN_SPINACH) {
            d.otmp.corpsenm = NON_PM;
            d.otmp.spe = 1; /* spinach after all */
        }
        break;
    case TOWEL:
        if (d.wetness)
            d.otmp.spe = d.wetness;
        break;
    case SLIME_MOLD:
        d.otmp.spe = d.ftype;
        /* FALLTHROUGH */;
    /* FALLTHRU */
    case SKELETON_KEY:
    case CHEST:
    case LARGE_BOX:
    case HEAVY_IRON_BALL:
    case IRON_CHAIN:
        break;
    case STATUE: /* otmp->cobj already done in mksobj() */
    case FIGURINE:
    case CORPSE: {
        var P = ismnum(d.mntmp) ? mons[d.mntmp] : null;

        d.otmp.spe = !P ? CORPSTAT_RANDOM
                      /* if neuter, force neuter regardless of wish request */
                      : is_neuter(P) ? CORPSTAT_NEUTER
                        /* not neuter, honor wish unless it conflicts */
                        : (d.mgend == FEMALE && !is_male(P)) ? CORPSTAT_FEMALE
                          : (d.mgend == MALE && !is_female(P)) ? CORPSTAT_MALE
                            /* unspecified or wish conflicts */
                            : CORPSTAT_RANDOM;
        if (P && d.otmp.spe == CORPSTAT_RANDOM)
            d.otmp.spe = is_male(P) ? CORPSTAT_MALE
                          : is_female(P) ? CORPSTAT_FEMALE
                            : rn2(2) ? CORPSTAT_MALE : CORPSTAT_FEMALE;
        if (d.ishistoric && d.typ == STATUE)
            d.otmp.spe |= CORPSTAT_HISTORIC;
        break;
    };

    /* scroll of mail:  0: delivered in-game via external event (or randomly
       for fake mail); 1: from bones or wishing; 2: written with marker */
    case SCR_MAIL:
        d.otmp.spe = 1;
        break;

    /* splash of venom:  0: normal, and transitory; 1: wishing */
    case ACID_VENOM:
    case BLINDING_VENOM:
        d.otmp.spe = 1;
        break;
    case WAN_WISHING:
        if (!wizard()) {
            d.otmp.spe = (rn2(10) ? -1 : 0);
            break;
        }
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    default:
        d.otmp.spe = d.spe;
    }

    /* set otmp->corpsenm or dragon scale [mail] */
    if (ismnum(d.mntmp)) {
        var humanwere;

        if (d.mntmp == PM_LONG_WORM_TAIL)
            d.mntmp = PM_LONG_WORM;
        /* werecreatures in beast form are all flagged no-corpse so for
           corpses and tins, switch to their corresponding human form;
           for figurines, override the can't-be-human restriction instead */
        if (d.typ != FIGURINE && is_were(mons[d.mntmp])
            && (svm.mvitals[d.mntmp].mvflags & G_NOCORPSE) != 0
            && (humanwere = counter_were(d.mntmp)) != NON_PM)
            d.mntmp = humanwere;

        switch (d.typ) {
        case TIN:
            if (dead_species(d.mntmp, FALSE)) {
                d.otmp.corpsenm = NON_PM; /* it's empty */
            } else if ((!(mons[d.mntmp].geno & G_UNIQ) || wizard())
                       && !(svm.mvitals[d.mntmp].mvflags & G_NOCORPSE)
                       && mons[d.mntmp].cnutrit != 0) {
                d.otmp.corpsenm = d.mntmp;
            }
            break;
        case CORPSE:
            if ((!(mons[d.mntmp].geno & G_UNIQ) || wizard())
                && !(svm.mvitals[d.mntmp].mvflags & G_NOCORPSE)) {
                if (mons[d.mntmp].msound == MS_GUARDIAN)
                    d.mntmp = genus(d.mntmp, 1);
                set_corpsenm(d.otmp, d.mntmp);
            }
            if (d.zombify && zombie_form(mons[d.mntmp])) {
                start_timer(rn1(5, 10), TIMER_OBJECT,
                                   ZOMBIFY_MON, obj_to_any(d.otmp));
            }
            break;
        case EGG:
            d.mntmp = can_be_hatched(d.mntmp);
            /* this also sets hatch timer if appropriate */
            set_corpsenm(d.otmp, d.mntmp);
            break;
        case FIGURINE:
            if (!(mons[d.mntmp].geno & G_UNIQ)
                && (!is_human(mons[d.mntmp]) || is_were(mons[d.mntmp]))

                && d.mntmp != PM_MAIL_DAEMON

                )
                d.otmp.corpsenm = d.mntmp;
            break;
        case STATUE:
            d.otmp.corpsenm = d.mntmp;
            if (Has_contents(d.otmp) && verysmall(mons[d.mntmp]))
                delete_contents(d.otmp); /* no spellbook */
            break;
        case SCALE_MAIL:
            /* Dragon mail - depends on the order of objects & dragons. */
            if (d.mntmp >= PM_GRAY_DRAGON && d.mntmp <= PM_YELLOW_DRAGON)
                d.otmp.otyp = GRAY_DRAGON_SCALE_MAIL
                              + d.mntmp - PM_GRAY_DRAGON;
            break;
        }
    }

    /* set blessed/cursed -- setting the fields directly is safe
     * since weight() is called below and addinv() will take care
     * of luck */
    if (d.iscursed) {
        curse(d.otmp);
    } else if (d.uncursed) {
        d.otmp.blessed = 0;
        d.otmp.cursed = +(Luck() < 0 && !wizard());
    } else if (d.blessed) {
        d.otmp.blessed = (Luck() >= 0 || wizard() ? 1 : 0);
        d.otmp.cursed = +(Luck() < 0 && !wizard());
    } else if (d.spesgn < 0) {
        curse(d.otmp);
    }

    /* set eroded and erodeproof */
    if (erosion_matters(d.otmp)) {
        /* wished-for item shouldn't be eroded unless specified */
        d.otmp.oeroded = d.otmp.oeroded2 = 0;
        if (d.eroded && (is_flammable(d.otmp) || is_rustprone(d.otmp)
                         || is_crackable(d.otmp)))
            d.otmp.oeroded = unsigned(d.eroded);
        if (d.eroded2 && (is_corrodeable(d.otmp) || is_rottable(d.otmp)))
            d.otmp.oeroded2 = unsigned(d.eroded2);
        /*
         * 3.6.1: earlier versions included `&& !eroded && !eroded2' here,
         * but damageproof combined with damaged is feasible (eroded
         * armor modified by confused reading of cursed destroy armor)
         * so don't prevent player from wishing for such a combination.
         */
        if (d.erodeproof
            && (is_damageable(d.otmp) || d.otmp.otyp == CRYSKNIFE))
            d.otmp.oerodeproof = (Luck() >= 0 || wizard() ? 1 : 0);
    }

    /* set otmp->recharged */
    if (d.oclass == WAND_CLASS) {
        /* prevent wishing abuse */
        if (d.otmp.otyp == WAN_WISHING && !wizard())
            d.rechrg = 1;
        d.otmp.recharged = unsigned(d.rechrg);
    }

    /* set poisoned */
    if (d.ispoisoned) {
        if (is_poisonable(d.otmp))
            d.otmp.otrapped = +(Luck() >= 0);
        else if (d.oclass == FOOD_CLASS)
            /* try to taint by making it as old as possible */
            d.otmp.age = 1;
    }
    /* and [un]trapped */
    if (d.trapped) {
        if (Is_box(d.otmp) || d.typ == TIN)
            d.otmp.otrapped = +(d.trapped == 1);
    }
    /* empty for containers rather than for tins */
    if (d.contents == TIN_EMPTY) {
        if (d.otmp.otyp == BAG_OF_TRICKS || d.otmp.otyp == HORN_OF_PLENTY) {
            if (d.otmp.spe > 0)
                d.otmp.spe = 0;
        } else if (Has_contents(d.otmp)) {
            /* this assumes that artifacts can't be randomly generated
               inside containers */
            delete_contents(d.otmp);
            d.otmp.owt = unsigned(weight(d.otmp));
        }
    }
    /* set locked/unlocked/broken */
    if (Is_box(d.otmp)) {
        if (d.locked) {
            d.otmp.olocked = 1, d.otmp.obroken = 0;
        } else if (d.unlocked) {
            d.otmp.olocked = 0, d.otmp.obroken = 0;
        } else if (d.broken) {
            d.otmp.olocked = 0, d.otmp.obroken = 1;
        }
        if (d.otmp.obroken)
            d.otmp.otrapped = 0;
    }

    if (d.isgreased)
        d.otmp.greased = 1;

    if (d.isdiluted && d.otmp.oclass == POTION_CLASS)
        d.otmp.oeroded = +(d.otmp.otyp != POT_WATER);

    /* set tin variety */
    if (d.otmp.otyp == TIN && d.tvariety >= 0 && (rn2(4) || wizard()))
        set_tin_variety(d.otmp, d.tvariety);

    if (d.name) {
        var aname, novelname;

        /* an artifact name might need capitalization fixing */
        aname = artifact_name(d.name, objtyp, TRUE);
        if (aname && objtyp[0] == d.otmp.otyp)
            d.name = aname;

        /* 3.6 tribute - fix up novel */
        if (d.otmp.otyp == SPE_NOVEL
            && (novelname = lookup_novel(d.name, ref_of(d.otmp, "corpsenm"))) != 0)
            d.name = novelname;

        d.otmp = oname(d.otmp, d.name, ONAME_WISH);
        /* name==aname => wished for artifact (otmp->oartifact => got it) */
        if (d.otmp.oartifact || d.name == aname) {
            d.otmp.quan = 1;
            u.uconduct.wisharti++; /* KMH, conduct */
        }
    }

    if (permapoisoned(d.otmp))
        d.otmp.otrapped = 1;

    /* more wishing abuse: don't allow wishing for certain artifacts */
    /* and make them pay; charge them for the wish anyway! */
    if ((is_quest_artifact(d.otmp)
         || (d.otmp.oartifact && rn2(nartifact_exist()) > 1)) && !wizard()) {
        artifact_exists(d.otmp, safe_oname(d.otmp), FALSE, ONAME_NO_FLAGS);
        obfree(d.otmp, null);
        d.otmp = hands_obj;
        pline(_("For a moment, you feel %s in your %s, but it disappears!"),
              something(), makeplural(body_part(HAND)));
        return d.otmp;
    }

    if (d.halfeaten && d.otmp.oclass == FOOD_CLASS) {
        var nut = obj_nutrition(d.otmp);

        /* do this adjustment before setting up object's weight; skip
           "partly eaten" for food with 0 nutrition (wraith corpse) or for
           anything that couldn't take more than one bite (1 nutrition;
           ought to check for one-bite instead but that's complicated) */
        if (nut > 1) {
            d.otmp.oeaten = nut;
            consume_oeaten(d.otmp, 1);
        }
    }
    d.otmp.owt = unsigned(weight(d.otmp));
    if (d.very && d.otmp.otyp == HEAVY_IRON_BALL)
        d.otmp.owt += WT_IRON_BALL_INCR;

    return d.otmp;
    } finally { stack_pop($frame); }
}

export function rnd_class(first, last) { /* int */
    let i, x, sum = 0;

    if (last > first) {
        for (i = first; i <= last; i++)
            sum += objects[i].oc_prob;
        if (!sum) /* all zero, so equal probability */
            return rn1(last - first + 1, first);

        x = rnd(sum);
        for (i = first; i <= last; i++)
            if ((x -= objects[i].oc_prob) <= 0)
                return i;
    }
    return (first == last) ? first : STRANGE_OBJECT;
}

export function Japanese_item_name(i, ordinaryname) { /* const char * */
    let j = Japanese_items[0];

    while (j.item) {
        if (i == j.item)
            return j.name;
        j = ptr_add(j, 1);
    }
    return ordinaryname;
}

export function armor_simple_name(armor) { /* const char * */
    let result = 0;
    let armcat = unsigned(objects[armor.otyp].oc_subtyp);

    switch (armcat) {
    case ARM_SUIT:
        result = suit_simple_name(armor);
        break;
    case ARM_CLOAK:
        result = cloak_simple_name(armor);
        break;
    case ARM_HELM:
        result = helm_simple_name(armor);
        break;
    case ARM_GLOVES:
        result = gloves_simple_name(armor);
        break;
    case ARM_BOOTS:
        result = boots_simple_name(armor);
        break;
    case ARM_SHIELD:
        result = shield_simple_name(armor);
        break;
    case ARM_SHIRT:
        result = shirt_simple_name(armor);
        break;
    default:
        result = simpleonames(armor);
        impossible(_("unknown armor category (%s => %u)"), result, armcat);
        break;
    }
    return result;
}

export function suit_simple_name(suit) { /* const char * */
    let suitnm, esuitp;

    if (suit) {
        if (Is_dragon_mail(suit))
            return _("dragon mail"); /* <color> dragon scale mail */
        else if (Is_dragon_scales(suit))
            return _("dragon scales");
        suitnm = OBJ_NAME(objects[suit.otyp]);
        esuitp = eos(suitnm);
        if (strlen(suitnm) > 5 && !strcmp(esuitp - 5, _(" mail")))
            return _("mail"); /* most suits fall into this category */
        else if (strlen(suitnm) > 7 && !strcmp(esuitp - 7, _(" jacket")))
            return _("jacket"); /* leather jacket */
    }
    /* "suit" is lame but "armor" is ambiguous and "body armor" is absurd */
    return _("suit");
}

export function cloak_simple_name(cloak) { /* const char * */
    if (cloak) {
        switch (cloak.otyp) {
        case ROBE:
            return _("robe");
        case MUMMY_WRAPPING:
            return _("wrapping");
        case ALCHEMY_SMOCK:
            return (objects[cloak.otyp].oc_name_known && cloak.dknown)
                       ? _("smock")
                       : _("apron");
        default:
            break;
        }
    }
    return _("cloak");
}

/* helm vs hat for messages */
export function helm_simple_name(helmet) { /* const char * */
    /*
     *  There is some wiggle room here; the result has been chosen
     *  for consistency with the "protected by hard helmet" messages
     *  given for various bonks on the head:  headgear that provides
     *  such protection is a "helm", that which doesn't is a "hat".
     *
     *      elven leather helm / leather hat    -> hat
     *      dwarvish iron helm / hard hat       -> helm
     *  The rest are completely straightforward:
     *      fedora, cornuthaum, dunce cap       -> hat
     *      all other types of helmets          -> helm
     */
    return !hard_helmet(helmet) ? _("hat") : _("helm");
}

/* gloves vs gauntlets; depends upon discovery state */
export function gloves_simple_name(gloves) { /* const char * */
    let gauntlets = init_string(static_array("gloves_simple_name.gauntlets", char, sizeof_string("gauntlets")), _("gauntlets"), true);

    if (gloves && gloves.dknown) {
        let otyp = gloves.otyp;
        let ocl = objects[otyp];
        let actualn = OBJ_NAME(ocl),
                   descrpn = OBJ_DESCR(ocl);

        if (strstri(objects[otyp].oc_name_known ? actualn : descrpn,
                    gauntlets))
            return gauntlets;
    }
    return _("gloves");
}

/* boots vs shoes; depends upon discovery state */
export function boots_simple_name(boots) { /* const char * */
    let shoes = init_string(static_array("boots_simple_name.shoes", char, sizeof_string("shoes")), _("shoes"), true);

    if (boots && boots.dknown) {
        let otyp = boots.otyp;
        let ocl = objects[otyp];
        let actualn = OBJ_NAME(ocl),
                   descrpn = OBJ_DESCR(ocl);

        if (strstri(descrpn, shoes)
            || (objects[otyp].oc_name_known && strstri(actualn, shoes)))
            return shoes;
    }
    return _("boots");
}

/* simplified shield for messages */
export function shield_simple_name(shield) { /* const char * */
    if (shield) {
        /* xname() describes unknown (unseen) reflection as smooth */
        if (shield.otyp == SHIELD_OF_REFLECTION)
            return shield.dknown ? _("silver shield") : _("smooth shield");
        /*
         * We might distinguish between wooden vs metallic or
         * light vs heavy to give small benefit to spell casters.
         * Fighter types probably care more about the former for
         * vulnerability to fire or rust.
         *
         * We could do that both ways: light wooden shield, light
         * metallic shield (there aren't any), heavy wooden shield,
         * and heavy metallic shield but that's getting away from
         * "simple name" which is intended to be shorter as well
         * as less detailed than xname().
         */
    }
    return _("shield");
}

/* for completeness */
export function shirt_simple_name(shirt) { /* const char * */
    return _("shirt");
}

export function mimic_obj_name(mtmp) { /* const char * */
    if (M_AP_TYPE(mtmp) == M_AP_OBJECT) {
        if (mtmp.mappearance == GOLD_PIECE)
            return _("gold");
        if (mtmp.mappearance != STRANGE_OBJECT)
            return simple_typename(int(mtmp.mappearance));
    }
    return _("whatcha-may-callit");
}

/*
 * Construct a query prompt string, based around an object name, which is
 * guaranteed to fit within [QBUFSZ].  Takes an optional prefix, three
 * choices for filling in the middle (two object formatting functions and a
 * last resort literal which should be very short), and an optional suffix.
 */
export function safe_qbuf(
    qbuf,
    qprefix,
    qsuffix,
    obj,
    func,
    altfunc,
    lastR) { /* char * */
    let bufp, endp;
    /* convert size_t (or int for ancient systems) to ordinary unsigned */
    let len, lenlimit,
        len_qpfx = (qprefix ? strlen(qprefix) : 0),
        len_qsfx = (qsuffix ? strlen(qsuffix) : 0),
        len_lastR = strlen(lastR);

    lenlimit = QBUFSZ - 1;
    endp = qbuf + lenlimit;
    assert(endp != (0)); /* workaround for static analyzer issue */
    /* sanity check, aimed mainly at paniclog (it's conceivable for
       the result of short_oname() to be shorter than the length of
       the last resort string, but we ignore that possibility here) */
    if (len_qpfx > lenlimit)
        impossible(_("safe_qbuf: prefix too long (%u characters)."), len_qpfx);
    else if (unsigned(len_qpfx + len_qsfx) > lenlimit)
        impossible(_("safe_qbuf: suffix too long (%u + %u characters)."),
                   len_qpfx, len_qsfx);
    else if (unsigned(unsigned(len_qpfx + len_lastR) + len_qsfx) > lenlimit)
        impossible(_("safe_qbuf: filler too long (%u + %u + %u characters)."),
                   len_qpfx, len_lastR, len_qsfx);

    /* the output buffer might be the same as the prefix if caller
       has already partially filled it */
    if (qbuf == qprefix) {
        /* prefix is already in the buffer */
        chars[endp] = ord('\0');
    } else if (qprefix) {
        /* put prefix into the buffer */
        strncpy(qbuf, qprefix, lenlimit);
        chars[endp] = ord('\0');
    } else {
        /* no prefix; output buffer starts out empty */
        chars[qbuf + 0] = ord('\0');
    }
    len = strlen(qbuf);

    if (unsigned(unsigned(len + len_lastR) + len_qsfx) > lenlimit) {
        /* too long; skip formatting, last resort output is truncated */
        if (len < lenlimit) {
            strncpy(qbuf + len, lastR, unsigned(lenlimit - len));
            chars[endp] = ord('\0');
            len = strlen(qbuf);
            if (qsuffix && len < lenlimit) {
                strncpy(qbuf + len, qsuffix, unsigned(lenlimit - len));
                chars[endp] = ord('\0');
                /* len = (unsigned) strlen(qbuf); */
            }
        }
    } else {
        /* suffix and last resort are guaranteed to fit */
        len = unsigned(len + len_qsfx); /* include the pending suffix */
        /* format the object */
        bufp = short_oname(obj, func, altfunc, unsigned(lenlimit - len));
        if (unsigned(len + strlen(bufp)) <= lenlimit)
            strcat(qbuf, bufp); /* formatted name fits */
        else
            strcat(qbuf, lastR); /* use last resort */
        releaseobuf(bufp);

        if (qsuffix)
            strcat(qbuf, qsuffix);
    }
    /* assert( strlen(qbuf) < QBUFSZ ); */
    return qbuf;
}

/*objnam.c*/

import { A_CHAOTIC, A_LAWFUL, A_NEUTRAL, A_NONE } from "./align.h.js";
import { Align2amask } from "./align.h.macros.js";
import { ART_ORB_OF_DETECTION } from "./artilist.h.js";
import { something } from "./decl.h.macros.js";
import {
    AMULET_CLASS, ARMOR_CLASS, BALL_CLASS, CHAIN_CLASS, COIN_CLASS, FOOD_CLASS, GEM_CLASS, GOLD_SYM,
    ILLOBJ_CLASS, MAXOCLASSES, POTION_CLASS, RING_CLASS, ROCK_CLASS, SCROLL_CLASS, SPBOOK_CLASS,
    S_PUDDING, TOOL_CLASS, VENOM_CLASS, WAND_CLASS, WEAPON_CLASS,
} from "./defsym.h.js";
import { Is_rogue_level } from "./dungeon.h.macros.js";
import { wizard } from "./flag.h.macros.js";
import { BUFSZ, COLNO, FALSE, QBUFSZ, ROWNO, TRUE, boolean, coordxy } from "./global.h.js";
import { Strlen, strcmpi } from "./global.h.macros.js";
import {
    CORPSTAT_FEMALE, CORPSTAT_GENDER, CORPSTAT_HISTORIC, CORPSTAT_MALE, CORPSTAT_NEUTER,
    CORPSTAT_RANDOM, COST_CONTENTS, CXN_ARTICLE, CXN_NOCORPSE, CXN_NORMAL, CXN_NO_PFX, CXN_PFX_THE,
    CXN_SINGULAR, FM_FMON, HAND, ONAME_NO_FLAGS, ONAME_WISH, RANDOM_TIN,
} from "./hack.h.js";
import { distu, max, min, plur, rn1, y_n } from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import {
    is_female, is_human, is_male, is_neuter, is_were, type_is_pname, verysmall,
} from "./mondata.h.macros.js";
import {
    FEMALE, G_NOCORPSE, G_UNIQ, MALE, MS_GUARDIAN, MV_KNOWS_EGG, NEUTRAL,
} from "./monflag.h.js";
import { M_AP_OBJECT } from "./monst.h.js";
import { DEADMONSTER, M_AP_TYPE, ismnum } from "./monst.h.macros.js";
import {
    LOW_PM, NON_PM, PM_ARCHEOLOGIST, PM_BLACK_PUDDING, PM_CLERIC, PM_GRAY_DRAGON, PM_GRAY_OOZE,
    PM_HIGH_CLERIC, PM_LONG_WORM, PM_LONG_WORM_TAIL, PM_MAIL_DAEMON, PM_SAMURAI,
    PM_WIZARD_OF_YENDOR, PM_YELLOW_DRAGON,
} from "./monsters.h.js";
import { SPE_LIM, struct_obj } from "./obj.h.js";
import {
    Has_contents, Is_box, Is_candle, Is_container, Is_dragon_mail, Is_dragon_scales, ONAME,
    bimanual, carried, has_oname, is_ammo, is_boots, is_gloves, is_missile, is_plural,
    is_poisonable, is_shield, is_weptool, is_wet_towel,
} from "./obj.h.macros.js";
import {
    ARM_BOOTS, ARM_CLOAK, ARM_GLOVES, ARM_HELM, ARM_SHIELD, ARM_SHIRT, ARM_SUIT, GEMSTONE, MINERAL,
    NUM_GLASS_GEMS, struct_fruit, struct_objclass,
} from "./objclass.h.js";
import {
    OBJ_DESCR, OBJ_NAME, is_corrodeable, is_crackable, is_damageable, is_rustprone,
} from "./objclass.h.macros.js";
import {
    ACID_VENOM, AKLYS, ALCHEMY_SMOCK, AMULET_OF_ESP, AMULET_OF_GUARDING, AMULET_OF_YENDOR,
    AMULET_VERSUS_POISON, BAG_OF_TRICKS, BEARTRAP, BELL, BELL_OF_OPENING, BLACK_OPAL,
    BLINDING_VENOM, BOULDER, BRASS_LANTERN, BROADSWORD, BULLWHIP, CANDELABRUM_OF_INVOCATION,
    CANDY_BAR, CHEST, CLOAK_OF_DISPLACEMENT, CORPSE, CREAM_PIE, CRYSKNIFE, CRYSTAL_BALL, DIAMOND,
    DILITHIUM_CRYSTAL, DUNCE_CAP, DWARVISH_MATTOCK, EGG, ELVEN_LEATHER_HELM, ELVEN_MITHRIL_COAT,
    ELVEN_SHIELD, EMERALD, ENORMOUS_MEATBALL, EUCALYPTUS_LEAF, EXPENSIVE_CAMERA,
    FAKE_AMULET_OF_YENDOR, FEDORA, FIGURINE, FIRST_GLASS_GEM, FLAIL, FLINT, FOOD_RATION,
    FORTUNE_COOKIE, GAUNTLETS_OF_DEXTERITY, GAUNTLETS_OF_POWER, GLAIVE, GLOB_OF_BLACK_PUDDING,
    GLOB_OF_GRAY_OOZE, GOLD_PIECE, GRAPPLING_HOOK, GRAY_DRAGON_SCALES, GRAY_DRAGON_SCALE_MAIL,
    HAWAIIAN_SHIRT, HEAVY_IRON_BALL, HELMET, HELM_OF_TELEPATHY, HORN_OF_PLENTY, IRON_CHAIN,
    IRON_SHOES, KATANA, KELP_FROND, KNIFE, LAND_MINE, LARGE_BOX, LAST_REAL_GEM, LEASH,
    LEATHER_GLOVES, LEMBAS_WAFER, LENSES, LEVITATION_BOOTS, LOADSTONE, LOCK_PICK, LOW_BOOTS,
    LUCKSTONE, MAGIC_HARP, MAGIC_LAMP, MAGIC_MARKER, MEAT_RING, MUMMY_WRAPPING, NUM_OBJECTS,
    OIL_LAMP, OPAL, ORANGE, ORCISH_SHIELD, PICK_AXE, PLATE_MAIL, POT_BOOZE, POT_OIL, POT_SLEEPING,
    POT_WATER, RIN_INCREASE_ACCURACY, RIN_PROTECTION_FROM_SHAPE_CHAN, ROBE, ROCK, RUBY, SACK,
    SAPPHIRE, SCALE_MAIL, SCR_BLANK_PAPER, SCR_CHARGING, SCR_MAIL, SHIELD_OF_REFLECTION,
    SHORT_SWORD, SILVER_SABER, SKELETON_KEY, SLIME_MOLD, SMALL_SHIELD, SPE_BLANK_PAPER,
    SPE_BOOK_OF_THE_DEAD, SPE_NOVEL, STATUE, STRANGE_OBJECT, TALLOW_CANDLE, TIN, TIN_OPENER,
    TOOLED_HORN, TOUCHSTONE, TOWEL, TRIPE_RATION, T_SHIRT, WAN_WISHING, WAX_CANDLE, WOODEN_HARP,
    YELLOW_DRAGON_SCALES, YELLOW_DRAGON_SCALE_MAIL,
} from "./objects.h.js";
import {
    HALLUC_RES, W_AMUL, W_ARMOR, W_BALL, W_CHAIN, W_QUIVER, W_RING, W_RINGL, W_RINGR, W_SADDLE,
    W_SWAPWEP, W_TOOL, W_WEP,
} from "./prop.h.js";
import {
    ALTAR, CLOUD, CORR, DBWALL, DB_FLOOR, DB_ICE, DB_LAVA, DB_MOAT, DB_UNDER, DOOR, DRAWBRIDGE_DOWN,
    DRAWBRIDGE_UP, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, FOUNTAIN, F_LOOTED,
    HWALL, ICE, ICED_MOAT, ICED_POOL, IRONBARS, LAVAPOOL, LAVAWALL, MOAT, POOL, ROOM, SCORR, SDOOR,
    SINK, S_LDWASHER, S_LPUDDING, S_LRING, THRONE, TREE, TREE_LOOTED, TREE_SWARM, T_LOOTED, VWALL,
    WATER, WM_MASK, W_NONDIGGABLE, W_NONPASSWALL,
} from "./rm.h.js";
import {
    CAN_OVERWRITE_TERRAIN, IS_DOOR, IS_FOUNTAIN, IS_FURNITURE, IS_GRAVE, IS_SINK, IS_WALL, levl,
} from "./rm.h.macros.js";
import { P_BOW, P_HAMMER, P_POLEARMS } from "./skills.h.js";
import { BURN_OBJECT, MELT_ICE_AWAY, TIMER_OBJECT, ZOMBIFY_MON } from "./timeout.h.js";
import { BEAR_TRAP, LANDMINE, MAGIC_PORTAL, NO_TRAP, ROCKTRAP, TRAPNUM } from "./trap.h.js";
import { is_hole } from "./trap.h.macros.js";
import { cansee } from "./vision.h.macros.js";
import { WT_IRON_BALL_INCR } from "./weight.h.js";
import { struct_any } from "./wintype.h.js";
import { TT_LAVA } from "./you.h.js";
import { Luck, Role_if, URIGHTY } from "./you.h.macros.js";
import {
    Blind, EHalluc_resistance, EWarn_of_mon, Flying, Glib, Levitation,
} from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import {
    char, int, ord, schar, short, sizeof, sizeof_string, uchar, ulong, unsigned,
} from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import {
    abs, assert, atoi, memcpy, memset, sprintf, strcat, strchr, strcmp, strcpy, strlen, strncat,
    strncmp, strncpy, strrchr, strstr,
} from "../rt/libc.js";
import {
    init_string, stack_array, stack_struct, stack_var, static_array, static_sizeof, static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, elt, ptr_add, ptr_to, ref_of, sizeof_member, struct, struct_assign,
} from "../rt/struct.js";
import {
    artifact_exists, artifact_light, artifact_name, artiname, find_artifact, glow_color, glow_verb,
    nartifact_exist, permapoisoned, undiscovered_artifact,
} from "./artifact.js";
import { isok } from "./cmd.js";
import { is_ice, is_lava, is_pool, is_pool_or_lava } from "./dbridge.js";
import {
    cg, disp, flags, gd, gf, gm, gw, gx, hands_obj, iflags, program_state, svb, svc, svl, svm, svp,
    u, vowels,
} from "./decl.js";
import { docrt, feel_newsym } from "./display.js";
import {
    lookup_novel, mon_pmname, noit_mon_nam, obj_pmname, oname, safe_oname,
} from "./do_name.js";
import { doffing, donning, hard_helmet } from "./do_wear.js";
import { def_char_to_objclass } from "./drawing.js";
import { Can_fall_thru } from "./dungeon.js";
import {
    consume_oeaten, obj_nutrition, set_tin_variety, tin_details, tin_variety_txt,
} from "./eat.js";
import { panic } from "./end.js";
import { del_engr_at, make_grave } from "./engrave.js";
import { paniclog } from "./files.js";
import { obj_to_any, pooleffects, set_uinwater, switch_terrain } from "./hack.js";
import {
    copynchars, digit, eos, fuzzymatch, highc, letter, lowc, mungspaces, ordin, s_suffix,
    str_start_is, strcasecpy, strncmpi, strstri, strsubst, upstart,
} from "./hacklib.js";
import { align_str } from "./insight.js";
import { count_contents, currency } from "./invent.js";
import { arti_light_description, find_mid } from "./light.js";
import { count_level_features } from "./mklev.js";
import { fix_wall_spines } from "./mkmaze.js";
import {
    curse, is_flammable, is_rottable, mkobj, mksobj, obj_extract_self, place_object, set_corpsenm,
    weight,
} from "./mkobj.js";
import { can_be_hatched, dead_species, genus, zombie_form } from "./mon.js";
import { name_to_mon, name_to_monplus } from "./mondata.js";
import { mons } from "./monst.js";
import { observe_object } from "./o_init.js";
import { objects } from "./objects.js";
import { ice_descr, waterbody_name } from "./pager.js";
import { impossible, pline } from "./pline.js";
import { body_part } from "./polyself.js";
import { is_quest_artifact } from "./questpgr.js";
import { apron_text, candy_wrapper_text, hawaiian_motif, tshirt_text } from "./read.js";
import { rn2, rnd } from "./rnd.js";
import { genders } from "./role.js";
import { CapitalMon } from "./rumors.js";
import {
    append_price_quote, delete_contents, get_cost_of_shop_item, is_unpaid, obfree,
    record_price_quote, shk_your, unpaid_cost,
} from "./shk.js";
import { begin_burn, peek_timer, spot_stop_timers, start_timer } from "./timeout.js";
import {
    deltrap, fire_damage_chain, maketrap, reset_utrap, t_at, trapname, water_damage_chain,
} from "./trap.js";
import { recalc_block_point } from "./vision.js";
import { counter_were } from "./were.js";
import { get_obj_location, start_melt_ice_timeout } from "./zap.js";
