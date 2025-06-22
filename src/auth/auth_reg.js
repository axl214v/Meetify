
fetch("http://localhost:3000/login", {
  method: "POST",
  body: JSON.stringify({
    email: "axl214v@gmail.com",
    password: ""
  }),
  headers: {
    "Content-type": "application/json; charset=UTF-8"
  }
})
  .then((response) => response.json())
  .then((json) => console.log(json));