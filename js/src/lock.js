/* NetHack 5.0	lock.c	$NHDT-Date: 1741793439 2025/03/12 07:30:39 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.145 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2011. */
/* NetHack may be freely redistributed.  See license for details. */

/* occupation callbacks */

export function picking_lock(x, y) { /* boolean */
    if (go.occupation == picklock) {
        x[0] = u.ux + u.dx;
        y[0] = u.uy + u.dy;
        return TRUE;
    } else {
        x[0] = y[0] = 0;
        return FALSE;
    }
}

export function picking_at(x, y) { /* boolean */
    return (+(go.occupation == picklock
                      && gx.xlock.door == levl()[x][y]));
}

/* produce an occupation string appropriate for the current activity */
function lock_action() { /* const char * */
    /* "unlocking"+2 == "locking" */
    let actions = static_array("lock_action.actions", ptr_to(char), null, [
        _("unlocking the door"),   /* [0] */
        _("unlocking the chest"),  /* [1] */
        _("unlocking the box"),    /* [2] */
        _("picking the lock")      /* [3] */
    ]);

    /* if the target is currently unlocked, we're trying to lock it now */
    if (gx.xlock.door && !(gx.xlock.door.flags & D_LOCKED))
        return actions[0] + 2; /* "locking the door" */
    else if (gx.xlock.box && !gx.xlock.box.olocked)
        return gx.xlock.box.otyp == CHEST ? actions[1] + 2 : actions[2] + 2;
    /* otherwise we're trying to unlock it */
    else if (gx.xlock.picktyp == LOCK_PICK)
        return actions[3]; /* "picking the lock" */
    else if (gx.xlock.picktyp == CREDIT_CARD)
        return actions[3]; /* same as lock_pick */
    else if (gx.xlock.door)
        return actions[0]; /* "unlocking the door" */
    else if (gx.xlock.box)
        return gx.xlock.box.otyp == CHEST ? actions[1] : actions[2];
    else
        return actions[3];
}

/* try to open/close a lock */
function picklock() { /* int */
    if (gx.xlock.box) {
        if (gx.xlock.box.where != OBJ_FLOOR
            || gx.xlock.box.ox != u.ux || gx.xlock.box.oy != u.uy) {
            return (gx.xlock.usedtime = 0); /* you or it moved */
        }
    } else { /* door */
        if (gx.xlock.door != (levl()[u.ux + u.dx][u.uy + u.dy])) {
            return (gx.xlock.usedtime = 0); /* you moved */
        }
        switch (gx.xlock.door.flags) {
        case D_NODOOR:
            pline(_("This doorway has no door."));
            return (gx.xlock.usedtime = 0);
        case D_ISOPEN:
            You(_("cannot lock an open door."));
            return (gx.xlock.usedtime = 0);
        case D_BROKEN:
            pline(_("This door is broken."));
            return (gx.xlock.usedtime = 0);
        }
    }

    if (gx.xlock.usedtime++ >= 50 || nohands(gy.youmonst.data)) {
        You(_("give up your attempt at %s."), lock_action());
        exercise(A_DEX, TRUE); /* even if you don't succeed */
        return (gx.xlock.usedtime = 0);
    }

    if (rn2(100) >= gx.xlock.chance)
        return 1; /* still busy */

    /* using the Master Key of Thievery finds traps if its bless/curse
       state is adequate (non-cursed for rogues, blessed for others;
       checked when setting up 'xlock') */
    if ((!gx.xlock.door ? gx.xlock.box.otrapped
                       : (gx.xlock.door.flags & D_TRAPPED) != 0)
        && gx.xlock.magic_key) {
        gx.xlock.chance += 20; /* less effort needed next time */
        if (!gx.xlock.door) {
            if (!gx.xlock.box.tknown)
                You(_("find a trap!"));
            gx.xlock.box.tknown = 1;
        }
        if (y_n(_("Do you want to try to disarm it?")) == ord('y')) {
            let what;
            let alreadyunlocked;

            /* disarming while using magic key always succeeds */
            if (gx.xlock.door) {
                gx.xlock.door.flags &= ~D_TRAPPED;
                what = _("door");
                alreadyunlocked = +!(gx.xlock.door.flags & D_LOCKED);
            } else {
                gx.xlock.box.otrapped = 0;
                gx.xlock.box.tknown = 0;
                what = (gx.xlock.box.otyp == CHEST) ? _("chest") : _("box");
                alreadyunlocked = +!gx.xlock.box.olocked;
            }
            You(_("succeed in disarming the trap.  The %s is still %slocked."),
                what, alreadyunlocked ? _("un") : _(""));
            exercise(A_WIS, TRUE);
        } else {
            You(_("stop %s."), lock_action());
            exercise(A_WIS, FALSE);
        }
        return (gx.xlock.usedtime = 0);
    }

    You(_("succeed in %s."), lock_action());
    if (gx.xlock.door) {
        if (gx.xlock.door.flags & D_TRAPPED) {
            b_trapped(_("door"), FINGER);
            gx.xlock.door.flags = D_NODOOR;
            unblock_point(u.ux + u.dx, u.uy + u.dy);
            if (chars[in_rooms(u.ux + u.dx, u.uy + u.dy, SHOPBASE)])
                add_damage(u.ux + u.dx, u.uy + u.dy, SHOP_DOOR_COST);
            newsym(u.ux + u.dx, u.uy + u.dy);
        } else if (gx.xlock.door.flags & D_LOCKED)
            gx.xlock.door.flags = D_CLOSED;
        else
            gx.xlock.door.flags = D_LOCKED;
    } else {
        gx.xlock.box.olocked = +!gx.xlock.box.olocked;
        gx.xlock.box.lknown = 1;
        if (gx.xlock.box.otrapped)
            chest_trap(gx.xlock.box, FINGER, FALSE);
    }
    exercise(A_DEX, TRUE);
    return (gx.xlock.usedtime = 0);
}

export function breakchestlock(box, destroyit) { /* void */
    if (!destroyit) { /* bill for the box but not for its contents */
        let hide_contents = box.cobj;

        box.cobj = null;
        costly_alteration(box, COST_BRKLCK);
        box.cobj = hide_contents;
        box.olocked = 0;
        box.obroken = 1;
        box.lknown = 1;
    } else { /* #force has destroyed this box (at <u.ux,u.uy>) */
        let otmp;
        let shkp = (chars[u.ushops] && costly_spot(u.ux, u.uy))
                                 ? shop_keeper(chars[u.ushops])
                                 : null;
        let costly = (+(shkp != null)),
                peaceful_shk = (costly && shkp.mpeaceful ? 1 : 0);
        let loss = 0;

        pline(_("In fact, you've totally destroyed %s."), the(xname(box)));
        /* Put the contents on ground at the hero's feet. */
        while ((otmp = box.cobj) != null) {
            obj_extract_self(otmp);
            if (!rn2(3) || otmp.oclass == POTION_CLASS) {
                chest_shatter_msg(otmp);
                if (costly)
                    loss += stolen_value(otmp, u.ux, u.uy, peaceful_shk,
                                         TRUE);
                if (otmp.quan == 1) {
                    obfree(otmp, null);
                    continue;
                }
                /* this works because we're sure to have at least 1 left;
                   otherwise it would fail since otmp is not in inventory */
                useup(otmp);
            }
            if (box.otyp == ICE_BOX && otmp.otyp == CORPSE) {
                otmp.age = svm.moves - otmp.age; /* actual age */
                start_corpse_timeout(otmp);
            }
            place_object(otmp, u.ux, u.uy);
            stackobj(otmp);
        }
        if (costly)
            loss += stolen_value(box, u.ux, u.uy, peaceful_shk, TRUE);
        if (loss)
            You(_("owe %lld %s for objects destroyed."), loss, currency(loss));
        delobj(box);
    }
}

/* try to force a locked chest */
function forcelock() { /* int */
    if ((gx.xlock.box.ox != u.ux) || (gx.xlock.box.oy != u.uy))
        return (gx.xlock.usedtime = 0); /* you or it moved */

    if (gx.xlock.usedtime++ >= 50 || !uwep || nohands(gy.youmonst.data)) {
        You(_("give up your attempt to force the lock."));
        if (gx.xlock.usedtime >= 50) /* you made the effort */
            exercise(gx.xlock.picktyp ? A_DEX : A_STR, TRUE);
        return (gx.xlock.usedtime = 0);
    }

    if (gx.xlock.picktyp) { /* blade */
        if (rn2(1000 - uwep.spe) > (992 - greatest_erosion(uwep) * 10)
            && !uwep.cursed && !obj_resists(uwep, 0, 99)) {
            /* for a +0 weapon, probability that it survives an unsuccessful
             * attempt to force the lock is (.992)^50 = .67
             */
            pline(_("%sour %s broke!"), (uwep.quan > 1) ? _("One of y") : _("Y"),
                  xname(uwep));
            useup(uwep);
            You(_("give up your attempt to force the lock."));
            exercise(A_DEX, TRUE);
            return (gx.xlock.usedtime = 0);
        }
    } else             /* blunt */
        wake_nearby(FALSE); /* due to hammering on the container */

    if (rn2(100) >= gx.xlock.chance)
        return 1; /* still busy */

    You(_("succeed in forcing the lock."));
    exercise(gx.xlock.picktyp ? A_DEX : A_STR, TRUE);
    /* breakchestlock() might destroy xlock.box; if so, xlock context will
       be cleared (delobj -> obfree -> maybe_reset_pick); but it might not,
       so explicitly clear that manually */
    breakchestlock(gx.xlock.box, (+(!gx.xlock.picktyp && !rn2(3))));
    reset_pick(); /* lock-picking context is no longer valid */

    return 0;
}

export function reset_pick() { /* void */
    gx.xlock.usedtime = gx.xlock.chance = gx.xlock.picktyp = 0;
    gx.xlock.magic_key = FALSE;
    gx.xlock.door = null;
    gx.xlock.box = null;
}

/* level change or object deletion; context may no longer be valid */
export function maybe_reset_pick(container) { /* void */ /* passed from obfree() */
    /*
     * If a specific container, only clear context if it is for that
     * particular container (which is being deleted).  Other stuff on
     * the current dungeon level remains valid.
     * However if 'container' is Null, clear context if not carrying
     * gx.xlock.box (which might be Null if context is for a door).
     * Used for changing levels, where a floor container or a door is
     * being left behind and won't be valid on the new level but a
     * carried container will still be.  There might not be any context,
     * in which case redundantly clearing it is harmless.
     */
    if (container ? (container == gx.xlock.box)
                  : (!gx.xlock.box || !carried(gx.xlock.box)))
        reset_pick();
}

/* pick a tool for autounlock */
export function autokey(opening) { /* struct obj * */ /* True: key, pick, or card; False: key or pick */
    let o, key, pick, card, akey, apick, acard;

    /* mundane item or regular artifact or own role's quest artifact */
    key = pick = card = null;
    /* other role's quest artifact (Rogue's Key or Tourist's Credit Card) */
    akey = apick = acard = null;
    for (o = gi.invent; o; o = o.nobj) {
        if (any_quest_artifact(o) && !is_quest_artifact(o)) {
            switch (o.otyp) {
            case SKELETON_KEY:
                if (!akey)
                    akey = o;
                break;
            case LOCK_PICK:
                if (!apick)
                    apick = o;
                break;
            case CREDIT_CARD:
                if (!acard)
                    acard = o;
                break;
            default:
                break;
            }
        } else {
            switch (o.otyp) {
            case SKELETON_KEY:
                if (!key || is_magic_key(gy.youmonst, o))
                    key = o;
                break;
            case LOCK_PICK:
                if (!pick)
                    pick = o;
                break;
            case CREDIT_CARD:
                if (!card)
                    card = o;
                break;
            default:
                break;
            }
        }
    }
    if (!opening)
        card = acard = null;
    /* only resort to other role's quest artifact if no other choice */
    if (!key && !pick && !card)
        key = akey;
    if (!pick && !card)
        pick = apick;
    if (!card)
        card = acard;
    return key ? key : pick ? pick : card ? card : null;
}

/* for doapply(); if player gives a direction or resumes an interrupted
   previous attempt then it usually costs hero a move even if nothing
   ultimately happens; when told "can't do that" before being asked for
   direction or player cancels with ESC while giving direction, it doesn't */
export const PICKLOCK_LEARNED_SOMETHING = (-1);
export const PICKLOCK_DID_NOTHING = 0;
export const PICKLOCK_DID_SOMETHING = 1;

/* player is applying a key, lock pick, or credit card */
export function pick_lock(
    pick,
    rx, ry,

    container) { /* int */ /* container, for autounlock */
    const $frame = stack_frame(); try {
    let dummypick = stack_struct(struct_obj);
    let picktyp, c, ch;
    let cc = stack_struct(struct_nhcoord);
    let door;
    let otmp;
    let qbuf = stack_array(char, QBUFSZ);
    let autounlock = +(rx != 0 || container != null);

    /* 'pick' might be Null [called by do_loot_cont() for AUTOUNLOCK_UNTRAP] */
    if (!pick) {
        struct_assign(dummypick, cg.zeroobj);
        pick = dummypick; /* pick->otyp will be STRANGE_OBJECT */
    }
    picktyp = pick.otyp;

    /* check whether we're resuming an interrupted previous attempt */
    if (gx.xlock.usedtime && picktyp == gx.xlock.picktyp) {
        let no_longer = init_string(static_array("pick_lock.no_longer", char, sizeof_string("Unfortunately, you can no longer %s %s.")), _("Unfortunately, you can no longer %s %s."), true);

        if (nohands(gy.youmonst.data)) {
            let what = (picktyp == LOCK_PICK) ? _("pick") : _("key");

            if (picktyp == CREDIT_CARD)
                what = _("card");
            pline(no_longer, _("hold the"), what);
            reset_pick();
            return PICKLOCK_LEARNED_SOMETHING;
        } else if (u.uswallow || (gx.xlock.box && !can_reach_floor(TRUE))) {
            pline(no_longer, _("reach the"), _("lock"));
            reset_pick();
            return PICKLOCK_LEARNED_SOMETHING;
        } else {
            let action = lock_action();

            You(_("resume your attempt at %s."), action);
            gx.xlock.magic_key = is_magic_key(gy.youmonst, pick);
            set_occupation(picklock, action, 0);
            return PICKLOCK_DID_SOMETHING;
        }
    }

    if (nohands(gy.youmonst.data)) {
        You_cant(_("hold %s -- you have no hands!"), doname(pick));
        return PICKLOCK_DID_NOTHING;
    } else if (u.uswallow) {
        You_cant(_("%sunlock %s."), (picktyp == CREDIT_CARD) ? _("") : _("lock or "),
                 mon_nam(u.ustuck));
        return PICKLOCK_DID_NOTHING;
    }

    if (pick != dummypick && picktyp != SKELETON_KEY
        && picktyp != LOCK_PICK && picktyp != CREDIT_CARD) {
        impossible(_("picking lock with object %d?"), picktyp);
        return PICKLOCK_DID_NOTHING;
    }
    ch = 0; /* lint suppression */

    if (rx != 0) { /* autounlock; caller has provided coordinates */
        cc.x = rx;
        cc.y = ry;
    } else if (!get_adjacent_loc(0, _("Invalid location!"),
                                 u.ux, u.uy, cc)) {
        return PICKLOCK_DID_NOTHING;
    }

    if (u_at(cc.x, cc.y)) { /* pick lock on a container */
        let verb;
        let qsfx = stack_array(char, QBUFSZ);
        let it;
        let count;

        if (u.dz < 0 && !autounlock) { /* beware stale u.dz value */
            There(_("isn't any sort of lock up %s."),
                  Levitation() ? _("here") : _("there"));
            return PICKLOCK_LEARNED_SOMETHING;
        } else if (is_lava(u.ux, u.uy)) {
            pline(_("Doing that would probably melt %s."), yname(pick));
            return PICKLOCK_LEARNED_SOMETHING;
        } else if (is_pool(u.ux, u.uy) && !Underwater()) {
            pline_The(_("%s has no lock."), hliquid(_("water")));
            return PICKLOCK_LEARNED_SOMETHING;
        }

        count = 0;
        c = ord('n'); /* in case there are no boxes here */
        for (otmp = svl.level.objects[cc.x][cc.y]; otmp;
             otmp = otmp.v.v_nexthere) {
            /* autounlock on boxes: only the one that was just discovered to
               be locked; don't include any other boxes which might be here */
            if (autounlock && otmp != container)
                continue;
            if (Is_box(otmp)) {
                ++count;
                if (!can_reach_floor(TRUE)) {
                    You_cant(_("reach %s from up here."), the(xname(otmp)));
                    return PICKLOCK_LEARNED_SOMETHING;
                }
                it = 0;
                if (otmp.obroken)
                    verb = _("fix");
                else if (!otmp.olocked)
                    verb = _("lock"), it = 1;
                else if (picktyp != LOCK_PICK)
                    verb = _("unlock"), it = 1;
                else
                    verb = _("pick");

                if (autounlock && (flags.autounlock & AUTOUNLOCK_UNTRAP) != 0
                    && could_untrap(FALSE, TRUE)
                    && (c = otmp.tknown ? (otmp.otrapped ? ord('y') : ord('n'))
                            : yn_function(safe_qbuf(qbuf, _("Check "), _(" for a trap?"),
                                          otmp, yname, ysimple_name, _("this")), ynqchars, ord("q"), TRUE))
                       != ord('n')) {
                    if (c == ord('q'))
                        return PICKLOCK_DID_NOTHING; /* c == 'q' */
                    /* c == 'y' */
                    untrap(FALSE, 0, 0, otmp);
                    return PICKLOCK_DID_SOMETHING; /* even if no trap found */
                } else if (autounlock
                          && (flags.autounlock & AUTOUNLOCK_APPLY_KEY) != 0) {
                    c = ord('q');
                    if (pick != dummypick) {
                        sprintf(qbuf, _("Unlock it with %s?"), yname(pick));
                        c = ynq(qbuf);
                    }
                    if (c != ord('y'))
                        return PICKLOCK_DID_NOTHING;
                } else {
                    /* "There is <a box> here; <verb> <it|its lock>?" */
                    sprintf(qsfx, _(" here; %s %s?"), verb, it ? _("it") : _("its lock"))
;
                    safe_qbuf(qbuf, _("There is "), qsfx, otmp, doname,
                                     ansimpleoname, _("a box"));
                    otmp.lknown = 1;

                    c = ynq(qbuf);
                    if (c == ord('q'))
                        return PICKLOCK_DID_NOTHING;
                    if (c == ord('n'))
                        continue; /* try next box */
                }

                if (otmp.obroken) {
                    You_cant(_("fix its broken lock with %s."),
                             ansimpleoname(pick));
                    return PICKLOCK_LEARNED_SOMETHING;
                } else if (picktyp == CREDIT_CARD && !otmp.olocked) {
                    /* credit cards are only good for unlocking */
                    You_cant(_("do that with %s."),
                             an(simple_typename(picktyp)));
                    return PICKLOCK_LEARNED_SOMETHING;
                } else if (autounlock
                           && !touch_artifact(pick, gy.youmonst)) {
                    /* note: for !autounlock, apply already did touch check */
                    return PICKLOCK_DID_SOMETHING;
                }
                switch (picktyp) {
                case CREDIT_CARD:
                    ch = ACURR(A_DEX) + 20 * Role_if(PM_ROGUE);
                    break;
                case LOCK_PICK:
                    ch = 4 * ACURR(A_DEX) + 25 * Role_if(PM_ROGUE);
                    break;
                case SKELETON_KEY:
                    ch = 75 + ACURR(A_DEX);
                    break;
                default:
                    ch = 0;
                }
                if (otmp.cursed)
                    ch = Math.trunc(ch / 2);

                gx.xlock.box = otmp;
                gx.xlock.door = null;
                break;
            }
        }
        if (c != ord('y')) {
            if (!count)
                There(_("doesn't seem to be any sort of lock here."));
            return PICKLOCK_LEARNED_SOMETHING; /* decided against all boxes */
        }

    /* not the hero's location; pick the lock in an adjacent door */
    } else {
        let mtmp;

        if (u.utrap && u.utraptype == TT_PIT) {
            You_cant(_("reach over the edge of the pit."));
            /* this used to return PICKLOCK_LEARNED_SOMETHING but the
               #open command doesn't use a turn for similar situation */
            return PICKLOCK_DID_NOTHING;
        }

        door = levl()[cc.x][cc.y];
        mtmp = m_at(cc.x, cc.y);
        if (mtmp && canseemon(mtmp) && M_AP_TYPE(mtmp) != M_AP_FURNITURE
            && M_AP_TYPE(mtmp) != M_AP_OBJECT) {
            if (picktyp == CREDIT_CARD
                && (mtmp.isshk || mtmp.data == mons[PM_ORACLE])) {
                   ;
                verbalize(_("No checks, no credit, no problem."));
            } else {
                pline(_("I don't think %s would appreciate that."),
                      mon_nam(mtmp));
            }
            return PICKLOCK_LEARNED_SOMETHING;
        } else if (mtmp && is_door_mappear(mtmp)) {
            /* "The door actually was a <mimic>!" */
            stumble_onto_mimic(mtmp);
            /* mimic might keep the key (50% chance, 10% for PYEC or MKoT) */
            maybe_absorb_item(mtmp, pick, 50, 10);
            return PICKLOCK_LEARNED_SOMETHING;
        }
        if (!IS_DOOR(door.typ)) {
            let res = PICKLOCK_DID_NOTHING, oldglyph = door.glyph;
            let oldlastseentyp = update_mapseen_for(cc.x, cc.y);

            /* this is probably only relevant when blind */
            feel_location(cc.x, cc.y);
            if (door.glyph != oldglyph
                || chars[svl.lastseentyp[cc.x] + cc.y] != oldlastseentyp)
                res = PICKLOCK_LEARNED_SOMETHING;

            if (is_drawbridge_wall(cc.x, cc.y) >= 0)
                You(_("%s no lock on the drawbridge."), Blind() ? _("feel") : _("see"));
            else
                You(_("%s no door there."), Blind() ? _("feel") : _("see"));
            return res;
        }
        switch (door.flags) {
        case D_NODOOR:
            pline(_("This doorway has no door."));
            return PICKLOCK_LEARNED_SOMETHING;
        case D_ISOPEN:
            You(_("cannot lock an open door."));
            return PICKLOCK_LEARNED_SOMETHING;
        case D_BROKEN:
            pline(_("This door is broken."));
            return PICKLOCK_LEARNED_SOMETHING;
        default:
            if ((flags.autounlock & AUTOUNLOCK_UNTRAP) != 0
                && could_untrap(FALSE, FALSE)
                && (c = ynq(_("Check this door for a trap?"))) != ord('n')) {
                if (c == ord('q'))
                    return PICKLOCK_DID_NOTHING;
                /* c == 'y' */
                untrap(FALSE, cc.x, cc.y, null);
                return PICKLOCK_DID_SOMETHING; /* even if no trap found */
            }
            /* credit cards are only good for unlocking */
            if (picktyp == CREDIT_CARD && !(door.flags & D_LOCKED)) {
                You_cant(_("lock a door with a credit card."));
                return PICKLOCK_LEARNED_SOMETHING;
            }

            sprintf(qbuf, _("%s it%s%s?"), (door.flags & D_LOCKED) ? _("Unlock") : _("Lock"), autounlock ? _(" with ") : _(""), autounlock ? yname(pick) : _(""))

;
            c = ynq(qbuf);
            if (c != ord('y'))
                return PICKLOCK_DID_NOTHING;

            /* note: for !autounlock, 'apply' already did touch check */
            if (autounlock && !touch_artifact(pick, gy.youmonst))
                return PICKLOCK_DID_SOMETHING;

            switch (picktyp) {
            case CREDIT_CARD:
                ch = 2 * ACURR(A_DEX) + 20 * Role_if(PM_ROGUE);
                break;
            case LOCK_PICK:
                ch = 3 * ACURR(A_DEX) + 30 * Role_if(PM_ROGUE);
                break;
            case SKELETON_KEY:
                ch = 70 + ACURR(A_DEX);
                break;
            default:
                ch = 0;
            }
            gx.xlock.door = door;
            gx.xlock.box = null;
        }
    }
    svc.context.move = 0;
    gx.xlock.chance = ch;
    gx.xlock.picktyp = picktyp;
    gx.xlock.magic_key = is_magic_key(gy.youmonst, pick);
    gx.xlock.usedtime = 0;
    set_occupation(picklock, lock_action(), 0);
    return PICKLOCK_DID_SOMETHING;
    } finally { stack_pop($frame); }
}

/* is hero wielding a weapon that can #force? */
export function u_have_forceable_weapon() { /* boolean */
    if (!uwep /* proper type test */
        || ((uwep.oclass == WEAPON_CLASS || is_weptool(uwep))
            ? (objects[uwep.otyp].oc_subtyp < P_DAGGER
               || objects[uwep.otyp].oc_subtyp == P_FLAIL
               || objects[uwep.otyp].oc_subtyp > P_LANCE)
            : uwep.oclass != ROCK_CLASS))
        return FALSE;
    return TRUE;
}

/* the #force command - try to force a chest with your weapon */
export function doforce() { /* int */
    const $frame = stack_frame(); try {
    let otmp;
    let c, picktyp;
    let qbuf = stack_array(char, QBUFSZ);

    /*
     * TODO?
     *  allow force with edged weapon to be performed on doors.
     */

    if (u.uswallow) {
        You_cant(_("force anything from inside here."));
        return ECMD_OK;
    }
    if (!u_have_forceable_weapon()) {
        let use_plural = (uwep && uwep.quan > 1 ? 1 : 0);

        You_cant(_("force anything %s weapon%s."),
                 !uwep ? _("when not wielding a")
                 : (uwep.oclass != WEAPON_CLASS && !is_weptool(uwep))
                   ? (use_plural ? _("without proper") : _("without a proper"))
                   : (use_plural ? _("with those") : _("with that")),
                 use_plural ? _("s") : _(""));
        return ECMD_OK;
    }
    if (!can_reach_floor(TRUE)) {
        cant_reach_floor(u.ux, u.uy, FALSE, TRUE, FALSE);
        return ECMD_OK;
    }

    picktyp = +(is_blade(uwep) && !is_pick(uwep));
    if (gx.xlock.usedtime && gx.xlock.box && picktyp == gx.xlock.picktyp) {
        You(_("resume your attempt to force the lock."));
        set_occupation(forcelock, _("forcing the lock"), 0);
        return ECMD_TIME;
    }

    /* A lock is made only for the honest man, the thief will break it. */
    gx.xlock.box = null;
    for (otmp = svl.level.objects[u.ux][u.uy]; otmp; otmp = otmp.v.v_nexthere)
        if (Is_box(otmp)) {
            if (otmp.obroken || !otmp.olocked) {
                /* force doname() to omit known "broken" or "unlocked"
                   prefix so that the message isn't worded redundantly;
                   since we're about to set lknown, there's no need to
                   remember and then reset its current value */
                otmp.lknown = 0;
                There(_("is %s here, but its lock is already %s."),
                      doname(otmp), otmp.obroken ? _("broken") : _("unlocked"));
                otmp.lknown = 1;
                continue;
            }
            safe_qbuf(qbuf, _("There is "), _(" here; force its lock?"),
                             otmp, doname, ansimpleoname, _("a box"));
            otmp.lknown = 1;

            c = ynq(qbuf);
            if (c == ord('q'))
                return ECMD_OK;
            if (c == ord('n'))
                continue;

            if (picktyp)
                You(_("force %s into a crack and pry."), yname(uwep));
            else
                You(_("start bashing it with %s."), yname(uwep));
            gx.xlock.box = otmp;
            gx.xlock.chance = objects[uwep.otyp].oc_wldam * 2;
            gx.xlock.picktyp = picktyp;
            gx.xlock.magic_key = FALSE;
            gx.xlock.usedtime = 0;
            break;
        }

    if (gx.xlock.box)
        set_occupation(forcelock, _("forcing the lock"), 0);
    else
        You(_("decide not to force the issue."));
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

export function stumble_on_door_mimic(x, y) { /* boolean */
    let mtmp;

    if ((mtmp = m_at(x, y)) && is_door_mappear(mtmp)
        && !Protection_from_shape_changers()) {
        stumble_onto_mimic(mtmp);
        return TRUE;
    }
    return FALSE;
}

/* the #open command - try to open a door */
export function doopen() { /* int */
    return doopen_indir(0, 0);
}

/* try to open a door in direction u.dx/u.dy */
export function doopen_indir(x, y) { /* int */
    const $frame = stack_frame(); try {
    let cc = stack_struct(struct_nhcoord);
    let door;
    let portcullis;
    let dirprompt;
    let res = ECMD_OK;

    if (nohands(gy.youmonst.data)) {
        You_cant(_("open anything -- you have no hands!"));
        return ECMD_OK;
    }

    dirprompt = 0; /* have get_adjacent_loc() -> getdir() use default */
    if (u.utrap && u.utraptype == TT_PIT && container_at(u.ux, u.uy, FALSE))
        dirprompt = _("Open where? [.>]");

    if (x > 0 && y >= 0) {
        /* nonzero <x,y> is used when hero in amorphous form tries to
           flow under a closed door at <x,y>; the test here was using
           'y > 0' but that would give incorrect results if doors are
           ever allowed to be placed on the top row of the map */
        cc.x = x;
        cc.y = y;
    } else if (!get_adjacent_loc(dirprompt, 0, u.ux, u.uy, cc)) {
        return ECMD_OK;
    }

    /* open at yourself/up/down: switch to loot unless there is a closed
       door here (possible with Passes_walls) and direction isn't 'down' */
    if (u_at(cc.x, cc.y) && (u.dz > 0 || !closed_door(u.ux, u.uy)))
        return doloot();

    /* this used to be done prior to get_adjacent_loc() but doing so was
       incorrect once open at hero's spot became an alternate way to loot */
    if (u.utrap && u.utraptype == TT_PIT) {
        You_cant(_("reach over the edge of the pit."));
        return ECMD_OK;
    }

    if (stumble_on_door_mimic(cc.x, cc.y))
        return ECMD_TIME;

    /* when choosing a direction is impaired, use a turn
       regardless of whether a door is successfully targeted */
    if (Confusion() || Stunned())
        res = ECMD_TIME;

    door = levl()[cc.x][cc.y];
    portcullis = +(is_drawbridge_wall(cc.x, cc.y) >= 0);
    /* this used to be 'if (Blind)' but using a key skips that so we do too */
    {
        let oldglyph = door.glyph;
        let oldlastseentyp = update_mapseen_for(cc.x, cc.y);

        newsym(cc.x, cc.y);
        if (door.glyph != oldglyph
            || chars[svl.lastseentyp[cc.x] + cc.y] != oldlastseentyp)
            res = ECMD_TIME; /* learned something */
    }

    if (portcullis || !IS_DOOR(door.typ)) {
        /* closed portcullis or spot that opened bridge would span */
        if (is_db_wall(cc.x, cc.y) || door.typ == DRAWBRIDGE_UP)
            There(_("is no obvious way to open the drawbridge."));
        else if (portcullis || door.typ == DRAWBRIDGE_DOWN)
            pline_The(_("drawbridge is already open."));
        else if (container_at(cc.x, cc.y, TRUE))
            pline(_("%s like something lootable over there."),
                  Blind() ? _("Feels") : _("Seems"));
        else
            You(_("%s no door there."), Blind() ? _("feel") : _("see"));
        return res;
    }

    if (!(door.flags & D_CLOSED)) {
        let mesg;
        let locked = FALSE;

        switch (door.flags) {
        case D_BROKEN:
            mesg = _(" is broken");
            break;
        case D_NODOOR:
            mesg = _("way has no door");
            break;
        case D_ISOPEN:
            mesg = _(" is already open");
            break;
        default:
            mesg = _(" is locked");
            locked = TRUE;
            break;
        }
        set_msg_xy(cc.x, cc.y);
        pline(_("This door%s."), mesg);
        if (locked && flags.autounlock) {
            let unlocktool;

            u.dz = 0; /* should already be 0 since hero moved toward door */
            if ((flags.autounlock & AUTOUNLOCK_APPLY_KEY) != 0
                && (unlocktool = autokey(TRUE)) != null) {
                res = pick_lock(unlocktool, cc.x, cc.y,
                                null) ? ECMD_TIME : ECMD_OK;
            } else if ((flags.autounlock & AUTOUNLOCK_KICK) != 0
                       && !u.usteed /* kicking is different when mounted */
                       && ynq(_("Kick it?")) == ord('y')) {
                cmdq_add_ec(CQ_CANNED, dokick);
                cmdq_add_dir(CQ_CANNED,
                             sgn(cc.x - u.ux), sgn(cc.y - u.uy), 0);
                /* this was 'ECMD_TIME', but time shouldn't elapse until
                   the canned kick takes place */
                res = ECMD_OK;
            }
        }
        return res;
    }

    if (verysmall(gy.youmonst.data)) {
        pline(_("You're too small to pull the door open."));
        return res;
    }

    /* door is known to be CLOSED */
    if (rnl(20) < Math.trunc((ACURRSTR() + ACURR(A_DEX) + ACURR(A_CON)) / 3)) {
        set_msg_xy(cc.x, cc.y);
        pline_The(_("door opens."));
        if (door.flags & D_TRAPPED) {
            b_trapped(_("door"), FINGER);
            door.flags = D_NODOOR;
            if (chars[in_rooms(cc.x, cc.y, SHOPBASE)])
                add_damage(cc.x, cc.y, SHOP_DOOR_COST);
        } else
            door.flags = D_ISOPEN;
        feel_newsym(cc.x, cc.y); /* the hero knows she opened it */
        recalc_block_point(cc.x, cc.y); /* vision: new see through there */
    } else {
        exercise(A_STR, TRUE);
        set_msg_xy(cc.x, cc.y);
        pline_The(_("door resists!"));
    }

    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

function obstructed(x, y, quietly) { /* boolean */
    let $goto = null;
    var mtmp = m_at(x, y);

    $goto_objhere: for (;;) { switch ($goto) { default: if (mtmp && M_AP_TYPE(mtmp) != M_AP_FURNITURE) {
        if (M_AP_TYPE(mtmp) == M_AP_OBJECT)
            { $goto = "objhere"; continue $goto_objhere; };
        if (!quietly) {
            var Mn = Some_Monnam(mtmp); /* Monnam, Someone or Something */

            if ((mtmp.mx != x || mtmp.my != y) && canspotmon(mtmp))
                /* s_suffix() returns a modifiable buffer */
                Mn = strcat(s_suffix(Mn), _(" tail"));

            pline(_("%s blocks the way!"), Mn);
        }
        if (!canspotmon(mtmp))
            map_invisible(x, y);
        return TRUE;
    }
    case "objhere": if ($goto || (OBJ_AT(x, y))) {
 $goto = null;
        if (!quietly)
            pline(_("%s's in the way."), Something());
        return TRUE;
    } } break; }
    return FALSE;
}

/* the #close command - try to close a door */
export function doclose() { /* int */
    let $goto = null;
    var x, y;
    var door;
    var portcullis;
    var res = ECMD_OK;

    if (nohands(gy.youmonst.data)) {
        You_cant(_("close anything -- you have no hands!"));
        return ECMD_OK;
    }

    if (u.utrap && u.utraptype == TT_PIT) {
        You_cant(_("reach over the edge of the pit."));
        return ECMD_OK;
    }

    if (!getdir(0))
        return ECMD_CANCEL;

    x = u.ux + u.dx;
    y = u.uy + u.dy;
    if (u_at(x, y) && !Passes_walls()) {
        You(_("are in the way!"));
        return ECMD_TIME;
    }

    $goto_nodoor: for (;;) { switch ($goto) { default: if (!isok(x, y))
        { $goto = "nodoor"; continue $goto_nodoor; };

    if (stumble_on_door_mimic(x, y))
        return ECMD_TIME;

    /* when choosing a direction is impaired, use a turn
       regardless of whether a door is successfully targeted */
    if (Confusion() || Stunned())
        res = ECMD_TIME;

    door = levl()[x][y];
    portcullis = +(is_drawbridge_wall(x, y) >= 0);
    if (Blind()) {
        var oldglyph = door.glyph;
        var oldlastseentyp = update_mapseen_for(x, y);

        feel_location(x, y);
        if (door.glyph != oldglyph
            || chars[svl.lastseentyp[x] + y] != oldlastseentyp)
            res = ECMD_TIME; /* learned something */
    }

    case "nodoor": if ($goto || (portcullis || !IS_DOOR(door.typ))) {
        /* is_db_wall: closed portcullis */
        if (!$goto && (is_db_wall(x, y) || door.typ == DRAWBRIDGE_UP))
            pline_The(_("drawbridge is already closed."));
        else if (!$goto && (portcullis || door.typ == DRAWBRIDGE_DOWN))
            There(_("is no obvious way to close the drawbridge."));
        else {
 $goto = null;
            You(_("%s no door there."), Blind() ? _("feel") : _("see"));
        }
        return res;
    } } break; }

    if (door.flags == D_NODOOR) {
        pline(_("This doorway has no door."));
        return res;
    } else if (obstructed(x, y, FALSE)) {
        return res;
    } else if (door.flags == D_BROKEN) {
        pline(_("This door is broken."));
        return res;
    } else if (door.flags & (D_CLOSED | D_LOCKED)) {
        pline(_("This door is already closed."));
        return res;
    }

    if (door.flags == D_ISOPEN) {
        if (verysmall(gy.youmonst.data) && !u.usteed) {
            pline(_("You're too small to push the door closed."));
            return res;
        }
        if (u.usteed
            || rn2(25) < Math.trunc((ACURRSTR() + ACURR(A_DEX) + ACURR(A_CON)) / 3)) {
            pline_The(_("door closes."));
            door.flags = D_CLOSED;
            feel_newsym(x, y); /* the hero knows she closed it */
            block_point(x, y); /* vision:  no longer see there */
        } else {
            exercise(A_STR, TRUE);
            pline_The(_("door resists!"));
        }
    }

    return ECMD_TIME;
}

/* box obj was hit with spell or wand effect otmp;
   returns true if something happened */
export function boxlock(obj, otmp) { /* boolean */ /* obj *is* a box */
    let res = 0;

    switch (otmp.otyp) {
    case WAN_LOCKING:
    case SPE_WIZARD_LOCK:
        if (!obj.olocked) { /* lock it; fix if broken */
             ;
            pline(_("Klunk!"));
            obj.olocked = 1;
            obj.obroken = 0;
            if (Role_if(PM_WIZARD))
                obj.lknown = 1;
            else
                obj.lknown = 0;
            res = 1;
        } /* else already closed and locked */
        break;
    case WAN_OPENING:
    case SPE_KNOCK:
        if (obj.olocked) { /* unlock; isn't broken so doesn't need fixing */
             ;
            pline(_("Klick!"));
            obj.olocked = 0;
            res = 1;
            if (Role_if(PM_WIZARD))
                obj.lknown = 1;
            else
                obj.lknown = 0;
        } else /* silently fix if broken */
            obj.obroken = 0;
        break;
    case WAN_POLYMORPH:
    case SPE_POLYMORPH:
        /* maybe start unlocking chest, get interrupted, then zap it;
           we must avoid any attempt to resume unlocking it */
        if (gx.xlock.box == obj)
            reset_pick();
        break;
    }
    return res;
}

/* Door/secret door was hit with spell or wand effect otmp;
   returns true if something happened */
export function doorlock(otmp, x, y) { /* boolean */
    let door = levl()[x][y];
    let res = TRUE;
    let loudness = 0;
    let msg = 0;
    let dustcloud = _("A cloud of dust");
    let quickly_dissipates = _("quickly dissipates");
    let mysterywand = +(otmp.oclass == WAND_CLASS && !otmp.dknown);

    if (door.typ == SDOOR) {
        switch (otmp.otyp) {
        case WAN_OPENING:
        case SPE_KNOCK:
        case WAN_STRIKING:
        case SPE_FORCE_BOLT:
            door.typ = DOOR;
            door.flags = D_CLOSED | (door.flags & D_TRAPPED);
            newsym(x, y);
            if (cansee(x, y))
                pline(_("A door appears in the wall!"));
            if (otmp.otyp == WAN_OPENING || otmp.otyp == SPE_KNOCK)
                return TRUE;
            break; /* striking: continue door handling below */
        case WAN_LOCKING:
        case SPE_WIZARD_LOCK:
        default:
            return FALSE;
        }
    }

    switch (otmp.otyp) {
    case WAN_LOCKING:
    case SPE_WIZARD_LOCK:
        if (Is_rogue_level(u.uz)) {
            let vis = cansee(x, y);

            /* Can't have real locking in Rogue, so just hide doorway */
            if (vis) {
                pline(_("%s springs up in the older, more primitive doorway."),
                      dustcloud);
            } else {
                 ;
                You_hear(_("a swoosh."));
            }
            if (obstructed(x, y, mysterywand)) {
                if (vis)
                    pline_The(_("cloud %s."), quickly_dissipates);
                return FALSE;
            }
            block_point(x, y);
            door.typ = SDOOR, door.flags = D_NODOOR;
            if (vis)
                pline_The(_("doorway vanishes!"));
            newsym(x, y);
            return TRUE;
        }
        if (obstructed(x, y, mysterywand))
            return FALSE;
        /* Don't allow doors to close over traps.  This is for pits */
        /* & trap doors, but is it ever OK for anything else? */
        if (t_at(x, y)) {
            /* maketrap() clears doormask, so it should be NODOOR */
            pline(_("%s springs up in the doorway, but %s."), dustcloud,
                  quickly_dissipates);
            return FALSE;
        }

        switch (door.flags & ~D_TRAPPED) {
        case D_CLOSED:
            msg = _("The door locks!");
            break;
        case D_ISOPEN:
            msg = _("The door swings shut, and locks!");
            break;
        case D_BROKEN:
            msg = _("The broken door reassembles and locks!");
            break;
        case D_NODOOR:
            msg =
               _("A cloud of dust springs up and assembles itself into a door!");
            break;
        default:
            res = FALSE;
            break;
        }
        block_point(x, y);
        door.flags = D_LOCKED | (door.flags & D_TRAPPED);
        newsym(x, y);
        break;
    case WAN_OPENING:
    case SPE_KNOCK:
        if (door.flags & D_LOCKED) {
            msg = _("The door unlocks!");
            door.flags = D_CLOSED | (door.flags & D_TRAPPED);
        } else
            res = FALSE;
        break;
    case WAN_STRIKING:
    case SPE_FORCE_BOLT:
        if (door.flags & (D_LOCKED | D_CLOSED)) {
            /* sawit: closed door location is more visible than open */
            let sawit, seeit;

            if (door.flags & D_TRAPPED) {
                let mtmp = m_at(x, y);

                sawit = mtmp ? canseemon(mtmp) : cansee(x, y);
                door.flags = D_NODOOR;
                unblock_point(x, y);
                newsym(x, y);
                seeit = mtmp ? canseemon(mtmp) : cansee(x, y);
                if (mtmp) {
                    mb_trapped(mtmp, (sawit || seeit ? 1 : 0));
                } else {
                    /* for mtmp, mb_trapped() does is own wake_nearto() */
                    loudness = 40;
                    if (flags.verbose) {
                         ;
                        if ((sawit || seeit) && !Unaware()) {
                            pline(_("KABOOM!!  You see a door explode."));
                        } else if (!Deaf()) {
                             ;
                            You_hear(_("a %s explosion."),
                                     (distu(x, y) > 7 * 7) ? _("distant")
                                                           : _("nearby"));
                        }
                    }
                }
                break;
            }
            sawit = cansee(x, y);
            door.flags = D_BROKEN;
            recalc_block_point(x, y);
            seeit = cansee(x, y);
            newsym(x, y);
            if (flags.verbose) {
                if ((sawit || seeit) && !Unaware()) {
                    pline_The(_("door crashes open!"));
                } else if (!Deaf()) {
                     ;
                    You_hear(_("a crashing sound."));
                }
            }
            /* force vision recalc before printing more messages */
            if (gv.vision_full_recalc)
                vision_recalc(0);
            loudness = 20;
        } else
            res = FALSE;
        break;
    default:
        impossible(_("magic (%d) attempted on door."), otmp.otyp);
        break;
    }
    if (msg && cansee(x, y))
        pline1(msg);
    if (loudness > 0) {
        /* door was destroyed */
        wake_nearto(x, y, loudness);
        if (chars[in_rooms(x, y, SHOPBASE)])
            add_damage(x, y, 0);
    }

    if (res && picking_at(x, y)) {
        /* maybe unseen monster zaps door you're unlocking */
        stop_occupation();
        reset_pick();
    }
    return res;
}

function chest_shatter_msg(otmp) { /* void */
    let disposition;
    let thing;
    let save_HBlinded, save_BBlinded;

    if (otmp.oclass == POTION_CLASS) {
        You(_("%s %s shatter!"), Blind() ? _("hear") : _("see"), an(bottlename()));
        if (!breathless(gy.youmonst.data) || haseyes(gy.youmonst.data))
            potionbreathe(otmp);
        return;
    }
    /* We have functions for distant and singular names, but not one */
    /* which does _both_... */
    save_HBlinded = HBlinded(),  save_BBlinded = BBlinded();
    u.uprops[BLINDED].intrinsic = 1,  u.uprops[BLINDED].blocked = 0;
    thing = singular(otmp, xname);
    u.uprops[BLINDED].intrinsic = save_HBlinded,  u.uprops[BLINDED].blocked = save_BBlinded;
    switch (objects[otmp.otyp].oc_material) {
    case PAPER:
        disposition = _("is torn to shreds");
        break;
    case WAX:
        disposition = _("is crushed");
        break;
    case VEGGY:
        disposition = _("is pulped");
        break;
    case FLESH:
        disposition = _("is mashed");
        break;
    case GLASS:
        disposition = _("shatters");
        break;
    case WOOD:
        disposition = _("splinters to fragments");
        break;
    default:
        disposition = _("is destroyed");
        break;
    }
    pline(_("%s %s!"), An(thing), disposition);
}

/*lock.c*/

import { A_CON, A_DEX, A_STR, A_WIS } from "./attrib.h.js";
import { ACURR, ACURRSTR } from "./attrib.h.macros.js";
import { struct_nhcoord } from "./coord.h.js";
import { Something } from "./decl.h.macros.js";
import { POTION_CLASS, ROCK_CLASS, WAND_CLASS, WEAPON_CLASS } from "./defsym.h.js";
import { canspotmon } from "./display.h.macros.js";
import { Is_rogue_level } from "./dungeon.h.macros.js";
import { AUTOUNLOCK_APPLY_KEY, AUTOUNLOCK_KICK, AUTOUNLOCK_UNTRAP } from "./flag.h.js";
import { FALSE, QBUFSZ, TRUE } from "./global.h.js";
import {
    COST_BRKLCK, CQ_CANNED, ECMD_CANCEL, ECMD_OK, ECMD_TIME, FINGER, SHOP_DOOR_COST,
} from "./hack.h.js";
import { distu, pline1, y_n, ynq } from "./hack.h.macros.js";
import { SHOPBASE } from "./mkroom.h.js";
import { breathless, haseyes, nohands, verysmall } from "./mondata.h.macros.js";
import { M_AP_FURNITURE, M_AP_OBJECT } from "./monst.h.js";
import { M_AP_TYPE, is_door_mappear } from "./monst.h.macros.js";
import { PM_ORACLE, PM_ROGUE, PM_WIZARD } from "./monsters.h.js";
import { OBJ_FLOOR, struct_obj } from "./obj.h.js";
import {
    Is_box, any_quest_artifact, carried, greatest_erosion, is_blade, is_pick, is_weptool,
} from "./obj.h.macros.js";
import { FLESH, GLASS, PAPER, VEGGY, WAX, WOOD } from "./objclass.h.js";
import {
    CHEST, CORPSE, CREDIT_CARD, ICE_BOX, LOCK_PICK, SKELETON_KEY, SPE_FORCE_BOLT, SPE_KNOCK,
    SPE_POLYMORPH, SPE_WIZARD_LOCK, WAN_LOCKING, WAN_OPENING, WAN_POLYMORPH, WAN_STRIKING,
} from "./objects.h.js";
import { BLINDED } from "./prop.h.js";
import {
    DOOR, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR,
    D_TRAPPED, SDOOR,
} from "./rm.h.js";
import { IS_DOOR, OBJ_AT, levl, m_at } from "./rm.h.macros.js";
import { P_DAGGER, P_FLAIL, P_LANCE } from "./skills.h.js";
import { cansee } from "./vision.h.macros.js";
import { TT_PIT } from "./you.h.js";
import { Role_if, u_at } from "./you.h.macros.js";
import {
    BBlinded, Blind, Confusion, Deaf, HBlinded, Levitation, Passes_walls,
    Protection_from_shape_changers, Stunned, Unaware, Underwater,
} from "./youprop.h.macros.js";
import { char, ord, sizeof_string } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { sprintf, strcat } from "../rt/libc.js";
import { init_string, stack_array, stack_struct, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { ptr_to, struct_assign } from "../rt/struct.js";
import { stop_occupation } from "./allmain.js";
import { is_magic_key, touch_artifact } from "./artifact.js";
import { exercise } from "./attrib.js";
import {
    cmdq_add_dir, cmdq_add_ec, get_adjacent_loc, getdir, isok, set_occupation, yn_function,
} from "./cmd.js";
import { is_db_wall, is_drawbridge_wall, is_lava, is_pool } from "./dbridge.js";
import { cg, flags, gi, go, gv, gx, gy, svc, svl, svm, u, ynqchars } from "./decl.js";
import { canseemon, feel_location, feel_newsym, map_invisible, newsym } from "./display.js";
import { Some_Monnam, hliquid, mon_nam } from "./do_name.js";
import { dokick } from "./dokick.js";
import { update_mapseen_for } from "./dungeon.js";
import { can_reach_floor, cant_reach_floor } from "./engrave.js";
import { in_rooms } from "./hack.js";
import { s_suffix, sgn } from "./hacklib.js";
import { currency, delobj, stackobj, useup } from "./invent.js";
import {
    costly_alteration, obj_extract_self, place_object, start_corpse_timeout,
} from "./mkobj.js";
import { wake_nearby, wake_nearto } from "./mon.js";
import { closed_door, mb_trapped } from "./monmove.js";
import { mons } from "./monst.js";
import { objects } from "./objects.js";
import {
    An, an, ansimpleoname, doname, safe_qbuf, simple_typename, singular, the, xname, yname,
    ysimple_name,
} from "./objnam.js";
import { container_at, doloot } from "./pickup.js";
import {
    There, You, You_cant, You_hear, impossible, pline, pline_The, set_msg_xy, verbalize,
} from "./pline.js";
import { bottlename, potionbreathe } from "./potion.js";
import { is_quest_artifact } from "./questpgr.js";
import { rn2, rnl } from "./rnd.js";
import { add_damage, costly_spot, obfree, shop_keeper, stolen_value } from "./shk.js";
import { maybe_absorb_item } from "./steal.js";
import { b_trapped, chest_trap, could_untrap, t_at, untrap } from "./trap.js";
import { stumble_onto_mimic } from "./uhitm.js";
import { block_point, recalc_block_point, unblock_point, vision_recalc } from "./vision.js";
import { obj_resists } from "./zap.js";
