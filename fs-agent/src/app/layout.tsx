import type { Metadata } from "next";

import { CopilotKit } from "@copilotkit/react-core";
import { DockedCopilot } from "@/components/copilot/DockedCopilot";
import { QueryProvider } from "@/providers/QueryProvider";
import AppNav from "@/components/navigation/AppNav";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import "./globals.css";
import "@copilotkit/react-ui/styles.css";

export const metadata: Metadata = {
  title: "VBT Estimation & Contracts Platform",
  description: "AI-powered estimation and contract management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={"antialiased"}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Immediately hide close buttons before React renders
                const hideCloseButtons = function() {
                  const selectors = [
                    'button[aria-label*="close" i]',
                    'button[aria-label*="Close" i]',
                    '[class*="copilot-sidebar-close"]',
                    '[class*="CopilotSidebar-close"]',
                    '[class*="copilot-close-button"]'
                  ];
                  selectors.forEach(function(sel) {
                    try {
                      document.querySelectorAll(sel).forEach(function(el) {
                        el.style.display = 'none';
                        el.style.visibility = 'hidden';
                        el.remove();
                      });
                    } catch(e) {}
                  });
                };
                // Run immediately
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', hideCloseButtons);
                } else {
                  hideCloseButtons();
                }
                // Also watch for new elements
                const observer = new MutationObserver(hideCloseButtons);
                observer.observe(document.body || document.documentElement, {
                  childList: true,
                  subtree: true
                });
                // Run periodically
                setInterval(hideCloseButtons, 50);
              })();
            `,
          }}
        />
        <QueryProvider>
          <CopilotKit runtimeUrl="/api/copilotkit" agent="sample_agent">
            <div className="flex min-h-screen flex-col pr-0 lg:pr-[320px]">
              <AppNav />
              <Breadcrumbs />
              <main className="flex-1">{children}</main>
            </div>
            <DockedCopilot />
          </CopilotKit>
        </QueryProvider>
      </body>
    </html>
  );
}
