import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Express middleware that validates request body, query, and params against Zod schemas.
 * Returns 400 with structured error messages on validation failure.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Array<{ field: string; message: string }> = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.push(...formatErrors(result.error, "body"));
      } else {
        req.body = result.data;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.push(...formatErrors(result.error, "query"));
      } else {
        (req as any).query = result.data;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.push(...formatErrors(result.error, "params"));
      } else {
        req.params = result.data;
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ error: "Validation failed", details: errors });
      return;
    }

    next();
  };
}

function formatErrors(error: ZodError, prefix: string): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: `${prefix}.${issue.path.join(".")}`,
    message: issue.message,
  }));
}
