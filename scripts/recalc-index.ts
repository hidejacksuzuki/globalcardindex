import { recalcIndex } from "../src/jobs/recalcIndex";
import { prisma } from "../src/lib/prisma";

async function main() {
  const result = await recalcIndex();
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
