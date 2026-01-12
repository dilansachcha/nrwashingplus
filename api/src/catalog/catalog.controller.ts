import { Controller, Get, Patch, Param, Query, Body } from "@nestjs/common";
import { CatalogService } from "./catalog.service";

@Controller("catalog")
export class CatalogController {
    constructor(private catalog: CatalogService) { }

    @Get("categories")
    listCategories() {
        return this.catalog.listCategories();
    }

    // ✅ /api/catalog/items?search=wd&active=true&limit=20&categoryId=1
    @Get("items")
    searchItems(
        @Query("search") search = "",
        @Query("active") active?: string,
        @Query("limit") limit?: string,
        @Query("categoryId") categoryId?: string,
    ) {
        const parsedCategoryId =
            categoryId && !Number.isNaN(Number(categoryId)) ? Number(categoryId) : undefined;

        return this.catalog.searchItems({
            search,
            active: active === "true",
            limit: limit ? Number(limit) : 20,
            categoryId: parsedCategoryId,
        });
    }

    @Patch("items/:id")
    updateItem(
        @Param("id") id: string,
        @Body() body: { basePrice?: number; isActive?: boolean },
    ) {
        return this.catalog.updateItem(Number(id), body);
    }

    @Patch("items/code/:itemCode")
    updateItemByCode(
        @Param("itemCode") itemCode: string,
        @Body() body: { basePrice?: number; isActive?: boolean },
    ) {
        return this.catalog.updateItemByCode(itemCode, body);
    }
}
