import { connectToDatabase } from "../src/lib/db/connection";
import { ImportJobModel } from "../src/lib/db/models/import-job";

await connectToDatabase();

const job = await ImportJobModel.findOne({ job_id: 'import_1763583617511_v0p1nl' }).lean();

console.log('Job Status:', job?.status);
console.log('\nErrors:');
console.log(JSON.stringify(job?.import_errors, null, 2));
