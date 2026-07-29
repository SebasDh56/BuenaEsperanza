import {
  PUBLICATION_LIMITS,
  validateImageFile,
} from "./validation.js";

const MAX_LONG_EDGE = 2400;
const MAX_PIXEL_COUNT = 50_000_000;
const TARGET_BYTES = 1.5 * 1024 * 1024;
const WEBP_QUALITIES = [0.84, 0.76, 0.68];

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

function targetDimensions(width, height) {
  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(width, height));

  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
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

    const dimensions = targetDimensions(bitmap.width, bitmap.height);
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

    let processedBlob;

    for (const quality of WEBP_QUALITIES) {
      processedBlob = await canvasToBlob(canvas, quality);

      if (processedBlob.size <= TARGET_BYTES) {
        break;
      }
    }

    if (
      !processedBlob ||
      processedBlob.size > PUBLICATION_LIMITS.outputImageMaxBytes
    ) {
      throw new Error(
        "La imagen procesada sigue siendo demasiado pesada. Elige una imagen más pequeña.",
      );
    }

    return {
      blob: processedBlob,
      height: dimensions.height,
      inputBytes: file.size,
      outputBytes: processedBlob.size,
      width: dimensions.width,
    };
  } finally {
    bitmap.close();
  }
}
