# Item Shop Feature Implementation Plan

## Objective

Implement an "Item Shop" feature where users can purchase items using their balance.

## Phase 1: Database Schema Updates

1. **Define `Item` Model** in `prisma/schema.prisma`:
    - `id` (String, Primary Key) - The internal database identifier (e.g., UUID).
    - `shortId` (String, Unique) - A short, human-readable alias for easy typing in WhatsApp (e.g., 'potion', 'sword').
    - `name` (String)
    - `description` (String)
    - `price` (BigInt) - Cost in Rupiah.
    - `type` (String) - E.g., 'consumable', 'equipment', 'collectible'.
    - `isAvailable` (Boolean) - To easily toggle item availability.

2. **Define `UserInventory` Model** in `prisma/schema.prisma`:
    - `id` (String, Primary Key)
    - `userId` (String, Relation to User model)
    - `itemId` (String, Relation to Item model)
    - `quantity` (Int) - Default 1.
    - Unique constraint on `[userId, itemId]`.

3. **Database Migration**:
    - Run `pnpm prisma format` and `pnpm prisma validate`.
    - Run `pnpm prisma migrate deploy` to safely apply the pending migrations to the production SQLite database (or use `pnpm prisma db push` if you are applying schema changes directly without migration files).

## Phase 2: Core Services (Backend)

1. **Shop Service (`src/services/shopService.ts`)**:
    - `getShopItems()`: Fetch all available items from the database.
    - `purchaseItem(userId: string, itemId: string, quantity: number = 1)`:
        - Check if the item exists and is available.
        - Check if the user has a sufficient balance (`item.price * quantity`).
        - Execute a Prisma `$transaction` to safely deduct the balance and upsert the item into `UserInventory`.
        - Return the purchase result (success/failure).

## Phase 3: Bot Commands (Frontend)

1. **`.shop [category]` Command**:
    - Refactor the existing `.shop` command (which currently shows properties) to support a category-based system.
    - If the user types `.shop` without arguments, display a main menu of available categories (e.g., "Properties", "Consumables", "Equipment").
    - If the user types a category (e.g., `.shop items` or `.shop properties`), display a paginated list of items specific to that category.
    - **Requirement**: Use the global `formatRupiah` function from `src/utils/currency.ts` to display prices (e.g., `Rp10.000`).
    - **Requirement**: All output strings must be in Formal English.

2. **`.buy <short_id> [quantity]` Command**:
    - Process the purchase using the Shop Service (looking up the item by `shortId`).
    - Send a clear confirmation message upon a successful purchase or an appropriate error message if funds are insufficient or the item is not found.
    - **Requirement**: All output strings must be in Formal English.

3. **`.inventory` Command**:
    - Display the user's current inventory and the respective item quantities.
    - **Requirement**: All output strings must be in Formal English.

## Phase 4: Verification & Formatting

1. Run `pnpm typecheck` to ensure no TypeScript errors.
2. Run `pnpm lint` to verify code quality and adherence to ESLint rules.
3. Run `pnpm build` to verify the compilation process.
4. Run `pnpm format` to apply Prettier formatting across all modified files.
5. Manually test the commands within WhatsApp to guarantee correct rendering, accurate balance deduction, and proper inventory updates.

## Appendix: Initial Item List

This is the list of initial items to be seeded into the database when the feature is launched.

| Name           | `shortId`    | Description                                             | Type        | Price  |
| :------------- | :----------- | :------------------------------------------------------ | :---------- | :----- |
| Gorengan       | `gorengan`   | Authentic Indonesian fried snacks. Restores 1.5 health. | consumable  | 2000   |
| Yakult         | `yakult`     | A probiotic dairy drink. Restores 2.5 health.           | consumable  | 2500   |
| Tolak Angin    | `tolakangin` | Herbal remedy to cure debuffs and restore 5 health.     | consumable  | 3500   |
| Indomie Goreng | `indomie`    | The ultimate comfort food. Restores 10 health.          | consumable  | 3500   |
| Bambu Runcing  | `bambu`      | A traditional bamboo spear for combat.                  | equipment   | 15000  |
| Sandal Swallow | `swallow`    | Legendary rubber sandals. Good for defense.             | equipment   | 12000  |
| Sarung BHS     | `sarung`     | A high-quality woven sarong, perfect for flexing.       | collectible | 500000 |
