import { DocumentDatabaseTable } from "@mcma/data";

export async function parentResourceExists(path: string, dbTable: DocumentDatabaseTable): Promise<boolean> {
    const pathComponents = path.split("/").filter(c => c !== "");

    let parentPath = "";
    for (let i = 0; i < pathComponents.length - 1; i = i + 2) {
        parentPath += "/" + pathComponents[i] + "/" + pathComponents[i + 1];
    }

    if (parentPath === "") {
        return true;
    }

    const parentProperties = await dbTable.get(parentPath);
    return !!parentProperties;
}
