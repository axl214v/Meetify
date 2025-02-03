const mysql = require('mysql');
const express = require('express');
const app = express();

app.use(express.json());

app.listen(3000, () => {
  console.log('App listening on port 3000!');
});

let connection = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

connection.connect((err) => {
  if (err) return console.error(err.message);
  console.log('Connected to the MySQL server.');
});


app.post('/select', (req, res) => {
  const { id , email, password, name } = req.body; 
  request_select(id , email , password, name)
    .then(result => res.json({ request: result }))
    .catch(err => res.status(500).json({ error: err.message }));
});


app.post('/insert', (req, res) => {
  const { name, email, password } = req.body; 
  request_insert(name, email, password)
    .then(result => res.json({ request: result }))
    .catch(err => res.status(500).json({ error: err.message }));
});


app.post('/update', (req, res) => {
  const { id, name, email, password } = req.body; 
  request_update(id, name, email, password)
    .then(result => res.json({ request: result }))
    .catch(err => res.status(500).json({ error: err.message }));
});


function request_select(id , email, password, name) {
  return new Promise((resolve, reject) => {
    let sql_select = "SELECT * FROM users";
    const params = [];

    if (id) {
      sql_select += " WHERE ID = ?";
      params.push(id);
    }

    if (email) {
      sql_select += " WHERE email = ?";
      params.push(email);
    }

    if (password) {
      sql_select += " WHERE password = ?";
      params.push(password);
    }

    if (name) {
      sql_select += " WHERE name = ?";
      params.push(name);
    }

    connection.query(sql_select, params, (err, result) => { 
      if (err) return reject(err);
      console.log("Request", result);
      resolve(result);
    });
  });
}


function request_insert(name, email, password) {
  return new Promise((resolve, reject) => {
    const sql_insert = "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";
    const params = [name, email, password];

    connection.query(sql_insert, params, (err, result) => { 
      if (err) return reject(err);
      console.log("Database request", result);
      resolve(result);
    });
  });
}


function request_update(id, name, email, password) {
  return new Promise((resolve, reject) => {
    const sql_update = "UPDATE users SET name = ?, email = ?, password = ? WHERE ID = ?";
    const params = [name, email, password, id];

    connection.query(sql_update, params, (err, result) => { 
      if (err) return reject(err);
      console.log("Database request", result);
      resolve(result);
    });
  });
}