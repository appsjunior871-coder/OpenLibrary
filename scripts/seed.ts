/**
 * Development seed: creates a few openly-licensed sample PDFs (generated locally,
 * text-bearing) so the catalogue, reader and translation flow can be exercised.
 * Documents are published through the normal workflow (draft → approved → published)
 * using the first admin account found in the database.
 *
 *   npm run db:seed
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: false });
import { eq } from "drizzle-orm";

async function main() {
  const { getDbHandle } = await import("../src/lib/db/client");
  const { users } = await import("../src/lib/db/schema");
  const { createDocument, setDistributionStatus, setDocumentStatus } = await import("../src/lib/services/documents");
  const { buildSimplePdf } = await import("../src/lib/pdf/test-pdf");
  const { resolveSessionToken, createSession } = await import("../src/lib/auth/session");

  const handle = await getDbHandle();
  if (handle.kind === "postgres") await handle.migrate();
  const db = handle.db;
  const [admin] = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
  if (!admin) {
    console.error("Aucun administrateur. Lancez d'abord : npm run admin:create -- --email ... --name ...");
    process.exit(1);
  }
  const { token } = await createSession(admin.id);
  const auth = (await resolveSessionToken(token))!;

  const samples = [
    {
      meta: {
        title: "Introduction to Algorithms — Lecture Notes (sample)",
        author: "OpenLibrary Sample Authors",
        description: "Sample lecture notes generated for demonstration. Covers algorithm basics, sorting and asymptotic notation.",
        domain: "Informatique",
        level: "licence" as const,
        keywords: ["algorithms", "sorting", "complexity"],
        sourceLanguage: "en",
        license: "CC BY",
        licenseNotes: "Document d'exemple généré localement par le script de seed.",
        sourceUrl: null,
        subtitle: "Chapter 1–3 excerpts",
        allowDownload: true,
      },
      pages: [
        [
          "An algorithm is any well-defined computational procedure that takes some value, or set of values, as input and produces some value, or set of values, as output.",
          "We can also view an algorithm as a tool for solving a well-specified computational problem. The statement of the problem specifies the desired input/output relationship.",
          "Sorting is a fundamental operation in computer science, and many algorithms have been developed for it. Insertion sort is a simple algorithm that works the way many people sort a hand of playing cards.",
        ],
        [
          "Insertion sort works by iterating through the array and inserting each element into its correct position among the previously sorted elements.",
          "The running time of insertion sort depends on the input: an already sorted array runs in linear time, whereas a reverse-sorted array takes quadratic time.",
          "Merge sort follows the divide-and-conquer paradigm: divide the problem into subproblems, conquer them recursively, and combine the solutions.",
        ],
        [
          "Asymptotic notation describes the growth of functions. Big-O gives an upper bound, Omega a lower bound, and Theta a tight bound.",
          "When we analyse an algorithm we are usually interested in the worst-case running time, because it gives a guarantee that holds for every input of a given size.",
        ],
      ],
    },
    {
      meta: {
        title: "Introduction à la microéconomie (extraits)",
        author: "Auteurs d'exemple OpenLibrary",
        description: "Notes de cours générées pour la démonstration : offre, demande et équilibre de marché.",
        domain: "Économie",
        level: "licence" as const,
        keywords: ["microéconomie", "offre", "demande"],
        sourceLanguage: "fr",
        license: "CC BY-SA",
        licenseNotes: "Document d'exemple généré localement par le script de seed.",
        sourceUrl: null,
        subtitle: null,
        allowDownload: false,
      },
      pages: [
        [
          "La microéconomie étudie les comportements des agents économiques individuels : consommateurs, entreprises et travailleurs.",
          "La courbe de demande représente la quantité qu'un consommateur souhaite acheter pour chaque niveau de prix. Elle est généralement décroissante.",
        ],
        [
          "La courbe d'offre représente la quantité qu'un producteur accepte de vendre à chaque niveau de prix. Elle est généralement croissante.",
          "L'équilibre de marché est atteint lorsque la quantité offerte égale la quantité demandée. Le prix correspondant est le prix d'équilibre.",
        ],
      ],
    },
    {
      meta: {
        title: "Fundamentos de Física: Cinemática (muestra)",
        author: "Autores de ejemplo OpenLibrary",
        description: "Apuntes de ejemplo sobre cinemática: posición, velocidad y aceleración.",
        domain: "Physique",
        level: "tous" as const,
        keywords: ["física", "cinemática", "velocidad"],
        sourceLanguage: "es",
        license: "Domaine public",
        licenseNotes: "Document d'exemple généré localement par le script de seed.",
        sourceUrl: null,
        subtitle: null,
        allowDownload: true,
      },
      pages: [
        [
          "La cinemática describe el movimiento de los cuerpos sin considerar las causas que lo producen.",
          "La velocidad media es el cociente entre el desplazamiento y el intervalo de tiempo empleado.",
          "La aceleración mide la variación de la velocidad con respecto al tiempo.",
        ],
      ],
    },
  ];

  for (const sample of samples) {
    try {
      const pdf = buildSimplePdf(sample.pages);
      const created = await createDocument(auth.user, sample.meta, pdf);
      await setDistributionStatus(auth.user, created.id, "approved", "Seed : licence d'exemple vérifiée.");
      await setDocumentStatus(auth.user, created.id, "published");
      console.log(`✔ Publié : ${created.title}`);
    } catch (err) {
      console.log(`– Ignoré (${sample.meta.title}) : ${err instanceof Error ? err.message : err}`);
    }
  }
  await handle.close();
}

main().catch((err) => {
  console.error("Seed échoué :", err instanceof Error ? err.message : err);
  process.exit(1);
});
