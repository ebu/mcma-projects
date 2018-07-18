//"use strict";

const MCMA_AWS = require("mcma-aws");
const MCMA_CORE = require("mcma-core");

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));


}