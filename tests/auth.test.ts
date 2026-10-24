import { describe, expect, it, beforeEach } from "vitest";
import { actAs, call, currentSessionToken, registerStudent, STRONG_PASSWORD, uniqueEmail, provisionStaff } from "./helpers";
import { resetRateLimits } from "@/lib/rate-limit";

describe("Authentification", () => {
  beforeEach(() => resetRateLimits());

  it("inscrit un étudiant et ouvre une session (cookie HttpOnly côté serveur)", async () => {
    const { token } = await registerStudent();
    expect(token).toBeTruthy();
    const { GET } = await import("@/app/api/me/route");
    const me = await call(GET, "GET", "/api/me");
    expect(me.status).toBe(200);
    expect(me.data.user.role).toBe("student");
    expect(me.data.user).not.toHaveProperty("passwordHash");
  });

  it("refuse une inscription avec un mot de passe faible ou des mots de passe différents", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    actAs(null);
    const weak = await call(POST, "POST", "/api/auth/register", {
      body: { displayName: "X Y", email: uniqueEmail(), password: "short", passwordConfirmation: "short", acceptTerms: true },
    });
    expect(weak.status).toBe(422);
    const mismatch = await call(POST, "POST", "/api/auth/register", {
      body: { displayName: "X Y", email: uniqueEmail(), password: STRONG_PASSWORD, passwordConfirmation: "Other-pass-99", acceptTerms: true },
    });
    expect(mismatch.status).toBe(422);
  });

  it("ignore toute tentative de choisir un rôle à l'inscription", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    actAs(null);
    const res = await call(POST, "POST", "/api/auth/register", {
      body: {
        displayName: "Pirate",
        email: uniqueEmail("pirate"),
        password: STRONG_PASSWORD,
        passwordConfirmation: STRONG_PASSWORD,
        acceptTerms: true,
        role: "admin",
      },
    });
    expect(res.status).toBe(201);
    expect(res.data.user.role).toBe("student");
  });

  it("refuse les identifiants incorrects avec un message générique", async () => {
    const { email } = await registerStudent();
    const { POST } = await import("@/app/api/auth/login/route");
    actAs(null);
    const bad = await call(POST, "POST", "/api/auth/login", { body: { email, password: "Wrong-password-1" } });
    expect(bad.status).toBe(401);
    expect(bad.data.error.message).toBe("Identifiants incorrects.");
    const unknown = await call(POST, "POST", "/api/auth/login", { body: { email: "nobody@example.org", password: "Wrong-password-1" } });
    expect(unknown.status).toBe(401);
    expect(unknown.data.error.message).toBe("Identifiants incorrects.");
  });

  it("limite les tentatives de connexion abusives", async () => {
    const { email } = await registerStudent();
    const { POST } = await import("@/app/api/auth/login/route");
    actAs(null);
    let last = 0;
    for (let i = 0; i < 6; i++) {
      const r = await call(POST, "POST", "/api/auth/login", { body: { email, password: "Wrong-password-1" } });
      last = r.status;
    }
    expect(last).toBe(429);
  });

  it("la déconnexion invalide effectivement la session", async () => {
    const { token } = await registerStudent();
    const { POST: logout } = await import("@/app/api/auth/logout/route");
    const { GET: me } = await import("@/app/api/me/route");
    actAs(token);
    const out = await call(logout, "POST", "/api/auth/logout");
    expect(out.status).toBe(200);
    expect(currentSessionToken()).toBeNull();
    // Even if the old cookie is replayed, the session row is gone.
    actAs(token);
    const after = await call(me, "GET", "/api/me");
    expect(after.data.user).toBeNull();
  });

  it("un étudiant ne peut pas modifier son rôle via le profil", async () => {
    const { token } = await registerStudent();
    const { PATCH, GET } = await import("@/app/api/me/route");
    actAs(token);
    const res = await call(PATCH, "PATCH", "/api/me", { body: { displayName: "Nouveau nom", role: "admin" } });
    expect(res.status).toBe(200);
    const me = await call(GET, "GET", "/api/me");
    expect(me.data.user.role).toBe("student");
    expect(me.data.user.displayName).toBe("Nouveau nom");
  });

  it("un étudiant ne peut pas accéder aux routes d'administration", async () => {
    const { token } = await registerStudent();
    const { GET } = await import("@/app/api/admin/dashboard/route");
    actAs(token);
    const res = await call(GET, "GET", "/api/admin/dashboard");
    expect(res.status).toBe(403);
    actAs(null);
    const visitor = await call(GET, "GET", "/api/admin/dashboard");
    expect(visitor.status).toBe(401);
  });

  it("un contributeur n'a pas les permissions réservées à l'administrateur", async () => {
    const { token } = await provisionStaff("contributor");
    const { GET: users } = await import("@/app/api/admin/users/route");
    const { GET: dashboard } = await import("@/app/api/admin/dashboard/route");
    actAs(token);
    expect((await call(users, "GET", "/api/admin/users")).status).toBe(403);
    expect((await call(dashboard, "GET", "/api/admin/dashboard")).status).toBe(200);
  });

  it("le changement de mot de passe révoque les autres sessions", async () => {
    const { token, email } = await registerStudent();
    const { POST: login } = await import("@/app/api/auth/login/route");
    actAs(null);
    await call(login, "POST", "/api/auth/login", { body: { email, password: STRONG_PASSWORD } });
    const secondToken = currentSessionToken()!;
    const { POST: changePwd } = await import("@/app/api/me/password/route");
    actAs(token);
    const res = await call(changePwd, "POST", "/api/me/password", { body: { currentPassword: STRONG_PASSWORD, newPassword: "Another-strong-77" } });
    expect(res.status).toBe(200);
    const { GET: me } = await import("@/app/api/me/route");
    actAs(secondToken);
    expect((await call(me, "GET", "/api/me")).data.user).toBeNull();
  });

  it("la suppression de compte anonymise l'utilisateur et ferme la session", async () => {
    const { token } = await registerStudent();
    const { DELETE, GET } = await import("@/app/api/me/route");
    actAs(token);
    const res = await call(DELETE, "DELETE", "/api/me", { body: { password: STRONG_PASSWORD, confirmation: "SUPPRIMER" } });
    expect(res.status).toBe(200);
    actAs(token);
    expect((await call(GET, "GET", "/api/me")).data.user).toBeNull();
  });
});
