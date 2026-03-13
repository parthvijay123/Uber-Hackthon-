import pool from './mysqlClient';
import { schemas } from './schemas';

export async function setupSchema() {
    console.log('Starting modular schema setup...');

    try {
        for (const schema of schemas) {
            console.log(`Creating "${schema.name}" table...`);
            await pool.query(schema.query);
            console.log(`✅ Table "${schema.name}" created or already exists.`);
        }

        console.log('\n✅ All schemas processed successfully.');
    } catch (error: any) {
        console.error('❌ Error during schema setup:', error.message);
        throw error;
    }
}
