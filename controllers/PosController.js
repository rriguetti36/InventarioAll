const PosService = require('../services/PosService');

function controller(action) {
  return async (req, res, next) => {
    try {
      const result = await action(req);
      res.status(req.method === 'POST' ? 201 : 200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

function fileController(action) {
  return async (req, res, next) => {
    try {
      const result = await action(req);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  };
}

class PosController {
  static bootstrap = controller((req) => PosService.bootstrap(req.user));

  static listTerminals = controller((req) => PosService.listTerminals(req.user));
  static createTerminal = controller((req) => PosService.createTerminal(req.body, req.user));
  static updateTerminal = controller((req) => PosService.updateTerminal(parseInt(req.params.id, 10), req.body, req.user));

  static getOpenShift = controller((req) => PosService.getOpenShift(req.query, req.user));
  static openShift = controller((req) => PosService.openShift(req.body, req.user));
  static closeShift = controller((req) => PosService.closeShift(parseInt(req.params.id, 10), req.body, req.user));

  static listSales = controller((req) => PosService.listSales(req.query, req.user));
  static dailySalesSummary = controller((req) => PosService.dailySalesSummary(req.query, req.user));
  static getSale = controller((req) => PosService.getSale(parseInt(req.params.id, 10), req.user));
  static getSalePdf = fileController((req) => PosService.getSalePdf(parseInt(req.params.id, 10), req.user));
  static createSale = controller((req) => PosService.createSale(req.body, req.user));

  static createCashMovement = controller((req) => PosService.createCashMovement(req.body, req.user));
  static listCashMovements = controller((req) => PosService.listCashMovements(parseInt(req.params.shiftId, 10), req.user));
}

module.exports = PosController;
