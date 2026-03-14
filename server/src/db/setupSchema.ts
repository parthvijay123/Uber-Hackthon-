import pool from './mysqlClient';
import { schemas } from './schemas';

export async function setupSchema(): Promise<void> {
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
    } catch (error: any) {
        console.error('❌ Error during schema setup:', error.message);
        throw error;
    }
}

// Run as CLI when executed directly (npm run db-setup)
if (require.main === module) {
    setupSchema().then(() => process.exit(0)).catch(() => process.exit(1));
}
