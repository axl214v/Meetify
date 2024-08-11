<?php
  define("ROOT_LOCATION", "xampp\htdocs\Meetify");
  $directory = ROOT_LOCATION;

  $server = mysqli_connect('localhost', 'root', '', 'meetify');
  if ($server = false){
    echo("Подключение к серверу не удалось.");
  }

  
  
  if(array_key_exists('subm',$_POST)){
    $current_user = new User($server);
    $current_user -> save_user($name,$email,$password);
 }
  
  
  class User{ 
    public $name, $email, $password;
    
    public function save_user(){    
      $server = mysqli_connect('localhost', 'root', '', 'meetify');
      $name = $_POST["name"];
      $email = $_POST["email"];
      $password = $_POST["password"]; 
      $saveusr = "INSERT INTO `users` (`name`, `email`, `password`, `ID`) VALUES ('$name', '$email', '$password', NULL)";
       $result = mysqli_query($server, $saveusr);
       if ($result = false){
          echo ("Извините, что-то пошло не так.");
          echo ("Попробуйте еще раз или напишите нам в поддержку!");
        $new_url = 'https://localhost/meetify/conf/conf.php';
        return header('Location: '.$new_url);
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
    <input maxleght="36" placeholder='Иван' name="name" required = 'Пожалуйста заполните это поле.'>
    <p>Почта:</p>
    <input maxleght="36" placeholder='example@email.com' name="email" required>
    <p>Пароль:</p>
    <input maxleght="36" name="password" required>
    <button name = "subm" name="submit">Зарегестрироваться</button>
  </form>
  <div id = "auth">
    <a>Уже зарегестрированы?</a>
    <button id = "authb"><a href = 'Auth.php'>Авторизуйтесь!</a></button>
  </div>
  <script src = auth_reg.js></script>
  <noscript>Извините, ваш браузер не поддерживает JavaScript.</noscript>
</body>
</html>