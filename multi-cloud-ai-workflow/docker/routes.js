const transform = require('./transform');
const fs = require('fs');
const axios = require("axios");
const MCMA_CORE = require("mcma-core");

const appRouter = function (app) {


  app.get('/', function (req, res) {
    res.status(200).send('Welcome to MCMA EC2 Transform Service');
  });

/*
  let message = {
      input: {},
      notificationEndpoint: {},
      output: {} // write output here.
  }
  */

  app.post('/new-transform-job', async (req, res, next) => {
    try {
      if (typeof req.body.job !== 'undefined') {

        res.status(200).send({});

        let message = req.body.job;

        try {
            const output = await transform.start(message.input);
            message.status = "COMPLETED";
            message.output = output;
        } catch (error) {
            message.status = "FAILED";
            message.statusMessage = error.message;
        }

        let resourceManager = new MCMA_CORE.ResourceManager();
        resourceManager.sendNotification(message);

      } else {
        res.status(500).send({error: 'No job found in given assignment'});
      }
    } catch (e) {
      next(e);
    }
  });


  app.get('/log', function (req, res) {
    let log = fs.readFileSync('deployment.log', 'utf-8');
    res.send(log);
  });
};

module.exports = appRouter;