"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Lock, Mail, Phone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { saveAuth } from "@/lib/auth";

type Step = "identifier" | "password" | "otp-sent";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [greeting, setGreeting] = useState("");
  const [loading, setLoading] = useState(false);

  const isEmail = identifier.includes("@");

  // Step 1 — check which flow applies
  const handleCheckFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setLoading(true);
    try {
      const res = await apiRequest<{ flow: "password" | "otp"; name: string }>(
        "/auth/check-flow",
        { method: "POST", body: { identifier: identifier.trim() } }
      );
      setGreeting(res.name);
      if (res.flow === "otp") {
        // Send OTP immediately
        await apiRequest("/auth/send-otp", {
          method: "POST",
          body: { identifier: identifier.trim() },
        });
        setStep("otp-sent");
        router.push(`/auth/verify-otp?identifier=${encodeURIComponent(identifier.trim())}&name=${encodeURIComponent(res.name)}`);
      } else {
        setStep("password");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — password login (staff + returning customers)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    try {
      const res = await apiRequest<{ accessToken: string; refreshToken: string; user: any }>(
        "/auth/login",
        { method: "POST", body: { email: identifier.trim(), password } }
      );
      saveAuth(res.accessToken, res.refreshToken, res.user);
      toast.success(`Welcome back, ${res.user.firstName}!`);
      if (res.user.role === "CUSTOMER") router.replace("/dashboard");
      else if (res.user.role === "AGENT") router.replace("/agent");
      else router.replace("/admin");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="text-center text-white space-y-1">
          <p className="text-sm font-medium tracking-widest uppercase opacity-75">UBFinance</p>
          <h1 className="text-3xl font-bold">ServiceDesk</h1>
          <p className="text-sm opacity-70">Secure banking support</p>
        </div>

        <Card className="shadow-2xl">
          <CardHeader>
            <CardTitle>
              {step === "identifier" && "Sign in"}
              {step === "password" && `Welcome back${greeting ? `, ${greeting}` : ""}`}
            </CardTitle>
            <CardDescription>
              {step === "identifier" && "Enter your email address or phone number"}
              {step === "password" && "Enter your password to continue"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Step 1 — identifier */}
            {step === "identifier" && (
              <form onSubmit={handleCheckFlow} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="identifier">Email or phone number</Label>
                  <div className="relative">
                    {isEmail
                      ? <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      : <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    }
                    <Input
                      id="identifier"
                      type="text"
                      placeholder="you@example.com or 0800 000 0000"
                      className="pl-9"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading || !identifier.trim()}>
                  {loading
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <ArrowRight className="mr-2 h-4 w-4" />
                  }
                  Continue
                </Button>
              </form>
            )}

            {/* Step 2 — password */}
            {step === "password" && (
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Show the identifier as read-only context */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{identifier}</span>
                  <button
                    type="button"
                    className="ml-auto text-xs text-primary hover:underline shrink-0"
                    onClick={() => { setStep("identifier"); setPassword(""); }}
                  >
                    Change
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link href="/auth/forgot-password" className="text-xs text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-9"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading || !password.trim()}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </form>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
