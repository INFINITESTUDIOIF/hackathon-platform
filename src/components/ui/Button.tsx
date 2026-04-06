import type { ButtonHTMLAttributes } from 'react'
import {
  buttonClass,
  type ButtonSize,
  type ButtonVariant,
} from './buttonClass'

export type { ButtonSize, ButtonVariant }

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  children,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      className={buttonClass(variant, size, className)}
      {...rest}
    >
      {children}
    </button>
  )
}
