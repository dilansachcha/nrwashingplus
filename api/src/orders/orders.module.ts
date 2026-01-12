import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { PrismaService } from "../prisma/prisma.service";
import { InvoicesService } from "../invoices/invoices.service";

@Module({
    controllers: [OrdersController],
    providers: [OrdersService, PrismaService, InvoicesService],
})
export class OrdersModule { }
