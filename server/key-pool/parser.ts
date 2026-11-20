import crypto from 'crypto';
import {
  MAX_RAW_INPUT_CHARS,
  type PreviewItem,
  type PreviewSessionEntry,
} from './types.ts';

const GEMINI_KEY_REGEX = /^AIza[A-Za-z0-9_-]{31,41}$/;
const SIMPLE_LABELED_LINE_REGEX =
  /^([A-Za-zÀ-ỹ0-9_.\-\s]{1,32})\s*[:=]\s*['"]?([^\s'",;]+)['"]?[;,\s]*$/u;

export function maskApiKey(rawKey: string): string {
  const trimmed = rawKey.trim();
  if (trimmed.length <= 12) {
    return '***';
  }
  return `${trimmed.slice(0, 6)}••••••${trimmed.slice(-4)}`;
}

export function maskInvalidToken(token: string): string {
  const clean = token.trim();
  if (clean.length <= 8) {
    return `••• (${clean.length} ký tự)`;
  }
  return `${clean.slice(0, 3)}•••${clean.slice(-2)} (${clean.length} ký tự)`;
}

export function computeKeyFingerprint(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

export function isValidGeminiApiKey(token: string): boolean {
  return GEMINI_KEY_REGEX.test(token.trim());
}

function unwrapSingleToken(rawToken: string): string {
  let token = rawToken.trim();
  // Bóc dấu nháy / ngoặc bao quanh từ JSON hoặc .env
  token = token.replace(/^[\[\]{}'"`(]+/, '').replace(/[\[\]{}'"`),;]+$/, '').trim();
  if (!token) return '';

  // Bóc dạng URL ?key=AIza... hoặc &key=AIza...
  if (/^https?:\/\//i.test(token) || /[?&]key=/i.test(token)) {
    try {
      const url = new URL(token);
      const qKey = url.searchParams.get('key');
      if (qKey) return qKey.trim();
    } catch {
      const m = token.match(/[?&]key=([^&\s'"]+)/i);
      if (m?.[1]) return m[1].trim();
    }
  }

  // Bóc dạng ENV VAR: GEMINI_API_KEY=AIza... hoặc API_KEY=AIza...
  const envMatch = token.match(/^(?:[A-Z0-9_]*KEY[A-Z0-9_]*|key|apiKey|api_key)\s*[:=]\s*['"]?(.+?)['"]?$/i);
  if (envMatch?.[1]) {
    return envMatch[1].replace(/^['"]|['"]$/g, '').trim();
  }

  return token;
}

interface ExtractedToken {
  rawToken: string;
  customLabel?: string;
}

function extractTokensFromJson(trimmedInput: string): ExtractedToken[] | null {
  if (!(trimmedInput.startsWith('[') || trimmedInput.startsWith('{'))) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmedInput);
    const out: ExtractedToken[] = [];
    const visit = (node: unknown, labelHint?: string) => {
      if (typeof node === 'string') {
        const cleaned = node.trim();
        if (cleaned) {
          out.push({ rawToken: cleaned, customLabel: labelHint });
        }
        return;
      }
      if (Array.isArray(node)) {
        for (const item of node) visit(item);
        return;
      }
      if (node && typeof node === 'object') {
        const obj = node as Record<string, unknown>;
        const label =
          typeof obj.label === 'string'
            ? obj.label.trim()
            : typeof obj.name === 'string'
              ? obj.name.trim()
              : undefined;
        const keyCandidate = obj.key ?? obj.apiKey ?? obj.api_key ?? obj.value ?? obj.token;
        if (typeof keyCandidate === 'string') {
          out.push({ rawToken: keyCandidate.trim(), customLabel: label });
        } else {
          for (const val of Object.values(obj)) {
            visit(val, label);
          }
        }
      }
    };
    visit(parsed);
    return out;
  } catch {
    return null;
  }
}

export interface BatchParseOutput {
  recognizedCount: number;
  duplicateCount: number;
  invalidCount: number;
  items: PreviewItem[];
  validEntries: PreviewSessionEntry[];
}

export function parseBatchKeys(
  rawInput: string,
  existingFingerprints: Set<string>,
  labelPrefix = 'Khóa',
  startingNumber = 1,
): BatchParseOutput {
  if (typeof rawInput !== 'string') {
    throw new Error('Dữ liệu đầu vào phải là chuỗi văn bản.');
  }
  if (rawInput.length > MAX_RAW_INPUT_CHARS) {
    throw new Error(
      `Văn bản nhập vượt quá giới hạn tối đa ${MAX_RAW_INPUT_CHARS.toLocaleString('vi-VN')} ký tự (64 KB).`,
    );
  }

  const normalized = rawInput.replace(/\r\n?/g, '\n').trim();
  if (!normalized) {
    return {
      recognizedCount: 0,
      duplicateCount: 0,
      invalidCount: 0,
      items: [],
      validEntries: [],
    };
  }

  const extracted: ExtractedToken[] = [];

  // Thử parse JSON chuẩn trước nếu toàn bộ đầu vào là mảng/object JSON hợp lệ
  const jsonTokens = extractTokensFromJson(normalized);
  if (jsonTokens !== null) {
    extracted.push(...jsonTokens);
  } else {
    // Pha 1: Tiền xử lý từng dòng (bỏ dòng trống, bỏ comment #, //, bắt nhãn đơn giản Label: key)
    const lines = normalized.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) {
        continue;
      }

      const isUrlLine = /^https?:\/\//i.test(line);
      const hasBraces = line.includes('{') || line.includes('}');
      const labeledMatch = !isUrlLine && !hasBraces ? line.match(SIMPLE_LABELED_LINE_REGEX) : null;

      if (labeledMatch) {
        const rawLabel = labeledMatch[1].trim();
        const rawCandidate = labeledMatch[2].trim();
        const isEnvName = /^(?:GEMINI_API_KEY|GEMINI_API_KEYS|API_KEY|KEY|TOKEN)$/i.test(rawLabel);
        extracted.push({
          rawToken: rawCandidate,
          customLabel: isEnvName ? undefined : rawLabel,
        });
        continue;
      }

      // Pha 2: Tách đa dấu phân cách: phẩy, khoảng trắng, tab, chấm phẩy + dọn cặp JSON/CSV
      const sanitizedLine = hasBraces
        ? line.replace(/"(?:label|name|key|apiKey|api_key|value|token)"\s*:\s*/gi, ' ')
        : line;

      const rawChunks = sanitizedLine.split(/[\s,;\t]+/);
      for (const chunk of rawChunks) {
        const cleaned = unwrapSingleToken(chunk);
        if (!cleaned) continue;
        // Bỏ qua placeholder mẫu trong .env.example
        if (cleaned === 'MY_GEMINI_API_KEY') continue;
        extracted.push({ rawToken: cleaned });
      }
    }
  }

  const seenInBatch = new Set<string>();
  const items: PreviewItem[] = [];
  const validEntries: PreviewSessionEntry[] = [];
  let recognizedCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;
  let keyCounter = startingNumber;

  for (const { rawToken, customLabel } of extracted) {
    const token = unwrapSingleToken(rawToken);
    if (!token || token === 'MY_GEMINI_API_KEY') continue;

    if (!isValidGeminiApiKey(token)) {
      invalidCount += 1;
      items.push({
        maskedToken: maskInvalidToken(token),
        status: 'invalid_format',
        reason: 'Không đúng định dạng Gemini API key (tiền tố AIza, dài 35–45 ký tự hợp lệ)',
      });
      continue;
    }

    const fingerprint = computeKeyFingerprint(token);
    const maskedKey = maskApiKey(token);

    if (existingFingerprints.has(fingerprint)) {
      duplicateCount += 1;
      items.push({
        maskedToken: maskedKey,
        status: 'duplicate_in_pool',
        reason: 'Khóa này đã tồn tại trong Kho Khóa',
      });
      continue;
    }

    if (seenInBatch.has(fingerprint)) {
      duplicateCount += 1;
      items.push({
        maskedToken: maskedKey,
        status: 'duplicate_in_batch',
        reason: 'Trùng lặp trong danh sách vừa dán',
      });
      continue;
    }

    seenInBatch.add(fingerprint);
    recognizedCount += 1;
    const assignedLabel = customLabel?.slice(0, 32) || `${labelPrefix} #${keyCounter}`;
    keyCounter += 1;

    items.push({
      maskedToken: maskedKey,
      status: 'valid',
      suggestedLabel: assignedLabel,
    });

    validEntries.push({
      rawKey: token,
      fingerprint,
      maskedKey,
      label: assignedLabel,
    });
  }

  return {
    recognizedCount,
    duplicateCount,
    invalidCount,
    items,
    validEntries,
  };
}
