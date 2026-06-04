"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import Sidebar from "./Sidebar";

type Props = {
  children: React.ReactNode;
  allowedRoles?: Array<"CUSTOMER" | "AGENT" | "ADMIN">;
};

export default function AppShell({ children, allowedRoles }: Props) {
  const router = useRouter();

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      if (user.role === "CUSTOMER") router.replace("/dashboard");
      else if (user.role === "AGENT") router.replace("/agent");
      else router.replace("/admin");
    }
  }, [router, allowedRoles]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
