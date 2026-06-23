export function apiSuccess<T>(data: T, status = 200) {
  return Response.json(
    {
      success: true,
      data,
      meta: { request_id: crypto.randomUUID(), timestamp: new Date().toISOString() },
      errors: null,
    },
    { status }
  );
}

export function apiError(
  errors: { code: string; field?: string; message: string }[],
  status = 400
) {
  return Response.json(
    {
      success: false,
      data: null,
      meta: { request_id: crypto.randomUUID() },
      errors,
    },
    { status }
  );
}

export function nextNumber(prefix: string, seq: number): string {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
}
