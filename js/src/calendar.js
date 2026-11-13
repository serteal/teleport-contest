/* NetHack 5.0	calendar.c	$NHDT-Date: 1706213796 2024/01/25 20:16:36 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.116 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2007. */
/* Copyright (c) Robert Patrick Rankin, 1991                      */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * The game's clock is New York civil time (US daylight-saving rules as in
 * tzdata's America/New_York).  A fixed datetime (NETHACK_FIXED_DATETIME) is
 * read as mktime() reads it when tm_isdst is already set: as daylight time,
 * whatever the season.  Dates are then rendered as New York civil time.
 */
export const NHJS_EST_OFFSET_SECONDS = (-5 * 60 * 60);
export const NHJS_EDT_OFFSET_SECONDS = (-4 * 60 * 60);
export const NHJS_MKTIME_ISDST = 1;

function nhjs_leap_year(year) { /* int */
    return +(year % 4 == 0 && (year % 100 != 0 || year % 400 == 0));
}

function nhjs_days_from_civil(year, month, day) { /* long long */
    let era;
    let yoe, doy, doe;

    year -= +(month <= 2);
    era = Math.trunc((year >= 0 ? year : year - 399) / 400);
    yoe = unsigned((year - era * 400));
    doy = unsigned(unsigned(Math.trunc(unsigned(unsigned(Math.imul(153, unsigned(month + unsigned((month > 2 ? -3 : 9))))) + 2) / 5) + day) - 1);
    doe = unsigned(unsigned(unsigned(unsigned(Math.imul(yoe, 365)) + Math.trunc(yoe / 4)) - Math.trunc(yoe / 100)) + doy);
    return era * 146097 + doe - 719468;
}

function nhjs_civil_from_days(z, year, month,
                     day) { /* void */
    let era;
    let doe, yoe, doy, mp;

    z += 719468;
    era = Math.trunc((z >= 0 ? z : z - 146096) / 146097);
    doe = unsigned((z - era * 146097));
    yoe = Math.trunc(unsigned(unsigned(unsigned(doe - Math.trunc(doe / 1460)) + Math.trunc(doe / 36524)) - Math.trunc(doe / 146096)) / 365);
    year[0] = int(yoe) + int(era) * 400;
    doy = unsigned(doe - unsigned(unsigned(unsigned(Math.imul(365, yoe)) + Math.trunc(yoe / 4)) - Math.trunc(yoe / 100)));
    mp = Math.trunc(unsigned(unsigned(Math.imul(5, doy)) + 2) / 153);
    day[0] = unsigned(unsigned(doy - Math.trunc(unsigned(unsigned(Math.imul(153, mp)) + 2) / 5)) + 1);
    month[0] = unsigned(mp + unsigned((mp < 10 ? 3 : -9)));
    year[0] += +(month[0] <= 2);
}

function nhjs_weekday_from_days(days) { /* int */
    let wday = ((days + 4) % 7);

    if (wday < 0)
        wday += 7;
    return wday;
}

function nhjs_nth_sunday_mday(year, month, nth) { /* unsigned */
    let days = nhjs_days_from_civil(year, month, 1);
    let first_sunday = unsigned((1 + ((7 - nhjs_weekday_from_days(days)) % 7)));

    return unsigned(first_sunday + unsigned(Math.imul(7, unsigned(nth - 1))));
}

function nhjs_epoch_from_civil_offset(year, month, day,
                             hour, minute, second,
                             offset) { /* long long */
    let days = nhjs_days_from_civil(year, month, day);

    return days * 86400 + hour * 3600
           + minute * 60 + second - offset;
}

function nhjs_dst_for_epoch(epoch) { /* int */
    const $frame = stack_frame(); try {
    let shifted = epoch + NHJS_EST_OFFSET_SECONDS;
    let days = Math.trunc(shifted / 86400);
    let year = stack_var(int);
    let month = stack_var(unsigned), day = stack_var(unsigned), march_start, november_end, start_month, end_month;
    let start_epoch, end_epoch;

    if (shifted < 0 && shifted % 86400)
        --days;
    nhjs_civil_from_days(days, year, month, day);
    /* US rules as in tzdata's America/New_York: since 2007 the second
       Sunday of March to the first Sunday of November; 1987-2006 the
       first Sunday of April to the last Sunday of October; 1967-1986 the
       last Sundays of April and October (1974 and 1975 began early). */
    if (year[0] < 1967)
        return 0;
    if (year[0] >= 2007) {
        start_month = 3;
        march_start = nhjs_nth_sunday_mday(year[0], 3, 2);
        end_month = 11;
        november_end = nhjs_nth_sunday_mday(year[0], 11, 1);
    } else {
        start_month = 4;
        march_start = year[0] >= 1987 ? nhjs_nth_sunday_mday(year[0], 4, 1)
                                   : nhjs_nth_sunday_mday(year[0], 4, 4);
        if (year[0] < 1987 && unsigned(march_start + 7) <= 30)
            march_start = unsigned(march_start + 7);
        if (year[0] == 1974)
            start_month = 1, march_start = 6;
        else if (year[0] == 1975)
            start_month = 2, march_start = 23;
        end_month = 10;
        november_end = nhjs_nth_sunday_mday(year[0], 10, 4);
        if (unsigned(november_end + 7) <= 31)
            november_end = unsigned(november_end + 7);
    }
    start_epoch = nhjs_epoch_from_civil_offset(
        year[0], start_month, march_start, 2, 0, 0,
        NHJS_EST_OFFSET_SECONDS);
    end_epoch = nhjs_epoch_from_civil_offset(
        year[0], end_month, november_end, 2, 0, 0,
        NHJS_EDT_OFFSET_SECONDS);
    return +(epoch >= start_epoch && epoch < end_epoch);
    } finally { stack_pop($frame); }
}

function nhjs_parse_yyyymmddhhmmss(buf, year, month, day,
                          hour, minute, second) { /* int */
    let i;

    if (!buf || strlen(buf) != 14)
        return 0;
    for (i = 0; i < 14; ++i)
        if (chars[buf + i] < ord('0') || chars[buf + i] > ord('9'))
            return 0;
    year[0] = (chars[buf + 0] - ord('0')) * 1000 + (chars[buf + 1] - ord('0')) * 100
            + (chars[buf + 2] - ord('0')) * 10 + (chars[buf + 3] - ord('0'));
    month[0] = (chars[buf + 4] - ord('0')) * 10 + (chars[buf + 5] - ord('0'));
    day[0] = (chars[buf + 6] - ord('0')) * 10 + (chars[buf + 7] - ord('0'));
    hour[0] = (chars[buf + 8] - ord('0')) * 10 + (chars[buf + 9] - ord('0'));
    minute[0] = (chars[buf + 10] - ord('0')) * 10 + (chars[buf + 11] - ord('0'));
    second[0] = (chars[buf + 12] - ord('0')) * 10 + (chars[buf + 13] - ord('0'));
    if (month[0] < 1 || month[0] > 12 || day[0] < 1 || day[0] > 31 || hour[0] > 23
        || minute[0] > 59 || second[0] > 60)
        return 0;
    if ((month[0] == 4 || month[0] == 6 || month[0] == 9 || month[0] == 11)
        && day[0] > 30)
        return 0;
    if (month[0] == 2
        && day[0] > (nhjs_leap_year(year[0]) ? 29 : 28))
        return 0;
    return 1;
}

function nhjs_fill_tm(t, year, month, day, hour,
             minute, second, isdst) { /* void */
    let days = nhjs_days_from_civil(year, unsigned(month),
                                          unsigned(day));
    let year_start = nhjs_days_from_civil(year, 1, 1);
    let wday = nhjs_weekday_from_days(days);

    t.tm_sec = second;
    t.tm_min = minute;
    t.tm_hour = hour;
    t.tm_mday = day;
    t.tm_mon = month - 1;
    t.tm_year = year - 1900;
    t.tm_wday = wday;
    t.tm_yday = int((days - year_start));
    t.tm_isdst = isdst;
}

function nhjs_time_from_yyyymmddhhmmss(buf) { /* time_t */
    const $frame = stack_frame(); try {
    let year = stack_var(int), month = stack_var(int), day = stack_var(int), hour = stack_var(int), minute = stack_var(int), second = stack_var(int);
    let offset;

    if (!nhjs_parse_yyyymmddhhmmss(buf, year, month, day, hour,
                                   minute, second))
        return 0;
    offset = NHJS_MKTIME_ISDST
                 ? NHJS_EDT_OFFSET_SECONDS
                 : NHJS_EST_OFFSET_SECONDS;
    return nhjs_epoch_from_civil_offset(
        year[0], unsigned((month[0])), unsigned((day[0])), hour[0], minute[0], second[0], offset);
    } finally { stack_pop($frame); }
}

function nhjs_tm_from_time(date) { /* struct tm * */
    const $frame = stack_frame(); try {
    let t = static_struct("nhjs_tm_from_time.t", struct_tm);
    let epoch = date;
    let isdst = nhjs_dst_for_epoch(epoch);
    let shifted = epoch
        + (isdst ? NHJS_EDT_OFFSET_SECONDS
                 : NHJS_EST_OFFSET_SECONDS);

    let days = Math.trunc(shifted / 86400);
    let rem = shifted % 86400;
    let year = stack_var(int), hour, minute, second;
    let month = stack_var(unsigned), day = stack_var(unsigned);

    if (rem < 0) {
        rem += 86400;
        --days;
    }
    nhjs_civil_from_days(days, year, month, day);
    hour = int(Math.trunc(rem / 3600));
    rem %= 3600;
    minute = int(Math.trunc(rem / 60));
    second = (rem % 60);
    nhjs_fill_tm(t, year[0], int((month[0])), int((day[0])), hour, minute, second,
                 isdst);
    return t;
    } finally { stack_pop($frame); }
}

/*
 * Time routines
 *
 * The time is used for:
 *  - seed for rand()
 *  - year on tombstone and yyyymmdd in record file
 *  - phase of the moon (various monsters react to NEW_MOON or FULL_MOON)
 *  - night and midnight (the undead are dangerous at midnight)
 *  - determination of what files are "very old"
 */

/* TIME_type: type of the argument to time(); we actually use &(time_t);
   you might need to define either or both of these to 'long *' in *conf.h */

export function getnow() { /* time_t */
    const $frame = stack_frame(); try {
    let fixed_dt = nh_getenv(_("NETHACK_FIXED_DATETIME"));
    let datetime = stack_var(long, 0);

    if (fixed_dt && chars[fixed_dt]) {
        let parsed = nhjs_time_from_yyyymmddhhmmss(fixed_dt);
        if (parsed != 0)
            return parsed;
    }
    time(datetime);
    return datetime[0];
    } finally { stack_pop($frame); }
}

function getlt() { /* struct tm * */
    let date = getnow();

    return nhjs_tm_from_time(date);
}

export function getyear() { /* int */
    return (1900 + getlt().tm_year);
}

export function yyyymmdd(date) { /* long long */
    let datenum;
    let lt;

    if (date == 0)
        lt = getlt();
    else
        lt = nhjs_tm_from_time(date);

    /* just in case somebody's localtime supplies (year % 100)
       rather than the expected (year - 1900) */
    if (lt.tm_year < 70)
        datenum = lt.tm_year + 2000;
    else
        datenum = lt.tm_year + 1900;
    /* yyyy --> yyyymm */
    datenum = datenum * 100 + (lt.tm_mon + 1);
    /* yyyymm --> yyyymmdd */
    datenum = datenum * 100 + lt.tm_mday;
    return datenum;
}

export function hhmmss(date) { /* long long */
    let timenum;
    let lt;

    if (date == 0)
        lt = getlt();
    else
        lt = nhjs_tm_from_time(date);

    timenum = lt.tm_hour * 10000 + lt.tm_min * 100 + lt.tm_sec;
    return timenum;
}

export function yyyymmddhhmmss(date) { /* char * */
    let datenum;
    let datestr = static_array("yyyymmddhhmmss.datestr", char, 15);
    let lt;

    if (date == 0)
        lt = getlt();
    else
        lt = nhjs_tm_from_time(date);

    /* just in case somebody's localtime supplies (year % 100)
       rather than the expected (year - 1900) */
    if (lt.tm_year < 70)
        datenum = lt.tm_year + 2000;
    else
        datenum = lt.tm_year + 1900;
    Snprintf(datestr, sizeof(array_of(char, 15)), _("%04lld%02d%02d%02d%02d%02d"), datenum, lt.tm_mon + 1, lt.tm_mday, lt.tm_hour, lt.tm_min, lt.tm_sec)

;
    //debugpline1("yyyymmddhhmmss() produced date string %s", datestr);
    return datestr;
}

export function time_from_yyyymmddhhmmss(buf) { /* time_t */
    return nhjs_time_from_yyyymmddhhmmss(buf);
}

/*
 * moon period = 29.53058 days ~= 30, year = 365.2422 days
 * days moon phase advances on first day of year compared to preceding year
 *      = 365.2422 - 12*29.53058 ~= 11
 * years in Metonic cycle (time until same phases fall on the same days of
 *      the month) = 18.6 ~= 19
 * moon phase on first day of year (epact) ~= (11*(year%19) + 29) % 30
 *      (29 as initial condition)
 * current phase in days = first day phase + days elapsed in year
 * 6 moons ~= 177 days
 * 177 ~= 8 reported phases * 22
 * + 11/22 for rounding
 */
export function phase_of_the_moon() { /* int */ /* 0-7, with 0: new, 4: full */
    let lt = getlt();
    let epact, diy, goldn;

    diy = lt.tm_yday;
    goldn = (lt.tm_year % 19) + 1;
    epact = (11 * goldn + 18) % 30;
    if ((epact == 25 && goldn > 11) || epact == 24)
        epact++;

    return (Math.trunc(((((diy + epact) * 6) + 11) % 177) / 22) & 7);
}

export function friday_13th() { /* boolean */
    let lt = getlt();

    /* tm_wday (day of week; 0==Sunday) == 5 => Friday */
    return (+(lt.tm_wday == 5 && lt.tm_mday == 13));
}

export function night() { /* int */
    let hour = getlt().tm_hour;

    return +(hour < 6 || hour > 21);
}

export function midnight() { /* int */
    return +(getlt().tm_hour == 0);
}

/* calendar.c */

import { Snprintf } from "./hacklib.h.macros.js";
import { struct_tm } from "../libc/records.js";
import { char, int, long, ord, sizeof, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { strlen, time } from "../rt/libc.js";
import { stack_var, static_array, static_struct } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { array_of } from "../rt/struct.js";
import { nh_getenv } from "./options.js";
