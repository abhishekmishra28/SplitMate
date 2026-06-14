module.exports = (err, req, res, next) => {
  console.error(err);

  if (err.code === "P2002") {
    return res.status(400).json({
      success: false,
      message: "Duplicate entry"
    });
  }

  if (err.code === "P2025") {
    return res.status(404).json({
      success: false,
      message: "Record not found"
    });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
};