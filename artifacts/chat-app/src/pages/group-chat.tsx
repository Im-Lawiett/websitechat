import { useParams } from "wouter";
import { ChatLayout } from "@/components/chat/chat-layout";
import {
  useGetGroup, useListGroupMessages, useGetMe,
  useSendGroupMessage, useJoinGroup,
  getGetGroupQueryKey, getListGroupMessagesQueryKey,
} from "@workspace/api-client-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Hash, Send, UserPlus } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState, useRef, useEffect } from "react";

export default function GroupChat() {
  const { groupId } = useParams();
  const id = parseInt(groupId || "0");
  const [content, setContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: user } = useGetMe();
  const { data: group } = useGetGroup(id, { query: { enabled: !!id, queryKey: getGetGroupQueryKey(id) } });
  const { data: messagesData } = useListGroupMessages(id, {}, { query: { enabled: !!id, queryKey: getListGroupMessagesQueryKey(id) } });

  const sendMsg = useSendGroupMessage();
  const joinGroup = useJoinGroup();

  useWebSocket(user?.id);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesData?.messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !id) return;
    sendMsg.mutate(
      { groupId: id, data: { content, messageType: "text" } },
      {
        onSuccess: () => {
          setContent("");
          queryClient.invalidateQueries({ queryKey: getListGroupMessagesQueryKey(id) });
        },
      }
    );
  };

  const handleJoin = () => {
    joinGroup.mutate(
      { groupId: id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(id) });
        },
      }
    );
  };

  if (!group)
    return (
      <ChatLayout>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading…</div>
      </ChatLayout>
    );

  const isMember = group.isMember;

  return (
    <ChatLayout>
      <header className="h-16 flex items-center px-6 border-b border-border bg-card/30 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            {group.avatarUrl ? (
              <img src={group.avatarUrl} alt={group.name} className="w-full h-full object-cover rounded-lg" />
            ) : (
              <Hash className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold truncate">{group.name}</h2>
            <p className="text-xs text-muted-foreground">{group.memberCount} members</p>
          </div>
        </div>
        {!isMember && (
          <Button size="sm" onClick={handleJoin} disabled={joinGroup.isPending} className="shrink-0 gap-2">
            <UserPlus className="w-4 h-4" />
            Join
          </Button>
        )}
      </header>

      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6">
          {messagesData?.messages.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-12">
              No messages yet. Be the first to say something!
            </p>
          )}
          {messagesData?.messages.map((msg) => (
            <div key={msg.id} className="flex gap-4 group">
              <Avatar className="w-10 h-10 shrink-0">
                <AvatarImage src={msg.sender?.avatarUrl || undefined} />
                <AvatarFallback>{msg.sender?.displayName?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-semibold text-sm">{msg.sender?.displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(msg.createdAt), "HH:mm")}
                  </span>
                </div>
                {msg.fileUrl ? (
                  <div className="mt-1">
                    {msg.messageType === "image" ? (
                      <img src={msg.fileUrl} alt={msg.fileName || "image"} className="max-w-xs rounded-lg" />
                    ) : (
                      <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="text-primary underline text-sm">
                        {msg.fileName || "Download file"}
                      </a>
                    )}
                    {msg.content && <p className="text-sm text-foreground/90 leading-relaxed mt-1">{msg.content}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-foreground/90 leading-relaxed">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {isMember ? (
        <div className="p-4 bg-background border-t border-border shrink-0">
          <form onSubmit={handleSend} className="bg-muted rounded-xl p-2 flex items-center gap-2">
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Message #${group.name}`}
              className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-sm px-2"
            />
            <Button
              size="icon"
              type="submit"
              variant="ghost"
              className="shrink-0 h-8 w-8 text-primary"
              disabled={!content.trim() || sendMsg.isPending}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      ) : (
        <div className="p-4 border-t border-border bg-background text-center text-sm text-muted-foreground">
          Join this group to send messages.
        </div>
      )}
    </ChatLayout>
  );
}
