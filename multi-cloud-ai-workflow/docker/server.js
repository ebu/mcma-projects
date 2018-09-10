'use strict';

const express = require('express');
const bodyParser = require("body-parser");
const routes = require("./routes.js");

// Constants
const PORT = 8080;
const HOST = '0.0.0.0';

// App
const app = express();

// Body Parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(logErrors);
app.use(clientErrorHandler);
app.use(errorHandler);


// Router
routes(app);


// Server
const server = app.listen(PORT, HOST);
console.log(`Express Running`);



// Error Handler
function logErrors(err, req, res, next) {
  console.error(err.stack);
  next(err);
}

function clientErrorHandler(err, req, res, next) {
  if (req.xhr) {
    res.status(500).send({ error: 'Something failed!' });
  } else {
    next(err);
  }
}

function errorHandler(err, req, res, next) {
  res.status(500);
  res.render('error', { error: err });
}