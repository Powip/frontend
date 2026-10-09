export type TemplateVariableValues = Record<string, string | null | undefined>;

interface TemplateSegmentStyle {
  bold: boolean;
  italic: boolean;
}

export interface TemplateTextSegment extends TemplateSegmentStyle {
  type: "text";
  text: string;
}

export interface TemplateVariableSegment extends TemplateSegmentStyle {
  type: "variable";
  name: string;
  value: string | null;
}

export type TemplateSegment = TemplateTextSegment | TemplateVariableSegment;

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const PLACEHOLDER_PATTERN = /(\d+)/g;
const FORMAT_PATTERN = /\*([^*\n]+)\*|_([^_\n]+)_/;

export function extractTemplateVariables(body: string): string[] {
  const names = new Set<string>();
  for (const match of body.matchAll(VARIABLE_PATTERN)) {
    names.add(match[1]);
  }
  return [...names];
}

export function hasMalformedVariableTokens(text: string): boolean {
  const withoutValidTokens = text.replace(VARIABLE_PATTERN, "");
  return withoutValidTokens.includes("{{") || withoutValidTokens.includes("}}");
}

export function findUnknownTemplateVariables(body: string, allowed: readonly string[]): string[] {
  return extractTemplateVariables(body).filter((name) => !allowed.includes(name));
}

function pushPlainText(
  segments: TemplateSegment[],
  text: string,
  style: TemplateSegmentStyle,
  variableNames: string[],
  values: TemplateVariableValues,
) {
  let lastIndex = 0;
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: "text", text: text.slice(lastIndex, index), ...style });
    }
    const name = variableNames[Number(match[1])];
    const rawValue = values[name];
    segments.push({
      type: "variable",
      name,
      value: rawValue === undefined || rawValue === null || rawValue === "" ? null : rawValue,
      ...style,
    });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", text: text.slice(lastIndex), ...style });
  }
}

function parseFormatted(
  segments: TemplateSegment[],
  text: string,
  style: TemplateSegmentStyle,
  variableNames: string[],
  values: TemplateVariableValues,
) {
  let rest = text;
  while (rest.length > 0) {
    const match = FORMAT_PATTERN.exec(rest);
    if (!match) {
      pushPlainText(segments, rest, style, variableNames, values);
      return;
    }
    const index = match.index;
    if (index > 0) {
      pushPlainText(segments, rest.slice(0, index), style, variableNames, values);
    }
    const isBold = match[1] !== undefined;
    const inner = isBold ? match[1] : match[2];
    parseFormatted(
      segments,
      inner,
      { bold: style.bold || isBold, italic: style.italic || !isBold },
      variableNames,
      values,
    );
    rest = rest.slice(index + match[0].length);
  }
}

function mergeAdjacentText(segments: TemplateSegment[]): TemplateSegment[] {
  const merged: TemplateSegment[] = [];
  for (const segment of segments) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.type === "text" &&
      segment.type === "text" &&
      previous.bold === segment.bold &&
      previous.italic === segment.italic
    ) {
      previous.text += segment.text;
    } else {
      merged.push({ ...segment });
    }
  }
  return merged;
}

export function renderTemplateSegments(
  body: string,
  values: TemplateVariableValues = {},
): TemplateSegment[] {
  const variableNames: string[] = [];
  const encoded = body.replace(/[]/g, "").replace(VARIABLE_PATTERN, (_match, name) => {
    variableNames.push(name);
    return `${variableNames.length - 1}`;
  });
  const segments: TemplateSegment[] = [];
  parseFormatted(segments, encoded, { bold: false, italic: false }, variableNames, values);
  return mergeAdjacentText(segments);
}

export function renderTemplatePlainText(body: string, values: TemplateVariableValues = {}): string {
  return renderTemplateSegments(body, values)
    .map((segment) =>
      segment.type === "text" ? segment.text : (segment.value ?? `{{${segment.name}}}`),
    )
    .join("");
}
