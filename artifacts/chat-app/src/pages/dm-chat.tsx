import { useParams } from "wouter";
import { ChatLayout } from "@/components/chat/chat-layout";
import { useGetUser, useListDmMessages, useGetMe, useSendDmMessage, getListDmMessagesQueryKey } from "@workspace/api-client-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useWebSocket } from "@/hooks/use-websocket";
import { format } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function DmChat() {
  const { userId } = useParams();
  
  const { data: user } = useGetMe();
  const { data: contactUser } = useGetUser(userId || "", { query: { enabled: !!userId, queryKey: ["/api/users", userId] } });
  const { data: messagesData } = useListDmMessages(userId || "", {}, { query: { enabled: !!userId, queryKey: getListDmMessagesQueryKey(userId || "") }});
  
  useWebSocket(user?.id);
  const sendMsg = useSendDmMessage();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");

  if (!contactUser) return <ChatLayout><div className="flex-1 flex items-center justify-center">Loading...</div></ChatLayout>;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !userId) return;
    
    sendMsg.mutate({ contactUserId: userId, data: { content, messageType: 'text' } }, {
      onSuccess: () => {
        setContent("");
        queryClient.invalidateQueries({ queryKey: getListDmMessagesQueryKey(userId) });
      }
    });
  };

  return (
    <ChatLayout>
      <header className="h-16 flex items-center px-6 border-b border-border bg-card/30 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 shrink-0">
            <AvatarImage src={contactUser.avatarUrl || undefined} />
            <AvatarFallback>{contactUser.displayName?.[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold">{contactUser.displayName}</h2>
            <p className="text-xs text-muted-foreground">@{contactUser.username}</p>
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6 flex flex-col justify-end min-h-full">
          {messagesData?.messages.map(msg => (
            <div key={msg.id} className="flex gap-4 group">
              <Avatar className="w-10 h-10 shrink-0">
                <AvatarImage src={msg.sender.avatarUrl || undefined} />
                <AvatarFallback>{msg.sender.displayName?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-semibold text-sm">{msg.sender.displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(msg.createdAt), 'HH:mm')}
                  </span>
                </div>
                <div className="text-sm text-foreground/90 leading-relaxed">
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 bg-background border-t border-border shrink-0">
        <form onSubmit={handleSend} className="bg-muted rounded-xl p-2 flex items-center gap-2">
          <input 
            type="text" 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Message ${contactUser.displayName}`}
            className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-sm px-2"
          />
          <Button size="icon" type="submit" variant="ghost" className="shrink-0 h-8 w-8 text-primary" disabled={!content.trim() || sendMsg.isPending}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </ChatLayout>
  );
}