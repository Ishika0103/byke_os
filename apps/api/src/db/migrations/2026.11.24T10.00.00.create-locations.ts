import type { Migration } from '../migrator';

const ACTIVE_ONLY = { isDeleted: false };

/** Plan 08: Byke's locations (own copy of the list; states added by us). bykeId = Byke's own id. */
const SEED: { name: string; state: string; bykeId: number | null }[] = [
  { name: 'Mahabaleshwar', state: 'Maharashtra', bykeId: 1 },
  { name: 'Bengaluru', state: 'Karnataka', bykeId: 2 },
  { name: 'Jaipur', state: 'Rajasthan', bykeId: 5 },
  { name: 'Junagadh', state: 'Gujarat', bykeId: 6 },
  { name: 'Kovalam', state: 'Kerala', bykeId: 7 },
  { name: 'Matheran', state: 'Maharashtra', bykeId: 9 },
  { name: 'Mumbai', state: 'Maharashtra', bykeId: 10 },
  { name: 'Ooty', state: 'Tamil Nadu', bykeId: 11 },
  { name: 'Thane', state: 'Maharashtra', bykeId: 13 },
  { name: 'Indore', state: 'Madhya Pradesh', bykeId: 14 },
  { name: 'Ujjain', state: 'Madhya Pradesh', bykeId: 18 },
  { name: 'Gurugram', state: 'Haryana', bykeId: 19 },
  { name: 'Palghar', state: 'Maharashtra', bykeId: 20 },
  { name: 'Bhopal', state: 'Madhya Pradesh', bykeId: 21 },
  { name: 'Osian', state: 'Rajasthan', bykeId: 22 },
  { name: 'Nashik', state: 'Maharashtra', bykeId: 23 },
  { name: 'Surat', state: 'Gujarat', bykeId: 24 },
  { name: 'Kumbhalgarh', state: 'Rajasthan', bykeId: 26 },
  { name: 'North Goa', state: 'Goa', bykeId: 28 },
  { name: 'South Goa', state: 'Goa', bykeId: 28 },
  { name: 'Borivali', state: 'Maharashtra', bykeId: null },
];

const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const base = (now: Date) => ({
  isActive: true,
  isDeleted: false,
  createdBy: null,
  updatedBy: null,
  createdAt: now,
  updatedAt: now,
});

export const up: Migration = async ({ context: { db } }) => {
  const locations = db.collection('locations');
  await locations.createIndex(
    { name: 1 },
    {
      name: 'name_unique_ci',
      unique: true,
      partialFilterExpression: ACTIVE_ONLY,
      collation: { locale: 'en', strength: 2 },
    },
  );
  await locations.createIndex(
    { slug: 1 },
    { name: 'slug_unique', unique: true, partialFilterExpression: ACTIVE_ONLY },
  );

  const now = new Date();
  for (const l of SEED) {
    const slug = slugOf(l.name);
    await locations.updateOne(
      { slug, isDeleted: false },
      { $setOnInsert: { name: l.name, state: l.state, slug, bykeId: l.bykeId, ...base(now) } },
      { upsert: true },
    );
  }

  // Existing hotels: point them at the location with their old city, adding it if it's new.
  const hotels = db.collection('hotels');
  const old = await hotels
    .find({ location: { $exists: true }, locationId: { $exists: false } })
    .toArray();
  for (const h of old) {
    const { city, state } = h.location as { city: string; state: string };
    const slug = slugOf(city);
    await locations.updateOne(
      { slug, isDeleted: false },
      { $setOnInsert: { name: city, state, slug, bykeId: null, ...base(now) } },
      { upsert: true },
    );
    const found = await locations.findOne({ slug, isDeleted: false });
    await hotels.updateOne(
      { _id: h._id },
      { $set: { locationId: found!._id }, $unset: { location: '' } },
    );
  }
  await hotels.dropIndex('location_city').catch(() => undefined);
  await hotels.createIndex({ locationId: 1 }, { name: 'locationId_1' });
};

export const down: Migration = async ({ context: { db } }) => {
  const locations = db.collection('locations');
  const hotels = db.collection('hotels');
  for (const h of await hotels.find({ locationId: { $exists: true } }).toArray()) {
    const l = await locations.findOne({ _id: h.locationId });
    await hotels.updateOne(
      { _id: h._id },
      {
        $set: { location: { city: l?.name ?? 'Unknown', state: l?.state ?? 'Unknown' } },
        $unset: { locationId: '' },
      },
    );
  }
  await hotels.dropIndex('locationId_1').catch(() => undefined);
  await hotels.createIndex({ 'location.city': 1 }, { name: 'location_city' });
  await locations.drop();
};
