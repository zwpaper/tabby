import { apiClient } from "../auth-client";

export function base64toFile(
  base64: string,
  filename: string,
  mimeType: string,
): File {
  const arr = base64.split(",");
  let b64string = base64;
  let finalMimeType = mimeType;

  if (arr.length > 1 && arr[0].startsWith("data:")) {
    finalMimeType = arr[0].match(/:(.*?);/)?.[1] || mimeType;
    b64string = arr[1];
  }

  const bstr = atob(b64string);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: finalMimeType });
}

export async function uploadBase64EncodedImage({
  base64,
  mimeType,
  fileName,
  abortController,
}: {
  base64: string;
  mimeType: string;
  fileName?: string;
  abortController?: AbortController;
}) {
  try {
    const signal = abortController?.signal;

    const file = base64toFile(base64, mimeType, fileName ?? "screenshot");
    const response = await apiClient.api.upload.$post({
      form: {
        image: file,
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
    const data = await response.json();
    return data.image;
  } catch (e) {
    // do nothing
  }
}
