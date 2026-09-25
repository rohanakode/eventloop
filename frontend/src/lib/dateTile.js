const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Turn an event's start (and optional end) date into the { day, mon } pair
// shown on the small date tile that leads every event card.
//
// - Single day  →  { day: "24",       mon: "Oct" }
// - Multi-day, same month  →  { day: "24–26", mon: "Oct" }
// - Multi-day, cross-month  →  { day: "24 Oct", mon: "→ 3 Nov" }
export function tileFor(startIso, endIso) {
  if (!startIso) return { day: "—", mon: "—", isRange: false };
  const [sy, sm, sd] = startIso.split("-").map(Number);
  const startDay = String(sd).padStart(2, "0");
  const startMon = MONTHS[sm - 1];

  if (!endIso || endIso === startIso) {
    return { day: startDay, mon: startMon, isRange: false };
  }

  const [ey, em, ed] = endIso.split("-").map(Number);
  const endDay = String(ed).padStart(2, "0");
  const endMon = MONTHS[em - 1];

  if (sy === ey && sm === em) {
    return { day: `${startDay}–${endDay}`, mon: startMon, isRange: true };
  }

  return {
    day: `${startDay} ${startMon}`,
    mon: `→ ${endDay} ${endMon}`,
    isRange: true,
  };
}
