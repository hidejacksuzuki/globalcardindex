import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { importCsv } from "../src/lib/collectors/csv";
import { prisma } from "../src/lib/prisma";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: tsx scripts/import-csv.ts <path-to-csv>");
    process.exit(1);
  }

  const path = resolve(process.cwd(), file);
  const buffer = readFileSync(path);
  const summary = await importCsv(buffer);

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
