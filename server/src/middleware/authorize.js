export function authorize(...allowedRoles) {
  return function authorizeRequest(req, res, next) {
    if (!req.user) return res.status(401).json({ error: { message: 'Authentication required.' } });
    if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ error: { message: 'You do not have permission to perform this action.' } });
    return next();
  };
}
