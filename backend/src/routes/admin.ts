import { FastifyInstance } from 'fastify';
import { prisma } from '../services/db';

export async function adminRoutes(app: FastifyInstance) {
    app.addHook('onRequest', app.authenticate);

    app.addHook('onRequest', async (request, reply) => {
        const user = await prisma.user.findUnique({ where: { id: request.user.id } });
        if (!user || user.role !== 'ADMIN') {
            reply.status(403).send({ message: 'Admin access required' });
        }
    });

    app.get('/stats', async (request, reply) => {
        const end = new Date();
        const start30d = new Date(); start30d.setDate(end.getDate() - 30);
        const start24h = new Date(); start24h.setHours(end.getHours() - 24);

        const [
            totalUsers,
            totalProjects,
            totalCreditsPurchased,
            totalCreditsConsumed,
            previewCount,
            finalCount,
            newUsers30d,
            activeUsers24h,
            creditsByPlan,
            uploadTypes,
            stylePopularity,
            dailyRegistrations
        ] = await Promise.all([
            prisma.user.count(),
            prisma.project.count(),
            prisma.creditTransaction.aggregate({ where: { type: 'PURCHASE' }, _sum: { amount: true } }).then(r => r._sum.amount || 0),
            prisma.creditTransaction.aggregate({ where: { amount: { lt: 0 } }, _sum: { amount: true } }).then(r => Math.abs(r._sum.amount || 0)),
            prisma.generation.count({ where: { type: 'PREVIEW' } }),
            prisma.generation.count({ where: { type: 'FINAL' } }),
            prisma.user.count({ where: { createdAt: { gte: start30d } } }),
            prisma.user.count({ where: { lastLoginAt: { gte: start24h } } }),
            Promise.resolve({}),
            prisma.project.groupBy({ by: ['sourceType'], _count: { _all: true } }),
            // @ts-ignore - stylePreset might be missing in generated client types if generation failed
            prisma.generation.groupBy({ by: ['stylePreset'], _count: { _all: true }, orderBy: { _count: { stylePreset: 'desc' } }, take: 5 }),
            prisma.user.findMany({
                where: { createdAt: { gte: start30d } },
                select: { createdAt: true }
            })
        ]);

        // Process daily registrations for chart
        const dailyConfig: Record<string, number> = {};
        for (let d = new Date(start30d); d <= end; d.setDate(d.getDate() + 1)) {
            dailyConfig[d.toISOString().split('T')[0]] = 0;
        }
        dailyRegistrations.forEach(u => {
            const key = u.createdAt.toISOString().split('T')[0];
            if (dailyConfig[key] !== undefined) dailyConfig[key]++;
        });
        const dailyRegistrationsChart = Object.entries(dailyConfig).map(([date, count]) => ({ date, count }));

        const recentUsers = await prisma.user.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { id: true, email: true, createdAt: true, role: true, credits: true }
        });

        return {
            kpi: {
                totalUsers,
                activeUsers24h,
                totalProjects,
                totalRevenue: totalCreditsPurchased * 0.1, // Stub: 10 cents per credit
                totalCreditsConsumed
            },
            breakdown: {
                previewCount,
                finalCount,
                uploadTypes: uploadTypes.map(u => ({ name: u.sourceType, value: u._count._all })),
                stylePopularity: stylePopularity.map(s => ({ name: s.stylePreset || 'Unknown', value: s._count._all }))
            },
            charts: {
                dailyNewUsers: dailyRegistrationsChart
            },
            recentUsers
        };
    });
}
