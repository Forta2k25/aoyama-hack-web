// Display-only reference conversion. Provider usage/cost and stored USD values stay unchanged.
// Update this table when refreshing the reference rate; this is not a live FX quote.
export const costDisplay = Object.freeze({
  currency: 'JPY',
  usdToJpy: 157.76,
  rateAsOf: '2026-10-15',
  rateSource: 'https://www.investing.com/currencies/usd-jpy-historical-data',
})

export function estimatedCostText(usd?: number | null): string {
  if (usd == null || !Number.isFinite(usd) || usd < 0) return '推定コスト未取得'
  const yen = usd * costDisplay.usdToJpy
  if (!Number.isFinite(yen)) return '推定コスト未取得'
  const amount = yen > 0 && yen < 0.0001 ? '¥0.0001未満' : `¥${yen.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: yen < 1 ? 4 : 2 })}`
  return `推定 ${amount}（換算: 1 USD = ¥${costDisplay.usdToJpy.toFixed(2)}・参考レート ${costDisplay.rateAsOf}。実際の請求額とは異なります）`
}
