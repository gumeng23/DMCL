import type { AmcApi, PageId } from '../shared/types'

declare global {
  interface Window {
    amc: AmcApi & { debugInitialPage: PageId | null }
  }
}

export {}
