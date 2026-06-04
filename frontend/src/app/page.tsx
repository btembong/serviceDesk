"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    if (user.role === "CUSTOMER") router.replace("/dashboard");
    else if (user.role === "AGENT") router.replace("/agent");
    else if (user.role === "ADMIN") router.replace("/admin");
  }, [router]);

  return null;
}
