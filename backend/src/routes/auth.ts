import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../services/db';
import { ChangePasswordRequest } from '@merchcrafter/shared';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { emailService } from '../services/email';

export async function authRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    router.post('/register', {
        schema: {
            body: z.object({
                email: z.string().email(),
                password: z.string().min(6),
            }),
        },
    }, async (request, reply) => {
        const { email, password } = request.body;

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return reply.status(400).send({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                credits: 10, // Default free credits
            },
        });

        const token = app.jwt.sign({ id: user.id, email: user.email });

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                credits: user.credits,
                createdAt: user.createdAt.toISOString(),
            },
        };
    });

    router.post('/login', {
        schema: {
            body: z.object({
                email: z.string().email(),
                password: z.string(),
            }),
        },
    }, async (request, reply) => {
        const { email, password } = request.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return reply.status(401).send({ message: 'Invalid credentials' });
        }

        // Update lastLoginAt
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
        });

        const token = app.jwt.sign({ id: user.id, email: user.email });

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                credits: user.credits,
                createdAt: user.createdAt.toISOString(),
            },
        };
    });

    router.post('/forgot-password', {
        schema: {
            body: z.object({
                email: z.string().email(),
            }),
        },
    }, async (request, reply) => {
        const { email } = request.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            // Silence failure for security
            return { message: 'If an account exists for this email, a temporary password has been sent.' };
        }

        // Generate a simple temporary password
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
        });

        // Send actual email (or mock if no SMTP config)
        await emailService.sendTemporaryPassword(email, tempPassword);

        return { message: 'If an account exists for this email, a temporary password has been sent.' };
    });

    router.get('/me', {
        onRequest: [app.authenticate],
    }, async (request) => {
        const user = await prisma.user.findUnique({
            where: { id: request.user.id },
        });

        if (!user) {
            throw new Error('User not found');
        }

        return {
            id: user.id,
            email: user.email,
            role: user.role,
            credits: user.credits,
            createdAt: user.createdAt.toISOString(),
        };
    });

    router.post<{ Body: ChangePasswordRequest }>('/change-password', {
        onRequest: [app.authenticate],
        schema: {
            body: z.object({
                currentPassword: z.string(),
                newPassword: z.string().min(6),
            }),
        },
    }, async (request, reply) => {
        const { currentPassword, newPassword } = request.body;
        const user = await prisma.user.findUnique({ where: { id: request.user.id } });

        if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
            return reply.status(401).send({ message: 'Invalid current password' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
        });

        return { message: 'Password updated successfully' };
    });
}
