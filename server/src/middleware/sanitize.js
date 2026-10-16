/**
 * Deeply sanitizes user input objects to prevent MongoDB operator injection ($gt, $ne, $where, etc.)
 */
export function sanitizeMongoInput(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeMongoInput);
  }

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    // Strip keys starting with $ or containing . (MongoDB query operators or dotted path injection)
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    clean[key] = sanitizeMongoInput(value);
  }
  return clean;
}

export const mongoSanitizeMiddleware = (req, res, next) => {
  if (req.body) req.body = sanitizeMongoInput(req.body);
  if (req.query) req.query = sanitizeMongoInput(req.query);
  if (req.params) req.params = sanitizeMongoInput(req.params);
  next();
};
