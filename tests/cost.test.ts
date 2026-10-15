import test from 'node:test'
import assert from 'node:assert/strict'
import { estimatedCostText, costDisplay } from '../src/ai/cost.ts'
import { metadataText } from '../src/ai/format.ts'

test('provider USD cost displays as estimated yen with explicit dated reference rate', () => {
  assert.equal(costDisplay.usdToJpy, 157.76)
  assert.match(estimatedCostText(0.00402), /推定 ¥0\.6342/)
  assert.match(estimatedCostText(1), /推定 ¥157\.76/)
  assert.match(estimatedCostText(10), /推定 ¥1,577\.60/)
  assert.match(estimatedCostText(0.00402), /1 USD = ¥157\.76・参考レート 2026-10-15/)
  assert.match(estimatedCostText(0.00402), /実際の請求額とは異なります/)
})

test('free, sub-display precision, and missing costs stay distinguishable', () => {
  assert.match(estimatedCostText(0), /推定 ¥0\.00（/)
  assert.match(estimatedCostText(0.00000001), /¥0\.0001未満/)
  for (const value of [undefined, null, NaN, Infinity, -0.01, Number.MAX_VALUE]) {
    assert.equal(estimatedCostText(value), '推定コスト未取得')
  }
})

test('shared chat and source metadata converts only display and preserves audio billing semantics', () => {
  const recognition = {provider: 'groq', model: 'whisper-large-v3-turbo', method: 'groq_asr', estimatedCostUSD: 0.002, audioDurationSeconds: 180}
  const before = structuredClone(recognition)
  const result = metadataText(recognition)
  assert.match(result, /推定 ¥0\.3155/)
  assert.match(result, /音声認識はtoken課金ではないため対象外/)
  assert.deepEqual(recognition, before)
  assert.match(metadataText({estimatedCostUSD: 0.00402, totalTokens: 3357}), /合計 3,357 tokens/)
})
