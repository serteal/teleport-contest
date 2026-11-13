/*
 * Possible additional conditions:
 *  major:
 *      grab   - grabbed by eel so about to be drowned ("wrapd"? damage type
 *               is AD_WRAP but message is "<mon> swings itself around you")
 *      digst  - swallowed and being digested
 *      lava   - trapped sinking into lava
 *  in_between: (potentially severe but don't necessarily lead to death;
 *               explains to player why he isn't getting to take any turns)
 *      unconc - unconscious
 *      parlyz - (multi < 0 && (!strncmp(multi_reason, "paralyzed", 9)
 *                              || !strncmp(multi_reason, "frozen", 6)))
 *      asleep - (multi < 0 && !strncmp(multi_reason, "sleeping", 8))
 *      busy   - other multi < 0
 *  minor:
 *      held   - grabbed by non-eel or by eel but not susceptible to drowning
 *      englf  - engulfed or swallowed but not being digested (usually
 *               obvious but the blank symbol set makes that uncertain)
 *      vomit  - vomiting (causes confusion and stun late in countdown)
 *      trap   - trapped in pit, bear trap, web, or floor (solidified lava)
 *      teth   - tethered to buried iron ball
 *      chain  - punished
 *      slip   - slippery fingers
 *      ice    - standing on ice (movement becomes uncertain)
 *     [underwater - movement uncertain, vision truncated, equipment at risk]
 *  other:
 *     [hold      - poly'd into grabber and holding adjacent monster]
 *      Stormbringer - wielded weapon poses risks
 *      Cleaver   - wielded weapon risks unintended consequences
 *      barehand  - not wielding any weapon nor wearing gloves
 *      no-weapon - not wielding any weapon
 *      bow/xbow/sling - wielding a missile launcher of specified type
 *      pole      - wielding a polearm
 *      pick      - wielding a pickaxe
 *      junk      - wielding non-weapon, non-weptool
 *      naked     - no armor
 *      no-gloves - self-explanatory
 *      no-cloak  - ditto
 *     [no-{other armor slots?} - probably much too verbose]
 *  conduct?
 *      [maybe if third status line is added]
 *
 *  Can't add all of these and probably don't want to.  But maybe we
 *  can add some of them and it's not as many as first appears:
 *  lava/trap/teth are mutually exclusive;
 *  digst/grab/englf/held/hold are also mutually exclusive;
 *  Stormbringer/Cleaver/barehand/no-weapon/bow&c/pole/pick/junk too;
 *  naked/no-{any armor slot} likewise.
 */

export function VIA_WINDOWPORT() { return +((windowprocs.wincap2 & (WC2_HILITE_STATUS | WC2_FLUSH_STATUS)) != 0); }

import { WC2_FLUSH_STATUS, WC2_HILITE_STATUS } from "./winprocs.h.js";
import { windowprocs } from "./windows.js";
