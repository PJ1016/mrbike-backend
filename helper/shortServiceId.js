const mongoose = require("mongoose")

/**
 * Generates the next `<prefix>-NNN` short id for a collection.
 *
 * The obvious implementation — findOne().sort({ serviceId: -1 }) — sorts
 * LEXICOGRAPHICALLY, so once the collection passes 999 rows "MKBDSVC-999"
 * still sorts above "MKBDSVC-1000" and every subsequent insert regenerates
 * "-1000" and dies on the unique index with E11000. Take the max numerically
 * instead, and let the caller retry so two concurrent saves don't collide.
 */
async function nextShortId(model, prefix) {
  const regex = new RegExp(`^${prefix}-(\\d+)$`)

  const [top] = await model
    .aggregate([
      { $match: { serviceId: { $regex: regex } } },
      {
        $project: {
          n: {
            $toLong: {
              $arrayElemAt: [{ $split: ["$serviceId", "-"] }, 1],
            },
          },
        },
      },
      { $sort: { n: -1 } },
      { $limit: 1 },
    ])
    .exec()

  const maxNumber = Number.isFinite(top?.n) ? top.n : 0
  return `${prefix}-${String(maxNumber + 1).padStart(3, "0")}`
}

module.exports = { nextShortId }
