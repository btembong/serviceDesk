"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, CirclePlus, TicketCheck, BellRing,
  ListTodo, ScanFace, UsersRound, BarChart3,
  ScrollText, LogOut, Settings, Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearAuth, getUser } from "@/lib/auth";
import { toast } from "sonner";

const customerLinks = [
  { href: "/dashboard",    label: "Dashboard",      icon: LayoutDashboard },
  { href: "/tickets/new",  label: "New Ticket",      icon: CirclePlus },
  { href: "/tickets",      label: "My Tickets",      icon: TicketCheck },
  { href: "/notifications",label: "Notifications",   icon: BellRing },
  { href: "/settings",     label: "Settings",        icon: Settings },
];

const agentLinks = [
  { href: "/agent",           label: "Ticket Queue", icon: ListTodo },
  { href: "/agent/kyc-queue", label: "KYC Review",   icon: ScanFace },
  { href: "/notifications",   label: "Notifications",icon: BellRing },
  { href: "/settings",        label: "Settings",     icon: Settings },
];

const adminLinks = [
  { href: "/admin",                label: "Overview",    icon: LayoutDashboard },
  { href: "/admin/tickets",        label: "All Tickets", icon: TicketCheck },
  { href: "/admin/kyc-queue",      label: "KYC Queue",   icon: ScanFace },
  { href: "/admin/users",          label: "Users",       icon: UsersRound },
  { href: "/admin/analytics",      label: "Analytics",   icon: BarChart3 },
  { href: "/admin/leaderboard",    label: "Leaderboard", icon: Trophy },
  { href: "/admin/audit-logs",     label: "Audit Logs",  icon: ScrollText },
  { href: "/settings",             label: "Settings",    icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUser();

  const links =
    user?.role === "ADMIN" ? adminLinks :
    user?.role === "AGENT" ? agentLinks :
    customerLinks;

  const handleLogout = () => {
    clearAuth();
    toast.success("Logged out successfully.");
    router.replace("/auth/login");
  };

  return (
    <aside className="w-64 min-h-screen bg-indigo-900 text-white flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <p className="text-xs text-white/60 font-medium uppercase tracking-widest">UBFinance</p>
        <h1 className="text-lg font-bold">ServiceDesk</h1>
      </div>

      {/* User info */}
      <div className="px-6 py-4 border-b border-white/10">
        <p className="text-sm font-semibold">{user?.firstName} {user?.lastName}</p>
        <span className="text-xs text-white/60 capitalize">{user?.role?.toLowerCase()}</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-white/20 text-white"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors w-full"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
