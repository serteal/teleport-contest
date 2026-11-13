// src/calendar.c: the game's clock is New York civil time, computed without the C library.

const newYorkTime = String.raw`#include "hack.h"

/*
 * The game's clock is New York civil time (US daylight-saving rules as in
 * tzdata's America/New_York).  A fixed datetime (NETHACK_FIXED_DATETIME) is
 * read as mktime() reads it when tm_isdst is already set: as daylight time,
 * whatever the season.  Dates are then rendered as New York civil time.
 */
#define NHJS_EST_OFFSET_SECONDS (-5LL * 60LL * 60LL)
#define NHJS_EDT_OFFSET_SECONDS (-4LL * 60LL * 60LL)
#define NHJS_MKTIME_ISDST 1

staticfn int nhjs_leap_year(int);
staticfn long long nhjs_days_from_civil(int, unsigned, unsigned);
staticfn void nhjs_civil_from_days(long long, int *, unsigned *,
                                   unsigned *);
staticfn int nhjs_weekday_from_days(long long);
staticfn unsigned nhjs_nth_sunday_mday(int, unsigned, unsigned);
staticfn long long nhjs_epoch_from_civil_offset(int, unsigned, unsigned,
                                                int, int, int, long long);
staticfn int nhjs_dst_for_epoch(long long);
staticfn int nhjs_parse_yyyymmddhhmmss(char *, int *, int *, int *, int *,
                                       int *, int *);
staticfn void nhjs_fill_tm(struct tm *, int, int, int, int, int, int, int);
staticfn time_t nhjs_time_from_yyyymmddhhmmss(char *);
staticfn struct tm *nhjs_tm_from_time(time_t);

staticfn int
nhjs_leap_year(int year)
{
    return (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0));
}

staticfn long long
nhjs_days_from_civil(int year, unsigned month, unsigned day)
{
    long long era;
    unsigned yoe, doy, doe;

    year -= month <= 2;
    era = (year >= 0 ? year : year - 399) / 400;
    yoe = (unsigned) (year - era * 400);
    doy = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 + day - 1;
    doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    return era * 146097LL + (long long) doe - 719468LL;
}

staticfn void
nhjs_civil_from_days(long long z, int *year, unsigned *month,
                     unsigned *day)
{
    long long era;
    unsigned doe, yoe, doy, mp;

    z += 719468LL;
    era = (z >= 0 ? z : z - 146096LL) / 146097LL;
    doe = (unsigned) (z - era * 146097LL);
    yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    *year = (int) yoe + (int) era * 400;
    doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    mp = (5 * doy + 2) / 153;
    *day = doy - (153 * mp + 2) / 5 + 1;
    *month = mp + (mp < 10 ? 3 : -9);
    *year += *month <= 2;
}

staticfn int
nhjs_weekday_from_days(long long days)
{
    int wday = (int) ((days + 4LL) % 7LL);

    if (wday < 0)
        wday += 7;
    return wday;
}

staticfn unsigned
nhjs_nth_sunday_mday(int year, unsigned month, unsigned nth)
{
    long long days = nhjs_days_from_civil(year, month, 1U);
    unsigned first_sunday =
        (unsigned) (1 + ((7 - nhjs_weekday_from_days(days)) % 7));

    return first_sunday + 7U * (nth - 1U);
}

staticfn long long
nhjs_epoch_from_civil_offset(int year, unsigned month, unsigned day,
                             int hour, int minute, int second,
                             long long offset)
{
    long long days = nhjs_days_from_civil(year, month, day);

    return days * 86400LL + (long long) hour * 3600LL
           + (long long) minute * 60LL + (long long) second - offset;
}

staticfn int
nhjs_dst_for_epoch(long long epoch)
{
    long long shifted = epoch + NHJS_EST_OFFSET_SECONDS;
    long long days = shifted / 86400LL;
    int year;
    unsigned month, day, march_start, november_end, start_month, end_month;
    long long start_epoch, end_epoch;

    if (shifted < 0 && shifted % 86400LL)
        --days;
    nhjs_civil_from_days(days, &year, &month, &day);
    /* US rules as in tzdata's America/New_York: since 2007 the second
       Sunday of March to the first Sunday of November; 1987-2006 the
       first Sunday of April to the last Sunday of October; 1967-1986 the
       last Sundays of April and October (1974 and 1975 began early). */
    if (year < 1967)
        return 0;
    if (year >= 2007) {
        start_month = 3U;
        march_start = nhjs_nth_sunday_mday(year, 3U, 2U);
        end_month = 11U;
        november_end = nhjs_nth_sunday_mday(year, 11U, 1U);
    } else {
        start_month = 4U;
        march_start = year >= 1987 ? nhjs_nth_sunday_mday(year, 4U, 1U)
                                   : nhjs_nth_sunday_mday(year, 4U, 4U);
        if (year < 1987 && march_start + 7U <= 30U)
            march_start += 7U;
        if (year == 1974)
            start_month = 1U, march_start = 6U;
        else if (year == 1975)
            start_month = 2U, march_start = 23U;
        end_month = 10U;
        november_end = nhjs_nth_sunday_mday(year, 10U, 4U);
        if (november_end + 7U <= 31U)
            november_end += 7U;
    }
    start_epoch = nhjs_epoch_from_civil_offset(
        year, start_month, march_start, 2, 0, 0,
        NHJS_EST_OFFSET_SECONDS);
    end_epoch = nhjs_epoch_from_civil_offset(
        year, end_month, november_end, 2, 0, 0,
        NHJS_EDT_OFFSET_SECONDS);
    return epoch >= start_epoch && epoch < end_epoch;
}

staticfn int
nhjs_parse_yyyymmddhhmmss(char *buf, int *year, int *month, int *day,
                          int *hour, int *minute, int *second)
{
    int i;

    if (!buf || strlen(buf) != 14)
        return 0;
    for (i = 0; i < 14; ++i)
        if (buf[i] < '0' || buf[i] > '9')
            return 0;
    *year = (buf[0] - '0') * 1000 + (buf[1] - '0') * 100
            + (buf[2] - '0') * 10 + (buf[3] - '0');
    *month = (buf[4] - '0') * 10 + (buf[5] - '0');
    *day = (buf[6] - '0') * 10 + (buf[7] - '0');
    *hour = (buf[8] - '0') * 10 + (buf[9] - '0');
    *minute = (buf[10] - '0') * 10 + (buf[11] - '0');
    *second = (buf[12] - '0') * 10 + (buf[13] - '0');
    if (*month < 1 || *month > 12 || *day < 1 || *day > 31 || *hour > 23
        || *minute > 59 || *second > 60)
        return 0;
    if ((*month == 4 || *month == 6 || *month == 9 || *month == 11)
        && *day > 30)
        return 0;
    if (*month == 2
        && *day > (nhjs_leap_year(*year) ? 29 : 28))
        return 0;
    return 1;
}

staticfn void
nhjs_fill_tm(struct tm *t, int year, int month, int day, int hour,
             int minute, int second, int isdst)
{
    long long days = nhjs_days_from_civil(year, (unsigned) month,
                                          (unsigned) day);
    long long year_start = nhjs_days_from_civil(year, 1U, 1U);
    int wday = nhjs_weekday_from_days(days);

    t->tm_sec = second;
    t->tm_min = minute;
    t->tm_hour = hour;
    t->tm_mday = day;
    t->tm_mon = month - 1;
    t->tm_year = year - 1900;
    t->tm_wday = wday;
    t->tm_yday = (int) (days - year_start);
    t->tm_isdst = isdst;
}

staticfn time_t
nhjs_time_from_yyyymmddhhmmss(char *buf)
{
    int year, month, day, hour, minute, second;
    long long offset;

    if (!nhjs_parse_yyyymmddhhmmss(buf, &year, &month, &day, &hour,
                                   &minute, &second))
        return (time_t) 0;
    offset = NHJS_MKTIME_ISDST
                 ? NHJS_EDT_OFFSET_SECONDS
                 : NHJS_EST_OFFSET_SECONDS;
    return (time_t) nhjs_epoch_from_civil_offset(
        year, (unsigned) month, (unsigned) day, hour, minute, second, offset);
}

staticfn struct tm *
nhjs_tm_from_time(time_t date)
{
    static struct tm t;
    long long epoch = (long long) date;
    int isdst = nhjs_dst_for_epoch(epoch);
    long long shifted =
        epoch
        + (isdst ? NHJS_EDT_OFFSET_SECONDS
                 : NHJS_EST_OFFSET_SECONDS);
    long long days = shifted / 86400LL;
    long long rem = shifted % 86400LL;
    int year, hour, minute, second;
    unsigned month, day;

    if (rem < 0) {
        rem += 86400LL;
        --days;
    }
    nhjs_civil_from_days(days, &year, &month, &day);
    hour = (int) (rem / 3600LL);
    rem %= 3600LL;
    minute = (int) (rem / 60LL);
    second = (int) (rem % 60LL);
    nhjs_fill_tm(&t, year, (int) month, (int) day, hour, minute, second,
                 isdst);
    return &t;
}
`;

export default {
  file: "src/calendar.c",
  patches: [
    {
      why: "Times and dates are New York civil time, and a fixed datetime is read as daylight time.",
      edits: [
        { find: '#include "hack.h"\n', replace: newYorkTime },
        {
          find: "time_t parsed = time_from_yyyymmddhhmmss((char *) fixed_dt);",
          replace: "time_t parsed = nhjs_time_from_yyyymmddhhmmss((char *) fixed_dt);",
        },
        {
          find: "localtime((LOCALTIME_type) &date)",
          count: 4,
          replace: "nhjs_tm_from_time(date)",
        },
        {
          find: /^time_from_yyyymmddhhmmss\(char \*buf\)\n\{\n[^]*?\n\}\n/m,
          replace: String.raw`time_from_yyyymmddhhmmss(char *buf)
{
    return nhjs_time_from_yyyymmddhhmmss(buf);
}
`,
        },
      ],
    },
  ],
};
