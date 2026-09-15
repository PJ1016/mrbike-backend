/**
 * Registration plates arrive from the app exactly as the rider typed them —
 * "TS05EN5464", "ts05 en 5464" and "TS-05-EN-5464" are all the same bike, but
 * stored raw they are three different strings to both the duplicate check and
 * the unique index.
 *
 * Normalizing on write keeps new records consistent. Existing rows are left
 * untouched, so anything comparing against stored plates should normalize both
 * sides rather than assume the database value is already clean.
 */
const normalizePlateNumber = (plate) =>
  typeof plate === "string" ? plate.trim().toUpperCase().replace(/[\s-]+/g, "") : "";

module.exports = { normalizePlateNumber };
