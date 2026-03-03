/**
 * dateUtils.js — Single source of truth for all event date parsing & formatting.
 *
 * Handles every format found in the DB:
 *   echai      → "2026-03-07"                          (YYYY-MM-DD)
 *   meetup     → "2026-03-07T09:00:00+05:30"           (ISO with TZ)
 *   allevents  → "Sat, 04 Apr, 2026 - 10:00 AM"        (comma after month!)
 *   hasgeek    → "07 Mar 2026"                          (DD Mon YYYY)
 *   biec       → "May 14 - 17, 2026"                   (same-month range)
 *   biec       → "February 26 - March 01, 2026"        (cross-month range)
 *   general    → "January 2, 2026" / "Jan 2, 2026"
 *
 * Output format everywhere: "Mar 07, 2026"
 */

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function _monthIndex(str) {
    if (!str) return -1;
    return MONTHS_SHORT.findIndex(m => m.toLowerCase() === str.slice(0, 3).toLowerCase());
}

/**
 * Parse any raw date string → UTC midnight Date object.
 * Returns null if the string is unparseable.
 */
export function parseEventDate(raw) {
    if (!raw) return null;

    // Strip trailing time portion before any matching:
    // "Sat, 04 Apr, 2026 - 10:00 AM" → "Sat, 04 Apr, 2026"
    let s = raw.trim().replace(/\s*[-–@]\s*\d{1,2}:\d{2}\s*(am|pm)?.*$/i, "").trim();

    // 1. YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split("-").map(Number);
        return new Date(Date.UTC(y, m - 1, d));
    }

    // 2. ISO with time: 2026-03-07T09:00:00+05:30
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
        const p = new Date(raw);
        if (!isNaN(p.getTime()))
            return new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate()));
    }

    // 3. AllEvents: "Sat, 04 Apr, 2026"  NOTE comma after month is optional
    const allEvents = s.match(
        /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*,?\s+(\d{4})/i
    );
    if (allEvents) {
        const mi = _monthIndex(allEvents[2]);
        if (mi !== -1) return new Date(Date.UTC(+allEvents[3], mi, +allEvents[1]));
    }

    // 4. Cross-month range: "February 26 - March 01, 2026" — take start date
    const crossMonth = s.match(
        /^([A-Za-z]+)\s+(\d{1,2})\s*[-–]\s*[A-Za-z]+\s+\d{1,2},?\s*(\d{4})/i
    );
    if (crossMonth) {
        const mi = _monthIndex(crossMonth[1]);
        if (mi !== -1) return new Date(Date.UTC(+crossMonth[3], mi, +crossMonth[2]));
    }

    // 5. Same-month range: "May 14 - 17, 2026"  year is ONLY at end
    const sameMonth = s.match(
        /^([A-Za-z]+)\s+(\d{1,2})\s*[-–]\s*\d{1,2},?\s*(\d{4})/i
    );
    if (sameMonth) {
        const mi = _monthIndex(sameMonth[1]);
        if (mi !== -1) return new Date(Date.UTC(+sameMonth[3], mi, +sameMonth[2]));
    }

    // 6. Day-first range: "14-17 May 2026"
    const dayRange = s.match(/^(\d{1,2})\s*[-–]\s*\d{1,2}\s+([A-Za-z]+)\s+(\d{4})/i);
    if (dayRange) {
        const mi = _monthIndex(dayRange[2]);
        if (mi !== -1) return new Date(Date.UTC(+dayRange[3], mi, +dayRange[1]));
    }

    // 7. "07 Mar 2026" / "7 March 2026"  (HasGeek day-first)
    const dayFirst = s.match(
        /^(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})/i
    );
    if (dayFirst) {
        const mi = _monthIndex(dayFirst[2]);
        if (mi !== -1) return new Date(Date.UTC(+dayFirst[3], mi, +dayFirst[1]));
    }

    // 8. "January 2, 2026" / "Jan 2, 2026"  (US long/short)
    const usLong = s.match(
        /^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})/i
    );
    if (usLong) {
        const mi = _monthIndex(usLong[1]);
        if (mi !== -1) return new Date(Date.UTC(+usLong[3], mi, +usLong[2]));
    }

    return null;
}

/**
 * Format any raw date string → "Mar 07, 2026"
 * Returns "Date TBA" if unparseable.
 * This is the ONLY function components should call for display.
 */
export function formatEventDate(raw) {
    if (!raw) return "Date TBA";
    const d = parseEventDate(raw);
    if (!d) return "Date TBA";
    const mon = MONTHS_SHORT[d.getUTCMonth()];
    const day = String(d.getUTCDate()).padStart(2, "0");
    const yr = d.getUTCFullYear();
    return `${mon} ${day}, ${yr}`;
}
