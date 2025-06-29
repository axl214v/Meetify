fetch('localhost/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Hubot',
    login: 'hubot',
  })
})
  .then((response) => response.json())
  .then((json) => console.log(json));