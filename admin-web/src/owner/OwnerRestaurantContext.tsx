/**
 * Which owned restaurant the /owner/* pages currently operate on. Almost
 * every owner has exactly one restaurant, in which case this just resolves
 * silently; a rare multi-restaurant owner gets a picker in OwnerLayout's
 * header, and every owner page reads the selection from here instead of
 * each fetching `GET /owner/restaurants` and re-implementing the "which one
 * is selected" state itself.
 */
import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { OwnerRestaurantListItemDto } from '@foodmap/shared-types'
import { ownerRestaurantsApi } from '../api/owner-restaurants'

interface OwnerRestaurantContextValue {
  restaurants: OwnerRestaurantListItemDto[]
  isLoading: boolean
  selectedId: string | null
  setSelectedId: (id: string) => void
  selected: OwnerRestaurantListItemDto | null
}

const OwnerRestaurantContext = createContext<OwnerRestaurantContextValue | undefined>(undefined)

export function OwnerRestaurantProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ['owner-restaurants'],
    queryFn: ownerRestaurantsApi.listMine,
  })
  const restaurants = useMemo(() => data ?? [], [data])
  const [manualSelectedId, setManualSelectedId] = useState<string | null>(null)

  const selectedId = manualSelectedId ?? restaurants[0]?.id ?? null
  const selected = restaurants.find((r) => r.id === selectedId) ?? null

  const value = useMemo(
    () => ({ restaurants, isLoading, selectedId, setSelectedId: setManualSelectedId, selected }),
    [restaurants, isLoading, selectedId, selected],
  )

  return <OwnerRestaurantContext.Provider value={value}>{children}</OwnerRestaurantContext.Provider>
}

export function useOwnerRestaurant(): OwnerRestaurantContextValue {
  const ctx = useContext(OwnerRestaurantContext)
  if (!ctx) {
    throw new Error('useOwnerRestaurant must be used within an OwnerRestaurantProvider')
  }
  return ctx
}
