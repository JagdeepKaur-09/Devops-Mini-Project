// Line 1: Import jsonwebtoken package
const jwt = require("jsonwebtoken");

// Line 2: Import dotenv to access JWT_SECRET from .env
require("dotenv").config();

// Line 3: Create and export the middleware function
// req = request, res = response, next = move to next step
module.exports = (req, res, next) => {

  // Line 4: Read the Authorization header from the request
  // It looks like: "Bearer eyJhbGc..."
  const authHeader = req.headers["authorization"];

  // Line 5: If no header exists, block the request
  if (!authHeader) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  // Line 6: Split "Bearer eyJhbGc..." into ["Bearer", "eyJhbGc..."]
  // We only want the second part [1] which is the actual token
  const token = authHeader.split(" ")[1];

  // Line 7: If token is missing after splitting, block the request
  if (!token) {
    return res.status(401).json({ error: "Access denied. Invalid token format." });
  }

  // Line 8: Verify the token using your JWT_SECRET
  // If valid → decoded contains the userId we stored during login
  // If invalid/expired → throws an error caught below
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Line 9: Attach decoded data to req.user so routes can use it
    // Now any protected route can access req.user.userId
    req.user = decoded;

    // Line 10: Token is valid, move to the actual route handler
    next();

  } catch (err) {
    // Line 11: Token is invalid or expired
    return res.status(401).json({ error: "Invalid or expired token." });
  }

};