<?php
  define("ROOT_LOCATION", "xampp\htdocs\Meetify");
  $directory = ROOT_LOCATION;

  
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
  <title>Meetify - Регистрация</title>
  <link rel="stylesheet" href="auth_reg.css">
  <link rel="icon" href="logo.png">
  <h1>Регистрация</h1>
  <h2>Форма Регистрации</h2>
</head>
<body>
  <footer>
    <p>Имя:</p>
    <input id="name" required>
    <p>Почта:</p>
    <input id="email" required>
    <p>Пароль:</p>
    <input id="password" required>
    <button id="submit">Зарегестрироваться</button>
  </footer>
  <div id = "auth">
    <a>Уже зарегестрированы?</a>
    <button id = "authb">Авторизуйтесь!</button>
  </div>
  <script src = auth_reg.js></script>
</body>
</html>