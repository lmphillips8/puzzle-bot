import { MongoClient } from "mongodb";

// Cached at module scope so warm serverless instances reuse the connection.
let client;

export function getDb() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  client ??= new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 3 });
  return client.db(process.env.MONGODB_DB || "puzzle-bot");
}

/**
 * One document per channel (the current puzzle only, no history):
 * {
 *   _id: channelId,
 *   guildId, trackerUrl, roomUrl | null,
 *   participantIds: [userId, ...],
 *   createdBy, createdAt,
 *   cache: { progress?: {value, at}, port?: {value, at} }
 * }
 */
export const puzzles = () => getDb().collection("puzzles");
