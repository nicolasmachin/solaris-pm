// Comprime una imagen en el cliente antes de subirla: redibuja en un canvas
// limitando el lado mayor a `maxWidth` y exporta JPEG con la calidad indicada.
// Reduce drásticamente el peso de las fotos tomadas desde el celular del
// técnico en obra (típicamente 3-6 MB → ~300 KB) sin sacrificar utilidad.

export interface ImagenComprimida {
  blob: Blob;
  /** Nombre con el que subir, ya con la extensión que corresponde al blob. */
  filename: string;
}

/**
 * Devuelve el archivo listo para subir.
 *
 * Si el navegador no puede decodificar la imagen, se sube el original sin
 * comprimir en vez de fallar. El caso real es el HEIC del iPhone: Safari lo
 * decodifica (así que ahí se comprime como cualquier foto), pero Chrome y
 * Firefox no, y antes eso hacía que la foto se perdiera con un error genérico.
 * El servidor lo convierte a JPEG al recibirlo.
 */
export async function compressImage(
  file: File,
  maxWidth: number = 1600,
  quality: number = 0.8,
): Promise<ImagenComprimida> {
  const sinExtension = file.name.replace(/\.[^.]+$/, "");

  try {
    const blob = await redibujarComoJpeg(file, maxWidth, quality);
    return { blob, filename: `${sinExtension}.jpg` };
  } catch {
    return { blob: file, filename: file.name };
  }
}

function redibujarComoJpeg(file: File, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxWidth || height > maxWidth) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxWidth) / height);
          height = maxWidth;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
        "image/jpeg",
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };

    img.src = objectUrl;
  });
}
