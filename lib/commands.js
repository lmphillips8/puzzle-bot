// Command definitions. Used only by scripts/register-commands.js.
const STRING = 3;
const USER = 6;
const GUILD_ONLY = [0]; // interaction context: guild channels only

const MAX_PLAYERS = 8;

// Slash commands can't take a variable-length user list, so: player1 (required) .. player8 (optional)
const playerOptions = Array.from({ length: MAX_PLAYERS }, (_, n) => ({
  type: USER,
  name: `player${n + 1}`,
  description: `Participant ${n + 1}`,
  required: n === 0,
}));

export const commands = [
  {
    name: "puzzle",
    description: "Set this channel's Archipelago puzzle (replaces any existing one)",
    contexts: GUILD_ONLY,
    options: [
      { type: STRING, name: "room_url", description: "Archipelago room URL (archipelago.gg/room/...)", required: true },
      ...playerOptions,
    ],
  },
  {
    name: "progress",
    description: "Show everyone's progress from this channel's tracker",
    contexts: GUILD_ONLY,
  },
  {
    name: "port",
    description: "Show the current server address and port for this channel's puzzle",
    contexts: GUILD_ONLY,
  },
];
