import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../lib/api";
import { useAuth } from "../store/auth";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AdminStats {
  users: number;
  videos: number;
  transcripts: number;
  jobs_queued: number;
  jobs_processing: number;
  jobs_failed: number;
}
interface AdminUserRow {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  transcript_count: number;
}
interface AdminJob {
  id: string;
  status: string;
  stage: string;
  progress: number;
  error: string | null;
  provider: string | null;
  video_id: string | null;
  title: string | null;
  owner_id: string | null;
  created_at: string;
  language?: string | null;
  accuracy_mode?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
const STATUS_COLOR: Record<string, string> = {
  completed: "var(--good)",
  queued:    "var(--warn)",
  processing:"var(--accent)",
  failed:    "var(--admin-fail, #8a2a1e)",
};

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ status }: { status: string }) {
  return (
    <span style={{
      background: STATUS_COLOR[status] ?? "#555",
      color: "#fff",
      borderRadius: 6,
      padding: "2px 10px",
      fontSize: 12,
      fontWeight: 700,
      textTransform: "capitalize" as const,
      letterSpacing: 0.5,
    }}>
      {status}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, accent }: {
  label: string; value: number | string; icon: string; accent: string;
}) {
  return (
    <div className="admin-stat-card" style={{ borderTop: `3px solid ${accent}` }}>
      <div className="admin-stat-icon" style={{ background: `${accent}22` }}>{icon}</div>
      <div>
        <div className="admin-stat-value">{value}</div>
        <div className="admin-stat-label">{label}</div>
      </div>
    </div>
  );
}

// ─── Rich User Profile Drawer ─────────────────────────────────────────────────

interface UserActivity {
  email: string;
  full_name: string | null;
  joined_at: string;
  is_active: boolean;
  is_admin: boolean;
  total_transcripts: number;
  completed: number;
  failed: number;
  queued: number;
  total_words_transcribed: number;
  total_edits_made: number;
  languages_used: Record<string, number>;
  accuracy_modes_used: Record<string, number>;
  providers_used: Record<string, number>;
}

interface RichTranscript extends AdminJob {
  source_type: string | null;
  video_url: string | null;
  channel: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  original_filename: string | null;
  word_count: number;
  text_preview: string | null;
  edit_count: number;
  has_word_timestamps: boolean;
  has_speaker_labels: boolean;
  updated_at: string;
}

function humanDur(secs: number | null): string {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
function numFmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function ActivityPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      background: "var(--surface-sunken)",
      border: "1px solid var(--line)",
      borderRadius: 10,
      padding: "10px 14px",
      minWidth: 90,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-display)" }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
    </div>
  );
}

function TagList({ map, accent }: { map: Record<string, number>; accent?: boolean }) {
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {entries.map(([k, v]) => (
        <span key={k} style={{
          background: accent ? "var(--accent-soft)" : "var(--surface-sunken)",
          color: accent ? "var(--accent)" : "var(--ink-soft)",
          border: `1px solid ${accent ? "color-mix(in oklab, var(--accent) 25%, transparent)" : "var(--line)"}`,
          borderRadius: 20,
          padding: "2px 9px",
          fontSize: 12,
          fontWeight: 600,
        }}>
          {k} <span style={{ opacity: 0.6 }}>×{v}</span>
        </span>
      ))}
    </div>
  );
}

function TranscriptCard({ t }: { t: RichTranscript }) {
  const ytUrl = t.video_id ? `https://www.youtube.com/watch?v=${t.video_id}` : t.video_url ?? "#";

  return (
    <div className="admin-transcript-card">
      {/* Thumbnail */}
      {t.thumbnail_url ? (
        <a href={ytUrl} target="_blank" rel="noreferrer" className="admin-tc-thumb">
          <img src={t.thumbnail_url} alt={t.title ?? "thumbnail"} />
          {t.duration_seconds && (
            <span className="admin-tc-dur">{humanDur(t.duration_seconds)}</span>
          )}
        </a>
      ) : (
        <div className="admin-tc-thumb admin-tc-thumb--empty">
          <span style={{ fontSize: 24 }}>{t.source_type === "upload" ? "🎵" : "🎬"}</span>
          {t.duration_seconds && (
            <span className="admin-tc-dur">{humanDur(t.duration_seconds)}</span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="admin-tc-body">
        <div className="admin-tc-top">
          <div className="admin-tc-title">
            {t.title ?? t.original_filename ?? t.video_id ?? "Untitled"}
          </div>
          <Badge status={t.status} />
        </div>

        {t.channel && (
          <div className="admin-tc-channel">{t.channel}</div>
        )}

        {t.text_preview && (
          <div className="admin-tc-preview">"{t.text_preview}{(t.text_preview?.length ?? 0) >= 300 ? "…" : ""}"</div>
        )}

        <div className="admin-tc-meta">
          {t.language && <span>🌐 {t.language}</span>}
          {t.word_count > 0 && <span>📝 {numFmt(t.word_count)} words</span>}
          {t.edit_count > 0 && <span>✏️ {t.edit_count} edit{t.edit_count !== 1 ? "s" : ""}</span>}
          {t.has_speaker_labels && <span>🎤 Speakers</span>}
          <span title="Accuracy mode" style={{ textTransform: "capitalize" }}>⚙️ {t.accuracy_mode}</span>
          <span>🕒 {fmtDate(t.created_at)}</span>
        </div>

        <div className="admin-tc-actions">
          <a href={`/t/${t.id}`} target="_blank" rel="noreferrer" className="admin-tc-link">
            View transcript →
          </a>
          {t.video_id && (
            <a href={ytUrl} target="_blank" rel="noreferrer" className="admin-tc-yt">
              YouTube ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function UserProfileDrawer({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const [tab, setTab] = useState<"activity" | "transcripts">("activity");

  const { data: activity, isLoading: actLoading } = useQuery<UserActivity>({
    queryKey: ["admin-user-activity", user.id],
    queryFn: () => adminApi.userActivity(user.id),
  });
  const { data: transcripts, isLoading: trLoading } = useQuery<RichTranscript[]>({
    queryKey: ["admin-user-transcripts", user.id],
    queryFn: () => adminApi.userTranscripts(user.id),
    enabled: tab === "transcripts",
  });

  const completionRate = activity
    ? activity.total_transcripts > 0
      ? Math.round((activity.completed / activity.total_transcripts) * 100)
      : 0
    : null;

  return (
    <div className="admin-drawer-overlay" onClick={onClose}>
      <div className="admin-drawer admin-drawer--wide" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-drawer-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="admin-avatar" style={{ width: 42, height: 42, fontSize: 17 }}>
              {(user.full_name ?? user.email)[0].toUpperCase()}
            </div>
            <div>
              <div className="admin-drawer-title">{user.full_name ?? user.email}</div>
              <div className="admin-drawer-sub">
                {user.email}
                {" · "}
                <span className={`admin-status-dot ${user.is_active ? "active" : "inactive"}`}>
                  {user.is_active ? "Active" : "Suspended"}
                </span>
                {" · "}
                Joined {fmtDate(user.created_at)}
                {user.is_admin && <span style={{ color: "var(--accent)", fontWeight: 700, marginLeft: 6 }}>Admin</span>}
              </div>
            </div>
          </div>
          <button className="admin-drawer-close" onClick={onClose}>✕</button>
        </div>

        {/* Tab switcher */}
        <div className="admin-drawer-tabs">
          <button
            className={`admin-drawer-tab${tab === "activity" ? " active" : ""}`}
            onClick={() => setTab("activity")}
          >
            📊 Activity Overview
          </button>
          <button
            className={`admin-drawer-tab${tab === "transcripts" ? " active" : ""}`}
            onClick={() => setTab("transcripts")}
          >
            📝 Transcripts ({user.transcript_count})
          </button>
        </div>

        {/* Body */}
        <div className="admin-drawer-body">
          {/* ── Activity tab ── */}
          {tab === "activity" && (
            <div className="admin-drawer-section">
              {actLoading ? (
                <div className="admin-loading">Loading activity…</div>
              ) : activity ? (
                <>
                  {/* Stat pills */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
                    <ActivityPill label="Total" value={activity.total_transcripts} />
                    <ActivityPill label="Completed" value={activity.completed} />
                    <ActivityPill label="Failed" value={activity.failed} />
                    <ActivityPill label="Queued" value={activity.queued} />
                    <ActivityPill label="Words" value={numFmt(activity.total_words_transcribed)} />
                    <ActivityPill label="Edits made" value={activity.total_edits_made} />
                    <ActivityPill label="Success rate" value={`${completionRate}%`} />
                  </div>

                  {/* Progress bar */}
                  {activity.total_transcripts > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, color: "var(--ink-faint)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Completion Rate
                      </div>
                      <div className="admin-progress-bar" style={{ height: 8 }}>
                        <div
                          className="admin-progress-fill"
                          style={{
                            width: `${completionRate}%`,
                            background: (completionRate ?? 0) >= 80 ? "var(--good)" : (completionRate ?? 0) >= 40 ? "var(--warn)" : "var(--admin-fail, #8a2a1e)",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="admin-activity-grid">
                    <div className="admin-activity-block">
                      <div className="admin-activity-label">Languages used</div>
                      <TagList map={activity.languages_used} accent />
                    </div>
                    <div className="admin-activity-block">
                      <div className="admin-activity-label">Accuracy modes</div>
                      <TagList map={activity.accuracy_modes_used} />
                    </div>
                    <div className="admin-activity-block">
                      <div className="admin-activity-label">Providers</div>
                      <TagList map={activity.providers_used} />
                    </div>
                  </div>

                  {activity.total_transcripts === 0 && (
                    <div className="admin-empty" style={{ marginTop: 20 }}>
                      This user hasn't created any transcripts yet.
                    </div>
                  )}
                </>
              ) : (
                <div className="admin-empty">Could not load activity.</div>
              )}
            </div>
          )}

          {/* ── Transcripts tab ── */}
          {tab === "transcripts" && (
            <div>
              {trLoading ? (
                <div className="admin-loading">Loading transcripts…</div>
              ) : !transcripts?.length ? (
                <div className="admin-empty">No transcripts yet.</div>
              ) : (
                <div className="admin-transcript-list">
                  {transcripts.map((t) => (
                    <TranscriptCard key={t.id} t={t} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── Main Admin Page ──────────────────────────────────────────────────────────
export function AdminPage() {
  const navigate = useNavigate();
  const authUser = useAuth((s) => s.user);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"users" | "jobs">("users");
  const [jobFilter, setJobFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);

  // Guard — non-admin redirect handled after hooks
  const isAdmin = authUser?.is_admin ?? false;

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: adminApi.stats,
    refetchInterval: 15_000,
    enabled: isAdmin,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery<{
    total: number; items: AdminUserRow[];
  }>({
    queryKey: ["admin-users"],
    queryFn: () => adminApi.users(100),
    enabled: isAdmin && activeTab === "users",
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery<AdminJob[]>({
    queryKey: ["admin-jobs", jobFilter],
    queryFn: () => adminApi.jobs(jobFilter),
    refetchInterval: 8_000,
    enabled: isAdmin && activeTab === "jobs",
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (userId: string) => adminApi.toggleActive(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const retryMutation = useMutation({
    mutationFn: (id: string) => adminApi.retry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-jobs"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  // Redirect non-admins
  if (authUser && !authUser.is_admin) {
    navigate("/dashboard");
    return null;
  }

  return (
    <div className="admin-root">
      {/* ── Sidebar ───────────────────────────────────── */}
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <span className="admin-logo-icon">⚡</span>
          <span>Admin Panel</span>
        </div>

        <nav className="admin-nav">
          <button
            id="admin-nav-users"
            className={`admin-nav-item${activeTab === "users" ? " active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            <span>👥</span> Users
          </button>
          <button
            id="admin-nav-jobs"
            className={`admin-nav-item${activeTab === "jobs" ? " active" : ""}`}
            onClick={() => setActiveTab("jobs")}
          >
            <span>📋</span> Jobs
          </button>
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">
            <div className="admin-avatar">
              {authUser?.full_name?.[0]?.toUpperCase() ?? authUser?.email?.[0]?.toUpperCase() ?? "A"}
            </div>
            <div>
              <div className="admin-sidebar-name">{authUser?.full_name ?? "Admin"}</div>
              <div className="admin-sidebar-email">{authUser?.email}</div>
            </div>
          </div>
          <button className="admin-back-btn" onClick={() => navigate("/dashboard")}>
            ← Back to App
          </button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────── */}
      <main className="admin-main">
        {/* Header */}
        <div className="admin-header">
          <h1 className="admin-page-title">
            {activeTab === "users" ? "User Management" : "Transcript Jobs"}
          </h1>
          <div className="admin-header-badge">● Live</div>
        </div>

        {/* Stats */}
        <div className="admin-stats-grid">
          <StatCard label="Total Users"     value={stats?.users ?? "—"}           icon="👥" accent="#6c63ff" />
          <StatCard label="Transcripts"     value={stats?.transcripts ?? "—"}     icon="📝" accent="#00c896" />
          <StatCard label="Videos"          value={stats?.videos ?? "—"}          icon="🎬" accent="#ff6584" />
          <StatCard label="Jobs Queued"     value={stats?.jobs_queued ?? "—"}     icon="⏳" accent="#f5a623" />
          <StatCard label="Processing"      value={stats?.jobs_processing ?? "—"} icon="⚙️" accent="#4fc3f7" />
          <StatCard label="Failed"          value={stats?.jobs_failed ?? "—"}     icon="❌" accent="#ef5350" />
        </div>

        {/* ── Users Tab ──────────────────────────────── */}
        {activeTab === "users" && (
          <div className="admin-panel">
            <div className="admin-panel-header">
              <span>Registered Users</span>
              <span className="admin-count-badge">{usersData?.total ?? 0} total</span>
            </div>

            {usersLoading ? (
              <div className="admin-loading">Loading users…</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name / Email</th>
                      <th>Role</th>
                      <th>Transcripts</th>
                      <th>Joined</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersData?.items.map((u) => (
                      <tr key={u.id} className={!u.is_active ? "admin-row-inactive" : ""}>
                        <td>
                          <div className="admin-user-cell">
                            <div className="admin-avatar admin-avatar-sm">
                              {(u.full_name ?? u.email)[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="admin-user-name">{u.full_name ?? "—"}</div>
                              <div className="admin-user-email">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          {u.is_admin
                            ? <span className="admin-role-badge admin-role-admin">Admin</span>
                            : <span className="admin-role-badge admin-role-user">User</span>
                          }
                        </td>
                        <td>
                          <button
                            className="admin-transcript-count"
                            onClick={() => setSelectedUser(u)}
                            id={`view-transcripts-${u.id}`}
                          >
                            {u.transcript_count} →
                          </button>
                        </td>
                        <td>{fmtDate(u.created_at)}</td>
                        <td>
                          <span className={`admin-status-dot${u.is_active ? " active" : " inactive"}`}>
                            {u.is_active ? "Active" : "Suspended"}
                          </span>
                        </td>
                        <td>
                          <button
                            className={`admin-action-btn${u.is_active ? " admin-btn-suspend" : " admin-btn-activate"}`}
                            disabled={toggleActiveMutation.isPending}
                            onClick={() => toggleActiveMutation.mutate(u.id)}
                            id={`toggle-user-${u.id}`}
                          >
                            {u.is_active ? "Suspend" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Jobs Tab ───────────────────────────────── */}
        {activeTab === "jobs" && (
          <div className="admin-panel">
            <div className="admin-panel-header">
              <span>Transcript Jobs</span>
              <div className="admin-job-filters">
                {["all", "queued", "processing", "completed", "failed"].map((f) => (
                  <button
                    key={f}
                    id={`job-filter-${f}`}
                    className={`admin-filter-btn${jobFilter === f ? " active" : ""}`}
                    onClick={() => setJobFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {jobsLoading ? (
              <div className="admin-loading">Loading jobs…</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Title / Video</th>
                      <th>Status</th>
                      <th>Stage</th>
                      <th>Progress</th>
                      <th>Provider</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs?.map((j) => (
                      <tr key={j.id}>
                        <td className="admin-td-title">{j.title ?? j.video_id ?? "—"}</td>
                        <td><Badge status={j.status} /></td>
                        <td><span className="admin-stage">{j.stage}</span></td>
                        <td>
                          <div className="admin-progress-wrap">
                            <div className="admin-progress-bar">
                              <div
                                className="admin-progress-fill"
                                style={{
                                  width: `${j.progress}%`,
                                  background: STATUS_COLOR[j.status] ?? "#6c63ff",
                                }}
                              />
                            </div>
                            <span>{j.progress}%</span>
                          </div>
                        </td>
                        <td>{j.provider ?? "—"}</td>
                        <td>{fmtDateTime(j.created_at)}</td>
                        <td>
                          <div className="admin-action-group">
                            {j.status === "failed" && (
                              <button
                                className="admin-action-btn admin-btn-retry"
                                onClick={() => retryMutation.mutate(j.id)}
                                disabled={retryMutation.isPending}
                                id={`retry-job-${j.id}`}
                              >
                                Retry
                              </button>
                            )}
                            <button
                              className="admin-action-btn admin-btn-delete"
                              onClick={() => {
                                if (window.confirm("Delete this job permanently?")) {
                                  deleteMutation.mutate(j.id);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                              id={`delete-job-${j.id}`}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!jobs?.length && (
                  <div className="admin-empty">
                    No jobs found for filter: <strong>{jobFilter}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Transcript drawer */}
      {selectedUser && (
        <UserProfileDrawer
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}
