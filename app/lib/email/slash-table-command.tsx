import { type ComponentType, createElement, type ReactNode } from "react";

/** Subset of `@react-email/editor/ui` SlashCommandItem (avoid SSR import). */
type SlashCommandItem = {
  title: string;
  description?: string;
  icon: ReactNode;
  category?: string;
  searchTerms?: string[];
  command: (input: {
    editor: {
      chain: () => {
        focus: () => {
          deleteRange: (range: unknown) => {
            insertContent: (content: unknown) => { run: () => boolean };
          };
        };
      };
    };
    range: unknown;
  }) => void;
};

const LABEL_STYLE =
  "background:#808080;color:#ffffff;font-weight:700;border:1px solid #808080;padding:4px 8px;width:9rem;vertical-align:top";
const VALUE_STYLE =
  "border:1px solid #808080;padding:4px 8px;vertical-align:top";
const TABLE_STYLE = "border-collapse:collapse;width:100%;max-width:36rem";

function labelCell(text: string) {
  return {
    type: "tableCell" as const,
    attrs: { style: LABEL_STYLE },
    content: [
      {
        type: "paragraph" as const,
        content: [
          {
            type: "text" as const,
            text,
            marks: [{ type: "bold" as const }],
          },
        ],
      },
    ],
  };
}

function valueCell() {
  return {
    type: "tableCell" as const,
    attrs: { style: VALUE_STYLE },
    content: [{ type: "paragraph" as const }],
  };
}

function tableRow(label: string) {
  return {
    type: "tableRow" as const,
    content: [labelCell(label), valueCell()],
  };
}

type TableIconComponent = ComponentType<{ size?: number }>;

/** Empty quotation-style label/value table for `/` slash commands. */
export function createTableSlashCommand(
  TableIcon: TableIconComponent,
): SlashCommandItem {
  return {
    title: "Table",
    description: "Label / value table",
    icon: createElement(TableIcon, { size: 20 }) as ReactNode,
    category: "Layout",
    searchTerms: ["table", "grid", "quotation", "quote", "rows", "cells"],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent([
          {
            type: "table",
            attrs: { style: TABLE_STYLE },
            content: [
              tableRow("Quotation Number"),
              tableRow("Cover Type"),
              tableRow("Insured Name"),
            ],
          },
          { type: "paragraph" },
        ])
        .run();
    },
  };
}

/**
 * EmailEditor hardcodes SlashCommand with `defaultSlashCommands`.
 * Append Table once so `/` includes it without mounting a second slash menu.
 */
export function ensureTableSlashCommand(
  defaultSlashCommands: Array<{ title: string }>,
  TableIcon: TableIconComponent,
): void {
  if (defaultSlashCommands.some((item) => item.title === "Table")) return;
  defaultSlashCommands.push(
    createTableSlashCommand(TableIcon) as { title: string },
  );
}
