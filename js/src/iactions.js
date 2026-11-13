/* NetHack 5.0	iactions.c	$NHDT-Date: 1762680996 2025/11/09 01:36:36 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.543 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Pasi Kallinen, 2026. */
/* NetHack may be freely redistributed.  See license for details. */

    const IA_NONE = 0;
    const IA_UNWIELD = IA_NONE + 1;
    const IA_APPLY_OBJ = IA_UNWIELD + 1;
    const IA_DIP_OBJ = IA_APPLY_OBJ + 1;
    const IA_NAME_OBJ = IA_DIP_OBJ + 1;
    const IA_NAME_OTYP = IA_NAME_OBJ + 1;
    const IA_DROP_OBJ = IA_NAME_OTYP + 1;
    const IA_EAT_OBJ = IA_DROP_OBJ + 1;
    const IA_ENGRAVE_OBJ = IA_EAT_OBJ + 1;
    const IA_FIRE_OBJ = IA_ENGRAVE_OBJ + 1;
    const IA_ADJUST_OBJ = IA_FIRE_OBJ + 1;
    const IA_ADJUST_STACK = IA_ADJUST_OBJ + 1;
    const IA_SACRIFICE = IA_ADJUST_STACK + 1;
    const IA_BUY_OBJ = IA_SACRIFICE + 1;
    const IA_QUAFF_OBJ = IA_BUY_OBJ + 1;
    const IA_QUIVER_OBJ = IA_QUAFF_OBJ + 1;
    const IA_READ_OBJ = IA_QUIVER_OBJ + 1;
    const IA_RUB_OBJ = IA_READ_OBJ + 1;
    const IA_THROW_OBJ = IA_RUB_OBJ + 1;
    const IA_TAKEOFF_OBJ = IA_THROW_OBJ + 1;
    const IA_TIP_CONTAINER = IA_TAKEOFF_OBJ + 1;
    const IA_INVOKE_OBJ = IA_TIP_CONTAINER + 1;
    const IA_WIELD_OBJ = IA_INVOKE_OBJ + 1;
    const IA_WEAR_OBJ = IA_WIELD_OBJ + 1;
    const IA_SWAPWEAPON = IA_WEAR_OBJ + 1;
    const IA_TWOWEAPON = IA_SWAPWEAPON + 1;
    const IA_ZAP_OBJ = IA_TWOWEAPON + 1;
    const IA_WHATIS_OBJ = IA_ZAP_OBJ + 1;

/* construct text for the menu entries for IA_NAME_OBJ and IA_NAME_OTYP */
function item_naming_classification(
    obj,
    onamebuf,
    ocallbuf) { /* boolean */
    let Name = init_string(static_array("item_naming_classification.Name", char, sizeof_string("Name")), _("Name"), true),
        Rename = init_string(static_array("item_naming_classification.Rename", char, sizeof_string("Rename or un-name")), _("Rename or un-name"), true),
        Call = init_string(static_array("item_naming_classification.Call", char, sizeof_string("Call")), _("Call"), true),

        Recall = init_string(static_array("item_naming_classification.Recall", char, sizeof_string("Re-call or un-call")), _("Re-call or un-call"), true);

    chars[onamebuf + 0] = chars[ocallbuf + 0] = ord('\0');
    if (name_ok(obj) == GETOBJ_SUGGEST) {
        sprintf(onamebuf, _("%s %s %s"), (!has_oname(obj) || !chars[ONAME(obj)]) ? Name : Rename, the_unique_obj(obj) ? _("the")
                : !is_plural(obj) ? _("this specific")
                  : _("this stack of"), simpleonames(obj))

;
    }
    if (call_ok(obj) == GETOBJ_SUGGEST) {
        let callname = simpleonames(obj);

        /* prefix known unique item with "the", make all other types plural */
        if (the_unique_obj(obj)) /* treats unID'd fake amulets as if real */
            callname = the(callname);
        else if (!is_plural(obj))
            callname = makeplural(callname);
        sprintf(ocallbuf, _("%s the type for %s"), (!objects[obj.otyp].oc_uname
                 || !chars[objects[obj.otyp].oc_uname]) ? Call : Recall, callname)

;
    }
    return (chars[onamebuf] || chars[ocallbuf]) ? TRUE : FALSE;
}

/* construct text for the menu entries for IA_READ_OBJ */
function item_reading_classification(obj, outbuf) { /* int */
    let otyp = obj.otyp, res = IA_READ_OBJ;

    chars[outbuf] = ord('\0');
    if (otyp == FORTUNE_COOKIE) {
        strcpy(outbuf, _("Read the message inside this cookie"));
    } else if (otyp == T_SHIRT) {
        strcpy(outbuf, _("Read the slogan on the shirt"));
    } else if (otyp == ALCHEMY_SMOCK) {
        strcpy(outbuf, _("Read the slogan on the apron"));
    } else if (otyp == HAWAIIAN_SHIRT) {
        strcpy(outbuf, _("Look at the pattern on the shirt"));
    } else if (obj.oclass == SCROLL_CLASS) {
        let magic = ((obj.dknown

                              && otyp != SCR_MAIL

                              && (otyp != SCR_BLANK_PAPER
                                  || !objects[otyp].oc_name_known))
                             ? _(" to activate its magic") : _(""));

        sprintf(outbuf, _("Read this scroll%s"), magic);
    } else if (obj.oclass == SPBOOK_CLASS) {
        let novel = +(otyp == SPE_NOVEL),
                blank = (otyp == SPE_BLANK_PAPER
                         && objects[otyp].oc_name_known ? 1 : 0),
                tome = (otyp == SPE_BOOK_OF_THE_DEAD
                        && objects[otyp].oc_name_known ? 1 : 0);

        sprintf(outbuf, _("%s this %s"), (novel || blank) ? _("Read") : tome ? _("Examine") : _("Study"), novel ? simpleonames(obj) /* "novel" or "paperback book" */
                      : tome ? _("tome") : _("spellbook"))

;
    } else {
        res = IA_NONE;
    }
    return res;
}

function ia_addmenu(win, act, let_, txt) { /* void */
    const $frame = stack_frame(); try {
    let any = stack_struct(struct_any);
    let clr = NO_COLOR;

    struct_assign(any, cg.zeroany);
    any.a_int = act;
    add_menu(win, nul_glyphinfo, any, let_, 0,
             ATR_NONE, clr, txt, MENU_ITEMFLAGS_NONE);
    } finally { stack_pop($frame); }
}

/* set up a command to execute on a specific item next */
function itemactions_pushkeys(otmp, act) { /* void */
    switch (act) {
    default:
        impossible(_("Unknown item action %d"), act);
        break;
    case IA_NONE:
        break;
    case IA_UNWIELD:
        cmdq_add_ec(CQ_CANNED, (otmp == uwep) ? dowield
                    : (otmp == uswapwep) ? remarm_swapwep
                      : (otmp == uquiver) ? dowieldquiver
                        : donull); /* can't happen */
        cmdq_add_key(CQ_CANNED, HANDS_SYM);
        break;
    case IA_APPLY_OBJ:
        cmdq_add_ec(CQ_CANNED, doapply);
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_DIP_OBJ:
        /* #altdip instead of normal #dip - takes potion to dip into
           first (the inventory item instigating this) and item to
           be dipped second, also ignores floor features such as
           fountain/sink so we don't need to force m-prefix here */
        cmdq_add_ec(CQ_CANNED, dip_into);
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_NAME_OBJ:
    case IA_NAME_OTYP:
        cmdq_add_ec(CQ_CANNED, docallcmd);
        cmdq_add_key(CQ_CANNED, (act == IA_NAME_OBJ) ? ord('i') : ord('o'));
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_DROP_OBJ:
        cmdq_add_ec(CQ_CANNED, dodrop);
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_EAT_OBJ:
        /* start with m-prefix; for #eat, it means ignore floor food
           if present and eat food from invent */
        cmdq_add_ec(CQ_CANNED, do_reqmenu);
        cmdq_add_ec(CQ_CANNED, doeat);
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_ENGRAVE_OBJ:
        cmdq_add_ec(CQ_CANNED, doengrave);
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_FIRE_OBJ:
        cmdq_add_ec(CQ_CANNED, dofire);
        break;
    case IA_ADJUST_OBJ:
        cmdq_add_ec(CQ_CANNED, doorganize); /* #adjust */
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_ADJUST_STACK:
        cmdq_add_ec(CQ_CANNED, adjust_split); /* #altadjust */
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_SACRIFICE:
        cmdq_add_ec(CQ_CANNED, dosacrifice);
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_BUY_OBJ:
        cmdq_add_ec(CQ_CANNED, dopay);
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_QUAFF_OBJ:
        /* start with m-prefix; for #quaff, it means ignore fountain
           or sink if present and drink a potion from invent */
        cmdq_add_ec(CQ_CANNED, do_reqmenu);
        cmdq_add_ec(CQ_CANNED, dodrink);
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_QUIVER_OBJ:
        cmdq_add_ec(CQ_CANNED, dowieldquiver);
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_READ_OBJ:
        cmdq_add_ec(CQ_CANNED, doread);
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_RUB_OBJ:
        cmdq_add_ec(CQ_CANNED, dorub);
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_THROW_OBJ:
        cmdq_add_ec(CQ_CANNED, dothrow);
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_TAKEOFF_OBJ:
        cmdq_add_ec(CQ_CANNED, ia_dotakeoff); /* #altdotakeoff */
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_TIP_CONTAINER:
        /* start with m-prefix to skip floor containers;
           for menustyle:Traditional when more than one floor container
           is present, player will get a #tip menu and have to pick
           the "tip something being carried" choice, then this item
           will be already chosen from inventory; suboptimal but
           possibly an acceptable tradeoff since combining item actions
           with use of traditional ggetobj() is an unlikely scenario */
        cmdq_add_ec(CQ_CANNED, do_reqmenu);
        cmdq_add_ec(CQ_CANNED, dotip);
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_INVOKE_OBJ:
        cmdq_add_ec(CQ_CANNED, doinvoke);
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_WIELD_OBJ:
        cmdq_add_ec(CQ_CANNED, dowield);
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_WEAR_OBJ:
        cmdq_add_ec(CQ_CANNED, dowear);
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_SWAPWEAPON:
        cmdq_add_ec(CQ_CANNED, doswapweapon);
        break;
    case IA_TWOWEAPON:
        cmdq_add_ec(CQ_CANNED, dotwoweapon);
        break;
    case IA_ZAP_OBJ:
        cmdq_add_ec(CQ_CANNED, dozap);
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    case IA_WHATIS_OBJ:
        cmdq_add_ec(CQ_CANNED, dowhatis); /* "/" command */
        cmdq_add_key(CQ_CANNED, ord('i'));     /* "i" == item from inventory */
        cmdq_add_key(CQ_CANNED, otmp.invlet);
        break;
    }
}

/* Show menu of possible actions hero could do with item otmp */
export function itemactions(otmp) { /* int */
    const $frame = stack_frame(); try {
    let n, act = IA_NONE;
    let win;
    let buf = stack_array(char, BUFSZ), buf2 = stack_array(char, BUFSZ);
    let selected = stack_var(ptr_to(struct_mi));
    let mtmp;
    let light = otmp.lamplit ? _("Extinguish") : _("Light");
    let already_worn = +((otmp.owornmask & (W_ARMOR | W_ACCESSORY)) != 0);

    win = create_nhwindow()(NHW_MENU);
    start_menu()(win, MENU_BEHAVE_STANDARD);

    /* -: unwield; picking current weapon offers an opportunity for 'w-'
       to wield bare/gloved hands; likewise for 'Q-' with quivered item(s) */
    if (otmp == uwep || otmp == uswapwep || otmp == uquiver) {
        let verb = (otmp == uquiver) ? _("Quiver") : _("Wield"),
                   action = (otmp == uquiver) ? _("un-ready") : _("un-wield"),
                   which = is_plural(otmp) ? _("these") : _("this"),
                   what = ((otmp.oclass == WEAPON_CLASS || is_weptool(otmp))
                            ? _("weapon") : _("item"));
        /*
         * TODO: if uwep is ammo, tell player that to shoot instead of toss,
         *       the corresponding launcher must be wielded;
         */
        sprintf(buf, _("%s '%c' to %s %s %s"), verb, HANDS_SYM, action, which, is_plural(otmp) ? makeplural(what) : what)

;
        ia_addmenu(win, IA_UNWIELD, ord('-'), buf);
    }

    /* a: apply */
    if (otmp.oclass == COIN_CLASS)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Flip a coin"));
    else if (otmp.otyp == CREAM_PIE)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'),
                   _("Hit yourself with this cream pie"));
    else if (otmp.otyp == BULLWHIP)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Lash out with this whip"));
    else if (otmp.otyp == GRAPPLING_HOOK)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'),
                   _("Grapple something with this hook"));
    else if (otmp.otyp == BAG_OF_TRICKS && objects[otmp.otyp].oc_name_known)
        /* bag of tricks skips this unless discovered */
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Reach into this bag"));
    else if (Is_container(otmp))
        /* bag of tricks gets here only if not yet discovered */
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Open this container"));
    else if (otmp.otyp == CAN_OF_GREASE)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Use the can to grease an item"));
    else if (otmp.otyp == LOCK_PICK
             || otmp.otyp == CREDIT_CARD
             || otmp.otyp == SKELETON_KEY)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Use this tool to pick a lock"));
    else if (otmp.otyp == TINNING_KIT)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Use this kit to tin a corpse"));
    else if (otmp.otyp == LEASH)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Tie a pet to this leash"));
    else if (otmp.otyp == SADDLE)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Place this saddle on a pet"));
    else if (otmp.otyp == MAGIC_WHISTLE
             || otmp.otyp == TIN_WHISTLE)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Blow this whistle"));
    else if (otmp.otyp == EUCALYPTUS_LEAF)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Use this leaf as a whistle"));
    else if (otmp.otyp == STETHOSCOPE)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Listen through the stethoscope"));
    else if (otmp.otyp == MIRROR)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Show something its reflection"));
    else if (otmp.otyp == BELL || otmp.otyp == BELL_OF_OPENING)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Ring the bell"));
    else if (otmp.otyp == CANDELABRUM_OF_INVOCATION) {
        sprintf(buf, _("%s the candelabrum"), light);
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), buf);
    } else if (otmp.otyp == WAX_CANDLE || otmp.otyp == TALLOW_CANDLE) {
        let multiple = (otmp.quan == 1) ? FALSE : TRUE;
        let s = multiple ? _("these") : _("this");
        let o = carrying(CANDELABRUM_OF_INVOCATION);

        if (o && o.spe < 7)
            sprintf(buf, _("Attach %s to your candelabrum, or %s %s"), s, !otmp.lamplit ? _("light") : _("extinguish"), multiple ? _("them") : _("it"));
        else
            sprintf(buf, _("%s %s %s"), light, s, simpleonames(otmp))

;
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), buf);
    } else if (otmp.otyp == OIL_LAMP || otmp.otyp == MAGIC_LAMP
               || otmp.otyp == BRASS_LANTERN) {
        sprintf(buf, _("%s this light source"), light);
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), buf);
    } else if (otmp.otyp == POT_OIL && objects[otmp.otyp].oc_name_known) {
        sprintf(buf, _("%s this oil"), light);
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), buf);
    } else if (otmp.oclass == POTION_CLASS) {
        /* FIXME? this should probably be moved to 'D' rather than be 'a' */
        sprintf(buf, _("Dip something into %s potion%s"), is_plural(otmp) ? _("one of these") : _("this"), plur(otmp.quan))
;
        ia_addmenu(win, IA_DIP_OBJ, ord('a'), buf);
    } else if (otmp.otyp == EXPENSIVE_CAMERA)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Take a photograph"));
    else if (otmp.otyp == TOWEL)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'),
                   _("Clean yourself off with this towel"));
    else if (otmp.otyp == CRYSTAL_BALL)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Peer into this crystal ball"));
    else if (otmp.otyp == MAGIC_MARKER)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'),
                   _("Write on something with this marker"));
    else if (otmp.otyp == FIGURINE)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Make this figurine transform"));
    else if (otmp.otyp == UNICORN_HORN)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Use this unicorn horn"));
    else if (otmp.otyp == HORN_OF_PLENTY
             && objects[otmp.otyp].oc_name_known)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Blow into the horn of plenty"));
    else if (otmp.otyp >= WOODEN_FLUTE && otmp.otyp <= DRUM_OF_EARTHQUAKE)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Play this musical instrument"));
    else if (otmp.otyp == LAND_MINE || otmp.otyp == BEARTRAP)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Arm this trap"));
    else if (otmp.otyp == PICK_AXE || otmp.otyp == DWARVISH_MATTOCK)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Dig with this digging tool"));
    else if (otmp.oclass == WAND_CLASS)
        ia_addmenu(win, IA_APPLY_OBJ, ord('a'), _("Break this wand"));

    /* 'c', 'C' - call an item or its type something */
    if (item_naming_classification(otmp, buf, buf2)) {
        if (chars[buf])
            ia_addmenu(win, IA_NAME_OBJ, ord('c'), buf);
        if (chars[buf2])
            ia_addmenu(win, IA_NAME_OTYP, ord('C'), buf2);
    }

    /* d: drop item, works on everything except worn items; those will
       always have a takeoff/remove choice so we don't have to worry
       about the menu maybe being empty when 'd' is suppressed */
    if (!already_worn) {
        sprintf(buf, _("Drop this %s"), (otmp.quan > 1) ? _("stack") : _("item"));
        ia_addmenu(win, IA_DROP_OBJ, ord('d'), buf);
    }

    /* e: eat item */
    if (otmp.otyp == TIN) {
        sprintf(buf, _("Open %s%s and eat the contents"), (otmp.quan > 1) ? _("one of these tins") : _("this tin"), (otmp.otyp == TIN && uwep && uwep.otyp == TIN_OPENER)
                ? _(" with your tin opener") : _(""))

;
        ia_addmenu(win, IA_EAT_OBJ, ord('e'), buf);
    } else if (is_edible(otmp)) {
        sprintf(buf, _("Eat %s"), (otmp.quan > 1) ? _("one of these") : _("this"));
        ia_addmenu(win, IA_EAT_OBJ, ord('e'), buf);
    }

    /* E: engrave with item */
    if (otmp.otyp == TOWEL) {
        ia_addmenu(win, IA_ENGRAVE_OBJ, ord('E'),
                   _("Wipe the floor with this towel"));
    } else if (otmp.otyp == MAGIC_MARKER) {
        ia_addmenu(win, IA_ENGRAVE_OBJ, ord('E'),
                   _("Scribble graffiti on the floor"));
    } else if (otmp.oclass == WEAPON_CLASS || otmp.oclass == WAND_CLASS
             || otmp.oclass == GEM_CLASS || otmp.oclass == RING_CLASS) {
        sprintf(buf, _("%s on the %s with %s"), (is_blade(otmp) || otmp.oclass == WAND_CLASS
                 || ((otmp.oclass == GEM_CLASS || otmp.oclass == RING_CLASS)
                     && objects[otmp.otyp].oc_tough)) ? _("Engrave") : _("Write"), surface(u.ux, u.uy), (otmp.quan > 1) ? _("one of these items") : _("this item"))

;
        ia_addmenu(win, IA_ENGRAVE_OBJ, ord('E'), buf);
    }

    /* f: fire quivered ammo */
    if (otmp == uquiver) {
        let shoot = ammo_and_launcher(otmp, uwep);

        /* FIXME: see the multi-shot FIXME about "one of" for 't: throw' */
        sprintf(buf, _("%s %s"), shoot ? _("Shoot") : _("Throw"), (otmp.quan > 1) ? _("one of these") : _("this"))
;
        if (shoot) {
            assert(uwep != null);
            sprintf(eos(buf), _(" with your wielded %s"), simpleonames(uwep));
        }
        ia_addmenu(win, IA_FIRE_OBJ, ord('f'), buf);
    }

    /* i: #adjust inventory letter; gold can't be adjusted unless there
       is some in a slot other than '$' (which shouldn't be possible) */
    if (otmp.oclass != COIN_CLASS || check_invent_gold(_("item-action")))
        ia_addmenu(win, IA_ADJUST_OBJ, ord('i'),
                   _("Adjust inventory by assigning new letter"));
    /* I: #adjust inventory item by splitting its stack  */
    if (otmp.quan > 1 && otmp.oclass != COIN_CLASS)
        ia_addmenu(win, IA_ADJUST_STACK, ord('I'),
                   _("Adjust inventory by splitting this stack"));

    /* O: offer sacrifice */
    if (IS_ALTAR(levl()[u.ux][u.uy].typ) && !u.uswallow) {
        /* FIXME: this doesn't match #offer's likely candidates, which don't
           include corpses on Astral and don't include amulets off Astral */
        if (otmp.otyp == CORPSE)
            ia_addmenu(win, IA_SACRIFICE, ord('O'),
                       _("Offer this corpse as a sacrifice at this altar"));
        else if (otmp.otyp == AMULET_OF_YENDOR
                 || otmp.otyp == FAKE_AMULET_OF_YENDOR)
            ia_addmenu(win, IA_SACRIFICE, ord('O'),
                       _("Offer this amulet as a sacrifice at this altar"));
    }

    /* p: pay for unpaid utems */
    if (otmp.unpaid
        /* FIXME: should also handle player owned container (so not
           flagged 'unpaid') holding shop owned items */
        && (mtmp = shop_keeper(chars[in_rooms(u.ux, u.uy, SHOPBASE)])) != null
        && inhishop(mtmp)) {
        sprintf(buf, _("Buy this unpaid %s"), (otmp.quan > 1) ? _("stack") : _("item"))
;
        ia_addmenu(win, IA_BUY_OBJ, ord('p'), buf);
    }

    /* P: put on accessory */
    if (!already_worn) {
        /* if 'otmp' is worn, we'll skip 'P' and show 'R' below;
           if not worn, we show 'P - Put on this <simple-item>' if
           the slot is available, or 'P - <unavailable>'; for the latter,
           'P' will fail but we don't want to omit the choice because
           item actions can be used to learn commands */
        chars[buf] = ord('\0');
        if (otmp.oclass == AMULET_CLASS) {
            strcpy(buf, !uamul ? _("Put this amulet on")
                               : _("[already wearing an amulet]"));
        } else if (otmp.oclass == RING_CLASS || otmp.otyp == MEAT_RING) {
            if (!uleft || !uright)
                strcpy(buf, _("Put this ring on"));
            else
                sprintf(buf, _("[both ring %s in use]"), makeplural(body_part(FINGER)))
;
        } else if (otmp.otyp == BLINDFOLD || otmp.otyp == TOWEL
                   || otmp.otyp == LENSES) {
            if (ublindf)
                strcpy(buf, _("[already wearing eyewear]"));
            else if (otmp.otyp == LENSES)
                strcpy(buf, _("Put these lenses on"));
            else
                sprintf(buf, _("Put this on%s"), (otmp.otyp == TOWEL) ? _(" to blindfold yourself") : _(""))
;
        }
        if (chars[buf])
            ia_addmenu(win, IA_WEAR_OBJ, ord('P'), buf);
    }

    /* q: drink item */
    if (otmp.oclass == POTION_CLASS) {
        sprintf(buf, _("Quaff (drink) %s"), (otmp.quan > 1) ? _("one of these potions") : _("this potion"))
;
        ia_addmenu(win, IA_QUAFF_OBJ, ord('q'), buf);
    }

    /* Q: quiver throwable item */
    if ((otmp.oclass == GEM_CLASS || otmp.oclass == WEAPON_CLASS)
        && otmp != uquiver) {
        sprintf(buf, _("Quiver this %s for easy %s with \'f\'ire"), (otmp.quan > 1) ? _("stack") : _("item"), ammo_and_launcher(otmp, uwep) ? _("shooting") : _("throwing"))

;
        ia_addmenu(win, IA_QUIVER_OBJ, ord('Q'), buf);
    }

    /* r: read item */
    if (item_reading_classification(otmp, buf) == IA_READ_OBJ)
        ia_addmenu(win, IA_READ_OBJ, ord('r'), buf);

    /* R: remove accessory or rub item */
    if (otmp.owornmask & W_ACCESSORY) {
        sprintf(buf, _("Remove this %s"), (otmp.owornmask & W_AMUL) ? _("amulet")
                : (otmp.owornmask & W_RING) ? _("ring")
                  : (otmp.owornmask & W_TOOL) ? _("eyewear")
                    : _("accessory"))
; /* catchall -- can't happen */
        ia_addmenu(win, IA_TAKEOFF_OBJ, ord('R'), buf);
    }
    if (otmp.otyp == OIL_LAMP || otmp.otyp == MAGIC_LAMP
        || otmp.otyp == BRASS_LANTERN) {
        sprintf(buf, _("Rub this %s"), simpleonames(otmp));
        ia_addmenu(win, IA_RUB_OBJ, ord('R'), buf);
    } else if (otmp.oclass == GEM_CLASS && is_graystone(otmp))
        ia_addmenu(win, IA_RUB_OBJ, ord('R'), _("Rub something on this stone"));

    /* t: throw item */
    if (!already_worn) {
        let shoot = ammo_and_launcher(otmp, uwep);

        /*
         * FIXME:
         *  'one of these' should be changed to 'some of these' when there
         *  is the possibility of a multi-shot volley but we don't have
         *  any way to determine that except by actually calculating the
         *  volley count and that could randomly yield 1 here and 2..N
         *  while throwing or vice versa.
         */
        sprintf(buf, _("%s %s%s"), shoot ? _("Shoot") : _("Throw"), (otmp.quan == 1) ? _("this item")
                : (otmp.otyp == GOLD_PIECE) ? _("them")
                  : _("one of these"), (otmp == uquiver && (otmp.otyp != GOLD_PIECE
                                     || otmp.quan == 1))
                ? _(" (same as 'f')") : _(""))

;
        ia_addmenu(win, IA_THROW_OBJ, ord('t'), buf);
    }

    /* T: take off armor, tip carried container */
    if (otmp.owornmask & W_ARMOR)
        ia_addmenu(win, IA_TAKEOFF_OBJ, ord('T'), _("Take off this armor"));
    if ((Is_container(otmp) && (Has_contents(otmp) || !otmp.cknown))
        || (otmp.otyp == HORN_OF_PLENTY && (otmp.spe > 0 || !otmp.known)))
        ia_addmenu(win, IA_TIP_CONTAINER, ord('T'),
                   _("Tip all the contents out of this container"));

    /* V: invoke */
    if ((otmp.otyp == FAKE_AMULET_OF_YENDOR && !otmp.known)
        || otmp.oartifact || objects[otmp.otyp].oc_unique
        /* non-artifact crystal balls don't have any unique power but
           the #invoke command lists them as likely candidates */
        || otmp.otyp == CRYSTAL_BALL)
        ia_addmenu(win, IA_INVOKE_OBJ, ord('V'),
                   _("Try to invoke a unique power of this object"));

    /* w: wield, hold in hands, works on everything but with different
       advice text; not mentioned for things that are already wielded */
    if (otmp == uwep || cantwield(gy.youmonst.data)) {
        ; /* either already wielded or can't wield anything; skip 'w' */
    } else if (otmp.oclass == WEAPON_CLASS || is_weptool(otmp)
               || is_wet_towel(otmp) || otmp.otyp == HEAVY_IRON_BALL) {
        sprintf(buf, _("Wield this %s as your weapon"), (otmp.quan > 1) ? _("stack") : _("item"))
;
        ia_addmenu(win, IA_WIELD_OBJ, ord('w'), buf);
    } else if (otmp.otyp == TIN_OPENER) {
        ia_addmenu(win, IA_WIELD_OBJ, ord('w'),
                   _("Wield the tin opener to easily open tins"));
    } else if (!already_worn) {
        /* originally this was using "hold this item in your hands" but
           there's no concept of "holding an item", plus it unwields
           whatever item you already have wielded so use "wield this item" */
        sprintf(buf, _("Wield this %s in your %s"), (otmp.quan > 1) ? _("stack") : _("item"), makeplural(body_part(HAND)))

;
        ia_addmenu(win, IA_WIELD_OBJ, ord('w'), buf);
    }

    /* W: wear armor */
    if (!already_worn) {
        if (otmp.oclass == ARMOR_CLASS) {
            /* if 'otmp' is worn we skip 'W' (and show 'T' above instead);
               if it isn't, we either show "W - wear this" if otmp's slot
               isn't populated, or "W - [already wearing <simple-armor>]";
               for the latter, picking 'W' will fail but we don't want to
               omit 'W' in this situation */
            let Wmask = armcat_to_wornmask(objects[otmp.otyp].oc_subtyp);
            let o = wearmask_to_obj(Wmask);

            if (!o)
                strcpy(buf, _("Wear this armor"));
            else
                sprintf(buf, _("[already wearing %s]"), an(armor_simple_name(o)));

            ia_addmenu(win, IA_WEAR_OBJ, ord('W'), buf);
        }
    }

    /* x: Swap main and readied weapon */
    if (otmp == uwep && uswapwep)
        ia_addmenu(win, IA_SWAPWEAPON, ord('x'),
                   _("Swap this with your alternate weapon"));
    else if (otmp == uwep)
        ia_addmenu(win, IA_SWAPWEAPON, ord('x'),
                   _("Ready this as an alternate weapon"));
    else if (otmp == uswapwep)
        ia_addmenu(win, IA_SWAPWEAPON, ord('x'),
                   _("Swap this with your main weapon"));

    /* this is based on TWOWEAPOK() in wield.c; we don't call can_two_weapon()
       because it is very verbose; attempting to two-weapon might be rejected
       but we screen out most reasons for rejection before offering it as a
       choice */

    /* X: Toggle two-weapon mode on or off */
    if ((otmp == uwep || otmp == uswapwep)
        /* if already two-weaponing, no special checks needed to toggle off */
        && (u.twoweap
        /* but if not, try to filter most "you can't do that" here */
            || (could_twoweap(gy.youmonst.data) && !uarms
                && uwep && MAYBETWOWEAPON(uwep)
                && uswapwep && MAYBETWOWEAPON(uswapwep)))) {
        sprintf(buf, _("Toggle two-weapon combat %s"), u.twoweap ? _("off") : _("on"));
        ia_addmenu(win, IA_TWOWEAPON, ord('X'), buf);
    }

    /* z: Zap wand */
    if (otmp.oclass == WAND_CLASS)
        ia_addmenu(win, IA_ZAP_OBJ, ord('z'),
                   _("Zap this wand to release its magic"));

    /* ?: Look up an item in the game's database */
    if (ia_checkfile(otmp)) {
        sprintf(buf, _("Look up information about %s"), (otmp.quan > 1) ? _("these") : _("this"))
;
        ia_addmenu(win, IA_WHATIS_OBJ, ord('/'), buf);
    }

    sprintf(buf, _("Do what with %s?"), the(cxname(otmp)));
    end_menu()(win, buf);

    n = select_menu(win, PICK_ONE, selected);

    if (n > 0) {
        act = ptr_add(selected[0], 0).item.a_int;
        free(addr_of(selected[0]));

        itemactions_pushkeys(otmp, act);
    }
    destroy_nhwindow()(win);

    /* finish the 'i' command:  no time elapses and cancelling without
       selecting an action doesn't matter */
    return ECMD_OK;
    } finally { stack_pop($frame); }
}
export function MAYBETWOWEAPON(obj) { return (((obj.oclass == WEAPON_CLASS) ? !(is_launcher(obj) || is_ammo(obj) || is_missile(obj)) : is_weptool(obj)) && !bimanual(obj) ? 1 : 0); }

/*iactions.c*/

import { NO_COLOR } from "./color.h.js";
import {
    AMULET_CLASS, ARMOR_CLASS, COIN_CLASS, GEM_CLASS, POTION_CLASS, RING_CLASS, SCROLL_CLASS,
    SPBOOK_CLASS, WAND_CLASS, WEAPON_CLASS,
} from "./defsym.h.js";
import { BUFSZ, FALSE, TRUE } from "./global.h.js";
import { CQ_CANNED, ECMD_OK, FINGER, GETOBJ_SUGGEST, HAND, HANDS_SYM } from "./hack.h.js";
import { plur } from "./hack.h.macros.js";
import { SHOPBASE } from "./mkroom.h.js";
import { cantwield, could_twoweap } from "./mondata.h.macros.js";
import {
    Has_contents, Is_container, ONAME, ammo_and_launcher, bimanual, has_oname, is_ammo, is_blade,
    is_graystone, is_launcher, is_missile, is_plural, is_weptool, is_wet_towel,
} from "./obj.h.macros.js";
import {
    ALCHEMY_SMOCK, AMULET_OF_YENDOR, BAG_OF_TRICKS, BEARTRAP, BELL, BELL_OF_OPENING, BLINDFOLD,
    BRASS_LANTERN, BULLWHIP, CANDELABRUM_OF_INVOCATION, CAN_OF_GREASE, CORPSE, CREAM_PIE,
    CREDIT_CARD, CRYSTAL_BALL, DRUM_OF_EARTHQUAKE, DWARVISH_MATTOCK, EUCALYPTUS_LEAF,
    EXPENSIVE_CAMERA, FAKE_AMULET_OF_YENDOR, FIGURINE, FORTUNE_COOKIE, GOLD_PIECE, GRAPPLING_HOOK,
    HAWAIIAN_SHIRT, HEAVY_IRON_BALL, HORN_OF_PLENTY, LAND_MINE, LEASH, LENSES, LOCK_PICK,
    MAGIC_LAMP, MAGIC_MARKER, MAGIC_WHISTLE, MEAT_RING, MIRROR, OIL_LAMP, PICK_AXE, POT_OIL, SADDLE,
    SCR_BLANK_PAPER, SCR_MAIL, SKELETON_KEY, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_NOVEL,
    STETHOSCOPE, TALLOW_CANDLE, TIN, TINNING_KIT, TIN_OPENER, TIN_WHISTLE, TOWEL, T_SHIRT,
    UNICORN_HORN, WAX_CANDLE, WOODEN_FLUTE,
} from "./objects.h.js";
import { W_ACCESSORY, W_AMUL, W_ARMOR, W_RING, W_TOOL } from "./prop.h.js";
import { IS_ALTAR, levl } from "./rm.h.macros.js";
import { create_nhwindow, destroy_nhwindow, end_menu, start_menu } from "./winprocs.h.macros.js";
import {
    ATR_NONE, MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, NHW_MENU, PICK_ONE, struct_any, struct_mi,
} from "./wintype.h.js";
import { char, ord, sizeof_string } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { assert, free, sprintf, strcpy } from "../rt/libc.js";
import { init_string, stack_array, stack_struct, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, ptr_add, ptr_to, struct_assign } from "../rt/struct.js";
import { doapply, dorub } from "./apply.js";
import { doinvoke } from "./artifact.js";
import { cmdq_add_ec, cmdq_add_key, do_reqmenu } from "./cmd.js";
import { cg, gy, u } from "./decl.js";
import { nul_glyphinfo } from "./display.js";
import { dodrop, donull } from "./do.js";
import { call_ok, docallcmd, name_ok } from "./do_name.js";
import { dowear, ia_dotakeoff, remarm_swapwep } from "./do_wear.js";
import { dofire, dothrow } from "./dothrow.js";
import { surface } from "./dungeon.js";
import { doeat, is_edible } from "./eat.js";
import { doengrave } from "./engrave.js";
import { in_rooms } from "./hack.js";
import { eos } from "./hacklib.js";
import { adjust_split, carrying, check_invent_gold, doorganize } from "./invent.js";
import { objects } from "./objects.js";
import {
    an, armor_simple_name, cxname, makeplural, simpleonames, the, the_unique_obj,
} from "./objnam.js";
import { dowhatis, ia_checkfile } from "./pager.js";
import { dotip } from "./pickup.js";
import { impossible } from "./pline.js";
import { body_part } from "./polyself.js";
import { dip_into, dodrink } from "./potion.js";
import { dosacrifice } from "./pray.js";
import { doread } from "./read.js";
import { dopay, inhishop, shop_keeper } from "./shk.js";
import { doswapweapon, dotwoweapon, dowield, dowieldquiver } from "./wield.js";
import { add_menu, select_menu } from "./windows.js";
import { armcat_to_wornmask, wearmask_to_obj } from "./worn.js";
import { dozap } from "./zap.js";
