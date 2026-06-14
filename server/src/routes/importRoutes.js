const express = require("express");

const router = express.Router();

const protect =
  require("../middleware/authMiddleware");

const groupMemberMiddleware =
  require("../middleware/groupMemberMiddleware");

const upload =
  require("../middleware/uploadCsv");

const {
  uploadCsv,
  getImportReports,
  getImportReportById,
  approveImportReport,
  executeImport,
} = require(
  "../controllers/importController"
);

router.use(protect);

router.post(
  "/upload/:groupId",
  groupMemberMiddleware,
  upload.single("file"),
  uploadCsv
);

router.get(
  "/reports/:groupId",
  groupMemberMiddleware,
  getImportReports
);

router.get(
  "/report/:reportId",
  getImportReportById
);

router.post(
  "/report/:reportId/approve",
  approveImportReport
);

router.post(
  "/execute/:reportId",
  executeImport
);

module.exports = router;