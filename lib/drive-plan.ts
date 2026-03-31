import "server-only"

import { createClient } from "@/lib/server"

type RawCrewMember = {
  id: string
  full_name: string
  phone: string | null
  home_address: string | null
}

type RawTripPassenger = {
  crew_members: RawCrewMember | null
}

type RawTrip = {
  id: string
  travel_id: string
  pickup_address: string | null
  pickup_time: string | null
  trip_title: string | null
  stop_duration_sec: number | null
  traffic_buffer_sec: number | null
  notes: string | null
  created_at: string
  trip_passengers?: RawTripPassenger[] | null
}

type RawVan = {
  id: string
  label: string | null
  plate_number: string | null
  seat_capacity: number | null
  vehicle_type: string | null
  notes: string | null
  is_active: boolean | null
  created_at: string
}

type RawTravel = {
  id: string
  van_id: string | null
  driver_crew_id: string | null
  start_location: string | null
  start_time: string | null
  destination_address: string | null
  notes: string | null
  created_at: string
  vans?: RawVan | null
  driver?: RawCrewMember | null
  trips?: RawTrip[] | null
}

export type StopPickupPassenger = {
  id: string
  name: string
  phone: string | null
  address: string
}

export type StopPickupPassengerOption = {
  id: string
  name: string
  detail: string
  phone: string | null
  address: string
}

export type DriveStop = {
  id: string
  driveId: string
  stopTitle: string
  pickupAddress: string
  pickupTime: string | null
  pickupTimeLabel: string
  stopDurationSec: number | null
  trafficBufferSec: number | null
  notes: string | null
  createdAt: string
  stopPickupPassengers: StopPickupPassenger[]
}

export type Drive = {
  id: string
  vanId: string | null
  driverCrewId: string | null
  label: string
  startLocation: string
  startTime: string | null
  startTimeLabel: string
  destinationAddress: string
  notes: string | null
  createdAt: string
  van: RawVan | null
  driver: StopPickupPassenger | null
  stops: DriveStop[]
}

export type TransportPlan = {
  drives: Drive[]
  stopPickupPassengerOptions: StopPickupPassengerOption[]
}

function formatDatabaseTime(value: string | null | undefined) {
  if (!value) {
    return ""
  }

  const match = value.match(/^(\d{2}):(\d{2})/)
  return match ? `${match[1]}:${match[2]}` : value
}

function normalizePassenger(person: RawCrewMember | null | undefined): StopPickupPassenger | null {
  if (!person) {
    return null
  }

  return {
    id: person.id,
    name: person.full_name,
    phone: person.phone,
    address: person.home_address ?? "",
  }
}

function compareDriveStops(first: DriveStop, second: DriveStop) {
  if (first.pickupTimeLabel && second.pickupTimeLabel) {
    return first.pickupTimeLabel.localeCompare(second.pickupTimeLabel)
  }

  if (first.pickupTimeLabel) {
    return -1
  }

  if (second.pickupTimeLabel) {
    return 1
  }

  return first.createdAt.localeCompare(second.createdAt)
}

export function mapTravelToDrive(travel: RawTravel, index = 0): Drive {
  const driver = normalizePassenger(travel.driver)
  const stops =
    travel.trips?.map((trip, stopIndex) => {
      const stopPickupPassengers =
        trip.trip_passengers
          ?.map((entry) => normalizePassenger(entry.crew_members))
          .filter((person): person is StopPickupPassenger => Boolean(person)) ?? []

      return {
        id: trip.id,
        driveId: travel.id,
        stopTitle: trip.trip_title?.trim() || `Stop ${stopIndex + 1}`,
        pickupAddress: trip.pickup_address ?? "",
        pickupTime: trip.pickup_time,
        pickupTimeLabel: formatDatabaseTime(trip.pickup_time),
        stopDurationSec: trip.stop_duration_sec,
        trafficBufferSec: trip.traffic_buffer_sec,
        notes: trip.notes,
        createdAt: trip.created_at,
        stopPickupPassengers,
      }
    }) ?? []

  const label =
    travel.vans?.label?.trim() ||
    (driver?.name ? `${driver.name}'s drive` : `Drive ${index + 1}`)

  return {
    id: travel.id,
    vanId: travel.van_id,
    driverCrewId: travel.driver_crew_id,
    label,
    startLocation: travel.start_location?.trim() || "",
    startTime: travel.start_time,
    startTimeLabel: formatDatabaseTime(travel.start_time),
    destinationAddress: travel.destination_address?.trim() || "",
    notes: travel.notes,
    createdAt: travel.created_at,
    van: travel.vans ?? null,
    driver,
    stops: stops.toSorted(compareDriveStops),
  }
}

export async function getDrivePlan() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("travels")
    .select(`
      *,
      vans (*),
      driver:crew_members!travels_driver_crew_id_fkey (
        id,
        full_name,
        phone,
        home_address
      ),
      trips (
        *,
        trip_passengers (
          crew_members (
            id,
            full_name,
            phone,
            home_address
          )
        )
      )
    `)
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []).map((travel, index) => mapTravelToDrive(travel as RawTravel, index))
}

export async function getStopPickupPassengerOptions() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("crew_members")
    .select("id, full_name, phone, home_address")
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return (
    data?.map((crewMember) => ({
      id: crewMember.id,
      name: crewMember.full_name,
      detail: crewMember.phone?.trim() || "Crew member",
      phone: crewMember.phone?.trim() || null,
      address: crewMember.home_address?.trim() || "",
    })) ?? []
  )
}

export async function getTransportPlan(): Promise<TransportPlan> {
  const [drives, stopPickupPassengerOptions] = await Promise.all([
    getDrivePlan(),
    getStopPickupPassengerOptions(),
  ])

  return {
    drives,
    stopPickupPassengerOptions,
  }
}
