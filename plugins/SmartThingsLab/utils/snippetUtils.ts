export const generateCurl = (url: string, method: string, token: string, body?: any) => {
    let curl = `curl -X ${method} "${url}" \\\n  -H "Authorization: Bearer ${token}" \\\n  -H "Content-Type: application/json"`;

    if (body) {
        curl += ` \\\n  -d '${JSON.stringify(body, null, 2)}'`;
    }

    return curl;
};

export const generateCliCommand = (deviceId: string, commands: any[]) => {
    return `smartthings devices:commands ${deviceId} '${JSON.stringify(commands)}'`;
};
