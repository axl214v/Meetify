<?php
  define("ROOT_LOCATION", "xampp\htdocs\Meetify");
  $directory = ROOT_LOCATION;
  
  $server = mysqli_connect('localhost', 'root', '', 'meetify');
  if ($server = false){
    echo("Подключение к серверу не удалось.");
  }

  if(array_key_exists('subm',$_POST)){
    $current_user = new User($server);
    $current_user -> check_user();
 }
  
  class User{ 
    public $name, $email, $password;

    function check_user(){  // функция сохранения пользователя  
      $email = mysql_fix_string($_POST["email"]);
      function mysql_fix_string($server, $string){
        if (get_magic_quotes_gpc()) $string = stripcslashes($string);
        return $server->mysqli_qury($string);
      }
      $password = mysql_fix_string($_POST["password"]);
      $checkeml =  ("END SELECT email FROM users").
      ("WHERE email = "$email"");
      $checkpass = ( "SELECT password FROM users
      WHERE password = "$password"");
       $CheckEmail = mysqli_query($checkeml);
       $CheckPassword = mysqli_query($checkpass);
       if ($CheckEmail, $CheckPassword = false){
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
  <title>Meetify - Авторизация</title>
  <link rel="stylesheet" href="auth_reg.css">
  <link rel="icon" href="logo.png">
  <h1>Авторизация</h1>
  <h2>Форма Авторизации</h2>
</head>
<body>
  <footer>
    <p>Почта:</p>
    <input name="email" required>
    <p>Пароль:</p>
    <input name="password" required>
    <button name="submit">Авторизироваться</button>
  </footer>
  <div id = "auth">
    <a>Не зарегестрованны?</a>
    <button id = "authb"><a href = 'Reg.php'>Зарегестрируйтесь!</a></button>
  </div>
  <div>
    <a>Забыли пароль?</a>
    <button id = "reset"><a href = 'resetpass.php'>Сбросьте его!</a></button>
  </div>
  <script src = auth_reg.js></script>
</body>
</html>