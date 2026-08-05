import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { EMAIL_TEMPLATE_PLACEHOLDERS } from "~/lib/email/templates";

type PlaceholderItem = (typeof EMAIL_TEMPLATE_PLACEHOLDERS)[number];

const PLACEHOLDER_TOKEN_RE = /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g;

function filterPlaceholders(query: string): PlaceholderItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...EMAIL_TEMPLATE_PLACEHOLDERS];
  return EMAIL_TEMPLATE_PLACEHOLDERS.filter(
    ({ key, token }) =>
      key.toLowerCase().includes(q) || token.toLowerCase().includes(q),
  );
}

function buildSuggestionList(
  items: PlaceholderItem[],
  selectedIndex: number,
  onSelect: (item: PlaceholderItem) => void,
): HTMLElement {
  const root = document.createElement("div");
  root.className = "email-placeholder-suggest";
  root.setAttribute("role", "listbox");

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "email-placeholder-suggest__empty";
    empty.textContent = "No placeholders match";
    root.append(empty);
    return root;
  }

  items.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "email-placeholder-suggest__item";
    button.setAttribute("role", "option");
    button.setAttribute(
      "aria-selected",
      index === selectedIndex ? "true" : "false",
    );
    if (index === selectedIndex) {
      button.dataset.selected = "true";
    }
    button.innerHTML = `<span class="email-placeholder-suggest__token">${item.token}</span>`;
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      onSelect(item);
    });
    root.append(button);
  });

  return root;
}

/**
 * Styles {{placeholders}} as inline tags and offers autocomplete after typing {{.
 * Tokens stay as plain text in the document (compatible with applyEmailTemplate).
 */
export const EmailPlaceholderExtension = Extension.create({
  name: "emailPlaceholder",

  addProseMirrorPlugins() {
    const editor = this.editor;

    const decorationPlugin = new Plugin({
      key: new PluginKey("emailPlaceholderDecorations"),
      props: {
        decorations(state) {
          const decorations: ReturnType<typeof Decoration.inline>[] = [];
          state.doc.descendants((node, pos) => {
            if (!node.isText || !node.text) return;
            const text = node.text;
            PLACEHOLDER_TOKEN_RE.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = PLACEHOLDER_TOKEN_RE.exec(text)) !== null) {
              const from = pos + match.index;
              const to = from + match[0].length;
              decorations.push(
                Decoration.inline(from, to, {
                  class: "email-placeholder-tag",
                }),
              );
            }
          });
          return DecorationSet.create(state.doc, decorations);
        },
      },
    });

    let selectedIndex = 0;
    let latestProps: SuggestionProps<PlaceholderItem> | null = null;
    let popup: HTMLElement | null = null;
    let unmountPopup: (() => void) | null = null;

    const syncPopup = () => {
      if (!latestProps || !popup) return;
      const next = buildSuggestionList(
        latestProps.items,
        selectedIndex,
        (item) => {
          latestProps?.command(item);
        },
      );
      popup.replaceChildren(...Array.from(next.children));
      for (const attr of Array.from(next.attributes)) {
        popup.setAttribute(attr.name, attr.value);
      }
      popup
        .querySelector<HTMLElement>('[data-selected="true"]')
        ?.scrollIntoView({ block: "nearest" });
    };

    const suggestionPlugin = Suggestion<PlaceholderItem>({
      editor,
      char: "{{",
      allowSpaces: false,
      allowedPrefixes: [" ", "\n", "\u00A0", "(", "[", ":", "=", '"', "'"],
      items: ({ query }) => filterPlaceholders(query),
      command: ({ editor: ed, range, props }) => {
        ed.chain().focus().insertContentAt(range, props.token).run();
      },
      render: () => ({
        onStart: (props) => {
          latestProps = props;
          selectedIndex = 0;
          popup = document.createElement("div");
          popup.className = "email-placeholder-suggest";
          syncPopup();
          unmountPopup = props.mount(popup);
        },
        onUpdate: (props) => {
          latestProps = props;
          selectedIndex = 0;
          syncPopup();
        },
        onKeyDown: ({ event }) => {
          if (!latestProps) return false;
          const count = latestProps.items.length;

          if (event.key === "ArrowDown") {
            if (count === 0) return true;
            selectedIndex = (selectedIndex + 1) % count;
            syncPopup();
            return true;
          }
          if (event.key === "ArrowUp") {
            if (count === 0) return true;
            selectedIndex = (selectedIndex - 1 + count) % count;
            syncPopup();
            return true;
          }
          if (event.key === "Enter") {
            const item = latestProps.items[selectedIndex];
            if (item) latestProps.command(item);
            return true;
          }
          if (event.key === "Escape") {
            return true;
          }
          return false;
        },
        onExit: () => {
          unmountPopup?.();
          unmountPopup = null;
          popup = null;
          latestProps = null;
          selectedIndex = 0;
        },
      }),
    });

    return [decorationPlugin, suggestionPlugin];
  },
});
