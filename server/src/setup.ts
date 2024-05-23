import jwt from "@elysiajs/jwt";
import { eq } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { oauth2 } from "elysia-oauth2";
import { users } from "./db/schema";
import db from "./db/db";
import { logger } from "./utils";

const gh_client_id = process.env.GITHUB_CLIENT_ID;
const gh_client_secret = process.env.GITHUB_CLIENT_SECRET;
const jwt_secret = process.env.JWT_SECRET;
export const frontend_url = process.env.FRONTEND_URL;

if (!gh_client_id || !gh_client_secret) {
    throw new Error('Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET');
}
if (!jwt_secret) {
    throw new Error('Please set JWT_SECRET');
}
if (!frontend_url) {
    throw new Error('Please set FRONTEND_URL');
}

export const setup = new Elysia({ name: 'setup' })
    .use(
        jwt({
            name: 'jwt',
            secret: jwt_secret,
            schema: t.Object({
                id: t.Integer(),
            })
        })
    )
    .use(
        oauth2({
            GitHub: [
                gh_client_id,
                gh_client_secret
            ],
        })
    )
    .derive({ as: 'global' }, async ({ headers, jwt }) => {
        const authorization = headers['authorization']
        logger.info('Authorization:' + authorization)
        if (!authorization) {
            return {};
        }
        const token = authorization.split(' ')[1]
        if (process.env.NODE_ENV?.toLowerCase() === 'test') {
            logger.warn('Now in test mode, skip jwt verification.')
            try {
                return JSON.parse(token);
            } catch (e) {
                return {};
            }
        }
        const profile = await jwt.verify(token)
        logger.info('Profile:' + JSON.stringify(profile))
        if (!profile) {
            return {};
        }

        const user = await db.query.users.findFirst({ where: eq(users.id, profile.id) })
        if (!user) {
            return {};
        }
        return {
            uid: user.id,
            admin: user.permission === 1,
        }
    })