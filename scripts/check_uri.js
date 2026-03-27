
const UUID_REGEX = /[0-9a-zA-Z]{8}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{12}/g;
const URI_REGEX = /(?:https?:\/\/[^\s"'<>()\[\]{},;]+|(?<=[\s"'])\/[^\s"'<>()\[\]{},;]+)/g;
const normalizeUri = (uri) => uri.replace(UUID_REGEX, '$(UUID)');

const line = '444.001 I/SC_SERVICE: https://up.stdive.com/sup/fmx/device/list';
const matches = line.match(URI_REGEX);
console.log('Matches:', matches);

if (matches) {
    matches.forEach(m => {
        console.log('Normalized:', normalizeUri(m));
    });
}
