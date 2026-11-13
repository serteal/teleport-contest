/* These roles qualify for a martial arts bonus */
export function martial_bonus() { return +(Role_if(PM_SAMURAI) || Role_if(PM_MONK)); }

export function practice_needed_to_advance(level) { return (level * level *20); }

export function P_SKILL(type) { return (u.weapon_skills[type].skill); }
export function P_MAX_SKILL(type) { return (elt(u.weapon_skills, type).max_skill); }
export function P_ADVANCE(type) { return (u.weapon_skills[type].advance); }
export function P_RESTRICTED(type) { return +(u.weapon_skills[type].skill == P_ISRESTRICTED); }

import { PM_MONK, PM_SAMURAI } from "./monsters.h.js";
import { P_ISRESTRICTED } from "./skills.h.js";
import { Role_if } from "./you.h.macros.js";
import { elt } from "../rt/struct.js";
import { u } from "./decl.js";
