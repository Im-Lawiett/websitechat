import { useState } from "react";
import { Link } from "wouter";
import {
  useGetAdminStats, useListAdminUsers, useListGroups,
  useBanUser, useUnbanUser, useCreateGroup, useDeleteGroup,
  useGetAdminRecentActivity,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListAdminUsersQueryKey, getGetAdminStatsQueryKey, getListGroupsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users, Hash, MessageSquare, Shield, ArrowLeft,
  UserX, UserCheck, Trash2, Plus, Activity,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

type Tab = "overview" | "users" | "groups" | "activity";

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [userStatus, setUserStatus] = useState<"all" | "active" | "banned">("all");
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; displayName: string } | null>(null);
  const [banReason, setBanReason] = useState("");
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");

  const qc = useQueryClient();

  const { data: stats } = useGetAdminStats();
  const { data: usersData } = useListAdminUsers(
    { search: search || undefined, status: userStatus },
    { query: { queryKey: getListAdminUsersQueryKey({ search: search || undefined, status: userStatus }) } }
  );
  const { data: groupsData } = useListGroups({ query: { queryKey: getListGroupsQueryKey() } });
  const { data: activityData } = useGetAdminRecentActivity();

  const banUser = useBanUser();
  const unbanUser = useUnbanUser();
  const createGroup = useCreateGroup();
  const deleteGroup = useDeleteGroup();

  const handleBan = () => {
    if (!selectedUser) return;
    banUser.mutate(
      { userId: selectedUser.id, data: { reason: banReason } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
          qc.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
          setBanDialogOpen(false);
          setBanReason("");
          setSelectedUser(null);
        },
      }
    );
  };

  const handleUnban = (userId: string) => {
    unbanUser.mutate(
      { userId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
          qc.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        },
      }
    );
  };

  const handleCreateGroup = () => {
    if (!groupName.trim()) return;
    createGroup.mutate(
      { data: { name: groupName, description: groupDesc || undefined } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListGroupsQueryKey() });
          setCreateGroupOpen(false);
          setGroupName("");
          setGroupDesc("");
        },
      }
    );
  };

  const handleDeleteGroup = (groupId: number) => {
    if (!confirm("Delete this group? This cannot be undone.")) return;
    deleteGroup.mutate({ groupId }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListGroupsQueryKey() }),
    });
  };

  return (
    <div className="flex h-[100dvh] bg-background text-foreground">
      <aside className="w-56 border-r border-border flex flex-col bg-card/50">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-bold text-lg">Admin</span>
          </div>
          <Link href="/chat" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Back to Chat
          </Link>
        </div>
        <nav className="p-3 space-y-1">
          {(["overview", "users", "groups", "activity"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                tab === t ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {t === "overview" && <Activity className="w-4 h-4" />}
              {t === "users" && <Users className="w-4 h-4" />}
              {t === "groups" && <Hash className="w-4 h-4" />}
              {t === "activity" && <MessageSquare className="w-4 h-4" />}
              <span className="capitalize">{t}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        {tab === "overview" && (
          <div className="p-8 space-y-8">
            <h1 className="text-2xl font-bold">Overview</h1>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Users", value: stats?.totalUsers ?? "—", icon: Users, color: "text-blue-400" },
                { label: "Active Users", value: stats?.activeUsers ?? "—", icon: UserCheck, color: "text-green-400" },
                { label: "Banned Users", value: stats?.bannedUsers ?? "—", icon: UserX, color: "text-red-400" },
                { label: "Total Groups", value: stats?.totalGroups ?? "—", icon: Hash, color: "text-purple-400" },
                { label: "Total Messages", value: stats?.totalMessages ?? "—", icon: MessageSquare, color: "text-yellow-400" },
                { label: "Messages Today", value: stats?.messagesToday ?? "—", icon: MessageSquare, color: "text-orange-400" },
                { label: "New Users Today", value: stats?.newUsersToday ?? "—", icon: Users, color: "text-teal-400" },
              ].map((card) => (
                <div key={card.label} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2">
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "users" && (
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Users</h1>
              <p className="text-sm text-muted-foreground">{usersData?.total ?? 0} total</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Input
                placeholder="Search users…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <div className="flex gap-1">
                {(["all", "active", "banned"] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={userStatus === s ? "default" : "outline"}
                    onClick={() => setUserStatus(s)}
                    className="capitalize"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
            <ScrollArea className="h-[calc(100dvh-240px)]">
              <div className="space-y-2">
                {usersData?.users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl"
                  >
                    <Avatar>
                      <AvatarImage src={u.avatarUrl || undefined} />
                      <AvatarFallback>{u.displayName?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate">{u.displayName}</p>
                        {u.role === "admin" && <Badge variant="secondary" className="text-xs">Admin</Badge>}
                        {u.isBanned && <Badge variant="destructive" className="text-xs">Banned</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">@{u.username} · {u.email}</p>
                      {u.isBanned && u.banReason && (
                        <p className="text-xs text-destructive mt-0.5">Reason: {u.banReason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {u.role !== "admin" && (
                        u.isBanned ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnban(u.id)}
                            disabled={unbanUser.isPending}
                            className="gap-1"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Unban
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedUser({ id: u.id, displayName: u.displayName });
                              setBanDialogOpen(true);
                            }}
                            className="gap-1"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            Ban
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {tab === "groups" && (
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Groups</h1>
              <Button onClick={() => setCreateGroupOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                New Group
              </Button>
            </div>
            <ScrollArea className="h-[calc(100dvh-180px)]">
              <div className="space-y-2">
                {groupsData?.groups.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {g.avatarUrl ? (
                        <img src={g.avatarUrl} className="w-full h-full object-cover rounded-lg" alt={g.name} />
                      ) : (
                        <Hash className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{g.name}</p>
                      {g.description && (
                        <p className="text-xs text-muted-foreground truncate">{g.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{g.memberCount} members</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                      >
                        <Link href={`/chat/group/${g.id}`}>View</Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteGroup(g.id)}
                        disabled={deleteGroup.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {tab === "activity" && (
          <div className="p-8 space-y-6">
            <h1 className="text-2xl font-bold">Recent Activity</h1>
            <ScrollArea className="h-[calc(100dvh-180px)]">
              <div className="space-y-2">
                {activityData?.activities.map((a) => (
                  <div key={a.id} className="flex items-start gap-4 p-4 bg-card border border-border rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Activity className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{a.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(a.createdAt), "MMM d, yyyy HH:mm")}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize shrink-0">
                      {a.type.replace(/_/g, " ")}
                    </Badge>
                  </div>
                ))}
                {!activityData?.activities.length && (
                  <p className="text-center text-muted-foreground text-sm py-12">No activity yet.</p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </main>

      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban {selectedUser?.displayName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Reason for ban</Label>
            <Textarea
              placeholder="Enter reason…"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBan} disabled={!banReason.trim() || banUser.isPending}>
              Ban User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Group Name *</Label>
              <Input
                placeholder="e.g. General"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="What's this group about?"
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateGroupOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateGroup} disabled={!groupName.trim() || createGroup.isPending}>
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
