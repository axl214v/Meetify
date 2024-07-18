<?php
  define("ROOT_LOCATION", "xampp\htdocs\Meetify");
  $directory = ROOT_LOCATION;
  
  

  
  class User{ 
    public $name, $email, $password;
  
    function reset_user(){    
 
    }
  }

?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Meetify - Сброс пароля</title>
  <link rel="stylesheet" href="auth_reg.css">
  <link rel="icon" href="logo.png">
  <h1>Сброс пароля</h1>
  <h2>Форма</h2>
</head>
<body>
  <footer>
    <p>Имя:</p>
    <input id="name" required>
    <p>Почта:</p>
    <input id="email" required>
    <p>Пароль:</p>
    <input id="password" required>
    <button id="submit">Сбросить пароль</button>
  </footer>
  <div id = "auth">
    <a>Вспомнили пароль?</a>
    <button id = "authb"><a href = 'Auth.php'>Авторизуйтесь!</a></button>
  </div>
  <script src = auth_reg.js></script>
</body>
</html>