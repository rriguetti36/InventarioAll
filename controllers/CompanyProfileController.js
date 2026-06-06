const CompanyProfileService = require('../services/CompanyProfileService');

class CompanyProfileController {
  static async getProfile(req, res, next) {
    try {
      res.json(await CompanyProfileService.getProfile());
    } catch (err) {
      next(err);
    }
  }

  static async saveProfile(req, res, next) {
    try {
      res.json(await CompanyProfileService.saveProfile(req.body));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CompanyProfileController;
