'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCoAgent } from "@copilotkit/react-core";

type Stage =
  | "Artifacts"
  | "Business Case"
  | "Requirements"
  | "Solution/Architecture"
  | "Effort Estimate"
  | "Quote";

type StageFilter = Stage | "All";

type Estimate = {
  id: string;
  name: string;
  owner: string;
  stage: string;
  lastUpdated: string | null;
};

type AgentState = {
  proverbs?: string[];
  selectedProjectId?: string | null;
  selectedProjectName?: string | null;
  selectedProjectStage?: string | null;
};

const STAGE_OPTIONS: Stage[] = [
  "Artifacts",
  "Business Case",
  "Requirements",
  "Solution/Architecture",
  "Effort Estimate",
  "Quote",
];

const stageStyles: Record<string, string> = {
  Artifacts: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Business Case": "bg-sky-50 text-sky-700 ring-sky-200",
  Requirements: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "Solution/Architecture": "bg-amber-50 text-amber-700 ring-amber-200",
  "Effort Estimate": "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
  Quote: "bg-slate-100 text-slate-700 ring-slate-200",
};

const isStage = (value: string | null): value is Stage => {
  return value !== null && STAGE_OPTIONS.includes(value as Stage);
};

export default function EstimatesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { state: coAgentState, setState } = useCoAgent<AgentState>({
    name: "sample_agent",
  });

  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<StageFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch("/api/estimates", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Failed to load estimates");
        }
        return res.json();
      })
      .then((payload) => {
        setEstimates(payload?.data ?? []);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error(err);
        setError(err.message ?? "Unable to load estimates");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const stageParam = searchParams.get("stage");
    const searchParam = searchParams.get("q");
    if (isStage(stageParam)) {
      setStageFilter(stageParam);
    } else {
      setStageFilter("All");
    }
    setSearchQuery(searchParam ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  const updateQueryParams = (nextStage: StageFilter, nextSearch: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextStage === "All") {
      params.delete("stage");
    } else {
      params.set("stage", nextStage);
    }
    if (nextSearch.trim().length > 0) {
      params.set("q", nextSearch.trim());
    } else {
      params.delete("q");
    }
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  };

  const filteredEstimates = useMemo(() => {
    return estimates.filter((estimate) => {
      const matchesStage =
        stageFilter === "All" ||
        estimate.stage.toLowerCase() === stageFilter.toLowerCase();
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const matchesSearch =
        normalizedQuery.length === 0 ||
        estimate.name.toLowerCase().includes(normalizedQuery) ||
        estimate.owner.toLowerCase().includes(normalizedQuery);
      return matchesStage && matchesSearch;
    });
  }, [estimates, searchQuery, stageFilter]);

  const handleStageChange = (value: string) => {
    const nextStage = value === "All" ? "All" : (value as Stage);
    setStageFilter(nextStage);
    updateQueryParams(nextStage, searchQuery);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    updateQueryParams(stageFilter, value);
  };

  const handleRowClick = (estimate: Estimate) => {
    setState({
      ...(coAgentState ?? {}),
      selectedProjectId: estimate.id,
      selectedProjectName: estimate.name,
      selectedProjectStage: estimate.stage,
    });
    router.push(`/estimates/${estimate.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Estimates
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">
                Project Pipeline
              </h1>
              <p className="text-slate-500">
                Review every estimate, filter by stage, and jump into the detail
                view.
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 flex-col gap-1">
                <label
                  htmlFor="stage-filter"
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Stage
                </label>
                <select
                  id="stage-filter"
                  value={stageFilter}
                  onChange={(event) => handleStageChange(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="All">All stages</option>
                  {STAGE_OPTIONS.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-1 flex-col gap-1">
                <label
                  htmlFor="search"
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Search
                </label>
                <input
                  id="search"
                  type="search"
                  placeholder="Owner or project name"
                  value={searchQuery}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
            </div>
            <span className="text-sm text-slate-500">
              Showing{" "}
              <strong className="font-semibold text-slate-900">
                {filteredEstimates.length}
              </strong>{" "}
              of {estimates.length} projects
            </span>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Stage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-10 text-center text-sm text-slate-500"
                    >
                      Loading projects…
                    </td>
                  </tr>
                )}

                {!loading && error && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-10 text-center text-sm text-rose-500"
                    >
                      {error}
                    </td>
                  </tr>
                )}

                {!loading && !error && filteredEstimates.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-10 text-center text-sm text-slate-500"
                    >
                      No projects match those filters yet.
                    </td>
                  </tr>
                )}

                {!loading &&
                  !error &&
                  filteredEstimates.map((estimate) => (
                    <tr
                      key={estimate.id}
                      className="cursor-pointer transition hover:bg-slate-50"
                      onClick={() => handleRowClick(estimate)}
                    >
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {estimate.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {estimate.owner}
                      </td>
                      <td className="px-6 py-4">
                        <StagePill stage={estimate.stage} />
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {estimate.lastUpdated
                          ? formatRelativeTime(estimate.lastUpdated)
                          : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

const StagePill = ({ stage }: { stage: string }) => {
  const styles =
    stageStyles[stage] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${styles}`}
    >
      {stage}
    </span>
  );
};

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}


