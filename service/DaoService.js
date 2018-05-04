const stitch = require("mongodb-stitch");
const clientPromise = stitch.StitchClientFactory.create('cryptobot-qlsmw');
var MongoClient = require('mongodb').MongoClient;

var uri = "urlmongodb_stitch";
var DaoService = function() {
	return {
		insertStoplossCoin: function(pair, buyPrice, amount, percent, orderId) {
			
			return new Promise(resolve => {
				clientPromise.then(client => {
					const db = client.service('mongodb', 'mongodb-atlas').db('cryptobot');
					client.login().then(() =>
						db.collection('STOP_LOSS_COIN').insertOne({pair: pair,buy_price: buyPrice,amount: amount,percent: percent,order_id: orderId})
						.then(result => {
							console.log('Inserted', result);
							let status = result.insertedId != null ? true : false;
							resolve(status);
						})).catch(err => {
						console.error(err);
						resolve(false);
					});
					});
			});
			
			return status;
		},
		updateStoplossCoin: function(oldOrderId, pair, buyPrice, amount, percent, orderId) {
			
			return new Promise(resolve => {
				clientPromise.then(client => {
					const db = client.service('mongodb', 'mongodb-atlas').db('cryptobot');
					client.login().then(() =>
						db.collection('STOP_LOSS_COIN').updateOne({order_id: oldOrderId}, {pair: pair,buy_price: buyPrice,amount: amount,percent: percent,order_id: orderId})
						.then(result => {
							console.log('Updated', result);
							resolve(result.matchedCount);
						})).catch(err => {
						console.error(err);
						resolve(0);
					});
					});
			});
			
		},
		deleteStoplossCoin: function(orderId) {

			return new Promise(resolve => {
				clientPromise.then(client => {
					const db = client.service('mongodb', 'mongodb-atlas').db('cryptobot');
					client.login().then(() =>
						db.collection('STOP_LOSS_COIN').deleteMany({order_id: orderId}).
						then(result  => {
							console.log('Deleteded', result);
							resolve(result.deletedCount);
						})
						).catch(err => {
							console.error(err);
							resolve(0);
						});
					});
			});
		},
		getAllStoplossCoin: function() {
			let returnData = new Map();
			clientPromise.then(client => {
				const db = client.service('mongodb', 'mongodb-atlas').db('cryptobot');
				client.login().then(() => 
					db.collection('STOP_LOSS_COIN').find().execute())
				.then(docs => {
					if(docs.length != 0) {
						docs.forEach((item, index) => {
							returnData.set(item.pair, {percentStopLoss:item.percent, buyPrice: item.buy_price, orderId:  item.order_id, amount: item.amount});
						});
					}
				}).catch(err => {
					console.error(err);
				});
			});
			return returnData;
		},
		getAPIKey: function() {
			let returnData = new Map();
			return new Promise(resolve => {
				clientPromise.then(client => {
					const db = client.service('mongodb', 'mongodb-atlas').db('cryptobot');
					client.login().then(() => 
						db.collection('API_KEY').find().execute())
					.then(docs => {

						if(docs.length != 0) {
							docs.forEach((item, index) => {
								returnData.set(item.EXCHANGE_NAME, {apiKey: item.API_KEY, apiSecret: item.API_SECRET, hash: item.HASH});
							});
						}
						resolve(returnData);
					}).catch(err => {
						console.error(err);
						resolve(returnData);
					});
				});
			});
		},
		updateAPIKey: function(exchangeName, apiKey, apiSecret, hash) {
			return new Promise(resolve => {
				clientPromise.then(client => {
					const db = client.service('mongodb', 'mongodb-atlas').db('cryptobot');
					client.login().then(() => 
						db.collection('API_KEY').updateOne({EXCHANGE_NAME: exchangeName}, {API_KEY: apiKey,API_SECRET: apiSecret, HASH: hash}, {upsert: true})
						.then(result => {
							resolve(result.matchedCount);
						})).catch(err => {
						console.error(err);
						resolve(0);
					});
					});
			});
		},
		getUserInfo: function(email, password) {
			let id = "";
			console.log('email', email);
			console.log('password', password);
			return new Promise(resolve => {
			clientPromise.then(client => {
				const db = client.service('mongodb', 'mongodb-atlas').db('cryptobot');
				client.login().then(() => 
					db.collection('USER_INFO').find({email:email, password:password}).execute())
				.then(docs => {
					
					if(docs.length != 0) {
						docs.forEach((item, index) => {
							console.log(item);
							id = item._id;
						});
					}
					resolve(id);
				}).catch(err => {
					console.error(err);
					resolve(id);
				});
			});
			});
		},
		registNewUser: function(email, password) {
			console.log('email', email);
			console.log('password', password);
			return new Promise(resolve => {
			clientPromise.then(client => {
				const db = client.service('mongodb', 'mongodb-atlas').db('cryptobot');
				client.login().then(() => 
					db.collection('USER_INFO').insertOne({email: email,password: password})
						.then(result => {
							console.log('Inserted', result);
							let status = result.insertedId != null ? true : false;
							resolve(status);
						})).catch(err => {
					console.error(err);
					resolve(false);
				});
			});
			});
		},
	};
};
module.exports = DaoService();
module.exports.createInstance = DaoService;