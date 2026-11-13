// host/time.js - clocks and the local time zone of the C library: US Eastern time.
//
// A session's `datetime` ("YYYYMMDDHHMMSS") pins the wall clock.  NetHack turns that
// string into a time_t with mktime() on a struct tm copied from localtime(now); the
// session datetime is read as US Eastern daylight time (EDT, UTC-4), winter dates
// included.  It then renders times with localtime(), which applies the New York
// daylight-saving history.
//
//   localtime(t)  -> broken-down New York civil time of t (seconds)
//   mktime(f)     -> seconds of the civil time f read as EDT
//   tz            -> tzset() values (timezone, daylight, std, dst names)
//   clocksFor(datetime) -> the wall and monotonic clocks of a session
//
// The rules are the ones of tzdata's America/New_York since 1967:
//   2007-      second Sunday of March .. first Sunday of November
//   1987-2006  first Sunday of April .. last Sunday of October
//   1967-1986  last Sunday of April .. last Sunday of October
//              (1974 from January 6, 1975 from February 23)
// switching at 02:00 local time; before 1967 standard time.

const DAY = 86400;
const EST_OFFSET = -5 * 3600;
const EDT_OFFSET = -4 * 3600;

/** Days since 1970-01-01 of a proleptic Gregorian date (month 1-12). */
function daysFromCivil(year, month, day) {
  year -= month <= 2 ? 1 : 0;
  const era = Math.trunc((year >= 0 ? year : year - 399) / 400);
  const yoe = year - era * 400;
  const doy = Math.trunc((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.trunc(yoe / 4) - Math.trunc(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** [year, month 1-12, day] of a day number. */
function civilFromDays(z) {
  z += 719468;
  const era = Math.trunc((z >= 0 ? z : z - 146096) / 146097);
  const doe = z - era * 146097;
  const yoe = Math.trunc((doe - Math.trunc(doe / 1460) + Math.trunc(doe / 36524) - Math.trunc(doe / 146096)) / 365);
  let year = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.trunc(yoe / 4) - Math.trunc(yoe / 100));
  const mp = Math.trunc((5 * doy + 2) / 153);
  const day = doy - Math.trunc((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  if (month <= 2) year++;
  return [year, month, day];
}

function weekday(days) {
  return (((days + 4) % 7) + 7) % 7;
}

function nthSunday(year, month, nth) {
  const first = 1 + ((7 - weekday(daysFromCivil(year, month, 1))) % 7);
  return first + 7 * (nth - 1);
}

function epochOf(year, month, day, hour, minute, second, offset) {
  return daysFromCivil(year, month, day) * DAY + hour * 3600 + minute * 60 + second - offset;
}

/** Is t (seconds since the epoch) in New York daylight time? */
function newYorkDst(t) {
  const shifted = t + EST_OFFSET;
  let days = Math.trunc(shifted / DAY);
  if (shifted < 0 && shifted % DAY) --days;
  const [year] = civilFromDays(days);
  if (year < 1967) return false;
  let startMonth, startDay, endMonth, endDay;
  if (year >= 2007) {
    startMonth = 3;
    startDay = nthSunday(year, 3, 2);
    endMonth = 11;
    endDay = nthSunday(year, 11, 1);
  } else {
    startMonth = 4;
    startDay = year >= 1987 ? nthSunday(year, 4, 1) : nthSunday(year, 4, 4);
    if (year < 1987 && startDay + 7 <= 30) startDay += 7;
    if (year === 1974) (startMonth = 1), (startDay = 6);
    else if (year === 1975) (startMonth = 2), (startDay = 23);
    endMonth = 10;
    endDay = nthSunday(year, 10, 4);
    if (endDay + 7 <= 31) endDay += 7;
  }
  const start = epochOf(year, startMonth, startDay, 2, 0, 0, EST_OFFSET);
  const end = epochOf(year, endMonth, endDay, 2, 0, 0, EDT_OFFSET);
  return t >= start && t < end;
}

function fields(t, offset, isdst, zone) {
  const shifted = t + offset;
  let days = Math.trunc(shifted / DAY);
  let rem = shifted % DAY;
  if (rem < 0) {
    rem += DAY;
    --days;
  }
  const [year, month, day] = civilFromDays(days);
  return {
    sec: rem % 60,
    min: Math.trunc(rem / 60) % 60,
    hour: Math.trunc(rem / 3600),
    mday: day,
    mon: month - 1,
    year: year - 1900,
    wday: weekday(days),
    yday: days - daysFromCivil(year, 1, 1),
    isdst,
    gmtoff: offset,
    zone,
  };
}

/** localtime(): New York civil time of t. */
export function localtime(t) {
  const dst = newYorkDst(t);
  return fields(t, dst ? EDT_OFFSET : EST_OFFSET, dst ? 1 : 0, dst ? "EDT" : "EST");
}

/** mktime(): the civil time f (fields may be out of range) read as EDT. */
export function mktime(f) {
  return civilSeconds(f) - EDT_OFFSET;
}

/** tzset() values of TZ=America/New_York. */
export const tz = Object.freeze({ timezone: -EST_OFFSET, daylight: 1, std: "EST", dst: "EDT" });

// seconds of broken-down civil fields as if UTC; out-of-range fields carry over like mktime
function civilSeconds(f) {
  let year = f.year + 1900;
  let mon = f.mon;
  year += Math.floor(mon / 12);
  mon -= Math.floor(mon / 12) * 12;
  return (daysFromCivil(year, mon + 1, 1) + f.mday - 1) * DAY + f.hour * 3600 + f.min * 60 + f.sec;
}

/** The pinned datetime "YYYYMMDDHHMMSS" read as EDT, as a time_t, or 0 if malformed. */
export function sessionEpoch(datetime) {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(datetime || ""));
  if (!m) return 0;
  const [year, month, day, hour, minute, second] = m.slice(1).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 60) return 0;
  if ((month === 4 || month === 6 || month === 9 || month === 11) && day > 30) return 0;
  if (month === 2 && day > (leap ? 29 : 28)) return 0;
  return epochOf(year, month, day, hour, minute, second, EDT_OFFSET);
}

// ---- clocks ---------------------------------------------------------------------------

/**
 * Wall and monotonic clocks for the C library (milliseconds).
 * With a pinned datetime both stand still at that instant, so a segment is
 * reproducible (Lua's string-hash seed and table-sort pivots read them);
 * without one the wall clock is the real one.
 */
export function clocksFor(datetime) {
  const pinned = sessionEpoch(datetime);
  if (pinned) {
    const ms = pinned * 1000;
    return { now: () => ms, monotonic: () => 0 };
  }
  return { now: () => Date.now(), monotonic: () => 0 };
}
