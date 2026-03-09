import pool from './mysqlClient';
import { schemas } from './schemas';

async function setupSchema() {
    console.log('Starting modular schema setup...');

    try {
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
