import { fromJson, toJson, type DescMessage, type MessageShape } from '@bufbuild/protobuf';
import { apiFetch, extractErrorMessage, parseJsonText } from '@/lib/api';

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type MutateMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ProtoFetchInit {
  method?: RequestMethod;
}

const READ_OPTS = { ignoreUnknownFields: true } as const;

export class ProtoHttpError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly bodyText: string,
    message: string,
  ) {
    super(message);
    this.name = 'ProtoHttpError';
  }
}

async function toProtoHttpError(res: Response): Promise<ProtoHttpError> {
  const bodyText = await res.text().catch(() => '');
  const message = extractErrorMessage(res, parseJsonText(bodyText));
  return new ProtoHttpError(res.status, res.statusText, bodyText, message);
}

export async function protoFetch<Desc extends DescMessage>(
  schema: Desc,
  path: string,
  init?: ProtoFetchInit,
): Promise<MessageShape<Desc>> {
  const res = await apiFetch(path, { method: init?.method ?? 'GET' });
  if (!res.ok) {
    throw await toProtoHttpError(res);
  }
  return fromJson(schema, await res.json(), READ_OPTS);
}

export async function protoFetchOrNull<Desc extends DescMessage>(
  schema: Desc,
  path: string,
  init?: ProtoFetchInit,
): Promise<MessageShape<Desc> | null> {
  const res = await apiFetch(path, { method: init?.method ?? 'GET' });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw await toProtoHttpError(res);
  }
  return fromJson(schema, await res.json(), READ_OPTS);
}

export async function protoSend<ReqDesc extends DescMessage, ResDesc extends DescMessage>(
  method: MutateMethod,
  path: string,
  reqSchema: ReqDesc,
  req: MessageShape<ReqDesc>,
  resSchema: ResDesc,
): Promise<MessageShape<ResDesc>> {
  const body = toJson(reqSchema, req);
  const res = await apiFetch(path, { method, body });
  if (!res.ok) {
    throw await toProtoHttpError(res);
  }
  return fromJson(resSchema, await res.json(), READ_OPTS);
}

export function requireData<T>(data: T | undefined, context: string): T {
  if (data === undefined) {
    throw new Error(`Missing data payload for ${context}`);
  }
  return data;
}
