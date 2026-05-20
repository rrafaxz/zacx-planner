export type StoryImageNote = {
  imageId?: string;
  orderIndex?: number;
  displayDate?: string;
  weekday?: string;
};

export type VisualItemNotes = {
  storyImages?: StoryImageNote[];
  weekId?: string;
  weekIndex?: number;
};

export type StoryImageNoteInput = {
  id?: string | null;
  order_index?: number | null;
};

export type StoryImageMetadataInput = {
  date?: string | null;
  displayDate?: string | null;
  weekday?: string | null;
};

type BuildStoryImageNotesOptions = {
  baseNotes?: string | null;
  weekId?: string | null;
  weekIndex?: number | null;
};

export function parseVisualItemNotes(notes?: string | null): VisualItemNotes {
  if (!notes) return {};

  try {
    const parsed = JSON.parse(notes) as VisualItemNotes & {
      presentationWeekId?: string;
      presentationWeekIndex?: number;
    };
    const weekId =
      typeof parsed.weekId === "string"
        ? parsed.weekId
        : typeof parsed.presentationWeekId === "string"
          ? parsed.presentationWeekId
          : undefined;
    const weekIndex =
      typeof parsed.weekIndex === "number"
        ? parsed.weekIndex
        : typeof parsed.presentationWeekIndex === "number"
          ? parsed.presentationWeekIndex
          : undefined;

    return {
      storyImages: Array.isArray(parsed.storyImages) ? parsed.storyImages : [],
      weekId,
      weekIndex,
    };
  } catch {
    return {};
  }
}

export function visualItemWeekMetadata(notes?: string | null) {
  const parsedNotes = parseVisualItemNotes(notes);

  return {
    weekId: parsedNotes.weekId || null,
    weekIndex: typeof parsedNotes.weekIndex === "number" ? parsedNotes.weekIndex : null,
  };
}

export function storyImageMetadata({
  notes,
  imageId,
  orderIndex,
  fallbackDate,
  fallbackWeekday,
}: {
  notes?: string | null;
  imageId?: string | null;
  orderIndex?: number | null;
  fallbackDate?: string | null;
  fallbackWeekday?: string | null;
}) {
  const parsedNotes = parseVisualItemNotes(notes);
  const metadata =
    parsedNotes.storyImages?.find((item) => item.imageId && item.imageId === imageId) ||
    parsedNotes.storyImages?.find((item) => item.orderIndex === orderIndex) ||
    null;

  return {
    displayDate: metadata?.displayDate || fallbackDate || null,
    weekday: metadata?.weekday || fallbackWeekday || null,
  };
}

export function buildStoryImageNotes(
  images: StoryImageNoteInput[],
  metadata: StoryImageMetadataInput[],
  options: BuildStoryImageNotesOptions = {},
) {
  const parsedNotes = parseVisualItemNotes(options.baseNotes);
  const storyImages = images.map((image, index) => ({
    imageId: image.id || undefined,
    orderIndex: image.order_index ?? index,
    displayDate: metadata[index]?.displayDate || metadata[index]?.date || null,
    weekday: metadata[index]?.weekday || null,
  }));

  return JSON.stringify({
    ...parsedNotes,
    weekId: options.weekId ?? parsedNotes.weekId,
    weekIndex: options.weekIndex ?? parsedNotes.weekIndex,
    storyImages,
  });
}

export function buildVisualItemWeekNotes(
  weekId?: string | null,
  weekIndex?: number | null,
  baseNotes?: string | null,
) {
  const parsedNotes = parseVisualItemNotes(baseNotes);

  return JSON.stringify({
    ...parsedNotes,
    weekId: weekId ?? parsedNotes.weekId,
    weekIndex: weekIndex ?? parsedNotes.weekIndex,
  });
}
