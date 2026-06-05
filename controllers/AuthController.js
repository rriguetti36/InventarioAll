const UserService = require('../services/UserService');
const CompanyService = require('../services/CompanyService');

class AuthController {
  static async login(req, res, next) {
    try {
      const { email, password, companySlug } = req.body;
      const user = await UserService.loginUser(email, password, companySlug);
      res.json(user);
    } catch (err) {
      next(err);
    }
  }

  static async register(req, res, next) {
    try {
      const { name, email, password, estado } = req.body;
      const created = await UserService.createUser({ name, email, password, estado });
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }

  static async registerCompany(req, res, next) {
    try {
      const company = await CompanyService.registerCompany(req.body);
      res.status(201).json(company);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AuthController;
