export type PlanningVisualType = "post" | "carousel" | "stories" | "video" | "photos" | "traffic";

export type PlanningVisualSubItem = {
  label: string;
  text: string;
  index: number;
};

export type PlanningVisualItem = {
  id: string;
  date: string;
  displayDate: string;
  year: number | null;
  weekday: string;
  type: PlanningVisualType;
  typeLabel: string;
  objective: string;
  theme: string;
  caption: string;
  script: string;
  slides: PlanningVisualSubItem[];
  stories: PlanningVisualSubItem[];
  scenes: PlanningVisualSubItem[];
  storyFormat?: string;
  weekNumber?: number | null;
  weekTheme?: string;
  content?: string;
  rawText: string;
  sourceSection: string;
  sourceStartLine?: number;
  sourceEndLine?: number;
  sortValue: number | null;
};

export type PlanningVisualSectionKey = keyof PlanningVisualSections;

export type PlanningVisualEditValues = {
  date: string;
  weekday: string;
  typeLabel: string;
  theme: string;
  objective: string;
  caption: string;
  script: string;
  slides: PlanningVisualSubItem[];
  stories: PlanningVisualSubItem[];
  scenes: PlanningVisualSubItem[];
  storyFormat?: string;
  content?: string;
};

export type PlanningVisualSections = {
  posts: string;
  carousels: string;
  stories: string;
  videos: string;
  photos: string;
  paidTraffic: string;
};

type ParsedDate = {
  date: string;
  displayDate: string;
  year: number | null;
  day: number;
  month: number;
};

type ParsedHeader = ParsedDate & {
  weekday: string;
  type: PlanningVisualType;
  typeLabel: string;
};

type MarkerTarget =
  | "objective"
  | "theme"
  | "caption"
  | "script"
  | { group: "slides" | "stories" | "scenes"; index: number; label: string };

type HeaderMatch = {
  text: string;
  index: number;
  length: number;
};

const sectionOrder: Array<keyof PlanningVisualSections> = [
  "posts",
  "carousels",
  "stories",
  "videos",
  "photos",
  "paidTraffic",
];

const blockElements = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "div",
  "figcaption",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "li",
  "main",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "td",
  "th",
  "tr",
  "ul",
]);

const typePattern =
  "POSTS?|CARROSSEL|CARROSSEIS|CARROSSÉIS|STOR(?:Y|IES)|V[IÍ]DEOS?|VIDEOS?|REELS?|FOTOS?|TR[AÁ]FEGO\\s+PAGO|TRAFEGO\\s+PAGO";
const flexibleDatePattern =
  "((?:\\d\\s*){1,2}\\/\\s*(?:\\d\\s*){1,2}(?:\\/\\s*(?:\\d\\s*){2,4})?)";

const itemHeaderPattern = new RegExp(
  `^\\s*${flexibleDatePattern}\\s*(?:\\(([^)]+)\\))?\\s*(?:[-–—|])?\\s*(${typePattern})\\b`,
  "iu",
);
const storyWeekHeaderPattern = new RegExp(
  "^\\s*semana\\s+(\\d+)\\s*(?:[-–—|])?\\s*tema\\s*:\\s*(.+)$",
  "i",
);
const storyScheduleLinePattern = new RegExp(
  `^\\s*${flexibleDatePattern}\\s*(?:\\(([^)]+)\\))?\\s*(?:[-–—|])\\s*(.+)$`,
  "iu",
);
const knownStoryFormats = [
  "Dica prática",
  "Prova social",
  "Pergunta rápida",
  "Caixinha de pergunta",
  "Caixinha",
  "Bastidor",
  "Enquete",
  "Aviso",
  "CTA",
  "Quiz",
  "Checklist",
  "Chamada",
  "Interação",
  "Depoimento",
];

function createGlobalHeaderPattern() {
  return new RegExp(
    `${flexibleDatePattern}[\\s\\r\\n]*(?:\\(([^)]+)\\))?[\\s\\r\\n]*(?:[-–—|])?[\\s\\r\\n]*(${typePattern})\\b`,
    "giu",
  );
}

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function cleanLine(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[‐‑‒]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePlanningText(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[‐‑‒]/g, "-")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim();
}

function textToPlainLines(text: string): string[] {
  return normalizePlanningText(text).split("\n").map(cleanLine).filter(Boolean);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function plainLinesToHtml(lines: string[]) {
  return lines
    .map((line) => {
      if (!line.trim()) {
        return "<p></p>";
      }

      return `<p>${escapeHtml(line)}</p>`;
    })
    .join("");
}

function parseDateParts(value: string): ParsedDate | null {
  const compactValue = cleanLine(value).replace(/\s+/g, "");
  const parts = compactValue.split("/");

  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const rawYear = parts[2];
  let year: number | null = null;

  if (!Number.isInteger(day) || !Number.isInteger(month) || day < 1 || day > 31 || month < 1 || month > 12) {
    return null;
  }

  if (rawYear) {
    if (!/^\d{2}$|^\d{4}$/.test(rawYear)) {
      return null;
    }

    year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
  }

  const displayDate = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;

  return {
    date: year ? `${displayDate}/${year}` : displayDate,
    displayDate,
    year,
    day,
    month,
  };
}

function normalizeWeekday(value?: string) {
  const cleanValue = cleanLine(value || "");

  if (!cleanValue) {
    return "";
  }

  return cleanValue
    .split(/(\s|-)/)
    .map((part) => {
      if (part === " " || part === "-") {
        return part;
      }

      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
}

function normalizeType(type: string): { type: PlanningVisualType; typeLabel: string } | null {
  const normalized = stripAccents(type).trim().toUpperCase();

  if (normalized === "POST" || normalized === "POSTS") {
    return { type: "post", typeLabel: "POST" };
  }

  if (normalized === "CARROSSEL" || normalized === "CARROSSEIS") {
    return { type: "carousel", typeLabel: "CARROSSEL" };
  }

  if (normalized === "STORY" || normalized === "STORIES") {
    return { type: "stories", typeLabel: "STORIES" };
  }

  if (
    normalized === "VIDEO" ||
    normalized === "VIDEOS" ||
    normalized === "REEL" ||
    normalized === "REELS"
  ) {
    return { type: "video", typeLabel: "VÍDEO" };
  }

  if (normalized === "FOTO" || normalized === "FOTOS") {
    return { type: "photos", typeLabel: "FOTOS" };
  }

  if (normalized === "TRAFEGO PAGO") {
    return { type: "traffic", typeLabel: "TRÁFEGO PAGO" };
  }

  return null;
}

function normalizeForComparison(value: string) {
  return stripAccents(cleanLine(value)).toLowerCase();
}

function firstWords(value: string, count: number) {
  return cleanLine(value).split(/\s+/).slice(0, count).join(" ");
}

function parseStoryWeekHeader(line: string) {
  const match = cleanLine(line).match(storyWeekHeaderPattern);

  if (!match) {
    return null;
  }

  return {
    weekNumber: Number(match[1]),
    weekTheme: cleanLine(match[2]),
  };
}

function splitStoryFormatAndText(value: string) {
  const cleanValue = cleanLine(value);
  const colonMatch = cleanValue.match(/^([^:]{2,48})\s*:\s*(.+)$/);

  if (colonMatch) {
    return {
      storyFormat: cleanLine(colonMatch[1]),
      text: cleanLine(colonMatch[2]),
    };
  }

  const normalizedValue = normalizeForComparison(cleanValue);
  const matchingFormat = knownStoryFormats
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((format) => {
      const normalizedFormat = normalizeForComparison(format);

      return normalizedValue === normalizedFormat || normalizedValue.startsWith(`${normalizedFormat} `);
    });

  if (matchingFormat) {
    const storyFormat = cleanValue.slice(0, matchingFormat.length).trim();
    const text = cleanValue.slice(matchingFormat.length).trim();

    return {
      storyFormat,
      text,
    };
  }

  const words = cleanValue.split(/\s+/);
  const formatWordCount = words.length > 2 ? 2 : 1;

  return {
    storyFormat: firstWords(cleanValue, formatWordCount) || "Story",
    text: words.slice(formatWordCount).join(" ").trim() || cleanValue,
  };
}

function decodeBasicEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'");
}

export function htmlToPlainLines(html: string): string[] {
  if (!html) {
    return [];
  }

  if (typeof DOMParser === "undefined") {
    return textToPlainLines(
      decodeBasicEntities(html)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|li|h[1-6]|ul|ol|pre|tr|td|th)>/gi, "\n")
        .replace(/<[^>]+>/g, " "),
    );
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  const chunks: string[] = [];

  function pushBreak() {
    const lastChunk = chunks[chunks.length - 1];

    if (lastChunk !== "\n") {
      chunks.push("\n");
    }
  }

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      chunks.push(node.textContent || "");
      return;
    }

    if (!(node instanceof HTMLElement)) {
      node.childNodes.forEach(walk);
      return;
    }

    const tagName = node.tagName.toLowerCase();

    if (tagName === "br") {
      pushBreak();
      return;
    }

    if (tagName === "li") {
      pushBreak();
    }

    node.childNodes.forEach(walk);

    if (blockElements.has(tagName)) {
      pushBreak();
    }
  }

  document.body.childNodes.forEach(walk);

  return textToPlainLines(chunks.join(""));
}

function parseHeader(line: string): ParsedHeader | null {
  const match = cleanLine(line).match(itemHeaderPattern);

  if (!match) {
    return null;
  }

  const date = parseDateParts(match[1]);
  const normalizedType = normalizeType(match[3]);

  if (!date || !normalizedType) {
    return null;
  }

  return {
    ...date,
    weekday: normalizeWeekday(match[2]),
    ...normalizedType,
  };
}

export function isItemHeader(line: string) {
  return Boolean(parseHeader(line));
}

function findHeaderMatches(fullText: string): HeaderMatch[] {
  const normalizedText = normalizePlanningText(fullText);
  const headerPattern = createGlobalHeaderPattern();
  const matches: HeaderMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = headerPattern.exec(normalizedText)) !== null) {
    matches.push({
      text: cleanLine(match[0]),
      index: match.index,
      length: match[0].length,
    });

    if (match.index === headerPattern.lastIndex) {
      headerPattern.lastIndex += 1;
    }
  }

  return matches;
}

function parseMarker(line: string): { target: MarkerTarget; value: string } | null {
  const match = cleanLine(line).match(/^([A-Za-zÀ-ÿ]+(?:\s+\d+)?)\s*:\s*(.*)$/i);

  if (!match) {
    return null;
  }

  const rawLabel = match[1].replace(/\s+/g, " ").trim();
  const normalizedLabel = stripAccents(rawLabel).toUpperCase();
  const value = match[2].trim();

  if (normalizedLabel === "OBJETIVO") {
    return { target: "objective", value };
  }

  if (normalizedLabel === "TEMA") {
    return { target: "theme", value };
  }

  if (normalizedLabel === "LEGENDA") {
    return { target: "caption", value };
  }

  if (normalizedLabel === "ROTEIRO" || normalizedLabel === "SCRIPT") {
    return { target: "script", value };
  }

  const numberedMatch = normalizedLabel.match(/^(SLIDE|STORY|CENA)\s+(\d+)$/);

  if (!numberedMatch) {
    return null;
  }

  const [, groupName, indexValue] = numberedMatch;
  const index = Number(indexValue);

  if (groupName === "SLIDE") {
    return { target: { group: "slides", index, label: `Slide ${index}` }, value };
  }

  if (groupName === "STORY") {
    return { target: { group: "stories", index, label: `Story ${index}` }, value };
  }

  return { target: { group: "scenes", index, label: `Cena ${index}` }, value };
}

function appendValue(currentValue: string, nextLine: string) {
  return [currentValue, nextLine].filter(Boolean).join("\n");
}

function findSubItem(items: PlanningVisualSubItem[], marker: Extract<MarkerTarget, object>) {
  let item = items.find((candidate) => candidate.index === marker.index);

  if (!item) {
    item = {
      label: marker.label,
      text: "",
      index: marker.index,
    };
    items.push(item);
    items.sort((a, b) => a.index - b.index);
  }

  return item;
}

function setMarkerValue(
  fields: {
    objective: string;
    theme: string;
    caption: string;
    script: string;
    slides: PlanningVisualSubItem[];
    stories: PlanningVisualSubItem[];
    scenes: PlanningVisualSubItem[];
  },
  target: MarkerTarget,
  value: string,
) {
  if (typeof target === "string") {
    fields[target] = value;
    return;
  }

  findSubItem(fields[target.group], target).text = value;
}

function appendMarkerValue(
  fields: {
    objective: string;
    theme: string;
    caption: string;
    script: string;
    slides: PlanningVisualSubItem[];
    stories: PlanningVisualSubItem[];
    scenes: PlanningVisualSubItem[];
  },
  target: MarkerTarget,
  value: string,
) {
  if (typeof target === "string") {
    fields[target] = appendValue(fields[target], value);
    return;
  }

  const item = findSubItem(fields[target.group], target);
  item.text = appendValue(item.text, value);
}

function firstLine(value: string) {
  return value.split("\n").map((line) => line.trim()).find(Boolean) || "";
}

function firstCaptionSentence(caption: string) {
  const line = firstLine(caption);

  if (!line) {
    return "";
  }

  const sentenceMatch = line.match(/^(.+?[.!?])(?:\s|$)/);

  return sentenceMatch?.[1] || line;
}

function fallbackThemeForType(type: PlanningVisualType) {
  if (type === "carousel") {
    return "Carrossel sem tema";
  }

  if (type === "stories") {
    return "Stories sem tema";
  }

  return "Tema não informado";
}

function resolveTheme(
  fields: {
    theme: string;
    caption: string;
    script: string;
    slides: PlanningVisualSubItem[];
    stories: PlanningVisualSubItem[];
  },
  type: PlanningVisualType,
) {
  return (
    fields.theme.trim() ||
    fields.slides[0]?.text.trim() ||
    fields.stories[0]?.text.trim() ||
    firstLine(fields.script) ||
    firstCaptionSentence(fields.caption) ||
    fallbackThemeForType(type)
  );
}

export function dateSortValue(date: string) {
  const parsedDate = parseDateParts(date);

  if (!parsedDate) {
    return null;
  }

  const year = parsedDate.year || new Date().getFullYear();

  return year * 10000 + parsedDate.month * 100 + parsedDate.day;
}

export function weekdayForDisplayDate(date: string, year = new Date().getFullYear()) {
  const parsedDateParts = parseDateParts(date);

  if (!parsedDateParts) {
    return "";
  }

  const parsedYear = parsedDateParts.year || year;
  const parsedDate = new Date(parsedYear, parsedDateParts.month - 1, parsedDateParts.day);

  if (
    parsedDate.getFullYear() !== parsedYear ||
    parsedDate.getMonth() !== parsedDateParts.month - 1 ||
    parsedDate.getDate() !== parsedDateParts.day
  ) {
    return "";
  }

  return [
    "DOMINGO",
    "SEGUNDA",
    "TERÇA",
    "QUARTA",
    "QUINTA",
    "SEXTA",
    "SÁBADO",
  ][parsedDate.getDay()];
}

export function parseItemBlock(
  headerLine: string,
  bodyLines: string[],
  sourceSection = "document",
  blockIndex = 0,
  sourceStartLine?: number,
  sourceEndLine?: number,
): PlanningVisualItem | null {
  const header = parseHeader(headerLine);

  if (!header) {
    return null;
  }

  const fields = {
    objective: "",
    theme: "",
    caption: "",
    script: "",
    slides: [] as PlanningVisualSubItem[],
    stories: [] as PlanningVisualSubItem[],
    scenes: [] as PlanningVisualSubItem[],
  };
  let activeTarget: MarkerTarget | null = null;

  bodyLines.map(cleanLine).filter(Boolean).forEach((line) => {
    const marker = parseMarker(line);

    if (marker) {
      activeTarget = marker.target;
      setMarkerValue(fields, marker.target, marker.value);
      return;
    }

    if (activeTarget) {
      appendMarkerValue(fields, activeTarget, line);
    }
  });

  return {
    id: `${sourceSection}-${blockIndex}-${header.date}-${header.type}`,
    date: header.date,
    displayDate: header.displayDate,
    year: header.year,
    weekday: header.weekday,
    type: header.type,
    typeLabel: header.typeLabel,
    objective: fields.objective.trim(),
    theme: resolveTheme(fields, header.type),
    caption: fields.caption.trim(),
    script: fields.script.trim(),
    slides: fields.slides.filter((slide) => slide.text.trim()),
    stories: fields.stories.filter((story) => story.text.trim()),
    scenes: fields.scenes.filter((scene) => scene.text.trim()),
    rawText: [headerLine, ...bodyLines].join("\n"),
    sourceSection,
    sourceStartLine,
    sourceEndLine,
    sortValue: dateSortValue(header.date),
  };
}

function parseStoriesScheduleLine(
  line: string,
  currentWeek: { weekNumber: number | null; weekTheme: string },
  itemIndex: number,
  sourceLine?: number,
): PlanningVisualItem | null {
  if (isItemHeader(line)) {
    return null;
  }

  const match = cleanLine(line).match(storyScheduleLinePattern);

  if (!match) {
    return null;
  }

  const date = parseDateParts(match[1]);

  if (!date) {
    return null;
  }

  const { storyFormat, text } = splitStoryFormatAndText(match[3]);
  const storyText = cleanLine(text);
  const cleanStoryFormat = cleanLine(storyFormat);

  if (!storyText) {
    return null;
  }

  return {
    id: `stories-schedule-${itemIndex}-${date.date}-${cleanStoryFormat}`,
    date: date.date,
    displayDate: date.displayDate,
    year: date.year,
    weekday: normalizeWeekday(match[2]),
    type: "stories",
    typeLabel: "STORIES",
    objective: "",
    theme: cleanStoryFormat || firstCaptionSentence(storyText) || currentWeek.weekTheme || "Stories sem tema",
    caption: storyText,
    script: "",
    slides: [],
    stories: [
      {
        label: cleanStoryFormat || "Story",
        text: storyText,
        index: 1,
      },
    ],
    scenes: [],
    storyFormat: cleanStoryFormat,
    weekNumber: currentWeek.weekNumber,
    weekTheme: currentWeek.weekTheme,
    content: storyText,
    rawText: line,
    sourceSection: "stories",
    sourceStartLine: sourceLine,
    sourceEndLine: sourceLine,
    sortValue: dateSortValue(date.date),
  };
}

function parseStoriesScheduleContent(htmlOrText: string) {
  const lines = htmlToPlainLines(htmlOrText);
  const currentWeek = {
    weekNumber: null as number | null,
    weekTheme: "",
  };
  const items: PlanningVisualItem[] = [];

  lines.forEach((line, lineIndex) => {
    const weekHeader = parseStoryWeekHeader(line);

    if (weekHeader) {
      currentWeek.weekNumber = weekHeader.weekNumber;
      currentWeek.weekTheme = weekHeader.weekTheme;
      return;
    }

    const item = parseStoriesScheduleLine(line, currentWeek, items.length, lineIndex);

    if (item) {
      items.push(item);
    }
  });

  return items;
}

function findStoriesScheduleHeaders(htmlOrText: string) {
  const lines = htmlToPlainLines(htmlOrText);
  const currentWeek = {
    weekNumber: null as number | null,
    weekTheme: "",
  };

  return lines.filter((line) => {
    const weekHeader = parseStoryWeekHeader(line);

    if (weekHeader) {
      currentWeek.weekNumber = weekHeader.weekNumber;
      currentWeek.weekTheme = weekHeader.weekTheme;
      return true;
    }

    return Boolean(parseStoriesScheduleLine(line, currentWeek, 0));
  });
}

function parseBlocksFromLines(lines: string[]) {
  const blocks: Array<{ header: string; body: string[]; startLine: number; endLine: number }> = [];

  lines.forEach((line, lineIndex) => {
    if (isItemHeader(line)) {
      const previousBlock = blocks[blocks.length - 1];

      if (previousBlock) {
        previousBlock.endLine = lineIndex - 1;
      }

      blocks.push({ header: line, body: [], startLine: lineIndex, endLine: lineIndex });
      return;
    }

    if (blocks.length) {
      const currentBlock = blocks[blocks.length - 1];
      currentBlock.body.push(line);
      currentBlock.endLine = lineIndex;
    }
  });

  return blocks;
}

function parseBlocksFromFullText(lines: string[]) {
  const fullText = normalizePlanningText(lines.join("\n"));
  const headers = findHeaderMatches(fullText);

  return headers.map((header, index) => {
    const nextHeader = headers[index + 1];
    const bodyText = fullText.slice(header.index + header.length, nextHeader?.index ?? fullText.length);

    return {
      header: header.text,
      body: textToPlainLines(bodyText),
      startLine: undefined,
      endLine: undefined,
    };
  });
}

export function parsePlanningContent(htmlOrText: string, sourceSection = "document") {
  const lines = htmlToPlainLines(htmlOrText);
  const lineBlocks = parseBlocksFromLines(lines);
  const blocks = lineBlocks.length ? lineBlocks : parseBlocksFromFullText(lines);

  return blocks
    .map((block, index) =>
      parseItemBlock(block.header, block.body, sourceSection, index, block.startLine, block.endLine),
    )
    .filter((item): item is PlanningVisualItem => Boolean(item));
}

function compactLines(lines: string[]) {
  return lines.map(cleanLine).filter(Boolean);
}

function findLineSequence(lines: string[], sequence: string[]) {
  const cleanLines = compactLines(lines);
  const cleanSequence = compactLines(sequence);

  if (!cleanSequence.length || cleanSequence.length > cleanLines.length) {
    return null;
  }

  for (let index = 0; index <= cleanLines.length - cleanSequence.length; index += 1) {
    const matches = cleanSequence.every((line, sequenceIndex) => cleanLines[index + sequenceIndex] === line);

    if (matches) {
      return {
        start: index,
        end: index + cleanSequence.length - 1,
      };
    }
  }

  return null;
}

function normalizeSubItems(items: PlanningVisualSubItem[]) {
  return items
    .map((item, index) => ({
      label: item.label || `Item ${index + 1}`,
      text: cleanLine(item.text),
      index: item.index || index + 1,
    }))
    .filter((item) => item.text);
}

function buildStandardItemLines(item: PlanningVisualItem, values: PlanningVisualEditValues) {
  const date = cleanLine(values.date || item.displayDate || item.date);
  const weekday = cleanLine(values.weekday || item.weekday);
  const typeLabel = cleanLine(values.typeLabel || item.typeLabel).toUpperCase();
  const headerLine = `${date}${weekday ? ` (${weekday})` : ""} — ${typeLabel}`;
  const lines = [headerLine];
  const objective = cleanLine(values.objective);
  const theme = cleanLine(values.theme);
  const caption = values.caption.trim();
  const script = values.script.trim();

  if (objective) {
    lines.push(`OBJETIVO: ${objective}`);
  }

  if (theme && item.type !== "carousel" && item.type !== "stories") {
    lines.push(`TEMA: ${theme}`);
  }

  if (theme && item.type === "post") {
    const existingThemeIndex = lines.findIndex((line) => stripAccents(line).toUpperCase().startsWith("TEMA:"));

    if (existingThemeIndex === -1) {
      lines.push(`TEMA: ${theme}`);
    }
  }

  if (item.type === "carousel") {
    normalizeSubItems(values.slides).forEach((slide, index) => {
      lines.push(`Slide ${slide.index || index + 1}: ${slide.text}`);
    });

    if (!values.slides.length && theme) {
      lines.push(`Slide 1: ${theme}`);
    }
  }

  if (item.type === "stories") {
    normalizeSubItems(values.stories).forEach((story, index) => {
      lines.push(`Story ${story.index || index + 1}: ${story.text}`);
    });

    if (!values.stories.length && theme) {
      lines.push(`Story 1: ${theme}`);
    }
  }

  if (item.type === "video" && script) {
    lines.push("ROTEIRO:");
    lines.push(...compactLines(script.split("\n")));
  }

  if (caption) {
    lines.push("LEGENDA:");
    lines.push(...compactLines(caption.split("\n")));
  }

  return lines;
}

function buildStoriesScheduleLine(item: PlanningVisualItem, values: PlanningVisualEditValues) {
  const storyFormat = cleanLine(values.storyFormat || item.storyFormat || item.theme || "Story");
  const content = cleanLine(values.content || values.caption || item.content || item.caption);
  const date = cleanLine(values.date || item.date || item.displayDate);
  const weekdayValue = cleanLine(values.weekday || item.weekday);
  const weekday = weekdayValue ? ` (${weekdayValue})` : "";

  return `${date}${weekday} — ${storyFormat} ${content}`.trim();
}

function buildUpdatedItemLines(item: PlanningVisualItem, values: PlanningVisualEditValues) {
  if (item.storyFormat || item.content) {
    return [buildStoriesScheduleLine(item, values)];
  }

  return buildStandardItemLines(item, values);
}

export function updatePlanningVisualItemInSections(
  sections: Partial<PlanningVisualSections>,
  item: PlanningVisualItem,
  values: PlanningVisualEditValues,
): PlanningVisualSections {
  const sectionKey = item.sourceSection as PlanningVisualSectionKey;
  const normalizedSections: PlanningVisualSections = {
    posts: sections.posts || "",
    carousels: sections.carousels || "",
    stories: sections.stories || "",
    videos: sections.videos || "",
    photos: sections.photos || "",
    paidTraffic: sections.paidTraffic || "",
  };

  if (!sectionOrder.includes(sectionKey)) {
    return normalizedSections;
  }

  const currentLines = htmlToPlainLines(normalizedSections[sectionKey]);
  const replacementLines = buildUpdatedItemLines(item, values);
  const rawLines = textToPlainLines(item.rawText);
  const sequenceRange = findLineSequence(currentLines, rawLines);
  const startLine = sequenceRange?.start ?? item.sourceStartLine;
  const endLine = sequenceRange?.end ?? item.sourceEndLine ?? startLine;

  if (typeof startLine !== "number" || typeof endLine !== "number") {
    return normalizedSections;
  }

  const nextLines = [
    ...currentLines.slice(0, startLine),
    ...replacementLines,
    ...currentLines.slice(endLine + 1),
  ];

  return {
    ...normalizedSections,
    [sectionKey]: plainLinesToHtml(nextLines),
  };
}

export function parsePlanningSections(sections: Partial<PlanningVisualSections>) {
  const normalizedSections = {
    posts: sections.posts || "",
    carousels: sections.carousels || "",
    stories: sections.stories || "",
    videos: sections.videos || "",
    photos: sections.photos || "",
    paidTraffic: sections.paidTraffic || "",
  };
  const allLines = sectionOrder.flatMap((sectionKey) => htmlToPlainLines(normalizedSections[sectionKey]));
  const lineHeaders = allLines.filter(isItemHeader);
  const fallbackHeaders = findHeaderMatches(allLines.join("\n")).map((header) => header.text);
  const storiesScheduleHeaders = findStoriesScheduleHeaders(normalizedSections.stories);
  const headers = Array.from(new Set([...lineHeaders, ...fallbackHeaders, ...storiesScheduleHeaders]));
  const items = sectionOrder
    .flatMap((sectionKey) => {
      if (sectionKey === "stories") {
        return [
          ...parsePlanningContent(normalizedSections[sectionKey], sectionKey),
          ...parseStoriesScheduleContent(normalizedSections[sectionKey]),
        ];
      }

      return parsePlanningContent(normalizedSections[sectionKey], sectionKey);
    })
    .sort((a, b) => {
      if (a.sortValue === null && b.sortValue === null) {
        return 0;
      }

      if (a.sortValue === null) {
        return 1;
      }

      if (b.sortValue === null) {
        return -1;
      }

      return a.sortValue - b.sortValue;
    });

  if (process.env.NODE_ENV === "development") {
    console.log("VISUAL PARSER RAW CONTENTS", {
      postsLength: normalizedSections.posts.length,
      carouselsLength: normalizedSections.carousels.length,
      storiesLength: normalizedSections.stories.length,
      videosLength: normalizedSections.videos.length,
    });
    console.log("VISUAL PARSER LINES", allLines);
    console.log("VISUAL PARSER HEADERS FOUND", headers);
    console.log("VISUAL PARSER ITEMS", items);
  }

  return items;
}
