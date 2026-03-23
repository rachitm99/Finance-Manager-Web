import { NextResponse } from "next/server";

type ErrorWithCode = {
  code?: string;
  cause?: ErrorWithCode;
  message?: string;
};

function findCode(error: unknown): string | undefined {
  const current = error as ErrorWithCode | undefined;
  if (!current) {
    return undefined;
  }

  if (current.code) {
    return current.code;
  }

  return current.cause?.code;
}

export function dbErrorResponse(error: unknown, defaultMessage: string) {
  const code = findCode(error);

  if (code === "ENOTFOUND") {
    return NextResponse.json(
      {
        error:
          "Database host could not be resolved. Please copy a fresh Neon connection string into DATABASE_URL.",
      },
      { status: 503 },
    );
  }

  if (code === "ECONNREFUSED" || code === "ETIMEDOUT") {
    return NextResponse.json(
      {
        error: "Database is unreachable right now. Check network/firewall and try again.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ error: defaultMessage }, { status: 500 });
}
