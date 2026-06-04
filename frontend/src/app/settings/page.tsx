"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Settings, Bell, Download, Trash2, Loader2, Mail, MessageSquare, ShieldAlert,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { getToken, getUser, clearAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const token = getToken();
  const user = getUser();
  const router = useRouter();

  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    // Load current preferences from profile
    apiRequest<{ user: any }>(`/admin/users`, { token: token! })
      .catch(() => {});
    // Optimistically set from JWT payload if available
  }, []);

  const savePreferences = async () => {
    setSavingPrefs(true);
    try {
      await apiRequest("/user/preferences", {
        method: "PATCH",
        body: { notifyEmail, notifySms },
        token: token!,
      });
      toast.success("Notification preferences saved.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingPrefs(false);
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/user/export`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ubfinance-data-export.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully.");
    } catch {
      toast.error("Failed to export data.");
    } finally {
      setExporting(false);
    }
  };

  const requestDeletion = async () => {
    setDeleting(true);
    try {
      await apiRequest("/user/account", { method: "DELETE", token: token! });
      toast.success("Account deletion requested. You will be logged out.");
      setTimeout(() => {
        clearAuth();
        router.replace("/auth/login");
      }, 2000);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <AppShell>
      <div className="p-8 space-y-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2.5 rounded-full">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Settings</h2>
            <p className="text-muted-foreground text-sm mt-0.5">Manage your preferences and account</p>
          </div>
        </div>

        {/* Notification preferences */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Notification Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose how you want to receive notifications about your tickets and account activity.
            </p>
            <div className="space-y-3">
              <ToggleRow
                icon={<Mail className="h-4 w-4" />}
                label="Email notifications"
                description="Receive ticket updates, KYC results and OTPs by email"
                enabled={notifyEmail}
                onToggle={() => setNotifyEmail((v) => !v)}
              />
              <ToggleRow
                icon={<MessageSquare className="h-4 w-4" />}
                label="SMS notifications"
                description="Receive ticket updates and OTPs by SMS"
                enabled={notifySms}
                onToggle={() => setNotifySms((v) => !v)}
              />
            </div>
            <Button onClick={savePreferences} disabled={savingPrefs} size="sm">
              {savingPrefs && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Save preferences
            </Button>
          </CardContent>
        </Card>

        {/* GDPR — data export */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              Export Your Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Download a complete copy of all data we hold about you — profile, tickets, KYC records,
              notifications and audit history — as a JSON file.
            </p>
            <Button variant="outline" onClick={exportData} disabled={exporting} size="sm">
              {exporting
                ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                : <Download className="mr-2 h-3.5 w-3.5" />
              }
              Download data export
            </Button>
          </CardContent>
        </Card>

        {/* GDPR — account deletion */}
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <ShieldAlert className="h-4 w-4" />
              Delete Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Requesting deletion will immediately deactivate your account. Your data will be permanently
              purged after 30 days in accordance with our retention policy. This cannot be undone.
            </p>
            {!confirmDelete ? (
              <Button
                variant="outline"
                size="sm"
                className="border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Request account deletion
              </Button>
            ) : (
              <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">
                  Are you sure? This will deactivate your account immediately.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={requestDeletion}
                    disabled={deleting}
                  >
                    {deleting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Yes, delete my account
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function ToggleRow({
  icon, label, description, enabled, onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 p-1.5 rounded-md", enabled ? "bg-indigo-100 text-primary" : "bg-muted text-muted-foreground")}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none",
          enabled ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform",
            enabled ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}
