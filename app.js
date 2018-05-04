var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var app = express();
var server = require('http').Server(app);
var expressWs = require('express-ws')(app,server);
var session      = require('express-session');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var botBinanceRouter = require('./routes/binance');
var botBittrexRouter = require('./routes/bittrex');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(session({
  secret: 'secr3tStr!n9',
  resave: true,
  saveUninitialized: false
}));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/bot/binance', requiresLogin, botBinanceRouter);
app.use('/bot/bittrex', requiresLogin, botBittrexRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

app.use(requiresLogin);

function requiresLogin(req, res, next) {
  if ((req.session && req.session.userId)) {
    return next();
  } else {
    var err = new Error('You must be logged in to view this page.');
    err.status = 401;
    res.redirect('/');
  }
}

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = {app: app,server: server};
