import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, InvoiceStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
    constructor(private prisma: PrismaService) { }

    async getDashboardStats(startDate: string, endDate: string, branch?: string) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // ✅ 1. Base Filter (Date + Branch)
        const whereBase = {
            createdAt: { gte: start, lte: end },
            ...(branch && branch !== 'ALL' ? { branch } : {}),
        };

        // --- TOTALS ---
        const totalOrders = await this.prisma.order.count({ where: whereBase });

        // --- REVENUE (Paid vs Unpaid) ---
        const paidAgg = await this.prisma.invoice.aggregate({
            where: {
                createdAt: { gte: start, lte: end },
                status: { in: ['PAID', 'FINAL'] },
                order: { ...(branch && branch !== 'ALL' ? { branch } : {}) }
            },
            _sum: { paidAmount: true },
        });
        const totalRevenue = Number(paidAgg._sum.paidAmount || 0);

        // --- UNPAID BREAKDOWN (Processing vs Ready) ---
        // We fetch unpaid invoices to classify where the money is stuck
        const unpaidInvoices = await this.prisma.invoice.findMany({
            where: {
                createdAt: { gte: start, lte: end },
                balance: { gt: 0 },
                status: { not: 'VOID' },
                order: { ...(branch && branch !== 'ALL' ? { branch } : {}) }
            },
            select: { balance: true, order: { select: { status: true } } }
        });

        let totalUnpaid = 0;
        let unpaidProcessing = 0; // Washing/Ironing
        let unpaidReady = 0;      // Waiting for pickup

        for (const inv of unpaidInvoices) {
            const bal = Number(inv.balance);
            const s = inv.order.status;
            totalUnpaid += bal;

            if (s === 'READY') {
                unpaidReady += bal; // High priority debt
            } else if (s !== 'DELIVERED' && s !== 'CANCELLED') {
                unpaidProcessing += bal; // Work in progress
            }
        }

        // --- STATUS BREAKDOWN ---
        const statusGroups = await this.prisma.order.groupBy({
            by: ['status'],
            where: whereBase,
            _count: { id: true },
        });
        const statusCounts = statusGroups.reduce((acc, curr) => {
            acc[curr.status] = curr._count.id;
            return acc;
        }, {} as Record<string, number>);

        // --- COUNTS (Active vs Completed) ---
        const completedStatuses = ['DELIVERED', 'CANCELLED'];
        const completedCount = await this.prisma.order.count({
            where: { ...whereBase, status: { in: completedStatuses as any } }
        });
        const pendingCount = totalOrders - completedCount;

        // --- TOP CATEGORIES (Active Orders Only) ---
        // ✅ Logic: Only count items from orders that are NOT Delivered/Cancelled
        const activeItems = await this.prisma.orderItem.findMany({
            where: {
                order: {
                    ...whereBase,
                    status: { notIn: completedStatuses as any } // Active Only
                }
            },
            select: {
                qty: true,
                catalogItem: { select: { category: { select: { name: true } } } }
            }
        });

        const categoryCounts: Record<string, number> = {};
        for (const item of activeItems) {
            const catName = item.catalogItem?.category?.name || "Uncategorized";
            const qty = Number(item.qty || 0);
            categoryCounts[catName] = (categoryCounts[catName] || 0) + qty;
        }

        // Sort Top 8
        const categoryBreakdown = Object.entries(categoryCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8)
            .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

        return {
            totalOrders,
            totalRevenue,
            totalUnpaid,
            unpaidProcessing, // New metric
            unpaidReady,      // New metric
            statusCounts,
            pendingCount,
            completedCount,
            categoryBreakdown
        };
    }
}