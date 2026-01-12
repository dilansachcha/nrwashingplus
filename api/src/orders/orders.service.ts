import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TurnaroundType, OrderStatus, InvoiceStatus } from "@prisma/client";

function yymmddNow(): string {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}${mm}${dd}`;
}

function pad4(n: number) {
    return String(n).padStart(4, "0");
}
function pad2(n: number) {
    return String(n).padStart(2, "0");
}

function tatMultiplier(tat: TurnaroundType): number {
    if (tat === "ONE_DAY") return 1.5;
    if (tat === "EXPRESS") return 1.85;
    return 1.0;
}

@Injectable()
export class OrdersService {
    constructor(private prisma: PrismaService) { }

    // src/orders/orders.service.ts
    async createOrder(input: {
        branch: "A" | "B";
        customerName?: string;
        customerPhone?: string;
        customerAddress?: string;
        customerNotes?: string;
        notes?: string;
        yymmdd?: string; // ✅ We accept the date here
    }) {
        const branch = input.branch;
        // 1. Determine the Date String (e.g., "260111")
        // If frontend sends it, use it. Otherwise default to today.
        const yymmdd = input.yymmdd || yymmddNow();

        // 2. ✅ PARSE DATE: Convert "260111" -> Date Object
        const yy = parseInt(yymmdd.slice(0, 2), 10) + 2000;
        const mm = parseInt(yymmdd.slice(2, 4), 10) - 1; // JS Months are 0-11
        const dd = parseInt(yymmdd.slice(4, 6), 10);

        const orderDate = new Date(yy, mm, dd);

        // Logic: If creating for "Today", use current time. 
        // If backdating/future, default to 10:00 AM.
        if (yymmdd === yymmddNow()) {
            orderDate.setHours(new Date().getHours(), new Date().getMinutes());
        } else {
            orderDate.setHours(10, 0, 0);
        }

        return this.prisma.$transaction(async (tx) => {
            // Counter Logic
            const counter = await tx.orderCounter.upsert({
                where: { branch_yymmdd: { branch, yymmdd } },
                create: { branch, yymmdd, lastNo: 1 },
                update: { lastNo: { increment: 1 } },
            });
            const runningNo = counter.lastNo;
            const orderCode = `NR-${branch}-${yymmdd}-${pad4(runningNo)}`;

            // Customer Logic (No changes needed here, logic is good)
            let customerId: number | null = null;
            if (input.customerPhone && input.customerPhone.trim()) {
                const phone = input.customerPhone.trim();
                const name = (input.customerName ?? "").trim() || "Customer";
                const address = (input.customerAddress ?? "").trim() || null;
                const notes = (input.customerNotes ?? "").trim() || null;

                const existing = await tx.customer.findFirst({ where: { phone, isArchived: false } });

                if (existing) {
                    customerId = existing.id;
                    if (name !== existing.name || address !== existing.address) {
                        await tx.customer.update({
                            where: { id: existing.id },
                            data: { name, address, notes },
                        });
                    }
                } else {
                    const created = await tx.customer.create({
                        data: { phone, name, address, notes, isArchived: false },
                    });
                    customerId = created.id;
                }
            }

            // 3. Create Order
            return tx.order.create({
                data: {
                    orderCode,
                    branch,
                    yymmdd, // This sets the code string
                    runningNo,
                    customerId,
                    notes: input.notes ?? null,
                    status: OrderStatus.RECEIVED,
                    subtotal: 0,
                    discount: 0,
                    total: 0,
                    createdAt: orderDate, // ✅ CRITICAL: Sets the actual DB Timestamp to matched date
                },
                include: { customer: true, items: true },
            });
        });
    }

    async addItem(input: {
        orderCode: string;
        itemCode: string; // from catalog
        qty: number;
        tatType?: TurnaroundType;
    }) {
        const order = await this.prisma.order.findUnique({
            where: { orderCode: input.orderCode },
            include: { items: true },
        });
        if (!order) throw new BadRequestException("Order not found");

        const catalog = await this.prisma.catalogItem.findUnique({
            where: { itemCode: input.itemCode },
        });
        if (!catalog) throw new BadRequestException("Catalog item not found");
        if (!catalog.isActive) throw new BadRequestException("Catalog item is inactive");

        const qty = input.qty > 0 ? input.qty : 1;
        const tatType = input.tatType ?? "NORMAL";
        const mult = tatMultiplier(tatType);

        const unitPrice = Number(catalog.basePrice) * mult;
        const lineTotal = unitPrice * qty;

        const unitPriceStr = unitPrice.toFixed(2);
        const lineTotalStr = lineTotal.toFixed(2);

        return this.prisma.$transaction(async (tx) => {
            const itemNo = (await tx.orderItem.count({ where: { orderId: order.id } })) + 1;
            const itemLabelCode = `${order.orderCode}-${pad2(itemNo)}`;

            const created = await tx.orderItem.create({
                data: {
                    orderId: order.id,
                    catalogItemId: catalog.id,
                    itemCode: catalog.itemCode,
                    itemName: catalog.displayName,
                    unitType: catalog.unitType,
                    qty,
                    unitPrice: unitPriceStr,
                    lineTotal: lineTotalStr,
                    tatType,
                    tatMultiplier: mult.toFixed(3),
                    expectedDays: catalog.defaultTatDays,
                    itemNo,
                    itemLabelCode,
                    itemStatus: OrderStatus.RECEIVED,
                },
            });

            // Update order totals
            const agg = await tx.orderItem.aggregate({
                where: { orderId: order.id },
                _sum: { lineTotal: true },
            });

            const subtotal = Number(agg._sum.lineTotal ?? 0);
            await tx.order.update({
                where: { id: order.id },
                data: { subtotal, total: subtotal },
            });

            return created;
        });
    }

    getOrder(orderCode: string) {
        return this.prisma.order.findUnique({
            where: { orderCode },
            include: { customer: true, items: true, invoices: true },
        });
    }

    // src/orders/orders.service.ts

    async searchOrders(term: string, branch?: "A" | "B") {
        const q = (term ?? "").trim();
        if (!q) return [];

        const orders = await this.prisma.order.findMany({
            where: {
                AND: [
                    branch ? { branch } : {},
                    {
                        OR: [
                            { orderCode: { contains: q } },
                            { customer: { phone: { contains: q } } },
                            { customer: { name: { contains: q } } }, // Added Name search
                        ],
                    },
                ],
            },
            include: {
                customer: true,
                _count: { select: { items: true } },
                invoices: {
                    select: {
                        invoiceNo: true,
                        status: true,
                        total: true,
                        paidAmount: true,
                        createdAt: true,
                        tatType: true, // ✅ Vital for the Icon!
                    },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
            },
            orderBy: { createdAt: "desc" },
            take: 20,
        });

        // ✅ Map to same format as listToday
        return orders.map((o) => {
            const inv = o.invoices[0] ?? null;
            const invoiceStatus = inv?.status ?? "NONE";
            const isPaid = invoiceStatus === "PAID";

            return {
                orderCode: o.orderCode,
                branch: o.branch,
                createdAt: o.createdAt,
                status: o.status,
                customerName: o.customer?.name ?? null,
                customerPhone: o.customer?.phone ?? null,
                customerAddress: o.customer?.address ?? "",
                customerNotes: o.customer?.notes ?? "",
                itemCount: o._count.items,
                subtotal: o.subtotal,
                total: o.total,
                invoiceStatus,
                invoiceNo: inv?.invoiceNo ?? null,
                isPaid,
                tatType: inv?.tatType, // ✅ Pass this through!
            };
        });
    }

    async listToday(
        branch: "A" | "B",
        filters?: { paid?: string; status?: OrderStatus; yymmdd?: string },
    ) {
        if (branch !== "A" && branch !== "B") {
            throw new BadRequestException("Invalid branch. Use A or B.");
        }

        const yymmdd = (filters?.yymmdd && /^\d{6}$/.test(filters.yymmdd))
            ? filters.yymmdd
            : yymmddNow();

        if (filters?.yymmdd && !/^\d{6}$/.test(filters.yymmdd)) {
            throw new BadRequestException("yymmdd must be 6 digits like 251228");
        }


        // Parse paid filter
        let paidFilter: boolean | undefined = undefined;
        if (filters?.paid !== undefined) {
            const v = String(filters.paid).toLowerCase().trim();
            if (v === "true" || v === "1") paidFilter = true;
            else if (v === "false" || v === "0") paidFilter = false;
            else throw new BadRequestException("paid must be true or false");
        }

        const statusFilter = filters?.status;

        // Build Prisma where
        const where: any = {
            branch,
            yymmdd,
            ...(statusFilter ? { status: statusFilter } : {}),
        };

        // ✅ Correct paid/unpaid filtering
        if (paidFilter === true) {
            where.invoices = { some: { status: InvoiceStatus.PAID } };
        } else if (paidFilter === false) {
            where.invoices = { none: { status: InvoiceStatus.PAID } };
        }

        const orders = await this.prisma.order.findMany({
            where,
            include: {
                customer: true,
                _count: { select: { items: true } },
                invoices: {
                    select: {
                        invoiceNo: true,
                        status: true,
                        total: true,
                        paidAmount: true,
                        createdAt: true,
                        tatType: true,
                    },
                    orderBy: { createdAt: "desc" },
                    take: 1, // latest invoice for display only
                },
            },
            orderBy: { runningNo: "desc" },
        });

        return orders.map((o) => {
            const inv = o.invoices[0] ?? null;
            const invoiceStatus = inv?.status ?? "NONE";
            const isPaid = invoiceStatus === "PAID";

            return {
                orderCode: o.orderCode,
                branch: o.branch,
                createdAt: o.createdAt,
                status: o.status,
                customerName: o.customer?.name ?? null,
                customerPhone: o.customer?.phone ?? null,
                itemCount: o._count.items,
                subtotal: o.subtotal,
                total: o.total,
                invoiceStatus,
                invoiceNo: inv?.invoiceNo ?? null,
                isPaid,
                tatType: inv?.tatType ?? "NORMAL",
            };
        });
    }

    async updateOrderStatus(orderCode: string, status: OrderStatus) {
        const allowed: OrderStatus[] = [
            "RECEIVED",
            "SORTING",
            "WASHING",
            "DRYING",
            "IRONING",
            "READY",
            "DELIVERED",
            "CANCELLED",
        ];

        if (!allowed.includes(status)) {
            throw new BadRequestException(`Invalid status for MVP: ${status}`);
        }

        const order = await this.prisma.order.findUnique({ where: { orderCode } });
        if (!order) throw new BadRequestException("Order not found");

        return this.prisma.order.update({
            where: { orderCode },
            data: { status },
        });
    }

}
