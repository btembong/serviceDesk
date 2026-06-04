"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, UserCheck, UserX, UserPlus, X } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/api";
import { getToken } from "@/lib/auth";

const EMPTY_FORM = { firstName: "", lastName: "", email: "", phone: "", role: "AGENT" };

export default function AdminUsersPage() {
  const token = getToken();
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (roleFilter && roleFilter !== "all") params.set("role", roleFilter);

    apiRequest<{ users: any[]; total: number }>(`/admin/users?${params}`, { token: token! })
      .then(({ users, total }) => { setUsers(users); setTotal(total); })
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, [roleFilter]);

  const toggleActive = async (userId: string, isActive: boolean) => {
    setUpdating(userId);
    try {
      await apiRequest(`/admin/users/${userId}`, {
        method: "PATCH",
        body: { isActive: !isActive },
        token: token!,
      });
      setUsers((u) => u.map((user) => user.id === userId ? { ...user, isActive: !isActive } : user));
      toast.success(isActive ? "User deactivated" : "User activated");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdating(null);
    }
  };

  const changeRole = async (userId: string, role: string) => {
    setUpdating(userId);
    try {
      await apiRequest(`/admin/users/${userId}`, { method: "PATCH", body: { role }, token: token! });
      setUsers((u) => u.map((user) => user.id === userId ? { ...user, role } : user));
      toast.success("Role updated");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdating(null);
    }
  };

  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await apiRequest<{ user: any }>("/admin/users", {
        method: "POST",
        body: form,
        token: token!,
      });
      setUsers((u) => [res.user, ...u]);
      setTotal((t) => t + 1);
      setShowCreate(false);
      setForm(EMPTY_FORM);
      toast.success("Staff account created. Password setup email sent.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const filtered = users.filter((u) =>
    !search || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell allowedRoles={["ADMIN"]}>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold">Users</h2>
            <p className="text-muted-foreground text-sm">{total} total users</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email"
                className="pl-9 w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="CUSTOMER">Customer</SelectItem>
                <SelectItem value="AGENT">Agent</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowCreate(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> Create Staff
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-48"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Role</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Tickets</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">{user.firstName} {user.lastName}</td>
                      <td className="p-3 text-muted-foreground">{user.email}</td>
                      <td className="p-3">
                        <Select defaultValue={user.role} onValueChange={(r) => changeRole(user.id, r)}>
                          <SelectTrigger className="w-28 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CUSTOMER">Customer</SelectItem>
                            <SelectItem value="AGENT">Agent</SelectItem>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 text-muted-foreground">{user._count?.tickets ?? 0}</td>
                      <td className="p-3">
                        <Badge variant={user.isActive ? "success" : "destructive"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => toggleActive(user.id, user.isActive)}
                          disabled={updating === user.id}
                          className={user.isActive ? "text-red-600 hover:text-red-700" : "text-green-600 hover:text-green-700"}
                        >
                          {updating === user.id ? <Loader2 className="h-3 w-3 animate-spin" /> :
                            user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />
                          }
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Staff Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Create Staff Account</CardTitle>
              <button onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={createStaff} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>First name</Label>
                    <Input placeholder="Jane" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last name</Label>
                    <Input placeholder="Doe" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Email address</Label>
                  <Input type="email" placeholder="agent@ubfinance.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input type="tel" placeholder="690000000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(r) => setForm({ ...form, role: r })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AGENT">Agent</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5">
                  A password setup link will be emailed to the new staff member. The link expires in 24 hours.
                </p>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create account
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
