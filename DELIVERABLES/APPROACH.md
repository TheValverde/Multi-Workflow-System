# APPROACH

> **Goal**: Document which AI tools you used and why, your prompt strategy in 3-5 bullets, biggest pivot/surprise during implementation, and what you'd do differently with more time.

---

## Tools used

- **Cursor** for:
  - AI assisted coding
  - MCP Capabilities
  - AG-UI Docs linking
- **CopilotKitMCP** for:
  - CopilotKitMCP is the MCP server that gives access to CopilotKit, which is the larger encompassing system around AG-UI

---

## Prompt Strategy

- Created a PRD and AGILE structure to help guide the development process.
- PRD was based on the RULES.md, and the AGILE structure was based on the PRD.
- The AGILE folder contained epics, stories, and sprints to help guide the development process.
- The stories served as the base prompts for each step of development.

---

## Biggest pivot/surprise during implementation

I was surprised by how quickly the project came together. I was able to get the project up and running in a few days, and the project is now in a working state.
---

## What you'd do differently with more time

If I were to have more time, I would implement more robust testing around the UI updating, and guardrails around the LLM calls before the edits are made to the document. I'd also like to implement a login system, to let this be used by multiple users in a tenant-based system. That way something like this could be used by a team of people to manage contracts and estimates for a company, within their scope.