"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Crown,
  Loader2,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc-client";
import { cn } from "@/lib/utils";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  plan: string;
  isActive: boolean;
  isAdmin: boolean;
  planExpiresAt: string | Date | null;
  taskCompletions: number;
  points: number;
};

type UserForm = {
  userId?: string;
  name: string;
  email: string;
  plan: "free" | "pro";
  isActive: boolean;
  isAdmin: boolean;
};

const emptyUserForm: UserForm = {
  name: "",
  email: "",
  plan: "free",
  isActive: true,
  isAdmin: false,
};

export function AdminDashboard() {
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "pending" | "admin">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [userForm, setUserForm] = useState<UserForm | null>(null);
  const [notification, setNotification] = useState({
    title: "",
    body: "",
    target: "active" as "all" | "active" | "selected",
    url: "/hub/notifications",
  });

  const { data: overview, isLoading: overviewLoading } = trpc.admin.getOverview.useQuery();
  const { data: readiness } = trpc.admin.getNotificationReadiness.useQuery();
  const { data: users = [], isLoading: usersLoading } = trpc.admin.listUsers.useQuery({
    query: debouncedQuery,
    status,
    limit: 80,
  });

  const selectedUsers = useMemo(() => users.filter((user) => selectedIds.has(user.id)), [selectedIds, users]);

  const invalidateAdmin = async () => {
    await Promise.all([
      utils.admin.getOverview.invalidate(),
      utils.admin.listUsers.invalidate(),
      utils.admin.getNotificationReadiness.invalidate(),
    ]);
  };

  const createUser = trpc.admin.createUser.useMutation({
    onSuccess: async () => {
      await invalidateAdmin();
      setUserForm(null);
      toast.success("User created.");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateUser = trpc.admin.updateUser.useMutation({
    onSuccess: async () => {
      await invalidateAdmin();
      setUserForm(null);
      toast.success("User updated.");
    },
    onError: (error) => toast.error(error.message),
  });
  const setActive = trpc.admin.setActive.useMutation({
    onSuccess: async () => {
      await invalidateAdmin();
      toast.success("Activation updated.");
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteUser = trpc.admin.deleteUser.useMutation({
    onSuccess: async () => {
      await invalidateAdmin();
      toast.success("User deleted.");
    },
    onError: (error) => toast.error(error.message),
  });
  const sendNotification = trpc.admin.sendNotification.useMutation({
    onSuccess: (result) => toast.success(`Notification queued for ${result.recipients} user${result.recipients === 1 ? "" : "s"}.`),
    onError: (error) => toast.error(error.message),
  });

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setDebouncedQuery(query.trim());
  };

  const openEdit = (user: AdminUser) => {
    setUserForm({
      userId: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan === "pro" ? "pro" : "free",
      isActive: user.isActive,
      isAdmin: user.isAdmin,
    });
  };

  const submitUserForm = () => {
    if (!userForm) return;
    if (userForm.userId) updateUser.mutate({ ...userForm, userId: userForm.userId });
    else createUser.mutate(userForm);
  };

  const toggleSelected = (userId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  return (
    <div className="premium-page-bg min-h-screen px-4 py-5 sm:px-6 lg:px-0">
      <section className="overflow-hidden rounded-[26px] bg-[#123F37] p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#20C7A4]">Admin</p>
            <h1 className="mt-3 text-3xl font-black tracking-normal">FitNMove control center</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
              Manage users, activation, access, notifications, and system health from one place.
            </p>
          </div>
          <Button onClick={() => setUserForm(emptyUserForm)} className="rounded-full bg-primary text-primary-foreground hover:bg-[#C8FA69]">
            <UserPlus className="h-4 w-4" />
            Add user
          </Button>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ["Users", overview?.totalUsers, Users],
          ["Active", overview?.activeUsers, CheckCircle2],
          ["Pending", overview?.pendingUsers, X],
          ["Admins", overview?.admins, ShieldCheck],
          ["Completions", overview?.completions, Crown],
          ["Push tokens", overview?.pushTokenCount, Bell],
        ].map(([label, value, Icon]) => (
          <div key={String(label)} className="rounded-[18px] border border-[#1A4D40] bg-[#0B2C24] p-4 shadow-sm">
            <Icon className="h-5 w-5 text-[#B8F34A]" />
            <p className="mt-3 text-2xl font-black tabular-nums text-[#F4F8F5]">
              {overviewLoading ? "-" : Number(value ?? 0).toLocaleString()}
            </p>
            <p className="text-xs font-semibold text-[#C0D1CA]">{String(label)}</p>
          </div>
        ))}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[22px] border border-[#1A4D40] bg-[#0B2C24] p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-[#F4F8F5]">Users</h2>
              <p className="mt-1 text-sm text-[#C0D1CA]">Search, activate, edit access, set plan duration, and remove non-admin accounts.</p>
            </div>
            <form onSubmit={submitSearch} className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7773]" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users" className="pl-9" />
              </div>
              <Button type="submit" className="rounded-xl">Search</Button>
            </form>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto">
            {(["all", "active", "pending", "admin"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatus(item)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-sm font-bold capitalize",
                  status === item ? "bg-primary text-primary-foreground" : "bg-[#10372D] text-[#C0D1CA]"
                )}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-4 overflow-hidden rounded-[18px] border border-[#1A4D40]">
            <div className="hidden grid-cols-[44px_1.25fr_0.85fr_0.75fr_0.75fr_210px] gap-3 border-b border-[#1A4D40] bg-[#10372D] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#C0D1CA] xl:grid">
              <span />
              <span>User</span>
              <span>Status</span>
              <span>Plan</span>
              <span>Activity</span>
              <span className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-[#1A4D40]">
              {usersLoading ? (
                <div className="flex min-h-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[#20C7A4]" />
                </div>
              ) : users.length ? (
                users.map((user) => (
                  <div key={user.id} className="grid gap-3 px-4 py-4 xl:grid-cols-[44px_1.25fr_0.85fr_0.75fr_0.75fr_210px] xl:items-center">
                    <label className="flex items-center">
                      <input type="checkbox" checked={selectedIds.has(user.id)} onChange={() => toggleSelected(user.id)} className="h-4 w-4 accent-[#20C7A4]" />
                    </label>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#F4F8F5]">{user.name}</p>
                      <p className="truncate text-xs text-[#C0D1CA]">{user.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", user.isActive ? "bg-[#35D39A] text-[#041A15]" : "bg-[#FF9F43] text-[#041A15]")}>
                        {user.isActive ? "Active" : "Pending"}
                      </span>
                      {user.isAdmin && <span className="rounded-full bg-[#67B7E8] px-2.5 py-1 text-xs font-bold text-[#041A15]">Admin</span>}
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase text-[#F4F8F5]">{user.plan}</p>
                      <p className="text-[10px] font-semibold text-[#8BA59B]">
                        {user.planExpiresAt ? `Until ${new Date(user.planExpiresAt).toLocaleDateString()}` : "No expiry"}
                      </p>
                    </div>
                    <p className="text-xs text-[#C0D1CA]">{user.taskCompletions} completions / {user.points} pts</p>
                    <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                      {[
                        ["1M", "1m"],
                        ["6M", "6m"],
                        ["1Y", "1y"],
                      ].map(([label, duration]) => (
                        <Button
                          key={`${user.id}-${duration}`}
                          type="button"
                          variant="outline"
                          className="h-9 rounded-xl px-2 text-xs"
                          onClick={() => setActive.mutate({ userId: user.id, isActive: true, duration: duration as "1m" | "6m" | "1y" })}
                        >
                          {label}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-xl px-3 text-xs"
                        onClick={() => setActive.mutate({ userId: user.id, isActive: !user.isActive, duration: user.isActive ? "none" : "1m" })}
                      >
                        {user.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEdit(user)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={user.isAdmin}
                        onClick={() => {
                          if (window.confirm(`Delete ${user.email}? This cannot be undone.`)) {
                            deleteUser.mutate({ userId: user.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-12 text-center text-sm text-[#C0D1CA]">No users found.</div>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-[22px] border border-[#E3EAE7] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-[#17201E]">Send notification</h2>
              <Bell className="h-5 w-5 text-[#20C7A4]" />
            </div>
            <p className="mt-1 text-sm text-[#6B7773]">
              Push-ready devices: {readiness?.tokens ?? 0} tokens • {readiness?.subscriptions ?? 0} legacy subscriptions.
            </p>
            <div className="mt-4 space-y-3">
              <Input value={notification.title} onChange={(event) => setNotification((current) => ({ ...current, title: event.target.value }))} placeholder="Notification title" />
              <Textarea value={notification.body} onChange={(event) => setNotification((current) => ({ ...current, body: event.target.value }))} placeholder="Message body" />
              <Input value={notification.url} onChange={(event) => setNotification((current) => ({ ...current, url: event.target.value }))} placeholder="/hub/notifications" />
              <select
                value={notification.target}
                onChange={(event) => setNotification((current) => ({ ...current, target: event.target.value as typeof notification.target }))}
                className="flex min-h-12 w-full rounded-xl border border-input bg-white px-4 py-3 text-base outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="active">All active users</option>
                <option value="all">All users</option>
                <option value="selected">Selected users ({selectedUsers.length})</option>
              </select>
              <Button
                type="button"
                className="w-full rounded-xl"
                disabled={sendNotification.isPending}
                onClick={() =>
                  sendNotification.mutate({
                    ...notification,
                    userIds: [...selectedIds],
                  })
                }
              >
                {sendNotification.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                Send notification
              </Button>
            </div>
          </section>

          <section className="rounded-[22px] border border-[#E3EAE7] bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black text-[#17201E]">Admin tools</h2>
            <div className="mt-3 space-y-2 text-sm text-[#6B7773]">
              <p>Use filters to review pending accounts before activation.</p>
              <p>Selected users can receive targeted admin guidance.</p>
              <p>Deleting users is blocked for admin accounts and your own account.</p>
            </div>
          </section>
        </aside>
      </div>

      {userForm && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/35 p-3 sm:items-center sm:justify-center">
          <div className="w-full max-w-lg rounded-[24px] bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-[#17201E]">{userForm.userId ? "Edit user" : "Create user"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setUserForm(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              <Input value={userForm.name} onChange={(event) => setUserForm((current) => current && { ...current, name: event.target.value })} placeholder="Name" />
              <Input value={userForm.email} onChange={(event) => setUserForm((current) => current && { ...current, email: event.target.value })} placeholder="Email" />
              <select
                value={userForm.plan}
                onChange={(event) => setUserForm((current) => current && { ...current, plan: event.target.value as "free" | "pro" })}
                className="flex min-h-12 w-full rounded-xl border border-input bg-white px-4 py-3 text-base outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="free">Free</option>
                <option value="pro">Pro</option>
              </select>
              <label className="flex items-center gap-3 rounded-xl bg-[#F7FAF9] px-4 py-3 text-sm font-semibold text-[#17201E]">
                <input type="checkbox" checked={userForm.isActive} onChange={(event) => setUserForm((current) => current && { ...current, isActive: event.target.checked })} className="h-4 w-4 accent-[#20C7A4]" />
                Active user
              </label>
              <label className="flex items-center gap-3 rounded-xl bg-[#F7FAF9] px-4 py-3 text-sm font-semibold text-[#17201E]">
                <input type="checkbox" checked={userForm.isAdmin} onChange={(event) => setUserForm((current) => current && { ...current, isAdmin: event.target.checked })} className="h-4 w-4 accent-[#20C7A4]" />
                Admin access
              </label>
              <Button className="w-full rounded-xl" onClick={submitUserForm} disabled={createUser.isPending || updateUser.isPending}>
                {createUser.isPending || updateUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save user
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
