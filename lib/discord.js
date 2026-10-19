const API = "https://discord.com/api/v10";

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Replace the "Bot is thinking..." placeholder with the real reply. */
export async function editOriginal(appId, interactionToken, body) {
  const res = await fetch(
    `${API}/webhooks/${appId}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    console.error("editOriginal failed", res.status, await res.text());
  }
}
