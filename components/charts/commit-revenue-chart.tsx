"use client";

import { formatDate } from "@/lib/utils";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ChartPoint = {
  date: string;
  commits: number;
  revenueMinor: number;
};

export function CommitRevenueChart({ data, currency }: { data: ChartPoint[]; currency: string }) {
  const chartData = data.map((point) => ({
    ...point,
    revenue: point.revenueMinor / 100,
    label: formatDate(point.date),
  }));

  if (!chartData.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/60 text-sm text-slate-500">
        Sync GitHub and DodoPayments to draw your first revenue signal.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-4 text-sm font-medium text-slate-600">Daily commits</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="commits" fill="#0f172a" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-4 text-sm font-medium text-slate-600">Daily revenue ({currency})</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip formatter={(value) => [`${currency} ${Number(value).toFixed(0)}`, "Revenue"]} />
              <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
