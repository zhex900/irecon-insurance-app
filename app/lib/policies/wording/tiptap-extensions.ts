import { Extension } from "@tiptap/core";
import type { WordingListStyle } from "~/lib/policies/wording/html";
import { isWordingListStyle } from "~/lib/policies/wording/html";

const INDENT_STEP_PX = 24;
const MAX_INDENT = 8;

/**
 * Paragraph / list-item indent via data-indent + margin-left.
 * List nesting still uses TipTap sinkListItem / liftListItem when available.
 */
export const Indent = Extension.create({
  name: "wordingIndent",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "listItem"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const raw = element.getAttribute("data-indent");
              if (raw && /^\d+$/.test(raw)) {
                return Math.min(MAX_INDENT, Number(raw));
              }
              const style = element.getAttribute("style") ?? "";
              const m = /margin-left:\s*(\d+(?:\.\d+)?)px/i.exec(style);
              if (!m) return 0;
              return Math.min(
                MAX_INDENT,
                Math.round(Number(m[1]) / INDENT_STEP_PX),
              );
            },
            renderHTML: (attributes) => {
              const indent = Number(attributes.indent) || 0;
              if (indent <= 0) return {};
              return {
                "data-indent": String(indent),
                style: `margin-left: ${indent * INDENT_STEP_PX}px`,
              };
            },
          },
        },
      },
    ];
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wordingListStyle: {
      /** Toggle / switch Additional Wording list style (• - 1. a) (i)). */
      toggleWordingList: (style: WordingListStyle) => ReturnType;
    };
  }
}

function isBulletStyle(style: WordingListStyle): boolean {
  return style === "disc" || style === "dash";
}

/**
 * Persist list marker style on ul/ol as data-list-style.
 * Styles: disc (•), dash (-), decimal (1.), lower-alpha (a)), lower-roman ((i)).
 */
export const ListStyle = Extension.create({
  name: "wordingListStyle",

  addGlobalAttributes() {
    return [
      {
        types: ["bulletList", "orderedList"],
        attributes: {
          listStyle: {
            default: null,
            parseHTML: (element) => {
              const raw = element.getAttribute("data-list-style");
              return raw && isWordingListStyle(raw) ? raw : null;
            },
            renderHTML: (attributes) => {
              const style = attributes.listStyle;
              if (!style || !isWordingListStyle(String(style))) return {};
              return { "data-list-style": String(style) };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      toggleWordingList:
        (style: WordingListStyle) =>
        ({ editor, commands, chain }) => {
          const bullet = isBulletStyle(style);
          const nodeName = bullet ? "bulletList" : "orderedList";
          const otherName = bullet ? "orderedList" : "bulletList";
          const currentStyle = editor.isActive(nodeName)
            ? String(
                editor.getAttributes(nodeName).listStyle ??
                  (bullet ? "disc" : "decimal"),
              )
            : null;

          // Same style active → turn list off.
          if (editor.isActive(nodeName) && currentStyle === style) {
            return bullet
              ? commands.toggleBulletList()
              : commands.toggleOrderedList();
          }

          // Already correct list type → just change marker style.
          if (editor.isActive(nodeName)) {
            return commands.updateAttributes(nodeName, { listStyle: style });
          }

          let next = chain().focus();
          if (editor.isActive(otherName)) {
            next = bullet
              ? next.toggleOrderedList().toggleBulletList()
              : next.toggleBulletList().toggleOrderedList();
          } else {
            next = bullet ? next.toggleBulletList() : next.toggleOrderedList();
          }
          return next.updateAttributes(nodeName, { listStyle: style }).run();
        },
    };
  },
});
