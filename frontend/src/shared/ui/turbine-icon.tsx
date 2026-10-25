export function TurbineIcon({
  size = 26,
  color = 'var(--accent-9)',
}: {
  size?: number
  color?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 10v12" />
      <path d="M12 10V3" />
      <path d="M12 10l6.5 4" />
      <path d="M12 10l-6.5 4" />
      <circle cx="12" cy="10" r="1.5" />
    </svg>
  )
}
