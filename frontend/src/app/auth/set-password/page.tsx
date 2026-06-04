"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Lock, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { saveAuth } from "@/lib/auth";

export default function SetPasswordPage() {
  const router = useRouter();
  const params = useSearchParams();
  const setupToken = params.get("token") || "";
  const name = params.get("name") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [gdpr, setGdpr] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const strength = (() => {
    if (password.length === 0) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "bg-red-400", "bg-amber-400", "bg-blue-400", "bg-emerald-500"][strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (password !== confirm) { toast.error("Passwords do not match."); return; }
    if (!gdpr) { toast.error("You must accept the privacy policy to continue."); return; }
    if (!setupToken) { toast.error("Setup link is invalid. Please start again."); return; }

    setLoading(true);
    try {
      const res = await apiRequest<{ accessToken: string; refreshToken: string; user: any }>(
        "/auth/set-password",
        { method: "POST", body: { setupToken, password, gdprConsent: "true" } }
      );
      saveAuth(res.accessToken, res.refreshToken, res.user);
      toast.success("Account activated! Welcome to UBFinance ServiceDesk.");
      router.replace("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Could not activate account. Please start again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center text-white space-y-1">
          <p className="text-sm font-medium tracking-widest uppercase opacity-75">UBFinance</p>
          <h1 className="text-3xl font-bold">ServiceDesk</h1>
          <p className="text-sm opacity-70">Secure banking support</p>
        </div>

        <Card className="shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Create your password{name ? `, ${name}` : ""}</CardTitle>
            <CardDescription>
              Set a secure password to protect your account. You&apos;ll use this to sign in next time.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    className="pl-9 pr-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPw((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Strength bar */}
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-all ${i <= strength ? strengthColor : "bg-muted"}`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{strengthLabel}</p>
                  </div>
                )}
              </div>

              {/* Confirm */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repeat password"
                    className="pl-9 pr-9"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirm((v) => !v)}
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirm && password !== confirm && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>

              {/* GDPR */}
              <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
                <input
                  type="checkbox"
                  id="gdpr"
                  checked={gdpr}
                  onChange={(e) => setGdpr(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-primary shrink-0"
                />
                <Label htmlFor="gdpr" className="text-xs font-normal text-muted-foreground leading-relaxed cursor-pointer">
                  I agree to the processing of my personal data for support purposes in accordance with UBFinance&apos;s privacy policy and GDPR guidelines.
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !password || !confirm || !gdpr}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Activate account
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
