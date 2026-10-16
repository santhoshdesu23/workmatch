export const errorHandler = (err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const correlationId = req.headers['x-request-id'] || req.id;

  // Log detailed error on server with correlation ID
  console.error(`[Error Handler][${correlationId || 'N/A'}]`, err);

  // Mongoose duplicate key error (e.g. unique email or compound index)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'record';
    return res.status(409).json({
      success: false,
      message: `A ${field} with that identifier already exists.`
    });
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid ID format for ${err.path}.`
    });
  }

  // Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      message: messages.join(', ')
    });
  }

  const statusCode = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);

  // In production, prevent leaking internal stack traces or database error messages on 500
  let clientMessage = err.message || 'Internal Server Error';
  if (isProduction && statusCode >= 500) {
    clientMessage = 'An internal server error occurred. Please contact platform support with your request ID.';
  }

  res.status(statusCode).json({
    success: false,
    message: clientMessage,
    ...(correlationId ? { correlationId } : {})
  });
};
