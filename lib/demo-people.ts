export type DemoPerson = {
  id: string;
  name: string;
  role: string;
  address: string;
};

// Replace this with real People records once that source is available to Vehicles.
export const demoPeople: DemoPerson[] = [
  {
    id: "maya-bennett",
    name: "Maya Bennett",
    role: "Lead vocalist",
    address: "145 Spring St, Nashville, TN",
  },
  {
    id: "liam-ortega",
    name: "Liam Ortega",
    role: "Production manager",
    address: "48 W 29th St, New York, NY",
  },
  {
    id: "sofia-nguyen",
    name: "Sofia Nguyen",
    role: "Wardrobe",
    address: "88 Euclid Ave, Los Angeles, CA",
  },
  {
    id: "jonah-cruz",
    name: "Jonah Cruz",
    role: "Merch lead",
    address: "311 Rose Ave, Venice, CA",
  },
  {
    id: "camila-rhodes",
    name: "Camila Rhodes",
    role: "Backline",
    address: "17 Prince St, New York, NY"
  },
  {
    id: "ava-coleman",
    name: "Ava Coleman",
    role: "Guest coordinator",
    address: "1200 W Olympic Blvd, Los Angeles, CA"
  },
];
