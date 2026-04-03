import { Document, Page, Text, View, Table, Row, Cell } from '@formepdf/react';
import type { Drive } from '@/lib/drive-plan';

type TransportationScheduleRow = {
    time: string;
    driver: string;
    passengers: string;
    pickup: string;
    destination: string;
    arrival: string;
};

type CallSheetProps = {
    drives?: Drive[];
};

function formatIsoDate(date: Date) {
    return date.toISOString().slice(0, 10);
}

function getDayOfWeekFromIsoDate(isoDate: string) {
    const [year, month, day] = isoDate.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

function extractIsoDate(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
}

function buildTransportationSchedule(drives: Drive[]): TransportationScheduleRow[] {
    return drives.flatMap((drive) => {
        const driver = drive.van?.label?.trim() || drive.van?.plate_number?.trim() || '-';
        const destination = drive.destinationAddress || drive.location?.address || '-';

        if (!drive.stops.length) {
            return [
                {
                    time: drive.scheduledTimeLabel || '-',
                    driver,
                    passengers: '-',
                    pickup: drive.startLocation || '-',
                    destination,
                    arrival: drive.startTimeLabel || '-',
                },
            ];
        }

        return drive.stops.map((stop) => {
            const passengers = stop.stopPickupPassengers.map((person) => person.name).join(', ') || '-';

            return {
                time: stop.pickupTimeLabel || drive.scheduledTimeLabel || '-',
                driver,
                passengers,
                pickup: stop.pickupAddress || '-',
                destination,
                arrival: drive.startTimeLabel || '-',
            };
        });
    });
}

export function CallSheet({ drives = [] }: CallSheetProps) {
    const todayIsoDate = formatIsoDate(new Date());
    const firstScheduledDate = drives
        .map((drive) => extractIsoDate(drive.scheduledTime))
        .find((value): value is string => Boolean(value));
    const shootDate = firstScheduledDate || todayIsoDate;
    const transportationDate = shootDate;
    const dayOfWeek = getDayOfWeekFromIsoDate(shootDate);

    const data = {
        clientInitial: 'AC',
        clientName: 'Acme Corp',
        productionCompany: 'Skyline Productions',
        agencyMake: 'Creative Agency',
        houseOfCommunication: 'Global Communications',
        client: 'Acme Corp',
        agency: 'Creative Agency',
        director: 'Jane Doe',
        dop: 'John Smith',
        shootNumber: '001',
        projectCode: 'ACME-001',
        companyName: 'Skyline Productions',
        address1: '123 Main St',
        address2: 'Los Angeles, CA 90001',
        dayOfWeek,
        shootDate,
        shootDay: '1',
        transportationDate,
        transportationSchedule: buildTransportationSchedule(drives),
    };

    const transportationSchedule = data.transportationSchedule || [];

    return (
        <Document title={`Call Sheet - ${data.shootDate}`}>
            <Page size="Letter" margin={48}>
                {/* Header */}
                {/* <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e293b', marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>{data.clientInitial}</Text>
                        </View>
                        <Text style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>{data.clientName}</Text>
                    </View>

                    <Text style={{ fontSize: 32, fontWeight: 700, color: '#1e293b', letterSpacing: 2 }}>{data.productionCompany}</Text>

                    <View style={{ alignItems: 'flex-end' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>{data.agencyMake}</Text>
                            <View style={{ width: 16, height: 16, backgroundColor: '#1e293b', marginLeft: 8 }}></View>
                        </View>
                        <Text style={{ fontSize: 8, color: '#64748b', marginTop: 2 }}>{data.houseOfCommunication}</Text>
                    </View>
                </View> */}

                {/* Client Info */}
                {/* <View style={{ flexDirection: 'row', marginBottom: 24 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 9, color: '#64748b' }}>Client: {data.client}</Text>
                        <Text style={{ fontSize: 9, color: '#64748b' }}>Agency: {data.agency}</Text>
                        <Text style={{ fontSize: 9, color: '#64748b' }}>Director: {data.director}</Text>
                        <Text style={{ fontSize: 9, color: '#64748b' }}>DoP: {data.dop}</Text>
                    </View>

                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 10, fontWeight: 700, color: '#1e293b' }}># {data.shootNumber}</Text>
                        <View style={{ backgroundColor: '#1e293b', paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 }}>
                            <Text style={{ fontSize: 8, color: '#ffffff' }}>{data.projectCode}</Text>
                        </View>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 10, fontWeight: 700, color: '#1e293b' }}>{data.companyName}</Text>
                        <Text style={{ fontSize: 9, color: '#64748b' }}>{data.address1}</Text>
                        <Text style={{ fontSize: 9, color: '#64748b' }}>{data.address2}</Text>
                    </View>
                </View> */}

                {/* Date Header */}
                <View style={{ backgroundColor: '#1e293b', padding: 16, marginBottom: 16 }}>
                    <Text style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', textAlign: 'center' }}>
                        {data.dayOfWeek}
                    </Text>
                    <Text style={{ fontSize: 14, color: '#ffffff', textAlign: 'center', marginTop: 2 }}>
                        {data.shootDate}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#ffffff', textAlign: 'center', marginTop: 8 }}>
                        SHOOT DAY {data.shootDay}
                    </Text>
                </View>

                {/* Transportation Schedule */}
                <View style={{ marginBottom: 24 }}>
                    <View style={{ backgroundColor: '#1e293b', padding: 8, marginBottom: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: 700, color: '#ffffff' }}>
                            TRANSPORTATION {data.transportationDate}
                        </Text>
                    </View>

                    <Table columns={[
                        { width: { fraction: 0.08 } },
                        { width: { fraction: 0.15 } },
                        { width: { fraction: 0.15 } },
                        { width: { fraction: 0.32 } },
                        { width: { fraction: 0.22 } },
                        { width: { fraction: 0.08 } }
                    ]}>
                        <Row header style={{ backgroundColor: '#f1f5f9' }}>
                            <Cell style={{ padding: 4 }}><Text style={{ fontSize: 8, fontWeight: 700, color: '#1e293b' }}>Time</Text></Cell>
                            <Cell style={{ padding: 4 }}><Text style={{ fontSize: 8, fontWeight: 700, color: '#1e293b' }}>Driver</Text></Cell>
                            <Cell style={{ padding: 4 }}><Text style={{ fontSize: 8, fontWeight: 700, color: '#1e293b' }}>Passengers</Text></Cell>
                            <Cell style={{ padding: 4 }}><Text style={{ fontSize: 8, fontWeight: 700, color: '#1e293b' }}>Pickup Location</Text></Cell>
                            <Cell style={{ padding: 4 }}><Text style={{ fontSize: 8, fontWeight: 700, color: '#1e293b' }}>Destination</Text></Cell>
                            <Cell style={{ padding: 4 }}><Text style={{ fontSize: 8, fontWeight: 700, color: '#1e293b' }}>Arrival Time</Text></Cell>
                        </Row>

                        {transportationSchedule.map((trip, i) => (
                            <Row key={i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                <Cell style={{ padding: 4 }}><Text style={{ fontSize: 8, color: '#1e293b' }}>{trip.time}</Text></Cell>
                                <Cell style={{ padding: 4 }}><Text style={{ fontSize: 8, color: '#1e293b' }}>{trip.driver}</Text></Cell>
                                <Cell style={{ padding: 4 }}><Text style={{ fontSize: 8, color: '#1e293b' }}>{trip.passengers}</Text></Cell>
                                <Cell style={{ padding: 4 }}><Text style={{ fontSize: 8, color: '#1e293b' }}>{trip.pickup}</Text></Cell>
                                <Cell style={{ padding: 4 }}><Text style={{ fontSize: 8, color: '#1e293b' }}>{trip.destination}</Text></Cell>
                                <Cell style={{ padding: 4 }}><Text style={{ fontSize: 8, color: '#1e293b' }}>{trip.arrival}</Text></Cell>
                            </Row>
                        ))}
                    </Table>
                </View>
            </Page>
        </Document>
    );
}
