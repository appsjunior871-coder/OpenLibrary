import { json, route } from "@/lib/http/api";
import { getCatalogFacets } from "@/lib/services/documents";

export const GET = route(async () => json(await getCatalogFacets()));
