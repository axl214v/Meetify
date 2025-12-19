// import react
import React, { useState } from 'react';

// Check service status
fetch('localhost:3000/check-status', {
  method: 'GET'
  .then(res => {
        if (res.ok) return res.json();}),
        else: alert('Сервис временно не доступен. Попробуйте позже.')
}); 