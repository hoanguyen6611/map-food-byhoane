-- New Photo owner type for the "menu photos" feature — up to 3 photos of a
-- restaurant's physical menu, attached to a Menu row (ownerId = Menu.id),
-- same loose polymorphism every other PhotoOwnerType already uses.
ALTER TYPE "PhotoOwnerType" ADD VALUE 'menu';
