import { Request, Response, NextFunction } from "express";

export function localAuth(req: Request, res: Response, next: NextFunction): void {
  // Read at request time so tests can override via process.env
  const apiKey = process.env.CLAWFINANCE_API_KEY;

  // If no API key is configured, allow all local requests
  if (!apiKey) {
    next();
    return;
  }

  const provided = req.headers["x-api-key"];
  if (provided !== apiKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
