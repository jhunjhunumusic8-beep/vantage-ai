
export default async (request) => {
  const headers = {
    "content-type": "application/json"
  };

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "POST method required" }),
      { status: 405, headers }
    );
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return new Response(
      JSON.stringify({ error: "Telegram credentials missing" }),
      { status: 503, headers }
    );
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: "🚀 VANTAGE AI\n\nTelegram connection successful!"
        })
      }
    );

    const result = await response.json();

    return new Response(
      JSON.stringify({
        success: result.ok,
        message: result.description || "Telegram test message sent"
      }),
      { status: result.ok ? 200 : 502, headers }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Telegram request failed" }),
      { status: 502, headers }
    );
  }
};
