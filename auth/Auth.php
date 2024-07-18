<?php
  define("ROOT_LOCATION", "xampp\htdocs\Meetify");
  $directory = ROOT_LOCATION;
  
  

  
  class User{ 
    public $name, $email, $password;
  
    function check_user(){  // функция сохранения пользователя  
 
    }
  }

?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Meetify - Авторизация</title>
  <link rel="stylesheet" href="auth_reg.css">
  <link rel="icon" href="logo.png">
  <h1>Авторизация</h1>
  <h2>Форма Авторизации</h2>
</head>
<body>
  <footer>
    <p>Почта:</p>
    <input id="email" required>
    <p>Пароль:</p>
    <input id="password" required>
    <button id="submit">Авторизироваться</button>
  </footer>
  <div>
    <button id = "reg">Зарегестрироваться</button>
  </div>
  <script src = auth_reg.js></script>
</body>
</html>