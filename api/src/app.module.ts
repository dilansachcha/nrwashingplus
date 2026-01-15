import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

// Feature Modules
import { CatalogModule } from './catalog/catalog.module';
import { OrdersModule } from './orders/orders.module';
import { InvoicesModule } from './invoices/invoices.module';
import { AuthModule } from './auth/auth.module';

// Controllers
import { OrdersController } from './orders/orders.controller';
import { CatalogController } from './catalog/catalog.controller';
import { InvoicesController } from './invoices/invoices.controller';
import { CustomersController } from './customers/customers.controller';
import { ReportsController } from './reports/reports.controller'; // ✅ Correct Import

// Services
import { OrdersService } from './orders/orders.service';
import { InvoicesService } from './invoices/invoices.service';
import { CatalogService } from './catalog/catalog.service';
import { CustomersService } from './customers/customers.service';
import { ReportsService } from './reports/reports.service'; // ✅ Correct Import

@Module({
    imports: [
        CatalogModule,
        OrdersModule,
        InvoicesModule,
        AuthModule
    ],
    controllers: [
        AppController,
        OrdersController,
        CatalogController,
        InvoicesController,
        CustomersController,
        ReportsController // ✅ Added to Controllers
    ],
    providers: [
        AppService,
        PrismaService,
        OrdersService,
        InvoicesService,
        CatalogService,
        CustomersService,
        ReportsService // ✅ Added to Providers
    ],
})
export class AppModule { }