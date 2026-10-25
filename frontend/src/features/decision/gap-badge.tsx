import { Badge } from '@radix-ui/themes'

import { formatMw } from '@/shared/format'

/** Short or long, said in words as well as colour. */
export function GapBadge({ errorMw }: { errorMw: number | null }) {
  if (errorMw == null) {
    return (
      <Badge color="gray" variant="soft">
        Not scored
      </Badge>
    )
  }
  if (errorMw > 0) {
    return (
      <Badge color="orange" variant="soft">
        Short by {formatMw(errorMw)}
      </Badge>
    )
  }
  return (
    <Badge color="teal" variant="soft">
      Long by {formatMw(-errorMw)}
    </Badge>
  )
}
