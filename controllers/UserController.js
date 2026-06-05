const UserService = require('../services/UserService');

class UserController {
  static async getUsers(req, res, next) {
    try {
      const users = await UserService.getAllUsers();
      res.json(users);
    } catch (err) {
      next(err);
    }
  }

  static async getUser(req, res, next) {
    try {
      const user = await UserService.getUserById(parseInt(req.params.id, 10));
      res.json(user);
    } catch (err) {
      next(err);
    }
  }

  static async createUser(req, res, next) {
    try {
      const createdUser = await UserService.createUser(req.body, req.user);
      res.status(201).json(createdUser);
    } catch (err) {
      next(err);
    }
  }

  static async updateUser(req, res, next) {
    try {
      const updatedUser = await UserService.updateUser(parseInt(req.params.id, 10), req.body, req.user);
      res.json(updatedUser);
    } catch (err) {
      next(err);
    }
  }

  static async changePassword(req, res, next) {
    try {
      const updatedUser = await UserService.changePassword(parseInt(req.params.id, 10), req.body);
      res.json(updatedUser);
    } catch (err) {
      next(err);
    }
  }

  static async deleteUser(req, res, next) {
    try {
      await UserService.deleteUser(parseInt(req.params.id, 10), req.user);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

module.exports = UserController;
