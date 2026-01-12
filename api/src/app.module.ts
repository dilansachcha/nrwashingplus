import { Module } from "@nestjs/common";
import { CatalogModule } from "./catalog/catalog.module";
import { OrdersModule } from "./orders/orders.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { PrismaService } from "./prisma/prisma.service";
import { AppController } from "./app.controller";

@Module({
    imports: [CatalogModule, OrdersModule, InvoicesModule],
    controllers: [AppController],
    providers: [PrismaService],
})
export class AppModule { }
