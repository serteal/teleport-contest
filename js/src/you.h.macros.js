/* table of available roles */
export function Role_if(X) { return +(gu.urole.mnum == X); }
export function Role_switch() { return gu.urole.mnum; }

/* Table of available races */
export function Race_if(X) { return +(gu.urace.mnum == X); }
export function Race_switch() { return gu.urace.mnum; }

/* table of available genders */
/* pronouns for the hero */

export function uhim() { return (genders[flags.female ? 1 : 0].him); }
export function uhis() { return (genders[flags.female ? 1 : 0].his); }

/* corresponding pronouns for monsters; yields "it" when mtmp can't be seen */
export function mhe(mtmp) { return (genders[pronoun_gender(mtmp, PRONOUN_HALLU)].he); }
export function mhim(mtmp) { return (genders[pronoun_gender(mtmp, PRONOUN_HALLU)].him); }
export function mhis(mtmp) { return (genders[pronoun_gender(mtmp, PRONOUN_HALLU)].his); }
/* override "it" if reason is lack of visibility rather than neuter species */
export function noit_mhe(mtmp) { return (genders[pronoun_gender(mtmp, (PRONOUN_NO_IT | PRONOUN_HALLU))].he); }

export function noit_mhim(mtmp) { return (genders[pronoun_gender(mtmp, (PRONOUN_NO_IT | PRONOUN_HALLU))].him); }

export function noit_mhis(mtmp) { return (genders[pronoun_gender(mtmp, (PRONOUN_NO_IT | PRONOUN_HALLU))].his); }

    /* default u.uluck is 0 except on special days (full moon: +1, Fri 13: -1,
       both: 0); equilibrium for luck timeout is changed to those values,
       but Luck max and min stay at 10+3 and -10-3 even on those days */
export function Luck() { return (u.uluck + u.moreluck); }

export function Upolyd() { return +(u.umonnum != u.umonster); }
export function Ugender() { return ((Upolyd() ? u.mfemale : flags.female) ? 1 : 0); }

/* point px,py is adjacent to (or same location as) hero */
export function next2u(px, py) { return +(distu(px,py) <= 2); }
/* is monster on top of or next to hero? */
export function m_next2u(m) { return +(distu(m.mx,m.my) <= 2); }
/* hero at (x,y)? */
export function u_at(x, y) { return +(x == u.ux && y == u.uy); }

export function URIGHTY() { return +(u.uhandedness == RIGHT_HANDED); }
export function ULEFTY() { return +(u.uhandedness == LEFT_HANDED); }
export function RING_ON_PRIMARY() { return (ULEFTY() ? uleft : uright); }
export function RING_ON_SECONDARY() { return (ULEFTY() ? uright : uleft); }

import { distu } from "./hack.h.macros.js";
import { LEFT_HANDED, PRONOUN_HALLU, PRONOUN_NO_IT, RIGHT_HANDED } from "./you.h.js";
import { flags, gu, u } from "./decl.js";
import { pronoun_gender } from "./mondata.js";
import { genders } from "./role.js";
