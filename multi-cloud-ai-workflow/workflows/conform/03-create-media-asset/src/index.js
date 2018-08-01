//"use strict";

const MCMA_CORE = require("mcma-core");

const SERVICE_REGISTRY_URL = process.env.SERVICE_REGISTRY_URL;

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

}