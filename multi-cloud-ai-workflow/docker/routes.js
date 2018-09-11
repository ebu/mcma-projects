const transform = require('./transform');
const fs = require('fs');
const MCMA_CORE = require("mcma-core");

const appRouter = function (app) {


  app.get('/', function (req, res) {
    res.status(200).send('Welcome to MCMA EC2 Transform Service');
  });

  app.post('/new-transform-job', async (req, res, next) => {
    try {
      if (req.body) {
        res.sendStatus(200);

        let job = req.body;

        try {
            const output = await transform.start(job.input);
            job.status = "COMPLETED";
            job.output = output;
        } catch (error) {
            job.status = "FAILED";
            job.statusMessage = error.message;
        }

        let resourceManager = new MCMA_CORE.ResourceManager();

        console.log('Send Callback:', job);
        await resourceManager.sendNotification(job);

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