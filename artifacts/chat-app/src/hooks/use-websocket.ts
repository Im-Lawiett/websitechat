import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListGroupMessagesQueryKey, getListDmMessagesQueryKey, Message } from "@workspace/api-client-react";

type WSEvent = 
  | { type: 'new_message', message: Message }
  | { type: 'user_joined', groupId: number, user: any }
  | { type: 'user_banned', userId: string };

export function useWebSocket(userId?: string) {
  const ws = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    
    let retryCount = 0;
    let timeoutId: number;

    const connect = () => {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        retryCount = 0;
        console.log('Connected to WS');
      };

      ws.current.onmessage = (event) => {
        try {
          const data: WSEvent = JSON.parse(event.data);
          
          if (data.type === 'new_message') {
            const { message } = data;
            if (message.groupId) {
              queryClient.invalidateQueries({ queryKey: getListGroupMessagesQueryKey(message.groupId) });
            } else if (message.senderId === userId) {
              queryClient.invalidateQueries({ queryKey: getListDmMessagesQueryKey(message.recipientId || '') });
            } else if (message.recipientId === userId) {
              queryClient.invalidateQueries({ queryKey: getListDmMessagesQueryKey(message.senderId) });
            }
          }
          
          if (data.type === 'user_banned') {
            if (data.userId === userId) {
              window.location.reload(); // Quick way to trigger ban check on reload
            }
          }
        } catch (e) {
          console.error('Failed to parse WS message', e);
        }
      };

      ws.current.onclose = () => {
        const timeout = Math.min(1000 * Math.pow(2, retryCount), 10000);
        retryCount++;
        timeoutId = window.setTimeout(connect, timeout);
      };
    };

    connect();

    return () => {
      window.clearTimeout(timeoutId);
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [userId, queryClient]);
}
