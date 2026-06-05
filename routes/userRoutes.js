const express = require('express');
const UserController = require('../controllers/UserController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();

// Proteger todas las rutas de usuarios
router.use(authMiddleware);

router.get('/', adminMiddleware, UserController.getUsers);
router.get('/:id', adminMiddleware, UserController.getUser);
router.post('/', adminMiddleware, UserController.createUser);
router.put('/:id', adminMiddleware, UserController.updateUser);
router.put('/:id/password', adminMiddleware, UserController.changePassword);
router.delete('/:id', adminMiddleware, UserController.deleteUser);

module.exports = router;
