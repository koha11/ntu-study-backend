import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'ntu_study',
  entities: [path.join(__dirname, '../**/*.entity.js')],
  migrations: [path.join(__dirname, './migrations/*.js')],
  subscribers: [],
  synchronize: false,
  logging:
    process.env.DB_LOGGING === 'true' || process.env.NODE_ENV === 'development',
  dropSchema: false,
  migrationsRun: true,
};

export const AppDataSource = new DataSource(dataSourceOptions);
