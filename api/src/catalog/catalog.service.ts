import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CatalogService {
    constructor(private prisma: PrismaService) { }

    private moneyStr(n: number) {
        return Number(n ?? 0).toFixed(2);
    }

    // --- CATEGORIES ---

    listCategories() {
        return this.prisma.catalogCategory.findMany({
            // Admin needs to see inactive categories too
            orderBy: { id: "asc" },
        });
    }

    async createCategory(code: string, name: string) {
        // Validation: Check if code exists
        const existing = await this.prisma.catalogCategory.findUnique({ where: { code } });
        if (existing) throw new BadRequestException(`Category code '${code}' already exists.`);

        return this.prisma.catalogCategory.create({
            data: { code, name, isActive: true }
        });
    }

    // ✅ NEW: Update Category Name & Code
    async updateCategory(id: number, data: { name?: string; code?: string }) {
        // If changing code, check uniqueness
        if (data.code) {
            const existing = await this.prisma.catalogCategory.findUnique({ where: { code: data.code } });
            if (existing && existing.id !== id) {
                throw new BadRequestException(`Category code '${data.code}' already exists.`);
            }
        }

        return this.prisma.catalogCategory.update({
            where: { id },
            data: {
                name: data.name,
                code: data.code
            }
        });
    }

    async toggleCategory(id: number, isActive: boolean) {
        if (!isActive) {
            // Safety: Don't disable category if it has active items
            const activeItems = await this.prisma.catalogItem.count({
                where: { categoryId: id, isActive: true }
            });
            if (activeItems > 0) {
                throw new BadRequestException("Cannot deactivate category with active items. Deactivate items first.");
            }
        }
        return this.prisma.catalogCategory.update({
            where: { id },
            data: { isActive }
        });
    }

    // --- ITEMS ---

    async searchItems(opts: {
        search?: string;
        active?: boolean;
        limit?: number;
        categoryId?: number;
    }) {
        const q = (opts.search ?? "").trim();
        const hasCategory = typeof opts.categoryId === "number" && !Number.isNaN(opts.categoryId);
        const limit = Math.min(Math.max(opts.limit ?? 20, 1), 500);

        if (!hasCategory && q.length < 2) return [];

        const where: any = {
            ...(opts.active !== undefined ? { isActive: opts.active } : {}),
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
                unitType: true,
                supportsTatType: true, // Needed for UI
                category: {
                    select: { id: true, code: true, name: true },
                },
            },
        });
    }

    async createItem(data: {
        categoryId: number;
        itemCode: string;
        displayName: string;
        unitType: string;
        basePrice: number;
        defaultTatDays: number;
    }) {
        // Validation
        const existing = await this.prisma.catalogItem.findUnique({ where: { itemCode: data.itemCode } });
        if (existing) throw new BadRequestException(`Item code '${data.itemCode}' already exists.`);

        return this.prisma.catalogItem.create({
            data: {
                categoryId: Number(data.categoryId),
                itemCode: data.itemCode,
                displayName: data.displayName,
                unitType: data.unitType || "PCS",
                basePrice: this.moneyStr(data.basePrice),
                defaultTatDays: Number(data.defaultTatDays),
                supportsTatType: true,
                isActive: true
            }
        });
    }

    // Consolidated Update Method
    async updateItem(id: number, data: Partial<{ displayName: string; basePrice: number; itemCode: string; isActive: boolean }>) {
        return this.prisma.catalogItem.update({
            where: { id },
            data: {
                ...data,
                basePrice: data.basePrice !== undefined ? this.moneyStr(data.basePrice) : undefined
            }
        });
    }

    async toggleItem(id: number, isActive: boolean) {
        return this.prisma.catalogItem.update({
            where: { id },
            data: { isActive }
        });
    }

    // Legacy method support (Optional, but kept for safety if UI calls it)
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