import type { Plugin, PropPanelWidgetProps, Schema } from "@pdfme/common";
import { multiVariableText, text } from "@pdfme/schemas";

import {
  parsePdfmeFontName,
  PDFME_FONT_FAMILIES,
  PDFME_FONT_STYLE_LABELS,
  PDFME_FONT_STYLES,
  PDFME_FONT_WEIGHT_LABELS,
  PDFME_FONT_WEIGHTS,
  type PdfmeFontFamily,
  type PdfmeFontStyle,
  pdfmeFontVariantsForFamily,
  type PdfmeFontWeight,
  resolvePdfmeFontName,
} from "~/lib/pdf/font-config";

type TextLikeSchema = Schema & {
  fontName?: string;
  fontVariants?: { bold?: string; italic?: string; boldItalic?: string };
};

function applyTypeface(
  changeSchemas: PropPanelWidgetProps["changeSchemas"],
  schemaId: string,
  family: PdfmeFontFamily,
  weight: PdfmeFontWeight,
  style: PdfmeFontStyle,
) {
  changeSchemas([
    {
      key: "fontName",
      value: resolvePdfmeFontName(family, weight, style),
      schemaId,
    },
    {
      key: "fontVariants",
      value: pdfmeFontVariantsForFamily(family),
      schemaId,
    },
  ]);
}

function selectCss() {
  return [
    "width:100%",
    "height:28px",
    "border:1px solid #d9d9d9",
    "border-radius:6px",
    "padding:0 8px",
    "background:#fff",
    "font-size:13px",
  ].join(";");
}

function labeledSelect(opts: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;gap:4px;width:100%";

  const label = document.createElement("div");
  label.textContent = opts.label;
  label.style.cssText = "font-size:12px;color:rgba(0,0,0,0.65)";

  const select = document.createElement("select");
  select.style.cssText = selectCss();
  for (const item of opts.options) {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    if (item.value === opts.value) option.selected = true;
    select.appendChild(option);
  }
  select.onchange = () => opts.onChange(select.value);

  wrap.append(label, select);
  return wrap;
}

function FontFamilyWidget(props: PropPanelWidgetProps) {
  const { rootElement, changeSchemas, activeSchema } = props;
  const { family, weight, style } = parsePdfmeFontName(
    (activeSchema as TextLikeSchema).fontName,
  );

  rootElement.appendChild(
    labeledSelect({
      label: "Font",
      value: family,
      options: PDFME_FONT_FAMILIES.map((name) => ({
        value: name,
        label: name,
      })),
      onChange: (value) => {
        applyTypeface(
          changeSchemas,
          activeSchema.id,
          value as PdfmeFontFamily,
          weight,
          style,
        );
      },
    }),
  );
}

function FontWeightWidget(props: PropPanelWidgetProps) {
  const { rootElement, changeSchemas, activeSchema } = props;
  const { family, weight, style } = parsePdfmeFontName(
    (activeSchema as TextLikeSchema).fontName,
  );

  rootElement.appendChild(
    labeledSelect({
      label: "Font weight",
      value: weight,
      options: PDFME_FONT_WEIGHTS.map((value) => ({
        value,
        label: PDFME_FONT_WEIGHT_LABELS[value],
      })),
      onChange: (value) => {
        applyTypeface(
          changeSchemas,
          activeSchema.id,
          family,
          value as PdfmeFontWeight,
          style,
        );
      },
    }),
  );
}

function FontStyleWidget(props: PropPanelWidgetProps) {
  const { rootElement, changeSchemas, activeSchema } = props;
  const { family, weight, style } = parsePdfmeFontName(
    (activeSchema as TextLikeSchema).fontName,
  );

  rootElement.appendChild(
    labeledSelect({
      label: "Font style",
      value: style,
      options: PDFME_FONT_STYLES.map((value) => ({
        value,
        label: PDFME_FONT_STYLE_LABELS[value],
      })),
      onChange: (value) => {
        applyTypeface(
          changeSchemas,
          activeSchema.id,
          family,
          weight,
          value as PdfmeFontStyle,
        );
      },
    }),
  );
}

function withTypefaceControls<T extends Schema>(plugin: Plugin<T>): Plugin<T> {
  const basePanel = plugin.propPanel;
  const baseSchema = basePanel.schema;
  const baseWidgets = basePanel.widgets ?? {};
  const defaults = basePanel.defaultSchema as TextLikeSchema;

  return {
    ...plugin,
    propPanel: {
      ...basePanel,
      defaultSchema: {
        ...defaults,
        fontName: resolvePdfmeFontName("Roboto", "400", "normal"),
        fontVariants: {
          ...(defaults.fontVariants ?? {}),
          ...pdfmeFontVariantsForFamily("Roboto"),
        },
      } as unknown as T,
      widgets: {
        ...baseWidgets,
        PdfmeFontFamily: FontFamilyWidget,
        PdfmeFontWeight: FontWeightWidget,
        PdfmeFontStyle: FontStyleWidget,
      },
      schema: (args) => {
        const schema =
          typeof baseSchema === "function"
            ? baseSchema(args)
            : { ...baseSchema };

        // Replace the raw font file picker with typeface + weight + style.
        const {
          fontName: _fontName,
          fontVariants: _variants,
          ...rest
        } = schema;

        return {
          fontFamilyControl: {
            title: "Font",
            type: "string",
            widget: "PdfmeFontFamily",
            span: 12,
          },
          fontWeightControl: {
            title: "Font weight",
            type: "string",
            widget: "PdfmeFontWeight",
            span: 6,
          },
          fontStyleControl: {
            title: "Font style",
            type: "string",
            widget: "PdfmeFontStyle",
            span: 6,
          },
          ...rest,
        };
      },
    },
  };
}

/** Text plugins with Font / weight / style controls. */
export const textWithTypeface = withTypefaceControls(text);
export const multiVariableTextWithTypeface =
  withTypefaceControls(multiVariableText);
