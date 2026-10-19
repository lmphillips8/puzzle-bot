// Run once (and again whenever commands change): npm run register
import { commands } from "../lib/commands.js";

const { DISCORD_APP_ID, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_APP_ID || !DISCORD_BOT_TOKEN) {
  console.error("Set DISCORD_APP_ID and DISCORD_BOT_TOKEN in .env");
  process.exit(1);
}

const url = DISCORD_GUILD_ID
  ? `https://discord.com/api/v10/applications/${DISCORD_APP_ID}/guilds/${DISCORD_GUILD_ID}/commands`
  : `https://discord.com/api/v10/applications/${DISCORD_APP_ID}/commands`;

const res = await fetch(url, {
  method: "PUT", // bulk overwrite: the list in lib/commands.js is the source of truth
  headers: { "content-type": "application/json", authorization: `Bot ${DISCORD_BOT_TOKEN}` },
  body: JSON.stringify(commands),
});

if (!res.ok) {
  console.error("Failed:", res.status, await res.text());
  process.exit(1);
}
const registered = await res.json();
console.log(
  `Registered ${registered.length} commands (${DISCORD_GUILD_ID ? "guild" : "global"}):`,
  registered.map((c) => c.name).join(", ")
);
