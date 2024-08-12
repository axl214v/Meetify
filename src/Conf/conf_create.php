<?php
    define("ROOT_LOCATION", "xampp\htdocs\Meetify");
    $directory = ROOT_LOCATION;
    
    $server = mysqli_connect('localhost', 'root', '', 'meetify');
    if ($server = false){
      echo("Подключение к серверу не удалось.");
    }
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="conf.css">
    <title>Meetify</title>
    <h1>Создайте конференцию</h1>
</head>
<body>
    <button id=createconf>Создать конференцию</button>
    <script src="conf.js"></script>
    <noscript>Извините, ваш браузер не поддерживает JavaScript.</noscript>
</body>
</html>