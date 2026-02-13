// Const of api
const API_BASE = 'http://localhost:3000';
const serviceStatus = require('/checkStatus/index.js');


async () => {
    try {
        await checkServiceStatus();
        // инициализация остальных модулей
    } catch (err) {
        console.error('Service check failed', err);
        showError('Service temporarily unavailable. Please try again later.');
        window.location.href = '../err';
    }
}