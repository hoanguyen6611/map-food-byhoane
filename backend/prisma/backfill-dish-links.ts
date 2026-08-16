// One-off (but safely re-runnable) backfill: links every existing MenuItem
// whose `dishId` is null to the curated Dish catalog by exact name match.
// Needed because seed-restaurants.ts's own dish-linking only affects rows
// created by a *fresh* run of that script — restaurants already seeded
// before that fix (e.g. anything already in a running dev DB) keep their
// stale `dishId: null` until this runs once against them. Reuses
// ensureDishCatalog() so the catalog itself is identical either way.
import { PrismaClient } from '@prisma/client';
import { ensureDishCatalog } from './seed-restaurants';

const prisma = new PrismaClient();

async function main() {
  const dishByName = await ensureDishCatalog(prisma);
  console.log(`Dish catalog ready: ${dishByName.size} unique dishes.`);

  const unlinked = await prisma.menuItem.findMany({
    where: { dishId: null },
    select: { id: true, name: true },
  });
  console.log(`Found ${unlinked.length} menu item(s) with no dishId.`);

  let linked = 0;
  for (const item of unlinked) {
    const dishId = dishByName.get(item.name);
    if (!dishId) continue;
    // eslint-disable-next-line no-await-in-loop
    await prisma.menuItem.update({ where: { id: item.id }, data: { dishId } });
    linked++;
  }

  console.log(`Linked ${linked} menu item(s) to a catalog dish (${unlinked.length - linked} had no catalog match, left as-is).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
