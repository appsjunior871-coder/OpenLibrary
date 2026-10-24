import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Adresse e-mail invalide.")
  .max(254);

export const registerSchema = z
  .object({
    displayName: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(80),
    email: emailSchema,
    password: z.string().min(10, "Le mot de passe doit contenir au moins 10 caractères.").max(128),
    passwordConfirmation: z.string(),
    acceptTerms: z.literal(true, { error: "Vous devez accepter les conditions d'utilisation." }),
  })
  .refine((d) => d.password === d.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Les mots de passe ne correspondent pas.",
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Mot de passe requis.").max(128),
});

export const preferencesSchema = z.object({
  uiLocale: z.enum(["fr", "en"]).optional(),
  preferredReadingLanguage: z.string().min(2).max(8).nullable().optional(),
  summaryLanguage: z.string().min(2).max(8).nullable().optional(),
  readerLayout: z.enum(["side", "below"]).optional(),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  preferences: preferencesSchema.optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10).max(128),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1),
  confirmation: z.literal("SUPPRIMER"),
});
