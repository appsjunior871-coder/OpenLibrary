/**
 * Application errors carry an HTTP status and a stable machine-readable code.
 * Messages are user-facing and must never contain secrets or stack traces.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const Errors = {
  badRequest: (message = "Requête invalide.", details?: unknown) => new AppError(400, "bad_request", message, details),
  validation: (details: unknown) => new AppError(422, "validation_error", "Les données envoyées sont invalides.", details),
  unauthorized: (message = "Authentification requise.") => new AppError(401, "unauthorized", message),
  forbidden: (message = "Vous n'avez pas l'autorisation d'effectuer cette action.") =>
    new AppError(403, "forbidden", message),
  notFound: (message = "Ressource introuvable.") => new AppError(404, "not_found", message),
  conflict: (message: string) => new AppError(409, "conflict", message),
  rateLimited: (message = "Limite d'utilisation atteinte. Réessayez plus tard.", retryAfterSeconds?: number) =>
    new AppError(429, "rate_limited", message, { retryAfterSeconds }),
  notConfigured: (message: string) => new AppError(503, "not_configured", message),
  providerError: (message = "Le fournisseur externe n'a pas pu répondre.") =>
    new AppError(502, "provider_error", message),
  noText: (message: string) => new AppError(422, "no_text", message),
  payloadTooLarge: (message = "Le contenu dépasse la taille autorisée.") =>
    new AppError(413, "payload_too_large", message),
  internal: () => new AppError(500, "internal_error", "Une erreur interne est survenue."),
};
