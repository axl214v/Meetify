const mysql = require('mysql');
const express = require('express');
const app = express();

app.use(express.json())    // <==== parse request body as JSON
app.listen(3000, () =>
  console.log('App listening on port 3000!'),
);

app.post('/', (req, res) => {
  res.json({requestBody: req.body}); // <==== req.body will be a parsed JSON object
})

app.post('/select', (req, res) => {
  res.json({request: request_select()}); 
})

app.post('/insert', (req, res) => {
  res.json({requestBody: request_insert()}); 
})

app.post('/update', (req, res) => {
  res.json({requestBody: request_udpate()}); 
})

app.get('/', (req, res) => {
  res.json({requestBody: req.body}); // <==== req.body will be a parsed JSON object
})

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


function request_select () {
  var sql_select = "SELECT * FROM users";
  connection.query(sql_select, function (err, result, fields) { 
    if (err) throw err;
    console.log("Request", result)

});
}

function request_insert () {
  var sql_insert = "INSERT INTO `users'(`name`, `email`, `password`, `ID`) VALUES ('[value-1]','[value-2]','[value-3]','[value-4]')";
  connection.query(sql_insert, function (err, result, fields) { 
    if (err) throw err;
    console.log("Database request", result);
    return result;
});
}

function request_update () {
  var sql_update = "UPDATE `users` SET `name`='[value-1]',`email`='[value-2]',`password`='[value-3]',`ID`='[value-4]' WHERE 1";
  connection.query(sql_update, function (err, result, fields) { 
    if (err) throw err;
    console.log("Database request", result);
  return result
});
}
