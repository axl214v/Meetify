<?php
  define("ROOT_LOCATION", "xampp\htdocs\Meetify");
  $directory = ROOT_LOCATION;
  
  $object = new User;
  
  
  class User{ 
    public $name, $email, $password;
  
    function save_user(){  // функция сохранения пользователя  
 
    }
  }

?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Meetify - Registration</title>
  <link rel="stylesheet" href="reg.css">
  <link rel="icon" href="logo.png">
  <h1>Register</h1>
  <h2>Registration form</h2>
</head>
<body>
  <footer>
    <p>Name:</p>
    <input id="name" required>
    <p>Email:</p>
    <input id="email" required>
    <p>Password:</p>
    <input id="password" required>
    <input id="submit">
  </footer>
  <script src = auth.js></script>
</body>
</html>