"use client";

import { Extension, Mark, Node, mergeAttributes, type Editor } from "@tiptap/core";
import { Color } from "@tiptap/extension-color";
import { FontFamily } from "@tiptap/extension-font-family";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Underline } from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { Fragment, Slice } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { StarterKit } from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowRight,
  Bold,
  Check,
  Circle,
  Crop,
  MessageSquare,
  ImageIcon,
  Italic,
  List,
  ListOrdered,
  Minus,
  PanelTop,
  Plus,
  Redo2,
  RectangleHorizontal,
  Square,
  StickyNote,
  Table2,
  Pencil,
  Trash2,
  UnderlineIcon,
  Undo2,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type MouseEvent,
  type ReactNode,
  type SetStateAction,
} from "react";

import { useTheme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CopySectionKey = "posts" | "carousels" | "stories" | "videos" | "photos" | "paidTraffic";

export type CopyDocumentSections = Record<CopySectionKey, string>;
type CopySectionFieldName = "posts_content" | "carousels_content" | "stories_content" | "videos_content";

export const copySectionMeta: Array<{ key: CopySectionKey; label: string }> = [
  { key: "posts", label: "Posts" },
  { key: "carousels", label: "Carrosséis" },
  { key: "stories", label: "Stories" },
  { key: "videos", label: "Vídeos" },
  { key: "photos", label: "Fotos" },
  { key: "paidTraffic", label: "Tráfego pago" },
];

export const copySectionFieldMap: Partial<Record<CopySectionKey, CopySectionFieldName>> = {};

export const emptyCopySections: CopyDocumentSections = {
  posts: "",
  carousels: "",
  stories: "",
  videos: "",
  photos: "",
  paidTraffic: "",
};

const fieldAliases: Record<CopySectionKey, string> = {
  posts: "posts_content",
  carousels: "carousels_content",
  stories: "stories_content",
  videos: "videos_content",
  photos: "photos_content",
  paidTraffic: "paid_traffic_content",
};

const defaultTitles: Record<CopySectionKey, string> = {
  posts: "Planejamento dos Posts",
  carousels: "Planejamento dos Carrosséis",
  stories: "Planejamento dos Stories",
  videos: "Planejamento dos Vídeos",
  photos: "Planejamento das Fotos",
  paidTraffic: "Planejamento do Tráfego Pago",
};

const titleMatchers: Record<CopySectionKey, RegExp> = {
  posts: /^planejamento\s+dos\s+posts$/i,
  carousels: /^planejamento\s+dos\s+carross[eé]is$/i,
  stories: /^planejamento\s+dos\s+stories$/i,
  videos: /^planejamento\s+dos\s+v[ií]deos$/i,
  photos: /^planejamento\s+das\s+fotos$/i,
  paidTraffic: /^planejamento\s+do\s+tr[aá]fego\s+pago$/i,
};

const fontOptions = ["Sora"];
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
const documentFontFamily = "Sora";
const supportedPlanningImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
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

type PlanningImageNodeViewProps = {
  node: {
    attrs: {
      src?: string | null;
      alt?: string | null;
      width?: string | null;
      height?: string | null;
      cropEnabled?: boolean | string | null;
      cropX?: number | string | null;
      cropY?: number | string | null;
      cropZoom?: number | string | null;
    };
  };
  editor: Editor;
  selected: boolean;
  updateAttributes: (attributes: Record<string, string | number | boolean>) => void;
  deleteNode: () => void;
  extension: {
    options: {
      onImageUpload?: (file: File) => Promise<string | null>;
    };
  };
};

type PlanningShapeKind = "square" | "rectangle" | "circle" | "line" | "arrow";

type PlanningShapeNodeViewProps = {
  node: {
    attrs: {
      shape?: PlanningShapeKind | null;
      width?: string | null;
      height?: string | null;
      fillColor?: string | null;
      strokeColor?: string | null;
      strokeWidth?: number | string | null;
    };
  };
  editor: Editor;
  selected: boolean;
  updateAttributes: (attributes: Record<string, string | number>) => void;
  deleteNode: () => void;
};

function normalizeElementSize(value: unknown, fallback: string, allowAuto = false) {
  const nextValue = typeof value === "string" ? value.trim() : "";

  if (allowAuto && nextValue === "auto") {
    return "auto";
  }

  if (/^\d+(\.\d+)?(px|%)$/.test(nextValue)) {
    return nextValue;
  }

  return fallback;
}

function normalizePercentNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (Number.isFinite(parsed)) {
    return Math.min(100, Math.max(0, parsed));
  }

  return fallback;
}

function normalizePositiveNumber(value: unknown, fallback: number, min = 0.1, max = 10) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (Number.isFinite(parsed)) {
    return Math.min(max, Math.max(min, parsed));
  }

  return fallback;
}

function normalizeStrokeWidth(value: unknown, fallback = 2) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (Number.isFinite(parsed)) {
    return Math.min(12, Math.max(1, Math.round(parsed)));
  }

  return fallback;
}

function normalizeColor(value: unknown, fallback: string) {
  const nextValue = typeof value === "string" ? value.trim() : "";

  if (/^#[0-9a-f]{6}$/i.test(nextValue)) {
    return nextValue;
  }

  if (nextValue === "transparent") {
    return nextValue;
  }

  return fallback;
}

function imageFrameStyleFromAttributes(attributes: Record<string, unknown>) {
  const width = normalizeElementSize(attributes.width, "360px");
  const height = normalizeElementSize(attributes.height, "auto", true);
  const cropEnabled = attributes.cropEnabled === true || attributes.cropEnabled === "true";
  const style = [`width: ${width}`, "max-width: 100%"];

  if (height !== "auto" || cropEnabled) {
    style.push(`height: ${height === "auto" ? "220px" : height}`);
  }

  return `${style.join("; ")};`;
}

function imageElementStyleFromAttributes(attributes: Record<string, unknown>) {
  const cropEnabled = attributes.cropEnabled === true || attributes.cropEnabled === "true";
  const cropX = normalizePercentNumber(attributes.cropX, 50);
  const cropY = normalizePercentNumber(attributes.cropY, 50);
  const cropZoom = normalizePositiveNumber(attributes.cropZoom, 1, 1, 3);

  if (!cropEnabled) {
    return "width: 100%; height: auto; object-fit: contain; object-position: center;";
  }

  return `width: 100%; height: 100%; object-fit: cover; object-position: ${cropX}% ${cropY}%; transform: scale(${cropZoom}); transform-origin: ${cropX}% ${cropY}%;`;
}

function shapeStyleFromAttributes(attributes: Record<string, unknown>) {
  const shape = (attributes.shape || "rectangle") as PlanningShapeKind;
  const width = normalizeElementSize(attributes.width, shape === "line" || shape === "arrow" ? "260px" : "160px");
  const height = normalizeElementSize(attributes.height, shape === "line" || shape === "arrow" ? "2px" : "110px");
  const fillColor = normalizeColor(attributes.fillColor, shape === "line" || shape === "arrow" ? "transparent" : "#DFFF06");
  const strokeColor = normalizeColor(attributes.strokeColor, "#1D10D7");
  const strokeWidth = normalizeStrokeWidth(attributes.strokeWidth, 2);
  const common = [
    `--planning-shape-fill: ${fillColor}`,
    `--planning-shape-stroke: ${strokeColor}`,
    `--planning-shape-stroke-width: ${strokeWidth}px`,
    `width: ${width}`,
    `height: ${height}`,
    "max-width: 100%",
  ];

  if (shape === "line" || shape === "arrow") {
    common.push("background: transparent", `border-top: ${strokeWidth}px solid ${strokeColor}`);
    return `${common.join("; ")};`;
  }

  common.push(`background: ${fillColor}`, `${shape === "circle" ? "border-radius: 9999px" : "border-radius: 0"}`, `border: ${strokeWidth}px solid ${strokeColor}`);
  return `${common.join("; ")};`;
}

function PlanningImageNodeView({ node, editor, selected, updateAttributes, deleteNode, extension }: PlanningImageNodeViewProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cropMode, setCropMode] = useState(false);
  const [uploadingReplacement, setUploadingReplacement] = useState(false);
  const width = normalizeElementSize(node.attrs.width, "360px");
  const height = normalizeElementSize(node.attrs.height, "auto", true);
  const cropEnabled = node.attrs.cropEnabled === true || node.attrs.cropEnabled === "true";
  const cropX = normalizePercentNumber(node.attrs.cropX, 50);
  const cropY = normalizePercentNumber(node.attrs.cropY, 50);
  const cropZoom = normalizePositiveNumber(node.attrs.cropZoom, 1, 1, 3);
  const [draftCrop, setDraftCrop] = useState({ x: cropX, y: cropY, zoom: cropZoom });
  const isEditable = editor.isEditable;
  const showControls = isEditable && selected;

  useEffect(() => {
    if (!cropMode) {
      setDraftCrop({ x: cropX, y: cropY, zoom: cropZoom });
    }
  }, [cropMode, cropX, cropY, cropZoom]);

  function startResize(event: React.PointerEvent<HTMLButtonElement>, direction: string) {
    const frame = frameRef.current;

    if (!frame || !isEditable) {
      return;
    }

    const activeFrame = frame;

    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = Math.max(80, activeFrame.offsetWidth);
    const startHeight = Math.max(60, activeFrame.offsetHeight || startWidth * 0.62);
    const aspectRatio = startWidth / startHeight || 1;

    function applySize(nextWidth: number, nextHeight: number) {
      const safeWidth = Math.max(80, Math.round(nextWidth));
      const safeHeight = Math.max(60, Math.round(nextHeight));
      activeFrame.style.width = `${safeWidth}px`;
      activeFrame.style.height = `${safeHeight}px`;
    }

    function handlePointerMove(moveEvent: PointerEvent) {
      moveEvent.preventDefault();
      const multiplier = moveEvent.altKey ? 2 : 1;
      const dx = (moveEvent.clientX - startX) * multiplier;
      const dy = (moveEvent.clientY - startY) * multiplier;
      let nextWidth = startWidth;
      let nextHeight = startHeight;

      if (direction.includes("e")) nextWidth = startWidth + dx;
      if (direction.includes("w")) nextWidth = startWidth - dx;
      if (direction.includes("s")) nextHeight = startHeight + dy;
      if (direction.includes("n")) nextHeight = startHeight - dy;

      if (moveEvent.shiftKey) {
        if (Math.abs(nextWidth - startWidth) >= Math.abs(nextHeight - startHeight)) {
          nextHeight = nextWidth / aspectRatio;
        } else {
          nextWidth = nextHeight * aspectRatio;
        }
      }

      applySize(nextWidth, nextHeight);
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);

      const nextWidth = `${Math.max(80, Math.round(activeFrame.offsetWidth))}px`;
      const nextHeight = `${Math.max(60, Math.round(activeFrame.offsetHeight))}px`;
      updateAttributes({ width: nextWidth, height: nextHeight });
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function startCrop() {
    const frame = frameRef.current;
    const nextHeight = height === "auto" && frame ? `${Math.max(120, Math.round(frame.offsetHeight || 220))}px` : height;

    setDraftCrop({ x: cropX, y: cropY, zoom: cropZoom });
    updateAttributes({ cropEnabled: true, height: nextHeight });
    setCropMode(true);
  }

  function confirmCrop() {
    updateAttributes({
      cropEnabled: true,
      cropX: draftCrop.x,
      cropY: draftCrop.y,
      cropZoom: draftCrop.zoom,
    });
    setCropMode(false);
  }

  function cancelCrop() {
    setDraftCrop({ x: cropX, y: cropY, zoom: cropZoom });
    setCropMode(false);
  }

  async function replaceImage(file?: File | null) {
    if (!file || !isSupportedPlanningImage(file) || !extension.options.onImageUpload) {
      return;
    }

    setUploadingReplacement(true);

    try {
      const publicUrl = await extension.options.onImageUpload(file);

      if (publicUrl) {
        updateAttributes({ src: publicUrl, alt: file.name });
      }
    } finally {
      setUploadingReplacement(false);
    }
  }

  return (
    <NodeViewWrapper className={cn("planning-doc-image-node", selected && isEditable && "planning-doc-image-node-selected")} data-planning-image-node>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        contentEditable={false}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          void replaceImage(file);
        }}
      />
      {showControls ? (
        <div className="planning-doc-image-toolbar" contentEditable={false}>
          <button type="button" onClick={startCrop}>
            <Crop className="h-3.5 w-3.5" />
            Cortar
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!extension.options.onImageUpload || uploadingReplacement}>
            <ImageIcon className="h-3.5 w-3.5" />
            Substituir
          </button>
          <button
            type="button"
            onClick={() => {
              updateAttributes({ cropEnabled: false, cropX: 50, cropY: 50, cropZoom: 1, height: "auto" });
              setCropMode(false);
            }}
          >
            Restaurar
          </button>
          <button type="button" onClick={deleteNode}>
            <Trash2 className="h-3.5 w-3.5" />
            Remover
          </button>
        </div>
      ) : null}
      <div
        ref={frameRef}
        className={cn("planning-doc-image-frame", cropEnabled && "planning-doc-image-frame-cropped")}
        style={
          {
            ["--planning-image-width" as string]: width,
            ["--planning-image-height" as string]: height === "auto" && cropEnabled ? "220px" : height,
            ["--planning-image-object-x" as string]: `${cropMode ? draftCrop.x : cropX}%`,
            ["--planning-image-object-y" as string]: `${cropMode ? draftCrop.y : cropY}%`,
            ["--planning-image-crop-zoom" as string]: cropMode ? draftCrop.zoom : cropZoom,
          } as CSSProperties
        }
      >
        {node.attrs.src ? (
          <img className="planning-doc-image" src={node.attrs.src} alt={node.attrs.alt || ""} draggable={false} />
        ) : null}
        {showControls ? (
          <div className="planning-doc-image-resize-handles" contentEditable={false}>
            {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((direction) => (
              <button
                key={direction}
                type="button"
                aria-label={`Redimensionar imagem ${direction}`}
                className={`planning-doc-image-resize-handle planning-doc-image-resize-handle-${direction}`}
                onPointerDown={(event) => startResize(event, direction)}
              />
            ))}
          </div>
        ) : null}
      </div>
      {showControls && cropMode ? (
        <div className="planning-doc-image-crop-panel" contentEditable={false}>
          <label>
            Zoom
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={draftCrop.zoom}
              onChange={(event) => setDraftCrop((current) => ({ ...current, zoom: Number(event.target.value) }))}
            />
          </label>
          <label>
            Horizontal
            <input
              type="range"
              min="0"
              max="100"
              value={draftCrop.x}
              onChange={(event) => setDraftCrop((current) => ({ ...current, x: Number(event.target.value) }))}
            />
          </label>
          <label>
            Vertical
            <input
              type="range"
              min="0"
              max="100"
              value={draftCrop.y}
              onChange={(event) => setDraftCrop((current) => ({ ...current, y: Number(event.target.value) }))}
            />
          </label>
          <div>
            <button type="button" onClick={cancelCrop}>
              Cancelar
            </button>
            <button type="button" data-primary="true" onClick={confirmCrop}>
              Confirmar
            </button>
          </div>
        </div>
      ) : null}
    </NodeViewWrapper>
  );
}

const PlanningImage = Node.create<{ onImageUpload?: (file: File) => Promise<string | null> }>({
  name: "planningImage",
  group: "block",
  atom: true,
  draggable: true,
  addOptions() {
    return {
      onImageUpload: undefined,
    };
  },
  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-src") || element.querySelector("img")?.getAttribute("src") || element.getAttribute("src"),
      },
      alt: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-alt") || element.querySelector("img")?.getAttribute("alt") || element.getAttribute("alt") || "",
      },
      width: {
        default: "360px",
        parseHTML: (element) => element.getAttribute("data-width") || (element instanceof HTMLElement ? element.style.width : "") || "360px",
      },
      height: {
        default: "auto",
        parseHTML: (element) => element.getAttribute("data-height") || (element instanceof HTMLElement ? element.style.height : "") || "auto",
      },
      cropEnabled: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-crop-enabled") === "true",
      },
      cropX: {
        default: 50,
        parseHTML: (element) => Number(element.getAttribute("data-crop-x") || 50),
      },
      cropY: {
        default: 50,
        parseHTML: (element) => Number(element.getAttribute("data-crop-y") || 50),
      },
      cropZoom: {
        default: 1,
        parseHTML: (element) => Number(element.getAttribute("data-crop-zoom") || 1),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-planning-image]" }, { tag: "img[src]" }];
  },
  renderHTML({ node }) {
    const attrs = node.attrs;

    return [
      "div",
      {
        "data-planning-image": "true",
        "data-src": attrs.src,
        "data-alt": attrs.alt || "",
        "data-width": normalizeElementSize(attrs.width, "360px"),
        "data-height": normalizeElementSize(attrs.height, "auto", true),
        "data-crop-enabled": attrs.cropEnabled ? "true" : "false",
        "data-crop-x": String(normalizePercentNumber(attrs.cropX, 50)),
        "data-crop-y": String(normalizePercentNumber(attrs.cropY, 50)),
        "data-crop-zoom": String(normalizePositiveNumber(attrs.cropZoom, 1, 1, 3)),
        class: `planning-doc-image-node${attrs.cropEnabled ? " planning-doc-image-node-cropped" : ""}`,
        style: imageFrameStyleFromAttributes(attrs),
      },
      [
        "img",
        {
          src: attrs.src,
          alt: attrs.alt || "",
          class: "planning-doc-image",
          style: imageElementStyleFromAttributes(attrs),
        },
      ],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(PlanningImageNodeView);
  },
});

function normalizeShapeKind(value: unknown): PlanningShapeKind {
  return value === "square" || value === "rectangle" || value === "circle" || value === "line" || value === "arrow" ? value : "rectangle";
}

function getPlanningShapeDefaults(shape: PlanningShapeKind) {
  if (shape === "square") {
    return { width: "150px", height: "150px", fillColor: "#DFFF06", strokeColor: "#1D10D7", strokeWidth: 2 };
  }

  if (shape === "circle") {
    return { width: "150px", height: "150px", fillColor: "#DFFF06", strokeColor: "#1D10D7", strokeWidth: 2 };
  }

  if (shape === "line" || shape === "arrow") {
    return { width: "260px", height: "2px", fillColor: "transparent", strokeColor: "#1D10D7", strokeWidth: 2 };
  }

  return { width: "220px", height: "120px", fillColor: "#DFFF06", strokeColor: "#1D10D7", strokeWidth: 2 };
}

function PlanningShapeNodeView({ node, editor, selected, updateAttributes, deleteNode }: PlanningShapeNodeViewProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const shape = normalizeShapeKind(node.attrs.shape);
  const defaults = getPlanningShapeDefaults(shape);
  const width = normalizeElementSize(node.attrs.width, defaults.width);
  const height = normalizeElementSize(node.attrs.height, defaults.height);
  const fillColor = normalizeColor(node.attrs.fillColor, defaults.fillColor);
  const strokeColor = normalizeColor(node.attrs.strokeColor, defaults.strokeColor);
  const strokeWidth = normalizeStrokeWidth(node.attrs.strokeWidth, defaults.strokeWidth);
  const isEditable = editor.isEditable;
  const showControls = isEditable && selected;

  function startResize(event: React.PointerEvent<HTMLButtonElement>, direction: string) {
    const frame = frameRef.current;

    if (!frame || !isEditable) {
      return;
    }

    const activeFrame = frame;

    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = Math.max(24, activeFrame.offsetWidth);
    const startHeight = Math.max(shape === "line" || shape === "arrow" ? 2 : 24, activeFrame.offsetHeight);
    const aspectRatio = shape === "square" || shape === "circle" ? 1 : startWidth / startHeight || 1;
    const shouldLockAspect = shape === "square" || shape === "circle";

    function applySize(nextWidth: number, nextHeight: number) {
      const safeWidth = Math.max(24, Math.round(nextWidth));
      const minimumHeight = shape === "line" || shape === "arrow" ? 2 : 24;
      const safeHeight = Math.max(minimumHeight, Math.round(nextHeight));
      activeFrame.style.width = `${safeWidth}px`;
      activeFrame.style.height = `${safeHeight}px`;
    }

    function handlePointerMove(moveEvent: PointerEvent) {
      moveEvent.preventDefault();
      const multiplier = moveEvent.altKey ? 2 : 1;
      const dx = (moveEvent.clientX - startX) * multiplier;
      const dy = (moveEvent.clientY - startY) * multiplier;
      let nextWidth = startWidth;
      let nextHeight = startHeight;

      if (direction.includes("e")) nextWidth = startWidth + dx;
      if (direction.includes("w")) nextWidth = startWidth - dx;
      if (direction.includes("s")) nextHeight = startHeight + dy;
      if (direction.includes("n")) nextHeight = startHeight - dy;

      if (moveEvent.shiftKey || shouldLockAspect) {
        if (shape === "line" || shape === "arrow") {
          nextHeight = startHeight;
        } else if (Math.abs(nextWidth - startWidth) >= Math.abs(nextHeight - startHeight)) {
          nextHeight = nextWidth / aspectRatio;
        } else {
          nextWidth = nextHeight * aspectRatio;
        }
      }

      applySize(nextWidth, nextHeight);
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      updateAttributes({
        width: `${Math.max(24, Math.round(activeFrame.offsetWidth))}px`,
        height: `${Math.max(shape === "line" || shape === "arrow" ? 2 : 24, Math.round(activeFrame.offsetHeight))}px`,
      });
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  return (
    <NodeViewWrapper className={cn("planning-doc-shape-node", selected && isEditable && "planning-doc-shape-node-selected")} data-planning-shape-node>
      {showControls ? (
        <div className="planning-doc-shape-toolbar" contentEditable={false}>
          {shape !== "line" && shape !== "arrow" ? (
            <label title="Preenchimento">
              <span>Preenchimento</span>
              <input type="color" value={fillColor === "transparent" ? "#ffffff" : fillColor} onChange={(event) => updateAttributes({ fillColor: event.target.value })} />
            </label>
          ) : null}
          <label title="Borda">
            <span>Borda</span>
            <input type="color" value={strokeColor} onChange={(event) => updateAttributes({ strokeColor: event.target.value })} />
          </label>
          <label title="Espessura">
            <span>Traço</span>
            <select value={strokeWidth} onChange={(event) => updateAttributes({ strokeWidth: Number(event.target.value) })}>
              {[1, 2, 3, 4, 6, 8].map((value) => (
                <option key={value} value={value}>
                  {value}px
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={deleteNode} aria-label="Remover forma" title="Remover">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      <div
        ref={frameRef}
        className={cn("planning-doc-shape", `planning-doc-shape-${shape}`)}
        data-drag-handle
        style={
          {
            ["--planning-shape-width" as string]: width,
            ["--planning-shape-height" as string]: height,
            ["--planning-shape-fill" as string]: fillColor,
            ["--planning-shape-stroke" as string]: strokeColor,
            ["--planning-shape-stroke-width" as string]: `${strokeWidth}px`,
          } as CSSProperties
        }
        contentEditable={false}
      >
        {showControls ? (
          <div className="planning-doc-shape-resize-handles" contentEditable={false}>
            {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((direction) => (
              <button
                key={direction}
                type="button"
                aria-label={`Redimensionar forma ${direction}`}
                className={`planning-doc-image-resize-handle planning-doc-image-resize-handle-${direction}`}
                onPointerDown={(event) => startResize(event, direction)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}

const PlanningShape = Node.create({
  name: "planningShape",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      shape: {
        default: "rectangle",
        parseHTML: (element) => normalizeShapeKind(element.getAttribute("data-planning-shape")),
      },
      width: {
        default: "220px",
        parseHTML: (element) => element.getAttribute("data-width") || element.style.width || "220px",
      },
      height: {
        default: "120px",
        parseHTML: (element) => element.getAttribute("data-height") || element.style.height || "120px",
      },
      fillColor: {
        default: "#DFFF06",
        parseHTML: (element) => element.getAttribute("data-fill-color") || "#DFFF06",
      },
      strokeColor: {
        default: "#1D10D7",
        parseHTML: (element) => element.getAttribute("data-stroke-color") || "#1D10D7",
      },
      strokeWidth: {
        default: 2,
        parseHTML: (element) => Number(element.getAttribute("data-stroke-width") || 2),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-planning-shape]" }];
  },
  renderHTML({ node }) {
    const shape = normalizeShapeKind(node.attrs.shape);
    const defaults = getPlanningShapeDefaults(shape);
    const attrs = {
      shape,
      width: normalizeElementSize(node.attrs.width, defaults.width),
      height: normalizeElementSize(node.attrs.height, defaults.height),
      fillColor: normalizeColor(node.attrs.fillColor, defaults.fillColor),
      strokeColor: normalizeColor(node.attrs.strokeColor, defaults.strokeColor),
      strokeWidth: normalizeStrokeWidth(node.attrs.strokeWidth, defaults.strokeWidth),
    };

    return [
      "div",
      {
        "data-planning-shape": attrs.shape,
        "data-width": attrs.width,
        "data-height": attrs.height,
        "data-fill-color": attrs.fillColor,
        "data-stroke-color": attrs.strokeColor,
        "data-stroke-width": String(attrs.strokeWidth),
        class: `planning-doc-shape planning-doc-shape-${attrs.shape}`,
        style: shapeStyleFromAttributes(attrs),
      },
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(PlanningShapeNodeView);
  },
});

type PlanningBoxNodeViewProps = {
  node: {
    attrs: {
      width?: string | null;
      height?: string | null;
    };
  };
  editor: Editor;
  selected: boolean;
  updateAttributes: (attributes: Record<string, string>) => void;
};

function normalizeBoxSize(value: unknown, fallback: string) {
  const nextValue = typeof value === "string" ? value.trim() : "";

  if (/^\d+(\.\d+)?(px|%)$/.test(nextValue)) {
    return nextValue;
  }

  return fallback;
}

function PlanningBoxNodeView({ node, editor, selected, updateAttributes }: PlanningBoxNodeViewProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const width = normalizeBoxSize(node.attrs.width, "320px");
  const height = normalizeBoxSize(node.attrs.height, "160px");
  const isEditable = editor.isEditable;

  function persistSize() {
    const frame = frameRef.current;

    if (!frame || !isEditable) {
      return;
    }

    const nextWidth = `${Math.round(frame.offsetWidth)}px`;
    const nextHeight = `${Math.round(frame.offsetHeight)}px`;

    if (nextWidth !== width || nextHeight !== height) {
      updateAttributes({ width: nextWidth, height: nextHeight });
    }
  }

  return (
    <NodeViewWrapper
      className={cn("planning-doc-box-node", selected && isEditable && "planning-doc-box-node-selected")}
      data-planning-box-node
    >
      <div
        ref={frameRef}
        className="planning-doc-box"
        style={{ ["--planning-box-width" as string]: width, ["--planning-box-height" as string]: height } as CSSProperties}
        onMouseUp={persistSize}
        onTouchEnd={persistSize}
      >
        {isEditable ? (
          <div
            className="planning-doc-box-handle"
            contentEditable={false}
            data-drag-handle
            aria-label="Mover caixa"
            title="Mover caixa"
          >
            <span />
          </div>
        ) : null}
        <NodeViewContent className="planning-doc-box-content" />
      </div>
    </NodeViewWrapper>
  );
}

function boxStyleFromAttributes(attributes: Record<string, unknown>) {
  const width = normalizeBoxSize(attributes.width, "320px");
  const height = normalizeBoxSize(attributes.height, "160px");

  return `width: ${width}; min-height: ${height};`;
}

const PlanningBox = Node.create({
  name: "planningBox",
  group: "block",
  content: "block+",
  defining: true,
  draggable: true,
  addAttributes() {
    return {
      width: {
        default: "320px",
        parseHTML: (element) => element.getAttribute("data-width") || element.style.width || "320px",
        renderHTML: (attributes) => ({ "data-width": normalizeBoxSize(attributes.width, "320px") }),
      },
      height: {
        default: "160px",
        parseHTML: (element) => element.getAttribute("data-height") || element.style.minHeight || element.style.height || "160px",
        renderHTML: (attributes) => ({ "data-height": normalizeBoxSize(attributes.height, "160px") }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-planning-box]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-planning-box": "true",
        class: "planning-doc-box",
        style: boxStyleFromAttributes(HTMLAttributes),
      }),
      0,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(PlanningBoxNodeView);
  },
});

const PlanningTable = Node.create({
  name: "planningTable",
  group: "block",
  content: "planningTableRow+",
  isolating: true,
  parseHTML() {
    return [{ tag: "table" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["table", mergeAttributes(HTMLAttributes, { class: "planning-doc-table" }), ["tbody", 0]];
  },
});

const PlanningTableRow = Node.create({
  name: "planningTableRow",
  content: "planningTableCell+",
  parseHTML() {
    return [{ tag: "tr" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["tr", HTMLAttributes, 0];
  },
});

const PlanningTableCell = Node.create({
  name: "planningTableCell",
  content: "block+",
  isolating: true,
  parseHTML() {
    return [{ tag: "td" }, { tag: "th" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["td", mergeAttributes(HTMLAttributes, { class: "planning-doc-table-cell" }), 0];
  },
});

const PlanningNote = Node.create({
  name: "planningNote",
  group: "block",
  content: "block+",
  defining: true,
  parseHTML() {
    return [{ tag: "div[data-planning-note]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-planning-note": "true",
        class: "planning-doc-note",
      }),
      0,
    ];
  },
});

const PlanningCommentMark = Mark.create({
  name: "planningComment",
  inclusive: false,
  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-planning-comment-id"),
        renderHTML: (attributes) => {
          if (!attributes.commentId) {
            return {};
          }

          return { "data-planning-comment-id": attributes.commentId };
        },
      },
      commentText: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-planning-comment-text") || "",
        renderHTML: (attributes) => ({ "data-planning-comment-text": attributes.commentText || "" }),
      },
      authorName: {
        default: "Comentário",
        parseHTML: (element) => element.getAttribute("data-planning-comment-author") || "Comentário",
        renderHTML: (attributes) => ({ "data-planning-comment-author": attributes.authorName || "Comentário" }),
      },
      createdAt: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-planning-comment-created-at") || "",
        renderHTML: (attributes) => ({ "data-planning-comment-created-at": attributes.createdAt || "" }),
      },
      updatedAt: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-planning-comment-updated-at") || "",
        renderHTML: (attributes) => {
          if (!attributes.updatedAt) {
            return {};
          }

          return { "data-planning-comment-updated-at": attributes.updatedAt };
        },
      },
      resolvedAt: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-planning-comment-resolved-at") || "",
        renderHTML: (attributes) => {
          if (!attributes.resolvedAt) {
            return {};
          }

          return { "data-planning-comment-resolved-at": attributes.resolvedAt };
        },
      },
      replies: {
        default: "[]",
        parseHTML: (element) => element.getAttribute("data-planning-comment-replies") || "[]",
        renderHTML: (attributes) => ({ "data-planning-comment-replies": attributes.replies || "[]" }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-planning-comment-id]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const resolvedClass = HTMLAttributes["data-planning-comment-resolved-at"] ? " planning-doc-comment-resolved" : "";

    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: `planning-doc-comment${resolvedClass}`,
      }),
      0,
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

  return lines
    .map((line) => `<p><span style="font-family: ${documentFontFamily}">${escapeHtml(line) || "<br>"}</span></p>`)
    .join("");
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

function normalizeDocumentFontFamilies(document: Document) {
  document.body.querySelectorAll<HTMLElement>("font[face]").forEach((element) => {
    element.style.setProperty("font-family", documentFontFamily);
    element.removeAttribute("face");
  });

  document.body.querySelectorAll<HTMLElement>("*").forEach((element) => {
    if (element.style.getPropertyValue("font-family")) {
      element.style.setProperty("font-family", documentFontFamily);
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
  normalizeDocumentFontFamilies(document);

  blockedSelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => node.remove());
  });

  document.body.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    const src = image.getAttribute("src")?.trim().toLowerCase() || "";

    if (src.startsWith("data:") || src.startsWith("blob:")) {
      image.remove();
    }
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
  const media = document.body.querySelector("img, video, iframe, table, [data-planning-box], [data-planning-note], [data-planning-shape], [data-planning-image]");

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
      photos: parsed.photos ?? "",
      paidTraffic: parsed.paidTraffic ?? "",
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

export function serializeCopyDocumentSections(sections: Partial<CopyDocumentSections>) {
  const payload = copySectionMeta.reduce<Partial<CopyDocumentSections>>((current, section) => {
    current[section.key] = sections[section.key] || "";
    return current;
  }, {});

  return JSON.stringify(payload);
}

function insertPlainText(view: EditorView, text: string) {
  const { state, dispatch } = view;
  const textStyleMark = state.schema.marks.textStyle?.create({ fontFamily: documentFontFamily });
  const nodes = text.replace(/\r\n?/g, "\n").split("\n").flatMap((line, index) => {
    const chunk = line ? [state.schema.text(line, textStyleMark ? [textStyleMark] : undefined)] : [];

    if (index === 0) {
      return chunk;
    }

    return [state.schema.nodes.hardBreak.create(), ...chunk];
  });

  const fragment = Fragment.fromArray(nodes);
  dispatch(state.tr.replaceSelection(Slice.maxOpen(fragment)).scrollIntoView());
}

function isSupportedPlanningImage(file: File) {
  return supportedPlanningImageTypes.has(file.type);
}

function getImageFilesFromFileList(fileList?: FileList | null) {
  return Array.from(fileList ?? []).filter(isSupportedPlanningImage);
}

function getInvalidFilesFromFileList(fileList?: FileList | null) {
  return Array.from(fileList ?? []).filter((file) => !isSupportedPlanningImage(file));
}

function getImageFilesFromClipboard(data?: DataTransfer | null) {
  const filesFromItems = Array.from(data?.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  return (filesFromItems.length ? filesFromItems : Array.from(data?.files ?? [])).filter(isSupportedPlanningImage);
}

function getInvalidFilesFromClipboard(data?: DataTransfer | null) {
  const filesFromItems = Array.from(data?.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  return (filesFromItems.length ? filesFromItems : Array.from(data?.files ?? [])).filter((file) => !isSupportedPlanningImage(file));
}

function insertBlockContent(editor: Editor, content: Record<string, unknown>) {
  editor.chain().focus().insertContent([content, { type: "paragraph" }]).run();
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

type PlanningCommentReply = {
  id: string;
  text: string;
  authorName: string;
  createdAt: string;
  updatedAt?: string;
};

type PlanningCommentData = {
  id: string;
  text: string;
  authorName: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  selectedText: string;
  replies: PlanningCommentReply[];
};

type PendingPlanningCommentSelection = {
  from: number;
  to: number;
  selectedText: string;
};

type FloatingCommentButtonState = {
  visible: boolean;
  top: number;
};

function createPlanningCommentId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `comment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatPlanningCommentDate(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function parsePlanningCommentReplies(value?: string | null): PlanningCommentReply[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as Array<Partial<PlanningCommentReply>>;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((reply) => ({
        id: typeof reply.id === "string" && reply.id ? reply.id : createPlanningCommentId(),
        text: typeof reply.text === "string" ? reply.text : "",
        authorName: typeof reply.authorName === "string" && reply.authorName ? reply.authorName : "Resposta",
        createdAt: typeof reply.createdAt === "string" ? reply.createdAt : "",
        updatedAt: typeof reply.updatedAt === "string" ? reply.updatedAt : "",
      }))
      .filter((reply) => reply.text.trim());
  } catch {
    return [];
  }
}

function serializePlanningCommentReplies(replies: PlanningCommentReply[]) {
  return JSON.stringify(replies);
}

function extractPlanningComments(html: string): PlanningCommentData[] {
  if (!html || typeof window === "undefined" || typeof DOMParser === "undefined") {
    return [];
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  const comments = new Map<string, PlanningCommentData>();

  document.body.querySelectorAll<HTMLElement>("[data-planning-comment-id]").forEach((element) => {
    const id = element.getAttribute("data-planning-comment-id")?.trim();

    if (!id) {
      return;
    }

    const existing = comments.get(id);
    const selectedText = element.textContent?.replace(/\s+/g, " ").trim() || "";

    if (existing) {
      if (selectedText && !existing.selectedText.includes(selectedText)) {
        existing.selectedText = `${existing.selectedText} ${selectedText}`.trim();
      }

      return;
    }

    comments.set(id, {
      id,
      text: element.getAttribute("data-planning-comment-text") || "",
      authorName: element.getAttribute("data-planning-comment-author") || "Comentário",
      createdAt: element.getAttribute("data-planning-comment-created-at") || "",
      updatedAt: element.getAttribute("data-planning-comment-updated-at") || "",
      resolvedAt: element.getAttribute("data-planning-comment-resolved-at") || "",
      selectedText,
      replies: parsePlanningCommentReplies(element.getAttribute("data-planning-comment-replies")),
    });
  });

  return Array.from(comments.values()).sort((a, b) => {
    const first = new Date(a.createdAt || 0).getTime();
    const second = new Date(b.createdAt || 0).getTime();

    return first - second;
  });
}

function updatePlanningCommentMark(
  editor: Editor,
  commentId: string,
  getNextAttributes: (attributes: Record<string, unknown>) => Record<string, unknown> | null,
) {
  const markType = editor.state.schema.marks.planningComment;

  if (!markType) {
    return false;
  }

  let transaction = editor.state.tr;

  editor.state.doc.descendants((node, position) => {
    if (!node.isText || !node.marks.length) {
      return;
    }

    node.marks.forEach((mark) => {
      if (mark.type !== markType || mark.attrs.commentId !== commentId) {
        return;
      }

      const from = position;
      const to = position + node.nodeSize;
      const nextAttributes = getNextAttributes(mark.attrs);
      transaction = transaction.removeMark(from, to, mark);

      if (nextAttributes) {
        transaction = transaction.addMark(from, to, markType.create(nextAttributes));
      }
    });
  });

  if (!transaction.docChanged) {
    return false;
  }

  editor.view.dispatch(transaction);
  return true;
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
  onImageUpload?: (file: File) => Promise<string | null>;
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
  onImageUpload?: (file: File) => Promise<string | null>;
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
  onImageUpload,
}: TiptapSectionProps) {
  const [pasteHint, setPasteHint] = useState("");
  const [gadgetOpen, setGadgetOpen] = useState(false);
  const [gadgetTableOpen, setGadgetTableOpen] = useState(false);
  const [gadgetShapeOpen, setGadgetShapeOpen] = useState(false);
  const [uploadingInlineImage, setUploadingInlineImage] = useState(false);
  const [comments, setComments] = useState<PlanningCommentData[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [pendingCommentOpen, setPendingCommentOpen] = useState(false);
  const [pendingCommentSelection, setPendingCommentSelection] = useState<PendingPlanningCommentSelection | null>(null);
  const [draftComment, setDraftComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editingReply, setEditingReply] = useState<{ commentId: string; replyId: string } | null>(null);
  const [editingReplyDraft, setEditingReplyDraft] = useState("");
  const [floatingCommentButton, setFloatingCommentButton] = useState<FloatingCommentButtonState>({ visible: false, top: 96 });
  const documentFrameRef = useRef<HTMLDivElement | null>(null);
  const latestCommentSelectionRef = useRef<PendingPlanningCommentSelection | null>(null);
  const gadgetImageInputRef = useRef<HTMLInputElement | null>(null);
  const pasteHintTimeoutRef = useRef<number | null>(null);
  const plainPasteRef = useRef(false);
  const lastSyncedHtmlRef = useRef(normalizeDocumentHtml(html || emptyContent, sectionKey, clientName, theme));
  const visibleComments = comments.filter((comment) => !comment.resolvedAt);

  function refreshPlanningComments(nextHtml: string) {
    const nextComments = extractPlanningComments(nextHtml);
    setComments(nextComments);
    setActiveCommentId((currentCommentId) => {
      if (!currentCommentId) {
        return currentCommentId;
      }

      return nextComments.some((comment) => comment.id === currentCommentId && !comment.resolvedAt) ? currentCommentId : null;
    });
  }

  function showEditorToast(message: string) {
    setPasteHint(message);

    if (pasteHintTimeoutRef.current) {
      window.clearTimeout(pasteHintTimeoutRef.current);
    }

    pasteHintTimeoutRef.current = window.setTimeout(() => {
      setPasteHint("");
      pasteHintTimeoutRef.current = null;
    }, 4200);
  }

  function insertPlanningImage(publicUrl: string, alt: string, position?: number) {
    if (!isEditorReady(editor)) {
      return;
    }

    const imageNode = {
      type: "planningImage",
      attrs: {
        src: publicUrl,
        alt,
      },
    };

    if (typeof position === "number") {
      const safePosition = Math.max(0, Math.min(position, editor.state.doc.content.size));
      editor.chain().focus().insertContentAt(safePosition, imageNode).run();
      return;
    }

    editor.chain().focus().insertContent(imageNode).run();
  }

  async function uploadAndInsertImages(files: File[], position?: number) {
    if (!files.length) {
      return;
    }

    if (!onImageUpload) {
      showEditorToast("Upload de imagem indisponível neste documento.");
      return;
    }

    setUploadingInlineImage(true);
    showEditorToast("Enviando imagem...");

    try {
      for (const file of files) {
        const publicUrl = await onImageUpload(file);

        if (publicUrl) {
          insertPlanningImage(publicUrl, file.name, position);
        }
      }

      showEditorToast(files.length > 1 ? "Imagens inseridas." : "Imagem inserida.");
    } catch {
      showEditorToast("Não foi possível enviar a imagem.");
    } finally {
      setUploadingInlineImage(false);
    }
  }

  function insertPlanningBox() {
    if (!isEditorReady(editor)) {
      return;
    }

    insertBlockContent(editor, {
      type: "planningBox",
      content: [{ type: "paragraph" }],
    });
  }

  function insertPlanningNote() {
    if (!isEditorReady(editor)) {
      return;
    }

    insertBlockContent(editor, {
      type: "planningNote",
      content: [{ type: "paragraph" }],
    });
  }

  function insertPlanningTable(rows: number, columns: number) {
    if (!isEditorReady(editor)) {
      return;
    }

    insertBlockContent(editor, createPlanningTableContent(rows, columns));
  }

  function insertPlanningDivider() {
    if (!isEditorReady(editor)) {
      return;
    }

    editor.chain().focus().setHorizontalRule().run();
  }

  function insertPlanningShape(shape: PlanningShapeKind) {
    if (!isEditorReady(editor)) {
      return;
    }

    const defaults = getPlanningShapeDefaults(shape);

    insertBlockContent(editor, {
      type: "planningShape",
      attrs: {
        shape,
        ...defaults,
      },
    });
  }

  function updateFloatingCommentButton(readyEditor: Editor) {
    if (!editable || readyEditor.isDestroyed) {
      latestCommentSelectionRef.current = null;
      setFloatingCommentButton((current) => (current.visible ? { ...current, visible: false } : current));
      return;
    }

    const { from, to, empty } = readyEditor.state.selection;
    const selectedText = readyEditor.state.doc.textBetween(from, to, " ").replace(/\s+/g, " ").trim();

    if (empty || !selectedText) {
      latestCommentSelectionRef.current = null;
      setFloatingCommentButton((current) => (current.visible ? { ...current, visible: false } : current));
      return;
    }

    latestCommentSelectionRef.current = { from, to, selectedText };

    requestAnimationFrame(() => {
      const frame = documentFrameRef.current;

      if (!frame || readyEditor.isDestroyed) {
        return;
      }

      try {
        const fromCoords = readyEditor.view.coordsAtPos(from);
        const toCoords = readyEditor.view.coordsAtPos(to);
        const frameRect = frame.getBoundingClientRect();
        const rawTop = (Math.min(fromCoords.top, toCoords.top) + Math.max(fromCoords.bottom, toCoords.bottom)) / 2 - frameRect.top - 20;
        const maxTop = Math.max(68, frameRect.height - 58);
        const top = Math.min(Math.max(rawTop, 68), maxTop);

        setFloatingCommentButton({ visible: true, top });
      } catch {
        setFloatingCommentButton({ visible: true, top: 96 });
      }
    });
  }

  function openCommentComposer(selectionOverride?: PendingPlanningCommentSelection | null) {
    if (!isEditorReady(editor)) {
      return;
    }

    const selection = selectionOverride ?? latestCommentSelectionRef.current;
    const { from, to, empty } = editor.state.selection;
    const selectedText = selection?.selectedText || editor.state.doc.textBetween(from, to, " ").replace(/\s+/g, " ").trim();

    if ((!selection && empty) || !selectedText) {
      showEditorToast("Selecione um trecho do texto para comentar.");
      setGadgetOpen(false);
      return;
    }

    setPendingCommentSelection(selection ?? { from, to, selectedText });
    setDraftComment("");
    setPendingCommentOpen(true);
    setEditingCommentId(null);
    setActiveCommentId(null);
    setFloatingCommentButton((current) => ({ ...current, visible: false }));
    setGadgetOpen(false);
  }

  function submitComment() {
    if (!isEditorReady(editor) || !pendingCommentSelection) {
      return;
    }

    const text = draftComment.trim();

    if (!text) {
      showEditorToast("Escreva um comentário antes de salvar.");
      return;
    }

    const commentId = createPlanningCommentId();
    const createdAt = new Date().toISOString();

    editor
      .chain()
      .focus()
      .setTextSelection({ from: pendingCommentSelection.from, to: pendingCommentSelection.to })
      .setMark("planningComment", {
        commentId,
        commentText: text,
        authorName: "Comentário",
        createdAt,
        updatedAt: "",
        resolvedAt: "",
        replies: "[]",
      })
      .setTextSelection(pendingCommentSelection.to)
      .run();

    setDraftComment("");
    setPendingCommentOpen(false);
    setPendingCommentSelection(null);
    latestCommentSelectionRef.current = null;
    setActiveCommentId(commentId);
    setFloatingCommentButton((current) => ({ ...current, visible: false }));
    requestAnimationFrame(() => {
      window.getSelection()?.removeAllRanges();
      editor.commands.blur();
      refreshPlanningComments(editor.getHTML());
    });
  }

  function activateComment(commentId: string, scrollToText = true, scrollToCard = false) {
    setActiveCommentId(commentId);

    if (!isEditorReady(editor)) {
      return;
    }

    requestAnimationFrame(() => {
      const safeId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(commentId) : commentId.replace(/"/g, '\\"');
      const markedText = editor.view.dom.querySelector<HTMLElement>(`[data-planning-comment-id="${safeId}"]`);
      const commentCard = document.querySelector<HTMLElement>(`[data-planning-comment-card-id="${safeId}"]`);

      if (scrollToText) {
        markedText?.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      if (scrollToCard) {
        commentCard?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }

  function beginEditComment(comment: PlanningCommentData) {
    setEditingCommentId(comment.id);
    setEditingDraft(comment.text);
    setActiveCommentId(comment.id);
  }

  function saveEditedComment(commentId: string) {
    if (!isEditorReady(editor)) {
      return;
    }

    const nextText = editingDraft.trim();

    if (!nextText) {
      showEditorToast("O comentário não pode ficar vazio.");
      return;
    }

    updatePlanningCommentMark(editor, commentId, (attributes) => ({
      ...attributes,
      commentText: nextText,
      updatedAt: new Date().toISOString(),
    }));
    setEditingCommentId(null);
    setEditingDraft("");
    setActiveCommentId(commentId);
    requestAnimationFrame(() => refreshPlanningComments(editor.getHTML()));
  }

  function submitReply(commentId: string) {
    if (!isEditorReady(editor)) {
      return;
    }

    const text = (replyDrafts[commentId] || "").trim();

    if (!text) {
      return;
    }

    const now = new Date().toISOString();
    updatePlanningCommentMark(editor, commentId, (attributes) => {
      const replies = parsePlanningCommentReplies(typeof attributes.replies === "string" ? attributes.replies : "[]");

      return {
        ...attributes,
        replies: serializePlanningCommentReplies([
          ...replies,
          {
            id: createPlanningCommentId(),
            text,
            authorName: "Resposta",
            createdAt: now,
            updatedAt: "",
          },
        ]),
        updatedAt: now,
      };
    });
    setReplyDrafts((current) => ({ ...current, [commentId]: "" }));
    setActiveCommentId(commentId);
    requestAnimationFrame(() => refreshPlanningComments(editor.getHTML()));
  }

  function beginEditReply(commentId: string, reply: PlanningCommentReply) {
    setEditingReply({ commentId, replyId: reply.id });
    setEditingReplyDraft(reply.text);
    setActiveCommentId(commentId);
  }

  function saveEditedReply(commentId: string, replyId: string) {
    if (!isEditorReady(editor)) {
      return;
    }

    const nextText = editingReplyDraft.trim();

    if (!nextText) {
      showEditorToast("A resposta não pode ficar vazia.");
      return;
    }

    const now = new Date().toISOString();
    updatePlanningCommentMark(editor, commentId, (attributes) => {
      const replies = parsePlanningCommentReplies(typeof attributes.replies === "string" ? attributes.replies : "[]");

      return {
        ...attributes,
        replies: serializePlanningCommentReplies(
          replies.map((reply) => (reply.id === replyId ? { ...reply, text: nextText, updatedAt: now } : reply)),
        ),
        updatedAt: now,
      };
    });
    setEditingReply(null);
    setEditingReplyDraft("");
    setActiveCommentId(commentId);
    requestAnimationFrame(() => refreshPlanningComments(editor.getHTML()));
  }

  function deleteReply(commentId: string, replyId: string) {
    if (!isEditorReady(editor)) {
      return;
    }

    const confirmed = window.confirm("Você tem certeza que quer excluir esta resposta?");

    if (!confirmed) {
      return;
    }

    const now = new Date().toISOString();
    updatePlanningCommentMark(editor, commentId, (attributes) => {
      const replies = parsePlanningCommentReplies(typeof attributes.replies === "string" ? attributes.replies : "[]");

      return {
        ...attributes,
        replies: serializePlanningCommentReplies(replies.filter((reply) => reply.id !== replyId)),
        updatedAt: now,
      };
    });
    setEditingReply(null);
    setEditingReplyDraft("");
    setActiveCommentId(commentId);
    requestAnimationFrame(() => refreshPlanningComments(editor.getHTML()));
  }

  function deleteComment(commentId: string) {
    if (!isEditorReady(editor)) {
      return;
    }

    const confirmed = window.confirm("Você tem certeza que quer excluir este comentário?");

    if (!confirmed) {
      return;
    }

    updatePlanningCommentMark(editor, commentId, () => null);
    setActiveCommentId(null);
    setEditingCommentId(null);
    requestAnimationFrame(() => refreshPlanningComments(editor.getHTML()));
  }

  function resolveComment(commentId: string) {
    if (!isEditorReady(editor)) {
      return;
    }

    const now = new Date().toISOString();
    updatePlanningCommentMark(editor, commentId, (attributes) => ({
      ...attributes,
      resolvedAt: now,
      updatedAt: now,
    }));
    setActiveCommentId(null);
    setEditingCommentId(null);
    requestAnimationFrame(() => refreshPlanningComments(editor.getHTML()));
  }

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
      PlanningCommentMark,
      DocumentHeaderAttributes,
      PlanningImage.configure({ onImageUpload }),
      PlanningShape,
      PlanningBox,
      PlanningTable,
      PlanningTableRow,
      PlanningTableCell,
      PlanningNote,
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
    [emptyText, onImageUpload],
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
      handleClick: (_view, _position, event) => {
        const target = event.target instanceof HTMLElement ? event.target : null;
        const commentElement = target?.closest<HTMLElement>("[data-planning-comment-id]");
        const commentId = commentElement?.getAttribute("data-planning-comment-id");

        if (commentId) {
          activateComment(commentId, false, true);
        }

        return false;
      },
      handleDrop: (view, event) => {
        const imageFiles = getImageFilesFromFileList(event.dataTransfer?.files);
        const invalidFiles = getInvalidFilesFromFileList(event.dataTransfer?.files);

        if (!imageFiles.length && !invalidFiles.length) {
          return false;
        }

        event.preventDefault();

        if (invalidFiles.length && !imageFiles.length) {
          showEditorToast("Arraste apenas imagens PNG, JPG, JPEG ou WEBP.");
          return true;
        }

        const dropPosition = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void uploadAndInsertImages(imageFiles, dropPosition);

        return true;
      },
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
        const clipboardImageFiles = getImageFilesFromClipboard(event.clipboardData);
        const invalidClipboardFiles = getInvalidFilesFromClipboard(event.clipboardData);

        if (!pasteAsPlainText && (clipboardImageFiles.length || invalidClipboardFiles.length)) {
          event.preventDefault();

          if (!clipboardImageFiles.length) {
            showEditorToast("Cole apenas imagens PNG, JPG, JPEG ou WEBP.");
            return true;
          }

          void uploadAndInsertImages(clipboardImageFiles);
          return true;
        }

        if (!pasteAsPlainText) {
          const html = event.clipboardData?.getData("text/html");

          if (html) {
            if (!isEditorReady(editor)) {
              return false;
            }

            event.preventDefault();
            editor.chain().focus().insertContent(normalizeDocumentHtml(html, sectionKey, clientName, theme)).run();
            return true;
          }
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
      refreshPlanningComments(createdEditor.getHTML());
    },
    onFocus: ({ editor: focusedEditor }) => {
      onActiveEditor(focusedEditor);
      updateFloatingCommentButton(focusedEditor);
    },
    onSelectionUpdate: ({ editor: selectionEditor }) => {
      updateFloatingCommentButton(selectionEditor);
    },
    onUpdate: ({ editor: updatedEditor }) => {
      const nextHtml = normalizeDocumentHtml(updatedEditor.getHTML(), sectionKey, clientName, theme);
      lastSyncedHtmlRef.current = nextHtml;
      refreshPlanningComments(nextHtml);
      updateFloatingCommentButton(updatedEditor);
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
      refreshPlanningComments(normalizedHtml);
    }
  }, [editor, normalizedHtml]);

  useEffect(() => {
    if (!isEditorReady(editor)) {
      return;
    }

    editor.view.dom.querySelectorAll<HTMLElement>(".planning-doc-comment").forEach((element) => {
      const commentId = element.getAttribute("data-planning-comment-id");
      element.classList.toggle("planning-doc-comment-active", Boolean(commentId && commentId === activeCommentId));
    });
  }, [activeCommentId, comments, editor]);

  useEffect(() => {
    if (!editable) {
      return;
    }

    function handleDocumentPointerDown(event: globalThis.MouseEvent) {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (
        target.closest(".copy-document-comments-panel") ||
        target.closest(".copy-document-floating-comment") ||
        target.closest("[data-planning-comment-id]") ||
        target.closest(".copy-document-gadget")
      ) {
        return;
      }

      setActiveCommentId(null);
      latestCommentSelectionRef.current = null;
      setFloatingCommentButton((current) => (current.visible ? { ...current, visible: false } : current));
    }

    document.addEventListener("mousedown", handleDocumentPointerDown);

    return () => {
      document.removeEventListener("mousedown", handleDocumentPointerDown);
    };
  }, [editable]);

  useEffect(() => {
    return () => {
      onActiveEditor(null);
      if (pasteHintTimeoutRef.current) {
        window.clearTimeout(pasteHintTimeoutRef.current);
      }
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
      const imageFiles: File[] = [];

      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => supportedPlanningImageTypes.has(type));

        if (imageType) {
          const blob = await item.getType(imageType);
          imageFiles.push(new File([blob], `imagem-colada.${imageType.split("/")[1] || "png"}`, { type: imageType }));
          continue;
        }

        if (item.types.includes("text/html")) {
          htmlFromClipboard = await (await item.getType("text/html")).text();
          break;
        }

        if (item.types.includes("text/plain")) {
          textFromClipboard = await (await item.getType("text/plain")).text();
        }
      }

      if (imageFiles.length) {
        await uploadAndInsertImages(imageFiles);
        return;
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
      "fixed z-[100] min-w-48 overflow-hidden rounded-xl border border-black/10 bg-white p-1 text-sm text-neutral-900 shadow-sm dark:border-white/10 dark:bg-background dark:text-white";
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const actions = [
      { label: "Colar com formatacao", action: () => pasteFromClipboard(false) },
      { label: "Colar texto puro", action: () => pasteFromClipboard(true) },
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
      ref={documentFrameRef}
      className={cn(
        "copy-document-editor relative border px-7 py-10 shadow-sm sm:px-12 sm:py-14 lg:px-16 lg:py-16",
        theme === "light" ? "copy-document-editor-light border-neutral-200 bg-white text-neutral-950" : "copy-document-editor-dark border-white/10 bg-background text-white",
      )}
    >
      {editable ? (
        <div contentEditable={false} className="copy-document-gadget">
          <input
            ref={gadgetImageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              const imageFiles = getImageFilesFromFileList(event.currentTarget.files);
              const invalidFiles = getInvalidFilesFromFileList(event.currentTarget.files);
              event.currentTarget.value = "";

              if (invalidFiles.length && !imageFiles.length) {
                showEditorToast("Selecione uma imagem PNG, JPG, JPEG ou WEBP.");
                return;
              }

              void uploadAndInsertImages(imageFiles);
              setGadgetOpen(false);
            }}
          />
          <button
            type="button"
            className="copy-document-gadget-trigger"
            aria-label="Adicionar elemento"
            title="Adicionar elemento"
            onClick={() => {
              setGadgetOpen((open) => !open);
              setGadgetTableOpen(false);
              setGadgetShapeOpen(false);
            }}
          >
            <Plus className="h-4 w-4" />
          </button>
          {gadgetOpen ? (
            <div className="copy-document-gadget-menu">
              <button type="button" onClick={() => { insertPlanningNote(); setGadgetOpen(false); }}>
                <StickyNote className="h-4 w-4" />
                Anotação
              </button>
              <button type="button" className="copy-document-comment-gadget-action" onClick={() => openCommentComposer()}>
                <MessageSquare className="h-4 w-4" />
                Comentário
              </button>
              <button type="button" onClick={() => { insertPlanningBox(); setGadgetOpen(false); }}>
                <PanelTop className="h-4 w-4" />
                Caixa de texto
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setGadgetTableOpen((open) => !open);
                    setGadgetShapeOpen(false);
                  }}
                >
                  <Table2 className="h-4 w-4" />
                  Tabela
                </button>
                {gadgetTableOpen ? (
                  <TablePicker
                    className="left-full top-0 ml-2"
                    onSelect={(rows, columns) => {
                      insertPlanningTable(rows, columns);
                      setGadgetTableOpen(false);
                      setGadgetShapeOpen(false);
                      setGadgetOpen(false);
                    }}
                  />
                ) : null}
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setGadgetShapeOpen((open) => !open);
                    setGadgetTableOpen(false);
                  }}
                >
                  <Square className="h-4 w-4" />
                  Formas
                </button>
                {gadgetShapeOpen ? (
                  <div className="copy-document-shape-menu">
                    {[
                      { label: "Quadrado", icon: Square, shape: "square" as const },
                      { label: "Retângulo", icon: RectangleHorizontal, shape: "rectangle" as const },
                      { label: "Círculo", icon: Circle, shape: "circle" as const },
                      { label: "Linha", icon: Minus, shape: "line" as const },
                      { label: "Seta", icon: ArrowRight, shape: "arrow" as const },
                    ].map((item) => {
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.shape}
                          type="button"
                          onClick={() => {
                            insertPlanningShape(item.shape);
                            setGadgetShapeOpen(false);
                            setGadgetOpen(false);
                          }}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <button type="button" onClick={() => gadgetImageInputRef.current?.click()} disabled={uploadingInlineImage || !onImageUpload}>
                <ImageIcon className="h-4 w-4" />
                Imagem
              </button>
              <button type="button" onClick={() => { insertPlanningDivider(); setGadgetOpen(false); }}>
                <Minus className="h-4 w-4" />
                Divisor
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {editable && floatingCommentButton.visible ? (
        <button
          type="button"
          contentEditable={false}
          className="copy-document-floating-comment"
          style={{ top: floatingCommentButton.top }}
          aria-label="Adicionar comentário ao trecho selecionado"
          title="Adicionar comentário"
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={() => openCommentComposer(latestCommentSelectionRef.current)}
        >
          <MessageSquare className="h-4 w-4" />
        </button>
      ) : null}
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
      {editable && (pendingCommentOpen || visibleComments.length > 0) ? (
        <aside contentEditable={false} className="copy-document-comments-panel" aria-label="Comentários do documento">
          {pendingCommentOpen ? (
            <div className="copy-document-comment-card copy-document-comment-card-active">
              <div className="copy-document-comment-card-header">
                <div>
                  <strong>Novo comentário</strong>
                  {pendingCommentSelection?.selectedText ? <span>{pendingCommentSelection.selectedText}</span> : null}
                </div>
                <button
                  type="button"
                  aria-label="Cancelar comentário"
                  title="Cancelar"
                  onClick={() => {
                    setPendingCommentOpen(false);
                    setPendingCommentSelection(null);
                    setDraftComment("");
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <textarea
                value={draftComment}
                onChange={(event) => setDraftComment(event.target.value)}
                placeholder="Escreva o comentário..."
                rows={4}
                autoFocus
              />
              <div className="copy-document-comment-card-footer">
                <button
                  type="button"
                  onClick={() => {
                    setPendingCommentOpen(false);
                    setPendingCommentSelection(null);
                    setDraftComment("");
                  }}
                >
                  Cancelar
                </button>
                <button type="button" data-primary="true" onClick={submitComment}>
                  Comentar
                </button>
              </div>
            </div>
          ) : null}
          {visibleComments.map((comment) => {
            const editing = editingCommentId === comment.id;
            const editingReplyInCard = editingReply?.commentId === comment.id;
            const hasReplyDraft = Boolean(replyDrafts[comment.id]?.trim());
            const active = activeCommentId === comment.id || editing || editingReplyInCard || hasReplyDraft;

            return (
              <div
                key={comment.id}
                data-planning-comment-card-id={comment.id}
                className={cn("copy-document-comment-card", active && "copy-document-comment-card-active")}
                onClick={() => activateComment(comment.id)}
              >
                <div className="copy-document-comment-card-header">
                  <div>
                    <strong>{comment.authorName || "Comentário"}</strong>
                    <span>{formatPlanningCommentDate(comment.updatedAt || comment.createdAt) || "Agora"}</span>
                  </div>
                  <div className="copy-document-comment-actions">
                    <button
                      type="button"
                      aria-label="Editar comentário"
                      title="Editar"
                      onClick={(event) => {
                        event.stopPropagation();
                        beginEditComment(comment);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Resolver comentário"
                      title="Resolver"
                      onClick={(event) => {
                        event.stopPropagation();
                        resolveComment(comment.id);
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Excluir comentário"
                      title="Excluir"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteComment(comment.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {editing ? (
                  <>
                    <textarea
                      value={editingDraft}
                      onChange={(event) => setEditingDraft(event.target.value)}
                      rows={4}
                      autoFocus
                    />
                    <div className="copy-document-comment-card-footer">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingCommentId(null);
                          setEditingDraft("");
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        data-primary="true"
                        onClick={(event) => {
                          event.stopPropagation();
                          saveEditedComment(comment.id);
                        }}
                      >
                        Salvar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>{comment.text}</p>
                    {comment.selectedText ? <small>{`"${comment.selectedText}"`}</small> : null}
                    {comment.replies.length ? (
                      <div className="copy-document-comment-replies">
                        {comment.replies.map((reply) => {
                          const editingThisReply = editingReply?.commentId === comment.id && editingReply.replyId === reply.id;

                          return (
                            <div key={reply.id} className="copy-document-comment-reply">
                              <div className="copy-document-comment-reply-header">
                                <div>
                                  <strong>{reply.authorName || "Resposta"}</strong>
                                  <span>{formatPlanningCommentDate(reply.updatedAt || reply.createdAt) || "Agora"}</span>
                                </div>
                                <div className="copy-document-comment-actions">
                                  <button
                                    type="button"
                                    aria-label="Editar resposta"
                                    title="Editar resposta"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      beginEditReply(comment.id, reply);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label="Excluir resposta"
                                    title="Excluir resposta"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      deleteReply(comment.id, reply.id);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              {editingThisReply ? (
                                <>
                                  <textarea
                                    value={editingReplyDraft}
                                    onChange={(event) => setEditingReplyDraft(event.target.value)}
                                    rows={3}
                                    autoFocus
                                    onFocus={() => setActiveCommentId(comment.id)}
                                  />
                                  <div className="copy-document-comment-card-footer">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setEditingReply(null);
                                        setEditingReplyDraft("");
                                      }}
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      data-primary="true"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        saveEditedReply(comment.id, reply.id);
                                      }}
                                    >
                                      Salvar
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <p>{reply.text}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    <div className="copy-document-comment-response">
                      <textarea
                        value={replyDrafts[comment.id] || ""}
                        onChange={(event) =>
                          setReplyDrafts((current) => ({
                            ...current,
                            [comment.id]: event.target.value,
                          }))
                        }
                        onFocus={() => setActiveCommentId(comment.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey && (replyDrafts[comment.id] || "").trim()) {
                            event.preventDefault();
                            submitReply(comment.id);
                          }
                        }}
                        placeholder="Responder..."
                        rows={2}
                      />
                      {replyDrafts[comment.id]?.trim() ? (
                        <div className="copy-document-comment-card-footer">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setReplyDrafts((current) => ({ ...current, [comment.id]: "" }));
                            }}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            data-primary="true"
                            onClick={(event) => {
                              event.stopPropagation();
                              submitReply(comment.id);
                            }}
                          >
                            Responder
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </aside>
      ) : null}
      {pasteHint ? <div className="copy-document-toast" role="status">{pasteHint}</div> : null}
    </div>
  );
}

type ToolbarProps = {
  editor: Editor | null;
  theme: "dark" | "light";
  className?: string;
  onImageUpload?: (file: File) => Promise<string | null>;
};

function createPlanningTableContent(rows: number, columns: number) {
  return {
    type: "planningTable",
    content: Array.from({ length: rows }, () => ({
      type: "planningTableRow",
      content: Array.from({ length: columns }, () => ({
        type: "planningTableCell",
        content: [{ type: "paragraph" }],
      })),
    })),
  };
}

function TablePicker({
  className,
  onSelect,
}: {
  className?: string;
  onSelect: (rows: number, columns: number) => void;
}) {
  const [hoveredTableSize, setHoveredTableSize] = useState({ rows: 1, columns: 1 });

  return (
    <div className={cn("absolute z-50 w-max rounded-none border border-border bg-background p-3 text-foreground shadow-sm", className)}>
      <div className="mb-2 text-xs font-medium text-muted-foreground">
        {hoveredTableSize.rows} x {hoveredTableSize.columns}
      </div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}
        onMouseLeave={() => setHoveredTableSize({ rows: 1, columns: 1 })}
      >
        {Array.from({ length: 36 }, (_, index) => {
          const row = Math.floor(index / 6) + 1;
          const column = (index % 6) + 1;
          const active = row <= hoveredTableSize.rows && column <= hoveredTableSize.columns;

          return (
            <button
              key={`${row}-${column}`}
              type="button"
              className={cn(
                "h-5 w-5 rounded-none border transition-colors",
                active
                  ? "border-[var(--zacx-accent)] bg-[var(--zacx-accent)]/25"
                  : "border-border bg-background hover:border-muted-foreground",
              )}
              onMouseEnter={() => setHoveredTableSize({ rows: row, columns: column })}
              onClick={() => onSelect(row, column)}
              aria-label={`Inserir tabela ${row} x ${column}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function Toolbar({ editor, theme, className, onImageUpload }: ToolbarProps) {
  const colors = getColorOptions(theme);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [mobileInsertOpen, setMobileInsertOpen] = useState(false);
  const [mobileColorOpen, setMobileColorOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const editorReady = isEditorReady(editor);
  const canUndo = editorReady ? editor.can().undo() : false;
  const canRedo = editorReady ? editor.can().redo() : false;
  const isBoldActive = editorReady ? editor.isActive("bold") : false;
  const isItalicActive = editorReady ? editor.isActive("italic") : false;
  const isUnderlineActive = editorReady ? editor.isActive("underline") : false;
  const iconButtonClass =
    "h-9 w-9 shrink-0 rounded-xl border border-white/10 bg-white/5 p-0 text-muted-foreground transition hover:border-white/20 hover:bg-white/10 hover:text-foreground data-[active=true]:border-[var(--zacx-accent)] data-[active=true]:bg-[var(--zacx-accent)]/15 data-[active=true]:text-foreground dark:border-white/10";
  const desktopIconButtonClass = cn(iconButtonClass, "hidden md:inline-flex");
  const desktopDividerClass = "mx-1 hidden h-6 w-px shrink-0 bg-border md:block";
  const mobileGroupButtonClass =
    "inline-flex h-9 shrink-0 items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition hover:bg-secondary md:hidden";
  const mobilePopoverClass =
    "fixed left-3 right-3 top-[calc(3.5rem+var(--planning-sticky-header-height)+var(--planning-toolbar-height))] z-[120] grid gap-1 border border-border bg-background p-1.5 text-xs shadow-sm md:absolute md:left-auto md:right-auto md:top-10 md:min-w-40";
  const mobilePopoverButtonClass =
    "flex h-8 w-full items-center gap-2 px-2 text-left text-xs text-foreground transition hover:bg-secondary disabled:opacity-45";

  function runEditorCommand(command: (readyEditor: Editor) => void) {
    if (!isEditorReady(editor)) {
      return;
    }

    command(editor);
  }

  async function handleImageFile(file?: File | null) {
    if (!file || !isEditorReady(editor)) {
      return;
    }

    if (!isSupportedPlanningImage(file)) {
      return;
    }

    if (!onImageUpload) {
      return;
    }

    setUploadingImage(true);

    try {
      const publicUrl = await onImageUpload(file);

      if (publicUrl && isEditorReady(editor)) {
        editor.chain().focus().insertContent({
          type: "planningImage",
          attrs: {
            src: publicUrl,
            alt: file.name,
          },
        }).run();
      }
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <div
      className={cn(
        "sticky top-3 z-20 mb-4 flex min-h-12 w-full max-w-full min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-xl border border-black/10 bg-background p-2 shadow-sm dark:border-white/10 md:flex-wrap md:gap-2 md:overflow-visible md:rounded-2xl",
        className,
      )}
      style={{ ["--zacx-accent" as string]: theme === "light" ? lightAccent : darkAccent }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={desktopIconButtonClass}
        disabled={!canUndo}
        onClick={() => runEditorCommand((readyEditor) => readyEditor.chain().focus().undo().run())}
        aria-label="Desfazer"
        title="Desfazer"
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={desktopIconButtonClass}
        disabled={!canRedo}
        onClick={() => runEditorCommand((readyEditor) => readyEditor.chain().focus().redo().run())}
        aria-label="Refazer"
        title="Refazer"
      >
        <Redo2 className="h-4 w-4" />
      </Button>

      <span className={desktopDividerClass} />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          handleImageFile(file);
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={desktopIconButtonClass}
        disabled={!editorReady || uploadingImage || !onImageUpload}
        onClick={() => imageInputRef.current?.click()}
        aria-label="Inserir imagem"
        title="Inserir imagem"
      >
        <ImageIcon className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={desktopIconButtonClass}
        disabled={!editorReady}
        onClick={() =>
          runEditorCommand((readyEditor) =>
            insertBlockContent(readyEditor, {
              type: "planningBox",
              content: [
                {
                  type: "paragraph",
                },
              ],
            }),
          )
        }
        aria-label="Inserir caixa"
        title="Inserir caixa"
      >
        <PanelTop className="h-4 w-4" />
      </Button>
      <div className="relative hidden shrink-0 md:block">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={iconButtonClass}
          disabled={!editorReady}
          onClick={() => setTablePickerOpen((open) => !open)}
          aria-label="Inserir tabela"
          title="Inserir tabela"
        >
          <Table2 className="h-4 w-4" />
        </Button>
        {tablePickerOpen ? (
          <TablePicker
            className="left-0 top-11"
            onSelect={(rows, columns) => {
              runEditorCommand((readyEditor) => insertBlockContent(readyEditor, createPlanningTableContent(rows, columns)));
              setTablePickerOpen(false);
            }}
          />
        ) : null}
      </div>

      <span className={desktopDividerClass} />

      <select
        aria-label="Fonte"
        className="h-9 min-w-[82px] shrink-0 rounded-xl border border-black/10 bg-transparent px-2 text-xs text-foreground outline-none transition hover:border-black/20 dark:border-white/10 dark:hover:border-white/20 md:px-3"
        defaultValue={documentFontFamily}
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
        className="h-9 w-[64px] shrink-0 rounded-xl border border-black/10 bg-transparent px-2 text-xs text-foreground outline-none transition hover:border-black/20 dark:border-white/10 dark:hover:border-white/20 md:w-auto md:px-3"
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
        className="h-9 w-[82px] shrink-0 rounded-xl border border-black/10 bg-transparent px-2 text-xs text-foreground outline-none transition hover:border-black/20 dark:border-white/10 dark:hover:border-white/20 md:w-auto md:px-3"
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

      <div className="relative shrink-0 md:hidden">
        <button
          type="button"
          className={mobileGroupButtonClass}
          onClick={() => {
            setMobileInsertOpen((open) => !open);
            setMobileColorOpen(false);
            setMobileMoreOpen(false);
          }}
        >
          Inserir
        </button>
        {mobileInsertOpen ? (
          <div className={cn(mobilePopoverClass, "md:left-0")}>
            <button
              type="button"
              className={mobilePopoverButtonClass}
              disabled={!editorReady || uploadingImage || !onImageUpload}
              onClick={() => imageInputRef.current?.click()}
            >
              <ImageIcon className="h-4 w-4" />
              Imagem
            </button>
            <button
              type="button"
              className={mobilePopoverButtonClass}
              disabled={!editorReady}
              onClick={() => {
                runEditorCommand((readyEditor) =>
                  insertBlockContent(readyEditor, {
                    type: "planningBox",
                    content: [{ type: "paragraph" }],
                  }),
                );
                setMobileInsertOpen(false);
              }}
            >
              <PanelTop className="h-4 w-4" />
              Caixa
            </button>
            <div className="relative">
              <button
                type="button"
                className={mobilePopoverButtonClass}
                disabled={!editorReady}
                onClick={() => setTablePickerOpen((open) => !open)}
              >
                <Table2 className="h-4 w-4" />
                Tabela
              </button>
              {tablePickerOpen ? (
                <TablePicker
                  className="right-0 top-9"
                  onSelect={(rows, columns) => {
                    runEditorCommand((readyEditor) => insertBlockContent(readyEditor, createPlanningTableContent(rows, columns)));
                    setTablePickerOpen(false);
                    setMobileInsertOpen(false);
                  }}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative shrink-0 md:hidden">
        <button
          type="button"
          className={mobileGroupButtonClass}
          onClick={() => {
            setMobileColorOpen((open) => !open);
            setMobileInsertOpen(false);
            setMobileMoreOpen(false);
          }}
        >
          Cores
        </button>
        {mobileColorOpen ? (
          <div className={cn(mobilePopoverClass, "grid-cols-4 md:right-0")}>
            {colors.map((color) => (
              <button
                key={color.label}
                type="button"
                aria-label={color.label}
                title={color.label}
                className="h-8 w-8 border border-black/10 p-1 transition hover:scale-105 hover:border-black/20 dark:border-white/20 dark:hover:border-white/40"
                disabled={!editorReady}
                onClick={() => {
                  if (color.token) {
                    applySemanticColor(editor, color.token);
                  } else {
                    applyFixedColor(editor, color.value);
                  }
                  setMobileColorOpen(false);
                }}
              >
                <span className="block h-full w-full border border-black/10 dark:border-white/20" style={{ backgroundColor: color.swatch }} />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="relative shrink-0 md:hidden">
        <button
          type="button"
          className={mobileGroupButtonClass}
          onClick={() => {
            setMobileMoreOpen((open) => !open);
            setMobileInsertOpen(false);
            setMobileColorOpen(false);
          }}
        >
          Mais
        </button>
        {mobileMoreOpen ? (
          <div className={cn(mobilePopoverClass, "md:right-0")}>
            {[
              { label: "Desfazer", icon: Undo2, disabled: !canUndo, action: (readyEditor: Editor) => readyEditor.chain().focus().undo().run() },
              { label: "Refazer", icon: Redo2, disabled: !canRedo, action: (readyEditor: Editor) => readyEditor.chain().focus().redo().run() },
              { label: "Negrito", icon: Bold, disabled: !editorReady, action: (readyEditor: Editor) => readyEditor.chain().focus().toggleBold().run() },
              { label: "Itálico", icon: Italic, disabled: !editorReady, action: (readyEditor: Editor) => readyEditor.chain().focus().toggleItalic().run() },
              { label: "Sublinhado", icon: UnderlineIcon, disabled: !editorReady, action: (readyEditor: Editor) => readyEditor.chain().focus().toggleUnderline().run() },
              { label: "Alinhar esquerda", icon: AlignLeft, disabled: !editorReady, action: (readyEditor: Editor) => readyEditor.chain().focus().setTextAlign("left").run() },
              { label: "Centralizar", icon: AlignCenter, disabled: !editorReady, action: (readyEditor: Editor) => readyEditor.chain().focus().setTextAlign("center").run() },
              { label: "Alinhar direita", icon: AlignRight, disabled: !editorReady, action: (readyEditor: Editor) => readyEditor.chain().focus().setTextAlign("right").run() },
              { label: "Lista", icon: List, disabled: !editorReady, action: (readyEditor: Editor) => readyEditor.chain().focus().toggleBulletList().run() },
              { label: "Lista numerada", icon: ListOrdered, disabled: !editorReady, action: (readyEditor: Editor) => readyEditor.chain().focus().toggleOrderedList().run() },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  type="button"
                  className={mobilePopoverButtonClass}
                  disabled={item.disabled}
                  onClick={() => {
                    runEditorCommand(item.action);
                    setMobileMoreOpen(false);
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <span className={desktopDividerClass} />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={desktopIconButtonClass}
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
        className={desktopIconButtonClass}
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
        className={desktopIconButtonClass}
        data-active={isUnderlineActive || undefined}
        disabled={!editorReady}
        onClick={() => runEditorCommand((readyEditor) => readyEditor.chain().focus().toggleUnderline().run())}
      >
        <UnderlineIcon className="h-4 w-4" />
      </Button>

      <div className="hidden shrink-0 items-center gap-1 px-1 md:flex">
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

      <span className={desktopDividerClass} />

      <Button type="button" variant="ghost" size="icon" className={desktopIconButtonClass} disabled={!editorReady} onClick={() => runEditorCommand((readyEditor) => readyEditor.chain().focus().setTextAlign("left").run())}>
        <AlignLeft className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className={desktopIconButtonClass} disabled={!editorReady} onClick={() => runEditorCommand((readyEditor) => readyEditor.chain().focus().setTextAlign("center").run())}>
        <AlignCenter className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className={desktopIconButtonClass} disabled={!editorReady} onClick={() => runEditorCommand((readyEditor) => readyEditor.chain().focus().setTextAlign("right").run())}>
        <AlignRight className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className={desktopIconButtonClass} disabled={!editorReady} onClick={() => runEditorCommand((readyEditor) => readyEditor.chain().focus().toggleBulletList().run())}>
        <List className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className={desktopIconButtonClass} disabled={!editorReady} onClick={() => runEditorCommand((readyEditor) => readyEditor.chain().focus().toggleOrderedList().run())}>
        <ListOrdered className="h-4 w-4" />
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
  onImageUpload,
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
          onImageUpload={onImageUpload}
        />
      ))}
    </div>
  );

  return (
    <div className={cn("w-full min-w-0 max-w-full", !workspaceLayout && "mx-auto max-w-6xl")}>
      {editable ? (
        <Toolbar
          editor={activeEditor}
          theme={activeTheme}
          className={toolbarClassName}
          onImageUpload={onImageUpload}
        />
      ) : null}

      {workspaceLayout ? (
        <div className="grid w-full max-w-full min-w-0 gap-3 px-0 py-3 sm:px-2 md:px-5 md:py-4 lg:grid-cols-[210px_minmax(0,860px)_minmax(0,1fr)] lg:items-start lg:justify-start lg:gap-6 2xl:grid-cols-[220px_minmax(760px,900px)_minmax(220px,1fr)]">
          {sectionNavigation ? (
            <div className={cn("lg:sticky lg:top-[148px] lg:self-start", sectionNavigationClassName)}>
              {sectionNavigation}
            </div>
          ) : (
            <div className="hidden lg:block" />
          )}
          <div className="min-w-0 max-w-full">{renderedSections}</div>
          <div className="hidden lg:block" aria-hidden="true" />
        </div>
      ) : (
        renderedSections
      )}

      <style jsx global>{`
        .tiptap-copy-editor .ProseMirror {
          min-height: 68vh;
          outline: none;
          font-family: var(--font-sora), Sora, var(--font-poppins), Poppins, sans-serif;
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
          font-family: var(--font-sora), Sora, var(--font-poppins), Poppins, sans-serif;
          font-size: clamp(22px, 3vw, 30px);
          line-height: 1.12;
          font-weight: 700;
          letter-spacing: 0;
        }

        .copy-document-fixed-header p {
          margin: 0 !important;
          font-family: var(--font-sora), Sora, var(--font-poppins), Poppins, sans-serif;
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

        .copy-document-gadget {
          position: absolute;
          top: 18px;
          left: 18px;
          z-index: 25;
          font-family: var(--font-poppins), Poppins, sans-serif;
        }

        .copy-document-gadget-trigger {
          display: inline-flex;
          width: 34px;
          height: 34px;
          align-items: center;
          justify-content: center;
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          transition: border-color 160ms ease, background-color 160ms ease;
        }

        .copy-document-gadget-trigger:hover {
          border-color: hsl(var(--foreground) / 0.35);
          background: hsl(var(--secondary));
        }

        .copy-document-gadget-menu {
          position: absolute;
          left: 0;
          top: 42px;
          z-index: 30;
          display: grid;
          min-width: 180px;
          gap: 2px;
          border: 1px solid hsl(var(--border));
          border-radius: 0;
          background: hsl(var(--background));
          padding: 6px;
          box-shadow: 0 12px 34px rgb(0 0 0 / 0.12);
        }

        .copy-document-gadget-menu button {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          border-radius: 0;
          padding: 8px 10px;
          text-align: left;
          font-size: 13px;
          color: hsl(var(--foreground));
          transition: background-color 160ms ease;
        }

        .copy-document-gadget-menu button:hover:not(:disabled) {
          background: hsl(var(--secondary));
        }

        .copy-document-gadget-menu button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .copy-document-shape-menu {
          position: absolute;
          left: 100%;
          top: 0;
          z-index: 35;
          display: grid;
          min-width: 146px;
          gap: 2px;
          border: 1px solid hsl(var(--border));
          border-radius: 0;
          background: hsl(var(--background));
          padding: 6px;
          box-shadow: 0 12px 34px rgb(0 0 0 / 0.12);
          transform: translateX(8px);
        }

        .copy-document-floating-comment {
          position: absolute;
          right: -48px;
          z-index: 24;
          display: inline-flex;
          width: 38px;
          height: 42px;
          align-items: center;
          justify-content: center;
          border: 1px solid hsl(var(--border));
          border-radius: 10px;
          background: #ffffff;
          color: ${lightAccent};
          box-shadow: 0 12px 28px rgb(0 0 0 / 0.12);
          transition: transform 160ms ease, border-color 160ms ease, background-color 160ms ease;
        }

        .copy-document-floating-comment:hover {
          transform: translateX(2px);
          border-color: hsl(var(--foreground) / 0.26);
          background: hsl(var(--background));
        }

        .copy-document-editor-dark .copy-document-floating-comment {
          border-color: rgb(255 255 255 / 0.14);
          background: #242424;
          color: ${darkAccent};
          box-shadow: 0 12px 28px rgb(0 0 0 / 0.24);
        }

        .copy-document-toast {
          position: fixed;
          left: 50%;
          top: 18px;
          z-index: 90;
          transform: translateX(-50%);
          border-radius: 0;
          background: #1d10d7;
          padding: 10px 14px;
          color: #ffffff;
          font-size: 13px;
          font-weight: 500;
          box-shadow: 0 12px 34px rgb(0 0 0 / 0.18);
        }

        .copy-document-comments-panel {
          position: absolute;
          top: 112px;
          left: calc(100% + 18px);
          z-index: 18;
          display: grid;
          width: min(286px, calc(100vw - 32px));
          gap: 10px;
          font-family: var(--font-poppins), Poppins, sans-serif;
        }

        .copy-document-comment-card {
          border: 1px solid hsl(var(--border));
          border-radius: 10px;
          background: #ffffff;
          padding: 12px;
          color: #171717;
          box-shadow: 0 12px 30px rgb(0 0 0 / 0.1);
          opacity: 0.62;
          transition: opacity 180ms ease, border-color 180ms ease, transform 180ms ease;
        }

        .copy-document-editor-dark .copy-document-comment-card {
          border-color: rgb(255 255 255 / 0.12);
          background: #242424;
          color: #ffffff;
          box-shadow: 0 12px 30px rgb(0 0 0 / 0.22);
        }

        .copy-document-comment-card:hover {
          border-color: hsl(var(--foreground) / 0.22);
          opacity: 0.82;
          transform: translateY(-1px);
        }

        .copy-document-comment-card-active {
          border-color: hsl(var(--foreground) / 0.28);
          opacity: 1;
          transform: translateY(-1px);
        }

        .copy-document-editor-dark .copy-document-comment-card:hover {
          border-color: rgb(255 255 255 / 0.24);
        }

        .copy-document-editor-dark .copy-document-comment-card-active {
          border-color: rgb(255 255 255 / 0.32);
        }

        .copy-document-comment-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 9px;
        }

        .copy-document-comment-card-header strong {
          display: block;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.2;
        }

        .copy-document-comment-card-header span {
          display: block;
          margin-top: 2px;
          font-size: 11px;
          color: hsl(var(--muted-foreground));
          line-height: 1.25;
        }

        .copy-document-comment-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .copy-document-comment-card button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 28px;
          border-radius: 7px;
          color: hsl(var(--muted-foreground));
          transition: background-color 160ms ease, color 160ms ease;
        }

        .copy-document-comment-card button:hover {
          background: hsl(var(--secondary));
          color: hsl(var(--foreground));
        }

        .copy-document-comment-card p {
          margin: 0;
          font-size: 13px;
          line-height: 1.5;
          color: inherit;
        }

        .copy-document-comment-card small {
          display: block;
          margin-top: 8px;
          border-left: 2px solid hsl(var(--border));
          padding-left: 8px;
          color: hsl(var(--muted-foreground));
          font-size: 11px;
          line-height: 1.35;
        }

        .copy-document-comment-replies {
          display: grid;
          gap: 8px;
          margin-top: 10px;
          border-top: 1px solid hsl(var(--border));
          padding-top: 10px;
        }

        .copy-document-comment-reply {
          border-left: 2px solid hsl(var(--border));
          padding-left: 10px;
        }

        .copy-document-comment-reply-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 5px;
        }

        .copy-document-comment-reply-header strong {
          display: block;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.2;
        }

        .copy-document-comment-reply-header span {
          display: block;
          margin-top: 1px;
          color: hsl(var(--muted-foreground));
          font-size: 10.5px;
          line-height: 1.2;
        }

        .copy-document-comment-response {
          margin-top: 10px;
        }

        .copy-document-comment-card textarea {
          width: 100%;
          resize: vertical;
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          background: transparent;
          padding: 8px;
          color: inherit;
          font-size: 13px;
          line-height: 1.45;
          outline: none;
        }

        .copy-document-comment-card textarea:focus {
          border-color: ${lightAccent};
        }

        .copy-document-editor-dark .copy-document-comment-card textarea:focus {
          border-color: ${darkAccent};
        }

        .copy-document-comment-card-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 10px;
        }

        .copy-document-comment-card-footer button {
          min-height: 30px;
          border: 1px solid hsl(var(--border));
          padding: 0 10px;
          font-size: 12px;
          font-weight: 600;
        }

        .copy-document-comment-card-footer button[data-primary="true"] {
          border-color: ${lightAccent};
          background: ${lightAccent};
          color: #ffffff;
        }

        .copy-document-editor-dark .copy-document-comment-card-footer button[data-primary="true"] {
          border-color: ${darkAccent};
          background: ${darkAccent};
          color: #050505;
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

        .tiptap-copy-editor .ProseMirror h1,
        .tiptap-copy-editor .ProseMirror h2,
        .tiptap-copy-editor .ProseMirror h3 {
          font-family: var(--font-sora), Sora, var(--font-poppins), Poppins, sans-serif;
          letter-spacing: 0;
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

        .tiptap-copy-editor .ProseMirror .planning-doc-comment {
          cursor: pointer;
          border-radius: 2px;
          background: rgb(245 158 11 / 0.12);
          transition: background-color 160ms ease;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-comment:hover,
        .tiptap-copy-editor .ProseMirror .planning-doc-comment-active {
          background: rgb(245 158 11 / 0.22);
        }

        .copy-document-editor-dark .ProseMirror .planning-doc-comment {
          background: rgb(250 204 21 / 0.13);
        }

        .copy-document-editor-dark .ProseMirror .planning-doc-comment:hover,
        .copy-document-editor-dark .ProseMirror .planning-doc-comment-active {
          background: rgb(250 204 21 / 0.23);
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-comment-resolved,
        .tiptap-copy-editor .ProseMirror:not([contenteditable="true"]) .planning-doc-comment {
          cursor: inherit;
          background: transparent;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-node {
          position: relative;
          display: block;
          max-width: 100%;
          margin: 1.25rem 0;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-node:not([data-planning-image-node]) {
          width: min(100%, 360px);
          border: 1px solid hsl(var(--border));
          border-radius: 0;
          overflow: hidden;
          background: transparent;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-node-cropped {
          overflow: hidden;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-node-selected .planning-doc-image-frame {
          outline: 2px solid ${lightAccent};
          outline-offset: 3px;
        }

        .copy-document-editor-dark .ProseMirror .planning-doc-image-node-selected .planning-doc-image-frame {
          outline-color: ${darkAccent};
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-frame {
          position: relative;
          width: min(var(--planning-image-width, 360px), 100%);
          height: var(--planning-image-height, auto);
          min-width: 80px;
          min-height: 60px;
          max-width: 100%;
          border: 1px solid hsl(var(--border));
          border-radius: 0;
          background: transparent;
          overflow: visible;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-frame-cropped {
          height: var(--planning-image-height, 220px);
          overflow: hidden;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image {
          display: block;
          width: 100%;
          max-width: 100%;
          height: auto;
          margin: 0;
          border: 0;
          border-radius: 0;
          object-fit: contain;
          object-position: center;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-frame-cropped .planning-doc-image {
          height: 100%;
          object-fit: cover;
          object-position: var(--planning-image-object-x, 50%) var(--planning-image-object-y, 50%);
          transform: scale(var(--planning-image-crop-zoom, 1));
          transform-origin: var(--planning-image-object-x, 50%) var(--planning-image-object-y, 50%);
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-node:not([data-planning-image-node]) > .planning-doc-image {
          width: 100%;
          height: auto;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-toolbar,
        .tiptap-copy-editor .ProseMirror .planning-doc-shape-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 5px;
          margin-bottom: 6px;
          font-family: var(--font-poppins), Poppins, sans-serif;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-toolbar button,
        .tiptap-copy-editor .ProseMirror .planning-doc-shape-toolbar button,
        .tiptap-copy-editor .ProseMirror .planning-doc-shape-toolbar label {
          display: inline-flex;
          min-height: 28px;
          align-items: center;
          gap: 5px;
          border: 1px solid hsl(var(--border));
          border-radius: 0;
          background: hsl(var(--background));
          padding: 0 8px;
          color: hsl(var(--foreground));
          font-size: 11px;
          font-weight: 600;
          line-height: 1;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-toolbar button:hover:not(:disabled),
        .tiptap-copy-editor .ProseMirror .planning-doc-shape-toolbar button:hover {
          background: hsl(var(--secondary));
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-toolbar button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-shape-toolbar label span {
          font-size: 10px;
          color: hsl(var(--muted-foreground));
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-shape-toolbar input[type="color"] {
          width: 20px;
          height: 20px;
          border: 0;
          padding: 0;
          background: transparent;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-shape-toolbar select {
          border: 0;
          background: transparent;
          color: inherit;
          font-size: 11px;
          outline: none;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-resize-handles,
        .tiptap-copy-editor .ProseMirror .planning-doc-shape-resize-handles {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-resize-handle {
          position: absolute;
          width: 10px;
          height: 10px;
          border: 1px solid ${lightAccent};
          background: #ffffff;
          pointer-events: auto;
        }

        .copy-document-editor-dark .ProseMirror .planning-doc-image-resize-handle {
          border-color: ${darkAccent};
          background: #151515;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-resize-handle-nw {
          left: -6px;
          top: -6px;
          cursor: nwse-resize;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-resize-handle-n {
          left: 50%;
          top: -6px;
          transform: translateX(-50%);
          cursor: ns-resize;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-resize-handle-ne {
          right: -6px;
          top: -6px;
          cursor: nesw-resize;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-resize-handle-e {
          right: -6px;
          top: 50%;
          transform: translateY(-50%);
          cursor: ew-resize;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-resize-handle-se {
          right: -6px;
          bottom: -6px;
          cursor: nwse-resize;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-resize-handle-s {
          left: 50%;
          bottom: -6px;
          transform: translateX(-50%);
          cursor: ns-resize;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-resize-handle-sw {
          left: -6px;
          bottom: -6px;
          cursor: nesw-resize;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-resize-handle-w {
          left: -6px;
          top: 50%;
          transform: translateY(-50%);
          cursor: ew-resize;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-crop-panel {
          display: grid;
          width: min(360px, 100%);
          gap: 8px;
          margin-top: 8px;
          border: 1px solid hsl(var(--border));
          border-radius: 0;
          background: hsl(var(--background));
          padding: 10px;
          font-family: var(--font-poppins), Poppins, sans-serif;
          font-size: 11px;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-crop-panel label {
          display: grid;
          gap: 4px;
          color: hsl(var(--muted-foreground));
          font-weight: 600;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-crop-panel div {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-crop-panel button {
          border: 1px solid hsl(var(--border));
          border-radius: 0;
          padding: 6px 9px;
          color: hsl(var(--foreground));
          font-size: 11px;
          font-weight: 700;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-image-crop-panel button[data-primary="true"] {
          border-color: ${lightAccent};
          background: ${lightAccent};
          color: #ffffff;
        }

        .copy-document-editor-dark .ProseMirror .planning-doc-image-crop-panel button[data-primary="true"] {
          border-color: ${darkAccent};
          background: ${darkAccent};
          color: #050505;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-shape-node {
          position: relative;
          display: block;
          max-width: 100%;
          margin: 1rem 0;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-shape-node-selected .planning-doc-shape {
          outline: 2px solid ${lightAccent};
          outline-offset: 4px;
        }

        .copy-document-editor-dark .ProseMirror .planning-doc-shape-node-selected .planning-doc-shape {
          outline-color: ${darkAccent};
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-shape {
          position: relative;
          display: block;
          width: min(var(--planning-shape-width, 220px), 100%);
          height: var(--planning-shape-height, 120px);
          max-width: 100%;
          background: var(--planning-shape-fill, #dfff06);
          border: var(--planning-shape-stroke-width, 2px) solid var(--planning-shape-stroke, #1d10d7);
          border-radius: 0;
          cursor: move;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-shape-circle {
          border-radius: 9999px;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-shape-line,
        .tiptap-copy-editor .ProseMirror .planning-doc-shape-arrow {
          height: var(--planning-shape-height, 2px);
          min-height: 2px;
          border: 0;
          border-top: var(--planning-shape-stroke-width, 2px) solid var(--planning-shape-stroke, #1d10d7);
          background: transparent;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-shape-arrow::after {
          content: "";
          position: absolute;
          right: 0;
          top: calc(var(--planning-shape-stroke-width, 2px) * -2.5);
          width: 12px;
          height: 12px;
          border-right: var(--planning-shape-stroke-width, 2px) solid var(--planning-shape-stroke, #1d10d7);
          border-top: var(--planning-shape-stroke-width, 2px) solid var(--planning-shape-stroke, #1d10d7);
          transform: rotate(45deg);
          transform-origin: center;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-box-node {
          display: block;
          margin: 1rem 0;
          max-width: 100%;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-box-node-selected .planning-doc-box {
          outline: 2px solid ${lightAccent};
          outline-offset: 2px;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-box {
          width: min(var(--planning-box-width, 320px), 100%);
          min-width: 160px;
          max-width: 100%;
          min-height: var(--planning-box-height, 160px);
          padding: 1rem;
          border: 1.5px solid hsl(var(--border));
          border-radius: 0;
          background: transparent;
          overflow: auto;
        }

        .tiptap-copy-editor .ProseMirror[contenteditable="true"] .planning-doc-box {
          resize: both;
        }

        .tiptap-copy-editor .ProseMirror:not([contenteditable="true"]) .planning-doc-box {
          resize: none;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-box-handle {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 10px;
          margin: -0.55rem -0.55rem 0.55rem;
          cursor: grab;
          background: transparent;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-box-handle:active {
          cursor: grabbing;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-box-handle span {
          width: 24px;
          height: 5px;
          border-top: 1px solid hsl(var(--muted-foreground));
          border-bottom: 1px solid hsl(var(--muted-foreground));
          opacity: 0.5;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-box-content p:last-child {
          margin-bottom: 0;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-note {
          margin: 1rem 0;
          border-left: 3px solid ${lightAccent};
          border-radius: 0;
          background: color-mix(in srgb, ${lightAccent} 6%, transparent);
          padding: 0.85rem 1rem;
        }

        .copy-document-editor-dark .ProseMirror .planning-doc-note {
          border-left-color: ${darkAccent};
          background: color-mix(in srgb, ${darkAccent} 8%, transparent);
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-note p:last-child {
          margin-bottom: 0;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-table {
          width: 100%;
          margin: 1rem 0;
          border-collapse: collapse;
          table-layout: fixed;
          border-radius: 0;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-table-cell {
          min-width: 120px;
          border: 1.5px solid hsl(var(--border));
          padding: 0.75rem;
          vertical-align: top;
          border-radius: 0;
          overflow: auto;
        }

        .tiptap-copy-editor .ProseMirror[contenteditable="true"] .planning-doc-table-cell {
          resize: both;
        }

        .tiptap-copy-editor .ProseMirror .planning-doc-table-cell p:last-child {
          margin-bottom: 0;
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

        @media (max-width: 1279px) {
          .copy-document-floating-comment {
            right: 12px;
          }

          .copy-document-comments-panel {
            position: static;
            width: 100%;
            margin-top: 20px;
          }
        }

        @media (max-width: 767px) {
          .copy-document-editor {
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
            overflow-x: hidden;
            padding: 1.25rem 1rem 1.5rem !important;
          }

          .copy-document-fixed-header {
            margin-bottom: 20px;
          }

          .copy-document-fixed-header h2 {
            font-size: 20px;
            line-height: 1.15;
          }

          .copy-document-fixed-header p {
            font-size: 12px;
          }

          .tiptap-copy-editor {
            width: 100%;
            max-width: 100%;
            min-width: 0;
            overflow-x: hidden;
          }

          .tiptap-copy-editor .ProseMirror {
            min-height: 58vh;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
            overflow-x: hidden;
            overflow-wrap: anywhere;
            word-break: break-word;
            white-space: normal;
          }

          .tiptap-copy-editor .ProseMirror *,
          .tiptap-copy-editor .ProseMirror *::before,
          .tiptap-copy-editor .ProseMirror *::after {
            box-sizing: border-box;
          }

          .tiptap-copy-editor .ProseMirror p,
          .tiptap-copy-editor .ProseMirror li,
          .tiptap-copy-editor .ProseMirror blockquote {
            font-size: 14px;
            line-height: 1.62;
          }

          .tiptap-copy-editor .ProseMirror h1 {
            font-size: 22px;
            line-height: 1.18;
          }

          .tiptap-copy-editor .ProseMirror h2 {
            font-size: 19px;
            line-height: 1.22;
          }

          .tiptap-copy-editor .ProseMirror h3 {
            font-size: 17px;
            line-height: 1.26;
          }

          .tiptap-copy-editor .ProseMirror img,
          .tiptap-copy-editor .ProseMirror .planning-doc-image,
          .tiptap-copy-editor .ProseMirror .planning-doc-image-frame,
          .tiptap-copy-editor .ProseMirror .planning-doc-image-node {
            max-width: 100%;
          }

          .tiptap-copy-editor .ProseMirror table,
          .tiptap-copy-editor .ProseMirror .planning-doc-table {
            display: block;
            max-width: 100%;
            overflow-x: auto;
          }

          .tiptap-copy-editor .ProseMirror .planning-doc-box,
          .tiptap-copy-editor .ProseMirror .planning-doc-box-node,
          .tiptap-copy-editor .ProseMirror .planning-doc-note,
          .tiptap-copy-editor .ProseMirror .planning-doc-shape-node,
          .tiptap-copy-editor .ProseMirror .planning-doc-image-wrapper {
            max-width: 100%;
          }

          .copy-document-gadget {
            top: 10px;
            left: 10px;
          }

          .copy-document-gadget-trigger {
            width: 30px;
            height: 30px;
            border-radius: 7px;
          }

          .copy-document-gadget-menu {
            max-width: calc(100vw - 48px);
          }

          .copy-document-comment-gadget-action,
          .copy-document-floating-comment,
          .copy-document-comments-panel {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
