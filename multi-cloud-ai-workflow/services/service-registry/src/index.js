// require
const AWS = require("aws-sdk");

exports.handler = async (event, context) => {
    console.log(JSON.stringify(event, null, 2), JSON.stringify(context, null, 2));

    let body = {
        timestamp: new Date().toISOString(),
        status: 404,
        error: "Not found",
        message: "Resource not found",
        path: event.path,
    }

    return {
        statusCode: 404,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify(body, null, 2)
    }
}
