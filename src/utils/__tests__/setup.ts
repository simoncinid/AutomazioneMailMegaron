import 'dotenv/config';

process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT ?? '5432';
process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'test';
process.env.DATABASE_USER = process.env.DATABASE_USER ?? 'test';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'test';
process.env.MANUAL_IMPORT_TOKEN = process.env.MANUAL_IMPORT_TOKEN ?? 'test-token';
