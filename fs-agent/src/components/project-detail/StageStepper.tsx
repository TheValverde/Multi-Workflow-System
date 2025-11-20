"use client";

import { STAGES, getStageIndex } from "@/lib/stages";
import type { StageGates } from "@/lib/stage-gates";
import type { EstimateDetail } from "@/lib/estimates";

type Props = {
  currentStage: string;
  gates: StageGates;
  detail: EstimateDetail | null;
  onStageClick?: (stage: string) => void;
};

export default function StageStepper({ currentStage, gates, detail, onStageClick }: Props) {
  const currentIndex = getStageIndex(currentStage);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Stages</h2>
      <div className="space-y-2">
        {STAGES.map((stage, index) => {
          const stageGates = gates[stage.key];
          const isCurrent = stage.key === currentStage;
          const isCompleted = index < currentIndex;
          const isLocked = index > currentIndex;
          const canAccess = stageGates?.canAccess ?? false;

          const isClickable = isCompleted && onStageClick && canAccess;
          
          return (
            <div
              key={stage.key}
              onClick={isClickable ? () => onStageClick(stage.key) : undefined}
              className={`rounded-xl border-2 p-4 transition ${
                isCurrent
                  ? "border-blue-500 bg-blue-50"
                  : isCompleted
                    ? isClickable
                      ? "border-green-200 bg-green-50 cursor-pointer hover:border-green-300 hover:bg-green-100"
                      : "border-green-200 bg-green-50"
                    : isLocked
                      ? "border-slate-200 bg-slate-50 opacity-60"
                      : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                        isCurrent
                          ? "bg-blue-600 text-white"
                          : isCompleted
                            ? "bg-green-600 text-white"
                            : "bg-slate-300 text-slate-600"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <h3 className="font-semibold text-slate-900">
                      {stage.title}
                    </h3>
                    {isCurrent && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                        Current
                      </span>
                    )}
                    {isCompleted && isClickable && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Click to edit
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {stage.description}
                  </p>
                </div>
              </div>

              {stageGates && (
                <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                  {!canAccess && stageGates.entryCriteria.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
                        Entry Criteria:
                      </p>
                      <ul className="space-y-1">
                        {stageGates.entryCriteria.map((criteria, idx) => (
                          <li
                            key={idx}
                            className={`text-xs ${
                              criteria.passed ? "text-green-700" : "text-rose-700"
                            }`}
                          >
                            {criteria.passed ? "✓" : "✗"} {criteria.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {canAccess && stageGates.readyToAdvance.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
                        Ready to Advance:
                      </p>
                      <ul className="space-y-1">
                        {stageGates.readyToAdvance.map((gate, idx) => (
                          <li
                            key={idx}
                            className={`text-xs ${
                              gate.passed ? "text-green-700" : "text-amber-700"
                            }`}
                          >
                            {gate.passed ? "✓" : "⏳"} {gate.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

