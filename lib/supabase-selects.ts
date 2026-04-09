export const TRIP_SELECT = `
  id,
  travel_id,
  pickup_address,
  pickup_time,
  trip_title,
  stop_duration_sec,
  traffic_buffer_sec,
  notes,
  created_at
`

export const TRAVEL_SELECT = `
  id,
  van_id,
  travel_type,
  location_id,
  scheduled_time,
  sort_order,
  notes,
  created_at
`

export const DRIVE_PLAN_SELECT = `
  ${TRAVEL_SELECT},
  vans!travels_van_id_fkey (
    id,
    label,
    plate_number,
    crew_member_id,
    seat_capacity,
    vehicle_type,
    notes,
    is_active,
    created_at,
    crew_members (
      id,
      full_name,
      phone,
      home_address
    )
  ),
  location:locations!travels_location_id_fkey (
    id,
    label,
    location_type,
    address,
    access_notes,
    created_at
  ),
  trips (
    ${TRIP_SELECT},
    trip_passengers (
      crew_members (
        id,
        full_name,
        phone,
        home_address
      )
    )
  )
`
