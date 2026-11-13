export function MGIVENNAME(mon) { return mon.mextra.mgivenname; }
export function EGD(mon) { return mon.mextra.egd; }
export function EPRI(mon) { return mon.mextra.epri; }
export function ESHK(mon) { return mon.mextra.eshk; }
export function EMIN(mon) { return mon.mextra.emin; }
export function EDOG(mon) { return mon.mextra.edog; }
export function EBONES(mon) { return mon.mextra.ebones; }
export function MCORPSENM(mon) { return mon.mextra.mcorpsenm; }

export function has_mgivenname(mon) { return (mon.mextra && MGIVENNAME(mon) ? 1 : 0); }
export function has_egd(mon) { return (mon.mextra && EGD(mon) ? 1 : 0); }
export function has_epri(mon) { return (mon.mextra && EPRI(mon) ? 1 : 0); }
export function has_eshk(mon) { return (mon.mextra && ESHK(mon) ? 1 : 0); }
export function has_emin(mon) { return (mon.mextra && EMIN(mon) ? 1 : 0); }
export function has_edog(mon) { return (mon.mextra && EDOG(mon) ? 1 : 0); }
export function has_ebones(mon) { return (mon.mextra && EBONES(mon) ? 1 : 0); }
export function has_mcorpsenm(mon) { return (mon.mextra && MCORPSENM(mon) != NON_PM ? 1 : 0); }

import { NON_PM } from "./monsters.h.js";
