export function putFile(
  url: string,
  file: File,
  contentType: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Falha no envio ao armazenamento (${xhr.status}).`));
    xhr.onerror = () => reject(new Error("Falha de rede durante o envio."));
    xhr.onabort = () => reject(new Error("Envio cancelado."));
    xhr.send(file);
  });
}

export async function readError(res: Response, fallback: string): Promise<string> {
  const json = await res.json().catch(() => null);
  return (json && typeof json.error === "string" && json.error) || fallback;
}
