module.exports = (req, res, next) => {

  const {
    fromUserId,
    toUserId,
    amount
  } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Amount must be greater than zero"
    });
  }

  if (fromUserId === toUserId) {
    return res.status(400).json({
      success: false,
      message: "Cannot settle with yourself"
    });
  }

  next();
};