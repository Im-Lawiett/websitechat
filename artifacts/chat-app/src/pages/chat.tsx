import { ChatLayout } from "@/components/chat/chat-layout";
import { MessageSquare } from "lucide-react";

export default function ChatHome() {
  return (
    <ChatLayout>
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 h-full bg-card/20">
        <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
          <MessageSquare className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Welcome to GlobalChat</h2>
        <p className="text-muted-foreground max-w-md">
          Select a group or direct message from the sidebar to start talking. 
          Connect with the community in real-time.
        </p>
      </div>
    </ChatLayout>
  );
}