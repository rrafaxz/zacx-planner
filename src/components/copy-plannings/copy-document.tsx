"use client";

import { Extension, type Editor } from "@tiptap/core";
import { Color } from "@tiptap/extension-color";
import { FontFamily } from "@tiptap/extension-font-family";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Underline } from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import { Fragment, Slice } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { StarterKit } from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  RemoveFormatting,
  Redo2,
  UnderlineIcon,
  Undo2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent,
  type ReactNode,
  type SetStateAction,
} from "react";

import { useTheme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CopySectionKey = "posts" | "carousels" | "stories" | "videos";

export type CopyDocumentSections = Record<CopySectionKey, string>;
type CopySectionFieldName = "posts_content" | "carousels_content" | "stories_content" | "videos_content";

export const copySectionMeta: Array<{ key: CopySectionKey; label: string }> = [
  { key: "posts", label: "Posts" },
  { key: "carousels", label: "Carrosséis" },
  { key: "stories", label: "Stories" },
  { key: "videos", label: "Vídeos" },
];

export const copySectionFieldMap: Record<CopySectionKey, CopySectionFieldName> = {
  posts: "posts_content",
  carousels: "carousels_content",
  stories: "stories_content",
  videos: "videos_content",
};

export const emptyCopySections: CopyDocumentSections = {
  posts: "",
  carousels: "",
  stories: "",
  videos: "",
};

const fieldAliases: Record<CopySectionKey, string> = copySectionFieldMap;

const defaultTitles: Record<CopySectionKey, string> = {
  posts: "Planejamento dos Posts",
  carousels: "Planejamento dos Carrosséis",
  stories: "Planejamento dos Stories",
  videos: "Planejamento dos Vídeos",
};

const titleMatchers: Record<CopySectionKey, RegExp> = {
  posts: /^planejamento\s+dos\s+posts$/i,
  carousels: /^planejamento\s+dos\s+carross[eé]is$/i,
  stories: /^planejamento\s+dos\s+stories$/i,
  videos: /^planejamento\s+dos\s+v[ií]deos$/i,
};

const fontOptions = ["Poppins", "Montserrat", "Sora", "Arial", "Inter"];
const sizeOptions = ["7px", "8px", "9px", "10px", "11px", "12px", "14px", "16px", "18px", "20px", "24px", "30px", "36px", "48px", "60px", "72px", "96px"];
const weightOptions = [
  { label: "Light", value: "300" },
  { label: "Regular", value: "400" },
  { label: "Medium", value: "500" },
  { label: "SemiBold", value: "600" },
  { label: "Bold", value: "700" },
  { label: "ExtraBold", value: "800" },
];

const darkAccent = "#DFFF06";
const lightAccent = "#1D10D7";
const emptyContent = "<p></p>";
const bodyColorToken = "body";
const accentColorToken = "accent";
const transferableTextStyleProperties = [
  "color",
  "background-color",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "line-height",
  "text-decoration",
  "text-decoration-line",
];

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }

              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

const FontWeight = Extension.create({
  name: "fontWeight",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontWeight: {
            default: null,
            parseHTML: (element) => element.style.fontWeight || null,
            renderHTML: (attributes) => {
              if (!attributes.fontWeight) {
                return {};
              }

              return { style: `font-weight: ${attributes.fontWeight}` };
            },
          },
        },
      },
    ];
  },
});

const BackgroundColor = Extension.create({
  name: "backgroundColor",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          backgroundColor: {
            default: null,
            parseHTML: (element) => element.style.backgroundColor || null,
            renderHTML: (attributes) => {
              if (!attributes.backgroundColor) {
                return {};
              }

              return { style: `background-color: ${attributes.backgroundColor}` };
            },
          },
        },
      },
    ];
  },
});

const TextDecorationAndSpacing = Extension.create({
  name: "textDecorationAndSpacing",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          textDecoration: {
            default: null,
            parseHTML: (element) => element.style.textDecoration || element.style.textDecorationLine || null,
            renderHTML: (attributes) => {
              if (!attributes.textDecoration) {
                return {};
              }

              return { style: `text-decoration: ${attributes.textDecoration}` };
            },
          },
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) {
                return {};
              }

              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
        },
      },
    ];
  },
});

const SemanticColor = Extension.create({
  name: "semanticColor",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          colorToken: {
            default: null,
            parseHTML: (element) => {
              const token = element.getAttribute("data-color-token");

              if (token === bodyColorToken || token === accentColorToken) {
                return token;
              }

              return null;
            },
            renderHTML: (attributes) => {
              if (attributes.colorToken !== bodyColorToken && attributes.colorToken !== accentColorToken) {
                return {};
              }

              return { "data-color-token": attributes.colorToken };
            },
          },
        },
      },
    ];
  },
});

const DocumentHeaderAttributes = Extension.create({
  name: "documentHeaderAttributes",
  addGlobalAttributes() {
    return [
      {
        types: ["heading", "paragraph"],
        attributes: {
          zacxDocTitle: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-zacx-doc-title") || null,
            renderHTML: (attributes) => {
              if (!attributes.zacxDocTitle) {
                return {};
              }

              return { "data-zacx-doc-title": attributes.zacxDocTitle };
            },
          },
          zacxDocClient: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-zacx-doc-client") || null,
            renderHTML: (attributes) => {
              if (!attributes.zacxDocClient) {
                return {};
              }

              return { "data-zacx-doc-client": "true" };
            },
          },
        },
      },
    ];
  },
});

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function plainTextToHtml(text: string) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  return lines.map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`).join("");
}

function mergeInlineStyle(element: HTMLElement, cssText: string) {
  const currentStyle = element.getAttribute("style") || "";
  element.setAttribute("style", `${cssText};${currentStyle}`);
}

function inlineClassStyles(document: Document) {
  const styleText = Array.from(document.querySelectorAll("style"))
    .map((style) => style.textContent || "")
    .join("\n");

  if (!styleText.trim()) {
    return;
  }

  const classRules = new Map<string, string>();
  const classRulePattern = /([^{}]+)\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = classRulePattern.exec(styleText))) {
    const [, selectorList, declarations] = match;

    selectorList.split(",").forEach((selector) => {
      const classMatch = selector.trim().match(/^\.([_a-zA-Z][\w-]*)$/);

      if (!classMatch) {
        return;
      }

      const className = classMatch[1];
      const existing = classRules.get(className);
      classRules.set(className, existing ? `${existing};${declarations}` : declarations);
    });
  }

  if (!classRules.size) {
    return;
  }

  document.body.querySelectorAll<HTMLElement>("[class]").forEach((element) => {
    const declarations = Array.from(element.classList)
      .map((className) => classRules.get(className))
      .filter(Boolean)
      .join(";");

    if (declarations) {
      mergeInlineStyle(element, declarations);
    }
  });
}

function getTransferableTextStyle(element: HTMLElement) {
  return transferableTextStyleProperties
    .map((property) => {
      const value = element.style.getPropertyValue(property);

      return value ? `${property}: ${value}` : "";
    })
    .filter(Boolean)
    .join("; ");
}

function moveBlockTextStylesToInlineSpans(document: Document) {
  const selector = "p, div, li, h1, h2, h3, h4, h5, h6";

  document.body.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    const textStyle = getTransferableTextStyle(element);

    if (!textStyle || !element.childNodes.length) {
      return;
    }

    const span = document.createElement("span");
    span.setAttribute("style", textStyle);

    while (element.firstChild) {
      span.appendChild(element.firstChild);
    }

    element.appendChild(span);
    transferableTextStyleProperties.forEach((property) => element.style.removeProperty(property));

    if (!element.getAttribute("style")?.trim()) {
      element.removeAttribute("style");
    }
  });
}

export function sanitizeHtml(html?: string | null) {
  if (!html) {
    return "";
  }

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  const blockedSelectors = ["script", "style", "iframe", "object", "embed", "link", "meta"];

  inlineClassStyles(document);
  moveBlockTextStylesToInlineSpans(document);

  blockedSelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => node.remove());
  });

  document.body.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.toLowerCase();

      if (name.startsWith("on")) {
        node.removeAttribute(attribute.name);
      }

      if ((name === "href" || name === "src") && value.startsWith("javascript:")) {
        node.removeAttribute(attribute.name);
      }

      if (name === "style" && (value.includes("javascript:") || value.includes("expression("))) {
        node.removeAttribute(attribute.name);
      }
    });
  });

  return document.body.innerHTML;
}

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

function parseColorValue(color?: string | null): RgbColor | null {
  if (!color) {
    return null;
  }

  const value = color.trim().toLowerCase();
  const hexMatch = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

  if (hexMatch) {
    const hex = hexMatch[1];
    const normalizedHex =
      hex.length === 3
        ? hex
            .split("")
            .map((part) => `${part}${part}`)
            .join("")
        : hex;

    return {
      r: Number.parseInt(normalizedHex.slice(0, 2), 16),
      g: Number.parseInt(normalizedHex.slice(2, 4), 16),
      b: Number.parseInt(normalizedHex.slice(4, 6), 16),
    };
  }

  const rgbMatch = value.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);

  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    };
  }

  const namedColors: Record<string, RgbColor> = {
    black: { r: 0, g: 0, b: 0 },
    white: { r: 255, g: 255, b: 255 },
  };

  return namedColors[value] ?? null;
}

function isNearColor(color: RgbColor, target: RgbColor, tolerance = 24) {
  return (
    Math.abs(color.r - target.r) <= tolerance &&
    Math.abs(color.g - target.g) <= tolerance &&
    Math.abs(color.b - target.b) <= tolerance
  );
}

function classifySemanticColor(color?: string | null): typeof bodyColorToken | typeof accentColorToken | null {
  const rgb = parseColorValue(color);

  if (!rgb) {
    return null;
  }

  const isBlack = rgb.r <= 35 && rgb.g <= 35 && rgb.b <= 35;
  const isWhite = rgb.r >= 235 && rgb.g >= 235 && rgb.b >= 235;

  if (isBlack || isWhite) {
    return bodyColorToken;
  }

  const isSystemGreen = isNearColor(rgb, { r: 163, g: 230, b: 53 }, 28);
  const isSystemBlue = isNearColor(rgb, { r: 0, g: 91, b: 255 }, 28) || isNearColor(rgb, { r: 0, g: 75, b: 255 }, 28);

  if (isSystemGreen || isSystemBlue) {
    return accentColorToken;
  }

  return null;
}

function removeStyleProperty(element: HTMLElement, property: string) {
  element.style.removeProperty(property);

  if (!element.getAttribute("style")?.trim()) {
    element.removeAttribute("style");
  }
}

function normalizeSemanticColors(html: string) {
  if (!html || typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");

  document.body.querySelectorAll("*").forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    const existingToken = node.getAttribute("data-color-token");

    if (existingToken === bodyColorToken || existingToken === accentColorToken) {
      removeStyleProperty(node, "color");
    }
  });

  return document.body.innerHTML;
}

function isEffectivelyEmpty(html?: string | null) {
  if (!html) {
    return true;
  }

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html.replace(/<[^>]*>/g, "").trim().length === 0;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  const text = document.body.textContent?.replace(/\u00a0/g, " ").trim() ?? "";
  const media = document.body.querySelector("img, video, iframe");

  return text.length === 0 && !media;
}

function normalizeLooseText(value?: string | null) {
  return stripAccents(value?.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toLowerCase() || "");
}

function firstMeaningfulElement(body: HTMLElement) {
  return Array.from(body.children).find((child): child is HTMLElement => {
    if (!(child instanceof HTMLElement)) {
      return false;
    }

    return Boolean(child.textContent?.replace(/\u00a0/g, " ").trim() || child.querySelector("img, video, iframe"));
  });
}

function isDefaultHeaderTitle(value?: string | null) {
  const normalizedValue = normalizeLooseText(value);

  return copySectionMeta.some(({ key }) => titleMatchers[key].test(normalizedValue));
}

function stripFixedDocumentHeader(html: string, sectionKey: CopySectionKey, clientName?: string) {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(html || emptyContent, "text/html");
  const body = document.body;

  body.querySelectorAll("[data-zacx-doc-title], [data-zacx-doc-client]").forEach((element) => {
    element.remove();
  });

  const firstElement = firstMeaningfulElement(body);

  if (firstElement) {
    const firstText = firstElement.textContent?.replace(/\u00a0/g, " ").trim() ?? "";

    if (titleMatchers[sectionKey].test(normalizeLooseText(firstText)) || isDefaultHeaderTitle(firstText)) {
      firstElement.remove();

      const possibleClient = firstMeaningfulElement(body);
      const normalizedClientName = normalizeLooseText(clientName);
      const possibleClientText = normalizeLooseText(possibleClient?.textContent);

      if (possibleClient && normalizedClientName && possibleClientText === normalizedClientName) {
        possibleClient.remove();
      }
    }
  }

  return body.innerHTML;
}

function normalizeDocumentHtml(html: string, sectionKey: CopySectionKey, clientName?: string, theme: "dark" | "light" = "dark") {
  void theme;

  return stripFixedDocumentHeader(normalizeSemanticColors(sanitizeHtml(html)), sectionKey, clientName);
}

export function cleanCopySectionHtml(sectionKey: CopySectionKey, html?: string | null, clientName?: string) {
  return normalizeDocumentHtml(html || emptyContent, sectionKey, clientName);
}

export function hasSectionContent(html?: string | null) {
  const withoutFixedHeader = copySectionMeta.reduce(
    (currentHtml, section) => stripFixedDocumentHeader(currentHtml, section.key),
    html || "",
  );

  return !isEffectivelyEmpty(withoutFixedHeader);
}

function fromLegacyDocument(content?: string | null): CopyDocumentSections {
  if (!content) {
    return { ...emptyCopySections };
  }

  try {
    const parsed = JSON.parse(content) as Partial<CopyDocumentSections>;

    return {
      posts: parsed.posts ?? "",
      carousels: parsed.carousels ?? "",
      stories: parsed.stories ?? "",
      videos: parsed.videos ?? "",
    };
  } catch {
    return {
      ...emptyCopySections,
      posts: content,
    };
  }
}

export function parseCopyDocumentContent(source?: string | null | Record<string, unknown>): CopyDocumentSections {
  if (!source || typeof source === "string") {
    return fromLegacyDocument(source);
  }

  const sections = { ...emptyCopySections };

  copySectionMeta.forEach(({ key }) => {
    const value = source[key] ?? source[fieldAliases[key]];

    if (typeof value === "string") {
      sections[key] = value;
    }
  });

  if (!Object.values(sections).some((value) => value?.trim())) {
    const legacyDocument = source.document_content;

    if (typeof legacyDocument === "string") {
      return fromLegacyDocument(legacyDocument);
    }
  }

  return sections;
}

function insertPlainText(view: EditorView, text: string) {
  const { state, dispatch } = view;
  const nodes = text.replace(/\r\n?/g, "\n").split("\n").flatMap((line, index) => {
    const chunk = line ? [state.schema.text(line)] : [];

    if (index === 0) {
      return chunk;
    }

    return [state.schema.nodes.hardBreak.create(), ...chunk];
  });

  const fragment = Fragment.fromArray(nodes);
  dispatch(state.tr.replaceSelection(Slice.maxOpen(fragment)).scrollIntoView());
}

function isEditorReady(editor: Editor | null): editor is Editor {
  return Boolean(editor && !editor.isDestroyed);
}

function applyTextStyle(editor: Editor | null, attributes: Record<string, string | null>) {
  if (!isEditorReady(editor)) {
    return;
  }

  editor.chain().focus().setMark("textStyle", attributes).run();
}

function applySemanticColor(editor: Editor | null, token: typeof bodyColorToken | typeof accentColorToken) {
  applyTextStyle(editor, { color: null, colorToken: token });
}

function applyFixedColor(editor: Editor | null, color: string) {
  applyTextStyle(editor, { color, colorToken: null });
}

type EditorColorOption =
  | { swatch: string; label: string; token: typeof bodyColorToken | typeof accentColorToken; value?: never }
  | { swatch: string; label: string; value: string; token?: never };

function getColorOptions(theme: "dark" | "light"): EditorColorOption[] {
  const foreground = theme === "light" ? "#111827" : "#FFFFFF";
  const muted = theme === "light" ? "#6B7280" : "#D1D5DB";

  return [
    { swatch: theme === "light" ? lightAccent : darkAccent, label: "Destaque", token: accentColorToken },
    { swatch: "#EF4444", label: "Vermelho", value: "#EF4444" },
    { swatch: muted, label: "Cinza", value: muted },
    { swatch: foreground, label: theme === "light" ? "Texto preto" : "Texto branco", token: bodyColorToken },
  ];
}

type CopyDocumentProps = {
  value: CopyDocumentSections;
  onChange?: Dispatch<SetStateAction<CopyDocumentSections>>;
  editable?: boolean;
  activeSection?: CopySectionKey;
  sectionKeys?: CopySectionKey[];
  clientName?: string;
  emptyText?: string;
  sectionNavigation?: ReactNode;
  workspaceLayout?: boolean;
  toolbarClassName?: string;
  sectionNavigationClassName?: string;
};

type TiptapSectionProps = {
  sectionKey: CopySectionKey;
  html: string;
  editable: boolean;
  clientName?: string;
  emptyText?: string;
  theme: "dark" | "light";
  onChange?: Dispatch<SetStateAction<CopyDocumentSections>>;
  onActiveEditor: (editor: Editor | null) => void;
  onEditorReady: (editor: Editor) => void;
};

function TiptapSection({
  sectionKey,
  html,
  editable,
  clientName,
  emptyText,
  theme,
  onChange,
  onActiveEditor,
  onEditorReady,
}: TiptapSectionProps) {
  const [pasteHint, setPasteHint] = useState("");
  const plainPasteRef = useRef(false);
  const lastSyncedHtmlRef = useRef(normalizeDocumentHtml(html || emptyContent, sectionKey, clientName, theme));
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      TextStyle,
      FontFamily.configure({
        types: ["textStyle"],
      }),
      FontSize,
      FontWeight,
      BackgroundColor,
      TextDecorationAndSpacing,
      SemanticColor,
      DocumentHeaderAttributes,
      Color.configure({
        types: ["textStyle"],
      }),
      Link.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Placeholder.configure({
        placeholder: emptyText || "Escreva ou cole o conteudo desta secao.",
      }),
    ],
    [emptyText],
  );
  const normalizedHtml = useMemo(
    () => normalizeDocumentHtml(html || emptyContent, sectionKey, clientName, theme),
    [clientName, html, sectionKey, theme],
  );
  const editor = useEditor({
    extensions,
    content: normalizedHtml,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "copy-document-prosemirror",
        spellcheck: "true",
      },
      transformPastedHTML: (pastedHtml) => normalizeDocumentHtml(pastedHtml, sectionKey, clientName, theme),
      handleKeyDown: (_view, event) => {
        const key = event.key.toLowerCase();
        const isCommand = event.metaKey || event.ctrlKey;

        plainPasteRef.current = isCommand && event.shiftKey && key === "v";

        if (isCommand && key === "a") {
          if (!isEditorReady(editor)) {
            return false;
          }

          event.preventDefault();
          editor.commands.selectAll();
          return true;
        }

        return false;
      },
      handlePaste: (view, event) => {
        const pasteAsPlainText = plainPasteRef.current;
        plainPasteRef.current = false;

        if (!pasteAsPlainText) {
          const html = event.clipboardData?.getData("text/html");

          if (!html) {
            return false;
          }

          if (!isEditorReady(editor)) {
            return false;
          }

          event.preventDefault();
          editor.chain().focus().insertContent(normalizeDocumentHtml(html, sectionKey, clientName, theme)).run();
          return true;
        }

        if (!isEditorReady(editor)) {
          return false;
        }

        const text = event.clipboardData?.getData("text/plain");

        if (!text) {
          return false;
        }

        event.preventDefault();
        insertPlainText(view, text);

        return true;
      },
    },
    onCreate: ({ editor: createdEditor }) => {
      onEditorReady(createdEditor);
    },
    onFocus: ({ editor: focusedEditor }) => {
      onActiveEditor(focusedEditor);
    },
    onUpdate: ({ editor: updatedEditor }) => {
      const nextHtml = normalizeDocumentHtml(updatedEditor.getHTML(), sectionKey, clientName, theme);
      lastSyncedHtmlRef.current = nextHtml;
      onChange?.((current) => ({
        ...current,
        [sectionKey]: nextHtml,
      }));
    },
  });

  useEffect(() => {
    if (!isEditorReady(editor)) {
      return;
    }

    editor.setEditable(editable);
  }, [editable, editor]);

  useEffect(() => {
    if (!isEditorReady(editor)) {
      return;
    }

    if (normalizedHtml !== lastSyncedHtmlRef.current && normalizedHtml !== editor.getHTML()) {
      editor.commands.setContent(normalizedHtml || emptyContent, { emitUpdate: false });
      lastSyncedHtmlRef.current = normalizedHtml;
    }
  }, [editor, normalizedHtml]);

  useEffect(() => {
    return () => {
      onActiveEditor(null);
    };
  }, [onActiveEditor]);

  async function pasteFromClipboard(plain: boolean) {
    if (!isEditorReady(editor)) {
      return;
    }

    try {
      if (plain) {
        const text = await navigator.clipboard.readText();

        if (text && isEditorReady(editor)) {
          editor.chain().focus().insertContent(plainTextToHtml(text)).run();
        }

        return;
      }

      const clipboardItems = await navigator.clipboard.read();
      let htmlFromClipboard = "";
      let textFromClipboard = "";

      for (const item of clipboardItems) {
        if (item.types.includes("text/html")) {
          htmlFromClipboard = await (await item.getType("text/html")).text();
          break;
        }

        if (item.types.includes("text/plain")) {
          textFromClipboard = await (await item.getType("text/plain")).text();
        }
      }

      if (isEditorReady(editor)) {
      editor.chain().focus().insertContent(htmlFromClipboard ? normalizeDocumentHtml(htmlFromClipboard, sectionKey, clientName, theme) : plainTextToHtml(textFromClipboard)).run();
      }
    } catch {
      setPasteHint("Use Cmd+V para colar com formatacao ou Cmd+Shift+V para texto puro.");
    }
  }

  function handleContextMenu(event: MouseEvent<HTMLDivElement>) {
    if (!editable || !isEditorReady(editor)) {
      return;
    }

    event.preventDefault();
    const menu = document.createElement("div");
    const x = event.clientX;
    const y = event.clientY;

    menu.className =
      "fixed z-[100] min-w-48 overflow-hidden rounded-xl border border-black/10 bg-white p-1 text-sm text-neutral-900 shadow-sm dark:border-white/10 dark:bg-neutral-950 dark:text-white";
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const actions = [
      { label: "Colar com formatacao", action: () => pasteFromClipboard(false) },
      { label: "Colar texto puro", action: () => pasteFromClipboard(true) },
      {
        label: "Limpar formatacao",
        action: () => {
          if (!isEditorReady(editor)) {
            return;
          }

          editor.chain().focus().unsetAllMarks().run();
        },
      },
    ];

    actions.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "block w-full rounded-lg px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-white/10";
      button.textContent = item.label;
      button.onclick = () => {
        item.action();
        menu.remove();
      };
      menu.appendChild(button);
    });

    document.body.appendChild(menu);

    const close = () => {
      menu.remove();
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };

    requestAnimationFrame(() => {
      document.addEventListener("click", close);
      document.addEventListener("keydown", close);
    });
  }

  return (
    <div
      className={cn(
        "copy-document-editor rounded-[26px] border px-7 py-10 shadow-sm sm:px-12 sm:py-14 lg:px-16 lg:py-16",
        theme === "light" ? "copy-document-editor-light border-neutral-200 bg-white text-neutral-950" : "copy-document-editor-dark border-white/10 bg-black text-white",
      )}
    >
      <div contentEditable={false} className="copy-document-fixed-header select-none">
        <h2>{defaultTitles[sectionKey]}</h2>
        {clientName?.trim() ? <p>{clientName.trim()}</p> : null}
      </div>
      <div onContextMenu={handleContextMenu}>
        <EditorContent
          editor={editor}
          className={cn(
            "tiptap-copy-editor min-h-[68vh]",
            editable ? "cursor-text" : "",
            theme === "light" ? "text-neutral-950" : "text-white",
          )}
        />
      </div>
      {pasteHint ? <p className="mt-4 text-center text-xs text-muted-foreground">{pasteHint}</p> : null}
    </div>
  );
}

type ToolbarProps = {
  editor: Editor | null;
  theme: "dark" | "light";
  className?: string;
};

function Toolbar({ editor, theme, className }: ToolbarProps) {
  const colors = getColorOptions(theme);
  const editorReady = isEditorReady(editor);
  const canUndo = editorReady ? editor.can().undo() : false;
  const canRedo = editorReady ? editor.can().redo() : false;
  const isBoldActive = editorReady ? editor.isActive("bold") : false;
  const isItalicActive = editorReady ? editor.isActive("italic") : false;
  const isUnderlineActive = editorReady ? editor.isActive("underline") : false;
  const iconButtonClass =
    "h-9 w-9 shrink-0 rounded-xl border border-white/10 bg-white/5 p-0 text-muted-foreground transition hover:border-white/20 hover:bg-white/10 hover:text-foreground data-[active=true]:border-[var(--zacx-accent)] data-[active=true]:bg-[var(--zacx-accent)]/15 data-[active=true]:text-foreground dark:border-white/10";

  function runEditorCommand(command: (readyEditor: Editor) => void) {
    if (!isEditorReady(editor)) {
      return;
    }

    command(editor);
  }

  return (
    <div
      className={cn(
        "no-scrollbar sticky top-3 z-20 mb-4 flex flex-nowrap items-center gap-2 overflow-x-auto rounded-2xl border border-black/10 bg-background p-2 shadow-sm dark:border-white/10",
        className,
      )}
      style={{ ["--zacx-accent" as string]: theme === "light" ? lightAccent : darkAccent }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={iconButtonClass}
        disabled={!canUndo}
        onClick={() => runEditorCommand((readyEditor) => readyEditor.chain().focus().undo().run())}
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={iconButtonClass}
        disabled={!canRedo}
        onClick={() => runEditorCommand((readyEditor) => readyEditor.chain().focus().redo().run())}
      >
        <Redo2 className="h-4 w-4" />
      </Button>

      <span className="mx-1 h-6 w-px shrink-0 bg-border" />

      <select
        aria-label="Fonte"
        className="h-9 shrink-0 rounded-xl border border-black/10 bg-transparent px-3 text-xs text-foreground outline-none transition hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
        defaultValue="Poppins"
        disabled={!editorReady}
        onChange={(event) => applyTextStyle(editor, { fontFamily: event.target.value })}
      >
        {fontOptions.map((font) => (
          <option key={font} value={font}>
            {font}
          </option>
        ))}
      </select>

      <select
        aria-label="Tamanho da fonte"
        className="h-9 shrink-0 rounded-xl border border-black/10 bg-transparent px-3 text-xs text-foreground outline-none transition hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
        defaultValue="16px"
        disabled={!editorReady}
        onChange={(event) => applyTextStyle(editor, { fontSize: event.target.value })}
      >
        {sizeOptions.map((size) => (
          <option key={size} value={size}>
            {size.replace("px", "")}
          </option>
        ))}
      </select>

      <select
        aria-label="Peso da fonte"
        className="h-9 shrink-0 rounded-xl border border-black/10 bg-transparent px-3 text-xs text-foreground outline-none transition hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
        defaultValue="400"
        disabled={!editorReady}
        onChange={(event) => applyTextStyle(editor, { fontWeight: event.target.value })}
      >
        {weightOptions.map((weight) => (
          <option key={weight.value} value={weight.value}>
            {weight.label}
          </option>
        ))}
      </select>

      <span className="mx-1 h-6 w-px shrink-0 bg-border" />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={iconButtonClass}
        data-active={isBoldActive || undefined}
        disabled={!editorReady}
        onClick={() => runEditorCommand((readyEditor) => readyEditor.chain().focus().toggleBold().run())}
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={iconButtonClass}
        data-active={isItalicActive || undefined}
        disabled={!editorReady}
        onClick={() => runEditorCommand((readyEditor) => readyEditor.chain().focus().toggleItalic().run())}
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={iconButtonClass}
        data-active={isUnderlineActive || undefined}
        disabled={!editorReady}
        onClick={() => runEditorCommand((readyEditor) => readyEditor.chain().focus().toggleUnderline().run())}
      >
        <UnderlineIcon className="h-4 w-4" />
      </Button>

      <div className="flex shrink-0 items-center gap-1 px-1">
        {colors.map((color) => (
          <button
            key={color.label}
            type="button"
            aria-label={color.label}
            title={color.label}
            className="h-8 w-8 rounded-full border border-black/10 p-1 transition hover:scale-105 hover:border-black/20 dark:border-white/20 dark:hover:border-white/40"
            disabled={!editorReady}
            onClick={() => {
              if (color.token) {
                applySemanticColor(editor, color.token);
                return;
              }

              applyFixedColor(editor, color.value);
            }}
          >
            <span className="block h-full w-full rounded-full border border-black/10 dark:border-white/20" style={{ backgroundColor: color.swatch }} />
          </button>
        ))}
      </div>

      <span className="mx-1 h-6 w-px shrink-0 bg-border" />

      <Button type="button" variant="ghost" size="icon" className={iconButtonClass} disabled={!editorReady} onClick={() => runEditorCommand((readyEditor) => readyEditor.chain().focus().setTextAlign("left").run())}>
        <AlignLeft className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className={iconButtonClass} disabled={!editorReady} onClick={() => runEditorCommand((readyEditor) => readyEditor.chain().focus().setTextAlign("center").run())}>
        <AlignCenter className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className={iconButtonClass} disabled={!editorReady} onClick={() => runEditorCommand((readyEditor) => readyEditor.chain().focus().setTextAlign("right").run())}>
        <AlignRight className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className={iconButtonClass} disabled={!editorReady} onClick={() => runEditorCommand((readyEditor) => readyEditor.chain().focus().toggleBulletList().run())}>
        <List className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className={iconButtonClass} disabled={!editorReady} onClick={() => runEditorCommand((readyEditor) => readyEditor.chain().focus().toggleOrderedList().run())}>
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className={iconButtonClass} disabled={!editorReady} onClick={() => runEditorCommand((readyEditor) => readyEditor.chain().focus().unsetAllMarks().run())}>
        <RemoveFormatting className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function CopyDocument({
  value,
  onChange,
  editable = false,
  activeSection,
  sectionKeys,
  clientName,
  emptyText,
  sectionNavigation,
  workspaceLayout = false,
  toolbarClassName,
  sectionNavigationClassName,
}: CopyDocumentProps) {
  const { theme } = useTheme();
  const activeTheme = theme === "light" ? "light" : "dark";
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const visibleSections = useMemo<CopySectionKey[]>(() => {
    if (activeSection) {
      return [activeSection];
    }

    if (sectionKeys) {
      return sectionKeys;
    }

    return copySectionMeta.map((section) => section.key);
  }, [activeSection, sectionKeys]);

  function handleEditorReady(editor: Editor) {
    setActiveEditor(editor);
  }

  if (!visibleSections.length) {
    return (
      <div className="rounded-3xl border border-dashed border-border/80 p-10 text-center text-sm text-muted-foreground">
        Nenhuma secao preenchida ainda.
      </div>
    );
  }

  const renderedSections = (
    <div className="space-y-8">
      {visibleSections.map((sectionKey) => (
        <TiptapSection
          key={sectionKey}
          sectionKey={sectionKey}
          html={value[sectionKey] || emptyContent}
          editable={editable}
          clientName={clientName}
          emptyText={emptyText}
          theme={activeTheme}
          onChange={onChange}
          onActiveEditor={setActiveEditor}
          onEditorReady={handleEditorReady}
        />
      ))}
    </div>
  );

  return (
    <div className={cn("w-full", !workspaceLayout && "mx-auto max-w-6xl")}>
      {editable ? <Toolbar editor={activeEditor} theme={activeTheme} className={toolbarClassName} /> : null}

      {workspaceLayout ? (
        <div className="grid gap-4 px-4 py-4 md:px-5 lg:grid-cols-[210px_minmax(0,860px)_minmax(0,1fr)] lg:items-start lg:justify-start lg:gap-6 2xl:grid-cols-[220px_minmax(760px,900px)_minmax(220px,1fr)]">
          {sectionNavigation ? (
            <div className={cn("lg:sticky lg:top-[148px] lg:self-start", sectionNavigationClassName)}>
              {sectionNavigation}
            </div>
          ) : (
            <div className="hidden lg:block" />
          )}
          <div className="min-w-0">{renderedSections}</div>
          <div className="hidden lg:block" aria-hidden="true" />
        </div>
      ) : (
        renderedSections
      )}

      <style jsx global>{`
        .tiptap-copy-editor .ProseMirror {
          min-height: 68vh;
          outline: none;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .copy-document-editor-light .ProseMirror {
          color: #050505;
        }

        .copy-document-editor-dark .ProseMirror {
          color: #ffffff;
        }

        .copy-document-fixed-header {
          margin: 0 0 38px;
          text-align: center;
          user-select: none;
          -webkit-user-select: none;
        }

        .copy-document-fixed-header h2 {
          margin: 0 0 4px !important;
          font-family: Sora, Poppins, Arial, sans-serif;
          font-size: clamp(22px, 3vw, 30px);
          line-height: 1.12;
          font-weight: 700;
          letter-spacing: 0;
        }

        .copy-document-fixed-header p {
          margin: 0 !important;
          font-family: Sora, Poppins, Arial, sans-serif;
          font-size: clamp(13px, 1.4vw, 16px);
          line-height: 1.35;
          font-weight: 500;
          letter-spacing: 0;
        }

        .copy-document-editor-light .copy-document-fixed-header h2 {
          color: #050505;
        }

        .copy-document-editor-dark .copy-document-fixed-header h2 {
          color: #ffffff;
        }

        .copy-document-editor-light .copy-document-fixed-header p {
          color: #6b7280;
        }

        .copy-document-editor-dark .copy-document-fixed-header p {
          color: #d1d5db;
        }

        .copy-document-editor-light .ProseMirror [data-color-token="accent"] {
          color: ${lightAccent} !important;
        }

        .copy-document-editor-dark .ProseMirror [data-color-token="accent"] {
          color: ${darkAccent} !important;
        }

        .copy-document-editor-light .ProseMirror [data-color-token="body"] {
          color: #050505 !important;
        }

        .copy-document-editor-dark .ProseMirror [data-color-token="body"] {
          color: #ffffff !important;
        }

        .tiptap-copy-editor .ProseMirror p,
        .tiptap-copy-editor .ProseMirror h1,
        .tiptap-copy-editor .ProseMirror h2,
        .tiptap-copy-editor .ProseMirror h3,
        .tiptap-copy-editor .ProseMirror ul,
        .tiptap-copy-editor .ProseMirror ol,
        .tiptap-copy-editor .ProseMirror blockquote {
          margin-bottom: 0.85em;
        }

        .tiptap-copy-editor .ProseMirror ul {
          list-style: disc;
          padding-left: 1.5rem;
        }

        .tiptap-copy-editor .ProseMirror ol {
          list-style: decimal;
          padding-left: 1.5rem;
        }

        .tiptap-copy-editor .ProseMirror a {
          text-decoration: underline;
        }

        .tiptap-copy-editor .ProseMirror .is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          height: 0;
          color: rgb(115 115 115);
          pointer-events: none;
        }

        .copy-document-editor-light .ProseMirror::selection,
        .copy-document-editor-light .ProseMirror *::selection {
          background: ${lightAccent};
          color: #ffffff;
        }

        .copy-document-editor-dark .ProseMirror::selection,
        .copy-document-editor-dark .ProseMirror *::selection {
          background: ${darkAccent};
          color: #050505;
        }
      `}</style>
    </div>
  );
}
