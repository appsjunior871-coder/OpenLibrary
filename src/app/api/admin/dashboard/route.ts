import { json, protectedRoute } from "@/lib/http/api";
import { getDashboardStats } from "@/lib/services/admin";

export const GET = protectedRoute("admin:dashboard", async () => json(await getDashboardStats()));
