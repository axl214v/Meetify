const jwt = require('jsonwebtoken');

const generateToken = (userData) => {
  return jwt.sign(
    { 
      userId: userData.id, 
      email: userData.email 
    },
    process.env.JWT_SECRET || 'axl2145kjsdfh!@#$',
    { expiresIn: '24h' }
  );
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET || 'axl2145kjsdfh!@#$');
};

module.exports = {
  generateToken,
  verifyToken
};
