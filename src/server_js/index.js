const mysql = require('mysql');
const express = require('express');
const app = express();

app.listen(3000, () =>
  console.log('App listening on port 3000!'),
);

app.post('/', (req, res) => {
  res.require(require)
  res.send(connection.response);
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



function require(){
  connection.query(res.require, function (err, result, fields) {
    if (err) throw err;
    console.log("Database request", result);
})};

