import type { OlvaAgencyWeekday } from "../../shared/constants/olva-enums.constants";
import { OLVA_AGENCY_TIME_ZONE } from "../constants/olva-agency.constants";
import type { OlvaAgencySchedule } from "../models/olva-agency";

function toMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);

  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Weekday and minutes since midnight at `date`, on the agencies' clock (Lima, UTC-5, no DST). */
function getLocalClock(date: Date): { weekday: OlvaAgencyWeekday; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: OLVA_AGENCY_TIME_ZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    weekday: value("weekday").toLowerCase() as OlvaAgencyWeekday,
    minutes: Number(value("hour")) * 60 + Number(value("minute")),
  };
}

/**
 * Whether an agency is open at `date` according to its weekly schedule. Unknown or closed days
 * are `false`. Opening is inclusive, closing exclusive ("08:00"-"18:00" is closed at 18:00).
 */
export function isOlvaAgencyOpenAt(schedule: OlvaAgencySchedule, date: Date = new Date()): boolean {
  const { weekday, minutes } = getLocalClock(date);
  const slot = schedule[weekday];

  if (!slot?.open || !slot.close) return false;

  const open = toMinutes(slot.open);
  const close = toMinutes(slot.close);

  if (open === null || close === null) return false;

  return minutes >= open && minutes < close;
}
