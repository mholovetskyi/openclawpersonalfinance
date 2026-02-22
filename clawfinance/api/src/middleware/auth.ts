import { Request, Response, NextFunction } from "express";

const API_KEY = process.env.CLAWFINANCE_API_KEY;

export function localAuth(req: Request, res: Response, next: NextFunction): void {
  // If no API key is configured, allow all local requests
  if (!API_KEY) {
    next();
    return;
  }

  const provided = req.headers["x-api-key"];
  if (provided !== API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
