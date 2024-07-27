<?php
  define("ROOT_LOCATION", "xampp\htdocs\Meetify");
  $directory = ROOT_LOCATION;
  
  $server = mysqli_connect('localhost', 'root', '', 'meetify');
  if ($server = false){
    echo("Подключение к серверу не удалось.");
  }

  if(array_key_exists('subm',$_POST)){
    $current_user = new User($server);
    $current_user -> save_user();
 }

  class User{ 
    public $name, $email, $password;
    
    function reset_user(){    
      function mysql_fix_string($server, $string){
        if (get_magic_quotes_gpc()) $string = stripcslashes($string);
        return $server->mysqli_qury($string);
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