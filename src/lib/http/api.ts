import { NextResponse, type NextRequest } from "next/server";
import type { ZodType } from "zod";
import { getAuth, type AuthContext } from "../auth/session";
import { roleHas, type Permission } from "../authz/permissions";
import { getEnv } from "../env";
import { AppError, Errors } from "./errors";

export type ApiHandler<TParams = Record<string, string>> = (ctx: {
  req: NextRequest;
  params: TParams;
  auth: AuthContext | null;
}) => Promise<Response>;

export type ProtectedApiHandler<TParams = Record<string, string>> = (ctx: {
  req: NextRequest;
  params: TParams;
  auth: AuthContext;
}) => Promise<Response>;

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    const headers: Record<string, string> = {};
    const retry = (err.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
    if (err.status === 429 && retry) headers["Retry-After"] = String(retry);
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details ?? null } },
      { status: err.status, headers },
    );
  }
  // Never leak internal details.
  console.error("[api] unhandled error", err);
  const internal = Errors.internal();
  return NextResponse.json(
    { error: { code: internal.code, message: internal.message, details: null } },
    { status: internal.status },
  );
}

/** Basic CSRF protection for cookie-authenticated mutations: Origin must match the app host. */
function assertSameOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // Non-browser clients (tests, curl) do not send Origin; cookies are not auto-attached there.
  const allowed = new Set<string>([new URL(getEnv().APP_URL).origin]);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    allowed.add(`http://${host}`);
    allowed.add(`https://${host}`);
  }
  if (!allowed.has(origin)) {
    throw Errors.forbidden("Origine de la requête non autorisée.");
  }
}

type RouteContext<TParams> = { params: Promise<TParams> };

/** Wraps a public route handler: error handling, auth resolution (optional). */
export function route<TParams = Record<string, string>>(handler: ApiHandler<TParams>) {
  return async (req: NextRequest, ctx: RouteContext<TParams>) => {
    try {
      assertSameOrigin(req);
      const params = ctx?.params ? await ctx.params : ({} as TParams);
      const auth = await getAuth();
      return await handler({ req, params, auth });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Wraps a protected route handler: requires a session and (optionally) a permission. */
export function protectedRoute<TParams = Record<string, string>>(
  permission: Permission | null,
  handler: ProtectedApiHandler<TParams>,
) {
  return async (req: NextRequest, ctx: RouteContext<TParams>) => {
    try {
      assertSameOrigin(req);
      const params = ctx?.params ? await ctx.params : ({} as TParams);
      const auth = await getAuth();
      if (!auth) throw Errors.unauthorized();
      if (permission && !roleHas(auth.user.role, permission)) throw Errors.forbidden();
      return await handler({ req, params, auth });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function parseJson<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw Errors.badRequest("Corps de requête JSON invalide.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw Errors.validation(parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  return parsed.data;
}

export function parseQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  const obj: Record<string, string | string[]> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    const existing = obj[key];
    if (existing === undefined) obj[key] = value;
    else obj[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  });
  const parsed = schema.safeParse(obj);
  if (!parsed.success) {
    throw Errors.validation(parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  return parsed.data;
}
