"use client";

import { useCoAgent } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type DockedCopilotState = {
  workflow?: string | null;
  entity_id?: string | null;
  entity_type?: string | null;
  entity_data?: Record<string, any>;
};

export function DockedCopilot() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { state, setState } = useCoAgent<DockedCopilotState>({
    name: "sample_agent",
    initialState: {},
  });

  // Check viewport width for auto-collapse
  useEffect(() => {
    const checkViewport = () => {
      if (window.innerWidth < 1400 && !isCollapsed) {
        setIsCollapsed(true);
      } else if (window.innerWidth >= 1400 && isCollapsed) {
        setIsCollapsed(false);
      }
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, [isCollapsed]);

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
    if (
      context.workflow !== state.workflow ||
      context.entity_id !== state.entity_id
    ) {
      const newState = {
        ...state,
        workflow: context.workflow,
        entity_id: context.entity_id,
        entity_type: context.entity_type,
      };
      setState(newState);
    }
  }, [context.workflow, context.entity_id, context.entity_type, state, setState]);

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

  const sidebarTitle = useMemo(() => {
    if (context.workflow === "estimates") {
      return "Estimates Copilot";
    } else if (context.workflow === "contracts") {
      return "Contracts Copilot";
    }
    return "AI Assistant";
  }, [context]);

  const dockWidth = isCollapsed ? 60 : 320;

  return (
    <div
      className="fixed right-0 top-0 hidden h-screen border-l border-slate-200 bg-white shadow-lg transition-all duration-300 lg:block"
      style={{ width: `${dockWidth}px`, zIndex: 1000 }}
    >
      {isCollapsed ? (
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex h-full w-full items-center justify-center text-slate-400 hover:text-slate-600"
          title="Expand Copilot"
        >
          <svg
            className="h-6 w-6 rotate-180"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      ) : (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 p-3">
            <h2 className="text-sm font-semibold text-slate-900">
              {sidebarTitle}
            </h2>
            <button
              onClick={() => setIsCollapsed(true)}
              className="text-slate-400 hover:text-slate-600"
              title="Collapse Copilot"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <CopilotSidebar
              clickOutsideToClose={false}
              defaultOpen={true}
              labels={{
                title: sidebarTitle,
                initial: initialMessage,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

