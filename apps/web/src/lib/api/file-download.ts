"use client";

import { httpClient } from "./http-client";
import { normalizeQueryParams } from "./query-cache";

function extractFileName(contentDisposition?: string) {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const asciiMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return asciiMatch?.[1] ?? null;
}

export async function downloadAuthenticatedFile(
  path: string,
  options: {
    params?: Record<string, string | undefined>;
    fallbackFileName: string;
  },
) {
  const response = await httpClient.get<BlobPart>(path, {
    params: normalizeQueryParams(options.params),
    responseType: "blob",
  });
  const contentType = response.headers["content-type"];
  const contentDisposition = response.headers["content-disposition"];
  const fileName =
    extractFileName(
      typeof contentDisposition === "string" ? contentDisposition : undefined,
    ) ?? options.fallbackFileName;
  const blob =
    response.data instanceof Blob
      ? response.data
      : new Blob([response.data], {
          type:
            typeof contentType === "string"
              ? contentType
              : "application/octet-stream",
        });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = fileName;
  link.rel = "noopener noreferrer";
  document.body.append(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);

  return fileName;
}
