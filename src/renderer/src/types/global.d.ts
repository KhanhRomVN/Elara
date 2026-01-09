import React from 'react'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      ERR: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        id: number
        type: string
      }
    }
  }
}
