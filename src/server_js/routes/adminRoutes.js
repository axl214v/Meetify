const express   = require('express');
const router    = express.Router();
const auth      = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const c         = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);
router.use(adminAuth);

router.get   ('/stats',                         c.getStats);
router.get   ('/server',                        c.getServerStats);
router.get   ('/users',                         c.getUsers);
router.delete('/users/:id',                     c.deleteUser);
router.patch ('/users/:id/role',                c.updateUserRole);
router.get   ('/conferences',                   c.getConferences);
router.delete('/conferences/:id',               c.deleteConference);
router.post  ('/conferences/:id/kick/:userId',  c.kickParticipant);

module.exports = router;