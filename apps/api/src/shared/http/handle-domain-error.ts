import { isDomainError } from "../kernel/domain-error";

export function handleDomainError(
  set: { status?: number | string },
  error: unknown,
) {
  if (isDomainError(error)) {
    set.status = error.status;
    return { message: error.message };
  }

  console.error(error);
  set.status = 500;
  return { message: "Falha interna ao processar a operação." };
}
