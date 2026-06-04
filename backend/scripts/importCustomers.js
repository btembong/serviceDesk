/**
 * Import reference customers from Excel into the reference_customers table.
 *
 * Usage:
 *   node scripts/importCustomers.js <path-to-excel-file>
 *
 * Expected columns (exact header names):
 *   Account Number | Name | Email | Phone | Branch
 *
 * Name is split on the first space: "Jane Doe" → firstName="Jane", lastName="Doe"
 * For names with multiple parts: "Jane Mary Doe" → firstName="Jane", lastName="Mary Doe"
 */

const path = require('path');
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node scripts/importCustomers.js <path-to-excel-file>');
  process.exit(1);
}

const splitName = (fullName = '') => {
  const trimmed = fullName.trim();
  const idx = trimmed.indexOf(' ');
  if (idx === -1) return { firstName: trimmed, lastName: '' };
  return {
    firstName: trimmed.slice(0, idx).trim(),
    lastName: trimmed.slice(idx + 1).trim(),
  };
};

const normalise = (val) => (val !== undefined && val !== null ? String(val).trim() : null);

async function main() {
  const absPath = path.resolve(filePath);
  console.log(`Reading: ${absPath}`);

  const workbook = XLSX.readFile(absPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  console.log(`Found ${rows.length} rows in sheet "${sheetName}"\n`);

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 because row 1 is headers

    const accountNumber = normalise(row['Account Number']);
    const name = normalise(row['Name']);
    const email = normalise(row['Email']) || null;
    const phone = normalise(row['Phone']) || null;
    const branch = normalise(row['Branch']) || null;

    if (!accountNumber) {
      errors.push(`Row ${rowNum}: missing Account Number — skipped`);
      skipped++;
      continue;
    }

    if (!name) {
      errors.push(`Row ${rowNum}: missing Name (account ${accountNumber}) — skipped`);
      skipped++;
      continue;
    }

    const { firstName, lastName } = splitName(name);

    try {
      const existing = await prisma.referenceCustomer.findUnique({
        where: { accountNumber },
      });

      if (existing) {
        await prisma.referenceCustomer.update({
          where: { accountNumber },
          data: { firstName, lastName, email, phone, branch },
        });
        updated++;
      } else {
        await prisma.referenceCustomer.create({
          data: { accountNumber, firstName, lastName, email, phone, branch },
        });
        imported++;
      }
    } catch (err) {
      errors.push(`Row ${rowNum} (account ${accountNumber}): ${err.message}`);
      skipped++;
    }
  }

  console.log('─────────────────────────────');
  console.log(`  Imported (new):  ${imported}`);
  console.log(`  Updated:         ${updated}`);
  console.log(`  Skipped/errors:  ${skipped}`);
  console.log('─────────────────────────────');

  if (errors.length > 0) {
    console.log('\nIssues:');
    errors.forEach((e) => console.log(`  ⚠  ${e}`));
  }

  console.log('\nDone.');
}

main()
  .catch((err) => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
