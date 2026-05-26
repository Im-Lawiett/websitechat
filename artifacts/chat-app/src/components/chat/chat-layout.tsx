import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useListGroups, useListContacts } from "@workspace/api-client-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, Users, Hash, Shield, LogOut, MessageSquare } from "lucide-react";
import { useClerk } from "@clerk/react";

export function ChatLayout({ children }: { children: ReactNode }) {
  const { data: user } = useGetMe();
  const { data: groupsData } = useListGroups();
  const { data: contactsData } = useListContacts();
  const [location] = useLocation();
  const { signOut } = useClerk();

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-72 border-r border-border flex flex-col bg-card/50 backdrop-blur-sm">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground">G</div>
            <span className="font-bold text-xl tracking-tight">GlobalChat</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={user?.avatarUrl || undefined} />
              <AvatarFallback>{user?.displayName?.[0] || user?.username?.[0] || '?'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate">{user?.displayName || user?.username}</p>
              <p className="text-xs text-muted-foreground truncate">@{user?.username}</p>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2 px-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Groups</h3>
              </div>
              <div className="space-y-1">
                {groupsData?.groups.map(group => {
                  const isActive = location === `/chat/group/${group.id}`;
                  return (
                    <Link key={group.id} href={`/chat/group/${group.id}`} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}>
                      <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Hash className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <span className="truncate">{group.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2 px-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Direct Messages</h3>
              </div>
              <div className="space-y-1">
                {contactsData?.contacts.map(contact => {
                  const isActive = location === `/chat/dm/${contact.contactUserId}`;
                  return (
                    <Link key={contact.id} href={`/chat/dm/${contact.contactUserId}`} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}>
                      <Avatar className="w-6 h-6 shrink-0">
                        <AvatarImage src={contact.contact.avatarUrl || undefined} />
                        <AvatarFallback className="text-[10px]">{contact.contact.displayName?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{contact.contact.displayName}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-border mt-auto">
          <div className="space-y-1">
            <Link href="/profile" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location === '/profile' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">Profile Settings</span>
            </Link>
            {user?.role === 'admin' && (
              <Link href="/admin" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location.startsWith('/admin') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                <Shield className="w-4 h-4" />
                <span className="text-sm font-medium">Admin Dashboard</span>
              </Link>
            )}
            <button onClick={() => signOut()} className="w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Log Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative z-0">
        {children}
      </main>
    </div>
  );
}