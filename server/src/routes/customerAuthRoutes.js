const express = require('express');
const {
  register,
  login,
  googleLogin,
  getMe,
  getMyAppointments,
  updateProfile,
  forgotPassword,
  syncPassword,
} = require('../controllers/customerAuthController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/forgot-password', forgotPassword);
router.post('/sync-password', syncPassword);
router.get('/me', authMiddleware, getMe);
router.get('/appointments', authMiddleware, getMyAppointments);
router.patch('/profile', authMiddleware, updateProfile);

module.exports = router;
