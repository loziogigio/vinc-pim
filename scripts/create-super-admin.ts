/**
 * Create Super Admin Script
 *
 * Creates the first super admin user for the tenant management system.
 *
 * Usage:
 *   npx tsx scripts/create-super-admin.ts --email admin@vinc.com --password secret123 --name "Admin User"
 *
 * Or with environment variables:
 *   SUPER_ADMIN_EMAIL=admin@vinc.com SUPER_ADMIN_PASSWORD=secret123 npx tsx scripts/create-super-admin.ts
 */

import { config } from "dotenv";
config({ path: ".env" });

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// ============================================
// CONFIGURATION
// ============================================

const ADMIN_DB = "vinc-admin";

// ============================================
// PARSE ARGUMENTS
// ============================================

function parseArgs(): { email: string; password: string; name: string } {
  const args = process.argv.slice(2);
  let email = process.env.SUPER_ADMIN_EMAIL || "";
  let password = process.env.SUPER_ADMIN_PASSWORD || "";
  let name = process.env.SUPER_ADMIN_NAME || "Super Admin";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) {
      email = args[i + 1];
      i++;
    } else if (args[i] === "--password" && args[i + 1]) {
      password = args[i + 1];
      i++;
    } else if (args[i] === "--name" && args[i + 1]) {
      name = args[i + 1];
      i++;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Create Super Admin Script

Usage:
  npx ts-node scripts/create-super-admin.ts [options]

Options:
  --email <email>       Email address for the super admin (required)
  --password <password> Password for the super admin (required, min 8 chars)
  --name <name>         Display name (default: "Super Admin")
  --help, -h            Show this help message

Environment Variables:
  SUPER_ADMIN_EMAIL     Email address (alternative to --email)
  SUPER_ADMIN_PASSWORD  Password (alternative to --password)
  SUPER_ADMIN_NAME      Display name (alternative to --name)

Examples:
  npx ts-node scripts/create-super-admin.ts --email admin@vinc.com --password secret123
  SUPER_ADMIN_EMAIL=admin@vinc.com SUPER_ADMIN_PASSWORD=secret npx ts-node scripts/create-super-admin.ts
`);
      process.exit(0);
    }
  }

  return { email, password, name };
}

// ============================================
// MAIN
// ============================================

async function main() {
  const { email, password, name } = parseArgs();

  // Validate inputs
  if (!email) {
    console.error("Error: Email is required. Use --email or SUPER_ADMIN_EMAIL env var.");
    process.exit(1);
  }

  if (!password) {
    console.error("Error: Password is required. Use --password or SUPER_ADMIN_PASSWORD env var.");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Error: Password must be at least 8 characters.");
    process.exit(1);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error("Error: Invalid email format.");
    process.exit(1);
  }

  const mongoUrl = process.env.VINC_MONGO_URL;
  if (!mongoUrl) {
    console.error("Error: VINC_MONGO_URL environment variable is not set.");
    process.exit(1);
  }

  console.log(`\nCreating super admin in ${ADMIN_DB} database...`);
  console.log(`  Email: ${email}`);
  console.log(`  Name: ${name}`);

  try {
    // Connect to admin database
    const connection = await mongoose.createConnection(mongoUrl, {
      dbName: ADMIN_DB,
    }).asPromise();

    console.log(`Connected to ${ADMIN_DB} database.`);

    // Define schema
    const SuperAdminSchema = new mongoose.Schema(
      {
        email: { type: String, required: true, unique: true, lowercase: true },
        password_hash: { type: String, required: true },
        name: { type: String, required: true },
        is_active: { type: Boolean, default: true },
        last_login: { type: Date },
      },
      { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
    );

    const SuperAdminModel = connection.model("SuperAdmin", SuperAdminSchema);

    // Check if admin already exists
    const existing = await SuperAdminModel.findOne({ email: email.toLowerCase() });
    if (existing) {
      console.log(`\nSuper admin with email '${email}' already exists.`);
      console.log("Use a different email or update the existing admin directly in the database.");
      await connection.close();
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create admin
    const admin = await SuperAdminModel.create({
      email: email.toLowerCase(),
      password_hash: passwordHash,
      name,
      is_active: true,
    });

    console.log(`\nSuper admin created successfully!`);
    console.log(`  ID: ${admin._id}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  Name: ${admin.name}`);
    console.log(`\nYou can now login at: POST /api/admin/auth/login`);
    console.log(`  Body: { "email": "${email}", "password": "<your-password>" }`);

    await connection.close();
    process.exit(0);
  } catch (error) {
    console.error("\nError creating super admin:", error);
    process.exit(1);
  }
}

main();
