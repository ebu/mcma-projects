import * as fs from "fs";

export const TerraformOutput = JSON.parse(fs.readFileSync("../../deployment/terraform.output.json", "utf8"));