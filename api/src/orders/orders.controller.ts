import {
    Controller,
    Post,
    Body,
    Get,
    Param,
    Query,
    Patch,
    UseGuards,
    Req // ✅ Use 'Req' instead of 'Request' for Express types
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { TurnaroundType, OrderStatus } from "@prisma/client";
import { InvoicesService } from "../invoices/invoices.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard"; // ✅ Import Guard

@UseGuards(JwtAuthGuard) // 🔒 Protects ALL endpoints in this file
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
            customerAddress?: string;
            customerNotes?: string;
            notes?: string;
            yymmdd?: string;
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
        @Query("yymmdd") yymmdd?: string,
        @Req() req?: any, // ✅ Use @Req() and type as 'any' to stop TS errors
    ) {
        // Pass the logged-in user to the service
        return this.orders.listToday(branch, { paid, status, yymmdd }, req.user);
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

    // ✅ Updated: Secure Search
    @Get()
    search(
        @Query("q") q: string,
        @Query("branch") branch: "A" | "B",
        @Req() req: any // ✅ Inject User Request
    ) {
        // Pass the logged-in user to the service
        return this.orders.searchOrders(q, branch, req.user);
    }
}