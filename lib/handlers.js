import { puzzles } from "./db.js";
import { UserError, getProgress, getRoom, normalizeUrl } from "./archipelago.js";

const CACHE_TTL_MS = 60_000;
const NO_PINGS = { parse: [] };

const optionsOf = (i) => Object.fromEntries((i.data.options ?? []).map((o) => [o.name, o.value]));

async function currentPuzzle(i) {
  const doc = await puzzles().findOne({ _id: i.channel_id });
  if (!doc) throw new UserError("No puzzle is set for this channel yet. Use `/puzzle` first.");
  return doc;
}

/** Short-lived cache so repeated commands don't hammer the tracker site. */
async function cached(doc, key, fn) {
  const hit = doc.cache?.[key];
  if (hit && Date.now() - new Date(hit.at).getTime() < CACHE_TTL_MS) return hit.value;
  const value = await fn();
  await puzzles().updateOne({ _id: doc._id }, { $set: { [`cache.${key}`]: { value, at: new Date() } } });
  return value;
}

const bar = (pct) => {
  const n = Math.max(0, Math.min(10, Math.round((pct ?? 0) / 10)));
  return "▓".repeat(n) + "░".repeat(10 - n);
};

function ago(s) {
  if (s == null) return "never connected";
  if (s < 60) return `${Math.round(s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function statusIcon(status) {
  const s = status.toLowerCase();
  if (s.includes("goal") || s.includes("complete")) return "🏆";
  if (s.startsWith("disconnected")) return "⚪";
  if (s.includes("connected")) return "🟢";
  return "▫️";
}

// ---------------------------------------------------------------------------

async function puzzle(i) {
  const o = optionsOf(i);
  const roomUrl = normalizeUrl(o.room_url, "room");
  const participantIds = [
    ...new Set(Array.from({ length: 8 }, (_, n) => o[`player${n + 1}`]).filter(Boolean)),
  ];

  // The room page has both the port and the link to the tracker.
  const { address, trackerUrl } = await getRoom(roomUrl);
  if (!trackerUrl) {
    throw new UserError("That room doesn't have a Multiworld Tracker enabled, so I can't track progress.");
  }

  const previous = await puzzles().findOneAndReplace(
    { _id: i.channel_id },
    {
      _id: i.channel_id,
      guildId: i.guild_id,
      roomUrl,
      trackerUrl,
      participantIds,
      createdBy: (i.member?.user ?? i.user).id,
      createdAt: new Date(),
    },
    { upsert: true } // returns the previous doc (or null) in driver v6
  );

  const mentions = participantIds.map((id) => `<@${id}>`).join(" ");
  return {
    content:
      `🧩 ${previous ? "Puzzle replaced" : "Puzzle set"} for this channel!\n` +
      `**Players:** ${mentions}\n` +
      (address ? `**Connect:** \`/connect ${address}\`\n` : "") +
      `**Room:** ${roomUrl}\n**Tracker:** ${trackerUrl}\n` +
      `Use \`/progress\` to check in and \`/port\` for the current address.`,
    allowed_mentions: { users: participantIds }, // this one intentionally pings
  };
}

async function progress(i) {
  const doc = await currentPuzzle(i);
  const { players, summary } = await cached(doc, "progress", () => getProgress(doc.trackerUrl));

  const lines = players.map((p) => {
    const stats = p.done == null ? p.rawChecks || "?" : `${p.done}/${p.total} (${p.percent}%)`;
    const head = `${statusIcon(p.status)} **${p.name}**${p.game ? ` · ${p.game}` : ""}`;
    const tail = `${bar(p.percent)} ${stats} · ${p.status ? p.status + " · " : ""}${ago(p.secondsSinceActivity)}`;
    return `${head}\n${tail}`;
  });

  const footer =
    summary?.total != null
      ? `Overall: ${summary.done}/${summary.total} checks (${summary.percent}%)${summary.status ? ` · ${summary.status}` : ""}`
      : undefined;

  return {
    content: `Players: ${doc.participantIds.map((id) => `<@${id}>`).join(" ")}`,
    allowed_mentions: NO_PINGS,
    embeds: [
      {
        title: "Puzzle progress",
        url: doc.trackerUrl,
        description: lines.join("\n\n").slice(0, 4000),
        footer: footer ? { text: footer } : undefined,
      },
    ],
  };
}

async function port(i) {
  const doc = await currentPuzzle(i);
  // Deliberately uncached: rooms pause after inactivity and the address can change when resumed.
  const { address } = await getRoom(doc.roomUrl);
  if (!address) throw new UserError("I loaded the room page but couldn't find a host:port on it.");
  return {
    content: `🔌 \`/connect ${address}\``,
    allowed_mentions: NO_PINGS,
  };
}

export const handlers = { puzzle, progress, port };
