require("dotenv").config();
console.log("OPENAI_API_KEY loaded:", !!process.env.OPENAI_API_KEY);
const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const DOMPurify = require("isomorphic-dompurify");
const app = express();
const PORT = process.env.PORT || 3000;
const {
  SESSION_SECRET,
  ADMIN_USERNAME,
  ADMIN_PASSWORD_HASH,
  DATABASE_URL
} = process.env;

if (!SESSION_SECRET || !ADMIN_USERNAME || !ADMIN_PASSWORD_HASH || !DATABASE_URL) {

  console.error(
    "Thiếu SESSION_SECRET / ADMIN_USERNAME / ADMIN_PASSWORD_HASH / DATABASE_URL trong .env — server không khởi động. Xem .env.example."
  );

  process.exit(1);

}
app.use(express.json());
app.set("trust proxy", 1);

app.use(
  session({
    name: "msvn.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);


const pool = new Pool({
  connectionString: DATABASE_URL,
});

pool
  .connect()
  .then(client => {

    console.log("PostgreSQL database connected.");

    client.release();

  })
  .catch(error => {

    console.error("Postgres connection failed:", error);

    process.exit(1);

  });


async function ensureFeedbackTable() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS feedback (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT,
      category TEXT,
      message TEXT NOT NULL,
      page TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      status TEXT DEFAULT 'new',
      is_read BOOLEAN DEFAULT FALSE,
      reply_message TEXT,
      replied_at TIMESTAMPTZ
    )
  `);


  await pool.query(`
    ALTER TABLE feedback
    ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE
  `);

  await pool.query(`
    ALTER TABLE feedback
    ADD COLUMN IF NOT EXISTS reply_message TEXT
  `);

  await pool.query(`
    ALTER TABLE feedback
    ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ
  `);

}

ensureFeedbackTable().catch(error => {

  console.error("Failed to ensure feedback table:", error);

  process.exit(1);

});

async function ensureArticlesTable() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS articles (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      cover_image_url TEXT,
      content TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

}

ensureArticlesTable().catch(error => {

  console.error("Failed to ensure articles table:", error);

  process.exit(1);

});


const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;


function isLockedOut(ip) {

  const entry = loginAttempts.get(ip);

  if (!entry) return false;

  if (entry.count < MAX_ATTEMPTS) return false;

  if (Date.now() - entry.lastAttempt > LOCKOUT_MS) {

    loginAttempts.delete(ip);

    return false;

  }

  return true;

}

function registerFailedAttempt(ip) {

  const entry =
    loginAttempts.get(ip) ||
    { count: 0, lastAttempt: 0 };

  entry.count += 1;

  entry.lastAttempt = Date.now();

  loginAttempts.set(ip, entry);

}

function clearAttempts(ip) {

  loginAttempts.delete(ip);

}


function requireAuth(req, res, next) {

  if (req.session && req.session.isAdmin) {

    return next();

  }

  return res.status(401).json({
    error: "Unauthorized."
  });

}


app.post(
  "/api/admin/login",
  async (req, res) => {

    const ip = req.ip;


    if (isLockedOut(ip)) {

      return res.status(429).json({
        error:
          "Quá nhiều lần đăng nhập sai. Vui lòng thử lại sau 15 phút."
      });

    }


    const { username, password } =
      req.body || {};


    if (!username || !password) {

      return res.status(400).json({
        error:
          "Vui lòng nhập tên đăng nhập và mật khẩu."
      });

    }


    const validUsername =
      username === ADMIN_USERNAME;

    const validPassword =
      await bcrypt.compare(
        password,
        ADMIN_PASSWORD_HASH
      );


    if (!validUsername || !validPassword) {

      registerFailedAttempt(ip);

      return res.status(401).json({
        error:
          "Sai tên đăng nhập hoặc mật khẩu."
      });

    }


    clearAttempts(ip);


    req.session.regenerate(err => {

      if (err) {

        return res.status(500).json({
          error: "Đăng nhập thất bại."
        });

      }


      req.session.isAdmin = true;

      req.session.username = username;


      res.json({
        message: "Đăng nhập thành công."
      });

    });

  }
);


app.post(
  "/api/admin/logout",
  (req, res) => {

    if (!req.session) {

      return res.json({
        message: "Đã đăng xuất."
      });

    }


    req.session.destroy(() => {

      res.clearCookie("msvn.sid");

      res.json({
        message: "Đã đăng xuất."
      });

    });

  }
);


app.get(
  "/api/admin/session",
  (req, res) => {

    res.json({
      authenticated:
        !!(req.session && req.session.isAdmin)
    });

  }
);


const OPEN_ADMIN_PATHS = [
  "/login.html",
  "/login.css",
  "/login.js"
];

app.use("/admin", (req, res, next) => {

  if (OPEN_ADMIN_PATHS.includes(req.path)) {

    return next();

  }


  if (req.session && req.session.isAdmin) {

    return next();

  }


  return res.redirect("/admin/login.html");

});


app.use("/api/admin", requireAuth);


app.use(
  express.static(__dirname)
);


function validateClinic(data) {

  const errors = [];


  if (
    !data.clinic_name ||
    typeof data.clinic_name !== "string" ||
    !data.clinic_name.trim()
  ) {

    errors.push("Clinic name is required.");

  }


  if (
    !data.clinic_type ||
    typeof data.clinic_type !== "string" ||
    !data.clinic_type.trim()
  ) {

    errors.push("Clinic type is required.");

  }


  if (
    !data.address ||
    typeof data.address !== "string" ||
    !data.address.trim()
  ) {

    errors.push("Address is required.");

  }


  if (
    data.latitude !== "" &&
    data.latitude !== null &&
    data.latitude !== undefined
  ) {

    const latitude = Number(data.latitude);


    if (
      Number.isNaN(latitude) ||
      latitude < -90 ||
      latitude > 90
    ) {

      errors.push("Latitude must be between -90 and 90.");

    }

  }


  if (
    data.longitude !== "" &&
    data.longitude !== null &&
    data.longitude !== undefined
  ) {

    const longitude = Number(data.longitude);


    if (
      Number.isNaN(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {

      errors.push("Longitude must be between -180 and 180.");

    }

  }


  if (
    data.website &&
    typeof data.website === "string"
  ) {

    try {

      new URL(data.website);

    } catch {

      errors.push("Website must be a valid URL.");

    }

  }


  return errors;

}

function validateArticle(data) {

  const errors = [];


  if (
    !data.title ||
    typeof data.title !== "string" ||
    !data.title.trim()
  ) {

    errors.push("Title is required.");

  }


  if (
    !data.subtitle ||
    typeof data.subtitle !== "string" ||
    !data.subtitle.trim()
  ) {

    errors.push("Subtitle is required.");

  }


  if (
    data.status &&
    !["draft", "published"].includes(data.status)
  ) {

    errors.push("Invalid status.");

  }


  if (
    data.cover_image_url &&
    typeof data.cover_image_url === "string" &&
    data.cover_image_url.trim()
  ) {

    try {

      new URL(data.cover_image_url);

    } catch {

      errors.push("Cover image must be a valid URL.");

    }

  }


  return errors;

}

app.get(
  "/api/admin/clinics",
  async (req, res) => {

    try {

      const result = await pool.query(`
        SELECT *
        FROM clinics
        ORDER BY id DESC
      `);


      res.json(result.rows);


    } catch (error) {

      console.error("GET /api/admin/clinics error:", error);


      res.status(500).json({
        error: "Failed to load clinics."
      });

    }

  }
);


app.get(
  "/api/admin/clinics/:id",
  async (req, res) => {

    try {

      const id = Number(req.params.id);


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error: "Invalid clinic ID."
        });

      }


      const result = await pool.query(
        `SELECT * FROM clinics WHERE id = $1`,
        [id]
      );


      const clinic = result.rows[0];


      if (!clinic) {

        return res.status(404).json({
          error: "Clinic not found."
        });

      }


      res.json(clinic);


    } catch (error) {

      console.error("GET clinic error:", error);


      res.status(500).json({
        error: "Failed to load clinic."
      });

    }

  }
);


app.post(
  "/api/admin/clinics",
  async (req, res) => {

    try {

      const data = req.body;


      const errors = validateClinic(data);


      if (errors.length > 0) {

        return res.status(400).json({
          error: "Validation failed.",
          details: errors
        });

      }


      const latitude =
        data.latitude === "" ||
        data.latitude === null ||
        data.latitude === undefined
          ? null
          : Number(data.latitude);


      const longitude =
        data.longitude === "" ||
        data.longitude === null ||
        data.longitude === undefined
          ? null
          : Number(data.longitude);


      const result = await pool.query(
        `
          INSERT INTO clinics (
            clinic_name, clinic_type, address, old_address,
            ward, prov, latitude, longitude, price, phone,
            website, ggmaps_link, operating_hours, license_number,
            license_issue_date, description, target_groups, service
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18
          )
          RETURNING id
        `,
        [
          data.clinic_name.trim(),
          data.clinic_type.trim(),
          data.address.trim(),
          data.old_address?.trim() || "",
          data.ward?.trim() || "",
          data.prov?.trim() || "",
          latitude,
          longitude,
          data.price?.trim() || "",
          data.phone?.trim() || "",
          data.website?.trim() || "",
          data.ggmaps_link?.trim() || "",
          data.operating_hours?.trim() || "",
          data.license_number?.trim() || "",
          data.license_issue_date || "",
          data.description?.trim() || "",
          data.target_groups?.trim() || "",
          data.service?.trim() || ""
        ]
      );


      const newId = result.rows[0].id;


      const newClinicResult = await pool.query(
        `SELECT * FROM clinics WHERE id = $1`,
        [newId]
      );


      res.status(201).json({
        message: "Clinic added successfully.",
        clinic: newClinicResult.rows[0]
      });


    } catch (error) {

      console.error("POST /api/admin/clinics error:", error);


      res.status(500).json({
        error: "Failed to add clinic."
      });

    }

  }
);


app.put(
  "/api/admin/clinics/:id",
  async (req, res) => {

    try {

      const id = Number(req.params.id);


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error: "Invalid clinic ID."
        });

      }


      const existingResult = await pool.query(
        `SELECT * FROM clinics WHERE id = $1`,
        [id]
      );


      if (!existingResult.rows[0]) {

        return res.status(404).json({
          error: "Clinic not found."
        });

      }


      const data = req.body;


      const errors = validateClinic(data);


      if (errors.length > 0) {

        return res.status(400).json({
          error: "Validation failed.",
          details: errors
        });

      }


      const latitude =
        data.latitude === "" ||
        data.latitude === null ||
        data.latitude === undefined
          ? null
          : Number(data.latitude);


      const longitude =
        data.longitude === "" ||
        data.longitude === null ||
        data.longitude === undefined
          ? null
          : Number(data.longitude);


      await pool.query(
        `
          UPDATE clinics
          SET
            clinic_name = $1,
            clinic_type = $2,
            address = $3,
            old_address = $4,
            ward = $5,
            prov = $6,
            latitude = $7,
            longitude = $8,
            price = $9,
            phone = $10,
            website = $11,
            ggmaps_link = $12,
            operating_hours = $13,
            license_number = $14,
            license_issue_date = $15,
            description = $16,
            target_groups = $17,
            service = $18
          WHERE id = $19
        `,
        [
          data.clinic_name.trim(),
          data.clinic_type.trim(),
          data.address.trim(),
          data.old_address?.trim() || "",
          data.ward?.trim() || "",
          data.prov?.trim() || "",
          latitude,
          longitude,
          data.price?.trim() || "",
          data.phone?.trim() || "",
          data.website?.trim() || "",
          data.ggmaps_link?.trim() || "",
          data.operating_hours?.trim() || "",
          data.license_number?.trim() || "",
          data.license_issue_date || "",
          data.description?.trim() || "",
          data.target_groups?.trim() || "",
          data.service?.trim() || "",
          id
        ]
      );


      const updatedResult = await pool.query(
        `SELECT * FROM clinics WHERE id = $1`,
        [id]
      );


      res.json({
        message: "Clinic updated successfully.",
        clinic: updatedResult.rows[0]
      });


    } catch (error) {

      console.error("PUT clinic error:", error);


      res.status(500).json({
        error: "Failed to update clinic."
      });

    }

  }
);


app.delete(
  "/api/admin/clinics/:id",
  async (req, res) => {

    try {

      const id = Number(req.params.id);


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error: "Invalid clinic ID."
        });

      }


      const result = await pool.query(
        `DELETE FROM clinics WHERE id = $1`,
        [id]
      );


      if (result.rowCount === 0) {

        return res.status(404).json({
          error: "Clinic not found."
        });

      }


      res.json({
        message: "Clinic deleted successfully."
      });


    } catch (error) {

      console.error("DELETE clinic error:", error);


      res.status(500).json({
        error: "Failed to delete clinic."
      });

    }

  }
);

app.get(
  "/api/admin/articles",
  async (req, res) => {

    try {

      const result = await pool.query(`
        SELECT id, title, subtitle, cover_image_url, status, created_at, updated_at
        FROM articles
        ORDER BY updated_at DESC
      `);


      res.json(result.rows);


    } catch (error) {

      console.error("GET /api/admin/articles error:", error);


      res.status(500).json({
        error: "Failed to load articles."
      });

    }

  }
);


app.get(
  "/api/admin/articles/:id",
  async (req, res) => {

    try {

      const id = Number(req.params.id);


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error: "Invalid article ID."
        });

      }


      const result = await pool.query(
        `SELECT * FROM articles WHERE id = $1`,
        [id]
      );


      const article = result.rows[0];


      if (!article) {

        return res.status(404).json({
          error: "Article not found."
        });

      }


      res.json(article);


    } catch (error) {

      console.error("GET article error:", error);


      res.status(500).json({
        error: "Failed to load article."
      });

    }

  }
);


app.post(
  "/api/admin/articles",
  async (req, res) => {

    try {

      const data = req.body;


      const errors = validateArticle(data);


      if (errors.length > 0) {

        return res.status(400).json({
          error: "Validation failed.",
          details: errors
        });

      }


      // Nội dung là HTML do editor Quill sinh ra — sanitize
      // trước khi lưu để chặn thẻ/script độc hại, chỉ giữ lại
      // các thẻ định dạng cần cho bài đọc.
      const cleanContent = DOMPurify.sanitize(data.content || "", {
        ALLOWED_TAGS: [
          "p", "br", "strong", "em", "u", "s",
          "h2", "h3", "blockquote",
          "ul", "ol", "li", "a", "img"
        ],
        ALLOWED_ATTR: ["href", "src", "alt", "target", "rel"]
      });


      const result = await pool.query(
        `
          INSERT INTO articles (
            title, subtitle, cover_image_url, content, status
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `,
        [
          data.title.trim(),
          data.subtitle.trim(),
          data.cover_image_url?.trim() || null,
          cleanContent,
          data.status?.trim() || "draft"
        ]
      );


      const newId = result.rows[0].id;


      const newArticleResult = await pool.query(
        `SELECT * FROM articles WHERE id = $1`,
        [newId]
      );


      res.status(201).json({
        message: "Article added successfully.",
        article: newArticleResult.rows[0]
      });


    } catch (error) {

      console.error("POST /api/admin/articles error:", error);


      res.status(500).json({
        error: "Failed to add article."
      });

    }

  }
);


app.put(
  "/api/admin/articles/:id",
  async (req, res) => {

    try {

      const id = Number(req.params.id);


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error: "Invalid article ID."
        });

      }


      const existingResult = await pool.query(
        `SELECT * FROM articles WHERE id = $1`,
        [id]
      );


      if (!existingResult.rows[0]) {

        return res.status(404).json({
          error: "Article not found."
        });

      }


      const data = req.body;


      const errors = validateArticle(data);


      if (errors.length > 0) {

        return res.status(400).json({
          error: "Validation failed.",
          details: errors
        });

      }


      const cleanContent = DOMPurify.sanitize(data.content || "", {
        ALLOWED_TAGS: [
          "p", "br", "strong", "em", "u", "s",
          "h2", "h3", "blockquote",
          "ul", "ol", "li", "a", "img"
        ],
        ALLOWED_ATTR: ["href", "src", "alt", "target", "rel"]
      });


      await pool.query(
        `
          UPDATE articles
          SET
            title = $1,
            subtitle = $2,
            cover_image_url = $3,
            content = $4,
            status = $5,
            updated_at = NOW()
          WHERE id = $6
        `,
        [
          data.title.trim(),
          data.subtitle.trim(),
          data.cover_image_url?.trim() || null,
          cleanContent,
          data.status?.trim() || "draft",
          id
        ]
      );


      const updatedResult = await pool.query(
        `SELECT * FROM articles WHERE id = $1`,
        [id]
      );


      res.json({
        message: "Article updated successfully.",
        article: updatedResult.rows[0]
      });


    } catch (error) {

      console.error("PUT article error:", error);


      res.status(500).json({
        error: "Failed to update article."
      });

    }

  }
);


app.delete(
  "/api/admin/articles/:id",
  async (req, res) => {

    try {

      const id = Number(req.params.id);


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error: "Invalid article ID."
        });

      }


      const result = await pool.query(
        `DELETE FROM articles WHERE id = $1`,
        [id]
      );


      if (result.rowCount === 0) {

        return res.status(404).json({
          error: "Article not found."
        });

      }


      res.json({
        message: "Article deleted successfully."
      });


    } catch (error) {

      console.error("DELETE article error:", error);


      res.status(500).json({
        error: "Failed to delete article."
      });

    }

  }
);

app.post(
  "/api/feedback",
  async (req, res) => {

    try {

      const {
        name,
        email,
        type,
        message
      } = req.body;


      if (
        !name ||
        typeof name !== "string" ||
        !name.trim()
      ) {

        return res.status(400).json({
          error: "Name is required."
        });

      }


      if (
        !type ||
        typeof type !== "string" ||
        !type.trim()
      ) {

        return res.status(400).json({
          error: "Feedback topic is required."
        });

      }


      if (
        !message ||
        typeof message !== "string" ||
        !message.trim()
      ) {

        return res.status(400).json({
          error: "Message is required."
        });

      }


      const result = await pool.query(
        `
          INSERT INTO feedback (name, email, category, message, page)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `,
        [
          name.trim(),
          typeof email === "string" ? email.trim() : "",
          type.trim(),
          message.trim(),
          req.headers.referer || ""
        ]
      );


      res.status(201).json({
        success: true,
        message: "Feedback submitted successfully.",
        id: result.rows[0].id
      });


    } catch (error) {

      console.error("POST /api/feedback error:", error);


      res.status(500).json({
        error: "Failed to save feedback."
      });

    }

  }
);


app.get(
  "/api/admin/feedback",
  async (req, res) => {

    try {

      const result = await pool.query(`
        SELECT
          id, name, email, category, message, page,
          created_at, status, is_read, reply_message, replied_at
        FROM feedback
        ORDER BY id DESC
      `);


      res.json(result.rows);


    } catch (error) {

      console.error("GET /api/admin/feedback error:", error);


      res.status(500).json({
        error: "Failed to load feedback."
      });

    }

  }
);


app.get(
  "/api/admin/feedback/:id",
  async (req, res) => {

    try {

      const id = Number(req.params.id);


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error: "Invalid feedback ID."
        });

      }


      const result = await pool.query(
        `
          SELECT
            id, name, email, category, message, page,
            created_at, status, is_read, reply_message, replied_at
          FROM feedback
          WHERE id = $1
        `,
        [id]
      );


      const item = result.rows[0];


      if (!item) {

        return res.status(404).json({
          error: "Feedback not found."
        });

      }


      res.json(item);


    } catch (error) {

      console.error("GET one feedback error:", error);


      res.status(500).json({
        error: "Failed to load feedback."
      });

    }

  }
);


app.post(
  "/api/admin/feedback/:id/read",
  async (req, res) => {

    try {

      const id = Number(req.params.id);


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error: "Invalid feedback ID."
        });

      }


      const result = await pool.query(
        `UPDATE feedback SET is_read = TRUE WHERE id = $1`,
        [id]
      );


      if (result.rowCount === 0) {

        return res.status(404).json({
          error: "Feedback not found."
        });

      }


      const updatedResult = await pool.query(
        `SELECT * FROM feedback WHERE id = $1`,
        [id]
      );


      res.json({
        message: "Feedback marked as read.",
        feedback: updatedResult.rows[0]
      });


    } catch (error) {

      console.error("Mark feedback read error:", error);


      res.status(500).json({
        error: "Failed to mark feedback as read."
      });

    }

  }
);

app.post(
  "/api/admin/feedback/:id/reply",
  async (req, res) => {

    try {

      const id = Number(req.params.id);


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error: "Invalid feedback ID."
        });

      }


      const { reply_message } = req.body || {};


      if (
        !reply_message ||
        typeof reply_message !== "string" ||
        !reply_message.trim()
      ) {

        return res.status(400).json({
          error: "Nội dung trả lời không được để trống."
        });

      }


      const existingResult = await pool.query(
        `SELECT id FROM feedback WHERE id = $1`,
        [id]
      );


      if (!existingResult.rows[0]) {

        return res.status(404).json({
          error: "Feedback not found."
        });

      }


      await pool.query(
        `
          UPDATE feedback
          SET
            reply_message = $1,
            replied_at = NOW(),
            status = 'resolved',
            is_read = TRUE
          WHERE id = $2
        `,
        [reply_message.trim(), id]
      );


      const updatedResult = await pool.query(
        `SELECT * FROM feedback WHERE id = $1`,
        [id]
      );


      res.json({
        message: "Reply saved successfully.",
        feedback: updatedResult.rows[0]
      });


    } catch (error) {

      console.error("Reply feedback error:", error);


      res.status(500).json({
        error: "Failed to save reply."
      });

    }

  }
);


app.patch(
  "/api/admin/feedback/:id",
  async (req, res) => {

    try {

      const id = Number(req.params.id);


      const { status } = req.body;


      const allowedStatuses = [
        "new",
        "reviewed",
        "resolved"
      ];


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error: "Invalid feedback ID."
        });

      }


      if (!allowedStatuses.includes(status)) {

        return res.status(400).json({
          error: "Invalid feedback status."
        });

      }


      const result = await pool.query(
        `UPDATE feedback SET status = $1 WHERE id = $2`,
        [status, id]
      );


      if (result.rowCount === 0) {

        return res.status(404).json({
          error: "Feedback not found."
        });

      }


      const updatedResult = await pool.query(
        `SELECT * FROM feedback WHERE id = $1`,
        [id]
      );


      res.json({
        message: "Feedback status updated.",
        feedback: updatedResult.rows[0]
      });


    } catch (error) {

      console.error("PATCH feedback error:", error);


      res.status(500).json({
        error: "Failed to update feedback."
      });

    }

  }
);


app.delete(
  "/api/admin/feedback/:id",
  async (req, res) => {

    try {

      const id = Number(req.params.id);


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error: "Invalid feedback ID."
        });

      }


      const result = await pool.query(
        `DELETE FROM feedback WHERE id = $1`,
        [id]
      );


      if (result.rowCount === 0) {

        return res.status(404).json({
          error: "Feedback not found."
        });

      }


      res.json({
        message: "Feedback deleted successfully."
      });


    } catch (error) {

      console.error("DELETE feedback error:", error);


      res.status(500).json({
        error: "Failed to delete feedback."
      });

    }

  }
);

app.get(
  "/api/geocode",
  async (req, res) => {

    try {

      const query = req.query.q;

      if (!query || typeof query !== "string") {

        return res.status(400).json({
          error: "Missing q."
        });

      }

      const url = new URL(
        "https://nominatim.openstreetmap.org/search"
      );

      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "1");
      url.searchParams.set("q", query);

      const response = await fetch(url, {
        headers: {
          "User-Agent": "PsyMapVN/1.0 (psymapvn@gmail.com)",
          "Accept-Language": "vi"
        }
      });

      if (!response.ok) {

        console.error(
          `Nominatim returned HTTP ${response.status}`
        );

        return res.status(response.status).json({
          error: `Nominatim HTTP ${response.status}`
        });

      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {

        return res.json(null);

      }

      return res.json({
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      });

    } catch (error) {

      console.error(
        "Nominatim geocoding error:",
        error
      );

      return res.status(500).json({
        error: "Geocoding failed."
      });

    }

  }
);

app.get(
  "/api/reverse-geocode",
  async (req, res) => {

    try {

      const { lat, lng } = req.query;

      if (lat === undefined || lng === undefined || lat === "" || lng === "") {

        return res.status(400).json({
          error: "Missing lat/lng."
        });

      }

      const latitude = Number(lat);
      const longitude = Number(lng);

      if (Number.isNaN(latitude) || Number.isNaN(longitude)) {

        return res.status(400).json({
          error: "Invalid lat/lng."
        });

      }

      const url = new URL(
        "https://nominatim.openstreetmap.org/reverse"
      );

      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("lat", String(latitude));
      url.searchParams.set("lon", String(longitude));
      url.searchParams.set("accept-language", "vi");

      const response = await fetch(url, {
        headers: {
          "User-Agent": "PsyMapVN/1.0 (psymapvn@gmail.com)",
          "Accept-Language": "vi"
        }
      });

      if (!response.ok) {

        console.error(
          `Nominatim reverse returned HTTP ${response.status}`
        );

        return res.status(response.status).json({
          error: `Nominatim HTTP ${response.status}`
        });

      }

      const data = await response.json();

      return res.json(data);

    } catch (error) {

      console.error(
        "Nominatim reverse geocoding error:",
        error
      );

      return res.status(500).json({
        error: "Reverse geocoding failed."
      });

    }

  }

);
if (!process.env.OPENAI_API_KEY) {
  console.error("Thiếu OPENAI_API_KEY trong .env — bài tập gọi tên cảm xúc sẽ không hoạt động.");
}

// --- rate limiting đơn giản, tái dùng pattern giống loginAttempts ---
const emoUsage = new Map();
const EMO_WINDOW_MS = 60 * 1000;
const EMO_MAX_PER_WINDOW = 10;

function isEmoRateLimited(ip) {
  const now = Date.now();
  const entry = emoUsage.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > EMO_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count += 1;
  emoUsage.set(ip, entry);
  return entry.count > EMO_MAX_PER_WINDOW;
}

// Từ khoá tự-hại / tự tử tối thiểu, dùng làm lưới an toàn ĐỘC LẬP với model
// (không phụ thuộc hoàn toàn vào việc model có nhận ra hay không).
const EMO_CRISIS_PATTERNS = [
  /tự tử/i, /tự sát/i, /không muốn sống/i, /kết thúc cuộc đời/i,
  /suicide/i, /kill myself/i, /end my life/i, /don't want to live/i
];

function containsCrisisLanguage(text) {
  return EMO_CRISIS_PATTERNS.some(re => re.test(text || ""));
}

const EMOTION_SYSTEM_PROMPT = `
Bạn là "Mây", một trợ lý đồng hành cho bài tập "gọi tên cảm xúc" (affect labeling)
trên PsyMapVN — một công cụ phi lợi nhuận giúp người Việt tìm hỗ trợ sức khoẻ tâm thần.

Vai trò của bạn CHỈ LÀ:
1. Lắng nghe câu chuyện người dùng viết.
2. Đặt MỘT câu hỏi ngắn, ấm áp, không phán xét, giúp họ gọi tên cảm xúc cụ thể hơn
   (dựa trên nguyên tắc "emotion granularity" — ví dụ thay vì "buồn" thì có thể là
   "thất vọng", "cô đơn", "tủi thân", "bất lực"...). Nếu người dùng có vẻ bí từ,
   gợi ý 2-3 từ cảm xúc cụ thể để họ chọn hoặc điều chỉnh, KHÔNG áp đặt.
3. Không chẩn đoán, không đưa lời khuyên điều trị, không đóng vai chuyên gia trị liệu.
4. Giữ giọng điệu ngắn gọn (2-4 câu), đồng cảm, bằng cả tiếng Việt và tiếng Anh.

QUAN TRỌNG — an toàn:
Nếu nội dung người dùng cho thấy dấu hiệu nguy hiểm đến tính mạng (ý định tự tử,
tự hại nghiêm trọng), đặt "crisis": true, và trong reply chỉ nên thể hiện sự đồng cảm
và khuyến khích họ liên hệ hỗ trợ khẩn cấp — KHÔNG tiếp tục hỏi thêm về câu chuyện.

Luôn trả lời DUY NHẤT bằng JSON hợp lệ theo đúng schema sau, không kèm text khác:
{
  "reply_vi": "câu trả lời bằng tiếng Việt",
  "reply_en": "the same reply in English",
  "emotion_words": [{"vi": "từ cảm xúc tiếng Việt", "en": "matching English word"}],
  "crisis": false
}
`.trim();

app.post("/api/emotions/reflect", async (req, res) => {
  try {
    const ip = req.ip;
    if (isEmoRateLimited(ip)) {
      return res.status(429).json({ error: "Quá nhiều yêu cầu, vui lòng thử lại sau ít phút." });
    }

    const { history, message, round } = req.body || {};
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required." });
    }
    const trimmedMessage = message.trim().slice(0, 2000);

    if (containsCrisisLanguage(trimmedMessage)) {
      return res.json({
        crisis: true,
        reply_vi: "Mình nghe thấy là bạn đang rất khó khăn ngay lúc này. Bạn không cần một mình vượt qua điều này — hãy liên hệ số cấp cứu bên dưới.",
        reply_en: "It sounds like you're going through something really hard right now. You don't have to face this alone — please reach out to the numbers below.",
        emotion_words: []
      });
    }

    const messages = [{ role: "system", content: EMOTION_SYSTEM_PROMPT }];
    (Array.isArray(history) ? history : []).slice(-8).forEach(turn => {
      if (turn.role === "user" && typeof turn.text === "string") {
        messages.push({ role: "user", content: turn.text.slice(0, 2000) });
      } else if (turn.role === "assistant" && typeof turn.vi === "string") {
        messages.push({ role: "assistant", content: JSON.stringify({ reply_vi: turn.vi, reply_en: turn.en }) });
      }
    });
    messages.push({ role: "user", content: trimmedMessage });

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 400,
        response_format: { type: "json_object" }
      })
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI error:", openaiRes.status, errText);
      return res.status(502).json({ error: "AI service unavailable." });
    }

    const data = await openaiRes.json();
    let parsed;
    try {
      parsed = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      console.error("Failed to parse model JSON:", e);
      return res.status(502).json({ error: "Invalid AI response." });
    }

    res.json({
      reply_vi: parsed.reply_vi || "",
      reply_en: parsed.reply_en || "",
      emotion_words: Array.isArray(parsed.emotion_words) ? parsed.emotion_words.slice(0, 5) : [],
      crisis: !!parsed.crisis
    });

  } catch (error) {
    console.error("POST /api/emotions/reflect error:", error);
    res.status(500).json({ error: "Failed to process reflection." });
  }
});

app.get(
  "/api/clinics",
  async (req, res) => {

    try {

      const result = await pool.query(`
        SELECT *
        FROM clinics
        ORDER BY id ASC
      `);


      res.json(result.rows);


    } catch (error) {

      console.error("GET /api/clinics error:", error);


      res.status(500).json({
        error: "Failed to load clinics."
      });

    }

  }
);

app.get(
  "/api/articles",
  async (req, res) => {

    try {

      const result = await pool.query(`
        SELECT id, title, subtitle, cover_image_url, created_at
        FROM articles
        WHERE status = 'published'
        ORDER BY created_at DESC
      `);


      res.json(result.rows);


    } catch (error) {

      console.error("GET /api/articles error:", error);


      res.status(500).json({
        error: "Failed to load articles."
      });

    }

  }
);


app.get(
  "/api/articles/:id",
  async (req, res) => {

    try {

      const id = Number(req.params.id);


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error: "Invalid article ID."
        });

      }


      const result = await pool.query(
        `
          SELECT id, title, subtitle, cover_image_url, content, created_at
          FROM articles
          WHERE id = $1 AND status = 'published'
        `,
        [id]
      );


      const article = result.rows[0];


      if (!article) {

        return res.status(404).json({
          error: "Article not found."
        });

      }


      res.json(article);


    } catch (error) {

      console.error("GET public article error:", error);


      res.status(500).json({
        error: "Failed to load article."
      });

    }

  }
);
console.log("About to start server, PORT =", PORT);
app.listen(
  PORT,
  () => {
    console.log(
      `PsyHelpVN running at http://localhost:${PORT}`
    );
  }
);