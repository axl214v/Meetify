const express   = require('express');
const router    = express.Router();
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
router.post  ('/users/:id/verify',              c.forceVerify);
router.get   ('/conferences',                   c.getConferences);
router.delete('/conferences/:id',               c.deleteConference);
router.post  ('/conferences/:id/kick/:userId',  c.kickParticipant);
router.get   ('/settings/smtp',       c.getSmtpSettings);
router.put   ('/settings/smtp',       c.updateSmtpSettings);
router.post  ('/settings/smtp/test',  c.testSmtp);
router.post  ('/settings/smtp/send',  c.sendTestEmail);

router.get   ('/notifications',       c.getNotifications);
router.post  ('/notifications',       c.sendNotification);
router.delete('/notifications/:id',   c.deleteNotification);

module.exports = router;