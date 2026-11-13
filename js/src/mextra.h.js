/* NetHack 5.0	mextra.h	$NHDT-Date: 1720717969 2024/07/11 17:12:49 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.40 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2006. */
/* NetHack may be freely redistributed.  See license for details. */

/*
 *  Adding new mextra structures:
 *
 *       1. Add the structure definition and any required macros in this
 *          file above the mextra struct.
 *       2. Add a pointer to your new struct to the mextra struct in this
 *          file.
 *       3. Add a referencing macro at bottom of this file after the mextra
 *          struct (see MGIVENNAME, EGD, EPRI, ESHK, EMIN, or EDOG for
 *          examples).
 *       4. If your new field isn't a pointer and requires a non-zero value
 *          on initialization, add code to init_mextra() in src/makemon.c
 *       5. Create a newXX(mtmp) function and possibly a free_XX(mtmp)
 *          function in an appropriate new or existing source file and add
 *          a prototype for it to include/extern.h.
 *
 *              void newXX(struct monst *);
 *              void free_XX(struct monst *);
 *
 *              void
 *              newXX(mtmp)
 *              struct monst *mtmp;
 *              {
 *                  if (!mtmp->mextra)
 *                      mtmp->mextra = newmextra();
 *                  if (!XX(mtmp)) {
 *                      XX(mtmp) = (struct XX *) alloc(sizeof (struct XX));
 *                      (void) memset((genericptr_t) XX(mtmp),
 *                                    0, sizeof (struct XX));
 *                  }
 *              }
 *
 *       6. Consider adding a new makemon flag MM_XX flag to include/hack.h
 *          and a corresponding change to makemon() if you require your
 *          structure to be added at monster creation time.  Initialize your
 *          struct after a successful return from makemon().
 *
 *              src/makemon.c:  if (mmflags & MM_XX) newXX(mtmp);
 *              your new code:  mon = makemon(&mons[mnum], x, y, MM_XX);
 *
 *       7. Adjust size_monst() in src/wizcmds.c appropriately.
 *       8. Adjust dealloc_mextra() in src/mon.c to clean up
 *          properly during monst deallocation.
 *       9. Adjust copy_mextra() in src/mon.c to make duplicate
 *          copies of your struct or data on another monst struct.
 *      10. Adjust restmon() in src/restore.c to deal with your
 *          struct or data during a restore.
 *      11. Adjust savemon() in src/save.c to deal with your
 *          struct or data during a save.
 */

/***
 **     formerly vault.h -- vault guard extension
 */
export const FCSIZ = (ROWNO + COLNO);
export const GD_EATGOLD = 0x01;
export const GD_DESTROYGOLD = 0x02;

export const struct_fakecorridor = struct("struct_fakecorridor", {
    fx: coordxy, fy: coordxy,
    ftyp: schar, /* from struct rm's typ */
    flags: uchar, /* also from struct rm; an unsigned 5-bit field there */
});

export const struct_egd = struct("struct_egd", {
    parentmid: unsigned, /* make clobber-detection possible */
    fcbeg: int, fcend: int, /* fcend: first unused pos */
    vroom: int, /* room number of the vault */
    gdx: coordxy, gdy: coordxy, /* goal of guard's walk */
    ogx: coordxy, ogy: coordxy, /* guard's last position */
    gdlevel: "struct_d_level", /* level (& dungeon) guard was created in */
    warncnt: xint8, /* number of warnings to follow */
    dropgoldcnt: xint8, /* number of demands to drop gold */
    gddone: Bitfield(1), /* true iff guard has released player */
    witness: Bitfield(2), /* the guard saw you do something */
    unused: Bitfield(5),
    fakecorr: array_of("struct_fakecorridor", FCSIZ),
});

/***
 **     formerly epri.h -- temple priest extension
 */
export const struct_epri = struct("struct_epri", {
    parentmid: unsigned, /* make clobber-detection possible */
    shralign: aligntyp, /* alignment of priest's shrine */
    shroom: schar, /* index in rooms */
    shrpos: "struct_nhcoord", /* position of shrine */
    shrlevel: "struct_d_level", /* level (& dungeon) of shrine */
    cheapskate_count: unsigned, /* number of cheapskate donations */
    intone_time: long, /* used to limit verbosity  +*/
        enter_time: long, /*+ of temple entry messages */
        hostile_time: long, /* forbidding feeling */
        peaceful_time: long, /* sense of peace */
});
/* note: roaming priests (no shrine) switch from ispriest to isminion
   (and emin extension) */

/***
 **     formerly eshk.h -- shopkeeper extension
 */
export const REPAIR_DELAY = 5;
export const BILLSZ = 200;

export const struct_bill_x = struct("struct_bill_x", {
    bo_id: unsigned,
    useup: boolean,
    price: long, /* price per unit */
    bquan: long, /* amount used up */
});

export const struct_eshk = struct("struct_eshk", {
    parentmid: unsigned, /* make clobber-detection possible */
    robbed: long, /* amount stolen by most recent customer */
    credit: long, /* amount credited to customer */
    debit: long, /* amount of debt for using unpaid items */
    loan: long, /* shop-gold picked (part of debit) */
    shoptype: int, /* the value of svr.rooms[shoproom].rtype */
    shoproom: schar, /* index in svr.rooms; set by inshop() */
    unused: schar, /* to force alignment for stupid compilers */
    following: boolean, /* following customer since he owes us sth */
    surcharge: boolean, /* angry shk inflates prices */
    dismiss_kops: boolean, /* pacified shk sends kops away */
    shk: "struct_nhcoord", /* usual position shopkeeper */
    shd: "struct_nhcoord", /* position shop door */
    shoplevel: "struct_d_level", /* level (& dungeon) of his shop */
    billct: int, /* no. of entries of bill[] in use */
    bill: array_of("struct_bill_x", BILLSZ),
    bill_p: ptr_to("struct_bill_x"), /* &(ESHK(shkp)->bill[0]) */
    break_seq: long, /* hero_seq value at time of object breakage */
    seq_peaceful: boolean, /* shkp->mpeaceful at start of break_seq */
    visitct: int, /* nr of visits by most recent customer */
    customer: array_of(char, PL_NSIZ), /* most recent customer */
    shknam: array_of(char, PL_NSIZ),
});

/***
 **     formerly emin.h -- minion extension
 */
export const struct_emin = struct("struct_emin", {
    parentmid: unsigned, /* make clobber-detection possible */
    min_align: aligntyp, /* alignment of minion */
    renegade: boolean, /* hostile co-aligned priest or Angel */
});

/***
 **     formerly edog.h -- pet extension
 */
/*      various types of pet food, the lower the value, the better liked */

    export const DOGFOOD = 0;
    export const CADAVER = 1;
    export const ACCFOOD = 2;
    export const MANFOOD = 3;
    export const APPORT = 4;
    export const POISON = 5;
    export const UNDEF = 6;
    export const TABU = 7;

export const struct_edog = struct("struct_edog", {
    parentmid: unsigned, /* make clobber-detection possible */
    droptime: long, /* moment dog dropped object */
    dropdist: unsigned, /* dist of dropped obj from @ */
    apport: int, /* amount of training */
    whistletime: long, /* last time he whistled */
    hungrytime: long, /* will get hungry at this time */
    ogoal: "struct_nhcoord", /* previous goal location */
    abuse: int, /* track abuses to this pet */
    revivals: int, /* count pet deaths */
    mhpmax_penalty: int, /* while starving, points reduced */
    killed_by_u: Bitfield(1), /* you attempted to kill him */
});

/***
 **     extension tracking a player's remnant monster (ghost, mummy etc.)
 */
export const struct_ebones = struct("struct_ebones", {
    parentmid: unsigned, /* make clobber-detection possible */
    role: uchar, /* index into roles[] */
    race: uchar, /* index into races[] */
    oldalign: "struct_align", /* character alignment */
    deathlevel: uchar, /* level when dying (m_lev may differ) */
    luck: schar, /* luck when dying */
    mnum: short, /* monster type */
    female: Bitfield(1), /* was female */
    demigod: Bitfield(1), /* had killed wiz or invoked */
    crowned: Bitfield(1), /* had been crowned */
});

/***
 **     mextra.h -- collection of all monster extensions
 */
export const struct_mextra = struct("struct_mextra", {
    mgivenname: ptr_to(char),
    egd: ptr_to("struct_egd"),
    epri: ptr_to("struct_epri"),
    eshk: ptr_to("struct_eshk"),
    emin: ptr_to("struct_emin"),
    edog: ptr_to("struct_edog"),
    ebones: ptr_to("struct_ebones"),
    mcorpsenm: int, /* obj->corpsenm for mimic posing as statue or corpse,
                    * obj->spe (fruit index) for one posing as a slime mold,
                    * or an alignment mask for one posing as an altar */
});

import { aligntyp } from "./align.h.js";
import { COLNO, PL_NSIZ, ROWNO, boolean, coordxy, xint8 } from "./global.h.js";
import { char, int, long, schar, short, uchar, unsigned } from "../rt/ctypes.js";
import { Bitfield, array_of, ptr_to, struct } from "../rt/struct.js";
