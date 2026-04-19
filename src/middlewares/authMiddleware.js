import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { syncUserRoleWithWhitelist } from '../utils/sellerAccess.js';

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      res.status(401);
      throw new Error('Not authorized, user not found');
    }

    req.user = await syncUserRoleWithWhitelist(user);
    next();
  } catch (error) {
    res.status(401);
    throw new Error('Not authorized, token failed');
  }
};

const seller = (req, res, next) => {
  if (req.user?.role === 'seller') {
    next();
    return;
  } else {
    res.status(403);
    throw new Error('Seller access required');
  }
};

export { protect, seller };
