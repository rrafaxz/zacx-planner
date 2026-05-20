"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Copy, Pencil, X } from "lucide-react";

import { useTheme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  htmlToPlainLines,
  parsePlanningSections,
  updatePlanningVisualItemInSections,
  weekdayForDisplayDate,
  type PlanningVisualEditValues,
  type PlanningVisualItem,
  type PlanningVisualSectionKey,
  type PlanningVisualSections,
  type PlanningVisualSubItem,
  type PlanningVisualType,
} from "./planning-visual-parser";

type PlanningVisualBoardProps = {
  sections: Partial<PlanningVisualSections>;
  clientColor?: string | null;
  clientSecondaryColor?: string | null;
  editable?: boolean;
  onSectionsChange?: (
    sections: PlanningVisualSections,
    changedSection: PlanningVisualSectionKey,
  ) => Promise<void> | void;
  className?: string;
};

const defaultAccent = "#DFFF06";
const weekdayOptions = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof window === "undefined") {
      return;
    }

    const scrollY = window.scrollY;
    const { style } = document.body;
    const originalPosition = style.position;
    const originalTop = style.top;
    const originalLeft = style.left;
    const originalRight = style.right;
    const originalWidth = style.width;
    const originalOverflow = style.overflow;

    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.left = "0";
    style.right = "0";
    style.width = "100%";
    style.overflow = "hidden";

    return () => {
      style.position = originalPosition;
      style.top = originalTop;
      style.left = originalLeft;
      style.right = originalRight;
      style.width = originalWidth;
      style.overflow = originalOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}

function normalizeHexColor(color?: string | null) {
  if (!color || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) {
    return defaultAccent;
  }

  const hex = color.replace("#", "");

  if (hex.length === 3) {
    return `#${hex
      .split("")
      .map((part) => `${part}${part}`)
      .join("")}`;
  }

  return color;
}

function hexToRgb(hexColor: string) {
  const normalized = normalizeHexColor(hexColor).replace("#", "");

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(rgb: { r: number; g: number; b: number }) {
  return `#${[rgb.r, rgb.g, rgb.b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixColors(baseColor: string, targetColor: string, amount: number) {
  const base = hexToRgb(baseColor);
  const target = hexToRgb(targetColor);

  return rgbToHex({
    r: base.r + (target.r - base.r) * amount,
    g: base.g + (target.g - base.g) * amount,
    b: base.b + (target.b - base.b) * amount,
  });
}

function readableTextColor(hexColor: string) {
  const { r, g, b } = hexToRgb(hexColor);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.62 ? "#050505" : "#FFFFFF";
}

function typeColor(
  type: PlanningVisualType,
  clientColor: string,
  secondaryColor: string,
  isLight: boolean,
) {
  if (type === "post") {
    return clientColor;
  }

  if (type === "carousel") {
    return secondaryColor || clientColor;
  }

  if (type === "stories") {
    return isLight ? "#050505" : "#FFFFFF";
  }

  return isLight ? "#111827" : "#E5E7EB";
}

function typeVisualColors(
  type: PlanningVisualType,
  clientColor: string,
  secondaryColor: string,
  isLight: boolean,
) {
  if (type === "stories") {
    return {
      surface: isLight ? "rgba(0, 0, 0, 0.06)" : "rgba(255, 255, 255, 0.08)",
      text: isLight ? "#050505" : "#FFFFFF",
      detail: isLight ? "rgba(0, 0, 0, 0.52)" : "rgba(255, 255, 255, 0.55)",
    };
  }

  const color = typeColor(type, clientColor, secondaryColor, isLight);

  return {
    surface: color,
    text: readableTextColor(color),
    detail: color,
  };
}

function VisualDetailBlock({
  label,
  accentColor,
  copyText,
  copied,
  copyFailed,
  onCopy,
  children,
}: {
  label: string;
  accentColor: string;
  copyText?: string | null;
  copied?: boolean;
  copyFailed?: boolean;
  onCopy?: (text: string) => void;
  children: ReactNode;
}) {
  const canCopy = Boolean(copyText?.trim() && onCopy);

  return (
    <div className="rounded-2xl border border-border bg-background p-4 ring-1 ring-foreground/[0.03]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
          <p
            className="text-xs font-medium uppercase tracking-normal text-muted-foreground"
            style={{ fontFamily: "var(--font-sora), Sora, var(--font-poppins), Poppins, sans-serif" }}
          >
            {label}
          </p>
        </div>
        {canCopy ? (
          <Button
            type="button"
            variant="ghostSecondary"
            size="sm"
            className="-mr-2 h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onCopy?.(copyText || "")}
          >
            {copied ? (
              "Copiado"
            ) : copyFailed ? (
              "Erro"
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span className="sr-only">Copiar {label}</span>
              </>
            )}
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function modalInputClass(multiline = false) {
  return cn(
    "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none transition focus:border-foreground/35",
    multiline ? "min-h-28 resize-y" : "h-10",
  );
}

function displayWeekday(item: PlanningVisualItem) {
  return item.weekday
    ? item.weekday.toUpperCase()
    : weekdayForDisplayDate(item.displayDate || item.date, item.year || undefined);
}

function createDraft(item: PlanningVisualItem): PlanningVisualEditValues {
  return {
    date: item.displayDate || item.date || "",
    weekday: displayWeekday(item) || "",
    typeLabel: item.typeLabel || "",
    theme: item.theme || "",
    objective: item.objective || "",
    caption: item.caption || "",
    script: item.script || "",
    slides: item.slides.length ? item.slides : [{ label: "Slide 1", text: item.theme || "", index: 1 }],
    stories: item.stories.length ? item.stories : [{ label: "Story 1", text: item.content || item.theme || "", index: 1 }],
    scenes: item.scenes,
    storyFormat: item.storyFormat || "",
    content: item.content || "",
  };
}

function updateSubItem(
  items: PlanningVisualSubItem[],
  index: number,
  text: string,
) {
  return items.map((item) => (item.index === index ? { ...item, text } : item));
}

export function PlanningVisualBoard({
  sections,
  clientColor,
  clientSecondaryColor,
  editable = false,
  onSectionsChange,
  className,
}: PlanningVisualBoardProps) {
  const { isLight } = useTheme();
  const [selectedItem, setSelectedItem] = useState<PlanningVisualItem | null>(null);
  const [draft, setDraft] = useState<PlanningVisualEditValues | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);
  const [copyFailedBlock, setCopyFailedBlock] = useState<string | null>(null);
  const accentColor = normalizeHexColor(clientColor);
  const secondaryAccentColor = clientSecondaryColor
    ? normalizeHexColor(clientSecondaryColor)
    : accentColor;
  const items = useMemo(() => parsePlanningSections(sections), [sections]);
  const parsedLines = useMemo(
    () =>
      Object.values(sections).flatMap((sectionContent) =>
        htmlToPlainLines(sectionContent || ""),
      ),
    [sections],
  );
  const lineCount = parsedLines.length;
  const firstDebugLines = parsedLines.slice(0, 5);
  const selectedColors = selectedItem
    ? typeVisualColors(selectedItem.type, accentColor, secondaryAccentColor, isLight)
    : {
        surface: accentColor,
        text: readableTextColor(accentColor),
        detail: accentColor,
      };
  const overlayColor = isLight ? "rgba(0, 0, 0, 0.35)" : "rgba(0, 0, 0, 0.55)";

  useBodyScrollLock(Boolean(selectedItem));

  useEffect(() => {
    if (!selectedItem) {
      setDraft(null);
      setItemError(null);
      setIsEditing(false);
      setShowSaveConfirm(false);
      setCopiedBlock(null);
      setCopyFailedBlock(null);
      return;
    }

    setDraft(createDraft(selectedItem));
    setItemError(null);
    setIsEditing(false);
    setShowSaveConfirm(false);
    setCopiedBlock(null);
    setCopyFailedBlock(null);
  }, [selectedItem]);

  async function copyBlockText(blockId: string, text: string) {
    if (!text.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedBlock(blockId);
      setCopyFailedBlock(null);
      window.setTimeout(() => {
        setCopiedBlock((current) => (current === blockId ? null : current));
      }, 1800);
    } catch {
      setCopyFailedBlock(blockId);
      window.setTimeout(() => {
        setCopyFailedBlock((current) => (current === blockId ? null : current));
      }, 1800);
    }
  }

  function copyProps(blockId: string, text?: string | null) {
    return {
      copyText: text || "",
      copied: copiedBlock === blockId,
      copyFailed: copyFailedBlock === blockId,
      onCopy: (value: string) => copyBlockText(blockId, value),
    };
  }

  async function saveSelectedItem() {
    if (!selectedItem || !draft || !onSectionsChange) {
      return;
    }

    setSavingItem(true);
    setItemError(null);

    try {
      const nextSections = updatePlanningVisualItemInSections(sections, selectedItem, draft);
      await onSectionsChange(nextSections, selectedItem.sourceSection as PlanningVisualSectionKey);
      const refreshedItem = parsePlanningSections(nextSections).find(
        (item) =>
          item.id === selectedItem.id ||
          (item.sourceSection === selectedItem.sourceSection &&
            item.sourceStartLine === selectedItem.sourceStartLine),
      );
      setSelectedItem(refreshedItem || null);
      setIsEditing(false);
      setShowSaveConfirm(false);
    } catch (error) {
      setItemError(error instanceof Error ? error.message : "Nao foi possivel salvar as alteracoes.");
    } finally {
      setSavingItem(false);
    }
  }

  function cancelEditing() {
    if (selectedItem) {
      setDraft(createDraft(selectedItem));
    }

    setIsEditing(false);
    setShowSaveConfirm(false);
    setItemError(null);
  }

  if (!items.length) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-secondary">
          <CalendarDays className="h-5 w-5" />
        </div>
        Nenhum item identificado. Foram lidas {lineCount} linhas, mas nenhum cabeçalho com data + tipo foi encontrado.
        {process.env.NODE_ENV === "development" ? (
          <div className="mt-4 space-y-2 text-left text-xs text-muted-foreground/80">
            <p>Exemplo esperado: 15/05 (Sexta) — CARROSSEL ou 14/05 - POST.</p>
            {firstDebugLines.length ? (
              <div className="rounded-xl border border-border bg-secondary/30 p-3">
                <p className="mb-2 font-medium text-muted-foreground">Primeiras linhas lidas:</p>
                <ol className="space-y-1">
                  {firstDebugLines.map((line, index) => (
                    <li key={`${line}-${index}`}>
                      {index + 1}. {line}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          const colors = typeVisualColors(item.type, accentColor, secondaryAccentColor, isLight);
          const weekday = displayWeekday(item);
          const displayDate = item.displayDate || item.date;
          const cardTitle = item.type === "stories" ? item.storyFormat || item.theme : item.theme;
          const typeTextColor =
            item.type === "post" || item.type === "carousel"
              ? isLight
                ? "#050505"
                : "#FFFFFF"
              : colors.detail;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedItem(item)}
              className="group flex aspect-[1.04/1] min-h-[132px] flex-col overflow-hidden rounded-xl border border-neutral-900 bg-background text-center shadow-none transition hover:-translate-y-0.5 hover:border-black hover:bg-secondary/20 dark:border-white/30 dark:hover:border-white/40 sm:min-h-[220px] sm:rounded-2xl"
              style={{ fontFamily: "var(--font-sora), Sora, var(--font-poppins), Poppins, sans-serif" }}
            >
              <div
                className="flex min-h-9 items-center justify-center border-b border-neutral-900 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-normal dark:border-white/30 sm:min-h-14 sm:px-4 sm:py-3 sm:text-sm md:text-base"
                style={{ backgroundColor: colors.surface, color: colors.text }}
              >
                <span>{weekday ? `${weekday} | ${displayDate}` : displayDate}</span>
              </div>
              <div className="flex flex-1 flex-col justify-center p-2.5 sm:p-5 md:p-6">
                <div className="grid place-items-center">
                  <span
                    className="sora-heading text-center text-sm font-semibold tracking-normal sm:text-2xl md:text-[1.7rem]"
                    style={{ color: typeTextColor }}
                  >
                    {item.typeLabel}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-3 text-center text-[11px] font-medium leading-4 text-foreground sm:mt-4 sm:text-sm sm:leading-6 md:text-base">
                  {cardTitle || "Tema não informado"}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {selectedItem && typeof document !== "undefined" ? createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-6"
          onClick={() => setSelectedItem(null)}
          style={{ backgroundColor: overlayColor }}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-foreground/20 bg-background p-4 shadow-none md:p-6"
            onClick={(event) => event.stopPropagation()}
            style={{ fontFamily: "var(--font-sora), Sora, var(--font-poppins), Poppins, sans-serif" }}
          >
              <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-5">
              <div>
                <p
                  className="inline-flex rounded-xl border border-foreground/20 px-3 py-2 text-sm font-medium uppercase tracking-normal"
                  style={{ backgroundColor: selectedColors.surface, color: selectedColors.text }}
                >
                  {displayWeekday(selectedItem)
                    ? `${displayWeekday(selectedItem)} | ${selectedItem.displayDate || selectedItem.date}`
                    : selectedItem.displayDate || selectedItem.date}
                </p>
                <h3 className="sora-heading mt-4 text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
                  {selectedItem.typeLabel}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {editable && onSectionsChange && !isEditing ? (
                  <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditing(true)} aria-label="Editar" title="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Editar</span>
                  </Button>
                ) : null}
                <Button type="button" variant="ghostSecondary" size="icon" onClick={() => setSelectedItem(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {itemError ? (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                  {itemError}
                </div>
              ) : null}

              {isEditing && draft ? (
                <VisualDetailBlock label="Dados do card" accentColor={selectedColors.detail}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-xs font-medium uppercase text-muted-foreground">
                      Data
                      <input
                        value={draft.date}
                        onChange={(event) =>
                          setDraft((current) => (current ? { ...current, date: event.target.value } : current))
                        }
                        className={modalInputClass(false)}
                        placeholder="DD/MM"
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs font-medium uppercase text-muted-foreground">
                      Dia
                      <select
                        value={draft.weekday}
                        onChange={(event) =>
                          setDraft((current) => (current ? { ...current, weekday: event.target.value } : current))
                        }
                        className={modalInputClass(false)}
                      >
                        <option value="">Sem dia</option>
                        {weekdayOptions.map((weekday) => (
                          <option key={weekday} value={weekday}>
                            {weekday}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </VisualDetailBlock>
              ) : null}

              {selectedItem.storyFormat || selectedItem.content ? (
                <>
                  <VisualDetailBlock label="Formato" accentColor={selectedColors.detail}>
                    {isEditing && draft ? (
                      <input
                        value={draft.storyFormat || ""}
                        onChange={(event) =>
                          setDraft((current) =>
                            current ? { ...current, storyFormat: event.target.value } : current,
                          )
                        }
                        className={modalInputClass(false)}
                      />
                    ) : (
                      <p className="text-sm leading-6 text-foreground">{selectedItem.storyFormat}</p>
                    )}
                  </VisualDetailBlock>

                  <VisualDetailBlock label="Tema da semana" accentColor={selectedColors.detail}>
                    <p className="text-sm leading-6 text-foreground">
                      {selectedItem.weekTheme || "Tema da semana nao informado"}
                    </p>
                  </VisualDetailBlock>

                  <VisualDetailBlock
                    label="Texto"
                    accentColor={selectedColors.detail}
                    {...copyProps("story-content", isEditing && draft ? draft.content : selectedItem.content)}
                  >
                    {isEditing && draft ? (
                      <textarea
                        value={draft.content || ""}
                        onChange={(event) =>
                          setDraft((current) =>
                            current ? { ...current, content: event.target.value, caption: event.target.value } : current,
                          )
                        }
                        className={modalInputClass(true)}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                        {selectedItem.content}
                      </p>
                    )}
                  </VisualDetailBlock>
                </>
              ) : (
                <>
                  <VisualDetailBlock
                    label="Objetivo"
                    accentColor={selectedColors.detail}
                    {...copyProps("objective", isEditing && draft ? draft.objective : selectedItem.objective)}
                  >
                    {isEditing && draft ? (
                      <textarea
                        value={draft.objective}
                        onChange={(event) =>
                          setDraft((current) => (current ? { ...current, objective: event.target.value } : current))
                        }
                        className={modalInputClass(true)}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                        {selectedItem.objective || "Objetivo nao informado"}
                      </p>
                    )}
                  </VisualDetailBlock>

                  {selectedItem.type === "post" ||
                  selectedItem.type === "video" ||
                  selectedItem.type === "photos" ||
                  selectedItem.type === "traffic" ? (
                    <VisualDetailBlock
                      label="Tema"
                      accentColor={selectedColors.detail}
                      {...copyProps("theme", isEditing && draft ? draft.theme : selectedItem.theme)}
                    >
                      {isEditing && draft ? (
                        <textarea
                          value={draft.theme}
                          onChange={(event) =>
                            setDraft((current) => (current ? { ...current, theme: event.target.value } : current))
                          }
                          className={modalInputClass(true)}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                          {selectedItem.theme || "Tema não informado"}
                        </p>
                      )}
                    </VisualDetailBlock>
                  ) : null}

                  {selectedItem.type === "carousel" && draft
                    ? draft.slides.map((slide) => (
                        <VisualDetailBlock
                          key={slide.index}
                          label={slide.label}
                          accentColor={selectedColors.detail}
                          {...copyProps(`slide-${slide.index}`, slide.text)}
                        >
                          {isEditing ? (
                            <textarea
                              value={slide.text}
                              onChange={(event) =>
                                setDraft((current) =>
                                  current
                                    ? { ...current, slides: updateSubItem(current.slides, slide.index, event.target.value) }
                                    : current,
                                )
                              }
                              className={modalInputClass(true)}
                            />
                          ) : (
                            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{slide.text}</p>
                          )}
                        </VisualDetailBlock>
                      ))
                    : null}

                  {selectedItem.type === "stories" && draft && !selectedItem.content
                    ? draft.stories.map((story) => (
                        <VisualDetailBlock
                          key={story.index}
                          label={story.label}
                          accentColor={selectedColors.detail}
                          {...copyProps(`story-${story.index}`, story.text)}
                        >
                          {isEditing ? (
                            <textarea
                              value={story.text}
                              onChange={(event) =>
                                setDraft((current) =>
                                  current
                                    ? { ...current, stories: updateSubItem(current.stories, story.index, event.target.value) }
                                    : current,
                                )
                              }
                              className={modalInputClass(true)}
                            />
                          ) : (
                            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{story.text}</p>
                          )}
                        </VisualDetailBlock>
                      ))
                    : null}

                  {selectedItem.type === "video" ? (
                    <VisualDetailBlock
                      label="Roteiro"
                      accentColor={selectedColors.detail}
                      {...copyProps("script", isEditing && draft ? draft.script : selectedItem.script)}
                    >
                      {isEditing && draft ? (
                        <textarea
                          value={draft.script}
                          onChange={(event) =>
                            setDraft((current) => (current ? { ...current, script: event.target.value } : current))
                          }
                          className={modalInputClass(true)}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                          {selectedItem.script || "Roteiro nao informado"}
                        </p>
                      )}
                    </VisualDetailBlock>
                  ) : null}

                  <VisualDetailBlock
                    label="Legenda"
                    accentColor={selectedColors.detail}
                    {...copyProps("caption", isEditing && draft ? draft.caption : selectedItem.caption)}
                  >
                    {isEditing && draft ? (
                      <textarea
                        value={draft.caption}
                        onChange={(event) =>
                          setDraft((current) => (current ? { ...current, caption: event.target.value } : current))
                        }
                        className={modalInputClass(true)}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                        {selectedItem.caption || "Legenda nao informada"}
                      </p>
                    )}
                  </VisualDetailBlock>
                </>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border/70 pt-5 sm:flex-row sm:justify-end">
              {isEditing ? (
                <>
                  <Button type="button" variant="ghostSecondary" onClick={cancelEditing} disabled={savingItem}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setShowSaveConfirm(true)}
                    disabled={savingItem || !draft}
                  >
                    Salvar alterações
                  </Button>
                </>
              ) : (
                <Button type="button" variant="ghostSecondary" onClick={() => setSelectedItem(null)} disabled={savingItem}>
                  Fechar
                </Button>
              )}
            </div>
          </div>

          {showSaveConfirm ? (
            <div
              className="fixed inset-0 z-[110] flex items-end justify-center p-3 sm:items-center sm:p-4"
              onClick={(event) => {
                event.stopPropagation();
                setShowSaveConfirm(false);
              }}
              style={{ backgroundColor: overlayColor }}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-border/70 bg-background p-4 shadow-none sm:p-5"
                onClick={(event) => event.stopPropagation()}
                style={{ fontFamily: "var(--font-sora), Sora, var(--font-poppins), Poppins, sans-serif" }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedColors.detail }} />
                  <p className="text-sm font-medium text-muted-foreground">Salvar no documento</p>
                </div>
                <h4 className="sora-heading text-xl font-semibold text-foreground">
                  Deseja salvar estas alterações no documento original?
                </h4>
                <div className="mt-6 flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="ghostSecondary"
                    onClick={() => setShowSaveConfirm(false)}
                    disabled={savingItem}
                  >
                    Cancelar
                  </Button>
                  <Button type="button" onClick={saveSelectedItem} disabled={savingItem}>
                    {savingItem ? "Salvando..." : "Salvar alterações"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
	        </div>
	      , document.body) : null}
    </div>
  );
}
