import { createElement } from 'react';
import { renderDocument } from '@formepdf/core';
import { CallSheet } from './call-sheet';
import { getTransportPlan } from '@/lib/drive-plan';

export async function GET() {
    try {
        const transportPlan = await getTransportPlan();
        const document = createElement(CallSheet, { drives: transportPlan.drives });

        const pdfBytes = await renderDocument(document);

        const normalizedPdfBytes = new Uint8Array(pdfBytes.length);
        normalizedPdfBytes.set(pdfBytes);

        return new Response(normalizedPdfBytes, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'inline; filename="transport-plan.pdf"',
            },
        });
    } catch (error) {
        return Response.json(
            {
                error: error instanceof Error ? error.message : 'Unexpected server error',
            },
            { status: 500 }
        );
    }
}