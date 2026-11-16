export interface AiPeriodBadgeCheckInput {
  text?: string;
  incomplete?: boolean;
  meta?: {
    continuedFromPartial?: boolean;
    interrupted?: boolean;
  };
}

/**
 * Huy hiệu "Đã tự động nối tiếp luồng hoàn chỉnh" CHỈ được hiển thị khi:
 * 1. Quá trình streaming đã kết thúc (!isLoading)
 * 2. Có nội dung hoàn chỉnh đã lưu cache (Boolean(entry.text?.trim()))
 * 3. Không bị đánh dấu ngắt giữa chừng (!entry.incomplete && !entry.meta?.interrupted)
 * 4. Thực sự đã từng kích hoạt tiếp nối (Boolean(entry.meta?.continuedFromPartial))
 */
export function shouldShowCompletedContinuationBadge(
  entry: AiPeriodBadgeCheckInput | undefined,
  isLoading: boolean,
): boolean {
  if (!entry || isLoading) return false;
  if (!entry.meta?.continuedFromPartial) return false;
  if (entry.incomplete || entry.meta.interrupted) return false;
  return Boolean(entry.text && entry.text.trim().length > 0);
}

/**
 * Huy hiệu cảnh báo đã thử tiếp nối nhưng bản cuối vẫn bị ngắt giữa chừng.
 */
export function shouldShowInterruptedContinuationBadge(
  entry: AiPeriodBadgeCheckInput | undefined,
  isLoading: boolean,
): boolean {
  if (!entry || isLoading) return false;
  if (!entry.meta?.continuedFromPartial) return false;
  return Boolean(entry.incomplete || entry.meta.interrupted || !entry.text?.trim());
}

/**
 * Quyết định có được dùng lại bộ nhớ đệm kỳ hạn hay phải gọi lại API:
 * Bản bị ngắt (incomplete === true) tuyệt đối không được xem là cache hợp lệ.
 */
export function hasValidCachedPeriodEntry(entry: AiPeriodBadgeCheckInput | undefined): boolean {
  if (!entry || entry.incomplete || entry.meta?.interrupted) return false;
  return Boolean(entry.text && entry.text.trim().length > 0);
}

/**
 * Khi nhận snapshot mới từ server trong lúc người dùng đang chỉnh sửa hoặc đang lưu model,
 * giữ nguyên giá trị combobox cục bộ nếu modelDirty === true để không ghi đè lựa chọn đang sửa.
 */
export function resolveNextModelSelection(
  currentSelection: { defaultModel: string; fallbackModel: string },
  snapshotConfig: { defaultModel: string; fallbackModel: string },
  options: { modelDirty: boolean; forceSyncFromSave?: boolean },
): { defaultModel: string; fallbackModel: string } {
  if (options.modelDirty && !options.forceSyncFromSave) {
    return currentSelection;
  }
  return {
    defaultModel: snapshotConfig.defaultModel,
    fallbackModel: snapshotConfig.fallbackModel,
  };
}
