/* NetHack 5.0	mail.c	$NHDT-Date: 1762750699 2025/11/09 20:58:19 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.77 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Pasi Kallinen, 2018. */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * Notify user when new mail has arrived.  Idea by Merlyn Leroy.
 *
 * The mail daemon can move with less than usual restraint.  It can:
 *      - move diagonally from a door
 *      - use secret and closed doors
 *      - run through a monster ("Gangway!", etc.)
 *      - run over pools & traps
 *
 * Possible extensions:
 *      - Open the file MAIL and do fstat instead of stat for efficiency.
 *        (But sh uses stat, so this cannot be too bad.)
 *      - Examine the mail and produce a scroll of mail named "From somebody".
 *      - Invoke MAILREADER in such a way that only this single mail is read.
 *      - Do something to the text when the scroll is enchanted or cancelled.
 *      - Make the daemon always appear at a stairwell, and have it find a
 *        path to the hero.
 *
 * Note by Olaf Seibert: On the Amiga, we usually don't get mail.  So we go
 *                       through most of the effects at 'random' moments.
 * Note by Paul Winner:  The MSDOS port also 'fakes' the mail daemon at
 *                       random intervals.
 */

/* DON'T trust all Unices to declare getpwuid() in <pwd.h> */

/* DO trust all SVR4 to typedef uid_t in <sys/types.h> (probably to a long) */

const omstat = static_struct("omstat", struct_stat); const nmstat = static_struct("nmstat", struct_stat);
const mailbox = static_var("mailbox", ptr_to(char), 0);
const laststattime = static_var("laststattime", long);

export const MAILPATH = "/usr/mail/";

export function free_maildata() { /* void */
    if (mailbox[0])
        free((mailbox[0])), mailbox[0] = 0;
}

export function getmailstatus() { /* void */
    if (mailbox[0]) {
        ; /* no need to repeat the setup */
    } else if ((mailbox[0] = nh_getenv(_("MAIL"))) != 0) {
        mailbox[0] = dupstr(mailbox[0]);
    } else  {
        /* #ifdef AMS: not in this build */

        let pw_name = getpwuid(getuid()).pw_name;

        /* note: 'sizeof "LITERAL"' includes +1 for terminating '\0' */
        mailbox[0] = addr_of(alloc(unsigned(strlen(pw_name)
                                             + sizeof_string(MAILPATH))));
        strcpy(mailbox[0], _(MAILPATH));
        strcat(mailbox[0], pw_name);
    }

    debugpline3(_("mailbox=%c%s%c"),
                mailbox[0] ? ord('\"') : ord('<'),
                mailbox[0] ? mailbox[0] : _("null"),
                mailbox[0] ? ord('\"') : ord('>'), __FILE__);

    if (mailbox[0] && stat(mailbox[0], omstat)) {
        omstat.st_mtim.tv_sec = 0;
    }
}

/*
 * Pick coordinates for a starting position for the mail daemon.  Called
 * from newmail() and newphone().
 */
function md_start(startp) { /* boolean */
    const $frame = stack_frame(); try {
    var testcc = stack_struct(struct_nhcoord);     /* scratch coordinates */
    var row;          /* current row we are checking */
    var lax;          /* if TRUE, pick a position in sight. */
    var dd;           /* distance to current point */
    var max_distance; /* max distance found so far */
    var stway = gs.stairs;

    /*
     * If blind and not telepathic, then it doesn't matter what we pick ---
     * the hero is not going to see it anyway.  So pick a nearby position.
     */
    if (Blind() && !Blind_telepat()) {
        if (!enexto(startp, u.ux, u.uy, null))
            return FALSE; /* no good positions */
        return TRUE;
    }

    /*
     * Arrive at an up or down stairwell if it is in line of sight from the
     * hero.
     */
    while (stway) {
        if (stway.tolev.dnum == u.uz.dnum
            && couldsee(stway.sx, stway.sy)) {
            startp.x = stway.sx;
            startp.y = stway.sy;
            return TRUE;
        }
        stway = stway.next;
    }

    /*
     * Try to pick a location out of sight next to the farthest position away
     * from the hero.  If this fails, try again, just picking the farthest
     * position that could be seen.  What we really ought to be doing is
     * finding a path from a stairwell...
     *
     * The arrays gv.viz_rmin[] and gv.viz_rmax[] are set even when blind.
     * These are the LOS limits for each row.
     */
    lax = 0; /* be picky */
    max_distance = -1;
 retry: for (;;) {
    for (row = 0; row < ROWNO; row++) {
        if (gv.viz_rmin[row] < gv.viz_rmax[row]) {
            /* There are valid positions on this row. */
            dd = dist2((gv.viz_rmin[row]), coordxy((row)), u.ux, u.uy);
            if (dd > max_distance) {
                if (lax) {
                    max_distance = dd;
                    startp.y = row;
                    startp.x = gv.viz_rmin[row];
                } else if (enexto(testcc, gv.viz_rmin[row], row,
                                  null)
                           && !cansee(testcc.x, testcc.y)
                           && couldsee(testcc.x, testcc.y)) {
                    max_distance = dd;
                    struct_assign(startp, testcc);
                }
            }
            dd = dist2((gv.viz_rmax[row]), coordxy((row)), u.ux, u.uy);
            if (dd > max_distance) {
                if (lax) {
                    max_distance = dd;
                    startp.y = row;
                    startp.x = gv.viz_rmax[row];
                } else if (enexto(testcc, gv.viz_rmax[row], row,
                                  null)
                           && !cansee(testcc.x, testcc.y)
                           && couldsee(testcc.x, testcc.y)) {
                    max_distance = dd;
                    struct_assign(startp, testcc);
                }
            }
        }
    }

    if (max_distance < 0) {
        if (!lax) {
            lax = 1; /* just find a position */
            continue retry;
        }
        return FALSE;
    } break; }

    return TRUE;
    } finally { stack_pop($frame); }
}

/*
 * Try to choose a stopping point as near as possible to the starting
 * position while still adjacent to the hero.  If all else fails, try
 * enexto().  Use enexto() as a last resort because enexto() chooses
 * its point randomly, which is not what we want.
 */
function md_stop(stopp,
        startp) { /* boolean */ /* starting position (read only) */
    let x, y, distance, min_distance = -1;

    for (x = u.ux - 1; x <= u.ux + 1; x++)
        for (y = u.uy - 1; y <= u.uy + 1; y++) {
            if (!isok(x, y) || u_at(x, y))
                continue;

            if (accessible(x, y) && !MON_AT(x, y)) {
                distance = dist2(x, y, startp.x, startp.y);
                if (min_distance < 0 || distance < min_distance
                    || (distance == min_distance && rn2(2))) {
                    stopp.x = x;
                    stopp.y = y;
                    min_distance = distance;
                }
            }
        }

    /* If we didn't find a good spot, try enexto(). */
    if (min_distance < 0 && !enexto(stopp, u.ux, u.uy, mons[PM_MAIL_DAEMON]))
        return FALSE;

    return TRUE;
}

/* Let the mail daemon have a larger vocabulary. */
const mail_text = static_array("mail_text", ptr_to(char), null, [ _("Gangway!"), _("Look out!"),
                                            _("Pardon me!") ]);
export function md_exclamations() { return (mail_text[rn2(3)]); }

/*
 * Make the mail daemon run through the dungeon.  The daemon will run over
 * any monsters that are in its path, but will replace them later.  Return
 * FALSE if the md gets stuck in a position where there is a monster.  Return
 * TRUE otherwise.
 */
function md_rush(md,
        tx, ty) { /* boolean */ /* destination of mail daemon */
    let mon;            /* displaced monster */
    let dx, dy;          /* direction counters */
    let fx = md.mx, fy = md.my; /* current location */
    let nfx = fx, nfy = fy,
        d1, d2;                   /* shortest distances */

    /*
     * It is possible that the monster at (fx,fy) is not the md when:
     * the md rushed the hero and failed, and is now starting back.
     */
    if (m_at(fx, fy) == md) {
        remove_monster(fx, fy); /* pick up from orig position */
        newsym(fx, fy);
    }

    /*
     * At the beginning and exit of this loop, md is not placed in the
     * dungeon.
     */
    while (1) {
        /* Find a good location next to (fx,fy) closest to (tx,ty). */
        d1 = dist2(fx, fy, tx, ty);
        for (dx = -1; dx <= 1; dx++)
            for (dy = -1; dy <= 1; dy++)
                if ((dx || dy) && isok(fx + dx, fy + dy)
                    && !IS_STWALL(levl()[fx + dx][fy + dy].typ)) {
                    d2 = dist2(fx + dx, fy + dy, tx, ty);
                    if (d2 < d1) {
                        d1 = d2;
                        nfx = fx + dx;
                        nfy = fy + dy;
                    }
                }

        /* Break if the md couldn't find a new position. */
        if (nfx == fx && nfy == fy)
            break;

        fx = nfx; /* this is our new position */
        fy = nfy;

        /* Break if the md reaches its destination. */
        if (fx == tx && fy == ty)
            break;

        mon = m_at(fx, fy); /* save monster at this position */
        if (!Deaf()) {
               ;
            if (mon)
                verbalize(_("%s"), md_exclamations());
            else if (u_at(fx, fy))
                verbalize(_("Excuse me."));
        }

        if (mon)
            remove_monster(fx, fy);
        place_monster(md, fx, fy); /* put md down */
        newsym(fx, fy);            /* see it */
        flush_screen(0);           /* make sure md shows up */
        nh_delay_output()();         /* wait a little bit */

        /* Remove md from the dungeon.  Restore original mon, if necessary. */
        remove_monster(fx, fy);
        if (mon) {
            if ((mon.mx != fx) || (mon.my != fy))
                place_worm_seg(mon, fx, fy);
            else
                place_monster(mon, fx, fy);
        }
        newsym(fx, fy);
    }

    /*
     * Check for a monster at our stopping position (this is possible, but
     * very unlikely).  If one exists, then have the md leave in disgust.
     */
    if ((mon = m_at(fx, fy)) != null) {
        remove_monster(fx, fy);
        place_monster(md, fx, fy); /* display md with text below */
        newsym(fx, fy);
        if (!Deaf()) {
               ;
            verbalize(_("This place's too crowded.  I'm outta here."));
        } else {
            pline(_("%s."), Never_mind());
        }
        remove_monster(fx, fy);

        if ((mon.mx != fx) || (mon.my != fy)) /* put mon back */
            place_worm_seg(mon, fx, fy);
        else
            place_monster(mon, fx, fy);

        newsym(fx, fy);
        return FALSE;
    }

    place_monster(md, fx, fy); /* place at final spot */
    newsym(fx, fy);
    flush_screen(0);
    nh_delay_output()(); /* wait a little bit */

    return TRUE;
}

/* Deliver a scroll of mail. */
/*ARGSUSED*/
function newmail(info) { /* void */
    const $frame = stack_frame(); try {
    var md;
    var start = stack_struct(struct_nhcoord), stop = stack_struct(struct_nhcoord);
    var message_seen = FALSE;

    /* Try to find good starting and stopping places. */
    give_up: { if (!md_start(start) || !md_stop(stop, start))
        break give_up;;

    /* Make the daemon.  Have it rush towards the hero. */
    if (!(md = makemon(mons[PM_MAIL_DAEMON], start.x, start.y, NO_MM_FLAGS)))
        break give_up;;
    go_back: { if (!md_rush(md, stop.x, stop.y))
        break go_back;;

    message_seen = TRUE;
    if (!Deaf()) {
           ;
        verbalize(_("%s, %s!  %s."), Hello(md), svp.plname, info.display_txt);
    } else {
        pline(_("Message:  %s."), info.display_txt);
    }

    if (info.message_typ) {
        var obj = mksobj(SCR_MAIL, FALSE, FALSE);

        if (info.object_nam)
            obj = oname(obj, info.object_nam, ONAME_NO_FLAGS);
        if (info.response_cmd)
            new_omailcmd(obj, info.response_cmd);

        if (!m_next2u(md)) {
            if (!Deaf()) {
                   ;
                verbalize(_("Catch!"));
            } else {
                /* don't bother with nonverbal alternative ... */
                ;
            }
        }
        display_nhwindow()(WIN_MESSAGE, FALSE);
        obj = hold_another_object(obj, _("Oops!"), 0,
                                  0);
        (obj);
    }
 }
    /* zip back to starting location */
    if (!md_rush(md, start.x, start.y))
        md.mx = md.my = 0; /* for mongone, md is not on map */
    mongone(md);
 }
    /* deliver some classes of messages even if no daemon ever shows up */
    if (!message_seen && info.message_typ == MSG_OTHER)
        pline(_("Hark!  \"%s.\""), info.display_txt);
    } finally { stack_pop($frame); }
}

/* #if !defined(UNIX) && !defined(VMS): not in this build */

export function ckmailstatus() { /* void */
    ck_server_admin_msg();

    if (!mailbox[0] || u.uswallow || !flags.biff

        || svm.moves < laststattime[0] + MAILCKFREQ

        )
        return;

    laststattime[0] = svm.moves;
    if (stat(mailbox[0], nmstat)) {
        nmstat.st_mtim.tv_sec = 0;
    } else if (nmstat.st_mtim.tv_sec > omstat.st_mtim.tv_sec) {
        if (nmstat.st_size) {
            let deliver = static_struct("ckmailstatus.deliver", struct_mail_info, {
                message_typ: MSG_MAIL, display_txt: _("I have some mail for you"),

                object_nam: 0, response_cmd: 0
            });
            newmail(deliver);
        }
        getmailstatus(); /* might be too late ... */
    }
}

/* #if defined(SIMPLE_MAIL) || defined(SERVER_ADMIN_MSG): not in this build */

export function ck_server_admin_msg() { /* void */
/* #ifdef SERVER_ADMIN_MSG: not in this build */
}

/*ARGSUSED*/
export function readmail(otmp) { /* void */
    let mr = 0;

    if (iflags.debug_fuzzer)
        return;
    display_nhwindow()(WIN_MESSAGE, FALSE);
    if (!(mr = nh_getenv(_("MAILREADER"))))
        mr = _(DEF_MAILREADER);

    if (child(1)) {
        execl(mr, mr, 0);
        nh_terminate(EXIT_FAILURE);
    }

    /* get new stat; not entirely correct: there is a small time
       window where we do not see new mail */
    getmailstatus();
}

/* #ifdef VMS: not in this build */

/*mail.c*/

import { struct_nhcoord } from "./coord.h.js";
import { Never_mind } from "./decl.h.macros.js";
import { FALSE, ROWNO, TRUE, coordxy } from "./global.h.js";
import { NO_MM_FLAGS, ONAME_NO_FLAGS } from "./hack.h.js";
import { debugpline3 } from "./lint.h.macros.js";
import { MSG_MAIL, MSG_OTHER, struct_mail_info } from "./mail.h.js";
import { PM_MAIL_DAEMON } from "./monsters.h.js";
import { SCR_MAIL } from "./objects.h.js";
import { IS_STWALL, MON_AT, levl, m_at, place_worm_seg, remove_monster } from "./rm.h.macros.js";
import { DEF_MAILREADER, MAILCKFREQ } from "./unixconf.h.js";
import { cansee, couldsee } from "./vision.h.macros.js";
import { display_nhwindow, nh_delay_output } from "./winprocs.h.macros.js";
import { m_next2u, u_at } from "./you.h.macros.js";
import { Blind, Blind_telepat, Deaf } from "./youprop.h.macros.js";
import { struct_stat } from "../libc/records.js";
import { char, long, ord, sizeof_string, unsigned } from "../rt/ctypes.js";
import { stack_frame, stack_pop } from "../rt/heap.js";
import {
    EXIT_FAILURE, execl, free, getpwuid, getuid, stat, strcat, strcpy, strlen,
} from "../rt/libc.js";
import { stack_struct, static_array, static_struct, static_var } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, ptr_to, struct_assign } from "../rt/struct.js";
import { alloc, dupstr } from "./alloc.js";
import { isok } from "./cmd.js";
import { flags, gs, gv, iflags, svm, svp, u } from "./decl.js";
import { flush_screen, newsym } from "./display.js";
import { oname } from "./do_name.js";
import { nh_terminate } from "./end.js";
import { dist2 } from "./hacklib.js";
import { hold_another_object } from "./invent.js";
import { makemon } from "./makemon.js";
import { mksobj, new_omailcmd } from "./mkobj.js";
import { mongone } from "./mon.js";
import { accessible } from "./monmove.js";
import { mons } from "./monst.js";
import { nh_getenv } from "./options.js";
import { pline, verbalize } from "./pline.js";
import { rn2 } from "./rnd.js";
import { Hello } from "./role.js";
import { place_monster } from "./steed.js";
import { enexto } from "./teleport.js";
import { child } from "../sys/c2js/nhjs_host.js";
const __FILE__ = "mail.c";
