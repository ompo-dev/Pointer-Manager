"use client";

import { toast } from "sonner";

export type AppToastId = string | number;

interface AppToastOptions {
  id?: AppToastId;
  description?: string;
  duration?: number;
}

function buildOptions(options?: AppToastOptions) {
  return {
    id: options?.id,
    description: options?.description,
    duration: options?.duration,
  };
}

export function showLoadingToast(
  title: string,
  description?: string,
  options?: Omit<AppToastOptions, "duration">,
) {
  return toast.loading(title, buildOptions({ ...options, description }));
}

export function showSuccessToast(
  title: string,
  description?: string,
  options?: AppToastOptions,
) {
  return toast.success(title, buildOptions({ ...options, description }));
}

export function showErrorToast(
  title: string,
  description?: string,
  options?: AppToastOptions,
) {
  return toast.error(title, buildOptions({ ...options, description }));
}

export function showWarningToast(
  title: string,
  description?: string,
  options?: AppToastOptions,
) {
  return toast.warning(title, buildOptions({ ...options, description }));
}

export function showInfoToast(
  title: string,
  description?: string,
  options?: AppToastOptions,
) {
  return toast.info(title, buildOptions({ ...options, description }));
}

export function dismissToast(id?: AppToastId) {
  if (id !== undefined) {
    toast.dismiss(id);
    return;
  }

  toast.dismiss();
}
