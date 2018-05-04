var express = require('express');
var router = express.Router();
var daoService = require('./../service/DaoService.js');
/* GET users listing. */
router.get('/get-api-key/:hash', function(req, res, next) {

	const apiKeyList = daoService.getApiKey();
	apiKeyList.forEach((item, index) => {

	});
	const hash = req.params.hash;

	res.send('respond with a resource');
});


router.post('/login', async function(req, res, next) {
	const email = req.body.email;
	const password = req.body.password;
	let userData = await daoService.getUserInfo(email, password);
	if(userData == "") {
		res.end('Can not find user');
	} else {
		req.session.userId = userData;
		res.redirect('/bot/binance');
	}
});

router.get('/regist/:email/password/:password', function(req, res, next) {
	const email = req.params.email;
	const password = req.params.password;
	let userData = daoService.registNewUser(email, password);
	console.log('User data', userData);
	if(userData == false) {
		res.end('Can not find user');
	} else {
		res.send('OK');
	}
});

router.get('/logout', function(req, res, next) {
	if (req.session) {
		req.session.destroy(function(err) {
			if(err) {
				return next(err);
			} else {
				return res.redirect('/');
			}
		});
	}
});

module.exports = router;
