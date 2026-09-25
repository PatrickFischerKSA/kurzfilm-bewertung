import {env} from 'cloudflare:workers';
export function database():D1Database {return env.DB;}
