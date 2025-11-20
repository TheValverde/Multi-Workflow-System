"use client";

import { formatDistanceToNow } from "date-fns";
import type { TimelineRecord } from "@/lib/estimates";

type Props = {
  timeline: TimelineRecord[];
};

export default function TimelinePanel({ timeline }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Timeline</h2>
      <div className="space-y-3">
        {timeline.length === 0 ? (
          <p className="text-sm text-slate-500">No timeline entries yet.</p>
        ) : (
          timeline.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-slate-200 bg-white p-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    {entry.action}
                  </p>
                  {entry.notes && (
                    <p className="mt-1 text-xs text-slate-600">{entry.notes}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    {entry.stage} · {entry.actor}
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  {formatDistanceToNow(new Date(entry.created_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

