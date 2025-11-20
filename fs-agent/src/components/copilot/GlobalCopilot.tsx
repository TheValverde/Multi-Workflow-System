"use client";

import { useCoAgent } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";

// Log copilot interactions for AI_ARTIFACTS.md
function logCopilotInteraction(action: string, context: any) {
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.log("[Copilot]", action, context);
  }
}

type GlobalCopilotState = {
  workflow?: string | null;
  entity_id?: string | null;
  entity_type?: string | null;
  entity_data?: Record<string, any> | null;
  // Legacy fields for backward compatibility
  selected_project_id?: string | null;
  selected_project_name?: string | null;
  selected_project_stage?: string | null;
  timeline_version?: string | null;
};

export function GlobalCopilot() {
  const pathname = usePathname();
  const { state, setState } = useCoAgent<GlobalCopilotState>({
    name: "sample_agent",
    initialState: {},
  });

  // Derive workflow and entity from pathname
  const context = useMemo(() => {
    if (pathname.startsWith("/estimates/")) {
      const match = pathname.match(/^\/estimates\/([^/]+)/);
      return {
        workflow: "estimates",
        entity_id: match?.[1] || null,
        entity_type: "project",
      };
    } else if (pathname.startsWith("/contracts/")) {
      const match = pathname.match(/^\/contracts\/([^/]+)/);
      return {
        workflow: "contracts",
        entity_id: match?.[1] || null,
        entity_type: "agreement",
      };
    } else if (pathname === "/estimates") {
      return {
        workflow: "estimates",
        entity_id: null,
        entity_type: null,
      };
    } else if (pathname === "/contracts" || pathname === "/contracts/new") {
      return {
        workflow: "contracts",
        entity_id: null,
        entity_type: null,
      };
    } else if (pathname === "/policies") {
      return {
        workflow: "contracts",
        entity_id: null,
        entity_type: null,
      };
    }
    return {
      workflow: null,
      entity_id: null,
      entity_type: null,
    };
  }, [pathname]);

  // Sync context to agent state on navigation
  useEffect(() => {
    if (context.workflow !== state.workflow || context.entity_id !== state.entity_id) {
      const newState = {
        ...state,
        workflow: context.workflow,
        entity_id: context.entity_id,
        entity_type: context.entity_type,
      };
      setState(newState);
      logCopilotInteraction("Context updated", {
        workflow: context.workflow,
        entity_id: context.entity_id,
        entity_type: context.entity_type,
        pathname,
      });
    }
  }, [context.workflow, context.entity_id, context.entity_type, state, setState, pathname]);

  // Keyboard shortcut: Cmd/Ctrl+K to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // Toggle sidebar - CopilotSidebar handles this internally via its open state
        // For now, we'll just log the shortcut
        logCopilotInteraction("Keyboard shortcut", { shortcut: "Cmd/Ctrl+K" });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Build sidebar title based on context
  const sidebarTitle = useMemo(() => {
    if (context.workflow === "estimates") {
      if (context.entity_id) {
        return "Estimates Copilot";
      }
      return "Estimates Copilot";
    } else if (context.workflow === "contracts") {
      if (context.entity_id) {
        return "Contracts Copilot";
      }
      return "Contracts Copilot";
    }
    return "AI Assistant";
  }, [context]);

  // Build initial message based on context
  const initialMessage = useMemo(() => {
    if (context.workflow === "estimates") {
      if (context.entity_id) {
        return "👋 I'm your Estimates assistant. I can help you:\n\n- Generate business cases and requirements\n- Create and adjust WBS (Work Breakdown Structure)\n- Calculate project totals\n- Add line items and adjust hours\n\nWhat would you like to do?";
      }
      return "👋 I'm your Estimates assistant. Navigate to a project to get started, or ask me about the estimates workflow.";
    } else if (context.workflow === "contracts") {
      if (context.entity_id) {
        return "👋 I'm your Contracts assistant. I can help you:\n\n- Summarize pushbacks and policy conflicts\n- Add notes to agreements\n- Review drafts and apply proposals\n- Validate agreements against estimates\n\nWhat would you like to do?";
      }
      return "👋 I'm your Contracts assistant. Navigate to an agreement to get started, or ask me about the contracts workflow.";
    }
    return "👋 Hi! I'm your AI assistant. I can help you with Estimates and Contracts workflows.\n\nNavigate to a project or agreement to get started, or ask me a question!";
  }, [context]);

  return (
    <CopilotSidebar
      clickOutsideToClose={false}
      defaultOpen={true}
      labels={{
        title: sidebarTitle,
        initial: initialMessage,
      }}
    />
  );
}

