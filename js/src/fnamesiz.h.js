/* NetHack 5.0	fnamesiz.h	$NHDT-Date: 1580310580 2020/01/29 15:09:40 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $ */
/*-Copyright (c) Michael Allison, 2020. */
/* NetHack may be freely redistributed.  See license for details. */

/*
 *  Declarations for some file name sizes, some of which need to be shared
 *  between NetHack and recover. By placing them in here, there is less
 *  chance of deviation between the two.
 */

export const LOCKNAMESIZE = (PL_NSIZ + 14);
export const LOCKNAMEINIT = "1lock";
export const BONESINIT = "bonesnn.xxx.le";
export const BONESSIZE = sizeof_string(BONESINIT);

export const INDEXT = ".xxxxxx";
export const INDSIZE = sizeof_string(INDEXT);

export const SAVEX = "save/99999.e";

export const SAVE_EXTENSION = "";

export const SAVESIZE = (PL_NSIZ + sizeof_string(SAVEX) + sizeof_string(SAVE_EXTENSION) + INDSIZE);

import { PL_NSIZ } from "./global.h.js";
import { sizeof_string } from "../rt/ctypes.js";
