import { image, line, rectangle, table } from "@pdfme/schemas";

import {
  multiVariableTextWithTypeface,
  textWithTypeface,
} from "~/lib/pdf/text-plugins";

/**
 * Plugins used by both Designer and `@pdfme/generator`.
 * Keep in sync so saved templates with static text / shapes still render.
 */
export const pdfmePlugins = {
  Text: textWithTypeface,
  "Multi-variable text": multiVariableTextWithTypeface,
  Table: table,
  Image: image,
  Line: line,
  Rectangle: rectangle,
};
