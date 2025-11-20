"use client";

import { useCoAgent } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";

type DockedCopilotState = {
  workflow?: string | null;
  entity_id?: string | null;
  entity_type?: string | null;
  entity_data?: Record<string, any>;
};

export function DockedCopilot() {
  const pathname = usePathname();
  const { state, setState } = useCoAgent<DockedCopilotState>({
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

  // Aggressively hide close button immediately on mount and continuously
  useEffect(() => {
    const hideCloseButton = () => {
      // More aggressive selectors to catch all possible close buttons
      const selectors = [
        'button[aria-label*="close" i]',
        'button[aria-label*="Close" i]',
        '[class*="close"]',
        '[class*="Close"]',
        '[class*="copilot-sidebar-close"]',
        '[class*="CopilotSidebar-close"]',
        '[class*="copilot-close"]',
        'svg[class*="close"]',
        'svg + button', // Button after close icon
      ];
      
      selectors.forEach((selector) => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            // Check if it's actually a close button (has close-related text/aria-label)
            const ariaLabel = htmlEl.getAttribute('aria-label')?.toLowerCase() || '';
            const className = htmlEl.className?.toLowerCase() || '';
            const textContent = htmlEl.textContent?.toLowerCase() || '';
            
            if (
              ariaLabel.includes('close') ||
              className.includes('close') ||
              (textContent.includes('close') && htmlEl.tagName === 'BUTTON')
            ) {
              htmlEl.style.display = 'none';
              htmlEl.style.visibility = 'hidden';
              htmlEl.style.opacity = '0';
              htmlEl.style.pointerEvents = 'none';
              htmlEl.style.position = 'absolute';
              htmlEl.style.left = '-9999px';
              htmlEl.remove(); // Actually remove it from DOM
            }
          });
        } catch (e) {
          // Ignore selector errors
        }
      });
    };

    // Run immediately
    hideCloseButton();
    
    // Run on next tick to catch anything that renders after
    setTimeout(hideCloseButton, 0);
    setTimeout(hideCloseButton, 10);
    setTimeout(hideCloseButton, 50);
    setTimeout(hideCloseButton, 100);

    // Watch for any new elements
    const observer = new MutationObserver(() => {
      hideCloseButton();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-label'],
    });

    // Aggressive periodic check
    const interval = setInterval(hideCloseButton, 100);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

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

  return (
    <div
      className="fixed right-0 top-0 hidden h-screen w-[320px] border-l border-slate-200 bg-white shadow-lg lg:block"
      style={{ zIndex: 1000 }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center border-b border-slate-200 p-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {sidebarTitle}
          </h2>
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
    </div>
  );
}

