import pool from './db/mysqlClient';

async function verifyConnection() {
    console.log('Testing MySQL connection...');
    try {
        const connection = await pool.getConnection();
        console.log('✅ Successfully connected to MySQL!');

        const [rows]: any = await connection.query('SELECT 1 + 1 AS result');
        console.log('✅ Query execution verified. Result:', rows[0].result);

        connection.release();
        process.exit(0);
    } catch (error: any) {
        console.error('❌ Connection failed:');
        if (error.code === 'ER_BAD_DB_ERROR') {
            console.error(`Database "${process.env.DB_NAME}" does not exist. Attempting to create it...`);
            await createDatabase();
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('Access denied. Please check your credentials in the .env file.');
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

async function createDatabase() {
    // Create a temporary connection without choosing a database
    const tempPool = require('mysql2/promise').createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
    });

    try {
        await tempPool.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
        console.log(`✅ Database "${process.env.DB_NAME}" created successfully!`);
        console.log('Please run the verification script again.');
    } catch (err: any) {
        console.error('❌ Failed to create database:', err.message);
    } finally {
        await tempPool.end();
    }
}

verifyConnection();
