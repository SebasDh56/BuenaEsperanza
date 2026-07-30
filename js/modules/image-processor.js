import {
  PUBLICATION_LIMITS,
  validateImageFile,
} from "./validation.js";

const MAX_LONG_EDGE = 2400;
const THUMBNAIL_LONG_EDGE = 720;
const MAX_PIXEL_COUNT = 50_000_000;
const TARGET_BYTES = 1.5 * 1024 * 1024;
const THUMBNAIL_TARGET_BYTES = 220 * 1024;
const WEBP_QUALITIES = [0.84, 0.76, 0.68];
const THUMBNAIL_QUALITIES = [0.8, 0.7, 0.6];

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== "image/webp") {
          reject(
            new Error("Este navegador no pudo generar una imagen WebP segura."),
          );
          return;
        }

        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

async function loadBitmap(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return createImageBitmap(file);
  }
}

function targetDimensions(width, height, maxLongEdge) {
  const scale = Math.min(1, maxLongEdge / Math.max(width, height));

  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

async function renderVariant(bitmap, maxLongEdge, targetBytes, qualities) {
  const dimensions = targetDimensions(bitmap.width, bitmap.height, maxLongEdge);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    throw new Error("No se pudo preparar el procesador de imágenes.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let blob;

  for (const quality of qualities) {
    blob = await canvasToBlob(canvas, quality);
    if (blob.size <= targetBytes) break;
  }

  return { blob, ...dimensions };
}

export async function processPublicationImage(file) {
  const validationError = validateImageFile(file);

  if (validationError) {
    throw new Error(validationError);
  }

  const bitmap = await loadBitmap(file);

  try {
    if (
      bitmap.width < 1 ||
      bitmap.height < 1 ||
      bitmap.width * bitmap.height > MAX_PIXEL_COUNT
    ) {
      throw new Error(
        "La imagen tiene dimensiones demasiado grandes para procesarla con seguridad.",
      );
    }

    const main = await renderVariant(
      bitmap,
      MAX_LONG_EDGE,
      TARGET_BYTES,
      WEBP_QUALITIES,
    );
    const thumbnail = await renderVariant(
      bitmap,
      THUMBNAIL_LONG_EDGE,
      THUMBNAIL_TARGET_BYTES,
      THUMBNAIL_QUALITIES,
    );

    if (
      !main.blob ||
      main.blob.size > PUBLICATION_LIMITS.outputImageMaxBytes ||
      !thumbnail.blob ||
      thumbnail.blob.size > 1024 * 1024
    ) {
      throw new Error(
        "La imagen procesada sigue siendo demasiado pesada. Elige una imagen más pequeña.",
      );
    }

    return {
      blob: main.blob,
      height: main.height,
      inputBytes: file.size,
      outputBytes: main.blob.size,
      thumbnailBlob: thumbnail.blob,
      thumbnailBytes: thumbnail.blob.size,
      thumbnailHeight: thumbnail.height,
      thumbnailWidth: thumbnail.width,
      width: main.width,
    };
  } finally {
    bitmap.close();
  }
}
