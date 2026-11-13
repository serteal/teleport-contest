export function wizard() { return flags.debug; }

export function discover() { return flags.explore; }

/* Use notice_mon_off() / notice_mon_on() to temporarily disable
   noticing the monsters in the vision code - perhaps the game
   needs to output some other messages in between.
   Call notice_all_mons() afterwards to catch up. */
export function notice_mon_off() { do { a11y.mon_notices_blocked++; } while(0) }
export function notice_mon_on() { do { if (--a11y.mon_notices_blocked < 0) {
            impossible(_("mon_notices_blocked<0"));
            a11y.mon_notices_blocked = 0;
        } } while(0) }

/* paranoid confirmation prompting */
/* any yes confirmations also require explicit no (or ESC) to reject */
export function ParanoidConfirm() { return +((flags.paranoia_bits & PARANOID_CONFIRM) != 0); }
/* quit: yes vs y for "Really quit?" and "Enter explore mode?" */
export function ParanoidQuit() { return +((flags.paranoia_bits & PARANOID_QUIT) != 0); }
/* die: yes vs y for "Die?" (dying in explore mode or wizard mode) */
export function ParanoidDie() { return +((flags.paranoia_bits & PARANOID_DIE) != 0); }
/* hit: yes vs y for "Save bones?" in wizard mode */
export function ParanoidBones() { return +((flags.paranoia_bits & PARANOID_BONES) != 0); }
/* hit: yes vs y for "Really attack <the peaceful monster>?" */
export function ParanoidHit() { return +((flags.paranoia_bits & PARANOID_HIT) != 0); }
/* pray: ask "Really pray?" (accepts y answer, doesn't require yes),
   taking over for the old prayconfirm boolean option */
export function ParanoidPray() { return +((flags.paranoia_bits & PARANOID_PRAY) != 0); }
/* remove: remove ('R') and takeoff ('T') commands prompt for an inventory
   item even when only one accessory or piece of armor is currently worn */
export function ParanoidRemove() { return +((flags.paranoia_bits & PARANOID_REMOVE) != 0); }
/* breakwand: Applying a wand */
export function ParanoidBreakwand() { return +((flags.paranoia_bits & PARANOID_BREAKWAND) != 0); }
/* werechange: accepting randomly timed werecreature change to transform
   from human to creature or vice versa while having polymorph control */
export function ParanoidWerechange() { return +((flags.paranoia_bits & PARANOID_WERECHANGE) != 0); }
/* continue eating: prompt given _after_first_bite_ when eating something
   while satiated */
export function ParanoidEating() { return +((flags.paranoia_bits & PARANOID_EATING) != 0); }
/* Prevent going into lava or water without explicitly forcing it */
export function ParanoidSwim() { return +((flags.paranoia_bits & PARANOID_SWIM) != 0); }
/* Prevent going onto/into known trap unless it is harmless */
export function ParanoidTrap() { return +((flags.paranoia_bits & PARANOID_TRAP) != 0); }
/* Require confirmation for choosing 'A' in class menu for menustyle:Full */
export function ParanoidAutoAll() { return +((flags.paranoia_bits & PARANOID_AUTOALL) != 0); }

import {
    PARANOID_AUTOALL, PARANOID_BONES, PARANOID_BREAKWAND, PARANOID_CONFIRM, PARANOID_DIE,
    PARANOID_EATING, PARANOID_HIT, PARANOID_PRAY, PARANOID_QUIT, PARANOID_REMOVE, PARANOID_SWIM,
    PARANOID_TRAP, PARANOID_WERECHANGE,
} from "./flag.h.js";
import { _ } from "../rt/strings.js";
import { a11y, flags } from "./decl.js";
import { impossible } from "./pline.js";
