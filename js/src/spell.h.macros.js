export function decrnknow(spell) { return svs.spl_book[spell].sp_know--; }
export function spellid(spell) { return svs.spl_book[spell].sp_id; }
export function spellknow(spell) { return svs.spl_book[spell].sp_know; }

/* how much Pw a spell of level lvl costs to cast? */
export function SPELL_LEV_PW(lvl) { return (lvl * 5); }

import { svs } from "./decl.js";
