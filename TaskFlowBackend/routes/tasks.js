const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

const VALID_PRIORITIES = ["High", "Medium", "Low"];
const VALID_STATUSES = ["Pending", "In Progress", "Completed"];

function serializeTask(row) {
  return {
    id: String(row.id),
    name: row.name,
    date: row.date ? row.date.toISOString().split("T")[0] : null,
    priority: row.priority,
    status: row.status,
  };
}

// GET /api/tasks - list all tasks for the logged-in user
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM tasks WHERE user_id = $1 ORDER BY date NULLS LAST, created_at",
      [req.userId]
    );
    res.json(result.rows.map(serializeTask));
  } catch (err) {
    console.error("List tasks error:", err);
    res.status(500).json({ error: "Could not load tasks." });
  }
});

// POST /api/tasks - create a task
router.post("/", async (req, res) => {
  try {
    const { name, date, priority, status } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Task name is required." });
    }

    const finalPriority = VALID_PRIORITIES.includes(priority) ? priority : "Medium";
    const finalStatus = VALID_STATUSES.includes(status) ? status : "Pending";

    const result = await pool.query(
      `INSERT INTO tasks (user_id, name, date, priority, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.userId, name.trim(), date || null, finalPriority, finalStatus]
    );

    res.status(201).json(serializeTask(result.rows[0]));
  } catch (err) {
    console.error("Create task error:", err);
    res.status(500).json({ error: "Could not create task." });
  }
});

// PUT /api/tasks/:id - update a task (e.g. status change)
router.put("/:id", async (req, res) => {
  try {
    const { name, date, priority, status } = req.body || {};

    const existing = await pool.query(
      "SELECT * FROM tasks WHERE id = $1 AND user_id = $2",
      [req.params.id, req.userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Task not found." });
    }

    const current = existing.rows[0];
    const finalName = name !== undefined ? name.trim() : current.name;
    const finalDate = date !== undefined ? date : current.date;
    const finalPriority = VALID_PRIORITIES.includes(priority) ? priority : current.priority;
    const finalStatus = VALID_STATUSES.includes(status) ? status : current.status;

    const result = await pool.query(
      `UPDATE tasks SET name = $1, date = $2, priority = $3, status = $4
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [finalName, finalDate, finalPriority, finalStatus, req.params.id, req.userId]
    );

    res.json(serializeTask(result.rows[0]));
  } catch (err) {
    console.error("Update task error:", err);
    res.status(500).json({ error: "Could not update task." });
  }
});

// DELETE /api/tasks/:id
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found." });
    }
    res.status(204).send();
  } catch (err) {
    console.error("Delete task error:", err);
    res.status(500).json({ error: "Could not delete task." });
  }
});

module.exports = router;
