import { type Request, type Response, type NextFunction } from "express";
import { auth } from "./better-auth";

declare global {
  namespace Express {
    interface Request {
      dbUserId?: number;
      user?: any;
    }
  }
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session || !session.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.dbUserId = Number(session.user.id);
  req.user = session.user;
  next();
};

export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (session && session.user) {
    req.dbUserId = Number(session.user.id);
  }

  next();
};
