import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createServiceClient();
    const now = new Date();
    const sevenDaysAgo = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    const thirtyDaysAgo = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Fetch all users (service role bypasses RLS)
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("*");

    if (usersError) throw usersError;

    // Fetch chat histories with created_at for time-based metrics
    const { data: chatHistories, error: chatError } = await supabase
      .from("n8n_chat_histories")
      .select("id, session_id, message, created_at");

    if (chatError) throw chatError;

    // === Build session activity map from chat_histories ===
    // For each session, find the latest message timestamp
    const sessionLastActivity: Record<string, string> = {};
    chatHistories?.forEach((ch) => {
      if (ch.created_at && ch.message?.type === "human") {
        const current = sessionLastActivity[ch.session_id];
        if (!current || ch.created_at > current) {
          sessionLastActivity[ch.session_id] = ch.created_at;
        }
      }
    });

    // Merge: use chat_histories created_at OR users.last_message (whichever is more recent)
    const getUserLastActivity = (user: {
      session_id?: string;
      last_message?: string;
    }): string | null => {
      const fromChat = user.session_id
        ? sessionLastActivity[user.session_id]
        : null;
      const fromUser = user.last_message;
      if (fromChat && fromUser) return fromChat > fromUser ? fromChat : fromUser;
      return fromChat || fromUser || null;
    };

    // === BLOCO 1: KPIs ===
    const totalUsers = users?.length ?? 0;

    const activeUsers7d =
      users?.filter((u) => {
        const lastActivity = getUserLastActivity(u);
        return lastActivity && lastActivity >= sevenDaysAgo;
      }).length ?? 0;

    const activeUsers30d =
      users?.filter((u) => {
        const lastActivity = getUserLastActivity(u);
        return lastActivity && lastActivity >= thirtyDaysAgo;
      }).length ?? 0;

    // Users with no return: 0 or 1 human messages
    const sessionHumanCounts: Record<string, number> = {};
    chatHistories?.forEach((ch) => {
      if (ch.message?.type === "human") {
        sessionHumanCounts[ch.session_id] =
          (sessionHumanCounts[ch.session_id] || 0) + 1;
      }
    });

    const usersNoReturn =
      users?.filter((u) => {
        if (!u.session_id) return true;
        const humanCount = sessionHumanCounts[u.session_id] ?? 0;
        return humanCount <= 1;
      }).length ?? 0;

    // === BLOCO 2: Behavior ===

    // New users per day (last 30 days)
    const newUsersPerDay: Record<string, number> = {};
    users?.forEach((u) => {
      if (u.created_at && u.created_at >= thirtyDaysAgo) {
        const day = u.created_at.slice(0, 10);
        newUsersPerDay[day] = (newUsersPerDay[day] || 0) + 1;
      }
    });

    const newUsersChart = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      newUsersChart.push({ date: key, count: newUsersPerDay[key] || 0 });
    }

    // Messages per day (last 30 days) — from chat_histories.created_at
    const msgsPerDay: Record<string, number> = {};
    chatHistories?.forEach((ch) => {
      if (ch.created_at && ch.created_at >= thirtyDaysAgo) {
        const day = ch.created_at.slice(0, 10);
        msgsPerDay[day] = (msgsPerDay[day] || 0) + 1;
      }
    });

    const messagesChart = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      messagesChart.push({ date: key, count: msgsPerDay[key] || 0 });
    }

    // Average messages per conversation
    const sessionCounts: Record<string, number> = {};
    chatHistories?.forEach((ch) => {
      if (ch.message?.type === "human" || ch.message?.type === "ai") {
        sessionCounts[ch.session_id] =
          (sessionCounts[ch.session_id] || 0) + 1;
      }
    });
    const sessionKeys = Object.keys(sessionCounts);
    const avgMessagesPerConversation =
      sessionKeys.length > 0
        ? Math.round(
            (sessionKeys.reduce((sum, k) => sum + sessionCounts[k], 0) /
              sessionKeys.length) *
              10
          ) / 10
        : 0;

    // Top 10 longest conversations
    const top10Conversations = Object.entries(sessionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([sessionId, messageCount]) => {
        const user = users?.find((u) => u.session_id === sessionId);
        return {
          session_id: sessionId,
          message_count: messageCount,
          user_name: user?.name || "Desconhecido",
          phone: user?.phone || "-",
        };
      });

    // Message distribution: human vs ai
    let humanMessages = 0;
    let aiMessages = 0;
    chatHistories?.forEach((ch) => {
      if (ch.message?.type === "human") humanMessages++;
      else if (ch.message?.type === "ai") aiMessages++;
    });

    const messageDistribution = [
      { name: "Usuário", value: humanMessages },
      { name: "Agente", value: aiMessages },
    ];

    // === BLOCO 3: Follow-up ===
    const fupActive = users?.filter((u) => u.fup === true).length ?? 0;
    const fupInactive = users?.filter((u) => u.fup === false).length ?? 0;

    const fupDistribution: Record<string, number> = {};
    users?.forEach((u) => {
      const num = u.fup_number ?? 0;
      const key = num >= 3 ? "3+" : String(num);
      fupDistribution[key] = (fupDistribution[key] || 0) + 1;
    });

    const fupBarChart = Object.entries(fupDistribution)
      .sort((a, b) => {
        const order = ["0", "1", "2", "3+"];
        return order.indexOf(a[0]) - order.indexOf(b[0]);
      })
      .map(([label, count]) => ({ label, count }));

    // Response rate after follow-up
    const usersWithFupSent = users?.filter((u) => u.fup_sent) ?? [];
    const respondedAfterFup = usersWithFupSent.filter((u) => {
      const lastActivity = getUserLastActivity(u);
      return lastActivity && lastActivity > u.fup_sent;
    });
    const fupResponseRate =
      usersWithFupSent.length > 0
        ? Math.round(
            (respondedAfterFup.length / usersWithFupSent.length) * 1000
          ) / 10
        : 0;

    // Users who received follow-up but didn't respond
    const fupNoResponse = usersWithFupSent
      .filter((u) => {
        const lastActivity = getUserLastActivity(u);
        return !lastActivity || lastActivity <= u.fup_sent;
      })
      .map((u) => ({
        name: u.name || "Desconhecido",
        phone: u.phone || "-",
        fup_number: u.fup_number ?? 0,
        fup_sent: u.fup_sent,
      }));

    return NextResponse.json({
      kpis: {
        totalUsers,
        activeUsers7d,
        activeUsers30d,
        usersNoReturn,
      },
      behavior: {
        newUsersChart,
        messagesChart,
        avgMessagesPerConversation,
        top10Conversations,
        messageDistribution,
      },
      followUp: {
        fupDonut: [
          { name: "Ativo", value: fupActive },
          { name: "Inativo", value: fupInactive },
        ],
        fupBarChart,
        fupResponseRate,
        fupNoResponse,
        totalWithFup: usersWithFupSent.length,
        respondedCount: respondedAfterFup.length,
      },
      updatedAt: now.toISOString(),
    });
  } catch (error: unknown) {
    console.error("API /metrics error:", error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : JSON.stringify(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
