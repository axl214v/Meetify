<?php
  define("ROOT_LOCATION", "xampp\htdocs\Meetify");
  $directory = ROOT_LOCATION;

  $server = mysqli_connect('localhost', 'root', '', 'meetify');
  if ($server = false){
    echo("Подключение к серверу не удалось.");
  }
  
  class User{ 
    public $name, $email, $password;
  
    function save_user(){    
       $saveusr = "INSERT INTO `users` (`name`, `email`, `password`, `ID`) VALUES ('$name', '$email', '$password', NULL)";
       $result = mysqli_query($server, $saveusr);
       if ($result = false){
          echo ("Извините, что-то пошло не так.");
          echo ("Попробуйте еще раз или напишите нам в поддержку!");
       }
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
  <form action='Reg.php' method = 'post'>
    <p>Имя:</p>
    <input placeholder='Иван' id="name" required >
    <p>Почта:</p>
    <input placeholder='example@email.com' id="email" required>
    <p>Пароль:</p>
    <input id="password" required>
    <button id="submit">Зарегестрироваться</button>
  </form>
  <div id = "auth">
    <a>Уже зарегестрированы?</a>
    <button id = "authb"><a href = 'Auth.php'>Авторизуйтесь!</a></button>
  </div>
  <script src = auth_reg.js></script>
</body>
</html>