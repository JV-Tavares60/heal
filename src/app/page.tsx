"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";

interface Metrics {
  kpis: {
    totalUsers: number;
    activeUsers7d: number;
    activeUsers30d: number;
    usersNoReturn: number;
  };
  behavior: {
    newUsersChart: { date: string; count: number }[];
    messagesChart: { date: string; count: number }[];
    avgMessagesPerConversation: number;
    top10Conversations: {
      session_id: string;
      message_count: number;
      user_name: string;
      phone: string;
    }[];
    messageDistribution: { name: string; value: number }[];
  };
  followUp: {
    fupDonut: { name: string; value: number }[];
    fupBarChart: { label: string; count: number }[];
    fupResponseRate: number;
    fupNoResponse: {
      name: string;
      phone: string;
      fup_number: number;
      fup_sent: string;
    }[];
    totalWithFup: number;
    respondedCount: number;
  };
  updatedAt: string;
}

const COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#ef4444", "#10b981"];
const PIE_COLORS = ["#6366f1", "#22d3ee"];
const FUP_DONUT_COLORS = ["#10b981", "#ef4444"];

function KPICard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortDate(d: string) {
  const parts = d.split("-");
  return `${parts[2]}/${parts[1]}`;
}

export default function Dashboard() {
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/metrics");
      if (!res.ok) throw new Error("Erro ao buscar métricas");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-lg animate-pulse">Carregando dashboard...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-red-400">
        <div>
          <p className="text-lg">Erro: {error}</p>
          <button
            onClick={fetchData}
            className="mt-4 rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const { kpis, behavior, followUp } = data;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard do Agente</h1>
            <p className="text-sm text-zinc-400">
              Atualizado em {formatDate(data.updatedAt)}
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            Atualizar dados
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 p-6">
        {/* KPI Cards */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-300">
            Visão Geral
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard title="Total de Usuários" value={kpis.totalUsers} />
            <KPICard
              title="Ativos (7 dias)"
              value={kpis.activeUsers7d}
              subtitle="Última mensagem nos últimos 7 dias"
            />
            <KPICard
              title="Ativos (30 dias)"
              value={kpis.activeUsers30d}
              subtitle="Última mensagem nos últimos 30 dias"
            />
            <KPICard
              title="Sem Retorno"
              value={kpis.usersNoReturn}
              subtitle="Apenas 1 mensagem ou nenhuma"
            />
          </div>
        </section>

        {/* Line Charts Side by Side */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-300">
            Comportamento de Conversas
          </h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* New Users per Day */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="mb-4 text-sm font-medium text-zinc-400">
                Novos Usuários por Dia (30d)
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={behavior.newUsersChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    stroke="#71717a"
                    fontSize={12}
                  />
                  <YAxis stroke="#71717a" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: "8px",
                    }}
                    labelFormatter={(v) => shortDate(v as string)}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                    name="Novos Usuários"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Messages per Day */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="mb-4 text-sm font-medium text-zinc-400">
                Volume de Mensagens por Dia (30d)
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={behavior.messagesChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    stroke="#71717a"
                    fontSize={12}
                  />
                  <YAxis stroke="#71717a" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: "8px",
                    }}
                    labelFormatter={(v) => shortDate(v as string)}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    dot={false}
                    name="Mensagens"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Avg messages + Donut */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <KPICard
            title="Média de Mensagens por Conversa"
            value={behavior.avgMessagesPerConversation}
            subtitle="Incluindo mensagens do usuário e agente"
          />

          {/* Message Distribution Donut */}
          <div className="col-span-1 rounded-xl border border-zinc-800 bg-zinc-900 p-6 lg:col-span-2">
            <h3 className="mb-4 text-sm font-medium text-zinc-400">
              Distribuição: Usuário vs Agente
            </h3>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={behavior.messageDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {behavior.messageDistribution.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Top 10 Conversations Table */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h3 className="mb-4 text-sm font-medium text-zinc-400">
            Top 10 Conversas Mais Longas
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="pb-3 pr-4">#</th>
                  <th className="pb-3 pr-4">Usuário</th>
                  <th className="pb-3 pr-4">Telefone</th>
                  <th className="pb-3 pr-4">Session ID</th>
                  <th className="pb-3 text-right">Mensagens</th>
                </tr>
              </thead>
              <tbody>
                {behavior.top10Conversations.map((conv, idx) => (
                  <tr
                    key={conv.session_id}
                    className="border-b border-zinc-800/50"
                  >
                    <td className="py-3 pr-4 text-zinc-500">{idx + 1}</td>
                    <td className="py-3 pr-4">{conv.user_name}</td>
                    <td className="py-3 pr-4 text-zinc-400">{conv.phone}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-zinc-500">
                      {conv.session_id.length > 25
                        ? conv.session_id.slice(0, 25) + "..."
                        : conv.session_id}
                    </td>
                    <td className="py-3 text-right font-bold text-indigo-400">
                      {conv.message_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Follow-up Section */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-300">
            Follow-up
          </h2>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* FUP Donut */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="mb-4 text-sm font-medium text-zinc-400">
                Follow-up Ativo vs Inativo
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={followUp.fupDonut}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {followUp.fupDonut.map((_, i) => (
                      <Cell
                        key={i}
                        fill={FUP_DONUT_COLORS[i % FUP_DONUT_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* FUP Bar Chart */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="mb-4 text-sm font-medium text-zinc-400">
                Distribuição por fup_number
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={followUp.fupBarChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="label" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                    name="Usuários"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* FUP Response Rate KPI */}
            <div className="flex flex-col justify-center rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-sm text-zinc-400">
                Taxa de Resposta Pós Follow-up
              </p>
              <p className="mt-3 text-5xl font-bold text-emerald-400">
                {followUp.fupResponseRate}%
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                {followUp.respondedCount} de {followUp.totalWithFup} usuários
                responderam após receber follow-up
              </p>
            </div>
          </div>
        </section>

        {/* FUP No Response Table */}
        {followUp.fupNoResponse.length > 0 && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="mb-4 text-sm font-medium text-zinc-400">
              Usuários que Receberam Follow-up mas Não Responderam
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="pb-3 pr-4">Nome</th>
                    <th className="pb-3 pr-4">Telefone</th>
                    <th className="pb-3 pr-4">Follow-ups</th>
                    <th className="pb-3">Último Envio</th>
                  </tr>
                </thead>
                <tbody>
                  {followUp.fupNoResponse.map((u, idx) => (
                    <tr key={idx} className="border-b border-zinc-800/50">
                      <td className="py-3 pr-4">{u.name}</td>
                      <td className="py-3 pr-4 text-zinc-400">{u.phone}</td>
                      <td className="py-3 pr-4 text-center">{u.fup_number}</td>
                      <td className="py-3 text-zinc-400">
                        {u.fup_sent
                          ? new Date(u.fup_sent).toLocaleDateString("pt-BR")
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
