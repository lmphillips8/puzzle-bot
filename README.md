# Archipelago Discord bot (serverless)

Slash-command-only Discord bot using Discord's **HTTP interactions** (no always-on process).
Runs on Vercel's free tier with a free MongoDB Atlas (M0) cluster.

| Command | What it does |
| --- | --- |
| `/puzzle room_url player1 [player2..8]` | Saves this channel's puzzle (the tracker link is read from the room page) and pings the players. Replaces any existing one. |
| `/progress` | Scrapes the tracker and shows every player's checks. |
| `/port` | Re-reads the room page for the current `host:port` (never cached, since it can change when a paused room resumes). |

## Setup

1. **Discord:** developer portal -> New Application. Copy the *Application ID*, *Public Key*, and (Bot tab) *Token*.
2. **Install to your server:** OAuth2 -> URL Generator -> scope `applications.commands` only.
3. **Atlas:** create a database user, and under Network Access allow `0.0.0.0/0` (Vercel's IPs aren't fixed). Copy the `mongodb+srv://` URI.
4. **Local:** `npm install`, copy `.env.example` to `.env`, fill it in.
5. **Register commands:** `npm run register` (set `DISCORD_GUILD_ID` for instant updates while developing).
6. **Deploy:** push to GitHub, import in Vercel, add the same env vars (`DISCORD_APP_ID`, `DISCORD_PUBLIC_KEY`, `MONGODB_URI`, `MONGODB_DB`; the bot token is only needed locally for registering).
7. **Connect:** in the developer portal set *Interactions Endpoint URL* to `https://<your-app>.vercel.app/api/interactions`. Discord sends a signed PING to verify it.

## Verify the scraper

The parsers in `lib/archipelago.js` were written against the layout of archipelago.gg room and
tracker pages (room page: connect address + tracker link; tracker page: a Name / Game / Status /
Checks / % / Last Activity table with a Total row). Check them against a live room:

    npm run try -- https://archipelago.gg/room/<id>

Assumptions to confirm: the "Last Activity" column is seconds since last activity, and loading the
room page (which `/port` does) is what resumes a paused room.

## Layout

    api/interactions.js     signature check, routing, deferred replies
    lib/handlers.js         /puzzle, /progress, /port logic (+ 60s cache)
    lib/archipelago.js      URL validation, fetching, parsing
    lib/db.js               cached Mongo client; one doc per channel
    lib/commands.js         command definitions
    scripts/                register-commands.js, try-tracker.js
