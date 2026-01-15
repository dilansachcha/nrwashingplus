import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller("catalog")
@UseGuards(JwtAuthGuard)
export class CatalogController {
    constructor(private catalog: CatalogService) { }

    // --- CATEGORIES ---

    @Get("categories")
    listCategories() {
        return this.catalog.listCategories();
    }

    @Post("categories")
    createCategory(@Body() body: { code: string; name: string }) {
        return this.catalog.createCategory(body.code, body.name);
    }

    // ✅ NEW: Endpoint for Editing Category
    @Patch("categories/:id")
    updateCategory(
        @Param("id") id: string,
        @Body() body: { name?: string; code?: string }
    ) {
        return this.catalog.updateCategory(Number(id), body);
    }

    @Patch("categories/:id/toggle")
    toggleCategory(@Param("id") id: string, @Body() body: { isActive: boolean }) {
        return this.catalog.toggleCategory(Number(id), body.isActive);
    }

    // --- ITEMS ---

    @Get("items")
    searchItems(
        @Query("search") search = "",
        @Query("active") active?: string,
        @Query("limit") limit?: string,
        @Query("categoryId") categoryId?: string,
    ) {
        const parsedCategoryId =
            categoryId && !Number.isNaN(Number(categoryId)) ? Number(categoryId) : undefined;

        let activeBool: boolean | undefined = undefined;
        if (active === "true") activeBool = true;
        if (active === "false") activeBool = false;

        return this.catalog.searchItems({
            search,
            active: activeBool,
            limit: limit ? Number(limit) : 100, // Increased default limit for admin view
            categoryId: parsedCategoryId,
        });
    }

    @Post("items")
    createItem(@Body() body: any) {
        return this.catalog.createItem(body);
    }

    @Patch("items/:id")
    updateItem(
        @Param("id") id: string,
        @Body() body: { displayName?: string; basePrice?: number; itemCode?: string; isActive?: boolean },
    ) {
        return this.catalog.updateItem(Number(id), body);
    }

    @Patch("items/:id/toggle")
    toggleItem(@Param("id") id: string, @Body() body: { isActive: boolean }) {
        return this.catalog.toggleItem(Number(id), body.isActive);
    }

    // Legacy Route
    @Patch("items/code/:itemCode")
    updateItemByCode(
        @Param("itemCode") itemCode: string,
        @Body() body: { basePrice?: number; isActive?: boolean },
    ) {
        return this.catalog.updateItemByCode(itemCode, body);
    }
}