function attachCollectionStats(items, stats = {}) {
  Object.defineProperty(items, 'collectionStats', {
    value: {
      pagesFetched: 0,
      listingItems: 0,
      detailRequests: 0,
      mapped: items.length,
      rejected: 0,
      duplicates: 0,
      stopReason: null,
      ...stats,
    },
    enumerable: false,
  });
  return items;
}

module.exports = { attachCollectionStats };
