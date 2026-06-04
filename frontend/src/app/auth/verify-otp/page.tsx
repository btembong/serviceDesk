"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { saveAuth } from "@/lib/auth";

export default function VerifyOtpPage() {
  const router = useRouter();
  const params = useSearchParams();
  const identifier = params.get("identifier") || "";
  const name = params.get("name") || "";

  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const otp = digits.join("");

  const handleChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (char && index < 5) inputRefs.current[index + 1]?.focus();
    // Auto-submit when all filled
    if (char && next.every(Boolean) && index === 5) {
      submitOtp(next.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill("");
    pasted.split("").forEach((c, i) => { next[i] = c; });
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
    if (pasted.length === 6) submitOtp(pasted);
  };

  const submitOtp = async (code: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await apiRequest<any>("/auth/verify-otp", {
        method: "POST",
        body: { identifier, otp: code },
      });

      if (res.status === "set-password") {
        router.push(`/auth/set-password?token=${encodeURIComponent(res.setupToken)}&name=${encodeURIComponent(res.name)}`);
      } else {
        saveAuth(res.accessToken, res.refreshToken, res.user);
        toast.success(`Welcome back, ${res.user.firstName}!`);
        router.replace("/dashboard");
      }
    } catch (err: any) {
      toast.error(err.message || "Invalid code. Please try again.");
      setDigits(Array(6).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await apiRequest("/auth/send-otp", {
        method: "POST",
        body: { identifier },
      });
      toast.success("A new code has been sent.");
      setDigits(Array(6).fill(""));
      inputRefs.current[0]?.focus();
      setCooldown(60);
    } catch (err: any) {
      toast.error(err.message || "Could not resend code.");
    } finally {
      setResending(false);
    }
  };

  const isEmail = identifier.includes("@");
  const masked = isEmail
    ? identifier.replace(/^(.{2}).*(@.*)$/, "$1****$2")
    : identifier.replace(/^(.{3}).*(.{3})$/, "$1****$2");

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
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Verify your identity{name ? `, ${name}` : ""}</CardTitle>
            <CardDescription>
              Enter the 6-digit code sent to <span className="font-medium text-foreground">{masked}</span>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-4">
            {/* OTP digits */}
            <div className="flex justify-center gap-2" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  disabled={loading}
                  className="h-12 w-11 rounded-lg border border-input bg-background text-center text-lg font-semibold tracking-widest shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                />
              ))}
            </div>

            <Button
              type="button"
              className="w-full"
              disabled={loading || otp.length < 6}
              onClick={() => submitOtp(otp)}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify code
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Didn&apos;t receive the code?{" "}
              {cooldown > 0 ? (
                <span className="text-muted-foreground">Resend in {cooldown}s</span>
              ) : (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-primary font-medium hover:underline disabled:opacity-50"
                  onClick={handleResend}
                  disabled={resending}
                >
                  {resending && <Loader2 className="h-3 w-3 animate-spin" />}
                  {!resending && <RefreshCw className="h-3 w-3" />}
                  Resend
                </button>
              )}
            </div>

            <div className="text-center">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:underline"
                onClick={() => router.push("/auth/login")}
              >
                Use a different account
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
