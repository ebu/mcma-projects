const { NotificationEndpoint, HttpClient } = require("mcma-core");

const httpClient = new HttpClient();

function createProxyEC2(workerJobHelper) {
    const ec2hostname = workerJobHelper.request.getRequiredContextVariable("HostnameInstanceEC2");

    const ec2Url = "http://" + ec2hostname + "/new-transform-job";

    const message = {
        input: workerJobHelper.getJobInput(),
        notificationEndpoint: new NotificationEndpoint({
            httpEndpoint: workerJobHelper.getJobAssignmentId() + "/notifications"
        })
    };

    console.log("Sending to", ec2Url, "message", message);
    await httpClient.post(ec2Url, message);
    console.log("Done");
}

module.exports = {
    createProxyEC2
};