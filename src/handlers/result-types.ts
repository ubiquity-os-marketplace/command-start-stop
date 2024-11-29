export enum HttpStatusCode {
  OK = 200,
  NOT_MODIFIED = 304,
  BAD_REQUEST = 400,
}

export interface Result extends Record<string, unknown> {
  status: HttpStatusCode;
  content?: string;
  reason?: string;
}
