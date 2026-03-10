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
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.end();
    console.log(`✅ Database '${dbName}' ensured exists.`);
}

async function setupSchema() {
    console.log('Starting modular schema setup...');

    try {
        await ensureDatabaseExists();

        for (const schema of schemas) {
            console.log(`Creating "${schema.name}" table...`);
            await pool.query(schema.query);
            console.log(`✅ Table "${schema.name}" created or already exists.`);

            console.log(`\nVerifying schema for "${schema.name}":`);
            const [rows]: any = await pool.query(`DESCRIBE ${schema.name}`);
            console.table(rows);
        }

        console.log('\n✅ All schemas processed successfully.');
        process.exit(0);
    } catch (error: any) {
        console.error('❌ Error during schema setup:', error.message);
        process.exit(1);
    }
}

setupSchema();
