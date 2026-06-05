const CompanyService = require('../services/CompanyService');

class CompanyController {
  static async getCompanies(req, res, next) {
    try {
      const companies = await CompanyService.getAllCompanies();
      res.json(companies);
    } catch (err) {
      next(err);
    }
  }

  static async updateCompany(req, res, next) {
    try {
      const company = await CompanyService.updateCompany(parseInt(req.params.id, 10), req.body);
      res.json(company);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CompanyController;
