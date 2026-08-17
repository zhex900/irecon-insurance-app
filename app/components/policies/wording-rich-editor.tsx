import type { Editor } from "@tiptap/react";
import {
  BoldIcon,
  IndentDecreaseIcon,
  IndentIncreaseIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  UnderlineIcon,
} from "lucide-react";
import { type ReactNode,useEffect, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import {
  ensureWordingHtml,
  normalizeWordingHtmlForSave,
  type WordingListStyle,
} from "~/lib/policies/wording/html";
import { cn } from "~/lib/utils";

type LoadedModules = {
  useEditor: typeof import("@tiptap/react").useEditor;
  EditorContent: typeof import("@tiptap/react").EditorContent;
  StarterKit: typeof import("@tiptap/starter-kit").StarterKit;
  Underline: typeof import("@tiptap/extension-underline").Underline;
  TextStyle: typeof import("@tiptap/extension-text-style").TextStyle;
  FontFamily: typeof import("@tiptap/extension-text-style").FontFamily;
  FontSize: typeof import("@tiptap/extension-text-style").FontSize;
  Indent: typeof import("~/lib/policies/wording/tiptap-extensions").Indent;
  ListStyle: typeof import("~/lib/policies/wording/tiptap-extensions").ListStyle;
};

const LIST_TOOLBAR: Array<{
  style: WordingListStyle;
  label: string;
  icon: ReactNode;
}> = [
  { style: "disc", label: "Bullet list", icon: <ListIcon /> },
  { style: "decimal", label: "Numbered list", icon: <ListOrderedIcon /> },
];

type WordingRichEditorProps = {
  id?: string;
  label: string;
  value: string;
  onChange: (html: string) => void;
  required?: boolean;
  error?: string;
  variant?: "subject" | "content";
  className?: string;
  disabled?: boolean;
};

function ToolbarButton({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant={active ? "secondary" : "ghost"}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function WordingEditorInner({
  mods,
  id,
  label,
  value,
  onChange,
  required,
  error,
  variant,
  className,
  disabled,
}: WordingRichEditorProps & { mods: LoadedModules }) {
  const {
    useEditor,
    EditorContent,
    StarterKit,
    Underline,
    TextStyle,
    FontFamily,
    FontSize,
    Indent,
    ListStyle,
  } = mods;
  const [, setTick] = useState(0);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
      }),
      Underline,
      TextStyle,
      FontSize,
      FontFamily.configure({ types: ["textStyle"] }),
      Indent,
      ListStyle,
    ],
    [StarterKit, Underline, TextStyle, FontFamily, FontSize, Indent, ListStyle],
  );

  const editor = useEditor({
    extensions,
    content: ensureWordingHtml(value) || "<p></p>",
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onChange(normalizeWordingHtmlForSave(ed.getHTML()));
      setTick((n) => n + 1);
    },
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class:
          "wording-list-styles wording-rich-editor-prose min-h-[4.5rem] px-3 py-2 text-sm text-foreground outline-none",
      },
    },
  });

  function activeListStyle(): WordingListStyle | null {
    if (!editor) return null;
    if (editor.isActive("bulletList")) {
      const raw = String(
        editor.getAttributes("bulletList").listStyle ?? "disc",
      );
      return raw === "dash" ? "dash" : "disc";
    }
    if (editor.isActive("orderedList")) {
      const raw = String(
        editor.getAttributes("orderedList").listStyle ?? "decimal",
      );
      if (raw === "lower-alpha" || raw === "lower-roman") return raw;
      return "decimal";
    }
    return null;
  }

  useEffect(() => {
    if (!editor) return;
    const sync = () => setTick((n) => n + 1);
    editor.on("selectionUpdate", sync);
    editor.on("transaction", sync);
    return () => {
      editor.off("selectionUpdate", sync);
      editor.off("transaction", sync);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const next = ensureWordingHtml(value) || "<p></p>";
    const current = normalizeWordingHtmlForSave(editor.getHTML());
    if (normalizeWordingHtmlForSave(next) !== current) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value]);

  function indent(ed: Editor) {
    if (ed.can().sinkListItem("listItem")) {
      ed.chain().focus().sinkListItem("listItem").run();
      return;
    }
    const current = Number(ed.getAttributes("paragraph").indent ?? 0) || 0;
    ed.chain()
      .focus()
      .updateAttributes("paragraph", { indent: Math.min(8, current + 1) })
      .run();
  }

  function outdent(ed: Editor) {
    if (ed.can().liftListItem("listItem")) {
      ed.chain().focus().liftListItem("listItem").run();
      return;
    }
    const current = Number(ed.getAttributes("paragraph").indent ?? 0) || 0;
    ed.chain()
      .focus()
      .updateAttributes("paragraph", { indent: Math.max(0, current - 1) })
      .run();
  }

  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <div
        className={cn(
          "wording-rich-editor overflow-hidden rounded-md border border-input bg-background text-foreground",
          error && "border-destructive",
          disabled && "opacity-60",
        )}
      >
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-1 py-1">
          <ToolbarButton
            label="Bold"
            active={editor?.isActive("bold")}
            disabled={disabled || !editor}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <BoldIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Italic"
            active={editor?.isActive("italic")}
            disabled={disabled || !editor}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <ItalicIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Underline"
            active={editor?.isActive("underline")}
            disabled={disabled || !editor}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon />
          </ToolbarButton>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          {LIST_TOOLBAR.map((item) => (
            <ToolbarButton
              key={item.style}
              label={item.label}
              active={activeListStyle() === item.style}
              disabled={disabled || !editor}
              onClick={() =>
                editor?.chain().focus().toggleWordingList(item.style).run()
              }
            >
              {item.icon}
            </ToolbarButton>
          ))}
          <ToolbarButton
            label="Decrease indent"
            disabled={disabled || !editor}
            onClick={() => editor && outdent(editor)}
          >
            <IndentDecreaseIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Increase indent"
            disabled={disabled || !editor}
            onClick={() => editor && indent(editor)}
          >
            <IndentIncreaseIcon />
          </ToolbarButton>
        </div>
        <div
          className={cn(
            "overflow-y-auto",
            variant === "subject" ? "max-h-28" : "max-h-72 min-h-40",
          )}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

/**
 * TipTap Additional Wording editor. Loaded after mount so SSR never pulls
 * ProseMirror into the Worker bundle.
 */
export function WordingRichEditor(props: WordingRichEditorProps) {
  const [mods, setMods] = useState<LoadedModules | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [
          { useEditor, EditorContent },
          { StarterKit },
          { Underline },
          { TextStyle, FontFamily, FontSize },
          { Indent, ListStyle },
        ] = await Promise.all([
          import("@tiptap/react"),
          import("@tiptap/starter-kit"),
          import("@tiptap/extension-underline"),
          import("@tiptap/extension-text-style"),
          import("~/lib/policies/wording/tiptap-extensions"),
        ]);
        if (cancelled) return;
        setMods({
          useEditor,
          EditorContent,
          StarterKit,
          Underline,
          TextStyle,
          FontFamily,
          FontSize,
          Indent,
          ListStyle,
        });
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          error instanceof Error ? error.message : "Failed to load editor",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    return (
      <Field data-invalid>
        <FieldLabel required={props.required}>{props.label}</FieldLabel>
        <p className="text-sm text-destructive">{loadError}</p>
      </Field>
    );
  }

  if (!mods) {
    return (
      <Field className={props.className}>
        <FieldLabel required={props.required}>{props.label}</FieldLabel>
        <div
          className={cn(
            "flex items-center justify-center rounded-md border border-input bg-muted/30 text-sm text-muted-foreground",
            props.variant === "subject" ? "h-24" : "h-48",
          )}
        >
          Loading editor…
        </div>
      </Field>
    );
  }

  return <WordingEditorInner {...props} mods={mods} />;
}
