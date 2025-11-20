"use client";

import { useCoAgent } from "@copilotkit/react-core";
import { useEffect, useMemo } from "react";

type GlobalCopilotState = {
  workflow?: string | null;
  entity_id?: string | null;
  entity_type?: string | null;
  entity_data?: Record<string, any> | null;
  selected_project_id?: string | null;
  selected_project_name?: string | null;
  selected_project_stage?: string | null;
  timeline_version?: string | null;
};

/**
 * Hook to synchronize copilot context when navigating between workflows.
 * Call this in page components to update the agent's awareness of current workflow/entity.
 */
export function useCopilotContext(
  workflow: "estimates" | "contracts" | null,
  entityId: string | null,
  entityType: "project" | "agreement" | null,
  entityData?: Record<string, any>
) {
  const { state, setState } = useCoAgent<GlobalCopilotState>({
    name: "sample_agent",
    initialState: {},
  });

  useEffect(() => {
    // Only update if context has changed
    if (
      state.workflow !== workflow ||
      state.entity_id !== entityId ||
      state.entity_type !== entityType
    ) {
      setState({
        ...state,
        workflow: workflow || null,
        entity_id: entityId || null,
        entity_type: entityType || null,
        entity_data: entityData || null,
        // Legacy compatibility: if estimates workflow with entity, also set selected_project fields
        ...(workflow === "estimates" && entityId
          ? {
              selected_project_id: entityId,
              selected_project_name: entityData?.name || null,
              selected_project_stage: entityData?.stage || null,
            }
          : {}),
      });
    }
  }, [workflow, entityId, entityType, entityData, state, setState]);

  return { state, setState };
}

