import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
    constructor(private prisma: PrismaService) { }

    // List all customers (Active first, then recent updates)
    async findAll() {
        return this.prisma.customer.findMany({
            orderBy: [
                { isArchived: 'asc' },
                { updatedAt: 'desc' }
            ]
        });
    }

    // Update details
    async update(id: number, data: { name?: string; phone?: string; address?: string; notes?: string }) {
        // Check phone uniqueness if changing
        if (data.phone) {
            const existing = await this.prisma.customer.findUnique({ where: { phone: data.phone } });
            if (existing && existing.id !== id) {
                throw new BadRequestException(`Phone number '${data.phone}' is already taken.`);
            }
        }

        return this.prisma.customer.update({
            where: { id },
            data
        });
    }

    // Archive/Unarchive
    async toggleArchive(id: number, isArchived: boolean) {
        return this.prisma.customer.update({
            where: { id },
            data: {
                isArchived,
                // If archiving, we might want to release the phone number uniqueness constraint in a real app, 
                // but for now, we keep it simple based on your schema.
            }
        });
    }
}