/* NetHack 5.0	extern.h	$NHDT-Date: 1770949988 2026/02/12 18:33:08 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1523 $ */
/* Copyright (c) Steve Creps, 1988.                               */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * The placements of the NONNULLARG* and NONNULLPTRS macros were done
 * using the following rules:
 * These were the rules that were followed when determining which function
 * parameters should be nonnull, and which are nullable:
 *
 *   1. If the first use of, or reference to, the pointer parameter in the
 *      function is a dereference, then the parameter will be considered
 *      nonnull.
 *
 *   2. If there is code in the function that tests for the pointer parameter
 *      being null, and adjusts the code-path accordingly so that no segfault
 *      will occur, then the parameter will not be considered nonnull (it can
 *      be null).
 *
 * Note that if an arg is declared nonnull, any tests inside the function
 * for the variable being null, will likely trigger a compiler warning
 * diagnostic about the unnecessary test.
 *
 * Description of the NONNULL macros:
 *
 *  NONNULL         The function return value is never NULL.
 *  NONNULLPTRS     Every pointer argument is declared nonnull.
 *  NONNULLARG1     The 1st argument is declared nonnull.
 *  NONNULLARG2     The 2nd argument is declared nonnull.
 *  NONNULLARG3     The 3rd argument is declared nonnull.
 *  NONNULLARG4     The 4th argument is declared nonnull (not used).
 *  NONNULLARG5     The 5th argument is declared nonnull.
 *  NONNULLARG6     The 6th argument is declared nonnull.
 *  NONNULLARG7     The 7th argument is declared nonnull (bhit).
 *  NONNULLARG12    The 1st and 2nd arguments are declared nonnull.
 *  NONNULLARG23    The 2nd and 3rd arguments are declared nonnull.
 *  NONNULLARG13    The 1st and 3rd arguments are declared nonnull.
 *  NONNULLARG123   The 1st, 2nd and 3rd arguments are declared nonnull.
 *  NONNULLARG14    The 1st and 4th arguments are declared nonnull.
 *  NONNULLARG134   The 1st, 3rd and 4th arguments are declared nonnull.
 *  NONNULLARG17    The 1st and 7th arguments are declared nonnull (this
 *                  was a special-case added for askchain(), where the
 *                  arguments are spread out that way. This macro
 *                  could be removed if the askchain arguments in the
 *                  prototype and callers were changed to make the
 *                  nonnull arguments side-by-side).
 *  NONNULLARG145   The 1st, 4th and 5th arguments are declared nonnull
 *                  (this was a special-case added for find_roll_to_hit(),
 *                  in uhitm.c, where the arguments are spread out that way.
 *                  We can't just use NONNULLPTRS there because the 3rd
 *                  argument 'weapon' can be NULL).
 *  NONNULLARG24    The 2nd and 4th arguments are declared nonnull (this
 *                  was a special-case added for query_objlist() in invent.c).
 *  NONNULLARG45    The 4th and 5th arguments are declared nonnull (this
 *                  was a special-case added for do_screen_description(),
 *                  in pager.c, where the arguments are spread out that way.
 *                  We can't just use NONNULLPTRS there because the 6th
 *                  argument can be NULL).
 *  NO_NNARGS       This macro expands to nothing. It is just used to
 *                  mark that analysis has been done on the function,
 *                  and concluded that none of the arguments could be
 *                  marked nonnull.That distinguishes a function that has
 *                  not been analyzed (yet), from one that has.
 *
 */

/* ### alloc.c ### */

/* routines in alloc.c depend on MONITOR_HEAP and are declared in global.h */

/* moved from hacklib.c to alloc.c so that utility programs have access */

/* for Strlen() which returns unsigned instead of size_t and panics for
   strings of length INT_MAX (32K - 1) or longer */

/* This next pre-processor directive covers almost the entire file,
 * interrupted only occasionally to pick up specific functions as needed. */

/* ### allmain.c ### */

/* ### apply.c ### */

/* ### artifact.c ### */

/* ### attrib.c ### */

/* ### ball.c ### */

/* ### bones.c ### */

/* ### botl.c ### */

/* ### calendar.c ### */

/* ### cfgfiles.c ### */

/* arg1 of read_config_file can be NULL to pass through
 * to fopen_config_file() to mean 'use the default config file name' */

/* ### coloratt.c ### */

/* ### cmd.c ### */

/* ### date.c ### */

/* ### dbridge.c ### */

/* ### decl.c ### */

/* ### detect.c ### */

/* ### dig.c ### */

/* ### display.c ### */

/* ### do.c ### */

/* ### do_name.c ### */

/*
extern struct obj *realloc_obj(struct obj *, int, genericptr_t, int,
                               const char *);
*/

/* ### do_wear.c ### */

/* doseduce() calls with NULL */

/* ### dog.c ### */

/* ### dogmove.c ### */

/* ### dokick.c ### */

/* ### dothrow.c ### */

/* ### drawing.c ### */

/* ### dungeon.c ### */

/* ### earlyarg.c ### */

/* ### eat.c ### */

/* ### end.c ### */

/* ### engrave.c ### */

/* ### exper.c ### */

/* ### explode.c ### */

/* ### extralev.c ### */

/* ### files.c ### */

/* ### fountain.c ### */

/* ### getpos.c ### */

/* ### glyphs.c ### */

/* ### hack.c ### */

/* sometimes money_cnt(gi.invent) which can be null */

/* ### strutil.c ### */

/*
extern boolean pmatchz(const char *, const char *) NONNULLPTRS;
*/

/* ### iactions.c ### */

/* ### insight.c ### */

/* ### invent.c ### */

/* nhlua.c calls useupall(gi.invent), but checks gi.invent against NULL
 * before doing so. useupall() won't handle NULL*/

/* sometimes count_unpaid(gi.invent) which can be null */

/* ### ioctl.c ### */

/* ### light.c ### */

/* ### lock.c ### */

/* outdated functions removed */
/* ### macfile.c ### */
/* ### macmain.c ### */
/* ### macunix.c ### */
/* ### macwin.c ### */
/* ### mttymain.c ### */

/* ### mail.c ### */

/* ### makemon.c ### */

/* tests for NULL mtmp */

/* ### mcastu.c ### */

/* ### mdlib.c ### */

/* ### mhitm.c ### */

/* ### mhitu.c ### */

/* extern boolean ranged_attk_assessed(struct monst *mtmp,
                             boolean (*assessfunct)(struct monst *, int)) NONNULLARG1;
*/

/* ### minion.c ### */

/* ### mklev.c ### */

/* place_branch() has tests for NULL branch arg, preventing NONNULLARG1 */

/* ### mkmap.c ### */

/* ### mkmaze.c ### */

/* dungeon.c u_on_rndspot() passes NULL final arg to place_lregion() */

/* ### mkobj.c ### */

/*
extern void newolong(struct obj *);
extern void free_olong(struct obj *);
*/

/* ### mkroom.c ### */

/* ### mon.c ### */

/* ### mondata.c ### */

/* ### monmove.c ### */

/* ### monst.c ### */

/* ### mplayer.c ### */

/* ### msdos.c,os2.c,tos.c,windsys.c ### */

/* ### mthrowu.c ### */

/* ### muse.c ### */

/* ### music.c ### */

/* ### nhlsel.c ### */

/* ### nhlobj.c ### */

/* ### nhlua.c ### */

/* nhl_done contains a test for NULL arg1, preventing NONNULLARG1 */

/* dungeon.c init_dungeon_levels() passes NULL to get_table_str_opt arg3 */

/* lspo_feature calls get_table_option(L, "type", NULL, features),
   so arg3 can be NULL.  NONNULLARG124 is not currently defined */

/* extern int str_lines_max_width(const char *); */

/* ### {cpp,pmatch,posix}regex.c ### */

/* ### consoletty.c ### */

/* ### o_init.c ### */

/* objdescr_is() contains a test for NULL arg1, so can't be NONNULLARG12 */

/* ### objects.c ### */

/* ### objnam.c ### */

/* an(), the() contain tests for NULL arg, preventing NONNULLARG1 */

/* makeplural() and makesingular() never return NULL but have tests for NULL
   arg1, and code path that leads to impossible(), preventing NONNULLARG1 */

/* readobjnam() can return NULL and  allows a NULL to trigger code path for
   random object */

/* discover_object() passes NULL arg2 to Japanese_item_name(),
 * preventing NONNULLARG2 */

/* suit_simple_name has its code in a NULL arg test
   conditional block, preventing NONNULLARG1 */

/* cloak_simple_name has its code in a NULL arg test
   conditional block, preventing NONNULLARG1 */

/* helm_simple_name always just returns hardcoded literals */

/* gloves_simple_name has its code in a NULL arg test
   conditional block, preventing NONNULLARG1 */

/* boots_simple_name has its code in a NULL arg test
   conditional block, preventing NONNULLARG1 */

/* shield_simple_name has its code in a NULL arg test
   conditional block, preventing NONNULLARG1 */

/* shirt_simple_name always just returns hardcoded "shirt" */

/* safe_qbuf() contains tests for NULL arg2 and arg3, qprefix and qsuffix,
   preventing use of NONNULLPTRS. */

/* ### options.c ### */

/* ### pager.c ### */

/*might return NULL*/

/* ### xxmain.c ### */

/* ### pcsys.c, windsys.c ### */

export const nethack_exit = exit;

/* ### pcsys.c  ### */

/* E FILE *fopenp(const char *, const char *); */

/* ### pctty.c ### */

/* ### pcunix.c ### */

/* ### pickup.c ### */

/* reset_justpicked() is sometimes passed gi.invent
 * which can be null */

/* sometimes count_justpicked(gi.invent) which can be null */

/* sometimes find_justpicked(gi.invent) which can be null */

/* dotypeinv() call query_objlist with NULL arg1 */

/* ### pline.c ### */

/* ### polyself.c ### */

/* ### potion.c ### */

/* altdip */

/* ### pray.c ### */

/* ### priest.c ### */

/* ### quest.c ### */

/* ### questpgr.c ### */

/* ### random.c ### */

/* ### read.c ### */

/* ### rect.c ### */

/* ## region.c ### */

/* ### report.c ### */

/* ### restore.c ### */

/* extern void reset_restpref(void); */
/* extern void set_restpref(const char *); */
/* extern void set_savepref(const char *); */

/* ### rip.c ### */

/* ### rnd.c ### */

/* Deterministic qsort wrapper. */

/* ### role.c ### */

/* ### rumors.c ### */

/* ### save.c ### */

/* extern genericptr_t mon_to_buffer(struct monst *, int *); */

/* ### selvar.c ### */

/* ### sfstruct.c ### */

/* extern void newread(NHFILE *, int, int, genericptr_t, unsigned); */

/* ### shk.c ### */

/* setpaid() has a conditional code block near the end of the
   function, where arg1 is tested for NULL, preventing NONNULLARG1 */

/* costly_adjacent() has checks for null 1st arg, and an early return,
   so it cannot be NONNULLARG1 */

/*extern void globby_donation(struct obj *, struct obj *); */

/* ### shknam.c ### */

/* ### sit.c ### */

/* ### sounds.c ### */

/* ### sp_lev.c ### */

/* wiz_load_splua NULL */
/* lspo_finalize_level() has tests for whether arg1 L is null, and chooses
   code paths to follow based on that. Also preventing NONNULLARG1 is it
   being called from wiz_load_splua() with a NULL arg.
   Side note: The parameter is also marked as UNUSED, but apparently it is */

/* ### spell.c ### */

/* ### stairs.c ### */

/* ### steal.c ### */

/* mpickobj() contains a test for NULL arg2 obj and a code path
   that leads to impossible(). Prevents NONNULLARG12. */

/* ### steed.c ### */

/* ### symbols.c ### */

/* ### sys.c ### */

/* ### teleport.c ### */

/* rloc_engr() passes NULL monst arg to goodpos()*/

/* ### timeout.c ### */

/* ### topten.c ### */

/* ### track.c ### */

/* ### trap.c ### */

/* revisit */

/* acid_damage() has a test for NULL arg and early return if so,
   preventing NONNULLARG1 */

/* ### u_init.c ### */

/* ### uhitm.c ### */

/* gazemm() calls mhitm_ad_blnd with a NULL 4th arg */

/* domove_fight_empty passes NULL to explum arg1 */

/* ### unixmain.c ### */

/* ### unixtty.c ### */

/* ### unixunix.c ### */

/* ### unixres.c ### */

/* ### utf8map.c ### */

/* ### vault.c ### */

/* NULL leads to impossible() */

/* ### version.c ### */

/* ### video.c ### */

/* ### vision.c ### */

/* ### vmsfiles.c ### */

/* ### vmsmail.c ### */

/* ### vmsmain.c ### */

/* ### vmsmisc.c ### */

/* ### vmstty.c ### */

/* ### vmsunix.c ### */

/* ### weapon.c ### */

/* find_roll_to_hit() calls weapon_hit_bonus() with a NULL argument,
   preventing NONNULLARG1 */

/* ### were.c ### */

/* ### wield.c ### */

/* NULL:ball.c, do.c */

/* NULL:ball.c, do.c */
/* NULL: ball.c, do.c */

/* ### windows.c ### */

/* ### windsys.c ### */

/* ### wizard.c ### */

/* ### wizcmds.c ### */

/* ### worm.c ### */

/* NULL leads to impossible */

/* ### worn.c ### */

/* has tests for obj */
/* has tests for obj */

/* callers don't check gi.invent before passing to bypass_objlist */

/* ### write.c ### */

/* ### zap.c ### */

/* tests !obj */

/* ### unixmain.c, windsys.c ### */

/*extern.h*/

import { exit } from "../rt/libc.js";
