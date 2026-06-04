"use client";
import { useEffect, useState } from "react";
import { Loader2, Trophy, Clock, Ticket } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";
import { getToken } from "@/lib/auth";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const token = getToken();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ leaderboard: any[] }>("/admin/leaderboard", { token: token! })
      .then(({ leaderboard }) => setLeaderboard(leaderboard))
      .finally(() => setLoading(false));
  }, []);

  const max = leaderboard[0]?.resolved || 1;

  return (
    <AppShell allowedRoles={["ADMIN", "AGENT"]}>
      <div className="p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 rounded-full p-2.5">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Agent Leaderboard</h2>
            <p className="text-muted-foreground text-sm">Ranked by resolved tickets</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : leaderboard.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              No agent data yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry, i) => (
              <Card key={entry.agent.id} className={i === 0 ? "border-primary/40 shadow-md" : ""}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="w-10 text-center text-xl shrink-0">
                      {i < 3 ? MEDALS[i] : <span className="text-sm font-bold text-muted-foreground">#{i + 1}</span>}
                    </div>

                    {/* Agent info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{entry.agent.firstName} {entry.agent.lastName}</p>
                        <Badge variant="outline" className="text-xs">{entry.agent.role}</Badge>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 w-full rounded-full bg-indigo-50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.round((entry.resolved / max) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 shrink-0 text-right">
                      <div>
                        <div className="flex items-center gap-1 justify-end text-muted-foreground">
                          <Ticket className="h-3.5 w-3.5" />
                          <span className="text-xs">Resolved</span>
                        </div>
                        <p className="text-xl font-bold text-primary">{entry.resolved}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 justify-end text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="text-xs">Avg time</span>
                        </div>
                        <p className="text-sm font-semibold">
                          {entry.avgResolutionHours !== null
                            ? entry.avgResolutionHours < 1
                              ? `${Math.round(entry.avgResolutionHours * 60)}m`
                              : `${entry.avgResolutionHours}h`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">In review</p>
                        <p className="text-sm font-semibold">{entry.inReview}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
