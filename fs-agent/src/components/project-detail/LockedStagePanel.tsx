"use client";

import type { StageGateInfo } from "@/lib/stage-gates";

type Props = {
  stageTitle: string;
  gateInfo: StageGateInfo;
};

export default function LockedStagePanel({ stageTitle, gateInfo }: Props) {
  const blockingCriteria = gateInfo.entryCriteria.filter((c) => !c.passed);

  return (
    <div className="rounded-3xl border-2 border-slate-200 bg-slate-50 p-8 text-center">
      <div className="mx-auto max-w-md">
        <div className="mb-4 text-6xl">🔒</div>
        <h3 className="mb-2 text-xl font-semibold text-slate-900">
          {stageTitle} is Locked
        </h3>
        <p className="mb-6 text-sm text-slate-600">
          Complete the prerequisites to unlock this stage.
        </p>

        {blockingCriteria.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
            <p className="mb-2 text-sm font-semibold text-amber-900">
              Prerequisites:
            </p>
            <ul className="space-y-1">
              {blockingCriteria.map((criteria, idx) => (
                <li key={idx} className="text-sm text-amber-800">
                  • {criteria.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

