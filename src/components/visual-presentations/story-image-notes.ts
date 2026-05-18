export type StoryImageNote = {
  imageId?: string;
  orderIndex?: number;
  displayDate?: string;
  weekday?: string;
};

type VisualItemNotes = {
  storyImages?: StoryImageNote[];
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

export function parseVisualItemNotes(notes?: string | null): VisualItemNotes {
  if (!notes) return {};

  try {
    const parsed = JSON.parse(notes) as VisualItemNotes;

    return {
      storyImages: Array.isArray(parsed.storyImages) ? parsed.storyImages : [],
    };
  } catch {
    return {};
  }
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
) {
  const storyImages = images.map((image, index) => ({
    imageId: image.id || undefined,
    orderIndex: image.order_index ?? index,
    displayDate: metadata[index]?.displayDate || metadata[index]?.date || null,
    weekday: metadata[index]?.weekday || null,
  }));

  return JSON.stringify({ storyImages });
}
