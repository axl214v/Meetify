<?php
  define("ROOT_LOCATION", "xampp\htdocs\Meetify");
  $directory = ROOT_LOCATION;
  
  $server = mysqli_connect('localhost', 'root', '', 'meetify');
  if ($server = false){
    echo("Подключение к серверу не удалось.");
  }

  if(array_key_exists('submit',$_POST)){
    $current_user = new User($server);
    $current_user -> reset_user($email);
 }

  class User{ 
    public $name, $email, $password;
    
    function reset_user(){    
      $server = mysqli_connect('localhost', 'root', '', 'meetify');
      $name = $_POST["name"];
      $email = $_POST["email"];
      $CheckUser = ("SELECT email FROM users").
      ("WHERE email = "$email"");
      $result = mysqli_query($server, $CheckUser);
      if ($CheckEmail, $CheckPassword = false){
        echo ("Извините, что-то пошло не так.");
        echo ("Попробуйте еще раз или напишите нам в поддержку!");
      elseif ($email != $CheckUser){
        echo("Неправильная почта.");
      }
      return echo("Выслали вам на почту код подтверждения");
    }
    
  }
  }

?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Meetify - Сброс пароля</title>
  <link rel="stylesheet" href="auth_reg.css">
  <link rel="icon" href="./asseets/logo.png">
  <h1>Сброс пароля</h1>
  <h2>Форма</h2>
</head>
<body>
  <footer>
    <p>Имя:</p>
    <input maxleght="36" name="name" required>
    <p>Почта:</p>
    <input maxleght="36" name="email" required>
    <button id="submit">Сбросить пароль</button>
  </footer>
  <div id = "auth">
    <a>Вспомнили пароль?</a>
    <button id = "authb"><a href = 'Auth.php'>Авторизуйтесь!</a></button>
  </div>
  <script src = auth_reg.js></script>
  <noscript>Извините, ваш браузер не поддерживает JavaScript.</noscript>
</body>
</html>