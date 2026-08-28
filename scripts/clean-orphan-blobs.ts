/**
 * Barre fotos HUÉRFANAS en Vercel Blob (Pasada F): archivos en el store que ningún
 * `CheckIn.photoUrl` referencia. Blob vive fuera de Postgres, así que aunque el
 * borrado de check-ins/salidas y el reemplazo de fotos ya borran su blob al vuelo
 * (best-effort), un fallo ocasional deja un huérfano pagando espacio. Esto lo barre.
 *
 * Uso (dry-run por defecto, NO borra):
 *   node --env-file=.env --import tsx scripts/clean-orphan-blobs.ts
 * Para borrar de verdad:
 *   node --env-file=.env --import tsx scripts/clean-orphan-blobs.ts --apply
 *
 * Apunta al store cuyo BLOB_READ_WRITE_TOKEN cargues con el .env. Dev y producción
 * usan stores SEPARADOS: corre esto contra el mismo entorno que la BD del .env.
 * NUNCA contra producción sin querer: revisa primero el dry-run.
 */
import { list, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("Falta BLOB_READ_WRITE_TOKEN en el entorno (.env). Aborto.");
    process.exit(1);
  }

  // URLs referenciadas hoy en la base.
  const rows = await prisma.checkIn.findMany({
    where: { photoUrl: { not: null } },
    select: { photoUrl: true },
  });
  const referenced = new Set(rows.map((r) => r.photoUrl as string));

  // Todos los blobs del store (paginado).
  const orphans: { url: string; size: number; pathname: string; uploadedAt: Date }[] = [];
  let cursor: string | undefined;
  let totalBlobs = 0;
  let totalBytes = 0;
  do {
    const res = await list({ cursor, limit: 1000 });
    for (const b of res.blobs) {
      totalBlobs++;
      if (!referenced.has(b.url)) {
        orphans.push({ url: b.url, size: b.size, pathname: b.pathname, uploadedAt: b.uploadedAt });
        totalBytes += b.size;
      }
    }
    cursor = res.cursor;
  } while (cursor);

  console.log(
    `Blobs en el store: ${totalBlobs} · referenciados en BD: ${referenced.size} · huérfanos: ${orphans.length} (${kb(totalBytes)})`,
  );
  for (const o of orphans) {
    console.log(`  - ${o.pathname}  ${kb(o.size)}  subido=${o.uploadedAt.toISOString()}`);
  }
  if (orphans.length === 0) {
    console.log("Nada que limpiar.");
    return prisma.$disconnect();
  }

  if (!APPLY) {
    console.log("\n(dry-run) No se borró nada. Vuelve a correr con --apply para borrar.");
    return prisma.$disconnect();
  }

  let deleted = 0;
  for (const o of orphans) {
    try {
      await del(o.url);
      deleted++;
    } catch (e) {
      console.error(`  ✗ no se pudo borrar ${o.pathname}:`, e);
    }
  }
  console.log(`\n✓ Borrados: ${deleted}/${orphans.length}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
