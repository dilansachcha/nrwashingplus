import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InvoiceStatus, PaymentMethod, TurnaroundType } from "@prisma/client";

function pad2(n: number) {
    return String(n).padStart(2, "0");
}

function round2(n: number) {
    return Number(Number(n ?? 0).toFixed(2));
}

const TAT_RATES: Record<TurnaroundType, number> = {
    NORMAL: 0,
    ONE_DAY: 0.5,
    EXPRESS: 0.85,
};

@Injectable()
export class InvoicesService {
    constructor(private prisma: PrismaService) { }

    // src/invoices/invoices.service.ts

    async getInvoice(invoiceNo: string) {
        return this.prisma.invoice.findUnique({
            where: { invoiceNo },
            include: {
                lines: true,
                // ✅ CHANGE THIS: Include customer inside the order relation
                order: {
                    include: { customer: true }
                },
            },
        });
    }

    /**
     * Create invoice for an order:
     * - Generates invoiceNo: INV-<orderCode>-01, -02...
     * - Snapshots lines from OrderItem into InvoiceLine
     * - Calculates serviceCharge from invoice tatType (rush)
     * - Updates Order totals to match invoice totals (so UI board shows correct total)
     */
    async createInvoiceForOrder(
        orderCode: string,
        input?: { discount?: number; tatType?: TurnaroundType },
    ) {
        const tatType: TurnaroundType = input?.tatType ?? "NORMAL";
        const discountIn = round2(input?.discount ?? 0);

        return this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({
                where: { orderCode },
                include: { items: true, invoices: true },
            });

            if (!order) throw new BadRequestException("Order not found");
            if (!order.items || order.items.length === 0) {
                throw new BadRequestException("Cannot invoice an order with no items");
            }

            // Recalculate subtotal from items (source of truth)
            const subtotal = round2(
                order.items.reduce((sum, i) => sum + Number(i.lineTotal || 0), 0),
            );

            const rate = TAT_RATES[tatType] ?? 0;
            const serviceCharge = round2(subtotal * rate);

            if (discountIn < 0) throw new BadRequestException("Discount cannot be negative");

            // ✅ discount is applied after service charge
            const maxDiscount = round2(subtotal + serviceCharge);
            if (discountIn > maxDiscount) {
                throw new BadRequestException("Discount cannot exceed subtotal + service charge");
            }

            const total = round2(subtotal + serviceCharge - discountIn);

            // New Professional Way
            // We enforce 1 invoice per order, so we just prefix INV
            const invoiceNo = `INV-${order.orderCode}`;

            // Optional: Security check
            const existingInv = await tx.invoice.findUnique({ where: { invoiceNo } });
            if (existingInv) throw new BadRequestException("Invoice already exists for this order");

            // Create invoice (FINAL but unpaid)
            const invoice = await tx.invoice.create({
                data: {
                    invoiceNo,
                    orderId: order.id,
                    status: InvoiceStatus.FINAL,

                    tatType,
                    serviceCharge,

                    subtotal,
                    discount: discountIn,
                    total,
                    paidAmount: 0,
                    balance: total,

                    paymentMethod: PaymentMethod.CASH,
                    paidAt: null,
                },
            });

            // Snapshot lines
            await tx.invoiceLine.createMany({
                data: order.items.map((it) => ({
                    invoiceId: invoice.id,
                    orderItemId: it.id,
                    itemCode: it.itemCode,
                    description: it.itemName,
                    qty: it.qty,
                    unitPrice: it.unitPrice,
                    lineTotal: it.lineTotal,
                })),
            });

            // ✅ Update order totals so board/details show correct total after invoice
            await tx.order.update({
                where: { id: order.id },
                data: {
                    subtotal,
                    discount: discountIn,
                    total,
                },
            });

            return tx.invoice.findUnique({
                where: { invoiceNo: invoice.invoiceNo },
                include: { lines: true, order: true },
            });
        });
    }

    /**
     * Pay invoice
     * - Updates paidAmount and balance
     * - If balance becomes 0 => status PAID + paidAt timestamp
     */
    async payInvoice(
        invoiceNo: string,
        input: { paymentMethod: PaymentMethod; paidAmount: number },
    ) {
        const addPay = Number(input.paidAmount);

        if (!addPay || addPay <= 0) throw new BadRequestException("paidAmount must be > 0");

        return this.prisma.$transaction(async (tx) => {
            const inv = await tx.invoice.findUnique({ where: { invoiceNo } });
            if (!inv) throw new BadRequestException("Invoice not found");
            if (inv.status === "VOID") throw new BadRequestException("Invoice is VOID");
            if (inv.status === "PAID") throw new BadRequestException("Invoice already PAID");

            const currentPaid = Number(inv.paidAmount);
            const total = Number(inv.total);

            const newPaid = round2(currentPaid + addPay);
            if (newPaid > total) throw new BadRequestException("Paid amount exceeds invoice total");

            const newBalance = round2(total - newPaid);
            const isFullyPaid = newBalance === 0;

            const updated = await tx.invoice.update({
                where: { invoiceNo },
                data: {
                    paymentMethod: input.paymentMethod,
                    paidAmount: newPaid,
                    balance: newBalance,
                    status: isFullyPaid ? InvoiceStatus.PAID : inv.status,
                    paidAt: isFullyPaid ? new Date() : null,
                },
            });

            return tx.invoice.findUnique({
                where: { invoiceNo: updated.invoiceNo },
                include: { lines: true, order: true },
            });
        });
    }
}
