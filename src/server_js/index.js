const mysql = require('mysql');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const nodemailer = require('nodemailer');
const cookieParser = require('cookie-parser');
// Load neeeded libraries

const app = express(); // Create an Express application
const SECRET_KEY = "012001"; // Secret key for JWT

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.listen(3000, () => {
  console.log('App listening on port 3000!');
}); // Start the server on port 3000
app.use(cors({
  origin: 'http://localhost',
  credentials: true
})); // Enable CORS for requests from localhost

// Create a MySQL connection
let connection = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

connection.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('Connected to the MySQL server.');
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const token = req.cookies.token;

  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}


// User regisrtation app
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body; 
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing required fields' });

  connection.query('SELECT * FROM users WHERE email = ?', [email], async (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    if (users.length > 0) return res.status(400).json({ error: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'user')";
    connection.query(sql, [name, email, hashedPassword], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "User registered successfully", userId: result.insertId });
    });
  });
});

// User login app
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing required fields' });

  request_select(email)
    .then(async (user) => {
      if (!user || user.length === 0) return res.status(401).json({ error: 'User not found' });
      const match = await bcrypt.compare(password, user[0].password);
      if (!match) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign({ id: user[0].id, email: user[0].email, role: user[0].role }, SECRET_KEY, { expiresIn: '24h' });

      res.cookie('token', token, {
        httpOnly: true,
        secure: false, 
        sameSite: 'Lax',
        maxAge: 60 * 60 * 1000 
      }) ;

res.json({ message: 'Authorizated' });
});})

// Fetch user data based on role
app.get('/user', authenticateToken, (req, res) => {
  if (req.user.role === 'admin') {
    request_select_all()
      .then((result) => res.json({ request: result }))
      .catch((err) => res.status(500).json({ error: err.message }));
  } else {
    request_select(req.user.email)
      .then((result) => res.json({ request: result }))
      .catch((err) => res.status(500).json({ error: err.message }));
  }
  console.log('Authenticated user:', req.user);
});

// Check authentication status
app.get('/check-auth', authenticateToken, (req, res) => {
  res.json({ authenticated: true, user: req.user });
});

// User logout app
app.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

// Function to get user by email from mysql
function request_select(email) {
  return new Promise((resolve, reject) => {
    const sql = "SELECT id, name, email, role, password FROM users WHERE email = ?";
    connection.query(sql, [email], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

// Function to get all users from mysql
function request_select_all() {
  return new Promise((resolve, reject) => {
    const sql = "SELECT id, name, email, role FROM users";
    connection.query(sql, [], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

// Function to insert a new user into mysql
function request_insert(name, email, password, role = 'user') {
  return new Promise((resolve, reject) => {
    const sql_insert = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)";
    const params = [name, email, password, role];
    connection.query(sql_insert, params, (err, result) => { 
      if (err) return reject(err);
      resolve(result);
    });
  });
}

// Function to join a conferention(in progress)
function join_conferention(id) {

}

// Password reset functionality(not working email part)
app.post('/reset-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });

  request_select(email).then(user => {
    if (!user || user.length === 0) return res.status(404).json({ error: 'User not found' });

    const resetToken = jwt.sign({ email }, SECRET_KEY, { expiresIn: '15m' }); 
    const resetLink = `http://localhost/reset-password?token=${resetToken}`;
    console.log(`Reset link: ${resetLink}`);

    res.json({ message: 'Reset link sent to email' });
  }).catch(err => res.status(500).json({ error: err.message }));
});

// New password setting app
app.post('/new-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Missing token or new password' });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    request_update_password(decoded.email, hashedPassword)
      .then(() => res.json({ message: 'Password updated' }))
      .catch(err => res.status(500).json({ error: err.message }));
  } catch (err) {
    res.status(400).json({ error: 'Invalid or expired token' });
  }
});

// Function to update user password in mysql
function request_update_password(email, password) {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE users SET password = ? WHERE email = ?";
    connection.query(sql, [password, email], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

// Admin route to get all users
app.get('/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  request_select_all()
    .then((users) => res.json({ users }))
    .catch((err) => res.status(500).json({ error: err.message }));
});

// User login app
app.post('/joinconf', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing required fields' });

  join_conferention();

res.json({ message: 'Authorizated' });
});