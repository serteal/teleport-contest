/* NetHack 5.0	coloratt.c	$NHDT-Date: 1737286550 2025/01/19 03:35:50 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.14 $ */
/* Copyright (c) Pasi Kallinen, 2024 */
/* NetHack may be freely redistributed.  See license for details. */

const struct_color_names = struct("struct_color_names", {
    name: ptr_to(char),
    color: int,
});

const colornames = static_array("colornames", struct_color_names, null, [
    { name: _("black"), color: CLR_BLACK },
    { name: _("red"), color: CLR_RED },
    { name: _("green"), color: CLR_GREEN },
    { name: _("brown"), color: CLR_BROWN },
    { name: _("blue"), color: CLR_BLUE },
    { name: _("magenta"), color: CLR_MAGENTA },
    { name: _("cyan"), color: CLR_CYAN },
    { name: _("gray"), color: CLR_GRAY },
    { name: _("orange"), color: CLR_ORANGE },
    { name: _("light green"), color: CLR_BRIGHT_GREEN },
    { name: _("yellow"), color: CLR_YELLOW },
    { name: _("light blue"), color: CLR_BRIGHT_BLUE },
    { name: _("light magenta"), color: CLR_BRIGHT_MAGENTA },
    { name: _("light cyan"), color: CLR_BRIGHT_CYAN },
    { name: _("white"), color: CLR_WHITE },
    { name: _("no color"), color: NO_COLOR },
    { name: 0, color: CLR_BLACK }, /* everything after this is an alias */
    { name: _("transparent"), color: NO_COLOR },
    { name: _("purple"), color: CLR_MAGENTA },
    { name: _("light purple"), color: CLR_BRIGHT_MAGENTA },
    { name: _("bright purple"), color: CLR_BRIGHT_MAGENTA },
    { name: _("grey"), color: CLR_GRAY },
    { name: _("bright red"), color: CLR_ORANGE },
    { name: _("bright green"), color: CLR_BRIGHT_GREEN },
    { name: _("bright blue"), color: CLR_BRIGHT_BLUE },
    { name: _("bright magenta"), color: CLR_BRIGHT_MAGENTA },
    { name: _("bright cyan"), color: CLR_BRIGHT_CYAN }
]);

const struct_attr_names = struct("struct_attr_names", {
    name: ptr_to(char),
    attr: int,
});

const attrnames = static_array("attrnames", struct_attr_names, null, [
    { name: _("none"), attr: ATR_NONE },
    { name: _("bold"), attr: ATR_BOLD },
    { name: _("dim"), attr: ATR_DIM },
    { name: _("italic"), attr: ATR_ITALIC },
    { name: _("underline"), attr: ATR_ULINE },
    { name: _("blink"), attr: ATR_BLINK },
    { name: _("inverse"), attr: ATR_INVERSE },
    { name: 0, attr: ATR_NONE }, /* everything after this is an alias */
    { name: _("normal"), attr: ATR_NONE },
    { name: _("uline"), attr: ATR_ULINE },
    { name: _("reverse"), attr: ATR_INVERSE },
]);

/* { colortyp, tableindex, rgbindx, name, r, g, b }, */

export const NHC = nh_color;
export const NOC = no_color;
export const RGBC = rgb_color;

export const colortable = static_array("colortable", struct_nethack_color, null, [
    { colortyp: NHC,    tableindex: 0,   rgbindex: 0, name: _("black"), r: 0x00, g: 0x00, b: 0x00 },      /*        CLR_BLACK */
    { colortyp: NHC,    tableindex: 1,   rgbindex: 0, name: _("red"), r: 0xFF, g: 0x00, b: 0x00 },        /*          CLR_RED */
    { colortyp: NHC,    tableindex: 2,   rgbindex: 0, name: _("green"), r: 0x22, g: 0x8B, b: 0x22 },      /*        CLR_GREEN */
    { colortyp: NHC,    tableindex: 3,   rgbindex: 0, name: _("brown"), r: 0xA5, g: 0x2A, b: 0x2A },      /*        CLR_BROWN */
    { colortyp: NHC,    tableindex: 4,   rgbindex: 0, name: _("blue"), r: 0x00, g: 0x00, b: 0xFF },       /*         CLR_BLUE */
    { colortyp: NHC,    tableindex: 5,   rgbindex: 0, name: _("magenta"), r: 0xFF, g: 0x00, b: 0xFF },    /*      CLR_MAGENTA */
    { colortyp: NHC,    tableindex: 6,   rgbindex: 0, name: _("cyan"), r: 0x00, g: 0xFF, b: 0xFF },       /*         CLR_CYAN */
    { colortyp: NHC,    tableindex: 7,   rgbindex: 0, name: _("gray"), r: 0x80, g: 0x80, b: 0x80 },       /*         CLR_GRAY */
    { colortyp: NOC,    tableindex: 8,   rgbindex: 0, name: _("nocolor"), r: 0x00, g: 0x00, b: 0x00 },    /*         NO_COLOR */
    { colortyp: NHC,    tableindex: 9,   rgbindex: 0, name: _("orange"), r: 0xFF, g: 0xA5, b: 0x00 },     /*       CLR_ORANGE */
    { colortyp: NHC,   tableindex: 10,   rgbindex: 0, name: _("bright-green"),
                      r: 0x00, g: 0x80, b: 0x00 },               /* CLR_BRIGHT_GREEN */
    { colortyp: NHC,   tableindex: 11,   rgbindex: 0, name: _("yellow"), r: 0xFF, g: 0xFF, b: 0x00 },     /*       CLR_YELLOW */
    { colortyp: NHC,   tableindex: 12,   rgbindex: 0, name: _("bright-blue"), r: 0xAD, g: 0xD8, b: 0xE6 }, /* CLR_BRIGHT_BLUE */
    { colortyp: NHC,   tableindex: 13,   rgbindex: 0, name: _("bright-magenta"),
                      r: 0x93, g: 0x70, b: 0xDB },             /* CLR_BRIGHT_MAGENTA */
    { colortyp: NHC,   tableindex: 14,   rgbindex: 0, name: _("light-cyan"), r: 0xE0, g: 0xFF, b: 0xFF }, /*  CLR_BRIGHT_CYAN */
    { colortyp: NHC,   tableindex: 15,   rgbindex: 0, name: _("white"), r: 0xFF, g: 0xFF, b: 0xFF },      /*        CLR_WHITE */
    { colortyp: RGBC,  tableindex: 16,   rgbindex: 0, name: _("maroon"), r: 0x80, g: 0x00, b: 0x00 },              /* #800000 */
    { colortyp: RGBC,  tableindex: 17,   rgbindex: 1, name: _("dark-red"), r: 0x8B, g: 0x00, b: 0x00 },            /* #8B0000 */
    { colortyp: RGBC,  tableindex: 18,   rgbindex: 2, name: _("brown"), r: 0xA5, g: 0x2A, b: 0x2A },               /* #A52A2A */
    { colortyp: RGBC,  tableindex: 19,   rgbindex: 3, name: _("firebrick"), r: 0xB2, g: 0x22, b: 0x22 },           /* #B22222 */
    { colortyp: RGBC,  tableindex: 20,   rgbindex: 4, name: _("crimson"), r: 0xDC, g: 0x14, b: 0x3C },             /* #DC143C */
    { colortyp: RGBC,  tableindex: 21,   rgbindex: 5, name: _("red"), r: 0xFF, g: 0x00, b: 0x00 },                 /* #FF0000 */
    { colortyp: RGBC,  tableindex: 22,   rgbindex: 6, name: _("tomato"), r: 0xFF, g: 0x63, b: 0x47 },              /* #FF6347 */
    { colortyp: RGBC,  tableindex: 23,   rgbindex: 7, name: _("coral"), r: 0xFF, g: 0x7F, b: 0x50 },               /* #FF7F50 */
    { colortyp: RGBC,  tableindex: 24,   rgbindex: 8, name: _("indian-red"), r: 0xCD, g: 0x5C, b: 0x5C },          /* #CD5C5C */
    { colortyp: RGBC,  tableindex: 25,   rgbindex: 9, name: _("light-coral"), r: 0xF0, g: 0x80, b: 0x80 },         /* #F08080 */
    { colortyp: RGBC,  tableindex: 26,  rgbindex: 10, name: _("dark-salmon"), r: 0xE9, g: 0x96, b: 0x7A },         /* #E9967A */
    { colortyp: RGBC,  tableindex: 27,  rgbindex: 11, name: _("salmon"), r: 0xFA, g: 0x80, b: 0x72 },              /* #FA8072 */
    { colortyp: RGBC,  tableindex: 28,  rgbindex: 12, name: _("light-salmon"), r: 0xFF, g: 0xA0, b: 0x7A },        /* #FFA07A */
    { colortyp: RGBC,  tableindex: 29,  rgbindex: 13, name: _("orange-red"), r: 0xFF, g: 0x45, b: 0x00 },          /* #FF4500 */
    { colortyp: RGBC,  tableindex: 30,  rgbindex: 14, name: _("dark-orange"), r: 0xFF, g: 0x8C, b: 0x00 },         /* #FF8C00 */
    { colortyp: RGBC,  tableindex: 31,  rgbindex: 15, name: _("orange"), r: 0xFF, g: 0xA5, b: 0x00 },              /* #FFA500 */
    { colortyp: RGBC,  tableindex: 32,  rgbindex: 16, name: _("gold"), r: 0xFF, g: 0xD7, b: 0x00 },                /* #FFD700 */
    { colortyp: RGBC,  tableindex: 33,  rgbindex: 17, name: _("dark-golden-rod"), r: 0xB8, g: 0x86, b: 0x0B },     /* #B8860B */
    { colortyp: RGBC,  tableindex: 34,  rgbindex: 18, name: _("golden-rod"), r: 0xDA, g: 0xA5, b: 0x20 },          /* #DAA520 */
    { colortyp: RGBC,  tableindex: 35,  rgbindex: 19, name: _("pale-golden-rod"), r: 0xEE, g: 0xE8, b: 0xAA },     /* #EEE8AA */
    { colortyp: RGBC,  tableindex: 36,  rgbindex: 20, name: _("dark-khaki"), r: 0xBD, g: 0xB7, b: 0x6B },          /* #BDB76B */
    { colortyp: RGBC,  tableindex: 37,  rgbindex: 21, name: _("khaki"), r: 0xF0, g: 0xE6, b: 0x8C },               /* #F0E68C */
    { colortyp: RGBC,  tableindex: 38,  rgbindex: 22, name: _("olive"), r: 0x80, g: 0x80, b: 0x00 },               /* #808000 */
    { colortyp: RGBC,  tableindex: 39,  rgbindex: 23, name: _("yellow"), r: 0xFF, g: 0xFF, b: 0x00 },              /* #FFFF00 */
    { colortyp: RGBC,  tableindex: 40,  rgbindex: 24, name: _("yellow-green"), r: 0x9A, g: 0xCD, b: 0x32 },        /* #9ACD32 */
    { colortyp: RGBC,  tableindex: 41,  rgbindex: 25, name: _("dark-olive-green"), r: 0x55, g: 0x6B, b: 0x2F },    /* #556B2F */
    { colortyp: RGBC,  tableindex: 42,  rgbindex: 26, name: _("olive-drab"), r: 0x6B, g: 0x8E, b: 0x23 },          /* #6B8E23 */
    { colortyp: RGBC,  tableindex: 43,  rgbindex: 27, name: _("lawn-green"), r: 0x7C, g: 0xFC, b: 0x00 },          /* #7CFC00 */
    { colortyp: RGBC,  tableindex: 44,  rgbindex: 28, name: _("chart-reuse"), r: 0x7F, g: 0xFF, b: 0x00 },         /* #7FFF00 */
    { colortyp: RGBC,  tableindex: 45,  rgbindex: 29, name: _("green-yellow"), r: 0xAD, g: 0xFF, b: 0x2F },        /* #ADFF2F */
    { colortyp: RGBC,  tableindex: 46,  rgbindex: 30, name: _("dark-green"), r: 0x00, g: 0x64, b: 0x00 },          /* #006400 */
    { colortyp: RGBC,  tableindex: 47,  rgbindex: 31, name: _("green"), r: 0x00, g: 0x80, b: 0x00 },               /* #008000 */
    { colortyp: RGBC,  tableindex: 48,  rgbindex: 32, name: _("forest-green"), r: 0x22, g: 0x8B, b: 0x22 },        /* #228B22 */
    { colortyp: RGBC,  tableindex: 49,  rgbindex: 33, name: _("lime"), r: 0x00, g: 0xFF, b: 0x00 },                /* #00FF00 */
    { colortyp: RGBC,  tableindex: 50,  rgbindex: 34, name: _("lime-green"), r: 0x32, g: 0xCD, b: 0x32 },          /* #32CD32 */
    { colortyp: RGBC,  tableindex: 51,  rgbindex: 35, name: _("light-green"), r: 0x90, g: 0xEE, b: 0x90 },         /* #90EE90 */
    { colortyp: RGBC,  tableindex: 52,  rgbindex: 36, name: _("pale-green"), r: 0x98, g: 0xFB, b: 0x98 },          /* #98FB98 */
    { colortyp: RGBC,  tableindex: 53,  rgbindex: 37, name: _("dark-sea-green"), r: 0x8F, g: 0xBC, b: 0x8F },      /* #8FBC8F */
    { colortyp: RGBC,  tableindex: 54,  rgbindex: 38, name: _("medium-spring-green"), r: 0x00, g: 0xFA, b: 0x9A }, /* #00FA9A */
    { colortyp: RGBC,  tableindex: 55,  rgbindex: 39, name: _("spring-green"), r: 0x00, g: 0xFF, b: 0x7F },        /* #00FF7F */
    { colortyp: RGBC,  tableindex: 56,  rgbindex: 40, name: _("sea-green"), r: 0x2E, g: 0x8B, b: 0x57 },           /* #2E8B57 */
    { colortyp: RGBC,  tableindex: 57,  rgbindex: 41, name: _("medium-aqua-marine"), r: 0x66, g: 0xCD, b: 0xAA },  /* #66CDAA */
    { colortyp: RGBC,  tableindex: 58,  rgbindex: 42, name: _("medium-sea-green"), r: 0x3C, g: 0xB3, b: 0x71 },    /* #3CB371 */
    { colortyp: RGBC,  tableindex: 59,  rgbindex: 43, name: _("light-sea-green"), r: 0x20, g: 0xB2, b: 0xAA },     /* #20B2AA */
    { colortyp: RGBC,  tableindex: 60,  rgbindex: 44, name: _("dark-slate-gray"), r: 0x2F, g: 0x4F, b: 0x4F },     /* #2F4F4F */
    { colortyp: RGBC,  tableindex: 61,  rgbindex: 45, name: _("teal"), r: 0x00, g: 0x80, b: 0x80 },                /* #008080 */
    { colortyp: RGBC,  tableindex: 62,  rgbindex: 46, name: _("dark-cyan"), r: 0x00, g: 0x8B, b: 0x8B },           /* #008B8B */
    { colortyp: RGBC,  tableindex: 63,  rgbindex: 47, name: _("aqua"), r: 0x00, g: 0xFF, b: 0xFF },                /* #00FFFF */
    { colortyp: RGBC,  tableindex: 64,  rgbindex: 48, name: _("cyan"), r: 0x00, g: 0xFF, b: 0xFF },                /* #00FFFF */
    { colortyp: RGBC,  tableindex: 65,  rgbindex: 49, name: _("light-cyan"), r: 0xE0, g: 0xFF, b: 0xFF },          /* #E0FFFF */
    { colortyp: RGBC,  tableindex: 66,  rgbindex: 50, name: _("dark-turquoise"), r: 0x00, g: 0xCE, b: 0xD1 },      /* #00CED1 */
    { colortyp: RGBC,  tableindex: 67,  rgbindex: 51, name: _("turquoise"), r: 0x40, g: 0xE0, b: 0xD0 },           /* #40E0D0 */
    { colortyp: RGBC,  tableindex: 68,  rgbindex: 52, name: _("medium-turquoise"), r: 0x48, g: 0xD1, b: 0xCC },    /* #48D1CC */
    { colortyp: RGBC,  tableindex: 69,  rgbindex: 53, name: _("pale-turquoise"), r: 0xAF, g: 0xEE, b: 0xEE },      /* #AFEEEE */
    { colortyp: RGBC,  tableindex: 70,  rgbindex: 54, name: _("aqua-marine"), r: 0x7F, g: 0xFF, b: 0xD4 },         /* #7FFFD4 */
    { colortyp: RGBC,  tableindex: 71,  rgbindex: 55, name: _("powder-blue"), r: 0xB0, g: 0xE0, b: 0xE6 },         /* #B0E0E6 */
    { colortyp: RGBC,  tableindex: 72,  rgbindex: 56, name: _("cadet-blue"), r: 0x5F, g: 0x9E, b: 0xA0 },          /* #5F9EA0 */
    { colortyp: RGBC,  tableindex: 73,  rgbindex: 57, name: _("steel-blue"), r: 0x46, g: 0x82, b: 0xB4 },          /* #4682B4 */
    { colortyp: RGBC,  tableindex: 74,  rgbindex: 58, name: _("corn-flower-blue"), r: 0x64, g: 0x95, b: 0xED },    /* #6495ED */
    { colortyp: RGBC,  tableindex: 75,  rgbindex: 59, name: _("deep-sky-blue"), r: 0x00, g: 0xBF, b: 0xFF },       /* #00BFFF */
    { colortyp: RGBC,  tableindex: 76,  rgbindex: 60, name: _("dodger-blue"), r: 0x1E, g: 0x90, b: 0xFF },         /* #1E90FF */
    { colortyp: RGBC,  tableindex: 77,  rgbindex: 61, name: _("light-blue"), r: 0xAD, g: 0xD8, b: 0xE6 },          /* #ADD8E6 */
    { colortyp: RGBC,  tableindex: 78,  rgbindex: 62, name: _("sky-blue"), r: 0x87, g: 0xCE, b: 0xEB },            /* #87CEEB */
    { colortyp: RGBC,  tableindex: 79,  rgbindex: 63, name: _("light-sky-blue"), r: 0x87, g: 0xCE, b: 0xFA },      /* #87CEFA */
    { colortyp: RGBC,  tableindex: 80,  rgbindex: 64, name: _("midnight-blue"), r: 0x19, g: 0x19, b: 0x70 },       /* #191970 */
    { colortyp: RGBC,  tableindex: 81,  rgbindex: 65, name: _("navy"), r: 0x00, g: 0x00, b: 0x80 },                /* #000080 */
    { colortyp: RGBC,  tableindex: 82,  rgbindex: 66, name: _("dark-blue"), r: 0x00, g: 0x00, b: 0x8B },           /* #00008B */
    { colortyp: RGBC,  tableindex: 83,  rgbindex: 67, name: _("medium-blue"), r: 0x00, g: 0x00, b: 0xCD },         /* #0000CD */
    { colortyp: RGBC,  tableindex: 84,  rgbindex: 68, name: _("blue"), r: 0x00, g: 0x00, b: 0xFF },                /* #0000FF */
    { colortyp: RGBC,  tableindex: 85,  rgbindex: 69, name: _("royal-blue"), r: 0x41, g: 0x69, b: 0xE1 },          /* #4169E1 */
    { colortyp: RGBC,  tableindex: 86,  rgbindex: 70, name: _("blue-violet"), r: 0x8A, g: 0x2B, b: 0xE2 },         /* #8A2BE2 */
    { colortyp: RGBC,  tableindex: 87,  rgbindex: 71, name: _("indigo"), r: 0x4B, g: 0x00, b: 0x82 },              /* #4B0082 */
    { colortyp: RGBC,  tableindex: 88,  rgbindex: 72, name: _("dark-slate-blue"), r: 0x48, g: 0x3D, b: 0x8B },     /* #483D8B */
    { colortyp: RGBC,  tableindex: 89,  rgbindex: 73, name: _("slate-blue"), r: 0x6A, g: 0x5A, b: 0xCD },          /* #6A5ACD */
    { colortyp: RGBC,  tableindex: 90,  rgbindex: 74, name: _("medium-slate-blue"), r: 0x7B, g: 0x68, b: 0xEE },   /* #7B68EE */
    { colortyp: RGBC,  tableindex: 91,  rgbindex: 75, name: _("medium-purple"), r: 0x93, g: 0x70, b: 0xDB },       /* #9370DB */
    { colortyp: RGBC,  tableindex: 92,  rgbindex: 76, name: _("dark-magenta"), r: 0x8B, g: 0x00, b: 0x8B },        /* #8B008B */
    { colortyp: RGBC,  tableindex: 93,  rgbindex: 77, name: _("dark-violet"), r: 0x94, g: 0x00, b: 0xD3 },         /* #9400D3 */
    { colortyp: RGBC,  tableindex: 94,  rgbindex: 78, name: _("dark-orchid"), r: 0x99, g: 0x32, b: 0xCC },         /* #9932CC */
    { colortyp: RGBC,  tableindex: 95,  rgbindex: 79, name: _("medium-orchid"), r: 0xBA, g: 0x55, b: 0xD3 },       /* #BA55D3 */
    { colortyp: RGBC,  tableindex: 96,  rgbindex: 80, name: _("purple"), r: 0x80, g: 0x00, b: 0x80 },              /* #800080 */
    { colortyp: RGBC,  tableindex: 97,  rgbindex: 81, name: _("thistle"), r: 0xD8, g: 0xBF, b: 0xD8 },             /* #D8BFD8 */
    { colortyp: RGBC,  tableindex: 98,  rgbindex: 82, name: _("plum"), r: 0xDD, g: 0xA0, b: 0xDD },                /* #DDA0DD */
    { colortyp: RGBC,  tableindex: 99,  rgbindex: 83, name: _("violet"), r: 0xEE, g: 0x82, b: 0xEE },              /* #EE82EE */
    { colortyp: RGBC, tableindex: 100,  rgbindex: 84, name: _("magenta"), r: 0xFF, g: 0x00, b: 0xFF },             /* #FF00FF */
    { colortyp: RGBC, tableindex: 101,  rgbindex: 85, name: _("orchid"), r: 0xDA, g: 0x70, b: 0xD6 },              /* #DA70D6 */
    { colortyp: RGBC, tableindex: 102,  rgbindex: 86, name: _("medium-violet-red"), r: 0xC7, g: 0x15, b: 0x85 },   /* #C71585 */
    { colortyp: RGBC, tableindex: 103,  rgbindex: 87, name: _("pale-violet-red"), r: 0xDB, g: 0x70, b: 0x93 },     /* #DB7093 */
    { colortyp: RGBC, tableindex: 104,  rgbindex: 88, name: _("deep-pink"), r: 0xFF, g: 0x14, b: 0x93 },           /* #FF1493 */
    { colortyp: RGBC, tableindex: 105,  rgbindex: 89, name: _("hot-pink"), r: 0xFF, g: 0x69, b: 0xB4 },            /* #FF69B4 */
    { colortyp: RGBC, tableindex: 106,  rgbindex: 90, name: _("light-pink"), r: 0xFF, g: 0xB6, b: 0xC1 },          /* #FFB6C1 */
    { colortyp: RGBC, tableindex: 107,  rgbindex: 91, name: _("pink"), r: 0xFF, g: 0xC0, b: 0xCB },                /* #FFC0CB */
    { colortyp: RGBC, tableindex: 108,  rgbindex: 92, name: _("antique-white"), r: 0xFA, g: 0xEB, b: 0xD7 },       /* #FAEBD7 */
    { colortyp: RGBC, tableindex: 109,  rgbindex: 93, name: _("beige"), r: 0xF5, g: 0xF5, b: 0xDC },               /* #F5F5DC */
    { colortyp: RGBC, tableindex: 110,  rgbindex: 94, name: _("bisque"), r: 0xFF, g: 0xE4, b: 0xC4 },              /* #FFE4C4 */
    { colortyp: RGBC, tableindex: 111,  rgbindex: 95, name: _("blanched-almond"), r: 0xFF, g: 0xEB, b: 0xCD },     /* #FFEBCD */
    { colortyp: RGBC, tableindex: 112,  rgbindex: 96, name: _("wheat"), r: 0xF5, g: 0xDE, b: 0xB3 },               /* #F5DEB3 */
    { colortyp: RGBC, tableindex: 113,  rgbindex: 97, name: _("corn-silk"), r: 0xFF, g: 0xF8, b: 0xDC },           /* #FFF8DC */
    { colortyp: RGBC, tableindex: 114,  rgbindex: 98, name: _("lemon-chiffon"), r: 0xFF, g: 0xFA, b: 0xCD },       /* #FFFACD */
    { colortyp: RGBC, tableindex: 115,  rgbindex: 99, name: _("light-golden-rod-yellow"),
                      r: 0xFA, g: 0xFA, b: 0xD2 },                        /* #FAFAD2 */
    { colortyp: RGBC, tableindex: 116, rgbindex: 100, name: _("light-yellow"), r: 0xFF, g: 0xFF, b: 0xE0 },        /* #FFFFE0 */
    { colortyp: RGBC, tableindex: 117, rgbindex: 101, name: _("saddle-brown"), r: 0x8B, g: 0x45, b: 0x13 },        /* #8B4513 */
    { colortyp: RGBC, tableindex: 118, rgbindex: 102, name: _("sienna"), r: 0xA0, g: 0x52, b: 0x2D },              /* #A0522D */
    { colortyp: RGBC, tableindex: 119, rgbindex: 103, name: _("chocolate"), r: 0xD2, g: 0x69, b: 0x1E },           /* #D2691E */
    { colortyp: RGBC, tableindex: 120, rgbindex: 104, name: _("peru"), r: 0xCD, g: 0x85, b: 0x3F },                /* #CD853F */
    { colortyp: RGBC, tableindex: 121, rgbindex: 105, name: _("sandy-brown"), r: 0xF4, g: 0xA4, b: 0x60 },         /* #F4A460 */
    { colortyp: RGBC, tableindex: 122, rgbindex: 106, name: _("burly-wood"), r: 0xDE, g: 0xB8, b: 0x87 },          /* #DEB887 */
    { colortyp: RGBC, tableindex: 123, rgbindex: 107, name: _("tan"), r: 0xD2, g: 0xB4, b: 0x8C },                 /* #D2B48C */
    { colortyp: RGBC, tableindex: 124, rgbindex: 108, name: _("rosy-brown"), r: 0xBC, g: 0x8F, b: 0x8F },          /* #BC8F8F */
    { colortyp: RGBC, tableindex: 125, rgbindex: 109, name: _("moccasin"), r: 0xFF, g: 0xE4, b: 0xB5 },            /* #FFE4B5 */
    { colortyp: RGBC, tableindex: 126, rgbindex: 110, name: _("navajo-white"), r: 0xFF, g: 0xDE, b: 0xAD },        /* #FFDEAD */
    { colortyp: RGBC, tableindex: 127, rgbindex: 111, name: _("peach-puff"), r: 0xFF, g: 0xDA, b: 0xB9 },          /* #FFDAB9 */
    { colortyp: RGBC, tableindex: 128, rgbindex: 112, name: _("misty-rose"), r: 0xFF, g: 0xE4, b: 0xE1 },          /* #FFE4E1 */
    { colortyp: RGBC, tableindex: 129, rgbindex: 113, name: _("lavender-blush"), r: 0xFF, g: 0xF0, b: 0xF5 },      /* #FFF0F5 */
    { colortyp: RGBC, tableindex: 130, rgbindex: 114, name: _("linen"), r: 0xFA, g: 0xF0, b: 0xE6 },               /* #FAF0E6 */
    { colortyp: RGBC, tableindex: 131, rgbindex: 115, name: _("old-lace"), r: 0xFD, g: 0xF5, b: 0xE6 },            /* #FDF5E6 */
    { colortyp: RGBC, tableindex: 132, rgbindex: 116, name: _("papaya-whip"), r: 0xFF, g: 0xEF, b: 0xD5 },         /* #FFEFD5 */
    { colortyp: RGBC, tableindex: 133, rgbindex: 117, name: _("sea-shell"), r: 0xFF, g: 0xF5, b: 0xEE },           /* #FFF5EE */
    { colortyp: RGBC, tableindex: 134, rgbindex: 118, name: _("mint-cream"), r: 0xF5, g: 0xFF, b: 0xFA },          /* #F5FFFA */
    { colortyp: RGBC, tableindex: 135, rgbindex: 119, name: _("slate-gray"), r: 0x70, g: 0x80, b: 0x90 },          /* #708090 */
    { colortyp: RGBC, tableindex: 136, rgbindex: 120, name: _("light-slate-gray"), r: 0x77, g: 0x88, b: 0x99 },    /* #778899 */
    { colortyp: RGBC, tableindex: 137, rgbindex: 121, name: _("light-steel-blue"), r: 0xB0, g: 0xC4, b: 0xDE },    /* #B0C4DE */
    { colortyp: RGBC, tableindex: 138, rgbindex: 122, name: _("lavender"), r: 0xE6, g: 0xE6, b: 0xFA },            /* #E6E6FA */
    { colortyp: RGBC, tableindex: 139, rgbindex: 123, name: _("floral-white"), r: 0xFF, g: 0xFA, b: 0xF0 },        /* #FFFAF0 */
    { colortyp: RGBC, tableindex: 140, rgbindex: 124, name: _("alice-blue"), r: 0xF0, g: 0xF8, b: 0xFF },          /* #F0F8FF */
    { colortyp: RGBC, tableindex: 141, rgbindex: 125, name: _("ghost-white"), r: 0xF8, g: 0xF8, b: 0xFF },         /* #F8F8FF */
    { colortyp: RGBC, tableindex: 142, rgbindex: 126, name: _("honeydew"), r: 0xF0, g: 0xFF, b: 0xF0 },            /* #F0FFF0 */
    { colortyp: RGBC, tableindex: 143, rgbindex: 127, name: _("ivory"), r: 0xFF, g: 0xFF, b: 0xF0 },               /* #FFFFF0 */
    { colortyp: RGBC, tableindex: 144, rgbindex: 128, name: _("azure"), r: 0xF0, g: 0xFF, b: 0xFF },               /* #F0FFFF */
    { colortyp: RGBC, tableindex: 145, rgbindex: 129, name: _("snow"), r: 0xFF, g: 0xFA, b: 0xFA },                /* #FFFAFA */
    { colortyp: RGBC, tableindex: 146, rgbindex: 130, name: _("black"), r: 0x00, g: 0x00, b: 0x00 },               /* #000000 */
    { colortyp: RGBC, tableindex: 147, rgbindex: 131, name: _("dim-gray"), r: 0x69, g: 0x69, b: 0x69 },            /* #696969 */
    { colortyp: RGBC, tableindex: 148, rgbindex: 132, name: _("gray"), r: 0x80, g: 0x80, b: 0x80 },                /* #808080 */
    { colortyp: RGBC, tableindex: 149, rgbindex: 133, name: _("dark-gray"), r: 0xA9, g: 0xA9, b: 0xA9 },           /* #A9A9A9 */
    { colortyp: RGBC, tableindex: 150, rgbindex: 134, name: _("silver"), r: 0xC0, g: 0xC0, b: 0xC0 },              /* #C0C0C0 */
    { colortyp: RGBC, tableindex: 151, rgbindex: 135, name: _("light-gray"), r: 0xD3, g: 0xD3, b: 0xD3 },          /* #D3D3D3 */
    { colortyp: RGBC, tableindex: 152, rgbindex: 136, name: _("gainsboro"), r: 0xDC, g: 0xDC, b: 0xDC },           /* #DCDCDC */
    { colortyp: RGBC, tableindex: 153, rgbindex: 137, name: _("white-smoke"), r: 0xF5, g: 0xF5, b: 0xF5 },         /* #F5F5F5 */
    { colortyp: RGBC, tableindex: 154, rgbindex: 138, name: _("white"), r: 0xFF, g: 0xFF, b: 0xFF },               /* #FFFFFF */
]);

export function colortable_to_int32(cte) { /* int32 */
    let clr = NO_COLOR | NH_BASIC_COLOR;

    if (cte.colortyp == rgb_color)
        clr = or64(or64(shl64(cte.r, 16), shl64(cte.g, 8)), cte.b);
    else if (cte.colortyp == nh_color)
        clr = cte.tableindex | NH_BASIC_COLOR;
    return clr;
}

export function color_attr_to_str(ca) { /* char * */
    let buf = static_array("color_attr_to_str.buf", char, BUFSZ);

    sprintf(buf, _("%s&%s"), clr2colorname(ca.color), attr2attrname(ca.attr))

;
    return buf;
}

/* parse string like "color&attr" into color_attr */
export function color_attr_parse_str(ca, str) { /* boolean */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);
    let amp = 0;
    let tmp, c = NO_COLOR, a = ATR_NONE;

    strncpy(buf, str, sizeof(array_of(char, BUFSZ)) - 1);
    chars[buf + (sizeof(array_of(char, BUFSZ)) - 1)] = ord('\0');

    if ((amp = strchr(buf, ord('&'))) != 0)
        chars[amp] = ord('\0');

    if (amp) {
        amp++;
        c = match_str2clr(buf, FALSE);
        a = match_str2attr(amp, TRUE);
        /* FIXME: match_str2clr & match_str2attr give config_error_add(),
           so this is useless */
        if (c >= CLR_MAX && a == -1) {
            /* try other way around */
            c = match_str2clr(amp, FALSE);
            a = match_str2attr(buf, TRUE);
        }
        if (c >= CLR_MAX || a == -1)
            return FALSE;
    } else {
        /* one param only */
        tmp = match_str2attr(buf, FALSE);
        if (tmp == -1) {
            tmp = match_str2clr(buf, FALSE);
            if (tmp >= CLR_MAX)
                return FALSE;
            c = tmp;
        } else {
            a = tmp;
        }
    }
    ca.attr = a;
    ca.color = c;
    return TRUE;
    } finally { stack_pop($frame); }
}

export function query_color_attr(ca, prompt) { /* boolean */
    let c, a;

    c = query_color(prompt, ca.color);
    if (c == -1)
        return FALSE;
    a = query_attr(prompt, ca.attr);
    if (a == -1)
        return FALSE;
    ca.color = c;
    ca.attr = a;
    return TRUE;
}

export function attr2attrname(attr) { /* const char * */
    let i;

    for (i = 0; i < SIZE(attrnames); i++)
        if (attrnames[i].attr == attr)
            return attrnames[i].name;
    return 0;
}

/*
 * Color support functions and data for "color"
 *
 * Used by: optfn_()
 *
 */

export function clr2colorname(clr) { /* const char * */
    let i;

    for (i = 0; i < SIZE(colornames); i++)
        if (colornames[i].name && colornames[i].color == clr)
            return colornames[i].name;
    return 0;
}

export function match_str2clr(str, suppress_msg) { /* int */
    let i, c = CLR_MAX;

    /* allow "lightblue", "light blue", and "light-blue" to match "light blue"
       (also junk like "_l i-gh_t---b l u e" but we won't worry about that);
       also copes with trailing space; caller has removed any leading space */
    for (i = 0; i < SIZE(colornames); i++)
        if (colornames[i].name
            && fuzzymatch(str, colornames[i].name, _(" -_"), TRUE)) {
            c = colornames[i].color;
            break;
        }
    if (i == SIZE(colornames) && digit(chars[str]))
        c = atoi(str);

    if (c < 0 || c >= CLR_MAX) {
        if (!suppress_msg)
            config_error_add(_("Unknown color '%.60s'"), str);
        c = CLR_MAX; /* "none of the above" */
    }
    return c;
}

export function match_str2attr(str, complain) { /* int */
    let i, a = -1;

    for (i = 0; i < SIZE(attrnames); i++)
        if (attrnames[i].name
            && fuzzymatch(str, attrnames[i].name, _(" -_"), TRUE)) {
            a = attrnames[i].attr;
            break;
        }

    if (a == -1 && complain)
        config_error_add(_("Unknown text attribute '%.50s'"), str);

    return a;
}

/* ask about highlighting attribute; for menu headers and menu
   coloring patterns, only one attribute at a time is allowed;
   for status highlighting, multiple attributes are allowed [overkill;
   life would be much simpler if that were restricted to one also...] */
export function query_attr(prompt, dflt_attr) { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let i, pick_cnt;
    let picks = stack_var(ptr_to(struct_mi), null);
    let allow_many = (prompt && !strncmpi(prompt, _("Choose"), 6) ? 1 : 0);
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    for (i = 0; i < SIZE(attrnames); i++) {
        if (!attrnames[i].name)
            break;
        any.a_int = i + 1;
        add_menu(tmpwin, nul_glyphinfo, any, 0, 0,
                 attrnames[i].attr, clr, attrnames[i].name,
                 (attrnames[i].attr == dflt_attr) ? MENU_ITEMFLAGS_SELECTED
                                                  : MENU_ITEMFLAGS_NONE);
    }
    end_menu()(tmpwin, (prompt && chars[prompt]) ? prompt : _("Pick an attribute"));
    pick_cnt = select_menu(tmpwin, allow_many ? PICK_ANY : PICK_ONE, picks);
    destroy_nhwindow()(tmpwin);
    if (pick_cnt > 0) {
        let j, k = 0;

        if (allow_many) {
            /* PICK_ANY, with one preselected entry (ATR_NONE) which
               should be excluded if any other choices were picked */
            for (i = 0; i < pick_cnt; ++i) {
                j = ptr_add(picks[0], i).item.a_int - 1;
                if (attrnames[j].attr != ATR_NONE || pick_cnt == 1) {
                    switch (attrnames[j].attr) {
                    case ATR_NONE:
                        k = HL_NONE;
                        break;
                    case ATR_BOLD:
                        k |= HL_BOLD;
                        break;
                    case ATR_DIM:
                        k |= HL_DIM;
                        break;
                    case ATR_ITALIC:
                        k |= HL_ITALIC;
                        break;
                    case ATR_ULINE:
                        k |= HL_ULINE;
                        break;
                    case ATR_BLINK:
                        k |= HL_BLINK;
                        break;
                    case ATR_INVERSE:
                        k |= HL_INVERSE;
                        break;
                    }
                }
            }
        } else {
            /* PICK_ONE, but might get 0 or 2 due to preselected entry */
            j = ptr_add(picks[0], 0).item.a_int - 1;
            /* pick_cnt==2: explicitly picked something other than the
               preselected entry */
            if (pick_cnt == 2 && attrnames[j].attr == dflt_attr)
                j = ptr_add(picks[0], 1).item.a_int - 1;
            k = attrnames[j].attr;
        }
        free(addr_of(picks[0]));
        return k;
    } else if (pick_cnt == 0 && !allow_many) {
        /* PICK_ONE, preselected entry explicitly chosen */
        return dflt_attr;
    }
    /* either ESC to explicitly cancel (pick_cnt==-1) or
       PICK_ANY with preselected entry toggled off and nothing chosen */
    return -1;
    } finally { stack_pop($frame); }
}

export function query_color(prompt, dflt_color) { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let i, pick_cnt;
    let picks = stack_var(ptr_to(struct_mi), null);

    /* replace user patterns with color name ones and force 'menucolors' On */
    basic_menu_colors(TRUE);

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);
    for (i = 0; i < SIZE(colornames); i++) {
        if (!colornames[i].name)
            break;
        any.a_int = i + 1;
        add_menu(tmpwin, nul_glyphinfo, any, 0, 0,
                 ATR_NONE, NO_COLOR, colornames[i].name,
                 (colornames[i].color == dflt_color) ? MENU_ITEMFLAGS_SELECTED
                                                     : MENU_ITEMFLAGS_NONE);
    }
    end_menu()(tmpwin, (prompt && chars[prompt]) ? prompt : _("Pick a color"));
    pick_cnt = select_menu(tmpwin, PICK_ONE, picks);
    destroy_nhwindow()(tmpwin);

    /* remove temporary color name patterns and restore user-specified ones;
       reset 'menucolors' option to its previous value */
    basic_menu_colors(FALSE);

    if (pick_cnt > 0) {
        i = elt(colornames, ptr_add(picks[0], 0).item.a_int - 1).color;
        /* pick_cnt==2: explicitly picked something other than the
           preselected entry */
        if (pick_cnt == 2 && i == NO_COLOR)
            i = elt(colornames, ptr_add(picks[0], 1).item.a_int - 1).color;
        free(addr_of(picks[0]));
        return i;
    } else if (pick_cnt == 0) {
        /* pick_cnt==0: explicitly picking preselected entry toggled it off */
        return dflt_color;
    }
    return -1;
    } finally { stack_pop($frame); }
}

 /* from sys/share/<various>regex.{c,cpp} */

/* set up a menu for picking a color, one that shows each name in its color;
   overrides player's MENUCOLORS with a set of "blue"=blue, "red"=red, and
   so forth; suppresses color for black and white because one of those will
   likely be invisible due to matching the background; the alternate set of
   MENUCOLORS is kept around for potential re-use */
export function basic_menu_colors(
    load_colors) { /* void */ /* True: temporarily replace menu color entries with * a fake set of menu colors which match their names; * False: restore user-specified colorings */
    const $frame = stack_frame(); try {
    if (load_colors) {
        /* replace normal menu colors with a set specifically for colors */
        gs.save_menucolors = iflags.use_menu_color;
        gs.save_colorings = gm.menu_colorings;

        iflags.use_menu_color = TRUE;
        if (gc.color_colorings) {
            /* use the alternate colorings which were set up previously */
            gm.menu_colorings = gc.color_colorings;
        } else {
            /* create the alternate colorings once */
            let cnm = stack_array(char, QBUFSZ);
            let i, c;
            let pmatchregex = +!strncmpi((regex_id), _(("pmatchregex")), -1);
            let patternfmt = pmatchregex ? _("*%s") : _("%s");

            /* menu_colorings pointer has been saved; clear it in order
               to add the alternate entries as if from scratch */
            gm.menu_colorings = null;

            /* this orders the patterns last-in/first-out; that means
               that the "light <foo>" variations come before the basic
               "<foo>" ones, which is exactly what we want (so that the
               shorter basic names won't get false matches as substrings
               of the longer ones) */
            for (i = 0; i < SIZE(colornames); ++i) {
                if (!colornames[i].name) /* first alias entry has no name */
                    break;
                c = colornames[i].color;
                if (c == CLR_BLACK || c == CLR_WHITE || c == NO_COLOR)
                    continue; /* skip these */
                sprintf(cnm, patternfmt, colornames[i].name);
                add_menu_coloring_parsed(cnm, c, ATR_NONE);
            }

            /* right now, menu_colorings contains the alternate color list;
               remember that list for future pick-a-color instances and
               also keep it as is for this instance */
            gc.color_colorings = gm.menu_colorings;
        }
    } else {
        /* restore normal user-specified menu colors */
        iflags.use_menu_color = gs.save_menucolors;
        gm.menu_colorings = gs.save_colorings;
    }
    } finally { stack_pop($frame); }
}

export function add_menu_coloring_parsed(str, c, a) { /* boolean */
    const $frame = stack_frame(); try {
    let re_error = init_string(static_array("add_menu_coloring_parsed.re_error", char, sizeof_string("Menucolor regex error")), _("Menucolor regex error"), true);
    let tmp;

    if (!str)
        return FALSE;
    tmp = view_of(struct_menucoloring, addr_of(alloc(sizeof(struct_menucoloring))));
    tmp.match = regex_init();
    /* test_regex_pattern() has already validated this regexp but parsing
       it again could conceivably run out of memory */
    if (!regex_compile(str, tmp.match)) {
        let errbuf = stack_array(char, BUFSZ);
        let re_error_desc = regex_error_desc(tmp.match, errbuf);

        /* free first in case reason for regcomp failure was out-of-memory */
        regex_free(tmp.match);
        free(addr_of(tmp));
        config_error_add(_("%s: %s"), re_error, re_error_desc);
        return FALSE;
    }
    tmp.next = gm.menu_colorings;
    tmp.origstr = dupstr(str);
    tmp.color = c;
    tmp.attr = a;
    gm.menu_colorings = tmp;
    iflags.use_menu_color = TRUE;
    return TRUE;
    } finally { stack_pop($frame); }
}

/* parse '"regex_string"=color&attr' and add it to menucoloring */
export function add_menu_coloring(tmpstr) { /* boolean */ /* never Null but could be empty */
    const $frame = stack_frame(); try {
    let c = NO_COLOR, a = ATR_NONE;
    let tmps, cs, amp;
    let str = stack_array(char, BUFSZ);

    strncpy(str, tmpstr, sizeof(array_of(char, BUFSZ)) - 1);
    chars[str + (sizeof(array_of(char, BUFSZ)) - 1)] = ord('\0');

    if ((cs = strchr(str, ord('='))) == 0) {
        config_error_add(_("Malformed MENUCOLOR"));
        return FALSE;
    }

    tmps = cs + 1; /* advance past '=' */
    mungspaces(tmps);
    if ((amp = strchr(tmps, ord('&'))) != 0)
        chars[amp] = ord('\0');

    c = match_str2clr(tmps, FALSE);
    if (c >= CLR_MAX)
        return FALSE;

    if (amp) {
        tmps = amp + 1; /* advance past '&' */
        a = match_str2attr(tmps, TRUE);
        if (a == -1)
            return FALSE;
    }

    /* the regexp portion here has not been condensed by mungspaces() */
    chars[cs] = ord('\0');
    tmps = str;
    if (chars[tmps] == ord('"') || chars[tmps] == ord('\'')) {
        cs--;
        while (__isspace(uchar((chars[cs]))))
            cs--;
        if (chars[cs] == chars[tmps]) {
            chars[cs] = ord('\0');
            tmps++;
        }
    }
    return add_menu_coloring_parsed(tmps, c, a);
    } finally { stack_pop($frame); }
}

/* release all menu color patterns */
export function free_menu_coloring() { /* void */
    /* either menu_colorings or color_colorings or both might need to
       be freed or already be Null; do-loop will iterate at most twice */
    do {
        let tmp, tmp2;

        for (tmp = gm.menu_colorings; tmp; tmp = tmp2) {
            tmp2 = tmp.next;
            regex_free(tmp.match);
            free(tmp.origstr);
            free(addr_of(tmp));
        }
        gm.menu_colorings = gc.color_colorings;
        gc.color_colorings = null;
    } while (gm.menu_colorings);
}

/* release a specific menu color pattern; not used for color_colorings */
export function free_one_menu_coloring(idx) { /* void */ /* 0 .. */
    let tmp = gm.menu_colorings;
    let prev = null;

    while (tmp) {
        if (idx == 0) {
            let next = tmp.next;

            regex_free(tmp.match);
            free(tmp.origstr);
            free(addr_of(tmp));
            if (prev)
                prev.next = next;
            else
                gm.menu_colorings = next;
            return;
        }
        idx--;
        prev = tmp;
        tmp = tmp.next;
    }
}

export function count_menucolors() { /* int */
    let tmp;
    let count = 0;

    for (tmp = gm.menu_colorings; tmp; tmp = tmp.next)
        count++;
    return count;
}

/* returns -1 on no-match.
 * buf is NONNULLARG1
 */
export function check_enhanced_colors(buf) { /* int32 */
    const $frame = stack_frame(); try {
    let xtra = stack_var(char, ord('\0')); /* used to catch trailing junk after "#rrggbb" */
    let r = stack_var(unsigned), g = stack_var(unsigned), b = stack_var(unsigned);
    let retcolor = -1, color;

    if ((color = match_str2clr(buf, TRUE)) != CLR_MAX)  {
        retcolor = color | NH_BASIC_COLOR;
    } else if (sscanf(buf, _("#%02x%02x%02x%c"), r, g, b, addr_of(xtra)) >= 3) {
        retcolor = !xtra[0] ? int32(unsigned(unsigned(unsigned(r[0] << 16) | unsigned(g[0] << 8)) | b[0])) : -1;
    } else {
        /* altbuf: allow user's "grey" to match colortable[]'s "gray";
         * fuzzymatch(): ignore spaces, hyphens, and underscores so that
         * space or underscore in user-supplied name will match hyphen
         * [note: caller splits text at spaces so we won't see any here]
         */
        let altbuf = 0, grey = strstri(buf, _("grey"));
        let greyoffset = grey ? (grey - buf) : -1;

        if (greyoffset >= 0) {
            altbuf = dupstr(buf);
            /* use direct copy because strsubst() is case-sensitive */
            /*(void) strncpy(&altbuf[greyoffset], "gray", 4);*/
            memcpy(altbuf + greyoffset, _("gray"), 4);
        }
        for (color = 0; color < SIZE(colortable); ++color) {
            if (fuzzymatch(buf, colortable[color].name, _(" -_"), TRUE)
                || (altbuf && fuzzymatch(altbuf, colortable[color].name,
                                         _(" -_"), TRUE))) {
                retcolor = colortable_to_int32(colortable[color]);
                break;
            }
        }
        if (altbuf)
            free(altbuf);
    }
    return retcolor;
    } finally { stack_pop($frame); }
}

/* return the canonical name of a particular color */
export function wc_color_name(colorindx) { /* const char * */
    let hexcolor = static_array("wc_color_name.hexcolor", char, sizeof_string("#rrggbb")); /* includes room for '\0' */
    let result = _("no-color");

    if (colorindx >= 0) {
        let basicindx = colorindx & ~NH_BASIC_COLOR;

        /* if colorindx has NH_BASIC_COLOR bit set, basicindx won't,
           so differing implies a basic color */
        if (basicindx != colorindx) {
            assert(basicindx < 16);
            result = colortable[basicindx].name;
        } else {
            let indx;
            let r = (colorindx >> 16) & 0x0000ff,
                 g = (colorindx >> 8) & 0x0000ff,
                 b = colorindx & 0x0000ff;         /* mask  XXXXbb to bb */

            Snprintf(hexcolor, sizeof(array_of(char, sizeof_string("#rrggbb"))), _("#%02x%02x%02x"), uint8(r), uint8(g), uint8(b))
;
            result = hexcolor;
            /* override hex value if this is a named color */
            for (indx = 16; indx < SIZE(colortable); ++indx)
                if (colortable[indx].r == r
                    && colortable[indx].g == g
                    && colortable[indx].b == b) {
                    result = colortable[indx].name;
                    break;
                }
        }
    }
    return result;
}

/* hexdd[] is defined in decl.c */
export function onlyhexdigits(buf) { /* boolean */
    let dp = buf;

    for (dp = buf; chars[dp]; ++dp) {
        if (!(strchr(hexdd, chars[dp]) || chars[dp] == ord('-')))
            return FALSE;
    }
    return TRUE;
}

export function rgbstr_to_int32(rgbstr) { /* int32_t */
    const $frame = stack_frame(); try {
    let r, g, b, milestone = 0;
    let cp, c_r, c_g, c_b;
    let rgb = 0;
    let buf = stack_array(char, BUFSZ);
    let dash = FALSE;

    Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%s"), rgbstr ? rgbstr : _(""))
;

    if (chars[buf] && onlyhexdigits(buf)) {
        c_g = c_b = 0;
        c_r = cp = buf;
        while (chars[cp]) {
            if (digit(chars[cp]) || chars[cp] == ord('-')) {
                if (chars[cp] == ord('-')) {
                    chars[cp] = ord('\0');
                    milestone++;
                    dash = TRUE;
                }
                cp++;
                if (dash) {
                    if (milestone < 2)
                        c_g = cp;
                    else
                        c_b = cp;
                    dash = FALSE;
                }
            } else {
                return -1;
            }
        }
        /* sanity checks */
        if (c_r && c_g && c_b
            && (strlen(c_r) > 0 && strlen(c_r) < 4)
            && (strlen(c_g) > 0 && strlen(c_g) < 4)
            && (strlen(c_b) > 0 && strlen(c_b) < 4)) {
            r = atoi(c_r);
            g = atoi(c_g);
            b = atoi(c_b);
            rgb = (r << 16) | (g << 8) | (b << 0);
            return rgb;
        }
    } else if (chars[buf]) {
        /* perhaps an enhanced color name was used instead of rgb value? */
        if ((rgb = check_enhanced_colors(buf)) != -1) {
            return rgb;
        }
    }
    return -1;
    } finally { stack_pop($frame); }
}

export function set_map_customcolor(gmap, nhcolor) { /* int */
    const $frame = stack_frame(); try {
    let tmpgm = gmap;
    let closecolor = stack_var(uint32, 0);
    let clridx = stack_var(uint16, 0);

    if (!tmpgm)
        return 0;

    gmap.customcolor = nhcolor;
    if (closest_color(nhcolor, closecolor, clridx))
        gmap.color256idx = clridx[0];
    else
        gmap.color256idx = 0;
    return 1;
    } finally { stack_pop($frame); }
}

 const struct___anon1 = struct("coloratt.struct___anon1", {
    index: int,
    value: uint32,
}); const color_256_definitions = static_array("color_256_definitions", struct___anon1, null, [
    /* color values are from unnethack */
    {  index: 16, value: 0x000000 }, {  index: 17, value: 0x00005f }, {  index: 18, value: 0x000087 },
    {  index: 19, value: 0x0000af }, {  index: 20, value: 0x0000d7 }, {  index: 21, value: 0x0000ff },
    {  index: 22, value: 0x005f00 }, {  index: 23, value: 0x005f5f }, {  index: 24, value: 0x005f87 },
    {  index: 25, value: 0x005faf }, {  index: 26, value: 0x005fd7 }, {  index: 27, value: 0x005fff },
    {  index: 28, value: 0x008700 }, {  index: 29, value: 0x00875f }, {  index: 30, value: 0x008787 },
    {  index: 31, value: 0x0087af }, {  index: 32, value: 0x0087d7 }, {  index: 33, value: 0x0087ff },
    {  index: 34, value: 0x00af00 }, {  index: 35, value: 0x00af5f }, {  index: 36, value: 0x00af87 },
    {  index: 37, value: 0x00afaf }, {  index: 38, value: 0x00afd7 }, {  index: 39, value: 0x00afff },
    {  index: 40, value: 0x00d700 }, {  index: 41, value: 0x00d75f }, {  index: 42, value: 0x00d787 },
    {  index: 43, value: 0x00d7af }, {  index: 44, value: 0x00d7d7 }, {  index: 45, value: 0x00d7ff },
    {  index: 46, value: 0x00ff00 }, {  index: 47, value: 0x00ff5f }, {  index: 48, value: 0x00ff87 },
    {  index: 49, value: 0x00ffaf }, {  index: 50, value: 0x00ffd7 }, {  index: 51, value: 0x00ffff },
    {  index: 52, value: 0x5f0000 }, {  index: 53, value: 0x5f005f }, {  index: 54, value: 0x5f0087 },
    {  index: 55, value: 0x5f00af }, {  index: 56, value: 0x5f00d7 }, {  index: 57, value: 0x5f00ff },
    {  index: 58, value: 0x5f5f00 }, {  index: 59, value: 0x5f5f5f }, {  index: 60, value: 0x5f5f87 },
    {  index: 61, value: 0x5f5faf }, {  index: 62, value: 0x5f5fd7 }, {  index: 63, value: 0x5f5fff },
    {  index: 64, value: 0x5f8700 }, {  index: 65, value: 0x5f875f }, {  index: 66, value: 0x5f8787 },
    {  index: 67, value: 0x5f87af }, {  index: 68, value: 0x5f87d7 }, {  index: 69, value: 0x5f87ff },
    {  index: 70, value: 0x5faf00 }, {  index: 71, value: 0x5faf5f }, {  index: 72, value: 0x5faf87 },
    {  index: 73, value: 0x5fafaf }, {  index: 74, value: 0x5fafd7 }, {  index: 75, value: 0x5fafff },
    {  index: 76, value: 0x5fd700 }, {  index: 77, value: 0x5fd75f }, {  index: 78, value: 0x5fd787 },
    {  index: 79, value: 0x5fd7af }, {  index: 80, value: 0x5fd7d7 }, {  index: 81, value: 0x5fd7ff },
    {  index: 82, value: 0x5fff00 }, {  index: 83, value: 0x5fff5f }, {  index: 84, value: 0x5fff87 },
    {  index: 85, value: 0x5fffaf }, {  index: 86, value: 0x5fffd7 }, {  index: 87, value: 0x5fffff },
    {  index: 88, value: 0x870000 }, {  index: 89, value: 0x87005f }, {  index: 90, value: 0x870087 },
    {  index: 91, value: 0x8700af }, {  index: 92, value: 0x8700d7 }, {  index: 93, value: 0x8700ff },
    {  index: 94, value: 0x875f00 }, {  index: 95, value: 0x875f5f }, {  index: 96, value: 0x875f87 },
    {  index: 97, value: 0x875faf }, {  index: 98, value: 0x875fd7 }, {  index: 99, value: 0x875fff },
    { index: 100, value: 0x878700 }, { index: 101, value: 0x87875f }, { index: 102, value: 0x878787 },
    { index: 103, value: 0x8787af }, { index: 104, value: 0x8787d7 }, { index: 105, value: 0x8787ff },
    { index: 106, value: 0x87af00 }, { index: 107, value: 0x87af5f }, { index: 108, value: 0x87af87 },
    { index: 109, value: 0x87afaf }, { index: 110, value: 0x87afd7 }, { index: 111, value: 0x87afff },
    { index: 112, value: 0x87d700 }, { index: 113, value: 0x87d75f }, { index: 114, value: 0x87d787 },
    { index: 115, value: 0x87d7af }, { index: 116, value: 0x87d7d7 }, { index: 117, value: 0x87d7ff },
    { index: 118, value: 0x87ff00 }, { index: 119, value: 0x87ff5f }, { index: 120, value: 0x87ff87 },
    { index: 121, value: 0x87ffaf }, { index: 122, value: 0x87ffd7 }, { index: 123, value: 0x87ffff },
    { index: 124, value: 0xaf0000 }, { index: 125, value: 0xaf005f }, { index: 126, value: 0xaf0087 },
    { index: 127, value: 0xaf00af }, { index: 128, value: 0xaf00d7 }, { index: 129, value: 0xaf00ff },
    { index: 130, value: 0xaf5f00 }, { index: 131, value: 0xaf5f5f }, { index: 132, value: 0xaf5f87 },
    { index: 133, value: 0xaf5faf }, { index: 134, value: 0xaf5fd7 }, { index: 135, value: 0xaf5fff },
    { index: 136, value: 0xaf8700 }, { index: 137, value: 0xaf875f }, { index: 138, value: 0xaf8787 },
    { index: 139, value: 0xaf87af }, { index: 140, value: 0xaf87d7 }, { index: 141, value: 0xaf87ff },
    { index: 142, value: 0xafaf00 }, { index: 143, value: 0xafaf5f }, { index: 144, value: 0xafaf87 },
    { index: 145, value: 0xafafaf }, { index: 146, value: 0xafafd7 }, { index: 147, value: 0xafafff },
    { index: 148, value: 0xafd700 }, { index: 149, value: 0xafd75f }, { index: 150, value: 0xafd787 },
    { index: 151, value: 0xafd7af }, { index: 152, value: 0xafd7d7 }, { index: 153, value: 0xafd7ff },
    { index: 154, value: 0xafff00 }, { index: 155, value: 0xafff5f }, { index: 156, value: 0xafff87 },
    { index: 157, value: 0xafffaf }, { index: 158, value: 0xafffd7 }, { index: 159, value: 0xafffff },
    { index: 160, value: 0xd70000 }, { index: 161, value: 0xd7005f }, { index: 162, value: 0xd70087 },
    { index: 163, value: 0xd700af }, { index: 164, value: 0xd700d7 }, { index: 165, value: 0xd700ff },
    { index: 166, value: 0xd75f00 }, { index: 167, value: 0xd75f5f }, { index: 168, value: 0xd75f87 },
    { index: 169, value: 0xd75faf }, { index: 170, value: 0xd75fd7 }, { index: 171, value: 0xd75fff },
    { index: 172, value: 0xd78700 }, { index: 173, value: 0xd7875f }, { index: 174, value: 0xd78787 },
    { index: 175, value: 0xd787af }, { index: 176, value: 0xd787d7 }, { index: 177, value: 0xd787ff },
    { index: 178, value: 0xd7af00 }, { index: 179, value: 0xd7af5f }, { index: 180, value: 0xd7af87 },
    { index: 181, value: 0xd7afaf }, { index: 182, value: 0xd7afd7 }, { index: 183, value: 0xd7afff },
    { index: 184, value: 0xd7d700 }, { index: 185, value: 0xd7d75f }, { index: 186, value: 0xd7d787 },
    { index: 187, value: 0xd7d7af }, { index: 188, value: 0xd7d7d7 }, { index: 189, value: 0xd7d7ff },
    { index: 190, value: 0xd7ff00 }, { index: 191, value: 0xd7ff5f }, { index: 192, value: 0xd7ff87 },
    { index: 193, value: 0xd7ffaf }, { index: 194, value: 0xd7ffd7 }, { index: 195, value: 0xd7ffff },
    { index: 196, value: 0xff0000 }, { index: 197, value: 0xff005f }, { index: 198, value: 0xff0087 },
    { index: 199, value: 0xff00af }, { index: 200, value: 0xff00d7 }, { index: 201, value: 0xff00ff },
    { index: 202, value: 0xff5f00 }, { index: 203, value: 0xff5f5f }, { index: 204, value: 0xff5f87 },
    { index: 205, value: 0xff5faf }, { index: 206, value: 0xff5fd7 }, { index: 207, value: 0xff5fff },
    { index: 208, value: 0xff8700 }, { index: 209, value: 0xff875f }, { index: 210, value: 0xff8787 },
    { index: 211, value: 0xff87af }, { index: 212, value: 0xff87d7 }, { index: 213, value: 0xff87ff },
    { index: 214, value: 0xffaf00 }, { index: 215, value: 0xffaf5f }, { index: 216, value: 0xffaf87 },
    { index: 217, value: 0xffafaf }, { index: 218, value: 0xffafd7 }, { index: 219, value: 0xffafff },
    { index: 220, value: 0xffd700 }, { index: 221, value: 0xffd75f }, { index: 222, value: 0xffd787 },
    { index: 223, value: 0xffd7af }, { index: 224, value: 0xffd7d7 }, { index: 225, value: 0xffd7ff },
    { index: 226, value: 0xffff00 }, { index: 227, value: 0xffff5f }, { index: 228, value: 0xffff87 },
    { index: 229, value: 0xffffaf }, { index: 230, value: 0xffffd7 }, { index: 231, value: 0xffffff },
    { index: 232, value: 0x080808 }, { index: 233, value: 0x121212 }, { index: 234, value: 0x1c1c1c },
    { index: 235, value: 0x262626 }, { index: 236, value: 0x303030 }, { index: 237, value: 0x3a3a3a },
    { index: 238, value: 0x444444 }, { index: 239, value: 0x4e4e4e }, { index: 240, value: 0x585858 },
    { index: 241, value: 0x626262 }, { index: 242, value: 0x6c6c6c }, { index: 243, value: 0x767676 },
    { index: 244, value: 0x808080 }, { index: 245, value: 0x8a8a8a }, { index: 246, value: 0x949494 },
    { index: 247, value: 0x9e9e9e }, { index: 248, value: 0xa8a8a8 }, { index: 249, value: 0xb2b2b2 },
    { index: 250, value: 0xbcbcbc }, { index: 251, value: 0xc6c6c6 }, { index: 252, value: 0xd0d0d0 },
    { index: 253, value: 0xdadada }, { index: 254, value: 0xe4e4e4 }, { index: 255, value: 0xeeeeee },
]);

/** Calculate the color distance between two colors.
 *
 * Algorithm taken from UnNetHack which took it from
 * https://www.compuphase.com/cmetric.htm
 **/

export function color_distance(rgb1, rgb2) { /* int */
    let r1 = (rgb1 >>> 16) & 0xFF;
    let g1 = (rgb1 >>> 8) & 0xFF;
    let b1 = rgb1 & 0xFF;
    let r2 = (rgb2 >>> 16) & 0xFF;
    let g2 = (rgb2 >>> 8) & 0xFF;
    let b2 = rgb2 & 0xFF;

    let rmean = Math.trunc((r1 + r2) / 2);
    let r = r1 - r2;
    let g = g1 - g2;
    let b = b1 - b2;
    return ((((512 + rmean) * r * r) >> 8) + 4 * g * g
            + (((767 - rmean) * b * b) >> 8));
}

export function closest_color(lcolor, closecolor, clridx) { /* boolean */
    let i, color_index = -1, similar = INT_MAX, current;
    let retbool = FALSE;

    for (i = 0; i < SIZE(color_256_definitions); i++) {
        /* look for an exact match */
        if (lcolor == color_256_definitions[i].value) {
            color_index = i;
            break;
        }
        /* find a close color match */
        current = color_distance(lcolor, color_256_definitions[i].value);
        if (current < similar) {
            color_index = i;
            similar = current;
        }
    }
    if (closecolor && clridx && color_index >= 0) {
        closecolor[0] = color_256_definitions[color_index].value;
        clridx[0] = ushort(color_256_definitions[color_index].index);
        retbool = TRUE;
    }
    return retbool;
}

export function get_nhcolor_from_256_index(idx) { /* uint32 */
    let retcolor = NO_COLOR | NH_BASIC_COLOR;

    if (IndexOk(idx, color_256_definitions))
        retcolor = color_256_definitions[idx].value;
    return retcolor;
}

/* #ifdef CHANGE_COLOR: not in this build */

/*coloratt.c*/

import { HL_BLINK, HL_BOLD, HL_DIM, HL_INVERSE, HL_ITALIC, HL_NONE, HL_ULINE } from "./botl.h.js";
import {
    CLR_BLACK, CLR_BLUE, CLR_BRIGHT_BLUE, CLR_BRIGHT_CYAN, CLR_BRIGHT_GREEN, CLR_BRIGHT_MAGENTA,
    CLR_BROWN, CLR_CYAN, CLR_GRAY, CLR_GREEN, CLR_MAGENTA, CLR_MAX, CLR_ORANGE, CLR_RED, CLR_WHITE,
    CLR_YELLOW, NH_BASIC_COLOR, NO_COLOR, nh_color, no_color, rgb_color, struct_nethack_color,
} from "./color.h.js";
import { BUFSZ, FALSE, QBUFSZ, TRUE } from "./global.h.js";
import { struct_menucoloring } from "./hack.h.js";
import { IndexOk } from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { int32, uint16, uint32, uint8 } from "./integer.h.js";
import { create_nhwindow, destroy_nhwindow, end_menu, start_menu } from "./winprocs.h.macros.js";
import {
    ATR_BLINK, ATR_BOLD, ATR_DIM, ATR_INVERSE, ATR_ITALIC, ATR_NONE, ATR_ULINE,
    MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, MENU_ITEMFLAGS_SELECTED, NHW_MENU, PICK_ANY,
    PICK_ONE, struct_any, struct_mi,
} from "./wintype.h.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, sizeof, sizeof_string, uchar, unsigned, ushort } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { or64, shl64 } from "../rt/int64.js";
import {
    INT_MAX, __isspace, assert, atoi, free, memcpy, sprintf, sscanf, strchr, strlen, strncpy,
} from "../rt/libc.js";
import { init_string, stack_array, stack_struct, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, elt, ptr_add, ptr_to, struct, struct_assign, view_of,
} from "../rt/struct.js";
import { alloc, dupstr } from "./alloc.js";
import { config_error_add } from "./cfgfiles.js";
import { cg, gc, gm, gs, hexdd, iflags } from "./decl.js";
import { nul_glyphinfo } from "./display.js";
import { digit, fuzzymatch, mungspaces, strncmpi, strstri } from "./hacklib.js";
import { add_menu, select_menu } from "./windows.js";
import {
    regex_compile, regex_error_desc, regex_free, regex_id, regex_init,
} from "../sys/share/posixregex.js";
