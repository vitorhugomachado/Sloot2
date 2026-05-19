const express = require('express');
const { register, login, googleLogin, getMe, getMyAppointments, updateProfile } = require('../controllers/customerAuthController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/me', authMiddleware, getMe);
router.get('/appointments', authMiddleware, getMyAppointments);
router.patch('/profile', authMiddleware, updateProfile);

module.exports = router;
