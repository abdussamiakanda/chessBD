export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) {
  const baseClasses =
    'font-medium rounded-lg transition-colors focus-ring disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-[var(--color-bg-active)] text-[var(--color-text-light)] hover:bg-[var(--color-bg-active)] hover:opacity-90 border border-[var(--color-border-dark)] shadow-md hover:shadow-lg transition-all duration-300',
    secondary: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-active)] border border-[var(--color-border-dark)] shadow-sm hover:shadow-md transition-all',
    danger: 'bg-[var(--color-danger)] text-white hover:opacity-90 shadow-lg hover:shadow-xl transition-all',
    ghost: 'bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] border border-[var(--color-border-dark)] hover:border-[var(--color-border-dark)]',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  }

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  )
}

