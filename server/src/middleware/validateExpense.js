module.exports = (req, res, next) => {

  const {
    description,
    amount,
    splitType
  } = req.body;

  if (!description?.trim()) {
    return res.status(400).json({
      success: false,
      message: "Description required"
    });
  }

  if (!amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Amount must be greater than zero"
    });
  }

  const allowed = [
    "equal",
    "exact",
    "percentage",
    "share",
    "custom"
  ];

  if (!allowed.includes(splitType)) {
    return res.status(400).json({
      success: false,
      message: "Invalid split type"
    });
  }

  next();
};