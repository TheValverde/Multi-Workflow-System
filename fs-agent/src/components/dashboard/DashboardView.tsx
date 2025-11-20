"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

type DashboardMetrics = {
  estimates: {
    count: number;
    lastUpdated: string | null;
  };
  contracts: {
    count: number;
    lastUpdated: string | null;
  };
};

export default function DashboardView() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/dashboard/metrics");
      if (!res.ok) {
        throw new Error("Failed to load dashboard metrics");
      }
      const data = await res.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-lg text-gray-600">
            Overview of estimates and contracts
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Estimates Card */}
          <DashboardCard
            title="Estimates"
            count={metrics.estimates.count}
            lastUpdated={metrics.estimates.lastUpdated}
            href="/estimates"
            color="blue"
          />

          {/* Contracts Card */}
          <DashboardCard
            title="Contracts"
            count={metrics.contracts.count}
            lastUpdated={metrics.contracts.lastUpdated}
            href="/contracts"
            color="green"
          />
        </div>
      </div>
    </div>
  );
}

type DashboardCardProps = {
  title: string;
  count: number;
  lastUpdated: string | null;
  href: string;
  color: "blue" | "green";
};

function DashboardCard({
  title,
  count,
  lastUpdated,
  href,
  color,
}: DashboardCardProps) {
  const colorClasses = {
    blue: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-900",
      link: "text-blue-600 hover:text-blue-800",
      count: "text-blue-600",
    },
    green: {
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-900",
      link: "text-green-600 hover:text-green-800",
      count: "text-green-600",
    },
  };

  const colors = colorClasses[color];

  const formattedTime = lastUpdated
    ? formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })
    : "Never";

  return (
    <Link
      href={href}
      className={`block rounded-xl border-2 ${colors.bg} ${colors.border} p-6 transition-all hover:shadow-lg hover:scale-105`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-semibold ${colors.text}`}>{title}</h2>
          <p className={`mt-2 text-4xl font-bold ${colors.count}`}>{count}</p>
          <p className="mt-2 text-sm text-gray-600">
            Last updated: {formattedTime}
          </p>
        </div>
        <div className={`text-sm font-medium ${colors.link}`}>
          View All →
        </div>
      </div>
    </Link>
  );
}

