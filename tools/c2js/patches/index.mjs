// The port's changes to the NetHack sources, one module per file.
//
// Each module exports { file, patches }: `file` is relative to the source tree and every patch
// is { why, edits }, `why` saying in one line what the patch changes in the game and `edits`
// being the { find, replace } replacements that make the change (tools/c2js/apply-patches.mjs).
// They apply to pristine sources (nethack-c/upstream plus nethack-c/patches).

import allmain from "./allmain.c.mjs";
import calendar from "./calendar.c.mjs";
import cmd from "./cmd.c.mjs";
import config from "./config.h.mjs";
import eat from "./eat.c.mjs";
import mdlib from "./mdlib.c.mjs";
import options from "./options.c.mjs";
import optlist from "./optlist.h.mjs";
import posixregex from "./posixregex.c.mjs";
import termcap from "./termcap.c.mjs";
import unixconf from "./unixconf.h.mjs";
import wintty from "./wintty.c.mjs";

export const portPatches = [
  config,
  optlist,
  unixconf,
  allmain,
  calendar,
  cmd,
  eat,
  mdlib,
  options,
  posixregex,
  termcap,
  wintty,
];
