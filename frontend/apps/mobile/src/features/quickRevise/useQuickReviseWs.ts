import { useEffect, useRef, useState, useCallback } from "react";
import { ENV } from "@/config/env";
import { store } from "@/store";

export type WsMessage =
  | { type: "new_question"; question: Record<string, unknown>; time_limit: number; index: number }
  | { type: "result"; correct: boolean; answer?: string }
  | { type: "finished"; score: number; reason?: string }
  | { type: "game_over"; reason: string; correct_answer?: string; final_score?: number }
  | { type: "error"; message: string };

interface UseQuickReviseWsOptions {
  deckId: string;
  onMessage: (msg: WsMessage) => void;
  enabled?: boolean;
}

export function useQuickReviseWs({ deckId, onMessage, enabled = true }: UseQuickReviseWsOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled || !deckId) return;

    const token = store.getState().auth.token?.access;
    if (!token) return;

    const url = `${ENV.wsBaseUrl}/quick-revise/?token=${encodeURIComponent(token)}&deck_id=${encodeURIComponent(deckId)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ action: "start" }));
    };

    ws.onmessage = (event) => {
      try {
        onMessageRef.current(JSON.parse(event.data) as WsMessage);
      } catch {
        /* ignore malformed */
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [deckId, enabled]);

  const sendAnswer = useCallback((answer: string) => {
    wsRef.current?.send(JSON.stringify({ action: "answer", answer }));
  }, []);

  return { connected, sendAnswer };
}
