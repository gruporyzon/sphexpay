import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from 'react'
import { cn } from '../../lib/utils'
import './landing-foundation.css'

type ClassNameProps = {
  className?: string
}

export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('spx-container', className)} {...props} />
}

type SectionProps = HTMLAttributes<HTMLElement> & {
  tone?: 'background' | 'muted'
  spacing?: 'default' | 'flush'
}

export function Section({
  className,
  tone = 'background',
  spacing = 'default',
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(
        'spx-section',
        tone === 'muted' && 'spx-section--muted',
        spacing === 'flush' && 'spx-section--flush',
        className,
      )}
      {...props}
    />
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  mobileFull?: boolean
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  mobileFull = false,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'spx-button',
        `spx-button--${variant}`,
        size !== 'md' && `spx-button--${size}`,
        mobileFull && 'spx-button--mobile-full',
        className,
      )}
      {...props}
    />
  )
}

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'spx-badge',
        tone !== 'neutral' && `spx-badge--${tone}`,
        className,
      )}
      {...props}
    />
  )
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  'aria-label': string
}

export function IconButton({
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn('spx-icon-button', className)}
      {...props}
    />
  )
}

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  tone?: 'default' | 'muted' | 'elevated'
  interactive?: boolean
}

export function Surface({
  className,
  tone = 'default',
  interactive = false,
  ...props
}: SurfaceProps) {
  return (
    <div
      className={cn(
        'spx-surface',
        tone !== 'default' && `spx-surface--${tone}`,
        interactive && 'spx-surface--interactive',
        className,
      )}
      {...props}
    />
  )
}

export function SectionEyebrow({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('spx-section-eyebrow', className)} {...props} />
}

type SectionTitleProps = ClassNameProps & {
  as?: 'h1' | 'h2' | 'h3'
  children: ReactNode
  size?: 'sm' | 'md' | 'display'
  id?: string
}

export function SectionTitle({
  as: Heading = 'h2',
  children,
  className,
  size = 'md',
  ...props
}: SectionTitleProps) {
  return (
    <Heading
      className={cn(
        'spx-section-title',
        size !== 'md' && `spx-section-title--${size}`,
        className,
      )}
      {...props}
    >
      {children}
    </Heading>
  )
}
