const transform = require('./transform');
const fs = require('fs');
const axios = require("axios");

const appRouter = function (app) {


  app.get('/', function (req, res) {
    res.status(200).send('Welcome to MCMA EC2 Transform Service');
  });



  app.post('/new-transform-job', async (req, res, next) => {
    try {
      if (typeof req.body.job !== 'undefined') {

        const transformJob = await axios.get(req.body.job);
        const jobOutput = await transform.start(transformJob.jobInput);

        res.json(jobOutput);

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