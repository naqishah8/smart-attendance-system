const router = require('express').Router();
const { Salary } = require('../../models/Salary');
const SalaryService = require('../../services/finance/SalaryService');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const validate = require('../../utils/validate');
const { requireRole } = require('../middleware/auth');

// GET /
router.get('/', asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const { skip, limit, page } = validate.pagination(req.query);
  const query = {};

  if (month) query.month = validate.month(month);
  if (year) query.year = validate.year(year);

  const [salaries, total] = await Promise.all([
    Salary.find(query)
      .populate('userId', 'firstName lastName employeeId department')
      .skip(skip).limit(limit).sort({ year: -1, month: -1 }),
    Salary.countDocuments(query)
  ]);

  res.json({ salaries, total, page, limit });
}));

// POST /calculate
router.post('/calculate', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.required(req.body, ['userId', 'month', 'year']);
  validate.objectId(req.body.userId, 'User ID');

  const salary = await SalaryService.calculateMonthlySalary(
    req.body.userId, validate.month(req.body.month), validate.year(req.body.year)
  );

  res.json({ salary });
}));

// POST /process-all
router.post('/process-all', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  validate.required(req.body, ['month', 'year']);

  const results = await SalaryService.processAllSalaries(
    validate.month(req.body.month), validate.year(req.body.year)
  );

  const succeeded = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;

  res.json({ results, summary: { total: results.length, succeeded, failed } });
}));

// GET /:id/payslip
router.get('/:id/payslip', asyncHandler(async (req, res) => {
  validate.objectId(req.params.id, 'Salary ID');

  const payslip = await SalaryService.generatePayslip(req.params.id);
  res.json({ payslip });
}));

// GET /export - Export salary data as Excel (admin only)
router.get('/export', requireRole('admin', 'super-admin'), asyncHandler(async (req, res) => {
  const month = validate.month(req.query.month || (new Date().getMonth() + 1));
  const year = validate.year(req.query.year || new Date().getFullYear());

  const salaries = await Salary.find({ month, year })
    .populate('userId', 'firstName lastName employeeId department designation')
    .sort({ 'userId.department': 1 });

  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smart Attendance System';

  const sheet = workbook.addWorksheet(`Payroll ${month}-${year}`);
  sheet.columns = [
    { header: 'Employee ID', key: 'empId', width: 14 },
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Department', key: 'dept', width: 16 },
    { header: 'Base Salary', key: 'base', width: 14 },
    { header: 'Days Present', key: 'present', width: 14 },
    { header: 'Working Days', key: 'workDays', width: 14 },
    { header: 'Overtime Earnings', key: 'overtime', width: 16 },
    { header: 'Bonuses', key: 'bonuses', width: 12 },
    { header: 'Fines', key: 'fines', width: 12 },
    { header: 'Loan Deductions', key: 'loans', width: 16 },
    { header: 'Tax', key: 'tax', width: 12 },
    { header: 'Net Salary', key: 'net', width: 14 },
    { header: 'Status', key: 'status', width: 12 }
  ];

  // Style header row
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C63FF' } };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  for (const s of salaries) {
    sheet.addRow({
      empId: s.userId?.employeeId || '',
      name: `${s.userId?.firstName || ''} ${s.userId?.lastName || ''}`.trim(),
      dept: s.userId?.department || '',
      base: s.baseSalary || 0,
      present: s.daysPresent || 0,
      workDays: s.workingDaysInMonth || 0,
      overtime: s.overtimeEarnings || 0,
      bonuses: s.bonuses?.reduce((sum, b) => sum + b.amount, 0) || 0,
      fines: s.fines?.reduce((sum, f) => sum + f.amount, 0) || 0,
      loans: s.loanDeductions?.reduce((sum, l) => sum + l.amount, 0) || 0,
      tax: s.taxDeductions || 0,
      net: s.netSalary || 0,
      status: s.paymentStatus || 'pending'
    });
  }

  // Format currency columns
  ['base', 'overtime', 'bonuses', 'fines', 'loans', 'tax', 'net'].forEach(key => {
    sheet.getColumn(key).numFmt = '$#,##0.00';
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=payroll_${year}_${month}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
}));

module.exports = router;
