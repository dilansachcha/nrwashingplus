import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CatalogService {
    constructor(private prisma: PrismaService) { }

    listCategories() {
        return this.prisma.catalogCategory.findMany({
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
        });
    }

    // ✅ supports: search, active, limit, categoryId
    async searchItems(opts: {
        search?: string;
        active?: boolean;
        limit?: number;
        categoryId?: number;
    }) {
        const q = (opts.search ?? "").trim();
        const hasCategory = typeof opts.categoryId === "number" && !Number.isNaN(opts.categoryId);

        // ✅ allow bigger limits for category dropdown use
        const limit = Math.min(Math.max(opts.limit ?? 20, 1), 500);

        // ✅ Only block when it's a GLOBAL search (no category selected)
        // If categoryId is present, we allow returning items even with empty search.
        if (!hasCategory && q.length < 2) return [];

        // ✅ Build where clause safely (only include OR when search has 2+ chars)
        const where: any = {
            ...(opts.active ? { isActive: true } : {}),
            ...(hasCategory ? { categoryId: opts.categoryId } : {}),
            ...(q.length >= 2
                ? {
                    OR: [
                        { itemCode: { contains: q } },
                        { displayName: { contains: q } },
                    ],
                }
                : {}),
        };

        return this.prisma.catalogItem.findMany({
            where,
            orderBy: [{ itemCode: "asc" }],
            take: limit,
            select: {
                id: true,
                itemCode: true,
                displayName: true,
                basePrice: true,
                isActive: true,
                defaultTatDays: true,
                category: {
                    select: { id: true, code: true, name: true },
                },
            },
        });
    }

    private moneyStr(n: number) {
        return Number(n ?? 0).toFixed(2);
    }

    updateItem(id: number, data: { basePrice?: number; isActive?: boolean }) {
        return this.prisma.catalogItem.update({
            where: { id },
            data: {
                basePrice: data.basePrice !== undefined ? this.moneyStr(data.basePrice) : undefined,
                isActive: data.isActive !== undefined ? data.isActive : undefined,
            },
        });
    }

    updateItemByCode(itemCode: string, data: { basePrice?: number; isActive?: boolean }) {
        return this.prisma.catalogItem.update({
            where: { itemCode },
            data: {
                basePrice: data.basePrice !== undefined ? this.moneyStr(data.basePrice) : undefined,
                isActive: data.isActive !== undefined ? data.isActive : undefined,
            },
        });
    }
}
