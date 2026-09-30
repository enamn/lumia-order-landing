// Resize a chosen logo to a small square PNG/JPEG data URL so it can be stored with the business.
export async function logoToDataUrl(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|svg\+xml)$/.test(file.type)) throw Error("Use a PNG or JPG image.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(Error("We couldn’t read that image.")); i.src = url; });
    const size = 256, canvas = document.createElement("canvas"); canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d"); if (!ctx) throw Error("We couldn’t read that image.");
    const scale = Math.max(size / (img.naturalWidth || size), size / (img.naturalHeight || size)), w = (img.naturalWidth || size) * scale, h = (img.naturalHeight || size) * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    let out = canvas.toDataURL("image/png");
    if (out.length > 150000) { ctx.globalCompositeOperation = "destination-over"; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size); out = canvas.toDataURL("image/jpeg", 0.85); }
    return out;
  } finally { URL.revokeObjectURL(url); }
}
