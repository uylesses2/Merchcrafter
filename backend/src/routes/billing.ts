import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';

export async function billingRoutes(app: FastifyInstance) {
    app.addHook('onRequest', app.authenticate);

    app.post('/checkout', {
        schema: {
            body: z.object({
                bundle: z.string(), // e.g., "small", "medium"
            }),
        },
    }, async (request, reply) => {
        const { bundle } = request.body;
        const userId = request.user.id;

        let amount = 0;
        if (bundle === 'small') amount = 20;
        else if (bundle === 'medium') amount = 50;
        else if (bundle === 'large') amount = 100;
        else return reply.status(400).send({ message: 'Invalid bundle' });

        // TODO: Integrate Stripe here

        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: { credits: { increment: amount } },
            });
            await tx.creditTransaction.create({
                data: {
                    userId,
                    amount,
                    type: 'PURCHASE',
                },
            });
        });

        return { success: true, message: `Purchased ${amount} credits` };
    });
}
