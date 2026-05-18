export type OptimizeImageKind = "client-logo" | "post" | "carousel" | "stories";

type ImageOptimizationConfig = {
  maxHeight: number;
  maxWidth: number;
  quality: number;
};

const optimizationConfigByKind: Record<OptimizeImageKind, ImageOptimizationConfig> = {
  "client-logo": {
    maxHeight: 512,
    maxWidth: 512,
    quality: 0.82,
  },
  post: {
    maxHeight: 1350,
    maxWidth: 1080,
    quality: 0.84,
  },
  carousel: {
    maxHeight: 1350,
    maxWidth: 1080,
    quality: 0.84,
  },
  stories: {
    maxHeight: 1920,
    maxWidth: 1080,
    quality: 0.84,
  },
};

function safeBaseFileName(fileName: string) {
  const fallbackName = "image";
  const name = fileName.split(/[/\\]/).pop() || fallbackName;
  const withoutExtension = name.replace(/\.[^.]+$/, "") || fallbackName;

  return (
    withoutExtension
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-") || fallbackName
  );
}

function optimizedFileName(fileName: string, extension: "jpg" | "webp") {
  return `${safeBaseFileName(fileName)}.${extension}`;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function decodeImage(file: File) {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file);
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function calculateTargetSize(width: number, height: number, config: ImageOptimizationConfig) {
  const scale = Math.min(1, config.maxWidth / width, config.maxHeight / height);

  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

export async function optimizeImage(file: File, kind: OptimizeImageKind) {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  try {
    const config = optimizationConfigByKind[kind];
    const image = await decodeImage(file);
    const sourceWidth = image.width;
    const sourceHeight = image.height;

    if (!sourceWidth || !sourceHeight) {
      return file;
    }

    const targetSize = calculateTargetSize(sourceWidth, sourceHeight, config);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });

    if (!context) {
      return file;
    }

    canvas.width = targetSize.width;
    canvas.height = targetSize.height;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, targetSize.width, targetSize.height);

    if ("close" in image && typeof image.close === "function") {
      image.close();
    }

    const webpBlob = await canvasToBlob(canvas, "image/webp", config.quality);

    if (webpBlob?.type === "image/webp") {
      return new File([webpBlob], optimizedFileName(file.name, "webp"), {
        lastModified: Date.now(),
        type: "image/webp",
      });
    }

    const jpegBlob = await canvasToBlob(canvas, "image/jpeg", config.quality);

    if (jpegBlob) {
      return new File([jpegBlob], optimizedFileName(file.name, "jpg"), {
        lastModified: Date.now(),
        type: "image/jpeg",
      });
    }
  } catch {
    return file;
  }

  return file;
}
