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

    async createOrder(input: {
        branch: "A" | "B";
        customerName?: string;
        customerPhone?: string;
        customerAddress?: string;
        customerNotes?: string;
        notes?: string;
        yymmdd?: string;
    }) {
        const branch = input.branch;

        // 1. Business Date: Determines the Order ID (e.g. 260111) and Board Grouping
        const yymmdd = input.yymmdd || yymmddNow();

        // 2. Audit Date: Records exactly when the staff pressed the button (Now)
        // This ensures the new entry sorts to the TOP of the list immediately.
        const now = new Date();

        return this.prisma.$transaction(async (tx) => {
            // Get next number for that specific Business Date
            const counter = await tx.orderCounter.upsert({
                where: { branch_yymmdd: { branch, yymmdd } },
                create: { branch, yymmdd, lastNo: 1 },
                update: { lastNo: { increment: 1 } },
            });
            const runningNo = counter.lastNo;
            const orderCode = `NR-${branch}-${yymmdd}-${pad4(runningNo)}`;

            // Customer Logic
            let customerId: number | null = null;
            if (input.customerPhone && input.customerPhone.trim()) {
                const phone = input.customerPhone.trim();
                const name = (input.customerName ?? "").trim() || "Customer";
                const address = (input.customerAddress ?? "").trim() || null;
                const notes = (input.customerNotes ?? "").trim() || null;

                const existing = await tx.customer.findFirst({
                    where: { phone, isArchived: false },
                });

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

            // Create Order
            return tx.order.create({
                data: {
                    orderCode,
                    branch,
                    yymmdd, // ✅ Keeps it on the correct "Board"
                    runningNo,
                    customerId,
                    notes: input.notes ?? null,
                    status: OrderStatus.RECEIVED,
                    subtotal: 0,
                    discount: 0,
                    total: 0,
                    createdAt: now, // ✅ Uses Real Time (ensures it appears at top)
                },
                include: { customer: true, items: true },
            });
        });
    }

    async addItem(input: {
        orderCode: string;
        itemCode: string;
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
                    unitPrice: unitPrice.toFixed(2),
                    lineTotal: lineTotal.toFixed(2),
                    tatType,
                    tatMultiplier: mult.toFixed(3),
                    expectedDays: catalog.defaultTatDays,
                    itemNo,
                    itemLabelCode,
                    itemStatus: OrderStatus.RECEIVED,
                },
            });

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

    async searchOrders(term: string, branchFilter?: "A" | "B", user?: any) {
        const q = (term ?? "").trim();
        if (!q) return [];

        const enforcedBranch = user?.branch || branchFilter;

        const orders = await this.prisma.order.findMany({
            where: {
                AND: [
                    enforcedBranch ? { branch: enforcedBranch } : {},
                    {
                        OR: [
                            { orderCode: { contains: q } },
                            { customer: { phone: { contains: q } } },
                            { customer: { name: { contains: q } } },
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
                        tatType: true,
                    },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
            },
            // ✅ Consistent Sort: Latest Created First
            orderBy: { createdAt: "desc" },
            take: 20,
        });

        return orders.map((o) => {
            const inv = o.invoices[0] ?? null;
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
                invoiceStatus: inv?.status ?? "NONE",
                invoiceNo: inv?.invoiceNo ?? null,
                isPaid: inv?.status === "PAID",
                tatType: inv?.tatType,
            };
        });
    }

    async listToday(
        requestedBranch: string,
        filters: any,
        user: any
    ) {
        const targetBranch = user.branch ? user.branch : (requestedBranch || 'A');

        if (targetBranch !== "A" && targetBranch !== "B") {
            throw new BadRequestException("Invalid branch.");
        }

        const yymmdd = (filters?.yymmdd && /^\d{6}$/.test(filters.yymmdd))
            ? filters.yymmdd
            : yymmddNow();

        let paidFilter: boolean | undefined = undefined;
        if (filters?.paid !== undefined) {
            const v = String(filters.paid).toLowerCase().trim();
            if (v === "true" || v === "1") paidFilter = true;
            else if (v === "false" || v === "0") paidFilter = false;
        }

        const where: any = {
            branch: targetBranch,
            yymmdd,
            ...(filters?.status ? { status: filters.status } : {}),
        };

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
                    take: 1,
                },
            },
            // ✅ PRACTICAL SORT: 
            // 1. Created At (Latest timestamp first) - Handles "Entered Just Now"
            // 2. Running No (Highest ID first) - Tie-breaker if entered same second
            orderBy: [
                { createdAt: 'desc' },
                { runningNo: 'desc' }
            ],
        });

        return orders.map((o) => {
            const inv = o.invoices[0] ?? null;
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
                invoiceStatus: inv?.status ?? "NONE",
                invoiceNo: inv?.invoiceNo ?? null,
                isPaid: inv?.status === "PAID",
                tatType: inv?.tatType ?? "NORMAL",
            };
        });
    }

    async updateOrderStatus(orderCode: string, status: OrderStatus) {
        const allowed: OrderStatus[] = [
            "RECEIVED", "SORTING", "WASHING", "DRYING", "IRONING", "READY", "DELIVERED", "CANCELLED",
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