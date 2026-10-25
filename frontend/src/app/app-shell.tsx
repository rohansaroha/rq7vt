import { Box, Flex, Text } from '@radix-ui/themes'
import { Link, Outlet } from '@tanstack/react-router'

import { DataFreshness } from '@/features/meta/data-freshness'
import { HealthBadge } from '@/features/system/health-badge'
import { TurbineIcon } from '@/shared/ui/turbine-icon'

export function AppShell() {
  return (
    <Box minHeight="100vh" style={{ background: 'var(--gray-2)' }}>
      <header className="app-header">
        <Flex
          maxWidth="1200px"
          mx="auto"
          px="5"
          py="1"
          align="center"
          justify="between"
          gap="3"
          wrap="wrap"
        >
          <Flex align="center" gap="5" wrap="wrap">
            <Flex align="center" gap="2">
              <TurbineIcon />
              <Text weight="bold" size="3">
                Wind Forecast Portal
              </Text>
            </Flex>
            <nav aria-label="Main">
              <Flex gap="1" wrap="wrap">
                <Link to="/" className="nav-link" activeOptions={{ exact: true }}>
                  Decision
                </Link>
                <Link to="/accuracy" className="nav-link">
                  Accuracy
                </Link>
                <Link to="/method" className="nav-link">
                  Method
                </Link>
              </Flex>
            </nav>
          </Flex>
          <Flex align="center" gap="3" wrap="wrap">
            <DataFreshness />
            <HealthBadge />
          </Flex>
        </Flex>
      </header>
      <Box asChild maxWidth="1200px" mx="auto" p="5">
        <main>
          <Outlet />
        </main>
      </Box>
    </Box>
  )
}
