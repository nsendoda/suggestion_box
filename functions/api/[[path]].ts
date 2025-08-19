/// <reference types="@cloudflare/workers-types" />
import type { PagesFunction, Fetcher } from '@cloudflare/workers-types';
type Env = { API: Fetcher };
export const onRequest: PagesFunction<Env> = async (ctx) => ctx.env.API.fetch(ctx.request);
