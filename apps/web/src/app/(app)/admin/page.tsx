import { desc, ilike, or } from "drizzle-orm";
import { CheckCircle2, Search, ShieldCheck, UserRoundX } from "lucide-react";
import { setUserActivation } from "@/server/actions/admin";
import { requireAdminUser } from "@/server/authz";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AdminPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  await requireAdminUser();
  const params = await searchParams;
  const query = (params.q ?? "").trim();

  const searchFilter = query
    ? or(ilike(users.email, `%${query}%`), ilike(users.name, `%${query}%`))
    : undefined;

  const userQuery = db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      isActive: users.isActive,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users);

  const registeredUsers = await (searchFilter ? userQuery.where(searchFilter) : userQuery)
    .orderBy(desc(users.createdAt))
    .limit(100);

  const pendingCount = registeredUsers.filter((user) => !user.isActive && !user.isAdmin).length;

  return (
    <div className="min-h-screen bg-[#F8FAF7] px-4 py-6 sm:px-6 lg:py-8">
      <section className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border border-[#DCE7DC] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Admin</p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">User activation</h1>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                Review new registrations and activate approved accounts.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-[#EDF8F2] px-4 py-3">
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-xl font-semibold text-[#0E6B4D]">{pendingCount}</p>
              </div>
              <div className="rounded-xl bg-[#F4F7FB] px-4 py-3">
                <p className="text-xs text-muted-foreground">Showing</p>
                <p className="text-xl font-semibold text-foreground">{registeredUsers.length}</p>
              </div>
            </div>
          </div>

          <form className="mt-6 flex flex-col gap-3 sm:flex-row" action="/admin">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={query}
                placeholder="Search by name or email"
                className="h-11 rounded-xl border-[#DCE7DC] bg-white pl-9 text-sm"
              />
            </div>
            <Button type="submit" className="h-11 rounded-xl px-5">
              Search
            </Button>
          </form>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#DCE7DC] bg-white shadow-sm">
          <div className="hidden grid-cols-[1.4fr_0.7fr_0.6fr_0.4fr] gap-4 border-b border-[#E6EEE6] px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground md:grid">
            <span>User</span>
            <span>Status</span>
            <span>Joined</span>
            <span className="text-right">Action</span>
          </div>

          <div className="divide-y divide-[#E6EEE6]">
            {registeredUsers.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                No registered users found.
              </div>
            ) : (
              registeredUsers.map((user) => (
                <div
                  key={user.id}
                  className="grid gap-4 px-5 py-4 md:grid-cols-[1.4fr_0.7fr_0.6fr_0.4fr] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>

                  <div>
                    {user.isAdmin ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] px-2.5 py-1 text-xs font-medium text-[#1D4ED8]">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Admin
                      </span>
                    ) : user.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF8F1] px-2.5 py-1 text-xs font-medium text-[#0E6B4D]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF5E8] px-2.5 py-1 text-xs font-medium text-[#9A5B00]">
                        <UserRoundX className="h-3.5 w-3.5" />
                        Pending
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {user.createdAt.toLocaleDateString("en", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>

                  <form action={setUserActivation} className="flex justify-start md:justify-end">
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="isActive" value={String(!user.isActive)} />
                    <Button
                      type="submit"
                      variant={user.isActive ? "outline" : "default"}
                      disabled={user.isAdmin}
                      className="h-9 rounded-xl px-4 text-xs"
                    >
                      {user.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </form>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
