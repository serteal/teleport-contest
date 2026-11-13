/* NetHack 5.0	dlb.h	$NHDT-Date: 1596498534 2020/08/03 23:48:54 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.12 $ */
/* Copyright (c) Kenneth Lorber, Bethesda, Maryland, 1993. */
/* NetHack may be freely redistributed.  See license for details. */

/* definitions for data library */

/* implementations */

/* directory structure in memory */

    /* file name as seen from calling code */
    /* offset in lib file to start of this file */
    /* file size */
    /* how to handle the file (compression, etc) */

/* information about each open library */

    /* opened data file */
    /* current file mark */
    /* directory of library file */
    /* pointer to string space */
    /* # of files in directory */
    /* dlb file revision */
    /* dlb file string size */

/* library definitions */

    /* pointer to an external file, use if non-null */

    /* pointer to library structure */
    /* offset of start of file */
    /* size of file */
    /* current file marker */

    /* HandleFile file descriptor */

/* buggy old Ultrix compiler wants this for the (*dlb_fread_proc)
   and (*dlb_fgets_proc) prototypes in struct dlb_procs (dlb.c);
   we'll use it in all the declarations for consistency */

/* Resource DLB entry points */

export const dlb_fopen = fopen;
export const dlb_fclose = fclose;
export const dlb_fread = fread;
export const dlb_fseek = fseek;
export const dlb_fgets = fgets;

export const dlb_ftell = ftell;

import { fclose, fgets, fopen, fread, fseek, ftell } from "../rt/libc.js";
