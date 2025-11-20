import type { Metadata } from "next";

import { CopilotKit } from "@copilotkit/react-core";
import { GlobalCopilot } from "@/components/copilot/GlobalCopilot";
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
            {children}
            <GlobalCopilot />
          </CopilotKit>
        </QueryProvider>
      </body>
    </html>
  );
}
