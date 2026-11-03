let last: { cols: number; rows: number } | null = null;

export const lastFitSize = () => last;

export function rememberFitSize(size: { cols: number; rows: number }) {
  last = size;
}
