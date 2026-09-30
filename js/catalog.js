// Curated demo catalogue: real places in India with coordinates of the feature itself.
// Every site is indexed by CLIP at a few years; any other place can still be reached by place search.
export const SITES = [
  // Infrastructure and construction
  { id: "jewar", name: "Noida International Airport", place: "Jewar", state: "Uttar Pradesh", lat: 28.1812, lon: 77.5947, z: 13.6, cat: "infra",
    tags: ["airport", "construction", "clearance"], story: "Farmland cleared for a greenfield airport; runway visible from 2023.", before: 2019, after: 2025, beta: true },
  { id: "navimumbai", name: "Navi Mumbai International Airport", place: "Ulwe, Navi Mumbai", state: "Maharashtra", lat: 18.987, lon: 73.067, z: 13.4, cat: "infra",
    tags: ["airport", "land reclamation", "construction"], story: "Hills levelled and wetland filled for a new airport.", before: 2017, after: 2025 },
  { id: "mopa", name: "Manohar International Airport", place: "Mopa", state: "Goa", lat: 15.733, lon: 73.867, z: 13.5, cat: "infra",
    tags: ["airport", "plateau clearing"], story: "Laterite plateau turned into a runway and terminal (opened 2022).", before: 2017, after: 2024 },
  { id: "atalsetu", name: "Atal Setu sea bridge", place: "Mumbai harbour", state: "Maharashtra", lat: 18.962, lon: 72.93, z: 12.6, cat: "infra",
    tags: ["bridge", "sea link", "construction"], story: "India's longest sea bridge crosses the harbour (opened 2024).", before: 2017, after: 2024 },
  { id: "vizhinjam", name: "Vizhinjam International Seaport", place: "Vizhinjam", state: "Kerala", lat: 8.374, lon: 76.99, z: 14, cat: "infra",
    tags: ["port", "breakwater", "coast"], story: "A deep water port and breakwater built into the sea.", before: 2017, after: 2025 },
  { id: "mundra", name: "Mundra Port", place: "Mundra", state: "Gujarat", lat: 22.74, lon: 69.71, z: 12.8, cat: "infra",
    tags: ["port", "docks", "industrial"], story: "India's largest private port and its growing industrial zone.", before: 2016, after: 2025 },
  // Energy
  { id: "bhadla", name: "Bhadla Solar Park", place: "Bhadla", state: "Rajasthan", lat: 27.539, lon: 71.915, z: 12.6, cat: "energy",
    tags: ["solar park", "desert"], story: "One of the world's largest solar parks, grown out of open desert.", before: 2016, after: 2023 },
  { id: "pavagada", name: "Pavagada Solar Park", place: "Pavagada", state: "Karnataka", lat: 14.252, lon: 77.448, z: 12.6, cat: "energy",
    tags: ["solar park", "dry land"], story: "Solar arrays spread over rocky farmland (2016 to 2019).", before: 2016, after: 2022 },
  { id: "polavaram", name: "Polavaram Project", place: "Polavaram", state: "Andhra Pradesh", lat: 17.256, lon: 81.648, z: 13, cat: "water",
    tags: ["dam", "river", "spillway"], story: "A spillway and dam rising across the Godavari.", before: 2016, after: 2024 },
  { id: "tehri", name: "Tehri Dam and reservoir", place: "Tehri", state: "Uttarakhand", lat: 30.378, lon: 78.48, z: 12.8, cat: "water",
    tags: ["dam", "reservoir", "mountains"], story: "A high rock-fill dam holding back the Bhagirathi.", before: 2017, after: 2024 },
  { id: "sardarsarovar", name: "Sardar Sarovar Dam", place: "Kevadia", state: "Gujarat", lat: 21.83, lon: 73.747, z: 12.8, cat: "water",
    tags: ["dam", "reservoir", "river"], story: "Narmada dam; the Statue of Unity sits just downstream.", before: 2016, after: 2023 },
  // Water and wetlands
  { id: "chilika", name: "Chilika Lake", place: "Chilika", state: "Odisha", lat: 19.72, lon: 85.32, z: 11, cat: "water",
    tags: ["lagoon", "lake", "wetland"], story: "Asia's largest brackish water lagoon.", before: 2017, after: 2025 },
  { id: "sundarbans", name: "Sundarbans mangroves", place: "Sundarbans", state: "West Bengal", lat: 21.95, lon: 88.9, z: 11.5, cat: "veg",
    tags: ["mangrove", "delta", "forest", "tidal creeks"], story: "The largest mangrove forest on Earth, cut by tidal creeks.", before: 2017, after: 2025 },
  { id: "brahmaputra", name: "Brahmaputra at Guwahati", place: "Guwahati", state: "Assam", lat: 26.19, lon: 91.73, z: 12, cat: "water",
    tags: ["river", "sand bars", "city"], story: "A braided river with shifting sand bars.", before: 2017, after: 2025 },
  { id: "dal", name: "Dal Lake", place: "Srinagar", state: "Jammu and Kashmir", lat: 34.11, lon: 74.87, z: 12.6, cat: "water",
    tags: ["lake", "floating gardens", "city"], story: "An urban lake with floating gardens and houseboats.", before: 2017, after: 2025 },
  { id: "rann", name: "Great Rann of Kutch", place: "Kutch", state: "Gujarat", lat: 23.95, lon: 70.3, z: 10.5, cat: "terrain",
    tags: ["salt flat", "desert", "white"], story: "A vast seasonal salt marsh, white in the dry season.", before: 2017, after: 2025 },
  // Vegetation and land
  { id: "kaziranga", name: "Kaziranga National Park", place: "Kaziranga", state: "Assam", lat: 26.66, lon: 93.35, z: 11.5, cat: "veg",
    tags: ["grassland", "wetland", "forest", "floodplain"], story: "Floodplain grassland home to the one-horned rhino.", before: 2017, after: 2025 },
  { id: "silentvalley", name: "Silent Valley", place: "Palakkad", state: "Kerala", lat: 11.08, lon: 76.44, z: 12, cat: "veg",
    tags: ["dense forest", "hills", "rainforest"], story: "Undisturbed tropical evergreen forest.", before: 2017, after: 2025 },
  { id: "ludhiana", name: "Punjab farmland", place: "Ludhiana", state: "Punjab", lat: 30.95, lon: 75.72, z: 12.8, cat: "veg",
    tags: ["farmland", "crop fields", "agriculture"], story: "Intensive wheat and rice fields in a regular field grid.", before: 2017, after: 2025 },
  { id: "jaisalmer", name: "Thar desert dunes", place: "Sam, Jaisalmer", state: "Rajasthan", lat: 26.84, lon: 70.52, z: 12.4, cat: "terrain",
    tags: ["sand dunes", "desert"], story: "Wind-shaped sand dunes of the Thar.", before: 2017, after: 2025 },
  { id: "gangotri", name: "Gangotri Glacier", place: "Gaumukh", state: "Uttarakhand", lat: 30.925, lon: 79.08, z: 12, cat: "terrain",
    tags: ["glacier", "snow", "mountains"], story: "Source of the Ganga; a retreating Himalayan glacier.", before: 2017, after: 2025 },
  { id: "jharia", name: "Jharia coalfield", place: "Jharia, Dhanbad", state: "Jharkhand", lat: 23.75, lon: 86.42, z: 12.6, cat: "terrain",
    tags: ["open-cast mine", "coal", "mining"], story: "Open-cast coal mines expanding around the town.", before: 2016, after: 2025 },
  // Cities
  { id: "delhi", name: "New Delhi", place: "Central Delhi", state: "Delhi", lat: 28.62, lon: 77.21, z: 12, cat: "urban",
    tags: ["dense city", "urban", "roads"], story: "Dense city blocks around Lutyens' Delhi.", before: 2017, after: 2025 },
  { id: "bengaluru", name: "Bengaluru", place: "Bengaluru", state: "Karnataka", lat: 12.97, lon: 77.59, z: 12, cat: "urban",
    tags: ["dense city", "urban", "lakes"], story: "A fast growing city of lakes and tech parks.", before: 2017, after: 2025 },
  { id: "kolkata", name: "Kolkata and the Hooghly", place: "Kolkata", state: "West Bengal", lat: 22.575, lon: 88.345, z: 12.4, cat: "urban",
    tags: ["dense city", "river", "bridges"], story: "Twin cities across the Hooghly river.", before: 2017, after: 2025 },
];

export const CAT = {
  infra:   { label: "Infrastructure", color: "#F28C28" },
  energy:  { label: "Energy",         color: "#8064A2" },
  water:   { label: "Water",          color: "#4F81BD" },
  veg:     { label: "Vegetation",     color: "#2E9E57" },
  terrain: { label: "Terrain",        color: "#A0764B" },
  urban:   { label: "Urban",          color: "#1F497D" },
};

// Zero-shot vocabulary used for "Explain" and for naming discovery clusters.
export const VOCAB = [
  "an airport with runways", "a solar power plant with rows of panels", "farmland with crop fields", "a dense city",
  "a dense green forest", "a lake or reservoir", "a river with sand bars", "a desert with sand dunes",
  "snow and glaciers on mountains", "mangrove wetlands and tidal creeks", "a port with docks and ships", "an open-cast mine",
  "a bridge over the sea", "a dam across a river", "a white salt flat", "bare cleared land and construction",
];
export const VOCAB_SHORT = [
  "Airport", "Solar park", "Farmland", "Dense city", "Forest", "Lake / reservoir", "River", "Desert dunes",
  "Snow / glacier", "Mangrove wetland", "Port", "Open-cast mine", "Sea bridge", "Dam", "Salt flat", "Cleared land",
];

// Suggested demo queries shown under the search bar.
export const EXAMPLES = [
  { q: "solar park in Rajasthan", hint: "text" },
  { q: "new airport built between 2018 and 2024", hint: "semantic change" },
  { q: "mangrove forest with tidal creeks", hint: "text" },
  { q: "snow covered glacier", hint: "text" },
];

export const STATES = [...new Set(SITES.map(s => s.state))];

// Samples for image search that are NOT in the catalogue (the query should find look-alikes).
export const SAMPLE_PLACES = [
  { name: "Kurnool Ultra Mega Solar Park", lat: 15.682, lon: 78.283, z: 13, expect: "Bhadla, Pavagada" },
  { name: "Kempegowda Airport, Bengaluru", lat: 13.1986, lon: 77.7066, z: 13.4, expect: "Mopa, Navi Mumbai, Jewar" },
  { name: "Bhitarkanika mangroves", lat: 20.72, lon: 86.9, z: 12, expect: "Sundarbans" },
];
