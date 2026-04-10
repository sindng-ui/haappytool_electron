
const val = "1234";
const regexVal = val.replace(/^(P|T)(\d+)$/i, '$1\\s*$2');
const regex = new RegExp(`(?:^|[^0-9a-zA-Z])${regexVal}(?:$|[^0-9a-zA-Z])`, 'i');

const line = "02-16 09:46:13.123  1234  5678 I Tag: Message";
console.log("Regex:", regex);
console.log("Line:", line);
console.log("Match:", regex.test(line));

const brokenRegex = new RegExp(`(?:^| [^ 0 - 9a - zA - Z])${regexVal} (?: $ | [^ 0 - 9a - zA - Z])`, 'i');
console.log("Broken Regex:", brokenRegex);
console.log("Broken Match:", brokenRegex.test(line));
