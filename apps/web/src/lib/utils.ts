import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export {
  formatActiveStatusLabel,
  formatDateOnly,
  formatDateTime,
  formatMinutes,
  formatModulePermissionLabel,
  formatPersonTypeLabel,
  formatTimeEntryOriginLabel,
  formatTimeEntryStatusLabel,
  formatUserRoleLabel,
  formatValidationModeLabel,
} from "@/lib/formatting";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
