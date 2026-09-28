import { API_BASE } from "./api";

export async function sendVeraMessage(token, message, onDelta, signal, onTool) {
  const response = await fetch(`${API_BASE}/vera/messages`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream", "X-Vera-Session": token },
    body: JSON.stringify(message), signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(typeof error.detail === "string" ? error.detail : "Vera yanıtı tamamlayamadı.");
  }
  if (!response.headers.get("content-type")?.includes("text/event-stream")) return response.json();
  if (!response.body) throw new Error("Yanıt akışı kullanılamıyor.");
  const reader = response.body.getReader(), decoder = new TextDecoder();
  const turns = new Map();
  let buffer = "", event = "", data = [];
  try {
    while (true) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, ""); buffer = buffer.slice(newline + 1);
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
        else if (!line && data.length) {
          const value = JSON.parse(data.join("\n")); data = [];
          if ((event === "tool.started" || event === "tool.completed") && value.request_id === message.request_id) onTool?.(value);
          if (event === "session.error") throw new Error(value.message);
          if (event === "assistant.delta" && value.request_id === message.request_id) {
            let turn = turns.get(value.turn_id);
            if (!turn) { turn = { sequence: 0, segments: new Map() }; turns.set(value.turn_id, turn); }
            if (value.sequence > turn.sequence) {
              turn.sequence = value.sequence;
              turn.segments.set(value.segment_id, (turn.segments.get(value.segment_id) || "") + value.delta);
              onDelta([...turns.values()].flatMap((t) => [...t.segments.values()]).map((s) => s.trim()).filter(Boolean).join("\n\n"));
            }
          }
          if (event === "session.completed") return value;
          event = "";
        }
      }
      if (chunk.done) throw new Error("Yanıt akışı kesildi. Sohbet durumu kontrol ediliyor.");
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
