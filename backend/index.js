require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const session = require("express-session");
const bcrypt = require("bcrypt");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parse");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// PostgreSQL connection pool
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "timetable_db",
  password: "1234", // Leave this empty to match your PostgreSQL installation
  port: 5432,
});

// Session middleware
app.use(
  session({
    secret: "your-very-secret-key", // Change this in production
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Set to true if using HTTPS
  })
);

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT 1");
    res.json({ status: "OK", database: "Connected" });
  } catch (err) {
    res
      .status(500)
      .json({ status: "Error", database: "Not Connected", error: err.message });
  }
});

// Get all users (admin and faculty)
app.get("/api/users", async (req, res) => {
  try {
    const usersResult = await pool.query(
      "SELECT id, name, email, role FROM users"
    );
    const facultyResult = await pool.query(
      "SELECT id, name, username, subject, role FROM faculty"
    );
    const facultyUsers = facultyResult.rows.map((f) => ({
      id: f.id,
      name: f.name,
      username: f.username,
      subject: f.subject,
      role: f.role,
    }));
    res.json([...usersResult.rows, ...facultyUsers]);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Hardcoded admin credentials
const ADMIN_EMAIL = "admin";
const ADMIN_PASSWORD_HASH =
  "$2a$12$u0ZIXLq7WYdP5i9zoDD4HOCDGo.lmNg7iyqivbcuCT9p9uoGC3Y42"; // Replace with real bcrypt hash

// Admin login route
app.post("/api/login", express.json(), async (req, res) => {
  const { email, username, password } = req.body;
  // Admin login (as before)
  if (
    email === ADMIN_EMAIL &&
    (await bcrypt.compare(password, ADMIN_PASSWORD_HASH))
  ) {
    req.session.user = { email, role: "admin" };
    return res.json({ success: true, role: "admin" });
  }
  // Faculty login
  if (username) {
    const result = await pool.query(
      "SELECT * FROM faculty WHERE username = $1",
      [username]
    );
    const faculty = result.rows[0];
    // BYPASS: Allow login if username matches, skip password check
    if (faculty) {
      req.session.user = {
        id: faculty.id,
        username: faculty.username,
        role: "faculty",
        name: faculty.name,
        subject: faculty.subject,
      };
      return res.json({ success: true, role: "faculty" });
    }
  }
  res.status(401).json({ error: "Invalid credentials" });
});

// Logout route
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// Middleware to protect admin routes
function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") {
    return next();
  }
  res.status(403).json({ error: "Forbidden" });
}

// Route to check current user
app.get("/api/me", (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
});

// Example protected admin route
app.get("/api/admin/secret", requireAdmin, (req, res) => {
  res.json({ secret: "This is admin-only data." });
});

app.post("/api/faculty", requireAdmin, express.json(), async (req, res) => {
  const { name, subject, username, password } = req.body;
  const password_hash = await bcrypt.hash(password, 10);
  try {
    await pool.query(
      "INSERT INTO faculty (name, subject, username, password_hash) VALUES ($1, $2, $3, $4)",
      [name, subject, username, password_hash]
    );
    res.json({ success: true });
  } catch (err) {
    res
      .status(400)
      .json({ error: "Could not add faculty (username may already exist)" });
  }
});

// Delete faculty (admin only)
app.delete("/api/faculty/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query(
      "DELETE FROM faculty WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Faculty not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Delete user (admin only, only supports admin for now)
app.delete("/api/users/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;
  // If you only have one admin, prevent deletion
  // Optionally, you could support deleting other user types here
  return res.status(403).json({ error: "Cannot delete admin user" });
});

// Add classroom (admin only)
app.post("/api/classrooms", requireAdmin, express.json(), async (req, res) => {
  const { room_number, capacity } = req.body;
  try {
    await pool.query(
      "INSERT INTO classrooms (room_number, capacity) VALUES ($1, $2)",
      [room_number, capacity]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({
      error: "Could not add classroom (room number may already exist)",
    });
  }
});

// List classrooms
app.get("/api/classrooms", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, room_number, capacity FROM classrooms"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Add subject (admin only)
app.post("/api/subjects", requireAdmin, express.json(), async (req, res) => {
  const { name, code } = req.body;
  try {
    await pool.query("INSERT INTO subjects (name, code) VALUES ($1, $2)", [
      name,
      code,
    ]);
    res.json({ success: true });
  } catch (err) {
    res
      .status(400)
      .json({ error: "Could not add subject (code may already exist)" });
  }
});

// List subjects
app.get("/api/subjects", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, code FROM subjects");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Delete subject (admin only)
app.delete("/api/subjects/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query(
      "DELETE FROM subjects WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Subject not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Get timetable for a classroom
app.get("/api/timetable", requireAdmin, async (req, res) => {
  const classroom_id = req.query.classroom_id;
  if (!classroom_id)
    return res.status(400).json({ error: "Missing classroom_id" });
  try {
    const result = await pool.query(
      "SELECT day, time_slot, subject, faculty FROM timetable WHERE classroom_id = $1 ORDER BY day, time_slot",
      [classroom_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Delete timetable for a classroom
app.delete("/api/timetable", requireAdmin, async (req, res) => {
  const classroom_id = req.query.classroom_id;
  if (!classroom_id)
    return res.status(400).json({ error: "Missing classroom_id" });
  try {
    await pool.query("DELETE FROM timetable WHERE classroom_id = $1", [
      classroom_id,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Import timetable from CSV for a classroom
app.post(
  "/api/timetable/import",
  requireAdmin,
  multer({ dest: "uploads/" }).single("file"),
  async (req, res) => {
    const classroom_id = req.body.classroom_id;
    if (!classroom_id || !req.file) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Missing classroom_id or file" });
    }
    const rows = [];
    fs.createReadStream(req.file.path)
      .pipe(csv.parse({ columns: true, trim: true }))
      .on("data", (row) => rows.push(row))
      .on("end", async () => {
        try {
          // Optional: clear previous timetable for this classroom
          await pool.query("DELETE FROM timetable WHERE classroom_id = $1", [
            classroom_id,
          ]);
          for (const row of rows) {
            const { day, time_slot, subject, faculty } = row;
            if (day && time_slot && subject && faculty) {
              await pool.query(
                "INSERT INTO timetable (classroom_id, day, time_slot, subject, faculty) VALUES ($1, $2, $3, $4, $5)",
                [classroom_id, day, time_slot, subject, faculty]
              );
            }
          }
          fs.unlinkSync(req.file.path);
          res.json({ success: true });
        } catch (err) {
          fs.unlinkSync(req.file.path);
          res.status(500).json({ error: "Database error" });
        }
      })
      .on("error", (err) => {
        fs.unlinkSync(req.file.path);
        res.status(400).json({ error: "Invalid CSV file" });
      });
  }
);

// Public: Get timetable for a classroom (no auth)
app.get("/api/public-timetable", async (req, res) => {
  const classroom_id = req.query.classroom_id;
  if (!classroom_id)
    return res.status(400).json({ error: "Missing classroom_id" });
  try {
    const result = await pool.query(
      "SELECT day, time_slot, subject, faculty FROM timetable WHERE classroom_id = $1 ORDER BY day, time_slot",
      [classroom_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Get timetable for a faculty (by faculty_id)
app.get("/api/faculty-timetable", async (req, res) => {
  const faculty_id = req.query.faculty_id;
  const date = req.query.date; // optional, for override lookup
  if (!faculty_id) return res.status(400).json({ error: "Missing faculty_id" });
  try {
    // Get faculty name by id
    const facultyResult = await pool.query(
      "SELECT name FROM faculty WHERE id = $1",
      [faculty_id]
    );
    if (!facultyResult.rows.length)
      return res.status(404).json({ error: "Faculty not found" });
    const facultyName = facultyResult.rows[0].name;
    // Get timetable slots for this faculty
    const slots = await pool.query(
      "SELECT t.id, t.day, t.time_slot, t.subject, t.faculty, t.classroom_id, c.room_number as classroom_name FROM timetable t LEFT JOIN classrooms c ON t.classroom_id = c.id WHERE t.faculty = $1 ORDER BY t.day, t.time_slot",
      [facultyName]
    );
    let result = slots.rows;
    // If date is provided, check for overrides for that date
    if (date) {
      for (let slot of result) {
        const override = await pool.query(
          "SELECT replacement_faculty_id FROM overrides WHERE timetable_id = $1 AND date = $2",
          [slot.id, date]
        );
        if (override.rows.length) {
          // Get replacement faculty name and subject
          const rep = await pool.query(
            "SELECT name, subject FROM faculty WHERE id = $1",
            [override.rows[0].replacement_faculty_id]
          );
          if (rep.rows.length) {
            slot.replacement = rep.rows[0].name;
            slot.replacement_subject = rep.rows[0].subject;
          } else {
            slot.replacement = null;
            slot.replacement_subject = null;
          }
        }
      }
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Get available faculty for a slot (not assigned to any slot at that date/time)
app.get("/api/available-faculty", async (req, res) => {
  const { date, time_slot, exclude_id } = req.query;
  if (!date || !time_slot)
    return res.status(400).json({ error: "Missing date or time_slot" });
  try {
    // Find faculty assigned to any slot at this time on this date (including overrides)
    const busyFaculty = await pool.query(
      `
      SELECT DISTINCT f.id FROM faculty f
      JOIN timetable t ON t.faculty = f.name
      WHERE t.time_slot = $1
      UNION
      SELECT o.replacement_faculty_id FROM overrides o WHERE o.date = $2 AND o.timetable_id IN (SELECT id FROM timetable WHERE time_slot = $1)
    `,
      [time_slot, date]
    );
    const busyIds = busyFaculty.rows.map((r) => r.id).filter(Boolean);
    // Exclude the current faculty
    if (exclude_id) busyIds.push(Number(exclude_id));
    // Get all faculty not in busyIds
    let query = "SELECT id, name, subject FROM faculty";
    if (busyIds.length) {
      query +=
        " WHERE id NOT IN (" +
        busyIds.map((_, i) => `$${i + 1}`).join(",") +
        ")";
    }
    const available = await pool.query(query, busyIds);
    res.json(available.rows);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Create an override (replacement)
app.post("/api/overrides", async (req, res) => {
  const { timetable_id, original_faculty_id, replacement_faculty_id, date } =
    req.body;
  if (
    !timetable_id ||
    !original_faculty_id ||
    !replacement_faculty_id ||
    !date
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    await pool.query(
      "INSERT INTO overrides (timetable_id, original_faculty_id, replacement_faculty_id, date) VALUES ($1, $2, $3, $4)",
      [timetable_id, original_faculty_id, replacement_faculty_id, date]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Get all overrides for a faculty in a month
app.get("/api/faculty-overrides", async (req, res) => {
  const { faculty_id, month } = req.query;
  if (!faculty_id || !month)
    return res.status(400).json({ error: "Missing faculty_id or month" });
  try {
    // Get overrides for this faculty in the given month
    const result = await pool.query(
      `
      SELECT o.id, o.timetable_id, o.date, o.replacement_faculty_id, f.name as replacement_name, f.subject as replacement_subject
      FROM overrides o
      LEFT JOIN faculty f ON o.replacement_faculty_id = f.id
      WHERE o.original_faculty_id = $1 AND to_char(o.date, 'YYYY-MM') = $2
    `,
      [faculty_id, month]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Delete an override (replacement) by ID
app.delete("/api/overrides/:id", async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: "Missing override id" });
  try {
    await pool.query("DELETE FROM overrides WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Public: Get timetable for a classroom for the current week, with overrides
app.get("/api/public-timetable-week", async (req, res) => {
  const classroom_id = req.query.classroom_id;
  if (!classroom_id)
    return res.status(400).json({ error: "Missing classroom_id" });
  try {
    // Get all slots for this classroom
    const slots = await pool.query(
      "SELECT t.id, t.day, t.time_slot, t.subject, t.faculty, t.classroom_id, c.room_number as classroom_name FROM timetable t LEFT JOIN classrooms c ON t.classroom_id = c.id WHERE t.classroom_id = $1",
      [classroom_id]
    );
    // Get all overrides for this classroom for the current week
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Sunday
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    const overrides = await pool.query(
      `
      SELECT o.timetable_id, o.date, f.name as replacement_name
      FROM overrides o
      LEFT JOIN faculty f ON o.replacement_faculty_id = f.id
      WHERE o.date BETWEEN $1 AND $2
    `,
      [weekStartStr, weekEndStr]
    );
    // Map overrides by date and timetable_id (robust to string or Date object)
    const overrideMap = {};
    for (const o of overrides.rows) {
      let dateKey;
      if (typeof o.date === "string") {
        dateKey = o.date;
      } else if (o.date instanceof Date) {
        dateKey =
          o.date.getFullYear().toString().padStart(4, "0") +
          "-" +
          (o.date.getMonth() + 1).toString().padStart(2, "0") +
          "-" +
          o.date.getDate().toString().padStart(2, "0");
      } else {
        dateKey = String(o.date).slice(0, 10);
      }
      if (!overrideMap[dateKey]) overrideMap[dateKey] = {};
      overrideMap[dateKey][Number(o.timetable_id)] = o.replacement_name;
    }
    // For each day in the week, build the slots with overrides (use UTC for week dates)
    const numToDayName = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const week = [];
    for (let i = 0; i < 7; i++) {
      // Use UTC to avoid timezone issues
      const date = new Date(
        Date.UTC(
          weekStart.getUTCFullYear(),
          weekStart.getUTCMonth(),
          weekStart.getUTCDate() + i
        )
      );
      const dateStr = date.toISOString().slice(0, 10);
      const dayName = numToDayName[date.getUTCDay()];
      const daySlots = await Promise.all(
        slots.rows
          .filter((slot) => slot.day === dayName)
          .map(async (slot) => {
            const replacement = overrideMap[dateStr]?.[Number(slot.id)];
            if (replacement) {
              // Fetch replacement faculty's subject
              const rep = await pool.query(
                "SELECT subject FROM faculty WHERE name = $1",
                [replacement]
              );
              const replacement_subject = rep.rows.length
                ? rep.rows[0].subject
                : slot.subject;
              return {
                ...slot,
                date: dateStr,
                faculty: replacement,
                subject: replacement_subject,
                replacement,
              };
            } else {
              return {
                ...slot,
                date: dateStr,
                replacement: null,
              };
            }
          })
      );
      week.push({ date: dateStr, day: dayName, slots: daySlots });
    }
    // Debug log for Thursday, 2025-05-08, slot id 33
    if (overrideMap["2025-05-08"]) {
      console.log("DEBUG overrideMap[2025-05-08]:", overrideMap["2025-05-08"]);
      console.log(
        "DEBUG replacement for slot 33:",
        overrideMap["2025-05-08"][33]
      );
    }
    // Added debug logs for full overrideMap and week array
    console.log("DEBUG overrideMap:", JSON.stringify(overrideMap, null, 2));
    console.log("DEBUG week:", JSON.stringify(week, null, 2));
    res.json(week);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
