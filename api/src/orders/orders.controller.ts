import { Controller, Post, Body, Get, Param, Query, Patch } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { TurnaroundType, OrderStatus } from "@prisma/client";
import { InvoicesService } from "../invoices/invoices.service";

@Controller("orders")
export class OrdersController {
    constructor(
        private orders: OrdersService,
        private invoices: InvoicesService,
    ) { }

    @Post()
    createOrder(
        @Body()
        body: {
            branch: "A" | "B";
            customerName?: string;
            customerPhone?: string;
            notes?: string;
        },
    ) {
        return this.orders.createOrder(body);
    }

    @Post(":orderCode/items")
    addItem(
        @Param("orderCode") orderCode: string,
        @Body() body: { itemCode: string; qty: number; tatType?: TurnaroundType },
    ) {
        return this.orders.addItem({ orderCode, ...body });
    }

    // ✅ MUST be above @Get(":orderCode")
    @Get("today")
    today(
        @Query("branch") branch: "A" | "B",
        @Query("paid") paid?: string,
        @Query("status") status?: OrderStatus,
        @Query("yymmdd") yymmdd?: string, // ✅ add this
    ) {
        return this.orders.listToday(branch, { paid, status, yymmdd });
    }

    @Patch(":orderCode/status")
    updateStatus(
        @Param("orderCode") orderCode: string,
        @Body() body: { status: OrderStatus },
    ) {
        return this.orders.updateOrderStatus(orderCode, body.status);
    }

    @Post(":orderCode/invoices")
    createInvoice(
        @Param("orderCode") orderCode: string,
        @Body() body: { discount?: number; tatType?: TurnaroundType },
    ) {
        return this.invoices.createInvoiceForOrder(orderCode, body);
    }

    @Get(":orderCode")
    getOrder(@Param("orderCode") orderCode: string) {
        return this.orders.getOrder(orderCode);
    }

    // ✅ updated: support branch filter optionally
    @Get()
    search(@Query("q") q: string, @Query("branch") branch?: "A" | "B") {
        return this.orders.searchOrders(q, branch);
    }
}
