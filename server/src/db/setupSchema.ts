import mysql from 'mysql2/promise';
import pool from './mysqlClient';
import { schemas } from './schemas';
import dotenv from 'dotenv';

dotenv.config();

const dbName = process.env.DB_NAME || 'driver_pulse';

async function ensureDatabaseExists() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
    };

    const connection = await mysql.createConnection(dbConfig);
    try {
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        console.log(`✅ Database '${dbName}' ensured exists.`);
    } catch (error: any) {
        console.warn(`⚠️ Could not ensure database '${dbName}' exists (likely managed DB without CREATE privileges). Proceeding... Error: ${error.message}`);
    } finally {
        await connection.end();
    }
}

export async function setupSchema() {
    console.log('Starting modular schema setup...');

    try {
        await ensureDatabaseExists();

        await pool.query('SET FOREIGN_KEY_CHECKS = 0;');

        for (const schema of schemas) {
            console.log(`Dropping and Recreating "${schema.name}" table...`);
            await pool.query(`DROP TABLE IF EXISTS \`${schema.name}\`;`);
            await pool.query(schema.query);
            console.log(`✅ Table "${schema.name}" created or already exists.`);
        }

        await pool.query('SET FOREIGN_KEY_CHECKS = 1;');
        console.log('\n✅ All schemas processed successfully.');
    } catch (error: any) {
        console.error('❌ Error during schema setup:', error.message);
        throw error;
    }
}
