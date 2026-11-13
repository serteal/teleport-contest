/* NetHack 5.0	shknam.c	$NHDT-Date: 1764109114 2025/11/25 22:18:34 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.86 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2011. */
/* NetHack may be freely redistributed.  See license for details. */

/* shknam.c -- initialize a shop */

export const VEGETARIAN_CLASS = (MAXOCLASSES + 1);

/*
 *  Name prefix codes:
 *      dash          -  female, personal name
 *      underscore    _  female, general name
 *      plus          +  male, personal name
 *      vertical bar  |  male, general name (implied for most of shktools)
 *      equals        =  gender not specified, personal name
 *
 *  Personal names do not receive the honorific prefix "Mr." or "Ms.".
 */

const shkliquors = static_array("shkliquors", ptr_to(char), null, [
    /* Ukraine */
    _("Njezjin"), _("Tsjernigof"), _("Ossipewsk"), _("Gorlowka"),
    /* Belarus */
    _("Gomel"),
    /* N. Russia */
    _("Konosja"), _("Weliki Oestjoeg"), _("Syktywkar"), _("Sablja"), _("Narodnaja"), _("Kyzyl"),
    /* Silezie */
    _("Walbrzych"), _("Swidnica"), _("Klodzko"), _("Raciborz"), _("Gliwice"), _("Brzeg"),
    _("Krnov"), _("Hradec Kralove"),
    /* Schweiz */
    _("Leuk"), _("Brig"), _("Brienz"), _("Thun"), _("Sarnen"), _("Burglen"), _("Elm"), _("Flims"),
    _("Vals"), _("Schuls"), _("Zum Loch"), 0
]);

const shkbooks = static_array("shkbooks", ptr_to(char), null, [
    /* Eire */
    _("Skibbereen"),  _("Kanturk"),   _("Rath Luirc"),     _("Ennistymon"),
    _("Lahinch"),     _("Kinnegad"),  _("Lugnaquillia"),   _("Enniscorthy"),
    _("Gweebarra"),   _("Kittamagh"), _("Nenagh"),         _("Sneem"),
    _("Ballingeary"), _("Kilgarvan"), _("Cahersiveen"),    _("Glenbeigh"),
    _("Kilmihil"),    _("Kiltamagh"), _("Droichead Atha"), _("Inniscrone"),
    _("Clonegal"),    _("Lisnaskea"), _("Culdaff"),        _("Dunfanaghy"),
    _("Inishbofin"),  _("Kesh"),      0
]);

const shkarmors = static_array("shkarmors", ptr_to(char), null, [
    /* Turquie */
    _("Demirci"),    _("Kalecik"),    _("Boyabai"),    _("Yildizeli"), _("Gaziantep"),
    _("Siirt"),      _("Akhalataki"), _("Tirebolu"),   _("Aksaray"),   _("Ermenak"),
    _("Iskenderun"), _("Kadirli"),    _("Siverek"),    _("Pervari"),   _("Malasgirt"),
    _("Bayburt"),    _("Ayancik"),    _("Zonguldak"),  _("Balya"),     _("Tefenni"),
    _("Artvin"),     _("Kars"),       _("Makharadze"), _("Malazgirt"), _("Midyat"),
    _("Birecik"),    _("Kirikkale"),  _("Alaca"),      _("Polatli"),   _("Nallihan"),
    0
]);

const shkwands = static_array("shkwands", ptr_to(char), null, [
    /* Wales */
    _("Yr Wyddgrug"), _("Trallwng"), _("Mallwyd"), _("Pontarfynach"), _("Rhaeader"),
    _("Llandrindod"), _("Llanfair-ym-muallt"), _("Y-Fenni"), _("Maesteg"), _("Rhydaman"),
    _("Beddgelert"), _("Curig"), _("Llanrwst"), _("Llanerchymedd"), _("Caergybi"),
    /* Scotland */
    _("Nairn"), _("Turriff"), _("Inverurie"), _("Braemar"), _("Lochnagar"), _("Kerloch"),
    _("Beinn a Ghlo"), _("Drumnadrochit"), _("Morven"), _("Uist"), _("Storr"),
    _("Sgurr na Ciche"), _("Cannich"), _("Gairloch"), _("Kyleakin"), _("Dunvegan"), 0
]);

const shkrings = static_array("shkrings", ptr_to(char), null, [
    /* Hollandse familienamen */
    _("Feyfer"),     _("Flugi"),         _("Gheel"),      _("Havic"),   _("Haynin"),
    _("Hoboken"),    _("Imbyze"),        _("Juyn"),       _("Kinsky"),  _("Massis"),
    _("Matray"),     _("Moy"),           _("Olycan"),     _("Sadelin"), _("Svaving"),
    _("Tapper"),     _("Terwen"),        _("Wirix"),      _("Ypey"),
    /* Skandinaviske navne */
    _("Rastegaisa"), _("Varjag Njarga"), _("Kautekeino"), _("Abisko"),  _("Enontekis"),
    _("Rovaniemi"),  _("Avasaksa"),      _("Haparanda"),  _("Lulea"),   _("Gellivare"),
    _("Oeloe"),      _("Kajaani"),       _("Fauske"),     0
]);

const shkfoods = static_array("shkfoods", ptr_to(char), null, [
    /* Indonesia */
    _("Djasinga"),    _("Tjibarusa"),   _("Tjiwidej"),      _("Pengalengan"),
    _("Bandjar"),     _("Parbalingga"), _("Bojolali"),      _("Sarangan"),
    _("Ngebel"),      _("Djombang"),    _("Ardjawinangun"), _("Berbek"),
    _("Papar"),       _("Baliga"),      _("Tjisolok"),      _("Siboga"),
    _("Banjoewangi"), _("Trenggalek"),  _("Karangkobar"),   _("Njalindoeng"),
    _("Pasawahan"),   _("Pameunpeuk"),  _("Patjitan"),      _("Kediri"),
    _("Pemboeang"),   _("Tringanoe"),   _("Makin"),         _("Tipor"),
    _("Semai"),       _("Berhala"),     _("Tegal"),         _("Samoe"),
    0
]);

const shkweapons = static_array("shkweapons", ptr_to(char), null, [
    /* Perigord */
    _("Voulgezac"),   _("Rouffiac"),   _("Lerignac"),   _("Touverac"),  _("Guizengeard"),
    _("Melac"),       _("Neuvicq"),    _("Vanzac"),     _("Picq"),      _("Urignac"),
    _("Corignac"),    _("Fleac"),      _("Lonzac"),     _("Vergt"),     _("Queyssac"),
    _("Liorac"),      _("Echourgnac"), _("Cazelon"),    _("Eypau"),     _("Carignan"),
    _("Monbazillac"), _("Jonzac"),     _("Pons"),       _("Jumilhac"),  _("Fenouilledes"),
    _("Laguiolet"),   _("Saujon"),     _("Eymoutiers"), _("Eygurande"), _("Eauze"),
    _("Labouheyre"),  0
]);

const shktools = static_array("shktools", ptr_to(char), null, [
    /* Spmi */
    _("Ymla"), _("Eed-morra"), _("Elan Lapinski"), _("Cubask"), _("Nieb"), _("Bnowr Falr"),
    _("Sperc"), _("Noskcirdneh"), _("Yawolloh"), _("Hyeghu"), _("Niskal"), _("Trahnil"),
    _("Htargcm"), _("Enrobwem"), _("Kachzi Rellim"), _("Regien"), _("Donmyar"), _("Yelpur"),
    _("Nosnehpets"), _("Stewe"), _("Renrut"), _("Senna Hut"), _("-Zlaw"), _("Nosalnef"),
    _("Rewuorb"), _("Rellenk"), _("Yad"), _("Cire Htims"), _("Y-crad"), _("Nenilukah"),
    _("Corsh"), _("Aned"), _("Dark Eery"), _("Niknar"), _("Lapu"), _("Lechaim"),
    _("Rebrol-nek"), _("AlliWar Wickson"), _("Oguhmk"), _("Telloc Cyaj"),

    0
]);

const shklight = static_array("shklight", ptr_to(char), null, [
    /* Romania */
    _("Zarnesti"), _("Slanic"), _("Nehoiasu"), _("Ludus"), _("Sighisoara"), _("Nisipitu"),
    _("Razboieni"), _("Bicaz"), _("Dorohoi"), _("Vaslui"), _("Fetesti"), _("Tirgu Neamt"),
    _("Babadag"), _("Zimnicea"), _("Zlatna"), _("Jiu"), _("Eforie"), _("Mamaia"),
    /* Bulgaria */
    _("Silistra"), _("Tulovo"), _("Panagyuritshte"), _("Smolyan"), _("Kirklareli"), _("Pernik"),
    _("Lom"), _("Haskovo"), _("Dobrinishte"), _("Varvara"), _("Oryahovo"), _("Troyan"),
    _("Lovech"), _("Sliven"), 0
]);

const shkgeneral = static_array("shkgeneral", ptr_to(char), null, [
    /* Suriname */
    _("Hebiwerie"),    _("Possogroenoe"), _("Asidonhopo"),   _("Manlobbi"),
    _("Adjama"),       _("Pakka Pakka"),  _("Kabalebo"),     _("Wonotobo"),
    _("Akalapi"),      _("Sipaliwini"),
    /* Greenland */
    _("Annootok"),     _("Upernavik"),    _("Angmagssalik"),
    /* N. Canada */
    _("Aklavik"),      _("Inuvik"),       _("Tuktoyaktuk"),  _("Chicoutimi"),
    _("Ouiatchouane"), _("Chibougamau"),  _("Matagami"),     _("Kipawa"),
    _("Kinojevis"),    _("Abitibi"),      _("Maganasipi"),
    /* Iceland */
    _("Akureyri"),     _("Kopasker"),     _("Budereyri"),    _("Akranes"),
    _("Bordeyri"),     _("Holmavik"),     0
]);

const shkhealthfoods = static_array("shkhealthfoods", ptr_to(char), null, [
    /* Tibet */
    _("Ga'er"),    _("Zhangmu"),   _("Rikaze"),   _("Jiangji"),     _("Changdu"),
    _("Linzhi"),   _("Shigatse"),  _("Gyantse"),  _("Ganden"),      _("Tsurphu"),
    _("Lhasa"),    _("Tsedong"),   _("Drepung"),
    /* Hippie names */
    _("=Azura"),   _("=Blaze"),    _("=Breanna"), _("=Breezy"),     _("=Dharma"),
    _("=Feather"), _("=Jasmine"),  _("=Luna"),    _("=Melody"),     _("=Moonjava"),
    _("=Petal"),   _("=Rhiannon"), _("=Starla"),  _("=Tranquilla"), _("=Windsong"),
    _("=Zennia"),  _("=Zoe"),      _("=Zora"),    0
]);

/*
 * To add new shop types, all that is necessary is to edit the shtypes[]
 * array.  See mkroom.h for the structure definition.  Typically, you'll
 * have to lower some or all of the probability fields in old entries to
 * free up some percentage for the new type.
 *
 * The placement type field is not yet used but might be someday.
 *
 * The iprobs array in each entry defines the probabilities for various kinds
 * of objects to be present in the given shop type.  You can associate with
 * each percentage either a generic object type (represented by one of the
 * *_CLASS enum value) or a specific object enum value.
 * In the latter case, prepend it with a unary minus so the code can know
 * (by testing the sign) whether to use mkobj() or mksobj().
 * shtypes[] is externally referenced from mkroom.c, mon.c and shk.c.
 *
 * The second, usually shorter, store type name is used in automatically
 * generated annotations for #overview.  If Null, the first name gets used.
 */
export const shtypes = static_array("shtypes", struct_shclass, null, [
    { name: _("general store"), annotation: 0,
      symb: RANDOM_CLASS,
      prob: 42,
      shdist: D_SHOP,
      iprobs: [ { iprob: 100, itype: RANDOM_CLASS },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 } ],
      shknms: shkgeneral },
    { name: _("used armor dealership"), annotation: _("armor shop"),
      symb: ARMOR_CLASS,
      prob: 14,
      shdist: D_SHOP,
      iprobs: [ { iprob: 90, itype: ARMOR_CLASS },
        { iprob: 10, itype: WEAPON_CLASS },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 } ],
      shknms: shkarmors },
    { name: _("second-hand bookstore"), annotation: _("scroll shop"),
      symb: SCROLL_CLASS,
      prob: 10,
      shdist: D_SHOP,
      iprobs: [ { iprob: 90, itype: SCROLL_CLASS },
        { iprob: 10, itype: SPBOOK_CLASS },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 } ],
      shknms: shkbooks },
    { name: _("liquor emporium"), annotation: _("potion shop"),
      symb: POTION_CLASS,
      prob: 10,
      shdist: D_SHOP,
      iprobs: [ { iprob: 100, itype: POTION_CLASS },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 } ],
      shknms: shkliquors },
    { name: _("antique weapons outlet"), annotation: _("weapon shop"),
      symb: WEAPON_CLASS,
      prob: 5,
      shdist: D_SHOP,
      iprobs: [ { iprob: 90, itype: WEAPON_CLASS },
        { iprob: 10, itype: ARMOR_CLASS },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 } ],
      shknms: shkweapons },
    { name: _("delicatessen"), annotation: _("food shop"),
      symb: FOOD_CLASS,
      prob: 5,
      shdist: D_SHOP,
      iprobs: [ { iprob: 83, itype: FOOD_CLASS },
        { iprob: 5, itype: -POT_FRUIT_JUICE },
        { iprob: 4, itype: -POT_BOOZE },
        { iprob: 5, itype: -POT_WATER },
        { iprob: 3, itype: -ICE_BOX },
        { iprob: 0, itype: 0 } ],
      shknms: shkfoods },
    { name: _("jewelers"), annotation: _("ring shop"),
      symb: RING_CLASS,
      prob: 3,
      shdist: D_SHOP,
      iprobs: [ { iprob: 85, itype: RING_CLASS },
        { iprob: 10, itype: GEM_CLASS },
        { iprob: 5, itype: AMULET_CLASS },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 } ],
      shknms: shkrings },
    { name: _("quality apparel and accessories"), annotation: _("wand shop"),
      symb: WAND_CLASS,
      prob: 3,
      shdist: D_SHOP,
      iprobs: [ { iprob: 90, itype: WAND_CLASS },
        { iprob: 5, itype: -LEATHER_GLOVES },
        { iprob: 5, itype: -ELVEN_CLOAK },
        { iprob: 0, itype: 0 } ],
      shknms: shkwands },
    { name: _("hardware store"), annotation: _("tool shop"),
      symb: TOOL_CLASS,
      prob: 3,
      shdist: D_SHOP,
      iprobs: [ { iprob: 100, itype: TOOL_CLASS },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 } ],
      shknms: shktools },
    { name: _("rare books"), annotation: _("bookstore"),
      symb: SPBOOK_CLASS,
      prob: 3,
      shdist: D_SHOP,
      iprobs: [ { iprob: 90, itype: SPBOOK_CLASS },
        { iprob: 10, itype: SCROLL_CLASS },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 },
        { iprob: 0, itype: 0 } ],
      shknms: shkbooks },
    { name: _("health food store"), annotation: _("vegetarian food shop"),
      symb: FOOD_CLASS,
      prob: 2,
      shdist: D_SHOP,
      iprobs: [ { iprob: 70, itype: VEGETARIAN_CLASS },
        { iprob: 20, itype: -POT_FRUIT_JUICE },
        { iprob: 4, itype: -POT_HEALING },
        { iprob: 3, itype: -POT_FULL_HEALING },
        { iprob: 2, itype: -SCR_FOOD_DETECTION },
        { iprob: 1, itype: -LUMP_OF_ROYAL_JELLY } ],
      shknms: shkhealthfoods },
    /* Shops below this point are "unique".  That is they must all have a
     * probability of zero.  They are only created via the special level
     * loader.
     */
    { name: _("lighting store"), annotation: _("lighting shop"),
      symb: TOOL_CLASS,
      prob: 0,
      shdist: D_SHOP,
      iprobs: [ { iprob: 30, itype: -WAX_CANDLE },
        { iprob: 44, itype: -TALLOW_CANDLE },
        { iprob: 5, itype: -BRASS_LANTERN },
        { iprob: 9, itype: -OIL_LAMP },
        { iprob: 3, itype: -MAGIC_LAMP },
        { iprob: 5, itype: -POT_OIL },
        { iprob: 2, itype: -WAN_LIGHT },
        { iprob: 1, itype: -SCR_LIGHT },
        { iprob: 1, itype: -SPE_LIGHT } ],
      shknms: shklight },
    /* sentinel */
    { name: 0, annotation: 0,
      symb: 0,
      prob: 0,
      shdist: 0,
      iprobs: [ { iprob: 0, itype: 0 }, { iprob: 0, itype: 0 }, { iprob: 0, itype: 0 }, { iprob: 0, itype: 0 }, { iprob: 0, itype: 0 }, { iprob: 0, itype: 0 } ],
      shknms: null }
]);

/* #if 0: not in this build */

/* decide whether an object or object type is considered vegetarian;
   for types, items which might go either way are assumed to be veggy */
function veggy_item(obj, otyp) { /* boolean */
    let corpsenm;
    let oclass;

    if (obj) {
        /* actual object; will check tin content and corpse species */
        otyp = obj.otyp;
        oclass = obj.oclass;
        corpsenm = obj.corpsenm;
    } else {
        /* just a type; caller will have to handle tins and corpses */
        oclass = objects[otyp].oc_class;
        corpsenm = PM_LICHEN; /* veggy standin */
    }

    if (oclass == FOOD_CLASS) {
        if (objects[otyp].oc_material == VEGGY || otyp == EGG)
            return TRUE;
        if (otyp == TIN && corpsenm == NON_PM) /* implies obj is non-null */
            return (+(obj.spe == 1)); /* 0 = empty, 1 = spinach */
        if (otyp == TIN || otyp == CORPSE)
            return (+(ismnum(corpsenm) && vegetarian(mons[corpsenm])));
    }
    return FALSE;
}

function shkveg() { /* int */
    const $frame = stack_frame(); try {
    let i, j, maxprob, prob;
    let oclass = FOOD_CLASS;
    let ok = stack_array(int, NUM_OBJECTS);

    memset(addr_of(ok), 0, sizeof(array_of(int, NUM_OBJECTS))); /* lint suppression */
    j = maxprob = 0;
    for (i = svb.bases[oclass]; i < NUM_OBJECTS; ++i) {
        if (objects[i].oc_class != oclass)
            break;

        if (veggy_item(null, i)) {
            ok[j++] = i;
            maxprob += objects[i].oc_prob;
        }
    }
    if (maxprob < 1)
        panic(_("shkveg no veggy objects"));
    prob = rnd(maxprob);

    j = 0;
    i = ok[0];
    while ((prob -= objects[i].oc_prob) > 0) {
        j++;
        i = ok[j];
    }

    if (objects[i].oc_class != oclass || !OBJ_NAME(objects[i]))
        panic(_("shkveg probtype error, oclass=%d i=%d"), oclass, i);
    return i;
    } finally { stack_pop($frame); }
}

/* make a random item for health food store */
function mkveggy_at(sx, sy) { /* void */
    let obj = mksobj_at(shkveg(), sx, sy, TRUE, TRUE);

    if (obj && obj.otyp == TIN)
        set_tin_variety(obj, HEALTHY_TIN);
    return;
}

/* make an object of the appropriate type for a shop square */
function mkshobj_at(shp, sx, sy, mkspecl) { /* void */
    let mtmp;
    let ptr;
    let atype;

    /* 3.6 tribute */
    if (mkspecl && (!strcmp(shp.name, _("rare books"))
                    || !strcmp(shp.name, _("second-hand bookstore")))) {
        let novel = mksobj_at(SPE_NOVEL, sx, sy, FALSE, FALSE);

        if (novel)
            svc.context.tribute.bookstock = TRUE;
        return;
    }

    if (rn2(100) < depth(u.uz) && !MON_AT(sx, sy)
        && (ptr = mkclass(S_MIMIC, 0)) != null
        && (mtmp = makemon(ptr, sx, sy, NO_MM_FLAGS)) != null) {
        /* nothing */
    } else {
        atype = get_shop_item(ptr_diff(shp, shtypes[0]));
        if (atype == VEGETARIAN_CLASS)
            mkveggy_at(sx, sy);
        else if (atype < 0)
            mksobj_at(-atype, sx, sy, TRUE, TRUE);
        else
            mkobj_at(atype, sx, sy, TRUE);
    }
}

/* extract a shopkeeper name for the given shop type */
function nameshk(shk, nlp) { /* void */
    let i, trycnt, names_avail;
    let shname = 0;
    let mtmp;
    let name_wanted = int(shk.m_id);
    let sptr;

    if ((addr_of(nlp) == addr_of(shklight)) && In_mines(u.uz)
        && (sptr = Is_special(u.uz)) != null && sptr.flags.town) {
        /* special-case minetown lighting shk */
        shname = _("+Izchak");
        shk.female = FALSE;
    } else {
        /* We want variation from game to game, without needing the save
           and restore support which would be necessary for randomization;
           try not to make too many assumptions about time_t's internals;
           use ledger_no rather than depth to keep minetown distinct. */
        let nseed = int(Math.trunc(ubirthday / 257));

        name_wanted += ledger_no(u.uz) + (nseed % 13) - (nseed % 5);
        if (name_wanted < 0)
            name_wanted += (13 + 5);
        shk.female = name_wanted & 1;

        for (names_avail = 0; nlp[names_avail]; names_avail++)
            continue;
        assert(names_avail > 0);
        name_wanted = name_wanted % names_avail;

        for (trycnt = 0; trycnt < 50; trycnt++) {
            if ((addr_of(nlp) == addr_of(shktools))) {
                shname = shktools[rn2(names_avail)];
                shk.female = 0; /* reversed below for '_' prefix */
            } else if (name_wanted < names_avail) {
                shname = nlp[name_wanted];
            } else if ((i = rn2(names_avail)) != 0) {
                shname = nlp[i - 1];
            } else if ((addr_of(nlp) != addr_of(shkgeneral))) {
                nlp = shkgeneral; /* try general names */
                for (names_avail = 0; nlp[names_avail]; names_avail++)
                    continue;
                continue; /* next `trycnt' iteration */
            } else {
                shname = shk.female ? _("-Lucrezia") : _("+Dirk");
            }
            if (chars[shname] == ord('_') || chars[shname] == ord('-'))
                shk.female = 1;
            else if (chars[shname] == ord('|') || chars[shname] == ord('+'))
                shk.female = 0;

            /* is name already in use on this level? */
            for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
                if (DEADMONSTER(mtmp) || (mtmp == shk) || !mtmp.isshk)
                    continue;
                assert(has_eshk(mtmp));
                if (strcmp(ESHK(mtmp).shknam, shname))
                    continue;
                name_wanted = names_avail; /* try a random name */
                break;
            }
            if (!mtmp)
                break; /* new name */
        }
    }
    strncpy(ESHK(shk).shknam, shname, PL_NSIZ);
    chars[ESHK(shk).shknam + (PL_NSIZ - 1)] = 0;
}

export function neweshk(mtmp) { /* void */
    if (!mtmp.mextra)
        mtmp.mextra = newmextra();
    if (!ESHK(mtmp))
        ((mtmp).mextra.eshk) = view_of(struct_eshk, addr_of(alloc(sizeof(struct_eshk))));
    memset(addr_of(ESHK(mtmp)), 0, sizeof(struct_eshk));
    ESHK(mtmp).parentmid = mtmp.m_id;
    ESHK(mtmp).bill_p = null;
}

export function free_eshk(mtmp) { /* void */
    if (mtmp.mextra && ESHK(mtmp)) {
        free(addr_of(ESHK(mtmp)));
        ((mtmp).mextra.eshk) = null;
    }
    mtmp.isshk = 0;
}

/* find a door in room sroom which is good for shop entrance.
   returns -1 if no good door found, or the svd.doors index
   and the door coordinates in sx, sy */
function good_shopdoor(sroom, sx, sy) { /* int */
    let i;

    for (i = 0; i < sroom.doorct; i++) {
        let di = sroom.fdoor + i;

        sx[0] = ptr_add(svd.doors, di).x;
        sy[0] = ptr_add(svd.doors, di).y;

        /* check that the shopkeeper placement is sane */
        if (sroom.irregular) {
            let rmno = int((ptr_diff(sroom, svr.rooms[0]) + ROOMOFFSET));

            if (isok(sx[0] - 1, sy[0]) && !levl()[sx[0] - 1][sy[0]].edge
                && (levl()[sx[0] - 1][sy[0]].roomno) == rmno)
                (sx[0])--;
            else if (isok(sx[0] + 1, sy[0]) && !levl()[sx[0] + 1][sy[0]].edge
                     && (levl()[sx[0] + 1][sy[0]].roomno) == rmno)
                (sx[0])++;
            else if (isok(sx[0], sy[0] - 1) && !elt(levl()[sx[0]], sy[0] - 1).edge
                     && (elt(levl()[sx[0]], sy[0] - 1).roomno) == rmno)
                (sy[0])--;
            else if (isok(sx[0], sy[0] + 1) && !levl()[sx[0]][sy[0] + 1].edge
                     && (levl()[sx[0]][sy[0] + 1].roomno) == rmno)
                (sy[0])++;
            else
                continue;
        } else if (sx[0] == sroom.lx - 1) {
            (sx[0])++;
        } else if (sx[0] == sroom.hx + 1) {
            (sx[0])--;
        } else if (sy[0] == sroom.ly - 1) {
            (sy[0])++;
        } else if (sy[0] == sroom.hy + 1) {
            (sy[0])--;
        } else {
            continue;
        }
        return di;
    }
    return -1;
}

/* create a new shopkeeper in the given room */
function shkinit(shp, sroom) { /* int */
    const $frame = stack_frame(); try {
    let sh;
    let sx = stack_var(coordxy), sy = stack_var(coordxy);
    let shk;
    let eshkp;

    /* place the shopkeeper in the given room */
    sh = good_shopdoor(sroom, sx, sy);
    if (sh < 0) {
        /* Said to happen sometimes, but I have never seen it. */
        /* Supposedly fixed by fdoor change in mklev.c */
        if (wizard()) {
            let j = sroom.doorct;

            impossible(_("Where is shopdoor?"));
            pline(_("Room at (%d,%d),(%d,%d)."), sroom.lx, sroom.ly, sroom.hx,
                  sroom.hy);
            pline(_("doormax=%d doorct=%d fdoor=%d"), gd.doorindex, sroom.doorct,
                  sh);
            while (j--) {
                pline(_("door [%d,%d]"), ptr_add(svd.doors, sh).x, ptr_add(svd.doors, sh).y);
                sh++;
            }
            display_nhwindow()(WIN_MESSAGE, FALSE);
        }

        return -1;
    }

    if (MON_AT(sx[0], sy[0]))
        rloc(m_at(sx[0], sy[0]), RLOC_NOMSG); /* insurance */

    /* now initialize the shopkeeper monster structure */
    if (!(shk = makemon(mons[PM_SHOPKEEPER], sx[0], sy[0], MM_ESHK)))
        return -1;
    eshkp = ESHK(shk); /* makemon(...,MM_ESHK) allocates this */
    shk.isshk = shk.mpeaceful = 1;
    set_malign(shk);
    shk.msleeping = 0;
    mon_learns_traps(shk, ALL_TRAPS); /* we know all the traps already */
    eshkp.shoproom = schar((ptr_diff(sroom, svr.rooms[0]) + ROOMOFFSET));
    sroom.resident = shk;
    eshkp.shoptype = sroom.rtype;
    assign_level(eshkp.shoplevel, u.uz);
    struct_assign(eshkp.shd, ptr_add(svd.doors, sh));
    eshkp.shk.x = sx[0];
    eshkp.shk.y = sy[0];
    eshkp.robbed = eshkp.credit = eshkp.debit = eshkp.loan = 0;
    eshkp.following = eshkp.surcharge = eshkp.dismiss_kops = FALSE;
    eshkp.billct = eshkp.visitct = 0;
    eshkp.bill_p = null;
    chars[eshkp.customer + 0] = ord('\0');
    mkmonmoney(shk, 1000 + 30 * rnd(100)); /* initial capital */
    if ((addr_of(shp.shknms) == addr_of(shkrings)))
        mongets(shk, TOUCHSTONE);
    if ((addr_of(shp.shknms) == addr_of(shktools)) || (addr_of(shp.shknms) == addr_of(shkwands)) ||
        ((addr_of(shp.shknms) == addr_of(shkrings)) && rn2(2)) ||
        ((addr_of(shp.shknms) == addr_of(shkgeneral)) && rn2(5)))
        mongets(shk, SCR_CHARGING);
    nameshk(shk, shp.shknms);

    return sh;
    } finally { stack_pop($frame); }
}

function stock_room_goodpos(sroom, rmno, sh, sx, sy) { /* boolean */
    if (sroom.irregular) {
        if (levl()[sx][sy].edge
            || (levl()[sx][sy].roomno) != rmno
            || distmin(sx, sy, ptr_add(svd.doors, sh).x, ptr_add(svd.doors, sh).y) <= 1)
            return FALSE;
    } else if ((sx == sroom.lx && ptr_add(svd.doors, sh).x == sx - 1)
               || (sx == sroom.hx && ptr_add(svd.doors, sh).x == sx + 1)
               || (sy == sroom.ly && ptr_add(svd.doors, sh).y == sy - 1)
               || (sy == sroom.hy && ptr_add(svd.doors, sh).y == sy + 1))
        return FALSE;

    /* only generate items on solid floor squares */
    if (!IS_ROOM(levl()[sx][sy].typ)) {
        return FALSE;
    }

    return TRUE;
}

/* stock a newly-created room with objects */
export function stock_room(shp_indx, sroom) { /* void */
    const $frame = stack_frame(); try {
    /*
     * Someday soon we'll dispatch on the shdist field of shclass to do
     * different placements in this routine. Currently it only supports
     * shop-style placement (all squares except a row nearest the first
     * door get objects).
     */
    let sx, sy, sh;
    let stockcount = 0, specialspot = 0;
    let buf = stack_array(char, BUFSZ);
    let rmno = int((ptr_diff(sroom, svr.rooms[0]) + ROOMOFFSET));
    let shp = shtypes[shp_indx];

    /* first, try to place a shopkeeper in the room */
    if ((sh = shkinit(shp, sroom)) < 0)
        return;

    /* make sure no doorways without doors, and no trapped doors, in shops */
    sx = ptr_add(svd.doors, sroom.fdoor).x;
    sy = ptr_add(svd.doors, sroom.fdoor).y;
    if (levl()[sx][sy].flags == D_NODOOR) {
        levl()[sx][sy].flags = D_ISOPEN;
        newsym(sx, sy);
    }
    if (levl()[sx][sy].typ == SDOOR) {
        cvt_sdoor_to_door(levl()[sx][sy]); /* .typ = DOOR */
        newsym(sx, sy);
    }
    if (levl()[sx][sy].flags & D_TRAPPED)
        levl()[sx][sy].flags = D_LOCKED;

    if (levl()[sx][sy].flags == D_LOCKED) {
        let m = sx, n = sy;

        if (inside_shop(sx + 1, sy))
            m--;
        else if (inside_shop(sx - 1, sy))
            m++;
        if (inside_shop(sx, sy + 1))
            n--;
        else if (inside_shop(sx, sy - 1))
            n++;
        sprintf(buf, _("Closed for inventory"));
        make_engr_at(m, n, buf, 0, 0, DUST);
        if (levl()[m][n].typ != CORR && levl()[m][n].typ != ROOM)
            levl()[m][n].typ = (Is_special(u.uz)
                              || chars[in_rooms(m, n, 0)]) ? ROOM : CORR;
    }

    if (svc.context.tribute.enabled && !svc.context.tribute.bookstock) {
        /*
         * Out of the number of spots where we're actually
         * going to put stuff, randomly single out one in particular.
         */
        for (sx = sroom.lx; sx <= sroom.hx; sx++)
            for (sy = sroom.ly; sy <= sroom.hy; sy++)
                if (stock_room_goodpos(sroom, rmno, sh, sx,sy))
                    stockcount++;
        specialspot = rnd(stockcount);
        stockcount = 0;
    }

    for (sx = sroom.lx; sx <= sroom.hx; sx++)
        for (sy = sroom.ly; sy <= sroom.hy; sy++)
            if (stock_room_goodpos(sroom, rmno, sh, sx,sy)) {
                stockcount++;
                mkshobj_at(shp, sx, sy,
                           (stockcount && (stockcount == specialspot) ? 1 : 0));
            }

    /*
     * Special monster placements (if any) should go here: that way,
     * monsters will sit on top of objects and not the other way around.
     */

    /* Hack for Orcus's level: it's a ghost town, get rid of shopkeepers */
    if (on_level(u.uz, svd.dungeon_topology.d_orcus_level)) {
        let mtmp = shop_keeper(rmno);
        mongone(mtmp);
    }

    svl.level.flags.has_shop = TRUE;
    } finally { stack_pop($frame); }
}

/* does shkp's shop stock this item type? */
export function saleable(shkp, obj) { /* boolean */
    let i, shp_indx = ESHK(shkp).shoptype - SHOPBASE;
    let shp = shtypes[shp_indx];

    if (shp.symb == RANDOM_CLASS)
        return TRUE;
    for (i = 0; i < SIZE(shtypes[0].iprobs) && shp.iprobs[i].iprob; i++) {
        /* pseudo-class needs special handling */
        if (shp.iprobs[i].itype == VEGETARIAN_CLASS) {
            if (veggy_item(obj, 0))
                return TRUE;
        } else if ((shp.iprobs[i].itype < 0)
                       ? shp.iprobs[i].itype == -obj.otyp
                       : shp.iprobs[i].itype == obj.oclass)
            return TRUE;
    }
    /* not found */
    return FALSE;
}

/* positive value: class; negative value: specific object type.
   can also return non-existing object class (eg. VEGETARIAN_CLASS) */
export function get_shop_item(type) { /* int */
    let shp = ptr_add(shtypes[0], type);
    let i, j;

    /* select an appropriate object type at random */
    for (j = rnd(100), i = 0; (j -= shp.iprobs[i].iprob) > 0; i++)
        continue;

    return shp.iprobs[i].itype;
}

/* version of shkname() for beginning of sentence */
export function Shknam(mtmp) { /* char * */
    let nam = shkname(mtmp);

    /* 'nam[]' is almost certainly already capitalized, but be sure */
    chars[nam + 0] = highc(chars[nam + 0]);
    return nam;
}

/* shopkeeper's name, without any visibility constraint; if hallucinating,
   will yield some other shopkeeper's name (not necessarily one residing
   in the current game's dungeon, or who keeps same type of shop) */
export function shkname(mtmp) { /* char * */
    let nam;
    let save_isshk = mtmp.isshk;

    mtmp.isshk = 0; /* don't want mon_nam() calling shkname() */
    /* get a modifiable name buffer along with fallback result */
    nam = noit_mon_nam(mtmp);
    mtmp.isshk = save_isshk;

    if (!mtmp.isshk) {
        impossible(_("shkname: \"%s\" is not a shopkeeper."), nam);
    } else if (!has_eshk(mtmp)) {
        panic(_("shkname: shopkeeper \"%s\" lacks 'eshk' data."), nam);
    } else {
        let shknm = ESHK(mtmp).shknam;

        if (Hallucination() && !program_state.gameover) {
            let nlp;
            let num;

            /* count the number of non-unique shop types;
               pick one randomly, ignoring shop generation probabilities;
               pick a name at random from that shop type's list */
            for (num = 0; num < SIZE(shtypes); num++)
                if (shtypes[num].prob == 0)
                    break;
            if (num > 0) {
                nlp = shtypes[rn2(num)].shknms;
                for (num = 0; nlp[num]; num++)
                    continue;
                if (num > 0)
                    shknm = nlp[rn2(num)];
            }
        }
        /* strip prefix if present */
        if (!letter(chars[shknm]))
            ++shknm;
        strcpy(nam, shknm);
    }
    return nam;
}

export function shkname_is_pname(mtmp) { /* boolean */
    let shknm = ESHK(mtmp).shknam;

    return (+(chars[shknm] == ord('-') || chars[shknm] == ord('+') || chars[shknm] == ord('=')));
}

export function is_izchak(shkp, override_hallucination) { /* boolean */
    let shknm;

    if (Hallucination() && !override_hallucination)
        return FALSE;
    if (!shkp.isshk)
        return FALSE;
    /* outside of town, Izchak becomes just an ordinary shopkeeper */
    if (!in_town(shkp.mx, shkp.my))
        return FALSE;
    shknm = ESHK(shkp).shknam;
    /* skip "+" prefix */
    if (!letter(chars[shknm]))
        ++shknm;
    return (+!strcmp(shknm, _("Izchak")));
}

/*shknam.c*/

import {
    AMULET_CLASS, ARMOR_CLASS, FOOD_CLASS, GEM_CLASS, MAXOCLASSES, POTION_CLASS, RANDOM_CLASS,
    RING_CLASS, SCROLL_CLASS, SPBOOK_CLASS, S_MIMIC, TOOL_CLASS, WAND_CLASS, WEAPON_CLASS,
} from "./defsym.h.js";
import { DUST } from "./engrave.h.js";
import { wizard } from "./flag.h.macros.js";
import { BUFSZ, FALSE, PL_NSIZ, TRUE, coordxy } from "./global.h.js";
import { HEALTHY_TIN, MM_ESHK, NO_MM_FLAGS, RLOC_NOMSG } from "./hack.h.js";
import { struct_eshk } from "./mextra.h.js";
import { ESHK, has_eshk } from "./mextra.h.macros.js";
import { D_SHOP, ROOMOFFSET, SHOPBASE, struct_shclass } from "./mkroom.h.js";
import { vegetarian } from "./mondata.h.macros.js";
import { DEADMONSTER, ismnum } from "./monst.h.macros.js";
import { NON_PM, PM_LICHEN, PM_SHOPKEEPER } from "./monsters.h.js";
import { VEGGY } from "./objclass.h.js";
import { OBJ_NAME } from "./objclass.h.macros.js";
import {
    BRASS_LANTERN, CORPSE, EGG, ELVEN_CLOAK, ICE_BOX, LEATHER_GLOVES, LUMP_OF_ROYAL_JELLY,
    MAGIC_LAMP, NUM_OBJECTS, OIL_LAMP, POT_BOOZE, POT_FRUIT_JUICE, POT_FULL_HEALING, POT_HEALING,
    POT_OIL, POT_WATER, SCR_CHARGING, SCR_FOOD_DETECTION, SCR_LIGHT, SPE_LIGHT, SPE_NOVEL,
    TALLOW_CANDLE, TIN, TOUCHSTONE, WAN_LIGHT, WAX_CANDLE,
} from "./objects.h.js";
import { CORR, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, ROOM, SDOOR } from "./rm.h.js";
import { IS_ROOM, MON_AT, fmon, levl, m_at } from "./rm.h.macros.js";
import { ALL_TRAPS } from "./trap.h.js";
import { display_nhwindow } from "./winprocs.h.macros.js";
import { Hallucination } from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, schar, sizeof } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { assert, free, memset, sprintf, strcmp, strcpy, strncpy } from "../rt/libc.js";
import { stack_array, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, elt, ptr_add, ptr_diff, ptr_to, struct_assign, view_of,
} from "../rt/struct.js";
import { alloc } from "./alloc.js";
import { isok } from "./cmd.js";
import { gd, program_state, svb, svc, svd, svl, svr, u } from "./decl.js";
import { cvt_sdoor_to_door } from "./detect.js";
import { newsym } from "./display.js";
import { noit_mon_nam } from "./do_name.js";
import { In_mines, Is_special, assign_level, depth, ledger_no, on_level } from "./dungeon.js";
import { set_tin_variety } from "./eat.js";
import { panic } from "./end.js";
import { make_engr_at } from "./engrave.js";
import { in_rooms, in_town } from "./hack.js";
import { distmin, highc, letter } from "./hacklib.js";
import { makemon, mkclass, mkmonmoney, mongets, newmextra, set_malign } from "./makemon.js";
import { mkobj_at, mksobj_at } from "./mkobj.js";
import { mongone } from "./mon.js";
import { mon_learns_traps } from "./mondata.js";
import { mons } from "./monst.js";
import { objects } from "./objects.js";
import { impossible, pline } from "./pline.js";
import { rn2, rnd } from "./rnd.js";
import { inside_shop, shop_keeper } from "./shk.js";
import { rloc } from "./teleport.js";
