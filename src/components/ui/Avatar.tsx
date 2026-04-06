type Props = {
  src: string
  alt: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Avatar({ src, alt, size = 'md', className = '' }: Props) {
  const s =
    size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-12 w-12' : 'h-9 w-9'
  return (
    <img
      src={src}
      alt={alt}
      className={`${s} rounded-full object-cover ring-2 ring-white shadow-sm ${className}`}
      loading="lazy"
    />
  )
}
