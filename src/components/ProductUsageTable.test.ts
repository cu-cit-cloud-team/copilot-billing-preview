import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ProductUsageTable, type ProductUsageTableProduct } from './ProductUsageTable'

const PRODUCTS: ProductUsageTableProduct[] = [
  {
    product: 'Copilot',
    totals: {
      requests: 10,
      aicQuantity: 25,
      netAmount: 0.4,
      aicNetAmount: 0.25,
    },
    models: {
      'GPT-5.2': {
        requests: 10,
        aicQuantity: 25,
        netAmount: 0.4,
        aicNetAmount: 0.25,
      },
    },
  },
]

describe('ProductUsageTable', () => {
  it('keeps transition-period PRU comparison columns by default', () => {
    const html = renderToStaticMarkup(createElement(ProductUsageTable, { products: PRODUCTS }))

    expect(html).toContain('PRUs')
    expect(html).toContain('PRU net cost')
    expect(html).toContain('Difference')
    expect(html).toContain('AIC net cost')
  })

  it('renders native AI Credits columns without PRU comparison labels', () => {
    const html = renderToStaticMarkup(createElement(ProductUsageTable, {
      products: PRODUCTS,
      reportMode: 'native-ai-credits',
    }))

    expect(html).not.toContain('PRUs')
    expect(html).not.toContain('PRU net cost')
    expect(html).not.toContain('Difference')
    expect(html).toContain('AICs')
    expect(html).toContain('AIC net cost')
  })
})
