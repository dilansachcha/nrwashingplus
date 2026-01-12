import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { InvoicesService } from "./invoices.service";
import { PaymentMethod } from "@prisma/client";

@Controller("invoices")
export class InvoicesController {
    constructor(private invoices: InvoicesService) { }

    // Optional but useful for Postman testing
    @Get(":invoiceNo")
    getInvoice(@Param("invoiceNo") invoiceNo: string) {
        return this.invoices.getInvoice(invoiceNo);
    }

    @Post(":invoiceNo/pay")
    payInvoice(
        @Param("invoiceNo") invoiceNo: string,
        @Body()
        body: {
            paymentMethod: PaymentMethod;
            paidAmount: number;
        },
    ) {
        return this.invoices.payInvoice(invoiceNo, body);
    }
}
