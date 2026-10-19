import {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from "discord-interactions";
import { waitUntil } from "@vercel/functions";
import { editOriginal, json } from "../lib/discord.js";
import { handlers } from "../lib/handlers.js";
import { UserError } from "../lib/archipelago.js";

async function run(handler, interaction) {
  let body;
  try {
    body = await handler(interaction);
  } catch (err) {
    if (err instanceof UserError) {
      body = { content: `⚠️ ${err.message}`, allowed_mentions: { parse: [] } };
    } else {
      console.error(err);
      body = { content: "⚠️ Something went wrong. Try again in a moment.", allowed_mentions: { parse: [] } };
    }
  }
  await editOriginal(process.env.DISCORD_APP_ID, interaction.token, body);
}

export async function POST(request) {
  // Discord signs every request; the raw body is needed to verify it.
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const raw = await request.text();

  const valid =
    signature &&
    timestamp &&
    (await verifyKey(raw, signature, timestamp, process.env.DISCORD_PUBLIC_KEY));
  if (!valid) return new Response("Bad request signature", { status: 401 });

  const interaction = JSON.parse(raw);

  if (interaction.type === InteractionType.PING) {
    return json({ type: InteractionResponseType.PONG });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const handler = handlers[interaction.data.name];
    if (!handler) {
      return json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "Unknown command.", flags: 64 },
      });
    }
    // Ack within Discord's 3s window, then do the slow work and edit the reply.
    waitUntil(run(handler, interaction));
    return json({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });
  }

  return new Response("Unsupported interaction", { status: 400 });
}
