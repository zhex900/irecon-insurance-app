import {
  image,
  line,
  multiVariableText,
  rectangle,
  text,
} from "@pdfme/schemas";

/**
 * Plugins used by both Designer and `@pdfme/generator`.
 * Keep in sync so saved templates with static text / shapes still render.
 */
export const pdfmePlugins = {
  Text: text,
  "Multi-variable text": multiVariableText,
  Image: image,
  Line: line,
  Rectangle: rectangle,
};
