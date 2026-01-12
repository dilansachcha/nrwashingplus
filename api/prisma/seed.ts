import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

type SeedRow = {
    categoryCode: string;
    categoryName: string;
    itemCode: string;
    displayName: string;
    unitType: string;
    basePrice: number;
    defaultTatDays: number;
    supportsTatType: boolean;
    isActive: boolean;
    notes?: string;
};

const prisma = new PrismaClient();

async function main() {
    const seedPath = path.join(process.cwd(), "prisma", "seed", "catalog_seed_fixed.json");

    if (!fs.existsSync(seedPath)) {
        throw new Error(`Seed file not found: ${seedPath}`);
    }

    const raw = fs.readFileSync(seedPath, "utf8");
    const rows: SeedRow[] = JSON.parse(raw);

    // 1) Upsert categories
    const categoryMap = new Map<string, number>();

    const categories = Array.from(
        new Map(rows.map((r) => [r.categoryCode, r.categoryName])).entries()
    ).map(([code, name]) => ({ code, name }));

    for (const c of categories) {
        const cat = await prisma.catalogCategory.upsert({
            where: { code: c.code },
            update: { name: c.name, isActive: true },
            create: {
                code: c.code,
                name: c.name,
                isActive: true,
                sortOrder: 0
            }
        });
        categoryMap.set(c.code, cat.id);
    }

    // 2) Upsert items
    let inserted = 0;
    let updated = 0;

    for (const r of rows) {
        const categoryId = categoryMap.get(r.categoryCode);
        if (!categoryId) throw new Error(`Missing categoryId for ${r.categoryCode}`);

        const existing = await prisma.catalogItem.findUnique({
            where: { itemCode: r.itemCode },
            select: { id: true }
        });

        await prisma.catalogItem.upsert({
            where: { itemCode: r.itemCode },
            update: {
                categoryId,
                displayName: r.displayName,
                unitType: r.unitType,
                basePrice: r.basePrice.toFixed(2),   // Decimal as string
                defaultTatDays: r.defaultTatDays,
                supportsTatType: r.supportsTatType,
                isActive: r.isActive,
                notes: r.notes ?? null
            },
            create: {
                categoryId,
                itemCode: r.itemCode,
                displayName: r.displayName,
                unitType: r.unitType,
                basePrice: r.basePrice.toFixed(2),   // Decimal as string
                defaultTatDays: r.defaultTatDays,
                supportsTatType: r.supportsTatType,
                isActive: r.isActive,
                notes: r.notes ?? null
            }
        });

        if (existing) updated++;
        else inserted++;
    }

    console.log(`Catalog seed complete. Inserted: ${inserted}, Updated: ${updated}`);
}

main()
    .catch((e) => {
        console.error("Seed failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
