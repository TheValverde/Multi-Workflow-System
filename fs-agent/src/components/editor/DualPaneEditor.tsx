"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useThrottle } from "@/hooks/useThrottle";

type Section = {
  id: string;
  title: string;
  level: number;
};

type DualPaneEditorProps = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  templateType?: "agreement" | "business-case" | "requirements";
  agreementType?: "MSA" | "SOW";
  onPreviewToggle?: (visible: boolean) => void;
  previewVisible?: boolean;
  highlightedSectionId?: string | null;
};

export default function DualPaneEditor({
  value,
  onChange,
  readOnly = false,
  templateType,
  agreementType,
  onPreviewToggle,
  previewVisible = true,
  highlightedSectionId,
}: DualPaneEditorProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewContent, setPreviewContent] = useState(value);

  // Throttle preview updates to avoid reflow on every keystroke
  const throttledValue = useThrottle(value, 500);

  // Export to PDF using browser's native print dialog
  const handleExportPDF = () => {
    window.print();
  };

  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "",
    editable: !readOnly,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[400px] focus:outline-none text-slate-900 p-4",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
      // Extract sections from HTML
      extractSections(html);
    },
  });

  // Extract sections from HTML for navigation
  const extractSections = (html: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const headings = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const extracted: Section[] = [];
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.substring(1));
      const title = heading.textContent || `Section ${index + 1}`;
      const id = `section-${index}`;
      heading.id = id;
      extracted.push({ id, title, level });
    });
    setSections(extracted);
  };

  // Update preview content when value changes (throttled)
  useEffect(() => {
    if (throttledValue !== previewContent) {
      setPreviewContent(throttledValue);
    }
  }, [throttledValue, previewContent]);

  // Update editor when value prop changes
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value && current !== value) {
      editor.commands.setContent(value, false);
      extractSections(value);
    }
    if (!value && current !== "<p></p>") {
      editor.commands.setContent("", false);
      setSections([]);
    }
  }, [editor, value]);

  // Extract sections on initial load
  useEffect(() => {
    if (value) {
      extractSections(value);
    }
  }, []);


  // Scroll to highlighted section in preview
  useEffect(() => {
    if (highlightedSectionId && previewRef.current) {
      const element = previewRef.current.querySelector(`#${highlightedSectionId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        // Add highlight class temporarily
        element.classList.add("bg-yellow-100", "transition-colors", "duration-300");
        setTimeout(() => {
          element.classList.remove("bg-yellow-100");
        }, 2000);
      }
    }
  }, [highlightedSectionId]);

  // Keyboard shortcut: Cmd/Ctrl+Shift+P to toggle preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key === "P" &&
        onPreviewToggle
      ) {
        e.preventDefault();
        onPreviewToggle(!previewVisible);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewVisible, onPreviewToggle]);

  const scrollToSection = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    if (editor) {
      const element = editor.view.dom.querySelector(`#${sectionId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        // Focus editor
        editor.commands.focus();
      }
    }
    // Also scroll in preview
    if (previewRef.current) {
      const element = previewRef.current.querySelector(`#${sectionId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  if (!editor) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
        Loading editor…
      </div>
    );
  }

  // Responsive grid: hide preview on smaller screens, adjust section nav
  const gridTemplateCols = previewVisible
    ? "200px 1fr 1fr"
    : "200px 1fr";

  return (
    <div 
      className="grid h-full w-full gap-2 lg:gap-4"
      style={{ gridTemplateColumns: gridTemplateCols }}
    >
      {/* Section Navigator */}
      <aside className="overflow-y-auto border-r border-slate-200 pr-2 lg:pr-4">
        <div className="sticky top-0 bg-white pb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sections
          </h3>
        </div>
        <nav className="mt-2 space-y-1">
          {sections.length === 0 ? (
            <p className="text-xs text-slate-400">No sections found</p>
          ) : (
            sections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`block w-full text-left text-xs transition-colors ${
                  selectedSectionId === section.id
                    ? "font-semibold text-slate-900"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                style={{ paddingLeft: `${(section.level - 1) * 12}px` }}
              >
                {section.title}
              </button>
            ))
          )}
        </nav>
      </aside>

      {/* Editor Pane */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 p-2">
          <ToolbarButton
            label="Bold"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={readOnly}
          />
          <ToolbarButton
            label="Italic"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={readOnly}
          />
          <ToolbarButton
            label="Bullet List"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            disabled={readOnly}
          />
          <ToolbarButton
            label="Numbered List"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            disabled={readOnly}
          />
          {onPreviewToggle && (
            <button
              onClick={() => onPreviewToggle(!previewVisible)}
              className="ml-auto rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
              title="Toggle preview (Cmd/Ctrl+Shift+P)"
            >
              {previewVisible ? "Hide Preview" : "Show Preview"}
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Preview Pane */}
      {previewVisible && (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-300 bg-slate-100">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-300 bg-slate-200 px-4 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Print Preview
            </h3>
            <button
              onClick={handleExportPDF}
              className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
            >
              Export PDF
            </button>
          </div>
          {/* Page-like container */}
          <div className="flex-1 overflow-y-auto overflow-x-auto">
            <div className="flex items-start justify-start min-h-full p-4 lg:p-8">
              <div
                ref={previewRef}
                data-print-content
                className="bg-white shadow-lg mx-auto"
                style={{
                  width: '8.5in',
                  minHeight: '11in',
                  padding: '1in',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  fontSize: '12pt',
                  lineHeight: '1.6',
                  color: '#000',
                }}
              >
                <div
                  className="prose max-w-none
                    [&_strong]:font-semibold [&_strong]:text-black
                    [&_h1]:text-24pt [&_h1]:font-bold [&_h1]:text-black [&_h1]:mb-6 [&_h1]:mt-0 [&_h1]:leading-tight [&_h1]:font-serif
                    [&_h2]:text-18pt [&_h2]:font-semibold [&_h2]:text-black [&_h2]:mb-4 [&_h2]:mt-8 [&_h2]:leading-tight [&_h2]:font-serif
                    [&_h3]:text-14pt [&_h3]:font-semibold [&_h3]:text-black [&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:font-serif
                    [&_p]:text-black [&_p]:mb-4 [&_p]:leading-relaxed [&_p]:text-12pt
                    [&_ul]:list-disc [&_ul]:pl-8 [&_ul]:mb-4 [&_ul]:space-y-2
                    [&_ol]:list-decimal [&_ol]:pl-8 [&_ol]:mb-4 [&_ol]:space-y-2
                    [&_li]:text-black [&_li]:mb-1 [&_li]:leading-relaxed [&_li]:text-12pt
                    [&_li_strong]:font-semibold
                    [&_table]:w-full [&_table]:border-collapse [&_table]:mb-4
                    [&_td]:border [&_td]:border-gray-400 [&_td]:p-2 [&_td]:text-12pt
                    [&_th]:border [&_th]:border-gray-400 [&_th]:p-2 [&_th]:font-semibold [&_th]:text-12pt"
                  dangerouslySetInnerHTML={{ __html: previewContent }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-slate-900 text-white"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {label}
    </button>
  );
}

