import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import "@react-email/editor/themes/default.css";
import { cn } from "~/lib/utils";

export type EmailRichEditorHandle = {
  /** TipTap document HTML (for saving templates with placeholders). */
  getDocumentHtml: () => string;
  /** Email-ready HTML + plain text (for sending via Resend). */
  getEmail: () => Promise<{ html: string; text: string }>;
  /** Insert text / HTML at the last known cursor (preserves selection across toolbar clicks). */
  insertContent: (content: string) => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

type EmailRichEditorProps = {
  /** TipTap HTML document. */
  content: string;
  /**
   * Remount key — change when the dialog opens / template switches so TipTap
   * reloads content (EmailEditor does not fully sync controlled updates).
   */
  contentKey?: string;
  editable?: boolean;
  className?: string;
  /** Fixed height for the flex editor + inspector shell. */
  heightClassName?: string;
  /** Show the style inspector sidebar (default true). */
  showInspector?: boolean;
  /** Fired after document edits (debounced by TipTap). */
  onDocumentUpdate?: () => void;
};

type SelectionRange = { from: number; to: number };

type TipTapEditor = {
  getHTML: () => string;
  isFocused: boolean;
  state: { selection: SelectionRange; doc: { content: { size: number } } };
  can: () => { undo: () => boolean; redo: () => boolean };
  chain: () => {
    focus: () => {
      insertContent: (content: string) => { run: () => boolean };
      setTextSelection: (range: SelectionRange) => {
        insertContent: (content: string) => { run: () => boolean };
        run: () => boolean;
      };
      undo: () => { run: () => boolean };
      redo: () => { run: () => boolean };
    };
  };
  on: (event: string, handler: () => void) => void;
  off: (event: string, handler: () => void) => void;
};

type EditorRef = {
  editor?: TipTapEditor | null;
  getEmail: () => Promise<{ html: string; text: string }>;
};

type LoadedModules = {
  EmailEditor: ComponentType<{
    ref?: React.Ref<EditorRef>;
    content: string;
    editable?: boolean;
    theme?: string;
    className?: string;
    extensions?: unknown[];
    onUploadImage?: (file: File) => Promise<{ url: string }>;
    onUpdate?: (ref: EditorRef) => void;
    onReady?: (ref: EditorRef) => void;
    children?: ReactNode;
  }>;
  StarterKit: { configure: (options?: Record<string, unknown>) => unknown };
  EmailTheming: { configure: (options?: Record<string, unknown>) => unknown };
  Placeholder: { configure: (options?: Record<string, unknown>) => unknown };
  EmailPlaceholderExtension: unknown;
  InspectorRoot: ComponentType<{ className?: string; children?: ReactNode }>;
  InspectorBreadcrumb: ComponentType;
  InspectorDocument: ComponentType;
  InspectorNode: ComponentType;
  InspectorText: ComponentType;
};

/**
 * React Email builder (TipTap). Not MJML — React Email has no MJML mode.
 * TipTap is loaded only after mount so importing this module never breaks SSR/hydration.
 */
export const EmailRichEditor = forwardRef<
  EmailRichEditorHandle,
  EmailRichEditorProps
>(function EmailRichEditor(
  {
    content,
    contentKey,
    editable = true,
    className,
    heightClassName = "h-[min(32rem,55vh)]",
    showInspector = true,
    onDocumentUpdate,
  },
  ref,
) {
  const editorRef = useRef<EditorRef>(null);
  const selectionRef = useRef<SelectionRange | null>(null);
  const onDocumentUpdateRef = useRef(onDocumentUpdate);
  onDocumentUpdateRef.current = onDocumentUpdate;
  const [mods, setMods] = useState<LoadedModules | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, setHistoryTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [
          { EmailEditor },
          { Inspector, defaultSlashCommands, TableIcon },
          { StarterKit },
          { EmailTheming },
          { Placeholder },
          { EmailPlaceholderExtension },
          { ensureTableSlashCommand },
        ] = await Promise.all([
          import("@react-email/editor"),
          import("@react-email/editor/ui"),
          import("@react-email/editor/extensions"),
          import("@react-email/editor/plugins"),
          import("@tiptap/extension-placeholder"),
          import("~/lib/email/placeholder-editor-extension"),
          import("~/lib/email/slash-table-command"),
        ]);
        if (cancelled) return;
        ensureTableSlashCommand(
          defaultSlashCommands,
          TableIcon as ComponentType<{ size?: number }>,
        );
        setMods({
          EmailEditor: EmailEditor as LoadedModules["EmailEditor"],
          StarterKit: StarterKit as LoadedModules["StarterKit"],
          EmailTheming: EmailTheming as LoadedModules["EmailTheming"],
          Placeholder: Placeholder as LoadedModules["Placeholder"],
          EmailPlaceholderExtension,
          InspectorRoot: Inspector.Root,
          InspectorBreadcrumb: Inspector.Breadcrumb,
          InspectorDocument: Inspector.Document,
          InspectorNode: Inspector.Node,
          InspectorText: Inspector.Text,
        });
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Failed to load email builder",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      getDocumentHtml: () => {
        const html = editorRef.current?.editor?.getHTML();
        if (html?.trim()) return html;
        return content;
      },
      getEmail: async () => {
        if (!editorRef.current) {
          return { html: content, text: "" };
        }
        return editorRef.current.getEmail();
      },
      insertContent: (value: string) => {
        const editor = editorRef.current?.editor;
        if (!editor) return;
        const fallback = {
          from: editor.state.doc.content.size,
          to: editor.state.doc.content.size,
        };
        const range =
          selectionRef.current ?? editor.state.selection ?? fallback;
        editor
          .chain()
          .focus()
          .setTextSelection(range)
          .insertContent(value)
          .run();
        const next = range.from + value.length;
        selectionRef.current = { from: next, to: next };
        setHistoryTick((n) => n + 1);
        onDocumentUpdateRef.current?.();
      },
      undo: () => {
        const editor = editorRef.current?.editor;
        if (!editor?.can().undo()) return false;
        const ok = editor.chain().focus().undo().run();
        setHistoryTick((n) => n + 1);
        onDocumentUpdateRef.current?.();
        return ok;
      },
      redo: () => {
        const editor = editorRef.current?.editor;
        if (!editor?.can().redo()) return false;
        const ok = editor.chain().focus().redo().run();
        setHistoryTick((n) => n + 1);
        onDocumentUpdateRef.current?.();
        return ok;
      },
      canUndo: () => Boolean(editorRef.current?.editor?.can().undo()),
      canRedo: () => Boolean(editorRef.current?.editor?.can().redo()),
    }),
    [content],
  );

  const extensions = useMemo(() => {
    if (!mods) return undefined;
    const { StarterKit, EmailTheming, Placeholder, EmailPlaceholderExtension } =
      mods;
    return [
      StarterKit.configure(),
      Placeholder.configure({
        placeholder: ({
          node,
        }: {
          node: { type: { name: string }; attrs: { level?: number } };
        }) => {
          if (node.type.name === "heading") {
            return `Heading ${node.attrs.level ?? 1}`;
          }
          return "Press '/' for commands";
        },
        includeChildren: true,
      }),
      EmailTheming.configure({ theme: "basic" }),
      EmailPlaceholderExtension,
    ];
  }, [mods]);

  if (loadError) {
    return (
      <div
        className={cn(
          "email-rich-editor flex items-center justify-center rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive",
          heightClassName,
          className,
        )}
      >
        {loadError}
      </div>
    );
  }

  if (!mods || !extensions) {
    return (
      <div
        className={cn(
          "email-rich-editor flex items-center justify-center rounded-md border border-input bg-muted/30 text-sm text-muted-foreground",
          heightClassName,
          className,
        )}
      >
        Loading email builder…
      </div>
    );
  }

  const {
    EmailEditor,
    InspectorRoot,
    InspectorBreadcrumb,
    InspectorDocument,
    InspectorNode,
    InspectorText,
  } = mods;

  return (
    <div
      className={cn(
        "email-rich-editor flex overflow-hidden rounded-md border border-input bg-background",
        heightClassName,
        className,
      )}
    >
      <EmailEditor
        key={contentKey ?? "email-editor"}
        ref={editorRef}
        content={content}
        editable={editable}
        theme="basic"
        extensions={extensions}
        className="email-rich-editor-canvas min-h-0 min-w-0 flex-1 overflow-y-auto p-4 outline-none"
        onReady={(instance) => {
          const editor = instance.editor;
          if (!editor) return;
          const syncSelection = () => {
            selectionRef.current = {
              from: editor.state.selection.from,
              to: editor.state.selection.to,
            };
          };
          syncSelection();
          editor.on("selectionUpdate", syncSelection);
          editor.on("blur", syncSelection);
        }}
        onUpdate={() => {
          const editor = editorRef.current?.editor;
          if (editor) {
            selectionRef.current = {
              from: editor.state.selection.from,
              to: editor.state.selection.to,
            };
          }
          setHistoryTick((n) => n + 1);
          onDocumentUpdateRef.current?.();
        }}
        onUploadImage={async (file) => {
          const url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ""));
            reader.onerror = () =>
              reject(reader.error ?? new Error("Read failed"));
            reader.readAsDataURL(file);
          });
          return { url };
        }}
      >
        {showInspector ? (
          <InspectorRoot className="email-rich-editor-inspector hidden w-64 shrink-0 overflow-y-auto border-l border-border bg-muted/30 p-3 text-sm md:block">
            <InspectorBreadcrumb />
            <InspectorDocument />
            <InspectorNode />
            <InspectorText />
          </InspectorRoot>
        ) : null}
      </EmailEditor>
    </div>
  );
});
