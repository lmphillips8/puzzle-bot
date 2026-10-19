// See what the parsers extract from a real room: npm run try -- https://archipelago.gg/room/<id>
import { getProgress, getRoom, normalizeUrl } from "../lib/archipelago.js";

const roomUrl = normalizeUrl(process.argv[2] ?? "", "room");
const { address, trackerUrl } = await getRoom(roomUrl);
console.log({ address, trackerUrl });

if (trackerUrl) {
  const { players, summary } = await getProgress(trackerUrl);
  console.table(players);
  console.log("Total:", summary);
}
