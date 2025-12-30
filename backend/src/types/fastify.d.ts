import '@fastify/jwt';

declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: { id: number; email: string }; // payload type is used for signing and verifying
        user: { id: number; email: string }; // user type is return type of `request.user` object
    }
}

declare module 'fastify' {
    export interface FastifyInstance {
        authenticate: any;
    }
}
