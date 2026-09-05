require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { Pool } = require("pg");
const CSV_PATH = path.join(__dirname, "clinics.csv");

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {

  console.error(
    "Thiếu DATABASE_URL trong .env — không thể kết nối Postgres."
  );

  process.exit(1);

}


const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});


// =========================================================
// COLUMNS
// (phải khớp đúng thứ tự cột trong bảng "clinics" — xem
// create_clinics_table.sql)
// =========================================================

const COLUMNS = [
  "clinic_name",
  "clinic_type",
  "address",
  "old_address",
  "ward",
  "prov",
  "latitude",
  "longitude",
  "price",
  "phone",
  "website",
  "operating_hours",
  "license_number",
  "license_issue_date",
  "description",
  "target_groups",
  "ggmaps_link"
  // "service" KHÔNG có trong CSV — để trống, admin tự nhập
  // sau qua trang quản trị.
];


// =========================================================
// HELPERS
// =========================================================

function toNullableText(value) {

  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();

  return trimmed === "" ? null : trimmed;

}

function toNullableNumber(value) {

  const text = toNullableText(value);

  if (text === null) {
    return null;
  }

  const num = Number(text);

  return Number.isNaN(num) ? null : num;

}


// =========================================================
// MAIN
// =========================================================

async function run() {

  if (!fs.existsSync(CSV_PATH)) {

    console.error(`Không tìm thấy file: ${CSV_PATH}`);

    process.exit(1);

  }


  const csvContent = fs.readFileSync(CSV_PATH, "utf8");


  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true
  });


  console.log(`Đọc được ${records.length} dòng từ CSV.`);


  let inserted = 0;
  let skipped = 0;


  for (const record of records) {

    // Bỏ qua dòng trống (không có tên phòng khám) — file CSV
    // có nhiều dòng cuối chỉ có "prov", không có clinic_name.
    if (!toNullableText(record.clinic_name)) {

      skipped += 1;

      continue;

    }


    const values = [
      toNullableText(record.clinic_name),
      toNullableText(record.clinic_type),
      toNullableText(record.address),
      toNullableText(record.old_address),
      toNullableText(record.ward),
      toNullableText(record.prov),
      toNullableNumber(record.latitude),
      toNullableNumber(record.longitude),
      toNullableText(record.price),
      toNullableText(record.phone),
      toNullableText(record.website),
      toNullableText(record.operating_hours),
      toNullableText(record.license_number),
      toNullableText(record.license_issue_date),
      toNullableText(record.description),
      toNullableText(record.target_groups),
      toNullableText(record.ggmaps_link)
    ];


    const placeholders = COLUMNS
      .map((_, i) => `$${i + 1}`)
      .join(", ");


    await pool.query(
      `
        INSERT INTO clinics (${COLUMNS.join(", ")})
        VALUES (${placeholders})
      `,
      values
    );


    inserted += 1;

  }


  console.log(`Đã import ${inserted} phòng khám. Bỏ qua ${skipped} dòng trống.`);


  await pool.end();

}

run().catch(error => {

  console.error("Import thất bại:", error);

  process.exit(1);

});