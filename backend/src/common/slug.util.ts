// Shared by AdminRestaurantService and prisma/seed.ts (a plain function, no
// DI, so a standalone ts-node script can import it too).
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
