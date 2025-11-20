import type { Metadata } from "next";

import { CopilotKit } from "@copilotkit/react-core";
import { DockedCopilot } from "@/components/copilot/DockedCopilot";
import { QueryProvider } from "@/providers/QueryProvider";
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
        <QueryProvider>
          <CopilotKit runtimeUrl="/api/copilotkit" agent="sample_agent">
            <div className="pr-0 lg:pr-[320px]">
              {children}
            </div>
            <DockedCopilot />
          </CopilotKit>
        </QueryProvider>
      </body>
    </html>
  );
}
