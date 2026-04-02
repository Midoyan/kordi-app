import { type Drive } from "@/lib/drive-plan";
import { getTravelTypeLabel } from "@/lib/travels";

type DashboardRunRow = {
  id: string;
  routeLabel: string;
  routeDetail: string;
  vehicleLabel: string;
  vehicleDetail: string;
  peopleLabel: string;
  peopleDetail: string;
  departureLabel: string;
  departureDetail: string;
  departureSort: number;
  statusLabel: string;
  statusTone: string;
};

function getPrimaryAddressLine(value: string) {
  return value.split(",")[0]?.trim() || value.trim();
}

function getDriveViaLabel(drive: Drive) {
  const viaAddresses = Array.from(
    new Set(
      drive.stops
        .map((stop) => getPrimaryAddressLine(stop.pickupAddress))
        .filter(Boolean),
    ),
  ).slice(0, 2);

  return viaAddresses.length > 0 ? ` via ${viaAddresses.join(", ")}` : "";
}

function getDrivePassengerSummary(drive: Drive) {
  const uniquePassengers = new Map<string, string>();

  for (const stop of drive.stops) {
    for (const passenger of stop.stopPickupPassengers) {
      const key = passenger.id || `${passenger.name}:${passenger.address}`;

      if (!uniquePassengers.has(key)) {
        uniquePassengers.set(key, passenger.name);
      }
    }
  }

  const names = Array.from(uniquePassengers.values());
  const previewNames = names.slice(0, 2).join(", ");
  const remainingCount = names.length - 2;

  return {
    count: names.length,
    detail:
      names.length === 0
        ? drive.driver?.name
          ? `Driver: ${drive.driver.name}`
          : "No riders assigned"
        : remainingCount > 0
          ? `${previewNames} +${remainingCount}`
          : previewNames,
  };
}

function getDriveDepartureMinutes(drive: Drive) {
  const timeLabel = drive.scheduledTimeLabel || drive.stops[0]?.pickupTimeLabel || "";
  const match = timeLabel.match(/^(\d{2}):(\d{2})$/);

  if (!match) {
    return Number.POSITIVE_INFINITY;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function getDashboardStatus(drive: Drive, passengerCount: number) {
  if (!drive.location && drive.stops.length === 0 && !drive.van && !drive.scheduledTimeLabel) {
    return {
      label: "Draft",
      tone: "border-[#d7d7d2] bg-[#f3f3ef] text-[#6b6b67]",
      rank: 0,
    };
  }

  if (!drive.van) {
    return {
      label: "Needs vehicle",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      rank: 1,
    };
  }

  if (drive.travelType === "pickup" && !drive.scheduledTimeLabel) {
    return {
      label: "Needs arrival",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      rank: 2,
    };
  }

  if (drive.stops.length === 0) {
    return {
      label: "Needs stops",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      rank: 3,
    };
  }

  if (passengerCount === 0) {
    return {
      label: "Needs people",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      rank: 4,
    };
  }

  return {
    label: "Ready",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rank: 5,
  };
}

function mapDriveToDashboardRun(drive: Drive): DashboardRunRow {
  const passengerSummary = getDrivePassengerSummary(drive);
  const status = getDashboardStatus(drive, passengerSummary.count);
  const travelTypeLabel = getTravelTypeLabel(drive.travelType);
  const setLocationLabel = getPrimaryAddressLine(
    drive.location?.name || drive.location?.address || drive.destinationAddress || drive.startLocation,
  );
  const viaLabel = getDriveViaLabel(drive);
  const routeDetail =
    drive.stops.length === 0
      ? `No ${drive.travelType} stops yet`
      : `${drive.stops.length} ${drive.travelType} stop${drive.stops.length === 1 ? "" : "s"}${viaLabel}`;
  const routeLabel =
    setLocationLabel
      ? drive.travelType === "pickup"
        ? `Pickup to ${setLocationLabel}`
        : `Dropoff from ${setLocationLabel}`
      : drive.label;
  const vehicleLabel = drive.van?.label?.trim() || drive.van?.plate_number?.trim() || "Unassigned";
  const vehicleDetail = drive.van
    ? [drive.van.vehicle_type?.trim(), `${travelTypeLabel} drive`]
        .filter(Boolean)
        .join(" / ") || "Vehicle assigned"
    : "Assign a vehicle";
  const departureLabel = drive.scheduledTimeLabel || drive.stops[0]?.pickupTimeLabel || "Not set";
  const departureDetail = drive.scheduledTimeLabel
    ? drive.travelType === "pickup"
      ? "Arrive by set call time"
      : setLocationLabel
        ? `Depart from ${setLocationLabel}`
        : "Wrap departure"
    : drive.stops[0]?.pickupTimeLabel
      ? `First ${drive.travelType} stop`
      : drive.travelType === "pickup"
        ? "Add arrival time"
        : "Add departure time";

  return {
    id: drive.id,
    routeLabel,
    routeDetail,
    vehicleLabel,
    vehicleDetail,
    peopleLabel: `${passengerSummary.count} rider${passengerSummary.count === 1 ? "" : "s"}`,
    peopleDetail: passengerSummary.detail,
    departureLabel,
    departureDetail,
    departureSort: getDriveDepartureMinutes(drive),
    statusLabel: status.label,
    statusTone: status.tone,
  };
}

export function DashboardUpcomingRunsTable({ drives }: { drives: Drive[] }) {
  const rows = drives
    .map(mapDriveToDashboardRun)
    .sort((first, second) => first.departureSort - second.departureSort);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[#ecece8] bg-[#fafaf7] px-4 py-14 text-center">
        <p className="text-[14px] font-medium text-[#1d1d1b]">No runs have been created yet.</p>
        <p className="mt-1 text-[13px] text-[#6b6b67]">
          Create the first route to start building upcoming dispatches.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#ecece8]">
      <table className="min-w-[920px] table-fixed">
        <thead className="bg-[#f7f7f4]">
          <tr className="border-b border-[#ecece8] text-left text-[11px] font-semibold tracking-[0.14em] text-[#777772] uppercase">
            <th className="w-[28%] px-3 py-3">Route</th>
            <th className="w-[24%] px-3 py-3">Vehicle</th>
            <th className="w-[18%] px-3 py-3">People</th>
            <th className="w-[14%] px-3 py-3">Departure</th>
            <th className="w-[16%] px-3 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-[#f0f0ec] last:border-b-0">
              <td className="px-3 py-4 align-top">
                <p className="truncate text-[14px] font-medium text-[#1d1d1b]">{row.routeLabel}</p>
                <p className="mt-1 text-[12px] text-[#6b6b67]">{row.routeDetail}</p>
              </td>
              <td className="px-3 py-4 align-top">
                <p className="truncate text-[14px] font-medium text-[#1d1d1b]">{row.vehicleLabel}</p>
                <p className="mt-1 truncate text-[12px] text-[#6b6b67]">{row.vehicleDetail}</p>
              </td>
              <td className="px-3 py-4 align-top">
                <p className="text-[14px] font-medium text-[#1d1d1b]">{row.peopleLabel}</p>
                <p className="mt-1 truncate text-[12px] text-[#6b6b67]">{row.peopleDetail}</p>
              </td>
              <td className="px-3 py-4 align-top">
                <p className="text-[14px] font-medium text-[#1d1d1b]">{row.departureLabel}</p>
                <p className="mt-1 truncate text-[12px] text-[#6b6b67]">{row.departureDetail}</p>
              </td>
              <td className="px-3 py-4 align-top">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-medium ${row.statusTone}`}
                >
                  {row.statusLabel}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
