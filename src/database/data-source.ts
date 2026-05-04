import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// Determine if running in production (from dist folder) or development
const isProduction = __dirname.includes('dist');

/** Local Postgres usually has no SSL; managed DBs (Neon, RDS, etc.) need SSL. */
function useDatabaseSsl(): boolean {
  const v = process.env.DB_SSL;
  return v === 'true' || v === '1';
}

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'ntu_study',
  entities: [
    path.join(
      __dirname,
      isProduction ? '../**/*.entity.js' : '../**/*.entity{.ts,.js}',
    ),
  ],
  migrations: [
    path.join(
      __dirname,
      isProduction ? '../migrations/*.js' : './migrations/*{.ts,.js}',
    ),
  ],
  subscribers: [],
  synchronize: false,
  logging:
    process.env.DB_LOGGING === 'true' || process.env.NODE_ENV === 'development',
  dropSchema: false,
  migrationsRun: true,
  ...(useDatabaseSsl()
    ? {
        ssl: { rejectUnauthorized: false },
        extra: {
          ssl: {
            rejectUnauthorized: false,
          },
        },
      }
    : {
        ssl: false,
      }),
};

export const AppDataSource = new DataSource(dataSourceOptions);
