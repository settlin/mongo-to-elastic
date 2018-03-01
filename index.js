console.log('\n\n\n=============');
console.log('=============');
console.log(new Date());
console.log('=============');
console.log('=============');
const config = process.argv[2];
const resync = process.argv[3] === 'resync';
if (!config) {
	console.error('Please give a config js file');
	return;
}

const camelCaseToDash = str => str.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase();
const requireFile = file => {
	try {
		return require(file.indexOf('/') === 0 ? file : './' + file);
	}
	catch (e) {
		console.error(e);
	}
	return {};
};

const {MongoClient} = require('mongodb');
const elasticsearch = require('elasticsearch');
const {mongo, es} = requireFile(config);
if (!mongo || !es) {
	console.error('Please give a valid config js file');
	return;
}

const esIndex = es.syncDataIndex || 'm2e-synced-till';


const deleteId = ({...v}) => {
	delete v._id;
	delete v.version;
	return v;
};

const transform = ({...doc}) => {
	Object.keys(doc).forEach(function(k) {
		if (k.indexOf('_') === 0) {
			let newK = k.substr(1), c = 1;
			while (doc[newK]) newK = newK + '_' + c++;
			doc[newK] = doc[k];
			delete doc[k];
		}
	});
	return doc;
};

let cnt = 1, collectionIndExists = false;
async function sync(db, ec, collection) {
	const c = collection, cKey = c.createdAtKey || 'createdAt', index = camelCaseToDash(c.index || c.name), type = c.type || c.name;

	// check if collection exists in elastic - only first time. If it does not exist, we will not do any update operations
	if (cnt === 1) collectionIndExists = await ec.indices.exists({index});

	const statusDocExists = await ec.indices.exists({index: esIndex}) && await ec.exists({index: esIndex, type: esIndex, id: c.name});
	let statusDoc = statusDocExists ? await ec.get({index: esIndex, type: esIndex, id: c.name}) : null;
	let till = statusDoc ? statusDoc._source : {};

	// new docs
	let query = cnt === 1 && resync ? {} : till.createdAt ? {[cKey]: {$gt: new Date(till.createdAt)}} : {};
	let docs = await db.collection(c.name).find(query).limit(mongo.limit || 1000).toArray();
	console.debug('query', query);
	console.debug('number of docs', docs.length);
	if (docs.length) {
		console.log('--------------------');
		console.log('Fetching ' + c.name + '. Iteration: ' + cnt + '. Docs: ' + docs.length);
		const body = docs.reduce((x, d) => ([...x, {create: {_id: d._id}}, {...(c.transform || transform)(deleteId(d))}]), []);
		const createdAt = body[body.length - 1][cKey];
		console.debug('bulk insert');
		await ec.bulk({index, type: 't', body});
		console.debug('update timestamp in the elastic\'s syncDataIndex');
		await ec.update({index: esIndex, type: esIndex, id: c.name, body: {
			script: {
				inline: 'ctx._source.createdAt = params.createdAt; if (!params.collectionIndExists) ctx._source.updatedAt = params.createdAt',
				params: {createdAt, collectionIndExists}
			},
			upsert: {createdAt, updatedAt: createdAt}
		}});
		if (createdAt < new Date()) {
			cnt++;
			console.debug('.... more data');
			await sync(db, ec, collection);
			return;
		}
	}
	else cnt = 1;

	// updated docs
	if (!statusDocExists) return;
	console.debug('..... Updating');
	cnt = 1;
	const uKey = c.updatedAtKey || 'updatedAt';
	statusDoc = await ec.get({index: esIndex, type: esIndex, id: c.name});
	till = statusDoc._source;

	query = till.updatedAt ? {[uKey]: {$gt: new Date(till.updatedAt)}} : {};
	docs = await db.collection(c.name).find(query).limit(mongo.limit || 1000).toArray();
	console.debug('query', query);
	console.debug('number of docs', docs.length);
	if (docs.length) {
		console.log('Updating ' + c.name + '. Iteration: ' + cnt + '. Docs: ' + docs.length);
		const body = docs.reduce((x, d) => ([...x, {update: {_id: d._id}}, {doc: deleteId((c.transform || transform)(d))}]), []);
		const updatedAt = docs[docs.length - 1][uKey];
		console.debug('bulk insert');
		await ec.bulk({index, type, body});
		console.debug('update timestamp in the elastic\'s syncDataIndex');
		await ec.update({index: esIndex, type: esIndex, id: c.name, body: {
			script: {
				inline: 'ctx._source.updatedAt = params.updatedAt',
				params: {updatedAt}
			}
		}});
		if (updatedAt < new Date()) await sync(db, ec, collection, cnt++);
	}
	else cnt = 1;
}

async function main() {
	const mc = (await MongoClient.connect(mongo.url)), ec = new elasticsearch.Client({host: 'localhost:9200', requestTimeout: 180000});
	const db = mc.db(mongo.db);
	for (let i = 0; i < mongo.collections.length; i++) {
		const c = mongo.collections[i];
		try {
			await sync(db, ec, c);
		}
		catch (e) {
			console.error(e);
		}
	}
	console.log('Finished!');
	mc.close();
}

main();
