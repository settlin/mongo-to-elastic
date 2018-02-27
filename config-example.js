module.exports = {
	mongo: {
		url: 'mongodb://localhost',
		db: 'dbname',
		limit: 5000, // number of documents to bulk insert - default is 1000
		collections: [
			{
				name: 'collectionName', // requiredKey
				index: 'indexName', // index name to map above collection to. If not present, hyphenated case of the collection name is used.
				createdAtKey: 'date', // defualt createdAt
				updatedAtKey: 'date2', // defualt updatedAt
				transform: function(doc) { return doc; }, // default: removed underscore from fieldName: eg, _id => id, _version => version_1 (if 'version' exists already)
			},
		]
	},
	es: {
		url: 'http://localhost:9200',
		syncDataIndex: 'm2e-meta' // default 'm2e-synced-till' - index in which sync data is to be stored
	},
	debug: false
};
