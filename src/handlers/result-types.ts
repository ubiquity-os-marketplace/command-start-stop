export enum HttpStatusCode {
  OK = 200,
  NOT_MODIFIED = 304,
}

export interface Result {
  status: HttpStatusCode;
  content?: string;
  reason?: string;
}
