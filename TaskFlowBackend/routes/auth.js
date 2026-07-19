const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { pool } = require("../db");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Please provide a valid email." });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [normalizedEmail, passwordHash]
    );

    const user = result.rows[0];
    const token = signToken(user.id);

    res.status(201).json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Something went wrong creating your account." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      "SELECT id, email, password_hash FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = signToken(user.id);
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Something went wrong logging you in." });
  }
});

// Sign in / sign up with a Google ID token from the frontend's
// Google Identity Services button.
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body || {};

    if (!credential) {
      return res.status(400).json({ error: "Missing Google credential." });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: "Google Sign-In is not configured on the server." });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return res.status(401).json({ error: "Could not verify Google account." });
    }

    const normalizedEmail = payload.email.trim().toLowerCase();
    const googleId = payload.sub;

    // Look up by google_id first, then fall back to email (so an existing
    // password account with the same email gets linked instead of duplicated).
    let result = await pool.query("SELECT id, email FROM users WHERE google_id = $1", [googleId]);

    if (result.rows.length === 0) {
      result = await pool.query("SELECT id, email FROM users WHERE email = $1", [normalizedEmail]);

      if (result.rows.length > 0) {
        await pool.query("UPDATE users SET google_id = $1 WHERE id = $2", [googleId, result.rows[0].id]);
      } else {
        result = await pool.query(
          "INSERT INTO users (email, google_id) VALUES ($1, $2) RETURNING id, email",
          [normalizedEmail, googleId]
        );
      }
    }

    const user = result.rows[0];
    const token = signToken(user.id);

    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(401).json({ error: "Google sign-in failed. Please try again." });
  }
});

module.exports = router;
