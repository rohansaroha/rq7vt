import { ChatBubbleIcon } from '@radix-ui/react-icons'
import { Box, Flex, Text } from '@radix-ui/themes'
import { Link, Outlet } from '@tanstack/react-router'

import { DataFreshness } from '@/features/meta/data-freshness'
import { PeriodNote } from '@/features/meta/period-note'
import { HealthBadge } from '@/features/system/health-badge'
import { TurbineIcon } from '@/shared/ui/turbine-icon'

export function AppShell() {
  return (
    <Box minHeight="100vh" style={{ background: 'var(--brand-canvas)' }}>
      <header className="app-header">
        <Flex
          maxWidth="1200px"
          mx="auto"
          px={{ initial: '4', sm: '5' }}
          align="center"
          justify="between"
          gap="4"
          wrap="wrap"
        >
          <Flex align="center" gapX="6" gapY="0" wrap="wrap">
            <Link to="/" className="brand">
              <Flex align="center" gap="2" minHeight="56px">
                <TurbineIcon />
                <Text size="3">Wind Forecast Portal</Text>
              </Flex>
            </Link>
            <nav aria-label="Main">
              <Flex gap="1" wrap="wrap">
                <Link to="/" className="nav-link" activeOptions={{ exact: true }}>
                  Decision
                </Link>
                <Link to="/accuracy" className="nav-link">
                  Accuracy
                </Link>
                <Link to="/ask" className="nav-link">
                  Ask
                </Link>
                <Link to="/method" className="nav-link">
                  Method
                </Link>
              </Flex>
            </nav>
          </Flex>
          <Flex align="center" gap="3" wrap="wrap" py="2" display={{ initial: 'none', md: 'flex' }}>
            <DataFreshness />
            <HealthBadge />
            <Link to="/ask" className="cta">
              <ChatBubbleIcon aria-hidden="true" />
              Ask the data
            </Link>
          </Flex>
        </Flex>
      </header>
      <Box asChild maxWidth="1200px" mx="auto" px={{ initial: '4', sm: '5' }} py="5">
        <main>
          <Outlet />
        </main>
      </Box>
      <footer style={{ borderTop: '1px solid var(--hairline)' }}>
        <Flex
          maxWidth="1200px"
          mx="auto"
          px={{ initial: '4', sm: '5' }}
          py="4"
          gap="3"
          justify="between"
          wrap="wrap"
        >
          <Text size="1" color="gray">
            GB national wind · Elexon BMRS data (WINDFOR, FUELHH) · Times in UK time
          </Text>
          <PeriodNote />
        </Flex>
      </footer>
    </Box>
  )
}
