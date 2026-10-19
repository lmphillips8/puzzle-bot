import * as cheerio from "cheerio";

export class UserError extends Error {}

const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || "archipelago.gg")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const clean = (s) => s.replace(/\s+/g, " ").trim();

/** Validate a user-supplied URL so the bot can't be pointed at arbitrary hosts. kind: "room" | "tracker" */
export function normalizeUrl(input, kind) {
  let u;
  try {
    u = new URL(String(input).trim());
  } catch {
    throw new UserError("That doesn't look like a valid URL.");
  }
  if (u.protocol !== "https:" || !ALLOWED_HOSTS.includes(u.hostname.toLowerCase())) {
    throw new UserError(`Only https links on ${ALLOWED_HOSTS.join(", ")} are supported.`);
  }
  if (!new RegExp(`^/${kind}/[\\w-]+/?$`).test(u.pathname)) {
    throw new UserError(`Expected a link like https://${u.hostname}/${kind}/<id>.`);
  }
  u.search = "";
  u.hash = "";
  return u.toString();
}

async function fetchHtml(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: { "user-agent": "archipelago-discord-bot" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new UserError("Couldn't reach the Archipelago site. Try again in a moment.");
  }
  if (!ALLOWED_HOSTS.includes(new URL(res.url).hostname.toLowerCase())) {
    throw new UserError("The page redirected somewhere unexpected, so I stopped.");
  }
  if (!res.ok) {
    throw new UserError(`Archipelago returned HTTP ${res.status}. Is that URL still valid?`);
  }
  return res.text();
}

// ---------------------------------------------------------------------------
// Parsing. Written against the layout of archipelago.gg room + tracker pages.
// `npm run try -- <room_url>` shows what these extract from a live room.
// ---------------------------------------------------------------------------

/** Room page: "...'/connect archipelago.gg:51804'..." */
export function parsePort(html, hostname) {
  const text = cheerio.load(html)("body").text();
  const m = text.match(new RegExp(`${escapeRegex(hostname)}:(\\d{2,5})`, "i"));
  return m ? `${hostname}:${m[1]}` : null;
}

/** Room page links to /tracker/<id> (the per-slot /tracker/<id>/0/1 and /sphere_tracker links don't match). */
export function findTrackerUrl(html, roomUrl) {
  const $ = cheerio.load(html);
  for (const a of $("a[href]").toArray()) {
    try {
      return normalizeUrl(new URL($(a).attr("href"), roomUrl).toString(), "tracker");
    } catch {
      // not the multiworld tracker link; keep looking
    }
  }
  return null;
}

/**
 * Tracker page: a table with columns # | Name | Game | Status | Checks | % | Last Activity,
 * plus a final "Total" row. Columns are matched by header text, not position.
 */
export function parseProgress(html) {
  const $ = cheerio.load(html);
  const players = [];
  let summary = null;

  $("table").each((_, table) => {
    if (players.length) return; // first matching table only
    const headers = $(table)
      .find("tr")
      .first()
      .children("th, td")
      .map((_, c) => clean($(c).text()).toLowerCase())
      .get();
    const col = (...names) => headers.findIndex((h) => names.some((n) => h.includes(n)));

    const nameI = col("name");
    const checksI = col("checks");
    if (nameI === -1 || checksI === -1) return;
    const gameI = col("game");
    const statusI = col("status");
    const lastI = col("last");

    const parseChecks = (s) => {
      const m = (s ?? "").match(/(\d+)\s*\/\s*(\d+)/);
      return m ? { done: Number(m[1]), total: Number(m[2]) } : { done: null, total: null };
    };

    $(table)
      .find("tr")
      .each((_, tr) => {
        const cells = $(tr)
          .children("td")
          .map((_, c) => clean($(c).text()))
          .get();
        if (!cells.length) return;

        const { done, total } = parseChecks(cells[checksI]);
        const percent = total ? Math.round((done / total) * 1000) / 10 : null;

        if (cells.some((c) => c.toLowerCase() === "total")) {
          summary = { done, total, percent, status: statusI >= 0 ? cells[statusI] : "" };
          return;
        }
        if (!cells[nameI]) return;

        const lastRaw = lastI >= 0 ? cells[lastI] : "";
        const secs = parseFloat(lastRaw);
        players.push({
          name: cells[nameI],
          game: gameI >= 0 ? cells[gameI] : "",
          status: statusI >= 0 ? cells[statusI] : "",
          done,
          total,
          percent,
          rawChecks: cells[checksI] ?? "",
          // Assumed to be seconds since last activity ("None" = never connected).
          secondsSinceActivity: Number.isFinite(secs) ? secs : null,
        });
      });
  });

  return { players, summary };
}

// ---------------------------------------------------------------------------

/** Reads the room page: current host:port and the multiworld tracker link. */
export async function getRoom(roomUrl) {
  const html = await fetchHtml(roomUrl);
  return {
    address: parsePort(html, new URL(roomUrl).hostname),
    trackerUrl: findTrackerUrl(html, roomUrl),
  };
}

export async function getProgress(trackerUrl) {
  const result = parseProgress(await fetchHtml(trackerUrl));
  if (!result.players.length) {
    throw new UserError(
      "I loaded the tracker but couldn't find the players table. The page layout may have changed."
    );
  }
  return result;
}
