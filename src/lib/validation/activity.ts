import { z } from "zod";
import { REPORT_STATUSES } from "../db/schema";

export const documentRequestSchema = z.object({
  title: z.string().trim().min(2).max(250),
  author: z.string().trim().max(200).optional().nullable(),
  domain: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().min(10, "Décrivez votre demande en au moins 10 caractères.").max(3000),
});

export const resolveRequestSchema = z.object({
  status: z.enum(["accepted", "refused"]),
  response: z.string().trim().min(2, "Une justification est requise.").max(3000),
});

export const translationReportSchema = z.object({
  documentId: z.string().uuid(),
  pageNumber: z.number().int().min(1),
  segmentIndex: z.number().int().min(0).nullable().optional(),
  targetLanguage: z.string().min(2).max(8),
  description: z.string().trim().min(5).max(3000),
});

export const updateReportSchema = z.object({
  status: z.enum(REPORT_STATUSES),
  response: z.string().trim().max(3000).optional(),
});

export const translateSchema = z.object({
  documentId: z.string().uuid(),
  pageNumber: z.number().int().min(1),
  targetLanguage: z.string().min(2).max(8),
});

export const summarySchema = z.object({
  documentId: z.string().uuid(),
  startPage: z.number().int().min(1),
  endPage: z.number().int().min(1),
  language: z.string().min(2).max(8),
});
