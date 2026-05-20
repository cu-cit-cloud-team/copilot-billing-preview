export const EXISTING_DISCOUNT_DISCLAIMER = 'All values are provided without any existing discounts.'

type ExistingDiscountDisclaimerProps = {
  className?: string
}

export function ExistingDiscountDisclaimer({ className = '' }: ExistingDiscountDisclaimerProps) {
  return (
    <p className={`m-0 mt-1 text-[12px] text-fg-muted leading-normal ${className}`.trim()}>
      {EXISTING_DISCOUNT_DISCLAIMER}
    </p>
  )
}
