import { useCallback, useMemo } from 'react';
import type { BirthFormState } from './types';
import {
  removeLibraryEntry,
  upsertChartToLibrary,
  useChartLibrary,
  type ChartLibraryEntry,
} from '../chart-library';

export interface HistoryEntry {
  id: string;
  label: string;
  form: BirthFormState;
  savedAt: number;
  pinned?: boolean;
  completedCount?: number;
}

function toHistoryEntry(entry: ChartLibraryEntry): HistoryEntry {
  const displayName = entry.customAlias || entry.form.name;
  const label = [
    displayName,
    `${entry.form.day}/${entry.form.month}/${entry.form.year}`,
    entry.form.city || entry.form.province || '',
    entry.form.gender === 'male' ? 'Nam' : 'Nữ',
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    id: entry.chartIdentityKey,
    label,
    form: entry.form,
    savedAt: entry.lastOpenedAt,
    pinned: entry.pinned,
    completedCount: entry.dossierSummary.completedCount,
  };
}

/**
 * Tương thích ngược cho hook useHistory():
 * Ủy quyền toàn bộ sang Thư Viện Lá Số (src/lib/chart-library.ts).
 */
export function useHistory() {
  const { entries } = useChartLibrary();

  const history = useMemo(
    () => entries.map(toHistoryEntry),
    [entries],
  );

  const save = useCallback((form: BirthFormState) => {
    upsertChartToLibrary(form);
  }, []);

  const remove = useCallback((id: string) => {
    removeLibraryEntry(id, { deleteMode: 'entry_and_dossier' });
  }, []);

  return { history, save, remove };
}
