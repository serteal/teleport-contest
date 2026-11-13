/* NetHack 5.0	do_name.c	$NHDT-Date: 1737013431 2025/01/15 23:43:51 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.326 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Pasi Kallinen, 2018. */
/* NetHack may be freely redistributed.  See license for details. */

export const NUMMBUF = 5;

/* manage a pool of BUFSZ buffers, so callers don't have to */
function nextmbuf() { /* char * */
    let bufs = static_array("nextmbuf.bufs", array_of(char, BUFSZ), NUMMBUF);
    let bufidx = static_var("nextmbuf.bufidx", int, 0);

    bufidx[0] = (bufidx[0] + 1) % NUMMBUF;
    return bufs[bufidx[0]];
}

/* allocate space for a monster's name; removes old name if there is one */
export function new_mgivenname(
    mon,
    lth) { /* void */ /* desired length (caller handles adding 1 for terminator) */
    if (lth) {
        /* allocate mextra if necessary; otherwise get rid of old name */
        if (!mon.mextra)
            mon.mextra = newmextra();
        else
            free_mgivenname(mon); /* has mextra, might also have name */
        ((mon).mextra.mgivenname) = addr_of(alloc(unsigned(lth)));
    } else {
        /* zero length: the new name is empty; get rid of the old name */
        if (has_mgivenname(mon))
            free_mgivenname(mon);
    }
}

/* release a monster's name; retains mextra even if all fields are now null */
export function free_mgivenname(mon) { /* void */
    if (has_mgivenname(mon)) {
        free(MGIVENNAME(mon));
        ((mon).mextra.mgivenname) = 0;
    }
}

/* allocate space for an object's name; removes old name if there is one */
export function new_oname(
    obj,
    lth) { /* void */ /* desired length (caller handles adding 1 for terminator) */
    if (lth) {
        /* allocate oextra if necessary; otherwise get rid of old name */
        if (!obj.oextra)
            obj.oextra = newoextra();
        else
            free_oname(obj); /* already has oextra, might also have name */
        ((obj).oextra.oname) = addr_of(alloc(unsigned(lth)));
    } else {
        /* zero length: the new name is empty; get rid of the old name */
        if (has_oname(obj))
            free_oname(obj);
    }
}

/* release an object's name; retains oextra even if all fields are now null */
export function free_oname(obj) { /* void */
    if (has_oname(obj)) {
        free(ONAME(obj));
        ((obj).oextra.oname) = 0;
    }
}

/*  safe_oname() always returns a valid pointer to
 *  a string, either the pointer to an object's name
 *  if it has one, or a pointer to an empty string
 *  if it doesn't.
 */
export function safe_oname(obj) { /* const char * */
    if (has_oname(obj))
        return ONAME(obj);
    return _("");
}

/* get a name for a monster or an object from player;
   truncate if longer than PL_PSIZ, then return it */
function name_from_player(
    outbuf,

    prompt,
    defres) { /* char * */ /* only used if EDIT_GETLIN is enabled; only useful * if windowport xxx's xxx_getlin() supports that */
    chars[outbuf + 0] = ord('\0');

    (defres);

    getlin(prompt, outbuf);
    if (!chars[outbuf] || chars[outbuf] == ord('\x1b'))
        return 0;

    /* strip leading and trailing spaces, condense internal sequences */
    mungspaces(outbuf);
    if (strlen(outbuf) >= PL_PSIZ)
        chars[outbuf + (PL_PSIZ - 1)] = ord('\0');
    return outbuf;
}

/* historical note: this returns a monster pointer because it used to
   allocate a new bigger block of memory to hold the monster and its name */
export function christen_monst(mtmp, name) { /* struct monst * */
    const $frame = stack_frame(); try {
    let lth;
    let buf = stack_array(char, PL_PSIZ);

    /* dogname & catname are PL_PSIZ arrays; object names have same limit */
    lth = (name && chars[name]) ? (int(strlen(name)) + 1) : 0;
    if (lth > PL_PSIZ) {
        lth = PL_PSIZ;
        name = strncpy(buf, name, PL_PSIZ - 1);
        chars[buf + (PL_PSIZ - 1)] = ord('\0');
    }
    new_mgivenname(mtmp, lth); /* removes old name if one is present */
    if (lth)
        strcpy(MGIVENNAME(mtmp), name);
    /* if 'mtmp' is leashed, persistent inventory window needs updating */
    if (mtmp.mleashed)
        update_inventory(); /* x - leash (attached to Fido) */
    return mtmp;
    } finally { stack_pop($frame); }
}

/* check whether user-supplied name matches or nearly matches an unnameable
   monster's name, or is an attempt to delete the monster's name; if so, give
   alternate reject message for do_mgivenname() */
function alreadynamed(mtmp, monnambuf, usrbuf) { /* boolean */
    const $frame = stack_frame(); try {
    let pronounbuf = stack_array(char, 10), p;

    if (!chars[usrbuf]) { /* attempt to erase existing name */
        let name_not_title = (has_mgivenname(mtmp)
                                  || type_is_pname(mtmp.data)
                                  || mtmp.isshk ? 1 : 0);
        pline(_("%s would rather keep %s existing %s."), upstart(monnambuf),
              is_rider(mtmp.data) ? _("its") : mhis(mtmp),
              name_not_title ? _("name") : _("title"));
        return TRUE;
    } else if (fuzzymatch(usrbuf, monnambuf, _(" -_"), TRUE)
               /* catch trying to name "the Oracle" as "Oracle" */
               || (!strncmpi(monnambuf, _("the "), 4)
                   && fuzzymatch(usrbuf, monnambuf + 4, _(" -_"), TRUE))
               /* catch trying to name "invisible Orcus" as "Orcus" */
               || ((p = strstri(monnambuf, _("invisible "))) != 0
                   && fuzzymatch(usrbuf, p + 10, _(" -_"), TRUE))
               /* catch trying to name "the priest of Crom" as "Crom" */
               || ((p = strstri(monnambuf, _(" of "))) != 0
                   && fuzzymatch(usrbuf, p + 4, _(" -_"), TRUE))) {
        if (is_rider(mtmp.data)) {
            /* avoid gendered pronoun for riders */
            pline(_("%s is already called that."), upstart(monnambuf));
        } else {
            pline(_("%s is already called %s."),
                  upstart(strcpy(pronounbuf, mhe(mtmp))), monnambuf);
        }
        return TRUE;
    } else if (mtmp.data == mons[PM_JUIBLEX]
               && strstri(monnambuf, _("Juiblex"))
               && !strncmpi((usrbuf), _(("Jubilex")), -1)) {
        pline(_("%s doesn't like being called %s."), upstart(monnambuf), usrbuf);
        return TRUE;
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

/* allow player to assign a name to some chosen monster */
function do_mgivenname() { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ), monnambuf = stack_array(char, BUFSZ), qbuf = stack_array(char, QBUFSZ);
    let cc = stack_struct(struct_nhcoord);
    let cx, cy;
    let mtmp = null;
    let do_swallow = FALSE;

    if (Hallucination()) {
        You(_("would never recognize it anyway."));
        return;
    }
    cc.x = u.ux;
    cc.y = u.uy;
    if (getpos(cc, FALSE, _("the monster you want to name")) < 0
        || !isok(cc.x, cc.y))
        return;
    cx = cc.x, cy = cc.y;

    if (u_at(cx, cy)) {
        if (u.usteed && canspotmon(u.usteed)) {
            mtmp = u.usteed;
        } else {
            pline(_("This %s creature is called %s and cannot be renamed."),
                  beautiful(), svp.plname);
            return;
        }
    } else
        mtmp = m_at(cx, cy);

    /* Allow you to name the monster that has swallowed you */
    if (!mtmp && u.uswallow) {
        let glyph = glyph_at(cx, cy);

        if (glyph_is_swallow(glyph)) {
            mtmp = u.ustuck;
            do_swallow = TRUE;
        }
    }

    if (!do_swallow && (!mtmp
        || (!sensemon(mtmp)
            && (!(cansee(cx, cy) || see_with_infrared(mtmp))
                || mtmp.mundetected || M_AP_TYPE(mtmp) == M_AP_FURNITURE
                || M_AP_TYPE(mtmp) == M_AP_OBJECT
                || (mtmp.minvis && !See_invisible()))))) {
        pline(_("I see no monster there."));
        return;
    }
    /* special case similar to the one in lookat() */
    sprintf(qbuf, _("What do you want to call %s?"), distant_monnam(mtmp, ARTICLE_THE, monnambuf))
;
    /* use getlin() to get a name string from the player */
    if (!name_from_player(buf, qbuf,
                          has_mgivenname(mtmp) ? MGIVENNAME(mtmp) : 0))
        return;

    /* Unique monsters have their own specific names or titles.
     * Shopkeepers, temple priests and other minions use alternate
     * name formatting routines which ignore any user-supplied name.
     *
     * Don't say a new name is being rejected if it happens to match
     * the existing name, or if the player is trying to remove the
     * monster's existing name without assigning a new one.
     */
    if ((mtmp.data.geno & G_UNIQ) && !mtmp.ispriest) {
        if (!alreadynamed(mtmp, monnambuf, buf))
            pline(_("%s doesn't like being called names!"), upstart(monnambuf));
    } else if (mtmp.isshk
               && !(Deaf() || helpless(mtmp)
                    || mtmp.data.msound <= MS_ANIMAL)) {
        if (!alreadynamed(mtmp, monnambuf, buf)) {
               ;
            verbalize(_("I'm %s, not %s."), shkname(mtmp), buf);
        }
    } else if (mtmp.ispriest || mtmp.isminion || mtmp.isshk
               || mtmp.data == mons[PM_GHOST] || has_ebones(mtmp)) {
        if (!alreadynamed(mtmp, monnambuf, buf))
            pline(_("%s will not accept the name %s."), upstart(monnambuf), buf);
    } else {
        christen_monst(mtmp, buf);
    }
    } finally { stack_pop($frame); }
}

/*
 * This routine used to change the address of 'obj' so be unsafe if not
 * used with extreme care.  Applying a name to an object no longer
 * allocates a replacement object, so that old risk is gone.
 */
function do_oname(obj) { /* void */
    const $frame = stack_frame(); try {
    let bufp, buf = stack_array(char, BUFSZ), bufcpy = stack_array(char, BUFSZ), qbuf = stack_array(char, QBUFSZ);
    let aname;
    let objtyp = stack_var(short, STRANGE_OBJECT);

    /* Do this now because there's no point in even asking for a name */
    if (obj.otyp == SPE_NOVEL) {
        pline(_("%s already has a published name."), Ysimple_name2(obj));
        return;
    }

    sprintf(qbuf, _("What do you want to name %s "), is_plural(obj) ? _("these") : _("this"))
;
    safe_qbuf(qbuf, qbuf, _("?"), obj, xname, simpleonames, _("item"));
    /* use getlin() to get a name string from the player */
    if (!name_from_player(buf, qbuf, safe_oname(obj)))
        return;

    /*
     * We don't violate illiteracy conduct here, although it is
     * arguable that we should for anything other than "X".  Doing so
     * would make attaching player's notes to hero's inventory have an
     * in-game effect, which may or may not be the correct thing to do.
     *
     * We do violate illiteracy in oname() if player creates Sting or
     * Orcrist, clearly being literate (no pun intended...).
     */

    if (obj.oartifact) {
        /* this used to give "The artifact seems to resist the attempt."
           but resisting is definite, no "seems to" about it */
        pline(_("%s resists the attempt."),
              /* any artifact should always pass the has_oname() test
                 but be careful just in case */
              has_oname(obj) ? ONAME(obj) : _("The artifact"));
        return;
    }

    /* relax restrictions over proper capitalization for artifacts */
    if ((aname = artifact_name(buf, objtyp, TRUE)) != 0
        && (restrict_name(obj, aname) || exist_artifact(obj.otyp, aname))) {
        /* substitute canonical spelling before slippage */
        strcpy(buf, aname);
        /* this used to change one letter, substituting a value
           of 'a' through 'y' (due to an off by one error, 'z'
           would never be selected) and then force that to
           upper case if such was the case of the input;
           now, the hand slip scuffs one or two letters as if
           the text had been trodden upon, sometimes picking
           punctuation instead of an arbitrary letter;
           unfortunately, we have to cover the possibility of
           it targeting spaces so failing to make any change
           (we know that it must eventually target a nonspace
           because buf[] matches a valid artifact name) */
        strcpy(bufcpy, buf);
        /* for "the Foo of Bar", only scuff "Foo of Bar" part */
        bufp = !strncmpi(buf, _("the "), 4) ? (buf + 4) : buf;
        do {
            wipeout_text(bufp, rnd_on_display_rng(2), 0);
        } while (!strcmp(buf, bufcpy));
        pline(_("While engraving, your %s slips."), body_part(HAND));
        display_nhwindow()(WIN_MESSAGE, FALSE);
        You(_("engrave: \"%s\"."), buf);
        /* violate illiteracy conduct since hero attempted to write
           a valid artifact name */
        u.uconduct.literate++;
    } else if (obj.otyp == objtyp[0]) {
        /* artifact_name() always returns non-Null when it sets objtyp */
        assert(aname != 0);

        /* artifact_name() found a match and restrict_name() didn't reject
           it; since 'obj' is the right type, naming will change it into an
           artifact so use canonical capitalization (Sting or Orcrist) */
        strcpy(buf, aname);
    }

    obj = oname(obj, buf, ONAME_VIA_NAMING | ONAME_KNOW_ARTI);
    (obj);
    } finally { stack_pop($frame); }
}

export function oname(
    obj,
    name,
    oflgs) { /* struct obj * */ /* flags, mostly for artifact creation */
    const $frame = stack_frame(); try {
    let lth;
    let buf = stack_array(char, PL_PSIZ);
    let via_naming = +((oflgs & ONAME_VIA_NAMING) != 0),
            skip_inv_update = +((oflgs & ONAME_SKIP_INVUPD) != 0);

    lth = chars[name] ? int(unsigned(strlen(name) + 1)) : 0;
    if (lth > PL_PSIZ) {
        lth = PL_PSIZ;
        name = strncpy(buf, name, PL_PSIZ - 1);
        chars[buf + (PL_PSIZ - 1)] = ord('\0');
    }
    /* If named artifact exists in the game, do not create another.
       Also trying to create an artifact shouldn't de-artifact
       it (e.g. Excalibur from prayer). In this case the object
       will retain its current name. */
    if (obj.oartifact || (lth && exist_artifact(obj.otyp, name)))
        return obj;

    new_oname(obj, lth); /* removes old name if one is present */
    if (lth)
        strcpy(ONAME(obj), name);

    if (lth)
        artifact_exists(obj, name, TRUE, oflgs);
    if (obj.oartifact) {
        /* can't dual-wield with artifact as secondary weapon */
        if (obj == uswapwep)
            untwoweapon();
        /* activate warning if you've just named your weapon "Sting" */
        if (obj == uwep)
            set_artifact_intrinsic(obj, TRUE, W_WEP);
        /* if obj is owned by a shop, increase your bill */
        if (obj.unpaid)
            alter_cost(obj, 0);
        if (via_naming) {
            /* violate illiteracy conduct since successfully wrote arti-name */
            if (!u.uconduct.literate++)
                livelog_printf(LL_CONDUCT | LL_ARTIFACT,
                               _("became literate by naming %s"),
                               bare_artifactname(obj));
            else
                livelog_printf(LL_ARTIFACT,
                               _("chose %s to be named \"%s\""),
                               ansimpleoname(obj), bare_artifactname(obj));
        }
    }
    if (carried(obj) && !skip_inv_update)
        update_inventory();
    return obj;
    } finally { stack_pop($frame); }
}

export function objtyp_is_callable(i) { /* boolean */
    if (objects[i].oc_uname)
        return TRUE;

    switch(objects[i].oc_class) {
    case AMULET_CLASS:
        /* 5.0: calling these used to be allowed but that enabled the
           player to tell whether two unID'd amulets of yendor were both
           fake or one was real by calling them distinct names and then
           checking discoveries to see whether first name was replaced
           by second or both names stuck; with more than two available
           to work with, if they weren't all fake it was possible to
           determine which one was the real one */
        if (i == AMULET_OF_YENDOR || i == FAKE_AMULET_OF_YENDOR)
            break; /* return FALSE */
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case SCROLL_CLASS:
    case POTION_CLASS:
    case WAND_CLASS:
    case RING_CLASS:
    case GEM_CLASS:
    case SPBOOK_CLASS:
    case ARMOR_CLASS:
    case TOOL_CLASS:
    case VENOM_CLASS:
        if (OBJ_DESCR(objects[i]))
            return TRUE;
        break;
    default:
        break;
    }
    return FALSE;
}

/* getobj callback for object to name (specific item) - anything but gold */
export function name_ok(obj) { /* int */
    if (!obj || obj.oclass == COIN_CLASS)
        return GETOBJ_EXCLUDE;

    if (!obj.dknown || obj.oartifact || obj.otyp == SPE_NOVEL)
        return GETOBJ_DOWNPLAY;

    return GETOBJ_SUGGEST;
}

/* getobj callback for object to call (name its type) */
export function call_ok(obj) { /* int */
    if (!obj || !objtyp_is_callable(obj.otyp))
        return GETOBJ_EXCLUDE;

    /* not a likely candidate if not seen yet since naming will fail,
       or if it has been discovered and doesn't already have a name;
       when something has been named and then becomes discovered, it
       remains a likely candidate until player renames it to <space>
       to remove that no longer needed name */
    if (!obj.dknown || (objects[obj.otyp].oc_name_known
                         && !objects[obj.otyp].oc_uname))
        return GETOBJ_DOWNPLAY;

    return GETOBJ_SUGGEST;
}

/* #call / #name command - player can name monster or object or type of obj */
export function docallcmd() { /* int */
    const $frame = stack_frame(); try {
    var obj;
    var win;
    var any = stack_struct(struct_any);
    var pick_list = stack_var(ptr_to(struct_mi), null);
    var cq = stack_struct(struct__cmd_queue), cmdq;
    var ch = 0;
    /* if player wants a,b,c instead of i,o when looting, do that here too */
    var abc = flags.lootabc;
    var clr = NO_COLOR;

    docallcmd: { if ((cmdq = cmdq_pop()) != null) {
        struct_assign(cq, cmdq);
        free(addr_of(cmdq));
        if (cq.typ == CMDQ_KEY)
            ch = cq.key;
        else
            cmdq_clear(CQ_CANNED);
        break docallcmd;
    }
    win = create_nhwindow()(NHW_MENU);
    start_menu()(win, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    any.a_char = ord('m'); /* group accelerator 'C' */
    add_menu(win, nul_glyphinfo, any, abc ? 0 : any.a_char, ord('C'),
             ATR_NONE, clr, _("a monster"), MENU_ITEMFLAGS_NONE);
    if (gi.invent) {
        /* we use y and n as accelerators so that we can accept user's
           response keyed to old "name an individual object?" prompt */
        any.a_char = ord('i'); /* group accelerator 'y' */
        add_menu(win, nul_glyphinfo, any, abc ? 0 : any.a_char, ord('y'),
                 ATR_NONE, clr, _("a particular object in inventory"),
                 MENU_ITEMFLAGS_NONE);
        any.a_char = ord('o'); /* group accelerator 'n' */
        add_menu(win, nul_glyphinfo, any, abc ? 0 : any.a_char, ord('n'),
                 ATR_NONE, clr, _("the type of an object in inventory"),
                 MENU_ITEMFLAGS_NONE);
    }
    any.a_char = ord('f'); /* group accelerator ',' (or ':' instead?) */
    add_menu(win, nul_glyphinfo, any, abc ? 0 : any.a_char, ord(','),
             ATR_NONE, clr, _("the type of an object upon the floor"),
             MENU_ITEMFLAGS_NONE);
    any.a_char = ord('d'); /* group accelerator '\' */
    add_menu(win, nul_glyphinfo, any, abc ? 0 : any.a_char, ord('\\'),
             ATR_NONE, clr, _("the type of an object on discoveries list"),
             MENU_ITEMFLAGS_NONE);
    any.a_char = ord('a'); /* group accelerator 'l' */
    add_menu(win, nul_glyphinfo, any, abc ? 0 : any.a_char, ord('l'),
             ATR_NONE, clr, _("record an annotation for the current level"),
             MENU_ITEMFLAGS_NONE);
    end_menu()(win, _("What do you want to name?"));
    if (select_menu(win, PICK_ONE, pick_list) > 0) {
        ch = ptr_add(pick_list[0], 0).item.a_char;
        free(addr_of(pick_list[0]));
    } else
        ch = ord('q');
    destroy_nhwindow()(win);
 }
    switch (ch) {
    default:
    case ord('q'):
        break;
    case ord('m'): /* name a visible monster */
        do_mgivenname();
        break;
    case ord('i'): /* name an individual object in inventory */
        obj = getobj(_("name"), name_ok, GETOBJ_PROMPT);
        if (obj)
            do_oname(obj);
        break;
    case ord('o'): /* name a type of object in inventory */
        obj = getobj(_("call"), call_ok, GETOBJ_NOFLAGS);
        if (obj) {
            /* behave as if examining it in inventory;
               this might set dknown if it was picked up
               while blind and the hero can now see */
            xname(obj);

            if (!obj.dknown) {
                You(_("would never recognize another one."));
            } else {
                docall(obj);
            }
        }
        break;
    case ord('f'): /* name a type of object visible on the floor */
        namefloorobj();
        break;
    case ord('d'): /* name a type of object on the discoveries list */
        rename_disco();
        break;
    case ord('a'): /* annotate level */
        donamelevel();
        break;
    }
    return ECMD_OK;
    } finally { stack_pop($frame); }
}

/* for use by safe_qbuf() */
function docall_xname(obj) { /* char * */
    const $frame = stack_frame(); try {
    let otemp = stack_struct(struct_obj);

    struct_assign(otemp, obj);
    otemp.oextra = null;
    otemp.quan = 1;
    /* in case water is already known, convert "[un]holy water" to "water" */
    otemp.blessed = otemp.cursed = 0;
    /* remove attributes that are doname() caliber but get formatted
       by xname(); most of these fixups aren't really needed because the
       relevant type of object isn't callable so won't reach this far */
    if (otemp.oclass == WEAPON_CLASS)
        otemp.otrapped = 0; /* not poisoned */
    else if (otemp.oclass == POTION_CLASS)
        otemp.oeroded = 0; /* not diluted */
    else if (otemp.otyp == TOWEL || otemp.otyp == STATUE)
        otemp.spe = 0; /* not wet or historic */
    else if (otemp.otyp == TIN)
        otemp.known = 0; /* suppress tin type (homemade, &c) and mon type */
    else if (otemp.otyp == FIGURINE)
        otemp.corpsenm = NON_PM; /* suppress mon type */
    else if (otemp.otyp == HEAVY_IRON_BALL)
        otemp.owt = objects[HEAVY_IRON_BALL].oc_weight; /* not "very heavy" */
    else if (otemp.oclass == FOOD_CLASS && otemp.globby)
        otemp.owt = 120; /* 6*20, neither a small glob nor a large one */

    return an(xname(otemp));
    } finally { stack_pop($frame); }
}

export function docall(obj) { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ), qbuf = stack_array(char, QBUFSZ);
    let uname_p;
    let had_name = FALSE;

    if (!obj.dknown)
        return; /* probably blind; Blind || Hallucination for 'fromsink' */
    flush_screen(1); /* buffered updates might matter to player's response */

    if (obj.oclass == POTION_CLASS && obj.corpsenm)
        /* fromsink: kludge, meaning it's sink water */
        sprintf(qbuf, _("Call a stream of %s fluid:"), OBJ_DESCR(objects[obj.otyp]));
    else
        safe_qbuf(qbuf, _("Call "), _(":"), obj,
                         docall_xname, simpleonames, _("thing"))
;
    /* pointer to old name */
    uname_p = ref_of(objects[obj.otyp], "oc_uname");
    /* use getlin() to get a name string from the player */
    if (!name_from_player(buf, qbuf, uname_p[0]))
        return;

    /* clear old name */
    if (uname_p[0]) {
        had_name = TRUE;
        free((uname_p[0])), uname_p[0] = 0; /* clear oc_uname */
    }

    /* strip leading and trailing spaces; uncalls item if all spaces */
    mungspaces(buf);
    if (!chars[buf]) {
        if (had_name) /* possibly remove from disco[]; old *uname_p is gone */
            undiscover_object(obj.otyp);
    } else {
        uname_p[0] = dupstr(buf);
        discover_object(obj.otyp, FALSE, TRUE, TRUE); /* possibly add to disco[] */
    }
    if (obj.where == OBJ_INVENT || carrying(obj.otyp))
        update_inventory();
    } finally { stack_pop($frame); }
}

function namefloorobj() { /* void */
    const $frame = stack_frame(); try {
    let cc = stack_struct(struct_nhcoord);
    let glyph;
    let buf = stack_array(char, BUFSZ);
    let obj = stack_var(ptr_to(struct_obj), null);
    let fakeobj = FALSE, use_plural;

    cc.x = u.ux, cc.y = u.uy;
    /* "dot for under/over you" only makes sense when the cursor hasn't
       been moved off the hero's '@' yet, but there's no way to adjust
       the help text once getpos() has started */
    sprintf(buf, _("object on map (or '.' for one %s you)"), (u.uundetected && hides_under(gy.youmonst.data))
              ? _("over") : _("under"))
;
    if (getpos(cc, FALSE, buf) < 0 || cc.x <= 0)
        return;
    if (u_at(cc.x, cc.y)) {
        obj[0] = vobj_at(u.ux, u.uy);
    } else {
        glyph = glyph_at(cc.x, cc.y);
        if (glyph_is_object(glyph))
            fakeobj = object_from_map(glyph, cc.x, cc.y, obj);
        /* else 'obj' stays null */
    }
    if (!obj[0]) {
        /* "under you" is safe here since there's no object to hide under */
        There(_("doesn't seem to be any object %s."),
              u_at(cc.x, cc.y) ? _("under you") : _("there"));
        return;
    }
    /* note well: 'obj' might be an instance of STRANGE_OBJECT if target
       is a mimic; passing that to xname (directly or via simpleonames)
       would yield "glorkum" so we need to handle it explicitly; it will
       always fail the Hallucination test and pass the !callable test,
       resulting in the "can't be assigned a type name" message */
    strcpy(buf, (obj[0].otyp != STRANGE_OBJECT)
                 ? simpleonames(obj[0])
                 : obj_descr[STRANGE_OBJECT].oc_name);
    use_plural = +(obj[0].quan > 1);
    if (Hallucination()) {
        let unames = stack_array(ptr_to(char), 6);
        let tmpbuf = stack_array(char, BUFSZ);

        /* straight role name */
        unames[0] = ((Upolyd() ? u.mfemale : flags.female) && gu.urole.name.f)
                     ? gu.urole.name.f
                     : gu.urole.name.m;
        /* random rank title for hero's role

           note: the 30 is hardcoded in xlev_to_rank, so should be
           hardcoded here too */
        unames[1] = rank_of(rn2_on_display_rng(30) + 1,
                            Role_switch(), flags.female);
        /* random fake monster */
        unames[2] = bogusmon(tmpbuf, 0);
        /* increased chance for fake monster */
        unames[3] = unames[2];
        /* traditional */
        unames[4] = roguename();
        /* silly */
        unames[5] = _("Wibbly Wobbly");
        pline(_("%s %s to call you \"%s.\""),
              The(buf), use_plural ? _("decide") : _("decides"),
              unames[rn2_on_display_rng(SIZE(unames))]);
    } else if (call_ok(obj[0]) == GETOBJ_EXCLUDE) {
        pline(_("%s %s can't be assigned a type name."),
              use_plural ? _("Those") : _("That"), buf);
    } else if (!obj[0].dknown) {
        You(_("don't know %s %s well enough to name %s."),
            use_plural ? _("those") : _("that"), buf, use_plural ? _("them") : _("it"));
    } else {
        docall(obj[0]);
    }
    if (fakeobj) {
        obj[0].where = OBJ_FREE; /* object_from_map() sets it to OBJ_FLOOR */
        dealloc_obj(obj[0]); /* has no contents */
    }
    } finally { stack_pop($frame); }
}

const ghostnames = static_array("ghostnames", ptr_to(char), null, [
    /* these names should have length < PL_NSIZ */
    /* Capitalize the names for aesthetics -dgk */
    _("Adri"),    _("Andries"),       _("Andreas"),     _("Bert"),    _("David"),  _("Dirk"),
    _("Emile"),   _("Frans"),         _("Fred"),        _("Greg"),    _("Hether"), _("Jay"),
    _("John"),    _("Jon"),           _("Karnov"),      _("Kay"),     _("Kenny"),  _("Kevin"),
    _("Maud"),    _("Michiel"),       _("Mike"),        _("Peter"),   _("Robert"), _("Ron"),
    _("Tom"),     _("Wilmar"),        _("Nick Danger"), _("Phoenix"), _("Jiro"),   _("Mizue"),
    _("Stephan"), _("Lance Braccus"), _("Shadowhawk"),  _("Murphy")
]);

/* ghost names formerly set by x_monnam(), now by makemon() instead */
export function rndghostname() { /* const char * */
    return rn2(7) ? ROLL_FROM(ghostnames)
                  : svp.plname;
}

/*
 * Monster naming functions:
 * x_monnam is the generic monster-naming function.
 *                seen        unseen       detected               named
 * mon_nam:     the newt        it      the invisible orc       Fido
 * noit_mon_nam:your newt (as if detected) your invisible orc   Fido
 * some_mon_nam:the newt    someone     the invisible orc       Fido
 *          or              something
 * l_monnam:    newt            it      invisible orc           dog called Fido
 * Monnam:      The newt        It      The invisible orc       Fido
 * noit_Monnam: Your newt (as if detected) Your invisible orc   Fido
 * Some_Monnam: The newt    Someone     The invisible orc       Fido
 *          or              Something
 * Adjmonnam:   The poor newt   It      The poor invisible orc  The poor Fido
 * Amonnam:     A newt          It      An invisible orc        Fido
 * a_monnam:    a newt          it      an invisible orc        Fido
 * m_monnam:    newt            xan     orc                     Fido
 * y_monnam:    your newt     your xan  your invisible orc      Fido
 * YMonnam:     Your newt     Your xan  Your invisible orc      Fido
 * noname_monnam(mon,article):
 *              article newt    art xan art invisible orc       art dog
 */

/*
 * article
 *
 * ARTICLE_NONE, ARTICLE_THE, ARTICLE_A: obvious
 * ARTICLE_YOUR: "your" on pets, "the" on everything else
 *
 * If the monster would be referred to as "it" or if the monster has a name
 * _and_ there is no adjective, "invisible", "saddled", etc., override this
 * and always use no article.
 *
 * suppress
 *
 * SUPPRESS_IT, SUPPRESS_INVISIBLE, SUPPRESS_HALLUCINATION, SUPPRESS_SADDLE.
 * SUPPRESS_MAPPEARANCE: if monster is mimicking another monster (cloned
 *              Wizard or quickmimic pet), describe the real monster rather
 *              than its current form;
 * EXACT_NAME: combination of all the above
 * SUPPRESS_NAME: omit monster's assigned name (unless uniq w/ pname).
 * AUGMENT_IT: not suppression but shares suppression bitmask; if result
 *              would have been "it", return "someone" if humanoid or
 *              "something" otherwise.
 *
 * Bug: if the monster is a priest or shopkeeper, not every one of these
 * options works, since those are special cases.
 */
export function x_monnam(
    mtmp,
    article,
    adjective,
    suppress,
    called) { /* char * */
    const $frame = stack_frame(); try {
    let buf = nextmbuf();
    let mdat = mtmp.data;
    let pm_name;
    let do_hallu, do_invis, do_it, do_saddle, do_mappear,
            do_exact, do_name, augment_it;
    let name_at_start, has_adjectives, insertbuf2,
            mappear_as_mon = +(M_AP_TYPE(mtmp) == M_AP_MONSTER);
    let bp, buf2 = stack_array(char, BUFSZ);

    if (mtmp == gy.youmonst)
        return strcpy(buf, _("you")); /* ignore article, "invisible", &c */

    if (program_state.gameover)
        suppress |= SUPPRESS_HALLUCINATION;
    if (article == ARTICLE_YOUR && !mtmp.mtame)
        article = ARTICLE_THE;

    if (u.uswallow && mtmp == u.ustuck) {
        /*
         * This monster has become important, for the moment anyway.
         * As the hero's consumer, it is worthy of ARTICLE_THE.
         * Also, suppress invisible as that particular characteristic
         * is unimportant now and you can see its interior anyway.
         */
        article = ARTICLE_THE;
        suppress |= SUPPRESS_INVISIBLE;
    }
    do_hallu = (Hallucination() && !(suppress & SUPPRESS_HALLUCINATION) ? 1 : 0);
    do_invis = (mtmp.minvis && !(suppress & SUPPRESS_INVISIBLE) ? 1 : 0);
    do_it = +(!canspotmon(mtmp) && article != ARTICLE_YOUR
            && !program_state.gameover && mtmp != u.usteed
            && !engulfing_u(mtmp) && !(suppress & SUPPRESS_IT));
    do_saddle = +!(suppress & SUPPRESS_SADDLE);
    do_mappear = (mappear_as_mon && !(suppress & SUPPRESS_MAPPEARANCE) ? 1 : 0);
    do_exact = +((suppress & EXACT_NAME) == EXACT_NAME);
    do_name = +(!(suppress & SUPPRESS_NAME) || type_is_pname(mdat));
    augment_it = +((suppress & AUGMENT_IT) != 0);

    chars[buf + 0] = ord('\0');

    /* unseen monsters, etc.; usually "it" but sometimes more specific;
       when hallucinating, the more specific values might be inverted */
    if (do_it) {
        /* !is_animal excludes all Y; !mindless excludes Z, M, \' */
        let s_one = +(humanoid(mdat) && !is_animal(mdat) && !mindless(mdat));

        strcpy(buf, !augment_it ? _("it")
                    : (!do_hallu ? s_one : !rn2(2)) ? _("someone")
                      : _("something"));
        return buf;
    }

    /* priests and minions: don't even use this function */
    if ((mtmp.ispriest || mtmp.isminion) && !do_mappear) {
        let name;
        let save_prop = EHalluc_resistance();
        let save_invis = mtmp.minvis;

        /* when true name is wanted, explicitly block Hallucination */
        if (!do_hallu)
            u.uprops[HALLUC_RES].extrinsic = 1;
        if (!do_invis)
            mtmp.minvis = 0;
        /* EXACT_NAME will force "of <deity>" on the Astral Plane */
        name = priestname(mtmp, article, do_exact, buf2);
        u.uprops[HALLUC_RES].extrinsic = save_prop;
        mtmp.minvis = save_invis;
        if (article == ARTICLE_NONE && !strncmp(name, _("the "), 4))
            name += 4;
        return strcpy(buf, name);
    }

    /* 'pm_name' is the base part of most names */
    if (do_mappear) {
        /*assert(ismnum(mtmp->mappearance));*/
        pm_name = pmname(mons[mtmp.mappearance], Mgender(mtmp));
    } else {
        pm_name = mon_pmname(mtmp);
    }

    /* Shopkeepers: use shopkeeper name.  For normal shopkeepers, just
     * "Asidonhopo"; for unusual ones, "Asidonhopo the invisible
     * shopkeeper" or "Asidonhopo the blue dragon".  If hallucinating,
     * none of this applies.
     */
    if (mtmp.isshk && !do_hallu && !do_mappear) {
        if (adjective && article == ARTICLE_THE) {
            /* pathological case: "the angry Asidonhopo the blue dragon"
               sounds silly */
            strcpy(buf, _("the "));
            strcat(strcat(buf, adjective), _(" "));
            strcat(buf, shkname(mtmp));
        } else {
            strcat(buf, shkname(mtmp));
            if (mdat != mons[PM_SHOPKEEPER] || do_invis){
                strcat(buf, _(" the "));
                if (do_invis)
                    strcat(buf, _("invisible "));
                strcat(buf, pm_name);
            }
        }
        return buf;
    }

    /* Put the adjectives in the buffer */
    if (adjective)
        strcat(strcat(buf, adjective), _(" "));
    if (do_invis)
        strcat(buf, _("invisible "));
    if (do_saddle && (mtmp.misc_worn_check & W_SADDLE) && !Blind()
        && !Hallucination())
        strcat(buf, _("saddled "));
    has_adjectives = +(chars[buf + 0] != ord('\0'));

    /* Put the actual monster name or type into the buffer now.
       Remember whether the buffer starts with a personal name. */
    if (do_hallu) {
        let rnamecode = stack_var(char);
        let rname = rndmonnam(addr_of(rnamecode));

        strcat(buf, rname);
        name_at_start = bogon_is_pname(rnamecode[0]);
    } else if (do_name && has_mgivenname(mtmp)) {
        let name = MGIVENNAME(mtmp);

        if (mdat == mons[PM_GHOST]) {
            sprintf(eos(buf), _("%s ghost"), s_suffix(name));
            name_at_start = TRUE;
        } else if (called) {
            sprintf(eos(buf), _("%s called %s"), pm_name, name);
            name_at_start = type_is_pname(mdat);
        } else if (is_mplayer(mdat) && (bp = strstri(name, _(" the "))) != 0) {
            /* <name> the <adjective> <invisible> <saddled> <rank> */
            let pbuf = stack_array(char, BUFSZ);

            strcpy(pbuf, name);
            chars[pbuf + (bp - name + 5)] = ord('\0'); /* adjectives right after " the " */
            if (has_adjectives)
                strcat(pbuf, buf);
            strcat(pbuf, bp + 5); /* append the rest of the name */
            strcpy(buf, pbuf);
            article = ARTICLE_NONE;
            name_at_start = TRUE;
        } else {
            strcat(buf, name);
            name_at_start = TRUE;
        }
    } else if (is_mplayer(mdat) && !In_endgame(u.uz)) {
        let pbuf = stack_array(char, BUFSZ);

        strcpy(pbuf, rank_of(mtmp.m_lev, monsndx(mdat),
                             mtmp.female));
        strcat(buf, lcase(pbuf));
        name_at_start = FALSE;
    } else {
        strcat(buf, pm_name);
        name_at_start = type_is_pname(mdat);
    }

    if (name_at_start && (article == ARTICLE_YOUR || !has_adjectives)) {
        if (mdat == mons[PM_WIZARD_OF_YENDOR])
            article = ARTICLE_THE;
        else
            article = ARTICLE_NONE;
    } else if ((mdat.geno & G_UNIQ) != 0 && article == ARTICLE_A) {
        article = ARTICLE_THE;
    }

    insertbuf2 = TRUE;
    chars[buf2 + 0] = ord('\0'); /* lint suppression */
    switch (article) {
    case ARTICLE_YOUR:
        strcpy(buf2, _("your "));
        break;
    case ARTICLE_THE:
        strcpy(buf2, _("the "));
        break;
    case ARTICLE_A:
        /* avoid an() here */
        just_an(buf2, buf); /* copy "a " or "an " into buf2[] */
        break;
    case ARTICLE_NONE:
    default:
        insertbuf2 = FALSE;
        break;
    }
    if (insertbuf2) {
        strcat(buf2, buf); /* buf2[] isn't viable to return,  */
        strcpy(buf, buf2); /* so transfer the result to buf[] */
    }
    return buf;
    } finally { stack_pop($frame); }
}

export function l_monnam(mtmp) { /* char * */
    return x_monnam(mtmp, ARTICLE_NONE, 0,
                    has_mgivenname(mtmp) ? SUPPRESS_SADDLE : 0, TRUE);
}

export function mon_nam(mtmp) { /* char * */
    return x_monnam(mtmp, ARTICLE_THE, 0,
                    has_mgivenname(mtmp) ? SUPPRESS_SADDLE : 0, FALSE);
}

/* print the name as if mon_nam() (y_monnam() if tame) was called, but
   assume that the player can always see the monster--used for probing and
   for monsters aggravating the player with a cursed potion of invisibility;
   also used for pet moving "reluctantly" onto cursed object when that pet
   can be seen either before or after it moves */
export function noit_mon_nam(mtmp) { /* char * */
    return x_monnam(mtmp, ARTICLE_YOUR, 0,
                    (has_mgivenname(mtmp) ? (SUPPRESS_SADDLE | SUPPRESS_IT)
                                          : SUPPRESS_IT),
                    FALSE);
}

/* in between noit_mon_nam() and mon_nam(); if the latter would pick "it",
   use "someone" (for humanoids) or "something" (for others) instead */
export function some_mon_nam(mtmp) { /* char * */
    return x_monnam(mtmp, ARTICLE_THE, 0,
                    (has_mgivenname(mtmp) ? (SUPPRESS_SADDLE | AUGMENT_IT)
                                          : AUGMENT_IT),
                    FALSE);
}

export function Monnam(mtmp) { /* char * */
    let bp = mon_nam(mtmp);

    chars[bp] = highc(chars[bp]);
    return bp;
}

export function noit_Monnam(mtmp) { /* char * */
    let bp = noit_mon_nam(mtmp);

    chars[bp] = highc(chars[bp]);
    return bp;
}

export function Some_Monnam(mtmp) { /* char * */
    let bp = some_mon_nam(mtmp);

    chars[bp] = highc(chars[bp]);
    return bp;
}

/* return "a dog" rather than "Fido", honoring hallucination and visibility */
export function noname_monnam(mtmp, article) { /* char * */
    return x_monnam(mtmp, article, 0, SUPPRESS_NAME, FALSE);
}

/* monster's own name -- overrides hallucination and [in]visibility
   so shouldn't be used in ordinary messages (mainly for disclosure) */
export function m_monnam(mtmp) { /* char * */
    return x_monnam(mtmp, ARTICLE_NONE, 0, EXACT_NAME, FALSE);
}

/* pet name: "your little dog" */
export function y_monnam(mtmp) { /* char * */
    let prefix, suppression_flag;

    prefix = mtmp.mtame ? ARTICLE_YOUR : ARTICLE_THE;
    suppression_flag = (has_mgivenname(mtmp)
                        /* "saddled" is redundant when mounted */
                        || mtmp == u.usteed)
                           ? SUPPRESS_SADDLE
                           : 0;

    return x_monnam(mtmp, prefix, 0, suppression_flag, FALSE);
}

/* y_monnam() for start of sentence */
export function YMonnam(mtmp) { /* char * */
    let bp = y_monnam(mtmp);

    chars[bp] = highc(chars[bp]);
    return bp;
}

export function Adjmonnam(mtmp, adj) { /* char * */
    let bp = x_monnam(mtmp, ARTICLE_THE, adj,
                        has_mgivenname(mtmp) ? SUPPRESS_SADDLE : 0, FALSE);

    chars[bp] = highc(chars[bp]);
    return bp;
}

export function a_monnam(mtmp) { /* char * */
    return x_monnam(mtmp, ARTICLE_A, 0,
                    has_mgivenname(mtmp) ? SUPPRESS_SADDLE : 0, FALSE);
}

export function Amonnam(mtmp) { /* char * */
    let bp = a_monnam(mtmp);

    chars[bp] = highc(chars[bp]);
    return bp;
}

/* used for monster ID by the '/', ';', and 'C' commands to block remote
   identification of the endgame altars via their attending priests */
export function distant_monnam(
    mon,
    article,
    outbuf) { /* char * */
    /* high priest(ess)'s identity is concealed on the Astral Plane,
       unless you're adjacent (overridden for hallucination which does
       its own obfuscation) */
    if (mon.data == mons[PM_HIGH_CLERIC] && !Hallucination()
        && Is_astralevel(u.uz) && !m_next2u(mon)) {
        strcpy(outbuf, article == ARTICLE_THE ? _("the ") : _(""));
        strcat(outbuf, mon.female ? _("high priestess") : _("high priest"));
    } else {
        strcpy(outbuf, x_monnam(mon, article, 0, 0, TRUE));
    }
    return outbuf;
}

/* returns mon_nam(mon) relative to other_mon; normal name unless they're
   the same, in which case the reference is to {him|her|it} self */
export function mon_nam_too(mon, other_mon) { /* char * */
    let outbuf;

    if (mon != other_mon) {
        outbuf = mon_nam(mon);
    } else {
        outbuf = nextmbuf();
        switch (pronoun_gender(mon, PRONOUN_HALLU)) {
        case 0:
            strcpy(outbuf, _("himself"));
            break;
        case 1:
            strcpy(outbuf, _("herself"));
            break;
        default:
        case 2:
            strcpy(outbuf, _("itself"));
            break;
        case 3: /* could happen when hallucinating */
            strcpy(outbuf, _("themselves"));
            break;
        }
    }
    return outbuf;
}

/* construct "<monnamtext> <verb> <othertext> {him|her|it}self" which might
   be distorted by Hallu; if that's plural, adjust monnamtext and verb */
export function monverbself(
    mon,
    monnamtext,
    verb,
    othertext) { /* char * */
    const $frame = stack_frame(); try {
    let verbs, selfbuf = stack_array(char, 40); /* sizeof "themselves" suffices */

    /* "himself"/"herself"/"itself", maybe "themselves" if hallucinating */
    strcpy(selfbuf, mon_nam_too(mon, mon));
    /* verb starts plural; this will yield singular except for "themselves" */
    verbs = vtense(selfbuf, verb);
    if (!strcmp(verb, verbs)) { /* a match indicates that it stayed plural */
        monnamtext = makeplural(monnamtext);
        /* for "it", makeplural() produces "them" but we want "they" */
        if (!strcmpi(monnamtext, genders[3].he)) {
            let capitaliz = +(chars[monnamtext + 0] == highc(chars[monnamtext + 0]));

            strcpy(monnamtext, genders[3].him);
            if (capitaliz)
                chars[monnamtext + 0] = highc(chars[monnamtext + 0]);
        }
    }
    strcat(strcat(monnamtext, _(" ")), verbs);
    if (othertext && chars[othertext])
        strcat(strcat(monnamtext, _(" ")), othertext);
    strcat(strcat(monnamtext, _(" ")), selfbuf);
    return monnamtext;
    } finally { stack_pop($frame); }
}

/* for debugging messages, where data might be suspect and we aren't
   taking what the hero does or doesn't know into consideration */
export function minimal_monnam(mon, ckloc) { /* char * */
    let ptr;
    let outbuf = nextmbuf();

    if (!mon) {
        strcpy(outbuf, _("[Null monster]"));
    } else if ((ptr = mon.data) == null) {
        strcpy(outbuf, _("[Null mon->data]"));
    } else if (ptr < mons[0]) {
        sprintf(outbuf, _("[Invalid mon->data %s < %s]"), fmt_ptr(addr_of(mon.data)), fmt_ptr(addr_of(mons[0])))

;
    } else if (ptr >= mons[NUMMONS]) {
        sprintf(outbuf, _("[Invalid mon->data %s >= %s]"), fmt_ptr(addr_of(mon.data)), fmt_ptr(addr_of(mons[NUMMONS])))

;
    } else if (ckloc && ptr == mons[PM_LONG_WORM] && mon.mx
               && svl.level.monsters[mon.mx][mon.my] != mon) {
        sprintf(outbuf, _("%s <%d,%d>"), pmname(mons[PM_LONG_WORM_TAIL], Mgender(mon)), mon.mx, mon.my)

;
    } else {
        sprintf(outbuf, _("%s%s <%d,%d>"), mon.mtame ? _("tame ") : mon.mpeaceful ? _("peaceful ") : _(""), mon_pmname(mon), mon.mx, mon.my)

;
        if (mon.cham != NON_PM)
            sprintf(eos(outbuf), _("{%s}"), pmname(mons[mon.cham], Mgender(mon)))
;
    }
    return outbuf;
}

export function Mgender(mtmp) { /* int */
    let mgender = MALE;

    if (mtmp == gy.youmonst) {
        if (Upolyd() ? u.mfemale : flags.female)
            mgender = FEMALE;
    } else if (mtmp.female) {
        mgender = FEMALE;
    }
    return mgender;
}

export function pmname(pm, mgender) { /* const char * */
    if (mgender < MALE || mgender >= NUM_MGENDERS || !pm.pmnames[mgender])
        mgender = NEUTRAL;
    return pm.pmnames[mgender];
}

/* mons[]->pmname for a monster */
export function mon_pmname(mon) { /* const char * */
    /* for neuter, mon->data->pmnames[MALE] will be Null and use [NEUTRAL] */
    return pmname(mon.data, Mgender(mon));
}

/* mons[]->pmname for a corpse or statue or figurine */
export function obj_pmname(obj) { /* const char * */
    /* #if 0: not in this build */

    if ((obj.otyp == CORPSE || obj.otyp == STATUE || obj.otyp == FIGURINE)
        && ismnum(obj.corpsenm)) {
        let cgend = (obj.spe & CORPSTAT_GENDER),
            mgend = ((cgend == CORPSTAT_MALE) ? MALE
                     : (cgend == CORPSTAT_FEMALE) ? FEMALE
                       : NEUTRAL),
            mndx = obj.corpsenm;

        /* mons[].pmnames[] for monster cleric uses "priest" or "priestess"
           or "aligned cleric"; we want to avoid "aligned cleric [corpse]"
           unless it has been explicitly flagged as neuter rather than
           defaulting to random (which fails male or female check above);
           role monster cleric uses "priest" or "priestess" or "cleric"
           without "aligned" prefix so we switch to that; [can't force
           random gender to be chosen here because splitting a stack of
           corpses could cause the split-off portion to change gender, so
           settle for avoiding "aligned"] */
        if (mndx == PM_ALIGNED_CLERIC && cgend == CORPSTAT_RANDOM)
            mndx = PM_CLERIC;

        return pmname(mons[mndx], mgend);
    }
    impossible(_("obj_pmname otyp:%i,corpsenm:%i"), obj.otyp, obj.corpsenm);
    return _("two-legged glorkum-seeker");
}

/* used by bogusmon(next) and also by init_CapMons(rumors.c);
   bogon_is_pname(below) checks a hard-coded subset of these rather than
   use this list.
   Also used in rumors.c */
export const bogon_codes = init_string(static_array("bogon_codes", char, sizeof_string("-_+|=")), _("-_+|="), true); /* see dat/bonusmon.txt */

/* fake monsters used to be in a hard-coded array, now in a data file */
export function bogusmon(buf, code) { /* char * */
    let mnam = buf;

    if (code)
        chars[code] = ord('\0');
    /* might fail (return empty buf[]) if the file isn't available */
    get_rnd_text(_(BOGUSMONFILE), buf, rn2_on_display_rng, MD_PAD_BOGONS);
    if (!chars[mnam]) {
        strcpy(buf, _("bogon"));
    } else if (strchr(bogon_codes, chars[mnam])) { /* strip prefix if present */
        if (code)
            chars[code] = chars[mnam];
        ++mnam;
    }
    return mnam;
}

/* return a random monster name, for hallucination */
export function rndmonnam(code) { /* char * */
    let buf = static_array("rndmonnam.buf", char, BUFSZ);
    let mnam;
    let name;

    if (code)
        chars[code] = ord('\0');

    do {
        name = rn2_on_display_rng(SPECIAL_PM + BOGUSMONSIZE - LOW_PM) + LOW_PM;
    } while (name < SPECIAL_PM
             && (type_is_pname(mons[name]) || (mons[name].geno & G_NOGEN)));

    if (name >= SPECIAL_PM) {
        mnam = bogusmon(buf, code);
    } else {
        mnam = strcpy(buf, pmname(mons[name], rn2_on_display_rng(2)));
    }
    return mnam;
}
export const BOGUSMONSIZE = 100;

/* check bogusmon prefix to decide whether it's a personal name */
export function bogon_is_pname(code) { /* boolean */
    if (!code)
        return FALSE;
    return strchr(_("-+="), code) ? TRUE : FALSE;
}

/* name of a Rogue player */
export function roguename() { /* const char * */
    let i, opts;

    if ((opts = nh_getenv(_("ROGUEOPTS"))) != 0) {
        for (i = opts; chars[i]; i++)
            if (!strncmp(_("name="), i, 5)) {
                let j;
                if ((j = strchr(i + 5, ord(','))) != 0)
                    chars[j] = 0;
                return i + 5;
            }
    }
    return rn2(3) ? (rn2(2) ? _("Michael Toy") : _("Kenneth Arnold"))
                  : _("Glenn Wichman");
}

const hcolors = static_array("hcolors", ptr_to(char), null, [
    _("ultraviolet"), _("infrared"), _("bluish-orange"), _("reddish-green"), _("dark white"),
    _("light black"), _("sky blue-pink"), _("pinkish-cyan"), _("indigo-chartreuse"),
    _("salty"), _("sweet"), _("sour"), _("bitter"), _("umami"), /* basic tastes */
    _("striped"), _("spiral"), _("swirly"), _("plaid"), _("checkered"), _("argyle"), _("paisley"),
    _("blotchy"), _("guernsey-spotted"), _("polka-dotted"), _("square"), _("round"),
    _("triangular"), _("cabernet"), _("sangria"), _("fuchsia"), _("wisteria"), _("lemon-lime"),
    _("strawberry-banana"), _("peppermint"), _("romantic"), _("incandescent"),
    _("octarine"), /* Discworld: the Colour of Magic */
    _("excitingly dull"), _("mauve"), _("electric"),
    _("neon"), _("fluorescent"), _("phosphorescent"), _("translucent"), _("opaque"),
    _("psychedelic"), _("iridescent"), _("rainbow-colored"), _("polychromatic"),
    _("colorless"), _("colorless green"),
    _("dancing"), _("singing"), _("loving"), _("loudy"), _("noisy"), _("clattery"), _("silent"),
    _("apocyan"), _("infra-pink"), _("opalescent"), _("violant"), _("tuneless"),
    _("viridian"), _("aureolin"), _("cinnabar"), _("purpurin"), _("gamboge"), _("madder"),
    _("bistre"), _("ecru"), _("fulvous"), _("tekhelet"), _("selective yellow"),
]);

export function hcolor(colorpref) { /* const char * */
    return (Hallucination() || !colorpref)
        ? hcolors[rn2_on_display_rng(SIZE(hcolors))]
        : colorpref;
}

/* return a random real color unless hallucinating */
export function rndcolor() { /* const char * */
    let k = rn2(CLR_MAX);

    return Hallucination() ? hcolor(0)
                         : (k == NO_COLOR) ? _("colorless")
                                           : c_obj_colors[k];
}

const hliquids = static_array("hliquids", ptr_to(char), null, [
    _("yoghurt"), _("oobleck"), _("clotted blood"), _("diluted water"), _("purified water"),
    _("instant coffee"), _("tea"), _("herbal infusion"), _("liquid rainbow"),
    _("creamy foam"), _("mulled wine"), _("bouillon"), _("nectar"), _("grog"), _("flubber"),
    _("ketchup"), _("slow light"), _("oil"), _("vinaigrette"), _("liquid crystal"), _("honey"),
    _("caramel sauce"), _("ink"), _("aqueous humour"), _("milk substitute"),
    _("fruit juice"), _("glowing lava"), _("gastric acid"), _("mineral water"),
    _("cough syrup"), _("quicksilver"), _("sweet vitriol"), _("grey goo"), _("pink slime"),
    _("cosmic latte"), _("bone oil"), _("custard"), _("lard"), _("vinegar"), _("creosote"),
    /* "new coke (tm)", --better not */
]);

/* if hallucinating, return a random liquid instead of 'liquidpref' */
export function hliquid(
    liquidpref) { /* const char * */ /* use as-is when not hallucintg (unless empty) */
    let hallucinate = (Hallucination() && !program_state.gameover ? 1 : 0);

    if (hallucinate || !liquidpref || !chars[liquidpref]) {
        let indx, count = SIZE(hliquids);

        /* if we have a non-hallucinatory default value, include it
           among the choices */
        if (liquidpref && chars[liquidpref])
            ++count;
        indx = rn2_on_display_rng(count);
        if (IndexOk(indx, hliquids))
            return hliquids[indx];
    }
    return liquidpref;
}

/* Aliases for road-runner nemesis
 */
const coynames = static_array("coynames", ptr_to(char), null, [
    _("Carnivorous Vulgaris"), _("Road-Runnerus Digestus"), _("Eatibus Anythingus"),
    _("Famishus-Famishus"), _("Eatibus Almost Anythingus"), _("Eatius Birdius"),
    _("Famishius Fantasticus"), _("Eternalii Famishiis"), _("Famishus Vulgarus"),
    _("Famishius Vulgaris Ingeniusi"), _("Eatius-Slobbius"), _("Hardheadipus Oedipus"),
    _("Carnivorous Slobbius"), _("Hard-Headipus Ravenus"), _("Evereadii Eatibus"),
    _("Apetitius Giganticus"), _("Hungrii Flea-Bagius"), _("Overconfidentii Vulgaris"),
    _("Caninus Nervous Rex"), _("Grotesques Appetitus"), _("Nemesis Ridiculii"),
    _("Canis latrans")
]);

export function coyotename(mtmp, buf) { /* char * */
    if (mtmp && buf) {
        sprintf(buf, _("%s - %s"), x_monnam(mtmp, ARTICLE_NONE, 0, 0, TRUE), mtmp.mcan ? coynames[SIZE(coynames) - 1]
                           : coynames[mtmp.m_id % (SIZE(coynames) - 1)])

;
    }
    return buf;
}

export function rndorcname(s) { /* char * */
    let v = static_array("rndorcname.v", ptr_to(char), null, [ _("a"), _("ai"), _("og"), _("u") ]);
    let snd = static_array("rndorcname.snd", ptr_to(char), null, [ _("gor"), _("gris"), _("un"), _("bane"), _("ruk"),
                                 _("oth"),_("ul"), _("z"), _("thos"),_("akh"),_("hai") ]);
    let i, iend = rn1(2, 3), vstart = rn2(2);

    if (s) {
        chars[s] = ord('\0');
        for (i = 0; i < iend; ++i) {
            vstart = 1 - vstart;                /* 0 -> 1, 1 -> 0 */
            sprintf(eos(s), _("%s%s"), (i > 0 && !rn2(30)) ? _("-") : _(""), vstart ? ROLL_FROM(v) : ROLL_FROM(snd))
;
        }
    }
    return s;
}

export function christen_orc(mtmp, gang, other) { /* struct monst * */
    const $frame = stack_frame(); try {
    let sz = 0;
    let buf = stack_array(char, BUFSZ), buf2 = stack_array(char, BUFSZ), orcname;

    orcname = rndorcname(buf2);
    /* rndorcname() won't return NULL */
    sz = int(strlen(orcname));
    if (gang)
        sz += int(unsigned(unsigned(strlen(gang) + sizeof_string(" of ")) - sizeof_string("")));
    else if (other)
        sz += int(strlen(other));

    if (sz < BUFSZ) {
        let gbuf = stack_array(char, BUFSZ);
        let nameit = FALSE;

        if (gang) {
            sprintf(buf, _("%s of %s"), upstart(orcname), upstart(strcpy(gbuf, gang)))
;
            nameit = TRUE;
        } else if (other) {
            sprintf(buf, _("%s%s"), upstart(orcname), other);
            nameit = TRUE;
        }
        if (nameit)
            mtmp = christen_monst(mtmp, buf);
    }
    return mtmp;
    } finally { stack_pop($frame); }
}

/* Discworld novel titles, in the order that they were published; a subset
   of them have index macros used for variant spellings; if the titles are
   reordered for some reason, make sure that those get renumbered to match */
const sir_Terry_novels = static_array("sir_Terry_novels", ptr_to(char), null, [
    _("The Colour of Magic"), _("The Light Fantastic"), _("Equal Rites"), _("Mort"),
    _("Sourcery"), _("Wyrd Sisters"), _("Pyramids"), _("Guards! Guards!"), _("Eric"),
    _("Moving Pictures"), _("Reaper Man"), _("Witches Abroad"), _("Small Gods"),
    _("Lords and Ladies"), _("Men at Arms"), _("Soul Music"), _("Interesting Times"),
    _("Maskerade"), _("Feet of Clay"), _("Hogfather"), _("Jingo"), _("The Last Continent"),
    _("Carpe Jugulum"), _("The Fifth Elephant"), _("The Truth"), _("Thief of Time"),
    _("The Last Hero"), _("The Amazing Maurice and His Educated Rodents"),
    _("Night Watch"), _("The Wee Free Men"), _("Monstrous Regiment"),
    _("A Hat Full of Sky"), _("Going Postal"), _("Thud!"), _("Wintersmith"),
    _("Making Money"), _("Unseen Academicals"), _("I Shall Wear Midnight"), _("Snuff"),
    _("Raising Steam"), _("The Shepherd's Crown")
]);
export const NVL_COLOUR_OF_MAGIC = 0;
export const NVL_SOURCERY = 4;
export const NVL_MASKERADE = 17;
export const NVL_AMAZING_MAURICE = 27;
export const NVL_THUD = 33;

export function noveltitle(novidx) { /* const char * */
    let j, k = SIZE(sir_Terry_novels);

    j = rn2(k);
    if (novidx) {
        if (novidx[0] == -1)
            novidx[0] = j;
        else if (novidx[0] >= 0 && novidx[0] < k)
            j = novidx[0];
    }
    return sir_Terry_novels[j];
}

/* figure out canonical novel title from player-specified one */
export function lookup_novel(lookname, idx) { /* const char * */
    let k;

    /*
     * Accept variant spellings:
     * _The_Colour_of_Magic_ uses British spelling, and American
     * editions keep that, but we also recognize American spelling;
     * _Sourcery_ is a joke rather than British spelling of "sorcery".
     */
    if (!strncmpi((The(lookname)), _(("The Color of Magic")), -1))
        lookname = sir_Terry_novels[NVL_COLOUR_OF_MAGIC];
    else if (!strncmpi((lookname), _(("Sorcery")), -1))
        lookname = sir_Terry_novels[NVL_SOURCERY];
    else if (!strncmpi((lookname), _(("Masquerade")), -1))
        lookname = sir_Terry_novels[NVL_MASKERADE];
    else if (!strncmpi((The(lookname)), _(("The Amazing Maurice")), -1))
        lookname = sir_Terry_novels[NVL_AMAZING_MAURICE];
    else if (!strncmpi((lookname), _(("Thud")), -1))
        lookname = sir_Terry_novels[NVL_THUD];

    for (k = 0; k < SIZE(sir_Terry_novels); ++k) {
        if (!strcmpi(lookname, sir_Terry_novels[k])
            || !strncmpi((The(lookname)), (sir_Terry_novels[k]), -1)) {
            if (idx)
                idx[0] = k;
            return sir_Terry_novels[k];
        }
    }
    /* name not found; if novelidx is already set, override the name */
    if (idx && IndexOk(idx[0], sir_Terry_novels))
        return sir_Terry_novels[idx[0]];

    return 0;
}

/*do_name.c*/

import { CLR_MAX, NO_COLOR } from "./color.h.js";
import { struct_nhcoord } from "./coord.h.js";
import {
    AMULET_CLASS, ARMOR_CLASS, COIN_CLASS, FOOD_CLASS, GEM_CLASS, POTION_CLASS, RING_CLASS,
    SCROLL_CLASS, SPBOOK_CLASS, TOOL_CLASS, VENOM_CLASS, WAND_CLASS, WEAPON_CLASS,
} from "./defsym.h.js";
import { canspotmon, glyph_is_object, glyph_is_swallow, vobj_at } from "./display.h.macros.js";
import { In_endgame, Is_astralevel } from "./dungeon.h.macros.js";
import {
    BOGUSMONFILE, BUFSZ, FALSE, LL_ARTIFACT, LL_CONDUCT, MD_PAD_BOGONS, PL_PSIZ, QBUFSZ, TRUE,
} from "./global.h.js";
import { strcmpi } from "./global.h.macros.js";
import {
    ARTICLE_A, ARTICLE_NONE, ARTICLE_THE, ARTICLE_YOUR, AUGMENT_IT, CMDQ_KEY, CORPSTAT_FEMALE,
    CORPSTAT_GENDER, CORPSTAT_MALE, CORPSTAT_RANDOM, CQ_CANNED, ECMD_OK, EXACT_NAME,
    GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_NOFLAGS, GETOBJ_PROMPT, GETOBJ_SUGGEST, HAND,
    ONAME_KNOW_ARTI, ONAME_SKIP_INVUPD, ONAME_VIA_NAMING, SUPPRESS_HALLUCINATION,
    SUPPRESS_INVISIBLE, SUPPRESS_IT, SUPPRESS_MAPPEARANCE, SUPPRESS_NAME, SUPPRESS_SADDLE,
    struct__cmd_queue,
} from "./hack.h.js";
import { IndexOk, ROLL_FROM, rn1 } from "./hack.h.macros.js";
import { MGIVENNAME, has_ebones, has_mgivenname } from "./mextra.h.macros.js";
import {
    hides_under, humanoid, is_animal, is_mplayer, is_rider, mindless, monsndx, type_is_pname,
} from "./mondata.h.macros.js";
import { FEMALE, G_NOGEN, G_UNIQ, MALE, MS_ANIMAL, NEUTRAL, NUM_MGENDERS } from "./monflag.h.js";
import { M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT } from "./monst.h.js";
import { M_AP_TYPE, engulfing_u, helpless, ismnum } from "./monst.h.macros.js";
import {
    LOW_PM, NON_PM, NUMMONS, PM_ALIGNED_CLERIC, PM_CLERIC, PM_GHOST, PM_HIGH_CLERIC, PM_JUIBLEX,
    PM_LONG_WORM, PM_LONG_WORM_TAIL, PM_SHOPKEEPER, PM_WIZARD_OF_YENDOR, SPECIAL_PM,
} from "./monsters.h.js";
import { OBJ_FREE, OBJ_INVENT, struct_obj } from "./obj.h.js";
import { ONAME, carried, has_oname, is_plural } from "./obj.h.macros.js";
import { OBJ_DESCR } from "./objclass.h.macros.js";
import {
    AMULET_OF_YENDOR, CORPSE, FAKE_AMULET_OF_YENDOR, FIGURINE, HEAVY_IRON_BALL, SPE_NOVEL, STATUE,
    STRANGE_OBJECT, TIN, TOWEL,
} from "./objects.h.js";
import { HALLUC_RES, W_SADDLE, W_WEP } from "./prop.h.js";
import { m_at } from "./rm.h.macros.js";
import { cansee } from "./vision.h.macros.js";
import {
    create_nhwindow, destroy_nhwindow, display_nhwindow, end_menu, start_menu,
} from "./winprocs.h.macros.js";
import {
    ATR_NONE, MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, NHW_MENU, PICK_ONE, struct_any, struct_mi,
} from "./wintype.h.js";
import { PRONOUN_HALLU } from "./you.h.js";
import { Role_switch, Upolyd, m_next2u, mhe, mhis, u_at } from "./you.h.macros.js";
import {
    Blind, Deaf, EHalluc_resistance, Hallucination, See_invisible,
} from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, short, sizeof_string, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import {
    assert, free, sprintf, strcat, strchr, strcmp, strcpy, strlen, strncmp, strncpy,
} from "../rt/libc.js";
import {
    init_string, stack_array, stack_struct, stack_var, static_array, static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, array_of, ptr_add, ptr_to, ref_of, struct_assign } from "../rt/struct.js";
import { alloc, dupstr, fmt_ptr } from "./alloc.js";
import { beautiful } from "./apply.js";
import {
    artifact_exists, artifact_name, exist_artifact, restrict_name, set_artifact_intrinsic,
} from "./artifact.js";
import { rank_of } from "./botl.js";
import { cmdq_clear, cmdq_pop, isok } from "./cmd.js";
import { c_obj_colors, cg, flags, gi, gu, gy, program_state, svl, svp, u } from "./decl.js";
import { flush_screen, glyph_at, nul_glyphinfo, see_with_infrared, sensemon } from "./display.js";
import { donamelevel } from "./dungeon.js";
import { wipeout_text } from "./engrave.js";
import { getpos } from "./getpos.js";
import {
    eos, fuzzymatch, highc, lcase, mungspaces, s_suffix, strncmpi, strstri, upstart,
} from "./hacklib.js";
import { carrying, getobj, update_inventory } from "./invent.js";
import { newmextra } from "./makemon.js";
import { dealloc_obj, newoextra } from "./mkobj.js";
import { pronoun_gender } from "./mondata.js";
import { mons } from "./monst.js";
import { discover_object, rename_disco, undiscover_object } from "./o_init.js";
import { obj_descr, objects } from "./objects.js";
import {
    The, Ysimple_name2, an, ansimpleoname, bare_artifactname, just_an, makeplural, safe_qbuf,
    simpleonames, vtense, xname,
} from "./objnam.js";
import { nh_getenv } from "./options.js";
import { object_from_map } from "./pager.js";
import { There, You, impossible, livelog_printf, pline, verbalize } from "./pline.js";
import { body_part } from "./polyself.js";
import { priestname } from "./priest.js";
import { rn2, rn2_on_display_rng, rnd_on_display_rng } from "./rnd.js";
import { genders } from "./role.js";
import { get_rnd_text } from "./rumors.js";
import { alter_cost } from "./shk.js";
import { shkname } from "./shknam.js";
import { untwoweapon } from "./wield.js";
import { add_menu, getlin, select_menu } from "./windows.js";
