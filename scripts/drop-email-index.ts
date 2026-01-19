import mongoose from 'mongoose';

const url = 'mongodb://root:root@149.81.163.109:27017/vinc-hidros-it?authSource=admin';

async function dropIndex() {
  await mongoose.connect(url);
  const db = mongoose.connection.db!;
  try {
    await db.collection('customers').dropIndex('tenant_id_1_email_1');
    console.log('✓ Index dropped: tenant_id_1_email_1');
  } catch (err: unknown) {
    const e = err as { codeName?: string; message?: string };
    if (e.codeName === 'IndexNotFound') {
      console.log('Index already dropped');
    } else {
      console.error('Error:', e.message);
    }
  }
  await mongoose.disconnect();
}

dropIndex();
