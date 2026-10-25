import { Slider } from 'radix-ui'

/**
 * A single-value slider whose thumb (the element with role="slider") carries the
 * accessible name and a readable value, which Radix Themes' Slider does not forward.
 * `onChange` fires while dragging for live feedback; `onCommit` fires once on release,
 * for anything costly such as a network request.
 */
export function RangeSlider({
  label,
  valueText,
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
}: {
  label: string
  valueText: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  onCommit?: (value: number) => void
}) {
  return (
    <Slider.Root
      className="slider-root"
      min={min}
      max={max}
      step={step}
      value={[value]}
      onValueChange={([next]) => {
        if (next !== undefined) onChange(next)
      }}
      onValueCommit={([next]) => {
        if (next !== undefined) onCommit?.(next)
      }}
    >
      <Slider.Track className="slider-track">
        <Slider.Range className="slider-range" />
      </Slider.Track>
      <Slider.Thumb className="slider-thumb" aria-label={label} aria-valuetext={valueText} />
    </Slider.Root>
  )
}
