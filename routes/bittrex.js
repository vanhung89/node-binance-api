'use strict';
var express = require('express');
var router = express.Router();
var bittrex = require('node-bittrex-api');
bittrex.options({
	'apikey' : '',
	'apisecret' : '',
});
var daoService = require('./../service/DaoService.js');
var currentPriceMap = new Map();
var websocket;
var listCoin = {};
var listStoplossCoin = daoService.getAllStoplossCoin();
var order;
var listSubscribeCoin = [];
/* GET home page. */
router.get('/', async function(req, res, next) {

	let listCoinTmp = await getBalance();
	order = await getOpenOrders();

	if(order.length > 0) {
		order.forEach((item, index) => {
			item.Limit = Number.parseFloat(item.Limit).toFixed(8);
			subcribeCoin(item.Exchange);
		});
	}
	
	console.log('listStoplossCoin', listStoplossCoin);
	for (let i = listCoinTmp.length - 1; i >= 0; i--) {
		let buyPrice = 0;
		if(listCoinTmp[i].Currency !== 'BTC') {
			buyPrice = await getLatestBuyOrder("BTC-"+listCoinTmp[i].Currency);
		}

		let newData = Object.assign({buyPrice: Number.parseFloat(buyPrice).toFixed(8)}, listCoinTmp[i]);
		listCoin[listCoinTmp[i].Currency] = newData;
	}
	
	res.render('bot-bittrex', { openOrders:  order, balance: listCoin});
});

router.ws('/socket', function(ws, req) {
	ws.on('message', function(msg) {
		websocket = ws;
	});
});

router.post('/unsubcribe', function(req, res, next) {
	unSubcribeCoin(req.params.pair);
	res.send('OK');
});

router.post('/order/cancel', function(req, res, next) {
	let orderId = req.body.orderId;
	let pair = req.body.pair;
	console.log('pair:' + pair + ', orderid: ' + orderId);
	bittrex.cancel({uuid:orderId}, async (data, error) => {
		if(error) {
			res.send(error);
			return;
		} 
		if(listStoplossCoin.has(pair)) {
			const result = await daoService.deleteStoplossCoin(orderId);
			if(result > 0) {
				listStoplossCoin.delete(pair);
				unSubcribeCoin(pair);
				res.send('OK');
			} else {
				res.send('Can not delete stoploss coin');
			}
		} else {
			res.send('OK');
		}
		
		
	});

});

//TODO
router.post('/order/update', function(req, res, next) {
	let pair = req.body.pair;
	let orderId = req.body.orderId;
	bittrex.cancel({uuid:orderId}, (data, error) => {
		if(error) {
			res.send(error);
			return;
		} 

		let quantity = req.body.amount;
		let price = req.body.stopPrice;
		bittrex.tradesell({
			MarketName: pair,
			OrderType: 'LIMIT',
			Quantity: quantity,
			Rate: price.toFixed(8),
					  TimeInEffect: 'GOOD_TIL_CANCELLED', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
					  ConditionType: 'LESS_THAN', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
					  Target: price.toFixed(8) // used in conjunction with ConditionType
					}, function( data, err ) {
						if(error) {
							res.send(error);
							return;
						}
						
						listStoplossCoin.get(pair).percentStopLoss = stoplossCoin.buyPrice * newRatio;
						listStoplossCoin.get(pair).orderId = data.result.OrderId;
						console.log(pair+" Stoploss order response:", data);
					});
	});
});

router.post('/selllimit', function(req, res, next) {
	const pair = req.body.pair;
	const amount = req.body.amount;
	const sellPrice = req.body.sellPrice;
	console.log('pair:' + pair + 'amount:' + amount + 'sellprice:' + sellPrice);
	bittrex.tradesell({
		MarketName: pair,
		OrderType: 'LIMIT',
		Quantity: amount,
		Rate: sellPrice,
					  TimeInEffect: 'GOOD_TIL_CANCELLED', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
					  ConditionType: 'NONE', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
					  Target: 0 // used in conjunction with ConditionType
					}, function( data, err ) {
						if(err) {
							console.error(err);
							res.send(err);

						} else {
							res.send('OK');
						}
					});

});


router.post('/autotrade', function(req, res, next) {

	let key = req.body.coin;
	if(listCoin[key]) {
		let pair = req.body.pair;
		
		
		let quantity = req.body.amountStopLoss;
		let stoploss = (100 - req.body.percentStopLoss)/100;
		let stopPrice = req.body.buyPrice * stoploss;
		console.log('quantity' + quantity +',pair:' + pair + ',price:' + stopPrice);
		bittrex.tradesell({
			MarketName: pair,
			OrderType: 'LIMIT',
			Quantity: quantity,
			Rate: stopPrice.toFixed(8),
					  TimeInEffect: 'GOOD_TIL_CANCELLED', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
					  ConditionType: 'LESS_THAN', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
					  Target: stopPrice.toFixed(8) // used in conjunction with ConditionType
					}, async function( data, err ) {
						if(err) {
							res.send(err);
							console.error(err);
							return;
						}
						
						console.log("order id: " + data.result.OrderId);
						const insertedStatus = await daoService.insertStoplossCoin(pair, req.body.buyPrice, quantity, req.body.percentStopLoss, data.result.OrderId);
						if(insertedStatus == true) {
							listStoplossCoin.set(pair,{percentStopLoss: req.body.percentStopLoss, buyPrice: req.body.buyPrice, orderId:  data.result.OrderId, amount: quantity});
							subcribeCoin(pair);
							res.send("OK");
						} else {
							res.send('Can not insert stoploss coin to database');
						}
						
					});
	} else {
		res.send("Your list coin has not this coin");
	}
});

router.get('/test', async function(req, res, next) {

	bittrex.getcandles({
		marketName: 'USDT-BTC',
tickInterval: 'fiveMin', // intervals are keywords:  'oneMin', 'fiveMin', 'thirtyMin', 'hour', 'day'
}, function( data, err ) {
	let last_tick = data.result[data.result.length - 1];
	console.log(last_tick + " last close: "+last_tick['C']);
});
	res.send(listStoplossCoin);

});

router.post('/buy/hot', async function(req, res, next) {
	let coinName = req.body.coinName;
	let btcAmount = req.body.btcAmount;
	if(coinName == undefined || "" == coinName){
		res.statusCode = 400;
		res.end('BAD REQUEST');
	}

	let symbol = 'BTC-' + coinName.toUpperCase();
	let price = await getPriceOfTicker(symbol);
	let price5Minute = await getPrice5MinuteBefore(symbol);
	if((Number(price5Minute) * 1.3) > price) {
		res.end('Giá đã vượt quá 30%');
		return;
	}
	console.log('price', price);
	price = price*110/100;
	console.log('new price', price.toFixed(8));
	let amount = ((btcAmount - (btcAmount * 0.002)) / price);
	amount = Math.floor(amount);
	console.log('Amount', amount);
	bittrex.tradebuy({
		MarketName: symbol,
		OrderType: 'LIMIT',
		Quantity: amount,
		Rate: price.toFixed(8),
		  TimeInEffect: 'IMMEDIATE_OR_CANCEL', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
		  ConditionType: 'NONE', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
		  Target: 0, // used in conjunction with ConditionType
		}, function( data, err ) {
			if(err) {
				res.send(err);
				return;
			}
			console.log( data );
			res.send('OK');
		});

});


router.post('/buy/normal', async function(req, res, next) {
	let coinName = req.body.coinName;
	let quantity = req.body.quantity;
	let price = req.body.price;
	if(coinName == undefined || "" == coinName || quantity == undefined || "" == quantity || price == undefined || "" == price){
		res.statusCode = 400;
		res.end('BAD REQUEST');
	}

	let symbol = 'BTC-' + coinName.toUpperCase();
	bittrex.tradebuy({
		MarketName: symbol,
		OrderType: 'LIMIT',
		Quantity: quantity,
		Rate: price,
		  TimeInEffect: 'GOOD_TIL_CANCELLED', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
		  ConditionType: 'NONE', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
		  Target: 0, // used in conjunction with ConditionType
		}, function( data, err ) {
			if(err) {
				res.send(err);
				return;
			}
			console.log( data );
			res.send('OK');
		});

});

router.get('/sell/:coin_name/amount/:amount', async function(req, res, next) {
	let coinName = req.params.coin_name;

	if(coinName == undefined || "" == coinName){
		res.statusCode = 400;
		res.end('BAD REQUEST');
	}

	let symbol = 'BTC-' + coinName.toUpperCase();

	let price = await getPriceOfTicker(symbol);
	console.log('price', price);
	let amount = req.params.amount;
	console.log('Amount', amount);
	bittrex.tradesell({
		MarketName: symbol,
		OrderType: 'LIMIT',
		Quantity: amount,
		Rate: price.toFixed(8),
		  TimeInEffect: 'IMMEDIATE_OR_CANCEL', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
		  ConditionType: 'NONE', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
		  Target: 0, // used in conjunction with ConditionType
		}, function( data, err ) {
			if(err)
			{
				res.send(err);
				return;
			}
			console.log( data );
			res.send(data);
		});

});



function getBalance() {
	return new Promise(resolve => {
		bittrex.getbalances( function( data, err ) {
			if(err) {
				console.log(err);
				resolve('');
			} else {
				let result = [];
				data.result.forEach((item, index) => {
					if(item.Currency === 'BTC' || item.Currency === 'ETH' || (item.Currency !== 'BTC' && item.Currency !== 'ETH' && item.Balance >= 1 )) {
						if(item.Currency === 'BTC' || item.Currency === 'ETH') {
							item.Balance = Number.parseFloat(item.Balance).toFixed(8)
							item.Available = Number.parseFloat(item.Available).toFixed(8)
						}
						result.push(item);
					}
				});
				resolve(result);
			}
		});
	});
}

function getPriceOfTicker(pair) {
	return new Promise((resolve, reject) => {
		bittrex.getticker( { market : pair }, function( data, err ) {
			if(err) reject(0);
			else resolve(data.result.Last)
		});
	});
}

function getOpenOrders() {
	return new Promise(resolve => {
		bittrex.getopenorders(function (data, err) {
			if(err) {
				resolve('');
			} else {
				resolve(data.result);
			}
		});
	});
}

function getLatestBuyOrder(pair) {
	return new Promise(resolve => {
		bittrex.getorderhistory({ market : pair }, function( data, err ) {
			if (err) {
				resolve(0);
			} else {
				for(let i = data.result.length - 1; i >= 0; i--) {
					if(data.result[i].OrderType === 'LIMIT_BUY') {
						resolve(Number(data.result[i].Limit));
					}
				}
				resolve(0);
			}
		});
	});
}


function subcribeCoin(pair) {
	if(listSubscribeCoin.indexOf(pair) == -1) {
		listSubscribeCoin.push(pair);
		console.log('New subscribe: ', pair);
		console.log('List new subscribe: ', listSubscribeCoin);
	}
	bittrex.websockets.reset();
	wsSubscribe(listSubscribeCoin);
}

function wsSubscribe(coinArray) {
	bittrex.websockets.subscribe(coinArray, function(data, client) {
		if (data.M === 'updateExchangeState') {
			data.A.forEach(function(data_for) {

				const last = getCurrentPrice(data_for.Fills);
				console.log('Last price of' + data_for.MarketName, last);
				if(last != 0) {
					console.log('listStoplossCoin: ', listStoplossCoin);
					if(typeof listStoplossCoin.get(data_for.MarketName) != 'undefined') {
						let stoplossCoin = listStoplossCoin.get(data_for.MarketName);
						console.log('StoplossCoin: ', stoplossCoin);
						let currentPercent = (last - stoplossCoin.buyPrice)/stoplossCoin.buyPrice*100;
						let percentStopLossRatio = Number(stoplossCoin.percentStopLoss) + 5;
						console.log('Current percent' + data_for.MarketName + ': ' + currentPercent);
						console.log('Stoploss percent' + data_for.MarketName + ': ' + percentStopLossRatio);
						if(currentPercent >= percentStopLossRatio) {
							bittrex.cancel({uuid:stoplossCoin.orderId}, (data, error) => {
								if(error) {
									console.log(error);
								}
								console.log(data_for.MarketName+" cancel response:", data);
								let quantity = stoplossCoin.amount;
								let price = last * (100 - stoplossCoin.percentStopLoss)/100;
								console.log('New price: ' + price);
								bittrex.tradesell({
									MarketName: data_for.MarketName,
									OrderType: 'LIMIT',
									Quantity: quantity,
									Rate: price.toFixed(8),
									TimeInEffect: 'GOOD_TIL_CANCELLED', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
									ConditionType: 'LESS_THAN', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
									Target: price.toFixed(8) // used in conjunction with ConditionType
								}, async function( data, err ) {
									if(err) {
										console.log(err);
									}
									let newRatio = (100 + Number(stoplossCoin.percentStopLoss))/100;
									let newBuyPrice = stoplossCoin.buyPrice * newRatio;
									const numberRecord = await daoService.updateStoplossCoin(stoplossCoin.orderId, data_for.MarketName, newBuyPrice, stoplossCoin.amount, stoplossCoin.percentStopLoss, data.result.OrderId);
									if(numberRecord > 0) {
										listStoplossCoin.get(data_for.MarketName).buyPrice = stoplossCoin.buyPrice * newRatio;
										listStoplossCoin.get(data_for.MarketName).orderId = response.orderId;
										console.log(data_for.MarketName+" Stoploss order response:", data);
									} else {
										console.log('Can not auto increase stoploss percent because can not update new information to database');
									}
									listStoplossCoin.get(data_for.MarketName).buyPrice = stoplossCoin.buyPrice * newRatio;
									listStoplossCoin.get(data_for.MarketName).orderId = data.result.OrderId;

								});
							});
						}
					}

					let json = JSON.stringify({ type:'Message from Bittrex websocket', pair: data_for.MarketName, price:last });
					if(websocket) {
						websocket.send(json);
					}
				}

			});
		}
	}, true);
}

function getCurrentPrice(data) {
	let max = 0;
	data.forEach((item, index) => {
		console.log('Loop to get current price');
		if(item.OrderType === 'BUY' && item.Rate > max) {
			console.log('Find out an item:', item.Rate);
			max = item.Rate;
		} 
	});
	return max;
}


function unSubcribeCoin(pair) {
	
	const index = listSubscribeCoin.indexOf(pair);
	if(index > -1) {
		listSubscribeCoin.splice(index,1);
		console.log('Unsubscribe:' ,pair)
		console.log('List subscribe:' ,listSubscribeCoin)
	}
	bittrex.websockets.reset();
	wsSubscribe(listSubscribeCoin);

}

function getPrice5MinuteBefore(ticker) {
	return new Promise (resolve => {
		bittrex.getcandles({
			marketName: 'USDT-BTC',
			tickInterval: 'fiveMin', // intervals are keywords:  'oneMin', 'fiveMin', 'thirtyMin', 'hour', 'day'
		}, function( data, err ) {
			if (err) {
				resolve(0);
			} else {
				let last_tick = data.result[data.result.length - 1];
				resolve(last_tick['C']);
			}
		});
	});
}
module.exports = router;
