/* NetHack 5.0	artifact.h	$NHDT-Date: 1602692711 2020/10/14 16:25:11 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.15 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2011. */
/* NetHack may be freely redistributed.  See license for details. */

/* clang-format off */

export const SPFX_NOGEN = 0x00000001;
export const SPFX_RESTR = 0x00000002;
export const SPFX_INTEL = 0x00000004;
export const SPFX_SPEAK = 0x00000008;
export const SPFX_SEEK = 0x00000010;
export const SPFX_WARN = 0x00000020;
export const SPFX_ATTK = 0x00000040;
export const SPFX_DEFN = 0x00000080;
export const SPFX_DRLI = 0x00000100;
export const SPFX_SEARCH = 0x00000200;
export const SPFX_BEHEAD = 0x00000400;
export const SPFX_HALRES = 0x00000800;
export const SPFX_ESP = 0x00001000;
export const SPFX_STLTH = 0x00002000;
export const SPFX_REGEN = 0x00004000;
export const SPFX_EREGEN = 0x00008000;
export const SPFX_HSPDAM = 0x00010000;
export const SPFX_HPHDAM = 0x00020000;
export const SPFX_TCTRL = 0x00040000;
export const SPFX_LUCK = 0x00080000;
export const SPFX_DMONS = 0x00100000;
export const SPFX_DCLAS = 0x00200000;
export const SPFX_DFLAG1 = 0x00400000;
export const SPFX_DFLAG2 = 0x00800000;
export const SPFX_DALIGN = 0x01000000;
export const SPFX_DBONUS = 0x01F00000;
export const SPFX_XRAY = 0x02000000;
export const SPFX_REFLECT = 0x04000000;
export const SPFX_PROTECT = 0x08000000;

export const struct_artifact = struct("struct_artifact", {
    otyp: short,
    name: ptr_to(char),
    spfx: ulong, /* special effect from wielding/wearing */
    cspfx: ulong, /* special effect just from carrying obj */
    mtype: ulong, /* monster type, symbol, or flag */
    attk: "struct_attack", defn: "struct_attack", cary: "struct_attack",
    inv_prop: uchar, /* property obtained by invoking artifact */
    alignment: aligntyp, /* alignment of bequeathing gods */
    role: short, /* character role associated with */
    race: short, /* character race associated with */
    gen_spe: schar, /* bias to spe when gifted or randomly generated */
    gift_value: uchar, /* minimum sacrifice value to be gifted this */
    cost: long, /* price when sold to hero (default 100 x base cost) */
    acolor: char, /* color to use if artifact 'glows' */
});

/* invoked properties with special powers */

    export const TAMING = (LAST_PROP + 1);
    export const HEALING = TAMING + 1;
    export const ENERGY_BOOST = HEALING + 1;
    export const UNTRAP = ENERGY_BOOST + 1;
    export const CHARGE_OBJ = UNTRAP + 1;
    export const LEV_TELE = CHARGE_OBJ + 1;
    export const CREATE_PORTAL = LEV_TELE + 1;
    export const ENLIGHTENING = CREATE_PORTAL + 1;
    export const CREATE_AMMO = ENLIGHTENING + 1;
    export const BANISH = CREATE_AMMO + 1;
    export const FLING_POISON = BANISH + 1;
    export const FIRESTORM = FLING_POISON + 1;
    export const SNOWSTORM = FIRESTORM + 1;
    export const BLINDING_RAY = SNOWSTORM + 1;

/* artifact tracking; gift and wish imply found; it also gets set for items
   seen on the floor, in containers, and wielded or dropped by monsters */
export const struct_arti_info = struct("struct_arti_info", {
    exists: Bitfield(1), /* 1 if corresponding artifact has been created */
    found: Bitfield(1), /* 1 if artifact is known by hero to exist */
    gift: Bitfield(1), /* 1 iff artifact was created as a prayer reward */
    wish: Bitfield(1), /* 1 iff artifact was created via wish */
    named: Bitfield(1), /* 1 iff artifact was made by naming an item */
    viadip: Bitfield(1), /* 1 iff dipped long sword became Excalibur */
    lvldef: Bitfield(1), /* 1 iff created by special level definition */
    bones: Bitfield(1), /* 1 iff came from bones file */
    rndm: Bitfield(1), /* 1 iff randomly generated */
});

/* clang-format on */

import { aligntyp } from "./align.h.js";
import { LAST_PROP } from "./prop.h.js";
import { char, long, schar, short, uchar, ulong } from "../rt/ctypes.js";
import { Bitfield, ptr_to, struct } from "../rt/struct.js";
